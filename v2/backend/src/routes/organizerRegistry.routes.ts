import { Request, Response, Router } from 'express';
import { getOrganizerIdFromRequest, createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { sendPublicError } from '../middleware/publicError.middleware';
import { getRequestIp, getRequestUserAgent } from '../middleware/security.middleware';
import { AuthService } from '../services/auth/AuthService';
import { DatabaseService } from '../services/database/DatabaseService';
import { OfficialStudentRegistryService } from '../services/registry/OfficialStudentRegistryService';
import { buildOperationalStudentId, mapOrigemAlunoToCourse } from '../services/registry/officialRegistry.utils';

type OrganizerSearchCandidate = {
  id: string;
  name: string;
  course: 'EE' | 'ME';
  phase: number;
  score: number;
};

const PHASE1_COMPLETED_STATUSES = new Set([
  'COMPLETED',
  'PARTIAL',
  'PHASE2',
  'PHASE2_EXECUTING',
  'PHASE2_COMPLETED',
]);

function normalizeSearchValue(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearchValue(value: string): string[] {
  return normalizeSearchValue(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreNameMatch(query: string, candidateName: string): { acceptable: boolean; score: number } {
  const normalizedQuery = normalizeSearchValue(query);
  const normalizedName = normalizeSearchValue(candidateName);

  if (!normalizedQuery || !normalizedName) {
    return { acceptable: false, score: 0 };
  }

  const isExact = normalizedName === normalizedQuery;
  const startsWith = normalizedName.startsWith(normalizedQuery);
  const contains = normalizedName.includes(normalizedQuery);

  const queryTokens = tokenizeSearchValue(normalizedQuery);
  const candidateTokens = tokenizeSearchValue(normalizedName);

  const tokenCoverage =
    queryTokens.length > 0
      ? queryTokens.filter((queryToken) =>
          candidateTokens.some((candidateToken) => candidateToken.includes(queryToken))
        ).length / queryTokens.length
      : 0;

  const acceptable = isExact || startsWith || contains || tokenCoverage >= 0.7;
  const score =
    (isExact ? 1 : 0) +
    (startsWith ? 0.6 : 0) +
    (contains ? 0.35 : 0) +
    tokenCoverage * 0.4;

  return { acceptable, score };
}

function buildPhase1InputInvalidationFlags(status: string): {
  phase1NeedsRerun?: boolean;
  phase2NeedsRerun?: boolean;
} {
  const normalized = String(status || 'PENDING').toUpperCase();
  const flags: { phase1NeedsRerun?: boolean; phase2NeedsRerun?: boolean } = {};

  if (PHASE1_COMPLETED_STATUSES.has(normalized)) {
    flags.phase1NeedsRerun = true;
  }

  if (normalized === 'PHASE2_COMPLETED') {
    flags.phase2NeedsRerun = true;
  }

  return flags;
}

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

  router.get(
    '/distributions/:distributionId/students/search',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const organizerId = getOrganizerIdFromRequest(req);
      const distributionId = String(req.params.distributionId || '');
      const query = String(req.query.q || '').trim();
      const requestedLimit = Number.parseInt(String(req.query.limit || '20'), 10);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(50, requestedLimit))
        : 20;

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

      if (!query || query.length < 2) {
        return res.status(200).json({
          success: true,
          data: { students: [] },
        });
      }

      const registryEntries = await database.getActiveStudentRegistryEntries(distributionId);

      if (registryEntries.length > 0) {
        const scoredCandidates: OrganizerSearchCandidate[] = [];

        for (const entry of registryEntries) {
          const course = mapOrigemAlunoToCourse(entry.origemAluno);
          if (!course) {
            continue;
          }

          const match = scoreNameMatch(query, entry.academico);
          if (!match.acceptable) {
            continue;
          }

          scoredCandidates.push({
            id: buildOperationalStudentId(distributionId, entry.matriculaHash),
            name: entry.academico,
            course,
            phase: entry.faseTurma,
            score: match.score,
          });
        }

        scoredCandidates.sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return a.name.localeCompare(b.name);
        });

        return res.status(200).json({
          success: true,
          data: {
            students: scoredCandidates.slice(0, limit).map(({ score: _score, ...student }) => student),
          },
        });
      }

      const students = await database.searchStudentsByDistribution(distributionId, query, [], limit);
      return res.status(200).json({
        success: true,
        data: {
          students: students.map((student: any) => ({
            id: String(student.id),
            name: String(student.name || ''),
            course: String(student.course || '').toUpperCase() === 'ME' ? 'ME' : 'EE',
            phase: Number(student.phase || 0),
          })),
        },
      });
    })
  );

  router.delete(
    '/distributions/:distributionId/students/:studentId',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const organizerId = getOrganizerIdFromRequest(req);
      const distributionId = String(req.params.distributionId || '');
      const studentId = String(req.params.studentId || '').trim();

      if (!studentId) {
        return sendPublicError(req, res, {
          status: 400,
          errorCode: 'VALIDATION_FAILED',
          message: 'studentId invalido',
        });
      }

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

      let registryDeactivated = false;
      const registryEntries = await database.getActiveStudentRegistryEntries(distributionId);
      for (const entry of registryEntries) {
        const operationalStudentId = buildOperationalStudentId(distributionId, entry.matriculaHash);
        if (operationalStudentId === studentId) {
          registryDeactivated = await database.deactivateStudentRegistryEntry(distributionId, entry.matriculaHash);
          break;
        }
      }

      const operationalStudentRemoved = await database.deleteStudentAndRelatedData(distributionId, studentId);

      if (!registryDeactivated && !operationalStudentRemoved) {
        return sendPublicError(req, res, {
          status: 404,
          errorCode: 'NOT_FOUND',
          message: 'Aluno nao encontrado na distribuicao',
        });
      }

      const pendingFlags = buildPhase1InputInvalidationFlags(String(distribution.status || 'PENDING'));
      const pendingState = await database.updateDistributionExecutionPendingFlags(distributionId, pendingFlags);

      try {
        await database.logSecurityAuditEvent({
          actorType: 'organizer',
          actorId: organizerId,
          eventType: 'student_removed_by_organizer',
          path: `${req.baseUrl || ''}${req.path || ''}` || req.path,
          method: req.method,
          statusCode: 200,
          ipAddress: getRequestIp(req),
          userAgent: getRequestUserAgent(req),
          metadata: {
            distributionId,
            studentId,
            registryDeactivated,
            operationalStudentRemoved,
            phase1NeedsRerun: Boolean(pendingState?.phase1_needs_rerun),
            phase2NeedsRerun: Boolean(pendingState?.phase2_needs_rerun),
          },
        });
      } catch {
        // Nao interrompe fluxo por falha de auditoria.
      }

      return res.status(200).json({
        success: true,
        data: {
          distributionId,
          studentId,
          registryDeactivated,
          operationalStudentRemoved,
          phase1NeedsRerun: Boolean(pendingState?.phase1_needs_rerun),
          phase2NeedsRerun: Boolean(pendingState?.phase2_needs_rerun),
        },
      });
    })
  );

  return router;
}
