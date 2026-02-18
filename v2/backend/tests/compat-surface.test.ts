import request from 'supertest';
import { createApp } from '../src/app';

describe('compatibility surface', () => {
  const app = createApp({ legacyBackendUrl: undefined, devSeedEnabled: false });

  const endpoints = [
    { method: 'get', path: '/api/auth/user' },
    { method: 'get', path: '/api/themes/distributions/dist-1' },
    { method: 'get', path: '/api/students/distribution/dist-1/access' },
    { method: 'get', path: '/api/search?distributionId=dist-1&registration=123' },
    { method: 'get', path: '/api/organizer/distributions' },
  ] as const;

  test.each(endpoints)('$method $path returns compatibility unavailable when no legacy backend', async ({ method, path }) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('LEGACY_BACKEND_UNAVAILABLE');
  });
});
