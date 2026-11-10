import type { RouteObject } from 'react-router'

import { AppShell } from '@/components/AppShell'
import { HomePage } from '@/features/home/HomePage'

import { ErrorPage } from './ErrorPage'
import { NotFoundPage } from './NotFoundPage'

/** Every route of the app. Features add theirs here, lazily once they are large. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
