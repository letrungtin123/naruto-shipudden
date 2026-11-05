(() => {
  'use strict';

  // Shimura Danzō, leader of Root (spawn panel, faction 'danzo'). Contract as nagato-boss.js:
  // update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the ground layer (telegraphs,
  // furrows, seal formulae, the summoned Baku), drawOverlay(ctx, z, time) what stands above the
  // characters. All per-boss state lives on z.dz. Moves: Fūton Shinkū Renpa (vacuum wave volleys),
  // Shinkū Daigyoku (one giant vacuum sphere), vacuum-blade kunai dashes, the Baku summon's
  // inhaling maw, Mokuton Sashiki (wood stakes racing out of his arm), a Root ambush with explosive
  // tags, Izanagi (he "dies", then stands up unharmed elsewhere, three times) and the ultimate
  // Ura Shishō Fūinjutsu: a black sealing sphere that drags everything in and collapses.
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
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const HEIGHT = () => { const S = Spr(); return S && S.has && S.has('danzo') ? S.height('danzo') : 88; };

  const order = ['danzo'];
  const members = {
    danzo: {
      name: 'DANZŌ — HOKAGE BÓNG TỐI', short: 'DANZŌ', accent: '#8fa0b8', hpScale: 3.5, damageScale: 2.0, armor: .9,
      // Every jutsu shows once in the first ~30 s; the second lap reorders them.
      moves: ['renpa', 'kunai', 'daigyoku', 'baku', 'mokuton', 'root', 'fuin',
        'kunai', 'renpa', 'mokuton', 'daigyoku', 'root', 'baku', 'fuin']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    renpa:    { label: 'PHONG ĐỘN · CHÂN KHÔNG LIÊN BA', rgb: '200,240,255', windup: .85, after: 1.4 },
    kunai:    { label: 'PHONG ĐỘN · CHÂN KHÔNG NHẬN', rgb: '215,250,255', windup: .5, after: 1.1 },
    daigyoku: { label: 'PHONG ĐỘN · CHÂN KHÔNG ĐẠI NGỌC', rgb: '190,235,255', windup: 1.0, after: 1.5 },
    baku:     { label: 'KHẨU KÝ CHI THUẬT · MẠC', rgb: '235,210,190', windup: .9, after: 1.2 },
    mokuton:  { label: 'MỘC ĐỘN · SÁP MỘC CHI THUẬT', rgb: '205,235,140', windup: 1.0, after: 1.4 },
    root:     { label: 'CĂN · BỘC PHÙ PHỤC KÍCH', rgb: '255,190,140', windup: .8, after: 1.3 },
    fuin:     { label: 'LÝ TỨ TƯỢNG PHONG ẤN THUẬT', rgb: '205,190,240', windup: 1.3, after: 2.1 },
    izanagi:  { label: 'IZANAGI', rgb: '255,90,90', windup: 0, after: 0 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const RENPA_LEN = 1000, RENPA_SPEED = 1500, RENPA_HALF = .52;
  const DG_LEN = 1020, DG_SPEED = 760, DG_R = 92, DG_BURST = 300;
  const DASH_N = 3, DASH_GAP = .64, DASH_TELE = .36, DASH_DUR = .15;
  const BAKU_LEN = 940, BAKU_HALF = .5, BAKU_T = 2.75, BS = 1.12;
  const BK = { ox: 150, oy: 238, mx: 314, my: 120 };   // Baku sprite: feet origin and maw centre
  const WOOD_LEN = 820, WOOD_SPEED = 1150, WOOD_END = 130;
  const FUIN_R = 500, FUIN_T = 2.9;
  const IZ_T = [.66, .4, .18], IZ_HEAL = .12, IZ_SWAP = .8, IZ_END = 1.35;

  function pick() { return order[0]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  function inCone(p, x, y, a, len, half) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > len + (p.r || 12)) return false;
    if (d < 40) return true;
    const da = Math.atan2(Math.sin(Math.atan2(p.y - y, p.x - x) - a), Math.cos(Math.atan2(p.y - y, p.x - x) - a));
    return Math.abs(da) <= half;
  }

  function state(z) {
    return z.dz || (z.dz = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], ghosts: [], force: null, hold: 0, holdMove: '', dash: null, iz: null, izLeft: 3,
      summoned: 0, lanes: null, spots: null, ninjas: null, baku: null, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = Math.random() * 99;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  // `self` events move Danzō himself; Izanagi cancels them.
  const later = (st, t, fn, self) => st.ev.push({ t, fn, self: !!self });

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), tx = st.tx, ty = st.ty;
    const circ = (cx, cy, r, faint, small) => ({ k: 'c', x: cx, y: cy, r, faint, small });
    switch (move) {
      case 'renpa': return [{ k: 'cone', x, y, a, len: RENPA_LEN, half: RENPA_HALF }];
      case 'kunai': return [{ k: 'line', x, y, a, len: Math.min(600, Math.hypot(tx - x, ty - y) + 150), w: 40, faint: true }];
      case 'daigyoku': {
        const ex = x + ca * DG_LEN, ey = y + sa * DG_LEN;
        return [{ k: 'line', x: x + ca * 40, y: y + sa * 40, a, len: DG_LEN - 40, w: DG_R + 8 }, circ(ex, ey, DG_BURST)];
      }
      case 'baku': {
        // The tapir rises beside him on the side away from the camera, so he stands in front of it.
        const f = ca >= 0 ? 1 : -1;
        let nx = -sa, ny = ca;
        if (ny > 0 || (ny === 0 && nx * f > 0)) { nx = -nx; ny = -ny; }
        const bx = x + nx * 120 - f * 60, by = y + ny * 120 - 10;
        const mx = bx + f * (BK.mx - BK.ox) * BS, my = by + 6;
        const ba = Math.atan2(ty - my, tx - mx);
        st.baku = { bx, by, f, mx, my, a: ba };
        return [{ k: 'cone', x: mx, y: my, a: ba, len: BAKU_LEN, half: BAKU_HALF, inward: true }, circ(mx, my, 160)];
      }
      case 'mokuton': {
        const offs = [-.48, -.24, 0, .24, .48];
        st.lanes = offs.map((o, i) => {
          const aa = a + o, len = WOOD_LEN * (i === 2 ? 1 : i === 1 || i === 3 ? .93 : .84);
          return { a: aa, x0: x + Math.cos(aa) * 40, y0: y + Math.sin(aa) * 40, len, t0: .12 + Math.abs(i - 2) * .07, seed: Math.random() * 99 };
        });
        return st.lanes.map(l => ({ k: 'line', x: l.x0, y: l.y0, a: l.a, len: l.len, w: 44 }))
          .concat(st.lanes.map(l => circ(l.x0 + Math.cos(l.a) * l.len, l.y0 + Math.sin(l.a) * l.len, WOOD_END, true)));
      }
      case 'root': {
        const b = Math.random() * TAU, spots = [{ x: tx, y: ty }];
        for (let i = 0; i < 4; i++) spots.push({ x: tx + Math.cos(b + i * TAU / 4) * 130, y: ty + Math.sin(b + i * TAU / 4) * 130 });
        for (let i = 0; i < 7; i++) { const aa = b + (i + .5) * TAU / 7; spots.push({ x: tx + Math.cos(aa) * 265, y: ty + Math.sin(aa) * 265 }); }
        const ninjas = [];
        for (let i = 0; i < 3; i++) { const aa = b + .5 + i * TAU / 3; ninjas.push({ x: tx + Math.cos(aa) * 430, y: ty + Math.sin(aa) * 400 }); }
        spots.forEach((s, i) => {
          s.n = i % 3; s.tt = .22 + i * .04; s.tl = s.tt + .34; s.tb = s.tl + .72; s.seed = Math.random() * 99;
          s.rot = (Math.random() - .5) * .8;
        });
        st.spots = spots; st.ninjas = ninjas;
        return [circ(tx, ty, 340, true)].concat(spots.map(s => circ(s.x, s.y, 80, true, true)));
      }
      case 'fuin': return [{ k: 'c', follow: true, r: FUIN_R }, { k: 'c', follow: true, r: FUIN_R * .5, faint: true }];
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
    switch (move) {
      case 'renpa': {
        const blades = [], x0 = z.x + ca * 30, y0 = z.y + sa * 30;
        for (let i = 0; i < 7; i++) blades.push({ a: a + (i - 3) * (RENPA_HALF * 2 / 6) * .94, t0: .02 + [3, 2, 4, 1, 5, 0, 6].indexOf(i) * .05, x0, y0, seed: i * 7.3, w: i % 3 === 0 });
        const f = addFx(st, { kind: 'renpa', blades, x: x0, y: y0, a, dmg: D, dur: 3.2, upd: renpaUpd });
        // ...a second volley, re-aimed, after a breath (a thin line marks each wave first)
        later(st, .45, api => {
          const p = api.player, a1 = p ? Math.atan2(p.y - z.y, p.x - z.x) : a, x1 = z.x + Math.cos(a1) * 30, y1 = z.y + Math.sin(a1) * 30;
          for (let i = 0; i < 6; i++) f.blades.push({ a: a1 + (i - 2.5) * .15, t0: f.age + .32 + i * .06, x0: x1, y0: y1, seed: 40 + i * 5.1, w: false });
        });
        st.hold = 1.05; st.holdMove = 'renpa';
        api.shake(6);
        break;
      }
      case 'kunai': {
        st.hold = DASH_N * DASH_GAP + .4; st.holdMove = 'kunai';
        for (let i = 0; i < DASH_N; i++) later(st, i * DASH_GAP, api => dashTele(z, st, api, i), true);
        break;
      }
      case 'daigyoku': {
        addFx(st, { kind: 'ball', x0: z.x + ca * 40, y0: z.y + sa * 40, a, len: DG_LEN - 40, t0: .1, dmg: D, burst: false, w1: false, w2: false,
          dur: .1 + (DG_LEN - 40) / DG_SPEED + 2.3, upd: ballUpd });
        st.hold = .55; st.holdMove = 'daigyoku';
        api.shake(10);
        break;
      }
      case 'baku': {
        const b = st.baku;
        if (!b) break;
        const f = addFx(st, { kind: 'baku', bx: b.bx, by: b.by, f: b.f, mx: b.mx, my: b.my, a: b.a, T: BAKU_T, dur: BAKU_T + 1.5 });
        st.hold = BAKU_T + .3; st.holdMove = 'baku';
        for (let t = .75; t <= BAKU_T - .64; t += .5) later(st, t, api => {
          const p = api.player;
          if (!p || !inCone(p, f.mx, f.my, f.a, BAKU_LEN + 60, BAKU_HALF + .08)) return;
          const d = Math.hypot(p.x - f.mx, p.y - f.my);
          api.knockback({ x: f.mx, y: f.my }, BAKU_LEN + 120, -Math.min(140, Math.max(0, d - 70)), D * .22);
          api.shake(5);
        });
        later(st, 1.25, api => { for (const d of [320, 600, 860]) api.world(f.mx + Math.cos(f.a) * d, f.my + Math.sin(f.a) * d, 120, D * 2, 'vortex', f.a + Math.PI); });
        later(st, BAKU_T, api => {
          api.strike(f.mx + Math.cos(f.a) * 40, f.my + Math.sin(f.a) * 40, 165, D * 2.6, '#f2e2d2', 'crater');
          api.shake(18);
        });
        st.baku = null;
        break;
      }
      case 'mokuton': {
        const lanes = st.lanes || [];
        let last = 0;
        lanes.forEach((l, li) => {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 70, i = 0; d <= l.len; d += 95, i++) {
            const x = l.x0 + c * d, y = l.y0 + s * d;
            later(st, l.t0 + d / WOOD_SPEED, api => api.strike(x, y, 60, D * 1.4, null, i === 5 ? 'earth' : null, true));
          }
          const ex = l.x0 + c * l.len, ey = l.y0 + s * l.len, te = l.t0 + l.len / WOOD_SPEED + .04;
          last = Math.max(last, te);
          later(st, te, api => {
            api.strike(ex, ey, WOOD_END, D * 2.0, null, li % 2 === 0 ? 'earth' : null, true);
            if (li % 2 === 0) api.world(ex, ey, 120, D * 2.4, 'earth', l.a);
            api.shake(9);
          });
        });
        addFx(st, { kind: 'wood', lanes, x: z.x, y: z.y, a, last, tick: last + .5, dmg: D, dur: last + 2.8, upd: woodUpd });
        st.lanes = null;
        st.hold = .9; st.holdMove = 'mokuton';
        break;
      }
      case 'root': {
        const spots = st.spots || [], ninjas = st.ninjas || [];
        // Root ANBU drop in round the target (generic ninjas that stay and fight), then throw tagged kunai.
        if (st.summoned < 9) ninjas.forEach((n, i) => { if (api.summon(i % 2 ? 'runner' : 'walker', n.x, n.y)) st.summoned++; });
        let last = 0;
        spots.forEach((s, i) => {
          last = Math.max(last, s.tb);
          later(st, s.tb, api => {
            api.strike(s.x, s.y, 80, D * 1.25, null, i % 4 === 0 ? 'fire' : null, true);
            if (i % 3 === 0) api.shake(7);
          });
        });
        addFx(st, { kind: 'root', spots, ninjas, dur: last + 1.3 });
        st.spots = null; st.ninjas = null;
        st.hold = .5; st.holdMove = 'root';
        break;
      }
      case 'fuin': {
        const x = z.x, y = z.y;
        addFx(st, { kind: 'fuin', x, y, R: FUIN_R, T: FUIN_T, dur: FUIN_T + 2.6 });
        st.hold = FUIN_T + .35; st.holdMove = 'fuin';
        for (let t = .45; t < FUIN_T - .54; t += .55) later(st, t, api => {
          const p = api.player;
          if (!p) return;
          const d = Math.hypot(p.x - x, p.y - y);
          api.knockback({ x, y }, FUIN_R + 160, -Math.min(100, Math.max(0, d - 60)), D * .3);
          api.shake(5);
        });
        later(st, 1.1, api => { api.world(x + 380, y - 70, 140, D * 2, 'vortex'); api.world(x - 360, y + 100, 140, D * 2, 'vortex'); });
        later(st, FUIN_T, api => {
          api.strike(x, y, FUIN_R, D * 4.4, '#d8c8ff', 'crater');
          api.world(x, y, 300, D * 4, 'crater');
          for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + .6; api.world(x + Math.cos(aa) * 400, y + Math.sin(aa) * 400, 160, D * 3, 'vortex', aa); }
          api.burst(x, y - 40, '#d8c8ff', 30);
          api.shake(28);
        });
        break;
      }
    }
  }

  function renpaUpd(fx, dt, api) {
    for (const b of fx.blades) {
      const u = fx.age - b.t0;
      if (u < 0 || b.done) continue;
      const d = u * RENPA_SPEED, c = Math.cos(b.a), s = Math.sin(b.a);
      if (d > RENPA_LEN) {
        b.done = true;
        if (b.w) api.world(b.x0 + c * RENPA_LEN, b.y0 + s * RENPA_LEN, 90, fx.dmg * 2, 'blade', b.a);
        continue;
      }
      api.strike(b.x0 + c * d, b.y0 + s * d, 52, fx.dmg * .9, null, null, true);
    }
  }
  function ballUpd(fx, dt, api) {
    const d = (fx.age - fx.t0) * DG_SPEED, c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (d < 0) return;
    if (d < fx.len) {
      const x = fx.x0 + c * d, y = fx.y0 + s * d;
      api.strike(x, y, DG_R + 8, fx.dmg * 1.3, null, null, true);
      if (!fx.w1 && d > fx.len * .35) { fx.w1 = true; api.world(x, y, 140, fx.dmg * 2.4, 'vortex', fx.a); }
      if (!fx.w2 && d > fx.len * .7) { fx.w2 = true; api.world(x, y, 140, fx.dmg * 2.4, 'vortex', fx.a); }
    } else if (!fx.burst) {
      fx.burst = true;
      const ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
      api.strike(ex, ey, DG_BURST, fx.dmg * 2.6, '#e8fbff', 'crater');
      api.world(ex, ey, 230, fx.dmg * 3, 'vortex');
      for (let i = 0; i < 3; i++) { const aa = i * TAU / 3 + fx.a; api.world(ex + Math.cos(aa) * 260, ey + Math.sin(aa) * 260, 120, fx.dmg * 2, 'shockwave', aa); }
      api.shake(20);
    }
  }
  function woodUpd(fx, dt, api) {
    // the stakes stay planted: standing among them keeps hurting
    if (fx.age < fx.tick || fx.age > fx.dur - 1.1) return;
    fx.tick += .5;
    for (const l of fx.lanes) api.strike(l.x0 + Math.cos(l.a) * l.len, l.y0 + Math.sin(l.a) * l.len, WOOD_END * .8, fx.dmg * .35, null, null, true);
  }

  // Vacuum-blade kunai: each dash is marked for a moment, then he cuts straight through.
  function dashTele(z, st, api, i) {
    if (st.iz || z.health <= 0) return;
    const p = api.player, px = p ? p.x : st.tx, py = p ? p.y : st.ty;
    const a = Math.atan2(py - z.y, px - z.x), c = Math.cos(a), s = Math.sin(a), r = (z.r || 24) + 2;
    let len = Math.max(240, Math.min(600, Math.hypot(px - z.x, py - z.y) + 150));
    while (len > 90 && api.blocked(z.x + c * len, z.y + s * len, r)) len -= 30;
    const x0 = z.x, y0 = z.y;
    addFx(st, { kind: 'dtele', x: x0, y: y0, a, len, dur: DASH_TELE });
    later(st, DASH_TELE, api => {
      if (st.iz || z.health <= 0) return;
      let L = len;
      while (L > 60 && api.blocked(z.x + c * L, z.y + s * L, r)) L -= 30;
      st.dash = { x0: z.x, y0: z.y, x1: z.x + c * L, y1: z.y + s * L, t: 0, a, last: i === DASH_N - 1 };
      addFx(st, { kind: 'slash', x0: z.x, y0: z.y, x1: z.x + c * L, y1: z.y + s * L, a, dur: 1.5 });
    }, true);
  }
  function dashUpdate(z, st, dt, api) {
    const d = st.dash, D = api.damage || 60;
    d.t += dt;
    const k = Math.min(1, d.t / DASH_DUR), e = easeOut(k);
    z.x = lerp(d.x0, d.x1, e); z.y = lerp(d.y0, d.y1, e);
    if (st.ghosts.length < 14) st.ghosts.push({ x: z.x, y: z.y, f: Math.cos(d.a) >= 0 ? 1 : -1, age: 0 });
    if (k < 1) return;
    st.dash = null;
    api.line(d.x0, d.y0, d.x1, d.y1, 58, D * 1.7, 'blade');
    api.shake(9);
    if (d.last) later(st, .12, api => {
      const x = z.x, y = z.y;
      api.strike(x, y, 210, D * 2.0, '#e8fbff', 'blade');
      api.world(x, y, 150, D * 2.2, 'blade', d.a);
      addFx(st, { kind: 'xcut', x, y, a: d.a, dur: 1.4 });
      api.shake(14);
    });
  }

  // ------------------------------------------------------------------ Izanagi
  function triggerIz(z, st, api) {
    const idx = 3 - st.izLeft;
    st.izLeft--;
    const p = api.player, r = (z.r || 24) + 4;
    // he wakes up behind the ninja who "killed" him
    let x1 = z.x, y1 = z.y;
    if (p) {
      const base = Math.atan2(p.y - z.y, p.x - z.x);
      for (let k = 0; k < 12; k++) {
        const ang = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .45, x = p.x + Math.cos(ang) * 360, y = p.y + Math.sin(ang) * 300;
        if (!api.blocked(x, y, r)) { x1 = x; y1 = y; break; }
      }
    }
    const f = Math.cos(z.angle || 0) >= 0 ? 1 : -1;
    st.iz = { t: 0, x0: z.x, y0: z.y, x1, y1, moved: false, idx, hp: Math.max(z.health, z.maxHealth * IZ_T[idx]) + z.maxHealth * IZ_HEAL };
    st.windup = 0; st.move = ''; st.tele = []; st.hold = 0; st.holdMove = ''; st.dash = null;
    st.ev = st.ev.filter(e => !e.self);
    addFx(st, { kind: 'izDeath', x: z.x, y: z.y, f, dur: 1.8 });
    api.burst(z.x, z.y - 30, '#b0141e', 18);
    api.shake(10);
  }
  function izUpdate(z, st, dt, api) {
    const iz = st.iz;
    iz.t += dt;
    if (!iz.moved && iz.t >= IZ_SWAP) {
      iz.moved = true;
      z.x = iz.x1; z.y = iz.y1;
      z.health = Math.min(z.maxHealth, iz.hp);
      addFx(st, { kind: 'izRise', x: z.x, y: z.y, idx: iz.idx, dur: 2.0 });
      api.burst(z.x, z.y - 40, '#ff4050', 14);
      api.shake(8);
    }
    if (iz.t >= IZ_END) { st.iz = null; st.force = 'kunai'; st.timer = 0; }
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
    for (let i = st.ghosts.length - 1; i >= 0; i--) if ((st.ghosts[i].age += dt) > .32) st.ghosts.splice(i, 1);
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.dash = null; st.iz = null; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }

    // Izanagi: the blow that should have killed him becomes an illusion; he stands up elsewhere.
    if (!st.iz && st.izLeft > 0 && z.health < z.maxHealth * IZ_T[3 - st.izLeft]) triggerIz(z, st, api);
    if (st.iz) {
      izUpdate(z, st, dt, api);
      z.armorScale = st.iz ? 1e-4 : m.armor;
      z.kageDash = st.iz ? .05 : 0;
      z.bossWindup = 0;
      return;
    }
    z.armorScale = m.armor;

    if (st.dash) dashUpdate(z, st, dt, api);
    st.hold = Math.max(0, st.hold - dt);
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && !st.dash) {
      st.holdMove = '';
      st.timer -= dt;
      const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      if (st.timer <= 0 && p && (st.force || d < 900)) announce(z, st, m, api);
    }
    z.kageDash = st.dash ? .05 : 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.speedScale = .9;
  }

  // ------------------------------------------------------------------ cached art
  function rockSpr(i) {
    return Kit().sprite('dz:rock' + (i % 3), 64, 64, g => {
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
  // Crescent vacuum wave, convex edge along +x (centre of the sprite = centre of the wave).
  function bladeSpr() {
    return Kit().sprite('dz:blade', 120, 100, g => {
      const path = (k, dx) => { g.beginPath(); g.arc(44 + dx, 50, 58 * k, -.98, .98); g.arc(26 + dx, 50, 56 * k, .82, -.82, true); g.closePath(); };
      path(1, -2); g.fillStyle = 'rgba(18,56,66,.82)'; g.fill();
      path(.97, 1); g.fillStyle = '#d6f6ff'; g.fill();
      path(.9, 4); g.fillStyle = '#ffffff'; g.fill();
      g.strokeStyle = 'rgba(110,210,235,.95)'; g.lineWidth = 2.4; g.beginPath(); g.arc(36, 50, 52, -.7, .7); g.stroke();
      g.strokeStyle = 'rgba(18,56,66,.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(30, 50, 50, -.5, .5); g.stroke();
    });
  }
  function ballSpr() {
    return Kit().sphere('dz:ball', [[0, 'rgba(255,255,255,.42)'], [.45, 'rgba(210,246,255,.14)'], [.74, 'rgba(160,228,248,.32)'], [.9, 'rgba(236,252,255,.9)'], [.97, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,0)']], .38, .32);
  }
  function windSwirl() { return Kit().swirl('dz:wind', ['rgba(255,255,255,.95)', 'rgba(160,230,250,.8)', 'rgba(210,250,255,.85)'], 7, 1.0, .12, 256, 4.2); }
  function darkSwirl() { return Kit().swirl('dz:dark', ['rgba(8,4,12,.95)', 'rgba(60,36,96,.85)', 'rgba(20,10,30,.9)', 'rgba(150,120,210,.55)'], 10, 1.4, .06, 256, 6); }
  // Seal-script glyphs: black for the ground formula, pale for the black sphere.
  const GLYPHS = ['封', '印', '四', '象', '裏', '術', '根', '死'];
  function glyphSpr(i, light) {
    return Kit().sprite('dz:gl' + (i % 8) + (light ? 'w' : 'k'), 32, 32, g => {
      g.font = 'bold 22px "Yu Mincho","MS Mincho",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (light) {
        g.fillStyle = 'rgba(120,90,200,.6)'; g.fillText(GLYPHS[i % 8], 17, 17);
        g.fillStyle = '#efe6ff'; g.fillText(GLYPHS[i % 8], 16, 16);
      } else {
        g.fillStyle = 'rgba(255,245,230,.35)'; g.fillText(GLYPHS[i % 8], 17, 17);
        g.fillStyle = '#0c0810'; g.fillText(GLYPHS[i % 8], 16, 16);
      }
    });
  }

  // The Baku, Danzō's summoned tapir, side view facing right, feet on y = 238. open = maw gaping.
  function bakuSpr(open) {
    return Kit().sprite('dz:baku' + (open ? 'o' : 'c'), 350, 250, g => {
      const O = '#141018', DK = '#34303c', DK2 = '#24212a', LT = '#e4dfd5', LS = '#bfb7ab';
      g.lineJoin = 'round'; g.lineCap = 'round';
      const leg = (x, y, far) => {
        g.fillStyle = far ? DK2 : DK; g.strokeStyle = O; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x - 18, y); g.quadraticCurveTo(x - 22, y + 40, x - 18, 234); g.lineTo(x + 18, 234); g.quadraticCurveTo(x + 22, y + 40, x + 17, y); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = far ? '#8a8478' : '#cfc6b4';
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(x + k * 10, 233, 5.5, 4, 0, Math.PI, TAU); g.fill(); g.lineWidth = 2; g.stroke(); }
        if (!far) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 10, y + 10); g.lineTo(x - 10, y + 50); g.stroke(); }
      };
      leg(86, 168, true); leg(196, 166, true);
      // stub tail
      g.fillStyle = LS; g.strokeStyle = O; g.lineWidth = 4;
      g.beginPath(); g.moveTo(34, 112); g.quadraticCurveTo(14, 112, 18, 132); g.quadraticCurveTo(30, 128, 38, 124); g.fill(); g.stroke();
      // body: the pale saddle of a Malayan tapir, the front quarters black
      const body = () => { g.beginPath(); g.ellipse(140, 136, 112, 76, 0, 0, TAU); };
      body(); g.fillStyle = LT; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = DK; g.beginPath(); g.moveTo(178, 40); g.quadraticCurveTo(156, 140, 192, 240); g.lineTo(300, 240); g.lineTo(300, 40); g.closePath(); g.fill();
      g.fillStyle = 'rgba(60,44,70,.3)'; g.beginPath(); g.ellipse(132, 206, 130, 44, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,28,50,.22)'; g.beginPath(); g.ellipse(40, 150, 40, 80, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(124, 76, 74, 16, -.05, 0, TAU); g.fill();
      g.fillStyle = 'rgba(160,170,210,.22)'; g.beginPath(); g.ellipse(222, 84, 30, 10, -.2, 0, TAU); g.fill();
      // fur tufts and the saddle edge feathering into the black
      g.strokeStyle = 'rgba(90,80,90,.45)'; g.lineWidth = 2;
      for (let i = 0; i < 16; i++) { const x = 50 + hash(i * 3.1) * 120, y = 90 + hash(i * 5.7) * 90; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 4, y + 6, x - 10, y + 8); g.stroke(); }
      g.strokeStyle = DK; g.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const y = 60 + i * 24; g.beginPath(); g.moveTo(170 - Math.sin(i) * 6, y); g.lineTo(160 - Math.sin(i) * 6, y + 9); g.stroke(); }
      g.restore();
      body(); g.strokeStyle = O; g.lineWidth = 5; g.stroke();
      leg(108, 176, false); leg(214, 172, false);
      // head
      const head = () => { g.beginPath(); g.ellipse(262, 112, 52, 46, -.12, 0, TAU); };
      head(); g.fillStyle = DK; g.fill();
      g.save(); head(); g.clip();
      g.fillStyle = 'rgba(160,170,210,.25)'; g.beginPath(); g.ellipse(258, 80, 34, 12, -.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(10,6,14,.35)'; g.beginPath(); g.ellipse(250, 150, 50, 20, 0, 0, TAU); g.fill();
      g.restore();
      head(); g.strokeStyle = O; g.lineWidth = 4.5; g.stroke();
      // ear with the tapir's white rim
      g.fillStyle = DK; g.beginPath(); g.ellipse(230, 72, 15, 23, -.45, 0, TAU); g.fill();
      g.strokeStyle = '#f4f0e8'; g.lineWidth = 4; g.stroke(); g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.ellipse(230, 72, 18, 26, -.45, 0, TAU); g.stroke();
      g.fillStyle = '#5a3a4a'; g.beginPath(); g.ellipse(231, 74, 7, 13, -.45, 0, TAU); g.fill();
      // mouth / proboscis
      if (open) {
        // the maw gapes wide: upper lip and snout curled up, lower jaw dropped
        g.fillStyle = DK; g.strokeStyle = O; g.lineWidth = 4;
        g.beginPath(); g.moveTo(286, 92); g.quadraticCurveTo(316, 62, 342, 52); g.quadraticCurveTo(348, 70, 334, 86); g.quadraticCurveTo(320, 96, 306, 100); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(200,200,230,.35)'; g.lineWidth = 2;
        for (const t of [.3, .5, .7]) { const x = 300 + t * 40, y = 82 - t * 26; g.beginPath(); g.moveTo(x - 4, y - 6); g.lineTo(x + 4, y + 6); g.stroke(); }
        g.fillStyle = DK; g.strokeStyle = O; g.lineWidth = 4;
        g.beginPath(); g.moveTo(290, 140); g.quadraticCurveTo(322, 168, 334, 178); g.quadraticCurveTo(318, 182, 300, 168); g.quadraticCurveTo(290, 158, 284, 148); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#2a0a12'; g.beginPath(); g.ellipse(BK.mx, BK.my, 26, 34, -.15, 0, TAU); g.fill();
        g.strokeStyle = '#a8404e'; g.lineWidth = 6; g.beginPath(); g.ellipse(BK.mx, BK.my, 23, 31, -.15, 0, TAU); g.stroke();
        g.strokeStyle = O; g.lineWidth = 3.5; g.beginPath(); g.ellipse(BK.mx, BK.my, 27, 35, -.15, 0, TAU); g.stroke();
        g.fillStyle = '#f4efe2';
        for (let i = 0; i < 4; i++) {
          const a0 = -2.4 + i * .42, x = BK.mx + Math.cos(a0) * 24, y = BK.my + Math.sin(a0) * 32;
          g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(BK.mx + Math.cos(a0) * 15, BK.my + Math.sin(a0) * 21); g.closePath(); g.fill();
          const b0 = .9 + i * .42, x2 = BK.mx + Math.cos(b0) * 24, y2 = BK.my + Math.sin(b0) * 32;
          g.beginPath(); g.moveTo(x2 - 4, y2); g.lineTo(x2 + 4, y2); g.lineTo(BK.mx + Math.cos(b0) * 15, BK.my + Math.sin(b0) * 21); g.closePath(); g.fill();
        }
      } else {
        // trunk-like snout hanging down, jaw shut
        g.fillStyle = DK; g.strokeStyle = O; g.lineWidth = 4;
        g.beginPath(); g.moveTo(292, 92); g.quadraticCurveTo(330, 100, 340, 136); g.quadraticCurveTo(342, 152, 330, 154); g.quadraticCurveTo(322, 140, 304, 140); g.quadraticCurveTo(292, 136, 288, 128); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(200,200,230,.35)'; g.lineWidth = 2;
        for (const t of [.35, .55, .75]) { g.beginPath(); g.moveTo(296 + t * 40, 98 + t * 32); g.lineTo(306 + t * 34, 92 + t * 34); g.stroke(); }
        g.strokeStyle = O; g.lineWidth = 3; g.beginPath(); g.moveTo(290, 132); g.quadraticCurveTo(300, 146, 316, 144); g.stroke();
      }
      // menacing eye
      g.fillStyle = '#f2ece0'; g.beginPath(); g.ellipse(276, 100, 9, 6.5, -.2, 0, TAU); g.fill();
      g.fillStyle = '#c81c28'; g.beginPath(); g.arc(278, 100, 4.6, 0, TAU); g.fill();
      g.fillStyle = '#16060a'; g.beginPath(); g.ellipse(278.5, 100, 1.6, 3.6, 0, 0, TAU); g.fill();
      g.strokeStyle = O; g.lineWidth = 2.5; g.beginPath(); g.ellipse(276, 100, 9, 6.5, -.2, 0, TAU); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(262, 90); g.quadraticCurveTo(276, 86, 290, 94); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(275, 98, 1.5, 0, TAU); g.fill();
    });
  }

  // ------------------------------------------------------------------ shared draw helpers
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(18,16,30,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
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
    // arcs racing outward (or inward for a suction)
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const ph = frac(time * 1.6 * (s.inward ? -1 : 1) + i / 7), r = 50 + ph * (L - 70);
      ctx.moveTo(Math.cos(-h * .85) * r, Math.sin(-h * .85) * r); ctx.arc(0, 0, r, -h * .85, h * .85);
    }
    ctx.stroke();
    ctx.restore();
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
      for (let k = .5; k < 1; k += .2) {
        const px = Math.cos(an) * l * k, py = Math.sin(an) * l * k, pa = an + Math.PI / 2;
        ctx.moveTo(px - Math.cos(pa) * 5, py - Math.sin(pa) * 5); ctx.lineTo(px + Math.cos(pa) * 5, py + Math.sin(pa) * 5);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // Reverse Four Symbols formula: rings of script round a cross of four "symbol" lines (true circle = hit area).
  function sealCircle(ctx, x, y, r, time, seed, a) {
    if (a <= .01 || r < 8) return;
    const K = Kit();
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(12,8,16,.8)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.moveTo(r * .82, 0); ctx.arc(0, 0, r * .82, 0, TAU); ctx.moveTo(r * .3, 0); ctx.arc(0, 0, r * .3, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,170,240,.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, TAU); ctx.stroke();
    // four symbol spokes with tick script and the radial rays between them
    ctx.rotate(time * .12);
    ctx.strokeStyle = 'rgba(12,8,16,.75)'; ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const an = i * TAU / 16, l0 = r * .3, l1 = i % 4 === 0 ? r * .82 : r * (.55 + hash(i + seed) * .2);
      ctx.moveTo(Math.cos(an) * l0, Math.sin(an) * l0); ctx.lineTo(Math.cos(an) * l1, Math.sin(an) * l1);
      for (let k = .45; k < .95; k += .16) {
        const px = Math.cos(an) * l1 * k, py = Math.sin(an) * l1 * k, pa = an + Math.PI / 2, w = i % 4 === 0 ? 8 : 4;
        ctx.moveTo(px - Math.cos(pa) * w, py - Math.sin(pa) * w); ctx.lineTo(px + Math.cos(pa) * w, py + Math.sin(pa) * w);
      }
    }
    ctx.stroke();
    // a ring of glyphs between the two outer circles
    const n = Math.max(8, Math.min(30, Math.round(r / 18))), gr = r * .91, gs = Math.min(26, r * .1);
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n;
      ctx.save(); ctx.translate(Math.cos(an) * gr, Math.sin(an) * gr); ctx.rotate(an + Math.PI / 2);
      ctx.drawImage(glyphSpr(i + (seed | 0)), -gs / 2, -gs / 2, gs, gs);
      ctx.restore();
    }
    ctx.restore();
    void K;
  }
  // Wooden stake / spike, base at (x, y) on the ground, leaning by `lean` (rad from vertical).
  function woodSpike(ctx, x, y, lean, h, w, alpha = 1) {
    if (h < 3 || alpha <= .01) return;
    const tx = x + Math.sin(lean) * h, ty = y - Math.cos(lean) * h, nx = Math.cos(lean), ny = Math.sin(lean);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#2a180c';
    ctx.beginPath(); ctx.moveTo(x - nx * (w + 2), y - ny * (w + 2) * .5 + 2); ctx.quadraticCurveTo((x + tx) / 2 - nx * w * .7, (y + ty) / 2, tx, ty - 2); ctx.quadraticCurveTo((x + tx) / 2 + nx * w * .7, (y + ty) / 2, x + nx * (w + 2), y + ny * (w + 2) * .5 + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#86552e';
    ctx.beginPath(); ctx.moveTo(x - nx * w, y - ny * w * .5); ctx.quadraticCurveTo((x + tx) / 2 - nx * w * .55, (y + ty) / 2, tx, ty); ctx.quadraticCurveTo((x + tx) / 2 + nx * w * .55, (y + ty) / 2, x + nx * w, y + ny * w * .5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c48d55';
    ctx.beginPath(); ctx.moveTo(x - nx * w * .7, y - ny * w * .35); ctx.quadraticCurveTo((x + tx) / 2 - nx * w * .4, (y + ty) / 2, tx, ty); ctx.quadraticCurveTo((x + tx) / 2 - nx * w * .1, (y + ty) / 2, x - nx * w * .1, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,22,10,.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(lerp(x, tx, .25) + nx * w * .3, lerp(y, ty, .25)); ctx.lineTo(lerp(x, tx, .5) + nx * w * .15, lerp(y, ty, .5)); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function leaf(ctx, x, y, angle, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(0, -size * .55, size * 1.4, 0); ctx.quadraticCurveTo(0, size * .55, -size, 0);
    ctx.fill(); ctx.restore();
  }
  function kunai(ctx, x, y, angle, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    ctx.fillStyle = '#262a35';
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-2, -4); ctx.lineTo(0, 0); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ecedf1'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-8, 0); ctx.stroke();
    ctx.strokeStyle = '#cbb778'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-15, 0); ctx.stroke();
    ctx.restore();
  }
  // Explosive tag: a paper strip with red script.
  function tag(ctx, x, y, rot, s, glowK) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = '#1e1612'; ctx.fillRect(-s * .42 - 1, -s - 1, s * .84 + 2, s * 2 + 2);
    ctx.fillStyle = '#f2e6c4'; ctx.fillRect(-s * .42, -s, s * .84, s * 2);
    ctx.fillStyle = glowK > .5 ? '#ff4020' : '#b8201c';
    ctx.fillRect(-s * .12, -s * .8, s * .24, s * 1.6);
    ctx.fillRect(-s * .3, -s * .3, s * .6, s * .14);
    ctx.restore();
  }
  // Mangekyō-free plain Sharingan eye (Izanagi): almond, red iris, three tomoe; `open` 0..1.
  function bigEye(ctx, x, y, w, open, time, alpha) {
    if (alpha <= .01) return;
    const h = w * .42 * open;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
    const almond = (hh) => { ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, -hh * 2, w, 0); ctx.quadraticCurveTo(0, hh * 2, -w, 0); ctx.closePath(); };
    if (h > .8) {
      almond(h); ctx.fillStyle = '#fbf2ea'; ctx.fill();
      ctx.save(); almond(h); ctx.clip();
      const ir = w * .44;
      ctx.fillStyle = '#c4101c'; ctx.beginPath(); ctx.arc(0, 0, ir, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff5048'; ctx.beginPath(); ctx.arc(0, ir * .3, ir * .7, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#1a0408'; ctx.lineWidth = w * .05; ctx.beginPath(); ctx.arc(0, 0, ir, 0, TAU); ctx.stroke();
      ctx.lineWidth = w * .03; ctx.beginPath(); ctx.arc(0, 0, ir * .6, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#1a0408'; ctx.beginPath(); ctx.arc(0, 0, ir * .22, 0, TAU); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * TAU / 3 + time * 2.2, px = Math.cos(a) * ir * .6, py = Math.sin(a) * ir * .6;
        ctx.beginPath(); ctx.arc(px, py, ir * .14, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + Math.cos(a + 1.6) * ir * .13, py + Math.sin(a + 1.6) * ir * .13);
        ctx.quadraticCurveTo(px + Math.cos(a + 2.4) * ir * .4, py + Math.sin(a + 2.4) * ir * .4, px + Math.cos(a + 3.1) * ir * .34, py + Math.sin(a + 3.1) * ir * .34);
        ctx.lineTo(px + Math.cos(a + 3.2) * ir * .1, py + Math.sin(a + 3.2) * ir * .1); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(-ir * .35, -ir * .35, ir * .14, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(40,10,20,.3)'; ctx.fillRect(-w, -h * 2, w * 2, h * .9);
      ctx.restore();
    }
    // lids: heavy upper lash line, lower line
    ctx.strokeStyle = '#120608'; ctx.lineCap = 'round';
    ctx.lineWidth = w * .1; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, -Math.max(h, .5) * 2, w, 0); ctx.stroke();
    ctx.lineWidth = w * .045; ctx.beginPath(); ctx.moveTo(-w * .9, 1); ctx.quadraticCurveTo(0, Math.max(h, .5) * 2, w * .9, 1); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ Shinkū Renpa
  function renpaG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.lineCap = 'round';
    for (const b of fx.blades) {
      const u = fx.age - b.t0, c = Math.cos(b.a), s = Math.sin(b.a);
      if (u < 0) {
        // the re-aimed wave flashes its lane first
        if (u > -.34) {
          const k = 1 + u / .34;
          ctx.strokeStyle = `rgba(20,30,40,${.35 * k})`; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x0 + c * RENPA_LEN, b.y0 + s * RENPA_LEN); ctx.stroke();
          ctx.strokeStyle = `rgba(215,250,255,${.8 * k})`; ctx.lineWidth = 2.4; ctx.stroke();
        }
        continue;
      }
      const d = Math.min(RENPA_LEN, u * RENPA_SPEED);
      // the cut it scores through the grass
      ctx.strokeStyle = `rgba(36,46,30,${.32 * fade})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(b.x0 + c * 30, b.y0 + s * 30); ctx.lineTo(b.x0 + c * d, b.y0 + s * d); ctx.stroke();
      ctx.strokeStyle = `rgba(250,255,240,${.4 * fade})`; ctx.lineWidth = 1.4; ctx.stroke();
      if (u * RENPA_SPEED < RENPA_LEN) {
        ctx.fillStyle = 'rgba(20,40,40,.22)';
        ctx.beginPath(); ctx.ellipse(b.x0 + c * d, b.y0 + s * d, 40, 12, b.a + Math.PI / 2, 0, TAU); ctx.fill();
      } else {
        const v = (u * RENPA_SPEED - RENPA_LEN) / RENPA_SPEED;
        if (v < .5) Kit().fx.shockRing(ctx, b.x0 + c * RENPA_LEN, b.y0 + s * RENPA_LEN, 110, v / .5, 1 - v / .5, '200,245,255');
      }
    }
  }
  function renpaO(ctx, fx, time) {
    const K = Kit(), img = bladeSpr(), H = 36, dust = K.puff('dust');
    // the mouth blast: a ring of air bursting from his lips
    if (fx.age < .35) {
      const k = fx.age / .35;
      ctx.strokeStyle = `rgba(20,60,70,${.5 * (1 - k)})`; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(fx.x + Math.cos(fx.a) * 40 * k, fx.y - 58 + Math.sin(fx.a) * 20 * k, 20 + 60 * k, (20 + 60 * k) * .7, fx.a, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.9 * (1 - k)})`; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.lineCap = 'round';
    for (const b of fx.blades) {
      const u = fx.age - b.t0;
      if (u < 0) continue;
      const d = u * RENPA_SPEED, c = Math.cos(b.a), s = Math.sin(b.a);
      if (d >= RENPA_LEN) {
        const v = (d - RENPA_LEN) / RENPA_SPEED;
        if (v < .45) {
          const ex = b.x0 + c * RENPA_LEN, ey = b.y0 + s * RENPA_LEN;
          for (let i = 0; i < 4; i++) K.stamp(ctx, dust, ex + (hash(i + b.seed) - .5) * 70, ey - 14 - v * 60, 18 + v * 50, (1 - v / .45) * .7, .75);
        }
        continue;
      }
      const hx = b.x0 + c * d, hy = b.y0 + s * d - H, grow = Math.min(1, u / .1), sc = (.6 + .65 * grow) * (.92 + .08 * Math.sin(time * 40 + b.seed));
      // pressure streaks trailing the wave
      for (const [style, w] of [['rgba(18,56,66,.42)', 4.2], ['rgba(255,255,255,.88)', 1.6]]) {
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
        for (let j = -2; j <= 2; j++) {
          const o = j * 18 * sc, l = 70 + (2 - Math.abs(j)) * 40;
          ctx.moveTo(hx - s * o - c * 20, hy + c * o * .6 - s * 20); ctx.lineTo(hx - s * o - c * (20 + l), hy + c * o * .6 - s * (20 + l));
        }
        ctx.stroke();
      }
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(b.a);
      // two fainter echoes of the wave rippling behind it
      if (d > 90) { ctx.globalAlpha = .45; ctx.drawImage(img, -60 * sc * .8 - 54, -50 * sc * .8, 96 * sc, 80 * sc); }
      if (d > 160) { ctx.globalAlpha = .22; ctx.drawImage(img, -60 * sc * .62 - 96, -50 * sc * .62, 74 * sc, 62 * sc); }
      ctx.globalAlpha = 1;
      ctx.drawImage(img, -60 * sc - 14, -50 * sc, 120 * sc, 100 * sc); ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx + c * 20, hy + s * 20, 64, '170,235,255', .32);
      ctx.globalCompositeOperation = 'source-over';
      K.stamp(ctx, dust, b.x0 + c * (d - 50) + (hash(b.seed + Math.floor(d / 60)) - .5) * 40, b.y0 + s * (d - 50) - 10, 16, .55, .75);
    }
  }

  // ------------------------------------------------------------------ Shinkū Daigyoku
  function ballHead(fx) { return Math.max(0, Math.min(fx.len, (fx.age - fx.t0) * DG_SPEED)); }
  function ballG(ctx, fx, time) {
    const K = Kit(), d = ballHead(fx), c = Math.cos(fx.a), s = Math.sin(fx.a), fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    if (fx.age < fx.t0) return;
    // the furrow it grinds into the ground
    ctx.save(); ctx.translate(fx.x0, fx.y0); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(74,58,40,${.26 * fade})`; ctx.fillRect(0, -DG_R * .78, d, DG_R * 1.56);
    ctx.fillStyle = `rgba(40,30,24,${.3 * fade})`; ctx.fillRect(0, -DG_R * .32, d, DG_R * .64);
    ctx.strokeStyle = `rgba(30,22,18,${.55 * fade})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const k of [-.66, -.4, .1, .45, .7]) { ctx.moveTo(10, k * DG_R); for (let x = 60; x < d; x += 60) ctx.lineTo(x, k * DG_R + Math.sin(x * .05 + k * 9) * 5); }
    ctx.stroke();
    ctx.strokeStyle = `rgba(235,225,200,${.35 * fade})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -DG_R * .8); ctx.lineTo(d, -DG_R * .8); ctx.moveTo(0, DG_R * .8); ctx.lineTo(d, DG_R * .8); ctx.stroke();
    ctx.restore();
    const travel = fx.len / DG_SPEED, v = fx.age - fx.t0 - travel;
    if (v < 0) {
      ctx.fillStyle = 'rgba(16,30,34,.3)'; ctx.beginPath(); ctx.ellipse(fx.x0 + c * d, fx.y0 + s * d, DG_R * 1.05, DG_R * .4, 0, 0, TAU); ctx.fill();
    } else {
      const ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
      crater(ctx, ex, ey, DG_BURST * .55, fade * .9, fx.seed);
      cracks(ctx, ex, ey, DG_BURST * 1.25 * easeOut(v * 3), 12, fx.seed + 2, fade, 3);
      if (v < 1.1) { K.fx.shockRing(ctx, ex, ey, DG_BURST * 1.25, v / 1.1, 1 - v / 1.1, '200,245,255'); K.fx.shockRing(ctx, ex, ey, DG_BURST * 1.7, v / 1.1, (1 - v / 1.1) * .6, '255,255,255'); }
      dustRing(ctx, ex, ey, DG_BURST * (.4 + easeOut(v / 1.4) * .8), 20, 30 + v * 40, .85 * (1 - win(v, .6, 2)), fx.seed, 8 + v * 20);
    }
  }
  function ballO(ctx, fx, time) {
    const K = Kit(), c = Math.cos(fx.a), s = Math.sin(fx.a), travel = fx.len / DG_SPEED, t = fx.age - fx.t0;
    if (t < 0) return;
    if (t < travel) {
      const d = t * DG_SPEED, gx = fx.x0 + c * d, gy = fx.y0 + s * d, grow = easeOut(t / .18), r = DG_R * (.4 + .6 * grow) * (1 + .035 * Math.sin(time * 34));
      const cx = gx, cy = gy - r * .82, spinDir = c >= 0 ? 1 : -1;
      // dust and debris ground up under it, thrown back along its wake
      const dust = K.puff('dust');
      for (let i = 0; i < 7; i++) {
        const back = i * 34, age = back / DG_SPEED;
        K.stamp(ctx, dust, gx - c * back + (hash(i * 3.1 + Math.floor(time * 8)) - .5) * r, gy - s * back - 10 - i * 6, r * (.3 + i * .06), (.75 - i * .09), .75);
        void age;
      }
      K.fx.debris(ctx, gx - c * 20, gy, r * 1.4, frac(time * 2.6), fx.seed, '#4a3a2c', 9);
      // wind streaks trailing behind
      for (const [style, w] of [['rgba(18,56,66,.42)', 5], ['rgba(255,255,255,.9)', 1.8]]) {
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath();
        for (let j = 0; j < 7; j++) {
          const an = j / 7 * TAU + time * 4 * spinDir, ox = Math.cos(an) * r * .85, oy = Math.sin(an) * r * .85, l = 60 + hash(j + fx.seed) * 90;
          ctx.moveTo(cx + ox - c * r * .3, cy + oy - s * r * .3); ctx.lineTo(cx + ox - c * (r * .3 + l), cy + oy - s * (r * .3 + l) * .6);
        }
        ctx.stroke();
      }
      // the sphere of compressed air: dark under-rim, glassy body, spinning wind inside, bright rim
      ctx.strokeStyle = 'rgba(22,58,70,.55)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(cx, cy, r * .97, 0, TAU); ctx.stroke();
      ctx.drawImage(ballSpr(), cx - r, cy - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'lighter';
      K.spin(ctx, windSwirl(), cx, cy, r * .95, time * 6 * spinDir, .55);
      K.spin(ctx, windSwirl(), cx, cy, r * .6, -time * 10 * spinDir, .45);
      K.glow(ctx, cx, cy, r * 1.7, '160,225,255', .3);
      ctx.globalCompositeOperation = 'source-over';
      // compression bands wrapping the sphere
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        const tilt = (i - 1) * .6 + Math.sin(time * 3 + i) * .1, sq = .28 + .08 * Math.sin(time * 9 + i * 2);
        ctx.strokeStyle = 'rgba(22,58,70,.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.04, r * sq, tilt, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(240,252,255,.8)'; ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(cx, cy, r * .9, 3.5, 4.9); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(cx - r * .38, cy - r * .42, r * .2, r * .1, -.6, 0, TAU); ctx.fill();
      // leaves and grass snatched into it
      for (let i = 0; i < 6; i++) {
        const an = time * 7 * spinDir + i * 1.05, rr = r * (1.05 + .2 * hash(i));
        leaf(ctx, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * .8, an + 1.6, 5, i % 2 ? '#6aa84a' : '#a8c86a');
      }
      return;
    }
    // the burst: it implodes for an instant, then blows outward as a dome of air
    const v = t - travel, ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
    if (v < .12) {
      const r = DG_R * (1 - v / .12 * .55), cy = ey - r * .82;
      ctx.drawImage(ballSpr(), ex - r, cy - r, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ex, cy, r, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    if (v < .25) K.glow(ctx, ex, ey - 60, 200 + v * 1400, '225,250,255', 1 - v / .25, true);
    ctx.globalCompositeOperation = 'source-over';
    if (v > .08 && v < .8) {
      const q = (v - .08) / .72, rr = DG_BURST * (.25 + easeOut(q) * .95), H = rr * .65, a = 1 - q;
      ctx.lineWidth = 12 * a + 2; ctx.strokeStyle = `rgba(22,58,70,${.45 * a})`;
      ctx.beginPath(); ctx.ellipse(ex, ey, rr, H, 0, Math.PI, TAU); ctx.stroke();
      ctx.lineWidth = 4 * a + 1; ctx.strokeStyle = `rgba(250,255,255,${.95 * a})`; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(200,245,255,${.6 * a})`;
      ctx.beginPath(); ctx.ellipse(ex, ey, rr * .55, H, 0, Math.PI, TAU); ctx.stroke();
      // air streaks flung out radially
      ctx.strokeStyle = `rgba(255,255,255,${.8 * a})`; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 22; i++) {
        const an = i * TAU / 22 + hash(i + fx.seed) * .2, r1 = rr * (.85 + hash(i * 3) * .2), r2 = r1 + 50 + hash(i * 5) * 80;
        ctx.moveTo(ex + Math.cos(an) * r1, ey + Math.sin(an) * r1 * .5 - 24); ctx.lineTo(ex + Math.cos(an) * r2, ey + Math.sin(an) * r2 * .5 - 24);
      }
      ctx.stroke();
    }
    if (v < 1.6) {
      K.fx.debris(ctx, ex, ey, DG_BURST * 1.1, v / 1.4, fx.seed, '#3b3040', 18);
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + hash(fx.seed + i), dd = DG_BURST * (.15 + easeOut(v * 1.2) * (.75 + hash(i * 2.2) * .35)), h = bell(v * 1.1) * (50 + hash(i * 5) * 110);
        drawRock(ctx, i, ex + Math.cos(an) * dd, ey + Math.sin(an) * dd * .5 - h, 8 + hash(i * 7.7) * 10, v * 8 + i, 1 - win(v, 1.0, 1.6));
      }
    }
  }

  // ------------------------------------------------------------------ vacuum-blade dashes
  function dteleG(ctx, fx, time) {
    markLine(ctx, { x: fx.x, y: fx.y, a: fx.a, len: fx.len, w: 58 }, MOVES.kunai.rgb, fx.age / fx.dur, time);
  }
  function slashG(ctx, fx, time) {
    const fade = 1 - win(fx.age, .4, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (fade <= 0) return;
    // a clean deep cut through the ground with white wind-scoured edges
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(30,24,22,${.55 * fade})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
    ctx.strokeStyle = `rgba(240,252,255,${.6 * fade})`; ctx.lineWidth = 1.6;
    for (const o of [-6, 6]) { ctx.beginPath(); ctx.moveTo(fx.x0 - s * o, fx.y0 + c * o); ctx.lineTo(fx.x1 - s * o, fx.y1 + c * o); ctx.stroke(); }
    // little side gashes
    ctx.strokeStyle = `rgba(30,24,22,${.4 * fade})`; ctx.lineWidth = 2; ctx.beginPath();
    const L = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
    for (let d = 40; d < L; d += 55) { const sd = (d / 55) % 2 ? 1 : -1, x = fx.x0 + c * d, y = fx.y0 + s * d; ctx.moveTo(x, y); ctx.lineTo(x + c * 18 - s * sd * 20, y + s * 18 + c * sd * 20); }
    ctx.stroke();
  }
  function slashO(ctx, fx, time) {
    const K = Kit(), t = fx.age, H = 30;
    if (t > .45) return;
    const a = 1 - t / .45, c = Math.cos(fx.a), s = Math.sin(fx.a), L = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
    // the wind blade's wake at chest height: a long tapered sliver, dark under-edge then white-hot core
    const wedge = (w) => {
      ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0 - H);
      ctx.lineTo(fx.x0 + c * L * .75 - s * w, fx.y0 + s * L * .75 + c * w * .6 - H);
      ctx.lineTo(fx.x1 + c * 40, fx.y1 + s * 40 - H);
      ctx.lineTo(fx.x0 + c * L * .75 + s * w, fx.y0 + s * L * .75 - c * w * .6 - H);
      ctx.closePath();
    };
    wedge(16); ctx.fillStyle = `rgba(18,56,66,${.5 * a})`; ctx.fill();
    wedge(9); ctx.fillStyle = `rgba(235,252,255,${.95 * a})`; ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x1, fx.y1 - H, 70, '170,235,255', .7 * a, true);
    ctx.globalCompositeOperation = 'source-over';
    // crescent sweep where the blade finishes
    const img = bladeSpr(), sc = .7 + .5 * (1 - a);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(fx.x1 + c * 30, fx.y1 + s * 30 - H); ctx.rotate(fx.a); ctx.drawImage(img, -60 * sc, -50 * sc, 120 * sc, 100 * sc); ctx.restore();
    K.fx.debris(ctx, fx.x1, fx.y1, 90, t / .45, fx.seed, '#3a2c22', 6);
  }
  function xcutG(ctx, fx, time) {
    const K = Kit(), t = fx.age, fade = 1 - win(t, fx.dur - .6, fx.dur);
    ctx.lineCap = 'round';
    for (const o of [-.78, .78]) {
      const an = fx.a + o, c = Math.cos(an), s = Math.sin(an), L = 210 * easeOut(t / .2);
      ctx.strokeStyle = `rgba(30,24,22,${.55 * fade})`; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(fx.x - c * L, fx.y - s * L * .5); ctx.lineTo(fx.x + c * L, fx.y + s * L * .5); ctx.stroke();
      ctx.strokeStyle = `rgba(240,252,255,${.55 * fade})`; ctx.lineWidth = 2; ctx.stroke();
    }
    if (t < .9) K.fx.shockRing(ctx, fx.x, fx.y, 260, t / .9, 1 - t / .9, '200,245,255');
    cracks(ctx, fx.x, fx.y, 200 * easeOut(t / .3), 8, fx.seed, fade, 2.4);
    dustRing(ctx, fx.x, fx.y, 80 + easeOut(t) * 150, 12, 20 + t * 30, .7 * (1 - win(t, .3, 1.2)), fx.seed, 8 + t * 16);
  }
  function xcutO(ctx, fx, time) {
    const K = Kit(), t = fx.age;
    if (t > .5) return;
    const a = 1 - t / .5, img = bladeSpr(), sc = 1.4 + t * 2.4;
    for (const o of [-.78, .78]) {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(fx.x, fx.y - 34); ctx.rotate(fx.a + o); ctx.scale(1, .55);
      ctx.drawImage(img, -60 * sc, -50 * sc, 120 * sc, 100 * sc);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    if (t < .2) K.glow(ctx, fx.x, fx.y - 34, 160 + t * 600, '220,250,255', 1 - t / .2, true);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ the Baku
  function bakuScale(t) { return t < .25 ? 0 : t < .5 ? BS * easeBack((t - .25) / .25) : BS; }
  function bakuG(ctx, fx, time) {
    const t = fx.age, T = fx.T;
    seal(ctx, fx.bx + fx.f * 30, fx.by, 190, 1 - win(t, .2, 1.0), time, fx.seed);
    const vis = t > .25 && t < T + .7;
    if (!vis) return;
    // suction pressure on the ground: a tinted wedge and arcs crawling toward the maw
    if (t > .45 && t < T + .05) {
      const k = win(t, .45, .8) * (1 - win(t, T - .05, T + .05));
      ctx.save(); ctx.translate(fx.mx, fx.my); ctx.rotate(fx.a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, BAKU_LEN, -BAKU_HALF, BAKU_HALF); ctx.closePath();
      ctx.fillStyle = `rgba(50,40,60,${.13 * k})`; ctx.fill();
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const ph = 1 - frac(time * 1.5 + i / 6), r = 60 + ph * (BAKU_LEN - 80);
        ctx.strokeStyle = `rgba(30,26,40,${.4 * k * ph})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, r, -BAKU_HALF * .9, BAKU_HALF * .9); ctx.stroke();
        ctx.strokeStyle = `rgba(245,240,255,${.6 * k * ph})`; ctx.lineWidth = 1.8; ctx.stroke();
      }
      // grass flattened toward the mouth
      ctx.strokeStyle = `rgba(40,60,30,${.45 * k})`; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const an = (hash(i * 2.7 + fx.seed) - .5) * 2 * BAKU_HALF * .9, r = 120 + hash(i * 4.1) * (BAKU_LEN - 160), x = Math.cos(an) * r, y = Math.sin(an) * r;
        ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(an) * 26, y - Math.sin(an) * 26);
      }
      ctx.stroke();
      ctx.restore();
    }
    // the tapir itself (ground layer: the ninjas in front of it are drawn over it)
    const sc = bakuScale(t), fadeOut = 1 - win(t, T + .35, T + .7);
    if (sc <= .02 || fadeOut <= 0) return;
    const S = Spr();
    if (S) S.shadow(ctx, fx.bx + fx.f * 40 * sc, fx.by + 2, 150 * sc, .35);
    const inhale = t > .5 && t < T, swell = inhale ? 1 + .1 * easeOut((t - .5) / (T - .5)) + .025 * Math.sin(time * 14) : 1;
    ctx.save(); ctx.globalAlpha = fadeOut; ctx.translate(fx.bx, fx.by); ctx.scale(fx.f * sc, sc * swell);
    ctx.drawImage(bakuSpr(inhale), -BK.ox, -BK.oy);
    ctx.restore();
  }
  function bakuO(ctx, fx, time) {
    const K = Kit(), t = fx.age, T = fx.T, sc = bakuScale(t);
    const mouthX = fx.bx + fx.f * (BK.mx - BK.ox) * BS, mouthY = fx.by - (BK.oy - BK.my) * BS;
    if (t < 1.0) K.fx.smokePoof(ctx, fx.bx + fx.f * 40, fx.by, 300, t / 1.0);
    if (t > T + .25 && t < T + 1.25) K.fx.smokePoof(ctx, fx.bx + fx.f * 40, fx.by, 300, t - T - .25);
    if (t > .5 && t < T && sc > 0) {
      const k = win(t, .5, .8);
      // everything inside the cone streams into the maw
      ctx.lineCap = 'round';
      for (const [style, w] of [[`rgba(26,22,34,${.42 * k})`, 4.6], [`rgba(250,248,255,${.85 * k})`, 1.8]]) {
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
        for (let i = 0; i < 26; i++) {
          const ph = frac(time * 1.25 + hash(i * 2.1 + fx.seed)), an = fx.a + (hash(i * 3.7 + fx.seed) - .5) * 2 * BAKU_HALF, dist = BAKU_LEN * (.2 + .8 * hash(i * 5.3));
          const sx = fx.mx + Math.cos(an) * dist, sy = fx.my + Math.sin(an) * dist - 20;
          const e1 = easeIn(ph), e2 = easeIn(Math.min(1, ph + .09));
          const x1 = lerp(sx, mouthX, e1), y1 = lerp(sy, mouthY, e1) - bell(e1) * 40, x2 = lerp(sx, mouthX, e2), y2 = lerp(sy, mouthY, e2) - bell(e2) * 40;
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        }
        ctx.stroke();
      }
      // dust, rocks, leaves and roof tiles torn loose and sucked in
      const dust = K.puff('dust');
      for (let i = 0; i < 14; i++) {
        const ph = frac(time * .8 + hash(i * 6.1 + fx.seed)), an = fx.a + (hash(i * 1.9) - .5) * 2 * BAKU_HALF * .85, dist = BAKU_LEN * (.35 + .6 * hash(i * 8.3));
        const sx = fx.mx + Math.cos(an) * dist, sy = fx.my + Math.sin(an) * dist, e = easeIn(ph);
        const x = lerp(sx, mouthX, e), y = lerp(sy, mouthY, e) - bell(e) * 60, s = 1 - e * .7;
        if (i % 3 === 0) K.stamp(ctx, dust, x, y - 10, 22 * s + 8, .6 * k * (1 - e * .5), .8);
        else if (i % 3 === 1) drawRock(ctx, i, x, y, 9 * s + 3, time * 9 + i, k);
        else if (i % 2) leaf(ctx, x, y, time * 12 + i, 6 * s + 2, '#6aa84a');
        else { ctx.save(); ctx.translate(x, y); ctx.rotate(time * 10 + i); ctx.fillStyle = '#b9472f'; ctx.fillRect(-7 * s - 2, -4 * s - 1, 14 * s + 4, 8 * s + 2); ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = 1.5; ctx.strokeRect(-7 * s - 2, -4 * s - 1, 14 * s + 4, 8 * s + 2); ctx.restore(); }
      }
      // the dark vortex in its throat
      K.spin(ctx, darkSwirl(), mouthX, mouthY, 36, -time * 14 * fx.f, .85 * k);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, mouthX, mouthY, 70, '220,210,255', .35 * k);
      K.glow(ctx, mouthX, mouthY, 26, '255,255,255', .5 * k, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the jaws snap shut
    if (t >= T && t < T + .45) {
      const q = (t - T) / .45, gx = fx.mx + Math.cos(fx.a) * 40, gy = fx.my + Math.sin(fx.a) * 40;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, mouthX, mouthY, 140 + q * 120, '255,235,215', 1 - q, true);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(30,20,30,${.6 * (1 - q)})`; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const an = i * TAU / 10, r1 = 40 + q * 60, r2 = r1 + 50; ctx.moveTo(gx + Math.cos(an) * r1, gy + Math.sin(an) * r1 * .5 - 30); ctx.lineTo(gx + Math.cos(an) * r2, gy + Math.sin(an) * r2 * .5 - 30); }
      ctx.stroke();
      K.fx.shockRing(ctx, gx, gy, 240, q, 1 - q, '255,230,210');
    }
  }

  // ------------------------------------------------------------------ Mokuton: Sashiki no Jutsu
  function woodFront(fx, l) { return Math.max(0, Math.min(l.len, (fx.age - l.t0) * WOOD_SPEED)); }
  function woodG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - 1.0, fx.dur);
    for (const l of fx.lanes) {
      if (fx.age < l.t0) continue;
      const d = woodFront(fx, l);
      ctx.save(); ctx.translate(l.x0, l.y0); ctx.rotate(l.a);
      ctx.fillStyle = `rgba(66,44,24,${.3 * fade})`; ctx.fillRect(0, -24, d, 48);
      ctx.strokeStyle = `rgba(30,18,10,${.6 * fade})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 40; k < d; k += 60) { const sd = (k / 60) % 2 ? 1 : -1, j = hash(k + l.seed) * 22; ctx.moveTo(k, sd * 18); ctx.lineTo(k + 14, sd * (34 + j)); ctx.lineTo(k + 30, sd * (40 + j)); }
      ctx.stroke();
      ctx.restore();
      if ((fx.age - l.t0) * WOOD_SPEED >= l.len) {
        const ex = l.x0 + Math.cos(l.a) * l.len, ey = l.y0 + Math.sin(l.a) * l.len, v = fx.age - l.t0 - l.len / WOOD_SPEED;
        crater(ctx, ex, ey, WOOD_END * .62, fade * .9, l.seed);
        if (v < 1) Kit().fx.shockRing(ctx, ex, ey, WOOD_END * 1.7, v, 1 - v, '210,240,150');
      }
    }
  }
  const WPX = new Float32Array(64), WPY = new Float32Array(64);
  function woodO(ctx, fx, time, z) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - 1.0, fx.dur), sink = win(fx.age, fx.dur - 1.0, fx.dur);
    // his right arm bursts into a wooden mass that plunges into the ground
    if (z && fx.age < 1.3) {
      const k = Math.min(1, fx.age / .15) * (1 - win(fx.age, .9, 1.3)), f = Math.cos(fx.a) >= 0 ? 1 : -1;
      const sx = z.x - f * 6, sy = z.y - 44, gx = z.x + Math.cos(fx.a) * 40, gy = z.y + Math.sin(fx.a) * 40;
      ctx.globalAlpha = k; ctx.lineCap = 'round';
      for (let j = 0; j < 3; j++) {
        const o = (j - 1) * 9;
        ctx.strokeStyle = '#2a180c'; ctx.lineWidth = 14 - j * 2;
        ctx.beginPath(); ctx.moveTo(sx, sy + j * 4); ctx.quadraticCurveTo(sx + f * 30 + o, sy + 20, gx + o, gy); ctx.stroke();
        ctx.strokeStyle = '#86552e'; ctx.lineWidth = 9 - j * 2; ctx.stroke();
        ctx.strokeStyle = '#c48d55'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx, sy + j * 4 - 3); ctx.quadraticCurveTo(sx + f * 30 + o, sy + 17, gx + o, gy - 3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (const l of fx.lanes) {
      if (fx.age < l.t0) continue;
      const d = woodFront(fx, l), c = Math.cos(l.a), s = Math.sin(l.a);
      // the root ploughing along the ground
      let n = 0;
      for (let k = 0; k <= d && n < 60; k += 26, n++) {
        const w = Math.sin(k * .022 + l.seed) * 12 * Math.min(1, k / 120);
        WPX[n] = l.x0 + c * k - s * w; WPY[n] = l.y0 + s * k + c * w * .5 - 6;
      }
      if (n >= 2) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const [col, w, dy] of [['#2a180c', 19, 0], ['#7a4c28', 12, 0], ['#c48d55', 3.5, -3]]) {
          ctx.strokeStyle = col; ctx.lineWidth = w * (1 - sink * .6); ctx.globalAlpha = fade;
          ctx.beginPath(); ctx.moveTo(WPX[0], WPY[0] + dy); for (let i = 1; i < n; i++) ctx.lineTo(WPX[i], WPY[i] + dy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // stakes thrusting up behind the front
      for (let k = 80, i = 0; k < d; k += 82, i++) {
        const g = easeBack(Math.min(1, (d - k) / 110)), h = (38 + hash(i * 3.3 + l.seed) * 46) * g * (1 - sink);
        const lean = (hash(i * 7.1 + l.seed) - .5) * 1.1 + Math.cos(l.a) * .25;
        const w = Math.sin(k * .022 + l.seed) * 12 * Math.min(1, k / 120);
        woodSpike(ctx, l.x0 + c * k - s * w, l.y0 + s * k + c * w * .5, lean, h, 7 + hash(i) * 3, fade);
      }
      if ((fx.age - l.t0) * WOOD_SPEED < l.len) {
        const fx2 = l.x0 + c * d, fy2 = l.y0 + s * d;
        K.fx.debris(ctx, fx2, fy2, 70, frac(time * 3 + l.seed), l.seed, '#4a3020', 6);
        K.stamp(ctx, K.puff('dust'), fx2, fy2 - 14, 26, .7, .75);
        continue;
      }
      // the cluster of great stakes bursting out at the end of the lane
      const ex = l.x0 + c * l.len, ey = l.y0 + s * l.len, v = fx.age - l.t0 - l.len / WOOD_SPEED;
      for (let j = 0; j < 8; j++) {
        const an = j * TAU / 8 + l.seed, r = WOOD_END * (.15 + .55 * hash(j * 2.9 + l.seed));
        const g = easeBack(win(v, j * .025, j * .025 + .22)), h = (80 + hash(j * 4.3 + l.seed) * 70) * g * (1 - sink);
        woodSpike(ctx, ex + Math.cos(an) * r, ey + Math.sin(an) * r * .5, Math.cos(an) * .5, h, 12 + hash(j) * 5, fade);
        if (g > .9 && j % 2 === 0 && sink < .3) { const tx = ex + Math.cos(an) * r + Math.sin(Math.cos(an) * .5) * h, ty = ey + Math.sin(an) * r * .5 - Math.cos(Math.cos(an) * .5) * h; leaf(ctx, tx, ty + 8, -1.2 + j, 7, '#5fae45'); leaf(ctx, tx + 4, ty + 12, .4 + j, 6, '#8fd768'); }
      }
      if (v < 1.1) { K.fx.debris(ctx, ex, ey, WOOD_END * 1.3, v / 1.1, l.seed, '#3a2a1a', 12); dustRing(ctx, ex, ey, 60 + easeOut(v) * 90, 10, 24 + v * 30, .8 * (1 - v / 1.1), l.seed, 8 + v * 20); }
    }
  }

  // ------------------------------------------------------------------ Root ambush
  function rootG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const s of fx.spots) {
      const t = fx.age;
      if (t < s.tl) { markCircle(ctx, s.x, s.y, 80, '255,190,140', t / s.tl * .5, time, true, true); continue; }
      if (t < s.tb) {
        const k = (t - s.tl) / (s.tb - s.tl);
        markCircle(ctx, s.x, s.y, 80, '255,170,120', k, time, false, true);
        continue;
      }
      ctx.fillStyle = `rgba(36,18,10,${.42 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 58, 26, 0, 0, TAU); ctx.fill();
      cracks(ctx, s.x, s.y, 90, 6, s.seed, fade, 2);
    }
  }
  function rootO(ctx, fx, time) {
    const K = Kit(), t = fx.age, S = Spr();
    // Root ANBU flicker in, hurl their tagged kunai and vanish again in smoke
    for (const n of fx.ninjas) {
      const a = win(t, .08, .2) * (1 - win(t, .8, 1.0));
      if (S && a > .01) S.draw(ctx, 'walker', n.x, n.y + 3, { facing: fx.spots[0].x >= n.x ? 1 : -1, frame: t < .75 ? 'attack' : 'idle', alpha: a });
      if (t < .9) K.fx.smokePoof(ctx, n.x, n.y, 130, t / .9);
      if (t > .78 && t < 1.5) K.fx.smokePoof(ctx, n.x, n.y, 110, (t - .78) / .72);
    }
    for (const s of fx.spots) {
      const n = fx.ninjas[s.n];
      if (t >= s.tt && t < s.tl && n) {
        const k = (t - s.tt) / (s.tl - s.tt), x = lerp(n.x, s.x, k), y = lerp(n.y - 40, s.y, k) - bell(k) * 90;
        const x2 = lerp(n.x, s.x, k + .05), y2 = lerp(n.y - 40, s.y, k + .05) - bell(k + .05) * 90;
        const ang = Math.atan2(y2 - y, x2 - x);
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * 30, y - Math.sin(ang) * 30); ctx.stroke();
        kunai(ctx, x, y, ang, 1.3);
        tag(ctx, x - Math.cos(ang) * 16, y - Math.sin(ang) * 16 + 4, ang + 1.4, 5, 0);
      } else if (t >= s.tl && t < s.tb) {
        // the kunai stands in the ground, its tag hissing and glowing
        const k = (t - s.tl) / (s.tb - s.tl), blink = Math.sin(time * (14 + k * 30)) > 0 ? 1 : 0;
        kunai(ctx, s.x, s.y - 6, -Math.PI / 2 + s.rot, 1.3);
        tag(ctx, s.x + 4, s.y - 22, s.rot + .2, 6, blink * k);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, s.x + 4, s.y - 22, 22 + 20 * k, '255,120,60', (.3 + .5 * k) * (.5 + .5 * blink));
        ctx.globalCompositeOperation = 'source-over';
        // fizzing sparks
        ctx.fillStyle = '#ffd36a';
        for (let i = 0; i < 3; i++) { const ph = frac(time * 3 + i / 3 + s.seed), an = hash(i + s.seed + Math.floor(time * 3)) * TAU; ctx.fillRect(s.x + 4 + Math.cos(an) * ph * 16, s.y - 30 - ph * 14 + Math.sin(an) * ph * 8, 2, 2); }
      } else if (t >= s.tb) {
        const v = t - s.tb;
        if (v < 1.1) K.fx.fireBlast(ctx, s.x, s.y, 88, v, 1 - v / 1.1, time, s.seed);
      }
    }
  }

  // ------------------------------------------------------------------ Ura Shishō Fūinjutsu
  function fuinRadius(fx) {
    const t = fx.age, T = fx.T, R = fx.R * .84;
    if (t < 1.05) return R * easeOut(t / 1.05);
    if (t < T - .3) return R * (1 + .015 * Math.sin(t * 9));
    if (t < T) return R * (1 - easeIn((t - T + .3) / .3));
    return 0;
  }
  function fuinG(ctx, fx, time) {
    const K = Kit(), t = fx.age, T = fx.T, R = fx.R;
    if (t < T + .05) {
      const k = easeOut(win(t, 0, .8));
      ctx.fillStyle = `rgba(10,6,16,${.12 + .22 * win(t, .6, T)})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, R * k, 0, TAU); ctx.fill();
      sealCircle(ctx, fx.x, fx.y, R * k, time, fx.seed, 1);
      // ripples sucked inward
      ctx.strokeStyle = 'rgba(200,180,255,.4)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const ph = frac(time * .8 + i / 3), r = R * (1.3 - ph * 1.1); ctx.moveTo(fx.x + r, fx.y); ctx.ellipse(fx.x, fx.y, r, r * .5, 0, 0, TAU); }
      ctx.stroke();
      return;
    }
    const u = t - T, fade = 1 - win(u, 1.8, fx.dur - T);
    crater(ctx, fx.x, fx.y, R * .6, fade, fx.seed);
    cracks(ctx, fx.x, fx.y, R * 1.3, 16, fx.seed + 1, fade, 3.5);
    sealCircle(ctx, fx.x, fx.y, R * (1 + u * .08), time, fx.seed, .55 * (1 - win(u, 0, 1.4)));
    if (u < 1.2) { K.fx.shockRing(ctx, fx.x, fx.y, R * 1.3, u / 1.2, 1 - u / 1.2, '190,170,255'); K.fx.shockRing(ctx, fx.x, fx.y, R * 1.75, u / 1.2, (1 - u / 1.2) * .6, '255,245,255'); }
    if (u > .1 && u < 1.4) K.fx.shockRing(ctx, fx.x, fx.y, R * .95, (u - .1) / 1.3, (1.4 - u) * .7, '30,20,40');
    dustRing(ctx, fx.x, fx.y, R * (.5 + easeOut(u / 1.6) * .7), 26, 40 + u * 40, .85 * (1 - win(u, 1, 2.6)), fx.seed, 10 + u * 20);
  }
  // Black seal script crawling over Danzō's body.
  function bodyScript(ctx, z, time, k) {
    if (k <= .01) return;
    const H = HEIGHT();
    ctx.save(); ctx.globalAlpha = Math.min(1, k);
    ctx.strokeStyle = 'rgba(10,6,14,.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    for (let i = 0; i < 5; i++) {
      const y = z.y - 6 - i * H * .17 * Math.min(1, k * 1.4), r = 16 - i * 1.4;
      ctx.lineDashOffset = time * 30 * (i % 2 ? 1 : -1);
      ctx.beginPath(); ctx.ellipse(z.x, y, r, r * .32, 0, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 10; i++) {
      const gx = z.x + (hash(i * 3.3) - .5) * 26, gy = z.y - 8 - hash(i * 5.1) * H * .8 * Math.min(1, k * 1.3);
      ctx.drawImage(glyphSpr(i), gx - 6, gy - 6, 12, 12);
    }
    ctx.restore();
  }
  function fuinO(ctx, fx, time, z) {
    const K = Kit(), t = fx.age, T = fx.T, R = fx.R, x = fx.x, y = fx.y;
    if (z && t < T) bodyScript(ctx, z, time, 1);
    const r = fuinRadius(fx), cy = y - r * .3;
    if (r > 6) {
      // pull streaks rushing in toward the sphere
      ctx.lineCap = 'round';
      for (const [style, w] of [['rgba(14,8,20,.5)', 4.2], ['rgba(225,210,255,.75)', 1.6]]) {
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
        for (let i = 0; i < 20; i++) {
          const an = hash(i * 3.1 + fx.seed) * TAU, ph = frac(time * 1.4 + hash(i * 1.7)), d0 = r * (1.05 + (1 - ph) * .7), d1 = d0 + 50;
          ctx.moveTo(x + Math.cos(an) * d1, cy + Math.sin(an) * d1 * .7); ctx.lineTo(x + Math.cos(an) * d0, cy + Math.sin(an) * d0 * .7);
        }
        ctx.stroke();
      }
      // the black sphere of the seal
      ctx.fillStyle = 'rgba(4,2,8,.52)'; ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU); ctx.fill();
      K.spin(ctx, darkSwirl(), x, cy, r * .96, time * 1.2, .3);
      ctx.strokeStyle = 'rgba(6,2,10,.75)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160,130,240,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, cy, r - 7, 0, TAU); ctx.stroke();
      K.glow(ctx, x, cy, r * 1.15, '110,80,200', .22);
      ctx.globalCompositeOperation = 'source-over';
      // meridians and bands of glowing script turning over its surface
      ctx.strokeStyle = 'rgba(200,180,255,.35)'; ctx.lineWidth = 1.6;
      for (const k of [.35, .72]) { ctx.beginPath(); ctx.ellipse(x, cy, r * k, r, 0, 0, TAU); ctx.stroke(); }
      for (let b = 0; b < 3; b++) {
        const lat = (b - 1) * .55, ly = cy - Math.sin(lat) * r, rr = r * Math.cos(lat), n = 18, dir = b % 2 ? 1 : -1;
        ctx.strokeStyle = 'rgba(200,180,255,.3)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, ly, rr, rr * .3, 0, 0, TAU); ctx.stroke();
        for (let j = 0; j < n; j++) {
          const lon = j / n * TAU + time * .7 * dir, cz = Math.cos(lon);
          if (cz < -.1) continue;
          const gs = (10 + rr * .05) * (.55 + .45 * cz);
          ctx.globalAlpha = .45 + .5 * cz;
          ctx.drawImage(glyphSpr(j + b * 3, true), x + Math.sin(lon) * rr - gs / 2, ly + cz * rr * .3 - gs / 2, gs, gs);
        }
        ctx.globalAlpha = 1;
      }
    }
    // the collapse: an instant of white, black shards driven inward, then the blast outward
    if (t > T - .3 && t < T + .6) {
      const q = (t - T + .3) / .9;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y - 60, R * (.4 + q * 1.4), '235,220,255', bell(q) * .9, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (t >= T && t < T + 1.8) {
      const u = t - T;
      if (u < .35) {
        ctx.strokeStyle = `rgba(8,4,12,${.8 * (1 - u / .35)})`; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath();
        for (let i = 0; i < 24; i++) {
          const an = i * TAU / 24 + hash(i + fx.seed) * .2, r1 = R * (.2 + u * 2.4), r2 = r1 + 70 + hash(i * 3) * 80;
          ctx.moveTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1 * .55 - 40); ctx.lineTo(x + Math.cos(an) * r2, y + Math.sin(an) * r2 * .55 - 40);
        }
        ctx.stroke();
      }
      K.fx.debris(ctx, x, y, R * 1.2, u / 1.6, fx.seed, '#2a2030', 22);
      for (let i = 0; i < 14; i++) {
        const an = i * TAU / 14 + hash(fx.seed + i), dd = R * (.2 + easeOut(u * 1.1) * (.7 + hash(i * 2.2) * .4)), h = bell(u / 1.4) * (80 + hash(i * 5) * 150);
        drawRock(ctx, i, x + Math.cos(an) * dd, y + Math.sin(an) * dd * .5 - h, 10 + hash(i * 7.7) * 12, u * 7 + i, 1 - win(u, 1.1, 1.7));
      }
      const smoke = K.puff('smoke'), s = win(u, .1, 1.8);
      for (let i = 0; i < 8; i++) {
        const an = i * TAU / 8 + fx.seed;
        K.stamp(ctx, smoke, x + Math.cos(an) * R * .5, y + Math.sin(an) * R * .25 - 30 - s * 160 - hash(i) * 50, 50 + s * 60, bell(s) * .6, .8);
      }
    }
  }

  // ------------------------------------------------------------------ Izanagi
  function izDeathG(ctx, fx, time) {
    const t = fx.age, S = Spr();
    const pool = easeOut(t / .5) * (1 - win(t, 1.2, fx.dur));
    ctx.fillStyle = `rgba(110,10,18,${.6 * pool})`; ctx.beginPath(); ctx.ellipse(fx.x - fx.f * 10, fx.y + 5, 34 * pool + 4, 12 * pool + 2, 0, 0, TAU); ctx.fill();
    // the corpse lies there... then flickers and is gone: the death was the illusion
    const a = t < .5 ? 1 : (1 - win(t, .5, IZ_SWAP + .1)) * (Math.sin(time * 70) > -.3 ? 1 : .35);
    if (S && a > .01) S.drawFallen(ctx, 'danzo', fx.x, fx.y + 3, { facing: fx.f, alpha: a });
    if (t > .4 && t < 1.6) {
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5);
      for (let i = 0; i < 3; i++) {
        const ph = frac((t - .4) * 1.4 + i / 3), r = 20 + ph * 150;
        ctx.strokeStyle = `rgba(90,0,10,${.5 * (1 - ph)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,120,120,${.6 * (1 - ph)})`; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.restore();
    }
  }
  function izDeathO(ctx, fx, time) {
    const K = Kit(), t = fx.age;
    if (t < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 40, 120, '255,60,60', (1 - t / .25) * .8, true); ctx.globalCompositeOperation = 'source-over'; }
    // the body breaks up into motes of chakra drifting away
    if (t > .5 && t < 1.5) {
      const q = (t - .5) / 1.0;
      ctx.fillStyle = `rgba(30,10,20,${.7 * (1 - q)})`;
      for (let i = 0; i < 16; i++) {
        const x = fx.x + (hash(i * 2.1) - .5) * 70 + Math.sin(time * 3 + i) * 6, y = fx.y - 6 - hash(i * 4.3) * 20 - q * (40 + hash(i) * 70);
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) K.glow(ctx, fx.x + (hash(i * 5.5) - .5) * 60, fx.y - 10 - q * 60 - hash(i) * 30, 10, '255,90,90', .7 * (1 - q));
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function izRiseG(ctx, fx, time) {
    const K = Kit(), t = fx.age;
    if (t < 1) { K.fx.shockRing(ctx, fx.x, fx.y, 200, t, 1 - t, '255,90,90'); K.fx.shockRing(ctx, fx.x, fx.y, 130, Math.min(1, t * 1.4), (1 - t) * .8, '40,0,10'); }
  }
  function izRiseO(ctx, fx, time) {
    const K = Kit(), t = fx.age, H = HEIGHT();
    const open = t < .3 ? easeOut(t / .3) : 1 - easeInOut(win(t, .6, 1.05)), alpha = 1 - win(t, 1.4, fx.dur);
    const ex = fx.x, ey = fx.y - H - 80;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, ex, ey, 90, '255,40,50', .55 * alpha);
    if (t < .2) K.glow(ctx, fx.x, fx.y - 40, 160, '255,200,200', 1 - t / .2, true);
    ctx.globalCompositeOperation = 'source-over';
    bigEye(ctx, ex, ey, 34, open, time, alpha);
    // the closed eye weeps a line of blood
    if (t > 1.0) { ctx.strokeStyle = `rgba(150,10,20,${alpha})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex + 4, ey + 3); ctx.lineTo(ex + 6, ey + 3 + Math.min(18, (t - 1) * 40)); ctx.stroke(); }
  }

  const FX = {
    renpa: [renpaG, renpaO], ball: [ballG, ballO], dtele: [dteleG, null], slash: [slashG, slashO], xcut: [xcutG, xcutO],
    baku: [bakuG, bakuO], wood: [woodG, woodO], root: [rootG, rootO], fuin: [fuinG, fuinO],
    izDeath: [izDeathG, izDeathO], izRise: [izRiseG, izRiseO]
  };

  // ------------------------------------------------------------------ windup looks
  function mouthPos(z, f) { const H = HEIGHT(); return { x: z.x + f * 8, y: z.y + 3 - H * .7 }; }
  function windupG(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, move = st.move, f = Math.cos(st.aim) >= 0 ? 1 : -1;
    if (move === 'renpa' || move === 'daigyoku' || move === 'kunai') {
      // wind spiralling round his feet
      ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5); ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const r = 40 + i * 16 + 20 * k, a0 = time * (8 - i) + i * 1.7;
        ctx.strokeStyle = 'rgba(20,56,66,.4)'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(240,252,255,.85)'; ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.restore();
    } else if (move === 'baku') {
      seal(ctx, z.x + f * 16, z.y + 4, 50 + 100 * easeOut(k), Math.min(1, k * 3), time, 3.3);
    } else if (move === 'mokuton') {
      cracks(ctx, z.x + Math.cos(st.aim) * 30, z.y + Math.sin(st.aim) * 30, 60 + 90 * k, 8, 7.7, Math.min(1, k * 2), 2.2);
    } else if (move === 'fuin') {
      sealCircle(ctx, z.x, z.y, 90 + (FUIN_R - 90) * easeOut(k), time, 5.5, Math.min(1, k * 2.5));
    } else if (move === 'root' && st.ninjas) {
      for (const n of st.ninjas) { ctx.fillStyle = `rgba(10,8,14,${.35 * k})`; ctx.beginPath(); ctx.ellipse(n.x, n.y + 2, 22, 8, 0, 0, TAU); ctx.fill(); }
    }
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, f = Math.cos(st.aim) >= 0 ? 1 : -1;
    const mp = mouthPos(z, f), hx = z.x + f * 18, hy = z.y - LIFT() - 10;
    switch (move) {
      case 'renpa': case 'daigyoku': {
        // a deep breath: air streaming into his mouth, chest swelling
        const big = move === 'daigyoku';
        ctx.lineCap = 'round';
        for (const [style, w] of [['rgba(20,56,66,.45)', 4], ['rgba(255,255,255,.92)', 1.6]]) {
          ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
          for (let i = 0; i < (big ? 16 : 11); i++) {
            const an = hash(i * 3.1) * TAU, q = frac(time * (big ? 2.2 : 1.8) + hash(i * 1.7)), d0 = (big ? 200 : 150) * (1 - q) + 14, d1 = d0 + 36;
            ctx.moveTo(mp.x + Math.cos(an) * d1, mp.y + Math.sin(an) * d1 * .7); ctx.lineTo(mp.x + Math.cos(an) * d0, mp.y + Math.sin(an) * d0 * .7);
          }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - 46, 30 + 30 * e, '170,235,255', .35);
        ctx.globalCompositeOperation = 'source-over';
        if (big && k > .45) {
          // the vacuum sphere already condensing in front of his lips
          const r = 8 + 34 * easeOut((k - .45) / .55), bx = mp.x + Math.cos(st.aim) * (16 + r), by = mp.y + Math.sin(st.aim) * (8 + r * .5);
          ctx.strokeStyle = 'rgba(22,58,70,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.stroke();
          ctx.drawImage(ballSpr(), bx - r, by - r, r * 2, r * 2);
          ctx.globalCompositeOperation = 'lighter'; K.spin(ctx, windSwirl(), bx, by, r * .9, time * 12, .6); ctx.globalCompositeOperation = 'source-over';
        }
        break;
      }
      case 'kunai': {
        // wind chakra flows into the kunai: the edge grows into a long pale blade
        const L = 18 + 40 * e, a = st.aim, c = Math.cos(a), s = Math.sin(a);
        kunai(ctx, hx, hy, a, 1.3);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(20,56,66,.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hx + c * 16, hy + s * 16); ctx.lineTo(hx + c * (16 + L), hy + s * (16 + L)); ctx.stroke();
        ctx.strokeStyle = 'rgba(235,252,255,.95)'; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, hx + c * (16 + L), hy + s * (16 + L), 18 + 10 * Math.sin(time * 30), '200,245,255', .9, true);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'baku': {
        const smoke = K.puff('smoke'), sx = z.x + f * 16, sy = z.y + 4;
        for (let i = 0; i < 6; i++) { const ph = frac(time * 1.4 + i / 6); K.stamp(ctx, smoke, sx + Math.sin(i * 2.3 + time) * 40 * e, sy - ph * 70, 14 + 16 * ph, bell(ph) * .55 * Math.min(1, k * 2), .8); }
        break;
      }
      case 'mokuton': {
        // bark tendrils writhing out of the bandaged arm, leaves sprouting
        const sx = z.x - f * 6, sy = z.y - 46;
        ctx.lineCap = 'round';
        for (let j = 0; j < 5; j++) {
          const an = -Math.PI / 2 + (j - 2) * .55 + Math.sin(time * 6 + j) * .25, L = (16 + 22 * e) * (.7 + hash(j) * .5);
          const ex = sx + Math.cos(an) * L * 1.3, ey = sy + Math.sin(an) * L + 18;
          ctx.strokeStyle = '#2a180c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sx, sy + 8); ctx.quadraticCurveTo(sx + Math.cos(an + 1) * L * .6, sy + Math.sin(an + 1) * L * .6 + 10, ex, ey); ctx.stroke();
          ctx.strokeStyle = '#9a6a3a'; ctx.lineWidth = 3.4; ctx.stroke();
          if (k > .4) leaf(ctx, ex, ey, an, 5, j % 2 ? '#6cc04e' : '#a6e57c');
        }
        // the Sharingan embedded in Hashirama's cells open along the arm (spent ones stay shut)
        for (let i = 0; i < 3; i++) bigEye(ctx, sx - f * (1 + i * 1.5), sy + 8 + i * 8, 4.2, i < st.izLeft ? Math.min(1, k * 2.5) : 0, time, 1);
        break;
      }
      case 'root': {
        if (st.ninjas) {
          const smoke = K.puff('smoke');
          for (const n of st.ninjas) for (let i = 0; i < 3; i++) K.stamp(ctx, smoke, n.x + Math.sin(time * 5 + i * 2) * 14, n.y - 20 - i * 14, 16 + 6 * i, .35 * k * (Math.sin(time * 18 + i) > 0 ? 1 : .6), .8);
        }
        break;
      }
      case 'fuin': {
        bodyScript(ctx, z, time, k);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - 46, 50 + 60 * e, '120,90,210', .3);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }
  }

  function label(ctx, z, st, m) {
    let move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    const rise = st.fx.find(f => f.kind === 'izRise' && f.age < 1.3);
    if (rise) move = 'izanagi';
    if (!move || !MOVES[move]) return;
    const top = z.y - HEIGHT() - 32;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#10121a'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = move === 'izanagi' ? '#ff6a6a' : m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }
  // Izanagi charges: the Sharingan left on his arm, beside the health bar (closed once spent).
  function izIcons(ctx, z, st) {
    const barY = z.y + 3 - HEIGHT() - 14, x0 = z.x + 50 + 9;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * 13, y = barY + 3.5, open = i < st.izLeft;
      ctx.fillStyle = 'rgba(8,10,16,.82)'; ctx.beginPath(); ctx.ellipse(x, y, 6.4, 4.4, 0, 0, TAU); ctx.fill();
      if (open) {
        ctx.fillStyle = '#f6eee6'; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x, y - 5, x + 5, y); ctx.quadraticCurveTo(x, y + 5, x - 5, y); ctx.fill();
        ctx.fillStyle = '#d0141e'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#16040a'; ctx.beginPath(); ctx.arc(x, y, .9, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = '#7a7480'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 4.5, y - .5); ctx.quadraticCurveTo(x, y + 2.5, x + 4.5, y - .5); ctx.stroke();
      }
    }
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.iz = null;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
    st.ghosts.length = 0;
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.dz;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    if (!st.fx.length && !(st.windup > 0) && z.health <= 0) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.windup > 0 && st.move && !st.iz) {
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
    const m = members[z.bossId], st = z.dz;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    // afterimages left by the vacuum-blade dashes
    const S = Spr();
    if (S && st.ghosts.length) {
      for (const g of st.ghosts) S.draw(ctx, 'danzo', g.x, g.y + 3, { facing: g.f, frame: 'attack', alpha: .38 * (1 - g.age / .32) });
      ctx.globalAlpha = 1;
    }
    if (z.health > 0 && !(st.iz && !st.iz.moved)) {
      if (st.windup > 0 && st.move) {
        windupO(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      label(ctx, z, st, m);
      izIcons(ctx, z, st);
    }
    ctx.restore();
  }

  function hidden(z) { const st = z.dz; return !!(st && st.iz && !st.iz.moved); }

  window.DanzoBoss = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden };
})();
