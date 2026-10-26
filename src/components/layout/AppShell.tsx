import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Home,
  ListChecks,
  Menu,
  Settings,
  Trophy,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { Avatar, Badge, cx } from '../ui/primitives';
import { AppIcon } from './AppIcon';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavItem {
  to: string;
  label: TranslationKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'nav.home', icon: Home },
  { to: '/moter', label: 'nav.meetings', icon: ClipboardList },
  { to: '/kalender', label: 'nav.calendar', icon: CalendarDays },
  { to: '/agenda', label: 'nav.agenda', icon: ListChecks },
  { to: '/poengtavle', label: 'nav.scoreboard', icon: Trophy },
  { to: '/statistikk', label: 'nav.stats', icon: BarChart3 },
  { to: '/deltakere', label: 'nav.participants', icon: Users },
  { to: '/innstillinger', label: 'nav.settings', icon: Settings },
];
const MOBILE_PRIMARY = ['/', '/moter', '/kalender', '/poengtavle'];

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function AppShell({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  const { t } = useI18n();
  const { me, api } = useSession();
  const online = useOnline();
  const [moreOpen, setMoreOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-ink',
    );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('nav.skip')}
      </a>

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-3 px-2">
          <AppIcon className="size-10" />
          <div>
            <p className="font-semibold tracking-tight">{t('app.name')}</p>
            <p className="text-xs text-muted">{t('app.tagline')}</p>
          </div>
        </Link>
        <nav aria-label={t('nav.main')} className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              <item.icon className="size-5" aria-hidden />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <LanguageSwitcher />
          {me && (
            <Link to={`/deltakere/${me.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <Avatar participant={me} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{me.displayName}</p>
                <p className="text-xs text-muted">{t(`role.${me.role}`)}</p>
              </div>
            </Link>
          )}
          {api.mode === 'demo' && <Badge tone="accent">{t('auth.demoTitle')}</Badge>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile header */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <AppIcon className="size-8" />
            <span className="font-semibold tracking-tight">{t('app.name')}</span>
            {api.mode === 'demo' && <Badge tone="accent">{t('common.demo')}</Badge>}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            {me && (
              <Link to={`/deltakere/${me.id}`} aria-label={me.displayName}>
                <Avatar participant={me} size="sm" />
              </Link>
            )}
          </div>
        </header>

        {!online && (
          <div className="no-print flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning" role="status">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            {t('common.offline')}
          </div>
        )}
        {banner}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label={t('nav.main')}
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.to)).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                    isActive ? 'text-primary' : 'text-muted',
                  )
                }
              >
                <item.icon className="size-5" aria-hidden />
                {t(item.label)}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted"
            >
              <Menu className="size-5" aria-hidden />
              {t('nav.more')}
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('nav.more')}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-semibold">{t('nav.more')}</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
                aria-label={t('common.close')}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="grid grid-cols-1 gap-1">
              {NAV_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.to)).map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={() => setMoreOpen(false)}>
                  <item.icon className="size-5" aria-hidden />
                  {t(item.label)}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
