import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog as ConfirmDialogModal } from '../../components/common/ConfirmDialog';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Phase2AffinitiesView } from '../../components/organizer/views/Phase2AffinitiesView';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDistribution } from '../../hooks/useDistribution';
import { usePolling } from '../../hooks/usePolling';
import { useToast } from '../../hooks/useToast';
import { removeOrganizerStudent, searchOrganizerStudents } from '../../services/api';
import { OrganizerStudentSearchCandidate } from '../../types/distribution.types';

export function Step6_AffinitiesCollectionPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { phase2Config, statistics, loading, actions } = useDistribution();
  const { addToast } = useToast();
  const { confirm, isOpen, config, handleConfirm, handleCancel } = useConfirmDialog();
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

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

  const handleSearchStudentsToRemove = useCallback(
    async (query: string): Promise<OrganizerStudentSearchCandidate[]> => {
      return searchOrganizerStudents(distributionId, query, 20);
    },
    [distributionId]
  );

  const handleRemoveStudent = useCallback(
    async (student: OrganizerStudentSearchCandidate) => {
      const shouldRemove = await confirm({
        title: 'Excluir aluno?',
        message: `Tem certeza que deseja excluir "${student.name}" da distribuicao?`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        isDestructive: true,
      });

      if (!shouldRemove) {
        return;
      }

      setRemovingStudentId(student.id);
      try {
        await removeOrganizerStudent(distributionId, student.id);

        await Promise.allSettled([
          actions.fetchStatistics(distributionId),
          actions.markExecutionPending(distributionId, 'phase1'),
        ]);

        addToast({
          type: 'success',
          message: `Aluno "${student.name}" removido com sucesso`,
        });
      } catch (error: any) {
        addToast({
          type: 'error',
          message: error?.message || 'Nao foi possivel remover o aluno',
        });
      } finally {
        setRemovingStudentId(null);
      }
    },
    [actions, addToast, confirm, distributionId]
  );

  return (
    <>
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
        onSearchStudentsToRemove={handleSearchStudentsToRemove}
        onRemoveStudent={handleRemoveStudent}
        removingStudentId={removingStudentId}
      />
      <ConfirmDialogModal
        isOpen={isOpen}
        config={config}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
