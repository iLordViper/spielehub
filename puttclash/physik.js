/* ==========================================================================
   PUTTCLASH · PHYSIK (physik.js)
   --------------------------------------------------------------------------
   Reine Rechenfunktionen ohne Bildschirm – darum leicht zu prüfen
   (node puttclash/physik.test.js). Vertrag: puttclash/FORMAT.md, „Physik“.

   Was passiert bei einem Schuss?
     Der Ball (Radius 12) startet mit Geschwindigkeit KONST.V_MAX · kraft in
     Richtung winkel (0 = rechts, π/2 = unten, y zeigt nach unten). Dann wird
     in festen Schritten von 1/240 s gerechnet:
       1. Untergrund unter der Ballmitte (Wasser/Lava/Abgrund → Schuss vorbei)
       2. Loch (langsam genug → versenkt, zu schnell → Lip-out)
       3. Teleporter
       4. Kräfte: Hang + Boost, Rollreibung je Untergrund
       5. Bewegung in Unterschritten (höchstens 0,45 · Ballradius pro
          Unterschritt) mit Kreis-gegen-Linie/Punkt/Kreis/Rechteck-Kollision.
          Weil der Ball pro Unterschritt weniger als den halben Radius weit
          kommt, kann er nie durch eine Linie (Dicke 0) „tunneln“.
     Der Ball bleibt liegen, wenn er langsamer als V_STOP ist und keine Kraft
     (Hang/Boost) stärker ist als die Haftreibung. Höchstdauer 12 s.

   Einheiten: Längen in Feld-Einheiten (Feld 1000 × 1500), Geschwindigkeiten
   in Einheiten pro SEKUNDE, Beschleunigungen in Einheiten/s². Nach außen
   (pfad, ereignisse, dauer, t0) immer Millisekunden.

   Öffentliche API (global PHYSIK, in Node per require):
     KONST                                     alle Zahlen, siehe unten
     schuss(bahn, ball, winkel, kraft, t0)     → {pfad, ende, versenkt, wasser, dauer, ereignisse}
     objektZustand(bahn, obj, t)               → Geometrie bewegter/fester Objekte zur Zeit t
     untergrund(bahn, x, y)                    → 'gras'|'sand'|'eis'|'wasser'|'lava'|'loch'|'aus'
     besterSchuss(bahn, ball, t0, optionen)    → {winkel, kraft, ergebnis, wert, versuche}  (Bot/Tests)
     lochDistanz(bahn, x, y)                   → Weglänge zum Loch um Wände herum (Bot/Tests)
     vergiss(bahn)                             → Zwischenspeicher einer Bahn löschen (nach Änderungen)

   pfad:       [[t, x, y], …] alle ~33 ms, Werte auf 1 Nachkommastelle gerundet.
               Zwei Punkte mit GLEICHEM t bedeuten einen Sprung (Teleporter,
               Wasser → zurück zum Abschlag): nicht dazwischen überblenden.
               Letzter Punkt = Ende (bei Wasser: der Abschlagspunkt).
   ereignisse: [t, typ, x, y, extra?] mit typ
               'wand'   (auch Pfosten/Block/Mühle/Tor) extra = Stärke 0..1
               'bumper' extra = Stärke 0..1
               'sand'   beim Hineinrollen
               'boost'  beim Hineinrollen
               'tele'   x,y = Austritt b, extra = [ax, ay] Eintritt
               'wasser' x,y = Platschstelle, extra = 'wasser'|'lava'|'loch'
               'loch'   versenkt (x,y = Loch)
               'lipout' zu schnell übers Loch (Zusatz-Ereignis für einen Ton)

   Bahnformat (siehe FORMAT.md) – Ergänzungen, die die Physik festlegt:
     - muehle.laenge = Länge EINES Flügels vom Mittelpunkt bis zur Spitze.
       Balken sind Kapseln der Dicke 14 (Radius 7) von (x,y) bis zur Spitze.
     - tor: waagerechter Balken Dicke 14 von x−b/2 bis x+b/2 auf Höhe y.
     - Zonen 'hang' und 'boost' sind Auflagen: der Untergrund darunter bleibt
       (meist Gras). Zusätzlich erlaubt: Zone typ 'gras' (setzt auf Gras zurück).
     - Fehlende Werte: bumper r 20 / kraft 1.4, pfosten r 10, tele r 28,
       muehle fluegel 4 / laenge 160 / periode 4000, block bahn [0,0].

   So änderst du das Spielgefühl:
     Nur in KONST (Kommentare dort). Reichweiten prüft physik.test.js und
     gibt sie aus – nach Änderungen dort die Grenzen mit anpassen.

   So fügst du einen neuen Untergrund hinzu (z. B. 'matsch'):
     1. KONST.REIBUNG.matsch = {a:…, k:…} eintragen.
     2. 'matsch' in FLAECHEN (unten) aufnehmen. Soll er den Schuss beenden
        wie Wasser, zusätzlich in AUS_FLAECHEN.
     3. Grafik und FORMAT.md ergänzen.

   So fügst du ein neues Hindernis hinzu:
     1. In vorbereiten() einsortieren (feste Kreise → C.kreise, Bewegtes →
        C.dyn).
     2. In kollidiere() (innerhalb von lauf) die Berührung prüfen:
        pruefeSeg / pruefeKreis / pruefeRect mit der Geschwindigkeit des
        Hindernisses aufrufen – den Rest (Herausschieben, Abprall, Töne)
        erledigt die Schleife.
     3. objektZustand() liefert der Grafik dieselbe Geometrie zur Zeit t.

   Rein deterministisch: kein Zufall, keine Uhr. Gleiche Eingaben → gleiches
   Ergebnis.
   ========================================================================== */
