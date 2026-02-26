import { Student, Theme, Solution } from '../../domain';
import { SolutionGenerator } from './SolutionGenerator';
import { LocalSearch } from './LocalSearch';
import { SimulatedAnnealing } from './SimulatedAnnealing';
import { EnergyCalculator } from './EnergyCalculator';
import { SocialOptimizer } from './SocialOptimizer';
import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { AdaptiveConstraintManager } from './AdaptiveConstraintManager';
import { SimulationRuntimeContext } from './SimulationRuntime';
import { getPlannedGroupCount } from './groupSizePlanner';
import { ThemeQuotaPolicy } from './ThemeQuotaPolicy';

export type Phase1ExecutionOptions = {
  temperature?: number;
  simulationIdeal?: boolean;
  enforceThemeProportion?: boolean;
  enforceThemeCapacity?: boolean;
  runtime?: SimulationRuntimeContext;
};

export type Phase2ExecutionOptions = {
  wSoc?: number;
  maxIterations?: number;
  temperature?: number;
  simulationIdeal?: boolean;
  enforceThemeProportion?: boolean;
  enforceThemeCapacity?: boolean;
  runtime?: SimulationRuntimeContext;
};

/**
 * DistributionEngine - orchestrates phase 1 and phase 2 optimizations.
 */
export class DistributionEngine {
  private generator: SolutionGenerator;
  private localSearch: LocalSearch;
  private simulatedAnnealing: SimulatedAnnealing;
  private energyCalculator: EnergyCalculator;
  private constraintManager: AdaptiveConstraintManager;

  constructor(config?: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
    this.generator = new SolutionGenerator(config);
    this.localSearch = new LocalSearch(this.energyCalculator);
    this.simulatedAnnealing = new SimulatedAnnealing(this.energyCalculator);
    this.constraintManager = new AdaptiveConstraintManager();
  }

  async solvePhase1(
    students: Student[],
    themes: Theme[],
    options?: Phase1ExecutionOptions
  ): Promise<{
    solution: Solution;
    report: string;
    executionTime: number;
    constraintAdaptation?: { adapted: boolean; reason?: string };
  }> {
    const startTime = Date.now();
    const enforceThemeProportion = Boolean(
      options?.enforceThemeProportion ?? options?.enforceThemeCapacity
    );

    if (students.length === 0 || themes.length === 0) {
      return {
        solution: new Solution([], [], 0),
        report: 'Invalid input: empty students or themes.',
        executionTime: 0,
        constraintAdaptation: { adapted: false },
      };
    }

    const themeQuotaPolicy =
      options?.simulationIdeal && enforceThemeProportion
        ? new ThemeQuotaPolicy(themes, getPlannedGroupCount(students.length))
        : undefined;

    if (options?.simulationIdeal && enforceThemeProportion) {
      this.assertThemeProportionFeasibility(students, themes, themeQuotaPolicy);
    }

    const constraintState = this.constraintManager.analyzeAndAdapt(students, themes);
    if (constraintState.adaptedFromDefault) {
      this.energyCalculator.setConstraintRules(constraintState.rules);
      this.generator.setConstraintRules(constraintState.rules);
      this.localSearch.setConstraintRules(constraintState.rules);
      this.simulatedAnnealing.setConstraintRules(constraintState.rules);
    }

    const phase1Start = Date.now();
    let solution = this.generator.generateInitialSolution(students, themes, themeQuotaPolicy);
    const generationTime = Date.now() - phase1Start;

    this.emitRuntimeSnapshot(options?.runtime, 'initial', 0, solution, this.calculateObjectiveEnergy(solution, themes, options?.runtime));

    const phase2Start = Date.now();
    solution = this.localSearch.optimize(solution, themes, {
      temperature: options?.temperature,
      simulationIdeal: options?.simulationIdeal,
      enforceThemeProportion,
      runtime: options?.runtime,
      themeQuotaPolicy,
    });
    const localSearchTime = Date.now() - phase2Start;

    const phase3Start = Date.now();
    solution = this.simulatedAnnealing.optimize(solution, themes, {
      simulationIdeal: options?.simulationIdeal,
      enforceThemeProportion,
      runtime: options?.runtime,
      themeQuotaPolicy,
    });
    const annealingTime = Date.now() - phase3Start;

    solution.totalEnergy = this.calculateSolutionEnergy(solution, themes);

    if (options?.simulationIdeal && enforceThemeProportion) {
      this.assertSolutionThemeQuota(solution, themeQuotaPolicy);
    }

    return {
      solution,
      report: this.generatePhase1Report(solution, generationTime, localSearchTime, annealingTime),
      executionTime: Date.now() - startTime,
      constraintAdaptation: {
        adapted: constraintState.adaptedFromDefault,
        reason: constraintState.reasonForAdaptation,
      },
    };
  }

  async solve(
    students: Student[],
    themes: Theme[]
  ): Promise<{
    solution: Solution;
    report: string;
    executionTime: number;
  }> {
    return this.solvePhase1(students, themes);
  }

