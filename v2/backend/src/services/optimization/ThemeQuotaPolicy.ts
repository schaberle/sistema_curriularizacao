import { Group, Theme } from '../../domain';

export type ThemeQuotaRange = {
  themeId: string;
  weight: number;
  target: number;
  min: number;
  max: number;
  fractional: number;
};

type ValidationOptions = {
  requireMin?: boolean;
  requireMax?: boolean;
  requireOrder?: boolean;
  requireBalance?: boolean;
};

type OrderConstraint = {
  higherThemeId: string;
  lowerThemeId: string;
};

type BalanceConstraint = {
  themeAId: string;
  themeBId: string;
};

/**
 * Policy for converting theme weights into integer quotas and validating usage.
 */
export class ThemeQuotaPolicy {
  private readonly totalGroups: number;
  private readonly quotasByTheme = new Map<string, ThemeQuotaRange>();
  private readonly orderConstraints: OrderConstraint[] = [];
  private readonly balanceConstraints: BalanceConstraint[] = [];
  private readonly themeOrder: string[];

  constructor(themes: Theme[], totalGroups: number) {
    this.totalGroups = Math.max(0, Math.floor(totalGroups));
    this.themeOrder = [...themes]
      .map((theme) => theme.id)
      .sort((a, b) => String(a).localeCompare(String(b)));

    if (themes.length === 0) {
      return;
    }

    const weights = themes.map((theme) => ({
      themeId: theme.id,
      weight: Math.max(1, Math.floor(Number(theme.groupProportion || 1))),
    }));

    const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
    const baseRows = weights.map((item) => {
      const continuous = totalWeight > 0 ? (this.totalGroups * item.weight) / totalWeight : 0;
      const base = Math.floor(continuous);
      return {
        ...item,
        continuous,
        base,
        fractional: continuous - base,
      };
    });

    let remaining = this.totalGroups - baseRows.reduce((sum, row) => sum + row.base, 0);
    const rankedRemainders = [...baseRows].sort((a, b) => {
      if (b.fractional !== a.fractional) {
        return b.fractional - a.fractional;
      }
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return String(a.themeId).localeCompare(String(b.themeId));
    });

    const extras = new Map<string, number>();
    for (const row of rankedRemainders) {
      extras.set(row.themeId, 0);
    }

    for (let i = 0; i < remaining; i++) {
      const selected = rankedRemainders[i % rankedRemainders.length];
      extras.set(selected.themeId, (extras.get(selected.themeId) || 0) + 1);
    }

    for (const row of baseRows) {
      const target = row.base + (extras.get(row.themeId) || 0);
      this.quotasByTheme.set(row.themeId, {
        themeId: row.themeId,
        weight: row.weight,
        target,
        min: Math.max(0, target - 1),
        max: target + 1,
        fractional: row.fractional,
      });
    }

    const ranges = this.getRanges();
    for (const higher of ranges) {
      for (const lower of ranges) {
        if (higher.themeId === lower.themeId) {
          continue;
        }
        if (higher.weight > lower.weight && higher.target > lower.target) {
          this.orderConstraints.push({
            higherThemeId: higher.themeId,
            lowerThemeId: lower.themeId,
          });
        }
      }
    }

    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const left = ranges[i];
        const right = ranges[j];
        if (left.weight === right.weight && left.target === right.target) {
          this.balanceConstraints.push({
            themeAId: left.themeId,
            themeBId: right.themeId,
          });
        }
      }
    }
  }

  getTotalGroups(): number {
    return this.totalGroups;
  }

  getRanges(): ThemeQuotaRange[] {
    return this.themeOrder
      .map((themeId) => this.quotasByTheme.get(themeId))
      .filter((item): item is ThemeQuotaRange => Boolean(item));
  }

  getRange(themeId: string): ThemeQuotaRange | null {
    return this.quotasByTheme.get(themeId) || null;
  }

  getOrderConstraints(): Array<{ higherThemeId: string; lowerThemeId: string }> {
    return [...this.orderConstraints];
  }

  getBalanceConstraints(): Array<{ themeAId: string; themeBId: string }> {
    return [...this.balanceConstraints];
  }

  getTarget(themeId: string): number {
    return this.quotasByTheme.get(themeId)?.target ?? 0;
  }

  getMin(themeId: string): number {
    return this.quotasByTheme.get(themeId)?.min ?? 0;
  }

  getMax(themeId: string): number {
    return this.quotasByTheme.get(themeId)?.max ?? 0;
  }

  initializeUsage(seed?: Map<string, number>): Map<string, number> {
    const usage = new Map<string, number>();
    for (const themeId of this.themeOrder) {
      usage.set(themeId, seed?.get(themeId) || 0);
    }
    return usage;
  }

  buildUsageFromGroups(groups: Group[]): Map<string, number> {
    const usage = this.initializeUsage();
    for (const group of groups) {
      usage.set(group.themeId, (usage.get(group.themeId) || 0) + 1);
    }
    return usage;
  }

  canStillMeetMinimums(usage: Map<string, number>, remainingGroups: number): boolean {
    let required = 0;
    for (const range of this.getRanges()) {
      const used = usage.get(range.themeId) || 0;
      required += Math.max(0, range.min - used);
    }
    return required <= remainingGroups;
  }

  canAssignTheme(themeId: string, usage: Map<string, number>, remainingGroupsAfterAssignment: number): boolean {
    const range = this.getRange(themeId);
    if (!range) {
      return false;
    }

    const nextUsage = new Map(usage);
    nextUsage.set(themeId, (nextUsage.get(themeId) || 0) + 1);
    if ((nextUsage.get(themeId) || 0) > range.max) {
      return false;
    }

    return this.canStillMeetMinimums(nextUsage, remainingGroupsAfterAssignment);
  }

  validateUsage(usage: Map<string, number>, options: ValidationOptions = {}): { ok: boolean; violations: string[] } {
    const requireMin = options.requireMin ?? true;
    const requireMax = options.requireMax ?? true;
    const requireOrder = options.requireOrder ?? true;
    const requireBalance = options.requireBalance ?? true;
    const violations: string[] = [];

    for (const range of this.getRanges()) {
      const used = usage.get(range.themeId) || 0;
      if (requireMax && used > range.max) {
        violations.push(`theme=${range.themeId} acima do maximo (${used} > ${range.max})`);
      }
      if (requireMin && used < range.min) {
        violations.push(`theme=${range.themeId} abaixo do minimo (${used} < ${range.min})`);
      }
    }

    if (requireOrder) {
      for (const rule of this.orderConstraints) {
        const higher = usage.get(rule.higherThemeId) || 0;
        const lower = usage.get(rule.lowerThemeId) || 0;
        if (higher < lower + 1) {
          violations.push(
            `ordem violada: ${rule.higherThemeId} deve ter pelo menos 1 grupo a mais que ${rule.lowerThemeId}`
          );
        }
      }
    }

    if (requireBalance) {
      for (const rule of this.balanceConstraints) {
        const countA = usage.get(rule.themeAId) || 0;
        const countB = usage.get(rule.themeBId) || 0;
        if (Math.abs(countA - countB) > 1) {
          violations.push(
            `equilibrio violado: ${rule.themeAId} e ${rule.themeBId} devem diferir em no maximo 1 grupo`
          );
        }
      }
    }

    return {
      ok: violations.length === 0,
      violations,
    };
  }

  getComplianceAudit(usage: Map<string, number>) {
    return this.getRanges().map((range) => {
      const used = usage.get(range.themeId) || 0;
      return {
        themeId: range.themeId,
        weight: range.weight,
        used,
        target: range.target,
        min: range.min,
        max: range.max,
        deviation: used - range.target,
        withinRange: used >= range.min && used <= range.max,
      };
    });
  }
}
