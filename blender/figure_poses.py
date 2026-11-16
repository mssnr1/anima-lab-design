"""Poses of the rigged figure as bone transforms for three.js.

Run headless (Blender as a Python module, or `blender -b -P`):

    python3 -I blender/figure_poses.py build/anima-figure.blend build/anima-figure.glb models/anima-figure-poses.json

Each pose is set on the Rigify controls of `anima-figure.blend` (arms by analytic FK, fingers by curl and
spread, jaw and lips), evaluated, and written as the local transform of every deform joint in the glTF
(`DEF-*`), in the joint frames of the GLB: `{ "<pose>": { "<joint>": { "t": [x,y,z], "r": [x,y,z,w] } } }`.
Only joints that differ from the rest pose are listed. `src/figure/figurePose.ts` blends them in.
"""

import bpy  # noqa: F401  (must come before mathutils)
import json
import math
import struct
import sys

from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
BLEND, GLB, OUT = argv[:3]

bpy.ops.wm.open_mainfile(filepath=BLEND, load_ui=False)
rig = bpy.data.objects["rig"]
P = rig.pose.bones


def update():
    bpy.context.view_layer.update()


# --- the joint tree of the GLB ------------------------------------------------------------------------------

with open(GLB, "rb") as f:
    data = f.read()
length = struct.unpack_from("<I", data, 12)[0]
gltf = json.loads(data[20 : 20 + length])
nodes = gltf["nodes"]
joints = gltf["skins"][0]["joints"]
joint_names = {nodes[j]["name"] for j in joints}
parent_of = {}
for i, n in enumerate(nodes):
    for c in n.get("children", []):
        parent_of[nodes[c]["name"]] = nodes[i]["name"]


def rest_trs(name):
    n = next(n for n in nodes if n["name"] == name)
    return Vector(n.get("translation", (0, 0, 0))), n.get("rotation", (0, 0, 0, 1))


# --- pose helpers (all positions in metres, Blender Z up, left side; `side` mirrors to the right) --------


def rot(name, axis, deg):
    pb = P[name]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Quaternion(Vector(axis), math.radians(deg)) @ pb.rotation_quaternion


def move(name, delta):
    update()
    P[name].matrix = Matrix.Translation(Vector(delta)) @ P[name].matrix


def frame_rot(d0, b0, d1, b1):
    def basis(d, b):
        d = d.normalized()
        b = (b - d * b.dot(d)).normalized()
        return Matrix((d, b, d.cross(b))).transposed()

    return (basis(d1, b1) @ basis(d0, b0).transposed()).to_4x4()


def fk_arm(sfx, side, f1, n1, tip, pole, hand_len=0.175):
    """Puts the hand's fingertip line at `tip`, pointing along `f1` with its back facing `n1`, the elbow toward `pole`."""
    P["upper_arm_parent" + sfx]["IK_FK"] = 1.0
    m = lambda v: Vector((v[0] * side, v[1], v[2]))  # noqa: E731
    S, E0, W0, MCP = m((0.188, 0.040, 1.355)), m((0.242, 0.043, 1.115)), m((0.293, -0.014, 0.880)), m((0.299, -0.041, 0.790))
    f0, n0 = (MCP - W0).normalized(), Vector((-side, 0, 0))
    f1, n1 = m(f1).normalized(), m(n1)
    R = frame_rot(f0, n0, f1, n1)
    W1 = m(tip) - hand_len * f1
    l1, l2 = (E0 - S).length, (W0 - E0).length
    dv = W1 - S
    d = min(dv.length, l1 + l2 - 1e-4)
    u = dv.normalized()
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(l1 * l1 - a * a, 0))
    p = m(pole).normalized()
    v = (p - u * p.dot(u)).normalized()
    E = S + u * a + v * h
    b0, b1 = (E0 - S).cross(W0 - E0), (E - S).cross(W1 - E)
    for name, a0, a1, c0, c1 in (("upper_arm_fk", S, S, E0, E), ("forearm_fk", E0, E, W0, W1)):
        update()
        pb = P[name + sfx]
        pb.matrix = Matrix.Translation(a1) @ frame_rot(c0 - a0, b0, c1 - a1, b1) @ Matrix.Translation(-a0) @ pb.bone.matrix_local
    update()
    pb = P["hand_fk" + sfx]
    pb.matrix = Matrix.Translation(W1) @ R @ Matrix.Translation(-W0) @ pb.bone.matrix_local
    update()


