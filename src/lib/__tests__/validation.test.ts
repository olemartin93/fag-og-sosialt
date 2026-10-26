import { describe, expect, it } from 'vitest';
import { agendaItemSchema, fieldErrors, meetingSchema, scoreSchema, signUpSchema } from '../validation';

describe('validation', () => {
  it('requires a title and valid date for meetings', () => {
    const r = meetingSchema.safeParse({ date: '2026-02-30', title: '  ', status: 'planned' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toMatchObject({ date: 'invalidDate', title: 'required' });
  });

  it('only accepts http(s) links on agenda items', () => {
    const base = { kind: 'topic', title: 'Tema', highPriority: false };
    expect(agendaItemSchema.safeParse({ ...base, link: 'javascript:alert(1)' }).success).toBe(false);
    expect(agendaItemSchema.safeParse({ ...base, link: 'https://www.uutilsynet.no/' }).success).toBe(true);
    expect(agendaItemSchema.parse({ ...base, link: '', meetingId: '' })).toMatchObject({ link: null, meetingId: null });
  });

  it('requires exactly one of participant or team for scores', () => {
    const base = { meetingId: 'm', activity: 'Quiz', points: 5 };
    expect(scoreSchema.safeParse({ ...base, participantId: 'p' }).success).toBe(true);
    expect(scoreSchema.safeParse({ ...base, participantId: 'p', teamId: 't' }).success).toBe(false);
    expect(scoreSchema.safeParse({ ...base }).success).toBe(false);
    expect(scoreSchema.safeParse({ ...base, participantId: 'p', points: 1.5 }).success).toBe(false);
  });

  it('checks sign-up input', () => {
    const r = signUpSchema.safeParse({ displayName: 'Kari', email: 'kari@', password: 'short', inviteCode: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(['email', 'inviteCode', 'password']);
  });
});
