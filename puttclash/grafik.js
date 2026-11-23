/* ==========================================================================
   PUTTCLASH · GRAFIK (grafik.js)
   --------------------------------------------------------------------------
   Malt eine Minigolf-Bahn von oben – schick, aber handyschnell. Canvas 2D,
   keine Bibliotheken, keine Bilddateien: alles wird prozedural gezeichnet.
   Vertrag (verbindlich): puttclash/FORMAT.md, Abschnitte „Koordinaten“,
   „Bahn – Datenformat“ und „Grafik“.

   Öffentliche Schnittstelle (global GRAFIK):
     GRAFIK.THEMEN                          Farben/Stil je Platz (park, wueste, eis, weltraum, piraten, vulkan)
     GRAFIK.kamera(bahn, cssB, cssH, dreh)  Feld 1000×1500 ins Canvas einpassen
        → {skala, dreh, breite, hoehe, feldZuBild(x,y)→[px,py], bildZuFeld(px,py)→[x,y], …}
     GRAFIK.vorbereiten(bahn, platzId, kamera, pixelRatio)
        → statische Ebene (Canvas), wird gecacht
     GRAFIK.zeichne(ctx, bahn, platzId, kamera, zustand)   ein Bild malen
     GRAFIK.effekt(art, x, y, extra)        Partikel-Effekt auslösen
     GRAFIK.leeren()                        (Zusatz) Cache leeren, z. B. nach Farbänderung

   Aufbau dieser Datei:
     1. Grundwerte (Feldgröße, Dicken)
     2. THEMEN – alle Farben            ← hier änderst du das Aussehen
     3. Kleine Helfer (Zufall, Farben, Geometrie, Formen)
     4. Kamera
     5. Statische Ebene (Hintergrund, Banden, Rasen, Zonen, Loch, Deko) → Offscreen-Canvas
        (sammelt nebenbei, was pro Bild bewegt wird: Funkeln, Wellen, Glut, Lavaflüsse, animierte Deko)
     6. Deko-Zeichner (baum, busch, blume, …) und DEKO_ANIM (rauch, glutstein)
     7. Bewegte Teile pro Bild (Hintergrund, Wasser, Objekte, Bälle, Fahne, Zielhilfe)
     8. Effekte (Partikel)
     9. zeichne() – setzt alles zusammen

   Leistung (Handy, 60 fps):
     Alles, was sich nie bewegt, wird EINMAL in ein Offscreen-Canvas gemalt
     (vorbereiten). Cache-Schlüssel: bahn.id + Platz + Canvasgröße + Drehung
     + pixelRatio. Pro Bild wird diese Ebene nur kopiert (ein drawImage) und
     darüber das Bewegte gemalt. Kein getImageData; teure weiche Schatten
     (shadowBlur) gibt es nur in der statischen Ebene.

   Licht kommt immer von oben links (am Bildschirm, auch bei dreh=true):
     - In der statischen Ebene über ctx.shadowOffset (wirkt in Bildpunkten).
     - Für Zeichnungen im Feld gibt kamera.schatten die Richtung „unten rechts
       am Bildschirm“ als Feld-Vektor an.
     - Aufrechte Dinge (Deko, Bälle, Fahne) werden mit aufrecht() so gedreht,
       dass ihr „oben“ am Bildschirm oben ist.

   So änderst du die Farben eines Platzes:
     In THEMEN (Abschnitt 2) den Platz suchen, z. B. THEMEN.park.gras.farbe.
     Farben IMMER als '#rrggbb' schreiben (die Helfer mischen damit),
     Ausnahme: Felder, die ausdrücklich 'rgba(…)' haben (schatten).
     Danach Seite neu laden (oder GRAFIK.leeren(), wenn die Seite offen bleibt).

   So fügst du einen neuen Platz / ein Thema hinzu:
     Einen Block in THEMEN kopieren (z. B. park), unter der neuen Platz-id
     (wie in bahnen.js) einfügen und die Farben anpassen. Fehlende deko-Farben
     kommen aus DEKO_STANDARD. Unbekannte Plätze bekommen das Park-Thema.

   So fügst du ein Deko-Objekt hinzu:
     In Abschnitt 6 eine Funktion (c, d, R, g) schreiben – gezeichnet um (0,0),
     Grundgröße ca. 20–60 Einheiten, Bildschirm-oben = −y, Schatten nach
     unten rechts (+x,+y) – und in DEKO unter ihrem typ-Namen eintragen.
     d = Deko-Farben des Themas, R = Zufallszahl 0..1 (fest je Bahn).
     Unbekannte typ-Namen werden einfach übersprungen (nie ein Fehler).
     Vorhanden: baum, busch, blume, stein, kaktus, palme, schneemann, eiskristall, stern,
     planet, rakete, fahne, fass, anker, muschel, schatzkiste, steuerrad, fels, glutstein,
     duerrbaum, rauch, kristall.

   So machst du ein Deko-Objekt animiert (wie 'rauch', 'glutstein'):
     Zusätzlich in DEKO_ANIM (Abschnitt 6) eine Funktion (c, d, t, s) eintragen.
     Sie wird PRO BILD aufgerufen (gleiches Koordinatensystem wie der Zeichner,
     t = Spielzeit ms, s = fester Zufallswert 0..1 je Objekt) und malt nur das
     Bewegte; der Rest bleibt in der statischen Ebene. Bitte billig halten
     (kein shadowBlur, wenige Verläufe).

   So fügst du einen Effekt hinzu:
     In effekt() (Abschnitt 8) einen neuen case anlegen, der Partikel mit
     neuP({...}) erzeugt. Partikel-Arten: 'punkt', 'funke', 'ring', 'wolke',
     'konfetti'. zeichne() bewegt, altert und malt sie von selbst.
   ========================================================================== */
(function(root){
'use strict';

/* ---------- 1. Grundwerte ---------- */
const FELD_B=1000, FELD_H=1500;   // logisches Feld (FORMAT.md)
const BALL_R=12, LOCH_R=20;
const RAND_DICKE=16;   // Außenbande, nach AUSSEN an rand angesetzt (Ball berührt genau die Linie)
const WAND_DICKE=12;   // Innenwände, mittig auf der Linie (Physik: Dicke 0 → schmal halten)
const BALKEN=14;       // Mühlenflügel und Tor, wie in der Physik
const CACHE_MAX=12;    // so viele statische Ebenen merken wir uns
const PARTIKEL_MAX=900;
const TAU=Math.PI*2;

/* ---------- 2. THEMEN ----------
   Ein Block je Platz. Bedeutung der Felder:
     hintergrund  Fläche außerhalb von rand: muster 'wiese'|'duenen'|'schnee'|'all'|'meer'|'basalt',
                  basis/hell/dunkel = Grundfarben, nebel = Nebelfarben (nur 'all'),
                  funkeln = Anzahl blinkender Sternchen im Hintergrund (0 = aus),
                  funkelAbstand = Mindestabstand des Funkelns zur Bahn (Standard 22)
                  nur 'meer':   flach (Flachwasser um die Insel), strand/strandNass (Strand), schaum
                                → Insel-Küste um die Bahn + Wellenkronen, die pro Bild auf- und abtauchen
                  nur 'basalt': glut/glutHell (Risse, Lavaflüsse), glutPartikel = Anzahl aufsteigender Glutfunken
     gras         Spielfläche: farbe, streifen (Mähstreifen, null = aus), streifenBreite,
                  karo (0..0.1 Querstreifen-Helligkeit), halme (Textur-Farbe, null = aus),
                  raster (Gitterlinien-Farbe, nur Weltraum), glanz (true = Eisglanz),
                  koerner ('#hex' = Sandkörner im Gras), flecken (['#hex',…] = weiche Moosflecken)
     bande        Banden: stil 'holz'|'stein'|'schnee'|'metall'|'planke'|'basalt', farbe/hell/dunkel/fuge,
                  neon = Leuchtkante ('#hex' oder null),
                  tau/poller = Tau an der Außenkante und eiserne Poller an den Ecken (stil 'planke'),
                  glut = glühende Fuge (stil 'basalt', auch Innenwände)
     sand, wasser, lava, eis, hang, boost, abgrund   Zonen (typ 'loch' = abgrund)
                  lava.kraeftig = true → Lava strahlt auf die Umgebung, mehr Blasen, pulsierender Rand
     bumper (stil 'rettungsring' mit holz/seil | 'glut' | Standard = Pilz), pfosten,
     block (stil 'kiste'|'stein'|'eisblock'|'metall'|'basalt', basalt mit glut),
     muehle (stil 'obsidian'; streifen null = keine Streifen; glanz/kante = Glanzlinie/Glühkante),
     tor (stil 'gitter' = Fallgitter; sonst Schranke mit Warnstreifen), tele
     loch, fahne, abschlag   Loch, Fahne im Loch, Abschlagmatte
     spur, akzent             Leuchtspur und Akzentfarbe (Fallback für Ballfarben)
     schatten                 Farbe der weichen Schatten (rgba)
     vignette                 Abdunkeln der Bildecken (0..0.5)
     deko                     Farben der Deko-Objekte (siehe DEKO_STANDARD) */
const THEMEN={
 park:{
  name:'Sonnenpark',
  hintergrund:{muster:'wiese', basis:'#2e6a2b', hell:'#4a9a3c', dunkel:'#1d4b1c', funkeln:0},
  gras:{farbe:'#4fb443', streifen:'#5dc44f', streifenBreite:90, karo:.035, halme:'#2c7a27'},
  bande:{stil:'holz', farbe:'#b97a40', hell:'#eab474', dunkel:'#6a3c17', fuge:'#4e2a10', neon:null},
  sand:{farbe:'#ecd49a', hell:'#fbecc4', dunkel:'#c39f5e'},
  wasser:{tief:'#135a9e', flach:'#3aa6e8', ufer:'#d9c48a', schaum:'#ffffff', glanz:'#e8f7ff'},
  lava:{tief:'#5c0d03', glut:'#ff5a14', hell:'#ffd15a'},
  eis:{farbe:'#c4e9ff', hell:'#ffffff', dunkel:'#7fbde6'},
  hang:{hell:'#ffffff', dunkel:'#0a2a08', pfeil:'#ffffff'},
  boost:{farbe:'#ffc53d', kern:'#fff4c2', platte:'#24401c'},
  abgrund:{tief:'#030604', wand:'#3a2e1c', kante:'#6b4f2a', sterne:false},
  bumper:{ring:'#ff6b57', dunkel:'#a8321f', kern:'#fff1dc', glow:'#ffd25a'},
  pfosten:{farbe:'#8a5a2b', hell:'#d39a5e', kappe:'#efe6d2'},
  block:{stil:'kiste', farbe:'#c88d4c', hell:'#ecb87c', dunkel:'#74491f'},
  muehle:{fluegel:'#f5f0e6', streifen:'#ff6b57', nabe:'#3b3f46', nabeHell:'#b5bcc6'},
  tor:{balken:'#ffffff', streifen:'#ff4d6d', pfosten:'#39404a'},
  tele:{a:'#b46bff', b:'#3de0ff', platte:'#1c2430'},
  loch:{innen:'#0a1209', kragen:'#8ee07a', huelse:'#f2f2f2'},
  fahne:{stange:'#f5f0e6', tuch:'#ff4d6d', schrift:'#ffffff'},
  abschlag:{matte:'#2f8f2c', rand:'#c8f5b8', marker:'#ffc53d'},
  spur:'#ffffff', akzent:'#ffc53d', schatten:'rgba(6,26,4,.48)', vignette:.28,
  deko:{baumStil:'laub'}
 },
 wueste:{
  name:'Wüstenoase',
  hintergrund:{muster:'duenen', basis:'#dba35a', hell:'#f3c886', dunkel:'#b0773a', funkeln:0},
  gras:{farbe:'#b8b25a', streifen:'#c5bf66', streifenBreite:80, karo:.03, halme:'#7f7d32'},
  bande:{stil:'stein', farbe:'#d69a5c', hell:'#f6cd98', dunkel:'#8a5428', fuge:'#6e4220', neon:null},
  sand:{farbe:'#f1d08e', hell:'#ffe9bb', dunkel:'#c59650'},
  wasser:{tief:'#0b8a96', flach:'#46e3d2', ufer:'#ecd59c', schaum:'#ffffff', glanz:'#eafffb'},
  lava:{tief:'#5a0d02', glut:'#ff6a1a', hell:'#ffd25a'},
  eis:{farbe:'#d5f1ff', hell:'#ffffff', dunkel:'#8ec8ea'},
  hang:{hell:'#fff6d8', dunkel:'#3a2a08', pfeil:'#fff6d8'},
  boost:{farbe:'#ff9a3d', kern:'#fff0c8', platte:'#4a3214'},
  abgrund:{tief:'#120804', wand:'#6b4524', kante:'#a8723c', sterne:false},
  bumper:{ring:'#ff8a3d', dunkel:'#a84c16', kern:'#fff2d6', glow:'#ffd25a'},
  pfosten:{farbe:'#b67a42', hell:'#f0bf86', kappe:'#fbe7c4'},
  block:{stil:'stein', farbe:'#d9a066', hell:'#f6cb96', dunkel:'#8a5629'},
  muehle:{fluegel:'#f6e6c6', streifen:'#e2553a', nabe:'#5a3a1c', nabeHell:'#d6a86e'},
  tor:{balken:'#fff4e0', streifen:'#e2553a', pfosten:'#5a3a1c'},
  tele:{a:'#ff6bd6', b:'#ffd23d', platte:'#3a2614'},
  loch:{innen:'#140c04', kragen:'#d9d27a', huelse:'#f6efe0'},
  fahne:{stange:'#fbf3e2', tuch:'#ff7a2f', schrift:'#ffffff'},
  abschlag:{matte:'#9c9642', rand:'#f3edb8', marker:'#ff7a2f'},
  spur:'#fff6d8', akzent:'#ff9a3d', schatten:'rgba(70,36,6,.42)', vignette:.24,
  deko:{baumStil:'laub', baum:['#c3cf62','#7f9134','#4a5a1e'], busch:['#b9c15a','#7a8a30','#4a541a'],
        blumen:['#ff6b9a','#ffd23d','#ff8a3d','#ffffff'], stein:['#f0c48e','#c58a52','#7e5228']}
 },
 eis:{
  name:'Gletscher',
  hintergrund:{muster:'schnee', basis:'#d8e8f5', hell:'#ffffff', dunkel:'#a6c2dc', funkeln:44},
  gras:{farbe:'#e3f2fc', streifen:'#d6ebf9', streifenBreite:110, karo:0, halme:null, glanz:true},
  bande:{stil:'schnee', farbe:'#eef6ff', hell:'#ffffff', dunkel:'#8fb2d4', fuge:'#b9d2ea', neon:null},
  sand:{farbe:'#cdbfa6', hell:'#e9dec8', dunkel:'#988870'},
  wasser:{tief:'#123f74', flach:'#4a98d6', ufer:'#ffffff', schaum:'#ffffff', glanz:'#ffffff'},
  lava:{tief:'#5a0d02', glut:'#ff6a1a', hell:'#ffd25a'},
  eis:{farbe:'#8fd0ff', hell:'#ffffff', dunkel:'#3f8fd0'},
  hang:{hell:'#ffffff', dunkel:'#1c3a5a', pfeil:'#5b8fc0'},
  boost:{farbe:'#5bc0ff', kern:'#e8f7ff', platte:'#2a4a6a'},
  abgrund:{tief:'#03101e', wand:'#4f80ae', kante:'#dff0ff', sterne:false},
  bumper:{ring:'#ff4d6d', dunkel:'#a51e3a', kern:'#fff0f3', glow:'#ff9ab0'},
  pfosten:{farbe:'#8fb0cc', hell:'#e8f4ff', kappe:'#ffffff'},
  block:{stil:'eisblock', farbe:'#a6dbff', hell:'#ffffff', dunkel:'#4f97cc'},
  muehle:{fluegel:'#ffffff', streifen:'#5bc0ff', nabe:'#2d4a73', nabeHell:'#9fc3e6'},
  tor:{balken:'#ffffff', streifen:'#ff4d6d', pfosten:'#2d4a73'},
  tele:{a:'#7b8cff', b:'#3dffd0', platte:'#1f3550'},
  loch:{innen:'#071422', kragen:'#bfe0f6', huelse:'#ffffff'},
  fahne:{stange:'#ffffff', tuch:'#ff4d6d', schrift:'#ffffff'},
  abschlag:{matte:'#bcd8ee', rand:'#ffffff', marker:'#5bc0ff'},
  spur:'#bfe9ff', akzent:'#5bc0ff', schatten:'rgba(30,60,100,.38)', vignette:.20,
  deko:{baumStil:'tanne', baum:['#6aa886','#2f6b55','#173a2e'], stein:['#c9d6e2','#8fa2b5','#56687c']}
 },
 weltraum:{
  name:'Sternenstation',
  hintergrund:{muster:'all', basis:'#080c20', hell:'#1a1f4e', dunkel:'#020309',
               nebel:['#7b3dff','#ff3d9a','#20c8ff','#3dffb4'], funkeln:60},
  gras:{farbe:'#1c2452', streifen:'#212b5e', streifenBreite:100, karo:0, halme:null, raster:'#5bc0ff'},
  bande:{stil:'metall', farbe:'#39426e', hell:'#8a97d2', dunkel:'#141832', fuge:'#0b0e22', neon:'#3de0ff'},
  sand:{farbe:'#6a4f9e', hell:'#b096e0', dunkel:'#3c2a64'},
  wasser:{tief:'#0b237a', flach:'#3d7bff', ufer:'#3de0ff', schaum:'#bff6ff', glanz:'#dffbff'},
  lava:{tief:'#4a0636', glut:'#ff3d9a', hell:'#ffb3e0'},
  eis:{farbe:'#5fd0ff', hell:'#e8fbff', dunkel:'#1f6fb0'},
  hang:{hell:'#8ae9ff', dunkel:'#000010', pfeil:'#8ae9ff'},
  boost:{farbe:'#3dffb4', kern:'#e0fff3', platte:'#0b1a2a'},
  abgrund:{tief:'#000004', wand:'#0d1230', kante:'#ff3d9a', sterne:true},
  bumper:{ring:'#ff3d9a', dunkel:'#7e0e48', kern:'#ffe0f2', glow:'#ff8ad0'},
  pfosten:{farbe:'#3a4370', hell:'#a3b0f0', kappe:'#3de0ff'},
  block:{stil:'metall', farbe:'#4a557f', hell:'#9aa8e0', dunkel:'#1a1f3c'},
  muehle:{fluegel:'#c9d2ff', streifen:'#3de0ff', nabe:'#161b36', nabeHell:'#7d8ac4'},
  tor:{balken:'#e6ecff', streifen:'#ffc53d', pfosten:'#161b36'},
  tele:{a:'#b46bff', b:'#3dffb4', platte:'#0b0f24'},
  loch:{innen:'#000000', kragen:'#3de0ff', huelse:'#bff6ff'},
  fahne:{stange:'#dfe6ff', tuch:'#ffc53d', schrift:'#2a1700'},
  abschlag:{matte:'#28336e', rand:'#3de0ff', marker:'#3de0ff'},
  spur:'#8ae9ff', akzent:'#3de0ff', schatten:'rgba(0,0,0,.6)', vignette:.34,
  deko:{baumStil:'laub', baum:['#c48bff','#7a3dd6','#3a1470'], busch:['#7df0d0','#2fae8e','#145a4a'],
        blumen:['#ff6bd6','#3de0ff','#ffd23d','#ffffff'], stein:['#8e94b8','#5a5f84','#2c2f4a']}
 },
 /* Piratenbucht: Insel im türkisen Karibikmeer (Strand, Schaum, Wellen), Banden als Schiffsdeck
    aus Teakholz mit Nägeln und Tau, Bumper = Rettungsring um ein Fass, Tor = Fallgitter. */
 piraten:{
  name:'Piratenbucht',
  hintergrund:{muster:'meer', basis:'#17a9bd', hell:'#5ad9d6', dunkel:'#0a6a8c', funkeln:36, funkelAbstand:130,
               flach:'#7fe6d8', strand:'#f2dca2', strandNass:'#d6ba7c', schaum:'#ffffff'},
  gras:{farbe:'#8cc84e', streifen:'#98d25a', streifenBreite:80, karo:.03, halme:'#55882c', koerner:'#efdca6'},
  bande:{stil:'planke', farbe:'#8a5a32', hell:'#c99158', dunkel:'#4a2c14', fuge:'#2a1808', neon:null,
         tau:'#dcc08a', poller:'#3a3530'},
  sand:{farbe:'#f6e3ae', hell:'#fff5d8', dunkel:'#d4b676'},
  wasser:{tief:'#078ca6', flach:'#4ee6da', ufer:'#f2dca2', schaum:'#ffffff', glanz:'#eafffb'},
  lava:{tief:'#5a0d02', glut:'#ff6a1a', hell:'#ffd25a'},
  eis:{farbe:'#c9f1ff', hell:'#ffffff', dunkel:'#7fc6e6'},
  hang:{hell:'#fffbe6', dunkel:'#183a0e', pfeil:'#fffbe6'},
  boost:{farbe:'#ffd23d', kern:'#fff6d0', platte:'#4a3218'},
  abgrund:{tief:'#03141c', wand:'#0a5068', kante:'#f2dca2', sterne:false},
  bumper:{stil:'rettungsring', ring:'#ff4a3a', dunkel:'#8e2014', kern:'#fff8ee', glow:'#ffd25a', holz:'#a86e3c', seil:'#e6cf98'},
  pfosten:{farbe:'#3a3530', hell:'#948c80', kappe:'#dcc08a'},
  block:{stil:'kiste', farbe:'#b4773f', hell:'#e2aa6a', dunkel:'#5a3816'},
  muehle:{fluegel:'#c99158', streifen:'#8a5a32', nabe:'#3a3530', nabeHell:'#c8b48a'},
  tor:{stil:'gitter', balken:'#34343a', streifen:'#8c8c96', pfosten:'#4a2c14'},
  tele:{a:'#3dffd0', b:'#ffd23d', platte:'#3a2614'},
  loch:{innen:'#0a1209', kragen:'#c6e68a', huelse:'#f6efe0'},
  fahne:{stange:'#f0e2c0', tuch:'#1c1c1e', schrift:'#ffffff'},
  abschlag:{matte:'#7a4a22', rand:'#ecd09a', marker:'#ff4a3a'},
  spur:'#fff6d8', akzent:'#ffd23d', schatten:'rgba(8,48,40,.42)', vignette:.22,
  deko:{baumStil:'laub', baum:['#9be070','#3f9a34','#1d5a1b'], busch:['#7ed65a','#2f8a2a','#1a4c18'],
        blumen:['#ff4d6d','#ff8a3d','#ffd23d','#ffffff'], stein:['#ece2cf','#aa9c84','#6a5e4c']}
 },
 /* Vulkan: Basaltsäulen mit glühenden Rissen und Lavaflüssen, aufsteigende Glut, Moos-Gras,
    Basaltbanden mit glühender Fuge, kräftige Lava, Asche statt Sand, Glutbrocken, Obsidian-Mühlen. */
 vulkan:{
  name:'Vulkan',
  hintergrund:{muster:'basalt', basis:'#2a2523', hell:'#4a423e', dunkel:'#0e0b0a', funkeln:0,
               glut:'#ff5a14', glutHell:'#ffd25a', glutPartikel:34},
  gras:{farbe:'#4b5829', streifen:'#53612e', streifenBreite:90, karo:.02, halme:'#28320f', flecken:['#64742f','#333f18']},
  bande:{stil:'basalt', farbe:'#3a3533', hell:'#6e6662', dunkel:'#171413', fuge:'#0a0807', neon:null, glut:'#ff6a1a'},
  sand:{farbe:'#8a8580', hell:'#b8b3ac', dunkel:'#56524e'},
  wasser:{tief:'#103848', flach:'#3a8aa0', ufer:'#56524e', schaum:'#dfefff', glanz:'#e8f6ff'},
  lava:{tief:'#3a0802', glut:'#ff5a10', hell:'#ffd84a', kraeftig:true},
  eis:{farbe:'#9fd4f0', hell:'#ffffff', dunkel:'#4f8fba'},
  hang:{hell:'#ffd2a0', dunkel:'#0e0700', pfeil:'#ffb070'},
  boost:{farbe:'#ff8a2a', kern:'#fff0c0', platte:'#2a1a12'},
  abgrund:{tief:'#0a0200', wand:'#3a1a10', kante:'#ff6a1a', sterne:false},
  bumper:{stil:'glut', ring:'#ff6a1a', dunkel:'#2c1a14', kern:'#ffe08a', glow:'#ff8a2a'},
  pfosten:{farbe:'#3a3533', hell:'#7a726c', kappe:'#ff8a2a'},
  block:{stil:'basalt', farbe:'#3c3836', hell:'#7c746e', dunkel:'#141110', glut:'#ff6a1a'},
  muehle:{stil:'obsidian', fluegel:'#1a1520', streifen:null, glanz:'#c9b8ff', kante:'#ff6a1a', nabe:'#2a1a12', nabeHell:'#ff8a2a'},
  tor:{balken:'#2c2826', streifen:'#ff6a1a', pfosten:'#141110'},
  tele:{a:'#ff6a1a', b:'#ffd25a', platte:'#141110'},
  loch:{innen:'#050302', kragen:'#7a8a3a', huelse:'#d8d0c0'},
  fahne:{stange:'#d8d0c0', tuch:'#ff6a1a', schrift:'#2a0800'},
  abschlag:{matte:'#384220', rand:'#c8d08a', marker:'#ff6a1a'},
  spur:'#ffcf9a', akzent:'#ff8a2a', schatten:'rgba(0,0,0,.6)', vignette:.36,
  deko:{baumStil:'laub', baum:['#7a8a3a','#45521e','#20280c'], busch:['#6a7a30','#3c4a1a','#1c240a'], beeren:'#ff6a1a',
        blumen:['#ff6a1a','#ffd25a','#ff3d3d'], stein:['#6a625e','#3e3936','#1c1918'],
        fels:['#5e5753','#36312e','#151211'], glutRiss:'#ff6a1a', duerr:['#6a5e54','#3a322c','#14100e'],
        kristall:['#f4e6ff','#b07cff','#4a1e8a']}
 }
};
/* Deko-Farben, die jedes Thema hat, solange es sie nicht selbst überschreibt.
   Listen mit 3 Farben = [hell, mittel, dunkel]. */
const DEKO_STANDARD={
 baumStil:'laub',                                     // 'laub' (runde Krone) | 'tanne' (Nadelbaum mit Schnee)
 baum:['#86d65e','#3f9a34','#1d5a1b'],
 busch:['#6cc652','#2f7f2a','#1a4c18'], beeren:'#ff4d6d',
 blumen:['#ff6b9a','#ffd23d','#ffffff','#b48cff','#ff8a3d'],
 stein:['#cfcac0','#958f86','#5c5852'],
 kaktus:['#86cf6e','#3f8f44','#21552a'], kaktusBluete:'#ff6b9a',
 palme:['#8cd85e','#3c8e31','#7a4f22'],
 planet:['#ffb36b','#6bc8ff','#c79bff','#7df0b8','#ff7a9a'],
 wimpel:['#ff4d6d','#ffc53d','#5bc0ff','#3ddc97'],
 rakete:['#ffffff','#ff4d6d','#3de0ff'],
 holz:['#c8925a','#8a5a32','#4a2c14'],                // fass, schatzkiste, steuerrad
 metall:['#b0b0b8','#5e5e66','#26262c'],              // anker, Fassreifen
 gold:['#fff2a8','#ffc53d','#a8700e'], seil:'#d8bc84', // schatzkiste / Tau am Anker
 muschel:['#fff4ea','#ffb9a0','#d27a62'],
 fels:['#8a847c','#5a554f','#2e2b28'], glutRiss:null, // fels; glutRiss = '#hex' → glühender Riss im Fels
 glut:['#fff2a0','#ff8a2a','#b02a06'],                // glutstein, Schlot unter rauch
 rauch:['#a29c96','#4a4440'],                         // [hell, dunkel] der Rauchwolken
 kristall:['#e8f6ff','#7fd0ff','#2a6fb0'],
 duerr:['#8a7a68','#5a4a3a','#2a2018']                // duerrbaum (Äste hell, mittel, dunkel)
};
for(const k in THEMEN)THEMEN[k].deko=Object.assign({},DEKO_STANDARD,THEMEN[k].deko);
const eigen=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);   // schützt vor typ:'constructor' u. ä.
const thema=id=>eigen(THEMEN,id)?THEMEN[id]:THEMEN.park;

/* ---------- 3. Kleine Helfer ---------- */
const mod=(a,n)=>((a%n)+n)%n;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function hashText(s){s=String(s);let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
/* Fester Zufall (mulberry32): gleiche Bahn → gleiche Blumen, Körner, Sterne. */
function zufall(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const jetzt=()=>(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();

/* Farben: '#rrggbb' → [r,g,b]; rgba('#hex',a); mische(a,b,f) → '#hex' */
const rgbMerk={};
function rgb(hex){
 let m=rgbMerk[hex];if(m)return m;
 let h=String(hex||'#000').replace('#','');
 if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
 const n=parseInt(h.slice(0,6),16)||0;
 return rgbMerk[hex]=[(n>>16)&255,(n>>8)&255,n&255];
}
const rgba=(hex,a)=>{const c=rgb(hex);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+(+a).toFixed(3)+')'};
function mische(h1,h2,f){
 const a=rgb(h1),b=rgb(h2);f=clamp(f,0,1);
 let s='#';for(let i=0;i<3;i++)s+=Math.round(a[i]+(b[i]-a[i])*f).toString(16).padStart(2,'0');
 return s;
}
const istHex=s=>typeof s==='string'&&/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);

/* Geometrie (Punkte als [x,y]) */
function punkte(arr,offen){
 const p=[];if(!Array.isArray(arr))return p;
 for(let i=0;i+1<arr.length;i+=2){
  const x=+arr[i],y=+arr[i+1];if(!isFinite(x)||!isFinite(y))continue;
  const l=p[p.length-1];if(!l||l[0]!==x||l[1]!==y)p.push([x,y]);
 }
 if(!offen&&p.length>2){const a=p[0],b=p[p.length-1];if(a[0]===b[0]&&a[1]===b[1])p.pop()}
 return p;
}
function flaecheVz(p){let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1]}return s}
function imPoly(x,y,p){
 let inn=false;
 for(let i=0,j=p.length-1;i<p.length;j=i++){
  const xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inn=!inn;
 }
 return inn;
}
function abstSeg(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;
 const u=l?clamp(((px-ax)*dx+(py-ay)*dy)/l,0,1):0;
 return Math.hypot(ax+dx*u-px,ay+dy*u-py);
}
function abstPoly(x,y,p){let m=1e9;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];const d=abstSeg(x,y,a[0],a[1],b[0],b[1]);if(d<m)m=d}return m}
function boxVon(p){
 if(!p.length)return{x:0,y:0,b:0,h:0,cx:0,cy:0,r:0};
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const q of p){if(q[0]<x0)x0=q[0];if(q[0]>x1)x1=q[0];if(q[1]<y0)y0=q[1];if(q[1]>y1)y1=q[1]}
 return{x:x0,y:y0,b:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2,r:Math.min(x1-x0,y1-y0)/2};
}
const normiert=v=>{v=Array.isArray(v)?v:[0,1];const l=Math.hypot(+v[0]||0,+v[1]||0)||1;return[(+v[0]||0)/l,(+v[1]||0)/l]};
/* Außen-Normale einer Kante a→b (vz = Umlaufsinn des Polygons) */
function normale(a,b,vz){const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return vz>0?[dy/l,-dx/l]:[-dy/l,dx/l]}
/* Polygon um d nach außen versetzen (Gehrung, begrenzt gegen Spitzen) */
function versatzPunkte(p,vz,d){
 const n=p.length,out=new Array(n);
 for(let i=0;i<n;i++){
  const a=p[(i-1+n)%n],m=p[i],b=p[(i+1)%n];
  const n1=normale(a,m,vz),n2=normale(m,b,vz);
  let mx=n1[0]+n2[0],my=n1[1]+n2[1];const ml=Math.hypot(mx,my)||1;mx/=ml;my/=ml;
  let dd=mx*n1[0]+my*n1[1];if(dd<0.35)dd=0.35;
  out[i]=[m[0]+mx*d/dd,m[1]+my*d/dd];
 }
 return out;
}

