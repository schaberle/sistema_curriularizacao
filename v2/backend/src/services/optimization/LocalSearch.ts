import { Student, Group, Solution, Theme } from '../../domain';
import { ConstraintValidator } from './ConstraintValidator';
import { EnergyCalculator } from './EnergyCalculator';
import { ConstraintRules } from './SystemViabilityAnalyzer';
import { SimulationRuntimeContext } from './SimulationRuntime';
import { ThemeQuotaPolicy } from './ThemeQuotaPolicy';

type OptimizationMode = {
  simulationIdeal?: boolean;
  enforceThemeProportion?: boolean;
  enforceThemeCapacity?: boolean;
  temperature?: number;
  runtime?: SimulationRuntimeContext;
  themeQuotaPolicy?: ThemeQuotaPolicy;
};

/**
 * LocalSearch - local refinement with 2-opt swaps.
 *
 * Default behavior is unchanged. When simulationIdeal is enabled,
 * affected groups are re-themed after each candidate swap and
 * proportional theme quotas can be enforced as hard constraints.
 */
export class LocalSearch {
  private validator: ConstraintValidator;
  private energyCalculator: EnergyCalculator;
  private maxIterationsWithoutImprovement: number = 100;
  private themes: Theme[] = [];
  private simulationIdealMode: boolean = false;
  private enforceThemeProportion: boolean = false;
  private currentTemperature: number = 0;
  private themeQuotaPolicy?: ThemeQuotaPolicy;
  private runtimeContext?: SimulationRuntimeContext;
  private runtimeAcceptedSwaps: number = 0;

  private rules: ConstraintRules = {
    minElectricalEngineers: 1,
    maxElectricalEngineers: 2,
    minPhaseDiversity: 2,
    groupSize: 4,
  };

  constructor(energyCalculator?: EnergyCalculator) {
    this.validator = new ConstraintValidator();
    this.energyCalculator = energyCalculator || new EnergyCalculator();
  }

  public setConstraintRules(rules: ConstraintRules): void {
    this.rules = rules;
    this.validator.setConstraintRules(rules);
  }

  public optimize(solution: Solution, themes: Theme[], mode?: OptimizationMode): Solution {
    this.themes = themes;
    this.simulationIdealMode = Boolean(mode?.simulationIdeal);
    this.enforceThemeProportion = Boolean(mode?.enforceThemeProportion ?? mode?.enforceThemeCapacity);
    this.currentTemperature = Number.isFinite(Number(mode?.temperature)) ? Number(mode?.temperature) : 0;
    this.themeQuotaPolicy = mode?.themeQuotaPolicy;
    this.runtimeContext = mode?.runtime;
    this.runtimeAcceptedSwaps = 0;

    let currentSolution = solution;
    let iterationsWithoutImprovement = 0;
    let currentEnergy = this.calculateObjectiveEnergy(currentSolution);

    console.log(`[LocalSearch] Initial energy: ${currentEnergy.toFixed(4)}`);

    while (iterationsWithoutImprovement < this.maxIterationsWithoutImprovement) {
      const candidate = this.perform2Opt(currentSolution);

      if (!candidate) {
        iterationsWithoutImprovement++;
        continue;
      }

      const previousEnergy = currentEnergy;
      currentSolution = candidate.solution;
      currentEnergy = candidate.objectiveEnergy;

      if (currentEnergy < previousEnergy) {
        iterationsWithoutImprovement = 0;
        console.log(`[LocalSearch] Improved energy: ${currentEnergy.toFixed(4)}`);
      } else {
        iterationsWithoutImprovement++;
      }
    }

    console.log(`[LocalSearch] Final energy: ${currentEnergy.toFixed(4)}`);
    currentSolution.totalEnergy = this.calculateSolutionEnergy(currentSolution);
    return currentSolution;
  }

