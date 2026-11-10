import { useContext } from 'react'

import type { Config } from './config'
import { ConfigContext } from './ConfigContext'

export function useConfig(): Config {
  const config = useContext(ConfigContext)
  if (!config) {
    throw new Error('useConfig must be used inside a ConfigProvider')
  }
  return config
}
