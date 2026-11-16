# Fitted body: MakeHuman skin, Rigify rig, Z-Anatomy skeleton

Builds `models/anima-body.glb` (+ poses) and `blender/anima-body.blend`. German overview with what moves and what
is still open: `docs/02-3d-figur-und-shading.md`, section 11. Run from the repo root:

```bash
sh blender/mpfb/build.sh build/mpfb            # about a minute; needs bpy (Blender 5.x), numpy, scipy
node blender/compress_figure.mjs build/mpfb/anima-body.glb models/anima-body.glb
ZANATOMY=Z-Anatomy/Startup.blend sh blender/mpfb/build.sh build/mpfb   # also re-extract the skeleton
```

| Step | Script | What it does |
| --- | --- | --- |
| 1 | `zexport.py` | Z-Anatomy skin of the current figure (`blender/atmen-anatomy.blend`) → `cache/zskin.npz` |
| 2 | `zskel_export.py` | Z-Anatomy bones from `Startup.blend`: world space, arm bones turned like `build_anatomy.relax_arms` turns the arm skin, decimated → `cache/zskel.npz` |
| 3 | `zjoints.py` | Joint centres measured on those bones (shoulder, elbow, wrist, finger joints, hip, knee, ankle) → `cache/zjoints.json` |
| 4 | `build_mh.py` | MakeHuman base mesh + MPFB's Rigify metarig (bone strategies, rolls, helper-bone constraints) → Rigify → skin weights; eyes, teeth, tongue from the base mesh helpers |
| 5 | `fit_mh.py` | Poses the MakeHuman arms and fingers onto the Z-Anatomy joints, saves the posed vertices, landmark pairs and bone rolls |
| 6 | `wrap_mh.py` | Thin-plate warp landmark to landmark, then trunk and limbs pressed onto the Z-Anatomy skin (face and hands keep their own shape) |
| 7 | `build_mh.py` again | The rig rebuilt on the fitted vertices (`VERTS`, `ROLLS`), so its rest pose is the Z-Anatomy pose |
| 8 | `skel_attach.py` | Bones moved by the skin's own displacement field (Z skin → fitted skin), each bone rigidly on one deform joint (`cache/bone-joints.json`) |
| 9 | `pose_mh.py` | Test poses (V-hand, mouth O) on the Rigify controls |
| 10 | `export_body.py`, `body_poses.py` | GLB (deform joints only, licence in `asset.copyright`) and the pose JSON |

## Data and licences

`data/` holds MakeHuman/MPFB asset files, **CC0 1.0** (`data/LICENSE-CC0.md`), from
<https://github.com/makehumancommunity/mpfb2> (`src/mpfb/data/`, commit 9de0707):
`3dobjs/base.obj` (gzipped), `mesh_metadata/basemesh_vertex_groups.json`, `rigs/rigify/rig.human_toes.json`,
`rigs/rigify/weights.human_toes.json` (gzipped). MPFB's add-on code (GPLv3) is not used or copied; these scripts
only read the data.

`cache/zskel.npz` is derived from Z-Anatomy (CC BY-SA 4.0, BodyParts3D CC BY-SA 2.1 JP). The ear ossicles are left
out (they sit with the NC-licensed inner ear of the template), as are the label meshes and the sinus air spaces.
