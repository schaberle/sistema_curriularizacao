import { Student } from './Student';
import { GROUP_SIZE, GroupComposition, GroupData } from './types';

/**
 * Classe Group - Representa um grupo de alunos
 *
 * Um grupo tem:
 * - ID único
 * - Tema ao qual está atribuído
 * - Exatamente 4 alunos
 * - Timestamps de criação
 */
export class Group {
  id: string;
  themeId: string;
  distributionId: string;
  students: Student[];  // Normalmente 4 alunos (3-5 permitido para sobras)
  createdAt: Date;
  updatedAt: Date;

  /**
   * Constructor
   * @param id ID único do grupo
   * @param themeId ID do tema ao qual o grupo está atribuído
   * @param distributionId ID da distribuição
   * @param students Lista de alunos no grupo (0-4)
   */
  constructor(
    id: string,
    themeId: string,
    distributionId: string,
    students: Student[] = [],
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    if (!id || id.trim() === '') {
      throw new Error('ID do grupo não pode estar vazio');
    }
    if (!themeId || themeId.trim() === '') {
      throw new Error('ID do tema não pode estar vazio');
    }
    if (!distributionId || distributionId.trim() === '') {
      throw new Error('ID da distribuição não pode estar vazio');
    }
    if (students.length > GROUP_SIZE + 1) {
      throw new Error(`Grupo não pode ter mais de ${GROUP_SIZE + 1} alunos`);
    }

    this.id = id;
    this.themeId = themeId;
    this.distributionId = distributionId;
    this.students = [...students];
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Adiciona um aluno ao grupo
   */
  addStudent(student: Student): void {
    if (this.students.length >= GROUP_SIZE + 1) {
      throw new Error(`Grupo ${this.id} já está cheio (${GROUP_SIZE + 1} alunos)`);
    }
    if (this.hasStudent(student.id)) {
      throw new Error(`Aluno ${student.id} já está no grupo`);
    }

    this.students.push(student);
    student.assignToGroup(this.id);
    this.updatedAt = new Date();
  }

  /**
   * Remove um aluno do grupo
   */
  removeStudent(studentId: string): void {
    const index = this.students.findIndex(s => s.id === studentId);
    if (index === -1) {
      throw new Error(`Aluno ${studentId} não está no grupo`);
    }

    const student = this.students[index];
    this.students.splice(index, 1);
    student.unassignFromGroup();
    this.updatedAt = new Date();
  }

  /**
   * Verifica se um aluno está no grupo
   */
  hasStudent(studentId: string): boolean {
    return this.students.some(s => s.id === studentId);
  }

  /**
   * Obtém número de alunos no grupo
   */
  getStudentCount(): number {
    return this.students.length;
  }

  /**
   * Verifica se grupo está cheio (atingiu tamanho padrão)
   */
  isFull(): boolean {
    return this.students.length >= GROUP_SIZE;
  }

  /**
   * Verifica se grupo está vazio
   */
  isEmpty(): boolean {
    return this.students.length === 0;
  }

  /**
   * Obtém composição do grupo (análise de restrições)
   */
  getComposition(): GroupComposition {
    const electricalCount = this.students.filter(s => s.isElectrical()).length;
    const mechanicalCount = this.students.filter(s => s.isMechanical()).length;
    const phases = new Set(this.students.map(s => s.phase));

    return {
      electricalCount,
      mechanicalCount,
      phases
    };
  }

  /**
   * Obtém quantidade de alunos de Eng. Elétrica
   */
  getElectricalCount(): number {
    return this.students.filter(s => s.isElectrical()).length;
  }

  /**
   * Obtém quantidade de alunos de Eng. Mecânica
   */
  getMechanicalCount(): number {
    return this.students.filter(s => s.isMechanical()).length;
  }

  /**
   * Obtém número de fases distintas no grupo
   */
  getDistinctPhaseCount(): number {
    return new Set(this.students.map(s => s.phase)).size;
  }

  /**
   * Obtém lista de fases no grupo
   */
  getPhases(): Set<number> {
    return new Set(this.students.map(s => s.phase));
  }

  /**
   * Verifica se todos alunos são de fases diferentes
   */
  hasAllDifferentPhases(): boolean {
    return this.getDistinctPhaseCount() === this.getStudentCount();
  }

  /**
   * Obtém score total de satisfação do grupo
   * (soma dos scores dos alunos para o tema)
   */
  getTotalSatisfactionScore(): number {
    return this.students.reduce((sum, student) => {
      return sum + student.getThemeScore(this.themeId);
    }, 0);
  }

  /**
   * Obtém score médio de satisfação
   */
  getAverageSatisfactionScore(): number {
    if (this.isEmpty()) return 0;
    return this.getTotalSatisfactionScore() / this.getStudentCount();
  }

  /**
   * Obtém representação string do grupo
   */
  toString(): string {
    const comp = this.getComposition();
    return (
      `Grupo ${this.id} (Tema: ${this.themeId}) - ` +
      `${this.getStudentCount()}/${GROUP_SIZE} alunos, ` +
      `${comp.electricalCount} EE, ${comp.mechanicalCount} ME, ` +
      `${comp.phases.size} fases`
    );
  }

  /**
   * Obtém representação JSON
   */
  toJSON() {
    return {
      id: this.id,
      themeId: this.themeId,
      distributionId: this.distributionId,
      students: this.students.map(s => s.toJSON()),
      composition: this.getComposition(),
      satisfactionScore: {
        total: this.getTotalSatisfactionScore(),
        average: this.getAverageSatisfactionScore()
      },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Cria Group a partir de dados do banco
   */
  static fromData(
    data: GroupData,
    students: Student[] = []
  ): Group {
    return new Group(
      data.id,
      data.theme_id,
      data.distribution_id,
      students,
      new Date(data.created_at),
      new Date(data.updated_at)
    );
  }
}
