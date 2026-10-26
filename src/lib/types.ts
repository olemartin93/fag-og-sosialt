export type Role = 'admin' | 'organizer' | 'participant';
export type MeetingStatus = 'planned' | 'ongoing' | 'completed' | 'skipped';
export type NoteKind = 'discussion' | 'decision' | 'takeaway' | 'note';
export type AgendaKind = 'topic' | 'activity';

/** ISO calendar date, `YYYY-MM-DD` */
export type IsoDate = string;

export interface Participant {
  id: string;
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string;
  role: Role;
  teamId: string | null;
  active: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  isDemo: boolean;
}

export interface Meeting {
  id: string;
  date: IsoDate;
  title: string;
  status: MeetingStatus;
  startTime: string | null;
  location: string | null;
  organizerId: string | null;
  summary: string | null;
  finalNotes: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Meeting row plus small counters used by lists and the calendar. */
export interface MeetingOverview extends Meeting {
  notesCount: number;
  agendaCount: number;
  agendaDoneCount: number;
}

export interface AgendaItem {
  id: string;
  meetingId: string | null;
  kind: AgendaKind;
  title: string;
  description: string | null;
  link: string | null;
  highPriority: boolean;
  assigneeId: string | null;
  completed: boolean;
  position: number;
  createdBy: string | null;
  isDemo: boolean;
  createdAt: string;
  /** participant ids that voted for the item */
  votes: string[];
}

export interface MeetingNote {
  id: string;
  meetingId: string;
  kind: NoteKind;
  content: string;
  authorId: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  meetingId: string;
  title: string;
  assigneeId: string | null;
  dueDate: IsoDate | null;
  done: boolean;
  createdBy: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  meetingId: string;
  name: string;
  description: string | null;
  result: string | null;
  createdBy: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface ScoreEntry {
  id: string;
  meetingId: string;
  activity: string;
  participantId: string | null;
  teamId: string | null;
  points: number;
  comment: string | null;
  createdBy: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface ScoreHistoryEntry {
  id: string;
  scoreId: string;
  meetingId: string | null;
  action: 'insert' | 'update' | 'delete';
  subjectName: string | null;
  activity: string | null;
  oldPoints: number | null;
  newPoints: number | null;
  changedBy: string | null;
  changedAt: string;
}

export interface Rating {
  id: string;
  meetingId: string;
  participantId: string;
  score: number;
  updatedAt: string;
}

export interface MeetingRatingStats {
  meetingId: string;
  date: IsoDate;
  title: string;
  /** null when nobody has rated yet */
  average: number | null;
  count: number;
  min: number | null;
  max: number | null;
  /** index 0 = votes for 1, index 9 = votes for 10 */
  distribution: number[];
}

export interface LeaderboardRow {
  subjectType: 'participant' | 'team';
  subjectId: string;
  name: string;
  color: string;
  totalPoints: number;
  entries: number;
  meetings: number;
  rank: number;
}

export interface LeaderboardFilter {
  from?: IsoDate;
  to?: IsoDate;
  meetingId?: string;
  activity?: string;
}

export interface ParticipantStats {
  participantId: string;
  totalPoints: number;
  scoreEntries: number;
  meetingsAttended: number;
  ratingsGiven: number;
  avgRatingGiven: number | null;
}

export interface FeedItem {
  kind: 'note' | 'score' | 'agenda' | 'summary';
  itemId: string;
  meetingId: string | null;
  meetingDate: IsoDate | null;
  label: string;
  actorName: string | null;
  at: string;
}

export interface AppSettings {
  groupName: string;
  inviteCode: string;
  ratingsPublic: boolean;
  defaultStartTime: string;
}

export interface MeetingBundle {
  meeting: Meeting;
  agenda: AgendaItem[];
  notes: MeetingNote[];
  tasks: Task[];
  activities: Activity[];
  scores: ScoreEntry[];
  history: ScoreHistoryEntry[];
  attendance: string[];
  myRating: number | null;
}

export interface SessionUser {
  userId: string;
  email: string | null;
  participant: Participant | null;
}
