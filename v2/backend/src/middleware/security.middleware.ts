import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { DatabaseService } from '../services/database/DatabaseService';

export function getRequestIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function getRequestUserAgent(req: Request): string {
  const value = req.headers['user-agent'];
  return Array.isArray(value) ? value[0] : String(value || 'unknown');
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingRequestId = req.headers['x-request-id'];
  const requestId =
    (Array.isArray(incomingRequestId) ? incomingRequestId[0] : incomingRequestId) || crypto.randomUUID();

  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

export function structuredLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  const ipAddress = getRequestIp(req);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const safePath = `${req.baseUrl || ''}${req.path || ''}` || req.path || '/';
    const payload = {
      level: 'info',
      requestId: (req as any).requestId || null,
      method: req.method,
      path: safePath,
      statusCode: res.statusCode,
      durationMs,
      ipAddress,
      userAgent: getRequestUserAgent(req),
      timestamp: new Date().toISOString(),
    };

    // JSON logs simplify alerting and parsing in log pipelines.
    console.log(JSON.stringify(payload));
  });

  next();
}

export function createSecurityAuditMiddleware(databaseService: DatabaseService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', async () => {
      const statusCode = res.statusCode;
      const shouldPersistAudit =
        statusCode === 401 ||
        statusCode === 403 ||
        statusCode === 429 ||
        req.path.startsWith('/api/auth');

      if (!shouldPersistAudit) {
        return;
      }

      try {
        const safePath = `${req.baseUrl || ''}${req.path || ''}` || req.path || '/';
        await databaseService.logSecurityAuditEvent({
          actorType: 'anonymous',
          eventType: 'http_response',
          path: safePath,
          method: req.method,
          statusCode,
          ipAddress: getRequestIp(req),
          userAgent: getRequestUserAgent(req),
          metadata: {
            requestId: (req as any).requestId || null,
          },
        });
      } catch (error: any) {
        console.error('[security-audit] failed to persist audit event', error?.message || error);
      }
    });

    next();
  };
}
