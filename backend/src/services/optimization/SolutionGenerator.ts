import { Student, Group, Theme, Solution } from '../../domain';
import { EnergyCalculator } from './EnergyCalculator';
import { ConstraintRules } from './SystemViabilityAnalyzer';

/**
 * SolutionGenerator - Gera uma solução inicial viável (Fase 1)
 *
 * Estratégia (Modelo de Energia - Sistema Ideal §6.2):
 * 1. Calcular G = floor(N/4), criar G grupos vazios
 * 2. Distribuir alunos EE: garantir 1 por grupo, depois máximo 2
 * 3. Completar vagas com ME priorizando diversidade de fase
 * 4. Para cada grupo completo, atribuir melhor tema
 * 5. Energia só é calculada em grupos COMPLETOS
 */
export class SolutionGenerator {
  private energyCalculator: EnergyCalculator;
  private rules: ConstraintRules = {
    minElectricalEngineers: 1,
    maxElectricalEngineers: 2,
    minPhaseDiversity: 2,
    groupSize: 4
  };

  constructor(config?: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
  }

  /**
   * Define restrições dinâmicas (chamado por AdaptiveConstraintManager)
   * Propaga para EnergyCalculator
   */
  public setConstraintRules(rules: ConstraintRules): void {
    this.rules = rules;
    this.energyCalculator.setConstraintRules(rules);
  }

