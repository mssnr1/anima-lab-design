import * as THREE from 'three'

/**
 * The face as a few simplified muscle areas, like Fluo's lung is a simplified smooth body: calm, well
 * shaped areas over the main muscles of facial expression, each one addressable, so an exercise can
 * light it up and move it.
 *
 * The areas are not separate meshes. They are a map laid over the skin: every point of head and neck
 * belongs to exactly one area (the one whose core lies nearest), so the areas tile the whole surface
 * without gaps, and their borders are smooth curves no matter how coarse the mesh is. The map is worked
 * out per pixel in the shader (`faceMuscleMaterial`) from the resting position, so it rides along with the
 * skin when the face moves, and the same map in TypeScript (`faceAreaAt`) shapes the movements
 * (`addMuscleMorphs`) and is what the tests check.
 *
 * The map is drawn on a chart of the head: `s` is the distance round the head from the face's midline
 * (metres along a circle round a vertical axis through the head), `y` the height in the world. All
 * positions are world metres of the Anima figure (standing at the origin, facing +z, its left at +x).
 */

type V2 = readonly [number, number]

/** The core of an area: the area is everything closer to its core than to any other area's core. */
export type Core =
  | { kind: 'ellipse'; c: V2; r: V2; tilt?: number }
  | { kind: 'capsule'; a: V2; b: V2; r: number }
  /** Everything above this height. */
  | { kind: 'above'; y: number }
  /** Everything below this height. */
  | { kind: 'below'; y: number }
  /** Everything farther round the head than this (the sides and back of the head). */
  | { kind: 'beyond'; s: number }

/**
 * Which way the fine lines inside an area run, after the muscle's fibres: `rings` round a centre (the
 * ring muscles of eye and mouth), `along` at an angle in degrees from horizontal, `fan` spreading from a
 * point, `around` the body's own lines (round the body's long axis, as on the trunk).
 */
export type Fibre = { kind: 'rings'; c: V2; r: V2 } | { kind: 'along'; angle: number } | { kind: 'fan'; c: V2 } | { kind: 'around' }

/** How an area moves when its muscle works (world metres; on the right side mirrored). */
export type Motion =
  /** Shift in this direction. */
  | { kind: 'shift'; dir: readonly [number, number, number]; amount: number }
  /** Draw toward this world point by this fraction of the way, plus an optional shift. */
  | { kind: 'toward'; to: readonly [number, number, number]; amount: number; shift?: readonly [number, number, number] }
  /** Push out along the surface normal (negative: in). */
  | { kind: 'swell'; amount: number }
  /** Stretch along an axis away from a world point (negative: draw together), by this fraction of the distance. */
  | { kind: 'stretch'; c: readonly [number, number, number]; axis: readonly [number, number, number]; amount: number }

type AreaDef = {
  muscle: string
  /** German name, for labels in the apps. */
  label: string
  /** 'mid' lies across the midline; 'pair' is defined for the figure's left (+x) and mirrored for the right. */
  side: 'mid' | 'pair'
  cores: Core[]
  fibre: Fibre
  /** Not a muscle area: the rest of the head and the body, drawn with the body's own lines and no border between them. */
  neutral?: boolean
  motion?: Motion
  /** Further movements of the same area, each its own morph named `<id>.<name>` (e.g. the eye opening wide). */
  moves?: Record<string, Motion>
}

/** Vertical axis the chart is measured round (world z, at x = 0) and the radius that turns its angle into metres. */
export const CHART = { axisZ: -0.005, radius: 0.09 }

/** How strongly the borders bow round the larger areas (0 = straight borders halfway between cores). */
const BOW = 0.6

/** How round the corners are where three areas meet (chart metres). */
const ROUND = 0.0068
/** Where an area's outline runs (inside its border) and its half width, chart metres. */
const INSET = 0.0007
const OUTLINE_W = 0.00028

/** Spacing of the fine lines inside the muscle areas, in metres. */
export const FIBRE_SPACING = 0.0026

// The landmarks of the model's face (world metres), found from its openings: eyes, brows, mouth, nose, ears.
const EYE: V2 = [0.0316, 1.591]
// The lips' seam (see `MOUTH` in face.ts): the mouth ring is centred on it, a little more of it on the lower lip.
const MOUTH_Y = 1.53
/** The ears belong to the plain rest of the head. */
const EARS: Core[] = [-1, 1].map((side) => ({ kind: 'ellipse', c: [side * 0.132, 1.585], r: [0.011, 0.022] }))

