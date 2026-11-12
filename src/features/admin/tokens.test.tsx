import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { CALLBACK_PATH } from '@/features/auth/userManager'
import { ACCESS_TOKEN, fakeUserManager, renderApp, signedInUser } from '@/test/render'
import { alice, api, server } from '@/test/server'

import type { EnrollmentToken, Tpm } from './types'

const EK = `SHA256:${'Ab1+'.repeat(10)}xyz`

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

async function openAt(path: string, heading: string) {
  asAdmin()
  const fake = fakeUserManager(() => Promise.resolve(signedInUser(path)))
  const view = renderApp(CALLBACK_PATH, fake)
  await screen.findByRole('heading', { level: 1, name: heading })
  return view
}

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 50, offset: 0 })

function token(overrides: Partial<EnrollmentToken> = {}): EnrollmentToken {
  return {
    id: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    name: 'edge-3',
    identity: 'spiffe://nodes.vaultgate/node/edge-3',
    created_at: '2026-11-12T11:00:00Z',
    expires_at: '2026-11-12T12:00:00Z',
    used_at: null,
    revoked_at: null,
    state: 'usable',
    ...overrides,
  }
}

function tpm(overrides: Partial<Tpm> = {}): Tpm {
  return {
    id: '7c6b5a4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d',
    name: 'edge-4',
    identity: 'spiffe://nodes.vaultgate/node/edge-4',
    ek_fingerprint: EK,
    created_at: '2026-11-12T11:00:00Z',
    expires_at: '2026-11-19T11:00:00Z',
    used_at: null,
    revoked_at: null,
    state: 'usable',
    ...overrides,
  }
}

