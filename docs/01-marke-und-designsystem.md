# Anima Labs: Marke und Designsystem

Stand 15.11.2026. Abgeleitet aus Fluo, so wie es live ist (Repo `mssnr1/atmen`, Commit `2472d6d`).
Alle Pfade sind relativ zum Repo. Feste Links auf genau diesen Stand:
`https://github.com/mssnr1/atmen/blob/2472d6d9c972536ed4bad0fd67dda308efab627b/<pfad>`

---

## 1. Die Marke

**Anima Labs** ist der Absender einer kleinen Familie von Apps, die eines gemeinsam haben:
*sich besser fühlen, besser aussehen, etwas für die Gesundheit tun.* Die Apps lassen sich einzeln
nutzen und gemeinsam als Paket freischalten.

| App | Thema | Status |
| --- | --- | --- |
| **Fluo** | Atmen | live: https://mssnr1.github.io/atmen/ |
| **Mimo** | Gesichtsyoga, Gesichtsgymnastik | startet jetzt |
| **Tono** | 10 Minuten Ganzkörper-Dehnen gegen Verspannung und Antriebslosigkeit | geplant |

### Namensregel
Lateinische Wurzel, zwei Silben, endet auf **-o**, kurz und ein bisschen niedlich (Fluo, Mimo, Tono).
Abgelehnt: Vulto (klingt nach Auto); als Firmenname Vivere, Viva Collective, Aevum (zu lateinisch).

> Achtung Rechte: Der Check vom 11.11. ([rechte-check-2026-11-11.md](../breath-app/marken/rechte-check-2026-11-11.md))
> bewertet **Mimo** und **Tono** mit hohem Risiko (große "Mimo"-Coding-App, US-Marke TONO im Gesundheitsbereich),
> Anima Labs und Fluo mit mittlerem. Für das Gesichtsyoga waren Leno und Glabo als Alternativen im Gespräch.
> Vor einem Store-Release bitte per TMview oder Anwalt prüfen.

### Die Idee, die alle Apps tragen
Fluo hat das Prinzip **"Licht ist Atem"**: ein dunkler Raum, ein Material (feine Lichtlinien), ein Rhythmus.
Für Anima Labs wird daraus:

> **Licht zeigt, was in dir passiert.**
> Jede App zeigt eine ruhige Figur aus feinen Lichtlinien. Leuchten darf nur, was die Übung gerade bewegt:
> in Fluo die Lunge, in Mimo die Gesichtsmuskeln, in Tono die gedehnten Muskelketten.

Daraus folgen die gemeinsamen Regeln:
1. **Ein Raum.** Die Figur steht auf einer Bühne hinter allen Screens. Ein Wechsel zwischen Start und Übung
   ist eine Kamerafahrt, keine neue Seite.
2. **Ein Material.** Körper als Konturlinien, kein Fotorealismus, keine Texturen.
3. **Ein Rhythmus.** Alles, was sich von selbst bewegt, folgt einer Uhr (in Fluo 5,5 s ein, 5,5 s aus).
   Keine Animation läuft auf eigenem Timer.
4. **Farbe hat eine Rolle.** Bedienelemente sind neutral. Farbe gehört nur dem, was im Körper passiert.
5. **Nacht ist Standard.** Der Taglook ("Atlas") zeichnet die Figur wie Tinte auf Papier.

### Ton und Sprache
- Deutsch zuerst, Englisch als zweite Sprache (`src/i18n/messages.ts`). Wir duzen.
- Ruhig, kurz, freundlich. Kein Fitness-Druck, keine Ausrufezeichen-Euphorie.
- **Vorsichtige Gesundheitsformulierungen:** "kann helfen", "viele empfinden", nie Heilversprechen,
  keine Diagnosen. Bei akuter Not ein klarer Hinweis auf 112 (Fluo: `src/screens/EmergencyScreen.tsx`).
- Stimmung vorher und nachher auf derselben Skala (1 sehr angespannt bis 5 sehr ruhig), nichts wird gemessen.

---

## 2. Farben (Design-Tokens)

Quelle: `src/index.css` (Tailwind 4, `@theme`). Der Taglook ist der Standard im CSS, die Nacht liegt unter
`:root.dark` (die App setzt die Klasse `dark` auf `<html>`, `src/lib/theme.ts`).

### Neutrale Tokens (für alle Apps gleich)

