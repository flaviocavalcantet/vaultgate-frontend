import type { ReactNode } from 'react'

import type { Config } from './config'
import { ConfigContext } from './ConfigContext'

export function ConfigProvider({ config, children }: { config: Config; children: ReactNode }) {
  return <ConfigContext value={config}>{children}</ConfigContext>
}
