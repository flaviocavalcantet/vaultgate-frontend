import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import type { components } from '@/api/schema'
import { CALLBACK_PATH } from '@/features/auth/userManager'
import { ACCESS_TOKEN, fakeUserManager, renderApp, signedInUser, testConfig } from '@/test/render'
import { api, server } from '@/test/server'

import { shareLink, tokenFromHash } from './link'
import type { ShareOut, SharedFile } from './types'

const GATEWAY = testConfig.gatewayUrl
const FILE_ID = '0b7d4c6e-8a43-4f4e-9d55-3f0f0e1a2b3c'

type FileOut = components['schemas']['FileOut']

function file(overrides: Partial<FileOut> = {}): FileOut {
  return {
    id: FILE_ID,
    name: 'report.pdf',
    content_type: 'application/pdf',
    declared_size: 2048,
    status: 'uploaded',
    size: 2048,
    sha256: 'a'.repeat(64),
    created_at: '2026-11-10T09:00:00Z',
    uploaded_at: '2026-11-10T09:00:05Z',
    scan: {
      verdict: 'clean',
      findings: [],
      reason: null,
      scanned_at: '2026-11-10T09:00:09Z',
      releases: [],
    },
    downloadable: true,
    shareable: true,
    ...overrides,
  }
}

function share(overrides: Partial<ShareOut> = {}): ShareOut {
  return {
    id: crypto.randomUUID(),
    file_id: FILE_ID,
    recipient_email: 'bob@example.test',
    recipient_kind: 'external',
    created_at: '2026-11-10T10:00:00Z',
    expires_at: '2026-11-17T10:00:00Z',
    max_downloads: 3,
    downloads: 0,
    revoked_at: null,
    state: 'active',
    ...overrides,
  }
}

const signedIn = (request: Request) =>
  request.headers.get('Authorization') === `Bearer ${ACCESS_TOKEN}`

/** The API's owner routes for one file, holding its shares in `shares`. */
function ownerApi(theFile: FileOut, shares: ShareOut[]) {
  return [
    http.get(api(`/files/${FILE_ID}`), ({ request }) =>
      signedIn(request) ? HttpResponse.json(theFile) : HttpResponse.json({}, { status: 401 }),
    ),
    http.get(api(`/files/${FILE_ID}/shares`), ({ request }) =>
      signedIn(request) ? HttpResponse.json(shares) : HttpResponse.json({}, { status: 401 }),
    ),
  ]
}

/** Signed in, at `path`: the callback brings alice back to where she was going. */
async function openAt(path: string, heading: string | RegExp) {
  const fake = fakeUserManager(() => Promise.resolve(signedInUser(path)))
  const view = renderApp(CALLBACK_PATH, fake)
  await screen.findByRole('heading', { level: 1, name: heading })
  return view
}

/** The form a download is handed to the browser with (vaultgate ADR 0018). */
function catchDownloads() {
  const submitted: { action: string; token: string }[] = []
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (
    this: HTMLFormElement,
  ) {
    submitted.push({ action: this.action, token: new FormData(this).get('token') as string })
  })
  return submitted
}

