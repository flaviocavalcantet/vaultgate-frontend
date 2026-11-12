import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import { refusal } from './failures'
import type { EvaluateIn, Evaluation, Policy, PolicyIn, PolicyPage } from './types'

export const PAGE_SIZE = 50

const policiesKey = ['admin', 'policies'] as const
const policyKey = (policyId: string) => [...policiesKey, 'one', policyId] as const

/** All policies, enabled or not, by name. */
export function usePolicies(page: number) {
  const api = useApi()
  return useQuery({
    queryKey: [...policiesKey, 'list', page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<PolicyPage> => {
      const { data, response } = await api.GET('/admin/policies', {
        params: { query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

export function usePolicy(policyId: string) {
  const api = useApi()
  return useQuery({
    queryKey: policyKey(policyId),
    retry: false,
    queryFn: async ({ signal }): Promise<Policy> => {
      const { data, response } = await api.GET('/admin/policies/{policy_id}', {
        params: { path: { policy_id: policyId } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

/** Creates a policy, or replaces one whole (the API's PUT). */
export function useSavePolicy(policyId: string | null) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: PolicyIn): Promise<Policy> => {
      const { data, error, response } = policyId
        ? await api.PUT('/admin/policies/{policy_id}', {
            params: { path: { policy_id: policyId } },
            body,
          })
        : await api.POST('/admin/policies', { body })
      if (!data) throw refusal(response.status, error)
      return data
    },
    onSuccess: (policy) => {
      queryClient.setQueryData(policyKey(policy.id), policy)
      return queryClient.invalidateQueries({ queryKey: [...policiesKey, 'list'] })
    },
  })
}

export function useDeletePolicy(policyId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { response } = await api.DELETE('/admin/policies/{policy_id}', {
        params: { path: { policy_id: policyId } },
      })
      if (!response.ok) throw refusal(response.status)
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: policyKey(policyId) })
      return queryClient.invalidateQueries({ queryKey: [...policiesKey, 'list'] })
    },
  })
}

/** The API's dry run: how a request would be decided, and which policies matched. */
export function useEvaluate() {
  const api = useApi()
  return useMutation({
    mutationFn: async (body: EvaluateIn): Promise<Evaluation> => {
      const { data, error, response } = await api.POST('/admin/policies/evaluate', { body })
      if (!data) throw refusal(response.status, error)
      return data
    },
  })
}
