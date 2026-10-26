import type { ButtonHTMLAttributes, ComponentType, ReactNode, SVGProps } from 'react';
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { errorMessage } from '../../lib/queries';
import type { MeetingStatus, Participant } from '../../lib/types';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary-hover shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
  accent: 'bg-accent text-white hover:brightness-110 shadow-sm',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  icon: Icon,
  className,
  ...rest
}: { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('min-w-0 rounded-3xl border border-line bg-surface p-5 shadow-card', className)}>{children}</As>;
}

export function CardHeader({
  title,
  icon: Icon,
  action,
  id,
}: {
  title: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold tracking-tight">
        {Icon && (
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted',
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

const statusTone: Record<MeetingStatus, BadgeTone> = {
  planned: 'info',
  ongoing: 'warning',
  completed: 'success',
  skipped: 'neutral',
};

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const { t } = useI18n();
  return <Badge tone={statusTone[status]}>{t(`status.${status}`)}</Badge>;
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  const { t } = useI18n();
  if (!show) return null;
  return (
    <Badge tone="accent" className="uppercase tracking-wide">
      {t('common.demo')}
    </Badge>
  );
}

export function Avatar({
  participant,
  size = 'md',
}: {
  participant: Pick<Participant, 'displayName' | 'avatarColor' | 'avatarUrl'> | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims = size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-16 text-xl' : 'size-10 text-sm';
  const name = participant?.displayName ?? '?';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  if (participant?.avatarUrl) {
    return (
      <img
        src={participant.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cx(dims, 'shrink-0 rounded-full object-cover ring-2 ring-surface')}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cx(dims, 'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface')}
      style={{ backgroundColor: participant?.avatarColor ?? '#8d969b' }}
    >
      {initials || '?'}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-surface-2', className)} aria-hidden />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-danger-soft bg-danger-soft/40 p-6 text-center" role="alert">
      <AlertTriangle className="size-6 text-danger" aria-hidden />
      <div>
        <p className="font-medium">{t('error.title')}</p>
        <p className="text-sm text-muted">{errorMessage(t, error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  compact,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'gap-2 py-4' : 'gap-3 py-10')}>
      {Icon && (
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <p className={cx('font-medium', compact && 'text-sm text-muted')}>{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function TextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx('text-sm font-medium text-primary hover:underline', className)}>
      {children}
    </Link>
  );
}

export function StatTile({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'neutral' | 'primary' | 'accent' }) {
  return (
    <div
      className={cx(
        'rounded-2xl p-4',
        tone === 'primary' ? 'bg-primary-soft' : tone === 'accent' ? 'bg-accent-soft' : 'bg-surface-2',
      )}
    >
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
