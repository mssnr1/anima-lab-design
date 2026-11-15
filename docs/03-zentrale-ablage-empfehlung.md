# Wo die gemeinsame Basis liegt

Entschieden am 15.11.2026: öffentliches Repo **https://github.com/mssnr1/anima-lab-design**.

## Kurz
**Ein eigenes GitHub-Repo `mssnr1/anima-lab-design`**, öffentlich, als Paket, das jede App einbindet.
Auf dem Mac liegt es geklont unter `/Users/jan.meissner/Developer/anima-lab-design/`. Das ist dann der
"zentrale Ordner auf dem Rechner", den du dir gewünscht hast, nur mit GitHub als Quelle der Wahrheit.

## Warum nicht nur ein Ordner auf dem Mac
- Die Claude-Threads arbeiten in der Cloud. Sie sehen ein Repo auf GitHub, aber keinen Ordner auf deinem Mac
  (außer wenn der Mac gerade online und verbunden ist).
- Der Deploy auf GitHub Pages baut ebenfalls in der Cloud und muss die Dateien von GitHub holen.
- Ein Mac-Ordner hat keine Versionen. Mit Git kann jede App einen festen Stand nutzen und eine Änderung an
  der Figur für Mimo bricht nicht aus Versehen Fluo.

## Warum ein eigenes Repo und nicht alles in einem großen Repo
Ein großes Repo (Fluo, Mimo, Tono und Design zusammen) wäre technisch am einfachsten, hat aber Nachteile für dich:
- Fluo ist unter `mssnr1.github.io/atmen/` installiert. Ein Umzug würde die Adresse und die installierte App ändern.
- Pro Repo gibt es eine GitHub-Pages-Seite. Jede App mit eigenem Repo bekommt ihre eigene Adresse.
- Jedes Claude-Projekt (Fluo, Mimo, Tono) bekommt "sein" App-Repo plus das gemeinsame `anima-lab-design`.
  So bleibt jedes Projekt übersichtlich und kann trotzdem an der gemeinsamen Basis arbeiten.

## Warum öffentlich
- Die Apps holen das Paket beim Bauen direkt von GitHub. Bei einem öffentlichen Repo braucht es dafür keinen
  Schlüssel, bei einem privaten müsste man einen Token in jede App einrichten.
- Das 3D-Modell steht ohnehin unter CC BY-SA ("teilen unter gleichen Bedingungen").
- Fluo (`mssnr1/atmen`) ist auch öffentlich. Geheimnisse gehören in keines der Repos.

## Was drin ist

```
anima-lab-design/
  README.md, CLAUDE.md, LICENSE.md   Einstieg, Regeln für Claude, Lizenzen
  docs/                     diese Dokumente (01 bis 04)
  tokens/
    tokens.css              neutrale Tokens Tag/Nacht, Typo-Skala, Flächen (.anima-card, .anima-glass), Bewegung
    apps/fluo.css           Signaturlicht Fluo (light/light-2 = breath/breath-2), Aura, Fluo-Zeichen und Wortmarke
    apps/mimo.css           Signaturlicht Mimo (Vorschlag, noch offen)
    tokens.json             dieselben Werte für native Apps (z. B. die Apple-Watch-App), erzeugt von scripts/tokens-json.py
  src/
    components/             Button, IconButton, Segmented, Switch, BottomSheet, Page, MoodScale, Icons (ohne Fluo-Texte, alles über Props)
    figure/                 Linien-Shader (stripes.ts), Tiefen-Vorpass, Formen (Kopf schließen, Gesicht, Gliedmaßen, Beine, Lunge, Atemweg)
    engine/                 zeitbasierte Übungs-Engine
    lib/                    breathClock.ts (Rhythmus-Uhr), lungRings.ts, theme.ts (Tag/Nacht)
    brand/fluo/             Fluo-Zeichen und Wortmarke, als Vorbild für Mimo und Tono
  reference/fluo/           Fluos Zusammenbau der Figur 1:1 (Szene, Zeichenreihenfolge, Kamera, Bühne, Aura, Effekte,
                            Verlauf, Vollbild, komplettes index.css). Nicht kompiliert, zum Abschauen und Übernehmen.
  blender/                  build_anatomy.py, render_preview.py, atmen-anatomy.blend, preview.png, README mit Lizenz
  models/atmen-anatomy.glb  das Modell, das Fluo lädt
```

Warum der Zusammenbau nur als Referenz drin ist: In Fluo hängen Szene, Kamera und Bühne an Fluos Übungen, Texten und
Speicher. Mimo braucht ohnehin ein eigenes Modell (Gesicht) und eine eigene Kamera. Sobald Mimo seine Szene baut, ziehen wir
den gemeinsamen Teil davon ins Paket, dann gibt es ihn für Tono gleich mit.

## Wie eine App es nutzt (getestet mit einem Probe-Projekt)
- `package.json` der App: `"@anima-labs/design": "github:mssnr1/anima-lab-design#<commit>"`. Der Commit pinnt den Stand.
  (Git-Tags kann die Cloud-Umgebung zurzeit nicht pushen, darum Commits statt Versionsnummern.)
- CSS der App:
  ```css
  @import "tailwindcss";
  @import "@anima-labs/design/tokens/tokens.css";
  @import "@anima-labs/design/tokens/apps/mimo.css";
  @source "../node_modules/@anima-labs/design/src";
  ```
  Die `@source`-Zeile braucht Tailwind 4, damit es die Klassen der Komponenten findet.
- Code: `import { Button, MoodScale } from '@anima-labs/design/components'`,
  `import { stripeMaterial, STRIPE_PALETTES } from '@anima-labs/design/figure'`.
- Modell: `import modelUrl from '@anima-labs/design/models/atmen-anatomy.glb?url'`.
- Ein eigener Gesichts-Export für Mimo kommt ebenfalls nach `models/` (z. B. `face.glb`), damit Tono ihn auch hat.

## Reihenfolge
1. ✓ Repo angelegt (du), gefüllt (Claude): Tokens, Komponenten, Figur, Blender-Dateien, Doku, 41 Tests.
2. Mimo startet direkt auf `anima-lab-design`.
3. Später, in einer eigenen PR: Fluo stellt auf das Paket um. Sichtbar ändert sich nichts, Screenshots vorher und
   nachher werden verglichen. Danach gibt es nur noch eine Quelle.

## Noch offen
- Signaturlicht für Mimo (Vorschlag: Rosé und Pfirsich, siehe Dokument 01).
- Name Mimo: hohes Markenrisiko laut Rechte-Check, Alternativen Leno oder Glabo.
- Lizenz für den Code des Pakets (ohne Angabe darf niemand außer dir ihn verwenden; das Modell bleibt CC BY-SA).
