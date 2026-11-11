import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { User, UserManager } from 'oidc-client-ts'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { ApiProvider } from '@/app/ApiProvider'
import { createQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import type { Config } from '@/config/config'
import { ConfigProvider } from '@/config/ConfigProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { CALLBACK_PATH } from '@/features/auth/userManager'

export const testConfig: Config = {
  apiUrl: 'https://api.example.test',
  gatewayUrl: 'https://gateway.example.test',
  oidc: { authority: 'https://sso.example.test/realms/vaultgate', clientId: 'vaultgate-web' },
}

export const ACCESS_TOKEN = 'access-token-for-tests'

/** What the provider's redirect yields: a user, and where they were going. */
export function signedInUser(returnTo: unknown = '/', name = 'Alice Example'): User {
  return {
    access_token: ACCESS_TOKEN,
    profile: { sub: 'alice-subject', name },
    state: { returnTo },
  } as unknown as User
}

type Listener = (...args: never[]) => void

/**
 * A stand-in for oidc-client-ts's UserManager: the calls the app makes, recorded, and
 * its events, which a test fires with `emit`.
 */
export function fakeUserManager(
  callback: () => Promise<User> = () => Promise.resolve(signedInUser()),
) {
  const listeners: Record<string, Listener[]> = {}
  const on = (name: string) => (listener: Listener) => (listeners[name] ??= []).push(listener)
  const off = (name: string) => (listener: Listener) => {
    listeners[name] = (listeners[name] ?? []).filter((l) => l !== listener)
  }
  const manager = {
    signinRedirect: vi.fn(() => Promise.resolve()),
    signinRedirectCallback: vi.fn(callback),
    signoutRedirect: vi.fn(() => Promise.resolve()),
    removeUser: vi.fn(() => Promise.resolve()),
    events: {
      addUserLoaded: on('userLoaded'),
      removeUserLoaded: off('userLoaded'),
      addAccessTokenExpired: on('accessTokenExpired'),
      removeAccessTokenExpired: off('accessTokenExpired'),
      addSilentRenewError: on('silentRenewError'),
      removeSilentRenewError: off('silentRenewError'),
    },
  }
  const emit = (name: string, ...args: unknown[]) =>
    (listeners[name] ?? []).forEach((listener) => (listener as (...a: unknown[]) => void)(...args))
  return { manager, emit, asUserManager: manager as unknown as UserManager }
}

/**
 * The whole app at `path`, with the real routes and providers, as a user would see it.
 * Signed out unless `path` is the sign-in callback, which signs in as `fake` says.
 */
export function renderApp(path = '/', fake = fakeUserManager()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <ConfigProvider config={testConfig}>
      <AuthProvider
        userManager={fake.asUserManager}
        atCallback={path.startsWith(CALLBACK_PATH)}
        onSignedIn={(returnTo) => void router.navigate(returnTo, { replace: true })}
      >
        <ApiProvider>
          <QueryClientProvider client={createQueryClient()}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ApiProvider>
      </AuthProvider>
    </ConfigProvider>,
  )
  return { ...view, router, ...fake }
}
