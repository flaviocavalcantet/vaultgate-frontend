import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { CALLBACK_PATH } from '@/features/auth/userManager'
import { ACCESS_TOKEN, fakeUserManager, renderApp, signedInUser } from '@/test/render'
import { alice, api, server } from '@/test/server'

import type { Enrollment, Node } from './types'

const FINGERPRINT = 'SHA256:q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0x1c'

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

function enrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: '1e2d3c4b-5a69-4788-9a0b-1c2d3e4f5a6b',
    name: 'edge-1',
    identity: 'spiffe://nodes.vaultgate/node/edge-1',
    key_fingerprint: FINGERPRINT,
    status: 'pending',
    expires_at: '2026-11-12T12:00:00Z',
    method: 'request',
    client_id: null,
    client_ip: '203.0.113.7',
    created_at: '2026-11-12T11:00:00Z',
    decided_at: null,
    code_expires_at: null,
    ...overrides,
  }
}

function node(overrides: Partial<Node> = {}): Node {
  return {
    id: '6b5a4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d',
    name: 'edge-2',
    identity: 'spiffe://nodes.vaultgate/node/edge-2',
    status: 'active',
    key_fingerprint: FINGERPRINT,
    cert_serial: '4f:3a:9c',
    cert_expires_at: '2026-11-13T11:00:00Z',
    enrolled_at: '2026-11-12T11:00:00Z',
    renewed_at: null,
    revoked_at: null,
    ...overrides,
  }
}

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 50, offset: 0 })

