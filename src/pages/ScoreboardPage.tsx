import { useMemo, useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useMe } from '../lib/session';
import { useLeaderboard, useMeetings, useScores } from '../lib/queries';
import { endOfMonth, formatLongDate, formatShortDate, osloToday, startOfMonth } from '../lib/dates';
import { canManageScores, isOrganizer } from '../lib/permissions';
import { formatPoints } from '../lib/stats';
import type { LeaderboardFilter, LeaderboardRow } from '../lib/types';
import { Avatar, Button, Card, CardHeader, cx, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives';
import { SelectField } from '../components/ui/forms';
import { Leaderboard, ScoreFormModal, useDirectory } from '../components/shared';
import { ScoreLog } from './meeting/sections';

type Period = 'all' | 'month' | 'year' | 'meeting';

function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const { locale } = useI18n();
  const dir = useDirectory();
  const top = rows.slice(0, 3);
  if (top.length < 2) return null;
  const order = [top[1], top[0], top[2]].filter((r): r is LeaderboardRow => !!r);
  const heights = ['h-16', 'h-24', 'h-12'];
  const colors = ['bg-silver', 'bg-gold', 'bg-bronze'];
  return (
    <div className="mb-6 flex items-end justify-center gap-3" aria-hidden>
      {order.map((row) => {
        const slot = row === top[0] ? 1 : row === top[1] ? 0 : 2;
        return (
          <div key={row.subjectId} className="flex w-24 flex-col items-center gap-2">
            {row.subjectType === 'participant' ? (
              <Avatar participant={dir.person(row.subjectId)} size={slot === 1 ? 'lg' : 'md'} />
            ) : (
              <span className="size-10 rounded-full" style={{ backgroundColor: row.color }} />
            )}
            <p className="w-full truncate text-center text-xs font-medium">{row.name}</p>
            <div className={cx('flex w-full items-start justify-center rounded-t-xl pt-2 text-sm font-semibold text-white', heights[slot], colors[slot])}>
              {formatPoints(row.totalPoints, locale)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ScoreboardPage() {
  const { t, locale } = useI18n();
  const me = useMe();
  const meetings = useMeetings();
  const scores = useScores();
  const [period, setPeriod] = useState<Period>('all');
  const [meetingId, setMeetingId] = useState('');
  const [activity, setActivity] = useState('');
  const [view, setView] = useState<'participant' | 'team'>('participant');
  const [adding, setAdding] = useState(false);
  const today = osloToday();

  const filter = useMemo<LeaderboardFilter>(() => {
    const f: LeaderboardFilter = {};
    if (period === 'month') {
      f.from = startOfMonth(today);
      f.to = endOfMonth(today);
    } else if (period === 'year') {
      f.from = `${today.slice(0, 4)}-01-01`;
      f.to = `${today.slice(0, 4)}-12-31`;
    } else if (period === 'meeting' && meetingId) {
      f.meetingId = meetingId;
    }
    if (activity) f.activity = activity;
    return f;
  }, [period, meetingId, activity, today]);

  const leaderboard = useLeaderboard(filter);
  const rows = (leaderboard.data ?? []).filter((r) => r.subjectType === view);
  const activities = useMemo(
    () => [...new Set((scores.data ?? []).map((s) => s.activity))].sort((a, b) => a.localeCompare(b, 'nb')),
    [scores.data],
  );
  const meetingDate = useMemo(() => new Map((meetings.data ?? []).map((m) => [m.id, m])), [meetings.data]);
  const visibleLog = (scores.data ?? []).filter((s) => {
    const m = meetingDate.get(s.meetingId);
    if (!m) return false;
    if (filter.from && m.date < filter.from) return false;
    if (filter.to && m.date > filter.to) return false;
    if (filter.meetingId && s.meetingId !== filter.meetingId) return false;
    if (filter.activity && s.activity !== filter.activity) return false;
    return true;
  });
  const meetingsWithScores = (meetings.data ?? []).filter((m) => (scores.data ?? []).some((s) => s.meetingId === m.id));

  return (
    <div>
      <PageHeader
        title={t('scores.title')}
        subtitle={t('scores.subtitle')}
        actions={
          isOrganizer(me) && (
            <Button icon={Plus} onClick={() => setAdding(true)}>
              {t('scores.add')}
            </Button>
          )
        }
      />

      {/* Filters: one row, above everything they scope */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="inline-flex flex-wrap rounded-xl border border-line bg-surface-2 p-0.5" role="group" aria-label={t('scores.filter.all')}>
          {(['all', 'month', 'year', 'meeting'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cx('rounded-[10px] px-3 py-1.5 text-sm font-medium', period === p ? 'bg-surface shadow-sm' : 'text-muted')}
            >
              {t(`scores.filter.${p}`)}
            </button>
          ))}
        </div>
        {period === 'meeting' && (
          <div className="sm:w-64">
            <SelectField label={t('scores.meeting')} value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
              <option value="">–</option>
              {meetingsWithScores.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatShortDate(m.date, locale)} – {m.title}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <div className="sm:w-56">
          <SelectField label={t('scores.filter.activity')} value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="">{t('scores.allActivities')}</option>
            {activities.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {leaderboard.isError && <ErrorState error={leaderboard.error} onRetry={() => void leaderboard.refetch()} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader
            title={t('scores.title')}
            icon={Trophy}
            action={
              <div className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5" role="group">
                {(['participant', 'team'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cx('rounded-[10px] px-3 py-1 text-xs font-semibold', view === v ? 'bg-surface shadow-sm' : 'text-muted')}
                  >
                    {v === 'participant' ? t('scores.individual') : t('scores.teams')}
                  </button>
                ))}
              </div>
            }
          />
          {leaderboard.isPending ? (
            <Skeleton className="h-60" />
          ) : (
            <div className={cx(leaderboard.isFetching && 'opacity-60 transition-opacity')}>
              <Podium rows={rows} />
              <Leaderboard rows={rows} />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t('scores.log')} />
          {scores.isPending ? (
            <Skeleton className="h-60" />
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              {visibleLog.length > 0 && (
                <p className="mb-2 text-xs text-muted">
                  {filter.meetingId && meetingDate.get(filter.meetingId)
                    ? formatLongDate(meetingDate.get(filter.meetingId)?.date ?? today, locale)
                    : null}
                </p>
              )}
              <ScoreLog entries={visibleLog} editable={(e) => canManageScores(me, meetingDate.get(e.meetingId))} />
            </div>
          )}
        </Card>
      </div>

      {adding && <ScoreFormModal open onClose={() => setAdding(false)} />}
    </div>
  );
}
