/* Prüft Format und Geometrie aller Puttclash-Bahnen.
   Start:  node puttclash/bahnen.test.js
   Ausgabe: „X Prüfungen bestanden, Y fehlgeschlagen“, Exit-Code 1 bei Fehlern.

   Geprüft wird je Bahn: Pflichtfelder, id-Schema, par, Rand (≥3 Punkte,
   geschlossen, nicht selbstüberschneidend, im Uhrzeigersinn, im Feld),
   Innenwände im Rand, Zonen/Objekte gültig und im Feld, Richtungen normiert,
   Perioden, Abschlag/Loch frei (Rand, Gefahr, Sand, Hang, Objekte, ≥16 Luft
   zur Wand), Teleporter-Ziele, und ob das Loch vom Abschlag aus erreichbar ist
   (Rasterflut mit Ball-Abstand; Mühlen/Blöcke/Tore gelten als passierbar,
   weil man sie mit Timing schafft).
   Je Platz: Name, 6 Bahnen, par-Bereich, par-Summe fällt von Platz zu Platz
   nicht, typische Elemente (z. B. Piratenbucht: jede Bahn mit Wasser, höchstens
   eine Kanone/Teleporter; Vulkan: jede Bahn mit Lava).
   Neue Regel? Unten eine pruef(...)-Zeile ergänzen. */
const B=require('./bahnen.js');
let ok=0,bad=0;
const pruef=(name,bed,info)=>{if(bed)ok++;else{bad++;console.log('FEHLER '+name+(info!==undefined?' → '+info:''))}};

