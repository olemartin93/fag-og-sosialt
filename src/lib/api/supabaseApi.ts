import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Activity,
  AgendaItem,
  AppSettings,
  FeedItem,
  LeaderboardRow,
  Meeting,
  MeetingNote,
  MeetingOverview,
  MeetingRatingStats,
  Participant,
  ParticipantStats,
  Rating,
  ScoreEntry,
  ScoreHistoryEntry,
  SessionUser,
  Task,
  Team,
} from '../types';
import {
  activitySchema,
  agendaItemSchema,
  meetingSchema,
  noteSchema,
  participantSchema,
  ratingSchema,
  scoreSchema,
  settingsSchema,
  signUpSchema,
  taskSchema,
  teamSchema,
} from '../validation';
import type { z } from 'zod';
import { ApiError, type DataApi, type SignUpInput } from './types';
import type { SupabaseConfig } from './config';

// ---------------------------------------------------------------- row shapes
interface ParticipantRow {
  id: string;
  user_id: string | null;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  role: Participant['role'];
  team_id: string | null;
  active: boolean;
  is_demo: boolean;
  created_at: string;
}
interface TeamRow {
  id: string;
  name: string;
  color: string;
  is_demo: boolean;
}
interface MeetingRow {
  id: string;
  meeting_date: string;
  title: string;
  status: Meeting['status'];
  start_time: string | null;
  location: string | null;
  organizer_id: string | null;
  summary: string | null;
  final_notes: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}
interface AgendaRow {
  id: string;
  meeting_id: string | null;
  kind: AgendaItem['kind'];
  title: string;
  description: string | null;
  link: string | null;
  high_priority: boolean;
  assignee_id: string | null;
  completed: boolean;
  position: number;
  created_by: string | null;
  is_demo: boolean;
  created_at: string;
  agenda_votes?: { participant_id: string }[];
}
interface NoteRow {
  id: string;
  meeting_id: string;
  kind: MeetingNote['kind'];
  content: string;
  author_id: string | null;
  is_demo: boolean;
  created_at: string;
}
interface TaskRow {
  id: string;
  meeting_id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  done: boolean;
  created_by: string | null;
  is_demo: boolean;
  created_at: string;
}
interface ActivityRow {
  id: string;
  meeting_id: string;
  name: string;
  description: string | null;
  result: string | null;
  created_by: string | null;
  is_demo: boolean;
  created_at: string;
}
interface ScoreRow {
  id: string;
  meeting_id: string;
  activity: string;
  participant_id: string | null;
  team_id: string | null;
  points: number;
  comment: string | null;
  created_by: string | null;
  is_demo: boolean;
  created_at: string;
}
interface HistoryRow {
  id: number;
  score_id: string;
  meeting_id: string | null;
  action: ScoreHistoryEntry['action'];
  subject_name: string | null;
  activity: string | null;
  old_points: number | null;
  new_points: number | null;
  changed_by: string | null;
  changed_at: string;
}
interface RatingRow {
  id: string;
  meeting_id: string;
  participant_id: string;
  score: number;
  updated_at: string;
}
interface SettingsRow {
  group_name: string;
  invite_code: string;
  ratings_public: boolean;
  default_start_time: string;
}

