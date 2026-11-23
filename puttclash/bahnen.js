/* ==========================================================================
   PUTTCLASH · BAHNEN (bahnen.js)
   --------------------------------------------------------------------------
   Alle 36 Minigolf-Bahnen in 6 Plätzen à 6 Bahnen. Nur Daten (plus ein paar
   Bau-Helfer, die beim Laden die Polygone ausrechnen) – kein Bildschirm, keine
   Physik. Verbindliches Format: puttclash/FORMAT.md („Bahn – Datenformat“).
   Prüfen:  node puttclash/bahnen.test.js

   Bereitgestellt (global BAHNEN bzw. module.exports):
     BAHNEN.PLAETZE      Array der 6 Plätze {id, name, emoji, bahnen:[6 Bahnen]}
     BAHNEN.bahn(id)     eine Bahn, z. B. BAHNEN.bahn('eis-3')  (sonst null)
     BAHNEN.alle()       alle 36 Bahnen in Spielreihenfolge
     BAHNEN.platz(id)    ein Platz, z. B. BAHNEN.platz('wueste') (sonst null)
     BAHNEN.helfer       die Bau-Helfer unten (für neue Bahnen / Editor)

   Plätze (steigende Schwierigkeit, par-Summe fällt nie):
     park      🌳 Sonnenpark    leicht        par 2–3  (Summe 16)
     wueste    🏜️ Wüstenoase    mittel        par 3–4  (Summe 19)
     piraten   🏴‍☠️ Piratenbucht  mittel        par 3–4  (Summe 19; Wasser, Stege,
                                                       Kisten, Fallgitter, Kanone)
     eis       ❄️ Eispalast     mittel–schwer par 3–4  (Summe 21; viel Eis, Banden)
     vulkan    🌋 Vulkan        schwer        par 3–5  (Summe 22; Lava, Hänge, Asche,
                                                       Glutbrocken, Geysire, Mühlen)
     weltraum  🚀 Weltraum      schwer        par 3–5  (Summe 22; Tele, Boost, Mühlen)

   Koordinaten: Feld 1000 breit × 1500 hoch, Ursprung oben links, y nach unten.
   Ball-Radius 12, Loch-Radius 20. Abschlag meist unten, Loch meist oben.
   rand wird OHNE Wiederholung des ersten Punkts angegeben (implizit
   geschlossen) und läuft auf dem Bildschirm im Uhrzeigersinn.

   --------------------------------------------------------------------------
   TYPEN KURZ ERKLÄRT
   Zonen (Untergründe, liegen in zonen[], spätere gewinnen bei Überlappung):
     sand    bremst stark (im Eispalast als „Schneewehe“ gemalt)
     eis     kaum Reibung, Ball rutscht weit, Banden werden wichtig
     wasser  Ball versinkt → Strafschlag, zurück zum Abschlag dieses Schusses
     lava    wie wasser (nur andere Optik) – im Vulkan
     loch    Abgrund (Eisloch, Weltall) – wirkt wie wasser
     hang    Kraftfeld: konstante Beschleunigung in richtung (= bergab),
             staerke 0.5–3. Ändert den Untergrund NICHT (Hang auf Eis = Eis).
     boost   Kreis, schiebt den Ball beim Überrollen in richtung (staerke)
   Objekte (in objekte[]):
     pfosten fester runder Pfosten (normaler Abprall)
     bumper  runder Abpraller, der beschleunigt (kraft = Rückprallfaktor)
     block   Rechteck, das sinusförmig um ±bahn um seine Ruhelage pendelt
     muehle  drehende Balken um (x,y); laenge = Länge eines Flügels ab Mitte,
             periode = ms pro Umdrehung, positiv = Uhrzeigersinn, negativ = gegen
     tele    Ball in a → kommt bei b mit gleicher Geschwindigkeit heraus
     tor     waagerechte Schranke (Breite b, Mitte x,y), offen/zu im Wechsel
   Deko (deko[]): nur Optik, liegt meist AUSSERHALB von rand als Rahmen.
     baum busch blume stein kaktus palme schneemann eiskristall stern planet
     rakete fahne   (s = Größe, 1 = normal)
     Piratenbucht: palme fass anker muschel schatzkiste steuerrad stein
     Vulkan:       fels glutstein duerrbaum rauch kristall stein
   Platz-Bedeutungen: Piratenbucht – Steg/Planke = Gras-Streifen zwischen zwei
   Wasserflächen, Inselchen = Sand im Wasser, Kiste = block, Fallgitter = tor,
   Kanone = tele. Vulkan – Asche = sand, Glutbrocken = bumper, Geysir = boost,
   Vulkanflanke = hang.

   --------------------------------------------------------------------------
   SO FÜGST DU EINE BAHN HINZU
   1. Im passenden Platz unten (z. B. WUESTE) ein neues Objekt an die Liste
      hängen:  W({ id:'wueste-7', name:'…', par:3, start:{…}, loch:{…},
               rand:[…], waende:[…], zonen:[…], objekte:[…] }, 107)
      Die Zahl am Ende ist der Zufallssamen für die Rand-Deko (beliebig, aber
      fest – dann sieht die Bahn auf allen Handys gleich aus).
   2. rand am bequemsten mit den Helfern bauen:
        rund(x,y,b,h,r)            abgerundetes Rechteck
        ellipse(cx,cy,rx,ry,n)     Oval aus n Punkten
        band(mittellinie, breite)  „Schlauch“ um eine Mittellinie, mit runden
                                   Enden; breite = Zahl oder Funktion f(s),
                                   s = 0 (Anfang) … 1 (Ende)
        band(mitte, breite, true)  dasselbe mit geraden Enden (Flussstücke)
        bogen(cx,cy,r,a0,a1)       Kreisbogen (Grad, 0 = rechts, 90 = unten)
        spur(f, n)                 Mittellinie aus Funktion f(s) → [x,y]
      Kurvenradius der Mittellinie immer größer als die halbe Breite, sonst
      überschneidet sich der Rand (der Test meldet das).
   3. Regeln, die der Test prüft: Durchgänge ≥ 70 breit, Abschlag und Loch
      mindestens 16 Luft zu jeder Wand, nicht in Sand/Wasser/Abgrund/Hang,
      nicht in Objekten; Loch vom Abschlag aus erreichbar (Teleporter zählen).
   4. node puttclash/bahnen.test.js – muss „0 fehlgeschlagen“ melden.
   5. Spielbarkeit mit der echten Physik prüfen: PHYSIK.besterSchuss als Bot
      spielen lassen (auch mit etwas Streuung bei Winkel/Kraft). Faustregel:
      Schnitt mit Streuung zwischen par−1,2 und par+1,5, kein Ball eingeklemmt
      (bewegte Blöcke berühren die Bande oder lassen ≥ 40 Luft, Mühlenspitze
      ≥ 40 Luft zur Wand).
   Ein neuer PLATZ: Liste wie PARK anlegen (eigener Kürzel-Helfer wie K/V und
   Deko-Liste in DEKO), in PLAETZE nach Schwierigkeit eintragen, im Test
   (PL_IDS, PAR_BEREICH, PL_NAMEN, id-Schema) ergänzen und in grafik.js ein
   Thema mit derselben id ergänzen.
   ========================================================================== */
