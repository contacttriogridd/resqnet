import type { Role } from '@resqnet/shared';

declare global {
  namespace Express {
    interface Request {
      /** Present when a valid access token was supplied. */
      auth?: { userId: string; role: Role; name: string };
      /** Random per-install identifier sent by the PWA in `X-Device-Id`. */
      deviceId?: string;
      /** Output of the `validate` middleware (parsed, coerced, trimmed). */
      validated: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
