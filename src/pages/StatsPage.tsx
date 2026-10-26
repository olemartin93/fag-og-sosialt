import { Link } from 'react-router-dom';
import { Award, LineChart, ThumbsDown, ThumbsUp, Trophy, Users } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useLeaderboard, useMeetings, useParticipantStats, useRatingStats } from '../lib/queries';
import { formatLongDate, formatShortDate, osloToday } from '../lib/dates';
import { formatScore, summarizeRatings } from '../lib/stats';
import type { MeetingRatingStats } from '../lib/types';
import { Avatar, Card, CardHeader, cx, EmptyState, ErrorState, PageHeader, Skeleton, StatTile } from '../components/ui/primitives';
import { RatingLineChart } from '../components/rating';
import { Leaderboard, useDirectory } from '../components/shared';

function MeetingHighlight({ title, stats, icon: Icon }: { title: string; stats: MeetingRatingStats | null; icon: typeof ThumbsUp }) {
  const { locale, t } = useI18n();
  return (
    <Card>
      <CardHeader title={title} icon={Icon} />
      {stats ? (
        <Link to={`/moter/${stats.date}?fane=vurdering`} className="block rounded-2xl hover:opacity-80">
          <p className="text-3xl font-semibold tabular-nums">{formatScore(stats.average, locale)}</p>
          <p className="mt-1 font-medium">{stats.title}</p>
          <p className="text-sm text-muted">
            {formatLongDate(stats.date, locale)} · {t('common.votes', { count: stats.count })}
          </p>
        </Link>
      ) : (
        <p className="text-sm text-muted">–</p>
      )}
    </Card>
  );
}

export default function StatsPage() {
  const { t, locale } = useI18n();
  const ratingStats = useRatingStats();
  const meetings = useMeetings();
  const leaderboard = useLeaderboard({});
  const pStats = useParticipantStats();
  const dir = useDirectory();
  const today = osloToday();

  if (ratingStats.isError) return <ErrorState error={ratingStats.error} onRetry={() => void ratingStats.refetch()} />;

  const overview = summarizeRatings(ratingStats.data ?? []);
  const held = (meetings.data ?? []).filter((m) => m.status === 'completed' || (m.date < today && m.status !== 'skipped')).length;
  const rated = (ratingStats.data ?? []).filter((s) => s.count > 0).sort((a, b) => b.date.localeCompare(a.date));
  const attendance = [...(pStats.data ?? [])]
    .filter((s) => s.meetingsAttended > 0)
    .sort((a, b) => b.meetingsAttended - a.meetingsAttended)
    .slice(0, 8);

  return (
    <div>
      <PageHeader title={t('stats.title')} subtitle={t('stats.subtitle')} />

      {ratingStats.isPending ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t('stats.totalMeetings')} value={held} />
          <StatTile label={t('stats.overall')} value={formatScore(overview.overallAverage, locale)} tone="primary" />
          <StatTile label={t('stats.lastFive')} value={formatScore(overview.lastFiveAverage, locale)} tone="accent" />
          <StatTile label={t('stats.totalVotes')} value={overview.totalVotes} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader title={t('stats.chart')} icon={LineChart} />
          {ratingStats.isPending ? <Skeleton className="h-56" /> : <RatingLineChart stats={ratingStats.data ?? []} />}
        </Card>

        <MeetingHighlight title={t('stats.best')} stats={overview.best} icon={ThumbsUp} />
        <MeetingHighlight title={t('stats.worst')} stats={overview.worst} icon={ThumbsDown} />

        <Card>
          <CardHeader title={t('stats.attendanceRanking')} icon={Users} />
          {attendance.length === 0 ? (
            <EmptyState compact title={t('attendance.none')} />
          ) : (
            <ol className="flex flex-col gap-2">
              {attendance.map((s, i) => {
                const p = dir.person(s.participantId);
                return (
                  <li key={s.participantId} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-right font-semibold tabular-nums text-muted">{i + 1}</span>
                    <Avatar participant={p} size="sm" />
                    <span className="flex-1 truncate">{p?.displayName}</span>
                    <span className="font-semibold tabular-nums">{s.meetingsAttended}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('stats.table')} icon={Award} />
          {rated.length === 0 ? (
            <EmptyState compact title={t('home.noRatings')} />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="px-2 py-2 font-medium">{t('meetings.date')}</th>
                    <th className="px-2 py-2 font-medium">{t('rating.average')}</th>
                    <th className="px-2 py-2 font-medium">{t('rating.votes')}</th>
                    <th className="px-2 py-2 font-medium">
                      {t('rating.highest')}/{t('rating.lowest')}
                    </th>
                    <th className="px-2 py-2 font-medium">{t('stats.change')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rated.map((s, i) => {
                    const prev = rated[i + 1];
                    const change = prev && s.average !== null && prev.average !== null ? Math.round((s.average - prev.average) * 10) / 10 : null;
                    return (
                      <tr key={s.meetingId} className="border-t border-line">
                        <td className="px-2 py-2">
                          <Link to={`/moter/${s.date}`} className="font-medium hover:underline">
                            {formatShortDate(s.date, locale)}
                          </Link>
                          <span className="block max-w-48 truncate text-xs text-muted">{s.title}</span>
                        </td>
                        <td className="px-2 py-2 font-semibold tabular-nums">{formatScore(s.average, locale)}</td>
                        <td className="px-2 py-2 tabular-nums">{s.count}</td>
                        <td className="px-2 py-2 tabular-nums">
                          {s.max}/{s.min}
                        </td>
                        <td
                          className={cx(
                            'px-2 py-2 tabular-nums',
                            change !== null && change > 0 && 'text-success',
                            change !== null && change < 0 && 'text-danger',
                          )}
                        >
                          {change === null ? '–' : `${change > 0 ? '▲ +' : change < 0 ? '▼ ' : ''}${formatScore(change, locale)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t('stats.participantRanking')} icon={Trophy} />
          {leaderboard.isPending ? (
            <Skeleton className="h-40" />
          ) : (
            <Leaderboard compact rows={(leaderboard.data ?? []).filter((r) => r.subjectType === 'participant').slice(0, 8)} />
          )}
        </Card>
      </div>
    </div>
  );
}