/* Formen der Zonen: {kreis:[x,y,r]} | {rect:[x,y,b,h]} | {poly:[x1,y1,…]} */
function formBox(f){
 f=f||{};
 if(f.kreis){const[x,y,r]=f.kreis.map(Number);return{x:x-r,y:y-r,b:2*r,h:2*r,cx:x,cy:y,r}}
 if(f.rect){const[x,y,b,h]=f.rect.map(Number);return{x,y,b,h,cx:x+b/2,cy:y+h/2,r:Math.min(b,h)/2}}
 return boxVon(punkte(f.poly));
}
function inForm(f,x,y){
 f=f||{};
 if(f.kreis){const[a,b,r]=f.kreis;return Math.hypot(x-a,y-b)<=r}
 if(f.rect){const[a,b,w,h]=f.rect;return x>=a&&x<=a+w&&y>=b&&y<=b+h}
 const p=punkte(f.poly);return p.length>2&&imPoly(x,y,p);
}
function polyPfad(p,zu){
 const q=new Path2D();
 p.forEach((v,i)=>i?q.lineTo(v[0],v[1]):q.moveTo(v[0],v[1]));
 if(zu)q.closePath();
 return q;
}
function formPfad(f){
 f=f||{};const q=new Path2D();
 if(f.kreis){const[x,y,r]=f.kreis;q.arc(x,y,Math.max(0,r),0,TAU);q.closePath();return q}
 if(f.rect){const[x,y,b,h]=f.rect;q.rect(x,y,b,h);return q}
 return polyPfad(punkte(f.poly),true);
}
const boxUeber=(a,b)=>a.x<=b.x+b.b&&b.x<=a.x+a.b&&a.y<=b.y+b.h&&b.y<=a.y+a.h;

/* Geometrie einer Bahn, einmal berechnet (WeakMap: hängt am Bahn-Objekt). */
let geoMerk=new WeakMap();
function geometrie(bahn){
 let g=geoMerk.get(bahn);if(g)return g;
 const rp=punkte(bahn.rand);
 const R=zufall(hashText(String(bahn.id)+'|geo'));
 const zonen=(Array.isArray(bahn.zonen)?bahn.zonen:[]).filter(z=>z&&z.form).map((z,i)=>{
  const pfad=formPfad(z.form),inv=new Path2D();
  inv.rect(-6000,-6000,13000,13500);inv.addPath(pfad);          // „alles außer dieser Zone“ (evenodd)
  const box=formBox(z.form),glitzer=[],blasen=[];
  for(let v=0;v<240&&glitzer.length<18;v++){const x=box.x+R()*box.b,y=box.y+R()*box.h;if(inForm(z.form,x,y))glitzer.push([x,y,R()*TAU,.6+R()*.9])}
  for(let k=0;k<7;k++)blasen.push([R(),R(),.5+R(),R()*TAU]);
  // Zusatzblasen für kräftige Lava (eigener Zufall, damit sich die übrigen Themen nicht ändern)
  const R2=zufall(hashText(String(bahn.id)+'|blasen'+i)),blasen2=[];
  for(let v=0;v<80&&blasen2.length<9;v++){const x=box.x+R2()*box.b,y=box.y+R2()*box.h;if(inForm(z.form,x,y))blasen2.push([x,y,.6+R2()*.9,R2(),2.5+R2()*4])}
  return{z,i,pfad,inv,box,glitzer,blasen,blasen2,spaeter:[]};
 });
 zonen.forEach((a,i)=>{for(let j=i+1;j<zonen.length;j++)if(boxUeber(a.box,zonen[j].box))a.spaeter.push(zonen[j])});
 const nr=(String(bahn.id||'').match(/(\d+)\s*$/)||[])[1]||'';
 g={rand:rp,randPfad:rp.length>2?polyPfad(rp,true):null,randBox:boxVon(rp),vz:flaecheVz(rp)>=0?1:-1,zonen,nr};
 geoMerk.set(bahn,g);
 return g;
}

/* Zeichen-Helfer */
function rundRechteck(c,x,y,b,h,r){
 r=Math.max(0,Math.min(r,Math.abs(b)/2,Math.abs(h)/2));
 c.beginPath();c.moveTo(x+r,y);c.arcTo(x+b,y,x+b,y+h,r);c.arcTo(x+b,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+b,y,r);c.closePath();
}
function kreis(c,x,y,r){c.beginPath();c.arc(x,y,Math.max(0,r),0,TAU)}
/* Kugel mit Licht oben links (im aktuellen Koordinatensystem) */
function kugel(c,x,y,r,hell,farbe,dunkel){
 const g=c.createRadialGradient(x-r*.35,y-r*.4,r*.05,x,y,r*1.05);
 g.addColorStop(0,hell);g.addColorStop(.55,farbe);g.addColorStop(1,dunkel);
 c.fillStyle=g;kreis(c,x,y,r);c.fill();
}
/* weicher ovaler Schatten (ohne shadowBlur, darum auch pro Bild billig) */
function schattenOval(c,x,y,rx,ry,a){
 c.save();c.translate(x,y);c.scale(Math.max(.01,rx),Math.max(.01,ry));
 const g=c.createRadialGradient(0,0,0,0,0,1);
 g.addColorStop(0,'rgba(0,0,0,'+a+')');g.addColorStop(.55,'rgba(0,0,0,'+(a*.6).toFixed(3)+')');g.addColorStop(1,'rgba(0,0,0,0)');
 c.fillStyle=g;kreis(c,0,0,1);c.fill();c.restore();
}
function sternPfad(c,x,y,ra,ri,n,rot){
 c.beginPath();
 for(let i=0;i<2*n;i++){const r=i%2?ri:ra,a=rot+i*Math.PI/n;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?c.lineTo(px,py):c.moveTo(px,py)}
 c.closePath();
}
function viereck(c,a,b,d,e,farbe){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.lineTo(e[0],e[1]);c.closePath();c.fillStyle=farbe;c.fill()}
/* schräge Warnstreifen in ein Rechteck (Clip vorher setzen) */
function streifen(c,x,y,b,h,breite,farbe){
 c.fillStyle=farbe;c.beginPath();
 for(let k=-h;k<b+h;k+=2*breite){c.moveTo(x+k,y+h);c.lineTo(x+k+h,y);c.lineTo(x+k+h+breite,y);c.lineTo(x+k+breite,y+h);c.closePath()}
 c.fill();
}

/* ---------- 4. Kamera ----------
   Feld 1000×1500 komplett ins Canvas (mit kleinem Rand), Seitenverhältnis bleibt.
   dreh=true: Feld 90° im Uhrzeigersinn gedreht → oben (Loch) liegt rechts,
   unten (Abschlag) links. Das Canvas außerhalb des Feldes füllt der Hintergrund.
   bahn wird (noch) nicht gebraucht – Platz für späteren Zoom auf die Bahn. */
/* Zoomt auf die Bahn selbst (Umriss von rand + Abschlag + Loch, 70 Rand), nicht aufs ganze
   1000×1500-Feld – so wird der Ball auf dem Handy so groß wie möglich. Ohne rand: ganzes Feld. */
function bahnRahmen(bahn){
 const r=bahn&&bahn.rand;if(!r||r.length<6)return{x0:0,y0:0,x1:FELD_B,y1:FELD_H};
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const nimm=(x,y)=>{if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y};
 for(let i=0;i+1<r.length;i+=2)nimm(r[i],r[i+1]);if(bahn.start)nimm(bahn.start.x,bahn.start.y);if(bahn.loch)nimm(bahn.loch.x,bahn.loch.y);
 const m=70;return{x0:x0-m,y0:y0-m,x1:x1+m,y1:y1+m};
}
function kamera(bahn,cssB,cssH,dreh){
 dreh=!!dreh;cssB=Math.max(1,+cssB||1);cssH=Math.max(1,+cssH||1);
 const rb=bahnRahmen(bahn),bw=rb.x1-rb.x0,bh=rb.y1-rb.y0,cx=(rb.x0+rb.x1)/2,cy=(rb.y0+rb.y1)/2;
 const fb=dreh?bh:bw,fh=dreh?bw:bh;
 const pad=Math.max(4,Math.min(cssB,cssH)*.02);
 const skala=Math.max(1e-6,Math.min((cssB-2*pad)/fb,(cssH-2*pad)/fh,1.4));
 const ox=dreh?cssB/2-(FELD_H-cy)*skala:cssB/2-cx*skala,oy=dreh?cssH/2-cx*skala:cssH/2-cy*skala;
 // Matrix für ctx.setTransform (CSS-Pixel): px = a·x + c·y + e, py = b·x + d·y + f
 const matrix=dreh?[0,skala,-skala,0,ox+FELD_H*skala,oy]:[skala,0,0,skala,ox,oy];
 return{
  skala,dreh,breite:cssB,hoehe:cssH,ox,oy,matrix,
  schatten:dreh?[1,-1]:[1,1],   // Feld-Vektor für „unten rechts am Bildschirm“
  feldZuBild(x,y){return dreh?[ox+(FELD_H-y)*skala,oy+x*skala]:[ox+x*skala,oy+y*skala]},
  bildZuFeld(px,py){return dreh?[(py-oy)/skala,FELD_H-(px-ox)/skala]:[(px-ox)/skala,(py-oy)/skala]}
 };
}
function setzeFeld(c,kam,pr){const m=kam.matrix;c.setTransform(m[0]*pr,m[1]*pr,m[2]*pr,m[3]*pr,m[4]*pr,m[5]*pr)}
/* Koordinaten so drehen, dass lokal „oben“ = oben am Bildschirm */
function aufrecht(c,kam,x,y){c.translate(x,y);if(kam.dreh)c.rotate(-Math.PI/2)}
/* Feld-Richtung → Bildschirm-Richtung; Lichtfaktor −1..1 (1 = zeigt zum Licht oben links) */
const bildRichtung=(kam,n)=>kam.dreh?[-n[1],n[0]]:n;
const lichtFaktor=(kam,n)=>{const s=bildRichtung(kam,n);return-(s[0]+s[1])*Math.SQRT1_2};

/* ---------- 5. Statische Ebene ---------- */
let cache=new Map();
function neuesCanvas(b,h){
 if(typeof document!=='undefined'&&document.createElement){const c=document.createElement('canvas');c.width=b;c.height=h;return c}
 if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(b,h);
 throw new Error('GRAFIK: kein Canvas verfügbar (nur im Browser nutzbar)');
}
function standardPR(){return(typeof window!=='undefined'&&window.devicePixelRatio)||1}
function holeEbene(bahn,platzId,kam,pr){
 pr=+pr||1;
 const th=thema(platzId);
 const key=[bahn.id,platzId,Math.round(kam.breite*100),Math.round(kam.hoehe*100),kam.dreh?1:0,pr.toFixed(3)].join('|');
 let e=cache.get(key);
 if(e&&e.bahn===bahn&&e.th===th){cache.delete(key);cache.set(key,e);return e}   // zuletzt benutzt → ans Ende
 e=baueEbene(bahn,platzId,kam,pr);e.bahn=bahn;e.th=th;
 cache.set(key,e);
 while(cache.size>CACHE_MAX)cache.delete(cache.keys().next().value);
 return e;
}
function vorbereiten(bahn,platzId,kam,pixelRatio){return holeEbene(bahn,platzId,kam,pixelRatio||standardPR()).canvas}

/* g = Zeichen-Umgebung für die statische Ebene:
   c ctx, th Thema, kam Kamera, pr pixelRatio, k Bildpunkte je Einheit,
   sv Schatten-Vektor im Feld, geo Geometrie, R fester Zufall, sicht sichtbares Feldrechteck */
function baueEbene(bahn,platzId,kam,pr){
 const B=Math.max(1,Math.round(kam.breite*pr)),H=Math.max(1,Math.round(kam.hoehe*pr));
 const cv=neuesCanvas(B,H),c=cv.getContext('2d');
 const th=thema(platzId),geo=geometrie(bahn);
 const g={c,th,kam,pr,k:kam.skala*pr,sv:kam.schatten,geo,bahn,R:zufall(hashText(String(bahn.id)+'|'+platzId)),
  // was pro Bild bewegt wird (Abschnitt 7): Wellenkronen, Glutfunken, Lavaflüsse, animierte Deko, Clip „außerhalb der Bahn“
  anim:{wellen:[],glut:[],fluesse:[],deko:[],aussen:null}};
 if(geo.randPfad){const q=new Path2D();q.rect(-6000,-6000,13000,13500);q.addPath(polyPfad(versatzPunkte(geo.rand,geo.vz,RAND_DICKE),true));g.anim.aussen=q}
 c.fillStyle=th.hintergrund.basis;c.fillRect(0,0,B,H);
 setzeFeld(c,kam,pr);
 const ecken=[kam.bildZuFeld(0,0),kam.bildZuFeld(kam.breite,0),kam.bildZuFeld(0,kam.hoehe),kam.bildZuFeld(kam.breite,kam.hoehe)];
 const xs=ecken.map(e=>e[0]),ys=ecken.map(e=>e[1]);
 g.sicht={x:Math.min(...xs)-6,y:Math.min(...ys)-6};g.sicht.b=Math.max(...xs)-g.sicht.x+12;g.sicht.h=Math.max(...ys)-g.sicht.y+12;

 hintergrund(g);
 streuen(g);
 const funkeln=funkelPunkte(g);
 const hm=th.hintergrund;
 if(hm.muster==='meer')g.anim.wellen=streuPunkte(g,Math.min(26,Math.round(g.sicht.b*g.sicht.h/70000)),150,'|wellen');
 if(hm.glutPartikel)g.anim.glut=streuPunkte(g,hm.glutPartikel|0,RAND_DICKE+14,'|glut');
 if(geo.randPfad){bandeAussen(g);rasen(g)}
 geo.zonen.forEach(zg=>zoneStatisch(g,zg));
 if(geo.randPfad){
  innerSchatten(g,geo.randPfad,th.schatten,11,4);                // Banden werfen Schatten auf den Rasen
  if(th.bande.neon){
   innerSchatten(g,geo.randPfad,rgba(th.bande.neon,.55),20,0);    // Innenglühen der Plattform
   c.save();c.strokeStyle=th.bande.neon;c.lineWidth=2.4;c.shadowColor=th.bande.neon;c.shadowBlur=9*g.k;c.stroke(geo.randPfad);c.restore();
  }
 }
 objekteStatisch(g);
 waende(g);
 abschlag(g);
 lochStatisch(g);
 dekoAlle(g);
 // Vignette (Bildschirm)
 c.setTransform(1,0,0,1,0,0);
 const vg=c.createRadialGradient(B/2,H/2,Math.min(B,H)*.38,B/2,H/2,Math.hypot(B,H)/2*1.02);
 vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,'+(th.vignette||0)+')');
 c.fillStyle=vg;c.fillRect(0,0,B,H);
 return{canvas:cv,funkeln,anim:g.anim};
}

/* Schatten in Bildpunkten (wirken unabhängig von der Drehung immer nach unten rechts) */
function schattenAn(g,farbe,blurE,versatzE){const c=g.c;c.shadowColor=farbe;c.shadowBlur=blurE*g.k;c.shadowOffsetX=versatzE*g.k;c.shadowOffsetY=versatzE*g.k}
function schattenAus(c){c.shadowColor='rgba(0,0,0,0)';c.shadowBlur=0;c.shadowOffsetX=0;c.shadowOffsetY=0}
/* Schatten INNERHALB eines Pfads (Mulde): wir füllen „alles außer dem Pfad“ und lassen nur den Schatten in den Pfad fallen. */
function innerSchatten(g,pfad,farbe,blurE,versatzE){
 const c=g.c;c.save();c.clip(pfad);
 const p=new Path2D();p.rect(-6000,-6000,13000,13500);p.addPath(pfad);
 schattenAn(g,farbe,blurE,versatzE);c.fillStyle='#000';c.fill(p,'evenodd');
 c.restore();
}

