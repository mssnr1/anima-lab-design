import { describe, expect, it } from 'vitest'
import { guideArrows } from './guideArrows'

describe('guide arrows', () => {
  it('mirrors each arrow to the other side and moves the tip as it grows', () => {
    const arrows = guideArrows([{ from: [0.03, 1.64, 0.1], to: [0.03, 1.7, 0.1] }, { from: [0, 1.6, 0.11], to: [0, 1.65, 0.11], single: true }], { color: '#c2457a' })
    // Three arrows, each one surface.
    expect(arrows.group.children).toHaveLength(3)
    arrows.update(1, 1, 0)
    const [left, right] = arrows.tips()
    expect(left.x).toBeCloseTo(0.03)
    expect(right.x).toBeCloseTo(-0.03)
    expect(left.y).toBeCloseTo(1.7)
    arrows.update(0.5, 1, 0)
    expect(arrows.tips()[0].y).toBeLessThan(1.7)
    arrows.dispose()
  })
})
