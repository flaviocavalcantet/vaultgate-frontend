import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { createQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import type { Config } from '@/config/config'
import { ConfigProvider } from '@/config/ConfigProvider'

export const testConfig: Config = {
  apiUrl: 'https://api.example.test',
  gatewayUrl: 'https://gateway.example.test',
  oidc: { authority: 'https://sso.example.test/realms/vaultgate', clientId: 'vaultgate-web' },
}

/** The whole app at `path`, with the real routes and providers, as a user would see it. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <ConfigProvider config={testConfig}>
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConfigProvider>,
  )
}
