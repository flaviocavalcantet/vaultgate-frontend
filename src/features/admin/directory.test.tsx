import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { CALLBACK_PATH } from '@/features/auth/userManager'
import { ACCESS_TOKEN, fakeUserManager, renderApp, signedInUser } from '@/test/render'
import { alice, api, server } from '@/test/server'

import type { AuditEvent, User } from './types'

const signedIn = (request: Request) =>
  request.headers.get('Authorization') === `Bearer ${ACCESS_TOKEN}`

const BOB: User = {
  ...alice,
  id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
  subject: 'bob-subject',
  username: 'bob',
  email: null,
  name: null,
  groups: [],
  is_admin: false,
  is_active: false,
  last_login_at: null,
}

function asAdmin() {
  server.use(
    http.get(api('/me'), ({ request }) =>
      signedIn(request)
        ? HttpResponse.json({ ...alice, is_admin: true })
        : HttpResponse.json({}, { status: 401 }),
    ),
  )
}

async function openAt(path: string, heading: string) {
  asAdmin()
  const fake = fakeUserManager(() => Promise.resolve(signedInUser(path)))
  const view = renderApp(CALLBACK_PATH, fake)
  await screen.findByRole('heading', { level: 1, name: heading })
  return view
}

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 41,
    occurred_at: '2026-11-12T10:00:00Z',
    actor_kind: 'user',
    actor_id: BOB.id,
    action: 'share.created',
    outcome: 'ok',
    target_kind: 'file',
    target_id: '3c1f2e4d-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    client_ip: '10.1.2.3',
    request_id: 'req-123',
    details: { recipient_kind: 'external', note: '<b>not markup</b>' },
    hash: 'c'.repeat(64),
    ...overrides,
  }
}

describe('users', () => {
  it('lists everyone who signed in, with role and state', async () => {
    server.use(
      http.get(api('/admin/users'), ({ request }) =>
        signedIn(request)
          ? HttpResponse.json({
              items: [{ ...alice, is_admin: true }, BOB],
              total: 2,
              limit: 50,
              offset: 0,
            })
          : HttpResponse.json({}, { status: 401 }),
      ),
    )
    await openAt('/admin/users', 'Users')
    const table = await screen.findByRole('table', { name: 'Users, oldest first' })
    const aliceRow = within(table).getByRole('row', { name: /Alice Example/ })
    expect(within(aliceRow).getByText('Administrator')).toBeVisible()
    expect(within(aliceRow).getByText('/engineering, /vaultgate-users')).toBeVisible()

    const bobRow = within(table).getByRole('row', { name: /bob/ })
    expect(within(bobRow).getByText('Deactivated')).toBeVisible()
    expect(within(bobRow).getByText('Never')).toBeVisible()
    expect(within(bobRow).getByText('Not set')).toBeVisible()
    expect(within(bobRow).getByRole('link', { name: 'bob' })).toHaveAttribute(
      'href',
      `/admin/users/${BOB.id}`,
    )
  })

  it('shows a user, and leads to their access check and their events', async () => {
    let evaluated: { user_id?: string; groups?: unknown } = {}
    server.use(
      http.get(api(`/admin/users/${BOB.id}`), () => HttpResponse.json(BOB)),
      http.post(api('/admin/policies/evaluate'), async ({ request }) => {
        evaluated = (await request.json()) as typeof evaluated
        return HttpResponse.json({
          allowed: false,
          reason: 'no_matching_policy',
          deny: [],
          allow: [],
          groups: [],
          client_ip: '10.0.0.1',
          at: '2026-11-12T10:00:00Z',
        })
      }),
    )
    await openAt(`/admin/users/${BOB.id}`, 'bob')
    expect(screen.getByText(BOB.id)).toBeVisible()

    await userEvent.click(screen.getByRole('link', { name: 'Check this user’s access' }))
    await screen.findByRole('heading', { level: 1, name: 'Check access' })
    expect(screen.getByRole('radio', { name: 'A user, by ID' })).toBeChecked()
    expect(screen.getByLabelText('User ID')).toHaveValue(BOB.id)
    await userEvent.type(screen.getByLabelText('From the address'), '10.0.0.1')
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(
      await screen.findByText('No allow policy matches, so it is denied by default.'),
    ).toBeVisible()
    expect(evaluated.user_id).toBe(BOB.id)
    expect(evaluated.groups).toBeUndefined()
  })

  it('says so when the user doesn’t exist', async () => {
    server.use(
      http.get(api(`/admin/users/${BOB.id}`), () =>
        HttpResponse.json({ detail: 'User not found' }, { status: 404 }),
      ),
    )
    await openAt(`/admin/users/${BOB.id}`, 'A user')
    expect(await screen.findByRole('alert')).toHaveTextContent('There is no such user.')
  })
})

