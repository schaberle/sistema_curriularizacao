import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Theme Routes - Rotas de Temas (Públicas)
 */
export function createThemeRoutes(database: DatabaseService): Router {
    const router = Router();

    /**
     * GET /api/themes/:distributionId
     */
    router.get(
        '/:distributionId',
        asyncHandler(async (req: Request, res: Response) => {
            try {
                const distributionId = req.params.distributionId as string;

                // Verificar se distribuição existe
                const distribution = await database.getDistribution(distributionId);
                if (!distribution) {
                    return res.status(404).json({
                        error: 'Distribuição não encontrada',
                    });
                }

                // Buscar temas
                const themes = await database.getThemesByDistribution(distributionId);

                res.status(200).json({
                    success: true,
                    data: {
                        themes: themes.map((t: any) => ({
                            id: t.id,
                            name: t.name,
                            description: t.description,
                            maxGroups: t.max_groups,
                        })),
                    },
                });
            } catch (error: any) {
                res.status(500).json({
                    error: 'Erro ao buscar temas',
                    message: error.message,
                });
            }
        })
    );

    return router;
}
