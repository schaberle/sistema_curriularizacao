import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Student, Theme, Group, Solution } from '../../domain';
import { createResilientFetch } from '../supabase/resilientFetch';
import { mapOrigemAlunoToCourse } from '../registry/officialRegistry.utils';

export type StudentRegistryImportEntry = {
  distributionId: string;
  academico: string;
  origemAluno: string;
  faseTurma: number;
  matriculaHash: string;
  active?: boolean;
};

type StudentRegistryStatus = {
  distributionId: string;
  totalRows: number;
  activeRows: number;
  inactiveRows: number;
  lastUpdatedAt: string | null;
};

export type StudentRegistryTemplateRow = {
  academico: string;
  origemAluno: string;
  faseTurma: number;
  matriculaHash: string;
};

export type ActiveStudentRegistryEntry = {
  academico: string;
  origemAluno: string;
  faseTurma: number;
  matriculaHash: string;
};

/**
 * DatabaseService - Gerencia todas as operações com Supabase
 *
 * Responsabilidades:
 * 1. Conexão e autenticação com Supabase
 * 2. CRUD para todas as 7 tabelas
 * 3. Transações e integridade de dados
 * 4. Validações de negócio
 */
export class DatabaseService {
  private client: SupabaseClient;

  constructor(
    supabaseUrl: string,
    supabaseKey: string
  ) {
    this.client = createClient(supabaseUrl, supabaseKey, {
      global: {
        // Retry only for read methods at transport layer.
        fetch: createResilientFetch({
          maxAttempts: 4,
          baseDelayMs: 170,
          retryMethods: ['GET', 'HEAD'],
        }),
      },
    });
  }

  // ============================================================
  // ORGANIZERS - Gerenciamento de Organizadores
  // ============================================================

  /**
   * Busca organizador por email
   */
  async getOrganizerByEmail(email: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('organizers')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error; // PGRST116 = no rows
    }

