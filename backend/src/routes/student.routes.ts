import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { validateStudentRegistration, validateStudentPreferences } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Student Routes - Rotas de Aluno
 *
 * POST /api/students/:distributionId - Registra novo aluno
 * PUT /api/students/:studentId/preferences - Adiciona preferências
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

  return router;
}
