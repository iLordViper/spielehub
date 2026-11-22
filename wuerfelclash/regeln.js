/* ==========================================================================
   WÜRFELCLASH · REGELN & WERTUNG (regeln.js)
   --------------------------------------------------------------------------
   Reine Rechenfunktionen ohne Bildschirm – darum leicht zu prüfen
   (node wuerfelclash/regeln.test.js).

   Spielablauf: 13 Runden. In jeder Runde bis zu 3 Würfe mit 5 Würfeln,
   zwischen den Würfen beliebige Würfel festhalten. Danach MUSS ein freies
   Feld belegt werden (notfalls mit 0 Punkten).

   Felder (id → Name → Wertung):
     e1…e6  Einser…Sechser   Summe der Augen dieser Zahl
     dp     Dreierpasch      mind. 3 gleiche → Summe aller Würfel
     vp     Viererpasch      mind. 4 gleiche → Summe aller Würfel
     fh     Full House       3 gleiche + 2 gleiche → 25
     ks     Kleine Straße    4 in Folge → 30
     gs     Große Straße     5 in Folge → 40
     fp     Fünferpasch      5 gleiche → 50
     ch     Chance           Summe aller Würfel
   Bonus oben: 35 Punkte, wenn Einser…Sechser zusammen mind. 63 ergeben.

   Das sind die Original-Regeln. Zusätzlich vorbereitet, aber AUS:
   EXTRA_REGEL=true schaltet die amerikanische Zusatzregel ein (zweiter
   Fünferpasch +50, Full House/Straßen als Joker).

   Regeln ändern: Punktwerte stehen in WERT, Bonusgrenze in BONUS_GRENZE.

   Außerdem hier: tipp() – der Berater, der Hinweise gibt („Große Straße!“,
   „Halte die 4er“) und den der Würfelbot zum Spielen benutzt.
   ========================================================================== */
