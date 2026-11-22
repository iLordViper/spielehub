/* ==========================================================================
   KRITZELCLASH · WÖRTER & RATE-PRÜFUNG (woerter.js)
   --------------------------------------------------------------------------
   WOERTER: die Begriffe zum Zeichnen. Einfach Wörter ergänzen oder löschen –
   ein Begriff pro Eintrag, auch mit Leerzeichen („Heißer Ofen“ geht).
   Schwierigkeit steckt in der Liste: [Begriff, 1 = leicht | 2 = mittel | 3 = schwer].

   norm(t)      macht Tipps vergleichbar: klein, ohne Akzente, ä→ae, ß→ss,
                nur Buchstaben/Ziffern. „Würfel“, „wuerfel“ und „WÜRFEL!“ sind gleich.
   hashWort()   Der Begriff steht NICHT im Klartext in der Datenbank, nur sein
                Fingerabdruck (SHA-256). So kann man ihn nicht einfach nachschlagen.
   abstand()    Wie viele Tippfehler zwischen zwei Wörtern liegen („knapp daneben“).
   maske()      „_ _ _ _ _“ für die Rater, mit aufgedeckten Buchstaben als Hinweis.

   Prüfen: node kritzelclash/woerter.test.js
   ========================================================================== */
(function(root){
const WOERTER=[
 // Tiere
 ['Katze',1],['Hund',1],['Maus',1],['Pferd',1],['Kuh',1],['Schwein',1],['Ente',1],['Fisch',1],['Vogel',1],['Schlange',1],['Giraffe',2],['Elefant',1],['Löwe',1],['Affe',1],['Bär',1],['Hase',1],['Igel',2],['Schnecke',1],['Spinne',1],['Biene',1],['Schmetterling',2],['Krokodil',2],['Pinguin',2],['Eule',2],['Hai',2],['Wal',2],['Oktopus',2],['Krake',2],['Frosch',1],['Schildkröte',2],['Känguru',3],['Flamingo',2],['Zebra',2],['Einhorn',2],['Drache',2],['Fledermaus',2],['Qualle',3],['Marienkäfer',2],['Regenwurm',2],['Papagei',2],
 // Essen & Trinken
 ['Pizza',1],['Banane',1],['Apfel',1],['Erdbeere',1],['Kirsche',1],['Ananas',2],['Brezel',2],['Hotdog',2],['Burger',1],['Pommes',1],['Eis',1],['Torte',1],['Donut',1],['Kaffee',2],['Spiegelei',2],['Karotte',1],['Brokkoli',2],['Popcorn',2],['Spaghetti',2],['Sushi',3],['Döner',2],['Käse',1],['Wurst',1],['Zitrone',1],['Wassermelone',2],['Lolli',1],['Schokolade',2],['Croissant',3],['Honig',2],['Kaugummi',3],
 // Gegenstände
 ['Haus',1],['Auto',1],['Fahrrad',1],['Schlüssel',1],['Brille',1],['Uhr',1],['Handy',1],['Lampe',1],['Stuhl',1],['Tisch',1],['Bett',1],['Regenschirm',2],['Kerze',1],['Schere',1],['Hammer',1],['Leiter',2],['Buch',1],['Ball',1],['Gitarre',2],['Trommel',2],['Krone',1],['Rakete',1],['Flugzeug',1],['Schiff',1],['Zug',1],['Hubschrauber',2],['Ampel',2],['Kamera',2],['Fernseher',2],['Kühlschrank',2],['Zahnbürste',2],['Toilette',2],['Badewanne',2],['Rucksack',2],['Koffer',2],['Geschenk',1],['Luftballon',1],['Drachen',2],['Anker',2],['Kompass',3],['Lupe',2],['Mikrofon',2],['Kopfhörer',2],['Würfel',1],['Spielkarte',2],['Schatztruhe',2],['Glühbirne',2],['Batterie',2],['Magnet',2],['Sanduhr',2],['Besen',2],['Eimer',2],['Zelt',2],['Schaukel',2],['Rutsche',2],['Skateboard',2],['Roller',2],['Trampolin',3],['Teddybär',2],['Puzzle',3],
 // Natur & Orte
 ['Sonne',1],['Mond',1],['Stern',1],['Wolke',1],['Regenbogen',1],['Blitz',1],['Baum',1],['Blume',1],['Pilz',1],['Kaktus',1],['Berg',1],['Vulkan',2],['Insel',2],['Strand',2],['Wüste',2],['Wasserfall',2],['Höhle',3],['Schneemann',1],['Tornado',3],['Leuchtturm',2],['Brücke',2],['Burg',2],['Pyramide',2],['Kirche',2],['Zoo',3],['Spielplatz',3],['Bahnhof',3],['Krankenhaus',3],['Feuerwerk',2],['Lagerfeuer',2],
 // Menschen & Berufe
 ['Pirat',2],['Ritter',2],['Prinzessin',2],['Zauberer',2],['Hexe',2],['Astronaut',2],['Feuerwehr',2],['Polizist',2],['Koch',2],['Arzt',2],['Clown',2],['Cowboy',2],['Ninja',2],['Roboter',1],['Gespenst',2],['Vampir',2],['Zombie',2],['Meerjungfrau',2],['Superheld',2],['Baby',1],['Oma',2],['Weihnachtsmann',2],['Osterhase',2],['Schornsteinfeger',3],['Taucher',2],
 // Körper & Kleidung
 ['Auge',1],['Nase',1],['Mund',1],['Ohr',1],['Hand',1],['Fuß',1],['Zahn',1],['Herz',1],['Gehirn',2],['Skelett',2],['Hut',1],['Schuh',1],['Socke',1],['Handschuh',2],['Schal',2],['Krawatte',2],['Kleid',2],['Hose',1],['Bikini',2],['Gummistiefel',3],
 // Sport & Freizeit
 ['Fußball',1],['Tennis',2],['Basketball',2],['Bowling',2],['Golf',2],['Schwimmen',2],['Angeln',2],['Surfen',3],['Ski',2],['Boxen',2],['Karate',3],['Yoga',3],['Zirkus',2],['Kino',3],['Konzert',3],['Achterbahn',2],['Riesenrad',2],['Karussell',3],['Picknick',3],['Camping',3],
 // Tätigkeiten & Schwieriges
 ['Schlafen',2],['Tanzen',2],['Lachen',2],['Weinen',2],['Niesen',3],['Gähnen',3],['Kochen',2],['Malen',2],['Lesen',2],['Fliegen',2],['Springen',2],['Zaubern',3],['Grillen',2],['Staubsaugen',3],['Selfie',2],['Hochzeit',3],['Geburtstag',2],['Weihnachten',2],['Halloween',2],['Silvester',3],
 ['Internet',3],['Musik',2],['Zeit',3],['Liebe',2],['Angst',3],['Traum',3],['Glück',3],['Urlaub',2],['Schule',2],['Hausaufgaben',3],['Montag',3],['Stau',3],['Kater',3],['Muskelkater',3],['Ohrwurm',3],['Faulpelz',3],['Schneeballschlacht',3],['Kissenschlacht',3],['Sonnenbrand',3],['Gänsehaut',3]
];

function norm(t){
 return String(t||'').toLowerCase().trim()
  .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/[^a-z0-9]/g,'');
}
/* Fingerabdruck: im Browser mit crypto.subtle, in Node mit dem crypto-Modul. */
async function hashWort(spielId,wort){
 const text=`kritzel:${spielId}:${norm(wort)}`;
 if(typeof crypto!=='undefined'&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
 return require('crypto').createHash('sha256').update(text).digest('hex');
}
/* Tippfehler-Abstand (Levenshtein). */
function abstand(a,b){a=norm(a);b=norm(b);const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
 let prev=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[n]}
/* Knapp daneben: 1 Fehler bei kurzen, bis 2 bei langen Wörtern. */
const knapp=(tipp,wort)=>{const d=abstand(tipp,wort);const L=norm(wort).length;return d>0&&d<=(L>=8?2:1)};
/* Maske für Rater: Leerzeichen und Bindestriche bleiben sichtbar, offen = Indizes der aufgedeckten Buchstaben. */
function maske(wort,offen){offen=offen||[];return [...wort].map((c,i)=>c===' '?'  ':c==='-'?'-':offen.includes(i)?c.toUpperCase():'_').join(' ')}
/* Welche Buchstaben man als Nächstes aufdecken darf (keine Leerzeichen, nicht schon offen). */
function naechsterHinweis(wort,offen){const frei=[...wort].map((c,i)=>/[\p{L}\p{N}]/u.test(c)&&!(offen||[]).includes(i)?i:-1).filter(i=>i>=0);
 const max=Math.floor(frei.length+(offen||[]).length)/2;if(!frei.length||(offen||[]).length>=Math.floor([...wort].filter(c=>/[\p{L}\p{N}]/u.test(c)).length/2))return null;
 return frei[Math.floor(Math.random()*frei.length)]}
function dreiWoerter(benutzt){const pool=WOERTER.filter(w=>!(benutzt||[]).includes(w[0]));const nimm=s=>{const p=pool.filter(w=>w[1]===s&&!out.includes(w[0]));return p.length?p[Math.floor(Math.random()*p.length)][0]:null};
 const out=[];for(const s of [1,2,3]){const w=nimm(s)||nimm(2)||nimm(1);if(w)out.push(w)}return out}

const API={WOERTER,norm,hashWort,abstand,knapp,maske,naechsterHinweis,dreiWoerter};
if(typeof module!=='undefined')module.exports=API;else root.WOERTER_API=API;
})(this);
