import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useMe } from '../lib/session';
import { useMeetings, useRatingStats } from '../lib/queries';
import { formatLongDate, formatMonth, isFriday, monthGrid, monthKey, osloToday, weekdayNames } from '../lib/dates';
import { isOrganizer } from '../lib/permissions';
import type { IsoDate, MeetingOverview } from '../lib/types';
import { Badge, Card, cx, ErrorState, IconButton, PageHeader, StatusBadge } from '../components/ui/primitives';

function Dot({ className, label }: { className: string; label: string }) {
  return <span className={cx('inline-block size-1.5 rounded-full', className)} title={label} aria-hidden />;
}

export default function CalendarPage() {
  const { t, locale } = useI18n();
  const me = useMe();
  const navigate = useNavigate();
  const meetings = useMeetings();
  const stats = useRatingStats();
  const today = osloToday();
  const [{ year, month0 }, setMonth] = useState(() => monthKey(today));

  const byDate = useMemo(() => new Map((meetings.data ?? []).map((m) => [m.date, m])), [meetings.data]);
  const rated = useMemo(() => new Set((stats.data ?? []).filter((s) => s.count > 0).map((s) => s.meetingId)), [stats.data]);
  const weeks = monthGrid(year, month0);

  const shift = (delta: number) =>
    setMonth(({ year: y, month0: m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { year: d.getUTCFullYear(), month0: d.getUTCMonth() };
    });

  const inMonth = (date: IsoDate) => monthKey(date).month0 === month0;
  const monthItems = weeks
    .flat()
    .filter((d) => inMonth(d) && (byDate.has(d) || isFriday(d)))
    .map((d) => ({ date: d, meeting: byDate.get(d) }));

  const describe = (date: IsoDate, m: MeetingOverview | undefined) => {
    const parts = [formatLongDate(date, locale)];
    if (m) {
      parts.push(m.title, t(`status.${m.status}`));
      if (m.notesCount) parts.push(t('calendar.legend.notes'));
      if (rated.has(m.id)) parts.push(t('calendar.legend.ratings'));
      if (m.agendaCount && m.agendaDoneCount === m.agendaCount) parts.push(t('calendar.legend.agendaDone'));
    } else if (isFriday(date)) {
      parts.push(t('calendar.suggested'));
    }
    return parts.join(', ');
  };

  return (
    <div>
      <PageHeader title={t('calendar.title')} subtitle={t('calendar.subtitle')} />
      {meetings.isError && <ErrorState error={meetings.error} onRetry={() => void meetings.refetch()} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <IconButton label={t('calendar.prev')} icon={ChevronLeft} onClick={() => shift(-1)} />
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight" aria-live="polite">
                {formatMonth(year, month0, locale)}
              </h2>
              <button
                type="button"
                onClick={() => setMonth(monthKey(today))}
                className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
              >
                {t('calendar.today')}
              </button>
            </div>
            <IconButton label={t('calendar.next')} icon={ChevronRight} onClick={() => shift(1)} />
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {weekdayNames(locale).map((d, i) => (
              <div key={d} aria-hidden className={cx('pb-1 text-center text-xs font-medium text-muted', i === 4 && 'text-accent')}>
                {d}
              </div>
            ))}
            {weeks.flat().map((date) => {
              const m = byDate.get(date);
              const friday = isFriday(date);
              const isToday = date === today;
              const past = date < today;
              const clickable = !!m || friday || isOrganizer(me);
              const tone = m
                ? m.status === 'skipped'
                  ? 'bg-surface-2 text-muted line-through'
                  : past || m.status === 'completed'
                    ? 'bg-primary-soft text-primary'
                    : 'bg-accent-soft text-accent'
                : friday
                  ? 'border border-dashed border-accent/50 text-ink'
                  : 'text-ink';
              const cell = (
                <div
                  className={cx(
                    'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm tabular-nums transition-colors sm:aspect-[4/3]',
                    tone,
                    !inMonth(date) && 'opacity-35',
                    isToday && 'ring-2 ring-primary',
                    clickable && 'hover:brightness-95',
                    m || friday ? 'font-semibold' : 'font-normal',
                  )}
                >
                  <span>{Number(date.slice(8))}</span>
                  {m && (
                    <span className="flex h-1.5 gap-0.5">
                      {m.notesCount > 0 && <Dot className="bg-info" label={t('calendar.legend.notes')} />}
                      {rated.has(m.id) && <Dot className="bg-gold" label={t('calendar.legend.ratings')} />}
                      {m.agendaCount > 0 && m.agendaDoneCount === m.agendaCount && (
                        <Dot className="bg-success" label={t('calendar.legend.agendaDone')} />
                      )}
                    </span>
                  )}
                </div>
              );
              return (
                <div key={date}>
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/moter/${date}`)}
                      className="w-full rounded-xl"
                      aria-label={describe(date, m)}
                      aria-current={isToday ? 'date' : undefined}
                    >
                      {cell}
                    </button>
                  ) : (
                    <div aria-label={describe(date, m)}>{cell}</div>
                  )}
                </div>
              );
            })}
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-primary-soft" aria-hidden /> {t('calendar.legend.past')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-accent-soft" aria-hidden /> {t('calendar.legend.planned')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded border border-dashed border-accent/50" aria-hidden /> {t('calendar.legend.suggested')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-surface-2" aria-hidden /> {t('calendar.legend.skipped')}
            </li>
            <li className="flex items-center gap-1.5">
              <Dot className="bg-info" label="" /> {t('calendar.legend.notes')}
            </li>
            <li className="flex items-center gap-1.5">
              <Dot className="bg-gold" label="" /> {t('calendar.legend.ratings')}
            </li>
            <li className="flex items-center gap-1.5">
              <Dot className="bg-success" label="" /> {t('calendar.legend.agendaDone')}
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">{t('calendar.monthList')}</h2>
          <ul className="flex flex-col gap-2">
            {monthItems.map(({ date, meeting }) => (
              <li key={date}>
                <Link
                  to={`/moter/${date}`}
                  className={cx(
                    'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm hover:bg-surface-2',
                    date === today ? 'border-primary' : 'border-line',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{formatLongDate(date, locale)}</span>
                    <span className="block truncate text-xs text-muted">{meeting?.title ?? t('calendar.suggested')}</span>
                  </span>
                  {meeting ? <StatusBadge status={meeting.status} /> : <Badge>{t('calendar.suggested')}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
