import { Student, Theme, Phase, Course } from '../../domain';

/**
 * Resultado da análise de viabilidade
 */
export interface ViabilityAnalysisResult {
  isViable: boolean;
  impossibilities: SystemImpossibility[];
  recommendations: RelaxationRecommendation[];
  statistics: SystemStatistics;
}

/**
 * Uma impossibilidade detectada no sistema
 */
export interface SystemImpossibility {
  id: string;
  type: 'INSUFFICIENT_ELECTRICAL_ENGINEERS' | 'INSUFFICIENT_PHASES' | 'UNBALANCED_PHASE_DISTRIBUTION' | 'INSUFFICIENT_DIVERSITY' | 'OTHER';
  severity: 'CRITICAL' | 'WARNING';
  description: string;
  details: Record<string, unknown>;
}

/**
 * Recomendação de relaxamento de restrição
 */
export interface RelaxationRecommendation {
  type: 'ALLOW_ZERO_ELECTRICAL_ENGINEERS' | 'ALLOW_SINGLE_PHASE_GROUPS' | 'RELAX_PHASE_DIVERSITY' | 'REDUCE_GROUP_SIZE';
  description: string;
  impact: string;
  affectedConstraint: string;
}

/**
 * Regra de restrição personalizável
 */
export interface ConstraintRules {
  minElectricalEngineers: number;      // 0, 1, ou 2+
  maxElectricalEngineers: number;      // Máximo permitido
  minPhaseDiversity: number;            // 1 ou 2
  groupSize: number;                    // 4, 3, etc
}

/**
 * Estatísticas do sistema
 */
export interface SystemStatistics {
  totalStudents: number;
  totalGroups: number;
  studentsByPhase: Map<Phase, number>;
  studentsByElectricalEngineers: number;
  studentsByMechanicalEngineers: number;
  avgStudentsPerGroup: number;
  minElectricalEngineersNeeded: number;
  maxElectricalEngineersNeeded: number;
  uniquePhasesAvailable: number;
}

/**
 * SystemViabilityAnalyzer
 *
 * Analisa a viabilidade matemática do sistema ANTES de executar otimização.
 * Se impossibilidades forem detectadas, propõe relaxamentos de restrições.
 *
 * Fluxo:
 * 1. Verificar se E=∞ é inevitável (impossibilidade matemática)
 * 2. Identificar QUAL restrição é o problema
 * 3. Propor relaxamento específico
 * 4. Permitir execução com regras ajustadas
 */
export class SystemViabilityAnalyzer {
  /**
   * Analisa viabilidade do sistema
   */
  public analyzeViability(
    students: Student[],
    themes: Theme[],
    targetGroupSize: number = 4
  ): ViabilityAnalysisResult {
    const statistics = this.buildSystemStatistics(students, themes, targetGroupSize);
    const impossibilities = this.detectImpossibilities(statistics, targetGroupSize);
    const recommendations = this.generateRecommendations(impossibilities, statistics);

    return {
      isViable: impossibilities.length === 0,
      impossibilities,
      recommendations,
      statistics
    };
  }

  /**
   * Constrói estatísticas do sistema
   */
  private buildSystemStatistics(
    students: Student[],
    themes: Theme[],
    targetGroupSize: number
  ): SystemStatistics {
    const totalStudents = students.length;
    const totalGroups = Math.ceil(totalStudents / targetGroupSize);

    // Contar por fase
    const studentsByPhase = new Map<Phase, number>();
    for (const student of students) {
      studentsByPhase.set(student.phase, (studentsByPhase.get(student.phase) || 0) + 1);
    }

    // Contar por curso
    const studentsByElectricalEngineers = students.filter(s => s.course === Course.ELECTRICAL_ENGINEERING).length;
    const studentsByMechanicalEngineers = students.filter(s => s.course === Course.MECHANICAL_ENGINEERING).length;

    return {
      totalStudents,
      totalGroups,
      studentsByPhase,
      studentsByElectricalEngineers,
      studentsByMechanicalEngineers,
      avgStudentsPerGroup: totalStudents / totalGroups,
      minElectricalEngineersNeeded: totalGroups * 1, // Mínimo 1 por grupo
      maxElectricalEngineersNeeded: totalGroups * 2, // Máximo 2 por grupo
      uniquePhasesAvailable: studentsByPhase.size
    };
  }

