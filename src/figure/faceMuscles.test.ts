import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { addMuscleMorphs, FACE_AREA_GLSL, FACE_AREAS, FACE_MUSCLES, faceActivation, faceAreaAt, faceMuscleRig } from './faceMuscles'
import { subdivided } from './subdivide'

describe('face muscle map', () => {
  it('names each area once, paired muscles on both sides', () => {
    const ids = FACE_AREAS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('zygomaticusLeft')
    expect(ids).toContain('zygomaticusRight')
    expect(FACE_MUSCLES).not.toContain('scalp')
    FACE_AREAS.forEach((a, i) => expect(a.index).toBe(i))
  })

  it('puts the face landmarks in their muscle areas', () => {
    const at = (x: number, y: number, z: number) => faceAreaAt(x, y, z).area.id
    expect(at(0.03, 1.59, 0.08)).toBe('orbicularisOculiLeft')
    expect(at(-0.03, 1.59, 0.08)).toBe('orbicularisOculiRight')
    expect(at(0, 1.515, 0.085)).toBe('orbicularisOris')
    expect(at(0, 1.665, 0.09)).toBe('frontalis')
    expect(at(0, 1.565, 0.1)).toBe('nasalis')
    expect(at(0, 1.6, -0.1)).toBe('scalp')
    expect(at(0, 1.2, 0.1)).toBe('body')
  })

  it('is mirror symmetric', () => {
    const mirror = (id: string) => id.replace(/Left$/, '#').replace(/Right$/, 'Left').replace(/#$/, 'Right')
    for (let i = 0; i < 400; i++) {
      const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.1
      const y = 1.4 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 0.3
      const z = 0.02 + (Math.sin(i * 37.719) * 0.5 + 0.5) * 0.08
      expect(faceAreaAt(-x, y, z).area.id).toBe(mirror(faceAreaAt(x, y, z).area.id))
    }
  })

  it('writes every area into the shader', () => {
    expect(FACE_AREA_GLSL).toContain(`float ds[${FACE_AREAS.length}]`)
    for (const a of FACE_AREAS) expect(FACE_AREA_GLSL).toContain(`ds[${a.index}] =`)
  })
})

/** A head-sized sphere where the figure's head is, in local units scaled like the model (0.1117). */
function headSphere() {
  const scale = 0.1117
  const geometry = new THREE.IcosahedronGeometry(0.105 / scale, 6)
  geometry.deleteAttribute('uv')
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(0, 1.6, 0), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale))
  return { geometry, matrix }
}

describe('face muscle movements', () => {
  it('adds one morph per moving area, after the ones already there, moving only its own part of the face', () => {
    const { geometry, matrix } = headSphere()
    const calm = new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3)
    calm.name = 'Calm'
    geometry.morphAttributes.position = [calm]
    geometry.morphTargetsRelative = true
    const names = addMuscleMorphs(geometry, matrix)
    expect(names).toContain('frontalis')
    expect(names).not.toContain('scalp')
    expect(geometry.morphAttributes.position.map((m) => m.name)).toEqual(['Calm', ...names])
    expect(geometry.morphAttributes.normal).toHaveLength(names.length + 1)

    // The brow lifts at the forehead, not at the back of the head.
    const lift = geometry.morphAttributes.position[1 + names.indexOf('frontalis')]
    const pos = geometry.attributes.position
    const w = new THREE.Vector3()
    let front = 0
    let back = 0
    for (let i = 0; i < pos.count; i++) {
      w.fromBufferAttribute(pos, i).applyMatrix4(matrix)
      const dy = lift.getY(i) * 0.1117
      if (faceAreaAt(w.x, w.y, w.z).area.id === 'frontalis') front = Math.max(front, dy)
      if (w.z < -0.05) back = Math.max(back, Math.abs(dy))
    }
    expect(front).toBeGreaterThan(0.002)
    expect(back).toBeLessThan(1e-4)
  })

  it('drives activation and morphs together', () => {
    const { geometry, matrix } = headSphere()
    addMuscleMorphs(geometry, matrix)
    const mesh = new THREE.Mesh(geometry)
    const activation = faceActivation()
    const rig = faceMuscleRig(activation, [mesh])
    rig.set('zygomaticusLeft', 0.7)
    const area = FACE_AREAS.find((a) => a.id === 'zygomaticusLeft')!
    expect(activation.value[area.index]).toBeCloseTo(0.7)
    expect(mesh.morphTargetInfluences![mesh.morphTargetDictionary!.zygomaticusLeft]).toBeCloseTo(0.7)
  })
})

