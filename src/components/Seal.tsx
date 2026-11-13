import { useEffect, useRef, useState } from 'react'

/**
 * What a seal certifies. Each tone has its own mark, so the state reads without colour:
 * a filled seal (certified), a double ring with a bar (blocked), a broken ring (still
 * deciding), a ring with a notch (couldn't be decided), a plain ring (neutral).
 */
export type SealTone = 'certified' | 'blocked' | 'pending' | 'warning' | 'neutral'

const COLOUR: Record<SealTone, string> = {
  certified: 'text-accent',
  blocked: 'text-seal',
  pending: 'text-graphite',
  warning: 'text-ochre',
  neutral: 'text-graphite',
}

function Mark({ tone }: { tone: SealTone }) {
  switch (tone) {
    case 'certified':
      return (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <circle cx="8" cy="8" r="4.6" fill="none" stroke="var(--paper)" strokeWidth="1" />
        </>
      )
    case 'blocked':
      return (
        <>
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="4.4" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M4.2 8h7.6" stroke="currentColor" strokeWidth="2" />
        </>
      )
    case 'pending':
      return (
        <circle
          cx="8"
          cy="8"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 2.1"
        />
      )
    case 'warning':
      return (
        <>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.2v4.6" stroke="currentColor" strokeWidth="2" />
          <circle cx="8" cy="11.3" r="1" fill="currentColor" />
        </>
      )
    default:
      return <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  }
}

/**
 * A state, sealed: the mark and the word. The mark is pressed in once when a pending
 * state is decided while the page is open (a scan finishing), never on page load.
 */
export function Seal({ tone, label }: { tone: SealTone; label: string }) {
  const previous = useRef(tone)
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    if (previous.current === 'pending' && tone !== 'pending') setPressed(true)
    previous.current = tone
  }, [tone])

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${COLOUR[tone]}`}>
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        className={`shrink-0 ${pressed ? 'animate-stamp' : ''}`}
        onAnimationEnd={() => setPressed(false)}
      >
        <Mark tone={tone} />
      </svg>
      <span>{label}</span>
    </span>
  )
}
