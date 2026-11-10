import { useTranslation } from 'react-i18next'

import { PageHeading } from '@/components/PageHeading'

export function HomePage() {
  const { t } = useTranslation()
  return <PageHeading title={t('home.title')}>{t('home.body')}</PageHeading>
}
