import { AxeBuilder } from '@axe-core/playwright'
import { type APIRequestContext, expect, type Page } from '@playwright/test'

/** The local realm's users (vaultgate's infra/keycloak): carol is an administrator. */
export const USERS = {
  alice: { username: 'alice', password: 'alice-dev-password', name: 'Alice' },
  carol: { username: 'carol', password: 'carol-dev-password', name: 'Carol' },
} as const
export type UserName = keyof typeof USERS

/** Where the cluster's Mailpit catches VaultGate's mail (the share codes). */
export const MAILPIT = process.env.VAULTGATE_E2E_MAILPIT ?? 'http://localhost:8025'

/** A name no earlier run used: the tests leave their files behind, like a user would. */
export const run = `e2e-${Date.now().toString(36)}`

/**
 * Opens `path` signed in as `user`. The app keeps its tokens in memory, so every page
 * load starts signed out: this signs in again, through Keycloak's form the first time
 * and straight through its session after that, and comes back to `path`.
 */
export async function openAs(page: Page, user: UserName, path: string, heading: string | RegExp) {
  await page.goto(path)
  await page.getByRole('button', { name: 'Sign in' }).click()
  const form = page.locator('#kc-login')
  const back = page.getByRole('heading', { level: 1, name: heading })
  await expect(form.or(back)).toBeVisible()
  if (await form.isVisible()) {
    await page.locator('#username').fill(USERS[user].username)
    await page.locator('#password').fill(USERS[user].password)
    await form.click()
  }
  await expect(back).toBeVisible()
}

/** No WCAG 2.1 A or AA violations axe can find on the page as it is now. */
export async function expectAccessible(page: Page, where: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const found = results.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? 'unknown'}): ${v.help} at ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
  expect(found, `accessibility of ${where}`).toEqual([])
}

interface MailpitMessage {
  ID: string
  Subject: string
  To: { Address: string }[]
}

async function messages(request: APIRequestContext): Promise<MailpitMessage[]> {
  const response = await request.get(`${MAILPIT}/api/v1/messages?limit=50`)
  expect(response.ok()).toBe(true)
  return ((await response.json()) as { messages: MailpitMessage[] }).messages
}

/** The IDs of the messages Mailpit holds now, to tell a new one apart. */
export async function mailIds(request: APIRequestContext): Promise<Set<string>> {
  return new Set((await messages(request)).map((m) => m.ID))
}

/** The code in the newest message to `to` that isn't in `before`: "Your VaultGate code: 123456". */
export async function codeFor(
  request: APIRequestContext,
  to: string,
  before: Set<string>,
): Promise<string> {
  let code = ''
  await expect(async () => {
    const found = (await messages(request)).find(
      (m) => !before.has(m.ID) && m.To.some((t) => t.Address === to),
    )
    expect(found, `a code mailed to ${to}`).toBeTruthy()
    code = found!.Subject.split(' ').at(-1) ?? ''
  }).toPass({ timeout: 30_000 })
  return code
}

/** Uploads a file from the files page and waits for its scan's verdict. */
export async function upload(page: Page, name: string, content: Buffer | string, verdict: string) {
  await page.getByLabel('Upload files', { exact: true }).setInputFiles({
    name,
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(content),
  })
  const row = page.getByRole('row', { name: new RegExp(name.replace(/\./g, '\\.')) })
  // The list asks again every few seconds until the scanner has decided.
  await expect(row.getByText(verdict, { exact: true })).toBeVisible({ timeout: 90_000 })
  return row
}

/** Clicks what starts a download and returns the downloaded bytes. */
export async function downloaded(page: Page, start: () => Promise<void>): Promise<Buffer> {
  const [download] = await Promise.all([page.waitForEvent('download'), start()])
  const path = await download.path()
  const { readFile } = await import('node:fs/promises')
  return readFile(path)
}
