import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity as ActivityIcon,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  History,
  ListChecks,
  MessageSquare,
  PartyPopper,
  Star,
  Trophy,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApi, useMe } from '../lib/session';
import { useAction, useAgendaItems, useFeed, useLeaderboard, useMeetings, useRatingStats } from '../lib/queries';
import {
  countdownTo,
  formatDateTime,
  formatLongDate,
  formatTime,
  isFriday,
  nextFriday,
  osloDateTimeToInstant,
  osloToday,
} from '../lib/dates';
import { canCreateMeetingOn, canRate } from '../lib/permissions';
import { formatScore, summarizeRatings } from '../lib/stats';
import type { FeedItem, MeetingOverview } from '../lib/types';
import { Badge, Button, Card, CardHeader, DemoBadge, EmptyState, ErrorState, Skeleton, StatusBadge, TextLink } from '../components/ui/primitives';
import { RatingGauge } from '../components/rating';
import { Leaderboard, useDirectory } from '../components/shared';

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const feedIcon: Record<FeedItem['kind'], typeof MessageSquare> = {
  note: MessageSquare,
  score: Trophy,
  agenda: ListChecks,
  summary: ClipboardList,
};

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const api = useApi();
  const me = useMe();
  const navigate = useNavigate();
  const dir = useDirectory();
  const meetings = useMeetings();
  const ratingStats = useRatingStats();
  const agenda = useAgendaItems();
  const leaderboard = useLeaderboard({});
  const feed = useFeed();
  const now = useNow();
  const today = osloToday(now);

  const list = useMemo(() => meetings.data ?? [], [meetings.data]);
  const todayMeeting = list.find((m) => m.date === today && m.status !== 'skipped');
  const upcoming: MeetingOverview | undefined = [...list]
    .filter((m) => m.date >= today && m.status !== 'skipped' && m.status !== 'completed')
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const last = [...list]
    .filter((m) => (m.date < today || m.status === 'completed') && m.status !== 'skipped')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const overview = summarizeRatings(ratingStats.data ?? []);
  const lastStats = ratingStats.data?.find((s) => s.meetingId === last?.id);
  const upcomingAgenda = (agenda.data ?? [])
    .filter((a) => a.meetingId === upcoming?.id)
    .sort((a, b) => a.position - b.position);
  const nextDate = upcoming?.date ?? nextFriday(today);

  const createToday = useAction((date: string) => api.ensureMeeting(date), {
    onSuccess: () => navigate(`/moter/${today}`),
  });

  if (meetings.isError) return <ErrorState error={meetings.error} onRetry={() => void meetings.refetch()} />;

  const countdown = upcoming ? countdownTo(osloDateTimeToInstant(upcoming.date, upcoming.startTime), now) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted">{formatLongDate(today, locale)}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('home.greeting', { name: me?.displayName.split(' ')[0] ?? '' })}</h1>
      </header>

      {/* Today */}
      {(todayMeeting || isFriday(today)) && (
        <section className="flex flex-col gap-4 rounded-3xl bg-primary p-5 text-primary-ink shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <PartyPopper className="size-8 shrink-0" aria-hidden />
            <div>
              <p className="text-lg font-semibold">{todayMeeting?.title ?? t('home.todayIsFriday')}</p>
              <p className="text-sm opacity-80">{formatLongDate(today, locale)}</p>
            </div>
          </div>
          {todayMeeting ? (
            <Link
              to={`/moter/${today}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-surface px-6 font-semibold text-primary shadow-sm hover:bg-surface-2"
            >
              {t('home.openToday')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : canCreateMeetingOn(me, today) ? (
            <Button variant="accent" size="lg" loading={createToday.isPending} onClick={() => createToday.mutate(today)}>
              {t('home.createToday')}
            </Button>
          ) : null}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Next Friday */}
        <Card className="lg:col-span-2">
          <CardHeader title={t('home.nextFriday')} icon={CalendarClock} />
          {meetings.isPending ? (
            <Skeleton className="h-24" />
          ) : upcoming ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Link to={`/moter/${upcoming.date}`} className="text-xl font-semibold tracking-tight hover:underline">
                  {formatLongDate(upcoming.date, locale)}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {upcoming.title}
                  {upcoming.startTime && ` · ${formatTime(upcoming.startTime)}`}
                  {upcoming.location && ` · ${upcoming.location}`}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <StatusBadge status={upcoming.status} />
                  <DemoBadge show={upcoming.isDemo} />
                </div>
              </div>
              {countdown && (
                <div className="rounded-2xl bg-accent-soft px-4 py-3 text-accent" aria-live="off">
                  <p className="text-xl font-semibold tabular-nums">
                    {countdown.isPast ? t('home.startsNow') : t('home.countdown', { days: countdown.days, hours: countdown.hours, minutes: countdown.minutes })}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              compact
              title={t('home.noUpcoming')}
              action={
                <Link
                  to={`/moter/${nextDate}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-ink"
                >
                  {t('home.planNext')}
                </Link>
              }
            />
          )}
        </Card>

        {/* Average rating */}
        <Card>
          <CardHeader title={t('home.averageRating')} icon={Star} />
          {ratingStats.isPending ? (
            <Skeleton className="mx-auto size-32 rounded-full" />
          ) : overview.overallAverage === null ? (
            <EmptyState compact title={t('home.noRatings')} />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <RatingGauge value={overview.overallAverage} />
              <p className="text-sm text-muted">
                {t('home.ratingBasis', { votes: overview.totalVotes, meetings: overview.ratedMeetings })}
              </p>
              <TextLink to="/statistikk">{t('common.seeAll')}</TextLink>
            </div>
          )}
        </Card>

        {/* Last meeting */}
        <Card>
          <CardHeader title={t('home.lastMeeting')} icon={History} />
          {meetings.isPending ? (
            <Skeleton className="h-28" />
          ) : last ? (
            <div className="flex flex-col gap-3">
              <div>
                <Link to={`/moter/${last.date}`} className="font-semibold hover:underline">
                  {last.title}
                </Link>
                <p className="text-sm text-muted">{formatLongDate(last.date, locale)}</p>
              </div>
              {last.summary && <p className="line-clamp-3 text-sm">{last.summary}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {lastStats?.average !== null && lastStats?.average !== undefined && (
                  <Badge tone="primary">
                    <Star className="size-3" aria-hidden />
                    {formatScore(lastStats.average, locale)} · {t('common.votes', { count: lastStats.count })}
                  </Badge>
                )}
                <Badge>{t('home.notesCount', { count: last.notesCount })}</Badge>
                <DemoBadge show={last.isDemo} />
              </div>
              {canRate(last, today) && (
                <TextLink to={`/moter/${last.date}?fane=vurdering`}>{t('home.rateLast')} →</TextLink>
              )}
            </div>
          ) : (
            <EmptyState compact title={t('home.noLastMeeting')} />
          )}
        </Card>

        {/* Agenda preview */}
        <Card>
          <CardHeader
            title={t('home.agendaPreview')}
            icon={ListChecks}
            action={<TextLink to={upcoming ? `/moter/${upcoming.date}` : '/agenda'}>{t('common.seeAll')}</TextLink>}
          />
          {agenda.isPending ? (
            <Skeleton className="h-28" />
          ) : upcomingAgenda.length === 0 ? (
            <EmptyState compact title={t('home.noAgenda')} />
          ) : (
            <ol className="flex flex-col gap-2">
              {upcomingAgenda.slice(0, 5).map((item, i) => (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums text-muted">
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    {item.title}
                    {item.assigneeId && <span className="block text-xs text-muted">{dir.name(item.assigneeId)}</span>}
                  </span>
                  {item.highPriority && <Badge tone="danger">!</Badge>}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Scoreboard preview */}
        <Card>
          <CardHeader
            title={t('home.scoreboardPreview')}
            icon={Trophy}
            action={<TextLink to="/poengtavle">{t('common.seeAll')}</TextLink>}
          />
          {leaderboard.isPending ? (
            <Skeleton className="h-28" />
          ) : (
            <Leaderboard compact rows={(leaderboard.data ?? []).filter((r) => r.subjectType === 'participant').slice(0, 5)} />
          )}
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-3">
          <CardHeader title={t('home.recentActivity')} icon={ActivityIcon} />
          {feed.isPending ? (
            <Skeleton className="h-32" />
          ) : (feed.data ?? []).length === 0 ? (
            <EmptyState compact title={t('home.noActivity')} />
          ) : (
            <ul className="divide-y divide-line">
              {(feed.data ?? []).map((item) => {
                const Icon = feedIcon[item.kind];
                const href = item.meetingDate ? `/moter/${item.meetingDate}` : '/agenda';
                return (
                  <li key={`${item.kind}-${item.itemId}`}>
                    <Link to={href} className="flex items-start gap-3 py-3 hover:opacity-80">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{item.label}</p>
                        <p className="text-xs text-muted">
                          {t(`feed.${item.kind}`)}
                          {item.actorName && ` · ${t('common.by', { name: item.actorName })}`}
                          {' · '}
                          {formatDateTime(item.at, locale)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
