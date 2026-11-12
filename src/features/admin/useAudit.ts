import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import { refusal } from './failures'
import type { AuditPage, Verification } from './types'

export const PAGE_SIZE = 50

/** What the audit log is filtered by; an empty value doesn't filter. */
export interface AuditFilter {
  action: string
  outcome: string
  actor: string
  target: string
  /** Instants (ISO 8601), or empty. */
  since: string
  until: string
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

/** Audit events, newest first. An action ending in "." matches every action it begins. */
export function useAuditEvents(filter: AuditFilter, page: number) {
  const api = useApi()
  return useQuery({
    queryKey: ['admin', 'audit', filter, page],
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async ({ signal }): Promise<AuditPage> => {
      const { data, error, response } = await api.GET('/admin/audit', {
        params: {
          query: {
            action: orNull(filter.action),
            outcome: orNull(filter.outcome),
            actor_id: orNull(filter.actor),
            target_id: orNull(filter.target),
            since: orNull(filter.since),
            until: orNull(filter.until),
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          },
        },
        signal,
      })
      if (!data) throw refusal(response.status, error)
      return data
    },
  })
}

/** Walks the whole hash chain: whether any event was changed or removed. */
export function useVerifyChain() {
  const api = useApi()
  return useMutation({
    mutationFn: async (): Promise<Verification> => {
      const { data, response } = await api.POST('/admin/audit/verify')
      if (!data) throw refusal(response.status)
      return data
    },
  })
}
