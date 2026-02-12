import { Student, Group, Solution } from '../../domain';
import { ConstraintValidator } from './ConstraintValidator';
import { PreferenceScorer } from './PreferenceScorer';

/**
 * SimulatedAnnealing - Otimização global com aceitação probabilística
 *
 * Permite aceitar soluções piores temporariamente para escapar de ótimos locais.
 * Temperatura diminui ao longo do tempo, reduzindo probabilidade de aceitação.
 *
 * Parâmetros:
 * - initialTemperature: temperatura inicial (alta = mais exploração)
 * - coolingRate: quão rápido a temperatura cai (0-1)
 * - maxIterations: limite de iterações
 */
export class SimulatedAnnealing {
  private validator: ConstraintValidator;
  private scorer: PreferenceScorer;
  private initialTemperature: number = 1000;
  private coolingRate: number = 0.95;
  private maxIterations: number = 1000;

  constructor(
    initialTemp?: number,
    coolingRate?: number,
    maxIterations?: number
  ) {
    this.validator = new ConstraintValidator();
    this.scorer = new PreferenceScorer();

    if (initialTemp) this.initialTemperature = initialTemp;
    if (coolingRate) this.coolingRate = coolingRate;
    if (maxIterations) this.maxIterations = maxIterations;
  }

  /**
   * Executa Simulated Annealing
   */
  optimize(solution: Solution): Solution {
    let currentSolution = solution;
    let bestSolution = solution;
    let currentScore = this.scorer.calculateSolutionScore(currentSolution);
    let bestScore = currentScore;
    let temperature = this.initialTemperature;
    let iteration = 0;

    while (iteration < this.maxIterations && temperature > 1) {
      // Gerar vizinho aleatório
      const neighbor = this.generateNeighbor(currentSolution);

      if (neighbor) {
        const neighborScore = this.scorer.calculateSolutionScore(neighbor);
        const delta = neighborScore - currentScore;

        // Critério de aceitação
        if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
          // Aceita vizinho
          currentSolution = neighbor;
          currentScore = neighborScore;

          // Atualiza melhor solução encontrada
          if (neighborScore > bestScore) {
            bestSolution = neighbor;
            bestScore = neighborScore;
          }
        }
      }

      // Reduzir temperatura (cooling schedule)
      temperature *= this.coolingRate;
      iteration++;
    }

    return bestSolution;
  }

  /**
   * Gera solução vizinha aleatória (move ou swap)
   */
  private generateNeighbor(solution: Solution): Solution | null {
    const groups = solution.groups;

    if (groups.length < 2) {
      return null;
    }

    // 70% chance de 2-opt swap, 30% chance de movimento
    const useSwap = Math.random() < 0.7;

    if (useSwap) {
      return this.generateSwapNeighbor(solution);
    } else {
      return this.generateMoveNeighbor(solution);
    }
  }

  /**
   * Gera vizinho por troca de 2 alunos (2-opt)
   */
  private generateSwapNeighbor(solution: Solution): Solution | null {
    const groups = solution.groups;
    const attempts = Math.min(10, groups.length * 2);

    for (let attempt = 0; attempt < attempts; attempt++) {
      // Escolher 2 grupos aleatórios diferentes
      const i = Math.floor(Math.random() * groups.length);
      const j = Math.floor(Math.random() * groups.length);

      if (i === j) continue;

      const groupA = groups[i];
      const groupB = groups[j];

      // Escolher alunos aleatórios
      if (groupA.students.length === 0 || groupB.students.length === 0) {
        continue;
      }

      const studentA = groupA.students[Math.floor(Math.random() * groupA.students.length)];
      const studentB = groupB.students[Math.floor(Math.random() * groupB.students.length)];

      // Tentar trocar
      const newSolution = this.trySwap(solution, studentA, studentB, groupA, groupB);
      if (newSolution) {
        return newSolution;
      }
    }

    return null;
  }

  /**
   * Tenta fazer swap de dois alunos
   */
  private trySwap(
    solution: Solution,
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): Solution | null {
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

    // Substituir na solução
    const newGroups = solution.groups.map(g => {
      if (g.id === groupA.id) return newGroupA;
      if (g.id === groupB.id) return newGroupB;
      return g;
    });

    const newSolution = new Solution(newGroups, [], 0);
    const violations = this.validator.validateGroups(newGroups);
    newSolution.constraintViolations = violations;

    return newSolution;
  }

  /**
   * Gera vizinho por movimento de 1 aluno entre grupos
   */
  private generateMoveNeighbor(solution: Solution): Solution | null {
    const groups = solution.groups;
    const attempts = Math.min(10, groups.length * 2);

    for (let attempt = 0; attempt < attempts; attempt++) {
      // Escolher grupo origem
      const sourceIdx = Math.floor(Math.random() * groups.length);
      const sourceGroup = groups[sourceIdx];

      if (sourceGroup.students.length === 0) {
        continue;
      }

      // Escolher grupo destino diferente
      let targetIdx = Math.floor(Math.random() * groups.length);
      while (targetIdx === sourceIdx) {
        targetIdx = Math.floor(Math.random() * groups.length);
      }
      const targetGroup = groups[targetIdx];

      // Grupo destino não pode estar cheio
      if (targetGroup.isFull()) {
        continue;
      }

      // Escolher aluno aleatório do grupo origem
      const student = sourceGroup.students[
        Math.floor(Math.random() * sourceGroup.students.length)
      ];

      // Tentar mover
      const newSolution = this.tryMove(solution, student, sourceGroup, targetGroup);
      if (newSolution) {
        return newSolution;
      }
    }

    return null;
  }

  /**
   * Tenta mover um aluno de um grupo para outro
   */
  private tryMove(
    solution: Solution,
    student: Student,
    fromGroup: Group,
    toGroup: Group
  ): Solution | null {
    // Grupo origem não pode ficar vazio
    if (fromGroup.getStudentCount() <= 1) {
      return null;
    }

    // Criar novos grupos após movimento
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
    const newGroups = solution.groups.map(g => {
      if (g.id === fromGroup.id) return newGroupFrom;
      if (g.id === toGroup.id) return newGroupTo;
      return g;
    });

    const newSolution = new Solution(newGroups, [], 0);
    const violations = this.validator.validateGroups(newGroups);
    newSolution.constraintViolations = violations;

    return newSolution;
  }

  /**
   * Calcula probabilidade de aceitação de solução pior
   * Baseado na Lei de Boltzmann: P = exp(-delta/T)
   */
  private acceptanceProbability(delta: number, temperature: number): number {
    if (delta >= 0) return 1.0; // Sempre aceita se melhorou
    return Math.exp(delta / temperature);
  }
}