  /**
   * Detecta impossibilidades no sistema
   */
  private detectImpossibilities(
    stats: SystemStatistics,
    targetGroupSize: number
  ): SystemImpossibility[] {
    const impossibilities: SystemImpossibility[] = [];

    // Verificação 1: Engenheiros Elétricos insuficientes
    if (stats.studentsByElectricalEngineers < stats.minElectricalEngineersNeeded) {
      impossibilities.push({
        id: 'insufficient_ee_1',
        type: 'INSUFFICIENT_ELECTRICAL_ENGINEERS',
        severity: 'CRITICAL',
        description: `Impossível alocar 1 EE em cada grupo. Total de EE: ${stats.studentsByElectricalEngineers}, Grupos necessários: ${stats.totalGroups}`,
        details: {
          totalElectricalEngineers: stats.studentsByElectricalEngineers,
          totalGroups: stats.totalGroups,
          requiredPerGroup: 1,
          totalRequired: stats.minElectricalEngineersNeeded,
          deficit: stats.minElectricalEngineersNeeded - stats.studentsByElectricalEngineers
        }
      });
    }

    // Verificação 2: Diversidade de fases insuficiente
    const minPhasesRequired = 2; // Mínimo de fases diferentes por grupo
    if (stats.uniquePhasesAvailable < minPhasesRequired) {
      impossibilities.push({
        id: 'insufficient_phases',
        type: 'INSUFFICIENT_PHASES',
        severity: 'CRITICAL',
        description: `Sistema tem apenas ${stats.uniquePhasesAvailable} fases, mas cada grupo precisa de ${minPhasesRequired} diferentes`,
        details: {
          uniquePhasesAvailable: stats.uniquePhasesAvailable,
          requiredPerGroup: minPhasesRequired,
          phases: Array.from(stats.studentsByPhase.keys())
        }
      });
    }

    // Verificação 3: Distribuição desbalanceada de fases
    const phaseDistribution = this.analyzePhaseDiversity(stats);
    if (!phaseDistribution.isSufficientlyDiverse) {
      impossibilities.push({
        id: 'unbalanced_phase_distribution',
        type: 'UNBALANCED_PHASE_DISTRIBUTION',
        severity: 'WARNING',
        description: `Distribuição de fases é muito desbalanceada. Fase ${phaseDistribution.dominantPhase} tem ${phaseDistribution.dominantPhaseCount} alunos (${phaseDistribution.percentageDominant.toFixed(1)}%)`,
        details: {
          dominantPhase: phaseDistribution.dominantPhase,
          dominantPhaseCount: phaseDistribution.dominantPhaseCount,
          totalStudents: stats.totalStudents,
          percentage: phaseDistribution.percentageDominant,
          phaseDistribution: Object.fromEntries(stats.studentsByPhase)
        }
      });
    }

    return impossibilities;
  }

  /**
   * Analisa diversidade de fases
   */
  private analyzePhaseDiversity(stats: SystemStatistics): {
    isSufficientlyDiverse: boolean;
    dominantPhase: Phase | null;
    dominantPhaseCount: number;
    percentageDominant: number;
  } {
    if (stats.studentsByPhase.size === 0) {
      return { isSufficientlyDiverse: false, dominantPhase: null, dominantPhaseCount: 0, percentageDominant: 0 };
    }

    let maxCount = 0;
    let dominantPhase: Phase | null = null;

    for (const [phase, count] of stats.studentsByPhase) {
      if (count > maxCount) {
        maxCount = count;
        dominantPhase = phase;
      }
    }

    const percentageDominant = (maxCount / stats.totalStudents) * 100;
    const isSufficientlyDiverse = percentageDominant < 50; // Menos de 50% em uma fase

    return {
      isSufficientlyDiverse,
      dominantPhase,
      dominantPhaseCount: maxCount,
      percentageDominant
    };
  }

