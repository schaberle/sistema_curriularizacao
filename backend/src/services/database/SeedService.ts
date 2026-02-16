import { DatabaseService } from './DatabaseService';

/**
 * SeedService - Gera dados de teste para simulação
 *
 * Segue padrões de ref_distribuição/simulacao_fase_1.py
 * - Distribuição realista de alunos por curso e fase
 * - Preferências correlacionadas com fase
 * - Afinidades esparsas (13% manifestação)
 */
export class SeedService {
  private readonly PHASES = [1, 3, 5, 7, 9];
  private readonly PHASE_WEIGHTS = [0.53, 0.26, 0.13, 0.06, 0.02]; // Baseado no padrão Python

  constructor(private database: DatabaseService) { }

  /**
   * Gera nomes brasileiros realistas
   */
  private generateBrazilianName(): string {
    const firstNames = [
      'João', 'Maria', 'José', 'Ana', 'Pedro', 'Paula', 'Carlos', 'Juliana',
      'Fernando', 'Beatriz', 'Rafael', 'Larissa', 'Lucas', 'Camila', 'Mateus',
      'Fernanda', 'Gabriel', 'Amanda', 'Felipe', 'Letícia', 'Rodrigo', 'Mariana',
      'Bruno', 'Thaís', 'Gustavo', 'Aline', 'Leonardo', 'Bianca', 'Diego', 'Renata',
      'Marcos', 'Patrícia', 'André', 'Priscila', 'Ricardo', 'Natália', 'Vinicius',
      'Carolina', 'Thiago', 'Gabriela', 'Henrique', 'Débora', 'Daniel', 'Vanessa',
      'Leandro', 'Tatiana', 'Marcelo', 'Simone', 'Alexandre', 'Adriana',
    ];

    const lastNames = [
      'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
      'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
      'Rocha', 'Almeida', 'Nascimento', 'Araújo', 'Melo', 'Barbosa', 'Cardoso',
      'Cavalcanti', 'Correia', 'Dias', 'Fernandes', 'Freitas', 'Garcia', 'Gonçalves',
      'Lopes', 'Machado', 'Marques', 'Mendes', 'Miranda', 'Monteiro', 'Moreira',
      'Nunes', 'Pinto', 'Ramos', 'Reis', 'Rezende', 'Teixeira', 'Vieira',
    ];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const middleName = lastNames[Math.floor(Math.random() * lastNames.length)];

    return `${firstName} ${middleName} ${lastName}`;
  }

  /**
   * Gera distribuição de alunos por curso e fase
   * Padrão: ME (40+20+10+5+2), EE (30+15+7+3+1) = 133 total
   */
  private generateStudentDistribution(totalStudents?: number): Array<{ course: string; phase: number }> {
    const defaultDistribution = {
      ME: { 1: 40, 3: 20, 5: 10, 7: 5, 9: 2 },
      EE: { 1: 30, 3: 15, 5: 7, 7: 3, 9: 1 }
    };

    const students: Array<{ course: string; phase: number }> = [];

    if (!totalStudents || totalStudents === 133) {
      // Usar distribuição padrão exata
      for (const [course, phases] of Object.entries(defaultDistribution)) {
        for (const [phase, count] of Object.entries(phases)) {
          for (let i = 0; i < count; i++) {
            students.push({ course, phase: parseInt(phase) });
          }
        }
      }
    } else {
      // Distribuir proporcionalmente mantendo proporção ME:EE (~58%:~42%)
      const meRatio = 77 / 133; // ~58%
      const eeCount = Math.floor(totalStudents * (1 - meRatio));
      const meCount = totalStudents - eeCount;

      // Gerar alunos ME
      for (let i = 0; i < meCount; i++) {
        const rand = Math.random();
        let cumulative = 0;
        let selectedPhase = 1;

        for (let j = 0; j < this.PHASES.length; j++) {
          cumulative += this.PHASE_WEIGHTS[j];
          if (rand <= cumulative) {
            selectedPhase = this.PHASES[j];
            break;
          }
        }
        students.push({ course: 'ME', phase: selectedPhase });
      }

      // Gerar alunos EE
      for (let i = 0; i < eeCount; i++) {
        const rand = Math.random();
        let cumulative = 0;
        let selectedPhase = 1;

        for (let j = 0; j < this.PHASES.length; j++) {
          cumulative += this.PHASE_WEIGHTS[j];
          if (rand <= cumulative) {
            selectedPhase = this.PHASES[j];
            break;
          }
        }
        students.push({ course: 'EE', phase: selectedPhase });
      }
    }

    // Shuffle para aleatoriedade
    return students.sort(() => Math.random() - 0.5);
  }

  /**
   * Gera preferências realistas baseadas em fase
   * Alunos de fases iniciais preferem temas iniciais
   */
  private generatePreferences(
    phase: number,
    themeIds: string[]
  ): Array<{ themeId: string; rank: number }> {
    const numThemes = themeIds.length;

    // Calcular posição relativa da fase (0 a 1)
    const phaseIndex = this.PHASES.indexOf(phase);
    const phasePosition = phaseIndex >= 0 ? phaseIndex / (this.PHASES.length - 1) : 0.5;

    // Tema preferido baseado na posição da fase
    const preferredThemeIndex = Math.round(phasePosition * (numThemes - 1));

    // Ranking com viés para tema preferido
    const ranked = themeIds.map((id, index) => ({
      id,
      distance: Math.abs(index - preferredThemeIndex) + Math.random() * 0.5,
    }));

    ranked.sort((a, b) => a.distance - b.distance);

    return ranked.map((item, index) => ({
      themeId: item.id,
      rank: index + 1,
    }));
  }

