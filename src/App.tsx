import { lazy, Suspense, useMemo } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { DataApi } from './lib/api/types';
import { I18nProvider } from './lib/i18n';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/forms';
import { Spinner } from './components/ui/primitives';
import { AppShell } from './components/layout/AppShell';
import { UpdatePrompt } from './components/layout/UpdatePrompt';
import { LoginPage, NoProfilePage, SetPasswordPage } from './pages/AuthPages';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'));
const MeetingPage = lazy(() => import('./pages/MeetingPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const AgendaPage = lazy(() => import('./pages/AgendaPage'));
const ScoreboardPage = lazy(() => import('./pages/ScoreboardPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const ParticipantsPage = lazy(() => import('./pages/ParticipantsPage'));
const ParticipantPage = lazy(() => import('./pages/ParticipantPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function Gate() {
  const { session, me, loading, passwordRecovery } = useSession();
  if (loading) return <Spinner />;
  if (passwordRecovery) return <SetPasswordPage />;
  if (!session) return <LoginPage />;
  if (!me) return <NoProfilePage />;
  return (
    <AppShell banner={<UpdatePrompt />}>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/moter" element={<MeetingsPage />} />
          <Route path="/moter/:date" element={<MeetingPage />} />
          <Route path="/kalender" element={<CalendarPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/poengtavle" element={<ScoreboardPage />} />
          <Route path="/statistikk" element={<StatsPage />} />
          <Route path="/deltakere" element={<ParticipantsPage />} />
          <Route path="/deltakere/:id" element={<ParticipantPage />} />
          <Route path="/innstillinger" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export function App({ api, queryClient: injected }: { api: DataApi; queryClient?: QueryClient }) {
  const queryClient = useMemo(
    () =>
      injected ??
      new QueryClient({
        defaultOptions: {
          queries: {
            // show cached data instantly and offline; refresh in the background
            networkMode: 'offlineFirst',
            staleTime: 30_000,
            gcTime: 1000 * 60 * 60 * 24 * 7,
            retry: (count, error) => count < 2 && !(error instanceof Error && error.name === 'ApiError'),
            refetchOnWindowFocus: true,
          },
        },
      }),
    [injected],
  );
  const persister = useMemo(
    () =>
      createSyncStoragePersister({
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        key: `fos-cache-${api.mode}`,
        throttleTime: 1000,
      }),
    [api.mode],
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: 'v1' }}
    >
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <SessionProvider api={api}>
              <HashRouter>
                <Gate />
              </HashRouter>
            </SessionProvider>
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </PersistQueryClientProvider>
  );
}
