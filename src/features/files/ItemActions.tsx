import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatBytes } from '@/components/format'
import { dangerButton, primaryButton, secondaryButton } from '@/components/styles'

import type { Item } from './types'
import { ChangeRefused, useChanges, useFolder, useFolderTotals, useSubfolders } from './useFolders'

/** What the page is doing to an item, or making: one panel at a time. */
export type Action =
  | { kind: 'create' }
  | { kind: 'rename'; target: Item }
  | { kind: 'move'; target: Item }
  | { kind: 'delete'; target: Item }

const input =
  'mt-1 w-full max-w-md rounded border border-control bg-surface px-3 py-2 text-ink focus:border-accent'

function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => ref.current?.focus(), [])
  return ref
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="mb-6 rounded border border-rule bg-surface p-4">
      <h2 id={headingId} className="mb-3 text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Problem({ error }: { error: Error | null }) {
  const { t } = useTranslation()
  if (!error) return null
  const reason = error instanceof ChangeRefused ? error.reason : 'unknown'
  return (
    <p role="alert" className="mt-2 font-medium text-seal">
      {t(`folders.failed.${reason}`)}
    </p>
  )
}

/** A name for a new folder, or a new name for an item. */
function NameForm({
  title,
  label,
  submit,
  initial = '',
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  title: string
  label: string
  submit: string
  initial?: string
  pending: boolean
  error: Error | null
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial)
  const field = useFocusOnMount<HTMLInputElement>()
  const id = useId()
  return (
    <Panel title={title}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(name.trim())
        }}
      >
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        <input
          id={id}
          ref={field}
          className={input}
          value={name}
          maxLength={255}
          required
          onChange={(event) => setName(event.target.value)}
        />
        <Problem error={error} />
        <div className="mt-3 flex gap-2">
          <button type="submit" className={primaryButton} disabled={pending || !name.trim()}>
            {submit}
          </button>
          <button type="button" className={secondaryButton} onClick={onCancel}>
            {t('folders.cancel')}
          </button>
        </div>
      </form>
    </Panel>
  )
}

