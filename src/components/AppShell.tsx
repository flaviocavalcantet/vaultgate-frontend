import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

const navLink = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded px-3 py-2 text-sm font-medium',
    isActive
      ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
  ].join(' ')

/** The frame every page shares: skip link, header with the main navigation, main area. */
export function AppShell() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900"
      >
        {t('app.skipToContent')}
      </a>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-semibold">{t('app.name')}</span>
          <nav aria-label={t('app.mainNavigation')}>
            <ul className="flex gap-1">
              <li>
                <NavLink to="/" end className={navLink}>
                  {t('nav.home')}
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
