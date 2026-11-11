/**
 * Where to send the user after sign-in: only a path inside this app. Anything else (an
 * absolute address, `//host`, a backslash trick) becomes "/", so a crafted link can't
 * turn the sign-in into a redirect to another site.
 */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  if (value.startsWith('//') || value.includes('\\')) return '/'
  // The sign-in pages themselves are never a destination.
  if (value.startsWith('/auth/')) return '/'
  return value
}
