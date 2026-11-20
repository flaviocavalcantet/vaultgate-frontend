import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { CALLBACK_PATH } from '@/features/auth/userManager'
import { fakeUserManager, renderApp, signedInUser, testConfig } from '@/test/render'
import { api, server } from '@/test/server'

import type { ShareOut, SharedContents, SharedFile } from './types'

const GATEWAY = testConfig.gatewayUrl
const WORK = '9a1f3c2e-0000-4000-8000-000000000001'
const Q3 = '9a1f3c2e-0000-4000-8000-000000000002'
const A = '9a1f3c2e-0000-4000-8000-0000000000a1'
const B = '9a1f3c2e-0000-4000-8000-0000000000b1'
const SHARE = '9a1f3c2e-0000-4000-8000-0000000000s1'

/** The shared folder Work (a.txt, and Q3 holding b.txt), as a recipient sees it. */
function contents(folderId: string | null): SharedContents {
  const work = { id: WORK, name: 'Work' }
  const q3 = { id: Q3, name: 'Q3' }
  if (folderId === Q3) {
    return {
      folder: q3,
      path: [work, q3],
      folders: [],
      files: [{ id: B, name: 'b.txt', content_type: 'text/plain', size: 2048 }],
      truncated: false,
    }
  }
  return {
    folder: work,
    path: [work],
    folders: [q3],
    files: [{ id: A, name: 'a.txt', content_type: 'text/plain', size: 1024 }],
    truncated: false,
  }
}

