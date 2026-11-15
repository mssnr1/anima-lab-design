import * as THREE from 'three'

/**
 * Skin weights through the runtime shapes: the rigged figure (`models/anima-figure.glb`) carries per vertex
 * up to four bones (`skinIndex`) and their weights (`skinWeight`). Shapes that add vertices (holes closed
 * with caps, subdivision) give every new vertex a mix of the weights of the vertices it lies between, so the
 * finer or closed mesh moves with the skeleton exactly like the original one.
 */
export type Skin = { index: number[]; weight: number[] }

/** The skin of a geometry as plain arrays (4 per vertex), or null when it has none. */
export function readSkin(geometry: THREE.BufferGeometry): Skin | null {
  const si = geometry.getAttribute('skinIndex')
  const sw = geometry.getAttribute('skinWeight')
  if (!si || !sw) return null
  const index: number[] = []
  const weight: number[] = []
  for (let i = 0; i < si.count; i++) {
    for (let k = 0; k < 4; k++) {
      index.push(si.getComponent(i, k))
      weight.push(sw.getComponent(i, k))
    }
  }
  return { index, weight }
}

/** Appends a vertex whose weights are the given mix of existing vertices (keeps the four strongest bones). */
export function pushMixedSkin(skin: Skin, parts: ReadonlyArray<readonly [vertex: number, share: number]>): void {
  const sum = new Map<number, number>()
  for (const [v, share] of parts) {
    for (let k = 0; k < 4; k++) {
      const w = skin.weight[v * 4 + k] * share
      if (w > 0) sum.set(skin.index[v * 4 + k], (sum.get(skin.index[v * 4 + k]) ?? 0) + w)
    }
  }
  const top = [...sum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const total = top.reduce((s, [, w]) => s + w, 0) || 1
  for (let k = 0; k < 4; k++) {
    skin.index.push(top[k]?.[0] ?? 0)
    skin.weight.push((top[k]?.[1] ?? 0) / total)
  }
}

/** Sets the skin attributes of a geometry from plain arrays. */
export function writeSkin(geometry: THREE.BufferGeometry, skin: Skin): void {
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skin.index, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skin.weight, 4))
}

/**
 * Gives a shape worked out from a skinned mesh the mesh's skin: vertex for vertex when it has the same
 * vertices (e.g. the tidied legs), or the one bone the whole mesh follows when it is rigid (lungs, airway,
 * which ride on the chest). A shape without a skin on a skinned mesh would collapse to the origin.
 */
export function carrySkin(source: THREE.BufferGeometry, target: THREE.BufferGeometry): void {
  const skin = readSkin(source)
  if (!skin || target.getAttribute('skinIndex')) return
  const n = target.getAttribute('position').count
  if (n === source.getAttribute('position').count) return writeSkin(target, skin)
  const bone = skin.index[0]
  const rigid = skin.weight.every((w, i) => (i % 4 === 0 ? skin.index[i] === bone && w > 0.999 : w < 1e-3))
  if (!rigid) return
  writeSkin(target, {
    index: Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? bone : 0)),
    weight: Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
  })
}
