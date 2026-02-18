/**
 * Step 4: Phase 1 Execution Page
 * Container for executing Phase 1 optimization and monitoring progress
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';
import { useEffect, useState } from 'react';
import { Phase1ExecutionView } from '../../components/organizer/views/Phase1ExecutionView';

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
  success: false
};

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

  // Handle missing distributionId
  if (!distributionId) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro: ID da distribuição não encontrado</p>
      </div>
    );
  }

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
        error: phase1Report.feasible ? null : phase1Report.message || 'Erro na execução'
      }));

      // Show appropriate toast
      if (phase1Report.feasible) {
        addToast({
          type: 'success',
          message: `Fase 1 completada! ${phase1Report.groupsCreated} grupos criados.`
        });
      } else {
        addToast({
          type: 'error',
          message: `Problema na execução: ${phase1Report.message}`
        });
      }
    }
  }, [phase1Report, execState.isRunning, addToast]);

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
          iterationCount: Math.floor(simProgress / 10)
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [execState.isRunning]);

  // Handler: Execute Phase 1
  const handleExecute = async () => {
    // Confirmation check
    const confirmed = window.confirm(
      'Tem certeza que deseja executar a Fase 1? Grupos anteriores (se houver) serão substituídos.'
    );
    if (!confirmed) return;

    // Reset state and start execution
    setExecState({
      ...INITIAL_EXECUTION_STATE,
      isRunning: true,
      startTime: Date.now(),
      progress: 5,
      currentMessage: 'Iniciando execução da Fase 1...'
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
        currentMessage: errorMessage
      }));

      addToast({
        type: 'error',
        message: errorMessage
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

  // Render
  return (
    <Phase1ExecutionView
      execState={execState}
      loading={loading.executePhase1 || false}
      errorMessage={errors.executePhase1}
      phase1Report={phase1Report}
      onExecute={handleExecute}
      onViewResults={handleViewResults}
      onRetry={handleRetry}
      onPrevious={handlePrevious}
    />
  );
}