describe('sharing a file', () => {
  it('goes from the files list to the file’s sharing page', async () => {
    server.use(
      http.get(api('/files'), () =>
        HttpResponse.json({ items: [file()], total: 1, limit: 20, offset: 0 }),
      ),
      ...ownerApi(file(), []),
    )
    await openAt('/files', 'Files')
    await userEvent.click(await screen.findByRole('link', { name: 'Share report.pdf' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Share report.pdf' })).toBeVisible()
    expect(await screen.findByText('No links yet.')).toBeVisible()
  })

  it('creates a link to this app’s recipient page, shows it once, and lists the share', async () => {
    const user = userEvent.setup()
    const shares: ShareOut[] = []
    let sent: unknown
    server.use(
      ...ownerApi(file(), shares),
      http.post(api(`/files/${FILE_ID}/shares`), async ({ request }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        sent = await request.json()
        const created = share({ recipient_email: 'carol@example.test', max_downloads: 2 })
        shares.unshift(created)
        return HttpResponse.json(
          {
            share: created,
            url: `${testConfig.apiUrl}/shares/access?token=tok_123`,
            token: 'tok_123',
          },
          { status: 201 },
        )
      }),
    )
    await openAt(`/files/${FILE_ID}/sharing`, 'Share report.pdf')

    await user.type(screen.getByLabelText('Recipient’s email address'), 'Carol@Example.test ')
    await user.type(screen.getByLabelText('Downloads allowed'), '2')
    await user.click(screen.getByRole('button', { name: 'Create link' }))

    const link = await screen.findByLabelText('Link for carol@example.test')
    expect(link).toHaveValue(`${window.location.origin}/s#tok_123`)
    expect(sent).toEqual({
      recipient_email: 'Carol@Example.test',
      recipient_kind: 'external',
      expires_in_days: null,
      max_downloads: 2,
    })
    // The form is cleared for the next link.
    expect(screen.getByLabelText('Recipient’s email address')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText('Copied.')).toBeVisible()
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/s#tok_123`)

    const table = await screen.findByRole('table', { name: 'Links to report.pdf, newest first' })
    const row = within(table).getByRole('row', { name: /carol@example\.test/ })
    expect(within(row).getByText('Active')).toBeVisible()
    expect(within(row).getByText('0 of 2')).toBeVisible()
  })

  it('shares with a VaultGate user', async () => {
    let sent: { recipient_kind?: string } = {}
    server.use(
      ...ownerApi(file(), []),
      http.post(api(`/files/${FILE_ID}/shares`), async ({ request }) => {
        sent = (await request.json()) as typeof sent
        return HttpResponse.json(
          { share: share({ recipient_kind: 'internal' }), url: '', token: 't' },
          { status: 201 },
        )
      }),
    )
    await openAt(`/files/${FILE_ID}/sharing`, 'Share report.pdf')
    await userEvent.type(screen.getByLabelText('Recipient’s email address'), 'bob@example.test')
    await userEvent.click(screen.getByRole('radio', { name: /A VaultGate user/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }))
    await screen.findByLabelText('Link for bob@example.test')
    expect(sent.recipient_kind).toBe('internal')
  })

  it('says why when the API refuses the share', async () => {
    server.use(
      ...ownerApi(file(), []),
      http.post(api(`/files/${FILE_ID}/shares`), () =>
        HttpResponse.json({ detail: 'Too many active shares' }, { status: 429 }),
      ),
    )
    await openAt(`/files/${FILE_ID}/sharing`, 'Share report.pdf')
    await userEvent.type(screen.getByLabelText('Recipient’s email address'), 'bob@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }))
    expect(
      await screen.findByText('This file has too many active links. Revoke some first.'),
    ).toBeVisible()
    expect(screen.queryByLabelText(/Link for/)).toBeNull()
  })

  it('offers no new link for a file its scan keeps from sharing, but still revokes', async () => {
    const shares = [
      share({ recipient_email: 'bob@example.test' }),
      share({ recipient_email: 'dan@example.test', state: 'expired' }),
    ]
    let revoked = ''
    server.use(
      ...ownerApi(file({ shareable: false }), shares),
      http.delete(api(`/files/${FILE_ID}/shares/:shareId`), ({ request, params }) => {
        if (!signedIn(request)) return HttpResponse.json({}, { status: 401 })
        revoked = String(params.shareId)
        const target = shares.find((s) => s.id === revoked)
        if (target) target.state = 'revoked'
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await openAt(`/files/${FILE_ID}/sharing`, 'Share report.pdf')
    expect(screen.getByText(/can’t be shared right now: its scan doesn’t allow it/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Create link' })).toBeNull()

    const table = await screen.findByRole('table')
    const expired = within(table).getByRole('row', { name: /dan@example\.test/ })
    expect(within(expired).getByText('Expired')).toBeVisible()
    expect(within(expired).queryByRole('button')).toBeNull()

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke the link for bob@example.test' }),
    )
    expect(await screen.findByText('The link for bob@example.test no longer works.')).toBeVisible()
    expect(revoked).toBe(shares[0]?.id)
    const bob = within(table).getByRole('row', { name: /bob@example\.test/ })
    await waitFor(() => expect(within(bob).getByText('Revoked')).toBeVisible())
  })

  it('says so when the file is not the user’s', async () => {
    server.use(
      http.get(api(`/files/${FILE_ID}`), () =>
        HttpResponse.json({ detail: 'File not found' }, { status: 404 }),
      ),
    )
    await openAt(`/files/${FILE_ID}/sharing`, 'Share a file')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This file doesn’t exist, or isn’t yours.',
    )
  })
})

function sharedFile(overrides: Partial<SharedFile> = {}): SharedFile {
  return {
    share_id: crypto.randomUUID(),
    file_id: crypto.randomUUID(),
    name: 'plan.docx',
    content_type: 'application/octet-stream',
    size: 4096,
    shared_by: 'bob',
    expires_at: '2026-11-17T10:00:00Z',
    downloads_left: 2,
    available: true,
    ...overrides,
  }
}

describe('shared with me', () => {
  it('lists the files shared with the user and downloads one through the gateway', async () => {
    const plan = sharedFile()
    const submitted = catchDownloads()
    server.use(
      http.get(api('/shared-with-me'), ({ request }) =>
        signedIn(request)
          ? HttpResponse.json([plan, sharedFile({ name: 'held.csv', available: false })])
          : HttpResponse.json({}, { status: 401 }),
      ),
      http.post(api(`/shared-with-me/${plan.share_id}/download`), ({ request }) =>
        signedIn(request)
          ? HttpResponse.json(
              {
                url: `${GATEWAY}/downloads/${plan.file_id}`,
                token: 'intent-1',
                expires_at: '2026-11-12T10:05:00Z',
              },
              { status: 201 },
            )
          : HttpResponse.json({}, { status: 401 }),
      ),
    )
    await openAt('/shared', 'Shared with me')
    expect(screen.getByRole('link', { name: 'Shared with me' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const table = await screen.findByRole('table', { name: 'Files shared with you' })
    const held = within(table).getByRole('row', { name: /held\.csv/ })
    expect(within(held).getByText('Not available right now')).toBeVisible()
    expect(within(held).queryByRole('button')).toBeNull()

    const row = within(table).getByRole('row', { name: /plan\.docx/ })
    expect(within(row).getByText('bob')).toBeVisible()
    await userEvent.click(within(row).getByRole('button', { name: 'Download plan.docx' }))
    expect(await screen.findByText('Your download of plan.docx has started.')).toBeVisible()
    expect(submitted).toEqual([
      { action: `${GATEWAY}/downloads/${plan.file_id}`, token: 'intent-1' },
    ])
  })

  it('says so when nothing is shared', async () => {
    server.use(http.get(api('/shared-with-me'), () => HttpResponse.json([])))
    await openAt('/shared', 'Shared with me')
    expect(await screen.findByText('Nothing is shared with you right now.')).toBeVisible()
  })

  it('says why when a download is refused', async () => {
    const plan = sharedFile()
    server.use(
      http.get(api('/shared-with-me'), () => HttpResponse.json([plan])),
      http.post(api(`/shared-with-me/${plan.share_id}/download`), () =>
        HttpResponse.json({ detail: 'Share is used' }, { status: 410 }),
      ),
    )
    await openAt('/shared', 'Shared with me')
    await userEvent.click(await screen.findByRole('button', { name: 'Download plan.docx' }))
    expect(await screen.findByText('plan.docx is no longer shared with you.')).toBeVisible()
  })
})

describe('a share link’s recipient', () => {
  const TOKEN = 'tok_ABC-123'
  const linkAnswer = (overrides: Partial<components['schemas']['AccessOut']> = {}) =>
    http.get(api('/shares/access'), ({ request }) => {
      if (new URL(request.url).searchParams.get('token') !== TOKEN) {
        return HttpResponse.json({ detail: 'Share not found' }, { status: 404 })
      }
      return HttpResponse.json({
        recipient_kind: 'external',
        recipient_hint: 'c***@example.test',
        expires_at: '2026-11-17T10:00:00Z',
        downloads_left: 2,
        ...overrides,
      })
    })

  it('sends a code, takes it, and downloads, with no account and the token out of the address', async () => {
    const bodies: Record<string, unknown> = {}
    const submitted = catchDownloads()
    server.use(
      linkAnswer(),
      http.post(api('/shares/access/code'), async ({ request }) => {
        expect(request.headers.has('Authorization')).toBe(false)
        bodies.code = await request.json()
        return HttpResponse.json({ sent_to: 'c***@example.test', expires_in: 600 }, { status: 202 })
      }),
      http.post(api('/shares/access/verify'), async ({ request }) => {
        const body = (await request.json()) as { code: string }
        bodies.verify = body
        return body.code === '123456'
          ? HttpResponse.json({ grant: 'grant-1', expires_at: '2026-11-12T10:30:00Z' })
          : HttpResponse.json({ detail: 'Wrong code; 4 tries left' }, { status: 403 })
      }),
      http.post(api('/shares/access/downloads'), async ({ request }) => {
        bodies.download = await request.json()
        return HttpResponse.json(
          { url: `${GATEWAY}/downloads/f1`, token: 'intent-9', expires_at: '' },
          { status: 201 },
        )
      }),
    )
    const { router } = renderApp(`/s#${TOKEN}`)
    expect(
      await screen.findByText(/For c\*\*\*@example\.test\. Works until .*, for 2 more downloads\./),
    ).toBeVisible()
    await waitFor(() => expect(router.state.location.hash).toBe(''))

    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    expect(
      await screen.findByText('We sent a code to c***@example.test. It works for a few minutes.'),
    ).toBeVisible()
    expect(bodies.code).toEqual({ token: TOKEN })

    const code = screen.getByLabelText('Code')
    expect(code).toHaveFocus()
    await userEvent.type(code, '654321')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      await screen.findByText('That code didn’t work. Check it, or ask for a new one.'),
    ).toBeVisible()

    await userEvent.clear(code)
    await userEvent.type(code, '123 456')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Confirmed. You can download the file now.')).toBeVisible()
    expect(bodies.verify).toEqual({ token: TOKEN, code: '123456' })

    await userEvent.click(screen.getByRole('button', { name: 'Download the file' }))
    expect(await screen.findByText('Your download has started.')).toBeVisible()
    expect(bodies.download).toEqual({ token: TOKEN, grant: 'grant-1' })
    expect(submitted).toEqual([{ action: `${GATEWAY}/downloads/f1`, token: 'intent-9' }])
  })

  it('checks the code’s form before asking, and takes a code already received', async () => {
    let verified = 0
    server.use(
      linkAnswer(),
      http.post(api('/shares/access/verify'), () => {
        verified += 1
        return HttpResponse.json({ grant: 'g', expires_at: '' })
      }),
    )
    renderApp(`/s#${TOKEN}`)
    await userEvent.click(await screen.findByRole('button', { name: 'I already have a code' }))
    await userEvent.type(screen.getByLabelText('Code'), '12ab')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Enter the 6 digits from the message.')).toBeVisible()
    expect(verified).toBe(0)
  })

  it('asks for a new code once the grant has ended', async () => {
    server.use(
      linkAnswer(),
      http.post(api('/shares/access/verify'), () =>
        HttpResponse.json({ grant: 'old', expires_at: '' }),
      ),
      http.post(api('/shares/access/downloads'), () =>
        HttpResponse.json({ detail: 'Grant not valid; verify again' }, { status: 403 }),
      ),
    )
    renderApp(`/s#${TOKEN}`)
    await userEvent.click(await screen.findByRole('button', { name: 'I already have a code' }))
    await userEvent.type(screen.getByLabelText('Code'), '111111')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Download the file' }))
    expect(
      await screen.findByText('Your confirmation ended. Ask for a new code to continue.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeVisible()
  })

  it('says when a code was just sent', async () => {
    server.use(
      linkAnswer(),
      http.post(api('/shares/access/code'), () =>
        HttpResponse.json({ detail: 'A code was just sent' }, { status: 429 }),
      ),
    )
    renderApp(`/s#${TOKEN}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Email me a code' }))
    expect(
      await screen.findByText(
        'A code was sent a moment ago. Wait a little before asking for another.',
      ),
    ).toBeVisible()
  })

  it('sends a VaultGate user to sign in and Shared with me', async () => {
    server.use(linkAnswer({ recipient_kind: 'internal' }))
    renderApp(`/s#${TOKEN}`)
    expect(
      await screen.findByText(/shared with a VaultGate user\. Sign in with that address/),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Go to Shared with me' })).toHaveAttribute(
      'href',
      '/shared',
    )
    expect(screen.queryByRole('button', { name: 'Email me a code' })).toBeNull()
  })

  it('says when the link no longer works, is wrong, or is incomplete', async () => {
    server.use(
      http.get(api('/shares/access'), () =>
        HttpResponse.json({ detail: 'Share is revoked' }, { status: 410 }),
      ),
    )
    const first = renderApp(`/s#${TOKEN}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer works/)
    first.unmount()

    server.use(linkAnswer())
    const second = renderApp('/s#not-the-token')
    expect(await screen.findByRole('alert')).toHaveTextContent('This link isn’t valid.')
    second.unmount()

    renderApp('/s')
    expect(await screen.findByRole('alert')).toHaveTextContent('This link is incomplete.')
  })
})

describe('share links', () => {
  it('put the token in the fragment and read it back', () => {
    const link = shareLink('https://vault.example.test', 'a-b_c')
    expect(link).toBe('https://vault.example.test/s#a-b_c')
    expect(tokenFromHash(new URL(link).hash)).toBe('a-b_c')
  })

  it('read nothing from an empty, malformed or oversized fragment', () => {
    expect(tokenFromHash('')).toBeNull()
    expect(tokenFromHash('#')).toBeNull()
    expect(tokenFromHash('#%E0%A4%A')).toBeNull()
    expect(tokenFromHash(`#${'x'.repeat(257)}`)).toBeNull()
  })
})
