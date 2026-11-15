# Anima Labs: 3D-Figur, Shading und Pipeline (Inventar)

Stand 15.11.2026, Repo `mssnr1/atmen`, Commit `2472d6d`. Pfade relativ zum Repo.
Fester Link auf diesen Stand: `https://github.com/mssnr1/atmen/tree/2472d6d9c972536ed4bad0fd67dda308efab627b`
Auf Jans Mac liegt alles unter `/Users/jan.meissner/Developer/atmen/`.

**Wo es im gemeinsamen Repo `mssnr1/anima-lab-design` liegt:** Blender-Dateien unter `blender/`, das Modell unter
`models/atmen-anatomy.glb`, die Bausteine mit "ja" aus `src/visualization/anatomy3d/` unter `src/figure/`,
Rhythmus-Uhr und Theme unter `src/lib/`, Engine unter `src/engine/`. Fluos Zusammenbau (AnatomyModel, Kamera,
Bühne, Aura, Effekte, Luft) liegt unverändert unter `reference/fluo/`.

Spalte "Für alle": **ja** = gehört ins gemeinsame Paket, **teils** = Technik ja, Inhalt ist Fluo,
**Fluo** = bleibt in Fluo.

---

## 1. Überblick: wie die Figur entsteht

```
Z-Anatomy Startup.blend  (offener Anatomie-Atlas, CC BY-SA 4.0)
   │  blender/build_anatomy.py   (Blender 5.x als Python-Modul "bpy", ca. 4 Minuten)
   ▼
atmen-anatomy.blend  +  atmen-anatomy.glb  +  airway-paths.json
   │  npx @gltf-transform/cli meshopt   (NICHT "optimize", das verschmilzt die Meshes)
   ▼
public/models/atmen-anatomy.glb   (656 KB, ca. 105k Dreiecke)
   │  three.js / React Three Fiber
   ▼
Laufzeit: Formen vereinfachen (Lunge, Kopf, Beine, Atemweg), Konturlinien-Shader, Atem-Morphs, Kamera
```

Das Meiste vom Look passiert **zur Laufzeit im Browser**, nicht in Blender. Wer die Figur in einer neuen App
nutzt, braucht also beides: das GLB und die Shader- und Form-Dateien aus `src/visualization/anatomy3d/`.

---

## 2. Blender und Modell-Dateien

| Datei | Größe | Was | Für alle |
| --- | --- | --- | --- |
| `blender/build_anatomy.py` | 754 Zeilen | Baut alles aus Z-Anatomy: Hautregionen wählen (ohne Genital- und Analregion, Haare, Wimpern, Brauen), Arme hängend posen, aufräumen und vereinfachen, Materialien, Shape Keys, Export `.blend`/`.glb`/Atemwegspfade | ja (als Vorlage) |
| `blender/render_preview.py` | 73 Zeilen | Rendert ein Standbild in eingeatmeter Pose (Cycles) | ja |
| `blender/atmen-anatomy.blend` | 3,3 MB | Bearbeitbare Blender-Szene, Ergebnis des Builds | ja |
| `blender/preview.png` | 324 KB | Vorschau-Render | ja |
| `blender/README.md` | | Objekte, Shape Keys, Lizenz, Rebuild-Befehle | ja |
| `public/models/atmen-anatomy.glb` | 656 KB | Das Modell, das die App lädt (meshopt) | ja |
| `src/visualization/anatomy3d/airway-paths.json` | | Mittellinien Nase bis Lunge und Punkte in der Lunge (für Luft und Partikel) | Fluo |

**Objekte im Modell** (alle Kinder des Empty `Anatomy`, in Metern, Blender Z oben, glTF Y oben):

| Objekt | Flächen-Ziel im Build | Shape Key | Bemerkung |
| --- | --- | --- | --- |
| `Body_Shell` (Rumpf bis knapp unter Nabel) | 11 000 | `Inhale` | Brust füllt sich rundum, Schultern heben sich |
| `Head` | 7 000 | (zur Laufzeit `Calm`) | Löcher an Augen, Brauen, Lippen werden zur Laufzeit geschlossen |
| `Arms` | 6 000 | `Inhale` | hängend, Handflächen 70° gedreht |
| `Legs` | 7 000 | | übernimmt ab 0,975 m Höhe |
| `Lung_Left`, `Lung_Right` | je 4 500 | `Inhale` | |
| `Diaphragm` | 4 000 | `Inhale` | zurzeit ausgeblendet (`SHOW_DIAPHRAGM = false`) |
| `Heart` | 4 000 | `Beat` | ausgeblendet |
| `Nasal_Cavity`, `Trachea`, `Bronchi` | 2 500 / 1 800 / 3 000 | | zur Laufzeit durch eine erzeugte Fläche ersetzt |

