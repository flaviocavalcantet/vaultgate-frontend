import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { weekday } from './policyDraft'
import type { Policy } from './types'
import { PAGE_SIZE, usePolicies } from './usePolicies'

/** A policy's conditions in words, one line each; none means it applies to everyone. */
function Conditions({ policy }: { policy: Policy }) {
  const { t, i18n } = useTranslation()
  const lines: string[] = []
  const groups = policy.groups ?? []
  const networks = policy.networks ?? []
  const excluded = policy.excluded_networks ?? []
  const days = policy.days ?? []
  if (groups.length > 0) lines.push(t('admin.policies.inGroups', { groups: groups.join(', ') }))
  if (networks.length > 0) {
    lines.push(t('admin.policies.fromNetworks', { networks: networks.join(', ') }))
  }
  if (excluded.length > 0) {
    lines.push(t('admin.policies.notFrom', { networks: excluded.join(', ') }))
  }
  if (days.length > 0) {
    const names = days.map((day) => weekday(day, i18n.language, 'short')).join(', ')
    lines.push(t('admin.policies.onDays', { days: names }))
  }
  if (policy.start_time && policy.end_time) {
    lines.push(
      t('admin.policies.between', {
        start: policy.start_time.slice(0, 5),
        end: policy.end_time.slice(0, 5),
        timezone: policy.timezone ?? 'UTC',
      }),
    )
  }
  if (lines.length === 0) return <>{t('admin.policies.everyone')}</>
  return (
    <ul>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

/** Every access policy, enabled or not, with what it decides and when it applies. */
export function PoliciesPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const policies = usePolicies(page)

  const total = policies.data?.total ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeading title={t('admin.policies.title')}>{t('admin.policies.intro')}</PageHeading>
        <Link to="/admin/policies/new" className={primaryButton}>
          {t('admin.policies.new')}
        </Link>
      </div>

      {policies.isPending ? <p role="status">{t('admin.policies.loading')}</p> : null}
      {policies.isError ? (
        <div role="alert">
          <p className="mb-3">{t('admin.policies.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void policies.refetch()}>
            {t('admin.policies.retry')}
          </button>
        </div>
      ) : null}
      {policies.data && policies.data.items.length === 0 ? (
        <p className="font-medium">{t('admin.policies.empty')}</p>
      ) : null}

      {policies.data && policies.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('admin.policies.tableCaption')}</caption>
              <thead className="border-b border-rule text-sm text-graphite">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.policies.name')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.policies.effect')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.policies.actionsColumn')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.policies.conditions')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {t('admin.policies.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {policies.data.items.map((policy) => (
                  <tr key={policy.id} className="border-b border-rule align-top">
                    <th scope="row" className="py-3 pr-4 font-medium">
                      <Link to={`/admin/policies/${policy.id}`} className="underline">
                        {policy.name}
                      </Link>
                    </th>
                    <td className="py-3 pr-4">
                      {policy.effect === 'deny'
                        ? t('admin.policies.deny')
                        : t('admin.policies.allow')}
                    </td>
                    <td className="py-3 pr-4">
                      {policy.actions.map((action) => t(`admin.actions.${action}`)).join(', ')}
                    </td>
                    <td className="py-3 pr-4 text-sm">
                      <Conditions policy={policy} />
                    </td>
                    <td className="py-3">
                      {policy.enabled === false
                        ? t('admin.policies.disabled')
                        : t('admin.policies.enabled')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE ? (
            <nav
              aria-label={t('admin.policies.pagination')}
              className="mt-4 flex items-center justify-between gap-4 text-sm"
            >
              <p>{t('admin.policies.showing', { from, to, total })}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={secondaryButton}
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('admin.policies.previous')}
                </button>
                <button
                  type="button"
                  className={secondaryButton}
                  disabled={to >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('admin.policies.next')}
                </button>
              </div>
            </nav>
          ) : null}
        </>
      ) : null}
    </>
  )
}
