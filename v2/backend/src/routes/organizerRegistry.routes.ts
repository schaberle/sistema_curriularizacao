import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { getOrganizerIdFromRequest, createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { sendPublicError } from '../middleware/publicError.middleware';
import { getRequestIp, getRequestUserAgent } from '../middleware/security.middleware';
import { AuthService } from '../services/auth/AuthService';
import { DatabaseService } from '../services/database/DatabaseService';

type RegistryImportRow = {
  name: string;
  course: string;
  phase: number;
  matricula: string;
};

function normalizeName(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMatricula(value: string): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseRowsFromCsv(rawCsv: string): RegistryImportRow[] {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = parseCsvLine(headerLine, delimiter).map((header) => header.toLowerCase());

  const idxName = headers.indexOf('name');
  const idxCourse = headers.indexOf('course');
  const idxPhase = headers.indexOf('phase');
  const idxMatricula = headers.indexOf('matricula');

  if (idxName < 0 || idxCourse < 0 || idxPhase < 0 || idxMatricula < 0) {
    throw new Error('CSV invalido: cabecalho deve conter name,course,phase,matricula');
  }

  const rows: RegistryImportRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex], delimiter);
    const courseRaw = String(values[idxCourse] || '').trim().toUpperCase();

    rows.push({
      name: String(values[idxName] || '').trim(),
      course: courseRaw,
      phase: Number.parseInt(String(values[idxPhase] || ''), 10),
      matricula: String(values[idxMatricula] || '').trim(),
    });
  }

  return rows;
}

function parseRowsFromPayload(body: any): RegistryImportRow[] {
  if (Array.isArray(body?.students)) {
    return body.students.map((row: any) => ({
      name: String(row?.name || '').trim(),
      course: String(row?.course || '').trim().toUpperCase(),
      phase: Number(row?.phase),
      matricula: String(row?.matricula || '').trim(),
    }));
  }

  if (typeof body?.csv === 'string') {
    return parseRowsFromCsv(body.csv);
  }

  return [];
}

function validateRegistryRows(rows: RegistryImportRow[]): string[] {
  const errors: string[] = [];
  const seenMatriculas = new Set<string>();

  rows.forEach((row, index) => {
    const position = index + 1;
    if (!row.name || row.name.length > 255) {
      errors.push(`Linha ${position}: nome invalido`);
    }

    if (!['EE', 'ME'].includes(row.course)) {
      errors.push(`Linha ${position}: curso deve ser EE ou ME`);
    }

    if (!Number.isInteger(row.phase) || row.phase < 1 || row.phase > 10) {
      errors.push(`Linha ${position}: fase deve ser inteiro entre 1 e 10`);
    }

    const normalizedMatricula = normalizeMatricula(row.matricula);
    if (!normalizedMatricula || normalizedMatricula.length < 4 || normalizedMatricula.length > 64) {
      errors.push(`Linha ${position}: matricula invalida`);
      return;
    }

    if (seenMatriculas.has(normalizedMatricula)) {
      errors.push(`Linha ${position}: matricula duplicada no payload`);
      return;
    }
    seenMatriculas.add(normalizedMatricula);
  });

  return errors;
}

function getRegistryPepper(): string {
  const pepper = String(process.env.STUDENT_REGISTRY_PEPPER || '').trim();
  const isProduction = String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';

  if (isProduction && !pepper) {
    throw new Error('STUDENT_REGISTRY_PEPPER obrigatoria em producao');
  }

  return pepper || 'dev-only-student-registry-pepper';
}

function hashMatricula(matricula: string, pepper: string): string {
  return crypto
    .createHash('sha256')
    .update(`${normalizeMatricula(matricula)}:${pepper}`)
    .digest('hex');
}

export function createOrganizerRegistryRoutes(
  database: DatabaseService,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);
  const registryPepper = getRegistryPepper();

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

      const rows = parseRowsFromPayload(req.body);
      if (rows.length === 0) {
        return sendPublicError(req, res, {
          status: 400,
          errorCode: 'VALIDATION_FAILED',
          message: 'Payload invalido. Envie students[] ou csv com cabecalho',
        });
      }

      const errors = validateRegistryRows(rows);
      if (errors.length > 0) {
        return sendPublicError(req, res, {
          status: 400,
          errorCode: 'VALIDATION_FAILED',
          message: 'Falha na validacao da lista oficial de alunos',
          details: {
            details: errors,
          },
        });
      }

      const upsertResult = await database.upsertStudentRegistry(
        rows.map((row) => ({
          distributionId,
          name: row.name.trim(),
          nameNormalized: normalizeName(row.name),
          course: row.course,
          phase: row.phase,
          matriculaHash: hashMatricula(row.matricula, registryPepper),
          active: true,
        }))
      );

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
            importedRows: upsertResult.importedRows,
            activeRows: upsertResult.activeRows,
            deactivatedRows: upsertResult.deactivatedRows,
          },
        });
      } catch {
        // Nao interrompe fluxo de import por falha de auditoria.
      }

      return res.status(200).json({
        success: true,
        data: {
          distributionId,
          importedRows: upsertResult.importedRows,
          activeRows: upsertResult.activeRows,
          deactivatedRows: upsertResult.deactivatedRows,
        },
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
