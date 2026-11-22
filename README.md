# Clash Club – Spiele-Hub

Die Spielhalle für dich und deine Freunde im Browser. Ein Charakter (Name, Avatar, Banner) gilt für alle Spiele, die Punkte aller Spiele zählen zusammen.

Erstes Spiel: **Brainclash** (Quiz-Duelle, Live-Duell, Party, Schätzfragen).

| | |
|---|---|
| Geplante Adresse | `https://ilordviper.github.io/spielehub/` |
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
| `brainclash/index.html` | Das Quiz (eine Datei, wie bisher) |
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

`Documents\spielehub-sicherungen\` enthält den Stand vor dem Hub (22.11.2026):
- `github-version\` – die damalige `index.html`, `README.md`, `firestore.rules` und das komplette Git-Repo als `brainclash-repo.bundle`
- `claude-version\` – die Brainclash-Fassung von claude.ai (Artifact, mit Claude-Anmeldung)

Außerdem liegt eine unveränderte Kopie des GitHub-Repos in `Documents\brainclash\`. Daran nichts ändern, sie dient als Spiegel der alten Adresse.
