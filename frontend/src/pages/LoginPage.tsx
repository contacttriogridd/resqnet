import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@resqnet/shared';
import { LogIn } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, Card, FieldError, Label, Notice, PageHeader, TextInput } from '../components/ui';
import { useNetwork } from '../hooks/useStore';
import { errorMessage } from '../services/apiClient';
import { login } from '../services/authService';

const HOME_FOR_ROLE = { CIVILIAN: '/', VOLUNTEER: '/volunteer', RESPONDER: '/responder', ADMIN: '/admin' } as const;

/** Only allow same-app relative redirects (prevents open-redirects via ?next=). */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const net = useNetwork();
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      const user = await login(data);
      navigate(safeNext(params.get('next')) ?? HOME_FOR_ROLE[user.role], { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Sign in" subtitle="For volunteers, responders and registered users." />
      <Notice tone="info" className="mb-4">
        You do <strong>not</strong> need to sign in to request help.{' '}
        <Link to="/sos" className="font-semibold underline">
          Request help now
        </Link>
      </Notice>
      {net.state === 'offline' && <Notice tone="warning" className="mb-4" title="Signing in needs an internet connection." />}
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <Label htmlFor={`${id}-e`}>Email</Label>
            <TextInput id={`${id}-e`} type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor={`${id}-p`}>Password</Label>
            <TextInput
              id={`${id}-p`}
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          {error && <Notice tone="critical" role="alert" title={error} />}
          <Button type="submit" variant="primary" size="lg" block icon={LogIn} loading={isSubmitting} disabled={net.state === 'offline'}>
            Sign in
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center">
        New here?{' '}
        <Link to="/register" className="font-semibold text-info underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
