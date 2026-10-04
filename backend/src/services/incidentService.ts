import type { Prisma } from '@prisma/client';
import {
  ACTIVE_INCIDENT_STATUSES,
  REPORTER_CANCELLABLE_STATUSES,
  VOLUNTEER_SETTABLE_STATUSES,
  assessPriority,
  canTransition,
  compareIncidentsForTriage,
  incidentListQuerySchema,
  incidentUpdateSchema,
  type IncidentCreate,
  type IncidentStatus,
  type Role,
} from '@resqnet/shared';
import type { z } from 'zod';
import {
  incidentInclude,
  incidentWithUpdatesInclude,
  toIncidentDTO,
  toReporterStatusDTO,
  type IncidentRow,
  type Viewer,
} from '../models/mappers.js';
import { prisma } from '../models/prisma.js';
import { AppError, badRequest, conflict, forbidden, isUniqueViolation, notFound } from '../utils/errors.js';
import { generateReferenceCode } from '../utils/tokens.js';
import { audit } from './auditService.js';

export interface ReporterContext {
  userId?: string;
  deviceId?: string;
}

export interface CreateContext extends ReporterContext {
  source: 'DIRECT' | 'SYNC';
  isDemo?: boolean;
}

export interface CreateResult {
  incident: IncidentRow;
  /** false when the clientId was already known (idempotent replay). */
  created: boolean;
}

/**
 * Idempotent incident creation keyed on the device-generated `clientId`.
 * Replaying the same submission (retries, duplicate tabs, background sync
 * racing the foreground) always returns the original incident.
 */
export async function createIncident(input: IncidentCreate, ctx: CreateContext): Promise<CreateResult> {
  const existing = await prisma.incident.findUnique({ where: { clientId: input.clientId }, include: incidentInclude });
  if (existing) return { incident: existing, created: false };

  const priority = assessPriority(input);
  const queuedOffline = ctx.source === 'SYNC';

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const incident = await prisma.incident.create({
        data: {
          clientId: input.clientId,
          referenceCode: generateReferenceCode(),
          reporterId: ctx.userId ?? null,
          deviceId: ctx.deviceId ?? input.deviceId ?? null,
          type: input.type,
          severity: input.severity,
          peopleCount: input.peopleCount,
          specialRequirements: input.specialRequirements,
          description: input.description ?? null,
          latitude: input.location.latitude ?? null,
          longitude: input.location.longitude ?? null,
          accuracyMeters: input.location.accuracyMeters ?? null,
          locationText: input.location.text ?? null,
          locationSource: input.location.source,
          contactPhone: input.contactPhone ?? null,
          status: 'RECEIVED',
          priorityScore: priority.score,
          priorityReasons: priority.reasons,
          clientCreatedAt: clampClientTime(input.clientCreatedAt),
          syncSource: ctx.source,
          isDemo: ctx.isDemo ?? false,
          updates: {
            create: {
              status: 'RECEIVED',
              note: queuedOffline
                ? 'Request received (it was saved on the device while offline and sent automatically).'
                : 'Request received.',
            },
          },
        },
        include: incidentInclude,
      });
      return { incident, created: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Either the clientId raced with a concurrent submission, or the
      // reference code collided. Check which, and retry only for the latter.
      const raced = await prisma.incident.findUnique({ where: { clientId: input.clientId }, include: incidentInclude });
      if (raced) return { incident: raced, created: false };
    }
  }
  throw new AppError(503, 'TRY_AGAIN', 'We could not save your request just now. It will be retried automatically.');
}

/**
 * Device clocks can be wrong. Keep the reported time (useful for triage) but
 * never let it be in the future or absurdly old.
 */
function clampClientTime(iso: string): Date {
  const t = new Date(iso).getTime();
  const now = Date.now();
  if (Number.isNaN(t) || t > now) return new Date(now);
  const thirtyDays = 30 * 86_400_000;
  return new Date(Math.max(t, now - thirtyDays));
}

type ListQuery = z.output<typeof incidentListQuerySchema>;

export async function listIncidents(query: ListQuery, viewer: Viewer) {
  const where: Prisma.IncidentWhereInput = {};

  if (viewer.role === 'VOLUNTEER') {
    // Volunteers see open tasks and their own; not other volunteers' tasks.
    where.status = { in: [...ACTIVE_INCIDENT_STATUSES] };
    where.OR = [{ assignedVolunteerId: null }, { assignedVolunteerId: viewer.userId }];
    if (query.assigned === 'me') where.assignedVolunteerId = viewer.userId;
    if (query.assigned === 'unassigned') where.assignedVolunteerId = null;
  } else {
    if (query.status) where.status = { in: query.status };
    if (query.assigned === 'me') where.assignedResponderId = viewer.userId;
    if (query.assigned === 'unassigned') where.assignedResponderId = null;
  }
  if (query.severity) where.severity = query.severity;
  if (query.type) where.type = query.type;
  if (!query.includeDemo) where.isDemo = false;

  const rows = await prisma.incident.findMany({
    where,
    include: incidentInclude,
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });
  return rows.sort(compareIncidentsForTriage).map((r) => toIncidentDTO(r, viewer));
}

