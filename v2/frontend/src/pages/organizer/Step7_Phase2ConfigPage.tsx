import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Phase2Config } from '../../types/distribution.types';
import { Phase2ConfigView } from '../../components/organizer/views/Phase2ConfigView';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';

export function Step7_Phase2ConfigPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { phase2Config, statistics, loading, errors, actions } = useDistribution();
  const { addToast } = useToast();
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDistributionId = distributionId ?? '';

  useEffect(() => {
    if (!activeDistributionId) return;
    if (!statistics) {
      actions.fetchStatistics(activeDistributionId).catch(() => {
        addToast({
          type: 'error',
          message: 'Erro ao carregar estatisticas para a Fase 2',
        });
      });
    }
  }, [activeDistributionId, statistics, actions, addToast]);

  const scheduleMarkExecutionPending = useCallback(() => {
    if (!activeDistributionId) {
      return;
    }

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }

    pendingTimerRef.current = setTimeout(async () => {
      try {
        await actions.markExecutionPending(activeDistributionId, 'phase2');
      } catch {
        addToast({
          type: 'warning',
          message: 'Nao foi possivel registrar a alteracao pendente da Fase 2.',
        });
      }
    }, 500);
  }, [actions, addToast, activeDistributionId]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const handleConfigChange = (field: 'wSoc' | 'maxIterations' | 'temperature', value: number) => {
    actions.setPhase2Config({ [field]: value } as Partial<Phase2Config>);
    scheduleMarkExecutionPending();
  };

  const handleExecute = async () => {
    try {
      await actions.configurePhase2(activeDistributionId, {
        enabled: phase2Config.enabled,
        wSoc: phase2Config.wSoc,
        maxIterations: phase2Config.maxIterations,
        temperature: phase2Config.temperature,
      });
    } catch {
      addToast({
        type: 'warning',
        message: 'Nao foi possivel persistir configuracao no backend. Prosseguindo com configuracao local.',
      });
    }

    navigate(`/organizer/${activeDistributionId}/step8-phase2-execute`);
  };

  if (!activeDistributionId) {
    return (
      <ErrorAlert
        title="Distribuicao invalida"
        message="Nao foi possivel identificar a distribuicao."
        onRetry={() => navigate('/organizer')}
      />
    );
  }

  return (
    <Phase2ConfigView
      config={phase2Config}
      loading={loading.configurePhase2 || false}
      affinityCount={statistics?.studentsWithAffinities ?? 0}
      totalStudents={statistics?.totalStudents ?? 0}
      error={errors.configurePhase2}
      onConfigChange={handleConfigChange}
      onExecute={handleExecute}
      onPrevious={() => navigate(`/organizer/${activeDistributionId}/step6-affinities`)}
    />
  );
}
