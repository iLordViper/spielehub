/* Prüft die Minigolf-Physik von Puttclash.  Start:  node puttclash/physik.test.js
   Benutzt nur eigene kleine Test-Bahnen (nicht bahnen.js).
   Nach Änderungen an PHYSIK.KONST hier die erwarteten Bereiche mit anpassen.
   So fügst du eine Prüfung hinzu: pruefe('Name', bedingung, 'Zusatzinfo bei Fehler'). */
const P=require('./physik.js');
const K=P.KONST,R=K.BALL_R;
let ok=0,bad=0;
const pruefe=(name,bed,info)=>{if(bed)ok++;else{bad++;console.log('FEHLER '+name+(info!==undefined?': '+info:''))}};
const info=t=>console.log('  · '+t);
const rk=(x,y,b,h)=>[x,y,x+b,y,x+b,y+h,x,y+h];
const OBEN=-Math.PI/2,TAU60=Math.PI*2/60;
const grad=w=>w*180/Math.PI;
const abstandSeg=(x,y,x1,y1,x2,y2)=>{const ex=x2-x1,ey=y2-y1,l2=ex*ex+ey*ey;let u=((x-x1)*ex+(y-y1)*ey)/l2;u=Math.max(0,Math.min(1,u));return Math.hypot(x-x1-ex*u,y-y1-ey*u)};
const bahn=(teile)=>Object.assign({id:'test-x',name:'Test',par:3,start:{x:500,y:1300},loch:{x:500,y:250},
 rand:rk(100,100,800,1300),waende:[],zonen:[],objekte:[]},teile);
const GROSS=(zonen)=>({start:{x:0,y:0},loch:{x:-4000,y:-4000},rand:rk(-5000,-5000,20000,20000),zonen:zonen||[],objekte:[]});
const hat=(e,typ)=>e.ereignisse.some(v=>v[1]===typ);

/* ---------- Reichweiten ---------- */
{
 const weite=(zonen,k)=>P.schuss(GROSS(zonen),{x:0,y:0},0,k,0).ende.x;
 const flaeche=typ=>[{typ,form:{rect:[-5000,-5000,20000,20000]}}];
 const g=[0.3,0.6,1].map(k=>weite([],k)),s=[0.3,0.6,1].map(k=>weite(flaeche('sand'),k)),e=[0.3,0.6,1].map(k=>weite(flaeche('eis'),k));
 info('Reichweite Gras  0.3/0.6/1: '+g.join(' / '));
 info('Reichweite Sand  0.3/0.6/1: '+s.join(' / '));
 info('Reichweite Eis   0.3/0.6/1: '+e.join(' / '));
 pruefe('Kraft 1 auf Gras rollt 1,5–2 Feldlängen',g[2]>=2250&&g[2]<=3000,g[2]);
 pruefe('Kraft 0.3 auf Gras rollt 300–400',g[0]>=300&&g[0]<=400,g[0]);
 pruefe('Sand bremst mehr als Gras',s[0]<g[0]*0.5&&s[2]<g[2]*0.5,s+' vs '+g);
 pruefe('Eis bremst weniger als Gras',e[0]>g[0]*1.8&&e[2]>g[2]*1.8,e+' vs '+g);
 pruefe('mehr Kraft = weiter',g[0]<g[1]&&g[1]<g[2]);
}

