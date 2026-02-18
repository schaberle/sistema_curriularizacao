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
  SimulationPoint3D,
  SimulationRun,
  SimulationRunCompleted,
  SimulationRunSnapshot,
  SimulationExecutionReport,
  SimulationGroupMetrics,
  SimulationMetrics,
  SimulationVisualState,
  SocialMetrics,
  Statistics,
  Theme,
  VisualAffinityEdge,
  VisualGroupPartition,
  VisualStudentNode,
} from '../types/distribution.types';

/**
 * API Client - Cliente HTTP para comunicaÃ§Ã£o com backend
 *
 * Responsabilidades:
 * 1. Configurar cliente Axios
 * 2. Adicionar interceptadores (auth, erro)
 * 3. Fornecer mÃ©todos tipados para cada rota
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4300';

type StudentSessionState = {
  accessToken: string;
  studentId: string;
  distributionId: string;
  expiresAtMs: number;
};

let studentSessionState: StudentSessionState | null = null;

function readCookie(name: string): string {
  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const normalized = part.trim();
    if (normalized.startsWith(encodedName)) {
      return decodeURIComponent(normalized.slice(encodedName.length));
    }
  }
  return '';
}

function setStudentSessionState(next: StudentSessionState | null): void {
  studentSessionState = next;
}

function loadStudentSessionState(): StudentSessionState | null {
  if (!studentSessionState) {
    return null;
  }

  if (Date.now() >= Number(studentSessionState.expiresAtMs)) {
    setStudentSessionState(null);
    return null;
  }

  return studentSessionState;
}

function decodeStudentClaims(accessToken: string): {
  studentId: string;
  distributionId: string;
} | null {
  try {
    const payloadBase64 = accessToken.split('.')[1];
    if (!payloadBase64) {
      return null;
    }

    const payloadRaw = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadRaw) as {
      student_id?: string;
      distribution_id?: string;
    };

    if (!payload.student_id || !payload.distribution_id) {
      return null;
    }

    return {
      studentId: payload.student_id,
      distributionId: payload.distribution_id,
    };
  } catch {
    setStudentSessionState(null);
    return null;
  }
}

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

function normalizeSimulationMemberCourse(course: string): 'ELECTRICAL' | 'MECHANICAL' {
  if (course === 'ME' || course === 'MECHANICAL') {
    return 'MECHANICAL';
  }
  return 'ELECTRICAL';
}

function normalizeSimulationGroups(rawGroups: any[] = []): SimulationGroupMetrics[] {
  return rawGroups.map((group) => ({
    id: String(group?.id ?? ''),
    themeId: String(group?.themeId ?? ''),
    themeName: String(group?.themeName ?? 'Sem tema'),
    energyPhase1: Number(group?.energyPhase1 ?? 0),
    energyPhase2: group?.energyPhase2 !== undefined ? Number(group.energyPhase2) : undefined,
    socialCohesionScore: Number(group?.socialCohesionScore ?? 0),
    members: (group?.members ?? []).map((member: any) => ({
      id: String(member?.id ?? ''),
      name: String(member?.name ?? ''),
      course: normalizeSimulationMemberCourse(String(member?.course ?? 'EE')),
      phase: Number(member?.phase ?? 0),
      rankPosition: Number(member?.rankPosition ?? 0),
      isolationScore: member?.isolationScore !== undefined ? Number(member.isolationScore) : undefined,
    })),
  }));
}

function normalizeSimulationMetrics(raw: any): SimulationMetrics {
  return {
    totals: {
      totalEnergyPhase1: Number(raw?.totals?.totalEnergyPhase1 ?? 0),
      totalEnergyPhase2: raw?.totals?.totalEnergyPhase2 !== undefined
        ? Number(raw.totals.totalEnergyPhase2)
        : undefined,
      averageGroupEnergyPhase1: Number(raw?.totals?.averageGroupEnergyPhase1 ?? 0),
      averageGroupEnergyPhase2: raw?.totals?.averageGroupEnergyPhase2 !== undefined
        ? Number(raw.totals.averageGroupEnergyPhase2)
        : undefined,
      groupsCount: Number(raw?.totals?.groupsCount ?? 0),
      allocatedStudents: Number(raw?.totals?.allocatedStudents ?? 0),
    },
    preferenceMetrics: {
      top1: Number(raw?.preferenceMetrics?.top1 ?? 0),
      top2: Number(raw?.preferenceMetrics?.top2 ?? 0),
      top3: Number(raw?.preferenceMetrics?.top3 ?? 0),
      avgRank: Number(raw?.preferenceMetrics?.avgRank ?? 0),
    },
    socialMetrics: {
      avgCohesion: Number(raw?.socialMetrics?.avgCohesion ?? 0),
      swapsAccepted: Number(raw?.socialMetrics?.swapsAccepted ?? 0),
      stabilityPercent: Number(raw?.socialMetrics?.stabilityPercent ?? 100),
      isolatedStudentsCount: Number(raw?.socialMetrics?.isolatedStudentsCount ?? 0),
    },
    audit: {
      electricalPerGroup: raw?.audit?.electricalPerGroup ?? [],
      distinctPhasesPerGroup: raw?.audit?.distinctPhasesPerGroup ?? [],
      themeCapacityUsage: raw?.audit?.themeCapacityUsage ?? [],
    },
    groups: normalizeSimulationGroups(raw?.groups ?? []),
  };
}

function normalizeSimulationExecutionReport(raw: any, distributionId: string): SimulationExecutionReport {
  return {
    distributionId: raw?.distributionId ?? distributionId,
    phase: raw?.phase ?? 'PHASE1_COMPLETED',
    executionTime: Number(raw?.executionTime ?? 0),
    report: String(raw?.report ?? ''),
    groupsCount: raw?.groupsCount !== undefined ? Number(raw.groupsCount) : undefined,
    metrics: raw?.metrics ? normalizeSimulationMetrics(raw.metrics) : undefined,
    before: raw?.before ? normalizeSimulationMetrics(raw.before) : undefined,
    after: raw?.after ? normalizeSimulationMetrics(raw.after) : undefined,
    changes: Array.isArray(raw?.changes) ? raw.changes : [],
    socialExecution: raw?.socialExecution
      ? {
          attemptedSwaps: Number(raw.socialExecution.attemptedSwaps ?? 0),
          swapsAccepted: Number(raw.socialExecution.swapsAccepted ?? 0),
          stabilityPercent: Number(raw.socialExecution.stabilityPercent ?? 100),
        }
      : undefined,
  };
}

function normalizeSimulationPoint3D(raw: any): SimulationPoint3D {
  return {
    studentId: String(raw?.studentId ?? ''),
    name: String(raw?.name ?? ''),
    course: normalizeSimulationMemberCourse(String(raw?.course ?? 'EE')),
    phase: Number(raw?.phase ?? 0),
    x: Number(raw?.x ?? 0),
    y: Number(raw?.y ?? 0),
    z: Number(raw?.z ?? 0),
    groupId: raw?.groupId ? String(raw.groupId) : undefined,
  };
}

function normalizeVisualStudentNode(raw: any): VisualStudentNode {
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? ''),
    course: normalizeSimulationMemberCourse(String(raw?.course ?? 'EE')),
    phase: Number(raw?.phase ?? 0),
    utilities: Array.isArray(raw?.utilities)
      ? raw.utilities.map((value: any) => Number(value ?? 0))
      : [],
  };
}

function normalizeVisualAffinityEdge(raw: any): VisualAffinityEdge {
  return {
    sourceId: String(raw?.sourceId ?? ''),
    targetId: String(raw?.targetId ?? ''),
    value: Number(raw?.value ?? 0),
  };
}

function normalizeVisualGroupPartition(raw: any): VisualGroupPartition {
  const assignmentByStudentId = raw?.assignmentByStudentId && typeof raw.assignmentByStudentId === 'object'
    ? Object.entries(raw.assignmentByStudentId).reduce<Record<string, string | null>>((acc, [studentId, groupId]) => {
        acc[String(studentId)] = groupId ? String(groupId) : null;
        return acc;
      }, {})
    : {};

  return {
    groups: Array.isArray(raw?.groups)
      ? raw.groups.map((group: any) => ({
          groupId: String(group?.groupId ?? ''),
          themeId: String(group?.themeId ?? ''),
          themeName: String(group?.themeName ?? 'Sem tema'),
          studentIds: Array.isArray(group?.studentIds)
            ? group.studentIds.map((studentId: any) => String(studentId))
            : [],
        }))
      : [],
    assignmentByStudentId,
  };
}

function normalizeSimulationVisualState(raw: any, distributionId: string): SimulationVisualState {
  const isolationScoreByStudentId = raw?.isolationScoreByStudentId && typeof raw.isolationScoreByStudentId === 'object'
    ? Object.entries(raw.isolationScoreByStudentId).reduce<Record<string, number>>((acc, [studentId, score]) => {
        acc[String(studentId)] = Number(score ?? 0);
        return acc;
      }, {})
    : undefined;

  return {
    distributionId: String(raw?.distributionId ?? distributionId),
    themes: Array.isArray(raw?.themes)
      ? raw.themes.map((theme: any, index: number) => ({
          id: String(theme?.id ?? ''),
          name: String(theme?.name ?? 'Tema'),
          index: Number(theme?.index ?? index),
        }))
      : [],
    students: Array.isArray(raw?.students)
      ? raw.students.map(normalizeVisualStudentNode)
      : [],
    partition: normalizeVisualGroupPartition(raw?.partition),
    affinities: Array.isArray(raw?.affinities)
      ? raw.affinities.map(normalizeVisualAffinityEdge)
      : [],
    isolationScoreByStudentId,
    updatedAt: String(raw?.updatedAt ?? new Date().toISOString()),
  };
}

function normalizeSimulationRun(raw: any, distributionId: string): SimulationRun {
  const axisThemeIdsRaw = Array.isArray(raw?.axisThemeIds) ? raw.axisThemeIds : [];
  const axisThemeIds: [string, string, string] = [
    String(axisThemeIdsRaw[0] ?? 'x'),
    String(axisThemeIdsRaw[1] ?? 'y'),
    String(axisThemeIdsRaw[2] ?? 'z'),
  ];

  return {
    runId: String(raw?.runId ?? ''),
    distributionId: String(raw?.distributionId ?? distributionId),
    phase: String(raw?.phase ?? 'phase1') === 'phase2' ? 'phase2' : 'phase1',
    axisThemeIds,
    startedAt: String(raw?.startedAt ?? new Date().toISOString()),
    initialPositions: Array.isArray(raw?.initialPositions)
      ? raw.initialPositions.map(normalizeSimulationPoint3D)
      : undefined,
  };
}

function normalizeSimulationRunSnapshot(raw: any): SimulationRunSnapshot {
  return {
    runId: String(raw?.runId ?? ''),
    phase: String(raw?.phase ?? 'phase1') === 'phase2' ? 'phase2' : 'phase1',
    stage: (
      ['initial', 'local_search', 'annealing', 'social_optimizer'].includes(String(raw?.stage))
        ? raw.stage
        : 'initial'
    ) as SimulationRunSnapshot['stage'],
    iteration: Number(raw?.iteration ?? 0),
    acceptedSwaps: Number(raw?.acceptedSwaps ?? 0),
    temperature: raw?.temperature !== undefined ? Number(raw.temperature) : undefined,
    energy: Number(raw?.energy ?? 0),
    positions: Array.isArray(raw?.positions) ? raw.positions.map(normalizeSimulationPoint3D) : [],
    emittedAt: String(raw?.emittedAt ?? new Date().toISOString()),
  };
}

function normalizeSimulationRunCompleted(raw: any): SimulationRunCompleted {
  const axisThemeIdsRaw = Array.isArray(raw?.axisThemeIds) ? raw.axisThemeIds : [];
  const axisThemeIds: [string, string, string] = [
    String(axisThemeIdsRaw[0] ?? 'x'),
    String(axisThemeIdsRaw[1] ?? 'y'),
    String(axisThemeIdsRaw[2] ?? 'z'),
  ];

  return {
    runId: String(raw?.runId ?? ''),
    distributionId: String(raw?.distributionId ?? ''),
    phase: String(raw?.phase ?? 'phase1') === 'phase2' ? 'phase2' : 'phase1',
    executionTime: Number(raw?.executionTime ?? 0),
    axisThemeIds,
    metrics: raw?.metrics ? normalizeSimulationMetrics(raw.metrics) : undefined,
    before: raw?.before ? normalizeSimulationMetrics(raw.before) : undefined,
    after: raw?.after ? normalizeSimulationMetrics(raw.after) : undefined,
    groups: Array.isArray(raw?.groups) ? normalizeSimulationGroups(raw.groups) : undefined,
    changes: Array.isArray(raw?.changes) ? raw.changes : [],
    socialExecution: raw?.socialExecution
      ? {
          attemptedSwaps: Number(raw.socialExecution.attemptedSwaps ?? 0),
          swapsAccepted: Number(raw.socialExecution.swapsAccepted ?? 0),
          stabilityPercent: Number(raw.socialExecution.stabilityPercent ?? 100),
        }
      : undefined,
    finalPositions: Array.isArray(raw?.finalPositions)
      ? raw.finalPositions.map(normalizeSimulationPoint3D)
      : [],
    completedAt: String(raw?.completedAt ?? new Date().toISOString()),
  };
}

class APIClient {
  private client: AxiosInstance;
  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptador: token de organizador (Supabase) ou token de aluno (sessao local).
    this.client.interceptors.request.use(async (config) => {
      const isStudentRequest = Boolean((config as any)?.meta?.studentAuth);

      if (isStudentRequest) {
        let studentSession = loadStudentSessionState();
        if (!studentSession) {
          await this.refreshStudentSession();
          studentSession = loadStudentSessionState();
        }

        if (studentSession?.accessToken) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${studentSession.accessToken}`;
        }
        return config;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      return config;
    });

    // Interceptador: refresh e tratamento de erros.
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const originalRequest = error.config as any;
        const isStudentRequest = Boolean(originalRequest?.meta?.studentAuth);

        if (status === 401 && isStudentRequest && originalRequest && !originalRequest._studentRetry) {
          originalRequest._studentRetry = true;
          const refreshed = await this.refreshStudentSession();
          if (refreshed) {
            const studentSession = loadStudentSessionState();
            if (studentSession?.accessToken) {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${studentSession.accessToken}`;
              return this.client.request(originalRequest);
            }
          }
        }

        if (status === 401 && !isStudentRequest && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const { data, error: refreshError } = await supabase.auth.refreshSession();
            const refreshedToken = data.session?.access_token;
            if (!refreshError && refreshedToken) {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
              return this.client.request(originalRequest);
            }
          } catch {
            // Continua para tratamento padrao abaixo.
          }
        }

        if (status === 401) {
          if (isStudentRequest) {
            await this.logoutStudent();
          } else {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
              const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
              window.location.assign(`/login?next=${encodeURIComponent(nextPath)}`);
            }
          }
        }

        const payload: any = error.response?.data || {};
        const message =
          payload?.message ||
          payload?.error ||
          error.message ||
          'Erro inesperado na comunicacao com o servidor';

        return Promise.reject(new Error(message));
      }
    );
  }
  private studentRequestConfig() {
    return {
      withCredentials: true,
      headers: {
        'X-CSRF-Token': readCookie('student_csrf_token') || '',
      },
      meta: {
        studentAuth: true,
      },
    } as any;
  }
  private storeStudentSession(data: {
    accessToken: string;
    accessTokenExpiresInSec: number;
    studentId: string;
    distributionId: string;
  }): void {
    setStudentSessionState({
      accessToken: data.accessToken,
      studentId: data.studentId,
      distributionId: data.distributionId,
      expiresAtMs: Date.now() + Number(data.accessTokenExpiresInSec || 0) * 1000,
    });
  }
  private async refreshStudentSession(): Promise<boolean> {
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: {
            'X-CSRF-Token': readCookie('student_csrf_token') || '',
          },
        }
      );
      const payload = response.data?.data;
      if (!payload?.accessToken) {
        return false;
      }

      const claims = decodeStudentClaims(payload.accessToken);
      if (!claims) {
        return false;
      }

      this.storeStudentSession({
        accessToken: payload.accessToken,
        accessTokenExpiresInSec: payload.accessTokenExpiresInSec,
        studentId: payload.studentId || claims.studentId,
        distributionId: payload.distributionId || claims.distributionId,
      });
      return true;
    } catch {
      setStudentSessionState(null);
      return false;
    }
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
    const response = await this.client.post(`/api/students/${distributionId}`, {
      name,
      course,
      phase,
    });

    const payload = response.data?.data;
    if (payload?.accessToken && payload?.studentId && payload?.distributionId) {
      this.storeStudentSession({
        accessToken: payload.accessToken,
        accessTokenExpiresInSec: payload.accessTokenExpiresInSec,
        studentId: payload.studentId,
        distributionId: payload.distributionId,
      });
    }

    return response.data;
  }

  async createStudentSession(
    distributionId: string,
    data: { matricula?: string; name?: string; course?: string; phase?: number }
  ) {
    const response = await this.client.post(`/api/students/${distributionId}/session`, data);
    const payload = response.data?.data;

    if (payload?.accessToken && payload?.studentId && payload?.distributionId) {
      this.storeStudentSession({
        accessToken: payload.accessToken,
        accessTokenExpiresInSec: payload.accessTokenExpiresInSec,
        studentId: payload.studentId,
        distributionId: payload.distributionId,
      });
    }

    return response.data;
  }

  async getCurrentStudentSession() {
    const active = loadStudentSessionState();
    if (active) {
      return active;
    }

    const refreshed = await this.refreshStudentSession();
    if (!refreshed) {
      return null;
    }

    return loadStudentSessionState();
  }

  async logoutStudent() {
    try {
      await axios.post(
        `${API_URL}/api/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: {
            'X-CSRF-Token': readCookie('student_csrf_token') || '',
          },
        }
      );
    } catch {
      // Mesmo com erro no backend, limpamos sessao local para nao manter token stale.
    } finally {
      setStudentSessionState(null);
    }
  }

  async getStudentMe() {
    const response = await this.client.get('/api/students/me', this.studentRequestConfig());
    return response.data;
  }

  async updateStudentPreferences(preferences: Array<{ themeId: string; rank: number }>) {
    const response = await this.client.put(
      '/api/students/me/preferences',
      { preferences },
      this.studentRequestConfig()
    );
    return response.data;
  }

  async getStudentAccess() {
    const response = await this.client.get('/api/students/me/access', this.studentRequestConfig());
    return response.data;
  }

  async getStudentThemes() {
    const response = await this.client.get('/api/students/me/themes', this.studentRequestConfig());
    return response.data;
  }

  // Mantido apenas para compatibilidade temporaria.
  async getStudentDistributionAccess(_distributionId: string) {
    return this.getStudentAccess();
  }

  async searchAffinityCandidates(query: string) {
    const response = await this.client.get('/api/students/me/affinity-candidates', {
      params: { q: query },
      ...this.studentRequestConfig(),
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

  async importStudentRegistry(
    distributionId: string,
    payload: { students?: Array<{ name: string; course: 'EE' | 'ME'; phase: number; matricula: string }>; csv?: string }
  ) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/student-registry/import`,
      payload
    );
    return response.data;
  }

  async getStudentRegistryStatus(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/student-registry/status`
    );
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

  async executeSimulationPhase1(
    distributionId: string,
    config?: { wPref?: number; wDup?: number; wDiv?: number }
  ) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/simulation/execute-phase1`,
      config || {}
    );
    return response.data;
  }

  async executeSimulationPhase2(
    distributionId: string,
    config?: { wSoc?: number; maxIterations?: number; temperature?: number }
  ) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/simulation/execute-phase2`,
      config || {}
    );
    return response.data;
  }

  async getSimulationMetrics(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/simulation/metrics`
    );
    return response.data;
  }

  async getSimulationGroups(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/simulation/groups`
    );
    return response.data;
  }

  async getSimulationVisualState(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/simulation/visual-state`
    );
    return response.data;
  }

  async startSimulationPhase1Run(
    distributionId: string,
    config?: { wPref?: number; wDup?: number; wDiv?: number; lambdaVec?: number; snapshotEvery?: number; axisThemeIds?: string[] }
  ) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/simulation/runs/start-phase1`,
      config || {}
    );
    return response.data;
  }

  async startSimulationPhase2Run(
    distributionId: string,
    config?: { wSoc?: number; maxIterations?: number; temperature?: number; lambdaVec?: number; snapshotEvery?: number; axisThemeIds?: string[] }
  ) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/simulation/runs/start-phase2`,
      config || {}
    );
    return response.data;
  }

  async getSimulationRunResult(runId: string) {
    const response = await this.client.get(
      `/api/organizer/simulation/runs/${runId}/result`
    );
    return response.data;
  }

  async getSimulationRunStreamTicket(runId: string) {
    const response = await this.client.post(
      `/api/organizer/simulation/runs/${runId}/stream-ticket`
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

  async getStudentCurrentGroup() {
    const response = await this.client.get('/api/students/me/current-group', this.studentRequestConfig());
    return response.data;
  }

  async getStudentAffinities() {
    const response = await this.client.get('/api/students/me/affinities', this.studentRequestConfig());
    return response.data;
  }

  async submitStudentAffinities(
    affinities: Array<{ targetStudentId: string; value: number }>
  ) {
    const response = await this.client.put(
      '/api/students/me/affinities',
      { affinities },
      this.studentRequestConfig()
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
  const data = ensureSuccess(response, 'Falha ao listar distribuiÃ§Ãµes');
  return (data.distributions ?? []).map(normalizeDistribution);
}

export async function createDistribution(): Promise<string> {
  const response = (await api.createDistribution()) as LegacyResponse<{ distributionId: string }>;
  const data = ensureSuccess(response, 'Falha ao criar distribuiÃ§Ã£o');
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
            'Falha ao carregar estatÃ­sticas'
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
  const data = ensureSuccess(response, 'Falha ao carregar estatÃ­sticas');
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

export async function executeSimulationPhase1(
  distributionId: string,
  config?: Partial<Phase1Config>
): Promise<SimulationExecutionReport> {
  const response = (await api.executeSimulationPhase1(distributionId, config)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao executar Fase 1 de simulacao');
  return normalizeSimulationExecutionReport(data, distributionId);
}

export async function executeSimulationPhase2(
  distributionId: string,
  config?: Partial<Phase2Config>
): Promise<SimulationExecutionReport> {
  const response = (await api.executeSimulationPhase2(distributionId, config)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao executar Fase 2 de simulacao');
  return normalizeSimulationExecutionReport(data, distributionId);
}

export async function getSimulationMetrics(distributionId: string): Promise<SimulationMetrics> {
  const response = (await api.getSimulationMetrics(distributionId)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao carregar metricas da simulacao');
  return normalizeSimulationMetrics(data);
}

export async function getSimulationGroups(distributionId: string): Promise<SimulationGroupMetrics[]> {
  const response = (await api.getSimulationGroups(distributionId)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao carregar grupos da simulacao');
  return normalizeSimulationGroups(data.groups ?? []);
}

export async function getSimulationVisualState(distributionId: string): Promise<SimulationVisualState> {
  const response = (await api.getSimulationVisualState(distributionId)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao carregar estado visual da simulacao');
  return normalizeSimulationVisualState(data, distributionId);
}

export async function startSimulationPhase1Run(
  distributionId: string,
  config?: Partial<Phase1Config> & { lambdaVec?: number; snapshotEvery?: number; axisThemeIds?: string[] }
): Promise<SimulationRun> {
  const response = (await api.startSimulationPhase1Run(distributionId, config)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao iniciar execucao ao vivo da Fase 1');
  return normalizeSimulationRun(data, distributionId);
}

export async function startSimulationPhase2Run(
  distributionId: string,
  config?: Partial<Phase2Config> & { lambdaVec?: number; snapshotEvery?: number; axisThemeIds?: string[] }
): Promise<SimulationRun> {
  const response = (await api.startSimulationPhase2Run(distributionId, config)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao iniciar execucao ao vivo da Fase 2');
  return normalizeSimulationRun(data, distributionId);
}

export async function openSimulationRunStream(
  runId: string,
  handlers: {
    onRunStarted?: (run: SimulationRun) => void;
    onSnapshot?: (snapshot: SimulationRunSnapshot) => void;
    onCompleted?: (result: SimulationRunCompleted) => void;
    onRunError?: (message: string) => void;
    onError?: (event: Event) => void;
  }
): Promise<EventSource> {
  const ticketResponse = (await api.getSimulationRunStreamTicket(runId)) as LegacyResponse<{ ticket: string }>;
  const ticketData = ensureSuccess(ticketResponse, 'Falha ao obter ticket para stream da simulacao');
  const streamUrl = `${API_URL}/api/organizer/simulation/runs/${runId}/stream?ticket=${encodeURIComponent(ticketData.ticket)}`;
  const source = new EventSource(streamUrl);

  source.addEventListener('run_started', (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data);
      handlers.onRunStarted?.(normalizeSimulationRun(payload, String(payload?.distributionId ?? '')));
    } catch {
      // Ignora payload invalido.
    }
  });

  source.addEventListener('snapshot', (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data);
      handlers.onSnapshot?.(normalizeSimulationRunSnapshot(payload));
    } catch {
      // Ignora payload invalido.
    }
  });

  source.addEventListener('phase_completed', (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data);
      handlers.onCompleted?.(normalizeSimulationRunCompleted(payload));
    } catch {
      handlers.onRunError?.('Falha ao processar payload final da execucao.');
    } finally {
      source.close();
    }
  });

  source.addEventListener('run_error', (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data);
      handlers.onRunError?.(String(payload?.message ?? 'Erro na execucao ao vivo'));
    } catch {
      handlers.onRunError?.('Erro na execucao ao vivo');
    } finally {
      source.close();
    }
  });

  source.onerror = (event) => {
    handlers.onError?.(event);
  };

  return source;
}

export async function getSimulationRunResult(runId: string): Promise<{
  runId: string;
  distributionId: string;
  phase: 'phase1' | 'phase2';
  axisThemeIds: [string, string, string];
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  result: SimulationRunCompleted | null;
}> {
  const response = (await api.getSimulationRunResult(runId)) as LegacyResponse<any>;
  const data = ensureSuccess(response, 'Falha ao recuperar resultado da execucao ao vivo');
  const axisThemeIdsRaw = Array.isArray(data?.axisThemeIds) ? data.axisThemeIds : [];
  return {
    runId: String(data?.runId ?? runId),
    distributionId: String(data?.distributionId ?? ''),
    phase: String(data?.phase ?? 'phase1') === 'phase2' ? 'phase2' : 'phase1',
    axisThemeIds: [
      String(axisThemeIdsRaw[0] ?? 'x'),
      String(axisThemeIdsRaw[1] ?? 'y'),
      String(axisThemeIdsRaw[2] ?? 'z'),
    ],
    status: (['running', 'completed', 'failed'].includes(String(data?.status))
      ? data.status
      : 'running') as 'running' | 'completed' | 'failed',
    startedAt: String(data?.startedAt ?? new Date().toISOString()),
    completedAt: data?.completedAt ? String(data.completedAt) : undefined,
    error: data?.error ? String(data.error) : undefined,
    result: data?.result ? normalizeSimulationRunCompleted(data.result) : null,
  };
}

export default api;
