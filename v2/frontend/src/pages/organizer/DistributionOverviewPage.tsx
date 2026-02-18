import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { DistributionOverviewView } from '../../components/organizer/views/DistributionOverviewView';
import { useDistribution } from '../../hooks/useDistribution';
import { getSimulationVisualState } from '../../services/api';
import { SimulationVisualState, VisualGroupPartition } from '../../types/distribution.types';
import {
  ORGANIZER_STEPS,
  getContinueRoute,
  getProgressStage,
  getResultsRoute,
  isStepWarning,
} from '../../utils/distributionFlow';

function formatDate(value?: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'Fase 1 concluida';
    case 'PHASE2':
      return 'Coletando afinidades';
    case 'PHASE2_EXECUTING':
      return 'Executando Fase 2';
    case 'PHASE2_COMPLETED':
      return 'Fluxo final concluido';
    case 'PARTIAL':
      return 'Parcial';
    case 'FAILED':
      return 'Falhou';
    case 'EXECUTING':
      return 'Executando';
    case 'THEMED':
      return 'Temas configurados';
    case 'COLLECTING':
      return 'Coletando dados';
    case 'PENDING':
      return 'Rascunho';
    default:
      return status;
  }
}

type GroupThemeLookup = Record<
  string,
  {
    themeId?: string;
    themeName?: string;
    themeIndex?: number;
    isRealtimeFallback?: boolean;
  }
>;

function buildPartitionFromAssignment(
  assignmentByStudentId: Record<string, string | null>,
  basePartition: VisualGroupPartition
): VisualGroupPartition {
  const baseGroupById = new Map(basePartition.groups.map((group) => [group.groupId, group]));
  const grouped = new Map<string, string[]>();

  for (const [studentId, groupId] of Object.entries(assignmentByStudentId)) {
    if (!groupId) {
      continue;
    }
    const members = grouped.get(groupId) ?? [];
    members.push(studentId);
    grouped.set(groupId, members);
  }

  const groups = Array.from(grouped.entries())
    .map(([groupId, studentIds]) => {
      const base = baseGroupById.get(groupId);
      return {
        groupId,
        themeId: base?.themeId ?? '',
        themeName: base?.themeName ?? 'n/d (tempo real)',
        studentIds,
      };
    })
    .sort((a, b) => a.groupId.localeCompare(b.groupId));

  return {
    groups,
    assignmentByStudentId,
  };
}

