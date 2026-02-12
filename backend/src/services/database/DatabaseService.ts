import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Student, Theme, Group, Solution } from '../../domain';

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
    this.client = createClient(supabaseUrl, supabaseKey);
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
   * Atualiza status da distribuição
   */
  async updateDistributionStatus(
    distributionId: string,
    status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED'
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
    distributionId: string
  ): Promise<string> {
    const { data, error } = await this.client
      .from('students')
      .insert({
        name,
        course,
        phase,
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
   * Busca aluno por nome (para resultado público)
   */
  async getStudentByName(name: string, distributionId: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('students')
      .select('*')
      .eq('name', name)
      .eq('distribution_id', distributionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
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
  // THEMES - Gerenciamento de Temas
  // ============================================================

  /**
   * Cria novo tema
   */
  async createTheme(
    name: string,
    description: string,
    maxGroups: number,
    distributionId: string
  ): Promise<string> {
    const { data, error } = await this.client
      .from('themes')
      .insert({
        name,
        description,
        max_groups: maxGroups,
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
    const { data, error } = await this.client
      .from('group_students')
      .select('groups(id, theme_id)')
      .eq('student_id', studentId)
      .eq('groups.distribution_id', distributionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data ? (data as any).groups : null;
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

      return !error;
    } catch {
      return false;
    }
  }
}
