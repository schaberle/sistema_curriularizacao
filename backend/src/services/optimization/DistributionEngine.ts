import { Student, Theme, Solution, Group } from '../../domain';
import { SolutionGenerator } from './SolutionGenerator';
import { LocalSearch } from './LocalSearch';
import { SimulatedAnnealing } from './SimulatedAnnealing';
import { EnergyCalculator } from './EnergyCalculator';
import { SocialOptimizer } from './SocialOptimizer';
import { AffinityMatrix } from '../../domain/AffinityMatrix';

/**
 * DistributionEngine - Orquestrador do algoritmo de otimização (Modelo de Energia Ideal)
 *
 * Fase 1 - Formação Inicial + Otimização (3 sub-fases):
 * 1. GERAÇÃO INICIAL: SolutionGenerator (construção gulosa por energia)
 *    - Cria solução viável que minimiza energia
 *    - Usa EnergyCalculator para avaliar colocações
 *
 * 2. REFINAMENTO LOCAL: LocalSearch (2-opt com minimização de ΔE)
 *    - Swaps entre alunos de grupos diferentes
 *    - Aceita se ΔE < 0 (reduz energia)
 *    - Mantém restrições duras (máscara dura)
 *
 * 3. OTIMIZAÇÃO GLOBAL: SimulatedAnnealing (minimização de energia)
 *    - Aceita swaps piores com probabilidade exp(-ΔE/T)
 *    - Escapa de ótimos locais
 *    - Temperatura diminui → menos exploração
 *
 * Fase 2 - Otimização Social (opcional):
 *    - SocialOptimizer: refina grupos com base em afinidades
 *    - Método solvePhase2(solution, affinityMatrix, config) implementado
 */
export class DistributionEngine {
  private generator: SolutionGenerator;
  private localSearch: LocalSearch;
  private simulatedAnnealing: SimulatedAnnealing;
  private energyCalculator: EnergyCalculator;

  /**
   * Constructor com pesos configuráveis (Fase 1)
   * @param config Configuração de pesos: wPref, wDup, wDiv
   */
  constructor(config?: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
    this.generator = new SolutionGenerator(config);
    this.localSearch = new LocalSearch(this.energyCalculator);
    this.simulatedAnnealing = new SimulatedAnnealing(this.energyCalculator);
  }

  /**
   * Executa Fase 1: Formação inicial de grupos com otimização de energia
   *
   * 3 Sub-fases:
   * 1. Geração inicial (construção gulosa)
   * 2. Refinamento local (LocalSearch com 2-opt)
   * 3. Otimização global (SimulatedAnnealing)
   */
  async solvePhase1(students: Student[], themes: Theme[]): Promise<{
    solution: Solution;
    report: string;
    executionTime: number;
  }> {
    const startTime = Date.now();

    // Validação básica
    if (students.length === 0 || themes.length === 0) {
      return {
        solution: new Solution([], [], 0),
        report: 'Erro: Alunos ou temas vazios',
        executionTime: 0
      };
    }

    console.log(`[DistributionEngine] Iniciando Fase 1 para ${students.length} alunos e ${themes.length} temas`);

    // SUB-FASE 1: Geração de Solução Inicial
    console.log('[Fase 1.1] Gerando solução inicial (construção gulosa)...');
    const phase1Start = Date.now();
    let solution = this.generator.generateInitialSolution(students, themes);
    const phase1Time = Date.now() - phase1Start;
    console.log(`[Fase 1.1] Concluída em ${phase1Time}ms. Energia: ${solution.getTotalEnergy().toFixed(4)}`);

    // SUB-FASE 2: Refinamento Local (2-opt)
    console.log('[Fase 1.2] Refinando localmente com 2-opt...');
    const phase2Start = Date.now();
    solution = this.localSearch.optimize(solution, themes);
    const phase2Time = Date.now() - phase2Start;
    console.log(`[Fase 1.2] Concluída em ${phase2Time}ms. Energia: ${solution.getTotalEnergy().toFixed(4)}`);

    // SUB-FASE 3: Otimização Global (Simulated Annealing)
    console.log('[Fase 1.3] Otimizando globalmente com Simulated Annealing...');
    const phase3Start = Date.now();
    solution = this.simulatedAnnealing.optimize(solution, themes);
    const phase3Time = Date.now() - phase3Start;
    console.log(`[Fase 1.3] Concluída em ${phase3Time}ms. Energia Final: ${solution.getTotalEnergy().toFixed(4)}`);

    const totalTime = Date.now() - startTime;

    return {
      solution,
      report: this.generatePhase1Report(solution, phase1Time, phase2Time, phase3Time),
      executionTime: totalTime
    };
  }

