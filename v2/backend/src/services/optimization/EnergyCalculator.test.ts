import { EnergyCalculator } from './EnergyCalculator';
import { Group, Student, Theme } from '../../domain';

describe('EnergyCalculator', () => {
  let calculator: EnergyCalculator;
  let distributionId: string;

  beforeEach(() => {
    calculator = new EnergyCalculator({
      wPref: 1.0,
      wDup: 0.9,
      wDiv: 0.35,
    });
    distributionId = 'dist-001';
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

  function createStudentNoPreferences(
    id: string,
    name: string,
    course: 'EE' | 'ME',
    phase: number
  ): Student {
    return new Student(id, name, course as any, phase, []);
  }

  function createTheme(id: string, name: string): Theme {
    return new Theme(id, distributionId, name, 10);
  }

  function createGroup(id: string, themeId: string, students: Student[]): Group {
    return new Group(id, themeId, distributionId, students);
  }

  describe('Viabilidade', () => {
    it('grupo com menos de 3 alunos deve ter energia infinita', () => {
      const group = createGroup('g1', 'T1', [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'ME', 3),
      ]);
      const theme = createTheme('T1', 'Tema 1');

      expect(calculator.calculateGroupEnergy(group, theme)).toBe(Infinity);
    });

    it('grupo com 0 EE deve ter energia infinita', () => {
      const group = createGroup('g1', 'T1', [
        createStudent('s1', 'Alice', 'ME', 1),
        createStudent('s2', 'Bob', 'ME', 3),
        createStudent('s3', 'Carol', 'ME', 5),
        createStudent('s4', 'David', 'ME', 7),
      ]);
      const theme = createTheme('T1', 'Tema 1');

      expect(calculator.calculateGroupEnergy(group, theme)).toBe(Infinity);
    });

    it('grupo com 1 fase deve ter energia infinita', () => {
      const group = createGroup('g1', 'T1', [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'EE', 1),
        createStudent('s3', 'Carol', 'ME', 1),
        createStudent('s4', 'David', 'ME', 1),
      ]);
      const theme = createTheme('T1', 'Tema 1');

      expect(calculator.calculateGroupEnergy(group, theme)).toBe(Infinity);
    });

    it('grupo de 3 viavel deve ter energia finita', () => {
      const group = createGroup('g1', 'T1', [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'ME', 3),
        createStudent('s3', 'Carol', 'ME', 5),
      ]);
      const theme = createTheme('T1', 'Tema 1');

      expect(Number.isFinite(calculator.calculateGroupEnergy(group, theme))).toBe(true);
    });
  });

  describe('Termo E_size', () => {
    it('deve preferir tamanho 4, depois 5, e penalizar fortemente 3', () => {
      const sizeOnlyCalculator = new EnergyCalculator({
        wPref: 0,
        wDup: 0,
        wDiv: 0,
      });
      const theme = createTheme('T1', 'Tema 1');

      const group3 = createGroup('g3', 'T1', [
        createStudentNoPreferences('s1', 'A', 'EE', 1),
        createStudentNoPreferences('s2', 'B', 'ME', 2),
        createStudentNoPreferences('s3', 'C', 'ME', 3),
      ]);

      const group4 = createGroup('g4', 'T1', [
        createStudentNoPreferences('s4', 'D', 'EE', 1),
        createStudentNoPreferences('s5', 'E', 'ME', 2),
        createStudentNoPreferences('s6', 'F', 'ME', 3),
        createStudentNoPreferences('s7', 'G', 'ME', 4),
      ]);

      const group5 = createGroup('g5', 'T1', [
        createStudentNoPreferences('s8', 'H', 'EE', 1),
        createStudentNoPreferences('s9', 'I', 'ME', 2),
        createStudentNoPreferences('s10', 'J', 'ME', 3),
        createStudentNoPreferences('s11', 'K', 'ME', 4),
        createStudentNoPreferences('s12', 'L', 'ME', 5),
      ]);

      const e3 = sizeOnlyCalculator.calculateGroupEnergy(group3, theme);
      const e4 = sizeOnlyCalculator.calculateGroupEnergy(group4, theme);
      const e5 = sizeOnlyCalculator.calculateGroupEnergy(group5, theme);

      expect(e3).toBeCloseTo(2.5, 8);
      expect(e4).toBeCloseTo(0, 8);
      expect(e5).toBeCloseTo(0.25, 8);
      expect(e3).toBeGreaterThan(e5);
      expect(e5).toBeGreaterThan(e4);
    });
  });

  describe('Preferencias e tema', () => {
    it('deve retornar o tema com menor energia', () => {
      const group = createGroup('g1', 'T1', [
        createStudent('s1', 'Alice', 'EE', 1, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s2', 'Bob', 'ME', 3, ['T2', 'T1', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s3', 'Carol', 'ME', 5, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s4', 'David', 'ME', 7, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
      ]);

      const themes = [
        createTheme('T1', 'Tema 1'),
        createTheme('T2', 'Tema 2'),
        createTheme('T3', 'Tema 3'),
      ];

      const { theme, energy } = calculator.findBestThemeForGroup(group, themes);
      expect(theme.id).toBe('T1');
      expect(Number.isFinite(energy)).toBe(true);
    });
  });

  describe('Pesos', () => {
    it('deve aceitar pesos customizados', () => {
      const custom = new EnergyCalculator({
        wPref: 2.0,
        wDup: 1.5,
        wDiv: 0.5,
      });

      const weights = custom.getWeights();
      expect(weights.wPref).toBe(2.0);
      expect(weights.wDup).toBe(1.5);
      expect(weights.wDiv).toBe(0.5);
    });

    it('deve rejeitar pesos negativos', () => {
      expect(() => {
        new EnergyCalculator({
          wPref: -1.0,
          wDup: 0.9,
          wDiv: 0.35,
        });
      }).toThrow();
    });
  });
});
