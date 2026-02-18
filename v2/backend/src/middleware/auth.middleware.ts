import { NextFunction, Request, Response } from 'express';
import { sendPublicError } from './publicError.middleware';
import { AuthService } from '../services/auth/AuthService';

/**
 * Middleware de Autenticacao
 *
 * Valida JWT e adiciona organizerId ao request
 */
export function createAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = authService.extractTokenFromHeader(req.headers.authorization);
      const decoded = await authService.verifyToken(token);

      (req as any).organizerId = decoded.organizerId;
      (req as any).email = decoded.email;

      next();
    } catch (error: any) {
      const errorText =
        `${String(error?.message || '')} ${String(error?.cause?.message || '')} ${String(error?.code || error?.cause?.code || '')}`.toLowerCase();

      const transientAuthFailure =
        error?.name === 'AuthNetworkError' ||
        errorText.includes('fetch failed') ||
        errorText.includes('econnreset') ||
        errorText.includes('enotfound') ||
        errorText.includes('etimedout') ||
        errorText.includes('network');

      if (transientAuthFailure) {
        return sendPublicError(req, res, {
          status: 503,
          errorCode: 'SERVICE_UNAVAILABLE',
          message: 'Servico de autenticacao indisponivel. Tente novamente.',
        });
      }

      return sendPublicError(req, res, {
        status: 401,
        errorCode: 'AUTH_INVALID',
        message: 'Nao autorizado',
      });
    }
  };
}

/**
 * Middleware para extrair organizerId do request (apos autenticacao)
 */
export function getOrganizerIdFromRequest(req: Request): string {
  const organizerId = (req as any).organizerId;

  if (!organizerId) {
    throw new Error('Organizador nao autenticado');
  }

  return organizerId;
}
