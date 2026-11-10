import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '@/test/render'

describe('the app shell', () => {
  it('shows the home page inside the shell, with its landmarks', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Your vault' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('answers an unknown address with the not-found page, and leads back', async () => {
    renderApp('/no/such/page')
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: 'Back to the start' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Your vault' })).toBeVisible()
  })
})
