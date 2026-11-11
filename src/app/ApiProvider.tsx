import { type ReactNode, useMemo } from 'react'

import { ApiContext } from '@/api/ApiContext'
import { createApiClient } from '@/api/client'
import { useConfig } from '@/config/useConfig'
import { useAuth } from '@/features/auth/useAuth'

/** The API client for the signed-in user; inside ConfigProvider and AuthProvider. */
export function ApiProvider({ children }: { children: ReactNode }) {
  const { apiUrl } = useConfig()
  const { getAccessToken, sessionEnded } = useAuth()
  const client = useMemo(
    () => createApiClient(apiUrl, { getAccessToken, sessionEnded }),
    [apiUrl, getAccessToken, sessionEnded],
  )
  return <ApiContext value={client}>{children}</ApiContext>
}
