"""
Rigs the shared anatomy figure with a Rigify skeleton and exports it with skin weights.

    python -I blender/rig_figure.py blender/atmen-anatomy.blend build/

Input is the figure as built by `build_anatomy.py`. Output in `build/`: `anima-figure.blend` (the figure with
the Rigify metarig and the generated rig, posable in Blender) and `anima-figure.glb` (only the deform bones,
`DEF-*`, as a glTF skin, plus all meshes with their shape keys).

What it does, in order:

1. Cuts the lips apart along the line where they meet, so the mouth can open (the skin was closed there).
   The rest shape stays exactly the same: the cut only adds vertices on existing edges.
2. Adds `Mouth_Inner`, a dark cavity behind the lips, hanging from the cut so no gap opens between them.
3. Builds the Rigify human metarig fitted to the figure (spine, neck, head, arms, hands with five fingers,
   legs) plus a jaw and four lip bones instead of Rigify's full face rig, and generates the rig.
4. Binds the skin: bone heat on arms, trunk and legs; then hand-made weights where heat is not good enough:
   the fingers (each finger only follows its own bones), head, neck, jaw and lips (one function of the
   position, applied to `Head` and `Body_Shell` alike, so the two overlapping skins never part), the nose
   only on the head bone. Organs follow the chest, the nasal cavity the head.
5. Saves the `.blend` and exports the GLB (deform bones only, licence in `asset.copyright`).

All positions are Blender world metres (z up, the figure faces -y, its left is +x), measured from the mesh.
"""

import math
import os
import sys

import bpy  # noqa: I001  (bpy first: it makes bmesh and mathutils importable)
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from scipy.spatial import cKDTree

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
SRC, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False)
bpy.ops.preferences.addon_enable(module="rigify")
scene = bpy.context.scene

COPYRIGHT = (
    "Z-Anatomy (CC BY-SA 4.0), BodyParts3D, DBCLS (CC BY-SA 2.1 JP); "
    "adapted for Anima Labs (selection, simplification, materials, shape keys, rig), CC BY-SA 4.0"
)


