import * as THREE from 'three'
import { addLimbAxis } from './limbs'

/**
 * Moves the figure's arms (the `Arms` mesh, which has no skeleton) so it can show a movement with its
 * own hands, e.g. the index fingers laid under the brows. Each arm is a chain of three rigid parts,
 * upper arm, forearm and hand, joined at shoulder, elbow and wrist; every vertex follows the parts
 * near it, blended softly across each joint. The top of the upper arm stays where it meets the
 * shoulder. A pose is given for the figure's left arm (+x) and mirrored for the right.
 *
 * The rig bakes the mesh into world space (float positions and normals, morph targets dropped) and keeps
 * the unposed position as a `rest` attribute and the hanging arm's `axis`, so `posedLimbs` from
 * `makeStripeMaterials` keeps its lines running round each arm, on the skin, while the arm moves.
 */
export type ArmGoal = {
  /** Where the wrist goes, world metres, left arm. */
  wrist: readonly [number, number, number]
  /** Which way the fingers point. */
  fingers: readonly [number, number, number]
  /** Which way the palm faces. */
  palm: readonly [number, number, number]
  /** Which way the elbow leans out (from the line shoulder to wrist). */
  elbow?: readonly [number, number, number]
}

/** The joints of the left arm of the shared model, world metres (measured from the mesh). */
export const ARM_JOINTS = {
  shoulder: [0.195, 1.31, -0.04],
  elbow: [0.257, 1.03, -0.02],
  wrist: [0.297, 0.865, 0.022],
  /** Direction from wrist to fingertips and the way the palm faces, at rest (hanging, palm to the thigh). */
  fingers: [-0.24, -0.95, 0.2],
  palm: [-1, 0, 0],
} as const

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2])
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** A rotation turning the frame (fingers, palm) into the frame (fingers2, palm2). */
function frameRotation(f0: THREE.Vector3, p0: THREE.Vector3, f1: THREE.Vector3, p1: THREE.Vector3) {
  const basis = (f: THREE.Vector3, p: THREE.Vector3) => {
    const x = f.clone().normalize()
    const y = p.clone().sub(x.clone().multiplyScalar(p.dot(x))).normalize()
    const z = x.clone().cross(y)
    return new THREE.Matrix4().makeBasis(x, y, z)
  }
  const m = basis(f1, p1).multiply(basis(f0, p0).transpose())
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

export function armRig(mesh: THREE.Mesh) {
  mesh.updateWorldMatrix(true, false)
  const src = mesh.geometry
  const pos = src.getAttribute('position')
  const nor = src.getAttribute('normal')
  const n = pos.count
  const rest = new Float32Array(n * 3)
  const restN = new Float32Array(n * 3)
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).toArray(rest, i * 3)
    v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize().toArray(restN, i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(src.getIndex())
  geometry.setAttribute('position', new THREE.BufferAttribute(rest.slice(), 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(restN.slice(), 3))
  geometry.setAttribute('rest', new THREE.BufferAttribute(rest, 3))
  for (const name of Object.keys(src.attributes)) if (!['position', 'normal'].includes(name)) geometry.setAttribute(name, src.getAttribute(name))
  // The lines run round each arm, measured on the hanging arm (see `posedLimbs`).
  addLimbAxis(geometry)
  geometry.computeBoundingSphere()
  geometry.boundingSphere!.radius += 0.6
  mesh.geometry = geometry
  mesh.morphTargetInfluences = undefined
  mesh.morphTargetDictionary = undefined
  // The geometry is in world space now: the mesh undoes its parents' transform.
  mesh.matrixAutoUpdate = false
  mesh.matrix.copy(mesh.parent ? mesh.parent.matrixWorld : new THREE.Matrix4()).invert()
  mesh.matrixWorldNeedsUpdate = true

  // Weights: shoulder (fixed), upper arm, forearm, hand, by height along the hanging arm.
  const J = { s: v3(ARM_JOINTS.shoulder), e: v3(ARM_JOINTS.elbow), w: v3(ARM_JOINTS.wrist) }
  const weights = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const y = rest[i * 3 + 1]
    const fixed = smooth(1.25, 1.31, y)
    const upper = smooth(J.e.y - 0.035, J.e.y + 0.035, y)
    const fore = smooth(J.w.y - 0.012, J.w.y + 0.012, y)
    weights[i * 4] = fixed
    weights[i * 4 + 1] = (1 - fixed) * upper
    weights[i * 4 + 2] = (1 - fixed) * (1 - upper) * fore
    weights[i * 4 + 3] = (1 - fixed) * (1 - upper) * (1 - fore)
  }

  const l1 = J.e.distanceTo(J.s)
  const l2 = J.w.distanceTo(J.e)
  const restUpper = J.e.clone().sub(J.s).normalize()
  const restFore = J.w.clone().sub(J.e).normalize()
  const restFingers = v3(ARM_JOINTS.fingers).normalize()
  const restPalm = v3(ARM_JOINTS.palm)

  /** Bone rotations for a goal: upper arm, forearm, hand (world). */
  function solve(goal: ArmGoal) {
    const target = v3(goal.wrist)
    const d = Math.min(target.distanceTo(J.s), l1 + l2 - 1e-4)
    const u = target.clone().sub(J.s).normalize()
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0))
    const hint = v3(goal.elbow ?? [1, -0.5, 0.3])
    const out = hint.sub(u.clone().multiplyScalar(hint.dot(u))).normalize()
    const elbow = J.s.clone().add(u.clone().multiplyScalar(a)).add(out.multiplyScalar(h))
    const wrist = J.s.clone().add(u.multiplyScalar(d))
    const qU = new THREE.Quaternion().setFromUnitVectors(restUpper, elbow.clone().sub(J.s).normalize())
    const qH = frameRotation(restFingers, restPalm, v3(goal.fingers), v3(goal.palm))
    // The forearm turns its axis onto the new one, and takes half the hand's twist about it.
    const foreDir = wrist.clone().sub(elbow).normalize()
    const swing = new THREE.Quaternion().setFromUnitVectors(restFore, foreDir)
    const rel = swing.clone().invert().multiply(qH)
    const axis = restFore.clone()
    const proj = new THREE.Vector3(rel.x, rel.y, rel.z).projectOnVector(axis)
    const twist = new THREE.Quaternion(proj.x, proj.y, proj.z, rel.w).normalize()
    const qF = swing.multiply(new THREE.Quaternion().slerp(twist, 0.5))
    return { qU, qF, qH }
  }

  const q = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]
  const piv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const to = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const p = new THREE.Vector3()
  const nn = new THREE.Vector3()
  const acc = new THREE.Vector3()
  const accN = new THREE.Vector3()
  const t = new THREE.Vector3()
  let solved: { goal: ArmGoal; r: ReturnType<typeof solve> } | null = null

  return {
    /** Moves both arms `amount` (0 = hanging, 1 = there) of the way to `goal`. */
    pose(goal: ArmGoal | null, amount: number) {
      const k = goal ? Math.min(Math.max(amount, 0), 1) : 0
      if (goal && solved?.goal !== goal) solved = { goal, r: solve(goal) }
      const id = new THREE.Quaternion()
      const qU = id.clone().slerp(solved?.r.qU ?? id, k)
      const qF = id.clone().slerp(solved?.r.qF ?? id, k)
      const qH = id.clone().slerp(solved?.r.qH ?? id, k)
      // Forward along the chain, so the parts stay joined at every step of the way.
      const e1 = J.e.clone().sub(J.s).applyQuaternion(qU).add(J.s)
      const w1 = J.w.clone().sub(J.e).applyQuaternion(qF).add(e1)
      q[0].copy(qU), q[1].copy(qF), q[2].copy(qH)
      piv[0].copy(J.s), piv[1].copy(J.e), piv[2].copy(J.w)
      to[0].copy(J.s), to[1].copy(e1), to[2].copy(w1)
      const out = geometry.getAttribute('position') as THREE.BufferAttribute
      const outN = geometry.getAttribute('normal') as THREE.BufferAttribute
      const mirror = new THREE.Quaternion()
      for (let i = 0; i < n; i++) {
        p.fromArray(rest, i * 3)
        nn.fromArray(restN, i * 3)
        const side = p.x < 0 ? -1 : 1
        // The right arm: mirror into the left, pose, mirror back.
        if (side < 0) p.x = -p.x, nn.x = -nn.x
        acc.copy(p).multiplyScalar(weights[i * 4])
        accN.copy(nn).multiplyScalar(weights[i * 4])
        for (let b = 0; b < 3; b++) {
          const w = weights[i * 4 + b + 1]
          if (w === 0) continue
          mirror.copy(q[b])
          t.copy(p).sub(piv[b]).applyQuaternion(mirror).add(to[b])
          acc.addScaledVector(t, w)
          t.copy(nn).applyQuaternion(mirror)
          accN.addScaledVector(t, w)
        }
        if (side < 0) acc.x = -acc.x, accN.x = -accN.x
        accN.normalize()
        out.setXYZ(i, acc.x, acc.y, acc.z)
        outN.setXYZ(i, accN.x, accN.y, accN.z)
      }
      out.needsUpdate = true
      outN.needsUpdate = true
    },
  }
}
