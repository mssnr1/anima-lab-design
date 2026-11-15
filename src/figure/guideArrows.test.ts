import { describe, expect, it } from 'vitest'
import { guideArrows } from './guideArrows'

describe('guide arrows', () => {
  it('mirrors each arrow to the other side and moves the tip as it grows', () => {
    const arrows = guideArrows([{ from: [0.03, 1.64, 0.1], to: [0.03, 1.7, 0.1] }, { from: [0, 1.6, 0.11], to: [0, 1.65, 0.11], single: true }], { color: '#c2457a' })
    // Three arrows, each a shaft and a head.
    expect(arrows.group.children).toHaveLength(6)
    arrows.update(1, 1, 0)
    const heads = arrows.group.children.filter((_, i) => i % 2 === 1)
    expect(heads[0].position.x).toBeCloseTo(0.03)
    expect(heads[1].position.x).toBeCloseTo(-0.03)
    expect(heads[0].position.y).toBeCloseTo(1.7)
    arrows.update(0.5, 1, 0)
    expect(heads[0].position.y).toBeLessThan(1.7)
    arrows.dispose()
  })
})