export function DistributionOverviewPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const {
    currentDistribution,
    themes,
    statistics,
    groups,
    socialMetrics,
    phase2Report,
    loading,
    errors,
    actions,
  } = useDistribution();
  const { fetchStatistics, fetchGroups, fetchSocialMetrics } = actions;
  const [visualizationLoading, setVisualizationLoading] = useState(false);
  const [visualizationError, setVisualizationError] = useState<string | null>(null);
  const [visualState, setVisualState] = useState<SimulationVisualState | null>(null);
  const [liveAssignmentByStudentId] = useState<Record<string, string | null> | null>(null);
  const [showAffinityEdges, setShowAffinityEdges] = useState(false);
  const [showGroupHulls, setShowGroupHulls] = useState(true);
  const [forceIntensity, setForceIntensity] = useState(1);

  const distributionStatus = currentDistribution?.status;
  const affinityCount = statistics?.studentsWithAffinities ?? 0;
  const shouldLoadGroups = distributionStatus
    ? ['COMPLETED', 'PARTIAL', 'PHASE2', 'PHASE2_EXECUTING', 'PHASE2_COMPLETED'].includes(distributionStatus)
    : false;
  const shouldLoadSocialMetrics = distributionStatus
    ? ['PHASE2_EXECUTING', 'PHASE2_COMPLETED'].includes(distributionStatus) || affinityCount > 0
    : affinityCount > 0;

  const refreshVisualization = useCallback(
    async (notifyError: boolean) => {
      if (!distributionId) {
        return;
      }

      setVisualizationLoading(true);
      try {
        const state = await getSimulationVisualState(distributionId);
        setVisualState(state);
        setVisualizationError(null);
      } catch (error: any) {
        const message = error?.message || 'Falha ao carregar rede 3D.';
        setVisualizationError(message);
        if (!notifyError) {
          return;
        }
      } finally {
        setVisualizationLoading(false);
      }
    },
    [distributionId]
  );

  useEffect(() => {
    if (!distributionId) return;

    fetchStatistics(distributionId).catch(() => {
      // Error state is surfaced by ErrorAlert in this page.
    });
  }, [distributionId, fetchStatistics]);

  useEffect(() => {
    if (!distributionId || !currentDistribution) return;
    if (groups !== null) return;

    if (!shouldLoadGroups) return;

    fetchGroups(distributionId).catch(() => {
      // Error state is surfaced by ErrorAlert in this page.
    });
  }, [distributionId, currentDistribution, groups, shouldLoadGroups, fetchGroups]);

  useEffect(() => {
    if (!distributionId || !currentDistribution || socialMetrics) return;

    if (!shouldLoadSocialMetrics) return;

    fetchSocialMetrics(distributionId).catch(() => {
      // Error state is surfaced by ErrorAlert in this page.
    });
  }, [distributionId, currentDistribution, socialMetrics, shouldLoadSocialMetrics, fetchSocialMetrics]);

  useEffect(() => {
    refreshVisualization(false);
  }, [refreshVisualization]);

  if (!distributionId || !currentDistribution) {
    return (
      <ErrorAlert
        title="Distribuicao invalida"
        message="Nao foi possivel carregar a distribuicao solicitada."
        onRetry={() => navigate('/organizer')}
      />
    );
  }

  const stage = getProgressStage(currentDistribution.status, {
    phase2ReportExists: Boolean(phase2Report),
    affinityCount,
    phase1NeedsRerun: currentDistribution.phase1NeedsRerun,
    phase2NeedsRerun: currentDistribution.phase2NeedsRerun,
  });
  const statusLabelText =
    ['COMPLETED', 'PARTIAL'].includes(currentDistribution.status) && stage >= 6 && stage < 9
      ? 'Coletando afinidades'
      : statusLabel(currentDistribution.status);
  const continueRoute = getContinueRoute(distributionId, currentDistribution.status, {
    phase2ReportExists: Boolean(phase2Report),
    affinityCount,
    phase1NeedsRerun: currentDistribution.phase1NeedsRerun,
    phase2NeedsRerun: currentDistribution.phase2NeedsRerun,
  });
  const resultsRoute =
    stage >= 9
      ? `/organizer/${distributionId}/step9-final-results`
      : getResultsRoute(distributionId, currentDistribution.status);
  const canViewResults = stage >= 5;
  const currentStep = ORGANIZER_STEPS.find((step) => step.id === stage) ?? ORGANIZER_STEPS[0];

  const steps = ORGANIZER_STEPS.map((step) => ({
    isWarning: isStepWarning(step.id, {
      phase1NeedsRerun: currentDistribution.phase1NeedsRerun,
      phase2NeedsRerun: currentDistribution.phase2NeedsRerun,
    }),
    ...step,
    route: `/organizer/${distributionId}/${step.path}`,
    isAccessible: step.id <= stage,
    isCurrent: step.id === stage,
    isCompleted:
      step.id < stage &&
      !isStepWarning(step.id, {
        phase1NeedsRerun: currentDistribution.phase1NeedsRerun,
        phase2NeedsRerun: currentDistribution.phase2NeedsRerun,
      }),
  }));

  const effectivePartition = useMemo<VisualGroupPartition>(() => {
    if (!visualState) {
      return {
        groups: [],
        assignmentByStudentId: {},
      };
    }
    if (!liveAssignmentByStudentId) {
      return visualState.partition;
    }
    return buildPartitionFromAssignment(liveAssignmentByStudentId, visualState.partition);
  }, [visualState, liveAssignmentByStudentId]);

  const effectiveGroupThemes = useMemo<GroupThemeLookup>(() => {
    if (!visualState) {
      return {};
    }

    const themeIndexByThemeId = new Map(visualState.themes.map((theme) => [theme.id, theme.index]));
    const byGroup: GroupThemeLookup = {};

    for (const group of visualState.partition.groups) {
      byGroup[group.groupId] = {
        themeId: group.themeId,
        themeName: group.themeName,
        themeIndex: themeIndexByThemeId.get(group.themeId),
      };
    }

    for (const group of effectivePartition.groups) {
      if (!byGroup[group.groupId]) {
        byGroup[group.groupId] = {
          themeName: 'n/d (tempo real)',
          isRealtimeFallback: true,
        };
      }
    }

    return byGroup;
  }, [visualState, effectivePartition]);

  const handleRefreshAll = () => {
    fetchStatistics(distributionId).catch(() => {
      // Error state is surfaced by ErrorAlert in this page.
    });
    refreshVisualization(false);
  };

  return (
    <div className="space-y-4">
      {errors.fetchStatistics && !loading.fetchStatistics && (
        <ErrorAlert
          title="Erro ao carregar estatisticas"
          message={errors.fetchStatistics}
          onRetry={() => fetchStatistics(distributionId)}
        />
      )}

      {shouldLoadGroups && errors.fetchGroups && !loading.fetchGroups && (
        <ErrorAlert
          title="Erro ao carregar grupos"
          message={errors.fetchGroups}
          onRetry={() => fetchGroups(distributionId)}
        />
      )}

      {shouldLoadSocialMetrics && errors.fetchSocialMetrics && !loading.fetchSocialMetrics && (
        <ErrorAlert
          title="Erro ao carregar metricas sociais"
          message={errors.fetchSocialMetrics}
          onRetry={() => fetchSocialMetrics(distributionId)}
        />
      )}

      <DistributionOverviewView
        distributionId={distributionId}
        statusLabel={statusLabelText}
        createdAtLabel={formatDate(currentDistribution.createdAt)}
        updatedAtLabel={formatDate(currentDistribution.updatedAt)}
        currentStepLabel={currentStep.label}
        kpis={{
          themes: themes.length,
          students: statistics?.totalStudents ?? 0,
          preferenceRate: statistics?.preferenceCompletionRate ?? 0,
          affinities: statistics?.studentsWithAffinities ?? 0,
          affinityRate: statistics?.affinityCompletionRate ?? 0,
          groups: groups?.length ?? 0,
        }}
        steps={steps}
        loading={loading.fetchStatistics}
        canViewResults={canViewResults}
        visualState={visualState}
        effectivePartition={effectivePartition}
        effectiveGroupThemes={effectiveGroupThemes}
        visualizationLoading={visualizationLoading}
        visualizationError={visualizationError}
        showAffinityEdges={showAffinityEdges}
        showGroupHulls={showGroupHulls}
        forceIntensity={forceIntensity}
        onToggleAffinityEdges={setShowAffinityEdges}
        onToggleGroupHulls={setShowGroupHulls}
        onForceIntensityChange={setForceIntensity}
        onRefreshVisualization={() => refreshVisualization(true)}
        onRefresh={handleRefreshAll}
        onContinue={() => navigate(continueRoute)}
        onViewResults={() => navigate(resultsRoute)}
        onBackToList={() => navigate('/organizer')}
        onOpenStep={(route) => navigate(route)}
      />
    </div>
  );
}
