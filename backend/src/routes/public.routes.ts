import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { validateSearchQuery } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Public Routes - Rotas Públicas (sem autenticação)
 *
 * GET /api/search - Busca resultado de aluno por nome
 */
export function createPublicRoutes(database: DatabaseService): Router {
  const router = Router();

  router.use((req, _res, next) => {
    console.log(`[PublicRoutes] Request: ${req.method} ${req.url}`);
    next();
  });

  /**
   * GET /api/search
   * Busca resultado de distribuição para um aluno (busca pública, sem autenticação)
   *
   * Query Parameters:
   * - name: nome do aluno (string)
   * - distributionId: ID da distribuição (UUID)
   *
   * Example: GET /api/search?name=João%20Silva&distributionId=dist_123
   *
   * Response 200 (aluno encontrado):
   * {
   *   "success": true,
   *   "found": true,
   *   "data": {
   *     "studentName": "João Silva",
   *     "course": "EE",
   *     "phase": 3,
   *     "group": {
   *       "id": "grp_123",
   *       "themeId": "tema_a",
   *       "themeName": "Tema A",
   *       "themeDescription": "Descrição do tema",
   *       "members": [
   *         { "name": "João Silva", "course": "EE", "phase": 3 },
   *         { "name": "Maria Santos", "course": "ME", "phase": 5 },
   *         { "name": "Pedro Costa", "course": "EE", "phase": 7 },
   *         { "name": "Ana Oliveira", "course": "ME", "phase": 2 }
   *       ]
   *     }
   *   }
   * }
   *
   * Response 200 (aluno não encontrado):
   * {
   *   "success": true,
   *   "found": false,
   *   "message": "Aluno não encontrado na distribuição"
   * }
   *
   * Response 400: Parâmetros de busca inválidos
   * Response 500: Erro interno
   */
  router.get(
    '/',
    validateSearchQuery,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const { name, distributionId } = req.query as {
          name: string;
          distributionId: string;
        };

        const access = await database.getStudentAccessState(distributionId);
        if (!access.resultsAvailable) {
          return res.status(403).json({
            success: false,
            error: 'Resultados ainda nao estao disponiveis para esta distribuicao',
            data: access,
          });
        }

        // Buscar aluno
        const student = await database.getStudentByName(name, distributionId);

        if (!student) {
          return res.status(200).json({
            success: true,
            found: false,
            message: 'Aluno não encontrado na distribuição',
          });
        }

        // Buscar grupo do aluno
        const groupData = await database.getStudentGroup(student.id, distributionId);

        if (!groupData) {
          return res.status(200).json({
            success: true,
            found: true,
            data: {
              studentId: student.id,
              studentName: student.name,
              course: student.course,
              phase: student.phase,
              message: 'Aluno não foi alocado a nenhum grupo ainda',
            },
          });
        }

        // Buscar informações detalhadas do grupo
        const theme = await database.getTheme(groupData.theme_id);
        const groupStudentIds = await database.getGroupStudents(groupData.id);

        // Buscar informações de todos os alunos do grupo
        const members = [];
        for (const studentId of groupStudentIds) {
          const groupStudent = await database.getStudent(studentId);
          if (groupStudent) {
            members.push({
              name: groupStudent.name,
              course: groupStudent.course,
              phase: groupStudent.phase,
            });
          }
        }

        res.status(200).json({
          success: true,
          found: true,
          data: {
            studentId: student.id,
            studentName: student.name,
            course: student.course,
            phase: student.phase,
            group: {
              id: groupData.id,
              themeId: groupData.theme_id,
              themeName: theme?.name || 'Tema desconhecido',
              themeDescription: theme?.description || '',
              socialCohesionScore:
                groupData.social_cohesion_score !== undefined && groupData.social_cohesion_score !== null
                  ? Number(groupData.social_cohesion_score)
                  : undefined,
              members,
            },
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao buscar resultado',
          message: error.message,
        });
      }
    })
  );

  return router;
}