/* ---------- Geometrie-Helfer ---------- */
const FELD_B=1000,FELD_H=1500,BALL_R=12,LOCH_R=20,LUFT=16;
const zahl=v=>typeof v==='number'&&isFinite(v);
const punkt=p=>p&&zahl(p.x)&&zahl(p.y);
const imFeld=(x,y)=>x>=0&&x<=FELD_B&&y>=0&&y<=FELD_H;
function imPoly(x,y,p){
 let drin=false;
 for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){
  const xi=p[i],yi=p[i+1],xj=p[j],yj=p[j+1];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)drin=!drin;
 }
 return drin;
}
function abstPS(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;
 const t=l?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l)):0;
 return Math.hypot(px-ax-t*dx,py-ay-t*dy);
}
const kreuz=(ax,ay,bx,by,cx,cy)=>(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
/* Schneiden sich die Strecken ab und cd (auch Berühren/Überlappen zählt)? */
function schneiden(a,b,c,d){
 const d1=kreuz(c[0],c[1],d[0],d[1],a[0],a[1]),d2=kreuz(c[0],c[1],d[0],d[1],b[0],b[1]);
 const d3=kreuz(a[0],a[1],b[0],b[1],c[0],c[1]),d4=kreuz(a[0],a[1],b[0],b[1],d[0],d[1]);
 if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0)))return true;
 const auf=(p,q,r)=>Math.min(p[0],q[0])-1e-9<=r[0]&&r[0]<=Math.max(p[0],q[0])+1e-9&&Math.min(p[1],q[1])-1e-9<=r[1]&&r[1]<=Math.max(p[1],q[1])+1e-9;
 const e=1e-9;
 if(Math.abs(d1)<e&&auf(c,d,a))return true;if(Math.abs(d2)<e&&auf(c,d,b))return true;
 if(Math.abs(d3)<e&&auf(a,b,c))return true;if(Math.abs(d4)<e&&auf(a,b,d))return true;
 return false;
}
/* Echtes Kreuzen (beide Strecken wechseln die Seite) – Berühren zählt nicht. */
function kreuzen(a,b,c,d){
 const d1=kreuz(c[0],c[1],d[0],d[1],a[0],a[1]),d2=kreuz(c[0],c[1],d[0],d[1],b[0],b[1]);
 const d3=kreuz(a[0],a[1],b[0],b[1],c[0],c[1]),d4=kreuz(a[0],a[1],b[0],b[1],d[0],d[1]);
 const e=1e-6;
 return((d1>e&&d2<-e)||(d1<-e&&d2>e))&&((d3>e&&d4<-e)||(d3<-e&&d4>e));
}
const pkte=f=>{const p=[];for(let i=0;i<f.length;i+=2)p.push([f[i],f[i+1]]);return p};
function segs(f,zu){const p=pkte(f),s=[];for(let i=0;i<p.length-1;i++)s.push([p[i],p[i+1]]);if(zu&&p.length>2)s.push([p[p.length-1],p[0]]);return s}
/* Index-Paar der ersten Selbstüberschneidung eines geschlossenen Polygons, sonst null */
function selbstSchnitt(f){
 const s=segs(f,true),n=s.length;
 for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){
  if(i===0&&j===n-1)continue;               // Nachbarn über den Schluss
  if(schneiden(s[i][0],s[i][1],s[j][0],s[j][1]))return[i,j];
 }
 return null;
}
const flaeche=f=>{let a=0;for(let i=0;i<f.length;i+=2){const j=(i+2)%f.length;a+=f[i]*f[j+1]-f[j]*f[i+1]}return a/2};
function inForm(form,x,y){
 if(form.poly)return imPoly(x,y,form.poly);
 if(form.kreis)return Math.hypot(x-form.kreis[0],y-form.kreis[1])<=form.kreis[2];
 if(form.rect){const[r0,r1,b,h]=form.rect;return x>=r0&&x<=r0+b&&y>=r1&&y<=r1+h}
 return false;
}
function formPunkte(form){
 if(form.poly)return pkte(form.poly);
 if(form.kreis){const[x,y,r]=form.kreis;return[[x,y],[x-r,y],[x+r,y],[x,y-r],[x,y+r]]}
 if(form.rect){const[x,y,b,h]=form.rect;return[[x+b/2,y+h/2],[x,y],[x+b,y],[x+b,y+h],[x,y+h]]}
 return[];
}
/* Stichproben in der Form (Raster über die Umrandung) */
function formProben(form){
 const q=formPunkte(form);if(!q.length)return q;
 const xs=q.map(p=>p[0]),ys=q.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 for(let i=0;i<=12;i++)for(let j=0;j<=12;j++){const x=x0+(x1-x0)*i/12,y=y0+(y1-y0)*j/12;if(inForm(form,x,y))q.push([x,y])}
 return q;
}
function formGueltig(form){
 if(!form||typeof form!=='object')return false;
 const k=Object.keys(form);if(k.length!==1)return false;
 if(form.poly)return Array.isArray(form.poly)&&form.poly.length>=6&&form.poly.length%2===0&&form.poly.every(zahl)&&!selbstSchnitt(form.poly);
 if(form.kreis)return Array.isArray(form.kreis)&&form.kreis.length===3&&form.kreis.every(zahl)&&form.kreis[2]>0;
 if(form.rect)return Array.isArray(form.rect)&&form.rect.length===4&&form.rect.every(zahl)&&form.rect[2]>0&&form.rect[3]>0;
 return false;
}
const wandSegs=b=>segs(b.rand,true).concat(...b.waende.map(w=>segs(w,false)));
function wandAbst(b,x,y){let m=Infinity;for(const s of wandSegs(b))m=Math.min(m,abstPS(x,y,s[0][0],s[0][1],s[1][0],s[1][1]));return m}
function randAbst(b,x,y){let m=Infinity;for(const s of segs(b.rand,true))m=Math.min(m,abstPS(x,y,s[0][0],s[0][1],s[1][0],s[1][1]));return m}
const UNTERGRUND=['sand','eis','wasser','lava','loch'],GEFAHR=['wasser','lava','loch'];
function untergrund(b,x,y){
 if(!imPoly(x,y,b.rand))return'aus';
 let u='gras';for(const z of b.zonen)if(UNTERGRUND.includes(z.typ)&&inForm(z.form,x,y))u=z.typ;
 return u;
}
const kraftfeld=(b,x,y)=>b.zonen.some(z=>(z.typ==='hang'||z.typ==='boost')&&inForm(z.form,x,y));
const ring=(x,y,r,n)=>{const p=[[x,y]];for(let i=0;i<n;i++){const a=2*Math.PI*i/n;p.push([x+r*Math.cos(a),y+r*Math.sin(a)])}return p};
const rectAbst=(x,y,rx,ry,w,h)=>{const dx=Math.max(rx-x,0,x-(rx+w)),dy=Math.max(ry-y,0,y-(ry+h));return dx||dy?Math.hypot(dx,dy):-1};
/* Kleinster Abstand eines Punkts zur (über die Zeit) belegten Fläche eines Objekts */
function objAbst(o,x,y){
 switch(o.typ){
  case'pfosten':case'bumper':return Math.hypot(x-o.x,y-o.y)-o.r;
  case'muehle':return Math.hypot(x-o.x,y-o.y)-(o.laenge+7);
  case'block':{const[rx,ry,w,h]=o.rect,dx=Math.abs(o.bahn[0]),dy=Math.abs(o.bahn[1]);return rectAbst(x,y,rx-dx,ry-dy,w+2*dx,h+2*dy)}
  case'tor':return rectAbst(x,y,o.x-o.b/2,o.y-7,o.b,14);
  case'tele':return Math.min(Math.hypot(x-o.a.x,y-o.a.y),Math.hypot(x-o.b.x,y-o.b.y))-o.r;
 }
 return Infinity;
}
const imOderAufRand=(b,x,y,tol)=>imPoly(x,y,b.rand)||randAbst(b,x,y)<=tol;

