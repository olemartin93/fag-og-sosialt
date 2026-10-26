import { osloToday } from '../dates';
import {
  canCreateMeetingOn,
  canDeleteAgendaItem,
  canDeleteTask,
  canEditActivity,
  canEditAgendaItem,
  canEditNote,
  canEditTask,
  canManageMeeting,
  canManageScores,
  canRate,
  canToggleAttendance,
  isAdmin,
  isMember,
  isOrganizer,
} from '../permissions';
import { computeLeaderboard, computeRatingStats } from '../stats';
import type {
  AgendaItem,
  FeedItem,
  IsoDate,
  Meeting,
  MeetingOverview,
  Participant,
  ScoreEntry,
  SessionUser,
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
  taskSchema,
  teamSchema,
} from '../validation';
import type { z } from 'zod';
import { createDemoDb, type DemoDb, uid } from './demoData';
import { ApiError, type DataApi } from './types';

const DB_KEY = 'fos-demo-db-v1';
const SESSION_KEY = 'fos-demo-session';

export interface DemoApiOptions {
  storage?: Storage;
  now?: () => Date;
}

/**
 * Fully working backend that keeps data on this device (localStorage).
 * Used when no Supabase project is configured, so the app can be tried
 * immediately. Applies the same permission rules as the database.
 */
export class DemoApi implements DataApi {
  readonly mode = 'demo' as const;
  private storage: Storage;
  private now: () => Date;
  private listeners = new Set<() => void>();
  private authListeners = new Set<(e: 'signed-in' | 'signed-out' | 'password-recovery') => void>();

  constructor(options: DemoApiOptions = {}) {
    this.storage = options.storage ?? window.localStorage;
    this.now = options.now ?? (() => new Date());
    if (typeof window !== 'undefined' && !options.storage) {
      window.addEventListener('storage', (e) => {
        if (e.key === DB_KEY) this.emit();
      });
    }
  }

  // ------------------------------------------------------------ storage
  private today(): IsoDate {
    return osloToday(this.now());
  }

  private load(): DemoDb {
    const raw = this.storage.getItem(DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoDb;
        if (parsed.version === 1) return parsed;
      } catch {
        // fall through and rebuild
      }
    }
    const db = createDemoDb(this.today());
    this.storage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  private async write(mutator: (db: DemoDb, me: Participant) => void): Promise<void> {
    const db = this.load();
    const me = this.me(db);
    if (!me) throw new ApiError('forbidden');
    mutator(db, me);
    this.storage.setItem(DB_KEY, JSON.stringify(db));
    this.emit();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private me(db: DemoDb): Participant | null {
    const id = this.storage.getItem(SESSION_KEY);
    const p = db.participants.find((x) => x.id === id);
    return p && p.active ? p : null;
  }

  private parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
    const result = schema.safeParse(input);
    if (!result.success) throw new ApiError('validation', result.error.issues[0]?.message);
    return result.data;
  }

  private meeting(db: DemoDb, id: string | null | undefined): Meeting | undefined {
    return id ? db.meetings.find((m) => m.id === id) : undefined;
  }

  private find<T extends { id: string }>(list: T[], id: string): T {
    const item = list.find((x) => x.id === id);
    if (!item) throw new ApiError('notFound');
    return item;
  }

  private stamp(): string {
    return this.now().toISOString();
  }

  // ------------------------------------------------------------ auth
  async getSession(): Promise<SessionUser | null> {
    const db = this.load();
    const id = this.storage.getItem(SESSION_KEY);
    const p = db.participants.find((x) => x.id === id);
    if (!p) return null;
    return { userId: p.userId ?? p.id, email: null, participant: p.active ? p : null };
  }

  onAuthChange(callback: (event: 'signed-in' | 'signed-out' | 'password-recovery') => void): () => void {
    this.authListeners.add(callback);
    return () => this.authListeners.delete(callback);
  }

  async demoAccounts(): Promise<Participant[]> {
    return this.load().participants.filter((p) => p.active && p.userId);
  }

