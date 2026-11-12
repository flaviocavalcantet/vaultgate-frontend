import type { components } from '@/api/schema'

type Transfer = components['schemas']['TransferOut']

/**
 * Hands a download to the browser (vaultgate ADR 0018): a form, POSTed to the intent's
 * address with the token as its one field. The response is always an attachment, so the
 * browser's own downloader saves it to disk and the page stays where it is. The token
 * travels in the body, never in an address.
 */
export function submitDownload(download: Transfer, doc: Document = document): void {
  const form = doc.createElement('form')
  form.method = 'POST'
  form.action = download.url
  form.enctype = 'application/x-www-form-urlencoded'
  form.hidden = true
  const token = doc.createElement('input')
  token.type = 'hidden'
  token.name = 'token'
  token.value = download.token
  form.append(token)
  doc.body.append(form)
  try {
    form.submit()
  } finally {
    form.remove()
  }
}
