import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'

import { CALLBACK_PATH } from '@/features/auth/userManager'
import { ACCESS_TOKEN, renderApp, signedInUser, fakeUserManager, testConfig } from '@/test/render'
import { api, server } from '@/test/server'

import { formatBytes } from './format'
import { submitDownload } from './gateway'
import type { FileOut } from './types'
import { mediaType } from './useUploads'

const GATEWAY = testConfig.gatewayUrl

function file(overrides: Partial<FileOut> = {}): FileOut {
  return {
    id: crypto.randomUUID(),
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

/** /files answering `items`, after checking the token, as the API would. */
function filesAnswer(items: FileOut[], total = items.length) {
  return http.get(api('/files'), ({ request }) => {
    if (request.headers.get('Authorization') !== `Bearer ${ACCESS_TOKEN}`) {
      return HttpResponse.json({}, { status: 401 })
    }
    const url = new URL(request.url)
    return HttpResponse.json({
      items,
      total,
      limit: Number(url.searchParams.get('limit')),
      offset: Number(url.searchParams.get('offset')),
    })
  })
}

function allow(request: Request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '',
    'Access-Control-Allow-Methods': 'PUT',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

/**
 * The gateway as a browser sees it from this origin (vaultgate ADR 0017): it answers
 * the preflight before a cross-origin upload, and names the origin on the response, or
 * the browser hides the answer from the page.
 */
function gatewayUpload(path: string, answer: (request: Request) => Promise<Response> | Response) {
  return [
    http.options(
      `${GATEWAY}${path}`,
      ({ request }) => new HttpResponse(null, { status: 204, headers: allow(request) }),
    ),
    http.put(`${GATEWAY}${path}`, async ({ request }) => {
      const response = await answer(request)
      const headers = new Headers(response.headers)
      for (const [name, value] of Object.entries(allow(request))) headers.set(name, value)
      return new Response(response.body, { status: response.status, headers })
    }),
  ]
}

/** Signed in, at /files: the callback brings alice back to where she was going. */
async function openFiles() {
  const fake = fakeUserManager(() => Promise.resolve(signedInUser('/files')))
  const view = renderApp(CALLBACK_PATH, fake)
  await screen.findByRole('heading', { level: 1, name: 'Files' })
  return view
}

describe('the files page', () => {
  it('lists the files with their size, date and state', async () => {
    server.use(
      filesAnswer([
        file({ name: 'clean.pdf' }),
        file({
          name: 'ids.csv',
          downloadable: false,
          scan: {
            verdict: 'quarantined',
            findings: [
              { kind: 'br_cpf', count: 3 },
              { kind: 'email', count: 2 },
            ],
            reason: null,
            scanned_at: '2026-11-10T09:00:09Z',
            releases: [],
          },
        }),
        file({ name: 'big.zip', scan: null, size: null, uploaded_at: null, status: 'uploading' }),
      ]),
    )
    await openFiles()
    const table = await screen.findByRole('table', { name: 'Your files, newest first' })
    const row = (name: string) => within(table).getByRole('row', { name: new RegExp(name) })

    expect(within(row('clean.pdf')).getByText('Clean')).toBeVisible()
    expect(within(row('clean.pdf')).getByText('2.0 KB')).toBeVisible()
    expect(
      within(row('clean.pdf')).getByRole('button', { name: 'Download clean.pdf' }),
    ).toBeEnabled()

    expect(within(row('ids.csv')).getByText('Quarantined')).toBeVisible()
    expect(
      within(row('ids.csv')).getByText('Found 5 items of personal data (br_cpf, email)'),
    ).toBeVisible()
    expect(within(row('ids.csv')).queryByRole('button', { name: /Download/ })).toBeNull()

    expect(within(row('big.zip')).getByText('Uploading')).toBeVisible()
    expect(within(row('big.zip')).getByText('Not uploaded')).toBeVisible()
  })

  it('says so when there are no files', async () => {
    server.use(filesAnswer([]))
    await openFiles()
    expect(await screen.findByText('No files yet. Upload one to get started.')).toBeVisible()
  })

  it('pages through the files', async () => {
    const offsets: string[] = []
    server.use(
      http.get(api('/files'), ({ request }) => {
        const offset = new URL(request.url).searchParams.get('offset') ?? ''
        offsets.push(offset)
        const name = offset === '0' ? 'first.pdf' : 'later.pdf'
        return HttpResponse.json({ items: [file({ name })], total: 25, limit: 20, offset: 0 })
      }),
    )
    await openFiles()
    expect(await screen.findByText('Showing 1–20 of 25')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 21–25 of 25')).toBeVisible()
    expect(await screen.findByText('later.pdf')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(offsets).toContain('20')
  })

  it('offers to retry when the list cannot be loaded', async () => {
    let calls = 0
    server.use(
      http.get(api('/files'), () => {
        calls += 1
        return calls <= 2
          ? HttpResponse.json({}, { status: 503 })
          : HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 })
      }),
    )
    await openFiles()
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'could not be loaded',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No files yet. Upload one to get started.')).toBeVisible()
  })
})

describe('uploading', () => {
  it('registers the file with the API, sends it to the gateway with the intent, and refreshes', async () => {
    const registered: unknown[] = []
    let sent: { auth: string | null; body: string } | null = null
    let listed = 0
    server.use(
      http.get(api('/files'), () => {
        listed += 1
        return HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 })
      }),
      http.post(api('/files'), async ({ request }) => {
        registered.push(await request.json())
        return HttpResponse.json(
          {
            file: file({ status: 'pending' }),
            upload: { url: `${GATEWAY}/uploads/f1`, token: 'upload-intent', expires_at: '' },
          },
          { status: 201 },
        )
      }),
      ...gatewayUpload('/uploads/f1', async (request) => {
        sent = { auth: request.headers.get('Authorization'), body: await request.text() }
        return HttpResponse.json({ file_id: 'f1', size: 5, sha256: 'x' }, { status: 201 })
      }),
    )
    await openFiles()
    const before = listed
    const picked = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    await userEvent.upload(screen.getByLabelText('Upload files'), picked)

    expect(await screen.findByText('Uploaded. The scan runs next.')).toBeVisible()
    expect(registered).toEqual([{ name: 'notes.txt', size: 5, content_type: 'text/plain' }])
    // The intent token goes to the gateway, not the user's access token.
    expect(sent).toEqual({ auth: 'Bearer upload-intent', body: 'hello' })
    await waitFor(() => expect(listed).toBeGreaterThan(before))
  })

  it.each([
    [413, 'Too large to upload.'],
    [429, 'Too many uploads at once.'],
  ])('says why when the API refuses with %i', async (status, message) => {
    server.use(
      filesAnswer([]),
      http.post(api('/files'), () => HttpResponse.json({ detail: 'no' }, { status })),
    )
    await openFiles()
    await userEvent.upload(screen.getByLabelText('Upload files'), new File(['x'], 'a.bin'))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('says so when the gateway refuses the bytes, and lets the message go', async () => {
    server.use(
      filesAnswer([]),
      http.post(api('/files'), () =>
        HttpResponse.json(
          {
            file: file({ status: 'pending' }),
            upload: { url: `${GATEWAY}/uploads/f2`, token: 't', expires_at: '' },
          },
          { status: 201 },
        ),
      ),
      ...gatewayUpload('/uploads/f2', () => HttpResponse.json({}, { status: 403 })),
    )
    await openFiles()
    await userEvent.upload(screen.getByLabelText('Upload files'), new File(['x'], 'a.bin'))
    expect(await screen.findByRole('alert')).toHaveTextContent('The upload was refused.')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss a.bin' }))
    expect(screen.queryByText('a.bin')).toBeNull()
  })
})

describe('cancelling an upload', () => {
  it('stops sending and says so', async () => {
    server.use(
      filesAnswer([]),
      http.post(api('/files'), () =>
        HttpResponse.json(
          {
            file: file({ status: 'pending' }),
            upload: { url: `${GATEWAY}/uploads/f3`, token: 't', expires_at: '' },
          },
          { status: 201 },
        ),
      ),
      ...gatewayUpload('/uploads/f3', async () => {
        await delay('infinite')
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    await openFiles()
    await userEvent.upload(screen.getByLabelText('Upload files'), new File(['x'], 'slow.bin'))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel upload of slow.bin' }))
    expect(await screen.findByText('Cancelled')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Dismiss slow.bin' })).toBeVisible()
  })
})

describe('downloading', () => {
  it('asks for an intent and hands it to the browser as a form', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (
      this: HTMLFormElement,
    ) {
      submitted.push({
        action: this.action,
        method: this.method,
        fields: Object.fromEntries(new FormData(this)),
      })
    })
    const submitted: { action: string; method: string; fields: object }[] = []
    const report = file({ name: 'report.pdf' })
    server.use(
      filesAnswer([report]),
      http.post(api(`/files/${report.id}/download`), () =>
        HttpResponse.json(
          { url: `${GATEWAY}/downloads/${report.id}`, token: 'download-intent', expires_at: '' },
          { status: 201 },
        ),
      ),
    )
    await openFiles()
    await userEvent.click(await screen.findByRole('button', { name: 'Download report.pdf' }))
    expect(await screen.findByText('Your download of report.pdf has started.')).toBeVisible()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submitted).toEqual([
      {
        action: `${GATEWAY}/downloads/${report.id}`,
        method: 'post',
        fields: { token: 'download-intent' },
      },
    ])
    // The form is gone once submitted, token and all.
    expect(document.querySelector('form')).toBeNull()
  })

  it('says why when the API refuses the download', async () => {
    const report = file({ name: 'report.pdf' })
    server.use(
      filesAnswer([report]),
      http.post(api(`/files/${report.id}/download`), () =>
        HttpResponse.json({ detail: 'quarantined' }, { status: 409 }),
      ),
    )
    await openFiles()
    await userEvent.click(await screen.findByRole('button', { name: 'Download report.pdf' }))
    expect(await screen.findByText('report.pdf can’t be downloaded right now.')).toBeVisible()
  })
})

describe('keeping the list current', () => {
  it('asks again while a file is still being scanned, and stops once it is done', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let calls = 0
      server.use(
        http.get(api('/files'), () => {
          calls += 1
          const scanning = calls < 3
          return HttpResponse.json({
            items: [
              scanning
                ? file({
                    name: 'scan-me.pdf',
                    scan: {
                      verdict: 'pending',
                      findings: [],
                      reason: null,
                      scanned_at: null,
                      releases: [],
                    },
                  })
                : file({ name: 'scan-me.pdf' }),
            ],
            total: 1,
            limit: 20,
            offset: 0,
          })
        }),
      )
      await openFiles()
      expect(await screen.findByText('Scanning')).toBeVisible()
      await act(() => vi.advanceTimersByTimeAsync(3000))
      await act(() => vi.advanceTimersByTimeAsync(3000))
      expect(await screen.findByText('Clean')).toBeVisible()
      const settled = calls
      await act(() => vi.advanceTimersByTimeAsync(10000))
      expect(calls).toBe(settled)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('helpers', () => {
  it.each([
    [0, '0 B'],
    [1023, '1,023 B'],
    [1024, '1.0 KB'],
    [5 * 1024 ** 3, '5.0 GB'],
  ])('formats %i bytes as %s', (bytes, text) => {
    expect(formatBytes(bytes, 'en')).toBe(text)
  })

  it('sends the browser’s media type when the API accepts it, else the default', () => {
    expect(mediaType(new File([], 'a', { type: 'text/plain' }))).toBe('text/plain')
    expect(mediaType(new File([], 'a', { type: '' }))).toBe('application/octet-stream')
    expect(mediaType(new File([], 'a', { type: 'text/plain; charset=utf-8' }))).toBe(
      'application/octet-stream',
    )
  })

  it('removes the download form even if submitting throws', () => {
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() =>
      submitDownload({ url: `${GATEWAY}/downloads/x`, token: 't', expires_at: '' }),
    ).toThrow('blocked')
    expect(document.querySelector('form')).toBeNull()
  })
})
