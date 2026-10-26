import { beforeEach, describe, expect, it } from 'vitest';
import { DemoApi } from '../api/demoApi';
import { ApiError } from '../api/types';
import type { Participant } from '../types';

// Monday 26 October 2026, 10:00 in Oslo
const NOW = new Date('2026-10-26T09:00:00Z');

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

let api: DemoApi;
let accounts: Participant[];
const as = async (role: Participant['role']) => {
  const p = accounts.find((a) => a.role === role) as Participant;
  await api.signInAsDemo(p.id);
  return p;
};
const expectCode = async (promise: Promise<unknown>, code: ApiError['code']) => {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await promise.catch((e: ApiError) => expect(e.code).toBe(code));
};

beforeEach(async () => {
  api = new DemoApi({ storage: memoryStorage(), now: () => NOW });
  accounts = await api.demoAccounts();
});

describe('DemoApi (on-device backend)', () => {
  it('seeds clearly labelled demo data relative to today', async () => {
    const meetings = await api.listMeetings();
    expect(meetings).toHaveLength(8);
    expect(meetings.every((m) => m.isDemo && m.title.startsWith('Demo:'))).toBe(true);
    expect(meetings.map((m) => m.date)).toContain('2026-10-23');
    expect(meetings.map((m) => m.date)).toContain('2026-10-30');
  });

  it('requires sign-in for changes', async () => {
    await expectCode(api.ensureMeeting('2026-11-06'), 'forbidden');
  });

  it('allows one rating per user per meeting, and changing it', async () => {
    const me = await as('participant');
    const last = (await api.getMeetingByDate('2026-10-23'))!;
    const before = (await api.ratingStats()).find((s) => s.meetingId === last.id)!;
    const hadRating = (await api.getMeetingBundle(last.id)).myRating !== null;

    await api.rateMeeting(last.id, 10);
    await api.rateMeeting(last.id, 3);
    const bundle = await api.getMeetingBundle(last.id);
    expect(bundle.myRating).toBe(3);
    const after = (await api.ratingStats()).find((s) => s.meetingId === last.id)!;
    expect(after.count).toBe(before.count + (hadRating ? 0 : 1));
    expect((await api.ratingsByParticipant(me.id)).filter((r) => r.meetingId === last.id)).toHaveLength(1);
    expect(after.distribution.reduce((a, b) => a + b, 0)).toBe(after.count);
  });

  it('recalculates the average when a rating changes', async () => {
    await as('participant');
    const m = (await api.getMeetingByDate('2026-10-23'))!;
    await api.rateMeeting(m.id, 1);
    const low = (await api.ratingStats()).find((s) => s.meetingId === m.id)!.average!;
    await api.rateMeeting(m.id, 10);
    const high = (await api.ratingStats()).find((s) => s.meetingId === m.id)!.average!;
    expect(high).toBeGreaterThan(low);
  });

  it('rejects ratings for future meetings and invalid scores', async () => {
    await as('participant');
    const future = (await api.getMeetingByDate('2026-10-30'))!;
    await expectCode(api.rateMeeting(future.id, 8), 'forbidden');
    const past = (await api.getMeetingByDate('2026-10-23'))!;
    await expectCode(api.rateMeeting(past.id, 11), 'validation');
  });

  it('never creates two meetings on the same date', async () => {
    await as('participant');
    const a = await api.ensureMeeting('2026-11-13');
    const b = await api.ensureMeeting('2026-11-13');
    expect(a).toBe(b);
    expect((await api.listMeetings()).filter((m) => m.date === '2026-11-13')).toHaveLength(1);
    await expectCode(api.ensureMeeting('2026-11-11'), 'forbidden'); // Wednesday
    await as('organizer');
    await expectCode(
      api.createMeeting({ date: '2026-11-13', title: 'Dobbel', status: 'planned' }),
      'duplicate',
    );
  });

  it('enforces score permissions and keeps a history', async () => {
    const user = await as('participant');
    const m = (await api.getMeetingByDate('2026-10-23'))!;
    await expectCode(api.addScore({ meetingId: m.id, activity: 'Juks', participantId: user.id, points: 999 }), 'forbidden');

    await as('organizer');
    await api.addScore({ meetingId: m.id, activity: 'Quiz', participantId: user.id, points: 100 });
    const entry = (await api.getMeetingBundle(m.id)).scores.find((s) => s.points === 100)!;
    await api.updateScore(entry.id, { meetingId: m.id, activity: 'Quiz', participantId: user.id, points: 50 });
    const board = await api.leaderboard({ meetingId: m.id });
    expect(board[0]).toMatchObject({ subjectId: user.id, rank: 1 });
    const history = (await api.getMeetingBundle(m.id)).history.filter((h) => h.scoreId === entry.id);
    expect(history.map((h) => [h.action, h.oldPoints, h.newPoints])).toEqual(
      expect.arrayContaining([
        ['update', 100, 50],
        ['insert', null, 100],
      ]),
    );
    expect(history).toHaveLength(2);
  });

  it('lets anyone suggest and vote, and organizers reorder', async () => {
    const user = await as('participant');
    await api.addAgendaItem({ kind: 'topic', title: 'Mitt forslag', highPriority: false });
    const item = (await api.listAgendaItems()).find((i) => i.title === 'Mitt forslag')!;
    expect(item.meetingId).toBeNull();
    await api.toggleVote(item.id, true);
    await api.toggleVote(item.id, true);
    expect((await api.listAgendaItems()).find((i) => i.id === item.id)!.votes).toEqual([user.id]);

    const next = (await api.getMeetingByDate('2026-10-30'))!;
    const ids = (await api.getMeetingBundle(next.id)).agenda.map((a) => a.id);
    await expectCode(api.reorderAgenda(next.id, [...ids].reverse()), 'forbidden');
    await as('organizer');
    await api.reorderAgenda(next.id, [...ids].reverse());
    expect((await api.getMeetingBundle(next.id)).agenda.map((a) => a.id)).toEqual([...ids].reverse());
  });

  it('removes all demo data but keeps the signed-in admin', async () => {
    const admin = await as('admin');
    await api.ensureMeeting('2026-11-20');
    await api.clearDemoData();
    const meetings = await api.listMeetings();
    expect(meetings.map((m) => m.date)).toEqual(['2026-11-20']);
    expect((await api.listParticipants()).map((p) => p.id)).toEqual([admin.id]);
    expect(await api.listScores()).toEqual([]);
    expect((await api.ratingStats()).every((s) => s.count === 0)).toBe(true);
  });

  it('only admins clear demo data or change settings', async () => {
    await as('organizer');
    await expectCode(api.clearDemoData(), 'forbidden');
    const s = await api.getSettings();
    await expectCode(api.updateSettings({ ...s, ratingsPublic: true }), 'forbidden');
  });

  it('keeps individual ratings private unless enabled', async () => {
    await as('admin');
    const other = accounts.find((a) => a.role === 'participant')!;
    expect(await api.ratingsByParticipant(other.id)).toEqual([]);
    const s = await api.getSettings();
    await api.updateSettings({ ...s, ratingsPublic: true });
    expect((await api.ratingsByParticipant(other.id)).length).toBeGreaterThan(0);
  });
});
