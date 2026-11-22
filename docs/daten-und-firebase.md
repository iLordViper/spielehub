# Daten und Firebase

## Das Firebase-Projekt

- Projekt: **brainclash-7f1b0** ([Firebase-Konsole](https://console.firebase.google.com/))
- Tarif: kostenlos (Spark): 50.000 Lesezugriffe und 20.000 Schreibzugriffe pro Tag
- Anmeldung: **Anonym** muss unter Authentication → Anmeldemethoden aktiv bleiben
- Zugangsdaten für die Webseite stehen an **zwei** Stellen und müssen gleich sein:
  - `shared/firebase.js` → `HUB_FIREBASE_CONFIG`
  - `brainclash/index.html` → `FIREBASE_CONFIG_RAW`

Die Zugangsdaten sind für Webseiten öffentlich gedacht. Geschützt wird die Datenbank durch die Regeln in `firestore.rules`.

## Wer ist wer?

Jeder Browser bekommt von Firebase eine feste, zufällige Spieler-ID (`uid`). Sie hängt an der Adresse `ilordviper.github.io`. Deshalb haben der Hub, Brainclash im Hub und die alte Adresse `…/brainclash/` **dieselbe** uid und damit dasselbe Profil.

Wer Browserdaten löscht, im privaten Fenster spielt oder das Gerät wechselt, bekommt eine neue uid und startet neu.

## Was liegt wo?

| Sammlung | Inhalt | Wer schreibt |
|---|---|---|
| `profiles/{uid}` | Name, Avatar, Banner **und** alle Brainclash-Werte (`points`, `wins`, `losses`, `correct`, `answered`, `bestTower`, `bestMath`, `ach` …) | Hub (nur `name`, `avatar`, `banner`, `lastSeen`, `createdAt`, immer mit *merge*) und Brainclash (speichert das ganze Dokument) |
| `presence/{uid}` | `{uid, at}`: letztes Lebenszeichen, für „online“ | Hub und Brainclash, alle 30 Sekunden |
| `duels/…`, `duelchat/…` | Brainclash-Duelle und Chat | Brainclash |
| `live/…` | Brainclash Live-Duelle | Brainclash |
| `party/…` | Brainclash Party-Runden | Brainclash |
| `lobby/…` | Brainclash Lobby-Chat | Brainclash |
| `spielstand/{spiel}/spieler/{uid}` | Spielstände künftiger Spiele | das jeweilige Spiel (Regel noch auskommentiert, siehe [spiel-hinzufuegen.md](spiel-hinzufuegen.md)) |

## Im Browser gespeichert (localStorage)

| Schlüssel | Inhalt |
|---|---|
| `ka_profile` | Kopie des eigenen Profils (Hub und Brainclash teilen sie) |
| `ka_bot`, `ka_sound`, `ka_read` | Brainclash: Duelle gegen den Quizbot, Ton an/aus, gelesene Lobby-Nachrichten |
| `hub_demo_profile` | Nur Testmodus `?demo` – absichtlich getrennt von `ka_profile` |

## Regeln ändern

1. `firestore.rules` bearbeiten.
2. Firebase-Konsole → Firestore → **Regeln** → kompletten Inhalt einfügen → **Veröffentlichen**.
3. Die Datei hier im Ordner ist nur die Kopie. Wirksam ist erst, was in der Konsole veröffentlicht ist.