(function(root){
'use strict';

/* ---------- Bau-Helfer ---------- */
const GRAD=Math.PI/180;
const r1=v=>Math.round(v*10)/10;

/* Rechteck als Polygon (im Uhrzeigersinn) */
function rechteck(x,y,b,h){return[x,y,x+b,y,x+b,y+h,x,y+h]}

/* Kreisbogen um (cx,cy) von Winkel a0 bis a1 (Grad), beide Enden inklusive */
function bogen(cx,cy,r,a0,a1,schritte){
 const n=schritte||Math.max(2,Math.ceil(Math.abs(a1-a0)/7.5)),p=[];
 for(let i=0;i<=n;i++){const a=(a0+(a1-a0)*i/n)*GRAD;p.push(r1(cx+r*Math.cos(a)),r1(cy+r*Math.sin(a)))}
 return p;
}

/* Ellipse aus n Punkten, oben beginnend, im Uhrzeigersinn */
function ellipse(cx,cy,rx,ry,n){
 n=n||48;const p=[];
 for(let i=0;i<n;i++){const a=(-90+360*i/n)*GRAD;p.push(r1(cx+rx*Math.cos(a)),r1(cy+ry*Math.sin(a)))}
 return p;
}

/* Abgerundetes Rechteck (r < halbe Breite/Höhe) */
function rund(x,y,b,h,r){
 return[...bogen(x+b-r,y+r,r,-90,0),...bogen(x+b-r,y+h-r,r,0,90),
        ...bogen(x+r,y+h-r,r,90,180),...bogen(x+r,y+r,r,180,270)];
}

/* Mittellinie aus einer Funktion f(s) → [x,y], s = 0…1, n Abschnitte */
function spur(f,n){const p=[];for(let i=0;i<=n;i++){const q=f(i/n);p.push(q[0],q[1])}return p}

/* Vorzeichenbehaftete Fläche: > 0 = auf dem Bildschirm im Uhrzeigersinn */
function flaeche(p){let a=0;for(let i=0;i<p.length;i+=2){const j=(i+2)%p.length;a+=p[i]*p[j+1]-p[j]*p[i+1]}return a/2}
function imUhrzeigersinn(p){
 if(flaeche(p)>=0)return p;
 const q=[];for(let i=p.length-2;i>=0;i-=2)q.push(p[i],p[i+1]);return q;
}

/* „Schlauch“: Polygon im Abstand breite/2 links und rechts einer Mittellinie,
   an beiden Enden mit Halbkreis-Kappe. breite: Zahl oder Funktion f(s).
   ohneKappe = true: gerade abgeschnittene Enden (z. B. Lavafluss-Stücke,
   zwischen denen eine Brücke genau so breit bleibt wie die Lücke). */
function band(mitte,breite,ohneKappe){
 const P=[];
 for(let i=0;i<mitte.length;i+=2){
  const x=mitte[i],y=mitte[i+1],l=P[P.length-1];
  if(!l||Math.hypot(x-l[0],y-l[1])>0.5)P.push([x,y]);
 }
 const n=P.length,L=[0];
 for(let i=1;i<n;i++)L.push(L[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
 const halb=i=>(typeof breite==='function'?breite(L[i]/L[n-1]):breite)/2;
 const dir=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);return[dx/l,dy/l]};
 const A=[],B=[];let t0=null,tE=null;
 for(let i=0;i<n;i++){
  let t,m=1;
  if(i===0)t=dir(P[0],P[1]);
  else if(i===n-1)t=dir(P[n-2],P[n-1]);
  else{
   const a=dir(P[i-1],P[i]),b=dir(P[i],P[i+1]);
   t=[a[0]+b[0],a[1]+b[1]];const l=Math.hypot(t[0],t[1]);t=[t[0]/l,t[1]/l];
   m=1/Math.max(0.35,t[0]*a[0]+t[1]*a[1]);          // Gehrung an Knicken
  }
  const nx=-t[1],ny=t[0],h=halb(i)*m;
  A.push([P[i][0]+nx*h,P[i][1]+ny*h]);B.push([P[i][0]-nx*h,P[i][1]-ny*h]);
  if(i===0)t0=t;if(i===n-1)tE=t;
 }
 const kappe=(c,t,h,vorn)=>{          // Halbkreis ohne die beiden Endpunkte
  const q=[],nx=-t[1],ny=t[0],s=vorn?1:-1;
  for(let k=1;k<12;k++){const a=Math.PI*k/12,cs=Math.cos(a)*s,sn=Math.sin(a)*s;
   q.push([c[0]+(nx*cs+t[0]*sn)*h,c[1]+(ny*cs+t[1]*sn)*h])}
  return q;
 };
 const ring=ohneKappe?[...A,...B.reverse()]
  :[...A,...kappe(P[n-1],tE,halb(n-1),true),...B.reverse(),...kappe(P[0],t0,halb(0),false)];
 const flach=[];ring.forEach(p=>flach.push(r1(p[0]),r1(p[1])));
 return imUhrzeigersinn(flach);
}

/* ---------- Rand-Deko (gleichmäßig verstreut, aber fest durch Samen) ---------- */
function zufall(samen){let s=(samen>>>0)||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
function imPoly(x,y,p){
 let drin=false;
 for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){
  const xi=p[i],yi=p[i+1],xj=p[j],yj=p[j+1];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)drin=!drin;
 }
 return drin;
}
function randAbstand(x,y,p){
 let m=Infinity;
 for(let i=0;i<p.length;i+=2){
  const j=(i+2)%p.length,ax=p[i],ay=p[i+1],dx=p[j]-ax,dy=p[j+1]-ay,l=dx*dx+dy*dy;
  const t=l?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l)):0;
  m=Math.min(m,Math.hypot(x-ax-t*dx,y-ay-t*dy));
 }
 return m;
}
/* Streut anzahl Deko-Teile AUSSERHALB von rand (mind. 40 Abstand zur Bande). */
function rahmenDeko(rand,typen,anzahl,samen){
 const z=zufall(samen),aus=[];
 for(let v=0;v<anzahl*80&&aus.length<anzahl;v++){
  const x=30+z()*940,y=30+z()*1440,typ=typen[Math.floor(z()*typen.length)],s=r1(0.7+z()*0.6);
  if(imPoly(x,y,rand)||randAbstand(x,y,rand)<40)continue;
  if(aus.some(d=>Math.hypot(d.x-x,d.y-y)<80))continue;
  aus.push({typ,x:Math.round(x),y:Math.round(y),s});
 }
 return aus;
}

