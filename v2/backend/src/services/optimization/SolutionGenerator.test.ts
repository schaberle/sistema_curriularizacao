import { SolutionGenerator } from './SolutionGenerator';
import { Student, Theme } from '../../domain';

describe('SolutionGenerator', () => {
  let generator: SolutionGenerator;
  const distributionId = 'dist-001';

  beforeEach(() => {
    generator = new SolutionGenerator({
      wPref: 1.0,
      wDup: 0.9,
      wDiv: 0.35,
    });
  });

  function createStudent(
    id: string,
    name: string,
    course: 'EE' | 'ME',
    phase: number,
    preferences: string[] = []
  ): Student {
    const defaultPrefs = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
    const prefs = preferences.length > 0 ? preferences : defaultPrefs;

    return new Student(
      id,
      name,
      course as any,
      phase,
      prefs.map((themeId, idx) => ({ themeId, rank: idx + 1 }))
    );
  }

  function createTheme(id: string, name: string, groupProportion: number = 10): Theme {
    return new Theme(id, distributionId, name, groupProportion);
  }

  describe('Geracao de Solucao Inicial', () => {
    it('deve gerar grupos validos para entrada basica', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'ME', 3),
        createStudent('s3', 'Carol', 'ME', 5),
        createStudent('s4', 'David', 'ME', 7),
        createStudent('s5', 'Eve', 'EE', 2),
        createStudent('s6', 'Frank', 'ME', 4),
        createStudent('s7', 'Grace', 'ME', 6),
        createStudent('s8', 'Henry', 'ME', 8),
      ];

      const themes = [
        createTheme('T1', 'Tema 1', 2),
        createTheme('T2', 'Tema 2', 2),
      ];

      const solution = generator.generateInitialSolution(students, themes);

      expect(solution.getGroupCount()).toBeGreaterThan(0);
      for (const group of solution.groups) {
        expect(group.students.length).toBeGreaterThanOrEqual(3);
        expect(group.students.length).toBeLessThanOrEqual(5);
      }
    });

    it('deve retornar solucao vazia para entrada vazia', () => {
      const solution = generator.generateInitialSolution([], []);
      expect(solution.getGroupCount()).toBe(0);
    });

    it('deve alocar todos os alunos', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'ME', 3),
        createStudent('s3', 'Carol', 'ME', 5),
        createStudent('s4', 'David', 'ME', 7),
      ];

      const themes = [createTheme('T1', 'Tema 1', 10)];

      const solution = generator.generateInitialSolution(students, themes);
      const totalStudents = solution.groups.reduce((sum, g) => sum + g.students.length, 0);

      expect(totalStudents).toBe(students.length);
    });

    it('deve respeitar distribuicao proporcional por tema', () => {
      const students = Array.from({ length: 12 }, (_, i) =>
        createStudent(
          `s${i + 1}`,
          `Student ${i + 1}`,
          i % 3 === 0 ? 'EE' : 'ME',
          (i % 8) + 1
        )
      );

      const themes = [
        createTheme('T1', 'Tema 1', 1),
        createTheme('T2', 'Tema 2', 2),
      ];

      const solution = generator.generateInitialSolution(students, themes);

      const groupsByTheme = new Map<string, number>();
      for (const group of solution.groups) {
        groupsByTheme.set(group.themeId, (groupsByTheme.get(group.themeId) || 0) + 1);
      }

      expect(groupsByTheme.get('T1') || 0).toBe(1);
      expect(groupsByTheme.get('T2') || 0).toBe(2);
    });

    it('deve distribuir igualmente quando todos os pesos forem 1', () => {
      const students = Array.from({ length: 32 }, (_, i) =>
        createStudent(
          `s${i + 1}`,
          `Student ${i + 1}`,
          i < 8 ? 'EE' : 'ME',
          (i % 8) + 1,
          ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']
        )
      );

      const themes = Array.from({ length: 8 }, (_, i) =>
        createTheme(`T${i + 1}`, `Tema ${i + 1}`, 1)
      );

      const solution = generator.generateInitialSolution(students, themes);
      const groupsByTheme = new Map<string, number>();
      for (const group of solution.groups) {
        groupsByTheme.set(group.themeId, (groupsByTheme.get(group.themeId) || 0) + 1);
      }

      expect(solution.getGroupCount()).toBe(8);
      expect(groupsByTheme.size).toBe(8);
      for (const theme of themes) {
        expect(groupsByTheme.get(theme.id) || 0).toBe(1);
      }
    });

    it('deve calcular energia de saida', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s2', 'Bob', 'ME', 3, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s3', 'Carol', 'ME', 5, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s4', 'David', 'ME', 7, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
      ];

      const themes = [createTheme('T1', 'Tema 1', 10)];

      const solution = generator.generateInitialSolution(students, themes);
      expect(solution.getTotalEnergy()).toBeDefined();
      expect(solution.getGroupCount()).toBeGreaterThan(0);
    });

    it('deve evitar grupos de 3 quando existir arranjo em 4/5', () => {
      const students = Array.from({ length: 167 }, (_, i) =>
        createStudent(
          `s${i + 1}`,
          `Student ${i + 1}`,
          i < 50 ? 'EE' : 'ME',
          (i % 10) + 1
        )
      );

      const themes = [
        createTheme('T1', 'Tema 1', 50),
        createTheme('T2', 'Tema 2', 50),
      ];

      const solution = generator.generateInitialSolution(students, themes);
      const sizes = solution.groups.map((group) => group.students.length);

      expect(solution.getGroupCount()).toBe(41);
      expect(sizes.filter((size) => size === 3)).toHaveLength(0);
      expect(sizes.filter((size) => size === 4)).toHaveLength(38);
      expect(sizes.filter((size) => size === 5)).toHaveLength(3);
      expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(167);
    });

    it('deve manter grupo de 3 quando for inevitavel', () => {
      const students = Array.from({ length: 11 }, (_, i) =>
        createStudent(
          `s${i + 1}`,
          `Student ${i + 1}`,
          i < 4 ? 'EE' : 'ME',
          (i % 5) + 1
        )
      );

      const themes = [createTheme('T1', 'Tema 1', 10)];

      const solution = generator.generateInitialSolution(students, themes);
      const sizes = solution.groups.map((group) => group.students.length);

      expect(solution.getGroupCount()).toBe(3);
      expect(sizes.filter((size) => size === 3)).toHaveLength(1);
      expect(sizes.filter((size) => size === 4)).toHaveLength(2);
      expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(11);
    });
  });

  describe('Configuracao de Pesos', () => {
    it('deve aceitar pesos customizados no construtor', () => {
      const customGen = new SolutionGenerator({
        wPref: 2.0,
        wDup: 1.0,
        wDiv: 0.5,
      });

      const weights = customGen.getWeights();
      expect(weights.wPref).toBe(2.0);
      expect(weights.wDup).toBe(1.0);
      expect(weights.wDiv).toBe(0.5);
    });

    it('deve usar pesos padrao se nao especificados', () => {
      const defaultGen = new SolutionGenerator();
      const weights = defaultGen.getWeights();

      expect(weights.wPref).toBe(1.0);
      expect(weights.wDup).toBe(0.9);
      expect(weights.wDiv).toBe(0.35);
    });

    it('deve permitir mudar pesos via setWeights', () => {
      generator.setWeights({ wPref: 1.5, wDup: 0.8, wDiv: 0.4 });
      const weights = generator.getWeights();

      expect(weights.wPref).toBe(1.5);
      expect(weights.wDup).toBe(0.8);
      expect(weights.wDiv).toBe(0.4);
    });
  });
});
