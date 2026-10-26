import { z } from 'zod';
import { isIsoDate } from './dates';

/** Input validation shared by forms and both backends. Limits match the DB. */
const trimmed = (min: number, max: number) => z.string().trim().min(min, 'required').max(max, 'tooLong');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'tooLong')
    .nullish()
    .transform((v) => (v ? v : null));

const isoDate = z.string().refine(isIsoDate, 'invalidDate');
const uuidish = z.string().min(1);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'invalidColor');
const httpUrl = z
  .string()
  .trim()
  .max(500, 'tooLong')
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\/[^\s]+$/i.test(v), 'invalidUrl');

export const meetingSchema = z.object({
  date: isoDate,
  title: trimmed(1, 120),
  status: z.enum(['planned', 'ongoing', 'completed', 'skipped']),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'invalidTime')
    .nullish()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  location: optionalText(120),
  organizerId: uuidish.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  summary: optionalText(20000),
  finalNotes: optionalText(20000),
});
export type MeetingInput = z.input<typeof meetingSchema>;
export type MeetingValues = z.output<typeof meetingSchema>;

export const agendaItemSchema = z.object({
  meetingId: uuidish.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  kind: z.enum(['topic', 'activity']),
  title: trimmed(1, 200),
  description: optionalText(4000),
  link: httpUrl,
  highPriority: z.boolean(),
  assigneeId: uuidish.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
});
export type AgendaItemInput = z.input<typeof agendaItemSchema>;
export type AgendaItemValues = z.output<typeof agendaItemSchema>;

export const noteSchema = z.object({
  kind: z.enum(['discussion', 'decision', 'takeaway', 'note']),
  content: trimmed(1, 4000),
});
export type NoteInput = z.input<typeof noteSchema>;

export const taskSchema = z.object({
  title: trimmed(1, 300),
  assigneeId: uuidish.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  dueDate: isoDate.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  done: z.boolean(),
});
export type TaskInput = z.input<typeof taskSchema>;

export const activitySchema = z.object({
  name: trimmed(1, 120),
  description: optionalText(2000),
  result: optionalText(2000),
});
export type ActivityInput = z.input<typeof activitySchema>;

export const scoreSchema = z
  .object({
    meetingId: uuidish,
    activity: trimmed(1, 120),
    participantId: uuidish.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
    teamId: uuidish.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
    points: z.number({ error: 'invalidNumber' }).int('invalidNumber').min(-10000, 'outOfRange').max(10000, 'outOfRange'),
    comment: optionalText(500),
  })
  .refine((v) => (v.participantId === null) !== (v.teamId === null), { message: 'pickSubject', path: ['participantId'] });
export type ScoreInput = z.input<typeof scoreSchema>;
export type ScoreValues = z.output<typeof scoreSchema>;

export const ratingSchema = z.number().int().min(1).max(10);

export const participantSchema = z.object({
  displayName: trimmed(1, 60),
  avatarColor: hexColor,
  avatarUrl: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https:\/\/[^\s]+$/i.test(v), 'invalidUrl'),
  role: z.enum(['admin', 'organizer', 'participant']),
  teamId: uuidish.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  active: z.boolean(),
});
export type ParticipantInput = z.input<typeof participantSchema>;
export type ParticipantValues = z.output<typeof participantSchema>;

export const teamSchema = z.object({ name: trimmed(1, 60), color: hexColor });
export type TeamInput = z.input<typeof teamSchema>;

export const settingsSchema = z.object({
  groupName: trimmed(1, 60),
  inviteCode: z.string().trim().min(6, 'tooShort').max(64, 'tooLong'),
  ratingsPublic: z.boolean(),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'invalidTime'),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const signUpSchema = z.object({
  displayName: trimmed(1, 60),
  email: z.email('invalidEmail'),
  password: z.string().min(8, 'passwordTooShort').max(128, 'tooLong'),
  inviteCode: z.string().trim().min(1, 'required'),
});

export const signInSchema = z.object({
  email: z.email('invalidEmail'),
  password: z.string().min(1, 'required'),
});

export const supabaseConfigSchema = z.object({
  url: z
    .string()
    .trim()
    .url('invalidUrl')
    .refine((v) => v.startsWith('https://'), 'invalidUrl'),
  anonKey: z.string().trim().min(20, 'required'),
});

/** First error message per field, for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
