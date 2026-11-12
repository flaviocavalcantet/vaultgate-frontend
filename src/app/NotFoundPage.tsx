import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { PageHeading } from '@/components/PageHeading'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeading title={t('notFound.title')}>{t('notFound.body')}</PageHeading>
      <Link to="/" className="font-medium text-accent underline">
        {t('notFound.back')}
      </Link>
    </>
  )
}