  async solvePhase2(
    phase1Solution: Solution,
    affinityMatrix: AffinityMatrix,
    themes: Theme[],
    config?: Phase2ExecutionOptions
  ): Promise<{
    solution: Solution;
    report: string;
    executionTime: number;
    metrics: {
      before: { energy: number; satisfaction: number; cohesion: number };
      after: { energy: number; satisfaction: number; cohesion: number };
      changes: Array<{
        studentId: string;
        studentName: string;
        fromGroupId: string;
        toGroupId: string;
        fromThemeId: string;
        toThemeId: string;
      }>;
      socialExecution?: {
        attemptedSwaps: number;
        swapsAccepted: number;
        stabilityPercent: number;
      };
    };
  }> {
    const startTime = Date.now();
    const enforceThemeProportion = Boolean(
      config?.enforceThemeProportion ?? config?.enforceThemeCapacity
    );

    const metricsBefore = {
      energy: this.calculateSolutionEnergy(phase1Solution, themes),
      satisfaction: phase1Solution.getAverageSatisfactionScore(),
      cohesion: this.calculateSolutionCohesion(phase1Solution, affinityMatrix),
    };

    this.emitRuntimeSnapshot(
      config?.runtime,
      'initial',
      0,
      phase1Solution,
      this.calculateObjectiveEnergy(phase1Solution, themes, config?.runtime, affinityMatrix)
    );

    const originalGroupByStudent = new Map<string, { groupId: string; themeId: string }>();
    for (const group of phase1Solution.groups) {
      for (const student of group.students) {
        originalGroupByStudent.set(student.id, {
          groupId: group.id,
          themeId: group.themeId,
        });
      }
    }

    const optimizer = new SocialOptimizer(affinityMatrix, this.energyCalculator, {
      wSoc: config?.wSoc,
      maxIterations: config?.maxIterations,
      temperature: config?.temperature,
      simulationIdeal: config?.simulationIdeal,
      enforceThemeProportion,
      runtime: config?.runtime,
      themeQuotaPolicy:
        config?.simulationIdeal && enforceThemeProportion
          ? new ThemeQuotaPolicy(themes, phase1Solution.groups.length)
          : undefined,
    });

    const optimizationStart = Date.now();
    const solution = optimizer.optimize(phase1Solution, themes);
    const optimizationTime = Date.now() - optimizationStart;

    solution.totalEnergy = this.calculateSolutionEnergy(solution, themes);

    if (config?.simulationIdeal && enforceThemeProportion) {
      this.assertSolutionThemeQuota(solution, new ThemeQuotaPolicy(themes, solution.groups.length));
    }

    const metricsAfter = {
      energy: solution.totalEnergy,
      satisfaction: solution.getAverageSatisfactionScore(),
      cohesion: this.calculateSolutionCohesion(solution, affinityMatrix),
    };

    const changes: Array<{
      studentId: string;
      studentName: string;
      fromGroupId: string;
      toGroupId: string;
      fromThemeId: string;
      toThemeId: string;
    }> = [];

    for (const group of solution.groups) {
      for (const student of group.students) {
        const original = originalGroupByStudent.get(student.id);
        if (original && original.groupId !== group.id) {
          changes.push({
            studentId: student.id,
            studentName: student.name,
            fromGroupId: original.groupId,
            toGroupId: group.id,
            fromThemeId: original.themeId,
            toThemeId: group.themeId,
          });
        }
      }
    }

    const socialExecutionMeta = (solution as any).__socialExecutionMeta || {
      attemptedSwaps: 0,
      swapsAccepted: 0,
      stabilityPercent: 100,
    };

    return {
      solution,
      report: this.generatePhase2Report(solution, optimizationTime, socialExecutionMeta.swapsAccepted),
      executionTime: Date.now() - startTime,
      metrics: {
        before: metricsBefore,
        after: metricsAfter,
        changes,
        socialExecution: {
          attemptedSwaps: Number(socialExecutionMeta.attemptedSwaps || 0),
          swapsAccepted: Number(socialExecutionMeta.swapsAccepted || 0),
          stabilityPercent: Number(socialExecutionMeta.stabilityPercent || 100),
        },
      },
    };
  }

  validateScenario(students: Student[], themes: Theme[]): { isFeasible: boolean; issues: string[] } {
    const issues: string[] = [];

    if (students.length === 0) {
      issues.push('No students registered.');
    }
    if (themes.length === 0) {
      issues.push('No themes registered.');
    }

    return {
      isFeasible: issues.length === 0,
      issues,
    };
  }

  getWeights() {
    return this.energyCalculator.getWeights();
  }

  setWeights(config: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
    this.generator.setWeights(config);
    this.localSearch.setWeights(config);
    this.simulatedAnnealing.setWeights(config);
  }

  private calculateSolutionEnergy(solution: Solution, themes: Theme[]): number {
    let total = 0;

    for (const group of solution.groups) {
      const theme = themes.find((item) => item.id === group.themeId);
      if (!theme) {
        return Infinity;
      }

      const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
      if (!Number.isFinite(energy)) {
        return Infinity;
      }

      total += energy;
    }

    return total;
  }