  /**
   * Método legado: executa Fase 1 (para backward compatibility)
   * Alias para solvePhase1()
   */
  async solve(students: Student[], themes: Theme[]): Promise<{
    solution: Solution;
    report: string;
    executionTime: number;
  }> {
    return this.solvePhase1(students, themes);
  }

  /**
   * Executa Fase 2: Otimização social com base em afinidades
   *
   * **Entrada**: Solução da Fase 1 + Matriz de afinidades + Configuração
   * **Saída**: Solução ajustada com métricas sociais
   *
   * **Requer**: Fase 1 já foi executada
   */
  async solvePhase2(
    phase1Solution: Solution,
    affinityMatrix: AffinityMatrix,
    themes: Theme[],
    config?: {
      wSoc?: number;
      maxIterations?: number;
      temperature?: number;
    }
  ): Promise<{
    solution: Solution;
    report: string;
    executionTime: number;
  }> {
    const startTime = Date.now();

    console.log(`[DistributionEngine] Iniciando Fase 2 (Otimização Social) com matriz de ${affinityMatrix.getSize()} afinidades`);

    const phase2Start = Date.now();
    const socialOptimizer = new SocialOptimizer(
      affinityMatrix,
      this.energyCalculator,
      config
    );

    const solution = socialOptimizer.optimize(phase1Solution, themes);
    const phase2Time = Date.now() - phase2Start;

    const totalTime = Date.now() - startTime;

    return {
      solution,
      report: this.generatePhase2Report(solution, phase2Time),
      executionTime: totalTime
    };
  }

  /**
   * Gera relatório detalhado da Fase 1 (Modelo de Energia)
   */
  private generatePhase1Report(
    solution: Solution,
    phase1Time: number,
    phase2Time: number,
    phase3Time: number
  ): string {
    const weights = this.energyCalculator.getWeights();
    const totalEnergy = solution.getTotalEnergy();
    const isFeasible = solution.isFeasible();

    let report = '═══════════════════════════════════════════════════════════\n';
    report += 'RELATÓRIO DE FASE 1 (MODELO DE ENERGIA IDEAL)\n';
    report += '═══════════════════════════════════════════════════════════\n\n';

    // Configuração de Pesos
    report += '⚙️  CONFIGURAÇÃO DE PESOS\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `✓ w_pref (preferências): ${weights.wPref}\n`;
    report += `✓ w_dup (duplicatas de fase): ${weights.wDup}\n`;
    report += `✓ w_div (diversidade de fase): ${weights.wDiv}\n\n`;

    // Resultado Final
    report += '📊 RESULTADO FINAL\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `✓ Status: ${isFeasible ? '✅ VIÁVEL' : '❌ NÃO VIÁVEL'}\n`;
    report += `✓ Grupos Formados: ${solution.getGroupCount()}\n`;
    report += `✓ Alunos Alocados: ${solution.getAllocatedStudentCount()}\n`;
    report += `✓ Energia Total: ${totalEnergy === Infinity ? '∞ (inviável)' : totalEnergy.toFixed(4)}\n`;
    report += `✓ Energia Média por Grupo: ${(totalEnergy / Math.max(1, solution.getGroupCount())).toFixed(4)}\n\n`;

    // Timing das Fases
    report += '⏱️  TEMPO DE EXECUÇÃO\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `✓ Fase 1.1 (Geração Inicial): ${phase1Time}ms\n`;
    report += `✓ Fase 1.2 (Refinamento Local 2-opt): ${phase2Time}ms\n`;
    report += `✓ Fase 1.3 (Otimização Global SA): ${phase3Time}ms\n`;
    report += `✓ TOTAL: ${phase1Time + phase2Time + phase3Time}ms\n\n`;

    // Detalhes por Grupo
    report += '👥 DETALHES DOS GRUPOS\n';
    report += '───────────────────────────────────────────────────────────\n';

    for (let i = 0; i < solution.groups.length; i++) {
      const group = solution.groups[i];
      const composition = group.getComposition();

      // Calcular energia do grupo (manter tema para cálculo)
      const theme = { id: group.themeId } as Theme;
      const groupEnergy = this.energyCalculator.calculateGroupEnergy(group, theme);

      report += `\nGrupo ${i + 1} (Tema: ${group.themeId})\n`;
      report += `  Alunos: ${group.students.length}/4\n`;
      report += `  Cursos: ${composition.electricalCount} EE, ${composition.mechanicalCount} ME\n`;
      report += `  Fases: ${composition.phases.size} distintas (${Array.from(composition.phases).sort().join(', ')})\n`;
      report += `  Energia: ${groupEnergy === Infinity ? '∞' : groupEnergy.toFixed(4)}\n`;
      report += `  Integrantes:\n`;

      for (const student of group.students) {
        const rank = student.getThemeRank(group.themeId);
        const rankStr = rank <= 8 ? `posição ${rank}` : 'sem preferência';
        report += `    - ${student.name} (${student.course}, Fase ${student.phase}) - ${rankStr}\n`;
      }
    }

    report += '\n═══════════════════════════════════════════════════════════\n';

    return report;
  }

