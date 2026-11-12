/** Where a share link opens: the recipient's page, outside the sign-in. */
export const ACCESS_PATH = '/s'

/**
 * The link the owner sends: this app's recipient page, with the share's token in the
 * fragment. Browsers never send a fragment to a server, so the token stays out of
 * access logs and Referer headers; the page reads it and then removes it from the
 * address.
 */
export function shareLink(origin: string, token: string): string {
  return `${origin}${ACCESS_PATH}#${encodeURIComponent(token)}`
}

/** The token in a share link's fragment, or null when there is none worth asking about. */
export function tokenFromHash(hash: string): string | null {
  let token: string
  try {
    token = decodeURIComponent(hash.replace(/^#/, ''))
  } catch {
    return null
  }
  return token.length > 0 && token.length <= 256 ? token : null
}
