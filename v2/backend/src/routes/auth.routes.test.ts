import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';

import { createAuthRoutes } from '../routes/auth.routes';
import { StudentSessionError } from '../services/auth/StudentSessionService';

describe('auth.routes student session hardening', () => {
  function buildApp(deps: {
    refreshSession?: jest.Mock;
    clearSessionCookies?: jest.Mock;
    revokeSession?: jest.Mock;
  }) {
    const authService = {
      extractTokenFromHeader: jest.fn(),
      verifyToken: jest.fn(),
    } as any;

    const studentSessionService = {
      refreshCookieName: 'student_refresh_token',
      csrfCookieName: 'student_csrf_token',
      refreshSession: deps.refreshSession || jest.fn(),
      setSessionCookies: jest.fn(),
      clearSessionCookies: deps.clearSessionCookies || jest.fn(),
      revokeSession: deps.revokeSession || jest.fn(),
      verifyAccessToken: jest.fn(),
    } as any;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use((req, _res, next) => {
      (req as any).requestId = 'req-test-1';
      next();
    });
    app.use('/api/auth', createAuthRoutes(authService, studentSessionService));

    return { app, studentSessionService };
  }

  it('returns 401 with explicit reason when refresh fails', async () => {
    const refreshSession = jest
      .fn()
      .mockRejectedValue(new StudentSessionError('missing_refresh_cookie', 'Refresh token ausente'));

    const { app, studentSessionService } = buildApp({ refreshSession });
    const response = await request(app).post('/api/auth/refresh').set('X-CSRF-Token', 'abc');

    expect(response.status).toBe(401);
    expect(response.body?.reason).toBe('missing_refresh_cookie');
    expect(studentSessionService.clearSessionCookies).toHaveBeenCalledTimes(1);
  });

  it('logout is idempotent (204) when session/csrf are missing', async () => {
    const { app, studentSessionService } = buildApp({});

    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(204);
    expect(studentSessionService.clearSessionCookies).toHaveBeenCalledTimes(1);
    expect(studentSessionService.revokeSession).not.toHaveBeenCalled();
  });
});
