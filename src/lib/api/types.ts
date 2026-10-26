import type {
  AgendaItem,
  AppSettings,
  FeedItem,
  IsoDate,
  LeaderboardFilter,
  LeaderboardRow,
  Meeting,
  MeetingBundle,
  MeetingOverview,
  MeetingRatingStats,
  Participant,
  ParticipantStats,
  Rating,
  ScoreEntry,
  ScoreHistoryEntry,
  SessionUser,
  Team,
} from '../types';
import type {
  ActivityInput,
  AgendaItemInput,
  MeetingInput,
  NoteInput,
  ParticipantInput,
  ScoreInput,
  SettingsInput,
  TaskInput,
  TeamInput,
} from '../validation';

export type BackendMode = 'supabase' | 'demo';

export interface SignUpInput {
  displayName: string;
  email: string;
  password: string;
  inviteCode: string;
}

/**
 * Everything the UI needs from a backend. Implemented by
 * SupabaseApi (shared database) and DemoApi (on-device demo).
 */
export interface DataApi {
  readonly mode: BackendMode;

  // auth
  getSession(): Promise<SessionUser | null>;
  onAuthChange(callback: (event: 'signed-in' | 'signed-out' | 'password-recovery') => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /** Demo only: accounts you can sign in as. */
  demoAccounts?(): Promise<Participant[]>;
  signInAsDemo?(participantId: string): Promise<void>;
  resetDemo?(): Promise<void>;

  // reads
  getSettings(): Promise<AppSettings>;
  listParticipants(): Promise<Participant[]>;
  listTeams(): Promise<Team[]>;
  listMeetings(): Promise<MeetingOverview[]>;
  getMeetingByDate(date: IsoDate): Promise<Meeting | null>;
  getMeetingBundle(meetingId: string): Promise<MeetingBundle>;
  listAgendaItems(): Promise<AgendaItem[]>;
  ratingStats(): Promise<MeetingRatingStats[]>;
  ratingsByParticipant(participantId: string): Promise<Rating[]>;
  leaderboard(filter: LeaderboardFilter): Promise<LeaderboardRow[]>;
  listScores(): Promise<ScoreEntry[]>;
  scoreHistory(limit: number): Promise<ScoreHistoryEntry[]>;
  participantStats(): Promise<ParticipantStats[]>;
  recentActivity(limit: number): Promise<FeedItem[]>;

  // meetings
  ensureMeeting(date: IsoDate): Promise<string>;
  createMeeting(input: MeetingInput): Promise<Meeting>;
  updateMeeting(id: string, input: MeetingInput): Promise<void>;
  deleteMeeting(id: string): Promise<void>;

  // agenda
  addAgendaItem(input: AgendaItemInput): Promise<void>;
  updateAgendaItem(id: string, input: AgendaItemInput): Promise<void>;
  deleteAgendaItem(id: string): Promise<void>;
  setAgendaCompleted(id: string, completed: boolean): Promise<void>;
  reorderAgenda(meetingId: string, orderedIds: string[]): Promise<void>;
  toggleVote(itemId: string, vote: boolean): Promise<void>;

  // notes / tasks / activities / attendance
  addNote(meetingId: string, input: NoteInput): Promise<void>;
  updateNote(id: string, input: NoteInput): Promise<void>;
  deleteNote(id: string): Promise<void>;
  addTask(meetingId: string, input: TaskInput): Promise<void>;
  updateTask(id: string, input: TaskInput): Promise<void>;
  deleteTask(id: string): Promise<void>;
  addActivity(meetingId: string, input: ActivityInput): Promise<void>;
  updateActivity(id: string, input: ActivityInput): Promise<void>;
  deleteActivity(id: string): Promise<void>;
  setAttendance(meetingId: string, participantId: string, present: boolean): Promise<void>;

  // scores
  addScore(input: ScoreInput): Promise<void>;
  updateScore(id: string, input: ScoreInput): Promise<void>;
  deleteScore(id: string): Promise<void>;

  // ratings
  rateMeeting(meetingId: string, score: number): Promise<void>;
  removeRating(meetingId: string): Promise<void>;

  // participants, teams, settings
  addParticipant(input: ParticipantInput): Promise<void>;
  updateParticipant(id: string, input: ParticipantInput): Promise<void>;
  deleteParticipant(id: string): Promise<void>;
  addTeam(input: TeamInput): Promise<void>;
  updateTeam(id: string, input: TeamInput): Promise<void>;
  deleteTeam(id: string): Promise<void>;
  updateSettings(input: SettingsInput): Promise<void>;
  clearDemoData(): Promise<void>;

  /** Called whenever shared data changes (realtime / other tabs). */
  subscribe(onChange: () => void): () => void;
}

/** Error with a translation key the UI can show. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'ApiError';
  }
}

export type ApiErrorCode =
  | 'forbidden'
  | 'notFound'
  | 'duplicate'
  | 'validation'
  | 'offline'
  | 'invalidCredentials'
  | 'invalidInvite'
  | 'emailNotConfirmed'
  | 'unknown';
