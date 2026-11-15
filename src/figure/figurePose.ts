import * as THREE from 'three'

/**
 * The rigged figure (`models/anima-figure.glb`): the same body as `atmen-anatomy.glb`, with a skeleton
 * (Rigify deform bones `DEF-*`, built by `blender/rig_figure.py`) and a dark mouth inside (`Mouth_Inner`).
 * Head, neck, jaw, lips, arms and every finger joint can turn. Poses made in Blender
 * (`blender/figure_poses.py`) come as `models/anima-figure-poses.json`: per pose the local transform of
 * every joint it moves. Bone names and axes: docs/02-3d-figur-und-shading.md, section "Skelett".
 */
export const RIGGED_MODEL_FILE = 'models/anima-figure.glb'
export const FIGURE_POSES_FILE = 'models/anima-figure-poses.json'

/** One joint's local transform in a pose: translation (metres) and rotation (quaternion x, y, z, w). */
export type JointPose = { t: readonly number[]; r: readonly number[] }
/** Poses by name, each the joints it moves (joints left out stay at rest). */
export type FigurePoses = Record<string, Record<string, JointPose>>

type Rest = { bone: THREE.Bone; t: THREE.Vector3; r: THREE.Quaternion }

/**
 * The joints of a loaded rigged figure by name, with their rest transforms, and a way to blend poses on
 * them (by their names in the GLB; three.js's GLTFLoader drops the dots, `DEF-f_index.01.L` → `DEF-f_index01L`,
 * either form is found): `set({ vHand: 1 })`, `set({ mouthO: 0.5 })`, `set({})` for rest. Several poses at once add up
 * (each as its turn away from rest), so a hand pose and a mouth pose can run together.
 */
export function figureRig(root: THREE.Object3D, poses: FigurePoses) {
  const joints = new Map<string, Rest>()
  root.traverse((o) => {
    const bone = o as THREE.Bone
    if (bone.isBone && !joints.has(bone.name)) joints.set(bone.name, { bone, t: bone.position.clone(), r: bone.quaternion.clone() })
  })
  const turn = new THREE.Quaternion()
  const target = new THREE.Quaternion()
  const step = new THREE.Vector3()
  return {
    joints,
    /** Sets every joint to rest plus the given share (0–1) of each named pose. */
    set(weights: Readonly<Record<string, number>>) {
      for (const { bone, t, r } of joints.values()) {
        bone.position.copy(t)
        bone.quaternion.copy(r)
      }
      for (const [name, w] of Object.entries(weights)) {
        const pose = poses[name]
        if (!pose || !w) continue
        for (const [joint, { t: pt, r: pr }] of Object.entries(pose)) {
          const rest = joints.get(joint) ?? joints.get(THREE.PropertyBinding.sanitizeNodeName(joint))
          if (!rest) continue
          // The pose's turn relative to rest, a share of it, applied on top of what is already set.
          turn.copy(rest.r).invert().multiply(target.set(pr[0], pr[1], pr[2], pr[3]))
          turn.slerp(IDENTITY, 1 - Math.min(Math.max(w, 0), 1))
          rest.bone.quaternion.multiply(turn)
          rest.bone.position.add(step.set(pt[0], pt[1], pt[2]).sub(rest.t).multiplyScalar(w))
        }
      }
    },
  }
}

const IDENTITY = new THREE.Quaternion()
