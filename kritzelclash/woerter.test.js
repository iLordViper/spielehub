/* Prüft Wortliste und Rate-Prüfung von Kritzelclash.  Start: node kritzelclash/woerter.test.js */
const W=require('./woerter.js');
let ok=0,bad=0;const t=(n,ist,soll)=>{if(ist===soll)ok++;else{bad++;console.log(`FEHLER ${n}: ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`)}};
(async()=>{
 t('norm Umlaut',W.norm('Würfel!'),'wuerfel');t('norm ß',W.norm('Fußball'),'fussball');t('norm Leerzeichen',W.norm(' Heißer  Ofen '),'heisserofen');
 t('gleicher Hash',await W.hashWort('x','Würfel'),await W.hashWort('x','wuerfel'));
 t('anderer Raum anderer Hash',(await W.hashWort('a','Katze'))===(await W.hashWort('b','Katze')),false);
 t('Abstand 0',W.abstand('Katze','katze'),0);t('Abstand 1',W.abstand('Kaze','Katze'),1);
 t('knapp',W.knapp('Kaze','Katze'),true);t('nicht knapp richtig',W.knapp('Katze','Katze'),false);t('nicht knapp weit',W.knapp('Hund','Katze'),false);
 t('knapp lang 2 Fehler',W.knapp('Schmeterlin','Schmetterling'),true);
 t('Maske',W.maske('Eis',[]),'_ _ _');t('Maske offen',W.maske('Eis',[1]),'_ I _');
 const drei=W.dreiWoerter([]);t('drei Wörter',drei.length,3);t('drei verschiedene',new Set(drei).size,3);
 const doppelt=W.WOERTER.map(w=>W.norm(w[0])).filter((w,i,a)=>a.indexOf(w)!==i);t('keine doppelten Wörter',doppelt.join(','),'');
 t('genug Wörter',W.WOERTER.length>=200,true);
 let h=[];for(let k=0;k<10;k++){const i=W.naechsterHinweis('Katze',h);if(i===null)break;h.push(i)}t('höchstens Hälfte aufgedeckt',h.length,2);
 console.log(`${ok} Prüfungen bestanden, ${bad} fehlgeschlagen (${W.WOERTER.length} Wörter)`);process.exit(bad?1:0);
})();
