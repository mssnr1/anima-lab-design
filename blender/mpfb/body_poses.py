"""Pose files of the fitted figure as joint transforms for three.js (same format as blender/figure_poses.py).
python3 -I body_poses.py rest.blend body.glb out.json vHand=v.blend mouthO=o.blend"""
import bpy  # noqa
import json, struct, sys
from mathutils import Matrix, Quaternion, Vector

args = sys.argv[sys.argv.index(__file__) + 1:] if __file__ in sys.argv else sys.argv[1:]
REST, GLB, OUT = args[:3]
POSES = dict(a.split('=', 1) for a in args[3:])
data = open(GLB, 'rb').read()
gltf = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
nodes = gltf['nodes']; joints = gltf['skins'][0]['joints']
joint_names = {nodes[j]['name'] for j in joints}
parent_of = {nodes[c]['name']: n['name'] for n in nodes for c in n.get('children', [])}


def rest_trs(name):
    n = next(n for n in nodes if n['name'] == name)
    t, r = n.get('translation', (0, 0, 0)), n.get('rotation', (0, 0, 0, 1))
    return Matrix.Translation(Vector(t)) @ Quaternion((r[3], r[0], r[1], r[2])).to_matrix().to_4x4()


def mats(path):
    bpy.ops.wm.open_mainfile(filepath=path, load_ui=False)
    rig = bpy.data.objects['rig']; rig.data.pose_position = 'POSE'
    bpy.context.view_layer.update()
    ev = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return {pb.name: pb.matrix.copy() for pb in ev.pose.bones if pb.name in joint_names}


rest = mats(REST)
rest_local = {n: rest[parent_of[n]].inverted() @ rest[n] for n in joint_names if parent_of.get(n) in joint_names}
worst = max((m.to_translation() - rest_trs(n).to_translation()).length for n, m in rest_local.items())
assert worst < 1e-4, f'joint frames differ from the GLB ({worst})'
out = {'rest': {}}
for pose, path in POSES.items():
    cur = mats(path); bones = {}
    for name in sorted(joint_names):
        parent = parent_of.get(name)
        if parent in joint_names:
            local = cur[parent].inverted() @ cur[name]; ref = rest_local[name]
        else:
            ref = rest_trs(name); local = ref @ (rest[name].inverted() @ cur[name])
        t, q, _ = local.decompose(); t0, q0, _ = ref.decompose()
        if (t - t0).length < 1e-5 and q.rotation_difference(q0).angle < 1e-4:
            continue
        bones[name] = {'t': [round(x, 6) for x in t], 'r': [round(x, 6) for x in (q.x, q.y, q.z, q.w)]}
    out[pose] = bones
    print(pose, len(bones), 'joints moved')
json.dump(out, open(OUT, 'w'), indent=1)
