# Würfelclash

Spiel 2 im Hub. Würfeln nach den **Original-Kniffel-Regeln** (der Name „Kniffel“ ist eine geschützte Marke, deshalb heißt das Spiel Würfelclash und das Feld für 5 gleiche „Fünferpasch“).

## Dateien

| Datei | Zweck |
|---|---|
| `wuerfelclash/index.html` | Das Spiel: Menü, 3D-Würfel, Spielzettel, Chat, alle Modi |
| `wuerfelclash/regeln.js` | Regeln, Wertung und der Tipp-Berater (auch vom Würfelbot benutzt) |
| `wuerfelclash/regeln.test.js` | Prüft die Regeln: `node wuerfelclash/regeln.test.js` |
| `wuerfelclash/sounds/*.wav` | Echte Würfelgeräusche (Kenney „Casino Audio“, CC0 – Lizenz liegt daneben) |

## Modi

| Modus | Gegen | Hub-Punkte | Münzen |
|---|---|---|---|
| ⚡ Live-Duell | einen Freund, live über die Datenbank | Endstand/5 + 50 bei Sieg (+20 bei Remis) | Sieg 5 🪙, sonst 1 🪙 |
| 🤖 Würfelbot | den Computer | Endstand/5 + 25 bei Sieg | keine |
| 🛋️ Am Tisch | 2–4 Leute an einem Gerät | keine | keine |
| 🎯 Solo | Rekord | Endstand/5 | keine |

Münzen gibt es überall im Hub nur für Duelle gegen Freunde (auch in Brainclash).

## Live-Duell: so läuft es

1. **Herausfordern**: Freund aus der Liste wählen oder einen Link verschicken. Es entsteht eine Partie mit Status `warten`.
2. Der Freund sieht die Herausforderung in Würfelclash **und** auf der Hub-Startseite (mit „Annehmen“) – oder öffnet den Link (`…/wuerfelclash/#tisch-<id>`).
3. Beim Annehmen tritt er per Transaktion bei → Status `laeuft`. Der Herausforderer beginnt.
4. Jeder Wurf, jeder gehaltene Würfel und jede Chatnachricht ist beim anderen sofort zu sehen.
5. Wer die Seite schließt, kann später über „Laufende Partien“ weiterspielen. Nichts geht verloren.
6. Aufgeben zählt als Niederlage. Spielt der Gegner über 10 Minuten nicht, kann man ohne Wertung beenden.

## Spielzettel

Unten liegt ein Papierzettel wie beim echten Block: gedruckte Zeilen, eine Spalte pro Spieler. Eingetragen wird in blauer Kuli-Handschrift (Schrift „Caveat“), die Vorschau beim Spieler am Zug steht in Bleistift. Einmal tippen markiert die Zeile (gelber Marker), nochmal tippen trägt ein.

## Tipps vom Berater

`tipp()` in `regeln.js` erkennt Kombinationen („Große Straße! 40 Punkte“), schlägt Würfel zum Halten vor (gestrichelt markiert) und setzt einen ⭐ an das beste Feld. Abschaltbar im Menü oder im Spiel (💡).

## Chat

💬 oben im Spiel öffnet das Chat-Fenster. Jede Nachricht erscheint außerdem 3 Sekunden als Sprechblase unter dem Charakterbild (`BLASE_MS`). Gegen den Würfelbot antwortet der Bot mit Sprüchen (`BOT_SAGT`).

## Gespeichert

| Wo | Was |
|---|---|
| `spielstand/wuerfelclash/spieler/{uid}` | Punkte, Münzen, Siege, Niederlagen, Rekord, Fünferpäsche, gezählte Partien |
| `partien/wuerfelclash/liste/{id}` | jede Live-Partie (wird nie automatisch gelöscht) |
| `partien/wuerfelclash/liste/{id}/chat` | Chatnachrichten dieser Partie |
| Browser `wc_stand`, `wc_lokal` | Kopie der Statistik, laufende Bot-/Tisch-/Solo-Partie |

Jede Partie wird nur einmal gezählt (Liste `gezaehlt`, wird nie gekürzt).

## Typische Änderungen

- **Punktwerte / Bonus**: `WERT` und `BONUS_GRENZE` in `regeln.js`, dann `node wuerfelclash/regeln.test.js`.
- **Amerikanische Zusatzregel** (zweiter Fünferpasch +50, Joker): `EXTRA_REGEL=true` in `regeln.js`.
- **Hub-Punkte / Münzen**: `PUNKTE` und `MUENZEN` oben im Skript von `index.html`.
- **Bot-Sprüche**: `BOT_SAGT` in `index.html`.
- **Neue Würfelsounds**: WAV-Datei nach `sounds/`, Namen in `SOUNDS` eintragen.