In three.js: `mesh.morphTargetDictionary.Inhale` / `.Beat` / `.Calm`, gesetzt über `morphTargetInfluences` pro Frame.

### Rebuild (aus `blender/README.md`)
```bash
pip install bpy                       # Blender 5.x als Python-Modul (Python 3.13)
unzip Z-Anatomy.zip Z-Anatomy/Startup.blend
python -I blender/build_anatomy.py Z-Anatomy/Startup.blend build/
npx @gltf-transform/cli meshopt build/atmen-anatomy.glb public/models/atmen-anatomy.glb
cp build/airway-paths.json src/visualization/anatomy3d/
cp build/atmen-anatomy.blend blender/
python -I blender/render_preview.py blender/atmen-anatomy.blend blender/preview.png
```
Hinweise aus der Praxis: `Z-Anatomy.zip` kommt über raw.githubusercontent.com (github.com-Seiten sind aus der
Cloud gesperrt). Für Cycles-Vorschau in der Cloud `apt-get install libegl1` und Freestyle/Compositing der
Vorlage abschalten. `Startup.blend` ist groß und liegt **nicht** im Repo, also bei Bedarf neu holen.

---

## 3. Shading: der Konturlinien-Look

Herzstück ist **`src/visualization/anatomy3d/stripes.ts`** (336 Zeilen). Der Körper besteht nur aus feinen
Linien, die der Oberfläche folgen. Die Linien sind auf der Ruheform verankert, sie wandern also mit der
Haut, wenn sie atmet, statt über sie zu rutschen.

| Baustein | Wo | Was er macht | Für alle |
| --- | --- | --- | --- |
| `stripeMaterial(options)` | `stripes.ts` | Der Linien-Shader. Muster `around` (Linien laufen um die Körperachse) oder `level` (waagerechte Höhenlinien). Dichte, Linienbreite, Linien-/Füllfarbe, Rand-Glow (`rim`, `rimPower`), `focusTrunk` (Kontur trägt das Bild), `gradient` (Farbe nach Höhe), `glow` (additiv in der Nacht), `level` (Linien leuchten bis zu einer Höhe auf), `limb` (Linien um jeden Arm), `occlude`, `side`, `show` (Ausblenden), `pulse`, `rimEdge` (Tintenkontur am Tag) | **ja** |
| `skinDepthMaterial()` | `stripes.ts` | **Tiefen-Vorpass**: schreibt nur Tiefe, damit von der Haut nur die vorderste Fläche zu sehen ist, keine Rückwand und keine Falten | **ja** |
| `edgeDepthMaterial(id)` + Kantenkarte | `stripes.ts`, `AnatomyModel.tsx` (`EDGE_LAYER = 5`, `EDGE_RIM_PX = 18`) | Zeichnet eine Randlinie dort, wo eine Fläche vor einer anderen liegt (zwischen den Lungen) | ja |
| `STRIPE_PALETTES` | `stripes.ts` | Farben der Figur für Tag ("Atlas") und Nacht ("Tiefes Leuchten"), siehe unten | ja, pro App anpassen |
| `makeStripeMaterials(...)` | `stripes.ts` | Fertige Materialien: Haut (Dichte 120, Breite 0,06), Arme (Dichte 44), Lunge Rückwand + Vorderwand (Höhenlinien, `RING_DENSITY = 85` aus `src/lib/lungRings.ts`), Zwerchfell, Atemweg (Dichte 160) | teils |
| Hautverlauf | `stripes.ts` `SKIN_GRADIENT = (0.85, 1.45)` | Haut wechselt zwischen 0,85 m und 1,45 m Höhe zur Bauchfarbe (nur Linien und Kontur, nicht die Füllung) | ja |
| Zeichenreihenfolge | `AnatomyModel.tsx` `PARTS`, `SKIN_ORDER = 0.2` | Haut-Tiefe (0,1) → Haut-Farbe (0,2) → **Tiefe löschen** (0,5) → Lunge Rückwand (1) → Lunge (2) → Atemweg (2,2) → Zwerchfell (4). So bleibt das Innere im Körper sichtbar | **ja** (Prinzip) |
| Hautstärke über die Übung | `AnatomyModel.tsx` `REST_SKIN = {dark .42, light .86}`, `SKIN_TAU`, `SKIN_BOOST` | Nachts ist der Körper zuerst eine dunkle Kontur und gewinnt mit jedem Atemzug Licht | ja |
| Glas-Material (alt) | `materials.ts` | Fresnel-Glas, Rest des früheren Looks, nur noch als Grundlage für ausgeblendete Teile | nein |