describe('subdivision', () => {
  it('splits each triangle in four, rounding toward the surface and keeping morphs', () => {
    const base = new THREE.IcosahedronGeometry(1, 1)
    base.deleteAttribute('uv')
    const welded = new THREE.BufferGeometry()
    // Indexed copy (Icosahedron is not indexed).
    const pos = base.attributes.position
    welded.setAttribute('position', pos.clone())
    welded.setIndex(Array.from({ length: pos.count }, (_, i) => i))
    // Smooth normals, as on a skin: each points out from the centre.
    welded.setAttribute('normal', pos.clone())
    const m = new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3)
    m.name = 'Calm'
    welded.morphAttributes.position = [m]
    const fine = subdivided(welded)
    expect(fine.index!.count).toBe(welded.index!.count * 4)
    expect(fine.morphAttributes.position![0].name).toBe('Calm')
    expect(fine.morphAttributes.position![0].count).toBe(fine.attributes.position.count)
    // New points lie closer to the sphere than flat midpoints would.
    const p = fine.attributes.position
    const v = new THREE.Vector3()
    let worst = 0
    for (let i = pos.count; i < p.count; i++) worst = Math.max(worst, 1 - v.fromBufferAttribute(p, i).length())
    let flatWorst = 0
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (let t = 0; t < pos.count; t += 3) flatWorst = Math.max(flatWorst, 1 - a.fromBufferAttribute(pos, t).add(b.fromBufferAttribute(pos, t + 1)).multiplyScalar(0.5).length())
    expect(worst).toBeLessThan(flatWorst * 0.5)
  })
})

describe('further movements', () => {
  it('opens the eyes as their own morph and lights the eye area', () => {
    const { geometry, matrix } = headSphere()
    const names = addMuscleMorphs(geometry, matrix)
    expect(names).toContain('orbicularisOculiLeft.open')
    expect(names).toContain('orbicularisOculiRight.open')
    const mesh = new THREE.Mesh(geometry)
    const activation = faceActivation()
    const rig = faceMuscleRig(activation, [mesh], 1.2)
    rig.set('orbicularisOculiRight.open', 0.5)
    const eye = FACE_AREAS.find((a) => a.id === 'orbicularisOculiRight')!
    expect(activation.value[eye.index]).toBeCloseTo(0.5)
    expect(mesh.morphTargetInfluences![mesh.morphTargetDictionary!['orbicularisOculiRight.open']]).toBeCloseTo(0.6)
    // Above the eye the skin moves up, below it down.
    const open = geometry.morphAttributes.position![mesh.morphTargetDictionary!['orbicularisOculiLeft.open']]
    const pos = geometry.attributes.position
    const w = new THREE.Vector3()
    let up = 0
    let down = 0
    for (let i = 0; i < pos.count; i++) {
      w.fromBufferAttribute(pos, i).applyMatrix4(matrix)
      if (faceAreaAt(w.x, w.y, w.z).area.id !== 'orbicularisOculiLeft') continue
      if (w.y > 1.6) up = Math.max(up, open.getY(i))
      if (w.y < 1.575) down = Math.min(down, open.getY(i))
    }
    expect(up).toBeGreaterThan(0)
    expect(down).toBeLessThan(0)
  })

  it('lets an area follow another without lighting it', () => {
    const { geometry, matrix } = headSphere()
    addMuscleMorphs(geometry, matrix)
    const mesh = new THREE.Mesh(geometry)
    const activation = faceActivation()
    const rig = faceMuscleRig(activation, [mesh])
    const nose = FACE_AREAS.find((a) => a.id === 'nasalis')!
    rig.follow('nasalis', 0.3)
    expect(activation.value[nose.index]).toBe(0)
    expect(mesh.morphTargetInfluences![mesh.morphTargetDictionary!.nasalis]).toBeCloseTo(0.3)
    rig.set('nasalis', 0.5)
    expect(mesh.morphTargetInfluences![mesh.morphTargetDictionary!.nasalis]).toBeCloseTo(0.8)
  })
})
