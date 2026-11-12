/** Why the API refused an admin action, in terms an administrator can act on. */
export type Failure = 'invalid' | 'conflict' | 'denied' | 'notFound' | 'unknown'

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
  409: 'conflict',
  422: 'invalid',
}

export function refusal(status: number): Refused {
  return new Refused(BY_STATUS[status] ?? 'unknown')
}

export function reasonOf(error: unknown): Failure {
  return error instanceof Refused ? error.reason : 'unknown'
}