/* ---------- Gerader Putt ins Loch, zu schnell = Lip-out ---------- */
{
 const B=bahn();
 let treffer=[];
 for(let k=0.3;k<=1.0001;k+=0.005){const e=P.schuss(B,B.start,OBEN,k,0);if(e.versenkt)treffer.push(+k.toFixed(3))}
 info('gerader Putt (1050 weit) versenkt bei Kraft '+(treffer.length?treffer[0]+'…'+treffer[treffer.length-1]:'nie')+' ('+treffer.length+' Stufen à 0.005)');
 pruefe('gerader Putt versenkt',treffer.length>0);
 pruefe('Treffer-Fenster spielbar (≥ 4 Stufen)',treffer.length>=4,treffer.length);
 const e=P.schuss(B,B.start,OBEN,treffer[2]||0.6,0);
 pruefe('versenkt: Ende = Loch',e.versenkt&&e.ende.x===500&&e.ende.y===250);
 pruefe('versenkt: letzter Pfadpunkt = Loch',e.pfad[e.pfad.length-1][1]===500&&e.pfad[e.pfad.length-1][2]===250);
 pruefe('versenkt: Ereignis loch',hat(e,'loch'));
 pruefe('versenkt: nicht wasser',!e.wasser);
 // zu schnell
 const f=P.schuss(B,B.start,OBEN,1,0);
 const lip=f.ereignisse.find(v=>v[1]==='lipout'),lo=f.ereignisse.find(v=>v[1]==='loch');
 pruefe('zu schnell → Lip-out-Ereignis',!!lip);
 pruefe('Lip-out kommt vor jedem Versenken',!!lip&&(!lo||lo[0]>lip[0]));
 pruefe('nach Lip-out rollt der Ball übers Loch hinaus',f.pfad.some(p=>p[2]<250-30));
 // knapp neben dem Loch vorbei (ohne Berührung des Lochkreises) fällt nicht
 const g=P.schuss(B,{x:530,y:1300},OBEN,treffer[2]||0.6,0);
 pruefe('31 neben dem Loch fällt nicht',!g.versenkt);
}

/* ---------- Abprall an der Wand ---------- */
{
 const B=bahn({loch:{x:150,y:1350}});
 const v=[];P._lauf(B,{x:500,y:900},-Math.PI/4,0.6,0,(t,x,y,vx,vy)=>v.push([t,x,y,vx,vy]));
 const i=v.findIndex((p,k)=>k>0&&v[k-1][3]>0&&p[3]<0);
 pruefe('Ball prallt von der rechten Wand ab',i>0);
 if(i>0){
  const a=v[i-1],b=v[i];
  const ein=grad(Math.atan2(-a[4],a[3])),aus=grad(Math.atan2(-b[4],-b[3]));
  info('Wand: Einfall '+ein.toFixed(1)+'°, Ausfall '+aus.toFixed(1)+'° (je zur Wandnormalen), Normalanteil × '+(-b[3]/a[3]).toFixed(3));
  pruefe('Ausfallwinkel ≈ Einfallwinkel (±12°)',Math.abs(ein-aus)<12,ein+' / '+aus);
  pruefe('Normalanteil × ABPRALL',Math.abs(-b[3]/a[3]-K.ABPRALL)<0.02,-b[3]/a[3]);
  pruefe('Tangentialanteil bleibt',Math.abs(b[4]/a[4]-1)<0.02,b[4]/a[4]);
  pruefe('Ball berührt die Wand bei x≈888',Math.abs(b[1]-(900-R))<1,b[1]);
 }
 const e=P.schuss(B,{x:500,y:900},-Math.PI/4,0.6,0);
 const w=e.ereignisse.find(q=>q[1]==='wand');
 pruefe('Ereignis wand an der Wand',!!w&&Math.abs(w[2]-900)<2&&w[4]>0&&w[4]<=1,JSON.stringify(w));
}

