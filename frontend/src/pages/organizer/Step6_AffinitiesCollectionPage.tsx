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

  const handleGenerateAffinities = async (density: number) => {
    try {
      await actions.generateAffinities(distributionId, density);
      addToast({
        type: 'success',
        message: 'Afinidades de teste geradas com sucesso',
      });
    } catch {
      addToast({
        type: 'error',
        message: 'Erro ao gerar afinidades de teste',
      });
    }
  };

  return (
    <Phase2AffinitiesView
      statistics={statistics}
      phase2Enabled={phase2Config.enabled}
      loading={{
        fetchStatistics: loading.fetchStatistics || false,
        generateAffinities: loading.generateAffinities || false,
      }}
      onEnabledChange={actions.setPhase2Enabled}
      onRefresh={() => actions.fetchStatistics(distributionId)}
      onGenerateAffinities={handleGenerateAffinities}
      onPrevious={() => navigate(`/organizer/${distributionId}/step5-phase1-results`)}
      onNext={() => navigate(`/organizer/${distributionId}/step7-phase2-config`)}
    />
  );
}
