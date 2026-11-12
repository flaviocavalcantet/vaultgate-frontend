import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import { refusal } from './failures'
import type { GroupPage, User, UserPage } from './types'

export const PAGE_SIZE = 50

/** Every user VaultGate has seen sign in, oldest first. */
export function useUsers(page: number) {
  const api = useApi()
  return useQuery({
    queryKey: ['admin', 'users', 'list', page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<UserPage> => {
      const { data, response } = await api.GET('/admin/users', {
        params: { query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

export function useUser(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['admin', 'users', 'one', userId],
    retry: false,
    queryFn: async ({ signal }): Promise<User> => {
      const { data, response } = await api.GET('/admin/users/{user_id}', {
        params: { path: { user_id: userId } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

/** Every group seen in a sign-in token, by name, with how many users are in it. */
export function useGroups(page: number) {
  const api = useApi()
  return useQuery({
    queryKey: ['admin', 'groups', page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<GroupPage> => {
      const { data, response } = await api.GET('/admin/groups', {
        params: { query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}
