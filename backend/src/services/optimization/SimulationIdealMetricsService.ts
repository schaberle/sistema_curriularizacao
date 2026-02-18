import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { Group, Student, Theme } from '../../domain';
import { EnergyCalculator } from './EnergyCalculator';

const INFEASIBLE_ENERGY_FALLBACK = 1_000_000_000;

export interface SimulationGroupMemberMetrics {
  id: string;
  name: string;
  course: string;
  phase: number;
  rankPosition: number;
  isolationScore?: number;
}

export interface SimulationGroupMetrics {
  id: string;
  themeId: string;
  themeName: string;
  energyPhase1: number;
  energyPhase2?: number;
  socialCohesionScore: number;
  members: SimulationGroupMemberMetrics[];
}

export interface SimulationExecutionMeta {
  swapsAccepted?: number;
  stabilityPercent?: number;
}

export interface SimulationMetrics {
  totals: {
    totalEnergyPhase1: number;
    totalEnergyPhase2?: number;
    averageGroupEnergyPhase1: number;
    averageGroupEnergyPhase2?: number;
    groupsCount: number;
    allocatedStudents: number;
  };
  preferenceMetrics: {
    top1: number;
    top2: number;
    top3: number;
    avgRank: number;
  };
  socialMetrics: {
    avgCohesion: number;
    swapsAccepted: number;
    stabilityPercent: number;
    isolatedStudentsCount: number;
  };
  audit: {
    electricalPerGroup: Array<{
      groupId: string;
      electricalCount: number;
      mechanicalCount: number;
    }>;
    distinctPhasesPerGroup: Array<{
      groupId: string;
      distinctPhases: number;
      phases: number[];
    }>;
    themeCapacityUsage: Array<{
      themeId: string;
      themeName: string;
      used: number;
      capacity: number;
      usagePercent: number;
      exceedsCapacity: boolean;
    }>;
  };
  groups: SimulationGroupMetrics[];
}

export class SimulationIdealMetricsService {
  private energyCalculator: EnergyCalculator;
  private wSoc: number;