const DEFS: AreaDef[] = [
  { muscle: 'frontalis', label: 'Stirn', side: 'mid', cores: [{ kind: 'ellipse', c: [0, 1.662], r: [0.064, 0.03] }], fibre: { kind: 'along', angle: 90 }, motion: { kind: 'stretch', c: [0, 1.7, 0.07], axis: [0, 1, 0], amount: -0.04 } },
  { muscle: 'corrugator', label: 'Zornesfalte', side: 'mid', cores: [{ kind: 'ellipse', c: [0, 1.614], r: [0.008, 0.012] }], fibre: { kind: 'along', angle: 90 }, motion: { kind: 'shift', dir: [0, -0.8, -0.2], amount: 0.0025 } },
  { muscle: 'nasalis', label: 'Nase', side: 'mid', cores: [{ kind: 'ellipse', c: [0, 1.566], r: [0.009, 0.026] }], fibre: { kind: 'along', angle: 0 }, motion: { kind: 'shift', dir: [0, 1, 0], amount: 0.0015 } },
  { muscle: 'orbicularisOris', label: 'Mund', side: 'mid', cores: [{ kind: 'ellipse', c: [0, MOUTH_Y - 0.005], r: [0.03, 0.019] }], fibre: { kind: 'rings', c: [0, MOUTH_Y], r: [1.6, 1] }, motion: { kind: 'toward', to: [0, MOUTH_Y, 0.075], amount: 0.2, shift: [0, 0, 0.0035] } },
  { muscle: 'mentalis', label: 'Kinn', side: 'mid', cores: [{ kind: 'ellipse', c: [0, 1.483], r: [0.017, 0.011] }], fibre: { kind: 'along', angle: 90 }, motion: { kind: 'shift', dir: [0, 0.5, 1], amount: 0.0028 } },
  { muscle: 'orbicularisOculi', label: 'Auge', side: 'pair', cores: [{ kind: 'ellipse', c: EYE, r: [0.024, 0.021] }, { kind: 'capsule', a: [0.019, 1.61], b: [0.042, 1.6], r: 0.0085 }], fibre: { kind: 'rings', c: EYE, r: [1.15, 1] }, motion: { kind: 'toward', to: [0.03, 1.59, 0.075], amount: 0.22 }, moves: { open: { kind: 'stretch', c: [0.03, 1.588, 0.075], axis: [0, 1, 0], amount: 0.22 } } },
  { muscle: 'levatorLabii', label: 'Oberlippe', side: 'pair', cores: [{ kind: 'capsule', a: [0.02, 1.568], b: [0.021, 1.544], r: 0.0065 }], fibre: { kind: 'along', angle: 84 }, motion: { kind: 'shift', dir: [0.1, 1, 0.2], amount: 0.0022 }, moves: { down: { kind: 'shift', dir: [0, -1, -0.15], amount: 0.003 } } },
  { muscle: 'zygomaticus', label: 'Jochbein', side: 'pair', cores: [{ kind: 'capsule', a: [0.066, 1.566], b: [0.036, 1.532], r: 0.009 }], fibre: { kind: 'along', angle: 49 }, motion: { kind: 'toward', to: [0.06, 1.57, 0.05], amount: 0.16 }, moves: { down: { kind: 'shift', dir: [-0.15, -1, -0.1], amount: 0.004 } } },
  { muscle: 'buccinator', label: 'Wange', side: 'pair', cores: [{ kind: 'ellipse', c: [0.064, 1.517], r: [0.013, 0.015] }], fibre: { kind: 'along', angle: 6 }, motion: { kind: 'swell', amount: -0.0015 } },
  { muscle: 'depressor', label: 'Mundwinkel', side: 'pair', cores: [{ kind: 'capsule', a: [0.033, 1.499], b: [0.042, 1.482], r: 0.0065 }], fibre: { kind: 'along', angle: 66 }, motion: { kind: 'shift', dir: [0.2, -1, 0], amount: 0.0022 } },
  { muscle: 'masseter', label: 'Kiefer', side: 'pair', cores: [{ kind: 'capsule', a: [0.097, 1.563], b: [0.091, 1.5], r: 0.015 }], fibre: { kind: 'along', angle: 82 }, motion: { kind: 'swell', amount: 0.002 } },
  { muscle: 'temporalis', label: 'Schläfe', side: 'pair', cores: [{ kind: 'ellipse', c: [0.09, 1.63], r: [0.022, 0.03], tilt: -12 }], fibre: { kind: 'fan', c: [0.11, 1.575] }, motion: { kind: 'swell', amount: 0.0012 } },
  { muscle: 'sternocleidomastoid', label: 'Halsseite', side: 'pair', cores: [{ kind: 'capsule', a: [0.108, 1.53], b: [0.034, 1.425], r: 0.011 }], fibre: { kind: 'along', angle: 122 } },
  { muscle: 'platysma', label: 'Hals', side: 'mid', cores: [{ kind: 'ellipse', c: [0, 1.445], r: [0.032, 0.034] }], fibre: { kind: 'along', angle: 90 } },
  { muscle: 'scalp', label: 'Kopf', side: 'mid', neutral: true, cores: [{ kind: 'above', y: 1.695 }, { kind: 'beyond', s: 0.15 }, ...EARS], fibre: { kind: 'around' } },
  { muscle: 'body', label: 'Körper', side: 'mid', neutral: true, cores: [{ kind: 'below', y: 1.39 }], fibre: { kind: 'around' } },
]

/** One area of the map: a muscle (on one side, for the paired ones) with its own index into the activation array. */
export type FaceArea = { id: string; index: number; weight: number; muscle: string; label: string; side: 'mid' | 'left' | 'right'; neutral: boolean; cores: Core[]; fibre: Fibre; motion?: Motion; moves?: Record<string, Motion> }

