# Puttclash – Bauplan (verbindlich für alle Teile)

Minigolf, Spiel 4 im Spiele-Hub. Dieses Dokument ist der Vertrag zwischen
`physik.js`, `bahnen.js`, `grafik.js` und `index.html`. Wer etwas daran ändert,
muss alle Teile anpassen.

## Allgemeine Regeln für alle Dateien

- Klassische Skripte, **keine Module, keine Bibliotheken, kein Build**. Muster wie `wuerfelclash/regeln.js`:
  ```js
  (function(root){ … const API={…}; if(typeof module!=='undefined')module.exports=API;else root.NAME=API; })(this);
  ```
- Kommentare und Texte auf **Deutsch** (Umlaute erlaubt). Kopfkommentar je Datei: wofür, Aufbau, „So fügst du … hinzu“.
- Muss mit `node --check datei.js` fehlerfrei sein und in Node ohne Browser ladbar (Grafik: nur die Teile, die ohne Canvas laufen).

## Koordinaten

- Logisches Feld: **1000 breit × 1500 hoch** (Einheiten), Ursprung oben links, y nach unten. Hochkant gedacht.
- Ball-Radius **12**, Loch-Radius **20**.
- Zeit in **Millisekunden**.

## Bahn (ein Loch) – Datenformat

```js
{
  id: 'park-1',              // eindeutig: <platz>-<nr>
  name: 'Erster Schlag',     // Anzeigename
  par: 2,                    // 2–5
  start: {x: 500, y: 1300},  // Abschlag
  loch:  {x: 500, y: 250},   // Loch
  rand: [x1,y1, x2,y2, …],   // GESCHLOSSENES Polygon = spielbare Fläche (Gras). Ist zugleich die Außenwand.
  waende: [ [x1,y1, x2,y2, …], … ],   // zusätzliche Wände INNERHALB (offene Polylinien, Dicke 0 – Abprall an der Linie)
  zonen: [                   // Untergründe innerhalb von rand (Reihenfolge = Zeichen-/Prüfreihenfolge, spätere gewinnen)
    { typ: 'sand'|'eis'|'wasser'|'lava'|'loch'(=Abgrund, wie Wasser),
      form: {poly:[x1,y1,…]} | {kreis:[x,y,r]} | {rect:[x,y,b,h]} },
    { typ: 'hang', form: {…}, richtung: [dx,dy] /* Einheitsvektor bergab */, staerke: 1 /* 0.5–3 */ },
    { typ: 'boost', form: {kreis:[x,y,r]}, richtung: [dx,dy], staerke: 1 /* schiebt beim Überrollen */ }
  ],
  objekte: [
    { typ: 'bumper', x, y, r, kraft: 1.4 },                        // runder Abpraller, beschleunigt (kraft = Rückprallfaktor)
    { typ: 'pfosten', x, y, r },                                   // runder fester Pfosten (normaler Abprall)
    { typ: 'block', rect: [x,y,b,h], bahn: [dx,dy], periode: 3000 },// bewegt sich sinusförmig um ±(dx,dy) um seine Ruhelage
    { typ: 'muehle', x, y, laenge: 160, fluegel: 4, periode: 4000 },// drehende Balken (Dicke 14) um (x,y); periode = 1 Umdrehung, positiv = Uhrzeigersinn
    { typ: 'tele', a: {x,y}, b: {x,y}, r: 28 },                    // Ball in a → kommt bei b mit gleicher Geschwindigkeit heraus (und umgekehrt nicht)
    { typ: 'tor', x, y, b, offen: 1200, zu: 1200 }                 // waagerechte Schranke (Dicke 14, Breite b, Mitte x,y), abwechselnd offen/zu
  ],
  deko: [ { typ: 'baum'|'busch'|'blume'|'stein'|'kaktus'|'palme'|'schneemann'|'eiskristall'|'stern'|'planet'|'rakete'|'fahne'
              |'fass'|'anker'|'muschel'|'schatzkiste'|'steuerrad'            // Piratenbucht (seit 1.3.0)
              |'fels'|'glutstein'|'duerrbaum'|'rauch'|'kristall', x, y, s: 1 } ]  // Vulkan; rauch & glutstein sind animiert
        // nur Optik. Darf überall liegen, auch außerhalb von rand (Hintergrund).
}
```

Bewegte Objekte hängen **nur von der absoluten Zeit t (ms)** ab, damit Physik und Grafik übereinstimmen:
- block: Versatz = (dx,dy) · sin(2π·t/periode)
- muehle: Winkel = 2π·t/periode (+ Flügel k·2π/fluegel)
- tor: zu, wenn (t mod (offen+zu)) ≥ offen

## Platz (Kurs aus 6 Bahnen)

```js
{ id: 'park', name: 'Sonnenpark', emoji: '🌳', bahnen: [ …6 Bahnen… ] }
```
Plätze (in dieser Reihenfolge): `park` (leicht), `wueste` (mittel), `piraten` (mittel: viel Wasser, Planken, Kisten, Fallgitter), `eis` (mittel–schwer, viel Eis), `vulkan` (schwer: Lava, Asche, Hänge, Mühlen), `weltraum` (schwer: Tele, Boost, Bumper, Mühlen).

Die Kamera zoomt auf den Umriss der Bahn (`rand` + Abschlag + Loch, 70 Rand), nicht aufs ganze Feld.

