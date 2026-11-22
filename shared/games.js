/* ==========================================================================
   SPIELE-HUB · SPIELELISTE (games.js)
   --------------------------------------------------------------------------
   Jedes Spiel im Hub ist hier EIN Eintrag. Der Hub baut daraus automatisch:
   die Spielkachel auf der Startseite, den Reiter in der Rangliste und die
   Werte auf der Profilseite.

   Felder eines Eintrags:
     id        Kurzname, nur Kleinbuchstaben/Ziffern/Bindestrich. Gleich dem Ordnernamen.
     name      Anzeigename.
     emoji     Symbol auf der Kachel.
     pfad      Ordner relativ zum Hub, mit Schrägstrich am Ende, z. B. 'brainclash/'.
     status    'live'  = spielbar
               'bald'  = Kachel wird als „kommt bald“ gezeigt, nicht anklickbar.
     kurz      Ein Satz, was man dort macht.
     tags      2–4 kurze Stichworte für die Kachel.
     farbe     [Verlauf-Start, Verlauf-Ende, Schattenfarbe] der Kachel.
     dunkleSchrift  true, wenn die Kachel hell ist (wie Gold) und dunkle Schrift braucht.
     spielstand  true = das Spiel speichert seine Werte in einem eigenen Dokument
               spielstand/{id}/spieler/{uid} (so sollen ALLE neuen Spiele es machen).
               Der Hub liest diese Dokumente dann automatisch mit.
               Brainclash ist die Ausnahme: Es schreibt seine Werte direkt ins Profil.
     punkte(p, s) Funktion: Wie viele Punkte hat der Spieler in diesem Spiel?
               p = gemeinsames Profil, s = eigener Spielstand dieses Spiels ({} wenn keiner).
               Zählt für die Gesamtpunkte, das Hub-Level und die Rangliste.
     werte(p, s)  Funktion: Liste [Wert, Beschriftung] für die Profilseite (3 oder 6 Stück).

   Warum eigene Spielstand-Dokumente? Brainclash speichert beim Sichern immer
   sein ganzes Profil-Dokument neu. Würde ein anderes Spiel seine Werte auch
   ins Profil schreiben, könnte Brainclash sie mit einem alten Stand überschreiben.

   So fügst du ein Spiel hinzu: siehe docs/spiel-hinzufuegen.md
   ========================================================================== */
const GAMES=[
 {
  id:'brainclash',
  name:'Brainclash',
  emoji:'🧠',
  pfad:'brainclash/',
  status:'live',
  kurz:'Quiz-Duelle gegen Freunde, Live-Duell, Party mit bis zu 8 Leuten und Schätzfragen.',
  tags:['⚔️ Duelle','⚡ Live','🎉 Party','🔢 1×1'],
  farbe:['#FF6B57','#E2365A','#8F1C33'],
  /* Brainclash speichert seine Werte direkt im Profil (points, wins, …). */
  punkte:p=>p.points||0,
  werte:p=>[
   [fmt(p.points),'Punkte'],
   [p.wins||0,'Siege'],
   [(p.answered?Math.round(100*(p.correct||0)/p.answered):0)+' %','Treffer'],
   [p.bestTower||0,'Beste Etage'],
   [fmt(p.bestMath),'Rechnen'],
   [p.losses||0,'Niederlagen']
  ]
 }
 /* Nächstes Spiel hier anhängen, z. B.:
 ,{
  id:'wortjagd', name:'Wortjagd', emoji:'🔤', pfad:'wortjagd/', status:'bald',
  kurz:'Finde in 60 Sekunden so viele Wörter wie möglich.',
  tags:['⏱️ 60 Sek.','👥 Rangliste'],
  farbe:['#3D8BFF','#2753C9','#162F7A'],
  spielstand:true,
  punkte:(p,s)=>s.punkte||0,
  werte:(p,s)=>[[fmt(s.punkte),'Punkte'],[s.runden||0,'Runden'],[s.rekord||0,'Rekord']]
 }
 */
];
const GAME=Object.fromEntries(GAMES.map(g=>[g.id,g]));
/* STAND[spielId][uid] = eigener Spielstand (füllt der Hub beim Start). */
const STAND={};
const standOf=(g,uid)=>(STAND[g.id]&&STAND[g.id][uid])||{};
const gamePoints=(g,p,uid)=>Number(g.punkte(p||{},standOf(g,uid)))||0;
/* Gesamtpunkte eines Spielers über alle Spiele. */
const totalPoints=(p,uid)=>GAMES.reduce((s,g)=>s+gamePoints(g,p,uid),0);