/* Hintergrund außerhalb der Bahn */
function hintergrund(g){
 const{c,th,R}=g,h=th.hintergrund,s=g.sicht,fl=s.b*s.h;
 const lg=c.createLinearGradient(s.x,s.y,s.x+s.b*.35,s.y+s.h);
 lg.addColorStop(0,h.hell);lg.addColorStop(.45,h.basis);lg.addColorStop(1,h.dunkel);
 c.fillStyle=lg;c.fillRect(s.x,s.y,s.b,s.h);
 const zp=()=>[s.x+R()*s.b,s.y+R()*s.h];
 const fleck=(x,y,r,farbe,a)=>{const rg=c.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,rgba(farbe,a));rg.addColorStop(1,rgba(farbe,0));c.fillStyle=rg;c.fillRect(x-r,y-r,2*r,2*r)};
 if(h.muster==='wiese'){
  for(let i=0;i<Math.min(70,fl/36000);i++){const p=zp();fleck(p[0],p[1],90+R()*170,R()<.5?h.hell:h.dunkel,.32)}
 }else if(h.muster==='duenen'){
  for(let i=0;i<Math.min(30,fl/80000);i++){const p=zp();fleck(p[0],p[1],140+R()*220,R()<.5?h.hell:h.dunkel,.35)}
  for(let y0=s.y-30;y0<s.y+s.h+40;y0+=50+R()*45){       // Rippel-Dünen: Schattenband + heller Kamm
   const ph=R()*TAU,amp=8+R()*16,fq=.003+R()*.004,dick=10+R()*16,xs=[];
   for(let x=s.x-30;x<=s.x+s.b+30;x+=24)xs.push([x,y0+Math.sin(x*fq+ph)*amp]);
   c.beginPath();xs.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));
   for(let i=xs.length-1;i>=0;i--){const q=xs[i];c.lineTo(q[0],q[1]+dick*(.55+.45*Math.sin(q[0]*fq*1.7+ph)))}
   c.closePath();c.fillStyle=rgba(h.dunkel,.2);c.fill();
   c.beginPath();xs.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));
   c.strokeStyle=rgba(h.hell,.55);c.lineWidth=2.2;c.stroke();
  }
 }else if(h.muster==='schnee'){
  for(let i=0;i<Math.min(60,fl/40000);i++){const p=zp();fleck(p[0],p[1],80+R()*180,R()<.55?h.hell:h.dunkel,R()<.55?.6:.3)}
  c.lineCap='round';c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=3;c.beginPath();
  for(let i=0;i<Math.min(90,fl/25000);i++){const p=zp(),l=30+R()*60;c.moveTo(p[0],p[1]);c.quadraticCurveTo(p[0]+l*.5,p[1]-6,p[0]+l,p[1]-2)}
  c.stroke();
 }else if(h.muster==='all'){
  c.save();c.globalCompositeOperation='lighter';
  const neb=h.nebel||['#7b3dff'];
  for(let i=0;i<9;i++){const p=zp();fleck(p[0],p[1],220+R()*380,neb[i%neb.length],.13+R()*.1)}
  c.restore();
  const n=Math.min(1100,Math.round(fl/1900)),farben=['#ffffff','#cfe8ff','#ffe9c8','#e0d4ff'];
  for(let f=0;f<farben.length;f++){
   c.fillStyle=farben[f];c.beginPath();
   for(let i=f;i<n;i+=farben.length){const p=zp(),r=R()<.93?.6+R()*1.1:1.8+R()*1.4;c.moveTo(p[0]+r,p[1]);c.arc(p[0],p[1],r,0,TAU)}
   c.globalAlpha=.85;c.fill();c.globalAlpha=1;
  }
  for(let i=0;i<Math.min(24,fl/90000);i++){                 // ein paar große Sterne mit Strahlen
   const p=zp(),r=2+R()*2;fleck(p[0],p[1],r*7,'#bfe6ff',.35);
   c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=1;c.beginPath();
   c.moveTo(p[0]-r*5,p[1]);c.lineTo(p[0]+r*5,p[1]);c.moveTo(p[0],p[1]-r*5);c.lineTo(p[0],p[1]+r*5);c.stroke();
   c.fillStyle='#ffffff';kreis(c,p[0],p[1],r*.8);c.fill();
  }
 }else if(h.muster==='meer'){
  const rp=g.geo.rand,hat=rp.length>2;
  for(let i=0;i<Math.min(40,fl/60000);i++){const p=zp();fleck(p[0],p[1],120+R()*220,R()<.5?h.hell:h.dunkel,.3)}   // Tiefe
  for(let i=0;i<Math.min(5,Math.max(1,fl/500000));i++){                           // Sandbänke im Meer
   const p=zp();if(hat&&abstPoly(p[0],p[1],rp)<260)continue;
   const r=50+R()*80;fleck(p[0],p[1],r*2.4,h.flach,.7);fleck(p[0],p[1],r,h.strand,.9);
  }
  c.lineCap='round';                                                               // Wellen (fest)
  const hell=new Path2D(),tal=new Path2D();
  for(let i=0;i<Math.min(320,fl/7000);i++){
   const p=zp(),l=18+R()*34;if(hat&&abstPoly(p[0],p[1],rp)<140)continue;
   hell.moveTo(p[0],p[1]);hell.quadraticCurveTo(p[0]+l/2,p[1]-5,p[0]+l,p[1]);
   tal.moveTo(p[0]+2,p[1]+4);tal.quadraticCurveTo(p[0]+l/2+2,p[1]-1,p[0]+l+2,p[1]+4);
  }
  c.strokeStyle=rgba(h.dunkel,.22);c.lineWidth=2.4;c.stroke(tal);
  c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=1.8;c.stroke(hell);
  if(hat)kueste(g);
 }else if(h.muster==='basalt')basaltGrund(g);
}
/* Insel-Küste um die Bahn (nur 'meer'): Kreise entlang rand mit welligem Radius, Schicht für Schicht
   Flachwasser → Schaumkante → nasser Strand → trockener Strand. Je Schicht EIN Pfad (Vereinigung). */
function kueste(g){
 const{c,th,R,geo}=g,h=th.hintergrund,p=geo.rand,n=p.length,kreise=[],ph=R()*TAU;
 let weg=0;
 for(let i=0;i<n;i++){
  const a=p[i],b=p[(i+1)%n],L=Math.hypot(b[0]-a[0],b[1]-a[1]),k=Math.max(1,Math.ceil(L/30));
  for(let s=0;s<k;s++){const u=s/k;weg+=L/k;kreise.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,64+Math.sin(weg*.011+ph)*12+Math.sin(weg*.037+ph*2)*5+R()*5])}
 }
 const schicht=(plus,farbe,blur)=>{
  const q=new Path2D();
  for(const k of kreise){const r=Math.max(4,k[2]+plus);q.moveTo(k[0]+r,k[1]);q.arc(k[0],k[1],r,0,TAU)}
  c.save();if(blur)schattenAn(g,farbe,blur,0);c.fillStyle=farbe;c.fill(q);c.restore();
 };
 schicht(78,h.flach,40);
 schicht(44,mische(h.flach,h.strand,.4),22);
 schicht(11,rgba(h.schaum,.85),5);
 schicht(4,h.strandNass,0);
 schicht(-9,h.strand,0);
 const kp=new Path2D(),kh=new Path2D();                                           // Körnung
 for(let i=0;i<Math.min(2200,kreise.length*14);i++){
  const k=kreise[Math.floor(R()*kreise.length)],a=R()*TAU,r=R()*(k[2]-12),x=k[0]+Math.cos(a)*r,y=k[1]+Math.sin(a)*r,s=.8+R()*1.1;
  (R()<.55?kp:kh).rect(x,y,s,s);
 }
 c.fillStyle=rgba(h.strandNass,.7);c.fill(kp);c.fillStyle='rgba(255,255,255,.55)';c.fill(kh);
}
/* Basalt (nur 'basalt'): Säulen-Sechsecke in 4 Tönungen mit Licht-/Schattenkanten,
   glühende Risse und Lavaflüsse (deren Pfade merkt sich g.anim.fluesse fürs Fließen pro Bild). */
function basaltGrund(g){
 const{c,th,R,sv}=g,h=th.hintergrund,s=g.sicht,fl=s.b*s.h;
 c.fillStyle=h.dunkel;c.fillRect(s.x,s.y,s.b,s.h);
 const S=44,dx=S*Math.sqrt(3),dy=S*1.5,ri=S*.92;
 const ton=[mische(h.basis,h.hell,.45),mische(h.basis,h.hell,.15),h.basis,mische(h.basis,h.dunkel,.35)];
 const pf=ton.map(()=>new Path2D()),licht=new Path2D(),schatten=new Path2D(),L=[-sv[0]*Math.SQRT1_2,-sv[1]*Math.SQRT1_2];
 for(let row=0,y=s.y-S;y<s.y+s.h+S;y+=dy,row++)for(let x=s.x-S+(row%2)*dx/2;x<s.x+s.b+S;x+=dx){
  const p=pf[Math.floor(R()*4)],v=[],r=ri*(.94+R()*.06);
  for(let k=0;k<6;k++){const a=-Math.PI/2+k*Math.PI/3;v.push([x+Math.cos(a)*r,y+Math.sin(a)*r])}
  v.forEach((q,k)=>k?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1]));p.closePath();
  for(let k=0;k<6;k++){
   const a=-Math.PI/3+k*Math.PI/3,d=Math.cos(a)*L[0]+Math.sin(a)*L[1],q1=v[k],q2=v[(k+1)%6];
   const z=d>.35?licht:d<-.35?schatten:null;if(z){z.moveTo(q1[0],q1[1]);z.lineTo(q2[0],q2[1])}
  }
 }
 ton.forEach((f,i)=>{c.fillStyle=f;c.fill(pf[i])});
 c.lineWidth=2.2;c.lineCap='round';c.strokeStyle=rgba(h.hell,.4);c.stroke(licht);c.strokeStyle='rgba(0,0,0,.4)';c.stroke(schatten);
 const asche=new Path2D();for(let i=0;i<Math.min(1600,fl/1400);i++){const r=.8+R()*1.2;asche.rect(s.x+R()*s.b,s.y+R()*s.h,r,r)}
 c.fillStyle=rgba(h.hell,.45);c.fill(asche);
 const lg=c.createLinearGradient(s.x,s.y,s.x+s.b*.35,s.y+s.h);lg.addColorStop(0,'rgba(255,255,255,.05)');lg.addColorStop(1,'rgba(0,0,0,.25)');
 c.fillStyle=lg;c.fillRect(s.x,s.y,s.b,s.h);
 // glühende Risse: Zickzack in den Richtungen der Säulenfugen (30°, 90°, 150° …)
 const riss=new Path2D();
 for(let i=0;i<Math.min(16,Math.max(5,fl/140000));i++){
  let x=s.x+R()*s.b,y=s.y+R()*s.h,a=Math.floor(R()*6);riss.moveTo(x,y);
  for(let k=0,m=5+Math.floor(R()*7);k<m;k++){a=mod(a+(R()<.5?1:-1),6);const w=Math.PI/6+a*Math.PI/3,l=S*(.5+R()*.5);x+=Math.cos(w)*l;y+=Math.sin(w)*l;riss.lineTo(x,y)}
 }
 c.save();c.lineJoin='round';c.lineCap='round';
 schattenAn(g,h.glut,10,0);c.strokeStyle=rgba(h.glut,.9);c.lineWidth=2.6;c.stroke(riss);schattenAus(c);
 c.strokeStyle=rgba(h.glutHell,.9);c.lineWidth=1;c.stroke(riss);
 c.restore();
 // Lavaflüsse quer durchs Bild (verschwinden unter der Bahn)
 const nF=fl>1.6e6?2:1;
 for(let i=0;i<nF;i++){
  let x,y,a;
  if(R()<.5){x=s.x-60;y=s.y+s.h*(.15+R()*.7);a=(R()-.5)*.8}else{x=s.x+s.b*(.15+R()*.7);y=s.y-60;a=Math.PI/2+(R()-.5)*.8}
  const a0=a,pts=[];
  for(let k=0;k<500;k++){
   pts.push([x,y]);a=a0+clamp(a-a0+(R()-.5)*.5,-.9,.9);x+=Math.cos(a)*28;y+=Math.sin(a)*28;
   if(x<s.x-80||x>s.x+s.b+80||y<s.y-80||y>s.y+s.h+80){pts.push([x,y]);break}
  }
  const fp=new Path2D();fp.moveTo(pts[0][0],pts[0][1]);
  for(let k=1;k<pts.length-1;k++)fp.quadraticCurveTo(pts[k][0],pts[k][1],(pts[k][0]+pts[k+1][0])/2,(pts[k][1]+pts[k+1][1])/2);
  fp.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
  g.anim.fluesse.push(fp);
  c.save();c.lineCap='round';c.lineJoin='round';
  c.strokeStyle=mische(h.dunkel,'#000000',.4);c.lineWidth=56;c.stroke(fp);                    // erstarrter Rand
  schattenAn(g,h.glut,26,0);c.strokeStyle=mische(h.glut,'#5a0d02',.45);c.lineWidth=42;c.stroke(fp);schattenAus(c);
  c.strokeStyle=h.glut;c.lineWidth=28;c.stroke(fp);
  c.strokeStyle=rgba(h.glutHell,.85);c.lineWidth=9;c.stroke(fp);
  const scholle=new Path2D();                                                                   // treibende Krustenschollen
  for(const q of pts){if(R()<.45)continue;const r=4+R()*6,ox=(R()-.5)*22,oy=(R()-.5)*22;
   for(let k=0;k<6;k++){const w=k*TAU/6,rr=r*(.7+R()*.4),px=q[0]+ox+Math.cos(w)*rr,py=q[1]+oy+Math.sin(w)*rr;k?scholle.lineTo(px,py):scholle.moveTo(px,py)}scholle.closePath()}
  c.fillStyle=rgba(mische(h.dunkel,h.glut,.18),.9);c.fill(scholle);
  c.restore();
 }
}
/* Kleinkram im Hintergrund (Blumen, Halme, Kiesel, Schneehügel, Muscheln, Glutkrümel …) – nie auf der Bahn */
function streuen(g){
 const{c,th,R,geo}=g,s=g.sicht,art=th.hintergrund.muster,rp=geo.rand,hat=rp.length>2,d=th.deko,h=th.hintergrund;
 const n=Math.min(460,Math.round(s.b*s.h/5000));
 for(let i=0;i<n;i++){
  const x=s.x+R()*s.b,y=s.y+R()*s.h;
  if(hat&&(imPoly(x,y,rp)||abstPoly(x,y,rp)<RAND_DICKE+10))continue;
  const w=R();
  c.save();aufrecht(c,g.kam,x,y);
  if(art==='wiese'){
   if(w<.36){const s2=.45+R()*.3;c.scale(s2,s2);DEKO.blume(c,d,R,g)}
   else if(w<.9)halmBuschel(c,h.hell,h.dunkel,R);
   else{c.fillStyle=rgba(d.busch[0],.8);for(let k=0;k<3;k++){kreis(c,Math.cos(k*2.1)*3.2,Math.sin(k*2.1)*3.2,3);c.fill()}}
  }else if(art==='duenen'){
   if(w<.45){schattenOval(c,1.5,2,6,4,.3);kugel(c,0,0,3+R()*2.5,d.stein[0],d.stein[1],d.stein[2])}
   else if(w<.8)halmBuschel(c,'#e8c878','#8a6a2a',R);
   else if(w<.86){c.scale(.45,.45);DEKO.kaktus(c,d,R,g)}
  }else if(art==='schnee'){
   if(w<.5){const r=4+R()*7;schattenOval(c,2,3,r*1.2,r,.18);kugel(c,0,0,r,'#ffffff','#f4f9ff','#bcd3e8')}
   else if(w<.62){c.globalAlpha=.7;c.scale(.35,.35);DEKO.eiskristall(c,d,R,g)}
   else if(w<.7){schattenOval(c,2,2,6,4,.25);kugel(c,0,0,3.5,d.stein[0],d.stein[1],d.stein[2]);c.fillStyle='#ffffff';kreis(c,-1,-1.6,2.2);c.fill()}
  }else if(art==='all'){
   if(w<.07){const s2=.35+R()*.3;c.scale(s2,s2);DEKO.stein(c,d,R,g)}
  }else if(art==='meer'){                                   // nur am Strand (schmaler Ring um die Bahn)
   if(hat&&abstPoly(x,y,rp)<50){
    if(w<.22){const s2=.4+R()*.25;c.scale(s2,s2);DEKO.muschel(c,d,R,g)}
    else if(w<.5){schattenOval(c,1.5,2,5,4,.25);kugel(c,0,0,2.2+R()*2,d.stein[0],d.stein[1],d.stein[2])}
    else if(w<.56){c.rotate(R()*TAU);sternPfad(c,1,1.5,7,2.8,5,0);c.fillStyle='rgba(0,0,0,.2)';c.fill();
     sternPfad(c,0,0,7,2.8,5,0);c.fillStyle='#ff8a5a';c.fill();c.fillStyle='rgba(255,240,220,.8)';for(let k=0;k<5;k++){kreis(c,Math.cos(k*TAU/5)*3.4,Math.sin(k*TAU/5)*3.4,.7);c.fill()}}
   }
  }else if(art==='basalt'){
   if(w<.14){schattenOval(c,1.5,2,6,4,.35);kugel(c,0,0,2.5+R()*2.5,d.stein[0],d.stein[1],d.stein[2])}
   else if(w<.24){const gl=d.glut,r=1+R()*1.3;const rg=c.createRadialGradient(0,0,0,0,0,r*5);rg.addColorStop(0,rgba(gl[1],.5));rg.addColorStop(1,rgba(gl[1],0));
    c.fillStyle=rg;kreis(c,0,0,r*5);c.fill();c.fillStyle=gl[0];kreis(c,0,0,r);c.fill()}
   else if(w<.27){c.scale(.3,.3);DEKO.kristall(c,d,R,g)}
  }
  c.restore();
 }
}
function halmBuschel(c,hell,dunkel,R){
 c.lineCap='round';c.lineWidth=1.5;
 for(let k=0;k<2;k++){
  c.strokeStyle=k?rgba(hell,.85):rgba(dunkel,.55);c.beginPath();
  for(let i=0;i<5;i++){const a=-Math.PI/2+(i-2)*.32+(R()-.5)*.2,l=6+R()*5,ox=k?-.6:.6;c.moveTo(ox,0);c.quadraticCurveTo(ox+Math.cos(a)*l*.5,Math.sin(a)*l*.6,ox+Math.cos(a)*l,Math.sin(a)*l)}
  c.stroke();
 }
}
/* Funkelnde Pünktchen im Hintergrund (werden pro Bild gemalt) */
function funkelPunkte(g){
 const h=g.th.hintergrund;
 return streuPunkte(g,h.funkeln|0,+h.funkelAbstand||RAND_DICKE+6,'|funkeln');
}
/* n feste Zufallspunkte außerhalb der Bahn (Mindestabstand abst zu rand): [x, y, groesse, phase, tempo] */
function streuPunkte(g,n,abst,salz){
 const out=[];if(!(n>0))return out;
 const s=g.sicht,rp=g.geo.rand,R=zufall(hashText(String(g.bahn.id)+salz));
 for(let v=0;v<n*8&&out.length<n;v++){
  const x=s.x+R()*s.b,y=s.y+R()*s.h;
  if(rp.length>2&&(imPoly(x,y,rp)||abstPoly(x,y,rp)<abst))continue;
  out.push([x,y,1.3+R()*1.8,R()*TAU,.5+R()*1.2]);
 }
 return out;
}

/* Außenbande: Band der Dicke RAND_DICKE außen um rand.
   Je Kante drei Streifen (Innenkante, Oberseite, Außenkante), Helligkeit je nach Ausrichtung zum Licht. */
function bandeAussen(g){
 const{c,th,geo,kam}=g,bd=th.bande,p=geo.rand,vz=geo.vz,D=RAND_DICKE,n=p.length;
 const q3=versatzPunkte(p,vz,3),qm=versatzPunkte(p,vz,D-4),qd=versatzPunkte(p,vz,D);
 const aussen=polyPfad(qd,true);
 c.save();schattenAn(g,th.schatten,14,6);c.fillStyle=bd.farbe;c.fill(aussen);c.restore();   // Schlagschatten
 c.save();schattenAn(g,th.schatten,3,1.5);c.fillStyle=bd.farbe;c.fill(aussen);c.restore();  // Kontaktschatten
 for(let i=0;i<n;i++){
  const j=(i+1)%n,f=lichtFaktor(kam,normale(p[i],p[j],vz)),af=Math.abs(f);
  viereck(c,p[i],p[j],qd[j],qd[i],mische(bd.farbe,f>0?bd.hell:bd.dunkel,af*.3));
  viereck(c,qm[i],qm[j],qd[j],qd[i],mische(bd.farbe,f>0?bd.hell:bd.dunkel,.25+af*.6));
  viereck(c,p[i],p[j],q3[j],q3[i],mische(bd.farbe,f<0?bd.hell:bd.dunkel,.2+af*.5));
 }
 bandenMuster(g,p,qd,vz);
 if(bd.tau){                                                                  // Tau entlang der Außenkante
  const qt=polyPfad(versatzPunkte(p,vz,D-2.6),true),dunkel=mische(bd.tau,'#000000',.5);
  c.save();c.lineJoin='round';
  c.strokeStyle=rgba(bd.fuge,.75);c.lineWidth=4.6;c.stroke(qt);
  c.strokeStyle=bd.tau;c.lineWidth=3.2;c.stroke(qt);
  c.strokeStyle=rgba(dunkel,.8);c.setLineDash([1.2,2.4]);c.stroke(qt);c.setLineDash([]);   // Drall
  c.restore();
 }
 if(bd.poller){                                                               // eiserne Poller an den Ecken
  const qp=versatzPunkte(p,vz,D*.5);
  for(let i=0;i<n;i++){
   const a=p[(i-1+n)%n],m=p[i],b=p[(i+1)%n],w=Math.atan2((m[0]-a[0])*(b[1]-m[1])-(m[1]-a[1])*(b[0]-m[0]),(m[0]-a[0])*(b[0]-m[0])+(m[1]-a[1])*(b[1]-m[1]));
   if(Math.abs(w)<.5)continue;
   const q=qp[i];c.save();aufrecht(c,kam,q[0],q[1]);
   schattenOval(c,2.5,3,8,7,.45);kugel(c,0,0,5.6,mische(bd.poller,'#ffffff',.45),bd.poller,mische(bd.poller,'#000000',.6));
   c.strokeStyle=rgba(bd.tau||'#d8bc84',.9);c.lineWidth=1.6;kreis(c,0,0,3.6);c.stroke();
   c.restore();
  }
 }
 c.lineWidth=1.2;c.strokeStyle=rgba(bd.dunkel,.85);c.stroke(aussen);
 if(bd.neon){c.save();c.strokeStyle=bd.neon;c.globalAlpha=.7;c.lineWidth=1.6;c.shadowColor=bd.neon;c.shadowBlur=6*g.k;c.stroke(aussen);c.restore()}
}
function bandenMuster(g,p,qd,vz){
 const{c,th,R,sv}=g,bd=th.bande,D=RAND_DICKE,n=p.length;
 const auf=(a,b,u,off,nn)=>[a[0]+(b[0]-a[0])*u+nn[0]*off,a[1]+(b[1]-a[1])*u+nn[1]*off];
 const linie=(p1,p2)=>{c.moveTo(p1[0],p1[1]);c.lineTo(p2[0],p2[1])};
 const glutPfad=bd.glut?new Path2D():null;      // glühende Fuge (stil 'basalt'), am Ende in einem Zug
 c.save();c.lineCap='round';
 for(let i=0;i<n;i++){
  const a=p[i],b=p[(i+1)%n],nn=normale(a,b,vz),L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<6)continue;
  if(bd.stil==='holz'){
   const k=Math.max(1,Math.round(L/58));
   c.strokeStyle=rgba(bd.fuge,.75);c.lineWidth=1.6;c.beginPath();               // Bretterfugen
   for(let s=1;s<k;s++)linie(auf(a,b,s/k,2.5,nn),auf(a,b,s/k,D-1,nn));
   c.stroke();
   c.strokeStyle=rgba(bd.dunkel,.3);c.lineWidth=1;c.beginPath();               // Maserung
   for(let s=0;s<k;s++)for(let m=0;m<2;m++){const off=4+R()*(D-8);linie(auf(a,b,(s+.08+R()*.2)/k,off,nn),auf(a,b,(s+.55+R()*.35)/k,off+(R()-.5)*2,nn))}
   c.stroke();
   c.fillStyle=rgba(bd.dunkel,.7);                                               // Nägel
   for(let s=0;s<=k;s++)for(const off of[D*.3,D*.72]){const q=auf(a,b,clamp(s/k+(s<k?.018:-.018),0,1),off,nn);kreis(c,q[0],q[1],1.1);c.fill()}
  }else if(bd.stil==='stein'){
   c.strokeStyle=rgba(bd.fuge,.6);c.lineWidth=1.3;c.beginPath();
   linie(auf(a,b,0,D/2,nn),auf(a,b,1,D/2,nn));                                 // Längsfuge
   const k=Math.max(1,Math.round(L/44));
   for(let s=1;s<k;s++)linie(auf(a,b,s/k,D/2,nn),auf(a,b,s/k,D-1,nn));         // äußere Reihe
   for(let s=0;s<k;s++)linie(auf(a,b,(s+.5)/k,2.5,nn),auf(a,b,(s+.5)/k,D/2,nn)); // innere Reihe versetzt
   c.stroke();
   for(let m=0;m<Math.round(L/9);m++){const q=auf(a,b,R(),2+R()*(D-4),nn);c.fillStyle=R()<.5?rgba(bd.dunkel,.35):rgba(bd.hell,.45);c.fillRect(q[0],q[1],1.4,1.4)}
  }else if(bd.stil==='schnee'){
   const k=Math.max(2,Math.round(L/15));                                         // Schneehügel auf der Bande
   for(let s=0;s<k;s++){
    const q=auf(a,b,(s+R()*.6)/k,D-3+R()*3,nn),r=6+R()*5;
    c.fillStyle=rgba(bd.dunkel,.35);kreis(c,q[0]+sv[0]*1.6,q[1]+sv[1]*1.6,r);c.fill();
    c.fillStyle=R()<.5?bd.hell:bd.farbe;kreis(c,q[0],q[1],r);c.fill();
   }
   c.fillStyle='rgba(255,255,255,.9)';
   for(let s=0;s<k;s++){const q=auf(a,b,R(),4+R()*(D-6),nn);kreis(c,q[0],q[1],.9);c.fill()}
  }else if(bd.stil==='metall'){
   const k=Math.max(1,Math.round(L/120));
   c.strokeStyle=rgba(bd.fuge,.9);c.lineWidth=1.4;c.beginPath();
   for(let s=1;s<k;s++)linie(auf(a,b,s/k,2,nn),auf(a,b,s/k,D-1,nn));
   c.stroke();
   const m=Math.max(1,Math.round(L/40));
   for(let s=0;s<m;s++){const q=auf(a,b,(s+.5)/m,D*.55,nn);c.fillStyle=bd.dunkel;kreis(c,q[0]+.6,q[1]+.6,2);c.fill();c.fillStyle=bd.hell;kreis(c,q[0],q[1],1.5);c.fill()}
  }else if(bd.stil==='planke'){                                                // Schiffsdeck: zwei Planken nebeneinander
   const k=Math.max(1,Math.round(L/72)),dn=6/L;
   c.strokeStyle=rgba(bd.fuge,.85);c.lineWidth=1.3;c.beginPath();
   linie(auf(a,b,0,D*.5,nn),auf(a,b,1,D*.5,nn));                               // Längsfuge
   for(let s=1;s<k;s++)linie(auf(a,b,s/k,2.5,nn),auf(a,b,s/k,D*.5,nn));         // Stoßfugen innen
   for(let s=0;s<k;s++)linie(auf(a,b,(s+.5)/k,D*.5,nn),auf(a,b,(s+.5)/k,D-1,nn)); // außen versetzt
   c.stroke();
   c.strokeStyle=rgba(bd.dunkel,.35);c.lineWidth=.9;c.beginPath();              // Maserung
   for(let m=0;m<k*5;m++){const u=R(),off=(R()<.5?3.5:D*.5+1.5)+R()*(D*.5-5);linie(auf(a,b,u,off,nn),auf(a,b,Math.min(1,u+.04+R()*.12),off+(R()-.5)*1.2,nn))}
   c.stroke();
   c.strokeStyle=rgba(bd.hell,.25);c.lineWidth=1;c.beginPath();                 // Kantenlicht je Planke
   linie(auf(a,b,0,3.4,nn),auf(a,b,1,3.4,nn));linie(auf(a,b,0,D*.5+1.6,nn),auf(a,b,1,D*.5+1.6,nn));
   c.stroke();
   c.fillStyle=rgba(bd.fuge,.95);                                               // Nägel neben jedem Stoß
   for(let s=1;s<k;s++)for(const sg of[-1,1]){const q=auf(a,b,clamp(s/k+sg*dn,0,1),D*.27,nn);kreis(c,q[0],q[1],1.15);c.fill()}
   for(let s=0;s<k;s++)for(const sg of[-1,1]){const q=auf(a,b,clamp((s+.5)/k+sg*dn,0,1),D*.62,nn);kreis(c,q[0],q[1],1.15);c.fill()}
  }else if(bd.stil==='basalt'){                                                // Basaltblöcke, schräge Stoßfugen
   const k=Math.max(1,Math.round(L/38));
   c.strokeStyle=rgba(bd.fuge,.9);c.lineWidth=1.6;c.beginPath();
   for(let s=1;s<k;s++){const u=s/k+(R()-.5)*.25/k,u2=u+(R()-.5)*.35/k;
    if(glutPfad&&R()<.3){const q1=auf(a,b,u,2.5,nn),q2=auf(a,b,u2,D-1.5,nn);glutPfad.moveTo(q1[0],q1[1]);glutPfad.lineTo(q2[0],q2[1])}
    else linie(auf(a,b,u,2,nn),auf(a,b,u2,D-1,nn))}
   c.stroke();
   for(let m=0;m<Math.round(L/8);m++){const q=auf(a,b,R(),2+R()*(D-4),nn);c.fillStyle=R()<.5?rgba(bd.dunkel,.45):rgba(bd.hell,.35);c.fillRect(q[0],q[1],1.4,1.4)}
   if(glutPfad){const m=Math.max(2,Math.round(L/14));                          // Längsfuge, leicht gezackt
    for(let s=0;s<=m;s++){const q=auf(a,b,s/m,D*.5+(s&&s<m?(R()-.5)*2.4:0),nn);s?glutPfad.lineTo(q[0],q[1]):glutPfad.moveTo(q[0],q[1])}}
  }
 }
 if(glutPfad){
  c.lineJoin='round';
  schattenAn(g,bd.glut,7,0);c.strokeStyle=rgba(bd.glut,.95);c.lineWidth=2.1;c.stroke(glutPfad);schattenAus(c);
  c.strokeStyle=rgba(mische(bd.glut,'#ffffff',.55),.9);c.lineWidth=.8;c.stroke(glutPfad);
 }
 c.restore();
}