const DEKO={
 park:['baum','baum','busch','busch','blume','blume','blume','stein'],
 wueste:['kaktus','kaktus','palme','stein','stein','kaktus'],
 eis:['schneemann','eiskristall','eiskristall','stein','eiskristall'],
 weltraum:['stern','stern','stern','stern','stern','planet','rakete'],
 piraten:['palme','palme','fass','anker','muschel','muschel','schatzkiste','steuerrad','stein'],
 vulkan:['fels','fels','glutstein','duerrbaum','rauch','kristall','stein','stein']
};
/* Vervollständigt eine Bahn (leere Listen, Rand-Deko anhängen). */
function mach(platz,b,samen){
 return{id:b.id,name:b.name,par:b.par,start:b.start,loch:b.loch,rand:b.rand,
  waende:b.waende||[],zonen:b.zonen||[],objekte:b.objekte||[],
  deko:(b.deko||[]).concat(rahmenDeko(b.rand,DEKO[platz],18,samen))};
}
const P=(b,s)=>mach('park',b,s),W=(b,s)=>mach('wueste',b,s),E=(b,s)=>mach('eis',b,s),A=(b,s)=>mach('weltraum',b,s);
const K=(b,s)=>mach('piraten',b,s),V=(b,s)=>mach('vulkan',b,s);     // K = Kaperfahrt, V = Vulkan
const glatt=s=>s*s*(3-2*s);

/* ==========================================================================
   🌳 SONNENPARK – leicht, par 2–3
   ========================================================================== */
const PARK=[
 /* park-1: Gerade Bahn mit sanftem Bauch – zum Eingewöhnen. */
 P({id:'park-1',name:'Aller Anfang ist grün',par:2,
  start:{x:500,y:1290},loch:{x:500,y:290},
  rand:band(spur(s=>[500+70*Math.sin(Math.PI*s),1280-1020*s],24),300),
  deko:[{typ:'blume',x:470,y:1460,s:0.8},{typ:'blume',x:540,y:1465,s:0.7}]
 },11),

 /* park-2: L-Kurve nach rechts – erst zur Ecke, dann ins Loch (oder über Bande). */
 P({id:'park-2',name:'Um die Ecke gedacht',par:2,
  start:{x:250,y:1290},loch:{x:790,y:320},
  rand:band([250,1300, 250,520, ...bogen(450,520,200,180,270), 780,320],220),
  deko:[{typ:'baum',x:620,y:820,s:1.3},{typ:'busch',x:520,y:1050,s:1},{typ:'blume',x:700,y:640,s:0.9}]
 },12),

 /* park-3: Doppelknick – erst rechts, dann links herum (S-Form). */
 P({id:'park-3',name:'Knick-Knack',par:3,
  start:{x:220,y:1310},loch:{x:780,y:290},
  rand:band([220,1340, 220,1060, ...bogen(400,1060,180,180,270), 600,880, ...bogen(600,700,180,90,0), 780,260],200),
  deko:[{typ:'baum',x:480,y:1200,s:1.2},{typ:'baum',x:450,y:520,s:1.1},{typ:'busch',x:600,y:1100,s:1}]
 },13),

 /* park-4: Pfosten-Slalom – drei versetzte Reihen, die Mitte ist immer zu. */
 P({id:'park-4',name:'Pfostenparade',par:3,
  start:{x:500,y:1320},loch:{x:500,y:300},
  rand:rund(240,120,520,1300,140),
  objekte:[
   {typ:'pfosten',x:370,y:1080,r:22},{typ:'pfosten',x:500,y:1080,r:22},{typ:'pfosten',x:630,y:1080,r:22},
   {typ:'pfosten',x:435,y:820,r:22},{typ:'pfosten',x:565,y:820,r:22},
   {typ:'pfosten',x:370,y:560,r:22},{typ:'pfosten',x:500,y:560,r:22},{typ:'pfosten',x:630,y:560,r:22}]
 },14),

 /* park-5: Maulwurfshügel – rauf (bremst), Kuppe, runter (beschleunigt) zum Loch. */
 P({id:'park-5',name:'Maulwurfshügel',par:3,
  start:{x:500,y:1290},loch:{x:380,y:290},
  rand:rund(200,140,600,1260,160),
  zonen:[
   {typ:'hang',form:{rect:[200,640,600,260]},richtung:[0,1],staerke:1},      // Aufstieg (bergab Richtung Abschlag)
   {typ:'hang',form:{rect:[200,500,600,140]},richtung:[0,-1],staerke:0.8}],  // Abfahrt Richtung Loch
  deko:[{typ:'stein',x:840,y:760,s:0.8}]
 },15),

 /* park-6: Erste Mühle in der Engstelle einer Vase – Timing, nicht durch die Nabe. */
 P({id:'park-6',name:'Windige Angelegenheit',par:3,
  start:{x:500,y:1260},loch:{x:500,y:300},
  rand:band(spur(s=>[500,1240-960*s],40),s=>300+120*Math.pow(Math.abs(2*s-1),1.2)),
  objekte:[{typ:'muehle',x:500,y:760,laenge:135,fluegel:4,periode:4000}]
 },16)
];

/* ==========================================================================
   🏜️ WÜSTENOASE – mittel, par 3–4
   ========================================================================== */
