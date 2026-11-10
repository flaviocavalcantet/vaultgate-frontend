import { QueryClient } from '@tanstack/react-query'

/** Server state (TanStack Query). One retry: the API's errors are mostly final (4xx). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}