describe('groups', () => {
  it('lists the groups with their members, and checks a group’s access', async () => {
    server.use(
      http.get(api('/admin/groups'), () =>
        HttpResponse.json({
          items: [
            {
              id: crypto.randomUUID(),
              name: '/finance',
              members: 3,
              created_at: '2026-01-05T09:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
    )
    await openAt('/admin/groups', 'Groups')
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /\/finance/ })
    expect(within(row).getByText('3')).toBeVisible()
    await userEvent.click(within(row).getByRole('link', { name: 'Check the access of /finance' }))
    await screen.findByRole('heading', { level: 1, name: 'Check access' })
    expect(screen.getByRole('radio', { name: 'A member of these groups' })).toBeChecked()
    expect(screen.getByLabelText('Groups')).toHaveValue('/finance')
  })
})

describe('the audit log', () => {
  it('lists events with who, what and on what, and shows details as text', async () => {
    const asked: Record<string, string>[] = []
    server.use(
      http.get(api('/admin/audit'), ({ request }) => {
        asked.push(Object.fromEntries(new URL(request.url).searchParams))
        return HttpResponse.json({
          items: [
            event(),
            event({
              id: 40,
              actor_kind: 'recipient',
              actor_id: null,
              action: 'share.verification_failed',
              outcome: 'denied',
            }),
          ],
          total: 2,
          limit: 50,
          offset: 0,
        })
      }),
    )
    await openAt('/admin/audit', 'Audit log')
    const table = await screen.findByRole('table', { name: 'Audit events, newest first' })
    const created = within(table).getByRole('row', { name: /share\.created/ })
    expect(within(created).getByText('Done')).toBeVisible()
    expect(within(created).getByRole('link', { name: BOB.id.slice(0, 8) })).toHaveAttribute(
      'href',
      `/admin/users/${BOB.id}`,
    )
    expect(within(created).getByRole('link', { name: '3c1f2e4d' })).toHaveAttribute(
      'href',
      '/admin/files/3c1f2e4d-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    )
    expect(within(created).getByText('10.1.2.3')).toBeVisible()

    await userEvent.click(within(created).getByText('Details'))
    // The recorded details are shown as text: markup in them stays inert.
    expect(within(created).getByText(/"note": "<b>not markup<\/b>"/)).toBeVisible()
    expect(within(created).getByText('Request req-123')).toBeVisible()

    const refused = within(table).getByRole('row', { name: /share\.verification_failed/ })
    expect(within(refused).getByText('Refused')).toBeVisible()
    expect(within(refused).getByText('Outside recipient')).toBeVisible()
    expect(asked[0]).toEqual({ limit: '50', offset: '0' })
  })

  it('filters by the address, and starts from a user’s events', async () => {
    const asked: Record<string, string>[] = []
    server.use(
      http.get(api('/admin/audit'), ({ request }) => {
        asked.push(Object.fromEntries(new URL(request.url).searchParams))
        return HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 })
      }),
    )
    const { router } = await openAt(`/admin/audit?actor=${BOB.id}`, 'Audit log')
    expect(await screen.findByText('No events match.')).toBeVisible()
    expect(screen.getByLabelText('By (user ID)')).toHaveValue(BOB.id)
    expect(asked.at(-1)).toMatchObject({ actor_id: BOB.id })

    await userEvent.type(screen.getByLabelText('Action'), 'share.')
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Refused')
    await userEvent.type(screen.getByLabelText('From'), '2026-11-01T00:00')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await screen.findByText('No events match.')
    expect(router.state.location.search).toBe(
      `?action=share.&outcome=denied&actor=${BOB.id}&since=2026-11-01T00%3A00`,
    )
    expect(asked.at(-1)).toEqual({
      action: 'share.',
      outcome: 'denied',
      actor_id: BOB.id,
      since: new Date('2026-11-01T00:00').toISOString(),
      limit: '50',
      offset: '0',
    })

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(router.state.location.search).toBe('')
    expect(screen.getByLabelText('Action')).toHaveValue('')
  })

  it('marks a filter the API rejects', async () => {
    server.use(
      http.get(api('/admin/audit'), () =>
        HttpResponse.json(
          { detail: [{ loc: ['query', 'target_id'], msg: 'not a UUID', type: 'uuid_parsing' }] },
          { status: 422 },
        ),
      ),
    )
    await openAt('/admin/audit?target=nope', 'Audit log')
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the filters.')
    expect(screen.getByLabelText('On (ID)')).toHaveAttribute('aria-invalid', 'true')
  })

  it('checks the hash chain, intact or broken', async () => {
    let intact = true
    server.use(
      http.get(api('/admin/audit'), () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
      http.post(api('/admin/audit/verify'), ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        return HttpResponse.json(
          intact
            ? {
                ok: true,
                events: 1234,
                head_id: 1234,
                head_hash: 'h',
                first_broken_id: null,
                reason: null,
              }
            : {
                ok: false,
                events: 99,
                head_id: 98,
                head_hash: 'h',
                first_broken_id: 99,
                reason: 'hash mismatch',
              },
        )
      }),
    )
    await openAt('/admin/audit', 'Audit log')
    await userEvent.click(screen.getByRole('button', { name: 'Check the chain' }))
    expect(
      await screen.findByText('Intact: 1234 events checked, none changed or removed.'),
    ).toBeVisible()

    intact = false
    await userEvent.click(screen.getByRole('button', { name: 'Check the chain' }))
    expect(
      await screen.findByText(/Broken at event 99: .* The last good event is 98\./),
    ).toBeVisible()
    expect(screen.getByText('The API says: hash mismatch')).toBeVisible()
  })
})
