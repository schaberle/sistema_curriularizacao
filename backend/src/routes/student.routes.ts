import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { validateStudentRegistration, validateStudentPreferences } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';

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

        // Buscar afinidades declaradas
        const affinitiesData = await database.getStudentAffinities(studentId);

        const affinities = affinitiesData.map((aff: any) => ({
          targetStudentId: aff.target_student_id || aff.targetStudentId,
          affinityValue: aff.level !== undefined ? aff.level : (aff.affinity_value_raw || 0),
          normalizedValue: (aff.level !== undefined ? aff.level : (aff.affinity_value_raw || 0)) / 100,
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

          if (aff.value < -100 || aff.value > 100) {
            return res.status(400).json({
              error: 'Valor de afinidade deve estar entre -100 e +100',
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
            aff.value  // -100 a +100
          );
          affinitiesCount++;
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

  return router;
}
