import { addDays, previousFriday } from '../dates';
import type {
  Activity,
  AgendaItem,
  AppSettings,
  IsoDate,
  Meeting,
  MeetingNote,
  Participant,
  Rating,
  ScoreEntry,
  ScoreHistoryEntry,
  Task,
  Team,
} from '../types';

export interface DemoDb {
  version: 1;
  settings: AppSettings;
  teams: Team[];
  participants: Participant[];
  meetings: Meeting[];
  agenda: Omit<AgendaItem, 'votes'>[];
  votes: { itemId: string; participantId: string }[];
  notes: MeetingNote[];
  tasks: Task[];
  activities: Activity[];
  attendance: { meetingId: string; participantId: string }[];
  scores: ScoreEntry[];
  history: ScoreHistoryEntry[];
  ratings: Rating[];
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function emptyDemoDb(): DemoDb {
  return {
    version: 1,
    settings: { groupName: 'Fag & Sosialt', inviteCode: 'demo-invitasjon', ratingsPublic: false, defaultStartTime: '14:00' },
    teams: [],
    participants: [],
    meetings: [],
    agenda: [],
    votes: [],
    notes: [],
    tasks: [],
    activities: [],
    attendance: [],
    scores: [],
    history: [],
    ratings: [],
  };
}

const PEOPLE: { name: string; color: string; role: Participant['role'] }[] = [
  { name: 'Kari Nordmann', color: '#2f6f5e', role: 'admin' },
  { name: 'Ola Hansen', color: '#c2703d', role: 'organizer' },
  { name: 'Ingrid Berg', color: '#4a6fa5', role: 'participant' },
  { name: 'Lars Johansen', color: '#8a5a9e', role: 'participant' },
  { name: 'Sofie Lie', color: '#b5484b', role: 'participant' },
  { name: 'Emil Dahl', color: '#3f7f8c', role: 'participant' },
];

const PAST_TITLES = [
  'Demo: Kodegjennomgang og quiz',
  'Demo: Lyntaler og bordtennis',
  'Demo: Sikkerhet i praksis',
  'Demo: Retro og pizzakveld',
  'Demo: Testing-dypdykk',
  'Demo: Arkitekturprat og spillkveld',
];

/**
 * Builds the same demo content as supabase/seed_demo.sql, relative to `today`.
 * Everything is flagged isDemo so it can be removed in one click.
 */
export function createDemoDb(today: IsoDate): DemoDb {
  const db = emptyDemoDb();
  const now = new Date().toISOString();
  const lastFriday = previousFriday(today);

  const fjord: Team = { id: uid(), name: 'Lag Fjord', color: '#2f6f5e', isDemo: true };
  const fjell: Team = { id: uid(), name: 'Lag Fjell', color: '#c2703d', isDemo: true };
  db.teams.push(fjord, fjell);

  const people = PEOPLE.map<Participant>((p, i) => ({
    id: uid(),
    userId: `demo-user-${i + 1}`,
    displayName: p.name,
    avatarUrl: null,
    avatarColor: p.color,
    role: p.role,
    teamId: i % 2 === 0 ? fjord.id : fjell.id,
    active: true,
    isDemo: true,
    createdAt: now,
  }));
  db.participants.push(...people);
  const person = (i: number): Participant => people[((i % people.length) + people.length) % people.length] as Participant;

  const meeting = (date: IsoDate, title: string, status: Meeting['status'], organizer: Participant): Meeting => ({
    id: uid(),
    date,
    title,
    status,
    startTime: '14:00',
    location: 'Kantina, 3. etg',
    organizerId: organizer.id,
    summary: null,
    finalNotes: null,
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  });

  const pastMeetings: Meeting[] = [];
  PAST_TITLES.forEach((title, idx) => {
    const i = idx + 1;
    const m = meeting(addDays(lastFriday, -(6 - i) * 7), title, 'completed', person(i % 3));
    m.summary = 'Demo-referat: Vi gikk gjennom ukas faglige tema, delte erfaringer og avsluttet med en sosial aktivitet.';
    m.finalNotes = 'Godt oppmøte og god stemning. (Demodata)';
    db.meetings.push(m);
    pastMeetings.push(m);

    people.forEach((p, jdx) => {
      const j = jdx + 1;
      if ((i + j) % 5 === 0) return;
      db.attendance.push({ meetingId: m.id, participantId: p.id });
      db.ratings.push({ id: uid(), meetingId: m.id, participantId: p.id, score: 5 + ((i * 3 + j * 7) % 6), updatedAt: now });
    });

    const score = (activity: string, points: number, comment: string | null, p: Participant | null, team: Team | null) => {
      db.scores.push({
        id: uid(),
        meetingId: m.id,
        activity,
        participantId: p?.id ?? null,
        teamId: team?.id ?? null,
        points,
        comment,
        createdBy: null,
        isDemo: true,
        createdAt: now,
      });
    };
    score('Quiz', 8 + (i % 4), 'Flest riktige svar', person(i), null);
    score('Quiz', 4 + (i % 3), null, person(i + 2), null);
    score('Bordtennis', 3 + ((i * 2) % 5), 'Vant finalen', person(i + 4), null);
    score('Lagkonkurranse', 15, null, null, i % 2 === 0 ? fjord : fjell);

    const agenda = (title: string, kind: AgendaItem['kind'], position: number, assignee: Participant | null) =>
      db.agenda.push({
        id: uid(),
        meetingId: m.id,
        kind,
        title,
        description: null,
        link: null,
        highPriority: false,
        assigneeId: assignee?.id ?? null,
        completed: true,
        position,
        createdBy: null,
        isDemo: true,
        createdAt: now,
      });
    agenda('Ukas faglige tema', 'topic', 1, person(i));
    agenda('Runde rundt bordet', 'topic', 2, null);
    agenda('Sosial aktivitet', 'activity', 3, null);

    db.activities.push({
      id: uid(),
      meetingId: m.id,
      name: 'Quiz',
      description: 'Ti spørsmål om teknologi og kultur',
      result: 'Se poengtavlen',
      createdBy: null,
      isDemo: true,
      createdAt: now,
    });
  });

  const latest = pastMeetings[pastMeetings.length - 1] as Meeting;
  const note = (kind: MeetingNote['kind'], content: string, author: Participant) =>
    db.notes.push({ id: uid(), meetingId: latest.id, kind, content, authorId: author.id, isDemo: true, createdAt: now });
  note('discussion', 'Hvordan vi kan korte ned tiden fra PR til produksjon.', person(1));
  note('discussion', 'Erfaringer med parprogrammering på tvers av team.', person(2));
  note('decision', 'Vi prøver ut faste kodegjennomganger hver tirsdag.', person(0));
  note('takeaway', 'Små PR-er blir gjennomgått raskere.', person(3));
  db.tasks.push(
    {
      id: uid(),
      meetingId: latest.id,
      title: 'Sette opp tirsdagsmøte i kalenderen',
      assigneeId: person(0).id,
      dueDate: addDays(lastFriday, 4),
      done: false,
      createdBy: null,
      isDemo: true,
      createdAt: now,
    },
    {
      id: uid(),
      meetingId: latest.id,
      title: 'Dele lysbildene fra lyntalen',
      assigneeId: person(2).id,
      dueDate: addDays(lastFriday, 7),
      done: true,
      createdBy: null,
      isDemo: true,
      createdAt: now,
    },
  );

  [1, 2].forEach((i) => {
    const m = meeting(
      addDays(lastFriday, i * 7),
      i === 1 ? 'Demo: Høstquiz og AI-verktøy' : 'Demo: Julebordplanlegging',
      'planned',
      person(1),
    );
    db.meetings.push(m);
    const items: [string, AgendaItem['kind'], string | null, boolean, Participant][] = [
      ['Velkommen og runde rundt bordet', 'topic', null, false, person(0)],
      ['Erfaringer med AI-verktøy i hverdagen', 'topic', 'Hva fungerer, og hva gjør det ikke?', true, person(1)],
      ['Høstquiz', 'activity', 'Lagkonkurranse, ti spørsmål', false, person(4)],
    ];
    items.forEach(([title, kind, description, highPriority, assignee], idx) =>
      db.agenda.push({
        id: uid(),
        meetingId: m.id,
        kind,
        title,
        description,
        link: null,
        highPriority,
        assigneeId: assignee.id,
        completed: false,
        position: idx + 1,
        createdBy: person(1).id,
        isDemo: true,
        createdAt: now,
      }),
    );
  });

  const idea = (title: string, kind: AgendaItem['kind'], description: string, link: string | null, voters: number[]) => {
    const id = uid();
    db.agenda.push({
      id,
      meetingId: null,
      kind,
      title,
      description,
      link,
      highPriority: false,
      assigneeId: null,
      completed: false,
      position: 0,
      createdBy: person(2).id,
      isDemo: true,
      createdAt: now,
    });
    voters.forEach((v) => db.votes.push({ itemId: id, participantId: person(v).id }));
  };
  idea('Demo: Universell utforming i praksis', 'topic', 'Gjennomgang av WCAG-kravene', 'https://www.uutilsynet.no/', [1, 2, 3]);
  idea('Demo: Escape room', 'activity', 'Teambuilding i byen', null, [4]);

  return db;
}
