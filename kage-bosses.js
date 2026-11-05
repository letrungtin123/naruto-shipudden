(() => {
  'use strict';

  // The four Kage who defend their villages when the player starts levelling houses.
  // Same contract as akatsuki-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time)
  // paints telegraphs and ground effects, drawOverlay(ctx, z, time) paints what stands above the
  // characters (sand walls, lava waves, lightning, boulders, Dust Release cubes).
  // All per-boss state lives on z.kg; the body is an AnimeSprites character drawn by the game.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const FB = 114 / 128; // flame sprite base

  const order = ['gaara', 'mei', 'ay', 'onoki'];
  const members = {
    gaara: { name: 'GAARA — GODAIME KAZEKAGE', village: 'suna', accent: '#e0b46a', hpScale: 3.1, damageScale: 1.75, armor: .7, lift: 0,
      moves: ['coffin', 'shuriken', 'tsunami', 'rain', 'coffin', 'funeral'] },
    mei:   { name: 'MEI TERUMĪ — GODAIME MIZUKAGE', village: 'kiri', accent: '#ff7a3a', hpScale: 2.8, damageScale: 1.85, lift: 0,
      moves: ['lava', 'mist', 'dragon', 'globs', 'lava', 'sea'] },
    ay:    { name: 'A — YONDAIME RAIKAGE', village: 'kumo', accent: '#ffe45a', hpScale: 3.4, damageScale: 1.95, lift: 0,
      moves: ['armor', 'lariat', 'chop', 'liger', 'lariat', 'storm'] },
    onoki: { name: 'ŌNOKI — SANDAIME TSUCHIKAGE', village: 'iwa', accent: '#f2f4f6', hpScale: 2.7, damageScale: 2.05, lift: 30,
      moves: ['boulder', 'jinton', 'light', 'golem', 'boulder', 'cube'] }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    coffin:   { label: 'SA PHƯỢC CỮU · SA BỘC TỐNG TÁNG', rgb: '224,180,106', windup: 1.0, after: 1.5 },
    shuriken: { label: 'SA THỦ LÝ KIẾM', rgb: '232,200,138', windup: .55, after: 1.3 },
    tsunami:  { label: 'SA BỘC ĐẠI LÃNG', rgb: '224,180,106', windup: .85, after: 1.7 },
    rain:     { label: 'SA THỜI VŨ', rgb: '224,180,106', windup: .7, after: 2.0 },
    funeral:  { label: 'SA BỘC ĐẠI TÁNG', rgb: '240,190,100', windup: 1.3, after: 2.8 },
    lava:     { label: 'DUNG ĐỘN · DUNG QUÁI CHI THUẬT', rgb: '255,110,40', windup: .75, after: 1.5 },
    mist:     { label: 'PHÍ ĐỘN · CƯƠNG VỤ CHI THUẬT', rgb: '196,232,120', windup: .85, after: 1.5 },
    dragon:   { label: 'THỦY ĐỘN · THỦY LONG ĐẠN', rgb: '120,200,255', windup: .7, after: 1.3 },
    globs:    { label: 'DUNG ĐỘN · DUNG THẠCH VŨ', rgb: '255,120,40', windup: .65, after: 2.0 },
    sea:      { label: 'DUNG ĐỘN · DUNG HẢI', rgb: '255,90,30', windup: 1.25, after: 3.0 },
    armor:    { label: 'LÔI ĐỘN · LÔI KHẢI', rgb: '255,228,90', windup: .5, after: .9 },
    lariat:   { label: 'LÔI ĐỘN · LARIAT', rgb: '255,228,90', windup: .6, after: 1.1 },
    chop:     { label: 'LÔI NGƯỢC THỦY BÌNH THIÊN ĐẠI VŨ', rgb: '255,236,120', windup: .7, after: 1.1 },
    liger:    { label: 'LIGER BOMB', rgb: '255,228,90', windup: .85, after: 1.4 },
    storm:    { label: 'SONG LARIAT · LÔI BẠO', rgb: '255,240,140', windup: 1.2, after: 3.0 },
    boulder:  { label: 'THỔ ĐỘN · GIA TRỌNG NHAM', rgb: '214,186,146', windup: 1.0, after: 1.3 },
    jinton:   { label: 'TRẦN ĐỘN · THOÁT LY THẾ GIỚI NGUYÊN THỦY', rgb: '235,245,255', windup: 1.15, after: 1.5 },
    light:    { label: 'THỔ ĐỘN · KHINH TRỌNG NHAM', rgb: '214,186,146', windup: .95, after: 1.5 },
    golem:    { label: 'THỔ ĐỘN · NHAM NHÂN CHI THUẬT', rgb: '200,170,130', windup: .8, after: 2.7 },
    cube:     { label: 'TRẦN ĐỘN · CỰ LẬP PHƯƠNG', rgb: '240,248,255', windup: 1.3, after: 2.8 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;
  const byVillage = { suna: 'gaara', kiri: 'mei', kumo: 'ay', iwa: 'onoki' };
  // Team battle: the member's jutsu in key order 1..n (each once; the rotation's last new jutsu is the ultimate).
  const MOVE_LIST = {};
  for (const id in members) MOVE_LIST[id] = [...new Set(members[id].moves)].map(k => ({ id: k, label: MOVES[k].label }));
  function moves(z) { return (z && MOVE_LIST[z.bossId]) || []; }

  const SAND = [[1, '#7a5a2e'], [.84, '#a88246'], [.66, '#c9a262'], [.46, '#e2c487'], [.25, '#f6e6bc']];
  const LAVA = [[1, '#5a0d04'], [.84, '#b0220a'], [.66, '#ff5a14'], [.46, '#ffa030'], [.25, '#ffe9a0']];
  const BOLT_Y = ['255,210,70', '255,240,150', '255,255,240'];
  const BOLT_B = ['90,170,255', '170,220,255', '240,250,255'];

  function pick(index) { return order[((index % order.length) + order.length) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.kg || (z.kg = { t: 0, casts: 0, timer: .9, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], shots: [], force: null, dash: null, jump: null, armor: 0, hold: 0, gx: 0, gy: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });

  // Hit points covering a cone (true world geometry, same as its telegraph).
  function conePts(x, y, a, reach, half) {
    const out = [];
    for (let d = 70; d <= reach; d += 85) {
      const cnt = Math.max(1, Math.ceil(2 * half * d / 120)), r = Math.max(56, (2 * half * d / cnt) * .64);
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half * .9);
        out.push({ x: x + Math.cos(aa) * d, y: y + Math.sin(aa) * d, r, d });
      }
    }
    return out;
  }
  function ringStrikes(api, x, y, rho, dmg, kind, everyKind = 4) {
    const n = Math.max(6, Math.ceil(TAU * rho / 110)), r = Math.max(58, TAU * rho / n * .62);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      api.strike(x + Math.cos(a) * rho, y + Math.sin(a) * rho, r, dmg, null, i % everyKind === 0 ? kind : null, true);
    }
  }

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty;
    const line = (len, w) => ({ k: 'line', x, y, a, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    switch (move) {
      case 'coffin': return [circ(tx, ty, 160)];
      case 'shuriken': return [{ k: 'cone', x, y, a, r: 720, h: .66, faint: true }];
      case 'tsunami': return [line(820, 250)];
      case 'rain': return [circ(tx, ty, 360, true)];
      case 'funeral': return [circ(tx, ty, 470), circ(tx, ty, 230)];
      case 'lava': return [line(760, 80)];
      case 'mist': return [{ k: 'cone', x, y, a, r: 600, h: .62 }];
      case 'dragon': return [line(920, 85)];
      case 'globs': return [circ(tx, ty, 380, true)];
      case 'sea': return [circ(x, y, 560)];
      case 'armor': return [circ(x, y, 280)];
      case 'lariat': return [line(820, 95)];
      case 'chop': return [{ k: 'cone', x, y, a, r: 470, h: 1.15 }];
      case 'liger': return [circ(tx, ty, 230)];
      case 'storm': return [circ(tx, ty, 440, true), line(900, 120)];
      case 'boulder': return [circ(tx, ty, 210)];
      case 'jinton': return [line(960, 95)];
      case 'light': return [line(860, 120), circ(x + Math.cos(a) * 860, y + Math.sin(a) * 860, 200)];
      case 'golem': {
        const d = Math.hypot(tx - x, ty - y), k = d > 1 ? Math.min(1, 170 / d) : 0;
        st.gx = tx + (x - tx) * k; st.gy = ty + (y - ty) * k;
        return [circ(st.gx, st.gy, 110)];
      }
      case 'cube': return [circ(tx, ty, 380)];
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    let move = forced; // a manual cast leaves the AI rotation where it was
    if (!move) {
      move = st.force;
      if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.tele = teleFor(z, st, move);
  }

  function startDash(z, st, a, len, speed, w, dmg, endR, endDmg, dbl) {
    const fx = addFx(st, { kind: 'streak', x0: z.x, y0: z.y, x1: z.x, y1: z.y, a, w, dbl, dur: len / speed + .8, seed: Math.random() * 99 });
    st.dash = { a, speed, left: len / speed, hit: 0, w, dmg, endR, endDmg, fx };
  }

  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, s = st.tele[0] || { x: z.x, y: z.y, a: st.aim, r: 150, len: 600, w: 80 };
    const ca = Math.cos(s.a || 0), sa = Math.sin(s.a || 0), seed = Math.random() * 99;
    api.burst(z.x, z.y - 20, m.accent, 10);
    switch (move) {
      // ---------------------------------------------------------- Gaara
      case 'coffin':
        addFx(st, { kind: 'coffin', x: s.x, y: s.y, r: s.r, dur: 2.2, seed });
        later(st, .55, api => { api.strike(s.x, s.y, s.r, D * 2.4, null, 'earth'); api.shake(11); api.burst(s.x, s.y - 30, '#e8c88a', 22); });
        break;
      case 'shuriken':
        for (let v = 0; v < 3; v++) later(st, v * .22, api => {
          for (let i = 0; i < 9; i++) {
            const b = api.projectile(z, s.a + (i / 8 - .5) * 1.22 + (v - 1) * .07, 660, D * .75, 'sand', '#e8c88a', 1.2);
            if (b) { if (st.shots.length > 30) st.shots.shift(); st.shots.push({ b, px: NaN, py: NaN, r: Math.random() * TAU }); }
          }
          api.burst(z.x, z.y - 24, '#e8c88a', 8);
        });
        break;
      case 'tsunami': {
        addFx(st, { kind: 'wave', x: s.x, y: s.y, a: s.a, len: s.len, w: s.w, speed: 900, dur: s.len / 900 + 1.9, seed });
        for (let d = 70, i = 0; d <= s.len; d += 85, i++) later(st, d / 900, api => {
          const cx = s.x + ca * d, cy = s.y + sa * d;
          api.line(cx + sa * s.w, cy - ca * s.w, cx - sa * s.w, cy + ca * s.w, 52, D * 1.7, i % 3 ? null : 'earth');
        });
        api.shake(8);
        break;
      }
      case 'rain': {
        const drops = [];
        for (let i = 0; i < 16; i++) {
          const a = rand(0, TAU), d = i === 0 ? 0 : Math.sqrt(Math.random()) * s.r;
          drops.push({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, t0: .1 + i * .1, fl: .62, r: 78, chase: i % 4 === 3, seed: i * 7.3 + seed });
        }
        drops.forEach((dr, i) => {
          if (dr.chase) later(st, dr.t0, api => { const p = api.player; if (p && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 140) { dr.x = p.x; dr.y = p.y; } });
          later(st, dr.t0 + dr.fl, api => api.strike(dr.x, dr.y, dr.r, D * 1.15, null, i % 3 === 0 ? 'earth' : null, true));
        });
        addFx(st, { kind: 'sandrain', x: s.x, y: s.y, r: s.r, drops, dur: 1.7 + 1.0 + .62 + 1.2, seed });
        break;
      }
      case 'funeral': {
        const R = s.r, x = s.x, y = s.y;
        addFx(st, { kind: 'funeral', x, y, R, close: 1.0, dur: 3.8, seed });
        for (let k = 1; k <= 4; k++) later(st, k * .2, api => ringStrikes(api, x, y, R * (1 - .85 * easeIn(k * .2)), D * .9, 'earth'));
        later(st, 1.05, api => {
          api.strike(x, y, 230, D * 3.4, '#e0b46a', 'crater');
          for (let i = 0; i < 6; i++) api.world(x + Math.cos(i * TAU / 6) * 170, y + Math.sin(i * TAU / 6) * 170, 120, D * 2, 'crater');
          api.shake(20); api.burst(x, y - 40, '#e8c88a', 40);
        });
        st.hold = 1.15;
        break;
      }
      // ---------------------------------------------------------- Mei
      case 'lava': {
        const fx = addFx(st, { kind: 'lavaRiver', x: s.x, y: s.y, a: s.a, len: s.len, w: s.w, speed: 1100, dur: 4.4, tick: .5, seed });
        for (let d = 60, i = 0; d <= s.len; d += 80, i++) later(st, d / 1100, api => api.strike(s.x + ca * d, s.y + sa * d, s.w + 12, D * 1.7, null, i % 3 === 0 ? 'fire' : null, true));
        fx.upd = (fx, dt, api) => {
          if (fx.age > s.len / 1100 && fx.age < fx.dur - .9 && (fx.tick -= dt) <= 0) {
            fx.tick = .5; api.line(s.x, s.y, s.x + ca * s.len, s.y + sa * s.len, s.w * .8, D * .4);
          }
        };
        api.shake(7);
        break;
      }
      case 'mist': {
        const pts = conePts(s.x, s.y, s.a, s.r, s.h), puffs = [];
        for (let i = 0; i < 26; i++) puffs.push({ d: s.r * Math.sqrt(lerp(.04, 1, hash(i * 1.7 + seed))), u: hash(i * 3.1 + seed) * 2 - 1, s: 46 + hash(i * 5.3) * 40, ph: hash(i * 2.2) * TAU });
        puffs.sort((p, q) => p.d * Math.sin(s.a) - q.d * Math.sin(s.a));
        const fx = addFx(st, { kind: 'mist', x: s.x, y: s.y, a: s.a, r: s.r, h: s.h, speed: 650, dur: 5.0, tick: .45, puffs, seed });
        for (const p of pts) later(st, p.d / 650, api => api.strike(p.x, p.y, p.r, D * 1.1, null, null, true));
        fx.upd = (fx, dt, api) => {
          if (fx.age > s.r / 650 && fx.age < fx.dur - .8 && (fx.tick -= dt) <= 0) {
            fx.tick = .45; for (const p of pts) api.strike(p.x, p.y, p.r * .9, D * .4, null, null, true);
          }
        };
        break;
      }
      case 'dragon': {
        addFx(st, { kind: 'dragon', x: s.x, y: s.y, a: s.a, len: s.len, speed: 1250, dur: s.len / 1250 + 1.1, seed });
        for (let d = 60, i = 0; d <= s.len; d += 80, i++) later(st, d / 1250, api => api.strike(s.x + ca * d, s.y + sa * d, s.w + 8, D * 1.9, null, i % 3 ? null : 'vortex', true));
        later(st, s.len / 1250, api => { api.strike(s.x + ca * s.len, s.y + sa * s.len, 170, D * 1.2, '#7fd0ff', 'vortex'); api.shake(9); });
        break;
      }
      case 'globs': {
        const items = [];
        for (let i = 0; i < 12; i++) {
          const a = rand(0, TAU), d = i === 0 ? 0 : Math.sqrt(Math.random()) * s.r;
          items.push({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, t0: .05 + i * .12, fl: .8, chase: i % 3 === 2, seed: seed + i * 5.1 });
        }
        items.forEach((it, i) => {
          if (it.chase) later(st, it.t0, api => { const p = api.player; if (p && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 160) { it.x = p.x; it.y = p.y; } });
          later(st, it.t0 + it.fl, api => { api.strike(it.x, it.y, 90, D * 1.45, null, i % 3 === 0 ? 'fire' : null, true); api.burst(it.x, it.y - 10, '#ff8a3a', 8); });
        });
        const fx = addFx(st, { kind: 'globs', sx: z.x, sy: z.y, items, tick: .5, dur: .05 + 11 * .12 + .8 + 2.4, seed });
        fx.upd = (fx, dt, api) => {
          if ((fx.tick -= dt) > 0) return;
          fx.tick = .5;
          for (const it of fx.items) { const t = fx.age - it.t0 - it.fl; if (t > .1 && t < 2.2) api.strike(it.x, it.y, 62, D * .3, null, null, true); }
        };
        break;
      }
      case 'sea': {
        const R = s.r, x = s.x, y = s.y, speed = 600;
        const fx = addFx(st, { kind: 'sea', x, y, R, speed, dur: R / speed + 3.6, tick: .5, seed });
        for (let r = 80; r <= R; r += 80) later(st, r / speed, api => ringStrikes(api, x, y, r, D * 2.6, 'fire', 3));
        later(st, .02, api => api.strike(x, y, 90, D * 2.6, null, 'fire', true));
        fx.upd = (fx, dt, api) => {
          if (fx.age > R / speed && fx.age < fx.dur - 1.1 && (fx.tick -= dt) <= 0) { fx.tick = .5; api.strike(x, y, R * .97, D * .45, null, null, true); }
        };
        api.shake(12); st.hold = 1.0;
        break;
      }
      // ---------------------------------------------------------- A (Raikage)
      case 'armor':
        st.armor = 9;
        api.strike(z.x, z.y, 280, D * 2.0, null, 'lightning');
        api.knockback(z, 280, 190, 0);
        api.shake(12);
        addFx(st, { kind: 'thunder', x: z.x, y: z.y, r: 280, dur: 1.0, seed });
        break;
      case 'lariat':
        startDash(z, st, s.a, s.len, 2100, s.w, D * 1.6, 180, D * 1.9, false);
        break;
      case 'chop':
        for (const p of conePts(s.x, s.y, s.a, s.r, s.h))
          later(st, .03 + p.d / 3000, api => api.strike(p.x, p.y, p.r, D * 2.3, null, p.d % 255 < 85 ? 'lightning' : null, true));
        addFx(st, { kind: 'chop', x: s.x, y: s.y, a: s.a, r: s.r, h: s.h, side: Math.cos(s.a) >= 0 ? 1 : -1, dur: .75, seed });
        api.shake(10);
        break;
      case 'liger':
        st.jump = { x0: z.x, y0: z.y, x1: s.x, y1: s.y, r: s.r, t: 0, dur: .55, dmg: D * 3.0 };
        break;
      case 'storm': {
        const c = s, L = st.tele[1], bolts = [];
        for (let i = 0; i < 10; i++) {
          const a = rand(0, TAU), d = i === 0 ? 0 : Math.sqrt(Math.random()) * c.r;
          bolts.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, t0: .05 + i * .12, fl: .6, chase: i % 3 === 2, seed: seed + i * 3.3 });
        }
        bolts.forEach((b, i) => {
          if (b.chase) later(st, b.t0, api => { const p = api.player; if (p && Math.hypot(p.x - c.x, p.y - c.y) < c.r + 150) { b.x = p.x; b.y = p.y; } });
          later(st, b.t0 + b.fl, api => { api.strike(b.x, b.y, 105, D * 1.5, null, i % 2 ? null : 'lightning', true); api.shake(6); });
        });
        addFx(st, { kind: 'storm', x: c.x, y: c.y, r: c.r, bolts, dur: 3.1, seed });
        addFx(st, { kind: 'lineMark', a: L.a, len: L.len, w: L.w, dur: 1.15, follow: true });
        later(st, 1.15, () => startDash(z, st, L.a, L.len, 2400, L.w, D * 3.0, 230, D * 2.2, true));
        st.hold = 1.15;
        break;
      }
      // ---------------------------------------------------------- Ōnoki
      case 'boulder':
        addFx(st, { kind: 'boulder', x: s.x, y: s.y, r: s.r, fall: .38, dur: .38 + 2.5, seed });
        later(st, .38, api => {
          api.strike(s.x, s.y, s.r, D * 2.8, '#c8b090', 'crater');
          for (let i = 0; i < 4; i++) api.world(s.x + Math.cos(i * 1.57) * 120, s.y + Math.sin(i * 1.57) * 120, 90, D * 2, 'earth');
          api.shake(14);
        });
        break;
      case 'jinton':
        addFx(st, { kind: 'jinBeam', x: s.x, y: s.y, a: s.a, len: s.len, w: s.w, dur: 1.3, seed });
        for (let d = 60, i = 0; d <= s.len; d += 80, i++) later(st, d / 4000, api => api.strike(s.x + ca * d, s.y + sa * d, s.w, D * 3.0, null, i % 2 ? null : 'crater', true));
        api.shake(14);
        break;
      case 'light': {
        const speed = 1150, end = st.tele[1];
        addFx(st, { kind: 'hurl', x: s.x, y: s.y, a: s.a, len: s.len, speed, r: end.r, dur: s.len / speed + 2.6, seed });
        for (let d = 90, i = 0; d < s.len; d += 90, i++) later(st, d / speed, api => api.strike(s.x + ca * d, s.y + sa * d, s.w, D * 2.0, null, i % 3 ? null : 'earth', true));
        later(st, s.len / speed, api => { api.strike(end.x, end.y, end.r, D * 2.2, '#c8b090', 'crater'); api.shake(15); });
        break;
      }
      case 'golem': {
        const gx = st.gx, gy = st.gy;
        const fx = addFx(st, { kind: 'golem', x: gx, y: gy, dur: 3.5, seed, slams: [{ t0: .55 }, { t0: 1.7 }] });
        api.strike(gx, gy, 110, D * 1.2, null, 'earth'); api.shake(9);
        fx.upd = (fx, dt, api) => {
          for (const sl of fx.slams) {
            if (!sl.set && fx.age >= sl.t0) {
              const p = api.player; sl.set = true;
              let px = p ? p.x : gx + 100, py = p ? p.y : gy;
              const d = Math.hypot(px - gx, py - gy);
              if (d > 520) { px = gx + (px - gx) * 520 / d; py = gy + (py - gy) * 520 / d; }
              sl.x = px; sl.y = py;
            }
            if (sl.set && !sl.done && fx.age >= sl.t0 + .8) { sl.done = true; api.strike(sl.x, sl.y, 170, D * 2.3, '#c8b090', 'earth'); api.shake(12); }
          }
        };
        st.hold = .3;
        break;
      }
      case 'cube': {
        const x = s.x, y = s.y, R = s.r;
        addFx(st, { kind: 'bigCube', x, y, R, dur: 2.4, seed });
        later(st, .25, api => {
          api.strike(x, y, R, D * 4.0, '#ffffff', 'crater');
          for (let i = 0; i < 6; i++) api.world(x + Math.cos(i * TAU / 6) * 220, y + Math.sin(i * TAU / 6) * 220, 150, D * 2.5, 'crater');
          api.shake(20);
        });
        st.hold = .6;
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
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    for (let i = st.shots.length - 1; i >= 0; i--) {
      const s = st.shots[i];
      if (s.b.life <= 0 || (s.b.x === s.px && s.b.y === s.py)) { st.shots.splice(i, 1); continue; }
      s.px = s.b.x; s.py = s.b.y;
    }
    if (z.health <= 0) { z.kageWindup = 0; z.kageDash = 0; st.dash = st.jump = null; st.ev.length = 0; z.manualBusy = false; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.armor = Math.max(0, st.armor - dt);
    st.hold = Math.max(0, st.hold - dt);
    z.armorScale = (m.armor || 1) * (st.armor > 0 ? .6 : 1);
    z.speedScale = st.armor > 0 ? 1.7 : 1;
    z.kageDash = 0;

    // A's charges: he blurs across the ground and slams into whoever is in the way.
    if (st.dash) {
      const ds = st.dash, step = Math.min(ds.left, dt) * ds.speed;
      ds.left -= dt;
      api.move(Math.cos(ds.a) * step, Math.sin(ds.a) * step);
      ds.fx.x1 = z.x; ds.fx.y1 = z.y;
      if ((ds.hit -= dt) <= 0) { ds.hit = .06; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      if (ds.left <= 0) {
        api.strike(z.x, z.y, ds.endR, ds.endDmg, '#ffe45a', 'lightning');
        api.shake(13);
        addFx(st, { kind: 'thunder', x: z.x, y: z.y, r: ds.endR, dur: .9, seed: Math.random() * 99 });
        st.dash = null;
      }
    }
    // Liger Bomb: he leaps onto the marked spot and drives the target into the ground.
    if (st.jump) {
      const j = st.jump, k0 = j.t / j.dur;
      j.t += dt;
      const k = Math.min(1, j.t / j.dur), e0 = easeOut(k0), e1 = easeOut(k);
      api.move((j.x1 - j.x0) * (e1 - e0), (j.y1 - j.y0) * (e1 - e0));
      z.kageDash = .05;
      if (k >= 1) {
        api.strike(j.x1, j.y1, j.r, j.dmg, '#ffe45a', 'lightning');
        api.world(j.x1, j.y1, j.r * 1.1, j.dmg, 'crater');
        api.knockback(z, j.r + 40, 150, 0);
        api.shake(17);
        addFx(st, { kind: 'liger', x: j.x1, y: j.y1, r: j.r, dur: 1.5, seed: Math.random() * 99 });
        st.jump = null;
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
    } else if (z.manual) {
      // Manual control: only the user's key starts a jutsu (game.js expires stale requests).
      if (z.manualCast != null && !st.dash && !st.jump && st.hold <= 0) {
        const mv = MOVE_LIST[z.bossId][z.manualCast];
        z.manualCast = null;
        if (mv) announce(z, st, m, api, mv.id);
      }
    } else if (!st.dash && !st.jump) {
      st.timer -= dt;
      const p = api.player;
      if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 820) announce(z, st, m, api);
    }
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.jump;
    z.kageWindup = st.windup > 0 ? st.windup : st.hold;
  }

  // ------------------------------------------------------------------ sprites
  function rockSprite() {
    return Kit().sprite('kg:rock', 192, 192, g => {
      const c = 96, R = 88, path = () => {
        g.beginPath();
        for (let i = 0; i <= 22; i++) {
          const a = i / 22 * TAU, r = R * (.84 + hash(i % 22 + 4) * .16);
          if (i) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = '#5a4a3c'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#7d6a56'; g.beginPath(); g.arc(c + 22, c - 28, R * .95, 0, TAU); g.fill();
      g.fillStyle = '#a08a70'; g.beginPath(); g.arc(c + 40, c - 50, R * .55, 0, TAU); g.fill();
      g.fillStyle = '#3a2f27'; g.beginPath(); g.arc(c - 44, c + 46, R * .78, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,22,16,.7)'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        let x = c - 50 + hash(i * 9.1) * 100, y = c - 50 + hash(i * 4.4) * 100;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { x += (hash(i * 7 + k) - .5) * 40; y += 8 + hash(i * 3 + k * 5) * 18; g.lineTo(x, y); }
        g.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const x = c + (hash(i * 3.1 + 1) - .5) * R * 1.3, y = c + (hash(i * 5.7 + 2) - .5) * R * 1.3, r = 6 + hash(i * 1.9) * 10;
        g.strokeStyle = 'rgba(190,170,140,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 3.6, 5.6); g.stroke();
      }
      g.restore();
      path(); g.strokeStyle = '#1e1712'; g.lineWidth = 4; g.stroke();
    });
  }
  function shurikenSprite() {
    return Kit().sprite('kg:sandshuriken', 48, 48, g => {
      g.translate(24, 24);
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 21; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath();
      g.fillStyle = '#c99c58'; g.fill(); g.lineWidth = 2.2; g.strokeStyle = '#5e4320'; g.stroke();
      g.fillStyle = '#f1dba4'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-19, -2); g.lineTo(-5, -5); g.lineTo(-2, -19); g.closePath(); g.fill();
      g.fillStyle = '#5e4320'; g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill();
    });
  }
  // Discs are baked once and stretched: a lava sea, a lava splat, a sand plain.
  function lavaDisc() {
    return Kit().sprite('kg:lavadisc', 256, 256, g => {
      const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
      gr.addColorStop(0, '#ffd77a'); gr.addColorStop(.3, '#ff8a22'); gr.addColorStop(.62, '#e2400e'); gr.addColorStop(.86, '#8e1a06'); gr.addColorStop(.96, 'rgba(60,10,4,.85)'); gr.addColorStop(1, 'rgba(40,6,2,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(128, 128, 118, 0, TAU); g.clip();
      for (let i = 0; i < 34; i++) {
        const a = hash(i * 2.3) * TAU, d = 18 + hash(i * 4.1) * 100, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, r = 6 + hash(i * 1.3) * 15;
        g.fillStyle = `rgba(${40 + (hash(i) * 30 | 0)},12,6,${.55 + d / 300})`;
        g.beginPath();
        for (let k = 0; k < 6; k++) { const b = k / 6 * TAU + hash(i + k) * .5, rr = r * (.7 + hash(i * 3 + k) * .5); g.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr * .8); }
        g.closePath(); g.fill();
      }
      g.strokeStyle = 'rgba(255,230,140,.75)'; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        let a = hash(i * 7.7) * TAU, d = 10 + hash(i * 3.9) * 30;
        g.beginPath(); g.moveTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d);
        for (let k = 0; k < 4; k++) { d += 14 + hash(i * 5 + k) * 18; a += (hash(i * 11 + k) - .5) * .6; g.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); }
        g.stroke();
      }
      g.restore();
    });
  }
  // The lava sea: darker, many small crust plates and thin glowing seams (it is stretched very wide).
  function seaDisc() {
    return Kit().sprite('kg:seadisc', 512, 512, g => {
      const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256);
      gr.addColorStop(0, '#ff9a30'); gr.addColorStop(.45, '#ea5612'); gr.addColorStop(.78, '#a8240a'); gr.addColorStop(.93, 'rgba(70,14,4,.9)'); gr.addColorStop(1, 'rgba(50,8,2,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 256, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(256, 256, 238, 0, TAU); g.clip();
      for (let i = 0; i < 110; i++) {
        const a = hash(i * 2.3 + 1) * TAU, d = Math.sqrt(hash(i * 4.1 + 2)) * 236, x = 256 + Math.cos(a) * d, y = 256 + Math.sin(a) * d, r = 7 + hash(i * 1.3) * 14;
        g.fillStyle = `rgba(${36 + (hash(i) * 30 | 0)},10,4,${.5 + d / 700})`;
        g.beginPath();
        for (let k = 0; k < 6; k++) { const b = k / 6 * TAU + hash(i + k) * .5, rr = r * (.7 + hash(i * 3 + k) * .5); g.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr * .85); }
        g.closePath(); g.fill();
      }
      g.strokeStyle = 'rgba(255,214,120,.7)'; g.lineWidth = 1.4; g.lineCap = 'round';
      for (let i = 0; i < 40; i++) {
        let a = hash(i * 7.7) * TAU, d = 10 + hash(i * 3.9) * 180;
        g.beginPath(); g.moveTo(256 + Math.cos(a) * d, 256 + Math.sin(a) * d);
        for (let k = 0; k < 3; k++) { d += 8 + hash(i * 5 + k) * 14; a += (hash(i * 11 + k) - .5) * .5; g.lineTo(256 + Math.cos(a) * d, 256 + Math.sin(a) * d); }
        g.stroke();
      }
      g.restore();
    });
  }
  function sandDisc() {
    return Kit().sprite('kg:sanddisc', 256, 256, g => {
      const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
      gr.addColorStop(0, 'rgba(236,206,146,.95)'); gr.addColorStop(.7, 'rgba(214,176,108,.9)'); gr.addColorStop(.9, 'rgba(184,144,82,.6)'); gr.addColorStop(1, 'rgba(170,130,70,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, TAU); g.fill();
      g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const r = 14 + i * 12.5;
        g.strokeStyle = 'rgba(140,100,50,.4)'; g.lineWidth = 2.4;
        for (let k = 0; k < 5; k++) { const a0 = hash(i * 9 + k) * TAU; g.beginPath(); g.arc(128, 128, r, a0, a0 + .5 + hash(i + k * 3) * .8); g.stroke(); }
        g.strokeStyle = 'rgba(255,240,200,.45)'; g.lineWidth = 1.3;
        for (let k = 0; k < 4; k++) { const a0 = hash(i * 5 + k + 40) * TAU; g.beginPath(); g.arc(128, 128, r - 3, a0, a0 + .4 + hash(i + k * 7) * .6); g.stroke(); }
      }
    });
  }
  function acidPuff() {
    return Kit().sprite('kg:acid', 96, 96, g => {
      const gr = g.createRadialGradient(40, 38, 0, 48, 48, 48);
      gr.addColorStop(0, 'rgba(246,252,214,.95)'); gr.addColorStop(.4, 'rgba(214,236,150,.8)'); gr.addColorStop(.75, 'rgba(164,200,96,.38)'); gr.addColorStop(1, 'rgba(140,180,70,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  // A stone giant: wide shoulders, rubble arms, glowing eye slits.
  const GW = 180, GH = 230;
  function golemSprite() {
    return Kit().sprite('kg:golem', GW, GH, g => {
      const blobAt = (x, y, rx, ry, c1, c2) => {
        g.fillStyle = '#231a14'; g.beginPath(); g.ellipse(x, y, rx + 3, ry + 3, 0, 0, TAU); g.fill();
        g.fillStyle = c1; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = c2; g.beginPath(); g.ellipse(x - rx * .25, y - ry * .3, rx * .6, ry * .5, 0, 0, TAU); g.fill();
      };
      blobAt(62, 200, 20, 28, '#6b5a4a', '#8a7562'); blobAt(118, 200, 20, 28, '#6b5a4a', '#8a7562');
      blobAt(90, 140, 52, 48, '#7a6654', '#9c8670');
      blobAt(28, 112, 22, 26, '#6b5a4a', '#8a7562'); blobAt(152, 112, 22, 26, '#6b5a4a', '#8a7562');
      blobAt(22, 160, 18, 26, '#62523f', '#806b56'); blobAt(158, 160, 18, 26, '#62523f', '#806b56');
      blobAt(20, 196, 20, 18, '#5a4a3a', '#7d6852'); blobAt(160, 196, 20, 18, '#5a4a3a', '#7d6852');
      blobAt(90, 74, 30, 26, '#7a6654', '#a08a72');
      g.strokeStyle = 'rgba(30,22,16,.7)'; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(70, 120); g.lineTo(84, 140); g.lineTo(78, 162); g.moveTo(112, 118); g.lineTo(102, 146); g.lineTo(114, 170); g.stroke();
      g.fillStyle = '#ffcf6a'; g.fillRect(74, 70, 12, 4); g.fillRect(95, 70, 12, 4);
    });
  }

  // ------------------------------------------------------------------ draw helpers
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath();
    ctx.arc(x, y, r1, a0, a1);
    if (r0 > 0) ctx.arc(x, y, r0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  // A filling danger mark: dark tint, coloured core that grows with k, pulsing rim.
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
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`;
    if (s.k === 'line') {
      ctx.fillStyle = 'rgba(24,12,8,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
      ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      // chevrons pointing down the lane
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = `rgba(24,12,8,${s.faint ? .07 : .15})`; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${(s.faint ? .08 : .14) + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
    }
    ctx.restore();
  }
  function drawCube(ctx, x, y, s, rot, alpha, face, edge, hgt) {
    const P = [], h = hgt == null ? s * 1.5 : hgt;
    for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2 + Math.PI / 4; P.push(x + Math.cos(a) * s * 1.414, y + Math.sin(a) * s * .707); }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = edge; ctx.globalAlpha = alpha * .45; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; ctx.moveTo(P[i * 2], P[i * 2 + 1]); ctx.lineTo(P[j * 2], P[j * 2 + 1]); ctx.moveTo(P[i * 2], P[i * 2 + 1]); ctx.lineTo(P[i * 2], P[i * 2 + 1] - h); }
    ctx.stroke();
    ctx.globalAlpha = alpha; ctx.fillStyle = face;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, mid = rot + i * Math.PI / 2 + Math.PI / 2;
      if (Math.sin(mid) <= 0) continue;
      ctx.beginPath(); ctx.moveTo(P[i * 2], P[i * 2 + 1]); ctx.lineTo(P[j * 2], P[j * 2 + 1]); ctx.lineTo(P[j * 2], P[j * 2 + 1] - h); ctx.lineTo(P[i * 2], P[i * 2 + 1] - h); ctx.closePath();
      ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.beginPath(); for (let i = 0; i < 4; i++) ctx.lineTo(P[i * 2], P[i * 2 + 1] - h); ctx.closePath();
    ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function sandTongue(ctx, m, x, y, h, shear, v, alpha) {
    if (h < 4 || alpha < .02) return;
    ctx.globalAlpha = alpha;
    Kit().flameAt(ctx, m, Kit().flame(v, SAND, 's'), x, y, h * .5, h, shear);
  }
  function rockAt(ctx, x, y, R, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(rockSprite(), -R, -R, R * 2, R * 2);
    ctx.restore();
  }
  // Crater with a raised rim and a few cracks (ground).
  function craterG(ctx, x, y, r, alpha, seed) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6e5a46'; ctx.beginPath(); ctx.ellipse(x, y, r * .86, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c231c'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .68, r * .34, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1f18'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = hash(i * 4.7 + seed) * TAU;
      ctx.moveTo(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .35);
      const b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.lineTo(x + Math.cos(b) * r * 1.05, y + Math.sin(b) * r * .55);
      ctx.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * .66);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Rolling dust ring and debris after a heavy impact (overlay).
  function dustBurst(ctx, x, y, r, t, seed, kind = 'dust', n = 12) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.3), a0 = 1 - win(t, .7, 2.2);
    if (a0 <= 0) return;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i + seed) * .4, d = r * (.35 + e * (.6 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - 10 - hash(i * 4.4) * r * .12, r * (.11 + e * (.08 + hash(i * 6.1) * .08)), a0 * .8, .75);
    }
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.2, t / 1.1, seed, '#3a2c22', 14);
  }

  // ------------------------------------------------------------------ Gaara
  function coffinG(ctx, fx) {
    const t = fx.age, fade = 1 - win(t, 1.4, fx.dur), k = easeOut(t / .3);
    ctx.globalAlpha = .85 * fade * k;
    const r = fx.r * (.7 + .4 * k);
    ctx.drawImage(sandDisc(), fx.x - r, fx.y - r * .55, r * 2, r * 1.1);
    ctx.globalAlpha = 1;
    if (t > .55) craterG(ctx, fx.x, fx.y, fx.r * .6, .7 * fade, fx.seed);
  }
  function coffinO(ctx, fx, time) {
    const K = Kit(), t = fx.age, crush = .55, m = ctx.getTransform();
    if (t < crush) {
      const k = t / crush, R = fx.r * (1 - .8 * easeIn(k)), h = 50 + 120 * easeOut(k), n = 12;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + fx.seed + t * .8, sn = Math.sin(a);
          if ((pass === 0) !== (sn < 0)) continue;
          const px = fx.x + Math.cos(a) * R, py = fx.y + sn * R * .55;
          sandTongue(ctx, m, px, py, h * (.8 + hash(i + fx.seed) * .4), -Math.cos(a) * .55 * k, i, .95);
        }
      }
      ctx.setTransform(m);
      const dust = K.puff('dust');
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + fx.seed; K.stamp(ctx, dust, fx.x + Math.cos(a) * R, fx.y + Math.sin(a) * R * .55 - 6, 18 + 10 * k, .7, .7); }
    } else {
      const u = t - crush;
      // the cocoon slams shut, then bursts
      if (u < .35) {
        const e = 1 - u / .35;
        for (let i = 0; i < 7; i++) {
          const ox = (i - 3) * fx.r * .09;
          sandTongue(ctx, m, fx.x + ox, fx.y + 4, (190 - Math.abs(i - 3) * 22) * (.6 + .4 * e), (i - 3) * -.12, i, .95 * Math.min(1, e * 2));
        }
        ctx.setTransform(m);
      }
      ctx.globalCompositeOperation = 'lighter';
      if (u < .25) K.glow(ctx, fx.x, fx.y - 50, fx.r * 1.2, '255,220,150', (1 - u / .25) * .7, true);
      ctx.globalCompositeOperation = 'source-over';
      if (u < .9) K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.6, u / .9, 1 - u / .9, '230,190,120');
      dustBurst(ctx, fx.x, fx.y, fx.r * 1.1, u, fx.seed, 'dust', 14);
    }
    ctx.globalAlpha = 1;
  }
  function waveFront(fx) { return Math.min(fx.len, fx.age * fx.speed); }
  function waveG(ctx, fx, time) {
    const f = waveFront(fx), fade = 1 - win(fx.age, fx.dur - 1.0, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(206,166,98,${.42 * fade})`; ctx.fillRect(0, -fx.w, f, fx.w * 2);
    ctx.fillStyle = `rgba(236,206,146,${.35 * fade})`; ctx.fillRect(0, -fx.w * .7, f, fx.w * 1.4);
    ctx.strokeStyle = `rgba(130,92,44,${.45 * fade})`; ctx.lineWidth = 3; ctx.beginPath();
    for (let d = 40; d < f; d += 46) { const o = Math.sin(d * .05 + fx.seed) * 10; ctx.moveTo(d + o, -fx.w * .9); ctx.quadraticCurveTo(d + o + 14, 0, d + o, fx.w * .9); }
    ctx.stroke();
    ctx.restore();
  }
  // A wall of sand standing on a ground line: pts = [gx, gy, height] * n.
  const CUR = new Float32Array(160);
  function wallPath(ctx, pts, n, k) { for (let i = 0; i < n; i++) ctx.lineTo(pts[i * 3], pts[i * 3 + 1] - pts[i * 3 + 2] * k); }
  function sandWall(ctx, pts, n, alpha) {
    ctx.globalAlpha = alpha; ctx.lineJoin = 'round';
    ctx.beginPath(); wallPath(ctx, pts, n, 1);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(pts[i * 3], pts[i * 3 + 1]);
    ctx.closePath(); ctx.fillStyle = '#a8803f'; ctx.fill();
    ctx.beginPath(); wallPath(ctx, pts, n, 1);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(pts[i * 3], pts[i * 3 + 1] - pts[i * 3 + 2] * .55);
    ctx.closePath(); ctx.fillStyle = '#d2ad6c'; ctx.fill();
    ctx.strokeStyle = '#f6e6bc'; ctx.lineWidth = 4; ctx.beginPath(); wallPath(ctx, pts, n, 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,76,34,.6)'; ctx.lineWidth = 2; ctx.beginPath(); wallPath(ctx, pts, n, .3); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function waveO(ctx, fx, time) {
    const K = Kit(), f = waveFront(fx), travel = fx.len / fx.speed, m = ctx.getTransform();
    const collapse = win(fx.age, travel, travel + .5), grow = Math.min(1, fx.age * 4) * (1 - collapse);
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), shear = ca * .55, n = 15;
    const H = u => (110 + 40 * Math.sin(u * 5 + time * 4 + fx.seed)) * grow * (1 - Math.abs(u) * .35);
    if (grow > .02) {
      // sloped body of the wave rising from the sand behind it up to the crest
      ctx.fillStyle = 'rgba(196,158,94,.85)';
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const u = i / (n - 1) * 2 - 1, d = Math.max(0, f - 170); ctx.lineTo(fx.x + ca * d - sa * u * fx.w, fx.y + sa * d + ca * u * fx.w); }
      for (let i = n - 1; i >= 0; i--) { const u = i / (n - 1) * 2 - 1; ctx.lineTo(fx.x + ca * f - sa * u * fx.w, fx.y + sa * f + ca * u * fx.w - H(u)); }
      ctx.closePath(); ctx.fill();
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) * 2 - 1;
        CUR[i * 3] = fx.x + ca * f - sa * u * fx.w; CUR[i * 3 + 1] = fx.y + sa * f + ca * u * fx.w; CUR[i * 3 + 2] = H(u);
      }
      sandWall(ctx, CUR, n, .95);
      for (let i = 0; i < 12; i++) {
        const u = (i + .5) / 12 * 2 - 1, px = fx.x + ca * f - sa * u * fx.w, py = fx.y + sa * f + ca * u * fx.w;
        sandTongue(ctx, m, px + ca * 8, py - H(u) + 30, (60 + hash(i * 7.1) * 50) * grow, shear, i, .95);
      }
      ctx.setTransform(m);
    }
    const dust = K.puff('dust');
    for (let i = 0; i < 9; i++) {
      const u = i / 8 * 2 - 1, d = f - 10, px = fx.x + ca * d - sa * u * fx.w, py = fx.y + sa * d + ca * u * fx.w;
      const a = (1 - win(fx.age, travel + .2, travel + 1.4)) * .8;
      K.stamp(ctx, dust, px + ca * 30, py - 6 - collapse * 30, 26 + collapse * 34 + hash(i) * 12, a, .7);
      if (grow > .1) K.stamp(ctx, dust, px + ca * 10, py - H(u) - 20 - hash(i * 2) * 30, 18 + hash(i * 5) * 12, .7 * grow, .8);
    }
  }
  function sandrainG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.fillStyle = `rgba(60,40,20,${.14 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, TAU); ctx.fill();
    for (const d of fx.drops) {
      const t = fx.age - d.t0;
      if (t < 0) continue;
      if (t < d.fl) markCircle(ctx, d.x, d.y, d.r, '224,180,106', t / d.fl, time, false);
      else if (t < d.fl + 1.6) {
        const u = t - d.fl, a = 1 - win(u, .8, 1.6);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#b58e54'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * .75, d.r * .38, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e2c487'; ctx.beginPath(); ctx.ellipse(d.x - 5, d.y - 4, d.r * .45, d.r * .2, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  function sandrainO(ctx, fx, time) {
    const K = Kit(), dust = K.puff('dust'), smoke = K.puff('smoke');
    const show = Math.min(1, fx.age * 3) * (1 - win(fx.age, fx.dur - 1.6, fx.dur - .6)), cy = fx.y - 300;
    if (show > .02) {
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU + fx.age * .3, d = fx.r * (.25 + hash(i + fx.seed) * .5);
        K.stamp(ctx, smoke, fx.x + Math.cos(a) * d, cy + Math.sin(a) * d * .25 + 12, fx.r * .26, .35 * show, .55);
      }
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * TAU - fx.age * .4, d = fx.r * (.15 + hash(i * 3 + fx.seed) * .6);
        K.stamp(ctx, dust, fx.x + Math.cos(a) * d, cy + Math.sin(a) * d * .25, fx.r * (.2 + hash(i * 2.2) * .1), .85 * show, .6);
      }
    }
    ctx.lineCap = 'round';
    for (const d of fx.drops) {
      const t = fx.age - d.t0;
      if (t < 0) continue;
      if (t < d.fl) {
        const k = easeIn(t / d.fl), yy = lerp(cy + 20, d.y - 10, k), xx = lerp(d.x - 40, d.x, k);
        ctx.strokeStyle = 'rgba(214,176,108,.7)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(xx - 12, yy - 60); ctx.lineTo(xx, yy); ctx.stroke();
        K.stamp(ctx, dust, xx, yy, 15, 1);
      } else if (t < d.fl + .6) {
        const u = (t - d.fl) / .6;
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + d.seed; K.stamp(ctx, dust, d.x + Math.cos(a) * d.r * u, d.y + Math.sin(a) * d.r * .5 * u - 10 - 20 * bell(u), 14 + 16 * u, 1 - u, .75); }
      }
    }
  }
  function funeralRho(fx) { return fx.R * (1 - .85 * easeIn(fx.age / fx.close)); }
  function funeralG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - 1.2, fx.dur), R = fx.R;
    ctx.globalAlpha = .9 * fade;
    ctx.drawImage(sandDisc(), fx.x - R, fx.y - R, R * 2, R * 2);
    ctx.globalAlpha = 1;
    if (fx.age < fx.close + .1) {
      const rho = funeralRho(fx);
      ctx.strokeStyle = 'rgba(90,60,26,.55)'; ctx.lineWidth = 46;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, rho, 0, TAU); ctx.stroke();
    } else {
      craterG(ctx, fx.x, fx.y, 230, .8 * fade, fx.seed);
    }
  }
  function funeralO(ctx, fx, time) {
    const K = Kit(), m = ctx.getTransform(), dust = K.puff('dust');
    if (fx.age < fx.close) {
      const rho = funeralRho(fx), k = fx.age / fx.close, n = 28, h = 130 + 50 * k, N = 25;
      const H = a => h * (.8 + .2 * Math.sin(a * 6 + time * 5 + fx.seed));
      for (let pass = 0; pass < 2; pass++) {
        // half of the encircling wall (back half first), then that half's crest of sand fangs
        for (let i = 0; i < N; i++) {
          const a = (pass === 0 ? Math.PI : 0) + i / (N - 1) * Math.PI;
          CUR[i * 3] = fx.x + Math.cos(a) * rho; CUR[i * 3 + 1] = fx.y + Math.sin(a) * rho; CUR[i * 3 + 2] = H(a);
        }
        sandWall(ctx, CUR, N, .93);
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + fx.seed, sn = Math.sin(a);
          if ((pass === 0) !== (sn < 0)) continue;
          sandTongue(ctx, m, fx.x + Math.cos(a) * rho, fx.y + sn * rho - H(a) + 34, (70 + hash(i + fx.seed) * 60) * (.92 + .08 * Math.sin(time * 8 + i)), -Math.cos(a) * .7, i, .95);
        }
        ctx.setTransform(m);
      }
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU + fx.seed + .1;
        K.stamp(ctx, dust, fx.x + Math.cos(a) * rho, fx.y + Math.sin(a) * rho - H(a) - 20, 22 + hash(i) * 14, .7, .8);
      }
    } else {
      const u = fx.age - fx.close;
      if (u < .7) {
        const e = 1 - win(u, .25, .7);
        for (let i = 0; i < 9; i++) {
          const ox = (i - 4) * 26;
          sandTongue(ctx, m, fx.x + ox, fx.y + 6 + Math.abs(i - 4) * 4, (340 - Math.abs(i - 4) * 34) * easeOut(u / .15) * e, (i - 4) * -.08, i, .97);
        }
        ctx.setTransform(m);
      }
      ctx.globalCompositeOperation = 'lighter';
      if (u < .3) K.glow(ctx, fx.x, fx.y - 80, 420, '255,220,160', (1 - u / .3) * .8, true);
      ctx.globalCompositeOperation = 'source-over';
      if (u < 1.0) { K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.1, u, 1 - u, '230,190,120'); if (u > .12) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.4, u - .12, (1 - u) * .7, '255,240,210'); }
      dustBurst(ctx, fx.x, fx.y, 330, u, fx.seed, 'dust', 18);
    }
  }

  // ------------------------------------------------------------------ Mei
  function riverPts(fx, f, out) {
    let n = 0;
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    for (let d = 0; d <= f + 1; d += 40) {
      const dd = Math.min(d, f), o = Math.sin(dd * .018 + fx.seed) * fx.w * .3 * Math.min(1, dd / 120);
      out[n++] = fx.x + ca * dd - sa * o; out[n++] = fx.y + sa * dd + ca * o;
      if (dd === f) break;
    }
    return n / 2;
  }
  const RIVER = new Float32Array(64);
  function strokeRiver(ctx, n) { ctx.beginPath(); ctx.moveTo(RIVER[0], RIVER[1]); for (let i = 1; i < n; i++) ctx.lineTo(RIVER[i * 2], RIVER[i * 2 + 1]); ctx.stroke(); }
  function lavaRiverG(ctx, fx, time) {
    const K = Kit(), f = Math.min(fx.len, fx.age * fx.speed), fade = 1 - win(fx.age, fx.dur - .9, fx.dur), cool = win(fx.age, fx.dur - 2.2, fx.dur - .4);
    if (f < 10) return;
    const n = riverPts(fx, f, RIVER), w = fx.w * 2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#2a0a04'; ctx.lineWidth = w * 1.18; strokeRiver(ctx, n);
    ctx.strokeStyle = cool > .5 ? '#5a1a0a' : '#a8230a'; ctx.lineWidth = w * .98; strokeRiver(ctx, n);
    ctx.globalAlpha = fade * (1 - cool * .8);
    ctx.strokeStyle = '#ff5a14'; ctx.lineWidth = w * .66; strokeRiver(ctx, n);
    ctx.strokeStyle = '#ffb43c'; ctx.lineWidth = w * .3; ctx.setLineDash([46, 28]); ctx.lineDashOffset = -fx.age * 120; strokeRiver(ctx, n); ctx.setLineDash([]);
    ctx.globalAlpha = fade;
    // crust plates drifting downstream
    ctx.fillStyle = cool > .5 ? '#2a0e06' : '#3a1206';
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    for (let i = 0; i < 12; i++) {
      const d = (hash(i * 2.7 + fx.seed) * fx.len + fx.age * 70) % Math.max(1, f), o = (hash(i * 5.1) - .5) * fx.w * 1.1;
      const px = fx.x + ca * d - sa * o, py = fx.y + sa * d + ca * o, r = 9 + hash(i * 3.3) * 12 + cool * 8;
      ctx.beginPath(); ctx.ellipse(px, py, r, r * .6, fx.a + i, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let d = 60; d < f; d += 130) K.glow(ctx, fx.x + ca * d, fx.y + sa * d, fx.w * 2.2, '255,110,30', .38 * fade * (1 - cool), false, .7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  function lavaRiverO(ctx, fx, time) {
    const K = Kit();
    if (fx.age < .7) {
      // the torrent of lava spewed from Mei's mouth
      const f = Math.min(fx.len, fx.age * fx.speed), fire = K.puff('fire'), a = 1 - win(fx.age, .45, .7);
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a), reach = Math.min(f, 260);
      for (let i = 0; i < 10; i++) {
        const k = i / 9, d = reach * k, h = 58 * (1 - k) + Math.sin(Math.PI * k) * 36;
        K.stamp(ctx, fire, fx.x + ca * d, fx.y + sa * d - h, 18 + k * 22, .9 * a);
      }
    }
    if (fx.age > 1.2) {
      const smoke = K.puff('smoke'), s = win(fx.age, 1.2, fx.dur);
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
      for (let i = 0; i < 6; i++) {
        const d = fx.len * (i + .5) / 6, ph = (s * 2 + hash(i)) % 1;
        K.stamp(ctx, smoke, fx.x + ca * d + ph * 14, fx.y + sa * d - 20 - ph * 90, 18 + ph * 26, bell(ph) * .4);
      }
    }
  }
  function mistFront(fx) { return Math.min(fx.r, fx.age * fx.speed); }
  function mistG(ctx, fx, time) {
    const f = mistFront(fx), fade = 1 - win(fx.age, fx.dur - 1.0, fx.dur);
    ctx.fillStyle = `rgba(170,210,90,${.2 * fade})`; sector(ctx, fx.x, fx.y, 0, f, fx.a - fx.h, fx.a + fx.h); ctx.fill();
    ctx.fillStyle = `rgba(230,250,170,${.6 * fade})`;
    for (let i = 0; i < 14; i++) {
      const ph = (time * 1.6 + hash(i * 3.3)) % 1, d = f * (.15 + hash(i * 1.7 + fx.seed) * .8), aa = fx.a + (hash(i * 2.9) * 2 - 1) * fx.h * .85;
      const r = 3 + ph * 6;
      ctx.globalAlpha = 1 - ph;
      ctx.beginPath(); ctx.ellipse(fx.x + Math.cos(aa) * d, fx.y + Math.sin(aa) * d, r, r * .55, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function mistO(ctx, fx, time) {
    const K = Kit(), puff = acidPuff(), f = mistFront(fx), fade = 1 - win(fx.age, fx.dur - 1.2, fx.dur);
    for (const p of fx.puffs) {
      if (p.d > f) continue;
      const appear = Math.min(1, (f - p.d) / 120), drift = fx.age * 14;
      const aa = fx.a + p.u * fx.h * .88, d = p.d + drift, wob = Math.sin(time * 1.3 + p.ph) * 8;
      const x = fx.x + Math.cos(aa) * d + wob, y = fx.y + Math.sin(aa) * d - 26 - p.s * .3;
      K.stamp(ctx, puff, x, y, p.s * (.8 + .35 * Math.min(1, fx.age / 2)), .45 * appear * fade, .7);
    }
  }
  function dragonPos(fx, d, out) {
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), o = Math.sin(d * .012 - fx.age * 7) * 44 * Math.min(1, d / 160);
    out.x = fx.x + ca * d - sa * o; out.y = fx.y + sa * d + ca * o; out.h = 46 + Math.sin(d * .009 + 1) * 14;
    return out;
  }
  const DP = { x: 0, y: 0, h: 0 }, DQ = { x: 0, y: 0, h: 0 };
  function dragonG(ctx, fx, time) {
    const hd = Math.min(fx.len, fx.age * fx.speed), fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(40,120,200,${.22 * fade})`; ctx.fillRect(0, -70, hd, 140);
    ctx.restore();
    if (fx.age < fx.len / fx.speed + .1) {
      dragonPos(fx, hd, DP);
      ctx.fillStyle = 'rgba(10,30,50,.3)'; ctx.beginPath(); ctx.ellipse(DP.x, DP.y, 60, 22, 0, 0, TAU); ctx.fill();
    }
  }
  function dragonO(ctx, fx, time) {
    const K = Kit(), travel = fx.len / fx.speed, hd = Math.min(fx.len, fx.age * fx.speed);
    const water = K.puff('water');
    if (fx.age < travel + .35) {
      const vanish = win(fx.age, travel, travel + .35), body = 380, n = 20;
      // body: layered strokes along the sinuous path, then spray puffs
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const d = hd - body * (i / n) * (1 - vanish * .5);
        if (d < 0) break;
        dragonPos(fx, d, DQ); pts.push(DQ.x, DQ.y - DQ.h);
      }
      ctx.globalAlpha = 1 - vanish;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const strokeBody = (w, col, dy) => {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        for (let i = 0; i < pts.length / 2; i++) { const x = pts[i * 2], y = pts[i * 2 + 1] + dy; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      };
      if (pts.length >= 4) {
        strokeBody(46, 'rgba(18,70,140,.85)', 0);
        strokeBody(34, 'rgba(56,160,232,.92)', -2);
        strokeBody(16, 'rgba(170,230,255,.9)', -8);
        strokeBody(4, 'rgba(255,255,255,.95)', -12);
        // dorsal fins
        ctx.fillStyle = 'rgba(120,200,255,.9)';
        for (let i = 2; i < pts.length / 2 - 1; i += 3) {
          const x = pts[i * 2], y = pts[i * 2 + 1];
          ctx.beginPath(); ctx.moveTo(x - 9, y - 16); ctx.lineTo(x + 3, y - 38); ctx.lineTo(x + 10, y - 15); ctx.closePath(); ctx.fill();
        }
        for (let i = 1; i < pts.length / 2; i += 2) K.stamp(ctx, water, pts[i * 2] + Math.sin(time * 9 + i) * 6, pts[i * 2 + 1] - 4, 16 + (i % 3) * 5, .55);
      }
      // the head, facing its direction of travel
      dragonPos(fx, hd, DP); dragonPos(fx, Math.max(0, hd - 20), DQ);
      const ha = Math.atan2(DP.y - DQ.y, DP.x - DQ.x), flip = Math.cos(ha) < 0 ? -1 : 1;
      ctx.save(); ctx.translate(DP.x, DP.y - DP.h); ctx.rotate(ha); ctx.scale(1.25, 1.25 * flip);
      const jaw = .25 + .15 * Math.sin(time * 10);
      ctx.fillStyle = '#1d5fa6'; ctx.strokeStyle = '#0c2f5a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-22, -18); ctx.quadraticCurveTo(10, -24, 44, -12); ctx.lineTo(50, -4); ctx.lineTo(14, -2); ctx.lineTo(-20, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.rotate(jaw);
      ctx.beginPath(); ctx.moveTo(-16, 4); ctx.lineTo(40, 6); ctx.lineTo(34, 14); ctx.quadraticCurveTo(0, 18, -18, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(8 + i * 8, 6); ctx.lineTo(11 + i * 8, 1); ctx.lineTo(14 + i * 8, 6); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.moveTo(-20, -16); ctx.quadraticCurveTo(10, -22, 40, -11); ctx.lineTo(10, -10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#bfeaff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-6, -20); ctx.quadraticCurveTo(-26, -40, -44, -36); ctx.moveTo(2, -20); ctx.quadraticCurveTo(-14, -46, -30, -50); ctx.stroke();
      ctx.strokeStyle = '#d8f4ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(40, -2); ctx.quadraticCurveTo(56, 10, 70, 6); ctx.stroke();
      ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.ellipse(14, -13, 5, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#10243c'; ctx.beginPath(); ctx.ellipse(15, -13, 1.6, 2.6, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, DP.x, DP.y - DP.h, 90, '90,180,255', .4 * (1 - vanish));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (fx.age > travel) {
      const u = (fx.age - travel) / .9;
      if (u < 1) {
        const ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
        K.fx.shockRing(ctx, ex, ey, 220, u, 1 - u, '120,200,255');
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * TAU + fx.seed, d = 30 + 150 * easeOut(u);
          K.stamp(ctx, water, ex + Math.cos(a) * d, ey + Math.sin(a) * d * .5 - 60 * bell(u) - 10, 22 + 14 * u, (1 - u) * .9, .8);
        }
      }
    }
  }
  function globsG(ctx, fx, time) {
    const K = Kit();
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) { markCircle(ctx, it.x, it.y, 90, '255,120,40', t / it.fl, time, false); continue; }
      const u = t - it.fl, a = 1 - win(u, 1.6, 2.4);
      if (a <= 0) continue;
      const r = 70 * (.6 + .4 * easeOut(u / .2));
      ctx.globalAlpha = a;
      ctx.drawImage(lavaDisc(), it.x - r, it.y - r * .55, r * 2, r * 1.1);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, it.x, it.y, r * 1.5, '255,120,30', .4 * a * (1 - win(u, .5, 2.4)), false, .55);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function globsO(ctx, fx, time) {
    const K = Kit(), fire = K.puff('fire'), ember = K.puff('ember');
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) {
        const k = t / it.fl;
        for (let j = 3; j >= 0; j--) {
          const kk = Math.max(0, k - j * .045), x = lerp(fx.sx, it.x, kk), y = lerp(fx.sy - 60, it.y, kk) - Math.sin(Math.PI * kk) * 240;
          if (j) K.stamp(ctx, ember, x, y, 16 - j * 3, .7 - j * .15);
          else {
            ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 46, '255,120,30', .7, true); ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#7a1606'; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
            ctx.fillStyle = '#ff7a1c'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 11, 0, TAU); ctx.fill();
            ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(x - 4, y - 5, 5, 0, TAU); ctx.fill();
          }
        }
      } else if (t < it.fl + 1.1) {
        const u = t - it.fl, k = u / 1.1;
        if (u < .5) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + it.seed, d = 20 + 60 * easeOut(u / .5); K.stamp(ctx, fire, it.x + Math.cos(a) * d, it.y + Math.sin(a) * d * .5 - 30 * bell(u / .5) - 8, 18 * (1 - u), 1 - u / .5); }
        for (let i = 0; i < 3; i++) {
          const h = (44 + hash(i + it.seed) * 30) * bell(k) * (.85 + .15 * Math.sin(time * 12 + i));
          if (h > 4) ctx.drawImage(K.flame((i + Math.floor(time * 11)) % 6), it.x + (i - 1) * 22 - h * .22, it.y + (i % 2) * 6 - h * FB, h * .44, h);
        }
      }
    }
  }
  function seaRho(fx) { return Math.min(fx.R, fx.age * fx.speed + 40); }
  function seaG(ctx, fx, time) {
    const K = Kit(), rho = seaRho(fx), fade = 1 - win(fx.age, fx.dur - 1.1, fx.dur), cool = win(fx.age, fx.dur - 2.4, fx.dur - .6);
    ctx.globalAlpha = .95 * fade;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.age * .05 + fx.seed);
    ctx.drawImage(seaDisc(), -rho * 1.04, -rho * 1.04, rho * 2.08, rho * 2.08);
    ctx.restore();
    if (cool > 0) { ctx.globalAlpha = cool * .75 * fade; ctx.fillStyle = '#2a120a'; ctx.beginPath(); ctx.arc(fx.x, fx.y, rho, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    const pulse = .8 + .2 * Math.sin(time * 3);
    K.glow(ctx, fx.x, fx.y, rho * 1.1, '255,90,20', .22 * fade * pulse * (1 - cool));
    ctx.fillStyle = `rgba(255,230,150,${.7 * fade * (1 - cool)})`;
    for (let i = 0; i < 10; i++) {
      const ph = (time * .9 + hash(i * 5.3)) % 1, a = hash(i * 7.9 + Math.floor(time * .9 + hash(i * 5.3))) * TAU, d = rho * hash(i * 2.4 + Math.floor(time + hash(i))) * .9;
      ctx.globalAlpha = bell(ph); ctx.beginPath(); ctx.arc(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, 3 + ph * 9, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  function seaO(ctx, fx, time) {
    const K = Kit(), rho = seaRho(fx), travel = fx.R / fx.speed;
    const crest = 1 - win(fx.age, travel, travel + .5);
    if (crest > .02) {
      const n = 30;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + fx.seed, sn = Math.sin(a);
        const h = (80 + hash(i * 4.4 + fx.seed) * 50) * crest * (.85 + .15 * Math.sin(time * 13 + i)) * Math.min(1, fx.age * 5);
        if (h < 5) continue;
        ctx.drawImage(K.flame((i + Math.floor(time * 12)) % 6, LAVA, 'lava'), fx.x + Math.cos(a) * rho - h * .26, fx.y + sn * rho - h * FB, h * .52, h);
      }
    }
    const smoke = K.puff('smoke'), fade = 1 - win(fx.age, fx.dur - 1.2, fx.dur);
    for (let i = 0; i < 8; i++) {
      const ph = (fx.age * .5 + hash(i * 3.3)) % 1, a = hash(i * 9.1 + fx.seed) * TAU, d = rho * (.3 + hash(i * 1.9) * .6);
      K.stamp(ctx, smoke, fx.x + Math.cos(a) * d + ph * 20, fx.y + Math.sin(a) * d - 20 - ph * 110, 20 + ph * 34, bell(ph) * .4 * fade);
    }
    if (fx.age > travel * .6 && fx.age < fx.dur - 1.2) {
      for (let i = 0; i < 8; i++) {
        const a = hash(i * 6.7 + fx.seed) * TAU, d = rho * (.25 + hash(i * 2.3 + 9) * .65);
        const h = (40 + hash(i) * 40) * (.8 + .2 * Math.sin(time * 11 + i));
        ctx.drawImage(K.flame((i + Math.floor(time * 10)) % 6, LAVA, 'lava'), fx.x + Math.cos(a) * d - h * .22, fx.y + Math.sin(a) * d - h * FB, h * .44, h);
      }
    }
  }

  // ------------------------------------------------------------------ A (Raikage)
  function thunderO(ctx, fx, time) {
    const K = Kit(), u = fx.age / fx.dur;
    K.fx.lightningBlast(ctx, fx.x, fx.y, fx.r * .8, u, 1 - u, time, fx.seed);
    K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.2, u * 1.3, 1 - u, '255,230,120');
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + fx.seed, l = fx.r * (.5 + .5 * easeOut(u * 2));
      K.forkedBolt(ctx, fx.x, fx.y - 20, fx.x + Math.cos(a) * l, fx.y + Math.sin(a) * l * .5, fx.seed + i * 9, time,
        { jitter: 14, alpha: 1 - u, width: 2.2, pal: BOLT_Y, step: 18, forks: 2, forkLen: 30, rate: 24, snap: true });
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function streakG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.strokeStyle = `rgba(30,24,20,${.35 * fade})`; ctx.lineWidth = fx.w * (fx.dbl ? 1.2 : .8); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
  }
  function streakO(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .7, fx.dur), len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
    if (len < 4) return;
    const nx = -(fx.y1 - fx.y0) / len, ny = (fx.x1 - fx.x0) / len, L = LIFT();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const lanes = fx.dbl ? [-.45, .45] : [0];
    for (const o of lanes) {
      const ox = nx * fx.w * o, oy = ny * fx.w * o;
      ctx.strokeStyle = `rgba(255,220,90,${.35 * fade})`; ctx.lineWidth = fx.w * .7;
      ctx.beginPath(); ctx.moveTo(fx.x0 + ox, fx.y0 + oy - L); ctx.lineTo(fx.x1 + ox, fx.y1 + oy - L); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,230,${.7 * fade})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(fx.x0 + ox, fx.y0 + oy - L); ctx.lineTo(fx.x1 + ox, fx.y1 + oy - L); ctx.stroke();
      for (let i = 0; i < 2; i++)
        K.forkedBolt(ctx, fx.x0 + ox, fx.y0 + oy - L - 10 + i * 20, fx.x1 + ox, fx.y1 + oy - L - 10 + i * 20, fx.seed + i * 7 + o * 30, time,
          { jitter: 22, alpha: fade, width: 2.4, pal: BOLT_B, step: 26, forks: 3, forkLen: 40, rate: 20, snap: true });
    }
    for (let i = 1; i <= 4; i++) { const k = i / 5; K.glow(ctx, lerp(fx.x0, fx.x1, k), lerp(fx.y0, fx.y1, k) - L, fx.w * .9, '255,220,100', .3 * fade); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function chopG(ctx, fx) {
    const fade = 1 - win(fx.age, .3, fx.dur);
    ctx.fillStyle = `rgba(30,24,16,${.3 * fade})`; sector(ctx, fx.x, fx.y, fx.r * .2, fx.r, fx.a - fx.h, fx.a + fx.h); ctx.fill();
  }
  function chopO(ctx, fx, time) {
    const K = Kit(), p = easeOut(fx.age / .22), fade = 1 - win(fx.age, .25, fx.dur);
    const a0 = fx.a - fx.h * fx.side, cur = a0 + 2 * fx.h * fx.side * p, lo = Math.min(a0, cur), hi = Math.max(a0, cur);
    const cy = fx.y - LIFT();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,220,90,${.3 * fade})`; sector(ctx, fx.x, cy, fx.r * .3, fx.r, lo, hi); ctx.fill();
    ctx.fillStyle = `rgba(255,250,210,${.35 * fade})`; sector(ctx, fx.x, cy, fx.r * .75, fx.r, lo, hi); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${.9 * fade})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(fx.x, cy, fx.r, lo, hi); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fx.x + Math.cos(cur) * fx.r * .25, cy + Math.sin(cur) * fx.r * .25); ctx.lineTo(fx.x + Math.cos(cur) * fx.r * 1.05, cy + Math.sin(cur) * fx.r * 1.05); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const aa = lerp(lo, hi, (i + .5) / 5);
      K.forkedBolt(ctx, fx.x + Math.cos(aa) * fx.r * .35, cy + Math.sin(aa) * fx.r * .35, fx.x + Math.cos(aa) * fx.r * 1.08, cy + Math.sin(aa) * fx.r * 1.08, fx.seed + i * 5, time,
        { jitter: 16, alpha: fade, width: 2, pal: BOLT_Y, step: 20, forks: 2, forkLen: 28, rate: 24, snap: true });
    }
    K.glow(ctx, fx.x + Math.cos(cur) * fx.r * .7, cy + Math.sin(cur) * fx.r * .7, 120, '255,230,120', .5 * fade);
    ctx.globalCompositeOperation = 'source-over';
  }
  function ligerG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    craterG(ctx, fx.x, fx.y, fx.r * .8, .85 * fade, fx.seed);
  }
  function ligerO(ctx, fx, time) {
    const K = Kit(), u = fx.age;
    if (u < .9) {
      K.fx.lightningBlast(ctx, fx.x, fx.y, fx.r, u / .9, 1 - u / .9, time, fx.seed);
      K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.5, u / .9, 1 - u / .9, '255,230,120');
      if (u > .1) K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.9, (u - .1) / .8, (1 - u / .9) * .7, '200,230,255');
      ctx.globalCompositeOperation = 'lighter';
      if (u < .2) K.glow(ctx, fx.x, fx.y - 30, fx.r * 1.6, '255,250,220', 1 - u / .2, true);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + fx.seed;
        K.forkedBolt(ctx, fx.x, fx.y - 10, fx.x + Math.cos(a) * fx.r * 1.1, fx.y + Math.sin(a) * fx.r * .55, fx.seed + i * 3, time,
          { jitter: 16, alpha: 1 - u / .9, width: 2.4, pal: BOLT_Y, step: 18, forks: 2, forkLen: 30, rate: 26, snap: true });
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    dustBurst(ctx, fx.x, fx.y, fx.r, u, fx.seed, 'dust', 12);
  }
  function stormG(ctx, fx, time) {
    const fade = Math.min(1, fx.age * 4) * (1 - win(fx.age, fx.dur - .6, fx.dur));
    ctx.fillStyle = `rgba(10,12,30,${.28 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, TAU); ctx.fill();
    for (const b of fx.bolts) {
      const t = fx.age - b.t0;
      if (t < 0) continue;
      if (t < b.fl) markCircle(ctx, b.x, b.y, 105, '255,240,140', t / b.fl, time, false);
      else if (t < b.fl + 1.4) {
        const a = 1 - win(t - b.fl, .6, 1.4);
        ctx.fillStyle = `rgba(20,20,30,${.45 * a})`; ctx.beginPath(); ctx.ellipse(b.x, b.y, 60, 28, 0, 0, TAU); ctx.fill();
      }
    }
  }
  function stormO(ctx, fx, time) {
    const K = Kit(), smoke = K.puff('smoke'), cy = fx.y - 280;
    const show = Math.min(1, fx.age * 3) * (1 - win(fx.age, fx.dur - .8, fx.dur));
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU + fx.age * .25, d = fx.r * (.2 + hash(i + fx.seed) * .55);
      K.stamp(ctx, smoke, fx.x + Math.cos(a) * d, cy + Math.sin(a) * d * .22, fx.r * .3, .7 * show, .5);
    }
    ctx.globalCompositeOperation = 'lighter';
    const flick = hash(Math.floor(time * 14) + fx.seed);
    if (flick > .55) K.glow(ctx, fx.x + (flick - .75) * fx.r * 1.5, cy, fx.r * .6, '200,220,255', .4 * show);
    for (const b of fx.bolts) {
      const t = fx.age - b.t0 - b.fl;
      if (t < -.06 || t > .3) continue;
      const a = 1 - clamp01(t / .3);
      K.forkedBolt(ctx, b.x + (hash(b.seed) - .5) * 80, cy + 10, b.x, b.y - 4, b.seed, time,
        { jitter: 30, alpha: a, width: 4, pal: BOLT_Y, base: `rgba(255,190,40,${.5 * a})`, step: 30, forks: 4, forkLen: 60, rate: 24, snap: true });
      K.glow(ctx, b.x, b.y - 10, 150, '255,240,170', a * .8, true);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const b of fx.bolts) {
      const t = fx.age - b.t0 - b.fl;
      if (t > 0 && t < .6) K.fx.shockRing(ctx, b.x, b.y, 150, t / .6, 1 - t / .6, '255,230,120');
    }
  }
  function lineMarkG(ctx, fx, time, z) {
    const k = fx.age / fx.dur;
    teleShape(ctx, { k: 'line', x: z.x, y: z.y, a: fx.a, len: fx.len, w: fx.w }, '255,240,140', k, time);
  }

  // ------------------------------------------------------------------ Ōnoki
  function boulderG(ctx, fx, time) {
    const t = fx.age;
    if (t < fx.fall) {
      const k = t / fx.fall;
      ctx.fillStyle = `rgba(20,14,10,${.3 + .35 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * (.5 + .4 * k), fx.r * (.25 + .2 * k), 0, 0, TAU); ctx.fill();
      markCircle(ctx, fx.x, fx.y, fx.r, '214,186,146', 1, time, false);
    } else {
      const fade = 1 - win(t, fx.dur - .8, fx.dur);
      craterG(ctx, fx.x, fx.y, fx.r, fade, fx.seed);
    }
  }
  function boulderO(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.r * .58;
    if (t < fx.fall) {
      const k = easeIn(t / fx.fall), y = lerp(fx.y - 270, fx.y - R * .5, k);
      rockAt(ctx, fx.x, y, R, k * .4 + fx.seed);
      const dust = K.puff('dust');
      for (let i = 0; i < 4; i++) K.stamp(ctx, dust, fx.x + (i - 1.5) * R * .5, y - R * (1 + i % 2 * .3), R * .3, .45);
    } else {
      const u = t - fx.fall, sink = 1 - win(u, 1.4, 2.2);
      if (sink > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(fx.x - R * 1.3, fx.y - R * 2.4, R * 2.6, R * 2.4 + 8); ctx.clip();
        ctx.globalAlpha = sink;
        rockAt(ctx, fx.x, fx.y - R * .45 + (1 - sink) * R, R, .4 + fx.seed);
        ctx.restore();
      }
      if (u < .9) { K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.5, u / .9, 1 - u / .9, '220,200,170'); }
      dustBurst(ctx, fx.x, fx.y, fx.r * 1.1, u, fx.seed, 'dust', 14);
    }
  }
  function jinBeamG(ctx, fx) {
    const fade = 1 - win(fx.age, .6, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(40,40,46,${.4 * fade})`; ctx.fillRect(10, -fx.w * .85, fx.len, fx.w * 1.7);
    ctx.fillStyle = `rgba(210,220,230,${.25 * fade})`; ctx.fillRect(10, -fx.w * .4, fx.len, fx.w * .8);
    ctx.restore();
  }
  function jinBeamO(ctx, fx, time) {
    const K = Kit(), e = easeOut(fx.age / .12), shrink = win(fx.age, .55, fx.dur), fade = 1 - shrink;
    const w = fx.w * e * (1 - shrink * .85), L = 34;
    ctx.save(); ctx.translate(fx.x, fx.y - L); ctx.rotate(fx.a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(200,225,255,${.22 * fade})`; ctx.fillRect(0, -w * 1.15, fx.len, w * 2.3);
    ctx.fillStyle = `rgba(235,245,255,${.35 * fade})`; ctx.fillRect(0, -w * .75, fx.len, w * 1.5);
    ctx.fillStyle = `rgba(255,255,255,${.8 * fade})`; ctx.fillRect(0, -w * .3, fx.len, w * .6);
    ctx.strokeStyle = `rgba(255,255,255,${.9 * fade})`; ctx.lineWidth = 2.5; ctx.strokeRect(0, -w * .8, fx.len, w * 1.6);
    // nested cubes streaming down the beam
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const d = (i * 130 + fx.age * 600) % fx.len, s = w * .7;
      ctx.save(); ctx.translate(d, 0); ctx.rotate(time * 2 + i);
      ctx.strokeStyle = `rgba(255,255,255,${.7 * fade})`; ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = `rgba(190,220,255,${.6 * fade})`; ctx.strokeRect(-s / 4, -s / 4, s / 2, s / 2);
      ctx.restore();
    }
    ctx.restore();
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const d = fx.len * (i + .5) / 6; K.glow(ctx, fx.x + ca * d, fx.y + sa * d - L, w * 2.2, '200,225,255', .4 * fade); }
    if (fx.age < .15) K.glow(ctx, fx.x, fx.y - L, 260, '255,255,255', 1 - fx.age / .15, true);
    ctx.globalCompositeOperation = 'source-over';
    drawCube(ctx, fx.x + ca * 30, fx.y + sa * 30 - 10, 22 * (1 - shrink), time * 2, .8 * fade, 'rgba(240,248,255,.5)', '#ffffff', 40 * (1 - shrink));
  }
  function hurlK(fx) { return Math.min(1, fx.age * fx.speed / fx.len); }
  function hurlG(ctx, fx, time) {
    const k = hurlK(fx), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    if (k < 1) {
      const px = fx.x + ca * fx.len * k, py = fx.y + sa * fx.len * k;
      ctx.fillStyle = 'rgba(20,14,10,.35)'; ctx.beginPath(); ctx.ellipse(px, py, 90, 36, 0, 0, TAU); ctx.fill();
      markCircle(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, fx.r, '214,186,146', k, time, false);
    } else {
      const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
      craterG(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, fx.r, fade, fx.seed);
    }
  }
  function hurlO(ctx, fx, time) {
    const K = Kit(), k = hurlK(fx), ca = Math.cos(fx.a), sa = Math.sin(fx.a), R = 105, dust = K.puff('dust');
    if (k < 1) {
      const px = fx.x + ca * fx.len * k, py = fx.y + sa * fx.len * k, h = 200 * (1 - k) + Math.sin(Math.PI * k) * 90;
      for (let i = 1; i <= 5; i++) {
        const kk = Math.max(0, k - i * .05), hx = fx.x + ca * fx.len * kk, hy = fx.y + sa * fx.len * kk, hh = 200 * (1 - kk) + Math.sin(Math.PI * kk) * 90;
        K.stamp(ctx, dust, hx, hy - hh - R * .4, R * (.35 + i * .08), .5 - i * .07);
      }
      rockAt(ctx, px, py - h - R * .6, R, fx.age * 5 * (ca >= 0 ? 1 : -1) + fx.seed);
    } else {
      const u = fx.age - fx.len / fx.speed, ex = fx.x + ca * fx.len, ey = fx.y + sa * fx.len, R2 = fx.r * .55, sink = 1 - win(u, 1.2, 2.0);
      if (sink > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(ex - R2 * 1.3, ey - R2 * 2.4, R2 * 2.6, R2 * 2.4 + 8); ctx.clip();
        ctx.globalAlpha = sink; rockAt(ctx, ex, ey - R2 * .45 + (1 - sink) * R2, R2, fx.seed + 2); ctx.restore();
      }
      if (u < .9) K.fx.shockRing(ctx, ex, ey, fx.r * 1.5, u / .9, 1 - u / .9, '220,200,170');
      dustBurst(ctx, ex, ey, fx.r * 1.1, u, fx.seed, 'dust', 14);
    }
  }
  function golemG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.fillStyle = `rgba(30,22,16,${.35 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 4, 90, 30, 0, 0, TAU); ctx.fill();
    for (const sl of fx.slams) {
      if (!sl.set) continue;
      const t = fx.age - sl.t0;
      if (t < .8) markCircle(ctx, sl.x, sl.y, 170, '214,186,146', t / .8, time, false);
      else craterG(ctx, sl.x, sl.y, 150, (1 - win(t, 1.6, 2.4)) * fade, sl.t0 * 7 + fx.seed);
    }
  }
  function golemO(ctx, fx, time) {
    const K = Kit(), rise = easeOut(fx.age / .45), crumble = win(fx.age, fx.dur - .6, fx.dur);
    let lean = 0, armUp = null;
    for (const sl of fx.slams) {
      if (!sl.set) continue;
      const t = fx.age - sl.t0;
      if (t >= 0 && t < .8) { lean = (sl.x > fx.x ? 1 : -1) * easeOut(t / .8) * 10; armUp = { sl, k: t / .8 }; }
    }
    const S = 1.25, W = GW * S, H = GH * S;
    ctx.save();
    ctx.beginPath(); ctx.rect(fx.x - W, fx.y - H * 1.2, W * 2, H * 1.2 + 8); ctx.clip();
    ctx.globalAlpha = 1 - crumble;
    ctx.translate(fx.x, fx.y + H * (1 - rise) + crumble * 40); ctx.rotate(lean * .01);
    ctx.drawImage(golemSprite(), -W / 2, -H, W, H);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y - H * .68 * rise, 30, '255,200,90', .6 * (1 - crumble));
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age < .7) dustBurst(ctx, fx.x, fx.y, 130, fx.age, fx.seed, 'dust', 10);
    if (crumble > 0) dustBurst(ctx, fx.x, fx.y - 40, 140, crumble * 1.2, fx.seed + 3, 'dust', 10);
    // the stone fist hammering down on the marked spot
    if (armUp) {
      const { sl, k } = armUp, sx = fx.x + (sl.x > fx.x ? 1 : -1) * 70, sy = fx.y - H * .55;
      const up = k < .6 ? easeOut(k / .6) : 1, down = k < .6 ? 0 : easeIn((k - .6) / .4);
      const ax = lerp(sx, sl.x, down), ay = lerp(sy - 120 * up, sl.y - 40, down) - Math.sin(Math.PI * down) * 60;
      ctx.strokeStyle = '#4d3e31'; ctx.lineWidth = 34; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.strokeStyle = '#7d6a56'; ctx.lineWidth = 24; ctx.stroke();
      rockAt(ctx, ax, ay, 50, k * 3);
    }
    for (const sl of fx.slams) {
      if (!sl.set) continue;
      const u = fx.age - sl.t0 - .8;
      if (u > 0 && u < 1.5) {
        if (u < .8) K.fx.shockRing(ctx, sl.x, sl.y, 240, u / .8, 1 - u / .8, '220,200,170');
        dustBurst(ctx, sl.x, sl.y, 170, u, sl.t0 + fx.seed, 'dust', 10);
      }
    }
  }
  function bigCubeScale(fx) {
    const t = fx.age;
    return t < .25 ? easeOut(t / .25) : t < .75 ? 1 : 1 - easeIn((t - .75) / .3);
  }
  function bigCubeG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - 1.0, fx.dur);
    if (fx.age > .25) {
      ctx.fillStyle = `rgba(52,50,54,${.5 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * .95, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(120,118,122,${.35 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * .7, 0, TAU); ctx.fill();
    }
    const s = bigCubeScale(fx);
    if (s > .01) { ctx.fillStyle = `rgba(255,255,255,${.25 * s})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * s, 0, TAU); ctx.fill(); }
  }
  function bigCubeO(ctx, fx, time) {
    const K = Kit(), s = bigCubeScale(fx), S = fx.R * .78 * s;
    ctx.globalCompositeOperation = 'lighter';
    if (s > .01) {
      K.glow(ctx, fx.x, fx.y - S * .7, S * 1.9, '190,215,255', .22 * s);
      ctx.globalCompositeOperation = 'source-over';
      drawCube(ctx, fx.x, fx.y + S * .35, S, time * .5 + fx.seed, .8, 'rgba(225,238,255,.22)', 'rgba(255,255,255,.95)', S * 1.4);
      drawCube(ctx, fx.x, fx.y + S * .05, S * .45, -time * 1.2, .85, 'rgba(240,248,255,.35)', 'rgba(170,210,255,.95)', S * .63);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - S * .25, S * .5, '255,255,255', .5 * s, true);
    }
    const u = fx.age - .75;
    if (u > 0 && u < .4) K.glow(ctx, fx.x, fx.y - 60, fx.R * 1.3, '255,255,255', (1 - u / .4) * .75, true);
    if (fx.age < .2) K.glow(ctx, fx.x, fx.y - 60, fx.R, '255,255,255', .6 * (1 - fx.age / .2), true);
    if (u > 0 && u < .6) {
      ctx.strokeStyle = `rgba(255,255,255,${.8 * (1 - u / .6)})`; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + fx.seed, r0 = 40 + u * 300, r1 = r0 + 120; ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y - 60 + Math.sin(a) * r0 * .6); ctx.lineTo(fx.x + Math.cos(a) * r1, fx.y - 60 + Math.sin(a) * r1 * .6); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age > .25 && fx.age < 1.5) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.4, (fx.age - .25) / 1.25, 1 - (fx.age - .25) / 1.25, '240,248,255');
    if (u > 0) dustBurst(ctx, fx.x, fx.y, fx.R * .9, u, fx.seed, 'dust', 14);
  }

  const FX = {
    coffin: [coffinG, coffinO], wave: [waveG, waveO], sandrain: [sandrainG, sandrainO], funeral: [funeralG, funeralO],
    lavaRiver: [lavaRiverG, lavaRiverO], mist: [mistG, mistO], dragon: [dragonG, dragonO], globs: [globsG, globsO], sea: [seaG, seaO],
    thunder: [null, thunderO], streak: [streakG, streakO], chop: [chopG, chopO], liger: [ligerG, ligerO], storm: [stormG, stormO], lineMark: [lineMarkG, null],
    boulder: [boulderG, boulderO], jinBeam: [jinBeamG, jinBeamO], hurl: [hurlG, hurlO], golem: [golemG, golemO], bigCube: [bigCubeG, bigCubeO]
  };

  // ------------------------------------------------------------------ per-member windup looks
  function chargeAura(ctx, z, st, m, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, lift = bodyLift(z), cx = z.x, cy = z.y - lift - 34;
    if (z.bossId === 'gaara') {
      const dust = K.puff('dust');
      for (let i = 0; i < 8; i++) { const a = time * 3 + i / 8 * TAU, r = 40 + 10 * Math.sin(time * 4 + i); K.stamp(ctx, dust, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .45 + 10, 10 + 6 * k, .8, .8); }
    } else if (z.bossId === 'mei') {
      const fire = K.puff('fire');
      for (let i = 0; i < 5; i++) { const ph = (time * 1.4 + i / 5) % 1; K.stamp(ctx, fire, cx + Math.sin(i * 2.3) * 22, cy + 30 - ph * 70, 8 + 6 * (1 - ph), bell(ph) * .8); }
      if (st.move === 'dragon' || st.move === 'mist') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, cx + 8, cy - 22, 30 + 20 * k, st.move === 'dragon' ? '120,200,255' : '200,240,140', .6); ctx.globalCompositeOperation = 'source-over'; }
    } else if (z.bossId === 'ay') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = hash(Math.floor(time * 18) + i * 3.1) * TAU, r = 30 + 20 * k;
        K.forkedBolt(ctx, cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, i * 9, time, { jitter: 8, alpha: .9, width: 1.6, pal: BOLT_B, step: 10, forks: 1, forkLen: 12, rate: 24, snap: true });
      }
      K.glow(ctx, cx, cy, 50 + 30 * k, '150,210,255', .4);
      ctx.globalCompositeOperation = 'source-over';
    } else if (z.bossId === 'onoki') {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx + 10, cy - 4, 30 + 30 * k, st.move === 'jinton' || st.move === 'cube' ? '230,240,255' : '220,190,140', .6);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const ph = (time * 1.2 + i / 5) % 1, s = 5 + 4 * (1 - ph);
        ctx.save(); ctx.translate(cx + Math.sin(i * 2.7) * 30, cy + 26 - ph * 60); ctx.rotate(time * 2 + i);
        ctx.globalAlpha = bell(ph); ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // Moves that show their mass forming before they are released.
  function windupOverlay(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, lift = bodyLift(z);
    if (st.move === 'boulder') {
      const R = 120 * (.3 + .7 * easeOut(k));
      const dust = K.puff('dust');
      K.stamp(ctx, dust, st.tx, st.ty - 270 + R * .6, R * .7, .5 * k);
      rockAt(ctx, st.tx, st.ty - 270, R, time * .3);
    } else if (st.move === 'light') {
      const R = 40 + 65 * easeOut(k), y = z.y - lift - 120 - 60 * k;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, y, R * 1.6, '255,230,180', .3); ctx.globalCompositeOperation = 'source-over';
      rockAt(ctx, z.x, y, R, time * .6);
    } else if (st.move === 'cube') {
      const s = 10 + 40 * easeOut(k), cy = st.ty - 140, hx = z.x + 10, hy = z.y - lift - 40;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(230,240,255,${.5 + .3 * Math.sin(time * 30)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(st.tx, cy - s * .6); ctx.stroke();
      K.glow(ctx, st.tx, cy - s * .6, s * 2.4, '200,225,255', .35);
      ctx.globalCompositeOperation = 'source-over';
      drawCube(ctx, st.tx, cy, s, time * 2.4, .85, 'rgba(225,238,255,.45)', '#ffffff', s * 1.4);
      ctx.globalCompositeOperation = 'source-over';
    } else if (st.move === 'jinton') {
      const hx = z.x + Math.cos(st.aim) * 26, hy = z.y - lift - 36 + Math.sin(st.aim) * 12, s = 6 + 14 * k;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx, hy, 40 + 50 * k, '230,240,255', .7, true);
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx - 40 * (1 - k), hy - 30 * (1 - k)); ctx.lineTo(hx, hy); ctx.lineTo(hx + 40 * (1 - k), hy - 30 * (1 - k)); ctx.stroke();
      drawCube(ctx, hx, hy + s * .4, s, time * 3, .9, 'rgba(240,248,255,.5)', '#ffffff', s * 1.4);
      ctx.globalCompositeOperation = 'source-over';
    } else if (st.move === 'funeral') {
      const dust = K.puff('dust');
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + time * .7, d = 470 * (.3 + .7 * k); K.stamp(ctx, dust, st.tx + Math.cos(a) * d, st.ty + Math.sin(a) * d - 10, 16 + 10 * k, .55, .7); }
    } else if (st.move === 'sea') {
      const fire = K.puff('fire');
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + time * 2, d = 50 + 30 * k; K.stamp(ctx, fire, z.x + Math.cos(a) * d, z.y + Math.sin(a) * d * .5 - 10, 14 + 10 * k, .8, .8); }
    }
  }
  function armorAura(ctx, z, st, time) {
    const K = Kit(), lift = bodyLift(z), cx = z.x, top = z.y - lift - 86, a = Math.min(1, st.armor * 2);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, z.y - lift - 40, 56, '130,200,255', .22 * a);
    for (let i = 0; i < 5; i++) {
      const s = (i - 2) * 11, ph = hash(Math.floor(time * 20) + i * 7.7);
      K.forkedBolt(ctx, cx + s, z.y - lift + 2, cx + s * .5 + (ph - .5) * 30, top - ph * 18, i * 13 + 5, time,
        { jitter: 9, alpha: .9 * a, width: 1.7, pal: i % 2 ? BOLT_B : BOLT_Y, step: 12, forks: 1, forkLen: 16, rate: 22, snap: true });
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function bodyLift(z) {
    const m = members[z && z.bossId], st = z && z.kg;
    let lift = m && m.lift ? m.lift + Math.sin(((st && st.t) || 0) * 2.2) * 4 : 0;
    if (st && st.jump) lift += Math.sin(Math.PI * Math.min(1, st.jump.t / st.jump.dur)) * 170;
    return lift;
  }

  function label(ctx, z, st, m) {
    if (!(st.windup > 0) || !st.move) return;
    const S = window.AnimeSprites, id = S && S.has && S.has(z.bossId) ? z.bossId : 'pain';
    const top = z.y - bodyLift(z) - (S && S.height ? S.height(id) : 100) - 34;
    ctx.save();
    ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#160f1d'; ctx.strokeText(MOVES[st.move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[st.move].label, z.x, top);
    ctx.restore();
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.kg;
    if (!m || !st) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
        if (st.move === 'funeral') { const R = st.tele[0].r * easeOut(k); ctx.globalAlpha = .75; ctx.drawImage(sandDisc(), st.tx - R, st.ty - R, R * 2, R * 2); ctx.globalAlpha = 1; }
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      if (st.jump) markCircle(ctx, st.jump.x1, st.jump.y1, st.jump.r, '255,228,90', 1, time, false);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.kg;
    if (!m || !st) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    // Gaara's sand shuriken
    if (st.shots.length) {
      const img = shurikenSprite(), L = LIFT();
      for (const s of st.shots) { ctx.save(); ctx.translate(s.b.x, s.b.y - L); ctx.rotate(s.r + time * 16); ctx.drawImage(img, -17, -17, 34, 34); ctx.restore(); }
    }
    if (z.health > 0) {
      if (st.armor > 0) armorAura(ctx, z, st, time);
      if (st.windup > 0 && st.move) { chargeAura(ctx, z, st, m, time); windupOverlay(ctx, z, st, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; label(ctx, z, st, m); }
    }
    ctx.restore();
  }

  window.KageBosses = { members, order, byVillage, moveLabels, pick, update, draw, drawOverlay, bodyLift, moves };
})();
