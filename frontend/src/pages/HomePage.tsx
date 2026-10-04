import {
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  FileText,
  HeartHandshake,
  House,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  Phone,
  ShieldCheck,
  Siren,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { AlertCard } from '../components/AlertCard';
import { SafetyBadge } from '../components/badges';
import { DataFreshness } from '../components/DataFreshness';
import { Button, Card, Notice } from '../components/ui';
import { useActiveAlerts, useLatestSafetyStatus, useMyIncidents, useRegion } from '../hooks/useOfflineData';
import { useSession, useStore } from '../hooks/useStore';
import { dismissInstall, promptInstall, pwaStore } from '../offline/pwa';
import { cn } from '../utils/cn';
import { timeAgo } from '../utils/time';

const ALERT_RANK = { CRITICAL: 0, WARNING: 1, ADVISORY: 2, INFO: 3 } as const;

function BigAction({
  to,
  icon: Icon,
  label,
  hint,
  emergency,
  badge,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  emergency?: boolean;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'relative flex min-h-32 flex-col justify-between rounded-2xl border-2 p-4 transition-colors',
        emergency
          ? 'border-brand bg-brand text-on-brand hover:bg-brand-hover'
          : 'border-line-strong bg-surface text-text hover:bg-surface-2',
      )}
    >
      <Icon className="size-9" aria-hidden />
      <span>
        <span className="block text-lg leading-tight font-extrabold tracking-wide uppercase sm:text-xl">{label}</span>
        <span className={cn('mt-0.5 block text-sm', emergency ? 'text-on-brand/90' : 'text-muted')}>{hint}</span>
      </span>
      {badge && (
        <span className="absolute top-3 right-3 rounded-full bg-critical-bg px-2 py-0.5 text-sm font-bold text-critical">
          {badge}
        </span>
      )}
    </Link>
  );
}

function QuickAction({ to, icon: Icon, label, detail }: { to: string; icon: LucideIcon; label: string; detail?: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-line-strong"
    >
      <Icon className="size-6 shrink-0 text-info" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{label}</span>
        {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

function CurrentSituation() {
  const alerts = useActiveAlerts();
  const region = useRegion();
  const top = [...alerts.data].sort((a, b) => ALERT_RANK[a.severity] - ALERT_RANK[b.severity])[0];

  return (
    <section aria-labelledby="situation" className="space-y-2">
      <h2 id="situation" className="text-lg font-bold">
        Current situation · {region}
      </h2>
      {top ? (
        <>
          <AlertCard alert={top} prominent />
          {alerts.data.length > 1 && (
            <Link to="/alerts" className="inline-flex min-h-12 items-center gap-1 font-semibold text-info">
              See all {alerts.data.length} active alerts <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </>
      ) : (
        <Notice tone="safe" icon={ShieldCheck} title={`No active alerts for ${region}`}>
          {alerts.source === 'server'
            ? 'Stay prepared: check the safety guides and keep your phone charged.'
            : 'Alerts have not been downloaded on this device yet.'}
        </Notice>
      )}
      <DataFreshness syncedAt={alerts.syncedAt} source={alerts.source} what="Alerts" />
    </section>
  );
}

function InstallCard() {
  const pwa = useStore(pwaStore);
  if (!pwa.canInstall || pwa.installed || pwa.installDismissed) return null;
  return (
    <Card className="flex items-center gap-3">
      <Download className="size-6 shrink-0 text-info" aria-hidden />
      <p className="flex-1">Install RESQNET for faster emergency access — it also works offline.</p>
      <Button variant="primary" onClick={() => void promptInstall()}>
        Install
      </Button>
      <button
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-surface-2"
        onClick={() => void dismissInstall()}
        aria-label="Not now"
      >
        <X className="size-5" aria-hidden />
      </button>
    </Card>
  );
}

export function HomePage() {
  const { user } = useSession();
  const alerts = useActiveAlerts();
  const safety = useLatestSafetyStatus();
  const reports = useMyIncidents();
  const waiting = reports?.filter((r) => r.syncStatus === 'PENDING' || r.syncStatus === 'SYNCING').length ?? 0;
  const critical = alerts.data.filter((a) => a.severity === 'CRITICAL').length;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">RESQNET home</h1>

      <CurrentSituation />

      <section aria-label="Emergency actions" className="grid grid-cols-2 gap-3">
        <BigAction to="/sos" icon={Siren} label="Request help" hint="For you or people with you" emergency />
        <BigAction to="/help?mode=report" icon={Megaphone} label="Report emergency" hint="Something you can see" />
        <BigAction to="/shelters" icon={House} label="Find safe shelter" hint="Nearby relief centres" />
        <BigAction
          to="/alerts"
          icon={Bell}
          label="Emergency alerts"
          hint={`${alerts.data.length} active`}
          badge={critical ? `${critical} critical` : undefined}
        />
      </section>

      {user && user.role !== 'CIVILIAN' && (
        <section aria-label="Your work" className="grid gap-3 sm:grid-cols-2">
          {user.role === 'VOLUNTEER' && (
            <QuickAction to="/volunteer" icon={HeartHandshake} label="Volunteer tasks" detail="Nearby help requests" />
          )}
          {(user.role === 'RESPONDER' || user.role === 'ADMIN') && (
            <QuickAction to="/responder" icon={ClipboardList} label="Responder dashboard" detail="Active incidents" />
          )}
          {user.role === 'ADMIN' && (
            <QuickAction to="/admin" icon={LayoutDashboard} label="Admin overview" detail="Operations & analytics" />
          )}
        </section>
      )}

      <section aria-labelledby="quick" className="space-y-3">
        <h2 id="quick" className="text-lg font-bold">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickAction to="/contacts" icon={Phone} label="Emergency contacts" detail="112 · 108 · 101 · 100" />
          <QuickAction to="/guides" icon={BookOpen} label="Safety guide" detail="Flood, earthquake, cyclone…" />
          <QuickAction
            to="/reports"
            icon={FileText}
            label="My reports"
            detail={waiting ? `${waiting} waiting to send` : `${reports?.length ?? 0} on this device`}
          />
          <QuickAction to="/offline" icon={Database} label="Offline data" detail="What works without internet" />
          <QuickAction to="/share-location" icon={MapPinned} label="Share location" detail="By SMS or any app" />
          <Link
            to="/status"
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-line-strong"
          >
            <ShieldCheck className="size-6 shrink-0 text-info" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight">My safety status</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                {safety ? (
                  <>
                    <SafetyBadge status={safety.status} /> {timeAgo(safety.createdAt)}
                  </>
                ) : (
                  'Not set — tell others you are safe'
                )}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
          </Link>
        </div>
      </section>

      <InstallCard />
    </div>
  );
}