function share(overrides: Partial<ShareOut> = {}): ShareOut {
  return {
    id: SHARE,
    file_id: null,
    folder_id: WORK,
    recipient_email: 'bob@example.test',
    recipient_kind: 'external',
    created_at: '2026-11-20T10:00:00Z',
    expires_at: '2026-11-27T10:00:00Z',
    max_downloads: 5,
    downloads: 0,
    revoked_at: null,
    state: 'active',
    ...overrides,
  }
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

async function openAt(path: string, heading: string | RegExp) {
  const fake = fakeUserManager(() => Promise.resolve(signedInUser(path)))
  renderApp(CALLBACK_PATH, fake)
  await screen.findByRole('heading', { level: 1, name: heading })
  return userEvent.setup()
}

describe('sharing a folder', () => {
  it('makes a link to a folder, lists its links and revokes one', async () => {
    const shares: ShareOut[] = []
    const asked: { method: string; path: string; body?: unknown }[] = []
    server.use(
      http.get(api(`/folders/${WORK}`), () =>
        HttpResponse.json({
          id: WORK,
          name: 'Work',
          parent_id: null,
          created_at: '2026-11-20T09:00:00Z',
          path: [{ id: WORK, name: 'Work' }],
        }),
      ),
      http.get(api(`/folders/${WORK}/shares`), () => HttpResponse.json(shares)),
      http.post(api(`/folders/${WORK}/shares`), async ({ request }) => {
        const body = await request.json()
        asked.push({ method: 'POST', path: `/folders/${WORK}/shares`, body })
        shares.push(share())
        return HttpResponse.json(
          { share: share(), url: 'https://api.test/x', token: 'tok-folder' },
          { status: 201 },
        )
      }),
      http.delete(api(`/folders/${WORK}/shares/${SHARE}`), () => {
        asked.push({ method: 'DELETE', path: `/folders/${WORK}/shares/${SHARE}` })
        shares[0] = share({ state: 'revoked', revoked_at: '2026-11-20T11:00:00Z' })
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = await openAt(`/files/in/${WORK}/sharing`, 'Share the folder Work')
    expect(screen.getByText(/shares everything in it, at every level/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to Work' })).toHaveAttribute(
      'href',
      `/files/in/${WORK}`,
    )

    await user.type(screen.getByLabelText('Recipient’s email address'), 'bob@example.test')
    await user.click(screen.getByRole('button', { name: 'Create link' }))
    const link = await screen.findByLabelText(/Link for bob@example\.test/)
    expect(link).toHaveValue(`${window.location.origin}/s#tok-folder`)
    expect(asked[0]).toEqual({
      method: 'POST',
      path: `/folders/${WORK}/shares`,
      body: {
        recipient_email: 'bob@example.test',
        recipient_kind: 'external',
        expires_in_days: null,
        max_downloads: null,
      },
    })

    await user.click(
      await screen.findByRole('button', { name: 'Revoke the link for bob@example.test' }),
    )
    expect(await screen.findByText('The link for bob@example.test no longer works.')).toBeVisible()
    expect(asked[1]).toEqual({ method: 'DELETE', path: `/folders/${WORK}/shares/${SHARE}` })
  })
})

function sharedFolder(): SharedFile {
  return {
    share_id: SHARE,
    kind: 'folder',
    file_id: null,
    folder_id: WORK,
    name: 'Work',
    content_type: null,
    size: null,
    shared_by: 'bob',
    expires_at: '2026-11-27T10:00:00Z',
    downloads_left: 3,
    available: true,
  }
}

describe('a folder shared with me', () => {
  it('opens from Shared with me, browses in and out, and downloads a file in it', async () => {
    const submitted = catchDownloads()
    const downloads: string[] = []
    server.use(
      http.get(api('/shared-with-me'), () => HttpResponse.json([sharedFolder()])),
      http.get(api(`/shared-with-me/${SHARE}/contents`), ({ request }) =>
        HttpResponse.json(contents(new URL(request.url).searchParams.get('folder_id'))),
      ),
      http.post(api(`/shared-with-me/${SHARE}/download`), ({ request }) => {
        downloads.push(new URL(request.url).search)
        return HttpResponse.json(
          { url: `${GATEWAY}/downloads/${B}`, token: 'intent-b', expires_at: '' },
          { status: 201 },
        )
      }),
    )
    const user = await openAt('/shared', 'Shared with me')
    const table = await screen.findByRole('table', { name: 'Files and folders shared with you' })
    const row = within(table).getByRole('row', { name: /Work/ })
    expect(within(row).getByText('Folder')).toBeVisible()
    await user.click(within(row).getByRole('link', { name: 'Open Work' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeVisible()
    expect(
      screen.getByText(
        /Shared by bob\. Works until .*, for 3 more downloads from anything in it\./,
      ),
    ).toBeVisible()
    expect(screen.getByText(/Only files that are ready to download are listed/)).toBeVisible()
    await user.click(await screen.findByRole('button', { name: 'Open folder Q3' }))
    const crumbs = screen.getByRole('navigation', { name: 'Shared folder path' })
    expect(await within(crumbs).findByText('Q3')).toHaveAttribute('aria-current', 'page')
    // Focus follows to the folder opened, not lost with the button pressed.
    expect(within(crumbs).getByText('Q3')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Download b.txt' }))
    expect(await screen.findByText('Your download of b.txt has started.')).toBeVisible()
    expect(downloads).toEqual([`?file_id=${B}`])
    expect(submitted).toEqual([{ action: `${GATEWAY}/downloads/${B}`, token: 'intent-b' }])

    await user.click(within(crumbs).getByRole('button', { name: 'Work' }))
    expect(await screen.findByRole('button', { name: 'Download a.txt' })).toBeVisible()
  })

  it('goes back to the top when a folder inside it is gone', async () => {
    let q3Gone = false
    server.use(
      http.get(api('/shared-with-me'), () => HttpResponse.json([sharedFolder()])),
      http.get(api(`/shared-with-me/${SHARE}/contents`), ({ request }) => {
        const folder = new URL(request.url).searchParams.get('folder_id')
        if (folder === Q3 && q3Gone) {
          return HttpResponse.json({ detail: 'Folder not found' }, { status: 404 })
        }
        return HttpResponse.json(contents(folder))
      }),
    )
    const user = await openAt(`/shared/${SHARE}`, 'Work')
    q3Gone = true
    await user.click(await screen.findByRole('button', { name: 'Open folder Q3' }))
    expect(
      await screen.findByText('This folder is no longer in the share: it was moved or deleted.'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Back to the shared folder' }))
    expect(await screen.findByRole('button', { name: 'Download a.txt' })).toBeVisible()
  })

  it('says so when the folder is no longer shared', async () => {
    server.use(
      http.get(api('/shared-with-me'), () => HttpResponse.json([])),
      http.get(api(`/shared-with-me/${SHARE}/contents`), () =>
        HttpResponse.json({ detail: 'Share is revoked' }, { status: 410 }),
      ),
    )
    await openAt(`/shared/${SHARE}`, 'A shared folder')
    expect(await screen.findByText('This folder is no longer shared with you.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to Shared with me' })).toHaveAttribute(
      'href',
      '/shared',
    )
  })
})

function recipientApi(bodies: Record<string, unknown[]>, grantGood = () => true) {
  const note = (key: string, body: unknown) => (bodies[key] ??= []).push(body)
  return [
    http.get(api('/shares/access'), () =>
      HttpResponse.json({
        kind: 'folder',
        recipient_kind: 'external',
        recipient_hint: 'c***@example.test',
        expires_at: '2026-11-27T10:00:00Z',
        downloads_left: 2,
      }),
    ),
    http.post(api('/shares/access/code'), () =>
      HttpResponse.json({ sent_to: 'c***@example.test', expires_in: 600 }, { status: 202 }),
    ),
    http.post(api('/shares/access/verify'), () =>
      HttpResponse.json({ grant: 'grant-1', expires_at: '2026-11-20T10:30:00Z' }),
    ),
    http.post(api('/shares/access/contents'), async ({ request }) => {
      const body = (await request.json()) as { folder_id: string | null }
      note('contents', body)
      if (!grantGood()) {
        return HttpResponse.json({ detail: 'Grant not valid; verify again' }, { status: 403 })
      }
      return HttpResponse.json(contents(body.folder_id))
    }),
    http.post(api('/shares/access/downloads'), async ({ request }) => {
      note('download', await request.json())
      return HttpResponse.json(
        { url: `${GATEWAY}/downloads/${A}`, token: 'intent-a', expires_at: '' },
        { status: 201 },
      )
    }),
  ]
}

describe('a folder link’s recipient', () => {
  const TOKEN = 'tok_FOLDER-1'

  async function verified() {
    const user = userEvent.setup()
    renderApp(`/s#${TOKEN}`)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'A folder shared with you' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Email me a code' }))
    await user.type(await screen.findByLabelText('Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    return user
  }

  it('browses the folder after the code, and downloads a file in it', async () => {
    const bodies: Record<string, unknown[]> = {}
    const submitted = catchDownloads()
    server.use(...recipientApi(bodies))
    const user = await verified()
    expect(
      await screen.findByText('Confirmed. You can open the folder and download its files now.'),
    ).toBeVisible()
    await user.click(await screen.findByRole('button', { name: 'Open folder Q3' }))
    expect(await screen.findByRole('button', { name: 'Download b.txt' })).toBeVisible()
    await user.click(
      within(screen.getByRole('navigation', { name: 'Shared folder path' })).getByRole('button', {
        name: 'Work',
      }),
    )
    await user.click(await screen.findByRole('button', { name: 'Download a.txt' }))
    expect(await screen.findByText('Your download has started.')).toBeVisible()
    expect(bodies.contents).toEqual([
      { token: TOKEN, grant: 'grant-1', folder_id: null },
      { token: TOKEN, grant: 'grant-1', folder_id: Q3 },
    ])
    expect(bodies.download).toEqual([{ token: TOKEN, grant: 'grant-1', file_id: A }])
    expect(submitted).toEqual([{ action: `${GATEWAY}/downloads/${A}`, token: 'intent-a' }])
  })

  it('asks for a new code when the confirmation has ended', async () => {
    let good = true
    server.use(...recipientApi({}, () => good))
    const user = await verified()
    expect(await screen.findByRole('button', { name: 'Open folder Q3' })).toBeVisible()
    good = false
    await user.click(screen.getByRole('button', { name: 'Open folder Q3' }))
    expect(
      await screen.findByText('Your confirmation ended. Ask for a new code to continue.'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Email me a code' }))
    await waitFor(() => expect(screen.getByLabelText('Code')).toBeVisible())
  })
})