describe('enrollment requests', () => {
  it('approves a request only with the fingerprint the node shows, and shows its code once', async () => {
    const user = userEvent.setup()
    let request = enrollment()
    const asked: (string | null)[] = []
    let sent: unknown
    server.use(
      http.get(api('/admin/nodes/enrollments'), ({ request: r }) => {
        asked.push(new URL(r.url).searchParams.get('status'))
        return HttpResponse.json(page([request]))
      }),
      http.post(api(`/admin/nodes/enrollments/${request.id}/approve`), async ({ request: r }) => {
        if (!signedIn(r)) return HttpResponse.json({}, { status: 401 })
        sent = await r.json()
        const { key_fingerprint: confirmed } = sent as { key_fingerprint: string }
        if (confirmed !== FINGERPRINT) {
          return HttpResponse.json(
            { detail: "That isn't the request's key fingerprint: not approved" },
            { status: 409 },
          )
        }
        request = enrollment({ status: 'approved', code_expires_at: '2026-11-12T11:15:00Z' })
        return HttpResponse.json({ code: 'K7Q2-M9XD', code_expires_at: '2026-11-12T11:15:00Z' })
      }),
    )
    await openAt('/admin/enrollments', 'Enrollment requests')
    const card = await screen.findByRole('article', { name: /edge-1/ })
    expect(within(card).getByText('Waiting for approval')).toBeVisible()
    expect(within(card).getByText('203.0.113.7')).toBeVisible()
    // While it waits, the request's own fingerprint isn't on the page to copy.
    expect(within(card).queryByText(FINGERPRINT)).toBeNull()
    expect(asked[0]).toBe('waiting')

    await user.click(within(card).getByRole('button', { name: 'Approve edge-1' }))
    const confirm = within(card).getByLabelText('Fingerprint the node shows')
    await user.type(confirm, 'SHA256:not-it')
    await user.click(within(card).getByRole('button', { name: 'Approve with this fingerprint' }))
    expect(
      await within(card).findByText(/Not approved: the fingerprint isn’t the request’s/),
    ).toBeVisible()

    await user.clear(confirm)
    await user.type(confirm, ` ${FINGERPRINT} `)
    await user.click(within(card).getByRole('button', { name: 'Approve with this fingerprint' }))
    const code = await within(card).findByLabelText('One-time code for edge-1')
    expect(code).toHaveValue('K7Q2-M9XD')
    expect(sent).toEqual({ key_fingerprint: FINGERPRINT })
    expect(within(card).getByText(/it is shown only now/)).toBeVisible()

    await user.click(within(card).getByRole('button', { name: 'Copy One-time code for edge-1' }))
    expect(await navigator.clipboard.readText()).toBe('K7Q2-M9XD')
    expect(await within(card).findByText('Approved, waiting for the node')).toBeVisible()
  })

  it('rejects a request after a confirmation', async () => {
    let waiting = [enrollment()]
    let rejected = 0
    server.use(
      http.get(api('/admin/nodes/enrollments'), () => HttpResponse.json(page(waiting))),
      http.post(api(`/admin/nodes/enrollments/${waiting[0]!.id}/reject`), ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        rejected += 1
        waiting = []
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await openAt('/admin/enrollments', 'Enrollment requests')
    const card = await screen.findByRole('article', { name: /edge-1/ })
    await userEvent.click(within(card).getByRole('button', { name: 'Reject edge-1' }))
    expect(within(card).getByText(/Reject the request for edge-1\?/)).toBeVisible()
    await userEvent.click(within(card).getByRole('button', { name: 'Keep it' }))
    expect(rejected).toBe(0)

    await userEvent.click(within(card).getByRole('button', { name: 'Reject edge-1' }))
    await userEvent.click(within(card).getByRole('button', { name: 'Reject it' }))
    expect(await screen.findByText('The request for edge-1 is rejected.')).toBeVisible()
    expect(await screen.findByText('No requests waiting.')).toBeVisible()
    expect(rejected).toBe(1)
  })

  it('shows every request on request, with the fingerprints of those decided', async () => {
    const asked: (string | null)[] = []
    server.use(
      http.get(api('/admin/nodes/enrollments'), ({ request }) => {
        const status = new URL(request.url).searchParams.get('status')
        asked.push(status)
        return HttpResponse.json(
          page(
            status === 'all'
              ? [
                  enrollment({ status: 'completed', decided_at: '2026-11-12T11:05:00Z' }),
                  enrollment({
                    id: crypto.randomUUID(),
                    name: 'edge-9',
                    status: 'rejected',
                    method: 'client',
                    client_id: 'node-edge-9',
                  }),
                ]
              : [],
          ),
        )
      }),
    )
    const { router } = await openAt('/admin/enrollments', 'Enrollment requests')
    expect(await screen.findByText('No requests waiting.')).toBeVisible()
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'All requests')
    const done = await screen.findByRole('article', { name: /edge-1/ })
    expect(within(done).getByText('Enrolled')).toBeVisible()
    expect(within(done).getByText(FINGERPRINT)).toBeVisible()
    expect(within(done).queryByRole('button')).toBeNull()
    const other = screen.getByRole('article', { name: /edge-9/ })
    expect(within(other).getByText('client (node-edge-9)')).toBeVisible()
    expect(router.state.location.search).toBe('?show=all')
    expect(asked).toEqual(['waiting', 'all'])
  })
})

describe('nodes', () => {
  it('lists the nodes with their certificates, and revokes one after a confirmation', async () => {
    let nodes = [node()]
    server.use(
      http.get(api('/admin/nodes'), () => HttpResponse.json(page(nodes))),
      http.post(api(`/admin/nodes/${nodes[0]!.id}/revoke`), ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        const revoked = node({ status: 'revoked', revoked_at: '2026-11-12T12:00:00Z' })
        nodes = []
        return HttpResponse.json(revoked)
      }),
    )
    await openAt('/admin/nodes', 'Nodes')
    const row = within(await screen.findByRole('table', { name: 'Nodes' })).getByRole('row', {
      name: /edge-2/,
    })
    expect(within(row).getByText('Active')).toBeVisible()
    expect(within(row).getByText('Serial 4f:3a:9c')).toBeVisible()
    expect(within(row).getByText(FINGERPRINT)).toBeVisible()

    await userEvent.click(within(row).getByRole('button', { name: 'Revoke edge-2' }))
    expect(within(row).getByText('Revoke edge-2? Its certificate stops working now.')).toBeVisible()
    await userEvent.click(within(row).getByRole('button', { name: 'Revoke it' }))
    expect(await screen.findByText('edge-2 is revoked.')).toBeVisible()
    expect(await screen.findByText('No nodes enrolled.')).toBeVisible()
  })

  it('says why a revocation is refused', async () => {
    server.use(
      http.get(api('/admin/nodes'), () => HttpResponse.json(page([node()]))),
      http.post(api(`/admin/nodes/${node().id}/revoke`), () =>
        HttpResponse.json({ detail: 'The CA is unavailable' }, { status: 503 }),
      ),
    )
    await openAt('/admin/nodes', 'Nodes')
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke edge-2' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revoke it' }))
    expect(
      await screen.findByText(/edge-2 could not be revoked\. The certificate authority/),
    ).toBeVisible()
    // Back to the row's own button, to try again.
    expect(screen.getByRole('button', { name: 'Revoke edge-2' })).toBeVisible()
  })

  it('shows revoked nodes, without a way to revoke them again', async () => {
    server.use(
      http.get(api('/admin/nodes'), ({ request }) =>
        HttpResponse.json(
          page(
            new URL(request.url).searchParams.get('status') === 'all'
              ? [node({ status: 'revoked', revoked_at: '2026-11-12T12:00:00Z' })]
              : [],
          ),
        ),
      ),
    )
    await openAt('/admin/nodes?show=all', 'Nodes')
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /edge-2/ })
    expect(within(row).getByText('Revoked')).toBeVisible()
    expect(within(row).queryByRole('button')).toBeNull()
    expect(screen.getByLabelText('Show')).toHaveValue('all')
  })
})