def smooth(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def world_coords(obj):
    m = np.array(obj.matrix_world)
    co = np.array([v.co for v in obj.data.vertices]) if len(obj.data.vertices) else np.zeros((0, 3))
    return co @ m[:3, :3].T + m[:3, 3]


# --------------------------------------------------------------------------------------------------------
# Landmarks (left side; the right side is mirrored in x). Measured from the mesh in cross-sections.
# --------------------------------------------------------------------------------------------------------

# The line where the lips meet: from the front profile, the deepest point between upper and lower lip,
# 1.5295 m in the middle, a little lower toward the corners. Half width of the mouth to its corners.
MOUTH_HW = 0.025


def seam_z(x):
    return 1.5295 - 0.002 * np.minimum(1.0, (np.asarray(x) / MOUTH_HW) ** 2)


J = {
    # Spine: hips up to the top of the head; neck bones from the base of the neck; head pivot at the atlas.
    "spine": [(0, 0.035, 0.955), (0, 0.040, 1.065), (0, 0.045, 1.175), (0, 0.050, 1.285), (0, 0.035, 1.425), (0, 0.025, 1.49), (0, 0.010, 1.555), (0, 0.010, 1.712)],
    "shoulder": ((0.025, -0.005, 1.425), (0.165, 0.035, 1.405)),
    "arm": [(0.188, 0.040, 1.355), (0.242, 0.043, 1.115), (0.293, -0.014, 0.880), (0.299, -0.041, 0.790)],
    # Fingers: knuckle (MCP), then centres of the finger's cross-sections down to its tip.
    "f_index": [(0.303, -0.062, 0.784), (0.297, -0.070, 0.748), (0.290, -0.077, 0.736), (0.279, -0.086, 0.724), (0.269, -0.092, 0.712), (0.267, -0.093, 0.707)],
    "f_middle": [(0.299, -0.041, 0.782), (0.286, -0.044, 0.748), (0.280, -0.048, 0.736), (0.271, -0.054, 0.724), (0.260, -0.059, 0.712), (0.253, -0.063, 0.702)],
    "f_ring": [(0.290, -0.021, 0.779), (0.275, -0.023, 0.748), (0.268, -0.026, 0.736), (0.254, -0.033, 0.724), (0.249, -0.035, 0.718), (0.247, -0.036, 0.713)],
    "f_pinky": [(0.281, -0.002, 0.772), (0.264, -0.002, 0.754), (0.257, -0.003, 0.742), (0.246, -0.007, 0.730), (0.243, -0.008, 0.725)],
    # Thumb: from the base of its metacarpal (near the wrist) to the tip.
    "thumb": [(0.300, -0.048, 0.850), (0.299, -0.067, 0.838), (0.297, -0.078, 0.822), (0.297, -0.088, 0.806), (0.290, -0.094, 0.790), (0.285, -0.099, 0.774), (0.285, -0.101, 0.764)],
    "palm_root": [(0.297, -0.040, 0.862), (0.296, -0.031, 0.866), (0.294, -0.022, 0.868), (0.291, -0.013, 0.868)],
    "leg": [(0.090, 0.010, 0.930), (0.085, 0.000, 0.500), (0.080, 0.045, 0.085), (0.095, -0.085, 0.020), (0.100, -0.140, 0.010)],
    "heel": ((0.060, 0.090, 0.000), (0.110, 0.090, 0.000)),
    "pelvis": ((0.0, 0.030, 1.000), (0.110, -0.020, 1.050)),
    # Jaw from the joint in front of the ears to the chin; lip bones point forward out of the mouth.
    "jaw": ((0, 0.010, 1.570), (0, -0.075, 1.492)),
    "lip.T": ((0, -0.075, 1.534), (0, -0.099, 1.535)),
    "lip.B": ((0, -0.072, 1.524), (0, -0.096, 1.524)),
    "lip_corner": ((0.019, -0.066, 1.528), (0.026, -0.084, 1.528)),
}
# Proportions of the finger bones along the finger from knuckle to tip (proximal, middle, distal).
PHALANX = (0.0, 0.46, 0.76, 1.0)
THUMB = (0.0, 0.42, 0.74, 1.0)
# Which way the back of the hand faces (left hand), per finger: the hand is a little cupped.
DORSAL = {"f_index": (1, 0.15, 0), "f_middle": (1, 0.25, 0), "f_ring": (1, 0.4, 0), "f_pinky": (1, 0.55, 0), "thumb": (0.45, -1, 0)}
FINGERS = ("thumb", "f_index", "f_middle", "f_ring", "f_pinky")


def mirror(p, side):
    return Vector((p[0] * side, p[1], p[2]))


def polyline_at(points, fraction):
    pts = [Vector(p) for p in points]
    seg = [(b - a).length for a, b in zip(pts, pts[1:])]
    total = sum(seg)
    target = fraction * total
    for a, b, s in zip(pts, pts[1:], seg):
        if target <= s or s == seg[-1] and b == pts[-1]:
            return a.lerp(b, min(target / s, 1.0) if s else 0.0)
        target -= s
    return pts[-1]


def chain_points(name):
    props = THUMB if name == "thumb" else PHALANX
    return [polyline_at(J[name], f) for f in props]


# --------------------------------------------------------------------------------------------------------
# 1. Cut the lips apart
# --------------------------------------------------------------------------------------------------------

head = bpy.data.objects["Head"]
hm = head.matrix_world.copy()
hinv = hm.inverted()
bm = bmesh.new()
bm.from_mesh(head.data)
bm.verts.ensure_lookup_table()
seam0 = float(seam_z(0.0))
# Bend the seam straight (a plane at seam0), cut with that plane, bend back. Only x changes nothing, so the
# new vertices land on the original edges up to a hair (the seam bends 2 mm over 25 mm).
for v in bm.verts:
    w = hm @ v.co
    v.co = hinv @ Vector((w.x, w.y, w.z - (float(seam_z(min(abs(w.x), MOUTH_HW))) - seam0)))
region = []
for f in bm.faces:
    ws = [hm @ v.co for v in f.verts]
    # every face the (straightened) line passes through; decimated faces can be long and thin
    if min(w.z for w in ws) <= seam0 <= max(w.z for w in ws) and min(abs(w.x) for w in ws) < MOUTH_HW + 0.004 and max(w.y for w in ws) < -0.06:
        region.append(f)
geom = list({e for f in region for e in f.edges}) + region + list({v for f in region for v in f.verts})
plane_local = hinv @ Vector((0, 0, seam0))
plane_no = (hinv.to_3x3() @ Vector((0, 0, 1))).normalized()
res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=plane_local, plane_no=plane_no)
for v in bm.verts:
    w = hm @ v.co
    v.co = hinv @ Vector((w.x, w.y, w.z + (float(seam_z(min(abs(w.x), MOUTH_HW))) - seam0)))
def on_seam(v):
    w = hm @ v.co
    return abs(w.x) <= MOUTH_HW + 1e-6 and w.y < -0.06 and abs(w.z - float(seam_z(abs(w.x)))) < 2e-6


# Where the plane met an existing vertex the cut can leave a double: merge those first.
bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if on_seam(v)], dist=1e-6)
cut = [e for e in bm.edges if all(on_seam(v) for v in e.verts)]
print("lip seam edges", len(cut))
bmesh.ops.split_edges(bm, edges=cut)
# Upper and lower lip: the faces of the mouth (short of its corners) fall apart into two pieces along the cut.
bm.faces.ensure_lookup_table()
inner = {f for f in bm.faces if all(abs((hm @ v.co).x) < MOUTH_HW - 0.0008 for v in f.verts) and abs((hm @ f.calc_center_median()).z - seam0) < 0.012 and (hm @ f.calc_center_median()).y < -0.05}
start = max(inner, key=lambda f: (hm @ f.calc_center_median()).z - abs((hm @ f.calc_center_median()).x))
upper_faces, todo = {start}, [start]
while todo:
    f = todo.pop()
    for e in f.edges:
        for g in e.link_faces:
            if g in inner and g not in upper_faces:
                upper_faces.add(g)
                todo.append(g)