(function(root){
'use strict';

const KONST={
 FELD_B:1000, FELD_H:1500,      // logisches Feld
 BALL_R:12,                     // Ballradius
 LOCH_R:20,                     // Lochradius (Ballmitte muss hinein)
 DT:1/240,                      // feste Schrittweite in s
 PFAD_SCHRITTE:8,               // alle 8 Schritte (= 33,3 ms) ein Pfadpunkt
 MAX_DAUER:12000,               // ms, danach endet jeder Schuss
 // Startgeschwindigkeit = V_MAX · kraft (linear, damit der Kraftbalken ehrlich ist).
 // Mit der Gras-Reibung rollt Kraft 1 ≈ 2600 (≈ 1,7 Feldlängen), Kraft 0.3 ≈ 350.
 V_MAX:1600,
 V_GRENZE:2600,                 // absolute Obergrenze (Bumper/Boost können beschleunigen)
 // Rollreibung: Bremsung = a + k·v (Einheiten/s²). a = gleichbleibender Anteil
 // (Rollwiderstand, sorgt fürs Liegenbleiben), k = geschwindigkeitsabhängiger
 // Anteil (schnelle Bälle verlieren mehr). Die Mischung sorgt dafür, dass die
 // Reichweite gut dosierbar ist: halbe Kraft ≠ viertel Weg.
 REIBUNG:{
  gras:{a:255, k:0.24},         // Kraft 1 ≈ 2600, 0.6 ≈ 1150, 0.3 ≈ 350
  sand:{a:1000,k:2.0},          // stark bremsend: Kraft 1 ≈ 440, 0.3 ≈ 75
  eis: {a:90,  k:0.12}          // sehr glatt: Kraft 0.3 ≈ 900, Kraft 1 ≈ 6000 (Banden!)
 },
 ABPRALL:0.72,                  // Wände, Pfosten, Block, Mühle, Tor: Normalanteil × 0.72
 BUMPER_MIN:250,                // Bumper schießt mindestens mit 250/s zurück
 FANG:380,                      // Fanggrenze: unter 380/s fällt der Ball ins Loch
                                // (entspricht ~230 Einheiten „Überrollweg“ auf Gras)
 LIPOUT_WINKEL:0.45,            // größte Ablenkung (rad) beim Lip-out
 LIPOUT_BREMSE:0.8,             // Geschwindigkeit × 0.8 beim Lip-out
 HANG_G:300,                    // Hang-Beschleunigung bei staerke 1 (Einheiten/s²)
 HANG_REIB:0.4,                 // auf Hängen zählt nur 40 % des festen Reibungsanteils,
                                // damit auch staerke 0.5 (150) die Gras-Haftung (102) schlägt
 BOOST_A:2200,                  // Boost-Beschleunigung bei staerke 1 (solange der Ball drauf ist)
 TELE_SPERRE:250,               // ms nach einem Teleport ohne weiteren Teleport
 V_STOP:4,                      // darunter bleibt der Ball liegen (wenn keine Kraft wirkt)
 RUHE_MS:600, RUHE_WEG:2,       // eingeklemmt (z. B. am Hang gegen die Bande): weniger als
                                // 2 Einheiten in 600 ms und langsam → liegt
 BALKEN_DICKE:14,               // Mühle und Tor
 WAND_TON_MIN:40                // Aufprall langsamer als 40/s erzeugt kein 'wand'-Ereignis
};

const TAU=Math.PI*2;
const r1=v=>Math.round(v*10)/10;
const FLAECHEN={gras:1,sand:1,eis:1,wasser:1,lava:1,loch:1};
const AUS_FLAECHEN={wasser:1,lava:1,loch:1};
const ART_WAND=0,ART_PFOSTEN=1,ART_BUMPER=2,ART_BLOCK=3,ART_MUEHLE=4,ART_TOR=5;

/* ---------- Formen (Zonen) ---------- */
function formVorbereiten(f){
 if(!f)return null;
 if(f.kreis){const[x,y,r]=f.kreis;return{art:1,x,y,r2:r*r,box:[x-r,y-r,x+r,y+r]}}
 if(f.rect){let[x,y,b,h]=f.rect;if(b<0){x+=b;b=-b}if(h<0){y+=h;h=-h}return{art:2,box:[x,y,x+b,y+h]}}
 if(f.poly&&f.poly.length>=6){const p=f.poly;return{art:3,p,box:polyBox(p)}}
 return null;
}
function polyBox(p){let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
 for(let i=0;i+1<p.length;i+=2){if(p[i]<a)a=p[i];if(p[i]>c)c=p[i];if(p[i+1]<b)b=p[i+1];if(p[i+1]>d)d=p[i+1]}
 return[a,b,c,d]}
/* Punkt im Polygon (Strahl-Methode), p = [x1,y1,x2,y2,…] */
function inPoly(p,x,y){
 let inn=false;const n=p.length-(p.length&1);
 for(let i=0,j=n-2;i<n;j=i,i+=2){
  const yi=p[i+1],yj=p[j+1];
  if((yi>y)!==(yj>y)){const xi=p[i],xj=p[j];if(x<(xj-xi)*(y-yi)/(yj-yi)+xi)inn=!inn}
 }
 return inn;
}
function inForm(f,x,y){
 const b=f.box;if(x<b[0]||x>b[2]||y<b[1]||y>b[3])return false;
 if(f.art===1){const dx=x-f.x,dy=y-f.y;return dx*dx+dy*dy<=f.r2}
 if(f.art===2)return true;
 return inPoly(f.p,x,y);
}

/* ---------- Zwischenspeicher je Bahn ----------
   Wände als flache Liste, Zonen mit Begrenzungsrahmen. Wird beim ersten
   Schuss gebaut. Bahn danach geändert (Editor)? → PHYSIK.vergiss(bahn). */
const CACHE=typeof WeakMap!=='undefined'?new WeakMap():null;
function vergiss(bahn){if(CACHE)CACHE.delete(bahn)}
function vorbereiten(bahn){
 let C=CACHE&&CACHE.get(bahn);if(C)return C;
 const segs=[];
 const addSeg=(x1,y1,x2,y2)=>{if(x1!==x2||y1!==y2)segs.push(x1,y1,x2,y2)};
 const r=bahn.rand||[];
 const rn=r.length-(r.length&1);
 for(let i=0;i<rn;i+=2){const j=(i+2)%rn;addSeg(r[i],r[i+1],r[j],r[j+1])}
 for(const w of bahn.waende||[])for(let i=0;i+3<w.length;i+=2)addSeg(w[i],w[i+1],w[i+2],w[i+3]);
 const flaechen=[],haenge=[],boosts=[];
 for(const z of bahn.zonen||[]){
  const f=formVorbereiten(z&&z.form);if(!f)continue;
  if(z.typ==='hang'||z.typ==='boost'){
   const d=z.richtung||[0,0],l=Math.hypot(d[0],d[1])||1;
   const st=z.staerke!=null?+z.staerke:1;
   (z.typ==='hang'?haenge:boosts).push({f,rx:d[0]/l,ry:d[1]/l,st});
  }else if(FLAECHEN[z.typ])flaechen.push({f,typ:z.typ});
 }
 const kreise=[],dyn=[],teles=[];
 for(const o of bahn.objekte||[]){
  if(!o)continue;
  if(o.typ==='bumper')kreise.push({x:o.x,y:o.y,r:o.r!=null?o.r:20,e:o.kraft!=null?+o.kraft:1.4,art:ART_BUMPER});
  else if(o.typ==='pfosten')kreise.push({x:o.x,y:o.y,r:o.r!=null?o.r:10,e:KONST.ABPRALL,art:ART_PFOSTEN});
  else if(o.typ==='tele'&&o.a&&o.b){const tr=o.r!=null?o.r:28;teles.push({ax:o.a.x,ay:o.a.y,bx:o.b.x,by:o.b.y,r:tr,r2:tr*tr})}
  else if(o.typ==='block'||o.typ==='muehle'||o.typ==='tor')dyn.push(o);
 }
 C={segs:new Float64Array(segs),rand:rn>=6?r:null,randBox:rn>=6?polyBox(r):null,
    flaechen,haenge,boosts,kreise,dyn,teles,feld:undefined};
 if(CACHE)CACHE.set(bahn,C);
 return C;
}
function flaecheBei(C,x,y){
 const L=C.flaechen;
 for(let i=L.length-1;i>=0;i--)if(inForm(L[i].f,x,y))return L[i].typ;
 return'gras';
}
function zoneBei(L,x,y){for(let i=L.length-1;i>=0;i--)if(inForm(L[i].f,x,y))return L[i];return null}

/* Untergrund unter einem Punkt. 'aus' = außerhalb von rand. */
function untergrund(bahn,x,y){
 const C=vorbereiten(bahn);
 if(C.rand&&!inPoly(C.rand,x,y))return'aus';
 return flaecheBei(C,x,y);
}

/* ---------- Bewegte Objekte (nur von der absoluten Zeit t abhängig) ---------- */
const torZu=(o,t)=>{const of=o.offen!=null?+o.offen:1200,zu=o.zu!=null?+o.zu:1200,P=of+zu;
 if(!(P>0))return false;if(!(zu>0))return false;if(!(of>0))return true;
 return((t%P)+P)%P>=of};
function muehleWerte(o){return{L:o.laenge!=null?+o.laenge:160,n:Math.max(1,Math.round(o.fluegel!=null?+o.fluegel:4)),P:o.periode!=null?+o.periode:4000}}

/* Geometrie eines Objekts zur Zeit t (ms) – für die Grafik.
   block   → {rect:[x,y,b,h]}
   muehle  → {balken:[[x1,y1,x2,y2],…], dicke:14, mitte:[x,y], winkel}
   tor     → {zu:bool, balken:[[x1,y1,x2,y2]], dicke:14}
   bumper/pfosten → {kreis:[x,y,r]}
   tele    → {a:{x,y}, b:{x,y}, r} */
function objektZustand(bahn,obj,t){
 t=+t||0;
 switch(obj&&obj.typ){
  case'block':{
   const[x,y,b,h]=obj.rect,d=obj.bahn||[0,0],P=+obj.periode;
   const s=P?Math.sin(TAU*t/P):0;
   return{rect:[x+d[0]*s,y+d[1]*s,b,h]};
  }
  case'muehle':{
   const{L,n,P}=muehleWerte(obj);const w0=P?TAU*t/P:0;const balken=[];
   for(let k=0;k<n;k++){const w=w0+k*TAU/n;balken.push([obj.x,obj.y,obj.x+L*Math.cos(w),obj.y+L*Math.sin(w)])}
   return{balken,dicke:KONST.BALKEN_DICKE,mitte:[obj.x,obj.y],winkel:w0};
  }
  case'tor':{
   const h=obj.b/2;
   return{zu:torZu(obj,t),balken:[[obj.x-h,obj.y,obj.x+h,obj.y]],dicke:KONST.BALKEN_DICKE};
  }
  case'bumper':return{kreis:[obj.x,obj.y,obj.r!=null?obj.r:20]};
  case'pfosten':return{kreis:[obj.x,obj.y,obj.r!=null?obj.r:10]};
  case'tele':return{a:{x:obj.a.x,y:obj.a.y},b:{x:obj.b.x,y:obj.b.y},r:obj.r!=null?obj.r:28};
 }
 return{};
}

/* ---------- Der eigentliche Schuss ----------
   beob (nur für Tests): wird nach jedem Unterschritt mit (tMs, x, y, vx, vy)
   aufgerufen. */
function lauf(bahn,ball,winkel,kraft,t0,beob){
 const K=KONST,C=vorbereiten(bahn);
 const R=K.BALL_R,DT=K.DT,DTMS=DT*1000,MAXWEG=R*0.45,HALB=K.BALKEN_DICKE/2;
 kraft=+kraft;if(!(kraft>0))kraft=0;if(kraft>1)kraft=1;
 winkel=+winkel||0;t0=+t0||0;
 const sx=+ball.x,sy=+ball.y;
 let x=sx,y=sy;
 let vx=Math.cos(winkel)*K.V_MAX*kraft,vy=Math.sin(winkel)*K.V_MAX*kraft;
 const pfad=[[0,r1(x),r1(y)]],ereignisse=[];
 let versenkt=false,wasser=false,schritt=0,tRel=0;
 const maxSchritte=Math.round(K.MAX_DAUER/DTMS);
 const loch=bahn.loch,lochX=loch?+loch.x:0,lochY=loch?+loch.y:0,LR2=K.LOCH_R*K.LOCH_R;
 let imLoch=false,gelippt=false,teleBis=-1,imBoost=false,tonBis=-1e9;
 let fl=flaecheBei(C,x,y),letzteFl=fl;
 let ruheX=x,ruheY=y,ruheT=0;
 const startInnen=!C.rand||inPoly(C.rand,x,y);
 const segs=C.segs,kreise=C.kreise,dyn=C.dyn;

 const ereignis=(t,typ,ex,ey,extra)=>{const e=[r1(t),typ,r1(ex),r1(ey)];if(extra!==undefined)e.push(extra);ereignisse.push(e)};

 // tiefste Berührung im aktuellen Unterschritt
 let bPen,bNx,bNy,bVx,bVy,bArt,bE;
 // Kapsel/Linie von (x1,y1) nach (x2,y2), Abstand rad. ovx/ovy = Geschwindigkeit
 // des Hindernisses, om/cx/cy = Drehung (rad/s) um (cx,cy) für die Mühle.
 function pruefeSeg(x1,y1,x2,y2,rad,ovx,ovy,om,cx,cy,art,e){
  const ex=x2-x1,ey=y2-y1,l2=ex*ex+ey*ey;
  let u=l2>0?((x-x1)*ex+(y-y1)*ey)/l2:0;if(u<0)u=0;else if(u>1)u=1;
  const qx=x1+ex*u,qy=y1+ey*u,dx=x-qx,dy=y-qy,d2=dx*dx+dy*dy;
  if(d2>=rad*rad)return;
  const d=Math.sqrt(d2),pen=rad-d;if(pen<=bPen)return;
  if(om){ovx-=om*(qy-cy);ovy+=om*(qx-cx)}
  let nx,ny;
  if(d>1e-9){nx=dx/d;ny=dy/d}
  else{const l=Math.sqrt(l2);if(l>0){nx=-ey/l;ny=ex/l}else{nx=0;ny=-1}
   if(nx*(vx-ovx)+ny*(vy-ovy)>0){nx=-nx;ny=-ny}}
  bPen=pen;bNx=nx;bNy=ny;bVx=ovx;bVy=ovy;bArt=art;bE=e;
 }
 function pruefeKreis(cx,cy,rad,art,e){
  const dx=x-cx,dy=y-cy,d2=dx*dx+dy*dy;if(d2>=rad*rad)return;
  const d=Math.sqrt(d2),pen=rad-d;if(pen<=bPen)return;
  let nx,ny;if(d>1e-9){nx=dx/d;ny=dy/d}else{const s=Math.sqrt(vx*vx+vy*vy);if(s>0){nx=-vx/s;ny=-vy/s}else{nx=0;ny=-1}}
  bPen=pen;bNx=nx;bNy=ny;bVx=0;bVy=0;bArt=art;bE=e;
 }
 function pruefeRect(rx,ry,rb,rh,ovx,ovy){
  const x2=rx+rb,y2=ry+rh;
  if(x<rx-R||x>x2+R||y<ry-R||y>y2+R)return;
  let nx,ny,pen;
  if(x>rx&&x<x2&&y>ry&&y<y2){ // Mitte im Block: kürzester Weg hinaus
   const dl=x-rx,dr=x2-x,dt=y-ry,db=y2-y,m=Math.min(dl,dr,dt,db);
   pen=R+m;if(m===dl){nx=-1;ny=0}else if(m===dr){nx=1;ny=0}else if(m===dt){nx=0;ny=-1}else{nx=0;ny=1}
  }else{
   const qx=x<rx?rx:x>x2?x2:x,qy=y<ry?ry:y>y2?y2:y,dx=x-qx,dy=y-qy,d2=dx*dx+dy*dy;
   if(d2>=R*R)return;const d=Math.sqrt(d2);pen=R-d;
   if(d>1e-9){nx=dx/d;ny=dy/d}else{nx=0;ny=-1}
  }
  if(pen<=bPen)return;
  bPen=pen;bNx=nx;bNy=ny;bVx=ovx;bVy=ovy;bArt=ART_BLOCK;bE=K.ABPRALL;
 }
 function kollidiere(tAbs,tR){
  for(let it=0;it<5;it++){
   bPen=0;
   for(let i=0;i<segs.length;i+=4)pruefeSeg(segs[i],segs[i+1],segs[i+2],segs[i+3],R,0,0,0,0,0,ART_WAND,K.ABPRALL);
   for(let i=0;i<kreise.length;i++){const c=kreise[i];pruefeKreis(c.x,c.y,c.r+R,c.art,c.e)}
   for(let i=0;i<dyn.length;i++){
    const o=dyn[i];
    if(o.typ==='block'){
     const P=+o.periode,d=o.bahn||[0,0];let ox=0,oy=0,ovx=0,ovy=0;
     if(P){const ph=TAU*tAbs/P,s=Math.sin(ph),f=TAU/P*1000*Math.cos(ph);ox=d[0]*s;oy=d[1]*s;ovx=d[0]*f;ovy=d[1]*f}
     pruefeRect(o.rect[0]+ox,o.rect[1]+oy,o.rect[2],o.rect[3],ovx,ovy);
    }else if(o.typ==='muehle'){
     const{L,n,P}=muehleWerte(o);const ddx=x-o.x,ddy=y-o.y,rr=L+R+HALB;
     if(ddx*ddx+ddy*ddy>=rr*rr)continue;
     const w0=P?TAU*tAbs/P:0,om=P?TAU/P*1000:0;
     for(let k=0;k<n;k++){const w=w0+k*TAU/n;
      pruefeSeg(o.x,o.y,o.x+L*Math.cos(w),o.y+L*Math.sin(w),R+HALB,0,0,om,o.x,o.y,ART_MUEHLE,K.ABPRALL)}
    }else if(o.typ==='tor'){
     if(torZu(o,tAbs)){const h=o.b/2;pruefeSeg(o.x-h,o.y,o.x+h,o.y,R+HALB,0,0,0,0,0,ART_TOR,K.ABPRALL)}
    }
   }
   if(bPen<=0)break;
   x+=bNx*(bPen+1e-4);y+=bNy*(bPen+1e-4);
   const vn=(vx-bVx)*bNx+(vy-bVy)*bNy;
   if(vn<0){
    vx-=(1+bE)*vn*bNx;vy-=(1+bE)*vn*bNy;
    const px=x-bNx*R,py=y-bNy*R;
    if(bArt===ART_BUMPER){
     const aus=(vx-bVx)*bNx+(vy-bVy)*bNy;
     if(aus<K.BUMPER_MIN){vx+=(K.BUMPER_MIN-aus)*bNx;vy+=(K.BUMPER_MIN-aus)*bNy}
     if(tR>=tonBis){ereignis(tR,'bumper',px,py,Math.round(Math.min(1,-vn/1000)*100)/100);tonBis=tR+50}
    }else if(-vn>K.WAND_TON_MIN&&tR>=tonBis){
     ereignis(tR,'wand',px,py,Math.round(Math.min(1,-vn/1200)*100)/100);tonBis=tR+50;
    }
    const s=Math.sqrt(vx*vx+vy*vy);if(s>K.V_GRENZE){const f=K.V_GRENZE/s;vx*=f;vy*=f}
   }
  }
 }

 // Ball liegt am Start in einer Wand/einem Objekt? Erst herausschieben.
 kollidiere(t0,0);

 while(schritt<maxSchritte){
  // 1. Untergrund
  fl=flaecheBei(C,x,y);
  if(AUS_FLAECHEN[fl]){wasser=true;ereignis(tRel,'wasser',x,y,fl);break}
  if(fl==='sand'&&letzteFl!=='sand')ereignis(tRel,'sand',x,y);
  letzteFl=fl;
  let sp=Math.sqrt(vx*vx+vy*vy);
  // 2. Loch
  if(loch){
   const ox=x-lochX,oy=y-lochY;
   if(ox*ox+oy*oy<LR2){
    if(sp<K.FANG&&(!gelippt||sp<K.FANG*0.4)){versenkt=true;ereignis(tRel,'loch',lochX,lochY);break}
    if(!imLoch&&sp>=K.FANG){
     // Lip-out: Ball wird vom Lochrand seitlich weggedrückt (weg vom Lochmittelpunkt)
     const kreuz=vx*oy-vy*ox,seite=kreuz>=0?1:-1,quer=Math.abs(kreuz)/sp;
     const w=K.LIPOUT_WINKEL*(0.35+0.65*Math.min(1,quer/K.LOCH_R))*Math.min(1,1.5*K.FANG/sp)*seite;
     const cs=Math.cos(w),sn=Math.sin(w),b=K.LIPOUT_BREMSE;
     const nvx=(vx*cs-vy*sn)*b,nvy=(vx*sn+vy*cs)*b;vx=nvx;vy=nvy;sp*=b;
     gelippt=true;ereignis(tRel,'lipout',lochX,lochY);
    }
    imLoch=true;
   }else{imLoch=false;gelippt=false}
  }
  // 3. Teleporter (nur a → b)
  if(tRel>=teleBis){
   let tp=null;
   for(let i=0;i<C.teles.length;i++){const q=C.teles[i],dx=x-q.ax,dy=y-q.ay;if(dx*dx+dy*dy<q.r2){tp=q;break}}
   if(tp){
    pfad.push([r1(tRel),r1(x),r1(y)]);
    const ax=x,ay=y;x=tp.bx;y=tp.by;
    pfad.push([r1(tRel),r1(x),r1(y)]);
    ereignis(tRel,'tele',x,y,[r1(ax),r1(ay)]);
    teleBis=tRel+K.TELE_SPERRE;imLoch=false;gelippt=false;
    continue; // am neuen Ort Untergrund/Loch neu prüfen (gleiche Zeit)
   }
  }
  // 4. Kräfte
  let axx=0,ayy=0;
  const hg=C.haenge.length?zoneBei(C.haenge,x,y):null;
  if(hg){axx+=hg.rx*K.HANG_G*hg.st;ayy+=hg.ry*K.HANG_G*hg.st}
  const bo=C.boosts.length?zoneBei(C.boosts,x,y):null;
  if(bo){axx+=bo.rx*K.BOOST_A*bo.st;ayy+=bo.ry*K.BOOST_A*bo.st;if(!imBoost)ereignis(tRel,'boost',x,y)}
  imBoost=!!bo;
  const rb=K.REIBUNG[fl]||K.REIBUNG.gras;
  const ra=hg?rb.a*K.HANG_REIB:rb.a;
  const A=Math.sqrt(axx*axx+ayy*ayy);
  if(sp<K.V_STOP&&A<=ra)break; // liegt
  vx+=axx*DT;vy+=ayy*DT;
  sp=Math.sqrt(vx*vx+vy*vy);
  if(sp>0){const dec=(ra+rb.k*sp)*DT;if(dec>=sp){vx=0;vy=0;sp=0}else{const f=(sp-dec)/sp;vx*=f;vy*=f;sp-=dec}}
  if(sp>K.V_GRENZE){const f=K.V_GRENZE/sp;vx*=f;vy*=f;sp=K.V_GRENZE}
  // 5. Bewegung in Unterschritten
  const x0=x,y0=y;let rest=DT;
  for(let g=0;rest>1e-12&&g<16;g++){
   const s=Math.sqrt(vx*vx+vy*vy);let h=rest;if(s*h>MAXWEG)h=MAXWEG/s;
   x+=vx*h;y+=vy*h;rest-=h;
   const tr=tRel+(DT-rest)*1000;
   kollidiere(t0+tr,tr);
   if(beob)beob(tr,x,y,vx,vy);
  }
  // Sicherheitsnetz: niemals außerhalb von rand
  if(startInnen&&C.rand&&!inPoly(C.rand,x,y)){x=x0;y=y0;vx=-vx*K.ABPRALL;vy=-vy*K.ABPRALL}
  schritt++;tRel=schritt*DTMS;
  if(schritt%K.PFAD_SCHRITTE===0)pfad.push([r1(tRel),r1(x),r1(y)]);
  // eingeklemmt?
  if(tRel-ruheT>=K.RUHE_MS){
   const dx=x-ruheX,dy=y-ruheY;
   if(dx*dx+dy*dy<K.RUHE_WEG*K.RUHE_WEG&&vx*vx+vy*vy<900)break;
   ruheX=x;ruheY=y;ruheT=tRel;
  }
 }

 const tEnd=r1(tRel);
 const setzeEnde=(px,py)=>{const l=pfad[pfad.length-1];if(l[0]===tEnd&&!(pfad.length>1&&pfad[pfad.length-2][0]===tEnd)){l[1]=px;l[2]=py}else if(l[0]!==tEnd||l[1]!==px||l[2]!==py)pfad.push([tEnd,px,py])};
 let ende;
 if(versenkt){ende={x:lochX,y:lochY};setzeEnde(r1(lochX),r1(lochY))}
 else if(wasser){setzeEnde(r1(x),r1(y));pfad.push([tEnd,r1(sx),r1(sy)]);ende={x:sx,y:sy}}
 else{ende={x:r1(x),y:r1(y)};setzeEnde(ende.x,ende.y)}
 return{pfad,ende,versenkt,wasser,dauer:tEnd,ereignisse};
}

function schuss(bahn,ball,winkel,kraft,t0){return lauf(bahn,ball,winkel,kraft,t0,null)}

/* ---------- Wegelänge zum Loch (für Bot und Lösbarkeits-Prüfung) ----------
   Raster mit 10er Zellen über rand. Gesperrt: außerhalb, Wasser/Lava/Abgrund,
   näher als 10 an einer Wand, in Pfosten/Bumpern. Teleporter: Zellen in a
   bekommen den Wert von b. Dann Dijkstra vom Loch aus. Bewegte Objekte
   werden ignoriert. */
function lochFeld(bahn){
 const C=vorbereiten(bahn);
 if(C.feld!==undefined)return C.feld;
 if(!C.rand||!bahn.loch){C.feld=null;return null}
 const G=10,frei=KONST.BALL_R-2,[mx,my,Mx,My]=C.randBox;
 const nx=Math.ceil((Mx-mx)/G)+1,ny=Math.ceil((My-my)/G)+1,n=nx*ny;
 if(n>400000){C.feld=null;return null}
 const zu=new Uint8Array(n),portal=new Uint8Array(n),dist=new Float64Array(n).fill(Infinity);
 const s=C.segs,fr2=frei*frei;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const px=mx+i*G,py=my+j*G,id=j*nx+i;
  if(!inPoly(C.rand,px,py)||AUS_FLAECHEN[flaecheBei(C,px,py)]){zu[id]=1;continue}
  let blockiert=false;
  for(let k=0;k<s.length&&!blockiert;k+=4){
   const x1=s[k],y1=s[k+1],ex=s[k+2]-x1,ey=s[k+3]-y1,l2=ex*ex+ey*ey;
   let u=l2>0?((px-x1)*ex+(py-y1)*ey)/l2:0;if(u<0)u=0;else if(u>1)u=1;
   const dx=px-x1-ex*u,dy=py-y1-ey*u;if(dx*dx+dy*dy<fr2)blockiert=true;
  }
  for(const c of C.kreise){const dx=px-c.x,dy=py-c.y,rr=c.r+frei;if(dx*dx+dy*dy<rr*rr)blockiert=true}
  if(blockiert)zu[id]=1;
 }
 const zelle=(x,y)=>{const i=Math.round((x-mx)/G),j=Math.round((y-my)/G);return i<0||j<0||i>=nx||j>=ny?-1:j*nx+i};
 const teleZiel=new Map();
 for(const q of C.teles){
  const b=zelle(q.bx,q.by);if(b<0)continue;
  const liste=teleZiel.get(b)||[];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const dx=mx+i*G-q.ax,dy=my+j*G-q.ay;if(dx*dx+dy*dy<q.r2){liste.push(j*nx+i);portal[j*nx+i]=1}}
  teleZiel.set(b,liste);
 }
 // kleiner Binär-Heap
 const hd=[],hi=[];
 const push=(d,i)=>{let k=hd.length;hd.push(d);hi.push(i);while(k>0){const p=(k-1)>>1;if(hd[p]<=d)break;hd[k]=hd[p];hi[k]=hi[p];k=p}hd[k]=d;hi[k]=i};
 const pop=()=>{const d=hd[0],i=hi[0],ld=hd.pop(),li=hi.pop();const m=hd.length;
  if(m){let k=0;for(;;){let c=2*k+1;if(c>=m)break;if(c+1<m&&hd[c+1]<hd[c])c++;if(hd[c]>=ld)break;hd[k]=hd[c];hi[k]=hi[c];k=c}hd[k]=ld;hi[k]=li}
  return[d,i]};
 const start=zelle(bahn.loch.x,bahn.loch.y);
 if(start>=0){dist[start]=0;push(0,start)}
 const D=G*Math.SQRT2,NB=[[1,0,G],[-1,0,G],[0,1,G],[0,-1,G],[1,1,D],[1,-1,D],[-1,1,D],[-1,-1,D]];
 while(hd.length){
  const[d,u]=pop();if(d>dist[u])continue;
  const tl=teleZiel.get(u);
  if(tl)for(const a of tl)if(d<dist[a]){dist[a]=d;push(d,a)}
  const ui=u%nx,uj=(u-ui)/nx;
  for(const[di,dj,w]of NB){const i=ui+di,j=uj+dj;if(i<0||j<0||i>=nx||j>=ny)continue;const v=j*nx+i;
   if(zu[v]||portal[v])continue;const nd=d+w;if(nd<dist[v]){dist[v]=nd;push(nd,v)}}
 }
 C.feld={G,mx,my,nx,ny,dist};
 return C.feld;
}
/* Weglänge vom Punkt zum Loch (um Wände herum). Unerreichbar → Infinity. */
function lochDistanz(bahn,x,y){
 const l=bahn.loch;if(!l)return Infinity;
 const eu=Math.hypot(x-l.x,y-l.y);if(eu<40)return eu;
 const F=lochFeld(bahn);if(!F)return eu;
 const ci=Math.round((x-F.mx)/F.G),cj=Math.round((y-F.my)/F.G);let best=Infinity;
 for(let r=0;r<=3&&best===Infinity;r++)
  for(let j=cj-r;j<=cj+r;j++)for(let i=ci-r;i<=ci+r;i++){
   if(i<0||j<0||i>=F.nx||j>=F.ny)continue;const d=F.dist[j*F.nx+i];if(d===Infinity)continue;
   const v=d+Math.hypot(x-(F.mx+i*F.G),y-(F.my+j*F.G));if(v<best)best=v}
 return Math.max(best,eu);
}

