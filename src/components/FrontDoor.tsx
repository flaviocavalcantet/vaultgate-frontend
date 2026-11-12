import type { ReactNode } from 'react'

import { GuillocheRosette } from './Guilloche'

/**
 * The pages where trust is established, signing in and opening a share link: the
 * content beside an engraved rosette, as on a certificate. On a phone the rosette
 * sits above, smaller.
 */
export function FrontDoor({ children }: { children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:gap-12">
      <GuillocheRosette className="w-24 md:order-last md:w-64" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
