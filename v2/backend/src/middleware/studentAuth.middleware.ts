import { NextFunction, Request, Response } from 'express';
import { sendPublicError } from './publicError.middleware';
import { DatabaseService } from '../services/database/DatabaseService';
import { StudentSessionService } from '../services/auth/StudentSessionService';

type StudentAuthRequest = Request & {
  studentAuth?: {
    studentId: string;
    distributionId: string;
    jti: string;
  };
};

function normalizeBearerToken(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new Error('Header Authorization nao fornecido');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new Error('Formato de Authorization invalido');
  }

  return parts[1];
}

export function createStudentAuthMiddleware(
  databaseService: DatabaseService,
  studentSessionService: StudentSessionService
) {
  return async (req: StudentAuthRequest, res: Response, next: NextFunction) => {
    try {
      const token = normalizeBearerToken(req.headers.authorization);
      const claims = studentSessionService.verifyAccessToken(token);

      const student = await databaseService.getStudent(claims.student_id);
      if (!student || student.distribution_id !== claims.distribution_id) {
        return sendPublicError(req, res, {
          status: 401,
          errorCode: 'AUTH_INVALID',
          message: 'Sessao de aluno invalida',
        });
      }

      req.studentAuth = {
        studentId: claims.student_id,
        distributionId: claims.distribution_id,
        jti: claims.jti,
      };

      next();
    } catch {
      return sendPublicError(req, res, {
        status: 401,
        errorCode: 'AUTH_INVALID',
        message: 'Nao autorizado',
      });
    }
  };
}

export function getStudentAuthFromRequest(req: Request): {
  studentId: string;
  distributionId: string;
  jti: string;
} {
  const auth = (req as StudentAuthRequest).studentAuth;
  if (!auth) {
    throw new Error('Aluno nao autenticado');
  }

  return auth;
}
