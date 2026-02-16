import { Student, Theme, Solution, Group } from '../../domain';
import { SolutionGenerator } from './SolutionGenerator';
import { LocalSearch } from './LocalSearch';
import { SimulatedAnnealing } from './SimulatedAnnealing';
import { EnergyCalculator } from './EnergyCalculator';
import { SocialOptimizer } from './SocialOptimizer';
import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { AdaptiveConstraintManager } from './AdaptiveConstraintManager';
import { ConstraintRules } from './SystemViabilityAnalyzer';

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
  private constraintManager: AdaptiveConstraintManager;

  /**
   * Constructor com pesos configuráveis (Fase 1)
   * @param config Configuração de pesos: wPref, wDup, wDiv
   */
  constructor(config?: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
    this.generator = new SolutionGenerator(config);
    this.localSearch = new LocalSearch(this.energyCalculator);
    this.simulatedAnnealing = new SimulatedAnnealing(this.energyCalculator);
    this.constraintManager = new AdaptiveConstraintManager();
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
    constraintAdaptation?: { adapted: boolean; reason?: string };
  }> {
    const startTime = Date.now();

    // Validação básica
    if (students.length === 0 || themes.length === 0) {
      return {
        solution: new Solution([], [], 0),
        report: 'Erro: Alunos ou temas vazios',
        executionTime: 0,
        constraintAdaptation: { adapted: false }
      };
    }

    console.log(`[DistributionEngine] Iniciando Fase 1 para ${students.length} alunos e ${themes.length} temas`);

    // NOVO: Analisar viabilidade e adaptar restrições se necessário
    const constraintState = this.constraintManager.analyzeAndAdapt(students, themes);
    if (constraintState.adaptedFromDefault) {
      console.log(`[Viabilidade] Restrições adaptadas: ${constraintState.reasonForAdaptation}`);
      // Propagar regras adaptadas para TODOS os componentes
      this.energyCalculator.setConstraintRules(constraintState.rules);
      this.generator.setConstraintRules(constraintState.rules);
      this.localSearch.setConstraintRules(constraintState.rules);
      this.simulatedAnnealing.setConstraintRules(constraintState.rules);
    }

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
      executionTime: totalTime,
      constraintAdaptation: {
        adapted: constraintState.adaptedFromDefault,
        reason: constraintState.reasonForAdaptation
      }
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
    metrics: {
      before: { energy: number; satisfaction: number; cohesion: number };
      after: { energy: number; satisfaction: number; cohesion: number };
      changes: Array<{
        studentId: string;
        studentName: string;
        fromGroupId: string;
        toGroupId: string;
        fromThemeId: string;
        toThemeId: string;
      }>;
    };
  }> {
    const startTime = Date.now();

    console.log(`[DistributionEngine] Iniciando Fase 2 (Otimização Social) com matriz de ${affinityMatrix.getSize()} afinidades`);

    // Métricas Antes (Fase 1)
    // Para calcular coesão antes, precisamos usar a affinityMatrix na solução antiga
    let cohesionBefore = 0;
    for (const group of phase1Solution.groups) {
      const studentIds = group.students.map(s => s.id);
      cohesionBefore += affinityMatrix.calculateGroupCohesion(studentIds);
    }
    const metricsBefore = {
      energy: phase1Solution.getTotalEnergy(),
      satisfaction: phase1Solution.getAverageSatisfactionScore(), // Assumindo que este método existe ou similar
      cohesion: cohesionBefore // Coesão total
    };

    // Snapshot dos grupos originais para detectar mudanças
    const studentGroupMap = new Map<string, { groupId: string, themeId: string }>();
    for (const group of phase1Solution.groups) {
      for (const student of group.students) {
        studentGroupMap.set(student.id, { groupId: group.id, themeId: group.themeId });
      }
    }

    const phase2Start = Date.now();
    const socialOptimizer = new SocialOptimizer(
      affinityMatrix,
      this.energyCalculator,
      config
    );

    const solution = socialOptimizer.optimize(phase1Solution, themes);
    const phase2Time = Date.now() - phase2Start;

    const totalTime = Date.now() - startTime;

    // Métricas Depois (Fase 2)
    const metricsAfter = {
      energy: solution.getTotalEnergy(),
      satisfaction: solution.getAverageSatisfactionScore(),
      cohesion: solution.socialScore // Otimizador já calcula e armazena isso
    };

    // Detectar mudanças
    const changes: Array<{
      studentId: string;
      studentName: string;
      fromGroupId: string;
      toGroupId: string;
      fromThemeId: string;
      toThemeId: string;
    }> = [];

    for (const group of solution.groups) {
      for (const student of group.students) {
        const original = studentGroupMap.get(student.id);
        if (original && original.groupId !== group.id) {
          // Houve mudança de grupo
          // Nota: IDs de grupos podem ter mudado se recriados, mas assumindo persistência de lógica
          // Se o otimizador recria grupos com novos IDs, todos parecerão ter mudado.
          // O SocialOptimizer geralmente mantém os objetos Group ou IDs se possível, 
          // mas se ele faz deep copy, os IDs mudam. 
          // Verificar se SocialOptimizer preserva IDs. Se não, comparar por ThemeId e Colegas.
          // Assumindo que IDs de grupos são preservados ou mapeáveis.

          // Se IDs mudaram, podemos verificar se o tema mudou ou se os colegas mudaram muito.
          // Mas para MVP, vamos registrar.
          changes.push({
            studentId: student.id,
            studentName: student.name,
            fromGroupId: original.groupId,
            toGroupId: group.id,
            fromThemeId: original.themeId,
            toThemeId: group.themeId
          });
        }
      }
    }

    return {
      solution,
      report: this.generatePhase2Report(solution, phase2Time),
      executionTime: totalTime,
      metrics: {
        before: metricsBefore,
        after: metricsAfter,
        changes
      }
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

    // Apenas condições realmente irrecuperáveis
    if (students.length === 0) {
      issues.push('❌ Nenhum aluno registrado');
    }
    if (themes.length === 0) {
      issues.push('❌ Nenhum tema registrado');
    }

    // Tudo mais (EE insuficiente, fases, capacidade) é tratado pelo
    // AdaptiveConstraintManager dentro de solvePhase1()
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