export async function getIncident(id: string, viewer: Viewer) {
  const row = await prisma.incident.findUnique({ where: { id }, include: incidentWithUpdatesInclude });
  if (!row) throw notFound('Incident');
  assertCanView(row, viewer);
  return toIncidentDTO(row, viewer);
}

function assertCanView(row: IncidentRow, viewer: Viewer) {
  if (viewer.role === 'RESPONDER' || viewer.role === 'ADMIN') return;
  if (row.reporterId === viewer.userId) return;
  if (viewer.role === 'VOLUNTEER') {
    const open = ACTIVE_INCIDENT_STATUSES.includes(row.status) && !row.assignedVolunteerId;
    if (open || row.assignedVolunteerId === viewer.userId) return;
  }
  // 404 rather than 403 so IDs of other people's reports can't be probed.
  throw notFound('Incident');
}

type UpdateInput = z.output<typeof incidentUpdateSchema>;

export async function updateIncident(id: string, input: UpdateInput, actor: Viewer, ip?: string) {
  const row = await prisma.incident.findUnique({ where: { id } });
  if (!row) throw notFound('Incident');

  if (actor.role === 'VOLUNTEER') {
    if (row.assignedVolunteerId !== actor.userId) throw forbidden('Accept this task before updating it.');
    if (input.severity || input.assignedResponderId !== undefined || input.assignedVolunteerId !== undefined) {
      throw forbidden('Volunteers can only update the status of their own tasks.');
    }
    if (input.status && !VOLUNTEER_SETTABLE_STATUSES.includes(input.status)) {
      throw forbidden('Volunteers can mark tasks as in progress or resolved.');
    }
  } else if (actor.role !== 'RESPONDER' && actor.role !== 'ADMIN') {
    throw forbidden();
  }

  const data: Prisma.IncidentUncheckedUpdateInput = {};
  let nextStatus: IncidentStatus | undefined = input.status;

  if (input.assignedResponderId !== undefined) {
    if (input.assignedResponderId) await assertUserHasRole(input.assignedResponderId, ['RESPONDER', 'ADMIN']);
    data.assignedResponderId = input.assignedResponderId;
    if (input.assignedResponderId && !row.assignedAt) data.assignedAt = new Date();
    if (input.assignedResponderId && !nextStatus && (row.status === 'RECEIVED' || row.status === 'VERIFIED')) {
      nextStatus = 'ASSIGNED';
    }
  }
  if (input.assignedVolunteerId !== undefined) {
    if (input.assignedVolunteerId) await assertUserHasRole(input.assignedVolunteerId, ['VOLUNTEER']);
    data.assignedVolunteerId = input.assignedVolunteerId;
    if (input.assignedVolunteerId && !row.assignedAt) data.assignedAt = new Date();
  }
  if (input.severity && input.severity !== row.severity) {
    data.severity = input.severity;
    data.priorityScore = assessPriority({
      type: row.type,
      severity: input.severity,
      peopleCount: row.peopleCount,
      specialRequirements: row.specialRequirements as never,
    }).score;
  }
  if (nextStatus && nextStatus !== row.status) {
    if (!canTransition(row.status, nextStatus)) {
      throw badRequest(`An incident that is ${row.status.toLowerCase()} cannot be marked ${nextStatus.toLowerCase()}.`);
    }
    data.status = nextStatus;
    if (nextStatus === 'RESOLVED') data.resolvedAt = new Date();
    if (nextStatus === 'IN_PROGRESS' && row.status === 'RESOLVED') data.resolvedAt = null;
  }

  const statusChanged = data.status !== undefined;
  if (!statusChanged && Object.keys(data).length === 0 && !input.note) throw badRequest('Nothing to update.');

  const updated = await prisma.incident.update({
    where: { id },
    data: {
      ...data,
      updates: {
        create: {
          authorId: actor.userId,
          status: statusChanged ? (data.status as IncidentStatus) : null,
          note: input.note ?? describeChange(input),
        },
      },
    },
    include: incidentWithUpdatesInclude,
  });

  await audit({
    actorId: actor.userId,
    action: 'INCIDENT_UPDATED',
    entityType: 'Incident',
    entityId: id,
    metadata: { from: row.status, to: updated.status, fields: Object.keys(data) },
    ipAddress: ip,
  });
  return toIncidentDTO(updated, actor);
}

function describeChange(input: UpdateInput): string | null {
  if (input.assignedResponderId) return 'Responder assigned.';
  if (input.assignedResponderId === null) return 'Responder unassigned.';
  if (input.assignedVolunteerId) return 'Volunteer assigned.';
  if (input.severity) return `Severity changed to ${input.severity.toLowerCase()}.`;
  return null;
}

