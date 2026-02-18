import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth/AuthService';

/**
 * Middleware de Autenticação
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
      const errorText = `${String(error?.message || '')} ${String(error?.cause?.message || '')} ${String(error?.code || error?.cause?.code || '')}`.toLowerCase();
      const transientAuthFailure =
        error?.name === 'AuthNetworkError' ||
        errorText.includes('fetch failed') ||
        errorText.includes('econnreset') ||
        errorText.includes('enotfound') ||
        errorText.includes('etimedout') ||
        errorText.includes('network');

      if (transientAuthFailure) {
        return res.status(503).json({
          error: 'Serviço de autenticação indisponível',
          message: 'Falha transitória de rede ao validar token. Tente novamente.',
        });
      }

      res.status(401).json({
        error: 'Não autorizado',
        message: error.message,
      });
    }
  };
}

/**
 * Middleware para extrair organizerId do request (após autenticação)
 */
export function getOrganizerIdFromRequest(req: Request): string {
  const organizerId = (req as any).organizerId;

  if (!organizerId) {
    throw new Error('Organizador não autenticado');
  }

  return organizerId;
}

