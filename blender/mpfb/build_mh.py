"""MakeHuman base mesh (CC0) with MPFB's Rigify human metarig, its helper constraints and skin weights (CC0 data),
built with our own code (MPFB's add-on code is not used). Env VERTS: fitted vertex positions (.npy, same order);
ROLLS: bone z axes to keep (from fit_mh.py). python3 -I build_mh.py <data dir> <out.blend>"""
import bpy  # noqa
import addon_utils
import json
import sys
from mathutils import Vector, Matrix

DATA, OUT = sys.argv[-2], sys.argv[-1]
import gzip, os


def data(name):
    """A file of the MPFB data folder, read as text; the large ones are stored gzipped."""
    p = f"{DATA}/{name}"
    return gzip.open(p + ".gz", "rt") if os.path.exists(p + ".gz") else open(p)
addon_utils.enable("rigify", default_set=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

# --- base mesh ---
V, F = [], []
for line in data("base.obj"):
    if line.startswith("v "):
        x, y, z = map(float, line.split()[1:4])
        V.append((x * 0.1, -z * 0.1, y * 0.1))
    elif line.startswith("f "):
        F.append([int(t.split("/")[0]) - 1 for t in line.split()[1:]])
groups = json.load(data("basemesh_vertex_groups.json"))
def members(name):
    out = []
    for a, b in groups[name]:
        out.extend(range(a, b + 1))
    return out
body = set(members("body"))
zmin = min(V[i][2] for i in body)
V = [(x, y, z - zmin) for x, y, z in V]
import os
if os.environ.get("VERTS"):  # fitted vertex positions (same order), e.g. the skin wrapped onto the Z-Anatomy figure
    import numpy as np
    V = [tuple(map(float, p)) for p in np.load(os.environ["VERTS"])]
cube = {n: Vector([sum(V[i][k] for i in members(n)) / len(members(n)) for k in range(3)]) for n in groups if n.startswith("joint-")}

# body only, keep vertex ids (helpers dropped at the end)
me = bpy.data.meshes.new("Body")
me.from_pydata(V, [], [f for f in F if all(i in body for i in f)])
me.update()
human = bpy.data.objects.new("Body", me)
bpy.context.scene.collection.objects.link(human)

# --- metarig ---
rigdef = json.load(data("rig.human_toes.json"))
B = rigdef["bones"]
def loc(info):
    s = info["strategy"]
    if s == "CUBE":
        p = cube.get(info["cube_name"])
    elif s == "VERTEX":
        p = Vector(V[info["vertex_index"]])
    elif s == "MEAN":
        p = sum((Vector(V[i]) for i in info["vertex_indices"]), Vector()) / len(info["vertex_indices"])
    elif s == "XYZ":
        idx = info["vertex_indices"]
        p = Vector((V[idx[0]][0], V[idx[1]][1], V[idx[2]][2]))
    else:
        p = None
    if p is not None and "offset" in info:
        p = p + Vector(info["offset"]) * 1.0
    return p if p is not None else Vector(info["default_position"])

ROLLS = json.load(open(os.environ["ROLLS"])) if os.environ.get("ROLLS") else None
arm = bpy.data.armatures.new("metarig")
meta = bpy.data.objects.new("metarig", arm)
bpy.context.scene.collection.objects.link(meta)
bpy.context.view_layer.objects.active = meta
for name in rigdef.get("collections", []):
    arm.collections.new(name)
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.edit_bones
worst = 0
for n, b in B.items():
    e = eb.new(n)
    e.head, e.tail = loc(b["head"]), loc(b["tail"])
    worst = max(worst, (e.head - Vector(b["head"]["default_position"])).length)
    e.roll = b["roll"]
print("max distance from MPFB default positions (m):", round(worst, 4))
for n, b in B.items():
    e = eb[n]
    if b["parent"]:
        e.parent = eb[b["parent"]]
    e.use_connect = b["use_connect"]
    e.use_inherit_rotation = b["use_inherit_rotation"]
    e.use_local_location = b["use_local_location"]
    e.inherit_scale = b["inherit_scale"]
    rs = b.get("roll_strategy")
    if ROLLS:
        for k in ("ORG-" + n, n, "DEF-" + n):
            if k in ROLLS:
                e.align_roll(Vector(ROLLS[k]))
                break
        else:
            print("no roll for", n)
        rs = None
    if rs in ("ALIGN_Z_WORLD_Z", "ALIGN_X_WORLD_X"):
        y = e.y_axis.normalized()
        ref = Vector((0, 0, 1)) if rs == "ALIGN_Z_WORLD_Z" else Vector((1, 0, 0))
        if rs == "ALIGN_Z_WORLD_Z":
            z = (ref - y * ref.dot(y)).normalized()
            e.align_roll(z)
        else:
            x = (ref - y * ref.dot(y)).normalized()
            e.align_roll(x.cross(y))  # z = x × y
    for c in b.get("collections", []):
        if c in arm.collections:
            arm.collections[c].assign(e)
bpy.ops.object.mode_set(mode="POSE")
for n, b in B.items():
    pb = meta.pose.bones[n]
    pb.rotation_mode = b.get("rotation_mode", "QUATERNION")
    for c in b.get("constraints", []):
        con = pb.constraints.new(c["type"])
        con.name = c["name"]
        if c.get("target"):
            con.target = meta
            con.subtarget = c.get("subtarget", "")
        for k, v in c.items():
            if k in ("name", "type", "targets", "target", "subtarget"):
                continue
            try:
                setattr(con, k, v)
            except Exception as ex:  # noqa
                print("constraint", n, k, ex)
        for t in c.get("targets", []):
            tt = con.targets.new(); tt.target = meta; tt.subtarget = t["subtarget"]; tt.weight = t["weight"]
    r = b["rigify"]
    if r.get("rigify_type"):
        pb.rigify_type = r["rigify_type"]
    for k, v in r.get("rigify_parameters", {}).items():
        try:
            if k.endswith("_coll_refs"):
                lst = getattr(pb.rigify_parameters, k)
                for nm in v:
                    lst.add().name = nm
            else:
                setattr(pb.rigify_parameters, k, v)
        except Exception as ex:  # noqa
            print("param", n, k, ex)
bpy.ops.object.mode_set(mode="OBJECT")
for i, c in enumerate(arm.collections):
    c.rigify_ui_row = i + 1
bpy.ops.pose.rigify_generate()
rig = bpy.context.view_layer.objects.active
rig.name = "rig"
print("generated", rig.name, len(rig.data.bones), "DEF", sum(1 for b in rig.data.bones if b.use_deform))

# --- weights ---
W = json.load(data("weights.human_toes.json"))["weights"]
missing = []
for n, pairs in W.items():
    target = "DEF-" + n if ("DEF-" + n) in rig.data.bones else n
    if target not in rig.data.bones or not rig.data.bones[target].use_deform:
        missing.append(n)
        continue
    g = human.vertex_groups.get(target) or human.vertex_groups.new(name=target)
    for i, w in pairs:
        if i in body:
            g.add([i], w, "ADD")
print("weight groups without deform bone:", missing)
human.parent = rig
mod = human.modifiers.new("Armature", "ARMATURE")
mod.object = rig
mod.use_deform_preserve_volume = False
# eyes, teeth and tongue from the base mesh helpers, on the same rig
PARTS = {"Eyes": ["helper-l-eye", "helper-r-eye"], "Teeth": ["helper-upper-teeth", "helper-lower-teeth"], "Tongue": ["helper-tongue"]}
for oname, gnames in PARTS.items():
    vs = sorted(set(i for g in gnames for i in members(g)))
    remap = {v: k for k, v in enumerate(vs)}
    fs = [[remap[i] for i in f] for f in F if all(i in remap for i in f)]
    pm = bpy.data.meshes.new(oname); pm.from_pydata([V[i] for i in vs], [], fs); pm.update()
    for p in pm.polygons:
        p.use_smooth = True
    po = bpy.data.objects.new(oname, pm); bpy.context.scene.collection.objects.link(po)
    for n, pairs in W.items():
        target = "DEF-" + n if ("DEF-" + n) in rig.data.bones else n
        if target not in rig.data.bones or not rig.data.bones[target].use_deform:
            continue
        sel = [(remap[i], w) for i, w in pairs if i in remap]
        if sel:
            g = po.vertex_groups.get(target) or po.vertex_groups.new(name=target)
            for i, w in sel:
                g.add([i], w, "ADD")
    po.parent = rig
    md = po.modifiers.new("Armature", "ARMATURE"); md.object = rig
    print(oname, len(vs), "verts", len(fs), "faces", len(po.vertex_groups), "groups")
meta.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved")
