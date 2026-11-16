import * as THREE from 'three'
import { pushMixedSkin, readSkin, writeSkin } from './skin'

/**
 * Splits every triangle of an indexed mesh into four, placing each new point on a smooth curve between
 * the two corners of its edge (a cubic that leaves each corner along its surface, so the mesh rounds
 * out instead of staying faceted). Normals, morph targets and skin weights are carried over (averaged at
 * the new points). The head is coarse (7 000 faces): its face moves more smoothly with four times the points.
 *
 * Returns a new geometry; the first vertices keep their ids and positions.
 */
export function subdivided(geometry: THREE.BufferGeometry, split?: (a: THREE.Vector3, b: THREE.Vector3) => boolean): THREE.BufferGeometry {
  const index = geometry.index
  const pos = geometry.attributes.position
  if (!index || !pos) return geometry.clone()
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const nrm = geometry.attributes.normal
  const n = pos.count
  const P: number[] = Array.from({ length: n * 3 }, (_, i) => pos.array[i])
  const N: number[] = Array.from({ length: n * 3 }, (_, i) => nrm.array[i])
  const morphP = (geometry.morphAttributes.position ?? []).map((m) => Array.from(m.array as ArrayLike<number>))
  const morphN = (geometry.morphAttributes.normal ?? []).map((m) => Array.from(m.array as ArrayLike<number>))
  const skin = readSkin(geometry)
  const mids = new Map<string, number>()
  const a3 = new THREE.Vector3()
  const b3 = new THREE.Vector3()
  const na = new THREE.Vector3()
  const nb = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ta = new THREE.Vector3()
  const tb = new THREE.Vector3()
  const mid = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`
    const known = mids.get(key)
    if (known !== undefined) return known
    a3.fromArray(P, a * 3)
    b3.fromArray(P, b * 3)
    na.fromArray(N, a * 3).normalize()
    nb.fromArray(N, b * 3).normalize()
    ab.subVectors(b3, a3)
    // Tangents at both ends: the edge laid into each corner's surface (Hermite midpoint = mean + (ta - tb) / 8).
    ta.copy(ab).addScaledVector(na, -ab.dot(na))
    tb.copy(ab).addScaledVector(nb, -ab.dot(nb))
    const m = a3.clone().add(b3).multiplyScalar(0.5).addScaledVector(ta.sub(tb), 0.125)
    const id = P.length / 3
    P.push(m.x, m.y, m.z)
    const nm = na.clone().add(nb).normalize()
    N.push(nm.x, nm.y, nm.z)
    for (const arr of [...morphP, ...morphN]) arr.push((arr[a * 3] + arr[b * 3]) / 2, (arr[a * 3 + 1] + arr[b * 3 + 1]) / 2, (arr[a * 3 + 2] + arr[b * 3 + 2]) / 2)
    if (skin) pushMixedSkin(skin, [[a, 0.5], [b, 0.5]])
    mids.set(key, id)
    return id
  }
  const out: number[] = []
  const pa = new THREE.Vector3()
  const pb = new THREE.Vector3()
  const marked = (a: number, b: number) => !split || split(pa.fromArray(P, a * 3), pb.fromArray(P, b * 3))
  for (let t = 0; t < index.count; t += 3) {
    const v = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
    // Only the marked edges are split; a triangle with one or two of them is cut so it still meets its
    // neighbours edge to edge (no cracks).
    const m = [0, 1, 2].map((k) => (marked(v[k], v[(k + 1) % 3]) ? mid(v[k], v[(k + 1) % 3]) : -1))
    const count = m.filter((x) => x >= 0).length
    if (count === 3) {
      out.push(v[0], m[0], m[2], m[0], v[1], m[1], m[2], m[1], v[2], m[0], m[1], m[2])
    } else if (count === 0) {
      out.push(v[0], v[1], v[2])
    } else if (count === 1) {
      const k = m.findIndex((x) => x >= 0)
      const [a, b, c] = [v[k], v[(k + 1) % 3], v[(k + 2) % 3]]
      out.push(a, m[k], c, m[k], b, c)
    } else {
      // The unmarked edge is k: corners a, b along it, c opposite; mbc on b-c, mca on c-a.
      const k = m.findIndex((x) => x < 0)
      const [a, b, c] = [v[k], v[(k + 1) % 3], v[(k + 2) % 3]]
      const mbc = m[(k + 1) % 3]
      const mca = m[(k + 2) % 3]
      out.push(mca, mbc, c, a, b, mbc, a, mbc, mca)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setIndex(out)
  if (skin) writeSkin(g, skin)
  const named = (src: THREE.BufferAttribute[] | undefined, arrays: number[][]) =>
    arrays.map((arr, i) => {
      const attr = new THREE.Float32BufferAttribute(arr, 3)
      attr.name = src?.[i]?.name ?? ''
      return attr
    })
  if (morphP.length) g.morphAttributes.position = named(geometry.morphAttributes.position as THREE.BufferAttribute[], morphP)
  if (morphN.length) g.morphAttributes.normal = named(geometry.morphAttributes.normal as THREE.BufferAttribute[], morphN)
  g.morphTargetsRelative = geometry.morphTargetsRelative
  g.userData = { ...geometry.userData, subdivided: true }
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}
