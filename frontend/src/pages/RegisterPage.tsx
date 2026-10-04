import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@resqnet/shared';
import { UserPlus } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import type { z } from 'zod';
import { Button, Card, Choice, FieldError, Label, Notice, PageHeader, TextInput } from '../components/ui';
import { useNetwork } from '../hooks/useStore';
import { errorMessage } from '../services/apiClient';
import { register as registerUser } from '../services/authService';

type In = z.input<typeof registerSchema>;
type Out = z.output<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const net = useNetwork();
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(registerSchema), defaultValues: { role: 'CIVILIAN' } });

  const onSubmit = async (data: Out) => {
    setError(null);
    try {
      const user = await registerUser(data);
      navigate(user.role === 'VOLUNTEER' ? '/volunteer' : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <PageHeader back="/login" title="Create account" />
      {net.state === 'offline' && <Notice tone="warning" className="mb-4" title="Creating an account needs an internet connection." />}
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <Label htmlFor={`${id}-n`}>Full name</Label>
            <TextInput id={`${id}-n`} autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor={`${id}-e`}>Email</Label>
            <TextInput id={`${id}-e`} type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor={`${id}-ph`} hint="Optional">
              Phone
            </Label>
            <TextInput id={`${id}-ph`} type="tel" autoComplete="tel" {...register('phone')} />
            <FieldError>{errors.phone?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor={`${id}-p`} hint="At least 10 characters. A short sentence is easy to remember.">
              Password
            </Label>
            <TextInput id={`${id}-p`} type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <fieldset>
            <legend className="mb-2 font-semibold">I am joining as</legend>
            <div className="grid gap-2">
              <Choice value="CIVILIAN" label="Civilian" hint="Request help, follow my reports" {...register('role')} />
              <Choice value="VOLUNTEER" label="Volunteer" hint="Help people near me with support tasks" {...register('role')} />
            </div>
            <p className="mt-2 text-sm text-muted">Responder accounts are created by an administrator.</p>
          </fieldset>
          {error && <Notice tone="critical" role="alert" title={error} />}
          <Button type="submit" variant="primary" size="lg" block icon={UserPlus} loading={isSubmitting} disabled={net.state === 'offline'}>
            Create account
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-info underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
