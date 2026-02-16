/**
 * WizardGuard Component
 * Ensures distribution data is loaded before rendering wizard pages
 */

import React, { useEffect, useState } from 'react';
import { useParams, Navigate, Outlet } from 'react-router-dom';
import { useDistribution } from '../../../hooks/useDistribution';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { ErrorAlert } from '../../common/ErrorAlert';

export function WizardGuard() {
  const { distributionId } = useParams();
  const { currentDistribution, loading, errors, actions } = useDistribution();
  const { loadDistribution } = actions;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    if (!distributionId) {
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    if (currentDistribution?.id === distributionId) {
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    if (loading.loadDistribution) {
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);

    loadDistribution(distributionId)
      .catch((error) => {
        console.error('Failed to load distribution:', error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [distributionId, currentDistribution?.id, loadDistribution, loading.loadDistribution]);

  if (isLoading || loading.loadDistribution) {
    return <LoadingSpinner fullScreen message="Carregando distribuição..." />;
  }

  if (errors.loadDistribution) {
    return (
      <div className="p-6">
        <ErrorAlert
          title="Erro ao Carregar"
          message={errors.loadDistribution}
          onRetry={() => loadDistribution(distributionId!)}
        />
      </div>
    );
  }

  if (!currentDistribution || currentDistribution.id !== distributionId) {
    return <Navigate to="/organizer" replace />;
  }

  return <Outlet />;
}