const mirrorV2 = (p: V2): V2 => [-p[0], p[1]]
const mirrorCore = (c: Core): Core => {
  switch (c.kind) {
    case 'ellipse':
      return { ...c, c: mirrorV2(c.c), tilt: c.tilt === undefined ? undefined : -c.tilt }
    case 'capsule':
      return { ...c, a: mirrorV2(c.a), b: mirrorV2(c.b) }
    default:
      return c
  }
}
const mirrorFibre = (f: Fibre): Fibre => {
  switch (f.kind) {
    case 'rings':
      return { ...f, c: mirrorV2(f.c) }
    case 'fan':
      return { ...f, c: mirrorV2(f.c) }
    case 'along':
      return { ...f, angle: 180 - f.angle }
    default:
      return f
  }
}
const mirrorMotion = (m?: Motion): Motion | undefined => {
  if (!m || m.kind === 'swell') return m
  if (m.kind === 'stretch') return { ...m, c: [-m.c[0], m.c[1], m.c[2]], axis: [-m.axis[0], m.axis[1], m.axis[2]] }
  if (m.kind === 'shift') return { ...m, dir: [-m.dir[0], m.dir[1], m.dir[2]] }
  return { ...m, to: [-m.to[0], m.to[1], m.to[2]], shift: m.shift ? [-m.shift[0], m.shift[1], m.shift[2]] : undefined }
}

/**
 * All areas of the map, in a fixed order (their `index`): the activation array and the morph targets
 * use it. Paired muscles come as `<muscle>Left` / `<muscle>Right` (the figure's own left and right).
 */
export const FACE_AREAS: readonly FaceArea[] = DEFS.flatMap((d): Omit<FaceArea, 'index' | 'weight'>[] => {
  const base = { muscle: d.muscle, label: d.label, neutral: !!d.neutral }
  if (d.side === 'mid') return [{ ...base, id: d.muscle, side: 'mid', cores: d.cores, fibre: d.fibre, motion: d.motion, moves: d.moves }]
  const mirroredMoves = d.moves && Object.fromEntries(Object.entries(d.moves).map(([k, m]) => [k, mirrorMotion(m)!]))
  return [
    { ...base, id: `${d.muscle}Left`, side: 'left', cores: d.cores, fibre: d.fibre, motion: d.motion, moves: d.moves },
    { ...base, id: `${d.muscle}Right`, side: 'right', cores: d.cores.map(mirrorCore), fibre: mirrorFibre(d.fibre), motion: mirrorMotion(d.motion), moves: mirroredMoves },
  ]
}).map((a, index) => ({ ...a, index, weight: areaWeight(a.cores, a.neutral) }))

export type FaceAreaId = string

/** The ids of the muscle areas (without the neutral rest of head and body), in index order. */
export const FACE_MUSCLES: readonly string[] = FACE_AREAS.filter((a) => !a.neutral).map((a) => a.id)

/** Every id `faceMuscleRig().set` takes: the muscle areas and their further movements (`<id>.<name>`). */
export const FACE_MOVES: readonly string[] = [...FACE_AREAS.filter((a) => !a.neutral).flatMap((a) => [a.id, ...Object.keys(a.moves ?? {}).map((m) => `${a.id}.${m}`)]), 'jaw']

/** A world point on the head chart: [s, y] (see above). */
export function faceChart(x: number, y: number, z: number): [number, number] {
  return [Math.atan2(x, z - CHART.axisZ) * CHART.radius, y]
}

function coreDistance(c: Core, s: number, y: number): number {
  switch (c.kind) {
    case 'ellipse': {
      let px = s - c.c[0]
      let py = y - c.c[1]
      if (c.tilt) {
        const t = (c.tilt * Math.PI) / 180
        ;[px, py] = [px * Math.cos(t) + py * Math.sin(t), -px * Math.sin(t) + py * Math.cos(t)]
      }
      // A close, cheap distance to an ellipse (exact on the axes, smooth everywhere).
      const k0 = Math.hypot(px / c.r[0], py / c.r[1])
      const k1 = Math.hypot(px / (c.r[0] * c.r[0]), py / (c.r[1] * c.r[1]))
      return k1 < 1e-9 ? -Math.min(c.r[0], c.r[1]) : (k0 * (k0 - 1)) / k1
    }
    case 'capsule': {
      const bax = c.b[0] - c.a[0]
      const bay = c.b[1] - c.a[1]
      const t = Math.min(1, Math.max(0, ((s - c.a[0]) * bax + (y - c.a[1]) * bay) / (bax * bax + bay * bay)))
      return Math.hypot(s - c.a[0] - bax * t, y - c.a[1] - bay * t) - c.r
    }
    case 'above':
      return c.y - y
    case 'below':
      return y - c.y
    case 'beyond':
      return c.s - Math.abs(s)
  }
}

/** How softly the cores of one muscle area merge into one shape (chart metres): no waist where they meet. */
const MERGE = 0.01
/** A smooth minimum: two cores of one area flow into each other. */
const smin = (a: number, b: number) => {
  if (!Number.isFinite(a)) return b
  const h = Math.max(MERGE - Math.abs(a - b), 0) / MERGE
  return Math.min(a, b) - (h * h * MERGE) / 4
}

/** Distance (chart metres) from a chart point to an area's core; negative inside it. */
export function areaDistance(area: FaceArea, s: number, y: number): number {
  let d = Infinity
  for (const c of area.cores) d = area.neutral ? Math.min(d, coreDistance(c, s, y)) : smin(d, coreDistance(c, s, y))
  return d * area.weight
}

/**
 * Distances to a larger core count for more, so borders bow round the large areas (mouth, eyes, brow)
 * and they read as rounded shapes, while the small ones fit in between.
 */
