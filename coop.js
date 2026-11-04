// Co-op transport and lobby for Shinobi Siege (up to 4 players per room).
// server.js relays JSON over a WebSocket at /coop; game.js owns the gameplay sync.
(() => {
  'use strict';

  const COLORS = ['#ffb43a', '#5fc8ff', '#8fd062', '#ff6f91'];
  const state = { ws: null, id: 0, hostId: 0, code: '', role: 'solo', players: [], maxPlayers: 4 };
  const listeners = [];
  const $ = id => document.getElementById(id);

  function emit(msg) { for (const fn of listeners) fn(msg); }

  function connect() {
    if (state.ws && state.ws.readyState <= 1) {
      return state.ws.readyState === 1 ? Promise.resolve(state.ws)
        : new Promise((ok, fail) => { state.ws.addEventListener('open', () => ok(state.ws), { once: true }); state.ws.addEventListener('error', fail, { once: true }); });
    }
    if (location.protocol !== 'http:' && location.protocol !== 'https:')
      return Promise.reject(new Error('Co-op cần chạy qua start.bat (Node.js), không mở trực tiếp file index.html.'));
    return new Promise((ok, fail) => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/coop`);
      state.ws = ws;
      ws.addEventListener('open', () => ok(ws), { once: true });
      ws.addEventListener('error', () => fail(new Error('Không kết nối được server co-op. Hãy chạy game bằng start.bat (cần Node.js).')), { once: true });
      ws.addEventListener('message', event => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.players) state.players = msg.players;
        if (msg.t === 'created') Object.assign(state, { id: msg.id, hostId: msg.id, code: msg.code, role: 'host' });
        if (msg.t === 'joined') Object.assign(state, { id: msg.id, hostId: msg.hostId, code: msg.code, role: 'client' });
        if (msg.t === 'host-left') reset();
        emit(msg);
      });
      ws.addEventListener('close', () => {
        const wasInRoom = state.role !== 'solo';
        state.ws = null;
        reset();
        if (wasInRoom) emit({ t: 'host-left', closed: true });
      });
    });
  }

  function reset() {
    Object.assign(state, { id: 0, hostId: 0, code: '', role: 'solo', players: [] });
  }

  function send(msg) {
    // game.js passes big packets pre-encoded (already rounded and trimmed).
    if (state.ws && state.ws.readyState === 1) state.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  function leave() {
    send({ t: 'leave' });
    reset();
    emit({ t: 'left' });
  }

  function playerName() {
    const input = $('coopName');
    const name = (input && input.value.trim()) || 'Ninja';
    try { localStorage.setItem('shinobiName', name); } catch {}
    return name;
  }

  // ---------- Lobby UI ----------
  function showError(text) {
    const box = $('coopError');
    if (box) box.textContent = text || '';
  }

  function renderLobby() {
    const list = $('lobbyPlayers');
    if (!list) return;
    $('lobbyCode').textContent = state.code;
    list.innerHTML = '';
    for (let slot = 0; slot < state.maxPlayers; slot++) {
      const p = state.players.find(player => player.slot === slot);
      const row = document.createElement('li');
      row.className = p ? 'filled' : 'empty';
      row.style.setProperty('--slot', COLORS[slot]);
      const name = document.createElement('span');
      name.textContent = p ? p.name : 'Đang chờ…';
      row.append(name);
      if (p && (p.host || p.id === state.id)) {
        const tag = document.createElement('small');
        tag.textContent = [p.host ? 'CHỦ PHÒNG' : '', p.id === state.id ? 'BẠN' : ''].filter(Boolean).join(' · ');
        row.append(tag);
      }
      list.append(row);
    }
    const isHost = state.role === 'host';
    $('lobbyStart').hidden = !isHost;
    $('lobbyWaiting').hidden = isHost;
  }

  async function showLinks() {
    const box = $('lobbyLinks');
    if (!box) return;
    box.textContent = '';
    try {
      const info = await fetch('/api/info', { cache: 'no-store' }).then(r => r.json());
      state.maxPlayers = info.maxPlayers || 4;
      const urls = (info.addresses || []).map(a => `http://${a}:${info.port}`);
      if (!urls.length) urls.push(location.origin);
      for (const url of urls) {
        const code = document.createElement('code');
        code.textContent = url;
        box.append(code);
      }
    } catch {
      const code = document.createElement('code');
      code.textContent = location.origin;
      box.append(code);
    }
  }

  function openLobby() {
    $('startScreen').classList.remove('visible');
    $('lobbyScreen').classList.add('visible');
    renderLobby();
    showLinks();
  }

  function closeLobby() {
    $('lobbyScreen').classList.remove('visible');
  }

  async function create() {
    showError('');
    try {
      await connect();
      send({ t: 'create', name: playerName() });
    } catch (error) { showError(error.message); }
  }

  async function join() {
    showError('');
    const code = ($('coopCode').value || '').trim().toUpperCase();
    if (code.length !== 4) { showError('Nhập mã phòng 4 chữ cái.'); return; }
    try {
      await connect();
      send({ t: 'join', code, name: playerName() });
    } catch (error) { showError(error.message); }
  }

  listeners.push(msg => {
    if (msg.t === 'created' || msg.t === 'joined') openLobby();
    else if (msg.t === 'peer-join' || msg.t === 'peer-leave') renderLobby();
    else if (msg.t === 'error') showError(msg.text);
    else if (msg.t === 'start') closeLobby();
    else if (msg.t === 'host-left' || msg.t === 'left') {
      if ($('lobbyScreen').classList.contains('visible')) {
        closeLobby();
        $('startScreen').classList.add('visible');
        if (msg.t === 'host-left') showError('Chủ phòng đã rời, phòng đã đóng.');
      }
    }
  });

  addEventListener('DOMContentLoaded', () => {
    try { const saved = localStorage.getItem('shinobiName'); if (saved && $('coopName')) $('coopName').value = saved; } catch {}
    $('coopCreate')?.addEventListener('click', create);
    $('coopJoin')?.addEventListener('click', join);
    $('coopCode')?.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') join(); });
    $('coopName')?.addEventListener('keydown', e => e.stopPropagation());
    $('coopCode')?.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    $('lobbyLeave')?.addEventListener('click', () => {
      leave();
      closeLobby();
      $('startScreen').classList.add('visible');
    });
    // The server doesn't echo 'start' back to the host, so close the host's lobby here.
    $('lobbyStart')?.addEventListener('click', () => { closeLobby(); window.ShinobiGame?.hostStart(); });
  });

  window.CoopNet = {
    COLORS, state, send, leave,
    on(fn) { listeners.push(fn); },
    slotOf(id) { return state.players.find(p => p.id === id)?.slot ?? 0; },
    nameOf(id) { return state.players.find(p => p.id === id)?.name || 'Ninja'; },
    renderLobby
  };
})();
