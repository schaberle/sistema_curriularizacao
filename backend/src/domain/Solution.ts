import { Group } from './Group';
import { Student } from './Student';
import { ConstraintViolation } from './types';

/**
 * Classe Solution - Representa uma solução completa de distribuição
 *
 * Uma solução contém:
 * - Lista de grupos formados
 * - Score de satisfação total
 * - Lista de violações de restrições (se houver)
 * - Metadata (timestamp, se é viável, etc)
 */
export class Solution {
  groups: Group[];
  constraintViolations: ConstraintViolation[];
  totalScore: number;
  createdAt: Date;
  iterationCount: number;  // Número de iterações do algoritmo
  computeTimeMs: number;   // Tempo de computação em ms

  /**
   * Constructor
   * @param groups Lista de grupos formados
   * @param constraints Violações de restrição (opcional)
   * @param totalScore Score de satisfação (opcional)
   */
  constructor(
    groups: Group[] = [],
    constraints: ConstraintViolation[] = [],
    totalScore: number = 0,
    iterationCount: number = 0,
    computeTimeMs: number = 0
  ) {
    this.groups = groups;
    this.constraintViolations = constraints;
    this.totalScore = totalScore;
    this.createdAt = new Date();
    this.iterationCount = iterationCount;
    this.computeTimeMs = computeTimeMs;
  }

  /**
   * Adiciona uma violação de restrição
   */
  addViolation(violation: ConstraintViolation): void {
    this.constraintViolations.push(violation);
  }

  /**
   * Limpa todas as violações
   */
  clearViolations(): void {
    this.constraintViolations = [];
  }

  /**
   * Obtém número de violações
   */
  getViolationCount(): number {
    return this.constraintViolations.length;
  }

  /**
   * Obtém número de violações críticas
   */
  getCriticalViolationCount(): number {
    return this.constraintViolations.filter(v => v.severity === 'CRITICAL').length;
  }

  /**
   * Obtém número de violações importantes
   */
  getImportantViolationCount(): number {
    return this.constraintViolations.filter(v => v.severity === 'IMPORTANT').length;
  }

  /**
   * Obtém número de violações desejáveis
   */
  getDesirableViolationCount(): number {
    return this.constraintViolations.filter(v => v.severity === 'DESIRABLE').length;
  }

  /**
   * Verifica se a solução é viável (sem violações críticas)
   */
  isFeasible(): boolean {
    return this.getCriticalViolationCount() === 0;
  }

  /**
   * Verifica se a solução é ótima (sem violações de nenhum tipo)
   */
  isOptimal(): boolean {
    return this.getViolationCount() === 0;
  }

  /**
   * Obtém número de grupos
   */
  getGroupCount(): number {
    return this.groups.length;
  }

  /**
   * Obtém número total de alunos alocados
   */
  getAllocatedStudentCount(): number {
    return this.groups.reduce((sum, g) => sum + g.getStudentCount(), 0);
  }

  /**
   * Obtém lista de todos os alunos na solução
   */
  getAllStudents(): Student[] {
    const students: Student[] = [];
    for (const group of this.groups) {
      students.push(...group.students);
    }
    return students;
  }

  /**
   * Obtém grupo para um aluno específico
   */
  getGroupForStudent(studentId: string): Group | undefined {
    return this.groups.find(g => g.hasStudent(studentId));
  }

  /**
   * Obtém grupos para um tema específico
   */
  getGroupsForTheme(themeId: string): Group[] {
    return this.groups.filter(g => g.themeId === themeId);
  }

  /**
   * Obtém número de grupos por tema
   */
  getGroupCountByTheme(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const group of this.groups) {
      counts[group.themeId] = (counts[group.themeId] || 0) + 1;
    }

    return counts;
  }

  /**
   * Obtém score total de satisfação
   */
  getTotalScore(): number {
    return this.totalScore;
  }

  /**
   * Obtém score médio por aluno
   */
  getAverageScorePerStudent(): number {
    const studentCount = this.getAllocatedStudentCount();
    if (studentCount === 0) return 0;
    return this.totalScore / studentCount;
  }

  /**
   * Obtém score médio por grupo
   */
  getAverageScorePerGroup(): number {
    if (this.groups.length === 0) return 0;
    return this.totalScore / this.groups.length;
  }

  /**
   * Obtém relatório de violações agrupado por tipo
   */
  getViolationReport(): Record<string, ConstraintViolation[]> {
    const report: Record<string, ConstraintViolation[]> = {};

    for (const violation of this.constraintViolations) {
      if (!report[violation.type]) {
        report[violation.type] = [];
      }
      report[violation.type].push(violation);
    }

    return report;
  }

  /**
   * Obtém resumo da solução
   */
  getSummary() {
    return {
      groupCount: this.getGroupCount(),
      allocatedStudents: this.getAllocatedStudentCount(),
      totalScore: this.totalScore,
      averageScorePerStudent: this.getAverageScorePerStudent(),
      isFeasible: this.isFeasible(),
      isOptimal: this.isOptimal(),
      criticalViolations: this.getCriticalViolationCount(),
      importantViolations: this.getImportantViolationCount(),
      desirableViolations: this.getDesirableViolationCount(),
      groupsByTheme: this.getGroupCountByTheme(),
      iterationCount: this.iterationCount,
      computeTimeMs: this.computeTimeMs
    };
  }

  /**
   * Obtém representação string
   */
  toString(): string {
    return (
      `Solution: ${this.getGroupCount()} grupos, ` +
      `${this.getAllocatedStudentCount()} alunos, ` +
      `Score: ${this.totalScore.toFixed(2)}, ` +
      `Viável: ${this.isFeasible() ? 'SIM' : 'NÃO'}, ` +
      `Violações: ${this.getViolationCount()}`
    );
  }

  /**
   * Obtém representação JSON
   */
  toJSON() {
    return {
      id: new Date().getTime(), // Usar timestamp como ID temporário
      groups: this.groups.map(g => g.toJSON()),
      constraintViolations: this.constraintViolations,
      totalScore: this.totalScore,
      summary: this.getSummary(),
      createdAt: this.createdAt,
      iterationCount: this.iterationCount,
      computeTimeMs: this.computeTimeMs
    };
  }
}
