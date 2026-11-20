import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, type HttpHandler, HttpResponse } from 'msw'

import { CALLBACK_PATH } from '@/features/auth/userManager'
import { renderApp, signedInUser, fakeUserManager } from '@/test/render'
import { api, server } from '@/test/server'

import type { FileOut, FolderOut } from './types'

const NOW = '2026-11-20T09:00:00Z'

const clash = (name: string) =>
  HttpResponse.json(
    { detail: `Something named “${name}” is already here; choose another name` },
    { status: 409 },
  )
const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 500, offset: 0 })

/**
 * The folder API as vaultgate M12.6 answers it, in memory: names unique in a folder
 * (any case, files and folders together), no folder into itself, everything in a
 * deleted folder deleted.
 */
class FakeVault {
  folders: FolderOut[] = []
  files: FileOut[] = []
  requests: { method: string; path: string; body?: unknown }[] = []

  folder(name: string, parent: FolderOut | null = null): FolderOut {
    const made = { id: crypto.randomUUID(), name, parent_id: parent?.id ?? null, created_at: NOW }
    this.folders.push(made)
    return made
  }

  file(name: string, folder: FolderOut | null = null): FileOut {
    const made: FileOut = {
      id: crypto.randomUUID(),
      name,
      folder_id: folder?.id ?? null,
      content_type: 'text/plain',
      declared_size: 1024,
      status: 'uploaded',
      size: 1024,
      sha256: 'a'.repeat(64),
      created_at: NOW,
      uploaded_at: NOW,
      scan: { verdict: 'clean', findings: [], reason: null, scanned_at: NOW, releases: [] },
      downloadable: true,
      shareable: true,
    }
    this.files.push(made)
    return made
  }

  path(id: string): FolderOut[] {
    const chain: FolderOut[] = []
    let at = this.folders.find((f) => f.id === id)
    while (at) {
      chain.unshift(at)
      at = this.folders.find((f) => f.id === at!.parent_id)
    }
    return chain
  }

  below(id: string): string[] {
    const children = this.folders.filter((f) => f.parent_id === id).map((f) => f.id)
    return [id, ...children.flatMap((c) => this.below(c))]
  }

  taken(parent: string | null, name: string, keep?: string) {
    const lower = name.toLowerCase()
    return (
      this.folders.some(
        (f) => f.parent_id === parent && f.id !== keep && f.name.toLowerCase() === lower,
      ) ||
      this.files.some(
        (f) => f.folder_id === parent && f.id !== keep && f.name.toLowerCase() === lower,
      )
    )
  }

