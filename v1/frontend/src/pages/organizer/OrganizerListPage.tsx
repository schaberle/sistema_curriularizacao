/**
 * Organizer list page
 * Entry point for wizard flow
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DistributionList } from '../../components/organizer/DistributionList';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';
import { getResultsRoute } from '../../utils/distributionFlow';

export function OrganizerListPage() {
  const navigate = useNavigate();
  const { distributions, loading, errors, actions } = useDistribution();
  const { addToast } = useToast();
  const { fetchDistributions } = actions;

  useEffect(() => {
    fetchDistributions().catch(() => {
      addToast({
        type: 'error',
        message: 'Erro ao carregar distribuicoes',
      });
    });
  }, [fetchDistributions, addToast]);

  const handleCreate = async () => {
    try {
      const distributionId = await actions.createDistribution();
      navigate(`/organizer/${distributionId}/step1-themes`);
    } catch {
      addToast({
        type: 'error',
        message: 'Nao foi possivel criar distribuicao',
      });
    }
  };

  const handleCreateSimulation = async () => {
    try {
      const distributionId = await actions.createDistribution();
      navigate(`/organizer/${distributionId}/simulation`);
    } catch {
      addToast({
        type: 'error',
        message: 'Nao foi possivel criar simulacao',
      });
    }
  };

  const handleSelect = (distribution: { id: string }) => {
    navigate(`/organizer/${distribution.id}`);
  };

  const handleManage = (distribution: { id: string }) => {
    navigate(`/organizer/${distribution.id}`);
  };

  const handleViewResults = (distribution: { id: string; status?: string }) => {
    navigate(getResultsRoute(distribution.id, distribution.status ?? 'PENDING'));
  };

  const handleOpenSimulation = (distribution: { id: string }) => {
    navigate(`/organizer/${distribution.id}/simulation`);
  };

  return (
    <div className="space-y-4">
      {errors.fetchDistributions && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.fetchDistributions}
        </div>
      )}

      <DistributionList
        distributions={distributions}
        listLoading={loading.fetchDistributions}
        createLoading={loading.createDistribution}
        onCreate={handleCreate}
        onCreateSimulation={handleCreateSimulation}
        onSelect={handleSelect}
        onViewResults={handleViewResults}
        onManage={handleManage}
        onOpenSimulation={handleOpenSimulation}
      />
    </div>
  );
}

