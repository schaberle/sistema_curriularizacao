import { Student, Group, Solution, Theme } from '../../domain';
import { Affinity } from '../../domain/Affinity';
import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { EnergyCalculator } from './EnergyCalculator';

export class SocialOptimizer {
  private affinityMatrix: AffinityMatrix;
  private energyCalculator: EnergyCalculator;
  private wSoc: number = 1.0;
  private maxIterations: number = 20000;
  private initialTemperature: number = 0.8;
  private themes: Theme[] = [];

  constructor(
    affinityMatrix: AffinityMatrix,
    energyCalculator?: EnergyCalculator,
    config?: {
      wSoc?: number;
      maxIterations?: number;
      temperature?: number;
    }
  ) {
    this.affinityMatrix = affinityMatrix;
    this.energyCalculator = energyCalculator || new EnergyCalculator();

    if (config) {
      this.wSoc = config.wSoc ?? this.wSoc;
      this.maxIterations = config.maxIterations ?? this.maxIterations;
      this.initialTemperature = config.temperature ?? this.initialTemperature;
    }
  }

  public optimize(solution: Solution, themes: Theme[]): Solution {
    this.themes = themes;

    let currentSolution = solution;
    let currentEnergy = this.calculateTotalEnergy(currentSolution);

    console.log(`[SocialOptimizer] Iniciando otimização com energia: ${currentEnergy.toFixed(4)}`);
    console.log(`[SocialOptimizer] Configuração: wSoc=${this.wSoc}, iter=${this.maxIterations}`);

    let acceptedSwaps = 0;
    let temperature = this.initialTemperature;

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      temperature = this.initialTemperature * (1 - iteration / this.maxIterations);

      const result = this.performGuidedSwap(currentSolution);

      if (result) {
        const newEnergy = this.calculateTotalEnergy(result.solution);
        const delta = newEnergy - currentEnergy;

        if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(temperature, 0.001))) {
          currentSolution = result.solution;
          currentEnergy = newEnergy;
          acceptedSwaps++;

          if (iteration % 1000 === 0) {
            console.log(`[SocialOptimizer] Iter ${iteration}: energia=${currentEnergy.toFixed(4)}, T=${temperature.toFixed(4)}`);
          }
        }
      }
    }

    console.log(`[SocialOptimizer] Concluída. Swaps aceitos: ${acceptedSwaps}/${this.maxIterations}`);
    console.log(`[SocialOptimizer] Energia final: ${this.calculateTotalEnergy(currentSolution).toFixed(4)}`);

    this.updateSocialMetrics(currentSolution);

    return currentSolution;
  }

  private calculateTotalEnergy(solution: Solution): number {
    let totalEnergy = 0;

    for (const group of solution.groups) {
      const theme = this.themes.find(t => t.id === group.themeId);
      if (!theme) return Infinity;

      const eBase = this.energyCalculator.calculateGroupEnergy(group, theme);
      if (!Number.isFinite(eBase)) return Infinity;

      const eSocial = this.calculateGroupSocialEnergy(group);

      totalEnergy += eBase + eSocial;
    }

    return totalEnergy;
  }

  private calculateGroupSocialEnergy(group: Group): number {
    const cohesion = this.affinityMatrix.calculateGroupCohesion(
      group.students.map(s => s.id)
    );

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

    return { solution: this.performSwap(solution, studentA, studentB, groupA, groupB) };
  }

  private selectStudentByIsolation(group: Group): Student | null {
    if (group.students.length === 0) return null;

    const weights: number[] = [];
    let maxWeight = 0;

    for (const student of group.students) {
      const isolation = this.affinityMatrix.calculateIsolationScore(
        student.id,
        group.students.map(s => s.id)
      );

      const weight = Math.exp(-isolation);
      weights.push(weight);
      maxWeight = Math.max(maxWeight, weight);
    }

    let attempts = 0;
    while (attempts < 10) {
      const idx = Math.floor(Math.random() * group.students.length);
      const normalized = weights[idx] / maxWeight;

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
      groupA.students.filter(s => s.id !== studentA.id).concat([studentB])
    );

    const tempGroupB = new Group(
      groupB.id,
      groupB.themeId,
      groupB.distributionId,
      groupB.students.filter(s => s.id !== studentB.id).concat([studentA])
    );

    return this.isGroupFeasible(tempGroupA) && this.isGroupFeasible(tempGroupB);
  }

  private isGroupFeasible(group: Group): boolean {
    if (group.students.length !== 4) return false;

    const electricalCount = group.students.filter(s => s.course === 'EE').length;
    if (electricalCount < 1 || electricalCount > 2) return false;

    const uniquePhases = new Set(group.students.map(s => s.phase)).size;
    if (uniquePhases < 2) return false;

    return true;
  }

  private performSwap(
    solution: Solution,
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): Solution {
    const newGroupA = new Group(
      groupA.id,
      groupA.themeId,
      groupA.distributionId,
      groupA.students.filter(s => s.id !== studentA.id).concat([studentB])
    );

    const newGroupB = new Group(
      groupB.id,
      groupB.themeId,
      groupB.distributionId,
      groupB.students.filter(s => s.id !== studentB.id).concat([studentA])
    );

    const newGroups = solution.groups.map(g => {
      if (g.id === groupA.id) return newGroupA;
      if (g.id === groupB.id) return newGroupB;
      return g;
    });

    return new Solution(newGroups, [], 0);
  }

  private updateSocialMetrics(solution: Solution): void {
    for (const group of solution.groups) {
      const cohesion = this.affinityMatrix.calculateGroupCohesion(
        group.students.map(s => s.id)
      );

      (group as any).socialCohesionScore = cohesion;
    }
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
      initialTemperature: this.initialTemperature
    };
  }
}
