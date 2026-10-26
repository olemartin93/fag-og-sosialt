import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { App } from '../App';
import { DemoApi } from '../lib/api/demoApi';

const NOW = new Date('2026-10-26T09:00:00Z');

function setup(hash = '#/') {
  window.location.hash = hash;
  const api = new DemoApi({ storage: window.localStorage, now: () => NOW });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<App api={api} queryClient={queryClient} />);
  return { api, user };
}

async function signInAs(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(await screen.findByRole('button', { name }));
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Fag & Sosialt app (demo backend)', () => {
  it('shows the demo login and opens the dashboard', async () => {
    const { user } = setup();
    expect(await screen.findByText('Demomodus')).toBeInTheDocument();
    await signInAs(user, /Kari Nordmann/);
    expect(await screen.findByRole('heading', { name: 'Hei, Kari!' })).toBeInTheDocument();
    expect(screen.getByText('Neste fredag')).toBeInTheDocument();
    expect(await screen.findByText('Fredag 30. oktober 2026')).toBeInTheDocument();
    expect(screen.getByText('Gjennomsnittlig møtekarakter')).toBeInTheDocument();
    expect(screen.getByText('Siste aktivitet')).toBeInTheDocument();
    // Norwegian navigation
    const nav = screen.getAllByRole('navigation', { name: 'Hovedmeny' })[0] as HTMLElement;
    for (const label of ['Hjem', 'Møter', 'Kalender', 'Agenda', 'Poengtavle', 'Statistikk', 'Deltakere', 'Innstillinger']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('rates a meeting and updates the average immediately', async () => {
    const { user } = setup('#/moter/2026-10-23?fane=vurdering');
    await signInAs(user, /Ingrid Berg/);
    const picker = await screen.findByRole('radiogroup', { name: /Gi møtet en karakter/ });
    const gaugeBefore = screen.getByTestId('gauge-value').textContent;

    await user.click(within(picker).getByRole('radio', { name: 'Karakter 1' }));
    expect(await screen.findByText('Takk for vurderingen!')).toBeInTheDocument();
    await waitFor(() => expect(within(picker).getByRole('radio', { name: 'Karakter 1' })).toHaveAttribute('aria-checked', 'true'));
    await waitFor(() => expect(screen.getByTestId('gauge-value').textContent).not.toBe(gaugeBefore));
    expect(screen.getByText(/Du har gitt 1/)).toBeInTheDocument();
  });

  it('does not offer rating for future meetings', async () => {
    const { user } = setup('#/moter/2026-10-30?fane=vurdering');
    await signInAs(user, /Ingrid Berg/);
    expect(await screen.findByText('Møtet kan vurderes når det har funnet sted.')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('adds an agenda item to a meeting', async () => {
    const { user } = setup('#/moter/2026-10-30?fane=agenda');
    await signInAs(user, /Sofie Lie/);
    await user.click(await screen.findByRole('button', { name: 'Nytt punkt' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Tittel'), 'Lyntale om tilgjengelighet');
    await user.click(within(dialog).getByRole('button', { name: 'Lagre' }));
    expect(await screen.findByText('Lyntale om tilgjengelighet')).toBeInTheDocument();
  });

  it('validates forms before saving', async () => {
    const { user } = setup('#/moter/2026-10-30?fane=agenda');
    await signInAs(user, /Sofie Lie/);
    await user.click(await screen.findByRole('button', { name: 'Nytt punkt' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Lagre' }));
    expect(await within(dialog).findByText('Feltet må fylles ut')).toBeInTheDocument();
  });

  it('offers to create a Friday meeting that does not exist yet', async () => {
    const { user } = setup('#/moter/2026-11-13');
    await signInAs(user, /Lars Johansen/);
    await user.click(await screen.findByRole('button', { name: 'Opprett møte' }));
    expect(await screen.findByRole('heading', { name: 'Fag og sosialt', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Fredag 13. november 2026')).toBeInTheDocument();
  });

  it('hides score entry from regular participants', async () => {
    const { user } = setup('#/moter/2026-10-23?fane=poeng');
    await signInAs(user, /Ingrid Berg/);
    expect(await screen.findByText('Resultater dette møtet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrer poeng' })).not.toBeInTheDocument();
  });

  it('switches language to English', async () => {
    const { user } = setup();
    await signInAs(user, /Kari Nordmann/);
    await screen.findByRole('heading', { name: 'Hei, Kari!' });
    await user.click(screen.getAllByRole('button', { name: 'English' })[0] as HTMLElement);
    expect(await screen.findByRole('heading', { name: 'Hi, Kari!' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});
