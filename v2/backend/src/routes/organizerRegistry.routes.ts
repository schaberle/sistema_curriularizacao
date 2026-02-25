import { Request, Response, Router } from 'express';
import { getOrganizerIdFromRequest, createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { sendPublicError } from '../middleware/publicError.middleware';
import { getRequestIp, getRequestUserAgent } from '../middleware/security.middleware';
import { AuthService } from '../services/auth/AuthService';
import { DatabaseService } from '../services/database/DatabaseService';
import { OfficialStudentRegistryService } from '../services/registry/OfficialStudentRegistryService';

export function createOrganizerRegistryRoutes(
  database: DatabaseService,
  authService: AuthService,
  officialRegistryService: OfficialStudentRegistryService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  router.post(
    '/distributions/:distributionId/student-registry/import',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const organizerId = getOrganizerIdFromRequest(req);
      const distributionId = String(req.params.distributionId || '');

      const distribution = await database.getDistribution(distributionId);
      if (!distribution) {
        return sendPublicError(req, res, {
          status: 404,
          errorCode: 'NOT_FOUND',
          message: 'Distribuicao nao encontrada',
        });
      }
      if (distribution.organizer_id !== organizerId) {
        return sendPublicError(req, res, {
          status: 403,
          errorCode: 'FORBIDDEN',
          message: 'Voce nao tem permissao para acessar esta distribuicao',
        });
      }

      const syncResult = await officialRegistryService.syncDistribution(distributionId);

      try {
        await database.logSecurityAuditEvent({
          actorType: 'organizer',
          actorId: organizerId,
          eventType: 'student_registry_import',
          path: `${req.baseUrl || ''}${req.path || ''}` || req.path,
          method: req.method,
          statusCode: 200,
          ipAddress: getRequestIp(req),
          userAgent: getRequestUserAgent(req),
          metadata: {
            distributionId,
            importedRows: syncResult.importedRows,
            activeRows: syncResult.activeRows,
            deactivatedRows: syncResult.deactivatedRows,
            source: syncResult.source,
          },
        });
      } catch {
        // Nao interrompe fluxo de import por falha de auditoria.
      }

      return res.status(200).json({
        success: true,
        data: syncResult,
      });
    })
  );

  router.post(
    '/student-registry/sync-all',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const organizerId = getOrganizerIdFromRequest(req);
      const syncResult = await officialRegistryService.syncAllDistributions();

      try {
        await database.logSecurityAuditEvent({
          actorType: 'organizer',
          actorId: organizerId,
          eventType: 'student_registry_sync_all',
          path: `${req.baseUrl || ''}${req.path || ''}` || req.path,
          method: req.method,
          statusCode: 200,
          ipAddress: getRequestIp(req),
          userAgent: getRequestUserAgent(req),
          metadata: {
            distributionsProcessed: syncResult.distributionsProcessed,
            totalImportedRows: syncResult.totalImportedRows,
            totalActiveRows: syncResult.totalActiveRows,
            totalDeactivatedRows: syncResult.totalDeactivatedRows,
            source: syncResult.source,
          },
        });
      } catch {
        // Nao interrompe fluxo por falha de auditoria.
      }

      return res.status(200).json({
        success: true,
        data: syncResult,
      });
    })
  );

  router.get(
    '/distributions/:distributionId/student-registry/status',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const organizerId = getOrganizerIdFromRequest(req);
      const distributionId = String(req.params.distributionId || '');

      const distribution = await database.getDistribution(distributionId);
      if (!distribution) {
        return sendPublicError(req, res, {
          status: 404,
          errorCode: 'NOT_FOUND',
          message: 'Distribuicao nao encontrada',
        });
      }
      if (distribution.organizer_id !== organizerId) {
        return sendPublicError(req, res, {
          status: 403,
          errorCode: 'FORBIDDEN',
          message: 'Voce nao tem permissao para acessar esta distribuicao',
        });
      }

      const status = await database.getStudentRegistryStatus(distributionId);

      return res.status(200).json({
        success: true,
        data: status,
      });
    })
  );

  return router;
}
