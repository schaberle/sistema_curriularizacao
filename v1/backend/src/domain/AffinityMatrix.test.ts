import { AffinityMatrix } from './AffinityMatrix';

describe('AffinityMatrix', () => {
  let matrix: AffinityMatrix;

  const s1 = 'student-1';
  const s2 = 'student-2';
  const s3 = 'student-3';
  const s4 = 'student-4';

  beforeEach(() => {
    matrix = new AffinityMatrix();
  });

  describe('Operações básicas', () => {
    it('deve retornar 0 para afinidade não declarada', () => {
      expect(matrix.get(s1, s2)).toBe(0);
    });

    it('deve armazenar e recuperar afinidades', () => {
      matrix.set(s1, s2, 0.75);
      expect(matrix.get(s1, s2)).toBeCloseTo(0.75, 2);
    });

    it('deve manter simetria: A_ij == A_ji', () => {
      matrix.set(s1, s2, 0.5);
      expect(matrix.get(s1, s2)).toBeCloseTo(0.5, 2);
      expect(matrix.get(s2, s1)).toBeCloseTo(0.5, 2);
    });

    it('deve rejeitar afinidade do aluno consigo mesmo', () => {
      expect(() => {
        matrix.set(s1, s1, 0.5);
      }).toThrow();
    });

    it('deve rejeitar valores fora do range [-1.0, +1.0]', () => {
      expect(() => {
        matrix.set(s1, s2, 1.5);
      }).toThrow();

      expect(() => {
        matrix.set(s1, s2, -1.5);
      }).toThrow();
    });

    it('deve remover afinidade quando definida como 0', () => {
      matrix.set(s1, s2, 0.5);
      expect(matrix.getSize()).toBe(1);

      matrix.set(s1, s2, 0);
      expect(matrix.getSize()).toBe(0);
      expect(matrix.get(s1, s2)).toBe(0);
    });
  });

  describe('calculateIsolationScore()', () => {
    it('deve calcular isolamento como soma de afinidades no grupo', () => {
      // s1 com s2 (+0.5), s1 com s3 (+0.3) → total = +0.8
      matrix.set(s1, s2, 0.5);
      matrix.set(s1, s3, 0.3);

      const isolation = matrix.calculateIsolationScore(s1, [s1, s2, s3, s4]);
      expect(isolation).toBeCloseTo(0.8, 2);
    });

    it('deve ignorar auto-afinidade (aluno consigo mesmo)', () => {
      matrix.set(s1, s2, 0.5);
      matrix.set(s1, s3, 0.3);

      // grupo = [s1, s2, s3] - s1 deve contar apenas afinidades com s2 e s3
      const isolation = matrix.calculateIsolationScore(s1, [s1, s2, s3]);
      expect(isolation).toBeCloseTo(0.8, 2);
    });

    it('deve retornar 0 para aluno sem afinidades declaradas', () => {
      matrix.set(s2, s3, 0.5);

      const isolation = matrix.calculateIsolationScore(s1, [s1, s2, s3, s4]);
      expect(isolation).toBe(0);
    });

    it('deve calcular isolamento negativo para conflitos', () => {
      matrix.set(s1, s2, -0.6);
      matrix.set(s1, s3, -0.2);

      const isolation = matrix.calculateIsolationScore(s1, [s1, s2, s3]);
      expect(isolation).toBeCloseTo(-0.8, 2);
    });
  });

  describe('calculateGroupCohesion()', () => {
    it('deve calcular coesão como soma de pares no grupo', () => {
      // Afinidades:
      // s1-s2: +0.5
      // s1-s3: +0.3
      // s2-s3: +0.2
      // total: +1.0
      matrix.set(s1, s2, 0.5);
      matrix.set(s1, s3, 0.3);
      matrix.set(s2, s3, 0.2);

      const cohesion = matrix.calculateGroupCohesion([s1, s2, s3]);
      expect(cohesion).toBeCloseTo(1.0, 2);
    });

    it('deve contar cada par uma única vez (não duplicar)', () => {
      matrix.set(s1, s2, 0.5);

      const cohesion = matrix.calculateGroupCohesion([s1, s2]);
      // Apenas um par: s1-s2
      expect(cohesion).toBeCloseTo(0.5, 2);
    });

    it('deve retornar 0 para grupo sem afinidades', () => {
      const cohesion = matrix.calculateGroupCohesion([s1, s2, s3]);
      expect(cohesion).toBe(0);
    });

    it('deve lidar com grupos de diferentes tamanhos', () => {
      // 2 alunos: 1 par
      matrix.set(s1, s2, 0.5);
      expect(matrix.calculateGroupCohesion([s1, s2])).toBeCloseTo(0.5, 2);

      // 3 alunos: 3 pares
      matrix.set(s1, s3, 0.3);
      matrix.set(s2, s3, 0.2);
      expect(matrix.calculateGroupCohesion([s1, s2, s3])).toBeCloseTo(1.0, 2);

      // 4 alunos: 6 pares
      matrix.set(s1, s4, 0.1);
      matrix.set(s2, s4, 0.1);
      matrix.set(s3, s4, 0.1);
      expect(matrix.calculateGroupCohesion([s1, s2, s3, s4])).toBeCloseTo(1.3, 2);
    });

    it('deve calcular coesão negativa para conflitos', () => {
      matrix.set(s1, s2, -0.5);
      matrix.set(s1, s3, -0.3);

      const cohesion = matrix.calculateGroupCohesion([s1, s2, s3]);
      expect(cohesion).toBeCloseTo(-0.8, 2);
    });
  });

  describe('getSize() e clear()', () => {
    it('deve retornar número de afinidades declaradas', () => {
      expect(matrix.getSize()).toBe(0);

      matrix.set(s1, s2, 0.5);
      expect(matrix.getSize()).toBe(1);

      matrix.set(s1, s3, 0.3);
      expect(matrix.getSize()).toBe(2);

      // Definir como 0 remove
      matrix.set(s1, s2, 0);
      expect(matrix.getSize()).toBe(1);
    });

    it('deve limpar todas as afinidades com clear()', () => {
      matrix.set(s1, s2, 0.5);
      matrix.set(s1, s3, 0.3);
      matrix.set(s2, s3, 0.2);

      expect(matrix.getSize()).toBe(3);

      matrix.clear();

      expect(matrix.getSize()).toBe(0);
      expect(matrix.get(s1, s2)).toBe(0);
      expect(matrix.get(s1, s3)).toBe(0);
      expect(matrix.get(s2, s3)).toBe(0);
    });
  });

  describe('getAffinities() e serialização', () => {
    it('deve retornar lista de afinidades', () => {
      matrix.set(s1, s2, 0.5);
      matrix.set(s1, s3, -0.3);

      const affinities = matrix.getAffinities();

      expect(affinities.length).toBe(2);
      expect(affinities).toContainEqual({
        studentId1: s1,
        studentId2: s2,
        value: 0.5
      });
      expect(affinities).toContainEqual({
        studentId1: s1,
        studentId2: s3,
        value: -0.3
      });
    });

    it('deve serializar e desserializar corretamente', () => {
      matrix.set(s1, s2, 0.5);
      matrix.set(s1, s3, -0.3);
      matrix.set(s2, s3, 0.2);

      const json = matrix.toJSON();
      const restored = AffinityMatrix.fromJSON(json);

      expect(restored.get(s1, s2)).toBeCloseTo(0.5, 2);
      expect(restored.get(s1, s3)).toBeCloseTo(-0.3, 2);
      expect(restored.get(s2, s3)).toBeCloseTo(0.2, 2);
      expect(restored.getSize()).toBe(3);
    });
  });
});