print("mouth faces", len(inner), "upper lip faces", len(upper_faces))
# Every vertex of the mouth takes the side of the faces it belongs to (the cut leaves thin slivers, so a
# vertex a hair above the line can belong to the lower lip).
mouth_side = {}
for v in bm.verts:
    faces = [f for f in v.link_faces if f in inner]
    if faces and not on_seam(v):
        ups = sum(f in upper_faces for f in faces)
        if ups == len(faces):
            mouth_side[v.index] = 1
        elif ups == 0:
            mouth_side[v.index] = -1
seam_verts = {}
for v in bm.verts:
    if on_seam(v) and v.is_boundary:
        faces = [f for f in v.link_faces if f in inner]
        if faces:
            seam_verts[v.index] = 1 if any(f in upper_faces for f in faces) else -1
        else:
            fz = np.mean([(hm @ f.calc_center_median()).z for f in v.link_faces])
            seam_verts[v.index] = 1 if fz > float(seam_z(abs((hm @ v.co).x))) else -1
bm.to_mesh(head.data)
bm.free()
head.data.update()
print("seam vertices (upper, lower)", sum(1 for s in seam_verts.values() if s > 0), sum(1 for s in seam_verts.values() if s < 0))

# --------------------------------------------------------------------------------------------------------
# 2. Mouth cavity
# --------------------------------------------------------------------------------------------------------


def build_mouth_inner():
    hw_ = head.matrix_world
    P = {i: hw_ @ head.data.vertices[i].co for i in seam_verts}
    upper = sorted([i for i, s in seam_verts.items() if s > 0], key=lambda i: P[i].x)
    lower = sorted([i for i, s in seam_verts.items() if s < 0], key=lambda i: P[i].x)
    # Rings: the lip edge, then deeper and wider into the mouth, closed at the back.
    loop = [P[i] for i in upper] + [P[i] for i in reversed(lower)]
    side = [1] * len(upper) + [-1] * len(lower)
    n = len(loop)
    centre = Vector((0, float(np.mean([p.y for p in loop])), seam0))
    rings = []
    for depth, grow_x, height in ((0.0, 1.0, 0.0), (0.004, 0.97, 0.004), (0.012, 0.95, 0.011), (0.022, 0.85, 0.014), (0.032, 0.6, 0.010)):
        ring = []
        for p, s in zip(loop, side):
            x = p.x * grow_x
            z = p.z + s * height * math.sqrt(max(0.0, 1 - (p.x / MOUTH_HW) ** 2)) if height else p.z
            ring.append(Vector((x, p.y + depth, z)))
        rings.append(ring)
    back = Vector((0, centre.y + 0.040, seam0))
    verts = [v for ring in rings for v in ring] + [back]
    faces = []
    for r in range(len(rings) - 1):
        for k in range(n):
            a, b = r * n + k, r * n + (k + 1) % n
            faces.append((a, b, b + n, a + n))
    last = (len(rings) - 1) * n
    for k in range(n):
        faces.append((last + k, last + (k + 1) % n, len(verts) - 1))
    me = bpy.data.meshes.new("Mouth_Inner")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    mat = bpy.data.materials.new("Mouth")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.012, 0.010, 0.025, 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    mat.use_backface_culling = False
    me.materials.append(mat)
    ob = bpy.data.objects.new("Mouth_Inner", me)
    head.users_collection[0].objects.link(ob)
    ob.parent = head.parent
    ob.matrix_parent_inverse = head.parent.matrix_world.inverted() if head.parent else Matrix()
    # Faces look into the cavity (toward the viewer looking into the mouth).
    bm2 = bmesh.new()
    bm2.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
    bmesh.ops.reverse_faces(bm2, faces=bm2.faces)  # outward normals reversed: they now face inward
    bm2.to_mesh(me)
    bm2.free()
    # Per vertex: which lip it hangs from (+1 upper, -1 lower) and how deep it is (0 at the lip).
    tags = [(s, r) for r in range(len(rings)) for s in side] + [(0, len(rings))]
    return ob, tags


mouth, mouth_tags = build_mouth_inner()

# --------------------------------------------------------------------------------------------------------
# 3. Metarig and rig
# --------------------------------------------------------------------------------------------------------

bpy.ops.object.select_all(action="DESELECT")
bpy.ops.object.armature_human_metarig_add()
metarig = bpy.context.object
metarig.name = "metarig"
bpy.ops.object.mode_set(mode="EDIT")
eb = metarig.data.edit_bones

# Rigify's full face rig is far more than the figure needs (and its weights would fight the hand-made
# ones round the mouth): keep only a jaw and four lip bones.
def descendants(b):
    out = []
    for c in b.children:
        out += [c] + descendants(c)
    return out


for name in ("face", "breast.L", "breast.R"):
    b = eb.get(name)
    if b:
        for d in reversed(descendants(b)):
            eb.remove(d)
        eb.remove(b)


