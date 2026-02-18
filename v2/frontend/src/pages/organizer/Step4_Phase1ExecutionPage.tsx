/**
 * Step 4: Phase 1 Execution Page
 * Container for executing Phase 1 optimization and monitoring progress
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phase1ExecutionView } from '../../components/organizer/views/Phase1ExecutionView';
import { getSimulationVisualState } from '../../services/api';
import { SimulationVisualState, VisualGroupPartition } from '../../types/distribution.types';

/**
 * Execution state tracking
 */
interface ExecutionState {
  isRunning: boolean;
  progress: number; // 0-100
  startTime: number | null;
  elapsedMs: number;
  iterationCount: number;
  estimatedTotalMs: number | null;
  currentMessage: string;
  error: string | null;
  success: boolean;
}

const INITIAL_EXECUTION_STATE: ExecutionState = {
  isRunning: false,
  progress: 0,
  startTime: null,
  elapsedMs: 0,
  iterationCount: 0,
  estimatedTotalMs: null,
  currentMessage: 'Pronto para executar',
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

/**
 * Step 4: Phase 1 Execution Container
 */
export function Step4_Phase1ExecutionPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { phase1Config, phase1Report, loading, errors, actions } = useDistribution();
  const { addToast } = useToast();

  // Local execution state
  const [execState, setExecState] = useState<ExecutionState>(INITIAL_EXECUTION_STATE);

  // Visual state for the v1-compatible 3D network panel
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

  // Handle missing distributionId
  if (!distributionId) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro: ID da distribuicao nao encontrado</p>
      </div>
    );
  }

  useEffect(() => {
    refreshVisualization(false);
  }, [refreshVisualization]);

  // Monitor phase1Report for completion
  useEffect(() => {
    if (phase1Report && execState.isRunning) {
      // Execution completed
      setExecState((prev) => ({
        ...prev,
        isRunning: false,
        progress: 100,
        success: phase1Report.feasible,
        currentMessage: phase1Report.feasible
          ? `Fase 1 completada com sucesso em ${(phase1Report.executionTimeMs / 1000).toFixed(2)}s`
          : 'Fase 1 executada com problemas (verifique os detalhes)',
        error: phase1Report.feasible ? null : phase1Report.message || 'Erro na execucao',
      }));

      // Show appropriate toast
      if (phase1Report.feasible) {
        addToast({
          type: 'success',
          message: `Fase 1 completada! ${phase1Report.groupsCreated} grupos criados.`,
        });
        refreshVisualization(false);
      } else {
        addToast({
          type: 'error',
          message: `Problema na execucao: ${phase1Report.message}`,
        });
      }
    }
  }, [phase1Report, execState.isRunning, addToast, refreshVisualization]);

  // Simulate progress while running
  useEffect(() => {
    if (!execState.isRunning) return;

    const interval = setInterval(() => {
      setExecState((prev) => {
        const elapsed = Date.now() - (prev.startTime || Date.now());
        // Simulate progress from 5% to 95% while running
        const simProgress = Math.min(95, 5 + (elapsed / 20000) * 90);

        return {
          ...prev,
          elapsedMs: elapsed,
          progress: simProgress,
          iterationCount: Math.floor(simProgress / 10),
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [execState.isRunning]);

  // Poll visual-state while execution runs
  useEffect(() => {
    if (!execState.isRunning) {
      return;
    }

    const interval = setInterval(() => {
      refreshVisualization(false);
    }, 2200);

    return () => clearInterval(interval);
  }, [execState.isRunning, refreshVisualization]);

  // Handler: Execute Phase 1
  const handleExecute = async () => {
    // Confirmation check
    const confirmed = window.confirm(
      'Tem certeza que deseja executar a Fase 1? Grupos anteriores (se houver) serao substituidos.'
    );
    if (!confirmed) return;

    // Reset state and start execution
    setExecState({
      ...INITIAL_EXECUTION_STATE,
      isRunning: true,
      startTime: Date.now(),
      progress: 5,
      currentMessage: 'Iniciando execucao da Fase 1...',
    });

    try {
      // Call backend to execute Phase 1
      await actions.executePhase1(distributionId, phase1Config);

      // Note: phase1Report update will be monitored by useEffect above
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao executar Fase 1';

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

  // Handler: Navigate to results
  const handleViewResults = () => {
    navigate(`/organizer/${distributionId}/step5-phase1-results`);
  };

  // Handler: Try again
  const handleRetry = () => {
    setExecState(INITIAL_EXECUTION_STATE);
  };

  // Handler: Navigate back
  const handlePrevious = () => {
    navigate(`/organizer/${distributionId}/step3-phase1-config`);
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

  // Render
  return (
    <Phase1ExecutionView
      execState={execState}
      loading={loading.executePhase1 || false}
      errorMessage={errors.executePhase1}
      phase1Report={phase1Report}
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
      onViewResults={handleViewResults}
      onRetry={handleRetry}
      onPrevious={handlePrevious}
    />
  );
}
