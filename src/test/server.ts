import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import type { components } from '@/api/schema'

import { ACCESS_TOKEN, testConfig } from './render'

export const alice: components['schemas']['UserOut'] = {
  id: '5f0c8f0e-58f3-4d51-9d0a-0d3f1f5f3a11',
  issuer: testConfig.oidc.authority,
  subject: 'alice-subject',
  username: 'alice',
  email: 'alice@example.test',
  name: 'Alice Example',
  groups: ['/engineering', '/vaultgate-users'],
  is_admin: false,
  is_active: true,
  created_at: '2026-01-05T09:00:00Z',
  last_login_at: '2026-11-10T08:30:00Z',
}

export const api = (path: string) => `${testConfig.apiUrl}${path}`

/** The API as the tests know it: /me answers alice to her token, 401 to anything else. */
export const server = setupServer(
  http.get(api('/me'), ({ request }) =>
    request.headers.get('Authorization') === `Bearer ${ACCESS_TOKEN}`
      ? HttpResponse.json(alice)
      : HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 }),
  ),
)
