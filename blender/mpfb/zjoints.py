"""Joint centres of the left arm, hand and leg from the Z-Anatomy bones (zskel.npz), so the rig pivots where the
bones meet. python3 -I zjoints.py zskel.npz out.json"""
import sys, json
import numpy as np
z = np.load(sys.argv[-2]); V, part = z['V'].astype(float), z['part']; names = [str(n) for n in z['names']]


def pts(n):
    return V[part == names.index(n + '.l')]


def end(n, toward, frac=0.12, medial=False):
    """Centre of the end of bone n that lies toward `toward` (a point)."""
    P = pts(n); c = P.mean(0)
    u = np.linalg.svd(P - c)[2][0]
    if np.dot(np.asarray(toward) - c, u) < 0:
        u = -u
    t = (P - c) @ u; L = t.max() - t.min()
    E = P[t > t.max() - frac * L]
    if medial:
        E = E[E[:, 0] < np.median(E[:, 0])]
    return E.mean(0)


up, down = (0, 0, 3), (0, 0, -3)
J = {}
sh = end('Humerus', up)
el = end('Humerus', down, 0.06)
wr = (pts('Lunate bone').mean(0) + pts('Scaphoid bone').mean(0)) / 2
fingers = {'f_index': 'second', 'f_middle': 'third', 'f_ring': 'fourth', 'f_pinky': 'fifth'}
mc = {'second': 'Second', 'third': 'Third', 'fourth': 'Fourth', 'fifth': 'Fifth'}
for key, f in fingers.items():
    meta = f'{mc[f]} metacarpal bone'
    mcp = end(meta, down, 0.1)
    prox, mid, dist = (f'{k} phalanx of {f} finger of hand' for k in ('Proximal', 'Middle', 'Distal'))
    pip = (end(prox, end(prox, mcp, 0.01) * 2 - mcp, 0.1))
    pip = end(prox, pts(mid).mean(0), 0.1)
    dip = end(mid, pts(dist).mean(0), 0.1)
    tip = end(dist, dip * 2 - pts(dist).mean(0) * 0 - dip + (pts(dist).mean(0) - dip) * 3, 0.08)
    J[key] = [mcp.tolist(), pip.tolist(), dip.tolist(), tip.tolist()]
cmc = end('First metacarpal bone', pts('Trapezium bone').mean(0), 0.1)
mcp1 = end('First metacarpal bone', pts('Proximal phalanx of first finger of hand').mean(0), 0.1)
ip = end('Proximal phalanx of first finger of hand', pts('Distal phalanx of first finger of hand').mean(0), 0.1)
d1 = pts('Distal phalanx of first finger of hand').mean(0)
tip1 = end('Distal phalanx of first finger of hand', d1 + (d1 - ip), 0.08)
J['thumb'] = [cmc.tolist(), mcp1.tolist(), ip.tolist(), tip1.tolist()]
J['arm'] = [sh.tolist(), el.tolist(), wr.tolist(), J['f_middle'][0]]
hip = end('Femur', up, 0.12, medial=True)
knee = end('Femur', down, 0.05)
ank = pts('Talus').mean(0)
ball = end('Second metatarsal bone', pts('Proximal phalanx of first finger of foot').mean(0), 0.1)
dt = pts('Distal phalanx of first finger of foot').mean(0)
toe = end('Distal phalanx of first finger of foot', dt + np.array([0, -1, 0]), 0.1)
J['leg'] = [hip.tolist(), knee.tolist(), ank.tolist(), ball.tolist(), toe.tolist()]
json.dump(J, open(sys.argv[-1], 'w'), indent=1)
for k, v in J.items():
    print(k, np.round(v, 3).tolist())
