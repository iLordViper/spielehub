/* ==========================================================================
   DATENSICHERUNG (tools/datensicherung.mjs)
   --------------------------------------------------------------------------
   Liest alle Spielerdaten aus der Firebase-Datenbank und speichert sie als
   JSON-Dateien auf diesem PC. Ändert und löscht nichts in der Datenbank.

   Start (im Ordner spielehub):   node tools/datensicherung.mjs
   Ziel:  Documents\spielehub-sicherungen\daten-JJJJ-MM-TT_HH-MM\<sammlung>.json

   Gesichert werden: profiles, presence, duels (+ duelchat), live, party, lobby,
   spielstand/<spiel>/spieler, partien/<spiel>/liste (+ chat).
   Die Sicherung meldet sich dafür anonym an (wie ein neuer Browser).
   ========================================================================== */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const KEY='AIzaSyAsPXT4DURd4zJIAr1WJnGx0qdUYKOsD4I',PROJ='brainclash-7f1b0';
const SPIELE=['brainclash','wuerfelclash','kritzelclash']; // bei neuen Spielen ergänzen (Zeichenstriche werden nicht gesichert)
const BASE=`https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents`;
const HDR={'Content-Type':'application/json','Referer':'http://localhost:8080/'};
const fromV=v=>'nullValue' in v?null:'booleanValue' in v?v.booleanValue:'integerValue' in v?Number(v.integerValue):'doubleValue' in v?v.doubleValue:'stringValue' in v?v.stringValue:'timestampValue' in v?v.timestampValue:'arrayValue' in v?(v.arrayValue.values||[]).map(fromV):'mapValue' in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,fromV(x)])):null;
const anmeldung=await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,{method:'POST',headers:HDR,body:JSON.stringify({returnSecureToken:true})})).json();
if(!anmeldung.idToken){console.error('Anmeldung fehlgeschlagen',anmeldung);process.exit(1)}
const auth={...HDR,Authorization:'Bearer '+anmeldung.idToken};
async function liste(pfad){const out=[];let token='';do{const r=await fetch(`${BASE}/${pfad}?pageSize=300${token?'&pageToken='+token:''}`,{headers:auth});const j=await r.json();if(j.error){if(j.error.code!==404)console.warn(pfad,j.error.message);break}
 (j.documents||[]).forEach(d=>out.push({_id:d.name.split('/').pop(),_pfad:d.name.split('/documents/')[1],_geaendert:d.updateTime,...Object.fromEntries(Object.entries(d.fields||{}).map(([k,x])=>[k,fromV(x)]))}));token=j.nextPageToken||''}while(token);return out}
const st=new Date();const stamp=`${st.getFullYear()}-${String(st.getMonth()+1).padStart(2,'0')}-${String(st.getDate()).padStart(2,'0')}_${String(st.getHours()).padStart(2,'0')}-${String(st.getMinutes()).padStart(2,'0')}`;
const ziel=path.join(os.homedir(),'Documents','spielehub-sicherungen',`daten-${stamp}`);fs.mkdirSync(ziel,{recursive:true});
const schreibe=(name,daten)=>{fs.writeFileSync(path.join(ziel,name+'.json'),JSON.stringify(daten,null,1));console.log(`${name}: ${daten.length}`)};
for(const s of ['profiles','presence','duels','live','party','lobby'])schreibe(s,await liste(s));
const duels=await liste('duels');const dc=[];for(const d of duels)dc.push(...await liste(`duelchat/${d._id}/msgs`));schreibe('duelchat',dc);
for(const g of SPIELE){schreibe(`spielstand_${g}`,await liste(`spielstand/${g}/spieler`));const p=await liste(`partien/${g}/liste`);schreibe(`partien_${g}`,p);const c=[];for(const x of p)c.push(...await liste(`partien/${g}/liste/${x._id}/chat`));schreibe(`partien_${g}_chat`,c)}
fs.writeFileSync(path.join(ziel,'LIESMICH.txt'),`Datensicherung der Spiele-Hub-Datenbank (Firebase ${PROJ}) vom ${st.toLocaleString('de-DE')}.\nJede Datei = eine Sammlung, jeder Eintrag = ein Dokument (_pfad = Ort in der Datenbank).\nNur lesen – zum Wiederherstellen einzelne Werte in der Firebase-Konsole eintragen.\n`);
console.log('Gesichert nach',ziel);
