import { Group, Theme, Student } from '../../domain';
import { ConstraintRules } from './SystemViabilityAnalyzer';

/**
 * EnergyCalculator - Cálculo de Energia (Modelo Ideal - Fase 1)
 *
 * Implementa o modelo de energia da especificação ideal em:
 * ref_distribuição/SISTEMA_IDEAL_DISTRIBUICAO
 *
 * Energia total de um grupo:
 * E(g, t) = E_pref(g, t) + E_fase(g)  [se viável]
 *         = +∞                         [se inviável]
 *
 * Onde:
 * - E_pref = -w_pref × Σ score_normalizado[0,1]
 * - E_fase = w_dup × duplicatas_fase - w_div × diversidade_fase
 * - Máscara dura: E = ∞ se grupo viola restrições críticas
 */
export class EnergyCalculator {
  private readonly wPref: number;   // Peso de preferências (default: 1.0)
  private readonly wDup: number;    // Peso de duplicatas de fase (default: 0.9)
  private readonly wDiv: number;    // Peso de diversidade de fase (default: 0.35)

  // Tabela de conversão de ranking para score bruto
  private readonly SCORE_TABLE = [100, 70, 50, 35, 25, 18, 12, 8];

  // Restrições dinâmicas (pode ser adaptado por AdaptiveConstraintManager)
  private rules: ConstraintRules = {
    minElectricalEngineers: 1,
    maxElectricalEngineers: 2,
    minPhaseDiversity: 2,
    groupSize: 4
  };

  /**
   * Constructor
   * @param config Configuração de pesos (opcionais, com defaults)
   */
  constructor(config: { wPref?: number; wDup?: number; wDiv?: number } = {}) {
    this.wPref = config.wPref ?? 1.0;
    this.wDup = config.wDup ?? 0.9;
    this.wDiv = config.wDiv ?? 0.35;

    // Validação
    if (this.wPref < 0 || this.wDup < 0 || this.wDiv < 0) {
      throw new Error('Pesos não podem ser negativos');
    }
  }

  /**
   * Define restrições dinâmicas (chamado por AdaptiveConstraintManager)
   */
  public setConstraintRules(rules: ConstraintRules): void {
    this.rules = rules;
  }

  /**
   * Calcula energia de um grupo com tema atribuído
   * E(g, t) = E_pref(g, t) + E_fase(g) se viável, senão +∞
   */
  public calculateGroupEnergy(group: Group, theme: Theme): number {
    // Máscara dura: verificar viabilidade
    if (!this.isGroupFeasible(group)) {
      return Infinity;
    }

    const ePref = this.calculatePreferenceEnergy(group, theme);
    const eFase = this.calculatePhaseEnergy(group);

    return ePref + eFase;
  }

  /**
   * E_pref = -w_pref × Σ score_normalizado
   *
   * Negativo porque preferências altas devem REDUZIR energia.
   * Score normalizado é um valor em [0,1], onde:
   * - 1.0 = máxima satisfação (primeira escolha)
   * - 0.0 = mínima satisfação (última escolha)
   */
  private calculatePreferenceEnergy(group: Group, theme: Theme): number {
    let totalNormalizedScore = 0;

    for (const student of group.students) {
      // Sem preferencias preenchidas => impacto neutro no termo de preferencia.
      if (!student.preferences || student.preferences.length === 0) {
        continue;
      }

      const rank = this.getThemeRank(student, theme.id);
      const rawScore = this.rankToRawScore(rank);
      const normalizedScore = this.normalizeScore(student, rawScore);
      totalNormalizedScore += normalizedScore;
    }

    return -this.wPref * totalNormalizedScore;
  }

  /**
   * E_fase = w_dup × duplicatas - w_div × diversidade
   *
   * Onde:
   * - duplicatas = soma de (count - 1) para cada fase com mais de 1 aluno
   * - diversidade = número de fases distintas no grupo
   *
   * Penaliza alunos da mesma fase, incentiva diversidade.
   */
  private calculatePhaseEnergy(group: Group): number {
    const phaseCounts = new Map<number, number>();

    // Contar alunos por fase
    for (const student of group.students) {
      const phase = student.phase;
      phaseCounts.set(phase, (phaseCounts.get(phase) || 0) + 1);
    }

    // Calcular duplicatas: quantas vezes uma fase aparece além da primeira
    let duplicates = 0;
    for (const count of phaseCounts.values()) {
      if (count > 1) {
        duplicates += (count - 1);
      }
    }

    // Diversidade: número de fases distintas
    const diversity = phaseCounts.size;

    return this.wDup * duplicates - this.wDiv * diversity;
  }

