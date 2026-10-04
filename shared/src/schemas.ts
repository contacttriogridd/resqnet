import { z } from 'zod';
import {
  ALERT_SEVERITIES,
  CONTACT_SERVICES,
  FACILITIES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  LOCATION_SOURCES,
  PEOPLE_COUNTS,
  ROLES,
  SAFETY_STATES,
  SEVERITIES,
  SHELTER_STATUSES,
  SPECIAL_REQUIREMENTS,
  SYNC_ENTITY_TYPES,
  SYNC_OPERATION_TYPES,
} from './enums.js';

/**
 * Validation schemas shared by the browser (forms, offline queue) and the API.
 * The server always re-validates — client validation is a usability aid only.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === '' ? undefined : v));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{3,20}$/, 'Enter a valid phone number');

/** Normalise (trim + lowercase) BEFORE validating, so pasted addresses with spaces are accepted. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254, 'Email is too long'));

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/* ───────────────────────── Auth ───────────────────────── */

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters');

export const registerSchema = z.object({
  name: trimmed(80).min(2, 'Enter your name'),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  /** Self-registration may only choose civilian or volunteer. */
  role: z.enum(['CIVILIAN', 'VOLUNTEER']).default('CIVILIAN'),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/* ───────────────────────── Incidents ───────────────────────── */

export const incidentLocationSchema = z
  .object({
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    accuracyMeters: z.number().nonnegative().max(100_000).optional(),
    text: optionalText(200),
    source: z.enum(LOCATION_SOURCES),
  })
  .refine((l) => (l.latitude === undefined) === (l.longitude === undefined), {
    message: 'Latitude and longitude must be provided together',
  })
  .refine((l) => l.latitude !== undefined || (l.text !== undefined && l.text.length >= 3), {
    message: 'Share your GPS location or describe where you are',
    path: ['text'],
  });

export const incidentCreateSchema = z.object({
  /** Client-generated UUID. Doubles as the idempotency key for offline replays. */
  clientId: z.uuid(),
  deviceId: z.uuid().optional(),
  type: z.enum(INCIDENT_TYPES),
  severity: z.enum(SEVERITIES),
  peopleCount: z.enum(PEOPLE_COUNTS),
  specialRequirements: z
    .array(z.enum(SPECIAL_REQUIREMENTS))
    .max(SPECIAL_REQUIREMENTS.length)
    .default([])
    .transform((arr) => [...new Set(arr)]),
  location: incidentLocationSchema,
  description: optionalText(500),
  contactPhone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  /** When the person pressed "send" on their device (may be long before sync). */
  clientCreatedAt: z.iso.datetime({ offset: true }),
});
export type IncidentCreateInput = z.input<typeof incidentCreateSchema>;
export type IncidentCreate = z.output<typeof incidentCreateSchema>;

export const incidentUpdateSchema = z
  .object({
    status: z.enum(INCIDENT_STATUSES).exclude(['PENDING']).optional(),
    severity: z.enum(SEVERITIES).optional(),
    assignedResponderId: z.uuid().nullable().optional(),
    assignedVolunteerId: z.uuid().nullable().optional(),
    note: optionalText(1000),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Nothing to update',
  });
export type IncidentUpdateInput = z.input<typeof incidentUpdateSchema>;

export const incidentNoteSchema = z.object({ note: trimmed(1000).min(1, 'Write a note') });

export const incidentListQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : undefined))
    .pipe(z.array(z.enum(INCIDENT_STATUSES)).optional()),
  severity: z.enum(SEVERITIES).optional(),
  type: z.enum(INCIDENT_TYPES).optional(),
  assigned: z.enum(['me', 'unassigned', 'any']).default('any'),
  includeDemo: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/* ───────────────────────── Safety status ───────────────────────── */

export const safetyStatusCreateSchema = z.object({
  clientId: z.uuid(),
  deviceId: z.uuid().optional(),
  status: z.enum(SAFETY_STATES),
  note: optionalText(280),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  clientCreatedAt: z.iso.datetime({ offset: true }),
});
export type SafetyStatusCreateInput = z.input<typeof safetyStatusCreateSchema>;

/* ───────────────────────── Sync ───────────────────────── */

export const syncOperationSchema = z.object({
  operationId: z.uuid(),
  entityType: z.enum(SYNC_ENTITY_TYPES),
  entityId: z.uuid(),
  operationType: z.enum(SYNC_OPERATION_TYPES),
  payload: z.unknown(),
  createdAt: z.iso.datetime({ offset: true }),
  retryCount: z.number().int().nonnegative().default(0),
});
export type SyncOperationInput = z.input<typeof syncOperationSchema>;

export const syncBatchSchema = z.object({
  deviceId: z.uuid(),
  operations: z.array(syncOperationSchema).min(1).max(50),
});
export type SyncBatchInput = z.input<typeof syncBatchSchema>;