const WUESTE=[
 /* wueste-1: Geschwungene Piste mit drei Sandbunkern, der letzte vor dem Loch. */
 W({id:'wueste-1',name:'Sandkasten-Sause',par:3,
  start:{x:300,y:1300},loch:{x:680,y:300},
  rand:band(spur(s=>[300+380*glatt(s),1290-1020*s],30),320),
  zonen:[
   {typ:'sand',form:{kreis:[290,1020,55]}},
   {typ:'sand',form:{kreis:[470,780,80]}},
   {typ:'sand',form:{poly:ellipse(630,450,110,45,24)}}]
 },21),

 /* wueste-2: Oase – Teich mit Sandstrand in der Mitte, links oder rechts vorbei.
    Die Seitenwege hängen leicht zum Teich hin. */
 W({id:'wueste-2',name:'Fata Morgana',par:3,
  start:{x:500,y:1320},loch:{x:500,y:200},
  rand:ellipse(500,760,400,640,72),
  zonen:[
   {typ:'hang',form:{rect:[100,560,125,360]},richtung:[1,0],staerke:0.6},
   {typ:'hang',form:{rect:[775,560,125,360]},richtung:[-1,0],staerke:0.6},
   {typ:'sand',form:{poly:ellipse(500,740,270,320,48)}},
   {typ:'wasser',form:{poly:ellipse(500,740,230,280,48)}},
   {typ:'sand',form:{kreis:[500,740,55]}}],                  // Palmeninsel mitten im Teich
  deko:[{typ:'palme',x:500,y:730,s:1.2},{typ:'palme',x:470,y:760,s:0.8}]
 },22),

 /* wueste-3: Dünen-Slalom – Schlangenlinie, quer liegende Hänge drücken nach
    links und rechts, zum Schluss eine Düne hinauf zum Loch. */
 W({id:'wueste-3',name:'Dünen-Disco',par:3,
  start:{x:500,y:1300},loch:{x:500,y:280},
  rand:band(spur(s=>[500+150*Math.sin(2*Math.PI*s),1300-1040*s],48),250),
  zonen:[
   {typ:'sand',form:{kreis:[770,1040,45]}},
   {typ:'sand',form:{kreis:[230,520,45]}},
   {typ:'hang',form:{rect:[300,960,600,160]},richtung:[-1,0],staerke:1.2},
   {typ:'hang',form:{rect:[100,440,600,160]},richtung:[1,0],staerke:1.2},
   {typ:'hang',form:{rect:[250,330,500,80]},richtung:[0,1],staerke:1}]
 },23),

 /* wueste-4: Zwei Steinblöcke („Kamele“) pendeln quer durch den Weg. */
 W({id:'wueste-4',name:'Kamele kreuzen',par:3,
  start:{x:500,y:1300},loch:{x:500,y:280},
  rand:rund(250,120,500,1300,140),
  zonen:[{typ:'sand',form:{kreis:[370,340,55]}},{typ:'sand',form:{kreis:[630,340,55]}}],
  objekte:[
   {typ:'block',rect:[350,960,300,50],bahn:[100,0],periode:3000},
   {typ:'block',rect:[350,640,300,50],bahn:[-100,0],periode:2400}]
 },24),

 /* wueste-5: Pyramide – eine Mauer mit Schranke in der Mitte. Wer nicht warten
    will, nimmt rechts den langsamen Umweg durch den Sand. */
 W({id:'wueste-5',name:'Pharaos Pforte',par:3,
  start:{x:500,y:1320},loch:{x:500,y:330},
  rand:[500,110, 900,640, ...bogen(820,1340,80,0,90), ...bogen(180,1340,80,90,180), 100,640],
  waende:[[100,760, 420,760],[580,760, 780,760]],
  zonen:[
   {typ:'sand',form:{rect:[760,690,140,140]}},
   {typ:'sand',form:{kreis:[380,520,50]}},{typ:'sand',form:{kreis:[620,520,50]}}],
  objekte:[{typ:'tor',x:500,y:760,b:160,offen:1400,zu:1400}]
 },25),

 /* wueste-6: Enge Schlucht (130 breit) in Serpentinen, Geröll bremst in zwei Kurven. */
 W({id:'wueste-6',name:'Canyon-Klemme',par:4,
  start:{x:200,y:1340},loch:{x:250,y:270},
  rand:band([200,1360, 200,1050, ...bogen(350,1050,150,180,270), 650,900, ...bogen(650,750,150,90,0),
             800,600, ...bogen(650,600,150,0,-90), 400,450, ...bogen(400,300,150,90,180), 250,200],130),
  zonen:[{typ:'sand',form:{kreis:[800,900,60]}},{typ:'sand',form:{kreis:[250,450,60]}}],
  deko:[{typ:'stein',x:500,y:1100,s:1.3},{typ:'kaktus',x:560,y:660,s:1.1},{typ:'stein',x:620,y:300,s:1}]
 },26)
];

/* ==========================================================================
   🏴‍☠️ PIRATENBUCHT – mittel, par 3–4. Viel Wasser: Buchten, schmale Stege
   (Planken = Gras-Streifen zwischen zwei Wasserflächen), Sandstrand bremst,
   Inselchen (Sand mitten im Wasser), pendelnde Kisten (block), ein Fallgitter
   (tor) und genau EINE Kanone (Teleporter, piraten-4).
   ========================================================================== */
