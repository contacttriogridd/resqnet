import { AlertTriangle, ArrowLeft, Info, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router';
import { cn } from '../utils/cn';

/* ───────── Buttons ───────── */

type Variant = 'emergency' | 'primary' | 'secondary' | 'ghost' | 'danger-outline';
type Size = 'md' | 'lg' | 'xl';

const VARIANT: Record<Variant, string> = {
  // Red is reserved for emergency actions.
  emergency: 'bg-brand text-on-brand hover:bg-brand-hover shadow-sm',
  primary: 'bg-info text-white hover:opacity-90 dark:text-[#0c111d]',
  secondary: 'bg-surface text-text border-2 border-line-strong hover:bg-surface-2',
  ghost: 'text-text hover:bg-surface-2',
  'danger-outline': 'bg-surface text-critical border-2 border-critical-line hover:bg-critical-bg',
};

const SIZE: Record<Size, string> = {
  md: 'min-h-12 px-4 text-base gap-2',
  lg: 'min-h-14 px-5 text-lg gap-2.5',
  xl: 'min-h-20 px-6 text-xl gap-3',
};

const buttonBase =
  'inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonBase, VARIANT[variant], SIZE[size], block && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className={size === 'xl' ? 'size-7' : 'size-5'} aria-hidden />
      )}
      {children}
    </button>
  );
});

export function ButtonLink({
  to,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  block,
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(buttonBase, VARIANT[variant], SIZE[size], block && 'w-full', className)}>
      {Icon && <Icon className={size === 'xl' ? 'size-7' : 'size-5'} aria-hidden />}
      {children}
    </Link>
  );
}

/* ───────── Surfaces ───────── */

export function Card({
  children,
  className,
  as: As = 'section',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'li';
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn('rounded-2xl border border-line bg-surface p-4 sm:p-5', className)} {...rest}>
      {children}
    </As>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start gap-3">
      {back && (
        <Link
          to={back}
          className="-ml-2 inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-surface-2"
          aria-label="Back"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/* ───────── Tones (badges, notices) ───────── */

export type Tone = 'critical' | 'warning' | 'advisory' | 'safe' | 'info' | 'neutral' | 'demo';

export const TONE: Record<Tone, string> = {
  critical: 'bg-critical-bg text-critical border-critical-line',
  warning: 'bg-warning-bg text-warning border-warning-line',
  advisory: 'bg-advisory-bg text-advisory border-advisory-line',
  safe: 'bg-safe-bg text-safe border-safe-line',
  info: 'bg-info-bg text-info border-info-line',
  neutral: 'bg-neutral-bg text-neutral border-neutral-line',
  demo: 'bg-demo-bg text-demo border-demo',
};

/** Status label: always icon/emoji + TEXT, never colour alone. */
export function Badge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </span>
  );
}

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  action,
  className,
  role,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: 'status' | 'alert';
}) {
  const Icon = icon ?? (tone === 'critical' || tone === 'warning' ? AlertTriangle : Info);
  return (
    <div className={cn('flex gap-3 rounded-xl border-2 p-3.5', TONE[tone], className)} role={role}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-text">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? 'mt-0.5' : null, 'text-[0.95rem]')}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

/* ───────── Loading / empty / error ───────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} aria-hidden />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center">
      <Icon className="size-10 text-muted" aria-hidden />
      <p className="mt-3 text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice
      tone="warning"
      title={message}
      role="alert"
      action={
        onRetry && (
          <Button onClick={onRetry} icon={RefreshCw}>
            Try again
          </Button>
        )
      }
    />
  );
}

/* ───────── Form fields ───────── */

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block">
      <span className="font-semibold">{children}</span>
      {hint && <span className="block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-critical" role="alert">
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

const inputBase =
  'block w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 text-base text-text placeholder:text-muted focus:border-focus focus:outline-none aria-[invalid=true]:border-critical';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(inputBase, 'min-h-12', className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(inputBase, 'min-h-24 py-2.5', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn(inputBase, 'min-h-12', className)} {...rest}>
      {children}
    </select>
  );
});

/**
 * Large tappable radio/checkbox "chip". Uses a real input so keyboard and
 * screen readers behave natively.
 */
export const Choice = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }
>(function Choice({ label, hint, className, type = 'radio', ...rest }, ref) {
  return (
    <label
      className={cn(
        'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-surface px-3.5 py-2',
        'has-[:checked]:border-focus has-[:checked]:bg-info-bg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus',
        className,
      )}
    >
      <input ref={ref} type={type} className="size-5 shrink-0 accent-[var(--focus)]" {...rest} />
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
});

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </span>
  );
}
