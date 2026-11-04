const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const MAX_PLAYERS = 4;

// LAN addresses so friends on the same network can join the co-op room.
function lanAddresses() {
  const list = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const net of entries || []) if (net.family === 'IPv4' && !net.internal) list.push(net.address);
  }
  return list;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ port, addresses: lanAddresses(), maxPlayers: MAX_PLAYERS }));
    return;
  }
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// ---------------------------------------------------------------------------
// Minimal WebSocket (RFC 6455) relay for co-op rooms — no external packages.
// The host's browser runs the enemies; the server only routes JSON messages.
// ---------------------------------------------------------------------------
const rooms = new Map();
let nextPeerId = 1;

function frame(text) {
  const payload = Buffer.from(text);
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x81, n])
    : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255])
    : (() => { const b = Buffer.alloc(10); b[0] = 0x81; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([head, payload]);
}

function send(peer, message) {
  if (peer.socket.destroyed) return;
  peer.socket.write(typeof message === 'string' ? frame(message) : frame(JSON.stringify(message)));
}

function roomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do { code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

function roster(room) {
  return [...room.peers.values()].map(p => ({ id: p.id, name: p.name, slot: p.slot, host: p === room.host }));
}

function leave(peer) {
  const room = peer.room;
  if (!room) return;
  peer.room = null;
  room.peers.delete(peer.id);
  if (room.host === peer) {
    for (const other of room.peers.values()) { send(other, { t: 'host-left' }); other.room = null; }
    rooms.delete(room.code);
    return;
  }
  for (const other of room.peers.values()) send(other, { t: 'peer-leave', id: peer.id, players: roster(room) });
}

function cleanName(name) {
  return String(name || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Ninja';
}

function handle(peer, text) {
  let msg;
  try { msg = JSON.parse(text); } catch { return; }
  if (!msg || typeof msg.t !== 'string') return;
  if (msg.t === 'create') {
    leave(peer);
    const room = { code: roomCode(), host: peer, peers: new Map() };
    rooms.set(room.code, room);
    peer.name = cleanName(msg.name); peer.slot = 0; peer.room = room;
    room.peers.set(peer.id, peer);
    send(peer, { t: 'created', code: room.code, id: peer.id, players: roster(room) });
    return;
  }
  if (msg.t === 'join') {
    const room = rooms.get(String(msg.code || '').toUpperCase().trim());
    if (!room) { send(peer, { t: 'error', text: 'Không tìm thấy phòng này.' }); return; }
    if (room.peers.size >= MAX_PLAYERS) { send(peer, { t: 'error', text: `Phòng đã đủ ${MAX_PLAYERS} người.` }); return; }
    leave(peer);
    const used = new Set([...room.peers.values()].map(p => p.slot));
    peer.slot = [0, 1, 2, 3].find(s => !used.has(s));
    peer.name = cleanName(msg.name); peer.room = room;
    room.peers.set(peer.id, peer);
    send(peer, { t: 'joined', code: room.code, id: peer.id, hostId: room.host.id, players: roster(room) });
    for (const other of room.peers.values()) if (other !== peer)
      send(other, { t: 'peer-join', id: peer.id, name: peer.name, slot: peer.slot, players: roster(room) });
    return;
  }
  if (msg.t === 'leave') { leave(peer); return; }
  // Game traffic: relay to one peer, the host, or everyone else in the room.
  const room = peer.room;
  if (!room) return;
  msg.from = peer.id;
  const out = JSON.stringify(msg);
  if (msg.to === 'host') { if (room.host !== peer) send(room.host, out); return; }
  if (typeof msg.to === 'number') { const target = room.peers.get(msg.to); if (target) send(target, out); return; }
  for (const other of room.peers.values()) if (other !== peer) send(other, out);
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.url || '').split('?')[0] !== '/coop') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const peer = { id: nextPeerId++, socket, room: null, name: 'Ninja', slot: 0 };
  let buffer = Buffer.alloc(0);
  let fragments = [];
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const fin = buffer[0] & 0x80, opcode = buffer[0] & 0x0f;
      const masked = buffer[1] & 0x80;
      let length = buffer[1] & 0x7f, offset = 2;
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
      if (length > 8 * 1024 * 1024) { socket.destroy(); return; }
      const maskOffset = offset;
      if (masked) offset += 4;
      if (buffer.length < offset + length) return;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      if (masked) for (let i = 0; i < length; i++) payload[i] ^= buffer[maskOffset + (i & 3)];
      buffer = buffer.subarray(offset + length);
      if (opcode === 0x8) { socket.end(Buffer.from([0x88, 0])); return; }
      if (opcode === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (opcode === 0xa) continue;
      if (opcode === 0x1 || opcode === 0x0) {
        fragments.push(payload);
        if (fin) { const text = Buffer.concat(fragments).toString('utf8'); fragments = []; handle(peer, text); }
      }
    }
  });
  socket.on('close', () => leave(peer));
  socket.on('error', () => leave(peer));
});

// Listen on every interface so other machines on the LAN can join co-op rooms.
server.listen(port, '0.0.0.0', () => {
  console.log(`Shinobi Siege dang chay tai http://localhost:${port}`);
  for (const address of lanAddresses()) console.log(`  Ban be cung mang LAN vao: http://${address}:${port}`);
  console.log('Nhan Ctrl+C de dung server.');
  if (process.env.SHINOBI_OPEN_BROWSER === '1' && process.platform === 'win32') {
    exec(`start "" "http://localhost:${port}"`);
  }
});
