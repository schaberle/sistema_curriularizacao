import axios, { AxiosError, AxiosInstance } from 'axios';
import { supabase } from './supabase';
import type {
  Distribution,
  ExecutionReport,
  Group,
  GroupMember,
  Phase1Config,
  Phase2Config,
  SeedConfig,
  SocialMetrics,
  Statistics,
  Theme,
} from '../types/distribution.types';

/**
 * API Client - Cliente HTTP para comunicação com backend
 *
 * Responsabilidades:
 * 1. Configurar cliente Axios
 * 2. Adicionar interceptadores (auth, erro)
 * 3. Fornecer métodos tipados para cada rota
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type LegacyResponse<T = any> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
};

function ensureSuccess<T>(response: LegacyResponse<T>, fallbackMessage: string): T {
  if (!response || response.success === false || !response.data) {
    throw new Error(response?.error || response?.message || fallbackMessage);
  }
  return response.data;
}

function normalizeDistribution(raw: any): Distribution {
  return {
    id: raw.id,
    organizerId: raw.organizer_id ?? raw.organizerId ?? '',
    name: raw.name,
    status: raw.status,
    phase1NeedsRerun: Boolean(raw.phase1_needs_rerun ?? raw.phase1NeedsRerun ?? false),
    phase2NeedsRerun: Boolean(raw.phase2_needs_rerun ?? raw.phase2NeedsRerun ?? false),
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? raw.updatedAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

function normalizeThemes(rawThemes: any[] = []): Theme[] {
  return rawThemes.map((theme) => ({
    id: theme.id,
    name: theme.name,
    description: theme.description ?? '',
    maxGroups: theme.max_groups ?? theme.maxGroups ?? 1,
    createdAt: theme.created_at ?? theme.createdAt,
  }));
}

function normalizeCourseBreakdown(
  raw: Array<{ course: string; count: number }> | { electrical?: number; mechanical?: number } | undefined
): { electrical: number; mechanical: number } {
  if (!raw) {
    return { electrical: 0, mechanical: 0 };
  }

  if (!Array.isArray(raw)) {
    return {
      electrical: raw.electrical ?? 0,
      mechanical: raw.mechanical ?? 0,
    };
  }

  return raw.reduce(
    (acc, item) => {
      const key = String(item.course || '').toUpperCase();
      if (key === 'EE' || key === 'ELECTRICAL') {
        acc.electrical += item.count || 0;
      } else if (key === 'ME' || key === 'MECHANICAL') {
        acc.mechanical += item.count || 0;
      }
      return acc;
    },
    { electrical: 0, mechanical: 0 }
  );
}

function normalizePhaseBreakdown(
  raw: Array<{ phase: number; count: number }> | Record<number, number> | undefined
): Record<number, number> {
  if (!raw) {
    return {};
  }

  if (!Array.isArray(raw)) {
    return raw;
  }

  return raw.reduce((acc: Record<number, number>, item) => {
    acc[item.phase] = item.count;
    return acc;
  }, {});
}

function normalizeStatistics(raw: any, distributionId: string): Statistics {
  const totalStudents = raw?.totalStudents ?? 0;
  const studentsWithPreferences = raw?.studentsWithPreferences ?? 0;
  const studentsWithAffinities = raw?.studentsWithAffinities ?? 0;

  return {
    distributionId: raw?.distributionId ?? distributionId,
    totalStudents,
    studentsWithPreferences,
    preferenceCompletionRate:
      raw?.preferenceCompletionRate ??
      (totalStudents > 0 ? (studentsWithPreferences / totalStudents) * 100 : 0),
    studentsWithAffinities,
    affinityCompletionRate:
      raw?.affinityCompletionRate ??
      (totalStudents > 0 ? (studentsWithAffinities / totalStudents) * 100 : 0),
    courseBreakdown: normalizeCourseBreakdown(raw?.courseBreakdown),
    phaseBreakdown: normalizePhaseBreakdown(raw?.phaseBreakdown),
    warnings: raw?.warnings ?? [],
    lastUpdated: raw?.lastUpdated ?? new Date().toISOString(),
  };
}

function normalizeCourse(course: string): GroupMember['course'] {
  if (course === 'ME' || course === 'MECHANICAL') {
    return 'MECHANICAL';
  }
  return 'ELECTRICAL';
}

function normalizeGroups(rawGroups: any[] = [], distributionId: string): Group[] {
  return rawGroups.map((group) => ({
    id: group.id,
    distributionId,
    themeId: group.theme?.id ?? group.themeId ?? '',
    themeName: group.theme?.name ?? group.themeName ?? 'Sem tema',
    members: (group.members ?? []).map((member: any) => ({
      id: member.id,
      name: member.name,
      course: normalizeCourse(member.course),
      phase: member.phase,
    })),
    energy: Number(group.energy ?? 0),
    socialCohesionScore: group.socialCohesionScore ?? group.social_cohesion_score,
    createdAt: group.createdAt ?? group.created_at ?? new Date().toISOString(),
    updatedAt: group.updatedAt ?? group.updated_at ?? group.createdAt ?? new Date().toISOString(),
  }));
}

function normalizeExecutionReport(
  raw: any,
  type: 'phase1' | 'phase2'
): ExecutionReport {
  const executionTimeMs = raw?.executionTimeMs ?? raw?.executionTime ?? 0;
  const now = new Date();
  const startedAt = new Date(now.getTime() - Math.max(0, executionTimeMs)).toISOString();
  const reportText = typeof raw?.report === 'string' ? raw.report : '';

  return {
    type,
    startedAt,
    completedAt: now.toISOString(),
    executionTimeMs,
    totalEnergy: raw?.totalEnergy ?? raw?.energy ?? 0,
    feasible: Boolean(raw?.feasible ?? true),
    groupsCreated: raw?.groupsCreated ?? raw?.groupsCount ?? 0,
    message: raw?.message ?? reportText ?? '',
  };
}

function normalizeSocialMetrics(raw: any, distributionId: string): SocialMetrics {
  return {
    distributionId: raw?.distributionId ?? distributionId,
    groupsCount: raw?.groupsCount ?? 0,
    groups: (raw?.groups ?? []).map((group: any) => ({
      id: group.id,
      theme: group.theme ?? 'N/A',
      students: Number(group.students ?? 0),
      socialCohesionScore: Number(group.socialCohesionScore ?? 0),
      status: group.status ?? 'Neutro',
    })),
  };
}

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptador: adicionar token JWT às requisições
    this.client.interceptors.request.use(async (config) => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        config.headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      return config;
    });

    // Interceptador: tratar erros
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expirado, logout
          await supabase.auth.signOut();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================================
  // AUTH
  // ============================================================

  async login(email: string, password: string) {
    const response = await this.client.post('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async verifyToken() {
    const response = await this.client.get('/api/auth/verify');
    return response.data;
  }

  // ============================================================
  // STUDENTS
  // ============================================================

  async registerStudent(distributionId: string, name: string, course: string, phase: number) {
    const response = await this.client.post(
      `/api/students/${distributionId}`,
      {
        name,
        course,
        phase,
      }
    );
    return response.data;
  }

  async updateStudentPreferences(studentId: string, preferences: Array<{ themeId: string; rank: number }>) {
    const response = await this.client.put(
      `/api/students/${studentId}/preferences`,
      { preferences }
    );
    return response.data;
  }

  async getStudent(studentId: string) {
    const response = await this.client.get(`/api/students/${studentId}`);
    return response.data;
  }

  async getStudentDistributionAccess(distributionId: string) {
    try {
      const response = await this.client.get(`/api/students/distribution/${distributionId}/access`);
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const message = String(error?.response?.data?.error || '').toLowerCase();
      const routeMissing =
        status === 404 &&
        (message.includes('rota não encontrada') ||
          message.includes('rota nao encontrada') ||
          message.includes('route not found'));

      // Compatibilidade com backend antigo sem endpoint de access:
      // infere um estado minimo para evitar abrir cadastro quando ja ha resultados.
      if (routeMissing) {
        let themesConfigured = false;
        let resultsAvailable = false;

        try {
          const themesResponse = await this.client.get(`/api/themes/${distributionId}`);
          const themes = themesResponse?.data?.data?.themes;
          themesConfigured = Array.isArray(themes) && themes.length > 0;
        } catch {
          // Mantem fallback conservador.
        }

        try {
          const probe = `__access_probe__${Date.now()}`;
          await this.client.get('/api/search', {
            params: { name: probe, distributionId },
          });
          resultsAvailable = true;
        } catch (searchError: any) {
          const searchStatus = searchError?.response?.status;
          if (searchStatus !== 403) {
            // Em caso de erro inesperado, mantemos a inferencia fechada.
            resultsAvailable = false;
          }
        }

        const inferredAccess = {
          distributionId,
          status: 'UNKNOWN',
          themesConfigured,
          groupsCreated: resultsAvailable,
          registrationOpen: themesConfigured && !resultsAvailable,
          resultsAvailable,
          affinitiesOpen: resultsAvailable,
          phase2Executed: false,
        };

        return {
          success: true,
          data: inferredAccess,
        };
      }

      throw error;
    }
  }

  async searchAffinityCandidates(studentId: string, query: string) {
    const response = await this.client.get(`/api/students/${studentId}/affinity-candidates`, {
      params: { q: query },
    });
    return response.data;
  }

  // ============================================================
  // THEMES (PUBLIC)
  // ============================================================

  async getThemes(distributionId: string) {
    const response = await this.client.get(
      `/api/themes/${distributionId}`
    );
    return response.data;
  }

  // ============================================================
  // SEARCH (PUBLIC)
  // ============================================================

  async searchStudent(name: string, distributionId: string) {
    const response = await this.client.get('/api/search', {
      params: {
        name,
        distributionId,
      },
    });
    return response.data;
  }

  // ============================================================
  // ORGANIZER
  // ============================================================

  async listDistributions() {
    const response = await this.client.get('/api/organizer/distributions');
    return response.data;
  }

  async createDistribution() {
    const response = await this.client.post('/api/organizer/distributions');
    return response.data;
  }

  async uploadThemes(distributionId: string, themes: Array<{ name: string; description: string; maxGroups: number }>) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/themes`,
      { themes }
    );
    return response.data;
  }

  async executeDistribution(distributionId: string) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/execute`
    );
    return response.data;
  }

  async getDistributionResults(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/results`
    );
    return response.data;
  }

  async executePhase1(distributionId: string, config?: { wPref?: number; wDup?: number; wDiv?: number }) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/execute-phase1`,
      config || {}
    );
    return response.data;
  }

  async executePhase2(
    distributionId: string,
    config?: { wSoc?: number; maxIterations?: number; temperature?: number }
  ) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/execute-phase2`,
      config || {}
    );
    return response.data;
  }

  async configureSocialOptimization(
    distributionId: string,
    config: { enabled: boolean; wSoc?: number; maxIterations?: number; temperature?: number }
  ) {
    const response = await this.client.put(
      `/api/organizer/distributions/${distributionId}/social-config`,
      config
    );
    return response.data;
  }

  async getSocialMetrics(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/social-metrics`
    );
    return response.data;
  }

  async getDistributionStatistics(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/statistics`
    );
    return response.data;
  }

  async seedDistribution(
    distributionId: string,
    config?: {
      studentCount?: number;
      generatePreferences?: boolean;
      generateAffinities?: boolean;
      affinityDensity?: number;
    }
  ) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/seed`,
      config || {}
    );
    return response.data;
  }

  async seedAffinities(
    distributionId: string,
    config?: { affinityDensity?: number }
  ) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/seed-affinities`,
      config || {}
    );
    return response.data;
  }

  async getDistributionGroups(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/groups`
    );
    return response.data;
  }

  async markExecutionPending(distributionId: string, scope: 'phase1' | 'phase2') {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/execution-pending`,
      { scope }
    );
    return response.data;
  }

  // ============================================================
  // STUDENTS - AFFINITY (PHASE 2)
  // ============================================================

  async getStudentCurrentGroup(studentId: string) {
    const response = await this.client.get(
      `/api/students/${studentId}/current-group`
    );
    return response.data;
  }

  async getStudentAffinities(studentId: string) {
    const response = await this.client.get(
      `/api/students/${studentId}/affinities`
    );
    return response.data;
  }

  async submitStudentAffinities(
    studentId: string,
    affinities: Array<{ targetStudentId: string; value: number }>
  ) {
    const response = await this.client.put(
      `/api/students/${studentId}/affinities`,
      { affinities }
    );
    return response.data;
  }

  // ============================================================
  // HEALTH
  // ============================================================

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch {
      return null;
    }
  }
}

const api = new APIClient();

// ============================================================
// Named exports for wizard flow (normalized contracts)
// ============================================================

export async function listDistributions(): Promise<Distribution[]> {
  const response = (await api.listDistributions()) as LegacyResponse<{ distributions: any[] }>;
  const data = ensureSuccess(response, 'Falha ao listar distribuições');
  return (data.distributions ?? []).map(normalizeDistribution);
}

export async function createDistribution(): Promise<string> {
  const response = (await api.createDistribution()) as LegacyResponse<{ distributionId: string }>;
  const data = ensureSuccess(response, 'Falha ao criar distribuição');
  return data.distributionId;
}

export async function getDistribution(distributionId: string): Promise<{
  distribution: Distribution;
  themes: Theme[];
  statistics: Statistics | null;
  groups: Group[] | null;
}> {
  const distributions = await listDistributions();
  const distribution = distributions.find((item) => item.id === distributionId);
  if (!distribution) {
    throw new Error('Distribuicao nao encontrada');
  }

  const [themesResult, statisticsResult, groupsResult] = await Promise.allSettled([
    api.getThemes(distributionId),
    api.getDistributionStatistics(distributionId),
    api.getDistributionGroups(distributionId),
  ]);

  const themes =
    themesResult.status === 'fulfilled'
      ? normalizeThemes(
          ensureSuccess(themesResult.value as LegacyResponse<{ themes: any[] }>, 'Falha ao carregar temas').themes ?? []
        )
      : [];

  const statistics =
    statisticsResult.status === 'fulfilled'
      ? normalizeStatistics(
          ensureSuccess(
            statisticsResult.value as LegacyResponse<any>,
            'Falha ao carregar estatísticas'
          ),
          distributionId
        )
      : null;

  const groups =
    groupsResult.status === 'fulfilled'
      ? normalizeGroups(
          ensureSuccess(groupsResult.value as LegacyResponse<{ groups: any[] }>, 'Falha ao carregar grupos').groups ??
            [],
          distributionId
        )
      : null;

  return { distribution, themes, statistics, groups };
}

export async function uploadThemes(distributionId: string, themes: Theme[]): Promise<Theme[]> {
  const payload = themes.map((theme) => ({
    name: theme.name,
    description: theme.description ?? '',
    maxGroups: theme.maxGroups ?? 1,
  }));

  const response = (await api.uploadThemes(distributionId, payload)) as LegacyResponse;
  ensureSuccess(response, 'Falha ao salvar temas');

  const themesResponse = (await api.getThemes(distributionId)) as LegacyResponse<{ themes: any[] }>;
  const themesData = ensureSuccess(themesResponse, 'Falha ao carregar temas salvos');
  return normalizeThemes(themesData.themes ?? []);
}

export async function getDistributionStatistics(distributionId: string): Promise<Statistics> {
  const response = (await api.getDistributionStatistics(distributionId)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao carregar estatísticas');
  return normalizeStatistics(data, distributionId);
}

export async function executePhase1(
  distributionId: string,
  config?: Partial<Phase1Config>
): Promise<ExecutionReport> {
  const response = (await api.executePhase1(distributionId, config)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao executar Fase 1');
  return normalizeExecutionReport(data, 'phase1');
}

export async function getDistributionGroups(distributionId: string): Promise<Group[]> {
  const response = (await api.getDistributionGroups(distributionId)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao carregar grupos');
  return normalizeGroups(data.groups ?? [], distributionId);
}

export async function executePhase2(
  distributionId: string,
  config?: Partial<Phase2Config>
): Promise<ExecutionReport> {
  const response = (await api.executePhase2(distributionId, config)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao executar Fase 2');
  return normalizeExecutionReport(data, 'phase2');
}

export async function configureSocialOptimization(
  distributionId: string,
  config: Partial<Phase2Config> & { enabled: boolean }
): Promise<void> {
  const response = (await api.configureSocialOptimization(distributionId, config)) as LegacyResponse;
  ensureSuccess(response, 'Falha ao configurar Fase 2');
}

export async function markExecutionPending(
  distributionId: string,
  scope: 'phase1' | 'phase2'
): Promise<{ distributionId: string; phase1NeedsRerun: boolean; phase2NeedsRerun: boolean }> {
  const response = (await api.markExecutionPending(distributionId, scope)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao marcar pendencia de execucao');
  return {
    distributionId: data.distributionId ?? distributionId,
    phase1NeedsRerun: Boolean(data.phase1NeedsRerun),
    phase2NeedsRerun: Boolean(data.phase2NeedsRerun),
  };
}

export async function getSocialMetrics(distributionId: string): Promise<SocialMetrics> {
  const response = (await api.getSocialMetrics(distributionId)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao carregar metricas sociais');
  return normalizeSocialMetrics(data, distributionId);
}

export async function seedDistribution(
  distributionId: string,
  config: SeedConfig
): Promise<void> {
  const response = (await api.seedDistribution(distributionId, config)) as LegacyResponse;
  ensureSuccess(response, 'Falha ao gerar dados de teste');
}

export async function seedAffinities(distributionId: string, density: number): Promise<void> {
  const response = (await api.seedAffinities(distributionId, { affinityDensity: density })) as LegacyResponse;
  ensureSuccess(response, 'Falha ao gerar afinidades');
}

export default api;
