# So fügst du ein neues Spiel hinzu

Beispiel: ein Spiel namens **Wortjagd** mit der Kennung `wortjagd`.

## 1. Ordner anlegen

```
spielehub/
  wortjagd/
    index.html
```

Die Kennung (`wortjagd`) ist gleichzeitig der Ordnername und später Teil der Adresse: `…/spielehub/wortjagd/`. Nur Kleinbuchstaben, Ziffern und Bindestriche.

## 2. Gemeinsame Bausteine einbinden

Oben in `wortjagd/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;700;800;900&display=swap">
<link rel="stylesheet" href="../shared/theme.css">
```

Unten vor dem eigenen Skript:

```html
<script src="../shared/core.js"></script>
<script src="../shared/firebase.js"></script>
<script src="../shared/games.js"></script>
```

Damit hast du dasselbe Design, den Avatar (`avatarSVG(profil.avatar)`), die Level-Formel und die Datenbank.

## 3. Zurück-Knopf zum Hub

In die Kopfleiste des Spiels:

```html
<a class="xbtn" href="../" aria-label="Zurück zu allen Spielen">‹</a>
```

## 4. Spieler laden und Spielstand speichern

```js
const fb = await HubFirebase.start();          // {fs, uid} oder null (offline)
if (fb) {
  // gemeinsames Profil lesen (Name, Avatar, Banner) – NUR lesen
  const profil = (await fb.fs.doc('profiles/' + fb.uid).get()).data();

  // eigener Spielstand dieses Spiels
  const ref = fb.fs.doc('spielstand/wortjagd/spieler/' + fb.uid);
  const stand = (await ref.get()).data() || {};

  // speichern (merge = andere Felder bleiben erhalten)
  await ref.set({ punkte: (stand.punkte || 0) + 120, runden: (stand.runden || 0) + 1 }, { merge: true });

  // „online“ melden, damit Freunde dich im Hub sehen
  HubFirebase.presence(fb.fs, fb.uid, ids => { /* ids = andere Spieler online */ });
}
```

**Regel:** Neue Spiele schreiben **nie** in `profiles/{uid}`. Brainclash speichert dort immer das ganze Dokument und könnte fremde Werte mit einem alten Stand überschreiben. Jedes neue Spiel hat seinen eigenen Bereich `spielstand/<kennung>/spieler/<uid>`.

Gibt es noch kein Profil (neuer Spieler kommt direkt über den Spiel-Link), schick ihn zum Hub: `location.href = '../'`. Dort legt er seinen Charakter an.

## 5. Datenbank-Regeln freischalten (nur beim ersten neuen Spiel)

1. In `firestore.rules` den Block `match /spielstand/{spiel}/spieler/{uid}` einkommentieren (die `//` entfernen).
2. [Firebase-Konsole](https://console.firebase.google.com/) → Projekt **brainclash-7f1b0** → Firestore → **Regeln**.
3. Den kompletten Inhalt von `firestore.rules` einfügen und **Veröffentlichen**.

Ohne diesen Schritt lehnt die Datenbank das Speichern ab.

## 6. Im Hub eintragen

In `shared/games.js` einen Eintrag an die Liste `GAMES` anhängen (Vorlage steht auskommentiert in der Datei):

```js
,{
  id:'wortjagd', name:'Wortjagd', emoji:'🔤', pfad:'wortjagd/', status:'live',
  kurz:'Finde in 60 Sekunden so viele Wörter wie möglich.',
  tags:['⏱️ 60 Sek.','👥 Rangliste'],
  farbe:['#3D8BFF','#2753C9','#162F7A'],
  spielstand:true,
  punkte:(p,s)=>s.punkte||0,
  werte:(p,s)=>[[fmt(s.punkte),'Punkte'],[s.runden||0,'Runden'],[s.rekord||0,'Rekord']]
}
```

Danach erscheint das Spiel automatisch als Kachel auf der Startseite, als eigener Reiter in der Rangliste und mit seinen Werten im Profil. Mit `status:'bald'` erscheint es vorab als „Kommt bald“-Kachel.

## 7. Testen, dokumentieren, hochladen

1. `node tools/lokal-testen.js` → `http://localhost:8080/?demo`
2. In `index.html` die `HUB_VERSION` hochzählen und in `CHANGELOG.md` eintragen.
3. Hochladen wie in [veroeffentlichen.md](veroeffentlichen.md) beschrieben.
