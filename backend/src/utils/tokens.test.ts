import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from './password.js';
import { generateReferenceCode, generateRefreshToken, hashToken, signAccessToken, verifyAccessToken } from './tokens.js';

describe('access tokens', () => {
  it('round-trips claims', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'RESPONDER' });
    expect(verifyAccessToken(token)).toEqual({ sub: 'user-1', role: 'RESPONDER' });
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CIVILIAN' });
    const [h, p, s] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(p!, 'base64url').toString()), role: 'ADMIN' }),
    ).toString('base64url');
    expect(() => verifyAccessToken(`${h}.${forgedPayload}.${s}`)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('are random, high-entropy and stored only as a hash', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
  });
});

describe('reference codes', () => {
  it('avoid look-alike characters', () => {
    for (let i = 0; i < 200; i++) expect(generateReferenceCode()).toMatch(/^RQ-[2-9A-HJ-KMNP-Z]{6}$/);
  });
});

describe('password hashing', () => {
  it('uses argon2id and verifies correctly', async () => {
    const hash = await hashPassword('emergency-password');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'emergency-password')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});
