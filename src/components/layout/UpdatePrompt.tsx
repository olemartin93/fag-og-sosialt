import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { Button } from '../ui/primitives';

/** Registers the service worker (offline support) and offers updates. */
export function UpdatePrompt() {
  const { t } = useI18n();
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;
  return (
    <div className="no-print flex items-center justify-between gap-3 bg-info-soft px-4 py-2 text-sm text-info" role="status">
      <span className="flex items-center gap-2">
        <RefreshCw className="size-4" aria-hidden />
        {t('common.updateAvailable')}
      </span>
      <Button size="sm" variant="secondary" onClick={() => void update()}>
        {t('common.reload')}
      </Button>
    </div>
  );
}
