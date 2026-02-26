/**
 * Step 2: Data Collection Page
 * Container for collecting student data and managing statistics
 */

import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog as ConfirmDialogModal } from '../../components/common/ConfirmDialog';
import { DataCollectionView } from '../../components/organizer/views/DataCollectionView';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDistribution } from '../../hooks/useDistribution';
import { usePolling } from '../../hooks/usePolling';
import { useToast } from '../../hooks/useToast';
import { removeOrganizerStudent, searchOrganizerStudents } from '../../services/api';
import { OrganizerStudentSearchCandidate } from '../../types/distribution.types';

export function Step2_DataCollectionPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { statistics, loading, actions } = useDistribution();
  const { addToast } = useToast();
  const { confirm, isOpen, config, handleConfirm, handleCancel } = useConfirmDialog();
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

  if (!distributionId) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-600">Erro: ID da distribuicao nao encontrado</p>
      </div>
    );
  }

  const pollStatistics = useCallback(async () => {
    try {
      await actions.fetchStatistics(distributionId);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [actions, distributionId]);

  usePolling(
    pollStatistics,
    {
      enabled: true,
      interval: 10000,
    }
  );

  const handleNext = () => {
    if ((statistics?.totalStudents ?? 0) === 0) {
      addToast({
        type: 'error',
        message: 'Adicione pelo menos um aluno para continuar',
      });
      return;
    }

    navigate(`/organizer/${distributionId}/step3-phase1-config`);
  };

  const handlePrevious = () => {
    navigate(`/organizer/${distributionId}/step1-themes`);
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

  const studentFormLink = `${window.location.origin}/student/form/${distributionId}`;

  return (
    <>
      <DataCollectionView
        statistics={statistics}
        distributionLink={studentFormLink}
        loading={{
          fetchStatistics: loading.fetchStatistics ?? false,
        }}
        onRefreshStatistics={() => actions.fetchStatistics(distributionId)}
        onNext={handleNext}
        onPrevious={handlePrevious}
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
