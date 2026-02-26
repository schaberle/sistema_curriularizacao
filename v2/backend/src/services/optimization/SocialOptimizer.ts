import { Student, Group, Solution, Theme } from '../../domain';
import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { EnergyCalculator } from './EnergyCalculator';
import { SimulationRuntimeContext } from './SimulationRuntime';
import { ThemeQuotaPolicy } from './ThemeQuotaPolicy';

type SocialOptimizationConfig = {
  wSoc?: number;
  maxIterations?: number;
  temperature?: number;
  simulationIdeal?: boolean;
  enforceThemeProportion?: boolean;
  enforceThemeCapacity?: boolean;
  runtime?: SimulationRuntimeContext;
  themeQuotaPolicy?: ThemeQuotaPolicy;
};

export class SocialOptimizer {
  private affinityMatrix: AffinityMatrix;
  private energyCalculator: EnergyCalculator;
  private wSoc: number = 1.0;
  private maxIterations: number = 20000;
  private initialTemperature: number = 0.8;
  private themes: Theme[] = [];
  private simulationIdealMode: boolean = false;
  private enforceThemeProportion: boolean = false;
  private themeQuotaPolicy?: ThemeQuotaPolicy;
  private runtimeContext?: SimulationRuntimeContext;

  constructor(
    affinityMatrix: AffinityMatrix,
    energyCalculator?: EnergyCalculator,
    config?: SocialOptimizationConfig
  ) {
    this.affinityMatrix = affinityMatrix;
    this.energyCalculator = energyCalculator || new EnergyCalculator();

    if (config) {
      this.wSoc = config.wSoc ?? this.wSoc;
      this.maxIterations = config.maxIterations ?? this.maxIterations;
      this.initialTemperature = config.temperature ?? this.initialTemperature;
      this.simulationIdealMode = Boolean(config.simulationIdeal);
      this.enforceThemeProportion = Boolean(
        config.enforceThemeProportion ?? config.enforceThemeCapacity
      );
      this.themeQuotaPolicy = config.themeQuotaPolicy;
      this.runtimeContext = config.runtime;
    }
  }

