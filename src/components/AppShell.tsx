import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

import { GuillocheBand } from '@/components/Guilloche'
import { useAuth } from '@/features/auth/useAuth'
import { useMe } from '@/features/auth/useMe'

// The current page is underlined in the accent, like a ruled entry; the others are quiet.
const navLink = ({ isActive }: { isActive: boolean }) =>
  [
    'block border-b-2 px-1 pt-2 pb-1.5 font-medium',
    isActive
      ? 'border-accent text-ink'
      : 'border-transparent text-graphite hover:border-control hover:text-ink',
  ].join(' ')

/** The frame every page shares: skip link, header with the main navigation, main area. */
export function AppShell() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  // Shown to administrators only; the API refuses admin requests from anyone else.
  const isAdmin = useMe().data?.is_admin === true
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-ink"
      >
        {t('app.skipToContent')}
      </a>
      <header>
        <div className="mx-auto flex max-w-5xl flex-wrap items-end gap-x-8 gap-y-2 px-4 pt-4 pb-2">
          <span className="pb-1.5 text-xl font-bold tracking-tight">{t('app.name')}</span>
          <nav aria-label={t('app.mainNavigation')}>
            <ul className="flex flex-wrap gap-x-5">
              <li>
                <NavLink to="/" end className={navLink}>
                  {t('nav.home')}
                </NavLink>
              </li>
              {user ? (
                <>
                  <li>
                    <NavLink to="/files" className={navLink}>
                      {t('nav.files')}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/shared" className={navLink}>
                      {t('nav.shared')}
                    </NavLink>
                  </li>
                  {isAdmin ? (
                    <li>
                      <NavLink to="/admin" className={navLink}>
                        {t('nav.admin')}
                      </NavLink>
                    </li>
                  ) : null}
                </>
              ) : null}
            </ul>
          </nav>
          {user ? (
            <div className="ml-auto flex items-center gap-3 pb-1 text-sm">
              <span>{t('nav.signedInAs', { name: user.name })}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded border border-control px-3 py-1.5 font-medium hover:bg-accent-soft"
              >
                {t('nav.signOut')}
              </button>
            </div>
          ) : null}
        </div>
        <GuillocheBand />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