| Token | Tag "Atlas" | Nacht | Rolle |
| --- | --- | --- | --- |
| `paper` | `#f4f5f3` | `#0b0f16` | Seitenhintergrund |
| `surface` | `#ebece8` | `#111722` | ruhige Karten |
| `surface-2` | `#e0e2dd` | `#19202e` | Segment-Hintergrund, Felder |
| `line` | `#d2d5ce` | `#272c3a` | Haarlinien |
| `ink` | `#1a1f33` | `#f1f0fa` | Text |
| `ink-2` | `#5a6078` | `#a9adc4` | Zweittext |
| `muted` | `#6c7287` | `#81869f` | leise Hinweise |
| `card` | `#fbfbf9` | `#131926` | Sheets |
| `thumb` | `#ffffff` | `#f1f0fa` | Knopf im Schalter |
| `solid` | `#1a1f33` | `#f1f0fa` | gefüllte Buttons, gewähltes Segment |
| `on-solid` | `#f4f5f3` | `#0b0f16` | Text darauf |
| `night` | `#0b0f16` | `#0b0f16` | Tinte der Nachtseite |
| `panel` | `rgb(244 245 243 / .72)` | `rgb(11 15 22 / .6)` | Schleier unter schwebenden Controls |
| `alert` | `#d93f38` | `#ff6b63` | nur akute Hilfe |
| `effect` | `#17805f` | `#a7f3d0` (Mint) | eine Wirkung im Körper |

### Signaturlicht pro App (Vorschlag)
In Fluo heißen die Farben `breath` und `breath-2`. Für die Familie schlage ich vor, sie neutral
`light` und `light-2` zu nennen und jeder App ein eigenes Paar zu geben. Neutrale Tokens, Schrift und
Komponenten bleiben gleich, so erkennt man die Familie und trotzdem jede App.

| App | `light` (oben) | `light-2` (unten) | Tag `light` / `light-2` | Status |
| --- | --- | --- | --- | --- |
| Fluo | Lavendel `#c7bbff` | Himmel `#7dd3fc` | `#6f5cf0` / `#4f7fd9` | live |
| Mimo | z. B. Rosé `#ffc2d6` | Pfirsich `#ffd8b0` | dunklere Töne für Tag | **Vorschlag, offen** |
| Tono | z. B. Bernstein | Koralle | | **Vorschlag, offen** |

Mint (`effect`) und Rot (`alert`) behalten in allen Apps dieselbe Bedeutung und werden nie Signaturlicht.

### Aura (nur Nacht, um die Figur)
`--aura-cool #1c2350`, `--aura-warm #6f5cf0`, `--aura-rose #9a8cff`, `--aura-glow #7dd3fc`,
`--aura-spark #e6f6ff` (Taglook-Farben in `src/visualization/anatomy3d/Aura.tsx`). Pro App mit dem
Signaturlicht einfärben.

### Figur-Paletten
Die Farben der 3D-Figur stehen nicht im CSS, sondern in `STRIPE_PALETTES`
(`src/visualization/anatomy3d/stripes.ts`), siehe Dokument 02.