/* Rasen / Spielfläche mit Mähstreifen und Textur */
function rasen(g){
 const{c,th,geo,R,sv}=g,gr=th.gras,bx=geo.randBox,W=gr.streifenBreite||90;
 const X=bx.x-4,Y=bx.y-4,BB=bx.b+8,HH=bx.h+8;
 c.save();c.clip(geo.randPfad);
 c.fillStyle=gr.farbe;c.fillRect(X,Y,BB,HH);
 if(gr.streifen){c.fillStyle=gr.streifen;for(let y=Math.floor(Y/W)*W;y<Y+HH;y+=2*W)c.fillRect(X,y,BB,W)}
 if(gr.karo){c.fillStyle='rgba(255,255,255,'+gr.karo+')';for(let x=Math.floor(X/W)*W;x<X+BB;x+=2*W)c.fillRect(x,Y,W,HH)}
 if(Array.isArray(gr.flecken)&&gr.flecken.length){                     // weiche Moos-/Grasflecken
  for(let i=0;i<Math.min(45,BB*HH/22000);i++){
   const x=X+R()*BB,y=Y+R()*HH,r=40+R()*90,rg=c.createRadialGradient(x,y,0,x,y,r);
   rg.addColorStop(0,rgba(gr.flecken[i%gr.flecken.length],.4));rg.addColorStop(1,rgba(gr.flecken[i%gr.flecken.length],0));
   c.fillStyle=rg;c.fillRect(x-r,y-r,2*r,2*r);
  }
 }
 if(gr.koerner){                                                        // Sandkörner im Gras (Strandgras)
  const q=new Path2D();for(let i=0;i<Math.min(2600,BB*HH/200);i++){const s=.9+R()*1;q.rect(X+R()*BB,Y+R()*HH,s,s)}
  c.fillStyle=rgba(gr.koerner,.6);c.fill(q);
 }
 if(gr.halme){
  const n=Math.min(5000,Math.round(BB*HH/110));c.lineWidth=1.1;c.lineCap='round';
  for(let k=0;k<2;k++){
   c.strokeStyle=k?rgba(gr.halme,.32):'rgba(255,255,255,.10)';c.beginPath();
   for(let i=0;i<n/2;i++){const x=X+R()*BB,y=Y+R()*HH,a=-1.9+R()*.8,l=3+R()*4;c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l)}
   c.stroke();
  }
 }
 if(gr.raster){
  c.strokeStyle=rgba(gr.raster,.09);c.lineWidth=1;c.beginPath();
  for(let x=Math.floor(X/50)*50;x<X+BB;x+=50){c.moveTo(x,Y);c.lineTo(x,Y+HH)}
  for(let y=Math.floor(Y/50)*50;y<Y+HH;y+=50){c.moveTo(X,y);c.lineTo(X+BB,y)}
  c.stroke();
  c.fillStyle=rgba(gr.raster,.25);
  for(let x=Math.floor(X/100)*100;x<X+BB;x+=100)for(let y=Math.floor(Y/100)*100;y<Y+HH;y+=100){c.fillRect(x-1.5,y-1.5,3,3)}
  c.fillStyle='rgba(255,255,255,.025)';
  for(let i=0;i<Math.min(80,BB*HH/12000);i++){const x=Math.floor((X+R()*BB)/50)*50,y=Math.floor((Y+R()*HH)/50)*50;c.fillRect(x+1,y+1,48,48)}
 }
 if(gr.glanz){
  for(let i=0;i<Math.min(14,BB*HH/60000);i++){
   const x=X+R()*BB,y=Y+R()*HH,L=120+R()*260,w=10+R()*26;
   c.save();c.translate(x,y);c.rotate(-.75);c.fillStyle='rgba(255,255,255,.28)';c.fillRect(-L/2,-w/2,L,w);c.fillStyle='rgba(255,255,255,.18)';c.fillRect(-L/2,w*.7,L,w*.3);c.restore();
  }
  c.fillStyle='rgba(140,190,230,.25)';
  for(let i=0;i<Math.min(1600,BB*HH/300);i++)c.fillRect(X+R()*BB,Y+R()*HH,1.3,1.3);
 }
 // Licht-Verlauf über die ganze Fläche (oben links heller)
 const rr=Math.hypot(bx.b,bx.h)*.35;
 const lg=c.createLinearGradient(bx.cx-sv[0]*rr,bx.cy-sv[1]*rr,bx.cx+sv[0]*rr,bx.cy+sv[1]*rr);
 lg.addColorStop(0,'rgba(255,255,255,.10)');lg.addColorStop(1,'rgba(0,0,0,.13)');
 c.fillStyle=lg;c.fillRect(X,Y,BB,HH);
 c.restore();
}

/* Zonen-Grundflächen (das Bewegte darüber malt zonenAnim pro Bild) */
function zoneStatisch(g,zg){
 const{c,th,R}=g,z=zg.z,p=zg.pfad,b=zg.box,fl=Math.max(1,b.b*b.h);
 const fuell=f=>{c.fillStyle=f;c.fillRect(b.x-4,b.y-4,b.b+8,b.h+8)};
 switch(z.typ){
  case'sand':{const s=th.sand;
   c.save();c.clip(p);fuell(s.farbe);
   c.strokeStyle=rgba(s.dunkel,.22);c.lineWidth=1.5;c.beginPath();       // Harkenspuren
   for(let y=b.y+6;y<b.y+b.h;y+=10)for(let x=b.x-6,i=0;x<=b.x+b.b+6;x+=14,i++){const yy=y+Math.sin(x*.025+y*.07)*2.5;i?c.lineTo(x,yy):c.moveTo(x,yy)}
   c.stroke();
   const n=Math.min(2800,Math.round(fl/12));                              // Körnung
   for(let k=0;k<2;k++){c.fillStyle=rgba(k?s.hell:s.dunkel,k?.75:.45);c.beginPath();for(let i=0;i<n/2;i++){const r=.7+R()*1.1;c.rect(b.x+R()*b.b,b.y+R()*b.h,r,r)}c.fill()}
   innerSchatten(g,p,rgba(s.dunkel,.95),9,3);
   c.restore();
   c.strokeStyle=rgba(s.dunkel,.55);c.lineWidth=2;c.stroke(p);
   break;}
  case'wasser':{const w=th.wasser;
   c.save();c.clip(p);
   const rg=c.createRadialGradient(b.cx,b.cy,0,b.cx,b.cy,Math.max(10,Math.hypot(b.b,b.h)/2));
   rg.addColorStop(0,w.tief);rg.addColorStop(1,w.flach);c.fillStyle=rg;c.fillRect(b.x-4,b.y-4,b.b+8,b.h+8);
   c.strokeStyle=rgba(w.glanz,.08);c.lineWidth=3;c.beginPath();
   for(let i=0;i<Math.min(70,fl/2500);i++){const x=b.x+R()*b.b,y=b.y+R()*b.h;c.moveTo(x,y);c.quadraticCurveTo(x+10,y-7,x+22,y)}
   c.stroke();
   innerSchatten(g,p,'rgba(0,20,45,.55)',16,5);
   c.lineWidth=12;c.strokeStyle=rgba(w.flach,.45);c.stroke(p);           // heller Flachwasser-Saum
   c.restore();
   c.lineWidth=6;c.strokeStyle=w.ufer;c.stroke(p);                        // Ufer
   c.lineWidth=1.4;c.strokeStyle=rgba(mische(w.ufer,'#000000',.45),.6);c.stroke(p);
   break;}
  case'lava':{const lv=th.lava;
   if(lv.kraeftig){c.save();schattenAn(g,lv.glut,26,0);c.fillStyle=lv.glut;c.fill(p);c.restore()}   // Glut strahlt aufs Gras
   c.save();c.clip(p);fuell(lv.glut);
   const rg=c.createRadialGradient(b.cx,b.cy,0,b.cx,b.cy,Math.max(10,Math.hypot(b.b,b.h)/2));
   rg.addColorStop(0,rgba(lv.hell,.6));rg.addColorStop(1,rgba(lv.hell,0));c.fillStyle=rg;c.fillRect(b.x,b.y,b.b,b.h);
   for(let i=0;i<Math.min(260,fl/850);i++){                                // Krustenschollen, dazwischen Glut
    const x=b.x+R()*b.b,y=b.y+R()*b.h,r=9+R()*16;
    c.beginPath();for(let k=0;k<7;k++){const a=k*TAU/7,rr=r*(.7+R()*.35);k?c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):c.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr)}c.closePath();
    c.fillStyle=mische(lv.tief,lv.glut,.12+R()*.12);c.fill();
   }
   if(lv.kraeftig){                                                       // helle Glutadern zwischen den Schollen
    const R2=zufall(hashText(String(g.bahn.id)+'|adern'+zg.i)),ad=new Path2D();
    for(let i=0;i<Math.min(30,fl/3000);i++){let x=b.x+R2()*b.b,y=b.y+R2()*b.h,a=R2()*TAU;ad.moveTo(x,y);
     for(let k=0;k<4;k++){a+=(R2()-.5)*1.4;const l=10+R2()*18;x+=Math.cos(a)*l;y+=Math.sin(a)*l;ad.lineTo(x,y)}}
    c.lineCap='round';c.lineJoin='round';c.strokeStyle=rgba(lv.hell,.6);c.lineWidth=2.4;c.stroke(ad);
    c.strokeStyle=rgba('#ffffff',.35);c.lineWidth=.8;c.stroke(ad);
   }
   innerSchatten(g,p,'rgba(20,0,0,.7)',12,4);
   c.restore();
   c.lineWidth=6;c.strokeStyle=mische(lv.tief,'#000000',.35);c.stroke(p);
   c.lineWidth=1.5;c.strokeStyle=rgba(lv.glut,.6);c.stroke(p);
   break;}
  case'eis':{const e=th.eis;
   c.save();c.clip(p);
   const lg=c.createLinearGradient(b.x,b.y,b.x+b.b,b.y+b.h);
   lg.addColorStop(0,e.hell);lg.addColorStop(.45,e.farbe);lg.addColorStop(1,e.dunkel);c.fillStyle=lg;c.fillRect(b.x-4,b.y-4,b.b+8,b.h+8);
   for(let i=0;i<Math.max(3,Math.min(12,fl/25000));i++){                  // Glanzstreifen
    const x=b.x+R()*b.b,y=b.y+R()*b.h,L=80+R()*200,w=8+R()*22;
    c.save();c.translate(x,y);c.rotate(-.75);c.fillStyle='rgba(255,255,255,.3)';c.fillRect(-L/2,-w/2,L,w);c.fillRect(-L/2,w*.75,L,w*.3);c.restore();
   }
   for(let i=0;i<Math.min(14,fl/14000);i++){                              // Risse
    let x=b.x+R()*b.b,y=b.y+R()*b.h,a=R()*TAU;const pts=[[x,y]];
    for(let k=0;k<5;k++){a+=(R()-.5)*1.2;const l=14+R()*24;x+=Math.cos(a)*l;y+=Math.sin(a)*l;pts.push([x,y])}
    c.beginPath();pts.forEach((q,k)=>k?c.lineTo(q[0]+1,q[1]+1):c.moveTo(q[0]+1,q[1]+1));c.strokeStyle=rgba(e.dunkel,.35);c.lineWidth=1.2;c.stroke();
    c.beginPath();pts.forEach((q,k)=>k?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1;c.stroke();
   }
   innerSchatten(g,p,rgba(e.dunkel,.7),10,3);
   c.restore();
   c.strokeStyle=rgba(e.hell,.95);c.lineWidth=2.5;c.stroke(p);
   break;}
  case'loch':{const ab=th.abgrund;
   c.save();c.clip(p);fuell(ab.tief);
   if(ab.sterne){
    c.fillStyle='#ffffff';c.beginPath();
    for(let i=0;i<Math.min(260,fl/500);i++){const x=b.x+R()*b.b,y=b.y+R()*b.h,r=.4+R()*1.1;c.moveTo(x+r,y);c.arc(x,y,r,0,TAU)}
    c.globalAlpha=.8;c.fill();c.globalAlpha=1;
    const rg=c.createRadialGradient(b.cx,b.cy,0,b.cx,b.cy,Math.max(10,b.r));
    rg.addColorStop(0,'rgba(123,61,255,.25)');rg.addColorStop(1,'rgba(123,61,255,0)');c.fillStyle=rg;c.fillRect(b.x,b.y,b.b,b.h);
   }
   c.lineJoin='round';
   c.strokeStyle=mische(ab.wand,ab.tief,.55);c.lineWidth=36;c.stroke(p);     // tiefe Wand
   c.strokeStyle=ab.wand;c.lineWidth=18;c.stroke(p);                        // obere Wand
   innerSchatten(g,p,'rgba(0,0,0,.9)',18,4);
   c.restore();
   c.lineWidth=3;c.strokeStyle=ab.kante;
   if(ab.sterne){c.save();c.shadowColor=ab.kante;c.shadowBlur=8*g.k;c.stroke(p);c.restore()}else c.stroke(p);
   break;}
  case'hang':{const hg=th.hang,d=normiert(z.richtung),st=clamp(+z.staerke||1,.3,3),rr=Math.hypot(b.b,b.h)/2+10;
   c.save();c.clip(p);
   const lg=c.createLinearGradient(b.cx-d[0]*rr,b.cy-d[1]*rr,b.cx+d[0]*rr,b.cy+d[1]*rr);
   lg.addColorStop(0,rgba(hg.hell,.10+.03*st));lg.addColorStop(1,rgba(hg.dunkel,.12+.05*st));
   c.fillStyle=lg;c.fillRect(b.x-4,b.y-4,b.b+8,b.h+8);
   c.strokeStyle=rgba(hg.hell,.14);c.lineWidth=1.6;c.beginPath();           // Höhenlinien quer zum Gefälle
   const abst=Math.max(18,44/st);
   for(let k=-rr;k<=rr;k+=abst){const mx=b.cx+d[0]*k,my=b.cy+d[1]*k;c.moveTo(mx+d[1]*rr,my-d[0]*rr);c.lineTo(mx-d[1]*rr,my+d[0]*rr)}
   c.stroke();c.restore();
   c.save();c.setLineDash([8,7]);c.strokeStyle=rgba(hg.hell,.3);c.lineWidth=1.5;c.stroke(p);c.restore();
   break;}
  case'boost':{const bo=th.boost;
   c.save();c.clip(p);fuell(rgba(bo.platte,.8));
   const rg=c.createRadialGradient(b.cx,b.cy,0,b.cx,b.cy,Math.max(4,b.r));
   rg.addColorStop(0,rgba(bo.farbe,.3));rg.addColorStop(1,rgba(bo.farbe,0));c.fillStyle=rg;c.fillRect(b.x,b.y,b.b,b.h);
   innerSchatten(g,p,'rgba(0,0,0,.6)',6,2);
   c.restore();
   c.strokeStyle=rgba(bo.farbe,.8);c.lineWidth=3;c.stroke(p);
   break;}
 }
}

/* Feste Teile der Objekte: Pfosten ganz, Rest nur Unterbau/Schatten */
function objekteStatisch(g){
 const{c,th,kam}=g;
 for(const o of(Array.isArray(g.bahn.objekte)?g.bahn.objekte:[])){
  if(!o)continue;
  switch(o.typ){
   case'pfosten':{const p=th.pfosten,r=+o.r||12;
    c.save();aufrecht(c,kam,+o.x,+o.y);
    schattenAn(g,th.schatten,6,4);c.fillStyle=p.farbe;kreis(c,0,0,r);c.fill();schattenAus(c);
    kugel(c,0,0,r,p.hell,p.farbe,mische(p.farbe,'#000000',.45));
    c.strokeStyle=rgba(p.kappe,.9);c.lineWidth=Math.max(1.5,r*.18);kreis(c,0,0,r*.62);c.stroke();
    c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.ellipse(-r*.35,-r*.4,r*.28,r*.16,-.6,0,TAU);c.fill();
    c.restore();break;}
   case'bumper':{const r=+o.r||24;
    c.save();schattenAn(g,th.schatten,8,4);c.fillStyle=th.bumper.dunkel;kreis(c,+o.x,+o.y,r);c.fill();c.restore();break;}
   case'block':{if(!Array.isArray(o.rect))break;
    const[x,y,b,h]=o.rect.map(Number),d=Array.isArray(o.bahn)?o.bahn.map(Number):[0,0],cx=x+b/2,cy=y+h/2;
    if(d[0]||d[1]){
     c.save();c.lineCap='round';c.strokeStyle='rgba(0,0,0,.13)';c.lineWidth=Math.min(b,h)*.55;
     c.beginPath();c.moveTo(cx-d[0],cy-d[1]);c.lineTo(cx+d[0],cy+d[1]);c.stroke();
     c.setLineDash([6,6]);c.lineWidth=1.5;c.strokeStyle='rgba(255,255,255,.2)';
     c.strokeRect(x-d[0],y-d[1],b,h);c.strokeRect(x+d[0],y+d[1],b,h);
     c.restore();
    }
    break;}
   case'muehle':{const L=+o.laenge||160;
    c.save();c.setLineDash([10,9]);c.strokeStyle='rgba(0,0,0,.16)';c.lineWidth=2;kreis(c,+o.x,+o.y,L+BALKEN/2);c.stroke();c.restore();
    c.fillStyle='rgba(0,0,0,.18)';kreis(c,+o.x,+o.y,24);c.fill();
    break;}
   case'tor':{const b=+o.b||120,tp=th.tor;
    for(const px of[+o.x-b/2-8,+o.x+b/2+8]){
     c.save();schattenAn(g,th.schatten,5,3);rundRechteck(c,px-8,+o.y-10,16,20,3);c.fillStyle=tp.pfosten;c.fill();schattenAus(c);
     rundRechteck(c,px-6,+o.y-8,12,16,2);c.fillStyle=mische(tp.pfosten,'#ffffff',.18);c.fill();c.restore();
    }
    break;}
   case'tele':{const r=+o.r||28,tl=th.tele;
    [[o.a,tl.a],[o.b,tl.b]].forEach(([q,f])=>{if(!q)return;
     c.save();schattenAn(g,'rgba(0,0,0,.45)',6,2);c.fillStyle=tl.platte;kreis(c,+q.x,+q.y,r+9);c.fill();schattenAus(c);
     c.strokeStyle=rgba(mische(f,'#ffffff',.25),.7);c.lineWidth=3;kreis(c,+q.x,+q.y,r+7);c.stroke();
     c.strokeStyle='rgba(0,0,0,.5)';c.lineWidth=2;kreis(c,+q.x,+q.y,r+3);c.stroke();
     c.restore();
    });
    break;}
  }
 }
}

/* Innenwände: offene Polylinien, plastisch mit Licht oben links */
function waende(g){
 const{c,th,sv}=g,bd=th.bande;
 for(const w of(Array.isArray(g.bahn.waende)?g.bahn.waende:[])){
  const p=punkte(w,true);if(p.length<2)continue;
  const pf=polyPfad(p,false);
  c.save();c.lineCap='round';c.lineJoin='round';
  c.save();schattenAn(g,th.schatten,8,4);c.strokeStyle=bd.dunkel;c.lineWidth=WAND_DICKE;c.stroke(pf);c.restore();
  c.strokeStyle=bd.dunkel;c.lineWidth=WAND_DICKE;c.stroke(pf);
  c.save();c.translate(-sv[0]*1.2,-sv[1]*1.2);c.strokeStyle=bd.farbe;c.lineWidth=WAND_DICKE-3;c.stroke(pf);
  const holzig=bd.stil==='holz'||bd.stil==='planke';
  if(holzig||bd.stil==='stein'||bd.stil==='basalt'){c.lineCap='butt';c.setLineDash([1.6,holzig?52:30]);c.strokeStyle=rgba(bd.fuge,.7);c.lineWidth=WAND_DICKE-4;c.stroke(pf);c.setLineDash([]);c.lineCap='round'}
  if(bd.glut){c.save();schattenAn(g,bd.glut,5,0);c.strokeStyle=rgba(bd.glut,.9);c.lineWidth=1.5;c.stroke(pf);c.restore()}   // glühende Fuge
  c.translate(-sv[0]*1.4,-sv[1]*1.4);c.strokeStyle=rgba(bd.hell,.85);c.lineWidth=1.8;c.stroke(pf);
  c.restore();
  if(bd.stil==='schnee'){c.setLineDash([.1,13]);c.strokeStyle=bd.hell;c.lineWidth=WAND_DICKE+2;c.stroke(pf);c.setLineDash([])}
  if(bd.neon){c.strokeStyle=bd.neon;c.lineWidth=1.6;c.shadowColor=bd.neon;c.shadowBlur=7*g.k;c.stroke(pf)}
  c.restore();
 }
}