/* ---------- Kein Durchtunneln ---------- */
{
 // waagerechte dünne Wand quer über die ganze Bahn, Bumper treiben das Tempo hoch
 const B=bahn({waende:[[100,700,900,700]],objekte:[{typ:'bumper',x:500,y:1000,r:25,kraft:1.6},{typ:'bumper',x:300,y:850,r:20,kraft:1.6}]});
 let minAbst=Infinity,maxV=0,ausserhalb=0;
 for(let i=0;i<48;i++){
  const w=-Math.PI+0.05+i*(Math.PI-0.1)/47;
  P._lauf(B,B.start,w,1,0,(t,x,y,vx,vy)=>{minAbst=Math.min(minAbst,y-700);maxV=Math.max(maxV,Math.hypot(vx,vy));
   if(x<100+R-0.05||x>900-R+0.05||y>1400-R+0.05)ausserhalb++});
 }
 info('Tunnel-Test waagerecht: kleinster Abstand zur Wand '+minAbst.toFixed(2)+', höchstes Tempo '+maxV.toFixed(0));
 pruefe('Kraft 1 kommt nie durch die dünne Wand',minAbst>=R-0.05,minAbst);
 pruefe('Ball bleibt im rand',ausserhalb===0,ausserhalb);
 pruefe('Tempo bleibt unter V_GRENZE',maxV<=K.V_GRENZE+1,maxV);
 // schräge dünne Wand, die das Feld teilt
 const S=bahn({waende:[[100,500,900,1000]]});
 let schief=Infinity;
 const seite=(x,y)=>((900-100)*(y-500)-(1000-500)*(x-100))/Math.hypot(800,500); // >0 = unterhalb
 for(let i=0;i<60;i++){
  const w=i*TAU60;
  P._lauf(S,{x:600,y:1250},w,1,0,(t,x,y)=>{schief=Math.min(schief,seite(x,y))});
 }
 pruefe('Kraft 1 kommt nie durch eine schräge Wand',schief>=R-0.05,schief);
 // Wandende (Kreis gegen Punkt): Ball trifft genau die Spitze
 const E=bahn({waende:[[500,400,500,800]]});
 let nach=null,minE=Infinity;
 P._lauf(E,{x:500,y:1300},OBEN,0.8,0,(t,x,y,vx,vy)=>{minE=Math.min(minE,abstandSeg(x,y,500,400,500,800));if(!nach&&vy>0)nach=[vx,vy]});
 pruefe('Wandspitze: Ball prallt zurück',!!nach&&nach[1]>0&&Math.abs(nach[0])<1,JSON.stringify(nach));
 pruefe('Wandspitze: kein Eindringen',minE>=R-0.05,minE);
}

/* ---------- Wasser, Lava, Abgrund ---------- */
for(const typ of['wasser','lava','loch']){
 const B=bahn({zonen:[{typ,form:{rect:[100,700,800,100]}}]});
 const e=P.schuss(B,B.start,OBEN,0.8,0);
 const l=e.pfad[e.pfad.length-1];
 const w=e.ereignisse.find(q=>q[1]==='wasser');
 pruefe(typ+': wasser:true',e.wasser&&!e.versenkt);
 pruefe(typ+': Ende = Abschlag',e.ende.x===500&&e.ende.y===1300);
 pruefe(typ+': letzter Pfadpunkt = Abschlag',l[1]===500&&l[2]===1300);
 pruefe(typ+': Platsch-Ereignis an der Zone',!!w&&w[3]>=700&&w[3]<=800&&w[4]===typ,JSON.stringify(w));
 pruefe(typ+': Sprung (gleiches t) zum Abschlag',e.pfad[e.pfad.length-2][0]===l[0]&&l[0]===e.dauer);
 pruefe(typ+': untergrund()',P.untergrund(B,500,750)===typ);
}
{
 const B=bahn({zonen:[{typ:'sand',form:{kreis:[300,300,50]}},{typ:'eis',form:{poly:[600,300,800,300,700,500]}},{typ:'hang',form:{rect:[100,900,800,100]},richtung:[0,1],staerke:1}]});
 pruefe('untergrund gras',P.untergrund(B,500,600)==='gras');
 pruefe('untergrund sand (kreis)',P.untergrund(B,320,310)==='sand');
 pruefe('untergrund eis (poly)',P.untergrund(B,700,350)==='eis');
 pruefe('untergrund aus',P.untergrund(B,50,50)==='aus');
 pruefe('Hang ist Auflage → gras',P.untergrund(B,500,950)==='gras');
 const s=P.schuss(bahn({zonen:[{typ:'sand',form:{rect:[100,900,800,200]}}]}),{x:500,y:1300},OBEN,0.5,0);
 pruefe('Ereignis sand beim Hineinrollen',hat(s,'sand'));
}

