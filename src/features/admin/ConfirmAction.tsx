import { useState } from 'react'

import { primaryButton, secondaryButton } from '@/components/styles'

/** A button that asks first: the question, then the action or keeping things as they are. */
export function ConfirmAction({
  label,
  name,
  question,
  yes,
  no,
  pending,
  onConfirm,
}: {
  label: string
  /** The button's accessible name, naming what it acts on. */
  name: string
  question: string
  yes: string
  no: string
  pending: boolean
  onConfirm: (done: () => void) => void
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button
        type="button"
        className={secondaryButton}
        aria-label={name}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    )
  }
  return (
    <div role="group" aria-label={name} className="space-y-2 text-left">
      <p className="font-medium">{question}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className={primaryButton}
          disabled={pending}
          onClick={() => onConfirm(() => setAsking(false))}
        >
          {yes}
        </button>
        <button type="button" className={secondaryButton} onClick={() => setAsking(false)}>
          {no}
        </button>
      </div>
    </div>
  )
}
