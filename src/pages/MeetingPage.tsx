import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, CalendarX, ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Play, CheckCheck, Trash2, UserRound } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApi, useMe } from '../lib/session';
import { useAction, useMeetingBundle, useMeetingByDate, useMeetings } from '../lib/queries';
import { formatLongDate, formatTime, isFriday, isIsoDate, osloToday } from '../lib/dates';
import { canCreateMeetingOn, canManageMeeting, isOrganizer } from '../lib/permissions';
import type { Meeting, MeetingBundle, MeetingStatus } from '../lib/types';
import { Button, Card, cx, DemoBadge, EmptyState, ErrorState, Skeleton, StatusBadge } from '../components/ui/primitives';
import { useConfirm } from '../components/ui/forms';
import { MeetingFormModal, useDirectory } from '../components/shared';
import {
  ActivitiesSection,
  AgendaSection,
  AttendanceSection,
  NotesSection,
  RatingSection,
  ScoresSection,
  SummarySection,
} from './meeting/sections';
import NotFoundPage from './NotFoundPage';

const TABS = [
  { id: 'agenda', label: 'tab.agenda', Component: AgendaSection },
  { id: 'diskusjon', label: 'tab.notes', Component: NotesSection },
  { id: 'aktiviteter', label: 'tab.activities', Component: ActivitiesSection },
  { id: 'poeng', label: 'tab.scores', Component: ScoresSection },
  { id: 'vurdering', label: 'tab.rating', Component: RatingSection },
  { id: 'oppmote', label: 'tab.attendance', Component: AttendanceSection },
  { id: 'referat', label: 'tab.summary', Component: SummarySection },
] as const;

