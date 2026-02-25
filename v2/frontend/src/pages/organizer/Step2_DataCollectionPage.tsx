/**
 * Step 2: Data Collection Page
 * Container for collecting student data and managing statistics
 */

import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DataCollectionView } from '../../components/organizer/views/DataCollectionView';
import { useDistribution } from '../../hooks/useDistribution';
import { usePolling } from '../../hooks/usePolling';
import { useToast } from '../../hooks/useToast';

export function Step2_DataCollectionPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { statistics, loading, actions } = useDistribution();
  const { addToast } = useToast();

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

  const studentFormLink = `${window.location.origin}/student/form/${distributionId}`;

  return (
    <DataCollectionView
      statistics={statistics}
      distributionLink={studentFormLink}
      loading={{
        fetchStatistics: loading.fetchStatistics ?? false,
      }}
      onRefreshStatistics={() => actions.fetchStatistics(distributionId)}
      onNext={handleNext}
      onPrevious={handlePrevious}
    />
  );
}