/* ---------- Bester Schuss (Bot / Lösbarkeits-Prüfung) ----------
   Rastert Winkel × Kraft (grob), verfeinert dann um die besten Kandidaten.
   optionen (alle freiwillig):
     winkelSchritte 72   grobe Winkel (5°)
     kraftSchritte  12   grobe Kraftstufen zwischen kraftMin und kraftMax
     kraftMin 0.05, kraftMax 1
     fein true           Feinsuche um die besten Kandidaten
     kandidaten 3        so viele grobe Kandidaten werden verfeinert
     sofort true         beim ersten versenkenden Schuss aufhören
     ziel {x,y}          statt des Lochs möglichst nah an diesen Punkt
     bewertung(erg)      eigene Bewertung, kleiner = besser
   Standard-Bewertung: versenkt −1, sonst Weglänge zum Loch (lochDistanz),
   Wasser = Weglänge vom Abschlag + 100000.
   → {winkel, kraft, ergebnis, wert, versuche} */
function besterSchuss(bahn,ball,t0,opt){
 opt=opt||{};
 const nW=opt.winkelSchritte||72,nK=Math.max(1,opt.kraftSchritte||12);
 const kMin=opt.kraftMin!=null?opt.kraftMin:0.05,kMax=opt.kraftMax!=null?opt.kraftMax:1;
 const fein=opt.fein!==false,sofort=opt.sofort!==false,top=Math.max(1,opt.kandidaten||3);
 const ziel=opt.ziel;
 const startWert=lochDistanz(bahn,ball.x,ball.y);
 const bew=opt.bewertung||(ziel
  ?e=>e.versenkt?-1:e.wasser?1e5+Math.hypot(ball.x-ziel.x,ball.y-ziel.y):Math.hypot(e.ende.x-ziel.x,e.ende.y-ziel.y)
  :e=>e.versenkt?-1:e.wasser?1e5+startWert:lochDistanz(bahn,e.ende.x,e.ende.y));
 let versuche=0;const liste=[];
 const probiere=(w,k)=>{versuche++;const e=schuss(bahn,ball,w,k,t0);return{winkel:w,kraft:k,ergebnis:e,wert:bew(e)}};
 const einordnen=c=>{let i=liste.length;while(i>0&&liste[i-1].wert>c.wert)i--;if(i<top){liste.splice(i,0,c);if(liste.length>top)liste.pop()}};
 const fertig=c=>({winkel:c.winkel,kraft:c.kraft,ergebnis:c.ergebnis,wert:c.wert,versuche});
 const dW=TAU/nW,dK=nK>1?(kMax-kMin)/(nK-1):0;
 for(let i=0;i<nW;i++){const w=-Math.PI+i*dW;
  for(let j=0;j<nK;j++){const c=probiere(w,kMin+j*dK);if(c.ergebnis.versenkt&&sofort)return fertig(c);einordnen(c)}}
 if(fein){
  for(const g of liste.slice()){
   for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){
    if(!a&&!b)continue;
    let k=g.kraft+b*dK/4;if(k<kMin)k=kMin;if(k>kMax)k=kMax;
    const c=probiere(g.winkel+a*dW/4,k);if(c.ergebnis.versenkt&&sofort)return fertig(c);einordnen(c);
   }
  }
 }
 return fertig(liste[0]);
}

const API={KONST,schuss,objektZustand,untergrund,besterSchuss,lochDistanz,vergiss,_lauf:lauf};
if(typeof module!=='undefined')module.exports=API;else root.PHYSIK=API;
})(this);
