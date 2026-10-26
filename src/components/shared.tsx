import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  ExternalLink,
  Flag,
  MessageSquare,
  Pencil,
  Star,
  ThumbsUp,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApi, useMe } from '../lib/session';
import { useAction, useMeetings, useParticipants, useTeams } from '../lib/queries';
import { formatLongDate, formatShortDate, osloToday } from '../lib/dates';
import { canDeleteAgendaItem, canEditAgendaItem, canManageMeeting, isAdmin } from '../lib/permissions';
import { formatPoints, formatScore } from '../lib/stats';
import {
  agendaItemSchema,
  fieldErrors,
  meetingSchema,
  scoreSchema,
  type AgendaItemInput,
  type MeetingInput,
  type ScoreInput,
} from '../lib/validation';
import type { AgendaItem, LeaderboardRow, Meeting, MeetingOverview, Participant, Team } from '../lib/types';
import { Avatar, Badge, cx, DemoBadge, EmptyState, IconButton, StatusBadge } from './ui/primitives';
import { Checkbox, FormModal, SelectField, TextArea, TextField, useConfirm } from './ui/forms';

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------- lookups
export function useDirectory() {
  const participants = useParticipants();
  const teams = useTeams();
  return useMemo(() => {
    const p = new Map((participants.data ?? []).map((x) => [x.id, x]));
    const tm = new Map((teams.data ?? []).map((x) => [x.id, x]));
    return {
      participants: participants.data ?? [],
      activeParticipants: (participants.data ?? []).filter((x) => x.active),
      teams: teams.data ?? [],
      person: (id: string | null | undefined): Participant | undefined => (id ? p.get(id) : undefined),
      team: (id: string | null | undefined): Team | undefined => (id ? tm.get(id) : undefined),
      name: (id: string | null | undefined): string | null => (id ? (p.get(id)?.displayName ?? null) : null),
    };
  }, [participants.data, teams.data]);
}

