import {
  Course,
  Phase,
  ThemePreference,
  StudentData,
  isCourse,
  isPhase
} from './types';

/**
 * Classe Student - Representa um aluno na atividade
 *
 * Um aluno tem:
 * - ID único (matrícula/UUID)
 * - Nome
 * - Curso (EE ou ME)
 * - Fase (1-10)
 * - Preferências de temas ordenadas por rank
 * - Grupo atribuído (opcional)
 */
export class Student {
  id: string;
  name: string;
  course: Course;
  phase: Phase;
  preferences: ThemePreference[];  // Ordenado por rank ascendente
  groupId?: string;                 // Atribuído durante distribuição
  createdAt: Date;
  updatedAt: Date;

  /**
   * Constructor
   * @param id ID único do aluno (matrícula ou UUID)
   * @param name Nome completo
   * @param course Curso (EE ou ME)
   * @param phase Fase do curso (1-10)
   * @param preferences Preferências de temas
   */
  constructor(
    id: string,
    name: string,
    course: Course,
    phase: Phase,
    preferences: ThemePreference[] = [],
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    if (!id || id.trim() === '') {
      throw new Error('ID do aluno não pode estar vazio');
    }
    if (!name || name.trim() === '') {
      throw new Error('Nome do aluno não pode estar vazio');
    }
    if (!isCourse(course)) {
      throw new Error(`Curso inválido: ${course}. Use Course.ELECTRICAL_ENGINEERING ou Course.MECHANICAL_ENGINEERING`);
    }
    if (!isPhase(phase)) {
      throw new Error(`Fase inválida: ${phase}. Deve estar entre 1 e 10`);
    }

    this.id = id;
    this.name = name.trim();
    this.course = course;
    this.phase = phase;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;

    // Ordenar preferências por rank e calcular scores
    this.preferences = this.processPreferences(preferences);
  }

  /**
   * Processa preferências: ordena por rank e calcula scores
   */
  private processPreferences(prefs: ThemePreference[]): ThemePreference[] {
    // Ordenar por rank
    const sorted = [...prefs].sort((a, b) => a.rank - b.rank);

    // Calcular scores (1000 / rank, quanto menor o rank, maior o score)
    return sorted.map((pref, index) => ({
      ...pref,
      score: 1000 / (index + 1)  // Usar índice para evitar divisão por zero
    }));
  }

  /**
   * Verifica se o aluno é de Engenharia Elétrica
   */
  isElectrical(): boolean {
    return this.course === Course.ELECTRICAL_ENGINEERING;
  }

  /**
   * Verifica se o aluno é de Engenharia Mecânica
   */
  isMechanical(): boolean {
    return this.course === Course.MECHANICAL_ENGINEERING;
  }

  /**
   * Obtém a preferência de maior prioridade (mais preferida)
   */
  getTopPreference(): ThemePreference | undefined {
    return this.preferences[0];
  }

  /**
   * Obtém a preferência de menor prioridade (menos preferida)
   */
  getLowestPreference(): ThemePreference | undefined {
    return this.preferences[this.preferences.length - 1];
  }

  /**
   * Obtém preferência para um tema específico
   */
  getPreferenceForTheme(themeId: string): ThemePreference | undefined {
    return this.preferences.find(p => p.themeId === themeId);
  }

  /**
   * Obtém score de satisfação para um tema
   * Score maior = mais satisfeito
   * Retorna 0 se tema não está nas preferências
   */
  getThemeScore(themeId: string): number {
    const pref = this.getPreferenceForTheme(themeId);
    return pref?.score ?? 0;
  }

  /**
   * Obtém ranking de um tema
   * Retorna -1 se tema não está nas preferências
   */
  getThemeRank(themeId: string): number {
    const pref = this.getPreferenceForTheme(themeId);
    return pref?.rank ?? -1;
  }

  /**
   * Verifica se aluno tem preferência por um tema
   */
  hasPreferenceFor(themeId: string): boolean {
    return this.preferences.some(p => p.themeId === themeId);
  }

  /**
   * Obtém número de preferências
   */
  getPreferenceCount(): number {
    return this.preferences.length;
  }

  /**
   * Adiciona uma nova preferência (mantém ordenação)
   */
  addPreference(preference: ThemePreference): void {
    // Verificar se já existe
    if (this.hasPreferenceFor(preference.themeId)) {
      throw new Error(`Aluno ${this.id} já tem preferência por tema ${preference.themeId}`);
    }

    this.preferences.push(preference);
    this.preferences = this.processPreferences(this.preferences);
  }

  /**
   * Remove uma preferência
   */
  removePreference(themeId: string): void {
    this.preferences = this.preferences.filter(p => p.themeId !== themeId);
    this.preferences = this.processPreferences(this.preferences);
  }

  /**
   * Atribui o aluno a um grupo
   */
  assignToGroup(groupId: string): void {
    if (!groupId || groupId.trim() === '') {
      throw new Error('ID do grupo não pode estar vazio');
    }
    this.groupId = groupId;
    this.updatedAt = new Date();
  }

  /**
   * Remove atribuição de grupo
   */
  unassignFromGroup(): void {
    this.groupId = undefined;
    this.updatedAt = new Date();
  }

  /**
   * Verifica se aluno está atribuído a um grupo
   */
  isAssigned(): boolean {
    return !!this.groupId;
  }

  /**
   * Obtém representação string do aluno
   */
  toString(): string {
    return `${this.name} (${this.id}) - ${this.course} - Fase ${this.phase}`;
  }

  /**
   * Obtém representação JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      course: this.course,
      phase: this.phase,
      preferences: this.preferences,
      affinities: Object.fromEntries(this.affinities), // Converter Map para objeto
      groupId: this.groupId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Cria Student a partir de dados do banco
   */
  static fromData(
    data: StudentData,
    preferences: ThemePreference[] = [],
    affinities: { targetId: string, level: number }[] = []
  ): Student {
    const student = new Student(
      data.id,
      data.name,
      data.course,
      data.phase,
      preferences,
      new Date(data.created_at),
      new Date(data.updated_at)
    );

    // Carregar afinidades
    for (const aff of affinities) {
      student.setAffinity(aff.targetId, aff.level);
    }

    return student;
  }

  // ========================================
  // Gestão de Afinidade Social
  // ========================================

  /**
   * Mapa de afinidades: targetStudentId -> level (-1 a 1)
   */
  affinities: Map<string, number> = new Map();

  /**
   * Define afinidade com outro aluno
   * @param targetStudentId ID do aluno alvo
   * @param level Nível de afinidade (-1: rejeição, 0: neutro, 1: afinidade)
   */
  setAffinity(targetStudentId: string, level: number): void {
    if (targetStudentId === this.id) return; // Não pode ter afinidade consigo mesmo

    // Normalizar level entre -1 e 1
    const normalizedLevel = Math.max(-1, Math.min(1, level));
    this.affinities.set(targetStudentId, normalizedLevel);
  }

  /**
   * Obtém afinidade com outro aluno
   * Retorna 0 se não houver declaração explícita
   */
  getAffinity(targetStudentId: string): number {
    return this.affinities.get(targetStudentId) || 0;
  }

  /**
   * Verifica se tem alguma afinidade declarada
   */
  hasAffinity(targetStudentId: string): boolean {
    return this.affinities.has(targetStudentId);
  }
}