def fingers(sfx, side, spec):
    """Curl (degrees per joint, + bends toward the palm: −X, since the finger bones' Z points to the back of the hand) and spread."""
    for name, (a1, a2, a3, spread) in spec.items():
        for k, a in ((1, a1), (2, a2), (3, a3)):
            if a:
                rot(f"{name}.0{k}{sfx}", (1, 0, 0), -a)
        if spread:
            rot(f"{name}.01{sfx}", (0, 0, 1), spread * side)


def pose_rest():
    pass


def pose_v_hand():
    """Both hands at the temples, index and middle finger spread in a V, the other fingers a fist."""
    spec = {
        "f_index": (-5, -4, -3, -12),
        "f_middle": (-5, -4, -3, 12),
        "f_ring": (60, 80, 50, 0),
        "f_pinky": (60, 80, 50, 0),
        "thumb": (0, 20, 25, 0),
    }
    for sfx, side in ((".L", 1), (".R", -1)):
        fk_arm(sfx, side, (-0.3, 0.2, 1), (-1, 0.1, -0.25), (0.098, -0.025, 1.63), (0.7, -1, -0.9))
        fingers(sfx, side, spec)


def pose_mouth_o():
    """The mouth open as a round O: jaw down, corners in and forward, upper lip up a little."""
    rot("jaw", (1, 0, 0), 12)
    update()
    move("lip_corner.L", (-0.012, -0.009, 0.0))
    move("lip_corner.R", (0.012, -0.009, 0.0))
    move("lip.T", (0, -0.005, 0.003))
    move("lip.B", (0, -0.005, -0.001))


POSES = {"rest": pose_rest, "vHand": pose_v_hand, "mouthO": pose_mouth_o}


def reset():
    for pb in P:
        pb.location = (0, 0, 0)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    for sfx in (".L", ".R"):
        P["upper_arm_parent" + sfx]["IK_FK"] = 1.0
    update()


def def_matrices():
    """Armature-space matrices of the deform bones as evaluated (constraints included)."""
    ev = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return {pb.name: pb.matrix.copy() for pb in ev.pose.bones if pb.name in joint_names}


reset()
rest = def_matrices()
rest_local = {}
for name in joint_names:
    parent = parent_of.get(name)
    if parent in joint_names:
        rest_local[name] = rest[parent].inverted() @ rest[name]

# The joint frames must be the GLB's: check the rest locals against its nodes.
worst = 0.0
for name, m in rest_local.items():
    t, _ = rest_trs(name)
    worst = max(worst, (m.to_translation() - t).length)
assert worst < 1e-4, f"joint frames differ from the GLB ({worst})"

out = {}
for pose, setup in POSES.items():
    reset()
    setup()
    update()
    cur = def_matrices()
    bones = {}
    for name in sorted(joint_names):
        parent = parent_of.get(name)
        if parent in joint_names:
            local = cur[parent].inverted() @ cur[name]
        else:
            # The root: its own change, applied in its glTF frame (the rig's Y-up turn is on the left and stays).
            t0, r0 = rest_trs(name)
            rest_m = Matrix.Translation(t0) @ Quaternion((r0[3], r0[0], r0[1], r0[2])).to_matrix().to_4x4()
            local = rest_m @ (rest[name].inverted() @ cur[name])
        ref = rest_local.get(name)
        if ref is None:
            t0, r0 = rest_trs(name)
            ref = Matrix.Translation(t0) @ Quaternion((r0[3], r0[0], r0[1], r0[2])).to_matrix().to_4x4()
        t, q, _ = local.decompose()
        t_ref, q_ref, _ = ref.decompose()
        if (t - t_ref).length < 1e-5 and q.rotation_difference(q_ref).angle < 1e-4:
            continue
        bones[name] = {"t": [round(x, 6) for x in t], "r": [round(x, 6) for x in (q.x, q.y, q.z, q.w)]}
    out[pose] = bones
    print(pose, len(bones), "joints moved")

with open(OUT, "w") as f:
    json.dump(out, f, indent=1)
print("wrote", OUT)
