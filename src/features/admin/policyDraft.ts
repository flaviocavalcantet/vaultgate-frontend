import type { Action, Policy, PolicyIn } from './types'

/** A policy as its form holds it: lists as text, one item per line; times as "HH:MM". */
export interface PolicyDraft {
  name: string
  description: string
  effect: 'allow' | 'deny'
  actions: Action[]
  enabled: boolean
  groups: string
  networks: string
  excludedNetworks: string
  days: number[]
  startTime: string
  endTime: string
  timezone: string
}

export const emptyDraft: PolicyDraft = {
  name: '',
  description: '',
  effect: 'allow',
  actions: [],
  enabled: true,
  groups: '',
  networks: '',
  excludedNetworks: '',
  days: [],
  startTime: '',
  endTime: '',
  timezone: 'UTC',
}

/** The non-empty lines of a text, trimmed. */
export function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** "08:00:00" (as the API returns a time) to "08:00" (as a time field holds it). */
const hhmm = (time: string | null | undefined) => (time ?? '').slice(0, 5)

export function draftOf(policy: Policy): PolicyDraft {
  return {
    name: policy.name,
    description: policy.description ?? '',
    effect: policy.effect,
    actions: [...policy.actions],
    enabled: policy.enabled ?? true,
    groups: (policy.groups ?? []).join('\n'),
    networks: (policy.networks ?? []).join('\n'),
    excludedNetworks: (policy.excluded_networks ?? []).join('\n'),
    days: [...(policy.days ?? [])],
    startTime: hhmm(policy.start_time),
    endTime: hhmm(policy.end_time),
    timezone: policy.timezone ?? 'UTC',
  }
}

/** The whole policy for the API (a PUT replaces it whole). Empty times mean all day. */
export function bodyOf(draft: PolicyDraft): PolicyIn {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    effect: draft.effect,
    actions: draft.actions,
    enabled: draft.enabled,
    groups: lines(draft.groups),
    networks: lines(draft.networks),
    excluded_networks: lines(draft.excludedNetworks),
    days: draft.days.toSorted((a, b) => a - b),
    start_time: draft.startTime === '' ? null : draft.startTime,
    end_time: draft.endTime === '' ? null : draft.endTime,
    timezone: draft.timezone.trim() || 'UTC',
  }
}

/** A weekday's name in the reader's language: 1 = Monday ... 7 = Sunday, as the API counts. */
export function weekday(day: number, locale: string, width: 'long' | 'short' = 'long'): string {
  // 2024-01-01 was a Monday.
  const date = new Date(Date.UTC(2024, 0, day))
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(date)
}

/** The time zones the browser knows, for suggestions; the API checks the name. */
export function timeZones(): string[] {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
}
