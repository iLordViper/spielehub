/* ==========================================================================
   SPIELE-HUB · HUB-ERFOLGE (erfolge.js)
   --------------------------------------------------------------------------
   Spielübergreifende Erfolge fürs Hauptprofil. Sie werden aus den gespeicherten
   Werten ALLER Spiele berechnet (nichts Extra wird gespeichert) – darum gehen
   sie nie verloren und zählen auch rückwirkend.

   Ein Eintrag: [id, Symbol, Name, Beschreibung, Ziel, wert(k)]
     wert(k) liefert den aktuellen Stand, Erfolg = wert >= Ziel.
     k = {p, uid, punkte, level, muenzen, siege, gespielt, stand(spielId)}

   So fügst du einen Erfolg hinzu: Zeile an HUB_ERFOLGE anhängen.
   ========================================================================== */
const HUB_ERFOLGE=[
 ['club','🎮','Neu im Club','Charakter angelegt',1,k=>k.p&&k.p.name?1:0],
 ['entdecker','🧭','Entdecker','2 verschiedene Spiele gespielt',2,k=>k.gespielt],
 ['allrounder','🏅','Allrounder','Jedes Spiel im Hub gespielt',GAMES.filter(g=>g.status==='live').length,k=>k.gespielt],
 ['sieg1','⚔️','Erster Sieg','Ein Spiel gewonnen',1,k=>k.siege],
 ['sieg10','🔥','Seriensieger','10 Siege gesamt',10,k=>k.siege],
 ['sieg50','👑','Champion','50 Siege gesamt',50,k=>k.siege],
 ['m25','🪙','Sparschwein','25 Münzen verdient',25,k=>k.muenzen],
 ['m100','💰','Münzberg','100 Münzen verdient',100,k=>k.muenzen],
 ['m500','🏦','Schatzmeister','500 Münzen verdient',500,k=>k.muenzen],
 ['lvl5','⭐','Aufsteiger','Hub-Level 5',5,k=>k.level],
 ['lvl10','🌟','Stammgast','Hub-Level 10',10,k=>k.level],
 ['lvl20','💫','Legende','Hub-Level 20',20,k=>k.level],
 ['quiz','🧠','Quizkopf','1.000 Punkte in Brainclash',1000,k=>(k.p&&k.p.points)||0],
 ['pasch','🎲','Fünferpasch!','Einen Fünferpasch eingetragen',1,k=>k.stand('wuerfelclash').fuenfer||0],
 ['rekord','📜','Würfelkönig','250 Punkte in einem Würfelclash-Spiel',250,k=>k.stand('wuerfelclash').rekord||0],
 ['live','🤝','Herausforderer','Ein Live-Würfelduell gewonnen',1,k=>k.stand('wuerfelclash').liveSiege||0],
 ['blick','👀','Scharfer Blick','25 Begriffe in Kritzelclash erraten',25,k=>k.stand('kritzelclash').erraten||0],
 ['kuenstler','🎨','Künstler','20 Bilder in Kritzelclash gemalt',20,k=>k.stand('kritzelclash').gemalt||0],
 ['ass','⛳','Hole-in-One!','Eine Minigolf-Bahn mit einem Schlag',1,k=>k.stand('puttclash').holeInOne||0],
 ['golfweltreise','🌍','Weltreise','Alle 6 Puttclash-Plätze durchgespielt',6,k=>Object.keys(k.stand('puttclash').plaetzeFertig||{}).length]
];
/* Kontext für einen Spieler bauen und alle Erfolge auswerten. */
function erfolgeVon(p,uid){
 const punkte=totalPoints(p,uid);
 const k={p,uid,punkte,level:levelFor(punkte),muenzen:totalMuenzen(p,uid),siege:totalSiege(p,uid),
  gespielt:GAMES.filter(g=>g.status==='live'&&gamePoints(g,p,uid)>0).length,stand:id=>standOf(GAME[id]||{id},uid)};
 return HUB_ERFOLGE.map(([id,ic,name,desc,ziel,fn])=>{const w=Math.max(0,Number(fn(k))||0);return{id,ic,name,desc,ziel,wert:Math.min(w,ziel),ok:w>=ziel}});
}
