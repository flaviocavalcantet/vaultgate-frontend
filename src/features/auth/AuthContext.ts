import { createContext } from 'react'

export type AuthStatus =
  /** Finding out: the callback is being processed. */
  | 'loading'
  | 'signedIn'
  | 'signedOut'
  /** Was signed in; the session ended (expired, or the API refused the token). */
  | 'expired'
  /** Signing in failed. */
  | 'failed'

export interface AuthUser {
  /** What to call the user in the page, from the ID token; the API's /me has the rest. */
  name: string
}

export interface Auth {
  status: AuthStatus
  user: AuthUser | null
  /** Sends the browser to the provider; comes back to `returnTo` (a path of this app). */
  signIn: (returnTo?: string) => Promise<void>
  /** Ends the session here and at the provider. */
  signOut: () => Promise<void>
  /** The current access token, for the API client; null when there is none. */
  getAccessToken: () => string | null
  /** The API refused the token: the session is over, whatever the clock says. */
  sessionEnded: () => void
}

export const AuthContext = createContext<Auth | null>(null)
