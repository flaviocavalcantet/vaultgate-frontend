import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { folderPath } from './paths'
import type { FolderDetail } from './types'

/** Where the page is: My files, then each folder down to this one (the current one not a link). */
export function Breadcrumbs({ folder }: { folder: FolderDetail | undefined }) {
  const { t } = useTranslation()
  const trail = folder?.path ?? []
  return (
    <nav aria-label={t('folders.path')} className="mb-2 text-sm">
      <ol className="flex flex-wrap items-center gap-x-1 text-graphite">
        <li>
          {trail.length === 0 ? (
            <span aria-current="page">{t('folders.top')}</span>
          ) : (
            <Link to="/files" className="underline underline-offset-2 hover:text-ink">
              {t('folders.top')}
            </Link>
          )}
        </li>
        {trail.map((step, index) => (
          <li key={step.id} className="flex items-center gap-x-1">
            <span aria-hidden="true">/</span>
            {index === trail.length - 1 ? (
              <span aria-current="page" className="font-medium text-ink">
                {step.name}
              </span>
            ) : (
              <Link
                to={folderPath(step.id)}
                className="underline underline-offset-2 hover:text-ink"
              >
                {step.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
