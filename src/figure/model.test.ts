import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The JSON chunk of a GLB: enough to check structure without decoding meshes. */
function gltfJson(path: string) {
  const buf = readFileSync(path)
  expect(buf.readUInt32LE(0)).toBe(0x46546c67) // "glTF"
  const len = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'))
}

describe('exported anatomy model', () => {
  const gltf = gltfJson('models/atmen-anatomy.glb')
  const meshByNode = Object.fromEntries(
    gltf.nodes.filter((n: { mesh?: number }) => n.mesh !== undefined).map((n: { name: string; mesh: number }) => [n.name, gltf.meshes[n.mesh]]),
  )

  it('keeps every anatomical structure as its own object', () => {
    for (const name of ['Body_Shell', 'Head', 'Arms', 'Legs', 'Nasal_Cavity', 'Trachea', 'Bronchi', 'Lung_Left', 'Lung_Right', 'Heart', 'Diaphragm']) {
      expect(meshByNode[name], name).toBeDefined()
    }
  })

  it('has the morph targets the app drives', () => {
    const targets = (name: string) => meshByNode[name].extras?.targetNames
    for (const name of ['Lung_Left', 'Lung_Right', 'Diaphragm', 'Body_Shell', 'Arms']) expect(targets(name)).toContain('Inhale')
    expect(targets('Heart')).toContain('Beat')
    expect(meshByNode.Lung_Left.primitives[0].targets.length).toBe(1)
  })

  it('carries its licence and materials', () => {
    expect(gltf.asset.copyright).toMatch(/CC BY-SA 4\.0/)
    expect(gltf.materials.map((m: { name: string }) => m.name).sort()).toEqual(['Airway', 'Diaphragm', 'Heart', 'Lung', 'Skin'])
  })
})

describe('rigged figure model', () => {
  const gltf = gltfJson('models/anima-figure.glb')
  const nodes = gltf.nodes as { name: string; mesh?: number; skin?: number }[]
  const meshByNode = Object.fromEntries(nodes.filter((n) => n.mesh !== undefined).map((n) => [n.name, gltf.meshes[n.mesh!]]))
  const jointNames = new Set((gltf.skins[0].joints as number[]).map((j) => nodes[j].name))

  it('has the same structures, skinned, plus a dark mouth inside', () => {
    for (const name of ['Body_Shell', 'Head', 'Arms', 'Legs', 'Nasal_Cavity', 'Trachea', 'Bronchi', 'Lung_Left', 'Lung_Right', 'Heart', 'Diaphragm', 'Mouth_Inner']) {
      expect(meshByNode[name], name).toBeDefined()
      expect(nodes.find((n) => n.name === name)!.skin, name).toBeDefined()
      expect(meshByNode[name].primitives[0].attributes.JOINTS_0, name).toBeDefined()
    }
  })

  it('has the bones the apps pose', () => {
    expect(jointNames.size).toBe(76)
    for (const b of ['DEF-spine', 'DEF-spine.004', 'DEF-spine.005', 'DEF-spine.006', 'DEF-jaw', 'DEF-lip.T', 'DEF-lip.B', 'DEF-lip_corner.L', 'DEF-lip_corner.R'])
      expect(jointNames.has(b), b).toBe(true)
    for (const side of ['L', 'R'])
      for (const b of ['shoulder', 'upper_arm', 'forearm', 'hand', 'thumb.01', 'thumb.03', 'f_index.01', 'f_index.03', 'f_middle.03', 'f_ring.03', 'f_pinky.03'])
        expect(jointNames.has(`DEF-${b}.${side}`), `DEF-${b}.${side}`).toBe(true)
  })

  it('keeps the morph targets, its licence and materials', () => {
    const targets = (name: string) => meshByNode[name].extras?.targetNames
    for (const name of ['Lung_Left', 'Lung_Right', 'Diaphragm', 'Body_Shell', 'Arms']) expect(targets(name)).toContain('Inhale')
    expect(targets('Heart')).toContain('Beat')
    expect(gltf.asset.copyright).toMatch(/CC BY-SA 4\.0/)
    expect(gltf.asset.copyright).toMatch(/rig/)
    expect(gltf.materials.map((m: { name: string }) => m.name).sort()).toEqual(['Airway', 'Diaphragm', 'Heart', 'Lung', 'Mouth', 'Skin'])
  })
})