const PIRATEN=[
 /* piraten-1: Eine Bucht quer über die Bahn, nur eine schräge Planke (110 breit)
    führt hinüber. Erst an den Fuß der Planke legen, dann längs drüber spielen.
    Links im Wasser ein Inselchen mit Palme (Sand – man bleibt liegen, aber
    kommt nur übers Wasser wieder weg). */
 K({id:'piraten-1',name:'Über die Planke',par:3,
  start:{x:500,y:1310},loch:{x:650,y:320},
  rand:rund(150,120,700,1300,120),
  zonen:[
   {typ:'wasser',form:{poly:[140,640, 542,640, 302,880, 140,880]}},
   {typ:'wasser',form:{poly:[698,640, 860,640, 860,880, 458,880]}},
   {typ:'sand',form:{kreis:[230,755,42]}},                         // Inselchen
   {typ:'sand',form:{poly:ellipse(760,960,90,40,24)}},             // Strand rechts unten
   {typ:'sand',form:{kreis:[300,420,65]}}],
  deko:[{typ:'palme',x:230,y:750,s:0.9},{typ:'fass',x:790,y:1250,s:0.9}]
 },51),

 /* piraten-2: Lagune als Wasserring um die Schatzinsel (Loch in der Mitte).
    Der einzige Steg (140 breit) liegt schräg OBEN RECHTS – also erst rechts
    um die Lagune herum, dann schräg über den Steg zum Schatz. Links lockt
    der kürzere Weg, aber von dort trifft man den Steg nicht. */
 K({id:'piraten-2',name:'Schatzinsel',par:3,
  start:{x:500,y:1300},loch:{x:500,y:700},
  rand:ellipse(500,760,420,640,72),
  zonen:[
   {typ:'wasser',form:{poly:[...bogen(500,700,270,330.03,659.97),...bogen(500,700,140,645,345)]}},
   {typ:'sand',form:{kreis:[500,795,38]}},                         // Strand der Insel
   {typ:'sand',form:{kreis:[160,980,50]}},{typ:'sand',form:{kreis:[840,980,50]}}],
  deko:[{typ:'schatzkiste',x:560,y:660,s:0.8},{typ:'palme',x:440,y:640,s:1}]
 },52),

 /* piraten-3: Schiffsdeck – der Rumpf ist die Bande (Bug oben). Großmast und
    Vordermast als Pfosten, zwei Fässer, eine Kiste rutscht quer übers Deck
    und mittschiffs steht die offene, geflutete Ladeluke. */
 K({id:'piraten-3',name:'Klar Schiff!',par:3,
  start:{x:500,y:1300},loch:{x:500,y:330},
  rand:[500,110, 700,250, 800,480, 830,900, 800,1240, 700,1400, 300,1400, 200,1240, 170,900, 200,480, 300,250],
  zonen:[{typ:'wasser',form:{rect:[400,600,200,110]}}],
  objekte:[
   {typ:'pfosten',x:500,y:1010,r:28},                              // Großmast
   {typ:'block',rect:[430,820,140,56],bahn:[200,0],periode:3200},  // rutschende Kiste
   {typ:'pfosten',x:290,y:640,r:22},{typ:'pfosten',x:710,y:640,r:22}, // Fässer
   {typ:'pfosten',x:500,y:480,r:24}],                              // Vordermast
  deko:[{typ:'steuerrad',x:500,y:1360,s:0.9},{typ:'anker',x:90,y:1300,s:1.1}]
 },53),

 /* piraten-4: Kanonen-Kurs – eine große Bucht trennt Abschlag und Loch. Der
    lange Weg führt rechts über den Sandstrand; die Kanone (Teleporter) links
    unten schießt den Ball mit gleichem Tempo und gleicher Richtung hinter
    die Bucht. Oben versperrt ein Tümpel den Bandenweg vom Kanonen-Ausgang
    zum Loch – das Ass gibt es nur mit viel Gefühl. */
 K({id:'piraten-4',name:'Volle Breitseite',par:3,
  start:{x:640,y:1310},loch:{x:720,y:300},
  rand:rund(120,120,760,1300,120),
  zonen:[
   {typ:'wasser',form:{poly:[100,530, 260,505, 420,535, 580,505, 735,530, 715,740, 735,950, 580,975, 420,945, 260,975, 100,950]}},
   {typ:'sand',form:{kreis:[420,740,45]}},                         // Inselchen
   {typ:'sand',form:{rect:[735,660,145,150]}},                     // Sandstrand im Seitenweg
   {typ:'wasser',form:{poly:ellipse(530,265,85,105,24)}}],         // Tümpel vor dem Loch
  objekte:[{typ:'tele',a:{x:300,y:1120},b:{x:300,y:370},r:30}],
  deko:[{typ:'palme',x:420,y:735,s:0.8},{typ:'fass',x:300,y:1185,s:0.7}]
 },54),

 /* piraten-5: Enterhaken – Hakenkurve wie ein U. Innen an der Kurve liegt
    Wasser (wer die Kurve schneidet, geht baden), am Start Sandstrand, und
    im absteigenden Arm sperrt ein Fallgitter (Tor) den Weg zum Loch. */
 K({id:'piraten-5',name:'Enterhaken',par:3,
  start:{x:220,y:1320},loch:{x:780,y:990},
  rand:band([220,1340, 220,620, ...bogen(500,620,280,180,360), 780,1010],240),
  zonen:[
   {typ:'wasser',form:{poly:imUhrzeigersinn([...bogen(500,620,218,185,355),...bogen(500,620,150,355,185)])}},
   {typ:'sand',form:{kreis:[140,1080,55]}},{typ:'sand',form:{kreis:[300,880,50]}},
   {typ:'sand',form:{kreis:[860,1120,45]}}],
  objekte:[{typ:'tor',x:780,y:800,b:240,offen:1300,zu:1300}],
  deko:[{typ:'anker',x:500,y:760,s:1.3},{typ:'muschel',x:520,y:930,s:0.8}]
 },55),

 /* piraten-6: Finale in der Totenkopf-Bucht – die Bahn IST ein Totenkopf.
    Durch den Kiefer (zwei Zahn-Pfosten) hinauf, an der Nase (Wasser) vorbei,
    zwischen den Augen (zwei Wasserbecken) hindurch – Mauern von den Augen
    zur Schläfe lassen keinen anderen Weg; über den Augen pendelt eine Kiste
    quer unter dem Loch, das schräg über dem linken Auge liegt (aus der
    Augenlücke kommt man nicht geradeaus hinein). Auf den Wangen Sand. */
 K({id:'piraten-6',name:'Totenkopf-Bucht',par:4,
  start:{x:500,y:1300},loch:{x:330,y:300},
  rand:[...spur(s=>{const a=(125+290*s)*GRAD;return[r1(500+380*Math.cos(a)),r1(560+360*Math.sin(a))]},40),
        680,920, ...bogen(580,1300,100,0,90), ...bogen(420,1300,100,90,180), 320,920],
  waende:[[128,500, 300,500],[700,500, 872,500]],                       // Schläfen
  zonen:[
   {typ:'wasser',form:{kreis:[360,500,80]}},{typ:'wasser',form:{kreis:[640,500,80]}},  // Augen
   {typ:'wasser',form:{poly:[500,640, 550,730, 450,730]}},                           // Nase
   {typ:'sand',form:{kreis:[230,680,55]}},{typ:'sand',form:{kreis:[770,680,55]}}],
  objekte:[
   {typ:'pfosten',x:412,y:930,r:20},{typ:'pfosten',x:588,y:930,r:20},   // Zähne
   {typ:'block',rect:[450,350,100,40],bahn:[120,0],periode:2600}],
  deko:[{typ:'schatzkiste',x:500,y:1450,s:1},{typ:'steuerrad',x:880,y:1250,s:1}]
 },56)
];

/* ==========================================================================
   ❄️ EISPALAST – mittel–schwer, par 3–4. Fast überall Eis; der Abschlag
   liegt auf griffigem Schnee (Gras), Schneewehen (Sand) bremsen.
   ========================================================================== */
