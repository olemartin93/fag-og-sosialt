import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Star, Trophy } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useMe } from '../lib/session';
import { useMeetings, useParticipantStats, useRatingsBy, useScores, useSettings } from '../lib/queries';
import { formatShortDate } from '../lib/dates';
import { formatPoints, formatScore } from '../lib/stats';
import { Avatar, Badge, Card, CardHeader, DemoBadge, EmptyState, PageHeader, Skeleton, StatTile } from '../components/ui/primitives';
import { useDirectory } from '../components/shared';

export default function ParticipantPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const me = useMe();
  const dir = useDirectory();
  const stats = useParticipantStats();
  const scores = useScores();
  const meetings = useMeetings();
  const ratings = useRatingsBy(id);
  const settings = useSettings();
  const person = dir.person(id);
  const s = stats.data?.find((x) => x.participantId === id);
  const meetingById = useMemo(() => new Map((meetings.data ?? []).map((m) => [m.id, m])), [meetings.data]);
  const myScores = (scores.data ?? [])
    .filter((e) => e.participantId === id)
    .sort((a, b) => (meetingById.get(b.meetingId)?.date ?? '').localeCompare(meetingById.get(a.meetingId)?.date ?? ''));
  const canSeeRatings = id === me?.id || !!settings.data?.ratingsPublic;

  if (!person) {
    return dir.participants.length === 0 ? <Skeleton className="h-48" /> : <EmptyState title={t('participants.notFound')} />;
  }
  const team = dir.team(person.teamId);

  return (
    <div>
      <Link to="/deltakere" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {t('nav.participants')}
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <Avatar participant={person} size="lg" />
            <span>
              {person.displayName}
              <span className="mt-1 flex flex-wrap gap-1">
                <Badge tone="primary">{t(`role.${person.role}`)}</Badge>
                {team && <Badge>{team.name}</Badge>}
                <DemoBadge show={person.isDemo} />
              </span>
            </span>
          </span>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('participants.points')} value={formatPoints(s?.totalPoints ?? 0, locale)} tone="primary" />
        <StatTile label={t('participants.attended')} value={s?.meetingsAttended ?? 0} />
        <StatTile label={t('scores.entries')} value={s?.scoreEntries ?? 0} />
        <StatTile
          label={t('participants.ratingsGiven')}
          value={s?.ratingsGiven ?? 0}
          hint={s?.avgRatingGiven != null ? `${t('participants.avgGiven')}: ${formatScore(s.avgRatingGiven, locale)}` : undefined}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('participants.scoreHistory')} icon={Trophy} />
          {myScores.length === 0 ? (
            <p className="text-sm text-muted">{t('scores.empty')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {myScores.map((e) => {
                const m = meetingById.get(e.meetingId);
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium">{e.activity}</span>
                      {m && (
                        <Link to={`/moter/${m.date}?fane=poeng`} className="text-xs text-muted hover:underline">
                          {formatShortDate(m.date, locale)} · {m.title}
                        </Link>
                      )}
                    </span>
                    <span className="font-semibold tabular-nums">{formatPoints(e.points, locale)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={t('participants.ratings')} icon={Star} />
          {!canSeeRatings ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Lock className="size-4" aria-hidden />
              {t('participants.ratingsPrivate')}
            </p>
          ) : (ratings.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">{t('home.noRatings')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...(ratings.data ?? [])]
                .sort((a, b) => (meetingById.get(b.meetingId)?.date ?? '').localeCompare(meetingById.get(a.meetingId)?.date ?? ''))
                .map((r) => {
                  const m = meetingById.get(r.meetingId);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      {m ? (
                        <Link to={`/moter/${m.date}?fane=vurdering`} className="hover:underline">
                          {formatShortDate(m.date, locale)} · {m.title}
                        </Link>
                      ) : (
                        <span>–</span>
                      )}
                      <span className="font-semibold tabular-nums">{r.score}/10</span>
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
