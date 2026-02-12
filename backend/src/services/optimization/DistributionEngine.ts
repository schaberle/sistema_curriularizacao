import { Student, Theme, Solution, Group } from '../../domain';
import { SolutionGenerator } from './SolutionGenerator';
import { LocalSearch } from './LocalSearch';
import { SimulatedAnnealing } from './SimulatedAnnealing';
import { PreferenceScorer } from './PreferenceScorer';
import { ConstraintValidator } from './ConstraintValidator';

/**
 * DistributionEngine - Orquestrador do algoritmo de otimização em 3 fases
 *
 * Fases:
 * 1. GERAÇÃO INICIAL: SolutionGenerator
 *    - Cria solução viável (atende restrições críticas)
 *    - Baseada em heurística construtiva com preferências
 *
 * 2. REFINAMENTO LOCAL: LocalSearch
 *    - 2-opt: troca pares de alunos entre grupos
 *    - Melhora satisfação local sem violar restrições críticas
 *
 * 3. OTIMIZAÇÃO GLOBAL: SimulatedAnnealing
 *    - Aceita movimentos piores temporariamente
 *    - Escapa de ótimos locais
 *    - Temperatura diminui → menos exploração
 */
export class DistributionEngine {
  private generator: SolutionGenerator;
  private localSearch: LocalSearch;
  private simulatedAnnealing: SimulatedAnnealing;
  private scorer: PreferenceScorer;
  private validator: ConstraintValidator;

  constructor() {
    this.generator = new SolutionGenerator();
    this.localSearch = new LocalSearch();
    this.simulatedAnnealing = new SimulatedAnnealing();
    this.scorer = new PreferenceScorer();
    this.validator = new ConstraintValidator();
  }

  /**
   * Executa o algoritmo completo de 3 fases
   */
  async solve(students: Student[], themes: Theme[]): Promise<{
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

    console.log(`[DistributionEngine] Iniciando distribuição para ${students.length} alunos e ${themes.length} temas`);

    // FASE 1: Geração de Solução Inicial
    console.log('[Fase 1] Gerando solução inicial...');
    const phase1Start = Date.now();
    let solution = this.generator.generateInitialSolution(students, themes);
    const phase1Time = Date.now() - phase1Start;
    console.log(`[Fase 1] Concluída em ${phase1Time}ms. Score: ${this.scorer.calculateSolutionScore(solution)}`);

    // Verificar viabilidade
    if (!this.generator.isSolutionFeasible(solution)) {
      return {
        solution,
        report: this.generateReport(solution, phase1Time, 0, 0, 'Solução inicial não viável'),
        executionTime: Date.now() - startTime
      };
    }

    // FASE 2: Refinamento Local (2-opt)
    console.log('[Fase 2] Refinando localmente com 2-opt...');
    const phase2Start = Date.now();
    solution = this.localSearch.optimize(solution);
    const phase2Time = Date.now() - phase2Start;
    console.log(`[Fase 2] Concluída em ${phase2Time}ms. Score: ${this.scorer.calculateSolutionScore(solution)}`);

    // FASE 3: Otimização Global (Simulated Annealing)
    console.log('[Fase 3] Otimizando globalmente com Simulated Annealing...');
    const phase3Start = Date.now();
    solution = this.simulatedAnnealing.optimize(solution);
    const phase3Time = Date.now() - phase3Start;
    console.log(`[Fase 3] Concluída em ${phase3Time}ms. Score: ${this.scorer.calculateSolutionScore(solution)}`);

    const totalTime = Date.now() - startTime;

    return {
      solution,
      report: this.generateReport(solution, phase1Time, phase2Time, phase3Time),
      executionTime: totalTime
    };
  }