## Live: reihum
Mit Freunden wird reihum gespielt wie auf dem echten Platz: `dran` (uid), `reihe` (Reihenfolge dieser Bahn – wer auf der letzten Bahn die wenigsten Schläge hatte, beginnt), `zugStart`, `geschossen`, `verpasst.{uid}`. Wer im Loch ist, wird übersprungen.

`bahnen.js` stellt bereit: `BAHNEN.PLAETZE` (Array der 4 Plätze), `BAHNEN.bahn(id)`, `BAHNEN.alle()`.

## Physik – `physik.js` (global `PHYSIK`)

```js
PHYSIK.KONST            // alle Zahlen (Reibung je Untergrund, Abprall, Höchstgeschwindigkeit, Loch-Fanggeschwindigkeit …)
PHYSIK.schuss(bahn, ball:{x,y}, winkel /*Rad, 0=rechts, π/2=unten*/, kraft /*0..1*/, t0 /*abs. ms*/)
  → { pfad: [[t,x,y], …]   // t = ms seit Schussbeginn, ca. alle 33 ms ein Punkt, letzter Punkt = Ende
      ende: {x,y},          // wo der Ball liegen bleibt (bei Wasser/Lava/Abgrund: der Abschlagspunkt dieses Schusses)
      versenkt: bool,       // im Loch
      wasser: bool,         // ins Wasser/Lava/Abgrund gefallen → Strafschlag
      dauer: ms,
      ereignisse: [[t,'wand'|'bumper'|'wasser'|'sand'|'tele'|'boost'|'loch', x, y], …] } // für Töne/Effekte
PHYSIK.objektZustand(bahn, obj, t) → Geometrie des Objekts zur Zeit t (für Grafik), z. B. {rect:[…]} | {balken:[[x1,y1,x2,y2],…]} | {zu:bool}
PHYSIK.untergrund(bahn, x, y)      → 'gras'|'sand'|'eis'|'wasser'|'lava'|'loch'|'aus'
```
- Feste Schrittweite (z. B. 1/240 s), Ball-gegen-Linie mit Kreis-Kollision (kein Durchtunneln bei Höchstgeschwindigkeit), Abprall mit Faktor, Reibung je Untergrund (Eis sehr wenig, Sand viel), Hang = konstante Beschleunigung, Boost = Schub in Richtung.
- Loch: Ball fällt hinein, wenn sein Mittelpunkt im Lochkreis ist UND Geschwindigkeit < Fanggrenze; schneller → „Lip-out“ (leicht abgelenkt, rollt weiter).
- Ball bleibt liegen, wenn Geschwindigkeit < kleiner Grenzwert und kein Hang/Boost wirkt. Höchstdauer eines Schusses 12 s.
- Rein rechnerisch, kein DOM. Ergebnis hängt nur von den Eingaben ab.

## Grafik – `grafik.js` (global `GRAFIK`)

```js
GRAFIK.THEMEN                 // Farben/Stil je Platz (park, wueste, eis, weltraum)
GRAFIK.kamera(bahn, cssBreite, cssHoehe, dreh)  // dreh=true: Feld um 90° gedreht (Querformat)
  → { skala, dreh, feldZuBild(x,y)→[px,py], bildZuFeld(px,py)→[x,y] }
GRAFIK.vorbereiten(bahn, platzId, kamera, pixelRatio) → statische Ebene (Offscreen-Canvas, wird gecacht)
GRAFIK.zeichne(ctx, bahn, platzId, kamera, zustand)
  zustand = { t,                       // absolute Zeit (ms) für bewegte Objekte & Animationen
              baelle: [{x,y, farbe:'#hex', name, ich:bool, geist:bool, versenkt:bool}],
              ziel: null | {von:{x,y}, winkel, kraft},   // Zielpfeil + Kraftanzeige am eigenen Ball
              spur: [[x,y],…] }                          // Nachleuchten des eigenen Balls
GRAFIK.effekt(art, x, y, extra)   // 'platsch','sand','funken','konfetti','tele','boost','holeinone' – Partikel, zeichne() malt & altert sie
```
Ziel: richtig schicke 2D-Grafik von oben – weiche Schatten, Gras mit Mähstreifen, plastische Banden, animiertes Wasser, Sandkörnung, Eisglanz, Sternenhimmel im Weltraum, Fahne im Loch, Ball mit Glanzlicht und Schatten. Alles prozedural (keine Bilddateien), schnell genug fürs Handy (statische Teile vorab rendern).

## Live-Partie (index.html)

- Raum: `partien/puttclash/liste/{id}` wie Kritzelclash (`status: lobby|laeuft|fertig`, `players`, `info`, `invited`, `host`).
- Zusätzlich: `platz`, `loch` (Index 0–5), `schlaege.{uid}.{loch}` (Anzahl), `fertig.{uid}.{loch}` (true), `pos.{uid}` ({x,y} aktuelle Ballposition).
- Jeder Schuss als Dokument `…/{id}/schuesse/{auto}` = `{by, loch, nr, start:{x,y}, pfad (gekürzt, ints), ende, versenkt, wasser, t0}` → die anderen spielen den Pfad als Geisterball ab.
- Alle spielen dieselbe Bahn gleichzeitig. Nächste Bahn, wenn alle fertig sind (Höchstschläge je Bahn: par+4 → danach gilt die Bahn als beendet).
