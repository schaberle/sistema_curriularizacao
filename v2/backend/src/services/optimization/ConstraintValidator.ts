import { Group, ConstraintViolation } from '../../domain';
import { ConstraintRules } from './SystemViabilityAnalyzer';

/**
 * ConstraintValidator - Valida restrições em grupos
 *
 * Restrições (em ordem de importância):
 * 1. CRÍTICA: 1-2 alunos de Eng. Elétrica por grupo (resto Eng. Mecânica)
 * 2. CRÍTICA: MÍNIMO 2 fases diferentes por grupo
 * 3. DESEJÁVEL: IDEAL 3 fases diferentes por grupo (máximo 3)
 * 4. DESEJÁVEL: Idealmente cada aluno de uma fase diferente
 */
export class ConstraintValidator {
  // Restrições dinâmicas (pode ser adaptado por AdaptiveConstraintManager)
  private rules: ConstraintRules = {
    minElectricalEngineers: 1,
    maxElectricalEngineers: 2,
    minPhaseDiversity: 2,
    groupSize: 4
  };

  /**
   * Define restrições dinâmicas (chamado por AdaptiveConstraintManager)
   */
  public setConstraintRules(rules: ConstraintRules): void {
    this.rules = rules;
  }
  /**
   * Valida um grupo e retorna lista de violações
   */
  validateGroup(group: Group): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Se grupo está vazio, pular validações
    if (group.isEmpty()) {
      return violations;
    }

    // Restrição 1: Composição de Eng. Elétrica (CRÍTICA)
    violations.push(...this.validateElectricalComposition(group));

    // Restrição 2: Diversidade Mínima de Fases (CRÍTICA)
    violations.push(...this.validateMinimumPhaseDiversity(group));

    // Restrição 3: Diversidade Ideal de Fases (DESEJÁVEL)
    violations.push(...this.validateIdealPhaseDiversity(group));

    // Restrição 4: Fases Únicas por Aluno (DESEJÁVEL)
    violations.push(...this.validatePhaseUniqueness(group));

    return violations;
  }

  /**
   * Valida composição de Eng. Elétrica (dinâmica)
   * Restrição: min-max alunos de EE por grupo (adaptável)
   */
  private validateElectricalComposition(group: Group): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const composition = group.getComposition();
    const count = composition.electricalCount;

    if (count < this.rules.minElectricalEngineers || count > this.rules.maxElectricalEngineers) {
      violations.push({
        type: 'ELECTRICAL_COMPOSITION',
        severity: 'CRITICAL',
        message: `Grupo deve ter ${this.rules.minElectricalEngineers}-${this.rules.maxElectricalEngineers} alunos de Eng. Elétrica, tem ${count}`,
        affectedGroupId: group.id,
        details: {
          expected: `${this.rules.minElectricalEngineers}-${this.rules.maxElectricalEngineers}`,
          actual: count
        }
      });
    }

    return violations;
  }

  /**
   * Valida diversidade mínima de fases (dinâmica)
   * Restrição: MÍNIMO N fases diferentes (adaptável)
   */
  private validateMinimumPhaseDiversity(group: Group): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const composition = group.getComposition();
    const phaseCount = composition.phases.size;

    if (phaseCount < this.rules.minPhaseDiversity) {
      violations.push({
        type: 'PHASE_DIVERSITY',
        severity: 'CRITICAL',
        message: `Grupo deve ter MÍNIMO ${this.rules.minPhaseDiversity} fase(s) diferente(s), tem ${phaseCount}`,
        affectedGroupId: group.id,
        details: {
          minimumRequired: this.rules.minPhaseDiversity,
          actual: phaseCount,
          phases: Array.from(composition.phases)
        }
      });
    }

    return violations;
  }

  /**
   * Valida diversidade ideal de fases
   * Restrição: IDEAL 3 fases, MÁXIMO 3
   */
  private validateIdealPhaseDiversity(group: Group): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const composition = group.getComposition();
    const phaseCount = composition.phases.size;

    // Se tem menos de 3, é desejável ter 3
    if (phaseCount < 3) {
      violations.push({
        type: 'PHASE_DIVERSITY',
        severity: 'DESIRABLE',
        message: `Idealmente o grupo deveria ter 3 fases diferentes, tem ${phaseCount}`,
        affectedGroupId: group.id,
        details: {
          ideal: 3,
          actual: phaseCount,
          phases: Array.from(composition.phases)
        }
      });
    }

    return violations;
  }

  /**
   * Valida unicidade de fases por aluno
   * Restrição: Idealmente cada aluno de uma fase diferente
   */
  private validatePhaseUniqueness(group: Group): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const composition = group.getComposition();

    // Se o número de fases é menor que o número de alunos
    // significa que há repetição de fases
    if (composition.phases.size < group.getStudentCount()) {
      const phaseMap = new Map<number, number>();

      for (const student of group.students) {
        phaseMap.set(student.phase, (phaseMap.get(student.phase) || 0) + 1);
      }

      const duplicates: number[] = [];
      for (const [phase, count] of phaseMap) {
        if (count > 1) {
          duplicates.push(phase);
        }
      }

      violations.push({
        type: 'PHASE_UNIQUENESS',
        severity: 'DESIRABLE',
        message: `Idealmente cada aluno deveria ter fase diferente. Fases repetidas: ${duplicates.join(', ')}`,
        affectedGroupId: group.id,
        details: {
          duplicatePhases: duplicates,
          phaseMap: Object.fromEntries(phaseMap)
        }
      });
    }

    return violations;
  }

  /**
   * Valida múltiplos grupos
   */
  validateGroups(groups: Group[]): ConstraintViolation[] {
    const allViolations: ConstraintViolation[] = [];

    for (const group of groups) {
      allViolations.push(...this.validateGroup(group));
    }

    return allViolations;
  }

  /**
   * Verifica se um grupo satisfaz restrições críticas
   */
  isGroupFeasible(group: Group): boolean {
    const violations = this.validateGroup(group);
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
    return criticalViolations.length === 0;
  }

  /**
   * Verifica se múltiplos grupos satisfazem restrições críticas
   */
  areGroupsFeasible(groups: Group[]): boolean {
    return groups.every(g => this.isGroupFeasible(g));
  }

  /**
   * Conta violações por severidade
   */
  countViolationsBySeverity(violations: ConstraintViolation[]): Record<string, number> {
    const counts = {
      CRITICAL: 0,
      IMPORTANT: 0,
      DESIRABLE: 0
    };

    for (const violation of violations) {
      counts[violation.severity]++;
    }

    return counts;
  }

  /**
   * Obtém relatório de validação
   */
  getValidationReport(groups: Group[]): {
    violations: ConstraintViolation[];
    isFeasible: boolean;
    summary: Record<string, number>;
  } {
    const violations = this.validateGroups(groups);
    const isFeasible = this.areGroupsFeasible(groups);
    const summary = this.countViolationsBySeverity(violations);

    return {
      violations,
      isFeasible,
      summary
    };
  }
}
