import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApi, useMe } from '../lib/session';
import { useAction, useParticipants, useParticipantStats, useSettings } from '../lib/queries';
import { isAdmin, isOrganizer } from '../lib/permissions';
import { formatPoints, formatScore } from '../lib/stats';
import type { Participant, Team } from '../lib/types';
import { Avatar, Badge, Button, Card, CardHeader, DemoBadge, EmptyState, ErrorState, IconButton, PageHeader, Skeleton } from '../components/ui/primitives';
import { useConfirm } from '../components/ui/forms';
import { useToast } from '../components/ui/Toast';
import { useDirectory } from '../components/shared';
import { ParticipantFormModal, TeamFormModal } from '../components/participants';

function InviteCard() {
  const { t } = useI18n();
  const settings = useSettings();
  const toast = useToast();
  if (!settings.data) return null;
  const url = `${window.location.origin}${window.location.pathname}#/?invite=${encodeURIComponent(settings.data.inviteCode)}`;
  const text = t('participants.inviteText', { url, code: settings.data.inviteCode });
  return (
    <Card>
      <CardHeader title={t('participants.invite')} icon={UserPlus} />
      <p className="mb-3 text-sm text-muted">{t('participants.inviteHelp')}</p>
      <div className="mb-3 rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm" data-testid="invite-code">
        {settings.data.inviteCode}
      </div>
      <Button
        variant="secondary"
        icon={Copy}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            toast.show(t('participants.copied'), 'success');
          } catch {
            toast.show(text, 'info');
          }
        }}
      >
        {t('participants.copy')}
      </Button>
    </Card>
  );
}

function TeamsCard() {
  const { t } = useI18n();
  const api = useApi();
  const me = useMe();
  const dir = useDirectory();
  const confirm = useConfirm();
  const [modal, setModal] = useState<{ team?: Team } | null>(null);
  const remove = useAction((id: string) => api.deleteTeam(id), { success: 'common.deleted' });
  const manage = isOrganizer(me);
  return (
    <Card>
      <CardHeader
        title={t('participants.teams')}
        icon={Users}
        action={manage && <IconButton label={t('participants.addTeam')} icon={Plus} onClick={() => setModal({})} />}
      />
      {dir.teams.length === 0 ? (
        <p className="text-sm text-muted">{t('participants.noTeams')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dir.teams.map((team) => (
            <li key={team.id} className="flex items-center gap-3">
              <span className="size-4 rounded-full" style={{ backgroundColor: team.color }} aria-hidden />
              <span className="flex-1 text-sm font-medium">
                {team.name} <DemoBadge show={team.isDemo} />
              </span>
              <span className="text-xs text-muted">{dir.participants.filter((p) => p.teamId === team.id).length}</span>
              {manage && (
                <>
                  <IconButton label={t('common.edit')} icon={Pencil} onClick={() => setModal({ team })} />
                  <IconButton
                    label={t('common.delete')}
                    icon={Trash2}
                    onClick={async () => {
                      if (await confirm(t('common.confirmDelete'))) remove.mutate(team.id);
                    }}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {modal && <TeamFormModal team={modal.team} onClose={() => setModal(null)} />}
    </Card>
  );
}

export default function ParticipantsPage() {
  const { t, locale } = useI18n();
  const api = useApi();
  const me = useMe();
  const participants = useParticipants();
  const stats = useParticipantStats();
  const dir = useDirectory();
  const confirm = useConfirm();
  const [modal, setModal] = useState<{ participant?: Participant } | null>(null);
  const remove = useAction((id: string) => api.deleteParticipant(id), { success: 'common.deleted' });
  const statsById = useMemo(() => new Map((stats.data ?? []).map((s) => [s.participantId, s])), [stats.data]);
  const sorted = [...(participants.data ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.displayName.localeCompare(b.displayName, 'nb'),
  );

  return (
    <div>
      <PageHeader
        title={t('participants.title')}
        subtitle={t('participants.subtitle')}
        actions={
          isOrganizer(me) && (
            <Button icon={Plus} onClick={() => setModal({})}>
              {t('participants.add')}
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          {participants.isError ? (
            <ErrorState error={participants.error} onRetry={() => void participants.refetch()} />
          ) : participants.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState icon={Users} title={t('participants.empty')} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {sorted.map((p) => {
                const s = statsById.get(p.id);
                const team = dir.team(p.teamId);
                return (
                  <li key={p.id} className={p.active ? '' : 'opacity-60'}>
                    <Card as="article" className="h-full p-4">
                      <div className="flex items-start gap-3">
                        <Avatar participant={p} />
                        <div className="min-w-0 flex-1">
                          <Link to={`/deltakere/${p.id}`} className="block truncate font-semibold hover:underline">
                            {p.displayName}
                          </Link>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge tone={p.role === 'admin' ? 'primary' : p.role === 'organizer' ? 'info' : 'neutral'}>{t(`role.${p.role}`)}</Badge>
                            {team && (
                              <Badge>
                                <span className="size-2 rounded-full" style={{ backgroundColor: team.color }} aria-hidden />
                                {team.name}
                              </Badge>
                            )}
                            {p.id === me?.id && <Badge tone="accent">{t('participants.you')}</Badge>}
                            {!p.userId && <Badge>{t('participants.noAccount')}</Badge>}
                            {!p.active && <Badge tone="danger">{t('participants.inactive')}</Badge>}
                            <DemoBadge show={p.isDemo} />
                          </div>
                        </div>
                        {isAdmin(me) && (
                          <div className="-mr-2 -mt-1 flex">
                            <IconButton label={t('common.edit')} icon={Pencil} onClick={() => setModal({ participant: p })} />
                            {p.id !== me?.id && (
                              <IconButton
                                label={t('common.delete')}
                                icon={Trash2}
                                onClick={async () => {
                                  if (await confirm(t('common.confirmDelete'))) remove.mutate(p.id);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-surface-2 py-2">
                          <dt className="text-[11px] text-muted">{t('participants.points')}</dt>
                          <dd className="font-semibold tabular-nums">{formatPoints(s?.totalPoints ?? 0, locale)}</dd>
                        </div>
                        <div className="rounded-xl bg-surface-2 py-2">
                          <dt className="text-[11px] text-muted">{t('participants.attended')}</dt>
                          <dd className="font-semibold tabular-nums">{s?.meetingsAttended ?? 0}</dd>
                        </div>
                        <div className="rounded-xl bg-surface-2 py-2">
                          <dt className="text-[11px] text-muted">{t('participants.ratingsGiven')}</dt>
                          <dd className="font-semibold tabular-nums">
                            {s?.ratingsGiven ?? 0}
                            {s?.avgRatingGiven != null && <span className="text-xs font-normal text-muted"> · ⌀ {formatScore(s.avgRatingGiven, locale)}</span>}
                          </dd>
                        </div>
                      </dl>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-6">
          {isOrganizer(me) && <InviteCard />}
          <TeamsCard />
        </div>
      </div>
      {modal && <ParticipantFormModal participant={modal.participant} onClose={() => setModal(null)} />}
    </div>
  );
}
