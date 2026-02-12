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
  totalScore: number;                    // DEPRECATED: usar totalEnergy (modelo ideal)
  totalEnergy: number;                   // Energia total (Fase 1 - modelo ideal)
  socialScore: number;                   // Score social (Fase 2 - opcional)
  createdAt: Date;
  iterationCount: number;                // Número de iterações do algoritmo
  computeTimeMs: number;                 // Tempo de computação em ms
  socialOptimizationApplied: boolean;    // Se Fase 2 foi aplicada

  /**
   * Constructor
   * @param groups Lista de grupos formados
   * @param constraints Violações de restrição (opcional)
   * @param totalScore Score de satisfação (DEPRECATED, usar totalEnergy)
   * @param iterationCount Número de iterações
   * @param computeTimeMs Tempo em ms
   * @param totalEnergy Energia total (Fase 1)
   * @param socialScore Score social (Fase 2)
   * @param socialOptimizationApplied Se Fase 2 foi aplicada
   */
  constructor(
    groups: Group[] = [],
    constraints: ConstraintViolation[] = [],
    totalScore: number = 0,
    iterationCount: number = 0,
    computeTimeMs: number = 0,
    totalEnergy: number = 0,
    socialScore: number = 0,
    socialOptimizationApplied: boolean = false
  ) {
    this.groups = groups;
    this.constraintViolations = constraints;
    this.totalScore = totalScore;
    this.totalEnergy = totalEnergy;
    this.socialScore = socialScore;
    this.createdAt = new Date();
    this.iterationCount = iterationCount;
    this.computeTimeMs = computeTimeMs;
    this.socialOptimizationApplied = socialOptimizationApplied;
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
   * Obtém score total de satisfação (DEPRECATED, usar getTotalEnergy)
   */
  getTotalScore(): number {
    return this.totalScore;
  }

  /**
   * Obtém energia total (Fase 1 - modelo ideal)
   */
  getTotalEnergy(): number {
    return this.totalEnergy;
  }

  /**
   * Obtém score social (Fase 2 - opcional)
   */
  getSocialScore(): number {
    return this.socialScore;
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
      // Grupos e alunos
      groupCount: this.getGroupCount(),
      allocatedStudents: this.getAllocatedStudentCount(),

      // Scores (modelo legado)
      totalScore: this.totalScore,
      averageScorePerStudent: this.getAverageScorePerStudent(),

      // Energia (modelo ideal - Fase 1)
      totalEnergy: this.totalEnergy,

      // Social (Fase 2)
      socialScore: this.socialScore,
      socialOptimizationApplied: this.socialOptimizationApplied,

      // Viabilidade
      isFeasible: this.isFeasible(),
      isOptimal: this.isOptimal(),

      // Violações (modelo legado)
      criticalViolations: this.getCriticalViolationCount(),
      importantViolations: this.getImportantViolationCount(),
      desirableViolations: this.getDesirableViolationCount(),

      // Distribuição
      groupsByTheme: this.getGroupCountByTheme(),

      // Metadata
      iterationCount: this.iterationCount,
      computeTimeMs: this.computeTimeMs,
      createdAt: this.createdAt
    };
  }

  /**
   * Obtém representação string
   */
  toString(): string {
    const energyStr = this.totalEnergy !== 0 ? `, Energia: ${this.totalEnergy.toFixed(2)}` : '';
    const socialStr = this.socialScore !== 0 ? `, Social: ${this.socialScore.toFixed(2)}` : '';

    return (
      `Solution: ${this.getGroupCount()} grupos, ` +
      `${this.getAllocatedStudentCount()} alunos` +
      energyStr +
      socialStr +
      `, Viável: ${this.isFeasible() ? 'SIM' : 'NÃO'}`
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
      totalEnergy: this.totalEnergy,
      socialScore: this.socialScore,
      socialOptimizationApplied: this.socialOptimizationApplied,
      summary: this.getSummary(),
      createdAt: this.createdAt,
      iterationCount: this.iterationCount,
      computeTimeMs: this.computeTimeMs
    };
  }
}
