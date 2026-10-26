import type {
  IsoDate,
  LeaderboardFilter,
  LeaderboardRow,
  Meeting,
  MeetingRatingStats,
  Participant,
  Rating,
  ScoreEntry,
  Team,
} from './types';
import type { Locale } from './dates';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Same calculation as public.meeting_rating_stats() in the database. */
export function computeRatingStats(meeting: Meeting, ratings: Rating[]): MeetingRatingStats {
  const scores = ratings.filter((r) => r.meetingId === meeting.id).map((r) => r.score);
  const distribution = Array.from({ length: 10 }, (_, i) => scores.filter((s) => s === i + 1).length);
  const count = scores.length;
  return {
    meetingId: meeting.id,
    date: meeting.date,
    title: meeting.title,
    average: count ? round2(scores.reduce((a, b) => a + b, 0) / count) : null,
    count,
    min: count ? Math.min(...scores) : null,
    max: count ? Math.max(...scores) : null,
    distribution,
  };
}

export interface RatingOverview {
  /** Mean of per-meeting averages (every meeting weighs the same). */
  overallAverage: number | null;
  totalVotes: number;
  ratedMeetings: number;
  lastFiveAverage: number | null;
  best: MeetingRatingStats | null;
  worst: MeetingRatingStats | null;
}

function mean(values: number[]): number | null {
  return values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export function summarizeRatings(stats: MeetingRatingStats[]): RatingOverview {
  const rated = stats
    .filter((s): s is MeetingRatingStats & { average: number } => s.average !== null && s.count > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const byScore = [...rated].sort((a, b) => b.average - a.average || b.count - a.count || b.date.localeCompare(a.date));
  return {
    overallAverage: mean(rated.map((s) => s.average)),
    totalVotes: rated.reduce((n, s) => n + s.count, 0),
    ratedMeetings: rated.length,
    lastFiveAverage: mean(rated.slice(-5).map((s) => s.average)),
    best: byScore[0] ?? null,
    worst: byScore.length > 1 ? (byScore[byScore.length - 1] ?? null) : null,
  };
}

/** Average of the closest earlier rated meeting, for "compared with last time". */
export function previousRated(stats: MeetingRatingStats[], date: IsoDate): MeetingRatingStats | null {
  return (
    stats
      .filter((s) => s.date < date && s.average !== null)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  );
}

/** One decimal, locale-aware: 8.4 → «8,4» in Norwegian. */
export function formatScore(value: number | null | undefined, locale: Locale = 'nb'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return new Intl.NumberFormat(locale === 'nb' ? 'nb-NO' : 'en-GB', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPoints(value: number, locale: Locale = 'nb'): string {
  return new Intl.NumberFormat(locale === 'nb' ? 'nb-NO' : 'en-GB').format(value);
}

/** Same rules as public.leaderboard(): SQL rank() — ties share a rank. */
export function computeLeaderboard(
  scores: ScoreEntry[],
  participants: Participant[],
  teams: Team[],
  meetings: Meeting[],
  filter: LeaderboardFilter = {},
): LeaderboardRow[] {
  const meetingDate = new Map(meetings.map((m) => [m.id, m.date]));
  const filtered = scores.filter((s) => {
    const date = meetingDate.get(s.meetingId);
    if (!date) return false;
    if (filter.from && date < filter.from) return false;
    if (filter.to && date > filter.to) return false;
    if (filter.meetingId && s.meetingId !== filter.meetingId) return false;
    if (filter.activity && s.activity !== filter.activity) return false;
    return true;
  });

  const build = (type: LeaderboardRow['subjectType']): LeaderboardRow[] => {
    const groups = new Map<string, ScoreEntry[]>();
    for (const s of filtered) {
      const key = type === 'participant' ? s.participantId : s.teamId;
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    const rows: LeaderboardRow[] = [];
    for (const [id, entries] of groups) {
      const subject =
        type === 'participant'
          ? participants.find((p) => p.id === id)
          : teams.find((t) => t.id === id);
      if (!subject) continue;
      rows.push({
        subjectType: type,
        subjectId: id,
        name: 'displayName' in subject ? subject.displayName : subject.name,
        color: 'avatarColor' in subject ? subject.avatarColor : subject.color,
        totalPoints: entries.reduce((n, e) => n + e.points, 0),
        entries: entries.length,
        meetings: new Set(entries.map((e) => e.meetingId)).size,
        rank: 0,
      });
    }
    rows.sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name, 'nb'));
    rows.forEach((row, i) => {
      const prev = rows[i - 1];
      row.rank = prev && prev.totalPoints === row.totalPoints ? prev.rank : i + 1;
    });
    return rows;
  };

  return [...build('participant'), ...build('team')];
}