    return data || null;
  }

  /**
   * Verifica password do organizador
   */
  async verifyOrganizerPassword(organizerId: string, passwordHash: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('organizers')
      .select('password_hash')
      .eq('id', organizerId)
      .single();

    if (error) {
      throw error;
    }

    // Comparar hashes (em produção, usar bcrypt)
    return data?.password_hash === passwordHash;
  }

  // ============================================================
  // DISTRIBUTIONS - Gerenciamento de Distribuições
  // ============================================================

  /**
   * Cria nova distribuição
   */
  async createDistribution(organizerId: string): Promise<string> {
    const { data, error } = await this.client
      .from('distributions')
      .insert({
        organizer_id: organizerId,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  }

  /**
   * Busca distribuição por ID
   */
  async getDistribution(distributionId: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('distributions')
      .select('*')
      .eq('id', distributionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  }

  /**
   * Lista todas as distribuições de um organizador
   */
  async getDistributionsByOrganizer(organizerId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('distributions')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Lista todas as distribuicoes do sistema.
   * Usado para sincronizacao global do registro oficial de alunos.
   */
  async getAllDistributions(): Promise<Array<{ id: string; organizer_id: string | null }>> {
    const { data, error } = await this.client
      .from('distributions')
      .select('id, organizer_id')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; organizer_id: string | null }>;
  }

  /**
   * Atualiza status da distribuição
   */
  async updateDistributionStatus(
    distributionId: string,
    status:
      | 'PENDING'
      | 'THEMED'
      | 'COLLECTING'
      | 'EXECUTING'
      | 'COMPLETED'
      | 'PARTIAL'
      | 'PHASE2'
      | 'PHASE2_EXECUTING'
      | 'PHASE2_COMPLETED'
      | 'FAILED'
  ): Promise<void> {
    const { error } = await this.client
      .from('distributions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', distributionId);

    if (error) {
      throw error;
    }
  }

  /**
   * Atualiza flags de pendencia de reexecucao da distribuicao.
   * Operacao idempotente: pode receber apenas um dos campos.
   */
  async updateDistributionExecutionPendingFlags(
    distributionId: string,
    flags: {
      phase1NeedsRerun?: boolean;
      phase2NeedsRerun?: boolean;
    }
  ): Promise<{
    id: string;
    status: string;
    phase1_needs_rerun: boolean;
    phase2_needs_rerun: boolean;
  } | null> {
    const isMissingExecutionPendingColumnsError = (error: any): boolean => {
      const message = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '').toUpperCase();

      if (code === 'PGRST204') {
        return (
          message.includes('phase1_needs_rerun') ||
          message.includes('phase2_needs_rerun')
        );
      }

      return (
        message.includes('phase1_needs_rerun') ||
        message.includes('phase2_needs_rerun')
      ) && (
        message.includes('does not exist') ||
        message.includes('not exist') ||
        message.includes('schema cache')
      );
    };

    const hasPhase1Flag = typeof flags.phase1NeedsRerun === 'boolean';
    const hasPhase2Flag = typeof flags.phase2NeedsRerun === 'boolean';

    if (!hasPhase1Flag && !hasPhase2Flag) {
      const distribution = await this.getDistribution(distributionId);
      if (!distribution) {
        return null;
      }

      return {
        id: distribution.id,
        status: String(distribution.status || 'PENDING'),
        phase1_needs_rerun: Boolean(distribution.phase1_needs_rerun),
        phase2_needs_rerun: Boolean(distribution.phase2_needs_rerun),
      };
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (hasPhase1Flag) {
      payload.phase1_needs_rerun = flags.phase1NeedsRerun;
    }

    if (hasPhase2Flag) {
      payload.phase2_needs_rerun = flags.phase2NeedsRerun;
    }

    const { data, error } = await this.client
      .from('distributions')
      .update(payload)
      .eq('id', distributionId)
      .select('id, status, phase1_needs_rerun, phase2_needs_rerun')
      .single();

    if (error) {
      if (isMissingExecutionPendingColumnsError(error)) {
        // Legacy schema fallback: keep behavior without requiring migration.
        const { error: touchError } = await this.client
          .from('distributions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', distributionId);

        if (touchError) {
          throw touchError;
        }

        const distribution = await this.getDistribution(distributionId);
        if (!distribution) {
          return null;
        }

        return {
          id: distribution.id,
          status: String(distribution.status || 'PENDING'),
          phase1_needs_rerun: Boolean(distribution.phase1_needs_rerun ?? false),
          phase2_needs_rerun: Boolean(distribution.phase2_needs_rerun ?? false),
        };
      }

      throw error;
    }

    return data || null;
  }

  /**
   * Marca distribuição como executada
   */
  async markDistributionExecuted(distributionId: string): Promise<void> {
    const { error } = await this.client
      .from('distributions')
      .update({
        status: 'COMPLETED',
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', distributionId);

    if (error) {
      throw error;
    }
  }

  // ============================================================
  // STUDENTS - Gerenciamento de Alunos
  // ============================================================

  /**
   * Registra novo aluno
   */
  async createStudent(
    name: string,
    course: string,
    phase: number,
    distributionId: string,
    forcedStudentId?: string
  ): Promise<string> {
    const payload: Record<string, any> = {
      name,
      course,
      phase,
      distribution_id: distributionId,
      created_at: new Date().toISOString(),
    };

    if (forcedStudentId) {
      payload.id = forcedStudentId;
    }

    const query = this.client.from('students');
    const { data, error } = forcedStudentId
      ? await query
          .upsert(payload, { onConflict: 'id' })
          .select('id')
          .single()
      : await query
          .insert(payload)
          .select('id')
          .single();

    if (error) {
      throw error;
    }

    return data.id;
  }

  /**
   * Busca aluno por ID
   */
  async getStudent(studentId: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  }

  /**
   * Busca aluno para inicializar sessao com validacao de identidade basica.
   */
  async findStudentForSession(
    distributionId: string,
    payload: { name: string; course: string; phase: number }
  ): Promise<any | null> {
    const normalizedName = this.normalizeNameForMatch(payload.name || '');
    if (!normalizedName) {
      return null;
    }

    const students = await this.getStudentsByDistribution(distributionId);
    const candidates = students.filter((student: any) => {
      return (
        this.normalizeNameForMatch(String(student.name || '')) === normalizedName &&
        String(student.course || '').toUpperCase() === String(payload.course || '').toUpperCase() &&
        Number(student.phase) === Number(payload.phase)
      );
    });

    if (candidates.length !== 1) {
      return null;
    }

    return candidates[0];
  }

  async findStudentsByExactProfile(
    distributionId: string,
    payload: { name: string; course: string; phase: number }
  ): Promise<any[]> {
    const normalizedName = this.normalizeNameForMatch(payload.name || '');
    if (!normalizedName) {
      return [];
    }

    const students = await this.getStudentsByDistribution(distributionId);
    return students.filter((student: any) => {
      return (
        this.normalizeNameForMatch(String(student.name || '')) === normalizedName &&
        String(student.course || '').toUpperCase() === String(payload.course || '').toUpperCase() &&
        Number(student.phase) === Number(payload.phase)
      );
    });
  }

  /**
   * Busca aluno por nome (para resultado público)
   */
  async getStudentByName(name: string, distributionId: string): Promise<any | null> {
    const normalizedQuery = this.normalizeNameForMatch(name);
    if (!normalizedQuery) {
      return null;
    }

    const students = await this.getStudentsByDistribution(distributionId);
    if (!students || students.length === 0) {
      return null;
    }

    const exact = students.find((student: any) =>
      this.normalizeNameForMatch(String(student.name || '')) === normalizedQuery
    );
    if (exact) {
      return exact;
    }

    type ScoredStudent = {
      student: any;
      score: number;
      tokenCoverage: number;
      avgTokenScore: number;
      exact: boolean;
    };

    const scored: ScoredStudent[] = [];
    const queryTokens = this.tokenizeName(normalizedQuery);

    for (const student of students) {
      const candidateName = String(student?.name || '');
      const candidateNormalized = this.normalizeNameForMatch(candidateName);
      if (!candidateNormalized) {
        continue;
      }

      const candidateTokens = this.tokenizeName(candidateNormalized);
      if (candidateTokens.length === 0) {
        continue;
      }

      const isExact = candidateNormalized === normalizedQuery;
      const containsQuery = candidateNormalized.includes(normalizedQuery);
      const startsWithQuery = candidateNormalized.startsWith(normalizedQuery);
      const fullSimilarity = this.computeSimilarity(normalizedQuery, candidateNormalized);

      const tokenScores = queryTokens.map((queryToken) => {
        let bestTokenScore = 0;
        for (const candidateToken of candidateTokens) {
          bestTokenScore = Math.max(bestTokenScore, this.computeSimilarity(queryToken, candidateToken));
        }
        return bestTokenScore;
      });

      const avgTokenScore =
        tokenScores.length > 0
          ? tokenScores.reduce((sum, value) => sum + value, 0) / tokenScores.length
          : 0;

      const tokenCoverage =
        tokenScores.filter((value) => value >= 0.7).length / Math.max(1, queryTokens.length);

      const score =
        (isExact ? 0.4 : 0) +
        avgTokenScore * 0.4 +
        fullSimilarity * 0.15 +
        (containsQuery ? 0.04 : 0) +
        (startsWithQuery ? 0.01 : 0);

      const acceptable =
        isExact ||
        containsQuery ||
        avgTokenScore >= 0.72 ||
        (tokenCoverage >= 0.75 && avgTokenScore >= 0.64) ||
        (queryTokens.length === 1 && avgTokenScore >= 0.68);

      if (acceptable) {
        scored.push({
          student,
          score,
          tokenCoverage,
          avgTokenScore,
          exact: isExact,
        });
      }
    }

    if (scored.length === 0) {
      return null;
    }

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const second = scored[1];

    if (
      second &&
      !best.exact &&
      best.avgTokenScore < 0.92 &&
      best.score - second.score < 0.03 &&
      second.tokenCoverage >= 0.8 &&
      second.avgTokenScore >= 0.8
    ) {
      return null;
    }

    return best.student;
  }

  private normalizeNameForMatch(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenizeName(value: string): string[] {
    return this.normalizeNameForMatch(value)
      .split(' ')
      .map((token) => token.trim())
      .filter(Boolean);
  }

  private computeSimilarity(a: string, b: string): number {
    if (!a || !b) {
      return 0;
    }
    if (a === b) {
      return 1;
    }
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) {
      return 1;
    }
    const distance = this.computeLevenshteinDistance(a, b);
    return Math.max(0, 1 - distance / maxLen);
  }

  private computeLevenshteinDistance(a: string, b: string): number {
    const rows = a.length + 1;
    const cols = b.length + 1;

    const dp: number[] = new Array(cols);
    for (let j = 0; j < cols; j++) {
      dp[j] = j;
    }

    for (let i = 1; i < rows; i++) {
      let prevDiagonal = dp[0];
      dp[0] = i;

      for (let j = 1; j < cols; j++) {
        const temp = dp[j];
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

        dp[j] = Math.min(
          dp[j] + 1,
          dp[j - 1] + 1,
          prevDiagonal + substitutionCost
        );

        prevDiagonal = temp;
      }
    }

    return dp[cols - 1];
  }

  /**
   * Lista todos os alunos de uma distribuição
   */
  async getStudentsByDistribution(distributionId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('students')
      .select('*')
      .eq('distribution_id', distributionId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  // ============================================================
  // STUDENT_REGISTRY - Registro oficial de alunos
  // ============================================================

  async upsertStudentRegistry(
    entries: StudentRegistryImportEntry[]
  ): Promise<{
    importedRows: number;
    activeRows: number;
    deactivatedRows: number;
  }> {
    if (entries.length === 0) {
      return {
        importedRows: 0,
        activeRows: 0,
        deactivatedRows: 0,
      };
    }

    const distributionId = entries[0].distributionId;
    const nowIso = new Date().toISOString();

    const { data: existingRows, error: existingError } = await this.client
      .from('student_registry')
      .select('id, matricula_hash, active')
      .eq('distribution_id', distributionId);
    if (existingError) {
      throw existingError;
    }

    const incomingByHash = new Map<string, StudentRegistryImportEntry>();
    for (const entry of entries) {
      incomingByHash.set(entry.matriculaHash, entry);
    }

    const payload = Array.from(incomingByHash.values()).map((entry) => ({
      distribution_id: entry.distributionId,
      academico: entry.academico,
      origem_aluno: entry.origemAluno,
      fase_turma: entry.faseTurma,
      matricula_hash: entry.matriculaHash,
      active: entry.active ?? true,
      updated_at: nowIso,
    }));

    const { error: upsertError } = await this.client
      .from('student_registry')
      .upsert(payload, { onConflict: 'distribution_id,matricula_hash' });
    if (upsertError) {
      throw upsertError;
    }

    const idsToDeactivate: string[] = [];
    for (const row of existingRows || []) {
      const hash = String(row.matricula_hash);
      if (!incomingByHash.has(hash) && row.active) {
        idsToDeactivate.push(String(row.id));
      }
    }

    for (let i = 0; i < idsToDeactivate.length; i += 500) {
      const batch = idsToDeactivate.slice(i, i + 500);
      const { error: deactivateError } = await this.client
        .from('student_registry')
        .update({ active: false, updated_at: nowIso })
        .in('id', batch);
      if (deactivateError) {
        throw deactivateError;
      }
    }

    const { count: activeCount, error: activeCountError } = await this.client
      .from('student_registry')
      .select('id', { count: 'exact', head: true })
      .eq('distribution_id', distributionId)
      .eq('active', true);
    if (activeCountError) {
      throw activeCountError;
    }

    return {
      importedRows: payload.length,
      activeRows: Number(activeCount || 0),
      deactivatedRows: idsToDeactivate.length,
    };
  }

  async getStudentRegistryStatus(distributionId: string): Promise<StudentRegistryStatus> {
    const { data, error } = await this.client
      .from('student_registry')
      .select('id, active, updated_at')
      .eq('distribution_id', distributionId);
    if (error) {
      throw error;
    }

    const rows = data || [];
    let activeRows = 0;
    let lastUpdatedAt: string | null = null;
    for (const row of rows) {
      if (row.active) {
        activeRows += 1;
      }

      const updatedAt = row.updated_at ? String(row.updated_at) : null;
      if (updatedAt && (!lastUpdatedAt || updatedAt > lastUpdatedAt)) {
        lastUpdatedAt = updatedAt;
      }
    }

    return {
      distributionId,
      totalRows: rows.length,
      activeRows,
      inactiveRows: rows.length - activeRows,
      lastUpdatedAt,
    };
  }

  async getActiveStudentRegistryEntries(distributionId: string): Promise<ActiveStudentRegistryEntry[]> {
    const { data, error } = await this.client
      .from('student_registry')
      .select('academico, origem_aluno, fase_turma, matricula_hash')
      .eq('distribution_id', distributionId)
      .eq('active', true);
    if (error) {
      throw error;
    }

    return (data || [])
      .map((row: any) => ({
        academico: String(row.academico || '').trim(),
        origemAluno: String(row.origem_aluno || '').trim(),
        faseTurma: Number(row.fase_turma),
        matriculaHash: String(row.matricula_hash || '').trim().toLowerCase(),
      }))
      .filter((row) =>
        row.academico.length > 0 &&
        row.origemAluno.length > 0 &&
        Number.isInteger(row.faseTurma) &&
        row.faseTurma >= 1 &&
        row.faseTurma <= 10 &&
        row.matriculaHash.length > 0
      );
  }

  /**
   * Retorna uma lista-canonica de alunos oficiais a partir do banco.
   * Seleciona a distribuicao com maior numero de alunos ativos no student_registry.
   */
  async getStudentRegistryTemplateRows(): Promise<StudentRegistryTemplateRow[]> {
    const { data, error } = await this.client
      .from('student_registry')
      .select('distribution_id, academico, origem_aluno, fase_turma, matricula_hash')
      .eq('active', true);
    if (error) {
      throw error;
    }

    const rows = data || [];
    if (!rows.length) {
      return [];
    }

    const countsByDistribution = new Map<string, number>();
    for (const row of rows) {
      const distributionId = String(row.distribution_id || '');
      if (!distributionId) {
        continue;
      }
      countsByDistribution.set(distributionId, (countsByDistribution.get(distributionId) || 0) + 1);
    }

    let selectedDistributionId = '';
    let maxCount = -1;
    for (const [distributionId, count] of countsByDistribution.entries()) {
      if (count > maxCount) {
        maxCount = count;
        selectedDistributionId = distributionId;
      }
    }

    if (!selectedDistributionId) {
      return [];
    }

    return rows
      .filter((row: any) => String(row.distribution_id || '') === selectedDistributionId)
      .map((row: any) => ({
        academico: String(row.academico || ''),
        origemAluno: String(row.origem_aluno || ''),
        faseTurma: Number(row.fase_turma),
        matriculaHash: String(row.matricula_hash || ''),
      }))
      .filter((row) =>
        row.academico.length > 0 &&
        row.origemAluno.length > 0 &&
        Number.isInteger(row.faseTurma) &&
        row.faseTurma >= 1 &&
        row.faseTurma <= 10 &&
        row.matriculaHash.length > 0
      );
  }

  async findStudentRegistryByMatriculaHash(
    distributionId: string,
    matriculaHash: string
  ): Promise<any | null> {
    const { data, error } = await this.client
      .from('student_registry')
      .select('*')
      .eq('distribution_id', distributionId)
      .eq('matricula_hash', matriculaHash)
      .eq('active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  }

  // ============================================================
  // STUDENT_PREFERENCES - Preferências de Alunos
  // ============================================================

  /**
   * Adiciona preferência de aluno por tema
   */
  async addStudentPreference(
    studentId: string,
    themeId: string,
    rank: number
  ): Promise<void> {
    const { error } = await this.client
      .from('student_preferences')
      .insert({
        student_id: studentId,
        theme_id: themeId,
        rank,
      });

    if (error) {
      throw error;
    }
  }

  /**
   * Define preferência de forma idempotente (evita duplicação em retries).
   */
  async setStudentPreference(
    studentId: string,
    themeId: string,
    rank: number
  ): Promise<void> {
    const payload = {
      student_id: studentId,
      theme_id: themeId,
      rank,
    };

    const { error: upsertError } = await this.client
      .from('student_preferences')
      .upsert(payload, { onConflict: 'student_id,theme_id' });

    if (!upsertError) {
      return;
    }

    const errorMessage = String(upsertError?.message || '').toLowerCase();
    const missingConflictConstraint =
      errorMessage.includes('there is no unique or exclusion constraint matching') ||
      errorMessage.includes('on conflict') ||
      errorMessage.includes('constraint');

    if (!missingConflictConstraint) {
      throw upsertError;
    }

    const { error: deleteError } = await this.client
      .from('student_preferences')
      .delete()
      .eq('student_id', studentId)
      .eq('theme_id', themeId);
    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await this.client
      .from('student_preferences')
      .insert(payload);
    if (insertError) {
      throw insertError;
    }
  }

  /**
   * Busca preferências de um aluno
   */
  async getStudentPreferences(studentId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('student_preferences')
      .select('*')
      .eq('student_id', studentId)
      .order('rank', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Remove todas as preferências de um aluno (para re-ranking)
   */
  async clearStudentPreferences(studentId: string): Promise<void> {
    const { error } = await this.client
      .from('student_preferences')
      .delete()
      .eq('student_id', studentId);

    if (error) {
      throw error;
    }
  }

  // ============================================================
  // STUDENTS - Consultas por distribuição
  // ============================================================

  /**
   * Retorna IDs de todos os alunos de uma distribuição
   */
  async getStudentIdsByDistribution(distributionId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('students')
      .select('id')
      .eq('distribution_id', distributionId);

    if (error) {
      throw error;
    }

    return (data || []).map(s => s.id);
  }

  // ============================================================
  // STUDENT_AFFINITIES - Afinidades Sociais
  // ============================================================

  /**
   * Adiciona afinidade entre alunos
   */
  async addStudentAffinity(
    studentId: string,
    targetStudentId: string,
    level: number
  ): Promise<void> {
    const { error } = await this.client
      .from('student_affinities')
      .upsert({
        student_id: studentId,
        target_student_id: targetStudentId,
        level,
      }, { onConflict: 'student_id, target_student_id' });

    if (error) {
      throw error;
    }
  }

  /**
   * Busca afinidades declaradas por um aluno
   */
  async getStudentAffinities(studentId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('student_affinities')
      .select('*')
      .eq('student_id', studentId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Busca TODAS as afinidades de uma distribuição
   * Útil para carregar a matriz de afinidades na Fase 2
   */
  async getAllAffinitiesByDistribution(distributionId: string): Promise<any[]> {
    // 1. Buscar IDs dos alunos da distribuição
    const { data: students, error: studentsError } = await this.client
      .from('students')
      .select('id')
      .eq('distribution_id', distributionId);

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) return [];

    const studentIds = students.map(s => s.id);

    // 2. Buscar afinidades onde o student_id está na lista
    // Não precisamos de join se já filtramos pelos IDs corretos
    const { data, error } = await this.client
      .from('student_affinities')
      .select(`
        student_id,
        target_student_id,
        level
      `)
      .in('student_id', studentIds);

    if (error) {
      throw error;
    }

    return data || [];
  }

  // ============================================================
  // THEMES - Gerenciamento de Temas
  // ============================================================

  /**
   * Cria novo tema
   */
  async createTheme(
    name: string,
    description: string,
    groupProportion: number,
    distributionId: string
  ): Promise<string> {
    const nowIso = new Date().toISOString();

    const isMissingGroupProportionColumnError = (error: any): boolean => {
      const code = String(error?.code || '').toUpperCase();
      const message = String(error?.message || '').toLowerCase();

      if (code === 'PGRST204') {
        return message.includes('group_proportion');
      }

      // Postgres undefined_column
      if (code === '42703') {
        return message.includes('group_proportion');
      }

      return (
        message.includes('group_proportion') &&
        (
          message.includes('does not exist') ||
          message.includes('not exist') ||
          message.includes('schema cache')
        )
      );
    };

    const insertWithGroupProportion = await this.client
      .from('themes')
      .insert({
        name,
        description,
        group_proportion: groupProportion,
        distribution_id: distributionId,
        created_at: nowIso,
      })
      .select('id')
      .single();

    if (!insertWithGroupProportion.error) {
      return insertWithGroupProportion.data.id;
    }

    // Backward-compatible fallback for environments where migration was not applied yet.
    if (!isMissingGroupProportionColumnError(insertWithGroupProportion.error)) {
      throw insertWithGroupProportion.error;
    }

    const { data, error } = await this.client
      .from('themes')
      .insert({
        name,
        description,
        max_groups: groupProportion,
        distribution_id: distributionId,
        created_at: nowIso,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  }

  /**
   * Busca tema por ID
   */
  async getTheme(themeId: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('themes')
      .select('*')
      .eq('id', themeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  }

  /**
   * Lista todos os temas de uma distribuição
   */
  async getThemesByDistribution(distributionId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('themes')
      .select('*')
      .eq('distribution_id', distributionId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  // ============================================================
  // GROUPS - Gerenciamento de Grupos
  // ============================================================

  /**
   * Cria novo grupo
   */
  async createGroup(
    themeId: string,
    distributionId: string
  ): Promise<string> {
    const { data, error } = await this.client
      .from('groups')
      .insert({
        theme_id: themeId,
        distribution_id: distributionId,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  }

  /**
   * Busca grupo por ID
   */
  async getGroup(groupId: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  }

  /**
   * Lista todos os grupos de uma distribuição
   */
  async getGroupsByDistribution(distributionId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('groups')
      .select('*')
      .eq('distribution_id', distributionId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  // ============================================================
  // GROUP_STUDENTS - Junction table (Grupo <-> Aluno)
  // ============================================================

  /**
   * Adiciona aluno a um grupo
   */
  async addStudentToGroup(groupId: string, studentId: string): Promise<void> {
    const { error } = await this.client
      .from('group_students')
      .insert({
        group_id: groupId,
        student_id: studentId,
      });

    if (error) {
      throw error;
    }
  }

  /**
   * Remove aluno de um grupo
   */
  async removeStudentFromGroup(groupId: string, studentId: string): Promise<void> {
    const { error } = await this.client
      .from('group_students')
      .delete()
      .eq('group_id', groupId)
      .eq('student_id', studentId);

    if (error) {
      throw error;
    }
  }

  /**
   * Lista alunos de um grupo
   */
  async getGroupStudents(groupId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('group_students')
      .select('student_id')
      .eq('group_id', groupId);

    if (error) {
      throw error;
    }

    return data?.map(row => row.student_id) || [];
  }

  /**
   * Busca grupo de um aluno
   */
  async getStudentGroup(studentId: string, distributionId: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('group_students')
        .select('groups(id, theme_id, social_cohesion_score)')
        .eq('student_id', studentId)
        .eq('groups.distribution_id', distributionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? (data as any).groups : null;
    } catch (error: any) {
      const errorMessage = String(error?.message || '').toLowerCase();
      const missingCohesionColumn =
        errorMessage.includes('social_cohesion_score') &&
        (errorMessage.includes('does not exist') || errorMessage.includes('not exist'));

      if (!missingCohesionColumn) {
        throw error;
      }

      const { data, error: fallbackError } = await this.client
        .from('group_students')
        .select('groups(id, theme_id)')
        .eq('student_id', studentId)
        .eq('groups.distribution_id', distributionId)
        .single();

      if (fallbackError && fallbackError.code !== 'PGRST116') {
        throw fallbackError;
      }

      return data ? (data as any).groups : null;
    }
  }

  /**
   * Busca alunos de uma distribuicao por nome (case-insensitive), com limite.
   */
  async searchStudentsByDistribution(
    distributionId: string,
    query: string,
    excludeIds: string[] = [],
    limit: number = 20
  ): Promise<any[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const { data, error } = await this.client
      .from('students')
      .select('id, name, course, phase')
      .eq('distribution_id', distributionId);

    if (error) {
      throw error;
    }

    const excluded = new Set(excludeIds);
    const normalizedQuery = this.normalizeNameForMatch(trimmed);
    const queryTokens = this.tokenizeName(normalizedQuery);

    type ScoredCandidate = {
      student: any;
      score: number;
    };

    const scored: ScoredCandidate[] = [];

    for (const student of data || []) {
      if (excluded.has(student.id)) {
        continue;
      }

      const normalizedName = this.normalizeNameForMatch(String(student.name || ''));
      if (!normalizedName) {
        continue;
      }

      const candidateTokens = this.tokenizeName(normalizedName);
      if (candidateTokens.length === 0) {
        continue;
      }

      const isExact = normalizedName === normalizedQuery;
      const startsWith = normalizedName.startsWith(normalizedQuery);
      const contains = normalizedName.includes(normalizedQuery);
      const fullSimilarity = this.computeSimilarity(normalizedQuery, normalizedName);

      const tokenScores = queryTokens.map((queryToken) => {
        let bestTokenScore = 0;
        for (const candidateToken of candidateTokens) {
          bestTokenScore = Math.max(bestTokenScore, this.computeSimilarity(queryToken, candidateToken));
        }
        return bestTokenScore;
      });

      const avgTokenScore =
        tokenScores.length > 0
          ? tokenScores.reduce((sum, value) => sum + value, 0) / tokenScores.length
          : 0;

      const tokenCoverage =
        tokenScores.filter((value) => value >= 0.7).length / Math.max(1, queryTokens.length);

      const score =
        (isExact ? 0.5 : 0) +
        (startsWith ? 0.2 : 0) +
        (contains ? 0.15 : 0) +
        avgTokenScore * 0.1 +
        fullSimilarity * 0.05;

      const acceptable =
        isExact ||
        startsWith ||
        contains ||
        avgTokenScore >= 0.72 ||
        (tokenCoverage >= 0.75 && avgTokenScore >= 0.64) ||
        (queryTokens.length === 1 && fullSimilarity >= 0.7);

      if (acceptable) {
        scored.push({ student, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return String(a.student.name || '').localeCompare(String(b.student.name || ''));
    });

    return scored.slice(0, limit).map((item) => item.student);
  }

  /**
   * Estado de acesso do aluno por distribuicao.
   * Fonte de verdade para abertura/fechamento das telas publicas.
   */
  async getStudentAccessState(distributionId: string): Promise<{
    distributionId: string;
    status: string;
    themesConfigured: boolean;
    groupsCreated: boolean;
    registrationOpen: boolean;
    resultsAvailable: boolean;
    affinitiesOpen: boolean;
    phase2Executed: boolean;
  }> {
    const distribution = await this.getDistribution(distributionId);
    if (!distribution) {
      throw new Error('Distribuicao nao encontrada');
    }

    const themes = await this.getThemesByDistribution(distributionId);
    const groups = await this.getGroupsByDistribution(distributionId);

    const status = String(distribution.status || 'PENDING').toUpperCase();
    const themesConfigured = themes.length > 0;
    const groupsCreated = groups.length > 0;

    const phase2Executed = status === 'PHASE2_COMPLETED';
    const registrationBlockedStatuses = new Set([
      'EXECUTING',
      'COMPLETED',
      'PARTIAL',
      'PHASE2',
      'PHASE2_EXECUTING',
      'PHASE2_COMPLETED',
      'FAILED',
    ]);

    // Cadastro so abre apos temas e fecha ao iniciar execucao da Fase 1.
    const registrationOpen = themesConfigured && !groupsCreated && !registrationBlockedStatuses.has(status);

    // Resultado abre quando grupos existem (apos Fase 1).
    const resultsAvailable = groupsCreated;

    // Afinidades so abrem quando o organizador habilita explicitamente a Fase 2.
    const affinitiesOpen = groupsCreated && status === 'PHASE2' && !phase2Executed;

    return {
      distributionId,
      status,
      themesConfigured,
      groupsCreated,
      registrationOpen,
      resultsAvailable,
      affinitiesOpen,
      phase2Executed,
    };
  }

  // ============================================================
  // STUDENT_SESSIONS - Sessao JWT de Aluno
  // ============================================================

  async createStudentSessionRecord(input: {
    studentId: string;
    distributionId: string;
    refreshTokenHash: string;
    csrfTokenHash: string;
    expiresAt: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    const { error } = await this.client
      .from('student_sessions')
      .insert({
        student_id: input.studentId,
        distribution_id: input.distributionId,
        refresh_token_hash: input.refreshTokenHash,
        csrf_token_hash: input.csrfTokenHash,
        expires_at: input.expiresAt,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
      });

    if (error) {
      throw error;
    }
  }

  async getStudentSessionByRefreshHash(refreshTokenHash: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('student_sessions')
      .select('*')
      .eq('refresh_token_hash', refreshTokenHash)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  }

  async revokeStudentSessionByRefreshHash(
    refreshTokenHash: string,
    reason: string,
    replacedByHash?: string
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      revoked_at: new Date().toISOString(),
      revoke_reason: reason,
    };

    if (replacedByHash) {
      payload.replaced_by_hash = replacedByHash;
    }

    const { error } = await this.client
      .from('student_sessions')
      .update(payload)
      .eq('refresh_token_hash', refreshTokenHash)
      .is('revoked_at', null);

    if (error) {
      throw error;
    }
  }

  async revokeStudentSessionsByStudent(studentId: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from('student_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
      })
      .eq('student_id', studentId)
      .is('revoked_at', null);

    if (error) {
      throw error;
    }
  }

  // ============================================================
  // SECURITY_AUDIT_LOGS - Auditoria de seguranca
  // ============================================================

  async logSecurityAuditEvent(input: {
    actorType: 'anonymous' | 'student' | 'organizer' | 'system';
    actorId?: string | null;
    eventType: string;
    path?: string | null;
    method?: string | null;
    statusCode?: number | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const { error } = await this.client
      .from('security_audit_logs')
      .insert({
        actor_type: input.actorType,
        actor_id: input.actorId || null,
        event_type: input.eventType,
        path: input.path || null,
        method: input.method || null,
        status_code: input.statusCode || null,
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
        metadata: input.metadata || {},
      });

    if (error) {
      throw error;
    }
  }

  // ============================================================
  // TRANSAÇÕES - Operações Atômicas
  // ============================================================

  /**
   * Salva solução completa (todos os grupos e alocações)
   */
  async saveSolution(
    distributionId: string,
    solution: Solution
  ): Promise<void> {
    try {
      // 1. Criar grupos e suas alocações
      for (const group of solution.groups) {
        // Criar grupo
        const groupId = await this.createGroup(group.themeId, distributionId);

        // Adicionar alunos ao grupo
        for (const student of group.students) {
          await this.addStudentToGroup(groupId, student.id);
        }
      }

      // 2. Marcar distribuição como concluída
      await this.markDistributionExecuted(distributionId);
    } catch (error) {
      await this.updateDistributionStatus(distributionId, 'FAILED');
      throw error;
    }
  }

  /**
   * Busca solução completa (grupos + alunos + tema)
   */
  async getSolution(distributionId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('groups')
      .select(`
        id,
        theme_id,
        themes(name, description),
        group_students(
          student_id,
          students(name, course, phase)
        )
      `)
      .eq('distribution_id', distributionId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Limpa solução anterior (para redistribuição)
   */
  async clearDistributionGroups(distributionId: string): Promise<void> {
    // Buscar todos os grupos da distribuição
    const groups = await this.getGroupsByDistribution(distributionId);

    // Deletar cada grupo (cascata deleta group_students)
    for (const group of groups) {
      const { error } = await this.client
        .from('groups')
        .delete()
        .eq('id', group.id);

      if (error) {
        throw error;
      }
    }
  }

  /**
   * Limpa alunos e dados relacionados de uma distribuicao.
   * Usado no seed para reconstruir um dataset consistente.
   */
  async clearDistributionStudents(distributionId: string): Promise<void> {
    const studentIds = await this.getStudentIdsByDistribution(distributionId);
    if (!studentIds.length) {
      return;
    }

    // Remover vínculos de grupo por aluno, se ainda existirem.
    const { error: groupStudentsError } = await this.client
      .from('group_students')
      .delete()
      .in('student_id', studentIds);
    if (groupStudentsError) {
      throw groupStudentsError;
    }

    const { error: prefsError } = await this.client
      .from('student_preferences')
      .delete()
      .in('student_id', studentIds);
    if (prefsError) {
      throw prefsError;
    }

    const { error: affinitiesBySourceError } = await this.client
      .from('student_affinities')
      .delete()
      .in('student_id', studentIds);
    if (affinitiesBySourceError) {
      throw affinitiesBySourceError;
    }

    const { error: affinitiesByTargetError } = await this.client
      .from('student_affinities')
      .delete()
      .in('target_student_id', studentIds);
    if (affinitiesByTargetError) {
      throw affinitiesByTargetError;
    }

    const { error: studentsError } = await this.client
      .from('students')
      .delete()
      .eq('distribution_id', distributionId);
    if (studentsError) {
      throw studentsError;
    }
  }

  // ============================================================
  // STATISTICS - Estatísticas de Distribuições
  // ============================================================

  /**
   * Obtém estatísticas de resposta de alunos para uma distribuição
   */
  async getDistributionStatistics(distributionId: string): Promise<{
    totalStudents: number;
    studentsWithPreferences: number;
    studentsWithAffinities: number;
    courseBreakdown: { course: string; count: number }[];
    phaseBreakdown: { phase: number; count: number }[];
    preferenceCompletionRate: number;
    affinityCompletionRate: number;
    phase1Executed: boolean;
  }> {
    // 1. Registro oficial ativo define o total esperado de alunos.
    const { data: registryRows, error: registryError } = await this.client
      .from('student_registry')
      .select('origem_aluno, fase_turma')
      .eq('distribution_id', distributionId)
      .eq('active', true);

    if (registryError) {
      throw registryError;
    }

    let totalStudents = (registryRows || []).length;
    let courseBreakdown: { course: string; count: number }[] = [];
    let phaseBreakdown: { phase: number; count: number }[] = [];

    if (totalStudents > 0) {
      const courseCounts: { [key: string]: number } = {};
      const phaseCounts: { [key: number]: number } = {};

      for (const row of registryRows || []) {
        const mappedCourse = mapOrigemAlunoToCourse(String((row as any).origem_aluno || ''));
        if (mappedCourse) {
          courseCounts[mappedCourse] = (courseCounts[mappedCourse] || 0) + 1;
        }

        const phase = Number((row as any).fase_turma);
        if (Number.isInteger(phase) && phase >= 1 && phase <= 10) {
          phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
        }
      }

      courseBreakdown = Object.entries(courseCounts)
        .map(([course, count]) => ({
          course,
          count,
        }))
        .sort((a, b) => a.course.localeCompare(b.course));

      phaseBreakdown = Object.entries(phaseCounts)
        .map(([phase, count]) => ({
          phase: parseInt(phase, 10),
          count,
        }))
        .sort((a, b) => a.phase - b.phase);
    }

    // 2. Alunos operacionais representam quem de fato respondeu no fluxo.
    const { data: students, error: studentsError } = await this.client
      .from('students')
      .select('id, course, phase')
      .eq('distribution_id', distributionId);

    if (studentsError) {
      throw studentsError;
    }

    // Fallback legado para distribuicoes antigas sem student_registry carregado.
    if (totalStudents === 0) {
      totalStudents = students?.length || 0;

      const legacyCourseCounts: { [key: string]: number } = {};
      const legacyPhaseCounts: { [key: number]: number } = {};

      (students || []).forEach((s: any) => {
        legacyCourseCounts[s.course] = (legacyCourseCounts[s.course] || 0) + 1;
        legacyPhaseCounts[s.phase] = (legacyPhaseCounts[s.phase] || 0) + 1;
      });

      courseBreakdown = Object.entries(legacyCourseCounts)
        .map(([course, count]) => ({
          course,
          count,
        }))
        .sort((a, b) => a.course.localeCompare(b.course));

      phaseBreakdown = Object.entries(legacyPhaseCounts)
        .map(([phase, count]) => ({
          phase: parseInt(phase, 10),
          count,
        }))
        .sort((a, b) => a.phase - b.phase);
    }

    const studentIds = (students || []).map((s: any) => s.id);
    let studentsWithPreferences = 0;
    let studentsWithAffinities = 0;

    if (studentIds.length > 0) {
      const { data: preferencesData, error: prefsError } = await this.client
        .from('student_preferences')
        .select('student_id')
        .in('student_id', studentIds);

      if (prefsError) {
        throw prefsError;
      }

      const studentsWithPrefsSet = new Set(preferencesData?.map((p: any) => p.student_id) || []);
      studentsWithPreferences = studentsWithPrefsSet.size;

      const { data: affinitiesData, error: affError } = await this.client
        .from('student_affinities')
        .select('student_id')
        .in('student_id', studentIds);

      if (affError) {
        throw affError;
      }

      const studentsWithAffinitiesSet = new Set(affinitiesData?.map((a: any) => a.student_id) || []);
      studentsWithAffinities = studentsWithAffinitiesSet.size;
    }

    const safeTotalStudents = Math.max(0, totalStudents);
    const boundedStudentsWithPreferences = Math.min(studentsWithPreferences, safeTotalStudents);
    const boundedStudentsWithAffinities = Math.min(studentsWithAffinities, safeTotalStudents);

    const preferenceCompletionRate =
      safeTotalStudents > 0 ? (boundedStudentsWithPreferences / safeTotalStudents) * 100 : 0;
    const affinityCompletionRate =
      safeTotalStudents > 0 ? (boundedStudentsWithAffinities / safeTotalStudents) * 100 : 0;

    const { data: distributionData } = await this.client
      .from('distributions')
      .select('status')
      .eq('id', distributionId)
      .single();

    const phase1Executed = ['COMPLETED', 'PARTIAL', 'PHASE2', 'PHASE2_EXECUTING', 'PHASE2_COMPLETED']
      .includes(String(distributionData?.status || '').toUpperCase());

    return {
      totalStudents: safeTotalStudents,
      studentsWithPreferences: boundedStudentsWithPreferences,
      studentsWithAffinities: boundedStudentsWithAffinities,
      courseBreakdown,
      phaseBreakdown,
      preferenceCompletionRate,
      affinityCompletionRate,
      phase1Executed,
    };
  }
  async getDistributionGroups(distributionId: string): Promise<any[]> {
    const { data: groups, error: groupsError } = await this.client
      .from('groups')
      .select('id, theme_id, distribution_id, created_at')
      .eq('distribution_id', distributionId)
      .order('created_at', { ascending: true });

    if (groupsError) {
      throw groupsError;
    }

    if (!groups || groups.length === 0) {
      return [];
    }

    // Para cada grupo, buscar membros e tema
    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        // Buscar membros do grupo
        const { data: members, error: membersError } = await this.client
          .from('group_students')
          .select('student_id')
          .eq('group_id', group.id);

        if (membersError) {
          throw membersError;
        }

        // Buscar detalhes dos estudantes
        const studentIds = members?.map(m => m.student_id) || [];
        let students: any[] = [];

        if (studentIds.length > 0) {
          const { data: studentsData, error: studentsError } = await this.client
            .from('students')
            .select('id, name, course, phase')
            .in('id', studentIds);

          if (studentsError) {
            throw studentsError;
          }

          students = studentsData || [];
        }

        // Buscar tema
        let theme: any = null;
        if (group.theme_id) {
          const { data: themeData, error: themeError } = await this.client
            .from('themes')
            .select('id, name')
            .eq('id', group.theme_id)
            .single();

          if (!themeError && themeData) {
            theme = themeData;
          }
        }

        return {
          id: group.id,
          theme: theme,
          members: students,
          memberCount: students.length,
          createdAt: group.created_at,
        };
      })
    );

    return groupsWithDetails;
  }

  // ============================================================
  // SAÚDE DA CONEXÃO
  // ============================================================

  /**
   * Verifica se conexão com Supabase está ativa
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('distributions')
        .select('count', { count: 'exact' })
        .limit(1);

      if (error) {
        console.error('❌ Supabase Health Check Error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('❌ Supabase Health Check Exception:', err.message);
      return false;
    }
  }
}

