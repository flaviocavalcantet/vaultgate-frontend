import { useQuery } from '@tanstack/react-query'

import type { components } from '@/api/schema'
import { useApi } from '@/api/useApi'

import { useAuth } from './useAuth'

export type Me = components['schemas']['UserOut']

/** The signed-in user as the API knows them (GET /me): groups, email, when they joined. */
export function useMe() {
  const api = useApi()
  const { status } = useAuth()
  return useQuery({
    queryKey: ['me'],
    enabled: status === 'signedIn',
    queryFn: async ({ signal }): Promise<Me> => {
      const { data, response } = await api.GET('/me', { signal })
      if (!data) throw new Error(`GET /me answered ${response.status}`)
      return data
    },
  })
}