function areaWeight(cores: Core[], neutral: boolean): number {
  if (neutral) return 1
  const size = (c: Core) => (c.kind === 'ellipse' ? Math.sqrt(c.r[0] * c.r[1]) : c.kind === 'capsule' ? Math.sqrt(c.r * (c.r + Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) / 2)) : 0.015)
  return (Math.max(...cores.map(size)) / 0.015) ** BOW
}

/** Which area a world point belongs to, how far it is to its core (`d1`) and to the next nearest (`d2`, area `next`). */
export function faceAreaAt(x: number, y: number, z: number): { area: FaceArea; next: FaceArea; d1: number; d2: number } {
  const [s, h] = faceChart(x, y, z)
  let best = 0
  let second = 1
  let d1 = Infinity
  let d2 = Infinity
  FACE_AREAS.forEach((a, i) => {
    const d = areaDistance(a, s, h)
    if (d < d1) {
      d2 = d1
      second = best
      d1 = d
      best = i
    } else if (d < d2) {
      d2 = d
      second = i
    }
  })
  return { area: FACE_AREAS[best], next: FACE_AREAS[second], d1, d2 }
}

// ---------------------------------------------------------------------------------------------------
// The same map in GLSL, written out from the definitions above.

const f = (n: number) => {
  const t = n.toFixed(5)
  return t.includes('.') ? t : `${t}.0`
}
const v2 = (p: V2) => `vec2(${f(p[0])}, ${f(p[1])})`

function coreGlsl(c: Core): string {
  switch (c.kind) {
    case 'ellipse':
      return c.tilt ? `sdEllipse(rot2(p - ${v2(c.c)}, ${f((c.tilt * Math.PI) / 180)}), ${v2(c.r)})` : `sdEllipse(p - ${v2(c.c)}, ${v2(c.r)})`
    case 'capsule':
      return `sdCapsule(p, ${v2(c.a)}, ${v2(c.b)}, ${f(c.r)})`
    case 'above':
      return `(${f(c.y)} - p.y)`
    case 'below':
      return `(p.y - ${f(c.y)})`
    case 'beyond':
      return `(${f(c.s)} - abs(p.x))`
  }
}

function fibreGlsl(fb: Fibre): string {
  const k = f(1 / FIBRE_SPACING)
  switch (fb.kind) {
    case 'rings': {
      // Concentric ellipses with this aspect, spaced evenly along the short axis.
      return `length((p - ${v2(fb.c)}) / ${v2(fb.r)}) * ${k}`
    }
    case 'along': {
      const a = (fb.angle * Math.PI) / 180
      return `dot(p, vec2(${f(-Math.sin(a))}, ${f(Math.cos(a))})) * ${k}`
    }
    case 'fan':
      // Lines spreading from the point, spaced like the others a few centimetres out.
      return `atan(p.x - ${f(fb.c[0])}, p.y - ${f(fb.c[1])}) * ${f(0.05 / FIBRE_SPACING)}`
    case 'around':
      return 'around'
  }
}

/**
 * GLSL: `faceAreas(vec2 p, out int id, out int next, out float d1, out float d2)` finds the area of a chart
 * point, `faceFibre(int id, vec2 p, float around)` the value whose whole numbers are the area's fine lines,
 * `faceNeutral(int id)` whether an area is the plain rest, `faceChart(vec3 world)` the chart point.
 */
export const FACE_AREA_GLSL = `
float sdEllipse(vec2 p, vec2 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k1 < 1e-9 ? -min(r.x, r.y) : k0 * (k0 - 1.0) / k1;
}
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float smin(float a, float b) { float h = max(${f(MERGE)} - abs(a - b), 0.0) / ${f(MERGE)}; return min(a, b) - h * h * ${f(MERGE / 4)}; }
vec2 rot2(vec2 p, float t) { return vec2(p.x * cos(t) + p.y * sin(t), -p.x * sin(t) + p.y * cos(t)); }
vec2 faceChart(vec3 w) { return vec2(atan(w.x, w.z - ${f(CHART.axisZ)}) * ${f(CHART.radius)}, w.y); }
void faceAreas(vec2 p, out int id, out int next, out float d1, out float d2, out float depth) {
  float ds[${FACE_AREAS.length}];
${FACE_AREAS.map((a) => `  ds[${a.index}] = ${a.cores.map(coreGlsl).reduce((x, y) => `${a.neutral ? 'min' : 'smin'}(${x}, ${y})`)} * ${f(a.weight)};`).join('\n')}
  d1 = 1e9; d2 = 1e9; id = 0; next = 0;
  for (int i = 0; i < ${FACE_AREAS.length}; i++) {
    float d = ds[i];
    if (d < d1) { d2 = d1; next = id; d1 = d; id = i; } else if (d < d2) { d2 = d; next = i; }
  }
  // How far inside its area the point lies, with the corners where three areas meet rounded off:
  // half the gap between its own core and a soft minimum over all the others.
  float others = 0.0;
  for (int i = 0; i < ${FACE_AREAS.length}; i++) if (i != id) others += exp(-(ds[i] - d1) / ${f(ROUND)});
  depth = 0.5 * (-${f(ROUND)} * log(max(others, 1e-30)));
}
bool faceNeutral(int id) { return ${FACE_AREAS.filter((a) => a.neutral).map((a) => `id == ${a.index}`).join(' || ') || 'false'}; }
float faceFibre(int id, vec2 p, float around) {
${FACE_AREAS.map((a) => `  if (id == ${a.index}) return ${fibreGlsl(a.fibre)};`).join('\n')}
  return around;
}
`