  private calculateObjectiveEnergy(
    solution: Solution,
    themes: Theme[],
    runtime?: SimulationRuntimeContext,
    affinityMatrix?: AffinityMatrix,
  ): number {
    const base = this.calculateSolutionEnergy(solution, themes);
    if (!Number.isFinite(base)) {
      return Infinity;
    }

    let socialComponent = 0;
    if (affinityMatrix) {
      for (const group of solution.groups) {
        socialComponent += -1 * affinityMatrix.calculateGroupCohesion(group.students.map((student) => student.id));
      }
    }

    if (!runtime?.enabled) {
      return base + socialComponent;
    }

    const vectorComponent = runtime.vectorState.calculateGroupsCompactness(solution.groups);
    return base + socialComponent + (runtime.lambdaVec ?? 0.35) * vectorComponent;
  }

  private calculateSolutionCohesion(solution: Solution, affinityMatrix: AffinityMatrix): number {
    let cohesion = 0;
    for (const group of solution.groups) {
      cohesion += affinityMatrix.calculateGroupCohesion(group.students.map((student) => student.id));
    }
    return cohesion;
  }

  private assertThemeProportionFeasibility(
    students: Student[],
    themes: Theme[],
    quotaPolicy?: ThemeQuotaPolicy
  ): void {
    const requiredGroups = getPlannedGroupCount(students.length);
    if (requiredGroups < 0) {
      throw new Error('Planned groups is invalid for ideal simulation mode.');
    }

    const totalThemeWeight = themes.reduce((sum, theme) => sum + Math.max(0, Number(theme.groupProportion || 0)), 0);
    if (totalThemeWeight <= 0) {
      throw new Error('Theme proportion is infeasible for ideal simulation mode. totalThemeWeight=0');
    }

    if (!quotaPolicy) {
      return;
    }

    const totalTarget = quotaPolicy.getRanges().reduce((sum, range) => sum + range.target, 0);
    if (totalTarget !== requiredGroups) {
      throw new Error(
        `Theme proportion target mismatch for ideal simulation mode. requiredGroups=${requiredGroups}, totalTarget=${totalTarget}`
      );
    }
  }

  private assertSolutionThemeQuota(solution: Solution, quotaPolicy?: ThemeQuotaPolicy): void {
    if (!quotaPolicy) {
      return;
    }

    const usage = quotaPolicy.buildUsageFromGroups(solution.groups);
    const validation = quotaPolicy.validateUsage(usage, {
      requireMin: true,
      requireMax: true,
      requireOrder: true,
      requireBalance: true,
    });

    if (!validation.ok) {
      throw new Error(
        `Theme proportion violated in ideal simulation mode. ${validation.violations.join(' | ')}`
      );
    }
  }

  private generatePhase1Report(
    solution: Solution,
    generationTime: number,
    localSearchTime: number,
    annealingTime: number
  ): string {
    const totalTime = generationTime + localSearchTime + annealingTime;

    return [
      'PHASE 1 REPORT',
      `Groups: ${solution.getGroupCount()}`,
      `Allocated students: ${solution.getAllocatedStudentCount()}`,
      `Total energy: ${solution.getTotalEnergy()}`,
      `Feasible: ${solution.isFeasible()}`,
      `Time generation: ${generationTime}ms`,
      `Time localSearch: ${localSearchTime}ms`,
      `Time annealing: ${annealingTime}ms`,
      `Time total: ${totalTime}ms`,
    ].join('\n');
  }

  private generatePhase2Report(
    solution: Solution,
    optimizationTime: number,
    swapsPerformed: number
  ): string {
    return [
      'PHASE 2 REPORT',
      `Groups: ${solution.getGroupCount()}`,
      `Allocated students: ${solution.getAllocatedStudentCount()}`,
      `Total energy: ${solution.getTotalEnergy()}`,
      `Social score: ${solution.getSocialScore()}`,
      `Social optimization applied: ${solution.socialOptimizationApplied}`,
      `Swaps performed: ${swapsPerformed}`,
      `Optimization time: ${optimizationTime}ms`,
    ].join('\n');
  }

  private emitRuntimeSnapshot(
    runtime: SimulationRuntimeContext | undefined,
    stage: 'initial',
    iteration: number,
    solution: Solution,
    energy: number
  ): void {
    if (!runtime?.enabled || !runtime.onSnapshot) {
      return;
    }

    runtime.onSnapshot({
      runId: runtime.runId || 'adhoc',
      phase: runtime.phase,
      stage,
      iteration,
      acceptedSwaps: 0,
      energy,
      positions: runtime.vectorState.projectTo3D(runtime.axisThemeIds, runtime.students, solution.groups, {
        mode: runtime.projectionMode,
        weights: runtime.projectionWeights,
        affinityMatrix: runtime.affinityMatrix,
      }),
      emittedAt: new Date().toISOString(),
    });
  }
}
