import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth/AuthService';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Auth Routes - Rotas de Autenticação
 * 
 * Note: Login is now handled client-side via Supabase Auth.
 */
export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();

  /**
   * GET /api/auth/verify
   * Verifica validade do token (usado pelo frontend)
   *
   * Header:
   * Authorization: Bearer eyJhbGc...
   *
   * Response 200:
   * {
   *   "valid": true,
   *   "organizerId": "org_123",
   *   "email": "org@example.com"
   * }
   *
   * Response 401: Token inválido ou expirado
   */
  router.get(
    '/verify',
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const token = authService.extractTokenFromHeader(
          req.headers.authorization
        );

        const decoded = await authService.verifyToken(token);

        res.status(200).json({
          valid: true,
          organizerId: decoded.organizerId,
          email: decoded.email,
        });
      } catch (error: any) {
        res.status(401).json({
          valid: false,
          error: error.message,
        });
      }
    })
  );

  return router;
}
