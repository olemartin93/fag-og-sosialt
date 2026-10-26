import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n, isTranslationKey, type TranslationKey } from '../../lib/i18n';
import { Button, cx } from './primitives';

const inputBase =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] sm:text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

function useFieldError(error?: string) {
  const { t } = useI18n();
  if (!error) return undefined;
  const key = `field.${error}`;
  return isTranslationKey(key) ? t(key as TranslationKey) : error;
}

interface FieldShellProps {
  label: ReactNode;
  id: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}

function FieldShell({ label, id, error, hint, optional, children }: FieldShellProps) {
  const { t } = useI18n();
  const message = useFieldError(error);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">({t('common.optional')})</span>}
      </label>
      {children}
      {hint && !message && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

type Common = { label: ReactNode; error?: string; hint?: ReactNode; optional?: boolean };

export function TextField({ label, error, hint, optional, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} optional={optional}>
      <input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(inputBase, error && 'border-danger', className)}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextArea({ label, error, hint, optional, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} optional={optional}>
      <textarea
        id={id}
        rows={4}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(inputBase, 'min-h-24 resize-y', error && 'border-danger', className)}
        {...rest}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  optional,
  className,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} optional={optional}>
      <select
        id={id}
        aria-invalid={!!error || undefined}
        className={cx(inputBase, 'appearance-auto', error && 'border-danger', className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ label, hint, className, ...rest }: { label: ReactNode; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" {...rest} />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && panel.current) {
        const focusables = panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
        );
        const list = Array.from(focusables);
        const firstEl = list[0];
        const lastEl = list[list.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="no-print fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-2xl sm:rounded-3xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
            aria-label={t('common.close')}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Modal with a form; submit button in footer. */
export function FormModal({
  open,
  onClose,
  title,
  onSubmit,
  submitting,
  children,
  submitLabel,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  onSubmit: () => void;
  submitting?: boolean;
  children: ReactNode;
  submitLabel?: string;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const formId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide={wide}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={submitting}>
            {submitLabel ?? t('common.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {children}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- confirm
interface ConfirmRequest {
  message: string;
  confirmLabel?: string;
  resolve: (ok: boolean) => void;
}
const ConfirmContext = createContext<((message: string, confirmLabel?: string) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirm = useCallback(
    (message: string, confirmLabel?: string) =>
      new Promise<boolean>((resolve) => setRequest({ message, confirmLabel, resolve })),
    [],
  );
  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!request}
        onClose={() => close(false)}
        title={t('common.confirm')}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => close(true)}>
              {request?.confirmLabel ?? t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm">{request?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
