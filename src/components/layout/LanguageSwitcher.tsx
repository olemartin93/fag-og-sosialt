import { useI18n } from '../../lib/i18n';
import type { Locale } from '../../lib/dates';
import { cx } from '../ui/primitives';

const OPTIONS: { value: Locale; label: string; long: string }[] = [
  { value: 'nb', label: 'NO', long: 'Norsk' },
  { value: 'en', label: 'EN', long: 'English' },
];

/** Segmented NO / EN switch. */
export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t('common.language')} className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          aria-pressed={locale === o.value}
          aria-label={o.long}
          onClick={() => setLocale(o.value)}
          className={cx(
            'rounded-[10px] px-2.5 py-1 text-xs font-semibold transition-colors',
            locale === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {compact ? o.label : o.long}
        </button>
      ))}
    </div>
  );
}
