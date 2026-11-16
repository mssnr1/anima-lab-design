import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { withHolesFilled } from './holes'
import { carrySkin, readSkin } from './skin'
import { subdivided } from './subdivide'

/** A square of two triangles; vertices 0 and 1 follow bone 1, 2 and 3 bone 2. */
function square() {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0], 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4))
  return g
}

describe('skin weights through the shapes', () => {
  it('splits the weights of an edge evenly at its new middle point', () => {
    const fine = subdivided(square())
    const skin = readSkin(fine)!
    expect(skin.index.length).toBe(fine.getAttribute('position').count * 4)
    // The middle of edge 1–2 lies between bone 1 and bone 2.
    const pos = fine.getAttribute('position')
    const mid = Array.from({ length: pos.count }, (_, i) => i).find((i) => Math.abs(pos.getX(i) - 1) < 1e-6 && Math.abs(pos.getY(i) - 0.5) < 1e-6)!
    const w = Object.fromEntries([0, 1, 2, 3].map((k) => [skin.index[mid * 4 + k], skin.weight[mid * 4 + k]]))
    expect(w[1]).toBeCloseTo(0.5)
    expect(w[2]).toBeCloseTo(0.5)
  })

  it('gives the points of a cap the weights of the rim it closes', () => {
    // A ring of 12 points round a hole (a band of quads between radius 1 and 2), all on bone 3.
    const p: number[] = []
    const idx: number[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      p.push(Math.cos(a) * 0.01, Math.sin(a) * 0.01, 0, Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0)
      const j = (i + 1) % 12
      idx.push(i * 2, i * 2 + 1, j * 2 + 1, i * 2, j * 2 + 1, j * 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: 24 * 4 }, (_, i) => (i % 4 === 0 ? 3 : 0)), 4))
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: 24 * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4))
    const closed = withHolesFilled(g, 1)!
    const skin = readSkin(closed)!
    expect(closed.getAttribute('position').count).toBeGreaterThan(24)
    expect(skin.index.length).toBe(closed.getAttribute('position').count * 4)
    for (let v = 24; v < closed.getAttribute('position').count; v++) {
      expect(skin.index[v * 4]).toBe(3)
      expect(skin.weight[v * 4]).toBeCloseTo(1)
    }
  })

  it('carries a rigid skin to a new shape and leaves unskinned meshes alone', () => {
    const rigid = square()
    rigid.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 5 : 0)), 4))
    const shape = new THREE.BoxGeometry()
    carrySkin(rigid, shape)
    expect(readSkin(shape)!.index.filter((_, i) => i % 4 === 0).every((b) => b === 5)).toBe(true)
    const plain = new THREE.BoxGeometry()
    carrySkin(new THREE.BoxGeometry(), plain)
    expect(plain.getAttribute('skinIndex')).toBeUndefined()
  })
})
