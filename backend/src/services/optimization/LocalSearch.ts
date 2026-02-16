import { Student, Group, Solution, Theme } from '../../domain';
import { ConstraintValidator } from './ConstraintValidator';
import { EnergyCalculator } from './EnergyCalculator';
import { ConstraintRules } from './SystemViabilityAnalyzer';

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
  private rules: ConstraintRules = {
    minElectricalEngineers: 1,
    maxElectricalEngineers: 2,
    minPhaseDiversity: 2,
    groupSize: 4
  };

  constructor(energyCalculator?: EnergyCalculator) {
    this.validator = new ConstraintValidator();
    this.energyCalculator = energyCalculator || new EnergyCalculator();
  }

  /**
   * Define restrições dinâmicas (chamado por DistributionEngine)
   */
  public setConstraintRules(rules: ConstraintRules): void {
    this.rules = rules;
    this.validator.setConstraintRules(rules);
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

    console.log(`[LocalSearch] Energia inicial: ${currentEnergy.toFixed(4)}`);

    while (iterationsWithoutImprovement < this.maxIterationsWithoutImprovement) {
      const improved = this.perform2Opt(currentSolution);

      if (improved) {
        const newEnergy = this.calculateSolutionEnergy(improved);

        if (newEnergy < currentEnergy) {
          currentSolution = improved;
          currentEnergy = newEnergy;
          iterationsWithoutImprovement = 0;
          console.log(`[LocalSearch] Energia melhorou: ${newEnergy.toFixed(4)}`);
        } else {
          iterationsWithoutImprovement++;
        }
      } else {
        iterationsWithoutImprovement++;
      }
    }

    console.log(`[LocalSearch] Energia final: ${currentEnergy.toFixed(4)}`);
    currentSolution.totalEnergy = currentEnergy;
    return currentSolution;
  }

  /**
   * Uma rodada de 2-opt: procura por melhorias trocando 2 alunos
   */
  private perform2Opt(solution: Solution): Solution | null {
    const groups = solution.groups;

    // Tentar todas as combinações de pares de grupos
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const groupA = groups[i];
        const groupB = groups[j];

        // Tentar trocar cada par de alunos
        for (const studentA of groupA.students) {
          for (const studentB of groupB.students) {
            if (this.canPerformSwap(studentA, studentB, groupA, groupB)) {
              const delta = this.calculateSwapDelta(studentA, studentB, groupA, groupB);

              // Aceita se reduz energia (delta < 0)
              if (delta < 0 && Number.isFinite(delta)) {
                return this.performSwap(solution, studentA, studentB, groupA, groupB);
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Calcula delta de energia ao trocar dois alunos entre grupos
   * Delta < 0 significa melhoria
   */
  private calculateSwapDelta(
    studentA: Student,
    studentB: Student,
    groupA: Group,
    groupB: Group
  ): number {
    const themeA = this.themes.find(t => t.id === groupA.themeId);
    const themeB = this.themes.find(t => t.id === groupB.themeId);

    if (!themeA || !themeB) {
      return Infinity;
    }

    // Energia ANTES
    const energyBefore = this.energyCalculator.calculateGroupEnergy(groupA, themeA) +
      this.energyCalculator.calculateGroupEnergy(groupB, themeB);

    // Criar grupos APÓS troca
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
   * Verifica viabilidade de um grupo (restrições duras dinâmicas)
   */
  private isGroupFeasible(group: Group): boolean {
    // Permite ±1 para grupos de sobra (N não múltiplo de groupSize)
    const size = group.students.length;
    const minSize = this.rules.groupSize - 1;
    const maxSize = this.rules.groupSize + 1;
    if (size < minSize || size > maxSize) return false;

    const electricalCount = group.students.filter(s => s.course === 'EE').length;
    const minEE = this.rules.minElectricalEngineers;
    const maxEE = size >= this.rules.groupSize
      ? this.rules.maxElectricalEngineers
      : Math.min(this.rules.maxElectricalEngineers, size - 1);
    if (electricalCount < minEE || electricalCount > maxEE) return false;

    const uniquePhases = new Set(group.students.map(s => s.phase)).size;
    if (uniquePhases < this.rules.minPhaseDiversity) return false;

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

  /**
   * Define pesos customizados para o EnergyCalculator
   */
  public setWeights(config: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
  }
}
