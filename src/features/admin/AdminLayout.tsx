import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

const link = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded px-3 py-2 text-sm font-medium',
    isActive
      ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
  ].join(' ')

/** The admin area's frame: its own navigation, then the page. Later steps add sections. */
export function AdminLayout() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav aria-label={t('admin.navigation')} className="md:w-48 md:shrink-0">
        <ul className="flex gap-1 md:flex-col">
          <li>
            <NavLink to="/admin/files" className={link}>
              {t('admin.quarantine')}
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
