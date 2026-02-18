import { Group, Student, Theme } from '../domain';
import { AffinityMatrix } from '../domain/AffinityMatrix';

const RANK_SCORE_TABLE = [100, 70, 50, 35, 25, 18, 12, 8];

export type VisualStudentNode = {
  id: string;
  name: string;
  course: 'ELECTRICAL' | 'MECHANICAL';
  phase: number;
  utilities: number[];
};

export type VisualGroupPartition = {
  groups: Array<{
    groupId: string;
    themeId: string;
    themeName: string;
    studentIds: string[];
  }>;
  assignmentByStudentId: Record<string, string | null>;
};

export type VisualAffinityEdge = {
  sourceId: string;
  targetId: string;
  value: number;
};

export function rankToRawUtility(rank: number): number {
  if (!Number.isFinite(rank) || rank <= 0) {
    return 0;
  }
  if (rank <= RANK_SCORE_TABLE.length) {
    return RANK_SCORE_TABLE[rank - 1];
  }
  return Math.max(0, 8 - (rank - RANK_SCORE_TABLE.length));
}

export function normalizeUtilities(raw: number[]): number[] {
  if (!raw.length) {
    return [];
  }

  const min = Math.min(...raw);
  const max = Math.max(...raw);
  if (max === min) {
    return raw.map((value) => (value > 0 ? 1 : 0));
  }

  return raw.map((value) => {
    const normalized = (value - min) / (max - min);
    if (normalized < 0) {
      return 0;
    }
    if (normalized > 1) {
      return 1;
    }
    return normalized;
  });
}

export function buildVisualStudents(students: Student[], themeIds: string[]): VisualStudentNode[] {
  return students.map((student) => {
    const rawUtilities = themeIds.map((themeId) => rankToRawUtility(student.getThemeRank(themeId)));
    return {
      id: student.id,
      name: student.name,
      course: student.course === 'ME' ? 'MECHANICAL' : 'ELECTRICAL',
      phase: student.phase,
      utilities: normalizeUtilities(rawUtilities),
    };
  });
}

export function buildVisualPartition(
  groups: Group[],
  students: Student[],
  themeById: Map<string, Theme>
): VisualGroupPartition {
  const assignmentByStudentId: Record<string, string | null> = {};
  for (const student of students) {
    assignmentByStudentId[student.id] = null;
  }

  const visualGroups = groups.map((group) => {
    for (const student of group.students) {
      assignmentByStudentId[student.id] = group.id;
    }

    return {
      groupId: group.id,
      themeId: group.themeId,
      themeName: themeById.get(group.themeId)?.name || 'Tema removido',
      studentIds: group.students.map((student) => student.id),
    };
  });

  return {
    groups: visualGroups,
    assignmentByStudentId,
  };
}

export function buildVisualAffinities(affinityMatrix: AffinityMatrix): VisualAffinityEdge[] {
  return affinityMatrix.getAffinities().map((item) => ({
    sourceId: item.studentId1,
    targetId: item.studentId2,
    value: item.value,
  }));
}

export function buildIsolationScoreByStudentId(
  partition: VisualGroupPartition,
  affinityMatrix: AffinityMatrix
): Record<string, number> {
  const scoreByStudentId: Record<string, number> = {};

  for (const group of partition.groups) {
    for (const studentId of group.studentIds) {
      scoreByStudentId[studentId] = affinityMatrix.calculateIsolationScore(studentId, group.studentIds);
    }
  }

  return scoreByStudentId;
}