  public optimize(solution: Solution, themes: Theme[]): Solution {
    this.themes = themes;

    const baselineStudentGroupMap = this.buildStudentGroupMap(solution);

    let currentSolution = solution;
    let currentEnergy = this.calculateTotalEnergy(currentSolution);

    console.log(`[SocialOptimizer] Starting optimization. energy=${currentEnergy.toFixed(4)}`);
    console.log(`[SocialOptimizer] Config: wSoc=${this.wSoc}, iter=${this.maxIterations}`);

    let acceptedSwaps = 0;
    let attemptedSwaps = 0;
    let temperature = this.initialTemperature;

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      temperature = this.initialTemperature * (1 - iteration / this.maxIterations);

      const result = this.performGuidedSwap(currentSolution);
      if (!result) {
        continue;
      }

      attemptedSwaps += 1;

      const newEnergy = this.calculateTotalEnergy(result.solution);
      const delta = newEnergy - currentEnergy;

      if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(temperature, 0.001))) {
        currentSolution = result.solution;

        if (this.runtimeContext?.enabled) {
          this.runtimeContext.vectorState.applyDynamics(
            currentSolution.groups,
            'phase2',
            this.runtimeContext.dynamicsConfig,
            this.affinityMatrix
          );
        }

        currentEnergy = this.calculateTotalEnergy(currentSolution);
        acceptedSwaps++;
        this.emitRuntimeSnapshot(iteration, acceptedSwaps, currentEnergy, temperature, currentSolution);

        if (iteration % 1000 === 0) {
          console.log(`[SocialOptimizer] Iter ${iteration}: energy=${currentEnergy.toFixed(4)}, T=${temperature.toFixed(4)}`);
        }
      }
    }

    console.log(`[SocialOptimizer] Completed. acceptedSwaps=${acceptedSwaps}/${attemptedSwaps}`);
    console.log(`[SocialOptimizer] Final energy: ${this.calculateTotalEnergy(currentSolution).toFixed(4)}`);

    this.updateSocialMetrics(currentSolution);

    const finalStudentGroupMap = this.buildStudentGroupMap(currentSolution);
    const stabilityPercent = this.calculateStabilityPercent(baselineStudentGroupMap, finalStudentGroupMap);

    (currentSolution as any).__socialExecutionMeta = {
      attemptedSwaps,
      swapsAccepted: acceptedSwaps,
      stabilityPercent,
    };

    return currentSolution;
  }

  private calculateTotalEnergy(solution: Solution): number {
    let totalEnergy = 0;

    for (const group of solution.groups) {
      const theme = this.themes.find((t) => t.id === group.themeId);
      if (!theme) return Infinity;

      const eBase = this.energyCalculator.calculateGroupEnergy(group, theme);
      if (!Number.isFinite(eBase)) return Infinity;

      const eSocial = this.calculateGroupSocialEnergy(group);
      totalEnergy += eBase + eSocial;
    }

    if (this.runtimeContext?.enabled) {
      totalEnergy += this.getVectorLambda() * this.runtimeContext.vectorState.calculateGroupsCompactness(solution.groups);
    }

    return totalEnergy;
  }

  private calculateGroupSocialEnergy(group: Group): number {
    const cohesion = this.affinityMatrix.calculateGroupCohesion(group.students.map((s) => s.id));
    return -this.wSoc * cohesion;
  }

  private performGuidedSwap(solution: Solution): { solution: Solution } | null {
    if (solution.groups.length < 2) return null;

    const groups = solution.groups;

    const groupAIndex = Math.floor(Math.random() * groups.length);
    const groupA = groups[groupAIndex];

    if (groupA.students.length === 0) return null;

    const studentA = this.selectStudentByIsolation(groupA);
    if (!studentA) return null;

    let groupBIndex = Math.floor(Math.random() * groups.length);
    while (groupBIndex === groupAIndex && groups.length > 1) {
      groupBIndex = Math.floor(Math.random() * groups.length);
    }

    const groupB = groups[groupBIndex];
    if (groupB.students.length === 0) return null;

    const studentB = groupB.students[Math.floor(Math.random() * groupB.students.length)];

    if (!this.canPerformSwap(studentA, studentB, groupA, groupB)) {
      return null;
    }

    const swappedSolution = this.performSwap(solution, studentA, studentB, groupA, groupB);
    return swappedSolution ? { solution: swappedSolution } : null;
  }

  private selectStudentByIsolation(group: Group): Student | null {
    if (group.students.length === 0) return null;

    const weights: number[] = [];
    let maxWeight = 0;

    for (const student of group.students) {
      const isolation = this.affinityMatrix.calculateIsolationScore(
        student.id,
        group.students.map((s) => s.id)
      );

      const weight = Math.exp(-isolation);
      weights.push(weight);
      maxWeight = Math.max(maxWeight, weight);
    }

    let attempts = 0;
    while (attempts < 10) {
      const idx = Math.floor(Math.random() * group.students.length);
      const normalized = maxWeight > 0 ? weights[idx] / maxWeight : 1;

      if (Math.random() < normalized) {
        return group.students[idx];
      }

      attempts++;
    }

    return group.students[Math.floor(Math.random() * group.students.length)];
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
    if (this.simulationIdealMode) {
      if (size < 3 || size > 5) return false;
    } else if (size !== 4) {
      return false;
    }

    const electricalCount = group.students.filter((s) => s.course === 'EE').length;
    const minEE = 1;
    const maxEE = this.simulationIdealMode && size < 4 ? Math.min(2, size - 1) : 2;
    if (electricalCount < minEE || electricalCount > maxEE) return false;

    const uniquePhases = new Set(group.students.map((s) => s.phase)).size;
    if (uniquePhases < 2) return false;

    return true;
  }

  private performSwap(
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

    return new Solution(newGroups, [], 0);
  }

  private updateSocialMetrics(solution: Solution): void {
    let totalCohesion = 0;

    for (const group of solution.groups) {
      const cohesion = this.affinityMatrix.calculateGroupCohesion(group.students.map((s) => s.id));
      (group as any).socialCohesionScore = cohesion;
      totalCohesion += cohesion;
    }

    solution.socialScore = totalCohesion;
    solution.socialOptimizationApplied = true;
  }

  public setWeights(config: { wSoc?: number; maxIterations?: number; temperature?: number }) {
    if (config.wSoc !== undefined) this.wSoc = config.wSoc;
    if (config.maxIterations !== undefined) this.maxIterations = config.maxIterations;
    if (config.temperature !== undefined) this.initialTemperature = config.temperature;
  }

  public getConfig() {
    return {
      wSoc: this.wSoc,
      maxIterations: this.maxIterations,
      initialTemperature: this.initialTemperature,
      simulationIdeal: this.simulationIdealMode,
      enforceThemeProportion: this.enforceThemeProportion,
    };
  }

  private buildStudentGroupMap(solution: Solution): Map<string, string> {
    const map = new Map<string, string>();
    for (const group of solution.groups) {
      for (const student of group.students) {
        map.set(student.id, group.id);
      }
    }
    return map;
  }

  private calculateStabilityPercent(before: Map<string, string>, after: Map<string, string>): number {
    if (before.size === 0) {
      return 100;
    }

    let unchanged = 0;
    for (const [studentId, groupId] of before.entries()) {
      if (after.get(studentId) === groupId) {
        unchanged += 1;
      }
    }

    return (unchanged / before.size) * 100;
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
      const baseEnergyA = this.energyCalculator.calculateGroupEnergy(groupA, themeA);
      if (!Number.isFinite(baseEnergyA)) {
        continue;
      }
      const energyA = baseEnergyA + this.calculateGroupSocialEnergy(groupA);

      for (const themeB of this.themes) {
        const baseEnergyB = this.energyCalculator.calculateGroupEnergy(groupB, themeB);
        if (!Number.isFinite(baseEnergyB)) {
          continue;
        }
        const energyB = baseEnergyB + this.calculateGroupSocialEnergy(groupB);

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
      phase: 'phase2',
      stage: 'social_optimizer',
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
