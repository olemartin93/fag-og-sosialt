import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Database, LogIn, UserPlus } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { errorMessage } from '../lib/queries';
import { fieldErrors, signInSchema, signUpSchema, supabaseConfigSchema } from '../lib/validation';
import { saveSupabaseConfig } from '../lib/api/config';
import type { Participant } from '../lib/types';
import { AppIcon } from '../components/layout/AppIcon';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import { Avatar, Badge, Button, Card, cx } from '../components/ui/primitives';
import { TextField } from '../components/ui/forms';

function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]">
        <LanguageSwitcher compact />
      </div>
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <AppIcon className="size-16 drop-shadow-sm" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('app.name')}</h1>
          <p className="text-sm text-muted">{t('app.tagline')}</p>
        </div>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Alert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'rounded-xl px-3 py-2 text-sm',
        tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success',
      )}
    >
      {children}
    </p>
  );
}

export function SupabaseConnectForm() {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = supabaseConfigSchema.safeParse({ url, anonKey });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    saveSupabaseConfig(parsed.data);
    window.location.reload();
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <TextField
        label={t('settings.supabaseUrl')}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://xxxx.supabase.co"
        inputMode="url"
        autoComplete="off"
        error={errors.url}
      />
      <TextField
        label={t('settings.supabaseKey')}
        value={anonKey}
        onChange={(e) => setAnonKey(e.target.value)}
        autoComplete="off"
        error={errors.anonKey}
      />
      <p className="text-xs text-muted">{t('settings.connectHelp')}</p>
      <Button type="submit" variant="secondary" icon={Database}>
        {t('settings.connect')}
      </Button>
    </form>
  );
}

function DemoLogin() {
  const { t } = useI18n();
  const { api } = useSession();
  const [accounts, setAccounts] = useState<Participant[] | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  useEffect(() => {
    void api.demoAccounts?.().then(setAccounts);
  }, [api]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('auth.demoTitle')}</h2>
          <Badge tone="accent">{t('common.demo')}</Badge>
        </div>
        <p className="mb-4 text-sm text-muted">{t('auth.demoIntro')}</p>
        <p className="mb-2 text-sm font-medium">{t('auth.demoAs')}</p>
        <ul className="flex flex-col gap-2">
          {(accounts ?? []).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => void api.signInAsDemo?.(p.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary-soft"
              >
                <Avatar participant={p} size="sm" />
                <span className="flex-1 text-sm font-medium">{p.displayName}</span>
                <Badge tone={p.role === 'admin' ? 'primary' : p.role === 'organizer' ? 'info' : 'neutral'}>
                  {t(`role.${p.role}`)}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium"
          onClick={() => setShowConnect((s) => !s)}
          aria-expanded={showConnect}
        >
          <span className="flex items-center gap-2">
            <Database className="size-4 text-primary" aria-hidden />
            {t('auth.connect')}
          </span>
          <span aria-hidden>{showConnect ? '−' : '+'}</span>
        </button>
        {showConnect && (
          <div className="mt-4">
            <SupabaseConnectForm />
          </div>
        )}
      </Card>
    </div>
  );
}

type Mode = 'signIn' | 'signUp' | 'forgot';

function SupabaseLogin() {
  const { t } = useI18n();
  const { api, refresh } = useSession();
  // an invitation link (#/?invite=CODE) opens sign-up with the code filled in
  const [inviteFromUrl] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('invite') ?? '');
  const [mode, setMode] = useState<Mode>(inviteFromUrl ? 'signUp' : 'signIn');
  const [values, setValues] = useState({ displayName: '', email: '', password: '', inviteCode: inviteFromUrl });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);


  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrors({});
    if (mode === 'forgot') {
      const parsed = signInSchema.pick({ email: true }).safeParse(values);
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    } else {
      const parsed = (mode === 'signIn' ? signInSchema : signUpSchema).safeParse(values);
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    }
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await api.signIn(values.email, values.password);
        await refresh();
      } else if (mode === 'signUp') {
        const { needsConfirmation } = await api.signUp(values);
        if (needsConfirmation) {
          setMessage({ tone: 'success', text: t('auth.checkEmail') });
          setMode('signIn');
        } else {
          await refresh();
        }
      } else {
        await api.requestPasswordReset(values.email);
        setMessage({ tone: 'success', text: t('auth.resetSent') });
      }
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-surface-2 p-1" role="tablist">
        {(['signIn', 'signUp'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setErrors({});
              setMessage(null);
            }}
            className={cx(
              'rounded-lg py-2 text-sm font-medium',
              mode === m ? 'bg-surface shadow-sm' : 'text-muted',
            )}
          >
            {m === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
          </button>
        ))}
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {mode === 'forgot' && <p className="text-sm text-muted">{t('auth.forgot')}</p>}
        {mode === 'signUp' && (
          <TextField label={t('auth.displayName')} value={values.displayName} onChange={set('displayName')} autoComplete="name" error={errors.displayName} />
        )}
        <TextField
          label={t('auth.email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
        />
        {mode !== 'forgot' && (
          <TextField
            label={t('auth.password')}
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            value={values.password}
            onChange={set('password')}
            error={errors.password}
          />
        )}
        {mode === 'signUp' && (
          <TextField
            label={t('auth.inviteCode')}
            value={values.inviteCode}
            onChange={set('inviteCode')}
            autoComplete="off"
            hint={t('auth.inviteHelp')}
            error={errors.inviteCode}
          />
        )}
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" size="lg" loading={busy} icon={mode === 'signUp' ? UserPlus : LogIn}>
          {mode === 'signIn' ? t('auth.signIn') : mode === 'signUp' ? t('auth.signUp') : t('auth.sendReset')}
        </Button>
        {mode === 'signIn' && (
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setMode('forgot')}>
            {t('auth.forgot')}
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setMode('signIn')}>
            {t('common.back')}
          </button>
        )}
      </form>
    </Card>
  );
}

export function LoginPage() {
  const { api } = useSession();
  return <AuthLayout>{api.mode === 'demo' ? <DemoLogin /> : <SupabaseLogin />}</AuthLayout>;
}

export function SetPasswordPage() {
  const { t } = useI18n();
  const { api, clearPasswordRecovery } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('passwordTooShort');
    setBusy(true);
    try {
      await api.updatePassword(password);
      setMessage(t('auth.passwordUpdated'));
      setTimeout(clearPasswordRecovery, 1200);
    } catch (err) {
      setMessage(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t('auth.setPassword')}</h2>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <TextField
            label={t('auth.newPassword')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
          />
          {message && <Alert tone="success">{message}</Alert>}
          <Button type="submit" loading={busy}>
            {t('common.save')}
          </Button>
        </form>
      </Card>
    </AuthLayout>
  );
}

export function NoProfilePage() {
  const { t } = useI18n();
  const { api, refresh } = useSession();
  return (
    <AuthLayout>
      <Card>
        <p className="mb-4 text-sm">{t('auth.noProfile')}</p>
        <Button variant="secondary" onClick={() => void api.signOut().then(refresh)}>
          {t('auth.signOut')}
        </Button>
      </Card>
    </AuthLayout>
  );
}
