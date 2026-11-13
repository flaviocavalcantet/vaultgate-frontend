import type { ReactNode } from 'react'

/** A page's one <h1>, with its optional introduction. A front door's title is larger. */
export function PageHeading({
  title,
  children,
  door = false,
}: {
  title: string
  children?: ReactNode
  door?: boolean
}) {
  return (
    <div className="mb-6">
      <h1
        className={`leading-tight font-bold tracking-tight ${door ? 'text-[2rem] md:text-[2.5rem]' : 'text-[1.75rem]'}`}
      >
        {title}
      </h1>
      {children ? <p className="mt-2 max-w-prose text-graphite">{children}</p> : null}
    </div>
  )
}
