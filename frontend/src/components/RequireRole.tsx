import { ROLE_LABELS, type Role } from '@resqnet/shared';
import { Lock, LogIn } from 'lucide-react';
import { Outlet, useLocation } from 'react-router';
import { useSession } from '../hooks/useStore';
import { ButtonLink, EmptyState, SkeletonList } from './ui';

/**
 * Client-side route guard for role-specific screens. This is a usability
 * feature only — the API enforces every permission independently.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, restored } = useSession();
  const location = useLocation();

  if (!restored) return <SkeletonList rows={3} />;
  if (!user) {
    return (
      <EmptyState
        icon={LogIn}
        title="Please sign in"
        action={
          <ButtonLink to={`/login?next=${encodeURIComponent(location.pathname)}`} variant="primary" icon={LogIn}>
            Sign in
          </ButtonLink>
        }
      >
        This area is for {roles.map((r) => ROLE_LABELS[r].toLowerCase()).join(' and ')} accounts. You do not need an
        account to request help.
      </EmptyState>
    );
  }
  if (!roles.includes(user.role)) {
    return (
      <EmptyState icon={Lock} title="You don't have access to this page" action={<ButtonLink to="/">Go home</ButtonLink>}>
        Your account is registered as a {ROLE_LABELS[user.role].toLowerCase()}.
      </EmptyState>
    );
  }
  return <Outlet />;
}
