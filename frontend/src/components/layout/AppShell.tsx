import { Bell, Home, House, LogIn, Menu, Siren, UserRound, type LucideIcon } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useActiveAlerts } from '../../hooks/useOfflineData';
import { useSession } from '../../hooks/useStore';
import { cn } from '../../utils/cn';
import { SkeletonList } from '../ui';
import { ConnectionIndicator } from './ConnectionIndicator';
import { PRIMARY_NAV as PRIMARY, STAFF_NAV as STAFF, type NavItem } from './nav';
import { StatusBanner } from './StatusBanner';

function Logo() {
  return (
    <Link to="/" className="flex min-h-12 items-center gap-2" aria-label="RESQNET home">
      <img src="/favicon.svg" alt="" className="size-9" width={36} height={36} />
      <span className="text-xl font-extrabold tracking-tight">RESQNET</span>
    </Link>
  );
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold',
          isActive ? 'bg-info-bg text-info' : 'text-text hover:bg-surface-2',
        )
      }
    >
      <item.icon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  );
}

function Sidebar() {
  const { user } = useSession();
  const staff = STAFF.filter((i) => user && i.roles?.includes(user.role));
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface p-4 lg:flex">
      <Logo />
      <Link
        to="/sos"
        className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-brand text-lg font-bold text-on-brand hover:bg-brand-hover"
      >
        <Siren className="size-6" aria-hidden />
        Request help
      </Link>
      <nav aria-label="Main" className="space-y-1">
        {PRIMARY.map((i) => (
          <SideLink key={i.to} item={i} />
        ))}
      </nav>
      {staff.length > 0 && (
        <nav aria-label="Work" className="space-y-1 border-t border-line pt-4">
          <p className="px-3 pb-1 text-sm font-semibold text-muted">Work</p>
          {staff.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
        </nav>
      )}
      <div className="mt-auto border-t border-line pt-4">
        <SideLink item={user ? { to: '/account', label: user.name, icon: UserRound } : { to: '/login', label: 'Sign in', icon: LogIn }} />
      </div>
    </aside>
  );
}

function BottomNav() {
  const alerts = useActiveAlerts();
  const critical = alerts.data.some((a) => a.severity === 'CRITICAL');
  const item = (to: string, label: string, Icon: LucideIcon, opts: { end?: boolean; dot?: boolean } = {}) => (
    <NavLink
      to={to}
      end={opts.end}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold',
          isActive ? 'text-info' : 'text-muted',
        )
      }
    >
      <Icon className="size-6" aria-hidden />
      {label}
      {opts.dot && (
        <span className="absolute top-2 right-[calc(50%-18px)] size-2.5 rounded-full bg-critical ring-2 ring-surface">
          <span className="sr-only">(critical alert)</span>
        </span>
      )}
    </NavLink>
  );
  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden"
    >
      <div className="mx-auto flex max-w-xl items-stretch">
        {item('/', 'Home', Home, { end: true })}
        {item('/alerts', 'Alerts', Bell, { dot: critical })}
        <Link
          to="/sos"
          className="-mt-5 mx-1 flex min-h-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-brand text-xs font-bold text-on-brand shadow-lg"
        >
          <Siren className="size-7" aria-hidden />
          HELP
        </Link>
        {item('/shelters', 'Shelters', House)}
        {item('/more', 'More', Menu)}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { user } = useSession();
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="flex-1" />
            <ConnectionIndicator />
            <Link
              to={user ? '/account' : '/login'}
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-surface-2 lg:hidden"
              aria-label={user ? 'Account' : 'Sign in'}
            >
              {user ? <UserRound className="size-6" aria-hidden /> : <LogIn className="size-6" aria-hidden />}
            </Link>
          </div>
          <StatusBanner />
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 lg:pb-10">
          <Suspense fallback={<SkeletonList rows={4} />}>{children ?? <Outlet />}</Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

