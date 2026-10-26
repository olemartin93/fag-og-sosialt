import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DataApi } from './api/types';
import type { Participant, SessionUser } from './types';

interface SessionValue {
  api: DataApi;
  session: SessionUser | null;
  me: Participant | null;
  loading: boolean;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ api, children }: { api: DataApi; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSession(await api.getSession());
    } catch {
      // offline: keep whatever we had
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    api
      .getSession()
      .then(setSession)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return api.onAuthChange((event) => {
      if (event === 'password-recovery') setPasswordRecovery(true);
      if (event === 'signed-out') queryClient.clear();
      void refresh();
    });
  }, [api, refresh, queryClient]);

  // keep "me" fresh when profiles change (role changes etc.)
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = api.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries();
        void refresh();
      }, 250);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [api, session, queryClient, refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      api,
      session,
      me: session?.participant ?? null,
      loading,
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      refresh,
    }),
    [api, session, loading, passwordRecovery, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

export const useApi = () => useSession().api;
export const useMe = () => useSession().me;