**Figur-Paletten** (`STRIPE_PALETTES`):

| Feld | Tag | Nacht | Bedeutung |
| --- | --- | --- | --- |
| `body` | `#1a1f33` | `#8f86ff` | Hautlinien |
| `bodyFill` | `#ffffff` | `#3d3aa6` | Schein zwischen den Linien |
| `bodyBase` | `#fbfbf9` | `#0d1120` | Füllung der Haut (nah an der Seitenfarbe) |
| `bodyRim` | `#1a1f33` | `#b9adff` | Kontur |
| `bodyLow` | `#b4b8c6` | `#4aa6d6` | Linienfarbe Richtung Bauch |
| `lung` / `line` | `#6f5cf0` | `#b3a6ff` | Lunge oben |
| `lungLow` | `#4f7fd9` | `#7dd3fc` | Lunge unten |
| `lungRim` | `#1a1f33` | `#e3dcff` | Lungenkontur |
| `airway` | `#1a1f33` | `#b3a6ff` | Nase, Rachen, Luftröhre |

Für Mimo würden `lung*` zur Farbe der leuchtenden Muskeln (Signaturlicht), der Körper bleibt gleich.

---

## 4. Formen zur Laufzeit (aus dem Modell abgeleitet)

Alle in `src/visualization/anatomy3d/`. `shapes.ts` baut sie einmal pro Modell und hängt sie an die
Geometrie, damit ein neu aufgebauter Grafik-Kontext (iPhone verliert WebGL gern) sie sofort wiederfindet.
Die Arbeit läuft in Häppchen (`inTurns`), damit die Seite nicht hängt.

| Datei | Was | Für alle |
| --- | --- | --- |
| `shapes.ts` | Sammelstelle: `smoothLung`, `closedHead`, `limbAxis`, `legsShape`, `airwayFor`, Cache pro Modell | ja |
| `holes.ts` | Schließt Löcher im Kopf (Augen, Brauen, Lippen) mit Kappen, Augenhöhlen als flache Schalen, damit Linien durchlaufen | **ja** (wichtig für Mimo) |
| `face.ts` | Morph `Calm`: Lider schließen sich, Mundwinkel heben sich zu einem Lächeln, aus der eigenen Kopfhaut geformt | **ja**, Vorbild für Mimo-Gesichtsbewegungen |
| `limbs.ts` | Achse pro Arm und Bein, damit Linien rund um jede Gliedmaße laufen | ja (Tono) |
| `legShape.ts` | Beine aufgeräumt: ruhiger Sattel zwischen den Beinen, Fetzen und Nadellöcher weg | ja |
| `lungShape.ts` | Lunge als glatter, vereinfachter Körper (ruhige Linien), Atem-Morph neu berechnet | Fluo |
| `airwayShape.ts`, `airwayTree.ts` | Nase, Rachen, Luftröhre, Bronchien als eine erzeugte Fläche (0,3 s statt 18 s) | Fluo |
| `diaphragmShape.ts` | vereinfachtes Zwerchfell | Fluo |

---

## 5. Bühne, Kamera, Rhythmus

