import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import { refusal } from './failures'
import type {
  Approval,
  EnrollmentPage,
  IssuedToken,
  Node,
  NodePage,
  TokenPage,
  Tpm,
  TpmPage,
} from './types'

export const PAGE_SIZE = 50

const enrollmentsKey = ['admin', 'enrollments'] as const
const nodesKey = ['admin', 'nodes'] as const

/** Enrollment requests, newest first: those still waiting, or all of them. */
export function useEnrollments(all: boolean, page: number) {
  const api = useApi()
  return useQuery({
    queryKey: [...enrollmentsKey, all, page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<EnrollmentPage> => {
      const { data, response } = await api.GET('/admin/nodes/enrollments', {
        params: {
          query: { status: all ? 'all' : 'waiting', limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

/**
 * Approves a request once the administrator has confirmed its key: the fingerprint they
 * send is the one the node's operator read them, and the API compares it with the
 * request's. The answer is the one-time code the node completes its enrollment with.
 */
export function useApprove(enrollmentId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fingerprint: string): Promise<Approval> => {
      const { data, response } = await api.POST(
        '/admin/nodes/enrollments/{enrollment_id}/approve',
        {
          params: { path: { enrollment_id: enrollmentId } },
          body: { key_fingerprint: fingerprint },
        },
      )
      if (!data) throw refusal(response.status)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: enrollmentsKey }),
  })
}

export function useReject(enrollmentId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { response } = await api.POST('/admin/nodes/enrollments/{enrollment_id}/reject', {
        params: { path: { enrollment_id: enrollmentId } },
      })
      if (!response.ok) throw refusal(response.status)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: enrollmentsKey }),
  })
}

/** Enrolled nodes: the active ones, or all of them, revoked included. */
export function useNodes(all: boolean, page: number) {
  const api = useApi()
  return useQuery({
    queryKey: [...nodesKey, all, page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<NodePage> => {
      const { data, response } = await api.GET('/admin/nodes', {
        params: {
          query: { status: all ? 'all' : 'active', limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

/** Revokes the node's certificate and the node: it can't renew, and its name is free. */
export function useRevokeNode(nodeId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<Node> => {
      const { data, response } = await api.POST('/admin/nodes/{node_id}/revoke', {
        params: { path: { node_id: nodeId } },
      })
      if (!data) throw refusal(response.status)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nodesKey }),
  })
}

const tokensKey = ['admin', 'tokens'] as const
const tpmsKey = ['admin', 'tpms'] as const

/** Enrollment tokens: those still usable, or all of them. */
export function useTokens(all: boolean, page: number) {
  const api = useApi()
  return useQuery({
    queryKey: [...tokensKey, all, page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<TokenPage> => {
      const { data, response } = await api.GET('/admin/nodes/tokens', {
        params: {
          query: { status: all ? 'all' : 'usable', limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

/** Issues a single-use token for one node name. The token is in this answer only. */
export function useIssueToken() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      name: string
      ttl_seconds: number | null
    }): Promise<IssuedToken> => {
      const { data, error, response } = await api.POST('/admin/nodes/tokens', { body })
      if (!data) throw refusal(response.status, error)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tokensKey }),
  })
}

export function useRevokeToken() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { response } = await api.POST('/admin/nodes/tokens/{token_id}/revoke', {
        params: { path: { token_id: tokenId } },
      })
      if (!response.ok) throw refusal(response.status)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tokensKey }),
  })
}

/** TPM registrations: those still usable, or all of them. */
export function useTpms(all: boolean, page: number) {
  const api = useApi()
  return useQuery({
    queryKey: [...tpmsKey, all, page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<TpmPage> => {
      const { data, response } = await api.GET('/admin/nodes/tpms', {
        params: {
          query: { status: all ? 'all' : 'usable', limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

/** Registers a TPM, by its endorsement key's fingerprint, to enroll one node name once. */
export function useRegisterTpm() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; ek_fingerprint: string }): Promise<Tpm> => {
      const { data, error, response } = await api.POST('/admin/nodes/tpms', { body })
      if (!data) throw refusal(response.status, error)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tpmsKey }),
  })
}

export function useRevokeTpm() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tpmId: string) => {
      const { response } = await api.POST('/admin/nodes/tpms/{tpm_id}/revoke', {
        params: { path: { tpm_id: tpmId } },
      })
      if (!response.ok) throw refusal(response.status)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tpmsKey }),
  })
}
