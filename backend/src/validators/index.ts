import { ROLES } from '@resqnet/shared';
import { z } from 'zod';

/**
 * Request schemas that only the API needs. Domain schemas (incidents,
 * shelters, …) live in @resqnet/shared so the frontend validates identically.
 */

export const clientIdsQuerySchema = z.object({
  clientIds: z
    .string()
    .max(4000)
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).max(100)),
});

export const cancelBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .max(280)
    .optional()
    .transform((v) => v || undefined),
});

export const guideParamSchema = z.object({
  idOrSlug: z.string().trim().min(2).max(60),
});

export const usersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  q: z.string().trim().max(100).optional(),
});

export const assignableQuerySchema = z.object({
  role: z.enum(['RESPONDER', 'VOLUNTEER']),
});

export const analyticsQuerySchema = z.object({
  includeDemo: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export const demoBodySchema = z.object({
  region: z.string().trim().min(2).max(120).default('Coimbatore'),
  count: z.number().int().min(1).max(25).default(5),
});
