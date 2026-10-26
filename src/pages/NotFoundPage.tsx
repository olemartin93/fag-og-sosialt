import { Compass } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { EmptyState, TextLink } from '../components/ui/primitives';

export default function NotFoundPage() {
  const { t } = useI18n();
  return <EmptyState icon={Compass} title={t('error.pageNotFound')} action={<TextLink to="/">{t('nav.home')}</TextLink>} />;
}
