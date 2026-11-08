/* team-mode.js — "Đấu Đội" (team battle) screens for Shinobi Siege.
   The match itself runs in game.js; this file owns the DOM around it:
     - the team-setup screen (2–10 teams, up to 10 characters each, a spawn flag per team on the world map),
       remembered in localStorage so "Chơi lại" is one click;
     - the add-units panel (N during a match);
     - the result screen;
     - the in-match scoreboard with a portrait per unit, and the move bar of the unit you drive.
   game.js calls TeamMode.init(host) once. host = { colors, maxTeams, maxPerTeam, world, catalog(), portrait(g, sprite, size),
     mapImage(), defaultSpawns(n, preset), validSpot(x, y), start(setup), add(team, item, count, at), resume(), replay(),
     toSetup(), toTitle(), control(id) }.
   Exposes window.TeamMode = { init, openSetup, openAdd, showResult, hideAll, isOpen, board, moves }. */
(() => {
  'use strict';

  const STORE = 'shinobi.teamSetup.v1';
  const $ = id => document.getElementById(id);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function button(cls, text, onClick, label) {
    const b = el('button', cls, text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  let host = null, groups = null;
  const byKey = new Map();
  const setup = { teams: [], sel: 0, mode: 'play' };
  const add = { sel: 0, count: 1, mode: 'team', point: null, info: null, status: '' };

  // ------------------------------------------------------------ catalog + portraits
  function loadCatalog() {
    if (groups) return groups;
    groups = (host.catalog() || []).filter(g => g.items && g.items.length);
    for (const g of groups) for (const item of g.items) byKey.set(item.key, item);
    return groups;
  }
  // Each portrait is baked once at 96px and copied into every thumbnail after that.
  const portraitCache = new Map();
  function portraitBase(item) {
    const key = item.sprite || 'beast:' + (item.tails || 0) + (item.tone || '');
    let c = portraitCache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    if (!(item.sprite && host.portrait(g, item.sprite, 96))) {
      g.fillStyle = item.tone || '#ffa62b'; g.beginPath(); g.arc(48, 48, 44, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1d1410'; g.font = '700 32px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${item.tails || ''}尾`, 48, 50);
    }
    portraitCache.set(key, c);
    return c;
  }
  function thumb(item, size, cls) {
    const c = el('canvas', cls || 'team-thumb');
    c.width = c.height = size;
    c.getContext('2d').drawImage(portraitBase(item), 0, 0, size, size);
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  // ------------------------------------------------------------ storage
  // ------------------------------------------------------------ co-op room seats (host's setup screen)
  // Each player in the room sits in one team (several may share a team) or none (-1: picks in the match).
  const seats = new Map();
  // Guest mode: a co-op guest sees the host's setup (kept in step by the host) and may only add or
  // remove units in the team it sits in; every edit goes to the host, which sends the new setup back.
  let guest = null;   // { myId, players, onEdit(op), onPick(team), onClose() }
  function roomPlayers() {
    if (guest) return guest.players;
    const r = host.room ? host.room() : null;
    return r && r.players && r.players.length > 1 ? r.players : null;
  }
  function roomSummary() {
    const out = {};
    for (const [id, i] of seats) if (i >= 0) out[id] = i;
    return { teams: setup.teams.map(t => ({ name: t.name, color: t.color, spawn: t.spawn, members: t.members.map(m => m.key) })), seats: out,
      players: (roomPlayers() || []).map(p => ({ id: p.id, name: p.name, color: p.color })) };
  }
  function roomChanged() { if (!guest && host && roomPlayers() && $('teamScreen')?.classList.contains('visible')) host.roomChanged?.(roomSummary()); }
  function seat(id, i) {
    if (guest) { guest.onPick(i); return; }
    seats.set(id, Number.isInteger(i) && i >= 0 && i < setup.teams.length ? i : -1);
    if ($('teamScreen')?.classList.contains('visible')) { renderModes(); renderList(); }
    roomChanged();
  }
  function refreshRoom() {
    const players = roomPlayers();
    if (players) for (const id of [...seats.keys()]) if (!players.some(p => p.id === id)) seats.delete(id);
    if ($('teamScreen')?.classList.contains('visible')) { renderModes(); renderList(); }
    roomChanged();
  }
  function save() {
    if (guest) return;
    roomChanged();
    try {
      localStorage.setItem(STORE, JSON.stringify({ sel: setup.sel, mode: setup.mode, teams: setup.teams.map(t => ({ name: t.name, spawn: t.spawn, members: t.members.map(m => m.key) })) }));
    } catch (error) { /* private mode: setup simply isn't remembered */ }
  }
  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (error) { data = null; }
    if (!data || !Array.isArray(data.teams) || data.teams.length < 2) return false;
    setup.teams = data.teams.slice(0, host.maxTeams).map((t, i) => ({
      name: String(t.name || `ĐỘI ${i + 1}`).slice(0, 18), color: host.colors[i],
      spawn: t.spawn && Number.isFinite(t.spawn.x) && Number.isFinite(t.spawn.y) ? { x: t.spawn.x, y: t.spawn.y } : null,
      members: (t.members || []).map(k => byKey.get(k)).filter(Boolean).slice(0, host.maxPerTeam) }));
    const spots = host.defaultSpawns(setup.teams.length, 'field');
    setup.teams.forEach((t, i) => { if (!t.spawn) t.spawn = spots[i]; });
    setup.sel = Math.min(setup.teams.length - 1, Math.max(0, data.sel | 0));
    setup.mode = data.mode === 'watch' ? 'watch' : 'play';
    return true;
  }
  function defaults() {
    const spots = host.defaultSpawns(2, 'field');
    const pick = title => groups.find(g => g.title === title)?.items[0];
    setup.teams = [0, 1].map(i => ({ name: `ĐỘI ${i + 1}`, color: host.colors[i], spawn: spots[i], members: [] }));
    const naruto = byKey.get('naruto'), foe = pick('AKATSUKI') || groups[1]?.items[0];
    if (naruto) setup.teams[0].members.push(naruto);
    if (foe) setup.teams[1].members.push(foe);
    setup.sel = 0;
  }
  function setTeamCount(n) {
    if (guest) return;
    n = Math.max(2, Math.min(host.maxTeams, n));
    if (n === setup.teams.length) return;
    if (n < setup.teams.length) setup.teams.length = n;
    else {
      const spots = host.defaultSpawns(n, 'field');
      for (let i = setup.teams.length; i < n; i++) setup.teams.push({ name: `ĐỘI ${i + 1}`, color: host.colors[i], spawn: spots[i], members: [] });
    }
    setup.sel = Math.min(setup.sel, n - 1);
    for (const [id, i] of seats) if (i >= n) seats.set(id, -1);
    save(); renderSetup();
  }

  // ------------------------------------------------------------ world map (setup + add panel)
  // Draws the world overview into `canvas` and returns the transform used, for click mapping.
  function drawWorldMap(canvas, flags, sel, dots, point) {
    const W = host.world.w, H = host.world.h;
    const cssW = canvas.clientWidth || 320, cssH = Math.round(cssW * H / W);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(cssW * dpr)) { canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); }
    canvas.style.height = cssH + 'px';
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1d2a1a'; g.fillRect(0, 0, cssW, cssH);
    try { g.drawImage(host.mapImage(), 0, 0, cssW, cssH); } catch (error) { /* map not ready */ }
    const k = cssW / W;
    if (dots) for (const d of dots) { g.fillStyle = d.color; g.beginPath(); g.arc(d.x * k, d.y * k, d.big ? 3 : 1.8, 0, Math.PI * 2); g.fill(); }
    flags.forEach((t, i) => {
      if (!t.spawn) return;
      const x = t.spawn.x * k, y = t.spawn.y * k, on = i === sel, r = on ? 10 : 7.5;
      g.strokeStyle = '#120d0a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - r * 2.4); g.stroke();
      g.fillStyle = t.color; g.beginPath(); g.moveTo(x, y - r * 2.4); g.lineTo(x + r * 1.7, y - r * 1.85); g.lineTo(x, y - r * 1.3); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(x, y, r * .55, 0, Math.PI * 2); g.fill(); g.stroke();
      if (on) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 3, 0, Math.PI * 2); g.stroke(); }
      g.font = '800 11px "Oswald", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#120d0a';
      g.strokeText(String(i + 1), x, y + r + 12); g.fillStyle = '#fff'; g.fillText(String(i + 1), x, y + r + 12);
    });
    if (point) {
      const x = point.x * k, y = point.y * k;
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.moveTo(x - 13, y); g.lineTo(x + 13, y); g.moveTo(x, y - 13); g.lineTo(x, y + 13); g.stroke();
    }
    return k;
  }
  function mapPoint(canvas, e) {
    const r = canvas.getBoundingClientRect(), k = r.width / host.world.w;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  }

  // ------------------------------------------------------------ catalog grid (shared)
  function buildCatalog(container, onPick) {
    container.replaceChildren();
    for (const group of loadCatalog()) {
      const section = el('section', 'team-cat-group');
      section.append(el('h3', '', group.title));
      const grid = el('div', 'team-cat-grid');
      for (const item of group.items) {
        const b = button('team-cat-item', '', () => onPick(item, b), `Thêm ${item.name}`);
        b.style.setProperty('--tone', item.tone || '#e8c070');
        b.append(thumb(item, 40), el('span', 'team-cat-name', item.name));
        b.title = item.name;
        grid.append(b);
      }
      section.append(grid);
      container.append(section);
    }
  }
  function flash(node) { node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash'); }

  // ------------------------------------------------------------ setup screen
  const ui = {};
  function buildSetup() {
    const root = $('teamSetup');
    root.replaceChildren();
    const head = el('header', 'team-head');
    const titles = el('div');
    titles.append(el('div', 'eyebrow', 'ĐẤU ĐỘI · 団体戦'));
    const h = el('h2', 'team-title', 'TẠO ĐỘI'); h.id = 'teamTitle';
    titles.append(h);
    head.append(titles, button('spawn-x', '✕', closeSetup, 'Đóng'));

    const bar = el('div', 'team-toolbar');
    bar.append(el('span', 'team-label', 'SỐ ĐỘI'));
    const stepper = el('div', 'team-stepper');
    ui.count = el('output', 'team-count-out');
    stepper.append(button('', '−', () => setTeamCount(setup.teams.length - 1), 'Bớt một đội'), ui.count,
      button('', '+', () => setTeamCount(setup.teams.length + 1), 'Thêm một đội'));
    // Play or just watch: in "Chỉ xem" nobody is driven (Tab / right click still takes a unit mid-match).
    const modes = el('div', 'team-modes');
    modes.setAttribute('role', 'radiogroup'); modes.setAttribute('aria-label', 'Cách chơi');
    ui.modeBtns = [['play', 'ĐIỀU KHIỂN NHÂN VẬT'], ['watch', 'CHỈ XEM']].map(([mode, label]) => {
      const b = button('team-mode-btn', label, () => { setup.mode = mode; save(); renderModes(); });
      b.setAttribute('role', 'radio'); b.dataset.mode = mode;
      return b;
    });
    modes.append(...ui.modeBtns);
    ui.note = el('span', 'team-note');
    bar.append(stepper, modes, ui.note);

    const body = el('div', 'team-body');
    const side = el('div', 'team-side');
    const mapBox = el('div', 'team-map-box');
    ui.map = el('canvas', 'team-map');
    ui.map.setAttribute('aria-label', 'Bản đồ thế giới: bấm để đặt điểm xuất phát của đội đang chọn');
    ui.map.addEventListener('click', e => {
      const t = setup.teams[setup.sel];
      if (!t || guest) return;
      const p = mapPoint(ui.map, e);
      t.spawn = host.validSpot(p.x, p.y);
      save(); drawSetupMap();
    });
    ui.mapHint = el('p', 'team-map-hint');
    const presets = el('div', 'team-presets');
    presets.append(el('span', 'team-label', 'CỜ MẶC ĐỊNH'),
      button('coop-btn spawn-ghost', 'CHIẾN TRƯỜNG', () => preset('field')),
      button('coop-btn spawn-ghost', 'LÀNG LÁ', () => preset('konoha')));
    mapBox.append(ui.map, ui.mapHint, presets);
    ui.list = el('div', 'team-list');
    side.append(mapBox, ui.list);

    const cat = el('div', 'team-catalog');
    ui.catTitle = el('div', 'team-cat-title');
    ui.cat = el('div', 'team-cat-scroll');
    buildCatalog(ui.cat, (item, b) => {
      const t = setup.teams[setup.sel];
      if (!t) return;
      if (guest) {
        const mine = seats.get(guest.myId);
        if (!(mine >= 0)) { setStatus('Vào một đội trước (nút "TÔI VÀO ĐỘI NÀY").', true); return; }
        if (mine !== setup.sel) { select(mine); }
        if (setup.teams[mine].members.length >= host.maxPerTeam) { setStatus(`${setup.teams[mine].name} đã đủ ${host.maxPerTeam} nhân vật.`, true); return; }
        guest.onEdit({ op: 'add', team: mine, key: item.key }); flash(b); return;
      }
      if (t.members.length >= host.maxPerTeam) { setStatus(`${t.name} đã đủ ${host.maxPerTeam} nhân vật.`, true); flash(ui.list.children[setup.sel] || b); return; }
      t.members.push(item);
      flash(b);
      save(); renderList();
    });
    cat.append(ui.catTitle, ui.cat);
    body.append(side, cat);

    const foot = el('footer', 'spawn-foot team-foot');
    ui.status = el('span', 'spawn-total');
    foot.append(ui.status,
      button('coop-btn spawn-ghost', 'XOÁ ĐỘI ĐANG CHỌN', () => { const t = setup.teams[setup.sel]; if (t) { t.members.length = 0; save(); renderList(); } }),
      button('coop-btn spawn-ghost', 'ĐẶT LẠI', () => { defaults(); save(); renderSetup(); }),
      button('coop-btn team-go', 'BẮT ĐẦU', startMatch));
    root.append(head, bar, body, foot);
    root.addEventListener('keydown', e => {
      if (e.code === 'Escape') { closeSetup(); e.preventDefault(); }
      e.stopPropagation();
    });
    ui.built = true;
  }
  function preset(kind) {
    if (guest) return;
    const spots = host.defaultSpawns(setup.teams.length, kind);
    setup.teams.forEach((t, i) => { t.spawn = spots[i]; });
    save(); drawSetupMap();
  }
  function setStatus(text, warn) {
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.toggle('warn', !!warn);
  }
  function summary() {
    if (guest) return;
    const filled = setup.teams.filter(t => t.members.length);
    const total = filled.reduce((n, t) => n + t.members.length, 0);
    setStatus(filled.length >= 2 ? `${filled.length} đội · ${total} nhân vật sẵn sàng` : 'Cần ít nhất 2 đội có nhân vật', filled.length < 2);
  }
  function renderList() {
    ui.list.replaceChildren(...setup.teams.map((t, i) => {
      const row = el('div', 'team-row' + (i === setup.sel ? ' selected' : ''));
      row.style.setProperty('--team', t.color);
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `Chọn ${t.name}`);
      row.addEventListener('click', () => select(i));
      row.addEventListener('keydown', e => { if ((e.code === 'Enter' || e.code === 'Space') && e.target === row) { select(i); e.preventDefault(); } });
      const head = el('div', 'team-row-head');
      const badge = el('span', 'team-badge', String(i + 1));
      const name = el('input', 'team-name');
      name.value = t.name; name.maxLength = 18; name.setAttribute('aria-label', `Tên đội ${i + 1}`);
      name.readOnly = !!guest;
      name.addEventListener('click', e => { e.stopPropagation(); select(i, true); });
      name.addEventListener('input', () => { t.name = name.value.toUpperCase().slice(0, 18) || `ĐỘI ${i + 1}`; save(); if (i === setup.sel) renderCatTitle(); });
      head.append(badge, name, el('span', 'team-row-count', `${t.members.length}/${host.maxPerTeam}`));
      const members = el('div', 'team-members');
      if (!t.members.length) members.append(el('span', 'team-empty', i === setup.sel ? 'Chọn nhân vật ở danh sách bên cạnh' : 'Chưa có nhân vật'));
      t.members.forEach((m, j) => {
        const chip = button('team-chip', '', e => {
          e.stopPropagation();
          if (guest) { if (seats.get(guest.myId) === i) guest.onEdit({ op: 'remove', team: i, idx: j, key: m.key }); else setStatus('Bạn chỉ sửa được đội của mình.', true); return; }
          t.members.splice(j, 1); save(); renderList();
        }, `Bỏ ${m.name} khỏi ${t.name}`);
        chip.title = `${m.name} · bấm để bỏ`;
        chip.append(thumb(m, 30, 'team-chip-thumb'), el('span', 'team-chip-name', m.name), el('span', 'team-chip-x', '✕'));
        members.append(chip);
      });
      row.append(head, members);
      // Co-op: who plays this team, and a button for you to join it.
      const players = roomPlayers();
      if (players) {
        const bar = el('div', 'team-seats');
        for (const p of players) if (seats.get(p.id) === i) {
          const tag = el('span', 'team-seat', p.name + (p.me ? ' (BẠN)' : ''));
          tag.style.setProperty('--slot', p.color);
          bar.append(tag);
        }
        const me = players.find(p => p.me);
        if (me) bar.append(seats.get(me.id) === i
          ? button('team-seat-join', 'RỜI ĐỘI', e => { e.stopPropagation(); seat(me.id, -1); }, `Rời ${t.name}`)
          : button('team-seat-join', '＋ TÔI VÀO ĐỘI NÀY', e => { e.stopPropagation(); seat(me.id, i); }, `Vào ${t.name}`));
        row.append(bar);
      }
      return row;
    }));
    ui.count.textContent = String(setup.teams.length);
    renderCatTitle();
    summary();
  }
  function renderCatTitle() {
    const t = setup.teams[setup.sel];
    ui.catTitle.replaceChildren(el('span', '', 'THÊM NHÂN VẬT VÀO '));
    const s = el('strong', '', t ? t.name : '');
    s.style.color = t ? t.color : '';
    ui.catTitle.append(s);
    ui.mapHint.replaceChildren(el('span', '', 'Bấm vào bản đồ để đặt cờ xuất phát cho '));
    const s2 = el('strong', '', t ? t.name : ''); s2.style.color = t ? t.color : '';
    ui.mapHint.append(s2);
  }
  function select(i, keepFocus) {
    if (setup.sel === i) return;
    setup.sel = i;
    save();
    const focused = document.activeElement;
    renderList(); drawSetupMap();
    if (keepFocus && focused?.classList.contains('team-name')) ui.list.children[i]?.querySelector('.team-name')?.focus();
  }
  function drawSetupMap() { drawWorldMap(ui.map, setup.teams, setup.sel, null, null); }
  function renderModes() {
    for (const b of ui.modeBtns) { const on = b.dataset.mode === setup.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    if (guest) {
      const mine = seats.get(guest.myId);
      ui.note.textContent = mine >= 0 ? `Bạn ở ${setup.teams[mine]?.name || ''}: bấm nhân vật bên phải để thêm vào đội, bấm vào nhân vật trong đội để bỏ. Chủ phòng bấm BẮT ĐẦU khi mọi người sẵn sàng.`
        : 'Bấm "＋ TÔI VÀO ĐỘI NÀY" trên một thẻ đội (có thể chung đội với người khác), rồi chọn nhân vật cho đội của bạn.';
      return;
    }
    const players = roomPlayers();
    if (players) {
      const free = players.filter(p => !(seats.get(p.id) >= 0)).map(p => p.name);
      ui.note.textContent = `Phòng co-op ${players.length} người: mỗi người chọn một đội (có thể chung đội). Bạn bấm "TÔI VÀO ĐỘI NÀY" trên thẻ đội; bạn bè chọn ngay trên màn chờ của họ. `
        + (free.length ? `Chưa chọn: ${free.join(', ')} (sẽ được hỏi khi vào trận).` : 'Mọi người đã chọn đội.') + ' Mỗi người điều khiển nhân vật của đội mình; Naruto thuộc về chủ phòng.';
      return;
    }
    ui.note.textContent = setup.mode === 'watch'
      ? 'Chỉ xem: bạn không điều khiển ai, camera tự do (WASD, kéo chuột, F tự theo trận đánh). Có thể bấm Tab hoặc chuột phải vào nhân vật để nhập vai bất cứ lúc nào.'
      : `Tối đa ${host.maxTeams} đội · ${host.maxPerTeam} nhân vật mỗi đội. Naruto đầu tiên là bạn; mọi nhân vật khác do máy điều khiển. Trong trận: Tab đổi nhân vật, chuột trái tung chiêu liên hoàn, chuột phải lướt (giữ để lướt liên tục), Backspace chuyển sang chỉ xem.`;
  }
  function renderSetup() { renderModes(); renderList(); drawSetupMap(); }
  function openSetup() {
    setTimeout(roomChanged, 0);
    if (!host) return;
    loadCatalog();
    if (!setup.teams.length && !load()) defaults();
    if (!ui.built) buildSetup();
    hideAll();
    $('teamScreen').classList.add('visible');
    renderSetup();
    requestAnimationFrame(drawSetupMap);
  }
  function closeSetup() {
    $('teamScreen').classList.remove('visible');
    if (guest) { const g = guest; guest = null; $('teamSetup')?.classList.remove('guest'); g.onClose(); return; }
    if (roomPlayers()) host.roomChanged?.({ closed: true });
  }
  // Guest: show (or refresh) the host's setup. data: the host's room summary.
  function applyRemote(data) {
    setup.teams = (data.teams || []).map((t, i) => ({ name: t.name, color: t.color || host.colors[i], spawn: t.spawn || null,
      members: (t.members || []).map(k => byKey.get(k)).filter(Boolean) }));
    setup.sel = Math.min(Math.max(0, setup.sel), Math.max(0, setup.teams.length - 1));
    seats.clear();
    for (const id in data.seats || {}) seats.set(+id, data.seats[id]);
  }
  function openGuestSetup(data, hooks) {
    if (!host) return;
    loadCatalog();
    if (!ui.built) buildSetup();
    const first = !guest;
    if (first) hideAll();   // closes other team screens (and clears any stale guest state)
    guest = { ...hooks, players: (data.players || []).map(p => ({ ...p, me: p.id === hooks.myId })) };
    applyRemote(data);
    if (first) { const mine = seats.get(hooks.myId); if (mine >= 0) setup.sel = mine; }
    $('teamSetup')?.classList.add('guest');
    $('teamScreen').classList.add('visible');
    renderSetup();
    setStatus('Chờ chủ phòng bấm BẮT ĐẦU', false);
    if (first) requestAnimationFrame(drawSetupMap);
  }
  function guestOpen() { return !!guest && $('teamScreen')?.classList.contains('visible'); }
  // Host: a guest's add / remove, allowed only inside the team that guest sits in.
  function guestEdit(id, op) {
    if (guest || !op || seats.get(id) !== op.team) return;
    const t = setup.teams[op.team];
    if (!t) return;
    if (op.op === 'add') { const item = byKey.get(op.key); if (!item || t.members.length >= host.maxPerTeam) return; t.members.push(item); }
    else if (op.op === 'remove') { const j = t.members[op.idx]?.key === op.key ? op.idx : t.members.findIndex(m => m.key === op.key); if (j < 0) return; t.members.splice(j, 1); }
    else return;
    save();
    if ($('teamScreen')?.classList.contains('visible')) renderList();
  }
  function startMatch() {
    if (guest) return;
    const teams = setup.teams.filter(t => t.members.length);
    if (teams.length < 2) { setStatus('Cần ít nhất 2 đội có nhân vật để bắt đầu.', true); return; }
    save();
    // Seats point at setup teams; the match only keeps the teams that have units.
    const seatsOut = {};
    for (const [id, i] of seats) { const k = teams.indexOf(setup.teams[i]); if (i >= 0 && k >= 0) seatsOut[id] = k; }
    const ok = host.start({ mode: setup.mode, seats: seatsOut, teams: teams.map(t => ({ name: t.name, color: t.color, spawn: t.spawn, members: t.members.slice() })) });
    if (ok === false) setStatus('Không thể bắt đầu (đang ở phòng co-op?).', true);
  }

  // ------------------------------------------------------------ add-units panel
  const au = {};
  function buildAdd() {
    const root = $('teamAdd');
    root.replaceChildren();
    const head = el('header', 'team-head');
    const titles = el('div');
    titles.append(el('div', 'eyebrow', 'ĐẤU ĐỘI · TĂNG VIỆN'));
    const h = el('h2', 'team-title', 'THÊM QUÂN'); h.id = 'teamAddTitle';
    titles.append(h);
    head.append(titles, button('spawn-x', '✕', closeAdd, 'Đóng'));
    const bar = el('div', 'team-toolbar team-add-bar');
    au.teams = el('div', 'team-add-teams');
    const count = el('div', 'team-stepper');
    au.count = el('output', 'team-count-out');
    count.append(button('', '−', () => { add.count = Math.max(1, add.count - 1); renderAddBar(); }, 'Bớt'), au.count,
      button('', '+', () => { add.count = Math.min(10, add.count + 1); renderAddBar(); }, 'Thêm'));
    au.modeTeam = button('coop-btn spawn-ghost', 'TẠI CỜ CỦA ĐỘI', () => { add.mode = 'team'; renderAddBar(); drawAddMap(); });
    au.modePoint = button('coop-btn spawn-ghost', 'TẠI ĐIỂM TRÊN BẢN ĐỒ', () => { add.mode = 'point'; if (!add.point) add.point = add.info.teams[add.sel]?.spawn; renderAddBar(); drawAddMap(); });
    bar.append(el('span', 'team-label', 'ĐỘI'), au.teams, el('span', 'team-label', 'SỐ LƯỢNG'), count, au.modeTeam, au.modePoint);
    const body = el('div', 'team-body');
    const side = el('div', 'team-side');
    au.map = el('canvas', 'team-map');
    au.map.setAttribute('aria-label', 'Bản đồ: bấm để chọn nơi quân mới xuất hiện');
    au.map.addEventListener('click', e => { add.point = host.validSpot(...Object.values(mapPoint(au.map, e))); add.mode = 'point'; renderAddBar(); drawAddMap(); });
    side.append(au.map, el('p', 'team-map-hint', 'Chấm màu là quân đang đánh; bấm vào bản đồ để quân mới xuất hiện tại đó.'));
    const cat = el('div', 'team-catalog');
    au.cat = el('div', 'team-cat-scroll');
    buildCatalog(au.cat, (item, b) => {
      const n = host.add(add.sel, item, add.count, add.mode === 'point' ? add.point : null);
      const t = add.info.teams[add.sel];
      if (n) { flash(b); au.status.textContent = `Đã thêm ${n} × ${item.name} cho ${t?.name || ''}`; au.status.classList.remove('warn'); }
    });
    cat.append(el('div', 'team-cat-title', 'BẤM NHÂN VẬT ĐỂ THÊM NGAY VÀO TRẬN'), au.cat);
    body.append(side, cat);
    const foot = el('footer', 'spawn-foot team-foot');
    au.status = el('span', 'spawn-total', '');
    foot.append(au.status, button('coop-btn team-go', 'TIẾP TỤC TRẬN', closeAdd));
    root.append(head, bar, body, foot);
    root.addEventListener('keydown', e => {
      if (e.code === 'Escape' || (e.code === 'KeyN' && e.target.tagName !== 'INPUT')) { closeAdd(); e.preventDefault(); }
      e.stopPropagation();
    });
    au.built = true;
  }
  function renderAddBar() {
    au.teams.replaceChildren(...add.info.teams.map((t, i) => {
      const b = button('team-pick' + (i === add.sel ? ' selected' : ''), t.name, () => { add.sel = i; renderAddBar(); drawAddMap(); });
      b.style.setProperty('--team', t.color);
      return b;
    }));
    au.count.textContent = String(add.count);
    au.modeTeam.classList.toggle('on', add.mode === 'team');
    au.modePoint.classList.toggle('on', add.mode === 'point');
  }
  function drawAddMap() { drawWorldMap(au.map, add.info.teams, add.sel, add.info.units, add.mode === 'point' ? add.point : null); }
  function openAdd(info) {
    if (!host) return;
    loadCatalog();
    if (!au.built) buildAdd();
    add.info = info;
    add.sel = Math.min(info.teams.length - 1, Math.max(0, info.selected | 0));
    au.status.textContent = 'Chọn đội, số lượng, nơi xuất hiện rồi bấm nhân vật.';
    hideAll();
    $('teamAddScreen').classList.add('visible');
    renderAddBar();
    requestAnimationFrame(drawAddMap);
  }
  function closeAdd() {
    const screen = $('teamAddScreen');
    if (!screen.classList.contains('visible')) return;
    screen.classList.remove('visible');
    host.resume();
  }

  // ------------------------------------------------------------ result screen
  function showResult(data) {
    const root = $('teamResult');
    root.replaceChildren();
    root.append(el('div', 'jp-caption', '決着'));
    root.append(el('div', 'eyebrow', 'TRẬN ĐẤU KẾT THÚC'));
    const h = el('h2', 'team-result-title', data.winner ? `${data.winner.name} CHIẾN THẮNG!` : 'HOÀ — KHÔNG ĐỘI NÀO TRỤ LẠI');
    h.id = 'teamResultTitle';
    if (data.winner) h.style.color = data.winner.color;
    root.append(h);
    const table = el('div', 'team-result-table');
    table.append(el('span', 'th', 'ĐỘI'), el('span', 'th', 'HẠ GỤC'), el('span', 'th', 'CÒN LẠI'));
    for (const t of [...data.teams].sort((a, b) => b.alive - a.alive || b.kills - a.kills)) {
      const name = el('span', 'team-result-name', t.name);
      name.style.setProperty('--team', t.color);
      table.append(name, el('span', '', String(t.kills)), el('span', '', String(t.alive)));
    }
    root.append(table);
    const again = button('headband', '', () => host.replay());
    again.append(el('span', 'headband-label', 'CHƠI LẠI'));
    const row = el('div', 'team-result-actions');
    row.append(button('coop-btn', 'VỀ MÀN TẠO ĐỘI', () => host.toSetup()), button('coop-btn spawn-ghost', 'MÀN HÌNH CHÍNH', () => host.toTitle()));
    root.append(again, row);
    hideAll();
    $('teamResultScreen').classList.add('visible');
    again.focus();
  }

  // ------------------------------------------------------------ HUD: scoreboard + move bar
  const board = { key: '', rows: [], collapsed: innerWidth < 700 };
  function renderBoard(data) {
    const root = $('teamBoard');
    if (!root) return;
    root.hidden = false;
    const key = data.map(t => t.name + '#' + t.units.map(u => u.id).join(',')).join('|');
    if (key !== board.key) {
      board.key = key;
      root.replaceChildren();
      const toggle = button('tb-toggle', board.collapsed ? '▸ CÁC ĐỘI' : '▾ CÁC ĐỘI', () => {
        board.collapsed = !board.collapsed; root.classList.toggle('collapsed', board.collapsed);
        toggle.textContent = board.collapsed ? '▸ CÁC ĐỘI' : '▾ CÁC ĐỘI';
      }, 'Thu gọn bảng đội');
      root.append(toggle);
      board.rows = data.map(t => {
        const row = el('div', 'tb-team');
        row.style.setProperty('--team', t.color);
        const head = el('div', 'tb-head');
        const stat = el('span', 'tb-stat');
        head.append(el('span', 'tb-name', t.name), stat);
        const units = el('div', 'tb-units');
        const cells = t.units.slice(0, 16).map(u => {
          const b = button('tb-unit', '', () => host.control(u.id), `Điều khiển ${u.name}`);
          b.title = u.name;
          const hp = el('span', 'tb-hp'), fill = el('i');
          hp.append(fill);
          b.append(thumb({ sprite: u.sprite, tails: u.tails, tone: t.color }, 26, 'tb-thumb'), hp);
          units.append(b);
          return { b, fill };
        });
        if (t.units.length > 16) units.append(el('span', 'tb-more', `+${t.units.length - 16}`));
        row.append(head, units);
        root.append(row);
        return { row, stat, cells };
      });
      root.classList.toggle('collapsed', board.collapsed);
    }
    data.forEach((t, i) => {
      const r = board.rows[i];
      if (!r) return;
      const text = `còn ${t.alive} · hạ ${t.kills}`;
      if (r.stat.textContent !== text) r.stat.textContent = text;
      r.row.classList.toggle('out', t.alive <= 0);
      t.units.slice(0, 16).forEach((u, j) => {
        const c = r.cells[j];
        if (!c) return;
        const w = `${Math.round(u.hp * 100)}%`;
        if (c.fill.style.width !== w) c.fill.style.width = w;
        c.b.classList.toggle('dead', u.dead);
        c.b.classList.toggle('ctrl', u.ctrl);
        c.b.disabled = u.dead;
      });
    });
  }
  const mv = { key: '', slots: [] };
  function renderMoves(data) {
    const root = $('moveBar');
    if (!root) return;
    if (!data) { if (!root.hidden) { root.hidden = true; mv.key = ''; } return; }
    root.hidden = false;
    const key = data.id + ':' + data.moves.map(m => m.label).join('|');
    if (key !== mv.key) {
      mv.key = key;
      root.replaceChildren();
      root.style.setProperty('--team', data.color);
      const basic = el('div', 'mv-slot mv-basic');
      basic.append(el('kbd', '', 'CHUỘT TRÁI'), el('strong', '', 'CHIÊU LIÊN HOÀN'));
      root.append(basic);
      const dash = el('div', 'mv-slot mv-dash');
      mv.dashLeft = el('span', 'mv-left');
      dash.append(el('kbd', '', 'CHUỘT PHẢI'), el('strong', '', 'LƯỚT'), mv.dashLeft);
      mv.dash = dash;
      root.append(dash);
      mv.slots = data.moves.map((m, i) => {
        const s = el('div', 'mv-slot' + (i === data.moves.length - 1 && data.moves.length > 1 ? ' mv-ult' : ''));
        const left = el('span', 'mv-left');
        s.append(el('kbd', '', String(i + 1)), el('strong', '', m.label), left);
        root.append(s);
        return { s, left };
      });
    }
    root.classList.toggle('busy', !!data.busy);
    if (data.dash && mv.dash) {
      const v = String(Math.round(Math.min(1, data.dash.ratio) * 100) / 100);
      if (mv.dash.__cd !== v) { mv.dash.style.setProperty('--cd', v); mv.dash.__cd = v; }
      const t = data.dash.left > 0 ? data.dash.left.toFixed(1) : '';
      if (mv.dashLeft.textContent !== t) mv.dashLeft.textContent = t;
      mv.dash.classList.toggle('cooling', data.dash.left > 0);
    }
    data.moves.forEach((m, i) => {
      const slot = mv.slots[i];
      if (!slot) return;
      const v = String(Math.round(Math.min(1, m.ratio) * 100) / 100);
      if (slot.s.__cd !== v) { slot.s.style.setProperty('--cd', v); slot.s.__cd = v; }
      const t = m.left > 0 ? String(Math.ceil(m.left)) : '';
      if (slot.left.textContent !== t) slot.left.textContent = t;
      slot.s.classList.toggle('cooling', m.left > 0);
      slot.s.classList.toggle('mv-next', i === data.next);
    });
  }
  function hideHud() {
    const b = $('teamBoard'), m = $('moveBar');
    if (b) { b.hidden = true; b.replaceChildren(); board.key = ''; }
    if (m) { m.hidden = true; m.replaceChildren(); mv.key = ''; }
  }

  // ------------------------------------------------------------ public
  const screens = ['teamScreen', 'teamAddScreen', 'teamResultScreen'];
  function hideAll() { for (const id of screens) $(id)?.classList.remove('visible'); if (pick.root) pick.root.hidden = true; if (guest) { guest = null; $('teamSetup')?.classList.remove('guest'); } }
  function isOpen() { return screens.some(id => $(id)?.classList.contains('visible')) || !!(pick.root && !pick.root.hidden); }
  // Co-op team battle: each player picks the team they will drive (or just watches). data: { teams:
  // [{ name, color, alive, players }], current }; onPick(index), -1 = watch only. J reopens it in game.
  const pick = { root: null };
  function pickTeam(data, onPick) {
    if (!pick.root) {
      pick.root = el('div', 'team-pick');
      pick.root.setAttribute('role', 'dialog');
      pick.root.setAttribute('aria-label', 'Chọn đội');
      document.body.append(pick.root);
      pick.root.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') { pick.root.hidden = true; pick.done?.(-1); } });
    }
    const root = pick.root;
    pick.done = i => { root.hidden = true; onPick(i); };
    root.replaceChildren();
    const card = el('div', 'team-pick-card');
    card.append(el('div', 'jp-caption', '陣営'), el('div', 'eyebrow', 'ĐẤU ĐỘI · CO-OP'), el('h2', 'team-pick-title', 'CHỌN ĐỘI CỦA BẠN'),
      el('p', 'team-pick-note', 'Bạn điều khiển nhân vật của đội đã chọn: Tab đổi nhân vật, chuột trái tung chiêu, chuột phải lướt. Bấm J trong trận để đổi đội.'));
    const grid = el('div', 'team-pick-grid');
    data.teams.forEach((t, i) => {
      const b = el('button', 'team-pick-btn' + (i === data.current ? ' on' : ''));
      b.type = 'button';
      b.style.setProperty('--team', t.color);
      b.append(el('strong', '', t.name), el('span', '', `${t.alive || 0} nhân vật · ${t.players || 0} người chơi`));
      b.addEventListener('click', () => pick.done(i));
      grid.append(b);
    });
    const watch = el('button', 'coop-btn team-pick-watch', 'CHỈ XEM');
    watch.type = 'button';
    watch.addEventListener('click', () => pick.done(-1));
    card.append(grid, watch);
    root.append(card);
    root.hidden = false;
    (grid.querySelector('.on') || grid.firstChild)?.focus();
  }
  function init(h) {
    host = h;
    // The result screen must not leak keys into the paused match (Enter replays).
    $('teamResultScreen')?.addEventListener('keydown', e => e.stopPropagation());
    // Esc closes the setup / add panels (and N toggles the add panel) wherever the focus is.
    addEventListener('keydown', e => {
      if (e.code === 'Escape' && $('teamScreen')?.classList.contains('visible')) { closeSetup(); e.preventDefault(); e.stopImmediatePropagation(); }
      else if ((e.code === 'Escape' || (e.code === 'KeyN' && !e.repeat && e.target?.tagName !== 'INPUT')) && $('teamAddScreen')?.classList.contains('visible')) { closeAdd(); e.preventDefault(); e.stopImmediatePropagation(); }
    });
    // Leaving the match hides the HUD extras.
    const hud = $('hud');
    if (hud) new MutationObserver(() => { if (!hud.classList.contains('team-mode')) hideHud(); }).observe(hud, { attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', () => {
      if ($('teamScreen')?.classList.contains('visible') && ui.map) drawSetupMap();
      if ($('teamAddScreen')?.classList.contains('visible') && au.map) drawAddMap();
    });
  }
  window.TeamMode = { init, openSetup, openAdd, showResult, hideAll, isOpen, board: renderBoard, moves: renderMoves, pickTeam, seat, refreshRoom, openGuestSetup, guestOpen, guestEdit };
})();
