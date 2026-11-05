(() => {
  'use strict';

  // Zetsu, Black and White (spawn panel, faction 'zetsu'). Contract as nagato-boss.js: update(z, dt, api)
  // drives the jutsu, draw(ctx, z, time) paints the ground layer (telegraphs, furrows, holes, roots),
  // drawOverlay(ctx, z, time) what stands above the characters (flytrap jaws, wooden stakes, spores,
  // Black Zetsu's goo). All per-boss state lives on z.zt. Moves: the Mayfly ground-merge (burrow travel and
  // an eruption under the target), Spore Technique pods that sprout and drain, Wood Release thorn lanes,
  // Black Zetsu's body latch, the White Zetsu army, giant flytrap jaws, the closing wood prison and the
  // ultimate spore storm.
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

  const order = ['zetsu'];
  const members = {
    zetsu: {
      name: 'ZETSU — HẮC BẠCH ZETSU', short: 'ZETSU', accent: '#7fd06a', hpScale: 3.8, damageScale: 2.0, armor: .9,
      // Every jutsu shows once in the first ~25 s; the second lap reorders them.
      moves: ['burrow', 'spore', 'thorns', 'latch', 'army', 'jaws', 'cage', 'storm',
        'burrow', 'thorns', 'spore', 'jaws', 'latch', 'cage', 'army', 'burrow', 'storm']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    burrow: { label: 'PHÙ DU CHI THUẬT', rgb: '150,225,110', windup: .4, after: .9 },
    spore:  { label: 'BÀO TỬ THUẬT', rgb: '236,246,222', windup: .9, after: 1.7 },
    thorns: { label: 'MỘC ĐỘN · THỤ THÍCH TRẬN', rgb: '214,160,96', windup: .95, after: 1.6 },
    latch:  { label: 'HẮC ZETSU · KÝ SINH THỂ', rgb: '176,150,226', windup: .8, after: 1.5 },
    army:   { label: 'BẠCH ZETSU · ĐẠI QUÂN', rgb: '238,238,224', windup: .9, after: 1.6 },
    jaws:   { label: 'BỘ TRÙNG THẢO · GIẢO SÁT', rgb: '160,232,104', windup: 1.0, after: 1.8 },
    cage:   { label: 'MỘC ĐỘN · MỘC LAO PHƯỢC', rgb: '206,164,100', windup: .9, after: 2.0 },
    storm:  { label: 'BÀO TỬ THUẬT · VẠN BÀO PHONG BẠO', rgb: '214,255,190', windup: 1.3, after: 3.0 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const SINK_T = .55, RISE_T = .75, EMERGE_T = .5, DIG_SPEED = 980, ERUPT_R = 150;
  const THORN_LEN = 1050, THORN_SPEED = 1500, THORN_W = 48;
  const LATCH_LEN = 780, LATCH_SPEED = 1700, LATCH_W = 34, LATCH_T = 3.0;
  const CAGE_R = 400, CAGE_T = 1.15;
  const STORM_R = 680, STORM_T = 2.7;
  const MAX_ARMIES = 4, MAX_SPORE_CLONES = 9;

  function pick() { return order[0]; }
  // Manual control (team mode): keys 1..8 in this order, the spore storm (the ultimate) last.
  const KEYS = ['burrow', 'spore', 'thorns', 'latch', 'army', 'jaws', 'cage', 'storm'];
  const moves = () => KEYS.map(k => ({ label: MOVES[k].label }));
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.zt || (z.zt = { t: 0, casts: 0, armies: 0, sporeClones: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], force: null, hold: 0, holdMove: '', under: null, guardHp: z.health, latch: null, plan: null, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = Math.random() * 99;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });
  function freeSpot(api, x, y, r) {
    if (!api.blocked(x, y, r)) return [x, y];
    for (let d = 40; d <= 320; d += 40) for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + d * .01, nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d;
      if (!api.blocked(nx, ny, r)) return [nx, ny];
    }
    return [x, y];
  }

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty;
    const circ = (cx, cy, r, faint, small) => ({ k: 'c', x: cx, y: cy, r, faint, small });
    switch (move) {
      case 'spore': {
        // Pods arc out over a wide cone toward the target and round it.
        const pods = [], d0 = Math.hypot(tx - x, ty - y);
        for (let i = 0; i < 20; i++) {
          let px, py;
          if (i < 7) { const b = i * TAU / 7 + Math.random() * .4, r = i ? rand(110, 210) : 0; px = tx + Math.cos(b) * r; py = ty + Math.sin(b) * r; }
          else { const b = a + rand(-.62, .62), r = rand(220, Math.max(380, Math.min(720, d0 + 260))); px = x + Math.cos(b) * r; py = y + Math.sin(b) * r; }
          pods.push({ x1: px, y1: py, tf: rand(.5, .78) + i * .025, h: rand(110, 190), seed: Math.random() * 99 });
        }
        st.plan = pods;
        return pods.map(p => circ(p.x1, p.y1, 64, true, true));
      }
      case 'thorns': {
        st.plan = [-.26, 0, .26].map(o => ({ a: a + o, x0: x + Math.cos(a + o) * 40, y0: y + Math.sin(a + o) * 40 }));
        return st.plan.map(l => ({ k: 'line', x: l.x0, y: l.y0, a: l.a, len: THORN_LEN, w: THORN_W }));
      }
      case 'latch': return [{ k: 'line', x, y, a, len: LATCH_LEN, w: LATCH_W }];
      case 'army': {
        const spots = [], n = 10, b = Math.random() * TAU;
        for (let i = 0; i < n; i++) { const aa = b + i * TAU / n, r = rand(150, 250); spots.push({ x: x + Math.cos(aa) * r, y: y + Math.sin(aa) * r, t0: i * .045 + Math.random() * .06 }); }
        st.plan = spots;
        return spots.map(s => circ(s.x, s.y, 40, true, true));
      }
      case 'jaws': {
        const spots = [{ x: tx, y: ty, t0: .05 }], b = Math.random() * TAU;
        for (let i = 0; i < 6; i++) { const aa = b + i * TAU / 6; spots.push({ x: tx + Math.cos(aa) * 210, y: ty + Math.sin(aa) * 210, t0: .18 + i * .09 }); }
        for (let i = 0; i < 4; i++) { const aa = b + (i + .5) * TAU / 4 + .3; spots.push({ x: tx + Math.cos(aa) * 400, y: ty + Math.sin(aa) * 400, t0: .78 + i * .08 }); }
        st.plan = spots;
        return spots.map((s, i) => circ(s.x, s.y, i ? 100 : 120, false, i > 6));
      }
      case 'cage': return [circ(tx, ty, CAGE_R, false), circ(tx, ty, 150, true)];
      case 'storm': return [circ(tx, ty, STORM_R, true), circ(tx, ty, 360, true)];
    }
    return [];
  }

  function announce(z, st, m, api) {
    let move = st.force;
    if (move && MOVES[move]) st.force = null;
    else {
      move = m.moves[st.casts % m.moves.length]; st.casts++;
      // The White Zetsu army comes a few times per fight; past that, a flytrap field instead.
      if (move === 'army' && st.armies >= MAX_ARMIES) move = 'jaws';
    }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.tele = teleFor(z, st, move);
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60;
    api.burst(z.x, z.y - 30, m.accent, 10);
    switch (move) {
      case 'burrow':
        st.under = { phase: 'sink', t: 0, trail: [z.x, z.y], sx: z.x, sy: z.y };
        st.hold = 99; st.holdMove = 'burrow'; st.guardHp = z.health;
        addFx(st, { kind: 'hole', x: z.x, y: z.y, dur: 1.8 });
        api.burst(z.x, z.y, '#8a6a44', 12); api.shake(5);
        break;
      case 'spore': {
        const pods = st.plan || [], hx = z.x, hy = z.y - LIFT() - 34;
        let last = 0;
        pods.forEach((p, i) => {
          p.x0 = hx; p.y0 = hy; last = Math.max(last, p.tf);
          later(st, p.tf, api => {
            api.strike(p.x1, p.y1, 64, D * .95, null, i % 7 === 0 ? 'crater' : null, true);
            if (i % 5 === 0) api.shake(5);
          });
        });
        addFx(st, { kind: 'spore', pods, last, tick: last + .5, ticks: 0, dur: last + 4.6, upd: sporeUpd, dmg: D, a: st.aim, hx, hy });
        // A few spores ripen into White Zetsu clones.
        if (st.sporeClones < MAX_SPORE_CLONES) later(st, last + 2.4, api => {
          for (let i = 0; i < 3 && st.sporeClones < MAX_SPORE_CLONES; i++) {
            const p = pods[(i * 7 + 3) % pods.length];
            if (p && api.summon('zetsu_white', p.x1, p.y1)) { st.sporeClones++; api.burst(p.x1, p.y1 - 20, '#f2f2e6', 8); }
          }
        });
        st.plan = null;
        api.shake(6);
        break;
      }
      case 'thorns': {
        const lanes = st.plan || [];
        lanes.forEach(l => {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 60, i = 0; d <= THORN_LEN; d += 78, i++) {
            const x = l.x0 + c * d, y = l.y0 + s * d;
            later(st, .06 + d / THORN_SPEED, api => {
              api.strike(x, y, 74, D * 1.25, null, i % 4 === 3 ? 'earth' : null, true);
              if (i % 4 === 0) api.shake(6);
            });
          }
        });
        addFx(st, { kind: 'thorns', lanes, dur: .06 + THORN_LEN / THORN_SPEED + 2.2 });
        st.plan = null;
        api.shake(7);
        break;
      }
      case 'latch': {
        const a = st.aim, x0 = z.x, y0 = z.y;
        const f = addFx(st, { kind: 'tendril', x0, y0, a, len: LATCH_LEN, hit: null, back: 0, dur: LATCH_LEN / LATCH_SPEED + .9 });
        // The goo races down the line; whoever it touches first is latched onto.
        later(st, LATCH_LEN / LATCH_SPEED * .55, api => latchCheck(z, st, f, api, D));
        later(st, LATCH_LEN / LATCH_SPEED, api => { if (!f.hit) { latchCheck(z, st, f, api, D); if (!f.hit) api.line(x0, y0, x0 + Math.cos(a) * LATCH_LEN, y0 + Math.sin(a) * LATCH_LEN, LATCH_W, D * .8, null); } });
        break;
      }
      case 'army': {
        const spots = st.plan || [];
        st.armies++;
        addFx(st, { kind: 'army', spots, dur: 2.4 });
        spots.forEach((s, i) => later(st, s.t0 + .62, api => {
          const [sx, sy] = freeSpot(api, s.x, s.y, 18);
          if (api.summon('zetsu_white', sx, sy)) api.burst(sx, sy - 18, '#f4f4ea', 6);
          if (i % 3 === 0) api.shake(4);
        }));
        st.plan = null;
        break;
      }
      case 'jaws': {
        const spots = st.plan || [];
        const list = spots.map((s, i) => ({ x: s.x, y: s.y, s: i ? .82 : 1.05, t0: s.t0, snap: s.t0 + .2, seed: i * 3.7 }));
        list.sort((p, q) => p.y - q.y);
        addFx(st, { kind: 'jaws', list, dur: 2.6 });
        for (const j of list) later(st, j.snap, api => {
          api.strike(j.x, j.y, j.s > 1 ? 120 : 100, D * 1.6, null, j.s > 1 ? 'crater' : 'earth', true);
          api.shake(j.s > 1 ? 12 : 6);
        });
        st.plan = null;
        break;
      }
      case 'cage': {
        const tx = st.tx, ty = st.ty, well = { x: tx, y: ty };
        addFx(st, { kind: 'cage', x: tx, y: ty, R: CAGE_R, T: CAGE_T, dur: CAGE_T + 1.9 });
        for (let k = 1; k <= 5; k++) {
          const r = lerp(CAGE_R, 110, k / 5);
          later(st, CAGE_T * k / 5, api => {
            for (let i = 0; i < 14; i++) { const aa = i * TAU / 14 + k * .2; api.strike(tx + Math.cos(aa) * r, ty + Math.sin(aa) * r, 54, D * .55, null, null, true); }
            if (k < 5) api.knockback(well, r + 40, -34, 0);
            api.shake(4);
          });
        }
        later(st, CAGE_T + .05, api => {
          api.strike(tx, ty, 160, D * 2.4, '#d8b880', 'earth');
          api.world(tx, ty, 150, D * 2.2, 'earth');
          api.burst(tx, ty - 40, '#a87a48', 18);
          api.shake(16);
        });
        break;
      }
      case 'storm': {
        const tx = st.tx, ty = st.ty, R = STORM_R, well = { x: tx, y: ty };
        const jaws = [{ x: tx, y: ty, s: 1.6, t0: STORM_T - .2, snap: STORM_T + .05, seed: 1 }];
        for (let i = 0; i < 6; i++) { const aa = i * TAU / 6 + .3; jaws.push({ x: tx + Math.cos(aa) * 270, y: ty + Math.sin(aa) * 270, s: 1.15, t0: STORM_T - .1 + i * .05, snap: STORM_T + .15 + i * .04, seed: i * 2.1 }); }
        for (let i = 0; i < 8; i++) { const aa = i * TAU / 8 + .1; jaws.push({ x: tx + Math.cos(aa) * 510, y: ty + Math.sin(aa) * 510, s: .95, t0: STORM_T + i * .05, snap: STORM_T + .3 + i * .04, seed: i * 1.3 + 9 }); }
        jaws.sort((p, q) => p.y - q.y);
        addFx(st, { kind: 'storm', x: tx, y: ty, R, T: STORM_T, jaws, dur: STORM_T + 2.6 });
        st.hold = STORM_T + .3; st.holdMove = 'storm';
        // The spore cloud blinds and drains, drawing everything toward its eye...
        for (let t = .35; t < STORM_T - .2; t += .4) later(st, t, api => {
          api.strike(tx, ty, R, D * .32, null, null, true);
          api.knockback(well, R + 60, -42, 0);
          api.shake(4);
        });
        later(st, 1.2, api => { api.world(tx + 380, ty - 140, 140, D * 2, 'earth'); api.world(tx - 330, ty + 170, 140, D * 2, 'earth'); });
        // ...then every spore bursts into a flytrap and the whole field snaps shut.
        later(st, STORM_T + .05, api => {
          api.strike(tx, ty, 360, D * 3.2, '#d8ffc0', 'crater');
          api.world(tx, ty, 300, D * 4, 'crater');
          for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + .7; api.world(tx + Math.cos(aa) * 470, ty + Math.sin(aa) * 470, 160, D * 3, 'earth', aa); }
          api.burst(tx, ty - 40, '#e8ffd8', 30);
          api.shake(28);
        });
        later(st, STORM_T + .35, api => {
          for (let i = 0; i < 8; i++) { const aa = i * TAU / 8 + .1; api.strike(tx + Math.cos(aa) * 510, ty + Math.sin(aa) * 510, 110, D * 1.4, null, null, true); }
          api.shake(14);
        });
        if (st.armies < MAX_ARMIES + 2) later(st, STORM_T + 1.0, api => {
          st.armies++;
          for (let i = 0; i < 8; i++) { const aa = i * TAU / 8 + .5, [sx, sy] = freeSpot(api, tx + Math.cos(aa) * 300, ty + Math.sin(aa) * 300, 18); api.summon('zetsu_white', sx, sy); }
        });
        break;
      }
    }
  }

  function segHits(x0, y0, x1, y1, p, w) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
    const t = clamp01(((p.x - x0) * dx + (p.y - y0) * dy) / L2), cx = x0 + dx * t, cy = y0 + dy * t;
    return Math.hypot(p.x - cx, p.y - cy) < w + (p.r || 16);
  }
  // Manual control: the cursor point is no host, so the goo grabs the first hostile unit along the tendril.
  function latchVictim(f, reach, api) {
    if (!api.nearestFoe) return null;
    const c = Math.cos(f.a), s = Math.sin(f.a);
    for (let d = 30; d <= reach; d += 60) {
      const q = api.nearestFoe(f.x0 + c * d, f.y0 + s * d, LATCH_W + 30);
      if (q && !q.pseudo && q.health > 0) return q;
    }
    return null;
  }
  function latchCheck(z, st, f, api, D) {
    if (f.hit || z.health <= 0) return;
    let p = api.player;
    if (!p || p.health <= 0) return;
    const reach = Math.min(LATCH_LEN, f.age * LATCH_SPEED + 40), pseudo = !!p.pseudo;
    if (pseudo) { p = latchVictim(f, reach, api); if (!p) return; }
    else if (!segHits(f.x0, f.y0, f.x0 + Math.cos(f.a) * reach, f.y0 + Math.sin(f.a) * reach, p, LATCH_W)) return;
    f.hit = true; f.target = p; f.dur = Math.max(f.dur, f.age + LATCH_T + .6);
    st.latch = { target: p, t: LATCH_T, tick: .1, dmg: D, fx: f, strike: pseudo };
    if (pseudo) api.strike(p.x, p.y, (p.r || 16) + 4, D * .8, null, null, true);
    else api.damagePlayer(D * .8);
    api.burst(p.x, p.y - 24, '#2a2238', 12);
    api.shake(8);
  }

  function sporeUpd(fx, dt, api, z) {
    // Sprouted spores drain whoever stands among them; Zetsu drinks the chakra.
    if (fx.age < fx.tick || fx.ticks >= 8) return;
    fx.tick += .5; fx.ticks++;
    const p = api.player;
    let drank = 0;
    for (let i = 0; i < fx.pods.length; i += 2) {
      const s = fx.pods[i];
      if (p && !p.pseudo && Math.hypot(p.x - s.x1, p.y - s.y1) < 84) drank++;
      api.strike(s.x1, s.y1, 78, fx.dmg * .2, null, null, true);
    }
    if (drank && z && z.health > 0) z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .0025 * Math.min(3, drank));
  }

  function erupt(z, st, api) {
    const D = api.damage || 60, x = z.x, y = z.y;
    api.strike(x, y, ERUPT_R, D * 2.3, '#b4ec88', 'earth');
    api.world(x, y, 140, D * 2.2, 'earth');
    api.knockback(z, ERUPT_R + 30, 170, 0);
    const list = [];
    for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + .78; list.push({ x: x + Math.cos(aa) * 92, y: y + Math.sin(aa) * 60, s: .9, t0: 0, snap: .14 + i * .03, seed: i * 2.3 }); }
    list.sort((p, q) => p.y - q.y);
    addFx(st, { kind: 'jaws', list, dur: 1.6 });
    addFx(st, { kind: 'hole', x, y, dur: 1.8, erupt: true });
    api.burst(x, y - 30, '#9ad86a', 18);
    api.shake(15);
  }

  // ------------------------------------------------------------------ update
  function underUpdate(z, st, dt, api) {
    const u = st.under;
    u.t += dt;
    z.kageDash = .05;   // game.js holds him still while this is set (it never counts it down itself)
    z.attackTimer = Math.max(z.attackTimer || 0, .35);
    // Merged with the earth nothing reaches him.
    if (u.phase !== 'emerge') { if (z.health < st.guardHp) z.health = st.guardHp; }
    st.guardHp = z.health;
    switch (u.phase) {
      case 'sink':
        if (u.t >= SINK_T) { u.phase = 'travel'; u.t = 0; }
        break;
      case 'travel': {
        const p = api.player, tx = p ? p.x : z.x, ty = p ? p.y : z.y;
        const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy), step = Math.min(d, DIG_SPEED * dt);
        if (d > 1) { z.x += dx / d * step; z.y += dy / d * step; }
        const tr = u.trail, lx = tr[tr.length - 2], ly = tr[tr.length - 1];
        if (Math.hypot(z.x - lx, z.y - ly) > 34) { tr.push(z.x, z.y); if (tr.length > 80) tr.splice(0, 2); }
        if (d < 24 || u.t > 1.4) {
          const [fx, fy] = freeSpot(api, z.x, z.y, z.r);
          z.x = fx; z.y = fy; tr.push(fx, fy);
          u.phase = 'rise'; u.t = 0;
        }
        break;
      }
      case 'rise':
        if (u.t >= RISE_T) { erupt(z, st, api); u.phase = 'emerge'; u.t = 0; }
        break;
      case 'emerge':
        if (u.t >= EMERGE_T) { st.under = null; st.hold = 0; st.holdMove = ''; }
        break;
    }
  }

  function latchUpdate(z, st, dt, api) {
    const L = st.latch;
    L.t -= dt; L.tick -= dt;
    const p = L.target;
    if (!p || p.health <= 0 || L.t <= 0) { if (L.fx) L.fx.back = L.fx.age; st.latch = null; return; }
    if (L.tick <= 0) {
      L.tick = .4;
      // Black Zetsu feeds on the host's chakra.
      if (api.player === p && !L.strike) api.damagePlayer(L.dmg * .3);
      // Manual victim, or a team-mode host that is no longer this boss's current target: hit it where it stands.
      else if (L.strike || z.team !== undefined) api.strike(p.x, p.y, (p.r || 16) + 4, L.dmg * .3, null, null, true);
      z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .003);
    }
  }

  function update(z, dt, api) {
    const m = members[z.bossId];
    if (!m) return;
    const st = state(z);
    st.t += dt;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api, z);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.under = null; st.latch = null; z.manualBusy = false; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    if (st.latch) latchUpdate(z, st, dt, api);
    if (st.under) underUpdate(z, st, dt, api);
    if (!st.under) z.kageDash = 0;
    // (counts down above ground too: the spore storm's hold used to never run out, freezing him after it)
    if (st.hold > 0) { st.hold = Math.max(0, st.hold - dt); if (!st.hold) st.holdMove = ''; }
    z.armorScale = m.armor || 1;
    st.rec = Math.max(0, (st.rec || 0) - dt);

    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.rec = .4;
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && !st.under && z.manual) {
      // Driven by the player: only the requested jutsu; no rotation, no burrow toward a far target.
      if (z.manualCast != null && st.rec <= 0) {
        let k = KEYS[z.manualCast]; z.manualCast = null;
        if (k === 'army' && st.armies >= MAX_ARMIES) k = 'jaws';   // same cap on the White Zetsu army as the AI
        if (k) { st.force = k; announce(z, st, m, api); }
      }
    } else if (st.hold <= 0 && !st.under) {
      st.timer -= dt;
      const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      if (st.timer <= 0 && p && d < 950) announce(z, st, m, api);
      // Too far off: merge into the ground and come up under the target.
      else if (st.timer <= 0 && p && d < 1600) { st.force = 'burrow'; announce(z, st, m, api); }
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.under ? 0 : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || st.rec > 0 || !!st.under;
    z.speedScale = .9;
  }

  function hidden(z) {
    const st = z.zt;
    return !!(st && st.under && z.health > 0);
  }

  // ------------------------------------------------------------------ geometry helpers
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
  const bez = (x0, y0, cx, cy, x1, y1, t) => { const u = 1 - t; return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]; };
  function leaf(g, x, y, a, s, col, O) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * .5, -s * .42, s, 0); g.quadraticCurveTo(s * .5, s * .42, 0, 0); g.closePath();
    g.fillStyle = col; g.fill(); if (O) { g.strokeStyle = O; g.lineWidth = 1.2; g.stroke(); }
    g.strokeStyle = 'rgba(20,50,16,.5)'; g.lineWidth = .8; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * .9, 0); g.stroke();
    g.restore();
  }

  // ------------------------------------------------------------------ cached art
  // Wooden stake bursting out of the ground (base at the bottom centre: 32, 170).
  const STAKE_W = 64, STAKE_H = 176;
  function stakeSpr(v) {
    return Kit().sprite('zt:stake' + v, STAKE_W, STAKE_H, g => {
      const bx = 32, by = 172, h = 132 + v * 9, lean = (hash(v * 3.1 + 1) - .5) * 22, w = 11.5 + v * 1.2;
      const tx = bx + lean, ty = by - h, cx = bx - lean * .5, cy = by - h * .5;
      g.fillStyle = '#24160c'; tube(g, bx, by, cx, cy, tx, ty, 0, 1, w + 2.6, 1.3); g.fill();
      g.fillStyle = '#7a4e2c'; tube(g, bx, by, cx, cy, tx, ty, 0, .985, w, .5); g.fill();
      g.fillStyle = '#4e301a'; tube(g, bx + w * .4, by, cx + w * .4, cy, tx + 1, ty + 6, 0, .92, w * .38, .2); g.fill();
      g.fillStyle = '#c99358'; tube(g, bx - w * .45, by, cx - w * .45, cy, tx - 1, ty + 8, .02, .9, w * .26, .15); g.fill();
      // bark grain and knots
      g.strokeStyle = 'rgba(36,20,10,.55)'; g.lineWidth = 1.1;
      for (let i = 1; i < 7; i++) {
        const t = i / 8, [x, y] = bez(bx, by, cx, cy, tx, ty, t), ww = w * (1 - t * .9);
        g.beginPath(); g.moveTo(x - ww * .8, y + 1); g.quadraticCurveTo(x, y + 3, x + ww * .7, y - 1); g.stroke();
      }
      // a side shoot with leaves (Mokuton wood is alive)
      const [sx, sy] = bez(bx, by, cx, cy, tx, ty, .5), side = v % 2 ? 1 : -1;
      g.fillStyle = '#24160c'; tube(g, sx, sy, sx + side * 10, sy - 8, sx + side * 20, sy - 22, 0, 1, 3.6, 1); g.fill();
      g.fillStyle = '#7a4e2c'; tube(g, sx, sy, sx + side * 10, sy - 8, sx + side * 20, sy - 22, 0, .96, 2.4, .5); g.fill();
      leaf(g, sx + side * 20, sy - 22, side > 0 ? -1.1 : -2.0, 13, '#5fae45', '#1a3412');
      leaf(g, sx + side * 18, sy - 19, side > 0 ? -.2 : -2.9, 10, '#8fd768', '#1a3412');
      leaf(g, tx, ty + 8, -2.4 + v * .2, 9, '#6cc04e', '#1a3412');
    });
  }
  function drawStake(ctx, x, y, s, g, v, flip, alpha = 1) {
    if (g <= .02 || alpha <= .01) return;
    const img = stakeSpr(v), w = STAKE_W * s, h = STAKE_H * s, gg = Math.min(1, g), hh = h * gg;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y + 4 * s); if (flip) ctx.scale(-1, 1);
    // Emerging: the top of the stake shows first, its foot still under the earth.
    ctx.drawImage(img, 0, 0, STAKE_W, STAKE_H * gg, -w / 2, -hh, w, hh);
    ctx.restore();
  }

  // Giant flytrap head on its stem: frame 0 wide open … 6 snapped shut. Hinge at (100,116), stem foot at (100,214).
  const JAW_W = 200, JAW_H = 220;
  function jawSpr(f) {
    return Kit().sprite('zt:jaw' + f, JAW_W, JAW_H, g => {
      const open = 1 - f / 6, ang = 1.02 * Math.pow(open, .85), O = '#13200d';
      // stem with two leaves at its foot
      g.fillStyle = O; tube(g, 100, 216, 96, 166, 100, 118, 0, 1, 14, 10); g.fill();
      g.fillStyle = '#2f6e2a'; tube(g, 100, 214, 96, 166, 100, 118, 0, 1, 11, 7.4); g.fill();
      g.fillStyle = '#5ba548'; tube(g, 97, 212, 93, 166, 97, 120, 0, 1, 2.4, 1.6); g.fill();
      leaf(g, 100, 206, -2.7, 46, '#3f8a35', O); leaf(g, 100, 206, -.45, 42, '#4f9c40', O);
      const lobe = side => {
        g.save(); g.translate(100, 118); g.scale(side, 1); g.rotate(-ang);
        // cilia along the rim (they interlock when the trap shuts)
        g.fillStyle = '#f2f6d8'; g.strokeStyle = O; g.lineWidth = 1.5; g.lineJoin = 'round';
        for (let i = 0; i < 10; i++) {
          const y = -9 - i * 9.2, l = 13 + 5 * Math.sin(i * 1.9 + side);
          g.beginPath(); g.moveTo(-3, y + 3.4); g.lineTo(l, y - 2.4 - i * .3); g.lineTo(-3, y - 3.2); g.closePath(); g.fill(); g.stroke();
        }
        const body = () => { g.beginPath(); g.moveTo(1, 0); g.bezierCurveTo(-44, -6, -58, -62, -34, -90); g.quadraticCurveTo(-16, -106, 2, -100); g.lineTo(2, -4); g.closePath(); };
        body(); g.strokeStyle = O; g.lineWidth = 5; g.stroke();
        g.fillStyle = '#3f8a35'; g.fill();
        g.save(); body(); g.clip();
        // the inner face shows while open: pale flesh blushing red toward the midline
        if (open > .05) {
          g.globalAlpha = Math.min(1, open * 1.6);
          g.fillStyle = '#d6e88c'; g.beginPath(); g.ellipse(-12, -50, 26, 56, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(206,52,58,.75)'; g.beginPath(); g.ellipse(-4, -52, 15, 44, 0, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(120,20,30,.6)'; g.lineWidth = 1.2;
          for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-26, -20 - i * 12); g.quadraticCurveTo(-12, -24 - i * 12, 0, -18 - i * 13); g.stroke(); }
          g.globalAlpha = 1;
        }
        // outer face: shadowed back, lit ridge, veins
        g.fillStyle = 'rgba(14,40,12,.42)'; g.beginPath(); g.ellipse(-46, -40, 22, 70, .1, 0, TAU); g.fill();
        g.fillStyle = 'rgba(200,250,150,.35)'; g.beginPath(); g.ellipse(-30, -66, 7, 22, .45, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(16,44,14,.5)'; g.lineWidth = 1.3;
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-2, -6); g.quadraticCurveTo(-36 + i * 3, -20 - i * 14, -40 + i * 7, -36 - i * 13); g.stroke(); }
        g.restore();
        g.restore();
      };
      lobe(1); lobe(-1);
      if (f === 6) {
        // shut: a dark seam where the lips meet
        g.strokeStyle = 'rgba(20,10,8,.7)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(100, 114); g.lineTo(100, 20); g.stroke();
      }
    });
  }
  // One jaw over its life: bursts up open, gapes, snaps shut on `snap`, holds, then sinks.
  function drawJaw(ctx, j, age, time) {
    const u = age - j.t0;
    if (u < 0) return;
    const sink = win(age, j.snap + .5, j.snap + .95);
    if (sink >= 1) return;
    const rise = Math.min(1.06, easeOut(u / .16) * 1.06) * (1 - sink);
    let f = 0;
    if (age >= j.snap) f = Math.min(6, Math.floor((age - j.snap) / .075 * 6) + 1);
    else f = Math.floor(time * 10 + j.seed) % 2;
    const img = jawSpr(f), s = j.s, w = JAW_W * s * .9, h = JAW_H * s * .9, g = Math.min(1, rise), hh = h * g;
    const shake = age >= j.snap && age < j.snap + .2 ? Math.sin(age * 90) * 3 * s : 0;
    ctx.save(); ctx.translate(j.x + shake, j.y + 6 * s);
    if (rise > 1) ctx.scale(1, rise);
    ctx.drawImage(img, 0, 0, JAW_W, JAW_H * g, -w / 2, -hh, w, hh);
    ctx.restore();
    const c = age - j.snap;
    if (c >= 0 && c < .25) {
      // the chomp: sap and splinters spraying from the seam, a shock ring on the ground
      const K = Kit(), e = easeOut(c / .25), cy = j.y - h * .62;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, j.x, cy, 70 * s * (.5 + e), '190,255,140', .6 * (1 - e)); ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(20,36,12,${.5 * (1 - e)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(j.x, j.y, 40 + 90 * s * e, (40 + 90 * s * e) * .5, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(230,255,200,${.85 * (1 - e)})`; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = `rgba(235,250,190,${1 - e})`;
      for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (hash(i + j.seed) - .5) * 2.4, d = 30 + 70 * s * e; ctx.beginPath(); ctx.arc(j.x + Math.cos(a) * d, cy + Math.sin(a) * d * .8 + e * 20, 3 * s, 0, TAU); ctx.fill(); }
    }
  }
  function jawGround(ctx, j, age, time, rgb) {
    const u = age - j.t0, s = j.s;
    if (u < 0) {
      // the ground swells and cracks where it is about to burst
      const k = clamp01(1 + u / .6);
      markCircle(ctx, j.x, j.y, 100 * s, rgb, k, time, false, true);
      return;
    }
    const fade = 1 - win(age, j.snap + .7, j.snap + 1.4);
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(40,28,18,.6)'; ctx.beginPath(); ctx.ellipse(j.x, j.y + 4, 62 * s, 26 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(14,10,6,.65)'; ctx.beginPath(); ctx.ellipse(j.x, j.y + 6, 40 * s, 16 * s, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    cracks(ctx, j.x, j.y, 120 * s, 8, j.seed, fade);
    if (u < 1) dustBurst(ctx, j.x, j.y, 110 * s, u, j.seed, 8);
  }

  // White spore: a fluffy white ball with a green-grey under-shadow (reads on bright ground).
  function sporeSpr() {
    return Kit().sprite('zt:spore', 32, 32, g => {
      const gr = g.createRadialGradient(13, 12, 1, 16, 16, 15);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(244,248,236,.95)'); gr.addColorStop(.75, 'rgba(176,196,164,.75)');
      gr.addColorStop(.9, 'rgba(70,96,64,.45)'); gr.addColorStop(1, 'rgba(60,80,56,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(16, 16, 15, 0, TAU); g.fill();
    });
  }
  // Spore pod: a white bulb in green sepals (latches on and sprouts).
  function podSpr() {
    return Kit().sprite('zt:pod', 48, 56, g => {
      const O = '#1c2416';
      g.lineJoin = 'round';
      g.fillStyle = '#f2f2ea'; g.strokeStyle = O; g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(24, 24, 13, 17, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(160,170,150,.6)'; g.beginPath(); g.ellipse(29, 28, 7, 12, .1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(19, 16, 4, 6, -.3, 0, TAU); g.fill();
      g.fillStyle = '#16120e'; g.beginPath(); g.ellipse(21, 22, 2.2, 3, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(28, 22, 1.8, 2.8, 0, 0, TAU); g.fill();
      for (const a of [-.9, -.3, .3, .9]) leaf(g, 24, 42, Math.PI / 2 * 3 + a * 1.4 + Math.PI, 14, '#4f9c40', O);
    });
  }

  // ------------------------------------------------------------------ telegraphs (copied style: dark under-stroke + lit stroke)
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
    ctx.fillStyle = `rgba(18,30,12,${faint ? .1 : .18})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(0, 0, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,34,14,.5)'; ctx.lineWidth = small ? 4 : faint ? 4.5 : 6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 2 : faint ? 2.2 : 3;
    ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2.4; ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + time * .9;
        ctx.moveTo(Math.cos(a) * (r - 16), Math.sin(a) * (r - 16)); ctx.lineTo(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10));
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function markLine(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.fillStyle = 'rgba(18,30,12,.18)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${.14 + .18 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
    ctx.strokeStyle = 'rgba(20,34,14,.45)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  // Radial ground cracks (ground perspective).
  function cracks(ctx, x, y, r, n, seed, alpha, w = 2.5) {
    if (alpha <= .01 || r < 4) return;
    ctx.strokeStyle = `rgba(30,20,12,${.7 * alpha})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 4.7 + seed) * .5, l = r * (.55 + hash(i * 9.1 + seed) * .45);
      ctx.moveTo(x + Math.cos(a) * r * .12, y + Math.sin(a) * r * .06);
      for (let k = 1; k <= 4; k++) {
        const b = a + (hash(i * 3 + k * 1.7 + seed) - .5) * .5, d = l * k / 4;
        ctx.lineTo(x + Math.cos(b) * d, y + Math.sin(b) * d * .5);
      }
    }
    ctx.stroke();
  }
  function dustBurst(ctx, x, y, r, t, seed, n = 10) {
    const K = Kit(), dust = K.puff('dust'), e = easeOut(t / 1.2), a0 = 1 - win(t, .6, 1.6);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i + seed) * .4, d = r * (.3 + e * (.6 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - 8 - hash(i * 4.4 + seed) * r * .14, r * (.12 + e * (.08 + hash(i * 6.1 + seed) * .08)), a0 * .8, .75);
    }
    if (t < 1) K.fx.debris(ctx, x, y, r * 1.1, t, seed, '#3a2a1a', 10);
  }

  // ------------------------------------------------------------------ Mayfly: hole, furrow, eruption
  function holeG(ctx, fx, time) {
    const K = Kit(), t = fx.age, fade = 1 - win(t, fx.dur - .6, fx.dur), e = easeOut(t / .3), r = fx.erupt ? 120 : 64;
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(60,44,28,.55)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 3, r * e, r * .45 * e, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(16,12,8,.7)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 4, r * .6 * e, r * .26 * e, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    cracks(ctx, fx.x, fx.y, r * 1.6 * e, 10, fx.seed, fade, 2.4);
    // ripples of the earth closing over him
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5);
    for (let i = 0; i < 3; i++) {
      const ph = frac(t * 1.4 + i / 3), rr = 20 + ph * r * 2;
      ctx.lineWidth = 4; ctx.strokeStyle = `rgba(40,30,18,${(1 - ph) * .45 * fade})`; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(190,240,150,${(1 - ph) * .55 * fade})`; ctx.stroke();
    }
    ctx.restore();
    if (fx.erupt) dustBurst(ctx, fx.x, fx.y, 170, t, fx.seed, 14);
    void K;
  }
  // Ground layer of the underground trip: the furrow he ploughs and the swelling ahead of it.
  function burrowG(ctx, z, st, time) {
    const u = st.under, tr = u.trail, K = Kit(), n = tr.length / 2;
    if (n >= 2) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [col, w] of [['rgba(70,52,32,.42)', 30], ['rgba(28,20,12,.55)', 9], ['rgba(200,180,140,.35)', 2.5]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tr[0], tr[1]);
        for (let i = 1; i < n; i++) ctx.lineTo(tr[i * 2] + (w < 10 ? Math.sin(i * 2.3) * 4 : 0), tr[i * 2 + 1]);
        if (u.phase === 'travel') ctx.lineTo(z.x, z.y);
        ctx.stroke();
      }
      // clods of earth thrown up beside the furrow
      ctx.fillStyle = 'rgba(80,58,36,.8)';
      for (let i = 1; i < n; i++) {
        const x = tr[i * 2], y = tr[i * 2 + 1], s = 3 + hash(i * 1.7) * 4;
        ctx.beginPath(); ctx.ellipse(x + (hash(i * 3.1) - .5) * 40, y + (hash(i * 5.3) - .5) * 22, s, s * .6, 0, 0, TAU); ctx.fill();
      }
    }
    if (u.phase === 'travel' || u.phase === 'rise') {
      // the swelling mound
      const pulse = 1 + Math.sin(time * 18) * .08;
      ctx.fillStyle = 'rgba(96,72,44,.7)'; ctx.beginPath(); ctx.ellipse(z.x, z.y, 44 * pulse, 20 * pulse, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(150,120,80,.6)'; ctx.beginPath(); ctx.ellipse(z.x - 6, z.y - 4, 26, 9, 0, 0, TAU); ctx.fill();
      cracks(ctx, z.x, z.y, 70, 7, 3.3 + Math.floor(time * 6), .8, 2);
      const dust = K.puff('dust');
      for (let i = 0; i < 4; i++) { const ph = frac(time * 2.2 + i / 4); K.stamp(ctx, dust, z.x + Math.sin(i * 2.1 + time * 3) * 30, z.y - ph * 30, 10 + ph * 16, bell(ph) * .6, .75); }
    }
    if (u.phase === 'rise') markCircle(ctx, z.x, z.y, ERUPT_R, '160,236,110', u.t / RISE_T, time, false);
  }
  // The two flytrap leaf tips cutting through the earth like fins.
  function finsO(ctx, x, y, time, k) {
    const O = '#13200d';
    for (const side of [-1, 1]) {
      const h = (46 + Math.sin(time * 12 + side) * 4) * k, bx = x + side * 12;
      ctx.beginPath(); ctx.moveTo(bx - side * 2, y + 2); ctx.quadraticCurveTo(bx + side * 16, y - h * .5, bx + side * 4, y - h); ctx.quadraticCurveTo(bx + side * 2, y - h * .5, bx - side * 6, y + 2); ctx.closePath();
      ctx.fillStyle = '#3f8a35'; ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#f2f6d8'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 1; i < 5; i++) { const yy = y - h * i / 5, xx = bx + side * (4 - i * .2); ctx.moveTo(xx, yy); ctx.lineTo(xx - side * 7, yy - 2); }
      ctx.stroke();
    }
  }
  // Zetsu himself sinking into (or rising out of) the earth: his sprite clipped at the ground line.
  function bodyInGround(ctx, z, depth, time) {
    const S = Spr();
    if (!S) return;
    const id = S.has && S.has('zetsu') ? 'zetsu' : 'pain', H = S.height ? S.height(id) : 110;
    const facing = Math.cos(z.angle || 0) >= 0 ? 1 : -1, feet = z.y + 3, d = clamp01(depth) * (H + 6);
    ctx.save(); ctx.beginPath(); ctx.rect(z.x - 160, feet - H - 140, 320, H + 140); ctx.clip();
    S.draw(ctx, id, z.x, feet + d, { facing, frame: 'seal' });
    ctx.restore();
    // a lip of churned earth hides the cut
    ctx.fillStyle = '#5a4228'; ctx.beginPath(); ctx.ellipse(z.x, feet, 34, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,130,90,.85)'; ctx.beginPath(); ctx.ellipse(z.x, feet - 2, 34, 6, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1e10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(z.x, feet, 34, 10, 0, 0, TAU); ctx.stroke();
    const K = Kit(), dust = K.puff('dust');
    for (let i = 0; i < 5; i++) { const ph = frac(time * 2.6 + i / 5); K.stamp(ctx, dust, z.x + (i - 2) * 14, feet - ph * 26, 9 + ph * 10, bell(ph) * .6, .75); }
  }
  function burrowO(ctx, z, st, time) {
    const u = st.under;
    if (u.phase === 'sink') bodyInGround(ctx, z, easeIn(u.t / SINK_T), time);
    else if (u.phase === 'travel') finsO(ctx, z.x, z.y, time, 1);
    else if (u.phase === 'rise') finsO(ctx, z.x, z.y, time, 1 + u.t / RISE_T * .6);
  }
  function emergeO(ctx, z, st, time) {
    // after the eruption: he rises from the middle of the snapping traps
    const u = st.under;
    if (u && u.phase === 'emerge') bodyInGround(ctx, z, 1 - easeOut(u.t / EMERGE_T), time);
  }

  // ------------------------------------------------------------------ Spore Technique
  function podPos(p, t) {
    const k = clamp01(t / p.tf), x = lerp(p.x0, p.x1, k), y = lerp(p.y0, p.y1, k) - Math.sin(Math.PI * k) * p.h;
    return [x, y, k];
  }
  function sporeG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    for (const p of fx.pods) {
      if (p.x0 == null) continue;
      const u = fx.age - p.tf;
      if (u < 0) {
        // shadow racing over the ground under the flying pod
        const k = clamp01(fx.age / p.tf);
        ctx.fillStyle = 'rgba(20,30,16,.25)'; ctx.beginPath(); ctx.ellipse(lerp(p.x0, p.x1, k), lerp(p.y0 + 30, p.y1, k), 12, 5, 0, 0, TAU); ctx.fill();
        continue;
      }
      // a mossy patch spreads where it sprouted, ringed by the pulse of the chakra it drinks
      const e = easeOut(u / .4);
      ctx.fillStyle = `rgba(52,96,34,${.36 * fade})`; ctx.beginPath(); ctx.ellipse(p.x1, p.y1, 80 * e, 38 * e, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(230,240,214,${.24 * fade})`; ctx.beginPath(); ctx.ellipse(p.x1, p.y1, 50 * e, 22 * e, 0, 0, TAU); ctx.fill();
      const ph = frac(time * 1.3 + p.seed), rr = 84 * (1 - ph * .7) * e;
      ctx.lineWidth = 4; ctx.strokeStyle = `rgba(24,40,16,${.4 * fade * ph})`; ctx.beginPath(); ctx.ellipse(p.x1, p.y1, rr, rr * .5, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(200,255,170,${.75 * fade * ph})`; ctx.stroke();
      if (u < 1) dustBurst(ctx, p.x1, p.y1, 70, u, p.seed, 6);
    }
    void K;
  }
  function sporeO(ctx, fx, time) {
    const K = Kit(), pod = podSpr(), sp = sporeSpr(), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    if (fx.age < .9) {
      // the release: a cone of spores gusting out of the flytrap leaves
      const k = fx.age / .9;
      for (let i = 0; i < 46; i++) {
        const h1 = hash(i * 1.7 + fx.seed), h2 = hash(i * 3.3 + fx.seed), a = fx.a + (h1 - .5) * 1.3, d = (40 + 760 * h2) * easeOut(k * (1.2 + h2 * .4));
        K.stamp(ctx, sp, fx.hx + Math.cos(a) * d, fx.hy + Math.sin(a) * d * .7 + d * .08 - Math.sin(k * 3 + i) * 10, 6 + h1 * 9, (1 - k) * .95);
      }
    }
    for (const p of fx.pods) {
      if (p.x0 == null) continue;
      const u = fx.age - p.tf;
      if (u < 0) {
        const [x, y, k] = podPos(p, fx.age);
        // spore trail
        for (let i = 1; i < 5; i++) { const [tx, ty] = podPos(p, fx.age - i * .035); K.stamp(ctx, sp, tx, ty, 7 - i, .7 - i * .12); }
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(fx.age * 12 + p.seed) * .5 + k);
        ctx.drawImage(pod, -18, -21, 36, 42); ctx.restore();
        continue;
      }
      if (u < .35) {
        // pop: a burst of white spores
        const e = easeOut(u / .35);
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, p.x1, p.y1 - 10, 70 * e, '200,230,170', .5 * (1 - e)); ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + p.seed, r = (50 + hash(i + p.seed) * 30) * e; K.stamp(ctx, sp, p.x1 + Math.cos(a) * r, p.y1 - 14 + Math.sin(a) * r * .5 - 24 * e, 12 * (1 - e) + 4, 1 - e * .8); }
        K.stamp(ctx, K.puff('poof'), p.x1, p.y1 - 16, 26 + 20 * e, (1 - e) * .8, .8);
      }
      // the sprout: a pod bulb swaying on the moss, spores drifting off it
      const g = easeOut(u / .3), sway = Math.sin(time * 3 + p.seed) * .15;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x1, p.y1); ctx.rotate(sway); ctx.scale(g, g);
      ctx.drawImage(pod, -22, -50, 44, 52); ctx.restore();
      for (let i = 0; i < 3; i++) {
        const ph = frac(time * .7 + i / 3 + p.seed);
        K.stamp(ctx, sp, p.x1 + Math.sin(ph * 6 + p.seed + i) * 24, p.y1 - 20 - ph * 60, 5 + ph * 4, bell(ph) * .85 * fade);
      }
    }
  }

  // ------------------------------------------------------------------ Wood Release thorn lanes
  // The stakes along each lane derive from the lanes alone (deterministic), cached off the JSON
  // so co-op snapshots carry only the three lanes.
  function thornSpots(fx) {
    if (fx._spots) return fx._spots;
    const spots = [];
    (fx.lanes || []).forEach((l, li) => {
      const c = Math.cos(l.a), s = Math.sin(l.a);
      for (let d = 60, i = 0; d <= THORN_LEN; d += 78, i++) {
        const x = l.x0 + c * d, y = l.y0 + s * d, t = .06 + d / THORN_SPEED, grow = .6 + .5 * d / THORN_LEN;
        for (let j = 0; j < 3; j++) {
          const off = (j - 1) * (14 + hash(li * 50 + i * 3 + j) * 16), jit = (hash(li * 31 + i * 7 + j) - .5) * 30;
          spots.push({ x: x - s * off + c * jit, y: y + c * off + s * jit, t: t + j * .025, s: grow * (j === 1 ? 1 : .7 + hash(i + j * 9) * .2), v: (i + j + li) % 4,
            lean: (j - 1) * 18 + (hash(i * 5 + li + j) - .5) * 16, flip: hash(i * 3 + j + li * 7) > .5, c: j === 1 });
        }
      }
    });
    spots.sort((p, q) => p.y - q.y);
    Object.defineProperty(fx, '_spots', { value: spots, enumerable: false });
    return spots;
  }
  function thornsG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .7, fx.dur), front = Math.max(0, (fx.age - .06) * THORN_SPEED);
    ctx.lineCap = 'round';
    for (const l of fx.lanes) {
      const L = Math.min(THORN_LEN, front), ex = l.x0 + Math.cos(l.a) * L, ey = l.y0 + Math.sin(l.a) * L;
      if (L <= 0) continue;
      ctx.strokeStyle = `rgba(70,50,28,${.4 * fade})`; ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = `rgba(24,16,8,${.6 * fade})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(l.x0, l.y0);
      for (let d = 30; d < L; d += 30) { const o = (hash(d * .1 + l.a) - .5) * 14; ctx.lineTo(l.x0 + Math.cos(l.a) * d - Math.sin(l.a) * o, l.y0 + Math.sin(l.a) * d + Math.cos(l.a) * o); }
      ctx.stroke();
    }
    for (const s of thornSpots(fx)) {
      const u = fx.age - s.t;
      if (!s.c || u < 0 || u > 1.1) continue;
      dustBurst(ctx, s.x, s.y, 50 * s.s, u, s.v * 3.1 + s.x * .01, 5);
    }
  }
  function thornsO(ctx, fx, time) {
    const sink = fx.dur - .7;
    for (const s of thornSpots(fx)) {
      const u = fx.age - s.t;
      if (u < 0) continue;
      const g = Math.min(1.08, easeOut(u / .13) * 1.08) * (1 - easeIn(win(fx.age, sink, fx.dur)));
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.lean * .012);
      drawStake(ctx, 0, 0, s.s, g, s.v, s.flip);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ Black Zetsu latch
  function gooBlob(ctx, x, y, r, time, seed) {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = i / 12 * TAU, k = 1 + Math.sin(a * 3 + time * 7 + seed) * .14 + Math.sin(a * 5 - time * 5 + seed) * .08;
      const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k * .9;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function blackEye(ctx, x, y, s) {
    ctx.fillStyle = '#f4cc24'; ctx.beginPath(); ctx.ellipse(x, y, 5 * s, 3.4 * s, -.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6a5a20'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#16100a'; ctx.beginPath(); ctx.arc(x + .6 * s, y, 1.4 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,.9)'; ctx.beginPath(); ctx.arc(x - 1.6 * s, y - 1 * s, .9 * s, 0, TAU); ctx.fill();
  }
  function tendrilO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT();
    const hx = fx.x0, hy = fx.y0 - L;
    let ex, ey, k;
    if (fx.hit) {
      if (!fx.target) return;
      const back = fx.back ? clamp01((fx.age - fx.back) / .35) : 0;
      if (back >= 1) return;
      ex = lerp(fx.target.x, z ? z.x : hx, back); ey = lerp(fx.target.y - L, z ? z.y - L : hy, back); k = 1 - back;
    } else {
      const reach = Math.min(fx.len, fx.age * LATCH_SPEED), ret = clamp01((fx.age - fx.len / LATCH_SPEED) / .5);
      const d = reach * (1 - ret);
      if (d <= 2) return;
      ex = hx + Math.cos(fx.a) * d; ey = hy + Math.sin(fx.a) * d; k = 1;
    }
    const sx = z ? z.x : hx, sy = z ? z.y - L - 6 : hy;
    const dx = ex - sx, dy = ey - sy, D = Math.hypot(dx, dy) || 1, nx = -dy / D, ny = dx / D;
    const wob = Math.sin(time * 9) * Math.min(40, D * .12);
    const cx = (sx + ex) / 2 + nx * wob, cy = (sy + ey) / 2 + ny * wob - D * .08;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(40,20,60,.45)'; ctx.lineWidth = 18 * k; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
    ctx.strokeStyle = '#0d0b12'; ctx.lineWidth = 11 * k; ctx.stroke();
    ctx.strokeStyle = 'rgba(150,140,200,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy - 3); ctx.quadraticCurveTo(cx, cy - 4, ex, ey - 3); ctx.stroke();
    // drips falling off the tendril
    ctx.fillStyle = '#0d0b12';
    for (let i = 0; i < 6; i++) {
      const t = (i + .5) / 6, [px, py] = bez(sx, sy, cx, cy, ex, ey, t), ph = frac(time * 1.6 + i * .37);
      ctx.beginPath(); ctx.ellipse(px, py + 6 + ph * 22, 2.4 * (1 - ph) + .8, 3.6 * (1 - ph) + 1, 0, 0, TAU); ctx.fill();
    }
    // the head of the goo: Black Zetsu's face
    gooBlob(ctx, ex, ey, 15 * k + 4, time, fx.seed);
    ctx.fillStyle = '#0d0b12'; ctx.fill(); ctx.strokeStyle = 'rgba(140,120,200,.7)'; ctx.lineWidth = 1.6; ctx.stroke();
    blackEye(ctx, ex + 2, ey - 3, .9 + .3 * k);
    ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, ex, ey, 30, '150,110,230', .35); ctx.globalCompositeOperation = 'source-over';
  }
  function latchO(ctx, st, time) {
    const L = st.latch;
    if (!L || !L.target) return;
    const p = L.target, x = p.x, y = p.y - LIFT() + 4, K = Kit(), k = Math.min(1, (LATCH_T - L.t) / .25);
    // black goo wrapping the host's body, crawling and pulsing
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + time * 1.4, r = 17 + Math.sin(time * 4 + i) * 3;
      gooBlob(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 1.2 + 4, (12 + Math.sin(time * 6 + i * 2) * 2) * k, time, i * 3);
      ctx.fillStyle = '#0d0b12'; ctx.fill();
    }
    gooBlob(ctx, x, y + 2, 19 * k, time, 7); ctx.fillStyle = '#0d0b12'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,130,210,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    blackEye(ctx, x + 4, y - 4, 1.4 * k);
    // chakra drawn out of the host in violet wisps
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, 36 + Math.sin(time * 10) * 5, '150,110,230', .45);
    ctx.strokeStyle = 'rgba(210,190,255,.75)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const ph = frac(time * 1.8 + i / 6), a = i * 1.7; ctx.moveTo(x + Math.cos(a) * 26 * (1 - ph), y + Math.sin(a) * 20 * (1 - ph) - ph * 10); ctx.lineTo(x + Math.cos(a) * 30 * (1 - ph), y + Math.sin(a) * 24 * (1 - ph) - ph * 16); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ White Zetsu army
  function armyG(ctx, fx, time) {
    for (const s of fx.spots) {
      const u = fx.age - s.t0;
      if (u < 0) continue;
      const fade = 1 - win(fx.age, fx.dur - .6, fx.dur), e = easeOut(u / .3);
      ctx.fillStyle = `rgba(56,40,24,${.5 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, 34 * e, 14 * e, 0, 0, TAU); ctx.fill();
      cracks(ctx, s.x, s.y, 54 * e, 6, s.x * .01, fade, 2);
      if (u > .55 && u < 1.6) dustBurst(ctx, s.x, s.y, 60, u - .55, s.y * .01, 6);
    }
  }
  function armyO(ctx, fx, time) {
    const K = Kit(), pod = podSpr(), smoke = K.puff('poof');
    for (const s of fx.spots) {
      const u = fx.age - s.t0;
      if (u < 0 || u > 1.5) continue;
      if (u < .62) {
        // a pod swells out of the earth, then splits
        const g = easeOut(u / .45), wob = Math.sin(time * 20 + s.x) * .06 * g;
        ctx.save(); ctx.translate(s.x, s.y + 4); ctx.rotate(wob); ctx.scale(.7 + g * .9, .7 + g * .9);
        ctx.drawImage(pod, -16 * g, -42 * g, 32 * g, 44 * g); ctx.restore();
      } else {
        const v = (u - .62) / .9;
        for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + s.x; K.stamp(ctx, smoke, s.x + Math.cos(a) * 26 * easeOut(v), s.y - 26 + Math.sin(a) * 14 * easeOut(v) - v * 18, 18 + 14 * v, (1 - v) * .85, .85); }
      }
    }
  }

  // ------------------------------------------------------------------ flytrap jaws
  function jawsG(ctx, fx, time) { for (const j of fx.list) jawGround(ctx, j, fx.age, time, MOVES.jaws.rgb); }
  function jawsO(ctx, fx, time) { for (const j of fx.list) drawJaw(ctx, j, fx.age, time); }

  // ------------------------------------------------------------------ wood prison
  function cageRadius(fx) { return lerp(fx.R, 110, easeIn(clamp01(fx.age / fx.T) * .6 + clamp01(fx.age / fx.T) * .4)); }
  function cageG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur), r = cageRadius(fx), N = 22;
    ctx.globalAlpha = fade;
    // roots ploughing in from the ring toward its centre
    ctx.lineCap = 'round';
    for (const [col, w] of [['rgba(36,22,12,.75)', 13], ['#7a4e2c', 8], ['rgba(200,150,90,.6)', 2.4]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const a = i * TAU / N + fx.seed, wv = Math.sin(i * 2.7) * .12;
        const ox = fx.x + Math.cos(a) * fx.R, oy = fx.y + Math.sin(a) * fx.R * .5, ix = fx.x + Math.cos(a + wv) * r, iy = fx.y + Math.sin(a + wv) * r * .5;
        ctx.moveTo(ox, oy); ctx.quadraticCurveTo((ox + ix) / 2 + Math.sin(a * 3) * 18, (oy + iy) / 2, ix, iy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the closing front: churned earth ring with a green chakra edge
    if (fx.age < fx.T) {
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5);
      ctx.strokeStyle = 'rgba(60,40,22,.55)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(20,36,12,.5)'; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = 'rgba(190,255,140,.85)'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.restore();
      markCircle(ctx, fx.x, fx.y, 150, MOVES.cage.rgb, fx.age / fx.T, time, true);
    } else {
      const u = fx.age - fx.T;
      ctx.fillStyle = `rgba(40,28,16,${.5 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 140, 62, 0, 0, TAU); ctx.fill();
      cracks(ctx, fx.x, fx.y, 230, 12, fx.seed, fade, 3);
      if (u < 1.3) dustBurst(ctx, fx.x, fx.y, 190, u, fx.seed, 12);
    }
  }
  function cageO(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur), r = cageRadius(fx), N = 22;
    // stakes riding the closing front, back to front
    const front = [];
    for (let i = 0; i < N; i++) { const a = i * TAU / N + fx.seed, wv = Math.sin(i * 2.7) * .12; front.push([fx.x + Math.cos(a + wv) * r, fx.y + Math.sin(a + wv) * r * .5, i]); }
    front.sort((p, q) => p[1] - q[1]);
    const g = fx.age < fx.T ? easeOut(fx.age / .2) : 1 - easeIn(win(fx.age, fx.T, fx.T + .4));
    for (const [x, y, i] of front) drawStake(ctx, x, y, .72 + hash(i) * .18, g * (.85 + Math.sin(time * 14 + i) * .08), i % 4, i % 2 === 0, fade);
    if (fx.age < fx.T - .1) return;
    // the prison: thick roots arch over the centre and lock together
    const k = easeOut(win(fx.age, fx.T - .1, fx.T + .12)), wither = easeIn(win(fx.age, fx.dur - .8, fx.dur));
    const top = fx.y - 190, M = 10;
    ctx.globalAlpha = fade;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < M; i++) {
      const a = i * TAU / M + .2, sx = fx.x + Math.cos(a) * 130, sy = fx.y + Math.sin(a) * 60;
      if ((sy < fx.y) !== (pass === 0)) continue;   // back arches first, front arches over the middle
      const cx = fx.x + Math.cos(a) * 120, cy = top + 30;
      ctx.fillStyle = '#24160c'; tube(ctx, sx, sy + 4, cx, cy, fx.x + Math.cos(a) * 8, top, 0, k * (1 - wither * .8), 13, 5); ctx.fill();
      ctx.fillStyle = '#7a4e2c'; tube(ctx, sx, sy + 4, cx, cy, fx.x + Math.cos(a) * 8, top, 0, k * (1 - wither * .8) * .98, 10, 3.4); ctx.fill();
      ctx.fillStyle = 'rgba(205,150,90,.8)'; tube(ctx, sx - 3, sy, cx - 3, cy - 2, fx.x + Math.cos(a) * 8 - 2, top + 2, .05, k * (1 - wither * .8) * .9, 2.6, 1); ctx.fill();
      if (k > .9 && pass === 1) {
        const [lx, ly] = bez(sx, sy, cx, cy, fx.x, top, .55);
        leaf(ctx, lx, ly, a - 1.6, 16, '#5fae45', '#1a3412'); leaf(ctx, lx, ly, a + 1.6, 12, '#8fd768', '#1a3412');
      }
    }
    if (k > .95) {
      // knot where the roots lock, a burst of leaves and splinters
      ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.ellipse(fx.x, top, 22, 14, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#140c06'; ctx.lineWidth = 2.5; ctx.stroke();
      const u = fx.age - fx.T;
      if (u > 0 && u < .8) Kit().fx.debris(ctx, fx.x, fx.y, 220, u / .8, fx.seed, '#5a3a20', 12);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ ultimate: spore storm
  function stormG(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.R, e = easeOut(t / .7), fade = 1 - win(t, fx.dur - .8, fx.dur), pre = t < fx.T;
    // dark spore haze settling on the ground (under-layer keeps the white spores readable)
    ctx.fillStyle = `rgba(36,52,30,${(pre ? .26 : .18) * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * e, R * .5 * e, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(200,220,180,${(pre ? .16 : .06) * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * .62 * e, R * .31 * e, 0, 0, TAU); ctx.fill();
    // spiral arms of spores combing the ground toward the eye
    if (pre) {
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5); ctx.rotate(-t * 1.6);
      ctx.lineCap = 'round';
      for (const [col, w] of [['rgba(30,44,24,.4)', 14], ['rgba(240,248,232,.75)', 4]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        for (let arm = 0; arm < 5; arm++) {
          const a0 = arm * TAU / 5;
          for (let i = 0; i <= 16; i++) { const u = i / 16, a = a0 + u * 2.6, r = R * e * (1 - u * .9); if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        }
        ctx.stroke();
      }
      ctx.restore();
      markCircle(ctx, fx.x, fx.y, 360, MOVES.storm.rgb, t / fx.T, time, false);
    } else {
      const u = t - fx.T;
      ctx.fillStyle = `rgba(30,22,12,${.45 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 330, 150, 0, 0, TAU); ctx.fill();
      cracks(ctx, fx.x, fx.y, 560, 18, fx.seed, fade, 3.4);
      if (u < 1.5) dustBurst(ctx, fx.x, fx.y, 420, u, fx.seed, 16);
    }
    for (const j of fx.jaws) jawGround(ctx, j, t, time, MOVES.storm.rgb);
  }
  function stormO(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.R, sp = sporeSpr(), fade = 1 - win(t, fx.dur - .8, fx.dur);
    const dens = t < fx.T ? easeOut(t / .6) : 1 - easeOut((t - fx.T) / 1.0);
    if (dens > .02) {
      // the swirling cloud: spores orbit the eye, faster the closer they are, rising and falling
      // banks of spore mist wheeling round the eye (dark under-puffs keep the white readable)
      const mist = K.puff('poof'), murk = K.puff('smoke');
      for (let i = 0; i < 20; i++) {
        const h1 = hash(i * 5.1 + fx.seed), r = R * (.25 + .68 * h1) * (1 - .3 * clamp01(t / fx.T)), a = i * TAU / 20 - t * (.9 + 120 / (r + 80));
        const x = fx.x + Math.cos(a) * r, y = fx.y + Math.sin(a) * r * .5 - 30 - h1 * 30, s = 46 + hash(i * 2.2) * 50;
        K.stamp(ctx, murk, x + 6, y + 12, s * 1.05, dens * .22, .7);
        K.stamp(ctx, mist, x, y, s, dens * .4, .7);
      }
      const N = 240;
      for (let i = 0; i < N; i++) {
        const h1 = hash(i * 1.31 + fx.seed), h2 = hash(i * 2.77 + fx.seed), h3 = hash(i * 4.13);
        const r0 = R * (.08 + .92 * Math.sqrt(h1)), r = r0 * (1 - .35 * clamp01(t / fx.T) * h2);
        const a = h2 * TAU - t * (1.2 + 220 / (r + 60)), lift = 20 + h3 * 120 + Math.sin(t * 3 + i) * 12;
        const x = fx.x + Math.cos(a) * r, y = fx.y + Math.sin(a) * r * .5 - lift * (1 - r0 / R * .5);
        K.stamp(ctx, sp, x, y, 7 + h3 * 9, dens * (.55 + h1 * .45));
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - 60, 220, '170,220,140', .22 * dens);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (t >= fx.T - .25 && t < fx.T + .4) {
      // the snap: a flash and shock ring
      const u = (t - fx.T + .25) / .65;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 40, 380 * easeOut(u), '210,255,180', .7 * (1 - u), true); ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5);
      ctx.strokeStyle = `rgba(20,36,12,${.5 * (1 - u)})`; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(0, 0, 60 + 600 * easeOut(u), 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(230,255,210,${.9 * (1 - u)})`; ctx.lineWidth = 5; ctx.stroke();
      ctx.restore();
    }
    for (const j of fx.jaws) drawJaw(ctx, j, t, time);
    void fade;
  }

  const FX = {
    hole: [holeG, null], spore: [sporeG, sporeO], thorns: [thornsG, thornsO], tendril: [null, tendrilO],
    army: [armyG, armyO], jaws: [jawsG, jawsO], cage: [cageG, cageO], storm: [stormG, stormO]
  };

  // ------------------------------------------------------------------ windup looks
  function windupG(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, move = st.move;
    // green chakra ripples through the earth round his feet
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5);
    for (let i = 0; i < 3; i++) {
      const ph = frac(time * 1.2 + i / 3), r = 20 + ph * (80 + 60 * k);
      ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(30,60,20,${(1 - ph) * .5})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(200,255,160,${(1 - ph) * .7})`; ctx.stroke();
    }
    ctx.restore();
    if (move === 'thorns' || move === 'cage' || move === 'burrow') cracks(ctx, z.x, z.y, 60 + 80 * k, 8, 5.1, k);
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, f = Math.cos(st.aim) >= 0 ? 1 : -1, L = LIFT();
    const S = Spr(), H = S && S.height ? S.height('zetsu') : 110, headY = z.y - H * .7;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, headY, 46 + 30 * k, '150,230,110', .35);
    K.glow(ctx, z.x + f * 7, headY + 8, 8 + 4 * k, '255,220,60', .8, true);
    ctx.globalCompositeOperation = 'source-over';
    const sp = sporeSpr();
    switch (move) {
      case 'spore': case 'storm': {
        // spores boiling out of the flytrap leaves and swirling round him
        const n = move === 'storm' ? 34 : 18, big = move === 'storm' ? 1.6 : 1;
        for (let i = 0; i < n; i++) {
          const ph = frac(time * .9 + i / n), a = i * 2.39 + time * 2.2, r = (30 + ph * 110 * big) * (move === 'storm' ? 1 - k * .4 : 1);
          K.stamp(ctx, sp, z.x + Math.cos(a) * r, headY + 10 + Math.sin(a) * r * .5 - ph * 40, 4 + ph * 6 * big, bell(ph) * .95);
        }
        if (move === 'storm') {
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, headY - 10, 120 * e, '200,255,170', .45); ctx.globalCompositeOperation = 'source-over';
        }
        break;
      }
      case 'thorns': case 'cage': {
        // wood creaking up: splinters and dust at his feet
        const dust = K.puff('dust');
        for (let i = 0; i < 6; i++) { const ph = frac(time * 1.5 + i / 6); K.stamp(ctx, dust, z.x + Math.cos(i * 1.1) * (40 + 30 * e), z.y - ph * 30, 10 + ph * 14, bell(ph) * .6 * Math.min(1, k * 2), .75); }
        for (let i = 0; i < 5; i++) drawStake(ctx, z.x + Math.cos(i * 1.26 + .3) * 60, z.y + Math.sin(i * 1.26 + .3) * 26, .3, e * .7, i % 4, i % 2 === 0);
        break;
      }
      case 'latch': {
        // Black Zetsu oozes off his near side, gathering into a fist of goo
        const hx = z.x + f * 22, hy = z.y - L;
        for (let i = 0; i < 4; i++) { gooBlob(ctx, hx + Math.cos(i * 1.6 + time * 3) * 10 * e, hy + Math.sin(i * 1.6 + time * 3) * 8 * e, 6 + 8 * e, time, i); ctx.fillStyle = '#0d0b12'; ctx.fill(); }
        blackEye(ctx, hx + f * 3, hy - 3, .6 + .5 * e);
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 30 + 20 * e, '150,110,230', .5); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'army': {
        // the earth heaving where the clones will come up
        const smoke = K.puff('poof');
        for (let i = 0; i < 6; i++) { const ph = frac(time * 1.2 + i / 6), a = i * 1.05; K.stamp(ctx, smoke, z.x + Math.cos(a) * 80, z.y + Math.sin(a) * 36 - ph * 20, 8 + ph * 10, bell(ph) * .6 * k, .8); }
        break;
      }
      case 'jaws': case 'burrow': {
        // the leaves on his head flex open, a green flare
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, headY - 20, 60 + 40 * e, '150,240,100', .4); ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }
  }

  function label(ctx, z, st, m) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (!move || !MOVES[move]) return;
    const S = Spr(), id = S && S.has && S.has('zetsu') ? 'zetsu' : 'pain';
    const under = st.under && st.under.phase !== 'emerge';
    const top = under ? z.y - 70 : z.y - (S && S.height ? S.height(id) : 100) - 30;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#0c140a'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.under = null; st.latch = null;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.zt;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    if (!st.fx.length && !(st.windup > 0) && !st.under) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.under) burrowG(ctx, z, st, time);
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
      for (const s of st.tele) {
        if (s.k === 'c') markCircle(ctx, s.x, s.y, s.r, rgb, k, time, s.faint, s.small);
        else if (s.k === 'line') markLine(ctx, s, rgb, k, time);
      }
      windupG(ctx, z, st, time);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.zt;
    if (!m || !st || !Kit()) return;
    ctx.save();
    if (z.health > 0 && st.under) { burrowO(ctx, z, st, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      emergeO(ctx, z, st, time);
      latchO(ctx, st, time);
      if (st.windup > 0 && st.move) {
        windupO(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  window.ZetsuBoss = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden, moves };
})();
