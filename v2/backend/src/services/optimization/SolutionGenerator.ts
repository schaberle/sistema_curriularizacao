import { Student, Group, Theme, Solution } from '../../domain';
import { EnergyCalculator } from './EnergyCalculator';
import { ConstraintRules } from './SystemViabilityAnalyzer';
import { planGroupSizes } from './groupSizePlanner';

/**
 * SolutionGenerator - builds an initial feasible phase-1 solution.
 */
export class SolutionGenerator {
  private energyCalculator: EnergyCalculator;
  private rules: ConstraintRules = {
    minElectricalEngineers: 1,
    maxElectricalEngineers: 2,
    minPhaseDiversity: 2,
    groupSize: 4
  };

  constructor(config?: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
  }

  /**
   * Defines dynamic rules (from AdaptiveConstraintManager).
   */
  public setConstraintRules(rules: ConstraintRules): void {
    this.rules = rules;
    this.energyCalculator.setConstraintRules(rules);
  }

  /**
   * Greedy construction:
   * 1) Plan target sizes (3/4/5)
   * 2) Place EE first (1 per group when possible, then up to max)
   * 3) Fill remaining slots with ME maximizing phase diversity
   * 4) Assign best theme per group
   */
  generateInitialSolution(
    students: Student[],
    themes: Theme[]
  ): Solution {
    if (students.length === 0 || themes.length === 0) {
      return new Solution([], [], 0);
    }

    const totalStudents = students.length;
    const targetSizes = planGroupSizes(totalStudents).targetSizes;
    const groupCount = targetSizes.length;

    if (groupCount === 0) {
      const group = new Group(
        'group_0',
        themes[0].id,
        'dist_temp',
        [...students]
      );
      const { theme: bestTheme, energy } = this.energyCalculator.findBestThemeForGroup(group, themes);
      group.themeId = bestTheme.id;
      const totalEnergy = Number.isFinite(energy) ? energy : 0;
      return new Solution([group], [], 0, 0, 0, totalEnergy);
    }

    // Separate and shuffle by course to spread input bias.
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const eeStudents = shuffled.filter((s) => s.course === 'EE');
    const meStudents = shuffled.filter((s) => s.course === 'ME');

    const groupStudents: Student[][] = Array.from({ length: groupCount }, () => []);
    const hasCapacity = (groupIndex: number) => groupStudents[groupIndex].length < targetSizes[groupIndex];

    // ===== Step 1: distribute EE =====
    let eeIndex = 0;

    // 1a) guarantee one EE per group when possible
    for (let i = 0; i < groupCount && eeIndex < eeStudents.length; i++) {
      if (!hasCapacity(i)) continue;
      groupStudents[i].push(eeStudents[eeIndex++]);
    }

    // 1b) distribute extra EE while respecting max per group
    let distributedByRule = true;
    while (eeIndex < eeStudents.length && distributedByRule) {
      distributedByRule = false;

      for (let i = 0; i < groupCount && eeIndex < eeStudents.length; i++) {
        if (!hasCapacity(i)) continue;

        const eeInGroup = groupStudents[i].filter((s) => s.course === 'EE').length;
        if (eeInGroup < this.rules.maxElectricalEngineers) {
          groupStudents[i].push(eeStudents[eeIndex++]);
          distributedByRule = true;
        }
      }
    }

    // 1c) fallback: if still EE left, fill groups with most remaining capacity
    while (eeIndex < eeStudents.length) {
      const candidates = groupStudents
        .map((_, idx) => idx)
        .filter((idx) => hasCapacity(idx));

      if (!candidates.length) {
        break;
      }

      const selectedGroup = candidates.reduce((best, idx) => {
        const remaining = targetSizes[idx] - groupStudents[idx].length;
        const bestRemaining = targetSizes[best] - groupStudents[best].length;
        if (remaining !== bestRemaining) {
          return remaining > bestRemaining ? idx : best;
        }
        return groupStudents[idx].length < groupStudents[best].length ? idx : best;
      }, candidates[0]);

      groupStudents[selectedGroup].push(eeStudents[eeIndex++]);
    }

    // ===== Step 2: fill with ME maximizing phase diversity =====
    let meIndex = 0;
    const mePool = [...meStudents];
    const maxTargetSize = targetSizes.reduce((max, size) => Math.max(max, size), 0);

    for (let round = 0; round < maxTargetSize; round++) {
      for (let i = 0; i < groupCount; i++) {
        if (!hasCapacity(i)) continue;
        if (meIndex >= mePool.length) break;

        const phasesInGroup = new Set(groupStudents[i].map((s) => s.phase));
        let bestIdx = -1;
        let bestScore = -1;

        for (let j = meIndex; j < mePool.length; j++) {
          const candidate = mePool[j];
          const addsNewPhase = !phasesInGroup.has(candidate.phase) ? 2 : 1;
          if (addsNewPhase > bestScore) {
            bestScore = addsNewPhase;
            bestIdx = j;
          }

          if (bestScore === 2) {
            break;
          }
        }

        if (bestIdx >= 0) {
          const selected = mePool[bestIdx];
          mePool[bestIdx] = mePool[meIndex];
          mePool[meIndex] = selected;
          groupStudents[i].push(selected);
          meIndex++;
        }
      }
    }

    // ===== Step 3: controlled fallback for remaining ME =====
    const remainingStudents = mePool.slice(meIndex);
    for (const student of remainingStudents) {
      const candidates = groupStudents
        .map((_, idx) => idx)
        .filter((idx) => hasCapacity(idx));

      if (!candidates.length) {
        break;
      }

      const selectedGroup = candidates.reduce((min, idx) =>
        groupStudents[idx].length < groupStudents[min].length ? idx : min, candidates[0]
      );

      groupStudents[selectedGroup].push(student);
    }

    // ===== Step 4: build Group objects and assign theme =====
    const totalGroupsNeeded = groupStudents.filter((g) => g.length > 0).length;
    const themeLimits = this.computeProportionalLimits(themes, totalGroupsNeeded);
    console.log(`[SolutionGenerator] Proportional theme limits:`);
    for (const theme of themes) {
      console.log(`  ${theme.name}: ideal=${theme.maxGroups}, proportional=${themeLimits.get(theme.id)}`);
    }

    const groups: Group[] = [];
    let totalEnergy = 0;
    const themeUsage = new Map<string, number>();

    for (let i = 0; i < groupStudents.length; i++) {
      const studentsInGroup = groupStudents[i];
      if (studentsInGroup.length === 0) continue;

      const tempGroup = new Group(
        `group_${i}`,
        themes[0].id,
        'dist_temp',
        studentsInGroup
      );

      const { theme: bestTheme, energy } = this.findBestThemeWithCapacity(
        tempGroup, themes, themeLimits, themeUsage
      );
      tempGroup.themeId = bestTheme.id;
      themeUsage.set(bestTheme.id, (themeUsage.get(bestTheme.id) || 0) + 1);

      if (Number.isFinite(energy)) {
        totalEnergy += energy;
      }

      groups.push(tempGroup);
    }

    this.balanceThemes(groups, themes, themeLimits);

    totalEnergy = 0;
    let hasInfeasible = false;
    for (const group of groups) {
      const theme = themes.find((t) => t.id === group.themeId);
      if (theme) {
        const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
        if (Number.isFinite(energy)) {
          totalEnergy += energy;
        } else {
          hasInfeasible = true;
        }
      }
    }

    if (hasInfeasible) {
      console.warn(`[SolutionGenerator] ${groups.filter((g) => {
        const t = themes.find((th) => th.id === g.themeId);
        return t && !Number.isFinite(this.energyCalculator.calculateGroupEnergy(g, t));
      }).length} infeasible group(s) detected (energy = infinity)`);
    }

    return new Solution(groups, [], 0, 0, 0, totalEnergy);
  }

