/* Prüft die Wertung von Würfelclash.  Start:  node wuerfelclash/regeln.test.js
   Bei Regeländerungen hier die erwarteten Werte mit anpassen. */
const R=require('./regeln.js');
let ok=0,bad=0;
const t=(name,ist,soll)=>{if(ist===soll)ok++;else{bad++;console.log(`FEHLER ${name}: ist ${ist}, soll ${soll}`)}};
t('Einser',R.punkte('e1',[1,1,3,4,1]),3);
t('Sechser',R.punkte('e6',[6,6,6,2,1]),18);
t('Dreierpasch ja',R.punkte('dp',[3,3,3,4,5]),18);
t('Dreierpasch nein',R.punkte('dp',[3,3,2,4,5]),0);
t('Viererpasch ja',R.punkte('vp',[2,2,2,2,6]),14);
t('Viererpasch nein',R.punkte('vp',[2,2,2,5,6]),0);
t('Full House',R.punkte('fh',[2,2,3,3,3]),25);
t('Full House nein',R.punkte('fh',[2,2,3,3,4]),0);
t('Fünf gleiche sind kein Full House ohne Joker',R.punkte('fh',[4,4,4,4,4],{}),0);
t('Kleine Straße 1234',R.punkte('ks',[1,2,3,4,6]),30);
t('Kleine Straße 3456 mit Doppel',R.punkte('ks',[3,4,4,5,6]),30);
t('Kleine Straße nein',R.punkte('ks',[1,2,3,5,6]),0);
t('Große Straße',R.punkte('gs',[2,3,4,5,6]),40);
t('Große Straße nein',R.punkte('gs',[1,2,3,4,6]),0);
t('Fünferpasch',R.punkte('fp',[5,5,5,5,5]),50);
t('Chance',R.punkte('ch',[1,2,3,4,6]),16);
// Original-Regeln: kein Joker, kein Extra-Bonus
t('Original: kein Joker',R.punkte('fh',[4,4,4,4,4],{fp:50,e4:16}),0);
t('Original: kein Extra-Bonus',R.extraBonus([2,2,2,2,2],{fp:50}),false);
const s=R.summen({e1:3,e2:6,e3:9,e4:12,e5:15,e6:18,ch:20},0);
t('Bonus oben ab 63',s.bonus,35);t('Gesamt',s.gesamt,63+35+20);
// Berater
const T=R.tipp([2,3,4,5,6],{},2);t('Tipp Große Straße',T.feld,'gs');t('Tipp Große Straße alle halten',T.halten.length,5);
t('Tipp Straße halten',R.tipp([1,2,3,4,6],{ks:30},2).halten.length,4);
t('Tipp Drilling halten',R.tipp([5,5,5,2,1],{},2).halten.join(),'0,1,2');
t('Tipp Full House',R.tipp([3,3,6,6,6],{},1).feld,'fh');
t('Tipp zwei Paare',R.tipp([2,2,4,4,1],{},2).halten.length,4);
t('Tipp letzte Runde Feld frei',R.tipp([1,1,2,3,5],{},0).feld!==null,true);
const voll=Object.fromEntries(R.FELDER.map(f=>[f,0]));delete voll.ch;
t('Tipp nur Chance frei',R.tipp([1,1,2,3,5],voll,0).feld,'ch');
t('Kein Bonus bei 62',R.summen({e6:30,e5:25,e2:7}).bonus,0);
t('Fertig',R.fertig(Object.fromEntries(R.FELDER.map(f=>[f,0]))),true);
console.log(`${ok} Prüfungen bestanden, ${bad} fehlgeschlagen`);process.exit(bad?1:0);
