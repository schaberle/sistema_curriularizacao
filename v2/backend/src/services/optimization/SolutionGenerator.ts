import { Student, Group, Theme, Solution } from '../../domain';
import { EnergyCalculator } from './EnergyCalculator';
import { ConstraintRules } from './SystemViabilityAnalyzer';
import { planGroupSizes } from './groupSizePlanner';
import { ThemeQuotaPolicy } from './ThemeQuotaPolicy';

/**
 * SolutionGenerator - builds an initial feasible phase-1 solution.
 */
export class SolutionGenerator {
  private energyCalculator: EnergyCalculator;
  private rules: ConstraintRules = {
    minElectricalEngineers: 1,
    maxElectricalEngineers: 2,
    minPhaseDiversity: 2,
    groupSize: 4,
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
   * 4) Assign themes respecting proportional quota policy
   */
  generateInitialSolution(
    students: Student[],
    themes: Theme[],
    themeQuotaPolicy?: ThemeQuotaPolicy
  ): Solution {
    if (students.length === 0 || themes.length === 0) {
      return new Solution([], [], 0);
    }

    const totalStudents = students.length;
    const targetSizes = planGroupSizes(totalStudents).targetSizes;
    const groupCount = targetSizes.length;

    if (groupCount === 0) {
      const group = new Group('group_0', themes[0].id, 'dist_temp', [...students]);
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

    // ===== Step 4: build Group objects and assign themes =====
    const totalGroupsNeeded = groupStudents.filter((g) => g.length > 0).length;
    const quotaPolicy = themeQuotaPolicy || new ThemeQuotaPolicy(themes, totalGroupsNeeded);
    console.log(`[SolutionGenerator] Theme quota policy:`);
    for (const range of quotaPolicy.getRanges()) {
      console.log(
        `  theme=${range.themeId}, weight=${range.weight}, target=${range.target}, range=[${range.min},${range.max}]`
      );
    }

    const groups: Group[] = [];
    const themeUsage = quotaPolicy.initializeUsage();

    for (let i = 0; i < groupStudents.length; i++) {
      const studentsInGroup = groupStudents[i];
      if (studentsInGroup.length === 0) continue;

      const tempGroup = new Group(
        `group_${i}`,
        themes[0].id,
        'dist_temp',
        studentsInGroup
      );

      const groupsRemainingAfterAssignment = totalGroupsNeeded - (groups.length + 1);
      const { theme: bestTheme } = this.findBestThemeWithQuota(
        tempGroup,
        themes,
        quotaPolicy,
        themeUsage,
        groupsRemainingAfterAssignment
      );

      tempGroup.themeId = bestTheme.id;
      themeUsage.set(bestTheme.id, (themeUsage.get(bestTheme.id) || 0) + 1);
      groups.push(tempGroup);
    }

    const usageAfterGreedy = quotaPolicy.buildUsageFromGroups(groups);
    const usageValidation = quotaPolicy.validateUsage(usageAfterGreedy, {
      requireMin: true,
      requireMax: true,
      requireOrder: true,
      requireBalance: true,
    });
    if (!usageValidation.ok) {
      this.rebalanceThemesToPolicy(groups, themes, quotaPolicy);
    }

    let totalEnergy = 0;
    let hasInfeasible = false;
    for (const group of groups) {
      const theme = themes.find((t) => t.id === group.themeId);
      if (!theme) {
        hasInfeasible = true;
        continue;
      }
      const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
      if (Number.isFinite(energy)) {
        totalEnergy += energy;
      } else {
        hasInfeasible = true;
      }
    }

    if (hasInfeasible) {
      console.warn(`[SolutionGenerator] infeasible group(s) detected (energy = infinity)`);
    }

    return new Solution(groups, [], 0, 0, 0, totalEnergy);
  }

  private findBestThemeWithQuota(
    group: Group,
    themes: Theme[],
    quotaPolicy: ThemeQuotaPolicy,
    usage: Map<string, number>,
    groupsRemainingAfterAssignment: number
  ): { theme: Theme; energy: number } {
    let bestTheme: Theme | null = null;
    let bestEnergy = Infinity;
    let fallbackTheme: Theme | null = null;
    let fallbackEnergy = Infinity;

    for (const theme of themes) {
      const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
      if (!Number.isFinite(energy)) {
        continue;
      }

      if (energy < fallbackEnergy) {
        fallbackEnergy = energy;
        fallbackTheme = theme;
      }

      if (!quotaPolicy.canAssignTheme(theme.id, usage, groupsRemainingAfterAssignment)) {
        continue;
      }

      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestTheme = theme;
      }
    }

    if (bestTheme) {
      return { theme: bestTheme, energy: bestEnergy };
    }

    return { theme: fallbackTheme || themes[0], energy: fallbackEnergy };
  }

