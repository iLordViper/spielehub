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
 ['Internet',3],['Musik',2],['Zeit',3],['Liebe',2],['Angst',3],['Traum',3],['Glück',3],['Urlaub',2],['Schule',2],['Hausaufgaben',3],['Montag',3],['Stau',3],['Kater',3],['Muskelkater',3],['Ohrwurm',3],['Faulpelz',3],['Schneeballschlacht',3],['Kissenschlacht',3],['Sonnenbrand',3],['Gänsehaut',3],

 /* ---- Erweiterung 22.11.2026 ---- */
 // Mehr Tiere
 ['Schaf',1],['Ziege',1],['Hahn',1],['Huhn',1],['Küken',1],['Gans',2],['Truthahn',2],['Esel',1],['Lama',2],['Kamel',2],['Nilpferd',2],['Nashorn',2],['Gorilla',2],['Panda',1],['Koala',2],['Faultier',2],['Waschbär',2],['Fuchs',1],['Wolf',1],['Reh',2],['Hirsch',2],['Elch',2],['Eichhörnchen',2],['Maulwurf',2],['Hamster',1],['Meerschweinchen',2],['Kaninchen',2],['Ratte',2],['Delfin',1],['Robbe',2],['Seestern',2],['Seepferdchen',2],['Krabbe',2],['Hummer',2],['Muschel',2],['Ameise',1],['Mücke',2],['Libelle',2],['Raupe',2],['Pfau',2],['Storch',2],['Specht',3],['Möwe',2],['Adler',2],['Strauß',2],['Tiger',1],['Leopard',2],['Dinosaurier',1],['Mammut',3],
 // Mehr Essen
 ['Brot',1],['Brötchen',1],['Butter',2],['Marmelade',2],['Müsli',2],['Pfannkuchen',2],['Waffel',2],['Keks',1],['Muffin',2],['Cupcake',2],['Lebkuchen',3],['Zuckerwatte',2],['Gummibär',2],['Nudeln',1],['Reis',2],['Kartoffel',1],['Salat',1],['Tomate',1],['Gurke',1],['Paprika',2],['Zwiebel',1],['Knoblauch',2],['Mais',1],['Erbse',2],['Kürbis',1],['Avocado',2],['Kokosnuss',2],['Birne',1],['Pflaume',2],['Weintraube',1],['Himbeere',2],['Blaubeere',2],['Mango',2],['Kiwi',2],['Orange',1],['Milch',1],['Saft',2],['Tee',1],['Limonade',2],['Milchshake',2],['Suppe',1],['Bratwurst',2],['Schnitzel',2],['Hähnchen',2],['Steak',2],['Taco',2],['Sandwich',2],['Lasagne',3],['Nachos',3],['Auflauf',3],
 // Fahrzeuge
 ['Bus',1],['Lkw',2],['Traktor',1],['Bagger',1],['Kran',2],['Feuerwehrauto',2],['Krankenwagen',2],['Polizeiauto',2],['Motorrad',1],['Taxi',2],['U-Boot',2],['Segelboot',2],['Kanu',2],['Floß',2],['Heißluftballon',2],['Zeppelin',3],['Ufo',1],['Straßenbahn',3],['Seilbahn',3],['Kinderwagen',2],['Rollstuhl',3],['Einrad',2],['Tandem',3],['Rennauto',2],['Wohnmobil',3],
 // Musik
 ['Klavier',2],['Geige',2],['Trompete',2],['Flöte',2],['Saxofon',3],['Harfe',2],['Xylofon',3],['Mundharmonika',3],['Dudelsack',3],['Triangel',2],['Noten',2],['Lautsprecher',2],['Plattenspieler',3],['Dirigent',3],['Sänger',2],['Band',3],
 // Haushalt & Dinge
 ['Sofa',1],['Sessel',2],['Schrank',2],['Spiegel',2],['Fenster',1],['Tür',1],['Treppe',1],['Dach',1],['Kamin',2],['Vorhang',2],['Teppich',2],['Wecker',2],['Bügeleisen',2],['Waschmaschine',2],['Mikrowelle',2],['Toaster',2],['Pfanne',1],['Topf',1],['Gabel',1],['Löffel',1],['Messer',1],['Teller',1],['Tasse',1],['Flasche',1],['Dose',2],['Korb',2],['Kiste',2],['Seife',2],['Handtuch',2],['Kissen',1],['Decke',2],['Wäscheklammer',3],['Nadel',2],['Faden',3],['Knopf',2],['Reißverschluss',3],['Schraube',2],['Nagel',2],['Säge',2],['Zange',2],['Schaufel',2],['Gießkanne',2],['Rasenmäher',2],['Schubkarre',2],['Briefkasten',2],['Brief',1],['Briefmarke',2],['Stift',1],['Radiergummi',2],['Lineal',2],['Tafel',2],['Globus',2],['Landkarte',2],['Laptop',2],['Tastatur',2],['Spielkonsole',2],['Fernbedienung',3],['Steckdose',2],['Kabel',2],['Pflaster',2],['Spritze',2],['Thermometer',2],['Zahnpasta',2],['Kamm',1],['Haarföhn',3],['Lippenstift',2],['Parfüm',3],['Ring',1],['Kette',2],['Armband',2],['Portemonnaie',3],['Geldschein',2],['Münze',1],['Sparschwein',2],['Tresor',3],['Schloss',2],['Fahne',1],['Pokal',2],['Medaille',2],['Zauberstab',2],['Bumerang',3],['Fallschirm',2],['Fernglas',2],['Teleskop',3],
 // Natur & Wetter
 ['Regen',1],['Schnee',1],['Hagel',3],['Nebel',3],['Gewitter',2],['Wind',2],['Sturm',2],['Eiszapfen',2],['Schneeflocke',1],['Pfütze',2],['Welle',1],['Meer',1],['See',2],['Fluss',2],['Teich',2],['Wald',1],['Wiese',2],['Feld',2],['Garten',2],['Hecke',3],['Palme',1],['Tanne',1],['Blatt',1],['Ast',2],['Wurzel',2],['Rose',1],['Sonnenblume',1],['Tulpe',2],['Kleeblatt',2],['Löwenzahn',2],['Erdbeben',3],['Komet',2],['Planet',1],['Mondfinsternis',3],['Sternschnuppe',2],['Polarlicht',3],['Eisberg',2],['Gletscher',3],['Lava',2],['Sandburg',2],
 // Orte & Gebäude
 ['Hochhaus',2],['Wolkenkratzer',2],['Iglu',1],['Hütte',2],['Baumhaus',2],['Scheune',2],['Mühle',2],['Windmühle',2],['Bauernhof',2],['Supermarkt',2],['Bäckerei',2],['Restaurant',3],['Café',3],['Friseur',2],['Bank',2],['Post',3],['Museum',3],['Bibliothek',3],['Stadion',2],['Schwimmbad',2],['Flughafen',2],['Hafen',2],['Tankstelle',2],['Parkhaus',3],['Gefängnis',2],['Rathaus',3],['Palast',2],['Tempel',3],['Ruine',3],['Friedhof',2],['Eiffelturm',2],['Freiheitsstatue',2],['Chinesische Mauer',3],['Schiefer Turm',3],['Weltall',2],['Nordpol',2],['Dschungel',2],['Oase',3],['Labyrinth',3],['Kreuzung',3],
 // Märchen & Fantasy
 ['Fee',2],['Elfe',2],['Zwerg',2],['Riese',2],['Troll',2],['Kobold',3],['Werwolf',2],['Mumie',2],['Monster',1],['Alien',1],['Engel',1],['Teufel',2],['Sensenmann',3],['Phönix',3],['Greif',3],['Zauberbesen',2],['Zaubertrank',2],['Kristallkugel',2],['Schatzkarte',2],['Wunderlampe',3],['Fliegender Teppich',3],['Froschkönig',3],['Rotkäppchen',2],['Schneewittchen',3],['Aschenputtel',3],['Rapunzel',3],['Hexenhaus',3],['Glücksfee',3],
 // Berufe & Menschen
 ['Lehrer',2],['Bäcker',2],['Bauer',2],['Gärtner',2],['Maler',2],['Fotograf',2],['Pilot',2],['Kapitän',2],['Matrose',3],['Soldat',2],['König',1],['Königin',2],['Prinz',2],['Bürgermeister',3],['Detektiv',2],['Dieb',2],['Spion',3],['Wissenschaftler',3],['Erfinder',3],['Tierarzt',2],['Zahnarzt',2],['Krankenschwester',2],['Briefträger',2],['Müllmann',2],['Bauarbeiter',2],['Mechaniker',3],['Friseurin',3],['DJ',2],['Influencer',3],['Youtuber',3],['Gamer',2],['Zwillinge',2],['Familie',2],['Opa',2],['Freunde',3],
 // Sport & Spiele
 ['Handball',2],['Volleyball',2],['Eishockey',2],['Tischtennis',2],['Badminton',3],['Reiten',2],['Klettern',2],['Joggen',2],['Radfahren',2],['Rudern',3],['Segeln',3],['Tauchen',2],['Schlittschuh',2],['Rodeln',3],['Snowboard',2],['Hantel',2],['Fitnessstudio',3],['Elfmeter',2],['Tor',1],['Schiedsrichter',2],['Pfeife',2],['Stoppuhr',2],['Ziel',3],['Hürde',3],['Turnen',3],['Kegeln',3],['Darts',2],['Billard',2],['Schach',2],['Domino',2],['Murmeln',3],['Seilspringen',2],['Verstecken',3],['Fangen',3],['Drachensteigen',3],['Sandkasten',2],['Wippe',2],['Hüpfburg',2],['Wasserrutsche',2],['Kartenspiel',3],
 // Tätigkeiten & Gefühle
 ['Schwitzen',3],['Frieren',3],['Rennen',2],['Klatschen',2],['Winken',2],['Pfeifen',3],['Singen',2],['Rufen',3],['Flüstern',3],['Schnarchen',2],['Träumen',3],['Essen',2],['Trinken',2],['Putzen',2],['Waschen',2],['Duschen',2],['Einkaufen',2],['Telefonieren',2],['Fotografieren',3],['Bauen',3],['Graben',3],['Werfen',2],['Fangen spielen',3],['Ausrutschen',3],['Stolpern',3],['Umarmen',2],['Küssen',2],['Streiten',3],['Verliebt',2],['Wütend',2],['Müde',2],['Hungrig',3],['Überrascht',3],['Gelangweilt',3],['Erschrocken',3],['Eifersüchtig',3],
 // Feiern & Jahreszeiten
 ['Frühling',2],['Sommer',2],['Herbst',2],['Winter',2],['Ostern',2],['Karneval',2],['Oktoberfest',3],['Party',2],['Disco',2],['Kostüm',2],['Maske',2],['Konfetti',2],['Geburtstagskuchen',2],['Adventskranz',3],['Weihnachtsbaum',2],['Lebkuchenhaus',3],['Rentier',2],['Schlitten',2],['Osterei',2],['Laterne',2],['Zuckertüte',3],['Zeugnis',3],['Ferien',3],['Klassenfahrt',3],
 // Redewendungen (schwer, aber lustig)
 ['Schwein haben',3],['Tomaten auf den Augen',3],['Die Katze im Sack',3],['Ins Fettnäpfchen treten',3],['Auf Wolke sieben',3],['Den Kopf verlieren',3],['Zwei Fliegen mit einer Klappe',3],['Nur Bahnhof verstehen',3],['Die Nadel im Heuhaufen',3],['Ein Brett vor dem Kopf',3],['Eulen nach Athen tragen',3],['Hals- und Beinbruch',3],['Kalte Füße bekommen',3],['Jemandem die Daumen drücken',3],['Mit dem Kopf durch die Wand',3],['Der Elefant im Raum',3],['Luftschlösser bauen',3],['Ein Herz und eine Seele',3],['Den Nagel auf den Kopf treffen',3],['Alles in Butter',3]
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
