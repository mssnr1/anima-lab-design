"""Lays the posed MPFB skin onto the Z-Anatomy figure: a thin-plate warp landmark to landmark (joints from fit_mh.py,
nose, chin, head and mouth), then trunk and limbs are pressed onto the Z-Anatomy skin while face and hands keep
MakeHuman's own shape. python3 -I wrap_mh.py human.blend posed.npy zskin.npz out.npy"""
import bpy  # noqa
import sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from scipy.spatial import cKDTree

blend, posed, zfile, out = sys.argv[-4:]
bpy.ops.wm.open_mainfile(filepath=blend, load_ui=False)
body = bpy.data.objects['Body']
NB = 13380
V = np.load(posed)
lm = np.load(posed.replace('.npy', '_lm.npy'))
faces = [list(p.vertices) for p in body.data.polygons]
z = np.load(zfile)
ZV, ZF, part = z['V'], z['F'], z['part']
keep = ~((part[ZF[:, 0]] == 3) & (np.abs(ZV[ZF[:, 0], 0]) > 0.33))
ZF = ZF[keep]
head = ZV[part == 0]

# --- face landmarks ---
def z_mid(lo, hi, key):
    m = (np.abs(head[:, 0]) < 0.004) & (head[:, 2] > lo) & (head[:, 2] < hi)
    p = head[m]
    return p[key(p)]
pairs = list(zip(lm[0], lm[1]))
# drop the trunk spine pairs except the head ones (the chains are defined differently)
pairs = pairs[6:8] + pairs[8:]
# nose tip
zn = z_mid(1.53, 1.60, lambda p: np.argmin(p[:, 1]))
vn = V[297]
pairs.append((vn, zn))
# head top, back of head
pairs.append((V[:NB][np.argmax(V[:NB, 2])], head[np.argmax(head[:, 2])]))
vb = V[:NB][(np.abs(V[:NB, 0]) < 0.004) & (np.abs(V[:NB, 2] - vn[2] - 0.04) < 0.01)]
zb = head[(np.abs(head[:, 0]) < 0.004) & (np.abs(head[:, 2] - zn[2] - 0.04) < 0.01)]
pairs.append((vb[np.argmax(vb[:, 1])], zb[np.argmax(zb[:, 1])]))
# chin prominence: most forward midline point a little above the chin's underside
pairs.append((V[491], z_mid(zn[2] - 0.11, zn[2] - 0.055, lambda p: np.argmin(p[:, 1]))))
# mouth: the deepest midline point between nose base and chin, on the Z-Anatomy lip seam
zs = z_mid(1.524, 1.534, lambda p: np.argmin(p[:, 1]))
P = V[:NB]
mm = (np.abs(P[:, 0]) < 0.004) & (P[:, 2] < V[5342][2]) & (P[:, 2] > V[491][2]) & (P[:, 1] < V[5342][1] + 0.02)
cand = P[mm]
pairs.append((cand[np.argmax(cand[:, 1])], zs))
src = np.array([p[0] for p in pairs]); dst = np.array([p[1] for p in pairs])
print('pairs', len(src))

# --- thin plate (biharmonic 3D) RBF ---
def rbf(src, dst, X, reg=1e-5):
    n = len(src)
    K = np.linalg.norm(src[:, None] - src[None], axis=2)
    Pm = np.hstack([np.ones((n, 1)), src])
    A = np.zeros((n + 4, n + 4)); A[:n, :n] = K + reg * np.eye(n); A[:n, n:] = Pm; A[n:, :n] = Pm.T
    b = np.zeros((n + 4, 3)); b[:n] = dst - src
    w = np.linalg.solve(A, b)
    out = X.copy()
    for s in range(0, len(X), 4000):
        x = X[s:s + 4000]
        Kx = np.linalg.norm(x[:, None] - src[None], axis=2)
        out[s:s + 4000] = x + Kx @ w[:n] + np.hstack([np.ones((len(x), 1)), x]) @ w[n:]
    return out
W1 = rbf(src, dst, V)
print('rbf done; landmark residual', np.abs(rbf(src, dst, src) - dst).max())

