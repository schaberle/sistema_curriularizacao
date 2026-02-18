import { NextFunction, Request, Response } from 'express';

export type PublicErrorCode =
  | 'AUTH_INVALID'
  | 'AUTH_EXPIRED'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVICE_UNAVAILABLE';

type PublicErrorPayload = {
  errorCode: PublicErrorCode;
  message: string;
  requestId: string;
} & Record<string, unknown>;

function normalizeErrorCodeFromStatus(status: number): PublicErrorCode {
  if (status === 401) {
    return 'AUTH_INVALID';
  }
  if (status === 403) {
    return 'FORBIDDEN';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (status === 429) {
    return 'RATE_LIMITED';
  }
  if (status >= 400 && status < 500) {
    return 'VALIDATION_FAILED';
  }
  if (status === 503) {
    return 'SERVICE_UNAVAILABLE';
  }
  return 'INTERNAL_ERROR';
}

export function getRequestId(req: Request): string {
  return String((req as any).requestId || 'unknown');
}

export function sendPublicError(
  req: Request,
  res: Response,
  input: {
    status: number;
    message: string;
    errorCode?: PublicErrorCode;
    details?: Record<string, unknown>;
  }
): Response {
  const payload: PublicErrorPayload = {
    errorCode: input.errorCode || normalizeErrorCodeFromStatus(input.status),
    message: input.message,
    requestId: getRequestId(req),
    ...(input.details || {}),
  };

  return res.status(input.status).json(payload);
}

export function publicErrorContractMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = ((body: any) => {
    if (res.statusCode < 400) {
      return originalJson(body);
    }

    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const status = res.statusCode;
      const message =
        typeof body.message === 'string'
          ? body.message
          : typeof body.error === 'string'
            ? body.error
            : 'Erro na requisicao';

      const payload = {
        ...body,
        errorCode:
          typeof body.errorCode === 'string'
            ? body.errorCode
            : normalizeErrorCodeFromStatus(status),
        message,
        requestId: body.requestId || getRequestId(req),
      };

      return originalJson(payload);
    }

    return originalJson({
      errorCode: normalizeErrorCodeFromStatus(res.statusCode),
      message: 'Erro na requisicao',
      requestId: getRequestId(req),
    });
  }) as Response['json'];

  next();
}