const EIS=[
 /* eis-1: Z-Kurs aus zwei Querwänden – auf Eis über Bande spielen. */
 E({id:'eis-1',name:'Bandenzauber',par:3,
  start:{x:300,y:1300},loch:{x:640,y:320},
  rand:rund(150,150,700,1250,100),
  waende:[[150,800, 620,800],[850,520, 420,520]],
  zonen:[{typ:'eis',form:{rect:[150,150,700,1050]}},{typ:'sand',form:{poly:ellipse(640,195,150,35,24)}}]
 },31),

 /* eis-2: Eisfläche mit vier Eislöchern (Abgrund), die die gerade Linie sperren. */
 E({id:'eis-2',name:'Eiertanz am Eisloch',par:3,
  start:{x:500,y:1310},loch:{x:500,y:260},
  rand:rund(180,140,640,1280,200),
  zonen:[
   {typ:'eis',form:{rect:[180,140,640,1080]}},
   {typ:'sand',form:{poly:ellipse(500,170,200,35,24)}},
   {typ:'loch',form:{kreis:[380,950,70]}},{typ:'loch',form:{kreis:[640,800,75]}},
   {typ:'loch',form:{kreis:[470,600,70]}},{typ:'loch',form:{kreis:[620,400,50]}}]
 },32),

 /* eis-3: Bobbahn – rechts bergauf, Kehre oben, links bergab, Schneewehe hinter dem Loch. */
 E({id:'eis-3',name:'Bob-Bahn Blitzeis',par:3,
  start:{x:760,y:1320},loch:{x:240,y:1060},
  rand:band([760,1330, 760,480, ...bogen(500,480,260,0,-180), 240,1100],240),
  zonen:[
   {typ:'eis',form:{rect:[100,80,800,1130]}},
   {typ:'sand',form:{kreis:[240,1180,70]}},
   {typ:'hang',form:{rect:[640,560,240,600]},richtung:[0,1],staerke:0.8},
   {typ:'hang',form:{rect:[120,560,240,360]},richtung:[0,1],staerke:0.8}],
  deko:[{typ:'schneemann',x:500,y:800,s:1.3},{typ:'eiskristall',x:500,y:1150,s:1}]
 },33),

 /* eis-4: Pinball auf Eis – sechs Bumper, einer bewacht direkt das Loch. */
 E({id:'eis-4',name:'Pinguin-Pinball',par:4,
  start:{x:500,y:1310},loch:{x:500,y:330},
  rand:rund(120,160,760,1240,180),
  zonen:[
   {typ:'eis',form:{rect:[120,160,760,1040]}},
   {typ:'sand',form:{kreis:[330,300,60]}},{typ:'sand',form:{kreis:[670,300,60]}}],
  objekte:[
   {typ:'bumper',x:500,y:540,r:34,kraft:1.4},
   {typ:'bumper',x:330,y:760,r:36,kraft:1.4},{typ:'bumper',x:670,y:760,r:36,kraft:1.4},
   {typ:'bumper',x:500,y:940,r:30,kraft:1.4},
   {typ:'bumper',x:300,y:1080,r:28,kraft:1.3},{typ:'bumper',x:700,y:1080,r:28,kraft:1.3}]
 },34),

 /* eis-5: Geschwungene Eisrinne, Mühle in der Engstelle, danach ein Eisloch. */
 E({id:'eis-5',name:'Frostige Flügel',par:4,
  start:{x:220,y:1300},loch:{x:780,y:290},
  rand:band(spur(s=>[500-280*Math.cos(Math.PI*s),1300-1040*s],40),s=>300-40*Math.exp(-Math.pow((s-0.5)/0.12,2))),
  zonen:[
   {typ:'eis',form:{rect:[60,60,880,1090]}},
   {typ:'sand',form:{kreis:[780,150,60]}},
   {typ:'loch',form:{kreis:[726,470,50]}}],
  objekte:[{typ:'muehle',x:500,y:780,laenge:118,fluegel:4,periode:4500}]
 },35),

 /* eis-6: Gletscherspalte quer über die Fläche, nur zwei schmale Eisbrücken (90),
    oben bewacht eine Mühle das Loch, Bumper an den Seiten. */
 E({id:'eis-6',name:'Gletscherspalte',par:4,
  start:{x:500,y:1320},loch:{x:500,y:280},
  rand:rund(120,120,760,1300,160),
  zonen:[
   {typ:'eis',form:{rect:[120,120,760,1080]}},
   {typ:'sand',form:{kreis:[330,250,55]}},{typ:'sand',form:{kreis:[670,250,55]}},
   {typ:'loch',form:{poly:[100,730, 180,715, 250,735, 300,722, 300,808, 240,795, 170,812, 100,800]}},
   {typ:'loch',form:{poly:[390,718, 450,735, 500,712, 560,738, 610,720, 610,805, 550,792, 500,815, 440,795, 390,806]}},
   {typ:'loch',form:{poly:[700,724, 760,710, 820,734, 900,720, 900,810, 830,795, 760,812, 700,800]}}],
  objekte:[
   {typ:'muehle',x:500,y:480,laenge:110,fluegel:4,periode:5000},
   {typ:'bumper',x:230,y:560,r:30,kraft:1.4},{typ:'bumper',x:770,y:560,r:30,kraft:1.4}]
 },36)
];

/* ==========================================================================
   🌋 VULKAN – schwer, par 3–4. Lava (typ 'lava', wirkt wie Wasser), Hänge an
   der Vulkanflanke, Asche (= Sand), Glutbrocken (= Bumper), Mühlen, Geysire
   (= Boost).
   ========================================================================== */
