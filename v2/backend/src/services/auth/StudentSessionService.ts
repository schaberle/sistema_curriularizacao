import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Response } from 'express';
import { DatabaseService } from '../database/DatabaseService';

type StudentIdentity = {
  studentId: string;
  distributionId: string;
};

type SessionContext = {
  ipAddress: string;
  userAgent: string;
};

export type StudentSessionFailureReason =
  | 'missing_refresh_cookie'
  | 'csrf_missing'
  | 'csrf_invalid'
  | 'invalid_signature'
  | 'expired'
  | 'revoked'
  | 'reuse_detected';

export class StudentSessionError extends Error {
  readonly reason: StudentSessionFailureReason;

  constructor(reason: StudentSessionFailureReason, message: string) {
    super(message);
    this.name = 'StudentSessionError';
    this.reason = reason;
  }
}

export type StudentAccessTokenClaims = JwtPayload & {
  sub: string;
  role: 'student';
  student_id: string;
  distribution_id: string;
  jti: string;
};

export type StudentSessionIssueResult = {
  accessToken: string;
  accessTokenExpiresInSec: number;
  refreshToken: string;
  csrfToken: string;
};

export class StudentSessionService {
  private readonly databaseService: DatabaseService;
  private readonly jwtSecret: string;
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string;
  private readonly accessTtlSec: number;
  private readonly refreshTtlSec: number;
  readonly refreshCookieName = 'student_refresh_token';
  readonly csrfCookieName = 'student_csrf_token';

  constructor(
    databaseService: DatabaseService,
    jwtSecret: string,
    options?: {
      jwtIssuer?: string;
      jwtAudience?: string;
      accessTtlSec?: number;
      refreshTtlSec?: number;
    }
  ) {
    this.databaseService = databaseService;
    this.jwtSecret = jwtSecret;
    this.jwtIssuer = options?.jwtIssuer || 'curricularizacao-api';
    this.jwtAudience = options?.jwtAudience || 'student-api';
    this.accessTtlSec = options?.accessTtlSec || 15 * 60;
    this.refreshTtlSec = options?.refreshTtlSec || 7 * 24 * 60 * 60;
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private issueAccessToken(identity: StudentIdentity): string {
    const claims: StudentAccessTokenClaims = {
      sub: identity.studentId,
      role: 'student',
      student_id: identity.studentId,
      distribution_id: identity.distributionId,
      jti: crypto.randomUUID(),
    };

    return jwt.sign(claims, this.jwtSecret, {
      expiresIn: this.accessTtlSec,
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
    });
  }

  private randomToken(bytes = 48): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }

  private getRefreshExpiryIso(): string {
    return new Date(Date.now() + this.refreshTtlSec * 1000).toISOString();
  }

  async issueSessionForStudent(
    identity: StudentIdentity,
    context: SessionContext
  ): Promise<StudentSessionIssueResult> {
    const refreshToken = this.randomToken();
    const csrfToken = this.randomToken(32);
    const refreshTokenHash = this.hash(refreshToken);
    const csrfTokenHash = this.hash(csrfToken);

    await this.databaseService.createStudentSessionRecord({
      studentId: identity.studentId,
      distributionId: identity.distributionId,
      refreshTokenHash,
      csrfTokenHash,
      expiresAt: this.getRefreshExpiryIso(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      accessToken: this.issueAccessToken(identity),
      accessTokenExpiresInSec: this.accessTtlSec,
      refreshToken,
      csrfToken,
    };
  }

  verifyAccessToken(token: string): StudentAccessTokenClaims {
    const decoded = jwt.verify(token, this.jwtSecret, {
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
    }) as StudentAccessTokenClaims;

    if (decoded.role !== 'student' || !decoded.student_id || !decoded.distribution_id) {
      throw new Error('Token de aluno invalido');
    }

    return decoded;
  }

  private resolveCookieSecure(): boolean {
    const raw = String(process.env.STUDENT_COOKIE_SECURE || '').trim().toLowerCase();
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
    return process.env.NODE_ENV === 'production';
  }

  private resolveCookieSameSite(): 'strict' | 'lax' | 'none' {
    const raw = String(process.env.STUDENT_COOKIE_SAMESITE || '').trim().toLowerCase();
    if (raw === 'strict' || raw === 'lax' || raw === 'none') {
      return raw;
    }
    return 'lax';
  }

  private buildCookieOptions(httpOnly: boolean, path: string): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    path: string;
    domain?: string;
  } {
    const maxAgeMs = this.refreshTtlSec * 1000;
    const sameSite = this.resolveCookieSameSite();
    const secure = sameSite === 'none' ? true : this.resolveCookieSecure();
    const domain = String(process.env.STUDENT_COOKIE_DOMAIN || '').trim();

    return {
      httpOnly,
      secure,
      sameSite,
      maxAge: maxAgeMs,
      path,
      ...(domain ? { domain } : {}),
    };
  }

  setSessionCookies(response: Response, tokens: { refreshToken: string; csrfToken: string }): void {
    response.cookie(
      this.refreshCookieName,
      tokens.refreshToken,
      this.buildCookieOptions(true, '/api/auth')
    );

    response.cookie(
      this.csrfCookieName,
      tokens.csrfToken,
      this.buildCookieOptions(false, '/')
    );
  }

  clearSessionCookies(response: Response): void {
    const refreshCookieOptions = this.buildCookieOptions(true, '/api/auth');
    const csrfCookieOptions = this.buildCookieOptions(false, '/');

    response.clearCookie(this.refreshCookieName, {
      httpOnly: refreshCookieOptions.httpOnly,
      secure: refreshCookieOptions.secure,
      sameSite: refreshCookieOptions.sameSite,
      path: refreshCookieOptions.path,
      ...(refreshCookieOptions.domain ? { domain: refreshCookieOptions.domain } : {}),
    });

    response.clearCookie(this.csrfCookieName, {
      httpOnly: csrfCookieOptions.httpOnly,
      secure: csrfCookieOptions.secure,
      sameSite: csrfCookieOptions.sameSite,
      path: csrfCookieOptions.path,
      ...(csrfCookieOptions.domain ? { domain: csrfCookieOptions.domain } : {}),
    });
  }

  private secureEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);

