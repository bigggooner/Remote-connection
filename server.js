// WebSocket signaling + short-lived TURN credential API.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const PORT = Number(process.env.PORT || 8080);
const WEB = path.join(__dirname, 'web');
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
const TURN_SECRET = process.env.TURN_SECRET || '';
const TURN_URLS = (process.env.TURN_URLS || '').split(',').map(x => x.trim()).filter(Boolean);
const TURN_TTL_SECONDS = Math.max(300, Math.min(86400, Number(process.env.TURN_TTL_SECONDS || 86400)));
const rooms = new Map(), joinAttempts = new Map(), turnAttempts = new Map();
function originAllowed(origin) { return !origin || allowedOrigins.includes(origin); }
function json(res,status,body) { res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(body)); }
function rateLimited(store,key,limit,windowMs) { const now=Date.now(), recent=(store.get(key)||[]).filter(t=>now-t<windowMs); recent.push(now); store.set(key,recent); return recent.length>limit; }
function turnCredentials() { const username = String(Math.floor(Date.now()/1000)+TURN_TTL_SECONDS)+':'+crypto.randomBytes(8).toString('hex'); return {username,credential:crypto.createHmac('sha1',TURN_SECRET).update(username).digest('base64')}; }
const server = http.createServer((req,res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') return json(res,200,{ok:true,turnConfigured:!!TURN_SECRET&&TURN_URLS.length>0,rooms:rooms.size});
  if (url.pathname === '/api/turn-credentials') {
    const origin=req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin'); }
    res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
    if (req.method==='OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method!=='GET') return json(res,405,{error:'Method not allowed'});
    if (!originAllowed(origin)) return json(res,403,{error:'Origin not allowed'});
    const ip=req.socket.remoteAddress||'unknown';
    if (rateLimited(turnAttempts,ip,60,60000)) return json(res,429,{error:'Too many requests'});
    if (!TURN_SECRET||!TURN_URLS.length) return json(res,503,{error:'TURN is not configured'});
    return json(res,200,{iceServers:[{urls:TURN_URLS,...turnCredentials()},{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}],expiresIn:TURN_TTL_SECONDS});
  }
  let pathname;
  try { pathname=decodeURIComponent(url.pathname); } catch { return json(res,400,{error:'Bad path'}); }
  if (pathname === '/') pathname='/index.html';
  const full=path.resolve(WEB,'.'+pathname);
  if (!full.startsWith(WEB+path.sep) && full!==WEB) return json(res,403,{error:'Forbidden'});
  fs.readFile(full,(err,data)=>{
    if(err) return json(res,404,{error:'Not found'});
    res.writeHead(200,{'content-type':MIME[path.extname(full)]||'application/octet-stream','cache-control':'no-cache'});
    res.end(data);
  });
});
const wss=new WebSocket.Server({server,maxPayload:65536});
function send(ws,payload) { if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(payload)); }
function leave(ws) { if(!ws.room)return; const peers=rooms.get(ws.room); if(peers){peers.delete(ws);for(const peer of peers)send(peer,{type:'peer-left'});if(!peers.size)rooms.delete(ws.room);} ws.room=null; }
wss.on('connection',(ws,req)=>{
  const origin=req.headers.origin; if(!originAllowed(origin))return ws.close(1008,'Origin not allowed');
  const ip=req.socket.remoteAddress||'unknown';
  ws.on('message',raw=>{
    let msg;try{msg=JSON.parse(raw.toString());}catch{return send(ws,{type:'error',message:'Invalid message'});}
    if(msg.type==='join'){
      if(rateLimited(joinAttempts,ip,24,60000))return send(ws,{type:'error',message:'Too many connection attempts'});
      const room=String(msg.room||'').trim().toUpperCase(),role=msg.role;
      if(!/^[A-Z0-9]{6,32}$/.test(room)||!['host','controller'].includes(role))return send(ws,{type:'error',message:'Invalid room code or role'});
      leave(ws);const peers=rooms.get(room)||new Set();
      if(peers.size>=2)return send(ws,{type:'error',message:'Session is full'});
      if([...peers].some(p=>p.role===role))return send(ws,{type:'error',message:'A participant with this role is already connected'});
      const existing=[...peers];ws.room=room;ws.role=role;peers.add(ws);rooms.set(room,peers);
      send(ws,{type:'joined',room,peers:existing.length,peerRole:existing[0]?.role||null});
      for(const peer of existing)send(peer,{type:'peer-joined',role});return;
    }
    if(msg.type==='signal'&&ws.room)for(const peer of rooms.get(ws.room)||[])if(peer!==ws)send(peer,{type:'signal',from:ws.role,data:msg.data});
  });
  ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},25000);
wss.on('connection',ws=>{ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true;});});
server.listen(PORT,'0.0.0.0',()=>console.log('Signaling server listening on '+PORT));
server.on('close',()=>clearInterval(heartbeat));
