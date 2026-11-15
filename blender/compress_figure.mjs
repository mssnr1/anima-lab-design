// Compresses the rigged figure: node blender/compress_figure.mjs build/anima-figure.glb models/anima-figure.glb
// Needs @gltf-transform/core, /extensions, /functions and meshoptimizer (npx or a scratch install).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { dedup, prune, quantize, reorder } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(process.argv[2])
// Positions stay float: the figure's shaders read the rest position (world metres) from `position`, and a skinned
// mesh cannot carry the dequantizing node transform.
await doc.transform(dedup(), prune(), reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(NORMAL|TEXCOORD|JOINTS|WEIGHTS|COLOR)/, quantizeNormal: 10, quantizeWeight: 8 }))
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER })
await io.write(process.argv[3], doc)
