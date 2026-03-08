/**
 * Step 5: Phase 1 Results Page
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Phase1ResultsView } from '../../components/organizer/views/Phase1ResultsView';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';

export function Step5_Phase1ResultsPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { currentDistribution, phase1Report, groups, loading, errors, actions } = useDistribution();
  const { addToast } = useToast();

  const handleManualMove = async (sourceStudentId: string, targetStudentId: string) => {
    if (!distributionId) return;

    try {
      await actions.moveStudent(distributionId, sourceStudentId, targetStudentId);
      addToast({ type: 'success', message: 'Troca aplicada e energia recalculada com sucesso.' });
    } catch (error: any) {
      addToast({ type: 'error', message: error?.message || 'Falha ao aplicar troca de alunos.' });
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
  }, [distributionId, currentDistribution, groups, actions, addToast]);

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
    return <LoadingSpinner fullScreen message="Carregando resultados..." />;
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
    <div className="space-y-4">
      {!phase1Report && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Relatorio da Fase 1 nao encontrado no estado atual. Os grupos abaixo ainda podem ser consultados.
        </div>
      )}

      <Phase1ResultsView
        report={phase1Report}
        groups={groups}
        loading={loading.fetchGroups || loading.loadDistribution}
        movingStudent={loading.moveStudent}
        onManualMove={handleManualMove}
        onBack={() => navigate(`/organizer/${distributionId}/step4-phase1-execute`)}
        onReexecute={() => navigate(`/organizer/${distributionId}/step4-phase1-execute`)}
        onPhase2={() => navigate(`/organizer/${distributionId}/step6-affinities`)}
        onList={() => navigate(`/organizer/${distributionId}`)}
      />
    </div>
  );
}

