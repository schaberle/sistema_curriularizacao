import { Affinity } from './Affinity';

describe('Affinity', () => {
  const studentId1 = 'student-1';
  const studentId2 = 'student-2';

  describe('Constructor', () => {
    it('deve criar afinidade com valores válidos', () => {
      const affinity = new Affinity(studentId1, studentId2, 50);

      expect(affinity.studentFromId).toBe(studentId1);
      expect(affinity.studentToId).toBe(studentId2);
      expect(affinity.valueRaw).toBe(50);
      expect(affinity.value).toBeCloseTo(0.5, 2);
    });

    it('deve normalizar corretamente de -100 a -1.0', () => {
      const affinity = new Affinity(studentId1, studentId2, -100);
      expect(affinity.value).toBeCloseTo(-1.0, 2);
    });

    it('deve normalizar corretamente de +100 a +1.0', () => {
      const affinity = new Affinity(studentId1, studentId2, 100);
      expect(affinity.value).toBeCloseTo(1.0, 2);
    });

    it('deve criar com valor zero (neutro)', () => {
      const affinity = new Affinity(studentId1, studentId2, 0);
      expect(affinity.value).toBe(0);
      expect(affinity.isNeutral()).toBe(true);
    });

    it('deve rejeitar auto-afinidade (mesmo estudante)', () => {
      expect(() => {
        new Affinity(studentId1, studentId1, 50);
      }).toThrow();
    });

    it('deve rejeitar valores fora do range [-100, +100]', () => {
      expect(() => {
        new Affinity(studentId1, studentId2, -101);
      }).toThrow();

      expect(() => {
        new Affinity(studentId1, studentId2, 101);
      }).toThrow();
    });
  });

  describe('Métodos de consulta', () => {
    it('isPositive() deve retornar true para valores > 0', () => {
      const affinity = new Affinity(studentId1, studentId2, 75);
      expect(affinity.isPositive()).toBe(true);
      expect(affinity.isNegative()).toBe(false);
      expect(affinity.isNeutral()).toBe(false);
    });

    it('isNegative() deve retornar true para valores < 0', () => {
      const affinity = new Affinity(studentId1, studentId2, -50);
      expect(affinity.isNegative()).toBe(true);
      expect(affinity.isPositive()).toBe(false);
      expect(affinity.isNeutral()).toBe(false);
    });

    it('isNeutral() deve retornar true para valor 0', () => {
      const affinity = new Affinity(studentId1, studentId2, 0);
      expect(affinity.isNeutral()).toBe(true);
      expect(affinity.isPositive()).toBe(false);
      expect(affinity.isNegative()).toBe(false);
    });

    it('getStrength() deve retornar valor absoluto', () => {
      const affinityPos = new Affinity(studentId1, studentId2, 60);
      const affinityNeg = new Affinity(studentId1, 'student-3', -60);

      expect(affinityPos.getStrength()).toBeCloseTo(0.6, 2);
      expect(affinityNeg.getStrength()).toBeCloseTo(0.6, 2);
    });
  });

  describe('Serialização', () => {
    it('toJSON() deve retornar objeto com campos corretos', () => {
      const affinity = new Affinity(studentId1, studentId2, 75);
      const json = affinity.toJSON();

      expect(json.studentFromId).toBe(studentId1);
      expect(json.studentToId).toBe(studentId2);
      expect(json.valueRaw).toBe(75);
      expect(json.value).toBeCloseTo(0.75, 2);
      expect(json.createdAt).toBeDefined();
    });
  });
});