  /**
   * Gera recomendações de relaxamento
   */
  private generateRecommendations(
    impossibilities: SystemImpossibility[],
    stats: SystemStatistics
  ): RelaxationRecommendation[] {
    const recommendations: RelaxationRecommendation[] = [];

    for (const impossibility of impossibilities) {
      if (impossibility.type === 'INSUFFICIENT_ELECTRICAL_ENGINEERS') {
        recommendations.push({
          type: 'ALLOW_ZERO_ELECTRICAL_ENGINEERS',
          description: `Permitir grupos sem alunos de Engenharia Elétrica`,
          impact: `Relaxa a restrição de 1-2 EE por grupo para 0-2 EE. Retirada a restrição crítica de diversidade de cursos.`,
          affectedConstraint: 'ELECTRICAL_COMPOSITION'
        });

        const deficit = stats.minElectricalEngineersNeeded - stats.studentsByElectricalEngineers;
        const percentageCanFill = ((stats.studentsByElectricalEngineers / stats.minElectricalEngineersNeeded) * 100).toFixed(1);
        recommendations.push({
          type: 'REDUCE_GROUP_SIZE',
          description: `Reduzir tamanho de grupos para ${Math.floor(stats.totalStudents / (stats.studentsByElectricalEngineers))} alunos`,
          impact: `Criaria ${Math.ceil(stats.totalStudents / Math.floor(stats.totalStudents / stats.studentsByElectricalEngineers))} grupos, permitindo 1 EE por grupo (${percentageCanFill}% de cobertura).`,
          affectedConstraint: 'GROUP_SIZE'
        });
      }

      if (impossibility.type === 'INSUFFICIENT_PHASES') {
        recommendations.push({
          type: 'ALLOW_SINGLE_PHASE_GROUPS',
          description: `Permitir grupos com apenas 1 fase`,
          impact: `Remove a restrição de mínimo 2 fases por grupo.`,
          affectedConstraint: 'PHASE_DIVERSITY'
        });
      }

      if (impossibility.type === 'UNBALANCED_PHASE_DISTRIBUTION') {
        recommendations.push({
          type: 'RELAX_PHASE_DIVERSITY',
          description: `Relaxar requisito de 2+ fases para 1 fase (permitindo grupos homogêneos)`,
          impact: `Reduz a qualidade de diversidade, mas permite viabilidade do sistema.`,
          affectedConstraint: 'PHASE_DIVERSITY'
        });
      }
    }

    return recommendations;
  }

  /**
   * Sugere regras de restrição baseadas em análise
   */
  public suggestConstraintRules(
    students: Student[],
    targetGroupSize: number = 4
  ): ConstraintRules {
    const totalStudents = students.length;
    const totalGroups = Math.ceil(totalStudents / targetGroupSize);
    const electricalEngineers = students.filter(s => s.course === Course.ELECTRICAL_ENGINEERING).length;

    const rules: ConstraintRules = {
      minElectricalEngineers: 1,
      maxElectricalEngineers: 2,
      minPhaseDiversity: 2,
      groupSize: targetGroupSize
    };

    // Se não há EE suficientes, permite 0
    if (electricalEngineers < totalGroups) {
      rules.minElectricalEngineers = 0;
    }

    // Se há fases insuficientes, permite apenas 1
    const uniquePhases = new Set(students.map(s => s.phase)).size;
    if (uniquePhases < 2) {
      rules.minPhaseDiversity = 1;
    }

    return rules;
  }

  /**
   * Retorna relatório formatado para log/UI
   */
  public generateReport(result: ViabilityAnalysisResult): string {
    let report = '╔═══════════════════════════════════════════════════════╗\n';
    report += '║        ANÁLISE DE VIABILIDADE DO SISTEMA               ║\n';
    report += '╚═══════════════════════════════════════════════════════╝\n\n';

    // Estatísticas
    report += '📊 ESTATÍSTICAS DO SISTEMA:\n';
    report += `   • Total de alunos: ${result.statistics.totalStudents}\n`;
    report += `   • Total de grupos esperados: ${result.statistics.totalGroups}\n`;
    report += `   • Engenheiros Elétricos: ${result.statistics.studentsByElectricalEngineers}\n`;
    report += `   • Engenheiros Mecânicos: ${result.statistics.studentsByMechanicalEngineers}\n`;
    report += `   • Fases diferentes: ${result.statistics.uniquePhasesAvailable}\n\n`;

    // Status geral
    if (result.isViable) {
      report += '✅ SISTEMA VIÁVEL - Restrições podem ser satisfeitas\n\n';
    } else {
      report += '❌ SISTEMA INVIÁVEL - Impossibilidades detectadas\n\n';

      // Impossibilidades
      report += '🚫 IMPOSSIBILIDADES DETECTADAS:\n';
      for (const imp of result.impossibilities) {
        const icon = imp.severity === 'CRITICAL' ? '🔴' : '🟡';
        report += `\n   ${icon} ${imp.type}\n`;
        report += `      ${imp.description}\n`;
      }

      report += '\n';

      // Recomendações
      if (result.recommendations.length > 0) {
        report += '💡 RECOMENDAÇÕES DE RELAXAMENTO:\n';
        for (let i = 0; i < result.recommendations.length; i++) {
          const rec = result.recommendations[i];
          report += `\n   ${i + 1}. ${rec.description}\n`;
          report += `      📌 Afeta: ${rec.affectedConstraint}\n`;
          report += `      📈 Impacto: ${rec.impact}\n`;
        }
        report += '\n';
      }
    }

    return report;
  }
}
