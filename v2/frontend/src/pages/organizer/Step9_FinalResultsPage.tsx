import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { FinalResultsView } from '../../components/organizer/views/FinalResultsView';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';

export function Step9_FinalResultsPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const {
    currentDistribution,
    phase1Report,
    phase2Report,
    groups,
    socialMetrics,
    loading,
    errors,
    actions,
  } = useDistribution();
  const { addToast } = useToast();

  const handleManualMove = async (studentId: string, targetGroupId: string) => {
    if (!distributionId) return;

    try {
      await actions.moveStudent(distributionId, studentId, targetGroupId);
      addToast({ type: 'success', message: 'Aluno movido e metricas recalculadas.' });
    } catch (error: any) {
      addToast({ type: 'error', message: error?.message || 'Falha ao mover aluno.' });
    }
  };

  useEffect(() => {
    if (!distributionId) return;

    if (!currentDistribution || currentDistribution.id !== distributionId) {
      actions.loadDistribution(distributionId).catch(() => {
        addToast({ type: 'error', message: 'Nao foi possivel carregar a distribuicao' });
      });
      return;
    }

    if (!groups) {
      actions.fetchGroups(distributionId).catch(() => {
        addToast({ type: 'error', message: 'Nao foi possivel carregar os grupos' });
      });
    }

    if (!socialMetrics) {
      actions.fetchSocialMetrics(distributionId).catch(() => {
        // Keep page usable even without social metrics.
      });
    }
  }, [distributionId, currentDistribution, groups, socialMetrics, actions, addToast]);

  if (!distributionId) {
    return (
      <ErrorAlert
        title="Distribuicao invalida"
        message="Nao foi possivel identificar a distribuicao."
        onRetry={() => navigate('/organizer')}
      />
    );
  }

  if (loading.loadDistribution) {
    return <LoadingSpinner fullScreen message="Carregando resultados finais..." />;
  }

  if (errors.loadDistribution) {
    return (
      <ErrorAlert
        title="Erro ao carregar"
        message={errors.loadDistribution}
        onRetry={() => actions.loadDistribution(distributionId)}
      />
    );
  }

  if (errors.fetchGroups && !loading.fetchGroups) {
    return (
      <ErrorAlert
        title="Erro ao carregar grupos"
        message={errors.fetchGroups}
        onRetry={() => actions.fetchGroups(distributionId)}
      />
    );
  }

  return (
    <FinalResultsView
      phase1Report={phase1Report}
      phase2Report={phase2Report}
      groups={groups}
      socialMetrics={socialMetrics}
      loading={loading.fetchGroups || loading.fetchSocialMetrics || loading.loadDistribution}
      movingStudent={loading.moveStudent}
      onManualMove={handleManualMove}
      onBackPhase1={() => navigate(`/organizer/${distributionId}/step5-phase1-results`)}
      onReexecutePhase2={() => navigate(`/organizer/${distributionId}/step8-phase2-execute`)}
      onList={() => navigate(`/organizer/${distributionId}`)}
    />
  );
}