/* Abschlagmatte mit zwei Markern */
function abschlag(g){
 const{c,th,kam}=g,s=g.bahn.start;if(!s)return;const ab=th.abschlag;
 c.save();c.translate(+s.x,+s.y);
 schattenAn(g,'rgba(0,0,0,.28)',4,2);rundRechteck(c,-40,-24,80,48,10);c.fillStyle=ab.matte;c.fill();schattenAus(c);
 c.strokeStyle=rgba(ab.rand,.65);c.lineWidth=2;c.setLineDash([6,5]);rundRechteck(c,-34,-18,68,36,7);c.stroke();c.setLineDash([]);
 c.fillStyle=rgba(ab.rand,.7);kreis(c,0,0,3);c.fill();
 c.restore();
 for(const dx of[-28,28]){c.save();aufrecht(c,kam,+s.x+dx,+s.y);schattenOval(c,1.5,2,7,6,.4);kugel(c,0,0,5.5,'#ffffff',ab.marker,mische(ab.marker,'#000000',.45));c.restore()}
}

/* Loch: Kragen, Becher mit Tiefe, weiße Hülse (Fahne kommt pro Bild) */
function lochStatisch(g){
 const{c,th,sv}=g,l=g.bahn.loch;if(!l)return;const lo=th.loch,x=+l.x,y=+l.y;
 const neon=th.bande.neon;
 c.save();
 if(neon){c.shadowColor=neon;c.shadowBlur=10*g.k;c.strokeStyle=lo.kragen;c.lineWidth=2.5;kreis(c,x,y,LOCH_R+6);c.stroke();schattenAus(c)}
 else{c.fillStyle=rgba(lo.kragen,.5);kreis(c,x,y,LOCH_R+8);c.fill()}
 const lx=-sv[0]*6,ly=-sv[1]*6;   // Richtung zum Licht
 const rg=c.createRadialGradient(x+lx,y+ly,0,x+lx*.5,y+ly*.5,LOCH_R+3);
 rg.addColorStop(0,'#000000');rg.addColorStop(.7,lo.innen);rg.addColorStop(1,mische(lo.innen,'#8a8a8a',.55));
 c.fillStyle=rg;kreis(c,x,y,LOCH_R);c.fill();
 const pf=new Path2D();pf.arc(x,y,LOCH_R,0,TAU);
 innerSchatten(g,pf,'rgba(0,0,0,.85)',5,3);
 c.strokeStyle=rgba(lo.huelse,.85);c.lineWidth=1.8;kreis(c,x,y,LOCH_R-1);c.stroke();
 c.restore();
}

/* Deko der Bahn (überall erlaubt, auch auf der Fläche) */
function dekoAlle(g){
 const{c,kam,th}=g;
 (Array.isArray(g.bahn.deko)?g.bahn.deko:[]).forEach((o,i)=>{
  if(!o||typeof o.typ!=='string'||!eigen(DEKO,o.typ))return;            // unbekannte Deko: überspringen
  const R=zufall(hashText(String(g.bahn.id)+'#'+i+o.typ)),s=clamp(+o.s||1,.2,5),x=+o.x||0,y=+o.y||0;
  c.save();aufrecht(c,kam,x,y);c.scale(s,s);DEKO[o.typ](c,th.deko,R,g);c.restore();
  if(eigen(DEKO_ANIM,o.typ))g.anim.deko.push([o.typ,x,y,s,R()]);          // bewegter Teil kommt pro Bild
 });
}

/* ---------- 6. Deko-Zeichner ----------
   Alle um (0,0), Bildschirm-oben = −y, Licht oben links, Schatten nach unten rechts. */