  private perform2Opt(solution: Solution): { solution: Solution; objectiveEnergy: number } | null {
    const groups = solution.groups;

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const groupA = groups[i];
        const groupB = groups[j];

        for (const studentA of groupA.students) {
          for (const studentB of groupB.students) {
            if (!this.canPerformSwap(studentA, studentB, groupA, groupB)) {
              continue;
            }

            const delta = this.calculateSwapDelta(studentA, studentB, groupA, groupB, solution);
            if (!this.shouldAcceptSwap(delta)) {
              continue;
            }

            const swapped = this.performSwap(solution, studentA, studentB, groupA, groupB);
            if (swapped) {
              return swapped;
            }
          }
        }
      }
    }

    return null;
  }

  private shouldAcceptSwap(deltaObjective: number): boolean {
    if (!Number.isFinite(deltaObjective)) {
      return false;
    }

    if (deltaObjective < 0) {
      return true;
    }

    if (this.currentTemperature <= 0) {
      return false;
    }

    const probability = Math.exp(-deltaObjective / this.currentTemperature);
    return Math.random() < probability;
  }

  private calculateSwapDelta(
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group,
    solution: Solution
  ): number {
    const energyBefore =
      this.calculateGroupEnergyForThemeId(groupA, groupA.themeId) +
      this.calculateGroupEnergyForThemeId(groupB, groupB.themeId);

    const newGroupA = new Group(
      groupA.id,
      groupA.themeId,
      groupA.distributionId,
      groupA.students.filter((s) => s.id !== studentA.id).concat([studentB])
    );

    const newGroupB = new Group(
      groupB.id,
      groupB.themeId,
      groupB.distributionId,
      groupB.students.filter((s) => s.id !== studentB.id).concat([studentA])
    );

    let energyAfter = 0;

    if (this.simulationIdealMode) {
      const bestThemes = this.chooseBestThemesForSwap(newGroupA, newGroupB, solution, groupA.id, groupB.id);
      if (!bestThemes) {
        return Infinity;
      }
      energyAfter = bestThemes.groupA.energy + bestThemes.groupB.energy;
    } else {
      energyAfter =
        this.calculateGroupEnergyForThemeId(newGroupA, groupA.themeId) +
        this.calculateGroupEnergyForThemeId(newGroupB, groupB.themeId);
    }

    if (!Number.isFinite(energyAfter)) {
      return Infinity;
    }

    const discreteDelta = energyAfter - energyBefore;

    if (!this.runtimeContext?.enabled) {
      return discreteDelta;
    }

    const vectorDelta = this.calculateVectorSwapDelta(groupA, groupB, newGroupA, newGroupB);
    return discreteDelta + this.getVectorLambda() * vectorDelta;
  }

  private calculateVectorSwapDelta(groupA: Group, groupB: Group, newGroupA: Group, newGroupB: Group): number {
    const vectorState = this.runtimeContext?.vectorState;
    if (!vectorState) {
      return 0;
    }

    const before =
      vectorState.calculateCompactnessByStudentIds(groupA.students.map((student) => student.id)) +
      vectorState.calculateCompactnessByStudentIds(groupB.students.map((student) => student.id));

    const after =
      vectorState.calculateCompactnessByStudentIds(newGroupA.students.map((student) => student.id)) +
      vectorState.calculateCompactnessByStudentIds(newGroupB.students.map((student) => student.id));

    return after - before;
  }

  private canPerformSwap(
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): boolean {
    const tempGroupA = new Group(
      groupA.id,
      groupA.themeId,
      groupA.distributionId,
      groupA.students.filter((s) => s.id !== studentA.id).concat([studentB])
    );

    const tempGroupB = new Group(
      groupB.id,
      groupB.themeId,
      groupB.distributionId,
      groupB.students.filter((s) => s.id !== studentB.id).concat([studentA])
    );

    return this.isGroupFeasible(tempGroupA) && this.isGroupFeasible(tempGroupB);
  }

  private isGroupFeasible(group: Group): boolean {
    const size = group.students.length;
    const minSize = this.rules.groupSize - 1;
    const maxSize = this.rules.groupSize + 1;
    if (size < minSize || size > maxSize) return false;

    const electricalCount = group.students.filter((s) => s.course === 'EE').length;
    const minEE = this.rules.minElectricalEngineers;
    const maxEE =
      size >= this.rules.groupSize
        ? this.rules.maxElectricalEngineers
        : Math.min(this.rules.maxElectricalEngineers, size - 1);
    if (electricalCount < minEE || electricalCount > maxEE) return false;

    const uniquePhases = new Set(group.students.map((s) => s.phase)).size;
    if (uniquePhases < this.rules.minPhaseDiversity) return false;

    return true;
  }

  private performSwap(
    solution: Solution,
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): { solution: Solution; objectiveEnergy: number } | null {
    const newGroupA = new Group(
      groupA.id,
      groupA.themeId,
      groupA.distributionId,
      groupA.students.filter((s) => s.id !== studentA.id).concat([studentB])
    );

    const newGroupB = new Group(
      groupB.id,
      groupB.themeId,
      groupB.distributionId,
      groupB.students.filter((s) => s.id !== studentB.id).concat([studentA])
    );

    if (this.simulationIdealMode) {
      const bestThemes = this.chooseBestThemesForSwap(newGroupA, newGroupB, solution, groupA.id, groupB.id);
      if (!bestThemes) {
        return null;
      }
      newGroupA.themeId = bestThemes.groupA.theme.id;
      newGroupB.themeId = bestThemes.groupB.theme.id;
    }

    const newGroups = solution.groups.map((g) => {
      if (g.id === groupA.id) return newGroupA;
      if (g.id === groupB.id) return newGroupB;
      return g;
    });

    const newSolution = new Solution(newGroups, [], 0);
    let objectiveEnergy = this.calculateObjectiveEnergy(newSolution);

    if (this.runtimeContext?.enabled) {
      this.runtimeContext.vectorState.applyDynamics(
        newSolution.groups,
        this.runtimeContext.phase,
        this.runtimeContext.dynamicsConfig,
        this.runtimeContext.affinityMatrix
      );

      this.runtimeAcceptedSwaps += 1;
      objectiveEnergy = this.calculateObjectiveEnergy(newSolution);
      this.emitRuntimeSnapshot('local_search', this.runtimeAcceptedSwaps, objectiveEnergy, newSolution);
    }

    return {
      solution: newSolution,
      objectiveEnergy,
    };
  }

  private calculateSolutionEnergy(solution: Solution): number {
    let totalEnergy = 0;

    for (const group of solution.groups) {
      const energy = this.calculateGroupEnergyForThemeId(group, group.themeId);
      if (!Number.isFinite(energy)) {
        return Infinity;
      }
      totalEnergy += energy;
    }

    return totalEnergy;
  }

  private calculateObjectiveEnergy(solution: Solution): number {
    const baseEnergy = this.calculateSolutionEnergy(solution);
    if (!Number.isFinite(baseEnergy)) {
      return Infinity;
    }

    if (!this.runtimeContext?.enabled) {
      return baseEnergy;
    }

    const vectorEnergy = this.runtimeContext.vectorState.calculateGroupsCompactness(solution.groups);
    return baseEnergy + this.getVectorLambda() * vectorEnergy;
  }

  public setWeights(config: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
  }

  private calculateGroupEnergyForThemeId(group: Group, themeId: string): number {
    const theme = this.themes.find((item) => item.id === themeId);
    if (!theme) {
      return Infinity;
    }
    return this.energyCalculator.calculateGroupEnergy(group, theme);
  }

  private buildThemeUsageExcluding(solution: Solution, excludedGroupIds: Set<string>): Map<string, number> {
    const usage = new Map<string, number>();
    for (const group of solution.groups) {
      if (excludedGroupIds.has(group.id)) {
        continue;
      }
      usage.set(group.themeId, (usage.get(group.themeId) || 0) + 1);
    }
    return usage;
  }

  private chooseBestThemesForSwap(
    groupA: Group,
    groupB: Group,
    solution: Solution,
    groupAId: string,
    groupBId: string
  ):
    | {
        groupA: { theme: Theme; energy: number };
        groupB: { theme: Theme; energy: number };
      }
    | null {
    const usage = this.buildThemeUsageExcluding(solution, new Set([groupAId, groupBId]));
    let bestPair:
      | {
          groupA: { theme: Theme; energy: number };
          groupB: { theme: Theme; energy: number };
          totalEnergy: number;
        }
      | null = null;

    for (const themeA of this.themes) {
      const energyA = this.energyCalculator.calculateGroupEnergy(groupA, themeA);
      if (!Number.isFinite(energyA)) {
        continue;
      }

      for (const themeB of this.themes) {
        const energyB = this.energyCalculator.calculateGroupEnergy(groupB, themeB);
        if (!Number.isFinite(energyB)) {
          continue;
        }

        const candidateUsage = new Map(usage);
        candidateUsage.set(themeA.id, (candidateUsage.get(themeA.id) || 0) + 1);
        candidateUsage.set(themeB.id, (candidateUsage.get(themeB.id) || 0) + 1);

        if (this.enforceThemeProportion && this.themeQuotaPolicy) {
          const validation = this.themeQuotaPolicy.validateUsage(candidateUsage, {
            requireMin: true,
            requireMax: true,
            requireOrder: true,
            requireBalance: true,
          });
          if (!validation.ok) {
            continue;
          }
        }

        const totalEnergy = energyA + energyB;
        if (!bestPair || totalEnergy < bestPair.totalEnergy) {
          bestPair = {
            groupA: { theme: themeA, energy: energyA },
            groupB: { theme: themeB, energy: energyB },
            totalEnergy,
          };
        }
      }
    }

    if (!bestPair) {
      return null;
    }

    return {
      groupA: bestPair.groupA,
      groupB: bestPair.groupB,
    };
  }

  private emitRuntimeSnapshot(
    stage: 'local_search',
    iteration: number,
    energy: number,
    solution: Solution,
    temperature?: number
  ): void {
    if (!this.runtimeContext?.enabled || !this.runtimeContext.onSnapshot) {
      return;
    }

    const snapshotEvery = Math.max(1, this.runtimeContext.snapshotEvery ?? 10);
    if (iteration % snapshotEvery !== 0) {
      return;
    }

    this.runtimeContext.onSnapshot({
      runId: this.runtimeContext.runId || 'adhoc',
      phase: this.runtimeContext.phase,
      stage,
      iteration,
      acceptedSwaps: this.runtimeAcceptedSwaps,
      temperature,
      energy,
      positions: this.runtimeContext.vectorState.projectTo3D(
        this.runtimeContext.axisThemeIds,
        this.runtimeContext.students,
        solution.groups,
        {
          mode: this.runtimeContext.projectionMode,
          weights: this.runtimeContext.projectionWeights,
          affinityMatrix: this.runtimeContext.affinityMatrix,
        }
      ),
      emittedAt: new Date().toISOString(),
    });
  }

  private getVectorLambda(): number {
    return this.runtimeContext?.lambdaVec ?? 0.35;
  }
}
