import { Request, Response, Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { createStudentAuthMiddleware, getStudentAuthFromRequest } from '../middleware/studentAuth.middleware';
import { getRequestIp, getRequestUserAgent } from '../middleware/security.middleware';
import { validateStudentPreferences, validateStudentRegistration } from '../middleware/validation.middleware';
import { StudentSessionService } from '../services/auth/StudentSessionService';
import { DatabaseService } from '../services/database/DatabaseService';

function clampNormalized(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function toNormalizedAffinity(value: number): number {
  if (value >= -1 && value <= 1) {
    return clampNormalized(value);
  }
  return clampNormalized(value / 100);
}

function getAccessMessage(
  access: {
    registrationOpen: boolean;
    resultsAvailable: boolean;
    affinitiesOpen: boolean;
    phase2Executed: boolean;
  },
  context: 'registration' | 'results' | 'affinities'
): string {
  if (context === 'registration' && !access.registrationOpen) {
    return 'Cadastro de alunos fechado para esta distribuicao';
  }

  if (context === 'results' && !access.resultsAvailable) {
    return 'Resultados ainda nao foram liberados para esta distribuicao';
  }

  if (context === 'affinities') {
    if (access.phase2Executed) {
      return 'Coleta de afinidades encerrada apos execucao da Fase 2';
    }
    if (!access.affinitiesOpen) {
      return 'Coleta de afinidades ainda nao esta aberta para esta distribuicao';
    }
  }

  return 'Acao indisponivel no estado atual da distribuicao';
}

async function createStudentSessionResponse(
  req: Request,
  res: Response,
  database: DatabaseService,
  studentSessionService: StudentSessionService,
  student: { id: string; distribution_id: string; name: string; course: string; phase: number }
) {
  const issued = await studentSessionService.issueSessionForStudent(
    {
      studentId: student.id,
      distributionId: student.distribution_id,
    },
    {
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
    }
  );

  studentSessionService.setSessionCookies(res, {
    refreshToken: issued.refreshToken,
    csrfToken: issued.csrfToken,
  });

  try {
    await database.logSecurityAuditEvent({
      actorType: 'student',
      actorId: student.id,
      eventType: 'student_session_issued',
      path: `${req.baseUrl || ''}${req.path || ''}` || req.path || '/api/students/session',
      method: req.method,
      statusCode: 201,
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
      metadata: {
        distributionId: student.distribution_id,
      },
    });
  } catch {
    // Sessao deve continuar mesmo se auditoria falhar.
  }

  return res.status(201).json({
    success: true,
    data: {
      studentId: student.id,
      distributionId: student.distribution_id,
      name: student.name,
      course: student.course,
      phase: student.phase,
      accessToken: issued.accessToken,
      accessTokenExpiresInSec: issued.accessTokenExpiresInSec,
    },
  });
}

/**
 * Student Routes - Fluxo de aluno com sessao JWT curta + refresh rotativo.
 */
export function createStudentRoutes(
  database: DatabaseService,
  studentSessionService: StudentSessionService
): Router {
  const router = Router();
  const studentAuthMiddleware = createStudentAuthMiddleware(database, studentSessionService);

  router.get(
    '/distribution/:distributionId/access',
    asyncHandler(async (_req: Request, res: Response) => {
      return res.status(410).json({
        error: 'Endpoint descontinuado',
        message: 'Use GET /api/students/me/access com sessao de aluno',
      });
    })
  );

  /**
   * POST /api/students/:distributionId
   * Registro + emissao imediata de sessao de aluno.
   */
  router.post(
    '/:distributionId',
    validateStudentRegistration,
    asyncHandler(async (req: Request, res: Response) => {
      const distributionId = req.params.distributionId as string;
      const { name, course, phase } = req.body as {
        name: string;
        course: string;
        phase: number;
      };

      const distribution = await database.getDistribution(distributionId);
      if (!distribution) {
        return res.status(404).json({
          error: 'Distribuicao nao encontrada',
        });
      }

      const access = await database.getStudentAccessState(distributionId);
      if (!access.registrationOpen) {
        return res.status(403).json({
          error: getAccessMessage(access, 'registration'),
          data: access,
        });
      }

      const studentId = await database.createStudent(name, course, phase, distributionId);
      const student = await database.getStudent(studentId);
      if (!student) {
        return res.status(500).json({
          error: 'Falha ao inicializar sessao do aluno',
        });
      }

      return createStudentSessionResponse(req, res, database, studentSessionService, student);
    })
  );

  /**
   * POST /api/students/:distributionId/session
   * Reemite sessao para aluno ja cadastrado (com validacao de identidade basica).
   */
  router.post(
    '/:distributionId/session',
    asyncHandler(async (req: Request, res: Response) => {
      const distributionId = req.params.distributionId as string;
      const { name, course, phase } = req.body as {
        name: string;
        course: string;
        phase: number;
      };

      if (!name || !course || !Number.isInteger(phase)) {
        return res.status(400).json({
          error: 'Dados invalidos para sessao do aluno',
        });
      }

      const distribution = await database.getDistribution(distributionId);
      if (!distribution) {
        return res.status(404).json({
          error: 'Distribuicao nao encontrada',
        });
      }

      const student = await database.findStudentForSession(distributionId, {
        name,
        course,
        phase,
      });

      if (!student) {
        return res.status(401).json({
          error: 'Nao foi possivel validar a identidade do aluno',
        });
      }

      return createStudentSessionResponse(req, res, database, studentSessionService, student);
    })
  );

  /**
   * Endpoints autenticados de aluno.
   */
  router.get(
    '/me',
    studentAuthMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const studentAuth = getStudentAuthFromRequest(req);
      const student = await database.getStudent(studentAuth.studentId);
      if (!student) {
        return res.status(404).json({
          error: 'Aluno nao encontrado',
        });
      }

      const preferences = await database.getStudentPreferences(studentAuth.studentId);
      return res.status(200).json({
        success: true,
        data: {
          id: student.id,
          name: student.name,
          course: student.course,
          phase: student.phase,
          distributionId: student.distribution_id,
          preferences,
        },
      });
    })
  );

  router.get(
    '/me/access',
    studentAuthMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const studentAuth = getStudentAuthFromRequest(req);
      const access = await database.getStudentAccessState(studentAuth.distributionId);
      return res.status(200).json({
        success: true,
        data: access,
      });
    })
  );

  router.get(
    '/me/themes',
    studentAuthMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const studentAuth = getStudentAuthFromRequest(req);
      const themes = await database.getThemesByDistribution(studentAuth.distributionId);

      return res.status(200).json({
        success: true,
        data: {
          themes: themes.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            maxGroups: t.max_groups,
          })),
        },
      });
    })
  );

  router.put(
    '/me/preferences',
    studentAuthMiddleware,
    validateStudentPreferences,
    asyncHandler(async (req: Request, res: Response) => {
      const studentAuth = getStudentAuthFromRequest(req);
      const { preferences } = req.body as {
        preferences: Array<{ themeId: string; rank: number }>;
      };

      const student = await database.getStudent(studentAuth.studentId);
      if (!student) {
        return res.status(404).json({
          error: 'Aluno nao encontrado',
        });
      }

      const access = await database.getStudentAccessState(student.distribution_id);
      if (!access.registrationOpen) {
        return res.status(403).json({
          error: getAccessMessage(access, 'registration'),
          data: access,
        });
      }

      await database.clearStudentPreferences(studentAuth.studentId);
      for (const pref of preferences) {
        await database.addStudentPreference(studentAuth.studentId, pref.themeId, pref.rank);
      }

      return res.status(200).json({
        success: true,
        message: 'Preferencias atualizadas',
        data: {
          studentId: studentAuth.studentId,
          preferencesCount: preferences.length,
        },
      });
    })
  );

  router.get(
    '/me/current-group',
    studentAuthMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const studentAuth = getStudentAuthFromRequest(req);
      const access = await database.getStudentAccessState(studentAuth.distributionId);
      if (!access.resultsAvailable) {
        return res.status(403).json({
          error: getAccessMessage(access, 'results'),
          data: access,
        });
      }

      const groupData = await database.getStudentGroup(studentAuth.studentId, studentAuth.distributionId);
      if (!groupData) {
        return res.status(404).json({
          error: 'Aluno ainda nao esta em um grupo',
          message: 'Fase 1 ainda nao foi executada',
        });
      }

      const memberIds = await database.getGroupStudents(groupData.id);
      const members: any[] = [];
      for (const memberId of memberIds) {
        const memberData = await database.getStudent(memberId);
        if (memberData) {
          members.push({
            id: memberData.id,
            name: memberData.name,
            course: memberData.course,
            phase: memberData.phase,
          });
        }
      }

      const themeData = await database.getTheme(groupData.theme_id);
      return res.status(200).json({
        success: true,
        data: {
          groupId: groupData.id,
          themeId: groupData.theme_id,
          themeName: themeData?.name || 'N/A',
          members,
        },
      });
    })
  );

  router.get(
    '/me/affinities',
    studentAuthMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const studentAuth = getStudentAuthFromRequest(req);
      const access = await database.getStudentAccessState(studentAuth.distributionId);
      if (!access.affinitiesOpen) {
        return res.status(403).json({
          error: getAccessMessage(access, 'affinities'),
          data: access,
        });
      }

      const affinitiesData = await database.getStudentAffinities(studentAuth.studentId);
      const affinities = affinitiesData.map((aff: any) => ({
        targetStudentId: aff.target_student_id || aff.targetStudentId,
        affinityValue: Math.round(
          toNormalizedAffinity(aff.level !== undefined ? aff.level : (aff.affinity_value_raw || 0)) * 100
        ),
        normalizedValue: toNormalizedAffinity(aff.level !== undefined ? aff.level : (aff.affinity_value_raw || 0)),
      }));

      return res.status(200).json({
        success: true,
        data: {
          studentId: studentAuth.studentId,
          affinities,
        },
      });
    })
  );

  router.put(
    '/me/affinities',
    studentAuthMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const studentAuth = getStudentAuthFromRequest(req);
      const { affinities } = req.body as {
        affinities: Array<{ targetStudentId: string; value: number }>;
      };

      const access = await database.getStudentAccessState(studentAuth.distributionId);
      if (!access.affinitiesOpen) {
        return res.status(403).json({
          error: getAccessMessage(access, 'affinities'),
          data: access,
        });
      }

      if (!Array.isArray(affinities)) {
        return res.status(400).json({
          error: 'Affinities deve ser um array',
        });
      }

      for (const aff of affinities) {
        if (!aff.targetStudentId || aff.value === undefined) {
          return res.status(400).json({
            error: 'Cada afinidade deve ter targetStudentId e value',
          });
        }

        if (typeof aff.value !== 'number' || aff.value < -100 || aff.value > 100) {
          return res.status(400).json({
            error: 'Valor de afinidade deve estar entre -100 e +100, ou -1 e +1',
            received: aff.value,
          });
        }

        if (aff.targetStudentId === studentAuth.studentId) {
          return res.status(400).json({
            error: 'Nao pode declarar afinidade com voce mesmo',
          });
        }

        const targetStudent = await database.getStudent(aff.targetStudentId);
        if (!targetStudent || targetStudent.distribution_id !== studentAuth.distributionId) {
          return res.status(400).json({
            error: `Aluno ${aff.targetStudentId} nao encontrado na distribuicao`,
          });
        }
      }

      let affinitiesCount = 0;
      for (const aff of affinities) {
        await database.addStudentAffinity(
          studentAuth.studentId,
          aff.targetStudentId,
          toNormalizedAffinity(aff.value)
        );
        affinitiesCount++;
      }

      if (affinitiesCount > 0 && (access.status === 'COMPLETED' || access.status === 'PARTIAL')) {
        await database.updateDistributionStatus(studentAuth.distributionId, 'PHASE2');
      }

      return res.status(200).json({
        success: true,
        message: 'Afinidades atualizadas',
        data: {
          studentId: studentAuth.studentId,
          affinitiesCount,
          distributionId: studentAuth.distributionId,
        },
      });
    })
  );

  router.get(
    '/me/affinity-candidates',
    studentAuthMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const studentAuth = getStudentAuthFromRequest(req);
      const query = String(req.query.q || '').trim();
      if (!query || query.length < 2) {
        return res.status(200).json({
          success: true,
          data: { candidates: [] },
        });
      }

      const access = await database.getStudentAccessState(studentAuth.distributionId);
      if (!access.affinitiesOpen) {
        return res.status(403).json({
          error: getAccessMessage(access, 'affinities'),
          data: access,
        });
      }

      const currentGroup = await database.getStudentGroup(studentAuth.studentId, studentAuth.distributionId);
      const currentGroupMemberIds = currentGroup ? await database.getGroupStudents(currentGroup.id) : [];

      const excludeIds = Array.from(new Set([studentAuth.studentId, ...currentGroupMemberIds]));
      const candidates = await database.searchStudentsByDistribution(
        studentAuth.distributionId,
        query,
        excludeIds,
        30
      );

      return res.status(200).json({
        success: true,
        data: {
          candidates: candidates.map((candidate: any) => ({
            id: candidate.id,
            name: candidate.name,
            course: candidate.course,
            phase: candidate.phase,
          })),
        },
      });
    })
  );

  /**
   * Endpoints legados de escrita descontinuados para eliminar IDOR.
   */
  router.put(
    '/:studentId/preferences',
    asyncHandler(async (_req: Request, res: Response) => {
      return res.status(410).json({
        error: 'Endpoint descontinuado',
        message: 'Use PUT /api/students/me/preferences com sessao de aluno',
      });
    })
  );

  router.put(
    '/:studentId/affinities',
    asyncHandler(async (_req: Request, res: Response) => {
      return res.status(410).json({
        error: 'Endpoint descontinuado',
        message: 'Use PUT /api/students/me/affinities com sessao de aluno',
      });
    })
  );

  /**
   * Endpoints legados de leitura descontinuados para evitar exposicao por identificadores.
   */
  router.get(
    '/:studentId',
    asyncHandler(async (_req: Request, res: Response) => {
      return res.status(410).json({
        error: 'Endpoint descontinuado',
        message: 'Use GET /api/students/me com sessao de aluno',
      });
    })
  );

  router.get(
    '/:studentId/current-group',
    asyncHandler(async (_req: Request, res: Response) => {
      return res.status(410).json({
        error: 'Endpoint descontinuado',
        message: 'Use GET /api/students/me/current-group com sessao de aluno',
      });
    })
  );

  router.get(
    '/:studentId/affinities',
    asyncHandler(async (_req: Request, res: Response) => {
      return res.status(410).json({
        error: 'Endpoint descontinuado',
        message: 'Use GET /api/students/me/affinities com sessao de aluno',
      });
    })
  );

  router.get(
    '/:studentId/affinity-candidates',
    asyncHandler(async (_req: Request, res: Response) => {
      return res.status(410).json({
        error: 'Endpoint descontinuado',
        message: 'Use GET /api/students/me/affinity-candidates com sessao de aluno',
      });
    })
  );

  return router;
}
