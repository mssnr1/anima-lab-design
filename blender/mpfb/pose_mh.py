"""Sets a test pose on the fitted figure: v (V-hand at the temples), o (mouth O) or rest. Env: F1, N1 (hand direction and
back of the hand), SPREAD, CURL, SHRUG (shoulder lift, degrees), OSPEC (jaw, corner in, corner forward, upper lip up, lips
forward). python3 -I pose_mh.py in.blend out.blend v|o|rest"""
import bpy  # noqa
import sys, math, os
from mathutils import Vector, Quaternion, Matrix
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
a = a[-3:]
bpy.ops.wm.open_mainfile(filepath=a[0], load_ui=False)
rig = bpy.data.objects['rig']; P = rig.pose.bones; D = rig.data.bones
def upd(): bpy.context.view_layer.update()
def rot(n, axis, deg):
    pb = P[n]; pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = Quaternion(Vector(axis), math.radians(deg)) @ pb.rotation_quaternion
def frame_rot(d0, b0, d1, b1):
    def basis(d, b):
        d = d.normalized(); b = (b - d * b.dot(d)).normalized(); return Matrix((d, b, d.cross(b))).transposed()
    return (basis(d1, b1) @ basis(d0, b0).transposed()).to_4x4()
def fk_arm(sfx, f1, n1, tip, pole):
    """Hand pointing along f1, back of the hand toward n1, finger line ending at tip; elbow toward pole."""
    P['upper_arm_parent' + sfx]['IK_FK'] = 1.0
    upd(); S = P['upper_arm_fk' + sfx].head.copy(); S0 = D['ORG-upper_arm' + sfx].head_local.copy(); E0 = D['ORG-forearm' + sfx].head_local.copy()
    W0 = D['ORG-hand' + sfx].head_local.copy()
    tipr = D['ORG-f_middle.03' + sfx].tail_local.copy()
    f0 = (tipr - W0).normalized()
    # back of the hand at rest: across the knuckles (index to pinky) × finger direction, outward
    across = D['ORG-f_pinky.01' + sfx].head_local - D['ORG-f_index.01' + sfx].head_local
    n0 = f0.cross(across).normalized()
    side = 1 if sfx == '.L' else -1
    if side < 0: n0 = -n0  # the cross product flips with the mirrored knuckle line
    hand_len = (tipr - W0).length
    f1 = f1.normalized()
    R = frame_rot(f0, n0, f1, n1)
    W1 = tip - hand_len * f1
    l1, l2 = (E0 - S0).length, (W0 - E0).length
    dv = W1 - S; d = min(dv.length, l1 + l2 - 1e-4); u = dv.normalized()
    aa = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(l1 * l1 - aa * aa, 0))
    p = pole.normalized(); v = (p - u * p.dot(u)).normalized(); E = S + u * aa + v * h
    b0 = (E0 - S0).cross(W0 - E0)
    if b0.length < 1e-6: b0 = Vector((0, 1, 0))
    b1 = (E - S).cross(W1 - E)
    for name, a0, a1, c0, c1 in (('upper_arm_fk', S0, S, E0, E), ('forearm_fk', E0, E, W0, W1)):
        upd(); pb = P[name + sfx]
        pb.matrix = Matrix.Translation(a1) @ frame_rot(c0 - a0, b0, c1 - a1, b1) @ Matrix.Translation(-a0) @ pb.bone.matrix_local
    upd(); pb = P['hand_fk' + sfx]
    pb.matrix = Matrix.Translation(W1) @ R @ Matrix.Translation(-W0) @ pb.bone.matrix_local
    upd()
    return n0
def curl(sfx, name, angles, axis=(1, 0, 0)):
    for k, ang in enumerate(angles, 1):
        if ang: rot(f'{name}.0{k}{sfx}', axis, ang)

mode = a[2]
SIGN = float(os.environ.get('CURL', '1'))
if mode == 'v':
    eye = D['ORG-eye.L'].head_local
    for sfx, side in (('.L', 1), ('.R', -1)):
        # raised arms lift the shoulder girdle too (keeps the shoulder blade under the skin)
        upd(); pb = P['shoulder' + sfx]; h = pb.head.copy()
        q = Quaternion(Vector((0, 1, 0)), math.radians(float(os.environ.get('SHRUG', '20')) * side))
        pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
        m = lambda x, y, z: Vector((x * side, y, z))
        tip = Vector((0.072 * side, eye.y + 0.035, eye.z + 0.035))
        fk_arm(sfx, m(*map(float, os.environ.get('F1', '-0.3,0.2,1').split(','))), m(*map(float, os.environ.get('N1', '1,0.1,-0.25').split(','))), tip, m(0.7, 1, -0.9))
        for n in ('f_ring', 'f_pinky'): curl(sfx, n, (75 * SIGN, 85 * SIGN, 55 * SIGN))
        curl(sfx, 'thumb', (0, 25 * SIGN, 30 * SIGN))
        for n, s in (('f_index', 1), ('f_middle', -1)):
            rot(f'{n}.01{sfx}', (0, 0, 1), 10 * s * side * float(os.environ.get('SPREAD', '1')))
elif mode == 'o':
    jaw, cx, cf, tu, bf = map(float, os.environ.get('OSPEC', '12,0.012,0.008,0.002,0.004').split(','))
    rot('jaw_master', (1, 0, 0), jaw)
    def move(n, d):
        upd(); P[n].matrix = Matrix.Translation(Vector(d)) @ P[n].matrix
    move('lip_end.L.001', (-cx, -cf, 0)); move('lip_end.R.001', (cx, -cf, 0))
    move('lip.T', (0, -bf, tu)); move('lip.B', (0, -bf, 0))
upd()
bpy.ops.wm.save_as_mainfile(filepath=a[1])
