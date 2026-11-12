import { useTranslation } from 'react-i18next'

import type { Upload } from './useUploads'

const button = 'rounded border border-control px-2 py-1 text-sm font-medium hover:bg-accent-soft'

/** The uploads started in this page, with their progress; announced as they change. */
export function UploadList({
  uploads,
  onCancel,
  onDismiss,
}: {
  uploads: Upload[]
  onCancel: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const { t } = useTranslation()
  if (uploads.length === 0) return null
  return (
    <section aria-label={t('upload.region')} className="mb-6">
      <ul className="space-y-2">
        {uploads.map((upload) => {
          const { state } = upload
          const percent =
            state.phase === 'sending' && state.total > 0
              ? Math.floor((state.sent / state.total) * 100)
              : 0
          const running = state.phase === 'registering' || state.phase === 'sending'
          return (
            <li key={upload.id} className="flex items-center gap-4 rounded border border-rule p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{upload.name}</p>
                {state.phase === 'sending' ? (
                  <progress
                    className="mt-1 w-full"
                    max={100}
                    value={percent}
                    aria-label={t('upload.progress', { name: upload.name })}
                  />
                ) : null}
                <p role="status" className="text-sm text-graphite">
                  {state.phase === 'registering' ? t('upload.registering') : null}
                  {state.phase === 'sending' ? t('upload.sending', { percent }) : null}
                  {state.phase === 'done' ? t('upload.done') : null}
                  {state.phase === 'cancelled' ? t('upload.cancelled') : null}
                </p>
                {state.phase === 'failed' ? (
                  <p role="alert" className="text-sm font-medium text-seal">
                    {t(`upload.failed.${state.reason}`)}
                  </p>
                ) : null}
              </div>
              {running ? (
                <button type="button" className={button} onClick={() => onCancel(upload.id)}>
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">{t('upload.cancel', { name: upload.name })}</span>
                </button>
              ) : (
                <button type="button" className={button} onClick={() => onDismiss(upload.id)}>
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">{t('upload.dismiss', { name: upload.name })}</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
