# Kritzelclash

Spiel 3 im Hub: Einer malt, alle anderen raten. 2–8 Freunde, live.

## Dateien

| Datei | Zweck |
|---|---|
| `kritzelclash/index.html` | Das Spiel: Menü, Raum, Leinwand, Werkzeuge, Rate-Chat, Ergebnis, Übungsblatt |
| `kritzelclash/woerter.js` | 752 Begriffe (leicht/mittel/schwer, inkl. Redewendungen), Rate-Prüfung, „knapp daneben“, Hinweis-Buchstaben |
| `kritzelclash/woerter.test.js` | Prüft die Wortliste: `node kritzelclash/woerter.test.js` |

## Ablauf

1. **Neue Partie** öffnet einen Raum. Freunde über die Liste einladen (erscheint bei ihnen im Spiel und im Hub) oder Link/WhatsApp schicken.
2. Der Gastgeber stellt **Runden** (2/3/4) und **Zeit zum Malen** (60/**90**/120 s) ein und startet ab 2 Spielern.
3. Reihum: Der Zeichner wählt aus 3 Begriffen (15 s), malt (90 s), danach Auflösung (6 s).
4. Rater tippen in den Chat. Treffer zählt automatisch (Groß/klein, Umlaute und Satzzeichen egal).
5. Nach 50 % und 75 % der Zeit wird je ein Buchstabe aufgedeckt (höchstens die Hälfte).
6. Ein Tipp mit 1 Tippfehler (bei langen Wörtern 2) bekommt den Hinweis **„knapp daneben“** – nur der Rater sieht ihn.
7. Wer es erraten hat, schreibt nur noch für die, die es auch wissen (🤫), damit nichts verraten wird.

## Punkte & Münzen

| | |
|---|---|
| Rater | 50 + bis zu 250 je nach Restzeit, +50 für den Ersten |
| Zeichner | 60 je Treffer |
| Hub-Punkte | eigene Punkte / 10 |
| Münzen | Sieger 5 🪙, alle anderen 1 🪙 |

Werte stehen in `PUNKTE` und `MUENZEN` oben im Skript.

## Zeichner-Ansicht (Handy)

Möglichst viel Platz: Leinwand randlos über die ganze Breite, keine Spielerleiste und kein Chat-Fenster. Die Tipps der anderen schweben als Sprechblasen unten auf der Leinwand. Werkzeuge in einer Zeile: Farbe (klappt auf), Stift, Radierer, Füllen, **Pinselgröße als Schieberegler** (2–60, mit Vorschau, wird gemerkt), Rückgängig, Alles löschen, Vollbild (wo das Handy es kann). Am großen Bildschirm steht der Chat rechts daneben.

## Technik

- Die Leinwand ist intern immer 1000 × 750 Punkte, damit alle Geräte dasselbe Bild haben.
- Striche werden in Stücken (~alle 150 ms) gespeichert: `partien/kritzelclash/liste/{id}/zuege/{zug}/striche`. Rückgängig löscht die Stücke des letzten Strichs, „Alles löschen“ erhöht `leinwand` im Raum.
- Der Begriff steht im Raum nur als Fingerabdruck (`wortHash`, SHA-256 mit Raum-Id), im Klartext erst nach der Auflösung (`aufloesung`).
- Das Gerät des Zeichners steuert seinen Zug (`takt()` alle 250 ms). Ist es weg, übernimmt nach 10 s Verspätung der erste andere Spieler. Phasenwechsel laufen per Transaktion, damit nichts doppelt passiert.
- Punkte werden mit `increment` verbucht, damit gleichzeitige Treffer sich nicht überschreiben.

## Gespeichert

| Wo | Was |
|---|---|
| `partien/kritzelclash/liste/{id}` | Raum/Partie (Spieler, Punkte, Phase) – wird nie automatisch gelöscht |
| `…/{id}/chat` | Tipps, Treffer, Emojis |
| `…/{id}/zuege/{zug}/striche` | die Bilder |
| `spielstand/kritzelclash/spieler/{uid}` | Punkte, Münzen, Siege, Partien, Erraten, Gemalt, Bestes Spiel |

## Typische Änderungen

- **Begriffe**: `WOERTER` in `woerter.js` (`[Begriff, Schwierigkeit 1–3]`), danach `node kritzelclash/woerter.test.js` (meldet doppelte Wörter).
- **Zeiten**: `WAHL_ZEIT`, `AUFLOESUNG_ZEIT` oben im Skript, Malzeit-Auswahl in der Raum-Ansicht (`[60,90,120]`), Standard in `raumAnlegen` (`zeit:90`).
- **Farben / Pinsel**: `FARBEN`, `DICKE_MIN`, `DICKE_MAX`, `DICKE_START`.

## Getestet am 22.11.2026

Echte Partie mit zwei Test-Spielern über die echte Datenbank: Einladung, Beitritt, beide haben gemalt und geraten, „knapp daneben“, Hinweise, Punkte, Ersatz-Spielleitung bei fehlendem Zeichner, Ergebnis, +5 🪙 gespeichert. Werkzeuge in Handygröße (375 px) geprüft. Testdaten danach gelöscht.
