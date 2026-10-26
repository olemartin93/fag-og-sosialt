import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Circle, ListTodo, Pencil, Plus, Printer, Trash2, Trophy, Users } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { useApi, useMe } from '../../lib/session';
import { useAction, useLeaderboard, useRatingStats } from '../../lib/queries';
import { formatDateTime, formatLongDate, formatShortDate, osloToday } from '../../lib/dates';
import {
  canDeleteTask,
  canEditActivity,
  canEditNote,
  canEditTask,
  canManageMeeting,
  canManageScores,
  canRate,
  canToggleAttendance,
  isMember,
} from '../../lib/permissions';
import { formatPoints, formatScore, previousRated, summarizeRatings } from '../../lib/stats';
import {
  activitySchema,
  fieldErrors,
  noteSchema,
  taskSchema,
  type ActivityInput,
  type NoteInput,
  type TaskInput,
} from '../../lib/validation';
import type { Activity, MeetingBundle, MeetingNote, NoteKind, ScoreEntry, Task } from '../../lib/types';
import { Avatar, Badge, Button, Card, CardHeader, cx, DemoBadge, EmptyState, IconButton, StatTile } from '../../components/ui/primitives';
import { Checkbox, FormModal, SelectField, TextArea, TextField, useConfirm } from '../../components/ui/forms';
import { AgendaItemFormModal, AgendaList, Leaderboard, ScoreFormModal, useDirectory } from '../../components/shared';
import { RatingDistribution, RatingGauge, RatingPicker } from '../../components/rating';

// ---------------------------------------------------------------- agenda
export function AgendaSection({ bundle }: { bundle: MeetingBundle }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const done = bundle.agenda.filter((a) => a.completed).length;
  return (
    <Card>
      <CardHeader
        title={t('tab.agenda')}
        action={
          <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
            {t('agenda.add')}
          </Button>
        }
      />
      {bundle.agenda.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{t('agenda.progress', { done, total: bundle.agenda.length })}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-chart transition-[width]" style={{ width: `${(done / bundle.agenda.length) * 100}%` }} />
          </div>
        </div>
      )}
      <AgendaList items={bundle.agenda} meeting={bundle.meeting} showVotes />
      {adding && <AgendaItemFormModal open onClose={() => setAdding(false)} defaultMeetingId={bundle.meeting.id} />}
    </Card>
  );
}

// ---------------------------------------------------------------- notes & tasks
const NOTE_KINDS: NoteKind[] = ['discussion', 'decision', 'takeaway', 'note'];

function NoteModal({ meetingId, note, onClose, defaultKind }: { meetingId: string; note?: MeetingNote; onClose: () => void; defaultKind?: NoteKind }) {
  const { t } = useI18n();
  const api = useApi();
  const [values, setValues] = useState<NoteInput>({ kind: note?.kind ?? defaultKind ?? 'discussion', content: note?.content ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction((v: NoteInput) => (note ? api.updateNote(note.id, v) : api.addNote(meetingId, v)), {
    success: 'common.saved',
    onSuccess: onClose,
  });
  return (
    <FormModal
      open
      onClose={onClose}
      title={note ? t('common.edit') : t('notes.add')}
      submitting={save.isPending}
      onSubmit={() => {
        const parsed = noteSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        save.mutate(values);
      }}
    >
      <SelectField label={t('notes.kind')} value={values.kind} onChange={(e) => setValues((v) => ({ ...v, kind: e.target.value as NoteKind }))}>
        {NOTE_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`notes.${k}`)}
          </option>
        ))}
      </SelectField>
      <TextArea
        label={t('notes.content')}
        value={values.content}
        onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
        error={errors.content}
        maxLength={4000}
        rows={5}
      />
    </FormModal>
  );
}

