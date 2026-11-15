/**
 * Face exercises as timed steps, the face counterpart of the breathing pattern: each step says how hard
 * which muscle areas work at its end (ids from `FACE_AREAS`), and the pose eases there from the step
 * before. Pure: `facePose` maps an elapsed time to a pose, so it never depends on how often it is called.
 * All text comes from the app (`label`, `cue` are whatever the app passes in).
 */
export type FaceStep = {
  /** Short name of the step, e.g. "Heben". */
  label: string
  /** The instruction shown during the step. */
  cue?: string
  durationMs: number
  /** How hard each area works at the end of the step, 0..1; areas left out are at rest. */
  muscles: Record<string, number>
  /** Hold a gentle pulse while the step lasts (0 = none), so a long hold still reads as work. */
  pulse?: number
}

export type FaceExercise = {
  id: string
  /** Steps done once before the repeated ones (getting into position). */
  intro?: FaceStep[]
  /** One repetition. */
  steps: FaceStep[]
  repetitions: number
  /** Steps done once at the end (letting go). */
  outro?: FaceStep[]
}

export type FacePose = {
  /** How hard each area works right now. */
  muscles: Record<string, number>
  step: FaceStep
  /** Repetition (0-based) of the current step, or -1 in the intro and outro. */
  repetition: number
  /** 0..1 within the current step and over the whole exercise. */
  stepProgress: number
  progress: number
  done: boolean
}

type Placed = { step: FaceStep; start: number; repetition: number }

function placed(ex: FaceExercise): { list: Placed[]; total: number } {
  const list: Placed[] = []
  let t = 0
  const add = (step: FaceStep, repetition: number) => {
    list.push({ step, start: t, repetition })
    t += Math.max(0, step.durationMs)
  }
  ex.intro?.forEach((s) => add(s, -1))
  for (let r = 0; r < ex.repetitions; r++) ex.steps.forEach((s) => add(s, r))
  ex.outro?.forEach((s) => add(s, -1))
  return { list, total: t }
}

/** Length of the whole exercise in milliseconds. */
export function faceExerciseDuration(ex: FaceExercise): number {
  return placed(ex).total
}

const ease = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** The pose at `elapsedMs` into the exercise. */
export function facePose(ex: FaceExercise, elapsedMs: number): FacePose {
  const { list, total } = placed(ex)
  if (!list.length) throw new Error('A face exercise needs at least one step')
  const t = Math.min(Math.max(elapsedMs, 0), total)
  let i = list.findIndex((p, k) => t < p.start + p.step.durationMs || k === list.length - 1)
  if (i < 0) i = list.length - 1
  const cur = list[i]
  const from = i > 0 ? list[i - 1].step.muscles : {}
  const to = cur.step.muscles
  const local = cur.step.durationMs > 0 ? (t - cur.start) / cur.step.durationMs : 1
  const k = ease(local)
  const muscles: Record<string, number> = {}
  for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
    let v = (from[id] ?? 0) + ((to[id] ?? 0) - (from[id] ?? 0)) * k
    if (cur.step.pulse && (to[id] ?? 0) > 0) v *= 1 - cur.step.pulse * 0.5 * (1 - Math.cos((t - cur.start) / 900 * Math.PI * 2))
    muscles[id] = Math.min(Math.max(v, 0), 1)
  }
  return { muscles, step: cur.step, repetition: cur.repetition, stepProgress: Math.min(local, 1), progress: total ? t / total : 1, done: elapsedMs >= total }
}
