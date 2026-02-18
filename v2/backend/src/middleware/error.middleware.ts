import { NextFunction, Request, Response } from 'express';
import { sendPublicError } from './publicError.middleware';

/**
 * Middleware de Error Handling
 *
 * Centraliza tratamento de erros
 */

/**
 * Handler de erro 404
 */
export function notFoundHandler(req: Request, res: Response) {
  return sendPublicError(req, res, {
    status: 404,
    errorCode: 'NOT_FOUND',
    message: 'Rota nao encontrada',
    details: {
      path: req.path,
      method: req.method,
    },
  });
}

/**
 * Handler global de erros
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'unhandled_error',
      requestId: (req as any).requestId || null,
      path: `${req.baseUrl || ''}${req.path || ''}` || req.path,
      method: req.method,
      errorName: error?.name || 'Error',
      errorCode: error?.code || null,
      message: error?.message || 'Unhandled error',
      stack: error?.stack || null,
      timestamp: new Date().toISOString(),
    })
  );

  // Supabase/PostgREST error
  if (error?.code && error?.status) {
    return sendPublicError(req, res, {
      status: Number(error.status) || 500,
      errorCode: 'INTERNAL_ERROR',
      message: 'Falha ao processar operacao no banco de dados',
      details: {
        code: error.code,
      },
    });
  }

  // JWT errors
  if (error?.name === 'JsonWebTokenError') {
    return sendPublicError(req, res, {
      status: 401,
      errorCode: 'AUTH_INVALID',
      message: 'Token invalido',
    });
  }

  if (error?.name === 'TokenExpiredError') {
    return sendPublicError(req, res, {
      status: 401,
      errorCode: 'AUTH_EXPIRED',
      message: 'Token expirado',
    });
  }

  // Validation error
  if (String(error?.message || '').toLowerCase().includes('valida')) {
    return sendPublicError(req, res, {
      status: 400,
      errorCode: 'VALIDATION_FAILED',
      message: 'Erro de validacao',
    });
  }

  // Auth error
  if (String(error?.message || '').toLowerCase().includes('autentic')) {
    return sendPublicError(req, res, {
      status: 401,
      errorCode: 'AUTH_INVALID',
      message: 'Nao autorizado',
    });
  }

  // Generic error
  return sendPublicError(req, res, {
    status: 500,
    errorCode: 'INTERNAL_ERROR',
    message: 'Erro interno do servidor',
  });
}

/**
 * Wrapper para funcoes assincronas
 * Captura erros e passa para error handler
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