const DEKO={
 baum(c,d,R){
  const[hell,farbe,dunkel]=d.baum;
  if(d.baumStil==='tanne'){
   schattenOval(c,14,16,50,46,.36);
   for(let L=0;L<4;L++){
    const r=46*(1-L*.22),rot=L*.35+R()*.2;
    sternPfad(c,0,0,r,r*.62,9,rot);c.fillStyle=mische(dunkel,hell,L/4);c.fill();
    sternPfad(c,-2,-3,r*.72,r*.72*.6,9,rot);c.fillStyle='rgba(255,255,255,.42)';c.fill();
   }
   c.fillStyle='#ffffff';kreis(c,-1,-1,4);c.fill();
   return;
  }
  schattenOval(c,16,18,58,52,.38);
  const bl=[],n=7,rot=R()*TAU;
  for(let i=0;i<n;i++){const a=rot+i*TAU/n+(R()-.5)*.4,r=29+R()*7;bl.push([Math.cos(a)*r,Math.sin(a)*r,19+R()*8])}
  c.fillStyle=dunkel;bl.forEach(b=>{kreis(c,b[0]+2,b[1]+3,b[2]);c.fill()});
  bl.sort((a,b)=>(b[0]+b[1])-(a[0]+a[1]));
  bl.forEach(b=>kugel(c,b[0],b[1],b[2],hell,farbe,dunkel));
  kugel(c,-3,-4,30,hell,farbe,dunkel);
  c.fillStyle=rgba(hell,.45);
  for(let i=0;i<7;i++){const a=R()*TAU,r=R()*30;kreis(c,Math.cos(a)*r-6,Math.sin(a)*r-8,2.5+R()*3);c.fill()}
 },
 busch(c,d,R){
  const[hell,farbe,dunkel]=d.busch;
  schattenOval(c,8,9,30,26,.32);
  const bl=[];for(let i=0;i<5;i++){const a=i*TAU/5+R()*.5;bl.push([Math.cos(a)*12,Math.sin(a)*12,10+R()*3])}
  bl.sort((a,b)=>(b[0]+b[1])-(a[0]+a[1]));
  bl.forEach(b=>kugel(c,b[0],b[1],b[2],hell,farbe,dunkel));
  kugel(c,-1,-2,13,hell,farbe,dunkel);
  for(let i=0;i<5;i++){const a=R()*TAU,r=6+R()*10,x=Math.cos(a)*r,y=Math.sin(a)*r;c.fillStyle=d.beeren;kreis(c,x,y,2.2);c.fill();c.fillStyle='rgba(255,255,255,.8)';kreis(c,x-.7,y-.7,.7);c.fill()}
 },
 blume(c,d,R){
  const col=d.blumen[Math.floor(R()*d.blumen.length)]||'#ff6b9a';
  schattenOval(c,2,3,10,9,.25);
  c.fillStyle=d.busch[1];
  c.beginPath();c.ellipse(-7,4,5,2.4,.5,0,TAU);c.fill();c.beginPath();c.ellipse(7,5,5,2.4,-.5,0,TAU);c.fill();
  const rot=R()*TAU;c.fillStyle=col;
  for(let i=0;i<5;i++){const a=rot+i*TAU/5;c.beginPath();c.ellipse(Math.cos(a)*4.6,Math.sin(a)*4.6,4.6,3.1,a,0,TAU);c.fill()}
  c.fillStyle='rgba(0,0,0,.12)';kreis(c,.6,.8,3);c.fill();
  c.fillStyle=col==='#ffd23d'?'#a0522d':'#ffd23d';kreis(c,0,0,2.7);c.fill();
  c.fillStyle='rgba(255,255,255,.7)';kreis(c,-.8,-.9,.9);c.fill();
 },
 stein(c,d,R){
  const[hell,farbe,dunkel]=d.stein;
  schattenOval(c,5,6,22,18,.35);
  const pts=[];for(let i=0;i<8;i++){const a=i*TAU/8+(R()-.5)*.3,r=16*(.75+R()*.35);pts.push([Math.cos(a)*r,Math.sin(a)*r*.85])}
  c.beginPath();pts.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath();
  const rg=c.createRadialGradient(-6,-6,1,0,0,19);rg.addColorStop(0,hell);rg.addColorStop(.55,farbe);rg.addColorStop(1,dunkel);
  c.fillStyle=rg;c.fill();c.strokeStyle=rgba(dunkel,.7);c.lineWidth=1.2;c.stroke();
  c.beginPath();pts.forEach((q,i)=>{const x=q[0]*.5-4,y=q[1]*.5-4;i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();c.fillStyle=rgba(hell,.35);c.fill();
  c.strokeStyle=rgba(dunkel,.5);c.lineWidth=1;c.beginPath();c.moveTo(2,-2);c.lineTo(7,4);c.lineTo(5,9);c.stroke();
 },
 kaktus(c,d,R){
  const[hell,farbe,dunkel]=d.kaktus;
  schattenOval(c,8,9,30,26,.35);
  const rippen=(x,y,r)=>{
   kugel(c,x,y,r,hell,farbe,dunkel);
   c.strokeStyle=rgba(dunkel,.55);c.lineWidth=1.1;c.beginPath();
   for(let i=0;i<10;i++){const a=i*TAU/10;c.moveTo(x+Math.cos(a)*r*.2,y+Math.sin(a)*r*.2);c.lineTo(x+Math.cos(a)*r*.95,y+Math.sin(a)*r*.95)}
   c.stroke();
   c.fillStyle='rgba(255,250,220,.9)';
   for(let i=0;i<10;i++){const a=(i+.5)*TAU/10;for(const u of[.55,.9]){kreis(c,x+Math.cos(a)*r*u,y+Math.sin(a)*r*u,.7);c.fill()}}
  };
  const arme=1+Math.floor(R()*2.5);
  for(let k=0;k<arme;k++){const a=R()*TAU;rippen(Math.cos(a)*20,Math.sin(a)*20,9)}
  rippen(0,0,17);
  if(R()<.55){c.fillStyle=d.kaktusBluete;for(let i=0;i<5;i++){const a=i*TAU/5;kreis(c,Math.cos(a)*2.6,Math.sin(a)*2.6,2.4);c.fill()}c.fillStyle='#ffd23d';kreis(c,0,0,1.5);c.fill()}
 },
 palme(c,d,R){
  const[hell,farbe,stamm]=d.palme;
  schattenOval(c,20,22,64,58,.3);
  const n=8,rot=R()*TAU;
  for(let lage=0;lage<2;lage++)for(let i=0;i<n;i++){
   const a=rot+i*TAU/n+lage*TAU/(2*n),L=(lage?44:58)+R()*8,w=lage?10:12;
   c.save();c.rotate(a);
   c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(L*.45,-w,L,w*.35);c.quadraticCurveTo(L*.5,w*.9,0,0);c.closePath();
   const lg=c.createLinearGradient(0,0,L,0);
   lg.addColorStop(0,lage?farbe:mische(farbe,'#000000',.3));lg.addColorStop(1,lage?hell:farbe);
   c.fillStyle=lg;c.fill();
   c.strokeStyle='rgba(0,0,0,.22)';c.lineWidth=1.1;c.beginPath();c.moveTo(2,0);c.quadraticCurveTo(L*.5,-w*.1,L,w*.35);c.stroke();
   c.strokeStyle=rgba(hell,.35);c.lineWidth=.9;c.beginPath();
   for(let s=1;s<6;s++){const u=s/6;c.moveTo(L*u,-w*.35*Math.sin(u*Math.PI)+w*.3*u);c.lineTo(L*u+4,-w*.85*Math.sin(u*Math.PI)+w*.3*u)}
   c.stroke();
   c.restore();
  }
  kugel(c,0,0,7,mische(stamm,'#ffffff',.3),stamm,mische(stamm,'#000000',.4));
  for(let i=0;i<3;i++){const a=R()*TAU;kugel(c,Math.cos(a)*6,Math.sin(a)*6,4,'#a87a4a','#6b4423','#2e1b08')}
 },
 schneemann(c){
  schattenOval(c,12,24,30,12,.3);
  const tief='#9dbbd8';
  kugel(c,0,12,18,'#ffffff','#eef5fc',tief);kugel(c,0,-9,13,'#ffffff','#eef5fc',tief);
  c.strokeStyle='#6b4423';c.lineWidth=2;c.lineCap='round';c.beginPath();
  c.moveTo(-11,-10);c.lineTo(-25,-19);c.moveTo(-21,-16);c.lineTo(-25,-11);c.moveTo(11,-10);c.lineTo(25,-19);c.moveTo(21,-16);c.lineTo(26,-13);c.stroke();
  kugel(c,0,-27,10,'#ffffff','#eef5fc',tief);
  c.fillStyle='#ff4d6d';rundRechteck(c,-11,-20,22,5,2.5);c.fill();c.fillRect(4,-17,5,11);
  c.fillStyle='#2a2a2a';for(const y of[-11,-5,8,15]){kreis(c,0,y,1.6);c.fill()}
  kreis(c,-3.5,-29,1.5);c.fill();kreis(c,3.5,-29,1.5);c.fill();
  c.fillStyle='#ff8a2a';c.beginPath();c.moveTo(0,-27.5);c.lineTo(10,-25.5);c.lineTo(0,-24);c.closePath();c.fill();
  c.fillStyle='#1f2430';c.beginPath();c.ellipse(0,-36,11,3,0,0,TAU);c.fill();rundRechteck(c,-7,-50,14,14,2);c.fill();
  c.fillStyle='#ff4d6d';c.fillRect(-7,-40,14,3);
 },
 eiskristall(c){
  const rg=c.createRadialGradient(0,0,0,0,0,27);rg.addColorStop(0,'rgba(191,233,255,.5)');rg.addColorStop(1,'rgba(191,233,255,0)');
  c.fillStyle=rg;kreis(c,0,0,27);c.fill();
  c.lineCap='round';
  const arme=()=>{c.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6-Math.PI/2,dx=Math.cos(a),dy=Math.sin(a);c.moveTo(0,0);c.lineTo(dx*20,dy*20);
   for(const[u,l]of[[.5,7],[.78,4.5]]){const bx=dx*20*u,by=dy*20*u;for(const sg of[-1,1]){const aa=a+sg*.8;c.moveTo(bx,by);c.lineTo(bx+Math.cos(aa)*l,by+Math.sin(aa)*l)}}}};
  c.strokeStyle='rgba(91,160,220,.6)';c.lineWidth=4.2;arme();c.stroke();
  c.strokeStyle='#ffffff';c.lineWidth=2.2;arme();c.stroke();
  sternPfad(c,0,0,4,4,3,0);c.fillStyle='#ffffff';c.fill();
 },
 stern(c){
  const rg=c.createRadialGradient(0,0,0,0,0,32);rg.addColorStop(0,'rgba(255,226,122,.55)');rg.addColorStop(1,'rgba(255,226,122,0)');
  c.fillStyle=rg;kreis(c,0,0,32);c.fill();
  sternPfad(c,0,0,16,7,5,-Math.PI/2);
  const lg=c.createLinearGradient(-10,-14,10,14);lg.addColorStop(0,'#fffbe0');lg.addColorStop(.5,'#ffc53d');lg.addColorStop(1,'#e8932a');
  c.fillStyle=lg;c.fill();c.strokeStyle='rgba(168,106,0,.7)';c.lineWidth=1.2;c.stroke();
  c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1;c.beginPath();c.moveTo(-24,0);c.lineTo(24,0);c.moveTo(0,-24);c.lineTo(0,24);c.stroke();
  c.fillStyle='rgba(255,255,255,.8)';kreis(c,-3,-4,2.2);c.fill();
 },
 planet(c,d,R){
  const farbe=d.planet[Math.floor(R()*d.planet.length)]||'#ffb36b',r=34,ring=R()<.6,neig=-.35+R()*.3;
  const rg=c.createRadialGradient(0,0,r*.9,0,0,r*1.7);rg.addColorStop(0,rgba(farbe,.28));rg.addColorStop(1,rgba(farbe,0));
  c.fillStyle=rg;kreis(c,0,0,r*1.7);c.fill();
  const ringFarbe=rgba(mische(farbe,'#ffffff',.45),.8);
  if(ring){c.save();c.rotate(neig);c.strokeStyle=ringFarbe;c.lineWidth=5;c.beginPath();c.ellipse(0,0,r*1.75,r*.45,0,Math.PI,TAU);c.stroke();c.restore()}
  kugel(c,0,0,r,mische(farbe,'#ffffff',.45),farbe,mische(farbe,'#000000',.55));
  c.save();kreis(c,0,0,r);c.clip();c.rotate(neig);
  c.fillStyle=rgba(mische(farbe,'#000000',.3),.25);
  for(let k=0;k<3;k++)c.fillRect(-r,-r*.55+k*r*.45+R()*6,2*r,4+R()*5);
  if(!ring){c.fillStyle='rgba(0,0,0,.18)';for(let k=0;k<4;k++){kreis(c,(R()-.5)*r*1.2,(R()-.5)*r*1.2,3+R()*5);c.fill()}}
  c.restore();
  const sg=c.createRadialGradient(-r*.4,-r*.45,0,-r*.2,-r*.2,r*1.6);
  sg.addColorStop(0,'rgba(0,0,0,0)');sg.addColorStop(.55,'rgba(0,0,0,0)');sg.addColorStop(1,'rgba(0,0,0,.6)');
  c.fillStyle=sg;kreis(c,0,0,r);c.fill();
  if(ring){c.save();c.rotate(neig);c.strokeStyle=ringFarbe;c.lineWidth=5;c.beginPath();c.ellipse(0,0,r*1.75,r*.45,0,0,Math.PI);c.stroke();c.restore()}
 },
 rakete(c,d){
  const[weiss,rot,fenster]=d.rakete;
  c.rotate(-.5);
  const fl=c.createLinearGradient(0,14,0,38);fl.addColorStop(0,'#fff6c2');fl.addColorStop(.45,'#ffb13d');fl.addColorStop(1,'rgba(255,80,40,0)');
  c.fillStyle=fl;c.beginPath();c.moveTo(-6,14);c.quadraticCurveTo(0,44,6,14);c.closePath();c.fill();
  c.fillStyle=rot;
  c.beginPath();c.moveTo(-8,3);c.lineTo(-16,17);c.lineTo(-8,14);c.closePath();c.fill();
  c.beginPath();c.moveTo(8,3);c.lineTo(16,17);c.lineTo(8,14);c.closePath();c.fill();
  const koerper=()=>{c.beginPath();c.moveTo(0,-27);c.bezierCurveTo(11,-18,10,4,8,14);c.lineTo(-8,14);c.bezierCurveTo(-10,4,-11,-18,0,-27);c.closePath()};
  koerper();const lg=c.createLinearGradient(-10,0,10,0);lg.addColorStop(0,weiss);lg.addColorStop(.6,mische(weiss,'#9aa6c8',.3));lg.addColorStop(1,'#8a96bc');
  c.fillStyle=lg;c.fill();
  c.save();koerper();c.clip();c.fillStyle=rot;c.fillRect(-12,-29,24,11);c.restore();
  c.fillStyle='#5a6380';c.fillRect(-5,13,10,3);
  c.fillStyle='#2a3570';kreis(c,0,-4,4.6);c.fill();c.strokeStyle='#c9d2ff';c.lineWidth=2;c.stroke();
  c.fillStyle=rgba(fenster,.9);kreis(c,-1.2,-5.2,1.6);c.fill();
 },
 fahne(c,d,R){
  const col=d.wimpel[Math.floor(R()*d.wimpel.length)]||'#ff4d6d';
  c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=2.5;c.lineCap='round';c.beginPath();c.moveTo(0,0);c.lineTo(22,14);c.stroke();
  c.fillStyle='rgba(0,0,0,.14)';c.beginPath();c.moveTo(22,14);c.lineTo(36,12);c.lineTo(30,20);c.closePath();c.fill();
  c.strokeStyle='#5a4a3a';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(0,-42);c.stroke();
  c.strokeStyle='#efe6d2';c.lineWidth=1.6;c.beginPath();c.moveTo(-.4,0);c.lineTo(-.4,-42);c.stroke();
  c.fillStyle=col;c.beginPath();c.moveTo(1,-42);c.quadraticCurveTo(14,-44,27,-36);c.quadraticCurveTo(14,-31,1,-28);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,.3)';c.beginPath();c.moveTo(1,-38);c.quadraticCurveTo(12,-39,22,-35);c.quadraticCurveTo(12,-35,1,-34);c.closePath();c.fill();
  c.fillStyle='#ffc53d';kreis(c,0,-43,2.2);c.fill();
 },
 /* --- Piratenbucht --- */
 fass(c,d,R){                                     // stehendes Fass von oben: Deckel aus Brettern, Eisenreifen, Spund
  const[hell,farbe,dunkel]=d.holz,[mh,mf,md]=d.metall,r=17;
  schattenOval(c,8,9,r*1.4,r*1.25,.4);
  c.fillStyle=mische(dunkel,'#000000',.25);kreis(c,2.5,3.5,r);c.fill();            // Fassbauch (wirkt hoch)
  c.save();kreis(c,0,0,r);c.clip();
  const lg=c.createLinearGradient(-r,-r,r,r);lg.addColorStop(0,hell);lg.addColorStop(.6,farbe);lg.addColorStop(1,dunkel);
  c.fillStyle=lg;c.fillRect(-r,-r,2*r,2*r);
  c.rotate((R()-.5)*.8);
  c.strokeStyle=rgba(dunkel,.8);c.lineWidth=1.1;c.beginPath();for(let x=-r+6.5;x<r;x+=6.5){c.moveTo(x,-r);c.lineTo(x,r)}c.stroke();
  c.strokeStyle=rgba(dunkel,.3);c.lineWidth=.8;c.beginPath();
  for(let i=0;i<7;i++){const x=-r+R()*2*r,y=-r*.6+R()*r*1.1;c.moveTo(x,y);c.lineTo(x+(R()-.5),y+5+R()*6)}c.stroke();
  c.restore();
  c.strokeStyle=md;c.lineWidth=3.6;kreis(c,0,0,r-1.8);c.stroke();                 // Reifen
  c.strokeStyle=rgba(mf,.9);c.lineWidth=1.6;kreis(c,0,0,r-1.8);c.stroke();
  c.strokeStyle=rgba(mh,.85);c.lineWidth=1.1;c.beginPath();c.arc(0,0,r-2.2,Math.PI*.95,Math.PI*1.6);c.stroke();
  for(let k=0;k<6;k++){const a=k*TAU/6+.3;c.fillStyle=md;kreis(c,Math.cos(a)*(r-1.8),Math.sin(a)*(r-1.8),.9);c.fill()}
  c.fillStyle='#24160a';kreis(c,r*.38,r*.2,2.8);c.fill();c.fillStyle=farbe;kreis(c,r*.38-.4,r*.2-.4,1.7);c.fill();   // Spund
  c.fillStyle='rgba(255,255,255,.2)';c.beginPath();c.ellipse(-r*.4,-r*.45,r*.36,r*.15,-.7,0,TAU);c.fill();
 },
 anker(c,d,R){                                    // liegender Anker mit Ring und Tau
  const[hell,farbe,dunkel]=d.metall;
  c.rotate((R()-.5)*1.3);
  const form=()=>{c.beginPath();c.moveTo(0,-21);c.lineTo(0,20);c.moveTo(-11,-14);c.lineTo(11,-14);
   c.moveTo(-17,6);c.quadraticCurveTo(-15,21,0,21);c.quadraticCurveTo(15,21,17,6)};
  const spitzen=()=>{c.beginPath();for(const sg of[-1,1]){c.moveTo(sg*18,-1);c.lineTo(sg*13,9);c.lineTo(sg*22.5,10);c.closePath()}};
  c.save();c.translate(4,5);c.lineCap='round';c.strokeStyle='rgba(0,0,0,.28)';c.lineWidth=5;form();c.stroke();
  spitzen();c.fillStyle='rgba(0,0,0,.28)';c.fill();kreis(c,0,-26.5,4.6);c.lineWidth=3.4;c.stroke();c.restore();
  c.lineCap='round';c.lineJoin='round';
  c.strokeStyle=dunkel;c.lineWidth=5.2;form();c.stroke();
  c.strokeStyle=farbe;c.lineWidth=3.2;c.stroke();
  c.save();c.translate(-.8,-.8);c.strokeStyle=rgba(hell,.75);c.lineWidth=1;form();c.stroke();c.restore();
  spitzen();c.fillStyle=farbe;c.fill();c.strokeStyle=dunkel;c.lineWidth=1.2;c.stroke();
  c.fillStyle=dunkel;kreis(c,0,-14,2.2);c.fill();
  c.strokeStyle=dunkel;c.lineWidth=3.8;kreis(c,0,-26.5,4.6);c.stroke();c.strokeStyle=farbe;c.lineWidth=2;c.stroke();
  c.strokeStyle=d.seil;c.lineWidth=2.3;c.beginPath();c.moveTo(3,-30);c.bezierCurveTo(16,-38,23,-22,14,-14);c.bezierCurveTo(8,-8,18,0,27,-4);c.stroke();
  c.strokeStyle=rgba(mische(d.seil,'#000000',.5),.6);c.setLineDash([1.2,2]);c.stroke();c.setLineDash([]);
 },
 muschel(c,d,R){                                  // Jakobsmuschel: Fächer mit Rippen und gewelltem Rand
  const[hell,farbe,dunkel]=d.muschel;
  c.rotate((R()-.5)*1.8);
  schattenOval(c,3,4,15,12,.28);
  const n=8,spitze=[];for(let k=0;k<=n;k++){const a=-Math.PI+.42+k/n*(Math.PI-.84);spitze.push([Math.cos(a)*14,8+Math.sin(a)*14,a])}
  const umriss=()=>{c.beginPath();c.moveTo(0,8);c.lineTo(spitze[0][0],spitze[0][1]);
   for(let k=0;k<n;k++){const m=(spitze[k][2]+spitze[k+1][2])/2;c.quadraticCurveTo(Math.cos(m)*16.5,8+Math.sin(m)*16.5,spitze[k+1][0],spitze[k+1][1])}c.closePath()};
  umriss();const rg=c.createRadialGradient(-3,-2,1,0,6,16);rg.addColorStop(0,hell);rg.addColorStop(.6,farbe);rg.addColorStop(1,dunkel);
  c.fillStyle=rg;c.fill();c.strokeStyle=rgba(dunkel,.75);c.lineWidth=.9;c.stroke();
  c.strokeStyle=rgba(dunkel,.5);c.lineWidth=.8;c.beginPath();for(let k=0;k<=n;k++){c.moveTo(0,8);c.lineTo(spitze[k][0]*.96,8+(spitze[k][1]-8)*.96)}c.stroke();
  c.fillStyle=farbe;c.beginPath();c.moveTo(-6,8);c.lineTo(-3,4);c.lineTo(3,4);c.lineTo(6,8);c.lineTo(0,10);c.closePath();c.fill();   // „Ohren“
  c.fillStyle='rgba(255,255,255,.5)';c.beginPath();c.ellipse(-4,-1,3.2,1.6,-.6,0,TAU);c.fill();
 },
 schatzkiste(c,d,R){                              // Truhe mit gewölbtem Deckel, Goldbeschlägen, verstreuten Münzen
  const[hh,hf,hd]=d.holz,[gh,gf,gd]=d.gold,b=40,h=26;
  c.rotate((R()-.5)*.5);
  for(let i=0;i<8;i++){const x=10+R()*20,y=10+R()*12;schattenOval(c,x+1,y+1.2,4,3.4,.3);kugel(c,x,y,3.3,gh,gf,gd);c.strokeStyle=rgba(gd,.8);c.lineWidth=.6;kreis(c,x,y,2.2);c.stroke()}
  for(const[x,y,f]of[[-22,12,'#ff3d5a'],[24,-4,'#3ddc97'],[-18,16,'#5bc0ff']]){c.save();c.translate(x,y);c.rotate(.6);c.fillStyle=f;c.fillRect(-2.2,-2.2,4.4,4.4);c.fillStyle='rgba(255,255,255,.7)';c.fillRect(-1.6,-1.6,1.6,1.6);c.restore()}
  schattenOval(c,6,8,30,22,.42);
  c.fillStyle=mische(hd,'#000000',.3);rundRechteck(c,-b/2+3,-h/2+4,b,h,4);c.fill();      // Seitenwand
  c.save();rundRechteck(c,-b/2,-h/2,b,h,5);c.clip();
  const lg=c.createLinearGradient(0,-h/2,0,h/2);lg.addColorStop(0,hh);lg.addColorStop(.45,hf);lg.addColorStop(1,hd);c.fillStyle=lg;c.fillRect(-b/2,-h/2,b,h);
  c.strokeStyle=rgba(hd,.75);c.lineWidth=1;c.beginPath();for(let y=-h/2+6.5;y<h/2;y+=6.5){c.moveTo(-b/2,y);c.lineTo(b/2,y)}c.stroke();
  for(const x of[-b*.3,b*.3]){const g2=c.createLinearGradient(0,-h/2,0,h/2);g2.addColorStop(0,gh);g2.addColorStop(.5,gf);g2.addColorStop(1,gd);
   c.fillStyle=g2;c.fillRect(x-2.8,-h/2,5.6,h);c.fillStyle=gd;for(const y of[-h/2+3,0,h/2-3]){kreis(c,x,y,.9);c.fill()}}
  c.fillStyle='rgba(255,255,255,.22)';c.fillRect(-b/2+3,-h/2+2.5,b-6,2);
  c.restore();
  c.strokeStyle=rgba(mische(hd,'#000000',.3),.95);c.lineWidth=1.4;rundRechteck(c,-b/2,-h/2,b,h,5);c.stroke();
  const sg=c.createLinearGradient(0,h/2-9,0,h/2+1);sg.addColorStop(0,gh);sg.addColorStop(1,gd);                        // Schloss
  c.fillStyle=sg;rundRechteck(c,-4.5,h/2-9,9,10,2);c.fill();c.strokeStyle=rgba(gd,.9);c.lineWidth=.8;c.stroke();
  c.fillStyle='#1a1006';kreis(c,0,h/2-5.5,1.3);c.fill();c.fillRect(-.6,h/2-5.5,1.2,3);
 },
 steuerrad(c,d,R){                                // Steuerrad, flach liegend: Kranz, 8 Speichen mit Griffen, Messingnabe
  const[hell,farbe,dunkel]=d.holz,[gh,gf,gd]=d.gold,r=20,rot=R()*TAU;
  const speichen=()=>{c.beginPath();for(let k=0;k<8;k++){const a=rot+k*TAU/8;c.moveTo(Math.cos(a)*5,Math.sin(a)*5);c.lineTo(Math.cos(a)*(r+7),Math.sin(a)*(r+7))}};
  c.save();c.translate(4,5);c.lineCap='round';c.strokeStyle='rgba(0,0,0,.28)';c.lineWidth=5.5;kreis(c,0,0,r);c.stroke();c.lineWidth=3.4;speichen();c.stroke();
  c.fillStyle='rgba(0,0,0,.28)';for(let k=0;k<8;k++){const a=rot+k*TAU/8;kreis(c,Math.cos(a)*(r+8.5),Math.sin(a)*(r+8.5),3.3);c.fill()}c.restore();
  c.lineCap='round';c.strokeStyle=dunkel;c.lineWidth=4;speichen();c.stroke();c.strokeStyle=farbe;c.lineWidth=2.5;c.stroke();
  for(let k=0;k<8;k++){const a=rot+k*TAU/8;kugel(c,Math.cos(a)*(r+8.5),Math.sin(a)*(r+8.5),3.3,hell,farbe,dunkel)}
  c.strokeStyle=dunkel;c.lineWidth=6.5;kreis(c,0,0,r);c.stroke();c.strokeStyle=farbe;c.lineWidth=4.6;c.stroke();
  c.strokeStyle=rgba(hell,.7);c.lineWidth=1.2;c.beginPath();c.arc(0,0,r-.9,Math.PI*.9,Math.PI*1.65);c.stroke();
  c.strokeStyle=rgba(dunkel,.6);c.lineWidth=1.2;c.beginPath();c.arc(0,0,r+.9,-Math.PI*.1,Math.PI*.65);c.stroke();
  kugel(c,0,0,6.5,gh,gf,gd);c.strokeStyle=rgba(gd,.9);c.lineWidth=1;kreis(c,0,0,3.6);c.stroke();
 },
 /* --- Vulkan --- */
 fels(c,d,R){                                     // Felsbrocken-Gruppe, kantig mit hellen Oberseiten
  const[hell,farbe,dunkel]=d.fels;
  schattenOval(c,10,12,46,36,.45);
  const teile=[[-19+R()*6,11+R()*6,13],[19+R()*5,13+R()*5,11],[0,0,24]];
  let haupt=null;
  for(const[x,y,r]of teile){
   const v=[];for(let k=0;k<7;k++){const a=k*TAU/7+(R()-.5)*.45,rr=r*(.78+R()*.3);v.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr*.9])}
   const pfad=()=>{c.beginPath();v.forEach((q,k)=>k?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath()};
   pfad();const rg=c.createRadialGradient(x-r*.4,y-r*.45,1,x,y,r*1.15);rg.addColorStop(0,hell);rg.addColorStop(.5,farbe);rg.addColorStop(1,dunkel);
   c.fillStyle=rg;c.fill();c.strokeStyle=rgba(dunkel,.85);c.lineWidth=1.2;c.stroke();
   const top=v.map(q=>[x+(q[0]-x)*.5-r*.12,y+(q[1]-y)*.5-r*.14]);                   // Oberseite (Facette)
   c.beginPath();top.forEach((q,k)=>k?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath();c.fillStyle=rgba(hell,.32);c.fill();
   c.strokeStyle=rgba(dunkel,.45);c.lineWidth=.9;c.beginPath();for(let k=0;k<7;k+=2){c.moveTo(top[k][0],top[k][1]);c.lineTo(v[k][0],v[k][1])}c.stroke();
   haupt=[x,y,r];
  }
  if(d.glutRiss&&haupt){                                                         // glühender Riss im großen Brocken
   const[x,y,r]=haupt,rs=[[x-r*.6,y-r*.1]];for(let k=1;k<5;k++)rs.push([x-r*.6+k*r*.3,y-r*.1+(R()-.5)*r*.4]);
   c.lineCap='round';c.lineJoin='round';
   for(const[lw,f]of[[4.5,rgba(d.glutRiss,.3)],[2,rgba(d.glutRiss,.95)],[.8,rgba(mische(d.glutRiss,'#ffffff',.6),.95)]]){
    c.strokeStyle=f;c.lineWidth=lw;c.beginPath();rs.forEach((q,k)=>k?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.stroke()}
  }
 },
 glutstein(c,d,R){                                // dunkler Stein mit glühenden Adern (Schein pulsiert in DEKO_ANIM)
  const gl=d.glut,[hell,farbe,dunkel]=d.fels,r=15;
  const hg=c.createRadialGradient(0,0,r*.5,0,0,r*2.3);hg.addColorStop(0,rgba(gl[1],.4));hg.addColorStop(1,rgba(gl[1],0));c.fillStyle=hg;kreis(c,0,0,r*2.3);c.fill();
  schattenOval(c,5,6,r*1.3,r*1.1,.35);
  const v=[];for(let k=0;k<8;k++){const a=k*TAU/8+(R()-.5)*.4,rr=r*(.8+R()*.28);v.push([Math.cos(a)*rr,Math.sin(a)*rr*.88])}
  const pfad=()=>{c.beginPath();v.forEach((q,k)=>k?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath()};
  pfad();const rg=c.createRadialGradient(-r*.4,-r*.45,1,0,0,r*1.1);rg.addColorStop(0,mische(farbe,hell,.4));rg.addColorStop(.6,mische(farbe,dunkel,.4));rg.addColorStop(1,dunkel);
  c.fillStyle=rg;c.fill();
  c.save();pfad();c.clip();c.lineCap='round';c.lineJoin='round';
  const adern=[];for(let k=0;k<5;k++){let a=k*TAU/5+R()*.5,x=Math.cos(a)*2,y=Math.sin(a)*2;const q=[[x,y]];for(let s=0;s<3;s++){a+=(R()-.5)*.9;x+=Math.cos(a)*r*.38;y+=Math.sin(a)*r*.38;q.push([x,y])}adern.push(q)}
  for(const[lw,f]of[[4,rgba(gl[2],.7)],[2,gl[1]],[.8,gl[0]]]){c.strokeStyle=f;c.lineWidth=lw;c.beginPath();for(const q of adern)q.forEach((p,k)=>k?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke()}
  const kg=c.createRadialGradient(0,0,0,0,0,r*.5);kg.addColorStop(0,rgba(gl[0],.9));kg.addColorStop(1,rgba(gl[1],0));c.fillStyle=kg;kreis(c,0,0,r*.5);c.fill();
  c.restore();
  pfad();c.strokeStyle='rgba(0,0,0,.55)';c.lineWidth=1.1;c.stroke();
 },
 duerrbaum(c,d,R){                                // abgestorbener Baum von oben: kahle, verzweigte Äste
  const[hell,farbe,dunkel]=d.duerr,stufen=[new Path2D(),new Path2D(),new Path2D()],breite=[4.4,2.6,1.5];
  const wachse=(x,y,a,l,st)=>{const x2=x+Math.cos(a)*l,y2=y+Math.sin(a)*l;stufen[st].moveTo(x,y);stufen[st].lineTo(x2,y2);
   if(st<2)for(const sg of[-1,1])wachse(x2,y2,a+sg*(.35+R()*.45),l*(.58+R()*.18),st+1)};
  const n=4+Math.floor(R()*2),rot=R()*TAU;
  for(let i=0;i<n;i++)wachse(0,0,rot+i*TAU/n+(R()-.5)*.5,16+R()*9,0);
  schattenOval(c,8,10,26,22,.22);
  c.lineCap='round';c.lineJoin='round';
  c.save();c.translate(6,7);c.strokeStyle='rgba(0,0,0,.26)';stufen.forEach((p,i)=>{c.lineWidth=breite[i];c.stroke(p)});c.restore();
  stufen.forEach((p,i)=>{c.strokeStyle=dunkel;c.lineWidth=breite[i]+1.3;c.stroke(p)});
  stufen.forEach((p,i)=>{c.strokeStyle=farbe;c.lineWidth=breite[i];c.stroke(p)});
  c.save();c.translate(-.7,-.7);c.strokeStyle=rgba(hell,.7);stufen.forEach((p,i)=>{c.lineWidth=breite[i]*.35;c.stroke(p)});c.restore();
  kugel(c,0,0,6,hell,farbe,dunkel);c.strokeStyle=rgba(dunkel,.7);c.lineWidth=.8;kreis(c,0,0,3.2);c.stroke();kreis(c,0,0,1.4);c.stroke();
 },
 rauch(c,d,R){                                    // Schlot im Boden (die Rauchwolken steigen in DEKO_ANIM auf)
  const gl=d.glut,[fh,ff,fd]=d.fels;
  schattenOval(c,3,4,20,13,.35);
  for(let k=0;k<6;k++){const a=k*TAU/6+R()*.4;kugel(c,Math.cos(a)*11,Math.sin(a)*7.5,3.5+R()*2,fh,ff,fd)}
  c.fillStyle='#0a0605';c.beginPath();c.ellipse(0,0,8.5,5.8,-.25,0,TAU);c.fill();
  const rg=c.createRadialGradient(0,0,0,0,0,8);rg.addColorStop(0,rgba(gl[0],.95));rg.addColorStop(.45,rgba(gl[1],.75));rg.addColorStop(1,rgba(gl[2],0));
  c.fillStyle=rg;c.beginPath();c.ellipse(0,0,7.5,5,-.25,0,TAU);c.fill();
 },
 kristall(c,d,R){                                 // Kristallgruppe: facettierte Spitzen mit Leuchten
  const[hell,farbe,dunkel]=d.kristall,[fh,ff,fd]=d.fels;
  const hg=c.createRadialGradient(0,-8,2,0,-8,38);hg.addColorStop(0,rgba(farbe,.35));hg.addColorStop(1,rgba(farbe,0));c.fillStyle=hg;kreis(c,0,-8,38);c.fill();
  schattenOval(c,8,9,24,17,.35);
  const n=4+Math.floor(R()*3),sp=[];
  for(let i=0;i<n;i++)sp.push([-Math.PI/2+(i-(n-1)/2)*.55+(R()-.5)*.3,15+R()*17,4.2+R()*2.6]);
  sp.sort((a,b)=>b[1]-a[1]);
  for(const[a,L,w]of sp){
   c.save();c.rotate(a+Math.PI/2);
   viereck(c,[-w,2],[-w,-L*.72],[0,-L],[0,2],mische(hell,farbe,.35));
   viereck(c,[0,2],[0,-L],[w,-L*.72],[w,2],mische(farbe,dunkel,.4));
   viereck(c,[-w,-L*.72],[0,-L],[w,-L*.72],[0,-L*.6],rgba(hell,.75));
   c.strokeStyle=rgba(dunkel,.7);c.lineWidth=.8;c.beginPath();c.moveTo(-w,2);c.lineTo(-w,-L*.72);c.lineTo(0,-L);c.lineTo(w,-L*.72);c.lineTo(w,2);c.stroke();
   c.strokeStyle=rgba(hell,.8);c.lineWidth=.7;c.beginPath();c.moveTo(0,0);c.lineTo(0,-L);c.stroke();
   c.restore();
  }
  for(const x of[-7,0,7])kugel(c,x,3+Math.abs(x)*.2,4.5,fh,ff,fd);
  const t=sp[sp.length-1];c.fillStyle='#ffffff';sternPfad(c,Math.cos(t[0])*t[1]*.8,Math.sin(t[0])*t[1]*.8,4,1,4,0);c.fill();
 }
};
/* Bewegte Teile einzelner Deko-Objekte, PRO BILD (c, d, t, s): gleiche Koordinaten wie oben,
   t = Spielzeit ms, s = fester Zufall 0..1 je Objekt. Billig halten! */
const DEKO_ANIM={
 rauch(c,d,t,s){                                  // aufsteigende, wachsende, verblassende Rauchwolken (leicht vom Wind verweht)
  const[hell,dunkel]=d.rauch,rg=c.createRadialGradient(0,0,0,0,0,1);
  rg.addColorStop(0,rgba(hell,.6));rg.addColorStop(.6,rgba(mische(hell,dunkel,.5),.32));rg.addColorStop(1,rgba(dunkel,0));
  c.fillStyle=rg;
  const u=[];for(let k=0;k<6;k++)u.push(mod(t*.00016+k/6+s,1));
  u.sort((a,b)=>b-a);                                                           // ältere (höhere) zuerst
  for(const v of u){
   const r=7+v*24;c.globalAlpha=Math.sin(v*Math.PI)*(.9-v*.45);
   c.save();c.translate(Math.sin(v*3.2+s*TAU)*7+v*v*26,-5-v*100);c.scale(r,r*.9);kreis(c,0,0,1);c.fill();c.restore();
  }
  c.globalAlpha=1;
 },
 glutstein(c,d,t,s){                              // Glutschein pulsiert
  const p=.5+.5*Math.sin(t*.0026+s*TAU),gl=d.glut;
  c.globalCompositeOperation='lighter';
  const rg=c.createRadialGradient(0,0,3,0,0,30);rg.addColorStop(0,rgba(gl[1],.12+.22*p));rg.addColorStop(1,rgba(gl[1],0));
  c.fillStyle=rg;kreis(c,0,0,30);c.fill();
 }
};

/* ---------- 7. Bewegte Teile pro Bild ----------
   f = Bild-Umgebung: c ctx, th Thema, kam, pr, t (Spielzeit ms), now (Uhr ms), geo, bahn */

/* Zone zuschneiden: auf die Zone selbst und ohne spätere, überlappende Zonen (die „gewinnen“) */
function clipZone(c,zg,selbst){if(selbst!==false)c.clip(zg.pfad);for(const s of zg.spaeter)c.clip(s.inv,'evenodd')}
function zonenAnim(f){
 for(const zg of f.geo.zonen){
  switch(zg.z.typ){
   case'wasser':wasserAnim(f,zg);break;
   case'lava':lavaAnim(f,zg);break;
   case'eis':eisAnim(f,zg);break;
   case'hang':hangAnim(f,zg);break;
   case'boost':boostAnim(f,zg);break;
  }
 }
}
function wasserAnim(f,zg){
 const c=f.c,w=f.th.wasser,b=zg.box,t=f.t;
 c.save();clipZone(c,zg);
 c.lineWidth=1.6;c.strokeStyle=rgba(w.glanz,.17);c.beginPath();             // Wellenlinien
 for(let y=b.y+8,row=0;y<b.y+b.h;y+=18,row++){
  const ph=t*.0016+row*1.3;
  for(let x=b.x-10,i=0;x<=b.x+b.b+10;x+=16,i++){const yy=y+Math.sin(x*.035+ph)*3+Math.sin(x*.011-ph*.7)*2;i?c.lineTo(x,yy):c.moveTo(x,yy)}
 }
 c.stroke();
 c.globalCompositeOperation='lighter';c.fillStyle=w.glanz;                  // Glitzern
 for(const gp of zg.glitzer){
  let a=Math.sin(t*.004*gp[3]+gp[2]);if(a<=.55)continue;a=(a-.55)/.45;
  const r=2+a*2.5;c.globalAlpha=a*.9;c.beginPath();
  c.moveTo(gp[0],gp[1]-r*1.8);c.lineTo(gp[0]+r*.45,gp[1]);c.lineTo(gp[0],gp[1]+r*1.8);c.lineTo(gp[0]-r*.45,gp[1]);c.closePath();
  c.moveTo(gp[0]-r*1.8,gp[1]);c.lineTo(gp[0],gp[1]-r*.45);c.lineTo(gp[0]+r*1.8,gp[1]);c.lineTo(gp[0],gp[1]+r*.45);c.closePath();c.fill();
 }
 c.restore();
 c.save();clipZone(c,zg,false);                                             // Schaum am Ufer
 c.strokeStyle=rgba(w.schaum,.6);c.lineWidth=3;c.setLineDash([9,13]);c.lineDashOffset=-t*.012;c.stroke(zg.pfad);
 c.strokeStyle=rgba(w.schaum,.32);c.lineWidth=5;c.setLineDash([4,19]);c.lineDashOffset=t*.008;c.stroke(zg.pfad);
 c.restore();
}
function lavaAnim(f,zg){
 const c=f.c,lv=f.th.lava,b=zg.box,t=f.t,puls=.5+.5*Math.sin(t*.003);
 c.save();clipZone(c,zg);c.globalCompositeOperation='lighter';
 zg.blasen.forEach((q,i)=>{
  if(i<4){                                                                  // wandernde Glutflecken
   const x=b.cx+Math.cos(t*.0004*q[2]+q[3])*b.b*.3,y=b.cy+Math.sin(t*.0005*q[2]+q[3]*1.3)*b.h*.3,r=40+q[0]*50;
   const rg=c.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,rgba(lv.hell,.22+.14*puls));rg.addColorStop(1,rgba(lv.hell,0));
   c.fillStyle=rg;c.fillRect(x-r,y-r,2*r,2*r);
  }else{                                                                    // Blasen, die platzen
   const zyk=mod(t*.0009*q[2]+q[3],1),x=b.x+q[0]*b.b,y=b.y+q[1]*b.h;
   c.globalAlpha=zyk<.85?.75:(1-zyk)/.15*.75;c.strokeStyle=lv.hell;c.lineWidth=1.6;kreis(c,x,y,2+zyk*8);c.stroke();c.globalAlpha=1;
  }
 });
 if(lv.kraeftig){
  c.strokeStyle=rgba(lv.hell,.16+.2*puls);c.lineWidth=12;c.stroke(zg.pfad);   // glühender Innenrand
  c.fillStyle=lv.hell;c.strokeStyle=lv.hell;c.lineWidth=1.4;
  for(const q of zg.blasen2){                                                // Blasen wachsen, platzen, Ring verläuft
   const zyk=mod(t*.0006*q[2]+q[3],1),r=q[4]*Math.min(1,zyk/.75);
   if(zyk<.8){c.globalAlpha=.28+.3*zyk;kreis(c,q[0],q[1],r);c.fill();c.globalAlpha=.7;c.stroke()}
   else{const u=(zyk-.8)/.2;c.globalAlpha=(1-u)*.8;kreis(c,q[0],q[1],q[4]+u*10);c.stroke()}
  }
  c.globalAlpha=1;
 }
 c.restore();
}
function eisAnim(f,zg){
 const c=f.c,b=zg.box,t=f.t,u=mod(t+zg.i*900,4600)/1500;
 c.save();clipZone(c,zg);c.globalCompositeOperation='lighter';
 if(u<1){                                                                   // Glanz huscht über das Eis
  const S=Math.hypot(b.b,b.h)+40,x=-S/2+S*u;
  c.save();c.translate(b.cx,b.cy);c.rotate(-.6);
  const lg=c.createLinearGradient(x-45,0,x+45,0);lg.addColorStop(0,'rgba(255,255,255,0)');lg.addColorStop(.5,'rgba(255,255,255,.4)');lg.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=lg;c.fillRect(x-45,-S/2,90,S);
  c.restore();
 }
 c.fillStyle='#ffffff';
 for(const gp of zg.glitzer){
  let a=Math.sin(t*.003*gp[3]+gp[2]);if(a<=.7)continue;a=(a-.7)/.3;
  const r=1.5+a*2.5;c.globalAlpha=a;c.beginPath();
  c.moveTo(gp[0],gp[1]-r*2);c.lineTo(gp[0]+r*.4,gp[1]);c.lineTo(gp[0],gp[1]+r*2);c.lineTo(gp[0]-r*.4,gp[1]);c.closePath();
  c.moveTo(gp[0]-r*2,gp[1]);c.lineTo(gp[0],gp[1]-r*.4);c.lineTo(gp[0]+r*2,gp[1]);c.lineTo(gp[0],gp[1]+r*.4);c.closePath();c.fill();
 }
 c.restore();
}
function hangAnim(f,zg){
 const c=f.c,z=zg.z,d=normiert(z.richtung),st=clamp(+z.staerke||1,.3,3),b=zg.box;
 const R=Math.hypot(b.b,b.h)/2+20,sx=64,sy=56,off=mod(f.t*.018*st,sx);
 c.save();clipZone(c,zg);c.translate(b.cx,b.cy);c.rotate(Math.atan2(d[1],d[0]));
 c.strokeStyle=rgba(f.th.hang.pfeil,Math.min(.34,.14+st*.06));c.lineWidth=3;c.lineCap='round';c.lineJoin='round';c.beginPath();
 for(let v=-R,row=0;v<R;v+=sy,row++)for(let u=-R-sx+off;u<R+sx;u+=sx){const uu=u+(row%2)*sx/2;c.moveTo(uu-7,v-8);c.lineTo(uu+3,v);c.lineTo(uu-7,v+8)}
 c.stroke();c.restore();
}
function boostAnim(f,zg){
 const c=f.c,z=zg.z,bo=f.th.boost,b=zg.box,d=normiert(z.richtung),r=Math.max(8,b.r),t=f.t;
 c.save();clipZone(c,zg);c.globalCompositeOperation='lighter';
 const puls=.5+.5*Math.sin(t*.008);
 const rg=c.createRadialGradient(b.cx,b.cy,0,b.cx,b.cy,r);rg.addColorStop(0,rgba(bo.farbe,.18+.2*puls));rg.addColorStop(1,rgba(bo.farbe,0));
 c.fillStyle=rg;c.fillRect(b.cx-r,b.cy-r,2*r,2*r);
 c.translate(b.cx,b.cy);c.rotate(Math.atan2(d[1],d[0]));
 c.lineCap='round';c.lineJoin='round';
 for(let i=0;i<3;i++){
  const p=mod(t*.0022+i/3,1),u=(-.6+p*1.2)*r,a=Math.sin(p*Math.PI),s=r*.36;
  c.globalAlpha=a;c.strokeStyle=bo.farbe;c.lineWidth=r*.16;
  c.beginPath();c.moveTo(u-s*.7,-s);c.lineTo(u+s*.3,0);c.lineTo(u-s*.7,s);c.stroke();
  c.strokeStyle=bo.kern;c.lineWidth=r*.06;c.stroke();
 }
 c.restore();
}

/* Objekte */
const bumperZeit=new Map();
function objekteAnim(f,baelle){
 (Array.isArray(f.bahn.objekte)?f.bahn.objekte:[]).forEach((o,i)=>{
  if(!o)return;
  switch(o.typ){
   case'bumper':bumperAnim(f,o,i,baelle);break;
   case'block':blockAnim(f,o);break;
   case'muehle':muehleAnim(f,o);break;
   case'tor':torAnim(f,o);break;
   case'tele':if(o.a&&o.b){const r=+o.r||28;portal(f,+o.a.x,+o.a.y,r,f.th.tele.a,false);portal(f,+o.b.x,+o.b.y,r,f.th.tele.b,true)}break;
  }
 });
}
function bumperAnim(f,o,i,baelle){
 const c=f.c,bu=f.th.bumper,r=+o.r||24,key=f.bahn.id+'#'+i;
 let hit=bumperZeit.has(key)?bumperZeit.get(key):-1e9;
 for(const b of baelle)if(!b.versenkt&&Math.hypot(b.x-o.x,b.y-o.y)<r+BALL_R+3)hit=f.now;  // Ball berührt → aufleuchten
 bumperZeit.set(key,hit);
 const e=clamp(1-(f.now-hit)/380,0,1);
 c.save();aufrecht(c,f.kam,+o.x,+o.y);const sc=1+e*.1;c.scale(sc,sc);
 if(e>0){c.globalCompositeOperation='lighter';const rg=c.createRadialGradient(0,0,r*.8,0,0,r*2);rg.addColorStop(0,rgba(bu.glow,.7*e));rg.addColorStop(1,rgba(bu.glow,0));c.fillStyle=rg;kreis(c,0,0,r*2);c.fill();c.globalCompositeOperation='source-over'}
 if(bu.stil==='rettungsring')bumperRing(c,bu,r);
 else if(bu.stil==='glut')bumperGlut(c,bu,r,f.t,i);
 else{
  c.fillStyle=bu.dunkel;kreis(c,0,0,r);c.fill();
  const rg=c.createRadialGradient(-r*.3,-r*.35,r*.1,0,0,r);rg.addColorStop(0,mische(bu.ring,'#ffffff',.45));rg.addColorStop(.6,bu.ring);rg.addColorStop(1,bu.dunkel);
  c.fillStyle=rg;kreis(c,0,0,r-1.5);c.fill();
  c.fillStyle=mische(bu.dunkel,'#000000',.3);kreis(c,0,0,r*.6);c.fill();
  kugel(c,0,0,r*.52,'#ffffff',bu.kern,mische(bu.kern,'#000000',.35));
  c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=Math.max(1.5,r*.12);c.lineCap='round';c.beginPath();c.arc(0,0,r*.8,Math.PI*1.05,Math.PI*1.45);c.stroke();
 }
 if(e>0){c.globalCompositeOperation='lighter';c.fillStyle=rgba(bu.glow,.5*e);kreis(c,0,0,r);c.fill()}
 c.restore();
}
/* Bumper 'rettungsring': rot-weißer Ring mit Tau um einen Fassdeckel (Piratenbucht) */
function bumperRing(c,bu,r){
 const ri=r*.56,rm=(r+ri)/2,bw=r-ri-1.2,holz=bu.holz||'#a86e3c';
 c.fillStyle=bu.dunkel;kreis(c,0,0,r);c.fill();
 c.save();kreis(c,0,0,ri);c.clip();                                          // Fassdeckel
 const lg=c.createLinearGradient(-ri,-ri,ri,ri);lg.addColorStop(0,mische(holz,'#ffffff',.25));lg.addColorStop(1,mische(holz,'#000000',.45));
 c.fillStyle=lg;c.fillRect(-ri,-ri,2*ri,2*ri);
 c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=1;c.beginPath();for(let x=-ri+5;x<ri;x+=5){c.moveTo(x,-ri);c.lineTo(x,ri)}c.stroke();
 c.restore();
 c.strokeStyle='#3a3530';c.lineWidth=2;kreis(c,0,0,ri-1);c.stroke();
 c.lineWidth=bw;c.strokeStyle=bu.kern;kreis(c,0,0,rm);c.stroke();          // Ring weiß …
 c.strokeStyle=bu.ring;c.beginPath();for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/8;c.moveTo(Math.cos(a)*rm,Math.sin(a)*rm);c.arc(0,0,rm,a,a+Math.PI/4)}c.stroke();   // … mit roten Vierteln
 const sg=c.createRadialGradient(-r*.3,-r*.35,r*.1,0,0,r);sg.addColorStop(0,'rgba(255,255,255,.3)');sg.addColorStop(.55,'rgba(255,255,255,0)');sg.addColorStop(1,'rgba(0,0,0,.38)');
 c.strokeStyle=sg;kreis(c,0,0,rm);c.stroke();
 const seil=bu.seil||'#e6cf98';
 c.strokeStyle=seil;c.lineWidth=1.3;c.setLineDash([3,2]);kreis(c,0,0,r-1);c.stroke();c.setLineDash([]);
 c.lineWidth=2.4;c.lineCap='round';c.strokeStyle=mische(seil,'#000000',.2);c.beginPath();
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/8;c.moveTo(Math.cos(a)*(ri+1),Math.sin(a)*(ri+1));c.lineTo(Math.cos(a)*(r-.5),Math.sin(a)*(r-.5))}c.stroke();
 c.strokeStyle='rgba(255,255,255,.65)';c.lineWidth=Math.max(1.5,r*.1);c.beginPath();c.arc(0,0,rm,Math.PI*1.05,Math.PI*1.4);c.stroke();
}
/* Bumper 'glut': krustiger Glutbrocken mit pulsierenden Rissen (Vulkan) */
function bumperGlut(c,bu,r,t,i){
 const R=zufall(hashText('glut#'+i)),v=[],puls=.5+.5*Math.sin(t*.004+i*1.7);
 for(let k=0;k<9;k++){const a=k*TAU/9+(R()-.5)*.4,rr=r*(.86+R()*.16);v.push([Math.cos(a)*rr,Math.sin(a)*rr])}
 const risse=[];for(let k=0;k<5;k++){let a=k*TAU/5+R()*.6,x=Math.cos(a)*r*.15,y=Math.sin(a)*r*.15;const q=[[x,y]];for(let s=0;s<3;s++){a+=(R()-.5)*.9;x+=Math.cos(a)*r*.3;y+=Math.sin(a)*r*.3;q.push([x,y])}risse.push(q)}
 const umriss=()=>{c.beginPath();v.forEach((q,k)=>k?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath()};
 const rissPfad=()=>{c.beginPath();for(const q of risse)q.forEach((p,k)=>k?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]))};
 c.save();c.globalCompositeOperation='lighter';
 const hg=c.createRadialGradient(0,0,r*.5,0,0,r*1.7);hg.addColorStop(0,rgba(bu.glow,.22+.2*puls));hg.addColorStop(1,rgba(bu.glow,0));
 c.fillStyle=hg;kreis(c,0,0,r*1.7);c.fill();c.restore();
 umriss();const rg=c.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r*1.05);
 rg.addColorStop(0,mische(bu.dunkel,'#ffffff',.28));rg.addColorStop(.6,bu.dunkel);rg.addColorStop(1,mische(bu.dunkel,'#000000',.6));
 c.fillStyle=rg;c.fill();c.strokeStyle='rgba(0,0,0,.6)';c.lineWidth=1.2;c.stroke();
 c.save();umriss();c.clip();c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
 rissPfad();c.strokeStyle=rgba(bu.ring,.5+.35*puls);c.lineWidth=r*.2;c.stroke();
 c.strokeStyle=rgba(bu.kern,.65+.35*puls);c.lineWidth=r*.07;c.stroke();
 const kg=c.createRadialGradient(0,0,0,0,0,r*.45);kg.addColorStop(0,rgba(bu.kern,.35+.4*puls));kg.addColorStop(1,rgba(bu.ring,0));c.fillStyle=kg;kreis(c,0,0,r*.45);c.fill();
 c.restore();
 c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.ellipse(-r*.38,-r*.42,r*.26,r*.13,-.6,0,TAU);c.fill();
}
/* Lichtkanten eines achsparallelen Rechtecks (im Feld), passend zur Drehung */
function lichtKanten(c,kam,x,y,b,h,hell){
 const kanten=[[[0,-1],x,y,b,3],[[0,1],x,y+h-3,b,3],[[-1,0],x,y,3,h],[[1,0],x+b-3,y,3,h]];
 for(const[n,a,bb,w,hh]of kanten){const fk=lichtFaktor(kam,n);c.fillStyle=fk>0?rgba(hell,fk*.85):'rgba(0,0,0,'+(-fk*.3).toFixed(3)+')';c.fillRect(a,bb,w,hh)}
}
function blockAnim(f,o){
 if(!Array.isArray(o.rect))return;
 const c=f.c,bl=f.th.block,sv=f.kam.schatten,kam=f.kam;
 const[x0,y0,b,h]=o.rect.map(Number),d=Array.isArray(o.bahn)?o.bahn.map(Number):[0,0],per=+o.periode||3000,P=Math.abs(per);
 const s=Math.sin(TAU*mod(f.t,P)/P)*(per<0?-1:1);              // FORMAT: Versatz = (dx,dy)·sin(2π·t/periode)
 const x=x0+d[0]*s,y=y0+d[1]*s;
 c.fillStyle='rgba(0,0,0,.15)';rundRechteck(c,x+sv[0]*9,y+sv[1]*9,b,h,5);c.fill();
 c.fillStyle='rgba(0,0,0,.22)';rundRechteck(c,x+sv[0]*4.5,y+sv[1]*4.5,b,h,4);c.fill();
 c.save();
 if(bl.stil==='eisblock')c.globalAlpha=.9;
 c.fillStyle=bl.dunkel;rundRechteck(c,x,y,b,h,4);c.fill();
 c.fillStyle=bl.farbe;rundRechteck(c,x+2,y+2,b-4,h-4,3);c.fill();
 c.save();rundRechteck(c,x,y,b,h,4);c.clip();
 lichtKanten(c,kam,x,y,b,h,bl.hell);
 const ix=x+5,iy=y+5,ib=Math.max(0,b-10),ih=Math.max(0,h-10);
 switch(bl.stil){
  case'kiste':
   c.strokeStyle=rgba(bl.dunkel,.35);c.lineWidth=1;c.beginPath();
   if(b>=h)for(let yy=iy+8;yy<iy+ih;yy+=8){c.moveTo(ix,yy);c.lineTo(ix+ib,yy)}else for(let xx=ix+8;xx<ix+ib;xx+=8){c.moveTo(xx,iy);c.lineTo(xx,iy+ih)}
   c.stroke();
   c.strokeStyle=rgba(bl.dunkel,.85);c.lineWidth=2;c.strokeRect(ix,iy,ib,ih);
   c.lineWidth=3;c.beginPath();c.moveTo(ix,iy+ih);c.lineTo(ix+ib,iy);c.stroke();
   c.strokeStyle=rgba(bl.hell,.6);c.lineWidth=1;c.beginPath();c.moveTo(ix-1,iy+ih-1.5);c.lineTo(ix+ib-1.5,iy-1);c.stroke();
   c.fillStyle='#4a3a2a';for(const[px,py]of[[ix,iy],[ix+ib,iy],[ix,iy+ih],[ix+ib,iy+ih]]){kreis(c,px,py,1.3);c.fill()}
   break;
  case'stein':{
   const R=zufall(hashText(o.rect.join(',')));
   for(let i=0;i<Math.min(40,b*h/120);i++){c.fillStyle=R()<.5?rgba(bl.dunkel,.35):rgba(bl.hell,.5);c.fillRect(x+R()*b,y+R()*h,1.6,1.6)}
   c.strokeStyle=rgba(bl.dunkel,.55);c.lineWidth=1.2;c.beginPath();c.moveTo(x+b*.25,y+2);c.lineTo(x+b*.32,y+h*.45);c.lineTo(x+b*.28,y+h-2);c.stroke();
   break;}
  case'eisblock':
   c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=2;c.strokeRect(x+3.5,y+3.5,b-7,h-7);
   c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.moveTo(x+b*.15,y+h);c.lineTo(x+b*.35,y);c.lineTo(x+b*.45,y);c.lineTo(x+b*.25,y+h);c.closePath();c.fill();
   for(const[u,v,r]of[[.7,.35,2],[.78,.6,1.4],[.62,.7,1.1]]){c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=.9;kreis(c,x+b*u,y+h*v,r);c.stroke()}
   break;
  case'metall':{
   streifen(c,x,y,b,h,6,'#ffc53d');
   c.fillStyle='#141414';rundRechteck(c,x+5,y+5,b-10,h-10,2);c.fill();
   c.fillStyle=bl.farbe;rundRechteck(c,x+6,y+6,b-12,h-12,2);c.fill();
   c.fillStyle=bl.hell;for(const[px,py]of[[x+9,y+9],[x+b-9,y+9],[x+9,y+h-9],[x+b-9,y+h-9]]){if(b>20&&h>20){kreis(c,px,py,1.6);c.fill()}}
   break;}
  case'basalt':{                                                    // Basaltsäulen-Block mit glühendem Riss
   const R=zufall(hashText('basalt|'+o.rect.join(','))),quer=b>=h,lang=quer?b:h,kurz=quer?h:b,n=Math.max(1,Math.round(lang/26));
   const P=(u,v)=>quer?[x+u,y+v]:[x+v,y+u];
   c.strokeStyle=rgba(bl.dunkel,.85);c.lineWidth=1.5;c.beginPath();
   for(let s=1;s<n;s++){const u=lang*s/n+(R()-.5)*6,q1=P(u,0),q2=P(u+(R()-.5)*7,kurz*.5),q3=P(u+(R()-.5)*7,kurz);c.moveTo(q1[0],q1[1]);c.lineTo(q2[0],q2[1]);c.lineTo(q3[0],q3[1])}
   c.stroke();
   for(let i=0;i<Math.min(40,b*h/110);i++){c.fillStyle=R()<.5?rgba(bl.dunkel,.4):rgba(bl.hell,.35);c.fillRect(x+R()*b,y+R()*h,1.5,1.5)}
   if(bl.glut){
    const pts=[];for(let k=0;k<=6;k++)pts.push(P(lang*(.08+k*.84/6),kurz*(.5+(k%2?.18:-.18)*(R()*.8+.4))));
    c.save();c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
    for(const[lw,f]of[[3.4,rgba(bl.glut,.45)],[1.6,rgba(bl.glut,.95)],[.7,'rgba(255,236,170,.9)']]){c.strokeStyle=f;c.lineWidth=lw;c.beginPath();pts.forEach((q,k)=>k?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.stroke()}
    c.restore();
   }
   break;}
 }
 c.restore();
 if(bl.stil==='metall'&&f.th.bande.neon){c.globalCompositeOperation='lighter';c.strokeStyle=rgba(f.th.bande.neon,.7);c.lineWidth=1.5;rundRechteck(c,x+.75,y+.75,b-1.5,h-1.5,4);c.stroke()}
 c.restore();
}
function muehleAnim(f,o){
 const c=f.c,m=f.th.muehle,sv=f.kam.schatten,n=Math.max(1,(o.fluegel|0)||4),L=+o.laenge||160,per=+o.periode||4000,P=Math.abs(per);
 const w0=TAU*mod(f.t,P)/P*(per<0?-1:1);                          // FORMAT: Winkel = 2π·t/periode (+ k·2π/fluegel)
 const x=+o.x,y=+o.y,hb=BALKEN/2;
 c.fillStyle='rgba(0,0,0,.22)';
 for(let k=0;k<n;k++){c.save();c.translate(x+sv[0]*7,y+sv[1]*7);c.rotate(w0+k*TAU/n);rundRechteck(c,-hb,-hb,L+BALKEN,BALKEN,hb);c.fill();c.restore()}
 for(let k=0;k<n;k++){
  c.save();c.translate(x,y);c.rotate(w0+k*TAU/n);
  // Flügel = Kapsel um die Strecke Mitte→Spitze (wie physik.js: Dicke 14, runde Enden)
  rundRechteck(c,-hb,-hb,L+BALKEN,BALKEN,hb);c.fillStyle=mische(m.fluegel,'#000000',.4);c.fill();
  rundRechteck(c,-hb+1.5,-hb+1.5,L+BALKEN-3,BALKEN-3,hb-1.5);
  if(m.stil==='obsidian'){const lg=c.createLinearGradient(0,-hb,0,hb);lg.addColorStop(0,mische(m.fluegel,m.glanz||'#ffffff',.35));lg.addColorStop(.45,m.fluegel);lg.addColorStop(1,'#000000');c.fillStyle=lg}
  else c.fillStyle=m.fluegel;
  c.fill();
  if(m.streifen){c.save();c.clip();c.fillStyle=m.streifen;for(let s=26;s<L;s+=52)c.fillRect(s,-hb,26,BALKEN);c.restore()}
  c.fillStyle=m.glanz?rgba(m.glanz,.55):'rgba(255,255,255,.45)';c.fillRect(6,-hb+2.5,Math.max(0,L-14),m.glanz?1.4:2.2);
  if(m.kante){c.globalCompositeOperation='lighter';c.strokeStyle=rgba(m.kante,.7);c.lineWidth=1.2;rundRechteck(c,-hb+.6,-hb+.6,L+BALKEN-1.2,BALKEN-1.2,hb-.6);c.stroke()}   // Glühkante
  c.restore();
 }
 c.save();aufrecht(c,f.kam,x,y);
 kugel(c,0,0,15,m.nabeHell,m.nabe,mische(m.nabe,'#000000',.5));
 c.strokeStyle='rgba(0,0,0,.4)';c.lineWidth=1.5;kreis(c,0,0,15);c.stroke();
 c.fillStyle=m.nabeHell;kreis(c,0,0,4.5);c.fill();
 c.restore();
}
function torAnim(f,o){
 const c=f.c,tp=f.th.tor,sv=f.kam.schatten,b=+o.b||120,auf=Math.max(0,+o.offen||0),zuD=Math.max(0,+o.zu||0),T=auf+zuD;
 let zu=false,p=0;
 if(T>0){p=mod(f.t,T);zu=p>=auf}                                   // FORMAT: zu, wenn (t mod (offen+zu)) ≥ offen
 // Ausfahren der Schranke (nur Optik): zu → in 60 ms ganz da, offen → in 120 ms eingefahren
 let e=T<=0?0:zu?clamp((p-auf)/60,0,1):clamp(1-p/120,0,1);
 if(T>0&&auf===0)e=1;if(T>0&&zuD===0)e=0;
 const L=+o.x-b/2,y=+o.y,len=b*e,hb=BALKEN/2;
 if(e<1){c.save();c.setLineDash([7,6]);c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=1.6;rundRechteck(c,L,y-hb,b,BALKEN,4);c.stroke();c.restore()}
 if(len>1){
  c.fillStyle='rgba(0,0,0,.25)';rundRechteck(c,L+sv[0]*5,y-hb+sv[1]*5,len,BALKEN,4);c.fill();
  c.save();rundRechteck(c,L,y-hb,len,BALKEN,4);c.fillStyle=tp.balken;c.fill();c.clip();
  if(tp.stil==='gitter'){                                         // Fallgitter: Eisenstäbe mit Nieten, wandern mit der Spitze
   c.strokeStyle=tp.streifen;c.lineWidth=2.4;c.beginPath();
   for(let xx=L+len-5;xx>L;xx-=9){c.moveTo(xx,y-hb);c.lineTo(xx,y+hb)}
   c.moveTo(L,y);c.lineTo(L+len,y);c.stroke();
   c.fillStyle=mische(tp.streifen,'#ffffff',.45);c.beginPath();
   for(let xx=L+len-5;xx>L;xx-=9){c.moveTo(xx+1.5,y);c.arc(xx,y,1.5,0,TAU)}c.fill();
   c.fillStyle='rgba(255,255,255,.22)';c.fillRect(L,y-hb+1,len,1.6);
  }else{
   streifen(c,L-20,y-hb,len+40,BALKEN,9,tp.streifen);
   c.fillStyle='rgba(255,255,255,.35)';c.fillRect(L,y-hb+1.5,len,2);
  }
  c.restore();
  c.strokeStyle='rgba(0,0,0,.45)';c.lineWidth=1.2;rundRechteck(c,L,y-hb,len,BALKEN,4);c.stroke();
 }
 // Lampen: grün = offen, rot = zu, gelb blinkend = gleich wechselt es
 const rest=zu?T-p:auf-p,warn=T>0&&auf>0&&zuD>0&&rest<380;
 let farbe=zu?'#ff4d6d':'#3ddc97';if(warn&&Math.floor(f.t/90)%2===0)farbe='#ffc53d';
 for(const px of[L-8,L+b+8]){
  c.save();c.globalCompositeOperation='lighter';
  const rg=c.createRadialGradient(px,y,0,px,y,13);rg.addColorStop(0,rgba(farbe,.6));rg.addColorStop(1,rgba(farbe,0));c.fillStyle=rg;kreis(c,px,y,13);c.fill();
  c.restore();
  c.fillStyle=farbe;kreis(c,px,y,4.2);c.fill();c.fillStyle='rgba(255,255,255,.8)';kreis(c,px-1.2,y-1.2,1.3);c.fill();
 }
}
/* Teleporter: a = Eingang (Wirbel nach innen, gestrichelter Ring), b = Ausgang (Wirbel nach außen, Wellenringe) */
function portal(f,x,y,r,farbe,ausgang){
 const c=f.c,t=f.t,sg=ausgang?-1:1;
 c.save();c.translate(x,y);c.globalCompositeOperation='lighter';
 const puls=.5+.5*Math.sin(t*.005+(ausgang?1.5:0));
 let rg=c.createRadialGradient(0,0,r*.2,0,0,r*1.6);rg.addColorStop(0,rgba(farbe,.55));rg.addColorStop(.6,rgba(farbe,.16+.1*puls));rg.addColorStop(1,rgba(farbe,0));
 c.fillStyle=rg;kreis(c,0,0,r*1.6);c.fill();
 const rot=t*.0045*sg;c.lineCap='round';c.strokeStyle=rgba(mische(farbe,'#ffffff',.35),.75);c.lineWidth=2.6;
 for(let arm=0;arm<3;arm++){c.beginPath();for(let s=0;s<=14;s++){const u=s/14,rr=r*(.12+.88*u),a=rot+arm*TAU/3+sg*u*2.8;s?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr)}c.stroke()}
 rg=c.createRadialGradient(0,0,0,0,0,r*.45);rg.addColorStop(0,'rgba(255,255,255,.95)');rg.addColorStop(1,rgba(farbe,0));c.fillStyle=rg;kreis(c,0,0,r*.45);c.fill();
 if(ausgang){for(let i=0;i<2;i++){const p=mod(t*.0011+i/2,1);c.strokeStyle=rgba(farbe,(1-p)*.8);c.lineWidth=2;kreis(c,0,0,r*(.35+p*.95));c.stroke()}}
 else{c.save();c.rotate(-rot*1.5);c.setLineDash([5,6]);c.strokeStyle=rgba(farbe,.85);c.lineWidth=2.2;kreis(c,0,0,r*.98);c.stroke();c.restore()}
 c.fillStyle='#ffffff';for(let i=0;i<4;i++){const a=rot*1.8+i*TAU/4;kreis(c,Math.cos(a)*r*.8,Math.sin(a)*r*.8,1.6);c.fill()}
 c.restore();
}

