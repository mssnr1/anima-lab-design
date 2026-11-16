"""The Z-Anatomy skin of the current figure (Head, Body_Shell, Arms, Legs) as triangles, the target the MPFB skin is
laid onto. python3 -I zexport.py blender/atmen-anatomy.blend cache/zskin.npz"""
import bpy  # noqa
import sys
import numpy as np

bpy.ops.wm.open_mainfile(filepath=sys.argv[-2], load_ui=False)
Vs, Fs, part, off = [], [], [], 0
for k, n in enumerate(['Head', 'Body_Shell', 'Arms', 'Legs']):
    o = bpy.data.objects[n]
    Vs.append(np.array([tuple(o.matrix_world @ v.co) for v in o.data.vertices]))
    for p in o.data.polygons:
        f = [i + off for i in p.vertices]
        Fs += [(f[0], f[i], f[i + 1]) for i in range(1, len(f) - 1)]
    part += [k] * len(o.data.vertices); off += len(o.data.vertices)
np.savez(sys.argv[-1], V=np.vstack(Vs), F=np.array(Fs), part=np.array(part))
print('ok', off, len(Fs))