  /**
   * Gera afinidades esparsas (13% manifestação padrão)
   * Segue padrão de simulacao_fase_2.py
   */
  private generateAffinities(
    studentIds: string[],
    density: number = 0.13
  ): Array<{ studentId: string; targetStudentId: string; level: number }> {
    const affinities: Array<{ studentId: string; targetStudentId: string; level: number }> = [];

    for (let i = 0; i < studentIds.length; i++) {
      for (let j = i + 1; j < studentIds.length; j++) {
        if (Math.random() < density) {
          // Gerar valor de afinidade com distribuição gaussiana aproximada
          // Gerar valor de afinidade restrito ao intervalo [-1, 1] devido a constraint do banco
          // student_affinities_check_level
          const value = Math.random() > 0.5 ? 1 : -1;

          // Afinidade bidirecional (simétrica)
          affinities.push({
            studentId: studentIds[i],
            targetStudentId: studentIds[j],
            level: value,
          });
          affinities.push({
            studentId: studentIds[j],
            targetStudentId: studentIds[i],
            level: value,
          });
        }
      }
    }

    return affinities;
  }

  /**
   * Popula distribuição com dados de teste
   */
  async seedDistribution(
    distributionId: string,
    options: {
      studentCount?: number;
      generatePreferences?: boolean;
      generateAffinities?: boolean;
      affinityDensity?: number;
    } = {}
  ): Promise<{
    studentsCreated: number;
    preferencesCreated: number;
    affinitiesCreated: number;
  }> {
    const {
      studentCount,
      generatePreferences = true,
      generateAffinities = false,
      affinityDensity = 0.13,
    } = options;

    // 1. Verificar se distribuição existe
    const distribution = await this.database.getDistribution(distributionId);
    if (!distribution) {
      throw new Error('Distribuição não encontrada');
    }

    // 2. Buscar temas para gerar preferências
    const themes = await this.database.getThemesByDistribution(distributionId);
    if (themes.length === 0) {
      throw new Error('Nenhum tema encontrado. Adicione temas antes de gerar dados de teste.');
    }
    const themeIds = themes.map((t: any) => t.id);

    // 3. Gerar distribuição de alunos
    const studentDistribution = this.generateStudentDistribution(studentCount);

    // 4. Criar alunos
    const studentIds: string[] = [];
    for (const { course, phase } of studentDistribution) {
      const name = this.generateBrazilianName();
      const studentId = await this.database.createStudent(name, course, phase, distributionId);
      studentIds.push(studentId);
    }

    const studentsCreated = studentIds.length;

    // 5. Gerar preferências
    let preferencesCreated = 0;
    if (generatePreferences) {
      for (let i = 0; i < studentIds.length; i++) {
        const studentId = studentIds[i];
        const phase = studentDistribution[i].phase;
        const preferences = this.generatePreferences(phase, themeIds);

        for (const pref of preferences) {
          await this.database.addStudentPreference(studentId, pref.themeId, pref.rank);
          preferencesCreated++;
        }
      }
    }

    // 6. Gerar afinidades
    let affinitiesCreated = 0;
    if (generateAffinities) {
      const affinities = this.generateAffinities(studentIds, affinityDensity);
      for (const aff of affinities) {
        await this.database.addStudentAffinity(aff.studentId, aff.targetStudentId, aff.level);
        affinitiesCreated++;
      }
    }

    return {
      studentsCreated,
      preferencesCreated,
      affinitiesCreated,
    };
  }

  /**
   * Gera afinidades simuladas para alunos já existentes em uma distribuição.
   * Útil para testar Fase 2 sem precisar recriar alunos.
   */
  async seedAffinities(
    distributionId: string,
    options: {
      affinityDensity?: number;
    } = {}
  ): Promise<{
    affinitiesCreated: number;
    studentsProcessed: number;
  }> {
    const { affinityDensity = 0.13 } = options;

    // 1. Verificar se distribuição existe
    const distribution = await this.database.getDistribution(distributionId);
    if (!distribution) {
      throw new Error('Distribuição não encontrada');
    }

    // 2. Buscar IDs dos alunos já cadastrados
    const studentIds = await this.database.getStudentIdsByDistribution(distributionId);
    if (studentIds.length === 0) {
      throw new Error('Nenhum aluno encontrado nesta distribuição. Crie alunos antes de gerar afinidades.');
    }

    // 3. Gerar e salvar afinidades
    const affinities = this.generateAffinities(studentIds, affinityDensity);
    let affinitiesCreated = 0;
    for (const aff of affinities) {
      await this.database.addStudentAffinity(aff.studentId, aff.targetStudentId, aff.level);
      affinitiesCreated++;
    }

    return {
      affinitiesCreated,
      studentsProcessed: studentIds.length,
    };
  }
}
