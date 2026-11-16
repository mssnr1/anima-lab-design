"""Put the Z-Anatomy skeleton into the fitted MPFB figure and hang every bone rigidly on one deform bone.
python3 -I skel_attach.py fitted.blend zskin.npz zskel.npz out.blend"""
import bpy  # noqa
import sys, json, collections
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from scipy.spatial import cKDTree

blend, zskin, zskel, out = sys.argv[-4:]
bpy.ops.wm.open_mainfile(filepath=blend, load_ui=False)
rig = bpy.data.objects['rig']; body = bpy.data.objects['Body']
NB = 13380
B = np.array([tuple(v.co) for v in body.data.vertices[:NB]])
z = np.load(zskin); ZV, ZF, zpart = z['V'], z['F'], z['part']
ZF = ZF[~((zpart[ZF[:, 0]] == 3) & (np.abs(ZV[ZF[:, 0], 0]) > 0.33))]
tree = BVHTree.FromPolygons([tuple(v) for v in ZV], [tuple(f) for f in ZF])

# displacement field Z skin -> fitted skin, sampled at the skin, spread into the body by inverse distance
P, D = [], []
for i in range(NB):
    loc, n, idx, dist = tree.find_nearest(Vector(B[i]), 0.06)
    if loc is not None:
        P.append(tuple(loc)); D.append(B[i] - np.array(loc))
P, D = np.array(P), np.array(D)
print('field samples', len(P), 'mean |d| mm', round(float(np.linalg.norm(D, axis=1).mean() * 1000), 2))
kd = cKDTree(P)
s = np.load(zskel)
SV, SF, spart, names = s['V'].astype(float), s['F'], s['part'], list(s['names'])
teeth = {n for n, g in zip(names, s['groups']) if 'teeth' in str(g).lower()}
dist, idx = kd.query(SV, k=24)
w = 1.0 / (dist ** 2 + 1e-6); w /= w.sum(1, keepdims=True)
SV2 = SV + (D[idx] * w[:, :, None]).sum(1)

# rigid attachment: the deform bone that carries most of the nearby skin
ALLOWED = ('spine', 'shoulder', 'upper_arm', 'forearm', 'hand', 'palm', 'f_', 'thumb', 'pelvis', 'thigh', 'shin',
           'foot', 'toe', 'jaw')
gi = {g.index: g.name for g in body.vertex_groups}
def allowed(n):
    b = n[4:] if n.startswith('DEF-') else None
    return b is not None and b.startswith(ALLOWED) and 'helper' not in b
vw = []
for v in body.data.vertices[:NB]:
    vw.append({gi[e.group]: e.weight for e in v.groups if allowed(gi[e.group])})
bkd = cKDTree(B)
_, near = bkd.query(SV2, k=6)
import re
def family(g):
    # twist segments count with their main bone: DEF-upper_arm.L.001 -> DEF-upper_arm.L
    return re.sub(r'(\.[LR])\.\d+$', r'\1', g)
spine = [n for n in rig.data.bones.keys() if re.fullmatch(r'DEF-spine(\.\d+)?', n)]
def seg_dist(p, n):
    bn = rig.data.bones[n]; h, t = np.array(bn.head_local), np.array(bn.tail_local)
    d = t - h; u = np.clip(np.dot(p - h, d) / np.dot(d, d), 0, 1)
    return np.linalg.norm(p - (h + u * d))
assign = {}
for p, nm in enumerate(names):
    sel = np.where(spart == p)[0]
    acc = collections.Counter()
    for i in sel:
        for j in near[i]:
            for g, ww in vw[j].items():
                acc[family(g)] += ww
    top = acc.most_common(1)[0][0] if acc else 'DEF-spine.006'
    side = '.L' if SV2[sel, 0].mean() > 0 else '.R'
    if nm == 'Mandible' or (nm.startswith('Lower ') and nm in teeth):
        g = 'DEF-jaw'
    elif nm in teeth:
        g = 'DEF-spine.006'
    elif nm.startswith('Clavicle'):
        g = 'DEF-shoulder' + side
    elif top.startswith('DEF-spine') or top == 'DEF-jaw' or top.startswith('DEF-pelvis') and 'Hip' not in nm and 'Sacrum' not in nm and 'Coccy' not in nm:
        # axial skeleton: the spine segment nearest to the bone's back end (ribs hang on their vertebra)
        q = SV2[sel][np.argmax(SV2[sel, 1])] if 'rib' in nm.lower() or 'cartilage' in nm.lower() else SV2[sel].mean(0)
        g = min(spine, key=lambda n: seg_dist(q, n))
    else:
        g = top
    if g not in rig.data.bones:
        print('missing', nm, g); g = 'DEF-spine.006'
    assign[nm] = g
me = bpy.data.meshes.new('Skeleton'); me.from_pydata(SV2.tolist(), [], SF.tolist()); me.validate(); me.update()
for poly in me.polygons:
    poly.use_smooth = True
ob = bpy.data.objects.new('Skeleton', me); bpy.context.scene.collection.objects.link(ob)
att = me.attributes.new('bone_part', 'INT', 'POINT'); att.data.foreach_set('value', spart.astype(np.int32))
for p, nm in enumerate(names):
    g = ob.vertex_groups.get(assign[nm]) or ob.vertex_groups.new(name=assign[nm])
    g.add(np.where(spart == p)[0].tolist(), 1.0, 'REPLACE')
ob['bone_names'] = json.dumps(names)
ob.parent = rig
md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = rig
c = collections.Counter(assign.values()); print(len(c), 'deform bones used:', c.most_common(40))
for k in ('Hip bone.l', 'Sacrum', 'Atlas', 'Seventh cervical vertebra', 'Thyroid cartilage', 'Body of sternum', 'Upper first molar tooth.l', 'Mandible', 'Humerus.l', 'Radius.l', 'Scapula.l', 'Clavicle.l', 'Sixth rib.l', 'Femur.l', 'Hyoid bone', 'Frontal bone'):
    if k in assign: print(k, '->', assign[k])
import os
if os.environ.get('ASSIGN'):  # which deform joint carries each bone, for reference
    json.dump(assign, open(os.environ['ASSIGN'], 'w'), indent=0, sort_keys=True)
bpy.ops.wm.save_as_mainfile(filepath=out)