  handlers() {
    const record = async (request: Request) => {
      const url = new URL(request.url)
      const body =
        request.method === 'GET' || request.method === 'DELETE'
          ? undefined
          : await request.clone().json()
      this.requests.push({ method: request.method, path: url.pathname + url.search, body })
    }
    return [
      http.get(api('/folders'), ({ request }) => {
        const parent = new URL(request.url).searchParams.get('parent_id')
        return HttpResponse.json(page(this.folders.filter((f) => f.parent_id === parent)))
      }),
      http.get(api('/folders/:id'), ({ params }) => {
        const found = this.folders.find((f) => f.id === params.id)
        if (!found) return HttpResponse.json({ detail: 'Folder not found' }, { status: 404 })
        return HttpResponse.json({
          ...found,
          path: this.path(found.id).map(({ id, name }) => ({ id, name })),
        })
      }),
      http.get(api('/folders/:id/totals'), ({ params }) => {
        const ids = this.below(String(params.id))
        const inside = this.files.filter((f) => f.folder_id && ids.includes(f.folder_id))
        return HttpResponse.json({
          folders: ids.length - 1,
          files: inside.length,
          bytes: inside.reduce((sum, f) => sum + (f.size ?? 0), 0),
        })
      }),
      http.post(api('/folders'), async ({ request }) => {
        await record(request)
        const { name, parent_id } = (await request.json()) as {
          name: string
          parent_id: string | null
        }
        if (this.taken(parent_id, name)) return clash(name)
        const parent = this.folders.find((f) => f.id === parent_id) ?? null
        return HttpResponse.json(this.folder(name, parent), { status: 201 })
      }),
      http.patch(api('/folders/:id'), async ({ request, params }) => {
        await record(request)
        const found = this.folders.find((f) => f.id === params.id)!
        const body = (await request.json()) as { name?: string; parent_id?: string | null }
        const parent = 'parent_id' in body ? (body.parent_id ?? null) : found.parent_id
        if (parent && this.below(found.id).includes(parent)) {
          return HttpResponse.json(
            { detail: "A folder can't be moved into itself" },
            { status: 409 },
          )
        }
        const name = body.name ?? found.name
        if (this.taken(parent, name, found.id)) return clash(name)
        Object.assign(found, { name, parent_id: parent })
        return HttpResponse.json(found)
      }),
      http.delete(api('/folders/:id'), async ({ request, params }) => {
        await record(request)
        const ids = this.below(String(params.id))
        this.folders = this.folders.filter((f) => !ids.includes(f.id))
        this.files = this.files.filter((f) => !f.folder_id || !ids.includes(f.folder_id))
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(api('/files'), ({ request }) => {
        const url = new URL(request.url)
        const folder = url.searchParams.get('folder_id')
        const limit = Number(url.searchParams.get('limit'))
        const offset = Number(url.searchParams.get('offset'))
        const all = this.files.filter((f) => f.folder_id === folder)
        return HttpResponse.json({
          items: all.slice(offset, offset + limit),
          total: all.length,
          limit,
          offset,
        })
      }),
      http.patch(api('/files/:id'), async ({ request, params }) => {
        await record(request)
        const found = this.files.find((f) => f.id === params.id)!
        const body = (await request.json()) as { name?: string; folder_id?: string | null }
        const folder = 'folder_id' in body ? (body.folder_id ?? null) : found.folder_id
        const name = body.name ?? found.name
        if (this.taken(folder, name, found.id)) return clash(name)
        Object.assign(found, { name, folder_id: folder })
        return HttpResponse.json(found)
      }),
      http.delete(api('/files/:id'), async ({ request, params }) => {
        await record(request)
        this.files = this.files.filter((f) => f.id !== params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    ]
  }
}

async function open(vault: FakeVault, path = '/files', ...first: HttpHandler[]) {
  // Handlers given first answer before the fake's.
  server.use(...first, ...vault.handlers())
  const fake = fakeUserManager(() => Promise.resolve(signedInUser(path)))
  renderApp(CALLBACK_PATH, fake)
  return userEvent.setup()
}

const table = () => screen.findByRole('table', { name: 'Your files, newest first' })
const row = async (name: string) =>
  within(await table()).findByRole('row', { name: new RegExp(name) })

describe('folders', () => {
  it('lists folders before files and opens one, with its path', async () => {
    const vault = new FakeVault()
    const work = vault.folder('Work')
    const q3 = vault.folder('Q3', work)
    vault.file('notes.txt')
    vault.file('plan.txt', work)
    const user = await open(vault)

    const rows = within(await table()).getAllByRole('row')
    expect(rows[1]).toHaveAccessibleName(/Work/)
    expect(rows[2]).toHaveAccessibleName(/notes\.txt/)
    expect(within(rows[1]!).getByText('Folder')).toBeVisible()
    expect(within(rows[1]!).getByRole('link', { name: 'Share Work' })).toHaveAttribute(
      'href',
      `/files/in/${work.id}/sharing`,
    )

    await user.click(screen.getByRole('link', { name: 'Open folder Work' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeVisible()
    const crumbs = screen.getByRole('navigation', { name: 'Folder path' })
    expect(within(crumbs).getByRole('link', { name: 'My files' })).toHaveAttribute('href', '/files')
    expect(within(crumbs).getByText('Work')).toHaveAttribute('aria-current', 'page')
    expect(await row('plan.txt')).toBeVisible()
    expect(await row('Q3')).toBeVisible()
    expect(within(await table()).queryByRole('row', { name: /notes\.txt/ })).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Open folder Q3' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Q3' })).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: 'Folder path' })).getByRole('link', {
        name: 'Work',
      }),
    ).toHaveAttribute('href', `/files/in/${work.id}`)
    expect(
      screen.getByText('This folder is empty. Upload files or make a folder in it.'),
    ).toBeVisible()
    void q3
  })

  it('says so for a folder that isn’t there', async () => {
    await open(new FakeVault(), `/files/in/${crypto.randomUUID()}`)
    expect(await screen.findByText('This folder doesn’t exist, or isn’t yours.')).toBeVisible()
  })

  it('says when a folder can’t be loaded, and tries again', async () => {
    const vault = new FakeVault()
    const work = vault.folder('Work')
    let down = true
    const user = await open(
      vault,
      `/files/in/${work.id}`,
      http.get(api('/folders/:id'), () =>
        down ? HttpResponse.json({ detail: 'oops' }, { status: 500 }) : undefined,
      ),
    )
    expect(
      await screen.findByText('The folder could not be loaded. Try again in a moment.', undefined, {
        timeout: 3000,
      }),
    ).toBeVisible()
    down = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeVisible()
  })

  it('says when the folders can’t be listed, and tries both again', async () => {
    const vault = new FakeVault()
    vault.folder('Work')
    vault.file('notes.txt')
    let down = true
    const user = await open(
      vault,
      '/files',
      http.get(api('/folders'), () =>
        down ? HttpResponse.json({ detail: 'oops' }, { status: 500 }) : undefined,
      ),
    )
    expect(
      await screen.findByText('Your files could not be loaded. Try again in a moment.', undefined, {
        timeout: 3000,
      }),
    ).toBeVisible()
    down = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await row('Work')).toBeVisible()
    expect(await row('notes.txt')).toBeVisible()
  })

  it('gives focus back when a panel closes', async () => {
    const vault = new FakeVault()
    vault.file('notes.txt')
    const user = await open(vault)
    const rename = await screen.findByRole('button', { name: 'Rename notes.txt' })
    await user.click(rename)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(rename).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Delete notes.txt' }))
    const panel = screen.getByRole('region', { name: 'Delete notes.txt' })
    await user.click(within(panel).getByRole('button', { name: 'Delete notes.txt' }))
    await screen.findByText('notes.txt deleted.')
    // Its row is gone: focus goes to New folder.
    expect(screen.getByRole('button', { name: 'New folder' })).toHaveFocus()
  })

  it('creates a folder where it is, and says when the name is taken', async () => {
    const vault = new FakeVault()
    const work = vault.folder('Work')
    vault.file('Drafts', work)
    const user = await open(vault, `/files/in/${work.id}`)
    await screen.findByRole('heading', { level: 1, name: 'Work' })

    await user.click(screen.getByRole('button', { name: 'New folder' }))
    const name = screen.getByLabelText('Folder name')
    expect(name).toHaveFocus()
    await user.type(name, 'drafts')
    await user.click(screen.getByRole('button', { name: 'Create folder' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something with this name is already there. Choose another name.',
    )

    await user.clear(name)
    await user.type(name, 'Contracts')
    await user.click(screen.getByRole('button', { name: 'Create folder' }))
    expect(await screen.findByText('Folder Contracts created.')).toBeVisible()
    expect(await row('Contracts')).toBeVisible()
    expect(vault.requests.at(-1)).toEqual({
      method: 'POST',
      path: '/folders',
      body: { name: 'Contracts', parent_id: work.id },
    })
  })

  it('renames a file', async () => {
    const vault = new FakeVault()
    const notes = vault.file('notes.txt')
    const user = await open(vault)
    await user.click(await screen.findByRole('button', { name: 'Rename notes.txt' }))
    const field = screen.getByLabelText('New name')
    expect(field).toHaveValue('notes.txt')
    await user.clear(field)
    await user.type(field, 'minutes.txt')
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    expect(await screen.findByText('notes.txt renamed to minutes.txt.')).toBeVisible()
    expect(await row('minutes.txt')).toBeVisible()
    expect(vault.requests).toEqual([
      { method: 'PATCH', path: `/files/${notes.id}`, body: { name: 'minutes.txt' } },
    ])
  })

  it('moves a file by browsing to a folder', async () => {
    const vault = new FakeVault()
    const work = vault.folder('Work')
    const q3 = vault.folder('Q3', work)
    const notes = vault.file('notes.txt')
    const user = await open(vault)

    await user.click(await screen.findByRole('button', { name: 'Move notes.txt' }))
    const panel = screen.getByRole('region', { name: 'Move notes.txt' })
    // Where it already is: nothing to do.
    expect(within(panel).getByRole('button', { name: 'Move to My files' })).toBeDisabled()
    await user.click(await within(panel).findByRole('button', { name: 'Open Work' }))
    await user.click(await within(panel).findByRole('button', { name: 'Open Q3' }))
    await user.click(await within(panel).findByRole('button', { name: 'Move to Q3' }))
    expect(await screen.findByText('notes.txt moved to Q3.')).toBeVisible()
    expect(vault.requests).toEqual([
      { method: 'PATCH', path: `/files/${notes.id}`, body: { folder_id: q3.id } },
    ])
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).queryByRole('row', { name: /notes\.txt/ }),
      ).toBeNull(),
    )
    void work
  })

