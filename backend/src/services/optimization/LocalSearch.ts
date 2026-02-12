import { Student, Group, Solution } from '../../domain';
import { ConstraintValidator } from './ConstraintValidator';
import { PreferenceScorer } from './PreferenceScorer';

/**
 * LocalSearch - Refina uma solução através de buscas locais
 *
 * Estratégias:
 * 1. 2-opt: Troca 2 alunos entre grupos diferentes
 * 2. 3-opt: Troca 3 alunos (mais complexo, melhor qualidade)
 * 3. Melhor movimento primeiro (best-fit)
 */
export class LocalSearch {
  private validator: ConstraintValidator;
  private scorer: PreferenceScorer;
  private maxIterationsWithoutImprovement: number = 100;

  constructor() {
    this.validator = new ConstraintValidator();
    this.scorer = new PreferenceScorer();
  }

  /**
   * Executa busca local 2-opt até convergência
   * Tenta trocar pares de alunos entre grupos
   */
  optimize(solution: Solution): Solution {
    let currentSolution = solution;
    let iterationsWithoutImprovement = 0;
    let currentScore = this.scorer.calculateSolutionScore(currentSolution);

    while (iterationsWithoutImprovement < this.maxIterationsWithoutImprovement) {
      const improved = this.perform2Opt(currentSolution);

      if (improved) {
        const newScore = this.scorer.calculateSolutionScore(improved);

        // Se melhorou, aceita e reseta contador
        if (newScore > currentScore) {
          currentSolution = improved;
          currentScore = newScore;
          iterationsWithoutImprovement = 0;
        } else {
          iterationsWithoutImprovement++;
        }
      } else {
        // Nenhum movimento melhorou, termina
        break;
      }
    }

    return currentSolution;
  }

