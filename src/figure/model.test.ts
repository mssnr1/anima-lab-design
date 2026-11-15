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
