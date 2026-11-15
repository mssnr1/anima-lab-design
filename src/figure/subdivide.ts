import * as THREE from 'three'

/**
 * Splits every triangle of an indexed mesh into four, placing each new point on a smooth curve between
 * the two corners of its edge (a cubic that leaves each corner along its surface, so the mesh rounds
 * out instead of staying faceted). Normals and morph targets are carried over (averaged at the new
 * points). The head is coarse (7 000 faces): its face moves more smoothly with four times the points.
 *
 * Returns a new geometry; the first vertices keep their ids and positions.
 */
export function subdivided(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
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
    mids.set(key, id)
    return id
  }
  const out: number[] = []
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t)
    const b = index.getX(t + 1)
    const c = index.getX(t + 2)
    const ab2 = mid(a, b)
    const bc = mid(b, c)
    const ca = mid(c, a)
    out.push(a, ab2, ca, ab2, b, bc, ca, bc, c, ab2, bc, ca)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setIndex(out)
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