  /**
   * Executa uma rodada de 2-opt
   * Tenta trocar cada aluno de um grupo com alunos de outros grupos
   */
  private perform2Opt(solution: Solution): Solution | null {
    const groups = solution.groups;

    // Tenta cada par de grupos
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const groupA = groups[i];
        const groupB = groups[j];

        // Tenta trocar cada aluno de A com cada aluno de B
        for (const studentA of groupA.students) {
          for (const studentB of groupB.students) {
            const delta = this.calculateSwapDelta(
              studentA,
              studentB,
              groupA,
              groupB
            );

            // Se a troca melhora o score, faz a troca
            if (delta > 0) {
              return this.performSwap(solution, studentA, studentB, groupA, groupB);
            }
          }
        }
      }
    }

    // Nenhuma troca melhorou
    return null;
  }

  /**
   * Calcula delta de score ao trocar dois alunos
   */
  private calculateSwapDelta(
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): number {
    // Score que A perde ao sair de A e ganha ao entrar em B
    const scoreChangeA = studentA.getThemeScore(groupB.themeId) -
                         studentA.getThemeScore(groupA.themeId);

    // Score que B perde ao sair de B e ganha ao entrar em A
    const scoreChangeB = studentB.getThemeScore(groupA.themeId) -
                         studentB.getThemeScore(groupB.themeId);

    // Mudança total de score (ignorando penalidades por agora)
    const scoreDelta = scoreChangeA + scoreChangeB;

    // Verificar se troca mantém viabilidade
    if (!this.canPerformSwap(studentA, studentB, groupA, groupB)) {
      return -1000; // Penalidade grande por violação de restrição
    }

    return scoreDelta;
  }

  /**
   * Verifica se a troca é válida mantendo restrições críticas
   */
  private canPerformSwap(
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): boolean {
    // Criar cópias temporárias dos grupos pós-troca
    const tempGroupA = new Group(
      groupA.id,
      groupA.themeId,
      groupA.distributionId,
      groupA.students.filter(s => s.id !== studentA.id).concat([studentB])
    );

    const tempGroupB = new Group(
      groupB.id,
      groupB.themeId,
      groupB.distributionId,
      groupB.students.filter(s => s.id !== studentB.id).concat([studentA])
    );

    // Ambos os grupos devem satisfazer restrições críticas
    const violationsA = this.validator.validateGroup(tempGroupA)
      .filter(v => v.severity === 'CRITICAL');
    const violationsB = this.validator.validateGroup(tempGroupB)
      .filter(v => v.severity === 'CRITICAL');

    return violationsA.length === 0 && violationsB.length === 0;
  }

  /**
   * Executa a troca de dois alunos entre grupos
   */
  private performSwap(
    solution: Solution,
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): Solution {
    // Criar novos grupos após troca
    const newGroupA = new Group(
      groupA.id,
      groupA.themeId,
      groupA.distributionId,
      groupA.students.filter(s => s.id !== studentA.id).concat([studentB])
    );

    const newGroupB = new Group(
      groupB.id,
      groupB.themeId,
      groupB.distributionId,
      groupB.students.filter(s => s.id !== studentB.id).concat([studentA])
    );

    // Substituir grupos na solução
    const newGroups = solution.groups.map(g => {
      if (g.id === groupA.id) return newGroupA;
      if (g.id === groupB.id) return newGroupB;
      return g;
    });

    // Criar nova solução
    const newSolution = new Solution(newGroups, [], 0);
    const violations = this.validator.validateGroups(newGroups);
    newSolution.constraintViolations = violations;

    return newSolution;
  }

  /**
   * Executa 3-opt (mais complexo, opcional para melhor qualidade)
   * Move 3 alunos simultaneamente para melhorar ainda mais
   */
  optimize3Opt(solution: Solution, maxIterations: number = 50): Solution {
    let currentSolution = solution;
    let iteration = 0;

    while (iteration < maxIterations) {
      const improved = this.perform3OptPass(currentSolution);

      if (improved) {
        const newScore = this.scorer.calculateSolutionScore(improved);
        const oldScore = this.scorer.calculateSolutionScore(currentSolution);

        if (newScore > oldScore) {
          currentSolution = improved;
          iteration++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return currentSolution;
  }

  /**
   * Uma rodada de 3-opt (simplificado)
   */
  private perform3OptPass(solution: Solution): Solution | null {
    const groups = solution.groups;

    // Tentar mover um aluno de um grupo para outro
    // (versão simplificada do verdadeiro 3-opt)
    for (let i = 0; i < groups.length; i++) {
      for (let j = 0; j < groups.length; j++) {
        if (i === j) continue;

        const sourceGroup = groups[i];
        const targetGroup = groups[j];

        for (const student of sourceGroup.students) {
          // Tentar mover estudante de sourceGroup para targetGroup
          if (this.canMoveStudent(student, sourceGroup, targetGroup)) {
            const delta = this.calculateMovementDelta(student, sourceGroup, targetGroup);

            if (delta > 0) {
              return this.performMove(solution, student, sourceGroup, targetGroup);
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Verifica se pode mover aluno mantendo restrições
   */
  private canMoveStudent(
    student: Student,
    fromGroup: Group,
    toGroup: Group
  ): boolean {
    // Grupo fonte precisa ter pelo menos 1 aluno (mas idealmente 4)
    if (fromGroup.getStudentCount() <= 1) {
      return false;
    }

    // Grupo alvo não pode estar cheio
    if (toGroup.isFull()) {
      return false;
    }

    // Criar cópias temporárias
    const tempFrom = new Group(
      fromGroup.id,
      fromGroup.themeId,
      fromGroup.distributionId,
      fromGroup.students.filter(s => s.id !== student.id)
    );

    const tempTo = new Group(
      toGroup.id,
      toGroup.themeId,
      toGroup.distributionId,
      toGroup.students.concat([student])
    );

    // Ambos devem satisfazer restrições críticas
    // Nota: grupo fonte pode ficar vazio, isso é tratado na validação
    const violationsFrom = this.validator.validateGroup(tempFrom)
      .filter(v => v.severity === 'CRITICAL');
    const violationsTo = this.validator.validateGroup(tempTo)
      .filter(v => v.severity === 'CRITICAL');

    return violationsFrom.length === 0 && violationsTo.length === 0;
  }

  /**
   * Calcula delta de score ao mover um aluno
   */
  private calculateMovementDelta(
    student: Student,
    fromGroup: Group,
    toGroup: Group
  ): number {
    return this.scorer.calculateMovementDelta(student, fromGroup, toGroup);
  }

  /**
   * Executa movimento de um aluno
   */
  private performMove(
    solution: Solution,
    student: Student,
    fromGroup: Group,
    toGroup: Group
  ): Solution {
    const newGroupFrom = new Group(
      fromGroup.id,
      fromGroup.themeId,
      fromGroup.distributionId,
      fromGroup.students.filter(s => s.id !== student.id)
    );

    const newGroupTo = new Group(
      toGroup.id,
      toGroup.themeId,
      toGroup.distributionId,
      toGroup.students.concat([student])
    );

    // Substituir na solução
    const newGroups = solution.groups
      .filter(g => g.id !== fromGroup.id && g.id !== toGroup.id)
      .concat([newGroupFrom, newGroupTo]);

    const newSolution = new Solution(newGroups, [], 0);
    const violations = this.validator.validateGroups(newGroups);
    newSolution.constraintViolations = violations;

    return newSolution;
  }
}
