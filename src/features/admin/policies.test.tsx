import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { CALLBACK_PATH } from '@/features/auth/userManager'
import { ACCESS_TOKEN, fakeUserManager, renderApp, signedInUser } from '@/test/render'
import { alice, api, server } from '@/test/server'

import { bodyOf, draftOf, emptyDraft, lines, weekday } from './policyDraft'
import type { Policy } from './types'

const POLICY_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

function policy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: POLICY_ID,
    name: 'finance office hours',
    description: '',
    effect: 'allow',
    actions: ['read', 'upload', 'download'],
    enabled: true,
    groups: ['/finance'],
    networks: ['10.0.0.0/8'],
    excluded_networks: [],
    days: [1, 2, 3, 4, 5],
    start_time: '08:00:00',
    end_time: '18:00:00',
    timezone: 'America/Sao_Paulo',
    created_at: '2026-11-01T09:00:00Z',
    updated_at: '2026-11-01T09:00:00Z',
    ...overrides,
  }
}

const signedIn = (request: Request) =>
  request.headers.get('Authorization') === `Bearer ${ACCESS_TOKEN}`

function asAdmin() {
  server.use(
    http.get(api('/me'), ({ request }) =>
      signedIn(request)
        ? HttpResponse.json({ ...alice, is_admin: true })
        : HttpResponse.json({}, { status: 401 }),
    ),
  )
}

function listAnswer(items: Policy[]) {
  return http.get(api('/admin/policies'), () =>
    HttpResponse.json({ items, total: items.length, limit: 50, offset: 0 }),
  )
}

async function openAt(path: string, heading: string) {
  asAdmin()
  const fake = fakeUserManager(() => Promise.resolve(signedInUser(path)))
  const view = renderApp(CALLBACK_PATH, fake)
  await screen.findByRole('heading', { level: 1, name: heading })
  return view
}

describe('the access policies', () => {
  it('lists each policy with its conditions in words', async () => {
    server.use(
      listAnswer([
        policy(),
        policy({
          id: crypto.randomUUID(),
          name: 'block guests',
          effect: 'deny',
          actions: ['share'],
          groups: [],
          networks: [],
          excluded_networks: ['192.168.0.0/16'],
          days: [],
          start_time: null,
          end_time: null,
          enabled: false,
        }),
        policy({
          id: crypto.randomUUID(),
          name: 'everyone reads',
          actions: ['read'],
          groups: [],
          networks: [],
          days: [],
          start_time: null,
          end_time: null,
        }),
      ]),
    )
    await openAt('/admin/policies', 'Access policies')
    const table = await screen.findByRole('table', { name: 'Access policies, by name' })

    const finance = within(table).getByRole('row', { name: /finance office hours/ })
    expect(within(finance).getByText('Allow')).toBeVisible()
    expect(within(finance).getByText('Read, Upload, Download')).toBeVisible()
    expect(within(finance).getByText('Groups: /finance')).toBeVisible()
    expect(within(finance).getByText('From: 10.0.0.0/8')).toBeVisible()
    expect(within(finance).getByText('On: Mon, Tue, Wed, Thu, Fri')).toBeVisible()
    expect(within(finance).getByText('Between 08:00 and 18:00 (America/Sao_Paulo)')).toBeVisible()
    expect(within(finance).getByRole('link', { name: 'finance office hours' })).toHaveAttribute(
      'href',
      `/admin/policies/${POLICY_ID}`,
    )

    const guests = within(table).getByRole('row', { name: /block guests/ })
    expect(within(guests).getByText('Deny')).toBeVisible()
    expect(within(guests).getByText('Not from: 192.168.0.0/16')).toBeVisible()
    expect(within(guests).getByText('Disabled')).toBeVisible()

    const everyone = within(table).getByRole('row', { name: /everyone reads/ })
    expect(within(everyone).getByText('Everyone, from anywhere, at any time')).toBeVisible()
  })

  it('warns that nothing is allowed without policies', async () => {
    server.use(listAnswer([]))
    await openAt('/admin/policies', 'Access policies')
    expect(await screen.findByText(/every file request is refused/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'New policy' })).toHaveAttribute(
      'href',
      '/admin/policies/new',
    )
  })
})

