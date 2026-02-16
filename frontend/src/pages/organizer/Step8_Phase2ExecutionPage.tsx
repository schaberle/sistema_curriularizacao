import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Phase2ExecutionView } from '../../components/organizer/views/Phase2ExecutionView';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';

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

export function Step8_Phase2ExecutionPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { phase2Config, phase2Report, statistics, loading, errors, actions } = useDistribution();
  const { addToast } = useToast();
  const [execState, setExecState] = useState<ExecutionState>(INITIAL_EXECUTION_STATE);

  useEffect(() => {
    if (!distributionId) return;
    if (!statistics) {
      actions.fetchStatistics(distributionId).catch(() => null);
    }
  }, [distributionId, statistics, actions]);

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
    }
  }, [phase2Report, execState.isRunning]);

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

  return (
    <Phase2ExecutionView
      execState={execState}
      loading={loading.executePhase2 || false}
      errorMessage={errors.executePhase2}
      report={phase2Report}
      onExecute={handleExecute}
      onViewFinalResults={() => navigate(`/organizer/${distributionId}/step9-final-results`)}
      onRetry={() => setExecState(INITIAL_EXECUTION_STATE)}
      onPrevious={() => navigate(`/organizer/${distributionId}/step7-phase2-config`)}
    />
  );
}
