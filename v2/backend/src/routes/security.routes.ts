import rateLimit from 'express-rate-limit';
import { Request, Response, Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { sendPublicError } from '../middleware/publicError.middleware';
import { getRequestIp, getRequestUserAgent } from '../middleware/security.middleware';
import { DatabaseService } from '../services/database/DatabaseService';

function extractCspReportPayload(body: any): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {};
  }

  if (Array.isArray(body)) {
    return { reports: body };
  }

  if (body['csp-report'] && typeof body['csp-report'] === 'object') {
    return body['csp-report'] as Record<string, unknown>;
  }

  return body as Record<string, unknown>;
}

export function createSecurityRoutes(database: DatabaseService): Router {
  const router = Router();

  const cspReportLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) =>
      sendPublicError(req, res, {
        status: 429,
        errorCode: 'RATE_LIMITED',
        message: 'Limite de reports CSP excedido. Tente novamente mais tarde.',
      }),
  });

  router.post(
    '/csp-report',
    cspReportLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const reportPayload = extractCspReportPayload(req.body);

      try {
        await database.logSecurityAuditEvent({
          actorType: 'anonymous',
          eventType: 'csp_report',
          path: `${req.baseUrl || ''}${req.path || ''}` || req.path,
          method: req.method,
          statusCode: 204,
          ipAddress: getRequestIp(req),
          userAgent: getRequestUserAgent(req),
          metadata: {
            requestId: (req as any).requestId || null,
            report: reportPayload,
          },
        });
      } catch {
        // Falha de persistencia nao deve quebrar coleta de reports.
      }

      return res.status(204).send();
    })
  );

  return router;
}