function MeetingNav({ date }: { date: string }) {
  const { t } = useI18n();
  const meetings = useMeetings();
  const sorted = [...(meetings.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const prev = [...sorted].reverse().find((m) => m.date < date);
  const next = sorted.find((m) => m.date > date);
  const cls = 'inline-flex size-9 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink';
  return (
    <div className="no-print flex gap-1.5">
      {prev ? (
        <Link to={`/moter/${prev.date}`} className={cls} aria-label={t('meeting.prev')} title={t('meeting.prev')}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : null}
      {next ? (
        <Link to={`/moter/${next.date}`} className={cls} aria-label={t('meeting.next')} title={t('meeting.next')}>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function MeetingHeader({ meeting }: { meeting: Meeting }) {
  const { t, locale } = useI18n();
  const api = useApi();
  const me = useMe();
  const dir = useDirectory();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const manage = canManageMeeting(me, meeting);
  const setStatus = useAction(
    (status: MeetingStatus) =>
      api.updateMeeting(meeting.id, {
        date: meeting.date,
        title: meeting.title,
        status,
        startTime: meeting.startTime,
        location: meeting.location,
        organizerId: meeting.organizerId,
        summary: meeting.summary,
        finalNotes: meeting.finalNotes,
      }),
    { success: 'common.saved' },
  );
  const remove = useAction(() => api.deleteMeeting(meeting.id), {
    success: 'common.deleted',
    onSuccess: () => navigate('/moter'),
  });
  const organizer = dir.person(meeting.organizerId);

  return (
    <header className="mb-6 flex flex-col gap-4">
      <div className="no-print flex items-center justify-between">
        <Link to="/moter" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {t('nav.meetings')}
        </Link>
        <MeetingNav date={meeting.date} />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">{formatLongDate(meeting.date, locale)}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{meeting.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <StatusBadge status={meeting.status} />
            <DemoBadge show={meeting.isDemo} />
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-4" aria-hidden />
              {organizer?.displayName ?? t('meeting.organizerNone')}
            </span>
            {meeting.startTime && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                {formatTime(meeting.startTime)}
              </span>
            )}
            {meeting.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {meeting.location}
              </span>
            )}
          </div>
        </div>
        {manage && (
          <div className="no-print flex flex-wrap gap-2">
            {meeting.status === 'planned' && (
              <Button icon={Play} onClick={() => setStatus.mutate('ongoing')} loading={setStatus.isPending}>
                {t('meeting.start')}
              </Button>
            )}
            {meeting.status === 'ongoing' && (
              <Button icon={CheckCheck} onClick={() => setStatus.mutate('completed')} loading={setStatus.isPending}>
                {t('meeting.complete')}
              </Button>
            )}
            {(meeting.status === 'completed' || meeting.status === 'skipped') && (
              <Button variant="secondary" onClick={() => setStatus.mutate('planned')} loading={setStatus.isPending}>
                {t('meeting.reopen')}
              </Button>
            )}
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
            {isOrganizer(me) && (
              <Button
                variant="danger"
                icon={Trash2}
                aria-label={t('meeting.delete')}
                onClick={async () => {
                  if (await confirm(t('meeting.deleteConfirm'))) remove.mutate();
                }}
              />
            )}
          </div>
        )}
      </div>
      {editing && (
        <MeetingFormModal
          open
          onClose={() => setEditing(false)}
          meeting={meeting}
          onSaved={(m) => m.date !== meeting.date && navigate(`/moter/${m.date}`, { replace: true })}
        />
      )}
    </header>
  );
}

function MeetingBody({ bundle }: { bundle: MeetingBundle }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const today = osloToday();
  const fallback = bundle.meeting.date < today ? 'referat' : 'agenda';
  const active = TABS.find((tab) => tab.id === params.get('fane')) ?? TABS.find((tab) => tab.id === fallback) ?? TABS[0];
  const Section = active.Component;
  return (
    <>
      <div className="no-print -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label={t('meeting.tabs')} className="inline-flex min-w-max gap-1 rounded-2xl border border-line bg-surface p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={tab.id === active.id}
              aria-controls="meeting-panel"
              onClick={() => setParams({ fane: tab.id }, { replace: true })}
              className={cx(
                'rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                tab.id === active.id ? 'bg-primary text-primary-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>
      </div>
      <div id="meeting-panel" role="tabpanel" aria-labelledby={`tab-${active.id}`}>
        <Section bundle={bundle} />
      </div>
    </>
  );
}

function NotCreated({ date }: { date: string }) {
  const { t, locale } = useI18n();
  const api = useApi();
  const me = useMe();
  const navigate = useNavigate();
  const ensure = useAction((d: string) => api.ensureMeeting(d), { success: 'common.saved' });
  const skip = useAction(
    async (d: string) => {
      const id = await api.ensureMeeting(d);
      const m = await api.getMeetingByDate(d);
      if (m) await api.updateMeeting(id, { ...m, status: 'skipped' });
    },
    { success: 'common.saved' },
  );
  const allowed = canCreateMeetingOn(me, date);
  return (
    <div>
      <Link to="/kalender" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {t('nav.calendar')}
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">{formatLongDate(date, locale)}</h1>
      <Card>
        <EmptyState
          icon={CalendarPlus}
          title={t('meeting.notCreated')}
          hint={allowed ? undefined : t('meeting.cannotCreate')}
          action={
            allowed && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={CalendarPlus} loading={ensure.isPending} onClick={() => ensure.mutate(date)}>
                  {t('meeting.create')}
                </Button>
                {isFriday(date) && isOrganizer(me) && (
                  <Button variant="secondary" icon={CalendarX} loading={skip.isPending} onClick={() => skip.mutate(date)}>
                    {t('meeting.skip')}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => navigate(-1)}>
                  {t('common.back')}
                </Button>
              </div>
            )
          }
        />
      </Card>
    </div>
  );
}

export default function MeetingPage() {
  const { date = '' } = useParams();
  const valid = isIsoDate(date);
  const meetingQuery = useMeetingByDate(date, valid);
  const bundle = useMeetingBundle(meetingQuery.data?.id);

  if (!valid) return <NotFoundPage />;
  if (meetingQuery.isError) return <ErrorState error={meetingQuery.error} onRetry={() => void meetingQuery.refetch()} />;
  if (meetingQuery.isPending) return <Skeleton className="h-64" />;
  if (!meetingQuery.data) return <NotCreated date={date} />;
  if (bundle.isError) return <ErrorState error={bundle.error} onRetry={() => void bundle.refetch()} />;
  if (!bundle.data) return <Skeleton className="h-64" />;

  return (
    <div>
      <MeetingHeader meeting={bundle.data.meeting} />
      <MeetingBody bundle={bundle.data} />
    </div>
  );
}