/* ---------- Hang ---------- */
{
 const B=bahn({loch:{x:150,y:150},zonen:[{typ:'hang',form:{rect:[100,100,800,1300]},richtung:[0,1],staerke:1}]});
 const e=P.schuss(B,{x:500,y:600},0,0,0);
 pruefe('liegender Ball rollt den Hang hinunter',e.ende.y>1300,JSON.stringify(e.ende));
 pruefe('… und kommt an der Bande zur Ruhe (< 12 s)',e.dauer<K.MAX_DAUER,e.dauer);
 const s=P.schuss(bahn({loch:{x:150,y:150},zonen:[{typ:'hang',form:{rect:[100,100,800,1300]},richtung:[1,0],staerke:0.5}]}),{x:300,y:600},0,0,0);
 pruefe('auch schwacher Hang (0.5) bewegt den Ball',s.ende.x>500,JSON.stringify(s.ende));
 // Tal: oben bergab nach unten, unten bergab nach oben → Ball pendelt und bleibt bei y≈700
 const T=bahn({loch:{x:150,y:150},zonen:[
  {typ:'hang',form:{rect:[100,100,800,600]},richtung:[0,1],staerke:1},
  {typ:'hang',form:{rect:[100,700,800,700]},richtung:[0,-1],staerke:1}]});
 const t=P.schuss(T,{x:500,y:1200},0,0,0);
 const minY=Math.min(...t.pfad.map(p=>p[2]));
 const iMin=t.pfad.findIndex(p=>p[2]===minY);
 pruefe('Tal: Ball rollt über die Talsohle hinaus',minY<690,minY);
 pruefe('Tal: kehrt am Gegenhang um',t.pfad.slice(iMin).some(p=>p[2]>minY+20));
 pruefe('Tal: bleibt in der Talsohle liegen',Math.abs(t.ende.y-700)<40,JSON.stringify(t.ende));
 // Schuss hangaufwärts kommt weniger weit als hangabwärts
 const H=bahn({loch:{x:150,y:150},zonen:[{typ:'hang',form:{rect:[100,100,800,1300]},richtung:[1,0],staerke:0.5}]});
 const auf=P.schuss(H,{x:850,y:800},Math.PI,0.4,0),ab=P.schuss(H,{x:150,y:700},0,0.4,0);
 const mAuf=850-Math.min(...auf.pfad.map(p=>p[1])),mAb=Math.max(...ab.pfad.map(p=>p[1]))-150;
 pruefe('hangaufwärts kürzer als hangabwärts',mAuf<mAb,mAuf+' / '+mAb);
}

/* ---------- Boost ---------- */
{
 const B=bahn({loch:{x:150,y:150},zonen:[{typ:'boost',form:{kreis:[500,1100,40]},richtung:[0,-1],staerke:1}]});
 const m=P.schuss(B,B.start,OBEN,0.3,0),o=P.schuss(bahn({loch:{x:150,y:150}}),{x:500,y:1300},OBEN,0.3,0);
 pruefe('Boost: Ereignis',hat(m,'boost'));
 pruefe('Boost schiebt weiter',m.pfad.some(p=>p[2]<o.ende.y-200),o.ende.y);
}

/* ---------- Teleporter ---------- */
{
 const B=bahn({loch:{x:850,y:150},objekte:[{typ:'tele',a:{x:500,y:900},b:{x:300,y:400},r:28}]});
 const v=[];const e=P._lauf(B,B.start,OBEN,0.5,0,(t,x,y,vx,vy)=>v.push([t,x,y,vx,vy]));
 const tl=e.ereignisse.find(q=>q[1]==='tele');
 pruefe('Teleporter: Ereignis',!!tl&&tl[2]===300&&tl[3]===400,JSON.stringify(tl));
 const i=e.pfad.findIndex((p,k)=>k>0&&e.pfad[k-1][0]===p[0]&&p[1]===300&&p[2]===400);
 pruefe('Teleporter: Sprung im Pfad (gleiches t)',i>0);
 pruefe('Teleporter: Ball kommt bei b heraus und rollt weiter nach oben',e.pfad.slice(i+1).some(p=>p[2]<390&&Math.abs(p[1]-300)<1));
 const j=v.findIndex(p=>Math.abs(p[1]-300)<15&&p[2]<410);
 if(j>0){const a=Math.hypot(v[j-1][3],v[j-1][4]),b=Math.hypot(v[j][3],v[j][4]);
  pruefe('Teleporter: gleiche Geschwindigkeit',Math.abs(a-b)/a<0.03,a+' / '+b);}
 else pruefe('Teleporter: Unterschritt nach Sprung gefunden',false);
 pruefe('Teleporter: nur einmal',e.ereignisse.filter(q=>q[1]==='tele').length===1);
}