  /**
   * Gera uma solução inicial viável (Modelo de Energia §6.2)
   *
   * Construção gulosa em 4 passos:
   * 1. Distribuir EE (1 por grupo, depois extras)
   * 2. Completar com ME (priorizando diversidade de fase)
   * 3. Tratar sobras (N não múltiplo de 4)
   * 4. Atribuir melhor tema por grupo e calcular energia
   */
  generateInitialSolution(
    students: Student[],
    themes: Theme[]
  ): Solution {
    if (students.length === 0 || themes.length === 0) {
      return new Solution([], [], 0);
    }

    const groupSize = this.rules.groupSize;
    const totalStudents = students.length;
    const G = Math.floor(totalStudents / groupSize);
    const remainder = totalStudents - G * groupSize;

    if (G === 0) {
      // Menos de groupSize alunos — criar um grupo com todos
      const group = new Group(
        'group_0',
        themes[0].id,
        'dist_temp',
        [...students]
      );
      const { theme: bestTheme, energy } = this.energyCalculator.findBestThemeForGroup(group, themes);
      group.themeId = bestTheme.id;
      const totalEnergy = Number.isFinite(energy) ? energy : 0;
      return new Solution([group], [], 0, 0, 0, totalEnergy);
    }

    // Separar alunos por curso
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const eeStudents = shuffled.filter(s => s.course === 'EE');
    const meStudents = shuffled.filter(s => s.course === 'ME');

    // Criar G grupos vazios (armazenamos arrays de students para construção)
    const groupStudents: Student[][] = Array.from({ length: G }, () => []);

    // ===== PASSO 1: Distribuir EE =====
    // 1a. Garantir 1 EE por grupo (se possível)
    let eeIndex = 0;
    for (let i = 0; i < G && eeIndex < eeStudents.length; i++) {
      groupStudents[i].push(eeStudents[eeIndex++]);
    }

    // 1b. Distribuir EE restantes (máximo 2 por grupo)
    for (let i = 0; i < G && eeIndex < eeStudents.length; i++) {
      const eeInGroup = groupStudents[i].filter(s => s.course === 'EE').length;
      if (eeInGroup < this.rules.maxElectricalEngineers) {
        groupStudents[i].push(eeStudents[eeIndex++]);
      }
    }

    // Se ainda sobraram EE (mais de 2*G), colocar onde couber
    while (eeIndex < eeStudents.length) {
      // Encontrar grupo com menos alunos
      const minGroup = groupStudents.reduce((min, g, idx) =>
        g.length < groupStudents[min].length ? idx : min, 0
      );
      groupStudents[minGroup].push(eeStudents[eeIndex++]);
    }

    // ===== PASSO 2: Completar com ME priorizando diversidade de fase =====
    let meIndex = 0;
    // Ordenar ME por fase para melhor distribuição
    const meSorted = [...meStudents];

    // Para cada grupo, preencher vagas com ME
    for (let round = 0; round < groupSize; round++) {
      for (let i = 0; i < G; i++) {
        if (groupStudents[i].length >= groupSize) continue;
        if (meIndex >= meSorted.length) break;

        // Encontrar o ME que adiciona mais diversidade de fase
        const phasesInGroup = new Set(groupStudents[i].map(s => s.phase));
        let bestIdx = -1;
        let bestScore = -1;

        for (let j = meIndex; j < meSorted.length; j++) {
          const candidate = meSorted[j];
          // Score: priorizar fase nova (2), depois fase existente (1)
          const addsNewPhase = !phasesInGroup.has(candidate.phase) ? 2 : 1;
          if (addsNewPhase > bestScore) {
            bestScore = addsNewPhase;
            bestIdx = j;
          }
          // Otimização: se já achamos fase nova, parar de procurar neste grupo
          if (bestScore === 2) break;
        }

        if (bestIdx >= 0) {
          const selected = meSorted[bestIdx];
          // Swap selected to meIndex position for efficient removal
          meSorted[bestIdx] = meSorted[meIndex];
          meSorted[meIndex] = selected;
          groupStudents[i].push(selected);
          meIndex++;
        }
      }
    }

    // ===== PASSO 3: Tratar sobras =====
    // Alunos ME restantes
    const remainingStudents: Student[] = meSorted.slice(meIndex);

    if (remainingStudents.length > 0) {
      if (remainingStudents.length <= 2) {
        // Política A: adicionar aos grupos existentes (criando grupo de 5 ou 6)
        for (const student of remainingStudents) {
          // Encontrar grupo com menos alunos
          const minGroup = groupStudents.reduce((min, g, idx) =>
            g.length < groupStudents[min].length ? idx : min, 0
          );
          groupStudents[minGroup].push(student);
        }
      } else {
        // Criar grupo(s) extra com os restantes
        const extraGroup: Student[] = [];
        for (const student of remainingStudents) {
          extraGroup.push(student);
        }
        groupStudents.push(extraGroup);
      }
    }

    // ===== PASSO 4: Criar Group objects e atribuir melhor tema =====
    // Calcular limites proporcionais por tema
    const totalGroupsNeeded = groupStudents.filter(g => g.length > 0).length;
    const themeLimits = this.computeProportionalLimits(themes, totalGroupsNeeded);
    console.log(`[SolutionGenerator] Limites proporcionais de temas:`);
    for (const theme of themes) {
      console.log(`  ${theme.name}: ideal=${theme.maxGroups}, proporcional=${themeLimits.get(theme.id)}`);
    }

    const groups: Group[] = [];
    let totalEnergy = 0;
    const themeUsage = new Map<string, number>();

    for (let i = 0; i < groupStudents.length; i++) {
      const studentsInGroup = groupStudents[i];
      if (studentsInGroup.length === 0) continue;

      // Criar grupo provisório com primeiro tema para buscar melhor
      const tempGroup = new Group(
        `group_${i}`,
        themes[0].id,
        'dist_temp',
        studentsInGroup
      );

      // Encontrar melhor tema respeitando limites proporcionais
      const { theme: bestTheme, energy } = this.findBestThemeWithCapacity(
        tempGroup, themes, themeLimits, themeUsage
      );
      tempGroup.themeId = bestTheme.id;
      themeUsage.set(bestTheme.id, (themeUsage.get(bestTheme.id) || 0) + 1);

      if (Number.isFinite(energy)) {
        totalEnergy += energy;
      }

      groups.push(tempGroup);
    }

    // Balancear temas — garantir que nenhum tema excede limite proporcional
    this.balanceThemes(groups, themes, themeLimits);

    // Recalcular energia final após balanceamento
    totalEnergy = 0;
    let hasInfeasible = false;
    for (const group of groups) {
      const theme = themes.find(t => t.id === group.themeId);
      if (theme) {
        const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
        if (Number.isFinite(energy)) {
          totalEnergy += energy;
        } else {
          hasInfeasible = true;
        }
      }
    }

    if (hasInfeasible) {
      console.warn(`[SolutionGenerator] ${groups.filter(g => {
        const t = themes.find(th => th.id === g.themeId);
        return t && !Number.isFinite(this.energyCalculator.calculateGroupEnergy(g, t));
      }).length} grupo(s) infeasíveis detectados (energia ∞)`);
    }

    const solution = new Solution(groups, [], 0, 0, 0, totalEnergy);
    return solution;
  }

