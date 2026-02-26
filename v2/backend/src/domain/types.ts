/**
 * Domain Types
 * Enums e interfaces base para todo o sistema
 */

// ========================================
// Enums
// ========================================

/**
 * Enum para cursos disponíveis
 */
export enum Course {
  ELECTRICAL_ENGINEERING = 'EE',  // Engenharia Elétrica
  MECHANICAL_ENGINEERING = 'ME'   // Engenharia Mecânica
}

/**
 * Enum para fases do curso (1-10)
 */
export enum Phase {
  PHASE_1 = 1,
  PHASE_2 = 2,
  PHASE_3 = 3,
  PHASE_4 = 4,
  PHASE_5 = 5,
  PHASE_6 = 6,
  PHASE_7 = 7,
  PHASE_8 = 8,
  PHASE_9 = 9,
  PHASE_10 = 10
}

/**
 * Status de uma distribuição
 */
export enum DistributionStatus {
  PENDING = 'pending',      // Aguardando execução
  RUNNING = 'running',      // Em execução
  COMPLETED = 'completed',  // Concluída
  FAILED = 'failed'         // Falhou
}

// ========================================
// Interfaces
// ========================================

/**
 * Preferência de um aluno por um tema
 */
export interface ThemePreference {
  themeId: string;
  rank: number;              // 1 = mais preferido, N = menos preferido
  score?: number;            // Calculado: 1000 / (rank + 1), maior = melhor
}

/**
 * Composição de um grupo (análise)
 */
export interface GroupComposition {
  electricalCount: number;   // Quantidade de alunos de Eng. Elétrica
  mechanicalCount: number;   // Quantidade de alunos de Eng. Mecânica
  phases: Set<Phase>;        // Fases distintas no grupo
}

/**
 * Violação de restrição
 */
export interface ConstraintViolation {
  type: 'ELECTRICAL_COMPOSITION' | 'PHASE_DIVERSITY' | 'PHASE_UNIQUENESS' | 'OTHER';
  severity: 'CRITICAL' | 'IMPORTANT' | 'DESIRABLE';
  message: string;
  affectedGroupId?: string;
  details?: Record<string, unknown>;
}

/**
 * Dados de um aluno (do banco de dados)
 */
export interface StudentData {
  id: string;                // UUID do aluno
  name: string;
  course: Course;
  phase: Phase;
  created_at: string;
  updated_at: string;
}

/**
 * Dados de uma preferência (do banco de dados)
 */
export interface PreferenceData {
  id: string;
  student_id: string;
  theme_id: string;
  rank: number;
  created_at: string;
  updated_at: string;
}

/**
 * Dados de um tema (do banco de dados)
 */
export interface ThemeData {
  id: string;
  distribution_id: string;
  name: string;
  description?: string;
  group_proportion?: number;
  max_groups?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Dados de um grupo (do banco de dados)
 */
export interface GroupData {
  id: string;
  distribution_id: string;
  theme_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Dados de um aluno em um grupo (junction table)
 */
export interface GroupStudentData {
  id: string;
  group_id: string;
  student_id: string;
  created_at: string;
}

/**
 * Dados de uma distribuição (do banco de dados)
 */
export interface DistributionData {
  id: string;
  organizer_id: string;
  status: DistributionStatus;
  created_at: string;
  executed_at?: string;
  completed_at?: string;
  total_score?: number;
  is_feasible: boolean;
  error_message?: string;
}

/**
 * Organizador (do banco de dados)
 */
export interface OrganizerData {
  id: string;
  email: string;
  password_hash: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

// ========================================
// Type Guards
// ========================================

/**
 * Verifica se um valor é um Course válido
 */
export function isCourse(value: unknown): value is Course {
  return value === Course.ELECTRICAL_ENGINEERING || value === Course.MECHANICAL_ENGINEERING;
}

/**
 * Verifica se um valor é uma Phase válida
 */
export function isPhase(value: unknown): value is Phase {
  return typeof value === 'number' && value >= 1 && value <= 10;
}

/**
 * Verifica se um valor é um DistributionStatus válido
 */
export function isDistributionStatus(value: unknown): value is DistributionStatus {
  return (
    value === DistributionStatus.PENDING ||
    value === DistributionStatus.RUNNING ||
    value === DistributionStatus.COMPLETED ||
    value === DistributionStatus.FAILED
  );
}

// ========================================
// Constantes de Configuração
// ========================================

/**
 * Tamanho padrão de um grupo
 */
export const GROUP_SIZE = 4;

/**
 * Número de fases disponíveis
 */
export const TOTAL_PHASES = 10;

/**
 * Todos os enums de Phase como array
 */
export const ALL_PHASES: Phase[] = [
  Phase.PHASE_1, Phase.PHASE_2, Phase.PHASE_3, Phase.PHASE_4, Phase.PHASE_5,
  Phase.PHASE_6, Phase.PHASE_7, Phase.PHASE_8, Phase.PHASE_9, Phase.PHASE_10
];

/**
 * Todos os enums de Course como array
 */
export const ALL_COURSES: Course[] = [
  Course.ELECTRICAL_ENGINEERING,
  Course.MECHANICAL_ENGINEERING
];
