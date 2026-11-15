import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import modelUrl from '../models/anima-figure.glb?url'
import figurePoses from '../models/anima-figure-poses.json'
import { FACE_PALETTES, faceActivation, faceMuscleMaterial, figureRig, legsShape, limbAxis, makeStripeMaterials, muscleHead, STRIPE_PALETTES, type FigurePoses } from '../src/figure'

/**
 * The rigged figure on a phone: night look, the test poses as buttons (blended in softly), swipe to turn.
 * `npm run preview:face`, then `/figur.html`.
 */
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor(0x0d1120, 1)
renderer.autoClear = false
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const faceMaterial = faceMuscleMaterial({ palette: FACE_PALETTES.dark, dark: true, activation: faceActivation() })
const stripes = makeStripeMaterials(STRIPE_PALETTES.dark, true, { value: 99 })

const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)
// A host that serves no .glb files can name the model as base64 text instead (`<body data-model-b64="…">`).
const b64 = document.body.dataset.modelB64
const model = (
  b64
    ? await loader.parseAsync(Uint8Array.from(atob((await (await fetch(b64)).text()).trim()), (c) => c.charCodeAt(0)).buffer, '')
    : await loader.loadAsync(modelUrl)
).scene
model.updateMatrixWorld(true)
const copies: [THREE.Mesh, THREE.Object3D][] = []
model.traverse((o) => {
  const mesh = o as THREE.Mesh
  if (!mesh.isMesh) return
  if (mesh.name === 'Mouth_Inner') {
    mesh.material = new THREE.MeshBasicMaterial({ color: 0x05060c })
    mesh.renderOrder = 0.15
    return
  }
  if (!['Head', 'Body_Shell', 'Arms', 'Legs'].includes(mesh.name)) {
    mesh.visible = false
    return
  }
  if (mesh.name === 'Head') mesh.geometry = muscleHead(mesh)
  if (mesh.name === 'Legs') mesh.geometry = legsShape(mesh)
  if (mesh.name === 'Arms') limbAxis(mesh)
  mesh.updateMorphTargets()
  mesh.material = mesh.name === 'Head' || mesh.name === 'Body_Shell' ? faceMaterial : mesh.name === 'Arms' ? stripes.limbs : stripes.skin
  mesh.renderOrder = 0.2
  const depth = mesh.clone(false)
  depth.material = stripes.skinDepth
  depth.renderOrder = 0.1
  copies.push([depth, mesh.parent ?? model])
})
copies.forEach(([c, parent]) => parent.add(c))
const turntable = new THREE.Group()
turntable.add(model)
scene.add(turntable)

const rig = figureRig(model, figurePoses as FigurePoses)
const names: [string, string][] = [
  ['rest', 'Ruhe'],
  ['vHand', 'V-Hand'],
  ['mouthO', 'Mund O'],
]
const weights: Record<string, number> = { vHand: 0, mouthO: 0 }
let goal = 'rest'
const ui = document.getElementById('ui')!
for (const [id, label] of names) {
  const b = document.createElement('button')
  b.textContent = label
  b.onclick = () => {
    goal = id
    ui.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b))
  }
  if (id === 'rest') b.classList.add('on')
  ui.appendChild(b)
}

// Swipe to turn the figure (back to the front by itself when let go).
let turn = 0
let drag: number | null = null
addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).tagName !== 'BUTTON') drag = e.clientX
})
addEventListener('pointermove', (e) => {
  if (drag === null) return
  turn = THREE.MathUtils.clamp(turn + (e.clientX - drag) * 0.01, -1.4, 1.4)
  drag = e.clientX
})
addEventListener('pointerup', () => (drag = null))

const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10)
const clock = new THREE.Clock()
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05)
  const w = innerWidth
  const h = innerHeight
  renderer.setSize(w, h, false)
  for (const id of Object.keys(weights)) {
    const target = id === goal ? 1 : 0
    weights[id] += (target - weights[id]) * Math.min(1, dt * 3)
  }
  rig.set(weights)
  if (drag === null) turn *= 1 - Math.min(1, dt * 1.5)
  turntable.rotation.y = turn
  // Head and hands fill the screen; on a wide screen a little more of the body.
  cam.aspect = w / h
  const dist = w < h ? 1.15 : 0.85
  cam.position.set(0, 1.57, dist)
  cam.lookAt(0, 1.52, 0)
  cam.updateProjectionMatrix()
  renderer.clear()
  renderer.render(scene, cam)
  requestAnimationFrame(frame)
}
frame()