def place(name, head_, tail, z_axis=None, roll=None):
    b = eb[name]
    b.head = Vector(head_)
    b.tail = Vector(tail)
    if z_axis is not None:
        b.align_roll(Vector(z_axis))
    elif roll is not None:
        b.roll = roll


# Spine and head: keep Rigify's roll (Z forward), only move the joints.
sp = J["spine"]
for k, name in enumerate(["spine", "spine.001", "spine.002", "spine.003", "spine.004", "spine.005", "spine.006"]):
    place(name, sp[k], sp[k + 1], z_axis=(0, -1, 0))

for side, sfx in ((1, ".L"), (-1, ".R")):
    m = lambda p: mirror(p, side)  # noqa: E731
    place("shoulder" + sfx, m(J["shoulder"][0]), m(J["shoulder"][1]), z_axis=(0, 0, 1))
    a = J["arm"]
    # The elbow points back: X (the bending axis) lies across the arm, Z points back to the elbow tip.
    place("upper_arm" + sfx, m(a[0]), m(a[1]), z_axis=(0, 1, 0))
    place("forearm" + sfx, m(a[1]), m(a[2]), z_axis=(0, 1, 0))
    place("hand" + sfx, m(a[2]), m(a[3]), z_axis=(side * 1, 0, 0))
    for name in FINGERS:
        pts = chain_points(name)
        dorsal = Vector(DORSAL[name])
        dorsal.x *= side
        for k in range(3):
            place(f"{name}.0{k + 1}{sfx}", m(pts[k]), m(pts[k + 1]), z_axis=dorsal)
    # Palm bones from the wrist to each finger's knuckle (index to pinky); Rigify spreads the palm with them.
    for k, name in enumerate(("f_index", "f_middle", "f_ring", "f_pinky")):
        place(f"palm.0{k + 1}{sfx}", m(J["palm_root"][k]), m(J[name][0]), z_axis=(side * 1, 0.2 * k, 0))
    lg = J["leg"]
    place("thigh" + sfx, m(lg[0]), m(lg[1]), z_axis=(0, -1, 0))
    place("shin" + sfx, m(lg[1]), m(lg[2]), z_axis=(0, -1, 0))
    place("foot" + sfx, m(lg[2]), m(lg[3]), z_axis=(0, 0, 1))
    place("toe" + sfx, m(lg[3]), m(lg[4]), z_axis=(0, 0, 1))
    place("heel.02" + sfx, m(J["heel"][0] if side > 0 else J["heel"][1]), m(J["heel"][1] if side > 0 else J["heel"][0]), z_axis=(0, 0, 1))
    place("pelvis" + sfx, m(J["pelvis"][0]), m(J["pelvis"][1]), z_axis=(0, -1, 0))

# Jaw and lips.
headb = eb["spine.006"]
jaw = eb.new("jaw")
jaw.head, jaw.tail = Vector(J["jaw"][0]), Vector(J["jaw"][1])
jaw.align_roll(Vector((0, 0, -1)))
jaw.parent = headb
for name, parent in (("lip.T", headb), ("lip.B", jaw)):
    b = eb.new(name)
    b.head, b.tail = Vector(J[name][0]), Vector(J[name][1])
    b.align_roll(Vector((0, 0, 1)))
    b.parent = parent
for side, sfx in ((1, ".L"), (-1, ".R")):
    b = eb.new("lip_corner" + sfx)
    b.head, b.tail = mirror(J["lip_corner"][0], side), mirror(J["lip_corner"][1], side)
    b.align_roll(Vector((0, 0, 1)))
    b.parent = headb
bpy.ops.object.mode_set(mode="OBJECT")
for name in ("jaw", "lip.T", "lip.B", "lip_corner.L", "lip_corner.R"):
    pb = metarig.pose.bones[name]
    pb.rigify_type = "basic.super_copy"
    pb.rigify_parameters.make_deform = True
    pb.rigify_parameters.make_control = True

# Fingers bend round their own X axis as rolled above (Rigify's "automatic" would guess it from the slight
# sideways curve of the resting fingers).
for side in (".L", ".R"):
    for name in FINGERS:
        metarig.pose.bones[f"{name}.01{side}"].rigify_parameters.primary_rotation_axis = "X"
bpy.context.view_layer.objects.active = metarig
bpy.ops.pose.rigify_generate()
rig = bpy.data.objects.get("rig") or next(o for o in bpy.data.objects if o.type == "ARMATURE" and o is not metarig)
rig.name = "rig"
anatomy = bpy.data.objects["Anatomy"]
DEF = [b.name for b in rig.data.bones if b.use_deform]
print("deform bones", len(DEF))

# --------------------------------------------------------------------------------------------------------
# 4. Skin weights
# --------------------------------------------------------------------------------------------------------

SKIN = ["Head", "Body_Shell", "Arms", "Legs"]
skins = [bpy.data.objects[n] for n in SKIN]

# Bone heat on a joined copy of the skin (one solve, the same bones for all parts).
bpy.ops.object.select_all(action="DESELECT")
copies = []
for o in skins:
    c = o.copy()
    c.data = o.data.copy()
    scene.collection.objects.link(c)
    copies.append(c)