/* Rasterflut: Ist das Loch vom Abschlag aus mit Ball-Abstand erreichbar?
   Frei = im Rand, Mittelpunkt nicht in Gefahr, ≥ FREI_AB von Wänden, Pfosten, Bumpern.
   FREI_AB 26 = Ball (12) + 14 Luft; 34 = jeder Durchgang auf dem Weg ≥ 68–70 breit.
   Teleporter: wer den a-Kreis erreicht, darf bei b weiter. */
function erreichbar(b,FREI_AB){
 const S=8,NX=Math.floor(FELD_B/S)+1,NY=Math.floor(FELD_H/S)+1;
 const fest=b.objekte.filter(o=>o.typ==='pfosten'||o.typ==='bumper');
 const teles=b.objekte.filter(o=>o.typ==='tele');
 const ws=wandSegs(b);
 const cache=new Int8Array(NX*NY).fill(-1),besucht=new Uint8Array(NX*NY);
 const frei=(i,j)=>{
  const k=j*NX+i;if(cache[k]>=0)return cache[k]===1;
  const x=i*S,y=j*S;let f=imPoly(x,y,b.rand)&&!GEFAHR.includes(untergrund(b,x,y));
  if(f)for(const o of fest)if(Math.hypot(x-o.x,y-o.y)<o.r+FREI_AB){f=false;break}
  if(f)for(const s of ws)if(abstPS(x,y,s[0][0],s[0][1],s[1][0],s[1][1])<FREI_AB){f=false;break}
  cache[k]=f?1:0;return f;
 };
 const zelle=(x,y)=>[Math.round(x/S),Math.round(y/S)];
 const q=[];const rein=(i,j)=>{if(i<0||j<0||i>=NX||j>=NY)return;const k=j*NX+i;if(besucht[k])return;besucht[k]=1;q.push([i,j])};
 const[si,sj]=zelle(b.start.x,b.start.y);besucht[sj*NX+si]=1;q.push([si,sj]);
 while(q.length){
  const[i,j]=q.pop(),x=i*S,y=j*S;
  if(Math.hypot(x-b.loch.x,y-b.loch.y)<=LOCH_R)return true;
  for(const t of teles)if(Math.hypot(x-t.a.x,y-t.a.y)<=t.r){const[ti,tj]=zelle(t.b.x,t.b.y);rein(ti,tj)}
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){
   if(!di&&!dj)continue;const ni=i+di,nj=j+dj;
   if(ni<0||nj<0||ni>=NX||nj>=NY||besucht[nj*NX+ni])continue;
   if(frei(ni,nj))rein(ni,nj);
  }
 }
 return false;
}

