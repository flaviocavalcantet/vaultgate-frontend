import { randomBytes } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { downloaded, expectAccessible, openAs, run, upload } from './support'

test('a user signs in, uploads a file, waits for its scan, and downloads it', async ({ page }) => {
  await openAs(page, 'alice', '/', 'Your vault')
  await expect(page.getByText('alice@example.com')).toBeVisible()
  await expectAccessible(page, 'the home page')

  await page.getByRole('link', { name: 'Files', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Files' })).toBeVisible()

  // Random bytes hold no card number or CPF: the scan finds the file clean.
  const bytes = randomBytes(64 * 1024)
  const name = `${run}-clean.bin`
  const row = await upload(page, name, bytes, 'Clean')
  await expectAccessible(page, 'the files page')

  const got = await downloaded(page, () =>
    row.getByRole('button', { name: `Download ${name}` }).click(),
  )
  expect(got.equals(bytes)).toBe(true)
  await expect(page.getByText(`Your download of ${name} has started.`)).toBeVisible()
})

test('a page load starts signed out: the app keeps no token anywhere but in memory', async ({
  page,
}) => {
  await openAs(page, 'alice', '/files', 'Files')
  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }))
  expect(stored.local.filter((key) => key.startsWith('oidc.'))).toEqual([])
  expect(stored.session.filter((key) => key.startsWith('oidc.user'))).toEqual([])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to VaultGate' })).toBeVisible()
  await expectAccessible(page, 'the sign-in page')
})