function TaskModal({ meetingId, task, onClose }: { meetingId: string; task?: Task; onClose: () => void }) {
  const { t } = useI18n();
  const api = useApi();
  const dir = useDirectory();
  const [values, setValues] = useState<TaskInput>({
    title: task?.title ?? '',
    assigneeId: task?.assigneeId ?? '',
    dueDate: task?.dueDate ?? '',
    done: task?.done ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction((v: TaskInput) => (task ? api.updateTask(task.id, v) : api.addTask(meetingId, v)), {
    success: 'common.saved',
    onSuccess: onClose,
  });
  return (
    <FormModal
      open
      onClose={onClose}
      title={task ? t('common.edit') : t('notes.addTask')}
      submitting={save.isPending}
      onSubmit={() => {
        const parsed = taskSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        save.mutate(values);
      }}
    >
      <TextField label={t('notes.taskTitle')} value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} error={errors.title} maxLength={300} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t('agenda.assignee')} value={values.assigneeId ?? ''} onChange={(e) => setValues((v) => ({ ...v, assigneeId: e.target.value }))}>
          <option value="">{t('common.unassigned')}</option>
          {dir.activeParticipants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('notes.dueDate')}
          type="date"
          value={values.dueDate ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, dueDate: e.target.value }))}
          error={errors.dueDate}
          optional
        />
      </div>
      <Checkbox label={t('notes.done')} checked={values.done} onChange={(e) => setValues((v) => ({ ...v, done: e.target.checked }))} />
    </FormModal>
  );
}

