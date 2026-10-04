import { ACTIVE_INCIDENT_STATUSES, distanceKm, type AnalyticsDTO, type CountByKey } from '@resqnet/shared';
import { prisma } from '../models/prisma.js';
import { activeAlertWhere } from './alertService.js';

const DAY_MS = 86_400_000;

/**
 * Operational overview for administrators. Demo data is excluded unless
 * explicitly requested, so simulations never distort real figures.
 */
export async function getAnalytics(opts: { includeDemo: boolean; days?: number }): Promise<AnalyticsDTO> {
  const days = opts.days ?? 14;
  const since = new Date(Date.now() - days * DAY_MS);
  const demo = opts.includeDemo ? {} : { isDemo: false };

  const [
    users,
    volunteers,
    responders,
    activeIncidents,
    criticalIncidents,
    resolvedIncidents,
    shelters,
    activeAlerts,
    pendingSafetyChecks,
    byType,
    bySeverity,
    byStatus,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, role: 'VOLUNTEER' } }),
    prisma.user.count({ where: { isActive: true, role: 'RESPONDER' } }),
    prisma.incident.count({ where: { ...demo, status: { in: [...ACTIVE_INCIDENT_STATUSES] } } }),
    prisma.incident.count({ where: { ...demo, severity: 'CRITICAL', status: { in: [...ACTIVE_INCIDENT_STATUSES] } } }),
    prisma.incident.count({ where: { ...demo, status: 'RESOLVED' } }),
    prisma.shelter.count({ where: { isActive: true } }),
    prisma.alert.count({ where: { ...activeAlertWhere(), ...demo } }),
    prisma.userSafetyStatus.count({
      where: { status: { in: ['NEED_ASSISTANCE', 'EMERGENCY'] }, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    }),
    prisma.incident.groupBy({ by: ['type'], where: { ...demo, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.incident.groupBy({ by: ['severity'], where: { ...demo, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.incident.groupBy({ by: ['status'], where: { ...demo, createdAt: { gte: since } }, _count: { _all: true } }),
  ]);

  const toCounts = <K extends string>(rows: ({ _count: { _all: number } } & Record<K, string>)[], key: K): CountByKey[] =>
    rows.map((r) => ({ key: r[key], count: r._count._all })).sort((a, b) => b.count - a.count);

  return {
    totals: {
      users,
      volunteers,
      responders,
      activeIncidents,
      criticalIncidents,
      resolvedIncidents,
      shelters,
      activeAlerts,
      pendingSafetyChecks,
    },
    incidentsByType: toCounts(byType, 'type'),
    incidentsBySeverity: toCounts(bySeverity, 'severity'),
    incidentsByStatus: toCounts(byStatus, 'status'),
    incidentsByLocation: await incidentsByLocation(since, opts.includeDemo),
    dailyVolume: await dailyVolume(since, days, opts.includeDemo),
    responseTime: await responseTimes(since, opts.includeDemo),
    generatedAt: new Date().toISOString(),
  };
}

async function dailyVolume(since: Date, days: number, includeDemo: boolean) {
  const rows = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*) AS count
    FROM incidents
    WHERE created_at >= ${since} AND (${includeDemo} OR is_demo = false)
    GROUP BY 1 ORDER BY 1`;
  // Buckets are UTC days regardless of the database session time zone.
  const byDay = new Map(rows.map((r) => [r.day, Number(r.count)]));
  const out: { date: string; count: number }[] = [];
  const start = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
  for (let i = 0; i <= days; i++) {
    const d = new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    out.push({ date: d, count: byDay.get(d) ?? 0 });
  }
  return out.slice(-days);
}

async function responseTimes(since: Date, includeDemo: boolean) {
  const [row] = await prisma.$queryRaw<{ assign: number | null; resolve: number | null; n: bigint }[]>`
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (assigned_at - created_at)) / 60)
        FILTER (WHERE assigned_at IS NOT NULL) AS assign,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)
        FILTER (WHERE resolved_at IS NOT NULL) AS resolve,
      count(*) FILTER (WHERE assigned_at IS NOT NULL OR resolved_at IS NOT NULL) AS n
    FROM incidents
    WHERE created_at >= ${since} AND (${includeDemo} OR is_demo = false)`;
  const round = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(Number(v)));
  return {
    medianMinutesToAssign: round(row?.assign),
    medianMinutesToResolve: round(row?.resolve),
    sampleSize: Number(row?.n ?? 0),
  };
}

/**
 * Groups incidents by the region of the nearest shelter (within 50 km);
 * coordinates themselves are never exposed in analytics.
 */
async function incidentsByLocation(since: Date, includeDemo: boolean): Promise<CountByKey[]> {
  const [incidents, shelters] = await Promise.all([
    prisma.incident.findMany({
      where: { createdAt: { gte: since }, ...(includeDemo ? {} : { isDemo: false }) },
      select: { latitude: true, longitude: true },
      take: 5000,
    }),
    prisma.shelter.findMany({ where: { isActive: true }, select: { latitude: true, longitude: true, region: true } }),
  ]);
  const counts = new Map<string, number>();
  for (const i of incidents) {
    let label = 'Location described in text';
    if (i.latitude !== null && i.longitude !== null) {
      label = 'Outside known regions';
      let best = 50;
      for (const s of shelters) {
        const d = distanceKm({ latitude: i.latitude, longitude: i.longitude }, s);
        if (d < best) {
          best = d;
          label = s.region;
        }
      }
    }
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}
