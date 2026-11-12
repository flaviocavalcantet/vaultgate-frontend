/** Why the API refused an admin action, in terms an administrator can act on. */
export type Failure = 'invalid' | 'conflict' | 'denied' | 'notFound' | 'unknown'

export class Refused extends Error {
  override name = 'Refused'
  readonly reason: Failure
  /** For a 422: the request's fields the API rejected, by name (`groups`, `timezone`...). */
  readonly fields: string[]

  constructor(reason: Failure, fields: string[] = []) {
    super(reason)
    this.reason = reason
    this.fields = fields
  }
}

const BY_STATUS: Record<number, Failure> = {
  403: 'denied',
  404: 'notFound',
  409: 'conflict',
  422: 'invalid',
}

/**
 * The fields a 422 names. FastAPI's validation errors locate each problem as
 * `["body", field, ...]`; a check across fields (a time window) has no field of its own.
 */
function rejectedFields(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !('detail' in body)) return []
  const { detail } = body
  if (!Array.isArray(detail)) return []
  const fields = detail.flatMap((problem: unknown) => {
    if (typeof problem !== 'object' || problem === null || !('loc' in problem)) return []
    const { loc } = problem
    return Array.isArray(loc) && loc[0] === 'body' && typeof loc[1] === 'string' ? [loc[1]] : []
  })
  return [...new Set(fields)]
}

export function refusal(status: number, body?: unknown): Refused {
  return new Refused(BY_STATUS[status] ?? 'unknown', status === 422 ? rejectedFields(body) : [])
}

export function reasonOf(error: unknown): Failure {
  return error instanceof Refused ? error.reason : 'unknown'
}

export function fieldsOf(error: unknown): string[] {
  return error instanceof Refused ? error.fields : []
}
