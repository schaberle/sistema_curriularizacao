/**
 * Distribution Management Types
 * Core domain types for the distribution wizard workflow
 */

export interface Distribution {
  id: string;
  organizerId: string;
  name?: string;
  status: DistributionStatus;
  phase1NeedsRerun: boolean;
  phase2NeedsRerun: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DistributionStatus =
  | 'PENDING'        // Criada, aguardando temas
  | 'THEMED'         // Temas configurados
  | 'COLLECTING'     // Coletando dados de alunos
  | 'EXECUTING'      // Executando Fase 1
  | 'COMPLETED'      // Fase 1 completa
  | 'PARTIAL'        // Parcialmente concluída
  | 'FAILED'         // Execução falhou
  | 'PHASE2'         // Coletando afinidades para Fase 2
  | 'PHASE2_EXECUTING' // Executando Fase 2
  | 'PHASE2_COMPLETED'; // Fase 2 completa

export interface Theme {
  id?: string;
  name: string;
  description?: string;
  maxGroups?: number;
  createdAt?: string;
}

export interface Statistics {
  distributionId: string;
  totalStudents: number;
  studentsWithPreferences: number;
  preferenceCompletionRate: number; // percentage 0-100
  studentsWithAffinities: number;
  affinityCompletionRate: number; // percentage 0-100
  courseBreakdown: {
    electrical: number;
    mechanical: number;
  };
  phaseBreakdown: Record<number, number>; // { 1: 15, 2: 20, ... }
  warnings: string[];
  lastUpdated: string;
}

export interface Phase1Config {
  wPref: number;    // Weight for preferences (default: 1.0)
  wDup: number;     // Weight for phase duplicates (default: 0.9)
  wDiv: number;     // Weight for phase diversity (default: 0.35)
}

export interface Phase2Config {
  enabled: boolean;
  wSoc: number;                // Weight for social cohesion (default: 1.0)
  maxIterations: number;       // Max iterations for optimization (default: 20000)
  temperature: number;         // Temperature for simulated annealing (default: 0.8)
}

export interface ExecutionReport {
  type: 'phase1' | 'phase2';
  startedAt: string;
  completedAt: string;
  executionTimeMs: number;
  totalEnergy: number;
  feasible: boolean;
  groupsCreated: number;
  message: string;
}

export interface SocialMetricGroup {
  id: string;
  theme: string;
  students: number;
  socialCohesionScore: number;
  status: string;
}

export interface SocialMetrics {
  distributionId: string;
  groupsCount: number;
  groups: SocialMetricGroup[];
}

export interface Group {
  id: string;
  distributionId: string;
  themeId: string;
  themeName: string;
  members: GroupMember[];
  energy: number;
  socialCohesionScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  name: string;
  email?: string;
  course: 'ELECTRICAL' | 'MECHANICAL';
  phase: number;
  preferencePosition?: number;
  socialScore?: number;
}

export interface SeedConfig {
  studentCount: number;
  generatePreferences: boolean;
  generateAffinities: boolean;
  affinityDensity?: number; // 0.0-1.0, proportion of pairs with affinity
}

export interface DistributionContextState {
  distributions: Distribution[];
  currentDistribution: Distribution | null;
  themes: Theme[];
  statistics: Statistics | null;
  groups: Group[] | null;
  socialMetrics: SocialMetrics | null;
  phase1Report: ExecutionReport | null;
  phase2Report: ExecutionReport | null;
  phase1Config: Phase1Config;
  phase2Config: Phase2Config;

  // UI State
  loading: {
    [key: string]: boolean;
    fetchDistributions: boolean;
    createDistribution: boolean;
    loadDistribution: boolean;
    saveThemes: boolean;
    fetchStatistics: boolean;
    configurePhase2: boolean;
    fetchSocialMetrics: boolean;
    executePhase1: boolean;
    executePhase2: boolean;
    fetchGroups: boolean;
    generateSeed: boolean;
    generateAffinities: boolean;
    markExecutionPending: boolean;
  };

  errors: {
    [key: string]: string | null;
    fetchDistributions: string | null;
    createDistribution: string | null;
    loadDistribution: string | null;
    saveThemes: string | null;
    fetchStatistics: string | null;
    configurePhase2: string | null;
    fetchSocialMetrics: string | null;
    executePhase1: string | null;
    executePhase2: string | null;
    fetchGroups: string | null;
    generateSeed: string | null;
    generateAffinities: string | null;
    markExecutionPending: string | null;
  };
}

export interface DistributionContextActions {
  // Distribution Management
  fetchDistributions: () => Promise<Distribution[]>;
  createDistribution: () => Promise<string>; // Returns distributionId
  loadDistribution: (id: string) => Promise<void>;

  // Theme Management
  saveThemes: (distributionId: string, themes: Theme[]) => Promise<void>;

  // Statistics
  fetchStatistics: (distributionId: string) => Promise<Statistics>;
  fetchSocialMetrics: (distributionId: string) => Promise<SocialMetrics>;
  startStatisticsPolling: (distributionId: string, intervalMs?: number) => void;
  stopStatisticsPolling: () => void;

  // Phase 1
  executePhase1: (
    distributionId: string,
    config?: Partial<Phase1Config>
  ) => Promise<ExecutionReport>;
  fetchGroups: (distributionId: string) => Promise<Group[]>;

  // Phase 2
  executePhase2: (
    distributionId: string,
    config?: Partial<Phase2Config>
  ) => Promise<ExecutionReport>;
  configurePhase2: (
    distributionId: string,
    config: Partial<Phase2Config> & { enabled: boolean }
  ) => Promise<void>;

  // Seed Data
  generateSeed: (distributionId: string, config: SeedConfig) => Promise<void>;
  generateAffinities: (
    distributionId: string,
    density: number
  ) => Promise<void>;

  // Configuration
  setPhase1Config: (config: Partial<Phase1Config>) => void;
  setPhase2Config: (config: Partial<Phase2Config>) => void;
  setPhase2Enabled: (enabled: boolean) => void;
  markExecutionPending: (distributionId: string, scope: 'phase1' | 'phase2') => Promise<void>;

  // Error Management
  clearError: (operation: string) => void;
  clearAllErrors: () => void;
}

export interface DistributionContextType extends DistributionContextState {
  actions: DistributionContextActions;
}

// Default values
export const DEFAULT_PHASE1_CONFIG: Phase1Config = {
  wPref: 1.0,
  wDup: 0.9,
  wDiv: 0.35,
};

export const DEFAULT_PHASE2_CONFIG: Phase2Config = {
  enabled: false,
  wSoc: 1.0,
  maxIterations: 20000,
  temperature: 0.8,
};

export const DEFAULT_SEED_CONFIG: SeedConfig = {
  studentCount: 133,
  generatePreferences: true,
  generateAffinities: false,
  affinityDensity: 0.13,
};

// Validation types (for Phase 1 Configuration)
export interface ValidationCheck {
  id: string;
  label: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  severity: 'critical' | 'recommended';
}

export interface ValidationResult {
  status: 'pass' | 'warning' | 'fail';
  checks: ValidationCheck[];
  canProceed: boolean;
}