// ---------------------------------------------------------------------------------------------------
// The look.

/** Colours of the face map: skin as in `STRIPE_PALETTES`, plus the app's signature light (top and bottom). */
export type FacePalette = { body: string; bodyBase: string; bodyRim: string; bodyLow: string; light: string; light2: string }

/** Mimo's (Fayo's) proposed signature light (tokens/apps/mimo.css) on the shared figure colours. */
export const FACE_PALETTES: Record<'light' | 'dark', FacePalette> = {
  light: { body: '#1a1f33', bodyBase: '#fbfbf9', bodyRim: '#7d84a3', bodyLow: '#b4b8c6', light: '#00a88a', light2: '#2a7fd4' },
  dark: { body: '#8f86ff', bodyBase: '#0d1120', bodyRim: '#b9adff', bodyLow: '#4aa6d6', light: '#ffc2d6', light2: '#ffd8b0' },
}

export type FaceMuscleOptions = {
  palette: FacePalette
  dark: boolean
  /**
   * How much each area works, 0..1, by `FaceArea.index` (one shared array: change its values, the
   * picture follows). Use `faceActivation()` for one of the right length.
   */
  activation: { value: Float32Array }
  /** How strongly the borders of all muscle areas show while they rest (0 = only lit areas show theirs). */
  outline?: { value: number }
  /** Shared multiplier of the final opacity. */
  show?: { value: number }
}

/** An activation array for `faceMuscleMaterial`, all areas at rest. */
export function faceActivation(): { value: Float32Array } {
  return { value: new Float32Array(FACE_AREAS.length) }
}

/** Heights (world metres) over which the plain skin turns to `bodyLow` toward the belly, as `makeStripeMaterials` does. */
const SKIN_GRADIENT = new THREE.Vector2(0.85, 1.45)

/**
 * The skin of head, neck and trunk with the face map drawn on it. Use it in place of the skin stripe
 * material on `Head` and `Body_Shell` (after the same depth pre-pass, `skinDepthMaterial`): away from the
 * face it draws exactly the body's lines, so trunk, arms and legs carry on unchanged. On the face, each
 * muscle area has its own fine lines along its fibres and a clean border; a working area lights up in the
 * signature light, brightest along its border, as the lungs light up with the breath.
 */
