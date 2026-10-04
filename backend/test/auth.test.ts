import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_PASSWORD, api, createUser, prisma, resetDb } from './helpers.js';

const CSRF = { 'X-Requested-With': 'resqnet' };

function refreshCookie(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers['set-cookie'] as string[] | undefined;
  const c = cookies?.find((x) => x.startsWith('resqnet_rt='));
  if (!c) throw new Error('No refresh cookie set');
  return c.split(';')[0]!;
}

describe('authentication', () => {
  beforeEach(resetDb);

  it('registers a civilian, hashes the password with argon2id and sets a secure refresh cookie', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Asha Kumar', email: 'Asha@Example.com', password: 'a-long-password' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email: 'asha@example.com', role: 'CIVILIAN' });
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'asha@example.com' } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain('a-long-password');
  });

  it('creates a volunteer profile when registering as a volunteer', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Vel Murugan', email: 'vel@example.com', password: 'a-long-password', role: 'VOLUNTEER' })
      .expect(201);
    expect(await prisma.volunteer.count({ where: { userId: res.body.user.id } })).toBe(1);
  });

  it('refuses self-registration as responder or admin', async () => {
    for (const role of ['RESPONDER', 'ADMIN']) {
      await api()
        .post('/api/auth/register')
        .send({ name: 'Mallory', email: `m-${role}@example.com`, password: 'a-long-password', role })
        .expect(422);
    }
  });

  it('rejects duplicate emails with 409', async () => {
    const body = { name: 'Asha', email: 'dup@example.com', password: 'a-long-password' };
    await api().post('/api/auth/register').send(body).expect(201);
    const res = await api().post('/api/auth/register').send(body).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const { user } = await createUser('CIVILIAN');
    const a = await api().post('/api/auth/login').send({ email: user.email, password: 'wrong-password' }).expect(401);
    const b = await api().post('/api/auth/login').send({ email: 'nobody@x.io', password: 'wrong-password' }).expect(401);
    expect(a.body).toEqual(b.body);
  });

  it('logs in and returns the profile from /me', async () => {
    const { user } = await createUser('RESPONDER');
    const login = await api().post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD }).expect(200);
    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
    expect(me.body.user).toMatchObject({ id: user.id, role: 'RESPONDER' });
  });

  it('blocks disabled accounts at login and on existing tokens', async () => {
    const { user, auth } = await createUser('CIVILIAN');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await api().post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD }).expect(403);
    // Note: the auth middleware caches account state for 30 s; a fresh id is never cached.
    const res = await api().get('/api/auth/me').set(auth).expect(401);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rotates refresh tokens and detects reuse of an old token', async () => {
    const { user } = await createUser('CIVILIAN');
    const login = await api().post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD }).expect(200);
    const first = refreshCookie(login);

    const r1 = await api().post('/api/auth/refresh').set('Cookie', first).set(CSRF).expect(200);
    const second = refreshCookie(r1);
    expect(second).not.toEqual(first);

    // Replaying the first (already rotated) token is treated as theft…
    await api().post('/api/auth/refresh').set('Cookie', first).set(CSRF).expect(401);
    // …and revokes the whole family, including the newest token.
    await api().post('/api/auth/refresh').set('Cookie', second).set(CSRF).expect(401);
  });

  it('requires the anti-CSRF header on cookie-authenticated endpoints', async () => {
    const { user } = await createUser('CIVILIAN');
    const login = await api().post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    await api().post('/api/auth/refresh').set('Cookie', refreshCookie(login)).expect(403);
    await api()
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie(login))
      .set(CSRF)
      .set('Origin', 'https://evil.example')
      .expect(403);
  });

  it('revokes the session on logout', async () => {
    const { user } = await createUser('CIVILIAN');
    const login = await api().post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    const cookie = refreshCookie(login);
    await api().post('/api/auth/logout').set('Cookie', cookie).set(CSRF).expect(204);
    await api().post('/api/auth/refresh').set('Cookie', cookie).set(CSRF).expect(401);
  });
});
