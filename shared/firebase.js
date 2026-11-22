/* ==========================================================================
   SPIELE-HUB · FIREBASE-ANBINDUNG (firebase.js)
   --------------------------------------------------------------------------
   Verbindet Hub und Spiele mit der gemeinsamen Datenbank (Firebase-Projekt
   „brainclash-7f1b0“, dasselbe wie die bisherige Brainclash-Seite).

   Anmeldung: unsichtbar und anonym. Firebase merkt sich pro Browser eine
   Spieler-ID (uid). Alle Seiten unter ilordviper.github.io teilen sich diesen
   Speicher, deshalb haben Hub, Brainclash und die alte Brainclash-Adresse
   dieselbe uid und damit dasselbe Profil.

   Die Konfiguration unten ist für Web-Apps öffentlich gedacht. Geschützt
   werden die Daten durch die Regeln in firestore.rules.

   ACHTUNG: Brainclash hat dieselbe Konfiguration noch einmal oben in
   brainclash/index.html (FIREBASE_CONFIG_RAW). Bei einem Projektwechsel beide
   Stellen ändern.

   Benutzung:
     const fb = await HubFirebase.start();   // {fs, uid} oder null bei Fehler
     HubFirebase.presence(fs, uid, ids => …) // meldet „online“ und liefert
                                             // die uids der anderen online
   ========================================================================== */
const HUB_FIREBASE_CONFIG={
  apiKey:"AIzaSyAsPXT4DURd4zJIAr1WJnGx0qdUYKOsD4I",
  authDomain:"brainclash-7f1b0.firebaseapp.com",
  projectId:"brainclash-7f1b0",
  storageBucket:"brainclash-7f1b0.firebasestorage.app",
  messagingSenderId:"727895383247",
  appId:"1:727895383247:web:ff901cdba7699c32db6bba"
};
/* Gleiche Firebase-Version wie in Brainclash. */
const HUB_FIREBASE_VERSION='10.14.1';

const HubFirebase={
 error:null,
 _load(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})},

 /* Lädt Firebase, meldet anonym an. Gibt {fs, uid} zurück oder null (offline / Fehler). */
 async start(){
  try{
   const V=HUB_FIREBASE_VERSION;
   await this._load(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`);
   await Promise.all([this._load(`https://www.gstatic.com/firebasejs/${V}/firebase-auth-compat.js`),this._load(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore-compat.js`)]);
   if(!firebase.apps.length)firebase.initializeApp(HUB_FIREBASE_CONFIG);
   const auth=firebase.auth();
   /* Warten auf die anonyme Anmeldung. Nach 25 s geht die Seite erst mal offline.
      Kommt die Anmeldung danach doch noch an (langsames Netz, gebremster Tab),
      lädt die Seite sich EINMAL neu und ist dann online. */
   const user=await new Promise(res=>{let done=false;const fin=u=>{if(!done){done=true;res(u)}else if(u){try{if(!sessionStorage.getItem('hub_spaet')){sessionStorage.setItem('hub_spaet','1');location.reload()}}catch(e){}}};
    auth.onAuthStateChanged(u=>{if(u)fin(u);else auth.signInAnonymously().catch(e=>{console.error(e);this.error=e.code||e.message;fin(null)})});
    setTimeout(()=>fin(null),25000)});
   if(!user)return null;
   try{sessionStorage.removeItem('hub_spaet')}catch(e){}
   return{fs:firebase.firestore(),uid:user.uid};
  }catch(e){console.error(e);this.error=this.error||'load';return null}
 },

 /* Online-Anzeige. Funktioniert genau wie in Brainclash:
    Jeder schreibt alle 30 s presence/{uid} = {uid, at}. Wer in den letzten
    80 s ein Lebenszeichen gegeben hat, gilt als online – egal ob im Hub oder
    in einem Spiel. onChange bekommt ein Set mit den uids der ANDEREN. */
 presence(fs,uid,onChange){
  const ref=fs.collection('presence').doc(uid);let last=[];
  const beat=()=>ref.set({uid,at:Date.now()}).catch(()=>{});
  beat();setInterval(()=>{if(document.visibilityState==='visible')beat()},30000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')beat()});
  addEventListener('pagehide',()=>{ref.set({uid,at:0}).catch(()=>{})});
  const emit=()=>{const now=Date.now();onChange(new Set(last.filter(p=>p&&p.uid!==uid&&now-p.at<80000).map(p=>p.uid)))};
  fs.collection('presence').where('at','>',Date.now()-6*3600e3).onSnapshot(s=>{last=s.docs.map(d=>d.data());emit()},()=>{});
  setInterval(emit,20000);
 }
};
