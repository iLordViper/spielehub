# Daten und Firebase

## Das Firebase-Projekt

- Projekt: **brainclash-7f1b0** ([Firebase-Konsole](https://console.firebase.google.com/))
- Tarif: kostenlos (Spark): 50.000 Lesezugriffe und 20.000 Schreibzugriffe pro Tag
- Anmeldung: **Anonym** muss unter Authentication → Anmeldemethoden aktiv bleiben
- Zugangsdaten für die Webseite stehen an **zwei** Stellen und müssen gleich sein:
  - `shared/firebase.js` → `HUB_FIREBASE_CONFIG` (Hub, Würfelclash und alle neuen Spiele)
  - `brainclash/index.html` → `FIREBASE_CONFIG_RAW`

Die Zugangsdaten sind für Webseiten öffentlich gedacht. Geschützt wird die Datenbank durch die Regeln in `firestore.rules`.

## Wer ist wer?

Jeder Browser bekommt von Firebase eine feste, zufällige Spieler-ID (`uid`). Sie hängt an der Adresse `ilordviper.github.io`. Deshalb haben der Hub, alle Spiele und die alte Adresse `…/brainclash/` **dieselbe** uid und damit dasselbe Profil.

Wer Browserdaten löscht, im privaten Fenster spielt oder das Gerät wechselt, bekommt eine neue uid und startet neu.

## Was liegt wo?

| Sammlung | Inhalt | Wer schreibt |
|---|---|---|
| `profiles/{uid}` | Name, Avatar, Banner **und** alle Brainclash-Werte (`points`, `wins`, `losses`, `muenzen` …) | Hub (nur `name`, `avatar`, `banner`, `lastSeen`, `createdAt`, mit *merge*) und Brainclash (ganzes Dokument) |
| `presence/{uid}` | `{uid, at}`: letztes Lebenszeichen, für „online“ | Hub und alle Spiele, alle 30 Sekunden |
| `duels/…`, `duelchat/…`, `live/…`, `party/…`, `lobby/…` | Brainclash | Brainclash |
| `spielstand/{spiel}/spieler/{uid}` | Spielstand je Spiel (z. B. Würfelclash: Punkte, Münzen, Siege, Rekord) | das jeweilige Spiel, nur der Spieler selbst |
| `partien/{spiel}/liste/{id}` | Live-Partien (z. B. Würfelclash-Duelle) | Mitspieler |
| `partien/{spiel}/liste/{id}/chat/{msg}` | Chat einer Partie | Mitspieler, nur unter eigenem Namen; nie gelöscht |
| `partien/{spiel}/liste/{id}/zuege/{zug}/striche/{s}` | Zeichenstriche (Kritzelclash) | Mitspieler (anlegen, löschen für Rückgängig) |
| `partien/{spiel}/liste/{id}/schuesse/{s}` | Schüsse mit Ballpfad (Puttclash, für die Geisterbälle) | Mitspieler, nur unter eigenem Namen |

## Hauptprofil: Level, Münzen, Erfolge

- **Hub-Punkte und Level**: Summe der Punkte aller Spiele (`totalPoints` in `shared/games.js`), Level-Formel wie in Brainclash.
- **Münzen 🪙**: Summe aus allen Spielen (`totalMuenzen`). Regel überall: nur Duelle gegen Freunde, Sieg 5, sonst 1. Brainclash speichert sie im Profil (`muenzen`), Würfelclash im Spielstand.
- **Erfolge**: `shared/erfolge.js`. Werden aus den gespeicherten Werten berechnet, nichts davon wird extra gespeichert. Deshalb gehen sie nie verloren und zählen rückwirkend.

## Im Browser gespeichert (localStorage)

| Schlüssel | Inhalt |
|---|---|
| `ka_profile` | Kopie des eigenen Profils (Hub und Brainclash teilen sie) |
| `ka_bot`, `ka_sound`, `ka_read` | Brainclash |
| `wc_stand`, `wc_lokal`, `wc_tipps`, `wc_ton` | Würfelclash: Statistik-Kopie, laufende lokale Partie, Einstellungen |
| `kc_stand`, `kc_dicke`, `kc_ton`, `kc_wort_*` | Kritzelclash: Statistik-Kopie, Pinselgröße, Ton, eigener Begriff (falls die Seite beim Malen neu lädt) |
| `pc_stand`, `pc_solo`, `pc_ton` | Puttclash: Statistik-Kopie, laufende Solo-Runde, Ton |
| `hub_demo_profile`, `wc_demo_*`, `kc_demo_*`, `pc_demo_*` | Nur Testmodus `?demo` – absichtlich getrennt |

## Regeln ändern

1. `firestore.rules` bearbeiten.
2. Firebase-Konsole → Firestore → **Regeln** → kompletten Inhalt einfügen → **Veröffentlichen**.
3. Die Datei hier im Ordner ist nur die Kopie. Wirksam ist erst, was in der Konsole veröffentlicht ist.
4. Die Konsole lädt nur, wenn das Chrome-Fenster sichtbar ist (nicht im Hintergrund).
