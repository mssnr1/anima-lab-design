import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import modelUrl from '../models/anima-body.glb?url'
import bodyPoses from '../models/anima-body-poses.json'
import { figureRig, STRIPE_PALETTES, stripeMaterial, type FigurePoses } from '../src/figure'

/**
 * The new figure on a phone: MakeHuman skin (CC0) with the Z-Anatomy skeleton inside, both on one rig.
 * Night look, layers and test poses as buttons, swipe to turn, pinch to zoom. `npm run preview:face`, then `/koerper.html`.
 */
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor(0x0d1120, 1)
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
const p = STRIPE_PALETTES.dark

const skinShow = { value: 1 }
const skin = stripeMaterial({
  show: skinShow,
  pattern: 'level',
  density: 220,
  width: 0.06,
  line: p.body,
  fill: p.bodyBase,
  lineAlpha: 0.5,
  fillAlpha: 0.9,
  rim: p.bodyRim,
  rimAlpha: 0.85,
  rimPower: 1.5,
  rest: true,
  side: 'front',
})
const boneShow = { value: 1 }
const bone = stripeMaterial({
  show: boneShow,
  pattern: 'level',
  density: 520,
  width: 0.08,
  line: '#f3ead8',
  fill: '#f3ead8',
  lineAlpha: 0.75,
  fillAlpha: 0.12,
  rim: '#fff6e6',
  rimAlpha: 0.9,
  rimPower: 1.4,
  rest: true,
  glow: true,
  occlude: true,
})
const depth = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })

const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)
const b64 = document.body.dataset.modelB64
const model = (
  b64
    ? await loader.parseAsync(Uint8Array.from(atob((await (await fetch(b64)).text()).trim()), (c) => c.charCodeAt(0)).buffer, '')
    : await loader.loadAsync(modelUrl)
).scene
model.updateMatrixWorld(true)
const parts: Record<string, THREE.SkinnedMesh> = {}
const skinDepth: THREE.Mesh[] = []
model.traverse((o) => {
  const mesh = o as THREE.SkinnedMesh
  if (!mesh.isMesh) return
  parts[mesh.name] = mesh
  // The stripes ride on the unposed shape (`rest`), so they stay on the skin and the bones as the figure moves.
  const g = mesh.geometry
  g.setAttribute('rest', g.getAttribute('position').clone())
  if (mesh.name === 'Body') {
    mesh.material = skin
    mesh.renderOrder = 0.2
    const d = mesh.clone(false)
    d.material = depth
    d.renderOrder = 0.1
    skinDepth.push(d)
    mesh.parent!.add(d)
  } else if (mesh.name === 'Skeleton') {
    mesh.material = bone
    mesh.renderOrder = 0.15
  } else if (mesh.name === 'Teeth') {
    // MakeHuman's teeth are only a rough placeholder box; the skeleton brings the real teeth.
    mesh.visible = false
  } else {
    // Eyes and tongue: quiet shapes, drawn after the skin's depth so only the eye openings and the open mouth show them.
    mesh.material = new THREE.MeshBasicMaterial({ color: mesh.name === 'Eyes' ? 0x1a1f3a : 0x3a2440 })
    mesh.renderOrder = 0.12
  }
})
const turntable = new THREE.Group()
turntable.add(model)
scene.add(turntable)
const rig = figureRig(model, bodyPoses as FigurePoses)

type Layer = 'skin' | 'both' | 'bones'
let layer: Layer = 'skin'
function setLayer(l: Layer) {
  layer = l
  const bones = l !== 'skin'
  parts.Skeleton.visible = bones
  skinDepth.forEach((d) => (d.visible = !bones))
  parts.Body.visible = l !== 'bones'
  parts.Eyes.visible = l !== 'bones'
  parts.Tongue.visible = l !== 'bones'
  skinShow.value = l === 'both' ? 0.35 : 1
}
function buttons(el: HTMLElement, items: [string, string][], on: string, pick: (id: string) => void) {
  for (const [id, label] of items) {
    const b = document.createElement('button')
    b.textContent = label
    b.classList.toggle('on', id === on)
    b.onclick = () => {
      pick(id)
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b))
    }
    el.appendChild(b)
  }
}
const weights: Record<string, number> = { vHand: 0, mouthO: 0 }
const q = new URLSearchParams(location.search)
let goal = q.get('pose') ?? 'rest'
let focus = goal === 'rest' ? 'body' : 'head'
buttons(document.getElementById('layers')!, [['skin', 'Haut'], ['both', 'Haut + Skelett'], ['bones', 'Skelett']], q.get('layer') ?? 'skin', (id) => setLayer(id as Layer))
buttons(document.getElementById('poses')!, [['rest', 'Ruhe'], ['vHand', 'V-Hand'], ['mouthO', 'Mund O']], goal, (id) => {
  goal = id
  focus = id === 'rest' ? 'body' : 'head'
})
setLayer((q.get('layer') as Layer) ?? 'skin')

// Swipe to turn, pinch to zoom.
let turn = 0
let zoom = 1
const touches = new Map<number, number[]>()
let pinch = 0
addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).tagName !== 'BUTTON') touches.set(e.pointerId, [e.clientX, e.clientY])
})
addEventListener('pointermove', (e) => {
  const last = touches.get(e.pointerId)
  if (!last) return
  if (touches.size === 1) turn += (e.clientX - last[0]) * 0.01
  touches.set(e.pointerId, [e.clientX, e.clientY])
  if (touches.size === 2) {
    const [a, b] = [...touches.values()]
    const d = Math.hypot(a[0] - b[0], a[1] - b[1])
    if (pinch) zoom = THREE.MathUtils.clamp(zoom * (pinch / d), 0.3, 1.6)
    pinch = d
  }
})
const up = (e: PointerEvent) => {
  touches.delete(e.pointerId)
  pinch = 0
}
addEventListener('pointerup', up)
addEventListener('pointercancel', up)
addEventListener('wheel', (e) => (zoom = THREE.MathUtils.clamp(zoom * (1 + e.deltaY * 0.001), 0.3, 1.6)))

if (q.get('turn')) turn = Number(q.get('turn'))
if (q.get('zoom')) zoom = Number(q.get('zoom'))
const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20)
const look = new THREE.Vector3(0, 0.95, 0)
const clock = new THREE.Clock()
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05)
  const w = innerWidth
  const h = innerHeight
  renderer.setSize(w, h, false)
  for (const id of Object.keys(weights)) weights[id] += ((id === goal ? 1 : 0) - weights[id]) * Math.min(1, dt * 3)
  rig.set(weights)
  turntable.rotation.y = turn
  // The whole body at rest; head and hands for the poses.
  const tgt = focus === 'head' ? [1.5, 1.05] : [0.92, 3.9]
  look.y += (tgt[0] - look.y) * Math.min(1, dt * 3)
  cam.aspect = w / h
  const dist = THREE.MathUtils.lerp(cam.position.z || tgt[1], tgt[1] * zoom * (w < h ? 1 : 0.75), Math.min(1, dt * 3))
  cam.position.set(0, look.y + 0.05, dist)
  cam.lookAt(0, look.y, 0)
  cam.updateProjectionMatrix()
  renderer.render(scene, cam)
  requestAnimationFrame(frame)
}
frame()