(function(root){
const EXTRA_REGEL=false;
const WERT={fh:25,ks:30,gs:40,fp:50,bonus:35,extraFp:50};
const BONUS_GRENZE=63;
const OBEN=['e1','e2','e3','e4','e5','e6'];
const UNTEN=['dp','vp','fh','ks','gs','fp','ch'];
const FELDER=[...OBEN,...UNTEN];
const NAMEN={e1:'Einser',e2:'Zweier',e3:'Dreier',e4:'Vierer',e5:'Fünfer',e6:'Sechser',
 dp:'Dreierpasch',vp:'Viererpasch',fh:'Full House',ks:'Kleine Straße',gs:'Große Straße',fp:'Fünferpasch',ch:'Chance'};
const HILFE={e1:'Alle Einser zählen',e2:'Alle Zweier zählen',e3:'Alle Dreier zählen',e4:'Alle Vierer zählen',e5:'Alle Fünfer zählen',e6:'Alle Sechser zählen',
 dp:'3 gleiche: Summe aller Würfel',vp:'4 gleiche: Summe aller Würfel',fh:'3 + 2 gleiche: 25',ks:'4 in Folge: 30',gs:'5 in Folge: 40',fp:'5 gleiche: 50',ch:'Summe aller Würfel'};

const zaehle=w=>{const c=[0,0,0,0,0,0,0];w.forEach(x=>c[x]++);return c};
const summe=w=>w.reduce((a,b)=>a+b,0);
const hatFolge=(c,len)=>{let run=0;for(let i=1;i<=6;i++){run=c[i]?run+1:0;if(run>=len)return true}return false};

/* Punkte, die die Würfel w (5 Zahlen 1–6) im Feld f bringen würden.
   blatt = bisher belegte Felder des Spielers (für die Joker-Regel). */
function punkte(f,w,blatt){
 blatt=blatt||{};const c=zaehle(w),s=summe(w),max=Math.max(...c);
 const fuenf=max===5;
 const joker=EXTRA_REGEL&&fuenf&&blatt.fp!==undefined&&blatt['e'+w[0]]!==undefined;
 if(f[0]==='e'){const n=+f[1];return c[n]*n}
 switch(f){
  case'dp':return max>=3?s:0;
  case'vp':return max>=4?s:0;
  case'fh':return (c.includes(3)&&c.includes(2))||joker?WERT.fh:0;
  case'ks':return hatFolge(c,4)||joker?WERT.ks:0;
  case'gs':return hatFolge(c,5)||joker?WERT.gs:0;
  case'fp':return fuenf?WERT.fp:0;
  case'ch':return s;
 }
 return 0;
}
/* Gibt es beim Eintragen einen Extra-Fünferpasch-Bonus? */
const extraBonus=(w,blatt)=>EXTRA_REGEL&&Math.max(...zaehle(w))===5&&!!blatt&&blatt.fp===WERT.fp;

/* Summen eines Blatts. extra = Anzahl Extra-Fünferpäsche. */
function summen(blatt,extra){
 blatt=blatt||{};const oben=OBEN.reduce((a,f)=>a+(blatt[f]||0),0);
 const bonus=oben>=BONUS_GRENZE?WERT.bonus:0;
 const unten=UNTEN.reduce((a,f)=>a+(blatt[f]||0),0);
 const xb=(extra||0)*WERT.extraFp;
 return{oben,bonus,unten,extra:xb,gesamt:oben+bonus+unten+xb,fehltBonus:Math.max(0,BONUS_GRENZE-oben)};
}
const fertig=blatt=>FELDER.every(f=>blatt&&blatt[f]!==undefined);
const belegt=blatt=>FELDER.filter(f=>blatt&&blatt[f]!==undefined).length;

/* ---------- Berater ----------
   tipp(w, blatt, rest) schaut sich die Würfel w an und liefert:
     feld   bestes freies Feld zum Eintragen (Schätzung)
     wert   Punkte in diesem Feld
     kombis freie Felder, die gerade „getroffen“ sind (z. B. ['gs','ks'])
     halten Indizes der Würfel, die man festhalten sollte (nur wenn rest > 0)
     text   kurzer Hinweis für den Bildschirm
   rest = verbleibende Würfe in diesem Zug (0, 1 oder 2).
   NORMAL = was ein Feld „üblicherweise“ bringt. Wer darunter einträgt,
   verschenkt etwas – so entscheidet der Berater, wo es am wenigsten wehtut. */
const NORMAL={e1:3,e2:6,e3:9,e4:12,e5:15,e6:18,dp:17,vp:10,fh:15,ks:20,gs:16,fp:10,ch:21};
const STARK=['fp','gs','fh','ks','vp'];
function folgeWerte(c){let best=[],run=[];for(let i=1;i<=6;i++){if(c[i]){run.push(i);if(run.length>best.length)best=run.slice()}else run=[]}return best}
function tipp(w,blatt,rest){
 blatt=blatt||{};const frei=FELDER.filter(f=>blatt[f]===undefined);
 if(!w||w.some(x=>!x)||!frei.length)return{feld:null,wert:0,kombis:[],halten:[],text:''};
 const c=zaehle(w);
 let feld=frei[0],best=-1e9;
 frei.forEach(f=>{const v=punkte(f,w,blatt);let s=v-NORMAL[f];
  if(f[0]==='e'){const o=OBEN.reduce((a,g)=>a+(blatt[g]||0),0);if(o<BONUS_GRENZE&&v>=NORMAL[f])s+=4}
  if(s>best){best=s;feld=f}});
 const kombis=STARK.filter(f=>frei.includes(f)&&punkte(f,w,blatt)>0);
 if(kombis.includes('gs'))kombis.splice(kombis.indexOf('ks'),kombis.includes('ks')?1:0);
 const wert=punkte(feld,w,blatt);
 const idx=vals=>{const used=new Set();return vals.map(v=>w.findIndex((x,i)=>x===v&&!used.has(i)&&used.add(i))).filter(i=>i>=0)};
 const alleIdx=v=>w.map((x,i)=>x===v?i:-1).filter(i=>i>=0);
 let halten=[],text='';
 const fertigKombi=kombis.find(f=>['fp','gs','fh'].includes(f));
 if(rest<=0||fertigKombi){
  text=fertigKombi?`${NAMEN[fertigKombi]}! ${punkte(fertigKombi,w,blatt)} Punkte – trag sie ein`:`Bester Platz: ${NAMEN[feld]} (${wert} Punkte)`;
  if(fertigKombi)return{feld:fertigKombi,wert:punkte(fertigKombi,w,blatt),kombis,halten:[0,1,2,3,4],text};
  return{feld,wert,kombis,halten,text};
 }
 const max=Math.max(...c);let n=0;for(let i=6;i>=1;i--)if(c[i]===max){n=i;break}
 const folge=folgeWerte(c);const paare=[1,2,3,4,5,6].filter(i=>c[i]===2);
 const offen=f=>frei.includes(f);
 if(folge.length>=4&&offen('gs')){halten=idx(folge.slice(0,5));text=`Straße fast komplett – halte ${folge.join('-')}`}
 else if(max>=3&&(offen('e'+n)||offen('dp')||offen('vp')||offen('fp'))){halten=alleIdx(n);text=max===4?`Vier ${n}er! Halte sie – noch einer zum Fünferpasch`:`Drei ${n}er – halte sie fest`}
 else if(folge.length>=4&&offen('ks')){text='Kleine Straße steht – eintragen oder auf mehr würfeln';halten=idx(folge.slice(0,4))}
 else if(paare.length===2&&offen('fh')){halten=[...alleIdx(paare[0]),...alleIdx(paare[1])];text='Zwei Paare – ein Würfel fehlt zum Full House'}
 else if(folge.length===3&&(offen('ks')||offen('gs'))&&max<3){halten=idx(folge);text=`Straße in Sicht – halte ${folge.join('-')}`}
 else if(max===2&&(offen('e'+n)||offen('dp')||offen('vp')||offen('fp'))){halten=alleIdx(n);text=`Halte das ${n}er-Paar`}
 else{text='Kein Muster – würfle alles neu'}
 return{feld,wert,kombis,halten,text};
}

const API={EXTRA_REGEL,WERT,BONUS_GRENZE,OBEN,UNTEN,FELDER,NAMEN,HILFE,NORMAL,zaehle,punkte,extraBonus,summen,fertig,belegt,tipp};
if(typeof module!=='undefined')module.exports=API;else root.REGELN=API;
})(this);
