import { Group, Solution, Student, ConstraintViolation } from '../../domain';

/**
 * PreferenceScorer - Calcula scores de satisfação e penalidades
 *
 * Score de satisfação é baseado em:
 * 1. Score de preferência do aluno para o tema
 * 2. Penalidades por violações de restrições
 */
export class PreferenceScorer {
  // Penalidades por violações (subtraídas do score)
  private readonly PENALTY_CRITICAL = 5000;     // Muito alto - não aceitar
  private readonly PENALTY_IMPORTANT = 1000;    // Alto - minimizar
  private readonly PENALTY_DESIRABLE = 50;      // Baixo - buscar melhorar

  /**
   * Calcula score de um grupo
   * Base = satisfação dos alunos + penalidades
   */
  calculateGroupScore(group: Group): number {
    let score = 0;

    // Base: satisfação dos alunos para o tema
    for (const student of group.students) {
      score += student.getThemeScore(group.themeId);
    }

    return score;
  }

  /**
   * Calcula score total de uma solução
   * Soma scores de todos os grupos + penalidades
   */
  calculateSolutionScore(solution: Solution): number {
    let score = 0;

    // Score base de satisfação de preferências
    for (const group of solution.groups) {
      score += this.calculateGroupScore(group);
    }

    // Subtrair penalidades por violações
    for (const violation of solution.constraintViolations) {
      if (violation.severity === 'CRITICAL') {
        score -= this.PENALTY_CRITICAL;
      } else if (violation.severity === 'IMPORTANT') {
        score -= this.PENALTY_IMPORTANT;
      } else if (violation.severity === 'DESIRABLE') {
        score -= this.PENALTY_DESIRABLE;
      }
    }

    // Score não pode ser negativo
    return Math.max(0, score);
  }

  /**
   * Calcula delta de score ao mover um aluno entre grupos
   * Positivo = melhoria, Negativo = piora
   */
  calculateMovementDelta(
    student: Student,
    fromGroup: Group,
    toGroup: Group
  ): number {
    // Score ganho ao sair do grupo atual
    const lostScore = student.getThemeScore(fromGroup.themeId);

    // Score ganho ao entrar no novo grupo
    const gainedScore = student.getThemeScore(toGroup.themeId);

    return gainedScore - lostScore;
  }

  /**
   * Calcula score de uma solução considerando apenas satisfação
   * (sem penalidades)
   */
  calculatePureSatisfactionScore(solution: Solution): number {
    let score = 0;

    for (const group of solution.groups) {
      score += this.calculateGroupScore(group);
    }

    return score;
  }

  /**
   * Calcula score de penalidades
   */
  calculatePenaltyScore(violations: ConstraintViolation[]): number {
    let penalty = 0;

    for (const violation of violations) {
      if (violation.severity === 'CRITICAL') {
        penalty += this.PENALTY_CRITICAL;
      } else if (violation.severity === 'IMPORTANT') {
        penalty += this.PENALTY_IMPORTANT;
      } else if (violation.severity === 'DESIRABLE') {
        penalty += this.PENALTY_DESIRABLE;
      }
    }

    return penalty;
  }

  /**
   * Obtém breakdown do score
   */
  getScoreBreakdown(solution: Solution): {
    satisfactionScore: number;
    penaltyScore: number;
    totalScore: number;
    averagePerStudent: number;
    averagePerGroup: number;
  } {
    const satisfactionScore = this.calculatePureSatisfactionScore(solution);
    const penaltyScore = this.calculatePenaltyScore(solution.constraintViolations);
    const totalScore = satisfactionScore - penaltyScore;
    const studentCount = solution.getAllocatedStudentCount();
    const groupCount = solution.getGroupCount();

    return {
      satisfactionScore,
      penaltyScore,
      totalScore,
      averagePerStudent: studentCount > 0 ? totalScore / studentCount : 0,
      averagePerGroup: groupCount > 0 ? totalScore / groupCount : 0
    };
  }

  /**
   * Compara duas soluções
   * Retorna diferença (positivo = primeira é melhor)
   */
  compareSolutions(solution1: Solution, solution2: Solution): number {
    return solution1.totalScore - solution2.totalScore;
  }

  /**
   * Verifica se solução é melhor que outra
   */
  isBetter(solution1: Solution, solution2: Solution): boolean {
    return solution1.totalScore > solution2.totalScore;
  }

  /**
   * Normaliza score para range 0-100
   * Assume score máximo teórico de 100 por aluno
   */
  normalizeScore(solution: Solution): number {
    const studentCount = solution.getAllocatedStudentCount();
    if (studentCount === 0) return 0;

    const maxPossibleScore = studentCount * 1000; // Máximo teórico
    const normalized = (solution.totalScore / maxPossibleScore) * 100;

    return Math.min(100, Math.max(0, normalized));
  }

  /**
   * Obtém grau de satisfação (texto)
   */
  getSatisfactionGrade(solution: Solution): string {
    const normalized = this.normalizeScore(solution);

    if (normalized >= 90) return 'Excelente';
    if (normalized >= 75) return 'Muito Bom';
    if (normalized >= 60) return 'Bom';
    if (normalized >= 45) return 'Aceitável';
    if (normalized >= 30) return 'Fraco';
    return 'Muito Fraco';
  }

  /**
   * Relatório de score
   */
  getScoreReport(solution: Solution): string {
    const breakdown = this.getScoreBreakdown(solution);
    const normalized = this.normalizeScore(solution);
    const grade = this.getSatisfactionGrade(solution);

    return (
      `Score Report:\n` +
      `  Score de Satisfação: ${breakdown.satisfactionScore}\n` +
      `  Score de Penalidades: ${breakdown.penaltyScore}\n` +
      `  Score Total: ${breakdown.totalScore}\n` +
      `  Média por Aluno: ${breakdown.averagePerStudent.toFixed(2)}\n` +
      `  Média por Grupo: ${breakdown.averagePerGroup.toFixed(2)}\n` +
      `  Score Normalizado: ${normalized.toFixed(1)}/100\n` +
      `  Grau: ${grade}`
    );
  }
}
