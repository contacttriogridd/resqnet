import { createHash, randomBytes, randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@resqnet/shared';
import { durationToSeconds, env } from '../config/env.js';

const ISSUER = 'resqnet-api';
const AUDIENCE = 'resqnet-app';

export interface AccessTokenClaims {
  sub: string;
  role: Role;
}

export const ACCESS_TOKEN_TTL_SECONDS = durationToSeconds(env.JWT_ACCESS_TTL);

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign({ role: claims.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

/** Throws on any invalid/expired token. Algorithm is pinned to prevent alg-confusion. */
export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload === 'string' || !payload.sub || typeof payload.role !== 'string') {
    throw new Error('Malformed token');
  }
  return { sub: payload.sub, role: payload.role as Role };
}

/**
 * Refresh tokens are opaque random strings (not JWTs). Only their SHA-256
 * digest is stored, so a database leak does not yield usable tokens.
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

/** Crockford-style alphabet without look-alike characters (no 0/O, 1/I/L). */
const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Short code that can be read aloud over a phone call, e.g. "RQ-7K3M9P". */
export function generateReferenceCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `RQ-${code}`;
}
