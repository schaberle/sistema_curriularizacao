export type GroupSizePlan = {
  plannedGroupCount: number;
  targetSizes: number[];
  groupsOf3: number;
  groupsOf4: number;
  groupsOf5: number;
};

type GroupSizeCandidate = {
  groupCount: number;
  groupsOf3: number;
  groupsOf4: number;
  groupsOf5: number;
  distanceToNDiv4: number;
};

/**
 * Planeja tamanhos de grupos no intervalo [3,5], priorizando:
 * 1) minimizar grupos de 3
 * 2) manter total de grupos proximo de N/4
 * 3) em empate, minimizar grupos de 5
 */
export function planGroupSizes(totalStudents: number): GroupSizePlan {
  if (!Number.isFinite(totalStudents) || totalStudents <= 0) {
    return {
      plannedGroupCount: 0,
      targetSizes: [],
      groupsOf3: 0,
      groupsOf4: 0,
      groupsOf5: 0,
    };
  }

  const n = Math.floor(totalStudents);
  const minGroupCount = Math.ceil(n / 5);
  const maxGroupCount = Math.floor(n / 3);

  let best: GroupSizeCandidate | null = null;

  for (let groupCount = minGroupCount; groupCount <= maxGroupCount; groupCount++) {
    if (3 * groupCount > n || 5 * groupCount < n) {
      continue;
    }

    const groupsOf3 = Math.max(0, 4 * groupCount - n);
    const groupsOf5 = Math.max(0, n - 4 * groupCount);
    const groupsOf4 = groupCount - groupsOf3 - groupsOf5;

    if (groupsOf4 < 0) {
      continue;
    }

    const candidate: GroupSizeCandidate = {
      groupCount,
      groupsOf3,
      groupsOf4,
      groupsOf5,
      distanceToNDiv4: Math.abs(groupCount - (n / 4)),
    };

    if (!best) {
      best = candidate;
      continue;
    }

    const betterBy3 = candidate.groupsOf3 < best.groupsOf3;
    const betterByDistance =
      candidate.groupsOf3 === best.groupsOf3 &&
      candidate.distanceToNDiv4 < best.distanceToNDiv4;
    const betterBy5 =
      candidate.groupsOf3 === best.groupsOf3 &&
      candidate.distanceToNDiv4 === best.distanceToNDiv4 &&
      candidate.groupsOf5 < best.groupsOf5;

    if (betterBy3 || betterByDistance || betterBy5) {
      best = candidate;
    }
  }

  // Cenarios muito pequenos (N < 3): fallback controlado em um unico grupo.
  if (!best) {
    return {
      plannedGroupCount: 1,
      targetSizes: [n],
      groupsOf3: n === 3 ? 1 : 0,
      groupsOf4: n === 4 ? 1 : 0,
      groupsOf5: n === 5 ? 1 : 0,
    };
  }

  const targetSizes: number[] = [
    ...Array.from({ length: best.groupsOf4 }, () => 4),
    ...Array.from({ length: best.groupsOf5 }, () => 5),
    ...Array.from({ length: best.groupsOf3 }, () => 3),
  ];

  return {
    plannedGroupCount: best.groupCount,
    targetSizes,
    groupsOf3: best.groupsOf3,
    groupsOf4: best.groupsOf4,
    groupsOf5: best.groupsOf5,
  };
}

export function getPlannedGroupCount(totalStudents: number): number {
  return planGroupSizes(totalStudents).plannedGroupCount;
}