/* Lavafluss für vulkan-2: Mittellinie s = 0…1 quer über die Bahn */
const lavafluss=s=>[80+840*s,760+70*Math.sin(3*Math.PI*s)];
const flussStueck=(s0,s1)=>band(spur(t=>lavafluss(s0+(s1-s0)*t),14),140,true);
/* Kraterring für vulkan-5: 8 Hang-Sektoren um (cx,cy), alle ziehen zur Mitte */
const kraterHang=(cx,cy,ri,ra,staerke)=>Array.from({length:8},(_,k)=>{
 const m=k*45;
 return{typ:'hang',form:{poly:[...bogen(cx,cy,ra,m-22.5,m+22.5,6),...bogen(cx,cy,ri,m+22.5,m-22.5,6)]},
  richtung:[r1(-Math.cos(m*GRAD)*1e3)/1e3,r1(-Math.sin(m*GRAD)*1e3)/1e3],staerke};
});
const VULKAN=[
 /* vulkan-1: Serpentine die Flanke hinauf – zwei Kurven, beide Arme bergauf
    (Hang bremst). In den Außenkurven liegt Lava: wer zu fest über die Bande
    spielt, verbrennt. Ein Aschehaufen im Mittelstück. */
 V({id:'vulkan-1',name:'Ascheregen-Serpentine',par:3,
  start:{x:220,y:1300},loch:{x:780,y:290},
  rand:band([220,1330, 220,1000, ...bogen(420,1000,200,180,270), 580,800, ...bogen(580,600,200,90,0), 780,250],220),
  zonen:[
   {typ:'lava',form:{kreis:[232,792,52]}},
   {typ:'lava',form:{kreis:[790,808,52]}},
   {typ:'sand',form:{kreis:[500,800,40]}},
   {typ:'hang',form:{rect:[100,1020,240,240]},richtung:[0,1],staerke:0.6},
   {typ:'hang',form:{rect:[660,360,240,260]},richtung:[0,1],staerke:0.9}],
  deko:[{typ:'rauch',x:520,y:1120,s:1.2},{typ:'fels',x:420,y:560,s:1.2}]
 },61),

 /* vulkan-2: Ein Lavafluss schlängelt sich quer über die Bahn. Nur zwei
    Basaltbrücken (links und rechts) führen hinüber – die gerade Linie zum
    Loch geht mitten durch die Glut. Dahinter ein Glutbrocken (Bumper) und
    Aschefelder, unten zwei Lavatümpel. */
 V({id:'vulkan-2',name:'Brücken über die Glut',par:3,
  start:{x:500,y:1310},loch:{x:500,y:300},
  rand:rund(120,120,760,1300,120),
  zonen:[
   {typ:'lava',form:{poly:flussStueck(0,0.25)}},
   {typ:'lava',form:{poly:flussStueck(0.37,0.63)}},
   {typ:'lava',form:{poly:flussStueck(0.75,1)}},
   {typ:'lava',form:{kreis:[250,1150,50]}},{typ:'lava',form:{kreis:[760,1120,45]}},
   {typ:'sand',form:{kreis:[330,390,55]}},{typ:'sand',form:{kreis:[680,420,50]}}],
  objekte:[{typ:'bumper',x:500,y:540,r:30,kraft:1.4}],
  deko:[{typ:'glutstein',x:500,y:760,s:1},{typ:'rauch',x:620,y:700,s:0.9}]
 },62),

 /* vulkan-3: Geysir-Feld – Lavatümpel überall, dazwischen Geysire (Boost),
    die den Ball in feste Richtungen schleudern, und zwei Glutbrocken. Wer
    die Geysire klug nutzt, spart Schläge; wer sie falsch trifft, landet in
    der Lava. */
 V({id:'vulkan-3',name:'Geysir-Gestöber',par:3,
  start:{x:500,y:1320},loch:{x:500,y:270},
  rand:rund(130,120,740,1300,160),
  zonen:[
   {typ:'lava',form:{kreis:[500,1010,75]}},
   {typ:'lava',form:{kreis:[300,760,70]}},
   {typ:'lava',form:{kreis:[700,620,75]}},
   {typ:'lava',form:{kreis:[370,430,55]}},
   {typ:'sand',form:{kreis:[720,300,50]}},
   {typ:'boost',form:{kreis:[300,1060,36]},richtung:[0.4472,-0.8944],staerke:1.2},
   {typ:'boost',form:{kreis:[720,900,36]},richtung:[-0.6,-0.8],staerke:1.2},
   {typ:'boost',form:{kreis:[300,560,34]},richtung:[0.6,-0.8],staerke:1.1}],
  objekte:[
   {typ:'bumper',x:560,y:800,r:28,kraft:1.4},
   {typ:'bumper',x:640,y:420,r:26,kraft:1.4}],
  deko:[{typ:'rauch',x:300,y:1060,s:0.8},{typ:'kristall',x:860,y:1440,s:1}]
 },63),

 /* vulkan-4: Magmakammer – drei Kammern, verbunden durch zwei Engstellen
    (310 breit), in denen gegenläufige Mühlen drehen (oben dreiflügelig).
    Mittelkammer mit Lavataschen an den Seiten, unten ein Glutbrocken, oben
    Asche neben dem Loch. */
 V({id:'vulkan-4',name:'Magmakammer',par:4,
  start:{x:500,y:1280},loch:{x:500,y:300},
  rand:band(spur(s=>[500,1290-1040*s],52),
   s=>400-90*Math.exp(-Math.pow((s-0.3)/0.07,2))-90*Math.exp(-Math.pow((s-0.7)/0.07,2))),
  zonen:[
   {typ:'lava',form:{kreis:[305,770,42]}},{typ:'lava',form:{kreis:[695,770,42]}},
   {typ:'sand',form:{kreis:[340,380,45]}},{typ:'sand',form:{kreis:[660,380,45]}},   // Asche
   {typ:'sand',form:{kreis:[380,1180,45]}}],
  objekte:[
   {typ:'bumper',x:560,y:1150,r:26,kraft:1.4},
   {typ:'muehle',x:500,y:978,laenge:108,fluegel:4,periode:3400},
   {typ:'muehle',x:500,y:562,laenge:108,fluegel:3,periode:-2800}],
  deko:[{typ:'glutstein',x:150,y:770,s:1.2},{typ:'glutstein',x:850,y:770,s:1.2}]
 },64),

 /* vulkan-5: Rund um den Krater – mitten in der Bahn der Lavasee, ringsum
    zieht die Kraterflanke (8 Hang-Sektoren) den Ball zur Glut hin. Außen
    herum zum Loch oben, dort flankieren zwei Glutbrocken die Zufahrt. */
 V({id:'vulkan-5',name:'Krater-Karussell',par:4,
  start:{x:500,y:1250},loch:{x:500,y:290},
  rand:ellipse(500,760,420,640,72),
  zonen:[
   {typ:'lava',form:{kreis:[500,750,175]}},
   ...kraterHang(500,750,170,310,0.75),
   {typ:'sand',form:{kreis:[250,1150,55]}},{typ:'sand',form:{kreis:[750,1150,55]}}],
  objekte:[{typ:'bumper',x:310,y:340,r:26,kraft:1.4},{typ:'bumper',x:690,y:340,r:26,kraft:1.4}],
  deko:[{typ:'rauch',x:500,y:740,s:1.5},{typ:'rauch',x:460,y:790,s:1}]
 },65),

 /* vulkan-6: Finale – die Bahn hat die Form des Vulkans. Zwei steile
    Flankenstücke (Hang bergauf, dazwischen eine flache Terrasse zum
    Verschnaufen), zwei Lavarinnen teilen die Flanke in drei Spuren; in der
    Mitte ein Glutbrocken und eine Mühle. Oben das Loch am Kraterrand – wer
    zu fest spielt, rollt dahinter in den Krater. Wer am Hang liegen bleibt,
    rollt zurück! */
 V({id:'vulkan-6',name:'Gipfelsturm',par:5,
  start:{x:500,y:1300},loch:{x:500,y:380},
  rand:[330,130, 670,130, 920,1380, 80,1380],
  zonen:[
   {typ:'lava',form:{poly:ellipse(500,190,110,40,24)}},                 // Krater
   {typ:'lava',form:{poly:band(spur(s=>[270+90*s+10*Math.sin(4*Math.PI*s),1160-730*s],24),34)}},
   {typ:'lava',form:{poly:band(spur(s=>[730-90*s-10*Math.sin(4*Math.PI*s),1160-730*s],24),34)}},
   {typ:'hang',form:{rect:[80,880,840,280]},richtung:[0,1],staerke:0.9},   // untere Flanke
   {typ:'hang',form:{rect:[80,500,840,250]},richtung:[0,1],staerke:0.9}],  // obere Flanke
  objekte:[
   {typ:'muehle',x:500,y:620,laenge:85,fluegel:4,periode:3000},
   {typ:'bumper',x:500,y:1000,r:28,kraft:1.4}],
  deko:[{typ:'rauch',x:500,y:70,s:1.6},{typ:'rauch',x:430,y:60,s:1}]
 },66)
];

/* ==========================================================================
   🚀 WELTRAUM – schwer, par 3–5. „loch“-Zonen sind Abgründe ins All.
   ========================================================================== */
