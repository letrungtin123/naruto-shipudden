(() => {
  'use strict';

  // The Ōtsutsuki: one boss at a time. update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints
  // telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above the characters.
  // Timers and cast state belong to the enemy (z.ot), not this module.
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
  const FB = 114 / 128;

  const order = ['momoshiki', 'kinshiki', 'isshiki', 'kaguya'];
  const members = {
    momoshiki: {
      name: 'MOMOSHIKI ŌTSUTSUKI', accent: '#f99574', robe: '#f4e6df', trim: '#a63c43',
      hpScale: 2.2, damageScale: 1.9, ability: 'HẤP THỤ CHAKRA', lift: 0,
      moves: ['absorb', 'rasengan', 'rods', 'fist', 'katon', 'super']
    },
    kinshiki: {
      name: 'KINSHIKI ŌTSUTSUKI', accent: '#ec5e69', robe: '#4d4060', trim: '#d64252',
      hpScale: 2.65, damageScale: 2.25, ability: 'HỒNG PHỦ CHAKRA', lift: 0,
      moves: ['axe', 'spears', 'blades', 'dash', 'axe', 'giant']
    },
    isshiki: {
      name: 'ISSHIKI ŌTSUTSUKI', accent: '#f7c16d', robe: '#292735', trim: '#b8803c',
      hpScale: 3.1, damageScale: 2.55, ability: 'ĐẠI HẮC THIÊN', lift: 0,
      moves: ['rods', 'cubes', 'shrink', 'pillars', 'cubes', 'crash']
    },
    kaguya: {
      name: 'KAGUYA ŌTSUTSUKI', accent: '#cda9ff', robe: '#e9ebf5', trim: '#9b70be',
      hpScale: 3.35, damageScale: 2.4, ability: 'THIÊN CHI NGỰ TRUNG', lift: 20,
      moves: ['bones', 'portal', 'kusho', 'shift', 'bones', 'tsb']
    }
  };
  // Move ids are per member (Momoshiki's rods are chakra receivers, Isshiki's are Sukunahikona rods).
  const MOVES = {
    momoshiki: {
      absorb:   { label: 'HẤP THỤ CHAKRA · NGẠ QUỶ', rgb: '255,140,120', windup: .5, after: 2.6 },
      rasengan: { label: 'PHẢN HỒI · ĐẠI RASENGAN', rgb: '120,190,255', windup: .9, after: 1.5 },
      rods:     { label: 'HẮC BỔNG · THỤ THỂ CHAKRA', rgb: '255,120,110', windup: .7, after: 2.0 },
      fist:     { label: 'KẾT GIỚI · CỰ QUYỀN', rgb: '255,150,120', windup: 1.0, after: 1.6 },
      katon:    { label: 'PHẢN HỒI · HỎA ĐỘN · ĐẠI HỎA LONG', rgb: '255,110,40', windup: .85, after: 1.8 },
      super:    { label: 'PHẢN HỒI · SIÊU ĐẠI NGỌC', rgb: '200,150,255', windup: 1.3, after: 3.0 }
    },
    kinshiki: {
      axe:    { label: 'HỒNG PHỦ TRẢM', rgb: '255,90,100', windup: .9, after: 1.4 },
      spears: { label: 'HỒNG THƯƠNG VŨ', rgb: '255,90,100', windup: .65, after: 2.1 },
      blades: { label: 'HỒNG ĐAO LOẠN VŨ', rgb: '255,110,120', windup: .75, after: 1.9 },
      dash:   { label: 'HỒNG PHỦ ĐỘT KÍCH', rgb: '255,90,100', windup: .6, after: 1.2 },
      giant:  { label: 'BIẾN THÂN · HỒNG PHỦ ĐẠI LUÂN TRẢM', rgb: '255,70,90', windup: 1.25, after: 2.8 }
    },
    isshiki: {
      rods:    { label: 'THIẾU DANH MỆNH · HẮC BỔNG VŨ', rgb: '247,193,109', windup: .7, after: 2.1 },
      cubes:   { label: 'ĐẠI HẮC THIÊN · HẮC LẬP PHƯƠNG', rgb: '247,193,109', windup: .85, after: 2.0 },
      shrink:  { label: 'THIẾU DANH MỆNH · PHÓNG ĐẠI', rgb: '247,193,109', windup: .65, after: 1.3 },
      pillars: { label: 'ĐẠI HẮC THIÊN · HẮC TRỤ', rgb: '247,193,109', windup: .85, after: 1.8 },
      crash:   { label: 'ĐẠI HẮC THIÊN · CỰ LẬP PHƯƠNG GIÁNG', rgb: '255,210,120', windup: 1.2, after: 3.2 }
    },
    kaguya: {
      bones:  { label: 'CỘNG SÁT HÔI CỐT', rgb: '230,220,255', windup: .8, after: 1.8 },
      portal: { label: 'HOÀNG TUYỀN TỶ LƯƠNG PHẢN', rgb: '190,150,255', windup: 1.0, after: 1.5 },
      kusho:  { label: 'BÁT QUÁI KHÔNG CHƯỞNG', rgb: '220,230,255', windup: .8, after: 1.3 },
      shift:  { label: 'THIÊN CHI NGỰ TRUNG · BĂNG GIỚI', rgb: '170,220,255', windup: 1.1, after: 2.4 },
      tsb:    { label: 'BÀNH TRƯỚNG CẦU ĐẠO NGỌC', rgb: '205,169,255', windup: 1.4, after: 3.2 }
    }
  };
  const labels = {};
  for (const id in MOVES) for (const k in MOVES[id]) labels[id + ':' + k] = MOVES[id][k].label;
  // Manual control (team mode): each member's distinct jutsu in key order 1..n, ultimate last.
  const MANUAL = {};
  for (const id in members) MANUAL[id] = [...new Set(members[id].moves)].slice(0, 8).map(k => ({ id: k, label: MOVES[id][k].label }));
  function moves(z) { return (z && MANUAL[z.bossId]) || []; }
  const KFLAME = [[1, '#5a0614'], [.84, '#a8102a'], [.66, '#e8304a'], [.46, '#ff7a8a'], [.25, '#ffe0e4']];

  function pick(wave) {
    const index = Math.max(0, Math.floor((wave - 3) / 2));
    return order[index % order.length];
  }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.ot || (z.ot = { t: 0, casts: 0, timer: 1.2 + (z.id % 4) * .15, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], force: null, dash: null, hold: 0, absorb: 0, absorbTick: 0, portals: null });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });
  const defOf = (z, move) => (MOVES[z.bossId] || {})[move];

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
  function ringStrikes(api, x, y, rho, dmg, kind) {
    const n = Math.max(6, Math.ceil(TAU * rho / 110)), r = Math.max(58, TAU * rho / n * .62);
    for (let i = 0; i < n; i++) { const a = i / n * TAU; api.strike(x + Math.cos(a) * rho, y + Math.sin(a) * rho, r, dmg, null, i % 4 === 0 ? kind : null, true); }
  }
  function scatter(cx, cy, r, n, firstAtCentre) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = i === 0 && firstAtCentre ? 0 : Math.sqrt(Math.random()) * r;
      out.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d });
    }
    return out;
  }

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, id = z.bossId;
    const line = (len, w) => ({ k: 'line', x, y, a, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    const end = len => [x + Math.cos(a) * len, y + Math.sin(a) * len];
    if (id === 'momoshiki') switch (move) {
      case 'absorb': return [circ(x, y, 420, true)];
      case 'rasengan': { const [ex, ey] = end(820); return [line(820, 90), circ(ex, ey, 250)]; }
      case 'rods': return [-2, -1, 0, 1, 2].map(i => ({ k: 'line', x, y, a: a + i * .09, len: 820, w: 24 }));
      case 'fist': return [circ(tx, ty, 240)];
      case 'katon': return [{ k: 'cone', x, y, a, r: 650, h: .5 }];
      case 'super': return [circ(tx, ty, 400)];
    }
    if (id === 'kinshiki') switch (move) {
      case 'axe': { const [ex, ey] = end(560); return [line(560, 110), circ(ex, ey, 190)]; }
      case 'spears': return [circ(tx, ty, 420, true)];
      case 'blades': return [circ(x, y, 330)];
      case 'dash': return [line(760, 90)];
      case 'giant': return [circ(x, y, 480)];
    }
    if (id === 'isshiki') switch (move) {
      case 'rods': return [circ(tx, ty, 420, true)];
      case 'cubes': {
        st.spots = [{ x: tx, y: ty }];
        const a0 = Math.random() * TAU;
        for (let i = 0; i < 4; i++) st.spots.push({ x: tx + Math.cos(a0 + i * TAU / 4) * 230, y: ty + Math.sin(a0 + i * TAU / 4) * 230 });
        return st.spots.map(s => circ(s.x, s.y, 130));
      }
      case 'shrink': return [-2, -1, 0, 1, 2].map(i => ({ k: 'line', x, y, a: a + i * .22, len: 850, w: 30 }));
      case 'pillars': return [line(900, 85)];
      case 'crash': return [circ(tx, ty, 360)];
    }
    if (id === 'kaguya') switch (move) {
      case 'bones': return [{ k: 'cone', x, y, a, r: 700, h: .45 }];
      case 'portal': {
        const a0 = Math.random() * TAU;
        st.portals = [0, 1, 2].map(i => {
          const pa = a0 + i * TAU / 3, px = tx + Math.cos(pa) * 280, py = ty + Math.sin(pa) * 280;
          return { x: px, y: py, a: pa + Math.PI, len: 560 };
        });
        return st.portals.map(p => ({ k: 'line', x: p.x, y: p.y, a: p.a, len: p.len, w: 46 }));
      }
      case 'kusho': return [{ k: 'cone', x, y, a, r: 680, h: .38 }];
      case 'shift': return [circ(tx, ty, 500)];
      case 'tsb': return [circ(x, y, 540)];
    }
    return [];
  }

  function announce(z, st, m, api) {
    let move = st.force;
    if (move && defOf(z, move)) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = defOf(z, move), p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.tele = teleFor(z, st, move);
  }

  function startDash(z, st, a, len, speed, w, dmg, endR, endDmg) {
    const fx = addFx(st, { kind: 'kstreak', x0: z.x, y0: z.y, x1: z.x, y1: z.y, a, w, dur: len / speed + .8, seed: Math.random() * 99 });
    st.dash = { a, speed, left: len / speed, hit: 0, w, dmg, endR, endDmg, fx };
  }

  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || z.damage || 42, s = st.tele[0] || { x: z.x, y: z.y, a: st.aim, r: 200, len: 600, w: 80 };
    const ca = Math.cos(s.a || 0), sa = Math.sin(s.a || 0), seed = Math.random() * 99, id = z.bossId;
    api.burst(z.x, z.y - 20, m.accent, 8);
    const key = id + ':' + move;
    switch (key) {
      // ---------------------------------------------------------- Momoshiki
      case 'momoshiki:absorb':
        st.absorb = 2.4; st.absorbTick = .2;
        addFx(st, { kind: 'absorb', dur: 2.6, seed });
        break;
      case 'momoshiki:rasengan': {
        const end = st.tele[1], speed = 760;
        addFx(st, { kind: 'rasen', x: s.x, y: s.y, a: s.a, len: s.len, speed, r: end.r, dur: s.len / speed + 1.3, seed });
        for (let d = 80; d < s.len; d += 80) later(st, d / speed, api => api.strike(s.x + ca * d, s.y + sa * d, s.w, D * 1.6, null, null, true));
        later(st, s.len / speed, api => { api.strike(end.x, end.y, end.r, D * 2.8, '#9fd0ff', 'vortex'); api.world(end.x, end.y, end.r * .8, D * 2, 'crater'); api.shake(14); });
        break;
      }
      case 'momoshiki:rods': {
        const fx = addFx(st, { kind: 'mrods', lines: [], dur: 3.0, seed });
        const fire = (api, ln) => api.line(ln.x, ln.y, ln.x + Math.cos(ln.a) * ln.len, ln.y + Math.sin(ln.a) * ln.len, 24, D * 1.3);
        for (const t of st.tele) { const ln = { x: t.x, y: t.y, a: t.a, len: t.len, tm: -.01, tf: 0 }; fx.lines.push(ln); later(st, .1, api => fire(api, ln)); }
        for (let v = 1; v <= 2; v++) {
          later(st, v * .6 - .45, api => {
            const p = api.player, base = aimAt(z, p);
            for (let i = -1; i <= 1; i++) {
              const ln = { x: z.x, y: z.y, a: base + i * .12, len: 820, tm: fx.age, tf: fx.age + .45 };
              fx.lines.push(ln); later(st, .55, api => fire(api, ln));
            }
          });
        }
        break;
      }
      case 'momoshiki:fist':
        addFx(st, { kind: 'fist', x: s.x, y: s.y, r: s.r, fall: .3, dur: .3 + 2.0, seed });
        later(st, .3, api => {
          api.strike(s.x, s.y, s.r, D * 3.0, '#ff9a80', 'crater');
          for (let i = 0; i < 5; i++) api.world(s.x + Math.cos(i * 1.26) * 140, s.y + Math.sin(i * 1.26) * 140, 90, D * 2, 'crater');
          api.shake(16);
        });
        break;
      case 'momoshiki:katon': {
        const speed = 820, fx = addFx(st, { kind: 'katon', x: s.x, y: s.y, a: s.a, reach: s.r, half: s.h, speed, dur: 3.4, tick: .45, seed, pts: [] });
        const hits = conePts(s.x, s.y, s.a, s.r, s.h);
        for (const h of hits) later(st, h.d / speed, api => api.strike(h.x, h.y, h.r, D * 2.0, null, h.d % 170 < 85 ? 'fire' : null, true));
        fx.upd = (fx, dt, api) => {
          if (fx.age > s.r / speed && fx.age < fx.dur - .9 && (fx.tick -= dt) <= 0) { fx.tick = .45; for (const h of hits) api.strike(h.x, h.y, h.r * .9, D * .35, null, null, true); }
        };
        for (let j = 0; j < 70; j++) {
          const d = s.r * Math.sqrt(lerp(.03, 1, hash(j * 1.31 + seed))), off = (hash(j * 2.71 + seed) * 2 - 1) * s.h * .95;
          const aa = s.a + off * (.5 + .5 * Math.min(1, d / 200));
          fx.pts.push({ x: s.x + Math.cos(aa) * d, y: s.y + Math.sin(aa) * d, d, s: (66 + hash(j * 4.1) * 50) * (.7 + .45 * d / s.r), i: j % 6 });
        }
        fx.pts.sort((p, q) => p.y - q.y);
        api.shake(8);
        break;
      }
      case 'momoshiki:super': {
        const lift = bodyLift(z), x0 = z.x, y0 = z.y - lift - 170;
        addFx(st, { kind: 'superOrb', x0, y0, x: s.x, y: s.y, R: s.r, fly: .55, dur: .55 + 2.2, seed });
        later(st, .55, api => {
          api.strike(s.x, s.y, s.r, D * 3.8, '#c896ff', 'vortex');
          for (let i = 0; i < 8; i++) api.world(s.x + Math.cos(i * TAU / 8) * 240, s.y + Math.sin(i * TAU / 8) * 240, 130, D * 2.5, 'crater');
          api.shake(20);
        });
        st.hold = .6;
        break;
      }
      // ---------------------------------------------------------- Kinshiki
      case 'kinshiki:axe': {
        const end = st.tele[1];
        addFx(st, { kind: 'axe', x: s.x, y: s.y, a: s.a, len: s.len, r: end.r, side: Math.cos(s.a) >= 0 ? 1 : -1, dur: 2.2, seed });
        later(st, .16, api => {
          api.line(s.x, s.y, s.x + ca * s.len, s.y + sa * s.len, s.w, D * 2.6, 'blade');
          api.strike(end.x, end.y, end.r, D * 2.8, '#ff6070', 'crater');
          api.shake(15);
        });
        st.hold = .4;
        break;
      }
      case 'kinshiki:spears': {
        const items = scatter(s.x, s.y, s.r, 16, true).map((p, i) => ({ x: p.x, y: p.y, t0: .05 + i * .09, fl: .55, chase: i % 4 === 3, seed: seed + i * 3.1 }));
        items.forEach((it, i) => {
          if (it.chase) later(st, it.t0, api => { const p = api.player; if (p && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 150) { it.x = p.x; it.y = p.y; } });
          later(st, it.t0 + it.fl, api => api.strike(it.x, it.y, 62, D * 1.2, null, i % 3 === 0 ? 'blade' : null, true));
        });
        addFx(st, { kind: 'spears', items, dur: .05 + 15 * .09 + .55 + 1.6, seed });
        break;
      }
      case 'kinshiki:blades': {
        addFx(st, { kind: 'blades', x: s.x, y: s.y, R: s.r, dur: 1.5, seed });
        for (let k = 0; k < 4; k++) later(st, .15 + k * .3, api => api.strike(s.x, s.y, s.r, D * 1.0, null, k === 0 ? 'blade' : null, true));
        later(st, 1.2, api => { for (let i = 0; i < 12; i++) api.projectile(z, i / 12 * TAU, 620, D * .7, 'shuriken', '#ff7780', 1.3); api.shake(8); });
        st.hold = 1.25;
        break;
      }
      case 'kinshiki:dash':
        startDash(z, st, s.a, s.len, 2000, s.w, D * 1.8, 170, D * 2.0);
        break;
      case 'kinshiki:giant':
        addFx(st, { kind: 'giantAxe', x: s.x, y: s.y, R: s.r, side: Math.cos(st.aim) >= 0 ? 1 : -1, dur: 1.5, seed });
        later(st, .1, api => { api.strike(s.x, s.y, s.r, D * 2.4, '#ff5a6a', 'blade'); api.shake(14); });
        later(st, .6, api => { api.strike(s.x, s.y, s.r, D * 2.4, '#ff5a6a', 'blade'); api.knockback(z, s.r, 200, 0); api.shake(18); });
        st.hold = 1.2;
        break;
      // ---------------------------------------------------------- Isshiki
      case 'isshiki:rods': {
        const items = scatter(s.x, s.y, s.r, 12, true).map((p, i) => ({ x: p.x, y: p.y, t0: .05 + i * .11, fl: .6, chase: i % 3 === 2, seed: seed + i * 2.7 }));
        items.forEach((it, i) => {
          if (it.chase) later(st, it.t0, api => { const p = api.player; if (p && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 150) { it.x = p.x; it.y = p.y; } });
          later(st, it.t0 + it.fl, api => { api.strike(it.x, it.y, 70, D * 1.4, null, i % 3 === 0 ? 'crater' : null, true); api.shake(4); });
        });
        addFx(st, { kind: 'irods', items, dur: .05 + 11 * .11 + .6 + 1.8, seed });
        break;
      }
      case 'isshiki:cubes': {
        const items = (st.spots || [{ x: s.x, y: s.y }]).map((p, i) => ({ x: p.x, y: p.y, t0: i * .14, fl: .5, seed: seed + i }));
        items.forEach((it, i) => later(st, it.t0 + it.fl, api => { api.strike(it.x, it.y, 130, D * 2.3, i === 0 ? '#f7c16d' : null, 'crater', i !== 0); api.shake(10); }));
        addFx(st, { kind: 'cubes', items, dur: 4 * .14 + .5 + 1.9, seed });
        break;
      }
      case 'isshiki:shrink': {
        const lines = st.tele.map(t => ({ x: t.x, y: t.y, a: t.a, len: t.len }));
        const speed = 1400;
        addFx(st, { kind: 'shrink', lines, speed, dur: 850 / speed + 1.4, seed });
        for (const ln of lines) for (let d = 60, i = 0; d <= ln.len; d += 70, i++)
          later(st, d / speed, api => api.strike(ln.x + Math.cos(ln.a) * d, ln.y + Math.sin(ln.a) * d, 36, D * 1.6, null, i % 4 === 3 ? 'blade' : null, true));
        break;
      }
      case 'isshiki:pillars': {
        const items = [];
        for (let i = 0; i < 7; i++) { const d = 130 + i * 125; items.push({ x: s.x + ca * d, y: s.y + sa * d, t0: i * .09, fl: .45 }); }
        items.forEach((it, i) => later(st, it.t0 + it.fl, api => { api.strike(it.x, it.y, 85, D * 1.9, null, i % 2 ? null : 'crater', true); api.shake(7); }));
        addFx(st, { kind: 'pillars', items, dur: 6 * .09 + .45 + 1.8, seed });
        break;
      }
      case 'isshiki:crash':
        addFx(st, { kind: 'crash', x: s.x, y: s.y, R: s.r, fall: .9, dur: .9 + 2.6, seed });
        later(st, .9, api => {
          api.strike(s.x, s.y, s.r, D * 4.0, '#f7c16d', 'crater');
          for (let i = 0; i < 8; i++) api.world(s.x + Math.cos(i * TAU / 8) * 230, s.y + Math.sin(i * TAU / 8) * 230, 140, D * 2.5, 'crater');
          api.shake(22);
        });
        st.hold = .9;
        break;
      // ---------------------------------------------------------- Kaguya
      case 'kaguya:bones': {
        const items = [];
        for (let d = 80; d <= s.r; d += 78) {
          const n = Math.max(1, Math.ceil(2 * s.h * d / 115));
          for (let i = 0; i < n; i++) {
            const aa = s.a + (n === 1 ? 0 : (i / (n - 1) - .5) * 2 * s.h * .92) + (Math.random() - .5) * .08, dd = d + rand(-14, 14);
            items.push({ x: s.x + Math.cos(aa) * dd, y: s.y + Math.sin(aa) * dd, t0: dd / 1000, h: rand(.5, .78), v: items.length % 3, flip: Math.random() < .5 });
          }
        }
        items.sort((p, q) => p.y - q.y);
        items.forEach((it, i) => later(st, it.t0, api => api.strike(it.x, it.y, 60, D * 1.3, null, i % 5 === 0 ? 'blade' : null, true)));
        addFx(st, { kind: 'bones', items, dur: s.r / 1000 + 1.7, seed });
        api.shake(6);
        break;
      }
      case 'kaguya:portal': {
        const portals = st.portals || [];
        addFx(st, { kind: 'portal', portals, dur: 1.4, seed });
        for (const p of portals) later(st, .08, api => api.line(p.x, p.y, p.x + Math.cos(p.a) * p.len, p.y + Math.sin(p.a) * p.len, 46, D * 1.9, 'blade'));
        st.portals = null;
        api.shake(8);
        break;
      }
      case 'kaguya:kusho': {
        for (const p of conePts(s.x, s.y, s.a, s.r, s.h)) later(st, p.d / 2600, api => api.strike(p.x, p.y, p.r, D * 2.2, null, p.d % 255 < 85 ? 'shockwave' : null, true));
        later(st, .12, api => {
          const p = api.player;
          if (p) { const d = Math.hypot(p.x - s.x, p.y - s.y), da = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - s.y, p.x - s.x) - s.a), Math.cos(Math.atan2(p.y - s.y, p.x - s.x) - s.a))); if (d < s.r && da < s.h + .1) api.knockback(z, s.r + 40, 230, 0); }
        });
        addFx(st, { kind: 'kusho', x: s.x, y: s.y, a: s.a, r: s.r, h: s.h, dur: 1.25, seed });
        api.shake(12);
        break;
      }
      case 'kaguya:shift': {
        const spikes = scatter(s.x, s.y, s.r * .92, 24, true).map((p, i) => ({ x: p.x, y: p.y, t0: Math.hypot(p.x - s.x, p.y - s.y) / 2200, h: rand(.7, 1.3), v: i % 3 }));
        spikes.sort((p, q) => p.y - q.y);
        const fx = addFx(st, { kind: 'ice', x: s.x, y: s.y, R: s.r, spikes, dur: 4.2, tick: .5, seed });
        api.strike(s.x, s.y, s.r, D * 2.0, '#cfe8ff', 'shockwave');
        fx.upd = (fx, dt, api) => { if (fx.age > .4 && fx.age < fx.dur - 1.0 && (fx.tick -= dt) <= 0) { fx.tick = .5; api.strike(s.x, s.y, s.r, D * .3, null, null, true); } };
        api.shake(12);
        break;
      }
      case 'kaguya:tsb': {
        const R = s.r, exp = .7;
        addFx(st, { kind: 'tsb', x: s.x, y: s.y, R, exp, dur: exp + 1.8, seed });
        for (let r = 80; r <= R; r += 80) later(st, exp * r / R, api => ringStrikes(api, s.x, s.y, r, D * 3.8, 'vortex'));
        later(st, .02, api => api.strike(s.x, s.y, 90, D * 3.8, null, 'vortex', true));
        later(st, exp, api => api.shake(20));
        st.hold = 1.0;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ update
  function update(z, dt, api) {
    const m = z && members[z.bossId];
    if (!m) return;
    const st = state(z);
    st.t += dt;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) { z.otsuWindup = 0; z.manualBusy = false; st.dash = null; st.ev.length = 0; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    // Momoshiki's palm drinks in chakra: the jutsu he absorbs come back from the other hand.
    if (st.absorb > 0) {
      st.absorb -= dt;
      if ((st.absorbTick -= dt) <= 0) { st.absorbTick = .6; api.knockback(z, 420, -120, (api.damage || 42) * .3); }
      if (z.health < z.maxHealth) z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .012 * dt);
    }
    z.armorScale = st.absorb > 0 ? .25 : 1;
    if (st.dash) {
      const ds = st.dash, step = Math.min(ds.left, dt) * ds.speed;
      ds.left -= dt;
      api.move(Math.cos(ds.a) * step, Math.sin(ds.a) * step);
      ds.fx.x1 = z.x; ds.fx.y1 = z.y;
      if ((ds.hit -= dt) <= 0) { ds.hit = .06; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      if (ds.left <= 0) {
        api.strike(z.x, z.y, ds.endR, ds.endDmg, '#ff6070', 'blade');
        api.shake(12);
        addFx(st, { kind: 'kslash', x: z.x, y: z.y, a: ds.a, r: ds.endR, dur: .6, seed: Math.random() * 99 });
        st.dash = null;
      }
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = defOf(z, st.move).after * rand(.9, 1.1);
        st.move = ''; st.tele = [];
      }
    } else if (!st.dash && !(st.absorb > 0)) {
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
        if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 820) announce(z, st, m, api);
      }
    }
    z.manualBusy = st.windup > 0 || !!st.dash || st.hold > 0 || st.absorb > 0;
    z.otsuWindup = st.windup > 0 ? st.windup : Math.max(st.hold, st.absorb > 0 ? st.absorb : 0, st.dash ? .05 : 0);
  }

  // ------------------------------------------------------------------ sprites
  function axeSprite() {
    return Kit().sprite('ot:axe', 200, 360, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = 'rgba(120,10,30,.9)'; g.lineWidth = 16; g.beginPath(); g.moveTo(100, 350); g.lineTo(100, 30); g.stroke();
      g.strokeStyle = '#ff5466'; g.lineWidth = 10; g.stroke();
      g.strokeStyle = '#ffd0d6'; g.lineWidth = 3; g.beginPath(); g.moveTo(97, 345); g.lineTo(97, 34); g.stroke();
      const blade = () => { g.beginPath(); g.moveTo(104, 56); g.quadraticCurveTo(140, 50, 168, 4); g.quadraticCurveTo(222, 92, 168, 184); g.quadraticCurveTo(140, 138, 104, 132); g.closePath(); };
      blade(); g.fillStyle = 'rgba(200,30,56,.92)'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#6a0a1c'; g.stroke();
      g.save(); blade(); g.clip();
      g.fillStyle = 'rgba(255,120,136,.95)'; g.beginPath(); g.ellipse(196, 94, 34, 96, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,230,234,.95)'; g.beginPath(); g.ellipse(214, 94, 18, 92, 0, 0, TAU); g.fill();
      g.restore();
      g.fillStyle = '#ffb8c0'; g.beginPath(); g.moveTo(96, 62); g.lineTo(52, 50); g.lineTo(96, 104); g.closePath(); g.fill();
      g.strokeStyle = '#6a0a1c'; g.lineWidth = 3; g.stroke();
    });
  }
  function spearSprite() {
    return Kit().sprite('ot:spear', 28, 160, g => {
      g.beginPath(); g.moveTo(14, 0); g.lineTo(25, 40); g.lineTo(18, 160); g.lineTo(10, 160); g.lineTo(3, 40); g.closePath();
      g.fillStyle = '#e02c46'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#5a0a18'; g.stroke();
      g.beginPath(); g.moveTo(14, 4); g.lineTo(20, 40); g.lineTo(15, 150); g.closePath(); g.fillStyle = '#ffb0bc'; g.fill();
    });
  }
  function rodSprite() {
    return Kit().sprite('ot:rod', 22, 220, g => {
      g.beginPath(); g.moveTo(11, 0); g.lineTo(19, 18); g.lineTo(19, 220); g.lineTo(3, 220); g.lineTo(3, 18); g.closePath();
      g.fillStyle = '#16131c'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke();
      g.fillStyle = '#4a4458'; g.fillRect(6, 20, 3, 196);
      g.fillStyle = '#d9a650'; for (let y = 40; y < 210; y += 44) g.fillRect(3, y, 16, 5);
    });
  }
  function fistSprite() {
    return Kit().sprite('ot:fist', 240, 240, g => {
      const body = () => {
        g.beginPath();
        g.moveTo(40, 120); g.quadraticCurveTo(36, 40, 120, 34); g.quadraticCurveTo(204, 40, 204, 118);
        g.quadraticCurveTo(206, 196, 120, 206); g.quadraticCurveTo(44, 200, 40, 120); g.closePath();
      };
      g.lineJoin = 'round';
      body(); g.fillStyle = 'rgba(255,120,110,.35)'; g.lineWidth = 22; g.strokeStyle = 'rgba(255,110,100,.35)'; g.stroke();
      body(); g.fillStyle = '#f2c2a8'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#6a2a24'; g.stroke();
      // knuckles (fingers curled toward the ground)
      for (let i = 0; i < 4; i++) {
        const x = 68 + i * 36;
        g.fillStyle = '#f8d4bf'; g.beginPath(); g.ellipse(x, 178, 19, 24, 0, 0, TAU); g.fill();
        g.strokeStyle = '#6a2a24'; g.lineWidth = 3.5; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(x - 5, 170, 6, 8, 0, 0, TAU); g.fill();
      }
      g.fillStyle = '#eab296'; g.beginPath(); g.ellipse(52, 110, 22, 46, -.3, 0, TAU); g.fill(); g.strokeStyle = '#6a2a24'; g.lineWidth = 3.5; g.stroke();
      g.strokeStyle = 'rgba(106,42,36,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(90, 80); g.quadraticCurveTo(130, 70, 170, 86); g.stroke();
      g.fillStyle = '#a63c43'; g.beginPath(); g.ellipse(124, 110, 14, 14, 0, 0, TAU); g.fill();
      g.strokeStyle = '#ffe0d0'; g.lineWidth = 2; for (let r = 4; r < 14; r += 4) { g.beginPath(); g.arc(124, 110, r, 0, TAU); g.stroke(); }
    });
  }
  // Ash bones: three curved spikes from one root, ivory with a violet-grey shade.
  const BW = 110, BH = 160;
  function boneSprite(v) {
    return Kit().sprite('ot:bone' + v, BW, BH, g => {
      g.lineJoin = 'round';
      const spike = (bx, h, lean, w) => {
        g.beginPath(); g.moveTo(bx - w, 156);
        g.quadraticCurveTo(bx - w * .6 + lean * .4, 156 - h * .55, bx + lean, 156 - h);
        g.quadraticCurveTo(bx + w * .6 + lean * .5, 156 - h * .5, bx + w, 156); g.closePath();
        g.fillStyle = '#efe9f4'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#5a4a6e'; g.stroke();
        g.beginPath(); g.moveTo(bx + w * .2, 154); g.quadraticCurveTo(bx + w * .5 + lean * .45, 156 - h * .5, bx + lean, 156 - h + 6); g.lineTo(bx + w * .8, 154); g.closePath();
        g.fillStyle = 'rgba(160,140,190,.6)'; g.fill();
      };
      const s = v * 3.1 + 1;
      spike(30 + hash(s) * 8, 70 + hash(s + 1) * 30, -18, 10);
      spike(78 - hash(s + 2) * 8, 80 + hash(s + 3) * 30, 16, 11);
      spike(55, 130 + hash(s + 4) * 22, (hash(s + 5) - .5) * 20, 15);
    });
  }
  function crystalSprite(v) {
    return Kit().sprite('ot:ice' + v, 100, 140, g => {
      g.lineJoin = 'round';
      const shard = (bx, h, lean, w) => {
        g.beginPath(); g.moveTo(bx - w, 136); g.lineTo(bx - w * .7 + lean * .6, 136 - h * .75); g.lineTo(bx + lean, 136 - h); g.lineTo(bx + w * .7 + lean * .6, 136 - h * .75); g.lineTo(bx + w, 136); g.closePath();
        g.fillStyle = 'rgba(200,236,255,.92)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#3c6a9a'; g.stroke();
        g.beginPath(); g.moveTo(bx, 134); g.lineTo(bx + lean, 136 - h); g.lineTo(bx + w * .7 + lean * .6, 136 - h * .75); g.lineTo(bx + w, 136); g.closePath();
        g.fillStyle = 'rgba(120,180,230,.55)'; g.fill();
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx - w * .4, 130); g.lineTo(bx - w * .3 + lean * .7, 136 - h * .7); g.stroke();
      };
      const s = v * 4.3 + 2;
      shard(28, 60 + hash(s) * 20, -14, 11);
      shard(74, 66 + hash(s + 1) * 22, 14, 12);
      shard(50, 110 + hash(s + 2) * 26, (hash(s + 3) - .5) * 14, 16);
    });
  }
  function iceDisc() {
    return Kit().sprite('ot:icedisc', 512, 512, g => {
      const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256);
      gr.addColorStop(0, 'rgba(236,248,255,.95)'); gr.addColorStop(.6, 'rgba(190,226,250,.9)'); gr.addColorStop(.88, 'rgba(140,190,235,.75)'); gr.addColorStop(1, 'rgba(120,170,230,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 256, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,140,200,.5)'; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        let a = hash(i * 3.3) * TAU, d = hash(i * 7.1) * 200, x = 256 + Math.cos(a) * d, y = 256 + Math.sin(a) * d;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { a += (hash(i + k * 9) - .5) * 1.4; x += Math.cos(a) * 26; y += Math.sin(a) * 26; g.lineTo(x, y); }
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.4;
      for (let i = 0; i < 30; i++) { const a = hash(i * 5.9) * TAU, d = hash(i * 2.2) * 220; g.beginPath(); g.moveTo(256 + Math.cos(a) * d - 8, 256 + Math.sin(a) * d); g.lineTo(256 + Math.cos(a) * d + 8, 256 + Math.sin(a) * d - 3); g.stroke(); }
    });
  }
  function tsbSprite() { return Kit().sphere('ot:tsb', [[0, '#8a849a'], [.12, '#3a3546'], [.45, '#100e16'], [.85, '#050407'], [1, '#000']]); }
  function palmSprite() {
    return Kit().sprite('ot:palm', 200, 240, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const hand = () => {
        g.beginPath();
        g.moveTo(52, 230); g.lineTo(46, 130); g.lineTo(18, 92); g.quadraticCurveTo(14, 80, 26, 80); g.lineTo(56, 110);
        g.lineTo(58, 30); g.quadraticCurveTo(66, 18, 74, 30); g.lineTo(80, 100);
        g.lineTo(92, 14); g.quadraticCurveTo(102, 4, 110, 16); g.lineTo(112, 100);
        g.lineTo(126, 24); g.quadraticCurveTo(136, 14, 142, 28); g.lineTo(138, 108);
        g.lineTo(156, 50); g.quadraticCurveTo(166, 42, 170, 56); g.lineTo(158, 140); g.lineTo(150, 230); g.closePath();
      };
      hand(); g.fillStyle = 'rgba(230,240,255,.55)'; g.fill(); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
      g.lineWidth = 2; g.strokeStyle = 'rgba(160,180,230,.8)';
      g.beginPath(); g.moveTo(66, 150); g.quadraticCurveTo(100, 132, 140, 150); g.moveTo(70, 180); g.quadraticCurveTo(100, 166, 136, 176); g.stroke();
    });
  }

  // ------------------------------------------------------------------ draw helpers
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath(); ctx.arc(x, y, r1, a0, a1);
    if (r0 > 0) ctx.arc(x, y, r0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(20,10,20,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
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
      ctx.fillStyle = 'rgba(20,10,20,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
      ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      if (s.w > 40) {
        ctx.lineWidth = 2.5; ctx.beginPath();
        for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
        ctx.stroke();
      }
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(20,10,20,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
    }
    ctx.restore();
  }
  function drawCube(ctx, x, y, s, rot, alpha, face, top, edge, hgt) {
    const P = [], h = hgt == null ? s * 1.5 : hgt;
    for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2 + Math.PI / 4; P.push(x + Math.cos(a) * s * 1.414, y + Math.sin(a) * s * .707); }
    ctx.lineJoin = 'round'; ctx.globalAlpha = alpha; ctx.strokeStyle = edge;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, mid = rot + i * Math.PI / 2 + Math.PI / 2;
      if (Math.sin(mid) <= 0) continue;
      ctx.beginPath(); ctx.moveTo(P[i * 2], P[i * 2 + 1]); ctx.lineTo(P[j * 2], P[j * 2 + 1]); ctx.lineTo(P[j * 2], P[j * 2 + 1] - h); ctx.lineTo(P[i * 2], P[i * 2 + 1] - h); ctx.closePath();
      ctx.fillStyle = face; ctx.fill();
      if (Math.cos(mid) < 0) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill(); }
      ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.beginPath(); for (let i = 0; i < 4; i++) ctx.lineTo(P[i * 2], P[i * 2 + 1] - h); ctx.closePath();
    ctx.fillStyle = top; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Isshiki's Daikokuten cube: black faces, gold rim and a gold seal on top.
  function blackCube(ctx, x, y, s, rot, alpha, hgt) {
    drawCube(ctx, x, y, s, rot, alpha, '#1b1822', '#2c2836', '#d9a650', hgt);
    const h = hgt == null ? s * 1.5 : hgt;
    ctx.globalAlpha = alpha * .8; ctx.strokeStyle = '#f7c16d'; ctx.lineWidth = Math.max(1.5, s * .03);
    ctx.beginPath(); ctx.ellipse(x, y - h, s * .55, s * .28, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - h, s * .3, s * .15, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function craterG(ctx, x, y, r, alpha, seed) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6e5a46'; ctx.beginPath(); ctx.ellipse(x, y, r * .86, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c231c'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .68, r * .34, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1f18'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = hash(i * 4.7 + seed) * TAU, b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.moveTo(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .35);
      ctx.lineTo(x + Math.cos(b) * r * 1.05, y + Math.sin(b) * r * .55);
      ctx.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * .66);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function dustBurst(ctx, x, y, r, t, seed, kind = 'dust', n = 12) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.3), a0 = 1 - win(t, .7, 2.2);
    if (a0 <= 0) return;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i + seed) * .4, d = r * (.35 + e * (.6 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - 10 - hash(i * 4.4) * r * .12, r * (.11 + e * (.08 + hash(i * 6.1) * .08)), a0 * .8, .75);
    }
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.2, t / 1.1, seed, '#3a2c22', 14);
  }
  function drawAxe(ctx, x, y, rot, s, alpha) {
    if (alpha <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    ctx.drawImage(axeSprite(), -100 * s, -340 * s, 200 * s, 360 * s);
    ctx.restore();
  }
  function spriteAt(ctx, img, x, y, w, h, rot, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ------------------------------------------------------------------ Momoshiki
  function absorbG(ctx, fx, time, z) {
    const K = Kit(), a = Math.min(1, fx.age * 4) * (1 - win(fx.age, fx.dur - .4, fx.dur));
    const sw = K.swirl('ot:absorb', ['rgba(255,140,120,.85)', 'rgba(190,120,255,.8)', 'rgba(255,220,210,.8)'], 7, 1.4, .08, 256, 4);
    K.spin(ctx, sw, z.x, z.y, 420, -time * 3, .55 * a, .5);
    ctx.strokeStyle = `rgba(255,140,120,${.5 * a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(z.x, z.y, 420, 0, TAU); ctx.stroke();
  }
  function absorbO(ctx, fx, time, z) {
    const K = Kit(), a = Math.min(1, fx.age * 4) * (1 - win(fx.age, fx.dur - .4, fx.dur)), lift = bodyLift(z);
    const hx = z.x + 22, hy = z.y - lift - 44;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, hx, hy, 70, '255,140,140', .7 * a, true);
    K.glow(ctx, hx, hy, 140, '180,120,255', .35 * a);
    // chakra streams spiralling into the palm
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const ph = (time * 1.3 + i / 9) % 1, ang = i / 9 * TAU + time * 2, d = 360 * (1 - ph);
      const x = z.x + Math.cos(ang + ph * 2) * d, y = z.y + Math.sin(ang + ph * 2) * d * .5 - 20;
      ctx.strokeStyle = `rgba(255,${150 + i * 8},${140 + i * 10},${.7 * a * bell(ph)})`; ctx.lineWidth = 5 * (1 - ph) + 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, hx, .25), lerp(y, hy, .25)); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(166,60,67,${.9 * a})`; ctx.lineWidth = 2;
    for (let r = 5; r < 18; r += 5) { ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.stroke(); }
  }
  function rasenPos(fx) { return Math.min(fx.len, fx.age * fx.speed); }
  function rasenG(ctx, fx, time) {
    const d = rasenPos(fx), travel = fx.len / fx.speed, ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    if (fx.age < travel) {
      ctx.fillStyle = 'rgba(10,20,40,.3)'; ctx.beginPath(); ctx.ellipse(fx.x + ca * d, fx.y + sa * d, 70, 26, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,190,255,.25)'; ctx.lineWidth = 50; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x + ca * Math.max(0, d - 220), fx.y + sa * Math.max(0, d - 220)); ctx.lineTo(fx.x + ca * d, fx.y + sa * d); ctx.stroke();
      markCircle(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, fx.r, '120,190,255', d / fx.len, time, false);
    } else {
      craterG(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, fx.r * .75, 1 - win(fx.age, fx.dur - .6, fx.dur), fx.seed);
    }
  }
  function rasenO(ctx, fx, time) {
    const K = Kit(), d = rasenPos(fx), travel = fx.len / fx.speed, ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    if (fx.age < travel) {
      const x = fx.x + ca * d, y = fx.y + sa * d - 56;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 3; i++) K.glow(ctx, x - ca * i * 40, y - sa * i * 40, 60 - i * 10, '80,160,255', .35 - i * .08);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(x, y); K.fx.rasenganOrb(ctx, 52, time, 1); ctx.restore();
    } else {
      const u = (fx.age - travel) / 1.2, ex = fx.x + ca * fx.len, ey = fx.y + sa * fx.len;
      if (u < 1) {
        K.fx.windDome(ctx, ex, ey, fx.r, u, 1 - u, time, false);
        K.fx.shockRing(ctx, ex, ey, fx.r * 1.4, u * 1.2, 1 - u, '140,200,255');
      }
      dustBurst(ctx, ex, ey, fx.r, fx.age - travel, fx.seed, 'dust', 12);
    }
  }
  function mrodsG(ctx, fx, time) {
    for (const ln of fx.lines) {
      if (fx.age < ln.tf && fx.age >= ln.tm) teleShape(ctx, { k: 'line', x: ln.x, y: ln.y, a: ln.a, len: ln.len, w: 24 }, '255,120,110', (fx.age - ln.tm) / (ln.tf - ln.tm), time);
    }
  }
  function mrodsO(ctx, fx, time) {
    const K = Kit(), img = rodSprite(), L = LIFT();
    for (const ln of fx.lines) {
      const t = fx.age - ln.tf;
      if (t < 0) continue;
      const d = Math.min(ln.len, 60 + t * 1900), stuck = t - (ln.len - 60) / 1900, a = 1 - win(stuck, .9, 1.4);
      if (a <= 0) continue;
      const x = ln.x + Math.cos(ln.a) * d, y = ln.y + Math.sin(ln.a) * d - L * (stuck > 0 ? .4 : 1);
      if (stuck < 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,110,100,.45)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - Math.cos(ln.a) * 160, y - Math.sin(ln.a) * 160); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      spriteAt(ctx, img, x - Math.cos(ln.a) * 60, y - Math.sin(ln.a) * 60, 14, 130, ln.a + Math.PI / 2, a);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 22, '255,120,110', .7 * a, true); ctx.globalCompositeOperation = 'source-over';
    }
  }
  function fistG(ctx, fx, time) {
    if (fx.age < fx.fall) {
      const k = fx.age / fx.fall;
      ctx.fillStyle = `rgba(30,10,10,${.3 + .35 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * (.6 + .3 * k), fx.r * (.3 + .15 * k), 0, 0, TAU); ctx.fill();
      markCircle(ctx, fx.x, fx.y, fx.r, '255,150,120', 1, time, false);
    } else craterG(ctx, fx.x, fx.y, fx.r, 1 - win(fx.age, fx.dur - .7, fx.dur), fx.seed);
  }
  function fistO(ctx, fx, time) {
    const K = Kit(), S = fx.r * 1.4;
    if (fx.age < fx.fall + .25) {
      const k = easeIn(Math.min(1, fx.age / fx.fall)), y = lerp(fx.y - 270, fx.y - S * .35, k);
      const a = fx.age < fx.fall ? 1 : 1 - (fx.age - fx.fall) / .25;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, y, S * .9, '255,120,100', .4 * a); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a; ctx.drawImage(fistSprite(), fx.x - S / 2, y - S / 2, S, S); ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,220,210,${.6 * a})`; ctx.lineWidth = 3;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const ox = (i - 2.5) * S * .16; ctx.moveTo(fx.x + ox, y - S * .5 - 30); ctx.lineTo(fx.x + ox, y - S * .5 - 120 - hash(i) * 60); } ctx.stroke();
    }
    if (fx.age > fx.fall) {
      const u = fx.age - fx.fall;
      ctx.globalCompositeOperation = 'lighter';
      if (u < .25) K.glow(ctx, fx.x, fx.y - 40, fx.r * 1.8, '255,200,180', 1 - u / .25, true);
      ctx.globalCompositeOperation = 'source-over';
      if (u < 1) { K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.6, u, 1 - u, '255,150,130'); if (u > .12) K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 2, u - .12, (1 - u) * .7, '255,230,220'); }
      dustBurst(ctx, fx.x, fx.y, fx.r * 1.1, u, fx.seed, 'dust', 14);
    }
  }
  function katonFront(fx) { return Math.min(fx.reach, fx.age * fx.speed); }
  function katonG(ctx, fx, time) {
    const K = Kit(), front = katonFront(fx), rolling = front < fx.reach, fade = 1 - win(fx.age, fx.dur - 1.0, fx.dur);
    ctx.globalAlpha = Math.min(1, fade * 1.5);
    ctx.fillStyle = 'rgba(40,16,6,.45)'; sector(ctx, fx.x, fx.y, 0, front, fx.a - fx.half, fx.a + fx.half); ctx.fill();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(214,62,16,.5)'; sector(ctx, fx.x, fx.y, 20, front * .97, fx.a - fx.half * .95, fx.a + fx.half * .95); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,40,.35)'; sector(ctx, fx.x, fx.y, 40, front * .9, fx.a - fx.half * .8, fx.a + fx.half * .8); ctx.fill();
    for (const p of fx.pts) {
      if (p.d > front || (rolling && p.d > front - 90)) continue;
      const h = p.s * easeOut((fx.age - p.d / fx.speed) * 3) * fade * (.85 + .15 * Math.sin(time * 12 + p.d));
      if (h > 4) ctx.drawImage(K.flame((p.i + Math.floor(time * 11)) % 6), p.x - h * .22, p.y - h * FB, h * .44, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const d = front * (i + .5) / 5; K.glow(ctx, fx.x + Math.cos(fx.a) * d, fx.y + Math.sin(fx.a) * d - 14, 40 + d * .3, '255,130,40', .28 * fade, false, .6); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function katonO(ctx, fx, time) {
    const K = Kit(), front = katonFront(fx);
    if (front < fx.reach) {
      const grow = .55 + .45 * Math.min(1, front / 260), n = 16;
      for (let row = 1; row >= 0; row--) for (let i = 0; i < n; i++) {
        const u = (i + row * .5) / n, aa = fx.a + (u * 2 - 1) * fx.half * .95, d = front - row * 34 - hash(i * 3.3 + row) * 16;
        if (d < 30) continue;
        const h = (90 + hash(i * 7.1 + row) * 50) * grow * (1 - row * .2) * (.88 + .12 * Math.sin(time * 15 + i * 1.7));
        ctx.drawImage(K.flame((i + row * 3 + Math.floor(time * 13)) % 6), fx.x + Math.cos(aa) * d - h * .26, fx.y + Math.sin(aa) * d - h * FB, h * .52, h);
      }
      const fire = K.puff('fire'), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
      for (let i = 0; i < 7; i++) { const k = i / 6, d = Math.min(front, 200) * k; K.stamp(ctx, fire, fx.x + ca * d, fx.y + sa * d - 50 + k * 30, 16 + k * 22, .9); }
    }
    if (fx.age > fx.dur - 2) {
      const smoke = K.puff('smoke'), s = win(fx.age, fx.dur - 2, fx.dur);
      for (let i = 0; i < fx.pts.length; i += 9) { const p = fx.pts[i]; K.stamp(ctx, smoke, p.x, p.y - 30 - s * 70, 22 + s * 22, bell(s) * .5); }
    }
  }
  function superG(ctx, fx, time) {
    if (fx.age < fx.fly) {
      const k = fx.age / fx.fly;
      ctx.fillStyle = `rgba(30,10,40,${.2 + .35 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.R * (.4 + .5 * k), fx.R * (.2 + .25 * k), 0, 0, TAU); ctx.fill();
      markCircle(ctx, fx.x, fx.y, fx.R, '200,150,255', 1, time, false);
    } else craterG(ctx, fx.x, fx.y, fx.R * .8, 1 - win(fx.age, fx.dur - .8, fx.dur), fx.seed);
  }
  function superO(ctx, fx, time) {
    const K = Kit();
    if (fx.age < fx.fly) {
      const k = easeIn(fx.age / fx.fly), x = lerp(fx.x0, fx.x, k), y = lerp(fx.y0, fx.y - 60, k) - Math.sin(Math.PI * k) * 120;
      drawMegaOrb(ctx, x, y, 110, time, 1);
    } else {
      const u = fx.age - fx.fly, k = u / 1.4;
      if (k < 1) {
        K.fx.windDome(ctx, fx.x, fx.y, fx.R, k, 1 - k, time, false);
        K.fx.beastBlast(ctx, fx.x, fx.y, fx.R * .8, k, 1 - k, time, fx.seed);
      }
      ctx.globalCompositeOperation = 'lighter';
      if (u < .3) K.glow(ctx, fx.x, fx.y - 60, fx.R * 1.5, '240,220,255', 1 - u / .3, true);
      ctx.globalCompositeOperation = 'source-over';
      dustBurst(ctx, fx.x, fx.y, fx.R, u, fx.seed, 'dust', 16);
    }
  }
  // The giant orb Momoshiki returns: a Rasengan core wrapped in his own violet-red chakra.
  function drawMegaOrb(ctx, x, y, r, time, a) {
    const K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 2.2, '190,120,255', .45 * a);
    K.glow(ctx, x, y, r * 1.5, '255,120,120', .35 * a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(x, y); K.fx.rasenganOrb(ctx, r * .8, time, a); ctx.restore();
    const sw = K.swirl('ot:mega', ['rgba(255,150,140,.9)', 'rgba(200,140,255,.9)', 'rgba(255,240,240,.9)'], 6, 1.2, .2, 256, 4);
    K.spin(ctx, sw, x, y, r * 1.15, time * 6, .8 * a);
  }

  // ------------------------------------------------------------------ Kinshiki
  function axeG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    if (fx.age < .16) return;
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), k = easeOut((fx.age - .16) / .25), len = fx.len * k;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(30,12,16,${.6 * fade})`; ctx.lineWidth = 14;
    ctx.beginPath();
    for (let d = 0; d <= len; d += 40) { const o = (hash(Math.floor(d / 40) + fx.seed) - .5) * 26; ctx.lineTo(fx.x + ca * d - sa * o, fx.y + sa * d + ca * o); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,70,90,${.7 * fade})`; ctx.lineWidth = 5; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    if (k >= 1) craterG(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, fx.r, fade, fx.seed);
  }
  function axeO(ctx, fx, time) {
    const K = Kit(), sw = easeIn(fx.age / .16), fade = 1 - win(fx.age, .55, 1.0);
    const rot1 = fx.a + Math.PI / 2, rot0 = rot1 - fx.side * 2.6, rot = lerp(rot0, rot1, sw), px = fx.x, py = fx.y - 44;
    if (fade > 0) {
      if (fx.age < .3) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,80,100,${.35 * (1 - fx.age / .3)})`;
        const a0 = Math.min(rot0, rot) - Math.PI / 2, a1 = Math.max(rot0, rot) - Math.PI / 2;
        sector(ctx, px, py, 100, 380, a0, a1); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      drawAxe(ctx, px, py, rot, 1.1, fade);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, px + Math.cos(rot - Math.PI / 2) * 300, py + Math.sin(rot - Math.PI / 2) * 300, 110, '255,80,100', .45 * fade);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fx.age > .16) {
      const u = fx.age - .16, ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
      if (u < .9) K.fx.shockRing(ctx, ex, ey, fx.r * 1.5, u / .9, 1 - u / .9, '255,110,120');
      dustBurst(ctx, ex, ey, fx.r, u, fx.seed, 'dust', 12);
      ctx.globalCompositeOperation = 'lighter';
      if (u < .2) K.glow(ctx, ex, ey - 30, fx.r * 1.4, '255,180,190', 1 - u / .2, true);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function spearsG(ctx, fx, time) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) markCircle(ctx, it.x, it.y, 62, '255,90,100', t / it.fl, time, false);
      else { const a = 1 - win(t - it.fl, 1.0, 1.6); ctx.fillStyle = `rgba(30,12,16,${.45 * a})`; ctx.beginPath(); ctx.ellipse(it.x, it.y, 34, 15, 0, 0, TAU); ctx.fill(); }
    }
  }
  function spearsO(ctx, fx, time) {
    const K = Kit(), img = spearSprite(), ang = Math.atan2(420, 170);
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const k = Math.min(1, easeIn(t / it.fl)), a = 1 - win(t - it.fl, 1.0, 1.6);
      if (a <= 0) continue;
      const x = lerp(it.x - 170, it.x, k), y = lerp(it.y - 420, it.y, k);
      if (k < 1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,80,100,.4)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 60, y - 150); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      spriteAt(ctx, img, x - Math.cos(ang) * 60, y - Math.sin(ang) * 60, 20, 120, ang - Math.PI / 2 + Math.PI, a);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 30, '255,80,100', (k < 1 ? .6 : .35) * a); ctx.globalCompositeOperation = 'source-over';
      if (k >= 1 && t - it.fl < .4) K.fx.shockRing(ctx, it.x, it.y, 90, (t - it.fl) / .4, 1 - (t - it.fl) / .4, '255,110,120');
    }
  }
  function bladesG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .4, fx.dur);
    ctx.fillStyle = `rgba(40,10,20,${.22 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(30,10,14,${.4 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) { const a = hash(i + fx.seed) * TAU, r0 = fx.R * (.3 + hash(i * 2) * .4); ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y + Math.sin(a) * r0); ctx.lineTo(fx.x + Math.cos(a + .3) * (r0 + 60), fx.y + Math.sin(a + .3) * (r0 + 60)); }
    ctx.stroke();
  }
  function bladesO(ctx, fx, time) {
    const K = Kit(), grow = easeOut(fx.age / .3), fade = 1 - win(fx.age, fx.dur - .35, fx.dur), cy = fx.y - LIFT();
    ctx.globalCompositeOperation = 'lighter';
    for (let ring = 0; ring < 3; ring++) {
      const rr = fx.R * (.35 + .3 * ring) * grow, spin = fx.age * (9 - ring * 2) * (ring % 2 ? -1 : 1);
      ctx.strokeStyle = `rgba(255,80,100,${.28 * fade})`; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.ellipse(fx.x, cy, rr, rr * .6, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = spin + i * TAU / 4 + ring;
        ctx.strokeStyle = `rgba(255,200,210,${.85 * fade})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(fx.x, cy, rr, rr * .6, 0, a, a + .9); ctx.stroke();
        ctx.strokeStyle = `rgba(255,70,90,${.7 * fade})`; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.ellipse(fx.x, cy, rr, rr * .6, 0, a + .1, a + .7); ctx.stroke();
      }
    }
    K.glow(ctx, fx.x, cy, 90, '255,90,110', .5 * fade);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) drawAxe(ctx, fx.x, cy - 10, fx.age * 14 + i * TAU / 3, .55, .85 * fade);
  }
  function kstreakG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.strokeStyle = `rgba(30,12,16,${.35 * fade})`; ctx.lineWidth = fx.w * .8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
  }
  function kstreakO(ctx, fx, time, z) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .7, fx.dur), L = LIFT();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,70,90,${.4 * fade})`; ctx.lineWidth = fx.w * .9;
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0 - L); ctx.lineTo(fx.x1, fx.y1 - L); ctx.stroke();
    ctx.strokeStyle = `rgba(255,220,225,${.75 * fade})`; ctx.lineWidth = 6; ctx.stroke();
    for (let i = 1; i <= 4; i++) { const k = i / 5; K.glow(ctx, lerp(fx.x0, fx.x1, k), lerp(fx.y0, fx.y1, k) - L, fx.w, '255,80,100', .3 * fade); }
    ctx.globalCompositeOperation = 'source-over';
    if (z.ot && z.ot.dash && z.ot.dash.fx === fx) drawAxe(ctx, z.x, z.y - 40, fx.a + Math.PI / 2, .8, 1);
  }
  function kslashO(ctx, fx, time) {
    const K = Kit(), u = fx.age / fx.dur, cy = fx.y - LIFT();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,90,110,${.4 * (1 - u)})`; sector(ctx, fx.x, cy, fx.r * .3, fx.r, fx.a - 1.3, fx.a + 1.3); ctx.fill();
    ctx.strokeStyle = `rgba(255,240,240,${1 - u})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(fx.x, cy, fx.r, fx.a - 1.3, fx.a + 1.3); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.4, u, 1 - u, '255,110,120');
  }
  function giantAxeG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.strokeStyle = `rgba(40,10,16,${.45 * fade})`; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * .92, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * .6, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(40,10,16,${.15 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R, 0, TAU); ctx.fill();
  }
  function giantAxeO(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .45, fx.dur), spinT = Math.min(fx.age, 1.0);
    const ang = -Math.PI / 2 + fx.side * spinT * TAU * 2, cy = fx.y - LIFT(), s = fx.R / 340;
    // a giant chakra avatar looms behind him
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, cy - 80, 220, '255,60,90', .35 * fade);
    const a0 = fx.side > 0 ? ang - 1.9 : ang, a1 = fx.side > 0 ? ang : ang + 1.9;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(200,30,56,${.3 * fade})`; sector(ctx, fx.x, cy, fx.R * .2, fx.R, a0, a1); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,60,80,${.4 * fade})`; sector(ctx, fx.x, cy, fx.R * .2, fx.R, a0, a1); ctx.fill();
    ctx.fillStyle = `rgba(255,170,180,${.4 * fade})`; sector(ctx, fx.x, cy, fx.R * .7, fx.R, fx.side > 0 ? ang - .8 : ang, fx.side > 0 ? ang : ang + .8); ctx.fill();
    K.glow(ctx, fx.x + Math.cos(ang) * fx.R * .8, cy + Math.sin(ang) * fx.R * .8, 160, '255,90,110', .6 * fade);
    ctx.strokeStyle = `rgba(255,235,240,${.85 * fade})`; ctx.lineWidth = 6;
    ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(fx.x, cy, fx.R, a0, a1); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU, h = 120 * (.8 + .2 * Math.sin(time * 11 + i)) * fade;
      if (h > 5) { ctx.globalAlpha = .75; ctx.drawImage(K.flame((i + Math.floor(time * 12)) % 6, KFLAME, 'k'), fx.x + Math.cos(a) * 54 - h * .22, fx.y + Math.sin(a) * 26 - h * FB, h * .44, h); }
    }
    ctx.globalAlpha = 1;
    if (fx.age < 1.05) drawAxe(ctx, fx.x, cy, ang + Math.PI / 2, s, .92 * fade);
    for (const t0 of [.1, .6]) {
      const u = fx.age - t0;
      if (u > 0 && u < .8) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.3, u / .8, 1 - u / .8, '255,110,130');
    }
  }

  // ------------------------------------------------------------------ Isshiki
  function irodsG(ctx, fx, time) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) markCircle(ctx, it.x, it.y, 70, '247,193,109', t / it.fl, time, false);
      else { const a = 1 - win(t - it.fl, 1.2, 1.8); ctx.fillStyle = `rgba(20,14,10,${.5 * a})`; ctx.beginPath(); ctx.ellipse(it.x, it.y, 40, 17, 0, 0, TAU); ctx.fill(); }
    }
  }
  function irodsO(ctx, fx, time) {
    const K = Kit(), img = rodSprite(), ang = Math.atan2(460, -120);
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const k = Math.min(1, easeIn(t / it.fl)), a = 1 - win(t - it.fl, 1.2, 1.8);
      if (a <= 0) continue;
      const sc = .25 + .75 * easeOut(t / it.fl), x = lerp(it.x + 120, it.x, k), y = lerp(it.y - 460, it.y, k);
      const len = 190 * sc, w = 20 * sc;
      spriteAt(ctx, img, x - Math.cos(ang) * len * .4, y - Math.sin(ang) * len * .4, w, len, ang - Math.PI / 2 + Math.PI, a);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 26 * sc + 8, '247,193,109', (k < 1 ? .5 : .25) * a); ctx.globalCompositeOperation = 'source-over';
      const u = t - it.fl;
      if (u > 0 && u < .9) dustBurst(ctx, it.x, it.y, 70, u, it.seed, 'dust', 6);
    }
  }
  function cubesG(ctx, fx, time) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) {
        const k = t / it.fl;
        ctx.fillStyle = `rgba(10,8,14,${.2 + .4 * k})`; ctx.beginPath(); ctx.ellipse(it.x, it.y, 120 * (.5 + .5 * k), 60 * (.5 + .5 * k), 0, 0, TAU); ctx.fill();
        markCircle(ctx, it.x, it.y, 130, '247,193,109', 1, time, false);
      } else {
        const u = t - it.fl, a = 1 - win(u, 1.0, 1.6);
        craterG(ctx, it.x, it.y, 120, 1 - win(u, 1.3, 1.9), it.seed);
        if (a > 0) blackCube(ctx, it.x, it.y + win(u, 1.0, 1.6) * 60, 92, .25 + it.seed, a, 140 * (1 - win(u, 1.0, 1.6) * .6));
      }
    }
  }
  function cubesO(ctx, fx, time) {
    const K = Kit();
    const list = fx.items.slice().sort((p, q) => p.y - q.y);
    for (const it of list) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const k = Math.min(1, easeIn(t / it.fl)), u = t - it.fl;
      if (u > 1.6) continue;
      const drop = (1 - k) * 560;
      if (k < 1) blackCube(ctx, it.x, it.y - drop, 92, .25 + it.seed, 1, 140);
      if (k < 1) {
        ctx.strokeStyle = 'rgba(255,230,180,.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); for (let i = 0; i < 4; i++) { const ox = (i - 1.5) * 50; ctx.moveTo(it.x + ox, it.y - drop - 160); ctx.lineTo(it.x + ox, it.y - drop - 300); } ctx.stroke();
      }
      if (u > 0 && u < .8) K.fx.shockRing(ctx, it.x, it.y, 200, u / .8, 1 - u / .8, '247,193,109');
      if (u > 0) dustBurst(ctx, it.x, it.y, 130, u, it.seed, 'dust', 10);
    }
  }
  function shrinkO(ctx, fx, time) {
    const K = Kit(), img = rodSprite(), L = LIFT();
    for (const ln of fx.lines) {
      const d = Math.min(ln.len, fx.age * fx.speed), k = d / ln.len, stuck = fx.age - ln.len / fx.speed, a = 1 - win(stuck, .6, 1.2);
      if (a <= 0) continue;
      const sc = .12 + 1.1 * easeOut(k), x = ln.x + Math.cos(ln.a) * d, y = ln.y + Math.sin(ln.a) * d - L * (stuck > 0 ? .3 : 1);
      if (stuck < 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(247,193,109,.4)'; ctx.lineWidth = 4 + 10 * sc; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - Math.cos(ln.a) * 120 * sc, y - Math.sin(ln.a) * 120 * sc); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      spriteAt(ctx, img, x - Math.cos(ln.a) * 70 * sc, y - Math.sin(ln.a) * 70 * sc, 18 * sc, 150 * sc, ln.a + Math.PI / 2, a);
    }
  }
  function shrinkG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.strokeStyle = `rgba(30,22,14,${.35 * fade})`; ctx.lineCap = 'round';
    for (const ln of fx.lines) {
      const d = Math.min(ln.len, fx.age * fx.speed);
      ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(ln.x, ln.y); ctx.lineTo(ln.x + Math.cos(ln.a) * d, ln.y + Math.sin(ln.a) * d); ctx.stroke();
    }
  }
  function pillarsG(ctx, fx, time) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) markCircle(ctx, it.x, it.y, 85, '247,193,109', t / it.fl, time, false);
      else { const u = t - it.fl, a = 1 - win(u, .8, 1.5); craterG(ctx, it.x, it.y, 80, 1 - win(u, 1.2, 1.8), it.t0 * 9); if (a > 0) blackCube(ctx, it.x, it.y, 50, .4, a, 300 * (1 - win(u, .8, 1.5) * .7)); }
    }
  }
  function pillarsO(ctx, fx, time) {
    const K = Kit(), list = fx.items.slice().sort((p, q) => p.y - q.y);
    for (const it of list) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const k = Math.min(1, easeIn(t / it.fl)), u = t - it.fl;
      if (u > 1.6) continue;
      if (k < 1) blackCube(ctx, it.x, it.y - (1 - k) * 640, 50, .4, 1, 300);
      if (u > 0 && u < .7) K.fx.shockRing(ctx, it.x, it.y, 140, u / .7, 1 - u / .7, '247,193,109');
      if (u > 0) dustBurst(ctx, it.x, it.y, 90, u, it.t0 * 7, 'dust', 7);
    }
  }
  function crashG(ctx, fx, time) {
    if (fx.age < fx.fall) {
      const k = easeIn(fx.age / fx.fall);
      ctx.fillStyle = `rgba(8,6,12,${.2 + .5 * k})`;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.R * (.4 + .55 * k), fx.R * (.2 + .28 * k), 0, 0, TAU); ctx.fill();
      markCircle(ctx, fx.x, fx.y, fx.R, '255,210,120', 1, time, false);
    } else {
      const u = fx.age - fx.fall, a = 1 - win(u, 1.0, 1.7), S = fx.R * .62;
      craterG(ctx, fx.x, fx.y, fx.R, 1 - win(fx.age, fx.dur - .9, fx.dur), fx.seed);
      if (a > 0) blackCube(ctx, fx.x, fx.y + S * .3 + win(u, 1.0, 1.7) * 100, S, .3 + fx.seed, a, S * 1.1 * (1 - win(u, 1.0, 1.7) * .6));
    }
  }
  function crashO(ctx, fx, time) {
    const K = Kit(), S = fx.R * .62;
    if (fx.age < fx.fall) {
      const k = Math.min(1, easeIn(fx.age / fx.fall)), drop = (1 - k) * 700;
      blackCube(ctx, fx.x, fx.y - drop + S * .3, S, .3 + fx.seed, 1, S * 1.1);
      if (k < 1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,220,150,${.5})`; ctx.lineWidth = 4;
        ctx.beginPath(); for (let i = 0; i < 8; i++) { const ox = (i - 3.5) * S * .28; ctx.moveTo(fx.x + ox, fx.y - drop - S * 1.6); ctx.lineTo(fx.x + ox, fx.y - drop - S * 1.6 - 200 - hash(i) * 120); } ctx.stroke();
        K.glow(ctx, fx.x, fx.y - drop - S * .5, S * 1.5, '255,190,90', .25);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (fx.age > fx.fall) {
      const u = fx.age - fx.fall;
      ctx.globalCompositeOperation = 'lighter';
      if (u < .3) K.glow(ctx, fx.x, fx.y - 60, fx.R * 1.8, '255,230,170', 1 - u / .3, true);
      ctx.globalCompositeOperation = 'source-over';
      if (u < 1.1) { K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.5, u / 1.1, 1 - u / 1.1, '247,193,109'); if (u > .15) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.9, (u - .15) / .95, (1 - u / 1.1) * .7, '255,240,210'); }
      dustBurst(ctx, fx.x, fx.y, fx.R * 1.1, u, fx.seed, 'dust', 18);
    }
  }

  // ------------------------------------------------------------------ Kaguya
  function bonesG(ctx, fx, time) {
    const end = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.fillStyle = `rgba(30,24,40,${.4 * end})`;
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < -.25) continue;
      if (t < 0) { ctx.globalAlpha = (t + .25) / .25; ctx.beginPath(); ctx.ellipse(it.x, it.y, 26, 11, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; continue; }
      ctx.beginPath(); ctx.ellipse(it.x, it.y + 2, 30, 12, 0, 0, TAU); ctx.fill();
    }
  }
  function bonesO(ctx, fx, time) {
    const K = Kit(), ash = K.puff('poof'), end = win(fx.age, fx.dur - .7, fx.dur);
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const g = easeOut(t / .12) * (1 - end * .5), s = it.h;
      if (g <= .01) continue;
      ctx.save(); ctx.globalAlpha = 1 - end; ctx.translate(it.x, it.y + 4); if (it.flip) ctx.scale(-1, 1);
      ctx.drawImage(boneSprite(it.v), -BW / 2 * s, -BH * s * g, BW * s, BH * s * g);
      ctx.restore();
      if (t < .5) K.stamp(ctx, ash, it.x, it.y - 6 - t * 30, 14 + t * 30, (1 - t / .5) * .55, .7);
    }
    if (end > 0) {
      const smoke = K.puff('smoke');
      for (let i = 0; i < fx.items.length; i += 4) { const it = fx.items[i]; K.stamp(ctx, smoke, it.x, it.y - 40 - end * 50, 18 + end * 20, bell(end) * .35); }
    }
  }
  function drawPortal(ctx, x, y, open, time, seed) {
    if (open <= .01) return;
    const K = Kit(), rx = 34 * open, ry = 62 * open, cy = y - 64;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, cy, 110 * open, '170,120,255', .5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0a0612'; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a0 = time * (3 + i) + i * 1.7 + seed;
      ctx.strokeStyle = i % 2 ? 'rgba(205,169,255,.9)' : 'rgba(255,240,255,.85)';
      ctx.beginPath(); ctx.ellipse(x, cy, rx * (1 - i * .16), ry * (1 - i * .16), 0, a0, a0 + 2.2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,100,230,.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  }
  function portalO(ctx, fx, time) {
    const open = 1 - win(fx.age, fx.dur - .35, fx.dur);
    for (const p of fx.portals) {
      drawPortal(ctx, p.x, p.y, open, time, p.x * .01);
      const k = fx.age < .12 ? easeOut(fx.age / .12) : 1 - easeIn((fx.age - .45) / .4), len = p.len * clamp01(k);
      if (len < 4) continue;
      const ca = Math.cos(p.a), sa = Math.sin(p.a), nx = -sa, ny = ca, bx = p.x + ca * 20, by = p.y - 50 + sa * 20;
      const tx = bx + ca * len, ty = by + sa * len;
      ctx.beginPath();
      ctx.moveTo(bx + nx * 24, by + ny * 24); ctx.quadraticCurveTo(bx + ca * len * .5 + nx * 16, by + sa * len * .5 + ny * 16, tx, ty);
      ctx.quadraticCurveTo(bx + ca * len * .5 - nx * 16, by + sa * len * .5 - ny * 16, bx - nx * 24, by - ny * 24); ctx.closePath();
      ctx.fillStyle = '#efe9f4'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5a4a6e'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + nx * 6, by + ny * 6); ctx.lineTo(tx, ty); ctx.lineTo(bx + nx * 20, by + ny * 20); ctx.closePath();
      ctx.fillStyle = 'rgba(160,140,190,.55)'; ctx.fill();
    }
  }
  function kushoG(ctx, fx) {
    const fade = 1 - win(fx.age, .4, fx.dur);
    ctx.fillStyle = `rgba(30,30,50,${.22 * fade})`; sector(ctx, fx.x, fx.y, 30, fx.r * Math.min(1, fx.age * 4), fx.a - fx.h, fx.a + fx.h); ctx.fill();
  }
  function kushoO(ctx, fx, time) {
    const K = Kit(), k = easeOut(fx.age / .3), fade = 1 - win(fx.age, .55, fx.dur), ca = Math.cos(fx.a), sa = Math.sin(fx.a), L = LIFT();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const d = fx.r * clamp01(k - i * .1);
      if (d < 20) continue;
      ctx.strokeStyle = `rgba(230,236,255,${(.7 - i * .12) * fade})`; ctx.lineWidth = 6 - i;
      ctx.beginPath(); ctx.arc(fx.x, fx.y - L, d, fx.a - fx.h * .95, fx.a + fx.h * .95); ctx.stroke();
    }
    ctx.fillStyle = `rgba(200,215,255,${.18 * fade})`; sector(ctx, fx.x, fx.y - L, 20, fx.r * k, fx.a - fx.h, fx.a + fx.h); ctx.fill();
    K.glow(ctx, fx.x + ca * fx.r * k * .6, fx.y + sa * fx.r * k * .6 - L, 140, '220,230,255', .4 * fade);
    ctx.globalCompositeOperation = 'source-over';
    // the giant palm print pushing out
    const pd = 60 + fx.r * .55 * k, ps = .9 + 1.3 * k;
    ctx.save(); ctx.translate(fx.x + ca * pd, fx.y + sa * pd - L - 30); ctx.rotate(fx.a + Math.PI / 2); ctx.globalAlpha = .85 * fade;
    ctx.drawImage(palmSprite(), -100 * ps, -120 * ps, 200 * ps, 240 * ps);
    ctx.restore();
    const dust = K.puff('dust');
    for (let i = 0; i < 7; i++) {
      const aa = fx.a + (i / 6 - .5) * 2 * fx.h * .9, d = fx.r * k;
      K.stamp(ctx, dust, fx.x + Math.cos(aa) * d, fx.y + Math.sin(aa) * d - 8, 22 + 16 * k, .6 * fade, .7);
    }
  }
  function iceG(ctx, fx, time) {
    const K = Kit(), grow = easeOut(fx.age / .25), fade = 1 - win(fx.age, fx.dur - .9, fx.dur), R = fx.R * (.6 + .4 * grow);
    ctx.globalAlpha = .8 * fade;
    ctx.drawImage(iceDisc(), fx.x - R, fx.y - R, R * 2, R * 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(170,120,255,${.7 * fade})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, R, 0, TAU); ctx.stroke();
  }
  function iceO(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .9, fx.dur), frost = K.puff('poof');
    for (const sp of fx.spikes) {
      const t = fx.age - sp.t0;
      if (t < 0) continue;
      const g = easeOut(t / .12) * (1 - win(fx.age, fx.dur - .9, fx.dur) * .6), s = sp.h;
      ctx.globalAlpha = fade;
      ctx.drawImage(crystalSprite(sp.v), sp.x - 50 * s, sp.y + 4 - 140 * s * g, 100 * s, 140 * s * g);
      ctx.globalAlpha = 1;
      if (t < .6) K.stamp(ctx, frost, sp.x, sp.y - 10 - t * 20, 14 + t * 30, (1 - t / .6) * .6, .7);
    }
    ctx.globalCompositeOperation = 'lighter';
    const tw = hash(Math.floor(time * 6) + fx.seed);
    K.glow(ctx, fx.x + (tw - .5) * fx.R, fx.y - 40, 50, '230,250,255', .3 * fade);
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age < .8) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.2, fx.age / .8, 1 - fx.age / .8, '190,230,255');
  }
  function tsbRho(fx) { return fx.R * easeOut(Math.min(1, fx.age / fx.exp)); }
  function tsbG(ctx, fx, time) {
    const rho = tsbRho(fx), fade = 1 - win(fx.age, fx.exp + .2, fx.dur);
    ctx.fillStyle = `rgba(6,4,12,${.5 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, rho, 0, TAU); ctx.fill();
    if (fx.age > fx.exp) {
      ctx.strokeStyle = `rgba(30,20,40,${.5 * fade})`; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = hash(i + fx.seed) * TAU; ctx.moveTo(fx.x + Math.cos(a) * fx.R * .2, fx.y + Math.sin(a) * fx.R * .2); ctx.lineTo(fx.x + Math.cos(a) * fx.R * (.6 + hash(i * 3) * .4), fx.y + Math.sin(a) * fx.R * (.6 + hash(i * 3) * .4)); }
      ctx.stroke();
    }
  }
  function tsbO(ctx, fx, time) {
    const K = Kit(), rho = tsbRho(fx), fade = 1 - win(fx.age, fx.exp + .15, fx.exp + .9);
    if (fade > 0 && rho > 4) {
      ctx.globalAlpha = .62 * fade;
      ctx.drawImage(tsbSprite(), fx.x - rho, fx.y - rho * 1.05, rho * 2, rho * 1.7);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(205,169,255,${.85 * fade})`; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y - rho * .2, rho, rho * .85, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.6 * fade})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y - rho * .2, rho * .96, rho * .81, 0, 0, TAU); ctx.stroke();
      K.glow(ctx, fx.x, fx.y - rho * .2, rho * 1.25, '170,120,255', .3 * fade);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fx.age < fx.exp + .8) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.15, fx.age / (fx.exp + .8), 1 - fx.age / (fx.exp + .8), '205,169,255');
    if (fx.age > fx.exp) {
      const u = fx.age - fx.exp, ash = K.puff('smoke');
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + fx.seed, d = fx.R * (.3 + hash(i * 2.1) * .6);
        K.stamp(ctx, ash, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d - 20 - u * 60, 20 + u * 26, bell(u / 1.8) * .4);
      }
    }
  }

  const FX = {
    absorb: [absorbG, absorbO], rasen: [rasenG, rasenO], mrods: [mrodsG, mrodsO], fist: [fistG, fistO], katon: [katonG, katonO], superOrb: [superG, superO],
    axe: [axeG, axeO], spears: [spearsG, spearsO], blades: [bladesG, bladesO], kstreak: [kstreakG, kstreakO], kslash: [null, kslashO], giantAxe: [giantAxeG, giantAxeO],
    irods: [irodsG, irodsO], cubes: [cubesG, cubesO], shrink: [shrinkG, shrinkO], pillars: [pillarsG, pillarsO], crash: [crashG, crashO],
    bones: [bonesG, bonesO], portal: [null, portalO], kusho: [kushoG, kushoO], ice: [iceG, iceO], tsb: [tsbG, tsbO]
  };

  // ------------------------------------------------------------------ windup looks
  function windupOverlay(ctx, z, st, m, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, lift = bodyLift(z), cx = z.x, cy = z.y - lift - 40, id = z.bossId, mv = st.move;
    const rgb = defOf(z, mv).rgb;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, 40 + 40 * k, rgb, .45);
    ctx.globalCompositeOperation = 'source-over';
    if (id === 'momoshiki') {
      if (mv === 'rasengan') { ctx.save(); ctx.translate(cx + Math.cos(st.aim) * 30, cy - 6); K.fx.rasenganOrb(ctx, 10 + 34 * easeOut(k), time, 1); ctx.restore(); }
      else if (mv === 'super') drawMegaOrb(ctx, cx, z.y - lift - 170, 20 + 90 * easeOut(k), time, 1);
      else if (mv === 'fist') { const S = 336 * (.3 + .7 * k); ctx.globalAlpha = .35 + .3 * k; ctx.drawImage(fistSprite(), st.tx - S / 2, st.ty - 270 - S / 2, S, S); ctx.globalAlpha = 1; }
      else if (mv === 'katon') { const fire = K.puff('fire'); for (let i = 0; i < 5; i++) K.stamp(ctx, fire, cx + Math.cos(st.aim) * 20 + Math.sin(time * 9 + i) * 8, cy - 10 + Math.cos(time * 7 + i) * 6, 10 + 10 * k, .8); }
      else if (mv === 'rods') { const img = rodSprite(); for (let i = -2; i <= 2; i++) spriteAt(ctx, img, cx + i * 14, cy - 50 - Math.abs(i) * 4, 10, 90, st.aim + Math.PI / 2 + i * .09, .9); }
    } else if (id === 'kinshiki') {
      if (mv === 'axe' || mv === 'dash') drawAxe(ctx, cx, cy, -.4 * (Math.cos(st.aim) >= 0 ? 1 : -1) - (mv === 'axe' ? k * .8 * (Math.cos(st.aim) >= 0 ? 1 : -1) : 0), .9, .9);
      if (mv === 'giant') {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, cx, cy - 60, 120 + 140 * k, '255,60,90', .45);
        const fl = Kit().flame;
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 7; i++) { const h = (70 + 80 * k) * (.8 + .2 * Math.sin(time * 10 + i)); ctx.globalAlpha = .7; ctx.drawImage(fl((i + Math.floor(time * 12)) % 6, KFLAME, 'k'), cx + (i - 3) * 16 - h * .22, z.y - h * FB, h * .44, h); }
        ctx.globalAlpha = 1;
        drawAxe(ctx, cx, cy, Math.sin(time * 6) * .2, .9 + .5 * k, .9);
      }
      if (mv === 'blades' || mv === 'spears') { for (let i = 0; i < 3; i++) drawAxe(ctx, cx, cy - 10, time * 6 + i * TAU / 3, .4, .7); }
    } else if (id === 'isshiki') {
      if (mv === 'crash') { blackCube(ctx, st.tx, st.ty - 300, 30 + 60 * k, time * .8, .5 + .4 * k, (30 + 60 * k) * 1.1); }
      else if (mv === 'cubes' || mv === 'pillars') { for (let i = 0; i < 3; i++) blackCube(ctx, cx + Math.cos(time * 2 + i * 2.1) * 34, cy - 30 + Math.sin(time * 2 + i * 2.1) * 10, 6 + 4 * k, time * 2, .9, 10 + 6 * k); }
      else { const img = rodSprite(); for (let i = 0; i < 6; i++) { const a = time * 3 + i * TAU / 6; spriteAt(ctx, img, cx + Math.cos(a) * 30, cy + Math.sin(a) * 12 - 10, 4, 34, a, .9); } }
    } else if (id === 'kaguya') {
      if (mv === 'tsb') {
        const r = 12 + 62 * easeOut(k), y = z.y - lift - 150;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, cx, y, r * 2.2, '170,120,255', .45); ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tsbSprite(), cx - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = 'rgba(205,169,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, y, r + 2, 0, TAU); ctx.stroke();
      } else if (mv === 'portal' && st.portals) for (const p of st.portals) drawPortal(ctx, p.x, p.y, easeOut(k * 1.4), time, p.x * .01);
      else if (mv === 'bones') { const ash = K.puff('poof'); for (let i = 0; i < 6; i++) { const ph = (time * 1.5 + i / 6) % 1; K.stamp(ctx, ash, cx + Math.sin(i * 2.1) * 24, cy + 20 - ph * 60, 6 + 6 * (1 - ph), bell(ph) * .7); } }
      else if (mv === 'shift') { ctx.strokeStyle = `rgba(170,120,255,${.5 + .3 * Math.sin(time * 20)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy - 30, 30 + 20 * k, 50 + 20 * k, 0, 0, TAU); ctx.stroke(); }
      else if (mv === 'kusho') { ctx.save(); ctx.translate(cx + Math.cos(st.aim) * 30, cy); ctx.rotate(st.aim + Math.PI / 2); ctx.globalAlpha = .5 + .4 * k; ctx.drawImage(palmSprite(), -30, -36, 60, 72); ctx.restore(); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function iceWindup(ctx, st, time, k) {
    const R = 500 * easeOut(k);
    ctx.globalAlpha = .45 * k; ctx.drawImage(iceDisc(), st.tx - R, st.ty - R, R * 2, R * 2); ctx.globalAlpha = 1;
  }

  function bodyLift(z) {
    const m = members[z && z.bossId], st = z && z.ot;
    return m && m.lift ? m.lift + Math.sin(((st && st.t) || 0) * 2) * 4 : 0;
  }

  function label(ctx, z, st, m) {
    if (!(st.windup > 0) || !st.move) return;
    const S = window.AnimeSprites, id = S && S.has && S.has(z.bossId) ? z.bossId : 'pain';
    const top = z.y - bodyLift(z) - (S && S.height ? S.height(id) : 100) - 34, text = defOf(z, st.move).label;
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '900 15px sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = '#151017'; ctx.strokeText(text, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(text, z.x, top);
    ctx.restore();
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const member = z && members[z.bossId], st = z && z.ot;
    if (!member || !st) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = defOf(z, st.move).rgb;
      if (z.bossId === 'kaguya' && st.move === 'shift') iceWindup(ctx, st, time, k);
      for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
    }
    ctx.restore();
    // The body itself is an AnimeSprites character drawn by the game's depth-sorted pass.
  }

  function drawOverlay(ctx, z, time) {
    const member = z && members[z.bossId], st = z && z.ot;
    if (!member || !st) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0 && st.windup > 0 && st.move) { windupOverlay(ctx, z, st, member, time); label(ctx, z, st, member); }
    ctx.restore();
  }

  window.OtsutsukiBosses = { members, order, pick, update, draw, drawOverlay, bodyLift, moveLabels: labels, moves };
})();