  /**
   * Calculates proportional limits by theme.
   */
  private computeProportionalLimits(themes: Theme[], totalGroupsNeeded: number): Map<string, number> {
    const sumOfIdeals = themes.reduce((sum, t) => sum + t.maxGroups, 0);
    const scaleFactor = totalGroupsNeeded / sumOfIdeals;
    const limits = new Map<string, number>();

    for (const theme of themes) {
      limits.set(theme.id, Math.ceil(theme.maxGroups * scaleFactor));
    }

    return limits;
  }

  /**
   * Finds the best theme for a group respecting proportional capacity.
   */
  private findBestThemeWithCapacity(
    group: Group,
    themes: Theme[],
    limits: Map<string, number>,
    usage: Map<string, number>
  ): { theme: Theme; energy: number } {
    let bestTheme: Theme | null = null;
    let bestEnergy = Infinity;
    let fallbackTheme: Theme | null = null;
    let fallbackEnergy = Infinity;

    for (const theme of themes) {
      const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
      const currentUsage = usage.get(theme.id) || 0;
      const limit = limits.get(theme.id) || 1;

      if (currentUsage < limit && energy < bestEnergy) {
        bestEnergy = energy;
        bestTheme = theme;
      }

      if (energy < fallbackEnergy) {
        fallbackEnergy = energy;
        fallbackTheme = theme;
      }
    }

    if (bestTheme) {
      return { theme: bestTheme, energy: bestEnergy };
    }

    return { theme: fallbackTheme || themes[0], energy: fallbackEnergy };
  }

  /**
   * Rebalances themes to respect proportional limits.
   */
  private balanceThemes(groups: Group[], themes: Theme[], limits: Map<string, number>): void {
    const themeCounts = new Map<string, number>();
    for (const group of groups) {
      themeCounts.set(group.themeId, (themeCounts.get(group.themeId) || 0) + 1);
    }

    for (const group of groups) {
      const currentTheme = themes.find((t) => t.id === group.themeId);
      if (!currentTheme) continue;

      const count = themeCounts.get(group.themeId) || 0;
      const limit = limits.get(group.themeId) || 1;

      if (count > limit) {
        let bestTheme: Theme | null = null;
        let bestEnergy = Infinity;

        for (const theme of themes) {
          const themeCount = themeCounts.get(theme.id) || 0;
          const themeLimit = limits.get(theme.id) || 1;
          if (themeCount >= themeLimit) continue;

          const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
          if (energy < bestEnergy) {
            bestEnergy = energy;
            bestTheme = theme;
          }
        }

        if (bestTheme) {
          themeCounts.set(group.themeId, (themeCounts.get(group.themeId) || 0) - 1);
          group.themeId = bestTheme.id;
          themeCounts.set(bestTheme.id, (themeCounts.get(bestTheme.id) || 0) + 1);
        }
      }
    }
  }

  /**
   * Exposes current weights.
   */
  getWeights() {
    return this.energyCalculator.getWeights();
  }

  /**
   * Sets custom weights.
   */
  setWeights(config: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
  }
}
