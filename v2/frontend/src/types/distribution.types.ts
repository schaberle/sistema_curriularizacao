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
  groupProportion?: number;
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
  studentPreferenceStatuses: {
    id: string;
    name: string;
    hasSubmittedPreferences: boolean;
  }[];
  warnings: string[];
  lastUpdated: string;
}

export interface OrganizerStudentSearchCandidate {
  id: string;
  name: string;
  course: 'EE' | 'ME';
  phase: number;
}

export interface OrganizerStudentRemovalResult {
  distributionId: string;
  studentId: string;
  registryDeactivated: boolean;
  operationalStudentRemoved: boolean;
  phase1NeedsRerun: boolean;
  phase2NeedsRerun: boolean;
}

export interface OrganizerManualStudentMoveResult {
  distributionId: string;
  sourceStudentId: string;
  targetStudentId: string;
  sourceGroupId: string;
  targetGroupId: string;
  swapViable: boolean;
  viabilityMessage?: string;
  totalEnergyPhase1: number;
  totalEnergyPhase2?: number;
  groups: Group[];
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

export interface SimulationGroupMember {
  id: string;
  name: string;
  course: 'ELECTRICAL' | 'MECHANICAL';
  phase: number;
  rankPosition: number;
  isolationScore?: number;
}

export interface SimulationGroupMetrics {
  id: string;
  themeId: string;
  themeName: string;
  energyPhase1: number;
  energyPhase2?: number;
  socialCohesionScore: number;
  members: SimulationGroupMember[];
}

export interface SimulationMetrics {
  totals: {
    totalEnergyPhase1: number;
    totalEnergyPhase2?: number;
    averageGroupEnergyPhase1: number;
    averageGroupEnergyPhase2?: number;
    groupsCount: number;
    allocatedStudents: number;
  };
  preferenceMetrics: {
    top1: number;
    top2: number;
    top3: number;
    avgRank: number;
  };
  socialMetrics: {
    avgCohesion: number;
    swapsAccepted: number;
    stabilityPercent: number;
    isolatedStudentsCount: number;
  };
  audit: {
    electricalPerGroup: Array<{
      groupId: string;
      electricalCount: number;
      mechanicalCount: number;
    }>;
    distinctPhasesPerGroup: Array<{
      groupId: string;
      distinctPhases: number;
      phases: number[];
    }>;
    themeProportionUsage: Array<{
      themeId: string;
      themeName: string;
      weight: number;
      target: number;
      min: number;
      max: number;
      used: number;
      deviation: number;
      withinRange: boolean;
    }>;
  };
  groups: SimulationGroupMetrics[];
}

export interface SimulationExecutionReport {
  distributionId: string;
  phase: 'PHASE1_COMPLETED' | 'PHASE2_COMPLETED';
  executionTime: number;
  report: string;
  groupsCount?: number;
  metrics?: SimulationMetrics;
  before?: SimulationMetrics;
  after?: SimulationMetrics;
  changes?: Array<{
    studentId: string;
    studentName: string;
    fromGroupId: string;
    toGroupId: string;
    fromThemeId: string;
    toThemeId: string;
  }>;
  socialExecution?: {
    attemptedSwaps: number;
    swapsAccepted: number;
    stabilityPercent: number;
  };
}

export interface SimulationPoint3D {
  studentId: string;
  name: string;
  course: 'ELECTRICAL' | 'MECHANICAL';
  phase: number;
  x: number;
  y: number;
  z: number;
  groupId?: string;
}

export interface VisualStudentNode {
  id: string;
  name: string;
  course: 'ELECTRICAL' | 'MECHANICAL';
  phase: number;
  utilities: number[];
}

export interface VisualGroupPartitionGroup {
  groupId: string;
  themeId: string;
  themeName: string;
  studentIds: string[];
}

export interface VisualGroupPartition {
  groups: VisualGroupPartitionGroup[];
  assignmentByStudentId: Record<string, string | null>;
}

export interface VisualAffinityEdge {
  sourceId: string;
  targetId: string;
  value: number;
}

export type VisualIsolationMap = Record<string, number>;

export interface SimulationVisualState {
  distributionId: string;
  themes: Array<{
    id: string;
    name: string;
    index: number;
  }>;
  students: VisualStudentNode[];
  partition: VisualGroupPartition;
  affinities: VisualAffinityEdge[];
  isolationScoreByStudentId?: VisualIsolationMap;
  updatedAt: string;
}

export interface SimulationRun {
  runId: string;
  distributionId: string;
  phase: 'phase1' | 'phase2';
  axisThemeIds: [string, string, string];
  startedAt: string;
  initialPositions?: SimulationPoint3D[];
}

export interface SimulationRunSnapshot {
  runId: string;
  phase: 'phase1' | 'phase2';
  stage: 'initial' | 'local_search' | 'annealing' | 'social_optimizer';
  iteration: number;
  acceptedSwaps: number;
  temperature?: number;
  energy: number;
  positions: SimulationPoint3D[];
  emittedAt: string;
}

export interface SimulationRunCompleted {
  runId: string;
  distributionId: string;
  phase: 'phase1' | 'phase2';
  executionTime: number;
  axisThemeIds: [string, string, string];
  metrics?: SimulationMetrics;
  before?: SimulationMetrics;
  after?: SimulationMetrics;
  groups?: SimulationGroupMetrics[];
  changes?: Array<{
    studentId: string;
    studentName: string;
    fromGroupId: string;
    toGroupId: string;
    fromThemeId: string;
    toThemeId: string;
  }>;
  socialExecution?: {
    attemptedSwaps: number;
    swapsAccepted: number;
    stabilityPercent: number;
  };
  finalPositions: SimulationPoint3D[];
  completedAt: string;
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
    moveStudent: boolean;
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
    moveStudent: string | null;
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
  moveStudent: (
    distributionId: string,
    sourceStudentId: string,
    targetStudentId: string
  ) => Promise<OrganizerManualStudentMoveResult>;

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
