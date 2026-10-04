import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, createUser, resetDb } from './helpers.js';

describe('HTTP security', () => {
  beforeEach(resetDb);

  it('sets secure headers and hides the framework', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-request-id']).toMatch(/[0-9a-f-]{36}/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('only allows configured CORS origins', async () => {
    const ok = await api().options('/api/alerts').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await api().options('/api/alerts').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns JSON 404s for unknown routes', async () => {
    const res = await api().get('/api/does-not-exist').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('distinguishes expired from invalid tokens', async () => {
    const { user } = await createUser('RESPONDER');
    const expired = jwt.sign({ role: 'RESPONDER' }, process.env.JWT_ACCESS_SECRET!, {
      subject: user.id,
      issuer: 'resqnet-api',
      audience: 'resqnet-app',
      expiresIn: -10,
    });
    const a = await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    expect(a.body.error.code).toBe('TOKEN_EXPIRED');

    const forged = jwt.sign({ role: 'ADMIN' }, 'not-the-real-secret-not-the-real-secret', {
      subject: user.id,
      issuer: 'resqnet-api',
      audience: 'resqnet-app',
    });
    const b = await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
    expect(b.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects unsigned ("alg: none") tokens', async () => {
    const { user } = await createUser('CIVILIAN');
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: user.id, role: 'ADMIN', iss: 'resqnet-api', aud: 'resqnet-app' }),
    ).toString('base64url');
    await api().get('/api/admin/users').set('Authorization', `Bearer ${header}.${payload}.`).expect(401);
  });

  it('uses the database role, not the role claimed in the token', async () => {
    const { user } = await createUser('CIVILIAN');
    const escalated = jwt.sign({ role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, {
      subject: user.id,
      issuer: 'resqnet-api',
      audience: 'resqnet-app',
    });
    await api().get('/api/admin/users').set('Authorization', `Bearer ${escalated}`).expect(403);
  });

  it('treats injection-style input as plain data', async () => {
    const res = await api().get("/api/shelters?region=' OR 1=1; DROP TABLE shelters; --").expect(200);
    expect(res.body.shelters).toEqual([]);
    await api().get('/api/shelters').expect(200);
  });

  it('never leaks internals in error responses', async () => {
    const res = await api().post('/api/incidents').set('Content-Type', 'application/json').send('{"broken"').expect(400);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|SyntaxError|node_modules/i);
  });

  it('rejects request bodies over 100 kB', async () => {
    await api()
      .post('/api/incidents')
      .send({ description: 'x'.repeat(120_000) })
      .expect(413);
  });
});