  private rebalanceThemesToPolicy(groups: Group[], themes: Theme[], quotaPolicy: ThemeQuotaPolicy): void {
    const maxIterations = Math.max(1, groups.length * themes.length * 5);

    const tryMove = (fromThemeId: string, toThemeId: string): boolean => {
      let bestGroup: Group | null = null;
      let bestDelta = Infinity;
      const toTheme = themes.find((theme) => theme.id === toThemeId);
      if (!toTheme) {
        return false;
      }

      for (const group of groups) {
        if (group.themeId !== fromThemeId) {
          continue;
        }
        const fromTheme = themes.find((theme) => theme.id === fromThemeId);
        if (!fromTheme) {
          continue;
        }

        const currentEnergy = this.energyCalculator.calculateGroupEnergy(group, fromTheme);
        const nextEnergy = this.energyCalculator.calculateGroupEnergy(group, toTheme);
        if (!Number.isFinite(currentEnergy) || !Number.isFinite(nextEnergy)) {
          continue;
        }

        const delta = nextEnergy - currentEnergy;
        if (delta < bestDelta) {
          bestDelta = delta;
          bestGroup = group;
        }
      }

      if (!bestGroup) {
        return false;
      }

      bestGroup.themeId = toThemeId;
      return true;
    };

    let iteration = 0;
    while (iteration < maxIterations) {
      iteration += 1;
      const usage = quotaPolicy.buildUsageFromGroups(groups);
      const validation = quotaPolicy.validateUsage(usage, {
        requireMin: true,
        requireMax: true,
        requireOrder: true,
        requireBalance: true,
      });
      if (validation.ok) {
        return;
      }

      let changed = false;

      // 1) Fix minima
      for (const range of quotaPolicy.getRanges()) {
        while ((usage.get(range.themeId) || 0) < range.min) {
          let moved = false;
          for (const donor of quotaPolicy.getRanges()) {
            const donorUsage = usage.get(donor.themeId) || 0;
            if (donorUsage <= donor.min) {
              continue;
            }
            if ((usage.get(range.themeId) || 0) >= range.max) {
              continue;
            }
            if (tryMove(donor.themeId, range.themeId)) {
              usage.set(donor.themeId, donorUsage - 1);
              usage.set(range.themeId, (usage.get(range.themeId) || 0) + 1);
              moved = true;
              changed = true;
              break;
            }
          }
          if (!moved) {
            break;
          }
        }
      }

      // 2) Fix maxima
      for (const range of quotaPolicy.getRanges()) {
        while ((usage.get(range.themeId) || 0) > range.max) {
          let moved = false;
          for (const receiver of quotaPolicy.getRanges()) {
            const receiverUsage = usage.get(receiver.themeId) || 0;
            if (receiverUsage >= receiver.max) {
              continue;
            }
            if (tryMove(range.themeId, receiver.themeId)) {
              usage.set(range.themeId, (usage.get(range.themeId) || 0) - 1);
              usage.set(receiver.themeId, receiverUsage + 1);
              moved = true;
              changed = true;
              break;
            }
          }
          if (!moved) {
            break;
          }
        }
      }

      // 3) Fix order constraints
      for (const rule of quotaPolicy.getOrderConstraints()) {
        while ((usage.get(rule.higherThemeId) || 0) < (usage.get(rule.lowerThemeId) || 0) + 1) {
          const higherRange = quotaPolicy.getRange(rule.higherThemeId);
          const lowerRange = quotaPolicy.getRange(rule.lowerThemeId);
          if (!higherRange || !lowerRange) {
            break;
          }
          if ((usage.get(rule.higherThemeId) || 0) >= higherRange.max) {
            break;
          }
          if ((usage.get(rule.lowerThemeId) || 0) <= lowerRange.min) {
            break;
          }
          if (!tryMove(rule.lowerThemeId, rule.higherThemeId)) {
            break;
          }
          usage.set(rule.lowerThemeId, (usage.get(rule.lowerThemeId) || 0) - 1);
          usage.set(rule.higherThemeId, (usage.get(rule.higherThemeId) || 0) + 1);
          changed = true;
        }
      }

      // 4) Keep equally weighted/targeted themes balanced
      for (const rule of quotaPolicy.getBalanceConstraints()) {
        while (Math.abs((usage.get(rule.themeAId) || 0) - (usage.get(rule.themeBId) || 0)) > 1) {
          const countA = usage.get(rule.themeAId) || 0;
          const countB = usage.get(rule.themeBId) || 0;
          const donorThemeId = countA > countB ? rule.themeAId : rule.themeBId;
          const receiverThemeId = donorThemeId === rule.themeAId ? rule.themeBId : rule.themeAId;
          const donorRange = quotaPolicy.getRange(donorThemeId);
          const receiverRange = quotaPolicy.getRange(receiverThemeId);
          if (!donorRange || !receiverRange) {
            break;
          }
          if ((usage.get(donorThemeId) || 0) <= donorRange.min) {
            break;
          }
          if ((usage.get(receiverThemeId) || 0) >= receiverRange.max) {
            break;
          }
          if (!tryMove(donorThemeId, receiverThemeId)) {
            break;
          }
          usage.set(donorThemeId, (usage.get(donorThemeId) || 0) - 1);
          usage.set(receiverThemeId, (usage.get(receiverThemeId) || 0) + 1);
          changed = true;
        }
      }

      if (!changed) {
        return;
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
