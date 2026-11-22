/* ==========================================================================
   SPIELE-HUB · GEMEINSAME BAUSTEINE (core.js)
   --------------------------------------------------------------------------
   Enthält alles, was Hub und Spiele gleich brauchen:
     1. Hilfsfunktionen ($, esc, fmt, LS = localStorage-Hülle …)
     2. Level & Banner      – gleiche Formel wie in Brainclash
     3. Avatar              – AV-Bausteine + avatarSVG(), 1:1 aus Brainclash kopiert
     4. Meldungen & Fenster – toast(), openOverlay(), confetti()

   WICHTIG für Spielstände: Brainclash hat dieselben Avatar- und Levelregeln
   noch einmal in seiner eigenen index.html. Wer hier etwas am Avatar ändert
   (z. B. eine neue Frisur), muss es in brainclash/index.html ebenso eintragen,
   sonst sieht der Avatar im Hub und im Spiel unterschiedlich aus.

   So fügst du eine neue Avatar-Option hinzu (Beispiel Frisur „zopf“):
     1. In AV.hair den Schlüssel 'zopf' ergänzen.
     2. In AVL.hair den Anzeigenamen ergänzen: zopf:'Zopf'.
     3. In avatarSVG() im switch(a.hair) einen case'zopf' mit SVG-Pfad anlegen.
     4. Dasselbe in brainclash/index.html machen.
   ========================================================================== */

