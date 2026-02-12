import { Student, Group, Theme, Solution } from '../../domain';
import { EnergyCalculator } from './EnergyCalculator';

/**
 * SolutionGenerator - Gera uma solução inicial viável (Fase 1)
 *
 * Estratégia (Modelo de Energia - Sistema Ideal):
 * 1. Para cada tema, tentar formar grupos que minimizam energia
 * 2. Usa EnergyCalculator para avaliar E(grupo, tema)
 * 3. Construção gulosa: escolhe alunos que reduzem energia
 * 4. Garante restrições CRÍTICAS via máscara dura (E = ∞)
 * 5. Aloca alunos restantes em temas com menos grupos
 */
export class SolutionGenerator {
  private energyCalculator: EnergyCalculator;

  constructor(config?: { wPref?: number; wDup?: number; wDiv?: number }) {
    this.energyCalculator = new EnergyCalculator(config);
  }

  /**
   * Gera uma solução inicial viável (Modelo de Energia)
   *
   * Estratégia gulosa:
   * 1. Para cada aluno não alocado, encontrar a melhor colocação
   * 2. Colocação = (tema, grupo) que minimiza energia total
   * 3. Se nenhuma colocação viável, criar novo grupo
   * 4. Retorna solução com energia calculada
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
    let totalEnergy = 0;

    // Fase 1: Formar grupos gulosa
    // Para cada aluno, encontrar melhor colocação (tema + grupo) que minimiza energia
    const unallocatedStudents = [...students].sort(() => Math.random() - 0.5); // Shuffle

    for (const student of unallocatedStudents) {
      if (allocatedStudents.has(student.id)) continue;

      let bestGroup: Group | null = null;
      let bestTheme: Theme | null = null;
      let bestEnergy = Infinity;

      // Tentar cada tema
      for (const theme of themes) {
        // Opção 1: Adicionar a um grupo existente para este tema
        const groupsForTheme = groups.filter(g => g.themeId === theme.id && !g.isFull());

        for (const group of groupsForTheme) {
          const testGroup = this.createTestGroup(group, student);
          const energy = this.energyCalculator.calculateGroupEnergy(testGroup, theme);

          if (energy < bestEnergy && energy !== Infinity) {
            bestEnergy = energy;
            bestGroup = group;
            bestTheme = theme;
          }
        }

        // Opção 2: Criar novo grupo com este aluno
        if (groups.filter(g => g.themeId === theme.id).length < theme.maxGroups) {
          const newGroup = new Group(
            `group_${groups.length}_${student.id}`,
            theme.id,
            'dist_temp',
            [student]
          );

          const energy = this.energyCalculator.calculateGroupEnergy(newGroup, theme);

          if (energy < bestEnergy) {
            bestEnergy = energy;
            bestGroup = newGroup;
            bestTheme = theme;
          }
        }
      }

      // Aplicar melhor colocação
      if (bestGroup && bestTheme) {
        if (!bestGroup.students.includes(student)) {
          bestGroup.addStudent(student);
          // Apenas adicionar grupo se é novo (não estava em groups)
          if (!groups.includes(bestGroup)) {
            groups.push(bestGroup);
          }
        }

        allocatedStudents.add(student.id);
        totalEnergy += bestEnergy;
      }
    }

    // Fase 2: Alocar alunos não colocáveis em qualquer grupo (último recurso)
    const remainingStudents = unallocatedStudents.filter(s => !allocatedStudents.has(s.id));

    for (const student of remainingStudents) {
      // Tenta adicionar a um grupo que violará restrições (como último recurso)
      let addedToGroup = false;

      for (const group of groups) {
        if (!group.isFull()) {
          try {
            group.addStudent(student);
            allocatedStudents.add(student.id);
            addedToGroup = true;
            break;
          } catch {
            // Continuar tentando outro grupo
          }
        }
      }

      // Se ainda não foi alocado, criar grupo novo mesmo que incompleto
      if (!addedToGroup && remainingStudents.length > 0) {
        const theme = groups.length > 0 ?
          themes[groups.length % themes.length] :
          themes[0];

        const newGroup = new Group(
          `group_remaining_${groups.length}`,
          theme.id,
          'dist_temp',
          [student]
        );

        groups.push(newGroup);
        allocatedStudents.add(student.id);
      }
    }

    // Calcular energia total da solução
    for (const group of groups) {
      const theme = themes.find(t => t.id === group.themeId);
      if (theme) {
        const energy = this.energyCalculator.calculateGroupEnergy(group, theme);
        if (energy === Infinity) {
          totalEnergy = Infinity;
          break;
        }
        totalEnergy += energy;
      }
    }

    const solution = new Solution(groups, [], 0, 0, 0, totalEnergy);
    return solution;
  }

  /**
   * Cria um grupo de teste adicionando um aluno temporariamente
   * Usado para avaliar energia antes de fazer a adição real
   */
  private createTestGroup(group: Group, student: Student): Group {
    const testGroup = new Group(
      group.id,
      group.themeId,
      group.distributionId,
      [...group.students, student]
    );
    return testGroup;
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