  it('moves a folder, never into itself, and back to the top level', async () => {
    const vault = new FakeVault()
    const work = vault.folder('Work')
    const old = vault.folder('Old', work)
    const user = await open(vault, `/files/in/${work.id}`)

    await user.click(await screen.findByRole('button', { name: 'Move Old' }))
    const panel = screen.getByRole('region', { name: 'Move Old' })
    expect(await within(panel).findByText('In Work')).toBeVisible()
    // Old itself is not offered as a place to go.
    expect(within(panel).queryByRole('button', { name: 'Open Old' })).toBeNull()
    await user.click(within(panel).getByRole('button', { name: 'Up one folder' }))
    expect(await within(panel).findByText('In My files')).toBeVisible()
    await user.click(within(panel).getByRole('button', { name: 'Move to My files' }))
    expect(await screen.findByText('Old moved to My files.')).toBeVisible()
    expect(vault.requests).toEqual([
      { method: 'PATCH', path: `/folders/${old.id}`, body: { parent_id: null } },
    ])
  })

  it('deletes a file after a confirmation', async () => {
    const vault = new FakeVault()
    const notes = vault.file('notes.txt')
    const user = await open(vault)
    await user.click(await screen.findByRole('button', { name: 'Delete notes.txt' }))
    const panel = screen.getByRole('region', { name: 'Delete notes.txt' })
    expect(within(panel).getByText(/can’t be recovered/)).toBeVisible()
    await user.click(within(panel).getByRole('button', { name: 'Delete notes.txt' }))
    expect(await screen.findByText('notes.txt deleted.')).toBeVisible()
    expect(vault.requests).toEqual([{ method: 'DELETE', path: `/files/${notes.id}` }])
  })

