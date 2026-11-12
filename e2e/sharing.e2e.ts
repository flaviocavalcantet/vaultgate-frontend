import { randomBytes } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { codeFor, downloaded, expectAccessible, mailIds, openAs, run, upload } from './support'

test('an outside recipient opens a share link, confirms the emailed code, and downloads', async ({
  page,
  browser,
  request,
}) => {
  const bytes = randomBytes(16 * 1024)
  const name = `${run}-shared.bin`
  const recipient = `${run}@example.com`

  await openAs(page, 'alice', '/files', 'Files')
  const row = await upload(page, name, bytes, 'Clean')
  await row.getByRole('link', { name: `Share ${name}` }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Share ${name}` })).toBeVisible()
  await expectAccessible(page, 'the sharing page')

  await page.getByLabel('Recipient’s email address').fill(recipient)
  await page.getByLabel('Downloads allowed').fill('2')
  await page.getByRole('button', { name: 'Create link' }).click()
  const field = page.getByLabel(`Link for ${recipient}`)
  await expect(field).toBeVisible()
  const link = await field.inputValue()
  expect(new URL(link).pathname).toBe('/s')
  expect(new URL(link).hash.length).toBeGreaterThan(20)

  // The recipient: another browser, no account, no session.
  const outside = await browser.newContext()
  const recipientPage = await outside.newPage()
  await recipientPage.goto(link)
  await expect(recipientPage.getByText(/For e\*\*\*@example\.com\./)).toBeVisible()
  // The token leaves the address as soon as the page has read it.
  await expect(recipientPage).toHaveURL(/\/s$/)
  await expectAccessible(recipientPage, 'the recipient’s page')

  const before = await mailIds(request)
  await recipientPage.getByRole('button', { name: 'Email me a code' }).click()
  await expect(recipientPage.getByText(/We sent a code to/)).toBeVisible()
  const code = await codeFor(request, recipient, before)
  await recipientPage.getByLabel('Code').fill(code)
  await recipientPage.getByRole('button', { name: 'Continue' }).click()
  await expect(recipientPage.getByText('Confirmed. You can download the file now.')).toBeVisible()
  await expectAccessible(recipientPage, 'the recipient’s page, confirmed')

  const got = await downloaded(recipientPage, () =>
    recipientPage.getByRole('button', { name: 'Download the file' }).click(),
  )
  expect(got.equals(bytes)).toBe(true)

  // The owner revokes the link: it stops working at once.
  const links = page.getByRole('table', { name: `Links to ${name}, newest first` })
  await openAs(page, 'alice', new URL(page.url()).pathname, `Share ${name}`)
  await expect(
    links.getByRole('row', { name: new RegExp(recipient) }).getByText('1 of 2'),
  ).toBeVisible()
  await page.getByRole('button', { name: `Revoke the link for ${recipient}` }).click()
  await expect(page.getByText(`The link for ${recipient} no longer works.`)).toBeVisible()

  const later = await (await browser.newContext()).newPage()
  await later.goto(link)
  await expect(later.getByRole('alert')).toContainText('This link no longer works')
  await outside.close()
})
