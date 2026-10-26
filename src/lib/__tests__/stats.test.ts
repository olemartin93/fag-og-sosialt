import { describe, expect, it } from 'vitest';
import { computeLeaderboard, computeRatingStats, formatScore, previousRated, summarizeRatings } from '../stats';
import type { Meeting, MeetingRatingStats, Participant, Rating, ScoreEntry, Team } from '../types';

const meeting = (id: string, date: string): Meeting => ({
  id,
  date,
  title: `Møte ${date}`,
  status: 'completed',
  startTime: '14:00',
  location: null,
  organizerId: null,
  summary: null,
  finalNotes: null,
  isDemo: false,
  createdAt: '',
  updatedAt: '',
});
const rating = (meetingId: string, participantId: string, score: number): Rating => ({
  id: `${meetingId}-${participantId}`,
  meetingId,
  participantId,
  score,
  updatedAt: '',
});

describe('rating statistics', () => {
  it('computes average, count, min/max and distribution from individual ratings', () => {
    const m = meeting('m1', '2026-10-23');
    const scores = [10, 10, 10, 10, 9, 9, 9, 8, 8, 7, 7, 6];
    const stats = computeRatingStats(
      m,
      scores.map((s, i) => rating('m1', `p${i}`, s)),
    );
    expect(stats.count).toBe(12);
    expect(stats.average).toBeCloseTo(8.58, 2);
    expect(formatScore(stats.average)).toBe('8,6');
    expect(stats.min).toBe(6);
    expect(stats.max).toBe(10);
    expect(stats.distribution).toEqual([0, 0, 0, 0, 0, 1, 2, 2, 3, 4]);
  });

  it('keeps meetings independent of each other', () => {
    const ratings = [rating('a', 'p1', 10), rating('b', 'p1', 2)];
    expect(computeRatingStats(meeting('a', '2026-10-16'), ratings).average).toBe(10);
    expect(computeRatingStats(meeting('b', '2026-10-23'), ratings).average).toBe(2);
  });

  it('reports "no ratings" as null, not zero', () => {
    const stats = computeRatingStats(meeting('x', '2026-10-30'), []);
    expect(stats.average).toBeNull();
    expect(formatScore(stats.average)).toBe('–');
  });

  it('summarizes across meetings', () => {
    const s = (id: string, date: string, average: number | null, count: number): MeetingRatingStats => ({
      meetingId: id,
      date,
      title: id,
      average,
      count,
      min: null,
      max: null,
      distribution: [],
    });
    const all = [
      s('a', '2026-09-04', 6, 3),
      s('b', '2026-09-11', 9, 4),
      s('c', '2026-09-18', 8, 2),
      s('d', '2026-09-25', 7, 5),
      s('e', '2026-10-02', 8, 1),
      s('f', '2026-10-09', 10, 2),
      s('g', '2026-10-16', null, 0),
    ];
    const o = summarizeRatings(all);
    expect(o.ratedMeetings).toBe(6);
    expect(o.totalVotes).toBe(17);
    expect(o.overallAverage).toBe(8);
    expect(o.lastFiveAverage).toBe(8.4);
    expect(o.best?.meetingId).toBe('f');
    expect(o.worst?.meetingId).toBe('a');
    expect(previousRated(all, '2026-10-16')?.meetingId).toBe('f');
    expect(formatScore(8.4, 'en')).toBe('8.4');
  });
});

describe('leaderboard', () => {
  const person = (id: string, name: string): Participant => ({
    id,
    userId: null,
    displayName: name,
    avatarUrl: null,
    avatarColor: '#2f6f5e',
    role: 'participant',
    teamId: null,
    active: true,
    isDemo: false,
    createdAt: '',
  });
  const team: Team = { id: 't1', name: 'Lag Fjord', color: '#2f6f5e', isDemo: false };
  const entry = (id: string, meetingId: string, points: number, p: string | null, activity = 'Quiz', t: string | null = null): ScoreEntry => ({
    id,
    meetingId,
    activity,
    participantId: p,
    teamId: t,
    points,
    comment: null,
    createdBy: null,
    isDemo: false,
    createdAt: '',
  });
  const people = [person('a', 'Anne'), person('b', 'Bjørn'), person('c', 'Cecilie')];
  const meetings = [meeting('m1', '2026-09-25'), meeting('m2', '2026-10-23')];
  const scores = [
    entry('1', 'm1', 10, 'a'),
    entry('2', 'm2', 5, 'a', 'Bordtennis'),
    entry('3', 'm2', 15, 'b'),
    entry('4', 'm2', 3, 'c'),
    entry('5', 'm1', 20, null, 'Lag', 't1'),
  ];

  it('totals and ranks with ties sharing a rank', () => {
    const rows = computeLeaderboard(scores, people, [team], meetings);
    const individual = rows.filter((r) => r.subjectType === 'participant');
    expect(individual.map((r) => [r.name, r.totalPoints, r.rank])).toEqual([
      ['Anne', 15, 1],
      ['Bjørn', 15, 1],
      ['Cecilie', 3, 3],
    ]);
    expect(individual[0]?.meetings).toBe(2);
    expect(rows.find((r) => r.subjectType === 'team')?.totalPoints).toBe(20);
  });

  it('filters by period, meeting and activity', () => {
    expect(computeLeaderboard(scores, people, [team], meetings, { from: '2026-10-01', to: '2026-10-31' }).find((r) => r.subjectId === 'a')?.totalPoints).toBe(5);
    expect(computeLeaderboard(scores, people, [team], meetings, { meetingId: 'm1' }).map((r) => r.subjectId)).toEqual(['a', 't1']);
    expect(computeLeaderboard(scores, people, [team], meetings, { activity: 'Bordtennis' }).map((r) => r.subjectId)).toEqual(['a']);
  });
});
