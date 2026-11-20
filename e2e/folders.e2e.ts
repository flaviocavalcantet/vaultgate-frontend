import { randomBytes } from 'node:crypto'

import { expect, type Page, test } from '@playwright/test'

import { codeFor, downloaded, expectAccessible, mailIds, openAs, run, upload } from './support'

/** Makes a folder where the page is, and opens it; returns its page's path. */
async function makeFolder(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: 'New folder' }).click()
  await page.getByLabel('Folder name', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Create folder' }).click()
  await expect(page.getByText(`Folder ${name} created.`)).toBeVisible()
  await page.getByRole('link', { name: `Open folder ${name}`, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return new URL(page.url()).pathname
}

test('folders: made, filled, renamed, moved through, and deleted with what they hold', async ({
  page,
}) => {
  const top = `${run}-projects`
  const bytes = randomBytes(8 * 1024)
  const name = `${run}-plan.bin`

  await openAs(page, 'alice', '/files', 'Files')
  const topPath = await makeFolder(page, top)
  const crumbs = page.getByRole('navigation', { name: 'Folder path' })
  await expect(crumbs.getByRole('link', { name: 'My files', exact: true })).toBeVisible()
  await expect(crumbs.getByText(top, { exact: true })).toHaveAttribute('aria-current', 'page')

  // An upload goes into the folder the page shows.
  await upload(page, name, bytes, 'Clean')
  await expectAccessible(page, 'a folder’s page')

  // A name already here, in any case, is refused in the app's words.
  await page.getByRole('button', { name: 'New folder' }).click()
  await page.getByLabel('Folder name', { exact: true }).fill(name.toUpperCase())
  await page.getByRole('button', { name: 'Create folder' }).click()
  await expect(page.getByRole('alert')).toContainText('Something with this name is already there')
  await page.getByRole('button', { name: 'Cancel' }).click()

  const innerPath = await makeFolder(page, 'inner')
  await expect(crumbs.getByRole('link', { name: top, exact: true })).toHaveAttribute(
    'href',
    topPath,
  )

  // Back up, rename the file, and move it into inner by browsing.
  await crumbs.getByRole('link', { name: top, exact: true }).click()
  await page.getByRole('button', { name: `Rename ${name}`, exact: true }).click()
  const renamed = `${run}-final.bin`
  const field = page.getByLabel('New name', { exact: true })
  await field.fill(renamed)
  await page.getByRole('button', { name: 'Rename', exact: true }).click()
  await expect(page.getByText(`${name} renamed to ${renamed}.`)).toBeVisible()

  await page.getByRole('button', { name: `Move ${renamed}`, exact: true }).click()
  const move = page.getByRole('region', { name: `Move ${renamed}` })
  await expectAccessible(page, 'the move panel')
  await move.getByRole('button', { name: 'Open inner', exact: true }).click()
  await move.getByRole('button', { name: 'Move to inner', exact: true }).click()
  await expect(page.getByText(`${renamed} moved to inner.`)).toBeVisible()

  await page.getByRole('link', { name: 'Open folder inner', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${innerPath}$`))
  await expect(
    page.getByRole('row', { name: new RegExp(renamed.replace(/\./g, '\\.')) }),
  ).toBeVisible()
  // Moving never touched the stored file: it still downloads, byte for byte.
  const got = await downloaded(page, () =>
    page.getByRole('button', { name: `Download ${renamed}`, exact: true }).click(),
  )
  expect(got.equals(bytes)).toBe(true)

  // Deleting the top folder: what it holds is shown, and its name must be typed.
  await openAs(page, 'alice', '/files', 'Files')
  await page.getByRole('button', { name: `Delete ${top}`, exact: true }).click()
  const panel = page.getByRole('region', { name: `Delete ${top}` })
  await expect(panel.getByText(/It holds 1 folder and 1 file \(8\.0 KB\)\./)).toBeVisible()
  await expectAccessible(page, 'the delete panel')
  const confirm = panel.getByRole('button', { name: `Delete ${top}`, exact: true })
  await expect(confirm).toBeDisabled()
  await panel.getByLabel(`Type ${top} to confirm`, { exact: true }).fill(top)
  await confirm.click()
  await expect(page.getByText(`${top} deleted.`)).toBeVisible()
  await expect(page.getByRole('link', { name: `Open folder ${top}`, exact: true })).toHaveCount(0)

  // Its page is gone with it.
  await openAs(page, 'alice', innerPath, 'Files')
  await expect(page.getByRole('alert')).toContainText('This folder doesn’t exist, or isn’t yours.')
})

test('a folder link: the recipient confirms the code, browses into it, and downloads', async ({
  page,
  browser,
  request,
}) => {
  const top = `${run}-shared-folder`
  const bytes = randomBytes(4 * 1024)
  const name = `${run}-inside.bin`
  const recipient = `${run}-folder@example.com`

  await openAs(page, 'alice', '/files', 'Files')
  const topPath = await makeFolder(page, top)
  await makeFolder(page, 'reports')
  await upload(page, name, bytes, 'Clean')

  // Share the top folder from its row.
  await openAs(page, 'alice', '/files', 'Files')
  await page.getByRole('link', { name: `Share ${top}`, exact: true }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: `Share the folder ${top}` }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: `Back to ${top}` })).toHaveAttribute('href', topPath)
  await expectAccessible(page, 'a folder’s sharing page')
  await page.getByLabel('Recipient’s email address', { exact: true }).fill(recipient)
  await page.getByRole('button', { name: 'Create link' }).click()
  const link = await page
    .getByRole('textbox', { name: `Link for ${recipient}`, exact: true })
    .inputValue()

  const outside = await browser.newContext()
  const recipientPage = await outside.newPage()
  await recipientPage.goto(link)
  await expect(
    recipientPage.getByRole('heading', { level: 1, name: 'A folder shared with you' }),
  ).toBeVisible()
  // Nothing in the folder is named before the address is proven.
  await expect(recipientPage.getByText(top)).toHaveCount(0)

  const before = await mailIds(request)
  await recipientPage.getByRole('button', { name: 'Email me a code' }).click()
  const code = await codeFor(request, recipient, before)
  await recipientPage.getByLabel('Code', { exact: true }).fill(code)
  await recipientPage.getByRole('button', { name: 'Continue' }).click()
  await expect(
    recipientPage.getByText('Confirmed. You can open the folder and download its files now.'),
  ).toBeVisible()

  const path = recipientPage.getByRole('navigation', { name: 'Shared folder path' })
  await expect(path.getByText(top, { exact: true })).toHaveAttribute('aria-current', 'page')
  await recipientPage.getByRole('button', { name: 'Open folder reports', exact: true }).click()
  await expect(path.getByText('reports', { exact: true })).toBeFocused()
  await expectAccessible(recipientPage, 'a shared folder, as its recipient sees it')

  const got = await downloaded(recipientPage, () =>
    recipientPage.getByRole('button', { name: `Download ${name}`, exact: true }).click(),
  )
  expect(got.equals(bytes)).toBe(true)
  await outside.close()
})