describe('a new policy', () => {
  it('sends the whole policy and opens it once created', async () => {
    let sent: unknown
    server.use(
      http.post(api('/admin/policies'), async ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        sent = await request.json()
        return HttpResponse.json(policy({ name: 'finance weekdays' }), { status: 201 })
      }),
      http.get(api(`/admin/policies/${POLICY_ID}`), () =>
        HttpResponse.json(policy({ name: 'finance weekdays' })),
      ),
    )
    const { router } = await openAt('/admin/policies/new', 'New access policy')

    await userEvent.type(screen.getByLabelText('Name'), ' finance weekdays ')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Read' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Download' }))
    await userEvent.type(screen.getByLabelText('Groups'), '/finance{Enter}{Enter} /audit ')
    await userEvent.type(screen.getByLabelText('Networks'), '10.0.0.0/8')
    for (const day of ['Friday', 'Monday']) {
      await userEvent.click(screen.getByRole('checkbox', { name: day }))
    }
    await userEvent.type(screen.getByLabelText('From'), '08:00')
    await userEvent.type(screen.getByLabelText('Until'), '18:00')
    await userEvent.clear(screen.getByLabelText('Time zone'))
    await userEvent.type(screen.getByLabelText('Time zone'), 'America/Sao_Paulo')
    await userEvent.click(screen.getByRole('button', { name: 'Create policy' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit finance weekdays' }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe(`/admin/policies/${POLICY_ID}`)
    expect(screen.getByText('Saved. It applies from the next request.')).toBeVisible()
    expect(sent).toEqual({
      name: 'finance weekdays',
      description: '',
      effect: 'allow',
      actions: ['read', 'download'],
      enabled: true,
      groups: ['/finance', '/audit'],
      networks: ['10.0.0.0/8'],
      excluded_networks: [],
      days: [1, 5],
      start_time: '08:00',
      end_time: '18:00',
      timezone: 'America/Sao_Paulo',
    })
  })

  it('names the fields the API rejects', async () => {
    server.use(
      http.post(api('/admin/policies'), () =>
        HttpResponse.json(
          {
            detail: [
              { loc: ['body', 'timezone'], msg: 'unknown time zone', type: 'value_error' },
              { loc: ['body', 'networks', 0], msg: 'not a network', type: 'value_error' },
            ],
          },
          { status: 422 },
        ),
      ),
    )
    await openAt('/admin/policies/new', 'New access policy')
    await userEvent.type(screen.getByLabelText('Name'), 'x')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Read' }))
    await userEvent.type(screen.getByLabelText('Networks'), 'not-a-network')
    await userEvent.clear(screen.getByLabelText('Time zone'))
    await userEvent.type(screen.getByLabelText('Time zone'), 'Mars/Olympus')
    await userEvent.click(screen.getByRole('button', { name: 'Create policy' }))

    expect(
      await screen.findByText(
        'Some of the policy isn’t accepted. Check the fields marked below. Check: time zone, networks.',
      ),
    ).toBeVisible()
    expect(screen.getByLabelText('Time zone')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Networks')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
  })

  it('says when the name is taken', async () => {
    server.use(
      http.post(api('/admin/policies'), () =>
        HttpResponse.json({ detail: 'A policy with this name already exists' }, { status: 409 }),
      ),
    )
    await openAt('/admin/policies/new', 'New access policy')
    await userEvent.type(screen.getByLabelText('Name'), 'finance office hours')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Read' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create policy' }))
    expect(await screen.findByText('A policy with this name already exists.')).toBeVisible()
  })

  it('asks for both times or neither before sending', async () => {
    let posted = 0
    server.use(
      http.post(api('/admin/policies'), () => {
        posted += 1
        return HttpResponse.json(policy(), { status: 201 })
      }),
    )
    await openAt('/admin/policies/new', 'New access policy')
    await userEvent.type(screen.getByLabelText('Name'), 'x')
    await userEvent.type(screen.getByLabelText('From'), '08:00')
    await userEvent.click(screen.getByRole('button', { name: 'Create policy' }))
    expect(
      await screen.findByText('Give both times or neither, and make them differ.'),
    ).toBeVisible()
    expect(screen.getByLabelText('Until')).toHaveAttribute('aria-invalid', 'true')
    expect(posted).toBe(0)
  })
})

