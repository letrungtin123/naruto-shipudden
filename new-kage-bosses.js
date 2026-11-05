(() => {
  'use strict';

  // The new generation of Kage (spawn panel group "KAGE ĐỜI MỚI", faction 'newkage'). Contract as
  // nagato-boss.js / danzo-boss.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
  // ground layer (telegraphs, floods, scorch, patches), drawOverlay(ctx, z, time) what stands above the
  // characters. All per-boss state lives on z.nk as plain JSON data (co-op snapshots copy it whole):
  // delayed hits are data events, effects are { kind, age, dur, ... } records drawn by kind.
  //  - Darui (Sixth Raikage): Black Panther, Storm Release Light Fang beam, black lightning rain,
  //    cleaver dashes, water + lightning combo, and the ultimate Storm Release: Laser Circus.
  //  - Chōjūrō (Sixth Mizukage): Hiramekarei hammer, long chakra blade sweep + thrust, water shark
  //    bombs, water prison, hidden-mist ambush, and the ultimate Hiramekarei unleashed (twin blades).
  //  - Kurotsuchi (Fourth Tsuchikage): quicklime spray that hardens into traps, quicklime shells,
  //    earth golem, stone spear lanes, earth dragon bullets, and the ultimate quicklime flood + dome.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeBack = t => { t = clamp01(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const R = v => Math.round(v);
  const R2 = v => Math.round(v * 100) / 100;
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const HEIGHT = z => { const S = Spr(); return S && S.has && S.has(z.bossId) ? S.height(z.bossId) : 88; };

  const order = ['darui', 'chojuro', 'kurotsuchi'];
  const members = {
    darui: {
      name: 'DARUI — LỤC ĐẠI LÔI ẢNH', short: 'DARUI', accent: '#ffe45a', hpScale: 3.6, damageScale: 1.95, armor: .9,
      moves: ['panther', 'koga', 'bolts', 'cleaver', 'combo', 'circus', 'koga', 'panther', 'combo', 'bolts', 'cleaver', 'circus']
    },
    chojuro: {
      name: 'CHŌJŪRŌ — LỤC ĐẠI THỦY ẢNH', short: 'CHŌJŪRŌ', accent: '#7fd0ff', hpScale: 3.5, damageScale: 1.9, armor: .92,
      moves: ['hammer', 'shark', 'sweep', 'prison', 'mist', 'unleash', 'sweep', 'hammer', 'prison', 'shark', 'mist', 'unleash']
    },
    kurotsuchi: {
      name: 'KUROTSUCHI — TỨ ĐẠI THỔ ẢNH', short: 'KUROTSUCHI', accent: '#c8956a', hpScale: 3.6, damageScale: 1.9, armor: .9,
      moves: ['lime', 'spears', 'golem', 'lob', 'dragon', 'flood', 'spears', 'lime', 'dragon', 'golem', 'lob', 'flood']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    panther: { label: 'HẮC ĐỘN · HẮC BÁO', rgb: '200,195,255', windup: .9, after: 1.2 },
    koga:    { label: 'LAM ĐỘN · QUANG NHA', rgb: '170,240,255', windup: 1.0, after: 1.2 },
    bolts:   { label: 'HẮC ĐỘN · HẮC LÔI GIÁNG', rgb: '215,205,255', windup: .85, after: 1.1 },
    cleaver: { label: 'HẮC LÔI · ĐẠI ĐAO TRẢM', rgb: '235,235,255', windup: .5, after: 1.0 },
    combo:   { label: 'THỦY ĐỘN · LÔI ĐỘN · ĐIỆN THỦY TRẬN', rgb: '150,220,255', windup: .9, after: 1.2 },
    circus:  { label: 'LAM ĐỘN · LASER CIRCUS', rgb: '190,250,255', windup: 1.3, after: 1.9 },
    hammer:  { label: 'HIRAMEKAREI · ĐẠI CHÙY', rgb: '150,215,255', windup: 1.0, after: 1.2 },
    sweep:   { label: 'HIRAMEKAREI · TRƯỜNG ĐAO', rgb: '170,225,255', windup: .9, after: 1.1 },
    shark:   { label: 'THỦY ĐỘN · THỦY GIAO ĐẠN', rgb: '120,200,255', windup: .85, after: 1.1 },
    prison:  { label: 'THỦY ĐỘN · THỦY LAO THUẬT', rgb: '130,210,255', windup: .95, after: 1.0 },
    mist:    { label: 'ẨN VỤ THUẬT · VỤ TRUNG TRẢM', rgb: '215,235,245', windup: .7, after: 1.0 },
    unleash: { label: 'HIRAMEKAREI · KHAI PHÓNG', rgb: '160,230,255', windup: 1.35, after: 2.0 },
    lime:    { label: 'DUNG ĐỘN · THẠCH HÔI NGƯNG', rgb: '245,240,225', windup: .85, after: 1.1 },
    lob:     { label: 'DUNG ĐỘN · THẠCH HÔI ĐẠN', rgb: '245,235,215', windup: .8, after: 1.1 },
    golem:   { label: 'THỔ ĐỘN · NHAM THẠCH CỰ NHÂN', rgb: '230,190,140', windup: 1.0, after: 1.0 },
    spears:  { label: 'THỔ ĐỘN · NHAM THƯƠNG TRẬN', rgb: '225,195,150', windup: .9, after: 1.2 },
    dragon:  { label: 'THỔ ĐỘN · THỔ LONG ĐẠN', rgb: '220,175,120', windup: .85, after: 1.1 },
    flood:   { label: 'THẠCH HÔI HỒNG THỦY · THỔ LAO', rgb: '250,245,230', windup: 1.3, after: 2.1 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const PANTHER_SPEED = 860, PANTHER_RUN = 1.3;
  const KOGA_LEN = 1150, KOGA_W = 40, KOGA_T = 1.15, KOGA_SPAN = .42;
  const COMBO_LEN = 700, COMBO_HALF = .55, COMBO_SPEED = 950;
  const CIRCUS_N = 14, CIRCUS_VOL = 1.05;
  const HAMMER_R = 230;
  const SWEEP_L = 560, SWEEP_HALF = 1.75, THRUST_L = 1000;
  const SHARK_SPEED = 760;
  const PRISON_R = 165, PRISON_T = 2.3;
  const MIST_R = 700;
  const UNL_L = 820, UNL_X = 1.95;
  const LIME_LEN = 720, LIME_HALF = .42;
  const SPEAR_LEN = 860, SPEAR_SPEED = 1150;
  const FLOOD_R = 640, DOME_R = 270, DOME_T = 1.8;

  function pick(level) { return order[(level | 0) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  const faceOf = a => Math.cos(a) >= 0 ? 1 : -1;
  function inCone(p, x, y, a, len, half) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > len + (p.r || 12)) return false;
    if (d < 40) return true;
    return Math.abs(angDiff(Math.atan2(p.y - y, p.x - x), a)) <= half;
  }
  // Furthest free point along a ray (dashes and blinks never end inside a wall).
  function reach(api, x, y, a, len, r) {
    const c = Math.cos(a), s = Math.sin(a);
    while (len > 40 && api.blocked(x + c * len, y + s * len, r)) len -= 30;
    return len;
  }

  // Bake this member's cached art when it spawns, not in the middle of its first jutsu.
  function prewarm(id) {
    if (!Kit()) return;
    try {
      if (id === 'darui') { pantherSpr(0); pantherSpr(1); }
      else if (id === 'chojuro') { sharkSpr(); waterBall(); mistSpr(); }
      else { for (let i = 0; i < 3; i++) { limeSpr(i); spikeSpr(i); rockSpr(i); } golemSpr(); dragonSpr(); }
    } catch (e) { /* cosmetic */ }
  }
  function state(z) {
    if (!z.nk) prewarm(z.bossId);
    return z.nk || (z.nk = { t: 0, casts: 0, timer: 1.3, move: '', windup: 0, windMax: 1, aim: 0, tx: R(z.x), ty: R(z.y),
      tele: [], plan: null, ev: [], fx: [], ghosts: [], hold: 0, holdMove: '', dash: null, hide: 0, patches: [], trap: null, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = R(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  // Delayed blows are plain data: { t, h: handler, a: args }.
  const later = (st, t, h, a) => st.ev.push({ t, h, a: a || {} });
  const dmg = (api, m) => (api.damage || 60) * m;
  const hitAt = (st, t, x, y, r, m, k, loud) => later(st, t, 's', { x: R(x), y: R(y), r, m, k, loud: loud ? 1 : 0 });
  const worldAt = (st, t, x, y, r, m, k, a) => later(st, t, 'w', { x: R(x), y: R(y), r, m, k, a: R2(a || 0) });
  function addPatch(st, x, y, r, life) {
    if (st.patches.length >= 14) st.patches.shift();
    st.patches.push({ x: R(x), y: R(y), r: R(r), life, max: life, k: 0, seed: R(Math.random() * 99) });
  }

  // ------------------------------------------------------------------ events
  const EV = {
    s(z, st, api, a) { api.strike(a.x, a.y, a.r, dmg(api, a.m), a.loud ? '#ffffff' : null, a.k || null, !a.loud); },
    l(z, st, api, a) { api.line(a.x1, a.y1, a.x2, a.y2, a.w, dmg(api, a.m), a.k || null); },
    w(z, st, api, a) { api.world(a.x, a.y, a.r, dmg(api, a.m), a.k || 'crater', a.a || 0); },
    sh(z, st, api, a) { api.shake(a.n); },
    patch(z, st, api, a) { addPatch(st, a.x, a.y, a.r, a.life); },
    // Darui: the second panther, launched at whoever is there now
    panther(z, st, api) {
      const p = api.player, a = aimAt(z, p);
      addFx(st, { kind: 'panther', x: R(z.x + Math.cos(a) * 40), y: R(z.y + Math.sin(a) * 40), a: R2(a), k: 0, done: 0, ex: 0, tr: [], dur: PANTHER_RUN + 1.3 });
      api.shake(6);
    },
    // Darui / Chōjūrō dash: mark the lane for a moment, then cut straight through it
    dtele(z, st, api, a) {
      if (z.health <= 0) return;
      const p = api.player, px = p ? p.x : st.tx, py = p ? p.y : st.ty, r = (z.r || 30) + 2;
      const an = Math.atan2(py - z.y, px - z.x);
      const len = reach(api, z.x, z.y, an, Math.max(260, Math.min(620, Math.hypot(px - z.x, py - z.y) + 160)), r);
      addFx(st, { kind: 'dtele', x: R(z.x), y: R(z.y), a: R2(an), len: R(len), dur: .36 });
      later(st, .36, 'dgo', { a: R2(an), len: R(len), i: a.i, last: a.last });
    },
    dgo(z, st, api, a) {
      if (z.health <= 0) return;
      const r = (z.r || 30) + 2, len = reach(api, z.x, z.y, a.a, a.len, r);
      st.dash = { x0: R(z.x), y0: R(z.y), x1: R(z.x + Math.cos(a.a) * len), y1: R(z.y + Math.sin(a.a) * len), t: 0, a: a.a, last: a.last ? 1 : 0, T: .15 };
    },
    // Chōjūrō in the mist: an ambush cut through the target from a fresh direction
    ambush(z, st, api, a) {
      const p = api.player;
      if (!p || z.health <= 0) return;
      const base = Math.atan2(p.y - z.y, p.x - z.x) + (a.i % 2 ? 1 : -1) * (1.1 + Math.random() * .9);
      const c = Math.cos(base), s = Math.sin(base);
      const x0 = p.x - c * 340, y0 = p.y - s * 340, x1 = p.x + c * 340, y1 = p.y + s * 340;
      addFx(st, { kind: 'mlane', x0: R(x0), y0: R(y0), x1: R(x1), y1: R(y1), a: R2(base), dur: .5 });
      later(st, .44, 'mcut', { x0: R(x0), y0: R(y0), x1: R(x1), y1: R(y1), a: R2(base), last: a.last });
    },
    mcut(z, st, api, a) {
      if (z.health <= 0) return;
      const r = (z.r || 30) + 2;
      let x0 = a.x0, y0 = a.y0;
      if (api.blocked(x0, y0, r)) { x0 = z.x; y0 = z.y; }
      z.x = x0; z.y = y0;
      const an = Math.atan2(a.y1 - y0, a.x1 - x0), len = reach(api, x0, y0, an, Math.hypot(a.x1 - x0, a.y1 - y0), r);
      st.dash = { x0: R(x0), y0: R(y0), x1: R(x0 + Math.cos(an) * len), y1: R(y0 + Math.sin(an) * len), t: 0, a: R2(an), last: a.last ? 1 : 0, T: .14, mist: 1 };
    },
    // Chōjūrō: the thrust after the sweep, re-aimed
    thrust(z, st, api) {
      const p = api.player, a = aimAt(z, p);
      addFx(st, { kind: 'thrust', x: R(z.x), y: R(z.y), a: R2(a), len: R(reach(api, z.x, z.y, a, THRUST_L, 8)), dur: 1.3, hit: 0 });
    },
    // Kurotsuchi: the earth dragon's mud bullets
    mud(z, st, api, a) {
      const f = st.fx.find(e => e.kind === 'dragon');
      const p = api.player;
      if (!f || !p) return;
      const mx = f.x + f.f * 70, my = f.y + 4, base = Math.atan2(p.y - my, p.x - mx);
      for (let i = 0; i < 4; i++) {
        const s = api.projectile(z, base + (i - 1.5) * .13 + rand(-.03, .03), 640 + i * 30, dmg(api, 1.25), 'rock', '#7a5a3c', 1.7);
        if (s) { s.x = mx; s.y = my; s.blast = 80; }
      }
      f.spit = f.age;
      api.shake(7);
    }
  };

  // ------------------------------------------------------------------ jutsu selection
  const circ = (x, y, r, faint, small) => ({ k: 'c', x: R(x), y: R(y), r, faint: faint ? 1 : 0, small: small ? 1 : 0 });
  const lineT = (x, y, a, len, w, faint) => ({ k: 'line', x: R(x), y: R(y), a: R2(a), len: R(len), w, faint: faint ? 1 : 0 });
  function circusVolley(converge) {
    const L = [];
    for (let i = 0; i < CIRCUS_N; i++) {
      const side = (i % 2 ? 1 : -1) * (.35 + (i >> 1) / (CIRCUS_N / 2) * .75);
      if (converge) L.push([0, 0, R2(side * 1.15), R2(i * .02)]);
      else {
        const a = Math.random() * TAU, d = 40 + Math.sqrt(Math.random()) * 250;
        L.push([R(Math.cos(a) * d), R(Math.sin(a) * d * .8), R2(side), R2(i * .035)]);
      }
    }
    return L;
  }
  function teleFor(z, st, move, api) {
    const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), tx = st.tx, ty = st.ty;
    st.plan = null;
    switch (move) {
      case 'panther': return [lineT(x, y, a, 950, 62)];
      case 'koga': {
        const dir = Math.random() < .5 ? 1 : -1;
        st.plan = { dir };
        return [{ k: 'cone', x: R(x), y: R(y), a: R2(a), len: KOGA_LEN, half: KOGA_SPAN + .04 }, lineT(x, y, a - dir * KOGA_SPAN, KOGA_LEN, KOGA_W, true)];
      }
      case 'bolts': {
        const spots = [], b = Math.random() * TAU;
        spots.push({ x: tx, y: ty, r: 100, t: .05 });
        for (let i = 0; i < 5; i++) { const an = b + i * TAU / 5; spots.push({ x: tx + Math.cos(an) * 150, y: ty + Math.sin(an) * 130, r: 90, t: .12 + i * .07 }); }
        for (let i = 0; i < 8; i++) { const an = b + (i + .5) * TAU / 8; spots.push({ x: tx + Math.cos(an) * 300, y: ty + Math.sin(an) * 250, r: 90, t: .45 + i * .06 }); }
        st.plan = { spots: spots.map(s => ({ x: R(s.x), y: R(s.y), r: s.r, t: s.t })) };
        return [circ(tx, ty, 360, true)].concat(st.plan.spots.map(s => circ(s.x, s.y, s.r, true, true)));
      }
      case 'cleaver': return [lineT(x, y, a, Math.min(620, Math.hypot(tx - x, ty - y) + 160), 40, true)];
      case 'combo': return [{ k: 'cone', x: R(x), y: R(y), a: R2(a), len: COMBO_LEN, half: COMBO_HALF }];
      case 'circus': {
        st.plan = { L: circusVolley(false) };
        return [circ(tx, ty, 320), circ(tx, ty, 160, true)];
      }
      case 'hammer': return [circ(tx, ty, HAMMER_R), lineT(x, y, a, Math.hypot(tx - x, ty - y), 22, true)];
      case 'sweep': {
        const dir = Math.random() < .5 ? 1 : -1;
        st.plan = { dir };
        return [{ k: 'cone', x: R(x), y: R(y), a: R2(a), len: SWEEP_L, half: SWEEP_HALF }];
      }
      case 'shark': {
        const sh = [];
        for (let i = 0; i < 5; i++) {
          const off = (i - 2) * 95, px = tx - sa * off, py = ty + ca * off;
          sh.push({ x: R(px + ca * (i === 2 ? 0 : 60)), y: R(py + sa * (i === 2 ? 0 : 60)), w: R2((i % 2 ? 1 : -1) * (.6 + Math.abs(i - 2) * .25)), t0: R2(Math.abs(i - 2) * .08) });
        }
        st.plan = { sh };
        return sh.map(s => ({ k: 'line', x: R(x), y: R(y), a: R2(Math.atan2(s.y - y, s.x - x)), len: R(Math.hypot(s.x - x, s.y - y)), w: 26, faint: 1 }))
          .concat(sh.map(s => circ(s.x, s.y, 130, true, true)));
      }
      case 'prison': return [circ(tx, ty, PRISON_R), circ(tx, ty, PRISON_R * .55, true)];
      case 'mist': return [{ k: 'c', follow: 1, r: MIST_R, faint: 1 }];
      case 'unleash': return [{ k: 'c', follow: 1, r: UNL_L, faint: 1 }, { k: 'cone', x: R(x), y: R(y), a: R2(a), len: UNL_L, half: 2.2 }];
      case 'lime': return [{ k: 'cone', x: R(x), y: R(y), a: R2(a), len: LIME_LEN, half: LIME_HALF }];
      case 'lob': {
        const gl = [], b = Math.random() * TAU;
        gl.push({ x: R(tx), y: R(ty) });
        for (let i = 0; i < 6; i++) { const an = b + i * TAU / 6; gl.push({ x: R(tx + Math.cos(an) * 190), y: R(ty + Math.sin(an) * 160) }); }
        st.plan = { gl };
        return gl.map(g => circ(g.x, g.y, 115, false, true));
      }
      case 'golem': {
        const f = faceOf(a), nx = -sa, ny = ca, side = ny > 0 ? -1 : 1;
        let gx = x + ca * 110 + nx * side * 120, gy = y + sa * 110 + ny * side * 120;
        if (api.blocked(gx, gy, 40)) { gx = x + ca * 120; gy = y + sa * 120; }
        st.plan = { gx: R(gx), gy: R(gy), f };
        return [circ(gx, gy, 150, true), circ(tx, ty, 190, true, true)];
      }
      case 'spears': {
        const lanes = [-.34, 0, .34].map((o, i) => ({ a: R2(a + o), len: R(SPEAR_LEN * (i === 1 ? 1 : .9)), t0: R2(.1 + Math.abs(i - 1) * .08) }));
        st.plan = { lanes };
        return lanes.map(l => lineT(x + Math.cos(l.a) * 40, y + Math.sin(l.a) * 40, l.a, l.len, 46))
          .concat(lanes.map(l => circ(x + Math.cos(l.a) * (l.len + 40), y + Math.sin(l.a) * (l.len + 40), 130, true)), [circ(x, y, 160, true)]);
      }
      case 'dragon': {
        const nx = -sa, ny = ca, side = ny > 0 ? -1 : 1;
        let dx = x + nx * side * 95 - ca * 20, dy = y + ny * side * 95 - sa * 20;
        if (api.blocked(dx, dy, 30)) { dx = x - ca * 60; dy = y - sa * 60; }
        st.plan = { dx: R(dx), dy: R(dy) };
        return [circ(dx, dy, 90, true), lineT(dx, dy, Math.atan2(ty - dy, tx - dx), Math.min(1000, Math.hypot(tx - dx, ty - dy) + 200), 70, true)];
      }
      case 'flood': return [{ k: 'c', follow: 1, r: FLOOD_R, faint: 1 }, circ(tx, ty, DOME_R)];
    }
    return [];
  }

  function announce(z, st, m, api) {
    const move = m.moves[st.casts % m.moves.length];
    st.casts++;
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = R2(aimAt(z, p)); st.tx = R(p ? p.x : z.x); st.ty = R(p ? p.y : z.y);
    st.tele = teleFor(z, st, move, api);
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), plan = st.plan || {};
    const x = z.x, y = z.y, f = faceOf(a);
    switch (move) {
      // ============ Darui
      case 'panther': {
        addFx(st, { kind: 'panther', x: R(x + ca * 40), y: R(y + sa * 40), a, k: 0, done: 0, ex: 0, tr: [], dur: PANTHER_RUN + 1.3 });
        addFx(st, { kind: 'lane', x: R(x), y: R(y), a: R2(aimAt(z, api.player)), len: 900, dur: .5 });
        later(st, .48, 'panther');
        st.hold = .75; st.holdMove = 'panther';
        api.shake(8);
        break;
      }
      case 'koga': {
        const dir = plan.dir || 1;
        addFx(st, { kind: 'koga', x: R(x + f * 16), y: R(y), a0: R2(a - dir * KOGA_SPAN), a1: R2(a + dir * KOGA_SPAN), T: KOGA_T, k: 0, w: 0, dur: KOGA_T + .9 });
        st.hold = KOGA_T + .15; st.holdMove = 'koga';
        api.shake(10);
        break;
      }
      case 'bolts': {
        const spots = (plan.spots || []).slice();
        const p = api.player, bx = p ? p.x : st.tx, by = p ? p.y : st.ty;
        spots.push({ x: R(bx), y: R(by), r: 210, t: 1.3, big: 1 });
        spots.forEach((s, i) => {
          if (s.big) { hitAt(st, s.t, s.x, s.y, s.r, 2.6, 'lightning'); worldAt(st, s.t, s.x, s.y, 190, 2.6, 'lightning'); later(st, s.t, 'sh', { n: 20 }); }
          else { hitAt(st, s.t, s.x, s.y, s.r, 1.45, i % 4 === 0 ? 'lightning' : null); if (i % 3 === 0) later(st, s.t, 'sh', { n: 7 }); }
        });
        addFx(st, { kind: 'bolts', spots, dur: 2.4 });
        st.hold = .6; st.holdMove = 'bolts';
        break;
      }
      case 'cleaver': {
        st.hold = 3 * .62 + .5; st.holdMove = 'cleaver';
        for (let i = 0; i < 3; i++) later(st, i * .62, 'dtele', { i, last: i === 2 ? 1 : 0 });
        break;
      }
      case 'combo': {
        const fx = addFx(st, { kind: 'combo', x: R(x + ca * 30), y: R(y + sa * 30), a, k: 0, elec: .8, end: 2.5, dur: 3.3 });
        for (let d = 140; d <= COMBO_LEN; d += 112) for (let j = -1; j <= 1; j++) {
          const an = a + j * COMBO_HALF * .62;
          hitAt(st, d / COMBO_SPEED, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d, 95, .9, null);
        }
        later(st, .35, 'w', { x: R(fx.x + ca * 420), y: R(fx.y + sa * 420), r: 150, m: 1.6, k: 'vortex', a });
        st.hold = 1.1; st.holdMove = 'combo';
        api.shake(9);
        break;
      }
      case 'circus': {
        const p = api.player;
        addFx(st, { kind: 'circus', x0: R(x + f * 16), y0: R(y), px: R(p ? p.x : st.tx), py: R(p ? p.y : st.ty), v: 0, vt: 0, L: plan.L || circusVolley(false), k: 0, boom: 0, dur: 4.9 });
        st.hold = 3.8; st.holdMove = 'circus';
        api.shake(12);
        break;
      }
      // ============ Chōjūrō
      case 'hammer': {
        addFx(st, { kind: 'hammer', x: R(x), y: R(y), f, t1x: st.tx, t1y: st.ty, t2x: st.tx, t2y: st.ty, hit1: 0, hit2: 0, pick: 0, dur: 2.3 });
        st.hold = 1.3; st.holdMove = 'hammer';
        break;
      }
      case 'sweep': {
        const dir = plan.dir || 1;
        addFx(st, { kind: 'sweep', x: R(x), y: R(y), a0: R2(a - dir * SWEEP_HALF), a1: R2(a + dir * SWEEP_HALF), T: .5, k: 0, n: 0, dur: 1.2 });
        later(st, .45, 'thrust');
        st.hold = 1.5; st.holdMove = 'sweep';
        api.shake(10);
        break;
      }
      case 'shark': {
        const x0 = R(x + ca * 30), y0 = R(y + sa * 30);
        const sh = (plan.sh || []).map(s => ({ x: s.x, y: s.y, w: s.w, t0: s.t0, T: R2(Math.hypot(s.x - x0, s.y - y0) / SHARK_SPEED), done: 0 }));
        addFx(st, { kind: 'shark', x0, y0, sh, k: 0, dur: 3 });
        st.hold = .6; st.holdMove = 'shark';
        api.shake(6);
        break;
      }
      case 'prison': {
        const p = api.player, inside = p && Math.hypot(p.x - st.tx, p.y - st.ty) < PRISON_R + (p.r || 12);
        addFx(st, { kind: 'prison', x: st.tx, y: st.ty, caught: inside ? 1 : 0, k: 0, pop: 0, dur: PRISON_T + 1.2 });
        st.hold = PRISON_T * .8; st.holdMove = 'prison';
        api.shake(6);
        break;
      }
      case 'mist': {
        addFx(st, { kind: 'mist', x: R(x), y: R(y), dur: 4.8 });
        st.hide = 3.1;
        for (let i = 0; i < 3; i++) later(st, .7 + i * .85, 'ambush', { i, last: i === 2 ? 1 : 0 });
        st.hold = 3.2; st.holdMove = 'mist';
        break;
      }
      case 'unleash': {
        addFx(st, { kind: 'unleash', x: R(x), y: R(y), a, cx: st.tx, cy: st.ty, k: 0, set: 0, hit: 0, dur: UNL_X + 1.6 });
        st.hold = UNL_X + .3; st.holdMove = 'unleash';
        api.shake(14);
        break;
      }
      // ============ Kurotsuchi
      case 'lime': {
        const H = HEIGHT(z), mx = R(x + f * 8), my = R(y);
        const fx = addFx(st, { kind: 'lime', x: mx, y: my, a, T: .85, sw: R2((Math.random() < .5 ? 1 : -1) * .22), H: R(H * .7), drops: [], dur: 1.6 });
        for (let i = 0; i < 8; i++) {
          const d = 170 + (i / 7) * (LIME_LEN - 190) + rand(-30, 30), an = a + (hash(i * 3.1 + fx.seed) - .5) * LIME_HALF * 1.6;
          const px = mx + Math.cos(an) * d, py = my + Math.sin(an) * d, t = .1 + (i / 7) * .7;
          fx.drops.push({ x: R(px), y: R(py), t: R2(t) });
          hitAt(st, t + .12, px, py, 95, 1.3, i % 3 === 0 ? 'earth' : null);
          later(st, t + .14, 'patch', { x: R(px), y: R(py), r: R(80 + hash(i + fx.seed) * 30), life: 4.6 });
        }
        st.hold = 1.0; st.holdMove = 'lime';
        break;
      }
      case 'lob': {
        const gl = (plan.gl || []).map((g, i) => ({ x: g.x, y: g.y, t0: R2(i * .07), T: R2(.7 + hash(i * 1.7) * .25) }));
        gl.forEach((g, i) => {
          const t = g.t0 + g.T;
          hitAt(st, t, g.x, g.y, 115, 1.5, i === 0 ? 'crater' : null);
          later(st, t + .02, 'patch', { x: g.x, y: g.y, r: 95, life: 3.6 });
          if (i % 2 === 0) later(st, t, 'sh', { n: 7 });
        });
        addFx(st, { kind: 'lob', x0: R(x + f * 8), y0: R(y), H: R(HEIGHT(z) * .72), gl, dur: 2.6 });
        st.hold = .7; st.holdMove = 'lob';
        break;
      }
      case 'golem': {
        const g = plan.gx != null ? plan : { gx: R(x + ca * 120), gy: R(y + sa * 120), f };
        addFx(st, { kind: 'golem', x: g.gx, y: g.gy, f: g.f, p: [{ t: 1.25, x: st.tx, y: st.ty, done: 0 }, { t: 2.35, x: st.tx, y: st.ty, done: 0 }], set: 0, dur: 4.6 });
        hitAt(st, .55, g.gx, g.gy, 150, 1.2, 'earth');
        later(st, .55, 'sh', { n: 12 });
        st.hold = 1.0; st.holdMove = 'golem';
        break;
      }
      case 'spears': {
        const lanes = plan.lanes || [];
        lanes.forEach((l, li) => {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 80, i = 0; d <= l.len; d += 95, i++) hitAt(st, l.t0 + d / SPEAR_SPEED, x + c * d, y + s * d, 62, 1.35, i === 4 ? 'earth' : null);
          const te = l.t0 + l.len / SPEAR_SPEED + .04, ex = x + c * (l.len + 40), ey = y + s * (l.len + 40);
          hitAt(st, te, ex, ey, 130, 1.9, 'earth');
          worldAt(st, te, ex, ey, 120, 2.2, 'earth', l.a);
          later(st, te, 'sh', { n: 10 });
        });
        hitAt(st, .05, x, y, 160, 1.3, null);
        addFx(st, { kind: 'spears', x: R(x), y: R(y), lanes, ring: 1, dur: 3.4 });
        st.hold = .9; st.holdMove = 'spears';
        api.shake(8);
        break;
      }
      case 'dragon': {
        const dx = plan.dx != null ? plan.dx : R(x - ca * 60), dy = plan.dy != null ? plan.dy : R(y - sa * 60);
        const p = api.player;
        addFx(st, { kind: 'dragon', x: dx, y: dy, f: p && p.x < dx ? -1 : 1, spit: -1, dur: 2.9 });
        for (const t of [.45, .95, 1.45]) later(st, t, 'mud');
        hitAt(st, .3, dx, dy, 90, 1, 'earth');
        st.hold = 1.6; st.holdMove = 'dragon';
        break;
      }
      case 'flood': {
        const fx = addFx(st, { kind: 'flood', x: R(x), y: R(y), tx: st.tx, ty: st.ty, k: 0, slam: 0, dur: 4.4 });
        for (let i = 0; i < 6; i++) {
          const an = i * TAU / 6 + hash(fx.seed + i) * .6, d = 380 + hash(i * 2.3 + fx.seed) * 220;
          const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d;
          if (Math.hypot(px - st.tx, py - st.ty) > DOME_R + 60) later(st, d / 760 + .1, 'patch', { x: R(px), y: R(py), r: 110, life: 3.4 });
        }
        st.hold = DOME_T + .3; st.holdMove = 'flood';
        api.shake(14);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ per-effect updates
  function circusPoint(fx, L, t) {
    const tx = fx.px + L[0], ty = fx.py + L[1], ox = fx.x0, oy = fx.y0, dx = tx - ox, dy = ty - oy, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(560, d * .75) * L[2];
    const cx = ox + dx * .45 - dy / d * k, cy = oy + dy * .45 + dx / d * k, u = 1 - t;
    return [u * u * ox + 2 * u * t * cx + t * t * tx, u * u * oy + 2 * u * t * cy + t * t * ty];
  }
  function circusGrow(fx, L) {
    const u = fx.age - fx.vt - L[3];
    return fx.v === 3 ? clamp01(u / .4) : clamp01(u / .32);
  }
  const FXU = {
    panther(z, st, fx, dt, api) {
      if (fx.done) return;
      const p = api.player;
      if (p) {
        const want = Math.atan2(p.y - fx.y, p.x - fx.x), d = angDiff(want, fx.a);
        fx.a = R2(fx.a + Math.max(-1.7 * dt, Math.min(1.7 * dt, d)));
      }
      const c = Math.cos(fx.a), s = Math.sin(fx.a);
      fx.x += c * PANTHER_SPEED * dt; fx.y += s * PANTHER_SPEED * dt;
      fx.tr.push([R(fx.x), R(fx.y)]);
      if (fx.tr.length > 9) fx.tr.shift();
      if ((fx.k -= dt) <= 0) { fx.k = .08; api.strike(fx.x, fx.y, 62, dmg(api, 1.3), null, null, true); }
      const near = p && Math.hypot(p.x - fx.x, p.y - fx.y) < 70;
      if (near || fx.age >= PANTHER_RUN || api.blocked(fx.x, fx.y, 20)) {
        fx.done = 1; fx.ex = R2(fx.age); fx.x = R(fx.x); fx.y = R(fx.y);
        api.strike(fx.x, fx.y, 230, dmg(api, 2.4), null, 'lightning', true);
        api.world(fx.x, fx.y, 170, dmg(api, 2.4), 'lightning');
        api.shake(15);
        fx.dur = fx.age + 1.2;
      }
    },
    koga(z, st, fx, dt, api) {
      if (fx.age > fx.T) return;
      const an = lerp(fx.a0, fx.a1, easeInOut(fx.age / fx.T)), len = KOGA_LEN;
      fx.an = R2(an);
      if ((fx.k -= dt) <= 0) {
        fx.k = .08;
        api.line(fx.x, fx.y, fx.x + Math.cos(an) * len, fx.y + Math.sin(an) * len, KOGA_W, dmg(api, 1.05), null);
      }
      if (fx.age > fx.w * .45 + .2 && fx.w < 3) {
        fx.w++;
        api.world(fx.x + Math.cos(an) * (len - 120), fx.y + Math.sin(an) * (len - 120), 130, dmg(api, 2.2), fx.w === 2 ? 'lightning' : 'blade', an);
      }
    },
    combo(z, st, fx, dt, api) {
      if (fx.age < fx.elec || fx.age > fx.end) return;
      if ((fx.k -= dt) > 0) return;
      fx.k = .3;
      // the flooded wedge is electrified: sweep strikes over all of it
      for (const d of [170, 330, 490, 640]) for (let j = -1; j <= 1; j++) {
        const an = fx.a + j * COMBO_HALF * .6;
        api.strike(fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d, 108, dmg(api, .62), null, null, true);
      }
      if (fx.age < fx.elec + .35) api.world(fx.x + Math.cos(fx.a) * 330, fx.y + Math.sin(fx.a) * 330, 160, dmg(api, 2), 'lightning', fx.a);
      api.shake(5);
    },
    circus(z, st, fx, dt, api) {
      const p = api.player;
      if (p && fx.v < 3) {
        const dx = p.x - fx.px, dy = p.y - fx.py, d = Math.hypot(dx, dy), mv = Math.min(d, 240 * dt);
        if (d > 1) { fx.px = R(fx.px + dx / d * mv); fx.py = R(fx.py + dy / d * mv); }
      }
      if (fx.v < 3 && fx.age >= fx.vt + CIRCUS_VOL) {
        fx.v++; fx.vt = R2(fx.age);
        fx.L = circusVolley(fx.v === 3);
        if (fx.v === 3 && p) { fx.px = R(p.x); fx.py = R(p.y); }
        api.shake(8);
      }
      if (fx.v === 3 && !fx.boom && fx.age >= fx.vt + .62) {
        fx.boom = R2(fx.age);
        api.strike(fx.px, fx.py, 300, dmg(api, 3.8), '#e8fdff', 'lightning');
        api.world(fx.px, fx.py, 260, dmg(api, 3.6), 'crater');
        for (let i = 0; i < 3; i++) { const an = i * TAU / 3 + .4; api.world(fx.px + Math.cos(an) * 300, fx.py + Math.sin(an) * 260, 130, dmg(api, 2.4), 'lightning', an); }
        api.shake(26);
        return;
      }
      if (fx.boom || (fx.k -= dt) > 0) return;
      fx.k = .1;
      const hold = fx.v === 3 ? .55 : .95;
      for (const L of fx.L) {
        if (circusGrow(fx, L) < .9 || fx.age - fx.vt > hold) continue;
        for (const t of [.62, .78, .92]) { const q = circusPoint(fx, L, t); api.strike(q[0], q[1], 38, dmg(api, .9), null, null, true); }
      }
    },
    hammer(z, st, fx, dt, api) {
      if (!fx.hit1 && fx.age >= .16) {
        fx.hit1 = 1;
        api.strike(fx.t1x, fx.t1y, HAMMER_R, dmg(api, 2.6), null, 'crater', true);
        api.world(fx.t1x, fx.t1y, 190, dmg(api, 2.6), 'crater');
        api.shake(18);
      }
      if (!fx.pick && fx.age >= .5) {
        fx.pick = 1;
        const p = api.player;
        if (p) { fx.t2x = R(p.x); fx.t2y = R(p.y); }
      }
      if (!fx.hit2 && fx.age >= 1.08) {
        fx.hit2 = 1;
        api.strike(fx.t2x, fx.t2y, 210, dmg(api, 2.4), null, 'crater', true);
        api.world(fx.t2x, fx.t2y, 180, dmg(api, 2.4), 'crater');
        api.shake(18);
      }
    },
    sweep(z, st, fx, dt, api) {
      if (fx.age > fx.T + .02) return;
      if ((fx.k -= dt) > 0) return;
      fx.k = .045;
      const an = lerp(fx.a0, fx.a1, easeInOut(fx.age / fx.T));
      api.line(fx.x, fx.y, fx.x + Math.cos(an) * SWEEP_L, fx.y + Math.sin(an) * SWEEP_L, 34, dmg(api, 1.6), null);
      if (fx.n < 3 && fx.age > fx.n * .16) { fx.n++; api.world(fx.x + Math.cos(an) * (SWEEP_L - 80), fx.y + Math.sin(an) * (SWEEP_L - 80), 100, dmg(api, 2), 'blade', an); }
    },
    thrust(z, st, fx, dt, api) {
      if (fx.hit || fx.age < .4) return;
      fx.hit = 1;
      const ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
      api.line(fx.x, fx.y, ex, ey, 46, dmg(api, 2.0), 'blade');
      api.world(ex, ey, 140, dmg(api, 2.4), 'blade', fx.a);
      api.shake(14);
    },
    shark(z, st, fx, dt, api) {
      const strike = (fx.k -= dt) <= 0;
      if (strike) fx.k = .1;
      for (const s of fx.sh) {
        if (s.done) continue;
        const u = (fx.age - s.t0) / s.T;
        if (u < 0) continue;
        if (u >= 1) {
          s.done = 1;
          api.strike(s.x, s.y, 140, dmg(api, 1.8), null, 'shockwave', true);
          api.shake(8);
          continue;
        }
        if (strike && u > .15) { const q = sharkPos(fx, s, u); api.strike(q[0], q[1], 48, dmg(api, .9), null, null, true); }
      }
    },
    prison(z, st, fx, dt, api) {
      if (fx.age < .3) return;
      if (fx.age < PRISON_T) {
        if ((fx.k -= dt) > 0) return;
        fx.k = .25;
        const p = api.player;
        if (!p) return;
        const d = Math.hypot(p.x - fx.x, p.y - fx.y);
        if (d < PRISON_R + 20) {
          fx.caught = 1;
          // held in the water: dragged to the middle, drowning ticks
          drag(api, p, fx.x, fx.y, 1600, .25);
          if ((fx.tk = (fx.tk || 0) + 1) % 2 === 0) api.strike(fx.x, fx.y, PRISON_R + 20, dmg(api, .35), null, null, true);
        }
      } else if (!fx.pop) {
        fx.pop = 1;
        api.strike(fx.x, fx.y, 200, dmg(api, 1.5), null, 'shockwave', true);
        api.shake(12);
      }
    },
    unleash(z, st, fx, dt, api) {
      if (fx.age <= 1.02 && (fx.k -= dt) <= 0) {
        fx.k = .05;
        for (const an of unleashAngles(fx)) api.line(fx.x, fx.y, fx.x + Math.cos(an) * UNL_L, fx.y + Math.sin(an) * UNL_L, 44, dmg(api, 1.4), null);
        if (fx.age > fx.hit * .3 && fx.hit < 3) {
          fx.hit++;
          for (const an of unleashAngles(fx)) api.world(fx.x + Math.cos(an) * (UNL_L - 140), fx.y + Math.sin(an) * (UNL_L - 140), 130, dmg(api, 2.2), 'blade', an);
        }
      }
      if (!fx.set && fx.age >= 1.15) {
        fx.set = 1;
        const p = api.player;
        if (p) { fx.cx = R(p.x); fx.cy = R(p.y); }
      }
      if (fx.hit < 9 && fx.age >= UNL_X) {
        fx.hit = 9;
        for (const s of [1, -1]) {
          const an = fx.a + s * .78, c = Math.cos(an) * 560, sn = Math.sin(an) * 560;
          api.line(fx.cx - c, fx.cy - sn, fx.cx + c, fx.cy + sn, 52, dmg(api, 2.4), 'blade');
        }
        api.strike(fx.cx, fx.cy, 300, dmg(api, 3.6), '#e6faff', 'crater');
        api.world(fx.cx, fx.cy, 260, dmg(api, 3.4), 'crater');
        api.shake(28);
      }
    },
    golem(z, st, fx, dt, api) {
      for (const pu of fx.p) {
        if (!pu.set && fx.age >= pu.t - .78) {
          pu.set = 1;
          const p = api.player;
          if (p) { pu.x = R(p.x); pu.y = R(p.y); }
        }
        if (!pu.done && fx.age >= pu.t) {
          pu.done = 1;
          api.strike(pu.x, pu.y, 190, dmg(api, 2.4), null, 'earth', true);
          api.world(pu.x, pu.y, 170, dmg(api, 2.4), 'earth');
          api.shake(16);
        }
      }
      if (!fx.set && fx.age >= 3.5) {
        fx.set = 1;
        api.strike(fx.x, fx.y, 170, dmg(api, 1.1), null, 'earth', true);
        api.shake(10);
      }
    },
    flood(z, st, fx, dt, api) {
      const r = floodR(fx);
      if (fx.age < 1.05 && (fx.k -= dt) <= 0) {
        fx.k = .07;
        const n = Math.max(8, Math.round(r / 40));
        for (let i = 0; i < n; i++) { const an = i * TAU / n; api.strike(fx.x + Math.cos(an) * r, fx.y + Math.sin(an) * r * .92, 70, dmg(api, 1.5), null, null, true); }
        if (fx.age > .4 && fx.age < .48) for (let i = 0; i < 3; i++) { const an = i * TAU / 3 + fx.seed; api.world(fx.x + Math.cos(an) * r, fx.y + Math.sin(an) * r, 130, dmg(api, 1.8), 'earth', an); }
      }
      if (!fx.slam && fx.age >= DOME_T) {
        fx.slam = 1;
        api.strike(fx.tx, fx.ty, DOME_R, dmg(api, 4.4), '#e8d6b8', 'crater');
        api.world(fx.tx, fx.ty, 280, dmg(api, 4), 'crater');
        for (let i = 0; i < 4; i++) { const an = i * TAU / 4 + .5; api.world(fx.tx + Math.cos(an) * 320, fx.ty + Math.sin(an) * 280, 140, dmg(api, 2.6), 'earth', an); }
        api.shake(28);
      }
    }
  };
  function floodR(fx) { return 60 + (FLOOD_R - 60) * easeOut(fx.age / 1.0); }
  function unleashAngles(fx) {
    const k = easeInOut(fx.age / 1.0);
    return [fx.a + lerp(-2.25, 1.05, k), fx.a + lerp(2.25, -1.05, k)];
  }
  function sharkPos(fx, s, u) {
    const dx = s.x - fx.x0, dy = s.y - fx.y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    const off = Math.sin(u * Math.PI * 2) * s.w * 70 * (1 - u * .8);
    return [fx.x0 + dx * u + nx * off, fx.y0 + dy * u + ny * off];
  }

  // ------------------------------------------------------------------ dashes, patches
  function dashUpdate(z, st, dt, api) {
    const d = st.dash;
    d.t += dt;
    const k = Math.min(1, d.t / d.T), e = easeOut(k);
    z.x = lerp(d.x0, d.x1, e); z.y = lerp(d.y0, d.y1, e);
    if (st.ghosts.length < 14) st.ghosts.push({ x: R(z.x), y: R(z.y), f: Math.cos(d.a) >= 0 ? 1 : -1, age: 0, m: d.mist ? 1 : 0 });
    if (k < 1) return;
    st.dash = null;
    api.line(d.x0, d.y0, d.x1, d.y1, 58, dmg(api, d.mist ? 1.8 : 1.7), 'blade');
    addFx(st, { kind: d.mist ? 'mslash' : 'slash', x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, a: d.a, dur: 1.3 });
    api.shake(9);
    if (d.last && !d.mist) {
      api.strike(z.x, z.y, 240, dmg(api, 2.2), null, 'lightning', true);
      api.world(z.x, z.y, 160, dmg(api, 2.2), 'blade', d.a);
      addFx(st, { kind: 'spin', x: R(z.x), y: R(z.y), a: d.a, dur: 1.4 });
      api.shake(15);
    }
    if (d.last && d.mist) { st.hide = 0; addFx(st, { kind: 'mreveal', x: R(z.x), y: R(z.y), dur: 1 }); }
  }
  function patchUpdate(z, st, dt, api) {
    const p = api.player;
    st.trap = null;
    for (let i = st.patches.length - 1; i >= 0; i--) {
      const q = st.patches[i];
      q.life -= dt;
      if (q.life <= 0) { st.patches.splice(i, 1); continue; }
      if (!p || q.max - q.life < .35) continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d > q.r + (p.r || 12) * .4) continue;
      // hardened quicklime grips the feet: dragged back toward the middle of the patch (a heavy
      // slow, not a stun: walking still gets out), and it burns
      st.trap = { x: R(p.x), y: R(p.y) };
      drag(api, p, q.x, q.y, 105, dt);
      if ((q.k -= dt) <= 0) {
        q.k = .5;
        if (z.health > 0) api.strike(q.x, q.y, q.r, dmg(api, .22), null, null, true);
      }
    }
  }
  // Pull the local ninja toward (x, y) without a shove (a shove would grant invulnerability).
  // Teammates' ninjas live in their own browsers and are left alone.
  function drag(api, p, x, y, sp, dt) {
    if (!p || p.remote) return;
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 2) return;
    const m = Math.min(d, sp * dt), mx = dx / d * m, my = dy / d * m, r = p.r || 12;
    if (!api.blocked(p.x + mx, p.y, r)) p.x += mx;
    if (!api.blocked(p.x, p.y + my, r)) p.y += my;
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
      const u = FXU[fx.kind];
      if (u && z.health > 0) u(z, st, fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    for (let i = st.ghosts.length - 1; i >= 0; i--) if ((st.ghosts[i].age += dt) > .32) st.ghosts.splice(i, 1);
    if (st.patches.length) patchUpdate(z, st, dt, api); else st.trap = null;
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.dash = null; st.hide = 0; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const e = st.ev[i];
      if ((e.t -= dt) <= 0) { st.ev.splice(i, 1); const h = EV[e.h]; if (h) h(z, st, api, e.a); }
    }
    z.armorScale = m.armor;
    st.hide = Math.max(0, st.hide - dt);
    if (st.dash) dashUpdate(z, st, dt, api);
    st.hold = Math.max(0, st.hold - dt);
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = ''; st.tele = []; st.plan = null;
      }
    } else if (st.hold <= 0 && !st.dash) {
      st.holdMove = '';
      st.timer -= dt;
      const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      if (st.timer <= 0 && p && d < 950) announce(z, st, m, api);
    }
    z.kageDash = st.dash ? .05 : 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.speedScale = st.hide > 0 ? .4 : .9;
  }

  // ================================================================== cached art
  const BLK = { pal: ['30,16,60', '6,4,12', '96,70,170'], base: 'rgba(236,232,255,.9)' };
  const CYAN = ['90,220,255', '170,245,255', '255,255,255'];
  const WATER = ['60,160,255', '150,225,255', '245,253,255'];
  // Black lightning: a black channel outlined in white with a white-hot thread, drawn source-over.
  function blackBolt(ctx, x1, y1, x2, y2, seed, time, w = 1.6, alpha = 1, forks = 1) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 3) return;
    ctx.globalCompositeOperation = 'source-over';
    Kit().forkedBolt(ctx, x1, y1, x2, y2, seed, time, { jitter: Math.min(30, len * .09) + 3, alpha, width: w, pal: BLK.pal,
      base: BLK.base, forkBase: true, step: 14, forks, forkLen: 18 + len * .08, rate: 24, snap: true });
  }
  function rockSpr(i) {
    return Kit().sprite('nk:rock' + (i % 3), 64, 64, g => {
      const c = 32, Rr = 27, path = () => {
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = k / 8 * TAU, r = Rr * (.72 + hash(k % 8 + i * 9) * .28);
          if (k) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = ['#7a6450', '#8a735c', '#66533f'][i % 3]; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = 'rgba(225,200,160,.45)'; g.beginPath(); g.arc(c - 9, c - 11, Rr * .55, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,26,18,.5)'; g.beginPath(); g.arc(c + 12, c + 14, Rr * .7, 0, TAU); g.fill();
      g.restore();
      path(); g.strokeStyle = '#21160f'; g.lineWidth = 3; g.stroke();
    });
  }
  function drawRock(ctx, i, x, y, s, rot, alpha = 1) {
    if (s < 1 || alpha <= .01) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(rockSpr(i), -s, -s, s * 2, s * 2);
    ctx.restore();
  }
  // Darui's black panther, side view facing right; two gallop frames. Centre of the body at (90, 56).
  function pantherSpr(fr) {
    return Kit().sprite('nk:panther' + fr, 190, 110, g => {
      g.translate(92, 60); g.lineJoin = 'round'; g.lineCap = 'round';
      const BODY = '#0c0a14';
      const legs = fr ? [[-38, 6, -66, 30], [-28, 8, -14, 40], [30, 4, 62, 26], [38, 2, 26, 40]]
        : [[-38, 6, -44, 42], [-28, 8, -58, 28], [30, 4, 40, 42], [38, 2, 66, 20]];
      const limb = (w, col) => { g.strokeStyle = col; g.lineWidth = w; for (const [x0, y0, x1, y1] of legs) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 8, (y0 + y1) / 2 - 4, x1, y1); g.stroke(); } };
      const tail = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(-48, -6); g.bezierCurveTo(-74, -18, -86, fr ? -36 : 6, -72, fr ? -46 : -32); g.stroke(); };
      // pale rim first, the black body over it
      limb(15, 'rgba(225,220,255,.95)'); tail(11, 'rgba(225,220,255,.95)');
      const body = () => {
        g.beginPath(); g.ellipse(-2, 0, 52, 19, -.05, 0, TAU);
        g.moveTo(52, -2); g.ellipse(30, -3, 23, 21, -.3, 0, TAU);
        g.moveTo(74, -14); g.ellipse(58, -15, 17, 13, -.2, 0, TAU);
        g.moveTo(66, -22); g.lineTo(90, -16); g.lineTo(82, -8); g.lineTo(66, -9);
        g.moveTo(66, -5); g.lineTo(86, 2); g.lineTo(78, 7); g.lineTo(60, 2);
        g.moveTo(47, -24); g.lineTo(50, -38); g.lineTo(58, -26);
      };
      g.fillStyle = 'rgba(225,220,255,.95)'; g.save(); g.translate(0, 0); g.scale(1.04, 1.1); body(); g.fill(); g.restore();
      limb(11, BODY); tail(7, BODY);
      g.fillStyle = BODY; body(); g.fill();
      // inner crackle: violet-white veins of chakra in the black body
      g.strokeStyle = 'rgba(150,135,240,.75)'; g.lineWidth = 1.3;
      g.beginPath();
      for (let i = 0; i < 7; i++) {
        let px = -44 + i * 14, py = -8 + hash(i * 3 + fr) * 14;
        g.moveTo(px, py);
        for (let k = 0; k < 3; k++) { px += 5 + hash(i + k * 7) * 5; py += (hash(i * 5 + k + fr) - .5) * 12; g.lineTo(px, py); }
      }
      g.stroke();
      // fangs, glowing slit eye, mane tufts along the back
      g.fillStyle = '#f6f4ff';
      g.beginPath(); g.moveTo(80, -9); g.lineTo(83, -3); g.lineTo(85, -10); g.fill();
      g.beginPath(); g.moveTo(74, 2); g.lineTo(76, -3); g.lineTo(79, 3); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(61, -18, 5, 1.8, -.3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(235,230,255,.9)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(-2, 0, 50, 17, -.05, 3.55, 5.85); g.stroke();
      g.beginPath(); g.ellipse(58, -15, 15, 11, -.2, 3.7, 5.7); g.stroke();
    });
  }
  // Chōjūrō's water shark, side view facing right; centre at (60, 32).
  function sharkSpr() {
    return Kit().sprite('nk:shark', 130, 70, g => {
      g.translate(62, 34); g.lineJoin = 'round';
      const O = '#0c2a52';
      const body = () => { g.beginPath(); g.moveTo(56, 2); g.quadraticCurveTo(40, -18, 0, -16); g.quadraticCurveTo(-36, -14, -50, -2); g.lineTo(-60, -18); g.lineTo(-56, 2); g.lineTo(-62, 18); g.lineTo(-48, 6); g.quadraticCurveTo(-20, 16, 10, 14); g.quadraticCurveTo(44, 12, 56, 2); g.closePath(); };
      // dorsal and pectoral fins
      g.fillStyle = '#2f86d4'; g.strokeStyle = O; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-6, -15); g.lineTo(6, -34); g.lineTo(16, -15); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(8, 10); g.lineTo(-4, 26); g.lineTo(22, 12); g.closePath(); g.fill(); g.stroke();
      body(); g.fillStyle = '#4aa8f0'; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = '#e6f8ff'; g.beginPath(); g.ellipse(14, 14, 44, 10, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(4, -10, 36, 4, -.05, 0, TAU); g.fill();
      g.fillStyle = 'rgba(20,70,150,.35)'; g.beginPath(); g.ellipse(-30, 2, 26, 16, 0, 0, TAU); g.fill();
      g.restore();
      body(); g.strokeStyle = O; g.lineWidth = 2.8; g.stroke();
      // gaping maw with teeth, a mean eye, gill slits
      g.fillStyle = '#12305a'; g.beginPath(); g.moveTo(56, 2); g.lineTo(34, 2); g.quadraticCurveTo(40, 10, 50, 9); g.closePath(); g.fill();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(36 + i * 5, 2); g.lineTo(38.5 + i * 5, 6); g.lineTo(41 + i * 5, 2); g.fill(); }
      g.fillStyle = '#0a1a30'; g.beginPath(); g.arc(40, -5, 2.6, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(40.8, -5.8, .9, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(12,42,82,.7)'; g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(24 - i * 4, -6); g.quadraticCurveTo(22 - i * 4, 0, 24 - i * 4, 6); g.stroke(); }
    });
  }
  // Hardened quicklime: an irregular white blob with a darker rim (top-down, already squashed).
  function limeSpr(i) {
    return Kit().sprite('nk:lime' + (i % 3), 128, 72, g => {
      const path = (k) => {
        g.beginPath();
        for (let s = 0; s <= 14; s++) {
          const a = s / 14 * TAU, r = (.78 + hash(s % 14 + i * 13) * .22) * k;
          const px = 64 + Math.cos(a) * 60 * r, py = 36 + Math.sin(a) * 32 * r;
          if (s) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.closePath();
      };
      path(1); g.fillStyle = '#8d877a'; g.fill();
      path(.94); g.fillStyle = '#e9e5da'; g.fill();
      g.save(); path(.94); g.clip();
      g.fillStyle = 'rgba(252,251,246,.75)'; g.beginPath(); g.ellipse(56, 30, 40, 14, -.1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,110,96,.35)'; g.beginPath(); g.ellipse(72, 48, 50, 14, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,82,70,.55)'; g.lineWidth = 1.4;
      for (let s = 0; s < 6; s++) {
        let px = 64 + (hash(s * 3 + i) - .5) * 60, py = 36 + (hash(s * 7 + i) - .5) * 30;
        g.beginPath(); g.moveTo(px, py);
        for (let k = 0; k < 3; k++) { px += (hash(s + k * 5 + i) - .5) * 26; py += (hash(s * 2 + k + i) - .5) * 12; g.lineTo(px, py); }
        g.stroke();
      }
      g.restore();
      path(1); g.strokeStyle = 'rgba(50,44,36,.75)'; g.lineWidth = 2; g.stroke();
    });
  }
  // Earth golem (front 3/4 view), feet at (120, 250).
  function golemSpr() {
    return Kit().sprite('nk:golem', 240, 260, g => {
      g.lineJoin = 'round';
      const O = '#20150e', ST = '#8a7058', ST_D = '#5e4a3a', ST_L = '#b89a7a';
      const blob = (pts, col) => {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = O; g.lineWidth = 4; g.stroke();
      };
      // legs
      blob([[78, 196], [70, 250], [108, 252], [110, 200]], ST_D);
      blob([[132, 200], [134, 252], [172, 250], [164, 196]], ST_D);
      // torso: a great boulder
      blob([[52, 110], [64, 64], [120, 46], [178, 64], [190, 112], [176, 186], [120, 206], [66, 188]], ST);
      g.save(); g.beginPath(); g.moveTo(52, 110); g.lineTo(64, 64); g.lineTo(120, 46); g.lineTo(178, 64); g.lineTo(190, 112); g.lineTo(176, 186); g.lineTo(120, 206); g.lineTo(66, 188); g.closePath(); g.clip();
      g.fillStyle = ST_L; g.beginPath(); g.ellipse(104, 84, 54, 30, -.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,26,18,.45)'; g.beginPath(); g.ellipse(150, 170, 70, 40, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,26,18,.7)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(80, 120); g.lineTo(108, 132); g.lineTo(112, 160); g.moveTo(150, 96); g.lineTo(140, 126); g.lineTo(162, 144); g.moveTo(96, 176); g.lineTo(124, 168); g.stroke();
      g.restore();
      // shoulders / arms hanging
      blob([[30, 96], [56, 76], [72, 108], [66, 168], [44, 196], [22, 176], [20, 130]], ST);
      blob([[210, 96], [184, 76], [170, 108], [176, 168], [198, 196], [220, 176], [222, 130]], ST_D);
      g.fillStyle = ST_L; g.beginPath(); g.ellipse(40, 104, 12, 8, -.5, 0, TAU); g.fill();
      // fists
      blob([[18, 176], [46, 172], [54, 204], [28, 214], [12, 198]], ST);
      blob([[196, 172], [224, 176], [230, 198], [214, 214], [188, 204]], ST_D);
      // head sunk between the shoulders, glowing eyes
      blob([[92, 52], [100, 22], [140, 18], [152, 50], [138, 66], [104, 66]], ST);
      g.fillStyle = '#ffb040'; g.beginPath(); g.ellipse(112, 44, 6, 3.4, .1, 0, TAU); g.ellipse(136, 43, 6, 3.4, -.1, 0, TAU); g.fill();
      g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(112, 44, 1.6, 0, TAU); g.arc(136, 43, 1.6, 0, TAU); g.fill();
      g.strokeStyle = O; g.lineWidth = 2.5; g.beginPath(); g.moveTo(104, 36); g.lineTo(120, 40); g.moveTo(144, 35); g.lineTo(130, 39); g.stroke();
    });
  }
  // Earth dragon head rising from the ground, side view facing right, neck base at (70, 200).
  function dragonSpr() {
    return Kit().sprite('nk:dragon', 230, 210, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#1f140c', ST = '#8a6a4a', ST_D = '#604832', ST_L = '#b8946a';
      // neck
      g.fillStyle = ST_D; g.strokeStyle = O; g.lineWidth = 4;
      g.beginPath(); g.moveTo(30, 205); g.quadraticCurveTo(30, 120, 92, 92); g.lineTo(122, 120); g.quadraticCurveTo(84, 140, 104, 205); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(30,20,12,.6)'; g.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(40 + i * 6, 196 - i * 22); g.lineTo(96 - i * 2, 192 - i * 18); g.stroke(); }
      // upper jaw / skull
      g.fillStyle = ST; g.strokeStyle = O; g.lineWidth = 4;
      g.beginPath(); g.moveTo(78, 96); g.quadraticCurveTo(100, 58, 150, 62); g.lineTo(214, 78); g.lineTo(206, 96); g.lineTo(150, 98); g.lineTo(118, 114); g.closePath(); g.fill(); g.stroke();
      // lower jaw (open)
      g.fillStyle = ST_D;
      g.beginPath(); g.moveTo(112, 118); g.lineTo(150, 108); g.lineTo(204, 128); g.lineTo(196, 140); g.lineTo(140, 136); g.closePath(); g.fill(); g.stroke();
      // mouth interior and teeth
      g.fillStyle = '#3a1e10'; g.beginPath(); g.moveTo(150, 98); g.lineTo(206, 96); g.lineTo(204, 128); g.lineTo(150, 108); g.closePath(); g.fill();
      g.fillStyle = '#e8dcc0';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(158 + i * 9, 97); g.lineTo(162 + i * 9, 106); g.lineTo(166 + i * 9, 97); g.fill(); g.beginPath(); g.moveTo(156 + i * 9, 112 + i * 3); g.lineTo(160 + i * 9, 103 + i * 3); g.lineTo(164 + i * 9, 113 + i * 3); g.fill(); }
      // horns and brow ridge
      g.fillStyle = ST_L; g.strokeStyle = O; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(106, 70); g.lineTo(60, 26); g.lineTo(122, 64); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(124, 64); g.lineTo(104, 16); g.lineTo(140, 62); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,240,210,.35)'; g.beginPath(); g.ellipse(150, 70, 40, 6, .1, 0, TAU); g.fill();
      // eye
      g.fillStyle = '#ffcf50'; g.beginPath(); g.ellipse(148, 78, 7, 4, .2, 0, TAU); g.fill();
      g.fillStyle = '#2a1208'; g.beginPath(); g.ellipse(149, 78, 1.6, 3.4, 0, 0, TAU); g.fill();
      g.strokeStyle = O; g.lineWidth = 3; g.beginPath(); g.moveTo(134, 70); g.lineTo(160, 72); g.stroke();
      // nostril, rock spikes down the neck
      g.fillStyle = O; g.beginPath(); g.ellipse(206, 82, 3, 2, 0, 0, TAU); g.fill();
      g.fillStyle = ST_L;
      for (let i = 0; i < 4; i++) { const bx = 44 + i * 10, by = 170 - i * 26; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 20, by - 8); g.lineTo(bx + 2, by - 16); g.closePath(); g.fill(); g.stroke(); }
    });
  }
  // Stone spike, base centre at (32, 120).
  function spikeSpr(i) {
    return Kit().sprite('nk:spike' + (i % 3), 64, 128, g => {
      const lean = (hash(i * 7.7) - .5) * 10, w = 20 + hash(i * 2.2) * 6;
      g.lineJoin = 'round';
      g.fillStyle = '#4e3e30'; g.beginPath(); g.moveTo(32 - w, 120); g.lineTo(32 + lean, 8); g.lineTo(32 + w, 120); g.closePath(); g.fill();
      g.fillStyle = '#9a8066'; g.beginPath(); g.moveTo(32 - w + 4, 118); g.lineTo(32 + lean, 12); g.lineTo(32 + 2, 118); g.closePath(); g.fill();
      g.fillStyle = '#c4a888'; g.beginPath(); g.moveTo(32 - w + 8, 116); g.lineTo(32 + lean, 16); g.lineTo(32 - 6, 116); g.closePath(); g.fill();
      g.strokeStyle = '#21160f'; g.lineWidth = 3; g.beginPath(); g.moveTo(32 - w, 120); g.lineTo(32 + lean, 8); g.lineTo(32 + w, 120); g.stroke();
      g.strokeStyle = 'rgba(30,20,14,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32 + lean * .5 + 2, 50); g.lineTo(32 + 6, 80); g.lineTo(32 + 2, 104); g.stroke();
    });
  }
  function mistSpr() {
    return Kit().sprite('nk:mist', 128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(236,244,250,.95)'); gr.addColorStop(.5, 'rgba(220,234,244,.55)'); gr.addColorStop(1, 'rgba(210,228,240,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }
  function waterBall() {
    return Kit().sphere('nk:water', [[0, 'rgba(255,255,255,.55)'], [.35, 'rgba(170,230,255,.28)'], [.72, 'rgba(70,170,240,.36)'], [.9, 'rgba(200,240,255,.85)'], [.97, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']], .36, .3);
  }

  // ------------------------------------------------------------------ shared draw helpers
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .92);
    ctx.fillStyle = `rgba(18,16,30,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(0, 0, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 1.8 : faint ? 2 : 3;
    ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(Math.cos(a) * (r - 14), Math.sin(a) * (r - 14)); ctx.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12));
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function markLine(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.fillStyle = `rgba(18,16,30,${s.faint ? .08 : .16})`; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${(s.faint ? .08 : .14) + .16 * k})`; ctx.fillRect(0, -s.w, s.len * clamp01(k), s.w * 2);
    ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = s.faint ? 3.5 : 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = s.faint ? 1.8 : 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  function markCone(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2, L = s.len, h = s.half;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    const wedge = r => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -h, h); ctx.closePath(); };
    wedge(L); ctx.fillStyle = 'rgba(18,16,30,.13)'; ctx.fill();
    wedge(L * clamp01(k)); ctx.fillStyle = `rgba(${rgb},${.1 + .16 * k})`; ctx.fill();
    wedge(L); ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const ph = frac(time * 1.6 + i / 7), r = 50 + ph * (L - 70);
      ctx.moveTo(Math.cos(-h * .85) * r, Math.sin(-h * .85) * r); ctx.arc(0, 0, r, -h * .85, h * .85);
    }
    ctx.stroke();
    ctx.restore();
  }
  function cracks(ctx, x, y, r, n, seed, alpha, w = 2.5) {
    if (alpha <= .01 || r < 4) return;
    ctx.strokeStyle = `rgba(28,18,22,${.7 * alpha})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 4.7 + seed) * .5, l = r * (.55 + hash(i * 9.1 + seed) * .45);
      ctx.moveTo(x + Math.cos(a) * r * .12, y + Math.sin(a) * r * .06);
      for (let k = 1; k <= 5; k++) {
        const b = a + (hash(i * 3 + k * 1.7 + seed) - .5) * .5, d = l * k / 5;
        const nx = x + Math.cos(b) * d, ny = y + Math.sin(b) * d * .5;
        ctx.lineTo(nx, ny);
        if (k === 2) { const c = a + (hash(i + seed) > .5 ? .7 : -.7); ctx.lineTo(nx + Math.cos(c) * l * .22, ny + Math.sin(c) * l * .11); ctx.moveTo(nx, ny); }
      }
    }
    ctx.stroke();
  }
  function crater(ctx, x, y, r, alpha, seed) {
    if (alpha <= .01) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6a5848'; ctx.beginPath(); ctx.ellipse(x, y, r * .9, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c221e'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .7, r * .34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,150,.35)'; ctx.beginPath(); ctx.ellipse(x, y - r * .36, r * .7, r * .08, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    cracks(ctx, x, y, r * 1.35, 9, seed, alpha, 3);
  }
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10, kind = 'dust') {
    if (alpha <= .01) return;
    const K = Kit(), dust = K.puff(kind);
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  function splash(ctx, x, y, r, age, seed, alpha = 1) {
    // water bursting up: a crown of tapered columns, droplets on arcs, a foam ring, spray
    const K = Kit(), t = clamp01(age);
    if (t >= 1) return;
    const a = (1 - t) * alpha;
    K.fx.shockRing(ctx, x, y, r * 1.2, t, a, '120,210,255');
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + hash(i + seed) * .4, d = r * (.3 + .5 * easeOut(t)), bx = x + Math.cos(an) * d, by = y + Math.sin(an) * d * .5;
      const h = r * (.45 + hash(i * 3 + seed) * .6) * bell(Math.min(1, t * 1.25));
      if (h < 3) continue;
      const tx = bx + Math.cos(an) * h * .35, ty = by - h;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx, by - h * .6, tx, ty);
      ctx.strokeStyle = `rgba(16,70,140,${.5 * a})`; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = `rgba(140,215,255,${.85 * a})`; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.9 * a})`; ctx.lineWidth = 2.2; ctx.stroke();
    }
    ctx.fillStyle = `rgba(232,248,255,${a})`;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const an = hash(i * 5.1 + seed) * TAU, d = r * (.3 + t * (.7 + hash(i * 2.3 + seed) * .6));
      const h = Math.sin(Math.PI * Math.min(1, t * 1.3)) * r * (.4 + hash(i * 7 + seed) * .7), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5 - h, s = 2.5 + hash(i) * 3;
      ctx.moveTo(px + s, py); ctx.arc(px, py, s, 0, TAU);
    }
    ctx.fill();
    const w = K.puff('water');
    for (let i = 0; i < 3; i++) K.stamp(ctx, w, x + (hash(i * 5 + seed) - .5) * r * .6, y - 10 - t * r * .4, r * (.18 + t * .2), a * .4, .8);
  }
  function scorch(ctx, x, y, r, alpha) {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(22,16,24,${.38 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(10,8,14,${.3 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, r * .55, r * .27, 0, 0, TAU); ctx.fill();
  }
  // Glow line along a polyline of {x,y} pairs (flat array), layered stroke passes.
  function strokeFlat(ctx, pts, n) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();
  }
  const PBUF = new Float32Array(64), GBUF = new Float32Array(64);

  // ================================================================== DARUI
  function pantherG(ctx, fx, time) {
    const K = Kit();
    // the scorched path it tore up
    if (fx.tr.length > 1) {
      ctx.strokeStyle = `rgba(20,14,30,${.35 * (1 - win(fx.age, fx.dur - .6, fx.dur))})`; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(fx.tr[0][0], fx.tr[0][1]); for (const q of fx.tr) ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    if (fx.done) {
      const u = fx.age - fx.ex, a = 1 - win(u, .6, 1.2);
      scorch(ctx, fx.x, fx.y, 170 * easeOut(u * 4), a);
      cracks(ctx, fx.x, fx.y, 190, 10, fx.seed, a, 3);
      if (u < .5) K.fx.shockRing(ctx, fx.x, fx.y, 260, u / .5, 1 - u / .5, '170,160,255');
    } else {
      ctx.fillStyle = 'rgba(14,10,22,.3)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 4, 70, 16, 0, 0, TAU); ctx.fill();
    }
  }
  function pantherO(ctx, fx, time) {
    const K = Kit();
    if (!fx.done) {
      const c = Math.cos(fx.a), s = Math.sin(fx.a), f = c >= 0 ? 1 : -1, img = pantherSpr(Math.floor(time * 14) % 2);
      // afterimages along the trail
      for (let i = 0; i < fx.tr.length - 1; i += 3) {
        const q = fx.tr[i];
        ctx.save(); ctx.globalAlpha = .16 + i * .03; ctx.translate(q[0], q[1] - 30); ctx.scale(f, 1); ctx.rotate(s * f * .25);
        ctx.drawImage(img, -92, -60, 190, 110); ctx.restore();
      }
      ctx.save(); ctx.translate(fx.x, fx.y - 30); ctx.scale(f, 1); ctx.rotate(s * f * .25);
      ctx.drawImage(img, -92, -60, 190, 110); ctx.restore();
      // black lightning crawling round it
      for (let i = 0; i < 4; i++) {
        const an = time * 7 + i * 1.7 + fx.seed, l = 60 + hash(i + Math.floor(time * 20)) * 50;
        blackBolt(ctx, fx.x - c * 30, fx.y - 34, fx.x - c * 30 + Math.cos(an) * l, fx.y - 34 + Math.sin(an) * l * .6, fx.seed + i * 9, time, 1.3, .9, 1);
      }
      blackBolt(ctx, fx.x - c * 80, fx.y - 30, fx.x - c * 200, fx.y - 26 - s * 40, fx.seed + 50, time, 1.5, .8, 1);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - 32, 110, '120,100,230', .35);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const u = fx.age - fx.ex;
    if (u > .9) return;
    const a = 1 - u / .9, reach = 60 + 220 * easeOut(u * 3);
    for (let i = 0; i < 9; i++) {
      const an = i * TAU / 9 + hash(i + fx.seed) * .6;
      blackBolt(ctx, fx.x, fx.y - 30, fx.x + Math.cos(an) * reach, fx.y - 30 + Math.sin(an) * reach * .55, fx.seed + i * 7, time, 2.2, a, 1);
    }
    blackBolt(ctx, fx.x, fx.y - 400, fx.x, fx.y, fx.seed + 90, time, 3, a, 2);
    ctx.globalCompositeOperation = 'lighter';
    if (u < .15) K.glow(ctx, fx.x, fx.y - 30, 240, '230,225,255', 1 - u / .15, true);
    K.glow(ctx, fx.x, fx.y - 30, 200, '120,100,230', .5 * a);
    ctx.globalCompositeOperation = 'source-over';
    dustRing(ctx, fx.x, fx.y, 140 + u * 120, 10, 26, a * .8, fx.seed);
  }
  function laneG(ctx, fx, time) {
    const k = fx.age / fx.dur, c = Math.cos(fx.a), s = Math.sin(fx.a);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(20,16,36,${.4 * (1 - k)})`; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + c * fx.len, fx.y + s * fx.len); ctx.stroke();
    ctx.strokeStyle = `rgba(215,210,255,${.85 * (1 - k)})`; ctx.lineWidth = 3; ctx.stroke();
  }

  // Ranton Kōga: a thick water-lightning laser out of his palm, sweeping.
  function kogaAngle(fx) { return fx.age < fx.T ? lerp(fx.a0, fx.a1, easeInOut(fx.age / fx.T)) : fx.a1; }
  function kogaG(ctx, fx, time) {
    const an = kogaAngle(fx), c = Math.cos(an), s = Math.sin(an), fade = 1 - win(fx.age, fx.T, fx.T + .6);
    // the swept band burnt into the ground
    const sweptA = Math.min(fx.a0, an), sweptB = Math.max(fx.a0, an);
    ctx.save(); ctx.translate(fx.x, fx.y);
    ctx.fillStyle = `rgba(24,40,52,${.22 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, KOGA_LEN, sweptA, sweptB); ctx.arc(0, 0, KOGA_LEN - 150, sweptB, sweptA, true); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (fx.age > fx.T) return;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(14,30,44,.34)'; ctx.lineWidth = KOGA_W * 2.2;
    ctx.beginPath(); ctx.moveTo(fx.x + c * 40, fx.y + s * 40); ctx.lineTo(fx.x + c * KOGA_LEN, fx.y + s * KOGA_LEN); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(90,210,255,.35)'; ctx.lineWidth = KOGA_W * 1.6; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const ex = fx.x + c * KOGA_LEN, ey = fx.y + s * KOGA_LEN;
    dustRing(ctx, ex, ey, 70, 8, 30, .8, fx.seed + Math.floor(time * 10));
    cracks(ctx, ex, ey, 120, 7, fx.seed + Math.floor(fx.age * 6), .7);
  }
  function kogaO(ctx, fx, time) {
    if (fx.age > fx.T + .25) return;
    const K = Kit(), an = kogaAngle(fx), c = Math.cos(an), s = Math.sin(an), fade = fx.age > fx.T ? 1 - (fx.age - fx.T) / .25 : Math.min(1, fx.age / .08);
    const hx = fx.x, hy = fx.y - 46, ex = fx.x + c * KOGA_LEN, ey = fx.y + s * KOGA_LEN - 14;
    const w = KOGA_W * (.9 + .12 * Math.sin(time * 50));
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(8,36,60,${.55 * fade})`; ctx.lineWidth = w * 1.9;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(70,200,255,${.55 * fade})`; ctx.lineWidth = w * 1.5; ctx.stroke();
    ctx.strokeStyle = `rgba(170,245,255,${.8 * fade})`; ctx.lineWidth = w * .85; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${fade})`; ctx.lineWidth = w * .35; ctx.stroke();
    // spiral rings running down the beam
    ctx.strokeStyle = `rgba(210,250,255,${.7 * fade})`; ctx.lineWidth = 2.5;
    const L = Math.hypot(ex - hx, ey - hy), ux = (ex - hx) / L, uy = (ey - hy) / L, ra = Math.atan2(uy, ux);
    for (let i = 0; i < 9; i++) {
      const d = frac(time * 2.4 + i / 9) * L, px = hx + ux * d, py = hy + uy * d;
      ctx.beginPath(); ctx.ellipse(px, py, 9, w * .95, ra, 0, TAU); ctx.stroke();
    }
    // lightning licking off the beam
    for (let i = 0; i < 5; i++) {
      const d = (hash(i + Math.floor(time * 18)) * .9 + .05) * L, px = hx + ux * d, py = hy + uy * d, side = i % 2 ? 1 : -1;
      K.forkedBolt(ctx, px, py, px - uy * side * (40 + hash(i * 3) * 50) + ux * 30, py + ux * side * (40 + hash(i * 3) * 50) + uy * 30, fx.seed + i * 5, time,
        { jitter: 10, alpha: fade, width: 1.2, pal: CYAN, base: 'rgba(10,60,120,.7)', step: 10, forks: 1, forkLen: 14, rate: 28, snap: true });
    }
    K.glow(ctx, hx, hy, 70, '120,230,255', .9 * fade, true);
    K.glow(ctx, ex, ey, 140, '100,220,255', .7 * fade, true);
    ctx.globalCompositeOperation = 'source-over';
    const sp = K.puff('water');
    for (let i = 0; i < 5; i++) K.stamp(ctx, sp, ex + (hash(i + Math.floor(time * 12)) - .5) * 90, ey - 10 - hash(i * 2 + Math.floor(time * 12)) * 40, 18, .6 * fade, .8);
  }

  // Black lightning rain.
  function boltsG(ctx, fx, time) {
    const K = Kit();
    for (const s of fx.spots) {
      const u = fx.age - s.t;
      if (u < 0) {
        const k = clamp01(1 + u / .5);
        markCircle(ctx, s.x, s.y, s.r, '215,205,255', k, time, true, true);
        ctx.fillStyle = `rgba(10,8,20,${.25 * k})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * .6 * k, s.r * .3 * k, 0, 0, TAU); ctx.fill();
        continue;
      }
      const a = 1 - win(u, .5, 1.1);
      scorch(ctx, s.x, s.y, s.r * (s.big ? 1 : .8), a);
      cracks(ctx, s.x, s.y, s.r * 1.1, s.big ? 12 : 6, s.x + s.y, a, s.big ? 3 : 2);
      if (u < .4) K.fx.shockRing(ctx, s.x, s.y, s.r * 1.4, u / .4, 1 - u / .4, '185,175,255');
    }
  }
  function boltsO(ctx, fx, time) {
    const K = Kit();
    for (const s of fx.spots) {
      const u = fx.age - s.t;
      if (u < -.08 || u > .45) continue;
      const a = u < 0 ? .5 : 1 - u / .45, w = s.big ? 4 : 2.2;
      blackBolt(ctx, s.x + (hash(s.x) - .5) * 120, s.y - 820, s.x, s.y, s.x + s.y, time, w, a, s.big ? 3 : 2);
      if (s.big) for (let i = 0; i < 6; i++) {
        const an = i * TAU / 6 + hash(i + s.x) * .5, l = 120 + easeOut(u * 3) * 160;
        blackBolt(ctx, s.x, s.y - 10, s.x + Math.cos(an) * l, s.y + Math.sin(an) * l * .5, s.x + i * 3, time, 2, a, 1);
      }
      ctx.globalCompositeOperation = 'lighter';
      if (u >= 0 && u < .12) K.glow(ctx, s.x, s.y - 20, s.r * 1.9, '235,230,255', 1 - u / .12, true);
      K.glow(ctx, s.x, s.y - 10, s.r * 1.2, '120,100,230', .45 * a);
      ctx.globalCompositeOperation = 'source-over';
      if (u > 0) dustRing(ctx, s.x, s.y, s.r * (.6 + u), 7, s.big ? 30 : 18, a * .8, s.x);
    }
  }

  // Cleaver dashes.
  function dteleG(ctx, fx, time) {
    markLine(ctx, { x: fx.x, y: fx.y, a: fx.a, len: fx.len, w: 34 }, '235,235,255', fx.age / fx.dur, time);
  }
  function slashG(ctx, fx, time) {
    const a = 1 - fx.age / fx.dur;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(28,20,30,${.45 * a})`; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
    ctx.strokeStyle = `rgba(250,250,255,${.5 * a})`; ctx.lineWidth = 2; ctx.stroke();
  }
  function slashO(ctx, fx, time) {
    if (fx.age > .45) return;
    const k = fx.age / .45, a = 1 - k, mx = (fx.x0 + fx.x1) / 2, my = (fx.y0 + fx.y1) / 2 - 40;
    const L = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0) * .6 + 60;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(fx.a);
    // a broad crescent of the cleaver's swing
    ctx.fillStyle = `rgba(16,12,26,${.55 * a})`;
    ctx.beginPath(); ctx.ellipse(0, 0, L * (.6 + .4 * k), 34, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.ellipse(0, -8, L * (.6 + .4 * k) * .9, 20, 0, Math.PI * 1.95, Math.PI * 1.05, true); ctx.fill();
    ctx.strokeStyle = `rgba(245,245,255,${.95 * a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, L * (.6 + .4 * k), 34, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.restore();
    blackBolt(ctx, fx.x0, fx.y0 - 40, fx.x1, fx.y1 - 40, fx.x0 + fx.y1, time, 1.8, a, 2);
  }
  function spinG(ctx, fx, time) {
    const a = 1 - win(fx.age, .6, fx.dur);
    scorch(ctx, fx.x, fx.y, 200, a);
    cracks(ctx, fx.x, fx.y, 240, 12, fx.seed, a, 3);
    if (fx.age < .5) Kit().fx.shockRing(ctx, fx.x, fx.y, 280, fx.age / .5, 1 - fx.age / .5, '200,190,255');
  }
  function spinO(ctx, fx, time) {
    if (fx.age > .6) return;
    const k = fx.age / .6, a = 1 - k, r = 120 + 140 * easeOut(k * 1.5);
    ctx.save(); ctx.translate(fx.x, fx.y - 30); ctx.scale(1, .5);
    ctx.strokeStyle = `rgba(14,10,24,${.7 * a})`; ctx.lineWidth = 26;
    ctx.beginPath(); ctx.arc(0, 0, r, fx.a + k * 9, fx.a + k * 9 + 4.6); ctx.stroke();
    ctx.strokeStyle = `rgba(250,250,255,${a})`; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + fx.seed; blackBolt(ctx, fx.x, fx.y - 30, fx.x + Math.cos(an) * r, fx.y - 30 + Math.sin(an) * r * .5, fx.seed + i, time, 1.8, a, 1); }
  }

  // Water wave, then black lightning through the flood.
  function comboFront(fx) { return Math.min(COMBO_LEN, fx.age * COMBO_SPEED); }
  function comboG(ctx, fx, time) {
    const K = Kit(), d = comboFront(fx), fade = 1 - win(fx.age, fx.end - .2, fx.dur), h = COMBO_HALF;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    const wedge = (r0, r1) => { ctx.beginPath(); ctx.arc(0, 0, r1, -h, h); ctx.arc(0, 0, r0, h, -h, true); ctx.closePath(); };
    if (d < 24) { ctx.restore(); return; }
    wedge(20, d); ctx.fillStyle = `rgba(30,110,190,${.34 * fade})`; ctx.fill();
    wedge(20, d); ctx.fillStyle = `rgba(150,220,255,${.16 * fade})`; ctx.fill();
    // ripples
    ctx.strokeStyle = `rgba(230,250,255,${.45 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const r = frac(time * .8 + i / 6) * d; ctx.moveTo(Math.cos(-h * .9) * r, Math.sin(-h * .9) * r); ctx.arc(0, 0, r, -h * .9, h * .9); }
    ctx.stroke();
    // foam crest at the front
    if (fx.age < COMBO_LEN / COMBO_SPEED + .2) {
      ctx.strokeStyle = 'rgba(20,70,120,.5)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, d, -h, h); ctx.stroke();
      ctx.strokeStyle = 'rgba(250,255,255,.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, d - 4), -h, h); ctx.stroke();
    }
    ctx.restore();
    // electrified water
    if (fx.age > fx.elec && fx.age < fx.end) {
      const e = fx.age - fx.elec, k = Math.min(1, e / .15);
      ctx.globalCompositeOperation = 'lighter';
      for (const r of [200, 380, 560]) K.glow(ctx, fx.x + Math.cos(fx.a) * r, fx.y + Math.sin(fx.a) * r, 200, '110,190,255', .25 * k * fade, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 9; i++) {
        const tk = Math.floor(time * 10) + i * 3;
        const r1 = 60 + hash(tk) * (COMBO_LEN - 80), a1 = fx.a + (hash(tk * 1.7) - .5) * h * 1.8;
        const r2 = Math.min(COMBO_LEN - 10, r1 + 60 + hash(tk * 2.3) * 120), a2 = a1 + (hash(tk * 3.1) - .5) * .5;
        blackBolt(ctx, fx.x + Math.cos(a1) * r1, fx.y + Math.sin(a1) * r1, fx.x + Math.cos(a2) * r2, fx.y + Math.sin(a2) * r2, tk, time, 1.5, k * fade, 1);
      }
    }
  }
  function comboO(ctx, fx, time) {
    const K = Kit(), d = comboFront(fx), w = K.puff('water');
    if (fx.age < COMBO_LEN / COMBO_SPEED + .3) {
      const a = 1 - win(fx.age, COMBO_LEN / COMBO_SPEED, COMBO_LEN / COMBO_SPEED + .3), N = 16;
      if (d > 30) {
        // the breaking wave: a curling crest standing up along the front
        const lift = 26 * (1 - d / COMBO_LEN * .4);
        for (let i = 0; i < N; i++) {
          const an = fx.a + (i / (N - 1) - .5) * COMBO_HALF * 2 * .97;
          PBUF[i * 2] = fx.x + Math.cos(an) * d; PBUF[i * 2 + 1] = fx.y + Math.sin(an) * d - lift - Math.sin(time * 14 + i * 1.3) * 5;
        }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = `rgba(14,70,140,${.6 * a})`; ctx.lineWidth = 26; strokeFlat(ctx, PBUF, N);
        ctx.strokeStyle = `rgba(90,180,240,${.9 * a})`; ctx.lineWidth = 19; strokeFlat(ctx, PBUF, N);
        for (let i = 0; i < N; i++) PBUF[i * 2 + 1] -= 7;
        ctx.strokeStyle = `rgba(255,255,255,${.95 * a})`; ctx.lineWidth = 6; strokeFlat(ctx, PBUF, N);
        for (let i = 0; i < 7; i++) {
          const an = fx.a + (hash(i + Math.floor(time * 12)) - .5) * COMBO_HALF * 1.9;
          K.stamp(ctx, w, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d - lift - 18 - hash(i * 3 + Math.floor(time * 12)) * 18, 12, .55 * a, .8);
        }
      }
    }
    if (fx.age > fx.elec - .12 && fx.age < fx.elec + .35) {
      // Darui drives black lightning down into the water
      const u = fx.age - fx.elec, a = u < 0 ? .5 : 1 - u / .35;
      const ex = fx.x + Math.cos(fx.a) * 260, ey = fx.y + Math.sin(fx.a) * 260;
      blackBolt(ctx, fx.x, fx.y - 40, ex, ey, fx.seed + 3, time, 3, a, 3);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, ex, ey - 10, 160, '200,200,255', a * .6, true);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // Ranton: Laser Circus.
  function circusLaser(fx, L, n, lift, out) {
    const g = circusGrow(fx, L), H0 = 46;
    for (let i = 0; i < n; i++) {
      const t = g * i / (n - 1), q = circusPoint(fx, L, t);
      out[i * 2] = q[0];
      out[i * 2 + 1] = q[1] - (lift ? H0 * (1 - t) + Math.sin(Math.PI * t) * (70 + Math.abs(L[2]) * 70) : 0);
    }
    return g;
  }
  function circusAlpha(fx) {
    const hold = fx.v === 3 ? .62 : .95, u = fx.age - fx.vt;
    return u > hold ? 1 - clamp01((u - hold) / .12) : 1;
  }
  function circusG(ctx, fx, time) {
    const K = Kit(), A = circusAlpha(fx), N = 14;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!fx.boom) {
      for (const L of fx.L) {
        const g = circusLaser(fx, L, N, false, GBUF);
        if (g <= 0) continue;
        ctx.strokeStyle = `rgba(10,30,44,${.22 * A})`; ctx.lineWidth = 16; strokeFlat(ctx, GBUF, N);
        if (g >= 1) {
          const tx = GBUF[(N - 1) * 2], ty = GBUF[(N - 1) * 2 + 1];
          ctx.fillStyle = `rgba(14,40,60,${.3 * A})`; ctx.beginPath(); ctx.ellipse(tx, ty, 46, 22, 0, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, tx, ty, 80, '100,220,255', .5 * A, false, .5);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      if (fx.v === 3) markCircle(ctx, fx.px, fx.py, 300, '190,250,255', clamp01((fx.age - fx.vt) / .62), time, false, false);
    } else {
      const u = fx.age - fx.boom, a = 1 - win(u, .7, 1.3);
      crater(ctx, fx.px, fx.py, 230, a, fx.seed);
      if (u < .6) K.fx.shockRing(ctx, fx.px, fx.py, 420, u / .6, 1 - u / .6, '150,240,255');
    }
  }
  function circusO(ctx, fx, time) {
    const K = Kit(), A = circusAlpha(fx), N = 14;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!fx.boom) {
      // the gathering orb between his palms
      const hx = fx.x0, hy = fx.y0 - 46;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx, hy, 90 + Math.sin(time * 30) * 8, '120,230,255', .9, true);
      ctx.globalCompositeOperation = 'source-over';
      for (const L of fx.L) {
        const g = circusLaser(fx, L, N, true, PBUF);
        if (g <= 0) continue;
        ctx.strokeStyle = `rgba(6,30,52,${.6 * A})`; ctx.lineWidth = 11; strokeFlat(ctx, PBUF, N);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(80,210,255,${.6 * A})`; ctx.lineWidth = 8; strokeFlat(ctx, PBUF, N);
        ctx.strokeStyle = `rgba(200,250,255,${.9 * A})`; ctx.lineWidth = 3.6; strokeFlat(ctx, PBUF, N);
        ctx.strokeStyle = `rgba(255,255,255,${A})`; ctx.lineWidth = 1.4; strokeFlat(ctx, PBUF, N);
        const tx = PBUF[(N - 1) * 2], ty = PBUF[(N - 1) * 2 + 1];
        K.glow(ctx, tx, ty, g < 1 ? 34 : 54, '150,240,255', A, true);
        ctx.globalCompositeOperation = 'source-over';
        if (g >= 1 && hash(L[0] + Math.floor(time * 16)) > .5) {
          const sp = K.puff('water');
          K.stamp(ctx, sp, tx + (hash(L[1] + Math.floor(time * 16)) - .5) * 40, ty - 12, 16, .55 * A, .8);
        }
      }
      return;
    }
    const u = fx.age - fx.boom;
    if (u > 1) return;
    const a = 1 - u, x = fx.px, y = fx.py;
    ctx.globalCompositeOperation = 'lighter';
    if (u < .2) K.glow(ctx, x, y - 40, 420, '210,250,255', 1 - u / .2, true);
    K.glow(ctx, x, y - 40, 300 * (1 + u), '80,200,255', .6 * a, true);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + fx.seed, l = 100 + easeOut(u * 2) * 300;
      K.forkedBolt(ctx, x, y - 30, x + Math.cos(an) * l, y - 30 + Math.sin(an) * l * .55, fx.seed + i * 4, time,
        { jitter: 16, alpha: a, width: 2, pal: CYAN, base: 'rgba(10,60,120,.75)', forkBase: true, step: 14, forks: 1, forkLen: 30, rate: 24, snap: true });
    }
    splash(ctx, x, y, 260, u * 1.2, fx.seed);
    dustRing(ctx, x, y, 260 + u * 140, 14, 40, a, fx.seed);
  }

  // ================================================================== CHŌJŪRŌ
  // Chakra blade / hammer palette: navy under-stroke, translucent cyan, white edge.
  function chakraBlade(ctx, x0, y0, x1, y1, w, alpha, time) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 4 || alpha <= .01) return;
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(a);
    const shape = (k) => { ctx.beginPath(); ctx.moveTo(0, -w * .55 * k); ctx.quadraticCurveTo(L * .55, -w * k, L, 0); ctx.quadraticCurveTo(L * .55, w * k, 0, w * .55 * k); ctx.closePath(); };
    shape(1.25); ctx.fillStyle = `rgba(8,30,70,${.55 * alpha})`; ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    shape(1); ctx.fillStyle = `rgba(80,180,255,${.45 * alpha})`; ctx.fill();
    shape(.55); ctx.fillStyle = `rgba(190,240,255,${.55 * alpha})`; ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${.9 * alpha})`; ctx.lineWidth = 2;
    shape(1); ctx.stroke();
    // shimmer bands running along it
    ctx.strokeStyle = `rgba(220,250,255,${.6 * alpha})`; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const d = frac(time * 2 + i / 4) * L * .9; ctx.moveTo(d, -w * .4); ctx.lineTo(d + 30, w * .4); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Hiramekarei hammer: the head swings down onto the first mark, rises, slams the second.
  function hammerHead(fx) {
    const t = fx.age, R0 = { x: fx.x - fx.f * 40, y: fx.y, h: 230 }, T1 = { x: fx.t1x, y: fx.t1y, h: 30 }, T2 = { x: fx.t2x, y: fx.t2y, h: 30 };
    const UP = { x: (fx.t1x + fx.t2x) / 2, y: (fx.t1y + fx.t2y) / 2, h: 250 };
    const mix = (A, B, k) => ({ x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), h: lerp(A.h, B.h, k) });
    if (t < .16) return mix(R0, T1, easeIn(t / .16));
    if (t < .32) return T1;
    if (t < .52) return mix(T1, UP, easeOut((t - .32) / .2));
    if (t < .92) { const k = easeInOut((t - .52) / .4); return { x: lerp(UP.x, T2.x, k), y: lerp(UP.y, T2.y, k), h: 250 }; }
    if (t < 1.08) return mix({ x: T2.x, y: T2.y, h: 250 }, T2, easeIn((t - .92) / .16));
    return T2;
  }
  function hammerDraw(ctx, x, y, hx, hy, hh, alpha, time, seed) {
    // shaft from his hands up to the head, the head a broad chakra mallet perpendicular to it
    const K = Kit(), sx = x, sy = y - 44, px = hx, py = hy - hh;
    const a = Math.atan2(py - sy, px - sx);
    chakraBlade(ctx, sx, sy, px, py, 18, alpha, time);
    ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2);
    const box = (w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, r) : ctx.rect(-w / 2, -h / 2, w, h); };
    box(190, 118, 30); ctx.fillStyle = `rgba(8,30,70,${.6 * alpha})`; ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    box(176, 104, 26); ctx.fillStyle = `rgba(70,170,255,${.5 * alpha})`; ctx.fill();
    box(120, 60, 18); ctx.fillStyle = `rgba(190,240,255,${.5 * alpha})`; ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${.95 * alpha})`; ctx.lineWidth = 3; box(176, 104, 26); ctx.stroke();
    ctx.strokeStyle = `rgba(220,250,255,${.6 * alpha})`; ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 0; i < 3; i++) { const d = -60 + frac(time * 1.5 + i / 3) * 120; ctx.moveTo(d, -44); ctx.lineTo(d + 16, 44); } ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, px, py, 150, '110,200,255', .45 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    void seed;
  }
  function hammerG(ctx, fx, time) {
    const K = Kit();
    for (const [hit, x, y, t0] of [[fx.hit1, fx.t1x, fx.t1y, .16], [fx.hit2, fx.t2x, fx.t2y, 1.08]]) {
      if (!hit && !(t0 > 1 && fx.age > .5)) continue;
      const u = fx.age - t0;
      if (u < 0) { markCircle(ctx, x, y, 210, '150,215,255', clamp01((fx.age - .5) / .58), time, false, false); continue; }
      const a = 1 - win(u, .8, 1.25);
      crater(ctx, x, y, 180, a, x + y);
      if (u < .5) K.fx.shockRing(ctx, x, y, 320, u / .5, 1 - u / .5, '140,210,255');
    }
    const h = hammerHead(fx);
    ctx.fillStyle = `rgba(10,30,60,${.25 * (1 - win(fx.age, 1.3, 1.8))})`; ctx.beginPath(); ctx.ellipse(h.x, h.y, 90, 34, 0, 0, TAU); ctx.fill();
  }
  function hammerO(ctx, fx, time, z) {
    const a = 1 - win(fx.age, 1.3, 1.8);
    const h = hammerHead(fx), bx = z ? z.x : fx.x, by = z ? z.y : fx.y;
    if (a > 0) hammerDraw(ctx, bx + fx.f * 10, by, h.x, h.y, h.h + 40, a, time, fx.seed);
    for (const [x, y, t0] of [[fx.t1x, fx.t1y, .16], [fx.t2x, fx.t2y, 1.08]]) {
      const u = fx.age - t0;
      if (u < 0 || u > .8) continue;
      splash(ctx, x, y, 200, u / .8, x);
      dustRing(ctx, x, y, 170 + u * 140, 10, 30, 1 - u / .8, y);
      Kit().fx.debris(ctx, x, y - 10, 200, u, x + y, '#5a4838', 10);
    }
  }
  function hammerWind(ctx, z, k, time) {
    const f = faceOf(z.nk.aim);
    hammerDraw(ctx, z.x + f * 10, z.y, z.x - f * 40, z.y, 230 * easeOut(k) + 40, .35 + .65 * k, time, 0);
  }

  // Long chakra blade: a 200° sweep, then the thrust.
  function sweepAngle(fx) { return lerp(fx.a0, fx.a1, easeInOut(fx.age / fx.T)); }
  function sweepG(ctx, fx, time) {
    const an = sweepAngle(fx), fade = 1 - win(fx.age, fx.T, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y);
    const s0 = Math.min(fx.a0, an), s1 = Math.max(fx.a0, an);
    ctx.fillStyle = `rgba(60,150,230,${.2 * fade})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, SWEEP_L, s0, s1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(20,40,60,${.4 * fade})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, SWEEP_L - 20, s0, s1); ctx.stroke();
    ctx.strokeStyle = `rgba(230,250,255,${.6 * fade})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function sweepO(ctx, fx, time, z) {
    if (fx.age > fx.T + .2) return;
    const an = sweepAngle(fx), a = fx.age > fx.T ? 1 - (fx.age - fx.T) / .2 : 1, x = z ? z.x : fx.x, y = (z ? z.y : fx.y) - 40;
    // trailing afterimages of the blade
    for (let i = 1; i <= 3; i++) {
      const pa = lerp(fx.a0, fx.a1, easeInOut((fx.age - i * .035) / fx.T));
      chakraBlade(ctx, x, y, x + Math.cos(pa) * SWEEP_L, y + Math.sin(pa) * SWEEP_L * .9, 30, a * .22 / i, time);
    }
    chakraBlade(ctx, x, y, x + Math.cos(an) * SWEEP_L, y + Math.sin(an) * SWEEP_L * .9, 34, a, time);
  }
  function thrustG(ctx, fx, time) {
    const c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (fx.age < .4) markLine(ctx, { x: fx.x, y: fx.y, a: fx.a, len: fx.len, w: 46 }, '170,225,255', fx.age / .4, time);
    else {
      const a = 1 - win(fx.age, .7, fx.dur);
      ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(30,40,50,${.4 * a})`; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(fx.x + c * 40, fx.y + s * 40); ctx.lineTo(fx.x + c * fx.len, fx.y + s * fx.len); ctx.stroke();
      ctx.strokeStyle = `rgba(230,250,255,${.5 * a})`; ctx.lineWidth = 2.5; ctx.stroke();
      const u = fx.age - .4;
      if (u < .5) Kit().fx.shockRing(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 200, u / .5, 1 - u / .5, '160,220,255');
    }
  }
  function thrustO(ctx, fx, time, z) {
    if (fx.age < .32 || fx.age > .85) return;
    const c = Math.cos(fx.a), s = Math.sin(fx.a), x = z ? z.x : fx.x, y = (z ? z.y : fx.y) - 40;
    const ext = fx.age < .42 ? easeOut((fx.age - .32) / .1) : 1 - win(fx.age, .62, .85);
    chakraBlade(ctx, x, y, x + c * fx.len * ext, y + s * fx.len * ext * .96 + 20 * ext, 28, 1, time);
    if (fx.age > .4 && fx.age < .6) {
      const ex = x + c * fx.len, ey = y + s * fx.len * .96 + 20;
      ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, ex, ey, 120, '160,230,255', 1 - (fx.age - .4) / .2, true); ctx.globalCompositeOperation = 'source-over';
      splash(ctx, ex, ey + 20, 110, (fx.age - .4) / .5, fx.seed);
    }
  }

  // Water shark bombs.
  function sharkG(ctx, fx, time) {
    const K = Kit();
    for (const s of fx.sh) {
      const u = (fx.age - s.t0) / s.T;
      if (u < 0) continue;
      if (u < 1) {
        // the wake furrow through the ground water
        const q = sharkPos(fx, s, u);
        ctx.fillStyle = 'rgba(20,60,110,.3)'; ctx.beginPath(); ctx.ellipse(q[0], q[1] + 4, 42, 13, 0, 0, TAU); ctx.fill();
        const q0 = sharkPos(fx, s, Math.max(0, u - .18));
        ctx.strokeStyle = 'rgba(200,240,255,.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      } else {
        const v = fx.age - s.t0 - s.T, a = 1 - win(v, .4, 1);
        ctx.fillStyle = `rgba(30,100,170,${.3 * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 130, 60, 0, 0, TAU); ctx.fill();
        if (v < .45) K.fx.shockRing(ctx, s.x, s.y, 190, v / .45, 1 - v / .45, '120,200,255');
      }
    }
  }
  function sharkO(ctx, fx, time) {
    const K = Kit(), img = sharkSpr(), w = K.puff('water');
    for (const s of fx.sh) {
      const u = (fx.age - s.t0) / s.T;
      if (u < 0) continue;
      if (u < 1) {
        const q = sharkPos(fx, s, u), q2 = sharkPos(fx, s, Math.min(1, u + .02));
        const an = Math.atan2(q2[1] - q[1], q2[0] - q[0]), f = Math.cos(an) >= 0 ? 1 : -1;
        const hop = 26 + Math.abs(Math.sin(u * Math.PI * 3)) * 46;
        for (let i = 1; i <= 3; i++) { const qq = sharkPos(fx, s, Math.max(0, u - i * .05)); K.stamp(ctx, w, qq[0], qq[1] - hop * .5, 16 - i * 2, .55 - i * .12, .8); }
        ctx.save(); ctx.translate(q[0], q[1] - hop); ctx.scale(f, 1); ctx.rotate(Math.sin(an) * f * .5 - Math.cos(u * Math.PI * 3) * .2);
        ctx.drawImage(img, -62 * 1.05, -34 * 1.05, 130 * 1.05, 70 * 1.05); ctx.restore();
      } else {
        const v = fx.age - s.t0 - s.T;
        if (v < .8) splash(ctx, s.x, s.y, 150, v / .8, s.x + s.y);
      }
    }
  }

  // Water prison.
  function prisonG(ctx, fx, time) {
    const a = 1 - win(fx.age, PRISON_T + .3, fx.dur), k = easeOut(fx.age / .3);
    ctx.fillStyle = `rgba(30,110,190,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, PRISON_R * k, PRISON_R * .5 * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(220,245,255,${.55 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, PRISON_R * k, PRISON_R * .5 * k, 0, 0, TAU); ctx.stroke();
    if (fx.age > PRISON_T) { const v = fx.age - PRISON_T; if (v < .5) Kit().fx.shockRing(ctx, fx.x, fx.y, 280, v / .5, 1 - v / .5, '130,210,255'); }
  }
  function prisonO(ctx, fx, time) {
    const K = Kit(), x = fx.x, y = fx.y - 50, w = K.puff('water');
    if (fx.age < PRISON_T) {
      const k = easeBack(fx.age / .32), r = 108 * k;
      // columns of water spiralling up into the sphere
      if (fx.age < .4) for (let i = 0; i < 8; i++) {
        const an = i * TAU / 8 + fx.age * 8, rr = PRISON_R * (1 - fx.age / .4);
        K.stamp(ctx, w, x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr * .5 - fx.age * 120, 20, .8, .8);
      }
      K.stamp(ctx, waterBall(), x, y, r, .95, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(200,240,255,.5)'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y, r * (.95 - i * .2), r * .3, time * (1.4 + i * .4) + i, 0, TAU); ctx.stroke(); }
      K.glow(ctx, x, y, r * 1.3, '80,180,255', .25);
      ctx.globalCompositeOperation = 'source-over';
      // bubbles rising inside (a drowning ninja's last breath when someone is caught)
      ctx.strokeStyle = 'rgba(240,252,255,.85)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < (fx.caught ? 12 : 6); i++) {
        const ph = frac(time * .9 + hash(i + fx.seed)), bx = x + (hash(i * 3 + fx.seed) - .5) * r * 1.2, by = y + r * .7 - ph * r * 1.4;
        ctx.beginPath(); ctx.arc(bx + Math.sin(time * 4 + i) * 4, by, 2.5 + hash(i) * 4, 0, TAU); ctx.stroke();
      }
      return;
    }
    const v = fx.age - PRISON_T;
    if (v < .8) splash(ctx, fx.x, fx.y, 200, v / .8, fx.seed);
  }

  // Hidden mist.
  function mistA(fx) { return Math.min(1, fx.age / .5) * (1 - win(fx.age, fx.dur - 1.2, fx.dur)); }
  function mistG(ctx, fx, time) {
    const a = mistA(fx), K = Kit(), img = mistSpr();
    ctx.fillStyle = `rgba(214,228,238,${.22 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, MIST_R * Math.min(1, fx.age / .5 + .2), MIST_R * .52, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + time * .05 + fx.seed, d = MIST_R * (.25 + hash(i + fx.seed) * .7);
      K.stamp(ctx, img, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5, 180 + hash(i * 3) * 80, .45 * a, .55);
    }
  }
  function mistO(ctx, fx, time) {
    const a = mistA(fx), K = Kit(), img = mistSpr();
    for (let i = 0; i < 14; i++) {
      const an = i * TAU / 14 - time * .07 + fx.seed * 2, d = MIST_R * (.15 + hash(i * 2.7 + fx.seed) * .8);
      K.stamp(ctx, img, fx.x + Math.cos(an) * d + Math.sin(time * .5 + i) * 30, fx.y + Math.sin(an) * d * .5 - 40 - hash(i) * 50, 130 + hash(i * 5) * 70, .2 * a, .6);
    }
  }
  function mlaneG(ctx, fx, time) {
    markLine(ctx, { x: fx.x0, y: fx.y0, a: fx.a, len: Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0), w: 40 }, '170,230,255', Math.min(1, fx.age / .44), time);
  }
  function mslashO(ctx, fx, time) {
    if (fx.age > .45) return;
    const a = 1 - fx.age / .45;
    chakraBlade(ctx, fx.x0, fx.y0 - 40, fx.x1, fx.y1 - 40, 24 * a + 6, a, time);
    splash(ctx, fx.x1, fx.y1, 90, fx.age / .45, fx.x1);
  }
  function mrevealO(ctx, fx, time) {
    const K = Kit(), w = K.puff('water'), a = 1 - fx.age / fx.dur;
    for (let i = 0; i < 8; i++) { const an = i * TAU / 8; K.stamp(ctx, w, fx.x + Math.cos(an) * (30 + fx.age * 90), fx.y - 30 + Math.sin(an) * 18, 18, .6 * a, .8); }
  }

  // Hiramekarei unleashed: twin giant blades, then the X slam.
  function unleashG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    if (fx.age <= 1.1) {
      const [a1, a2] = unleashAngles(fx);
      ctx.save(); ctx.translate(fx.x, fx.y);
      ctx.fillStyle = 'rgba(60,150,230,.14)';
      for (const [s, e] of [[fx.a - 2.25, a1], [fx.a + 2.25, a2]]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, UNL_L, Math.min(s, e), Math.max(s, e)); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    if (fx.age > 1.15 && fx.age < UNL_X) {
      const k = (fx.age - 1.15) / (UNL_X - 1.15);
      for (const s of [1, -1]) {
        const an = fx.a + s * .78, c = Math.cos(an) * 560, sn = Math.sin(an) * 560;
        markLine(ctx, { x: fx.cx - c, y: fx.cy - sn, a: an, len: 1120, w: 52 }, '160,230,255', k, time);
      }
      markCircle(ctx, fx.cx, fx.cy, 300, '160,230,255', k, time, false, false);
    }
    if (fx.age >= UNL_X) {
      const u = fx.age - UNL_X;
      ctx.lineCap = 'round';
      for (const s of [1, -1]) {
        const an = fx.a + s * .78, c = Math.cos(an) * 560, sn = Math.sin(an) * 560;
        ctx.strokeStyle = `rgba(26,30,40,${.5 * fade})`; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(fx.cx - c, fx.cy - sn); ctx.lineTo(fx.cx + c, fx.cy + sn); ctx.stroke();
        ctx.strokeStyle = `rgba(200,240,255,${.5 * fade})`; ctx.lineWidth = 4; ctx.stroke();
      }
      crater(ctx, fx.cx, fx.cy, 240, fade, fx.seed);
      if (u < .6) K.fx.shockRing(ctx, fx.cx, fx.cy, 460, u / .6, 1 - u / .6, '150,225,255');
    }
  }
  function unleashO(ctx, fx, time, z) {
    const K = Kit(), x = z ? z.x : fx.x, y = (z ? z.y : fx.y) - 44;
    if (fx.age <= 1.15) {
      const a = fx.age > 1 ? 1 - (fx.age - 1) / .15 : 1;
      for (const an of unleashAngles(fx)) chakraBlade(ctx, x, y, x + Math.cos(an) * UNL_L, y + Math.sin(an) * UNL_L * .92, 64, a, time);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 140, '120,210,255', .8 * a, true); ctx.globalCompositeOperation = 'source-over';
    } else if (fx.age < UNL_X) {
      // the two blades rise high above the target, crossed, then fall
      const k = (fx.age - 1.15) / (UNL_X - 1.15), h = 640 * (1 - easeIn(Math.max(0, (k - .75) / .25))) + 20;
      for (const s of [1, -1]) {
        const an = fx.a + s * .78, c = Math.cos(an) * 520, sn = Math.sin(an) * 520 * .6;
        chakraBlade(ctx, fx.cx - c, fx.cy - h - sn, fx.cx + c, fx.cy - h + sn, 70, Math.min(1, k * 3), time);
      }
    } else {
      const u = fx.age - UNL_X;
      if (u < 1.1) {
        const a = 1 - u / 1.1;
        ctx.globalCompositeOperation = 'lighter';
        if (u < .18) K.glow(ctx, fx.cx, fx.cy - 30, 460, '220,250,255', 1 - u / .18, true);
        K.glow(ctx, fx.cx, fx.cy - 30, 320, '90,190,255', .5 * a, true);
        ctx.globalCompositeOperation = 'source-over';
        splash(ctx, fx.cx, fx.cy, 320, u / 1.1, fx.seed);
        dustRing(ctx, fx.cx, fx.cy, 260 + u * 200, 16, 44, a, fx.seed);
        K.fx.debris(ctx, fx.cx, fx.cy - 10, 320, u, fx.seed, '#5a4838', 14);
      }
    }
  }

  // ================================================================== KUROTSUCHI
  function limeAngle(fx) { return fx.a + fx.sw * Math.sin(clamp01(fx.age / fx.T) * Math.PI - Math.PI / 2); }
  function limeO(ctx, fx, time, z) {
    if (fx.age > fx.T + .3) return;
    const K = Kit(), a = fx.age > fx.T ? 1 - (fx.age - fx.T) / .3 : 1, an = limeAngle(fx), c = Math.cos(an), s = Math.sin(an);
    const mx = z ? z.x + faceOf(fx.a) * 8 : fx.x, my = (z ? z.y : fx.y) - fx.H;
    const img = limeSpr(0), steam = K.puff('smoke');
    // the jet itself: a thick band of white paste arcing from her mouth down to the ground
    const gy = my + fx.H, reachD = LIME_LEN * Math.min(1, fx.age / .3), N = 14;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), d = t * reachD, h = fx.H * (1 - t) + Math.sin(Math.PI * t) * 70;
      PBUF[i * 2] = mx + c * d; PBUF[i * 2 + 1] = gy + s * d - h;
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(70,62,52,${.55 * a})`; ctx.lineWidth = 24; strokeFlat(ctx, PBUF, N);
    ctx.strokeStyle = `rgba(236,232,222,${a})`; ctx.lineWidth = 18; strokeFlat(ctx, PBUF, N);
    ctx.strokeStyle = `rgba(255,255,252,${a})`; ctx.lineWidth = 6; strokeFlat(ctx, PBUF, N);
    // globs of paste breaking off the jet
    for (let i = 0; i < 26; i++) {
      const t = frac(i / 26 + time * 2.2), d = t * LIME_LEN * Math.min(1, fx.age / .25), sp = (hash(i * 3.3) - .5) * LIME_HALF * 1.4 * t;
      const px = mx + Math.cos(an + sp) * d, py = my + Math.sin(an + sp) * d + fx.H * t - Math.sin(Math.PI * t) * 60;
      const r = 8 + t * 22;
      ctx.globalAlpha = a * (1 - t * .3);
      ctx.drawImage(img, px - r, py - r * .6, r * 2, r * 1.2);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) K.stamp(ctx, steam, mx + c * (40 + i * 30), my + s * (40 + i * 30) - i * 10, 14 + i * 5, .3 * a, .8);
  }
  function limeG(ctx, fx, time) {
    for (const d of fx.drops) {
      const u = fx.age - d.t;
      if (u < 0 || u > .5) continue;
      const k = u / .5;
      ctx.strokeStyle = `rgba(250,248,240,${1 - k})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const an = i * TAU / 7 + d.x; ctx.moveTo(d.x + Math.cos(an) * 30 * k, d.y + Math.sin(an) * 15 * k); ctx.lineTo(d.x + Math.cos(an) * (40 + 60 * k), d.y + Math.sin(an) * (20 + 30 * k)); }
      ctx.stroke();
    }
  }
  function patchesG(ctx, st, time) {
    const K = Kit();
    for (const q of st.patches) {
      const born = q.max - q.life, grow = easeBack(born / .3), a = Math.min(1, q.life / .6);
      ctx.globalAlpha = a;
      ctx.drawImage(limeSpr(q.seed), q.x - q.r * grow, q.y - q.r * .5 * grow, q.r * 2 * grow, q.r * .96 * grow);
      ctx.globalAlpha = 1;
      // wet paste still steaming while it sets
      if (born < 1.4) {
        const sm = K.puff('smoke');
        for (let i = 0; i < 3; i++) K.stamp(ctx, sm, q.x + (hash(i + q.seed) - .5) * q.r, q.y - 14 - frac(time * .8 + i / 3) * 40, 14, .25 * (1 - born / 1.4), .8);
      }
    }
    if (st.trap) {
      // the hardened lime gripping the ninja's ankles
      const t = st.trap;
      ctx.drawImage(limeSpr(1), t.x - 34, t.y - 16, 68, 34);
      ctx.fillStyle = '#ece8dc'; ctx.strokeStyle = 'rgba(60,52,44,.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(t.x - 16, t.y + 2); ctx.lineTo(t.x - 13, t.y - 14); ctx.lineTo(t.x + 12, t.y - 15); ctx.lineTo(t.x + 16, t.y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  function lobPos(fx, g, u) {
    const x = lerp(fx.x0, g.x, u), y = lerp(fx.y0, g.y, u), h = fx.H * (1 - u) + Math.sin(Math.PI * u) * 260;
    return [x, y, h];
  }
  function lobG(ctx, fx, time) {
    const K = Kit();
    for (const g of fx.gl) {
      const u = (fx.age - g.t0) / g.T;
      if (u < 0) continue;
      if (u < 1) { const p = lobPos(fx, g, u); ctx.fillStyle = `rgba(30,24,20,${.15 + .25 * u})`; ctx.beginPath(); ctx.ellipse(p[0], p[1], 20 + u * 16, 9 + u * 7, 0, 0, TAU); ctx.fill(); }
      else {
        const v = fx.age - g.t0 - g.T;
        if (v < .4) K.fx.shockRing(ctx, g.x, g.y, 160, v / .4, 1 - v / .4, '240,235,220');
      }
    }
  }
  function lobO(ctx, fx, time) {
    const K = Kit(), img = limeSpr(2), sm = K.puff('smoke');
    for (const g of fx.gl) {
      const u = (fx.age - g.t0) / g.T;
      if (u < 0) continue;
      if (u < 1) {
        const p = lobPos(fx, g, u), r = 22 + 6 * Math.sin(time * 20 + g.x);
        for (let i = 1; i <= 3; i++) { const q = lobPos(fx, g, Math.max(0, u - i * .05)); ctx.globalAlpha = .5 - i * .12; ctx.drawImage(img, q[0] - r * .6, q[1] - q[2] - r * .4, r * 1.2, r * .8); }
        ctx.globalAlpha = 1;
        ctx.drawImage(img, p[0] - r, p[1] - p[2] - r * .7, r * 2, r * 1.4);
        K.stamp(ctx, sm, p[0], p[1] - p[2] - 14, 12, .25, .8);
      } else {
        const v = fx.age - g.t0 - g.T;
        if (v < .5) {
          const a = 1 - v / .5;
          ctx.strokeStyle = `rgba(252,250,244,${a})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath();
          for (let i = 0; i < 9; i++) { const an = i * TAU / 9 + g.x; const d0 = 20 + v * 80, d1 = 50 + v * 200; ctx.moveTo(g.x + Math.cos(an) * d0, g.y - 10 + Math.sin(an) * d0 * .5 - v * 30); ctx.lineTo(g.x + Math.cos(an) * d1, g.y - 10 + Math.sin(an) * d1 * .5 - Math.sin(v * 6) * 40); }
          ctx.stroke();
          dustRing(ctx, g.x, g.y, 90 + v * 80, 7, 20, a * .8, g.x, 10, 'smoke');
        }
      }
    }
  }

  // Earth golem.
  function golemScale(fx) { return fx.age < .55 ? easeBack(fx.age / .55) : fx.age > 3.5 ? 1 - easeIn((fx.age - 3.5) / .7) : 1; }
  function golemG(ctx, fx, time) {
    const K = Kit(), s = golemScale(fx);
    ctx.fillStyle = 'rgba(30,20,12,.35)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 120 * Math.max(.3, s), 42 * Math.max(.3, s), 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, 170, 10, fx.seed, 1 - win(fx.age, 3.6, fx.dur), 3);
    for (const pu of fx.p) {
      if (fx.age < pu.t - .78) continue;
      const u = fx.age - pu.t;
      if (u < 0) { markCircle(ctx, pu.x, pu.y, 190, '230,190,140', 1 + u / .78, time, false, false); continue; }
      const a = 1 - win(u, .8, 1.3);
      crater(ctx, pu.x, pu.y, 170, a, pu.x);
      if (u < .45) K.fx.shockRing(ctx, pu.x, pu.y, 280, u / .45, 1 - u / .45, '230,200,160');
    }
  }
  function golemO(ctx, fx, time) {
    const K = Kit(), s = golemScale(fx), img = golemSpr();
    if (s > .02) {
      const crumble = fx.age > 3.5;
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(fx.f, 1);
      ctx.globalAlpha = crumble ? s : 1;
      // breathing sway, a lurch forward as it punches
      let lean = Math.sin(time * 2) * .02;
      for (const pu of fx.p) { const u = fx.age - pu.t; if (u > -.25 && u < .3) lean += bell((u + .25) / .55) * .12; }
      ctx.rotate(lean);
      ctx.drawImage(img, -120 * 1.15, -250 * 1.15 * s, 240 * 1.15, 260 * 1.15 * s);
      ctx.restore();
      if (fx.age < .7) dustRing(ctx, fx.x, fx.y, 120, 12, 34, 1 - fx.age / .7, fx.seed);
      if (crumble) { K.fx.debris(ctx, fx.x, fx.y - 120, 220, (fx.age - 3.5) / 1, fx.seed, '#6e5844', 16); dustRing(ctx, fx.x, fx.y, 140, 12, 40, s, fx.seed + 4); }
    }
    // rock fists flying out on chains of boulders
    for (const pu of fx.p) {
      const u = fx.age - pu.t;
      if (u < -.3 || u > .55) continue;
      const k = u < 0 ? easeIn((u + .3) / .3) : 1, back = u > .25 ? 1 - (u - .25) / .3 : 1;
      const sx = fx.x + fx.f * 70, sy = fx.y - 170, ex = pu.x, ey = pu.y - 30;
      const fx2 = lerp(sx, ex, k * back), fy2 = lerp(sy, ey, k * back) - Math.sin(Math.PI * k) * 80 * back;
      for (let i = 1; i < 7; i++) { const t = i / 7; drawRock(ctx, i, lerp(sx, fx2, t), lerp(sy, fy2, t) - Math.sin(Math.PI * t) * 30, 20, i + time, 1); }
      drawRock(ctx, 0, fx2, fy2, 52, u * 3, 1);
      if (u >= 0 && u < .5) {
        dustRing(ctx, pu.x, pu.y, 160 + u * 160, 12, 36, 1 - u / .5, pu.x);
        K.fx.debris(ctx, pu.x, pu.y - 10, 220, u * 1.6, pu.y, '#6e5844', 14);
      }
    }
  }

  // Stone spear lanes.
  function spearFront(fx, l) { return Math.max(0, Math.min(l.len, (fx.age - l.t0) * SPEAR_SPEED)); }
  function spearsG(ctx, fx, time) {
    const a = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const l of fx.lanes) {
      const d = spearFront(fx, l), c = Math.cos(l.a), s = Math.sin(l.a);
      if (d <= 0) continue;
      ctx.strokeStyle = `rgba(40,26,18,${.45 * a})`; ctx.lineWidth = 14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x + c * 50, fx.y + s * 50); ctx.lineTo(fx.x + c * d, fx.y + s * d); ctx.stroke();
      cracks(ctx, fx.x + c * d, fx.y + s * d, 70, 5, l.a * 10 + Math.floor(d / 90), a * .8);
      if (d >= l.len) {
        const ex = fx.x + c * (l.len + 40), ey = fx.y + s * (l.len + 40), u = fx.age - l.t0 - l.len / SPEAR_SPEED;
        crater(ctx, ex, ey, 110, a, l.a * 17);
        if (u < .4) Kit().fx.shockRing(ctx, ex, ey, 190, u / .4, 1 - u / .4, '225,195,150');
      }
    }
  }
  function spearsO(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .6, fx.dur), sink = win(fx.age, fx.dur - .8, fx.dur);
    // a ring of spikes bursting round her first
    if (fx.age < 1.6) {
      const k = easeBack(fx.age / .2) * (1 - win(fx.age, 1.1, 1.6));
      for (let i = 0; i < 10; i++) { const an = i * TAU / 10, x = fx.x + Math.cos(an) * 130, y = fx.y + Math.sin(an) * 70; const h = 70 * k; if (h > 2) ctx.drawImage(spikeSpr(i), x - 20, y - h, 40, h * 1.07); }
    }
    for (const l of fx.lanes) {
      const d = spearFront(fx, l), c = Math.cos(l.a), s = Math.sin(l.a);
      for (let dd = 70, i = 0; dd <= d; dd += 46, i++) {
        const age = fx.age - l.t0 - dd / SPEAR_SPEED, h = (60 + hash(i + l.a) * 50) * easeBack(age / .18) * (1 - sink), side = (i % 2 ? 1 : -1) * (6 + hash(i * 3) * 14);
        if (h < 2) continue;
        const x = fx.x + c * dd - s * side, y = fx.y + s * dd + c * side * .5;
        ctx.globalAlpha = fade; ctx.drawImage(spikeSpr(i + R(l.a * 3)), x - 18, y - h, 36, h * 1.07);
      }
      ctx.globalAlpha = 1;
      if (d > 0 && d < l.len) { const x = fx.x + c * d, y = fx.y + s * d; dustRing(ctx, x, y, 40, 5, 22, .8, Math.floor(d / 60)); }
      if (d >= l.len) {
        const u = fx.age - l.t0 - l.len / SPEAR_SPEED, ex = fx.x + c * (l.len + 40), ey = fx.y + s * (l.len + 40);
        const h = 150 * easeBack(u / .2) * (1 - sink);
        if (h > 2) for (let k = 0; k < 3; k++) ctx.drawImage(spikeSpr(k + 1), ex - 34 + (k - 1) * 30, ey - h * (k === 1 ? 1 : .7) + (k === 1 ? 0 : 8), 68, h * (k === 1 ? 1.07 : .75));
        if (u < .5) { dustRing(ctx, ex, ey, 110 + u * 100, 9, 30, 1 - u / .5, l.a); K.fx.debris(ctx, ex, ey - 10, 160, u * 1.4, l.a, '#6e5844', 10); }
      }
    }
  }

  // Earth dragon.
  function dragonO(ctx, fx, time) {
    const K = Kit(), img = dragonSpr();
    const rise = fx.age < .45 ? easeBack(fx.age / .45) : fx.age > fx.dur - .6 ? 1 - easeIn((fx.age - (fx.dur - .6)) / .6) : 1;
    if (rise <= .02) return;
    const recoil = fx.spit >= 0 ? bell((fx.age - fx.spit) / .25) : 0;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(fx.f, 1); ctx.rotate(-recoil * .1);
    ctx.drawImage(img, -70, -205 * rise, 230, 210 * rise);
    ctx.restore();
    if (fx.age < .6) dustRing(ctx, fx.x, fx.y, 80, 10, 30, 1 - fx.age / .6, fx.seed);
    if (fx.spit >= 0 && fx.age - fx.spit < .3) {
      const u = (fx.age - fx.spit) / .3, mx = fx.x + fx.f * 175, my = fx.y - 95 * rise;
      const dust = K.puff('dust');
      for (let i = 0; i < 6; i++) K.stamp(ctx, dust, mx + fx.f * (10 + u * 70 + i * 8), my + (hash(i) - .5) * 30 * u, 14 + u * 20, (1 - u) * .8, .8);
    }
  }
  function dragonG(ctx, fx, time) {
    ctx.fillStyle = 'rgba(30,20,12,.35)'; ctx.beginPath(); ctx.ellipse(fx.x + fx.f * 30, fx.y, 90, 30, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, 110, 8, fx.seed, 1 - win(fx.age, fx.dur - .6, fx.dur), 2.5);
  }

  // Quicklime flood and the earth dome.
  function domeK(fx) { return win(fx.age, .9, DOME_T); }
  function floodG(ctx, fx, time) {
    const K = Kit(), r = floodR(fx), fade = 1 - win(fx.age, fx.dur - .9, fx.dur);
    // the white sheet of quicklime setting over the ground
    ctx.fillStyle = `rgba(236,232,220,${.55 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, r * .52, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(160,150,132,${.25 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r * .9, r * .45, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, r * .95, 16, fx.seed, .6 * fade * win(fx.age, .6, 1.4), 2);
    if (fx.age < 1.1) {
      ctx.strokeStyle = 'rgba(60,52,44,.5)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, r * .52, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,252,.95)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r - 6, r * .52 - 3, 0, 0, TAU); ctx.stroke();
    }
    // the dome: its mark, then the walls rising, the cap, the rubble
    const dk = domeK(fx);
    if (fx.age < DOME_T) markCircle(ctx, fx.tx, fx.ty, DOME_R, '230,200,150', fx.age / DOME_T, time, false, false);
    if (dk > 0) domeBack(ctx, fx, dk, time);
    if (fx.slam) {
      const u = fx.age - DOME_T, a = 1 - win(u, 1.2, 2.4);
      crater(ctx, fx.tx, fx.ty, 230, a, fx.seed);
      if (u < .6) K.fx.shockRing(ctx, fx.tx, fx.ty, 420, u / .6, 1 - u / .6, '235,210,170');
    }
  }
  // Earth dome (Doryū Jōheki closing over the target): the walls rise from the rim and close at
  // the apex. Back wall on the ground layer, front wall over the characters (see-through while open).
  function domeRing(ctx, fx, dk, front, time) {
    const x = fx.tx, y = fx.ty, rx = DOME_R + 10, ry = rx * .5;
    const crumble = fx.slam ? win(fx.age, DOME_T + .45, DOME_T + 1.05) : 0;
    if (crumble >= 1) return;
    const close = easeInOut(dk), H = 250 * Math.min(1, dk * 1.6) * (1 - easeIn(crumble) * .85);
    const rxo = rx * Math.pow(1 - close, .8), ryo = rxo * .5, yr = y - H * (.45 + .55 * close);
    const alpha = (front ? (dk < 1 ? .62 + .3 * close : 1) : 1) * (1 - crumble);
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round';
    const path = () => {
      ctx.beginPath();
      if (front) {
        ctx.moveTo(x - rx, y);
        ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true);
        ctx.quadraticCurveTo(x + rx * 1.04, yr + (y - yr) * .15, x + rxo, yr);
        if (rxo > 1) ctx.ellipse(x, yr, rxo, ryo, 0, 0, Math.PI, false);
        ctx.quadraticCurveTo(x - rx * 1.04, yr + (y - yr) * .15, x - rx, y);
      } else {
        ctx.moveTo(x - rx, y);
        ctx.quadraticCurveTo(x - rx * 1.04, yr + (y - yr) * .15, x - rxo, yr);
        if (rxo > 1) ctx.ellipse(x, yr, rxo, ryo, 0, Math.PI, TAU, false);
        ctx.quadraticCurveTo(x + rx * 1.04, yr + (y - yr) * .15, x + rx, y);
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI, true);
      }
      ctx.closePath();
    };
    path(); ctx.fillStyle = front ? '#8c7058' : '#5e4a3a'; ctx.fill();
    ctx.save(); path(); ctx.clip();
    // strata bands, a lit crown, the shadowed left flank and boulders set in the wall
    ctx.fillStyle = front ? 'rgba(40,26,16,.35)' : 'rgba(20,12,8,.3)'; ctx.beginPath(); ctx.ellipse(x - rx * .75, y - H * .3, rx * .5, H, 0, 0, TAU); ctx.fill();
    if (front) { ctx.fillStyle = 'rgba(230,205,170,.35)'; ctx.beginPath(); ctx.ellipse(x + rx * .15, yr + 10, rx * .7, Math.max(20, H * .3), 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(40,26,16,.5)'; ctx.lineWidth = 3;
    for (let i = 1; i <= 4; i++) { const k = i / 5, hy = lerp(y, yr, k), hr = lerp(rx, rxo, k); ctx.beginPath(); ctx.ellipse(x, hy, hr, hr * .5, 0, front ? .15 : Math.PI + .15, front ? Math.PI - .15 : TAU - .15); ctx.stroke(); }
    if (front) for (let i = 0; i < 14; i++) {
      const k = hash(i * 3.1) * .85, an = .25 + hash(i * 7.3) * (Math.PI - .5), hr = lerp(rx, rxo, k);
      drawRock(ctx, i, x + Math.cos(an) * hr * .95, lerp(y, yr, k) + Math.sin(an) * hr * .45, 16 + hash(i) * 14, i, .9);
    }
    ctx.restore();
    path(); ctx.strokeStyle = '#21160f'; ctx.lineWidth = 4; ctx.stroke();
    if (front && rxo > 1) { ctx.strokeStyle = 'rgba(230,205,170,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, yr, rxo, ryo, 0, 0, Math.PI); ctx.stroke(); }
    ctx.restore();
    // rocks raining off the rim as it climbs, chunks breaking away as it crumbles
    if (front && dk < 1) for (let i = 0; i < 6; i++) { const an = hash(i + Math.floor(time * 6)) * Math.PI, fall = frac(time * 2 + i / 6); drawRock(ctx, i, x + Math.cos(an) * rxo, yr + Math.sin(an) * ryo + fall * 60, 8, i + time * 3, 1 - fall); }
    if (front && crumble > 0) for (let i = 0; i < 16; i++) {
      const an = hash(i * 1.7) * TAU, fall = easeIn(clamp01(crumble * 1.5 - hash(i * 5.3) * .5));
      drawRock(ctx, i, x + Math.cos(an) * rx * .8 * (1 + fall * .3), y - 40 - 200 * (1 - fall) * hash(i * 2.9) + Math.sin(an) * ry * .8, 20 + hash(i) * 14, i + fall * 4, 1 - fall * .7);
    }
  }
  function domeBack(ctx, fx, dk, time) { domeRing(ctx, fx, dk, false, time); }
  function floodO(ctx, fx, time) {
    const K = Kit(), r = floodR(fx), img = limeSpr(0), sm = K.puff('smoke');
    if (fx.age < 1.15) {
      const a = 1 - win(fx.age, .95, 1.15), n = 22;
      for (let i = 0; i < n; i++) {
        const an = i * TAU / n + fx.seed, px = fx.x + Math.cos(an) * r, py = fx.y + Math.sin(an) * r * .52, s = 26 + hash(i + Math.floor(time * 8)) * 16;
        ctx.globalAlpha = a; ctx.drawImage(img, px - s, py - s * .9 - 14, s * 2, s * 1.2);
        if (i % 3 === 0) K.stamp(ctx, sm, px, py - 40, 22, .3 * a, .8);
      }
      ctx.globalAlpha = 1;
    }
    const dk = domeK(fx);
    if (dk > 0) domeRing(ctx, fx, dk, true, time);
    if (fx.slam) {
      const u = fx.age - DOME_T;
      if (u < 1.2) {
        const a = 1 - u / 1.2;
        dustRing(ctx, fx.tx, fx.ty, DOME_R + u * 160, 18, 46, a, fx.seed);
        K.fx.debris(ctx, fx.tx, fx.ty - 40, 340, u, fx.seed, '#6e5844', 18);
      }
    }
  }

  // ------------------------------------------------------------------ dispatch
  const FX = {
    panther: [pantherG, pantherO], lane: [laneG, null], koga: [kogaG, kogaO], bolts: [boltsG, boltsO],
    dtele: [dteleG, null], slash: [slashG, slashO], spin: [spinG, spinO], combo: [comboG, comboO], circus: [circusG, circusO],
    hammer: [hammerG, hammerO], sweep: [sweepG, sweepO], thrust: [thrustG, thrustO], shark: [sharkG, sharkO], prison: [prisonG, prisonO],
    mist: [mistG, mistO], mlane: [mlaneG, null], mslash: [slashG, mslashO], mreveal: [null, mrevealO], unleash: [unleashG, unleashO],
    lime: [limeG, limeO], lob: [lobG, lobO], golem: [golemG, golemO], spears: [spearsG, spearsO], dragon: [dragonG, dragonO], flood: [floodG, floodO]
  };

  // Windup at the caster: a chakra aura, plus the jutsu's own tell.
  function windupG(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
    ctx.globalCompositeOperation = 'lighter';
    Kit().glow(ctx, z.x, z.y, 70 + 50 * k, rgb, .3 + .25 * k, false, .45);
    ctx.globalCompositeOperation = 'source-over';
    if (z.bossId === 'kurotsuchi' || st.move === 'hammer' || st.move === 'unleash' || st.move === 'circus') cracks(ctx, z.x, z.y, 60 + 80 * k, 7, z.id || 3, .6 * k, 2);
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, f = faceOf(st.aim), H = HEIGHT(z);
    const hx = z.x + f * 16, hy = z.y - H * .5;
    if (z.bossId === 'darui') {
      if (st.move === 'koga' || st.move === 'circus') {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, hx, hy, 30 + 60 * k, '120,230,255', .5 + .5 * k, true);
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 4; i++) { const an = time * 9 + i * 1.6; K.forkedBolt(ctx, hx, hy, hx + Math.cos(an) * (30 + 40 * k), hy + Math.sin(an) * (20 + 30 * k), i * 7, time, { jitter: 8, alpha: .9, width: 1.1, pal: CYAN, base: 'rgba(10,60,120,.6)', step: 8, forks: 0, rate: 28, snap: true }); }
      } else {
        for (let i = 0; i < 4; i++) { const an = time * 8 + i * 1.6; blackBolt(ctx, hx, hy, hx + Math.cos(an) * (34 + 40 * k), hy + Math.sin(an) * (24 + 30 * k), i * 13, time, 1.2, .5 + .5 * k, 0); }
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 40 + 40 * k, '140,120,240', .4 * k); ctx.globalCompositeOperation = 'source-over';
      }
    } else if (z.bossId === 'chojuro') {
      if (st.move === 'hammer') hammerWind(ctx, z, k, time);
      else if (st.move === 'sweep' || st.move === 'unleash') chakraBlade(ctx, hx, hy, hx + f * (60 + (st.move === 'unleash' ? 260 : 140) * k), hy - 40 * k, st.move === 'unleash' ? 40 : 22, .4 + .6 * k, time);
      else {
        const w = K.puff('water');
        for (let i = 0; i < 6; i++) { const an = time * 4 + i * TAU / 6; K.stamp(ctx, w, z.x + Math.cos(an) * (50 - 20 * k), z.y - 30 + Math.sin(an) * 18 - k * 20, 12 + 6 * k, .5 + .3 * k, .8); }
      }
    } else {
      const sm = K.puff(st.move === 'lime' || st.move === 'lob' || st.move === 'flood' ? 'smoke' : 'dust');
      for (let i = 0; i < 5; i++) K.stamp(ctx, sm, z.x + f * 10 + (hash(i) - .5) * 30, z.y - H * .72 - frac(time * 1.4 + i / 5) * 40, 10 + 6 * k, .45 * k, .8);
      if (st.move === 'golem' || st.move === 'spears' || st.move === 'dragon') K.fx.debris(ctx, z.x, z.y - 6, 70 + 40 * k, frac(time * 1.3), z.id || 1, '#6e5844', 6);
    }
  }

  function label(ctx, z, st, m) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (!move || !MOVES[move] || st.hide > 0) return;
    const top = z.y - HEIGHT(z) - 32;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#10121a'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.hide = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
    for (let i = st.patches.length - 1; i >= 0; i--) if ((st.patches[i].life -= dt) <= 0) st.patches.splice(i, 1);
    st.ghosts.length = 0; st.trap = null;
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.nk;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    if (!st.fx.length && !st.patches.length && !(st.windup > 0) && z.health <= 0) return;
    ctx.save();
    if (st.patches.length) patchesG(ctx, st, time);
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
      for (const s of st.tele) {
        if (s.k === 'c') markCircle(ctx, s.follow ? z.x : s.x, s.follow ? z.y : s.y, s.r, rgb, k, time, s.faint, s.small);
        else if (s.k === 'line') markLine(ctx, s, rgb, k, time);
        else if (s.k === 'cone') markCone(ctx, s, rgb, k, time);
      }
      windupG(ctx, z, st, time);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.nk;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    const S = Spr();
    if (S && st.ghosts.length) {
      for (const g of st.ghosts) S.draw(ctx, z.bossId, g.x, g.y + 3, { facing: g.f, frame: 'attack', alpha: (g.m ? .5 : .38) * (1 - g.age / .32) });
      ctx.globalAlpha = 1;
    }
    if (z.health > 0 && !(st.hide > 0)) {
      if (st.windup > 0 && st.move) { windupO(ctx, z, st, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  function hidden(z) { const st = z.nk; return !!(st && st.hide > 0 && !st.dash); }

  window.NewKageBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden };
})();
