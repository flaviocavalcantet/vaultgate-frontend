import { useContext } from 'react'

import { ApiContext } from './ApiContext'
import type { ApiClient } from './client'

export function useApi(): ApiClient {
  const api = useContext(ApiContext)
  if (!api) {
    throw new Error('useApi must be used inside an ApiProvider')
  }
  return api
}