  async signInAsDemo(participantId: string): Promise<void> {
    const db = this.load();
    if (!db.participants.some((p) => p.id === participantId && p.active)) throw new ApiError('notFound');
    this.storage.setItem(SESSION_KEY, participantId);
    this.authListeners.forEach((l) => l('signed-in'));
  }

  async signIn(): Promise<void> {
    throw new ApiError('invalidCredentials');
  }

  async signUp(): Promise<{ needsConfirmation: boolean }> {
    throw new ApiError('forbidden');
  }

  async signOut(): Promise<void> {
    this.storage.removeItem(SESSION_KEY);
    this.authListeners.forEach((l) => l('signed-out'));
  }

  async requestPasswordReset(): Promise<void> {
    throw new ApiError('forbidden');
  }

  async updatePassword(): Promise<void> {
    throw new ApiError('forbidden');
  }

  async resetDemo(): Promise<void> {
    this.storage.setItem(DB_KEY, JSON.stringify(createDemoDb(this.today())));
    this.storage.removeItem(SESSION_KEY);
    this.authListeners.forEach((l) => l('signed-out'));
    this.emit();
  }

  // ------------------------------------------------------------ reads
  async getSettings() {
    return this.load().settings;
  }

  async listParticipants() {
    return [...this.load().participants].sort((a, b) => a.displayName.localeCompare(b.displayName, 'nb'));
  }

  async listTeams() {
    return [...this.load().teams].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  }

