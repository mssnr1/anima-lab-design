import * as THREE from 'three'

/** The mouth: where the lips meet (world metres) and the half size of the slit between them. */
export const LIPS = { y: 1.515, z: 0.08, halfWidth: 0.022, halfHeight: 0.007 }
/** Where the head's lips meet (the seam between them, measured on the model): the mouth opens here. */
export const MOUTH = { y: 1.53, z: 0.09 }

type Hole = { verts: number[]; center: THREE.Vector3; normal: THREE.Vector3; radius: number; aspect: number; length: number }

const smooth = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1)
  return x * x * (3 - 2 * x)
}

/**
 * A calm face for the end of the exercise, shaped from the head's own skin:
 * the eyelids close (the upper lid comes down over the eye opening to meet
 * the lower one, which rises a little; the filled opening becomes a closed lid
 * over the eyeball) and the corners of the mouth lift into a soft smile.
 *
 * Adds it as a relative morph target `Calm` (positions and normals) to a head
 * geometry with its holes filled (see `withHolesFilled`). `matrix` is the
 * head's world matrix: the shaping is worked out in world metres.
 */
export function addCalmMorph(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): boolean {
  const holes = (geometry.userData.holes ?? []) as Hole[]
  const baseCount = (geometry.userData.baseCount as number | undefined) ?? 0
  const pos = geometry.attributes.position as THREE.BufferAttribute
  if (!pos || !holes.length) return false
  const scale = new THREE.Vector3().setFromMatrixScale(matrix).x
  const inv = matrix.clone().invert()
  const n = pos.count
  const world = Array.from({ length: n }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(matrix))
  const moved = world.map((p) => p.clone())

  // The eye openings: the two wide, forward-facing loops between nose and brows.
  const eyes = holes
    .map((h) => ({ ...h, at: h.center.clone().applyMatrix4(matrix), r: h.radius * scale }))
    .filter((h) => h.r > 0.006 && h.aspect < 3 && h.at.z > 0.05 && Math.abs(h.at.x) > 0.015 && h.at.y > LIPS.y + 0.04 && h.at.y < LIPS.y + 0.09)
  const ring = new Set<number>()
  for (const e of eyes) {
    const loop = e.verts.map((i) => world[i])
    const a = Math.max(...loop.map((p) => Math.abs(p.x - e.at.x))) * 1.02
    const top = Math.max(...loop.map((p) => p.y - e.at.y))
    const bottom = Math.min(...loop.map((p) => p.y - e.at.y))
    const front = loop.reduce((s, p) => s + p.z, 0) / loop.length
    // Height of the upper and lower edge of the opening across it, and where the closed lids meet (low, as in sleep).
    const across = (dx: number) => Math.sqrt(Math.max(0, 1 - (dx / a) ** 2))
    const upper = (dx: number) => top * across(dx)
    const lower = (dx: number) => bottom * across(dx)
    const seam = (dx: number) => lower(dx) + 0.3 * (upper(dx) - lower(dx))
    const bandUp = e.r * 1.4
    const bandDown = e.r * 0.7
    e.verts.forEach((i) => ring.add(i))
    for (let i = 0; i < n; i++) {
      const p = world[i]
      const dx = p.x - e.at.x
      const dy = p.y - e.at.y
      if (Math.abs(dx) > a * 1.25 || dy > top + bandUp || dy < bottom - bandDown || p.z < e.at.z - 0.03) continue
      const fade = 1 - smooth((Math.abs(dx) - a * 0.9) / (a * 0.35))
      if (i >= baseCount) {
        // The fill inside the opening: becomes the closed lid, a gentle curve over the eyeball.
        // The seam between the lids sits a little in: a fine crease the lines dip into.
        moved[i].set(p.x, e.at.y + seam(dx), front + 0.001 * across(dx))
        continue
      }
      const s = seam(dx)
      // A fine groove where the lids meet, so the closed eye shows as a curve in the lines.
      moved[i].z -= 0.0025 * Math.exp(-(((dy - s) / 0.0028) ** 2)) * fade * across(dx * 0.9)
      if (dy >= s) {
        // Upper lid: its edge comes down to the seam, the skin above follows less and less.
        const u = (dy - upper(dx)) / bandUp
        moved[i].y -= (upper(dx) - s) * (1 - smooth(u)) * fade * (dy >= upper(dx) - 1e-4 || ring.has(i) ? 1 : 0)
        // The lid rounds forward over the eye as it closes, fullest just above the seam.
        moved[i].z += 0.0045 * (1 - smooth(u)) * fade * across(dx)
      } else {
        // Lower lid: rises a touch to meet it.
        const u = (lower(dx) - dy) / bandDown
        moved[i].y += (s - lower(dx)) * (1 - smooth(u)) * fade * (dy <= lower(dx) + 1e-4 || ring.has(i) ? 1 : 0)
        moved[i].z += 0.002 * (1 - smooth(u)) * fade * across(dx)
      }
    }
  }

  // The smile: a soft groove along the lips' seam whose ends rise, plus the corners lifting a
  // little and the cheeks rounding. Where the skin turns into the groove the lines darken (they are
  // drawn stronger where the surface turns away), so the smile shows in the lines themselves.
  const SMILE_HALF = LIPS.halfWidth * 1.35
  const smileY = (x: number) => MOUTH.y + 0.007 * (x / SMILE_HALF) ** 2
  for (let i = 0; i < n; i++) {
    const p = world[i]
    if (p.z < 0.04 || Math.abs(p.y - MOUTH.y) > 0.045) continue
    const along = 1 - smooth((Math.abs(p.x) - SMILE_HALF * 0.85) / (SMILE_HALF * 0.3))
    const groove = Math.exp(-(((p.y - smileY(p.x)) / 0.0032) ** 2)) * along
    moved[i].z -= 0.003 * groove
    for (const side of [-1, 1]) {
      const cx = side * (LIPS.halfWidth + 0.002)
      const w = Math.exp(-(((p.x - cx) / 0.011) ** 2) - ((p.y - MOUTH.y) / 0.011) ** 2)
      const cheek = Math.exp(-(((p.x - side * 0.04) / 0.016) ** 2) - ((p.y - (MOUTH.y + 0.022)) / 0.014) ** 2)
      moved[i].y += 0.003 * w + 0.0015 * cheek
      moved[i].x += side * 0.0012 * w
      moved[i].z += 0.0025 * cheek
    }
  }

  // Relative morph: local-space differences, for positions and for normals (so the rim light follows the new shape).
  const delta = new Float32Array(n * 3)
  const local = new THREE.Vector3()
  const shaped = geometry.clone()
  const shapedPos = shaped.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < n; i++) {
    local.copy(moved[i]).applyMatrix4(inv)
    shapedPos.setXYZ(i, local.x, local.y, local.z)
    delta[i * 3] = local.x - pos.getX(i)
    delta[i * 3 + 1] = local.y - pos.getY(i)
    delta[i * 3 + 2] = local.z - pos.getZ(i)
  }
  shaped.computeVertexNormals()
  const normals = geometry.attributes.normal as THREE.BufferAttribute | undefined
  const before = geometry.clone()
  before.computeVertexNormals()
  const nd = new Float32Array(n * 3)
  const sn = shaped.attributes.normal
  const bn = before.attributes.normal
  for (let i = 0; i < n * 3; i++) nd[i] = sn.array[i] - bn.array[i]
  shaped.dispose()
  before.dispose()
  const dp = new THREE.Float32BufferAttribute(delta, 3)
  dp.name = 'Calm'
  geometry.morphAttributes.position = [dp]
  if (normals) {
    const dn = new THREE.Float32BufferAttribute(nd, 3)
    dn.name = 'Calm'
    geometry.morphAttributes.normal = [dn]
  }
  geometry.morphTargetsRelative = true
  geometry.userData.calmMorph = true
  return true
}

