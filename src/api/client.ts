import createClient, { type Middleware } from 'openapi-fetch'

import type { paths } from './schema'

export interface ApiAuth {
  getAccessToken: () => string | null
  sessionEnded: () => void
}

/**
 * The typed client for the VaultGate API (types generated from its OpenAPI document,
 * `npm run api:types`). The access token goes on every request, and only here: to the
 * API's own address. A 401 on a request that carried a token means the session is over.
 */
export function createApiClient(baseUrl: string, auth: ApiAuth, fetcher: typeof fetch = fetch) {
  const client = createClient<paths>({ baseUrl, fetch: (request) => fetcher(request) })
  const authentication: Middleware = {
    onRequest({ request }) {
      const token = auth.getAccessToken()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      return request
    },
    onResponse({ request, response }) {
      if (response.status === 401 && request.headers.has('Authorization')) auth.sessionEnded()
      return response
    },
  }
  client.use(authentication)
  return client
}

export type ApiClient = ReturnType<typeof createApiClient>
