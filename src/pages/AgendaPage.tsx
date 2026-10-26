import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus, Lightbulb, ListChecks, Plus } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApi, useMe } from '../lib/session';
import { useAction, useAgendaItems, useMeetings } from '../lib/queries';
import { addDays, formatLongDate, formatShortDate, nextFriday, osloToday } from '../lib/dates';
import { canCreateMeetingOn } from '../lib/permissions';
import { Button, Card, CardHeader, cx, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from '../components/ui/primitives';
import { AgendaItemFormModal, AgendaList } from '../components/shared';

export default function AgendaPage() {
  const { t, locale } = useI18n();
  const api = useApi();
  const me = useMe();
  const meetings = useMeetings();
  const agenda = useAgendaItems();
  const today = osloToday();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ meetingId: string | null } | null>(null);

  const upcoming = useMemo(
    () =>
      (meetings.data ?? [])
        .filter((m) => m.date >= today && m.status !== 'skipped' && m.status !== 'completed')
        .sort((a, b) => a.date.localeCompare(b.date)),
    [meetings.data, today],
  );
  const selected = upcoming.find((m) => m.id === selectedId) ?? upcoming[0] ?? null;
  const items = (agenda.data ?? []).filter((a) => selected && a.meetingId === selected.id).sort((a, b) => a.position - b.position);
  const ideas = (agenda.data ?? [])
    .filter((a) => a.meetingId === null)
    .sort((a, b) => b.votes.length - a.votes.length || Number(b.highPriority) - Number(a.highPriority) || b.createdAt.localeCompare(a.createdAt));

  // next Friday without a meeting, offered as a one-tap create
  const existing = new Set((meetings.data ?? []).map((m) => m.date));
  let candidate = nextFriday(today);
  while (existing.has(candidate)) candidate = addDays(candidate, 7);
  const create = useAction((d: string) => api.ensureMeeting(d), { success: 'common.saved', onSuccess: (id) => setSelectedId(id) });

  if (meetings.isError) return <ErrorState error={meetings.error} onRetry={() => void meetings.refetch()} />;

  return (
    <div>
      <PageHeader
        title={t('agenda.title')}
        subtitle={t('agenda.subtitle')}
        actions={
          <Button icon={Lightbulb} onClick={() => setAdding({ meetingId: null })}>
            {t('agenda.suggest')}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-2" role="tablist" aria-label={t('agenda.upcomingMeetings')}>
              {upcoming.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={selected?.id === m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cx(
                    'rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors',
                    selected?.id === m.id ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <span className="block font-semibold">{formatShortDate(m.date, locale)}</span>
                  <span className={cx('block max-w-40 truncate text-xs', selected?.id === m.id ? 'opacity-80' : 'text-muted')}>{m.title}</span>
                </button>
              ))}
              {canCreateMeetingOn(me, candidate) && (
                <button
                  type="button"
                  onClick={() => create.mutate(candidate)}
                  disabled={create.isPending}
                  className="flex items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-muted hover:border-primary hover:text-primary"
                >
                  <CalendarPlus className="size-4" aria-hidden />
                  {t('agenda.createNext', { date: formatShortDate(candidate, locale) })}
                </button>
              )}
            </div>
          </div>

          <Card>
            {meetings.isPending || agenda.isPending ? (
              <Skeleton className="h-40" />
            ) : !selected ? (
              <EmptyState icon={ListChecks} title={t('agenda.noUpcoming')} />
            ) : (
              <>
                <CardHeader
                  title={
                    <span className="flex flex-col">
                      <span>{formatLongDate(selected.date, locale)}</span>
                      <span className="text-sm font-normal text-muted">{selected.title}</span>
                    </span>
                  }
                  action={
                    <div className="flex items-center gap-2">
                      <StatusBadge status={selected.status} />
                      <Link
                        to={`/moter/${selected.date}`}
                        className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
                        aria-label={t('common.open')}
                      >
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                  }
                />
                <AgendaList
                  items={items}
                  meeting={selected}
                  showVotes
                  emptyAction={
                    <Button size="sm" icon={Plus} onClick={() => setAdding({ meetingId: selected.id })}>
                      {t('agenda.add')}
                    </Button>
                  }
                />
                {items.length > 0 && (
                  <Button className="mt-4" variant="secondary" size="sm" icon={Plus} onClick={() => setAdding({ meetingId: selected.id })}>
                    {t('agenda.add')}
                  </Button>
                )}
              </>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title={t('agenda.ideaBank')} icon={Lightbulb} />
          <p className="mb-4 text-sm text-muted">{t('agenda.ideaBankHint')}</p>
          {agenda.isPending ? (
            <Skeleton className="h-32" />
          ) : ideas.length === 0 ? (
            <EmptyState compact title={t('agenda.ideaBankEmpty')} />
          ) : (
            <AgendaList items={ideas} meeting={null} showVotes />
          )}
        </Card>
      </div>

      {adding && <AgendaItemFormModal open onClose={() => setAdding(null)} defaultMeetingId={adding.meetingId} />}
    </div>
  );
}
