"""Stage 1+2 of laying the MPFB skin onto the Z-Anatomy figure: pose the MPFB arms and fingers like the
Z-Anatomy ones, apply, then warp (thin-plate RBF) landmark to landmark. Writes the warped vertex array.
python3 -I fit_mh.py human.blend out.npy"""
import bpy  # noqa
import sys, math, json
import numpy as np
from mathutils import Vector, Matrix, Quaternion

src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False)
rig = bpy.data.objects['rig']; P = rig.pose.bones; D = rig.data.bones
body = bpy.data.objects['Body']

# --- Z-Anatomy landmarks (left side, metres, Z up) ---
J = {
    "spine": [(0, 0.035, 0.955), (0, 0.040, 1.065), (0, 0.045, 1.175), (0, 0.050, 1.285), (0, 0.035, 1.425), (0, 0.025, 1.49), (0, 0.010, 1.555), (0, 0.010, 1.712)],
    "arm": [(0.188, 0.040, 1.355), (0.242, 0.043, 1.115), (0.293, -0.014, 0.880), (0.299, -0.041, 0.790)],
    "f_index": [(0.303, -0.062, 0.784), (0.297, -0.070, 0.748), (0.290, -0.077, 0.736), (0.279, -0.086, 0.724), (0.269, -0.092, 0.712), (0.267, -0.093, 0.707)],
    "f_middle": [(0.299, -0.041, 0.782), (0.286, -0.044, 0.748), (0.280, -0.048, 0.736), (0.271, -0.054, 0.724), (0.260, -0.059, 0.712), (0.253, -0.063, 0.702)],
    "f_ring": [(0.290, -0.021, 0.779), (0.275, -0.023, 0.748), (0.268, -0.026, 0.736), (0.254, -0.033, 0.724), (0.249, -0.035, 0.718), (0.247, -0.036, 0.713)],
    "f_pinky": [(0.281, -0.002, 0.772), (0.264, -0.002, 0.754), (0.257, -0.003, 0.742), (0.246, -0.007, 0.730), (0.243, -0.008, 0.725)],
    "thumb": [(0.300, -0.048, 0.850), (0.299, -0.067, 0.838), (0.297, -0.078, 0.822), (0.297, -0.088, 0.806), (0.290, -0.094, 0.790), (0.285, -0.099, 0.774), (0.285, -0.101, 0.764)],
    "leg": [(0.090, 0.010, 0.930), (0.085, 0.000, 0.500), (0.080, 0.045, 0.085), (0.095, -0.085, 0.020), (0.100, -0.140, 0.010)],
}
import os
if os.environ.get('ZJ'):  # joint centres measured on the Z-Anatomy bones (zjoints.py)
    J.update(json.load(open(os.environ['ZJ'])))
PHALANX = (0.0, 0.46, 0.76, 1.0)
THUMB = (0.0, 0.42, 0.74, 1.0)
DORSAL_HAND = (1, 0.25, 0)


def polyline_at(points, f):
    pts = [Vector(p) for p in points]
    seg = [(b - a).length for a, b in zip(pts, pts[1:])]
    t = f * sum(seg)
    for a, b, s in zip(pts, pts[1:], seg):
        if t <= s + 1e-9:
            return a.lerp(b, t / s if s else 0)
        t -= s
    return pts[-1]


def chain(name):
    if len(J[name]) == 4:
        return [Vector(p) for p in J[name]]
    return [polyline_at(J[name], f) for f in (THUMB if name == 'thumb' else PHALANX)]


def m(p, side):
    return Vector((p[0] * side, p[1], p[2]))


def upd():
    bpy.context.view_layer.update()


def frame_rot(d0, b0, d1, b1):
    def basis(d, b):
        d = d.normalized(); b = (b - d * b.dot(d)).normalized(); return Matrix((d, b, d.cross(b))).transposed()
    return (basis(d1, b1) @ basis(d0, b0).transposed()).to_4x4()


def place(name, head_now, d0, b0, d1, b1):
    """Turn pose bone `name` so its rest direction d0 (with reference b0) becomes d1 (b1), its head at head_now."""
    upd(); pb = P[name]
    h0 = pb.bone.head_local
    pb.matrix = Matrix.Translation(head_now) @ frame_rot(d0, b0, d1, b1) @ Matrix.Translation(-h0) @ pb.bone.matrix_local
    upd()


