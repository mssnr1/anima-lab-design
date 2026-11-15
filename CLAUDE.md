# Anima Labs design: notes for Claude

- The owner is Jan. He writes German: reply in German. Docs in `docs/` are German, code and comments English.
- This repo is the **shared foundation** of the Anima Labs apps (Fluo `mssnr1/atmen`, Mimo, Tono). Read
  `docs/01-marke-und-designsystem.md` and `docs/02-3d-figur-und-shading.md` before changing anything visual.
- Apps pin this repo by commit. A change here reaches an app only when the app moves its pin, so changes can be
  made safely, but keep exports backward compatible or update every app that uses them.
- Colour roles: controls neutral (`solid`, `ink`), each app's signature light only in `tokens/apps/<app>.css`
  (`--color-light`, `--color-light-2`), mint `effect` and red `alert` mean the same in every app.
- Components take all text and actions through props: no i18n, routing or storage imports in `src/`.
- `reference/fluo/` is a read-only snapshot, not compiled. When an app needs one of those pieces, generalise it
  into `src/` with tests instead of copying it.
- The 3D model is CC BY-SA 4.0: keep `asset.copyright` in every exported GLB (`src/figure/model.test.ts` checks it)
  and the credit in `LICENSE.md`. Never use NC-licensed parts of the Z-Anatomy template.
- After changing `tokens/*.css`, run `python3 scripts/tokens-json.py`.
- Before a PR: `npm test` and `npm run typecheck`.