# --- projection onto the Z skin, displacements diffused over the MPFB surface ---
# drop faces near open edges of the Z pieces (shoulder rim of the shell, arm cuffs): projecting there makes flaps
from collections import Counter
ec = Counter(tuple(sorted(e)) for f in ZF for e in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])))
bnd = np.zeros(len(ZV), bool)
for (a, b), c in ec.items():
    if c == 1: bnd[a] = bnd[b] = True
for _ in range(3):
    hit = bnd[ZF].any(1); bnd[ZF[hit].ravel()] = True
ZF = ZF[~bnd[ZF].any(1)]
print('faces kept', len(ZF))
tree = BVHTree.FromPolygons([tuple(v) for v in ZV], [tuple(f) for f in ZF])
nbr = [set() for _ in range(NB)]
for f in faces:
    for a, b in zip(f, f[1:] + f[:1]):
        nbr[a].add(b); nbr[b].add(a)
nbr = [np.array(sorted(s)) for s in nbr]

def normals(X):
    N = np.zeros((NB, 3))
    for f in faces:
        p = X[f]
        n = np.cross(p[1] - p[0], p[2] - p[0])
        if len(f) == 4:
            n += np.cross(p[2] - p[0], p[3] - p[0])
        N[f] += n
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

# keep MPFB's own face and hands: projection only on trunk and limbs, faded in over the neck and wrists
keepw = np.zeros(NB)
gi = {g.index: g.name for g in body.vertex_groups}
def frozen(n):
    return n.startswith(('DEF-hand', 'DEF-f_', 'DEF-thumb', 'DEF-palm', 'DEF-spine.006', 'DEF-spine.005')) or not n.startswith(('DEF-spine', 'DEF-upper', 'DEF-fore', 'DEF-thigh', 'DEF-shin', 'DEF-foot', 'DEF-toe', 'DEF-pelvis', 'DEF-breast', 'DEF-shoulder'))
for v in body.data.vertices[:NB]:
    keepw[v.index] = sum(e.weight for e in v.groups if frozen(gi[e.group]))
mask = np.clip(1 - keepw, 0, 1)
X = W1[:NB].copy()
for _ in range(8):
    mask = 0.5 * mask + 0.5 * np.array([mask[n].mean() for n in nbr])
SMOOTH = int(__import__('os').environ.get('SMOOTH', '12'))
for it in range(4):
    N = normals(X)
    Dp = np.zeros((NB, 3)); ok = np.zeros(NB, bool)
    for i in range(NB):
        loc, nz, idx, dist = tree.find_nearest(Vector(X[i]), 0.02)
        if loc is None:
            continue
        if np.dot(N[i], np.array(nz)) > 0.8:
            Dp[i] = np.array(loc) - X[i]; ok[i] = True
    # diffuse into the unmatched vertices (mouth inside, eye sockets, nostrils)
    D = Dp.copy()
    for _ in range(150):
        avg = np.array([D[n].mean(0) if len(n) else D[i] for i, n in enumerate(nbr)])
        D = np.where(ok[:, None], Dp, avg)
    # smooth a little everywhere so neighbouring vertices don't fold
    for _ in range(SMOOTH):
        D = 0.5 * D + 0.5 * np.array([D[n].mean(0) for n in nbr])
    X = X + D * mask[:, None]
    print('iter', it, 'matched', ok.mean().round(3), 'mean move mm', (np.linalg.norm(D, axis=1).mean() * 1000).round(2))
final = W1.copy(); final[:NB] = X
# helpers (joint cubes, eyes, teeth, tongue) move with the mean displacement of the surrounding skin in the rest mesh
R = np.array([tuple(v.co) for v in body.data.vertices])
kd = cKDTree(R[:NB])
_, near = kd.query(R[NB:], k=16)
final[NB:] = R[NB:] + (X - R[:NB])[near].mean(1)
np.save(out, final)
loc_err = []
for i in range(0, NB, 7):
    loc, nz, idx, dist = tree.find_nearest(Vector(final[i]), 1.0)
    loc_err.append(dist)
print('distance to Z skin (mm): median', np.median(loc_err) * 1000, 'p95', np.percentile(loc_err, 95) * 1000)
