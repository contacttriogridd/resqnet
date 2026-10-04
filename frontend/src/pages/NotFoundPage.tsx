import { Home, MapPinOff } from 'lucide-react';
import { ButtonLink, EmptyState } from '../components/ui';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={MapPinOff}
      title="This page does not exist"
      action={
        <ButtonLink to="/" variant="primary" icon={Home}>
          Go to home
        </ButtonLink>
      }
    >
      In an emergency, call 112.
    </EmptyState>
  );
}
