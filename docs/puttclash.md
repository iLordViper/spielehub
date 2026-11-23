# Puttclash

Spiel 4 im Hub: Minigolf von oben. 6 Plätze à 6 Bahnen (36 Bahnen), solo oder mit 2–8 Freunden **reihum wie auf dem echten Platz** – jeder Schlag ist bei allen live zu sehen.

## Dateien

| Datei | Zweck |
|---|---|
| `puttclash/FORMAT.md` | **Bauplan**: Bahnformat und Schnittstellen zwischen den Dateien. Wer daran etwas ändert, passt alle Teile an. |
| `puttclash/index.html` | Das Spiel: Menü, Solo, Raum, Steuerung, Live-Sync, Chat, Scorekarte, Wertung |
| `puttclash/physik.js` | Ballphysik (`PHYSIK.schuss`, `besterSchuss` für den Bot), rein rechnerisch, auf allen Geräten gleich |
| `puttclash/physik.test.js` | 101 Prüfungen: `node puttclash/physik.test.js` |
| `puttclash/bahnen.js` | Die 36 Bahnen (`BAHNEN.PLAETZE`, `bahn(id)`, `alle()`) |
| `puttclash/bahnen.test.js` | ~2500 Prüfungen inkl. Lösbarkeit: `node puttclash/bahnen.test.js` |
| `puttclash/grafik.js` | Zeichnen (`GRAFIK.kamera`, `zeichne`, `effekt`), Themen je Platz, alles prozedural |
| `puttclash/grafik-vorschau.html` | Vorschau aller Bahnen mit Effekt-Knöpfen (`…/puttclash/grafik-vorschau.html`) |

## Plätze

| Platz | Par | Besonderheiten |
|---|---|---|
| 🌳 Sonnenpark | 16 | leicht: Kurven, Pfosten, Hügel, eine langsame Mühle |
| 🏜️ Wüstenoase | 19 | Sandbunker, Oase mit Wasser, Querhänge, pendelnde Blöcke, Tor |
| 🏴‍☠️ Piratenbucht | 19 | viel Wasser, Planken und Stege, Schiffsrumpf, Kisten, Fallgitter, Kanone (Teleporter), Totenkopf-Bucht |
| ❄️ Eispalast | 21 | fast alles Eis (sehr glatt), Bandenspiel, Eislöcher, Bumper, Mühlen |
| 🌋 Vulkan | 22 | Lava, Asche, Hänge bergauf, Geysire (Boost), Glutbrocken, Magmakammer mit Mühlen, Gipfelsturm |
| 🚀 Weltraum | 22 | Abgründe ins All, Teleporter, Boosts, Bumper, Schleusentore, Doppelmühlen |

## Steuerung & Regeln

- Irgendwo aufs Feld tippen, **zurückziehen**, loslassen – wie eine Schleuder. Je weiter, desto fester (200 px = volle Kraft).
- Wasser, Lava, Abgrund: **+1 Strafschlag**, der Ball kommt zurück zum letzten Abschlag.
- Höchstens **Par + 4** Schläge je Bahn, danach ist die Bahn für dich beendet.
- Querformat: Das Feld dreht sich automatisch (Loch rechts). Die Kamera zoomt auf die Bahn, damit der Ball am Handy groß genug ist.

## Mit Freunden

1. **Mit Freunden** öffnet einen Raum. Einladen über die Liste (erscheint bei ihnen im Spiel und im Hub), Link oder WhatsApp.
2. Gastgeber wählt den Platz und startet ab 2 Spielern.
3. **Reihum wie auf dem echten Platz:** ein Schlag, dann ist der Nächste dran. Wer im Loch ist, wird übersprungen. Auf Bahn 1 gilt die Reihenfolge im Raum, danach beginnt, wer auf der letzten Bahn die wenigsten Schläge hatte.
4. Wer dran ist, bekommt Ton + Vibration und „Du bist dran! · 32 s“, seine Spielerkarte leuchtet bei allen. **40 Sekunden** pro Schlag, sonst ist der Nächste dran; wer 3× hintereinander verpasst, bekommt für die Bahn die Höchstzahl.
5. Jeder Schuss wird als Pfad gespeichert, alle anderen sehen den Ball live rollen.
6. Sind alle im Loch: 5 Sekunden Scorekarte, dann nächste Bahn. Die Spielleitung übernimmt das Gerät des Gastgebers (ist er weg, der nächste Spieler).
7. Chat im Warteraum und im Spiel (Zeile unten, 💬 für den Verlauf), Sprechblasen 3 Sekunden über dem Spieler, Emojis fliegen über den Bildschirm.

