import { useState } from 'react';
import { Database, Info, LogOut, Palette, RefreshCw, Shield, Trash2, UserRound } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useAction, useSettings } from '../lib/queries';
import { isAdmin } from '../lib/permissions';
import { applyTheme, getTheme, type Theme } from '../lib/theme';
import { isEnvConfigured, saveSupabaseConfig } from '../lib/api/config';
import { fieldErrors, settingsSchema, type SettingsInput } from '../lib/validation';
import { Avatar, Badge, Button, Card, CardHeader, cx, PageHeader } from '../components/ui/primitives';
import { Checkbox, TextField, useConfirm } from '../components/ui/forms';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import { ParticipantFormModal } from '../components/participants';
import { SupabaseConnectForm } from './AuthPages';

function WorkspaceSettings() {
  const settings = useSettings();
  return settings.data ? <WorkspaceSettingsForm initial={settings.data} /> : null;
}

function WorkspaceSettingsForm({ initial }: { initial: SettingsInput }) {
  const { t } = useI18n();
  const { api } = useSession();
  const [values, setValues] = useState<SettingsInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction((v: SettingsInput) => api.updateSettings(v), { success: 'common.saved' });
  const newCode = () => {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    setValues({ ...values, inviteCode: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') });
  };
  return (
    <Card>
      <CardHeader title={t('settings.workspace')} icon={Shield} />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = settingsSchema.safeParse(values);
          if (!parsed.success) return setErrors(fieldErrors(parsed.error));
          setErrors({});
          save.mutate(values);
        }}
      >
        <TextField label={t('settings.groupName')} value={values.groupName} onChange={(e) => setValues({ ...values, groupName: e.target.value })} error={errors.groupName} />
        <TextField
          label={t('settings.defaultStart')}
          type="time"
          value={values.defaultStartTime}
          onChange={(e) => setValues({ ...values, defaultStartTime: e.target.value })}
          error={errors.defaultStartTime}
        />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField label={t('settings.inviteCode')} value={values.inviteCode} onChange={(e) => setValues({ ...values, inviteCode: e.target.value })} error={errors.inviteCode} />
          </div>
          <Button variant="secondary" icon={RefreshCw} onClick={newCode}>
            <span className="hidden sm:inline">{t('settings.newCode')}</span>
          </Button>
        </div>
        <Checkbox
          label={t('settings.ratingsPublic')}
          hint={t('settings.ratingsPublicHelp')}
          checked={values.ratingsPublic}
          onChange={(e) => setValues({ ...values, ratingsPublic: e.target.checked })}
        />
        <Button type="submit" className="self-start" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Card>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { api, me, session } = useSession();
  const confirm = useConfirm();
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [editingProfile, setEditingProfile] = useState(false);
  const clearDemo = useAction(() => api.clearDemoData(), { success: 'settings.demoCleared' });
  const admin = isAdmin(me);

  return (
    <div>
      <PageHeader title={t('settings.title')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('settings.profile')} icon={UserRound} />
          {me && (
            <div className="flex items-center gap-4">
              <Avatar participant={me} size="lg" />
              <div className="flex-1">
                <p className="font-semibold">{me.displayName}</p>
                <p className="text-sm text-muted">{session?.email ?? t(`role.${me.role}`)}</p>
                <Badge tone="primary" className="mt-1">
                  {t(`role.${me.role}`)}
                </Badge>
              </div>
              <Button variant="secondary" onClick={() => setEditingProfile(true)}>
                {t('common.edit')}
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t('settings.appearance')} icon={Palette} />
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium">{t('common.language')}</p>
              <LanguageSwitcher />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">{t('settings.theme')}</p>
              <div className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5" role="group" aria-label={t('settings.theme')}>
                {(['system', 'light', 'dark'] as const).map((th) => (
                  <button
                    key={th}
                    type="button"
                    aria-pressed={theme === th}
                    onClick={() => {
                      setTheme(th);
                      applyTheme(th);
                    }}
                    className={cx('rounded-[10px] px-3 py-1.5 text-sm font-medium', theme === th ? 'bg-surface shadow-sm' : 'text-muted')}
                  >
                    {t(`settings.theme.${th}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {admin && <WorkspaceSettings />}

        {admin && (
          <Card>
            <CardHeader title={t('settings.demo')} icon={Trash2} />
            <p className="mb-4 text-sm text-muted">{t('settings.demoHelp')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                icon={Trash2}
                loading={clearDemo.isPending}
                onClick={async () => {
                  if (await confirm(t('settings.clearDemoConfirm'), t('settings.clearDemo'))) clearDemo.mutate();
                }}
              >
                {t('settings.clearDemo')}
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title={t('settings.data')} icon={Database} />
          <p className="mb-4 text-sm">{api.mode === 'supabase' ? t('settings.mode.supabase') : t('settings.mode.demo')}</p>
          {api.mode === 'demo' ? (
            <div className="flex flex-col gap-4">
              <Button
                variant="secondary"
                icon={RefreshCw}
                className="self-start"
                onClick={async () => {
                  if (await confirm(t('settings.resetDemo') + '?', t('settings.resetDemo'))) await api.resetDemo?.();
                }}
              >
                {t('settings.resetDemo')}
              </Button>
              <SupabaseConnectForm />
            </div>
          ) : (
            !isEnvConfigured() && (
              <Button
                variant="secondary"
                onClick={() => {
                  saveSupabaseConfig(null);
                  window.location.reload();
                }}
              >
                {t('settings.disconnect')}
              </Button>
            )
          )}
        </Card>

        <Card>
          <CardHeader title={t('settings.account')} icon={LogOut} />
          {me && <p className="mb-4 text-sm text-muted">{t('settings.signedInAs', { name: me.displayName })}</p>}
          <Button variant="secondary" icon={LogOut} onClick={() => void api.signOut()}>
            {t('auth.signOut')}
          </Button>
        </Card>

        <Card>
          <CardHeader title={t('settings.about')} icon={Info} />
          <p className="text-sm text-muted">{t('settings.install')}</p>
          <p className="mt-3 text-xs text-muted">
            {t('app.name')} · v{__APP_VERSION__}
          </p>
        </Card>
      </div>
      {editingProfile && me && <ParticipantFormModal participant={me} onClose={() => setEditingProfile(false)} />}
    </div>
  );
}
