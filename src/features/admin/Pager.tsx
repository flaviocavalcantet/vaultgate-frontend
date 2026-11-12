import { useTranslation } from 'react-i18next'

import { secondaryButton } from '@/components/styles'

/** Previous and next under a list, with where in it the page is. Hidden for one page. */
export function Pager({
  label,
  page,
  size,
  total,
  onPage,
}: {
  label: string
  page: number
  size: number
  total: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  if (total <= size && page === 0) return null
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, total)
  return (
    <nav aria-label={label} className="mt-4 flex items-center justify-between gap-4 text-sm">
      <p>{t('admin.pager.showing', { from, to, total })}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          {t('admin.pager.previous')}
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={to >= total}
          onClick={() => onPage(page + 1)}
        >
          {t('admin.pager.next')}
        </button>
      </div>
    </nav>
  )
}
