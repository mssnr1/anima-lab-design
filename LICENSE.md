# Licences

## 3D model (`models/`, `blender/atmen-anatomy.blend`, `blender/anima-figure.blend`, `blender/preview.png`)

Licensed under **CC BY-SA 4.0**. Anyone who redistributes it, changed or not, must keep this credit and share it
under CC BY-SA 4.0:

> Anatomy adapted from "Z-Anatomy – The libre 3D atlas of anatomy" (CC BY-SA 4.0)
> and "BodyParts3D, © The Database Center for Life Science" (CC BY-SA 2.1 Japan).
> Changes: selection, simplification, materials, breathing shape keys; for `anima-figure` also a skeleton (rig,
> skin weights), lips cut apart and a mouth interior.

- Z-Anatomy: https://github.com/Z-Anatomy/Models-of-human-anatomy
- BodyParts3D: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/

Every app that shows the figure shows this credit (Fluo: Settings → Sources and licences). Details and what must
not be used from the Z-Anatomy template: [blender/README.md](blender/README.md).

## Fitted body (`models/anima-body.glb`, `models/anima-body-poses.json`, `blender/anima-body.blend`, `blender/mpfb/`)

The skin, eyes, teeth, tongue, the Rigify rig and its skin weights come from **MakeHuman / MPFB** assets, released
under **CC0 1.0** (https://github.com/makehumancommunity/mpfb2, `LICENSE.ASSETS.md`, copied to
`blender/mpfb/data/LICENSE-CC0.md`). Only those data files are used; MPFB's add-on code (GPLv3) is not.
The skeleton inside is Z-Anatomy / BodyParts3D geometry, so the combined model is shared under **CC BY-SA 4.0**
with the credit above, plus:

> Skin, eyes, teeth, tongue and rig: MakeHuman / MPFB assets (CC0 1.0). Changes: fitted to the Z-Anatomy figure,
> skeleton from Z-Anatomy placed inside and attached to the rig.

## Font

Figtree, SIL Open Font License 1.1 (installed from npm, `@fontsource-variable/figtree`).

## Code

© mssnr1. No open-source licence has been chosen yet: the code is public to read, but not licensed for
reuse by others. The ShareAlike terms of the model do not extend to the code.