/* ---------- Bewegte Objekte: Geometrie ---------- */
{
 const blk={typ:'block',rect:[400,600,100,40],bahn:[200,0],periode:3000};
 const z0=P.objektZustand(null,blk,0).rect,z1=P.objektZustand(null,blk,750).rect,z2=P.objektZustand(null,blk,2250).rect;
 pruefe('Block t=0 Ruhelage',z0[0]===400&&z0[1]===600&&z0[2]===100&&z0[3]===40);
 pruefe('Block t=P/4 → +dx',Math.abs(z1[0]-600)<1e-9);
 pruefe('Block t=3P/4 → −dx',Math.abs(z2[0]-200)<1e-9);
 const m={typ:'muehle',x:500,y:700,laenge:160,fluegel:4,periode:4000};
 const b0=P.objektZustand(null,m,0).balken,b1=P.objektZustand(null,m,1000).balken;
 pruefe('Mühle: 4 Balken, Dicke 14',b0.length===4&&P.objektZustand(null,m,0).dicke===14);
 pruefe('Mühle t=0: erster Balken nach rechts',Math.abs(b0[0][2]-660)<1e-9&&Math.abs(b0[0][3]-700)<1e-9);
 pruefe('Mühle t=P/4: erster Balken nach unten (Uhrzeigersinn)',Math.abs(b1[0][2]-500)<1e-9&&Math.abs(b1[0][3]-860)<1e-9);
 pruefe('Mühle: zweiter Balken 90° weiter',Math.abs(b0[1][2]-500)<1e-9&&Math.abs(b0[1][3]-860)<1e-9);
 const tor={typ:'tor',x:500,y:700,b:120,offen:1200,zu:1200};
 pruefe('Tor t=500 offen',P.objektZustand(null,tor,500).zu===false);
 pruefe('Tor t=1500 zu',P.objektZustand(null,tor,1500).zu===true);
 pruefe('Tor t=2500 wieder offen',P.objektZustand(null,tor,2500).zu===false);
 const tb=P.objektZustand(null,tor,0).balken[0];
 pruefe('Tor-Balken 440..560',tb[0]===440&&tb[2]===560&&tb[1]===700);
}

