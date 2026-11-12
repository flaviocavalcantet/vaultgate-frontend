import { expect, test } from '@playwright/test'

import { downloaded, expectAccessible, openAs, run, upload } from './support'

// A test card number and two valid CPFs: the scanner quarantines the file.
const PERSONAL = 'Card 4111 1111 1111 1111, CPF 529.982.247-25 and 111.444.777-35.\n'

test('a user who isn’t an administrator is kept out of administration', async ({ page }) => {
  await openAs(page, 'alice', '/admin/files', 'For administrators only')
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0)
})

test('a quarantined file stays blocked until an administrator releases it', async ({
  page,
  browser,
}) => {
  const name = `${run}-personal.txt`
  await openAs(page, 'alice', '/files', 'Files')
  const row = await upload(page, name, PERSONAL, 'Quarantined')
  await expect(row.getByText(/Found 3 items of personal data/)).toBeVisible()
  await expect(row.getByRole('button', { name: `Download ${name}` })).toHaveCount(0)

  const admin = await (await browser.newContext()).newPage()
  await openAs(admin, 'carol', '/admin/files', 'Files and scans')
  await expectAccessible(admin, 'files and scans')
  await admin.getByRole('link', { name, exact: true }).click()
  await expect(admin.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(admin.getByText('br_cpf: 2 items')).toBeVisible()
  await expectAccessible(admin, 'a file’s scan')

  await admin.getByLabel('Reason', { exact: true }).fill(`Released by the browser tests (${run})`)
  await admin.getByRole('button', { name: 'Release', exact: true }).click()
  await expect(admin.getByText('Released: the owner can download it now.')).toBeVisible()

  // The owner sees the release when the list is next loaded, and can download.
  await openAs(page, 'alice', '/files', 'Files')
  await expect(
    page.getByRole('row', { name: new RegExp(name) }).getByText('Released by an administrator'),
  ).toBeVisible()
  const got = await downloaded(page, () =>
    page.getByRole('button', { name: `Download ${name}` }).click(),
  )
  expect(got.toString()).toBe(PERSONAL)
})

test('every administration page opens and is accessible', async ({ page }) => {
  await openAs(page, 'carol', '/', 'Your vault')
  await page.getByRole('link', { name: 'Administration' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Files and scans' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Administration' })
  const pages: [string, string][] = [
    ['Access policies', 'Access policies'],
    ['Check access', 'Check access'],
    ['Enrollment requests', 'Enrollment requests'],
    ['Nodes', 'Nodes'],
    ['Enrollment tokens', 'Enrollment tokens'],
    ['TPM registrations', 'TPM registrations'],
    ['Users', 'Users'],
    ['Groups', 'Groups'],
    ['Audit log', 'Audit log'],
  ]
  for (const [link, heading] of pages) {
    await nav.getByRole('link', { name: link, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    // Wait for the page's data before checking it.
    await expect(page.getByRole('status')).toHaveCount(0)
    await expectAccessible(page, heading)
  }

  // Check access, as a dry run: the local policy lets every signed-in user download.
  await nav.getByRole('link', { name: 'Check access', exact: true }).click()
  // A text box: the radio "A member of these groups" holds this word too.
  await page.getByRole('textbox', { name: 'Groups', exact: true }).fill('/finance')
  await page.getByLabel('From the address', { exact: true }).fill('10.1.2.3')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByRole('region', { name: 'Result: Allowed' })).toBeVisible()

  // The audit log's chain is intact.
  await nav.getByRole('link', { name: 'Audit log', exact: true }).click()
  await page.getByRole('button', { name: 'Check the chain' }).click()
  await expect(page.getByText(/^Intact: \d+ events? checked/)).toBeVisible()
})
