# Änderungen

## 1.0.0 – 22.11.2026 – Der Hub entsteht

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
