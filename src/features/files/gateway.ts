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