/**
 * Lets the mouth open: a relative morph target `jaw` (positions and normals) that swings the lower lip,
 * chin and jaw down round the jaw joint, and a vertex attribute `mouthGap` that tells the face shader
 * where the gap between the lips lies (see `faceMuscleMaterial`), so it can draw the open mouth dark.
 *
 * The skin along the lips' seam stretches into the opening; the finer the mesh there, the cleaner the
 * gap. `matrix` is the head's world matrix.
 */
export function addJawMorph(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, angle = 0.16): boolean {
  const pos = geometry.attributes.position as THREE.BufferAttribute
  if (!pos) return false
  const n = pos.count
  const world = Array.from({ length: n }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(matrix))
  // Where the lips meet: the head's lips are joined skin (only a small hole is left between them), so
  // the mouth opens along their seam, at MOUTH, a hair higher at the corners as the lips curve.
  const hw = LIPS.halfWidth
  const line = (x: number) => MOUTH.y + 0.001 * (x / hw) ** 2
  const lips = { at: new THREE.Vector3(0, MOUTH.y, MOUTH.z) }
  const sides = new Float32Array(n)
  const weight = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = world[i]
    const ly = line(Math.max(-hw, Math.min(hw, p.x)))
    // Within the mouth the slit parts upper from lower lip; past its corners the skin stretches over a band.
    const side = Math.max(-1, Math.min(1, (p.y - ly) / 0.0025))
    const inMouth = Math.abs(p.x) < hw && p.z > lips.at.z - 0.02
    // The lips' seam is marked (1 on it, 0 a millimetre off and everywhere else): opened, the skin
    // stretched between the lips takes the mark and the shader draws it as the dark opening.
    // Points on the seam itself (within a third of a millimetre) take the full mark, so the closed seam can be
    // drawn as one even line.
    sides[i] = inMouth ? 1 - Math.max(0, Math.min(1, (Math.abs(p.y - ly) - 0.0003) / 0.0025)) : 0
    // Upper lip stays, lower lip goes with the jaw, points between the lips half way; the gap is widest in
    // the middle and closes toward the corners, so the opening is round. Past them the skin stretches.
    const split = (1 - side) / 2
    const band = smooth((ly + 0.008 - p.y) / 0.026)
    const across = inMouth ? Math.sqrt(Math.max(0, 1 - (p.x / hw) ** 2)) : 0
    let w = band + (split - band) * across
    // The jaw: in front of the joint, fading toward the ears and down the neck.
    w *= smooth((p.z + 0.02) / 0.05) * (1 - smooth((Math.abs(p.x) - 0.06) / 0.03)) * smooth((p.y - 1.4) / 0.05)
    weight[i] = w
  }
  const pivot = new THREE.Vector3(0, MOUTH.y + 0.035, -0.02)
  const q = new THREE.Quaternion()
  const inv = matrix.clone().invert()
  const local = new THREE.Vector3()
  const deltas = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    if (weight[i] <= 0) continue
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle * weight[i])
    const moved = world[i].clone().sub(pivot).applyQuaternion(q).add(pivot)
    local.copy(moved).applyMatrix4(inv)
    deltas[i * 3] = local.x - pos.getX(i)
    deltas[i * 3 + 1] = local.y - pos.getY(i)
    deltas[i * 3 + 2] = local.z - pos.getZ(i)
  }
  geometry.setAttribute('mouthGap', new THREE.Float32BufferAttribute(sides, 1))
  // Normals of the opened shape, as differences from the resting ones.
  const before = geometry.clone()
  before.morphAttributes = {}
  before.computeVertexNormals()
  const shaped = before.clone()
  const sp = shaped.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < n; i++) sp.setXYZ(i, pos.getX(i) + deltas[i * 3], pos.getY(i) + deltas[i * 3 + 1], pos.getZ(i) + deltas[i * 3 + 2])
  shaped.computeVertexNormals()
  const bn = before.attributes.normal.array
  const sn = shaped.attributes.normal.array
  const nd = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) nd[i] = sn[i] - bn[i]
  before.dispose()
  shaped.dispose()
  const dp = new THREE.Float32BufferAttribute(deltas, 3)
  dp.name = 'jaw'
  const dn = new THREE.Float32BufferAttribute(nd, 3)
  dn.name = 'jaw'
  const positions = geometry.morphAttributes.position ?? []
  const normals = geometry.morphAttributes.normal ?? positions.map((p) => new THREE.Float32BufferAttribute(new Float32Array(p.count * 3), 3))
  positions.push(dp)
  normals.push(dn)
  geometry.morphAttributes.position = positions
  geometry.morphAttributes.normal = normals
  geometry.morphTargetsRelative = true
  return true
}
