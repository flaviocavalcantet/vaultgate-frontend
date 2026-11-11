import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts'

import type { Config } from '@/config/config'

export const CALLBACK_PATH = '/auth/callback'

/**
 * The OpenID Connect client: authorization code flow with PKCE, as a public client (a
 * browser can keep no secret).
 *
 * - Tokens live in memory only (`userStore`), never in localStorage or sessionStorage,
 *   so a script injected later finds none in storage. A reload therefore starts signed
 *   out; while the provider's own session lasts, signing in again asks for no password.
 * - The flow's own state (the PKCE verifier, for the seconds of the redirect) is in
 *   sessionStorage: it must survive the redirect, and it is no credential.
 * - The access token is renewed with the refresh token shortly before it expires.
 */
export function createUserManager(config: Config, origin = window.location.origin): UserManager {
  return new UserManager({
    authority: config.oidc.authority,
    client_id: config.oidc.clientId,
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    post_logout_redirect_uri: `${origin}/`,
    response_type: 'code',
    scope: 'openid profile email',
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: true,
    // No hidden iframe: renewal uses the refresh token, or it fails and the user signs in.
    monitorSession: false,
  })
}
