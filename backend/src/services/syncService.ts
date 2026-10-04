import {
  incidentCancelPayloadSchema,
  incidentCreateSchema,
  safetyStatusCreateSchema,
  syncBatchSchema,
  type SyncBatchResponse,
  type SyncOperationResult,
  type SyncStatusResponse,
} from '@resqnet/shared';
import type { z } from 'zod';
import { prisma } from '../models/prisma.js';
import { AppError, isUniqueViolation } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { cancelByReporter, createIncident } from './incidentService.js';
import { recordSafetyStatus } from './safetyStatusService.js';

type Batch = z.output<typeof syncBatchSchema>;
type Operation = Batch['operations'][number];

interface SyncContext {
  userId?: string;
}

/**
 * Applies a batch of operations that were queued on a device while offline.
 *
 * Duplicate protection is layered:
 *  1. `sync_logs.operation_id` UNIQUE — the same queued operation is applied once.
 *  2. Entity `client_id` UNIQUE — even a *different* operation that recreates the
 *     same entity (e.g. user tapped "send" twice) resolves to the original row.
 *
 * Operations are applied in order and independently: one bad operation is
 * REJECTED without blocking the rest of the queue.
 */
export async function processBatch(batch: Batch, ctx: SyncContext): Promise<SyncBatchResponse> {
  const results: SyncOperationResult[] = [];
  for (const op of batch.operations) {
    results.push(await processOperation(op, batch.deviceId, ctx));
  }
  return { results, serverTime: new Date().toISOString() };
}

async function processOperation(op: Operation, deviceId: string, ctx: SyncContext): Promise<SyncOperationResult> {
  const base = { operationId: op.operationId, entityType: op.entityType, entityId: op.entityId };

  const prior = await prisma.syncLog.findUnique({ where: { operationId: op.operationId } });
  if (prior) {
    return {
      ...base,
      status: prior.result === 'REJECTED' ? 'REJECTED' : 'DUPLICATE',
      serverId: prior.serverId ?? undefined,
      referenceCode: await referenceFor(op.entityType, prior.serverId),
      ...(prior.error ? { error: prior.error, retryable: false } : {}),
    };
  }

  let result: SyncOperationResult;
  try {
    result = { ...base, ...(await apply(op, deviceId, ctx)) };
  } catch (err) {
    if (err instanceof AppError && err.status < 500) {
      result = { ...base, status: 'REJECTED', error: err.message, retryable: false };
    } else {
      // Transient failure: do NOT record a sync log, so the device retries later.
      logger.error({ err, operationId: op.operationId }, 'Sync operation failed');
      return { ...base, status: 'REJECTED', error: 'Temporary server problem. Will retry.', retryable: true };
    }
  }

  try {
    await prisma.syncLog.create({
      data: {
        operationId: op.operationId,
        deviceId,
        userId: ctx.userId ?? null,
        entityType: op.entityType,
        entityId: op.entityId,
        operationType: op.operationType,
        result: result.status,
        serverId: result.serverId ?? null,
        error: result.error?.slice(0, 300) ?? null,
        retryCount: op.retryCount,
        queuedAt: new Date(op.createdAt),
      },
    });
  } catch (err) {
    // Two concurrent flushes of the same op: the entity layer already
    // de-duplicated, so report it as a duplicate.
    if (!isUniqueViolation(err)) throw err;
    if (result.status === 'APPLIED') result = { ...result, status: 'DUPLICATE' };
  }
  return result;
}

async function apply(
  op: Operation,
  deviceId: string,
  ctx: SyncContext,
): Promise<Omit<SyncOperationResult, 'operationId' | 'entityType' | 'entityId'>> {
  const reporter = { userId: ctx.userId, deviceId };

  if (op.entityType === 'INCIDENT' && op.operationType === 'CREATE') {
    const input = parseOrReject(incidentCreateSchema, op.payload);
    if (input.clientId !== op.entityId) throw new AppError(400, 'BAD_REQUEST', 'Operation does not match its report.');
    const { incident, created } = await createIncident(input, { ...reporter, source: 'SYNC' });
    return { status: created ? 'APPLIED' : 'DUPLICATE', serverId: incident.id, referenceCode: incident.referenceCode };
  }

  if (op.entityType === 'INCIDENT' && op.operationType === 'CANCEL') {
    const input = parseOrReject(incidentCancelPayloadSchema, op.payload);
    const r = await cancelByReporter(input.clientId, reporter, input.reason);
    return { status: r.alreadyCancelled ? 'DUPLICATE' : 'APPLIED', serverId: r.id, referenceCode: r.referenceCode };
  }

  if (op.entityType === 'SAFETY_STATUS' && op.operationType === 'CREATE') {
    const input = parseOrReject(safetyStatusCreateSchema, op.payload);
    const { status, created } = await recordSafetyStatus(input, reporter);
    return { status: created ? 'APPLIED' : 'DUPLICATE', serverId: status.id };
  }

  throw new AppError(400, 'UNSUPPORTED_OPERATION', 'This type of change cannot be synchronised.');
}

function parseOrReject<S extends z.ZodType>(schema: S, payload: unknown): z.output<S> {
  const r = schema.safeParse(payload);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new AppError(422, 'VALIDATION_FAILED', `Invalid data${first ? `: ${first.message}` : ''}`);
  }
  return r.data;
}

async function referenceFor(entityType: string, serverId: string | null): Promise<string | undefined> {
  if (entityType !== 'INCIDENT' || !serverId) return undefined;
  const row = await prisma.incident.findUnique({ where: { id: serverId }, select: { referenceCode: true } });
  return row?.referenceCode;
}

export async function syncStatus(deviceId: string | undefined): Promise<SyncStatusResponse> {
  if (!deviceId) {
    return { serverTime: new Date().toISOString(), deviceId: null, lastSyncAt: null, operationsReceived: 0 };
  }
  const [last, count] = await Promise.all([
    prisma.syncLog.findFirst({ where: { deviceId }, orderBy: { processedAt: 'desc' }, select: { processedAt: true } }),
    prisma.syncLog.count({ where: { deviceId } }),
  ]);
  return {
    serverTime: new Date().toISOString(),
    deviceId,
    lastSyncAt: last?.processedAt.toISOString() ?? null,
    operationsReceived: count,
  };
}
