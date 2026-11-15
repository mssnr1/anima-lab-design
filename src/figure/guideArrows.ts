import * as THREE from 'three'

/**
 * Arrows in the space around the figure that show which way a muscle pulls: a soft tube along a gentle
 * arc, standing a little off the skin, with a rounded cone at its tip. Each arrow is given for the
 * figure's left side and drawn mirrored on the right as well, so both sides of the face move together.
 * The arrow grows from its start to its tip (`grow`), and a brighter pulse runs along it while the muscle
 * works (`flow`), in the app's signature light.
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
  radius?: number
}

type Built = { curve: THREE.QuadraticBezierCurve3; head: THREE.Mesh; tube: THREE.Mesh }

/** A group of guide arrows (mirrored pairs) with `update(grow, opacity, time)` to animate them. */
export function guideArrows(arrows: readonly GuideArrow[], o: GuideArrowOptions) {
  const radius = o.radius ?? 0.0022
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
    blending: o.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `
      attribute float along;
      varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main() {
        vAlong = along;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uColor2; uniform float uGrow; uniform float uOpacity; uniform float uTime;
      varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main() {
        if (vAlong > uGrow + 0.001) discard;
        // Soft at the start, full toward the tip; a light pulse runs along it.
        float body = smoothstep(0.0, 0.35, vAlong);
        float pulse = exp(-pow((fract(vAlong * 0.8 - uTime * 0.7) - 0.5) * 6.0, 2.0));
        float facing = abs(dot(normalize(vN), normalize(vView)));
        vec3 col = mix(uColor2, uColor, smoothstep(0.0, 1.0, vAlong));
        col = mix(col, vec3(1.0), 0.35 * pulse * ${o.glow ? '1.0' : '0.0'});
        float a = uOpacity * mix(0.35, 1.0, body) * mix(0.55, 1.0, facing) * (0.8 + 0.4 * pulse);
        gl_FragColor = ${o.glow ? 'vec4(col * a, 1.0)' : 'vec4(col, min(a, 1.0))'};
      }`,
  })

  const group = new THREE.Group()
  group.renderOrder = 10
  const built: Built[] = []
  const headGeometry = new THREE.ConeGeometry(radius * 2.6, radius * 6, 20, 1)
  headGeometry.translate(0, radius * 3, 0)
  headGeometry.setAttribute('along', new THREE.Float32BufferAttribute(new Float32Array(headGeometry.attributes.position.count).fill(1), 1))
  for (const arrow of arrows) {
    const sides = arrow.single ? [1] : [1, -1]
    for (const side of sides) {
      const a = new THREE.Vector3(arrow.from[0] * side, arrow.from[1], arrow.from[2])
      const b = new THREE.Vector3(arrow.to[0] * side, arrow.to[1], arrow.to[2])
      const mid = a.clone().lerp(b, 0.5)
      mid.z += arrow.bow ?? 0.008
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      // The shaft stops where the head begins.
      const tubeGeometry = new THREE.TubeGeometry(curve, 48, radius, 12, false)
      const uv = tubeGeometry.attributes.uv
      const along = new Float32Array(uv.count)
      for (let i = 0; i < uv.count; i++) along[i] = uv.getX(i)
      tubeGeometry.setAttribute('along', new THREE.BufferAttribute(along, 1))
      const tube = new THREE.Mesh(tubeGeometry, material)
      const head = new THREE.Mesh(headGeometry, material)
      tube.renderOrder = head.renderOrder = 10
      group.add(tube, head)
      built.push({ curve, head, tube })
    }
  }

  const up = new THREE.Vector3(0, 1, 0)
  const tangent = new THREE.Vector3()
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
        curve.getTangent(g, tangent)
        head.quaternion.setFromUnitVectors(up, tangent)
      }
    },
    dispose() {
      material.dispose()
      headGeometry.dispose()
      for (const { tube } of built) tube.geometry.dispose()
    },
  }
}