| Datei | Was | Für alle |
| --- | --- | --- |
| `src/stage/Stage.tsx`, `stage.ts` | Eine Figur hinter allen Screens. `useStage({source, framing, bottomInset, topInset, interactive})`, `useStageAhead()` macht sie verdeckt schon bereit | **ja** |
| `src/stage/ambient.ts` | Die ruhige Atmung der Figur außerhalb einer Übung | ja (Rhythmus pro App) |
| `src/lib/breathClock.ts` | Die eine Uhr (5,5 s ein, 5,5 s aus), `breathCurve` (smootherstep), `attachBreath` schreibt `--b` | **ja** |
| `src/visualization/anatomy3d/Anatomy3DVisualization.tsx` | Canvas, Kamera, `fitView` je Bildschirm, Framings `start / idle / run / done`, FOV 28°, Blick von vorn leicht von oben (6°, beim Üben 17°), Zoom- und Pan-Grenzen, weiche Fahrten (`TURN_S 3.4`, `RESET_S 2`), **Wiederaufbau nach WebGL-Kontextverlust** (bis 3× pro Minute) mit Platzhalter | **ja** (Framings pro App) |
| `src/visualization/anatomy3d/AnatomyModel.tsx` | Lädt das GLB, setzt Materialien und Reihenfolge, treibt Morphs (`BREATH_GAIN`: Rumpf und Arme 2,6, Lungen 1,7), Ausblenden nach der Übung | teils |
| `src/visualization/breathState.ts` | Übungszustand → Lungenvolumen und Luftstrom; alles liest nur, nichts treibt | Fluo (Muster ja) |
| `src/engine/` | Reine, zeitbasierte Übungs-Engine (keine UI) | **ja** (Mimo und Tono sind auch getaktete Übungen) |

## 6. Effekte

| Datei | Was | Für alle |
| --- | --- | --- |
| `Aura.tsx` | Partikel-Aura um die Figur (2 200 Partikel), baut sich über die Übung auf | ja, Farben pro App |
| `BreathSpecks.tsx` | 160 Lichtpunkte, die mit dem Atem durch die Nase in die Lunge ziehen | Fluo |
| `airflow3d.ts` | Wo die Luft gerade ist | Fluo |
| `ImpactEffects.tsx`, `impacts.ts` | Wirkung pro Hinweiskarte leuchtet im Körper auf (Gefäße, Herz, Gehirn...), 5 langsame Pulse | teils (Technik ja) |
| `heartbeat.ts` | Herzschlag-Kurve | ja |

---

## 7. Was Mimo zusätzlich braucht

Die Figur ist auf Atmen gebaut. Für Gesichtsyoga reicht sie so nicht:
- **Der Kopf ist grob** (7 000 Flächen für den ganzen Kopf). Für Mimo braucht es einen eigenen Export:
  Kopf und Hals in höherer Auflösung, Kamera nah am Gesicht.
- **Gesichtsmuskeln:** Z-Anatomy enthält die mimische Muskulatur (z. B. Ringmuskel des Auges, Jochbeinmuskel,
  Stirnmuskel) unter derselben Lizenz (in `Startup.blend` beim ersten Build nachsehen, welche Muskeln genau
  dabei sind). Ein `build_face.py` nach dem Muster von `build_anatomy.py` kann sie
  auswählen, vereinfachen und als eigene Objekte exportieren, die wie in Fluo die Lunge als Signaturlicht leuchten.
- **Bewegungen** als Shape Keys pro Übung (Stirn glätten, Wangen heben, Kiefer lockern) oder zur Laufzeit wie
  `face.ts` (`Calm`). `holes.ts` bleibt nötig.
- Linien-Shader, Tiefen-Vorpass, Bühne, Kamera-Logik, Uhr und Engine können unverändert mit.

---

## 8. Lizenz (bitte in jede App mitnehmen)

- **Z-Anatomy – The libre 3D atlas of anatomy**, CC BY-SA 4.0, https://github.com/Z-Anatomy/Models-of-human-anatomy
- abgeleitet aus **BodyParts3D, © The Database Center for Life Science**, CC BY-SA 2.1 Japan,
  https://dbarchive.biosciencedbc.jp/en/bodyparts3d/
- Das angepasste Modell (`.blend`, `.glb`, `airway-paths.json`) steht unter **CC BY-SA 4.0**. Wer es weitergibt,
  auch verändert, muss die Nennung behalten und unter derselben Lizenz teilen. **Der App-Code ist davon nicht
  betroffen.**
- Pflicht-Nennung (steht in Fluo unter Einstellungen → Quellen und Lizenzen, `src/screens/SettingsScreen.tsx`):
  > Anatomy adapted from "Z-Anatomy – The libre 3D atlas of anatomy" (CC BY-SA 4.0) and "BodyParts3D,
  > © The Database Center for Life Science" (CC BY-SA 2.1 Japan). Changes: selection, simplification,
  > materials, breathing shape keys.
