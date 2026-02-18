/**
 * useDistribution Hook
 * Provides access to the Distribution context
 */

import { useContext } from 'react';
import { DistributionContext } from '../context/DistributionContext';
import { DistributionContextType } from '../types/distribution.types';

export function useDistribution(): DistributionContextType {
  const context = useContext(DistributionContext);

  if (!context) {
    throw new Error(
      'useDistribution must be used within a DistributionProvider'
    );
  }

  return context;
}
