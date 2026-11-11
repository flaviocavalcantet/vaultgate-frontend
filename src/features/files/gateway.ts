import type { Transfer } from './types'

export class UploadError extends Error {
  override name = 'UploadError'
  /** The gateway's status, or 0 when the request never got an answer. */
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class UploadAborted extends Error {
  override name = 'UploadAborted'
}

/**
 * Sends a file's bytes to the gateway with its upload intent. XMLHttpRequest, not
 * fetch: fetch reports no upload progress. The intent token goes to the intent's own
 * address only, in the header the gateway reads.
 */
export function uploadToGateway(
  upload: Transfer,
  file: Blob,
  onProgress: (sent: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', upload.url)
    request.setRequestHeader('Authorization', `Bearer ${upload.token}`)
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total)
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new UploadError(request.status, `the gateway answered ${request.status}`))
    })
    request.addEventListener('error', () =>
      reject(new UploadError(0, 'the gateway could not be reached')),
    )
    request.addEventListener('abort', () => reject(new UploadAborted('the upload was cancelled')))
    if (signal) {
      if (signal.aborted) {
        reject(new UploadAborted('the upload was cancelled'))
        return
      }
      signal.addEventListener('abort', () => request.abort(), { once: true })
    }
    request.send(file)
  })
}

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
