(() => {
  'use strict';

  // Legends of the spawn panel ("HUYỀN THOẠI"): the Shodai Kazekage Reto (Wind Release master),
  // the Nidaime Tsuchikage Mu (Dust Release, invisibility, splitting) and Six Paths Obito, the
  // Ten-Tails' jinchūriki. Same contract as kage-bosses.js: update(z, dt, api) drives the jutsu,
  // draw(ctx, z, time) paints telegraphs and ground effects, drawOverlay(ctx, z, time) what stands
  // above the characters. All per-boss state lives on z.lg; the body is an AnimeSprites character.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  const order = ['kazekage1', 'mu', 'obito_rikudo'];
  const members = {
    kazekage1: { name: 'RETO — SHODAI KAZEKAGE', accent: '#86e6cf', hpScale: 3.0, damageScale: 1.85, armor: .85, lift: 0,
      moves: ['gale', 'vacuum', 'tornado', 'blades', 'sandstorm', 'storm'] },
    mu: { name: 'MU — NIDAIME TSUCHIKAGE', accent: '#e6eefa', hpScale: 3.0, damageScale: 2.0, armor: .85, lift: 16,
      moves: ['jinton', 'boulders', 'invis', 'cubes', 'split', 'dust'] },
    obito_rikudo: { name: 'OBITO — THẬP VĨ NHÂN TRỤ LỰC', accent: '#c4b0ff', hpScale: 4.2, damageScale: 2.25, armor: .8, lift: 30,
      moves: ['orbs', 'staff', 'kamui', 'beam', 'roots', 'gaeshi', 'tbb'] }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    gale:      { label: 'PHONG ĐỘN · ĐẠI ĐỘT PHÁ', rgb: '205,250,240', windup: .85, after: 1.4 },
    vacuum:    { label: 'PHONG ĐỘN · CHÂN KHÔNG ĐẠI NGỌC', rgb: '200,245,255', windup: .8, after: 1.5 },
    tornado:   { label: 'PHONG ĐỘN · LONG QUYỂN PHONG', rgb: '215,245,235', windup: 1.0, after: 1.6 },
    blades:    { label: 'PHONG ĐỘN · THẦN PHONG LIÊN TRẢM', rgb: '215,255,245', windup: .8, after: 1.7 },
    sandstorm: { label: 'PHONG ĐỘN · SA TRẦN BẠO', rgb: '232,200,140', windup: 1.0, after: 2.0 },
    storm:     { label: 'PHONG SA ĐẠI BẠO · SONG LONG QUYỂN', rgb: '240,215,150', windup: 1.4, after: 3.2 },
    jinton:    { label: 'TRẦN ĐỘN · NGUYÊN GIỚI BÁC LY CHI THUẬT', rgb: '235,245,255', windup: 1.1, after: 1.5 },
    boulders:  { label: 'THỔ ĐỘN · GIA TRỌNG NHAM · LẠC THẠCH', rgb: '214,186,146', windup: .9, after: 1.8 },
    invis:     { label: 'TÀNG HÌNH CHI THUẬT', rgb: '210,225,240', windup: .55, after: .2 },
    ambush:    { label: 'TRẦN ĐỘN · BỐI HẬU ĐỘT KÍCH', rgb: '240,248,255', windup: .6, after: 1.4 },
    cubes:     { label: 'TRẦN ĐỘN · LẬP PHƯƠNG PHONG TỎA', rgb: '240,248,255', windup: 1.0, after: 1.6 },
    split:     { label: 'PHÂN THÂN CHIA ĐÔI', rgb: '230,240,255', windup: 1.25, after: 1.8 },
    dust:      { label: 'TRẦN ĐỘN · NGUYÊN GIỚI BÁC LY · CỰC ĐẠI', rgb: '255,255,255', windup: 1.45, after: 3.2 },
    orbs:      { label: 'CẦU ĐẠO NGỌC · HẮC THƯƠNG', rgb: '180,150,255', windup: .9, after: 1.4 },
    staff:     { label: 'LỤC ĐẠO TÍCH TRƯỢNG', rgb: '205,190,255', windup: .8, after: 1.3 },
    kamui:     { label: 'THẦN UY', rgb: '165,125,245', windup: 1.0, after: 1.7 },
    beam:      { label: 'THẬP VĨ · VĨ THÚ NGỌC', rgb: '160,110,240', windup: 1.25, after: 1.9 },
    roots:     { label: 'MỘC ĐỘN · THẦN THỤ CĂN', rgb: '214,196,150', windup: 1.0, after: 2.0 },
    gaeshi:    { label: 'UCHIHA GAESHI · QUẠT PHẢN HỒI', rgb: '150,200,255', windup: .7, after: 1.2 },
    tbb:       { label: 'THẬP VĨ · CỰ VĨ THÚ NGỌC', rgb: '175,115,255', windup: 1.6, after: 3.4 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  function pick(level) { return order[((Math.floor(level || 0) % order.length) + order.length) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  // Team battle: the member's jutsu in key order 1..n (each once; the rotation's last new jutsu is the ultimate).
  const MOVE_LIST = {};
  for (const id in members) MOVE_LIST[id] = [...new Set(members[id].moves)].map(k => ({ id: k, label: MOVES[k].label }));
  function moves(z) { return (z && MOVE_LIST[z.bossId]) || []; }
  // What a hit-check may test: in manual control api.player is only the cursor, so use the nearest hostile unit instead.
  function foeNear(api, x, y, r) {
    const p = api.player;
    if (!p || !p.pseudo) return p;
    return api.nearestFoe ? api.nearestFoe(x, y, r) : null;
  }

  function state(z) {
    return z.lg || (z.lg = { t: 0, casts: 0, timer: 1.0, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], force: null, hold: 0, guard: 0, invis: null, dash: null, clone: null, used: 0, lanes: null,
      spots: null, lastDraw: 0 });
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
  function inCone(p, x, y, a, reach, half) {
    if (!p) return false;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > reach + 20) return false;
    const da = Math.atan2(Math.sin(Math.atan2(p.y - y, p.x - x) - a), Math.cos(Math.atan2(p.y - y, p.x - x) - a));
    return d < 40 || Math.abs(da) < half + .08;
  }

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    switch (move) {
      case 'gale': return [{ k: 'cone', x, y, a, r: 780, h: .5 }];
      case 'vacuum': return [circ(tx, ty, 300, true)];
      case 'tornado': {
        st.lanes = [-.4, 0, .4].map(o => ({ a: a + o, x0: x + Math.cos(a + o) * 60, y0: y + Math.sin(a + o) * 60 }));
        return st.lanes.map(l => line(900, 70, l.a, l.x0, l.y0));
      }
      case 'blades': return [circ(tx, ty, 400, true)];
      case 'sandstorm': return [circ(tx, ty, 330)];
      case 'storm': return [circ(tx, ty, 560), circ(tx, ty, 250)];
      case 'jinton': return [{ k: 'cone', x, y, a, r: 840, h: .17 }];
      case 'boulders': return [circ(tx, ty, 380, true)];
      case 'invis': return [];
      case 'ambush': return [circ(tx, ty, 170)];
      case 'cubes': return [circ(tx, ty, 150), circ(tx - sa * 230, ty + ca * 230, 150), circ(tx + sa * 230, ty - ca * 230, 150)];
      case 'split': {
        const d = Math.hypot(tx - x, ty - y);
        st.gx = tx + ca * 300; st.gy = ty + sa * 300;
        return [line(d + 320, 55), line(620, 55, a + Math.PI, st.gx, st.gy)];
      }
      case 'dust': return [circ(tx, ty, 520), circ(tx, ty, 260)];
      case 'orbs': return [-2.5, -1.5, -.5, .5, 1.5, 2.5].map(i => line(820, 30, a + i * .15));
      case 'staff': {
        const len = Math.max(120, Math.min(460, Math.hypot(tx - x, ty - y) - 40));
        st.dashLen = len;
        return [line(len, 60), circ(x + ca * len, y + sa * len, 300)];
      }
      case 'kamui': return [circ(tx, ty, 260)];
      case 'beam': return [line(1000, 105), circ(x + ca * 1000, y + sa * 1000, 260)];
      case 'roots': {
        const spots = [{ x: tx, y: ty }];
        const b = Math.random() * TAU;
        for (let i = 0; i < 6; i++) spots.push({ x: tx + Math.cos(b + i * TAU / 6) * 160, y: ty + Math.sin(b + i * TAU / 6) * 160 });
        for (let i = 0; i < 6; i++) spots.push({ x: tx + Math.cos(b + (i + .5) * TAU / 6) * 300, y: ty + Math.sin(b + (i + .5) * TAU / 6) * 300 });
        for (const s of spots) { s.delay = .05 + Math.hypot(s.x - tx, s.y - ty) / 900; s.seed = Math.random() * 99; }
        st.spots = spots;
        return [circ(tx, ty, 340, true)].concat(spots.map(s => circ(s.x, s.y, 95)));
      }
      case 'gaeshi': return [{ k: 'cone', x, y, a, r: 600, h: .95 }];
      case 'tbb': return [circ(tx, ty, 620), circ(tx, ty, 300)];
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    let move = forced; // a manual cast leaves the AI rotation where it was
    if (!move) {
      move = st.force;
      if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    }
    const def = MOVES[move], p = st.ambushAt && move === 'ambush' ? st.ambushAt : api.player;
    st.ambushAt = null;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.tele = teleFor(z, st, move);
    if (move === 'orbs') st.used = 6;
    if (move === 'gaeshi') st.guard = def.windup + .5;
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, s = st.tele[0] || { x: z.x, y: z.y, a: st.aim, r: 150, len: 600, w: 80 };
    const a = st.aim, ca = Math.cos(a), sa = Math.sin(a), seed = Math.random() * 99;
    api.burst(z.x, z.y - 20, m.accent, 10);
    switch (move) {
      // ---------------------------------------------------------- Kazekage I
      case 'gale': {
        const pts = conePts(s.x, s.y, s.a, s.r, s.h);
        pts.forEach((p, i) => later(st, .04 + p.d / 1500, api => api.strike(p.x, p.y, p.r, D * 1.6, null, i % 5 === 0 ? 'blade' : null, true)));
        later(st, .18, api => {
          if (inCone(foeNear(api, s.x, s.y, s.r + 20), s.x, s.y, s.a, s.r, s.h)) api.knockback(z, s.r + 40, 250, 0);
          api.world(s.x + ca * 380, s.y + sa * 380, 170, D * 2, 'blade', s.a);
          api.world(s.x + ca * 640, s.y + sa * 640, 150, D * 2, 'blade', s.a);
        });
        addFx(st, { kind: 'gale', x: s.x, y: s.y, a: s.a, r: s.r, h: s.h, speed: 1500, dur: 1.7, seed });
        api.shake(10);
        break;
      }
      case 'vacuum': {
        const fx = addFx(st, { kind: 'vacuum', balls: [], dur: 3.0, seed });
        for (let v = 0; v < 3; v++) later(st, v * .3, api => {
          const p = api.player, cx = p ? p.x : st.tx, cy = p ? p.y : st.ty;
          const aa = Math.atan2(cy - z.y, cx - z.x), px = -Math.sin(aa), py = Math.cos(aa);
          const mx = z.x + Math.cos(aa) * 26, my = z.y + Math.sin(aa) * 10;
          for (let j = 0; j < 4; j++) {
            const off = (j - 1.5) * 105 + rand(-15, 15), along = rand(-50, 50);
            const x1 = cx + px * off + Math.cos(aa) * along, y1 = cy + py * off + Math.sin(aa) * along;
            const fl = Math.max(.32, Math.hypot(x1 - mx, y1 - my) / 1150);
            fx.balls.push({ x0: mx, y0: my, x1, y1, t0: fx.age, fl, r: 80, seed: seed + v * 7 + j });
            later(st, fl, api => { api.strike(x1, y1, 80, D * 1.3, null, j % 2 ? null : 'crater', true); api.burst(x1, y1 - 20, '#e8fbff', 6); });
          }
          api.shake(5);
        });
        break;
      }
      case 'tornado': {
        const lanes = st.lanes || [];
        const fx = addFx(st, { kind: 'tornado', lanes, len: 900, speed: 330, dur: 900 / 330 + .9, tick: 0, wtick: .3, seed });
        fx.upd = (fx, dt, api) => {
          if ((fx.tick -= dt) <= 0 && fx.age < fx.len / fx.speed + .3) {
            fx.tick = .2;
            for (let i = 0; i < fx.lanes.length; i++) { tornadoPos(fx, i, TP); api.strike(TP.x, TP.y, 84, D * .55, null, null, true); }
          }
          if ((fx.wtick -= dt) <= 0 && fx.age < fx.len / fx.speed) {
            fx.wtick = .55;
            for (let i = 0; i < fx.lanes.length; i++) { tornadoPos(fx, i, TP); api.world(TP.x, TP.y, 95, D * 1.6, 'vortex'); }
          }
        };
        api.shake(7);
        break;
      }
      case 'blades': {
        const blades = [];
        for (let i = 0; i < 30; i++) {
          const an = rand(0, TAU), d = i === 0 ? 0 : Math.sqrt(Math.random()) * s.r;
          blades.push({ x: s.x + Math.cos(an) * d, y: s.y + Math.sin(an) * d, t0: .05 + i * .05, fl: .45, ang: rand(-.9, .9) + (Math.random() < .5 ? 0 : Math.PI), chase: i % 4 === 3, seed: seed + i * 3.7 });
        }
        blades.forEach((b, i) => {
          if (b.chase) later(st, b.t0, api => { const p = api.player; if (p && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 150) { b.x = p.x; b.y = p.y; } });
          later(st, b.t0 + b.fl, api => api.strike(b.x, b.y, 64, D * 1.05, null, i % 3 === 0 ? 'blade' : null, true));
        });
        addFx(st, { kind: 'blades', x: s.x, y: s.y, r: s.r, blades, dur: .05 + 29 * .05 + .45 + 1.1, seed });
        break;
      }
      case 'sandstorm': {
        const x = s.x, y = s.y, R = s.r;
        const fx = addFx(st, { kind: 'sandstorm', x, y, R, dur: 4.4, tick: .6, seed });
        later(st, .12, api => { api.strike(x, y, R, D * 1.3, '#e0c080', 'earth'); api.shake(9); });
        fx.upd = (fx, dt, api) => {
          if (fx.age > .6 && fx.age < 3.4 && (fx.tick -= dt) <= 0) { fx.tick = .45; api.strike(x, y, R * .95, D * .38, null, null, true); }
        };
        later(st, 3.5, api => {
          api.strike(x, y, 210, D * 1.7, '#d8b070', 'earth');
          for (let i = 0; i < 4; i++) api.world(x + Math.cos(i * 1.57) * 140, y + Math.sin(i * 1.57) * 140, 110, D * 2, 'earth');
          api.shake(12);
        });
        break;
      }
      case 'storm': {
        const x = s.x, y = s.y, R = s.r;
        const fx = addFx(st, { kind: 'storm', x, y, R, a0: Math.random() * TAU, dur: 5.0, tick: .7, wtick: .5, seed });
        // The twin funnels drag everything toward the eye of the storm, then shred it.
        for (const t of [.35, 1.4]) later(st, t, api => { api.knockback({ x, y }, R + 40, -120, 0); api.shake(8); });
        fx.upd = (fx, dt, api) => {
          if (fx.age > .7 && fx.age < 3.2 && (fx.tick -= dt) <= 0) {
            fx.tick = .45;
            for (let i = 0; i < 2; i++) { stormPos(fx, i, TP); api.strike(TP.x, TP.y, 150, D * .95, null, null, true); }
            api.strike(x, y, R * .92, D * .3, null, null, true);
          }
          if (fx.age < 3.2 && (fx.wtick -= dt) <= 0) {
            fx.wtick = .7;
            for (let i = 0; i < 2; i++) { stormPos(fx, i, TP); api.world(TP.x, TP.y, 140, D * 2, 'vortex'); }
          }
        };
        later(st, 3.3, api => {
          api.strike(x, y, 320, D * 3.2, '#f0d090', 'crater');
          for (let i = 0; i < 6; i++) api.world(x + Math.cos(i * TAU / 6) * 250, y + Math.sin(i * TAU / 6) * 250, 150, D * 2.5, 'crater');
          api.shake(22); api.burst(x, y - 40, '#f0d8a0', 40);
        });
        st.hold = 1.2;
        api.shake(10);
        break;
      }
      // ---------------------------------------------------------- Mu
      case 'jinton': {
        addFx(st, { kind: 'cone', x: s.x, y: s.y, a: s.a, len: s.r, half: s.h, dur: 1.45, seed });
        conePts(s.x, s.y, s.a, s.r, s.h).forEach((p, i) => later(st, .03 + p.d / 4000, api => api.strike(p.x, p.y, p.r, D * 3.0, null, i % 2 ? null : 'crater', true)));
        api.shake(14);
        break;
      }
      case 'boulders': {
        const rocks = [];
        for (let i = 0; i < 7; i++) {
          const an = rand(0, TAU), d = i === 0 ? 0 : 90 + Math.sqrt(Math.random()) * (s.r - 90);
          rocks.push({ x: s.x + Math.cos(an) * d, y: s.y + Math.sin(an) * d, t0: .08 + i * .2, fl: .55, r: 118, chase: i % 3 === 2, seed: seed + i * 5.3, rot: rand(0, TAU) });
        }
        rocks.forEach((rk, i) => {
          if (rk.chase) later(st, rk.t0, api => { const p = api.player; if (p && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 180) { rk.x = p.x; rk.y = p.y; } });
          later(st, rk.t0 + rk.fl, api => {
            api.strike(rk.x, rk.y, rk.r, D * 1.9, null, i % 2 ? 'earth' : 'crater', true);
            api.shake(9); api.burst(rk.x, rk.y - 20, '#c8b090', 10);
          });
        });
        addFx(st, { kind: 'rocks', rocks, dur: .08 + 6 * .2 + .55 + 2.4, seed });
        break;
      }
      case 'invis':
        st.invis = { t: 0, dur: 2.0, x: z.x, y: z.y };
        addFx(st, { kind: 'vanish', x: z.x, y: z.y, dur: 1.1, seed });
        break;
      case 'ambush':
        addFx(st, { kind: 'cube', x: s.x, y: s.y, R: s.r, dur: 1.9, seed });
        later(st, .2, api => { api.strike(s.x, s.y, s.r, D * 2.6, '#ffffff', 'crater'); api.shake(13); });
        break;
      case 'cubes':
        st.tele.forEach((c, i) => {
          later(st, i * .12, api => {
            addFx(st, { kind: 'cube', x: c.x, y: c.y, R: c.r, dur: 1.9, seed: seed + i });
            later(st, .2, api => { api.strike(c.x, c.y, c.r, D * 2.4, null, 'crater', i > 0); api.shake(11); });
          });
        });
        break;
      case 'split': {
        const beams = st.tele.map(l => ({ x: l.x, y: l.y, a: l.a, len: l.len }));
        addFx(st, { kind: 'splitBeams', beams, dur: 1.3, seed });
        for (const b of beams) conePts(b.x, b.y, b.a, b.len, .07).forEach((p, i) => later(st, .03 + p.d / 4000, api => api.strike(p.x, p.y, Math.max(56, p.r * .8), D * 2.2, null, i % 3 ? null : 'crater', true)));
        st.clone = { x: st.gx, y: st.gy, a: st.aim + Math.PI, t: 0, dur: 1.5 };
        api.shake(12);
        break;
      }
      case 'dust': {
        const x = s.x, y = s.y, R = s.r;
        addFx(st, { kind: 'bigDust', x, y, R, dur: 3.9, seed });
        later(st, .25, api => {
          api.strike(x, y, R, D * 4.2, '#ffffff', 'crater');
          for (let i = 0; i < 8; i++) api.world(x + Math.cos(i * TAU / 8) * R * .62, y + Math.sin(i * TAU / 8) * R * .62, 160, D * 2.6, 'crater');
          for (let i = 0; i < 4; i++) api.world(x + Math.cos(i * TAU / 4 + .7) * R * .25, y + Math.sin(i * TAU / 4 + .7) * R * .25, 140, D * 2.6, 'crater');
          api.shake(22);
        });
        later(st, 1.65, api => { api.strike(x, y, 220, D * 1.5, null, 'crater'); api.shake(14); });
        st.hold = 1.4;
        break;
      }
      // ---------------------------------------------------------- Obito
      case 'orbs': {
        const rods = st.tele.map((l, i) => {
          const f = orbFront(z, st, i);
          return { x0: f.gx, y0: f.gy, a: l.a, len: l.len - 40, seed: seed + i };
        });
        addFx(st, { kind: 'rods', rods, speed: 1700, dur: 2.4, seed });
        rods.forEach((r, i) => {
          const c = Math.cos(r.a), sn = Math.sin(r.a);
          for (let k = 1; k <= 3; k++) {
            const d0 = r.len * (k - 1) / 3, d1 = r.len * k / 3;
            later(st, d1 / 1700, api => api.line(r.x0 + c * d0, r.y0 + sn * d0, r.x0 + c * d1, r.y0 + sn * d1, 30, D * 1.5, k === 3 && i % 2 ? 'shockwave' : null));
          }
          later(st, r.len / 1700, api => { api.burst(r.x0 + c * r.len, r.y0 + sn * r.len, '#b8a0ff', 5); api.shake(4); });
        });
        later(st, 1.9, () => { st.used = 0; });
        break;
      }
      case 'staff': {
        const len = st.dashLen || 300;
        st.dash = { a, speed: 1700, left: len / 1700, hit: 0, w: 62, dmg: D * 1.2, end: st.tele[1] };
        addFx(st, { kind: 'trail', x0: z.x, y0: z.y, a, len, dur: len / 1700 + .5, seed });
        break;
      }
      case 'kamui': {
        const x = s.x, y = s.y, R = s.r;
        const fx = addFx(st, { kind: 'kamui', x, y, R, dur: 2.8, tick: .55, seed });
        later(st, .15, api => { api.knockback({ x, y }, R + 70, -140, 0); api.shake(8); });
        fx.upd = (fx, dt, api) => {
          if (fx.age > .55 && fx.age < 2.0 && (fx.tick -= dt) <= 0) { fx.tick = .45; api.strike(x, y, R * .65, D * .55, null, null, true); }
        };
        later(st, 2.1, api => {
          api.strike(x, y, 170, D * 2.3, '#a080ff', 'vortex');
          api.world(x, y, 200, D * 2.4, 'vortex');
          api.shake(14);
        });
        break;
      }
      case 'beam': {
        const lift = bodyLift(z), len = 1000, w = 105, end = st.tele[1], bx = z.x, by = z.y;
        addFx(st, { kind: 'beam', x: bx, y: by, h: lift + 40, a, len, w, dur: 1.6, seed });
        for (let d = 60, i = 0; d <= len; d += 80, i++) later(st, d / 4000, api => api.strike(bx + ca * d, by + sa * d, w, D * 2.6, null, i % 3 ? null : 'crater', true));
        later(st, len / 4000 + .02, api => {
          api.strike(end.x, end.y, end.r, D * 2.4, '#b58aff', 'crater');
          for (let i = 0; i < 4; i++) api.world(end.x + Math.cos(i * 1.57 + .4) * 130, end.y + Math.sin(i * 1.57 + .4) * 130, 120, D * 2.2, 'crater');
          api.shake(18);
          addFx(st, { kind: 'blast', x: end.x, y: end.y, R: end.r, dur: 1.4, seed });
        });
        api.shake(10);
        break;
      }
      case 'roots': {
        const spots = st.spots || [], cx = st.tx, cy = st.ty;
        addFx(st, { kind: 'roots', spots, x: cx, y: cy, dur: 3.3, seed });
        spots.forEach((sp, i) => later(st, sp.delay, api => { api.strike(sp.x, sp.y, 95, D * 1.7, null, i % 3 === 0 ? 'earth' : null, true); if (i % 3 === 0) api.shake(6); }));
        for (let t = 1.15; t < 2.4; t += .42) later(st, t, api => api.strike(cx, cy, 300, D * .55, null, null, true));
        later(st, 2.45, api => { api.strike(cx, cy, 170, D * 1.8, '#c8b48a', 'earth'); api.shake(12); });
        break;
      }
      case 'gaeshi': {
        addFx(st, { kind: 'gaeshi', x: s.x, y: s.y, a: s.a, R: s.r, h: s.h, dur: 1.1, seed });
        conePts(s.x, s.y, s.a, s.r, s.h).forEach((p, i) => later(st, .03 + p.d / 1800, api => api.strike(p.x, p.y, p.r, D * 2.0, null, i % 4 === 0 ? 'shockwave' : null, true)));
        later(st, .1, api => { if (inCone(foeNear(api, s.x, s.y, s.r + 20), s.x, s.y, s.a, s.r, s.h)) api.knockback(z, s.r + 40, 230, 0); });
        st.guard = .5;
        api.shake(12);
        break;
      }
      case 'tbb': {
        const x = s.x, y = s.y, R = s.r, lift = bodyLift(z);
        const fx = addFx(st, { kind: 'tbb', sx: z.x, sy: z.y - lift - 150, x, y, R, fly: .55, dur: 4.4, tick: 0, seed });
        later(st, .55, api => {
          api.strike(x, y, R, D * 4.6, '#b58aff', 'crater');
          for (let i = 0; i < 8; i++) api.world(x + Math.cos(i * TAU / 8) * R * .6, y + Math.sin(i * TAU / 8) * R * .6, 170, D * 2.8, 'crater');
          api.world(x, y, 240, D * 3, 'crater');
          api.shake(26); api.burst(x, y - 40, '#c8a8ff', 40);
        });
        fx.upd = (fx, dt, api) => {
          if (fx.age > .95 && fx.age < 2.4 && (fx.tick -= dt) <= 0) { fx.tick = .45; api.strike(x, y, R * .55, D * .5, null, null, true); }
        };
        st.hold = .8;
        break;
      }
    }
  }

  // Positions shared by update (hits) and draw (art).
  const TP = { x: 0, y: 0 };
  function tornadoPos(fx, i, out) {
    const l = fx.lanes[i], d = Math.min(fx.len, fx.age * fx.speed), c = Math.cos(l.a), s = Math.sin(l.a);
    const wob = Math.sin(fx.age * 2.6 + i * 2.1 + fx.seed) * 46 * Math.min(1, d / 250);
    out.x = l.x0 + c * d - s * wob; out.y = l.y0 + s * d + c * wob;
    return out;
  }
  function stormRho(fx) { return fx.R * .64 * (1 - .82 * easeIn(win(fx.age, .3, 3.25))); }
  function stormPos(fx, i, out) {
    const an = fx.a0 + i * Math.PI + fx.age * 1.5 + easeIn(win(fx.age, .3, 3.25)) * 3.5, rho = stormRho(fx);
    out.x = fx.x + Math.cos(an) * rho; out.y = fx.y + Math.sin(an) * rho;
    return out;
  }
  // The six balls drift forward in a fan before stretching into black rods.
  function orbFront(z, st, i) {
    const a = st.aim + (i - 2.5) * .26, lift = bodyLift(z);
    const gx = z.x + Math.cos(a) * 52, gy = z.y + Math.sin(a) * 34;
    return { gx, gy, sx: gx, sy: gy - lift - 46 - Math.abs(i - 2.5) * 5 };
  }
  function ballPos(z, i, time, out) {
    const lift = bodyLift(z), a = i / 9 * TAU + time * .55;
    out.x = z.x + Math.cos(a) * 54;
    out.y = z.y - lift - 72 + Math.sin(a) * 38 + Math.sin(time * 2.3 + i) * 2;
    return out;
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
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.invis = null; st.ev.length = 0; z.manualBusy = false; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.guard = Math.max(0, st.guard - dt);
    z.armorScale = (m.armor || 1) * (st.guard > 0 ? .25 : 1);
    z.kageDash = 0;
    if (st.clone) { st.clone.t += dt; if (st.clone.t >= st.clone.dur) st.clone = null; }

    // Mu: invisible, he stalks the target and reappears behind its back.
    if (st.invis) {
      const iv = st.invis;
      iv.t += dt;
      if (iv.t >= iv.dur) {
        let p = api.player;
        st.invis = null;
        if (p && p.pseudo) {
          // manual control: reappear behind the hostile nearest the cursor (or at the cursor itself)
          const f = api.nearestFoe ? api.nearestFoe(p.x, p.y, 320) : null;
          p = f || { x: p.x, y: p.y, angle: Math.atan2(p.y - z.y, p.x - z.x) };
          st.ambushAt = { x: p.x, y: p.y };
        }
        if (p) {
          const back = (p.angle || 0) + Math.PI;
          let bx = p.x + Math.cos(back) * 95, by = p.y + Math.sin(back) * 95;
          if (api.blocked(bx, by, z.r)) { const o = Math.atan2(z.y - p.y, z.x - p.x); bx = p.x + Math.cos(o) * 95; by = p.y + Math.sin(o) * 95; }
          if (!api.blocked(bx, by, z.r)) { z.x = bx; z.y = by; }
        }
        addFx(st, { kind: 'appear', x: z.x, y: z.y, dur: .9, seed: Math.random() * 99 });
        st.force = 'ambush'; st.timer = 0;
      } else st.timer = Math.max(st.timer, .5);
    }
    // Obito's staff charge: he blurs at the target, then the shakujō sweeps a full circle.
    if (st.dash) {
      const ds = st.dash, step = Math.min(ds.left, dt) * ds.speed;
      ds.left -= dt;
      // Kamui intangibility: he phases straight through walls and houses.
      z.x += Math.cos(ds.a) * step; z.y += Math.sin(ds.a) * step;
      if (ds.left <= 0) for (let i = 0; i < 24 && api.blocked(z.x, z.y, z.r); i++) { z.x -= Math.cos(ds.a) * 20; z.y -= Math.sin(ds.a) * 20; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .08; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      if (ds.left <= 0) {
        const D = api.damage || 60;
        api.strike(z.x, z.y, 300, D * 2.4, '#c8b8ff', 'blade');
        api.knockback(z, 300, 210, 0);
        api.world(z.x, z.y, 220, D * 2.2, 'shockwave');
        api.shake(15);
        addFx(st, { kind: 'sweep', x: z.x, y: z.y, a: ds.a, side: Math.cos(ds.a) >= 0 ? 1 : -1, dur: 1.0, seed: Math.random() * 99 });
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
    } else if (z.manual) {
      // Manual control: only the user's key starts a jutsu; Mu's vanish still ends in its own ambush.
      if (!st.dash && !st.invis && st.force) announce(z, st, m, api);
      else if (z.manualCast != null && !st.dash && !st.invis && st.hold <= 0) {
        const mv = MOVE_LIST[z.bossId][z.manualCast];
        z.manualCast = null;
        if (mv) announce(z, st, m, api, mv.id);
      }
    } else if (!st.dash && !st.invis) {
      st.timer -= dt;
      const p = api.player;
      if (st.timer <= 0 && p && (st.force || Math.hypot(z.x - p.x, z.y - p.y) < 880)) announce(z, st, m, api);
    }
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.invis || !!st.force;
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
  }

  // ------------------------------------------------------------------ cached art
  function sandDisc() {
    return Kit().sprite('lg:sanddisc', 256, 256, g => {
      const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
      gr.addColorStop(0, 'rgba(232,200,140,.95)'); gr.addColorStop(.7, 'rgba(210,172,104,.9)'); gr.addColorStop(.9, 'rgba(182,142,80,.6)'); gr.addColorStop(1, 'rgba(170,130,70,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, TAU); g.fill();
      g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const r = 14 + i * 12.5;
        g.strokeStyle = 'rgba(140,100,50,.42)'; g.lineWidth = 2.4;
        for (let k = 0; k < 5; k++) { const a0 = hash(i * 9 + k) * TAU; g.beginPath(); g.arc(128, 128, r, a0, a0 + .5 + hash(i + k * 3) * .8); g.stroke(); }
        g.strokeStyle = 'rgba(255,240,200,.45)'; g.lineWidth = 1.3;
        for (let k = 0; k < 4; k++) { const a0 = hash(i * 5 + k + 40) * TAU; g.beginPath(); g.arc(128, 128, r - 3, a0, a0 + .4 + hash(i + k * 7) * .6); g.stroke(); }
      }
    });
  }
  function rockSprite() {
    return Kit().sprite('lg:rock', 192, 192, g => {
      const c = 96, R = 88, path = () => {
        g.beginPath();
        for (let i = 0; i <= 22; i++) {
          const a = i / 22 * TAU, r = R * (.84 + hash(i % 22 + 9) * .16);
          if (i) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = '#5e4c3c'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#806b56'; g.beginPath(); g.arc(c + 22, c - 28, R * .95, 0, TAU); g.fill();
      g.fillStyle = '#a48d72'; g.beginPath(); g.arc(c + 40, c - 50, R * .55, 0, TAU); g.fill();
      g.fillStyle = '#3a2f27'; g.beginPath(); g.arc(c - 44, c + 46, R * .78, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,22,16,.7)'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        let x = c - 50 + hash(i * 9.1 + 2) * 100, y = c - 50 + hash(i * 4.4 + 2) * 100;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { x += (hash(i * 7 + k + 2) - .5) * 40; y += 8 + hash(i * 3 + k * 5 + 2) * 18; g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      path(); g.strokeStyle = '#1e1712'; g.lineWidth = 4; g.stroke();
    });
  }
  function rockAt(ctx, x, y, R, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(rockSprite(), -R, -R, R * 2, R * 2);
    ctx.restore();
  }
  // Vacuum bullet: a clear bubble of compressed air with a bright rim.
  function vacSprite() {
    return Kit().sphere('lg:vac', [[0, 'rgba(255,255,255,.3)'], [.5, 'rgba(215,248,255,.12)'], [.78, 'rgba(170,232,250,.38)'], [.92, 'rgba(250,255,255,.95)'], [1, 'rgba(255,255,255,0)']], .38, .34);
  }
  function windSwirl() { return Kit().swirl('lg:windswirl', ['rgba(255,255,255,.9)', 'rgba(170,235,250,.75)', 'rgba(210,250,255,.8)'], 6, .9, .15, 128, 3.4); }
  function sandSwirl() { return Kit().swirl('lg:sandswirl', ['rgba(120,84,40,.85)', 'rgba(214,176,108,.85)', 'rgba(250,232,190,.8)'], 9, 1.2, .1, 256, 5); }
  function kamuiSwirl() { return Kit().swirl('lg:kamui', ['rgba(18,6,34,.95)', 'rgba(96,56,170,.9)', 'rgba(205,185,255,.8)', 'rgba(40,16,70,.9)'], 10, 1.4, .06, 256, 5); }
  function chakraSwirl() { return Kit().swirl('lg:tbbswirl', ['rgba(255,255,255,.9)', 'rgba(190,150,255,.85)', 'rgba(120,70,220,.85)'], 7, 1.1, .12, 128, 3); }
  // Crescent wind blade (white edge, cyan core), 128x64, tips pointing left/right.
  function bladeSprite() {
    return Kit().sprite('lg:windblade', 128, 64, g => {
      g.translate(64, 52);
      const path = (k) => {
        g.beginPath(); g.arc(0, 0, 56 * k, Math.PI + .25, -.25);
        g.arc(0, 22 * k, 66 * k, -.604, -2.537, true); g.closePath();
      };
      path(1); g.fillStyle = 'rgba(40,90,100,.85)'; g.fill();
      g.save(); g.translate(0, 2); path(.92); g.fillStyle = '#e8fbff'; g.fill(); g.restore();
      g.save(); g.translate(0, 4); path(.84); g.fillStyle = '#ffffff'; g.fill(); g.restore();
      g.strokeStyle = 'rgba(120,220,240,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 10, 44, Math.PI + .4, -.4); g.stroke();
    });
  }
  function tsbSprite() {
    return Kit().sphere('lg:tsb', [[0, '#8a849a'], [.12, '#3a3546'], [.45, '#100e16'], [.85, '#050407'], [1, '#000']]);
  }
  function tbbSprite() {
    return Kit().sphere('lg:tbb', [[0, '#7a6a9a'], [.14, '#2c2040'], [.5, '#0c0814'], [.86, '#060309'], [.97, '#2a1048'], [1, 'rgba(60,20,110,0)']]);
  }
  function drawBall(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(150,130,210,.38)';
    ctx.beginPath(); ctx.arc(x, y, r + 1.4, 0, TAU); ctx.fill();
    ctx.drawImage(tsbSprite(), x - r, y - r, r * 2, r * 2);
  }
  // A black Gudōdama rod (pointed both ends) centred at x,y along angle ang.
  function drawRod(ctx, x, y, ang, len, w) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const h = len / 2;
    ctx.fillStyle = 'rgba(160,140,230,.5)';
    ctx.beginPath(); ctx.moveTo(-h - 2, 0); ctx.lineTo(-h + 6, -w / 2 - 1.6); ctx.lineTo(h - 9, -w / 2 - 1.6); ctx.lineTo(h + 3, 0); ctx.lineTo(h - 9, w / 2 + 1.6); ctx.lineTo(-h + 6, w / 2 + 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#07060b';
    ctx.beginPath(); ctx.moveTo(-h, 0); ctx.lineTo(-h + 6, -w / 2); ctx.lineTo(h - 9, -w / 2); ctx.lineTo(h, 0); ctx.lineTo(h - 9, w / 2); ctx.lineTo(-h + 6, w / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a6680'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-h + 7, -w / 2 + 1.2); ctx.lineTo(h - 10, -w / 2 + 1.2); ctx.stroke();
    ctx.restore();
  }
  function drawStaff(ctx, x, y, ang, len, alpha) {
    const K = Kit();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(190,175,240,.45)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-len * .25, 0); ctx.lineTo(len, 0); ctx.stroke();
    ctx.strokeStyle = '#05060b'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#5b5c72'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-len * .22, -1.6); ctx.lineTo(len * .95, -1.6); ctx.stroke();
    ctx.strokeStyle = '#05060b'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(len + 13, 0, 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,185,255,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#05060b';
    ctx.beginPath(); ctx.arc(len + 30, 0, 9, -1.4, 1.4); ctx.arc(len + 26, 0, 7, 1.2, -1.2, true); ctx.fill();
    for (const sd of [-1, 1]) { ctx.strokeStyle = '#0c0c14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(len + 9, sd * 13, 4, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, len + 13, 0, 24, '160,130,255', .45 * alpha);
    ctx.restore();
  }
  function drawGunbai(ctx, x, y, size, rot, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, size * .3); ctx.lineTo(0, size * 1.25); ctx.stroke();
    ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, size * .3); ctx.lineTo(0, size * 1.22); ctx.stroke();
    ctx.fillStyle = '#b3232c'; ctx.strokeStyle = '#2a0b0e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -size * .2, size * .62, size * .68, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a1820'; ctx.beginPath(); ctx.ellipse(size * .12, -size * .1, size * .5, size * .56, 0, -.6, 2.2); ctx.fill();
    ctx.strokeStyle = '#d8b062'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, -size * .2, size * .5, size * .56, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#16090a';
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 - .5, cx = Math.cos(a) * size * .14, cy = -size * .2 + Math.sin(a) * size * .14;
      ctx.beginPath(); ctx.arc(cx, cy, size * .07, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a + 1.6) * size * .07, cy + Math.sin(a + 1.6) * size * .07);
      ctx.quadraticCurveTo(cx + Math.cos(a + 2.4) * size * .18, cy + Math.sin(a + 2.4) * size * .18, cx + Math.cos(a + 3.3) * size * .15, cy + Math.sin(a + 3.3) * size * .15);
      ctx.lineTo(cx + Math.cos(a - 1.6) * size * .07, cy + Math.sin(a - 1.6) * size * .07); ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ draw helpers
  function sector(ctx, x, y, r0, r1, a0, a1, squash = 1) {
    ctx.beginPath();
    ctx.ellipse(x, y, r1, r1 * squash, 0, a0, a1);
    if (r0 > 0) ctx.ellipse(x, y, r0, r0 * squash, 0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  // A filling danger mark: dark tint, coloured core that grows with k, pulsing rim.
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,30,.35)'; ctx.lineWidth = faint ? 3.5 : 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14)); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12));
      }
      ctx.stroke();
    }
  }
  function teleShape(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    if (s.k === 'c') { markCircle(ctx, s.x, s.y, s.r, rgb, k, time, s.faint); return; }
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    if (s.k === 'line') {
      ctx.fillStyle = 'rgba(24,12,8,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
      ctx.strokeStyle = 'rgba(30,20,30,.35)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(24,12,8,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,30,.35)'; ctx.lineWidth = 5; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
    }
    ctx.restore();
  }
  // Crater with a raised rim and a few cracks (ground).
  function craterG(ctx, x, y, r, alpha, seed) {
    if (alpha <= .01) return;
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
  function dustBurst(ctx, x, y, r, t, seed, kind = 'dust', n = 12, debris = '#3a2c22') {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.3), a0 = 1 - win(t, .7, 2.2);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i + seed) * .4, d = r * (.35 + e * (.6 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - 10 - hash(i * 4.4) * r * .12, r * (.11 + e * (.08 + hash(i * 6.1) * .08)), a0 * .8, .75);
    }
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.2, t / 1.1, seed, debris, 14);
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
  // Quadratic-bezier tube from t0 to t1, width w0 → w1 (closed path).
  const TL = new Float32Array(40), TR = new Float32Array(40);
  function tube(ctx, x0, y0, cx, cy, x1, y1, t0, t1, w0, w1) {
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const k = i / N, t = t0 + (t1 - t0) * k, u = 1 - t;
      const px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
      let dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const w = w0 + (w1 - w0) * k;
      TL[i * 2] = px - dy * w; TL[i * 2 + 1] = py + dx * w;
      TR[i * 2] = px + dy * w; TR[i * 2 + 1] = py - dx * w;
    }
    ctx.beginPath(); ctx.moveTo(TL[0], TL[1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(TL[i * 2], TL[i * 2 + 1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(TR[i * 2], TR[i * 2 + 1]);
    ctx.closePath();
  }

  // A whirling funnel standing on (x, y): H tall, R0 radius at the ground, R1 at the top.
  const FL = new Float32Array(40), FR = new Float32Array(40), FC = new Float32Array(60);
  const WIND_PAL = { body: 'rgba(214,232,230,.34)', edge: 'rgba(60,86,92,.5)', back: 'rgba(120,150,152,.5)', front: 'rgba(255,255,255,.95)', under: 'rgba(50,82,90,.5)', debris: '#4a3a2c', dust: 'dust' };
  const SAND_PAL = { body: 'rgba(196,158,98,.55)', edge: 'rgba(96,64,30,.65)', back: 'rgba(140,100,55,.55)', front: 'rgba(255,238,196,.95)', under: 'rgba(104,70,32,.6)', debris: '#4a3422', dust: 'dust' };
  function funnel(ctx, x, y, H, R0, R1, time, seed, alpha, pal, lean = 0) {
    if (alpha <= .01) return;
    const N = 14, K = Kit();
    for (let i = 0; i <= N; i++) {
      const h = i / N, r = R0 + (R1 - R0) * Math.pow(h, 1.5);
      const cx = x + Math.sin(time * 2.1 + seed + h * 3.2) * (3 + 20 * h) * (R1 / 90) + lean * h * h;
      const cy = y - H * h;
      FL[i * 2] = cx - r; FL[i * 2 + 1] = cy; FR[i * 2] = cx + r; FR[i * 2 + 1] = cy;
      FC[i * 3] = cx; FC[i * 3 + 1] = cy; FC[i * 3 + 2] = r;
    }
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(FL[0], FL[1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(FL[i * 2], FL[i * 2 + 1]);
    ctx.ellipse(FC[N * 3], FC[N * 3 + 1], FC[N * 3 + 2], FC[N * 3 + 2] * .3, 0, Math.PI, TAU);
    for (let i = N; i >= 0; i--) ctx.lineTo(FR[i * 2], FR[i * 2 + 1]);
    ctx.closePath();
    ctx.fillStyle = pal.body; ctx.fill();
    ctx.strokeStyle = pal.edge; ctx.lineWidth = 3; ctx.stroke();
    // back halves of the whirling bands
    ctx.beginPath();
    for (let i = 1; i <= N; i++) {
      const cx = FC[i * 3], cy = FC[i * 3 + 1], r = FC[i * 3 + 2], s0 = Math.PI + frac(time * .9 + hash(i + seed)) * 1.8;
      ctx.moveTo(cx + Math.cos(s0) * r, cy + Math.sin(s0) * r * .3); ctx.ellipse(cx, cy, r, r * .3, 0, s0, s0 + 1.3);
    }
    ctx.strokeStyle = pal.back; ctx.lineWidth = 1.8; ctx.stroke();
    // front bands sweeping round: dark under-stroke then bright
    ctx.beginPath();
    for (let i = 1; i <= N; i++) {
      const cx = FC[i * 3], cy = FC[i * 3 + 1], r = FC[i * 3 + 2], h = i / N;
      for (let j = 0; j < 2; j++) {
        let a0 = frac(time * (1.2 + h * .8) + hash(i * 3 + j * 7 + seed)) * (Math.PI + 1.4) - 1.4, a1 = a0 + 1.3;
        if (a0 < 0) a0 = 0; if (a1 > Math.PI) a1 = Math.PI;
        if (a1 - a0 < .12) continue;
        ctx.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r * .3); ctx.ellipse(cx, cy, r, r * .3, 0, a0, a1);
      }
    }
    ctx.strokeStyle = pal.under; ctx.lineWidth = 4.6; ctx.stroke();
    ctx.strokeStyle = pal.front; ctx.lineWidth = 2; ctx.stroke();
    // debris whirled up round the funnel
    ctx.fillStyle = pal.debris;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const hh = .08 + hash(i * 3.3 + seed) * .85, idx = Math.min(N, Math.round(hh * N));
      const an = time * (3 + hash(i + seed) * 3) + hash(i * 7.1 + seed) * TAU;
      const px = FC[idx * 3] + Math.cos(an) * FC[idx * 3 + 2] * 1.15, py = FC[idx * 3 + 1] + Math.sin(an) * FC[idx * 3 + 2] * .35;
      const sz = 2.5 + hash(i * 5.5 + seed) * 3.5 * (R1 / 90), rot = time * 7 + i;
      ctx.moveTo(px + Math.cos(rot) * sz, py + Math.sin(rot) * sz); ctx.lineTo(px + Math.cos(rot + 2.2) * sz, py + Math.sin(rot + 2.2) * sz); ctx.lineTo(px + Math.cos(rot + 4) * sz * .7, py + Math.sin(rot + 4) * sz * .7); ctx.closePath();
    }
    ctx.fill();
    // dust skirt at the base
    const dust = K.puff(pal.dust);
    for (let i = 0; i < 6; i++) {
      const an = time * 2.4 + i * TAU / 6 + seed;
      K.stamp(ctx, dust, x + Math.cos(an) * R0 * 1.6, y + Math.sin(an) * R0 * .5 - 6, R0 * (.55 + .2 * Math.sin(time * 3 + i)), .75, .7);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ Kazekage I: wind
  function galeG(ctx, fx, time) {
    const front = Math.min(fx.r, fx.age * fx.speed), fade = 1 - win(fx.age, .9, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(60,70,60,${.2 * fade})`; sector(ctx, 0, 0, 30, front, -fx.h, fx.h); ctx.fill();
    ctx.strokeStyle = `rgba(70,64,50,${.4 * fade})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const an = (hash(i * 2.7 + fx.seed) - .5) * 2 * fx.h * .92, d0 = 60 + hash(i * 1.3 + fx.seed) * 200, d1 = Math.min(front, d0 + 160 + hash(i) * 260);
      if (d1 <= d0) continue;
      ctx.moveTo(Math.cos(an) * d0, Math.sin(an) * d0); ctx.lineTo(Math.cos(an) * d1, Math.sin(an) * d1);
    }
    ctx.stroke();
    ctx.restore();
  }
  function galeO(ctx, fx, time) {
    const K = Kit(), t = fx.age, front = Math.min(fx.r + 60, t * fx.speed), fade = 1 - win(t, fx.r / fx.speed, fx.dur);
    if (fade <= 0) return;
    const L = 30;
    ctx.save(); ctx.translate(fx.x, fx.y - L); ctx.rotate(fx.a);
    ctx.lineCap = 'round';
    // body of the gust: translucent blast filling the cone up to the front
    ctx.fillStyle = `rgba(225,245,240,${.16 * fade})`; sector(ctx, 0, 0, 20, front, -fx.h, fx.h); ctx.fill();
    // streaks racing outward
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const an = (hash(i * 1.9 + fx.seed) - .5) * 2 * fx.h * .96, sp = .7 + hash(i * 3.7 + fx.seed) * .55;
      const d = t * fx.speed * sp - hash(i * 5.1) * 240, len = 70 + hash(i * 2.3) * 110;
      if (d < 20 || d - len > fx.r + 40) continue;
      const d0 = Math.max(20, d - len), bend = (hash(i * 9.3) - .5) * 24;
      const am = an + bend / Math.max(60, d);
      ctx.moveTo(Math.cos(an) * d0, Math.sin(an) * d0);
      ctx.quadraticCurveTo(Math.cos(am) * (d0 + d) / 2, Math.sin(am) * (d0 + d) / 2, Math.cos(an) * d, Math.sin(an) * d);
    }
    ctx.strokeStyle = `rgba(235,250,248,${.16 * fade})`; ctx.lineWidth = 22; ctx.stroke();
    ctx.strokeStyle = `rgba(48,80,88,${.45 * fade})`; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.92 * fade})`; ctx.lineWidth = 2.2; ctx.stroke();
    // pressure fronts: stacked crescents riding the leading edge
    for (let i = 0; i < 4; i++) {
      const rr = front - i * 34;
      if (rr < 40 || rr > fx.r + 50) continue;
      const w = fx.h * (1 - i * .08);
      ctx.strokeStyle = `rgba(48,80,88,${fade * (.5 - i * .08)})`; ctx.lineWidth = 15 - i * 2.5;
      ctx.beginPath(); ctx.arc(0, 0, rr, -w, w); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${fade * (.95 - i * .18)})`; ctx.lineWidth = 7 - i * 1.3;
      ctx.beginPath(); ctx.arc(0, 0, rr, -w, w); ctx.stroke();
    }
    // curling hooks of air tumbling inside the gust
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const an = (hash(i * 4.4 + fx.seed) - .5) * 2 * fx.h * .85, d = Math.min(front - 20, 60 + hash(i * 6.6 + fx.seed) * fx.r);
      if (d < 60) continue;
      const cx = Math.cos(an) * d, cy = Math.sin(an) * d, r = 14 + hash(i) * 12, s0 = time * 9 + i;
      ctx.moveTo(cx + Math.cos(s0) * r, cy + Math.sin(s0) * r); ctx.arc(cx, cy, r, s0, s0 + 4.2);
    }
    ctx.strokeStyle = `rgba(48,80,88,${.4 * fade})`; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.strokeStyle = `rgba(240,255,252,${.9 * fade})`; ctx.lineWidth = 1.8; ctx.stroke();
    // dust and leaves carried along
    const dust = K.puff('dust');
    for (let i = 0; i < 14; i++) {
      const an = (hash(i * 7.7 + fx.seed) - .5) * 2 * fx.h, d = Math.min(front, fx.r) * (.25 + hash(i * 3.1 + fx.seed) * .75);
      K.stamp(ctx, dust, Math.cos(an) * d, Math.sin(an) * d + L - 8, 18 + d * .05, .5 * fade, .7);
    }
    // a rolling wall of dust kicked up along the leading edge
    if (front < fx.r + 40) for (let i = 0; i < 10; i++) {
      const an = (i / 9 - .5) * 2 * fx.h * .9, d = front - 20 - hash(i * 5.3 + fx.seed) * 40;
      if (d < 80) continue;
      K.stamp(ctx, dust, Math.cos(an) * d, Math.sin(an) * d + L - 14, 30 + d * .04, .7 * fade, .75);
    }
    ctx.fillStyle = `rgba(110,150,60,${fade})`;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const an = (hash(i * 8.8 + fx.seed) - .5) * 2 * fx.h, d = t * fx.speed * (.6 + hash(i * 2.9) * .5) - hash(i) * 100;
      if (d < 30 || d > fx.r) continue;
      const px = Math.cos(an) * d, py = Math.sin(an) * d - Math.sin(d * .02 + i) * 14, rot = time * 12 + i;
      ctx.moveTo(px + Math.cos(rot) * 4, py + Math.sin(rot) * 4); ctx.lineTo(px + Math.cos(rot + 2.5) * 3, py + Math.sin(rot + 2.5) * 3); ctx.lineTo(px + Math.cos(rot + 3.6) * 4, py + Math.sin(rot + 3.6) * 4); ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
  function vacuumG(ctx, fx, time) {
    for (const b of fx.balls) {
      const u = fx.age - b.t0, k = u / b.fl;
      if (k < 1) markCircle(ctx, b.x1, b.y1, b.r, '200,245,255', k, time, false);
      else craterG(ctx, b.x1, b.y1, b.r * .7, (1 - win(u - b.fl, .5, 1.4)) * .8, b.seed);
      if (k > 0 && k < 1) {
        const x = lerp(b.x0, b.x1, k), y = lerp(b.y0, b.y1, k);
        ctx.fillStyle = 'rgba(20,30,30,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 24, 9, 0, 0, TAU); ctx.fill();
      }
    }
  }
  function vacuumO(ctx, fx, time) {
    const K = Kit(), L = 40, img = vacSprite(), sw = windSwirl();
    for (const b of fx.balls) {
      const u = fx.age - b.t0, k = u / b.fl;
      if (u < 0) continue;
      if (k < 1) {
        const e = k, x = lerp(b.x0, b.x1, e), y = lerp(b.y0, b.y1, e) - L - Math.sin(Math.PI * e) * 30, r = 18 + 10 * Math.min(1, k * 3);
        const vx = b.x1 - b.x0, vy = b.y1 - b.y0, vl = Math.hypot(vx, vy) || 1;
        // trailing pressure streaks
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let j = -1; j <= 1; j++) { const ox = -vy / vl * j * r * .55, oy = vx / vl * j * r * .55; ctx.moveTo(x + ox - vx / vl * r * .6, y + oy - vy / vl * r * .6); ctx.lineTo(x + ox - vx / vl * (r + 50 - Math.abs(j) * 18), y + oy - vy / vl * (r + 50 - Math.abs(j) * 18)); }
        ctx.strokeStyle = 'rgba(40,80,90,.45)'; ctx.lineWidth = 4.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(30,70,80,.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r * .95, 0, TAU); ctx.stroke();
        ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, sw, x, y, r * .85, time * 10 + b.seed, .65);
        K.glow(ctx, x, y, r * 1.8, '170,235,255', .3);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(x - r * .35, y - r * .4, r * .22, r * .12, -.6, 0, TAU); ctx.fill();
      } else {
        const v = u - b.fl;
        if (v > 1.6) continue;
        // implosion snap then burst: a white ring, refracted shell and dust
        if (v < .12) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, b.x1, b.y1 - 30, 120 * (1 - v / .12) + 30, '210,250,255', .7, true); ctx.globalCompositeOperation = 'source-over'; }
        if (v < .45) {
          const q = v / .45, rr = 30 + easeOut(q) * 110;
          ctx.strokeStyle = `rgba(40,80,90,${.5 * (1 - q)})`; ctx.lineWidth = 9 * (1 - q) + 2; ctx.beginPath(); ctx.ellipse(b.x1, b.y1 - 24, rr, rr * .8, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${.95 * (1 - q)})`; ctx.lineWidth = 4 * (1 - q) + 1; ctx.stroke();
        }
        if (v < .8) K.fx.shockRing(ctx, b.x1, b.y1, b.r * 1.5, v / .8, 1 - v / .8, '220,250,255');
        dustBurst(ctx, b.x1, b.y1, b.r, v, b.seed, 'dust', 8);
      }
    }
  }
  function tornadoG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur), grow = easeOut(fx.age / .35);
    for (let i = 0; i < fx.lanes.length; i++) {
      tornadoPos(fx, i, TP);
      ctx.fillStyle = `rgba(30,36,30,${.3 * fade})`; ctx.beginPath(); ctx.ellipse(TP.x, TP.y + 2, 70 * grow, 28 * grow, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      Kit().spin(ctx, sandSwirl(), TP.x, TP.y, 80 * grow, -time * 6 + i, .45 * fade, .42);
      // the scoured track behind it
      const l = fx.lanes[i], c = Math.cos(l.a), s = Math.sin(l.a), d = Math.min(fx.len, fx.age * fx.speed);
      ctx.strokeStyle = `rgba(90,76,56,${.22 * fade})`; ctx.lineWidth = 50; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x0 + c * d, l.y0 + s * d); ctx.stroke();
    }
  }
  function tornadoO(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur), grow = easeOut(fx.age / .4);
    for (let i = 0; i < fx.lanes.length; i++) {
      tornadoPos(fx, i, TP);
      funnel(ctx, TP.x, TP.y, 250 * grow, 20, 92 * grow + 10, time, fx.seed + i * 4.1, fade, WIND_PAL, Math.cos(fx.lanes[i].a) * 30);
    }
  }
  function bladesG(ctx, fx, time) {
    for (const b of fx.blades) {
      const u = fx.age - b.t0, k = u / b.fl;
      if (u < 0) continue;
      const c = Math.cos(b.ang), s = Math.sin(b.ang);
      if (k < 1) {
        ctx.strokeStyle = `rgba(30,60,60,${.3 + .3 * k})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(b.x - c * 60, b.y - s * 60); ctx.lineTo(b.x + c * 60, b.y + s * 60); ctx.stroke();
        ctx.strokeStyle = `rgba(200,255,245,${.4 + .5 * k})`; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = `rgba(200,255,245,${.08 + .12 * k})`; ctx.beginPath(); ctx.arc(b.x, b.y, 64, 0, TAU); ctx.fill();
      } else {
        const v = u - b.fl, fade = 1 - win(v, .3, 1.1);
        if (fade <= 0) continue;
        // a long slash cut into the ground
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ang);
        ctx.fillStyle = `rgba(40,30,22,${.6 * fade})`;
        ctx.beginPath(); ctx.moveTo(-80, 0); ctx.quadraticCurveTo(0, -9, 80, 0); ctx.quadraticCurveTo(0, 9, -80, 0); ctx.fill();
        ctx.fillStyle = `rgba(230,255,250,${.8 * fade * (1 - win(v, 0, .5))})`;
        ctx.beginPath(); ctx.moveTo(-70, 0); ctx.quadraticCurveTo(0, -4, 70, 0); ctx.quadraticCurveTo(0, 4, -70, 0); ctx.fill();
        ctx.restore();
      }
    }
  }
  function bladesO(ctx, fx, time) {
    const K = Kit(), img = bladeSprite();
    for (const b of fx.blades) {
      const u = fx.age - b.t0, k = u / b.fl;
      if (u < 0) continue;
      if (k < 1) {
        const e = easeIn(k), H = 330 * (1 - e);
        const x = b.x - Math.cos(b.ang) * 160 * (1 - e), y = b.y - H - 10;
        ctx.save(); ctx.translate(x, y); ctx.rotate(b.ang + (1 - e) * 2.5);
        ctx.drawImage(img, -64, -40, 128, 64);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, y, 38, '150,240,230', .4);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b.ang) * 50 * (1 - e), y - 90 * (1 - e) - 20); ctx.stroke();
      } else {
        const v = u - b.fl;
        if (v < .3) {
          const q = v / .3;
          ctx.save(); ctx.translate(b.x, b.y - 8); ctx.rotate(b.ang);
          ctx.strokeStyle = `rgba(40,80,88,${.6 * (1 - q)})`; ctx.lineWidth = 9 * (1 - q) + 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-90 * easeOut(q * 2), 0); ctx.lineTo(90 * easeOut(q * 2), 0); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = 4 * (1 - q) + 1; ctx.stroke();
          ctx.restore();
        }
        if (v < .8) K.stamp(ctx, K.puff('dust'), b.x, b.y - 10, 20 + v * 30, (1 - v / .8) * .6, .7);
      }
    }
  }
  function sandstormG(ctx, fx, time) {
    const K = Kit(), t = fx.age, fade = 1 - win(t, fx.dur - .7, fx.dur), k = easeOut(t / .5), R = fx.R * k;
    ctx.globalAlpha = .85 * fade;
    ctx.drawImage(sandDisc(), fx.x - R, fx.y - R, R * 2, R * 2);
    ctx.globalAlpha = 1;
    K.spin(ctx, sandSwirl(), fx.x, fx.y, R * .98, -time * 1.6, .5 * fade, 1);
    if (t > 3.5) {
      // the buried mound left when the storm settles
      const q = win(t, 3.5, 3.8);
      ctx.fillStyle = `rgba(196,160,98,${.9 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 200 * q, 90 * q, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(120,86,44,${.6 * fade})`; ctx.lineWidth = 3;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 200 * q * i / 3.4, 90 * q * i / 3.4, 0, 0, TAU); ctx.stroke(); }
    }
  }
  function sandstormO(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.R, rise = easeOut(t / .6), fade = 1 - win(t, 3.3, 3.8);
    if (fade > 0) {
      // murk inside the storm
      ctx.fillStyle = `rgba(150,112,62,${.22 * fade * rise})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y - 40, R * 1.02, R * .62, 0, 0, TAU); ctx.fill();
      // whirling sand walls: ochre arcs at several heights
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 22; i++) {
        const rr = R * (.35 + hash(i * 2.1 + fx.seed) * .68), hgt = 10 + hash(i * 3.3 + fx.seed) * 130 * rise, a0 = time * (2.4 - rr / R) + hash(i * 5.7) * TAU;
        ctx.moveTo(fx.x + Math.cos(a0) * rr, fx.y - hgt + Math.sin(a0) * rr * .5); ctx.ellipse(fx.x, fx.y - hgt, rr, rr * .5, 0, a0, a0 + .9 + hash(i) * .6);
      }
      ctx.strokeStyle = `rgba(110,76,36,${.55 * fade})`; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = `rgba(250,228,180,${.85 * fade})`; ctx.lineWidth = 2.6; ctx.stroke();
      const dust = K.puff('dust');
      for (let i = 0; i < 26; i++) {
        const rr = R * (.2 + hash(i * 1.7 + fx.seed) * .85), an = time * (2.2 - rr / R * 1.2) + hash(i * 4.9 + fx.seed) * TAU;
        const hgt = 12 + hash(i * 6.1) * 120 * rise, sz = 26 + hash(i * 8.3) * 30;
        K.stamp(ctx, dust, fx.x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr * .5 - hgt, sz, .55 * fade, .8);
      }
      // stinging grit
      ctx.fillStyle = `rgba(90,60,30,${.8 * fade})`;
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const rr = R * hash(i * 2.9 + fx.seed), an = time * 4 + hash(i * 3.3) * TAU, hgt = hash(i * 7.7) * 150 * rise;
        ctx.rect(fx.x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr * .5 - hgt, 3, 2);
      }
      ctx.fill();
    }
    if (t > 3.4) {
      // the storm collapses onto the buried spot
      const u = t - 3.5;
      if (u < 0) {
        const q = win(t, 3.4, 3.5);
        ctx.fillStyle = 'rgba(206,170,108,.9)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 210, 110 + 150 * (1 - q), 0, Math.PI, TAU); ctx.fill();
      } else {
        if (u < .8) K.fx.shockRing(ctx, fx.x, fx.y, 320, u / .8, 1 - u / .8, '240,210,150');
        dustBurst(ctx, fx.x, fx.y, 220, u, fx.seed, 'dust', 14, '#6a4a28');
      }
    }
  }
  function stormG(ctx, fx, time) {
    const K = Kit(), t = fx.age, fade = 1 - win(t, fx.dur - .9, fx.dur), k = easeOut(t / .5), R = fx.R * (.4 + .6 * k);
    ctx.globalAlpha = .8 * fade;
    ctx.drawImage(sandDisc(), fx.x - R, fx.y - R, R * 2, R * 2);
    ctx.globalAlpha = 1;
    K.spin(ctx, sandSwirl(), fx.x, fx.y, R, -time * 2.2, .6 * fade, 1);
    ctx.fillStyle = `rgba(60,40,20,${.25 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, stormRho(fx) + 60, 0, TAU); ctx.fill();
    if (t < 3.3) for (let i = 0; i < 2; i++) {
      stormPos(fx, i, TP);
      ctx.fillStyle = `rgba(40,26,14,${.35 * fade})`; ctx.beginPath(); ctx.ellipse(TP.x, TP.y + 3, 120, 46, 0, 0, TAU); ctx.fill();
    } else craterG(ctx, fx.x, fx.y, 300, fade, fx.seed);
  }
  function stormO(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.R, rise = easeOut(t / .7), alive = 1 - win(t, 3.2, 3.45);
    if (alive > 0) {
      ctx.fillStyle = `rgba(150,110,58,${.2 * alive * rise})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y - 60, R * 1.02, R * .6, 0, 0, TAU); ctx.fill();
      // the ring wall of the storm
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const rr = R * (.7 + hash(i * 2.1 + fx.seed) * .32), hgt = 10 + hash(i * 3.3 + fx.seed) * 220 * rise, a0 = time * 1.8 + hash(i * 5.7) * TAU;
        ctx.moveTo(fx.x + Math.cos(a0) * rr, fx.y - hgt + Math.sin(a0) * rr * .5); ctx.ellipse(fx.x, fx.y - hgt, rr, rr * .5, 0, a0, a0 + 1 + hash(i) * .7);
      }
      ctx.strokeStyle = `rgba(100,68,32,${.55 * alive})`; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = `rgba(252,232,186,${.85 * alive})`; ctx.lineWidth = 3; ctx.stroke();
      const dust = K.puff('dust');
      for (let i = 0; i < 24; i++) {
        const rr = R * (.55 + hash(i * 1.7 + fx.seed) * .5), an = time * 1.6 + hash(i * 4.9 + fx.seed) * TAU, hgt = 10 + hash(i * 6.1) * 170 * rise;
        K.stamp(ctx, dust, fx.x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr * .5 - hgt, 34 + hash(i * 8.3) * 34, .6 * alive, .8);
      }
      // rocks and planks torn up and flung round
      for (let i = 0; i < 6; i++) {
        const rr = R * (.3 + hash(i * 9.1 + fx.seed) * .6), an = time * (2.6 + hash(i) * 1.5) + hash(i * 2.2) * TAU, hgt = 60 + hash(i * 3.9) * 200 * rise;
        rockAt(ctx, fx.x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr * .5 - hgt, 9 + hash(i * 4.4) * 9, time * 4 + i);
      }
      // the twin funnels, drawn back to front
      const p0 = stormPos(fx, 0, { x: 0, y: 0 }), p1 = stormPos(fx, 1, { x: 0, y: 0 });
      const order2 = p0.y < p1.y ? [p0, p1] : [p1, p0];
      for (const p of order2) funnel(ctx, p.x, p.y, 470 * rise, 40, 175 * rise + 20, time * 1.15, fx.seed + p.x * .01, alive, SAND_PAL, (p.x - fx.x) * .25);
    }
    if (t > 3.2) {
      const u = t - 3.3;
      if (u > -.1 && u < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 80, 420, '255,230,170', (1 - Math.abs(u) / .25) * .7, true); ctx.globalCompositeOperation = 'source-over'; }
      if (u > 0) {
        if (u < 1) K.fx.shockRing(ctx, fx.x, fx.y, R * 1.2, u, 1 - u, '250,220,160');
        if (u > .1 && u < 1.1) K.fx.shockRing(ctx, fx.x, fx.y, R * .8, u - .1, 1.1 - u, '255,250,230');
        dustBurst(ctx, fx.x, fx.y, 340, u, fx.seed, 'dust', 18, '#5a3e22');
      }
    }
  }

  // ------------------------------------------------------------------ Mu: Dust Release
  function eraseG(ctx, x, y, r, alpha) {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(52,50,56,${.5 * alpha})`; ctx.beginPath(); ctx.arc(x, y, r * .95, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(128,126,132,${.4 * alpha})`; ctx.beginPath(); ctx.arc(x, y, r * .7, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(235,240,250,${.5 * alpha})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * .95, 0, TAU); ctx.stroke();
  }
  // White motes and tiny cubes rising where matter was erased (overlay).
  function motes(ctx, x, y, r, t, seed, alpha, n = 16) {
    if (alpha <= .01) return;
    ctx.strokeStyle = `rgba(255,255,255,${.85 * alpha})`; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ph = frac(t * .8 + hash(i * 3.1 + seed)), a = hash(i * 7.3 + seed) * TAU, d = r * Math.sqrt(hash(i * 2.2 + seed));
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .5 - ph * 90, s = 3 + 4 * (1 - ph);
      ctx.rect(px - s / 2, py - s / 2, s, s);
    }
    ctx.stroke();
  }
  function coneG(ctx, fx) {
    const fade = 1 - win(fx.age, .6, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(44,44,52,${.42 * fade})`; sector(ctx, 0, 0, 20, fx.len, -fx.half, fx.half); ctx.fill();
    ctx.fillStyle = `rgba(214,222,232,${.28 * fade})`; sector(ctx, 0, 0, 20, fx.len, -fx.half * .5, fx.half * .5); ctx.fill();
    ctx.restore();
  }
  function coneO(ctx, fx, time) {
    const K = Kit(), e = easeOut(fx.age / .12), shrink = win(fx.age, .55, fx.dur), fade = 1 - shrink, L = 44;
    if (fade <= 0) return;
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), len = fx.len * e, rb = Math.tan(fx.half) * len * (1 - shrink * .85);
    const ax = fx.x + ca * 34, ay = fx.y + sa * 34 - L, ex = fx.x + ca * len, ey = fx.y + sa * len - L, px = -sa, py = ca;
    // dark under-layer so the white prism reads on bright ground
    ctx.fillStyle = `rgba(30,40,70,${.28 * fade})`;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex + px * rb * 1.08, ey + py * rb * 1.08 * .9); ctx.lineTo(ex - px * rb * 1.08, ey - py * rb * 1.08 * .9); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(190,215,255,${.3 * fade})`;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex + px * rb, ey + py * rb * .9); ctx.lineTo(ex - px * rb, ey - py * rb * .9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(240,248,255,${.4 * fade})`;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex + px * rb * .45, ey + py * rb * .4); ctx.lineTo(ex - px * rb * .45, ey - py * rb * .4); ctx.closePath(); ctx.fill();
    // cross-section rings of the cone sliding outward
    ctx.strokeStyle = `rgba(255,255,255,${.75 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const d = ((i / 7 + fx.age * 1.6) % 1) * len, rr = rb * d / Math.max(1, len), cx = fx.x + ca * d, cy = fx.y + sa * d - L;
      if (rr < 4) continue;
      ctx.moveTo(cx + Math.cos(fx.a) * rr * .3, cy + Math.sin(fx.a) * rr * .3);
      ctx.ellipse(cx, cy, rr * .3, rr, fx.a, 0, TAU);
    }
    ctx.stroke();
    // bright edges and core
    ctx.strokeStyle = `rgba(255,255,255,${.95 * fade})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex + px * rb, ey + py * rb * .9); ctx.moveTo(ax, ay); ctx.lineTo(ex - px * rb, ey - py * rb * .9); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(ex, ey, rb * .3, rb, fx.a, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${fade})`; ctx.lineWidth = 5 * (1 - shrink) + 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
    for (let i = 0; i < 6; i++) { const d = len * (i + .5) / 6; K.glow(ctx, fx.x + ca * d, fx.y + sa * d - L, rb * d / len * 1.6 + 20, '200,225,255', .35 * fade); }
    if (fx.age < .16) K.glow(ctx, ax, ay, 300, '255,255,255', 1 - fx.age / .16, true);
    // nested cubes streaming down the axis
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const d = (i * 120 + fx.age * 700) % len, sz = Math.max(6, rb * d / len * .7);
      ctx.save(); ctx.translate(fx.x + ca * d, fx.y + sa * d - L); ctx.rotate(time * 2 + i);
      ctx.strokeStyle = `rgba(255,255,255,${.8 * fade})`; ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
      ctx.strokeStyle = `rgba(180,215,255,${.7 * fade})`; ctx.strokeRect(-sz / 4, -sz / 4, sz / 2, sz / 2);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 5; i++) { const d = len * (.15 + i * .2); motes(ctx, fx.x + ca * d, fx.y + sa * d, rb * d / len + 20, fx.age, fx.seed + i, fade, 5); }
  }
  function rocksG(ctx, fx, time) {
    for (const rk of fx.rocks) {
      const u = fx.age - rk.t0;
      if (u < 0) { markCircle(ctx, rk.x, rk.y, rk.r, '214,186,146', 0, time, true); continue; }
      if (u < rk.fl) {
        const k = u / rk.fl;
        ctx.fillStyle = `rgba(20,14,10,${.25 + .35 * k})`; ctx.beginPath(); ctx.ellipse(rk.x, rk.y, rk.r * (.4 + .5 * k), rk.r * (.2 + .25 * k), 0, 0, TAU); ctx.fill();
        markCircle(ctx, rk.x, rk.y, rk.r, '214,186,146', k, time, false);
      } else craterG(ctx, rk.x, rk.y, rk.r, 1 - win(u - rk.fl, 1.4, 2.3), rk.seed);
    }
  }
  function rocksO(ctx, fx, time) {
    const K = Kit(), dust = K.puff('dust');
    for (const rk of fx.rocks) {
      const u = fx.age - rk.t0, R = rk.r * .62;
      if (u < 0) continue;
      if (u < rk.fl) {
        const k = easeIn(u / rk.fl), y = lerp(rk.y - 380, rk.y - R * .5, k), x = rk.x + (1 - k) * 60;
        for (let i = 1; i <= 3; i++) K.stamp(ctx, dust, x + i * 14, y - R - i * 26, R * (.3 + i * .08), .45 - i * .1);
        rockAt(ctx, x, y, R, k * .6 + rk.rot);
        // the Weight-Increase glow pressing it down
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, R * 1.4, '255,220,160', .18); ctx.globalCompositeOperation = 'source-over';
      } else {
        const v = u - rk.fl, sink = 1 - win(v, 1.2, 2.0);
        if (sink > 0) {
          ctx.save(); ctx.beginPath(); ctx.rect(rk.x - R * 1.3, rk.y - R * 2.4, R * 2.6, R * 2.4 + 8); ctx.clip();
          ctx.globalAlpha = sink; rockAt(ctx, rk.x, rk.y - R * .45 + (1 - sink) * R, R, .6 + rk.rot); ctx.restore(); ctx.globalAlpha = 1;
        }
        if (v < .9) K.fx.shockRing(ctx, rk.x, rk.y, rk.r * 1.5, v / .9, 1 - v / .9, '220,200,170');
        dustBurst(ctx, rk.x, rk.y, rk.r * 1.1, v, rk.seed, 'dust', 12);
      }
    }
  }
  // Mu dissolving into thin air (vanish) and condensing behind the target (appear).
  function vanishO(ctx, fx, time) {
    const K = Kit(), k = fx.age / fx.dur, S = Spr();
    if (fx.age < .4 && S) {
      ctx.globalAlpha = .35 * (1 - fx.age / .4);
      ctx.globalCompositeOperation = 'lighter';
      S.draw(ctx, 'mu', fx.x, fx.y + 3 - 16, { frame: 'seal', facing: 1 });
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    motes(ctx, fx.x, fx.y - 40, 40, fx.age * 1.5, fx.seed, 1 - k, 20);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y - 50, 70 * (1 - k) + 20, '220,230,255', .5 * (1 - k));
    ctx.globalCompositeOperation = 'source-over';
    // refraction shimmer where he still stands
    ctx.strokeStyle = `rgba(255,255,255,${.4 * (1 - k)})`; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const r = 20 + i * 14 + k * 30; ctx.beginPath(); ctx.ellipse(fx.x, fx.y - 50, r * .6, r, 0, 0, TAU); ctx.stroke(); }
  }
  function appearO(ctx, fx, time) {
    const K = Kit(), k = fx.age / fx.dur;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y - 50, 90 * (1 - k) + 20, '230,240,255', .7 * (1 - k), true);
    ctx.globalCompositeOperation = 'source-over';
    if (k < .5) {
      const q = k / .5;
      ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y - 120 * (1 - q)); ctx.lineTo(fx.x, fx.y + 10); ctx.stroke();
    }
    K.fx.shockRing(ctx, fx.x, fx.y, 110, k, 1 - k, '230,240,255');
    motes(ctx, fx.x, fx.y - 30, 50, 1 - fx.age, fx.seed, 1 - k, 14);
  }
  function invisShimmer(ctx, z, st, time) {
    // a faint heat-haze outline is all that betrays him
    const x = z.x, y = z.y - 50;
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ph = frac(time * 1.4 + i / 3), r = 18 + ph * 26;
      ctx.moveTo(x + r * .55, y); ctx.ellipse(x, y + Math.sin(time * 5 + i) * 3, r * .55, r * 1.2, 0, 0, TAU);
    }
    ctx.stroke();
  }
  function cubeG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .9, fx.dur);
    if (fx.age > .2) eraseG(ctx, fx.x, fx.y, fx.R, fade);
    const s = cubeScale(fx);
    if (s > .01) { ctx.fillStyle = `rgba(255,255,255,${.25 * s})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * s, 0, TAU); ctx.fill(); }
  }
  function cubeScale(fx) { const t = fx.age; return t < .2 ? easeOut(t / .2) : t < .6 ? 1 : 1 - easeIn((t - .6) / .25); }
  function cubeO(ctx, fx, time) {
    const K = Kit(), s = cubeScale(fx), S = fx.R * .72 * s;
    if (s > .01) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - S * .7, S * 2, '190,215,255', .3 * s);
      ctx.globalCompositeOperation = 'source-over';
      drawCube(ctx, fx.x, fx.y + S * .35, S, time * .6 + fx.seed, .85, 'rgba(225,238,255,.25)', 'rgba(255,255,255,.95)', S * 1.4);
      drawCube(ctx, fx.x, fx.y + S * .05, S * .45, -time * 1.4, .9, 'rgba(240,248,255,.4)', 'rgba(170,210,255,.95)', S * .63);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - S * .25, S * .55, '255,255,255', .6 * s, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    const u = fx.age - .6;
    ctx.globalCompositeOperation = 'lighter';
    if (u > 0 && u < .4) K.glow(ctx, fx.x, fx.y - 50, fx.R * 1.4, '255,255,255', (1 - u / .4) * .75, true);
    if (fx.age < .18) K.glow(ctx, fx.x, fx.y - 50, fx.R, '255,255,255', .6 * (1 - fx.age / .18), true);
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age > .2 && fx.age < 1.3) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.5, (fx.age - .2) / 1.1, 1 - (fx.age - .2) / 1.1, '240,248,255');
    motes(ctx, fx.x, fx.y, fx.R, fx.age, fx.seed, 1 - win(fx.age, 1, fx.dur), 14);
    if (u > 0) dustBurst(ctx, fx.x, fx.y, fx.R * .9, u, fx.seed, 'dust', 10);
  }
  function splitBeamsG(ctx, fx) {
    for (const b of fx.beams) coneG(ctx, { x: b.x, y: b.y, a: b.a, len: b.len, half: .07, age: fx.age, dur: fx.dur });
  }
  const SB = { x: 0, y: 0, a: 0, len: 0, half: .07, age: 0, dur: 0, seed: 0 };
  function splitBeamsO(ctx, fx, time) {
    for (const b of fx.beams) {
      SB.x = b.x; SB.y = b.y; SB.a = b.a; SB.len = b.len; SB.age = fx.age; SB.dur = fx.dur; SB.seed = fx.seed;
      coneO(ctx, SB, time);
    }
  }
  // Mu's split half: the same body, a pale seam down its middle while it forms.
  function drawClone(ctx, z, x, y, facing, frame, alpha, time) {
    const S = Spr();
    if (!S || alpha <= .01) return;
    const lift = members.mu.lift + Math.sin(time * 2.2 + 1) * 4;
    S.shadow(ctx, x, y + 3, 24, .3 * alpha);
    S.draw(ctx, 'mu', x, y + 3 - lift, { frame, facing, alpha });
  }
  // Icosahedron for the giant Dust Release prism.
  const PHI = (1 + Math.sqrt(5)) / 2;
  const ICO_V = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]]
    .map(v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; });
  const ICO_E = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.hypot(ICO_V[i][0] - ICO_V[j][0], ICO_V[i][1] - ICO_V[j][1], ICO_V[i][2] - ICO_V[j][2]) < 1.2) ICO_E.push([i, j]);
  const ICO_P = new Float32Array(36);
  function prism(ctx, cx, cy, S, ry, rx, alpha) {
    const cy1 = Math.cos(ry), sy1 = Math.sin(ry), cx1 = Math.cos(rx), sx1 = Math.sin(rx);
    for (let i = 0; i < 12; i++) {
      const [x, y, z] = ICO_V[i];
      const x1 = x * cy1 + z * sy1, z1 = -x * sy1 + z * cy1, y2 = y * cx1 - z1 * sx1, z2 = y * sx1 + z1 * cx1;
      ICO_P[i * 3] = cx + x1 * S; ICO_P[i * 3 + 1] = cy + y2 * S * .92; ICO_P[i * 3 + 2] = z2;
    }
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (const [i, j] of ICO_E) {
        const front = ICO_P[i * 3 + 2] + ICO_P[j * 3 + 2] > 0;
        if (front !== (pass === 1)) continue;
        ctx.moveTo(ICO_P[i * 3], ICO_P[i * 3 + 1]); ctx.lineTo(ICO_P[j * 3], ICO_P[j * 3 + 1]);
      }
      if (pass === 0) { ctx.strokeStyle = `rgba(190,215,255,${.45 * alpha})`; ctx.lineWidth = 2; ctx.stroke(); }
      else {
        ctx.strokeStyle = `rgba(40,60,110,${.45 * alpha})`; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.95 * alpha})`; ctx.lineWidth = 3; ctx.stroke();
      }
    }
  }
  function dustBallSprite() {
    return Kit().sphere('lg:dustball', [[0, 'rgba(255,255,255,.55)'], [.45, 'rgba(225,238,255,.22)'], [.8, 'rgba(200,222,255,.35)'], [.94, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']], .4, .36);
  }
  function bigDustScale(fx) { const t = fx.age; return t < .25 ? easeOut(t / .25) : t < 1.5 ? 1 : 1 - easeIn((t - 1.5) / .3); }
  function bigDustG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - 1.2, fx.dur), s = bigDustScale(fx);
    if (fx.age > .25) {
      eraseG(ctx, fx.x, fx.y, fx.R, fade);
      craterG(ctx, fx.x, fx.y, fx.R * .55, fade * .8, fx.seed);
    }
    if (s > .01) { ctx.fillStyle = `rgba(255,255,255,${.3 * s})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * s, 0, TAU); ctx.fill(); }
  }
  function bigDustO(ctx, fx, time) {
    const K = Kit(), s = bigDustScale(fx), S = fx.R * .9 * s, cy = fx.y - S * .45;
    if (s > .01) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, cy, S * 1.9, '190,215,255', .35 * s);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = .9; ctx.drawImage(dustBallSprite(), fx.x - S, cy - S * .92, S * 2, S * 1.84); ctx.globalAlpha = 1;
      prism(ctx, fx.x, cy, S * .95, time * .7 + fx.seed, .4 + time * .3, s);
      prism(ctx, fx.x, cy, S * .42, -time * 1.6, -.3 - time * .5, s);
      drawCube(ctx, fx.x, cy + S * .12, S * .16, time * 2, .9, 'rgba(240,248,255,.5)', '#ffffff', S * .22);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, cy, S * .5, '255,255,255', .75 * s, true);
      // fracture light racing over the surface
      ctx.strokeStyle = `rgba(255,255,255,${.7 * s})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = hash(i * 3.1 + Math.floor(time * 8)) * TAU, r0 = S * .2, r1 = S * (.6 + hash(i * 5.5 + Math.floor(time * 8)) * .35);
        ctx.moveTo(fx.x + Math.cos(a) * r0, cy + Math.sin(a) * r0 * .92); ctx.lineTo(fx.x + Math.cos(a + .2) * r1, cy + Math.sin(a + .2) * r1 * .92);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    const u = fx.age - 1.5;
    ctx.globalCompositeOperation = 'lighter';
    if (fx.age < .22) K.glow(ctx, fx.x, fx.y - 80, fx.R * 1.2, '255,255,255', .8 * (1 - fx.age / .22), true);
    if (u > 0 && u < .5) K.glow(ctx, fx.x, fx.y - 80, fx.R * 1.5, '255,255,255', (1 - u / .5) * .85, true);
    if (u > 0 && u < .7) {
      ctx.strokeStyle = `rgba(255,255,255,${.85 * (1 - u / .7)})`; ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + fx.seed, r0 = 60 + u * 500, r1 = r0 + 160; ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y - 80 + Math.sin(a) * r0 * .6); ctx.lineTo(fx.x + Math.cos(a) * r1, fx.y - 80 + Math.sin(a) * r1 * .6); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age > .25 && fx.age < 1.6) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.35, (fx.age - .25) / 1.35, 1 - (fx.age - .25) / 1.35, '240,248,255');
    if (u > 0 && u < 1.1) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * .9, u / 1.1, 1 - u / 1.1, '255,255,255');
    motes(ctx, fx.x, fx.y, fx.R * .9, fx.age, fx.seed, 1 - win(fx.age, 1.4, fx.dur), 26);
    if (u > 0) dustBurst(ctx, fx.x, fx.y, fx.R * .8, u, fx.seed, 'dust', 16);
  }

  // ------------------------------------------------------------------ Obito: Ten-Tails
  function rodsG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const r of fx.rods) {
      const d = Math.min(r.len, fx.age * fx.speed), c = Math.cos(r.a), s = Math.sin(r.a);
      ctx.strokeStyle = `rgba(40,20,70,${.25 * fade})`; ctx.lineWidth = 14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r.x0, r.y0); ctx.lineTo(r.x0 + c * d, r.y0 + s * d); ctx.stroke();
      if (d >= r.len) {
        const ex = r.x0 + c * r.len, ey = r.y0 + s * r.len;
        ctx.strokeStyle = `rgba(30,20,20,${.6 * fade})`; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = hash(i * 3.3 + r.seed) * TAU, l = 20 + hash(i * 1.7 + r.seed) * 30; ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a) * l * .6, ey + Math.sin(a) * l * .3); ctx.lineTo(ex + Math.cos(a + .3) * l, ey + Math.sin(a + .3) * l * .5); }
        ctx.stroke();
      }
    }
  }
  function rodsO(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .6, fx.dur), L = 38;
    for (const r of fx.rods) {
      const fly = fx.age * fx.speed, c = Math.cos(r.a), s = Math.sin(r.a);
      if (fly < r.len) {
        const x = r.x0 + c * fly, y = r.y0 + s * fly - L;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(170,140,255,.45)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - c * 110, y - s * 110); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        drawRod(ctx, x, y, Math.atan2(s, c), 64, 8);
      } else {
        // the rod drives into the ground at a slant and stays a moment
        const v = fx.age - r.len / fx.speed, ex = r.x0 + c * r.len, ey = r.y0 + s * r.len;
        ctx.globalAlpha = fade;
        drawRod(ctx, ex - c * 14, ey - 22, Math.atan2(s * .3 + .9, c * .5), 58, 8);
        ctx.globalAlpha = 1;
        if (v < .6) { K.fx.shockRing(ctx, ex, ey, 90, v / .6, 1 - v / .6, '190,160,255'); K.fx.debris(ctx, ex, ey, 70, v / .6, r.seed, '#2a2030', 8); }
      }
    }
  }
  function trailG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .4, fx.dur);
    const d = Math.min(fx.len, fx.age * 1700), c = Math.cos(fx.a), s = Math.sin(fx.a);
    ctx.strokeStyle = `rgba(30,20,50,${.3 * fade})`; ctx.lineWidth = 40; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x0 + c * d, fx.y0 + s * d); ctx.stroke();
  }
  function trailO(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .4, fx.dur);
    const d = Math.min(fx.len, fx.age * 1700), c = Math.cos(fx.a), s = Math.sin(fx.a), y0 = fx.y0 - 50;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.strokeStyle = `rgba(${i % 2 ? '200,180,255' : '255,255,255'},${.5 * fade})`; ctx.lineWidth = 3 - Math.abs(i) * .5;
      ctx.beginPath(); ctx.moveTo(fx.x0 - s * i * 12, y0 + c * i * 12); ctx.lineTo(fx.x0 + c * d - s * i * 12, y0 + s * d + c * i * 12); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function sweepO(ctx, z, fx, time) {
    const K = Kit(), x = fx.x, cy = fx.y - 40, p = easeOut(fx.age / .32), fade = 1 - win(fx.age, .32, fx.dur), R = 300;
    const th0 = fx.a - fx.side * Math.PI, th = th0 + fx.side * TAU * p;
    const lo = fx.side > 0 ? Math.max(th0, th - 2.6) : th, hi = fx.side > 0 ? th : Math.min(th0, th + 2.6);
    ctx.save();
    if (hi - lo > .02) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(30,12,60,.5)'; sector(ctx, x, cy, 60, R, lo, hi, .5); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(170,140,255,.32)'; sector(ctx, x, cy, 170, R, lo, hi, .5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; sector(ctx, x, cy, 250, R, lo, hi, .5); ctx.fill();
      ctx.strokeStyle = 'rgba(235,225,255,.95)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, cy, R - 4, (R - 4) * .5, 0, lo, hi); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    if (fx.age < .45) {
      const ex = Math.cos(th) * 170, ey = Math.sin(th) * 85;
      drawStaff(ctx, x, cy, Math.atan2(ey, ex), Math.hypot(ex, ey), 1);
    }
    ctx.restore();
    if (fx.age < .9) K.fx.shockRing(ctx, fx.x, fx.y, R * 1.3, fx.age / .9, 1 - fx.age / .9, '200,180,255');
    dustBurst(ctx, fx.x, fx.y, R * .8, fx.age, fx.seed, 'dust', 12, '#2a2030');
  }
  function kamuiG(ctx, fx, time) {
    const K = Kit(), t = fx.age, open = easeOut(t / .35), close = win(t, 1.9, 2.2), k = open * (1 - close), fade = 1 - win(t, 2.2, fx.dur);
    if (k > .01) {
      ctx.fillStyle = `rgba(30,10,50,${.35 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.R * k, fx.R * .55 * k, 0, 0, TAU); ctx.fill();
      K.spin(ctx, kamuiSwirl(), fx.x, fx.y, fx.R * k, time * 3.2, .6 * k, .55);
    }
    if (t > 2.1) craterG(ctx, fx.x, fx.y, 170, fade, fx.seed);
  }
  function kamuiO(ctx, fx, time) {
    const K = Kit(), t = fx.age, open = easeOut(t / .35), close = win(t, 1.9, 2.15), k = open * (1 - close);
    const cx = fx.x, cy = fx.y - 46, R = fx.R;
    if (k > .01) {
      // the space itself twisting into the vortex
      ctx.globalAlpha = .85 * k;
      K.spin(ctx, kamuiSwirl(), cx, cy, R * .78 * k, time * 4.4, 1, .62);
      ctx.globalAlpha = 1;
      // warped rings sucked inward
      ctx.lineWidth = 2;
      for (let j = 0; j < 5; j++) {
        const q = frac(-time * .7 + j / 5), rr = R * (.15 + .9 * q) * k;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const th = i / 40 * TAU, w = 1 + .08 * Math.sin(th * 5 + time * 7 + j);
          const px = cx + Math.cos(th + time * 2) * rr * w, py = cy + Math.sin(th + time * 2) * rr * .6 * w;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.strokeStyle = `rgba(40,16,70,${.45 * q * k})`; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = `rgba(225,210,255,${.85 * q * k})`; ctx.lineWidth = 1.8; ctx.stroke();
      }
      // debris spiralling in and shrinking
      ctx.fillStyle = '#2a2230';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const q = frac(t * .6 + hash(i * 2.3 + fx.seed)), rr = R * (1 - q) * k, an = hash(i * 5.1 + fx.seed) * TAU + q * 6;
        const px = cx + Math.cos(an) * rr, py = cy + Math.sin(an) * rr * .6 + (1 - q) * 40, sz = 7 * (1 - q) + 1, rot = time * 6 + i;
        ctx.moveTo(px + Math.cos(rot) * sz, py + Math.sin(rot) * sz); ctx.lineTo(px + Math.cos(rot + 2.1) * sz, py + Math.sin(rot + 2.1) * sz); ctx.lineTo(px + Math.cos(rot + 4.1) * sz * .8, py + Math.sin(rot + 4.1) * sz * .8); ctx.closePath();
      }
      ctx.fill();
      // the black eye in the middle, ringed in violet
      const hr = 26 + 14 * Math.sin(time * 6) * .3 + 18 * k;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx, cy, hr * 3, '150,100,255', .55 * k);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(8,2,14,.95)'; ctx.beginPath(); ctx.ellipse(cx, cy, hr * k, hr * .7 * k, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(200,170,255,${.9 * k})`; ctx.lineWidth = 2.5; ctx.stroke();
    }
    if (t > 2.05 && t < 2.6) {
      const u = (t - 2.05) / .55;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx, cy, 200 * (1 - u) + 40, '190,150,255', (1 - u) * .8, true);
      ctx.globalCompositeOperation = 'source-over';
      K.fx.shockRing(ctx, fx.x, fx.y, 260, u, 1 - u, '180,140,255');
    }
    if (t > 2.1) dustBurst(ctx, fx.x, fx.y, 180, t - 2.1, fx.seed, 'dust', 10, '#2a2030');
  }
  function beamG(ctx, fx) {
    const fade = 1 - win(fx.age, .9, fx.dur), len = Math.min(fx.len, fx.age * 4000);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(26,10,40,${.45 * fade})`; ctx.fillRect(20, -fx.w * .9, len, fx.w * 1.8);
    ctx.fillStyle = `rgba(140,90,220,${.25 * fade})`; ctx.fillRect(20, -fx.w * .4, len, fx.w * .8);
    ctx.restore();
  }
  function beamO(ctx, fx, time) {
    const K = Kit(), len = Math.min(fx.len, fx.age * 4000), shrink = win(fx.age, .6, fx.dur), fade = 1 - shrink;
    if (fade <= 0) return;
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), x0 = fx.x + ca * 30, y0 = fx.y - fx.h, x1 = fx.x + ca * len, y1 = fx.y + sa * len - 40;
    const w = fx.w * (1 - shrink * .8) * (1 + .06 * Math.sin(time * 40));
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(30,8,50,${.6 * fade})`; ctx.lineWidth = w * 1.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(150,90,255,${.55 * fade})`; ctx.lineWidth = w * 1.2; ctx.stroke();
    ctx.strokeStyle = `rgba(230,210,255,${.6 * fade})`; ctx.lineWidth = w * .75; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(8,2,14,${.92 * fade})`; ctx.lineWidth = w * .45; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    // spiralling chakra rings around the beam
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(220,200,255,${.75 * fade})`; ctx.lineWidth = 2.5;
    ctx.beginPath();
    const n = Math.max(1, Math.floor(len / 90));
    for (let i = 0; i < n; i++) {
      const d = (i * 90 + fx.age * 1600) % Math.max(1, len), k2 = d / Math.max(1, len), px = lerp(x0, x1, k2), py = lerp(y0, y1, k2);
      ctx.moveTo(px + Math.cos(fx.a) * w * .2, py + Math.sin(fx.a) * w * .2); ctx.ellipse(px, py, w * .2, w * .62, fx.a, 0, TAU);
    }
    ctx.stroke();
    for (let i = 0; i < 6; i++) { const k2 = (i + .5) / 6; K.glow(ctx, lerp(x0, x1, k2), lerp(y0, y1, k2), w * 1.6, '150,90,255', .3 * fade); }
    if (fx.age < .2) K.glow(ctx, x0, y0, 220, '220,190,255', (1 - fx.age / .2), true);
    K.glow(ctx, x0, y0, w * .9, '255,255,255', .5 * fade, true);
    ctx.globalCompositeOperation = 'source-over';
  }
  function blastO(ctx, fx, time) {
    const K = Kit(), k = fx.age / fx.dur;
    K.fx.beastBlast(ctx, fx.x, fx.y, fx.R, Math.min(1, fx.age / 1.1), 1 - win(k, .7, 1), time, fx.seed);
    dustBurst(ctx, fx.x, fx.y, fx.R * .9, fx.age, fx.seed, 'dust', 12, '#2a2030');
  }
  const BARK = ['#2c2318', '#8a7558', '#cbb991'];
  function rootSpike(ctx, x, y, g, w, lean, seed) {
    if (g <= 0) return;
    const h = (70 + hash(seed) * 50) * g, tx = x + lean * g, ty = y - h;
    ctx.fillStyle = BARK[0]; tube(ctx, x, y + 4, x - lean * .3, y - h * .5, tx, ty, 0, 1, w + 2, 1.5); ctx.fill();
    ctx.fillStyle = BARK[1]; tube(ctx, x, y + 4, x - lean * .3, y - h * .5, tx, ty, 0, 1, w, .6); ctx.fill();
    ctx.fillStyle = BARK[2]; tube(ctx, x - w * .3, y, x - lean * .3 - w * .3, y - h * .5, tx - 1, ty + 4, .05, .9, w * .28, .2); ctx.fill();
  }
  function rootArc(ctx, x, y, a, reach, rise, w, g) {
    if (g <= 0) return;
    const ex = x + Math.cos(a) * reach, ey = y + Math.sin(a) * reach * .5 - rise, cx = x + Math.cos(a) * reach * .5, cy = y + Math.sin(a) * reach * .25 - rise * 1.6;
    ctx.fillStyle = BARK[0]; tube(ctx, x, y + 2, cx, cy, ex, ey + rise, 0, g, w + 2, 1.5); ctx.fill();
    ctx.fillStyle = BARK[1]; tube(ctx, x, y + 2, cx, cy, ex, ey + rise, 0, g, w, .7); ctx.fill();
    ctx.fillStyle = BARK[2]; tube(ctx, x, y - w * .3, cx, cy - w * .3, ex, ey + rise - w * .3, .05, g * .9, w * .26, .2); ctx.fill();
  }
  function rootsG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const sp of fx.spots) {
      const u = fx.age - sp.delay;
      if (u < 0) { ctx.strokeStyle = 'rgba(40,30,20,.5)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = hash(i + sp.seed) * TAU; ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x + Math.cos(a) * 40 * (1 + u), sp.y + Math.sin(a) * 20 * (1 + u)); } ctx.stroke(); continue; }
      craterG(ctx, sp.x, sp.y, 70, fade * .85, sp.seed);
    }
  }
  function rootsO(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .6, fx.dur), wither = win(fx.age, fx.dur - .9, fx.dur);
    // binding cage: the outer roots arch over the centre and close
    const cage = easeOut(win(fx.age, .9, 1.3)) * (1 - wither);
    ctx.globalAlpha = fade;
    if (cage > 0) {
      const top = fx.y - 150;
      for (let i = 1; i < fx.spots.length; i++) {
        const sp = fx.spots[i];
        if (sp.y > fx.y) continue;
        ctx.fillStyle = BARK[0]; tube(ctx, sp.x, sp.y, (sp.x + fx.x) / 2, Math.min(sp.y, fx.y) - 190, fx.x, top, 0, cage, 12, 4); ctx.fill();
        ctx.fillStyle = BARK[1]; tube(ctx, sp.x, sp.y, (sp.x + fx.x) / 2, Math.min(sp.y, fx.y) - 190, fx.x, top, 0, cage, 10, 3); ctx.fill();
      }
    }
    // eruptions, back to front
    for (const sp of fx.spots) {
      const u = fx.age - sp.delay;
      if (u < 0) continue;
      const g = easeOut(u / .22) * (1 - wither * .9);
      for (let j = 0; j < 3; j++) rootArc(ctx, sp.x, sp.y, hash(j * 3.3 + sp.seed) * TAU, 60 + hash(j + sp.seed) * 50, 30 + hash(j * 2 + sp.seed) * 30, 7, g);
      rootSpike(ctx, sp.x, sp.y, g, 13, (hash(sp.seed * 1.3) - .5) * 40, sp.seed);
      if (u < 1.2) dustBurst(ctx, sp.x, sp.y, 90, u, sp.seed, 'dust', 8);
    }
    if (cage > 0) {
      const top = fx.y - 150;
      for (let i = 1; i < fx.spots.length; i++) {
        const sp = fx.spots[i];
        if (sp.y <= fx.y) continue;
        ctx.fillStyle = BARK[0]; tube(ctx, sp.x, sp.y, (sp.x + fx.x) / 2, fx.y - 190, fx.x, top, 0, cage, 12, 4); ctx.fill();
        ctx.fillStyle = BARK[1]; tube(ctx, sp.x, sp.y, (sp.x + fx.x) / 2, fx.y - 190, fx.x, top, 0, cage, 10, 3); ctx.fill();
        ctx.fillStyle = BARK[2]; tube(ctx, sp.x - 3, sp.y - 3, (sp.x + fx.x) / 2 - 3, fx.y - 193, fx.x, top - 2, .05, cage * .9, 3, 1); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, top, 50 * cage, '220,200,150', .3 * cage);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    if (fx.age > 2.45) dustBurst(ctx, fx.x, fx.y, 200, fx.age - 2.45, fx.seed, 'dust', 12);
  }
  function gaeshiO(ctx, fx, time) {
    const K = Kit(), k = fx.age / fx.dur, fade = 1 - easeIn(k), cy = fx.y - 34, R = fx.R;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const r = 50 + easeOut(k * 1.25 - i * .1) * (R - 50);
      if (r < 52) continue;
      ctx.globalAlpha = fade * (1 - i * .2);
      ctx.fillStyle = 'rgba(40,70,140,.35)'; sector(ctx, fx.x, cy, Math.max(0, r - 46), r, fx.a - fx.h, fx.a + fx.h, .55); ctx.fill();
      ctx.fillStyle = 'rgba(105,160,250,.45)'; sector(ctx, fx.x, cy, Math.max(0, r - 34), r, fx.a - fx.h, fx.a + fx.h, .55); ctx.fill();
      ctx.fillStyle = 'rgba(236,246,255,.6)'; sector(ctx, fx.x, cy, Math.max(0, r - 12), r, fx.a - fx.h * .95, fx.a + fx.h * .95, .55); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(225,240,255,.9)'; ctx.lineWidth = 3.5 - i * .6;
      ctx.beginPath(); ctx.ellipse(fx.x, cy, r, r * .55, 0, fx.a - fx.h, fx.a + fx.h); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = fade;
    ctx.strokeStyle = 'rgba(240,248,255,.85)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = fx.a + (hash(i * 3.3 + fx.seed) - .5) * 2 * fx.h, d0 = 40 + easeOut(k) * R * .6 + hash(i) * 50, d1 = d0 + 60 + hash(i * 2) * 60;
      ctx.moveTo(fx.x + Math.cos(a) * d0, cy + Math.sin(a) * d0 * .55); ctx.lineTo(fx.x + Math.cos(a) * d1, cy + Math.sin(a) * d1 * .55);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x + Math.cos(fx.a) * 50, cy + Math.sin(fx.a) * 26, 120, '170,210,255', fade * .6);
    ctx.restore();
    if (fx.age < .5) drawGunbai(ctx, fx.x + Math.cos(fx.a) * 34, fx.y - 64 + Math.sin(fx.a) * 14, 46, (Math.cos(fx.a) >= 0 ? 1 : -1) * (.25 + fx.age * 2), 1 - fx.age / .5);
  }
  // A Tailed-Beast Ball: black core, violet rim, white chakra wound round it.
  function drawTbb(ctx, x, y, r, time, seed, power) {
    const K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 2.6, '140,80,255', .45 * power);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(40,10,70,.6)'; ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, TAU); ctx.fill();
    ctx.drawImage(tbbSprite(), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'lighter';
    K.spin(ctx, chakraSwirl(), x, y, r * 1.12, time * 7 + seed, .5 * power);
    ctx.strokeStyle = `rgba(230,210,255,${.8 * power})`; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const t0 = time * (3 + i) + i * 2; ctx.moveTo(x + Math.cos(t0) * r * 1.2, y + Math.sin(t0) * r * .4); ctx.ellipse(x, y, r * 1.2, r * .4, i * 1.05 + time * .5, t0, t0 + 2.4); }
    ctx.stroke();
    K.glow(ctx, x - r * .35, y - r * .4, r * .35, '255,255,255', .35 * power, true);
    ctx.globalCompositeOperation = 'source-over';
  }
  function tbbG(ctx, fx, time) {
    const t = fx.age, u = t - fx.fly, fade = 1 - win(t, fx.dur - 1, fx.dur);
    if (u < 0) markCircle(ctx, fx.x, fx.y, fx.R, '175,115,255', 1, time, false);
    else {
      ctx.fillStyle = `rgba(30,10,46,${.45 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * .95, 0, TAU); ctx.fill();
      craterG(ctx, fx.x, fx.y, fx.R * .6, fade, fx.seed);
    }
  }
  function tbbO(ctx, fx, time) {
    const K = Kit(), t = fx.age, u = t - fx.fly;
    if (u < 0) {
      const k = t / fx.fly, e = easeIn(k), x = lerp(fx.sx, fx.x, e), y = lerp(fx.sy, fx.y - 60, e) - Math.sin(Math.PI * k) * 120;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(150,100,255,.35)'; ctx.lineWidth = 60;
      ctx.beginPath(); ctx.moveTo(lerp(fx.sx, fx.x, Math.max(0, e - .15)), lerp(fx.sy, fx.y - 60, Math.max(0, e - .15)) - Math.sin(Math.PI * Math.max(0, k - .15)) * 120); ctx.lineTo(x, y); ctx.stroke();
      drawTbb(ctx, x, y, 110 + 30 * k, time, fx.seed, 1);
      return;
    }
    const k = Math.min(1, u / 1.4);
    ctx.globalCompositeOperation = 'lighter';
    if (u < .3) K.glow(ctx, fx.x, fx.y - 120, fx.R * 1.5, '230,210,255', (1 - u / .3), true);
    ctx.globalCompositeOperation = 'source-over';
    K.fx.beastBlast(ctx, fx.x, fx.y, fx.R, k, 1 - win(u, 2.4, fx.dur - fx.fly), time, fx.seed);
    // a black inner dome the beast's chakra burns out of
    if (u < .5) {
      const q = u / .5, r = fx.R * (.3 + .4 * easeOut(q));
      ctx.fillStyle = `rgba(10,2,18,${.85 * (1 - q)})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, r * .8, 0, Math.PI, TAU); ctx.ellipse(fx.x, fx.y, r, r * .45, 0, 0, Math.PI); ctx.fill();
    }
    if (u < 1.2) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.5, u / 1.2, 1 - u / 1.2, '200,150,255');
    if (u > .2 && u < 1.6) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.9, (u - .2) / 1.4, 1 - (u - .2) / 1.4, '255,240,255');
    dustBurst(ctx, fx.x, fx.y, fx.R * .95, u, fx.seed, 'dust', 18, '#2a2030');
    for (let i = 0; i < 6; i++) {
      const q = clamp01(u / 1.2 - hash(i) * .1), a = hash(i * 3.7 + fx.seed) * TAU, d = fx.R * (.3 + q * .8);
      if (q <= 0 || q >= 1) continue;
      rockAt(ctx, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * .5 - Math.sin(Math.PI * q) * 200, 14 + hash(i * 2.2) * 12, q * 8 + i);
    }
  }

  const FX = {
    gale: [galeG, galeO], vacuum: [vacuumG, vacuumO], tornado: [tornadoG, tornadoO], blades: [bladesG, bladesO],
    sandstorm: [sandstormG, sandstormO], storm: [stormG, stormO],
    cone: [coneG, coneO], rocks: [rocksG, rocksO], vanish: [null, vanishO], appear: [null, appearO], cube: [cubeG, cubeO],
    splitBeams: [splitBeamsG, splitBeamsO], bigDust: [bigDustG, bigDustO],
    rods: [rodsG, rodsO], trail: [trailG, trailO], sweep: [null, sweepO], kamui: [kamuiG, kamuiO], beam: [beamG, beamO],
    blast: [null, blastO], roots: [rootsG, rootsO], gaeshi: [null, gaeshiO], tbb: [tbbG, tbbO]
  };

  // ------------------------------------------------------------------ windup looks
  function chargeAura(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, lift = bodyLift(z), cx = z.x, cy = z.y - lift - 34;
    if (z.bossId === 'kazekage1') {
      // air whirling round him, dust lifting off the ground
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const r = 34 + i * 7 + 10 * k, a0 = time * (6 - i * .4) + i * 1.3, y = cy + 26 - i * 9;
        ctx.moveTo(cx + Math.cos(a0) * r, y + Math.sin(a0) * r * .32); ctx.ellipse(cx, y, r, r * .32, 0, a0, a0 + 2);
      }
      ctx.strokeStyle = 'rgba(50,82,90,.45)'; ctx.lineWidth = 4.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.8; ctx.stroke();
      const dust = K.puff('dust');
      for (let i = 0; i < 6; i++) { const a = time * 3 + i / 6 * TAU, r = 44 + 10 * Math.sin(time * 4 + i); K.stamp(ctx, dust, cx + Math.cos(a) * r, z.y + Math.sin(a) * r * .4 - 4, 12 + 6 * k, .6, .7); }
    } else if (z.bossId === 'mu') {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx + 10, cy - 4, 30 + 34 * k, '230,240,255', .55);
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const ph = (time * 1.2 + i / 6) % 1, sz = 5 + 4 * (1 - ph);
        ctx.save(); ctx.translate(cx + Math.sin(i * 2.7) * 32, cy + 26 - ph * 64); ctx.rotate(time * 2 + i);
        ctx.globalAlpha = bell(ph); ctx.strokeRect(-sz / 2, -sz / 2, sz, sz); ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else if (z.bossId === 'obito_rikudo') {
      // black-and-white chakra licking off his body
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx, cy, 50 + 30 * k, '150,110,255', .35);
      ctx.globalCompositeOperation = 'source-over';
      const vio = K.puff('violet');
      for (let i = 0; i < 6; i++) { const ph = (time * 1.3 + i / 6) % 1; K.stamp(ctx, vio, cx + Math.sin(i * 2.3 + time) * 26, cy + 34 - ph * 80, 10 + 8 * (1 - ph), bell(ph) * .7); }
    }
  }
  function windupOverlay(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), lift = bodyLift(z), f = Math.cos(st.aim) >= 0 ? 1 : -1;
    switch (st.move) {
      case 'vacuum': case 'gale': {
        // he draws in a huge breath: streaks converge on his mouth
        const mx = z.x + f * 14, my = z.y - lift - 70;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = hash(i * 3.1) * TAU, q = frac(time * 1.8 + hash(i * 1.7)), d0 = 140 * (1 - q) + 20, d1 = d0 + 40;
          ctx.moveTo(mx + Math.cos(a) * d1, my + Math.sin(a) * d1 * .7); ctx.lineTo(mx + Math.cos(a) * d0, my + Math.sin(a) * d0 * .7);
        }
        ctx.strokeStyle = 'rgba(50,82,90,.4)'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6; ctx.stroke();
        if (st.move === 'vacuum') { ctx.globalAlpha = .85; ctx.drawImage(vacSprite(), mx + f * 10 - 14 * e, my - 14 * e, 28 * e, 28 * e); ctx.globalAlpha = 1; }
        break;
      }
      case 'tornado': {
        for (const l of st.lanes || []) {
          const x = l.x0, y = l.y0;
          funnel(ctx, x, y, 120 * e, 12, 40 * e + 6, time, l.a * 7, .8 * e, WIND_PAL, 0);
        }
        break;
      }
      case 'blades': {
        const img = bladeSprite();
        for (let i = 0; i < 5; i++) {
          const a = time * 5 + i / 5 * TAU, x = z.x + Math.cos(a) * 60, y = z.y - lift - 60 + Math.sin(a) * 24;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = e; ctx.drawImage(img, -24, -15, 48, 24); ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'sandstorm': case 'storm': {
        const big = st.move === 'storm', R = (big ? 560 : 330) * (.3 + .7 * e), dust = K.puff('dust');
        for (let i = 0; i < (big ? 14 : 10); i++) { const a = i / (big ? 14 : 10) * TAU + time * 1.4, d = R; K.stamp(ctx, dust, st.tx + Math.cos(a) * d, st.ty + Math.sin(a) * d * .5 - 14, 18 + 14 * k, .6, .7); }
        if (big) funnel(ctx, z.x, z.y, 200 * e, 20, 70 * e + 10, time, 3.3, .85 * e, SAND_PAL, 0);
        break;
      }
      case 'jinton': case 'ambush': {
        const hx = z.x + Math.cos(st.aim) * 26, hy = z.y - lift - 40 + Math.sin(st.aim) * 12, s = 6 + 16 * k;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, hx, hy, 40 + 60 * k, '230,240,255', .75, true);
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hx - 46 * (1 - k), hy - 34 * (1 - k)); ctx.lineTo(hx, hy); ctx.lineTo(hx + 46 * (1 - k), hy - 34 * (1 - k)); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        drawCube(ctx, hx, hy + s * .4, s, time * 3, .9, 'rgba(240,248,255,.5)', '#ffffff', s * 1.4);
        break;
      }
      case 'cubes': {
        for (const c of st.tele) drawCube(ctx, c.x, c.y - 120, 8 + 22 * e, time * 2.4, .75, 'rgba(225,238,255,.4)', '#ffffff', (8 + 22 * e) * 1.4);
        break;
      }
      case 'boulders': {
        const R = 40 + 50 * e, y = z.y - lift - 140 - 50 * k;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, y, R * 1.6, '255,230,180', .3); ctx.globalCompositeOperation = 'source-over';
        rockAt(ctx, z.x, y, R, time * .6);
        break;
      }
      case 'invis': {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - lift - 50, 60 + 40 * k, '230,240,255', .4 * k);
        ctx.globalCompositeOperation = 'source-over';
        motes(ctx, z.x, z.y - 30, 40, time, 3, k, 12);
        break;
      }
      case 'split': {
        // the second half slides out of his body and round behind the target
        const t2 = easeOut(win(k, .1, .85)), mx = z.x, my = z.y;
        const ang0 = Math.atan2(my - st.ty, mx - st.tx), ang1 = Math.atan2(st.gy - st.ty, st.gx - st.tx);
        let da = ang1 - ang0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const r0 = Math.hypot(mx - st.tx, my - st.ty), an = ang0 + da * t2, rr = lerp(r0, 300, t2);
        const x = st.tx + Math.cos(an) * rr, y = st.ty + Math.sin(an) * rr;
        for (let i = 3; i >= 1; i--) {
          const t3 = Math.max(0, t2 - i * .07), a3 = ang0 + da * t3, r3 = lerp(r0, 300, t3);
          drawClone(ctx, z, st.tx + Math.cos(a3) * r3, st.ty + Math.sin(a3) * r3, Math.cos(st.aim + Math.PI) >= 0 ? 1 : -1, 'run2', .18 * (4 - i) * Math.min(1, k * 4), time);
        }
        drawClone(ctx, z, x, y, Math.cos(st.aim + Math.PI) >= 0 ? 1 : -1, t2 < 1 ? 'run2' : 'seal', Math.min(1, k * 3), time);
        if (k < .25) {
          const q = k / .25;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(z.x, z.y - lift - 100); ctx.lineTo(z.x, z.y - lift + 4); ctx.stroke();
          K.glow(ctx, z.x, z.y - lift - 50, 80, '230,240,255', .6 * (1 - q));
          ctx.globalCompositeOperation = 'source-over';
        }
        break;
      }
      case 'dust': {
        const S = 20 + 70 * e, cy = z.y - lift - 150 - 40 * k;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, cy, S * 2.2, '200,225,255', .5);
        ctx.strokeStyle = 'rgba(230,240,255,.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(z.x + 14, z.y - lift - 50); ctx.lineTo(z.x, cy + S * .6); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = .9; ctx.drawImage(dustBallSprite(), z.x - S, cy - S, S * 2, S * 2); ctx.globalAlpha = 1;
        prism(ctx, z.x, cy, S * .95, time * 1.4, .4 + time * .6, 1);
        // the dome's footprint creeping out on the target
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(st.tx, st.ty - 30, 520 * e, 520 * e * .5, 0, Math.PI, TAU); ctx.stroke();
        break;
      }
      case 'orbs': {
        const p = { x: 0, y: 0 };
        for (let i = 0; i < 6; i++) {
          ballPos(z, i, time, p);
          const fp = orbFront(z, st, i), x = lerp(p.x, fp.sx, e), y = lerp(p.y, fp.sy, e);
          const l = st.tele[i], m2 = win(k, .45, 1);
          if (m2 <= 0) drawBall(ctx, x, y, 9);
          else drawRod(ctx, x, y, l ? l.a : st.aim, lerp(18, 56, m2), lerp(16, 8, m2));
        }
        break;
      }
      case 'staff': {
        const hx = z.x + f * 22, hy = z.y + 3 - lift - 48;
        if (k < .3) drawBall(ctx, hx, hy - 10, 9);
        else drawStaff(ctx, hx, hy + 30, -Math.PI / 2 - f * .3 - (k - .3) * f * 1.4, 60 * win(k, .3, 1) + 24, 1);
        break;
      }
      case 'kamui': {
        // his Rinnegan eye glows, space at the target already starts to curl
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x + f * 8, z.y - lift - 80, 22 + 14 * k, '190,150,255', .8, true);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = .55 * e;
        K.spin(ctx, kamuiSwirl(), st.tx, st.ty - 46, 120 * e, time * 4, 1, .62);
        ctx.globalAlpha = 1;
        break;
      }
      case 'beam': {
        const hx = z.x + Math.cos(st.aim) * 30, hy = z.y - lift - 40 + Math.sin(st.aim) * 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = hash(i * 2.9) * TAU, q = frac(time * 1.6 + hash(i * 1.3)), d0 = 200 * (1 - q) + 20, d1 = d0 + 50;
          ctx.moveTo(hx + Math.cos(a) * d1, hy + Math.sin(a) * d1 * .7); ctx.lineTo(hx + Math.cos(a) * d0, hy + Math.sin(a) * d0 * .7);
        }
        ctx.strokeStyle = 'rgba(20,6,30,.6)'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = 'rgba(230,215,255,.85)'; ctx.lineWidth = 1.6; ctx.stroke();
        drawTbb(ctx, hx, hy, 8 + 30 * e, time, 1.3, k);
        break;
      }
      case 'roots': {
        ctx.strokeStyle = 'rgba(50,36,22,.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (const sp of st.spots || []) for (let i = 0; i < 3; i++) { const a = hash(i * 2.2 + sp.seed) * TAU, l = 50 * e; ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x + Math.cos(a) * l, sp.y + Math.sin(a) * l * .5); }
        ctx.stroke();
        break;
      }
      case 'gaeshi': {
        const sz = 34 + 14 * e;
        drawGunbai(ctx, z.x + Math.cos(st.aim) * 30, z.y - lift - 60 + Math.sin(st.aim) * 12, sz, f * (.25 - .6 * (1 - e)), 1);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x + Math.cos(st.aim) * 30, z.y - lift - 66, 60 + 30 * k, '150,200,255', .35);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'tbb': {
        const cy = z.y - lift - 150, r = 20 + 95 * e;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 22; i++) {
          const a = hash(i * 2.9 + 4) * TAU + time * .6, q = frac(time * 1.2 + hash(i * 1.3 + 4)), d0 = r + 320 * (1 - q), d1 = d0 + 70;
          ctx.moveTo(z.x + Math.cos(a) * d1, cy + Math.sin(a) * d1 * .7); ctx.quadraticCurveTo(z.x + Math.cos(a + .4) * (d0 + d1) / 2, cy + Math.sin(a + .4) * (d0 + d1) / 2 * .7, z.x + Math.cos(a) * d0, cy + Math.sin(a) * d0 * .7);
        }
        ctx.strokeStyle = 'rgba(20,6,30,.55)'; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = 'rgba(235,220,255,.85)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const a = hash(Math.floor(time * 14) + i * 5.1) * TAU;
          K.forkedBolt(ctx, z.x + Math.cos(a) * r * .9, cy + Math.sin(a) * r * .9, z.x + Math.cos(a) * (r + 60), cy + Math.sin(a) * (r + 60), i * 9, time, { jitter: 10, alpha: .8, width: 1.6, pal: ['120,60,220', '190,150,255', '250,240,255'], step: 12, forks: 1, forkLen: 18, rate: 20, snap: true });
        }
        ctx.globalCompositeOperation = 'source-over';
        drawTbb(ctx, z.x, cy, r, time, 2.2, k);
        break;
      }
    }
  }

  function bodyLift(z) {
    const m = members[z && z.bossId], st = z && z.lg;
    if (!m) return 0;
    return m.lift ? m.lift + Math.sin(((st && st.t) || 0) * 2.2) * 4 : 0;
  }

  // Mu fully invisible: game.js draws only his shadow.
  function hidden(z) {
    const st = z && z.lg;
    return !!(st && st.invis && st.invis.t > .32);
  }

  function label(ctx, z, st, m) {
    if (!(st.windup > 0) || !st.move || st.invis) return;
    const S = Spr(), id = S && S.has && S.has(z.bossId) ? z.bossId : 'pain';
    const top = z.y - bodyLift(z) - (S && S.height ? S.height(id) : 100) - 34;
    ctx.save();
    ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#160f1d'; ctx.strokeText(MOVES[st.move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[st.move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.invis = null; st.clone = null; st.used = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.lg;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      if (st.dash && st.dash.end) markCircle(ctx, st.dash.end.x, st.dash.end.y, st.dash.end.r, '205,190,255', 1, time, false);
      if (st.invis) invisShimmer(ctx, z, st, time);
      // Obito: the ring of Truth-Seeking Balls floating behind his back
      if (z.bossId === 'obito_rikudo') {
        const p = { x: 0, y: 0 };
        for (let i = 0; i < 9; i++) { if (i < st.used) continue; ballPos(z, i, time, p); drawBall(ctx, p.x, p.y, 9); }
      }
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.lg;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (fx.kind === 'sweep') sweepO(ctx, z, fx, time);
      else if (f && f[1]) f[1](ctx, fx, time, z);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (z.health > 0) {
      if (st.clone) {
        const c = st.clone, a = 1 - win(c.t, c.dur - .5, c.dur);
        drawClone(ctx, z, c.x, c.y, Math.cos(c.a) >= 0 ? 1 : -1, c.t < .5 ? 'attack' : 'idle', a, time);
        if (a < 1) motes(ctx, c.x, c.y - 30, 40, c.t, 7, 1 - a, 12);
      }
      if (st.windup > 0 && st.move) {
        chargeAura(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        windupOverlay(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m);
      }
    }
    ctx.restore();
  }

  window.LegendBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, bodyLift, hidden, moves };
})();