/* ---------- Bewegte Objekte: Physik ---------- */
{
 const mk=(t0)=>bahn({loch:{x:850,y:150},waende:[[100,700,440,700],[560,700,900,700]],objekte:[{typ:'tor',x:500,y:700,b:120,offen:1e9,zu:1e9}]});
 const B=mk();
 const auf=P.schuss(B,B.start,OBEN,0.5,0),zu=P.schuss(B,B.start,OBEN,0.5,1e9+10);
 pruefe('offenes Tor lässt durch',auf.pfad.some(p=>p[2]<650));
 pruefe('geschlossenes Tor hält auf',zu.pfad.every(p=>p[2]>=700+R+7-0.1)&&hat(zu,'wand'));
 const S=bahn({loch:{x:850,y:150},objekte:[{typ:'block',rect:[450,650,100,40],bahn:[0,0],periode:3000}]});
 const s=P.schuss(S,S.start,OBEN,0.6,0);
 pruefe('fester Block hält auf',s.pfad.every(p=>p[2]>=690+R-0.1));
 // bewegter Block: Ball nie im Block
 const M=bahn({loch:{x:850,y:150},objekte:[{typ:'block',rect:[450,650,100,40],bahn:[250,0],periode:1500}]});
 let drin=0;
 for(let i=0;i<20;i++)P._lauf(M,M.start,OBEN+(i-10)*0.03,0.7,i*137,(t,x,y)=>{const r=P.objektZustand(M,M.objekte[0],i*137+t).rect;
  const qx=Math.max(r[0],Math.min(x,r[0]+r[2])),qy=Math.max(r[1],Math.min(y,r[1]+r[3]));if(Math.hypot(x-qx,y-qy)<R-1.5)drin++});
 pruefe('bewegter Block: Ball dringt nicht ein',drin===0,drin);
 // Mühle schlägt den Ball weg und wird nicht durchtunnelt
 const W=bahn({loch:{x:850,y:150},objekte:[{typ:'muehle',x:500,y:700,laenge:160,fluegel:4,periode:1500}]});
 let besterSchub=0,tief=Infinity;
 for(let t0=0;t0<1500;t0+=75){
  let vorher=null;
  P._lauf(W,W.start,OBEN,0.45,t0,(t,x,y,vx,vy)=>{
   const s=Math.hypot(vx,vy);if(vorher!==null&&s>vorher+5)besterSchub=Math.max(besterSchub,s/vorher);vorher=s;
   for(const b of P.objektZustand(W,W.objekte[0],t0+t).balken)tief=Math.min(tief,abstandSeg(x,y,b[0],b[1],b[2],b[3]))});
 }
 info('Mühle: größter Tempo-Gewinn durch Schlag × '+besterSchub.toFixed(2)+', kleinster Abstand zur Balkenachse '+tief.toFixed(2));
 pruefe('Mühle schlägt den Ball weg (Tempo steigt)',besterSchub>1.2,besterSchub);
 pruefe('Mühle wird nicht durchdrungen',tief>=R+7-1.5,tief);
 // Bumper beschleunigt stärker als Pfosten
 const bmp=bahn({loch:{x:850,y:150},objekte:[{typ:'bumper',x:500,y:900,r:20,kraft:1.4}]});
 const pfo=bahn({loch:{x:850,y:150},objekte:[{typ:'pfosten',x:500,y:900,r:20}]});
 const aus=(B)=>{let a=null,b=null;P._lauf(B,B.start,OBEN,0.5,0,(t,x,y,vx,vy)=>{if(b!==null)return;if(vy<0)a=Math.hypot(vx,vy);else if(vy>0)b=Math.hypot(vx,vy)});return b/a};
 const fb=aus(bmp),fp=aus(pfo);
 info('Rückprall Bumper × '+fb.toFixed(2)+', Pfosten × '+fp.toFixed(2));
 pruefe('Bumper beschleunigt (> 1)',fb>1.3,fb);
 pruefe('Pfosten ≈ ABPRALL',Math.abs(fp-K.ABPRALL)<0.03,fp);
 pruefe('Bumper-Ereignis',hat(P.schuss(bmp,bmp.start,OBEN,0.5,0),'bumper'));
}

/* ---------- Pfad, Ende, Grenzfälle ---------- */
{
 const B=bahn({loch:{x:150,y:150}});
 const e=P.schuss(B,{x:500,y:1300},-1.2,0.7,0);
 const l=e.pfad[e.pfad.length-1];
 pruefe('Pfad beginnt bei t=0 am Abschlag',e.pfad[0][0]===0&&e.pfad[0][1]===500&&e.pfad[0][2]===1300);
 pruefe('letzter Pfadpunkt = Ende',l[1]===e.ende.x&&l[2]===e.ende.y&&l[0]===e.dauer);
 const abst=e.pfad.slice(1,-1).map((p,i)=>p[0]-e.pfad[i][0]);
 pruefe('Pfadpunkte ca. alle 33 ms',abst.every(d=>Math.abs(d-33.3)<0.2),abst.slice(0,5));
 pruefe('Pfadwerte auf 1 Nachkommastelle',e.pfad.every(p=>p.every(v=>Math.abs(v*10-Math.round(v*10))<1e-9)));
 pruefe('Ball bleibt irgendwann liegen',!e.versenkt&&!e.wasser&&e.dauer>500&&e.dauer<K.MAX_DAUER);
 pruefe('deterministisch',JSON.stringify(e)===JSON.stringify(P.schuss(B,{x:500,y:1300},-1.2,0.7,0)));
 const n=P.schuss(B,{x:500,y:1300},0,0,0);
 pruefe('Kraft 0: Ball bleibt, Dauer 0',n.ende.x===500&&n.ende.y===1300&&n.dauer===0&&n.pfad.length===1);
 const eis=bahn({loch:{x:150,y:150},zonen:[{typ:'eis',form:{rect:[100,100,800,1300]}}]});
 const lang=P.schuss(eis,{x:500,y:1300},-1.1,1,0);
 pruefe('Höchstdauer 12 s',lang.dauer<=K.MAX_DAUER,lang.dauer);
 const imRand=P.schuss(B,{x:105,y:700},0.3,0.3,0);
 pruefe('Start in der Wand wird herausgeschoben',imRand.pfad.slice(1).every(p=>p[1]>=100+R-0.1),imRand.pfad[1]);
}

