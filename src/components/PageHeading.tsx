import type { ReactNode } from 'react'

/** A page's one <h1>, with its optional introduction. */
export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children ? <p className="mt-2 text-slate-600 dark:text-slate-300">{children}</p> : null}
    </div>
  )
}