// ---------------------------------------------------------------- meetings
export function MeetingListItem({ meeting, average, votes }: { meeting: MeetingOverview; average?: number | null; votes?: number }) {
  const { locale, t } = useI18n();
  const today = osloToday();
  const isToday = meeting.date === today;
  return (
    <Link
      to={`/moter/${meeting.date}`}
      className={cx(
        'flex items-center gap-4 rounded-2xl border bg-surface p-4 transition-colors hover:border-primary/50 hover:bg-surface-2/50',
        isToday ? 'border-primary' : 'border-line',
      )}
    >
      <div
        className={cx(
          'flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl',
          meeting.status === 'skipped' ? 'bg-surface-2 text-muted' : meeting.date < today ? 'bg-primary-soft text-primary' : 'bg-accent-soft text-accent',
        )}
      >
        <span className="text-lg font-semibold leading-none tabular-nums">{meeting.date.slice(8)}</span>
        <span className="text-[11px] uppercase">{formatShortDate(meeting.date, locale, false).replace(/^\d+\.?\s*/, '')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{meeting.title}</p>
        <p className="text-sm text-muted">{formatLongDate(meeting.date, locale)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={meeting.status} />
          {isToday && <Badge tone="primary">{t('common.today')}</Badge>}
          <DemoBadge show={meeting.isDemo} />
          {meeting.agendaCount > 0 && (
            <Badge>
              <CheckCircle2 className="size-3" aria-hidden />
              {meeting.agendaDoneCount}/{meeting.agendaCount}
            </Badge>
          )}
          {meeting.notesCount > 0 && (
            <Badge>
              <MessageSquare className="size-3" aria-hidden />
              {meeting.notesCount}
            </Badge>
          )}
        </div>
      </div>
      {average !== undefined && average !== null && (
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-lg font-semibold tabular-nums">
            <Star className="size-4 fill-gold text-gold" aria-hidden />
            {formatScore(average, locale)}
          </p>
          <p className="text-xs text-muted">{t('common.votes', { count: votes ?? 0 })}</p>
        </div>
      )}
    </Link>
  );
}

export function MeetingFormModal({
  open,
  onClose,
  meeting,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  meeting?: Meeting;
  defaultDate?: string;
  onSaved?: (m: { date: string }) => void;
}) {
  const { t } = useI18n();
  const api = useApi();
  const dir = useDirectory();
  const [values, setValues] = useState<MeetingInput>(() =>
    meeting
      ? {
          date: meeting.date,
          title: meeting.title,
          status: meeting.status,
          startTime: meeting.startTime ?? '',
          location: meeting.location ?? '',
          organizerId: meeting.organizerId ?? '',
          summary: meeting.summary,
          finalNotes: meeting.finalNotes,
        }
      : {
          date: defaultDate ?? osloToday(),
          title: t('meetings.defaultTitle'),
          status: 'planned',
          startTime: '14:00',
          location: '',
          organizerId: '',
          summary: null,
          finalNotes: null,
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction(
    async (input: MeetingInput) => {
      if (meeting) {
        await api.updateMeeting(meeting.id, input);
        return { date: input.date };
      }
      const created = await api.createMeeting(input);
      return { date: created.date };
    },
    {
      success: 'common.saved',
      onSuccess: (r) => {
        onClose();
        onSaved?.(r);
      },
    },
  );
  const set = (key: keyof MeetingInput) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={meeting ? t('meeting.edit') : t('meetings.new')}
      submitting={save.isPending}
      onSubmit={() => {
        const parsed = meetingSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        setErrors({});
        save.mutate(values);
      }}
    >
      <TextField label={t('meetings.date')} type="date" value={values.date} onChange={set('date')} error={errors.date} required />
      <TextField label={t('meetings.titleField')} value={values.title} onChange={set('title')} error={errors.title} maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t('meetings.status')} value={values.status} onChange={set('status')}>
          {(['planned', 'ongoing', 'completed', 'skipped'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </SelectField>
        <TextField label={t('meetings.startTime')} type="time" value={values.startTime ?? ''} onChange={set('startTime')} error={errors.startTime} />
      </div>
      <TextField label={t('meetings.location')} value={values.location ?? ''} onChange={set('location')} optional maxLength={120} />
      <SelectField label={t('meetings.organizer')} value={values.organizerId ?? ''} onChange={set('organizerId')}>
        <option value="">{t('meeting.organizerNone')}</option>
        {dir.activeParticipants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </SelectField>
    </FormModal>
  );
}

// ---------------------------------------------------------------- agenda
export function AgendaItemFormModal({
  open,
  onClose,
  item,
  defaultMeetingId,
  allowMeetingChoice = true,
}: {
  open: boolean;
  onClose: () => void;
  item?: AgendaItem;
  defaultMeetingId?: string | null;
  allowMeetingChoice?: boolean;
}) {
  const { t, locale } = useI18n();
  const api = useApi();
  const dir = useDirectory();
  const meetings = useMeetings();
  const today = osloToday();
  const [values, setValues] = useState<AgendaItemInput>(() => ({
    meetingId: item ? (item.meetingId ?? '') : (defaultMeetingId ?? ''),
    kind: item?.kind ?? 'topic',
    title: item?.title ?? '',
    description: item?.description ?? '',
    link: item?.link ?? '',
    highPriority: item?.highPriority ?? false,
    assigneeId: item?.assigneeId ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction(
    (input: AgendaItemInput) => (item ? api.updateAgendaItem(item.id, input) : api.addAgendaItem(input)),
    { success: 'common.saved', onSuccess: onClose },
  );
  const set = (key: keyof AgendaItemInput) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  // upcoming meetings, plus the item's current meeting
  const meetingOptions = (meetings.data ?? [])
    .filter((m) => (m.date >= today && m.status !== 'skipped') || m.id === values.meetingId)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={item ? t('common.edit') : t('agenda.suggest')}
      submitting={save.isPending}
      onSubmit={() => {
        const parsed = agendaItemSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        setErrors({});
        save.mutate(values);
      }}
    >
      <TextField label={t('agenda.itemTitle')} value={values.title} onChange={set('title')} error={errors.title} maxLength={200} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t('agenda.kind')} value={values.kind} onChange={set('kind')}>
          <option value="topic">{t('agenda.kind.topic')}</option>
          <option value="activity">{t('agenda.kind.activity')}</option>
        </SelectField>
        <SelectField label={t('agenda.assignee')} value={values.assigneeId ?? ''} onChange={set('assigneeId')}>
          <option value="">{t('common.unassigned')}</option>
          {dir.activeParticipants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </SelectField>
      </div>
      {allowMeetingChoice && (
        <SelectField label={t('agenda.meeting')} value={values.meetingId ?? ''} onChange={set('meetingId')}>
          <option value="">{t('agenda.noMeeting')}</option>
          {meetingOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {formatLongDate(m.date, locale)} – {m.title}
            </option>
          ))}
        </SelectField>
      )}
      <TextArea label={t('agenda.description')} value={values.description ?? ''} onChange={set('description')} optional maxLength={4000} />
      <TextField label={t('agenda.link')} type="url" inputMode="url" value={values.link ?? ''} onChange={set('link')} error={errors.link} optional placeholder="https://" />
      <Checkbox
        label={t('agenda.priority')}
        checked={values.highPriority}
        onChange={(e) => setValues((v) => ({ ...v, highPriority: e.target.checked }))}
      />
    </FormModal>
  );
}

/** Agenda list with check-off, reorder, edit, delete and votes. */
export function AgendaList({
  items,
  meeting,
  showVotes,
  emptyAction,
}: {
  items: AgendaItem[];
  meeting: Meeting | null;
  showVotes?: boolean;
  emptyAction?: ReactNode;
}) {
  const { t } = useI18n();
  const api = useApi();
  const me = useMe();
  const dir = useDirectory();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const toggle = useAction((a: { id: string; completed: boolean }) => api.setAgendaCompleted(a.id, a.completed));
  const reorder = useAction((ids: string[]) => api.reorderAgenda(meeting?.id ?? '', ids));
  const remove = useAction((id: string) => api.deleteAgendaItem(id), { success: 'common.deleted' });
  const vote = useAction((a: { id: string; vote: boolean }) => api.toggleVote(a.id, a.vote));
  const canReorder = !!meeting && canManageMeeting(me, meeting);

  if (items.length === 0) {
    return <EmptyState compact title={t('agenda.empty')} hint={t('agenda.emptyHint')} action={emptyAction} />;
  }

  const move = (index: number, delta: number) => {
    const ids = items.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    reorder.mutate(ids);
  };

  return (
    <>
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => {
          const assignee = dir.person(item.assigneeId);
          const voted = !!me && item.votes.includes(me.id);
          return (
            <li
              key={item.id}
              className={cx(
                'group flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors',
                item.completed && 'bg-surface-2/60',
              )}
            >
              {item.meetingId ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.completed}
                  aria-label={item.completed ? t('agenda.markUndone') : t('agenda.markDone')}
                  onClick={() => toggle.mutate({ id: item.id, completed: !item.completed })}
                  className="mt-0.5 shrink-0 text-primary"
                >
                  {item.completed ? <CheckCircle2 className="size-6" aria-hidden /> : <Circle className="size-6 text-muted" aria-hidden />}
                </button>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className={cx('font-medium', item.completed && 'text-muted line-through')}>{item.title}</p>
                  {item.highPriority && (
                    <Badge tone="danger">
                      <Flag className="size-3" aria-hidden />
                      {t('agenda.priority')}
                    </Badge>
                  )}
                  <Badge tone={item.kind === 'activity' ? 'accent' : 'neutral'}>{t(`agenda.kind.${item.kind}`)}</Badge>
                  <DemoBadge show={item.isDemo} />
                </div>
                {item.description && <p className="mt-1 whitespace-pre-line text-sm text-muted">{item.description}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
                  {assignee && (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar participant={assignee} size="sm" />
                      {assignee.displayName}
                    </span>
                  )}
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" aria-hidden />
                      {hostname(item.link)}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                {showVotes && (
                  <button
                    type="button"
                    aria-pressed={voted}
                    aria-label={voted ? t('agenda.unvote') : t('agenda.vote')}
                    onClick={() => vote.mutate({ id: item.id, vote: !voted })}
                    className={cx(
                      'mr-1 inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-sm font-medium transition-colors',
                      voted ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-muted hover:text-ink',
                    )}
                  >
                    <ThumbsUp className="size-4" aria-hidden />
                    {item.votes.length}
                  </button>
                )}
                {canReorder && (
                  <span className="hidden sm:inline-flex">
                    <IconButton label={t('common.moveUp')} icon={ArrowUp} disabled={index === 0} onClick={() => move(index, -1)} />
                    <IconButton label={t('common.moveDown')} icon={ArrowDown} disabled={index === items.length - 1} onClick={() => move(index, 1)} />
                  </span>
                )}
                {canEditAgendaItem(me, item, meeting) && (
                  <IconButton label={t('common.edit')} icon={Pencil} onClick={() => setEditing(item)} />
                )}
                {canDeleteAgendaItem(me, item, meeting) && (
                  <IconButton
                    label={t('common.delete')}
                    icon={Trash2}
                    onClick={async () => {
                      if (await confirm(t('common.confirmDelete'))) remove.mutate(item.id);
                    }}
                  />
                )}
              </div>
              {canReorder && (
                <span className="flex flex-col sm:hidden">
                  <IconButton label={t('common.moveUp')} icon={ArrowUp} disabled={index === 0} onClick={() => move(index, -1)} />
                  <IconButton label={t('common.moveDown')} icon={ArrowDown} disabled={index === items.length - 1} onClick={() => move(index, 1)} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {editing && <AgendaItemFormModal open onClose={() => setEditing(null)} item={editing} />}
    </>
  );
}

// ---------------------------------------------------------------- scores
export function ScoreFormModal({
  open,
  onClose,
  entry,
  meetingId,
}: {
  open: boolean;
  onClose: () => void;
  entry?: { id: string } & Omit<ScoreInput, 'points'> & { points: number };
  meetingId?: string;
}) {
  const { t, locale } = useI18n();
  const api = useApi();
  const me = useMe();
  const dir = useDirectory();
  const meetings = useMeetings();
  const [subjectType, setSubjectType] = useState<'participant' | 'team'>(entry?.teamId ? 'team' : 'participant');
  const [values, setValues] = useState({
    meetingId: entry?.meetingId ?? meetingId ?? '',
    activity: entry?.activity ?? '',
    participantId: entry?.participantId ?? '',
    teamId: entry?.teamId ?? '',
    points: entry ? String(entry.points) : '',
    comment: entry?.comment ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction((input: ScoreInput) => (entry ? api.updateScore(entry.id, input) : api.addScore(input)), {
    success: 'common.saved',
    onSuccess: onClose,
  });
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const manageable = (meetings.data ?? []).filter((m) => canManageMeeting(me, m) && m.status !== 'skipped');
  const knownActivities = useMemo(() => ['Quiz', 'Bordtennis', 'Lagkonkurranse', 'Kahoot', 'Foosball'], []);

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={entry ? t('common.edit') : t('scores.add')}
      submitting={save.isPending}
      onSubmit={() => {
        const input: ScoreInput = {
          meetingId: values.meetingId,
          activity: values.activity,
          participantId: subjectType === 'participant' ? values.participantId : null,
          teamId: subjectType === 'team' ? values.teamId : null,
          points: values.points.trim() === '' ? Number.NaN : Number(values.points),
          comment: values.comment,
        };
        const parsed = scoreSchema.safeParse(input);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        setErrors({});
        save.mutate(input);
      }}
    >
      {!meetingId && (
        <SelectField label={t('scores.meeting')} value={values.meetingId} onChange={set('meetingId')} error={errors.meetingId ? 'required' : undefined}>
          <option value="">–</option>
          {manageable.map((m) => (
            <option key={m.id} value={m.id}>
              {formatLongDate(m.date, locale)} – {m.title}
            </option>
          ))}
        </SelectField>
      )}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t('scores.subject')}>
        {(['participant', 'team'] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={subjectType === type}
            onClick={() => setSubjectType(type)}
            className={cx('rounded-lg py-2 text-sm font-medium', subjectType === type ? 'bg-surface shadow-sm' : 'text-muted')}
          >
            {type === 'participant' ? t('scores.participant') : t('scores.team')}
          </button>
        ))}
      </div>
      {subjectType === 'participant' ? (
        <SelectField label={t('scores.participant')} value={values.participantId} onChange={set('participantId')} error={errors.participantId}>
          <option value="">–</option>
          {dir.activeParticipants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </SelectField>
      ) : (
        <SelectField label={t('scores.team')} value={values.teamId} onChange={set('teamId')} error={errors.participantId}>
          <option value="">–</option>
          {dir.teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </SelectField>
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField label={t('scores.activity')} value={values.activity} onChange={set('activity')} list="known-activities" error={errors.activity} maxLength={120} />
        <TextField label={t('scores.points')} type="number" inputMode="numeric" step={1} value={values.points} onChange={set('points')} error={errors.points} />
      </div>
      <datalist id="known-activities">
        {knownActivities.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <TextField label={t('scores.comment')} value={values.comment ?? ''} onChange={set('comment')} optional maxLength={500} />
    </FormModal>
  );
}

const medal = ['bg-gold text-white', 'bg-silver text-white', 'bg-bronze text-white'];

export function Leaderboard({ rows, compact, linkParticipants = true }: { rows: LeaderboardRow[]; compact?: boolean; linkParticipants?: boolean }) {
  const { t, locale } = useI18n();
  const dir = useDirectory();
  if (rows.length === 0) return <EmptyState compact icon={Trophy} title={t('scores.empty')} />;
  const top = rows[0]?.totalPoints ?? 1;
  return (
    <ol className="flex flex-col gap-2" aria-label={t('scores.title')}>
      {rows.map((row) => {
        const person = row.subjectType === 'participant' ? dir.person(row.subjectId) : undefined;
        const content = (
          <>
            <span
              className={cx(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                medal[row.rank - 1] ?? 'bg-surface-2 text-muted',
              )}
              aria-label={`${t('scores.rank')} ${row.rank}`}
            >
              {row.rank}
            </span>
            {person ? (
              <Avatar participant={person} size="sm" />
            ) : (
              <span className="inline-block size-7 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.name}</p>
              {!compact && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full bg-chart" style={{ width: `${Math.max(4, (row.totalPoints / Math.max(1, top)) * 100)}%` }} />
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{formatPoints(row.totalPoints, locale)}</p>
              {!compact && <p className="text-xs text-muted">{t('scores.meetingsCount', { count: row.meetings })}</p>}
            </div>
          </>
        );
        return (
          <li key={`${row.subjectType}-${row.subjectId}`}>
            {person && linkParticipants ? (
              <Link to={`/deltakere/${person.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-surface-2">
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl px-2 py-1.5">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function useIsAdmin() {
  return isAdmin(useMe());
}
