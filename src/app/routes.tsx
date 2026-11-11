import type { RouteObject } from 'react-router'

import { AppShell } from '@/components/AppShell'
import { CallbackPage } from '@/features/auth/CallbackPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { CALLBACK_PATH } from '@/features/auth/userManager'
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
      // Everything behind the sign-in. Features add their routes here.
      { element: <RequireAuth />, children: [{ index: true, element: <HomePage /> }] },
      { path: CALLBACK_PATH, element: <CallbackPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
