import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { CALLBACK_PATH } from '@/features/auth/userManager'
import { ACCESS_TOKEN, fakeUserManager, renderApp, signedInUser } from '@/test/render'
import { alice, api, server } from '@/test/server'

import type { AdminFile } from './types'

const FILE_ID = '3c1f2e4d-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

function adminFile(overrides: Partial<AdminFile> = {}): AdminFile {
  return {
    id: FILE_ID,
    name: 'ids.csv',
    content_type: 'text/csv',
    declared_size: 1024,
    status: 'uploaded',
    size: 1024,
    sha256: 'b'.repeat(64),
    created_at: '2026-11-10T09:00:00Z',
    uploaded_at: '2026-11-10T09:00:05Z',
    owner_id: alice.id,
    owner_username: 'bob',
    released_by: {},
    scan: {
      verdict: 'quarantined',
      findings: [
        { kind: 'br_cpf', count: 3 },
        { kind: 'email', count: 1 },
      ],
      reason: null,
      scanned_at: '2026-11-10T09:00:09Z',
      releases: [],
    },
    downloadable: false,
    shareable: false,
    ...overrides,
  }
}

const signedIn = (request: Request) =>
  request.headers.get('Authorization') === `Bearer ${ACCESS_TOKEN}`

/** /me says alice is an administrator, as the API would for its admin groups. */
const asAdmin = () =>
  server.use(
    http.get(api('/me'), ({ request }) =>
      signedIn(request)
        ? HttpResponse.json({ ...alice, is_admin: true })
        : HttpResponse.json({}, { status: 401 }),
    ),
  )

async function openAt(path: string) {
  const fake = fakeUserManager(() => Promise.resolve(signedInUser(path)))
  return renderApp(CALLBACK_PATH, fake)
}

describe('the admin guard', () => {
  it('turns away a user the API doesn’t call an administrator, and offers no admin link', async () => {
    await openAt('/admin/files')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'For administrators only' }),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull()
  })

  it('lets an administrator in, from the main navigation', async () => {
    asAdmin()
    server.use(
      http.get(api('/admin/files'), () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
    )
    const { router } = await openAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Administration' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Files and scans' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/admin/files')
    expect(screen.getByRole('navigation', { name: 'Administration' })).toBeVisible()
  })
})

describe('files and scans', () => {
  it('lists the quarantined files first, and every file on request', async () => {
    asAdmin()
    const asked: (string | null)[] = []
    server.use(
      http.get(api('/admin/files'), ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        const verdict = new URL(request.url).searchParams.get('verdict')
        asked.push(verdict)
        const items =
          verdict === 'quarantined'
            ? [adminFile()]
            : [
                adminFile(),
                adminFile({
                  id: crypto.randomUUID(),
                  name: 'notes.txt',
                  owner_username: null,
                  scan: { ...adminFile().scan!, verdict: 'clean', findings: [] },
                }),
              ]
        return HttpResponse.json({ items, total: items.length, limit: 20, offset: 0 })
      }),
    )
    const { router } = await openAt('/admin/files')
    const table = await screen.findByRole('table', { name: 'Uploaded files, newest first' })
    const row = within(table).getByRole('row', { name: /ids\.csv/ })
    expect(within(row).getByText('bob')).toBeVisible()
    expect(within(row).getByText('Quarantined')).toBeVisible()
    expect(within(row).getByRole('link', { name: 'ids.csv' })).toHaveAttribute(
      'href',
      `/admin/files/${FILE_ID}`,
    )

    await userEvent.selectOptions(screen.getByLabelText('Show'), 'All files')
    const notes = await within(table).findByRole('row', { name: /notes\.txt/ })
    expect(within(notes).getByText('Clean')).toBeVisible()
    expect(within(notes).getByText('Unknown')).toBeVisible()
    expect(asked).toEqual(['quarantined', null])
    expect(router.state.location.search).toBe('?verdict=all')
  })

  it('says so when nothing matches', async () => {
    asAdmin()
    server.use(
      http.get(api('/admin/files'), () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
    )
    await openAt('/admin/files?verdict=unscannable')
    expect(await screen.findByText('No files here.')).toBeVisible()
    expect(screen.getByLabelText('Show')).toHaveValue('unscannable')
  })
})

