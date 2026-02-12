import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { AuthService } from '../services/auth/AuthService';
import { Student, Theme } from '../domain';
import { DistributionEngine } from '../services/optimization/DistributionEngine';
import { AffinityMatrix } from '../domain/AffinityMatrix';
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
 * POST /api/organizer/distributions/:distributionId/execute - Executa distribuição (legado, chama Fase 1)
 * POST /api/organizer/distributions/:distributionId/execute-phase1 - Executa Fase 1 (formação inicial)
 * POST /api/organizer/distributions/:distributionId/execute-phase2 - Executa Fase 2 (otimização social)
 * PUT /api/organizer/distributions/:distributionId/social-config - Configura Fase 2
 * GET /api/organizer/distributions/:distributionId/results - Resultados
 * GET /api/organizer/distributions/:distributionId/social-metrics - Métricas sociais (Fase 2)
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

          // Buscar afinidades
          const affinitiesData = await database.getStudentAffinities(studentData.id);

          const student = new Student(
            studentData.id,
            studentData.name,
            studentData.course,
            studentData.phase,
            preferences
          );

          // Configurar afinidades
          for (const aff of affinitiesData) {
            student.setAffinity(aff.target_student_id, aff.level);
          }

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

  /**
   * POST /api/organizer/distributions/:distributionId/execute-phase1
   * Executa Fase 1 (Formação inicial de grupos com otimização de energia)
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Body (opcional):
   * {
   *   "wPref": 1.0,
   *   "wDup": 0.9,
   *   "wDiv": 0.35
   * }
   *
   * Response 200:
   * {
   *   "success": true,
   *   "data": {
   *     "distributionId": "dist_123",
   *     "phase": "PHASE1_COMPLETED",
   *     "groupsCreated": 5,
   *     "energy": 1234.5678,
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
    '/distributions/:distributionId/execute-phase1',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const organizerId = getOrganizerIdFromRequest(req);
      const distributionId = req.params.distributionId as string;
      const { wPref, wDup, wDiv } = req.body || {};

      try {

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

        // 3. Executar Fase 1
        const engine = new DistributionEngine(
          wPref !== undefined || wDup !== undefined || wDiv !== undefined
            ? { wPref, wDup, wDiv }
            : undefined
        );

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

        // Executar Fase 1
        const result = await engine.solvePhase1(students, themes);

        // 4. Salvar resultado
        await database.saveSolution(distributionId, result.solution);

        // 5. Atualizar distribuição com status COMPLETED (Fase 1)
        await database.updateDistributionStatus(distributionId, 'COMPLETED');

        // Nota: Salvar pesos configurados seria feito aqui,
        // mas requer método helper no DatabaseService que será adicionado depois

        res.status(200).json({
          success: true,
          data: {
            distributionId,
            phase: 'PHASE1_COMPLETED',
            groupsCreated: result.solution.getGroupCount(),
            energy: result.solution.getTotalEnergy(),
            feasible: result.solution.isFeasible(),
            executionTime: result.executionTime,
            report: result.report,
          },
        });
      } catch (error: any) {
        console.error('[execute-phase1] Error:', error);
        await database.updateDistributionStatus(distributionId, 'FAILED').catch(() => {});
        res.status(500).json({
          error: 'Erro ao executar Fase 1',
          message: error.message,
        });
      }
    })
  );

  /**
   * POST /api/organizer/distributions/:distributionId/execute-phase2
   * Executa Fase 2 (Otimização social com base em afinidades)
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Body (opcional):
   * {
   *   "wSoc": 1.5,
   *   "maxIterations": 20000,
   *   "temperature": 0.8
   * }
   *
   * Response 200:
   * {
   *   "success": true,
   *   "data": {
   *     "distributionId": "dist_123",
   *     "phase": "PHASE2_COMPLETED",
   *     "groupsModified": 2,
   *     "avgCohesion": 2.3456,
   *     "executionTime": 1234,
   *     "report": "..." (relatório detalhado)
   *   }
   * }
   *
   * Response 400: Fase 1 não foi executada ou sem afinidades
   * Response 401: Não autenticado
   * Response 404: Distribuição não encontrada
   * Response 500: Erro interno
   */
  router.post(
    '/distributions/:distributionId/execute-phase2',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const organizerId = getOrganizerIdFromRequest(req);
        const distributionId = req.params.distributionId as string;
        const { wSoc, maxIterations, temperature } = req.body || {};

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

        // Verificar se Fase 1 foi executada
        const status = (distribution as any).status;
        if (status !== 'COMPLETED') {
          return res.status(400).json({
            error: 'Fase 1 não foi executada',
            message: 'Execute Fase 1 antes de Fase 2',
            currentStatus: status,
          });
        }

        // Atualizar status
        await database.updateDistributionStatus(distributionId, 'EXECUTING');

        // 1. Buscar solução da Fase 1 do banco
        const solutionData = await database.getSolution(distributionId);
        if (!solutionData || solutionData.length === 0) {
          await database.updateDistributionStatus(distributionId, 'FAILED').catch(() => {});
          return res.status(400).json({
            error: 'Nenhuma solução da Fase 1 encontrada',
          });
        }

        // 2. Construir Affinity Matrix
        const affinityMatrix = new AffinityMatrix();

        // 3. Buscar temas para reconstrução
        const themesData = await database.getThemesByDistribution(distributionId);
        const themes: Theme[] = themesData.map(
          (t: any) => new Theme(t.id, t.name, t.description, t.max_groups)
        );

        // NOTA: Implementação completa de Fase 2 requer método helper
        // loadSolutionFromDatabase que ainda não está disponível.
        // Este é um placeholder que marca a execução como concluída.
        // A integração completa será feita em refatoração futura.

        // 5. Atualizar distribuição com status COMPLETED (Fase 2)
        await database.updateDistributionStatus(distributionId, 'COMPLETED');

        res.status(200).json({
          success: true,
          data: {
            distributionId,
            phase: 'PHASE2_COMPLETED',
            groupsCount: solutionData.length,
            executionTime: 0,
            affinitiesUsed: affinityMatrix.getSize(),
            message: 'Fase 2 está em integração. Resultado mantém Fase 1.',
          },
        });
      } catch (error: any) {
        console.error('[execute-phase2] Error:', error);
        res.status(500).json({
          error: 'Erro ao executar Fase 2',
          message: error.message,
        });
      }
    })
  );

  /**
   * PUT /api/organizer/distributions/:distributionId/social-config
   * Configura parâmetros da Fase 2 (Otimização Social)
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Body:
   * {
   *   "enabled": true,
   *   "wSoc": 1.5,
   *   "maxIterations": 20000,
   *   "temperature": 0.8
   * }
   *
   * Response 200:
   * {
   *   "success": true,
   *   "message": "Configuração de Fase 2 atualizada",
   *   "data": {
   *     "distributionId": "dist_123",
   *     "config": { "enabled": true, "wSoc": 1.5, ... }
   *   }
   * }
   *
   * Response 401: Não autenticado
   * Response 404: Distribuição não encontrada
   * Response 500: Erro interno
   */
  router.put(
    '/distributions/:distributionId/social-config',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const organizerId = getOrganizerIdFromRequest(req);
        const distributionId = req.params.distributionId as string;
        const { enabled, wSoc, maxIterations, temperature } = req.body;

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

        // Nota: Configuração de Fase 2 seria persistida no banco via trigger de migration
        // Por enquanto, apenas retornamos confirmação com valores sugeridos

        res.status(200).json({
          success: true,
          message: 'Configuração de Fase 2 registrada',
          data: {
            distributionId,
            config: {
              enabled: enabled !== undefined ? enabled : true,
              wSoc: wSoc || 1.0,
              maxIterations: maxIterations || 20000,
              temperature: temperature || 0.8,
            },
          },
        });
      } catch (error: any) {
        console.error('[social-config] Error:', error);
        res.status(500).json({
          error: 'Erro ao atualizar configuração de Fase 2',
          message: error.message,
        });
      }
    })
  );

  /**
   * GET /api/organizer/distributions/:distributionId/social-metrics
   * Recupera métricas sociais dos grupos (Fase 2)
   *
   * Headers:
   * Authorization: Bearer <token>
   *
   * Response 200:
   * {
   *   "success": true,
   *   "data": {
   *     "distributionId": "dist_123",
   *     "affinitiesCount": 45,
   *     "groups": [
   *       {
   *         "id": "grp_123",
   *         "theme": "Tema A",
   *         "students": 4,
   *         "socialCohesionScore": 2.3456,
   *         "status": "✅ Afinidades positivas"
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
    '/distributions/:distributionId/social-metrics',
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

        // Buscar grupos
        const groupsData = await database.getSolution(distributionId);

        // Calcular métricas
        const groups = (groupsData || []).map((group: any) => {
          const socialScore = group.social_cohesion_score || 0;
          let status = '➖ Neutro';
          if (socialScore > 0) {
            status = '✅ Afinidades positivas';
          } else if (socialScore < 0) {
            status = '⚠️ Afinidades negativas';
          }

          const theme = (group as any).themes || {};
          const students = (group as any).group_students || [];

          return {
            id: group.id,
            theme: theme.name || 'N/A',
            students: students.length,
            socialCohesionScore: parseFloat((socialScore || 0).toFixed(4)),
            status,
          };
        });

        res.status(200).json({
          success: true,
          data: {
            distributionId,
            groupsCount: groups.length,
            groups,
          },
        });
      } catch (error: any) {
        console.error('[social-metrics] Error:', error);
        res.status(500).json({
          error: 'Erro ao buscar métricas sociais',
          message: error.message,
        });
      }
    })
  );

  return router;
}
