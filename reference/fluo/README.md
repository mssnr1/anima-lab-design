# Fluo's figure, as put together in the app

Verbatim copies from `mssnr1/atmen` at `2472d6d` (paths there in brackets). They import Fluo's own modules
(exercises, storage, i18n, guide, feedback) and are **not compiled here**. Read them to see how the shared pieces in
`src/figure/` are put together, and take what a new app needs.

| File | What to look at |
| --- | --- |
| `AnatomyModel.tsx` (`src/visualization/anatomy3d/`) | Loading the GLB, `PARTS` draw order, skin depth pre-pass, depth clear, lung edge map, morphs and `BREATH_GAIN`, skin brightness over a session |
| `Anatomy3DVisualization.tsx` | Canvas, camera framings (`start/idle/run/done`), `fitView`, orbit limits, camera tweens, rebuild after WebGL context loss, stand-in |
| `Stage.tsx`, `stage.ts`, `ambient.ts` (`src/stage/`) | One figure behind all screens, `useStage`, `useStageAhead`, the ambient breath |
| `breathState.ts` (`src/visualization/`) | Engine snapshot → lung volume and flow |
| `Aura.tsx` | Particle aura and its colours |
| `ImpactEffects.tsx`, `impacts.ts` | Effects lighting up in the body per insight card |
| `BreathSpecks.tsx`, `airflow3d.ts`, `airway-paths.json` | Air specks along the airways (Fluo only) |
| `materials.ts` | Old fresnel glass material, still used for hidden parts |
| `WeekRingsChart.tsx`, `weekRings.ts` | History as week rings |
| `FullscreenButton.tsx` | Fullscreen / "add to Home Screen" on iPhone |
| `theme.ts` | Fluo's theme hook reading its store (the shared one in `src/lib/theme.ts` takes the preference as an argument) |
| `index.css` | Fluo's full stylesheet, before it was split into `tokens/` |