  async listMeetings(): Promise<MeetingOverview[]> {
    const db = this.load();
    return [...db.meetings]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => {
        const agenda = db.agenda.filter((a) => a.meetingId === m.id);
        return {
          ...m,
          notesCount: db.notes.filter((n) => n.meetingId === m.id).length,
          agendaCount: agenda.length,
          agendaDoneCount: agenda.filter((a) => a.completed).length,
        };
      });
  }

  async getMeetingByDate(date: IsoDate) {
    return this.load().meetings.find((m) => m.date === date) ?? null;
  }

  private withVotes(db: DemoDb, item: Omit<AgendaItem, 'votes'>): AgendaItem {
    return { ...item, votes: db.votes.filter((v) => v.itemId === item.id).map((v) => v.participantId) };
  }

  async getMeetingBundle(meetingId: string) {
    const db = this.load();
    const meeting = this.find(db.meetings, meetingId);
    const me = this.me(db);
    const byDate = <T extends { createdAt: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt);
    return {
      meeting,
      agenda: db.agenda
        .filter((a) => a.meetingId === meetingId)
        .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
        .map((a) => this.withVotes(db, a)),
      notes: db.notes.filter((n) => n.meetingId === meetingId).sort(byDate),
      tasks: db.tasks.filter((t) => t.meetingId === meetingId).sort(byDate),
      activities: db.activities.filter((a) => a.meetingId === meetingId).sort(byDate),
      scores: db.scores.filter((s) => s.meetingId === meetingId).sort(byDate),
      history: db.history
        .filter((h) => h.meetingId === meetingId)
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
      attendance: db.attendance.filter((a) => a.meetingId === meetingId).map((a) => a.participantId),
      myRating: db.ratings.find((r) => r.meetingId === meetingId && r.participantId === me?.id)?.score ?? null,
    };
  }

  async listAgendaItems() {
    const db = this.load();
    return db.agenda.map((a) => this.withVotes(db, a)).sort((a, b) => a.position - b.position);
  }

  async ratingStats() {
    const db = this.load();
    return [...db.meetings]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => computeRatingStats(m, db.ratings));
  }

  async ratingsByParticipant(participantId: string) {
    const db = this.load();
    const me = this.me(db);
    if (participantId !== me?.id && !db.settings.ratingsPublic) return [];
    return db.ratings.filter((r) => r.participantId === participantId);
  }

  async leaderboard(filter: Parameters<DataApi['leaderboard']>[0]) {
    const db = this.load();
    return computeLeaderboard(db.scores, db.participants, db.teams, db.meetings, filter);
  }

  async listScores() {
    return [...this.load().scores].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async scoreHistory(limit: number) {
    return [...this.load().history].sort((a, b) => b.changedAt.localeCompare(a.changedAt)).slice(0, limit);
  }

  async participantStats() {
    const db = this.load();
    const me = this.me(db);
    return db.participants.map((p) => {
      const scores = db.scores.filter((s) => s.participantId === p.id);
      const ratings = db.ratings.filter((r) => r.participantId === p.id);
      const showAvg = p.id === me?.id || db.settings.ratingsPublic;
      return {
        participantId: p.id,
        totalPoints: scores.reduce((n, s) => n + s.points, 0),
        scoreEntries: scores.length,
        meetingsAttended: db.attendance.filter((a) => a.participantId === p.id).length,
        ratingsGiven: ratings.length,
        avgRatingGiven:
          showAvg && ratings.length
            ? Math.round((ratings.reduce((n, r) => n + r.score, 0) / ratings.length) * 10) / 10
            : null,
      };
    });
  }

  async recentActivity(limit: number): Promise<FeedItem[]> {
    const db = this.load();
    const name = (id: string | null) => db.participants.find((p) => p.id === id)?.displayName ?? null;
    const date = (id: string | null) => db.meetings.find((m) => m.id === id)?.date ?? null;
    const subject = (s: ScoreEntry) =>
      db.participants.find((p) => p.id === s.participantId)?.displayName ??
      db.teams.find((t) => t.id === s.teamId)?.name ??
      '?';
    const feed: FeedItem[] = [
      ...db.notes.map<FeedItem>((n) => ({
        kind: 'note',
        itemId: n.id,
        meetingId: n.meetingId,
        meetingDate: date(n.meetingId),
        label: n.content.slice(0, 140),
        actorName: name(n.authorId),
        at: n.createdAt,
      })),
      ...db.scores.map<FeedItem>((s) => ({
        kind: 'score',
        itemId: s.id,
        meetingId: s.meetingId,
        meetingDate: date(s.meetingId),
        label: `${subject(s)} · ${s.activity} · ${s.points}`,
        actorName: name(s.createdBy),
        at: s.createdAt,
      })),
      ...db.agenda.map<FeedItem>((a) => ({
        kind: 'agenda',
        itemId: a.id,
        meetingId: a.meetingId,
        meetingDate: date(a.meetingId),
        label: a.title,
        actorName: name(a.createdBy),
        at: a.createdAt,
      })),
      ...db.meetings
        .filter((m) => m.summary?.trim())
        .map<FeedItem>((m) => ({
          kind: 'summary',
          itemId: m.id,
          meetingId: m.id,
          meetingDate: m.date,
          label: m.title,
          actorName: name(m.organizerId),
          at: m.updatedAt,
        })),
    ];
    return feed.sort((a, b) => b.at.localeCompare(a.at)).slice(0, Math.min(Math.max(limit, 1), 50));
  }

  // ------------------------------------------------------------ meetings
  async ensureMeeting(date: IsoDate): Promise<string> {
    let id = '';
    await this.write((db, me) => {
      const existing = db.meetings.find((m) => m.date === date);
      if (existing) {
        id = existing.id;
        return;
      }
      if (!canCreateMeetingOn(me, date)) throw new ApiError('forbidden');
      const m: Meeting = {
        id: uid(),
        date,
        title: 'Fag og sosialt',
        status: 'planned',
        startTime: db.settings.defaultStartTime,
        location: null,
        organizerId: null,
        summary: null,
        finalNotes: null,
        isDemo: false,
        createdAt: this.stamp(),
        updatedAt: this.stamp(),
      };
      db.meetings.push(m);
      id = m.id;
    });
    return id;
  }

  async createMeeting(input: Parameters<DataApi['createMeeting']>[0]): Promise<Meeting> {
    const v = this.parse(meetingSchema, input);
    let created: Meeting | undefined;
    await this.write((db, me) => {
      if (!isOrganizer(me)) throw new ApiError('forbidden');
      if (db.meetings.some((m) => m.date === v.date)) throw new ApiError('duplicate');
      created = { id: uid(), ...v, isDemo: false, createdAt: this.stamp(), updatedAt: this.stamp() };
      db.meetings.push(created);
    });
    return created as Meeting;
  }

  async updateMeeting(id: string, input: Parameters<DataApi['updateMeeting']>[1]) {
    const v = this.parse(meetingSchema, input);
    await this.write((db, me) => {
      const m = this.find(db.meetings, id);
      if (!canManageMeeting(me, m)) throw new ApiError('forbidden');
      if (db.meetings.some((x) => x.date === v.date && x.id !== id)) throw new ApiError('duplicate');
      Object.assign(m, v, { updatedAt: this.stamp() });
    });
  }

  async deleteMeeting(id: string) {
    await this.write((db, me) => {
      if (!isOrganizer(me)) throw new ApiError('forbidden');
      this.find(db.meetings, id);
      const itemIds = new Set(db.agenda.filter((a) => a.meetingId === id).map((a) => a.id));
      db.meetings = db.meetings.filter((m) => m.id !== id);
      db.agenda = db.agenda.filter((a) => a.meetingId !== id);
      db.votes = db.votes.filter((v) => !itemIds.has(v.itemId));
      db.notes = db.notes.filter((n) => n.meetingId !== id);
      db.tasks = db.tasks.filter((t) => t.meetingId !== id);
      db.activities = db.activities.filter((a) => a.meetingId !== id);
      db.attendance = db.attendance.filter((a) => a.meetingId !== id);
      db.scores = db.scores.filter((s) => s.meetingId !== id);
      db.ratings = db.ratings.filter((r) => r.meetingId !== id);
    });
  }

  // ------------------------------------------------------------ agenda
  async addAgendaItem(input: Parameters<DataApi['addAgendaItem']>[0]) {
    const v = this.parse(agendaItemSchema, input);
    await this.write((db, me) => {
      if (!isMember(me)) throw new ApiError('forbidden');
      if (v.meetingId) this.find(db.meetings, v.meetingId);
      const maxPos = Math.max(0, ...db.agenda.filter((a) => a.meetingId === v.meetingId).map((a) => a.position));
      db.agenda.push({
        id: uid(),
        ...v,
        completed: false,
        position: maxPos + 1,
        createdBy: me.id,
        isDemo: false,
        createdAt: this.stamp(),
      });
    });
  }

  async updateAgendaItem(id: string, input: Parameters<DataApi['updateAgendaItem']>[1]) {
    const v = this.parse(agendaItemSchema, input);
    await this.write((db, me) => {
      const item = this.find(db.agenda, id);
      if (!canEditAgendaItem(me, { ...item, votes: [] }, this.meeting(db, item.meetingId))) throw new ApiError('forbidden');
      if (v.meetingId !== item.meetingId) {
        if (v.meetingId) this.find(db.meetings, v.meetingId);
        item.position = Math.max(0, ...db.agenda.filter((a) => a.meetingId === v.meetingId).map((a) => a.position)) + 1;
      }
      Object.assign(item, v);
    });
  }

  async deleteAgendaItem(id: string) {
    await this.write((db, me) => {
      const item = this.find(db.agenda, id);
      if (!canDeleteAgendaItem(me, { ...item, votes: [] }, this.meeting(db, item.meetingId))) throw new ApiError('forbidden');
      db.agenda = db.agenda.filter((a) => a.id !== id);
      db.votes = db.votes.filter((v) => v.itemId !== id);
    });
  }

  async setAgendaCompleted(id: string, completed: boolean) {
    await this.write((db) => {
      this.find(db.agenda, id).completed = completed;
    });
  }

  async reorderAgenda(meetingId: string, orderedIds: string[]) {
    await this.write((db, me) => {
      if (!canManageMeeting(me, this.find(db.meetings, meetingId))) throw new ApiError('forbidden');
      orderedIds.forEach((id, i) => {
        const item = db.agenda.find((a) => a.id === id && a.meetingId === meetingId);
        if (item) item.position = i + 1;
      });
    });
  }

  async toggleVote(itemId: string, vote: boolean) {
    await this.write((db, me) => {
      this.find(db.agenda, itemId);
      db.votes = db.votes.filter((v) => !(v.itemId === itemId && v.participantId === me.id));
      if (vote) db.votes.push({ itemId, participantId: me.id });
    });
  }

  // ------------------------------------------------------------ notes, tasks, activities
  async addNote(meetingId: string, input: Parameters<DataApi['addNote']>[1]) {
    const v = this.parse(noteSchema, input);
    await this.write((db, me) => {
      this.find(db.meetings, meetingId);
      db.notes.push({ id: uid(), meetingId, ...v, authorId: me.id, isDemo: false, createdAt: this.stamp() });
    });
  }

  async updateNote(id: string, input: Parameters<DataApi['updateNote']>[1]) {
    const v = this.parse(noteSchema, input);
    await this.write((db, me) => {
      const n = this.find(db.notes, id);
      if (!canEditNote(me, n, this.meeting(db, n.meetingId))) throw new ApiError('forbidden');
      Object.assign(n, v);
    });
  }

  async deleteNote(id: string) {
    await this.write((db, me) => {
      const n = this.find(db.notes, id);
      if (!canEditNote(me, n, this.meeting(db, n.meetingId))) throw new ApiError('forbidden');
      db.notes = db.notes.filter((x) => x.id !== id);
    });
  }

  async addTask(meetingId: string, input: Parameters<DataApi['addTask']>[1]) {
    const v = this.parse(taskSchema, input);
    await this.write((db, me) => {
      this.find(db.meetings, meetingId);
      db.tasks.push({ id: uid(), meetingId, ...v, createdBy: me.id, isDemo: false, createdAt: this.stamp() });
    });
  }

  async updateTask(id: string, input: Parameters<DataApi['updateTask']>[1]) {
    const v = this.parse(taskSchema, input);
    await this.write((db, me) => {
      const t = this.find(db.tasks, id);
      if (!canEditTask(me, t, this.meeting(db, t.meetingId))) throw new ApiError('forbidden');
      Object.assign(t, v);
    });
  }

  async deleteTask(id: string) {
    await this.write((db, me) => {
      const t = this.find(db.tasks, id);
      if (!canDeleteTask(me, t, this.meeting(db, t.meetingId))) throw new ApiError('forbidden');
      db.tasks = db.tasks.filter((x) => x.id !== id);
    });
  }

  async addActivity(meetingId: string, input: Parameters<DataApi['addActivity']>[1]) {
    const v = this.parse(activitySchema, input);
    await this.write((db, me) => {
      this.find(db.meetings, meetingId);
      db.activities.push({ id: uid(), meetingId, ...v, createdBy: me.id, isDemo: false, createdAt: this.stamp() });
    });
  }

  async updateActivity(id: string, input: Parameters<DataApi['updateActivity']>[1]) {
    const v = this.parse(activitySchema, input);
    await this.write((db, me) => {
      const a = this.find(db.activities, id);
      if (!canEditActivity(me, a, this.meeting(db, a.meetingId))) throw new ApiError('forbidden');
      Object.assign(a, v);
    });
  }

  async deleteActivity(id: string) {
    await this.write((db, me) => {
      const a = this.find(db.activities, id);
      if (!canEditActivity(me, a, this.meeting(db, a.meetingId))) throw new ApiError('forbidden');
      db.activities = db.activities.filter((x) => x.id !== id);
    });
  }

  async setAttendance(meetingId: string, participantId: string, present: boolean) {
    await this.write((db, me) => {
      const m = this.find(db.meetings, meetingId);
      if (!canToggleAttendance(me, participantId, m)) throw new ApiError('forbidden');
      db.attendance = db.attendance.filter((a) => !(a.meetingId === meetingId && a.participantId === participantId));
      if (present) db.attendance.push({ meetingId, participantId });
    });
  }

  // ------------------------------------------------------------ scores
  private subjectName(db: DemoDb, s: Pick<ScoreEntry, 'participantId' | 'teamId'>): string | null {
    return (
      db.participants.find((p) => p.id === s.participantId)?.displayName ??
      db.teams.find((t) => t.id === s.teamId)?.name ??
      null
    );
  }

  private log(db: DemoDb, me: Participant, s: ScoreEntry, action: 'insert' | 'update' | 'delete', oldPoints: number | null, newPoints: number | null) {
    db.history.push({
      id: uid(),
      scoreId: s.id,
      meetingId: s.meetingId,
      action,
      subjectName: this.subjectName(db, s),
      activity: s.activity,
      oldPoints,
      newPoints,
      changedBy: me.id,
      changedAt: this.stamp(),
    });
  }

  async addScore(input: Parameters<DataApi['addScore']>[0]) {
    const v = this.parse(scoreSchema, input);
    await this.write((db, me) => {
      if (!canManageScores(me, this.find(db.meetings, v.meetingId))) throw new ApiError('forbidden');
      const s: ScoreEntry = { id: uid(), ...v, createdBy: me.id, isDemo: false, createdAt: this.stamp() };
      db.scores.push(s);
      this.log(db, me, s, 'insert', null, s.points);
    });
  }

  async updateScore(id: string, input: Parameters<DataApi['updateScore']>[1]) {
    const v = this.parse(scoreSchema, input);
    await this.write((db, me) => {
      const s = this.find(db.scores, id);
      if (!canManageScores(me, this.meeting(db, s.meetingId))) throw new ApiError('forbidden');
      if (!canManageScores(me, this.find(db.meetings, v.meetingId))) throw new ApiError('forbidden');
      const old = s.points;
      Object.assign(s, v);
      this.log(db, me, s, 'update', old, s.points);
    });
  }

  async deleteScore(id: string) {
    await this.write((db, me) => {
      const s = this.find(db.scores, id);
      if (!canManageScores(me, this.meeting(db, s.meetingId))) throw new ApiError('forbidden');
      db.scores = db.scores.filter((x) => x.id !== id);
      this.log(db, me, s, 'delete', s.points, null);
    });
  }

  // ------------------------------------------------------------ ratings
  async rateMeeting(meetingId: string, score: number) {
    const value = this.parse(ratingSchema, score);
    await this.write((db, me) => {
      const m = this.find(db.meetings, meetingId);
      if (!canRate(m, this.today())) throw new ApiError('forbidden');
      const existing = db.ratings.find((r) => r.meetingId === meetingId && r.participantId === me.id);
      if (existing) {
        existing.score = value;
        existing.updatedAt = this.stamp();
      } else {
        db.ratings.push({ id: uid(), meetingId, participantId: me.id, score: value, updatedAt: this.stamp() });
      }
    });
  }

  async removeRating(meetingId: string) {
    await this.write((db, me) => {
      db.ratings = db.ratings.filter((r) => !(r.meetingId === meetingId && r.participantId === me.id));
    });
  }

  // ------------------------------------------------------------ participants, teams, settings
  async addParticipant(input: Parameters<DataApi['addParticipant']>[0]) {
    const v = this.parse(participantSchema, input);
    await this.write((db, me) => {
      if (!isOrganizer(me)) throw new ApiError('forbidden');
      if (!isAdmin(me) && v.role !== 'participant') throw new ApiError('forbidden');
      db.participants.push({ id: uid(), userId: null, ...v, isDemo: false, createdAt: this.stamp() });
    });
  }

  async updateParticipant(id: string, input: Parameters<DataApi['updateParticipant']>[1]) {
    const v = this.parse(participantSchema, input);
    await this.write((db, me) => {
      const p = this.find(db.participants, id);
      const admin = isAdmin(me);
      if (!admin && p.id !== me.id) throw new ApiError('forbidden');
      if (!admin && (v.role !== p.role || v.teamId !== p.teamId || v.active !== p.active)) throw new ApiError('forbidden');
      const otherAdmins = db.participants.filter((x) => x.role === 'admin' && x.active && x.id !== p.id && x.userId);
      if (p.role === 'admin' && (v.role !== 'admin' || !v.active) && otherAdmins.length === 0) {
        throw new ApiError('forbidden', 'lastAdmin');
      }
      Object.assign(p, v);
    });
  }

  async deleteParticipant(id: string) {
    await this.write((db, me) => {
      if (!isAdmin(me) || id === me.id) throw new ApiError('forbidden');
      this.find(db.participants, id);
      db.participants = db.participants.filter((p) => p.id !== id);
      db.scores = db.scores.filter((s) => s.participantId !== id);
      db.ratings = db.ratings.filter((r) => r.participantId !== id);
      db.attendance = db.attendance.filter((a) => a.participantId !== id);
      db.votes = db.votes.filter((v) => v.participantId !== id);
    });
  }

  async addTeam(input: Parameters<DataApi['addTeam']>[0]) {
    const v = this.parse(teamSchema, input);
    await this.write((db, me) => {
      if (!isOrganizer(me)) throw new ApiError('forbidden');
      if (db.teams.some((t) => t.name.toLowerCase() === v.name.toLowerCase())) throw new ApiError('duplicate');
      db.teams.push({ id: uid(), ...v, isDemo: false });
    });
  }

  async updateTeam(id: string, input: Parameters<DataApi['updateTeam']>[1]) {
    const v = this.parse(teamSchema, input);
    await this.write((db, me) => {
      if (!isOrganizer(me)) throw new ApiError('forbidden');
      if (db.teams.some((t) => t.id !== id && t.name.toLowerCase() === v.name.toLowerCase())) throw new ApiError('duplicate');
      Object.assign(this.find(db.teams, id), v);
    });
  }

  async deleteTeam(id: string) {
    await this.write((db, me) => {
      if (!isOrganizer(me)) throw new ApiError('forbidden');
      this.find(db.teams, id);
      db.teams = db.teams.filter((t) => t.id !== id);
      db.scores = db.scores.filter((s) => s.teamId !== id);
      db.participants.forEach((p) => {
        if (p.teamId === id) p.teamId = null;
      });
    });
  }

  async updateSettings(input: Parameters<DataApi['updateSettings']>[0]) {
    const v = this.parse(settingsSchema, input);
    await this.write((db, me) => {
      if (!isAdmin(me)) throw new ApiError('forbidden');
      db.settings = v;
    });
  }

  async clearDemoData() {
    await this.write((db, me) => {
      if (!isAdmin(me)) throw new ApiError('forbidden');
      // keep the signed-in account so the device stays usable
      me.isDemo = false;
      const demoMeetings = new Set(db.meetings.filter((m) => m.isDemo).map((m) => m.id));
      const demoPeople = new Set(db.participants.filter((p) => p.isDemo && p.id !== me.id).map((p) => p.id));
      const demoTeams = new Set(db.teams.filter((t) => t.isDemo).map((t) => t.id));
      db.meetings = db.meetings.filter((m) => !m.isDemo);
      db.agenda = db.agenda.filter((a) => !a.isDemo && !(a.meetingId && demoMeetings.has(a.meetingId)));
      const items = new Set(db.agenda.map((a) => a.id));
      db.votes = db.votes.filter((v) => items.has(v.itemId) && !demoPeople.has(v.participantId));
      db.notes = db.notes.filter((n) => !n.isDemo && !demoMeetings.has(n.meetingId));
      db.tasks = db.tasks.filter((t) => !t.isDemo && !demoMeetings.has(t.meetingId));
      db.activities = db.activities.filter((a) => !a.isDemo && !demoMeetings.has(a.meetingId));
      db.attendance = db.attendance.filter((a) => !demoMeetings.has(a.meetingId) && !demoPeople.has(a.participantId));
      db.scores = db.scores.filter(
        (s) =>
          !s.isDemo &&
          !demoMeetings.has(s.meetingId) &&
          !(s.participantId && demoPeople.has(s.participantId)) &&
          !(s.teamId && demoTeams.has(s.teamId)),
      );
      db.ratings = db.ratings.filter((r) => !demoMeetings.has(r.meetingId) && !demoPeople.has(r.participantId));
      db.history = db.history.filter((h) => !(h.meetingId && demoMeetings.has(h.meetingId)));
      db.participants = db.participants.filter((p) => !demoPeople.has(p.id));
      db.teams = db.teams.filter((t) => !t.isDemo);
      db.participants.forEach((p) => {
        if (p.teamId && demoTeams.has(p.teamId)) p.teamId = null;
      });
    });
  }

  subscribe(onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }
}

/** Exposed for tests. */
export const demoKeys = { DB_KEY, SESSION_KEY };