for c in copies:
    c.select_set(True)
bpy.context.view_layer.objects.active = copies[0]
bpy.ops.object.join()
joined = bpy.context.object
if joined.data.shape_keys:
    joined.shape_key_clear()
bpy.ops.object.select_all(action="DESELECT")
joined.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
counts = [len(o.data.vertices) for o in skins]
NV = sum(counts)
BI = {n: k for k, n in enumerate(DEF)}
W = np.zeros((NV, len(DEF)))
gname = {g.index: g.name for g in joined.vertex_groups}
for v in joined.data.vertices:
    for g in v.groups:
        n = gname[g.group]
        if n in BI:
            W[v.index, BI[n]] = g.weight
print("heat: vertices without weight", int((W.sum(1) < 1e-6).sum()), "of", NV)
bpy.data.objects.remove(joined)

X = np.vstack([world_coords(o) for o in skins])
owner = np.concatenate([[k] * c for k, c in enumerate(counts)])
x, y, z = X[:, 0], X[:, 1], X[:, 2]


def col(name):
    return BI[name]


def set_only(rows, weights):
    """Replace the weights of these rows by {bone: weight array}."""
    W[rows] = 0
    for name, w in weights.items():
        W[rows, col(name)] += w


# Bone heat sees bones through the body (the jaw from the chest, the pelvis from the ribs): keep each
# bone to the part of the body it can move. Head, neck, jaw and lips are set by hand below.
part = np.array(SKIN)[owner]
for name in DEF:
    c = col(name)
    base = name[4:]
    if base.startswith(("jaw", "lip", "spine.004", "spine.005", "spine.006")):
        W[:, c] = 0
        continue
    if base.endswith(".L"):
        W[x < -0.01, c] = 0
    if base.endswith(".R"):
        W[x > 0.01, c] = 0
    if base.startswith(("forearm", "hand", "palm", "thumb", "f_")):
        W[part != "Arms", c] = 0
    if base.startswith("upper_arm"):
        # on the trunk only the shoulder cap goes with the arm, not the side of the chest below the armpit
        nb_ = part != "Arms"
        W[nb_, c] *= smooth((np.abs(x[nb_]) - 0.12) / 0.05) * smooth((z[nb_] - 1.22) / 0.07)
    if base.startswith(("thigh", "shin", "foot", "toe", "heel")):
        W[(part != "Legs") & (z > 1.0), c] = 0
        W[part == "Arms", c] = 0
    if base.startswith("pelvis"):
        W[(z > 1.12) | (part == "Arms"), c] = 0
    if base.startswith("shoulder"):
        W[z < 1.15, c] = 0

# Vertices heat left empty (stray bits): take the weights of the nearest weighted vertex.
empty = W.sum(1) < 1e-6
if empty.any():
    tree = cKDTree(X[~empty])
    _, idx = tree.query(X[empty])
    W[empty] = W[~empty][idx]

# 4a. One skin across the parts: where trunk, arms and legs meet and overlap, average the weights of all
# parts within 12 mm, so overlapping skins move as one. Not on hands and head (they get their own below).
tree = cKDTree(X)
# Only where parts actually meet: shoulders (arms and trunk) and hips (legs and trunk).
zone = ((z > 1.24) & (z < 1.47) & (np.abs(x) > 0.11)) | ((z > 0.92) & (z < 1.03) & (np.abs(x) < 0.2))
for _ in range(2):
    nb = tree.query_ball_point(X[zone], 0.012)
    W[zone] = np.array([W[i].mean(0) for i in nb])

# 4b. Fingers: each finger vertex follows only its own finger, bending smoothly at the joints.


