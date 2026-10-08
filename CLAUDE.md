# MoveMe

Offline-fähige PWA zum täglichen Abhaken von Joggen und Liegestützen. Läuft auf dem Google Pixel 10 Pro (Chrome, auf den Homescreen installiert). Sprache der App und der Kommunikation: Deutsch.

## Stack und Prinzipien
- Vanilla HTML/CSS/JS als ES-Module, **kein Framework, kein Build-Schritt**. Bewusst winzig und schnell halten.
- Daten: IndexedDB (`store.js`) mit In-Memory-Cache, Schreibzugriffe asynchron. Nur lokal auf dem Handy.
- Offline: Service Worker (`sw.js`), cache-first mit Hintergrund-Update.
- Hosting: GitHub Pages, https://s84n.github.io/MoveMe/ (Repo `s84n/MoveMe`, öffentlich, Branch `main`, Ordner `/`).

## Dateien
- `index.html` – App-Shell, Tab-Leiste (Tag, Woche, Statistik, Mehr), Inline-Skript gegen Theme-Flackern
- `style.css` – Theme-Variablen (hell, dunkel per System oder Schalter), Glas-Optik (backdrop-filter), Glanz-Verläufe auf erledigten Kacheln
- `app.js` – Ansichten, Navigation, Statistik/Streaks, Theme-Umschalter, Export/Import
- `store.js` – IndexedDB, Cache, JSON-Export/Import
- `activities.js` – **zentrale Aktivitäten-Konfiguration**: `id, name, icon, color, c2` (Farbverlauf), `type` (`check` | `count`), bei `count` `step` und `unit`, optional `minutes` + `kmPerUnit` (Strecken-Schätzung)
- `sw.js` – Service Worker; **bei jeder Änderung an den Dateien `CACHE` hochzählen** (aktuell `moveme-v2`), sonst sehen installierte Apps die neue Version spät
- `manifest.webmanifest`, `icons/` – PWA-Metadaten, Icons (192/512 PNG, SVG)

## Funktionen
- **Tag:** große Kacheln pro Aktivität. Joggen = Antippen togglet. Liegestütze = `−`/`+` in 5er-Schritten (erledigt, sobald Wert > 0). Wischen oder Pfeile wechseln den Tag, Nachtragen vergangener Tage möglich, Zukunft gesperrt.
- **Woche:** Mo–So Raster pro Aktivität, Antippen springt zum Tag, Wochen blättern.
- **Statistik:** Gesamtzähler oben (Joggen-Einheiten mit geschätzten km und Minuten, Liegestütze gesamt), je Aktivität aktuelle und beste Serie, Tage pro Woche/Monat/gesamt, Summen bei Zählwerten, geschätzte Monatsstrecke.
- **Mehr:** Darstellung (Auto/Hell/Dunkel, gespeichert in `localStorage` unter `moveme-theme`), Export/Import als JSON (`{app:'moveme', version:1, entries}`).

## Datenmodell
`entries`: Schlüssel `YYYY-MM-DD|activityId` → `{ done: bool, value?: number }`. Lokales Datum (nicht UTC), Wochenstart Montag. Einträge ohne `done` und `value` werden gelöscht.

## Festlegungen aus der Planung
- Ein Tag pro Bildschirm als Hauptansicht, dazu Wochenübersicht.
- Look: modern, Glas/Glanz, Dark Mode (Auto, Hell, Dunkel).
- Kilometer-Schätzung: Anfänger, langsames Tempo ca. 8 Min/km, 20 Min Joggen ≈ 2,5 km pro Einheit (`kmPerUnit` in `activities.js` anpassbar).
- Neue Registerkarten/Aktivitäten kommen als Eintrag in `activities.js`. Ein Eintrag mit anderem `type` oder Auswertung braucht Anpassung in `app.js`.
- Datenschutz: keine Cloud, kein Tracking. Backup nur per JSON-Export.

## Git und Deployment
- Remote `origin`: `git@github.com:s84n/MoveMe.git` über Deploy Key `~/.ssh/moveme_deploy` (nur dieses Repo, Schreibrecht). Im Repo gesetzt via `core.sshCommand`.
- Commit-Identität nur lokal im Repo: `s84n <189661563+s84n@users.noreply.github.com>`. **Keine private E-Mail in Commits.**
- Deploy: `git push` auf `main`, GitHub Pages baut automatisch (ca. 1–2 Min). Danach Version in der installierten App prüfen (erst beim 2. Start aktuell).

## Test
- Lokal: `python3 -m http.server 8080`, dann `http://localhost:8080` (Chrome Device-Modus, Pixel-Größe).
- Offline: DevTools → Offline, neu laden, abhaken, neu laden → Daten bleiben.
- Export, Daten löschen, Import → Daten wieder da.
- Streaks mit Lücken sowie Wochen- und Monatswechsel prüfen.

## Offene Ideen
- Erinnerungen (Benachrichtigungen), Widgets, weitere Registerkarten (z. B. Wasser, Schlaf), Cloud-Sync.