async function assertUserHasRole(userId: string, roles: Role[]) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!u || !u.isActive || !roles.includes(u.role)) throw badRequest('That person cannot be assigned to this incident.');
}

/**
 * "Accept" claims an incident for the caller. The conditional updateMany
 * makes the claim atomic, so two people can't accept the same task at once.
 */
export async function acceptIncident(id: string, actor: Viewer, ip?: string) {
  const row = await prisma.incident.findUnique({ where: { id } });
  if (!row) throw notFound('Incident');
  if (!ACTIVE_INCIDENT_STATUSES.includes(row.status)) throw conflict('This incident is no longer active.');

  const now = new Date();
  if (actor.role === 'VOLUNTEER') {
    const claimed = await prisma.incident.updateMany({
      where: { id, assignedVolunteerId: null, status: { in: [...ACTIVE_INCIDENT_STATUSES] } },
      data: { assignedVolunteerId: actor.userId, assignedAt: row.assignedAt ?? now },
    });
    if (claimed.count === 0 && row.assignedVolunteerId !== actor.userId) {
      throw conflict('Another volunteer has already accepted this task.');
    }
  } else {
    const where: Prisma.IncidentWhereInput = { id };
    if (actor.role !== 'ADMIN') where.OR = [{ assignedResponderId: null }, { assignedResponderId: actor.userId }];
    const claimed = await prisma.incident.updateMany({
      where,
      data: {
        assignedResponderId: actor.userId,
        assignedAt: row.assignedAt ?? now,
        ...(row.status === 'RECEIVED' || row.status === 'VERIFIED' ? { status: 'ASSIGNED' as const } : {}),
      },
    });
    if (claimed.count === 0) throw conflict('Another responder is already handling this incident.');
  }

  await prisma.incidentUpdate.create({
    data: {
      incidentId: id,
      authorId: actor.userId,
      status: actor.role !== 'VOLUNTEER' && (row.status === 'RECEIVED' || row.status === 'VERIFIED') ? 'ASSIGNED' : null,
      note: actor.role === 'VOLUNTEER' ? 'Volunteer accepted this task.' : 'Responder accepted this incident.',
    },
  });
  await audit({ actorId: actor.userId, action: 'INCIDENT_ACCEPTED', entityType: 'Incident', entityId: id, ipAddress: ip });
  return getIncident(id, actor);
}

export async function addNote(id: string, note: string, actor: Viewer) {
  const row = await prisma.incident.findUnique({ where: { id } });
  if (!row) throw notFound('Incident');
  if (actor.role === 'VOLUNTEER' && row.assignedVolunteerId !== actor.userId) {
    throw forbidden('Accept this task before adding notes.');
  }
  await prisma.$transaction([
    prisma.incidentUpdate.create({ data: { incidentId: id, authorId: actor.userId, note } }),
    prisma.incident.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);
  return getIncident(id, actor);
}

/** Lets the person who reported an incident withdraw it (e.g. "we are safe now"). */
export async function cancelByReporter(clientId: string, ctx: ReporterContext, reason?: string) {
  const row = await prisma.incident.findUnique({ where: { clientId } });
  if (!row) throw notFound('Report');
  const owns = (ctx.userId && row.reporterId === ctx.userId) || (ctx.deviceId && row.deviceId === ctx.deviceId);
  if (!owns) throw notFound('Report');
  if (row.status === 'CANCELLED') return { id: row.id, referenceCode: row.referenceCode, alreadyCancelled: true };
  if (!REPORTER_CANCELLABLE_STATUSES.includes(row.status)) {
    throw conflict('This request has already been resolved.');
  }
  await prisma.incident.update({
    where: { id: row.id },
    data: {
      status: 'CANCELLED',
      updates: {
        create: { authorId: ctx.userId ?? null, status: 'CANCELLED', note: reason ? `Cancelled by reporter: ${reason}` : 'Cancelled by reporter.' },
      },
    },
  });
  return { id: row.id, referenceCode: row.referenceCode, alreadyCancelled: false };
}

/** Status lookup for a reporter's own submissions (by clientId). */
export async function reporterStatuses(clientIds: string[], ctx: ReporterContext) {
  const owner: Prisma.IncidentWhereInput[] = [];
  if (ctx.userId) owner.push({ reporterId: ctx.userId });
  if (ctx.deviceId) owner.push({ deviceId: ctx.deviceId });
  if (owner.length === 0 || clientIds.length === 0) return [];
  const rows = await prisma.incident.findMany({
    where: { clientId: { in: clientIds.slice(0, 100) }, OR: owner },
    include: { updates: { where: { note: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { note: true } } },
  });
  return rows.map(toReporterStatusDTO);
}
