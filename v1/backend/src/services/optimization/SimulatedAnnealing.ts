import { Student, Group, Solution, Theme } from '../../domain';
import { ConstraintValidator } from './ConstraintValidator';
import { EnergyCalculator } from './EnergyCalculator';
import { ConstraintRules } from './SystemViabilityAnalyzer';
import { SimulationRuntimeContext } from './SimulationRuntime';

type OptimizationMode = {
  simulationIdeal?: boolean;
  enforceThemeCapacity?: boolean;
  runtime?: SimulationRuntimeContext;
};

/**
 * SimulatedAnnealing - global optimization with probabilistic acceptance.
 *
 * Default behavior is unchanged. In ideal simulation mode, affected groups
 * are re-themed after each swap and theme capacity is treated as hard constraint.
 */
export class SimulatedAnnealing {
  private validator: ConstraintValidator;
  private energyCalculator: EnergyCalculator;
  private initialTemperature: number = 0.8;
  private coolingRate: number = 0.9995;
  private maxIterations: number = 20000;
  private themes: Theme[] = [];
  private simulationIdealMode: boolean = false;
  private enforceThemeCapacity: boolean = false;
  private themeCapacities: Map<string, number> = new Map();
  private runtimeContext?: SimulationRuntimeContext;

  constructor(
    energyCalculator?: EnergyCalculator,
    initialTemp?: number,
    coolingRate?: number,
    maxIterations?: number
  ) {
    this.validator = new ConstraintValidator();
    this.energyCalculator = energyCalculator || new EnergyCalculator();

    if (initialTemp) this.initialTemperature = initialTemp;
    if (coolingRate) this.coolingRate = coolingRate;
    if (maxIterations) this.maxIterations = maxIterations;
  }

  public setConstraintRules(rules: ConstraintRules): void {
    this.validator.setConstraintRules(rules);
  }

  public optimize(solution: Solution, themes: Theme[], mode?: OptimizationMode): Solution {
    this.themes = themes;
    this.simulationIdealMode = Boolean(mode?.simulationIdeal);
    this.enforceThemeCapacity = Boolean(mode?.enforceThemeCapacity);
    this.runtimeContext = mode?.runtime;
    this.themeCapacities = new Map(
      themes.map((theme) => [
        theme.id,
        Number.isFinite(Number(theme.maxGroups))
          ? Math.max(1, Number(theme.maxGroups))
          : Number.MAX_SAFE_INTEGER,
      ])
    );

    let currentSolution = solution;
    let bestSolution = solution;
    let currentEnergy = this.calculateObjectiveEnergy(currentSolution);
    let bestEnergy = currentEnergy;
    let temperature = this.initialTemperature;
    let iteration = 0;
    let acceptedSwaps = 0;

    console.log(`[SimulatedAnnealing] Starting with energy: ${currentEnergy.toFixed(2)}`);

    while (iteration < this.maxIterations && temperature > 1e-6) {
      const neighbor = this.generateNeighbor(currentSolution);

      if (neighbor) {
        const neighborEnergy = this.calculateObjectiveEnergy(neighbor);
        const delta = neighborEnergy - currentEnergy;

        if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
          currentSolution = neighbor;
          acceptedSwaps += 1;

          if (this.runtimeContext?.enabled) {
            this.runtimeContext.vectorState.applyDynamics(
              currentSolution.groups,
              this.runtimeContext.phase,
              this.runtimeContext.dynamicsConfig,
              this.runtimeContext.affinityMatrix
            );
          }

          currentEnergy = this.calculateObjectiveEnergy(currentSolution);
          this.emitRuntimeSnapshot(iteration, acceptedSwaps, currentEnergy, temperature, currentSolution);

          if (currentEnergy < bestEnergy) {
            bestSolution = currentSolution;
            bestEnergy = currentEnergy;
            console.log(`[SimulatedAnnealing] Iter ${iteration}: best energy = ${bestEnergy.toFixed(2)}`);
          }
        }
      }

      temperature *= this.coolingRate;
      iteration++;
    }

    console.log(`[SimulatedAnnealing] Completed. Best energy: ${bestEnergy.toFixed(2)}`);
    bestSolution.totalEnergy = this.calculateSolutionEnergy(bestSolution);
    return bestSolution;
  }

  private generateNeighbor(solution: Solution): Solution | null {
    const groups = solution.groups;

    if (groups.length < 2) {
      return null;
    }

    return this.generateSwapNeighbor(solution);
  }

  private generateSwapNeighbor(solution: Solution): Solution | null {
    const groups = solution.groups;
    const attempts = Math.min(10, groups.length * 2);

    for (let attempt = 0; attempt < attempts; attempt++) {
      const i = Math.floor(Math.random() * groups.length);
      const j = Math.floor(Math.random() * groups.length);

      if (i === j) continue;

      const groupA = groups[i];
      const groupB = groups[j];

      if (groupA.students.length === 0 || groupB.students.length === 0) {
        continue;
      }

      const studentA = groupA.students[Math.floor(Math.random() * groupA.students.length)];
      const studentB = groupB.students[Math.floor(Math.random() * groupB.students.length)];

      const newSolution = this.trySwap(solution, studentA, studentB, groupA, groupB);
      if (newSolution) {
        return newSolution;
      }
    }

    return null;
  }

  private trySwap(
    solution: Solution,
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): Solution | null {
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
    const violations = this.validator.validateGroups(newGroups);
    newSolution.constraintViolations = violations;

    return newSolution;
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

  private calculateGroupEnergyForThemeId(group: Group, themeId: string): number {
    const theme = this.themes.find((item) => item.id === themeId);
    if (!theme) {
      return Infinity;
    }

    return this.energyCalculator.calculateGroupEnergy(group, theme);
  }

  public setWeights(config: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
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

    const bestA = this.findBestThemeForGroupWithCapacity(groupA, usage);
    if (!bestA) {
      return null;
    }

    usage.set(bestA.theme.id, (usage.get(bestA.theme.id) || 0) + 1);

    const bestB = this.findBestThemeForGroupWithCapacity(groupB, usage);
    if (!bestB) {
      return null;
    }

    return {
      groupA: bestA,
      groupB: bestB,
    };
  }

  private findBestThemeForGroupWithCapacity(
    group: Group,
    usage: Map<string, number>
  ): { theme: Theme; energy: number } | null {
    let bestTheme: Theme | null = null;
    let bestEnergy = Infinity;

    for (const theme of this.themes) {
      if (this.enforceThemeCapacity) {
        const used = usage.get(theme.id) || 0;
        const cap = this.themeCapacities.get(theme.id) || Number.MAX_SAFE_INTEGER;
        if (used >= cap) {
          continue;
        }
      }

      const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
      if (!Number.isFinite(energy)) {
        continue;
      }

      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestTheme = theme;
      }
    }

    if (!bestTheme) {
      return null;
    }

    return {
      theme: bestTheme,
      energy: bestEnergy,
    };
  }

  private emitRuntimeSnapshot(
    iteration: number,
    acceptedSwaps: number,
    energy: number,
    temperature: number,
    solution: Solution
  ): void {
    if (!this.runtimeContext?.enabled || !this.runtimeContext.onSnapshot) {
      return;
    }

    const snapshotEvery = Math.max(1, this.runtimeContext.snapshotEvery ?? 10);
    if (acceptedSwaps % snapshotEvery !== 0) {
      return;
    }

    this.runtimeContext.onSnapshot({
      runId: this.runtimeContext.runId || 'adhoc',
      phase: this.runtimeContext.phase,
      stage: 'annealing',
      iteration,
      acceptedSwaps,
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
