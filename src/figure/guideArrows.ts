import * as THREE from 'three'

/**
 * Arrows in the space around the figure that show which way a muscle pulls: one flat surface, like a
 * strip of paper laid gently around the head, that runs along a soft arc a little off the skin and
 * widens into a pointed tip. The surface always faces outward from the head's vertical axis, so it bends
 * with the head instead of turning like a tube. Each arrow is given for the figure's left side and drawn
 * mirrored on the right as well, so both sides of the face move together. The arrow grows from its start
 * to its tip (`grow`, the tip travels along the arc), and a brighter pulse runs along it while the muscle
 * works, in the app's signature light.
 */
export type GuideArrow = {
  /** Start and tip in world metres, on the figure's left (+x). */
  from: readonly [number, number, number]
  to: readonly [number, number, number]
  /** How far the arc bows out from the skin (toward the viewer, +z), metres. */
  bow?: number
  /** Leave the mirrored twin out (an arrow on the midline). */
  single?: boolean
}

export type GuideArrowOptions = {
  color: string
  /** Second colour at the start of the arrow (fades into `color` toward the tip). */
  color2?: string
  /** Add light (the night look) instead of covering what lies behind. */
  glow?: boolean
  /** Half the width of the band, metres. */
  radius?: number
  /** The head's vertical axis as [x, z]: the bands face away from it. */
  axis?: readonly [number, number]
}

type Built = { curve: THREE.QuadraticBezierCurve3; length: number; mesh: THREE.Mesh; tip: THREE.Vector3 }

/** Rows across the shaft and across the tip. */
const SHAFT_ROWS = 40
const TIP_ROWS = 12

/** A group of guide arrows (mirrored pairs) with `update(grow, opacity, time)` to animate them. */
export function guideArrows(arrows: readonly GuideArrow[], o: GuideArrowOptions) {
  const half = o.radius ?? 0.0028
  const tipHalf = half * 2.6
  const tipLength = half * 6
  const [axisX, axisZ] = o.axis ?? [0, -0.005]
  const uniforms = {
    uColor: { value: new THREE.Color(o.color) },
    uColor2: { value: new THREE.Color(o.color2 ?? o.color) },
    uOpacity: { value: 0 },
    uTime: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: o.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `
      attribute float along; attribute float across;
      varying float vAlong; varying float vAcross;
      void main() {
        vAlong = along; vAcross = across;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uColor2; uniform float uOpacity; uniform float uTime;
      varying float vAlong; varying float vAcross;
      void main() {
        // Soft at the start, full toward the tip; soft edges; a light pulse runs along it.
        float body = smoothstep(0.0, 0.35, vAlong);
        float edge = 1.0 - smoothstep(0.72, 1.0, abs(vAcross));
        float pulse = exp(-pow((fract(vAlong * 0.8 - uTime * 0.7) - 0.5) * 6.0, 2.0));
        vec3 col = mix(uColor2, uColor, smoothstep(0.0, 1.0, vAlong));
        col = mix(col, vec3(1.0), (0.25 * pulse + 0.15 * (1.0 - abs(vAcross))) * ${o.glow ? '1.0' : '0.0'});
        float a = uOpacity * mix(0.35, 1.0, body) * edge * (0.8 + 0.4 * pulse);
        gl_FragColor = ${o.glow ? 'vec4(col * a, 1.0)' : 'vec4(col, min(a, 1.0))'};
      }`,
  })

  /** The outward direction at `p`: away from the head's vertical axis, level. */
  const outward = (p: THREE.Vector3, out: THREE.Vector3) => out.set(p.x - axisX, 0, p.z - axisZ).normalize()

  // One strip of rows; the quads between neighbouring rows are fixed, the rows move as the arrow grows.
  const rows = SHAFT_ROWS + TIP_ROWS + 1
  const index: number[] = []
  for (let i = 0; i < rows - 1; i++) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)

  const group = new THREE.Group()
  group.renderOrder = 10
  const built: Built[] = []
  for (const arrow of arrows) {
    const sides = arrow.single ? [1] : [1, -1]
    for (const side of sides) {
      const a = new THREE.Vector3(arrow.from[0] * side, arrow.from[1], arrow.from[2])
      const b = new THREE.Vector3(arrow.to[0] * side, arrow.to[1], arrow.to[2])
      const mid = a.clone().lerp(b, 0.5)
      mid.z += arrow.bow ?? 0.008
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows * 6), 3))
      geometry.setAttribute('along', new THREE.BufferAttribute(new Float32Array(rows * 2), 1))
      const across = new Float32Array(rows * 2)
      for (let i = 0; i < rows; i++) across.set([-1, 1], 2 * i)
      geometry.setAttribute('across', new THREE.BufferAttribute(across, 1))
      geometry.setIndex(index)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.renderOrder = 10
      mesh.frustumCulled = false
      group.add(mesh)
      built.push({ curve, length: curve.getLength(), mesh, tip: new THREE.Vector3() })
    }
  }

  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  const n = new THREE.Vector3()
  const s = new THREE.Vector3()
  /** Sets row `i` at curve parameter `u`, `w` wide on each side. */
  const row = (pos: THREE.BufferAttribute, along: THREE.BufferAttribute, curve: THREE.Curve<THREE.Vector3>, i: number, u: number, w: number) => {
    curve.getPoint(u, p)
    curve.getTangent(u, t)
    s.crossVectors(t, outward(p, n)).normalize()
    pos.setXYZ(2 * i, p.x - s.x * w, p.y - s.y * w, p.z - s.z * w)
    pos.setXYZ(2 * i + 1, p.x + s.x * w, p.y + s.y * w, p.z + s.z * w)
    along.setX(2 * i, u)
    along.setX(2 * i + 1, u)
  }

  return {
    group,
    /** `grow` 0..1 how far the arrows are drawn, `opacity` 0..1, `time` seconds (for the running pulse). */
    update(grow: number, opacity: number, time: number) {
      const g = Math.min(Math.max(grow, 0), 1)
      uniforms.uOpacity.value = opacity
      uniforms.uTime.value = time
      for (const { curve, length, mesh, tip } of built) {
        mesh.visible = g > 0.02 && opacity > 0.01
        if (!mesh.visible) continue
        const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
        const along = mesh.geometry.attributes.along as THREE.BufferAttribute
        // The tip takes its full length once there is room for it, and shrinks with a short arrow.
        const tipU = Math.min(tipLength / length, g * 0.5)
        const scale = tipU / (tipLength / length)
        const base = g - tipU
        for (let i = 0; i < SHAFT_ROWS; i++) {
          const u = (base * i) / (SHAFT_ROWS - 1)
          const k = u / g
          row(pos, along, curve, i, u, half * (0.55 + 0.45 * Math.min(1, k / 0.4)))
        }
        // The tip starts on the shaft's last row, wider, and narrows to a point: one surface, no overlap.
        for (let j = 0; j <= TIP_ROWS; j++) {
          const f = j / TIP_ROWS
          row(pos, along, curve, SHAFT_ROWS + j, base + tipU * f, tipHalf * Math.max(scale, 0.4) * (1 - f))
        }
        curve.getPoint(g, tip)
        pos.needsUpdate = true
        along.needsUpdate = true
      }
    },
    /** Where each arrow's tip is now (after `update`), in the order the arrows were built. */
    tips: () => built.map((b) => b.tip),
    dispose() {
      material.dispose()
      for (const { mesh } of built) mesh.geometry.dispose()
    },
  }
}
