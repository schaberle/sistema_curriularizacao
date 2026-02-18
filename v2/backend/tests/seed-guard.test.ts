import request from 'supertest';
import { createApp } from '../src/app';

describe('seed guard', () => {
  it('blocks seed endpoint when DEV_SEED_ENABLED is false', async () => {
    const app = createApp({
      legacyBackendUrl: 'http://127.0.0.1:9',
      devSeedEnabled: false,
    });

    const response = await request(app).post('/api/organizer/distributions/abc/seed').send({});

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('SEED_DISABLED');
  });

  it('returns 503 when compatibility backend is not configured', async () => {
    const app = createApp({
      legacyBackendUrl: undefined,
      devSeedEnabled: true,
    });

    const response = await request(app).get('/api/auth/user');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('LEGACY_BACKEND_UNAVAILABLE');
  });
});
