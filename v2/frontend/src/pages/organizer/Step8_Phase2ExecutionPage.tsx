import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Phase2ExecutionView } from '../../components/organizer/views/Phase2ExecutionView';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';
import { getSimulationVisualState } from '../../services/api';
import { SimulationVisualState, VisualGroupPartition } from '../../types/distribution.types';

interface ExecutionState {
  isRunning: boolean;
  progress: number;
  startTime: number | null;
  elapsedMs: number;
  currentMessage: string;
  error: string | null;
  success: boolean;
}

const INITIAL_EXECUTION_STATE: ExecutionState = {
  isRunning: false,
  progress: 0,
  startTime: null,
  elapsedMs: 0,
  currentMessage: 'Pronto para executar Fase 2',
  error: null,
  success: false,
};

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

export function Step8_Phase2ExecutionPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { phase2Config, phase2Report, statistics, loading, errors, actions } = useDistribution();
  const { addToast } = useToast();
  const [execState, setExecState] = useState<ExecutionState>(INITIAL_EXECUTION_STATE);

  const [visualizationLoading, setVisualizationLoading] = useState(false);
  const [visualizationError, setVisualizationError] = useState<string | null>(null);
  const [visualState, setVisualState] = useState<SimulationVisualState | null>(null);
  const [liveAssignmentByStudentId] = useState<Record<string, string | null> | null>(null);
  const [showAffinityEdges, setShowAffinityEdges] = useState(false);
  const [showGroupHulls, setShowGroupHulls] = useState(true);
  const [forceIntensity, setForceIntensity] = useState(1);

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
        if (notifyError) {
          addToast({ type: 'warning', message });
        }
      } finally {
        setVisualizationLoading(false);
      }
    },
    [addToast, distributionId]
  );

  useEffect(() => {
    if (!distributionId) return;
    if (!statistics) {
      actions.fetchStatistics(distributionId).catch(() => null);
    }
  }, [distributionId, statistics, actions]);

  useEffect(() => {
    refreshVisualization(false);
  }, [refreshVisualization]);

  useEffect(() => {
    if (phase2Report && execState.isRunning) {
      setExecState((prev) => ({
        ...prev,
        isRunning: false,
        progress: 100,
        success: phase2Report.feasible,
        currentMessage: phase2Report.feasible
          ? `Fase 2 concluida em ${(phase2Report.executionTimeMs / 1000).toFixed(2)}s`
          : 'Fase 2 concluida com ressalvas',
        error: phase2Report.feasible ? null : phase2Report.message || 'Erro na execucao',
      }));
      refreshVisualization(false);
    }
  }, [phase2Report, execState.isRunning, refreshVisualization]);

  useEffect(() => {
    if (!execState.isRunning) return;

    const interval = setInterval(() => {
      setExecState((prev) => {
        const elapsed = Date.now() - (prev.startTime || Date.now());
        const simProgress = Math.min(95, 8 + (elapsed / 20000) * 87);
        return {
          ...prev,
          elapsedMs: elapsed,
          progress: simProgress,
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [execState.isRunning]);

  useEffect(() => {
    if (!execState.isRunning) {
      return;
    }

    const interval = setInterval(() => {
      refreshVisualization(false);
    }, 2200);

    return () => clearInterval(interval);
  }, [execState.isRunning, refreshVisualization]);

  if (!distributionId) {
    return (
      <ErrorAlert
        title="Distribuicao invalida"
        message="Nao foi possivel identificar a distribuicao."
        onRetry={() => navigate('/organizer')}
      />
    );
  }

  const handleExecute = async () => {
    if (!phase2Config.enabled) {
      addToast({
        type: 'error',
        message: 'Ative a Fase 2 na etapa de coleta de afinidades para executar.',
      });
      return;
    }

    if ((statistics?.studentsWithAffinities ?? 0) === 0) {
      addToast({
        type: 'error',
        message: 'Nenhuma afinidade coletada. Gere afinidades ou aguarde respostas dos alunos.',
      });
      return;
    }

    setExecState({
      ...INITIAL_EXECUTION_STATE,
      isRunning: true,
      startTime: Date.now(),
      progress: 8,
      currentMessage: 'Executando Fase 2...',
    });

    try {
      await actions.executePhase2(distributionId, phase2Config);
      addToast({
        type: 'success',
        message: 'Fase 2 executada com sucesso',
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao executar Fase 2';
      setExecState((prev) => ({
        ...prev,
        isRunning: false,
        progress: 0,
        error: errorMessage,
        success: false,
        currentMessage: errorMessage,
      }));
      addToast({
        type: 'error',
        message: errorMessage,
      });
    }
  };

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

  const handleForceIntensityChange = (value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    const safe = Math.max(0.2, Math.min(3, value));
    setForceIntensity(safe);
  };

  return (
    <Phase2ExecutionView
      execState={execState}
      loading={loading.executePhase2 || false}
      errorMessage={errors.executePhase2}
      report={phase2Report}
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
      onForceIntensityChange={handleForceIntensityChange}
      onRefreshVisualization={() => refreshVisualization(true)}
      onExecute={handleExecute}
      onViewFinalResults={() => navigate(`/organizer/${distributionId}/step9-final-results`)}
      onRetry={() => setExecState(INITIAL_EXECUTION_STATE)}
      onPrevious={() => navigate(`/organizer/${distributionId}/step7-phase2-config`)}
    />
  );
}