/* ---------- Plätze ---------- */
const PL_IDS=['park','wueste','piraten','eis','vulkan','weltraum'];   // nach Schwierigkeit
const PAR_BEREICH={park:[2,3],wueste:[3,4],piraten:[3,4],eis:[3,4],vulkan:[3,5],weltraum:[3,5]};
const N_BAHNEN=PL_IDS.length*6;
pruef('PLAETZE ist Array mit '+PL_IDS.length+' Plätzen',Array.isArray(B.PLAETZE)&&B.PLAETZE.length===PL_IDS.length);
pruef('Platz-ids in Reihenfolge',B.PLAETZE.map(p=>p.id).join()===PL_IDS.join(),B.PLAETZE.map(p=>p.id).join());
const PL_NAMEN={park:'Sonnenpark',wueste:'Wüstenoase',piraten:'Piratenbucht',eis:'Eispalast',vulkan:'Vulkan',weltraum:'Weltraum'};
for(const p of B.PLAETZE){
 pruef(p.id+': Name',p.name===PL_NAMEN[p.id],p.name);
 pruef(p.id+': Emoji',typeof p.emoji==='string'&&p.emoji.length>0);
 pruef(p.id+': 6 Bahnen',Array.isArray(p.bahnen)&&p.bahnen.length===6);
 p.bahnen.forEach((b,i)=>pruef(p.id+': id an Stelle '+(i+1),b.id===p.id+'-'+(i+1),b.id));
}
const ALLE=B.alle();
pruef('alle() liefert '+N_BAHNEN+' Bahnen',ALLE.length===N_BAHNEN,ALLE.length);
pruef('ids eindeutig',new Set(ALLE.map(b=>b.id)).size===N_BAHNEN);
pruef('Namen eindeutig',new Set(ALLE.map(b=>b.name)).size===N_BAHNEN);
pruef('bahn(id) findet jede Bahn',ALLE.every(b=>B.bahn(b.id)===b));
pruef('bahn(unbekannt) = null',B.bahn('mond-9')===null);
pruef('platz(id)',B.platz('eis')===B.PLAETZE[PL_IDS.indexOf('eis')]&&B.platz('xyz')===null);
const parSumme=B.PLAETZE.map(p=>p.bahnen.reduce((a,b)=>a+b.par,0));
pruef('Schwierigkeit fällt nicht (par-Summe je Platz)',parSumme.every((s,i)=>!i||s>=parSumme[i-1]),parSumme.join(' ≤ '));

/* ---------- Bahnen ---------- */
const Z_TYPEN=['sand','eis','wasser','lava','loch','hang','boost'];
const O_TYPEN=['bumper','pfosten','block','muehle','tele','tor'];
const D_TYPEN=['baum','busch','blume','stein','kaktus','palme','schneemann','eiskristall','stern','planet','rakete','fahne',
 'fass','anker','muschel','schatzkiste','steuerrad',          // Piratenbucht
 'fels','glutstein','duerrbaum','rauch','kristall'];          // Vulkan
const normiert=r=>Array.isArray(r)&&r.length===2&&r.every(zahl)&&Math.abs(Math.hypot(r[0],r[1])-1)<0.01;

