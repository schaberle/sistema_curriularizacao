import { Student, Group, Solution, Theme } from '../../domain';
import { ConstraintValidator } from './ConstraintValidator';
import { EnergyCalculator } from './EnergyCalculator';

/**
 * LocalSearch - Refina uma solução através de buscas locais
 *
 * **REFATORADO para usar modelo de ENERGIA (não score)**
 *
 * Estratégia:
 * 1. 2-opt: Troca 2 alunos entre grupos diferentes
 * 2. Aceita troca se reduz ENERGIA (delta < 0)
 * 3. Continua até convergência (nenhuma troca melhora)
 *
 * Diferença do legado:
 * - Usa EnergyCalculator em vez de PreferenceScorer
 * - MINIMIZA energia (delta < 0), não MAXIMIZA score (delta > 0)
 * - Máscara dura: rejeita imediatamente se energia = Infinity
 */
export class LocalSearch {
  private validator: ConstraintValidator;
  private energyCalculator: EnergyCalculator;
  private maxIterationsWithoutImprovement: number = 100;
  private themes: Theme[] = [];

  constructor(energyCalculator?: EnergyCalculator) {
    this.validator = new ConstraintValidator();
    this.energyCalculator = energyCalculator || new EnergyCalculator();
  }

  /**
   * Executa busca local 2-opt até convergência
   * Tenta trocar pares de alunos entre grupos
   *
   * @param solution Solução a refinar
   * @param themes Temas disponíveis (necessários para recalcular energia)
   * @returns Solução refinada
   */
  public optimize(solution: Solution, themes: Theme[]): Solution {
    this.themes = themes;
    let currentSolution = solution;
    let iterationsWithoutImprovement = 0;
    let currentEnergy = this.calculateSolutionEnergy(currentSolution);

    console.log(`[LocalSearch] Energia inicial: ${currentEnergy.toFixed(2)}`);

    while (iterationsWithoutImprovement < this.maxIterationsWithoutImprovement) {
      const improved = this.perform2Opt(currentSolution);

      if (improved) {
        const newEnergy = this.calculateSolutionEnergy(improved);

        // Se REDUZIU energia, aceita e reseta contador
        if (newEnergy < currentEnergy) {
          currentSolution = improved;
          currentEnergy = newEnergy;
          iterationsWithoutImprovement = 0;
          console.log(`[LocalSearch] Melhoria encontrada. Energia: ${newEnergy.toFixed(2)}`);
        } else {
          iterationsWithoutImprovement++;
        }
      } else {
        // Nenhum movimento melhorou, termina
        break;
      }
    }

    console.log(`[LocalSearch] Energia final: ${currentEnergy.toFixed(2)}`);
    currentSolution.totalEnergy = currentEnergy;
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
            const energyDelta = this.calculateSwapDelta(
              studentA,
              studentB,
              groupA,
              groupB
            );

            // Se a troca REDUZ energia (delta < 0), faz a troca
            if (energyDelta < 0) {
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
   * Calcula delta de energia ao trocar dois alunos
   *
   * IMPORTANTE: delta < 0 significa MELHORIA (redução de energia)
   */
  private calculateSwapDelta(
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): number {
    // Verificar se troca mantém viabilidade
    if (!this.canPerformSwap(studentA, studentB, groupA, groupB)) {
      return Infinity; // Troca violaria restrições
    }

    // Calcular energia ANTES do swap
    const themeA = this.themes.find(t => t.id === groupA.themeId);
    const themeB = this.themes.find(t => t.id === groupB.themeId);

    if (!themeA || !themeB) {
      return Infinity; // Temas não encontrados
    }

    const energyBefore = this.energyCalculator.calculateGroupEnergy(groupA, themeA) +
                         this.energyCalculator.calculateGroupEnergy(groupB, themeB);

    // Criar cópias pós-swap
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

    // Calcular energia DEPOIS do swap (pode precisar recalcular temas ótimos)
    let energyAfter = this.energyCalculator.calculateGroupEnergy(newGroupA, themeA) +
                      this.energyCalculator.calculateGroupEnergy(newGroupB, themeB);

    // Se algum grupo ficou inviável (energia infinita), rejeita
    if (!Number.isFinite(energyAfter)) {
      return Infinity;
    }

    // Delta = energyAfter - energyBefore
    // Delta < 0 significa melhoria
    return energyAfter - energyBefore;
  }

  /**
   * Verifica se a troca é válida mantendo restrições críticas (máscara dura)
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
    // Verificar manualmente (EE count, phase diversity)
    const isGroupAValid = this.isGroupFeasible(tempGroupA);
    const isGroupBValid = this.isGroupFeasible(tempGroupB);

    return isGroupAValid && isGroupBValid;
  }

  /**
   * Verifica viabilidade de um grupo (restrições duras)
   */
  private isGroupFeasible(group: Group): boolean {
    if (group.students.length !== 4) return false;

    const electricalCount = group.students.filter(s => s.course === 'EE').length;
    if (electricalCount < 1 || electricalCount > 2) return false;

    const uniquePhases = new Set(group.students.map(s => s.phase)).size;
    if (uniquePhases < 2) return false;

    return true;
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
    return newSolution;
  }

  /**
   * Calcula energia total de uma solução
   */
  private calculateSolutionEnergy(solution: Solution): number {
    let totalEnergy = 0;

    for (const group of solution.groups) {
      const theme = this.themes.find(t => t.id === group.themeId);
      if (!theme) {
        return Infinity;
      }

      const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
      if (!Number.isFinite(energy)) {
        return Infinity;
      }

      totalEnergy += energy;
    }

    return totalEnergy;
  }
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
