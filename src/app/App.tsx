import { QueryClientProvider } from '@tanstack/react-query'
import type { UserManager } from 'oidc-client-ts'
import { useCallback, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'

import type { Config } from '@/config/config'
import { ConfigProvider } from '@/config/ConfigProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { createUserManager } from '@/features/auth/userManager'

import { ApiProvider } from './ApiProvider'
import { createQueryClient } from './queryClient'
import { routes } from './routes'

export function App({ config }: { config: Config }) {
  // Created once per mounted app, not per render.
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => createBrowserRouter(routes))
  const [userManager] = useState<UserManager>(() => createUserManager(config))
  const onSignedIn = useCallback(
    (returnTo: string) => void router.navigate(returnTo, { replace: true }),
    [router],
  )
  return (
    <ConfigProvider config={config}>
      <AuthProvider userManager={userManager} onSignedIn={onSignedIn}>
        <ApiProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ApiProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}
