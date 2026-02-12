import { Student, Group, Theme, Solution } from '../../domain';
import { ConstraintValidator } from './ConstraintValidator';

/**
 * SolutionGenerator - Gera uma solução inicial viável
 *
 * Estratégia:
 * 1. Ordena alunos por preferências agregadas (quantos preferem cada tema)
 * 2. Para cada tema, forma grupos com alunos que o preferem
 * 3. Garante restrições CRÍTICAS (composição EE e diversidade de fases)
 * 4. Aloca alunos restantes em temas com menos grupos
 */
export class SolutionGenerator {
  private validator: ConstraintValidator;

  constructor() {
    this.validator = new ConstraintValidator();
  }

  /**
   * Gera uma solução inicial viável
   */
  generateInitialSolution(
    students: Student[],
    themes: Theme[]
  ): Solution {
    if (students.length === 0 || themes.length === 0) {
      return new Solution([], [], 0);
    }

    const groups: Group[] = [];
    const allocatedStudents = new Set<string>();

    // 1. Para cada tema, tentar formar grupos
    for (const theme of themes) {
      for (let i = 0; i < theme.maxGroups; i++) {
        const group = this.formGroupForTheme(
          students,
          theme,
          allocatedStudents
        );

        if (group && group.getStudentCount() > 0) {
          groups.push(group);

          // Marcar alunos como alocados
          for (const student of group.students) {
            allocatedStudents.add(student.id);
          }
        }
      }
    }

    // 2. Alocar alunos restantes em temas com menos grupos
    const remainingStudents = students.filter(s => !allocatedStudents.has(s.id));

    for (const student of remainingStudents) {
      // Encontrar tema com menos grupos
      const themeCounts = new Map<string, number>();
      for (const theme of themes) {
        themeCounts.set(theme.id, 0);
      }

      for (const group of groups) {
        themeCounts.set(group.themeId, (themeCounts.get(group.themeId) || 0) + 1);
      }

      // Encontrar grupo não cheio com menos grupos daquele tema
      let assignedToGroup = false;

      // Ordenar temas por número de grupos (menos grupos primeiro)
      const sortedThemes = [...themes].sort((a, b) => {
        const countA = themeCounts.get(a.id) || 0;
        const countB = themeCounts.get(b.id) || 0;
        return countA - countB;
      });

      for (const theme of sortedThemes) {
        // Encontrar grupo não cheio para este tema
        const groupsForTheme = groups.filter(g => g.themeId === theme.id);
        const notFullGroups = groupsForTheme.filter(g => !g.isFull());

        for (const group of notFullGroups) {
          // Verificar se pode adicionar mantendo restrições críticas
          if (this.canAddStudentToGroup(student, group)) {
            try {
              group.addStudent(student);
              allocatedStudents.add(student.id);
              assignedToGroup = true;
              break;
            } catch {
              // Continuar tentando outro grupo
            }
          }
        }

        if (assignedToGroup) break;
      }

      // Se não conseguiu alocar em grupo existente, criar novo
      if (!assignedToGroup) {
        const theme = sortedThemes[0];
        const groupId = `group_${groups.length}`;
        const newGroup = new Group(groupId, theme.id, 'dist_temp', [student]);
        groups.push(newGroup);
        allocatedStudents.add(student.id);
      }
    }

    // 3. Validar solução
    const solution = new Solution(groups, [], 0);
    const violations = this.validator.validateGroups(groups);
    solution.constraintViolations = violations;

    return solution;
  }

  /**
   * Forma um grupo para um tema específico
   */
  private formGroupForTheme(
    students: Student[],
    theme: Theme,
    allocatedStudents: Set<string>
  ): Group {
    const groupId = `group_${Math.random().toString(36).substring(7)}`;
    const group = new Group(groupId, theme.id, 'dist_temp');

    // Candidatos: alunos não alocados que preferem este tema
    const candidates = students.filter(s =>
      !allocatedStudents.has(s.id) && s.hasPreferenceFor(theme.id)
    );

    // Ordenar por rank de preferência (mais preferido primeiro)
    const sorted = [...candidates].sort((a, b) => {
      const rankA = a.getThemeRank(theme.id);
      const rankB = b.getThemeRank(theme.id);
      return rankA - rankB;
    });

    // Tentar montar um grupo viável
    for (const student of sorted) {
      if (group.isFull()) break;

      if (this.canAddStudentToGroup(student, group)) {
        try {
          group.addStudent(student);
        } catch {
          // Continuar tentando próximo aluno
        }
      }
    }

    return group;
  }

  /**
   * Verifica se pode adicionar aluno a um grupo mantendo restrições críticas
   */
  private canAddStudentToGroup(student: Student, group: Group): boolean {
    // Criar uma cópia temporária para testar
    const tempGroup = new Group(
      group.id,
      group.themeId,
      group.distributionId,
      [...group.students]
    );

    try {
      tempGroup.addStudent(student);
    } catch {
      return false;
    }

    // Verificar restrições críticas
    const composition = tempGroup.getComposition();

    // Restrição 1: 1-2 alunos de EE
    if (composition.electricalCount < 1 || composition.electricalCount > 2) {
      return false;
    }

    // Restrição 2: Mínimo 2 fases diferentes
    if (composition.phases.size < 2) {
      return false;
    }

    return true;
  }

  /**
   * Valida se solução é viável (sem violações críticas)
   */
  isSolutionFeasible(solution: Solution): boolean {
    const criticalViolations = solution.constraintViolations.filter(
      v => v.severity === 'CRITICAL'
    );
    return criticalViolations.length === 0;
  }
}
