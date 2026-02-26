import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { AuthService } from '../services/auth/AuthService';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Theme Routes
 *
 * Restrito a organizador autenticado com escopo da distribuicao.
 */
export function createThemeRoutes(database: DatabaseService, authService: AuthService): Router {
  const router = Router();

  router.get(
    '/:distributionId',
    asyncHandler(async (req: Request, res: Response) => {
      const distributionId = req.params.distributionId as string;

      let organizerId = '';
      try {
        const token = authService.extractTokenFromHeader(req.headers.authorization);
        const decoded = await authService.verifyToken(token);
        organizerId = decoded.organizerId;
      } catch {
        return res.status(401).json({
          error: 'Autenticacao obrigatoria',
        });
      }

      const canAccess = await authService.canAccessDistribution(organizerId, distributionId);
      if (!canAccess) {
        return res.status(403).json({
          error: 'Sem permissao para acessar os temas desta distribuicao',
        });
      }

      try {
        const themes = await database.getThemesByDistribution(distributionId);

        return res.status(200).json({
          success: true,
          data: {
            themes: themes.map((t: any) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              groupProportion:
                Number.isFinite(Number(t.group_proportion))
                  ? Number(t.group_proportion)
                  : (Number.isFinite(Number(t.max_groups)) ? Number(t.max_groups) : 1),
            })),
          },
        });
      } catch {
        return res.status(500).json({
          error: 'Erro ao buscar temas',
        });
      }
    })
  );

  return router;
}
