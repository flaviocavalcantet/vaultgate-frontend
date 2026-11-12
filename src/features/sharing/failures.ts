/** Why the API refused something, in terms a person can act on. */
export type Failure =
  'invalid' | 'notShareable' | 'denied' | 'tooMany' | 'notFound' | 'gone' | 'mailDown' | 'unknown'

export class Refused extends Error {
  override name = 'Refused'
  readonly reason: Failure

  constructor(reason: Failure) {
    super(reason)
    this.reason = reason
  }
}

const BY_STATUS: Record<number, Failure> = {
  403: 'denied',
  404: 'notFound',
  409: 'notShareable',
  410: 'gone',
  422: 'invalid',
  429: 'tooMany',
  503: 'mailDown',
}

export function refusal(status: number): Refused {
  return new Refused(BY_STATUS[status] ?? 'unknown')
}

export function reasonOf(error: unknown): Failure {
  return error instanceof Refused ? error.reason : 'unknown'
}
