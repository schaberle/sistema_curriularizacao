import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth/AuthService';
import { validateLoginCredentials } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Auth Routes - Rotas de Autenticação
 *
 * POST /api/auth/login - Login de organizador
 */
export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();

  /**
   * POST /api/auth/login
   * Login de organizador com email e password
   *
   * Body:
   * {
   *   "email": "org@example.com",
   *   "password": "senha123"
   * }
   *
   * Response 200:
   * {
   *   "token": "eyJhbGc...",
   *   "organizerId": "org_123",
   *   "email": "org@example.com"
   * }
   *
   * Response 400: Validação falhou
   * Response 401: Email ou senha inválidos
   * Response 500: Erro interno
   */
  router.post(
    '/login',
    validateLoginCredentials,
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body;

      try {
        // Validar credenciais
        const validation = authService.validateLoginCredentials(email, password);
        if (!validation.valid) {
          return res.status(400).json({
            error: 'Validação falhou',
            details: validation.errors,
          });
        }

        // Fazer login
        const result = await authService.login(email, password);

        res.status(200).json({
          success: true,
          data: {
            token: result.token,
            organizerId: result.organizerId,
            email: result.email,
          },
        });
      } catch (error: any) {
        res.status(401).json({
          error: 'Autenticação falhou',
          message: error.message,
        });
      }
    })
  );

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
    asyncHandler((req: Request, res: Response) => {
      try {
        const token = authService.extractTokenFromHeader(
          req.headers.authorization
        );

        const decoded = authService.verifyToken(token);

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
