/**
 * Phase2Guard Component
 * Ensures Phase 2 is enabled before rendering Phase 2 pages
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDistribution } from '../../../hooks/useDistribution';

export function Phase2Guard() {
  const location = useLocation();
  const { phase2Config } = useDistribution();

  if (!phase2Config.enabled) {
    return <Navigate to="../final-results" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
