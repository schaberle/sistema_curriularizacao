import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth/AuthService';

/**
 * Middleware de Autenticação
 *
 * Valida JWT e adiciona organizerId ao request
 */
export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Extrair token do header
      const token = authService.extractTokenFromHeader(
        req.headers.authorization
      );

      // 2. Validar token
      const decoded = authService.verifyToken(token);

      // 3. Adicionar ao request
      (req as any).organizerId = decoded.organizerId;
      (req as any).email = decoded.email;

      next();
    } catch (error: any) {
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
