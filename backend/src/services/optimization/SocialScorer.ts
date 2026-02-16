import { Group, Student } from '../../domain';

/**
 * SocialScorer - Calcula energia social baseada em afinidades
 * 
 * Energia Social (E_soc) = -w_soc * sum(A_ij) para todos i,j no grupo
 * Quanto maior a afinidade total, MENOR a energia (melhor).
 */
export class SocialScorer {
    private weightSocial: number = 1.0;

    constructor(weightSocial: number = 1.0) {
        this.weightSocial = weightSocial;
    }

    /**
     * Define o peso da energia social
     */
    setWeight(weight: number): void {
        this.weightSocial = weight;
    }

    /**
     * Calcula energia social de um grupo
     * E_soc = -w_soc * sum(A_ij)
     */
    calculateGroupSocialEnergy(group: Group): number {
        if (group.getStudentCount() < 2) return 0;

        let sumAffinity = 0;
        const students = group.students;

        for (let i = 0; i < students.length; i++) {
            for (let j = i + 1; j < students.length; j++) {
                const s1 = students[i];
                const s2 = students[j];

                // Afinidade é simétrica na prática para o grupo, mas os dados podem não ser.
                // Vamos somar A_ij + A_ji se existirem.
                // Se A_ij não existe, getAffinity retorna 0.
                const aff1 = s1.getAffinity(s2.id);
                const aff2 = s2.getAffinity(s1.id);

                // Média ou soma? O documento diz "pares obervados".
                // Se ambos declaram, soma os dois?
                // S(i,g) = sum_{j in g} A_ij.
                // E_soc = -w * sum_{i,j} A_ij.
                // Então somamos todas as arestas direcionadas.
                sumAffinity += aff1 + aff2;
            }
        }

        return -this.weightSocial * sumAffinity;
    }

    /**
     * Calcula o isolamento de um aluno em relação a um grupo de candidatos
     * S(i, g) = soma das afinidades de i com membros de g
     */
    calculateIsolation(student: Student, groupMembers: Student[]): number {
        let isolation = 0;
        for (const member of groupMembers) {
            if (member.id !== student.id) {
                isolation += student.getAffinity(member.id);
            }
        }
        return isolation;
    }

    /**
     * Calcula delta de energia social ao mover um aluno (simplificado)
     * Útil para busca local rápida
     */
    calculateSocialDelta(
        student: Student,
        fromGroup: Group,
        toGroup: Group
    ): number {
        // Perda de afinidade no grupo de origem
        const lostAffinity = this.calculateIsolation(student, fromGroup.students);

        // Ganho de afinidade no grupo de destino
        const gainedAffinity = this.calculateIsolation(student, toGroup.students);

        // Delta E = E_new - E_old
        // Como E = -w * Score, então Delta E = -w * (Score_new - Score_old)
        // Delta Score = gained - lost
        // Delta E = -w * (gained - lost)

        return -this.weightSocial * (gainedAffinity - lostAffinity);
    }
}