  /**
   * Gera relatório da Fase 2 (Otimização Social)
   */
  private generatePhase2Report(
    solution: Solution,
    phase2Time: number
  ): string {
    let report = '═══════════════════════════════════════════════════════════\n';
    report += 'RELATÓRIO DE FASE 2 (OTIMIZAÇÃO SOCIAL)\n';
    report += '═══════════════════════════════════════════════════════════\n\n';

    // Resultado Final
    report += '📊 RESULTADO FINAL\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `✓ Grupos Mantidos: ${solution.getGroupCount()}\n`;
    report += `✓ Alunos Alocados: ${solution.getAllocatedStudentCount()}\n`;
    report += `✓ Energia Total: ${solution.getTotalEnergy().toFixed(4)}\n\n`;

    // Timing
    report += '⏱️  TEMPO DE EXECUÇÃO\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `✓ Fase 2 (Otimização Social): ${phase2Time}ms\n\n`;

    // Detalhes por Grupo
    report += '👥 COESÃO SOCIAL DOS GRUPOS\n';
    report += '───────────────────────────────────────────────────────────\n';

    for (let i = 0; i < solution.groups.length; i++) {
      const group = solution.groups[i];
      const socialScore = (group as any).socialCohesionScore ?? 0;

      report += `\nGrupo ${i + 1} (Tema: ${group.themeId})\n`;
      report += `  Alunos: ${group.students.length}\n`;
      report += `  Coesão Social: ${socialScore.toFixed(4)}\n`;

      if (socialScore > 0) {
        report += `  Status: ✅ Afinidades positivas\n`;
      } else if (socialScore < 0) {
        report += `  Status: ⚠️  Afinidades negativas\n`;
      } else {
        report += `  Status: ➖ Neutro\n`;
      }

      report += `  Integrantes:\n`;
      for (const student of group.students) {
        report += `    - ${student.name} (${student.course}, Fase ${student.phase})\n`;
      }
    }

    report += '\n═══════════════════════════════════════════════════════════\n';

    return report;
  }

  /**
   * Valida cenário (viabilidade antes de distribuir)
   *
   * Verifica se o problema tem viabilidade teórica:
   * - Mínimo 1 aluno de EE por grupo (restrição dura)
   * - Mínimo 2 fases diferentes (restrição dura)
   */
  validateScenario(students: Student[], themes: Theme[]): {
    isFeasible: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Contar alunos de EE
    const electricalCount = students.filter(s => s.course === 'EE').length;

    // Calcular grupos necessários
    const totalGroups = Math.ceil(students.length / 4);

    // Restrição 1: 1-2 EE por grupo
    // Mínimo: totalGroups * 1, Máximo: totalGroups * 2
    if (electricalCount < totalGroups) {
      issues.push(
        `❌ Alunos EE insuficientes: tem ${electricalCount}, precisa de pelo menos ${totalGroups} (1 por grupo)`
      );
    }

    if (electricalCount > totalGroups * 2) {
      issues.push(
        `❌ Muitos alunos EE: tem ${electricalCount}, máximo permitido é ${totalGroups * 2} (2 por grupo)`
      );
    }

    // Restrição 2: Mínimo 2 fases por grupo
    // Precisa de pelo menos 2 fases diferentes
    const phases = new Set(students.map(s => s.phase));
    if (phases.size < 2) {
      issues.push(
        `❌ Fases insuficientes: tem ${phases.size}, precisa de pelo menos 2`
      );
    }

    return {
      isFeasible: issues.length === 0,
      issues
    };
  }

  /**
   * Obtém pesos configurados
   */
  getWeights() {
    return this.energyCalculator.getWeights();
  }

  /**
   * Define pesos customizados para otimização
   */
  setWeights(config: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
    this.generator.setWeights(config);
    this.localSearch.setWeights(config);
    this.simulatedAnnealing.setWeights(config);
  }
}