// ---------------------------------------------------------------- mappers
export const mapParticipant = (r: ParticipantRow): Participant => ({
  id: r.id,
  userId: r.user_id,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  avatarColor: r.avatar_color,
  role: r.role,
  teamId: r.team_id,
  active: r.active,
  isDemo: r.is_demo,
  createdAt: r.created_at,
});
const mapTeam = (r: TeamRow): Team => ({ id: r.id, name: r.name, color: r.color, isDemo: r.is_demo });
export const mapMeeting = (r: MeetingRow): Meeting => ({
  id: r.id,
  date: r.meeting_date,
  title: r.title,
  status: r.status,
  startTime: r.start_time ? r.start_time.slice(0, 5) : null,
  location: r.location,
  organizerId: r.organizer_id,
  summary: r.summary,
  finalNotes: r.final_notes,
  isDemo: r.is_demo,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const mapAgenda = (r: AgendaRow): AgendaItem => ({
  id: r.id,
  meetingId: r.meeting_id,
  kind: r.kind,
  title: r.title,
  description: r.description,
  link: r.link,
  highPriority: r.high_priority,
  assigneeId: r.assignee_id,
  completed: r.completed,
  position: r.position,
  createdBy: r.created_by,
  isDemo: r.is_demo,
  createdAt: r.created_at,
  votes: (r.agenda_votes ?? []).map((v) => v.participant_id),
});
const mapNote = (r: NoteRow): MeetingNote => ({
  id: r.id,
  meetingId: r.meeting_id,
  kind: r.kind,
  content: r.content,
  authorId: r.author_id,
  isDemo: r.is_demo,
  createdAt: r.created_at,
});
const mapTask = (r: TaskRow): Task => ({
  id: r.id,
  meetingId: r.meeting_id,
  title: r.title,
  assigneeId: r.assignee_id,
  dueDate: r.due_date,
  done: r.done,
  createdBy: r.created_by,
  isDemo: r.is_demo,
  createdAt: r.created_at,
});
const mapActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  meetingId: r.meeting_id,
  name: r.name,
  description: r.description,
  result: r.result,
  createdBy: r.created_by,
  isDemo: r.is_demo,
  createdAt: r.created_at,
});
const mapScore = (r: ScoreRow): ScoreEntry => ({
  id: r.id,
  meetingId: r.meeting_id,
  activity: r.activity,
  participantId: r.participant_id,
  teamId: r.team_id,
  points: r.points,
  comment: r.comment,
  createdBy: r.created_by,
  isDemo: r.is_demo,
  createdAt: r.created_at,
});
const mapHistory = (r: HistoryRow): ScoreHistoryEntry => ({
  id: String(r.id),
  scoreId: r.score_id,
  meetingId: r.meeting_id,
  action: r.action,
  subjectName: r.subject_name,
  activity: r.activity,
  oldPoints: r.old_points,
  newPoints: r.new_points,
  changedBy: r.changed_by,
  changedAt: r.changed_at,
});
const mapRating = (r: RatingRow): Rating => ({
  id: r.id,
  meetingId: r.meeting_id,
  participantId: r.participant_id,
  score: r.score,
  updatedAt: r.updated_at,
});

interface PgError {
  code?: string;
  message?: string;
}

/** Turn Supabase/PostgREST/network errors into ApiError codes. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const e = (error ?? {}) as PgError & { name?: string; status?: number };
  const message = e.message ?? '';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new ApiError('offline', message);
  if (/failed to fetch|networkerror|load failed/i.test(message)) return new ApiError('offline', message);
  if (/invalid login credentials/i.test(message)) return new ApiError('invalidCredentials', message);
  if (/email not confirmed/i.test(message)) return new ApiError('emailNotConfirmed', message);
  if (/invitasjonskode/i.test(message)) return new ApiError('invalidInvite', message);
  switch (e.code) {
    case '42501':
    case 'PGRST301':
      return new ApiError('forbidden', message);
    case '23505':
      return new ApiError('duplicate', message);
    case '23514':
    case '22P02':
    case '23502':
      return new ApiError('validation', message);
    case 'PGRST116':
      return new ApiError('notFound', message);
    default:
      return new ApiError('unknown', message);
  }
}

function must<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw toApiError(result.error);
  return result.data as T;
}

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError('validation', result.error.issues[0]?.message);
  return result.data;
}

const appUrl = () => `${window.location.origin}${window.location.pathname}`;

/** Shared database backend (Supabase Postgres + Auth + Realtime). */
export class SupabaseApi implements DataApi {
  readonly mode = 'supabase' as const;
  readonly client: SupabaseClient;
  private participantId: string | null = null;

  constructor(config: SupabaseConfig, client?: SupabaseClient) {
    this.client =
      client ??
      createClient(config.url, config.anonKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
  }

  // ------------------------------------------------------------ auth
  async getSession(): Promise<SessionUser | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw toApiError(error);
    const user = data.session?.user;
    if (!user) {
      this.participantId = null;
      return null;
    }
    const row = must(
      await this.client.from('participants').select('*').eq('user_id', user.id).maybeSingle<ParticipantRow>(),
    );
    const participant = row ? mapParticipant(row) : null;
    this.participantId = participant?.active ? participant.id : null;
    return { userId: user.id, email: user.email ?? null, participant: participant?.active ? participant : null };
  }

  onAuthChange(callback: (event: 'signed-in' | 'signed-out' | 'password-recovery') => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') callback('password-recovery');
      else if (event === 'SIGNED_IN') callback('signed-in');
      else if (event === 'SIGNED_OUT') callback('signed-out');
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toApiError(error);
  }

