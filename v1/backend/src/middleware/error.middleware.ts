import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de Error Handling
 *
 * Centraliza tratamento de erros
 */

/**
 * Handler de erro 404
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
    method: req.method,
  });
}

/**
 * Handler global de erros
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Erro:', error);

  // Supabase error
  if (error.code && error.status) {
    return res.status(error.status).json({
      error: 'Erro no banco de dados',
      code: error.code,
      message: error.message,
    });
  }

  // JWT error
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      message: error.message,
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
      message: error.message,
    });
  }

  // Validation error
  if (error.message && error.message.includes('Validação')) {
    return res.status(400).json({
      error: 'Erro de validação',
      message: error.message,
    });
  }

  // Auth error
  if (error.message && error.message.includes('autenticad')) {
    return res.status(401).json({
      error: 'Não autorizado',
      message: error.message,
    });
  }

  // Generic error
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: error.message || 'Erro desconhecido',
  });
}

/**
 * Wrapper para funcões assíncronas
 * Captura erros e passa para error handler
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
