import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth/AuthService';
import { StudentSessionService } from '../services/auth/StudentSessionService';
import { asyncHandler } from '../middleware/error.middleware';
import { getRequestIp, getRequestUserAgent } from '../middleware/security.middleware';

/**
 * Auth Routes - Rotas de Autenticação
 * 
 * Note: Login is now handled client-side via Supabase Auth.
 */
export function createAuthRoutes(
  authService: AuthService,
  studentSessionService: StudentSessionService
): Router {
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

  /**
   * POST /api/auth/refresh
   * Rotaciona refresh token de aluno e emite novo access token.
   */
  router.post(
    '/refresh',
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const refreshToken = req.cookies?.[studentSessionService.refreshCookieName] || '';
        const csrfCookieToken = req.cookies?.[studentSessionService.csrfCookieName] || '';
        const csrfHeaderToken = String(req.headers['x-csrf-token'] || '');

        const refreshed = await studentSessionService.refreshSession(
          refreshToken,
          csrfHeaderToken,
          csrfCookieToken,
          {
            ipAddress: getRequestIp(req),
            userAgent: getRequestUserAgent(req),
          }
        );

        studentSessionService.setSessionCookies(res, {
          refreshToken: refreshed.refreshToken,
          csrfToken: refreshed.csrfToken,
        });

        return res.status(200).json({
          success: true,
          data: {
            accessToken: refreshed.accessToken,
            accessTokenExpiresInSec: refreshed.accessTokenExpiresInSec,
          },
        });
      } catch (error: any) {
        studentSessionService.clearSessionCookies(res);
        return res.status(401).json({
          success: false,
          error: error?.message || 'Nao foi possivel renovar a sessao',
        });
      }
    })
  );

  /**
   * POST /api/auth/logout
   * Revoga refresh token atual de aluno e limpa cookies.
   */
  router.post(
    '/logout',
    asyncHandler(async (req: Request, res: Response) => {
      const csrfCookieToken = req.cookies?.[studentSessionService.csrfCookieName] || '';
      const csrfHeaderToken = String(req.headers['x-csrf-token'] || '');
      if (!csrfCookieToken || !csrfHeaderToken || csrfCookieToken !== csrfHeaderToken) {
        return res.status(403).json({
          success: false,
          error: 'CSRF token invalido',
        });
      }

      const refreshToken = req.cookies?.[studentSessionService.refreshCookieName] || '';
      if (refreshToken) {
        try {
          await studentSessionService.revokeSession(refreshToken);
        } catch {
          // No logout, limpeza de cookie tem prioridade sobre falha de persistencia.
        }
      }

      studentSessionService.clearSessionCookies(res);

      return res.status(200).json({
        success: true,
      });
    })
  );

  return router;
}
