# Kurz-Brief zum Einfügen in neue Anima-Labs-Projekte

Diesen Block in die Projekt-Anweisungen eines neuen Projekts kopieren (z. B. Mimo). Was in eckigen Klammern
steht, pro App anpassen.

---

Ich bin Jan. Antworte auf Deutsch. Ich kann keine PRs mergen: Wenn ich "live" sage, merge und deploye selbst.
Fertige Arbeit darf direkt live gehen, Vorschauen nur bei größeren Design-Änderungen.

**Marke:** Diese App gehört zu **Anima Labs**, einer App-Familie zum Thema "sich besser fühlen, besser aussehen,
etwas für die Gesundheit tun": Fluo (Atmen, live: https://mssnr1.github.io/atmen/), Mimo (Gesichtsyoga),
Tono (10 Minuten Dehnen). App-Namen: lateinische Wurzel, zwei Silben, Endung -o. Diese App: **[Mimo, Gesichtsyoga]**.

**Nichts neu erfinden, was es schon gibt.** Designsystem, UI-Komponenten, 3D-Figur, Shading, Kamera, Bühne und
Übungs-Engine kommen aus Fluo bzw. dem gemeinsamen Repo **`mssnr1/anima-lab-design`** (Paket `@anima-labs/design`, Einbindung siehe
`docs/03-zentrale-ablage-empfehlung.md`). Lies dort vor der ersten Arbeit `CLAUDE.md` und:
- Marke und Designsystem: `docs/01-marke-und-designsystem.md`
- 3D-Figur, Shading, Blender-Pipeline, Lizenz: `docs/02-3d-figur-und-shading.md`
Fluos fertiger Zusammenbau der Figur (Szene, Kamera, Bühne) liegt dort unter `reference/fluo/` zum Übernehmen.

**Gestaltungsregeln:**
- "Licht zeigt, was in dir passiert": eine Figur aus feinen Konturlinien auf einer Bühne hinter allen Screens.
  Leuchten darf nur, was die Übung bewegt, in dieser App **[die Gesichtsmuskeln]**.
- Bedienelemente neutral (`solid`/`ink`), Farbe nur für das Signaturlicht der App **[Mimo: Vorschlag Rosé/Pfirsich,
  noch offen]**. Mint = Wirkung, Rot = akute Hilfe, in allen Apps gleich.
- Nacht ist Standard, Taglook "Atlas" (Tinte auf Papier). Schrift Figtree, Headlines light. Typo-Skala
  fine 13 / note 15 / body 17 / lead 19 px, nichts kleiner als 13 px.
- Ein Rhythmus: alles, was sich von selbst bewegt, folgt einer Uhr. Bewegungen weich und langsam.
- Ton: du, ruhig, kurz. Gesundheit nur vorsichtig formulieren ("kann helfen"), keine Heilversprechen.

**Technik:** React 19, TypeScript, Vite, Tailwind 4, PWA, three.js mit React Three Fiber, Vitest, kein Backend,
Deploy über GitHub Actions auf GitHub Pages. Repo dieser App: **[mssnr1/mimo]**.

**3D-Lizenz:** Das Modell stammt aus Z-Anatomy (CC BY-SA 4.0) und BodyParts3D (CC BY-SA 2.1 JP). Die Nennung muss
in die App (Einstellungen → Quellen und Lizenzen) und in `asset.copyright` des GLB. NC-lizenzierte Teile der
Vorlage nie verwenden.

**Gemeinsame Basis ändern:** Wenn diese App etwas an Tokens, Komponenten oder Figur braucht, die Änderung im
Repo `anima-lab-design` machen (eigene PR), nicht in der App kopieren, damit Fluo und Tono sie auch bekommen.
