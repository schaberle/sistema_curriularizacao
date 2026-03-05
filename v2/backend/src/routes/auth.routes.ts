import { Request, Response, Router } from 'express';
import { sendPublicError } from '../middleware/publicError.middleware';
import { AuthService } from '../services/auth/AuthService';
import {
  StudentSessionError,
  StudentSessionFailureReason,
  StudentSessionService,
} from '../services/auth/StudentSessionService';
import { asyncHandler } from '../middleware/error.middleware';
import { getRequestIp, getRequestUserAgent } from '../middleware/security.middleware';

/**
 * Auth Routes - Rotas de autenticacao
 *
 * Note: login de organizador e gerenciado no cliente via Supabase Auth.
 */
export function createAuthRoutes(
  authService: AuthService,
  studentSessionService: StudentSessionService
): Router {
  const router = Router();

  function mapRefreshFailureReason(error: unknown): StudentSessionFailureReason | 'unknown' {
    if (error instanceof StudentSessionError) {
      return error.reason;
    }
    return 'unknown';
  }

  /**
   * GET /api/auth/verify
   * Verifica validade do token de organizador.
   */
  router.get(
    '/verify',
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const token = authService.extractTokenFromHeader(
          req.headers.authorization
        );

        const decoded = await authService.verifyToken(token);

        return res.status(200).json({
          valid: true,
          organizerId: decoded.organizerId,
          email: decoded.email,
        });
      } catch {
        return sendPublicError(req, res, {
          status: 401,
          errorCode: 'AUTH_INVALID',
          message: 'Token invalido ou expirado',
          details: {
            valid: false,
          },
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
      const requestId = String((req as any).requestId || 'unknown');
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

        const claims = studentSessionService.verifyAccessToken(refreshed.accessToken);

        return res.status(200).json({
          success: true,
          data: {
            accessToken: refreshed.accessToken,
            accessTokenExpiresInSec: refreshed.accessTokenExpiresInSec,
            studentId: claims.student_id,
            distributionId: claims.distribution_id,
          },
        });
      } catch (error) {
        const reason = mapRefreshFailureReason(error);
        console.warn(
          JSON.stringify({
            level: 'warn',
            event: 'auth_refresh_failed',
            requestId,
            reason,
            ipAddress: getRequestIp(req),
            userAgent: getRequestUserAgent(req),
            timestamp: new Date().toISOString(),
          })
        );
        studentSessionService.clearSessionCookies(res);
        return sendPublicError(req, res, {
          status: 401,
          errorCode: 'AUTH_INVALID',
          message: 'Nao foi possivel renovar a sessao',
          details: {
            reason,
          },
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
      const refreshToken = req.cookies?.[studentSessionService.refreshCookieName] || '';
      const csrfMatches =
        Boolean(csrfCookieToken) &&
        Boolean(csrfHeaderToken) &&
        csrfCookieToken === csrfHeaderToken;

      if (refreshToken && csrfMatches) {
        try {
          await studentSessionService.revokeSession(refreshToken);
        } catch {
          // No logout, limpeza de cookie tem prioridade sobre falha de persistencia.
        }
      }

      studentSessionService.clearSessionCookies(res);
      return res.status(204).send();
    })
  );

  return router;
}