  it('deletes a folder only once its contents are shown and its name typed', async () => {
    const vault = new FakeVault()
    const work = vault.folder('Work')
    const q3 = vault.folder('Q3', work)
    vault.file('a.txt', work)
    vault.file('b.txt', q3)
    vault.file('kept.txt')
    const user = await open(vault)

    await user.click(await screen.findByRole('button', { name: 'Delete Work' }))
    const panel = screen.getByRole('region', { name: 'Delete Work' })
    expect(await within(panel).findByText('It holds 1 folder and 2 files (2.0 KB).')).toBeVisible()
    const confirm = within(panel).getByRole('button', { name: 'Delete Work' })
    expect(confirm).toBeDisabled()
    await user.type(within(panel).getByLabelText('Type Work to confirm'), 'work')
    expect(confirm).toBeDisabled() // the exact name
    await user.clear(within(panel).getByLabelText('Type Work to confirm'))
    await user.type(within(panel).getByLabelText('Type Work to confirm'), 'Work')
    await user.click(confirm)
    expect(await screen.findByText('Work deleted.')).toBeVisible()
    expect(vault.requests).toEqual([{ method: 'DELETE', path: `/folders/${work.id}` }])
    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByRole('row', { name: /Work/ })).toBeNull(),
    )
    expect(await row('kept.txt')).toBeVisible()
  })

  it('steps back a page when the last file on the last page goes', async () => {
    const vault = new FakeVault()
    for (let n = 0; n < 21; n += 1) vault.file(`file-${String(n).padStart(2, '0')}.txt`)
    const user = await open(vault)
    await user.click(await screen.findByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 21–21 of 21')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Delete file-20.txt' }))
    const panel = screen.getByRole('region', { name: 'Delete file-20.txt' })
    await user.click(within(panel).getByRole('button', { name: 'Delete file-20.txt' }))
    expect(await screen.findByText('Showing 1–20 of 20')).toBeVisible()
    expect(screen.queryByText(/is empty/)).toBeNull()
  })

  it('uploads into the folder it is in', async () => {
    const vault = new FakeVault()
    const work = vault.folder('Work')
    let registered: unknown
    server.use(
      http.post(api('/files'), async ({ request }) => {
        registered = await request.json()
        return HttpResponse.json({ detail: 'Something named “x” is already here' }, { status: 409 })
      }),
    )
    const user = await open(vault, `/files/in/${work.id}`)
    await screen.findByRole('heading', { level: 1, name: 'Work' })
    await user.upload(
      screen.getByLabelText('Upload files'),
      new File(['hi'], 'x.txt', { type: 'text/plain' }),
    )
    expect(
      await screen.findByText(
        'Something with this name is already in this folder. Rename one of them first.',
      ),
    ).toBeVisible()
    expect(registered).toEqual({
      name: 'x.txt',
      size: 2,
      content_type: 'text/plain',
      folder_id: work.id,
    })
  })
})
