/* ==========================================================================
   LOKAL TESTEN (tools/lokal-testen.js)
   --------------------------------------------------------------------------
   Kleiner Webserver, damit du den Hub vor dem Hochladen im Browser ansehen kannst.
   Start (im Ordner spielehub):   node tools/lokal-testen.js
   Dann öffnen:                   http://localhost:8080/?demo
   ?demo = Testmodus ohne Datenbank mit Beispielspielern (empfohlen).
   Ohne ?demo verbindet sich der Hub mit der ECHTEN Datenbank deiner Freunde.
   Brainclash selbst hat keinen Testmodus und nutzt immer die echte Datenbank.
   Beenden: Strg+C
   ========================================================================== */
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');const PORT=Number(process.env.PORT)||8080;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 let p=decodeURIComponent(req.url.split('?')[0].split('#')[0]);
 let f=path.normalize(path.join(ROOT,p));
 if(!f.startsWith(ROOT)){res.writeHead(403);return res.end()}
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory()){
  if(!p.endsWith('/')){res.writeHead(301,{Location:p+'/'});return res.end()}
  f=path.join(f,'index.html');
 }
 fs.readFile(f,(err,data)=>{
  if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Nicht gefunden: '+p)}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 });
}).listen(PORT,()=>console.log(`Spiele-Hub läuft: http://localhost:${PORT}/?demo`));