/* Funkeln im Hintergrund (Eis/Weltraum) */
function funkelnAnim(f,liste){
 if(!liste||!liste.length)return;const c=f.c;
 c.save();c.globalCompositeOperation='lighter';c.fillStyle='#ffffff';
 for(const s of liste){
  let a=Math.sin(f.t*.002*s[4]+s[3]);if(a<.25)continue;a=(a-.25)/.75;
  const r=s[2]*(.5+a*.8);c.globalAlpha=a*.9;c.beginPath();
  c.moveTo(s[0],s[1]-r*2.4);c.lineTo(s[0]+r*.4,s[1]);c.lineTo(s[0],s[1]+r*2.4);c.lineTo(s[0]-r*.4,s[1]);c.closePath();
  c.moveTo(s[0]-r*2.4,s[1]);c.lineTo(s[0],s[1]-r*.4);c.lineTo(s[0]+r*2.4,s[1]);c.lineTo(s[0],s[1]+r*.4);c.closePath();c.fill();
 }
 c.restore();
}

/* Hintergrund pro Bild: Wellenkronen (meer), fließende Lava und aufsteigende Glut (basalt).
   an = ebene.anim (in baueEbene gesammelt). Wenige Striche je Bild, kein shadowBlur. */
function hintergrundAnim(f,an){
 if(!an)return;const c=f.c,t=f.t,h=f.th.hintergrund;
 if(an.wellen.length){                                   // Schaumkronen tauchen auf, ziehen leicht weiter, verschwinden
  c.save();c.lineCap='round';c.strokeStyle=h.schaum||'#ffffff';
  for(const w of an.wellen){
   const a=Math.sin(t*.0007*w[4]+w[3]);if(a<=0)continue;
   const l=22+w[2]*10,x=w[0]+Math.sin(t*.00035*w[4]+w[3])*14,y=w[1];
   c.globalAlpha=a*.6;c.lineWidth=1.4+a*1.6;
   c.beginPath();c.moveTo(x-l/2,y);c.quadraticCurveTo(x,y-5-a*3,x+l/2,y);c.moveTo(x-l*.2,y+7);c.quadraticCurveTo(x+l*.05,y+4,x+l*.3,y+7);c.stroke();
  }
  c.restore();
 }
 if(an.fluesse.length){                                  // Lava fließt (Strichmuster wandert), Glut pulsiert
  c.save();if(an.aussen)c.clip(an.aussen,'evenodd');
  c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
  an.fluesse.forEach((fp,i)=>{
   c.setLineDash([]);c.strokeStyle=rgba(h.glut,.08+.08*Math.sin(t*.002+i*2));c.lineWidth=30;c.stroke(fp);
   c.setLineDash([16,34]);c.lineDashOffset=-t*.03-i*17;c.strokeStyle=rgba(h.glutHell||'#ffd25a',.35);c.lineWidth=7;c.stroke(fp);
  });
  c.restore();
 }
 if(an.glut.length){                                     // Glutfunken steigen am Bildschirm nach oben
  const up=f.kam.dreh?[-1,0]:[0,-1],gl=h.glutHell||'#ffd25a',gd=h.glut||'#ff6a1a';
  c.save();c.globalCompositeOperation='lighter';
  for(const p of an.glut){
   const u=mod(t*.00022*p[4]+p[3],1),a=Math.sin(u*Math.PI),seit=Math.sin(u*7+p[3])*7,hoch=u*90;
   const x=p[0]+up[0]*hoch-up[1]*seit,y=p[1]+up[1]*hoch+up[0]*seit,r=p[2]*.55*(1-u*.5);
   c.globalAlpha=a*.35;c.fillStyle=gd;kreis(c,x,y,r*3);c.fill();
   c.globalAlpha=a*.95;c.fillStyle=gl;kreis(c,x,y,r);c.fill();
  }
  c.restore();
 }
}
/* Animierte Deko (DEKO_ANIM) pro Bild: [typ, x, y, s, zufall] */
function dekoAnim(f,liste){
 if(!liste||!liste.length)return;const c=f.c;
 for(const o of liste){c.save();aufrecht(c,f.kam,o[1],o[2]);c.scale(o[3],o[3]);DEKO_ANIM[o[0]](c,f.th.deko,f.t,o[4]);c.restore()}
}

