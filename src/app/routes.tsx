import type { RouteObject } from 'react-router'

import { AppShell } from '@/components/AppShell'
import { CallbackPage } from '@/features/auth/CallbackPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { CALLBACK_PATH } from '@/features/auth/userManager'
import { FilesPage } from '@/features/files/FilesPage'
import { HomePage } from '@/features/home/HomePage'
import { ACCESS_PATH } from '@/features/sharing/link'
import { ShareAccessPage } from '@/features/sharing/ShareAccessPage'
import { SharedWithMePage } from '@/features/sharing/SharedWithMePage'
import { ShareFilePage } from '@/features/sharing/ShareFilePage'

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
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'files', element: <FilesPage /> },
          { path: 'files/:fileId/sharing', element: <ShareFilePage /> },
          { path: 'shared', element: <SharedWithMePage /> },
        ],
      },
      { path: CALLBACK_PATH, element: <CallbackPage /> },
      // A share link's recipient has no account: outside the sign-in.
      { path: ACCESS_PATH, element: <ShareAccessPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