export function faceMuscleMaterial(o: FaceMuscleOptions): THREE.Material {
  const { palette: p, dark } = o
  const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uLine: { value: new THREE.Color(p.body) },
      uBase: { value: new THREE.Color(p.bodyBase) },
      uRim: { value: new THREE.Color(p.bodyRim) },
      uLow: { value: new THREE.Color(p.bodyLow) },
      uLight: { value: new THREE.Color(p.light) },
      uLight2: { value: new THREE.Color(p.light2) },
      uAct: o.activation,
      uOutline: o.outline ?? { value: 1 },
      uShow: o.show ?? { value: 1 },
    })
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float mouthGap;\nvarying float vMouth;\nvarying vec3 vRest;\nvarying float vOpen;\nvarying vec3 vN;\nvarying vec3 vView;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vRest = (modelMatrix * vec4(position, 1.0)).xyz;
      // How far the mouth is open: addJawMorph adds its morph after all others, so it is the last one.
      vOpen = 0.0;
      #ifdef USE_MORPHTARGETS
      vOpen = morphTargetInfluences[MORPHTARGETS_COUNT - 1];
      #endif
      vMouth = mouthGap;
      vec3 shapedNormal = normal;
      #ifdef USE_MORPHNORMALS
      shapedNormal *= morphTargetBaseInfluence;
      for (int i = 0; i < MORPHTARGETS_COUNT; i++) {
        if (morphTargetInfluences[i] != 0.0) shapedNormal += getMorph(gl_VertexID, i, 1).xyz * morphTargetInfluences[i];
      }
      #endif
      #ifdef USE_SKINNING
      // A rigged figure: the normal as posed by its skeleton (and morphs).
      vN = normalize(normalMatrix * objectNormal);
      #else
      vN = normalize(normalMatrix * shapedNormal);
      #endif
      vView = -mvPosition.xyz;`,
    )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRest; varying float vOpen; varying vec3 vN; varying vec3 vView; varying float vMouth;
        uniform vec3 uLine; uniform vec3 uBase; uniform vec3 uRim; uniform vec3 uLow; uniform vec3 uLight; uniform vec3 uLight2;
        uniform float uAct[${FACE_AREAS.length}]; uniform float uOutline; uniform float uShow;
        ${FACE_AREA_GLSL}`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec2 cp = faceChart(vRest);
        int id; int next; float d1; float d2; float depth;
        faceAreas(cp, id, next, d1, d2, depth);
        bool plain = faceNeutral(id);
        bool seam = !(plain && faceNeutral(next));
        // The body's own lines (as stripeMaterial's 'around' pattern, density 120), so the rest runs on seamlessly.
        float around = atan(vRest.x, vRest.z + 0.03) / 6.2831853 * 120.0;
        float v = faceFibre(id, cp, around);
        float fw = fwidth(v);
        float width = plain ? 0.06 : 0.07;
        float line = smoothstep(0.5 - width - fw * 0.9, 0.5 - width + fw * 0.9, abs(fract(v) - 0.5));
        // Where lines crowd closer than a few pixels they fade instead of knotting (the crown, a ring's centre).
        line *= 1.0 - smoothstep(0.2, 0.45, fw);

        // Each area has its own outline a hair inside its border, rounded at the corners; between two
        // outlines runs a narrow seam of plain fill. The rest of head and body has no outline of its own.
        // Widths never fall below a pixel or so: where the skin is drawn together (a lifting forehead) the
        // outline and the seam keep the same look on screen instead of thinning out and breaking up.
        float gw = fwidth(depth);
        // The size of a pixel on the figure, smooth across the mesh (fwidth(depth) jumps from one triangle to
        // the next where the skin is squeezed, and the outline would step with it).
        float px = length(vView) * length(fwidth(normalize(vView)));
        float inset = max(${f(INSET)}, min(1.6 * px, 0.002));
        float ow = max(${f(OUTLINE_W)}, min(0.6 * px, 0.0008));
        float outline = 1.0 - smoothstep(ow - gw, ow + gw, abs(depth - inset));
        float gutter = 1.0 - smoothstep(inset - gw, inset + gw, depth);
        if (plain) { outline = 0.0; gutter = seam ? gutter : 0.0; }
        // Seen edge-on an outline would smear into a band: there it fades, the silhouette takes over.
        outline *= smoothstep(0.08, 0.22, abs(dot(normalize(vN), normalize(vView))));
        line *= 1.0 - gutter;

        // By day as at night a soft rim that runs a good way into the figure (no drawn outline).
        float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), ${dark ? '1.5' : '1.6'});
        // The lips' seam folds in sharply: no rim light there, or it shows as a bright notch.
        fr *= 1.0 - smoothstep(0.2, 0.6, vMouth);
        if (plain) line *= mix(0.3, 1.0, smoothstep(0.05, 0.5, fr));

        // How much this area works.
        float act = clamp(uAct[id], 0.0, 1.0);
        // The light runs from the top colour at the brow to the second colour at the chin.
        vec3 cLight = mix(uLight2, uLight, smoothstep(1.47, 1.67, vRest.y));
        float low = 1.0 - smoothstep(${f(SKIN_GRADIENT.x)}, ${f(SKIN_GRADIENT.y)}, vRest.y);
        vec3 cLine = mix(uLine, uLow, low);

        // Resting. At night: lines and outlines in the figure's glow. By day (an ink drawing on paper) the
        // resting areas stay almost silent: hairline outlines, fibres barely there, so the face reads as one
        // calm surface and only a working area draws the eye.
        float lineA = plain ? ${dark ? '0.5' : '0.34'} : ${dark ? '0.3' : '0.94'};
        float borderA = ${dark ? '0.62' : '0.26'} * uOutline;
        vec3 col = mix(uBase, cLine, line * (plain ? 1.0 : ${dark ? '1.0' : '0.0'}));
        float a = mix(${dark ? '0.9' : '0.94'}, lineA, line);
        col = mix(col, ${dark ? 'cLine' : 'mix(cLine, uBase, 0.72)'}, outline);
        a = mix(a, max(a, borderA), outline);

        // Working: the area's lines and outline take the light and a wash fills it${dark ? ', brightest just inside the border' : ''}.
        float inner = 1.0 - smoothstep(${f(INSET)}, 0.008, depth);
        float wash = act * (1.0 - gutter) * (${dark ? '0.16 + 0.45 * inner' : '0.14 + 0.1 * inner'});
        col = mix(col, cLight, wash);
        col = mix(col, cLight, act * line * ${dark ? '1.0' : '0.5'});
        a = max(a, act * line * ${dark ? '1.0' : '0.7'});
        col = mix(col, cLight, act * outline);
        a = max(a, act * outline);

        // The eyebrows: not a muscle but hair on the brow ridge, drawn as a soft arched band of short
        // slanted strokes. They sit on the skin (the chart of the resting face), so they rise with it.
        {
          float bs = abs(cp.x);
          float bt = (bs - 0.014) / 0.044;
          float centre = 1.6155 + 0.0058 * sin(3.14159 * clamp(bt, 0.0, 1.0) * 0.9) - 0.0018 * bt;
          // Round at the inner end (no hard, frowning start), thinnest at the tail.
          float bh = mix(0.0026, 0.0012, clamp(bt, 0.0, 1.0)) * sqrt(clamp(bt / 0.12, 0.0, 1.0));
          float dy = abs(cp.y - centre);
          float bw = fwidth(cp.y);
          float band = (1.0 - smoothstep(bh - bw, bh + bw, dy)) * (1.0 - smoothstep(0.9, 1.0, bt));
          float hair = 0.65 + 0.35 * smoothstep(0.3, 0.7, abs(fract((bs * 0.85 + (cp.y - centre) * 0.45) * 1600.0) - 0.5) * 2.0);
          float brow = band * hair;
          col = mix(col, ${dark ? 'mix(uRim, vec3(1.0), 0.2)' : 'cLine'}, brow * ${dark ? '0.6' : '0.38'});
          a = max(a, brow * ${dark ? '0.7' : '0.6'});
        }

        // The lips (see addJawMorph; 0 on heads without it). The seam is drawn as a fine line, about a pixel
        // wide whatever the mesh; only where the skin across it is pulled apart (the mouth opens) does the
        // band round it turn into a dark opening.
        {
          float open = smoothstep(0.03, 0.25, vOpen);
          float gap = smoothstep(0.12, 0.5, vMouth) * open;
          col = mix(col, ${dark ? 'vec3(0.0)' : 'mix(cLine, uRim, 0.35)'}, gap);
          a = mix(a, ${dark ? '0.0' : '0.6'}, gap);
          float d = (1.0 - vMouth) / max(fwidth(vMouth), 1e-5);
          float lip = (1.0 - smoothstep(0.6, 1.6, d)) * step(0.05, vMouth) * (1.0 - open);
          col = mix(col, uRim, lip * 0.6);
          a = max(a, lip * ${dark ? '0.6' : '0.5'});
        }

        // The outline of the head and body, as on the rest of the figure.
        col = mix(col, uRim, fr * 0.8);
        a = max(a, fr * ${dark ? '0.85' : '0.8'});
        ${dark ? 'gl_FragColor = vec4(col * min(a * uShow, 1.0), 1.0);' : 'gl_FragColor = vec4(col, min(a * uShow, 1.0));'}`,
      )
  }
  m.customProgramCacheKey = () => `face-muscles-lips-${dark ? 'dark' : 'light'}-${FACE_AREAS.length}`
  return m
}

// ---------------------------------------------------------------------------------------------------
// The movements.

/**
 * How far an area's movement reaches past its border (chart metres): a working area pushes its
 * neighbours along, fading over about this distance, so the seam between them moves as one piece and
 * keeps its width instead of being squeezed or torn.
 */
const PUSH = 0.028

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}
const keep = new THREE.Vector3()
/** How much a world point belongs to the nose (1 on it, fading over its edges): its shape stays. */
const noseShare = (p: THREE.Vector3) =>
  (1 - smoothstep(0.013, 0.024, Math.abs(p.x))) * smoothstep(1.527, 1.537, p.y) * (1 - smoothstep(1.592, 1.608, p.y)) * smoothstep(0.072, 0.082, p.z)

/**
 * Adds one relative morph target per moving muscle area (named by the area's id, e.g. `zygomaticusLeft`)
 * to a head geometry, after any it already has (e.g. `Calm`), with normals. Each area moves as its muscle
 * pulls (brows up, mouth pursed, cheek drawn up and back...), fading softly into its neighbours, so the
 * skin never tears along a border. `matrix` is the head's world matrix. Returns the names added.
 */
export function addMuscleMorphs(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): string[] {
  const pos = geometry.attributes.position as THREE.BufferAttribute
  if (!pos) return []
  if (geometry.userData.muscleMorphs) return geometry.userData.muscleMorphs as string[]
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const nrm = geometry.attributes.normal as THREE.BufferAttribute
  const n = pos.count
  const scale = new THREE.Vector3().setFromMatrixScale(matrix).x
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
  const moving = FACE_AREAS.flatMap((a) => [
    ...(a.motion ? [{ index: a.index, id: a.id, side: a.side, motion: a.motion }] : []),
    ...Object.entries(a.moves ?? {}).map(([name, motion]) => ({ index: a.index, id: `${a.id}.${name}`, side: a.side, motion })),
  ])
  const deltas = moving.map(() => new Float32Array(n * 3))
  const w = new THREE.Vector3()
  const nw = new THREE.Vector3()
  const move = new THREE.Vector3()
  const motionAt = (mo: Motion, at: THREE.Vector3, normal: THREE.Vector3, out: THREE.Vector3) => {
    if (mo.kind === 'shift') return out.set(...mo.dir).normalize().multiplyScalar(mo.amount)
    if (mo.kind === 'swell') return out.copy(normal).multiplyScalar(mo.amount)
    if (mo.kind === 'stretch') {
      out.set(...mo.axis).normalize()
      return out.multiplyScalar(out.dot(new THREE.Vector3(...mo.c).sub(at).negate()) * mo.amount)
    }
    out.set(...mo.to).sub(at).multiplyScalar(mo.amount)
    if (mo.shift) out.add(new THREE.Vector3(...mo.shift))
    return out
  }
  // First the points of each area and how far it moves at most: past its border the skin is carried
  // along, never further than the area itself moves (a stretch would otherwise grow without end).
  const charts = new Float32Array(n * 2)
  const nearestOf = new Int32Array(n)
  const dists: number[][] = []
  const most = moving.map(() => 0)
  for (let i = 0; i < n; i++) {
    w.fromBufferAttribute(pos, i).applyMatrix4(matrix)
    nw.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize()
    const [s, y] = faceChart(w.x, w.y, w.z)
    charts[i * 2] = s
    charts[i * 2 + 1] = y
    const dist = FACE_AREAS.map((a) => areaDistance(a, s, y))
    dists.push(dist)
    let best = 0
    for (let k = 1; k < dist.length; k++) if (dist[k] < dist[best]) best = k
    nearestOf[i] = best
    moving.forEach((a, k) => {
      if (a.index === best) most[k] = Math.max(most[k], motionAt(a.motion, w, nw, move).length())
    })
  }
  for (let i = 0; i < n; i++) {
    w.fromBufferAttribute(pos, i).applyMatrix4(matrix)
    nw.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize()
    const dist = dists[i]
    const nearest = dist[nearestOf[i]]
    const nose = noseShare(w)
    // Each area moves fully up to its border (where it is the nearest) and carries the skin beyond it
    // along, fading with the distance past the border (half the difference of the two distances).
    moving.forEach((a, k) => {
      let weight = Math.exp(-(((dist[a.index] - nearest) / 2 / PUSH) ** 2))
      // A paired area carries only the skin of its own side; on the midline both twins share it, so
      // the skin between two working areas (e.g. above the nose) is not pushed twice as far.
      if (a.side !== 'mid' && a.index !== nearestOf[i]) {
        const t = Math.min(Math.max(((a.side === 'left' ? 1 : -1) * w.x + 0.008) / 0.016, 0), 1)
        weight *= t * t * (3 - 2 * t)
      }
      if (weight < 1e-3) return
      motionAt(a.motion, w, nw, move)
      if (a.index !== nearestOf[i]) move.clampLength(0, most[k])
      // The nose keeps its shape: what the cheeks and lips do around it barely widens or flattens it.
      if (nose > 0 && !a.id.startsWith('nasalis')) move.multiply(keep.set(1 - 0.88 * nose, 1 - 0.6 * nose, 1 - 0.8 * nose))
      move.multiplyScalar(weight / scale)
      deltas[k].set([move.x, move.y, move.z], i * 3)
    })
  }

  // Normals of each moved shape, as differences from the resting normals.
  const before = geometry.clone()
  before.morphAttributes = {}
  before.computeVertexNormals()
  const bn = before.attributes.normal.array
  const positions = geometry.morphAttributes.position ?? []
  const normals = geometry.morphAttributes.normal ?? (positions.length ? positions.map((p) => new THREE.Float32BufferAttribute(new Float32Array(p.count * 3), 3)) : [])
  moving.forEach((a, k) => {
    const shaped = before.clone()
    const sp = shaped.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < n; i++) sp.setXYZ(i, pos.getX(i) + deltas[k][i * 3], pos.getY(i) + deltas[k][i * 3 + 1], pos.getZ(i) + deltas[k][i * 3 + 2])
    shaped.computeVertexNormals()
    const nd = new Float32Array(n * 3)
    const sn = shaped.attributes.normal.array
    for (let i = 0; i < n * 3; i++) nd[i] = sn[i] - bn[i]
    shaped.dispose()
    const dp = new THREE.Float32BufferAttribute(deltas[k], 3)
    dp.name = a.id
    const dn = new THREE.Float32BufferAttribute(nd, 3)
    dn.name = a.id
    positions.push(dp)
    normals.push(dn)
  })
  before.dispose()
  geometry.morphAttributes.position = positions
  geometry.morphAttributes.normal = normals
  geometry.morphTargetsRelative = true
  const names = moving.map((a) => a.id)
  geometry.userData.muscleMorphs = names
  return names
}

const X_AXIS = new THREE.Vector3(1, 0, 0)
/** How far the jaw bone of a rigged head turns at full `jaw` (radians). */
export const JAW_OPEN = 0.16

/**
 * Drives the face: `set(id, amount)` lights an area and moves it (0 = at rest, 1 = fully working); an id
 * like `orbicularisOculiLeft.open` runs one of the area's further movements and lights the area too.
 * `meshes` are the meshes drawn with the face material and the muscle morphs (the head; its depth
 * pre-pass copy too, so the depth follows the shape). `gain` exaggerates every movement (1 = as modelled),
 * so an exercise reads clearly on a phone.
 */
export function faceMuscleRig(activation: { value: Float32Array }, meshes: THREE.Mesh[], gain = 1) {
  for (const mesh of meshes) mesh.updateMorphTargets()
  const byId = new Map(FACE_AREAS.map((a) => [a.id, a]))
  const values = new Map<string, number>()
  const light = (area: FaceArea) => {
    let v = values.get(area.id) ?? 0
    for (const name of Object.keys(area.moves ?? {})) v = Math.max(v, values.get(`${area.id}.${name}`) ?? 0)
    activation.value[area.index] = v
  }
  const follows = new Map<string, number>()
  // A rigged head opens the mouth with its jaw bone (down and back, about 9° at full amount before `gain`).
  const jaws = [...new Set(meshes.flatMap((m) => ((m as THREE.SkinnedMesh).skeleton?.getBoneByName('DEF-jaw') ?? [])))].map((bone) => ({
    bone,
    rest: bone.quaternion.clone(),
  }))
  const turn = new THREE.Quaternion()
  const shape = (id: string) => {
    const amount = Math.min((values.get(id) ?? 0) + (follows.get(id) ?? 0), 1)
    if (id === 'jaw')
      for (const { bone, rest } of jaws) bone.quaternion.copy(rest).multiply(turn.setFromAxisAngle(X_AXIS, JAW_OPEN * amount * gain))
    for (const mesh of meshes) {
      const k = mesh.morphTargetDictionary?.[id]
      if (k !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[k] = amount * gain
    }
  }
  return {
    set(id: string, amount: number) {
      // The jaw opens the mouth (see `addJawMorph`); it moves the skin but lights no area.
      if (id === 'jaw') {
        values.set(id, amount)
        return shape(id)
      }
      const area = byId.get(id.split('.')[0])
      if (!area) return
      values.set(id, amount)
      light(area)
      shape(id)
    },
    /**
     * Moves an area along with another one without lighting it (the skin around a working muscle is
     * pulled a little too): adds to its own amount from `set`.
     */
    follow(id: string, amount: number) {
      if (id !== 'jaw' && !byId.has(id.split('.')[0])) return
      follows.set(id, amount)
      shape(id)
    },
    get(id: string) {
      return values.get(id) ?? 0
    },
  }
}