/* Leuchtspur hinter dem eigenen Ball (neuester Punkt zuletzt) */
function spurAnim(f,spur,farbe){
 if(!Array.isArray(spur)||spur.length<2)return;
 const c=f.c,n=spur.length,px=q=>Array.isArray(q)?q:[q.x,q.y];
 c.save();c.globalCompositeOperation='lighter';c.lineCap='round';c.strokeStyle=farbe;
 for(let i=1;i<n;i++){
  const u=i/(n-1),a=px(spur[i-1]),b=px(spur[i]);
  c.globalAlpha=u*u*.5;c.lineWidth=2+u*BALL_R*1.1;
  c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();
 }
 c.restore();
}

/* Bälle: weiß mit Glanzlicht und weichem Schatten; Mitspieler in ihrer Farbe, Geister halbdurchsichtig */
function ballAnim(f,b){
 const c=f.c,r=BALL_R,geist=!!b.geist&&!b.ich,farbe=istHex(b.farbe)?b.farbe:f.th.akzent;
 c.save();aufrecht(c,f.kam,b.x,b.y);
 schattenOval(c,3,4.5,r*1.2,r*1.05,geist?.2:.42);
 if(b.ich){
  const puls=.5+.5*Math.sin(f.t*.006);
  c.globalCompositeOperation='lighter';
  const rg=c.createRadialGradient(0,0,r*.6,0,0,r*2.6);rg.addColorStop(0,rgba(farbe,.4+.2*puls));rg.addColorStop(1,rgba(farbe,0));
  c.fillStyle=rg;kreis(c,0,0,r*2.6);c.fill();c.globalCompositeOperation='source-over';
 }
 const basis=b.ich?'#ffffff':farbe;
 c.globalAlpha=geist?.55:1;
 const rg=c.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r);
 rg.addColorStop(0,'#ffffff');rg.addColorStop(.45,b.ich?'#f4f6fa':mische(basis,'#ffffff',.25));rg.addColorStop(1,mische(basis,'#000000',.38));
 c.fillStyle=rg;kreis(c,0,0,r);c.fill();
 c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=.8;kreis(c,0,0,r-.4);c.stroke();
 c.fillStyle='rgba(255,255,255,.9)';c.beginPath();c.ellipse(-r*.38,-r*.42,r*.26,r*.17,-.6,0,TAU);c.fill();
 if(b.ich){c.globalAlpha=.9;c.strokeStyle=farbe;c.lineWidth=2;kreis(c,0,0,r+2.2);c.stroke()}
 if(geist){c.globalAlpha=.8;c.strokeStyle=basis;c.lineWidth=1.4;c.setLineDash([3,3]);kreis(c,0,0,r+1.6);c.stroke()}
 c.restore();
}
/* Fahne im Loch: Stange nach „oben“ am Bildschirm, Tuch flattert (leicht durchsichtig) */
function fahneAnim(f){
 const l=f.bahn.loch;if(!l)return;
 const c=f.c,fa=f.th.fahne,t=f.t,H=82,Wd=44,Hd=26,N=10;
 const oben=[],unten=[];
 for(let i=0;i<=N;i++){const u=i/N,wv=Math.sin(t*.0085-u*4.6)*5.5*u+Math.sin(t*.013-u*7)*1.5*u;oben.push([u*Wd,-H+2+wv]);unten.push([u*Wd,-H+2+Hd-u*7+wv*1.1])}
 const tuch=(abb)=>{c.beginPath();oben.forEach((q,i)=>{const p=abb(q);i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])});for(let i=N;i>=0;i--){const p=abb(unten[i]);c.lineTo(p[0],p[1])}c.closePath()};
 c.save();aufrecht(c,f.kam,+l.x,+l.y);
 // Schatten von Stange und Tuch auf dem Boden (nach unten rechts)
 // Punkt in Höhe h (= −y) wirft seinen Schatten um h/H·(sx,sy) versetzt auf den Boden
 const sx=H*.55,sy=H*.32,boden=q=>{const h=-q[1]/H;return[q[0]+h*sx,h*sy+q[0]*.1]};
 c.strokeStyle='rgba(0,0,0,.22)';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(0,0);c.lineTo(sx,sy);c.stroke();
 tuch(boden);c.fillStyle='rgba(0,0,0,.13)';c.fill();
 // Stange
 c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=4;c.beginPath();c.moveTo(0,0);c.lineTo(0,-H);c.stroke();
 c.strokeStyle=fa.stange;c.lineWidth=2.4;c.stroke();
 // Tuch mit Falten-Schattierung
 tuch(q=>q);
 const lg=c.createLinearGradient(0,0,Wd,0);
 for(let i=0;i<=5;i++){const u=i/5,k=Math.cos(t*.0085-u*4.6);lg.addColorStop(u,k>0?mische(fa.tuch,'#ffffff',k*.22):mische(fa.tuch,'#000000',-k*.25))}
 c.globalAlpha=.86;c.fillStyle=lg;c.fill();
 c.globalAlpha=1;c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=1;c.stroke();
 if(f.geo.nr){
  const q=oben[4];c.fillStyle=fa.schrift;c.font='900 14px Nunito, system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';
  c.fillText(f.geo.nr,q[0],q[1]+Hd*.45);
 }
 c.fillStyle='#ffc53d';kreis(c,0,-H-1.5,3);c.fill();
 c.restore();
}
/* Zielhilfe: Pfeil in Schussrichtung (Länge/Farbe nach Kraft) + kurze gepunktete Linie (geradeaus, ohne Physik) */
const kraftFarbe=(k,a)=>'hsla('+Math.round(120*(1-k))+',92%,56%,'+(a==null?1:a)+')';
function zielAnim(f,z){
 if(!z||!z.von)return;
 const c=f.c,k=clamp(+z.kraft||0,0,1),w=+z.winkel||0,x=+z.von.x,y=+z.von.y;
 const r0=BALL_R+5,len=34+k*176,kopf=22,halb=4.2+k*1.8;
 c.save();c.translate(x,y);
 c.lineCap='round';c.lineWidth=3.2;c.strokeStyle='rgba(0,0,0,.35)';kreis(c,0,0,BALL_R+7);c.stroke();   // Kraftring
 if(k>0){c.strokeStyle=kraftFarbe(k);c.beginPath();c.arc(0,0,BALL_R+7,w-k*Math.PI,w+k*Math.PI);c.stroke()}
 c.rotate(w);
 const n=6+Math.round(k*6),abst=18,off=mod(f.t*.04,abst);
 c.fillStyle='#ffffff';
 for(let i=0;i<n;i++){c.globalAlpha=(1-(i+off/abst)/n)*.85;kreis(c,r0+len+10+i*abst+off,0,2.6);c.fill()}
 c.globalAlpha=1;
 c.beginPath();c.moveTo(r0,-halb);c.lineTo(r0+len-kopf,-halb);c.lineTo(r0+len-kopf,-halb-7);c.lineTo(r0+len,0);c.lineTo(r0+len-kopf,halb+7);c.lineTo(r0+len-kopf,halb);c.lineTo(r0,halb);c.closePath();
 c.lineJoin='round';c.lineWidth=4;c.strokeStyle='rgba(0,0,0,.45)';c.stroke();
 const lg=c.createLinearGradient(r0,0,r0+len,0);lg.addColorStop(0,kraftFarbe(k,.25));lg.addColorStop(.5,kraftFarbe(k,.85));lg.addColorStop(1,kraftFarbe(k));
 c.fillStyle=lg;c.fill();c.lineWidth=1.2;c.strokeStyle='rgba(255,255,255,.6)';c.stroke();
 c.restore();
}

/* Bildschirm-Ebene (CSS-Pixel, aufrecht): Namensschilder, Kraft-Prozent, große Texte */
function schild(c,x,y,txt,rahmen,alpha){
 const w=c.measureText(txt).width+12;
 c.globalAlpha=alpha;c.fillStyle='rgba(11,21,36,.8)';rundRechteck(c,x-w/2,y-8,w,16,8);c.fill();
 c.strokeStyle=rahmen;c.lineWidth=1.5;c.stroke();
 c.fillStyle='#F5F0E6';c.fillText(txt,x,y+.5);c.globalAlpha=1;
}
function namenAnim(f,liste){
 const c=f.c,k=f.kam;
 c.save();c.font='800 10.5px Nunito, system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';
 for(const b of liste){
  if(b.ich||!b.name)continue;
  const p=k.feldZuBild(b.x,b.y);
  schild(c,p[0],p[1]-BALL_R*k.skala-12,String(b.name).slice(0,14),istHex(b.farbe)?b.farbe:f.th.akzent,b.geist?.8:1);
 }
 c.restore();
}
function kraftText(f,z){
 if(!z||!z.von)return;
 const c=f.c,k=clamp(+z.kraft||0,0,1),p=f.kam.feldZuBild(+z.von.x,+z.von.y);
 let y=p[1]-BALL_R*f.kam.skala-24;if(y<12)y=p[1]+BALL_R*f.kam.skala+24;
 c.save();c.font='900 12px Nunito, system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';
 schild(c,p[0],y,Math.round(k*100)+'%',kraftFarbe(k),1);
 c.restore();
}

/* ---------- 8. Effekte (Partikel) ----------
   Partikel liegen im Feld (Einheiten, Geschwindigkeit in Einheiten/s) und altern nach der Uhr
   (performance.now), nicht nach zustand.t – so laufen sie auch bei angehaltenem Spiel aus. */
const partikel=[],texte=[];
let uhrAlt=0;
const PALETTE=['#ffc53d','#ff6b57','#3ddc97','#5bc0ff','#ff4d6d','#b46bff','#ffffff'];
function neuP(o){
 if(partikel.length>=PARTIKEL_MAX)partikel.shift();
 o.start=jetzt()+(o.verz||0);
 o.vx=o.vx||0;o.vy=o.vy||0;o.reib=o.reib||0;
 partikel.push(o);
}
/* art: 'platsch'|'sand'|'funken'|'konfetti'|'tele'|'boost'|'holeinone'
   extra (alles optional): farbe, farbe2, richtung:[dx,dy] oder winkel (Rad), nach:{x,y} (tele: Ausgang), text (holeinone) */
function effekt(art,x,y,extra){
 extra=extra||{};x=+x||0;y=+y||0;const R=Math.random;
 const basisWinkel=extra.richtung?Math.atan2(+extra.richtung[1]||0,+extra.richtung[0]||0):(extra.winkel!=null?+extra.winkel:null);
 const strahl=(px,py,n,o)=>{for(let i=0;i<n;i++){const a=o.winkel==null?R()*TAU:o.winkel+(R()-.5)*(o.streu||1),v=o.v0+R()*(o.v1-o.v0);
  neuP({art:o.art,x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v,dauer:o.d0+R()*(o.d1-o.d0),groesse:o.g0+R()*(o.g1-o.g0),groesse2:o.g2,
        farbe:Array.isArray(o.farbe)?o.farbe[Math.floor(R()*o.farbe.length)]:o.farbe,reib:o.reib,licht:o.licht,alpha:o.alpha,verz:o.verz,
        dreh:R()*TAU,vdreh:o.vdreh?(R()-.5)*o.vdreh:0})}};
 switch(art){
  case'platsch':
   strahl(x,y,28,{art:'punkt',v0:60,v1:300,d0:450,d1:950,g0:2,g1:5.5,farbe:[extra.farbe||'#bfe9ff','#ffffff'],reib:3.2});
   for(let i=0;i<3;i++)neuP({art:'ring',x,y,dauer:850,groesse:6,groesse2:70+i*18,farbe:'#ffffff',alpha:.8,verz:i*140});
   break;
  case'sand':
   strahl(x,y,14,{art:'wolke',v0:20,v1:90,d0:900,d1:1400,g0:8,g1:12,g2:38,farbe:extra.farbe||'#d8b878',alpha:.55,reib:2});
   strahl(x,y,22,{art:'punkt',v0:80,v1:230,d0:300,d1:600,g0:1.4,g1:2.6,farbe:'#a8834a',reib:5});
   break;
  case'funken':
   strahl(x,y,18,{art:'funke',winkel:basisWinkel,streu:1.7,v0:160,v1:520,d0:220,d1:480,g0:1.6,g1:2.8,farbe:[extra.farbe||'#fff6c8','#ffb13d'],reib:4,licht:true});
   break;
  case'konfetti':
   strahl(x,y,70,{art:'konfetti',v0:120,v1:440,d0:1300,d1:2300,g0:6,g1:10,farbe:PALETTE,reib:2.4,vdreh:14});
   neuP({art:'ring',x,y,dauer:700,groesse:8,groesse2:90,farbe:'#ffc53d',alpha:.9,licht:true});
   break;
  case'tele':{
   const fa=extra.farbe||'#c38bff',fb=extra.farbe2||'#3de0ff';
   neuP({art:'ring',x,y,dauer:520,groesse:34,groesse2:4,farbe:fa,alpha:1,licht:true});
   strahl(x,y,22,{art:'funke',v0:90,v1:300,d0:250,d1:520,g0:1.6,g1:2.6,farbe:[fa,'#ffffff'],reib:3,licht:true});
   if(extra.nach){
    const nx=+extra.nach.x||0,ny=+extra.nach.y||0;
    neuP({art:'ring',x:nx,y:ny,dauer:600,groesse:6,groesse2:70,farbe:fb,alpha:1,licht:true,verz:90});
    strahl(nx,ny,26,{art:'funke',v0:140,v1:380,d0:280,d1:600,g0:1.6,g1:2.8,farbe:[fb,'#ffffff'],reib:3,licht:true,verz:90});
   }
   break;}
  case'boost':
   strahl(x,y,26,{art:'punkt',winkel:basisWinkel==null?null:basisWinkel+Math.PI,streu:.8,v0:120,v1:380,d0:300,d1:650,g0:2.5,g1:5,
                  farbe:extra.farbe?[extra.farbe,'#ffffff']:['#fff2b0','#ffb13d','#ff6b3d'],reib:3,licht:true});
   neuP({art:'ring',x,y,dauer:420,groesse:8,groesse2:46,farbe:extra.farbe||'#ffc53d',alpha:.9,licht:true});
   break;
  case'holeinone':{
   for(let b=0;b<7;b++){
    const bx=x+(R()-.5)*520,by=y+(R()-.5)*420+60,verz=b*190+R()*80,col=PALETTE[b%PALETTE.length];
    neuP({art:'ring',x:bx,y:by,dauer:500,groesse:4,groesse2:60,farbe:'#ffffff',alpha:.9,licht:true,verz});
    strahl(bx,by,46,{art:'funke',v0:140,v1:440,d0:700,d1:1150,g0:1.8,g1:3,farbe:[col,'#ffffff'],reib:1.8,licht:true,verz});
   }
   strahl(x,y,90,{art:'konfetti',v0:120,v1:520,d0:1600,d1:2600,g0:6,g1:11,farbe:PALETTE,reib:2.2,vdreh:14});
   texte.push({text:String(extra.text||'HOLE IN ONE!'),start:jetzt(),dauer:2800});
   break;}
  default:return false;
 }
 return true;
}
function partikelAnim(f,dt){
 const c=f.c,now=f.now;let w=0;
 for(let i=0;i<partikel.length;i++){
  const p=partikel[i],alter=now-p.start;if(alter>p.dauer)continue;
  partikel[w++]=p;if(alter<0||dt<=0)continue;
  const r=Math.exp(-p.reib*dt);p.vx*=r;p.vy*=r;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.vdreh)p.dreh+=p.vdreh*dt;
 }
 partikel.length=w;
 if(!w)return;
 c.save();
 for(const licht of[false,true]){
  c.globalCompositeOperation=licht?'lighter':'source-over';
  for(const p of partikel){
   if(!!p.licht!==licht)continue;
   const alter=now-p.start;if(alter<0)continue;
   const u=alter/p.dauer,a0=p.alpha==null?1:p.alpha;
   c.fillStyle=c.strokeStyle=p.farbe;
   switch(p.art){
    case'punkt':c.globalAlpha=a0*(1-u*u);kreis(c,p.x,p.y,p.groesse*(1-u*.5));c.fill();break;
    case'funke':c.globalAlpha=a0*(1-u);c.lineWidth=p.groesse;c.lineCap='round';c.beginPath();c.moveTo(p.x-p.vx*.035,p.y-p.vy*.035);c.lineTo(p.x,p.y);c.stroke();break;
    case'ring':{const e=1-Math.pow(1-u,3);c.globalAlpha=a0*(1-u);c.lineWidth=.6+3*(1-u);kreis(c,p.x,p.y,p.groesse+(p.groesse2-p.groesse)*e);c.stroke();break;}
    case'wolke':c.globalAlpha=a0*(1-u)*.6;kreis(c,p.x,p.y,p.groesse+((p.groesse2||p.groesse*3)-p.groesse)*u);c.fill();break;
    case'konfetti':c.globalAlpha=a0*(u>.75?(1-u)/.25:1);c.save();c.translate(p.x,p.y);c.rotate(p.dreh);c.scale(1,Math.cos(p.dreh*1.7));c.fillRect(-p.groesse/2,-p.groesse*.3,p.groesse,p.groesse*.6);c.restore();break;
   }
  }
 }
 c.restore();
}
const zurueckSchwung=u=>{const s=1.70158,v=u-1;return 1+(s+1)*v*v*v+s*v*v};
function texteAnim(f){
 const c=f.c,kam=f.kam;let w=0;
 for(let i=0;i<texte.length;i++){
  const tx=texte[i],al=f.now-tx.start;if(al>tx.dauer)continue;texte[w++]=tx;if(al<0)continue;
  const u=al/tx.dauer,pop=al<380?zurueckSchwung(al/380):1,fade=u>.8?(1-u)/.2:1;
  const fs=Math.max(18,Math.min(kam.breite*.12,kam.hoehe*.16,72));
  c.save();c.translate(kam.breite/2,kam.hoehe*.42);c.rotate(Math.sin(al*.006)*.04-.05);c.scale(pop,pop);c.globalAlpha=fade;
  c.font='400 '+fs.toFixed(1)+'px "Lilita One","Arial Rounded MT Bold","Trebuchet MS",sans-serif';c.textAlign='center';c.textBaseline='middle';
  c.lineJoin='round';c.lineWidth=fs*.16;c.strokeStyle='#2A1700';c.strokeText(tx.text,0,0);
  const lg=c.createLinearGradient(0,-fs/2,0,fs/2);lg.addColorStop(0,'#fff3b0');lg.addColorStop(.5,'#FFC53D');lg.addColorStop(1,'#ff9a1f');
  c.shadowColor='rgba(255,197,61,.8)';c.shadowBlur=fs*.3*f.pr;c.fillStyle=lg;c.fillText(tx.text,0,0);
  c.restore();
 }
 texte.length=w;
}

/* ---------- 9. zeichne() ----------
   zustand = { t, baelle:[{x,y,farbe,name,ich,geist,versenkt}], ziel:null|{von,winkel,kraft}, spur:[[x,y],…] }
   pixelRatio wird aus ctx.canvas.width / kamera.breite bestimmt (Canvas also in Gerätepixeln anlegen). */
function zeichne(ctx,bahn,platzId,kam,zustand){
 if(!ctx||!bahn||!kam)return;
 zustand=zustand||{};
 const t=+zustand.t||0,th=thema(platzId),geo=geometrie(bahn);
 const pr=(ctx.canvas&&ctx.canvas.width)?ctx.canvas.width/kam.breite:1;
 const ebene=holeEbene(bahn,platzId,kam,pr);
 const now=jetzt();let dt=uhrAlt?(now-uhrAlt)/1000:0;dt=clamp(dt,0,.05);uhrAlt=now;
 const f={c:ctx,th,kam,pr,t,now,geo,bahn};
 const baelle=(Array.isArray(zustand.baelle)?zustand.baelle:[]).filter(b=>b&&!b.versenkt&&isFinite(b.x)&&isFinite(b.y));
 baelle.sort((a,b)=>(a.ich?1:0)-(b.ich?1:0));            // eigener Ball zuletzt (oben)
 const ich=baelle.find(b=>b.ich);

 ctx.save();
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 ctx.drawImage(ebene.canvas,0,0);
 setzeFeld(ctx,kam,pr);
 funkelnAnim(f,ebene.funkeln);
 hintergrundAnim(f,ebene.anim);
 zonenAnim(f);
 objekteAnim(f,baelle);
 dekoAnim(f,ebene.anim&&ebene.anim.deko);
 spurAnim(f,zustand.spur,ich&&istHex(ich.farbe)?ich.farbe:th.spur);
 for(const b of baelle)ballAnim(f,b);
 fahneAnim(f);
 zielAnim(f,zustand.ziel);
 partikelAnim(f,dt);
 ctx.setTransform(pr,0,0,pr,0,0);
 namenAnim(f,baelle);
 kraftText(f,zustand.ziel);
 texteAnim(f);
 ctx.restore();
}

function leeren(){cache=new Map();geoMerk=new WeakMap();bumperZeit.clear()}

const API={THEMEN,kamera,vorbereiten,zeichne,effekt,leeren};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.GRAFIK=API;
})(this);
