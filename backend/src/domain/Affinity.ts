/**
 * Affinity - Entidade representando afinidade social entre dois alunos
 *
 * Usa duas escalas:
 * - valueRaw: -100 a +100 (escala UI - mais intuitiva para usuários)
 * - value: -1.0 a +1.0 (escala normalizada - usada pelo algoritmo)
 *
 * Conversão: value = valueRaw / 100
 *
 * Semântica:
 * - value > 0: afinidade positiva (querem trabalhar juntos)
 * - value = 0: neutro (indiferente)
 * - value < 0: afinidade negativa/conflito (preferem não trabalhar juntos)
 */
export class Affinity {
  studentFromId: string;
  studentToId: string;
  value: number;           // -1.0 a +1.0 (escala normalizada do algoritmo)
  valueRaw: number;        // -100 a +100 (escala UI)
  createdAt: Date;
  updatedAt: Date;

  /**
   * Constructor
   * @param studentFromId ID do aluno que declara a afinidade
   * @param studentToId ID do aluno alvo
   * @param valueRaw Valor bruto (-100 a +100)
   */
  constructor(studentFromId: string, studentToId: string, valueRaw: number) {
    if (studentFromId === studentToId) {
      throw new Error('Um aluno não pode declarar afinidade consigo mesmo');
    }

    if (valueRaw < -100 || valueRaw > 100) {
      throw new Error('Valor de afinidade deve estar entre -100 e +100');
    }

    this.studentFromId = studentFromId;
    this.studentToId = studentToId;
    this.valueRaw = valueRaw;
    this.value = valueRaw / 100.0;  // Normalizar para [-1.0, +1.0]
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Retorna true se afinidade é positiva (value > 0)
   */
  isPositive(): boolean {
    return this.value > 0;
  }

  /**
   * Retorna true se afinidade é negativa (value < 0)
   */
  isNegative(): boolean {
    return this.value < 0;
  }

  /**
   * Retorna true se afinidade é neutra (value === 0)
   */
  isNeutral(): boolean {
    return this.value === 0;
  }

  /**
   * Retorna força da afinidade (valor absoluto)
   * 0 = neutro, 1 = máxima força
   */
  getStrength(): number {
    return Math.abs(this.value);
  }

  /**
   * Converte para JSON (para armazenamento/transmissão)
   */
  toJSON() {
    return {
      studentFromId: this.studentFromId,
      studentToId: this.studentToId,
      value: this.value,
      valueRaw: this.valueRaw,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