export function NotesSection({ bundle }: { bundle: MeetingBundle }) {
  const { t, locale } = useI18n();
  const api = useApi();
  const me = useMe();
  const dir = useDirectory();
  const confirm = useConfirm();
  const [noteModal, setNoteModal] = useState<{ note?: MeetingNote; kind?: NoteKind } | null>(null);
  const [taskModal, setTaskModal] = useState<{ task?: Task } | null>(null);
  const removeNote = useAction((id: string) => api.deleteNote(id), { success: 'common.deleted' });
  const removeTask = useAction((id: string) => api.deleteTask(id), { success: 'common.deleted' });
  const toggleTask = useAction((task: Task) =>
    api.updateTask(task.id, { title: task.title, assigneeId: task.assigneeId, dueDate: task.dueDate, done: !task.done }),
  );
  const today = osloToday();
  const meeting = bundle.meeting;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        {NOTE_KINDS.map((kind) => {
          const notes = bundle.notes.filter((n) => n.kind === kind);
          return (
            <Card key={kind}>
              <CardHeader
                title={t(`notes.${kind}`)}
                action={
                  isMember(me) && (
                    <IconButton label={t('notes.add')} icon={Plus} onClick={() => setNoteModal({ kind })} />
                  )
                }
              />
              {notes.length === 0 ? (
                <p className="text-sm text-muted">{t('notes.empty')}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {notes.map((n) => (
                    <li key={n.id} className="flex items-start gap-3">
                      <Avatar participant={dir.person(n.authorId)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-line text-sm">{n.content}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {dir.name(n.authorId) ?? '–'} · {formatDateTime(n.createdAt, locale)} <DemoBadge show={n.isDemo} />
                        </p>
                      </div>
                      {canEditNote(me, n, meeting) && (
                        <div className="flex shrink-0">
                          <IconButton label={t('common.edit')} icon={Pencil} onClick={() => setNoteModal({ note: n })} />
                          <IconButton
                            label={t('common.delete')}
                            icon={Trash2}
                            onClick={async () => {
                              if (await confirm(t('common.confirmDelete'))) removeNote.mutate(n.id);
                            }}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title={t('notes.tasks')}
          icon={ListTodo}
          action={
            <Button size="sm" icon={Plus} onClick={() => setTaskModal({})}>
              {t('notes.addTask')}
            </Button>
          }
        />
        {bundle.tasks.length === 0 ? (
          <p className="text-sm text-muted">{t('notes.noTasks')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bundle.tasks.map((task) => {
              const editable = canEditTask(me, task, meeting);
              const overdue = !task.done && !!task.dueDate && task.dueDate < today;
              return (
                <li key={task.id} className="flex items-start gap-3 rounded-2xl border border-line p-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={task.done}
                    aria-label={task.title}
                    disabled={!editable}
                    onClick={() => toggleTask.mutate(task)}
                    className="mt-0.5 shrink-0 text-primary disabled:opacity-50"
                  >
                    {task.done ? <CheckCircle2 className="size-5" aria-hidden /> : <Circle className="size-5 text-muted" aria-hidden />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm font-medium', task.done && 'text-muted line-through')}>{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{dir.name(task.assigneeId) ?? t('common.unassigned')}</span>
                      {task.dueDate && (
                        <Badge tone={overdue ? 'danger' : 'neutral'}>
                          {overdue ? `${t('notes.overdue')}: ` : `${t('notes.dueDate')}: `}
                          {formatShortDate(task.dueDate, locale)}
                        </Badge>
                      )}
                      <DemoBadge show={task.isDemo} />
                    </div>
                  </div>
                  {editable && <IconButton label={t('common.edit')} icon={Pencil} onClick={() => setTaskModal({ task })} />}
                  {canDeleteTask(me, task, meeting) && (
                    <IconButton
                      label={t('common.delete')}
                      icon={Trash2}
                      onClick={async () => {
                        if (await confirm(t('common.confirmDelete'))) removeTask.mutate(task.id);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {noteModal && <NoteModal meetingId={meeting.id} note={noteModal.note} defaultKind={noteModal.kind} onClose={() => setNoteModal(null)} />}
      {taskModal && <TaskModal meetingId={meeting.id} task={taskModal.task} onClose={() => setTaskModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- activities
function ActivityModal({ meetingId, activity, onClose }: { meetingId: string; activity?: Activity; onClose: () => void }) {
  const { t } = useI18n();
  const api = useApi();
  const [values, setValues] = useState<ActivityInput>({
    name: activity?.name ?? '',
    description: activity?.description ?? '',
    result: activity?.result ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction(
    (v: ActivityInput) => (activity ? api.updateActivity(activity.id, v) : api.addActivity(meetingId, v)),
    { success: 'common.saved', onSuccess: onClose },
  );
  return (
    <FormModal
      open
      onClose={onClose}
      title={activity ? t('common.edit') : t('activities.add')}
      submitting={save.isPending}
      onSubmit={() => {
        const parsed = activitySchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        save.mutate(values);
      }}
    >
      <TextField label={t('activities.name')} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} error={errors.name} maxLength={120} />
      <TextArea
        label={t('activities.description')}
        value={values.description ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
        optional
        rows={3}
      />
      <TextArea
        label={t('activities.result')}
        value={values.result ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, result: e.target.value }))}
        optional
        rows={3}
      />
    </FormModal>
  );
}

export function ActivitiesSection({ bundle }: { bundle: MeetingBundle }) {
  const { t } = useI18n();
  const api = useApi();
  const me = useMe();
  const confirm = useConfirm();
  const [modal, setModal] = useState<{ activity?: Activity } | null>(null);
  const remove = useAction((id: string) => api.deleteActivity(id), { success: 'common.deleted' });
  return (
    <Card>
      <CardHeader
        title={t('activities.title')}
        action={
          <Button size="sm" icon={Plus} onClick={() => setModal({})}>
            {t('activities.add')}
          </Button>
        }
      />
      {bundle.activities.length === 0 ? (
        <EmptyState compact title={t('activities.empty')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {bundle.activities.map((a) => (
            <li key={a.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">
                  {a.name} <DemoBadge show={a.isDemo} />
                </p>
                {canEditActivity(me, a, bundle.meeting) && (
                  <div className="-mr-2 -mt-1 flex">
                    <IconButton label={t('common.edit')} icon={Pencil} onClick={() => setModal({ activity: a })} />
                    <IconButton
                      label={t('common.delete')}
                      icon={Trash2}
                      onClick={async () => {
                        if (await confirm(t('common.confirmDelete'))) remove.mutate(a.id);
                      }}
                    />
                  </div>
                )}
              </div>
              {a.description && <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.description}</p>}
              {a.result && (
                <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
                  <span className="font-medium">{t('activities.result')}:</span> {a.result}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {modal && <ActivityModal meetingId={bundle.meeting.id} activity={modal.activity} onClose={() => setModal(null)} />}
    </Card>
  );
}

// ---------------------------------------------------------------- scores
export function ScoreLog({ entries, history, editable }: { entries: ScoreEntry[]; history?: MeetingBundle['history']; editable: (e: ScoreEntry) => boolean }) {
  const { t, locale } = useI18n();
  const api = useApi();
  const dir = useDirectory();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<ScoreEntry | null>(null);
  const remove = useAction((id: string) => api.deleteScore(id), { success: 'common.deleted' });
  return (
    <>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">{t('scores.empty')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              {e.participantId ? (
                <Avatar participant={dir.person(e.participantId)} size="sm" />
              ) : (
                <span className="inline-block size-7 shrink-0 rounded-full" style={{ backgroundColor: dir.team(e.teamId)?.color }} aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {dir.name(e.participantId) ?? dir.team(e.teamId)?.name ?? '?'}
                  <span className="font-normal text-muted"> · {e.activity}</span>
                </p>
                {e.comment && <p className="truncate text-xs text-muted">{e.comment}</p>}
              </div>
              <DemoBadge show={e.isDemo} />
              <span className={cx('font-semibold tabular-nums', e.points < 0 && 'text-danger')}>
                {e.points > 0 ? '+' : ''}
                {formatPoints(e.points, locale)}
              </span>
              {editable(e) && (
                <div className="flex">
                  <IconButton label={t('common.edit')} icon={Pencil} onClick={() => setEditing(e)} />
                  <IconButton
                    label={t('common.delete')}
                    icon={Trash2}
                    onClick={async () => {
                      if (await confirm(t('common.confirmDelete'))) remove.mutate(e.id);
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {history && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">{t('scores.history')}</summary>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t('scores.noHistory')}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
              {history.map((h) => (
                <li key={h.id}>
                  {formatDateTime(h.changedAt, locale)} · {dir.name(h.changedBy) ?? '–'} {t(`scores.action.${h.action}`)} {h.subjectName} ({h.activity}):{' '}
                  {h.oldPoints ?? '–'} → {h.newPoints ?? '–'}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      {editing && (
        <ScoreFormModal
          open
          onClose={() => setEditing(null)}
          entry={{ ...editing }}
          meetingId={editing.meetingId}
        />
      )}
    </>
  );
}

export function ScoresSection({ bundle }: { bundle: MeetingBundle }) {
  const { t } = useI18n();
  const me = useMe();
  const leaderboard = useLeaderboard({ meetingId: bundle.meeting.id });
  const [adding, setAdding] = useState(false);
  const manage = canManageScores(me, bundle.meeting);
  const people = (leaderboard.data ?? []).filter((r) => r.subjectType === 'participant');
  const teams = (leaderboard.data ?? []).filter((r) => r.subjectType === 'team');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title={t('scores.meetingResults')}
          icon={Trophy}
          action={
            manage && (
              <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
                {t('scores.add')}
              </Button>
            )
          }
        />
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('scores.individual')}</h3>
        <Leaderboard rows={people} />
        {teams.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t('scores.teams')}</h3>
            <Leaderboard rows={teams} />
          </>
        )}
      </Card>
      <Card>
        <CardHeader title={t('scores.log')} />
        <ScoreLog entries={bundle.scores} history={bundle.history} editable={() => manage} />
      </Card>
      {adding && <ScoreFormModal open onClose={() => setAdding(false)} meetingId={bundle.meeting.id} />}
    </div>
  );
}

// ---------------------------------------------------------------- rating
export function RatingSection({ bundle }: { bundle: MeetingBundle }) {
  const { t, locale } = useI18n();
  const api = useApi();
  const statsQuery = useRatingStats();
  const meeting = bundle.meeting;
  const stats = statsQuery.data?.find((s) => s.meetingId === meeting.id);
  const overview = summarizeRatings(statsQuery.data ?? []);
  const previous = previousRated(statsQuery.data ?? [], meeting.date);
  const rate = useAction((score: number) => api.rateMeeting(meeting.id, score), { success: 'rating.saved' });
  const remove = useAction(() => api.removeRating(meeting.id), { success: 'common.deleted' });
  const allowed = canRate(meeting, osloToday());
  const diff = (a: number | null | undefined, b: number | null | undefined) =>
    a === null || a === undefined || b === null || b === undefined ? null : Math.round((a - b) * 10) / 10;
  const vsPrev = diff(stats?.average, previous?.average);
  const vsAll = diff(stats?.average, overview.overallAverage);
  const signed = (v: number | null) => (v === null ? '–' : `${v > 0 ? '+' : ''}${formatScore(v, locale)}`);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('rating.yours')} />
        {!allowed ? (
          <p className="text-sm text-muted">{meeting.status === 'skipped' ? t('rating.skipped') : t('rating.notYet')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {bundle.myRating ? t('rating.change', { score: bundle.myRating }) : t('rating.choose')}
            </p>
            <RatingPicker value={bundle.myRating} onChange={(s) => rate.mutate(s)} disabled={rate.isPending} />
            {bundle.myRating !== null && (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => remove.mutate()} loading={remove.isPending}>
                {t('rating.remove')}
              </Button>
            )}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title={t('rating.title')} />
        {!stats || stats.count === 0 ? (
          <p className="text-sm text-muted">{t('rating.noVotes')}</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <RatingGauge value={stats.average} size={112} />
              <div className="grid w-full flex-1 grid-cols-2 gap-2">
                <StatTile label={t('rating.votes')} value={stats.count} />
                <StatTile label={`${t('rating.highest')} / ${t('rating.lowest')}`} value={`${stats.max} / ${stats.min}`} />
                <StatTile label={t('rating.vsPrevious')} value={signed(vsPrev)} />
                <StatTile label={t('rating.vsOverall')} value={signed(vsAll)} />
              </div>
            </div>
            <RatingDistribution distribution={stats.distribution} />
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- attendance
export function AttendanceSection({ bundle }: { bundle: MeetingBundle }) {
  const { t } = useI18n();
  const api = useApi();
  const me = useMe();
  const dir = useDirectory();
  const set = useAction((a: { id: string; present: boolean }) => api.setAttendance(bundle.meeting.id, a.id, a.present));
  const present = new Set(bundle.attendance);
  return (
    <Card>
      <CardHeader title={t('attendance.title')} icon={Users} action={<Badge>{t('attendance.count', { count: present.size })}</Badge>} />
      <ul className="grid gap-2 sm:grid-cols-2">
        {dir.participants
          .filter((p) => p.active || present.has(p.id))
          .map((p) => {
            const checked = present.has(p.id);
            const editable = canToggleAttendance(me, p.id, bundle.meeting);
            return (
              <li key={p.id}>
                <label
                  className={cx(
                    'flex items-center gap-3 rounded-2xl border px-3 py-2.5',
                    checked ? 'border-primary bg-primary-soft' : 'border-line',
                    editable ? 'cursor-pointer' : 'opacity-80',
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--primary)]"
                    checked={checked}
                    disabled={!editable}
                    onChange={(e) => set.mutate({ id: p.id, present: e.target.checked })}
                  />
                  <Avatar participant={p} size="sm" />
                  <span className="text-sm font-medium">
                    {p.displayName}
                    {p.id === me?.id && <span className="ml-1 text-muted">({t('participants.you')})</span>}
                  </span>
                </label>
              </li>
            );
          })}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------- summary (referat)
function SummaryBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function SummaryModal({ bundle, onClose }: { bundle: MeetingBundle; onClose: () => void }) {
  const { t } = useI18n();
  const api = useApi();
  const m = bundle.meeting;
  const [summary, setSummary] = useState(m.summary ?? '');
  const [finalNotes, setFinalNotes] = useState(m.finalNotes ?? '');
  const save = useAction(
    () =>
      api.updateMeeting(m.id, {
        date: m.date,
        title: m.title,
        status: m.status,
        startTime: m.startTime,
        location: m.location,
        organizerId: m.organizerId,
        summary,
        finalNotes,
      }),
    { success: 'common.saved', onSuccess: onClose },
  );
  return (
    <FormModal open onClose={onClose} title={t('summary.edit')} submitting={save.isPending} onSubmit={() => save.mutate()} wide>
      <TextArea label={t('summary.text')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={8} maxLength={20000} />
      <TextArea label={t('summary.finalNotes')} value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} rows={4} maxLength={20000} />
    </FormModal>
  );
}

export function SummarySection({ bundle }: { bundle: MeetingBundle }) {
  const { t, locale } = useI18n();
  const me = useMe();
  const dir = useDirectory();
  const statsQuery = useRatingStats();
  const leaderboard = useLeaderboard({ meetingId: bundle.meeting.id });
  const [editing, setEditing] = useState(false);
  const m = bundle.meeting;
  const stats = statsQuery.data?.find((s) => s.meetingId === m.id);
  const people = useMemo(() => bundle.attendance.map((id) => dir.name(id)).filter(Boolean).join(', '), [bundle.attendance, dir]);
  const list = (items: string[]) =>
    items.length === 0 ? (
      <p className="text-sm text-muted">{t('summary.empty')}</p>
    ) : (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((s, i) => (
          <li key={i} className="whitespace-pre-line">
            {s}
          </li>
        ))}
      </ul>
    );

  return (
    <Card className="print-area">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted">{t('summary.title')}</p>
          <h2 className="text-xl font-semibold tracking-tight">{m.title}</h2>
          <p className="text-sm text-muted">{formatLongDate(m.date, locale)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {canManageMeeting(me, m) && (
            <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              {t('summary.edit')}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={Printer} onClick={() => window.print()}>
            {t('summary.print')}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <SummaryBlock title={t('summary.participants')}>
          <p className="text-sm">{people || t('summary.empty')}</p>
        </SummaryBlock>
        <SummaryBlock title={t('summary.text')}>
          <p className="whitespace-pre-line text-sm">{m.summary || t('summary.empty')}</p>
        </SummaryBlock>
        <SummaryBlock title={t('summary.agendaCovered')}>
          {list(bundle.agenda.filter((a) => a.completed).map((a) => `${a.title}${a.assigneeId ? ` (${dir.name(a.assigneeId) ?? ''})` : ''}`))}
        </SummaryBlock>
        <SummaryBlock title={t('summary.discussion')}>
          {list(bundle.notes.filter((n) => n.kind === 'discussion' || n.kind === 'takeaway' || n.kind === 'note').map((n) => n.content))}
        </SummaryBlock>
        <SummaryBlock title={t('summary.decisions')}>{list(bundle.notes.filter((n) => n.kind === 'decision').map((n) => n.content))}</SummaryBlock>
        <SummaryBlock title={t('summary.activities')}>
          {list(bundle.activities.map((a) => `${a.name}${a.result ? ` – ${a.result}` : ''}`))}
        </SummaryBlock>
        <SummaryBlock title={t('summary.scores')}>
          {list(
            (leaderboard.data ?? []).map(
              (r) =>
                `${r.rank}. ${r.name}${r.subjectType === 'team' ? ` (${t('scores.team').toLowerCase()})` : ''}: ${formatPoints(r.totalPoints, locale)} ${t('common.points')}`,
            ),
          )}
        </SummaryBlock>
        <SummaryBlock title={t('summary.tasks')}>
          {list(
            bundle.tasks.map(
              (task) =>
                `${task.title} – ${dir.name(task.assigneeId) ?? t('common.unassigned')}${
                  task.dueDate ? ` (${t('notes.dueDate').toLowerCase()} ${formatShortDate(task.dueDate, locale)})` : ''
                }${task.done ? ` · ${t('notes.done').toLowerCase()}` : ''}`,
            ),
          )}
        </SummaryBlock>
        <SummaryBlock title={t('summary.rating')}>
          <p className="text-sm">
            {stats && stats.count > 0
              ? `${formatScore(stats.average, locale)}/10 · ${t('common.votes', { count: stats.count })}`
              : t('summary.empty')}
          </p>
        </SummaryBlock>
        <SummaryBlock title={t('summary.finalNotes')}>
          <p className="whitespace-pre-line text-sm">{m.finalNotes || t('summary.empty')}</p>
        </SummaryBlock>
      </div>
      {editing && <SummaryModal bundle={bundle} onClose={() => setEditing(false)} />}
    </Card>
  );
}
