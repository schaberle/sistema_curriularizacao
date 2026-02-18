import { Course } from '../domain';
import { AffinityMatrix } from '../domain/AffinityMatrix';
import { Group } from '../domain/Group';
import { Student } from '../domain/Student';
import { Theme } from '../domain/Theme';
import {
  buildIsolationScoreByStudentId,
  buildVisualAffinities,
  buildVisualPartition,
  buildVisualStudents,
} from './simulationVisualState.helpers';

function createStudent(
  id: string,
  course: Course,
  phase: number,
  preferences: Array<{ themeId: string; rank: number }>
): Student {
  return new Student(id, `Student ${id}`, course, phase as any, preferences as any);
}

describe('simulationVisualState.helpers', () => {
  it('normalizes student utilities in [0,1] and preserves length K', () => {
    const student = createStudent('s1', Course.ELECTRICAL_ENGINEERING, 3, [
      { themeId: 't1', rank: 1 },
      { themeId: 't2', rank: 2 },
      { themeId: 't3', rank: 3 },
    ]);

    const nodes = buildVisualStudents([student], ['t1', 't2', 't3']);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].utilities).toHaveLength(3);
    for (const value of nodes[0].utilities) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('builds partition and assignment map correctly', () => {
    const students = [
      createStudent('s1', Course.ELECTRICAL_ENGINEERING, 3, []),
      createStudent('s2', Course.MECHANICAL_ENGINEERING, 4, []),
      createStudent('s3', Course.ELECTRICAL_ENGINEERING, 5, []),
    ];

    const group = new Group('g1', 't1', 'd1');
    group.addStudent(students[0]);
    group.addStudent(students[1]);

    const themeById = new Map([['t1', new Theme('t1', 'd1', 'Tema 1', 2)]]);
    const partition = buildVisualPartition([group], students, themeById);

    expect(partition.groups).toHaveLength(1);
    expect(partition.groups[0]).toEqual({
      groupId: 'g1',
      themeId: 't1',
      themeName: 'Tema 1',
      studentIds: ['s1', 's2'],
    });
    expect(partition.assignmentByStudentId).toEqual({
      s1: 'g1',
      s2: 'g1',
      s3: null,
    });
  });

  it('returns sparse affinity edges only for declared pairs', () => {
    const affinityMatrix = new AffinityMatrix();
    affinityMatrix.set('s1', 's2', 0.6);
    affinityMatrix.set('s2', 's3', -0.4);

    const affinities = buildVisualAffinities(affinityMatrix);
    expect(affinities).toHaveLength(2);
    expect(affinities).toEqual(
      expect.arrayContaining([
        { sourceId: 's1', targetId: 's2', value: 0.6 },
        { sourceId: 's2', targetId: 's3', value: -0.4 },
      ])
    );
  });

  it('calculates isolation score S(i,g) for each grouped student', () => {
    const partition = {
      groups: [
        {
          groupId: 'g1',
          themeId: 't1',
          themeName: 'Tema 1',
          studentIds: ['s1', 's2', 's3'],
        },
      ],
      assignmentByStudentId: {
        s1: 'g1',
        s2: 'g1',
        s3: 'g1',
      },
    };

    const affinityMatrix = new AffinityMatrix();
    affinityMatrix.set('s1', 's2', 0.5);
    affinityMatrix.set('s1', 's3', -0.2);
    affinityMatrix.set('s2', 's3', 0.1);

    const isolation = buildIsolationScoreByStudentId(partition, affinityMatrix);
    expect(isolation.s1).toBeCloseTo(0.3, 6);
    expect(isolation.s2).toBeCloseTo(0.6, 6);
    expect(isolation.s3).toBeCloseTo(-0.1, 6);
  });
});