  constructor(config?: { wPref?: number; wDup?: number; wDiv?: number; wSoc?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
    this.wSoc = config?.wSoc ?? 1.0;
  }

  calculate(
    groups: Group[],
    themes: Theme[],
    affinityMatrix: AffinityMatrix,
    options?: {
      includePhase2Energy?: boolean;
      executionMeta?: SimulationExecutionMeta;
    }
  ): SimulationMetrics {
    const themeById = new Map<string, Theme>();
    for (const theme of themes) {
      themeById.set(theme.id, theme);
    }

    let allocatedStudents = 0;
    let totalEnergyPhase1 = 0;
    let totalEnergyPhase2 = 0;
    let finiteEnergyGroupsPhase1 = 0;
    let finiteEnergyGroupsPhase2 = 0;
    let totalCohesion = 0;
    let isolatedStudentsCount = 0;

    let top1Count = 0;
    let top2Count = 0;
    let top3Count = 0;
    let sumRank = 0;
    let rankCount = 0;

    const groupsPayload: SimulationGroupMetrics[] = [];
    const electricalPerGroup: SimulationMetrics['audit']['electricalPerGroup'] = [];
    const distinctPhasesPerGroup: SimulationMetrics['audit']['distinctPhasesPerGroup'] = [];
    const themeUsage = new Map<string, number>();

    for (const group of groups) {
      const theme = themeById.get(group.themeId);
      const memberIds = group.students.map((student) => student.id);
      const cohesion = affinityMatrix.calculateGroupCohesion(memberIds);
      const socialEnergy = -this.wSoc * cohesion;
      const rawEnergyPhase1 = theme
        ? this.energyCalculator.calculateGroupEnergy(group, theme)
        : INFEASIBLE_ENERGY_FALLBACK;
      const safeEnergyPhase1 = this.normalizeEnergy(rawEnergyPhase1);
      const includePhase2 = Boolean(options?.includePhase2Energy);
      const safeEnergyPhase2 = includePhase2
        ? this.normalizeEnergy(rawEnergyPhase1 + socialEnergy)
        : undefined;

      if (Number.isFinite(rawEnergyPhase1)) {
        totalEnergyPhase1 += rawEnergyPhase1;
        finiteEnergyGroupsPhase1 += 1;
      }
      if (includePhase2 && Number.isFinite(rawEnergyPhase1 + socialEnergy)) {
        totalEnergyPhase2 += rawEnergyPhase1 + socialEnergy;
        finiteEnergyGroupsPhase2 += 1;
      }

      totalCohesion += cohesion;
      allocatedStudents += group.students.length;

      const members: SimulationGroupMemberMetrics[] = group.students.map((student) => {
        const rankPosition = this.getRankPosition(student, group.themeId);
        const isolationScore = affinityMatrix.calculateIsolationScore(student.id, memberIds);

        if (rankPosition === 1) {
          top1Count += 1;
        }
        if (rankPosition <= 2) {
          top2Count += 1;
        }
        if (rankPosition <= 3) {
          top3Count += 1;
        }

        rankCount += 1;
        sumRank += rankPosition;

        if (isolationScore < 0) {
          isolatedStudentsCount += 1;
        }

        return {
          id: student.id,
          name: student.name,
          course: student.course,
          phase: student.phase,
          rankPosition,
          isolationScore,
        };
      });

      groupsPayload.push({
        id: group.id,
        themeId: group.themeId,
        themeName: theme?.name || 'Tema removido',
        energyPhase1: safeEnergyPhase1,
        energyPhase2: safeEnergyPhase2,
        socialCohesionScore: cohesion,
        members,
      });

      const electricalCount = group.students.filter((student) => student.course === 'EE').length;
      electricalPerGroup.push({
        groupId: group.id,
        electricalCount,
        mechanicalCount: group.students.length - electricalCount,
      });

      const phases = Array.from(new Set(group.students.map((student) => student.phase))).sort((a, b) => a - b);
      distinctPhasesPerGroup.push({
        groupId: group.id,
        distinctPhases: phases.length,
        phases,
      });

      themeUsage.set(group.themeId, (themeUsage.get(group.themeId) || 0) + 1);
    }

    const groupsCount = groups.length;
    const averageGroupEnergyPhase1 =
      finiteEnergyGroupsPhase1 > 0 ? totalEnergyPhase1 / finiteEnergyGroupsPhase1 : 0;
    const includePhase2Energy = Boolean(options?.includePhase2Energy);
    const averageGroupEnergyPhase2 =
      includePhase2Energy && finiteEnergyGroupsPhase2 > 0
        ? totalEnergyPhase2 / finiteEnergyGroupsPhase2
        : undefined;

    const themeCapacityUsage = themes.map((theme) => {
      const used = themeUsage.get(theme.id) || 0;
      const capacity = Math.max(1, Number(theme.maxGroups || 0));
      const usagePercent = (used / capacity) * 100;
      return {
        themeId: theme.id,
        themeName: theme.name,
        used,
        capacity,
        usagePercent,
        exceedsCapacity: used > capacity,
      };
    });

    const allocatedSafe = Math.max(1, allocatedStudents);

    return {
      totals: {
        totalEnergyPhase1,
        totalEnergyPhase2: includePhase2Energy ? totalEnergyPhase2 : undefined,
        averageGroupEnergyPhase1,
        averageGroupEnergyPhase2,
        groupsCount,
        allocatedStudents,
      },
      preferenceMetrics: {
        top1: (top1Count / allocatedSafe) * 100,
        top2: (top2Count / allocatedSafe) * 100,
        top3: (top3Count / allocatedSafe) * 100,
        avgRank: rankCount > 0 ? sumRank / rankCount : 0,
      },
      socialMetrics: {
        avgCohesion: groupsCount > 0 ? totalCohesion / groupsCount : 0,
        swapsAccepted: options?.executionMeta?.swapsAccepted ?? 0,
        stabilityPercent: options?.executionMeta?.stabilityPercent ?? 100,
        isolatedStudentsCount,
      },
      audit: {
        electricalPerGroup,
        distinctPhasesPerGroup,
        themeCapacityUsage,
      },
      groups: groupsPayload,
    };
  }

  private normalizeEnergy(energy: number): number {
    if (!Number.isFinite(energy)) {
      return INFEASIBLE_ENERGY_FALLBACK;
    }
    return energy;
  }

  private getRankPosition(student: Student, themeId: string): number {
    const rank = student.getThemeRank(themeId);
    if (rank > 0) {
      return rank;
    }
    return Math.max(1, student.preferences.length + 1);
  }
}
