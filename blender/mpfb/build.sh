#!/bin/sh
# Builds the fitted figure (MakeHuman skin + Rigify rig + Z-Anatomy skeleton) from the repo's data.
# Run from the repo root: sh blender/mpfb/build.sh [build-dir]. Needs the bpy module (Blender 5.x), numpy and scipy.
# cache/zskel.npz and cache/zjoints.json come from Z-Anatomy's Startup.blend (see README.md); they are rebuilt only
# when ZANATOMY points to it.
set -e
D=blender/mpfb
B=${1:-build/mpfb}
mkdir -p "$B"
py() { python3 -I "$@"; }
py $D/zexport.py blender/atmen-anatomy.blend $D/cache/zskin.npz
if [ -n "$ZANATOMY" ]; then
  py $D/zskel_export.py "$ZANATOMY" $D/cache/zskel.npz
  py $D/zjoints.py $D/cache/zskel.npz $D/cache/zjoints.json
fi
py $D/build_mh.py $D/data "$B/human.blend"
ZJ=$D/cache/zjoints.json py $D/fit_mh.py "$B/human.blend" "$B/posed.npy"
py $D/wrap_mh.py "$B/human.blend" "$B/posed.npy" $D/cache/zskin.npz "$B/wrapped.npy"
VERTS="$B/wrapped.npy" ROLLS="$B/posed_rolls.json" py $D/build_mh.py $D/data "$B/fitted.blend"
ASSIGN=$D/cache/bone-joints.json py $D/skel_attach.py "$B/fitted.blend" $D/cache/zskin.npz $D/cache/zskel.npz blender/anima-body.blend
F1="-0.15,0.1,1" N1="0.6,-1,-0.1" SPREAD=1.6 py $D/pose_mh.py blender/anima-body.blend "$B/vhand.blend" v
OSPEC="14,0.008,0.006,0,0.003" py $D/pose_mh.py blender/anima-body.blend "$B/mouth-o.blend" o
py $D/export_body.py blender/anima-body.blend "$B/anima-body.glb"
py $D/body_poses.py blender/anima-body.blend "$B/anima-body.glb" models/anima-body-poses.json vHand="$B/vhand.blend" mouthO="$B/mouth-o.blend"
echo "now: node blender/compress_figure.mjs $B/anima-body.glb models/anima-body.glb"
