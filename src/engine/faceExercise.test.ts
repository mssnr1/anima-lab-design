import { describe, expect, it } from 'vitest'
import { faceExerciseDuration, facePose, type FaceExercise } from './faceExercise'

const ex: FaceExercise = {
  id: 'test',
  intro: [{ label: 'in', durationMs: 1000, muscles: {} }],
  steps: [
    { label: 'up', durationMs: 2000, muscles: { frontalis: 1 } },
    { label: 'hold', durationMs: 2000, muscles: { frontalis: 1 } },
    { label: 'down', durationMs: 1000, muscles: {} },
  ],
  repetitions: 2,
}

describe('face exercise timeline', () => {
  it('lays out intro and repetitions', () => {
    expect(faceExerciseDuration(ex)).toBe(1000 + 2 * 5000)
    expect(facePose(ex, 500).step.label).toBe('in')
    expect(facePose(ex, 500).repetition).toBe(-1)
    expect(facePose(ex, 6500).step.label).toBe('up')
    expect(facePose(ex, 6500).repetition).toBe(1)
  })

  it('eases each muscle from the step before to its target', () => {
    expect(facePose(ex, 1000).muscles.frontalis).toBeCloseTo(0)
    expect(facePose(ex, 2000).muscles.frontalis).toBeCloseTo(0.5)
    expect(facePose(ex, 3500).muscles.frontalis).toBeCloseTo(1)
    expect(facePose(ex, 6000).muscles.frontalis).toBeCloseTo(0)
  })

  it('ends done', () => {
    expect(facePose(ex, 99999).done).toBe(true)
    expect(facePose(ex, 99999).progress).toBe(1)
  })
})