for sfx, side in (('.L', 1), ('.R', -1)):
    P['upper_arm_parent' + sfx]['IK_FK'] = 1.0
    S0 = D['ORG-upper_arm' + sfx].head_local.copy(); E0 = D['ORG-forearm' + sfx].head_local.copy(); W0 = D['ORG-hand' + sfx].head_local.copy()
    zS, zE, zW, zM = [m(p, side) for p in J['arm']]
    b0 = (E0 - S0).cross(W0 - E0)
    b1 = (zE - zS).cross(zW - zE)
    if b0.length < 1e-6 or b1.length < 1e-6:
        b0 = b1 = Vector((0, 1, 0))
    # upper arm and forearm: minimal turn onto the Z-Anatomy direction (a forced roll twists the elbow)
    for nm, tgt in (('upper_arm_fk', zE - zS), ('forearm_fk', zW - zE)):
        upd(); pb = P[nm + sfx]
        q = (pb.tail - pb.head).rotation_difference(tgt)
        h = pb.head.copy()
        pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    W = P['hand_fk' + sfx].head.copy()
    tip0 = D['ORG-f_middle.01' + sfx].head_local
    across = D['ORG-f_pinky.01' + sfx].head_local - D['ORG-f_index.01' + sfx].head_local
    n0 = (tip0 - W0).cross(across).normalized() * side
    place('hand_fk' + sfx, W, tip0 - W0, n0, zM - zW, m(DORSAL_HAND, side))
    # Fingers: each phalanx along the Z-Anatomy finger, minimal turn (keeps the roll).
    for f in ('f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb'):
        pts = [m(p, side) for p in chain(f)]
        for k in range(3):
            n = f'{f}.0{k + 1}{sfx}'
            upd(); pb = P[n]
            d_now = (pb.tail - pb.head)
            q = d_now.rotation_difference(pts[k + 1] - pts[k])
            h = pb.head.copy()
            pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
upd()
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg)
V = np.array([tuple(body.matrix_world @ v.co) for v in ev.data.vertices])
print('posed', V.shape)
# bone z axes in the pose, so the rig rebuilt on the fitted skin keeps the same bone rolls
json.dump({pb.name: list(rig.matrix_world.to_3x3() @ pb.matrix.to_3x3().col[2]) for pb in P}, open(out.replace('.npy', '_rolls.json'), 'w'))


# --- landmarks on the posed MPFB ---
def bh(n): return np.array(P[n].head)
def bt(n): return np.array(P[n].tail)
src_pts, dst_pts = [], []
def pair(a, b):
    src_pts.append(np.array(a, float)); dst_pts.append(np.array(b, float))
sp = ['spine', 'spine.001', 'spine.002', 'spine.003', 'spine.004', 'spine.005', 'spine.006']
mp = [bh('ORG-' + n) for n in sp] + [bt('ORG-spine.006')]
# MPFB spine starts at the pelvis; Z-Anatomy list starts at the hips (0.955): pair by matching chain
for a, b in zip(mp, J['spine']):
    pair(a, b)
for sfx, side in (('.L', 1), ('.R', -1)):
    pair(bh('ORG-upper_arm' + sfx), m(J['arm'][0], side))
    pair(bh('ORG-forearm' + sfx), m(J['arm'][1], side))
    pair(bh('ORG-hand' + sfx), m(J['arm'][2], side))
    for f in ('f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb'):
        pts = [m(p, side) for p in chain(f)]
        for k in range(3):
            pair(bh(f'ORG-{f}.0{k + 1}{sfx}'), pts[k])
        pair(bt(f'ORG-{f}.03{sfx}'), pts[3])
    pair(bh('ORG-thigh' + sfx), m(J['leg'][0], side))
    pair(bh('ORG-shin' + sfx), m(J['leg'][1], side))
    pair(bh('ORG-foot' + sfx), m(J['leg'][2], side))
    pair(bh('ORG-toe' + sfx), m(J['leg'][3], side))
    pair(bt('ORG-toe' + sfx), m(J['leg'][4], side))
np.save(out.replace('.npy', '_lm.npy'), np.array([src_pts, dst_pts]))
np.save(out, V)
print('landmarks', len(src_pts))
