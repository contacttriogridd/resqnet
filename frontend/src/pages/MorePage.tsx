import { ChevronRight, Info, LogIn, MapPinned, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { PRIMARY_NAV, STAFF_NAV } from '../components/layout/nav';
import { PageHeader } from '../components/ui';
import { useSession } from '../hooks/useStore';

function MenuLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Info }) {
  return (
    <li>
      <Link to={to} className="flex min-h-14 items-center gap-3 px-4 hover:bg-surface-2">
        <Icon className="size-6 text-info" aria-hidden />
        <span className="flex-1 font-semibold">{label}</span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

export default function MorePage() {
  const { user } = useSession();
  const staff = STAFF_NAV.filter((i) => user && i.roles?.includes(user.role));
  const items = PRIMARY_NAV.filter((i) => !['/', '/alerts', '/shelters'].includes(i.to));
  return (
    <div className="space-y-4">
      <PageHeader title="More" />
      {staff.length > 0 && (
        <nav aria-label="Work">
          <h2 className="mb-2 font-bold text-muted">Work</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {staff.map((i) => (
              <MenuLink key={i.to} to={i.to} label={i.label} icon={i.icon} />
            ))}
          </ul>
        </nav>
      )}
      <nav aria-label="All features">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {items.map((i) => (
            <MenuLink key={i.to} to={i.to} label={i.label} icon={i.icon} />
          ))}
          <MenuLink to="/share-location" label="Share my location" icon={MapPinned} />
        </ul>
      </nav>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {user ? (
          <MenuLink to="/account" label={`Account · ${user.name}`} icon={UserRound} />
        ) : (
          <MenuLink to="/login" label="Sign in (volunteers & responders)" icon={LogIn} />
        )}
      </ul>
      <p className="px-1 text-sm text-muted">
        RESQNET helps coordinate during disasters. It does not replace official emergency services — in danger, call
        112.
      </p>
    </div>
  );
}