describe('an existing policy', () => {
  it('opens with its settings, and replaces it whole', async () => {
    let sent: { enabled?: boolean; start_time?: string | null } = {}
    server.use(
      http.get(api(`/admin/policies/${POLICY_ID}`), () => HttpResponse.json(policy())),
      http.put(api(`/admin/policies/${POLICY_ID}`), async ({ request }) => {
        sent = (await request.json()) as typeof sent
        return HttpResponse.json(policy({ enabled: false, updated_at: '2026-11-12T10:00:00Z' }))
      }),
    )
    await openAt(`/admin/policies/${POLICY_ID}`, 'Edit finance office hours')
    expect(screen.getByLabelText('Name')).toHaveValue('finance office hours')
    expect(screen.getByLabelText('Groups')).toHaveValue('/finance')
    expect(screen.getByLabelText('From')).toHaveValue('08:00')
    expect(screen.getByRole('checkbox', { name: 'Monday' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sunday' })).not.toBeChecked()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save policy' }))
    expect(await screen.findByText('Saved. It applies from the next request.')).toBeVisible()
    expect(sent.enabled).toBe(false)
    expect(sent.start_time).toBe('08:00')
  })

  it('deletes it after a confirmation', async () => {
    let deleted = 0
    server.use(
      http.get(api(`/admin/policies/${POLICY_ID}`), () => HttpResponse.json(policy())),
      http.delete(api(`/admin/policies/${POLICY_ID}`), ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        deleted += 1
        return new HttpResponse(null, { status: 204 })
      }),
      listAnswer([]),
    )
    const { router } = await openAt(`/admin/policies/${POLICY_ID}`, 'Edit finance office hours')
    await userEvent.click(screen.getByRole('button', { name: 'Delete policy' }))
    expect(screen.getByText(/Delete finance office hours\?/)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(deleted).toBe(0)

    await userEvent.click(screen.getByRole('button', { name: 'Delete policy' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete it' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Access policies' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/admin/policies')
    expect(deleted).toBe(1)
  })

  it('says so when the policy doesn’t exist', async () => {
    server.use(
      http.get(api(`/admin/policies/${POLICY_ID}`), () =>
        HttpResponse.json({ detail: 'Policy not found' }, { status: 404 }),
      ),
    )
    await openAt(`/admin/policies/${POLICY_ID}`, 'An access policy')
    expect(await screen.findByRole('alert')).toHaveTextContent('This policy doesn’t exist.')
  })
})

describe('checking access', () => {
  it('asks how a request would be decided, and shows why', async () => {
    let sent: unknown
    server.use(
      http.post(api('/admin/policies/evaluate'), async ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        sent = await request.json()
        return HttpResponse.json({
          allowed: false,
          reason: 'denied',
          deny: ['block guests'],
          allow: ['finance office hours'],
          groups: ['/finance'],
          client_ip: '192.168.1.5',
          at: '2026-11-12T13:00:00Z',
        })
      }),
    )
    await openAt('/admin/evaluate', 'Check access')
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'Share')
    await userEvent.type(screen.getByLabelText('Groups'), '/finance')
    await userEvent.type(screen.getByLabelText('From the address'), ' 192.168.1.5 ')
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))

    const result = await screen.findByRole('region', { name: 'Result: Denied' })
    expect(within(result).getByText('A deny policy matches.')).toBeVisible()
    expect(within(result).getByText('block guests')).toBeVisible()
    expect(within(result).getByText('finance office hours')).toBeVisible()
    expect(sent).toEqual({
      action: 'share',
      client_ip: '192.168.1.5',
      at: null,
      groups: ['/finance'],
    })
  })

  it('asks for a user by ID, at a given time', async () => {
    let sent: { user_id?: string; at?: string; groups?: unknown } = {}
    server.use(
      http.post(api('/admin/policies/evaluate'), async ({ request }) => {
        sent = (await request.json()) as typeof sent
        return HttpResponse.json({ detail: 'User not found' }, { status: 404 })
      }),
    )
    await openAt('/admin/evaluate', 'Check access')
    await userEvent.click(screen.getByRole('radio', { name: 'A user, by ID' }))
    await userEvent.type(screen.getByLabelText('User ID'), alice.id)
    await userEvent.type(screen.getByLabelText('From the address'), '10.1.2.3')
    await userEvent.type(screen.getByLabelText('When'), '2026-11-13T09:30')
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText('There is no user with this ID.')).toBeVisible()
    expect(sent.user_id).toBe(alice.id)
    expect(sent.groups).toBeUndefined()
    expect(sent.at).toBe(new Date('2026-11-13T09:30').toISOString())
  })

  it('marks an address the API rejects', async () => {
    server.use(
      http.post(api('/admin/policies/evaluate'), () =>
        HttpResponse.json(
          {
            detail: [{ loc: ['body', 'client_ip'], msg: 'not an address', type: 'ip_any_address' }],
          },
          { status: 422 },
        ),
      ),
    )
    await openAt('/admin/evaluate', 'Check access')
    await userEvent.type(screen.getByLabelText('From the address'), 'nowhere')
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText('Check the request. Check: address.')).toBeVisible()
    await waitFor(() =>
      expect(screen.getByLabelText('From the address')).toHaveAttribute('aria-invalid', 'true'),
    )
  })
})

describe('policy drafts', () => {
  it('turn the form’s text into the API’s lists, and back', () => {
    const draft = draftOf(policy())
    expect(draft.startTime).toBe('08:00')
    expect(draft.groups).toBe('/finance')
    const body = bodyOf({ ...draft, days: [5, 1, 3] })
    expect(body.days).toEqual([1, 3, 5])
    expect(body.groups).toEqual(['/finance'])
    expect(bodyOf({ ...emptyDraft, timezone: '  ' })).toMatchObject({
      start_time: null,
      end_time: null,
      timezone: 'UTC',
      groups: [],
    })
    expect(lines(' a \n\n b\n')).toEqual(['a', 'b'])
  })

  it('name the days as the API counts them, Monday first', () => {
    expect(weekday(1, 'en')).toBe('Monday')
    expect(weekday(7, 'en', 'short')).toBe('Sun')
  })
})
