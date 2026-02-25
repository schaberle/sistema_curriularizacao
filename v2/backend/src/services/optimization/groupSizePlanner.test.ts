import { getPlannedGroupCount, planGroupSizes } from './groupSizePlanner';

describe('groupSizePlanner', () => {
  it('N=15 -> 3 grupos de 5', () => {
    const plan = planGroupSizes(15);

    expect(plan.plannedGroupCount).toBe(3);
    expect(plan.groupsOf3).toBe(0);
    expect(plan.groupsOf4).toBe(0);
    expect(plan.groupsOf5).toBe(3);
    expect(plan.targetSizes).toEqual([5, 5, 5]);
  });

  it('N=167 -> 41 grupos (38x4 + 3x5) e zero grupos de 3', () => {
    const plan = planGroupSizes(167);

    expect(plan.plannedGroupCount).toBe(41);
    expect(plan.groupsOf3).toBe(0);
    expect(plan.groupsOf4).toBe(38);
    expect(plan.groupsOf5).toBe(3);
    expect(plan.targetSizes.filter((size) => size === 3)).toHaveLength(0);
    expect(plan.targetSizes.filter((size) => size === 4)).toHaveLength(38);
    expect(plan.targetSizes.filter((size) => size === 5)).toHaveLength(3);
  });

  it('N=11 -> 3 grupos (2x4 + 1x3)', () => {
    const plan = planGroupSizes(11);

    expect(plan.plannedGroupCount).toBe(3);
    expect(plan.groupsOf3).toBe(1);
    expect(plan.groupsOf4).toBe(2);
    expect(plan.groupsOf5).toBe(0);
    expect(plan.targetSizes.sort((a, b) => a - b)).toEqual([3, 4, 4]);
  });

  it('getPlannedGroupCount usa o mesmo planejamento', () => {
    expect(getPlannedGroupCount(167)).toBe(41);
    expect(getPlannedGroupCount(15)).toBe(3);
    expect(getPlannedGroupCount(11)).toBe(3);
  });
});
