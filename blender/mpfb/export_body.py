"""Export the fitted MPFB figure with its skeleton layer as GLB (deform bones only).
python3 -I export_body.py fitted_skel.blend out.glb"""
import bpy  # noqa
import sys
import bmesh

src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False)
COPYRIGHT = ("Skin, eyes, teeth, tongue and skeleton rig: MakeHuman / MPFB assets (CC0 1.0). "
             "Skeleton: Z-Anatomy (CC BY-SA 4.0), BodyParts3D, DBCLS (CC BY-SA 2.1 JP). "
             "Fitted together and rigged for Anima Labs, CC BY-SA 4.0")
for o in list(bpy.data.objects):
    if o.name == 'metarig':
        bpy.data.objects.remove(o)
body = bpy.data.objects['Body']
bm = bmesh.new(); bm.from_mesh(body.data)
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS'); bm.to_mesh(body.data); bm.free()
print('body verts', len(body.data.vertices), 'faces', len(body.data.polygons))
for p in body.data.polygons:
    p.use_smooth = True
COLORS = {'Body': (0.8, 0.7, 0.65, 1), 'Eyes': (0.9, 0.9, 0.9, 1), 'Teeth': (0.95, 0.93, 0.85, 1),
          'Tongue': (0.6, 0.3, 0.3, 1), 'Skeleton': (0.92, 0.88, 0.8, 1)}
for n, c in COLORS.items():
    o = bpy.data.objects[n]
    m = bpy.data.materials.new({'Body': 'Skin', 'Skeleton': 'Bone'}.get(n, n)); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = c
    o.data.materials.clear(); o.data.materials.append(m)
rig = bpy.data.objects['rig']
bpy.ops.object.select_all(action='DESELECT')
for n in ['rig'] + list(COLORS):
    bpy.data.objects[n].select_set(True)
bpy.context.view_layer.objects.active = rig
rig.data.pose_position = 'REST'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=False, export_morph=False,
                          export_materials='EXPORT', export_yup=True, export_texcoords=False, export_normals=True,
                          export_extras=True, export_skins=True, export_def_bones=True, export_animations=False,
                          export_rest_position_armature=True, export_attributes=True, export_copyright=COPYRIGHT)
print('exported')
