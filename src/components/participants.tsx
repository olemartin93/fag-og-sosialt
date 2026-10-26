import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useApi, useMe } from '../lib/session';
import { useAction } from '../lib/queries';
import { isAdmin } from '../lib/permissions';
import { fieldErrors, participantSchema, teamSchema, type ParticipantInput, type TeamInput } from '../lib/validation';
import type { Participant, Role, Team } from '../lib/types';
import { Avatar } from './ui/primitives';
import { Checkbox, FormModal, SelectField, TextField } from './ui/forms';
import { useDirectory } from './shared';

export const AVATAR_COLORS = ['#2f6f5e', '#c2703d', '#4a6fa5', '#8a5a9e', '#b5484b', '#3f7f8c', '#7a7a3a', '#5f6b66'];

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {AVATAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className="size-9 rounded-full ring-offset-2 ring-offset-surface transition-shadow aria-pressed:ring-2 aria-pressed:ring-ink"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Create/edit a participant. Non-admins can only edit name, colour and picture of themselves. */
export function ParticipantFormModal({ participant, onClose }: { participant?: Participant; onClose: () => void }) {
  const { t } = useI18n();
  const api = useApi();
  const me = useMe();
  const dir = useDirectory();
  const admin = isAdmin(me);
  const [values, setValues] = useState<ParticipantInput>({
    displayName: participant?.displayName ?? '',
    avatarColor: participant?.avatarColor ?? AVATAR_COLORS[0] ?? '#2f6f5e',
    avatarUrl: participant?.avatarUrl ?? '',
    role: participant?.role ?? 'participant',
    teamId: participant?.teamId ?? '',
    active: participant?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction(
    (v: ParticipantInput) => (participant ? api.updateParticipant(participant.id, v) : api.addParticipant(v)),
    { success: 'common.saved', onSuccess: onClose },
  );
  return (
    <FormModal
      open
      onClose={onClose}
      title={participant ? participant.displayName : t('participants.add')}
      submitting={save.isPending}
      onSubmit={() => {
        const parsed = participantSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        save.mutate(values);
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar participant={{ displayName: values.displayName || '?', avatarColor: values.avatarColor, avatarUrl: values.avatarUrl || null }} size="lg" />
        <div className="flex-1">
          <TextField
            label={t('participants.name')}
            value={values.displayName}
            onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))}
            error={errors.displayName}
            maxLength={60}
          />
        </div>
      </div>
      <ColorPicker label={t('participants.color')} value={values.avatarColor} onChange={(c) => setValues((v) => ({ ...v, avatarColor: c }))} />
      <TextField
        label={t('participants.avatarUrl')}
        type="url"
        inputMode="url"
        placeholder="https://"
        value={values.avatarUrl ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, avatarUrl: e.target.value }))}
        error={errors.avatarUrl}
        optional
      />
      {admin && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t('participants.role')} value={values.role} onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as Role }))}>
              {(['participant', 'organizer', 'admin'] as const).map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('participants.team')} value={values.teamId ?? ''} onChange={(e) => setValues((v) => ({ ...v, teamId: e.target.value }))}>
              <option value="">{t('participants.noTeam')}</option>
              {dir.teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </SelectField>
          </div>
          {participant && participant.id !== me?.id && (
            <Checkbox label={t('participants.active')} checked={values.active} onChange={(e) => setValues((v) => ({ ...v, active: e.target.checked }))} />
          )}
        </>
      )}
    </FormModal>
  );
}

export function TeamFormModal({ team, onClose }: { team?: Team; onClose: () => void }) {
  const { t } = useI18n();
  const api = useApi();
  const [values, setValues] = useState<TeamInput>({ name: team?.name ?? '', color: team?.color ?? AVATAR_COLORS[1] ?? '#c2703d' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction((v: TeamInput) => (team ? api.updateTeam(team.id, v) : api.addTeam(v)), {
    success: 'common.saved',
    onSuccess: onClose,
  });
  return (
    <FormModal
      open
      onClose={onClose}
      title={team ? team.name : t('participants.addTeam')}
      submitting={save.isPending}
      onSubmit={() => {
        const parsed = teamSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        save.mutate(values);
      }}
    >
      <TextField label={t('participants.teamName')} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} error={errors.name} maxLength={60} />
      <ColorPicker label={t('participants.teamColor')} value={values.color} onChange={(c) => setValues((v) => ({ ...v, color: c }))} />
    </FormModal>
  );
}
