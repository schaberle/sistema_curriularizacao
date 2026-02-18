import { Student, Group, Theme } from '../../domain';
import {
  SystemViabilityAnalyzer,
  ViabilityAnalysisResult,
  ConstraintRules
} from './SystemViabilityAnalyzer';

/**
 * Estado de restrições do sistema
 */
export interface ConstraintState {
  rules: ConstraintRules;
  adaptedFromDefault: boolean;
  reasonForAdaptation?: string;
  originalRules: ConstraintRules;
}

/**
 * AdaptiveConstraintManager
 *
 * Gerencia restrições de forma adaptativa:
 * 1. Analisa viabilidade do sistema
 * 2. Se impossível, determina quais restrições relaxar
 * 3. Aplica relaxamentos dinamicamente
 * 4. Permite execução com restrições ajustadas
 *
 * Exemplo:
 * ```
 * const manager = new AdaptiveConstraintManager();
 * const state = manager.analyzeAndAdapt(students, themes);
 *
 * if (!state.rules.feasible) {
 *   console.log('Sistema ajustado:', state.reasonForAdaptation);
 * }
 *
 * // Usar state.rules na otimização
 * ```
 */
export class AdaptiveConstraintManager {
  private analyzer = new SystemViabilityAnalyzer();

  /**
   * Analisa viabilidade e adapta restrições se necessário
   */
  public analyzeAndAdapt(
    students: Student[],
    themes: Theme[],
    defaultRules?: ConstraintRules
  ): ConstraintState {
    const defaultConstraints = defaultRules || this.getDefaultRules();

    // Executar análise de viabilidade
    const analysis = this.analyzer.analyzeViability(students, themes, defaultConstraints.groupSize);

    // Se viável com regras padrão, retornar
    if (analysis.isViable) {
      return {
        rules: defaultConstraints,
        adaptedFromDefault: false,
        originalRules: defaultConstraints
      };
    }

    // Se não viável, sugerir ajustes
    const adaptedRules = this.analyzer.suggestConstraintRules(students, defaultConstraints.groupSize);

    // Log de adaptação
    const reasonForAdaptation = this.buildReasonMessage(analysis);

    return {
      rules: adaptedRules,
      adaptedFromDefault: true,
      reasonForAdaptation,
      originalRules: defaultConstraints
    };
  }

  /**
   * Constrói mensagem explicativa de adaptação
   */
  private buildReasonMessage(analysis: ViabilityAnalysisResult): string {
    const impossibilities = analysis.impossibilities.map(i => `${i.type}: ${i.description}`).join('\n   ');

    const adjustment: string[] = [];

    // Recomendar ajustes baseados em impossibilidades
    for (const rec of analysis.recommendations) {
      adjustment.push(`→ ${rec.description}`);
    }

    return `Sistema ajustado automaticamente:\n   ${impossibilities}\n\n   Ajustes:\n   ${adjustment.join('\n   ')}`;
  }

  /**
   * Retorna regras padrão
   */
  private getDefaultRules(): ConstraintRules {
    return {
      minElectricalEngineers: 1,
      maxElectricalEngineers: 2,
      minPhaseDiversity: 2,
      groupSize: 4
    };
  }

  /**
   * Valida grupo contra regras de restrição
   */
  public validateGroupAgainstRules(group: Group, rules: ConstraintRules): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Verificar tamanho do grupo
    if (group.students.length !== rules.groupSize) {
      violations.push(`Tamanho esperado: ${rules.groupSize}, encontrado: ${group.students.length}`);
    }

    // Verificar engenheiros elétricos
    const eeCount = group.students.filter(s => s.isElectrical()).length;
    if (eeCount < rules.minElectricalEngineers || eeCount > rules.maxElectricalEngineers) {
      violations.push(`EE esperados: ${rules.minElectricalEngineers}-${rules.maxElectricalEngineers}, encontrados: ${eeCount}`);
    }

    // Verificar diversidade de fases
    const phases = new Set(group.students.map(s => s.phase));
    if (phases.size < rules.minPhaseDiversity) {
      violations.push(`Fases esperadas: mín ${rules.minPhaseDiversity}, encontradas: ${phases.size}`);
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * Adapta grupo para satisfazer regras (se possível)
   */
  public tryAdaptGroupToRules(
    group: Group,
    rules: ConstraintRules,
    availableStudents: Student[]
  ): Group | null {
    // Esta é uma operação complexa que depende da lógica de troca
    // Aqui apenas verificamos se é possível
    const validation = this.validateGroupAgainstRules(group, rules);

    if (validation.isValid) {
      return group;
    }

    // Implementar adaptação seria complexo e dependeria do contexto
    // Por enquanto, apenas retornar null se não é válido
    return null;
  }

  /**
   * Gera relatório de status das restrições
   */
  public generateConstraintReport(state: ConstraintState, analysis?: ViabilityAnalysisResult): string {
    let report = '╔═══════════════════════════════════════════════════════╗\n';
    report += '║        STATUS DAS RESTRIÇÕES DO SISTEMA                ║\n';
    report += '╚═══════════════════════════════════════════════════════╝\n\n';

    if (state.adaptedFromDefault) {
      report += '⚠️  RESTRIÇÕES ADAPTADAS (sistema com impossibilidades)\n\n';
      report += state.reasonForAdaptation + '\n\n';
    } else {
      report += '✅ RESTRIÇÕES PADRÃO (sistema viável)\n\n';
    }

    report += '📋 REGRAS ATIVAS:\n';
    report += `   • EE por grupo: ${state.rules.minElectricalEngineers}-${state.rules.maxElectricalEngineers}\n`;
    report += `   • Mín fases diferentes: ${state.rules.minPhaseDiversity}\n`;
    report += `   • Tamanho de grupo: ${state.rules.groupSize}\n`;

    if (state.adaptedFromDefault) {
      report += '\n📋 REGRAS ORIGINAIS (para referência):\n';
      report += `   • EE por grupo: ${state.originalRules.minElectricalEngineers}-${state.originalRules.maxElectricalEngineers}\n`;
      report += `   • Mín fases diferentes: ${state.originalRules.minPhaseDiversity}\n`;
      report += `   • Tamanho de grupo: ${state.originalRules.groupSize}\n`;
    }

    return report;
  }
}