  /**
   * Calcula limites proporcionais por tema
   * maxGroups é tratado como "número ideal de grupos" (proporção)
   * Se totalGroups > soma dos ideais, escalamos proporcionalmente
   */
  private computeProportionalLimits(themes: Theme[], totalGroupsNeeded: number): Map<string, number> {
    const sumOfIdeals = themes.reduce((sum, t) => sum + t.maxGroups, 0);
    const scaleFactor = totalGroupsNeeded / sumOfIdeals;
    const limits = new Map<string, number>();

    for (const theme of themes) {
      // Arredondar para cima para garantir que todos alunos cabem
      limits.set(theme.id, Math.ceil(theme.maxGroups * scaleFactor));
    }

    return limits;
  }

  /**
   * Encontra melhor tema para um grupo respeitando limites proporcionais
   * Se todos os temas estão lotados, usa o melhor de qualquer forma
   */
  private findBestThemeWithCapacity(
    group: Group,
    themes: Theme[],
    limits: Map<string, number>,
    usage: Map<string, number>
  ): { theme: Theme; energy: number } {
    let bestTheme: Theme | null = null;
    let bestEnergy = Infinity;
    let fallbackTheme: Theme | null = null;
    let fallbackEnergy = Infinity;

    for (const theme of themes) {
      const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
      const currentUsage = usage.get(theme.id) || 0;
      const limit = limits.get(theme.id) || 1;

      // Melhor tema com capacidade disponível
      if (currentUsage < limit && energy < bestEnergy) {
        bestEnergy = energy;
        bestTheme = theme;
      }

      // Fallback: melhor tema independente de capacidade
      if (energy < fallbackEnergy) {
        fallbackEnergy = energy;
        fallbackTheme = theme;
      }
    }

    if (bestTheme) {
      return { theme: bestTheme, energy: bestEnergy };
    }
    // Se todos lotados, usar fallback
    return { theme: fallbackTheme || themes[0], energy: fallbackEnergy };
  }

  /**
   * Balanceia temas para respeitar limites proporcionais
   * Se um tema tem mais grupos que o limite, redistribui para temas com espaço
   */
  private balanceThemes(groups: Group[], themes: Theme[], limits: Map<string, number>): void {
    const themeCounts = new Map<string, number>();
    for (const group of groups) {
      themeCounts.set(group.themeId, (themeCounts.get(group.themeId) || 0) + 1);
    }

    for (const group of groups) {
      const currentTheme = themes.find(t => t.id === group.themeId);
      if (!currentTheme) continue;

      const count = themeCounts.get(group.themeId) || 0;
      const limit = limits.get(group.themeId) || 1;

      if (count > limit) {
        // Precisa mover este grupo para outro tema
        let bestTheme: Theme | null = null;
        let bestEnergy = Infinity;

        for (const theme of themes) {
          const themeCount = themeCounts.get(theme.id) || 0;
          const themeLimit = limits.get(theme.id) || 1;
          if (themeCount >= themeLimit) continue; // Já lotado

          const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
          if (energy < bestEnergy) {
            bestEnergy = energy;
            bestTheme = theme;
          }
        }

        if (bestTheme) {
          themeCounts.set(group.themeId, (themeCounts.get(group.themeId) || 0) - 1);
          group.themeId = bestTheme.id;
          themeCounts.set(bestTheme.id, (themeCounts.get(bestTheme.id) || 0) + 1);
        }
      }
    }
  }

  /**
   * Obtém a configuração de pesos do EnergyCalculator
   */
  getWeights() {
    return this.energyCalculator.getWeights();
  }

  /**
   * Define pesos customizados para o EnergyCalculator
   */
  setWeights(config: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
  }
}
