# Anima Labs design

The shared foundation of the Anima Labs apps: **Fluo** (breathing, live at https://mssnr1.github.io/atmen/),
**Mimo** (face yoga) and **Tono** (stretching). New apps build on this instead of starting from scratch.

| | What | Where |
| --- | --- | --- |
| Brand + design system | Idea, colours, type, shapes, motion, components, tone | [docs/01-marke-und-designsystem.md](docs/01-marke-und-designsystem.md) |
| 3D figure | Model, Blender pipeline, line shader, depth pre-pass, camera, licence | [docs/02-3d-figur-und-shading.md](docs/02-3d-figur-und-shading.md) |
| How apps use it | Repo layout, install, CSS, imports | [docs/03-zentrale-ablage-empfehlung.md](docs/03-zentrale-ablage-empfehlung.md) |
| Brief for new projects | Paste into a new app's project instructions | [docs/04-brief-fuer-neue-projekte.md](docs/04-brief-fuer-neue-projekte.md) |

The docs are in German (the team's language); code and comments are in English.

## Use in an app

```jsonc
// package.json
"@anima-labs/design": "github:mssnr1/anima-lab-design#<commit>"
```

```css
/* the app's CSS */
@import "tailwindcss";
@import "@anima-labs/design/tokens/tokens.css";
@import "@anima-labs/design/tokens/apps/<app>.css";
@source "../node_modules/@anima-labs/design/src";
```

```ts
import { Button, MoodScale, Page } from '@anima-labs/design/components'
import { stripeMaterial, makeStripeMaterials, skinDepthMaterial, STRIPE_PALETTES } from '@anima-labs/design/figure'
import { BreathingEngine } from '@anima-labs/design/engine'
import modelUrl from '@anima-labs/design/models/atmen-anatomy.glb?url'
```

The package ships TypeScript source; Vite compiles it with the app. Peer dependencies: React 19, three.js ≥ 0.180.

## Layout

```
tokens/          tokens.css (shared), apps/<app>.css (each app's signature light), tokens.json (native apps)
src/components/  UI components, text and actions only through props
src/figure/      line shader and the shapes worked out from the model at runtime
src/engine/      time-based exercise engine
src/lib/         rhythm clock, theme, lung rings
src/brand/fluo/  Fluo's sign and wordmark
reference/fluo/  how Fluo puts the figure together (scene, camera, stage, effects); not compiled
blender/         reproducible model build from Z-Anatomy
models/          the exported models: atmen-anatomy.glb (no skeleton), anima-figure.glb (rigged) + poses,
                 anima-body.glb (MakeHuman skin + Z-Anatomy skeleton on one rig) + poses
```

## Develop

```bash
npm install
npm test          # vitest
npm run typecheck
python3 scripts/tokens-json.py   # after changing tokens/*.css
```

Taken from Fluo (`mssnr1/atmen`) at commit `2472d6d` on 2026-11-15.

## Licence

See [LICENSE.md](LICENSE.md). The 3D model is CC BY-SA 4.0 and must be credited in every app that shows it.