/** Browse the caller's folders and pick where the item goes. */
function MovePanel({
  target,
  pending,
  error,
  onMove,
  onCancel,
}: {
  target: Item
  pending: boolean
  error: Error | null
  onMove: (to: string | null, place: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const from = target.kind === 'file' ? target.item.folder_id : target.item.parent_id
  const [at, setAt] = useState<string | undefined>(from ?? undefined)
  const place = useFolder(at)
  const inside = useSubfolders(at)
  const heading = useFocusOnMount<HTMLParagraphElement>()
  const placeName = at === undefined ? t('folders.top') : (place.data?.name ?? '…')
  const parentOfPlace = place.data?.path.at(-2)?.id
  // A folder can't go into itself: it is left out of what can be opened.
  const choices = (inside.data?.items ?? []).filter(
    (folder) => !(target.kind === 'folder' && folder.id === target.item.id),
  )
  return (
    <Panel title={t('folders.move.title', { name: target.item.name })}>
      <p ref={heading} tabIndex={-1} className="mb-2">
        {t('folders.move.at', { place: placeName })}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {at !== undefined ? (
          <button type="button" className={secondaryButton} onClick={() => setAt(parentOfPlace)}>
            {t('folders.move.up')}
          </button>
        ) : null}
      </div>
      {choices.length > 0 ? (
        <ul aria-label={t('folders.move.choices', { place: placeName })} className="mb-3 space-y-1">
          {choices.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                className="underline underline-offset-2 hover:text-accent"
                onClick={() => setAt(folder.id)}
                aria-label={t('folders.move.open', { name: folder.name })}
              >
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-graphite">{t('folders.move.none')}</p>
      )}
      <Problem error={error} />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={primaryButton}
          disabled={pending || (at ?? null) === (from ?? null) || (at !== undefined && !place.data)}
          onClick={() => onMove(at ?? null, placeName)}
        >
          {t('folders.move.here', { place: placeName })}
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel}>
          {t('folders.cancel')}
        </button>
      </div>
    </Panel>
  )
}

/**
 * Confirm a deletion. A file's is one click; a folder's says what goes with it and
 * wants its name typed, since everything at every level goes and nothing comes back.
 */
function DeletePanel({
  target,
  pending,
  error,
  onDelete,
  onCancel,
}: {
  target: Item
  pending: boolean
  error: Error | null
  onDelete: () => void
  onCancel: () => void
}) {
  const { t, i18n } = useTranslation()
  const totals = useFolderTotals(target.kind === 'folder' ? target.item.id : undefined)
  const [typed, setTyped] = useState('')
  const heading = useFocusOnMount<HTMLParagraphElement>()
  const id = useId()
  const name = target.item.name
  let holds: string | null = null
  if (target.kind === 'folder' && totals.data) {
    holds =
      totals.data.folders + totals.data.files === 0
        ? t('folders.delete.empty')
        : t('folders.delete.holds', {
            folders: t('folders.delete.folders', { count: totals.data.folders }),
            files: t('folders.delete.files', { count: totals.data.files }),
            size: formatBytes(totals.data.bytes, i18n.language),
          })
  }
  const confirmed = target.kind === 'file' || (totals.data !== undefined && typed === name)
  return (
    <Panel title={t('folders.delete.title', { name })}>
      <p ref={heading} tabIndex={-1} className="mb-2">
        {target.kind === 'file' ? t('folders.delete.file') : t('folders.delete.folder')}
      </p>
      {target.kind === 'folder' ? (
        <>
          {totals.isPending ? <p role="status">{t('folders.delete.counting')}</p> : null}
          {totals.isError ? <Problem error={totals.error} /> : null}
          {holds ? <p className="mb-3 font-medium">{holds}</p> : null}
          <label htmlFor={id} className="block text-sm font-medium">
            {t('folders.delete.typeName', { name })}
          </label>
          <input
            id={id}
            className={input}
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </>
      ) : null}
      <Problem error={error} />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={dangerButton}
          disabled={pending || !confirmed}
          onClick={onDelete}
        >
          {t('folders.delete.confirm', { name })}
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel}>
          {t('folders.cancel')}
        </button>
      </div>
    </Panel>
  )
}

/** The panel for the action under way; tells the page what was done, for its notice. */
export function ItemActions({
  action,
  folderId,
  onDone,
  onCancel,
}: {
  action: Action
  folderId: string | undefined
  onDone: (notice: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { create, rename, move, remove } = useChanges()

  switch (action.kind) {
    case 'create':
      return (
        <NameForm
          title={t('folders.create.title')}
          label={t('folders.create.label')}
          submit={t('folders.create.submit')}
          pending={create.isPending}
          error={create.error}
          onSubmit={(name) =>
            create.mutate(
              { name, parentId: folderId },
              { onSuccess: () => onDone(t('folders.create.done', { name })) },
            )
          }
          onCancel={onCancel}
        />
      )
    case 'rename':
      return (
        <NameForm
          title={t('folders.rename.title', { name: action.target.item.name })}
          label={t('folders.rename.label')}
          submit={t('folders.rename.submit')}
          initial={action.target.item.name}
          pending={rename.isPending}
          error={rename.error}
          onSubmit={(name) =>
            rename.mutate(
              { target: action.target, name },
              {
                onSuccess: () =>
                  onDone(t('folders.rename.done', { from: action.target.item.name, to: name })),
              },
            )
          }
          onCancel={onCancel}
        />
      )
    case 'move':
      return (
        <MovePanel
          target={action.target}
          pending={move.isPending}
          error={move.error}
          onMove={(to, place) =>
            move.mutate(
              { target: action.target, to },
              {
                onSuccess: () =>
                  onDone(t('folders.move.done', { name: action.target.item.name, place })),
              },
            )
          }
          onCancel={onCancel}
        />
      )
    case 'delete':
      return (
        <DeletePanel
          target={action.target}
          pending={remove.isPending}
          error={remove.error}
          onDelete={() =>
            remove.mutate(action.target, {
              onSuccess: () => onDone(t('folders.delete.done', { name: action.target.item.name })),
            })
          }
          onCancel={onCancel}
        />
      )
  }
}
