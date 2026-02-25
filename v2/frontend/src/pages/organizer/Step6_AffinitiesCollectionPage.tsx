import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Phase2AffinitiesView } from '../../components/organizer/views/Phase2AffinitiesView';
import { useDistribution } from '../../hooks/useDistribution';
import { usePolling } from '../../hooks/usePolling';
import { useToast } from '../../hooks/useToast';

export function Step6_AffinitiesCollectionPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { phase2Config, statistics, loading, actions } = useDistribution();
  const { addToast } = useToast();

  if (!distributionId) {
    return (
      <ErrorAlert
        title="Distribuicao invalida"
        message="Nao foi possivel identificar a distribuicao."
        onRetry={() => navigate('/organizer')}
      />
    );
  }

  const pollStatistics = useCallback(async () => {
    try {
      await actions.fetchStatistics(distributionId);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [actions, distributionId]);

  usePolling(pollStatistics, { enabled: true, interval: 10000 });

  const handleEnabledChange = async (enabled: boolean) => {
    actions.setPhase2Enabled(enabled);

    try {
      await actions.configurePhase2(distributionId, {
        enabled,
        wSoc: phase2Config.wSoc,
        maxIterations: phase2Config.maxIterations,
        temperature: phase2Config.temperature,
      });
    } catch {
      addToast({
        type: 'warning',
        message: enabled
          ? 'Nao foi possivel abrir a Fase 2 no backend.'
          : 'Nao foi possivel fechar a Fase 2 no backend.',
      });
    }
  };

  return (
    <Phase2AffinitiesView
      statistics={statistics}
      phase2Enabled={phase2Config.enabled}
      loading={{
        fetchStatistics: loading.fetchStatistics || false,
      }}
      onEnabledChange={handleEnabledChange}
      onRefresh={() => actions.fetchStatistics(distributionId)}
      onPrevious={() => navigate(`/organizer/${distributionId}/step5-phase1-results`)}
      onNext={() => navigate(`/organizer/${distributionId}/step7-phase2-config`)}
    />
  );
}
