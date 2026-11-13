import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { reasonOf } from './failures'
import { Pager } from './Pager'
import type { Node } from './types'
import { PAGE_SIZE, useNodes, useRevokeNode } from './useNodes'
import { useShowAll } from './useShowAll'

type Notice = { kind: 'ok' | 'error'; text: string }

/** Enrolled nodes, with their certificates, and revocation. */
export function NodesPage() {
  const { t } = useTranslation()
  const view = useShowAll()
  const nodes = useNodes(view.all, view.page)
  const showId = useId()
  // Page-level: a revoked node leaves the list of active ones.
  const [notice, setNotice] = useState<Notice | null>(null)

  return (
    <>
      <PageHeading title={t('admin.nodes.title')}>{t('admin.nodes.intro')}</PageHeading>
      <div className="mb-4">
        <label htmlFor={showId} className="mr-2 font-medium">
          {t('admin.nodes.show')}
        </label>
        <select
          id={showId}
          value={view.all ? 'all' : 'active'}
          onChange={(event) => view.set({ all: event.target.value === 'all' })}
          className="rounded border border-control bg-surface px-2 py-1.5"
        >
          <option value="active">{t('admin.nodes.active')}</option>
          <option value="all">{t('admin.nodes.all')}</option>
        </select>
      </div>
      <div aria-live="polite">
        {notice ? (
          <p className={`mb-4 font-medium ${notice.kind === 'error' ? 'text-seal' : ''}`}>
            {notice.text}
          </p>
        ) : null}
      </div>
      {nodes.isPending ? <p role="status">{t('admin.nodes.loading')}</p> : null}
      {nodes.isError ? (
        <div role="alert">
          <p className="mb-3">{t('admin.nodes.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void nodes.refetch()}>
            {t('admin.nodes.retry')}
          </button>
        </div>
      ) : null}
      {nodes.data && nodes.data.items.length === 0 ? <p>{t('admin.nodes.empty')}</p> : null}
      {nodes.data && nodes.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('admin.nodes.tableCaption')}</caption>
              <thead className="border-b border-rule text-sm text-graphite">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.nodes.name')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.nodes.status')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.nodes.certificate')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.nodes.fingerprint')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">{t('admin.nodes.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {nodes.data.items.map((node) => (
                  <Row key={node.id} node={node} onNotice={setNotice} />
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            label={t('admin.nodes.tableCaption')}
            page={view.page}
            size={PAGE_SIZE}
            total={nodes.data.total}
            onPage={(page) => view.set({ page })}
          />
        </>
      ) : null}
    </>
  )
}

function Row({ node, onNotice }: { node: Node; onNotice: (notice: Notice) => void }) {
  const { t, i18n } = useTranslation()
  const revoke = useRevokeNode(node.id)
  const [confirming, setConfirming] = useState(false)
  const when = (iso: string) => formatDateTime(iso, i18n.language)
  const state = node.status === 'revoked' ? 'revoked' : 'active'

  const onRevoke = () => {
    revoke.mutate(undefined, {
      onSuccess: () =>
        onNotice({ kind: 'ok', text: t('admin.nodes.revoked', { name: node.name }) }),
      onError: (error) =>
        onNotice({
          kind: 'error',
          text: t(`admin.nodes.revokeFailed.${reasonOf(error)}`, { name: node.name }),
        }),
      onSettled: () => setConfirming(false),
    })
  }

  return (
    <tr className="border-b border-rule align-top">
      <th scope="row" className="py-3 pr-4 font-medium">
        {node.name}
        <span className="block font-mono text-xs font-normal break-all">{node.identity}</span>
      </th>
      <td className="py-3 pr-4">
        {t(`admin.nodes.states.${state}`)}
        {node.revoked_at ? <span className="block text-sm">{when(node.revoked_at)}</span> : null}
      </td>
      <td className="py-3 pr-4 text-sm">
        <span className="block font-mono">
          {t('admin.nodes.serial', { serial: node.cert_serial })}
        </span>
        <span className="block">
          {t('admin.nodes.certExpires', { when: when(node.cert_expires_at) })}
        </span>
        <span className="block">
          {t('admin.nodes.enrolled')}: {when(node.enrolled_at)}
        </span>
        {node.renewed_at ? (
          <span className="block">{t('admin.nodes.renewed', { when: when(node.renewed_at) })}</span>
        ) : null}
      </td>
      <td className="max-w-xs py-3 pr-4 font-mono text-xs break-all">{node.key_fingerprint}</td>
      <td className="py-3 text-right">
        {state === 'active' && !confirming ? (
          <button
            type="button"
            className={secondaryButton}
            aria-label={t('admin.nodes.revokeName', { name: node.name })}
            onClick={() => setConfirming(true)}
          >
            {t('admin.nodes.revoke')}
          </button>
        ) : null}
        {state === 'active' && confirming ? (
          <div
            role="group"
            aria-label={t('admin.nodes.revokeName', { name: node.name })}
            className="space-y-2 text-left"
          >
            <p className="font-medium">{t('admin.nodes.revokeConfirm', { name: node.name })}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={primaryButton}
                disabled={revoke.isPending}
                onClick={onRevoke}
              >
                {t('admin.nodes.revokeYes')}
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setConfirming(false)}
              >
                {t('admin.nodes.revokeNo')}
              </button>
            </div>
          </div>
        ) : null}
      </td>
    </tr>
  )
}
