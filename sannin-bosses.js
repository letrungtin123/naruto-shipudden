/* The Legendary Sannin for the spawn panel: Jiraiya (Toad Sage), Orochimaru and Kabuto in snake
 * Sage Mode. Same contract as the other boss modules: update(z, dt, api) drives the jutsu,
 * draw(ctx, z, time) paints telegraphs and the ground layer, drawOverlay(ctx, z, time) what stands
 * above the characters (summons, serpents, flames, coffins). All per-boss state lives on z.sn;
 * the bodies are AnimeSprites characters drawn by the game ('jiraiya', 'orochimaru', 'kabuto'). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeOutBack = t => { t = clamp01(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const FB = 114 / 128; // flame sprite base

  const order = ['jiraiya', 'orochimaru', 'kabuto'];
  const members = {
    jiraiya: { name: 'JIRAIYA — TIÊN NHÂN CÓC', accent: '#ff8a3a', hpScale: 3.0, damageScale: 1.85, armor: .82,
      moves: ['oodama', 'yuendan', 'harijizo', 'needles', 'gamabunta', 'oodama', 'goemon'] },
    orochimaru: { name: 'OROCHIMARU — BẠCH XÀ SANNIN', accent: '#b88cff', hpScale: 2.9, damageScale: 1.85, armor: .82,
      moves: ['senei', 'kusanagi', 'yamata', 'daitoppa', 'manda', 'senei', 'edo'] },
    kabuto: { name: 'YAKUSHI KABUTO — XÀ TIÊN NHÂN', accent: '#8ff0c8', hpScale: 3.0, damageScale: 1.9, armor: .8,
      moves: ['muki', 'hakugeki', 'ryudo', 'mandala', 'edo2', 'muki', 'dairyu'] }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    oodama:    { label: 'TIÊN THUẬT · ĐẠI NGỌC LOA TOÀN HOÀN', rgb: '120,190,255', windup: .9, after: 1.2 },
    yuendan:   { label: 'HỎA ĐỘN · CÓC DẦU VIÊM ĐẠN', rgb: '255,130,40', windup: .95, after: 1.7 },
    harijizo:  { label: 'NHẪN PHÁP · CHÂM KIM TIẾP ĐỊA', rgb: '240,240,228', windup: .55, after: 1.4 },
    needles:   { label: 'TIÊN PHÁP · MAO CHÂM THIÊN', rgb: '236,236,226', windup: .75, after: 1.7 },
    gamabunta: { label: 'KHẨU KHÍ · GAMABUNTA', rgb: '255,120,70', windup: 1.1, after: 3.2 },
    goemon:    { label: 'TIÊN PHÁP · NGŨ HỮU VỆ MÔN', rgb: '255,110,30', windup: 1.5, after: 3.4 },
    senei:     { label: 'TIỀM ẢNH XÀ THỦ', rgb: '176,206,120', windup: .7, after: 1.2 },
    kusanagi:  { label: 'THẢO TÙNG KIẾM', rgb: '222,212,255', windup: .8, after: 1.3 },
    yamata:    { label: 'BÁT KỲ THUẬT', rgb: '240,236,225', windup: 1.0, after: 2.5 },
    daitoppa:  { label: 'PHONG ĐỘN · ĐẠI ĐỘT PHÁ', rgb: '220,235,240', windup: .7, after: 1.4 },
    manda:     { label: 'KHẨU KHÍ · MANDA', rgb: '176,126,236', windup: 1.1, after: 2.8 },
    edo:       { label: 'UẾ THỔ CHUYỂN SINH', rgb: '196,156,255', windup: 1.4, after: 4.0 },
    muki:      { label: 'TIÊN THUẬT · VÔ CƠ CHUYỂN SINH', rgb: '206,196,172', windup: .8, after: 1.3 },
    hakugeki:  { label: 'TIÊN PHÁP · BẠCH KÍCH', rgb: '240,246,255', windup: .9, after: 1.5 },
    ryudo:     { label: 'XÀ TIÊN · LONG ĐỘNG', rgb: '150,232,192', windup: .8, after: 1.9 },
    mandala:   { label: 'MAN ĐÀ LA XÀ', rgb: '170,232,202', windup: .85, after: 1.8 },
    edo2:      { label: 'UẾ THỔ CHUYỂN SINH', rgb: '196,156,255', windup: 1.1, after: 3.2 },
    dairyu:    { label: 'TIÊN PHÁP · ĐẠI XÀ LONG', rgb: '236,246,240', windup: 1.4, after: 3.6 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;
  // Manual control (team mode): each member's distinct jutsu in key order 1..n, ultimate last.
  const MANUAL = {};
  for (const id in members) MANUAL[id] = [...new Set(members[id].moves)].slice(0, 8).map(k => ({ id: k, label: MOVES[k].label }));
  function moves(z) { return (z && MANUAL[z.bossId]) || []; }

  function pick(level) { return order[((level % order.length) + order.length) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  const faceOf = a => Math.cos(a) >= 0 ? 1 : -1;

  function state(z) {
    return z.sn || (z.sn = { t: 0, casts: 0, timer: 1, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], force: null, dash: null, armor: 0, hold: 0, pts: null, wfx: null });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });

  // Hit points covering a cone (true world geometry, same as its telegraph).
  function conePts(x, y, a, reach, half, from = 70, step = 85) {
    const out = [];
    for (let d = from; d <= reach; d += step) {
      const cnt = Math.max(1, Math.ceil(2 * half * d / 120)), r = Math.max(56, (2 * half * d / cnt) * .64);
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half * .9);
        out.push({ x: x + Math.cos(aa) * d, y: y + Math.sin(aa) * d, r, d });
      }
    }
    return out;
  }
  function ringStrikes(api, x, y, rho, dmg) {
    const n = Math.max(6, Math.ceil(TAU * rho / 110)), r = Math.max(58, TAU * rho / n * .62);
    for (let i = 0; i < n; i++) { const a = i / n * TAU; api.strike(x + Math.cos(a) * rho, y + Math.sin(a) * rho, r, dmg, null, null, true); }
  }
  // Band of hits across a lane at distance d (for waves that sweep forward).
  function laneRow(api, x, y, a, d, w, dmg, kind) {
    const ca = Math.cos(a), sa = Math.sin(a), cx = x + ca * d, cy = y + sa * d;
    api.line(cx + sa * w, cy - ca * w, cx - sa * w, cy + ca * w, 50, dmg, kind);
  }

  // ------------------------------------------------------------------ telegraphs
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const line = (len, w, aa = a) => ({ k: 'line', x, y, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    const dist = Math.hypot(tx - x, ty - y);
    switch (move) {
      case 'oodama': { const len = Math.max(300, Math.min(780, dist + 70)); st.len = len; return [line(len, 70), circ(x + ca * len, y + sa * len, 240)]; }
      case 'yuendan': return [{ k: 'cone', x, y, a, r: 780, h: .42 }];
      case 'harijizo': return [circ(x, y, 240), { k: 'star', x, y, a, n: 10, len: 430, w: 20 }];
      case 'needles': return [circ(tx, ty, 380, true)];
      case 'gamabunta': return [circ(tx, ty, 215)];
      case 'goemon': return [line(980, 270)];
      case 'senei': { const out = []; for (let i = 0; i < 5; i++) out.push(line(660, 32, a + (i - 2) * .2)); return out; }
      case 'kusanagi': return [line(960, 30), { k: 'cone', x, y, a, r: 570, h: 1.1, faint: true }];
      case 'yamata': {
        const pts = [{ x: tx, y: ty }];
        for (let i = 0; i < 7; i++) { const b = a + Math.PI + i / 7 * TAU + .3; pts.push({ x: tx + Math.cos(b) * 235, y: ty + Math.sin(b) * 235 }); }
        st.pts = pts;
        return pts.map(p => circ(p.x, p.y, 100));
      }
      case 'daitoppa': return [{ k: 'cone', x, y, a, r: 740, h: .5 }];
      case 'manda': return [{ k: 'ring', x: tx, y: ty, r: 380, r0: 110 }, circ(tx, ty, 210)];
      case 'edo': return [circ(tx, ty, 340), circ(tx, ty, 190)];
      case 'muki': { const out = []; for (let i = 0; i < 3; i++) out.push(line(780, 52, a + (i - 1) * .3)); return out; }
      case 'hakugeki': return [circ(x, y, 470)];
      case 'ryudo': return [circ(tx, ty, 400, true)];
      case 'mandala': return [line(900, 240)];
      case 'edo2': return [circ(tx, ty, 200), circ(tx, ty, 300, true)];
      case 'dairyu': { const len = Math.max(420, Math.min(1000, dist + 160)); st.len = len; return [line(len, 105), circ(x + ca * len, y + sa * len, 330)]; }
    }
    return [];
  }

  function announce(z, st, m, api) {
    let move = st.force;
    if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.tele = teleFor(z, st, move);
    const seed = Math.random() * 99, f = faceOf(st.aim), sa = Math.sin(st.aim), ca = Math.cos(st.aim);
    // Helpers that appear during the windup.
    if (move === 'yuendan') addFx(st, { kind: 'toad', t: 'kichi', x: z.x - sa * 62 + ca * 14, y: z.y + ca * 62 + sa * 14 + 4, w: 150, f, dur: def.windup + 1.5, seed });
    if (move === 'goemon') addFx(st, { kind: 'mapa', dur: def.windup + 1.8, seed });
    if (move === 'gamabunta' || move === 'manda') addFx(st, { kind: 'seal', x: st.tx, y: st.ty, r: move === 'manda' ? 170 : 150, rgb: def.rgb, dur: def.windup + .25, seed });
    if (move === 'edo' || move === 'edo2') {
      const cf = [];
      for (const s of [-1, 1]) cf.push({ x: z.x + ca * 95 - sa * s * 115, y: z.y + sa * 95 + ca * s * 115 });
      st.coffins = cf;
      for (const c of cf) addFx(st, { kind: 'seal', x: c.x, y: c.y, r: 62, rgb: def.rgb, dur: def.windup + .3, seed, edo: true });
    }
  }

  function startDash(z, st, a, len, speed, w, dmg, endR, endDmg) {
    const fx = addFx(st, { kind: 'rasen', x0: z.x, y0: z.y, x1: z.x, y1: z.y, a, w, dur: len / speed + .6, seed: Math.random() * 99, z });
    st.dash = { a, speed, left: len / speed, hit: 0, w, dmg, endR, endDmg, fx };
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, s = st.tele[0] || { x: z.x, y: z.y, a: st.aim, r: 150, len: 600, w: 80 };
    const a = st.aim, ca = Math.cos(a), sa = Math.sin(a), seed = Math.random() * 99, x = z.x, y = z.y, tx = st.tx, ty = st.ty;
    api.burst(x, y - 20, m.accent, 10);
    switch (move) {
      // ---------------------------------------------------------- Jiraiya
      case 'oodama':
        startDash(z, st, a, st.len || 600, 1150, 70, D * .9, 240, D * 3.0);
        api.shake(6);
        break;
      case 'yuendan': {
        const toad = st.fx.find(f => f.kind === 'toad');
        const ox = toad ? toad.x : x, oy = toad ? toad.y : y;
        addFx(st, { kind: 'oilfire', x, y, ox, oy, a, R: 780, h: .42, dur: 2.3, seed });
        for (const p of conePts(x, y, a, 780, .42, 80, 90)) later(st, .25 + p.d / 1500, api => api.strike(p.x, p.y, p.r, D * 1.5, null, p.d > 600 && p.d < 700 ? 'fire' : null, true));
        // Burning oil keeps blazing on the ground.
        for (let i = 0; i < 4; i++) {
          const d = 260 + i * 130, b = a + (hash(seed + i) - .5) * .5, bx = x + Math.cos(b) * d, by = y + Math.sin(b) * d;
          later(st, .45 + i * .08, () => addFx(st, { kind: 'burn', x: bx, y: by, r: 95, dur: 2.6, seed: seed + i }));
          for (let k = 1; k <= 5; k++) later(st, .45 + i * .08 + k * .42, api => api.strike(bx, by, 95, D * .38, null, null, true));
        }
        later(st, .5, api => api.shake(8));
        break;
      }
      case 'harijizo':
        st.armor = 1.25; st.hold = 1.1;
        addFx(st, { kind: 'jizo', a, dur: 1.65, seed, z });
        later(st, .95, api => {
          api.strike(z.x, z.y, 240, D * 2.2, null, 'blade');
          api.knockback(z, 250, 170, 0);
          for (let i = 0; i < 10; i++) { const b = a + i / 10 * TAU; api.line(z.x, z.y, z.x + Math.cos(b) * 430, z.y + Math.sin(b) * 430, 20, D * 1.1); }
          api.shake(12); api.burst(z.x, z.y - 30, '#f4f2ea', 24);
        });
        break;
      case 'needles': {
        const drops = [];
        for (let i = 0; i < 22; i++) {
          const b = rand(0, TAU), d = i === 0 ? 0 : Math.sqrt(Math.random()) * s.r;
          drops.push({ x: s.x + Math.cos(b) * d, y: s.y + Math.sin(b) * d, t0: .32 + i * .06, chase: i % 5 === 4, seed: seed + i * 3.7 });
        }
        drops.forEach((dr, i) => {
          if (dr.chase) later(st, dr.t0 - .25, api => { const p = api.player; if (p && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 120) { dr.x = p.x; dr.y = p.y; } });
          later(st, dr.t0 + .3, api => { api.strike(dr.x, dr.y, 72, D * 1.05, null, i % 6 === 0 ? 'blade' : null, true); });
        });
        addFx(st, { kind: 'needles', x, y, drops, dur: 3.2, seed });
        later(st, 1.2, api => api.shake(6));
        break;
      }
      case 'gamabunta': {
        const fx = addFx(st, { kind: 'bunta', x: s.x, y: s.y, a, dur: 3.7, seed, slash: 1.3 });
        later(st, .28, api => {
          api.strike(s.x, s.y, 215, D * 3.2, '#ff9a6a', 'crater');
          for (let i = 0; i < 4; i++) api.world(s.x + Math.cos(i * TAU / 4 + .4) * 150, s.y + Math.sin(i * TAU / 4 + .4) * 150, 110, D * 2, 'crater');
          api.knockback({ x: s.x, y: s.y }, 300, 160, 0);
          api.shake(22); api.burst(s.x, s.y - 30, '#e8d2a8', 30);
          const p = api.player; fx.sa = p ? Math.atan2(p.y - s.y, p.x - s.x) : a;
          addFx(st, { kind: 'tele', s: { k: 'cone', x: s.x, y: s.y, a: fx.sa, r: 520, h: 1.0 }, rgb: '255,120,70', dur: 1.0 });
        });
        later(st, 1.3, api => {
          for (const p of conePts(s.x, s.y, fx.sa, 520, 1.0, 120, 95)) api.strike(p.x, p.y, p.r, D * 2.3, null, p.d > 420 ? 'blade' : null, true);
          api.shake(16);
        });
        break;
      }
      case 'goemon': {
        addFx(st, { kind: 'goemon', x, y, a, L: 980, W: 270, speed: 720, dur: 3.6, seed });
        for (let d = 80; d <= 980; d += 90) later(st, d / 720, api => laneRow(api, x, y, a, d, 270, D * 2.5, d % 270 < 90 ? 'fire' : null));
        for (let k = 1; k <= 4; k++) later(st, 1.4 + k * .4, api => {
          for (let d = 200; d <= 900; d += 230) api.strike(x + ca * d, y + sa * d, 150, D * .45, null, null, true);
        });
        later(st, .2, api => api.shake(14));
        st.hold = .5;
        break;
      }
      // ---------------------------------------------------------- Orochimaru
      case 'senei': {
        const angles = [];
        for (let i = 0; i < 5; i++) angles.push(a + (i - 2) * .2);
        addFx(st, { kind: 'senei', x, y, angles, len: 660, dur: 1.1, seed, z });
        angles.forEach((b, i) => later(st, .2 + i * .015, api => api.line(x, y, x + Math.cos(b) * 660, y + Math.sin(b) * 660, 32, D * 1.5)));
        break;
      }
      case 'kusanagi': {
        addFx(st, { kind: 'kusa', x, y, a, len: 960, R: 570, dur: 1.15, seed, z });
        later(st, .1, api => { api.line(x, y, x + ca * 960, y + sa * 960, 30, D * 2.2, 'blade'); api.shake(7); });
        for (let i = 0; i <= 8; i++) {
          const b = a - 1.1 + i / 8 * 2.2;
          later(st, .45 + i / 8 * .22, api => {
            for (let d = 140; d <= 570; d += 110) api.strike(x + Math.cos(b) * d, y + Math.sin(b) * d, 70, D * 1.8, null, null, true);
          });
        }
        later(st, .6, api => api.world(x + ca * 500, y + sa * 500, 90, D * 2, 'blade', a));
        break;
      }
      case 'yamata': {
        const pts = (st.pts || [{ x: tx, y: ty }]).map((p, i) => ({ x: p.x, y: p.y, t: .15 + i * .12, i }));
        addFx(st, { kind: 'yamata', x, y, pts, dur: 2.6, seed, z });
        pts.forEach((p, i) => later(st, p.t + .12, api => {
          api.strike(p.x, p.y, 100, D * 1.9, null, i % 3 === 0 ? 'crater' : null, true);
          api.shake(9); api.burst(p.x, p.y - 10, '#efeae0', 10);
        }));
        st.hold = .4;
        break;
      }
      case 'daitoppa': {
        addFx(st, { kind: 'wind', x, y, a, R: 740, h: .5, dur: 1.35, seed });
        for (const p of conePts(x, y, a, 740, .5, 80, 95)) later(st, .05 + p.d / 1300, api => api.strike(p.x, p.y, p.r, D * 1.45, null, p.d > 560 && p.d < 660 ? 'shockwave' : null, true));
        later(st, .3, api => {
          const p = api.player; if (!p) return;
          const d = Math.hypot(p.x - x, p.y - y), da = Math.atan2(Math.sin(Math.atan2(p.y - y, p.x - x) - a), Math.cos(Math.atan2(p.y - y, p.x - x) - a));
          if (d < 760 && Math.abs(da) < .55) api.knockback(z, d + 20, 190, 0);
        });
        api.shake(8);
        break;
      }
      case 'manda': {
        addFx(st, { kind: 'manda', x: tx, y: ty, R0: 380, R1: 110, dur: 3.0, seed });
        for (let k = 1; k <= 5; k++) later(st, .15 + k * .18, api => ringStrikes(api, tx, ty, 380 - (270 * easeIn(k / 5)), D * .95));
        later(st, 1.22, api => {
          api.strike(tx, ty, 210, D * 3.2, '#b88cff', 'crater');
          for (let i = 0; i < 4; i++) api.world(tx + Math.cos(i * TAU / 4) * 160, ty + Math.sin(i * TAU / 4) * 160, 110, D * 2, 'crater');
          api.shake(20); api.burst(tx, ty - 30, '#d8c8f0', 28);
        });
        later(st, .2, api => api.shake(10));
        break;
      }
      case 'edo': {
        const cf = st.coffins || [];
        const hx = cf[0] ? cf[0].x : x, hy = cf[0] ? cf[0].y : y, bx = cf[1] ? cf[1].x : x, by = cf[1] ? cf[1].y : y;
        const fx = addFx(st, { kind: 'edo', coffins: [{ x: hx, y: hy, id: 'hashirama', mark: '初代' }, { x: bx, y: by, id: 'tobirama', mark: '二代' }],
          tx, ty, dur: 4.4, seed, wood: null, water: null });
        later(st, .1, api => { api.world(hx, hy, 70, D, 'earth'); api.world(bx, by, 70, D, 'earth'); api.shake(8); });
        // Hashirama: a forest erupts round the mark (Jukai Kōtan).
        later(st, 1.0, () => { fx.wood = { kind: 'wood', x: tx, y: ty, radius: 340, signature: true, fromX: hx, fromY: hy, life: 2, maxLife: 2, t0: fx.age }; });
        later(st, 1.25, api => {
          api.strike(tx, ty, 190, D * 2.8, null, 'earth');
          api.world(tx + 200, ty, 120, D * 2, 'earth'); api.world(tx - 200, ty, 120, D * 2, 'earth');
          api.shake(18); api.burst(tx, ty - 40, '#9ad070', 30);
        });
        for (let k = 0; k < 3; k++) later(st, 1.35 + k * .22, api => ringStrikes(api, tx, ty, 300 - k * 60, D * 1.25));
        // Tobirama: Suiryūdan straight at whoever stands.
        later(st, 1.25, api => {
          const p = api.player, px = p ? p.x : tx, py = p ? p.y : ty, b = Math.atan2(py - by, px - bx);
          fx.wb = b; fx.wx = bx + Math.cos(b) * 900; fx.wy = by + Math.sin(b) * 900; fx.wpx = px; fx.wpy = py;
          addFx(st, { kind: 'tele', s: { k: 'line', x: bx, y: by, a: b, len: 900, w: 80 }, rgb: '110,200,255', dur: .65 });
        });
        later(st, 1.9, api => {
          fx.water = { kind: 'water', x: fx.wpx, y: fx.wpy, radius: 220, signature: true, fromX: bx, fromY: by, life: 1.3, maxLife: 1.3, t0: fx.age };
          api.line(bx, by, fx.wx, fx.wy, 80, D * 2.3, 'vortex');
          api.strike(fx.wpx, fx.wpy, 200, D * 1.6, null, null, true);
          api.shake(14);
        });
        st.hold = 1.0;
        break;
      }
      // ---------------------------------------------------------- Kabuto
      case 'muki': {
        const lines = [-1, 0, 1].map(i => a + i * .3);
        const stakes = [];
        lines.forEach((b, li) => {
          for (let d = 70, k = 0; d <= 780; d += 62, k++) {
            const px = x + Math.cos(b) * d + (hash(seed + li * 40 + k) - .5) * 20, py = y + Math.sin(b) * d + (hash(seed + li * 70 + k) - .5) * 20;
            stakes.push({ x: px, y: py, t: d / 900, h: 70 + hash(seed + k * 3 + li) * 70, v: (k + li) % 4, lean: (hash(seed + k + li * 9) - .5) * .4 });
            later(st, d / 900, api => api.strike(px, py, 58, D * 1.35, null, k % 4 === 3 ? 'earth' : null, true));
          }
        });
        stakes.sort((p, q) => p.y - q.y);
        addFx(st, { kind: 'muki', x, y, lines, stakes, dur: 2.5, seed });
        api.shake(8);
        break;
      }
      case 'hakugeki': {
        addFx(st, { kind: 'shriek', a, dur: 1.6, seed, z });
        for (let k = 0; k < 3; k++) later(st, .08 + k * .36, api => { api.strike(z.x, z.y, 470, D * 1.15, null, null, true); api.shake(9); });
        later(st, .1, api => api.world(z.x, z.y, 170, D * 2, 'shockwave'));
        later(st, .9, api => api.knockback(z, 480, 120, 0));
        st.hold = .9;
        break;
      }
      case 'ryudo': {
        const drops = [];
        for (let i = 0; i < 26; i++) {
          const b = rand(0, TAU), d = i === 0 ? 0 : Math.sqrt(Math.random()) * s.r;
          drops.push({ x: s.x + Math.cos(b) * d, y: s.y + Math.sin(b) * d, t0: .25 + i * .05, chase: i % 5 === 3, seed: seed + i * 2.9, white: i % 3 === 0 });
        }
        drops.forEach((dr, i) => {
          if (dr.chase) later(st, dr.t0 - .2, api => { const p = api.player; if (p && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 120) { dr.x = p.x; dr.y = p.y; } });
          later(st, dr.t0 + .38, api => api.strike(dr.x, dr.y, 74, D * 1.05, null, i % 7 === 0 ? 'earth' : null, true));
        });
        addFx(st, { kind: 'snakerain', x: s.x, y: s.y, r: s.r, drops, dur: 3.3, seed });
        break;
      }
      case 'mandala': {
        addFx(st, { kind: 'mandala', x, y, a, len: 900, W: 240, speed: 660, dur: 2.5, seed });
        for (let d = 80; d <= 900; d += 85) later(st, d / 660, api => laneRow(api, x, y, a, d, 240, D * 1.75, d % 255 < 85 ? 'earth' : null));
        api.shake(6);
        break;
      }
      case 'edo2': {
        const cf = st.coffins || [];
        const ix = cf[0] ? cf[0].x : x, iy = cf[0] ? cf[0].y : y, dx = cf[1] ? cf[1].x : x, dy = cf[1] ? cf[1].y : y;
        const fx = addFx(st, { kind: 'edo', coffins: [{ x: ix, y: iy, id: 'itachi', mark: '穢土' }, { x: dx, y: dy, id: 'deidara', mark: '穢土' }],
          tx, ty, dur: 3.4, seed, ball: null, birds: null });
        later(st, .1, api => { api.world(ix, iy, 70, D, 'earth'); api.world(dx, dy, 70, D, 'earth'); api.shake(8); });
        // Itachi: Gōkakyū; Deidara: a flock of C1 clay birds.
        later(st, .95, () => { fx.ball = { x0: ix, y0: iy, x1: tx, y1: ty, t0: fx.age, T: .5 }; });
        later(st, 1.45, api => {
          api.strike(tx, ty, 200, D * 2.6, '#ff8a3a', 'fire'); api.shake(15);
          addFx(st, { kind: 'blast', x: tx, y: ty, r: 220, dur: 1.1, seed });
        });
        const birds = [];
        for (let i = 0; i < 6; i++) { const b = i / 6 * TAU + seed; birds.push({ x: tx + Math.cos(b) * 230, y: ty + Math.sin(b) * 230, t: 1.15 + i * .12 }); }
        later(st, 1.1, () => { fx.birds = birds; fx.bx = dx; fx.by = dy; fx.bt0 = fx.age; });
        birds.forEach(b => later(st, b.t + .55, api => {
          api.strike(b.x, b.y, 95, D * 1.35, null, null, true);
          addFx(st, { kind: 'blast', x: b.x, y: b.y, r: 105, dur: .8, seed: b.x });
          api.shake(7);
        }));
        st.hold = .8;
        break;
      }
      case 'dairyu': {
        const L = st.len || 900, ex = x + ca * L, ey = y + sa * L;
        addFx(st, { kind: 'dragon', x, y, a, L, ex, ey, dur: 3.5, seed });
        for (let d = 120; d <= L; d += 90) later(st, .55 * Math.sqrt(d / L), api => api.strike(x + ca * d, y + sa * d, 105, D * 2.4, null, d > L - 200 && d < L - 100 ? 'crater' : null, true));
        for (let k = 1; k <= 5; k++) later(st, .55 + k * .18, api => ringStrikes(api, ex, ey, 330 - 220 * easeIn(k / 5), D * .95));
        later(st, 1.55, api => {
          api.strike(ex, ey, 260, D * 3.6, '#e8f4ee', 'crater');
          for (let i = 0; i < 5; i++) api.world(ex + Math.cos(i * TAU / 5) * 210, ey + Math.sin(i * TAU / 5) * 210, 130, D * 2.4, 'crater');
          api.knockback({ x: ex, y: ey }, 330, 180, 0);
          api.shake(24); api.burst(ex, ey - 40, '#f2efe8', 36);
        });
        later(st, .5, api => api.shake(12));
        st.hold = 1.2;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ update
  function update(z, dt, api) {
    const m = members[z.bossId];
    if (!m) return;
    const st = state(z);
    st.t += dt;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; z.manualBusy = false; st.dash = null; st.ev.length = 0; st.windup = 0; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.armor = Math.max(0, st.armor - dt);
    st.hold = Math.max(0, st.hold - dt);
    z.armorScale = (m.armor || 1) * (st.armor > 0 ? .25 : 1);
    z.kageDash = 0;

    // Jiraiya rides the giant Rasengan through everything in its lane.
    if (st.dash) {
      const ds = st.dash, step = Math.min(ds.left, dt) * ds.speed;
      ds.left -= dt;
      api.move(Math.cos(ds.a) * step, Math.sin(ds.a) * step);
      ds.fx.x1 = z.x; ds.fx.y1 = z.y;
      if ((ds.hit -= dt) <= 0) { ds.hit = .07; api.strike(z.x + Math.cos(ds.a) * 40, z.y + Math.sin(ds.a) * 40, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      if (ds.left <= 0) {
        const ex = z.x + Math.cos(ds.a) * 40, ey = z.y + Math.sin(ds.a) * 40;
        api.strike(ex, ey, ds.endR, ds.endDmg, '#9ad0ff', 'vortex');
        api.world(ex, ey, ds.endR * .9, ds.endDmg, 'crater');
        api.knockback(z, ds.endR + 40, 170, 0);
        api.shake(18);
        addFx(st, { kind: 'ooblast', x: ex, y: ey, r: ds.endR, dur: 1.4, seed: Math.random() * 99 });
        ds.fx.done = true;
        st.dash = null;
      }
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash) {
      if (z.manual) {
        // Controlled by the user: only the requested jutsu, once nothing is still running.
        if (z.manualCast != null && st.hold <= 0) {
          const mv = moves(z)[z.manualCast];
          z.manualCast = null;
          if (mv) { st.force = mv.id; announce(z, st, m, api); }
        }
      } else {
        st.timer -= dt;
        const p = api.player;
        if (st.timer <= 0 && st.hold <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 860) announce(z, st, m, api);
      }
    }
    z.manualBusy = st.windup > 0 || !!st.dash || st.hold > 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
  }

  // ------------------------------------------------------------------ baked art
  const O_TOAD = '#241510';
  const TOADS = {
    bunta: { skin: '#c8452e', dark: '#8a2a1a', light: '#ee7c54', belly: '#f2d9a6', vest: '#2a3354', pipe: true, scar: true, blade: true },
    kichi: { skin: '#e8863a', dark: '#a8541e', light: '#ffb474', belly: '#f8e2b0', vest: '#4a5a8a' },
    pa: { skin: '#7d9066', dark: '#52634a', light: '#a8bb8c', belly: '#ece6c8', brows: true },
    ma: { skin: '#9c88aa', dark: '#6a5a7c', light: '#c4b2d2', belly: '#f2e8da', brows: true }
  };
  // A toad seen from the front and a little above, in a 200×170 unit box (feet at the bottom).
  function paintToad(g, T) {
    const O = O_TOAD;
    const fillStroke = (fill, lw = 3) => { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = O; g.stroke(); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (T.blade) {
      // Gamabunta's dosu: a huge sheathed blade slung at his side.
      g.beginPath(); g.moveTo(150, 22); g.lineTo(160, 18); g.lineTo(198, 150); g.lineTo(186, 154); g.closePath(); fillStroke('#2a2430', 2.6);
      g.beginPath(); g.moveTo(146, 10); g.lineTo(156, 6); g.lineTo(161, 22); g.lineTo(151, 25); g.closePath(); fillStroke('#c8a050', 2);
      g.strokeStyle = 'rgba(160,150,200,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(156, 28); g.lineTo(190, 146); g.stroke();
    }
    // Haunches and body.
    g.beginPath(); g.ellipse(30, 128, 28, 24, -.3, 0, TAU); fillStroke(T.dark);
    g.beginPath(); g.ellipse(170, 128, 28, 24, .3, 0, TAU); fillStroke(T.dark);
    const body = () => { g.beginPath(); g.ellipse(100, 108, 86, 54, 0, 0, TAU); };
    body(); g.fillStyle = T.skin; g.fill();
    g.save(); body(); g.clip();
    g.fillStyle = T.dark; g.beginPath(); g.ellipse(100, 166, 120, 50, 0, 0, TAU); g.fill();
    g.fillStyle = T.light; g.beginPath(); g.ellipse(90, 74, 66, 24, -.1, 0, TAU); g.fill();
    g.fillStyle = T.belly; g.beginPath(); g.ellipse(100, 132, 54, 30, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(80,40,20,.18)'; g.beginPath(); g.ellipse(100, 142, 54, 18, 0, 0, TAU); g.fill();
    for (let i = 0; i < 22; i++) {
      const wx = 20 + hash(i * 3.1 + 1) * 160, wy = 70 + hash(i * 5.7) * 40, r = 2 + hash(i * 1.7) * 3.5;
      if (Math.abs(wx - 100) < 50 && wy > 100) continue;
      g.fillStyle = 'rgba(70,20,10,.35)'; g.beginPath(); g.arc(wx, wy, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,220,180,.3)'; g.beginPath(); g.arc(wx - r * .3, wy - r * .3, r * .4, 0, TAU); g.fill();
    }
    if (T.vest) {
      // Happi coat over the shoulders, open over the belly.
      g.fillStyle = T.vest;
      g.beginPath(); g.moveTo(8, 96); g.quadraticCurveTo(30, 66, 64, 70); g.lineTo(58, 168); g.lineTo(0, 168); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(192, 96); g.quadraticCurveTo(170, 66, 136, 70); g.lineTo(142, 168); g.lineTo(200, 168); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(56, 70, 5, 100); g.fillRect(139, 70, 5, 100);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 140, 200, 30);
      g.fillStyle = '#e8e2d0'; g.font = 'bold 22px "Yu Mincho","MS Mincho",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('油', 34, 118); g.fillText('油', 166, 118);
    }
    g.restore();
    body(); g.lineWidth = 3.4; g.strokeStyle = O; g.stroke();
    // Wide mouth.
    g.strokeStyle = O; g.lineWidth = 3.4; g.beginPath(); g.moveTo(30, 84); g.quadraticCurveTo(100, 116, 170, 84); g.stroke();
    g.strokeStyle = 'rgba(255,220,190,.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(40, 82); g.quadraticCurveTo(100, 110, 160, 82); g.stroke();
    g.fillStyle = O; g.beginPath(); g.arc(92, 70, 2.4, 0, TAU); g.arc(108, 70, 2.4, 0, TAU); g.fill();
    // Bulging eyes with toad bar pupils.
    for (const [ex, ey] of [[60, 44], [140, 44]]) {
      g.beginPath(); g.ellipse(ex, ey + 4, 22, 20, 0, Math.PI, TAU); g.lineTo(ex + 22, ey + 16); g.lineTo(ex - 22, ey + 16); g.closePath(); fillStroke(T.skin);
      g.beginPath(); g.ellipse(ex, ey + 2, 15, 12, 0, 0, TAU); fillStroke('#f4c642', 2.4);
      g.fillStyle = '#ffe9a0'; g.beginPath(); g.ellipse(ex - 2, ey + 6, 10, 5, 0, 0, TAU); g.fill();
      g.fillStyle = '#140a08'; g.fillRect(ex - 11, ey - 1, 22, 6);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex - 6, ey - 4, 2.6, 0, TAU); g.fill();
      if (T.brows) { g.strokeStyle = '#f4f2ea'; g.lineWidth = 4; g.beginPath(); g.moveTo(ex - 18, ey - 14); g.quadraticCurveTo(ex, ey - 22, ex + 16, ey - 12); g.stroke(); }
    }
    if (T.scar) { g.strokeStyle = '#4a120a'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(46, 18); g.lineTo(58, 40); g.lineTo(52, 50); g.lineTo(68, 72); g.stroke(); }
    // Front legs with splayed toes.
    for (const [lx, s] of [[56, -1], [144, 1]]) {
      g.beginPath(); g.moveTo(lx - 14, 120); g.quadraticCurveTo(lx + s * 4, 136, lx - 12, 160); g.lineTo(lx + 16, 160); g.quadraticCurveTo(lx + 14, 136, lx + 12, 118); g.closePath(); fillStroke(T.skin, 2.6);
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(lx + k * 11 + 2, 163, 7, 5, k * .4, 0, TAU); fillStroke(T.light, 2.2); }
    }
    if (T.pipe) {
      g.strokeStyle = O; g.lineWidth = 7; g.beginPath(); g.moveTo(150, 92); g.lineTo(186, 70); g.stroke();
      g.strokeStyle = '#7a4a24'; g.lineWidth = 4; g.stroke();
      g.beginPath(); g.moveTo(180, 70); g.lineTo(186, 52); g.lineTo(198, 56); g.lineTo(194, 74); g.closePath(); fillStroke('#5a3418', 2.4);
      g.fillStyle = '#ff9a3a'; g.fillRect(184, 53, 11, 3);
    }
  }
  function toadSprite(kind) { return Kit().sprite('sn:toad:' + kind, 400, 340, g => { g.scale(2, 2); paintToad(g, TOADS[kind]); }); }
  // Draw a toad standing at (x, y) (feet), w px wide; squash for a landing / breathing bounce.
  function drawToad(ctx, kind, x, y, w, f, squash = 1, alpha = 1) {
    const img = toadSprite(kind), h = w * .85;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); if (f < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h * squash, w, h * squash);
    ctx.restore();
  }

  // Edo Tensei coffin: an upright dark-wood box with an engraved lid, in two layers (box, lid).
  function coffinSprite(mark, part) {
    return Kit().sprite('sn:coffin:' + part + ':' + mark, 100, 200, g => {
      const P = [[50, 6], [90, 26], [86, 194], [14, 194], [10, 26]];
      const path = (k = 0) => { g.beginPath(); P.forEach(([px, py], i) => { const qx = 50 + (px - 50) * (1 - k), qy = 100 + (py - 100) * (1 - k * .5); i ? g.lineTo(qx, qy) : g.moveTo(qx, qy); }); g.closePath(); };
      g.lineJoin = 'round';
      if (part === 'box') {
        path(); g.fillStyle = '#3a2618'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#140c08'; g.stroke();
        path(.14); g.fillStyle = '#120a08'; g.fill();
        g.fillStyle = 'rgba(120,80,200,.25)'; g.fillRect(20, 40, 60, 150);
        return;
      }
      path(); g.fillStyle = '#6a4630'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#82593c'; g.fillRect(10, 0, 30, 200);
      g.fillStyle = '#4a2e1e'; g.fillRect(70, 0, 30, 200);
      g.strokeStyle = 'rgba(40,24,14,.5)'; g.lineWidth = 1.4;
      for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(14 + i * 9, 20); g.quadraticCurveTo(18 + i * 9 + (hash(i) - .5) * 8, 110, 14 + i * 9, 196); g.stroke(); }
      g.restore();
      path(); g.lineWidth = 4; g.strokeStyle = '#140c08'; g.stroke();
      path(.18); g.lineWidth = 2; g.strokeStyle = 'rgba(30,18,10,.7)'; g.stroke();
      g.fillStyle = '#efe2c4'; g.font = 'bold 26px "Yu Mincho","MS Mincho",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      [...mark].forEach((ch, i) => g.fillText(ch, 50, 80 + i * 34));
    });
  }

  // Stone stake (Muki Tensei): a jagged grey spike, base at the bottom of a 60×160 box.
  function stakeSprite(v) {
    return Kit().sprite('sn:stake:' + v, 60, 160, g => {
      const lean = (hash(v + 3) - .5) * 14, jag = i => (hash(v * 9 + i) - .5) * 6;
      const L = [[6, 158], [10 + jag(1), 110], [16 + jag(2), 70], [24 + lean * .5 + jag(3), 30], [30 + lean, 4]];
      const R = [[30 + lean, 4], [36 + lean * .5 + jag(4), 34], [44 + jag(5), 76], [50 + jag(6), 116], [54, 158]];
      const path = () => { g.beginPath(); L.concat(R).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
      path(); g.fillStyle = '#8a8478'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#b4ad9e'; g.beginPath(); g.moveTo(0, 160); L.forEach(([x, y]) => g.lineTo(x + 2, y)); g.lineTo(30 + lean, 160); g.closePath(); g.fill();
      g.fillStyle = '#5c564c'; g.beginPath(); g.moveTo(60, 160); R.slice().reverse().forEach(([x, y]) => g.lineTo(x - 4, y)); g.lineTo(34 + lean, 160); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,36,30,.7)'; g.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(20 + hash(i + v) * 20, 40 + i * 30); g.lineTo(26 + hash(i * 2 + v) * 14, 56 + i * 30); g.lineTo(22 + hash(i * 3 + v) * 18, 70 + i * 30); g.stroke(); }
      g.restore();
      path(); g.lineWidth = 3; g.strokeStyle = '#2a2620'; g.lineJoin = 'round'; g.stroke();
    });
  }

  // Small clay bird (Deidara's C1).
  function birdSprite() {
    return Kit().sprite('sn:bird', 64, 48, g => {
      g.lineJoin = 'round'; g.strokeStyle = '#3a3440'; g.lineWidth = 2.4; g.fillStyle = '#f2eee4';
      g.beginPath(); g.moveTo(6, 22); g.quadraticCurveTo(24, 4, 34, 18); g.quadraticCurveTo(46, 2, 60, 12); g.quadraticCurveTo(46, 22, 40, 28); g.quadraticCurveTo(30, 40, 18, 30); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#c8c0b0'; g.beginPath(); g.moveTo(18, 30); g.quadraticCurveTo(30, 38, 40, 28); g.lineTo(30, 26); g.closePath(); g.fill();
      g.fillStyle = '#3a3440'; g.beginPath(); g.arc(46, 14, 2, 0, TAU); g.fill();
    });
  }

  // ------------------------------------------------------------------ serpents
  // PB holds a polyline (x, y pairs). serpent() strokes a tapered, cel-shaded body through it.
  const PB = new Float32Array(200);
  const PAL = {
    white: { line: '#2a2236', dark: '#b6aec2', body: '#efece4', light: '#ffffff', belly: '#e4d8b2', band: 'rgba(110,98,140,.32)', eye: '#ffd23a', mouth: '#7a1430' },
    manda: { line: '#1a1028', dark: '#46306e', body: '#7652aa', light: '#b496e0', belly: '#d8c48c', band: 'rgba(20,8,40,.42)', eye: '#ffd23a', mouth: '#5a0e2a' },
    olive: { line: '#1c1a10', dark: '#3e4626', body: '#66743e', light: '#a6b47a', belly: '#d8c888', band: 'rgba(20,24,8,.4)', eye: '#ffd23a', mouth: '#6a1428' },
    pale: { line: '#262030', dark: '#8a8496', body: '#c8c4cc', light: '#f2f0f6', belly: '#e0d6b4', band: 'rgba(40,30,60,.35)', eye: '#ffd23a', mouth: '#6a1428' }
  };
  function chunkPath(ctx, n, c, chunks, dx, dy) {
    const i0 = Math.floor(c * (n - 1) / chunks), i1 = Math.min(n - 1, Math.ceil((c + 1) * (n - 1) / chunks));
    ctx.beginPath(); ctx.moveTo(PB[i0 * 2] + dx, PB[i0 * 2 + 1] + dy);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(PB[i * 2] + dx, PB[i * 2 + 1] + dy);
  }
  function serpent(ctx, n, w0, w1, pal, phase = 0, chunks = 0) {
    if (n < 2) return;
    chunks = chunks || (n > 10 ? 4 : 2);
    const W = c => w0 + (w1 - w0) * (chunks === 1 ? 0 : c / (chunks - 1));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let c = 0; c < chunks; c++) { chunkPath(ctx, n, c, chunks, 0, 0); ctx.strokeStyle = pal.line; ctx.lineWidth = W(c) + 5; ctx.stroke(); }
    for (let c = 0; c < chunks; c++) { chunkPath(ctx, n, c, chunks, 0, 0); ctx.strokeStyle = pal.dark; ctx.lineWidth = W(c); ctx.stroke(); }
    for (let c = 0; c < chunks; c++) { const w = W(c); chunkPath(ctx, n, c, chunks, 0, w * .2); ctx.strokeStyle = pal.belly; ctx.lineWidth = w * .3; ctx.stroke(); }
    for (let c = 0; c < chunks; c++) { const w = W(c); chunkPath(ctx, n, c, chunks, 0, -w * .13); ctx.strokeStyle = pal.body; ctx.lineWidth = w * .62; ctx.stroke(); }
    ctx.lineCap = 'butt';
    for (let c = 0; c < chunks; c++) {
      const w = W(c); ctx.setLineDash([w * .16, w * .3]); ctx.lineDashOffset = phase * w;
      chunkPath(ctx, n, c, chunks, 0, -w * .08); ctx.strokeStyle = pal.band; ctx.lineWidth = w * .82; ctx.stroke();
    }
    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineCap = 'round';
    for (let c = 0; c < chunks; c++) { const w = W(c); chunkPath(ctx, n, c, chunks, 0, -w * .3); ctx.strokeStyle = pal.light; ctx.lineWidth = Math.max(1.2, w * .14); ctx.stroke(); }
  }
  // Fill PB with a quadratic bezier (x0,y0)→(cx,cy)→(x1,y1) between t0 and t1, plus a sideways wave.
  function bezPts(x0, y0, cx, cy, x1, y1, t0, t1, n, wave = 0, freq = 3, ph = 0, o = 0) {
    for (let i = 0; i < n; i++) {
      const t = t0 + (t1 - t0) * i / (n - 1), u = 1 - t;
      let px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
      if (wave) {
        const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy), dl = Math.hypot(dx, dy) || 1;
        const s = Math.sin(t * freq * TAU + ph) * wave * Math.sin(Math.PI * Math.min(1, t * 1.3));
        px += -dy / dl * s; py += dx / dl * s;
      }
      PB[(o + i) * 2] = px; PB[(o + i) * 2 + 1] = py;
    }
    return o + n;
  }
  // Serpent head in profile looking along `a` (flipped so the skull stays on top); `open` 0..1 jaw.
  function serpentHead(ctx, x, y, a, s, pal, open, horned) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); if (Math.cos(a) < 0) ctx.scale(1, -1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const lw = Math.max(2, s * .07);
    if (horned) {
      for (const [x0, y0, x1, y1, cx, cy] of [[-.3, -.45, -1.2, -.95, -.8, -.4], [-.1, -.5, -.85, -1.2, -.3, -1.0]]) {
        ctx.strokeStyle = pal.line; ctx.lineWidth = s * .2; ctx.beginPath(); ctx.moveTo(x0 * s, y0 * s); ctx.quadraticCurveTo(cx * s, cy * s, x1 * s, y1 * s); ctx.stroke();
        ctx.strokeStyle = '#f4f0e6'; ctx.lineWidth = s * .12; ctx.stroke();
      }
    }
    // Lower jaw, rotated open.
    ctx.save(); ctx.rotate(open * .55);
    ctx.beginPath(); ctx.moveTo(-s * .55, s * .02); ctx.quadraticCurveTo(s * .2, s * .38, s * .92, s * .1); ctx.lineTo(s * .86, s * .01); ctx.quadraticCurveTo(s * .2, s * .14, -s * .4, -s * .04); ctx.closePath();
    ctx.fillStyle = pal.dark; ctx.fill(); ctx.strokeStyle = pal.line; ctx.lineWidth = lw; ctx.stroke();
    ctx.fillStyle = pal.belly; ctx.beginPath(); ctx.moveTo(-s * .4, s * .12); ctx.quadraticCurveTo(s * .2, s * .34, s * .86, s * .1); ctx.quadraticCurveTo(s * .2, s * .24, -s * .4, s * .06); ctx.fill();
    if (open > .1) { ctx.fillStyle = '#ffffff'; for (const fx of [.62, .4]) { ctx.beginPath(); ctx.moveTo(fx * s, s * .04); ctx.lineTo((fx + .05) * s, -s * .12); ctx.lineTo((fx + .1) * s, s * .05); ctx.fill(); } }
    ctx.restore();
    if (open > .05) {
      ctx.fillStyle = pal.mouth;
      ctx.beginPath(); ctx.moveTo(-s * .4, 0); ctx.lineTo(s * .95, s * .08); ctx.lineTo(Math.cos(open * .55) * s * .9, Math.sin(open * .55) * s * .9 + s * .06); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e04a6a'; ctx.lineWidth = s * .05;
      ctx.beginPath(); ctx.moveTo(s * .2, s * .1); ctx.quadraticCurveTo(s * .9, s * (.1 + open * .3), s * 1.35, s * (.05 + open * .25)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 1.35, s * (.05 + open * .25)); ctx.lineTo(s * 1.5, s * (-.05 + open * .25));
      ctx.moveTo(s * 1.35, s * (.05 + open * .25)); ctx.lineTo(s * 1.5, s * (.15 + open * .25)); ctx.stroke();
    }
    // Upper skull.
    ctx.beginPath(); ctx.moveTo(-s * .78, -s * .02); ctx.quadraticCurveTo(-s * .62, -s * .62, s * .12, -s * .56);
    ctx.quadraticCurveTo(s * .78, -s * .48, s * 1.12, -s * .08); ctx.quadraticCurveTo(s * 1.15, s * .06, s * 1.0, s * .1); ctx.lineTo(-s * .5, s * .12); ctx.closePath();
    ctx.fillStyle = pal.body; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = pal.dark; ctx.fillRect(-s, -s * .1, s * 2.4, s * .4);
    ctx.fillStyle = pal.light; ctx.beginPath(); ctx.ellipse(s * .05, -s * .48, s * .55, s * .1, -.05, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.band; ctx.lineWidth = Math.max(1, s * .04);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-s * .45 + i * s * .2, -s * .3, s * .12, 3.5, 5.9); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = pal.line; ctx.lineWidth = lw; ctx.stroke();
    // Brow ridge, slit eye, nostril, upper fangs.
    ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.moveTo(-s * .12, -s * .42); ctx.quadraticCurveTo(s * .2, -s * .54, s * .46, -s * .36); ctx.quadraticCurveTo(s * .2, -s * .44, -s * .12, -s * .36); ctx.fill();
    ctx.fillStyle = pal.eye; ctx.beginPath(); ctx.ellipse(s * .2, -s * .28, s * .14, s * .09, -.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1, s * .03); ctx.stroke();
    ctx.fillStyle = '#100808'; ctx.beginPath(); ctx.ellipse(s * .21, -s * .28, s * .025, s * .08, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s * .15, -s * .31, s * .022, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.line; ctx.beginPath(); ctx.arc(s * .96, -s * .1, s * .03, 0, TAU); ctx.fill();
    if (open > .1) { ctx.fillStyle = '#ffffff'; for (const fx of [.7, .48]) { ctx.beginPath(); ctx.moveTo(fx * s, s * .08); ctx.lineTo((fx + .04) * s, s * (.08 + .16 * open + .06)); ctx.lineTo((fx + .09) * s, s * .09); ctx.fill(); } }
    ctx.restore();
  }
  // Many small snakes in one batch: every body shares one path per tone (cheap for floods).
  // list items: { x, y, a, len, w, ph } — head at (x, y) looking along a, body trailing behind.
  const SNK = [];
  function snakeSwarm(ctx, list, pal, time, alpha = 1) {
    if (!list.length) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const body = (dy, layer) => {
      ctx.beginPath();
      for (const s of list) {
        const ca = Math.cos(s.a), sa = Math.sin(s.a), N = 6;
        for (let i = 0; i <= N; i++) {
          const t = i / N, d = t * s.len, wv = Math.sin(t * 7 - time * 12 + s.ph) * s.w * 1.1 * t;
          const px = s.x - ca * d - sa * wv, py = s.y - sa * d + ca * wv + dy * s.w;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
      }
      ctx.stroke();
    };
    const w = list[0].w;
    ctx.strokeStyle = pal.line; ctx.lineWidth = w + 3; body(0);
    ctx.strokeStyle = pal.dark; ctx.lineWidth = w; body(0);
    ctx.strokeStyle = pal.body; ctx.lineWidth = w * .6; body(-.14);
    ctx.strokeStyle = pal.light; ctx.lineWidth = Math.max(1, w * .18); body(-.3);
    // Heads: a dark wedge and a gold eye dot.
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    for (const s of list) { const ca = Math.cos(s.a), sa = Math.sin(s.a), r = s.w * .95; ctx.moveTo(s.x + ca * r * 1.6, s.y + sa * r * 1.6); ctx.lineTo(s.x - sa * r, s.y + ca * r); ctx.lineTo(s.x + sa * r, s.y - ca * r); ctx.closePath(); }
    ctx.fill();
    ctx.fillStyle = pal.eye;
    ctx.beginPath(); for (const s of list) { ctx.moveTo(s.x + 2, s.y - s.w * .3); ctx.arc(s.x, s.y - s.w * .3, Math.max(1, s.w * .2), 0, TAU); } ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------ draw helpers
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath();
    ctx.arc(x, y, r1, a0, a1);
    if (r0 > 0) ctx.arc(x, y, r0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14)); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12)); ctx.stroke();
      }
    }
  }
  function teleShape(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    if (s.k === 'c') { markCircle(ctx, s.x, s.y, s.r, rgb, k, time, s.faint); return; }
    if (s.k === 'ring') {
      const r = s.r - (s.r - s.r0) * easeIn(k);
      ctx.fillStyle = 'rgba(24,12,8,.12)'; sector(ctx, s.x, s.y, s.r0, s.r, 0, TAU); ctx.fill('evenodd');
      ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      return;
    }
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`;
    if (s.k === 'line') {
      ctx.fillStyle = 'rgba(24,12,8,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
      ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = `rgba(24,12,8,${s.faint ? .07 : .15})`; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${(s.faint ? .08 : .14) + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
    } else if (s.k === 'star') {
      ctx.fillStyle = `rgba(${rgb},${.1 + .14 * k})`;
      for (let i = 0; i < s.n; i++) { ctx.save(); ctx.rotate(i / s.n * TAU); ctx.fillRect(0, -s.w, s.len * k, s.w * 2); ctx.strokeRect(0, -s.w, s.len, s.w * 2); ctx.restore(); }
    }
    ctx.restore();
  }
  // Dark under-stroke then a light stroke, so pale shapes read on bright ground.
  function inkStroke(ctx, light, under, w) {
    ctx.strokeStyle = under; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.strokeStyle = light; ctx.lineWidth = w; ctx.stroke();
  }
  function groundRing(ctx, x, y, r, alpha, rgb, w = 6) {
    if (alpha <= .01 || r <= 1) return;
    ctx.strokeStyle = `rgba(30,18,10,${.4 * alpha})`; ctx.lineWidth = w + 4; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${.85 * alpha})`; ctx.lineWidth = w; ctx.stroke();
  }
  function crater(ctx, x, y, r, alpha, seed) {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(40,26,16,${.42 * alpha})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(20,12,8,${.35 * alpha})`; ctx.beginPath(); ctx.arc(x, y, r * .55, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(30,20,12,${.6 * alpha})`; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + seed, r1 = r * .5, r2 = r * (1.05 + hash(seed + i) * .4);
      ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a + .12) * (r1 + r2) * .55, y + Math.sin(a + .12) * (r1 + r2) * .55); ctx.lineTo(x + Math.cos(a - .05) * r2, y + Math.sin(a - .05) * r2);
    }
    ctx.stroke();
  }
  function dustRing(ctx, x, y, r, p, alpha, seed, n = 14, kind = 'dust') {
    const K = Kit(), img = K.puff(kind), e = easeOut(p);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + seed, d = r * (.4 + e * .75) * (.85 + hash(seed + i) * .3);
      K.stamp(ctx, img, x + Math.cos(a) * d, y + Math.sin(a) * d * .8 - 8 - e * 12, (12 + r * .07) * (.7 + e * .6), alpha * (1 - easeIn(p)) * .62);
    }
  }
  function flame(ctx, v, x, y, w, alpha) {
    if (alpha <= .02) return;
    const img = Kit().flame(v), h = w * 2;
    ctx.globalAlpha = alpha; ctx.drawImage(img, x - w / 2, y - h * FB, w, h); ctx.globalAlpha = 1;
  }
  function lit(ctx, fn) { const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; fn(); ctx.globalCompositeOperation = op; }

  // ------------------------------------------------------------------ FX: Jiraiya
  const FX = {};
  FX.tele = [(ctx, fx, time) => teleShape(ctx, fx.s, fx.rgb, clamp01(fx.age / fx.dur), time), null];
  FX.seal = [(ctx, fx, time) => {
    // Summoning / Edo Tensei seal drawn on the ground: rings of script and a growing dark core.
    const k = easeOut(fx.age / .4), fade = 1 - win(fx.age, fx.dur - .2, fx.dur), r = fx.r * k, x = fx.x, y = fx.y;
    ctx.globalAlpha = fade;
    ctx.fillStyle = fx.edo ? 'rgba(20,10,30,.45)' : 'rgba(30,16,10,.3)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    groundRing(ctx, x, y, r, 1, fx.rgb, 3); groundRing(ctx, x, y, r * .72, .8, fx.rgb, 2);
    ctx.strokeStyle = 'rgba(20,10,20,.75)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + time * .6; ctx.moveTo(x + Math.cos(a) * r * .74, y + Math.sin(a) * r * .74); ctx.lineTo(x + Math.cos(a) * r * .98, y + Math.sin(a) * r * .98); }
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - time; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .7); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,10,20,.85)'; ctx.font = `900 ${Math.round(r * .32)}px "Yu Mincho","MS Mincho",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (r > 20) ctx.fillText(fx.edo ? '穢' : '口寄', x, y);
    lit(ctx, () => Kit().glow(ctx, x, y, r * 1.3, fx.rgb, .35 * fade, false, .6));
    ctx.globalAlpha = 1;
  }, (ctx, fx) => {
    // Summoning smoke rising out of the seal.
    const K = Kit(), img = K.puff(fx.edo ? 'violet' : 'smoke'), p = fx.age / fx.dur;
    for (let i = 0; i < 6; i++) {
      const ph = (p * 1.6 + i / 6) % 1, a = hash(fx.seed + i) * TAU;
      K.stamp(ctx, img, fx.x + Math.cos(a) * fx.r * .5, fx.y - ph * 120, 18 + ph * 30, bell(ph) * .55 * (1 - easeIn(p)));
    }
  }];

  // Oodama Rasengan: Jiraiya drives a sphere taller than himself through everything.
  function bigOrb(ctx, x, y, r, time, alpha = 1) {
    const K = Kit();
    lit(ctx, () => { K.glow(ctx, x, y, r * 2.2, '90,170,255', .45 * alpha); });
    ctx.fillStyle = `rgba(16,40,96,${.3 * alpha})`; ctx.beginPath(); ctx.arc(x, y, r * 1.06, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); K.fx.rasenganOrb(ctx, r, time, alpha); ctx.restore();
    lit(ctx, () => {
      ctx.strokeStyle = `rgba(200,236,255,${.7 * alpha})`; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const a0 = time * 9 + i * TAU / 5; ctx.beginPath(); ctx.arc(x, y, r * (1.1 + .08 * Math.sin(time * 7 + i)), a0, a0 + 1.1); ctx.stroke(); }
    });
  }
  FX.rasen = [(ctx, fx, time) => {
    // The trench torn along the lane.
    const fade = fx.done ? 1 - win(fx.age, fx.dur - .5, fx.dur) : 1, dx = fx.x1 - fx.x0, dy = fx.y1 - fx.y0, L = Math.hypot(dx, dy);
    if (L < 4) return;
    ctx.save(); ctx.translate(fx.x0, fx.y0); ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = `rgba(36,26,18,${.38 * fade})`; ctx.fillRect(0, -fx.w * .55, L, fx.w * 1.1);
    ctx.fillStyle = `rgba(20,14,10,${.32 * fade})`; ctx.fillRect(0, -fx.w * .22, L, fx.w * .44);
    ctx.strokeStyle = `rgba(30,22,14,${.6 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath(); for (let d = 20; d < L; d += 34) { const o = (hash(fx.seed + d) - .5) * fx.w; ctx.moveTo(d, o); ctx.lineTo(d + 22, o * .4); } ctx.stroke();
    ctx.restore();
  }, (ctx, fx, time) => {
    if (fx.done) return;
    const z = fx.z, ca = Math.cos(fx.a), sa = Math.sin(fx.a), K = Kit();
    const ox = z.x + ca * 44, oy = z.y - 40 + sa * 18;
    // Dust kicked up behind and speed lines.
    const dust = K.puff('dust');
    for (let i = 0; i < 6; i++) { const ph = (time * 3 + i / 6) % 1; K.stamp(ctx, dust, z.x - ca * (30 + ph * 140) + (hash(i) - .5) * 60, z.y - sa * (30 + ph * 140) - 8, 18 + ph * 26, .7 * (1 - ph)); }
    ctx.strokeStyle = 'rgba(230,246,255,.8)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const o = (hash(fx.seed + i) - .5) * 120, l = 60 + hash(i * 3) * 120, d = 70 + ((time * 900 + i * 50) % 160); ctx.moveTo(ox - ca * d - sa * o, oy - sa * d + ca * o * .6); ctx.lineTo(ox - ca * (d + l) - sa * o, oy - sa * (d + l) + ca * o * .6); }
    ctx.stroke();
    bigOrb(ctx, ox, oy, 66, time);
  }];
  FX.ooblast = [(ctx, fx, time) => {
    const p = fx.age / fx.dur, fade = 1 - easeIn(win(p, .5, 1)), R = fx.r;
    crater(ctx, fx.x, fx.y, R * .75, fade, fx.seed);
    // Spiral gouge left by the grinding sphere.
    ctx.strokeStyle = `rgba(26,18,12,${.55 * fade})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      for (let k = 0; k <= 14; k++) { const t = k / 14, a = i / 5 * TAU + t * 2.6, r = R * (.12 + t * .7); k ? ctx.lineTo(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r) : ctx.moveTo(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r); }
      ctx.stroke();
    }
    Kit().fx.shockRing(ctx, fx.x, fx.y, R * 1.5, p * 1.4, fade, '150,210,255');
  }, (ctx, fx, time) => {
    const p = fx.age / fx.dur, K = Kit();
    K.fx.windDome(ctx, fx.x, fx.y, fx.r * 1.05, clamp01(p * 1.1), 1 - easeIn(win(p, .55, 1)), time, false);
    K.fx.debris(ctx, fx.x, fx.y, fx.r * 1.2, p * 1.3, fx.seed, '#6a5440', 14);
    dustRing(ctx, fx.x, fx.y, fx.r, p, 1, fx.seed, 16);
  }];

  // A summoned toad that poofs in beside Jiraiya (Gamayu Endan's oil spitter).
  FX.toad = [null, (ctx, fx, time) => {
    const appear = easeOutBack(fx.age / .3), leave = win(fx.age, fx.dur - .3, fx.dur), K = Kit();
    if (leave < 1) drawToad(ctx, fx.t, fx.x, fx.y + 6, fx.w * appear, fx.f, 1 + Math.sin(time * 5) * .02, 1 - leave);
    if (fx.age < .5) K.fx.smokePoof(ctx, fx.x, fx.y, 140, fx.age / .5);
    if (leave > 0) K.fx.smokePoof(ctx, fx.x, fx.y, 140, leave);
  }];

  FX.oilfire = [(ctx, fx, time) => {
    const p = fx.age, front = clamp01((p - .25) / (fx.R / 1500)) * fx.R, fade = 1 - easeIn(win(p, 1.4, fx.dur));
    if (front <= 0) return;
    // Oil sheen and scorch across the cone.
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(60,22,6,${.34 * fade})`; sector(ctx, 0, 0, 40, front, -fx.h, fx.h); ctx.fill();
    ctx.fillStyle = `rgba(120,70,10,${.25 * fade})`; sector(ctx, 0, 0, 40, front * .9, -fx.h * .7, fx.h * .7); ctx.fill();
    ctx.restore();
    lit(ctx, () => { for (let d = 120; d < front; d += 140) Kit().glow(ctx, fx.x + Math.cos(fx.a) * d, fx.y + Math.sin(fx.a) * d, 60 + d * .28, '255,120,30', .45 * fade, false, .6); });
  }, (ctx, fx, time) => {
    const K = Kit(), p = fx.age, ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    // Toad oil jet: a glossy amber stream out of the toad's mouth.
    if (p < .55) {
      const k = easeOut(p / .2) * (1 - win(p, .4, .55)), L = 320 * k, sx = fx.ox + ca * 30, sy = fx.oy - 56;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + ca * L * .5, sy + sa * L * .5 - 20, sx + ca * L, sy + sa * L + 20);
      ctx.strokeStyle = 'rgba(60,34,8,.9)'; ctx.lineWidth = 26; ctx.stroke();
      ctx.strokeStyle = '#c8962c'; ctx.lineWidth = 18; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,170,.85)'; ctx.lineWidth = 5; ctx.stroke();
    }
    const front = clamp01((p - .25) / (fx.R / 1500)) * fx.R, fade = 1 - easeIn(win(p, 1.3, fx.dur));
    if (front <= 0) return;
    // Jiraiya's fire breath meets the oil: the cone fills with towering flames.
    const fire = K.puff('fire'), smoke = K.puff('smoke');
    for (let d = 70, row = 0; d < front; d += 64, row++) {
      const half = fx.h * .92, cnt = Math.max(1, Math.round(2 * half * d / 78)), w = 44 + d * .1;
      for (let i = 0; i < cnt; i++) {
        const b = fx.a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half) + (hash(row * 13 + i + fx.seed) - .5) * .06;
        const dj = d + (hash(row * 5 + i * 3 + fx.seed) - .5) * 50;
        const fx2 = fx.x + Math.cos(b) * dj, fy2 = fx.y + Math.sin(b) * dj;
        const flick = .85 + .25 * Math.sin(time * 13 + row * 2.3 + i * 1.7), edge = d > front - 90 ? .8 + (front - d) / 450 : 1;
        flame(ctx, row * 3 + i, fx2, fy2, w * flick * edge * (.65 + .7 * hash(row * 9 + i + fx.seed)), fade);
      }
    }
    // Billowing fireballs rolling along the stream.
    for (let i = 0; i < 10; i++) {
      const t = ((time * 1.3 + i / 10) % 1), d = 80 + t * Math.max(0, front - 80), b = fx.a + (hash(i * 3 + fx.seed) - .5) * fx.h * 1.4;
      K.stamp(ctx, fire, fx.x + Math.cos(b) * d, fx.y + Math.sin(b) * d - 30 - t * 30, 30 + d * .07, .85 * bell(t) * fade);
    }
    // The roaring stream from Jiraiya's mouth.
    for (let i = 0; i < 9; i++) {
      const t = ((time * 2.6 + i / 9) % 1), d = 30 + t * Math.min(front, 420);
      K.stamp(ctx, fire, fx.x + ca * d, fx.y + sa * d - 46 + t * 30, 16 + t * 40, (1 - t) * fade);
    }
    for (let i = 0; i < 7; i++) {
      const t = ((time * .9 + i / 7) % 1), d = 120 + hash(i + fx.seed) * Math.max(10, front - 120), b = fx.a + (hash(i * 7 + fx.seed) - .5) * fx.h * 1.6;
      K.stamp(ctx, smoke, fx.x + Math.cos(b) * d, fx.y + Math.sin(b) * d - 90 - t * 110, 34 + t * 40, .55 * bell(t) * fade);
    }
  }];
  FX.burn = [(ctx, fx) => {
    const fade = 1 - easeIn(win(fx.age, fx.dur - .6, fx.dur)) , k = easeOut(fx.age / .3);
    ctx.fillStyle = `rgba(50,18,6,${.38 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * k, 0, TAU); ctx.fill();
    lit(ctx, () => Kit().glow(ctx, fx.x, fx.y, fx.r * 1.4, '255,120,30', .5 * fade, false, .6));
  }, (ctx, fx, time) => {
    const fade = 1 - easeIn(win(fx.age, fx.dur - .6, fx.dur)), k = easeOut(fx.age / .3);
    for (let i = 0; i < 7; i++) {
      const a = hash(fx.seed + i * 3) * TAU, d = fx.r * .7 * Math.sqrt(hash(fx.seed + i * 7)) * k;
      flame(ctx, i + 2, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, (34 + hash(i) * 20) * (.85 + .2 * Math.sin(time * 11 + i * 2)), fade);
    }
  }];

  // Hari Jizō: the mane wraps him in a dome of needle-hard hair, then bursts outward.
  FX.jizo = [(ctx, fx) => {
    const z = fx.z, burst = win(fx.age, .95, 1.25), fade = 1 - win(fx.age, 1.2, fx.dur);
    if (burst > 0) crater(ctx, z.x, z.y, 120 + burst * 60, fade * .8, fx.seed);
  }, (ctx, fx, time) => {
    const z = fx.z, cx = z.x, cy = z.y - 30, grow = easeOutBack(fx.age / .25), burst = win(fx.age, .95, 1.15), gone = win(fx.age, 1.15, 1.4);
    const R = 80 * grow * (1 + burst * .25);
    if (gone < 1 && R > 2) {
      ctx.globalAlpha = 1 - gone;
      ctx.fillStyle = '#d6d1c8'; ctx.beginPath(); ctx.ellipse(cx, cy, R * .82, R * .9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,110,100,.6)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const a = -Math.PI + i / 8 * Math.PI; ctx.moveTo(cx + Math.cos(a) * R * .2, cy - R * .8); ctx.quadraticCurveTo(cx + Math.cos(a) * R * .9, cy, cx + Math.cos(a) * R * .5, cy + R * .85); }
      ctx.stroke();
      // Needle spikes all over the dome.
      ctx.lineCap = 'round';
      // Thick needle spikes of hair, back rings first.
      ctx.lineJoin = 'round';
      for (let ring = 3; ring >= 0; ring--) {
        const el = ring * .38, n = 18 - ring * 3;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const az = i / n * TAU + ring * .4, ce = Math.cos(el), se = Math.sin(el), len = 1 + .25 * hash(ring * 20 + i) + burst * .7;
          const ux = Math.cos(az) * ce, uy = Math.sin(az) * ce * .62 - se, px = -uy, py = ux, bw = R * .09;
          const bx = cx + ux * R * .72, by = cy + uy * R * .8;
          ctx.moveTo(bx + px * bw, by + py * bw); ctx.lineTo(cx + ux * R * 1.32 * len, cy + uy * R * 1.36 * len); ctx.lineTo(bx - px * bw, by - py * bw); ctx.closePath();
        }
        ctx.fillStyle = ring % 2 ? '#e6e1d8' : '#f8f6f0'; ctx.fill(); ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 1.8; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // On the burst: needles fly out in a ring.
    if (burst > 0 && fx.age < 1.6) {
      const t = win(fx.age, .95, 1.5), d0 = 70 + t * 380;
      ctx.globalAlpha = 1 - easeIn(t);
      ctx.beginPath();
      for (let i = 0; i < 40; i++) { const a = fx.a + i / 40 * TAU, d = d0 * (.8 + hash(i + fx.seed) * .3); ctx.moveTo(z.x + Math.cos(a) * d, cy + Math.sin(a) * d); ctx.lineTo(z.x + Math.cos(a) * (d + 40), cy + Math.sin(a) * (d + 40)); }
      inkStroke(ctx, '#f8f6f0', 'rgba(30,24,20,.8)', 2.4);
      ctx.globalAlpha = 1;
    }
  }];

  // Hair-needle rain: needles fired skyward, then falling in clusters and staying stuck.
  FX.needles = [(ctx, fx) => {
    for (const d of fx.drops) {
      const t = fx.age - d.t0 - .3;
      if (t < 0) continue;
      const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
      ctx.fillStyle = `rgba(30,22,14,${.3 * fade})`; ctx.beginPath(); ctx.arc(d.x, d.y, 34, 0, TAU); ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (hash(d.seed + i) - .5) * 1.1, l = 24 + hash(d.seed + i * 3) * 14, ox = (hash(d.seed + i * 5) - .5) * 52, oy = (hash(d.seed + i * 9) - .5) * 40; ctx.moveTo(d.x + ox, d.y + oy); ctx.lineTo(d.x + ox + Math.cos(a) * l * .4, d.y + oy + Math.sin(a) * l); }
      ctx.globalAlpha = fade; inkStroke(ctx, '#f2efe6', 'rgba(30,24,20,.85)', 2.6); ctx.globalAlpha = 1;
    }
  }, (ctx, fx, time) => {
    const K = Kit(), dust = K.puff('dust');
    // Launch: a fan of needles shooting up out of his mane.
    if (fx.age < .5) {
      const t = fx.age / .5;
      ctx.globalAlpha = 1 - t; ctx.beginPath();
      for (let i = 0; i < 16; i++) { const ox = (hash(fx.seed + i) - .5) * 70, y0 = fx.y - 70 - t * 500 - hash(i) * 80; ctx.moveTo(fx.x + ox, y0); ctx.lineTo(fx.x + ox * 1.2, y0 - 60); }
      inkStroke(ctx, '#ffffff', 'rgba(30,24,20,.8)', 2); ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    for (const d of fx.drops) {
      const t = (fx.age - d.t0) / .3;
      if (t < 0 || t > 1) continue;
      const h = 460 * (1 - t);
      for (let i = 0; i < 7; i++) { const ox = (hash(d.seed + i * 5) - .5) * 52, oy = (hash(d.seed + i * 9) - .5) * 40; ctx.moveTo(d.x + ox + h * .14, d.y + oy - h - 110); ctx.lineTo(d.x + ox + h * .1, d.y + oy - h); }
    }
    inkStroke(ctx, '#ffffff', 'rgba(30,24,20,.85)', 3);
    for (const d of fx.drops) {
      const t = fx.age - d.t0 - .3;
      if (t < 0 || t > .5) continue;
      K.stamp(ctx, dust, d.x, d.y - 10, 22 + t * 60, .8 * (1 - t / .5));
    }
  }];

  // Gamabunta crashes down from the sky, then draws his dosu and slashes.
  FX.bunta = [(ctx, fx, time) => {
    const land = fx.age >= .28, fade = 1 - win(fx.age, fx.dur - .35, fx.dur);
    if (!land) {
      const k = fx.age / .28;
      ctx.fillStyle = `rgba(20,14,10,${.15 + .3 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 200 * (.4 + .6 * k), 110 * (.4 + .6 * k), 0, 0, TAU); ctx.fill();
      return;
    }
    const t = fx.age - .28;
    crater(ctx, fx.x, fx.y, 190, fade, fx.seed);
    Kit().fx.shockRing(ctx, fx.x, fx.y, 380, t * 1.6, 1 - win(t, 0, .8), '255,200,150');
    ctx.fillStyle = `rgba(20,14,10,${.35 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 6, 190, 60, 0, 0, TAU); ctx.fill();
    // The slash scar.
    if (fx.age > fx.slash && fx.sa !== undefined) {
      const s = win(fx.age, fx.slash, fx.slash + .2), f2 = 1 - win(fx.age, fx.slash + .4, fx.dur);
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.sa);
      ctx.strokeStyle = `rgba(30,20,14,${.55 * f2})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, 470, -1, -1 + 2 * s); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 380, -.9, -.9 + 1.8 * s); ctx.stroke();
      ctx.restore();
    }
  }, (ctx, fx, time) => {
    const K = Kit(), fall = easeIn(fx.age / .28), out = win(fx.age, fx.dur - .35, fx.dur);
    const yy = fx.y - (1 - fall) * 240, squash = fx.age < .28 ? 1.08 : 1 - .12 * bell(win(fx.age, .28, .5)) + Math.sin(time * 2.4) * .012;
    const f = fx.sa !== undefined ? faceOf(fx.sa) : faceOf(fx.a);
    if (out < 1) drawToad(ctx, 'bunta', fx.x, yy + 18, 420, f, squash, 1 - out);
    if (fx.age < .45) K.fx.smokePoof(ctx, fx.x, fx.y - 60, 380, fx.age / .45 * .75);
    if (fx.age >= .28) {
      const t = fx.age - .28;
      dustRing(ctx, fx.x, fx.y, 260, t / 1.1, 1, fx.seed, 18);
      K.fx.debris(ctx, fx.x, fx.y, 300, t * 1.1, fx.seed, '#6a5440', 16);
      // Pipe smoke.
      const smoke = K.puff('smoke');
      for (let i = 0; i < 3; i++) { const ph = (time * .5 + i / 3) % 1; K.stamp(ctx, smoke, fx.x + f * (180 + ph * 30), yy - 230 - ph * 90, 10 + ph * 24, .5 * bell(ph) * (1 - out)); }
    }
    // Dosu slash: a giant blade sweeps through the marked fan.
    if (fx.sa !== undefined && fx.age > fx.slash - .25 && fx.age < fx.slash + .6) {
      const s = easeOut(win(fx.age, fx.slash, fx.slash + .18)), pre = fx.age < fx.slash;
      const ang = fx.sa - 1.05 + 2.1 * s, hx = fx.x + f * 60, hy = fx.y - 150, L = 470, f2 = 1 - win(fx.age, fx.slash + .25, fx.slash + .6);
      ctx.globalAlpha = f2;
      if (!pre) {
        // White crescent trail.
        ctx.save(); ctx.translate(hx, hy + 80);
        ctx.fillStyle = 'rgba(200,230,255,.35)'; sector(ctx, 0, 0, 120, L, fx.sa - 1.05, ang); ctx.fill();
        lit(ctx, () => { ctx.strokeStyle = 'rgba(230,246,255,.9)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, L * .96, fx.sa - 1.05, ang); ctx.stroke(); });
        ctx.restore();
      }
      const ba = pre ? fx.sa - 1.2 : ang, bx = hx + Math.cos(ba) * L, by = hy + 80 + Math.sin(ba) * L;
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(hx, hy + 80); ctx.lineTo(bx, by);
      ctx.strokeStyle = '#1a1820'; ctx.lineWidth = 22; ctx.stroke();
      ctx.strokeStyle = '#a8b0c0'; ctx.lineWidth = 15; ctx.stroke();
      ctx.strokeStyle = '#f2f6ff'; ctx.lineWidth = 4; ctx.stroke();
      ctx.lineCap = 'round';
      ctx.globalAlpha = 1;
    }
    if (out > 0) K.fx.smokePoof(ctx, fx.x, fx.y - 100, 360, out);
  }];

  // Ma & Pa on Jiraiya's shoulders (Sage Mode), singing.
  FX.mapa = [null, (ctx, fx, time) => {
    const z = fx.z || null;
    if (!z) return;
    const appear = easeOutBack(fx.age / .3), leave = win(fx.age, fx.dur - .3, fx.dur), K = Kit();
    if (leave >= 1) return;
    const sy = z.y - 74, bob = Math.sin(time * 6) * 2;
    drawToad(ctx, 'pa', z.x - 22, sy + bob, 40 * appear, 1, 1, 1 - leave);
    drawToad(ctx, 'ma', z.x + 22, sy - bob, 38 * appear, -1, 1, 1 - leave);
    lit(ctx, () => {
      K.glow(ctx, z.x, z.y - 50, 90, '255,150,60', .35 * (1 - leave));
      ctx.strokeStyle = `rgba(255,190,110,${.6 * (1 - leave)})`; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const ph = (time * 1.2 + i / 3) % 1; ctx.beginPath(); ctx.arc(z.x, sy - 10, 20 + ph * 70, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    });
    if (fx.age < .4) { K.fx.smokePoof(ctx, z.x - 22, z.y - 56, 50, fx.age / .4); K.fx.smokePoof(ctx, z.x + 22, z.y - 56, 50, fx.age / .4); }
  }];

  // Senpō: Goemon — a tidal wave of boiling, burning oil.
  FX.goemon = [(ctx, fx, time) => {
    const front = Math.min(fx.L, fx.age * fx.speed), fade = 1 - easeIn(win(fx.age, fx.dur - .9, fx.dur));
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(70,24,4,${.45 * fade})`; ctx.fillRect(30, -fx.W, front - 30, fx.W * 2);
    ctx.fillStyle = `rgba(150,70,10,${.3 * fade})`; ctx.fillRect(30, -fx.W * .7, front - 30, fx.W * 1.4);
    ctx.strokeStyle = `rgba(255,190,80,${.35 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath(); for (let d = 60; d < front; d += 46) { const o = (hash(fx.seed + d) - .5) * fx.W * 1.7; ctx.moveTo(d, o); ctx.quadraticCurveTo(d + 20, o + 10 * Math.sin(time * 3 + d), d + 40, o); } ctx.stroke();
    ctx.restore();
    lit(ctx, () => { for (let d = 140; d < front; d += 170) Kit().glow(ctx, fx.x + Math.cos(fx.a) * d, fx.y + Math.sin(fx.a) * d, fx.W * 1.2, '255,110,20', .5 * fade, false, .7); });
  }, (ctx, fx, time) => {
    const K = Kit(), ca = Math.cos(fx.a), sa = Math.sin(fx.a), front = Math.min(fx.L, fx.age * fx.speed), moving = fx.age * fx.speed < fx.L + 60;
    const fade = 1 - easeIn(win(fx.age, fx.dur - .9, fx.dur));
    // Burning sea behind the wave: scattered tongues of flame and rolling fireballs.
    const fire = K.puff('fire'), smoke = K.puff('smoke');
    for (let i = 0; i < 46; i++) {
      const d = 60 + hash(i * 1.7 + fx.seed) * (fx.L - 60), o = (hash(i * 3.3 + fx.seed) - .5) * 2 * fx.W * .92;
      if (d > front - 50) continue;
      const big = hash(i * 7.1);
      flame(ctx, i, fx.x + ca * d - sa * o, fx.y + sa * d + ca * o, (30 + big * 46) * (.8 + .25 * Math.sin(time * 10 + i)), fade * .92);
    }
    for (let i = 0; i < 9; i++) {
      const t = (time * .8 + i / 9) % 1, d = 80 + hash(i * 5 + fx.seed) * Math.max(10, front - 120), o = (hash(i * 9 + fx.seed) - .5) * 2 * fx.W * .8;
      K.stamp(ctx, smoke, fx.x + ca * d - sa * o, fx.y + sa * d + ca * o - 80 - t * 120, 40 + t * 40, .5 * bell(t) * fade);
    }
    if (moving) {
      // The wave front: a curved crest of boiling oil topped with a wall of tall flames.
      const fx0 = fx.x + ca * front, fy0 = fx.y + sa * front, N = 16, crest = o => front - Math.pow(o / fx.W, 2) * 90;
      ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const o = (i / N - .5) * 2 * fx.W, d = crest(o); i ? ctx.lineTo(fx.x + ca * d - sa * o, fx.y + sa * d + ca * o - 10) : ctx.moveTo(fx.x + ca * d - sa * o, fx.y + sa * d + ca * o - 10); }
      ctx.strokeStyle = 'rgba(60,24,6,.9)'; ctx.lineWidth = 46; ctx.stroke();
      ctx.strokeStyle = '#c86a14'; ctx.lineWidth = 34; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,120,.9)'; ctx.lineWidth = 8; ctx.stroke();
      for (let i = 0; i <= N; i++) {
        const o = (i / N - .5) * 2 * fx.W + (hash(i + fx.seed) - .5) * 20, d = crest(o) + (hash(i * 3) - .5) * 30, px = fx.x + ca * d - sa * o, py = fx.y + sa * d + ca * o;
        K.stamp(ctx, smoke, px - ca * 30, py - 170 - hash(i) * 50, 46 + hash(i * 2) * 20, .45);
        flame(ctx, i, px, py, (90 + 60 * hash(i * 5)) * (1 + .15 * Math.sin(time * 9 + i * 1.3)), 1);
        K.stamp(ctx, fire, px + ca * 14, py - 26, 30 + hash(i * 7) * 16, .9);
      }
      lit(ctx, () => K.glow(ctx, fx0, fy0 - 40, fx.W * 1.2, '255,140,40', .32));
    }
  }];

  // ------------------------------------------------------------------ FX: Orochimaru
  FX.senei = [(ctx, fx) => {
    const ext = fx.age < .22 ? easeOut(fx.age / .22) : 1 - easeIn(win(fx.age, .62, 1.05));
    ctx.strokeStyle = 'rgba(20,14,10,.28)'; ctx.lineCap = 'round'; ctx.lineWidth = 16;
    ctx.beginPath();
    for (const b of fx.angles) { ctx.moveTo(fx.x + Math.cos(b) * 20, fx.y + Math.sin(b) * 20); ctx.lineTo(fx.x + Math.cos(b) * fx.len * ext, fx.y + Math.sin(b) * fx.len * ext); }
    ctx.stroke();
  }, (ctx, fx, time) => {
    const ext = fx.age < .22 ? easeOut(fx.age / .22) : 1 - easeIn(win(fx.age, .62, 1.05));
    if (ext <= .01) return;
    const z = fx.z, ox = z.x, oy = z.y - 34;
    fx.angles.forEach((b, i) => {
      const L = fx.len * ext, ca = Math.cos(b), sa = Math.sin(b), n = 18;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1), d = 18 + t * L, lift = 34 * (1 - t) + 10 * t;
        const wv = Math.sin(d / 55 - time * 16 + i * 1.7) * 13 * Math.min(1, t * 3);
        PB[k * 2] = ox + ca * d - sa * wv; PB[k * 2 + 1] = z.y + sa * d + ca * wv - lift;
      }
      serpent(ctx, n, 12, 21, PAL.olive, time * 3 + i, 2);
      const hx = PB[(n - 1) * 2], hy = PB[(n - 1) * 2 + 1];
      serpentHead(ctx, hx, hy, Math.atan2(hy - PB[(n - 3) * 2 + 1], hx - PB[(n - 3) * 2]), 30, PAL.olive, ext > .9 ? .8 : .4, false);
    });
  }];

  // Kusanagi: the blade shoots out of his hand, then sweeps a huge arc.
  FX.kusa = [(ctx, fx, time) => {
    const sweep = win(fx.age, .45, .67), fade = 1 - win(fx.age, .8, fx.dur);
    if (sweep > 0) {
      ctx.save(); ctx.translate(fx.x, fx.y);
      ctx.fillStyle = `rgba(30,16,40,${.22 * fade})`; sector(ctx, 0, 0, 90, fx.R, fx.a - 1.1, fx.a - 1.1 + 2.2 * sweep); ctx.fill();
      ctx.strokeStyle = `rgba(30,20,30,${.5 * fade})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, fx.R * .96, fx.a - 1.1, fx.a - 1.1 + 2.2 * sweep); ctx.stroke();
      ctx.restore();
    }
    if (fx.age > .1) {
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
      ctx.strokeStyle = `rgba(30,20,30,${.45 * fade})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(fx.len, 0); ctx.stroke();
      ctx.restore();
    }
  }, (ctx, fx, time) => {
    const z = fx.z, hx = z.x + Math.cos(fx.a) * 20, hy = z.y - 36;
    let ang = fx.a, L = fx.len * easeOut(fx.age / .12);
    if (fx.age > .3) { L = lerp(fx.len, fx.R, easeOut(win(fx.age, .3, .42))); ang = fx.a - 1.1 * easeOut(win(fx.age, .3, .45)); }
    if (fx.age > .45) ang = fx.a - 1.1 + 2.2 * easeOut(win(fx.age, .45, .67));
    const fade = 1 - win(fx.age, .8, fx.dur);
    if (fade <= 0) return;
    // Arc trail.
    if (fx.age > .45) {
      const s = easeOut(win(fx.age, .45, .67)), a0 = Math.max(fx.a - 1.1, ang - 1.4);
      ctx.save(); ctx.translate(hx, hy); ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(60,30,100,.3)'; sector(ctx, 0, 0, 60, fx.R, a0, ang); ctx.fill();
      ctx.fillStyle = 'rgba(200,170,255,.35)'; sector(ctx, 0, 0, fx.R * .55, fx.R, a0 + (ang - a0) * .4, ang); ctx.fill();
      lit(ctx, () => { ctx.strokeStyle = 'rgba(230,220,255,.95)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, fx.R * .97, a0, ang); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, fx.R * .8, a0 + .2, ang); ctx.stroke(); });
      ctx.restore(); ctx.globalAlpha = 1;
      void s;
    }
    // The blade.
    const bx = hx + Math.cos(ang) * L, by = hy + Math.sin(ang) * L;
    ctx.globalAlpha = fade; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(bx, by);
    ctx.strokeStyle = '#140e1c'; ctx.lineWidth = 14; ctx.stroke();
    ctx.strokeStyle = '#9a96c0'; ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 4.5; ctx.stroke();
    lit(ctx, () => {
      ctx.strokeStyle = 'rgba(190,150,255,.55)'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(bx, by); ctx.stroke();
      Kit().glow(ctx, bx, by, 70, '210,190,255', 1, true); Kit().glow(ctx, hx, hy, 40, '200,170,255', .7);
    });
    ctx.globalAlpha = 1;
  }];

  // Yamata no Jutsu: eight giant white serpent heads rise behind him and strike one after another.
  FX.yamata = [(ctx, fx, time) => {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    for (const p of fx.pts) {
      const t = fx.age - p.t - .12;
      if (t < 0) continue;
      crater(ctx, p.x, p.y, 80, fade, fx.seed + p.i);
      Kit().fx.shockRing(ctx, p.x, p.y, 180, t * 2, 1 - win(t, 0, .5), '240,236,225');
    }
    ctx.fillStyle = `rgba(30,20,30,${.3 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, 90, 0, TAU); ctx.fill();
  }, (ctx, fx, time) => {
    const z = fx.z, K = Kit(), fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    const list = fx.pts.slice().sort((p, q) => p.y - q.y);
    ctx.globalAlpha = fade;
    for (const p of list) {
      const i = p.i, rise = easeOut(win(fx.age, 0, .25 + i * .03)), strike = win(fx.age, p.t, p.t + .12), back = win(fx.age, p.t + .55, p.t + 1.1);
      const bx = z.x + Math.cos(i / 8 * TAU) * 34, by = z.y - 10 + Math.sin(i / 8 * TAU) * 14;
      const hover = { x: lerp(bx, p.x, .55), y: Math.min(by, p.y) - 230 - (i % 3) * 30 };
      let hx, hy;
      if (strike <= 0) { hx = lerp(bx, hover.x, rise); hy = lerp(by, hover.y, rise) + Math.sin(time * 4 + i) * 8; }
      else { const s = easeIn(strike); hx = lerp(hover.x, p.x, s); hy = lerp(hover.y, p.y - 26, s); }
      if (back > 0) { hx = lerp(hx, bx, easeIn(back)); hy = lerp(hy, by - 60, easeIn(back)); }
      const cx = (bx + hx) / 2 + Math.sin(i * 2.1) * 40, cy = Math.min(by, hy) - 120;
      const n = bezPts(bx, by, cx, cy, hx, hy, 0, 1, 14, 6, 1.2, time * 3 + i);
      serpent(ctx, n, 40, 27, PAL.white, time * 2 + i, 3);
      const ax = PB[(n - 1) * 2] - PB[(n - 3) * 2], ay = PB[(n - 1) * 2 + 1] - PB[(n - 3) * 2 + 1];
      serpentHead(ctx, hx, hy, Math.atan2(ay, ax), 44, PAL.white, strike > 0 && strike < 1 ? 1 : .35 + .25 * Math.sin(time * 5 + i), false);
      if (strike >= 1 && fx.age - p.t - .12 < .5) K.stamp(ctx, K.puff('dust'), p.x, p.y - 20, 40 + (fx.age - p.t) * 80, .8 * (1 - (fx.age - p.t - .12) / .5));
    }
    ctx.globalAlpha = 1;
  }];

  // Daitoppa: a hurricane blast; white streaks with dark under-strokes, dust and torn leaves.
  FX.wind = [(ctx, fx) => {
    const k = easeOut(fx.age / .45), fade = 1 - win(fx.age, .7, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(120,100,70,${.22 * fade})`; sector(ctx, 0, 0, 30, fx.R * k, -fx.h, fx.h); ctx.fill();
    ctx.strokeStyle = `rgba(60,46,30,${.35 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 0; i < 14; i++) { const b = (hash(fx.seed + i) - .5) * 2 * fx.h, d0 = 80 + hash(i * 3) * 200; ctx.moveTo(Math.cos(b) * d0, Math.sin(b) * d0); ctx.lineTo(Math.cos(b) * (d0 + 160) * k, Math.sin(b) * (d0 + 160) * k); } ctx.stroke();
    ctx.restore();
  }, (ctx, fx, time) => {
    const K = Kit(), fade = 1 - win(fx.age, .8, fx.dur), dust = K.puff('dust');
    ctx.save(); ctx.translate(fx.x, fx.y - 24); ctx.rotate(fx.a); ctx.globalAlpha = fade; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 52; i++) {
      const b = (hash(fx.seed + i * 1.7) - .5) * 2 * fx.h * .95, d = ((fx.age * 1300 + hash(i * 5.1) * fx.R) % fx.R), l = 90 + hash(i) * 120;
      const r0 = Math.max(30, d), r1 = Math.min(fx.R, d + l);
      ctx.moveTo(Math.cos(b) * r0, Math.sin(b) * r0);
      ctx.quadraticCurveTo(Math.cos(b + .05) * (r0 + r1) / 2, Math.sin(b + .05) * (r0 + r1) / 2 - 8, Math.cos(b) * r1, Math.sin(b) * r1);
    }
    inkStroke(ctx, 'rgba(250,252,255,.95)', 'rgba(50,60,70,.6)', 4.5);
    ctx.restore();
    for (let i = 0; i < 16; i++) {
      const ph = (fx.age * 1.6 + hash(i + fx.seed)) % 1, b = fx.a + (hash(i * 7 + fx.seed) - .5) * 2 * fx.h * .9, d = 80 + ph * fx.R * .9;
      K.stamp(ctx, dust, fx.x + Math.cos(b) * d, fx.y + Math.sin(b) * d - 20, 30 + ph * 56, .8 * bell(ph) * fade);
    }
    ctx.fillStyle = '#6aa848'; ctx.strokeStyle = '#24401a'; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const ph = (fx.age * 1.2 + hash(i * 3 + fx.seed)) % 1, b = fx.a + (hash(i * 11 + fx.seed) - .5) * 2 * fx.h, d = 60 + ph * fx.R;
      ctx.save(); ctx.translate(fx.x + Math.cos(b) * d, fx.y + Math.sin(b) * d - 30 - Math.sin(ph * 9) * 20); ctx.rotate(time * 9 + i); ctx.globalAlpha = fade;
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }];

  // Manda: the giant purple serpent coils round the mark, tightens and slams its head down.
  FX.manda = [(ctx, fx, time) => {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur), r = lerp(fx.R0, fx.R1, easeIn(win(fx.age, .15, 1.05)));
    ctx.strokeStyle = `rgba(20,10,30,${.3 * fade})`; ctx.lineWidth = 50; ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, TAU); ctx.stroke();
    if (fx.age > 1.22) {
      const t = fx.age - 1.22;
      crater(ctx, fx.x, fx.y, 170, fade, fx.seed);
      Kit().fx.shockRing(ctx, fx.x, fx.y, 420, t * 1.5, 1 - win(t, 0, .9), '200,160,255');
    }
  }, (ctx, fx, time) => {
    const K = Kit(), emerge = easeOut(fx.age / .3), sink = win(fx.age, fx.dur - .6, fx.dur);
    const r = lerp(fx.R0, fx.R1, easeIn(win(fx.age, .15, 1.05))), spin = fx.seed + fx.age * .9;
    ctx.globalAlpha = 1 - sink;
    // Coil (back half first, then the head arching over).
    const n = 34, span = TAU * .92;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), b = spin + t * span, rr = r * (1 + .12 * t);
      PB[i * 2] = fx.x + Math.cos(b) * rr; PB[i * 2 + 1] = fx.y + Math.sin(b) * rr - 18 * emerge - 10 * t;
    }
    serpent(ctx, n, 30 * emerge + 4, 56 * emerge + 4, PAL.manda, -fx.age * 4, 4);
    // Neck rising from the coil end; rears up, then slams down on the centre.
    const b = spin + span, ex = fx.x + Math.cos(b) * r * 1.12, ey = fx.y + Math.sin(b) * r * 1.12 - 28;
    const rear = easeOut(win(fx.age, .1, .6)), slam = easeIn(win(fx.age, 1.05, 1.22)), lift2 = win(fx.age, 1.7, 2.3);
    let hx = lerp(ex, fx.x + (ex - fx.x) * .3, rear), hy = lerp(ey, fx.y - 300, rear);
    hx = lerp(hx, fx.x, slam); hy = lerp(hy, fx.y - 40, slam);
    hy = lerp(hy, fx.y - 160, easeOut(lift2));
    const nn = bezPts(ex, ey, (ex + hx) / 2 + (ex - fx.x) * .3, Math.min(ey, hy) - 60, hx, hy, 0, 1, 12, 8, 1, fx.age * 4);
    serpent(ctx, nn, 56 * emerge + 4, 46 * emerge + 4, PAL.manda, -fx.age * 4, 3);
    const ax = PB[(nn - 1) * 2] - PB[(nn - 3) * 2], ay = PB[(nn - 1) * 2 + 1] - PB[(nn - 3) * 2 + 1];
    serpentHead(ctx, hx, hy, Math.atan2(ay, ax), 74 * emerge + 6, PAL.manda, slam > 0 && slam < 1 ? 1 : .45 + .3 * Math.sin(time * 4), true);
    ctx.globalAlpha = 1;
    if (fx.age < .4) dustRing(ctx, fx.x, fx.y, fx.R0, fx.age / .4, 1, fx.seed, 18, 'violet');
    if (fx.age > 1.22) { const t = fx.age - 1.22; dustRing(ctx, fx.x, fx.y, 240, t / 1.2, 1, fx.seed, 16); K.fx.debris(ctx, fx.x, fx.y, 300, t * 1.1, fx.seed, '#5a4636', 14); }
    if (sink > 0) K.fx.smokePoof(ctx, fx.x, fx.y - 40, 400, sink);
  }];

  // Edo Tensei: coffins rise, the lids fall, the dead step out and fight.
  function drawCoffin(ctx, c, mark, rise, lid, time, alpha) {
    if (alpha <= .01 || rise <= 0) return;
    const W = 92, H = 184, x = c.x, y = c.y;
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.beginPath(); ctx.rect(x - W, y - H * 1.2, W * 2, H * 1.2 + 4); ctx.clip();
    const yy = y + H * (1 - rise);
    ctx.drawImage(coffinSprite(mark, 'box'), x - W / 2, yy - H, W, H);
    if (lid > 0 && window.AnimeSprites && window.AnimeSprites.has(c.id)) {
      window.AnimeSprites.draw(ctx, c.id, x, yy - 8, { facing: c.f || 1, frame: c.frame || 'idle', phase: time * 2, scale: 1.15 });
      lit(ctx, () => Kit().glow(ctx, x, yy - 50, 60, '170,120,255', .25));
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= alpha * (1 - easeIn(lid));
    if (lid < 1) {
      // The lid tips forward and crashes to the ground.
      ctx.translate(x, yy); ctx.rotate(.9 * easeIn(lid) * (c.f || 1)); ctx.translate(0, 60 * easeIn(lid));
      ctx.drawImage(coffinSprite(mark, 'lid'), -W / 2, -H, W, H);
    }
    ctx.restore();
  }
  FX.edo = [(ctx, fx, time) => {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const c of fx.coffins) {
      ctx.fillStyle = `rgba(20,10,24,${.4 * fade})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, 54, 22, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(30,20,14,${.6 * fade})`; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + fx.seed; ctx.moveTo(c.x + Math.cos(a) * 30, c.y + Math.sin(a) * 14); ctx.lineTo(c.x + Math.cos(a) * 70, c.y + Math.sin(a) * 32); }
      ctx.stroke();
    }
  }, (ctx, fx, time) => {
    const K = Kit(), rise = easeOut(fx.age / .45), lid = win(fx.age, .65, .95), crumble = win(fx.age, fx.dur - .7, fx.dur);
    const f = faceOf(Math.atan2(fx.ty - fx.coffins[0].y, fx.tx - fx.coffins[0].x));
    fx.coffins.forEach((c, i) => {
      c.f = f; c.frame = (i === 0 ? fx.age > 1.0 && fx.age < 1.6 : fx.age > 1.25 && fx.age < 2) ? 'seal' : 'idle';
      drawCoffin(ctx, c, c.mark, rise, lid, time, 1 - crumble);
      if (fx.age < .5) dustRing(ctx, c.x, c.y, 60, fx.age / .5, 1, fx.seed + i, 10);
      if (crumble > 0) { const ash = K.puff('smoke'); for (let k = 0; k < 6; k++) K.stamp(ctx, ash, c.x + (hash(k + i) - .5) * 60, c.y - 40 - crumble * 80 - k * 14, 20 + crumble * 30, .6 * bell(crumble)); }
    });
    const H = window.HokageVFX;
    // Hashirama's forest / Tobirama's water dragon (borrowed Hokage art).
    if (fx.wood && H) { fx.wood.life = Math.max(0, fx.wood.maxLife - (fx.age - fx.wood.t0)); if (fx.wood.life > 0) H.drawEffects(ctx, { effects: [fx.wood] }, time); }
    if (fx.water && H) { fx.water.life = Math.max(0, fx.water.maxLife - (fx.age - fx.water.t0)); if (fx.water.life > 0) H.drawEffects(ctx, { effects: [fx.water] }, time); }
    // Itachi's great fireball.
    if (fx.ball) {
      const b = fx.ball, t = (fx.age - b.t0) / b.T;
      if (t >= 0 && t < 1) {
        const e = easeIn(t), px = lerp(b.x0, b.x1, e), py = lerp(b.y0 - 40, b.y1 - 30, e) - Math.sin(Math.PI * t) * 40, fire = K.puff('fire');
        for (let k = 0; k < 6; k++) { const tt = k / 6; K.stamp(ctx, fire, lerp(b.x0, px, 1 - tt * .3), lerp(b.y0 - 40, py, 1 - tt * .3), 30 - k * 3, .5); }
        lit(ctx, () => K.glow(ctx, px, py, 150, '255,140,40', .7));
        K.stamp(ctx, fire, px, py, 70 + Math.sin(time * 20) * 4, 1);
        K.stamp(ctx, fire, px + 14, py - 10, 46, .9);
      }
    }
    // Deidara's clay birds.
    if (fx.birds) {
      const img = birdSprite();
      for (const bd of fx.birds) {
        const t = (fx.age - (bd.t - (fx.bt0 !== undefined ? 0 : 0))) / .55;
        if (t < 0 || t >= 1) continue;
        const px = lerp(fx.bx, bd.x, t), py = lerp(fx.by - 60, bd.y, t) - Math.sin(Math.PI * t) * 120 + Math.sin(time * 18 + bd.x) * 4;
        ctx.save(); ctx.translate(px, py); if (bd.x < fx.bx) ctx.scale(-1, 1); ctx.drawImage(img, -22, -16, 44, 33); ctx.restore();
      }
    }
  }];
  FX.blast = [(ctx, fx) => { crater(ctx, fx.x, fx.y, fx.r * .7, 1 - win(fx.age, fx.dur * .5, fx.dur), fx.seed); },
    (ctx, fx, time) => { Kit().fx.fireBlast(ctx, fx.x, fx.y, fx.r, fx.age / fx.dur, 1 - easeIn(win(fx.age, fx.dur * .5, fx.dur)), time, fx.seed); }];

  // ------------------------------------------------------------------ FX: Kabuto
  FX.muki = [(ctx, fx) => {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.strokeStyle = `rgba(36,30,22,${.55 * fade})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const b of fx.lines) {
      const L = Math.min(780, fx.age * 900);
      ctx.moveTo(fx.x + Math.cos(b) * 40, fx.y + Math.sin(b) * 40);
      for (let d = 80; d < L; d += 40) ctx.lineTo(fx.x + Math.cos(b) * d + (hash(d + b) - .5) * 14, fx.y + Math.sin(b) * d + (hash(d * 2 + b) - .5) * 14);
    }
    ctx.stroke();
    for (const s of fx.stakes) if (fx.age > s.t) { ctx.fillStyle = `rgba(30,24,18,${.35 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 30, 13, 0, 0, TAU); ctx.fill(); }
  }, (ctx, fx, time) => {
    const K = Kit(), dust = K.puff('dust');
    for (const s of fx.stakes) {
      const t = fx.age - s.t;
      if (t < 0) continue;
      const g = easeOutBack(t / .16), crumble = win(t, 1.2, 1.7);
      if (crumble >= 1) continue;
      const h = s.h * g * (1 - crumble * .6), w = 30 + s.h * .12;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.lean); ctx.globalAlpha = 1 - crumble;
      ctx.drawImage(stakeSprite(s.v), -w / 2, -h, w, h);
      ctx.restore();
      if (t < .5) K.stamp(ctx, dust, s.x, s.y - 8, 18 + t * 50, .9 * (1 - t / .5));
    }
    ctx.globalAlpha = 1;
  }];

  // Hakugeki: a small white dragon shrieks; pulses of sound ripple outwards.
  function shriekDragon(ctx, z, a, time, k, open) {
    const cx = z.x, cy = z.y - 130, n = 12;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), b = time * 2 + t * TAU * .85, r = 48 * k * (1 - t * .3);
      PB[i * 2] = cx + Math.cos(b) * r; PB[i * 2 + 1] = cy + Math.sin(b) * r * .55 + t * 6;
    }
    serpent(ctx, n, 6 + 11 * k, 3 + 6 * k, PAL.white, time * 3, 2);
    serpentHead(ctx, cx + Math.cos(a) * 50 * k, cy - 22 * k, a, 38 * k + 4, PAL.white, open, true);
  }
  FX.shriek = [(ctx, fx, time) => {
    const z = fx.z;
    for (let k = 0; k < 3; k++) {
      const t = win(fx.age, k * .36, k * .36 + .55);
      if (t <= 0 || t >= 1) continue;
      const r = 50 + easeOut(t) * 430;
      ctx.fillStyle = `rgba(200,210,230,${.12 * (1 - t)})`; ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, TAU); ctx.fill();
    }
  }, (ctx, fx, time) => {
    const z = fx.z, K = Kit(), fade = 1 - win(fx.age, fx.dur - .3, fx.dur);
    ctx.globalAlpha = fade;
    shriekDragon(ctx, z, fx.a, time, 1, .9 + .1 * Math.sin(time * 40));
    ctx.globalAlpha = 1;
    for (let k = 0; k < 3; k++) {
      const t = win(fx.age, k * .36, k * .36 + .55);
      if (t <= 0 || t >= 1) continue;
      const r = 50 + easeOut(t) * 430, al = 1 - t;
      for (const [rr, w] of [[r, 9], [r * .86, 5], [r * .7, 3]]) {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) { const b = i / 64 * TAU, q = rr + Math.sin(b * 14 + time * 40 + k) * 7; i ? ctx.lineTo(z.x + Math.cos(b) * q, z.y - 20 + Math.sin(b) * q) : ctx.moveTo(z.x + Math.cos(b) * q, z.y - 20 + Math.sin(b) * q); }
        ctx.globalAlpha = al; inkStroke(ctx, 'rgba(248,252,255,.95)', 'rgba(40,50,70,.55)', w);
      }
      ctx.globalAlpha = 1;
      lit(ctx, () => K.glow(ctx, z.x, z.y - 60, r * .6, '220,235,255', .25 * al));
    }
    // Radial "sound" streaks.
    ctx.globalAlpha = fade * (fx.age < 1.1 ? 1 : 0); ctx.beginPath();
    for (let i = 0; i < 18; i++) { const b = i / 18 * TAU + time * .5, d0 = 60 + ((time * 600 + i * 40) % 320); ctx.moveTo(z.x + Math.cos(b) * d0, z.y - 30 + Math.sin(b) * d0); ctx.lineTo(z.x + Math.cos(b) * (d0 + 50), z.y - 30 + Math.sin(b) * (d0 + 50)); }
    inkStroke(ctx, 'rgba(255,255,255,.9)', 'rgba(40,50,70,.5)', 2);
    ctx.globalAlpha = 1;
  }];

  // Ryūchi Cave snakes: a dark rift above the mark rains snakes that land, writhe and burrow.
  FX.snakerain = [(ctx, fx, time) => {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.fillStyle = `rgba(20,30,24,${.18 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, TAU); ctx.fill();
    for (const d of fx.drops) {
      const t = fx.age - d.t0 - .38;
      if (t < 0) continue;
      crater(ctx, d.x, d.y, 34, fade * (1 - win(t, 1, 2)), d.seed);
    }
  }, (ctx, fx, time) => {
    const K = Kit(), open = easeOut(fx.age / .35) * (1 - win(fx.age, fx.dur - .8, fx.dur)), cx = fx.x, cy = fx.y - 430;
    if (open > .01) {
      // The rift: violet-green cloud swirl.
      const v = K.puff('violet');
      for (let i = 0; i < 9; i++) { const b = i / 9 * TAU + time * .8; K.stamp(ctx, v, cx + Math.cos(b) * 150 * open, cy + Math.sin(b) * 50 * open, 70 * open, .8); }
      K.stamp(ctx, v, cx, cy, 120 * open, .9);
      lit(ctx, () => K.glow(ctx, cx, cy, 200 * open, '120,230,170', .45));
    }
    const fall = [], ground = [], white = [], wg = [];
    for (const d of fx.drops) {
      const t = (fx.age - d.t0) / .38;
      if (t < 0) continue;
      if (t < 1) { const e = easeIn(t); (d.white ? white : fall).push({ x: lerp(cx + (d.x - fx.x) * .3, d.x, e), y: lerp(cy, d.y, e) - 10, a: Math.PI / 2, len: 80, w: 11, ph: d.seed }); }
      else {
        const g = fx.age - d.t0 - .38;
        if (g > 1.3) continue;
        const sink = win(g, .9, 1.3);
        (d.white ? wg : ground).push({ x: d.x + Math.sin(g * 3 + d.seed) * 10, y: d.y - 4 + sink * 10, a: d.seed % TAU, len: 80 * (1 - sink * .7), w: 11, ph: d.seed });
      }
    }
    snakeSwarm(ctx, ground, PAL.olive, time); snakeSwarm(ctx, wg, PAL.pale, time);
    snakeSwarm(ctx, fall, PAL.olive, time); snakeSwarm(ctx, white, PAL.pale, time);
    const dust = K.puff('dust');
    for (const d of fx.drops) { const g = fx.age - d.t0 - .38; if (g >= 0 && g < .4) K.stamp(ctx, dust, d.x, d.y - 8, 16 + g * 60, .8 * (1 - g / .4)); }
  }];

  // Mandala of snakes: a tide of serpents floods the lane.
  FX.mandala = [(ctx, fx) => {
    const front = Math.min(fx.len, fx.age * fx.speed), fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(30,36,24,${.3 * fade})`; ctx.fillRect(20, -fx.W, front - 20, fx.W * 2);
    ctx.restore();
  }, (ctx, fx, time) => {
    const front = fx.age * fx.speed, ca = Math.cos(fx.a), sa = Math.sin(fx.a), sink = win(fx.age, fx.dur - .7, fx.dur);
    const A = [], B = [], C = [];
    for (let j = 0; j < 54; j++) {
      const u = (hash(fx.seed + j * 1.3) - .5) * 2 * fx.W, lag = hash(fx.seed + j * 2.7) * 280, d = Math.min(fx.len - hash(j) * 60, front - lag);
      if (d < 40) continue;
      const wob = Math.sin(time * 6 + j) * 10;
      (j % 3 === 0 ? B : A).push({ x: fx.x + ca * d - sa * (u + wob), y: fx.y + sa * d + ca * (u + wob) - 6, a: fx.a + Math.sin(time * 5 + j) * .35, len: 70 + hash(j * 5) * 50, w: 9, ph: j });
    }
    for (let j = 0; j < 4; j++) {
      const u = (j / 3 - .5) * fx.W * 1.2, d = Math.min(fx.len - 40, front - 60 - j * 30);
      if (d > 40) C.push({ j, x: fx.x + ca * d - sa * u, y: fx.y + sa * d + ca * u - 20, d, u });
    }
    ctx.globalAlpha = 1 - sink;
    snakeSwarm(ctx, A, PAL.olive, time); snakeSwarm(ctx, B, PAL.pale, time);
    // A few big serpents leading the tide.
    for (const c of C) {
      const n = bezPts(c.x - ca * 200, c.y - sa * 200, c.x - ca * 100 - sa * 30, c.y - sa * 100 + ca * 30 - 20, c.x, c.y, 0, 1, 10, 12, 1.5, time * 6 + c.j);
      serpent(ctx, n, 20, 28, c.j % 2 ? PAL.white : PAL.olive, time * 3, 2);
      serpentHead(ctx, c.x, c.y, fx.a, 32, c.j % 2 ? PAL.white : PAL.olive, .6 + .3 * Math.sin(time * 8 + c.j), false);
    }
    ctx.globalAlpha = 1;
  }];

  // Great white snake-dragon: rises behind Kabuto, lunges down the lane, coils and crushes.
  function dragonPath(fx, k) {
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), rx = fx.x - ca * 20, ry = fx.y - 20;
    const cx = fx.x + ca * fx.L * .35, cy = fx.y + sa * fx.L * .35 - 300;
    return { rx, ry, cx, cy, k };
  }
  FX.dragon = [(ctx, fx, time) => {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur), ca = Math.cos(fx.a), sa = Math.sin(fx.a), reach = Math.min(1, easeIn(fx.age / .55)) * fx.L;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(30,22,16,${.35 * fade})`; ctx.fillRect(60, -70, reach - 60, 140);
    ctx.restore();
    if (fx.age > .55) {
      const r = lerp(330, 110, easeIn(win(fx.age, .55, 1.45)));
      ctx.strokeStyle = `rgba(20,14,20,${.3 * fade})`; ctx.lineWidth = 60; ctx.beginPath(); ctx.arc(fx.ex, fx.ey, r, 0, TAU); ctx.stroke();
    }
    if (fx.age > 1.55) { const t = fx.age - 1.55; crater(ctx, fx.ex, fx.ey, 220, fade, fx.seed); Kit().fx.shockRing(ctx, fx.ex, fx.ey, 520, t * 1.3, 1 - win(t, 0, 1), '236,246,240'); }
    void ca; void sa;
  }, (ctx, fx, time) => {
    const K = Kit(), sink = win(fx.age, fx.dur - .7, fx.dur), P = dragonPath(fx);
    const s = easeIn(Math.min(1, fx.age / .55));
    ctx.globalAlpha = 1 - sink;
    // Coil round the end point once the head has landed.
    if (fx.age > .5) {
      const g = easeOut(win(fx.age, .5, .8)), r = lerp(330, 110, easeIn(win(fx.age, .55, 1.45))), n = 30, spin = fx.seed + fx.age * 1.4;
      for (let i = 0; i < n; i++) { const t = i / (n - 1), b = spin + t * TAU * .95 * g; PB[i * 2] = fx.ex + Math.cos(b) * r * (1 + .1 * t); PB[i * 2 + 1] = fx.ey + Math.sin(b) * r * (1 + .1 * t) - 24; }
      serpent(ctx, n, 64, 48, PAL.white, -fx.age * 5, 4);
    }
    // The long body: up out of Kabuto's back to where the head reared, then arcing down the lane.
    const ca = Math.cos(fx.a), f = faceOf(fx.a), ex = fx.ex, ey = fx.ey - 30;
    const h0x = P.rx - ca * 40, h0y = P.ry - 260, cx = (h0x + ex) / 2, cy = Math.min(h0y, ey) - 170;
    const u = 1 - s;
    let hx = u * u * h0x + 2 * u * s * cx + s * s * ex, hy = u * u * h0y + 2 * u * s * cy + s * s * ey;
    const rise = easeOut(win(fx.age, 1.2, 1.45)), slam = easeIn(win(fx.age, 1.45, 1.57));
    if (fx.age > 1.2) { hy = lerp(ey, ey - 220, rise); hy = lerp(hy, fx.ey - 30, slam); }
    let n = bezPts(P.rx, P.ry, P.rx - ca * 80 - f * 40, P.ry - 40, h0x, h0y, 0, 1, 7, 8, 1, fx.age * 6);
    n = bezPts(h0x, h0y, cx, cy, ex, ey, 1 / 16, Math.max(1 / 16, s), 16, 10, 2, fx.age * 6, n);
    PB[(n - 1) * 2] = hx; PB[(n - 1) * 2 + 1] = hy;
    serpent(ctx, n, 76, 58, PAL.white, -fx.age * 6, 4);
    const ax = PB[(n - 1) * 2] - PB[(n - 3) * 2], ay = PB[(n - 1) * 2 + 1] - PB[(n - 3) * 2 + 1];
    lit(ctx, () => K.glow(ctx, hx, hy, 170, '200,255,230', .35));
    serpentHead(ctx, hx, hy, Math.atan2(ay, ax), 92, PAL.white, (fx.age < .55 || (slam > 0 && slam < 1)) ? 1 : .5 + .3 * Math.sin(time * 5), true);
    ctx.globalAlpha = 1;
    if (fx.age > 1.57) { const t = fx.age - 1.57; dustRing(ctx, fx.ex, fx.ey, 300, t / 1.3, 1, fx.seed, 18); K.fx.debris(ctx, fx.ex, fx.ey, 360, t * 1.1, fx.seed, '#5a4636', 16); }
    if (sink > 0) K.fx.smokePoof(ctx, fx.ex, fx.ey - 60, 420, sink);
  }];

  // ------------------------------------------------------------------ windup art
  function chargeAura(ctx, z, st, m, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, cx = z.x, cy = z.y - 40;
    if (z.bossId === 'jiraiya') {
      lit(ctx, () => K.glow(ctx, cx, cy, 60 + 30 * k, '255,150,60', .45));
      ctx.strokeStyle = 'rgba(255,170,80,.75)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const ph = (time * 1.6 + i / 5) % 1; ctx.globalAlpha = bell(ph); ctx.beginPath(); ctx.ellipse(cx, z.y - 4, 30 + ph * 40, 10 + ph * 14, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else if (z.bossId === 'orochimaru') {
      const v = K.puff('violet');
      for (let i = 0; i < 7; i++) { const ph = (time * 1.2 + i / 7) % 1; K.stamp(ctx, v, cx + Math.sin(i * 2.3 + time) * 30, cy + 34 - ph * 80, 14 + 10 * (1 - ph), .55 * bell(ph)); }
      lit(ctx, () => K.glow(ctx, cx, cy, 50 + 30 * k, '170,120,255', .4));
    } else {
      lit(ctx, () => K.glow(ctx, cx, cy, 60 + 30 * k, '140,240,190', .45));
      ctx.strokeStyle = 'rgba(230,255,240,.8)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) { const ph = (time * 1.4 + i / 6) % 1, b = i * 1.7 + time; ctx.globalAlpha = bell(ph); ctx.beginPath(); ctx.arc(cx + Math.cos(b) * 34, cy + 30 - ph * 70, 5, 3.4, 6); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  // Moves that show their mass forming before release.
  function windupOverlay(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), f = faceOf(a);
    switch (st.move) {
      case 'oodama': {
        const r = 8 + 56 * easeOut(k), x = z.x + ca * 30 + f * 6, y = z.y - 44 - r * .3;
        ctx.strokeStyle = 'rgba(200,236,255,.8)'; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) { const b = time * 6 + i / 8 * TAU, d = r * 2.4 * (1 - ((time * 2 + i / 8) % 1)); ctx.beginPath(); ctx.arc(x, y, d, b, b + .6); ctx.stroke(); }
        bigOrb(ctx, x, y, r, time);
        break;
      }
      case 'harijizo': case 'needles': {
        ctx.beginPath();
        for (let i = 0; i < 14; i++) { const b = -Math.PI + i / 13 * Math.PI, l = 30 + 40 * k; ctx.moveTo(z.x + Math.cos(b) * 26, z.y - 70 + Math.sin(b) * 20); ctx.lineTo(z.x + Math.cos(b) * (26 + l), z.y - 70 + Math.sin(b) * (20 + l)); }
        inkStroke(ctx, '#f6f4ee', 'rgba(30,24,20,.85)', 2.4);
        break;
      }
      case 'goemon': lit(ctx, () => K.glow(ctx, z.x, z.y - 50, 120 * k, '255,120,30', .5)); break;
      case 'senei': {
        for (let i = 0; i < 3; i++) {
          const b = a + (i - 1) * .6 + Math.sin(time * 6 + i) * .2, l = 20 + 26 * k;
          const hx = z.x + Math.cos(b) * l, hy = z.y - 34 + Math.sin(b) * l * .6;
          const n = bezPts(z.x, z.y - 34, (z.x + hx) / 2, hy - 14, hx, hy, 0, 1, 6);
          serpent(ctx, n, 6, 9, PAL.olive, time * 3, 1);
          serpentHead(ctx, hx, hy, b, 14, PAL.olive, .5 + .4 * Math.sin(time * 9 + i), false);
        }
        break;
      }
      case 'kusanagi': {
        const x = z.x + f * 10, y = z.y - 62;
        lit(ctx, () => {
          K.glow(ctx, x, y, 30 + 30 * k, '220,200,255', .8);
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
          const r = 14 + 20 * k * (.8 + .2 * Math.sin(time * 30));
          ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
        });
        break;
      }
      case 'yamata': case 'dairyu': {
        // White serpents start to surface behind the caster.
        const many = st.move === 'yamata';
        ctx.fillStyle = 'rgba(30,20,24,.35)'; ctx.beginPath(); ctx.arc(z.x, z.y, 70 + 40 * k, 0, TAU); ctx.fill();
        if (many) for (let i = 0; i < 8; i++) {
          const bx = z.x + Math.cos(i / 8 * TAU) * 40, by = z.y - 6 + Math.sin(i / 8 * TAU) * 16, h = 30 + 90 * easeOut(k) * (.7 + .3 * hash(i));
          const hx = bx + Math.cos(i / 8 * TAU) * 30, hy = by - h;
          const n = bezPts(bx, by, bx, by - h * .6, hx, hy, 0, 1, 6, 4, 1, time * 4 + i);
          serpent(ctx, n, 26 * k + 6, 18 * k + 5, PAL.white, time, 1);
          serpentHead(ctx, hx, hy, -Math.PI / 2 + Math.cos(i / 8 * TAU) * .9, 28 * k + 8, PAL.white, .4, false);
        } else {
          const rx = z.x - ca * 20, ry = z.y - 20, hx = rx - ca * 40 + Math.sin(time * 2) * 10, hy = ry - 60 - 200 * easeOut(k);
          const n = bezPts(rx, ry, rx - ca * 80 - f * 40, ry - 40, hx, hy, 0, 1, 12, 12, 1.4, time * 5);
          serpent(ctx, n, 70 * k + 10, 50 * k + 8, PAL.white, time * 2, 3);
          serpentHead(ctx, hx, hy, a - .3 * f, 80 * k + 12, PAL.white, .5 + .4 * Math.sin(time * 6), true);
          lit(ctx, () => K.glow(ctx, hx, hy, 140 * k, '190,255,220', .4));
        }
        break;
      }
      case 'daitoppa': {
        ctx.strokeStyle = 'rgba(250,252,255,.85)'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const ph = 1 - ((time * 2 + i / 6) % 1), r = 20 + ph * 80; ctx.beginPath(); ctx.arc(z.x + f * 10, z.y - 60, r, i + time * 6, i + time * 6 + 1.6); ctx.stroke(); }
        break;
      }
      case 'muki': {
        lit(ctx, () => K.glow(ctx, z.x, z.y, 80 + 60 * k, '150,255,190', .45, false, .6));
        ctx.strokeStyle = 'rgba(180,255,210,.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) { const b = a + i * .3, L = 60 + 200 * k; ctx.moveTo(z.x, z.y); for (let d = 30; d < L; d += 30) ctx.lineTo(z.x + Math.cos(b) * d + (hash(d + i) - .5) * 10, z.y + Math.sin(b) * d + (hash(d * 3 + i) - .5) * 10); }
        ctx.stroke();
        break;
      }
      case 'hakugeki': shriekDragon(ctx, z, a, time, easeOutBack(k), .3 + .5 * k); break;
      case 'ryudo': {
        const v = K.puff('violet'), cx = st.tx, cy = st.ty - 430;
        for (let i = 0; i < 6; i++) { const b = i / 6 * TAU + time; K.stamp(ctx, v, cx + Math.cos(b) * 120 * k, cy + Math.sin(b) * 40 * k, 60 * k, .7); }
        break;
      }
      case 'mandala': {
        const list = [];
        for (let i = 0; i < 10; i++) { const b = i / 10 * TAU + time * .6, d = 30 + 40 * k; list.push({ x: z.x + Math.cos(b) * d, y: z.y + Math.sin(b) * d * .6, a: b + 1.6, len: 40, w: 7, ph: i }); }
        snakeSwarm(ctx, list, PAL.olive, time, k);
        break;
      }
    }
  }

  function bodyLift() { return 0; }

  function label(ctx, z, st, m) {
    if (!(st.windup > 0) || !st.move) return;
    const S = window.AnimeSprites, id = S && S.has && S.has(z.bossId) ? z.bossId : 'pain';
    const top = z.y - (S && S.height ? S.height(id) : 100) - 34;
    ctx.save();
    ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#160f1d'; ctx.strokeText(MOVES[st.move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[st.move].label, z.x, top);
    ctx.restore();
  }

  // ------------------------------------------------------------------ draw entry points
  const reset = ctx => { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; };
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.sn;
    if (!m || !st || !Kit()) return;
    if (!st.fx.length && !(st.windup > 0)) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); reset(ctx); } }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
      for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.sn;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      if (fx.kind === 'mapa') fx.z = z;
      const f = FX[fx.kind]; if (f && f[1]) { f[1](ctx, fx, time, z); reset(ctx); }
    }
    if (z.health > 0 && st.windup > 0 && st.move) {
      chargeAura(ctx, z, st, m, time); reset(ctx);
      windupOverlay(ctx, z, st, time); reset(ctx);
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  window.SanninBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, bodyLift, moves };
})();