/* ---------- besterSchuss ---------- */
{
 const B=bahn();
 let t=process.hrtime.bigint();
 const s=P.besterSchuss(B,B.start,0);
 let ms=Number(process.hrtime.bigint()-t)/1e6;
 info('besterSchuss gerade Bahn: winkel '+grad(s.winkel).toFixed(1)+'°, kraft '+s.kraft.toFixed(3)+', '+s.versuche+' Versuche, '+ms.toFixed(0)+' ms');
 pruefe('besterSchuss versenkt auf gerader Bahn',s.ergebnis.versenkt);
 pruefe('besterSchuss: Ergebnis passt zum Schuss',JSON.stringify(P.schuss(B,B.start,s.winkel,s.kraft,0))===JSON.stringify(s.ergebnis));
 // L-Bahn: Loch hinter einer Wand, Weglänge muss kleiner werden
 const L=bahn({start:{x:250,y:1300},loch:{x:750,y:1300},waende:[[500,1400,500,400]]});
 pruefe('lochDistanz geht um die Wand herum',P.lochDistanz(L,250,1300)>1900&&P.lochDistanz(L,250,1300)<2400,P.lochDistanz(L,250,1300));
 t=process.hrtime.bigint();
 let pos=L.start,schlaege=0,drin=false;
 for(;schlaege<6&&!drin;schlaege++){const b=P.besterSchuss(L,pos,0);drin=b.ergebnis.versenkt;pos=b.ergebnis.ende}
 ms=Number(process.hrtime.bigint()-t)/1e6;
 info('Bot auf L-Bahn: '+(drin?'versenkt mit '+schlaege+' Schlägen':'nicht versenkt')+', '+ms.toFixed(0)+' ms');
 pruefe('Bot schafft die L-Bahn in ≤ 4 Schlägen',drin&&schlaege<=4,schlaege);
 const z=P.besterSchuss(bahn({loch:null}),{x:500,y:1300},0,{ziel:{x:700,y:800},fein:true});
 pruefe('besterSchuss mit ziel kommt nah heran',Math.hypot(z.ergebnis.ende.x-700,z.ergebnis.ende.y-800)<40,z.wert);
}

/* ---------- Laufzeit ---------- */
{
 const B=bahn({loch:{x:500,y:250},
  waende:[[100,900,400,900],[600,900,900,900],[300,500,300,650]],
  zonen:[{typ:'sand',form:{kreis:[700,600,60]}},{typ:'eis',form:{rect:[100,950,800,150]}},{typ:'hang',form:{rect:[100,300,800,150]},richtung:[0,-1],staerke:1},{typ:'wasser',form:{rect:[700,1150,150,80]}}],
  objekte:[{typ:'bumper',x:250,y:1200,r:22,kraft:1.4},{typ:'pfosten',x:500,y:700,r:12},{typ:'muehle',x:500,y:1050,laenge:90,fluegel:4,periode:3000},
   {typ:'block',rect:[600,400,80,30],bahn:[120,0],periode:2500},{typ:'tor',x:500,y:900,b:200,offen:1000,zu:1000},{typ:'tele',a:{x:200,y:400},b:{x:800,y:300},r:28}]});
 const N=200;let max=0;const t=process.hrtime.bigint();
 for(let i=0;i<N;i++){const s=process.hrtime.bigint();P.schuss(B,B.start,i*0.37,((i%10)+1)/10,i*91);max=Math.max(max,Number(process.hrtime.bigint()-s)/1e6)}
 const avg=Number(process.hrtime.bigint()-t)/1e6/N;
 info('Laufzeit: '+avg.toFixed(2)+' ms je Schuss im Schnitt, höchstens '+max.toFixed(2)+' ms');
 pruefe('Schuss rechnet im Schnitt unter 20 ms',avg<20,avg);
 pruefe('kein Schuss über 40 ms',max<40,max);
}

console.log(ok+' Prüfungen bestanden, '+bad+' fehlgeschlagen');
if(bad)process.exit(1);
