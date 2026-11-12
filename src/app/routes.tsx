import { Navigate, type RouteObject } from 'react-router'

import { AppShell } from '@/components/AppShell'
import { CallbackPage } from '@/features/auth/CallbackPage'
import { RequireAdmin } from '@/features/auth/RequireAdmin'
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
          {
            // For administrators (is_admin on /me), loaded only when opened.
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              {
                lazy: async () => ({
                  Component: (await import('@/features/admin/AdminLayout')).AdminLayout,
                }),
                children: [
                  { index: true, element: <Navigate to="files" replace /> },
                  {
                    path: 'files',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/AdminFilesPage')).AdminFilesPage,
                    }),
                  },
                  {
                    path: 'files/:fileId',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/AdminFilePage')).AdminFilePage,
                    }),
                  },
                  {
                    path: 'policies',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/PoliciesPage')).PoliciesPage,
                    }),
                  },
                  {
                    // `new` for a new policy.
                    path: 'policies/:policyId',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/PolicyPage')).PolicyPage,
                    }),
                  },
                  {
                    path: 'evaluate',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/EvaluatePage')).EvaluatePage,
                    }),
                  },
                  {
                    path: 'users',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/UsersPage')).UsersPage,
                    }),
                  },
                  {
                    path: 'users/:userId',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/UserPage')).UserPage,
                    }),
                  },
                  {
                    path: 'groups',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/GroupsPage')).GroupsPage,
                    }),
                  },
                  {
                    path: 'audit',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/AuditPage')).AuditPage,
                    }),
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: CALLBACK_PATH, element: <CallbackPage /> },
      // A share link's recipient has no account: outside the sign-in.
      { path: ACCESS_PATH, element: <ShareAccessPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
