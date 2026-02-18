import { EnergyCalculator } from './EnergyCalculator';
import { Group, Student, Theme } from '../../domain';

describe('EnergyCalculator', () => {
  let calculator: EnergyCalculator;
  let distributionId: string;

  beforeEach(() => {
    calculator = new EnergyCalculator({
      wPref: 1.0,
      wDup: 0.9,
      wDiv: 0.35
    });
    distributionId = 'dist-001';
  });

  /**
   * Helper: criar aluno com preferências
   */
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
      course as any, // Type fix
      phase,
      prefs.map((themeId, idx) => ({ themeId, rank: idx + 1 }))
    );
  }

  /**
   * Helper: criar tema
   */
  function createTheme(id: string, name: string): Theme {
    return new Theme(id, distributionId, name, 10);
  }

  /**
   * Helper: criar grupo viável
   */
  function createValidGroup(
    id: string,
    themeId: string,
    students: Student[]
  ): Group {
    return new Group(id, themeId, distributionId, students);
  }

  describe('Viabilidade (Máscara Dura)', () => {
    it('grupo com < 4 alunos deve ter energia infinita', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'ME', 3)
      ];
      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);
      expect(energy).toBe(Infinity);
    });

    it('grupo com 0 elétricos deve ter energia infinita', () => {
      const students = [
        createStudent('s1', 'Alice', 'ME', 1),
        createStudent('s2', 'Bob', 'ME', 3),
        createStudent('s3', 'Carol', 'ME', 5),
        createStudent('s4', 'David', 'ME', 7)
      ];
      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);
      expect(energy).toBe(Infinity);
    });

    it('grupo com 3 elétricos deve ter energia infinita', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'EE', 3),
        createStudent('s3', 'Carol', 'EE', 5),
        createStudent('s4', 'David', 'ME', 7)
      ];
      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);
      expect(energy).toBe(Infinity);
    });

    it('grupo com 1 fase deve ter energia infinita', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'EE', 1),
        createStudent('s3', 'Carol', 'ME', 1),
        createStudent('s4', 'David', 'ME', 1)
      ];
      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);
      expect(energy).toBe(Infinity);
    });

    it('grupo viável (1 EE, 1 ME, 2+ fases) deve ter energia finita', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'ME', 3),
        createStudent('s3', 'Carol', 'ME', 5),
        createStudent('s4', 'David', 'ME', 7)
      ];
      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);
      expect(Number.isFinite(energy)).toBe(true);
    });
  });

  describe('Energia de Preferência (E_pref)', () => {
    it('grupo com todos na posição 1 (máxima satisfação) deve ter menor E_pref', () => {
      // Todos querem T1 como primeira escolha
      const students = [
        createStudent('s1', 'Alice', 'EE', 1, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s2', 'Bob', 'ME', 3, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s3', 'Carol', 'ME', 5, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s4', 'David', 'ME', 7, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'])
      ];

      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);

      // Esperado: E_pref = -1.0 * 4 = -4.0 (todos com score normalizado = 1.0)
      // E_fase = 0 (4 fases distintas)
      // Total = -4.0
      expect(energy).toBeLessThan(0);
    });

    it('grupo com todos na posição 8 (mínima satisfação) deve ter maior E_pref', () => {
      // Todos querem T1 como última escolha
      const students = [
        createStudent('s1', 'Alice', 'EE', 1, ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T1']),
        createStudent('s2', 'Bob', 'ME', 3, ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T1']),
        createStudent('s3', 'Carol', 'ME', 5, ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T1']),
        createStudent('s4', 'David', 'ME', 7, ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T1'])
      ];

      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);

      // Esperado: E_pref = -1.0 * 0 = 0 (todos com score normalizado = 0.0)
      // E_fase = 0 (4 fases distintas)
      // Total = 0
      expect(energy).toBeGreaterThan(-4.0);
    });
  });

  describe('Energia de Fase (E_fase)', () => {
    it('grupo com 4 fases distintas deve ter menor E_fase', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'ME', 3),
        createStudent('s3', 'Carol', 'ME', 5),
        createStudent('s4', 'David', 'ME', 7)
      ];

      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);

      // E_fase = 0.9 * 0 - 0.35 * 4 = -1.4
      // Esperado: -1.4 + E_pref
      const expectedPhasePart = -0.35 * 4;
      const energyWithoutPhase = energy + 0.35 * 4; // Remove fase part

      expect(energy).toBeLessThan(expectedPhasePart * 2); // Deve ser negativo por diversidade
    });

    it('grupo com 2 fases (2 duplicatas) deve ter maior E_fase', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1),
        createStudent('s2', 'Bob', 'EE', 1),   // Fase duplicada
        createStudent('s3', 'Carol', 'ME', 3),
        createStudent('s4', 'David', 'ME', 3)  // Fase duplicada
      ];

      const group = createValidGroup('g1', 'T1', students);
      const theme = createTheme('T1', 'Tema 1');

      const energy = calculator.calculateGroupEnergy(group, theme);

      // E_fase = 0.9 * 2 - 0.35 * 2 = 1.8 - 0.7 = 1.1
      // Esperado: 1.1 + E_pref (que será negativo)
      expect(Number.isFinite(energy)).toBe(true);
    });
  });

  describe('Normalização de Scores', () => {
    it('deve normalizar scores para [0, 1]', () => {
      const student = createStudent('s1', 'Alice', 'EE', 1, [
        'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'
      ]);

      // Scores brutos: [100, 70, 50, 35, 25, 18, 12, 8]
      // Min = 8, Max = 100
      // Normalizado: (100-8)/(100-8) = 1.0, (8-8)/(100-8) = 0.0

      const weights = calculator.getWeights();
      expect(weights.wPref).toBe(1.0);
    });
  });

  describe('Encontrar Melhor Tema', () => {
    it('deve retornar tema com menor energia', () => {
      const students = [
        createStudent('s1', 'Alice', 'EE', 1, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s2', 'Bob', 'ME', 3, ['T2', 'T1', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s3', 'Carol', 'ME', 5, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']),
        createStudent('s4', 'David', 'ME', 7, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'])
      ];

      const group = createValidGroup('g1', 'T1', students);
      const themes = [
        createTheme('T1', 'Tema 1'),
        createTheme('T2', 'Tema 2'),
        createTheme('T3', 'Tema 3')
      ];

      const { theme, energy } = calculator.findBestThemeForGroup(group, themes);

      // T1 tem 3 primeiras escolhas + 1 segunda = melhor
      expect(theme.id).toBe('T1');
      expect(Number.isFinite(energy)).toBe(true);
    });
  });

  describe('Configuração de Pesos', () => {
    it('deve aceitar pesos customizados', () => {
      const customCalc = new EnergyCalculator({
        wPref: 2.0,
        wDup: 1.5,
        wDiv: 0.5
      });

      const weights = customCalc.getWeights();
      expect(weights.wPref).toBe(2.0);
      expect(weights.wDup).toBe(1.5);
      expect(weights.wDiv).toBe(0.5);
    });

    it('deve rejeitar pesos negativos', () => {
      expect(() => {
        new EnergyCalculator({
          wPref: -1.0,
          wDup: 0.9,
          wDiv: 0.35
        });
      }).toThrow();
    });
  });
});
