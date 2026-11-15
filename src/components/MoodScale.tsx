import { FaceIcon } from './icons'

/** 1 very tense .. 5 very calm. */
export type Mood = 1 | 2 | 3 | 4 | 5

const MOODS: Mood[] = [1, 2, 3, 4, 5]

/**
 * "How do you feel right now?": five faces from very tense to very calm. The same scale is asked before
 * and after an exercise, so the two answers can be set side by side. Nothing is measured.
 */
export function MoodScale({
  label,
  moods,
  ends,
  value,
  onChange,
  testId,
}: {
  label: string
  /** Names of the five moods, from very tense to very calm. */
  moods: readonly string[]
  /** The words under both ends of the scale. */
  ends: readonly [string, string]
  value?: number
  onChange: (mood: Mood) => void
  testId?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="mx-auto w-full max-w-[19rem]" data-testid={testId}>
      <div className="flex justify-between">
        {MOODS.map((m) => {
          const on = value === m
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={moods[m - 1]}
              title={moods[m - 1]}
              onClick={() => onChange(m)}
              data-testid={testId ? `${testId}-${m}` : undefined}
              className={`flex size-12 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-95 ${
                on ? 'bg-solid text-on-solid' : 'bg-paper/40 text-ink ring-1 ring-ink/25 backdrop-blur-sm ring-inset hover:bg-ink/10'
              }`}
            >
              {/* The icon's own scale runs from a smile (1) to a frown (5). */}
              <FaceIcon mood={(6 - m) as Mood} className="size-7" strokeWidth={1.5} />
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between px-1 text-fine text-ink-2" aria-hidden>
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  )
}
