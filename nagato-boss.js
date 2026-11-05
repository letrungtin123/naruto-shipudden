(() => {
  'use strict';

  // Fourth Great Ninja War: Nagato reanimated by Edo Tensei (spawn panel, faction 'nagato').
  // Contract as legend-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
  // ground layer (telegraphs, craters, furrows, shadows), drawOverlay(ctx, z, time) what stands above
  // the characters (domes, summoned beasts, the wind dragon, Chibaku Tensei's planet). All per-boss
  // state lives on z.ng. Moves: Shinra Tensei, black receivers rain, the Animal Path's rhinos and
  // giant centipede, Banshō Ten'in combo, Fūton wind dragon, Gakidō absorbing seal, and the
  // ultimate Chibaku Tensei.
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
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  const order = ['nagato'];
  const members = {
    nagato: {
      name: 'NAGATO — UẾ THỔ CHUYỂN SINH', short: 'NAGATO', accent: '#c2a6ff', hpScale: 3.8, damageScale: 2.0, armor: .85, regen: .004,
      // Every jutsu shows once in the first ~30 s; the second lap reorders them.
      moves: ['shinra', 'rods', 'rhino', 'bansho', 'futon', 'gakido', 'centipede', 'chibaku',
        'rods', 'shinra', 'centipede', 'futon', 'rhino', 'bansho', 'chibaku']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    shinra:    { label: 'THẦN LA THIÊN CHINH', rgb: '215,190,255', windup: 1.05, after: 1.8 },
    rods:      { label: 'THIÊN ĐẠO · HẮC BỔNG VŨ', rgb: '200,170,255', windup: .85, after: 1.6 },
    rhino:     { label: 'SÚC SINH ĐẠO · KHẨU KÝ · TÊ GIÁC', rgb: '236,214,176', windup: 1.1, after: 1.8 },
    bansho:    { label: 'VẠN TƯỢNG THIÊN DẪN', rgb: '205,170,255', windup: .85, after: 1.9 },
    futon:     { label: 'PHONG ĐỘN · PHONG LONG ĐẠN', rgb: '200,255,232', windup: 1.0, after: 1.9 },
    gakido:    { label: 'NGẠ QUỶ ĐẠO · PHONG THUẬT HẤP ẤN', rgb: '190,160,255', windup: .35, after: 2.9 },
    centipede: { label: 'SÚC SINH ĐẠO · KHẨU KÝ · NGÔ CÔNG', rgb: '255,170,120', windup: 1.0, after: 2.4 },
    chibaku:   { label: 'ĐỊA BỘC THIÊN TINH', rgb: '190,150,255', windup: 1.3, after: 3.2 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const SHINRA_R = 470, RODS_R = 430, RHINO_LEN = 1100, RHINO_SPEED = 1500, RHINO_W = 62;
  const DRAGON_LEN = 1150, DRAGON_SPEED = 1350, DRAGON_BODY = 560;
  const CENT_SPEED = 1050, CENT_BODY = 760, CENT_GAP = 36, CS = 1.55;
  const CHIB_R = 560, CHIB_T = 3.4, CHIB_H = 195, CHIB_RS = 165;

  function pick() { return order[0]; }
  // Manual control (team mode): keys 1..8 in this order, the ultimate last.
  const KEYS = ['shinra', 'rods', 'rhino', 'bansho', 'futon', 'gakido', 'centipede', 'chibaku'];
  const moves = () => KEYS.map(k => ({ label: MOVES[k].label }));
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.ng || (z.ng = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], force: null, hold: 0, holdMove: '', guard: 0, guardHp: 0, absorb: 0, reactCd: 6,
      hpMark: z.health, hpClock: 0, flakes: [], spots: null, lanes: null, path: null, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = Math.random() * 99;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });

  // ------------------------------------------------------------------ paths (wind dragon, centipede)
  function makePath(pts) {
    const n = pts.length / 2, cum = new Float32Array(n);
    let L = 0;
    for (let i = 1; i < n; i++) { L += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]); cum[i] = L; }
    return { p: Float32Array.from(pts), cum, n, len: L };
  }
  function pathAt(path, d, out) {
    const p = path.p, cum = path.cum, n = path.n;
    let lo = 0, hi = n - 1;
    if (d <= 0) hi = 1;
    else if (d >= path.len) lo = n - 2;
    else while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const seg = cum[hi] - cum[lo] || 1, t = clamp01((d - cum[lo]) / seg);
    out.x = lerp(p[lo * 2], p[hi * 2], t); out.y = lerp(p[lo * 2 + 1], p[hi * 2 + 1], t);
    out.a = Math.atan2(p[hi * 2 + 1] - p[lo * 2 + 1], p[hi * 2] - p[lo * 2]);
    return out;
  }
  function sinPath(x0, y0, a, len, amp, waves, ph) {
    const pts = [], ca = Math.cos(a), sa = Math.sin(a), N = Math.ceil(len / 22);
    for (let i = 0; i <= N; i++) {
      const d = i / N * len, env = Math.min(1, d / 220), o = Math.sin(d / len * waves * TAU + ph) * amp * env;
      pts.push(x0 + ca * d - sa * o, y0 + sa * d + ca * o);
    }
    return makePath(pts);
  }
  function bezPath(ax, ay, cx, cy, bx, by) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, u = 1 - t;
      pts.push(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by);
    }
    return makePath(pts);
  }
  const PA = { x: 0, y: 0, a: 0 }, PB = { x: 0, y: 0, a: 0 };

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty;
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    switch (move) {
      case 'shinra': return [{ k: 'c', follow: true, r: SHINRA_R }, { k: 'c', follow: true, r: SHINRA_R * .5, faint: true }];
      case 'rods': {
        const spots = [], b = Math.random() * TAU;
        spots.push({ x: tx, y: ty });
        for (let i = 0; i < 5; i++) spots.push({ x: tx + Math.cos(b + i * TAU / 5) * 120, y: ty + Math.sin(b + i * TAU / 5) * 120 });
        for (let i = 0; i < 8; i++) spots.push({ x: tx + Math.cos(b + (i + .5) * TAU / 8) * 250, y: ty + Math.sin(b + (i + .5) * TAU / 8) * 250 });
        for (let i = 0; i < 7; i++) { const aa = b + i * TAU / 7 + .2, d = rand(340, 410); spots.push({ x: tx + Math.cos(aa) * d, y: ty + Math.sin(aa) * d }); }
        spots.forEach((s, i) => { s.t = .12 + i * .055 + Math.random() * .05; s.lean = rand(-.32, .32); s.seed = Math.random() * 99; });
        st.spots = spots;
        return [circ(tx, ty, RODS_R, true)].concat(spots.map(s => ({ k: 'c', x: s.x, y: s.y, r: 60, faint: true, small: true })));
      }
      case 'rhino': {
        st.lanes = [-.24, 0, .24].map((o, i) => ({ a: a + o, x0: x + Math.cos(a + o) * 70, y0: y + Math.sin(a + o) * 70, t0: .32 + [1, 0, 2][i] * .15 }));
        return st.lanes.map(l => ({ k: 'line', x: l.x0, y: l.y0, a: l.a, len: RHINO_LEN, w: RHINO_W }));
      }
      case 'bansho': return [{ k: 'line', x, y, a, len: Math.min(1000, Math.hypot(tx - x, ty - y)), w: 30 }, { k: 'c', follow: true, r: 270, faint: true }];
      case 'futon': {
        st.path = sinPath(x + Math.cos(a) * 50, y + Math.sin(a) * 50, a, DRAGON_LEN, 95, 1.55, Math.random() < .5 ? 0 : Math.PI);
        pathAt(st.path, st.path.len, PA);
        return [{ k: 'path', path: st.path, w: 88 }, circ(PA.x, PA.y, 230)];
      }
      case 'gakido': return [];
      case 'centipede': {
        // It bursts out of the ground beside the target, sweeps past it in a long arc and dives.
        const side = Math.random() < .5 ? 1 : -1, b = a + side * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        const ax = tx - Math.cos(b) * 420 - ca * 60, ay = ty - Math.sin(b) * 420 - sa * 60;
        const bx = tx + Math.cos(b) * 420 - ca * 60, by = ty + Math.sin(b) * 420 - sa * 60;
        st.path = bezPath(ax, ay, tx + ca * 260, ty + sa * 260, bx, by);
        return [{ k: 'path', path: st.path, w: 76 }, circ(ax, ay, 140), circ(bx, by, 150)];
      }
      case 'chibaku': return [circ(tx, ty, CHIB_R, true), circ(tx, ty, 300, true)];
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
    const move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
    api.burst(z.x, z.y - 30, m.accent, 10);
    switch (move) {
      case 'shinra': {
        const x = z.x, y = z.y;
        addFx(st, { kind: 'shinra', x, y, R: SHINRA_R, dur: 2.6 });
        api.knockback(z, SHINRA_R, 330, D * 2.5);
        api.world(x, y, 270, D * 3, 'shockwave');
        for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + .4; api.world(x + Math.cos(aa) * 380, y + Math.sin(aa) * 380, 150, D * 2.6, 'shockwave', aa); }
        api.burst(x, y - 30, '#efe6ff', 26);
        api.shake(22);
        break;
      }
      case 'rods': {
        const spots = st.spots || [];
        let last = 0;
        spots.forEach((s, i) => {
          last = Math.max(last, s.t);
          later(st, s.t, api => {
            api.strike(s.x, s.y, 60, D * 1.05, null, i % 6 === 0 ? 'crater' : null, true);
            if (i % 4 === 0) api.shake(6);
          });
        });
        addFx(st, { kind: 'rods', spots, x: st.tx, y: st.ty, last, tick: last + .7, pulses: 0, dur: last + 3.6, upd: rodsUpd, dmg: D });
        st.spots = null;
        break;
      }
      case 'rhino': {
        const lanes = st.lanes || [];
        for (const l of lanes) {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 60, i = 0; d <= RHINO_LEN; d += 105, i++) {
            later(st, l.t0 + d / RHINO_SPEED, api => {
              api.strike(l.x0 + c * d, l.y0 + s * d, 76, D * 1.6, null, i === 4 || i === 9 ? 'earth' : null, true);
              if (i % 4 === 0) api.shake(7);
            });
          }
        }
        addFx(st, { kind: 'rhino', lanes, dur: .32 + .3 + RHINO_LEN / RHINO_SPEED + 1.1 });
        st.lanes = null;
        api.shake(8);
        break;
      }
      case 'bansho': {
        const p = api.player, d = p ? Math.hypot(p.x - z.x, p.y - z.y) : 0;
        addFx(st, { kind: 'bansho', x: z.x, y: z.y, px: p ? p.x : st.tx, py: p ? p.y : st.ty, a, dur: 2.0, z });
        api.knockback(z, 1100, -Math.max(0, d - 95), D * .5);
        later(st, .58, api => {
          const q = api.player, aa = q ? Math.atan2(q.y - z.y, q.x - z.x) : a;
          api.line(z.x, z.y, z.x + Math.cos(aa) * 300, z.y + Math.sin(aa) * 300, 46, D * 2.1, null);
          const f = st.fx.find(f => f.kind === 'bansho'); if (f) f.ra = aa;
          api.shake(9);
        });
        later(st, 1.0, api => {
          api.knockback(z, 270, 260, D * 1.7);
          api.world(z.x, z.y, 210, D * 2.2, 'shockwave');
          addFx(st, { kind: 'mini', x: z.x, y: z.y, R: 270, dur: 1.4 });
          api.shake(14);
        });
        break;
      }
      case 'futon': {
        const path = st.path;
        if (!path) break;
        const P = { x: 0, y: 0, a: 0 };
        for (let d = 40, i = 0; d <= path.len; d += 100, i++) {
          pathAt(path, d, P);
          const x = P.x, y = P.y;
          later(st, .1 + d / DRAGON_SPEED, api => api.strike(x, y, 88, D * 1.45, null, i % 5 === 3 ? 'vortex' : null, true));
        }
        pathAt(path, path.len, P);
        const ex = P.x, ey = P.y;
        later(st, .12 + path.len / DRAGON_SPEED, api => {
          api.strike(ex, ey, 230, D * 2.0, '#e6fff4', 'vortex');
          api.world(ex, ey, 200, D * 2.4, 'vortex');
          api.shake(14);
        });
        addFx(st, { kind: 'futon', path, ex, ey, dur: .1 + path.len / DRAGON_SPEED + 1.9 });
        st.path = null;
        break;
      }
      case 'gakido':
        st.guard = 3.0; st.guardHp = z.health;
        addFx(st, { kind: 'gakido', x: z.x, y: z.y, dur: 3.0, z });
        break;
      case 'centipede': {
        const path = st.path;
        if (!path) break;
        const P = { x: 0, y: 0, a: 0 }, t0 = .15;
        pathAt(path, 0, P); const ax = P.x, ay = P.y;
        pathAt(path, path.len, P); const bx = P.x, by = P.y;
        later(st, t0, api => { api.strike(ax, ay, 140, D * 1.7, null, 'earth', true); api.shake(11); });
        for (let d = 80; d < path.len - 60; d += 100) {
          pathAt(path, d, P);
          const x = P.x, y = P.y;
          later(st, t0 + d / CENT_SPEED, api => api.strike(x, y, 78, D * 1.25, null, null, true));
        }
        const tDive = t0 + path.len / CENT_SPEED;
        later(st, tDive, api => { api.strike(bx, by, 150, D * 1.8, null, 'crater', true); api.shake(10); });
        const f = addFx(st, { kind: 'centipede', path, t0, ax, ay, bx, by, tDive, up: null, dur: tDive + CENT_BODY / CENT_SPEED + 2.6 });
        // ...then it erupts straight up under wherever the target stands a moment later.
        later(st, tDive + .25, api => {
          const q = api.player, ux = q ? q.x : st.tx, uy = q ? q.y : st.ty;
          f.up = { x: ux, y: uy, t: f.age };
          later(st, .8, api => { api.strike(ux, uy, 150, D * 2.3, '#ffb070', 'earth'); api.shake(15); });
        });
        st.path = null;
        break;
      }
      case 'chibaku': {
        const tx = st.tx, ty = st.ty, T = CHIB_T;
        addFx(st, { kind: 'chibaku', x: tx, y: ty, x0: z.x, y0: z.y, R: CHIB_R, T, dur: T + 4.0 });
        st.hold = T + .2; st.holdMove = 'chibaku';
        const well = { x: tx, y: ty };
        for (let t = .7; t < T - .55; t += .6) later(st, t, api => { api.knockback(well, CHIB_R + 160, -78, D * .25); api.shake(5); });
        later(st, 1.3, api => { api.world(tx + 300, ty - 120, 150, D * 2, 'earth'); api.world(tx - 260, ty + 160, 150, D * 2, 'earth'); });
        later(st, T, api => {
          api.strike(tx, ty, CHIB_R, D * 4.6, '#d8c8ff', 'crater');
          api.world(tx, ty, 320, D * 4, 'crater');
          for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + .78; api.world(tx + Math.cos(aa) * 420, ty + Math.sin(aa) * 420, 170, D * 3, 'crater', aa); }
          api.burst(tx, ty - 40, '#d8c8ff', 30);
          api.shake(28);
        });
        break;
      }
    }
    void ca; void sa;
  }

  function rodsUpd(fx, dt, api) {
    // The receivers stay planted and pulse the Deva Path's chakra round themselves.
    if (fx.age < fx.tick || fx.pulses >= 4) return;
    fx.tick += .7; fx.pulses++;
    for (const s of fx.spots) api.strike(s.x, s.y, 66, fx.dmg * .3, null, null, true);
  }

  function release(z, st, api) {
    const D = api.damage || 60;
    api.knockback(z, 290, 200, D * 1.5);
    api.world(z.x, z.y, 200, D * 2, 'shockwave');
    addFx(st, { kind: 'mini', x: z.x, y: z.y, R: 290, dur: 1.3, violet: true });
    api.shake(12);
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
    for (let i = st.flakes.length - 1; i >= 0; i--) {
      const f = st.flakes[i];
      f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= 30 * dt;
      if (f.age > f.dur) st.flakes.splice(i, 1);
    }
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.guard = 0; st.hold = 0; z.manualBusy = false; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.rec = Math.max(0, (st.rec || 0) - dt);
    st.absorb = Math.max(0, st.absorb - dt);
    st.reactCd -= dt;

    // Gakidō: the seal drinks the chakra of every blow; when it lifts, it spits the excess back out.
    if (st.guard > 0) {
      if (z.health < st.guardHp) { z.health = Math.min(z.maxHealth, z.health + (st.guardHp - z.health) * .8); st.absorb = .35; }
      st.guardHp = z.health;
      st.guard -= dt;
      if (st.guard <= 0) { st.guard = 0; release(z, st, api); }
    }
    z.armorScale = (m.armor || 1) * (st.guard > 0 ? .25 : 1);
    // Edo Tensei body: knits itself back together.
    if (m.regen && z.health < z.maxHealth) z.health = Math.min(z.maxHealth, z.health + z.maxHealth * m.regen * dt);
    // ...and sheds paper ash wherever it is hit.
    if (z.hitFlash > .06 && st.flakes.length < 22 && Math.random() < dt * 40)
      st.flakes.push({ x: z.x + rand(-14, 14), y: z.y - rand(26, 84), vx: rand(-45, 45), vy: rand(-60, -20), age: 0, dur: rand(.5, 1.0), s: rand(2.5, 4.5), r: Math.random() * 6 });

    st.hpClock += dt;
    if (st.hpClock > 1.5) { st.hpClock = 0; st.hpMark = z.health; }

    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.rec = .4;
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && z.manual) {
      // Driven by the player: only the requested jutsu, no rotation, no Gakidō reflex.
      st.holdMove = '';
      if (z.manualCast != null && st.rec <= 0) {
        const k = KEYS[z.manualCast]; z.manualCast = null;
        if (k) { st.force = k; announce(z, st, m, api); }
      }
    } else if (st.hold <= 0) {
      st.holdMove = '';
      st.timer -= dt;
      const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      const hurt = st.hpMark - z.health > z.maxHealth * .04;
      if (hurt && st.reactCd <= 0 && st.guard <= 0 && st.timer > .2) { st.reactCd = 11; st.hpMark = z.health; st.force = 'gakido'; announce(z, st, m, api); }
      else if (st.timer <= 0 && p && (st.force || d < 900)) announce(z, st, m, api);
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || st.rec > 0;
    z.speedScale = st.guard > 0 ? .5 : .9;
  }

  // ------------------------------------------------------------------ cached art
  function rockSpr(i) {
    return Kit().sprite('ng:rock' + (i % 3), 64, 64, g => {
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
      g.strokeStyle = 'rgba(30,20,16,.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(c - 14, c + 2); g.lineTo(c + 2, c - 4); g.lineTo(c + 10, c + 8); g.stroke();
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

  // The rock planet Chibaku Tensei packs together round its black core.
  function planetSpr() {
    return Kit().sprite('ng:planet', 320, 320, g => {
      const c = 160, R = 156;
      const gr = g.createRadialGradient(c - 50, c - 60, 10, c, c, R);
      gr.addColorStop(0, '#9a8470'); gr.addColorStop(.45, '#6a5646'); gr.addColorStop(.85, '#3a2e28'); gr.addColorStop(1, '#1e1816');
      g.fillStyle = gr; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(c, c, R, 0, TAU); g.clip();
      // packed boulders: faceted lumps with lit tops and dark undersides
      for (let i = 0; i < 70; i++) {
        const a = hash(i * 3.7) * TAU, d = Math.sqrt(hash(i * 1.3)) * R, x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
        const r = 9 + hash(i * 5.1) * 18, edge = d / R;
        g.fillStyle = `rgba(20,14,12,${.35 + edge * .3})`;
        g.beginPath(); g.ellipse(x + 3, y + 4, r, r * .8, hash(i) * 3, 0, TAU); g.fill();
        g.fillStyle = `rgba(${150 - edge * 70 | 0},${128 - edge * 60 | 0},${108 - edge * 50 | 0},.9)`;
        g.beginPath(); g.ellipse(x, y, r * .92, r * .74, hash(i) * 3, 0, TAU); g.fill();
        g.fillStyle = `rgba(230,210,180,${.28 * (1 - edge)})`;
        g.beginPath(); g.ellipse(x - r * .25, y - r * .3, r * .45, r * .3, hash(i) * 3, 0, TAU); g.fill();
      }
      // cracks between the masses
      g.strokeStyle = 'rgba(16,10,10,.7)'; g.lineWidth = 2.2; g.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        let x = c + (hash(i * 9.1) - .5) * R * 1.6, y = c + (hash(i * 4.3) - .5) * R * 1.6;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (hash(i * 7 + k) - .5) * 50; y += (hash(i * 3 + k * 5) - .5) * 50; g.lineTo(x, y); }
        g.stroke();
      }
      // terminator shadow on the lower right
      const sh = g.createRadialGradient(c - 60, c - 70, R * .5, c - 20, c - 30, R * 1.35);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.7, 'rgba(10,6,14,.25)'); sh.addColorStop(1, 'rgba(10,6,14,.75)');
      g.fillStyle = sh; g.fillRect(0, 0, 320, 320);
      g.restore();
      // lavender rim light from the gravity glow behind
      g.strokeStyle = 'rgba(200,170,255,.55)'; g.lineWidth = 5;
      g.beginPath(); g.arc(c, c, R - 3, Math.PI * .9, Math.PI * 1.75); g.stroke();
      g.strokeStyle = '#120c10'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, R - 1, 0, TAU); g.stroke();
    });
  }

  // Animal Path rhino, side view facing right, feet on y = 158. Two gallop frames.
  function rhinoSpr(frame) {
    return Kit().sprite('ng:rhino' + frame, 264, 172, g => {
      const O = '#1b1714', B = '#8f8778', L = '#c0b8a8', S = '#5f584e', DK = '#3e3832';
      g.lineJoin = 'round'; g.lineCap = 'round';
      const sw = frame ? 1 : -1;
      const leg = (x, y, s, far) => {
        g.fillStyle = far ? S : B; g.strokeStyle = O; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x - 17, y); g.lineTo(x - 15 + s * .5, y + 34); g.lineTo(x - 17 + s, 156); g.lineTo(x + 15 + s, 156); g.lineTo(x + 15 + s * .5, y + 34); g.lineTo(x + 17, y); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = far ? DK : S; g.beginPath(); g.ellipse(x + s, 155, 18, 5, 0, 0, TAU); g.fill(); g.stroke();
        if (!far) { g.strokeStyle = 'rgba(30,24,20,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 10 + s * .4, y + 30); g.lineTo(x + 8 + s * .4, y + 33); g.stroke(); }
      };
      leg(72, 104, -16 * sw, true); leg(172, 104, 16 * sw, true);
      g.strokeStyle = O; g.lineWidth = 5; g.beginPath(); g.moveTo(30, 80); g.quadraticCurveTo(12, 86, 12, 108); g.stroke();
      const body = () => {
        g.beginPath(); g.moveTo(30, 98); g.bezierCurveTo(18, 40, 72, 24, 132, 28); g.bezierCurveTo(178, 30, 204, 44, 210, 72);
        g.bezierCurveTo(216, 102, 202, 128, 172, 130); g.lineTo(62, 132); g.bezierCurveTo(40, 130, 32, 116, 30, 98); g.closePath();
      };
      body(); g.fillStyle = B; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = S; g.beginPath(); g.ellipse(120, 140, 120, 34, 0, 0, TAU); g.fill();
      g.fillStyle = L; g.beginPath(); g.ellipse(118, 34, 80, 16, -.05, 0, TAU); g.fill();
      // armour folds at shoulder and hip, skin pebbling
      g.strokeStyle = DK; g.lineWidth = 3;
      g.beginPath(); g.moveTo(160, 30); g.quadraticCurveTo(146, 80, 162, 132); g.stroke();
      g.beginPath(); g.moveTo(74, 30); g.quadraticCurveTo(90, 80, 78, 132); g.stroke();
      g.strokeStyle = 'rgba(220,210,190,.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(166, 34); g.quadraticCurveTo(153, 80, 168, 126); g.stroke();
      g.fillStyle = 'rgba(40,34,30,.35)';
      for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(30 + hash(i * 2.3) * 180, 40 + hash(i * 5.1) * 80, 1.6 + hash(i) * 1.8, 0, TAU); g.fill(); }
      g.restore();
      body(); g.strokeStyle = O; g.lineWidth = 5; g.stroke();
      // head: heavy wedge with the great horn on the snout
      const head = () => {
        g.beginPath(); g.moveTo(186, 48); g.bezierCurveTo(222, 48, 248, 78, 254, 106); g.quadraticCurveTo(256, 122, 240, 126);
        g.lineTo(208, 124); g.bezierCurveTo(194, 110, 182, 84, 186, 48); g.closePath();
      };
      head(); g.fillStyle = B; g.fill();
      g.save(); head(); g.clip(); g.fillStyle = S; g.fillRect(180, 108, 80, 30); g.fillStyle = L; g.beginPath(); g.ellipse(214, 56, 26, 9, .3, 0, TAU); g.fill(); g.restore();
      head(); g.strokeStyle = O; g.lineWidth = 4.5; g.stroke();
      g.fillStyle = '#ece2c8';
      g.beginPath(); g.moveTo(234, 98); g.quadraticCurveTo(250, 70, 252, 30); g.quadraticCurveTo(238, 62, 222, 88); g.closePath(); g.fill(); g.lineWidth = 3.5; g.stroke();
      g.beginPath(); g.moveTo(214, 74); g.quadraticCurveTo(222, 58, 224, 44); g.quadraticCurveTo(214, 58, 206, 70); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(150,130,100,.6)'; g.beginPath(); g.moveTo(238, 92); g.quadraticCurveTo(248, 70, 250, 40); g.lineTo(246, 52); g.quadraticCurveTo(240, 74, 232, 92); g.fill();
      // ear
      g.fillStyle = S; g.beginPath(); g.moveTo(192, 52); g.lineTo(184, 30); g.lineTo(200, 46); g.closePath(); g.fill(); g.lineWidth = 3; g.stroke();
      // Rinnegan eye
      g.fillStyle = '#d8ccf4'; g.beginPath(); g.ellipse(212, 80, 7, 6, 0, 0, TAU); g.fill(); g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#4a3480'; g.lineWidth = 1;
      for (const r of [2, 4, 5.5]) { g.beginPath(); g.ellipse(212, 80, r, r * .85, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#2a1a50'; g.beginPath(); g.arc(212, 80, 1.3, 0, TAU); g.fill();
      // nostril and mouth line
      g.strokeStyle = O; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(244, 112); g.lineTo(250, 110); g.stroke();
      g.beginPath(); g.moveTo(222, 118); g.quadraticCurveTo(234, 122, 246, 118); g.stroke();
      // black chakra receivers driven into its back
      for (const [x, y, ang] of [[96, 34, -2.1], [122, 30, -1.8], [148, 34, -1.5], [176, 42, -1.25]]) {
        g.strokeStyle = O; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + Math.cos(ang) * 30, y + Math.sin(ang) * 30); g.stroke();
        g.strokeStyle = '#1a1820'; g.lineWidth = 3.5; g.stroke();
        g.strokeStyle = 'rgba(190,170,240,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1, y + 4); g.lineTo(x + Math.cos(ang) * 28 + 1, y + Math.sin(ang) * 28); g.stroke();
        g.fillStyle = '#121016'; g.beginPath(); g.arc(x + Math.cos(ang) * 31, y + Math.sin(ang) * 31, 4, 0, TAU); g.fill();
      }
      leg(86, 108, 16 * sw, false); leg(188, 108, -16 * sw, false);
    });
  }

  // Giant centipede: one carapace segment and the head, both pointing along +x.
  function centSegSpr() {
    return Kit().sprite('ng:cseg', 64, 48, g => {
      const O = '#1a0e0c';
      g.fillStyle = '#5a2c24'; g.strokeStyle = O; g.lineWidth = 3;
      g.beginPath(); g.ellipse(32, 24, 22, 19, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#7e4434'; g.beginPath(); g.ellipse(34, 20, 16, 12, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,200,160,.45)'; g.beginPath(); g.ellipse(36, 15, 8, 4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#e09a3c'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(32, 24, 18, 16, 0, -1.2, 1.2); g.stroke();
      g.strokeStyle = 'rgba(20,8,8,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32, 7); g.lineTo(32, 41); g.stroke();
    });
  }
  function centHeadSpr() {
    return Kit().sprite('ng:chead', 112, 80, g => {
      const O = '#1a0e0c';
      g.lineCap = 'round'; g.lineJoin = 'round';
      // antennae sweeping back
      g.strokeStyle = O; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(52, 30); g.quadraticCurveTo(36, 6, 6, 4); g.moveTo(52, 50); g.quadraticCurveTo(36, 74, 6, 76); g.stroke();
      g.strokeStyle = '#c2783a'; g.lineWidth = 1.6; g.stroke();
      // mandibles: forcipules curling forward
      for (const s of [-1, 1]) {
        g.fillStyle = '#2a1410'; g.strokeStyle = O; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(64, 40 + s * 10); g.quadraticCurveTo(100, 40 + s * 22, 104, 40 + s * 4); g.quadraticCurveTo(92, 40 + s * 12, 70, 40 + s * 4); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#e8b070'; g.beginPath(); g.arc(103, 40 + s * 4, 2.2, 0, TAU); g.fill();
      }
      g.fillStyle = '#6a3226'; g.strokeStyle = O; g.lineWidth = 3;
      g.beginPath(); g.ellipse(56, 40, 24, 21, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#8e4c38'; g.beginPath(); g.ellipse(60, 35, 16, 11, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,210,170,.5)'; g.beginPath(); g.ellipse(62, 30, 8, 3.5, 0, 0, TAU); g.fill();
      // Rinnegan eyes
      for (const s of [-1, 1]) {
        g.fillStyle = '#d8ccf4'; g.beginPath(); g.arc(68, 40 + s * 11, 5, 0, TAU); g.fill(); g.strokeStyle = O; g.lineWidth = 1.5; g.stroke();
        g.strokeStyle = '#4a3480'; g.lineWidth = .9; g.beginPath(); g.arc(68, 40 + s * 11, 3, 0, TAU); g.stroke();
        g.fillStyle = '#2a1a50'; g.beginPath(); g.arc(68, 40 + s * 11, 1.1, 0, TAU); g.fill();
      }
    });
  }

  // ------------------------------------------------------------------ shared draw helpers
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,30,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,16,44,.4)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 1.8 : faint ? 2 : 3;
    ctx.stroke();
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
  function markLine(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.fillStyle = 'rgba(24,12,30,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
    ctx.strokeStyle = 'rgba(30,16,44,.4)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  const EL = new Float32Array(120), ER = new Float32Array(120);
  function markPath(ctx, path, w, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2, p = path.p, n = Math.min(60, path.n);
    const step = (path.n - 1) / (n - 1);
    for (let j = 0; j < n; j++) {
      const i = Math.min(path.n - 1, Math.round(j * step)), i0 = Math.max(0, i - 1), i1 = Math.min(path.n - 1, i + 1);
      const dx = p[i1 * 2] - p[i0 * 2], dy = p[i1 * 2 + 1] - p[i0 * 2 + 1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
      EL[j * 2] = p[i * 2] + nx; EL[j * 2 + 1] = p[i * 2 + 1] + ny; ER[j * 2] = p[i * 2] - nx; ER[j * 2 + 1] = p[i * 2 + 1] - ny;
    }
    const band = (upto, fill) => {
      const m = Math.max(2, Math.round(upto * (n - 1)) + 1);
      ctx.beginPath(); ctx.moveTo(EL[0], EL[1]);
      for (let j = 1; j < m; j++) ctx.lineTo(EL[j * 2], EL[j * 2 + 1]);
      for (let j = m - 1; j >= 0; j--) ctx.lineTo(ER[j * 2], ER[j * 2 + 1]);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    };
    band(1, 'rgba(24,12,30,.16)');
    band(clamp01(k), `rgba(${rgb},${.14 + .16 * k})`);
    ctx.lineJoin = 'round';
    for (const [E, under] of [[EL, true], [ER, true], [EL, false], [ER, false]]) {
      ctx.beginPath(); ctx.moveTo(E[0], E[1]);
      for (let j = 1; j < n; j++) ctx.lineTo(E[j * 2], E[j * 2 + 1]);
      ctx.strokeStyle = under ? 'rgba(30,16,44,.4)' : `rgba(${rgb},${pulse})`; ctx.lineWidth = under ? 5 : 2.5; ctx.stroke();
    }
    // chevrons racing along the path
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 50 + (time * 300) % 130; d < path.len - 30; d += 130) {
      pathAt(path, d, PA);
      const c = Math.cos(PA.a), s = Math.sin(PA.a), h = w * .45;
      ctx.moveTo(PA.x - c * 16 - s * h, PA.y - s * 16 + c * h); ctx.lineTo(PA.x, PA.y); ctx.lineTo(PA.x - c * 16 + s * h, PA.y - s * 16 - c * h);
    }
    ctx.stroke();
  }
  // Radial ground cracks (ground perspective).
  function cracks(ctx, x, y, r, n, seed, alpha, w = 2.5) {
    if (alpha <= .01 || r < 4) return;
    ctx.strokeStyle = `rgba(28,18,22,${.7 * alpha})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      // jagged fissure: five kinked steps out from the centre plus one side branch
      const a = i * TAU / n + hash(i * 4.7 + seed) * .5, l = r * (.55 + hash(i * 9.1 + seed) * .45);
      let px = x + Math.cos(a) * r * .12, py = y + Math.sin(a) * r * .06;
      ctx.moveTo(px, py);
      for (let k = 1; k <= 5; k++) {
        const b = a + (hash(i * 3 + k * 1.7 + seed) - .5) * .5, d = l * k / 5;
        const nx = x + Math.cos(b) * d, ny = y + Math.sin(b) * d * .5;
        ctx.lineTo(nx, ny);
        if (k === 2) { const c = a + (hash(i + seed) > .5 ? .7 : -.7); ctx.lineTo(nx + Math.cos(c) * l * .22, ny + Math.sin(c) * l * .11); ctx.moveTo(nx, ny); }
        px = nx; py = ny;
      }
    }
    ctx.stroke();
  }
  // Crater with a raised rim (ground).
  function crater(ctx, x, y, r, alpha, seed) {
    if (alpha <= .01) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6a5848'; ctx.beginPath(); ctx.ellipse(x, y, r * .9, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c221e'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .7, r * .34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,150,.35)'; ctx.beginPath(); ctx.ellipse(x, y - r * .36, r * .7, r * .08, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    cracks(ctx, x, y, r * 1.35, 9, seed, alpha, 3);
  }
  // A ring of rolling dust puffs.
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10) {
    if (alpha <= .01) return;
    const K = Kit(), dust = K.puff('dust');
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  // Black chakra receiver: a rod with a flat disc head (local +x from base to tip).
  function rod(ctx, x, y, ang, len, w, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(160,130,230,.5)'; ctx.fillRect(-1, -w / 2 - 1.5, len + 2, w + 3);
    ctx.fillStyle = '#0c0a12'; ctx.fillRect(0, -w / 2, len, w);
    ctx.fillStyle = '#0c0a12'; ctx.beginPath(); ctx.ellipse(len, 0, w * .55, w * 1.1, 0, 0, TAU); ctx.fill();
    for (const d of [len * .3, len * .62]) ctx.fillRect(d, -w * .8, w * .5, w * 1.6);
    ctx.fillStyle = 'rgba(170,160,210,.75)'; ctx.fillRect(1, -w / 2 + .6, len - 2, Math.max(.8, w * .18));
    ctx.restore();
  }

  // ------------------------------------------------------------------ Shinra Tensei
  function shinraG(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.R, e = easeOut(t / .55), fade = 1 - win(t, 1.4, fx.dur);
    // the ground pressed flat and scoured in a circle round him
    ctx.fillStyle = `rgba(58,40,66,${.3 * fade})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * .62 * e, R * .31 * e, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(34,22,30,${.32 * fade})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * .3 * e, R * .15 * e, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, R * 1.05 * e, 16, fx.seed, fade, 2.6);
    if (t < 1.1) K.fx.shockRing(ctx, fx.x, fx.y, R * 1.15, t / 1.1, 1 - t / 1.1, '205,170,255');
    if (t > .08 && t < 1.2) K.fx.shockRing(ctx, fx.x, fx.y, R * .85, (t - .08) / 1.1, (1.2 - t) * .8, '255,255,255');
    if (t > .2 && t < 1.5) K.fx.shockRing(ctx, fx.x, fx.y, R * 1.45, (t - .2) / 1.3, (1.5 - t) * .55, '170,130,255');
    // a wall of dust shoved outward by the front of the force
    dustRing(ctx, fx.x, fx.y, R * (.22 + e * .95), 24, 22 + e * 34, .8 * (1 - win(t, .45, 1.9)), fx.seed, 6 + t * 14);
  }
  function shinraO(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.R, x = fx.x, y = fx.y, r = R * (.1 + .9 * easeOut(t / .32)), a = 1 - win(t, .25, 1.0);
    ctx.globalCompositeOperation = 'lighter';
    if (t < .22) K.glow(ctx, x, y - 50, 200 + t * 1500, '255,245,255', 1 - t / .22, true);
    ctx.globalCompositeOperation = 'source-over';
    if (a > 0) {
      // the sphere of repulsion: a clear dome with a bright skin and meridians
      const H = r * .72;
      ctx.fillStyle = `rgba(150,110,240,${.12 * a})`;
      ctx.beginPath(); ctx.ellipse(x, y, r, H, 0, Math.PI, TAU); ctx.ellipse(x, y, r, r * .5, 0, 0, Math.PI); ctx.fill();
      ctx.lineWidth = 12; ctx.strokeStyle = `rgba(70,36,140,${.45 * a})`;
      ctx.beginPath(); ctx.ellipse(x, y, r, H, 0, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y - H * .4, r * 1.05, '170,120,255', .35 * a, false, .75);
      ctx.strokeStyle = `rgba(245,235,255,${.9 * a})`; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(x, y, r, H, 0, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(215,190,255,${.55 * a})`;
      for (const k of [.62, .25]) { ctx.beginPath(); ctx.ellipse(x, y, r * k, H, 0, Math.PI, TAU); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(x, y - H * .55, r * .84, r * .2, 0, 0, TAU); ctx.stroke();
      // streaks of displaced air flung outward
      ctx.strokeStyle = `rgba(240,230,255,${.75 * a})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 28; i++) {
        const an = i * TAU / 28 + hash(i * 1.7 + fx.seed) * .2, r1 = r * (.8 + hash(i * 3 + fx.seed) * .2), r2 = r1 + 40 + hash(i * 5 + fx.seed) * 90;
        ctx.moveTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1 * .5 - 20); ctx.lineTo(x + Math.cos(an) * r2, y + Math.sin(an) * r2 * .5 - 20);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // rocks, earth and dust torn up and thrown out
    if (t < 1.6) {
      K.fx.debris(ctx, x, y, R * 1.1, t / 1.4, fx.seed, '#3b3040', 20);
      const fl = easeOut(t * 1.2);
      for (let i = 0; i < 16; i++) {
        const an = i * TAU / 16 + hash(fx.seed + i), d = R * (.12 + fl * (.8 + hash(i * 2.2) * .35)), h = bell(t * 1.1) * (50 + hash(i * 5) * 110);
        drawRock(ctx, i, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - h, 9 + hash(i * 7.7) * 11, t * 8 + i, 1 - win(t, 1.0, 1.6));
      }
    }
  }

  // ------------------------------------------------------------------ black receivers rain
  function rodsG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const s of fx.spots) {
      const t = fx.age - s.t;
      if (t < 0) { markCircle(ctx, s.x, s.y, 60, '200,170,255', fx.age / s.t, time, true, true); continue; }
      ctx.fillStyle = `rgba(24,14,30,${.5 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 20, 9, 0, 0, TAU); ctx.fill();
      cracks(ctx, s.x, s.y, 70, 6, s.seed, fade * (t < .2 ? t / .2 : 1), 2);
      if (t < .5) K.fx.shockRing(ctx, s.x, s.y, 110, t / .5, 1 - t / .5, '200,160,255');
      // the planted receivers pulse chakra into the ground
      const pt = fx.age - fx.last - .7;
      if (pt > 0 && fx.pulses > 0) {
        const ph = frac(pt / .7);
        ctx.strokeStyle = `rgba(80,40,160,${.5 * (1 - ph) * fade})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, 18 + ph * 60, (18 + ph * 60) * .5, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(230,215,255,${.75 * (1 - ph) * fade})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }
  function rodsO(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .6, fx.dur), smoke = K.puff('dust');
    const fallA = -1.15;
    for (const s of fx.spots) {
      const t = fx.age - s.t;
      if (t < -.32) continue;
      if (t < 0) {
        // streaking down out of the sky
        const u = 1 + t / .32, h = 640 * (1 - u), x = s.x + Math.cos(fallA) * -h * .35, y = s.y - h;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(40,20,70,.45)'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30, y - 120); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(210,190,255,.7)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        rod(ctx, x, y, -Math.PI / 2 - .24, 92, 7);
        continue;
      }
      // planted, leaning; sunk into the ground
      const ang = -Math.PI / 2 + s.lean, a = fade;
      rod(ctx, s.x, s.y + 4, ang, 86, 7, a);
      if (t < .35) {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, s.x, s.y - 10, 58, '210,170,255', .85 * (1 - t / .35), true, .7);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (t < .9) {
        K.fx.debris(ctx, s.x, s.y, 70, t / .9, s.seed, '#2c2234', 7);
        for (let i = 0; i < 3; i++) K.stamp(ctx, smoke, s.x + (i - 1) * 16, s.y - 6 - t * 30, 12 + t * 26, (1 - t / .9) * .7, .75);
      }
    }
    // when they pulse: chakra arcs jumping between neighbouring receivers
    const pt = fx.age - fx.last - .7;
    if (pt > 0 && fx.pulses > 0 && fade > 0) {
      const ph = frac(pt / .7);
      if (ph < .35) {
        ctx.globalCompositeOperation = 'lighter';
        const sp = fx.spots;
        for (let i = 0; i < 7; i++) {
          const A = sp[(i * 3) % sp.length], B = sp[(i * 3 + 5) % sp.length];
          K.forkedBolt(ctx, A.x, A.y - 50, B.x, B.y - 50, fx.seed + i * 7, time, { jitter: 18, alpha: (1 - ph / .35) * fade, width: 1.4, pal: ['150,100,255', '200,170,255', '250,245,255'], base: 'rgba(50,20,100,.5)', step: 22, forks: 1, forkLen: 30, rate: 24, snap: true });
        }
        for (const s of sp) K.glow(ctx, s.x, s.y - 40, 40, '190,150,255', (1 - ph / .35) * .6 * fade);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  // ------------------------------------------------------------------ Animal Path: rhinos
  function rhinoG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    for (const l of fx.lanes) {
      const c = Math.cos(l.a), s = Math.sin(l.a), u = fx.age - l.t0;
      // summoning seal under the smoke
      const sa = 1 - win(fx.age, l.t0 + .2, l.t0 + .8);
      if (sa > 0) seal(ctx, l.x0, l.y0, 70, sa, time, fx.seed);
      if (u <= 0) continue;
      const d = Math.min(RHINO_LEN, u * RHINO_SPEED);
      // the furrow it ploughs, with cracks fanning off the edges
      ctx.save(); ctx.translate(l.x0, l.y0); ctx.rotate(l.a);
      ctx.fillStyle = `rgba(60,44,34,${.32 * fade})`; ctx.fillRect(0, -34, d, 68);
      ctx.fillStyle = `rgba(36,26,22,${.35 * fade})`; ctx.fillRect(0, -14, d, 28);
      ctx.strokeStyle = `rgba(30,20,18,${.6 * fade})`; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let k = 60; k < d; k += 70) {
        const side = (k / 70) % 2 ? 1 : -1, j = hash(k + fx.seed) * 30;
        ctx.moveTo(k, side * 30); ctx.lineTo(k + 18 + j * .3, side * (50 + j)); ctx.lineTo(k + 34, side * (58 + j));
      }
      ctx.stroke();
      ctx.restore();
      void c; void s;
    }
  }
  function rhinoO(ctx, fx, time) {
    const K = Kit(), dust = K.puff('dust'), smoke = K.puff('poof');
    // summoning smoke billowing at the start (under the beasts bursting out of it)
    for (const l of fx.lanes) { const u = fx.age - l.t0 + .3; if (u > 0 && u < 1.1) K.fx.smokePoof(ctx, l.x0, l.y0 + 10, 150, u / 1.1); }
    for (const l of fx.lanes) {
      const c = Math.cos(l.a), s = Math.sin(l.a);
      const ut = fx.age - l.t0;
      if (ut <= 0) continue;
      const travel = RHINO_LEN / RHINO_SPEED, d = Math.min(RHINO_LEN, ut * RHINO_SPEED);
      const x = l.x0 + c * d, y = l.y0 + s * d;
      // dust plume trailing behind
      for (let i = 1; i <= 9; i++) {
        const back = i * 36, dd = d - back;
        if (dd < 0) break;
        const age = back / RHINO_SPEED + Math.max(0, ut - travel);
        K.stamp(ctx, dust, l.x0 + c * dd + (hash(i + l.a) - .5) * 30, l.y0 + s * dd - 14 - age * 60, 26 + age * 70, Math.max(0, .75 - age * 1.1), .8);
      }
      if (ut < travel + .05) {
        const f = c >= 0 ? 1 : -1, bob = Math.abs(Math.sin(ut * 22)) * 6, frame = Math.floor(ut * 14) % 2;
        const S = Spr();
        if (S) S.shadow(ctx, x, y + 2, 70);
        ctx.save(); ctx.translate(x, y - bob); ctx.scale(f, 1);
        ctx.drawImage(rhinoSpr(frame), -150, -160);
        ctx.restore();
        // shock at the horn
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x + c * 90, y - 50, 60, '255,235,200', .45, false, .8);
        ctx.globalCompositeOperation = 'source-over';
        if (frame) K.fx.debris(ctx, x + c * 80, y, 80, frac(ut * 7), l.a * 9, '#3a2c22', 6);
      } else {
        // it vanishes back where it came from in a puff
        const v = (ut - travel) / .8;
        if (v < 1) K.fx.smokePoof(ctx, l.x0 + c * RHINO_LEN, l.y0 + s * RHINO_LEN, 150, v);
      }
    }
    void smoke;
  }
  // Black summoning formula spreading over the ground.
  function seal(ctx, x, y, r, a, time, seed) {
    if (a <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#120c14'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const an = i * TAU / 14 + hash(i + seed) * .2, l = r * (.8 + hash(i * 3 + seed) * .7);
      ctx.moveTo(Math.cos(an) * r * .3, Math.sin(an) * r * .3); ctx.lineTo(Math.cos(an) * l, Math.sin(an) * l);
      // little "kanji" ticks along each ray
      for (let k = .5; k < 1; k += .2) {
        const px = Math.cos(an) * l * k, py = Math.sin(an) * l * k, pa = an + Math.PI / 2;
        ctx.moveTo(px - Math.cos(pa) * 5, py - Math.sin(pa) * 5); ctx.lineTo(px + Math.cos(pa) * 5, py + Math.sin(pa) * 5);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ------------------------------------------------------------------ Banshō Ten'in combo
  function banshoO(ctx, fx, time, z) {
    const K = Kit(), t = fx.age;
    // the pull: a streak and afterimages from where the target stood
    if (t < .4) {
      const a = 1 - t / .4, L = LIFT();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(60,30,120,${.45 * a})`; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(fx.px, fx.py - L); ctx.lineTo(fx.x, fx.y - L); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(230,215,255,${.85 * a})`; ctx.lineWidth = 4; ctx.stroke();
      K.glow(ctx, fx.px, fx.py - L, 80, '190,150,255', a * .8, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the receiver thrust out of his palm
    if (fx.ra != null) {
      const tt = t - .58;
      if (tt >= 0 && tt < .5) {
        const ext = tt < .08 ? easeOut(tt / .08) : tt < .32 ? 1 : 1 - easeIn((tt - .32) / .18);
        const zx = z ? z.x : fx.x, zy = z ? z.y : fx.y, L = LIFT(), c = Math.cos(fx.ra), s = Math.sin(fx.ra);
        rod(ctx, zx + c * 14, zy - L - 6 + s * 8, fx.ra, 300 * ext, 10);
        if (tt < .2) {
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, zx + c * 300 * ext, zy - L - 6 + s * 300 * ext, 60, '220,190,255', 1 - tt / .2, true);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
  }
  // Smaller Shinra Tensei (combo finisher and Gakidō release).
  function miniG(ctx, fx, time) {
    const K = Kit(), t = fx.age;
    if (t < .9) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.2, t / .9, 1 - t / .9, fx.violet ? '170,120,255' : '210,180,255');
    if (t > .06 && t < .9) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * .9, (t - .06) / .84, (.9 - t), '255,255,255');
    cracks(ctx, fx.x, fx.y, fx.R * easeOut(t / .4), 10, fx.seed, 1 - win(t, .8, fx.dur), 2.2);
    dustRing(ctx, fx.x, fx.y, fx.R * (.3 + easeOut(t / .6) * .8), 14, 18 + t * 30, .75 * (1 - win(t, .3, 1.2)), fx.seed, 6 + t * 16);
  }
  function miniO(ctx, fx, time) {
    const K = Kit(), t = fx.age, r = fx.R * (.15 + .85 * easeOut(t / .25)), a = 1 - win(t, .2, .7);
    if (a <= 0) { if (t < 1.1) K.fx.debris(ctx, fx.x, fx.y, fx.R, t / 1.1, fx.seed, '#3b3040', 10); return; }
    const H = r * .7;
    ctx.lineWidth = 9; ctx.strokeStyle = `rgba(70,36,140,${.45 * a})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, H, 0, Math.PI, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    if (t < .15) K.glow(ctx, fx.x, fx.y - 40, 140 + t * 900, '250,240,255', 1 - t / .15, true);
    K.glow(ctx, fx.x, fx.y - H * .4, r, '170,120,255', .3 * a, false, .75);
    ctx.strokeStyle = `rgba(245,235,255,${.9 * a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, H, 0, Math.PI, TAU); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(215,190,255,${.55 * a})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r * .5, H, 0, Math.PI, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    K.fx.debris(ctx, fx.x, fx.y, fx.R, t / 1.1, fx.seed, '#3b3040', 10);
  }

  // ------------------------------------------------------------------ Fūton wind dragon
  const BODY_X = new Float32Array(80), BODY_Y = new Float32Array(80), BODY_W = new Float32Array(80);
  function dragonHead(fx) { return Math.min(fx.path.len, Math.max(0, (fx.age - .1) * DRAGON_SPEED)); }
  function futonG(ctx, fx, time) {
    const K = Kit(), hd = dragonHead(fx), fade = 1 - win(fx.age, fx.dur - .6, fx.dur), dust = K.puff('dust');
    // a scoured trail of flattened ground and dust lifted where it passed
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(70,80,64,${.22 * fade})`; ctx.lineWidth = 110;
    ctx.beginPath();
    for (let d = 0; d <= hd; d += 30) { pathAt(fx.path, d, PA); if (d) ctx.lineTo(PA.x, PA.y); else ctx.moveTo(PA.x, PA.y); }
    ctx.stroke();
    ctx.strokeStyle = `rgba(40,50,40,${.3 * fade})`; ctx.lineWidth = 2.2;
    for (const off of [-34, 34]) {
      ctx.beginPath();
      for (let d = 0; d <= hd; d += 30) {
        pathAt(fx.path, d, PA);
        const nx = -Math.sin(PA.a) * off, ny = Math.cos(PA.a) * off;
        if (d) ctx.lineTo(PA.x + nx, PA.y + ny); else ctx.moveTo(PA.x + nx, PA.y + ny);
      }
      ctx.stroke();
    }
    // shadow of the dragon's body
    for (let d = Math.max(0, hd - DRAGON_BODY); d <= hd; d += 40) {
      pathAt(fx.path, d, PA);
      const w = 30 + 20 * Math.sin(Math.PI * (d - hd + DRAGON_BODY) / DRAGON_BODY);
      ctx.fillStyle = `rgba(20,40,36,${.16 * fade})`; ctx.beginPath(); ctx.ellipse(PA.x, PA.y, w, w * .45, 0, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 10; i++) {
      const d = hd - i * 55;
      if (d < 0) break;
      pathAt(fx.path, d, PA);
      const age = i * 55 / DRAGON_SPEED + Math.max(0, fx.age - .1 - fx.path.len / DRAGON_SPEED);
      K.stamp(ctx, dust, PA.x + (hash(i + fx.seed) - .5) * 60, PA.y - 8 - age * 40, 20 + age * 60, Math.max(0, .6 - age * .9) * fade, .75);
    }
    // the vortex where it ends
    const te = fx.age - .1 - fx.path.len / DRAGON_SPEED;
    if (te > 0) {
      if (te < 1) K.fx.shockRing(ctx, fx.ex, fx.ey, 300, te, 1 - te, '200,250,235');
      cracks(ctx, fx.ex, fx.ey, 240, 10, fx.seed, 1 - win(te, 1, 1.8), 2.4);
      dustRing(ctx, fx.ex, fx.ey, 120 + easeOut(te) * 140, 16, 26 + te * 30, .7 * (1 - win(te, .5, 1.7)), fx.seed);
    }
  }
  function futonO(ctx, fx, time) {
    const K = Kit(), hd = dragonHead(fx), te = fx.age - .1 - fx.path.len / DRAGON_SPEED;
    const vanish = te > 0 ? clamp01(te / .45) : 0, alpha = 1 - vanish;
    if (alpha > 0) {
      // sample the body from tail to head; it flies low with a gentle undulation
      const tail = Math.max(0, hd - DRAGON_BODY * (1 - vanish * .2));
      let n = 0;
      for (let d = tail; d <= hd && n < 40; d += 18, n++) {
        pathAt(fx.path, d, PA);
        const u = (d - (hd - DRAGON_BODY)) / DRAGON_BODY;
        BODY_X[n] = PA.x; BODY_Y[n] = PA.y - 58 - Math.sin(d * .018 - time * 6) * 12 - 10 * u;
        BODY_W[n] = 8 + 34 * Math.pow(clamp01(u), .7);
      }
      if (n >= 2) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const strokeBody = (wk, add, style) => {
          for (let i = 1; i < n; i++) {
            ctx.strokeStyle = style; ctx.lineWidth = BODY_W[i] * wk + add;
            ctx.beginPath(); ctx.moveTo(BODY_X[i - 1], BODY_Y[i - 1]); ctx.lineTo(BODY_X[i], BODY_Y[i]); ctx.stroke();
          }
        };
        // translucent body of compressed air with a dark under-edge so it reads on sand
        strokeBody(2, 10, `rgba(20,58,56,${.32 * alpha})`);
        strokeBody(2, 0, `rgba(178,226,212,${.34 * alpha})`);
        ctx.globalCompositeOperation = 'lighter';
        strokeBody(.9, 0, `rgba(170,240,220,${.22 * alpha})`);
        ctx.globalCompositeOperation = 'source-over';
        // twisting wind strands braided along the body
        for (let j = 0; j < 6; j++) {
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
            const dx = BODY_X[i1] - BODY_X[i0], dy = BODY_Y[i1] - BODY_Y[i0], L = Math.hypot(dx, dy) || 1;
            const o = Math.sin(i * .55 - time * 13 + j * 1.05) * BODY_W[i] * .9;
            const x = BODY_X[i] - dy / L * o, y = BODY_Y[i] + dx / L * o;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.strokeStyle = `rgba(18,56,54,${.42 * alpha})`; ctx.lineWidth = 3.6; ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${(j % 2 ? .65 : .95) * alpha})`; ctx.lineWidth = j % 2 ? 1.1 : 1.7; ctx.stroke();
        }
        // spiralling bands wrapped round the body
        for (let i = 3; i < n; i += 3) {
          const dx = BODY_X[i] - BODY_X[i - 1], dy = BODY_Y[i] - BODY_Y[i - 1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          const w = BODY_W[i] * 1.15, ph = Math.sin(time * 14 + i * .9);
          const x0 = BODY_X[i] - nx * w + dx / L * 10 * ph, y0 = BODY_Y[i] - ny * w + dy / L * 10 * ph;
          const x1 = BODY_X[i] + nx * w - dx / L * 10 * ph, y1 = BODY_Y[i] + ny * w - dy / L * 10 * ph;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(BODY_X[i] + dx / L * 18, BODY_Y[i] + dy / L * 18, x1, y1);
          ctx.strokeStyle = `rgba(18,56,54,${.4 * alpha})`; ctx.lineWidth = 3.6; ctx.stroke();
          ctx.strokeStyle = `rgba(235,255,250,${.75 * alpha})`; ctx.lineWidth = 1.4; ctx.stroke();
        }
        // dust and leaves caught in the current
        const dust = K.puff('dust');
        for (let i = 0; i < 8; i++) {
          const k = Math.floor(frac(hash(i * 5.3) + time * .7) * (n - 1));
          K.stamp(ctx, dust, BODY_X[k] + (hash(i * 2.2) - .5) * BODY_W[k] * 2, BODY_Y[k] + (hash(i * 4.4) - .5) * BODY_W[k], 10 + BODY_W[k] * .4, .45 * alpha, .8);
        }
        // the head with horns, open jaws, glowing eyes and long whiskers
        pathAt(fx.path, hd, PB);
        dragonHeadDraw(ctx, BODY_X[n - 1], BODY_Y[n - 1], PB.a, 84, alpha, time);
        // speed lines
        ctx.strokeStyle = `rgba(255,255,255,${.6 * alpha})`; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const k = Math.floor(hash(i * 3.3) * (n - 1)), off = (hash(i * 7.7) - .5) * 120;
          const dx = Math.cos(PB.a), dy = Math.sin(PB.a), x = BODY_X[k] - dy * off, y = BODY_Y[k] + dx * off * .6;
          ctx.moveTo(x, y); ctx.lineTo(x - dx * 70, y - dy * 70);
        }
        ctx.stroke();
      }
    }
    // the dragon bursts into a whirling vortex at the end of its path
    if (te > 0 && te < 1.6) tornado(ctx, fx.ex, fx.ey, 230 * (1 - win(te, 1.1, 1.6) * .3), te, time, fx.seed);
  }
  function dragonHeadDraw(ctx, x, y, ang, s, alpha, time) {
    const K = Kit();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (Math.cos(ang) < 0) ctx.scale(1, -1);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const jaw = Math.sin(time * 9) * .08 + .22;
    // whiskers
    ctx.strokeStyle = 'rgba(24,64,62,.5)'; ctx.lineWidth = 4;
    ctx.beginPath();
    for (const sd of [-1, 1]) { ctx.moveTo(s * .7, sd * s * .08); ctx.bezierCurveTo(s * .2, sd * s * .7, -s * .6, sd * s * (.3 + Math.sin(time * 5 + sd) * .2), -s * 1.4, sd * s * .55); }
    ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.6; ctx.stroke();
    // horns
    ctx.fillStyle = 'rgba(200,240,228,.7)'; ctx.strokeStyle = 'rgba(20,56,54,.8)'; ctx.lineWidth = 2.5;
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * .05, sd * s * .18); ctx.quadraticCurveTo(-s * .5, sd * s * .55, -s * .95, sd * s * .48); ctx.quadraticCurveTo(-s * .45, sd * s * .32, -s * .05, sd * s * .05); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // upper skull/snout and lower jaw
    ctx.fillStyle = 'rgba(214,248,238,.82)';
    ctx.beginPath(); ctx.moveTo(-s * .25, -s * .28); ctx.quadraticCurveTo(s * .4, -s * .4, s * 1.05, -s * .12); ctx.lineTo(s * .95, -s * .02); ctx.lineTo(s * .35, -s * .02 + s * jaw * .2); ctx.quadraticCurveTo(0, s * .1, -s * .25, s * .12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * .15, s * .14); ctx.lineTo(s * .35, s * jaw * .5 + s * .04); ctx.lineTo(s * .9, s * jaw); ctx.quadraticCurveTo(s * .5, s * (jaw + .2), -s * .15, s * .3); ctx.closePath(); ctx.fill(); ctx.stroke();
    // fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(s * .82, -s * .04); ctx.lineTo(s * .78, s * .1); ctx.lineTo(s * .72, -s * .03); ctx.moveTo(s * .7, s * jaw * .85); ctx.lineTo(s * .66, s * jaw * .85 - s * .12); ctx.lineTo(s * .6, s * jaw * .8); ctx.fill();
    // brow ridge and eye
    ctx.strokeStyle = 'rgba(20,56,54,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s * .1, -s * .22); ctx.quadraticCurveTo(s * .3, -s * .32, s * .52, -s * .2); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, s * .34, -s * .16, s * .3, '200,255,240', .9, true);
    K.glow(ctx, s * .2, 0, s * 1.1, '180,250,230', .35);
    ctx.restore();
  }
  // Whirling funnel of wind and dust.
  function tornado(ctx, x, y, R, t, time, seed) {
    const K = Kit(), a = bell(t / 1.6) * 1.2, H = R * 1.5;
    if (a <= .01) return;
    const dust = K.puff('dust');
    for (let i = 0; i < 8; i++) {
      const k = i / 8, an = time * 9 + i * 1.3, rr = R * (.3 + k * .75);
      K.stamp(ctx, dust, x + Math.cos(an) * rr * .9, y - k * H + Math.sin(an) * rr * .25, R * (.18 + k * .14), .55 * Math.min(1, a), .75);
    }
    ctx.lineCap = 'round';
    for (const [style, w] of [[`rgba(30,70,64,${.45 * Math.min(1, a)})`, 5], [`rgba(255,255,255,${.85 * Math.min(1, a)})`, 1.8]]) {
      ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const k = i / 9, rr = R * (.18 + k * .8), yy = y - k * H, a0 = time * (10 - k * 4) + i * 1.9;
        ctx.moveTo(x + Math.cos(a0) * rr, yy + Math.sin(a0) * rr * .28); ctx.ellipse(x, yy, rr, rr * .28, 0, a0, a0 + 2.3);
      }
      ctx.stroke();
    }
    K.fx.debris(ctx, x, y, R, frac(t * .9), seed, '#3a2c22', 10);
  }

  // ------------------------------------------------------------------ Gakidō
  function gakidoG(ctx, fx, time, z) {
    if (!z) return;
    const a = Math.min(1, fx.age / .2) * (1 - win(fx.age, fx.dur - .2, fx.dur));
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5); ctx.rotate(time * .9);
    ctx.strokeStyle = `rgba(40,20,80,${.5 * a})`; ctx.lineWidth = 6;
    ctx.setLineDash([18, 10]); ctx.beginPath(); ctx.arc(0, 0, 96, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(215,195,255,${.85 * a})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.stroke();
    // seal glyphs round the ring
    ctx.lineWidth = 2.4; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const an = i * TAU / 12; ctx.moveTo(Math.cos(an) * 74, Math.sin(an) * 74); ctx.lineTo(Math.cos(an) * 92, Math.sin(an) * 92); }
    ctx.stroke();
    ctx.restore();
  }
  function gakidoO(ctx, fx, time, z) {
    if (!z) return;
    const K = Kit(), st = z.ng, a = Math.min(1, fx.age / .2) * (1 - win(fx.age, fx.dur - .2, fx.dur)), ab = st ? st.absorb / .35 : 0;
    const cx = z.x, cy = z.y - 46, r = 76 + Math.sin(time * 6) * 2;
    ctx.fillStyle = `rgba(120,80,220,${(.13 + .12 * ab) * a})`;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * .95, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(40,20,90,${.5 * a})`; ctx.lineWidth = 6; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const sw = K.swirl('ng:gaki', ['rgba(255,255,255,.9)', 'rgba(190,150,255,.85)', 'rgba(120,80,230,.75)'], 6, 1.3, .1, 128, 3);
    K.spin(ctx, sw, cx, cy, r * .9, -time * 4, (.35 + .4 * ab) * a);
    K.glow(ctx, cx, cy, r * 1.25, '170,120,255', (.3 + .5 * ab) * a);
    ctx.strokeStyle = `rgba(240,230,255,${(.75 + .25 * ab) * a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * .95, 0, 0, TAU); ctx.stroke();
    // chakra being drunk in: streaks converging on his open palms
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    const n = 14 + Math.round(ab * 10);
    for (let i = 0; i < n; i++) {
      const an = hash(i * 3.1) * TAU, q = frac(time * (1.6 + ab * 2) + hash(i * 1.7)), d0 = r * 1.8 * (1 - q) + 10, d1 = d0 + 26;
      ctx.moveTo(cx + Math.cos(an) * d1, cy + Math.sin(an) * d1 * .8); ctx.lineTo(cx + Math.cos(an) * d0, cy + Math.sin(an) * d0 * .8);
    }
    ctx.strokeStyle = `rgba(225,205,255,${.8 * a})`; ctx.stroke();
    if (ab > 0) K.glow(ctx, cx, cy, 50, '255,240,255', ab * .8 * a, true);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ Animal Path: giant centipede
  const CP = { x: 0, y: 0, a: 0 }, CQ = { x: 0, y: 0, a: 0 };
  const centHeight = (s, L) => 36 + 150 * Math.pow(Math.sin(Math.PI * clamp01(s / L)), .8);
  function centHead(fx) { return (fx.age - fx.t0) * CENT_SPEED; }
  function holeG(ctx, x, y, r, a, seed) {
    if (a <= .01) return;
    ctx.fillStyle = `rgba(70,54,42,${.6 * a})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(14,8,6,${.85 * a})`; ctx.beginPath(); ctx.ellipse(x, y + 2, r * .66, r * .3, 0, 0, TAU); ctx.fill();
    cracks(ctx, x, y, r * 2, 9, seed, a, 2.6);
  }
  function centipedeG(ctx, fx, time) {
    const hd = centHead(fx), L = fx.path.len, fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    if (fx.age < fx.t0) return;
    holeG(ctx, fx.ax, fx.ay, 70, fade, fx.seed);
    if (hd > L - 40) holeG(ctx, fx.bx, fx.by, 74, fade * Math.min(1, (hd - L + 40) / 60), fx.seed + 3);
    // its shadow running along the ground
    for (let i = 0; i * CENT_GAP < CENT_BODY; i += 2) {
      const s = hd - i * CENT_GAP;
      if (s < 0 || s > L) continue;
      pathAt(fx.path, s, CP);
      ctx.fillStyle = 'rgba(20,12,10,.2)'; ctx.beginPath(); ctx.ellipse(CP.x, CP.y, 48, 21, 0, 0, TAU); ctx.fill();
    }
    // the second eruption under the target
    const up = fx.up;
    if (up) {
      const t = fx.age - up.t;
      if (t < .8) { markCircle(ctx, up.x, up.y, 150, '255,170,120', t / .8, time, false); cracks(ctx, up.x, up.y, 150 * easeOut(t / .8), 10, fx.seed + 5, t / .8, 2.4); }
      else { holeG(ctx, up.x, up.y, 80, fade, fx.seed + 7); if (t < 1.6) Kit().fx.shockRing(ctx, up.x, up.y, 260, (t - .8) / .8, 1.6 - t, '255,190,140'); }
    }
  }
  function centLegs(ctx, x, y, a, ph, len) {
    const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    for (const sd of [-1, 1]) {
      const sw = Math.sin(ph + (sd > 0 ? 0 : Math.PI)) * 9;
      ctx.moveTo(x + nx * sd * 20, y + ny * sd * 15);
      ctx.lineTo(x + nx * sd * (20 + len) + c * sw, y + ny * sd * (15 + len) + s * sw + 9);
      ctx.lineTo(x + nx * sd * (23 + len) + c * (sw - 9), y + ny * sd * (18 + len) + s * (sw - 9) + 22);
    }
  }
  function centipedeO(ctx, fx, time) {
    const K = Kit(), hd = centHead(fx), L = fx.path.len, seg = centSegSpr(), head = centHeadSpr();
    if (fx.age >= fx.t0) {
      // eruption at the start and the dive at the end
      const te = fx.age - fx.t0;
      if (te < 1.2) { K.fx.debris(ctx, fx.ax, fx.ay, 150, te / 1.2, fx.seed, '#3a2c22', 14); dustRing(ctx, fx.ax, fx.ay, 60 + te * 90, 10, 22 + te * 30, 1 - te / 1.2, fx.seed); }
      const td = fx.age - fx.tDive;
      if (td > 0 && td < 1.2) { K.fx.debris(ctx, fx.bx, fx.by, 160, td / 1.2, fx.seed + 2, '#3a2c22', 14); dustRing(ctx, fx.bx, fx.by, 60 + td * 90, 10, 22 + td * 30, 1 - td / 1.2, fx.seed + 2); }
      // body: tail first, so the head is on top
      const nSeg = Math.floor(CENT_BODY / CENT_GAP);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = nSeg; i >= 0; i--) {
        const s = hd - i * CENT_GAP;
        if (s < 0 || s > L) continue;
        pathAt(fx.path, s, CP);
        const h = centHeight(s, L), x = CP.x, y = CP.y - h;
        pathAt(fx.path, Math.min(L, s + 10), CQ);
        const h2 = centHeight(s + 10, L), ang = Math.atan2(CQ.y - h2 - y, CQ.x - x);
        // legs (orange, two pairs per segment)
        ctx.beginPath(); centLegs(ctx, x, y, ang, time * 26 + i * 1.1, 22);
        ctx.strokeStyle = '#1a0e0c'; ctx.lineWidth = 6.5; ctx.stroke();
        ctx.strokeStyle = '#d8762c'; ctx.lineWidth = 3.2; ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        if (i === 0) ctx.drawImage(head, -56 * CS, -40 * CS, 112 * CS, 80 * CS);
        else { const k = (1 - Math.max(0, i - nSeg + 5) * .1) * CS; ctx.drawImage(seg, -32 * k, -24 * k, 64 * k, 48 * k); }
        ctx.restore();
      }
    }
    // the second eruption: it bursts straight up out of the ground under the target
    const up = fx.up;
    if (up) {
      const t = fx.age - up.t - .8;
      if (t > 0 && t < 1.4) {
        const rise = t < .22 ? easeOut(t / .22) : t < .75 ? 1 : 1 - easeIn((t - .75) / .5), H = 300 * rise;
        K.fx.debris(ctx, up.x, up.y, 190, clamp01(t / 1.2), fx.seed + 9, '#3a2c22', 18);
        if (H > 10) {
          const n = Math.floor(H / 32);
          for (let i = n; i >= 0; i--) {
            const yy = up.y - i * 32, sway = Math.sin(time * 5 + i * .5) * (i * .9);
            ctx.beginPath(); centLegs(ctx, up.x + sway, yy, -Math.PI / 2, time * 26 + i, 20);
            ctx.strokeStyle = '#1a0e0c'; ctx.lineWidth = 6.5; ctx.stroke(); ctx.strokeStyle = '#d8762c'; ctx.lineWidth = 3.2; ctx.stroke();
            ctx.save(); ctx.translate(up.x + sway, yy); ctx.rotate(-Math.PI / 2 + Math.sin(time * 5 + i) * .1);
            if (i === n) ctx.drawImage(head, -56 * CS, -40 * CS, 112 * CS, 80 * CS); else ctx.drawImage(seg, -32 * CS, -24 * CS, 64 * CS, 48 * CS);
            ctx.restore();
          }
        }
        dustRing(ctx, up.x, up.y, 70 + t * 110, 14, 26 + t * 34, 1 - t / 1.4, fx.seed + 4);
        if (t < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, up.x, up.y - 40, 150, '255,190,140', 1 - t / .25, true, .8); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
  }

  // ------------------------------------------------------------------ Chibaku Tensei
  const CORE = { x: 0, y: 0, rs: 0 };
  function chibCore(fx, out) {
    const t = fx.age, T = fx.T;
    if (t < .55) {
      const u = easeOut(t / .55);
      out.x = lerp(fx.x0, fx.x, u); out.y = lerp(fx.y0 - 90, fx.y - CHIB_H, u) - bell(u) * 140; out.rs = 8;
    } else if (t < T - .3) {
      out.x = fx.x; out.y = fx.y - CHIB_H + Math.sin(t * 2.2) * 6; out.rs = 10 + (CHIB_RS - 10) * easeInOut(win(t, .55, T - .4));
    } else {
      const d = easeIn(win(t, T - .3, T));
      out.x = fx.x; out.y = lerp(fx.y - CHIB_H, fx.y - CHIB_RS * .42, d); out.rs = CHIB_RS;
    }
    return out;
  }
  // Each torn-up rock: where it leaves the ground, when, and where it lands on the planet's skin.
  const NROCK = 54;
  function rockInfo(fx, i, out) {
    const sd = fx.seed + i * 3.7, an = hash(sd) * TAU, d = fx.R * (.18 + .78 * Math.sqrt(hash(sd + 1.3)));
    out.gx = fx.x + Math.cos(an) * d; out.gy = fx.y + Math.sin(an) * d;
    out.t0 = .6 + hash(sd + 2.1) * (fx.T - 1.5); out.fl = .75 + hash(sd + 4.4) * .3;
    out.lon = hash(sd + 5.5) * TAU; out.lat = (hash(sd + 6.6) - .5) * 2.4; out.s = 11 + hash(sd + 7.7) * 15;
    return out;
  }
  const RI = { gx: 0, gy: 0, t0: 0, fl: 0, lon: 0, lat: 0, s: 0 };
  function chibakuG(ctx, fx, time) {
    const K = Kit(), t = fx.age, T = fx.T, R = fx.R;
    if (t < T) {
      const k = t / T;
      markCircle(ctx, fx.x, fx.y, R, '190,150,255', k * .6, time, true);
      markCircle(ctx, fx.x, fx.y, 300, '190,150,255', k, time, true);
      // the planet's shadow spreading as it grows
      chibCore(fx, CORE);
      const sh = CORE.rs * 1.2 + 20;
      ctx.fillStyle = `rgba(10,4,18,${.12 + .3 * win(t, .5, T)})`;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y, sh, sh * .45, 0, 0, TAU); ctx.fill();
      cracks(ctx, fx.x, fx.y, R * .95 * easeOut(win(t, .5, T)), 18, fx.seed, .6, 2);
      // holes left where the rocks tore loose
      for (let i = 0; i < NROCK; i += 2) {
        rockInfo(fx, i, RI);
        if (t < RI.t0) continue;
        ctx.fillStyle = 'rgba(28,18,16,.55)'; ctx.beginPath(); ctx.ellipse(RI.gx, RI.gy, RI.s * 1.3, RI.s * .6, 0, 0, TAU); ctx.fill();
      }
      // gravity ripples drawn inward
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(200,160,255,.35)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const ph = frac(time * .7 + i / 3), r = R * (1 - ph); ctx.moveTo(fx.x + r, fx.y); ctx.ellipse(fx.x, fx.y, r, r * .5, 0, 0, TAU); }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const u = t - T, fade = 1 - win(u, 2.8, fx.dur - T);
    crater(ctx, fx.x, fx.y, R * .78, fade, fx.seed);
    cracks(ctx, fx.x, fx.y, R * 1.3, 14, fx.seed + 1, fade, 3.5);
    if (u < 1.2) { K.fx.shockRing(ctx, fx.x, fx.y, R * 1.3, u / 1.2, 1 - u / 1.2, '200,160,255'); K.fx.shockRing(ctx, fx.x, fx.y, R * 1.75, u / 1.2, (1 - u / 1.2) * .6, '255,240,230'); }
    if (u > .1 && u < 1.4) K.fx.shockRing(ctx, fx.x, fx.y, R * .95, (u - .1) / 1.3, (1.4 - u) * .7, '255,255,255');
    dustRing(ctx, fx.x, fx.y, R * (.55 + easeOut(u / 1.6) * .65), 26, 40 + u * 40, .85 * (1 - win(u, 1, 3)), fx.seed, 10 + u * 20);
  }
  function chibakuO(ctx, fx, time) {
    const K = Kit(), t = fx.age, T = fx.T, R = fx.R;
    chibCore(fx, CORE);
    const cx = CORE.x, cy = CORE.y, rs = CORE.rs;
    if (t < T) {
      // dark gravity well round the core
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx, cy, 80 + rs * 1.8, '130,80,240', .45);
      ctx.globalCompositeOperation = 'source-over';
      if (t < .55) {
        // the core flung up from his palm
        ctx.strokeStyle = 'rgba(30,10,50,.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0 - 90); ctx.quadraticCurveTo((fx.x0 + cx) / 2, Math.min(fx.y0, cy) - 160, cx, cy); ctx.stroke();
      }
      // dust and grit streaming up into the core
      if (t > .55) {
        ctx.lineCap = 'round';
        for (const [style, w] of [['rgba(60,44,40,.4)', 4], ['rgba(200,180,160,.55)', 1.6]]) {
          ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
          for (let i = 0; i < 22; i++) {
            const ph = frac(time * .9 + hash(i * 2.1 + fx.seed)), an = hash(i * 4.7 + fx.seed) * TAU, d = R * (.25 + hash(i * 1.3) * .7);
            const gx = fx.x + Math.cos(an) * d, gy = fx.y + Math.sin(an) * d;
            const e1 = easeIn(ph), e2 = easeIn(Math.min(1, ph + .1));
            ctx.moveTo(lerp(gx, cx, e1), lerp(gy, cy, e1)); ctx.lineTo(lerp(gx, cx, e2), lerp(gy, cy, e2));
          }
          ctx.stroke();
        }
      }
      // rocks in flight / on the back half of the planet
      const front = [];
      for (let i = 0; i < NROCK; i++) {
        rockInfo(fx, i, RI);
        const k = (t - RI.t0) / RI.fl;
        if (k <= 0) continue;
        const lon = RI.lon + t * .9, lat = RI.lat, sr = rs * 1.02;
        const ox = cx + Math.cos(lat) * Math.sin(lon) * sr, oy = cy - Math.sin(lat) * sr * .95;
        const isFront = Math.cos(lon) > 0;
        if (k < 1) {
          const e = easeInOut(k);
          const x = lerp(RI.gx, ox, e), y = lerp(RI.gy, oy, e) - bell(k) * 60;
          drawRock(ctx, i, x, y, RI.s * (1 - k * .3), k * 7 + i);
          if (k < .3) K.stamp(ctx, K.puff('dust'), RI.gx, RI.gy - 10, RI.s * 2 + k * 40, (1 - k / .3) * .8, .75);
        } else if (isFront) front.push(i);
        else drawRock(ctx, i, ox, oy, RI.s * .7, i, .8);
      }
      // house chunks torn from the village spiralling in
      for (let i = 0; i < 6; i++) {
        const t0 = 1.0 + i * .28, k = (t - t0) / 1.3;
        if (k <= 0 || k >= 1) continue;
        const an = fx.seed + i * 1.05, d = R * (.55 + hash(i * 3.3) * .35) * (1 - easeIn(k)), spin = k * 4;
        const x = lerp(fx.x + Math.cos(an) * R * .7, cx, easeIn(k)) + Math.cos(an + spin) * d * .3;
        const y = lerp(fx.y + Math.sin(an) * R * .35, cy, easeIn(k)) - bell(k) * 80;
        houseChunk(ctx, x, y, 26 * (1 - k * .5), k * 6 + i, i);
      }
      // the planet itself and the black core within
      if (rs > 14) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .25);
        ctx.drawImage(planetSpr(), -rs, -rs, rs * 2, rs * 2);
        ctx.restore();
      }
      for (const i of front) {
        rockInfo(fx, i, RI);
        const lon = RI.lon + t * .9, sr = rs * 1.02;
        drawRock(ctx, i, cx + Math.cos(RI.lat) * Math.sin(lon) * sr, cy - Math.sin(RI.lat) * sr * .95, RI.s * .8, i);
      }
      if (rs < 70) {
        ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(cx, cy, 10 + Math.min(rs, 24) * .4, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(210,180,255,.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 13 + Math.min(rs, 24) * .4 + Math.sin(time * 20) * 1.5, 0, TAU); ctx.stroke();
        K.glow(ctx, cx, cy, 34, '220,190,255', .8, true);
        ctx.globalCompositeOperation = 'source-over';
      }
      // gravity rings tilted round the planet
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(40,16,80,.4)';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx, cy, rs * (1.2 + i * .14) + 8, (rs * (1.2 + i * .14) + 8) * .3, (i - 1) * .22 + Math.sin(time * .8 + i) * .08, 0, TAU); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(215,190,255,.6)';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx, cy, rs * (1.2 + i * .14) + 8, (rs * (1.2 + i * .14) + 8) * .3, (i - 1) * .22 + Math.sin(time * .8 + i) * .08, 0, TAU); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    // the planet slammed into the ground, half buried, then crumbling away
    const u = t - T, fade = 1 - win(u, 2.6, fx.dur - T);
    ctx.save(); ctx.globalAlpha = fade;
    ctx.beginPath(); ctx.rect(cx - rs * 1.3, cy - rs * 1.3, rs * 2.6, rs * 1.3 + rs * .5); ctx.clip();
    ctx.translate(cx, cy + win(u, 1.6, 3.4) * rs * .3); ctx.rotate(T * .25);
    ctx.drawImage(planetSpr(), -rs, -rs, rs * 2, rs * 2);
    ctx.restore();
    // crater lip in front of the buried planet
    ctx.strokeStyle = `rgba(60,46,36,${.95 * fade})`; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 2, rs * 1.05, rs * .3, 0, .15, Math.PI - .15); ctx.stroke();
    ctx.strokeStyle = `rgba(150,124,100,${.7 * fade})`; ctx.lineWidth = 4; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    if (u < .35) K.glow(ctx, fx.x, fx.y - 80, R * (1.2 + u * 3), '235,215,255', 1 - u / .35, true);
    ctx.globalCompositeOperation = 'source-over';
    if (u < 1.8) {
      K.fx.debris(ctx, fx.x, fx.y, R * 1.4, u / 1.8, fx.seed, '#3a2a22', 22);
      for (let i = 0; i < 14; i++) {
        const an = i * TAU / 14 + hash(fx.seed + i), d = R * (.3 + easeOut(u * 1.1) * (.7 + hash(i * 2.2) * .4)), h = bell(u / 1.4) * (80 + hash(i * 5) * 160);
        drawRock(ctx, i, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - h, 10 + hash(i * 7.7) * 12, u * 7 + i, 1 - win(u, 1.2, 1.8));
      }
    }
    // smoke and dust columns rising off the impact
    const smoke = K.puff('dust'), s = win(u, .1, 3.4);
    for (let i = 0; i < 9; i++) {
      const an = i * TAU / 9 + fx.seed;
      K.stamp(ctx, smoke, fx.x + Math.cos(an) * rs * 1.1, fx.y + Math.sin(an) * rs * .4 - 30 - s * 180 - hash(i) * 60, 50 + s * 70, bell(s) * .6 * fade, .8);
    }
  }
  function houseChunk(ctx, x, y, s, rot, i) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = ['#efe3c8', '#e8d7b4', '#dccaa6'][i % 3]; ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = 2;
    ctx.fillRect(-s, -s * .5, s * 2, s); ctx.strokeRect(-s, -s * .5, s * 2, s);
    ctx.fillStyle = ['#d6673c', '#3f8c84', '#4a6ea6', '#b9472f'][i % 4];
    ctx.beginPath(); ctx.moveTo(-s * 1.2, -s * .5); ctx.lineTo(0, -s * 1.2); ctx.lineTo(s * 1.2, -s * .5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3a2c'; ctx.fillRect(-s * .3, -s * .1, s * .5, s * .6);
    ctx.restore();
  }

  const FX = {
    shinra: [shinraG, shinraO], rods: [rodsG, rodsO], rhino: [rhinoG, rhinoO], bansho: [null, banshoO], mini: [miniG, miniO],
    futon: [futonG, futonO], gakido: [gakidoG, gakidoO], centipede: [centipedeG, centipedeO], chibaku: [chibakuG, chibakuO]
  };

  // ------------------------------------------------------------------ windup looks
  function eyePos(z, f) { const S = Spr(), h = S ? S.height('nagato') : 92; return { x: z.x + f * 6, y: z.y + 3 - h * .78 }; }
  function windupG(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, move = st.move;
    // Rinnegan ripples spreading over the ground from his feet
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5);
    for (let i = 0; i < 4; i++) {
      const ph = frac(time * 1.1 + i / 4), r = 20 + ph * (90 + 60 * k);
      ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(70,36,150,${(1 - ph) * .55})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = `rgba(230,215,255,${(1 - ph) * .7})`; ctx.stroke();
    }
    ctx.restore();
    if (move === 'rhino' || move === 'centipede') seal(ctx, z.x + Math.cos(st.aim) * 40, z.y + Math.sin(st.aim) * 20, 60 + 90 * easeOut(k), Math.min(1, k * 3), time, 3.3);
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, f = Math.cos(st.aim) >= 0 ? 1 : -1, L = LIFT();
    const hx = z.x + f * 20, hy = z.y - L - 8, ey = eyePos(z, f);
    ctx.globalCompositeOperation = 'lighter';
    // the Rinnegan flaring
    K.glow(ctx, ey.x - 2, ey.y, 10 + 6 * k, '200,170,255', .8, true);
    K.glow(ctx, z.x, z.y - 40, 50 + 40 * k, '150,100,255', .3);
    ctx.globalCompositeOperation = 'source-over';
    switch (move) {
      case 'shinra': {
        // the force gathering: rings closing in on him, dust trembling
        ctx.save(); ctx.translate(z.x, z.y - 40);
        for (let i = 0; i < 3; i++) {
          const ph = frac(time * 1.6 + i / 3), r = 160 * (1 - ph) + 20;
          ctx.lineWidth = 4; ctx.strokeStyle = `rgba(70,36,150,${ph * .5})`; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .75, 0, 0, TAU); ctx.stroke();
          ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(235,225,255,${ph * .8})`; ctx.stroke();
        }
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 30 + 30 * e, '230,210,255', .7, true); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'rods': {
        // receivers drawn out of his sleeves, fanning up above his head
        for (let i = 0; i < 6; i++) {
          const an = -Math.PI / 2 + (i - 2.5) * .3, r = 30 + 40 * e;
          rod(ctx, z.x + Math.cos(an) * r * .5, z.y - 70 + Math.sin(an) * r, an, 40 + 20 * e, 4, Math.min(1, k * 3));
        }
        break;
      }
      case 'bansho': {
        // gravity tether reaching from his palm to the target
        const p = { x: st.tx, y: st.ty - L * .6 };
        const ang = Math.atan2(p.y - hy, p.x - hx), nx = -Math.sin(ang), ny = Math.cos(ang);
        ctx.lineCap = 'round';
        for (let j = 0; j < 4; j++) {
          ctx.globalCompositeOperation = j === 3 ? 'lighter' : 'source-over';
          ctx.strokeStyle = j === 3 ? 'rgba(250,245,255,.9)' : 'rgba(90,50,190,.55)'; ctx.lineWidth = j === 3 ? 2.6 : 3;
          ctx.setLineDash([22, 14]); ctx.lineDashOffset = time * 260 + j * 9;
          ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const u = i / 16, w = Math.sin(u * 10 + time * 16 + j * 1.7) * 12 * Math.sin(Math.PI * u) * (j === 3 ? .5 : 1.3);
            const x = p.x + (hx - p.x) * u + nx * w, y = p.y + (hy - p.y) * u + ny * w;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, K.swirl('ng:bansho', ['rgba(255,255,255,.95)', 'rgba(190,150,255,.85)', 'rgba(120,80,230,.7)'], 5, 1.3, .1), p.x, p.y + L * .3, 60 + 20 * e, -time * 9, .7, .6);
        K.glow(ctx, hx, hy, 30, '230,210,255', .9, true);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'futon': {
        // air sucked in toward him, a ring of wind spinning up
        ctx.lineCap = 'round';
        for (const [style, w] of [['rgba(30,70,64,.45)', 4], ['rgba(255,255,255,.9)', 1.6]]) {
          ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const an = hash(i * 3.1) * TAU, q = frac(time * 1.8 + hash(i * 1.7)), d0 = 150 * (1 - q) + 20, d1 = d0 + 40;
            ctx.moveTo(hx + Math.cos(an) * d1, hy + Math.sin(an) * d1 * .7); ctx.lineTo(hx + Math.cos(an) * d0, hy + Math.sin(an) * d0 * .7);
          }
          for (let i = 0; i < 4; i++) { const r = 40 + i * 9 + 14 * k, a0 = time * (7 - i * .5) + i * 1.4, y = z.y - 10 - i * 14; ctx.moveTo(z.x + Math.cos(a0) * r, y + Math.sin(a0) * r * .3); ctx.ellipse(z.x, y, r, r * .3, 0, a0, a0 + 2.2); }
          ctx.stroke();
        }
        break;
      }
      case 'rhino': case 'centipede': {
        // smoke curling up off the summoning formula
        const smoke = K.puff('smoke'), sx = z.x + Math.cos(st.aim) * 40, sy = z.y + Math.sin(st.aim) * 20;
        for (let i = 0; i < 6; i++) { const ph = frac(time * 1.4 + i / 6); K.stamp(ctx, smoke, sx + Math.sin(i * 2.3 + time) * 40 * e, sy - ph * 70, 14 + 16 * ph, bell(ph) * .55 * Math.min(1, k * 2), .8); }
        break;
      }
      case 'chibaku': {
        // the black core forming in his raised palm
        const cx = z.x + f * 10, cy = z.y - 104;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, cx, cy, 40 + 50 * e, '150,100,255', .6);
        ctx.strokeStyle = 'rgba(220,200,255,.8)'; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const an = hash(i * 2.9) * TAU, q = frac(time * 2.2 + hash(i * 1.3)), d0 = 110 * (1 - q) + 12;
          ctx.moveTo(cx + Math.cos(an) * (d0 + 24), cy + Math.sin(an) * (d0 + 24)); ctx.lineTo(cx + Math.cos(an) * d0, cy + Math.sin(an) * d0);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(cx, cy, 4 + 8 * e, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(210,180,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 6 + 8 * e, 0, TAU); ctx.stroke();
        break;
      }
      case 'gakido': {
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, z.y - 46, 80 * e, '190,150,255', .6); ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }
  }

  function label(ctx, z, st, m) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (!move) return;
    const S = Spr(), id = S && S.has && S.has(z.bossId) ? z.bossId : 'pain';
    const top = z.y - (S && S.height ? S.height(id) : 100) - 30;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#140c1c'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  function flakesO(ctx, st) {
    if (!st.flakes.length) return;
    ctx.lineWidth = .8; ctx.strokeStyle = '#4a4036';
    for (const f of st.flakes) {
      const a = 1 - f.age / f.dur, s = f.s;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(f.x, f.y); ctx.rotate(f.r + f.age * 7);
      ctx.fillStyle = '#e9dfcc'; ctx.fillRect(-s, -s * .7, s * 2, s * 1.4); ctx.strokeRect(-s, -s * .7, s * 2, s * 1.4);
      ctx.restore();
    }
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.guard = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.ng;
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
        else if (s.k === 'line') markLine(ctx, s, rgb, k, time);
        else if (s.k === 'path') markPath(ctx, s.path, s.w, rgb, k, time);
      }
      windupG(ctx, z, st, time);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.ng;
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
      } else if (st.hold > 0 && st.holdMove === 'chibaku') {
        // arm raised, holding the planet in place
        const K = Kit();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - 100, 46, '170,120,255', .55);
        K.glow(ctx, eyePos(z, Math.cos(st.aim) >= 0 ? 1 : -1).x - 2, eyePos(z, 1).y, 14, '200,170,255', .8, true);
        ctx.globalCompositeOperation = 'source-over';
      }
      label(ctx, z, st, m);
    }
    flakesO(ctx, st);
    ctx.restore();
  }

  window.NagatoBoss = { members, order, moveLabels, pick, update, draw, drawOverlay, moves };
})();