describe('a file’s scan', () => {
  it('shows what was found, never the content, and releases the file for download', async () => {
    asAdmin()
    let current = adminFile()
    let sent: unknown
    server.use(
      http.get(api(`/admin/files/${FILE_ID}`), () => HttpResponse.json(current)),
      http.post(api(`/admin/files/${FILE_ID}/release`), async ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        sent = await request.json()
        current = adminFile({
          downloadable: true,
          released_by: { download: alice.id },
          scan: {
            ...current.scan!,
            releases: [
              {
                purpose: 'download',
                reason: 'Payroll export, expected',
                released_at: '2026-11-12T10:00:00Z',
              },
            ],
          },
        })
        return HttpResponse.json(current)
      }),
    )
    await openAt(`/admin/files/${FILE_ID}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'ids.csv' })).toBeVisible()
    expect(screen.getByText('br_cpf: 3 items')).toBeVisible()
    expect(screen.getByText('email: 1 item')).toBeVisible()
    expect(screen.getByText('neither download nor share it')).toBeVisible()

    const release = screen.getByRole('button', { name: 'Release' })
    expect(release).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Download by the owner' })).toBeChecked()
    await userEvent.type(screen.getByLabelText('Reason'), '  Payroll export, expected ')
    await userEvent.click(release)

    expect(await screen.findByText('Released: the owner can download it now.')).toBeVisible()
    expect(sent).toEqual({ purpose: 'download', reason: 'Payroll export, expected' })
    expect(screen.getByText(/For download, .*: “Payroll export, expected”/)).toBeVisible()
    expect(screen.getByText('download it')).toBeVisible()
    // Only sharing is left to release.
    expect(screen.queryByRole('radio', { name: 'Download by the owner' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Sharing' })).toBeChecked()
  })

  it('says why when the release is refused', async () => {
    asAdmin()
    server.use(
      http.get(api(`/admin/files/${FILE_ID}`), () => HttpResponse.json(adminFile())),
      http.post(api(`/admin/files/${FILE_ID}/release`), () =>
        HttpResponse.json({ detail: 'File is already released for download' }, { status: 409 }),
      ),
    )
    await openAt(`/admin/files/${FILE_ID}`)
    await userEvent.type(await screen.findByLabelText('Reason'), 'Checked')
    await userEvent.click(screen.getByRole('button', { name: 'Release' }))
    expect(await screen.findByText(/This file can’t be released for that/)).toBeVisible()
  })

  it('scans the file again after a confirmation, and waits for the new verdict', async () => {
    asAdmin()
    let current = adminFile()
    let rescans = 0
    server.use(
      http.get(api(`/admin/files/${FILE_ID}`), () => HttpResponse.json(current)),
      http.post(api(`/admin/files/${FILE_ID}/rescan`), () => {
        rescans += 1
        current = adminFile({
          scan: { verdict: 'pending', findings: [], reason: null, scanned_at: null, releases: [] },
        })
        return HttpResponse.json(current, { status: 202 })
      }),
    )
    await openAt(`/admin/files/${FILE_ID}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Scan again' }))
    expect(screen.getByText('Scan ids.csv again? Its releases end now.')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Keep it as it is' }))
    expect(rescans).toBe(0)

    await userEvent.click(screen.getByRole('button', { name: 'Scan again' }))
    await userEvent.click(screen.getByRole('button', { name: 'Scan again now' }))
    expect(await screen.findByText('The file is being scanned again.')).toBeVisible()
    expect(rescans).toBe(1)
    expect(screen.getByText('Scanning')).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Scan again' })).toBeDisabled())
    // Nothing to release until the new verdict.
    expect(screen.queryByRole('heading', { name: 'Release' })).toBeNull()
  })

  it('says so when the file doesn’t exist', async () => {
    asAdmin()
    server.use(
      http.get(api(`/admin/files/${FILE_ID}`), () =>
        HttpResponse.json({ detail: 'File not found' }, { status: 404 }),
      ),
    )
    await openAt(`/admin/files/${FILE_ID}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('This file doesn’t exist.')
    expect(screen.getByRole('link', { name: 'Back to files and scans' })).toBeVisible()
  })
})