const WELTRAUM=[
 /* weltraum-1: Zwei Plattformen, dazwischen das All. Ein Trichter führt zum
    Teleporter, der auf die obere Plattform beamt. */
 A({id:'weltraum-1',name:'Beam mich hoch!',par:3,
  start:{x:500,y:1320},loch:{x:700,y:260},
  rand:rund(150,120,700,1300,120),
  waende:[[380,1150, 455,1030],[620,1150, 545,1030]],
  zonen:[{typ:'loch',form:{rect:[100,620,800,260]}}],
  objekte:[
   {typ:'tele',a:{x:500,y:1020},b:{x:300,y:500},r:30},
   {typ:'bumper',x:500,y:330,r:28,kraft:1.4}],
  deko:[{typ:'planet',x:780,y:750,s:0.9},{typ:'stern',x:300,y:700,s:0.6},{typ:'stern',x:600,y:800,s:0.5}]
 },41),

 /* weltraum-2: U-Kurve mit Boost-Pfeilen. Wer innen die Kurve schneidet,
    fällt ins All; rechts unten wartet ein Meteoritenkrater. */
 A({id:'weltraum-2',name:'Turbo-Kurve',par:3,
  start:{x:220,y:1310},loch:{x:780,y:1160},
  rand:band([220,1320, 220,560, ...bogen(500,560,280,180,360), 780,1180],240),
  zonen:[
   {typ:'loch',form:{poly:imUhrzeigersinn([...bogen(500,560,210,190,350),...bogen(500,560,150,350,190)])}},
   {typ:'loch',form:{kreis:[700,950,45]}},
   {typ:'boost',form:{kreis:[220,1000,40]},richtung:[0,-1],staerke:1.2},
   {typ:'boost',form:{kreis:[500,280,36]},richtung:[1,0],staerke:1.2}],
  deko:[{typ:'planet',x:500,y:820,s:1.4},{typ:'rakete',x:500,y:1150,s:1}]
 },42),

 /* weltraum-3: Ovale Arena voller Bumper, zwei Schwarze Löcher neben dem Ziel. */
 A({id:'weltraum-3',name:'Bumper-Galaxis',par:3,
  start:{x:500,y:1310},loch:{x:500,y:260},
  rand:ellipse(500,770,410,640,72),
  zonen:[{typ:'loch',form:{kreis:[400,420,40]}},{typ:'loch',form:{kreis:[600,420,40]}}],
  objekte:[
   {typ:'bumper',x:500,y:560,r:34,kraft:1.5},
   {typ:'bumper',x:350,y:700,r:30,kraft:1.5},{typ:'bumper',x:650,y:700,r:30,kraft:1.5},
   {typ:'bumper',x:500,y:850,r:34,kraft:1.5},
   {typ:'bumper',x:300,y:980,r:28,kraft:1.5},{typ:'bumper',x:700,y:980,r:28,kraft:1.5},
   {typ:'bumper',x:500,y:1110,r:26,kraft:1.5}]
 },43),

 /* weltraum-4: Zwei gegenläufige Mühlen in zwei Engstellen, dazwischen Krater. */
 A({id:'weltraum-4',name:'Doppelmühle Andromeda',par:4,
  start:{x:500,y:1290},loch:{x:500,y:300},
  rand:band(spur(s=>[500,1280-1040*s],52),
   s=>380-120*Math.exp(-Math.pow((s-0.279)/0.07,2))-120*Math.exp(-Math.pow((s-0.692)/0.07,2))),
  zonen:[{typ:'loch',form:{kreis:[330,775,40]}},{typ:'loch',form:{kreis:[670,775,40]}}],
  objekte:[
   {typ:'muehle',x:500,y:990,laenge:118,fluegel:4,periode:3600},
   {typ:'muehle',x:500,y:560,laenge:118,fluegel:4,periode:-3000}]
 },44),

 /* weltraum-5: Drei Kammern, zwei Schleusen-Tore mit verschiedenem Takt.
    Abkürzung: Teleporter rechts in der Mittelkammer beamt hinter Tor 2. */
 A({id:'weltraum-5',name:'Schleusen-Sprint',par:4,
  start:{x:500,y:1320},loch:{x:620,y:320},
  rand:rund(150,120,700,1300,100),
  waende:[[150,1000, 425,1000],[575,1000, 850,1000],[150,620, 425,620],[575,620, 850,620]],
  zonen:[
   {typ:'loch',form:{kreis:[250,800,40]}},
   {typ:'loch',form:{kreis:[360,240,35]}},
   {typ:'boost',form:{kreis:[500,880,36]},richtung:[0,-1],staerke:1.3}],
  objekte:[
   {typ:'tor',x:500,y:1000,b:150,offen:1000,zu:1400},
   {typ:'tor',x:500,y:620,b:150,offen:900,zu:900},
   {typ:'tele',a:{x:760,y:820},b:{x:260,y:420},r:28},
   {typ:'bumper',x:740,y:260,r:28,kraft:1.5}]
 },45),

 /* weltraum-6: Finale – drei Plattformen über dem All. Brücke links (ohne
    Geländer), Mühle + Bumper in der Mitte, Brücke rechts mit Tor, oben eine
    dreiflügelige Gegenmühle vor dem Loch. Teleporter unten rechts als Abkürzung.
    Nachgebessert nach Testspielen: Geländer an der Unterkante des oberen Abgrunds
    (von unten fällt man nicht mehr hinein, nur durchs Tor geht es weiter) und
    linke Brücke 40 breiter – vorher endete jede zweite Runde mit der Höchstzahl. */
 A({id:'weltraum-6',name:'Ereignishorizont',par:5,
  start:{x:500,y:1320},loch:{x:250,y:260},
  rand:rund(100,100,800,1320,120),
  waende:[[700,480, 700,600],[860,480, 860,600],[104,604, 700,604],[860,604, 896,604]],
  zonen:[
   {typ:'loch',form:{rect:[280,960,620,120]}},
   {typ:'loch',form:{rect:[100,480,600,120]}},
   {typ:'loch',form:{rect:[860,480,40,120]}},
   {typ:'loch',form:{kreis:[410,155,28]}},
   {typ:'boost',form:{kreis:[230,1190,34]},richtung:[-0.4472,-0.8944],staerke:1.2},
   {typ:'boost',form:{kreis:[650,680,32]},richtung:[0.8,-0.6],staerke:1.2}],
  objekte:[
   {typ:'tele',a:{x:820,y:1240},b:{x:250,y:830},r:28},
   {typ:'muehle',x:460,y:800,laenge:100,fluegel:4,periode:3200},
   {typ:'bumper',x:760,y:860,r:30,kraft:1.5},{typ:'bumper',x:250,y:705,r:26,kraft:1.5},
   {typ:'tor',x:780,y:540,b:160,offen:1100,zu:1100},
   {typ:'muehle',x:560,y:300,laenge:100,fluegel:3,periode:-2800}]
 },46)
];

const PLAETZE=[
 {id:'park',name:'Sonnenpark',emoji:'🌳',bahnen:PARK},
 {id:'wueste',name:'Wüstenoase',emoji:'🏜️',bahnen:WUESTE},
 {id:'piraten',name:'Piratenbucht',emoji:'🏴‍☠️',bahnen:PIRATEN},
 {id:'eis',name:'Eispalast',emoji:'❄️',bahnen:EIS},
 {id:'vulkan',name:'Vulkan',emoji:'🌋',bahnen:VULKAN},
 {id:'weltraum',name:'Weltraum',emoji:'🚀',bahnen:WELTRAUM}
];
const INDEX={};PLAETZE.forEach(p=>p.bahnen.forEach(b=>{INDEX[b.id]=b}));

const API={
 PLAETZE,
 bahn:id=>INDEX[id]||null,
 alle:()=>PLAETZE.reduce((a,p)=>a.concat(p.bahnen),[]),
 platz:id=>PLAETZE.find(p=>p.id===id)||null,
 helfer:{rechteck,bogen,ellipse,rund,spur,band,flaeche,imUhrzeigersinn,rahmenDeko}
};
if(typeof module!=='undefined')module.exports=API;else root.BAHNEN=API;
})(this);
