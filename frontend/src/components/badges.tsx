import {
  ALERT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  PRIORITY_BAND_LABELS,
  SAFETY_STATE_LABELS,
  SEVERITY_LABELS,
  SHELTER_STATUS_LABELS,
  type AlertSeverity,
  type IncidentStatus,
  type PriorityBand,
  type SafetyState,
  type Severity,
  type ShelterStatus,
} from '@resqnet/shared';
import {
  AlertOctagon,
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDot,
  CircleHelp,
  Clock,
  CloudOff,
  FlaskConical,
  Info,
  Loader2,
  ShieldCheck,
  Siren,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { LocalSyncStatus } from '../types/local';
import { Badge, type Tone } from './ui';

export const SEVERITY_TONE: Record<Severity, Tone> = {
  CRITICAL: 'critical',
  HIGH: 'warning',
  MEDIUM: 'advisory',
  LOW: 'neutral',
};
const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  CRITICAL: AlertOctagon,
  HIGH: AlertTriangle,
  MEDIUM: CircleDot,
  LOW: Info,
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} icon={SEVERITY_ICON[severity]}>
      {SEVERITY_LABELS[severity].toUpperCase()}
    </Badge>
  );
}

export const ALERT_TONE: Record<AlertSeverity, Tone> = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  ADVISORY: 'advisory',
  INFO: 'info',
};
export const ALERT_ICON: Record<AlertSeverity, LucideIcon> = {
  CRITICAL: Siren,
  WARNING: AlertTriangle,
  ADVISORY: AlertTriangle,
  INFO: Info,
};

export function AlertSeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <Badge tone={ALERT_TONE[severity]} icon={ALERT_ICON[severity]}>
      {ALERT_SEVERITY_LABELS[severity].toUpperCase()}
    </Badge>
  );
}

const STATUS_STYLE: Record<IncidentStatus, [Tone, LucideIcon]> = {
  PENDING: ['warning', CloudOff],
  RECEIVED: ['info', CheckCircle2],
  VERIFIED: ['info', ShieldCheck],
  ASSIGNED: ['info', UserCheck],
  IN_PROGRESS: ['advisory', Loader2],
  RESOLVED: ['safe', CheckCircle2],
  CANCELLED: ['neutral', Ban],
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const [tone, icon] = STATUS_STYLE[status];
  return (
    <Badge tone={tone} icon={icon}>
      {INCIDENT_STATUS_LABELS[status]}
    </Badge>
  );
}

const SYNC_STYLE: Record<LocalSyncStatus, [Tone, LucideIcon, string]> = {
  PENDING: ['warning', CloudOff, 'Waiting for connection'],
  SYNCING: ['info', Loader2, 'Sending…'],
  SYNCED: ['safe', CheckCircle2, 'Delivered'],
  FAILED: ['critical', XCircle, 'Not accepted'],
};

export function SyncBadge({ status }: { status: LocalSyncStatus }) {
  const [tone, icon, label] = SYNC_STYLE[status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

export const SAFETY_TONE: Record<SafetyState, Tone> = {
  SAFE: 'safe',
  NEED_ASSISTANCE: 'advisory',
  EMERGENCY: 'critical',
  UNKNOWN: 'neutral',
};
export const SAFETY_ICON: Record<SafetyState, LucideIcon> = {
  SAFE: ShieldCheck,
  NEED_ASSISTANCE: AlertTriangle,
  EMERGENCY: Siren,
  UNKNOWN: CircleHelp,
};

export function SafetyBadge({ status }: { status: SafetyState }) {
  return (
    <Badge tone={SAFETY_TONE[status]} icon={SAFETY_ICON[status]}>
      {SAFETY_STATE_LABELS[status]}
    </Badge>
  );
}

export function ShelterStatusBadge({ status }: { status: ShelterStatus }) {
  const tone: Tone = status === 'OPEN' ? 'safe' : status === 'FULL' ? 'warning' : 'neutral';
  const icon = status === 'OPEN' ? CheckCircle2 : status === 'FULL' ? AlertTriangle : Ban;
  return (
    <Badge tone={tone} icon={icon}>
      {SHELTER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ band, score }: { band: PriorityBand; score: number }) {
  const tone: Tone = band === 'IMMEDIATE' ? 'critical' : band === 'URGENT' ? 'warning' : band === 'PRIORITY' ? 'advisory' : 'neutral';
  return (
    <Badge tone={tone} icon={Clock}>
      {PRIORITY_BAND_LABELS[band]} <span className="tabular font-normal">({score})</span>
    </Badge>
  );
}

/** Marks simulated data so it is never mistaken for a real emergency. */
export function DemoBadge() {
  return (
    <Badge tone="demo" icon={FlaskConical}>
      DEMO
    </Badge>
  );
}
