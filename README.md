# Clash Club – Spiele-Hub

Die Spielhalle für dich und deine Freunde im Browser. Ein Charakter (Name, Avatar, Banner) gilt für alle Spiele, die Punkte aller Spiele zählen zusammen.

Spiele:
1. **Brainclash** – Quiz-Duelle, Live-Duell, Party, Schätzfragen
2. **Würfelclash** – Würfeln nach Original-Kniffel-Regeln mit 3D-Würfeln, Live-Duell, Bot, Chat ([Doku](docs/wuerfelclash.md))

Hauptprofil über alle Spiele: Level, Hub-Punkte, **Münzen 🪙** (Sieg 5, sonst 1 – nur Duelle gegen Freunde) und **Erfolge**.

| | |
|---|---|
| Adresse (live seit 22.11.2026) | `https://ilordviper.github.io/spielehub/` |
| GitHub-Repo | `https://github.com/iLordViper/spielehub` (öffentlich, Pages: `main` / root) |
| Brainclash im Hub | `https://ilordviper.github.io/spielehub/brainclash/` |
| Alte Brainclash-Adresse | `https://ilordviper.github.io/brainclash/` – läuft unverändert weiter |
| Datenbank | Firebase-Projekt `brainclash-7f1b0` (dieselbe wie bisher) |
| Anmeldung | keine – Firebase meldet jeden Browser unsichtbar und anonym an |

## Ordner und Dateien

| Pfad | Zweck |
|---|---|
| `index.html` | Die Hub-Startseite: Spiele, Rangliste, Profil, Avatar-Editor |
| `shared/theme.css` | Gemeinsames Design (Farben, Schriften, Knöpfe, Spielerkarte) |
| `shared/core.js` | Gemeinsame Hilfsfunktionen, Level-Formel, Avatar-Zeichner |
| `shared/firebase.js` | Firebase-Zugangsdaten, anonyme Anmeldung, Online-Anzeige |
| `shared/games.js` | **Liste aller Spiele** – hier kommt jedes neue Spiel rein |
| `shared/erfolge.js` | Hub-Erfolge (aus allen Spielen berechnet) |
| `brainclash/index.html` | Das Quiz (eine Datei, wie bisher) |
| `wuerfelclash/` | Das Würfelspiel: `index.html`, `regeln.js` (+ Test), `sounds/` |
| `tools/datensicherung.mjs` | Sichert alle Spielerdaten aus der Datenbank als JSON auf diesen PC |
| `tools/handy-vorschau.html` | Seite in Handygröße ansehen (`…/tools/handy-vorschau.html?seite=wuerfelclash/?demo`) |
| `firestore.rules` | Sicherheitsregeln der Datenbank (Kopie dessen, was in Firebase eingestellt ist) |
| `tools/lokal-testen.js` | Kleiner Webserver zum Testen auf dem PC |
| `docs/` | Anleitungen (siehe unten) |
| `CHANGELOG.md` | Was wann geändert wurde |

## Anleitungen

- [Ein neues Spiel hinzufügen](docs/spiel-hinzufuegen.md)
- [Daten und Firebase: was wo gespeichert ist](docs/daten-und-firebase.md)
- [Veröffentlichen auf GitHub Pages](docs/veroeffentlichen.md)

## Lokal testen

```powershell
node tools/lokal-testen.js
```

Dann `http://localhost:8080/?demo` öffnen. **`?demo` ist wichtig:** Der Hub läuft dann ohne Datenbank mit Beispielspielern, und nichts landet bei deinen Freunden. Brainclash selbst hat keinen Testmodus und benutzt auch lokal immer die echte Datenbank.

## Sicherungen

**Spielerdaten aus der Datenbank sichern** (liest nur, ändert nichts):

```powershell
node tools/datensicherung.mjs
```

Legt `Documents\spielehub-sicherungen\daten-<Datum_Uhrzeit>\` mit einer JSON-Datei je Sammlung an. Vor größeren Updates ausführen. Bei neuen Spielen die Liste `SPIELE` im Werkzeug ergänzen.

Weitere Sicherungen:

`Documents\spielehub-sicherungen\` enthält den Stand vor dem Hub (22.11.2026):
- `github-version\` – die damalige `index.html`, `README.md`, `firestore.rules` und das komplette Git-Repo als `brainclash-repo.bundle`
- `claude-version\` – die Brainclash-Fassung von claude.ai (Artifact, mit Claude-Anmeldung)

Außerdem liegt eine unveränderte Kopie des GitHub-Repos in `Documents\brainclash\`. Daran nichts ändern, sie dient als Spiegel der alten Adresse.