  async signUp(input: SignUpInput) {
    const v = parse(signUpSchema, input);
    const ok = must(await this.client.rpc('check_invite_code', { p_code: v.inviteCode }));
    if (!ok) throw new ApiError('invalidInvite');
    const { data, error } = await this.client.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { display_name: v.displayName, invite_code: v.inviteCode },
        emailRedirectTo: appUrl(),
      },
    });
    if (error) throw toApiError(error);
    return { needsConfirmation: !data.session };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    this.participantId = null;
    if (error) throw toApiError(error);
  }

  async requestPasswordReset(email: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    if (error) throw toApiError(error);
  }

  async updatePassword(password: string) {
    if (password.length < 8) throw new ApiError('validation', 'passwordTooShort');
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw toApiError(error);
  }

  private async myId(): Promise<string> {
    if (this.participantId) return this.participantId;
    const s = await this.getSession();
    if (!s?.participant) throw new ApiError('forbidden');
    return s.participant.id;
  }

  // ------------------------------------------------------------ reads
  async getSettings(): Promise<AppSettings> {
    const r = must(await this.client.from('app_settings').select('*').eq('id', 1).single<SettingsRow>());
    return {
      groupName: r.group_name,
      inviteCode: r.invite_code,
      ratingsPublic: r.ratings_public,
      defaultStartTime: r.default_start_time.slice(0, 5),
    };
  }

  async listParticipants() {
    const rows = must(await this.client.from('participants').select('*').order('display_name'));
    return (rows as ParticipantRow[]).map(mapParticipant);
  }

  async listTeams() {
    const rows = must(await this.client.from('teams').select('*').order('name'));
    return (rows as TeamRow[]).map(mapTeam);
  }

  async listMeetings(): Promise<MeetingOverview[]> {
    const [meetings, notes, agenda] = await Promise.all([
      this.client.from('meetings').select('*').order('meeting_date', { ascending: false }),
      this.client.from('meeting_notes').select('meeting_id'),
      this.client.from('agenda_items').select('meeting_id, completed').not('meeting_id', 'is', null),
    ]);
    const noteRows = must(notes) as { meeting_id: string }[];
    const agendaRows = must(agenda) as { meeting_id: string; completed: boolean }[];
    return (must(meetings) as MeetingRow[]).map((r) => {
      const items = agendaRows.filter((a) => a.meeting_id === r.id);
      return {
        ...mapMeeting(r),
        notesCount: noteRows.filter((n) => n.meeting_id === r.id).length,
        agendaCount: items.length,
        agendaDoneCount: items.filter((a) => a.completed).length,
      };
    });
  }

  async getMeetingByDate(date: string) {
    const row = must(await this.client.from('meetings').select('*').eq('meeting_date', date).maybeSingle<MeetingRow>());
    return row ? mapMeeting(row) : null;
  }

  async getMeetingBundle(meetingId: string) {
    const me = await this.myId().catch(() => null);
    const [meeting, agenda, notes, tasks, activities, scores, history, attendance, rating] = await Promise.all([
      this.client.from('meetings').select('*').eq('id', meetingId).single<MeetingRow>(),
      this.client
        .from('agenda_items')
        .select('*, agenda_votes(participant_id)')
        .eq('meeting_id', meetingId)
        .order('position')
        .order('created_at'),
      this.client.from('meeting_notes').select('*').eq('meeting_id', meetingId).order('created_at'),
      this.client.from('tasks').select('*').eq('meeting_id', meetingId).order('created_at'),
      this.client.from('activities').select('*').eq('meeting_id', meetingId).order('created_at'),
      this.client.from('score_entries').select('*').eq('meeting_id', meetingId).order('created_at'),
      this.client.from('score_history').select('*').eq('meeting_id', meetingId).order('changed_at', { ascending: false }).limit(50),
      this.client.from('attendance').select('participant_id').eq('meeting_id', meetingId),
      me
        ? this.client.from('ratings').select('score').eq('meeting_id', meetingId).eq('participant_id', me).maybeSingle<{ score: number }>()
        : Promise.resolve({ data: null, error: null }),
    ]);
    return {
      meeting: mapMeeting(must(meeting)),
      agenda: (must(agenda) as AgendaRow[]).map(mapAgenda),
      notes: (must(notes) as NoteRow[]).map(mapNote),
      tasks: (must(tasks) as TaskRow[]).map(mapTask),
      activities: (must(activities) as ActivityRow[]).map(mapActivity),
      scores: (must(scores) as ScoreRow[]).map(mapScore),
      history: (must(history) as HistoryRow[]).map(mapHistory),
      attendance: (must(attendance) as { participant_id: string }[]).map((a) => a.participant_id),
      myRating: (must(rating) as { score: number } | null)?.score ?? null,
    };
  }

  async listAgendaItems() {
    const rows = must(
      await this.client.from('agenda_items').select('*, agenda_votes(participant_id)').order('position').order('created_at'),
    );
    return (rows as AgendaRow[]).map(mapAgenda);
  }

  async ratingStats(): Promise<MeetingRatingStats[]> {
    const rows = must(await this.client.rpc('meeting_rating_stats')) as {
      meeting_id: string;
      meeting_date: string;
      title: string;
      avg_score: number | string | null;
      vote_count: number;
      min_score: number | null;
      max_score: number | null;
      distribution: number[];
    }[];
    return rows.map((r) => ({
      meetingId: r.meeting_id,
      date: r.meeting_date,
      title: r.title,
      average: r.avg_score === null ? null : Number(r.avg_score),
      count: r.vote_count,
      min: r.min_score,
      max: r.max_score,
      distribution: r.distribution,
    }));
  }

  async ratingsByParticipant(participantId: string) {
    const rows = must(await this.client.from('ratings').select('*').eq('participant_id', participantId));
    return (rows as RatingRow[]).map(mapRating);
  }

  async leaderboard(filter: Parameters<DataApi['leaderboard']>[0]): Promise<LeaderboardRow[]> {
    const rows = must(
      await this.client.rpc('leaderboard', {
        p_from: filter.from ?? null,
        p_to: filter.to ?? null,
        p_meeting_id: filter.meetingId ?? null,
        p_activity: filter.activity ?? null,
      }),
    ) as {
      subject_type: LeaderboardRow['subjectType'];
      subject_id: string;
      name: string;
      color: string;
      total_points: number | string;
      entries: number;
      meetings: number;
      rank: number;
    }[];
    return rows.map((r) => ({
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      name: r.name,
      color: r.color,
      totalPoints: Number(r.total_points),
      entries: r.entries,
      meetings: r.meetings,
      rank: r.rank,
    }));
  }

  async listScores() {
    const rows = must(await this.client.from('score_entries').select('*').order('created_at', { ascending: false }));
    return (rows as ScoreRow[]).map(mapScore);
  }

  async scoreHistory(limit: number) {
    const rows = must(
      await this.client.from('score_history').select('*').order('changed_at', { ascending: false }).limit(limit),
    );
    return (rows as HistoryRow[]).map(mapHistory);
  }

  async participantStats(): Promise<ParticipantStats[]> {
    const rows = must(await this.client.rpc('participant_stats')) as {
      participant_id: string;
      total_points: number | string;
      score_entries: number;
      meetings_attended: number;
      ratings_given: number;
      avg_rating_given: number | string | null;
    }[];
    return rows.map((r) => ({
      participantId: r.participant_id,
      totalPoints: Number(r.total_points),
      scoreEntries: r.score_entries,
      meetingsAttended: r.meetings_attended,
      ratingsGiven: r.ratings_given,
      avgRatingGiven: r.avg_rating_given === null ? null : Number(r.avg_rating_given),
    }));
  }

  async recentActivity(limit: number): Promise<FeedItem[]> {
    const rows = must(await this.client.rpc('recent_activity', { p_limit: limit })) as {
      kind: FeedItem['kind'];
      item_id: string;
      meeting_id: string | null;
      meeting_date: string | null;
      label: string;
      actor_name: string | null;
      happened_at: string;
    }[];
    return rows.map((r) => ({
      kind: r.kind,
      itemId: r.item_id,
      meetingId: r.meeting_id,
      meetingDate: r.meeting_date,
      label: r.label,
      actorName: r.actor_name,
      at: r.happened_at,
    }));
  }

  // ------------------------------------------------------------ meetings
  async ensureMeeting(date: string) {
    return must(await this.client.rpc('ensure_meeting', { p_date: date })) as string;
  }

  private meetingRow(v: z.output<typeof meetingSchema>) {
    return {
      meeting_date: v.date,
      title: v.title,
      status: v.status,
      start_time: v.startTime,
      location: v.location,
      organizer_id: v.organizerId,
      summary: v.summary,
      final_notes: v.finalNotes,
    };
  }

  async createMeeting(input: Parameters<DataApi['createMeeting']>[0]) {
    const v = parse(meetingSchema, input);
    const row = must(await this.client.from('meetings').insert(this.meetingRow(v)).select('*').single<MeetingRow>());
    return mapMeeting(row);
  }

  async updateMeeting(id: string, input: Parameters<DataApi['updateMeeting']>[1]) {
    const v = parse(meetingSchema, input);
    await this.expectRow(this.client.from('meetings').update(this.meetingRow(v)).eq('id', id).select('id'));
  }

  async deleteMeeting(id: string) {
    await this.expectRow(this.client.from('meetings').delete().eq('id', id).select('id'));
  }

  /** RLS hides rows instead of erroring; treat "0 rows changed" as forbidden. */
  private async expectRow(query: PromiseLike<{ data: unknown; error: unknown }>) {
    const data = must(await query) as unknown[] | null;
    if (!data || data.length === 0) throw new ApiError('forbidden');
  }

  // ------------------------------------------------------------ agenda
  private agendaRow(v: z.output<typeof agendaItemSchema>) {
    return {
      meeting_id: v.meetingId,
      kind: v.kind,
      title: v.title,
      description: v.description,
      link: v.link,
      high_priority: v.highPriority,
      assignee_id: v.assigneeId,
    };
  }

  async addAgendaItem(input: Parameters<DataApi['addAgendaItem']>[0]) {
    const v = parse(agendaItemSchema, input);
    let position = 1;
    const last = must(
      await (v.meetingId
        ? this.client.from('agenda_items').select('position').eq('meeting_id', v.meetingId)
        : this.client.from('agenda_items').select('position').is('meeting_id', null)
      )
        .order('position', { ascending: false })
        .limit(1),
    ) as { position: number }[];
    if (last[0]) position = last[0].position + 1;
    must(await this.client.from('agenda_items').insert({ ...this.agendaRow(v), position }));
  }

  async updateAgendaItem(id: string, input: Parameters<DataApi['updateAgendaItem']>[1]) {
    const v = parse(agendaItemSchema, input);
    await this.expectRow(this.client.from('agenda_items').update(this.agendaRow(v)).eq('id', id).select('id'));
  }

  async deleteAgendaItem(id: string) {
    await this.expectRow(this.client.from('agenda_items').delete().eq('id', id).select('id'));
  }

  async setAgendaCompleted(id: string, completed: boolean) {
    must(await this.client.rpc('set_agenda_completed', { p_item_id: id, p_completed: completed }));
  }

  async reorderAgenda(meetingId: string, orderedIds: string[]) {
    must(await this.client.rpc('reorder_agenda', { p_meeting_id: meetingId, p_item_ids: orderedIds }));
  }

  async toggleVote(itemId: string, vote: boolean) {
    const me = await this.myId();
    if (vote) {
      must(await this.client.from('agenda_votes').upsert({ item_id: itemId, participant_id: me }, { ignoreDuplicates: true }));
    } else {
      must(await this.client.from('agenda_votes').delete().eq('item_id', itemId).eq('participant_id', me));
    }
  }

  // ------------------------------------------------------------ notes, tasks, activities
  async addNote(meetingId: string, input: Parameters<DataApi['addNote']>[1]) {
    const v = parse(noteSchema, input);
    must(await this.client.from('meeting_notes').insert({ meeting_id: meetingId, kind: v.kind, content: v.content }));
  }

  async updateNote(id: string, input: Parameters<DataApi['updateNote']>[1]) {
    const v = parse(noteSchema, input);
    await this.expectRow(this.client.from('meeting_notes').update({ kind: v.kind, content: v.content }).eq('id', id).select('id'));
  }

  async deleteNote(id: string) {
    await this.expectRow(this.client.from('meeting_notes').delete().eq('id', id).select('id'));
  }

  async addTask(meetingId: string, input: Parameters<DataApi['addTask']>[1]) {
    const v = parse(taskSchema, input);
    must(
      await this.client
        .from('tasks')
        .insert({ meeting_id: meetingId, title: v.title, assignee_id: v.assigneeId, due_date: v.dueDate, done: v.done }),
    );
  }

  async updateTask(id: string, input: Parameters<DataApi['updateTask']>[1]) {
    const v = parse(taskSchema, input);
    await this.expectRow(
      this.client
        .from('tasks')
        .update({ title: v.title, assignee_id: v.assigneeId, due_date: v.dueDate, done: v.done })
        .eq('id', id)
        .select('id'),
    );
  }

  async deleteTask(id: string) {
    await this.expectRow(this.client.from('tasks').delete().eq('id', id).select('id'));
  }

  async addActivity(meetingId: string, input: Parameters<DataApi['addActivity']>[1]) {
    const v = parse(activitySchema, input);
    must(await this.client.from('activities').insert({ meeting_id: meetingId, ...v }));
  }

  async updateActivity(id: string, input: Parameters<DataApi['updateActivity']>[1]) {
    const v = parse(activitySchema, input);
    await this.expectRow(this.client.from('activities').update(v).eq('id', id).select('id'));
  }

  async deleteActivity(id: string) {
    await this.expectRow(this.client.from('activities').delete().eq('id', id).select('id'));
  }

  async setAttendance(meetingId: string, participantId: string, present: boolean) {
    if (present) {
      must(
        await this.client
          .from('attendance')
          .upsert({ meeting_id: meetingId, participant_id: participantId }, { ignoreDuplicates: true }),
      );
    } else {
      must(await this.client.from('attendance').delete().eq('meeting_id', meetingId).eq('participant_id', participantId));
    }
  }

  // ------------------------------------------------------------ scores
  private scoreRow(v: z.output<typeof scoreSchema>) {
    return {
      meeting_id: v.meetingId,
      activity: v.activity,
      participant_id: v.participantId,
      team_id: v.teamId,
      points: v.points,
      comment: v.comment,
    };
  }

  async addScore(input: Parameters<DataApi['addScore']>[0]) {
    must(await this.client.from('score_entries').insert(this.scoreRow(parse(scoreSchema, input))));
  }

  async updateScore(id: string, input: Parameters<DataApi['updateScore']>[1]) {
    await this.expectRow(
      this.client.from('score_entries').update(this.scoreRow(parse(scoreSchema, input))).eq('id', id).select('id'),
    );
  }

  async deleteScore(id: string) {
    await this.expectRow(this.client.from('score_entries').delete().eq('id', id).select('id'));
  }

  // ------------------------------------------------------------ ratings
  async rateMeeting(meetingId: string, score: number) {
    const value = parse(ratingSchema, score);
    const me = await this.myId();
    // the unique (meeting_id, participant_id) constraint makes this an
    // insert-or-change of the user's single rating
    must(
      await this.client
        .from('ratings')
        .upsert({ meeting_id: meetingId, participant_id: me, score: value }, { onConflict: 'meeting_id,participant_id' }),
    );
  }

  async removeRating(meetingId: string) {
    const me = await this.myId();
    must(await this.client.from('ratings').delete().eq('meeting_id', meetingId).eq('participant_id', me));
  }

  // ------------------------------------------------------------ participants, teams, settings
  async addParticipant(input: Parameters<DataApi['addParticipant']>[0]) {
    const v = parse(participantSchema, input);
    must(
      await this.client.from('participants').insert({
        display_name: v.displayName,
        avatar_color: v.avatarColor,
        avatar_url: v.avatarUrl,
        role: v.role,
        team_id: v.teamId,
        active: v.active,
      }),
    );
  }

  async updateParticipant(id: string, input: Parameters<DataApi['updateParticipant']>[1]) {
    const v = parse(participantSchema, input);
    await this.expectRow(
      this.client
        .from('participants')
        .update({
          display_name: v.displayName,
          avatar_color: v.avatarColor,
          avatar_url: v.avatarUrl,
          role: v.role,
          team_id: v.teamId,
          active: v.active,
        })
        .eq('id', id)
        .select('id'),
    );
  }

  async deleteParticipant(id: string) {
    await this.expectRow(this.client.from('participants').delete().eq('id', id).select('id'));
  }

  async addTeam(input: Parameters<DataApi['addTeam']>[0]) {
    must(await this.client.from('teams').insert(parse(teamSchema, input)));
  }

  async updateTeam(id: string, input: Parameters<DataApi['updateTeam']>[1]) {
    await this.expectRow(this.client.from('teams').update(parse(teamSchema, input)).eq('id', id).select('id'));
  }

  async deleteTeam(id: string) {
    await this.expectRow(this.client.from('teams').delete().eq('id', id).select('id'));
  }

  async updateSettings(input: Parameters<DataApi['updateSettings']>[0]) {
    const v = parse(settingsSchema, input);
    await this.expectRow(
      this.client
        .from('app_settings')
        .update({
          group_name: v.groupName,
          invite_code: v.inviteCode,
          ratings_public: v.ratingsPublic,
          default_start_time: v.defaultStartTime,
        })
        .eq('id', 1)
        .select('id'),
    );
  }

  async clearDemoData() {
    must(await this.client.rpc('clear_demo_data'));
  }

  subscribe(onChange: () => void): () => void {
    const channel = this.client
      .channel('fag-og-sosialt-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => onChange())
      .subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
