import { describe, expect, it } from 'vitest';
import { canCreateMeetingOn, canEditAgendaItem, canManageMeeting, canRate, isAdmin, isOrganizer } from '../permissions';
import type { AgendaItem, Meeting } from '../types';

const admin = { id: 'a', role: 'admin', active: true } as const;
const org = { id: 'o', role: 'organizer', active: true } as const;
const user = { id: 'u', role: 'participant', active: true } as const;
const inactive = { id: 'x', role: 'admin', active: false } as const;
const meeting = { organizerId: 'u', date: '2026-10-23', status: 'completed' } as Meeting;

describe('permissions', () => {
  it('maps roles', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isOrganizer(org)).toBe(true);
    expect(isOrganizer(user)).toBe(false);
    expect(isAdmin(inactive)).toBe(false);
  });

  it('lets the meeting organizer manage their own meeting', () => {
    expect(canManageMeeting(user, meeting)).toBe(true);
    expect(canManageMeeting({ ...user, id: 'other' }, meeting)).toBe(false);
    expect(canManageMeeting(org, meeting)).toBe(true);
  });

  it('allows anyone to open a Friday, only organizers other days', () => {
    expect(canCreateMeetingOn(user, '2026-10-30')).toBe(true);
    expect(canCreateMeetingOn(user, '2026-10-28')).toBe(false);
    expect(canCreateMeetingOn(org, '2026-10-28')).toBe(true);
  });

  it('only allows rating meetings that have happened', () => {
    expect(canRate({ date: '2026-10-23', status: 'completed' }, '2026-10-26')).toBe(true);
    expect(canRate({ date: '2026-10-26', status: 'ongoing' }, '2026-10-26')).toBe(true);
    expect(canRate({ date: '2026-10-30', status: 'planned' }, '2026-10-26')).toBe(false);
    expect(canRate({ date: '2026-10-23', status: 'skipped' }, '2026-10-26')).toBe(false);
  });

  it('lets authors and assignees edit agenda items', () => {
    const item = { createdBy: 'u', assigneeId: null, meetingId: null } as AgendaItem;
    expect(canEditAgendaItem(user, item, null)).toBe(true);
    expect(canEditAgendaItem({ ...user, id: 'z' }, item, null)).toBe(false);
    expect(canEditAgendaItem({ ...user, id: 'z' }, { ...item, assigneeId: 'z' }, null)).toBe(true);
  });
});