export const incidentCancelPayloadSchema = z.object({
  clientId: z.uuid(),
  reason: optionalText(280),
});

/* ───────────────────────── Alerts ───────────────────────── */

export const alertCreateSchema = z
  .object({
    title: trimmed(120).min(3),
    disasterTypeCode: trimmed(40).min(2),
    severity: z.enum(ALERT_SEVERITIES),
    region: trimmed(120).min(2),
    message: trimmed(1000).min(5),
    instruction: trimmed(1000).min(5),
    startsAt: z.iso.datetime({ offset: true }).optional(),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .refine((a) => !a.startsAt || new Date(a.expiresAt) > new Date(a.startsAt), {
    message: 'Expiry must be after the start time',
    path: ['expiresAt'],
  });
export type AlertCreateInput = z.input<typeof alertCreateSchema>;

export const alertUpdateSchema = z.object({
  title: trimmed(120).min(3).optional(),
  severity: z.enum(ALERT_SEVERITIES).optional(),
  region: trimmed(120).min(2).optional(),
  message: trimmed(1000).min(5).optional(),
  instruction: trimmed(1000).min(5).optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  isActive: z.boolean().optional(),
});

/* ───────────────────────── Shelters ───────────────────────── */

export const shelterCreateSchema = z
  .object({
    name: trimmed(120).min(2),
    address: trimmed(300).min(5),
    region: trimmed(120).min(2),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    capacity: z.number().int().min(1).max(100_000),
    occupancy: z.number().int().min(0).max(100_000).default(0),
    facilities: z
      .array(z.enum(FACILITIES))
      .default([])
      .transform((arr) => [...new Set(arr)]),
    contactPhone: phoneSchema.optional(),
    accessibilityInfo: optionalText(500),
    status: z.enum(SHELTER_STATUSES).default('OPEN'),
  })
  .refine((s) => s.occupancy <= s.capacity * 1.5, {
    message: 'Occupancy looks wrong for this capacity',
    path: ['occupancy'],
  });
export type ShelterCreateInput = z.input<typeof shelterCreateSchema>;

export const shelterUpdateSchema = z.object({
  name: trimmed(120).min(2).optional(),
  address: trimmed(300).min(5).optional(),
  region: trimmed(120).min(2).optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  capacity: z.number().int().min(1).max(100_000).optional(),
  occupancy: z.number().int().min(0).max(100_000).optional(),
  facilities: z.array(z.enum(FACILITIES)).optional(),
  contactPhone: phoneSchema.nullable().optional(),
  accessibilityInfo: z.string().trim().max(500).nullable().optional(),
  status: z.enum(SHELTER_STATUSES).optional(),
});

/* ───────────────────────── Emergency contacts ───────────────────────── */

export const contactCreateSchema = z.object({
  name: trimmed(120).min(2),
  service: z.enum(CONTACT_SERVICES),
  phone: phoneSchema,
  region: optionalText(120),
  description: optionalText(300),
  available24x7: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(100),
});
export type ContactCreateInput = z.input<typeof contactCreateSchema>;
export const contactUpdateSchema = contactCreateSchema.partial();

/* ───────────────────────── Safety guides ───────────────────────── */

export const guideSectionSchema = z.object({
  title: trimmed(120).min(2),
  items: z.array(trimmed(400).min(2)).min(1).max(30),
});

export const guideCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,60}$/, 'Use lowercase letters, numbers and dashes'),
  title: trimmed(120).min(2),
  disasterTypeCode: trimmed(40).min(2),
  summary: trimmed(400).min(5),
  sections: z.array(guideSectionSchema).min(1).max(12),
  sortOrder: z.number().int().min(0).max(1000).default(100),
});
export type GuideCreateInput = z.input<typeof guideCreateSchema>;
export type GuideSection = z.infer<typeof guideSectionSchema>;
export const guideUpdateSchema = guideCreateSchema.partial();

/* ───────────────────────── Disaster types ───────────────────────── */

export const disasterTypeCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z_]{2,40}$/, 'Use capital letters and underscores'),
  name: trimmed(80).min(2),
  description: optionalText(300),
});
export const disasterTypeUpdateSchema = disasterTypeCreateSchema.omit({ code: true }).partial();

/* ───────────────────────── Users (admin) ───────────────────────── */

export const userAdminUpdateSchema = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const adminCreateUserSchema = z.object({
  name: trimmed(80).min(2),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  role: z.enum(ROLES),
});

/* ───────────────────────── Common ───────────────────────── */

export const uuidParamSchema = z.object({ id: z.uuid('Invalid identifier') });

export const regionQuerySchema = z.object({
  region: z.string().trim().max(120).optional(),
});
