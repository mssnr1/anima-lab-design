import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { figureRig, type FigurePoses } from './figurePose'

const poses = JSON.parse(readFileSync('models/anima-figure-poses.json', 'utf8')) as FigurePoses

describe('figure poses', () => {
  it('has rest, the V hand and the round mouth', () => {
    expect(Object.keys(poses).sort()).toEqual(['mouthO', 'rest', 'vHand'])
    expect(Object.keys(poses.rest)).toHaveLength(0)
    expect(Object.keys(poses.mouthO)).toEqual(expect.arrayContaining(['DEF-jaw', 'DEF-lip.T', 'DEF-lip.B', 'DEF-lip_corner.L', 'DEF-lip_corner.R']))
    for (const side of ['L', 'R']) for (const j of ['DEF-upper_arm', 'DEF-forearm', 'DEF-hand', 'DEF-f_index.01', 'DEF-f_ring.02']) expect(poses.vHand[`${j}.${side}`], `${j}.${side}`).toBeDefined()
    // The V hand leaves the face alone, the mouth leaves the arms alone.
    expect(Object.keys(poses.vHand).some((j) => /jaw|lip/.test(j))).toBe(false)
    expect(Object.keys(poses.mouthO).some((j) => /arm|hand|f_|thumb/.test(j))).toBe(false)
  })

  it('blends a pose in by its share and back to rest', () => {
    const root = new THREE.Bone()
    const jaw = new THREE.Bone()
    jaw.name = 'DEF-jaw'
    jaw.position.set(0, 0.1, 0)
    root.add(jaw)
    const open = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.4)
    const rig = figureRig(root, { open: { 'DEF-jaw': { t: [0, 0.1, 0.02], r: [open.x, open.y, open.z, open.w] } } })
    rig.set({ open: 0.5 })
    expect(jaw.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0.2, 5)
    expect(jaw.position.z).toBeCloseTo(0.01, 6)
    rig.set({ open: 1 })
    expect(jaw.quaternion.angleTo(open)).toBeCloseTo(0, 5)
    rig.set({})
    expect(jaw.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 6)
    expect(jaw.position.z).toBe(0)
  })
})
