"""Z-Anatomy side of the skeleton layer: take the bone meshes from the template (world space), turn the
free arm bones exactly like build_anatomy.relax_arms turns the arm skin, decimate, save as npz.
python3 -I zskel_export.py Startup.blend out.npz"""
import bpy  # noqa
import sys, math
import numpy as np
from mathutils import Matrix, Vector

src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False)

# same constants as blender/build_anatomy.py
SHOULDER = Vector((0.185, 0.0, 1.375)); ARM_SWING = math.radians(-4)
ELBOW_Z, WRIST_Z = 1.1, 0.85; PALM_TURN = math.radians(70)
SKIP = ("Malleus", "Incus", "Stapes", "Sinus of")  # ear ossicles left out to stay clear of the NC-licensed inner ear parts; sinuses are air spaces
RATIO = 0.15
MIN_TRIS = 80


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def chain(o):
    names = []
    p = o.parent
    while p:
        names.append(p.name); p = p.parent
    return names


def in_coll(o, name):
    return any(c.name == name for c in o.users_collection)


# arm skin slices (as relax_arms computes them on the arm skin)
slices = {}
for o in bpy.data.collections["9: Regions of human body"].all_objects:
    if o.type != "MESH" or len(o.data.vertices) <= 10:
        continue
    if not any(in_coll(o, c) for c in ("Left upper limb", "Right upper limb")):
        continue
    if o.name.split(".")[0] in ("Deltoid region", "Scapular region"):
        continue
    mw = o.matrix_world
    for v in o.data.vertices:
        p = mw @ v.co
        k = (p.x >= 0, round(p.z * 100))
        acc = slices.setdefault(k, [Vector(), 0]); acc[0] += p; acc[1] += 1
print("arm skin slices", len(slices))


def centre(side, z):
    for dz in range(0, 6):
        for k in ((side, round(z * 100) + dz), (side, round(z * 100) - dz)):
            if k in slices:
                return slices[k][0] / slices[k][1]
    return Vector()


wrist = {True: centre(True, WRIST_Z), False: centre(False, WRIST_Z)}


def relax(p):
    left = p.x >= 0; side = 1.0 if left else -1.0
    t = smoothstep(ELBOW_Z, WRIST_Z, p.z)
    if t > 0:
        c = centre(left, p.z) if p.z > WRIST_Z else wrist[left]
        rel = Vector((p.x - c.x, p.y - c.y, 0))
        rel.rotate(Matrix.Rotation(t * PALM_TURN * -side, 3, "Z"))
        p = Vector((c.x + rel.x, c.y + rel.y, p.z))
    w = smoothstep(1.31, 1.18, p.z)
    pivot = Vector((side * SHOULDER.x, SHOULDER.y, SHOULDER.z))
    return pivot + Matrix.Rotation(side * ARM_SWING * w, 3, "Y") @ (p - pivot)


dg = bpy.context.evaluated_depsgraph_get()
names, groups, Vs, Fs, part = [], [], [], [], []
off = 0
for o in sorted(bpy.data.collections["1: Skeletal system"].all_objects, key=lambda o: o.name):
    if o.type != "MESH" or len(o.data.vertices) <= 10 or o.name.startswith(SKIP) or o.name.endswith((".g", ".j")):
        continue
    up = chain(o)
    arm = any("upper limb" in n and "girdle" not in n for n in up) and not o.name.startswith(("Clavicle", "Scapula"))
    ntri = sum(len(p.vertices) - 2 for p in o.data.polygons)
    m = o.modifiers.new("dec", "DECIMATE"); m.ratio = max(RATIO, min(1.0, MIN_TRIS / max(ntri, 1)))
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    mw = o.matrix_world
    V = [mw @ v.co for v in me.vertices]
    if arm:
        V = [relax(p) for p in V]
    me.calc_loop_triangles()
    F = [tuple(off + i for i in t.vertices) for t in me.loop_triangles]
    ev.to_mesh_clear(); o.modifiers.remove(m)
    names.append(o.name); groups.append(up[0] if up else ""); Vs += [tuple(p) for p in V]; Fs += F
    part += [len(names) - 1] * len(V); off += len(V)
    print(o.name, "arm" if arm else "", ntri, "->", len(F) if False else "", up[:2])
np.savez(out, V=np.array(Vs, np.float32), F=np.array(Fs, np.int32), part=np.array(part, np.int32),
         names=np.array(names), groups=np.array(groups))
print("bones", len(names), "verts", off, "tris", len(Fs))
