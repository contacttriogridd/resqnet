import { describe, expect, it } from 'vitest';
import {
  assessPriority,
  compareIncidentsForTriage,
  distanceKm,
  incidentCreateSchema,
  registerSchema,
  syncBatchSchema,
  type IncidentCreateInput,
} from './index.js';

const validIncident = (): IncidentCreateInput => ({
  clientId: '7b0c6a1e-8d1f-4a52-9f3b-1c2d3e4f5a6b',
  type: 'FLOOD',
  severity: 'HIGH',
  peopleCount: 'TWO_TO_FIVE',
  specialRequirements: ['CHILD', 'CHILD', 'ELDERLY'],
  location: { latitude: 11.0168, longitude: 76.9558, source: 'GPS' },
  clientCreatedAt: '2026-10-04T10:00:00.000Z',
});

describe('incidentCreateSchema', () => {
  it('accepts a minimal valid request and de-duplicates requirements', () => {
    const parsed = incidentCreateSchema.parse(validIncident());
    expect(parsed.specialRequirements).toEqual(['CHILD', 'ELDERLY']);
  });

  it('accepts a manual text location without coordinates', () => {
    const input = { ...validIncident(), location: { text: 'Near Gandhipuram bus stand', source: 'MANUAL' as const } };
    expect(incidentCreateSchema.safeParse(input).success).toBe(true);
  });

  it('rejects a request with no usable location', () => {
    const input = { ...validIncident(), location: { text: '', source: 'MANUAL' as const } };
    const result = incidentCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects half a coordinate pair', () => {
    const input = { ...validIncident(), location: { latitude: 11, source: 'GPS' as const } };
    expect(incidentCreateSchema.safeParse(input).success).toBe(false);
  });

  it('rejects unknown emergency types and oversized descriptions', () => {
    expect(incidentCreateSchema.safeParse({ ...validIncident(), type: 'ALIENS' }).success).toBe(false);
    expect(
      incidentCreateSchema.safeParse({ ...validIncident(), description: 'x'.repeat(501) }).success,
    ).toBe(false);
  });

  it('requires a UUID idempotency key', () => {
    expect(incidentCreateSchema.safeParse({ ...validIncident(), clientId: '123' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('normalises email and defaults role to civilian', () => {
    const r = registerSchema.parse({ name: 'Asha', email: ' Asha@Example.COM ', password: 'long-enough-pw' });
    expect(r.email).toBe('asha@example.com');
    expect(r.role).toBe('CIVILIAN');
  });

  it('does not allow self-registration as admin or responder', () => {
    for (const role of ['ADMIN', 'RESPONDER']) {
      expect(
        registerSchema.safeParse({ name: 'X Y', email: 'x@y.io', password: 'long-enough-pw', role }).success,
      ).toBe(false);
    }
  });

  it('enforces a minimum password length', () => {
    expect(registerSchema.safeParse({ name: 'Asha', email: 'a@b.io', password: 'short' }).success).toBe(false);
  });
});

describe('syncBatchSchema', () => {
  it('caps batch size at 50 operations', () => {
    const op = {
      operationId: '7b0c6a1e-8d1f-4a52-9f3b-1c2d3e4f5a6b',
      entityType: 'INCIDENT',
      entityId: '7b0c6a1e-8d1f-4a52-9f3b-1c2d3e4f5a6b',
      operationType: 'CREATE',
      payload: {},
      createdAt: '2026-10-04T10:00:00.000Z',
    };
    const deviceId = '1b0c6a1e-8d1f-4a52-9f3b-1c2d3e4f5a6b';
    expect(syncBatchSchema.safeParse({ deviceId, operations: Array(50).fill(op) }).success).toBe(true);
    expect(syncBatchSchema.safeParse({ deviceId, operations: Array(51).fill(op) }).success).toBe(false);
  });
});

describe('assessPriority', () => {
  it('ranks a critical trapped group with vulnerable people as immediate', () => {
    const a = assessPriority({
      type: 'TRAPPED',
      severity: 'CRITICAL',
      peopleCount: 'SIX_TO_TEN',
      specialRequirements: ['CHILD', 'INJURED'],
    });
    expect(a.band).toBe('IMMEDIATE');
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.reasons.length).toBeGreaterThan(2);
  });

  it('ranks a low-severity single-person request as routine', () => {
    const a = assessPriority({ type: 'OTHER', severity: 'LOW', peopleCount: 'ONE', specialRequirements: [] });
    expect(a.band).toBe('ROUTINE');
    expect(a.score).toBe(5);
  });

  it('never exceeds 100', () => {
    const a = assessPriority({
      type: 'BUILDING_COLLAPSE',
      severity: 'CRITICAL',
      peopleCount: 'MORE_THAN_TEN',
      specialRequirements: ['CHILD', 'ELDERLY', 'PREGNANT', 'DISABLED', 'INJURED', 'MEDICAL', 'NO_FOOD', 'NO_WATER'],
    });
    expect(a.score).toBe(100);
  });
});

describe('compareIncidentsForTriage', () => {
  it('orders by severity, then score, then age', () => {
    const items = [
      { id: 'low', severity: 'LOW' as const, priorityScore: 90, createdAt: '2026-10-04T08:00:00Z' },
      { id: 'crit-new', severity: 'CRITICAL' as const, priorityScore: 70, createdAt: '2026-10-04T10:00:00Z' },
      { id: 'crit-old', severity: 'CRITICAL' as const, priorityScore: 70, createdAt: '2026-10-04T09:00:00Z' },
      { id: 'crit-hi', severity: 'CRITICAL' as const, priorityScore: 95, createdAt: '2026-10-04T11:00:00Z' },
      { id: 'high', severity: 'HIGH' as const, priorityScore: 50, createdAt: '2026-10-04T07:00:00Z' },
    ];
    expect(items.sort(compareIncidentsForTriage).map((i) => i.id)).toEqual([
      'crit-hi',
      'crit-old',
      'crit-new',
      'high',
      'low',
    ]);
  });
});

describe('distanceKm', () => {
  it('computes Coimbatore → Chennai at roughly 425 km', () => {
    const d = distanceKm({ latitude: 11.0168, longitude: 76.9558 }, { latitude: 13.0827, longitude: 80.2707 });
    expect(d).toBeGreaterThan(400);
    expect(d).toBeLessThan(450);
  });
});
