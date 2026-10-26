/**
 * Permission rules for the UI and the demo backend.
 * They mirror the Row Level Security policies in
 * supabase/migrations/*_init.sql, which are the real enforcement.
 */
import { isFriday } from './dates';
import type { AgendaItem, Activity, IsoDate, Meeting, MeetingNote, Participant, Task } from './types';

type Me = Pick<Participant, 'id' | 'role' | 'active'> | null | undefined;

export const isMember = (me: Me): me is NonNullable<Me> => !!me && me.active;
export const isAdmin = (me: Me) => isMember(me) && me.role === 'admin';
export const isOrganizer = (me: Me) => isMember(me) && (me.role === 'admin' || me.role === 'organizer');

export function canManageMeeting(me: Me, meeting: Pick<Meeting, 'organizerId'> | null | undefined): boolean {
  if (!isMember(me)) return false;
  return isOrganizer(me) || (!!meeting && meeting.organizerId === me.id);
}

export function canCreateMeetingOn(me: Me, date: IsoDate): boolean {
  return isMember(me) && (isFriday(date) || isOrganizer(me));
}

export function canEditAgendaItem(me: Me, item: AgendaItem, meeting: Meeting | null | undefined): boolean {
  if (!isMember(me)) return false;
  return (
    isOrganizer(me) ||
    item.createdBy === me.id ||
    item.assigneeId === me.id ||
    (!!item.meetingId && canManageMeeting(me, meeting))
  );
}

export function canDeleteAgendaItem(me: Me, item: AgendaItem, meeting: Meeting | null | undefined): boolean {
  if (!isMember(me)) return false;
  return isOrganizer(me) || item.createdBy === me.id || (!!item.meetingId && canManageMeeting(me, meeting));
}

export function canEditNote(me: Me, note: MeetingNote, meeting: Meeting | null | undefined): boolean {
  return isMember(me) && (note.authorId === me.id || canManageMeeting(me, meeting));
}

export function canEditTask(me: Me, task: Task, meeting: Meeting | null | undefined): boolean {
  return isMember(me) && (task.createdBy === me.id || task.assigneeId === me.id || canManageMeeting(me, meeting));
}

export function canDeleteTask(me: Me, task: Task, meeting: Meeting | null | undefined): boolean {
  return isMember(me) && (task.createdBy === me.id || canManageMeeting(me, meeting));
}

export function canEditActivity(me: Me, activity: Activity, meeting: Meeting | null | undefined): boolean {
  return isMember(me) && (activity.createdBy === me.id || canManageMeeting(me, meeting));
}

export const canManageScores = canManageMeeting;

/** Ratings are allowed for meetings that have taken place and were not skipped. */
export function canRate(meeting: Pick<Meeting, 'date' | 'status'>, today: IsoDate): boolean {
  return meeting.status !== 'skipped' && meeting.date <= today;
}

export function canToggleAttendance(me: Me, participantId: string, meeting: Meeting): boolean {
  return isMember(me) && (participantId === me.id || canManageMeeting(me, meeting));
}
