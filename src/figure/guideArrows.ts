import * as THREE from 'three'

/**
 * Arrows in the space around the figure that show which way a muscle pulls: a flat band, like a strip
 * of paper laid gently around the head, following a soft arc a little off the skin, with a flat
 * triangular tip. The band always faces outward from the head's vertical axis, so it bends with the
 * head instead of turning like a tube. Each arrow is given for the figure's left side and drawn
 * mirrored on the right as well, so both sides of the face move together. The arrow grows from its
 * start to its tip (`grow`), and a brighter pulse runs along it while the muscle works (`flow`), in the
 * app's signature light.
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

type Built = { curve: THREE.QuadraticBezierCurve3; head: THREE.Mesh; tube: THREE.Mesh }

const SEGMENTS = 48

/** A group of guide arrows (mirrored pairs) with `update(grow, opacity, time)` to animate them. */
export function guideArrows(arrows: readonly GuideArrow[], o: GuideArrowOptions) {
  const half = o.radius ?? 0.0028
  const [axisX, axisZ] = o.axis ?? [0, -0.005]
  const uniforms = {
    uColor: { value: new THREE.Color(o.color) },
    uColor2: { value: new THREE.Color(o.color2 ?? o.color) },
    uGrow: { value: 0 },
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
      uniform vec3 uColor; uniform vec3 uColor2; uniform float uGrow; uniform float uOpacity; uniform float uTime;
      varying float vAlong; varying float vAcross;
      void main() {
        // The head is marked with a negative value: it is always drawn (it sits at the growing tip).
        float along = vAlong < 0.0 ? 1.0 : vAlong;
        if (vAlong >= 0.0 && vAlong > uGrow + 0.001) discard;
        // Soft at the start, full toward the tip; soft edges; a light pulse runs along it.
        float body = smoothstep(0.0, 0.35, along);
        float edge = 1.0 - smoothstep(0.72, 1.0, abs(vAcross));
        float pulse = exp(-pow((fract(along * 0.8 - uTime * 0.7) - 0.5) * 6.0, 2.0));
        vec3 col = mix(uColor2, uColor, smoothstep(0.0, 1.0, along));
        col = mix(col, vec3(1.0), (0.25 * pulse + 0.15 * (1.0 - abs(vAcross))) * ${o.glow ? '1.0' : '0.0'});
        float a = uOpacity * mix(0.35, 1.0, body) * edge * (0.8 + 0.4 * pulse);
        gl_FragColor = ${o.glow ? 'vec4(col * a, 1.0)' : 'vec4(col, min(a, 1.0))'};
      }`,
  })

  /** The outward direction at `p`: away from the head's vertical axis, level. */
  const outward = (p: THREE.Vector3, out: THREE.Vector3) => out.set(p.x - axisX, 0, p.z - axisZ).normalize()

  const group = new THREE.Group()
  group.renderOrder = 10
  const built: Built[] = []
  // A flat triangle in its own frame: across along x, pointing along +y, facing +z.
  const headGeometry = new THREE.BufferGeometry()
  const hw = half * 2.7
  const hl = half * 5.5
  headGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-hw, -half * 0.4, 0, hw, -half * 0.4, 0, 0, hl, 0], 3))
  headGeometry.setAttribute('along', new THREE.Float32BufferAttribute([-1, -1, -1], 1))
  headGeometry.setAttribute('across', new THREE.Float32BufferAttribute([0.6, 0.6, 0.6], 1))
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  const n = new THREE.Vector3()
  const s = new THREE.Vector3()
  for (const arrow of arrows) {
    const sides = arrow.single ? [1] : [1, -1]
    for (const side of sides) {
      const a = new THREE.Vector3(arrow.from[0] * side, arrow.from[1], arrow.from[2])
      const b = new THREE.Vector3(arrow.to[0] * side, arrow.to[1], arrow.to[2])
      const mid = a.clone().lerp(b, 0.5)
      mid.z += arrow.bow ?? 0.008
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      // The band: two vertices across at each step, narrower at the start.
      const position: number[] = []
      const along: number[] = []
      const across: number[] = []
      const index: number[] = []
      for (let i = 0; i <= SEGMENTS; i++) {
        const u = i / SEGMENTS
        curve.getPoint(u, p)
        curve.getTangent(u, t)
        s.crossVectors(t, outward(p, n)).normalize()
        const w = half * (0.55 + 0.45 * Math.min(1, u / 0.4))
        position.push(p.x - s.x * w, p.y - s.y * w, p.z - s.z * w, p.x + s.x * w, p.y + s.y * w, p.z + s.z * w)
        along.push(u, u)
        across.push(-1, 1)
        if (i < SEGMENTS) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
      }
      const bandGeometry = new THREE.BufferGeometry()
      bandGeometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
      bandGeometry.setAttribute('along', new THREE.Float32BufferAttribute(along, 1))
      bandGeometry.setAttribute('across', new THREE.Float32BufferAttribute(across, 1))
      bandGeometry.setIndex(index)
      const tube = new THREE.Mesh(bandGeometry, material)
      const head = new THREE.Mesh(headGeometry, material)
      tube.renderOrder = head.renderOrder = 10
      tube.frustumCulled = head.frustumCulled = false
      group.add(tube, head)
      built.push({ curve, head, tube })
    }
  }

  const basis = new THREE.Matrix4()
  const facing = new THREE.Vector3()
  return {
    group,
    /** `grow` 0..1 how far the arrows are drawn, `opacity` 0..1, `time` seconds (for the running pulse). */
    update(grow: number, opacity: number, time: number) {
      const g = Math.min(Math.max(grow, 0), 1)
      uniforms.uGrow.value = g
      uniforms.uOpacity.value = opacity
      uniforms.uTime.value = time
      for (const { curve, head } of built) {
        head.visible = g > 0.02 && opacity > 0.01
        curve.getPoint(g, head.position)
        curve.getTangent(g, t)
        outward(head.position, n)
        s.crossVectors(t, n).normalize()
        facing.crossVectors(s, t).normalize()
        head.quaternion.setFromRotationMatrix(basis.makeBasis(s, t, facing))
      }
    },
    dispose() {
      material.dispose()
      headGeometry.dispose()
      for (const { tube } of built) tube.geometry.dispose()
    },
  }
}
