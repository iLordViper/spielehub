# Änderungen

## 1.1.0 – 22.11.2026 – Würfelclash, Münzen, Erfolge

**Neues Spiel: Würfelclash** (`wuerfelclash/`, Doku: `docs/wuerfelclash.md`)
- Original-Kniffel-Regeln, leuchtende 3D-Würfel mit Hüpf-Animation, Funken und Kombi-Einblendungen („GROSSE STRASSE!“).
- Echte Würfelgeräusche (Kenney „Casino Audio“, CC0), Kuli-Kratzen beim Eintragen.
- Spielzettel wie der echte Block: Papier, eine Spalte pro Spieler, Einträge in Handschrift.
- Tipps vom Berater: erkennt Kombinationen, markiert Würfel zum Halten und das beste Feld.
- Modi: Live-Duell gegen Freunde (Einladung über Liste oder Link), Würfelbot, Am Tisch (2–4), Solo.
- Chat mit Sprechblasen unter dem Charakterbild (3 Sekunden je Nachricht), Bot antwortet mit Sprüchen.
- Laufende Partien werden gespeichert (Live in der Datenbank, lokal nach jedem Zug).

**Hub**
- Münzen 🪙 als gemeinsame Währung: nur für Duelle gegen Freunde, Sieg 5, sonst 1 – in Würfelclash und Brainclash.
- Hub-Erfolge im Profil (16 Stück, aus allen Spielen berechnet, mit Fortschritt).
- Spielerkarte zeigt Punkte, Münzen, Siege und gespielte Spiele.
- Herausforderungen aus Spielen erscheinen auf der Startseite und als Meldung mit „Annehmen“.
- `tools/handy-vorschau.html`: Seiten in Handygröße prüfen.

**Brainclash**
- Münzen für Duelle und Live-Duelle gegen Freunde (nicht gegen den Quizbot), Anzeige oben.

**Datenbank** (`firestore.rules`, in Firebase veröffentlicht)
- Neu: `spielstand/{spiel}/spieler/{uid}`, `partien/{spiel}/liste/{id}` und deren `chat`.

## 1.0.0 – 22.11.2026 – Der Hub entsteht

Veröffentlicht am 22.11.2026 im neuen Repo `iLordViper/spielehub`, live unter https://ilordviper.github.io/spielehub/. Alle 14 Dateien auf GitHub sind mit dem lokalen Stand verglichen (identisch).

**Neu**
- Hub-Startseite „Clash Club“ mit den Reitern Spiele, Rangliste und Profil.
- Ein gemeinsamer Charakter für alle Spiele: Name, Avatar-Editor (derselbe wie in Brainclash) und Banner. Neue Spieler legen ihn im Hub an.
- Gesamtpunkte und Hub-Level über alle Spiele, eigene Hub-Titel (Frischling … Unsterblich).
- Rangliste „Gesamt“ und je Spiel.
- „Gerade online“: zeigt Freunde, egal ob im Hub oder in einem Spiel.
- Spieleliste `shared/games.js`: Ein Eintrag pro Spiel, daraus entstehen Kachel, Ranglisten-Reiter und Profilwerte.
- Gemeinsame Bausteine in `shared/` (Design, Avatar, Firebase) für alle künftigen Spiele.
- Testmodus `?demo` ohne Datenbank, Testserver `tools/lokal-testen.js`.
- Dokumentation in `README.md` und `docs/`.

**Brainclash**
- Ist jetzt Spiel Nr. 1 im Ordner `brainclash/`.
- Einzige Änderung am Spiel: Zurück-Knopf „‹“ zum Hub links neben dem Logo.
- Gleiche Datenbank, gleiche Profile. Die alte Adresse `ilordviper.github.io/brainclash/` läuft unverändert weiter.

**Datenbank**
- `firestore.rules`: Regel für Spielstände künftiger Spiele vorbereitet (noch auskommentiert, nichts in Firebase geändert).

**Beim Testen behoben**
- Der Testmodus speicherte sein Testprofil zuerst unter demselben Browser-Schlüssel wie Brainclash. Brainclash hat es daraufhin als „Testspieler“ in die echte Datenbank hochgeladen. Der Eintrag wurde sofort gelöscht, der Testmodus nutzt jetzt einen eigenen Schlüssel (`hub_demo_profile`).
