import { useContext } from 'react'

import { type Auth, AuthContext } from './AuthContext'

export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return auth
}
