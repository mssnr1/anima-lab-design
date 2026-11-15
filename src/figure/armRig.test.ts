import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ARM_JOINTS, armRig } from './armRig'

describe('arm rig', () => {
  // A stand-in arm: points down the left arm's joints and their mirror on the right.
  const joints = [ARM_JOINTS.shoulder, ARM_JOINTS.elbow, ARM_JOINTS.wrist, [0.28, 0.75, 0.05]] as const
  const points = [...joints, ...joints.map(([x, y, z]) => [-x, y, z])].flat()
  const make = () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(points.map(() => 0).map((_, i) => (i % 3 === 0 ? 1 : 0)), 3))
    const mesh = new THREE.Mesh(g)
    new THREE.Group().add(mesh)
    return mesh
  }
  const at = (m: THREE.Mesh, i: number) => new THREE.Vector3().fromBufferAttribute(m.geometry.getAttribute('position'), i)

  it('leaves the arm hanging at rest and keeps the rest position for the lines', () => {
    const mesh = make()
    const rig = armRig(mesh)
    rig.pose({ wrist: [0.19, 1.6, 0.13], fingers: [-1, 0, 0], palm: [0, -1, 0] }, 0)
    for (let i = 0; i < 8; i++) expect(at(mesh, i).distanceTo(new THREE.Vector3(...points.slice(i * 3, i * 3 + 3)))).toBeLessThan(1e-6)
    expect(mesh.geometry.getAttribute('rest').count).toBe(8)
  })

  it('brings both wrists to the goal, mirrored, and the hand points where asked', () => {
    const mesh = make()
    const rig = armRig(mesh)
    rig.pose({ wrist: [0.19, 1.6, 0.13], fingers: [-1, 0, 0], palm: [0, -1, 0] }, 1)
    expect(at(mesh, 2).distanceTo(new THREE.Vector3(0.19, 1.6, 0.13))).toBeLessThan(0.002)
    expect(at(mesh, 6).distanceTo(new THREE.Vector3(-0.19, 1.6, 0.13))).toBeLessThan(0.002)
    // The shoulder stays; the fingertips lie toward the middle of the body, level with the wrist.
    expect(at(mesh, 0).distanceTo(new THREE.Vector3(...ARM_JOINTS.shoulder))).toBeLessThan(1e-6)
    expect(at(mesh, 3).x).toBeLessThan(0.19)
    expect(Math.abs(at(mesh, 3).y - 1.6)).toBeLessThan(0.05)
  })
})
