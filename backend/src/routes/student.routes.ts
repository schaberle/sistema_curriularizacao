import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { validateStudentRegistration, validateStudentPreferences } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';

function clampNormalized(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function toNormalizedAffinity(value: number): number {
  if (value >= -1 && value <= 1) {
    return clampNormalized(value);
  }
  return clampNormalized(value / 100);
}

/**
 * Student Routes - Rotas de Aluno
 *
 * POST /api/students/:distributionId - Registra novo aluno
 * PUT /api/students/:studentId/preferences - Adiciona preferências de tema
 * GET /api/students/:studentId - Busca informações do aluno
 * GET /api/students/:studentId/current-group - Mostra grupo atual (após Fase 1)
 * GET /api/students/:studentId/affinities - Recupera afinidades declaradas
 * PUT /api/students/:studentId/affinities - Submete/atualiza afinidades (Fase 2)
 */
export function createStudentRoutes(database: DatabaseService): Router {
  const router = Router();

  function getAccessMessage(
    access: { registrationOpen: boolean; resultsAvailable: boolean; affinitiesOpen: boolean; phase2Executed: boolean },
    context: 'registration' | 'results' | 'affinities'
  ): string {
    if (context === 'registration' && !access.registrationOpen) {
      return 'Cadastro de alunos fechado para esta distribuicao';
    }

    if (context === 'results' && !access.resultsAvailable) {
      return 'Resultados ainda nao foram liberados para esta distribuicao';
    }

    if (context === 'affinities') {
      if (access.phase2Executed) {
        return 'Coleta de afinidades encerrada apos execucao da Fase 2';
      }
      if (!access.affinitiesOpen) {
        return 'Coleta de afinidades ainda nao esta aberta para esta distribuicao';
      }
    }

    return 'Acao indisponivel no estado atual da distribuicao';
  }

  /**
   * GET /api/students/distribution/:distributionId/access
   * Estado de acesso publico do fluxo do aluno.
   */
  router.get(
    '/distribution/:distributionId/access',
    asyncHandler(async (req: Request, res: Response) => {
      const distributionId = req.params.distributionId as string;

      try {
        const distribution = await database.getDistribution(distributionId);
        if (!distribution) {
          return res.status(404).json({
            error: 'Distribuicao nao encontrada',
          });
        }

        const access = await database.getStudentAccessState(distributionId);

        res.status(200).json({
          success: true,
          data: access,
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao verificar acesso da distribuicao',
          message: error.message,
        });
      }
    })
  );

  /**
   * POST /api/students/:distributionId
   * Registra novo aluno na distribuição
   *
   * Params:
   * - distributionId: ID da distribuição
   *
   * Body:
   * {
   *   "name": "João Silva",
   *   "course": "EE",
   *   "phase": 3
   * }
   *
   * Response 201:
   * {
   *   "success": true,
   *   "data": {
   *     "studentId": "stu_123",
   *     "name": "João Silva",
   *     "course": "EE",
   *     "phase": 3
   *   }
   * }
   *
   * Response 400: Validação falhou
   * Response 500: Erro interno
   */
  router.post(
    '/:distributionId',
    validateStudentRegistration,
    asyncHandler(async (req: Request, res: Response) => {
      const distributionId = req.params.distributionId as string;
      const { name, course, phase } = req.body;

      try {
        // Verificar se distribuição existe
        const distribution = await database.getDistribution(distributionId);
        if (!distribution) {
          return res.status(404).json({
            error: 'Distribuição não encontrada',
          });
        }

        const access = await database.getStudentAccessState(distributionId);
        if (!access.registrationOpen) {
          return res.status(403).json({
            error: getAccessMessage(access, 'registration'),
            data: access,
          });
        }

        // Criar aluno
        const studentId = await database.createStudent(
          name,
          course,
          phase,
          distributionId
        );

        res.status(201).json({
          success: true,
          data: {
            studentId,
            name,
            course,
            phase,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao registrar aluno',
          message: error.message,
        });
      }
    })
  );

  /**
   * PUT /api/students/:studentId/preferences
   * Adiciona ou atualiza preferências de temas do aluno
   *
   * Params:
   * - studentId: ID do aluno
   *
   * Body:
   * {
   *   "preferences": [
   *     { "themeId": "tema_a", "rank": 1 },
   *     { "themeId": "tema_b", "rank": 2 },
   *     { "themeId": "tema_c", "rank": 3 }
   *   ]
   * }
   *
   * Response 200:
   * {
   *   "success": true,
   *   "message": "Preferências atualizadas",
   *   "data": {
   *     "studentId": "stu_123",
   *     "preferencesCount": 3
   *   }
   * }
   *
   * Response 404: Aluno não encontrado
   * Response 400: Validação falhou
   * Response 500: Erro interno
   */
  router.put(
    '/:studentId/preferences',
    validateStudentPreferences,
    asyncHandler(async (req: Request, res: Response) => {
      const studentId = req.params.studentId as string;
      const { preferences } = req.body;

      try {
        // Verificar se aluno existe
        const student = await database.getStudent(studentId);
        if (!student) {
          return res.status(404).json({
            error: 'Aluno não encontrado',
          });
        }

        const access = await database.getStudentAccessState(student.distribution_id);
        if (!access.registrationOpen) {
          return res.status(403).json({
            error: getAccessMessage(access, 'registration'),
            data: access,
          });
        }

        // Limpar preferências antigas
        await database.clearStudentPreferences(studentId);

        // Adicionar novas preferências
        for (const pref of preferences) {
          await database.addStudentPreference(studentId, pref.themeId, pref.rank);
        }

        res.status(200).json({
          success: true,
          message: 'Preferências atualizadas',
          data: {
            studentId,
            preferencesCount: preferences.length,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao atualizar preferências',
          message: error.message,
        });
      }
    })
  );

  /**
   * GET /api/students/:studentId
   * Busca informações do aluno (para confirmação)
   *
   * Response 200:
   * {
   *   "success": true,
   *   "data": {
   *     "id": "stu_123",
   *     "name": "João Silva",
   *     "course": "EE",
   *     "phase": 3,
   *     "preferences": [
   *       { "themeId": "tema_a", "rank": 1 },
   *       ...
   *     ]
   *   }
   * }
   *
   * Response 404: Aluno não encontrado
   */
  router.get(
    '/:studentId',
    asyncHandler(async (req: Request, res: Response) => {
      const studentId = req.params.studentId as string;

      try {
        const student = await database.getStudent(studentId);
        if (!student) {
          return res.status(404).json({
            error: 'Aluno não encontrado',
          });
        }

        const preferences = await database.getStudentPreferences(studentId);

        res.status(200).json({
          success: true,
          data: {
            id: student.id,
            name: student.name,
            course: student.course,
            phase: student.phase,
            preferences,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao buscar aluno',
          message: error.message,
        });
      }
    })
  );

  /**
   * GET /api/students/:studentId/current-group
   * Retorna o grupo atual do aluno (após Fase 1 executada)
   *
   * Response 200:
   * {
   *   "success": true,
   *   "data": {
   *     "groupId": "grp_123",
   *     "themeId": "tema_a",
   *     "themeName": "Tema A",
   *     "members": [
   *       { "id": "stu_1", "name": "João", "course": "EE", "phase": 3 },
   *       { "id": "stu_2", "name": "Maria", "course": "ME", "phase": 5 },
   *       ...
   *     ]
   *   }
   * }
   *
   * Response 404: Aluno não encontrado ou não está em grupo ainda
   * Response 500: Erro interno
   */
  router.get(
    '/:studentId/current-group',
    asyncHandler(async (req: Request, res: Response) => {
      const studentId = req.params.studentId as string;

      try {
        // Buscar aluno
        const student = await database.getStudent(studentId);
        if (!student) {
          return res.status(404).json({
            error: 'Aluno não encontrado',
          });
        }

        const access = await database.getStudentAccessState(student.distribution_id);
        if (!access.resultsAvailable) {
          return res.status(403).json({
            error: getAccessMessage(access, 'results'),
            data: access,
          });
        }

        // Buscar grupo do aluno
        const groupData = await database.getStudentGroup(studentId, student.distribution_id);
        if (!groupData) {
          return res.status(404).json({
            error: 'Aluno ainda não está em um grupo',
            message: 'Fase 1 ainda não foi executada',
          });
        }

        // Buscar membros do grupo
        const memberIds = await database.getGroupStudents(groupData.id);
        const groupMembers = [];
        for (const memberId of memberIds) {
          const memberData = await database.getStudent(memberId);
          if (memberData) {
            groupMembers.push(memberData);
          }
        }

        // Buscar tema
        const themeData = await database.getTheme(groupData.theme_id);

        res.status(200).json({
          success: true,
          data: {
            groupId: groupData.id,
            themeId: groupData.theme_id,
            themeName: themeData?.name || 'N/A',
            members: groupMembers.map((member: any) => ({
              id: member.id,
              name: member.name,
              course: member.course,
              phase: member.phase,
            })),
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao buscar grupo atual',
          message: error.message,
        });
      }
    })
  );

  /**
   * GET /api/students/:studentId/affinities
   * Recupera afinidades já declaradas pelo aluno
   *
   * Response 200:
   * {
   *   "success": true,
   *   "data": {
   *     "studentId": "stu_123",
   *     "affinities": [
   *       {
   *         "targetStudentId": "stu_456",
   *         "targetStudentName": "João Silva",
   *         "affinityValue": 75,
   *         "normalizedValue": 0.75
   *       },
   *       ...
   *     ]
   *   }
   * }
   *
   * Response 404: Aluno não encontrado
   * Response 500: Erro interno
   */
  router.get(
    '/:studentId/affinities',
    asyncHandler(async (req: Request, res: Response) => {
      const studentId = req.params.studentId as string;

      try {
        // Verificar se aluno existe
        const student = await database.getStudent(studentId);
        if (!student) {
          return res.status(404).json({
            error: 'Aluno não encontrado',
          });
        }

        const access = await database.getStudentAccessState(student.distribution_id);
        if (!access.affinitiesOpen) {
          return res.status(403).json({
            error: getAccessMessage(access, 'affinities'),
            data: access,
          });
        }

        // Buscar afinidades declaradas
        const affinitiesData = await database.getStudentAffinities(studentId);

        const affinities = affinitiesData.map((aff: any) => ({
          targetStudentId: aff.target_student_id || aff.targetStudentId,
          affinityValue: Math.round(
            toNormalizedAffinity(aff.level !== undefined ? aff.level : (aff.affinity_value_raw || 0)) * 100
          ),
          normalizedValue: toNormalizedAffinity(aff.level !== undefined ? aff.level : (aff.affinity_value_raw || 0)),
        }));

        res.status(200).json({
          success: true,
          data: {
            studentId,
            affinities,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao buscar afinidades',
          message: error.message,
        });
      }
    })
  );

  /**
   * PUT /api/students/:studentId/affinities
   * Submete ou atualiza afinidades sociais do aluno (Fase 2)
   *
   * Body:
   * {
   *   "affinities": [
   *     { "targetStudentId": "stu_456", "value": 75 },
   *     { "targetStudentId": "stu_789", "value": -50 },
   *     ...
   *   ]
   * }
   *
   * Notes:
   * - value: inteiro de -100 (conflito) a +100 (ótima afinidade)
   * - Pode incluir alunos do mesmo grupo e de outros grupos
   * - Atualiza a distribuição com as afinidades
   *
   * Response 200:
   * {
   *   "success": true,
   *   "message": "Afinidades atualizadas",
   *   "data": {
   *     "studentId": "stu_123",
   *     "affinitiesCount": 5,
   *     "distributionId": "dist_123"
   *   }
   * }
   *
   * Response 400: Validação falhou ou Fase 1 não executada
   * Response 404: Aluno não encontrado
   * Response 500: Erro interno
   */
  router.put(
    '/:studentId/affinities',
    asyncHandler(async (req: Request, res: Response) => {
      const studentId = req.params.studentId as string;
      const { affinities } = req.body;

      try {
        // Verificar se aluno existe
        const student = await database.getStudent(studentId);
        if (!student) {
          return res.status(404).json({
            error: 'Aluno não encontrado',
          });
        }

        // Distribuição já foi obtida a partir do aluno
        const distribution = student.distribution_id;
        if (!distribution) {
          return res.status(404).json({
            error: 'Distribuição não encontrada para este aluno',
          });
        }

        const access = await database.getStudentAccessState(distribution);
        if (!access.affinitiesOpen) {
          return res.status(403).json({
            error: getAccessMessage(access, 'affinities'),
            data: access,
          });
        }

        // Validar affinities
        if (!Array.isArray(affinities)) {
          return res.status(400).json({
            error: 'Affinities deve ser um array',
          });
        }

        // Validar cada afinidade
        for (const aff of affinities) {
          if (!aff.targetStudentId || aff.value === undefined) {
            return res.status(400).json({
              error: 'Cada afinidade deve ter targetStudentId e value',
            });
          }

          if (typeof aff.value !== 'number' || aff.value < -100 || aff.value > 100) {
            return res.status(400).json({
              error: 'Valor de afinidade deve estar entre -100 e +100, ou -1 e +1',
              received: aff.value,
            });
          }

          if (aff.targetStudentId === studentId) {
            return res.status(400).json({
              error: 'Não pode declarar afinidade com você mesmo',
            });
          }

          // Verificar se aluno alvo existe
          const targetStudent = await database.getStudent(aff.targetStudentId);
          if (!targetStudent) {
            return res.status(400).json({
              error: `Aluno ${aff.targetStudentId} não encontrado`,
            });
          }
        }

        // Adicionar novas afinidades (usa upsert, então não precisa limpar)
        let affinitiesCount = 0;
        for (const aff of affinities) {
          // Nota: addStudentAffinity usa upsert, então atualiza se já existe
          await database.addStudentAffinity(
            studentId,
            aff.targetStudentId,
            toNormalizedAffinity(aff.value)
          );
          affinitiesCount++;
        }

        if (affinitiesCount > 0 && (access.status === 'COMPLETED' || access.status === 'PARTIAL')) {
          await database.updateDistributionStatus(distribution, 'PHASE2');
        }

        res.status(200).json({
          success: true,
          message: 'Afinidades atualizadas',
          data: {
            studentId,
            affinitiesCount,
            distributionId: distribution,
          },
        });
      } catch (error: any) {
        console.error('[affinities] Error:', error);
        res.status(500).json({
          error: 'Erro ao atualizar afinidades',
          message: error.message,
        });
      }
    })
  );

  /**
   * GET /api/students/:studentId/affinity-candidates?q=...
   * Busca alunos de outros grupos na mesma distribuicao para declarar afinidade.
   */
  router.get(
    '/:studentId/affinity-candidates',
    asyncHandler(async (req: Request, res: Response) => {
      const studentId = req.params.studentId as string;
      const query = String(req.query.q || '').trim();

      try {
        if (!query || query.length < 2) {
          return res.status(200).json({
            success: true,
            data: { candidates: [] },
          });
        }

        const student = await database.getStudent(studentId);
        if (!student) {
          return res.status(404).json({
            error: 'Aluno nao encontrado',
          });
        }

        const access = await database.getStudentAccessState(student.distribution_id);
        if (!access.affinitiesOpen) {
          return res.status(403).json({
            error: getAccessMessage(access, 'affinities'),
            data: access,
          });
        }

        const currentGroup = await database.getStudentGroup(studentId, student.distribution_id);
        const currentGroupMemberIds = currentGroup
          ? await database.getGroupStudents(currentGroup.id)
          : [];

        const excludeIds = Array.from(new Set([studentId, ...currentGroupMemberIds]));
        const candidates = await database.searchStudentsByDistribution(
          student.distribution_id,
          query,
          excludeIds,
          30
        );

        res.status(200).json({
          success: true,
          data: {
            candidates: candidates.map((candidate: any) => ({
              id: candidate.id,
              name: candidate.name,
              course: candidate.course,
              phase: candidate.phase,
            })),
          },
        });
      } catch (error: any) {
        console.error('[affinity-candidates] Error:', error);
        res.status(500).json({
          error: 'Erro ao buscar alunos para afinidade',
          message: error.message,
        });
      }
    })
  );

  return router;
}

