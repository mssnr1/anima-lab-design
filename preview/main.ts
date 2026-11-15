import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import modelUrl from '../models/atmen-anatomy.glb?url'
import riggedUrl from '../models/anima-figure.glb?url'
import figurePoses from '../models/anima-figure-poses.json'
import { facePose } from '../src/engine/faceExercise'
import { BROW_LIFT } from './exercises'
import { FACE_AREAS, FACE_MUSCLES, FACE_PALETTES, faceActivation, faceMuscleMaterial, faceMuscleRig, figureRig, legsShape, limbAxis, makeStripeMaterials, muscleHead, STRIPE_PALETTES, type FigurePoses } from '../src/figure'

/**
 * A look at the face map on the shared figure, outside any app. Query parameters:
 * `theme=dark`, `view=front|side|both`, `act=zygomaticusLeft:1,frontalis:0.6` (lit and moved areas),
 * `demo` (areas take turns), `shot` (no buttons, for screenshots), `model=rigged` (the figure with its skeleton)
 * with `pose=vHand:1,mouthO:0.5` (poses from `models/anima-figure-poses.json`), `cam=x,y,z,tx,ty,tz`.
 */
const q = new URLSearchParams(location.search)
const dark = q.get('theme') === 'dark'
document.body.classList.toggle('dark', dark)
document.body.classList.toggle('shot', q.has('shot'))
const view = q.get('view') ?? 'both'

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor(dark ? 0x0d1120 : 0xfbfbf9, 1)
renderer.autoClear = false
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const activation = faceActivation()
const faceMaterial = faceMuscleMaterial({ palette: FACE_PALETTES[dark ? 'dark' : 'light'], dark, activation })
const stripes = makeStripeMaterials(STRIPE_PALETTES[dark ? 'dark' : 'light'], dark, { value: 99 })

const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)
const isRigged = q.get('model') === 'rigged'
const gltf = await loader.loadAsync(isRigged ? riggedUrl : modelUrl)
const model = gltf.scene
model.updateMatrixWorld(true)
const rigged: THREE.Mesh[] = []
const copies: [THREE.Mesh, THREE.Object3D][] = []
model.traverse((o) => {
  const mesh = o as THREE.Mesh
  if (!mesh.isMesh) return
  if (mesh.name === 'Mouth_Inner') {
    // The dark inside of the open mouth (rigged figure only).
    // Pushed back a little in depth: where its rim meets the lips, the lips stay in front.
    mesh.material = new THREE.MeshBasicMaterial({ color: dark ? 0x05060c : 0x2b2530, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 64 })
    mesh.renderOrder = 0.15
    return
  }
  if (!['Head', 'Body_Shell', 'Arms', 'Legs'].includes(mesh.name)) {
    mesh.visible = false
    return
  }
  if (mesh.name === 'Head') {
    mesh.geometry = muscleHead(mesh)
    mesh.updateMorphTargets()
    rigged.push(mesh)
  }
  if (mesh.name === 'Legs') mesh.geometry = legsShape(mesh)
  if (mesh.name === 'Arms' && isRigged) limbAxis(mesh)
  mesh.material = mesh.name === 'Head' || mesh.name === 'Body_Shell' ? faceMaterial : mesh.name === 'Arms' && isRigged ? stripes.limbs : stripes.skin
  mesh.renderOrder = 0.2
  const depth = mesh.clone(false)
  depth.material = stripes.skinDepth
  depth.renderOrder = 0.1
  copies.push([depth, mesh.parent ?? model])
  if (mesh.name === 'Head') rigged.push(depth)
})
copies.forEach(([c, parent]) => parent.add(c))
scene.add(model)
const rig = faceMuscleRig(activation, rigged, q.has('still') ? 0 : 1)

const bones = figureRig(model, figurePoses as FigurePoses)
bones.set(Object.fromEntries((q.get('pose') ?? '').split(',').filter(Boolean).map((p) => [p.split(':')[0], Number(p.split(':')[1] ?? 1)])))

for (const part of (q.get('act') ?? '').split(',').filter(Boolean)) {
  const [id, amount] = part.split(':')
  rig.set(id, Number(amount ?? 1))
}

// Buttons: one per muscle area.
const ui = document.getElementById('ui')!
for (const id of FACE_MUSCLES) {
  const b = document.createElement('button')
  b.textContent = `${FACE_AREAS.find((a) => a.id === id)!.label} ${/Left$/.test(id) ? 'L' : /Right$/.test(id) ? 'R' : ''}`
  b.onclick = () => {
    rig.set(id, rig.get(id) > 0 ? 0 : 1)
    b.classList.toggle('on', rig.get(id) > 0)
  }
  ui.appendChild(b)
}

const target = new THREE.Vector3(0, 1.585, 0.02)
const cams = (view === 'both' ? ['front', 'side'] : [view]).map((v) => {
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 10)
  const angle = v === 'side' ? 0.62 : 0
  const dist = 0.62
  cam.position.set(Math.sin(angle) * dist, target.y + 0.04, Math.cos(angle) * dist)
  cam.lookAt(target)
  const c = q.get('cam')?.split(',').map(Number)
  if (c?.length === 6) {
    cam.position.set(c[0], c[1], c[2])
    cam.lookAt(c[3], c[4], c[5])
  }
  return cam
})

const demo = q.has('demo')
const exercise = q.get('exercise') === 'brow' ? BROW_LIFT : null
const fixedT = q.has('t') ? Number(q.get('t')) : null
const caption = document.createElement('div')
caption.id = 'caption'
document.body.appendChild(caption)
const clock = new THREE.Clock()
function frame() {
  const w = innerWidth
  const h = innerHeight
  renderer.setSize(w, h, false)
  if (demo) {
    const t = clock.getElapsedTime()
    FACE_MUSCLES.forEach((id, i) => {
      const phase = t * 0.9 - i * 0.7
      rig.set(id, Math.max(0, Math.sin(phase)) ** 2 * (Math.floor(phase / Math.PI) % 2 === 0 ? 1 : 0))
    })
  }
  if (exercise) {
    const pose = facePose(exercise, fixedT ?? (clock.getElapsedTime() * 1000) % 140000)
    for (const id of FACE_MUSCLES) rig.set(id, pose.muscles[id] ?? 0)
    const rep = pose.repetition >= 0 ? ` · ${pose.repetition + 1}/${exercise.repetitions}` : ''
    caption.innerHTML = `<b>${pose.step.label}${rep}</b><span>${pose.step.cue ?? ''}</span>`
  }
  renderer.clear()
  const part = w / cams.length
  cams.forEach((cam, i) => {
    cam.aspect = part / h
    cam.updateProjectionMatrix()
    renderer.setViewport(i * part, 0, part, h)
    renderer.render(scene, cam)
  })
  // A still (a fixed time in an exercise, or a screenshot) needs only a few frames.
  if (!(q.has('shot') && !demo && (fixedT !== null || !exercise)) || ++frames < 3) requestAnimationFrame(frame)
}
let frames = 0
frame()
;(window as unknown as { ready: boolean }).ready = true