    if (aBuf.length !== bBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuf, bBuf);
  }

  private validateCsrf(csrfHeaderToken: string, csrfCookieToken: string): void {
    if (!csrfHeaderToken || !csrfCookieToken) {
      throw new StudentSessionError('csrf_missing', 'CSRF token ausente');
    }

    if (!this.secureEquals(csrfHeaderToken, csrfCookieToken)) {
      throw new StudentSessionError('csrf_invalid', 'CSRF token invalido');
    }
  }

  async refreshSession(
    refreshToken: string,
    csrfHeaderToken: string,
    csrfCookieToken: string,
    context: SessionContext
  ): Promise<StudentSessionIssueResult> {
    if (!refreshToken) {
      throw new StudentSessionError('missing_refresh_cookie', 'Refresh token ausente');
    }

    this.validateCsrf(csrfHeaderToken, csrfCookieToken);

    const refreshTokenHash = this.hash(refreshToken);
    const session = await this.databaseService.getStudentSessionByRefreshHash(refreshTokenHash);

    if (!session) {
      throw new StudentSessionError('invalid_signature', 'Sessao invalida');
    }

    const now = Date.now();
    const expiresAtMs = new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
      await this.databaseService.revokeStudentSessionByRefreshHash(refreshTokenHash, 'expired');
      throw new StudentSessionError('expired', 'Sessao expirada');
    }

    if (session.revoked_at) {
      await this.databaseService.revokeStudentSessionsByStudent(session.student_id, 'refresh_token_replay');
      throw new StudentSessionError('reuse_detected', 'Sessao revogada');
    }

    const csrfHashFromHeader = this.hash(csrfHeaderToken);
    if (csrfHashFromHeader !== session.csrf_token_hash) {
      await this.databaseService.revokeStudentSessionByRefreshHash(refreshTokenHash, 'csrf_mismatch');
      throw new StudentSessionError('csrf_invalid', 'CSRF token invalido');
    }

    const nextRefreshToken = this.randomToken();
    const nextCsrfToken = this.randomToken(32);
    const nextRefreshTokenHash = this.hash(nextRefreshToken);
    const nextCsrfTokenHash = this.hash(nextCsrfToken);

    await this.databaseService.revokeStudentSessionByRefreshHash(
      refreshTokenHash,
      'rotated',
      nextRefreshTokenHash
    );

    await this.databaseService.createStudentSessionRecord({
      studentId: session.student_id,
      distributionId: session.distribution_id,
      refreshTokenHash: nextRefreshTokenHash,
      csrfTokenHash: nextCsrfTokenHash,
      expiresAt: this.getRefreshExpiryIso(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      accessToken: this.issueAccessToken({
        studentId: session.student_id,
        distributionId: session.distribution_id,
      }),
      accessTokenExpiresInSec: this.accessTtlSec,
      refreshToken: nextRefreshToken,
      csrfToken: nextCsrfToken,
    };
  }

  async revokeSession(refreshToken: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const refreshTokenHash = this.hash(refreshToken);
    await this.databaseService.revokeStudentSessionByRefreshHash(refreshTokenHash, 'logout');
  }
}
