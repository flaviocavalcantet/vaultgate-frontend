import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { fakeUserManager, renderApp, signedInUser } from '@/test/render'
import { alice, api, server } from '@/test/server'

import { safeReturnTo } from './returnTo'
import { CALLBACK_PATH } from './userManager'

const signInHeading = { level: 1, name: 'Sign in to VaultGate' } as const

describe('signed out', () => {
  it('shows the sign-in page in place of a page that needs a session', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', signInHeading)).toBeVisible()
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('sends the browser to the provider, to come back where the user was', async () => {
    const { manager } = renderApp('/?tab=shared')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(manager.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/?tab=shared' } })
  })
})

describe('coming back from the provider', () => {
  it('signs in, goes where the user was going, and loads their account with the token', async () => {
    const { router } = renderApp(`${CALLBACK_PATH}?code=abc&state=xyz`)
    expect(await screen.findByText('Signed in as Alice Example')).toBeVisible()
    expect(router.state.location.pathname).toBe('/')
    // GET /me answers only to the access token (src/test/server.ts).
    expect(await screen.findByText(alice.email as string)).toBeVisible()
    expect(screen.getByText('/engineering, /vaultgate-users')).toBeVisible()
  })

  it('exchanges the code once', async () => {
    const { manager } = renderApp(CALLBACK_PATH)
    await screen.findByText('Signed in as Alice Example')
    expect(manager.signinRedirectCallback).toHaveBeenCalledTimes(1)
  })

  it('never follows a destination outside the app', async () => {
    const fake = fakeUserManager(() => Promise.resolve(signedInUser('https://evil.example/x')))
    const { router } = renderApp(CALLBACK_PATH, fake)
    await screen.findByText('Signed in as Alice Example')
    expect(router.state.location.pathname).toBe('/')
  })

  it('says so when signing in fails, and offers to try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fake = fakeUserManager(() => Promise.reject(new Error('state mismatch')))
    renderApp(CALLBACK_PATH, fake)
    expect(await screen.findByRole('alert')).toHaveTextContent('Signing in did not work')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})

describe('a session ending', () => {
  it('ends when the API refuses the token', async () => {
    server.use(http.get(api('/me'), () => HttpResponse.json({}, { status: 401 })))
    const { manager } = renderApp(CALLBACK_PATH)
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session ended')
    expect(screen.getByRole('heading', signInHeading)).toBeVisible()
    expect(manager.removeUser).toHaveBeenCalled()
  })

  it('ends when the token expires and could not be renewed', async () => {
    const { emit } = renderApp(CALLBACK_PATH)
    await screen.findByText('Signed in as Alice Example')
    act(() => emit('accessTokenExpired'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session ended')
  })

  it('keeps going with a renewed token', async () => {
    const { emit } = renderApp(CALLBACK_PATH)
    await screen.findByText('Signed in as Alice Example')
    act(() => emit('userLoaded', signedInUser('/', 'Alice Renewed')))
    expect(await screen.findByText('Signed in as Alice Renewed')).toBeVisible()
  })

  it('signs out here and at the provider', async () => {
    const { manager } = renderApp(CALLBACK_PATH)
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(manager.signoutRedirect).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('heading', signInHeading)).toBeVisible())
  })
})

describe('the account section', () => {
  it('offers to retry when the account cannot be loaded', async () => {
    let calls = 0
    server.use(
      http.get(api('/me'), () => {
        calls += 1
        return calls <= 2 ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json(alice)
      }),
    )
    renderApp(CALLBACK_PATH)
    // The query retries once by itself, then says so.
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'could not be loaded',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(alice.email as string)).toBeVisible()
  })
})

describe('safeReturnTo', () => {
  it.each(['/', '/files', '/files/123?tab=shares#top'])('keeps %s', (path) => {
    expect(safeReturnTo(path)).toBe(path)
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'files',
    '/auth/callback?code=x',
    '',
    undefined,
    42,
  ])('turns %s into the start page', (value) => {
    expect(safeReturnTo(value)).toBe('/')
  })
})
