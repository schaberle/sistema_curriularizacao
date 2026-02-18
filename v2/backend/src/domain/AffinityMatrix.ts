import { Affinity } from './Affinity';

/**
 * AffinityMatrix - Matriz esparsa de afinidades entre alunos
 *
 * Armazena afinidades bidirecionais (A_ij e A_ji) de forma eficiente.
 * Usa Map interno com chaves "id1|id2" ordenadas para garantir simetria.
 *
 * Operações principais:
 * - get(studentId1, studentId2): recupera afinidade
 * - set(studentId1, studentId2, value): define afinidade
 * - calculateIsolationScore(studentId, groupStudentIds): calcula S(i,g)
 * - calculateGroupCohesion(studentIds): calcula coesão do grupo
 *
 * Complexidade espacial: O(A) onde A = número de afinidades declaradas
 * (não O(N²) como uma matriz densa)
 */
export class AffinityMatrix {
  // Chave: "id1|id2" (ordenada para simetria)
  // Valor: afinidade normalizada [-1.0, +1.0]
  private affinities: Map<string, number> = new Map();

  /**
   * Retorna afinidade entre dois alunos
   * Nota: A_ij == A_ji (simetria garantida pela chave)
   */
  get(studentId1: string, studentId2: string): number {
    if (studentId1 === studentId2) return 0;

    const key = this.getKey(studentId1, studentId2);
    return this.affinities.get(key) ?? 0; // Default: 0 (neutro)
  }

  /**
   * Define afinidade entre dois alunos
   * Automaticamente mantém simetria (A_ij == A_ji)
   */
  set(studentId1: string, studentId2: string, value: number): void {
    if (studentId1 === studentId2) {
      throw new Error('Não pode definir afinidade de um aluno consigo mesmo');
    }

    if (value < -1 || value > 1) {
      throw new Error('Afinidade normalizada deve estar entre -1.0 e +1.0');
    }

    const key = this.getKey(studentId1, studentId2);

    if (value === 0) {
      // Remove se é neutro (economiza espaço)
      this.affinities.delete(key);
    } else {
      this.affinities.set(key, value);
    }
  }

  /**
   * Limpa todas as afinidades
   */
  clear(): void {
    this.affinities.clear();
  }

  /**
   * Retorna número de afinidades declaradas (não inclui zeros)
   */
  getSize(): number {
    return this.affinities.size;
  }

  /**
   * Calcula isolamento individual: S(i, g) = Σ A_ij (i em g, j em g)
   *
   * Isolamento é a soma de afinidades de um aluno com os outros membros do grupo.
   * - S(i) > 0: aluno tem afinidade positiva com o grupo
   * - S(i) < 0: aluno tem conflito com o grupo
   * - S(i) = 0: aluno é neutro em relação ao grupo
   *
   * Usado para biased sampling na Fase 2: alunos com baixo S(i) têm maior
   * probabilidade de serem selecionados para swap.
   *
   * @param studentId ID do aluno
   * @param groupStudentIds IDs dos alunos no grupo
   * @returns Score de isolamento (soma de afinidades)
   */
  calculateIsolationScore(studentId: string, groupStudentIds: string[]): number {
    let totalAffinity = 0;

    for (const otherId of groupStudentIds) {
      if (otherId !== studentId) {
        totalAffinity += this.get(studentId, otherId);
      }
    }

    return totalAffinity;
  }

  /**
   * Calcula coesão social de um grupo: Σ A_ij (todos os pares i,j em g)
   *
   * Métrica de qualidade social do grupo:
   * - Coesão > 0: grupo tem afinidades positivas
   * - Coesão < 0: grupo tem conflitos
   * - Coesão = 0: neutro
   *
   * Nota: Conta cada par uma única vez (não duplica i-j e j-i)
   *
   * @param studentIds IDs dos alunos no grupo
   * @returns Coesão total do grupo
   */
  calculateGroupCohesion(studentIds: string[]): number {
    let totalCohesion = 0;

    // Iterar sobre todos os pares únicos
    for (let i = 0; i < studentIds.length; i++) {
      for (let j = i + 1; j < studentIds.length; j++) {
        const affinity = this.get(studentIds[i], studentIds[j]);
        totalCohesion += affinity;
      }
    }

    return totalCohesion;
  }

  /**
   * Retorna lista de afinidades (para serialização/debug)
   */
  getAffinities(): Array<{ studentId1: string; studentId2: string; value: number }> {
    const result: Array<{ studentId1: string; studentId2: string; value: number }> = [];

    for (const [key, value] of this.affinities.entries()) {
      const [id1, id2] = key.split('|');
      result.push({ studentId1: id1, studentId2: id2, value });
    }

    return result;
  }

  /**
   * Converte para JSON (para armazenamento/transmissão)
   */
  toJSON() {
    return {
      affinities: this.getAffinities(),
      size: this.getSize()
    };
  }

  /**
   * Cria matriz a partir de dados JSON
   */
  static fromJSON(data: any): AffinityMatrix {
    const matrix = new AffinityMatrix();

    if (data.affinities && Array.isArray(data.affinities)) {
      for (const aff of data.affinities) {
        matrix.set(aff.studentId1, aff.studentId2, aff.value);
      }
    }

    return matrix;
  }

  /**
   * Cria chave simétrica para armazenamento
   * Garante que A_ij == A_ji ao ordenar IDs
   */
  private getKey(id1: string, id2: string): string {
    // Ordenar IDs para garantir simetria
    const [smaller, larger] = id1 < id2 ? [id1, id2] : [id2, id1];
    return `${smaller}|${larger}`;
  }
}
