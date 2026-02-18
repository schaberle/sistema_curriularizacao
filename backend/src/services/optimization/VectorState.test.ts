import { Group, Student, Theme } from '../../domain';
import { Course } from '../../domain/types';
import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { VectorState } from './VectorState';

function createStudent(
  id: string,
  course: Course,
  phase: number,
  ranking: string[]
): Student {
  return new Student(
    id,
    `Student ${id}`,
    course,
    phase,
    ranking.map((themeId, index) => ({
      themeId,
      rank: index + 1,
    }))
  );
}

function distance(a: number[], b: number[]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

describe('VectorState', () => {
  it('initializes vectors from ranking in [0,1]', () => {
    const distributionId = 'dist-vector-1';
    const themes = [
      new Theme('T1', distributionId, 'Tema 1', 2),
      new Theme('T2', distributionId, 'Tema 2', 2),
      new Theme('T3', distributionId, 'Tema 3', 2),
    ];

    const students = [
      createStudent('s1', Course.ELECTRICAL_ENGINEERING, 1, ['T1', 'T2', 'T3']),
      createStudent('s2', Course.MECHANICAL_ENGINEERING, 2, ['T2', 'T3', 'T1']),
      createStudent('s3', Course.MECHANICAL_ENGINEERING, 3, ['T3', 'T1', 'T2']),
    ];

    const state = VectorState.fromStudents(students, themes);

    for (const student of students) {
      const vector = state.getVector(student.id);
      expect(vector).toHaveLength(3);
      expect(vector.every((value) => value >= 0 && value <= 1)).toBe(true);
    }
  });

  it('keeps vectors clamped after dynamics update', () => {
    const distributionId = 'dist-vector-2';
    const themes = [
      new Theme('T1', distributionId, 'Tema 1', 2),
      new Theme('T2', distributionId, 'Tema 2', 2),
      new Theme('T3', distributionId, 'Tema 3', 2),
    ];

    const students = [
      createStudent('s1', Course.ELECTRICAL_ENGINEERING, 1, ['T1', 'T2', 'T3']),
      createStudent('s2', Course.MECHANICAL_ENGINEERING, 2, ['T2', 'T3', 'T1']),
      createStudent('s3', Course.MECHANICAL_ENGINEERING, 3, ['T3', 'T1', 'T2']),
      createStudent('s4', Course.ELECTRICAL_ENGINEERING, 4, ['T1', 'T3', 'T2']),
    ];

    const group = new Group('g1', 'T1', distributionId, students);
    const state = VectorState.fromStudents(students, themes);

    state.applyDynamics([group], 'phase1');

    for (const student of students) {
      const vector = state.getVector(student.id);
      expect(vector.every((value) => value >= 0 && value <= 1)).toBe(true);
    }
  });

  it('applies attraction/repulsion using ideal-force fields', () => {
    const distributionId = 'dist-vector-3';
    const themes = [
      new Theme('T1', distributionId, 'Tema 1', 2),
      new Theme('T2', distributionId, 'Tema 2', 2),
      new Theme('T3', distributionId, 'Tema 3', 2),
    ];

    const eeA = createStudent('eeA', Course.ELECTRICAL_ENGINEERING, 2, ['T1', 'T2', 'T3']);
    const eeB = createStudent('eeB', Course.ELECTRICAL_ENGINEERING, 2, ['T1', 'T2', 'T3']);
    const meA = createStudent('meA', Course.MECHANICAL_ENGINEERING, 2, ['T1', 'T2', 'T3']);

    const stateRepel = VectorState.fromStudents([eeA, eeB], themes);
    stateRepel.setVector(eeA.id, [0.45, 0.5, 0.5]);
    stateRepel.setVector(eeB.id, [0.55, 0.5, 0.5]);

    const beforeRepel = distance(stateRepel.getVector(eeA.id), stateRepel.getVector(eeB.id));
    stateRepel.applyDynamics(
      [new Group('gr', 'T1', distributionId, [eeA, eeB])],
      'phase1',
      {
        eta: 0.2,
        prefWeight: 0,
        groupWeight: 0,
        phaseRepulsionWeight: 1.2,
        socialWeight: 0,
        collisionRadius: 0,
      }
    );
    const afterRepel = distance(stateRepel.getVector(eeA.id), stateRepel.getVector(eeB.id));

    const stateAttract = VectorState.fromStudents([eeA, meA], themes);
    stateAttract.setVector(eeA.id, [0.45, 0.5, 0.5]);
    stateAttract.setVector(meA.id, [0.55, 0.5, 0.5]);

    const beforeAttract = distance(stateAttract.getVector(eeA.id), stateAttract.getVector(meA.id));
    const affinityMatrix = new AffinityMatrix();
    affinityMatrix.set(eeA.id, meA.id, 1);

    stateAttract.applyDynamics(
      [new Group('ga', 'T1', distributionId, [eeA, meA])],
      'phase2',
      {
        eta: 0.2,
        prefWeight: 0,
        groupWeight: 0,
        phaseRepulsionWeight: 0,
        socialWeight: 1,
        collisionRadius: 0,
      },
      affinityMatrix
    );
    const afterAttract = distance(stateAttract.getVector(eeA.id), stateAttract.getVector(meA.id));

    expect(afterRepel).toBeGreaterThan(beforeRepel);
    expect(afterAttract).toBeLessThan(beforeAttract);
  });

  it('resolves particle collisions by separating overlapped vectors', () => {
    const distributionId = 'dist-vector-4';
    const themes = [
      new Theme('T1', distributionId, 'Tema 1', 2),
      new Theme('T2', distributionId, 'Tema 2', 2),
      new Theme('T3', distributionId, 'Tema 3', 2),
    ];

    const s1 = createStudent('c1', Course.ELECTRICAL_ENGINEERING, 2, ['T1', 'T2', 'T3']);
    const s2 = createStudent('c2', Course.MECHANICAL_ENGINEERING, 3, ['T1', 'T2', 'T3']);
    const state = VectorState.fromStudents([s1, s2], themes);

    state.setVector(s1.id, [0.5, 0.5, 0.5]);
    state.setVector(s2.id, [0.5, 0.5, 0.5]);

    state.applyDynamics(
      [new Group('gc', 'T1', distributionId, [s1, s2])],
      'phase1',
      {
        eta: 0,
        prefWeight: 0,
        groupWeight: 0,
        phaseRepulsionWeight: 0,
        socialWeight: 0,
        collisionRadius: 0.2,
        collisionStrength: 1,
        collisionPasses: 3,
      }
    );

    const a = state.getVector(s1.id);
    const b = state.getVector(s2.id);
    expect(distance(a, b)).toBeGreaterThan(0.01);
    expect(a.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(b.every((value) => value >= 0 && value <= 1)).toBe(true);
  });
});
