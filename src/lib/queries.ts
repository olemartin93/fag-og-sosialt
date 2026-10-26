import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from './api/types';
import { useI18n, isTranslationKey, type TFunction, type TranslationKey } from './i18n';
import { useApi } from './session';
import { useToast } from '../components/ui/Toast';
import type { IsoDate, LeaderboardFilter } from './types';

export const qk = {
  settings: ['settings'] as const,
  participants: ['participants'] as const,
  teams: ['teams'] as const,
  meetings: ['meetings'] as const,
  meetingByDate: (date: IsoDate) => ['meeting-by-date', date] as const,
  bundle: (id: string) => ['bundle', id] as const,
  agenda: ['agenda'] as const,
  ratingStats: ['rating-stats'] as const,
  ratingsBy: (id: string) => ['ratings-by', id] as const,
  leaderboard: (f: LeaderboardFilter) => ['leaderboard', f] as const,
  scores: ['scores'] as const,
  scoreHistory: ['score-history'] as const,
  participantStats: ['participant-stats'] as const,
  feed: ['feed'] as const,
};

export const useSettings = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.settings, queryFn: () => api.getSettings() });
};
export const useParticipants = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.participants, queryFn: () => api.listParticipants() });
};
export const useTeams = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.teams, queryFn: () => api.listTeams() });
};
export const useMeetings = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.meetings, queryFn: () => api.listMeetings() });
};
export const useMeetingByDate = (date: IsoDate, enabled = true) => {
  const api = useApi();
  return useQuery({ queryKey: qk.meetingByDate(date), queryFn: () => api.getMeetingByDate(date), enabled });
};
export const useMeetingBundle = (id: string | undefined) => {
  const api = useApi();
  return useQuery({
    queryKey: qk.bundle(id ?? ''),
    queryFn: () => api.getMeetingBundle(id as string),
    enabled: !!id,
  });
};
export const useAgendaItems = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.agenda, queryFn: () => api.listAgendaItems() });
};
export const useRatingStats = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.ratingStats, queryFn: () => api.ratingStats() });
};
export const useRatingsBy = (participantId: string) => {
  const api = useApi();
  return useQuery({ queryKey: qk.ratingsBy(participantId), queryFn: () => api.ratingsByParticipant(participantId) });
};
export const useLeaderboard = (filter: LeaderboardFilter) => {
  const api = useApi();
  return useQuery({ queryKey: qk.leaderboard(filter), queryFn: () => api.leaderboard(filter) });
};
export const useScores = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.scores, queryFn: () => api.listScores() });
};
export const useScoreHistory = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.scoreHistory, queryFn: () => api.scoreHistory(40) });
};
export const useParticipantStats = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.participantStats, queryFn: () => api.participantStats() });
};
export const useFeed = () => {
  const api = useApi();
  return useQuery({ queryKey: qk.feed, queryFn: () => api.recentActivity(12) });
};

export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message === 'lastAdmin') return t('error.lastAdmin');
    if (error.code === 'validation' && isTranslationKey(`field.${error.message}`)) {
      return t(`field.${error.message}` as TranslationKey);
    }
    return t(`error.${error.code}` as TranslationKey);
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return t('error.offline');
  return t('error.unknown');
}

/**
 * Mutation that refreshes all shared data afterwards and reports
 * success/failure with a toast. Changes are immediately visible to
 * everyone else via realtime.
 */
export function useAction<TArgs, TResult = void>(
  fn: (args: TArgs) => Promise<TResult>,
  options: { success?: TranslationKey; onSuccess?: (result: TResult) => void } = {},
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  return useMutation({
    mutationFn: fn,
    networkMode: 'always',
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      if (options.success) toast.show(t(options.success), 'success');
      options.onSuccess?.(result);
    },
    onError: (error) => toast.show(errorMessage(t, error), 'error'),
  });
}
