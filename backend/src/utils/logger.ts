import pino from 'pino';
import { env, isProduction, isTest } from '../config/env.js';

/**
 * Structured JSON logs in production; pretty logs in development.
 * Credentials, tokens and precise reporter contact details are redacted.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.accessToken',
      '*.refreshToken',
      '*.contactPhone',
    ],
    censor: '[redacted]',
  },
  ...(isProduction || isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
});