  /**
   * Gera relatório detalhado da distribuição
   */
  private generateReport(
    solution: Solution,
    phase1Time: number,
    phase2Time: number,
    phase3Time: number,
    error?: string
  ): string {
    const scoreBreakdown = this.scorer.getScoreBreakdown(solution);
    const validationReport = this.validator.getValidationReport(solution.groups);

    let report = '═══════════════════════════════════════════════════════════\n';
    report += 'RELATÓRIO DE DISTRIBUIÇÃO\n';
    report += '═══════════════════════════════════════════════════════════\n\n';

    if (error) {
      report += `❌ ERRO: ${error}\n\n`;
    }

    // Resultado Final
    report += '📊 RESULTADO FINAL\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `✓ Status: ${validationReport.isFeasible ? '✅ VIÁVEL' : '❌ NÃO VIÁVEL'}\n`;
    report += `✓ Grupos Formados: ${solution.getGroupCount()}\n`;
    report += `✓ Alunos Alocados: ${solution.getAllocatedStudentCount()}\n`;
    report += `✓ Score Total: ${scoreBreakdown.totalScore.toFixed(0)}\n`;
    report += `✓ Satisfação: ${scoreBreakdown.satisfactionScore.toFixed(0)}\n`;
    report += `✓ Penalidades: ${scoreBreakdown.penaltyScore.toFixed(0)}\n`;
    report += `✓ Média por Aluno: ${scoreBreakdown.averagePerStudent.toFixed(2)}\n`;
    report += `✓ Média por Grupo: ${scoreBreakdown.averagePerGroup.toFixed(2)}\n';
    report += `✓ Grau de Satisfação: ${this.scorer.getSatisfactionGrade(solution)}\n';
    report += `✓ Score Normalizado: ${this.scorer.normalizeScore(solution).toFixed(1)}/100\n\n`;

    // Detalhes das Violações
    report += '⚠️  VIOLAÇÕES DE RESTRIÇÕES\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `✓ Críticas: ${validationReport.summary.CRITICAL}\n`;
    report += `✓ Importantes: ${validationReport.summary.IMPORTANT}\n`;
    report += `✓ Desejáveis: ${validationReport.summary.DESIRABLE}\n`;

    if (validationReport.violations.length > 0) {
      report += '\nDetalhes:\n';
      validationReport.violations.forEach((v, idx) => {
        report += `  ${idx + 1}. [${v.severity}] ${v.message}\n`;
      });
    } else {
      report += '\n✅ Nenhuma violação encontrada!\n';
    }
    report += '\n';

    // Timing das Fases
    report += '⏱️  TEMPO DE EXECUÇÃO\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `✓ Fase 1 (Geração Inicial): ${phase1Time}ms\n`;
    report += `✓ Fase 2 (Busca Local 2-opt): ${phase2Time}ms\n`;
    report += `✓ Fase 3 (Simulated Annealing): ${phase3Time}ms\n`;
    report += `✓ TOTAL: ${phase1Time + phase2Time + phase3Time}ms\n\n`;

    // Detalhes por Grupo
    report += '👥 DETALHES DOS GRUPOS\n';
    report += '───────────────────────────────────────────────────────────\n';

    for (let i = 0; i < solution.groups.length; i++) {
      const group = solution.groups[i];
      const composition = group.getComposition();
      const groupViolations = validationReport.violations.filter(
        v => v.affectedGroupId === group.id
      );

      report += `\nGrupo ${i + 1} (Tema: ${group.themeId})\n`;
      report += `  Alunos: ${group.students.length}/4\n`;
      report += `  Cursos: ${composition.electricalCount} EE, ${composition.mechanicalCount} ME\n`;
      report += `  Fases: ${composition.phases.size} distintas (${Array.from(composition.phases).sort().join(', ')})\n`;
      report += `  Integrantes:\n`;

      for (const student of group.students) {
        const score = student.getThemeScore(group.themeId);
        report += `    - ${student.name} (${student.course}, Fase ${student.phase}) - Score: ${score}\n`;
      }

      if (groupViolations.length > 0) {
        report += `  ⚠️  Violações:\n`;
        groupViolations.forEach(v => {
          report += `     - [${v.severity}] ${v.message}\n`;
        });
      }
    }

    report += '\n═══════════════════════════════════════════════════════════\n';

    return report;
  }

  /**
   * Valida cenário (viabilidade antes de distribuir)
   */
  validateScenario(students: Student[], themes: Theme[]): {
    isFeasible: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Contar alunos de EE
    const electricalCount = students.filter(s => s.isElectrical()).length;

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
}
