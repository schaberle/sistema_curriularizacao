import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { AuthService } from '../services/auth/AuthService';
import { Student, Theme } from '../domain';
import { DistributionEngine } from '../services/optimization/DistributionEngine';
import { createAuthMiddleware, getOrganizerIdFromRequest } from '../middleware/auth.middleware';
import { validateThemeUpload } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Organizer Routes - Rotas de Organizador
 *
 * Requer autenticação via JWT
 *
 * POST /api/organizer/distributions - Cria nova distribuição
 * POST /api/organizer/distributions/:distributionId/themes - Upload de temas
 * POST /api/organizer/distributions/:distributionId/execute - Executa distribuição
 * GET /api/organizer/distributions/:distributionId/results - Resultados
 */
export function createOrganizerRoutes(
  database: DatabaseService,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  /**
   * POST /api/organizer/distributions
   * Cria nova distribuição
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Response 201:
   * {
   *   "success": true,
   *   "data": {
   *     "distributionId": "dist_123"
   *   }
   * }
   *
   * Response 401: Não autenticado
   * Response 500: Erro interno
   */
  router.post(
    '/distributions',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const organizerId = getOrganizerIdFromRequest(req);

        // Criar distribuição
        const distributionId = await database.createDistribution(organizerId);

        res.status(201).json({
          success: true,
          data: {
            distributionId,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao criar distribuição',
          message: error.message,
        });
      }
    })
  );

  /**
   * POST /api/organizer/distributions/:distributionId/themes
   * Upload de temas (max 50)
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Body:
   * {
   *   "themes": [
   *     { "name": "Tema A", "description": "Descrição A", "maxGroups": 2 },
   *     { "name": "Tema B", "description": "Descrição B", "maxGroups": 3 }
   *   ]
   * }
   *
   * Response 201:
   * {
   *   "success": true,
   *   "data": {
   *     "distributionId": "dist_123",
   *     "themesCreated": 2
   *   }
   * }
   *
   * Response 400: Validação falhou
   * Response 401: Não autenticado ou distribuição não pertence a organizador
   * Response 404: Distribuição não encontrada
   * Response 500: Erro interno
   */
  router.post(
    '/distributions/:distributionId/themes',
    authMiddleware,
    validateThemeUpload,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const organizerId = getOrganizerIdFromRequest(req);
        const distributionId = req.params.distributionId as string;
        const { themes } = req.body;

        // Verificar se distribuição existe e pertence ao organizador
        const distribution = await database.getDistribution(distributionId);
        if (!distribution) {
          return res.status(404).json({
            error: 'Distribuição não encontrada',
          });
        }

        if (distribution.organizer_id !== organizerId) {
          return res.status(403).json({
            error: 'Você não tem permissão para acessar esta distribuição',
          });
        }

        // Verificar limite de temas
        if (themes.length > 50) {
          return res.status(400).json({
            error: 'Máximo de 50 temas permitidos',
          });
        }

        // Criar temas
        let themesCreated = 0;
        for (const theme of themes) {
          await database.createTheme(
            theme.name,
            theme.description || '',
            theme.maxGroups,
            distributionId
          );
          themesCreated++;
        }

        res.status(201).json({
          success: true,
          data: {
            distributionId,
            themesCreated,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao criar temas',
          message: error.message,
        });
      }
    })
  );

  /**
   * POST /api/organizer/distributions/:distributionId/execute
   * Executa distribuição (algoritmo)
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Response 200:
   * {
   *   "success": true,
   *   "data": {
   *     "distributionId": "dist_123",
   *     "groupsCreated": 5,
   *     "score": 7850,
   *     "feasible": true,
   *     "executionTime": 1234,
   *     "report": "..." (relatório detalhado)
   *   }
   * }
   *
   * Response 400: Cenário infeasível
   * Response 401: Não autenticado
   * Response 404: Distribuição não encontrada
   * Response 500: Erro interno
   */
  router.post(
    '/distributions/:distributionId/execute',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const organizerId = getOrganizerIdFromRequest(req);
        const distributionId = req.params.distributionId as string;

        // Verificar permissão
        const distribution = await database.getDistribution(distributionId);
        if (!distribution) {
          return res.status(404).json({
            error: 'Distribuição não encontrada',
          });
        }

        if (distribution.organizer_id !== organizerId) {
          return res.status(403).json({
            error: 'Você não tem permissão para acessar esta distribuição',
          });
        }

        // Atualizar status
        await database.updateDistributionStatus(distributionId, 'EXECUTING');

        // 1. Buscar alunos e temas
        const studentsData = await database.getStudentsByDistribution(distributionId);
        const themesData = await database.getThemesByDistribution(distributionId);

        if (studentsData.length === 0) {
          return res.status(400).json({
            error: 'Nenhum aluno registrado na distribuição',
          });
        }

        if (themesData.length === 0) {
          return res.status(400).json({
            error: 'Nenhum tema registrado na distribuição',
          });
        }

        // 2. Converter para objetos do domain
        const students: Student[] = [];
        for (const studentData of studentsData) {
          // Buscar preferências primeiro
          const preferencesData = await database.getStudentPreferences(studentData.id);
          const preferences = preferencesData.map(p => ({
            themeId: p.theme_id,
            rank: p.rank,
          }));

          const student = new Student(
            studentData.id,
            studentData.name,
            studentData.course,
            studentData.phase,
            preferences
          );

          students.push(student);
        }

        const themes: Theme[] = themesData.map(
          (t: any) => new Theme(t.id, t.name, t.description, t.max_groups)
        );

        // 3. Executar distribuição
        const engine = new DistributionEngine();
        const validation = engine.validateScenario(students, themes);

        if (!validation.isFeasible) {
          await database.updateDistributionStatus(distributionId, 'FAILED');
          return res.status(400).json({
            error: 'Cenário infeasível',
            issues: validation.issues,
          });
        }

        // Limpar grupos anteriores se houver
        await database.clearDistributionGroups(distributionId);

        // Executar algoritmo
        const result = await engine.solve(students, themes);

        // 4. Salvar resultado
        await database.saveSolution(distributionId, result.solution);

        res.status(200).json({
          success: true,
          data: {
            distributionId,
            groupsCreated: result.solution.getGroupCount(),
            score: Math.round(result.solution.totalScore),
            feasible: result.solution.constraintViolations.filter(v => v.severity === 'CRITICAL').length === 0,
            executionTime: result.executionTime,
            report: result.report,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao executar distribuição',
          message: error.message,
        });
      }
    })
  );

  /**
   * GET /api/organizer/distributions/:distributionId/results
   * Busca resultados da distribuição
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Response 200:
   * {
   *   "success": true,
   *   "data": {
   *     "groups": [
   *       {
   *         "id": "grp_123",
   *         "theme": { "id": "tema_a", "name": "Tema A" },
   *         "students": [
   *           { "id": "stu_1", "name": "João", "course": "EE", "phase": 3 },
   *           ...
   *         ]
   *       },
   *       ...
   *     ]
   *   }
   * }
   *
   * Response 401: Não autenticado
   * Response 404: Distribuição não encontrada
   * Response 500: Erro interno
   */
  router.get(
    '/distributions/:distributionId/results',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const organizerId = getOrganizerIdFromRequest(req);
        const distributionId = req.params.distributionId as string;

        // Verificar permissão
        const distribution = await database.getDistribution(distributionId);
        if (!distribution) {
          return res.status(404).json({
            error: 'Distribuição não encontrada',
          });
        }

        if (distribution.organizer_id !== organizerId) {
          return res.status(403).json({
            error: 'Você não tem permissão para acessar esta distribuição',
          });
        }

        // Buscar solução
        const solutionData = await database.getSolution(distributionId);

        const groups = solutionData.map((group: any) => ({
          id: group.id,
          theme: (group as any).themes,
          students: (group as any).group_students.map((gs: any) => gs.students),
        }));

        res.status(200).json({
          success: true,
          data: {
            groups,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Erro ao buscar resultados',
          message: error.message,
        });
      }
    })
  );

  return router;
}
