import { http, HttpResponse } from 'msw'

import { ACCESS_TOKEN } from '@/test/render'
import { alice, api, server } from '@/test/server'

import { createApiClient } from './client'

const BASE = api('')

describe('the API client', () => {
  it('sends the access token, and returns typed data', async () => {
    const auth = { getAccessToken: () => ACCESS_TOKEN, sessionEnded: vi.fn<() => void>() }
    const { data } = await createApiClient(BASE, auth).GET('/me')
    expect(data?.email).toBe(alice.email)
    expect(auth.sessionEnded).not.toHaveBeenCalled()
  })

  it('sends no Authorization header without a token', async () => {
    let header: string | null = 'unset'
    server.use(
      http.get(api('/healthz'), ({ request }) => {
        header = request.headers.get('Authorization')
        return HttpResponse.json({ status: 'ok' })
      }),
    )
    const auth = { getAccessToken: () => null, sessionEnded: vi.fn<() => void>() }
    await createApiClient(BASE, auth).GET('/healthz')
    expect(header).toBeNull()
  })

  it('ends the session when the API refuses the token', async () => {
    const auth = { getAccessToken: () => 'stale-token', sessionEnded: vi.fn<() => void>() }
    const { response } = await createApiClient(BASE, auth).GET('/me')
    expect(response.status).toBe(401)
    expect(auth.sessionEnded).toHaveBeenCalledTimes(1)
  })

  it('does not end a session that never was, on a 401 without a token', async () => {
    const auth = { getAccessToken: () => null, sessionEnded: vi.fn<() => void>() }
    await createApiClient(BASE, auth).GET('/me')
    expect(auth.sessionEnded).not.toHaveBeenCalled()
  })
})
