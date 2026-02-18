import { Group, Student, Theme } from '../../domain';
import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { SimulationIdealMetricsService } from './SimulationIdealMetricsService';

function createStudent(
  id: string,
  course: 'EE' | 'ME',
  phase: number,
  ranking: string[]
): Student {
  return new Student(
    id,
    `Student ${id}`,
    course as any,
    phase,
    ranking.map((themeId, index) => ({
      themeId,
      rank: index + 1,
    }))
  );
}

describe('SimulationIdealMetricsService', () => {
  it('calculates top1/top2/top3 and avgRank correctly', () => {
    const distributionId = 'dist-1';
    const themes = [
      new Theme('T1', distributionId, 'Tema 1', 2),
      new Theme('T2', distributionId, 'Tema 2', 2),
    ];

    const ranking = ['T1', 'T2'];
    const students = [
      createStudent('s1', 'EE', 1, ranking),
      createStudent('s2', 'ME', 2, ranking),
      createStudent('s3', 'ME', 3, ranking),
      createStudent('s4', 'ME', 4, ranking),
    ];

    const group = new Group('g1', 'T1', distributionId, students);
    const service = new SimulationIdealMetricsService();
    const metrics = service.calculate([group], themes, new AffinityMatrix(), {
      includePhase2Energy: false,
    });

    expect(metrics.totals.groupsCount).toBe(1);
    expect(metrics.totals.allocatedStudents).toBe(4);
    expect(metrics.preferenceMetrics.top1).toBe(100);
    expect(metrics.preferenceMetrics.top2).toBe(100);
    expect(metrics.preferenceMetrics.top3).toBe(100);
    expect(metrics.preferenceMetrics.avgRank).toBe(1);
  });

  it('calculates social metrics, isolation and audit data', () => {
    const distributionId = 'dist-2';
    const themes = [
      new Theme('T1', distributionId, 'Tema 1', 1),
      new Theme('T2', distributionId, 'Tema 2', 2),
    ];

    const studentsGroup1 = [
      createStudent('s1', 'EE', 1, ['T1', 'T2']),
      createStudent('s2', 'ME', 2, ['T1', 'T2']),
      createStudent('s3', 'ME', 3, ['T1', 'T2']),
      createStudent('s4', 'ME', 4, ['T1', 'T2']),
    ];

    const studentsGroup2 = [
      createStudent('s5', 'EE', 1, ['T2', 'T1']),
      createStudent('s6', 'ME', 2, ['T2', 'T1']),
      createStudent('s7', 'ME', 3, ['T2', 'T1']),
      createStudent('s8', 'ME', 4, ['T2', 'T1']),
    ];

    const group1 = new Group('g1', 'T1', distributionId, studentsGroup1);
    const group2 = new Group('g2', 'T2', distributionId, studentsGroup2);

    const affinityMatrix = new AffinityMatrix();
    affinityMatrix.set('s1', 's2', 1);
    affinityMatrix.set('s1', 's3', -1);
    affinityMatrix.set('s2', 's3', -0.5);
    affinityMatrix.set('s5', 's6', 0.8);

    const service = new SimulationIdealMetricsService({ wSoc: 1.2 });
    const metrics = service.calculate([group1, group2], themes, affinityMatrix, {
      includePhase2Energy: true,
      executionMeta: {
        swapsAccepted: 3,
        stabilityPercent: 87.5,
      },
    });

    expect(metrics.socialMetrics.swapsAccepted).toBe(3);
    expect(metrics.socialMetrics.stabilityPercent).toBe(87.5);
    expect(metrics.socialMetrics.isolatedStudentsCount).toBeGreaterThan(0);
    expect(metrics.audit.electricalPerGroup).toHaveLength(2);
    expect(metrics.audit.distinctPhasesPerGroup[0].distinctPhases).toBeGreaterThanOrEqual(2);

    const usageT1 = metrics.audit.themeCapacityUsage.find((item) => item.themeId === 'T1');
    expect(usageT1?.used).toBe(1);
    expect(usageT1?.capacity).toBe(1);
    expect(usageT1?.exceedsCapacity).toBe(false);
  });
});