for(const p of B.PLAETZE)for(const b of p.bahnen){
 const n=b.id||'?';
 // Pflichtfelder
 pruef(n+': id-Schema',/^(park|wueste|piraten|eis|vulkan|weltraum)-[1-6]$/.test(b.id));
 pruef(n+': name',typeof b.name==='string'&&b.name.trim().length>=3);
 pruef(n+': par ganzzahlig 2–5',Number.isInteger(b.par)&&b.par>=2&&b.par<=5,b.par);
 pruef(n+': par passt zum Platz',b.par>=PAR_BEREICH[p.id][0]&&b.par<=PAR_BEREICH[p.id][1],b.par);
 pruef(n+': start/loch',punkt(b.start)&&punkt(b.loch));
 for(const f of['rand','waende','zonen','objekte','deko'])pruef(n+': '+f+' ist Array',Array.isArray(b[f]));
 // Rand
 const r=b.rand;
 pruef(n+': rand ≥3 Punkte, gerade Länge, Zahlen',r.length>=6&&r.length%2===0&&r.every(zahl));
 pruef(n+': rand ohne doppelten Schlusspunkt (implizit geschlossen)',!(r[0]===r[r.length-2]&&r[1]===r[r.length-1]));
 const doppelt=pkte(r).findIndex((q,i,a)=>{const s=a[(i+1)%a.length];return Math.hypot(q[0]-s[0],q[1]-s[1])<0.5});
 pruef(n+': rand ohne doppelte Nachbarpunkte',doppelt<0,doppelt);
 pruef(n+': rand im Feld',pkte(r).every(q=>imFeld(q[0],q[1])));
 pruef(n+': rand im Uhrzeigersinn (Fläche > 0)',flaeche(r)>1000,flaeche(r));
 const ss=selbstSchnitt(r);pruef(n+': rand nicht selbstüberschneidend',!ss,ss&&ss.join('/'));
 // Innenwände
 b.waende.forEach((w,k)=>{
  const wn=n+': wand '+k;
  pruef(wn+' gültig',Array.isArray(w)&&w.length>=4&&w.length%2===0&&w.every(zahl));
  pruef(wn+' Punkte im Rand',pkte(w).every(q=>imOderAufRand(b,q[0],q[1],2)));
  pruef(wn+' Mitten im Rand',segs(w,false).every(s=>imPoly((s[0][0]+s[1][0])/2,(s[0][1]+s[1][1])/2,r)));
  pruef(wn+' kreuzt den Rand nicht',segs(w,false).every(s=>segs(r,true).every(t=>!kreuzen(s[0],s[1],t[0],t[1]))));
 });
 // Zonen
 b.zonen.forEach((z,k)=>{
  const zn=n+': zone '+k+' ('+z.typ+')';
  pruef(zn+' Typ',Z_TYPEN.includes(z.typ));
  const fg=formGueltig(z.form);pruef(zn+' Form gültig',fg);if(!fg)return;
  pruef(zn+' im Feld',formPunkte(z.form).every(q=>imFeld(q[0],q[1])));
  pruef(zn+' liegt (teilweise) im Rand',formProben(z.form).some(q=>imPoly(q[0],q[1],r)));
  if(z.typ==='hang'||z.typ==='boost'){
   pruef(zn+' Richtung normiert',normiert(z.richtung),JSON.stringify(z.richtung));
   pruef(zn+' Stärke 0.5–3',zahl(z.staerke)&&z.staerke>=0.5&&z.staerke<=3,z.staerke);
  }
  if(z.typ==='boost')pruef(zn+' Boost ist Kreis',!!z.form.kreis);
 });
 // Objekte
 b.objekte.forEach((o,k)=>{
  const on=n+': objekt '+k+' ('+o.typ+')';
  pruef(on+' Typ',O_TYPEN.includes(o.typ));
  switch(o.typ){
   case'bumper':case'pfosten':
    pruef(on+' Werte',zahl(o.x)&&zahl(o.y)&&zahl(o.r)&&o.r>0&&(o.typ==='pfosten'||(zahl(o.kraft)&&o.kraft>=1&&o.kraft<=2.5)));
    pruef(on+' im Feld',imFeld(o.x-o.r,o.y-o.r)&&imFeld(o.x+o.r,o.y+o.r));
    pruef(on+' im Rand',imPoly(o.x,o.y,r));
    { // Abstand zu Wänden/anderen Kreisobjekten: berührt (≤0) oder Durchgang ≥ 70
     const lu=wandAbst(b,o.x,o.y)-o.r;
     pruef(on+' Durchgang zur Wand ≥70',lu<=0||lu>=70,Math.round(lu));
     b.objekte.forEach((o2,k2)=>{if(k2<=k||(o2.typ!=='bumper'&&o2.typ!=='pfosten'))return;
      const g=Math.hypot(o.x-o2.x,o.y-o2.y)-o.r-o2.r;pruef(on+' Durchgang zu Objekt '+k2+' ≥70',g<=0||g>=70,Math.round(g))});
    }
    break;
   case'block':{
    const ok2=Array.isArray(o.rect)&&o.rect.length===4&&o.rect.every(zahl)&&o.rect[2]>0&&o.rect[3]>0&&Array.isArray(o.bahn)&&o.bahn.length===2&&o.bahn.every(zahl);
    pruef(on+' Werte',ok2);if(!ok2)break;
    pruef(on+' Periode > 0',zahl(o.periode)&&o.periode>0,o.periode);
    const[x,y,w,h]=o.rect,ecken=[];
    for(const sg of[-1,1])for(const[ex,ey]of[[x,y],[x+w,y],[x+w,y+h],[x,y+h]])ecken.push([ex+sg*o.bahn[0],ey+sg*o.bahn[1]]);
    pruef(on+' bleibt im Feld',ecken.every(q=>imFeld(q[0],q[1])));
    pruef(on+' bleibt im Rand',ecken.every(q=>imOderAufRand(b,q[0],q[1],2)));
    break;}
   case'muehle':
    pruef(on+' Werte',zahl(o.x)&&zahl(o.y)&&zahl(o.laenge)&&o.laenge>0&&Number.isInteger(o.fluegel)&&o.fluegel>=2&&o.fluegel<=8);
    pruef(on+' Periode ≠ 0 (Vorzeichen = Drehrichtung), |p| ≥ 1000',zahl(o.periode)&&Math.abs(o.periode)>=1000,o.periode);
    pruef(on+' Nabe im Rand',imPoly(o.x,o.y,r));
    pruef(on+' Flügel im Feld',imFeld(o.x-o.laenge,o.y-o.laenge)&&imFeld(o.x+o.laenge,o.y+o.laenge));
    break;
   case'tele':
    pruef(on+' Werte',punkt(o.a)&&punkt(o.b)&&zahl(o.r)&&o.r>0);
    pruef(on+' a im Rand',imPoly(o.a.x,o.a.y,r)&&wandAbst(b,o.a.x,o.a.y)>=o.r);
    pruef(on+' Ziel b im Rand',imPoly(o.b.x,o.b.y,r)&&wandAbst(b,o.b.x,o.b.y)>=BALL_R+LUFT+o.r);
    pruef(on+' a nicht in Gefahr',ring(o.a.x,o.a.y,o.r,8).every(q=>!GEFAHR.includes(untergrund(b,q[0],q[1]))));
    pruef(on+' Ziel b nicht in Gefahr/Sand',ring(o.b.x,o.b.y,o.r+BALL_R,12).every(q=>!['wasser','lava','loch','sand'].includes(untergrund(b,q[0],q[1]))));
    pruef(on+' Ziel b frei von anderen Objekten',b.objekte.every(o2=>o2===o||objAbst(o2,o.b.x,o.b.y)>=o.r+BALL_R+LUFT));
    pruef(on+' Ziel b nicht in einem Teleporter-Eingang',b.objekte.every(o2=>o2.typ!=='tele'||Math.hypot(o2.a.x-o.b.x,o2.a.y-o.b.y)>o2.r+o.r));
    pruef(on+' a und b weit genug auseinander',Math.hypot(o.a.x-o.b.x,o.a.y-o.b.y)>=150);
    break;
   case'tor':
    pruef(on+' Werte',zahl(o.x)&&zahl(o.y)&&zahl(o.b)&&o.b>=70);
    pruef(on+' Zeiten > 0',zahl(o.offen)&&o.offen>0&&zahl(o.zu)&&o.zu>0);
    pruef(on+' im Rand',imPoly(o.x,o.y,r));
    pruef(on+' Enden an Wänden (Tor sperrt den Durchgang)',wandAbst(b,o.x-o.b/2,o.y)<=4&&wandAbst(b,o.x+o.b/2,o.y)<=4);
    break;
  }
 });
 // Deko
 pruef(n+': Deko vorhanden',b.deko.length>=6,b.deko.length);
 pruef(n+': Deko gültig',b.deko.every(d=>D_TYPEN.includes(d.typ)&&zahl(d.x)&&zahl(d.y)&&imFeld(d.x,d.y)&&zahl(d.s)&&d.s>0));
 pruef(n+': Deko auch außerhalb des Rands',b.deko.some(d=>!imPoly(d.x,d.y,r)));
 // Abschlag und Loch
 for(const[wer,q,rad]of[['start',b.start,BALL_R],['loch',b.loch,LOCH_R]]){
  const wn=n+': '+wer;
  pruef(wn+' innerhalb von rand',imPoly(q.x,q.y,r));
  pruef(wn+' im Feld',imFeld(q.x,q.y));
  const wa=wandAbst(b,q.x,q.y);
  pruef(wn+' ≥ '+LUFT+' Luft zu jeder Wand',wa-rad>=LUFT,Math.round(wa-rad));
  const boden=ring(q.x,q.y,rad+BALL_R,12).map(s=>untergrund(b,s[0],s[1]));
  pruef(wn+' nicht in Wasser/Lava/Abgrund',boden.every(u=>!GEFAHR.includes(u)),boden.join());
  pruef(wn+' nicht im Sand',boden.every(u=>u!=='sand'));
  pruef(wn+' nicht auf Hang/Boost',ring(q.x,q.y,rad,8).every(s=>!kraftfeld(b,s[0],s[1])));
  pruef(wn+' nicht in Objekten',b.objekte.every(o=>objAbst(o,q.x,q.y)>=rad+LUFT),
   b.objekte.map(o=>o.typ+':'+Math.round(objAbst(o,q.x,q.y))).join(' '));
  pruef(wn+' nicht in geschlossener Innenwand',b.waende.every(w=>w.length<6||!(w[0]===w[w.length-2]&&w[1]===w[w.length-1])||!imPoly(q.x,q.y,w)));
 }
 const dist=Math.hypot(b.start.x-b.loch.x,b.start.y-b.loch.y);
 pruef(n+': Abstand Abschlag↔Loch 300–1800',dist>=300&&dist<=1800,Math.round(dist));
 pruef(n+': Loch vom Abschlag erreichbar',erreichbar(b,26));
 pruef(n+': Weg zum Loch überall ≥ 70 breit',erreichbar(b,34));
 // Platz-Charakter
 if(p.id==='eis'){
  let innen=0,eis=0;for(let x=5;x<FELD_B;x+=20)for(let y=5;y<FELD_H;y+=20)if(imPoly(x,y,r)){innen++;if(untergrund(b,x,y)==='eis')eis++}
  pruef(n+': viel Eis (≥ 50 % der Fläche)',eis/innen>=0.5,Math.round(100*eis/innen)+' %');
 }
}

