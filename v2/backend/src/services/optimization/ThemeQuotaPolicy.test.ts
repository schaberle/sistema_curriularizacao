import { Theme } from '../../domain';
import { ThemeQuotaPolicy } from './ThemeQuotaPolicy';

describe('ThemeQuotaPolicy', () => {
  const distributionId = 'dist-policy';

  function theme(id: string, weight: number): Theme {
    return new Theme(id, distributionId, id, weight);
  }

  it('distributes equally when all weights are 1 and groups match theme count', () => {
    const themes = Array.from({ length: 8 }, (_, i) => theme(`T${i + 1}`, 1));
    const policy = new ThemeQuotaPolicy(themes, 8);

    const ranges = policy.getRanges();
    expect(ranges).toHaveLength(8);
    for (const range of ranges) {
      expect(range.target).toBe(1);
      expect(range.min).toBe(0);
      expect(range.max).toBe(2);
    }
  });

  it('uses largest remainder tie-break for 7 groups and 8 equal themes', () => {
    const themes = Array.from({ length: 8 }, (_, i) => theme(`T${i + 1}`, 1));
    const policy = new ThemeQuotaPolicy(themes, 7);

    const targets = policy.getRanges().map((range) => range.target);
    const ones = targets.filter((value) => value === 1).length;
    const zeros = targets.filter((value) => value === 0).length;

    expect(ones).toBe(7);
    expect(zeros).toBe(1);
    expect(targets.reduce((sum, value) => sum + value, 0)).toBe(7);
  });

  it('respects weighted target quotas', () => {
    const policy = new ThemeQuotaPolicy([theme('A', 3), theme('B', 1)], 8);
    expect(policy.getTarget('A')).toBe(6);
    expect(policy.getTarget('B')).toBe(2);
  });

  it('enforces ordering when higher weight has strictly higher target', () => {
    const policy = new ThemeQuotaPolicy([theme('A', 3), theme('B', 1)], 8);
    const invalidUsage = new Map<string, number>([
      ['A', 3],
      ['B', 5],
    ]);

    const validation = policy.validateUsage(invalidUsage, {
      requireMin: false,
      requireMax: false,
      requireOrder: true,
    });

    expect(validation.ok).toBe(false);
    expect(validation.violations.some((message) => message.includes('ordem violada'))).toBe(true);
  });

  it('checks assignment feasibility against max and remaining minimums', () => {
    const policy = new ThemeQuotaPolicy([theme('A', 1), theme('B', 2)], 3);
    const usage = new Map<string, number>([
      ['A', 0],
      ['B', 1],
    ]);

    // With one group left after assignment, A is still possible.
    expect(policy.canAssignTheme('A', usage, 1)).toBe(true);
    // B can also receive one more here.
    expect(policy.canAssignTheme('B', usage, 1)).toBe(true);
  });

  it('keeps equal-weight/equal-target themes balanced within one group', () => {
    const policy = new ThemeQuotaPolicy([theme('A', 1), theme('B', 1)], 2);
    const invalidUsage = new Map<string, number>([
      ['A', 2],
      ['B', 0],
    ]);

    const validation = policy.validateUsage(invalidUsage);
    expect(validation.ok).toBe(false);
    expect(validation.violations.some((message) => message.includes('equilibrio violado'))).toBe(true);
  });
});