/* ---------- 1. Hilfsfunktionen (aus Brainclash) ---------- */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=arr=>{const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmt=n=>(Number(n)||0).toLocaleString('de-DE');
const clone=o=>JSON.parse(JSON.stringify(o));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function deepMerge(t,p){for(const k in p){const v=p[k];if(v&&typeof v==='object'&&!Array.isArray(v)){if(!t[k]||typeof t[k]!=='object'||Array.isArray(t[k]))t[k]={};deepMerge(t[k],v)}else t[k]=v}return t}
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
const timeAgo=ts=>{const s=Math.round((Date.now()-ts)/1000);if(s<60)return'gerade eben';const m=Math.round(s/60);if(m<60)return`vor ${m} Min.`;const h=Math.round(m/60);if(h<24)return`vor ${h} Std.`;const d=Math.round(h/24);return d===1?'gestern':`vor ${d} Tagen`};

/* ---------- 2. Level & Banner (aus Brainclash) ----------
   levelFor(punkte) -> Level, ptsForLevel(L) -> Punkte, ab denen Level L beginnt.
   BANNERS: Hintergründe der Spielerkarte, lv = ab welchem Level freigeschaltet. */
const levelFor=p=>Math.floor((1+Math.sqrt(1+8*Math.max(0,p||0)/150))/2);
const ptsForLevel=L=>150*L*(L-1)/2;
const TITLES=[[1,'Quiz-Küken 🐣'],[2,'Ratefuchs 🦊'],[3,'Rätselratte 🐀'],[4,'Schlaumeier 🤓'],[6,'Besserwisser ☝️'],[8,'Denkmaschine ⚙️'],[10,'Wandelndes Lexikon 📚'],[13,'Quiz-Professor 🎓'],[16,'Großmeister des Wissens 🧙'],[20,'Allwissende Kartoffel 🥔👑']];
const titleFor=L=>{let t=TITLES[0][1];for(const [l,n] of TITLES)if(L>=l)t=n;return t};
const BANNERS=[
 {n:'Bühne',lv:1,css:'linear-gradient(135deg,#FF6B57 0%,#E2365A 100%)'},
 {n:'Ozean',lv:1,css:'linear-gradient(135deg,#3D8BFF,#14B8C4)'},
 {n:'Dschungel',lv:2,css:'linear-gradient(135deg,#178A5A,#8CC63F)'},
 {n:'Lava',lv:3,css:'linear-gradient(135deg,#FF8A00,#E5302F 60%,#6B0F2A)'},
 {n:'Kaugummi',lv:4,css:'linear-gradient(135deg,#FF7AC0,#9B6BFF)'},
 {n:'Neon-Nacht',lv:6,css:'linear-gradient(135deg,#1B1446,#5A2BD7 55%,#FF3EA5)'},
 {n:'Galaxie',lv:8,css:'radial-gradient(circle at 18% 30%,#fff 0 1px,transparent 2px),radial-gradient(circle at 72% 22%,#fff 0 1px,transparent 2px),radial-gradient(circle at 46% 78%,#fff 0 1.5px,transparent 2.5px),radial-gradient(circle at 88% 70%,#fff 0 1px,transparent 2px),linear-gradient(135deg,#0B0F3A,#3A1C71 60%,#D76D77)'},
 {n:'Gold-Legende',lv:12,css:'linear-gradient(135deg,#7A4E00,#E7A20F 35%,#FFE38A 52%,#D99200 70%,#6E4600)'}
];

/* ---------- 3. Avatar (aus Brainclash, nicht verändern ohne Brainclash mitzuändern) ---------- */
const AV={
 skin:['#F6D2B4','#EDBB94','#D49A6E','#A86D45','#6E4429','#8EE0B8','#9EC2FF','#D7B3FF','#FFB0C4'],
 head:['rund','oval','eckig'],
 eyes:['normal','glupsch','muede','verliebt','schielend','sonnenbrille','zyklop','sterne','wuetend','zwinkern'],
 mouth:['laecheln','grinsen','zunge','staunen','neutral','vampir','zickzack','kuss','schnurrbart'],
 hair:['ohne','stacheln','afro','lang','scheitel','irokese','muetze','krone','party','wikinger','katze','koch','propeller','topf','zauberer'],
 hc:['#2B1B12','#6B4226','#C9873B','#F2D06B','#ECECEC','#E5484D','#3D7BFF','#2BC48A','#FF7AD9','#8A5CF6'],
 extra:['ohne','brille','monokel','pflaster','clownsnase','bart','sommersprossen','roete','ohrring'],
 shirt:['#FF6B57','#3D8BFF','#22C98A','#FFC53D','#8A5CF6','#F4EFE6','#2A3F5F','#FF7AD9'],
 bg:['#FFC53D','#FF6B57','#3DDC97','#5BC0FF','#B38CFF','#FF9AD5','#2A3F5F','#F4EFE6']
};
const AVL={
 head:{rund:'Rund',oval:'Oval',eckig:'Eckig'},
 eyes:{normal:'Normal',glupsch:'Glupsch',muede:'Müde',verliebt:'Verliebt',schielend:'Schielend',sonnenbrille:'Cool',zyklop:'Zyklop',sterne:'Sternchen',wuetend:'Wütend',zwinkern:'Zwinker'},
 mouth:{laecheln:'Lächeln',grinsen:'Grinsen',zunge:'Zunge',staunen:'Staunen',neutral:'Ernst',vampir:'Vampir',zickzack:'Zickzack',kuss:'Kussmund',schnurrbart:'Schnurrbart'},
 hair:{ohne:'Glatze',stacheln:'Stacheln',afro:'Afro',lang:'Lang',scheitel:'Scheitel',irokese:'Irokese',muetze:'Mütze',krone:'Krone',party:'Partyhut',wikinger:'Wikinger',katze:'Katzenohren',koch:'Kochmütze',propeller:'Propeller',topf:'Kochtopf',zauberer:'Zauberhut'},
 extra:{ohne:'Nichts',brille:'Brille',monokel:'Monokel',pflaster:'Pflaster',clownsnase:'Clownsnase',bart:'Vollbart',sommersprossen:'Sommersprossen',roete:'Rote Bäckchen',ohrring:'Ohrringe'}
};
const ETABS=[['skin','Haut'],['head','Kopf'],['eyes','Augen'],['mouth','Mund'],['hair','Frisur & Hut'],['hc','Haarfarbe'],['extra','Extras'],['shirt','Shirt'],['bg','Hintergrund']];
const DEFAULT_AV={skin:AV.skin[0],head:'rund',eyes:'normal',mouth:'laecheln',hair:'stacheln',hc:AV.hc[0],extra:'ohne',shirt:AV.shirt[0],bg:AV.bg[0]};
function randomAvatar(){const a={};for(const k in AV)a[k]=pick(AV[k]);if(Math.random()<.4)a.extra='ohne';return a}
function starPts(x,y,R,r){let p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r:R;p.push((x+rr*Math.cos(a)).toFixed(1)+','+(y+rr*Math.sin(a)).toFixed(1))}return p.join(' ')}
function avatarSVG(a0){
 const a={...DEFAULT_AV,...(a0||{})};const sk=a.skin,hc=a.hc,dk='#2A1A12';let s='';
 s+=`<rect width="120" height="120" fill="${a.bg}"/>`;
 if(a.hair==='afro')s+=`<circle cx="60" cy="50" r="44" fill="${hc}"/><circle cx="22" cy="66" r="14" fill="${hc}"/><circle cx="98" cy="66" r="14" fill="${hc}"/>`;
 if(a.hair==='lang')s+=`<path d="M24 58 Q22 18 60 18 Q98 18 96 58 L100 108 Q80 100 60 102 Q40 100 20 108 Z" fill="${hc}"/>`;
 s+=`<path d="M16 120 Q20 94 60 94 Q100 94 104 120 Z" fill="${a.shirt}"/><rect x="52" y="82" width="16" height="16" rx="6" fill="${sk}"/><path d="M50 95 Q60 104 70 95" stroke="rgba(0,0,0,.18)" stroke-width="3" fill="none"/>`;
 if(a.hair==='wikinger')s+=`<path d="M30 40 Q8 34 10 8 Q19 28 36 32 Z" fill="#F4EFE6" stroke="#CFC6B6" stroke-width="1.5"/><path d="M90 40 Q112 34 110 8 Q101 28 84 32 Z" fill="#F4EFE6" stroke="#CFC6B6" stroke-width="1.5"/>`;
 if(a.hair==='katze')s+=`<path d="M30 46 L24 8 L54 28 Z" fill="${hc}"/><path d="M33 37 L30 17 L46 29 Z" fill="#FF9AB5"/><path d="M90 46 L96 8 L66 28 Z" fill="${hc}"/><path d="M87 37 L90 17 L74 29 Z" fill="#FF9AB5"/>`;
 s+=`<circle cx="27" cy="62" r="7" fill="${sk}"/><circle cx="93" cy="62" r="7" fill="${sk}"/>`;
 if(a.head==='oval')s+=`<ellipse cx="60" cy="60" rx="31" ry="37" fill="${sk}"/>`;
 else if(a.head==='eckig')s+=`<rect x="27" y="26" width="66" height="70" rx="15" fill="${sk}"/>`;
 else s+=`<circle cx="60" cy="61" r="34" fill="${sk}"/>`;
 if(a.extra==='roete')s+=`<ellipse cx="40" cy="71" rx="7" ry="4.5" fill="#FF6B8A" opacity=".5"/><ellipse cx="80" cy="71" rx="7" ry="4.5" fill="#FF6B8A" opacity=".5"/>`;
 if(a.extra==='sommersprossen')s+=[[39,67],[44,70],[36,71],[41,73],[81,67],[76,70],[84,71],[79,73]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.4" fill="rgba(140,70,30,.6)"/>`).join('');
 if(a.extra==='bart')s+=`<path d="M28 63 Q30 100 60 103 Q90 100 92 63 Q86 85 60 86 Q34 85 28 63 Z" fill="${hc}"/>`;
 const E=(x,y)=>`<circle cx="${x}" cy="${y}" r="6.5" fill="#fff"/><circle cx="${x+1}" cy="${y+1}" r="3.4" fill="${dk}"/><circle cx="${x+2.2}" cy="${y-.6}" r="1.1" fill="#fff"/>`;
 const H=(x,y)=>`<path d="M${x} ${y+6} C${x-10} ${y-1} ${x-6} ${y-9} ${x} ${y-4} C${x+6} ${y-9} ${x+10} ${y-1} ${x} ${y+6} Z" fill="#E5484D"/>`;
 switch(a.eyes){
  case'glupsch':s+=`<circle cx="46" cy="56" r="10" fill="#fff" stroke="${dk}" stroke-width="1.5"/><circle cx="75" cy="56" r="9" fill="#fff" stroke="${dk}" stroke-width="1.5"/><circle cx="43" cy="60" r="3.8" fill="${dk}"/><circle cx="78" cy="52" r="3.8" fill="${dk}"/>`;break;
  case'muede':s+=E(47,57)+E(73,57)+`<path d="M39.5 57.5 A7.5 7.5 0 0 1 54.5 57.5 Z" fill="${sk}"/><path d="M65.5 57.5 A7.5 7.5 0 0 1 80.5 57.5 Z" fill="${sk}"/><path d="M40 57.5 H54 M66 57.5 H80" stroke="${dk}" stroke-width="2.2" stroke-linecap="round"/>`;break;
  case'verliebt':s+=H(47,57)+H(73,57);break;
  case'schielend':s+=`<circle cx="47" cy="57" r="6.5" fill="#fff"/><circle cx="73" cy="57" r="6.5" fill="#fff"/><circle cx="51" cy="58" r="3.4" fill="${dk}"/><circle cx="69" cy="58" r="3.4" fill="${dk}"/>`;break;
  case'sonnenbrille':s+=`<path d="M28 54 H92" stroke="#111" stroke-width="3"/><rect x="35" y="50" width="23" height="15" rx="6" fill="#111"/><rect x="62" y="50" width="23" height="15" rx="6" fill="#111"/><path d="M39 54 L45 54 M66 54 L72 54" stroke="rgba(255,255,255,.55)" stroke-width="2.5" stroke-linecap="round"/>`;break;
  case'zyklop':s+=`<circle cx="60" cy="54" r="12" fill="#fff" stroke="${dk}" stroke-width="1.5"/><circle cx="60" cy="55" r="6.5" fill="#3D7BFF"/><circle cx="60" cy="55" r="3.2" fill="${dk}"/><circle cx="63" cy="52" r="1.6" fill="#fff"/>`;break;
  case'sterne':s+=`<polygon points="${starPts(47,57,8.5,3.6)}" fill="#FFD43B" stroke="${dk}" stroke-width="1"/><polygon points="${starPts(73,57,8.5,3.6)}" fill="#FFD43B" stroke="${dk}" stroke-width="1"/>`;break;
  case'wuetend':s+=E(47,57)+E(73,57)+`<path d="M38 46 L55 51 M82 46 L65 51" stroke="${dk}" stroke-width="3.5" stroke-linecap="round"/>`;break;
  case'zwinkern':s+=E(47,57)+`<path d="M66 58 Q73 52 80 58" stroke="${dk}" stroke-width="3" fill="none" stroke-linecap="round"/>`;break;
  default:s+=E(47,57)+E(73,57);
 }
 s+=`<ellipse cx="60" cy="68.5" rx="3.5" ry="2.5" fill="rgba(0,0,0,.15)"/>`;
 const smile=`<path d="M48 76 Q60 88 72 76" stroke="${dk}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
 switch(a.mouth){
  case'grinsen':s+=`<path d="M45 74 Q60 94 75 74 Z" fill="${dk}"/><path d="M47.5 75 H72.5 L70.5 79 H49.5 Z" fill="#fff"/>`;break;
  case'zunge':s+=`<path d="M47 74 Q60 90 73 74 Z" fill="${dk}"/><path d="M55 80 Q55 93 62 93 Q69 93 68 80 Z" fill="#FF6B8A"/><path d="M61.5 82 V89" stroke="#D94468" stroke-width="1.5"/>`;break;
  case'staunen':s+=`<ellipse cx="60" cy="80" rx="5.5" ry="7" fill="${dk}"/>`;break;
  case'neutral':s+=`<path d="M51 79 H69" stroke="${dk}" stroke-width="3" stroke-linecap="round"/>`;break;
  case'vampir':s+=smile+`<path d="M52.5 79.5 L54.5 86 L56.8 80.6 Z M63.2 80.6 L65.5 86 L67.5 79.5 Z" fill="#fff" stroke="${dk}" stroke-width=".8"/>`;break;
  case'zickzack':s+=`<path d="M46 78 L50 74 L54 79 L58 74 L62 79 L66 74 L70 79 L74 75" stroke="${dk}" stroke-width="2.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;break;
  case'kuss':s+=`<path d="M60 77 C57 73 52 75 54 79 C55 81 58 82 60 84 C62 82 65 81 66 79 C68 75 63 73 60 77 Z" fill="#E5484D"/>`;break;
  case'schnurrbart':s+=smile+`<path d="M60 73 C55 67 44 69 40 77 C47 73 53 75 60 75 C67 75 73 73 80 77 C76 69 65 67 60 73 Z" fill="${hc}"/>`;break;
  default:s+=smile;
 }
 if(a.extra==='brille')s+=`<path d="M28 55 L37 56 M92 55 L83 56" stroke="${dk}" stroke-width="2.2"/><circle cx="47" cy="57" r="10" fill="rgba(255,255,255,.15)" stroke="${dk}" stroke-width="2.6"/><circle cx="73" cy="57" r="10" fill="rgba(255,255,255,.15)" stroke="${dk}" stroke-width="2.6"/><path d="M57 57 Q60 54 63 57" stroke="${dk}" stroke-width="2.4" fill="none"/>`;
 if(a.extra==='monokel')s+=`<circle cx="73" cy="57" r="10.5" fill="rgba(255,255,255,.2)" stroke="#D4A017" stroke-width="2.6"/><path d="M82 62 Q90 80 80 98" stroke="#D4A017" stroke-width="1.6" fill="none"/>`;
 if(a.extra==='pflaster')s+=`<g transform="rotate(-25 80 75)"><rect x="71" y="71" width="18" height="8" rx="3.5" fill="#F2C9A0" stroke="#D9A877"/><path d="M78 72.5 v5 M82 72.5 v5" stroke="#D9A877"/></g>`;
 if(a.extra==='clownsnase')s+=`<circle cx="60" cy="68" r="7" fill="#E5484D"/><circle cx="57.5" cy="65.5" r="2.2" fill="#fff" opacity=".7"/>`;
 if(a.extra==='ohrring')s+=`<circle cx="24" cy="72" r="4" fill="none" stroke="#FFC53D" stroke-width="2.2"/><circle cx="96" cy="72" r="4" fill="none" stroke="#FFC53D" stroke-width="2.2"/>`;
 switch(a.hair){
  case'stacheln':s+=`<path d="M27 52 L30 28 L39 38 L44 16 L53 33 L60 10 L67 33 L76 16 L81 38 L90 28 L93 52 Q78 38 60 40 Q42 38 27 52 Z" fill="${hc}"/>`;break;
  case'afro':s+=`<path d="M27 50 Q30 24 60 24 Q90 24 93 50 Q80 38 60 40 Q40 38 27 50 Z" fill="${hc}"/>`;break;
  case'lang':s+=`<path d="M26 60 Q24 24 60 24 Q96 24 94 60 Q90 40 72 34 Q60 46 36 40 Q28 46 26 60 Z" fill="${hc}"/>`;break;
  case'scheitel':s+=`<path d="M26 56 Q24 24 56 22 Q92 20 94 54 Q86 36 66 34 Q50 42 34 38 Q28 44 26 56 Z" fill="${hc}"/>`;break;
  case'irokese':s+=`<path d="M53 34 L47 6 L56 16 L60 2 L64 16 L73 6 L67 34 Q60 30 53 34 Z" fill="${hc}"/>`;break;
  case'muetze':s+=`<path d="M26 48 Q26 14 60 14 Q94 14 94 48 Z" fill="${hc}"/><path d="M40 20 V44 M60 14 V44 M80 20 V44" stroke="rgba(0,0,0,.15)" stroke-width="4"/><rect x="23" y="41" width="74" height="12" rx="6" fill="${hc}"/><rect x="23" y="41" width="74" height="12" rx="6" fill="rgba(255,255,255,.18)"/><circle cx="60" cy="12" r="8.5" fill="#F4EFE6"/>`;break;
  case'krone':s+=`<path d="M34 36 L36 12 L47 26 L54 6 L60 22 L66 6 L73 26 L84 12 L86 36 Z" fill="#FFC53D" stroke="#B37A00" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="29" r="3.6" fill="#E5484D"/><circle cx="45" cy="31" r="2.6" fill="#3D7BFF"/><circle cx="75" cy="31" r="2.6" fill="#3DDC97"/>`;break;
  case'party':s+=`<g transform="rotate(14 60 36)"><path d="M42 38 L60 4 L78 38 Z" fill="#FF6B57"/><circle cx="60" cy="16" r="3" fill="#FFC53D"/><circle cx="54" cy="28" r="3" fill="#3DDC97"/><circle cx="67" cy="30" r="3" fill="#5BC0FF"/><circle cx="60" cy="4" r="6" fill="#FFC53D"/></g>`;break;
  case'wikinger':s+=`<path d="M26 48 Q26 18 60 18 Q94 18 94 48 Z" fill="#9AA4B1"/><path d="M60 18 V42" stroke="#6C7889" stroke-width="6"/><rect x="24" y="42" width="72" height="10" rx="4" fill="#6C7889"/><circle cx="36" cy="47" r="2" fill="#D9DEE4"/><circle cx="60" cy="47" r="2" fill="#D9DEE4"/><circle cx="84" cy="47" r="2" fill="#D9DEE4"/>`;break;
  case'katze':s+=`<path d="M30 46 Q34 26 60 26 Q86 26 90 46 Q76 36 60 38 Q44 36 30 46 Z" fill="${hc}"/><path d="M30 73 H43 M31 78 L43 76 M90 73 H77 M89 78 L77 76" stroke="${dk}" stroke-width="1.3" opacity=".55"/>`;break;
  case'koch':s+=`<path d="M36 40 V26 Q24 24 28 12 Q32 2 46 7 Q52 -3 62 3 Q74 -3 78 8 Q92 4 92 16 Q94 26 84 26 V40 Z" fill="#fff" stroke="#D6DCE4" stroke-width="2"/><rect x="34" y="34" width="52" height="11" rx="3" fill="#fff" stroke="#D6DCE4" stroke-width="2"/>`;break;
  case'propeller':s+=`<path d="M26 48 Q26 20 60 20 Q94 20 94 48 Z" fill="#3D7BFF"/><path d="M60 20 Q50 30 47 46 L73 46 Q70 30 60 20 Z" fill="#FFC53D"/><rect x="23" y="43" width="74" height="8" rx="4" fill="#E5484D"/><rect x="58.5" y="9" width="3" height="12" fill="#555"/><g class="prop"><ellipse cx="51" cy="9" rx="9" ry="3.4" fill="#E5484D"/><ellipse cx="69" cy="9" rx="9" ry="3.4" fill="#3DDC97"/></g><circle cx="60" cy="9" r="2.5" fill="#333"/>`;break;
  case'topf':s+=`<rect x="28" y="12" width="64" height="32" rx="5" fill="#9AA4B1"/><rect x="38" y="18" width="9" height="18" rx="4" fill="rgba(255,255,255,.35)"/><rect x="22" y="40" width="76" height="8" rx="4" fill="#6C7889"/><rect x="8" y="22" width="22" height="6" rx="3" fill="#3A3F48"/>`;break;
  case'zauberer':s+=`<path d="M30 44 L68 -4 L90 44 Z" fill="#3D4DB7"/><polygon points="${starPts(60,26,7,3)}" fill="#FFD43B"/><circle cx="72" cy="14" r="2" fill="#FFD43B"/><circle cx="48" cy="36" r="1.6" fill="#FFD43B"/><ellipse cx="60" cy="44" rx="40" ry="7" fill="#2E3A94"/>`;break;
 }
 return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${s}</svg>`;
}

/* ---------- Hub-Titel ----------
   Brainclash vergibt Quiz-Titel („Quiz-Küken“ …). Der Hub zeigt spielübergreifende
   Titel. Format: [ab Level, Titel]. Einfach Zeilen ergänzen oder umbenennen. */
const HUB_TITLES=[[1,'Frischling 🐣'],[2,'Mitspieler 🎲'],[3,'Stammgast 🍻'],[5,'Zocker 🎮'],[7,'Tischkönig 👑'],[10,'Hallenlegende 🏆'],[14,'Spielgott ⚡'],[20,'Unsterblich 🌟']];
const hubTitleFor=L=>{let t=HUB_TITLES[0][1];for(const [l,n] of HUB_TITLES)if(L>=l)t=n;return t};

/* ---------- 4. Meldungen & Fenster ---------- */
const bulbs=n=>'<b></b>'.repeat(n);
/* toast(text, {av, ms, link:{href,label}}) – kurze Meldung oben.
   av = Avatar-Objekt (optional), link = Knopf in der Meldung (optional). */
function toast(text,opt={}){
 const box=$('#toasts');if(!box)return;const t=document.createElement('div');t.className='toast';
 t.innerHTML=`${opt.av?`<div class="av">${avatarSVG(opt.av)}</div>`:''}<div class="tx">${esc(text)}</div>${opt.link?`<a class="btn small" style="min-height:38px;padding:6px 12px;font-size:15px" href="${esc(opt.link.href)}">${esc(opt.link.label)}</a>`:''}`;
 box.appendChild(t);t.addEventListener('click',()=>t.remove());setTimeout(()=>t.remove(),opt.ms||4200);
}
/* openOverlay(html) – Fenster in der Bildschirmmitte. Ein Klick daneben schließt es. */
function openOverlay(html){const r=$('#ovl-root');if(!r)return;r.innerHTML=`<div class="ovl" data-a="ovlBg"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`}
function closeOverlay(){const r=$('#ovl-root');if(r)r.innerHTML=''}
function confetti(n=60){if(reduced())return;const fx=$('#fx');if(!fx)return;const cols=['#FFC53D','#FF6B57','#3DDC97','#5BC0FF','#B38CFF','#FF9AD5','#fff'];for(let i=0;i<n;i++){const c=document.createElement('i');c.className='conf';c.style.left=Math.random()*100+'%';c.style.background=pick(cols);c.style.animationDuration=(1.8+Math.random()*1.8)+'s';c.style.animationDelay=(Math.random()*.4)+'s';c.style.transform=`rotate(${rnd(0,360)}deg)`;fx.appendChild(c);setTimeout(()=>c.remove(),4200)}}
