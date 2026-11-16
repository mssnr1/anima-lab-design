// The line-drawn figure: shaders and the shapes worked out from the model at runtime.
// How they are put together in a scene (draw order, depth pre-pass, camera, stage) is shown in
// reference/fluo/AnatomyModel.tsx and Anatomy3DVisualization.tsx; see docs/02-3d-figur-und-shading.md.
export * from './stripes'
export * from './shapes'
export * from './holes'
export * from './face'
export * from './faceMuscles'
export * from './subdivide'
export * from './guideArrows'
export * from './limbs'
export * from './legShape'
export * from './lungShape'
export * from './airwayTree'
export * from './airwayShape'
export * from './diaphragmShape'
export * from './heartbeat'

/** The anatomy model, relative to the package root (import it with `?url` from `@anima-labs/design/models/atmen-anatomy.glb`). */
export const MODEL_FILE = 'models/atmen-anatomy.glb'
export * from './armRig'
export * from './figurePose'
export * from './skin'
