import { Group, Theme, Student } from '../../domain';
import { ConstraintRules } from './SystemViabilityAnalyzer';

/**
 * EnergyCalculator - phase-1 energy model.
 *
 * E(g,t) = E_pref(g,t) + E_phase(g) + E_size(g) for feasible groups.
 * Infeasible groups return +Infinity.
 */
export class EnergyCalculator {
  private readonly wPref: number;
  private readonly wDup: number;
  private readonly wDiv: number;

  private readonly SCORE_TABLE = [100, 70, 50, 35, 25, 18, 12, 8];

  private rules: ConstraintRules = {
    minElectricalEngineers: 1,
    maxElectricalEngineers: 2,
    minPhaseDiversity: 2,
    groupSize: 4
  };

  constructor(config: { wPref?: number; wDup?: number; wDiv?: number } = {}) {
    this.wPref = config.wPref ?? 1.0;
    this.wDup = config.wDup ?? 0.9;
    this.wDiv = config.wDiv ?? 0.35;

    if (this.wPref < 0 || this.wDup < 0 || this.wDiv < 0) {
      throw new Error('Pesos nao podem ser negativos');
    }
  }

  public setConstraintRules(rules: ConstraintRules): void {
    this.rules = rules;
  }

  /**
   * Returns +Infinity when hard constraints are violated.
   */
  public calculateGroupEnergy(group: Group, theme: Theme): number {
    if (!this.isGroupFeasible(group)) {
      return Infinity;
    }

    const ePref = this.calculatePreferenceEnergy(group, theme);
    const ePhase = this.calculatePhaseEnergy(group);
    const eSize = this.calculateSizeEnergy(group);

    return ePref + ePhase + eSize;
  }

  private calculatePreferenceEnergy(group: Group, theme: Theme): number {
    let totalNormalizedScore = 0;

    for (const student of group.students) {
      if (!student.preferences || student.preferences.length === 0) {
        continue;
      }

      const rank = this.getThemeRank(student, theme.id);
      const rawScore = this.rankToRawScore(rank);
      const normalizedScore = this.normalizeScore(student, rawScore);
      totalNormalizedScore += normalizedScore;
    }

    return -this.wPref * totalNormalizedScore;
  }

  private calculatePhaseEnergy(group: Group): number {
    const phaseCounts = new Map<number, number>();

    for (const student of group.students) {
      const phase = student.phase;
      phaseCounts.set(phase, (phaseCounts.get(phase) || 0) + 1);
    }

    let duplicates = 0;
    for (const count of phaseCounts.values()) {
      if (count > 1) {
        duplicates += (count - 1);
      }
    }

    const diversity = phaseCounts.size;

    return this.wDup * duplicates - this.wDiv * diversity;
  }

  /**
   * Structural size preference:
   * 4 students => 0
   * 5 students => +0.25
   * 3 students => +2.50
   */
  private calculateSizeEnergy(group: Group): number {
    const size = group.students.length;
    if (size === 4) return 0;
    if (size === 5) return 0.25;
    if (size === 3) return 2.5;
    return Infinity;
  }

  private rankToRawScore(rank: number): number {
    if (rank < 1) {
      return 0;
    }

    if (rank <= this.SCORE_TABLE.length) {
      return this.SCORE_TABLE[rank - 1];
    }

    return Math.max(0, 8 - (rank - this.SCORE_TABLE.length));
  }

  private normalizeScore(student: Student, rawScore: number): number {
    const allRawScores: number[] = [];

    if (student.preferences && student.preferences.length > 0) {
      for (let i = 1; i <= student.preferences.length; i++) {
        allRawScores.push(this.rankToRawScore(i));
      }
    } else {
      for (let i = 1; i <= 8; i++) {
        allRawScores.push(this.rankToRawScore(i));
      }
    }

    const min = Math.min(...allRawScores);
    const max = Math.max(...allRawScores);

    if (max === min) {
      return 0.5;
    }

    return (rawScore - min) / (max - min);
  }

  public isGroupFeasible(group: Group): boolean {
    const size = group.students.length;
    const minSize = this.rules.groupSize - 1;
    const maxSize = this.rules.groupSize + 1;
    if (size < minSize || size > maxSize) {
      return false;
    }

    const electricalCount = group.students.filter((s) => s.course === 'EE').length;
    const minEE = this.rules.minElectricalEngineers;
    const maxEE = size >= this.rules.groupSize
      ? this.rules.maxElectricalEngineers
      : Math.min(this.rules.maxElectricalEngineers, size - 1);

    if (electricalCount < minEE || electricalCount > maxEE) {
      return false;
    }

    const uniquePhases = new Set(group.students.map((s) => s.phase)).size;
    if (uniquePhases < this.rules.minPhaseDiversity) {
      return false;
    }

    return true;
  }

  public calculateSolutionEnergy(solution: any): number {
    let totalEnergy = 0;

    for (const group of solution.groups) {
      const theme = solution.getThemeForGroup?.(group.id);
      if (!theme) {
        return Infinity;
      }

      const energy = this.calculateGroupEnergy(group, theme);
      if (energy === Infinity) {
        return Infinity;
      }

      totalEnergy += energy;
    }

    return totalEnergy;
  }

  public findBestThemeForGroup(group: Group, themes: Theme[]): { theme: Theme; energy: number } {
    let bestTheme = themes[0];
    let bestEnergy = Infinity;

    for (const theme of themes) {
      const energy = this.calculateGroupEnergy(group, theme);
      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestTheme = theme;
      }
    }

    return { theme: bestTheme, energy: bestEnergy };
  }

  private getThemeRank(student: Student, themeId: string): number {
    if (!student.preferences) {
      return 9;
    }

    const index = student.preferences.findIndex((p) => p.themeId === themeId);
    return index >= 0 ? index + 1 : 9;
  }

  public getWeights() {
    return { wPref: this.wPref, wDup: this.wDup, wDiv: this.wDiv };
  }
}