- Das GLB trägt den Hinweis in `asset.copyright`; `model.test.ts` prüft das.
- Nicht verwenden: die NC-lizenzierten Teile der Vorlage (Innenohr, Niere), die Gehirnmodelle der University
  of Washington, Wikipedia-Texte, Schriften und Bilder aus der Vorlage. Der Build entfernt sie.
- Schrift Figtree: SIL Open Font License.

---

## 9. Gesichtsmuskeln (Fayo/Mimo), Stand 15.11.2026

`src/figure/faceMuscles.ts` legt eine **Karte der mimischen Muskulatur** über Kopf und Hals, vereinfacht wie
die Lunge in Fluo: ruhige, rund geformte Bereiche statt anatomischer Einzelteile.

- **Keine eigenen Meshes:** Jeder Punkt der Haut gehört genau zu einem Bereich (dem mit dem nächsten Kern),
  die Bereiche decken also die ganze Fläche lückenlos ab. Die Grenzen werden pro Pixel im Shader aus der
  Ruheform berechnet, deshalb sind sie glatt, egal wie grob das Mesh ist, und wandern mit der Haut mit.
- **Bereiche** (`FACE_AREAS`, paarige als `…Left`/`…Right`, links = +x der Figur): Stirn (`frontalis`),
  Zornesfalte (`corrugator`), Nase (`nasalis`), Mund (`orbicularisOris`), Kinn (`mentalis`), Auge
  (`orbicularisOculi`), Oberlippe (`levatorLabii`), Jochbein (`zygomaticus`), Wange (`buccinator`),
  Mundwinkel (`depressor`), Kiefer (`masseter`), Schläfe (`temporalis`), Halsseite (`sternocleidomastoid`),
  Hals (`platysma`); dazu die neutralen Flächen Kopf (`scalp`) und Körper (`body`).
- **Linien:** In jedem Bereich laufen feine Linien in Faserrichtung (Ringe um Auge und Mund, senkrecht auf der
  Stirn, schräg am Jochbein, Fächer an der Schläfe), überall mit demselben Abstand (`FIBRE_SPACING` 2,6 mm).
  Jeder Bereich hat eine eigene Kontur knapp innerhalb seiner Grenze, an Dreier-Ecken abgerundet. Kopfhaut
  und Körper behalten exakt die Körperlinien (`around`, Dichte 120), Rumpf, Arme und Beine laufen nahtlos weiter.
- **Material:** `faceMuscleMaterial({ palette, dark, activation })` statt `skin` auf `Head` und `Body_Shell`
  (mit demselben Tiefen-Vorpass). Farben `FACE_PALETTES` = Figur + Mimo-Signaturlicht (Rosé oben, Pfirsich unten).
- **Animation:** `muscleHead(head)` (in `shapes.ts`) schließt den Kopf, teilt ihn viermal feiner (`subdivide.ts`)
  und hängt pro beweglichem Bereich einen Morph an (nach `Calm`). `faceMuscleRig(activation, [head, headDepth])`
  mit `rig.set('zygomaticusLeft', 0..1)` lässt den Bereich leuchten und bewegt ihn.
- **Vorschau:** `npm run preview:face`, Parameter `theme=dark`, `view=front|side|both`, `act=frontalis:1,…`, `demo`.

Offen: Die Wange nach innen (`buccinator`) zeigt kleine Risse, weil dort der Rumpf (`Body_Shell`) bis über den
Kiefer reicht; ein eigener Kopf-Hals-Export (siehe Abschnitt 7) löst das. Am Mundspalt bleibt ein kleiner Punkt.

**Tag-Look (überarbeitet):** Ruhende Muskelbereiche zeigen am Tag nur feine graue Konturen, keine Faserlinien. Erst ein
arbeitender Bereich bekommt Faserlinien und eine zarte Fläche im Signaturlicht. Der Nachtlook bleibt unverändert.

**Gesichtsübungen:** `src/engine/faceExercise.ts` beschreibt eine Übung als getaktete Schritte (`intro`, `steps` ×
`repetitions`, `outro`). Jeder Schritt sagt, wie stark welche Bereiche am Ende arbeiten, und `facePose(übung, ms)`
liefert die Pose zu jedem Zeitpunkt (Werte direkt in `rig.set`). Ein erster Entwurf „Brauen-Lift“ liegt in
`preview/exercises.ts` (Vorschau: `?exercise=brow`, fester Zeitpunkt mit `&t=10000`).
