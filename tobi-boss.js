(() => {
  'use strict';

  // Fourth Great Ninja War: Tobi, the masked Obito who leads Akatsuki (spawn panel, faction 'tobi').
  // Contract as nagato-boss.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
  // ground layer (telegraphs, wood, fire seas, the rising Gedō Mazō), drawOverlay(ctx, z, time) what
  // stands above the characters (Kamui vortices, canopies, the statue's arms and fists).
  // All per-boss state lives on z.tb. Moves: Kamui suction vortex, Kamui warp ambush, Mokuton wood
  // spikes, Gōka Mekkyaku fire sea, Uchiha Gaeshi reflect, Jukai Kōtan closing forest, Kamui
  // intangible phase dashes, and the ultimate: summoning the Gedō Mazō to crush the target.
  // Kamui intangibility: while z.tb.phase > 0 every blow passes through him (damage is undone).
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;

  const order = ['tobi'];
  const members = {
    tobi: {
      name: 'TOBI — HỘI TRƯỞNG AKATSUKI', short: 'TOBI', accent: '#ff8a2a', hpScale: 3.8, damageScale: 2.0, armor: .9,
      // Every jutsu shows once in the first ~25 s; the second lap reorders them.
      moves: ['kamui', 'sashiki', 'warp', 'katon', 'gaeshi', 'jukai', 'phase', 'gedo',
        'warp', 'kamui', 'katon', 'sashiki', 'phase', 'jukai', 'gaeshi', 'gedo']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    kamui:   { label: 'THẦN UY · KAMUI', rgb: '196,160,255', windup: .95, after: 1.7 },
    sashiki: { label: 'MỘC ĐỘN · THỨ CHI THUẬT', rgb: '176,224,110', windup: .85, after: 1.5 },
    warp:    { label: 'THẦN UY · KHÔNG GIAN DỊCH CHUYỂN', rgb: '255,150,70', windup: .5, after: 1.5 },
    katon:   { label: 'HỎA ĐỘN · HÀO HỎA DIỆT KHƯỚC', rgb: '255,110,40', windup: 1.0, after: 2.0 },
    gaeshi:  { label: 'UCHIHA GAESHI · ĐOÀN PHIẾN PHẢN', rgb: '255,110,90', windup: .4, after: 1.5 },
    jukai:   { label: 'MỘC ĐỘN · THỤ GIỚI GIÁNG ĐẢN', rgb: '140,214,96', windup: 1.0, after: 2.0 },
    phase:   { label: 'THẦN UY · HƯ HÓA XUYÊN THẤU', rgb: '205,175,255', windup: .6, after: 1.4 },
    gedo:    { label: 'KHẨU KÝ · NGOẠI ĐẠO MA TƯỢNG', rgb: '200,160,255', windup: 1.2, after: 3.0 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const KAMUI_R = 300, KAMUI_T = 1.9;
  const SASH_LEN = 1000, SASH_SPEED = 1700, SASH_W = 50;
  const KATON = { reach: 820, half: .58, speed: 1500, dur: 4.2 };
  const GAESHI_T = 1.15, GAESHI_R = 340, GAESHI_LEN = 660, GAESHI_HALF = .72;
  const JUKAI_RINGS = [[380, 13, .12], [245, 10, .55], [120, 6, .98]], JUKAI_C = 1.38, JUKAI_R = 400;
  const PHASE_N = 3, PHASE_DASH = .2, PHASE_GAP = .3, PHASE_OVER = 170;
  const GEDO_HOLD = 5.0, GEDO_DUR = 6.4, GEDO_SC = .74, GEDO_BACK = 70, SLAM_R = 210, FINAL_R = 430;

  function pick() { return order[0]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  const H = () => { const S = Spr(); return S && S.height ? S.height('tobi') : 88; };
  // The single eye hole of the mask (where Kamui opens).
  function eyeOf(z, f) { return { x: z.x + f * 6, y: z.y + 3 - H() * .7 }; }

  function state(z) {
    return z.tb || (z.tb = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], force: null, hold: 0, holdMove: '', phase: 0, phaseHp: 0, ripple: 0, guard: 0, guardHp: 0,
      absorbed: 0, warp: null, dash: null, swing: 0, reactCd: 7, hpMark: z.health, hpClock: 0, lanes: null, trees: null, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = Math.random() * 99;
    // Co-op snapshots JSON the whole boss; a back-reference to it must stay out of that (clients fall back to fx.x / fx.y).
    if (fx.z) Object.defineProperty(fx, 'z', { value: fx.z, enumerable: false, writable: true });
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });

  // A free spot near (x, y): tries the point, then rotated alternatives round the anchor.
  function freeSpot(api, ax, ay, a, d, r) {
    for (const o of [0, .9, -.9, 1.8, -1.8, Math.PI]) {
      const x = ax + Math.cos(a + o) * d, y = ay + Math.sin(a + o) * d;
      if (!api.blocked(x, y, r)) return { x, y };
    }
    return null;
  }

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty;
    const circ = (cx, cy, r, faint, small) => ({ k: 'c', x: cx, y: cy, r, faint, small });
    switch (move) {
      case 'kamui': return [circ(tx, ty, KAMUI_R), circ(tx, ty, 170, true)];
      case 'sashiki': {
        st.lanes = [-.3, 0, .3].map((o, i) => ({ a: a + o, x0: x + Math.cos(a + o) * 46, y0: y + Math.sin(a + o) * 46, t0: [.08, 0, .14][i], seed: Math.random() * 99 }));
        return st.lanes.map(l => ({ k: 'line', x: l.x0, y: l.y0, a: l.a, len: SASH_LEN, w: SASH_W }));
      }
      case 'warp': return [];
      case 'katon': return [{ k: 'cone', follow: true, a, len: KATON.reach, half: KATON.half }];
      case 'gaeshi': return [{ k: 'c', follow: true, r: GAESHI_R, faint: true }];
      case 'jukai': {
        const trees = [], b = Math.random() * TAU;
        JUKAI_RINGS.forEach(([R, n, t], ri) => {
          for (let i = 0; i < n; i++) {
            const an = b + (i + ri * .5) / n * TAU + rand(-.08, .08), d = R * rand(.92, 1.06);
            trees.push({ x: tx + Math.cos(an) * d, y: ty + Math.sin(an) * d, t: t + i * .012 + rand(0, .06), h: rand(78, 112) * (1 - ri * .08), v: trees.length % 5, seed: Math.random() * 99, r: 70 });
          }
        });
        trees.push({ x: tx, y: ty, t: JUKAI_C, h: 165, v: 2, seed: Math.random() * 99, r: 130, big: true });
        st.trees = trees;
        return [circ(tx, ty, JUKAI_R), circ(tx, ty, 130, true)];
      }
      case 'phase': return [{ k: 'line', follow: true, a, len: 540, w: 44 }];
      case 'gedo': {
        // It rises just north of the target, leaning toward Tobi's side, so the whole statue towers over the fight on screen.
        st.gx = tx + Math.max(-300, Math.min(300, x - tx)) * .8; st.gy = ty - GEDO_BACK;
        return [circ(st.gx, st.gy, 470, true)];
      }
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
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, a = st.aim;
    api.burst(z.x, z.y - 40, m.accent, 8);
    switch (move) {
      case 'kamui': {
        const rocks = [];
        for (let i = 0; i < 14; i++) rocks.push({ a: Math.random() * TAU, d: rand(.55, 1.05), s: rand(7, 15), v: i % 3, sp: rand(.8, 1.4) });
        addFx(st, { kind: 'kamui', x: st.tx, y: st.ty, R: KAMUI_R, T: KAMUI_T, dur: KAMUI_T + 1.5, tick: .2, done: false, dmg: D, rocks, upd: kamuiUpd });
        api.shake(6);
        break;
      }
      case 'sashiki': {
        const lanes = st.lanes || [];
        for (const l of lanes) {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 60, i = 0; d <= SASH_LEN; d += 80, i++) {
            const x = l.x0 + c * d, y = l.y0 + s * d;
            later(st, l.t0 + d / SASH_SPEED, api => { api.strike(x, y, 58, D * 1.25, null, i % 4 === 2 ? 'earth' : null, true); if (i % 4 === 0) api.shake(5); });
          }
        }
        addFx(st, { kind: 'sashiki', lanes, x: z.x, y: z.y, a, dur: .2 + SASH_LEN / SASH_SPEED + 2.3 });
        st.lanes = null;
        api.shake(8);
        break;
      }
      case 'warp': {
        const p = api.player, pa = p ? Math.atan2(p.y - z.y, p.x - z.x) : a;
        const spot = p ? freeSpot(api, p.x, p.y, pa, 125, z.r || 24) : null;
        if (!spot) break;
        st.warp = { t: 0, x0: z.x, y0: z.y, x1: spot.x, y1: spot.y, moved: false };
        st.phase = Math.max(st.phase, .75); st.phaseHp = z.health;
        const fx = addFx(st, { kind: 'warp', x0: z.x, y0: z.y, x1: spot.x, y1: spot.y, f0: Math.cos(pa) >= 0 ? 1 : -1, f1: Math.cos(pa + Math.PI) >= 0 ? 1 : -1, dur: 1.9, sx: 0, sy: 0, slam: -1 });
        later(st, .55, api => {
          // he comes out of the vortex facing the target and raises the gunbai
          const q = api.player, qa = q ? Math.atan2(q.y - spot.y, q.x - spot.x) : pa + Math.PI;
          fx.sx = spot.x + Math.cos(qa) * 70; fx.sy = spot.y + Math.sin(qa) * 70; fx.qa = qa;
        });
        later(st, 1.12, api => {
          api.strike(fx.sx, fx.sy, 180, D * 2.2, '#ffb070', 'crater');
          api.knockback({ x: fx.sx, y: fx.sy }, 200, 150, 0);
          fx.slam = fx.age; st.swing = .32;
          api.shake(14);
        });
        break;
      }
      case 'katon': {
        const fx = addFx(st, { kind: 'katon', x: z.x, y: z.y, a, reach: KATON.reach, half: KATON.half, dur: KATON.dur, tick: .5, dmg: D, upd: katonUpd });
        fx.hits = [];
        for (let d = 70; d <= KATON.reach; d += 85) {
          const cnt = Math.max(1, Math.ceil(2 * KATON.half * d / 115));
          for (let i = 0; i < cnt; i++) {
            const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * KATON.half * .9);
            fx.hits.push({ x: z.x + Math.cos(aa) * d, y: z.y + Math.sin(aa) * d, r: Math.max(55, (2 * KATON.half * d / cnt) * .64), d, done: false });
          }
        }
        // flame tongues: area-uniform points in the cone, sorted back-to-front
        fx.pts = [];
        for (let j = 0; j < 170; j++) {
          const d = KATON.reach * Math.sqrt(lerp(.02, 1, hash(j * 1.31 + fx.seed))), off = (hash(j * 2.71 + fx.seed) * 2 - 1) * KATON.half * .96;
          const aa = a + off * (.55 + .45 * Math.min(1, d / 220));
          fx.pts.push({ x: z.x + Math.cos(aa) * d, y: z.y + Math.sin(aa) * d, d, s: (70 + hash(j * 4.1) * 56) * (.7 + .45 * d / KATON.reach), i: j % 6 });
        }
        fx.pts.sort((p, q) => p.y - q.y);
        api.world(z.x + Math.cos(a) * 420, z.y + Math.sin(a) * 420, 190, D * 2.4, 'fire', a);
        api.world(z.x + Math.cos(a) * 700, z.y + Math.sin(a) * 700, 210, D * 2.4, 'fire', a);
        api.shake(10);
        break;
      }
      case 'gaeshi':
        st.guard = GAESHI_T; st.guardHp = z.health; st.absorbed = 0;
        st.hold = GAESHI_T; st.holdMove = 'gaeshi';
        addFx(st, { kind: 'gaeshi', x: z.x, y: z.y, a, rel: GAESHI_T, dur: GAESHI_T + 1.3, z });
        break;
      case 'jukai': {
        const trees = st.trees || [];
        let last = 0;
        for (const tr of trees) {
          later(st, tr.t + .45, api => {
            api.strike(tr.x, tr.y, tr.r, D * (tr.big ? 2.3 : 1.05), tr.big ? '#9ad070' : null, tr.big || hash(tr.seed) < .2 ? 'earth' : null, !tr.big);
            if (tr.big) api.shake(16);
          });
          last = Math.max(last, tr.t);
        }
        addFx(st, { kind: 'jukai', trees, x: st.tx, y: st.ty, dur: last + .45 + 3.4 });
        later(st, .2, api => api.shake(8));
        st.trees = null;
        break;
      }
      case 'phase': {
        st.phase = Math.max(st.phase, PHASE_N * (PHASE_DASH + PHASE_GAP) + .25); st.phaseHp = z.health;
        st.dash = { n: 0, t: -.05, moving: false, sx: 0, sy: 0, ex: 0, ey: 0, nx: 0, ny: 0 };
        st.hold = st.phase; st.holdMove = 'phase';
        addFx(st, { kind: 'phase', z, ghosts: [], paths: [], dur: st.phase + .8 });
        break;
      }
      case 'gedo': {
        const sx = st.gx, sy = st.gy;
        st.hold = GEDO_HOLD; st.holdMove = 'gedo';
        const fx = addFx(st, { kind: 'gedo', x: sx, y: sy, dur: GEDO_DUR, slams: [], roar: -1 });
        api.burst(sx, sy - 40, '#c8b8ff', 20);
        api.shake(12);
        later(st, .45, api => { api.world(sx, sy, 170, D * 2.2, 'earth'); api.shake(14); });
        later(st, 1.0, api => {
          fx.roar = fx.age;
          api.knockback({ x: sx, y: sy }, 470, 80, D * .9);
          api.shake(18);
        });
        const slam = (t0, imp, side, r, both, dmg) => {
          later(st, t0, api => {
            const q = api.player, x = q ? q.x : st.tx, y = q ? q.y : st.ty;
            const list = both ? [-1, 1] : [side];
            for (const sd of list) fx.slams.push({ t0: fx.age, imp, x: x + (both ? sd * 105 : 0), y: y - (both ? 20 : 0), cx: x, cy: y, side: sd, r, big: both });
          });
          later(st, t0 + imp, api => {
            const s = fx.slams.find(s => Math.abs(s.t0 + s.imp - fx.age) < .08) || fx.slams[fx.slams.length - 1];
            const x = s ? s.cx : st.tx, y = s ? s.cy : st.ty;
            api.strike(x, y, r, D * dmg, both ? '#d8c8ff' : null, 'crater');
            api.world(x, y, both ? 300 : 170, D * (both ? 4 : 3), 'crater');
            if (both) for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + .78; api.world(x + Math.cos(aa) * 380, y + Math.sin(aa) * 380, 160, D * 3, 'crater', aa); }
            api.shake(both ? 30 : 17);
          });
        };
        slam(1.3, .85, -1, SLAM_R, false, 2.6);
        slam(2.35, .85, 1, SLAM_R, false, 2.6);
        slam(3.4, 1.05, 0, FINAL_R, true, 4.2);
        break;
      }
    }
  }

  function kamuiUpd(fx, dt, api) {
    if (fx.age < fx.T) {
      if ((fx.tick -= dt) <= 0) { fx.tick = .3; api.knockback(fx, fx.R + 150, -50, fx.dmg * .26); }
    } else if (!fx.done) {
      fx.done = true;
      api.strike(fx.x, fx.y, 175, fx.dmg * 2.4, '#d8c8ff', 'vortex');
      api.world(fx.x, fx.y, 160, fx.dmg * 2.6, 'vortex');
      api.knockback(fx, 320, 170, fx.dmg * .6);
      api.shake(18);
    }
  }
  function katonUpd(fx, dt, api) {
    const front = Math.min(fx.reach, fx.age * KATON.speed), live = fx.age < fx.dur - .8;
    for (let i = 0; i < fx.hits.length; i++) {
      const h = fx.hits[i];
      if (!h.done && h.d <= front) { h.done = true; api.strike(h.x, h.y, h.r, fx.dmg * 1.5, null, i % 4 === 0 ? 'fire' : null, true); }
    }
    if (front >= fx.reach && live && (fx.tick -= dt) <= 0) {
      fx.tick = .45;
      for (const h of fx.hits) api.strike(h.x, h.y, h.r * .9, fx.dmg * .28, null, null, true);
    }
  }

  // Uchiha Gaeshi: the fan swallows every blow, then hurls it back as a gale.
  function release(z, st, api) {
    const D = api.damage || 60, p = api.player, a = aimAt(z, p);
    const bonus = Math.min(1.6, st.absorbed / Math.max(1, z.maxHealth * .01) * .22);
    api.knockback(z, GAESHI_R, 260, D * 1.4);
    for (let d = 140; d <= GAESHI_LEN; d += 120) {
      const cnt = Math.max(1, Math.ceil(2 * GAESHI_HALF * d / 130));
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * GAESHI_HALF * .9);
        api.strike(z.x + Math.cos(aa) * d, z.y + Math.sin(aa) * d, 80, D * (1.7 + bonus), null, null, true);
      }
    }
    for (let i = 0; i < 7; i++) api.projectile(z, a + (i / 6 - .5) * GAESHI_HALF * 1.8, 560, D * .5, 'wind', '#ffd8c8', 1.1);
    api.world(z.x + Math.cos(a) * 300, z.y + Math.sin(a) * 300, 180, D * 2.6, 'shockwave', a);
    const f = st.fx.find(f => f.kind === 'gaeshi'); if (f) { f.ra = a; f.bonus = bonus; }
    st.swing = .3;
    api.shake(16);
  }

  // Kamui phase dashes: he slips through the target three times while intangible.
  function updateDash(z, st, dt, api) {
    const ds = st.dash, D = api.damage || 60;
    if (!ds) return;
    ds.t += dt;
    const f = st.fx.find(f => f.kind === 'phase');
    if (!ds.moving) {
      if (ds.n === 0 || ds.t >= PHASE_GAP) {
        if (ds.n >= PHASE_N) { st.dash = null; return; }
        const p = api.player, a = aimAt(z, p), px = p ? p.x : z.x + Math.cos(a) * 200, py = p ? p.y : z.y + Math.sin(a) * 200;
        let ex = px + Math.cos(a) * PHASE_OVER, ey = py + Math.sin(a) * PHASE_OVER;
        for (let k = 0; k < 6 && api.blocked(ex, ey, z.r || 24); k++) { ex = lerp(ex, px, .4); ey = lerp(ey, py, .4); }
        if (api.blocked(ex, ey, z.r || 24)) { ex = z.x; ey = z.y; }
        Object.assign(ds, { moving: true, t: 0, sx: z.x, sy: z.y, ex, ey, hit: false });
        if (f && f.paths.length < 6) f.paths.push({ sx: z.x, sy: z.y, ex, ey, t: f.age });
      }
      return;
    }
    const u = clamp01(ds.t / PHASE_DASH), e = easeInOut(u);
    z.x = lerp(ds.sx, ds.ex, e); z.y = lerp(ds.sy, ds.ey, e);
    if (f && (!f.ghosts.length || f.age - f.ghosts[f.ghosts.length - 1].t > .035)) {
      f.ghosts.push({ x: z.x, y: z.y, t: f.age, fc: ds.ex >= ds.sx ? 1 : -1 });
      if (f.ghosts.length > 10) f.ghosts.shift();
    }
    if (!ds.hit && u >= .5) {
      ds.hit = true;
      api.line(ds.sx, ds.sy, ds.ex, ds.ey, 46, D * 1.45, null);
      api.shake(7);
    }
    if (u >= 1) { ds.moving = false; ds.t = 0; ds.n++; }
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
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.guard = 0; st.hold = 0; st.phase = 0; st.warp = null; st.dash = null; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.ripple = Math.max(0, st.ripple - dt);
    st.swing = Math.max(0, st.swing - dt);
    st.reactCd -= dt;

    // Kamui: the body slips into the other dimension, so blows pass through it.
    if (st.phase > 0) {
      if (z.health < st.phaseHp) { z.health = st.phaseHp; st.ripple = .3; }
      st.phaseHp = z.health;
      st.phase = Math.max(0, st.phase - dt);
    }
    // Uchiha Gaeshi: the fan drinks the blows, to throw them back.
    if (st.guard > 0) {
      if (z.health < st.guardHp) { const lost = st.guardHp - z.health; st.absorbed += lost; z.health = Math.min(z.maxHealth, z.health + lost * .85); st.ripple = .25; }
      st.guardHp = z.health;
      st.guard -= dt;
      if (st.guard <= 0) { st.guard = 0; release(z, st, api); }
    }
    if (st.warp) {
      const w = st.warp;
      w.t += dt;
      if (!w.moved && w.t >= .5) { w.moved = true; z.x = w.x1; z.y = w.y1; }
      if (w.t > 1.3) st.warp = null;
    }
    updateDash(z, st, dt, api);
    z.armorScale = (m.armor || 1) * (st.phase > 0 ? .05 : st.guard > 0 ? .2 : 1);

    st.hpClock += dt;
    if (st.hpClock > 1.5) { st.hpClock = 0; st.hpMark = z.health; }

    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && !st.warp && !st.dash) {
      st.holdMove = '';
      st.timer -= dt;
      const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      const hurt = st.hpMark - z.health > z.maxHealth * .045;
      // Hurt: he warps out of reach and strikes from behind.
      if (hurt && st.reactCd <= 0 && st.timer > .2 && d < 900) { st.reactCd = 10; st.hpMark = z.health; st.force = 'warp'; announce(z, st, m, api); }
      else if (st.timer <= 0 && p && (st.force || d < 900)) announce(z, st, m, api);
    }
    const dashing = st.dash && st.dash.moving;
    z.kageDash = dashing ? .05 : st.swing > 0 ? st.swing : 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.warp || (st.dash && !dashing) ? .1 : st.hold;
    z.speedScale = st.warp || st.dash ? 0 : .95;
  }

  // The game skips the body while he is folded into Kamui; drawOverlay paints him itself.
  function hidden(z) {
    const st = z.tb;
    if (!st || z.health <= 0) return false;
    return !!((st.warp && st.warp.t < .66) || (st.dash || st.phase > 0 && st.holdMove === 'phase'));
  }

  // ------------------------------------------------------------------ cached art
  function rockSpr(i) {
    return Kit().sprite('tb:rock' + (i % 3), 64, 64, g => {
      const c = 32, R = 27, path = () => {
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = k / 8 * TAU, r = R * (.72 + hash(k % 8 + i * 9) * .28);
          if (k) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = ['#6e5c4c', '#7c6a58', '#5e4e42'][i % 3]; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = 'rgba(210,190,160,.45)'; g.beginPath(); g.arc(c - 9, c - 11, R * .55, 0, TAU); g.fill();
      g.fillStyle = 'rgba(30,20,16,.5)'; g.beginPath(); g.arc(c + 12, c + 14, R * .7, 0, TAU); g.fill();
      g.restore();
      path(); g.strokeStyle = '#1e1612'; g.lineWidth = 3; g.stroke();
    });
  }
  function drawRock(ctx, i, x, y, s, rot, alpha = 1) {
    if (s < 1 || alpha <= .01) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(rockSpr(i), -s, -s, s * 2, s * 2);
    ctx.restore();
  }
  // Kamui swirl textures: dark space-time arms and pale chakra streaks.
  // Smooth tapered spiral arms (thick at the rim, needle-thin at the core) with a lit leading edge.
  function spiralSpr(key, n, turns, fill, edge, W, ew) {
    return Kit().sprite('tb:sp' + key, 256, 256, g => {
      const c = 128, R = 124, N = 72, L = new Float32Array((N + 1) * 2), Q = new Float32Array((N + 1) * 2);
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (let s = 0; s < n; s++) {
        const a0 = s * TAU / n + hash(s * 3.3 + n) * .4;
        for (let i = 0; i <= N; i++) {
          const t = i / N, r = R * (1 - t * .95), an = a0 + t * turns * TAU;
          const hw = W * Math.pow(1 - t, .75) * Math.min(1, .3 + t * 5), da = hw / Math.max(5, r);
          L[i * 2] = c + Math.cos(an + da) * r; L[i * 2 + 1] = c + Math.sin(an + da) * r;
          Q[i * 2] = c + Math.cos(an - da) * r; Q[i * 2 + 1] = c + Math.sin(an - da) * r;
        }
        g.beginPath(); g.moveTo(L[0], L[1]);
        for (let i = 1; i <= N; i++) g.lineTo(L[i * 2], L[i * 2 + 1]);
        for (let i = N; i >= 0; i--) g.lineTo(Q[i * 2], Q[i * 2 + 1]);
        g.closePath(); g.fillStyle = fill; g.fill();
        if (edge) {
          g.beginPath(); g.moveTo(L[0], L[1]);
          for (let i = 1; i <= N; i++) g.lineTo(L[i * 2], L[i * 2 + 1]);
          g.strokeStyle = edge; g.lineWidth = ew || 2; g.stroke();
        }
      }
    });
  }
  const darkSwirl = () => spiralSpr('dark', 6, 1.05, 'rgba(32,12,54,.72)', 'rgba(225,210,255,.8)', 20, 2.2);
  const lightSwirl = () => spiralSpr('light', 5, 1.3, 'rgba(120,80,210,.3)', 'rgba(255,255,255,.85)', 8, 1.4);

  // Mokuton stake: a sharp wooden spike with bark grain and a side thorn. Base at (32, 164).
  function spikeSpr(v) {
    return Kit().sprite('tb:spike' + v, 64, 170, g => {
      const lean = (hash(v * 3.1 + 1) - .5) * 16, top = 8 + hash(v * 5.7) * 22, w = 11 + hash(v * 2.3) * 4;
      const path = () => {
        g.beginPath(); g.moveTo(32 - w, 166);
        g.quadraticCurveTo(32 - w * .7 + lean * .3, 96, 32 + lean - 2.5, top + 14); g.lineTo(32 + lean, top); g.lineTo(32 + lean + 3, top + 16);
        g.quadraticCurveTo(32 + w * .75 + lean * .3, 96, 32 + w, 166); g.closePath();
      };
      // side thorn
      const side = hash(v * 7.7) > .5 ? 1 : -1, ty = 70 + hash(v * 4.4) * 40;
      g.lineJoin = 'round';
      g.beginPath(); g.moveTo(32 + side * 4, ty + 14); g.lineTo(32 + side * 24, ty - 18); g.lineTo(32 + side * 6, ty); g.closePath();
      g.fillStyle = '#6a4628'; g.fill(); g.strokeStyle = '#22140a'; g.lineWidth = 2.4; g.stroke();
      path(); g.fillStyle = '#7e5634'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#4e321c'; g.beginPath(); g.moveTo(32 + 3 + lean, 0); g.lineTo(64, 0); g.lineTo(64, 170); g.lineTo(32 + 4, 170); g.fill();
      g.fillStyle = '#b08250'; g.fillRect(32 - w + 1, 0, 4, 170);
      g.strokeStyle = 'rgba(40,24,10,.7)'; g.lineWidth = 1.3;
      for (let i = 0; i < 4; i++) {
        const x = 32 - w * .6 + i * w * .4;
        g.beginPath(); g.moveTo(x, 166); g.bezierCurveTo(x + 3, 130, x - 3, 90, x + lean * .6, 40 + i * 6); g.stroke();
      }
      g.fillStyle = 'rgba(30,16,6,.6)'; g.beginPath(); g.ellipse(32 - 2, 120 - hash(v) * 30, 2.6, 4, 0, 0, TAU); g.fill();
      g.restore();
      path(); g.strokeStyle = '#22140a'; g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(255,230,190,.55)'; g.beginPath(); g.moveTo(32 + lean - 1, top + 6); g.lineTo(32 + lean, top + 2); g.lineTo(32 + lean + .5, top + 18); g.fill();
    });
  }
  // Jukai Kōtan trees: baked trunks (ground pass) and canopies (overlay), stretched up as they burst out.
  const TREE_W = 200, TREE_H = 190, TREE_BX = 100, TREE_BY = 175;
  function treeSprite(v, canopy) {
    return Kit().sprite('tb:tree' + (canopy ? 'c' : 't') + v, TREE_W, TREE_H, g => {
      const seed = v * 11.3 + 7;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const trunks = [];
      for (let j = 0; j < 4; j++) {
        trunks.push({ bx: (hash(seed + j) - .5) * 34, by: (hash(seed + j * 3) - .5) * 14, lean: (hash(seed + j * 5) - .5) * 70,
          H: 100 * (.6 + .4 * hash(seed + j * 7)), rr: 13 + hash(seed + j * 11) * 8 });
      }
      trunks.sort((a, b) => a.by - b.by);
      for (const s of trunks) {
        const x0 = TREE_BX + s.bx, y0 = TREE_BY + s.by, tx = x0 + s.lean, ty = y0 - s.H;
        if (!canopy) {
          g.strokeStyle = '#4a321c'; g.lineWidth = 6;
          g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + s.lean * .4, y0 + 8, x0 + s.lean * .7 + s.bx, y0 + 4 + s.by * .5); g.stroke();
          const path = dx => { g.beginPath(); g.moveTo(x0 + dx, y0); g.bezierCurveTo(x0 + s.lean * .1 + dx, y0 - s.H * .45, x0 + s.lean * 1.1 + dx, y0 - s.H * .6, tx + dx, ty); };
          path(0); g.strokeStyle = '#2e1c0e'; g.lineWidth = 15; g.stroke();
          g.strokeStyle = '#74502f'; g.lineWidth = 11; g.stroke();
          path(-3); g.strokeStyle = '#a77a4c'; g.lineWidth = 3; g.stroke();
          g.strokeStyle = 'rgba(46,28,14,.6)'; g.lineWidth = 1.2;
          for (let i = 1; i < 4; i++) { const t = i / 4, x = x0 + s.lean * t * t, y = y0 - s.H * t; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 3, y - 3); g.stroke(); }
        } else {
          const r = s.rr;
          g.fillStyle = '#1f4419';
          g.beginPath(); g.arc(tx, ty, r * 1.25, 0, TAU); g.arc(tx - r * .9, ty + r * .3, r * .85, 0, TAU); g.arc(tx + r * .95, ty + r * .25, r * .8, 0, TAU); g.fill();
          g.fillStyle = '#448232'; g.beginPath(); g.arc(tx - r * .15, ty - r * .2, r * .9, 0, TAU); g.arc(tx + r * .6, ty + r * .1, r * .5, 0, TAU); g.fill();
          g.fillStyle = '#7cbf55'; g.beginPath(); g.arc(tx - r * .35, ty - r * .5, r * .4, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(12,30,10,.8)'; g.lineWidth = 2;
          g.beginPath(); g.arc(tx, ty, r * 1.25, Math.PI * .1, Math.PI * .9); g.stroke();
        }
      }
    });
  }
  // Madara's gunbai, large: red-lacquered paddle with a tan rim and the mitsudomoe. Grip at (80, 236).
  function fanSpr() {
    return Kit().sprite('tb:fan', 160, 250, g => {
      const O = '#1a0c0e';
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = O; g.lineWidth = 14; g.beginPath(); g.moveTo(80, 244); g.lineTo(80, 150); g.stroke();
      g.strokeStyle = '#3a2418'; g.lineWidth = 8; g.stroke();
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 2;
      for (let y = 236; y > 160; y -= 8) { g.beginPath(); g.moveTo(75, y); g.lineTo(85, y - 4); g.stroke(); }
      const blade = k => {
        g.beginPath();
        g.moveTo(80 - 10 * k, 154 + (1 - k) * 8);
        g.bezierCurveTo(80 - 54 * k, 140, 80 - 64 * k, 84, 80 - 48 * k, 46 + (1 - k) * 12);
        g.bezierCurveTo(80 - 30 * k, 12 + (1 - k) * 18, 80 + 30 * k, 12 + (1 - k) * 18, 80 + 48 * k, 46 + (1 - k) * 12);
        g.bezierCurveTo(80 + 64 * k, 84, 80 + 54 * k, 140, 80 + 10 * k, 154 + (1 - k) * 8);
        g.closePath();
      };
      blade(1); g.fillStyle = '#d8b062'; g.fill();
      blade(.86); g.fillStyle = '#a82228'; g.fill();
      g.save(); blade(.86); g.clip();
      g.fillStyle = 'rgba(60,0,10,.35)'; g.fillRect(80, 0, 80, 250);
      g.fillStyle = 'rgba(255,190,170,.3)'; g.beginPath(); g.ellipse(60, 56, 16, 9, -.5, 0, TAU); g.fill();
      g.restore();
      blade(1); g.strokeStyle = O; g.lineWidth = 5; g.stroke();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * TAU / 3, x = 80 + Math.cos(a) * 15, y = 90 + Math.sin(a) * 15;
        g.fillStyle = '#16080a'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill();
        g.strokeStyle = '#16080a'; g.lineWidth = 6; g.beginPath(); g.arc(x - Math.cos(a + Math.PI / 2) * 11, y - Math.sin(a + Math.PI / 2) * 11, 13, a + Math.PI / 2 - .2, a + Math.PI / 2 + 1.3); g.stroke();
      }
      g.fillStyle = '#16080a'; g.beginPath(); g.arc(80, 90, 4.5, 0, TAU); g.fill();
      g.fillStyle = '#9aa0aa'; g.fillRect(70, 148, 20, 10); g.strokeStyle = O; g.lineWidth = 3; g.strokeRect(70, 148, 20, 10);
    });
  }

  // Gedō Mazō, chest-up, emerging from the ground: grey-violet husk, ringed eyes, gagged maw, black
  // receiver rods driven into its back, chains across the chest. Ground (waist) at the bottom edge.
  const GW = 520, GH = 470, G_SHL = [72, 292], G_SHR = [448, 292], G_MOUTH = [260, 196];
  function gedoSpr() {
    return Kit().sprite('tb:gedo', GW, GH, g => {
      const O = '#17111c', SK = '#887d95', SH = '#5d5272', DP = '#3a3148', HL = '#b9aec6';
      g.lineJoin = 'round'; g.lineCap = 'round';
      // receiver rods behind the shoulders
      for (const [x, y, a, l] of [[150, 262, -2.35, 120], [205, 228, -1.95, 135], [318, 228, -1.18, 135], [372, 262, -.8, 120], [262, 214, -1.57, 100]]) {
        const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
        g.strokeStyle = 'rgba(190,170,240,.5)'; g.lineWidth = 15; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
        g.strokeStyle = '#0c0a12'; g.lineWidth = 11; g.stroke();
        g.strokeStyle = 'rgba(160,150,200,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(ex - 2, ey - 2); g.stroke();
        g.fillStyle = '#0c0a12'; g.beginPath(); g.ellipse(ex, ey, 14, 7, a + Math.PI / 2, 0, TAU); g.fill();
      }
      // torso
      const torso = () => {
        g.beginPath(); g.moveTo(36, 320);
        g.bezierCurveTo(46, 250, 150, 222, 210, 220); g.lineTo(310, 220); g.bezierCurveTo(370, 222, 474, 250, 484, 320);
        g.bezierCurveTo(476, 380, 420, 410, 402, 470); g.lineTo(118, 470); g.bezierCurveTo(100, 410, 44, 380, 36, 320); g.closePath();
      };
      torso(); g.fillStyle = SK; g.fill();
      g.save(); torso(); g.clip();
      g.fillStyle = SH; g.beginPath(); g.moveTo(330, 210); g.bezierCurveTo(360, 300, 330, 400, 300, 480); g.lineTo(520, 480); g.lineTo(520, 210); g.fill();
      g.fillStyle = DP; g.beginPath(); g.moveTo(420, 260); g.bezierCurveTo(450, 330, 420, 420, 400, 480); g.lineTo(520, 480); g.lineTo(520, 240); g.fill();
      g.fillStyle = 'rgba(30,20,40,.5)'; g.fillRect(0, 430, 520, 40);
      g.fillStyle = HL; g.beginPath(); g.ellipse(160, 270, 80, 26, -.2, 0, TAU); g.fill();
      // pectorals, sternum and ribs
      g.strokeStyle = DP; g.lineWidth = 4;
      g.beginPath(); g.moveTo(120, 300); g.quadraticCurveTo(190, 340, 255, 300); g.moveTo(265, 300); g.quadraticCurveTo(330, 340, 400, 300); g.stroke();
      g.beginPath(); g.moveTo(260, 236); g.lineTo(260, 440); g.stroke();
      g.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const y = 350 + i * 24;
        g.beginPath(); g.moveTo(244, y); g.quadraticCurveTo(190, y + 6, 140 + i * 6, y + 22); g.moveTo(276, y); g.quadraticCurveTo(330, y + 6, 380 - i * 6, y + 22); g.stroke();
      }
      g.strokeStyle = 'rgba(220,210,235,.45)'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const y = 346 + i * 24; g.beginPath(); g.moveTo(244, y); g.quadraticCurveTo(190, y + 6, 140 + i * 6, y + 22); g.stroke(); }
      // cracks in the husk
      g.strokeStyle = 'rgba(30,20,40,.6)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        let x = 90 + hash(i * 3.3) * 340, y = 250 + hash(i * 1.7) * 180;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (hash(i * 7 + k) - .5) * 40; y += hash(i * 5 + k) * 22; g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      torso(); g.strokeStyle = O; g.lineWidth = 6; g.stroke();
      // chains across the chest
      const chain = (x0, y0, x1, y1, sag) => {
        for (let i = 0; i <= 18; i++) {
          const t = i / 18, x = lerp(x0, x1, t), y = lerp(y0, y1, t) + Math.sin(Math.PI * t) * sag;
          g.save(); g.translate(x, y); g.rotate(Math.atan2(y1 - y0, x1 - x0) + (i % 2 ? Math.PI / 2 : 0));
          g.strokeStyle = '#1a1820'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 11, 6, 0, 0, TAU); g.stroke();
          g.strokeStyle = '#a8acb8'; g.lineWidth = 3; g.stroke();
          g.restore();
        }
      };
      chain(70, 300, 430, 420, 30);
      chain(450, 300, 110, 440, 24);
      // neck
      g.fillStyle = SH; g.strokeStyle = O; g.lineWidth = 5;
      g.beginPath(); g.moveTo(214, 236); g.lineTo(220, 196); g.lineTo(300, 196); g.lineTo(306, 236); g.closePath(); g.fill(); g.stroke();
      // head
      const head = () => {
        g.beginPath(); g.moveTo(186, 196);
        g.bezierCurveTo(160, 150, 168, 58, 260, 44); g.bezierCurveTo(352, 58, 360, 150, 334, 196);
        g.bezierCurveTo(310, 232, 210, 232, 186, 196); g.closePath();
      };
      head(); g.fillStyle = SK; g.fill();
      g.save(); head(); g.clip();
      g.fillStyle = SH; g.beginPath(); g.moveTo(300, 40); g.bezierCurveTo(330, 120, 320, 190, 290, 240); g.lineTo(380, 240); g.lineTo(380, 40); g.fill();
      g.fillStyle = HL; g.beginPath(); g.ellipse(230, 78, 40, 18, -.3, 0, TAU); g.fill();
      // skull ridges
      g.strokeStyle = DP; g.lineWidth = 3;
      for (const x of [228, 260, 292]) { g.beginPath(); g.moveTo(x, 50); g.quadraticCurveTo(x + (x - 260) * .2, 80, x + (x - 260) * .3, 104); g.stroke(); }
      // brow ridge and sunken sockets
      g.fillStyle = DP; g.beginPath(); g.moveTo(176, 124); g.quadraticCurveTo(260, 104, 344, 124); g.lineTo(344, 136); g.quadraticCurveTo(260, 120, 176, 136); g.fill();
      g.restore();
      head(); g.strokeStyle = O; g.lineWidth = 6; g.stroke();
      for (const s of [-1, 1]) {
        const ex = 260 + s * 38, ey = 148;
        g.fillStyle = '#231b2e'; g.beginPath(); g.ellipse(ex, ey, 30, 20, s * .12, 0, TAU); g.fill();
        g.fillStyle = '#ddd2f2'; g.beginPath(); g.ellipse(ex, ey + 2, 22, 14, s * .12, 0, TAU); g.fill();
        g.strokeStyle = '#5a4690'; g.lineWidth = 1.6;
        for (const r of [4.5, 9, 13.5]) { g.beginPath(); g.ellipse(ex, ey + 2, r * 1.5, r, s * .12, 0, TAU); g.stroke(); }
        g.fillStyle = '#2a1a50'; g.beginPath(); g.arc(ex, ey + 2, 3, 0, TAU); g.fill();
        g.strokeStyle = O; g.lineWidth = 4; g.beginPath(); g.ellipse(ex, ey + 2, 22, 14, s * .12, 0, TAU); g.stroke();
      }
      // gagged maw: clenched teeth behind a binding strap with a seal tag
      g.fillStyle = '#1c1220'; g.beginPath(); g.ellipse(260, 196, 52, 16, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8e0d0';
      for (let i = 0; i < 9; i++) { const x = 216 + i * 11; g.beginPath(); g.moveTo(x, 186); g.lineTo(x + 10, 186); g.lineTo(x + 5, 199); g.closePath(); g.fill(); }
      for (let i = 0; i < 8; i++) { const x = 222 + i * 11; g.beginPath(); g.moveTo(x, 208); g.lineTo(x + 10, 208); g.lineTo(x + 5, 196); g.closePath(); g.fill(); }
      g.fillStyle = '#cfc6b4'; g.strokeStyle = O; g.lineWidth = 3;
      g.beginPath(); g.moveTo(180, 186); g.quadraticCurveTo(260, 202, 340, 186); g.lineTo(338, 200); g.quadraticCurveTo(260, 216, 182, 200); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#efe6cc'; g.fillRect(250, 190, 20, 44); g.strokeRect(250, 190, 20, 44);
      g.strokeStyle = '#b02020'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(256, 198); g.lineTo(264, 198); g.moveTo(260, 196); g.lineTo(260, 226); g.moveTo(255, 210); g.lineTo(265, 214); g.moveTo(255, 220); g.lineTo(265, 220); g.stroke();
      // shoulder caps
      for (const [x, y] of [G_SHL, G_SHR]) {
        g.fillStyle = SK; g.strokeStyle = O; g.lineWidth = 5;
        g.beginPath(); g.ellipse(x, y, 44, 36, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = 'rgba(220,210,235,.35)'; g.beginPath(); g.ellipse(x - 8, y - 14, 22, 10, -.2, 0, TAU); g.fill();
      }
    });
  }
  // The statue's fist, palm down, seen from above-front: clawed fingers curled under, wrist shackle.
  function fistSpr() {
    return Kit().sprite('tb:fist', 240, 230, g => {
      const O = '#17111c', SK = '#887d95', SH = '#5d5272', DP = '#3a3148';
      g.lineJoin = 'round'; g.lineCap = 'round';
      // wrist
      g.fillStyle = SK; g.strokeStyle = O; g.lineWidth = 6;
      g.beginPath(); g.moveTo(80, 0); g.lineTo(160, 0); g.lineTo(170, 70); g.lineTo(70, 70); g.closePath(); g.fill(); g.stroke();
      // back of the hand
      const hand = () => { g.beginPath(); g.moveTo(44, 74); g.bezierCurveTo(60, 50, 180, 50, 196, 74); g.bezierCurveTo(214, 120, 210, 160, 196, 176); g.lineTo(44, 176); g.bezierCurveTo(30, 160, 26, 120, 44, 74); g.closePath(); };
      hand(); g.fillStyle = SK; g.fill();
      g.save(); hand(); g.clip();
      g.fillStyle = SH; g.fillRect(150, 40, 80, 160); g.fillStyle = 'rgba(220,210,235,.4)'; g.beginPath(); g.ellipse(90, 92, 34, 12, -.2, 0, TAU); g.fill();
      g.strokeStyle = DP; g.lineWidth = 3;
      for (const x of [76, 108, 140, 170]) { g.beginPath(); g.moveTo(x - 4, 84); g.lineTo(x, 170); g.stroke(); }
      g.restore();
      hand(); g.strokeStyle = O; g.lineWidth = 6; g.stroke();
      // knuckles and curled fingers with dark claws
      for (let i = 0; i < 4; i++) {
        const x = 62 + i * 38;
        g.fillStyle = i === 3 ? SH : SK; g.strokeStyle = O; g.lineWidth = 5;
        g.beginPath(); g.ellipse(x, 182, 19, 26, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = 'rgba(220,210,235,.45)'; g.beginPath(); g.ellipse(x - 5, 172, 8, 6, 0, 0, TAU); g.fill();
        g.fillStyle = '#211826'; g.beginPath(); g.moveTo(x - 9, 200); g.lineTo(x + 9, 200); g.lineTo(x, 226); g.closePath(); g.fill();
      }
      // thumb
      g.fillStyle = SK; g.strokeStyle = O; g.lineWidth = 5;
      g.beginPath(); g.ellipse(26, 132, 18, 34, .4, 0, TAU); g.fill(); g.stroke();
      // iron shackle round the wrist
      g.fillStyle = '#6e727e'; g.strokeStyle = O; g.lineWidth = 5;
      g.beginPath(); g.rect(64, 22, 112, 30); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(68, 26, 104, 6);
      g.fillStyle = '#3a3c46'; for (const x of [80, 120, 160]) { g.beginPath(); g.arc(x, 37, 4, 0, TAU); g.fill(); }
    });
  }

  // ------------------------------------------------------------------ shared draw helpers
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(30,12,20,${faint ? .08 : .16})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.ellipse(x, y, r * clamp01(k), r * .5 * clamp01(k), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,14,24,.45)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 1.8 : faint ? 2 : 3;
    ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14) * .5); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12) * .5);
      }
      ctx.stroke();
    }
  }
  function markLine(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.fillStyle = 'rgba(30,12,20,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
    ctx.strokeStyle = 'rgba(40,14,24,.45)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath();
    ctx.arc(x, y, r1, a0, a1);
    if (r0 > 0) ctx.arc(x, y, r0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  function markCone(ctx, x, y, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = 'rgba(30,12,20,.16)'; sector(ctx, x, y, 0, s.len, s.a - s.half, s.a + s.half); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${.14 + .18 * k})`; sector(ctx, x, y, 0, s.len * clamp01(k), s.a - s.half, s.a + s.half); ctx.fill();
    sector(ctx, x, y, 0, s.len, s.a - s.half, s.a + s.half);
    ctx.strokeStyle = 'rgba(40,14,24,.45)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath();
    for (let d = 80 + (time * 300) % 140; d < s.len - 20; d += 140) ctx.arc(x, y, d, s.a - s.half * .9, s.a + s.half * .9);
    ctx.stroke();
  }
  // Radial ground cracks (ground perspective).
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
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10) {
    if (alpha <= .01) return;
    const K = Kit(), dust = K.puff('dust');
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  // Black summoning formula spreading over the ground.
  function seal(ctx, x, y, r, a, seed) {
    if (a <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#120c14'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const an = i * TAU / 16 + hash(i + seed) * .2, l = r * (.8 + hash(i * 3 + seed) * .7);
      ctx.moveTo(Math.cos(an) * r * .3, Math.sin(an) * r * .3); ctx.lineTo(Math.cos(an) * l, Math.sin(an) * l);
      for (let k = .5; k < 1; k += .2) {
        const px = Math.cos(an) * l * k, py = Math.sin(an) * l * k, pa = an + Math.PI / 2;
        ctx.moveTo(px - Math.cos(pa) * 6, py - Math.sin(pa) * 6); ctx.lineTo(px + Math.cos(pa) * 6, py + Math.sin(pa) * 6);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // A Kamui vortex: dark space-time arms, pale chakra streaks, warped rings closing to a black core.
  function vortex(ctx, x, y, r, rot, a, squash) {
    if (r < 2 || a <= .01) return;
    const K = Kit();
    K.spin(ctx, darkSwirl(), x, y, r * 1.1, rot, a * .9, squash);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 1.35, '140,90,255', .32 * a, false, squash);
    K.spin(ctx, lightSwirl(), x, y, r, rot * 1.3 + 1, .85 * a, squash);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(x, y); ctx.scale(1, squash); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = frac(-rot * .2 + i / 4), rr = r * (1.15 - ph * .95), a0 = rot * 1.6 + i * 1.7;
      ctx.strokeStyle = `rgba(26,8,44,${.55 * a * ph})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 3.6); ctx.stroke();
      ctx.strokeStyle = `rgba(240,230,255,${.75 * a * ph})`; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.fillStyle = `rgba(6,2,12,${a})`; ctx.beginPath(); ctx.arc(0, 0, r * .15, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(220,200,255,${.7 * a})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * .17, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // Tobi drawn by hand (while the game hides him): twisted round the eye hole, scaled, faded.
  function drawTobi(ctx, x, y, f, frame, alpha, spin, scale) {
    const S = Spr();
    if (!S || alpha <= .01 || scale <= .02) return;
    const ex = x + f * 6, ey = y + 3 - H() * .7;
    ctx.save();
    ctx.translate(ex, ey); ctx.rotate(spin); ctx.scale(scale, scale); ctx.translate(-ex, -ey);
    S.draw(ctx, 'tobi', x, y + 3, { facing: f, frame, alpha });
    ctx.restore();
  }

  // ------------------------------------------------------------------ Kamui suction vortex
  function kamuiG(ctx, fx, time) {
    const K = Kit(), t = fx.age, T = fx.T, R = fx.R, x = fx.x, y = fx.y;
    if (t < T + .1) {
      const e = easeOut(t / .5), a = Math.min(1, t * 3);
      ctx.fillStyle = `rgba(30,12,46,${.28 * a})`; ctx.beginPath(); ctx.ellipse(x, y, R * e, R * .5 * e, 0, 0, TAU); ctx.fill();
      vortex(ctx, x, y, R * .95 * e, -time * 2.6 - t * t * 1.4, a, .5);
      cracks(ctx, x, y, R * .9 * e, 12, fx.seed, a * .8, 2.2);
      // dust dragged in round the spiral
      const dust = K.puff('dust');
      for (let i = 0; i < 16; i++) {
        const ph = frac(t * .9 + hash(i * 2.1 + fx.seed)), d = R * (1.05 - ph * .9), an = hash(i * 5.3) * TAU - ph * 3.2;
        K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8, 14 + 12 * (1 - ph), bell(ph) * .7 * a, .7);
      }
    } else {
      const u = t - T, fade = 1 - win(u, .6, 1.4);
      crater(ctx, x, y, 150, fade, fx.seed);
      if (u < .7) K.fx.shockRing(ctx, x, y, 360, u / .7, 1 - u / .7, '200,160,255');
      if (u > .08 && u < .8) K.fx.shockRing(ctx, x, y, 260, (u - .08) / .72, .8 - u, '255,255,255');
      dustRing(ctx, x, y, 120 + easeOut(u / .8) * 200, 18, 22 + u * 30, .8 * (1 - win(u, .2, 1.2)), fx.seed, 8 + u * 20);
    }
  }
  function kamuiO(ctx, fx, time) {
    const K = Kit(), t = fx.age, T = fx.T, R = fx.R, x = fx.x, y = fx.y;
    if (t < T) {
      const a = Math.min(1, t * 2.5), k = t / T;
      // the air itself twisting round a point at chest height
      vortex(ctx, x, y - 46, 60 + 70 * k, -time * 4 - k * 6, .55 * a, .82);
      // rocks and debris spiralling inward and up
      for (let i = 0; i < fx.rocks.length; i++) {
        const r = fx.rocks[i], ph = frac(t * .55 * r.sp + i / fx.rocks.length);
        const d = R * r.d * (1 - easeIn(ph)), an = r.a - ph * 4.5, h = 10 + ph * 70;
        drawRock(ctx, r.v, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - h, r.s * (1 - ph * .6), time * 6 + i, bell(ph) * a);
      }
      // converging wind streaks
      ctx.lineCap = 'round';
      for (const [style, w] of [['rgba(40,16,70,.4)', 4], ['rgba(235,225,255,.8)', 1.6]]) {
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const an = hash(i * 3.1 + fx.seed) * TAU - t * 2, q = frac(t * 1.6 + hash(i * 1.7)), d0 = (R + 60) * (1 - q) + 40;
          ctx.moveTo(x + Math.cos(an) * d0, y + Math.sin(an) * d0 * .5 - 20); ctx.lineTo(x + Math.cos(an + .35) * (d0 - 70), y + Math.sin(an + .35) * (d0 - 70) * .5 - 26);
        }
        ctx.stroke();
      }
    } else {
      const u = t - T;
      // implosion: the warp collapses in a flash, then everything is flung back out
      ctx.globalCompositeOperation = 'lighter';
      if (u < .3) K.glow(ctx, x, y - 40, 120 + 380 * u, '230,215,255', 1 - u / .3, true);
      if (u < .6) K.glow(ctx, x, y - 30, 260, '150,100,255', .6 * (1 - u / .6), false, .6);
      ctx.globalCompositeOperation = 'source-over';
      if (u < .22) vortex(ctx, x, y - 46, 130 * (1 - u / .22), -time * 9, 1, .82);
      if (u < 1.3) {
        K.fx.debris(ctx, x, y, 260, u / 1.2, fx.seed, '#3b3040', 18);
        for (let i = 0; i < 12; i++) {
          const an = i * TAU / 12 + hash(fx.seed + i), d = 40 + easeOut(u * 1.4) * (180 + hash(i * 2.2) * 120), h = bell(u * .9) * (40 + hash(i * 5) * 120);
          drawRock(ctx, i, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - h, 8 + hash(i * 7.7) * 10, u * 8 + i, 1 - win(u, .8, 1.3));
        }
      }
    }
  }

  // ------------------------------------------------------------------ Kamui warp ambush
  function warpG(ctx, fx, time) {
    const K = Kit(), t = fx.age;
    if (t < .7) { const a = bell(t / .7); ctx.fillStyle = `rgba(30,10,44,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x0, fx.y0, 70, 30, 0, 0, TAU); ctx.fill(); }
    if (t > .35 && t < 1.0) { const a = bell((t - .35) / .65); ctx.fillStyle = `rgba(30,10,44,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x1, fx.y1, 70, 30, 0, 0, TAU); ctx.fill(); }
    if (fx.sx || fx.sy) {
      if (fx.slam < 0) markCircle(ctx, fx.sx, fx.sy, 180, '255,150,70', clamp01((t - .55) / .57), time, false);
      else {
        const u = t - fx.slam, fade = 1 - win(u, .5, fx.dur - fx.slam);
        crater(ctx, fx.sx, fx.sy, 120, fade, fx.seed);
        if (u < .6) K.fx.shockRing(ctx, fx.sx, fx.sy, 280, u / .6, 1 - u / .6, '255,150,80');
        if (u > .05 && u < .7) K.fx.shockRing(ctx, fx.sx, fx.sy, 200, (u - .05) / .65, .7 - u, '255,255,255');
        dustRing(ctx, fx.sx, fx.sy, 90 + easeOut(u / .7) * 130, 14, 18 + u * 26, .8 * (1 - win(u, .2, 1)), fx.seed, 6 + u * 16);
      }
    }
  }
  function warpO(ctx, fx, time) {
    const K = Kit(), t = fx.age, h = H() * .7;
    // origin: the body twists into the eye hole and is gone
    if (t < .75) {
      const k = clamp01(t / .5), r = 26 + 58 * bell(t / .75);
      vortex(ctx, fx.x0 + fx.f0 * 6, fx.y0 + 3 - h, r, -time * 7 - t * 8, Math.min(1, t * 6) * (1 - win(t, .55, .75)), .92);
      if (t < .5) drawTobi(ctx, fx.x0, fx.y0, fx.f0, 'seal', 1 - k * .4, -easeIn(k) * 7, 1 - easeIn(k));
    }
    // destination: he spins back out of the swirl
    if (t > .32 && t < 1.05) {
      const u = (t - .32) / .73, r = 26 + 64 * bell(u);
      vortex(ctx, fx.x1 + fx.f1 * 6, fx.y1 + 3 - h, r, time * 7 + t * 8, bell(u) * 1.1, .92);
      const k = clamp01((t - .42) / .24);
      if (t < .66 && k > 0) drawTobi(ctx, fx.x1, fx.y1, fx.f1, 'seal', .6 + k * .4, (1 - easeOut(k)) * 7, easeOut(k));
    }
    // the gunbai brought down: a red crescent sweep and the impact flash
    if (fx.slam >= 0) {
      const u = t - fx.slam;
      if (u < .3) {
        const a = 1 - u / .3, qa = fx.qa || 0, cx = lerp(fx.x1, fx.sx, .5), cy = lerp(fx.y1, fx.sy, .5) - 50;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.cos(qa) >= 0 ? 1 : -1, 1);
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(80,10,10,${.55 * a})`; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(0, 0, 80, -2.4, .7); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,120,80,${.85 * a})`; ctx.lineWidth = 10; ctx.stroke();
        ctx.strokeStyle = `rgba(255,240,220,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 84, -2.2, .6); ctx.stroke();
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.sx, fx.sy - 20, 130, '255,170,110', a, true, .7);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (u < 1) K.fx.debris(ctx, fx.sx, fx.sy, 170, u, fx.seed, '#3a2c22', 14);
    }
  }

  // ------------------------------------------------------------------ Mokuton: Sashiki wood spikes
  function sashikiG(ctx, fx, time) {
    const K = Kit(), t = fx.age, end = 1 - win(t, fx.dur - .7, fx.dur);
    for (const l of fx.lanes) {
      const c = Math.cos(l.a), s = Math.sin(l.a), u = t - l.t0 - .05;
      if (u <= 0) continue;
      const front = Math.min(SASH_LEN, u * SASH_SPEED);
      // the torn furrow the roots rip open
      ctx.save(); ctx.translate(l.x0, l.y0); ctx.rotate(l.a);
      ctx.fillStyle = `rgba(56,38,24,${.34 * end})`; ctx.fillRect(0, -26, front, 52);
      ctx.fillStyle = `rgba(34,22,14,${.35 * end})`; ctx.fillRect(0, -10, front, 20);
      ctx.restore();
      // stakes erupting one after another, leaning along the strike
      for (let d = 36, i = 0; d <= front; d += 34, i++) {
        const since = u - d / SASH_SPEED, g = easeOut(since / .14) * end;
        if (g < .02) continue;
        const sd = (hash(i * 3.7 + l.seed) - .5) * 64, x = l.x0 + c * d - s * sd, y = l.y0 + s * d + c * sd;
        const hh = (120 + hash(i * 5.1 + l.seed) * 75) * (1 - Math.abs(sd) / 90) * g, ww = 44 + hash(i * 2.2 + l.seed) * 16;
        ctx.fillStyle = `rgba(30,18,10,${.4 * end})`; ctx.beginPath(); ctx.ellipse(x, y + 2, ww * .55, ww * .22, 0, 0, TAU); ctx.fill();
        const v = (i + Math.floor(l.seed)) % 4;
        ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, c * .38, 1, 0, 0);
        ctx.drawImage(spikeSpr(v), -ww / 2, -hh * (164 / 170), ww, hh);
        ctx.restore();
        if (since < .35) K.fx.debris(ctx, x, y, 60, since / .35, i + l.seed, '#4a3320', 5);
      }
      // the thick branch growing out of Tobi's arm and diving into the ground
      if (u < fx.dur - 1) {
        const bx = fx.x + c * 14, by = fx.y - 40, gx = l.x0 + c * 40, gy = l.y0 + s * 40;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(34,20,10,${end})`; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(lerp(bx, gx, .5), by - 10, gx, gy); ctx.stroke();
        ctx.strokeStyle = `rgba(122,84,50,${end})`; ctx.lineWidth = 10; ctx.stroke();
        ctx.strokeStyle = `rgba(176,130,80,${end})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx, by - 3); ctx.quadraticCurveTo(lerp(bx, gx, .5), by - 13, gx, gy - 3); ctx.stroke();
      }
    }
  }
  function sashikiO(ctx, fx, time) {
    const K = Kit(), t = fx.age, dust = K.puff('dust');
    for (const l of fx.lanes) {
      const c = Math.cos(l.a), s = Math.sin(l.a), u = t - l.t0 - .05;
      if (u <= 0) continue;
      const front = Math.min(SASH_LEN, u * SASH_SPEED);
      // dust spraying off the leading edge and settling behind
      for (let i = 0; i < 8; i++) {
        const back = i * 60, d = front - back;
        if (d < 0) break;
        const age = back / SASH_SPEED + Math.max(0, u - SASH_LEN / SASH_SPEED);
        if (age > .9) continue;
        K.stamp(ctx, dust, l.x0 + c * d + (hash(i + l.seed) - .5) * 40, l.y0 + s * d - 20 - age * 50, 20 + age * 50, (1 - age / .9) * .7, .8);
      }
      if (front < SASH_LEN) {
        const x = l.x0 + c * front, y = l.y0 + s * front;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, y - 30, 50, '200,240,140', .35, false, .8);
        ctx.globalCompositeOperation = 'source-over';
        // splinters flung up at the leading edge
        ctx.strokeStyle = '#6a4628'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ph = frac(time * 3 + i / 6), an = hash(i * 9.1) * TAU, d = 20 + ph * 50, hh = bell(ph) * 60;
          const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5 - hh;
          ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(an + time * 9) * 7, py + Math.sin(an + time * 9) * 7);
        }
        ctx.stroke();
      }
    }
  }

  // ------------------------------------------------------------------ Gōka Mekkyaku fire sea
  function katonG(ctx, fx, time) {
    const K = Kit(), front = Math.min(fx.reach, fx.age * KATON.speed), rolling = front < fx.reach;
    const fade = 1 - win(fx.age, fx.dur - 1.1, fx.dur);
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade * 1.5);
    ctx.fillStyle = 'rgba(40,16,6,.45)';
    sector(ctx, fx.x, fx.y, 0, front, fx.a - fx.half, fx.a + fx.half); ctx.fill();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(214,62,16,.55)';
    sector(ctx, fx.x, fx.y, 20, front * .97, fx.a - fx.half * .95, fx.a + fx.half * .95); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,40,.4)';
    sector(ctx, fx.x, fx.y, 40, front * .9, fx.a - fx.half * .8, fx.a + fx.half * .8); ctx.fill();
    for (const p of fx.pts) {
      if (p.d > front || (rolling && p.d > front - 90)) continue;
      const since = fx.age - p.d / KATON.speed;
      const h = p.s * easeOut(since * 3) * fade * (.85 + .15 * Math.sin(time * 12 + p.d));
      if (h < 4) continue;
      ctx.drawImage(K.flame((p.i + Math.floor(time * 11)) % 6), p.x - h * .22, p.y - h * (114 / 128), h * .44, h);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const d = front * (i + .5) / 6;
      K.glow(ctx, fx.x + Math.cos(fx.a) * d, fx.y + Math.sin(fx.a) * d - 14, 40 + d * .35, '255,130,40', .28 * fade, false, .6);
    }
    ctx.restore();
  }
  function katonO(ctx, fx, time) {
    const K = Kit(), front = Math.min(fx.reach, fx.age * KATON.speed), rolling = front < fx.reach;
    const fade = 1 - win(fx.age, fx.dur - 1.1, fx.dur);
    ctx.save();
    if (rolling) {
      // the rolling wall of fire: dense rows of tall tongues along the leading edge
      const grow = .55 + .45 * Math.min(1, front / 260), n = 24;
      for (let row = 1; row >= 0; row--) {
        for (let i = 0; i < n; i++) {
          const u = (i + row * .5) / n, aa = fx.a + (u * 2 - 1) * fx.half * .95, d = front - row * 34 - hash(i * 3.3 + row) * 16;
          if (d < 30) continue;
          const h = (100 + hash(i * 7.1 + row) * 60) * grow * (1 - row * .2) * (.88 + .12 * Math.sin(time * 15 + i * 1.7));
          const px = fx.x + Math.cos(aa) * d, py = fx.y + Math.sin(aa) * d;
          ctx.drawImage(K.flame((i + row * 3 + Math.floor(time * 13)) % 6), px - h * .26, py - h * (114 / 128), h * .52, h);
        }
      }
      // the torrent pouring from behind the mask
      const mx = fx.x + Math.cos(fx.a) * 22, my = fx.y - H() * .62 + Math.sin(fx.a) * 10, m = ctx.getTransform();
      ctx.translate(mx, my); ctx.rotate(Math.atan2(Math.sin(fx.a) * .6 + .35, Math.cos(fx.a)) + Math.PI / 2);
      for (let i = 4; i >= 0; i--) {
        const h = (60 + i * 28) * Math.min(1, fx.age * 4), w = h * (.42 + i * .05);
        ctx.drawImage(K.flame((i + Math.floor(time * 14)) % 6), -w / 2 + Math.sin(time * 20 + i) * 3, -h * (114 / 128) + 6 - i * 32, w, h);
      }
      ctx.setTransform(m);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, mx, my, 46, '255,200,110', .85, true);
      for (let i = 0; i < 5; i++) {
        const aa = fx.a + (i / 4 - .5) * fx.half * 1.4;
        K.glow(ctx, fx.x + Math.cos(aa) * front * .92, fx.y + Math.sin(aa) * front * .92 - 40, 70, '255,140,40', .4, false, .7);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // embers drifting up off the sea, then smoke as it dies down
    if (!rolling && fade > .05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,190,90,${.8 * fade})`;
      for (let i = 0; i < 24; i++) {
        const p = fx.pts[(i * 7) % fx.pts.length], ph = frac(time * .8 + hash(i * 3.1));
        ctx.fillRect(p.x + Math.sin(time * 3 + i) * 10, p.y - 30 - ph * 120, 2.5, 2.5);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fx.age > fx.dur - 2.2) {
      const smoke = K.puff('smoke'), s = win(fx.age, fx.dur - 2.2, fx.dur);
      for (let i = 0; i < fx.pts.length; i += 7) {
        const p = fx.pts[i];
        K.stamp(ctx, smoke, p.x, p.y - 30 - s * 70, 22 + s * 22, bell(s) * .55);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Uchiha Gaeshi
  function gaeshiG(ctx, fx, time) {
    const K = Kit(), t = fx.age;
    if (t < fx.rel) {
      // the fan planted before him: a lens of compressed air on the ground
      const k = clamp01(t / .2);
      ctx.save(); ctx.translate(fx.x, fx.y);
      ctx.fillStyle = `rgba(120,20,20,${.16 * k})`; ctx.beginPath(); ctx.ellipse(0, 0, 150 * k, 70 * k, 0, 0, TAU); ctx.fill();
      ctx.restore();
      return;
    }
    const u = t - fx.rel, a = fx.ra == null ? fx.a : fx.ra, fade = 1 - win(u, .5, 1.3);
    // the gale: a wedge of flattened, scoured ground with streaks raking outward
    const e = easeOut(u / .35);
    ctx.fillStyle = `rgba(60,40,30,${.3 * fade})`; sector(ctx, fx.x, fx.y, 30, GAESHI_LEN * e, a - GAESHI_HALF, a + GAESHI_HALF); ctx.fill();
    ctx.strokeStyle = `rgba(40,24,20,${.5 * fade})`; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const an = a + (hash(i * 3.3 + fx.seed) * 2 - 1) * GAESHI_HALF, d0 = 60 + hash(i * 1.9) * 200, d1 = d0 + 120 + hash(i * 7) * 200;
      ctx.moveTo(fx.x + Math.cos(an) * d0, fx.y + Math.sin(an) * d0); ctx.lineTo(fx.x + Math.cos(an) * Math.min(d1, GAESHI_LEN * e), fx.y + Math.sin(an) * Math.min(d1, GAESHI_LEN * e));
    }
    ctx.stroke();
    if (u < .8) K.fx.shockRing(ctx, fx.x, fx.y, GAESHI_R * 1.2, u / .8, 1 - u / .8, '255,120,100');
    dustRing(ctx, fx.x + Math.cos(a) * GAESHI_LEN * e * .7, fx.y + Math.sin(a) * GAESHI_LEN * e * .7, 140, 12, 26 + u * 30, .75 * (1 - win(u, .3, 1.2)), fx.seed, 10 + u * 20);
  }
  function gaeshiO(ctx, fx, time) {
    const K = Kit(), t = fx.age, z = fx.z, x = z && z.health > 0 ? z.x : fx.x, y = z && z.health > 0 ? z.y : fx.y;
    if (t < fx.rel + .25) {
      // the giant spectral gunbai held up in front, rippling as blows sink into it
      const st = z && z.tb, a = fx.a, k = easeOut(t / .22) * (1 - win(t, fx.rel, fx.rel + .25));
      const fxp = x + Math.cos(a) * 58, fyp = y + Math.sin(a) * 22 + 6, rip = st ? st.ripple : 0;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fxp, fyp - 90, 120 * k, '255,90,70', .45 * k + rip, false, 1.1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha = .82 * k; ctx.translate(fxp, fyp);
      ctx.scale((Math.cos(a) >= 0 ? 1 : -1) * (.94 + .06 * Math.sin(time * 18)), 1);
      ctx.drawImage(fanSpr(), -80 * .78, -236 * .78, 160 * .78, 250 * .78);
      ctx.restore();
      // the barrier of air round the fan
      ctx.save(); ctx.translate(fxp, fyp - 90); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ph = frac(time * 2 + i / 3), r = 90 + ph * 50 + rip * 160;
        ctx.strokeStyle = `rgba(90,10,10,${.4 * (1 - ph) * k})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, r * .7, r, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,220,200,${.7 * (1 - ph) * k})`; ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.restore();
    }
    if (t >= fx.rel) {
      const u = t - fx.rel, a = fx.ra == null ? fx.a : fx.ra, al = 1 - win(u, .25, .9);
      if (al > 0) {
        // the returned gale: bright crescent fronts racing out through the cone
        ctx.save(); ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const d = (60 + easeOut((u - i * .07) / .45) * GAESHI_LEN) * (u > i * .07 ? 1 : 0);
          if (d <= 0) continue;
          ctx.strokeStyle = `rgba(110,20,20,${.45 * al})`; ctx.lineWidth = 16 - i * 4;
          ctx.beginPath(); ctx.ellipse(x, y - 30, d, d * .55, 0, a - GAESHI_HALF, a + GAESHI_HALF); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,${200 - i * 40},${180 - i * 50},${.85 * al})`; ctx.lineWidth = 6 - i * 1.5; ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = `rgba(255,240,230,${.8 * al})`; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 22; i++) {
          const an = a + (hash(i * 5.1 + fx.seed) * 2 - 1) * GAESHI_HALF, d0 = 40 + easeOut(u / .4) * (GAESHI_LEN * .9) * hash(i * 2.9 + 1), L = 60 + hash(i) * 70;
          ctx.moveTo(x + Math.cos(an) * d0, y + Math.sin(an) * d0 * .6 - 36); ctx.lineTo(x + Math.cos(an) * (d0 + L), y + Math.sin(an) * (d0 + L) * .6 - 36);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (u < 1.1) K.fx.debris(ctx, x + Math.cos(a) * 200, y + Math.sin(a) * 200, 260, u / 1.1, fx.seed, '#3a2c22', 14);
    }
  }

  // ------------------------------------------------------------------ Jukai Kōtan: the forest closing in
  function jukaiG(ctx, fx, time) {
    const K = Kit(), end = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.save(); ctx.lineCap = 'round';
    // the earth greening and splitting under the whole circle
    const ga = Math.min(1, fx.age * 2) * end;
    ctx.fillStyle = `rgba(52,70,30,${.2 * ga})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, JUKAI_R, JUKAI_R * .5, 0, 0, TAU); ctx.fill();
    for (const r of fx.trees) {
      const t = fx.age - r.t, rad = r.big ? 120 : 64;
      if (t < 0) continue;
      if (t < .45) {
        const k = t / .45, pulse = .6 + Math.sin(time * 30) * .2;
        ctx.fillStyle = `rgba(60,40,24,${.25 + .3 * k})`;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, rad * (.5 + .5 * k), rad * (.5 + .5 * k) * .5, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(143,208,98,${pulse})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * .5, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = hash(r.seed + i * 2) * TAU, d = 20 + rad * .6 * k;
          ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + Math.cos(a) * d * .6, r.y + Math.sin(a) * d * .3 + 3); ctx.lineTo(r.x + Math.cos(a + .3) * d, r.y + Math.sin(a + .3) * d * .5); ctx.stroke();
        }
        continue;
      }
      const g = easeOut((t - .45) / .22) * end;
      if (g <= .01) continue;
      ctx.fillStyle = `rgba(50,34,20,${.45 * end})`;
      ctx.beginPath(); ctx.ellipse(r.x, r.y + 2, rad * .75, rad * .3, 0, 0, TAU); ctx.fill();
      const s = r.h / 100;
      ctx.drawImage(treeSprite(r.v, false), r.x - TREE_BX * s, r.y - TREE_BY * s * g, TREE_W * s, TREE_H * s * g);
      if (t - .45 < .7) K.fx.debris(ctx, r.x, r.y, r.big ? 140 : 70, (t - .45) / .7, r.seed, '#4a3320', r.big ? 14 : 7);
      if (r.big && t - .45 < .8) K.fx.shockRing(ctx, r.x, r.y, 260, (t - .45) / .8, 1 - (t - .45) / .8, '150,220,100');
    }
    ctx.restore();
  }
  function jukaiO(ctx, fx, time) {
    const end = 1 - win(fx.age, fx.dur - .8, fx.dur), K = Kit();
    ctx.save();
    for (const r of fx.trees) {
      const t = fx.age - r.t - .45;
      if (t < .06) continue;
      const g = easeOut(t / .22) * end, leaf = easeOut((t - .06) / .25) * end;
      if (leaf <= .01) continue;
      const s = r.h / 100, sway = Math.sin(time * 2 + r.seed) * 2;
      ctx.globalAlpha = .92 * leaf;
      ctx.drawImage(treeSprite(r.v, true), r.x - TREE_BX * s + sway, r.y - TREE_BY * s * g, TREE_W * s, TREE_H * s * g);
    }
    ctx.globalAlpha = 1;
    // leaves whirling round the closing ring
    const la = Math.min(1, fx.age * 2) * end;
    if (la > .02) {
      ctx.fillStyle = `rgba(120,190,70,${.85 * la})`;
      for (let i = 0; i < 26; i++) {
        const an = hash(i * 2.7) * TAU + time * (.6 + hash(i) * .6), d = JUKAI_R * (.3 + hash(i * 4.4) * .8), h = 30 + hash(i * 1.3) * 120 + Math.sin(time * 2 + i) * 14;
        const px = fx.x + Math.cos(an) * d, py = fx.y + Math.sin(an) * d * .5 - h;
        ctx.save(); ctx.translate(px, py); ctx.rotate(time * 4 + i); ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.4, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      if (fx.age < 2) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 40, 200, '150,230,100', .18 * la, false, .6); ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Kamui phase dashes
  function phaseG(ctx, fx, time) {
    const K = Kit();
    for (const p of fx.paths) {
      const u = fx.age - p.t, a = 1 - win(u, .3, 1.2);
      if (a <= 0) continue;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(30,10,50,${.35 * a})`; ctx.lineWidth = 26;
      ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.ex, p.ey); ctx.stroke();
      ctx.strokeStyle = `rgba(190,150,255,${.4 * a})`; ctx.lineWidth = 3; ctx.stroke();
      if (u < .6) K.fx.shockRing(ctx, p.ex, p.ey, 110, u / .6, 1 - u / .6, '190,150,255');
    }
  }
  function phaseO(ctx, fx, time, z) {
    const S = Spr(), K = Kit();
    if (!S) return;
    // fading afterimages along the dash
    for (const g of fx.ghosts) {
      const a = 1 - (fx.age - g.t) / .45;
      if (a <= 0) continue;
      S.draw(ctx, 'tobi', g.x, g.y + 3, { facing: g.fc, frame: 'attack', alpha: .3 * a });
    }
    if (!z) return;
    const st = z.tb;
    if (!st || !(st.dash || st.phase > 0 && st.holdMove === 'phase')) return;
    const ds = st.dash, moving = ds && ds.moving, f = moving ? (ds.ex >= ds.sx ? 1 : -1) : Math.cos(z.angle || 0) >= 0 ? 1 : -1;
    // the target of the next dash, shown during each pause
    if (ds && !moving && ds.n < PHASE_N && ds.n > 0) {
      const p = { x: z.x + Math.cos(z.angle || 0) * 300, y: z.y + Math.sin(z.angle || 0) * 300 };
      ctx.strokeStyle = 'rgba(205,175,255,.6)'; ctx.lineWidth = 2; ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
    }
    // translucent body: the space round it rippling
    const e = eyeOf(z, f);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, z.y - 40, 70, '150,100,255', .35 + st.ripple);
    ctx.globalCompositeOperation = 'source-over';
    S.draw(ctx, 'tobi', z.x, z.y + 3, { facing: f, frame: moving ? 'attack' : 'seal', alpha: .55 });
    vortex(ctx, e.x, e.y, 14 + 6 * Math.sin(time * 8), -time * 9, .9, 1);
    ctx.save(); ctx.translate(z.x, z.y - 40); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = frac(time * 1.8 + i / 3), r = 30 + ph * 50 + st.ripple * 120;
      ctx.strokeStyle = `rgba(40,14,70,${.4 * (1 - ph)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, r * .7, r, 0, time * 3 + i, time * 3 + i + 4); ctx.stroke();
      ctx.strokeStyle = `rgba(230,215,255,${.7 * (1 - ph)})`; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Gedō Mazō (ultimate)
  // Hand motion of one slam: rises off the shoulder, hangs over the mark, drops, rests, pulls back.
  function handAt(s, rel, shx, shy, out) {
    const imp = s.imp, hover = s.big ? 360 : 330;
    if (rel < imp - .32) { const k = easeInOut(rel / (imp - .32)); out.x = lerp(shx, s.x, k); out.y = lerp(shy + 60, s.y, k); out.h = lerp(160, hover, k); }
    else if (rel < imp - .1) { out.x = s.x + Math.sin(rel * 60) * 2; out.y = s.y; out.h = hover + Math.sin(rel * 20) * 6; }
    else if (rel < imp) { const k = easeIn((rel - (imp - .1)) / .1); out.x = s.x; out.y = s.y; out.h = hover * (1 - k); }
    else if (rel < imp + .4) { out.x = s.x; out.y = s.y; out.h = 0; }
    else { const k = easeInOut((rel - imp - .4) / .55); out.x = lerp(s.x, shx, k); out.y = lerp(s.y, shy + 60, k); out.h = lerp(0, 160, k); }
    return out;
  }
  const HP = { x: 0, y: 0, h: 0 };
  function gedoRise(fx) {
    const t = fx.age;
    return t < .95 ? easeOut(t / .95) : t > fx.dur - 1.2 ? 1 - easeIn((t - (fx.dur - 1.2)) / 1.0) : 1;
  }
  function shoulder(fx, side) {
    const p = side < 0 ? G_SHL : G_SHR, rise = gedoRise(fx);
    return { x: fx.x + (p[0] - GW / 2) * GEDO_SC, y: fx.y - (GH - p[1]) * GEDO_SC * rise + (1 - rise) * 40 };
  }
  function gedoG(ctx, fx, time) {
    const K = Kit(), t = fx.age, rise = gedoRise(fx);
    // the summoning formula and the torn ground the statue climbs out of
    const sa = Math.min(1, t * 3) * (1 - win(t, fx.dur - .5, fx.dur));
    seal(ctx, fx.x, fx.y + 10, 300, sa * .9, fx.seed);
    ctx.fillStyle = `rgba(28,18,22,${.45 * sa})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 6, 250, 70, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y + 6, 360, 14, fx.seed, sa, 3);
    if (rise > .01) gedoStatue(ctx, fx, time, rise);
    // slam marks and craters
    for (const s of fx.slams) {
      const rel = t - s.t0;
      if (rel < s.imp) { if (s.side >= 0 || !s.big) markCircle(ctx, s.cx, s.cy, s.r, s.big ? '220,180,255' : '200,160,255', rel / s.imp, time, false); continue; }
      if (s.big && s.side < 0) continue;
      const u = rel - s.imp, fade = 1 - win(u, 1.2, 2.2);
      crater(ctx, s.cx, s.cy, s.big ? 260 : 140, fade, s.t0 * 9);
      if (u < .7) K.fx.shockRing(ctx, s.cx, s.cy, s.r * 1.5, u / .7, 1 - u / .7, '200,160,255');
      if (u > .06 && u < .8) K.fx.shockRing(ctx, s.cx, s.cy, s.r * 1.1, (u - .06) / .74, .8 - u, '255,255,255');
      dustRing(ctx, s.cx, s.cy, s.r * (.5 + easeOut(u / .8) * .8), s.big ? 22 : 14, (s.big ? 34 : 22) + u * 34, .85 * (1 - win(u, .3, 1.4)), s.t0 * 9, 10 + u * 20);
    }
  }
  function gedoStatue(ctx, fx, time, rise) {
    const K = Kit(), t = fx.age;
    // the statue itself, cut off at the ground line while it rises and sinks
    const img = gedoSpr(), vis = GH * rise, w = GW * GEDO_SC, top = fx.y - vis * GEDO_SC;
    ctx.save();
    // its idle arms hang down into the ground at either side
    for (const side of [-1, 1]) {
      if (fx.slams.some(s => s.side === side && t - s.t0 >= 0 && t - s.t0 < s.imp + .95)) continue;
      const sh = shoulder(fx, side);
      limbStroke(ctx, sh.x, sh.y, sh.x + side * 70, lerp(sh.y, fx.y, .5), sh.x + side * 30, fx.y + 4, 58 * GEDO_SC, rise);
    }
    ctx.drawImage(img, 0, 0, GW, vis, fx.x - w / 2, top, w, vis * GEDO_SC);
    // ground churned up where it breaks the surface
    if (rise < 1) dustRing(ctx, fx.x, fx.y + 4, 220, 16, 34, .9 * (1 - rise * .6), fx.seed, 8);
    ctx.restore();
    // the eyes glowing through the gag
    if (rise > .5) {
      const ex = fx.x, ey = top + 150 * GEDO_SC;
      ctx.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) K.glow(ctx, ex + s * 38 * GEDO_SC, ey, 30, '200,170,255', .55 + .25 * Math.sin(time * 6), true, .7);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // A long tapered limb (outline, flesh, shadow, light) through an elbow point.
  function limbStroke(ctx, x0, y0, x1, y1, x2, y2, w, alpha) {
    if (alpha <= .01) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = (dx, dy) => { ctx.beginPath(); ctx.moveTo(x0 + dx, y0 + dy); ctx.quadraticCurveTo(x1 + dx, y1 + dy, x2 + dx, y2 + dy); };
    path(0, 0); ctx.strokeStyle = '#17111c'; ctx.lineWidth = w + 10; ctx.stroke();
    ctx.strokeStyle = '#5d5272'; ctx.lineWidth = w; ctx.stroke();
    path(-w * .14, -w * .12); ctx.strokeStyle = '#887d95'; ctx.lineWidth = w * .6; ctx.stroke();
    path(-w * .26, -w * .22); ctx.strokeStyle = 'rgba(220,210,235,.5)'; ctx.lineWidth = w * .12; ctx.stroke();
    ctx.restore();
  }
  function gedoO(ctx, fx, time) {
    const K = Kit(), t = fx.age, rise = gedoRise(fx), top = fx.y - GH * rise * GEDO_SC;
    // the summoning cloud
    if (t < 1.1) K.fx.smokePoof(ctx, fx.x, fx.y + 10, 380, t / 1.1);
    // the roar: rings bursting from its maw
    if (fx.roar >= 0) {
      const u = t - fx.roar;
      if (u < 1.1) {
        const mx = fx.x, my = top + G_MOUTH[1] * GEDO_SC;
        ctx.save(); ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const k = (u - i * .1) / .8;
          if (k <= 0 || k >= 1) continue;
          const r = 40 + easeOut(k) * 420;
          ctx.strokeStyle = `rgba(40,20,60,${.5 * (1 - k)})`; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(mx, my, r, r * .7, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(235,225,255,${.85 * (1 - k)})`; ctx.lineWidth = 3; ctx.stroke();
        }
        ctx.restore();
        if (u < .9) K.fx.shockRing(ctx, fx.x, fx.y, 560, u / .9, 1 - u / .9, '200,160,255');
      }
    }
    // the arms and fists of each slam
    const fist = fistSpr();
    for (const s of fx.slams) {
      const rel = t - s.t0;
      if (rel < 0 || rel > s.imp + .95) continue;
      const sh = shoulder(fx, s.side), h = handAt(s, rel, sh.x, sh.y, HP), hx = h.x, hy = h.y - h.h;
      // its shadow growing on the ground under the falling fist
      const sk = 1 - clamp01(h.h / 360);
      ctx.fillStyle = `rgba(20,10,26,${.18 + .3 * sk})`; ctx.beginPath(); ctx.ellipse(h.x, h.y, (s.big ? 130 : 110) * (.6 + .4 * sk), (s.big ? 54 : 46) * (.6 + .4 * sk), 0, 0, TAU); ctx.fill();
      const ex = lerp(sh.x, hx, .5) + s.side * 120, ey = Math.min(sh.y, hy) - 120;
      limbStroke(ctx, sh.x, sh.y, ex, ey, hx, hy - 150 * .8, 62 * GEDO_SC, 1);
      const fw = 240 * (s.big ? .95 : .85), fh = 230 * (s.big ? .95 : .85);
      ctx.save(); ctx.translate(hx, hy); ctx.scale(s.side < 0 ? -1 : 1, 1);
      ctx.drawImage(fist, -fw / 2, -fh * .92, fw, fh);
      ctx.restore();
      // chain swinging off the shackle
      ctx.strokeStyle = '#1a1820'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 7; i++) { const cx = hx + s.side * (40 + i * 10), cy = hy - fh * .78 + i * 16 + Math.sin(time * 6 + i) * 4; ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy + 6); }
      ctx.stroke();
      // the impact
      const u = rel - s.imp;
      if (u >= 0 && u < 1.2 && (s.side >= 0 || !s.big)) {
        ctx.globalCompositeOperation = 'lighter';
        if (u < .25) K.glow(ctx, s.cx, s.cy - 20, (s.big ? 360 : 200) * (1 + u * 2), '230,210,255', 1 - u / .25, true, .6);
        ctx.globalCompositeOperation = 'source-over';
        K.fx.debris(ctx, s.cx, s.cy, s.r * 1.2, u / 1.1, s.t0 * 7, '#3b3040', s.big ? 24 : 14);
        for (let i = 0; i < (s.big ? 14 : 8); i++) {
          const an = i * TAU / (s.big ? 14 : 8) + hash(s.t0 + i), d = s.r * (.3 + easeOut(u * 1.3) * (.8 + hash(i * 2.2) * .4)), hh = bell(u * .95) * (60 + hash(i * 5) * 140);
          drawRock(ctx, i, s.cx + Math.cos(an) * d, s.cy + Math.sin(an) * d * .5 - hh, 10 + hash(i * 7.7) * 12, u * 8 + i, 1 - win(u, .8, 1.2));
        }
      }
    }
  }

  const FX = {
    kamui: [kamuiG, kamuiO], warp: [warpG, warpO], sashiki: [sashikiG, sashikiO], katon: [katonG, katonO],
    gaeshi: [gaeshiG, gaeshiO], jukai: [jukaiG, jukaiO], phase: [phaseG, phaseO], gedo: [gedoG, gedoO]
  };

  // ------------------------------------------------------------------ windup looks
  function windupG(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, move = st.move;
    // ripples of warped space spreading over the ground from his feet
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5);
    for (let i = 0; i < 4; i++) {
      const ph = frac(time * 1.1 + i / 4), r = 20 + ph * (90 + 60 * k);
      ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(120,40,20,${(1 - ph) * .5})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = `rgba(255,200,150,${(1 - ph) * .7})`; ctx.stroke();
    }
    ctx.restore();
    if (move === 'gedo') seal(ctx, st.gx, st.gy + 10, 80 + 220 * easeOut(k), Math.min(1, k * 3), 3.3);
    if (move === 'jukai') {
      ctx.fillStyle = `rgba(70,110,40,${.25 * k})`; ctx.beginPath(); ctx.ellipse(z.x, z.y, 60 + 60 * k, 30 + 30 * k, 0, 0, TAU); ctx.fill();
    }
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, f = Math.cos(st.aim) >= 0 ? 1 : -1;
    const eye = eyeOf(z, f), hx = z.x + f * 22, hy = z.y - 40;
    // the Sharingan burning behind the mask
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, eye.x, eye.y, 10 + 8 * k, '255,50,40', .9, true);
    ctx.globalCompositeOperation = 'source-over';
    switch (move) {
      case 'kamui': case 'warp': case 'phase': {
        vortex(ctx, eye.x, eye.y, 10 + (move === 'kamui' ? 34 : 24) * e, -time * 8, Math.min(1, k * 3), 1);
        if (move === 'kamui') {
          // a thread of warped space reaching from the eye to the target
          ctx.strokeStyle = 'rgba(210,190,255,.55)'; ctx.lineWidth = 2; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -time * 200;
          ctx.beginPath(); ctx.moveTo(eye.x, eye.y); ctx.quadraticCurveTo(lerp(eye.x, st.tx, .5), Math.min(eye.y, st.ty) - 120, st.tx, st.ty - 40); ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case 'sashiki': {
        // branches sprouting from his forearm and creaking forward
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const an = st.aim + (i - 2) * .32, L = (20 + 30 * e) * (1 - Math.abs(i - 2) * .15);
          const x1 = hx + Math.cos(an) * L, y1 = hy + Math.sin(an) * L * .6 - 6;
          ctx.strokeStyle = '#22140a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.strokeStyle = '#8a5e36'; ctx.lineWidth = 4; ctx.stroke();
        }
        break;
      }
      case 'katon': {
        const mx = z.x + f * 12, my = z.y - H() * .62;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, mx, my, 30 + 40 * e, '255,140,50', .8, true);
        ctx.fillStyle = 'rgba(255,190,90,.9)';
        for (let i = 0; i < 10; i++) { const ph = frac(time * 2 + i / 10), an = hash(i * 3.3) * TAU; ctx.fillRect(mx + Math.cos(an) * 60 * (1 - ph), my + Math.sin(an) * 40 * (1 - ph), 3, 3); }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'gaeshi': {
        ctx.save(); ctx.globalAlpha = Math.min(1, k * 3) * .9; ctx.translate(z.x + f * 30, z.y - 6);
        ctx.scale(f * (.4 + .4 * e), .4 + .4 * e); ctx.drawImage(fanSpr(), -80, -236, 160, 250); ctx.restore();
        break;
      }
      case 'jukai': {
        ctx.fillStyle = 'rgba(120,190,70,.9)';
        for (let i = 0; i < 12; i++) {
          const an = i / 12 * TAU + time * 3, r = 70 * (1 - e * .4), h = 20 + i * 6 + Math.sin(time * 4 + i) * 8;
          ctx.save(); ctx.translate(z.x + Math.cos(an) * r, z.y + Math.sin(an) * r * .5 - h); ctx.rotate(time * 5 + i); ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.4, 0, 0, TAU); ctx.fill(); ctx.restore();
        }
        break;
      }
      case 'gedo': {
        // smoke boiling off the formula, chains rattling up out of the ground
        const smoke = K.puff('smoke'), sx = st.gx, sy = st.gy;
        for (let i = 0; i < 8; i++) { const ph = frac(time * 1.3 + i / 8); K.stamp(ctx, smoke, sx + Math.sin(i * 2.3 + time) * 120 * e, sy - ph * 90, 20 + 22 * ph, bell(ph) * .6 * Math.min(1, k * 2), .8); }
        ctx.strokeStyle = '#1a1820'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          for (let i = 0; i < 9; i++) { const cx = sx + s * (60 + i * 14), cy = sy - i * 18 * e + Math.sin(time * 9 + i) * 3; ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy - 7); }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, sx, sy - 40, 120 * e, '180,140,255', .35);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }
  }

  function label(ctx, z, st, m) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (!move || !MOVES[move]) return;
    const top = z.y - H() - 44;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#1c0c06'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.guard = 0; st.phase = 0; st.warp = null; st.dash = null;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.tb;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    if (!st.fx.length && !(st.windup > 0) && z.health <= 0) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
      for (const s of st.tele) {
        if (s.k === 'c') markCircle(ctx, s.follow ? z.x : s.x, s.follow ? z.y : s.y, s.r, rgb, k, time, s.faint, s.small);
        else if (s.k === 'line') markLine(ctx, s.follow ? Object.assign({}, s, { x: z.x, y: z.y }) : s, rgb, k, time);
        else if (s.k === 'cone') markCone(ctx, z.x, z.y, s, rgb, k, time);
      }
      windupG(ctx, z, st, time);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.tb;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        windupO(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      } else if (st.hold > 0 && st.holdMove === 'gedo') {
        // hands in the seal, the Sharingan blazing while the statue obeys
        const K = Kit(), e = eyeOf(z, Math.cos(z.angle || 0) >= 0 ? 1 : -1);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, e.x, e.y, 16, '255,50,40', .9, true);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (st.phase > 0 && st.ripple > 0 && !hidden(z)) {
        // blows sinking harmlessly into the warp round his body
        const K = Kit();
        vortex(ctx, z.x, z.y - 46, 40 + st.ripple * 80, -time * 8, st.ripple * 3, .9);
        void K;
      }
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  window.TobiBoss = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden };
})();