/* Jeder Platz zeigt seine Spezialitäten */
const hat=(pid,art,typ)=>B.platz(pid).bahnen.some(b=>b[art].some(o=>o.typ===typ));
for(const t of['sand','wasser','hang'])pruef('wueste hat Zone '+t,hat('wueste','zonen',t));
for(const t of['block','tor'])pruef('wueste hat Objekt '+t,hat('wueste','objekte',t));
for(const t of['eis','loch','sand'])pruef('eis hat Zone '+t,hat('eis','zonen',t));
for(const t of['muehle','bumper'])pruef('eis hat Objekt '+t,hat('eis','objekte',t));
for(const t of['loch','boost'])pruef('weltraum hat Zone '+t,hat('weltraum','zonen',t));
for(const t of['tele','bumper','muehle','tor'])pruef('weltraum hat Objekt '+t,hat('weltraum','objekte',t));
pruef('weltraum hat eine Bahn mit mehreren Mühlen',B.platz('weltraum').bahnen.some(b=>b.objekte.filter(o=>o.typ==='muehle').length>=2));
pruef('park hat Pfosten, Hang und Mühle',hat('park','objekte','pfosten')&&hat('park','zonen','hang')&&hat('park','objekte','muehle'));
for(const t of['wasser','sand'])pruef('piraten hat Zone '+t,hat('piraten','zonen',t));
for(const t of['block','tor','tele'])pruef('piraten hat Objekt '+t,hat('piraten','objekte',t));
pruef('piraten: jede Bahn hat Wasser',B.platz('piraten').bahnen.every(b=>b.zonen.some(z=>z.typ==='wasser')));
pruef('piraten: höchstens eine Kanone (Teleporter)',B.platz('piraten').bahnen.reduce((a,b)=>a+b.objekte.filter(o=>o.typ==='tele').length,0)<=1);
for(const t of['lava','hang','sand','boost'])pruef('vulkan hat Zone '+t,hat('vulkan','zonen',t));
for(const t of['muehle','bumper'])pruef('vulkan hat Objekt '+t,hat('vulkan','objekte',t));
pruef('vulkan: jede Bahn hat Lava',B.platz('vulkan').bahnen.every(b=>b.zonen.some(z=>z.typ==='lava')));

console.log(`${ok} Prüfungen bestanden, ${bad} fehlgeschlagen`);process.exit(bad?1:0);
