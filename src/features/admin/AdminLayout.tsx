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
          <li>
            <NavLink to="/admin/policies" className={link}>
              {t('admin.policiesNav')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/evaluate" className={link}>
              {t('admin.evaluateNav')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/enrollments" className={link}>
              {t('admin.enrollmentsNav')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/nodes" className={link}>
              {t('admin.nodesNav')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/tokens" className={link}>
              {t('admin.tokensNav')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/tpms" className={link}>
              {t('admin.tpmsNav')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/users" className={link}>
              {t('admin.usersNav')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/groups" className={link}>
              {t('admin.groupsNav')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/audit" className={link}>
              {t('admin.auditNav')}
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
