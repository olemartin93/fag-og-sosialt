import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useMe } from '../lib/session';
import { useMeetings, useRatingStats } from '../lib/queries';
import { nextFriday, osloToday } from '../lib/dates';
import { isOrganizer } from '../lib/permissions';
import { Button, cx, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives';
import { MeetingFormModal, MeetingListItem } from '../components/shared';

type Filter = 'all' | 'upcoming' | 'past';

export default function MeetingsPage() {
  const { t } = useI18n();
  const me = useMe();
  const navigate = useNavigate();
  const meetings = useMeetings();
  const stats = useRatingStats();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const today = osloToday();

  const statsById = useMemo(() => new Map((stats.data ?? []).map((s) => [s.meetingId, s])), [stats.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (meetings.data ?? []).filter((m) => {
      if (filter === 'upcoming' && m.date < today) return false;
      if (filter === 'past' && m.date >= today) return false;
      if (!q) return true;
      return [m.title, m.date, m.summary ?? '', m.location ?? ''].some((s) => s.toLowerCase().includes(q));
    });
  }, [meetings.data, query, filter, today]);
  const upcoming = filtered.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = filtered.filter((m) => m.date < today);

  return (
    <div>
      <PageHeader
        title={t('meetings.title')}
        subtitle={t('meetings.subtitle')}
        actions={
          isOrganizer(me) && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              {t('meetings.new')}
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t('meetings.search')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('meetings.search')}
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-[16px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
          />
        </label>
        <div className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5" role="group">
          {(['all', 'upcoming', 'past'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cx('rounded-[10px] px-3 py-1.5 text-sm font-medium', filter === f ? 'bg-surface shadow-sm' : 'text-muted')}
            >
              {t(`meetings.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {meetings.isError ? (
        <ErrorState error={meetings.error} onRetry={() => void meetings.refetch()} />
      ) : meetings.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (meetings.data ?? []).length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('meetings.empty')}
          hint={t('meetings.emptyHint')}
          action={<Button onClick={() => navigate(`/moter/${nextFriday(today)}`)}>{t('home.planNext')}</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title={t('meetings.noResults')} />
      ) : (
        <div className="flex flex-col gap-8">
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <h2 id="upcoming-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {t('meetings.upcoming')}
              </h2>
              <div className="flex flex-col gap-3">
                {upcoming.map((m) => (
                  <MeetingListItem key={m.id} meeting={m} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section aria-labelledby="past-heading">
              <h2 id="past-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {t('meetings.past')}
              </h2>
              <div className="flex flex-col gap-3">
                {past.map((m) => (
                  <MeetingListItem key={m.id} meeting={m} average={statsById.get(m.id)?.average ?? null} votes={statsById.get(m.id)?.count} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {creating && (
        <MeetingFormModal
          open
          onClose={() => setCreating(false)}
          defaultDate={nextFriday(today)}
          onSaved={(m) => navigate(`/moter/${m.date}`)}
        />
      )}
    </div>
  );
}
