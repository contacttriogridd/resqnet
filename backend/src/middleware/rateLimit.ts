import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env.js';

const message = (msg: string) => ({ error: { code: 'RATE_LIMITED', message: msg } });

/**
 * Emergency traffic often arrives from many people behind one carrier-grade
 * NAT IP, so emergency endpoints are keyed by device + IP and kept generous;
 * credential endpoints are keyed by IP and kept strict.
 */
const deviceAndIp = (req: Request) => `${req.get('x-device-id') ?? 'anon'}|${ipKeyGenerator(req.ip ?? '')}`;

const common = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  skip: () => isTest,
};

/** Baseline for the whole API. */
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60_000,
  limit: 600,
  message: message('Too many requests. Please wait a moment and try again.'),
});

/** Login / register: brute-force protection. */
export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60_000,
  limit: 20,
  message: message('Too many sign-in attempts. Please wait 15 minutes and try again.'),
});

/** Incident submission and sync replay. */
export const emergencyWriteLimiter = rateLimit({
  ...common,
  windowMs: 10 * 60_000,
  limit: 120,
  keyGenerator: deviceAndIp,
  message: message('Too many reports from this device. If this is an emergency, call 112.'),
});
