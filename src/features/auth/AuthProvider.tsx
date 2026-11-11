import type { User, UserManager } from 'oidc-client-ts'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { type Auth, AuthContext, type AuthStatus, type AuthUser } from './AuthContext'
import { safeReturnTo } from './returnTo'
import { CALLBACK_PATH } from './userManager'

function describe(user: User): AuthUser {
  const { name, preferred_username: username, email } = user.profile
  return { name: name ?? username ?? email ?? user.profile.sub }
}

interface State {
  status: AuthStatus
  user: User | null
}

/**
 * Holds the session for the app. `onSignedIn` is told where to go once the provider's
 * redirect has been processed (the router's navigate).
 */
export function AuthProvider({
  userManager,
  onSignedIn,
  atCallback = window.location.pathname === CALLBACK_PATH,
  children,
}: {
  userManager: UserManager
  onSignedIn: (returnTo: string) => void
  /** The page was opened by the provider's redirect; tests say so themselves. */
  atCallback?: boolean
  children: ReactNode
}) {
  const [state, setState] = useState<State>({
    status: atCallback ? 'loading' : 'signedOut',
    user: null,
  })
  // The token is read at request time, outside React's render cycle.
  const userRef = useRef<User | null>(null)
  const set = useCallback((status: AuthStatus, user: User | null) => {
    userRef.current = user
    setState({ status, user })
  }, [])

  // The provider sent the browser back: exchange the code, once (React's StrictMode
  // runs effects twice in development, and a code can be spent only once).
  const handled = useRef(false)
  useEffect(() => {
    if (!atCallback || handled.current) return
    handled.current = true
    userManager
      .signinRedirectCallback()
      .then((user) => {
        set('signedIn', user)
        onSignedIn(safeReturnTo((user.state as { returnTo?: unknown } | undefined)?.returnTo))
      })
      .catch((error: unknown) => {
        console.error(error)
        set('failed', null)
        onSignedIn('/')
      })
  }, [atCallback, onSignedIn, set, userManager])

  // Renewed tokens replace the old ones; a session that can't be renewed is over.
  useEffect(() => {
    const renewed = (user: User) => set('signedIn', user)
    const ended = () => {
      void userManager.removeUser()
      set('expired', null)
    }
    userManager.events.addUserLoaded(renewed)
    userManager.events.addAccessTokenExpired(ended)
    userManager.events.addSilentRenewError(ended)
    return () => {
      userManager.events.removeUserLoaded(renewed)
      userManager.events.removeAccessTokenExpired(ended)
      userManager.events.removeSilentRenewError(ended)
    }
  }, [set, userManager])

  const signIn = useCallback(
    (returnTo?: string) =>
      userManager.signinRedirect({ state: { returnTo: safeReturnTo(returnTo) } }),
    [userManager],
  )
  const signOut = useCallback(async () => {
    set('signedOut', null)
    await userManager.signoutRedirect()
  }, [set, userManager])
  const getAccessToken = useCallback(() => userRef.current?.access_token ?? null, [])
  const sessionEnded = useCallback(() => {
    if (userRef.current) {
      void userManager.removeUser()
      set('expired', null)
    }
  }, [set, userManager])

  const auth = useMemo<Auth>(
    () => ({
      status: state.status,
      user: state.user ? describe(state.user) : null,
      signIn,
      signOut,
      getAccessToken,
      sessionEnded,
    }),
    [getAccessToken, sessionEnded, signIn, signOut, state],
  )

  return <AuthContext value={auth}>{children}</AuthContext>
}