def seg_project(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    q = a + t[:, None] * ab
    return t, np.linalg.norm(p - q, axis=1)


label = np.zeros(NV, dtype=int)  # which finger a vertex belongs to (0: none)
for side, sfx in ((1, ".L"), (-1, ".R")):
    hand_rows = np.where((x * side > 0.2) & (z < 0.905))[0]
    P = X[hand_rows]
    best = np.full(len(P), np.inf)
    owner_f = np.full(len(P), -1)
    proj = {}
    for fi, name in enumerate(FINGERS):
        pts = [np.array(mirror(p, side)) for p in chain_points(name)]
        # distance to the finger's chain (knuckle to tip) and arc position along it (0 knuckle, 3 tip)
        dmin = np.full(len(P), np.inf)
        s = np.zeros(len(P))
        for k in range(3):
            t, d = seg_project(P, pts[k], pts[k + 1])
            better = d < dmin
            dmin[better] = d[better]
            s[better] = k + t[better]
        # before the knuckle (inside the palm) the finger does not own anything
        t0 = ((P - pts[0]) @ (pts[1] - pts[0])) / np.linalg.norm(pts[1] - pts[0]) ** 2
        proj[name] = (dmin, s, t0)
        closer = dmin < best
        best[closer] = dmin[closer]
        owner_f[closer] = fi
    # Ownership: hard on the finger itself, shared between neighbours at the base (the skin between two
    # fingers follows both, so it neither tears nor gets pulled by one finger alone).
    near = np.where(best < 0.016)[0]
    label[hand_rows[near]] = side * 10 + 1 + owner_f[near]
    D = np.stack([proj[n][0][near] for n in FINGERS], 1)
    Sarc = np.stack([proj[n][1][near] for n in FINGERS], 1)
    soft = np.exp(-((D / 0.005) ** 2) + ((D.min(1, keepdims=True) / 0.005) ** 2))
    soft /= soft.sum(1, keepdims=True)
    hard = np.eye(len(FINGERS))[owner_f[near]]
    alpha = smooth((Sarc[np.arange(len(near)), owner_f[near]] - 0.8) / 0.25)[:, None]
    share = alpha * hard + (1 - alpha) * soft
    rows = hand_rows[near]
    keep = W[rows].copy()
    for other in FINGERS:
        for k in range(3):
            keep[:, col(f"DEF-{other}.0{k + 1}{sfx}")] = 0
    ksum = keep.sum(1, keepdims=True)
    keep = np.where(ksum > 1e-6, keep / np.maximum(ksum, 1e-6), 0)
    keep[ksum[:, 0] <= 1e-6, col("DEF-hand" + sfx)] = 1
    new_w = np.zeros((len(rows), W.shape[1]))
    taken = np.zeros(len(rows))
    h = 0.25  # half width of the blend at a joint, in bone lengths
    for fi, name in enumerate(FINGERS):
        ss = Sarc[:, fi]
        t0 = proj[name][2][near]
        # across the knuckle: from the palm into the finger
        into = smooth((t0 + 0.3) / 0.6) if name != "thumb" else smooth((t0 + 0.1) / 0.35)
        f = share[:, fi] * into
        b1 = smooth((ss - (1 - h)) / (2 * h))
        b2 = smooth((ss - (2 - h)) / (2 * h))
        new_w[:, col(f"DEF-{name}.01{sfx}")] += f * (1 - b1)
        new_w[:, col(f"DEF-{name}.02{sfx}")] += f * (b1 - b2)
        new_w[:, col(f"DEF-{name}.03{sfx}")] += f * b2
        taken += f
    W[rows] = new_w + keep * (1 - taken)[:, None]
    # Palm vertices owned by no finger: no finger bones beyond the first joint.
    rest = hand_rows[(best >= 0.016)]
    for name in FINGERS:
        for k in (2, 3):
            W[rest, col(f"DEF-{name}.0{k}{sfx}")] = 0

# 4c. Head, neck, jaw and lips: one function of the position for Head and Body_Shell alike.


def neck_head_weights(p, lip_side=None):
    px, py, pz = p[:, 0], p[:, 1], p[:, 2]
    # The boundaries run oblique: low under the chin, high at the back of the head.
    head_w = smooth((pz - (1.505 + 0.55 * py) + 0.015) / 0.03)
    upper_neck = smooth((pz - (1.468 + 0.35 * py) + 0.02) / 0.04)
    lower_neck = smooth((pz - (1.425 + 0.35 * py) + 0.02) / 0.04)
    chest = 1 - lower_neck
    n1 = lower_neck - upper_neck
    n2 = upper_neck - head_w
    # Jaw: below the line of the lips and in front of the jaw's back edge, fading under the chin.
    ax = np.abs(px)
    sz = seam_z(np.minimum(ax, MOUTH_HW))
    below = pz < sz if lip_side is None else np.where(lip_side != 0, lip_side < 0, pz < sz)
    in_mouth = ax <= MOUTH_HW
    # toward the corners the lips part less (half way at the corner), only near the line itself
    corner = smooth((ax - (MOUTH_HW - 0.006)) / 0.006) * 0.5 * (1 - smooth(np.abs(pz - sz) / 0.008))
    w_mouth = np.where(below, 1 - corner, corner) * np.where(below, 1.0, 1 - smooth((pz - sz) / 0.008))
    band = 0.014 + 0.8 * (ax - MOUTH_HW)
    w_cheek = smooth((sz + 0.3 * (ax - MOUTH_HW) - pz) / np.maximum(band, 1e-3) + 0.5)
    wj = np.where(in_mouth, w_mouth, w_cheek)
    wj = wj * smooth((0.012 - py) / 0.022) * smooth((pz - 1.455) / 0.03)
    wj = np.where(pz > 1.548, 0.0, wj)  # the nose stays on the head
    # Lips: upper and lower lip toward their bones, the corners toward theirs.
    front = smooth((-0.062 - py) / 0.01)
    mid = 1 - smooth((ax - 0.010) / 0.014)
    up = ~below
    wT = np.where(up, 1 - smooth((pz - 1.537) / 0.008), 0) * mid * front * 0.85
    wB = np.where(~up, 1 - smooth((sz - pz - 0.006) / 0.009), 0) * mid * front * 0.85
    wC = {}
    for sgn, sfx in ((1, ".L"), (-1, ".R")):
        d2 = (px - sgn * MOUTH_HW) ** 2 + (pz - float(seam_z(MOUTH_HW))) ** 2
        wC[sfx] = np.exp(-d2 / (2 * 0.009**2)) * front * 0.55
    lips = np.minimum(wT + wB + wC[".L"] + wC[".R"], 0.9)
    scale_l = np.where(wT + wB + wC[".L"] + wC[".R"] > 0, lips / np.maximum(wT + wB + wC[".L"] + wC[".R"], 1e-9), 0)
    out = {
        "DEF-spine.003": chest,
        "DEF-spine.004": n1,
        "DEF-spine.005": n2,
        "DEF-spine.006": head_w * (1 - wj) * (1 - lips),
        "DEF-jaw": head_w * wj * (1 - lips),
        "DEF-lip.T": head_w * wT * scale_l,
        "DEF-lip.B": head_w * wB * scale_l,
        "DEF-lip_corner.L": head_w * wC[".L"] * scale_l,
        "DEF-lip_corner.R": head_w * wC[".R"] * scale_l,
    }
    return out


head_rows = np.where(owner == 0)[0]
lip_side = np.zeros(NV)
for i, s in list(mouth_side.items()) + list(seam_verts.items()):
    lip_side[head_rows[0] + i] = s
region = (owner <= 1) & (z > 1.38)
r = np.hypot(x, y - 0.01)
mix = np.maximum(1 - smooth((r - 0.075) / 0.03), smooth((z - 1.44) / 0.03))
mix = np.where(owner == 0, 1.0, mix)
rows = np.where(region)[0]
proc = neck_head_weights(X[rows], lip_side[rows])
Wp = np.zeros((len(rows), W.shape[1]))
for name, w in proc.items():
    Wp[:, col(name)] = w
m_ = mix[rows][:, None]
W[rows] = Wp * m_ + W[rows] * (1 - m_)

# The trunk's skin reaches up under the head's (neck, under the chin): where it lies close under the head,
# it takes the weights of the head skin right above it, so the two move as one when the jaw opens.
hrows = np.where(owner == 0)[0]
brows = np.where((owner == 1) & (z > 1.40))[0]
d_, j_ = cKDTree(X[hrows]).query(X[brows])
t_ = (1 - smooth((d_ - 0.004) / 0.010))[:, None]
W[brows] = t_ * W[hrows[j_]] + (1 - t_) * W[brows]

# 4d. The decimated skin regions also meet in T-junctions (a vertex on the middle of a neighbour's edge):
# smooth the weights over 2.5 mm so neighbours in space move alike. Never across from one finger to
# another, and never across the lips' cut.
sz_all = seam_z(np.minimum(np.abs(x), MOUTH_HW))
slit = (owner <= 1) & (np.abs(x) <= MOUTH_HW + 0.002) & (y < -0.06) & (np.abs(z - sz_all) < 0.006)
upper_side = np.where(lip_side != 0, lip_side > 0, z > sz_all)
label = np.where(slit, np.where(upper_side, 101, 100), label)
nbrs = cKDTree(X).query_ball_point(X, 0.0025)
for _ in range(2):
    Wn = W.copy()
    for i, nb in enumerate(nbrs):
        if len(nb) < 2:
            continue
        nb = np.array(nb)
        li, ln = label[i], label[nb]
        ok = (ln == li) | ((li < 100) & (ln < 100) & ((li == 0) | (ln == 0)))
        Wn[i] = W[nb[ok]].mean(0)
    W = Wn

# 4d. The skin is made of many separate regions (as in the atlas) whose borders lie on top of each other:
# give every set of coinciding vertices the same weights, so the borders never open. The lips' seam is
# the one place that must open, so its two sides are kept apart.
pairs = cKDTree(X).query_pairs(0.0015, output_type="ndarray")
lip_rows = set((head_rows[0] + np.array(list(seam_verts.keys()))).tolist())
pairs = np.array([pq for pq in pairs if not (pq[0] in lip_rows or pq[1] in lip_rows or (label[pq[0]] != label[pq[1]] and max(label[pq[0]], label[pq[1]]) >= 100))])
parent = np.arange(NV)


def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i


for a_, b_ in pairs:
    ra, rb = find(a_), find(b_)
    if ra != rb:
        parent[ra] = rb
roots = np.array([find(i) for i in range(NV)])
sums = np.zeros_like(W)
np.add.at(sums, roots, W)
cnt = np.bincount(roots, minlength=NV)
W = sums[roots] / cnt[roots][:, None]
print("welded vertex groups", int((cnt > 1).sum()))

# 4d. Normalise, at most four bones per vertex (what three.js reads).
top = np.argsort(-W, axis=1)[:, :4]
W4 = np.zeros_like(W)
np.put_along_axis(W4, top, np.take_along_axis(W, top, axis=1), axis=1)
W4[W4 < 0.005] = 0
W4 /= np.maximum(W4.sum(1, keepdims=True), 1e-9)
lost = W4.sum(1) < 1e-6
if lost.any():
    _, idx = cKDTree(X[~lost]).query(X[lost])
    W4[lost] = W4[~lost][idx]
W = W4


def write_groups(obj, Wo):
    obj.vertex_groups.clear()
    used = np.where(Wo.max(0) > 0)[0]
    for b in used:
        g = obj.vertex_groups.new(name=DEF[b])
        nz = np.where(Wo[:, b] > 0)[0]
        for i in nz:
            g.add([int(i)], float(Wo[i, b]), "REPLACE")


def bind(obj, Wo):
    write_groups(obj, Wo)
    mw = obj.matrix_world.copy()
    obj.parent = rig
    obj.matrix_world = mw
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig


start = 0
for o, c in zip(skins, counts):
    bind(o, W[start : start + c])
    start += c

# The mouth cavity: from the lip it hangs on; deeper inside only head (top) and jaw (bottom).
MP = world_coords(mouth)
Wm = np.zeros((len(MP), len(DEF)))
seam_tree = cKDTree(X[head_rows][list(seam_verts.keys())] if seam_verts else X[head_rows][:1])
seam_ids = np.array(list(seam_verts.keys()))
for k, (s, depth) in enumerate(mouth_tags):
    if s == 0:
        Wm[k, col("DEF-spine.006")] = 0.5
        Wm[k, col("DEF-jaw")] = 0.5
        continue
    # same weights as the lip vertex at the same place along the opening
    p = MP[k].copy()
    p[1] = X[head_rows[seam_ids], 1].mean()
    cand = [j for j in seam_ids if seam_verts[j] == s]
    pts = X[head_rows[cand]]
    j = cand[int(np.argmin(np.abs(pts[:, 0] - MP[k, 0])))]
    lipw = W[head_rows[j]].copy()
    fade = min(depth / 2.0, 1.0)
    base = np.zeros(len(DEF))
    jawish = lipw[col("DEF-jaw")] + lipw[col("DEF-lip.B")]
    base[col("DEF-jaw")] = jawish
    base[col("DEF-spine.006")] = 1 - jawish
    Wm[k] = lipw * (1 - fade) + base * fade
bind(mouth, Wm)

# Organs ride along rigidly.
for name, bone in (("Lung_Left", "DEF-spine.003"), ("Lung_Right", "DEF-spine.003"), ("Heart", "DEF-spine.003"), ("Diaphragm", "DEF-spine.002"), ("Bronchi", "DEF-spine.003"), ("Trachea", "DEF-spine.004"), ("Nasal_Cavity", "DEF-spine.006")):
    o = bpy.data.objects[name]
    Wo = np.zeros((len(o.data.vertices), len(DEF)))
    Wo[:, col(bone)] = 1
    bind(o, Wo)

# The deform bones as one tree for the GLB (in Rigify they hang from helper bones that are not exported):
# apps pose these bones directly. In Blender they still follow the rig's controls.
TREE = {
    "DEF-spine.006": "DEF-spine.005",
    "DEF-jaw": "DEF-spine.006",
    "DEF-lip.T": "DEF-spine.006",
    "DEF-lip.B": "DEF-jaw",
    "DEF-lip_corner.L": "DEF-spine.006",
    "DEF-lip_corner.R": "DEF-spine.006",
    "DEF-shoulder.L": "DEF-spine.003",
    "DEF-shoulder.R": "DEF-spine.003",
    "DEF-upper_arm.L": "DEF-shoulder.L",
    "DEF-upper_arm.R": "DEF-shoulder.R",
    "DEF-thigh.L": "DEF-spine",
    "DEF-thigh.R": "DEF-spine",
    "DEF-pelvis.L": "DEF-spine",
    "DEF-pelvis.R": "DEF-spine",
}
# A deform bone that only followed its ORG bone by being its child copies it instead, so it keeps following
# the controls (jaw, lips, shoulder, pelvis) after the move.
for child in TREE:
    pb = rig.pose.bones[child]
    if not pb.constraints and pb.parent.name == "ORG-" + child[4:]:
        c = pb.constraints.new("COPY_TRANSFORMS")
        c.target = rig
        c.subtarget = pb.parent.name
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
reb = rig.data.edit_bones
for child, parent in TREE.items():
    reb[child].use_connect = False
    reb[child].parent = reb[parent]
bpy.ops.object.mode_set(mode="OBJECT")

rig.parent = anatomy
metarig.parent = anatomy
metarig.hide_set(True)
metarig.hide_render = True

# --------------------------------------------------------------------------------------------------------
# 5. Save and export
# --------------------------------------------------------------------------------------------------------

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "anima-figure.blend"))
bpy.ops.object.select_all(action="DESELECT")
for o in [anatomy, rig] + [o for o in bpy.data.objects if o.type == "MESH" and o.parent is rig]:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "anima-figure.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_morph=True,
    export_morph_normal=True,
    export_morph_tangent=False,
    export_materials="EXPORT",
    export_yup=True,
    export_texcoords=False,
    export_normals=True,
    export_extras=True,
    export_skins=True,
    export_def_bones=True,
    export_animations=False,
    export_rest_position_armature=True,
    export_copyright=COPYRIGHT,
)
print("done")