## Punkte & Münzen

| | |
|---|---|
| Je Bahn | Hole-in-One 100, Albatros 80, Eagle 60, Birdie 40, Par 25, Bogey 12, Doppel-Bogey 6, schlechter 3 |
| Hub-Punkte | Summe / 3 |
| Münzen | nur mit Freunden: Sieger 5 🪙, alle anderen 1 🪙 |
| Sieger | wenigste Schläge gesamt (Gleichstand = Unentschieden) |

Zeiten: `ZUG_ZEIT` (40 s), `VERPASST_MAX` (3), `ZWISCHENSTAND_MS` (5 s). Werte stehen in `BAHNPUNKTE`, `ASS_PUNKTE`, `MUENZEN` oben im Skript. Hub-Erfolge: „Hole-in-One!“ und „Weltreise“ (alle 6 Plätze).

## Gespeichert

| Wo | Was |
|---|---|
| `partien/puttclash/liste/{id}` | Raum: Spieler, Platz, aktuelle Bahn, `schlaege`, `fertig`, `pos` (Ballposition), `dran`, `reihe`, `zugStart`, `geschossen`, `verpasst`, `lochStart` |
| `…/{id}/schuesse` | jeder Schuss (gekürzter Pfad, Ende, versenkt) |
| `…/{id}/chat` | Chat |
| `spielstand/puttclash/spieler/{uid}` | Punkte, Münzen, Siege, Runden, Hole-in-Ones, Bahnen, Bestrunde je Platz, durchgespielte Plätze |
| Browser `pc_solo` | laufende Solo-Runde (nach jedem Schuss) |

## So fügst du eine Bahn hinzu

1. In `bahnen.js` im passenden Platz einen Eintrag nach `FORMAT.md` anlegen (`id` = `<platz>-<nr>`). Die Helfer `BAHNEN.helfer` (rund, bogen, band …) sparen Tipparbeit.
2. `node puttclash/bahnen.test.js` – prüft Form, Abstände und ob es einen Weg zum Loch gibt.
3. Mit dem Bot testen, ob sie wirklich spielbar ist und welches Par passt (`PHYSIK.besterSchuss` in einer Schleife ab `ergebnis.ende`, mehrere Startzeiten wegen bewegter Hindernisse).
4. In `grafik-vorschau.html` ansehen.

Ein Platz hat im Spiel immer 6 Bahnen (Anzeige „Bahn x/6“).

## Abstimmung (22.11.2026)

Ein Bot mit menschlicher Streuung (Winkel ±1,5°, Kraft ±5 %) hat alle Bahnen gespielt. Nachgebessert: Finale „Ereignishorizont“ (Geländer, breitere Brücke, kleineres Schwarzes Loch – vorher jede zweite Runde Höchstzahl), „Pinguin-Pinball“ Par 3 → 4.

Piratenbucht und Vulkan (12 Bahnen) am selben Tag ergänzt: Bot schafft alle, mit Streuung Piratenbucht 18,0 bei Par 19, Vulkan 21,9 bei Par 22.

## Getestet am 23.11.2026

Im Browser: alle 6 Themen, hochkant (375 px) und quer, Schuss mit Hole-in-One, Solo fortsetzen. Live mit zwei Test-Spielern über die echte Datenbank: komplette Runde Sonnenpark reihum, Zugzeit-Ablauf, Neuladen mitten im Spiel, Ergebnis, Münzen, Hub-Punkte, Erfolg. Testdaten danach gelöscht.
