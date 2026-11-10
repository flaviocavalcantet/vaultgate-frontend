import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'

import type { Config } from '@/config/config'
import { ConfigProvider } from '@/config/ConfigProvider'

import { createQueryClient } from './queryClient'
import { routes } from './routes'

export function App({ config }: { config: Config }) {
  // Created once per mounted app, not per render.
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => createBrowserRouter(routes))
  return (
    <ConfigProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConfigProvider>
  )
}