  /**
   * Converte ranking para score bruto (tabela do sistema ideal)
   *
   * Tabela: [100, 70, 50, 35, 25, 18, 12, 8]
   * Posições: 1, 2, 3, 4, 5, 6, 7, 8
   *
   * Para posições > 8: use 8 - (position - 8) = 16 - position
   */
  private rankToRawScore(rank: number): number {
    if (rank < 1) {
      return 0;
    }

    if (rank <= this.SCORE_TABLE.length) {
      return this.SCORE_TABLE[rank - 1];
    }

    // Para posições além da tabela
    return Math.max(0, 8 - (rank - this.SCORE_TABLE.length));
  }

  /**
   * Normaliza score para [0, 1]
   *
   * normalized = (score - min) / (max - min)
   *
   * Cada aluno tem seu próprio min/max baseado no seu ranking completo.
   */
  private normalizeScore(student: Student, rawScore: number): number {
    // Obter todos os scores brutos para este aluno
    const allRawScores: number[] = [];

    // Se o aluno tem preferências, calcular score bruto para cada tema
    if (student.preferences && student.preferences.length > 0) {
      for (let i = 1; i <= student.preferences.length; i++) {
        allRawScores.push(this.rankToRawScore(i));
      }
    } else {
      // Fallback: assumir 8 temas (padrão do sistema)
      for (let i = 1; i <= 8; i++) {
        allRawScores.push(this.rankToRawScore(i));
      }
    }

    const min = Math.min(...allRawScores);
    const max = Math.max(...allRawScores);

    // Proteção contra divisão por zero
    if (max === min) {
      return 0.5; // Todos os scores iguais
    }

    return (rawScore - min) / (max - min);
  }

  /**
   * Verifica viabilidade de um grupo (restrições duras)
   *
   * Usa ConstraintRules dinâmicas (podem ser adaptadas por AdaptiveConstraintManager)
   */
  public isGroupFeasible(group: Group): boolean {
    // Restrição 1: tamanho (permite ±1 para grupos de sobra)
    const size = group.students.length;
    const minSize = this.rules.groupSize - 1; // ex: 3 para groupSize=4
    const maxSize = this.rules.groupSize + 1; // ex: 5 para groupSize=4
    if (size < minSize || size > maxSize) {
      return false;
    }

    // Restrição 2: contagem de elétricos (dinâmica)
    // Para grupos menores/maiores, ajustar proporcionalmente
    const electricalCount = group.students.filter(s => s.course === 'EE').length;
    const minEE = this.rules.minElectricalEngineers;
    const maxEE = size >= this.rules.groupSize
      ? this.rules.maxElectricalEngineers
      : Math.min(this.rules.maxElectricalEngineers, size - 1); // garantir pelo menos 1 não-EE

    if (electricalCount < minEE || electricalCount > maxEE) {
      return false;
    }

    // Restrição 3: diversidade de fases (dinâmica)
    const uniquePhases = new Set(group.students.map(s => s.phase)).size;
    if (uniquePhases < this.rules.minPhaseDiversity) {
      return false;
    }

    return true;
  }

  /**
   * Calcula energia total de uma solução
   * (soma das energias de todos os grupos)
   */
  public calculateSolutionEnergy(solution: any): number {
    let totalEnergy = 0;

    for (const group of solution.groups) {
      const theme = solution.getThemeForGroup?.(group.id);
      if (!theme) {
        return Infinity; // Grupo sem tema atribuído
      }

      const energy = this.calculateGroupEnergy(group, theme);

      if (energy === Infinity) {
        return Infinity; // Solução inviável
      }

      totalEnergy += energy;
    }

    return totalEnergy;
  }

  /**
   * Encontra melhor tema para um grupo (minimiza energia)
   *
   * Itera todos os temas e retorna aquele com menor energia.
   */
  public findBestThemeForGroup(group: Group, themes: Theme[]): { theme: Theme; energy: number } {
    let bestTheme = themes[0];
    let bestEnergy = Infinity;

    for (const theme of themes) {
      const energy = this.calculateGroupEnergy(group, theme);
      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestTheme = theme;
      }
    }

    return { theme: bestTheme, energy: bestEnergy };
  }

  /**
   * Obtém ranking de um tema para um aluno
   *
   * Retorna a posição do tema na preferência do aluno (1-indexado).
   * Se tema não está nas preferências, retorna um valor muito alto (9+).
   */
  private getThemeRank(student: Student, themeId: string): number {
    if (!student.preferences) {
      return 9; // Sem preferências, baixa satisfação
    }

    const index = student.preferences.findIndex(p => p.themeId === themeId);
    return index >= 0 ? index + 1 : 9; // 1-indexado
  }

  /**
   * Getters para testes/debug
   */
  public getWeights() {
    return { wPref: this.wPref, wDup: this.wDup, wDiv: this.wDiv };
  }
}
