import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database/DatabaseService';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Public Routes
 *
 * /api/search foi descontinuado para evitar exposicao publica de PII.
 */
export function createPublicRoutes(_database: DatabaseService): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
      return res.status(410).json({
        success: false,
        error: 'Endpoint descontinuado',
        message: 'Use sessao de aluno e endpoints /api/students/me para consultar dados.',
      });
    })
  );

  return router;
}