describe('enrollment tokens', () => {
  it('issues a token for a node name and shows it once', async () => {
    const user = userEvent.setup()
    const tokens: EnrollmentToken[] = []
    let sent: unknown
    server.use(
      http.get(api('/admin/nodes/tokens'), () => HttpResponse.json(page(tokens))),
      http.post(api('/admin/nodes/tokens'), async ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        sent = await request.json()
        tokens.push(token())
        return HttpResponse.json({ ...token(), token: 'vgt_secret_123' }, { status: 201 })
      }),
    )
    await openAt('/admin/tokens', 'Enrollment tokens')
    expect(await screen.findByText('No usable tokens.')).toBeVisible()

    await user.type(screen.getByLabelText('Node name'), 'Edge 3')
    await user.click(screen.getByRole('button', { name: 'Issue token' }))
    expect(screen.getByText(/A node name is lowercase letters/)).toBeVisible()
    expect(screen.getByLabelText('Node name')).toHaveAttribute('aria-invalid', 'true')
    expect(sent).toBeUndefined()

    await user.clear(screen.getByLabelText('Node name'))
    await user.type(screen.getByLabelText('Node name'), ' edge-3 ')
    await user.type(screen.getByLabelText('Valid for (minutes)'), '15')
    await user.click(screen.getByRole('button', { name: 'Issue token' }))

    const shown = await screen.findByLabelText('Enrollment token for edge-3')
    expect(shown).toHaveValue('vgt_secret_123')
    expect(sent).toEqual({ name: 'edge-3', ttl_seconds: 900 })
    expect(screen.getByText(/It is shown only now/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Copy Enrollment token for edge-3' }))
    expect(await navigator.clipboard.readText()).toBe('vgt_secret_123')

    const row = within(await screen.findByRole('table', { name: 'Enrollment tokens' })).getByRole(
      'row',
      { name: /edge-3/ },
    )
    expect(within(row).getByText('Usable')).toBeVisible()
  })

  it('uses the API’s default lifetime when none is given, and says when the name is taken', async () => {
    let sent: unknown
    server.use(
      http.get(api('/admin/nodes/tokens'), () => HttpResponse.json(page([]))),
      http.post(api('/admin/nodes/tokens'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ detail: 'A node of that name is enrolled' }, { status: 409 })
      }),
    )
    await openAt('/admin/tokens', 'Enrollment tokens')
    await userEvent.type(screen.getByLabelText('Node name'), 'edge-2')
    await userEvent.click(screen.getByRole('button', { name: 'Issue token' }))
    expect(await screen.findByText('A node of that name is already enrolled.')).toBeVisible()
    expect(sent).toEqual({ name: 'edge-2', ttl_seconds: null })
  })

  it('revokes an unused token after a confirmation, and shows used ones without', async () => {
    let tokens = [
      token(),
      token({
        id: crypto.randomUUID(),
        name: 'edge-5',
        state: 'used',
        used_at: '2026-11-12T11:30:00Z',
      }),
    ]
    let revoked = ''
    server.use(
      http.get(api('/admin/nodes/tokens'), () => HttpResponse.json(page(tokens))),
      http.post(api('/admin/nodes/tokens/:id/revoke'), ({ params }) => {
        revoked = String(params.id)
        tokens = tokens.map((t) => (t.id === revoked ? { ...t, state: 'revoked' } : t))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await openAt('/admin/tokens?show=all', 'Enrollment tokens')
    const table = await screen.findByRole('table', { name: 'Enrollment tokens' })
    const used = within(table).getByRole('row', { name: /edge-5/ })
    expect(within(used).getByText('Used')).toBeVisible()
    expect(within(used).queryByRole('button')).toBeNull()

    await userEvent.click(
      within(table).getByRole('button', { name: 'Revoke the token for edge-3' }),
    )
    expect(screen.getByText(/It can’t be used after this\./)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Revoke it' }))
    expect(await screen.findByText('The token for edge-3 no longer works.')).toBeVisible()
    expect(revoked).toBe(token().id)
    const row = within(table).getByRole('row', { name: /edge-3/ })
    expect(await within(row).findByText('Revoked')).toBeVisible()
  })
})

describe('TPM registrations', () => {
  it('registers a TPM by its endorsement key, checking both fields first', async () => {
    const tpms: Tpm[] = []
    let sent: unknown
    server.use(
      http.get(api('/admin/nodes/tpms'), () => HttpResponse.json(page(tpms))),
      http.post(api('/admin/nodes/tpms'), async ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        sent = await request.json()
        tpms.push(tpm())
        return HttpResponse.json(tpm(), { status: 201 })
      }),
    )
    await openAt('/admin/tpms', 'TPM registrations')
    await userEvent.type(screen.getByLabelText('Node name'), 'edge-4')
    await userEvent.type(screen.getByLabelText('Endorsement key fingerprint'), 'SHA256:short')
    await userEvent.click(screen.getByRole('button', { name: 'Register TPM' }))
    expect(screen.getByText(/An endorsement key fingerprint is SHA256:/)).toBeVisible()
    expect(screen.getByLabelText('Endorsement key fingerprint')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(sent).toBeUndefined()

    await userEvent.clear(screen.getByLabelText('Endorsement key fingerprint'))
    await userEvent.type(screen.getByLabelText('Endorsement key fingerprint'), ` ${EK} `)
    await userEvent.click(screen.getByRole('button', { name: 'Register TPM' }))
    expect(await screen.findByText(/The TPM is registered for edge-4, until/)).toBeVisible()
    expect(sent).toEqual({ name: 'edge-4', ek_fingerprint: EK })
    const row = within(await screen.findByRole('table', { name: 'TPM registrations' })).getByRole(
      'row',
      { name: /edge-4/ },
    )
    expect(within(row).getByText(EK)).toBeVisible()
  })

  it('says when the TPM is registered already', async () => {
    server.use(
      http.get(api('/admin/nodes/tpms'), () => HttpResponse.json(page([]))),
      http.post(api('/admin/nodes/tpms'), () =>
        HttpResponse.json({ detail: 'That TPM is registered already' }, { status: 409 }),
      ),
    )
    await openAt('/admin/tpms', 'TPM registrations')
    await userEvent.type(screen.getByLabelText('Node name'), 'edge-4')
    await userEvent.type(screen.getByLabelText('Endorsement key fingerprint'), EK)
    await userEvent.click(screen.getByRole('button', { name: 'Register TPM' }))
    expect(await screen.findByText(/That TPM is registered already/)).toBeVisible()
  })

  it('revokes a registration after a confirmation', async () => {
    let tpms = [tpm()]
    server.use(
      http.get(api('/admin/nodes/tpms'), () => HttpResponse.json(page(tpms))),
      http.post(api(`/admin/nodes/tpms/${tpm().id}/revoke`), () => {
        tpms = []
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await openAt('/admin/tpms', 'TPM registrations')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Revoke the TPM registration for edge-4' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Revoke it' }))
    expect(
      await screen.findByText('The TPM registration for edge-4 no longer works.'),
    ).toBeVisible()
    expect(await screen.findByText('No usable registrations.')).toBeVisible()
  })
})
