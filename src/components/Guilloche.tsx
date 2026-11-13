/**
 * Guilloché: the engraved linework of banknotes and passports, drawn here as SVG from
 * plain geometry (no image). Decoration only: hidden from assistive technology.
 */

/**
 * A guilloché line: a fine wave, `lobes` times around a circle of radius `r`, swinging
 * `swing` in and out, turned by `phase`. Many of them, slightly offset, weave the net.
 */
function ring(c: number, r: number, swing: number, lobes: number, phase: number): string {
  const steps = 1440
  const points: string[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2
    const radius = r + swing * Math.sin(lobes * t + phase)
    points.push(`${(c + radius * Math.cos(t)).toFixed(2)} ${(c + radius * Math.sin(t)).toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}

/** Three bands of woven lines, outer to inner, like the rosette of a banknote. */
const ROSETTE = [
  ...Array.from({ length: 10 }, (_, i) => ring(100, 82, 12, 36, (i * Math.PI) / 10)),
  ...Array.from({ length: 8 }, (_, i) => ring(100, 56, 9, 24, (i * Math.PI) / 8)),
  ...Array.from({ length: 6 }, (_, i) => ring(100, 33, 6, 16, (i * Math.PI) / 6)),
]

/** The rosette at the doors where trust is established: sign-in and a share link. */
export function GuillocheRosette({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={`text-accent ${className}`}>
      {ROSETTE.map((d) => (
        <path key={d.slice(0, 40)} d={d} fill="none" stroke="currentColor" strokeWidth={0.35} />
      ))}
      <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth={0.6} />
      <circle cx="100" cy="100" r="18" fill="none" stroke="currentColor" strokeWidth={0.6} />
    </svg>
  )
}

/** Three interlaced waves, one wavelength (40 by 10), repeated along the band. */
const WAVES = [0, 1, 2].map((phase) => {
  const points: string[] = []
  for (let x = 0; x <= 40; x += 1) {
    const y = 5 + 4 * Math.sin(((x + phase * (40 / 3)) / 40) * Math.PI * 2)
    points.push(`${x} ${y.toFixed(2)}`)
  }
  return `M${points.join('L')}`
})

/** The engraved band under the header, on every page. */
export function GuillocheBand() {
  return (
    <svg aria-hidden="true" className="block h-2.5 w-full text-accent" preserveAspectRatio="none">
      <defs>
        <pattern id="guilloche-band" width="40" height="10" patternUnits="userSpaceOnUse">
          {WAVES.map((d) => (
            <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={0.6} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="10" fill="url(#guilloche-band)" />
    </svg>
  )
}