### Historie der Farben (damit niemand alte Werte ausgräbt)
Indigo `#9A8CFF` und "Magic Purple" als Akzent, Inter und Nunito als Schrift und die Lavendel-Pille `.bg-fluo`
gehören zu älteren Ständen (PR #49, #98, #99). Seit der neuen Version (PR #110, 11.11.) gilt nur, was hier steht.
Die alte Version liegt auf dem Branch `backup/vor-alt-version`.

---

## 3. Schrift

- **Figtree Variable** (`@fontsource-variable/figtree` 5.3.0, Lizenz SIL OFL), Fallback Inter, dann System.
- **Headlines** (`.display`): Gewicht 300 (light), Laufweite −0,015 em, Zeilenhöhe 1,08, `text-wrap: balance`.
  Seitentitel 34 px (2,125 rem), ab Tablet 48 px.
- **Eyebrow** (`.eyebrow`): 13 px, Gewicht 500, Großbuchstaben, Laufweite 0,14 em, Farbe `ink-2`.
- **Phasenwort** (`.phase-word`): light, klein geschrieben, Laufweite 0,16 em.

| Stufe | Größe | Wofür |
| --- | --- | --- |
| `text-fine` | 13 px | Bildunterschriften, Tags. Nichts ist kleiner. |
| `text-note` | 15 px | Zweitzeilen |
| `text-body` | 17 px | Fließtext, Listen, Buttons |
| `text-lead` | 19 px | eine führende Zeile |

Fließtext 400, Buttons und Labels 600 (semibold), Hervorhebungen 500.

---

## 4. Form, Abstand, Bewegung

- **Radien:** Buttons, Segmente, Icon-Buttons voll rund (`rounded-full`). Kleine Kacheln 18 px,
  Karten 22 px, Sheets oben 28 px.
- **Touch-Ziele:** Buttons mindestens 56 px hoch, Icon-Buttons 44 px.
- **Icons:** 24er Raster, Linie 1,8 px, runde Enden (`src/components/icons.tsx`).
- **Ränder:** Seiten `px-6`; schwebende Controls `.safe-x` (12 px, ab Tablet 20 px, plus Notch).
  Safe-Areas: `.safe-area`, `.safe-top`, `.safe-bottom`.
- **Breakpoints:** Tailwind `md` (768 px) und `lg` (1024 px). Lesespalte `max-w-md`, breit bis `lg:max-w-6xl`.
- **Bewegung:** weich und langsam. Einblenden 900 ms (`.fade-in`, `.fade-up`), Hinweise mit leichtem
  Unschärfe-Einblenden 1400 ms (`.insight-in`), Sheet 320 ms. Controls, die sich beim Üben zurücknehmen:
  aus in 1400 ms, an in 900 ms (`.chrome`, `.chrome-off`). Kurve für Atem und Kamera: smootherstep
  (`breathCurve` in `src/lib/breathClock.ts`). `prefers-reduced-motion` schaltet Schmuckanimationen ab.
- **Atmen in der Oberfläche:** Die Atemuhr schreibt `--b` (0..1) auf Elemente, die mitatmen
  (`attachBreath`, `breathRef` in `src/lib/breathClock.ts`). So atmen Wortmarke und Zeichen mit der Figur.

---

## 5. UI-Komponenten

Alle in `src/components/`, React 19 + Tailwind 4, nur mit den Tokens oben gestylt. Sie sind
app-neutral und können so in das gemeinsame Paket.

| Komponente | Datei | Was sie ist |
| --- | --- | --- |
| `Button` | `Button.tsx` | `primary` (gefüllt `solid`), `secondary` (Haarlinie `ink/30`), `ghost`; 56 px, voll rund, 17 px semibold, Icon vorn oder hinten |
| `IconButton` | `Button.tsx` | 44 px rund, `aria-label` Pflicht, `pressed`-Zustand |
| `Segmented` | `Segmented.tsx` | Auswahl in einer Pille, gewählt = `solid` |
| `Switch` | `Switch.tsx` | Einstellungszeile mit iOS-Schalter, optional Zweitzeile und Info |
| `BottomSheet` | `BottomSheet.tsx` | iOS-Sheet von unten (Wischen, Escape, Tippen außerhalb), ab Tablet mittige Karte |
| `Page` | `Page.tsx` | Unterseite wie ein Blatt Papier über dem Raum: Zurück, Eyebrow, light Headline, Lead |
| `MoodScale` | `MoodScale.tsx` | "Wie fühlst du dich gerade?" 5 Gesichter, vorher und nachher |
| `WeekRingsChart` | `WeekRingsChart.tsx` | Verlauf als Wochenringe, antippbar, Zeitachse |
| `FullscreenButton` | `FullscreenButton.tsx` | Vollbild bzw. Anleitung "Zum Home-Bildschirm" auf dem iPhone |
| Icons | `icons.tsx` | Linien-Icons im gemeinsamen Stil |
| `Waveform` | `Waveform.tsx` | Rhythmuskurve mit wanderndem Punkt (Fluo-spezifischer Inhalt, Technik wiederverwendbar) |
| `BreathSign` | `BreathSign.tsx` | Fluo-Zeichen: Oval mit Lichtlinien, die sich von unten füllen. App-Icon und einfache Ansicht |
| `Wordmark` | `Wordmark.tsx` | Fluo-Wortmarke als Monoline, das o ist das Zeichen |
| `WelcomeArt` | `WelcomeArt.tsx` | Strichzeichnungen der Einführung (Fluo-Inhalt) |

**Flächen als CSS-Klassen** (in `src/index.css`):
- `.fluo-card`: ruhige Karte, `surface` mit Haarlinie, kein Verlauf, kein Glow. Radius 22 px.
- `.fluo-tile`: Glas über der Figur, `paper` 58 % mit 18 px Blur und Haarlinie `ink/12`. Radius 18 px.
- `.start-scrim`, `.veil-top`, `.veil-bottom`: Verläufe, damit Text über der Figur lesbar bleibt.
- `.breath-cue`: Text über der Figur mit weicher Wolke in Seitenfarbe dahinter.

Im gemeinsamen Paket schlage ich die Namen `.anima-card` und `.anima-glass` vor (Fluo kann Aliase behalten).

### Pro App neu zu machen
Wortmarke und Zeichen (Monoline wie bei Fluo: alle Buchstaben ein Strich in gleicher Stärke, ein Buchstabe
wird zum Zeichen der App), App-Icon, Signaturlicht, Inhalte (Übungen, Texte, Hinweiskarten).

---

## 6. Technik-Basis

React 19, TypeScript 7, Vite 8, Tailwind 4, vite-plugin-pwa (installierbar, offline), three.js 0.180 mit
React Three Fiber 9 und drei 10, Vitest. Kein Backend, Daten in `localStorage` (`src/storage/`).
Deploy: GitHub Actions auf GitHub Pages bei jedem Push auf `main` (`.github/workflows/deploy.yml`).
Tests laufen im Deploy mit. Für Screenshots der 3D-Figur in der Cloud gelten die Tricks aus der
Projekt-Erinnerung "breath-headless-screenshots" (Seitenuhr einfrieren, Build statt Dev-Server).
