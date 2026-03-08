/**
 * Distribution Context
 * Manages the state of the distribution wizard workflow
 */

import React, { createContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import {
  listDistributions as listDistributionsApi,
  createDistribution as createDistributionApi,
  getDistribution as getDistributionApi,
  uploadThemes as uploadThemesApi,
  getDistributionStatistics as getDistributionStatisticsApi,
  getSocialMetrics as getSocialMetricsApi,
  configureSocialOptimization as configureSocialOptimizationApi,
  executePhase1 as executePhase1Api,
  getDistributionGroups as getDistributionGroupsApi,
  executePhase2 as executePhase2Api,
  seedDistribution as seedDistributionApi,
  seedAffinities as seedAffinitiesApi,
  markExecutionPending as markExecutionPendingApi,
  moveOrganizerStudent as moveOrganizerStudentApi,
} from '../services/api';
import {
  Distribution,
  Theme,
  Phase1Config,
  Phase2Config,
  SeedConfig,
  DistributionContextState,
  DistributionContextType,
  DEFAULT_PHASE1_CONFIG,
  DEFAULT_PHASE2_CONFIG,
} from '../types/distribution.types';

const initialState: DistributionContextState = {
  distributions: [],
  currentDistribution: null,
  themes: [],
  statistics: null,
  groups: null,
  socialMetrics: null,
  phase1Report: null,
  phase2Report: null,
  phase1Config: DEFAULT_PHASE1_CONFIG,
  phase2Config: DEFAULT_PHASE2_CONFIG,
  loading: {
    fetchDistributions: false,
    createDistribution: false,
    loadDistribution: false,
    saveThemes: false,
    fetchStatistics: false,
    configurePhase2: false,
    fetchSocialMetrics: false,
    executePhase1: false,
    executePhase2: false,
    fetchGroups: false,
    generateSeed: false,
    generateAffinities: false,
    markExecutionPending: false,
    moveStudent: false,
  },
  errors: {
    fetchDistributions: null,
    createDistribution: null,
    loadDistribution: null,
    saveThemes: null,
    fetchStatistics: null,
    configurePhase2: null,
    fetchSocialMetrics: null,
    executePhase1: null,
    executePhase2: null,
    fetchGroups: null,
    generateSeed: null,
    generateAffinities: null,
    markExecutionPending: null,
    moveStudent: null,
  },
};

export const DistributionContext = createContext<DistributionContextType | undefined>(
  undefined
);

interface DistributionProviderProps {
  children: ReactNode;
}

export function DistributionProvider({ children }: DistributionProviderProps) {
  const [state, setState] = useState<DistributionContextState>(initialState);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statisticsRequestSeqRef = useRef(0);
  const statisticsInFlightRef = useRef(0);

  // Helper function to update loading state
  const setLoading = useCallback(
    (operation: string, isLoading: boolean) => {
      setState((prev) => ({
        ...prev,
        loading: { ...prev.loading, [operation]: isLoading },
      }));
    },
    []
  );

  // Helper function to set error
  const setError = useCallback(
    (operation: string, error: string | null) => {
      setState((prev) => ({
        ...prev,
        errors: { ...prev.errors, [operation]: error },
      }));
    },
    []
  );

  const updateDistributionMetadata = useCallback((distribution: Partial<Distribution> & { id: string }) => {
    setState((prev) => {
      const nextDistributions = prev.distributions.map((item) =>
        item.id === distribution.id ? { ...item, ...distribution } : item
      );

      const nextCurrentDistribution =
        prev.currentDistribution?.id === distribution.id
          ? { ...prev.currentDistribution, ...distribution }
          : prev.currentDistribution;

      return {
        ...prev,
        distributions: nextDistributions,
        currentDistribution: nextCurrentDistribution,
      };
    });
  }, []);

  const syncDistributionMetadata = useCallback(async (distributionId: string) => {
    try {
      const latestDistributions = await listDistributionsApi();
      const latest = latestDistributions.find((item) => item.id === distributionId);
      if (!latest) {
        return;
      }
      updateDistributionMetadata(latest);
    } catch {
      // Keep current state when metadata sync fails.
    }
  }, [updateDistributionMetadata]);

  // Distribution Management
  const fetchDistributions = useCallback(async () => {
    setLoading('fetchDistributions', true);
    setError('fetchDistributions', null);

    try {
      const distributions = await listDistributionsApi();
      setState((prev) => ({
        ...prev,
        distributions,
      }));
      return distributions;
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao buscar distribuiÃ§Ãµes';
      setError('fetchDistributions', errorMessage);
      throw error;
    } finally {
      setLoading('fetchDistributions', false);
    }
  }, [setError, setLoading]);

  const createDistribution = useCallback(async () => {
    setLoading('createDistribution', true);
    setError('createDistribution', null);

    try {
      const distributionId = await createDistributionApi();
      const now = new Date().toISOString();
      const provisionalDistribution: Distribution = {
        id: distributionId,
        organizerId: '',
        status: 'PENDING',
        phase1NeedsRerun: false,
        phase2NeedsRerun: false,
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => ({
        ...prev,
        distributions: [provisionalDistribution, ...prev.distributions.filter((item) => item.id !== distributionId)],
        currentDistribution: provisionalDistribution,
        themes: [],
        statistics: null,
        groups: null,
        socialMetrics: null,
        phase1Report: null,
        phase2Report: null,
      }));

      try {
        const distribution = await getDistributionApi(distributionId);
        setState((prev) => ({
          ...prev,
          currentDistribution: distribution.distribution,
          themes: distribution.themes,
          statistics: distribution.statistics,
          groups: distribution.groups,
        }));
      } catch {
        // Keep provisional state and let guards/pages trigger a fresh load.
      }
      return distributionId;
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao criar distribuiÃ§Ã£o';
      setError('createDistribution', errorMessage);
      throw error;
    } finally {
      setLoading('createDistribution', false);
    }
  }, [setError, setLoading]);

  const loadDistribution = useCallback(async (id: string) => {
    setLoading('loadDistribution', true);
    setError('loadDistribution', null);

    try {
      const distributionData = await getDistributionApi(id);
      setState((prev) => ({
        ...prev,
        currentDistribution: distributionData.distribution,
        themes: distributionData.themes || [],
        statistics: distributionData.statistics || null,
        groups: distributionData.groups || null,
        socialMetrics: null,
        phase1Report: null,
        phase2Report: null,
      }));
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao carregar distribuiÃ§Ã£o';
      setError('loadDistribution', errorMessage);
      throw error;
    } finally {
      setLoading('loadDistribution', false);
    }
  }, [setError, setLoading]);

  // Theme Management
  const saveThemes = useCallback(
    async (distributionId: string, themes: Theme[]) => {
      setLoading('saveThemes', true);
      setError('saveThemes', null);

      try {
        const savedThemes = await uploadThemesApi(distributionId, themes);
        setState((prev) => ({
          ...prev,
          themes: savedThemes,
        }));
        await syncDistributionMetadata(distributionId);
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro ao salvar temas';
        setError('saveThemes', errorMessage);
        throw error;
      } finally {
        setLoading('saveThemes', false);
      }
    },
    [setError, setLoading, syncDistributionMetadata]
  );

  // Statistics
  const fetchStatistics = useCallback(async (distributionId: string) => {
    const requestSeq = ++statisticsRequestSeqRef.current;
    statisticsInFlightRef.current += 1;
    setLoading('fetchStatistics', true);
    setError('fetchStatistics', null);

    try {
      const statistics = await getDistributionStatisticsApi(distributionId);
      if (requestSeq === statisticsRequestSeqRef.current) {
        setState((prev) => ({
          ...prev,
          statistics,
        }));
      }
      return statistics;
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao buscar estatÃ­sticas';
      if (requestSeq === statisticsRequestSeqRef.current) {
        setError('fetchStatistics', errorMessage);
      }
      throw error;
    } finally {
      statisticsInFlightRef.current = Math.max(0, statisticsInFlightRef.current - 1);
      setLoading('fetchStatistics', statisticsInFlightRef.current > 0);
    }
  }, [setError, setLoading]);

  const fetchSocialMetrics = useCallback(async (distributionId: string) => {
    setLoading('fetchSocialMetrics', true);
    setError('fetchSocialMetrics', null);

    try {
      const socialMetrics = await getSocialMetricsApi(distributionId);
      setState((prev) => ({
        ...prev,
        socialMetrics,
      }));
      return socialMetrics;
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao buscar metricas sociais';
      setError('fetchSocialMetrics', errorMessage);
      throw error;
    } finally {
      setLoading('fetchSocialMetrics', false);
    }
  }, [setError, setLoading]);

  const startStatisticsPolling = useCallback(
    (distributionId: string, intervalMs: number = 10000) => {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Fetch immediately
      fetchStatistics(distributionId);

      // Then poll
      pollingIntervalRef.current = setInterval(() => {
        fetchStatistics(distributionId);
      }, intervalMs);
    },
    [fetchStatistics]
  );

  const stopStatisticsPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const fetchGroups = useCallback(async (distributionId: string) => {
    setLoading('fetchGroups', true);
    setError('fetchGroups', null);

    try {
      const groups = await getDistributionGroupsApi(distributionId);
      setState((prev) => ({
        ...prev,
        groups,
      }));
      return groups;
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao buscar grupos';
      setError('fetchGroups', errorMessage);
      throw error;
    } finally {
      setLoading('fetchGroups', false);
    }
  }, [setError, setLoading]);

  // Phase 1 Execution
  const executePhase1 = useCallback(
    async (distributionId: string, config?: Partial<Phase1Config>) => {
      setLoading('executePhase1', true);
      setError('executePhase1', null);

      try {
        const params = {
          ...state.phase1Config,
          ...config,
        };

        const report = await executePhase1Api(distributionId, params);
        setState((prev) => ({
          ...prev,
          phase1Report: report,
        }));

        // Fetch the generated groups
        await fetchGroups(distributionId);
        await syncDistributionMetadata(distributionId);

        return report;
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro ao executar Fase 1';
        setError('executePhase1', errorMessage);
        throw error;
      } finally {
        setLoading('executePhase1', false);
      }
    },
    [fetchGroups, setError, setLoading, state.phase1Config, syncDistributionMetadata]
  );

  // Phase 2 Execution
  const executePhase2 = useCallback(
    async (distributionId: string, config?: Partial<Phase2Config>) => {
      setLoading('executePhase2', true);
      setError('executePhase2', null);

      try {
        const params = {
          wSoc: config?.wSoc ?? state.phase2Config.wSoc,
          maxIterations: config?.maxIterations ?? state.phase2Config.maxIterations,
          temperature: config?.temperature ?? state.phase2Config.temperature,
        };

        const report = await executePhase2Api(distributionId, params);
        setState((prev) => ({
          ...prev,
          phase2Report: report,
        }));

        // Fetch updated groups and metrics after execution
        await fetchGroups(distributionId);
        await fetchSocialMetrics(distributionId).catch(() => null);
        await syncDistributionMetadata(distributionId);

        return report;
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro ao executar Fase 2';
        setError('executePhase2', errorMessage);
        throw error;
      } finally {
        setLoading('executePhase2', false);
      }
    },
    [fetchGroups, fetchSocialMetrics, setError, setLoading, state.phase2Config, syncDistributionMetadata]
  );

  const configurePhase2 = useCallback(
    async (
      distributionId: string,
      config: Partial<Phase2Config> & { enabled: boolean }
    ) => {
      setLoading('configurePhase2', true);
      setError('configurePhase2', null);

      try {
        await configureSocialOptimizationApi(distributionId, config);
        setState((prev) => ({
          ...prev,
          phase2Config: {
            ...prev.phase2Config,
            enabled: config.enabled,
            wSoc: config.wSoc ?? prev.phase2Config.wSoc,
            maxIterations: config.maxIterations ?? prev.phase2Config.maxIterations,
            temperature: config.temperature ?? prev.phase2Config.temperature,
          },
        }));
        await syncDistributionMetadata(distributionId);
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro ao configurar Fase 2';
        setError('configurePhase2', errorMessage);
        throw error;
      } finally {
        setLoading('configurePhase2', false);
      }
    },
    [setError, setLoading, syncDistributionMetadata]
  );

  // Seed Data
  const generateSeed = useCallback(async (distributionId: string, config: SeedConfig) => {
    setLoading('generateSeed', true);
    setError('generateSeed', null);

    try {
      await seedDistributionApi(distributionId, config);
      // Refresh statistics after seeding
      await fetchStatistics(distributionId);
      await syncDistributionMetadata(distributionId);
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao gerar dados de teste';
      setError('generateSeed', errorMessage);
      throw error;
    } finally {
      setLoading('generateSeed', false);
    }
  }, [fetchStatistics, setError, setLoading, syncDistributionMetadata]);

  const generateAffinities = useCallback(
    async (distributionId: string, density: number) => {
      setLoading('generateAffinities', true);
      setError('generateAffinities', null);

      try {
        await seedAffinitiesApi(distributionId, density);
        // Refresh statistics after seeding affinities
        await fetchStatistics(distributionId);
        await syncDistributionMetadata(distributionId);
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro ao gerar dados de afinidade';
        setError('generateAffinities', errorMessage);
        throw error;
      } finally {
        setLoading('generateAffinities', false);
      }
    },
    [fetchStatistics, setError, setLoading, syncDistributionMetadata]
  );

  const markExecutionPending = useCallback(
    async (distributionId: string, scope: 'phase1' | 'phase2') => {
      setLoading('markExecutionPending', true);
      setError('markExecutionPending', null);

      try {
        const pendingState = await markExecutionPendingApi(distributionId, scope);
        updateDistributionMetadata({
          id: pendingState.distributionId,
          phase1NeedsRerun: pendingState.phase1NeedsRerun,
          phase2NeedsRerun: pendingState.phase2NeedsRerun,
        });
        await syncDistributionMetadata(distributionId);
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro ao marcar pendencia de execucao';
        setError('markExecutionPending', errorMessage);
        throw error;
      } finally {
        setLoading('markExecutionPending', false);
      }
    },
    [setLoading, setError, updateDistributionMetadata, syncDistributionMetadata]
  );

  const moveStudent = useCallback(
    async (distributionId: string, sourceStudentId: string, targetStudentId: string) => {
      setLoading('moveStudent', true);
      setError('moveStudent', null);

      try {
        const moveResult = await moveOrganizerStudentApi(distributionId, sourceStudentId, targetStudentId);

        setState((prev) => ({
          ...prev,
          groups: moveResult.groups,
          phase1Report: prev.phase1Report
            ? { ...prev.phase1Report, totalEnergy: moveResult.totalEnergyPhase1 }
            : prev.phase1Report,
          phase2Report:
            prev.phase2Report && moveResult.totalEnergyPhase2 !== undefined
              ? { ...prev.phase2Report, totalEnergy: moveResult.totalEnergyPhase2 }
              : prev.phase2Report,
        }));

        if (moveResult.totalEnergyPhase2 !== undefined) {
          await fetchSocialMetrics(distributionId).catch(() => null);
        }

        return moveResult;
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro ao trocar alunos';
        setError('moveStudent', errorMessage);
        throw error;
      } finally {
        setLoading('moveStudent', false);
      }
    },
    [fetchSocialMetrics, setError, setLoading]
  );

  // Configuration
  const setPhase1Config = useCallback((config: Partial<Phase1Config>) => {
    setState((prev) => ({
      ...prev,
      phase1Config: { ...prev.phase1Config, ...config },
    }));
  }, [setError]);

  const setPhase2Config = useCallback((config: Partial<Phase2Config>) => {
    setState((prev) => ({
      ...prev,
      phase2Config: { ...prev.phase2Config, ...config },
    }));
  }, []);

  const setPhase2Enabled = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      phase2Config: { ...prev.phase2Config, enabled },
    }));
  }, []);

  // Error Management
  const clearError = useCallback((operation: string) => {
    setError(operation, null);
  }, []);

  const clearAllErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: Object.keys(prev.errors).reduce(
        (acc, key) => ({ ...acc, [key]: null }),
        {}
      ),
    }));
  }, []);

  const actions = useMemo(
    () => ({
      fetchDistributions,
      createDistribution,
      loadDistribution,
      saveThemes,
      fetchStatistics,
      fetchSocialMetrics,
      startStatisticsPolling,
      stopStatisticsPolling,
      executePhase1,
      fetchGroups,
      executePhase2,
      configurePhase2,
      generateSeed,
      generateAffinities,
      markExecutionPending,
      moveStudent,
      setPhase1Config,
      setPhase2Config,
      setPhase2Enabled,
      clearError,
      clearAllErrors,
    }),
    [
      fetchDistributions,
      createDistribution,
      loadDistribution,
      saveThemes,
      fetchStatistics,
      fetchSocialMetrics,
      startStatisticsPolling,
      stopStatisticsPolling,
      executePhase1,
      fetchGroups,
      executePhase2,
      configurePhase2,
      generateSeed,
      generateAffinities,
      markExecutionPending,
      moveStudent,
      setPhase1Config,
      setPhase2Config,
      setPhase2Enabled,
      clearError,
      clearAllErrors,
    ]
  );

  const value: DistributionContextType = useMemo(
    () => ({
      ...state,
      actions,
    }),
    [state, actions]
  );

  return (
    <DistributionContext.Provider value={value}>
      {children}
    </DistributionContext.Provider>
  );
}

