(() => {
  'use strict';

  // Fourth Great Ninja War: Edo Tensei Madara Uchiha, then Six Paths (Rikudō) Madara.
  // Same contract as kage-bosses.js / akatsuki-bosses.js, plus:
  //   drawOverlay(ctx, z, time)  after the characters (Susanoo front, meteors, rods, canopies, labels)
  //   bodyLift(z)                how high the body hovers (Six Paths Madara floats)
  //   drawTransform(ctx, x, y, k, time)  the Ten-Tails rebirth cinematic, k 0 → 1 over ~4 s
  // All state lives on z.md; z.madaraWindup mirrors the current wind-up (for the 'seal' frame) and
  // z.bossCallout = { text, jp, rgb, big, x, y } is set when a big jutsu is called (the game shows and clears it).

  const TAU = Math.PI * 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  const order = ['madara', 'madara_rikudo'];
  const members = {
    madara: {
      name: 'UCHIHA MADARA — UẾ THỔ CHUYỂN SINH', short: 'MADARA', accent: '#e0464e', sprite: 'madara', fallback: 'pain',
      // armor scales every hit he takes; regen is the share of max HP knitted back per second (Edo Tensei);
      // tempo scales the pause between jutsu (lower = relentless). Below half HP he gets faster still.
      hpScale: 40, damageScale: 1.15, armor: .6, regen: .005, tempo: .7, lift: 0, speed: 1.15, rikudo: false,
      moves: ['susanoo', 'goka', 'jukai', 'gaeshi', 'tengai', 'susanoo', 'jukai', 'goka', 'gaeshi', 'susanoo', 'tengai']
    },
    madara_rikudo: {
      name: 'UCHIHA MADARA — LỤC ĐẠO', short: 'LỤC ĐẠO MADARA', accent: '#c9bcff', sprite: 'madara_rikudo', fallback: 'kaguya',
      hpScale: 70, damageScale: 1.4, armor: .5, regen: .004, tempo: .65, lift: 26, speed: 1.35, rikudo: true,
      moves: ['rods', 'staff', 'limbo', 'rods', 'tengai3', 'staff', 'perfect', 'rods', 'limbo', 'staff', 'tengai3', 'perfect']
    }
  };

  // windup = dodge window (s); after = pause before the next jutsu; big = cut-in callout.
  const MOVES = {
    susanoo: { label: 'SUSANOO · TU TÁ NĂNG HỒ', jp: '須佐能乎', rgb: '110,140,255', color: '#7f9cff', windup: 1.0, after: 1.7, big: true },
    tengai:  { label: 'THIÊN ẢI CHẤN TINH', jp: '天碍震星', rgb: '255,120,40', color: '#ff8a3a', windup: .6, after: 3.4, big: true },
    goka:    { label: 'HỎA ĐỘN · HÀO HỎA DIỆT KHƯỚC', jp: '火遁・豪火滅却', rgb: '255,96,30', color: '#ff6a2a', windup: 1.05, after: 2.3, big: true },
    jukai:   { label: 'MỘC ĐỘN · THỤ GIỚI GIÁNG ĐẢN', jp: '木遁・樹界降誕', rgb: '130,210,90', color: '#8fd062', windup: .8, after: 2.4, big: true },
    gaeshi:  { label: 'UCHIHA GAESHI', jp: 'うちは返し', rgb: '255,90,80', color: '#ff6a6a', windup: .55, after: 1.2, big: false },
    gakido:  { label: 'NGẠ QUỶ ĐẠO', jp: '餓鬼道', rgb: '190,160,255', color: '#c0a6ff', windup: .3, after: .9, big: false },
    rods:    { label: 'CẦU ĐẠO NGỌC · HẮC BỔNG', jp: '求道玉', rgb: '200,190,255', color: '#b9a6ff', windup: .8, after: 1.4, big: false },
    staff:   { label: 'LỤC ĐẠO TÍCH TRƯỢNG', jp: '錫杖', rgb: '200,190,255', color: '#b9a6ff', windup: .75, after: 1.1, big: false },
    limbo:   { label: 'LUÂN MỘ · BIÊN NGỤC', jp: '輪墓・辺獄', rgb: '170,130,255', color: '#a58aff', windup: 1.7, after: 1.8, big: true },
    tengai3: { label: 'THIÊN ẢI CHẤN TINH · TAM TINH', jp: '天碍震星', rgb: '255,120,40', color: '#ff8a3a', windup: .6, after: 4.6, big: true },
    perfect: { label: 'SUSANOO HOÀN THỂ', jp: '完成体須佐能乎', rgb: '120,130,255', color: '#8a96ff', windup: 1.8, after: 2.2, big: true },
    shield:  { label: 'CẦU ĐẠO NGỌC · THUẪN', jp: '求道玉の盾', rgb: '200,190,255', color: '#b9a6ff', windup: .25, after: .8, big: false }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const BLUE_FLAME = [[1, '#1c2585'], [.84, '#2f45c4'], [.66, '#5674ee'], [.46, '#98b0ff'], [.25, '#eef2ff']];
  const METEOR = { tengai: { r: 280, fall: 2.5, dmg: 3.0 }, tengai3: { r: 320, fall: 2.4, dmg: 3.2 } };
  const GOKA = { reach: 600, half: .62, speed: 700, dur: 4.4 };

  function pick() { return order[0]; }
  function spriteId(z) {
    const m = members[z.bossId], S = Spr();
    if (!m || !S) return 'pain';
    return S.has(m.sprite) ? m.sprite : S.has(m.fallback) ? m.fallback : 'pain';
  }
  function bodyLift(z) {
    const m = members[z && z.bossId];
    if (!m || !m.lift) return 0;
    return m.lift + Math.sin(((z.md && z.md.t) || 0) * 2.2) * 3;
  }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : (z.angle || 0);

  function state(z) {
    return z.md || (z.md = { t: 0, casts: 0, timer: 1.4, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      ev: [], fx: [], shots: [], sus: 0, susHold: 0, perf: 0, perfHold: 0, used: 0, staff: 0, shield: 0, dome: 0,
      hold: 0, dash: 0, dashA: 0, dashCd: 3, reactCd: 4, hpMark: z.health, hpClock: 0, clones: null, flakes: [], lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length > 28) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }

  // Cover a cone (true world geometry, same as the telegraph) with strike circles that land as the swing passes.
  function coneStrikes(st, x, y, a, reach, half, dmg, delay, color, kind) {
    let n = 0;
    for (let d = 70; d <= reach; d += 85) {
      const cnt = Math.max(1, Math.ceil(2 * half * d / 120));
      const r = Math.max(56, (2 * half * d / cnt) * .64);
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half * .9);
        st.ev.push({ t: delay + d / 2600, op: 'strike', x: x + Math.cos(aa) * d, y: y + Math.sin(aa) * d, r, dmg,
          color: n % 4 === 0 ? color : null, kind: n % 3 === 0 ? kind : null, quiet: n % 4 !== 0 });
        n++;
      }
    }
  }

  // ------------------------------------------------------------------ jutsu selection
  function announce(z, st, m, api, forced) {
    let move = forced;
    if (!move && st.force) { move = st.force; st.force = null; }
    if (!move) { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    if (move === 'rods') st.used = 5;
    if (move === 'staff') st.used = Math.max(st.used, 1);
    if (move === 'limbo') {
      // Four shadows of Madara slip out of his body toward the target; only the Rinnegan could see them.
      const base = Math.random() * TAU;
      st.clones = [0, 1, 2, 3].map(i => {
        const a = base + i * TAU / 4;
        return { x: z.x + Math.cos(a) * 30, y: z.y + Math.sin(a) * 30, ox: Math.cos(a) * 92, oy: Math.sin(a) * 92, a, hit: false };
      });
    }
    if (move === 'jukai') st.jukai = rootsFor(z, st);
    if (def.big) z.bossCallout = { text: def.label, jp: def.jp, rgb: def.rgb, big: move === 'tengai' || move === 'tengai3' || move === 'perfect', x: z.x, y: z.y };
  }

  function rootsFor(z, st) {
    // The forest erupts from under Madara and spreads to the marked target and beyond.
    const roots = [], tx = st.tx, ty = st.ty;
    const add = (x, y) => roots.push({ x, y, seed: roots.length * 7.31 + Math.random() * 50, h: rand(80, 120), v: roots.length % 5 });
    add(tx, ty);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + rand(-.3, .3), d = rand(95, 160); add(tx + Math.cos(a) * d, ty + Math.sin(a) * d); }
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + .5 + rand(-.3, .3), d = rand(220, 300); add(tx + Math.cos(a) * d, ty + Math.sin(a) * d); }
    for (let i = 0; i < 4; i++) { const a = st.aim + (i - 1.5) * .45, d = rand(80, 150); add(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d); }
    for (const r of roots) r.delay = .1 + Math.hypot(r.x - z.x, r.y - z.y) / 850 + rand(0, .15);
    return roots;
  }

  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 150, a = st.aim, def = MOVES[move];
    api.burst(z.x, z.y, def.color, 10);
    switch (move) {
      case 'susanoo':
        st.susHold = 1.0;
        addFx(st, { kind: 'slash', a, side: Math.cos(a) >= 0 ? 1 : -1, dur: .6 });
        coneStrikes(st, z.x, z.y, a, 330, .95, D * 1.5, .05, def.color, 'blade');
        break;
      case 'tengai':
      case 'tengai3': {
        const spec = METEOR[move];
        const n = (move === 'tengai' ? 2 : 3) + (z.health < z.maxHealth * .5 ? 1 : 0), gap = move === 'tengai' ? 1.3 : .8;
        for (let i = 0; i < n; i++) st.ev.push({ t: i * gap, op: 'meteor', r: spec.r, fall: spec.fall, dmg: D * spec.dmg, spread: i ? 70 : 0 });
        break;
      }
      case 'goka': {
        const fx = addFx(st, { kind: 'goka', x: z.x, y: z.y, a, reach: GOKA.reach, half: GOKA.half, dur: GOKA.dur, tick: .5, dmg: D, seed: Math.random() * 99 });
        fx.hits = [];
        for (let d = 70; d <= GOKA.reach; d += 80) {
          const cnt = Math.max(1, Math.ceil(2 * GOKA.half * d / 110));
          for (let i = 0; i < cnt; i++) {
            const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * GOKA.half * .9);
            fx.hits.push({ x: z.x + Math.cos(aa) * d, y: z.y + Math.sin(aa) * d, r: Math.max(52, (2 * GOKA.half * d / cnt) * .64), d, done: false });
          }
        }
        // flame tongues: area-uniform points in the cone, sorted back-to-front
        fx.pts = [];
        for (let j = 0; j < 180; j++) {
          const d = GOKA.reach * Math.sqrt(lerp(.02, 1, hash(j * 1.31 + fx.seed))), off = (hash(j * 2.71 + fx.seed) * 2 - 1) * GOKA.half * .96;
          const aa = a + off * (.55 + .45 * Math.min(1, d / 200));
          fx.pts.push({ x: z.x + Math.cos(aa) * d, y: z.y + Math.sin(aa) * d, d, s: (72 + hash(j * 4.1) * 56) * (.7 + .45 * d / GOKA.reach), i: j % 6 });
        }
        fx.pts.sort((p, q) => p.y - q.y);
        break;
      }
      case 'jukai': {
        const roots = st.jukai || rootsFor(z, st);
        let last = 0;
        for (const r of roots) {
          st.ev.push({ t: r.delay + .55, op: 'strike', x: r.x, y: r.y, r: 70, dmg: D * 1.05, color: null, kind: 'earth', quiet: true });
          last = Math.max(last, r.delay);
        }
        addFx(st, { kind: 'jukai', roots, dur: last + .55 + 3.2 });
        st.jukai = null;
        break;
      }
      case 'gaeshi':
        api.knockback(z, 270, 230, D * 1.1);
        for (let i = 0; i < 7; i++) api.projectile(z, a + (i / 6 - .5) * 1.4, 520, D * .5, 'wind', '#e8f4ff', .9);
        addFx(st, { kind: 'gaeshi', x: z.x, y: z.y, a, dur: .75 });
        st.gaeshiShow = .9;
        break;
      case 'gakido':
        st.dome = 2.6;
        break;
      case 'rods':
        for (let i = 0; i < 3; i++) st.ev.push({ t: i * .3, op: 'rods', dmg: D * .7 });
        st.ev.push({ t: 1.3, op: 'release' });
        break;
      case 'staff': {
        st.staff = .75;
        addFx(st, { kind: 'sweep', a, side: Math.cos(a) >= 0 ? 1 : -1, dur: .62 });
        api.strike(z.x, z.y, 130, D * 1.7, def.color, 'shockwave');
        for (let i = 0; i < 8; i++) {
          const aa = a + i * TAU / 8;
          st.ev.push({ t: i * .035, op: 'strike', x: z.x + Math.cos(aa) * 170, y: z.y + Math.sin(aa) * 170, r: 88, dmg: D * 1.7, color: null, kind: i % 2 ? null : 'blade', quiet: true });
        }
        st.ev.push({ t: .12, op: 'knock', r: 255, force: 170, dmg: 0 });
        st.ev.push({ t: .75, op: 'release' });
        break;
      }
      case 'limbo':
        if (st.clones) st.clones.forEach((c, i) => st.ev.push({ t: i * .26, op: 'limbo', i, dmg: D * 1.15 }));
        st.ev.push({ t: 1.4, op: 'limboEnd' });
        break;
      case 'perfect':
        st.perfHold = 1.3;
        addFx(st, { kind: 'bigslash', a, side: Math.cos(a) >= 0 ? 1 : -1, dur: .85 });
        coneStrikes(st, z.x, z.y, a, 620, 1.0, D * 2.8, .08, def.color, 'blade');
        break;
      case 'shield':
        st.shield = 2.6; st.used = 9;
        st.ev.push({ t: 2.6, op: 'release' });
        break;
    }
  }

  function runEvent(z, st, m, api, ev) {
    switch (ev.op) {
      case 'strike': api.strike(ev.x, ev.y, ev.r, ev.dmg, ev.color, ev.kind, ev.quiet); break;
      case 'knock': api.knockback(z, ev.r, ev.force, ev.dmg); break;
      case 'release': st.used = 0; break;
      case 'meteor': {
        // Each meteor locks onto where the target stands when its shadow appears.
        const p = api.player, a = Math.random() * TAU;
        const x = (p ? p.x : st.tx) + Math.cos(a) * ev.spread, y = (p ? p.y : st.ty) + Math.sin(a) * ev.spread;
        addFx(st, { kind: 'meteor', x, y, r: ev.r, fall: ev.fall, dur: ev.fall + 4.2, seed: Math.random() * 99, landed: false });
        st.ev.push({ t: ev.fall, op: 'land', x, y, r: ev.r, dmg: ev.dmg });
        break;
      }
      case 'land':
        api.strike(ev.x, ev.y, ev.r, ev.dmg, '#ff8a3a', 'crater');
        api.strike(ev.x, ev.y, ev.r * .55, 0, null, 'fire', true);
        api.burst(ev.x, ev.y, '#ffb050', 30);
        break;
      case 'rods': {
        // Five Truth-Seeking Balls stretched into black rods fire at the target together.
        const p = api.player;
        for (let i = 0; i < 5; i++) {
          const fp = rodFront(z, st, i), aa = p ? Math.atan2(p.y - fp.gy, p.x - fp.gx) + (i - 2) * .05 : st.aim + (i - 2) * .12;
          const shot = api.projectile(z, aa, 820, ev.dmg, 'rod', '#111', 1.3);
          if (!shot) continue;
          shot.x = fp.gx + Math.cos(aa) * 10; shot.y = fp.gy + Math.sin(aa) * 10;
          if (st.shots.length > 24) st.shots.shift();
          st.shots.push({ b: shot, px: NaN, py: NaN });
        }
        break;
      }
      case 'limbo': {
        const c = st.clones && st.clones[ev.i];
        if (!c) break;
        c.hit = true;
        api.strike(c.x, c.y, 100, ev.dmg, '#5a3a9a', 'shockwave', ev.i !== 0);
        addFx(st, { kind: 'limboHit', x: c.x, y: c.y, facing: Math.cos(c.a + Math.PI) >= 0 ? 1 : -1, dur: .7 });
        break;
      }
      case 'limboEnd': st.clones = null; break;
    }
  }

  // Where the i-th of the five rod balls hovers in front of Six Paths Madara (screen and ground coords).
  function rodFront(z, st, i) {
    const a = st.aim + (i - 2) * .32, lift = bodyLift(z);
    const gx = z.x + Math.cos(a) * 46, gy = z.y + Math.sin(a) * 30;
    return { gx, gy, sx: gx, sy: gy - lift - 44 - Math.abs(i - 2) * 6 };
  }
  // Ring of Truth-Seeking Balls standing behind his back.
  function ballPos(z, i, time, out) {
    const lift = bodyLift(z), a = i / 9 * TAU + time * .55;
    out.x = z.x + Math.cos(a) * 50;
    out.y = z.y - lift - 66 + Math.sin(a) * 36 + Math.sin(time * 2.3 + i) * 2;
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
      if (fx.kind === 'goka') updateGoka(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    for (let i = st.flakes.length - 1; i >= 0; i--) { const f = st.flakes[i]; f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.age > f.dur) st.flakes.splice(i, 1); }
    // track our rod shots: a shot the game removed stops moving
    for (let i = st.shots.length - 1; i >= 0; i--) {
      const s = st.shots[i];
      if (s.b.life <= 0 || (s.b.x === s.px && s.b.y === s.py)) { st.shots.splice(i, 1); continue; }
      s.px = s.b.x; s.py = s.b.y;
    }
    if (z.health <= 0) { z.madaraWindup = 0; return; }

    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); runEvent(z, st, m, api, ev); }
    }
    st.sus = Math.max(0, st.sus - dt * 1.4);
    st.perf = Math.max(0, st.perf - dt * 1.1);
    if (st.susHold > 0) { st.susHold -= dt; st.sus = 1; }
    if (st.perfHold > 0) { st.perfHold -= dt; st.perf = 1; }
    if (st.staff > 0) st.staff -= dt;
    if (st.gaeshiShow > 0) st.gaeshiShow -= dt;
    st.shield = Math.max(0, st.shield - dt);
    st.dome = Math.max(0, st.dome - dt);
    st.hold = Math.max(0, st.hold - dt);
    st.dashCd -= dt; st.reactCd -= dt;
    z.armorScale = (st.shield > 0 ? .3 : st.dome > 0 ? .4 : 1) * (m.armor || 1);
    if (m.regen && z.health < z.maxHealth) z.health = Math.min(z.maxHealth, z.health + z.maxHealth * m.regen * dt);

    // Edo Tensei body: paper ash flakes off wherever he is hit, then knits back together.
    if (!m.rikudo && z.hitFlash > .06 && st.flakes.length < 22 && Math.random() < dt * 40)
      st.flakes.push({ x: z.x + rand(-16, 16), y: z.y - rand(28, 90), vx: rand(-40, 40), vy: rand(-55, -20), age: 0, dur: rand(.5, 1.0), s: rand(2.5, 4.5), r: Math.random() * 6 });

    // a big chunk of HP lost quickly → defensive jutsu (Gakidō dome / Truth-Seeking Ball shield)
    st.hpClock += dt;
    if (st.hpClock > 1.5) { st.hpClock = 0; st.hpMark = z.health; }
    const p = api.player, d = p ? Math.hypot(p.x - z.x, p.y - z.y) : 9999;

    if (st.dash > 0) {
      st.dash -= dt;
      const step = 1500 * dt;
      api.move(Math.cos(st.dashA) * step, Math.sin(st.dashA) * step);
    }
    if (st.windup > 0) {
      if (st.move === 'limbo' && st.clones) {
        // the shadows close in on the target and freeze half a second before striking
        for (const c of st.clones) {
          const k = st.windup > .5 ? Math.min(1, dt * 4.5) : 0;
          if (p) { c.x += (p.x + c.ox - c.x) * k; c.y += (p.y + c.oy - c.y) * k; }
        }
      }
      if (st.move === 'susanoo') st.sus = Math.max(st.sus, easeOut((st.windMax - st.windup) / .45));
      if (st.move === 'perfect') st.perf = Math.max(st.perf, easeOut((st.windMax - st.windup) / 1.1));
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.85, 1.15) * (m.tempo || 1) * (z.health < z.maxHealth * .5 ? .75 : 1);
        st.hold = .35;
        st.move = '';
      }
    } else {
      st.timer -= dt;
      const hurt = st.hpMark - z.health > z.maxHealth * .045;
      if (hurt && st.reactCd <= 0 && st.timer > .2) {
        st.reactCd = 9; st.hpMark = z.health;
        announce(z, st, m, api, m.rikudo ? 'shield' : 'gakido');
      } else if (p && d < 160 && st.reactCd <= 0 && !m.rikudo) {
        st.reactCd = 8;
        announce(z, st, m, api, 'gaeshi');
      } else if (st.timer <= 0 && p && d < 820) announce(z, st, m, api);
      else if (p && d > 560 && st.dashCd <= 0 && st.dash <= 0) {
        // Shunshin: a blur of a step that closes half the distance
        st.dash = .2; st.dashA = aimAt(z, p); st.dashCd = rand(3.5, 5);
        addFx(st, { kind: 'blink', x: z.x, y: z.y, facing: Math.cos(st.dashA) >= 0 ? 1 : -1, dur: .4 });
      }
    }
    z.madaraWindup = st.windup;
    z.speedScale = st.windup > 0 ? .22 : st.hold > 0 ? .4 : m.speed;
  }

  function updateGoka(fx, dt, api) {
    const front = Math.min(fx.reach, fx.age * GOKA.speed), live = fx.age < fx.dur - .8;
    for (let i = 0; i < fx.hits.length; i++) {
      const h = fx.hits[i];
      if (!h.done && h.d <= front) { h.done = true; api.strike(h.x, h.y, h.r, fx.dmg * 1.2, null, i % 3 === 0 ? 'fire' : null, true); }
    }
    if (front >= fx.reach && live && (fx.tick -= dt) <= 0) {
      fx.tick = .4;
      for (const h of fx.hits) api.strike(h.x, h.y, h.r * .9, fx.dmg * .28, null, null, true);
    }
  }

  // ------------------------------------------------------------------ shared draw helpers
  function sector(ctx, x, y, r0, r1, a0, a1, squash = 1) {
    ctx.beginPath();
    ctx.ellipse(x, y, r1, r1 * squash, 0, a0, a1);
    if (r0 > 0) ctx.ellipse(x, y, r0, r0 * squash, 0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }

  function rockSprite() {
    return Kit().sprite('md:meteor', 192, 192, g => {
      const c = 96, R = 88, path = () => {
        g.beginPath();
        for (let i = 0; i <= 26; i++) {
          const a = i / 26 * TAU, r = R * (.9 + hash(i % 26) * .1);
          if (i) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = '#3e322c'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#5f4e42'; g.beginPath(); g.arc(c + 26, c - 30, R * .95, 0, TAU); g.fill();
      g.fillStyle = '#7a6656'; g.beginPath(); g.arc(c + 46, c - 52, R * .6, 0, TAU); g.fill();
      g.fillStyle = '#2a201c'; g.beginPath(); g.arc(c - 40, c + 44, R * .75, 0, TAU); g.fill();
      for (let i = 0; i < 9; i++) {
        const x = c + (hash(i * 3.1) - .5) * R * 1.5, y = c + (hash(i * 5.7) - .5) * R * 1.5, r = 7 + hash(i * 1.9) * 14;
        g.fillStyle = 'rgba(30,22,18,.75)'; g.beginPath(); g.ellipse(x, y, r, r * .8, .5, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(150,128,108,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + 1, y - 1, r, r * .8, .5, 3.6, 5.6); g.stroke();
      }
      g.strokeStyle = '#ff7a26'; g.lineWidth = 2.4; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        let x = c - 60 + hash(i * 9.1) * 50, y = c + 10 + hash(i * 4.4) * 60;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += 10 + hash(i * 7 + k) * 14; y += (hash(i * 3 + k * 5) - .6) * 22; g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      path(); g.strokeStyle = '#1a1210'; g.lineWidth = 4; g.stroke();
    });
  }

  function tsbSprite() {
    return Kit().sphere('md:tsb', [[0, '#8a849a'], [.12, '#3a3546'], [.45, '#100e16'], [.85, '#050407'], [1, '#000']]);
  }
  function drawBall(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(150,130,210,.35)';
    ctx.beginPath(); ctx.arc(x, y, r + 1.3, 0, TAU); ctx.fill();
    ctx.drawImage(tsbSprite(), x - r, y - r, r * 2, r * 2);
  }

  // A black Gudōdama rod (pointed both ends) centred at x,y along angle ang.
  function drawRod(ctx, x, y, ang, len, w) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const h = len / 2;
    ctx.fillStyle = 'rgba(150,130,220,.45)';
    ctx.beginPath(); ctx.moveTo(-h - 2, 0); ctx.lineTo(-h + 6, -w / 2 - 1.5); ctx.lineTo(h - 9, -w / 2 - 1.5); ctx.lineTo(h + 3, 0); ctx.lineTo(h - 9, w / 2 + 1.5); ctx.lineTo(-h + 6, w / 2 + 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#07060b';
    ctx.beginPath(); ctx.moveTo(-h, 0); ctx.lineTo(-h + 6, -w / 2); ctx.lineTo(h - 9, -w / 2); ctx.lineTo(h, 0); ctx.lineTo(h - 9, w / 2); ctx.lineTo(-h + 6, w / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a6680'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-h + 7, -w / 2 + 1.2); ctx.lineTo(h - 10, -w / 2 + 1.2); ctx.stroke();
    ctx.restore();
  }

  // Silhouette of a sprite (dark body + lavender rim) for Limbo's invisible shadows.
  function silhouette(id, facing, rim) {
    const S = Spr();
    return Kit().sprite('md:sil:' + id + ':' + facing + ':' + (rim ? 1 : 0), 220, 250, g => {
      if (rim) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) S.draw(g, id, 110 + dx, 232 + dy, { facing, frame: 'attack' });
      else S.draw(g, id, 110, 232, { facing, frame: 'attack' });
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = rim ? '#c8b4ff' : '#140a22'; g.fillRect(0, 0, 220, 250);
    });
  }
  function drawSilhouette(ctx, id, x, feetY, facing, alpha) {
    if (!(alpha > .01)) return;
    ctx.globalAlpha = Math.min(1, alpha * .6);
    ctx.drawImage(silhouette(id, facing, true), x - 110, feetY - 232);
    ctx.globalAlpha = Math.min(1, alpha * 1.5);
    ctx.drawImage(silhouette(id, facing, false), x - 110, feetY - 232);
    ctx.globalAlpha = 1;
  }

  function label(ctx, z, st, time) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[st.move], S = Spr();
    const top = z.y + 3 - bodyLift(z) - (S ? S.height(spriteId(z)) : 90) - 30 - 150 * st.sus - 250 * st.perf;
    ctx.save();
    ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#140d18'; ctx.strokeText(def.label, z.x, top);
    ctx.fillStyle = def.color; ctx.fillText(def.label, z.x, top);
    ctx.font = '700 11px sans-serif'; ctx.lineWidth = 3;
    ctx.strokeText(def.jp, z.x, top + 14); ctx.fillStyle = '#fff4f0'; ctx.fillText(def.jp, z.x, top + 14);
    ctx.restore();
  }

  // ------------------------------------------------------------------ telegraphs (ground)
  function drawTelegraph(ctx, z, st, time) {
    const move = st.move;
    if (!(st.windup > 0) || !move) return;
    const def = MOVES[move], prog = 1 - st.windup / st.windMax, pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save();
    ctx.lineWidth = 3.5; ctx.strokeStyle = def.color;
    if (move === 'susanoo' || move === 'perfect' || move === 'goka') {
      const reach = move === 'perfect' ? 620 : move === 'goka' ? GOKA.reach : 330, half = move === 'perfect' ? 1.0 : move === 'goka' ? GOKA.half : .95;
      ctx.globalAlpha = .22 + prog * .2;
      ctx.fillStyle = move === 'goka' ? 'rgba(255,90,30,.55)' : 'rgba(70,90,230,.5)';
      sector(ctx, z.x, z.y, 0, reach * prog, st.aim - half, st.aim + half); ctx.fill();
      ctx.globalAlpha = pulse;
      sector(ctx, z.x, z.y, 0, reach, st.aim - half, st.aim + half); ctx.stroke();
    } else if (move === 'gaeshi') {
      ctx.globalAlpha = pulse; ctx.beginPath(); ctx.arc(z.x, z.y, 270, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .2; ctx.fillStyle = 'rgba(255,120,110,.6)'; ctx.beginPath(); ctx.arc(z.x, z.y, 270 * prog, 0, TAU); ctx.fill();
    } else if (move === 'staff') {
      ctx.globalAlpha = pulse; ctx.beginPath(); ctx.arc(z.x, z.y, 255, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .22; ctx.fillStyle = 'rgba(40,20,70,.7)'; ctx.beginPath(); ctx.arc(z.x, z.y, 255 * prog, 0, TAU); ctx.fill();
    } else if (move === 'rods') {
      ctx.globalAlpha = pulse * .8; ctx.setLineDash([14, 10]); ctx.lineWidth = 2.5; ctx.strokeStyle = '#2a1a44';
      for (let i = 0; i < 5; i++) {
        const fp = rodFront(z, st, i), a = Math.atan2(st.ty - fp.gy, st.tx - fp.gx) + (i - 2) * .05;
        ctx.beginPath(); ctx.moveTo(fp.gx, fp.gy); ctx.lineTo(fp.gx + Math.cos(a) * 700, fp.gy + Math.sin(a) * 700); ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (move === 'jukai') {
      ctx.globalAlpha = pulse; ctx.strokeStyle = '#8fd062';
      ctx.beginPath(); ctx.arc(st.tx, st.ty, 300, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .18; ctx.fillStyle = 'rgba(70,50,30,.8)'; ctx.beginPath(); ctx.arc(st.tx, st.ty, 300 * prog, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Edo Madara: Susanoo
  function boneStroke(ctx, w, alpha) {
    ctx.strokeStyle = `rgba(40,60,200,${.55 * alpha})`; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = `rgba(190,210,255,${.9 * alpha})`; ctx.lineWidth = Math.max(1.5, w * .3); ctx.stroke();
  }

  // Edo Madara's skeletal Susanoo, in local coords (origin at his feet, scaled up) so he stands inside the ribcage.
  const SUS_SCALE = 1.3;
  function drawSusanooBack(ctx, z, lvl, time) {
    const K = Kit(), a = lvl;
    ctx.save();
    ctx.translate(z.x, z.y + 3); ctx.scale(SUS_SCALE, SUS_SCALE);
    // blue chakra-flame mantle round his feet and back
    ctx.fillStyle = `rgba(40,60,190,${.22 * a})`;
    ctx.beginPath(); ctx.ellipse(0, -72, 70 * a + 8, 96 * a + 8, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * 16, h = (52 + hash(i) * 40) * a * (.9 + .1 * Math.sin(time * 9 + i));
      if (h < 6) continue;
      ctx.globalAlpha = .7 * a;
      ctx.drawImage(K.flame((i + Math.floor(time * 12)) % 6, BLUE_FLAME, 'b'), ox - h * .22, -3 - h * (114 / 128), h * .44, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, 0, -80, 110 * a, '80,110,255', .35 * a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // spine
    for (let i = 0; i < 6; i++) { const y = -28 - i * 19; ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(6, y); boneStroke(ctx, 8, a); }
    // back halves of the ribs: out from the spine to the flanks
    for (let i = 0; i < 5; i++) {
      const y = -122 + i * 17, w = (56 - Math.abs(i - 1.5) * 4.5) * (.7 + .3 * a);
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 5, y); ctx.bezierCurveTo(s * w * .5, y - 11, s * w, y - 5, s * w, y + 9);
        boneStroke(ctx, 5.5, a * .75);
      }
    }
    // shoulder girdle
    ctx.beginPath(); ctx.moveTo(-58, -124); ctx.quadraticCurveTo(0, -142, 58, -124); boneStroke(ctx, 7, a);
    // horned skull over his head
    const sy = -152 + (1 - a) * 24;
    ctx.fillStyle = `rgba(50,80,225,${.62 * a})`; ctx.strokeStyle = `rgba(200,218,255,${a})`; ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 24, sy - 4); ctx.quadraticCurveTo(s * 44, sy - 28, s * 40, sy - 46); ctx.quadraticCurveTo(s * 26, sy - 28, s * 14, sy - 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(0, sy, 25, 23, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-18, sy + 11); ctx.lineTo(-15, sy + 30); ctx.lineTo(15, sy + 30); ctx.lineTo(18, sy + 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = `rgba(200,218,255,${.8 * a})`; ctx.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 4, sy + 20); ctx.lineTo(i * 4, sy + 28); ctx.stroke(); }
    ctx.fillStyle = `rgba(8,10,40,${.9 * a})`;
    ctx.beginPath(); ctx.ellipse(-9, sy + 1, 6.5, 5, .2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9, sy + 1, 6.5, 5, -.2, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, -9, sy + 1, 8, '170,200,255', a, true); K.glow(ctx, 9, sy + 1, 8, '170,200,255', a, true);
    ctx.restore();
  }

  function drawSusanooFront(ctx, z, st, lvl, time) {
    const a = lvl, slash = st.fx.find(f => f.kind === 'slash');
    const sd = slash ? slash.side : (Math.cos(st.aim) >= 0 ? 1 : -1);
    if (slash) drawSlashTrail(ctx, z.x, z.y - 60, slash, sd, 110, 300, '60,90,235', '215,228,255');
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.translate(z.x, z.y + 3); ctx.scale(SUS_SCALE, SUS_SCALE);
    // front halves of the ribs curving round his chest (left open in the middle so he stays visible)
    for (let i = 0; i < 5; i++) {
      const y = -122 + i * 17, w = (56 - Math.abs(i - 1.5) * 4.5) * (.7 + .3 * a), tip = 17 + i * 2.5;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * w, y + 9); ctx.bezierCurveTo(s * w, y + 22, s * (tip + 10), y + 27, s * tip, y + 25);
        boneStroke(ctx, 5.5, a * .7);
      }
    }
    // the resting off-hand
    const od = -sd;
    ctx.beginPath(); ctx.moveTo(od * 58, -124); ctx.lineTo(od * 76, -86); ctx.lineTo(od * 62, -52); boneStroke(ctx, 7, a * .85);
    // the sword arm
    const sx = sd * 56, sy = -122;
    let hx, hy, bladeAng, bladeA = a;
    if (slash) {
      const p = easeOut(slash.age / .22), th = slash.a - sd * 1.15 + sd * 2.3 * p;
      hx = Math.cos(th) * 60; hy = -60 + Math.sin(th) * 30;
      bladeAng = Math.atan2(Math.sin(th) * .55, Math.cos(th));
      bladeA = a * (1 - win(slash.age, .35, .6));
    } else {
      const rise = st.move === 'susanoo' ? easeOut((st.windMax - st.windup) / .6) : 0;
      hx = sx + sd * (8 + 10 * rise); hy = sy - 24 - 32 * rise;
      bladeAng = -Math.PI / 2 - sd * (.3 + .5 * rise);
    }
    const ex = (sx + hx) / 2 + sd * 18, ey = (sy + hy) / 2 + 12;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); boneStroke(ctx, 8, a);
    drawChakraBlade(ctx, hx, hy, bladeAng, 175 * (.4 + .6 * a), 12, bladeA, time, '50,80,220', '#cfe0ff');
    ctx.restore();
  }

  function drawChakraBlade(ctx, x, y, ang, len, w, alpha, time, rgb, edge) {
    if (!(alpha > .01)) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${rgb},.75)`;
    ctx.beginPath(); ctx.moveTo(-6, -w * .45); ctx.lineTo(len * .8, -w * .5); ctx.lineTo(len, 0); ctx.lineTo(len * .8, w * .5); ctx.lineTo(-6, w * .45); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${rgb},.5)`; ctx.lineWidth = w * 1.4;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(len * .92, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,246,255,.9)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(len * .95, 0); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#141a40'; ctx.fillRect(-14, -w * .8, 8, w * 1.6);
    ctx.restore();
  }

  // Crescent of a sword sweep on the ground plane (squashed ellipse band).
  function drawSlashTrail(ctx, x, cy, fx, sd, r0, r1, rgb, edgeRgb) {
    const p = easeOut(fx.age / .22), fade = 1 - win(fx.age, .22, fx.dur);
    if (!(fade > .01)) return;
    const th0 = fx.a - sd * 1.15, th1 = fx.a - sd * 1.15 + sd * 2.3 * p;
    const lo = Math.min(th0, th1), hi = Math.max(th0, th1);
    if (hi - lo < .02) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = `rgba(${rgb},.42)`;
    sector(ctx, x, cy, r0, r1, lo, hi, .55); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${rgb},.25)`;
    sector(ctx, x, cy, r0 + (r1 - r0) * .45, r1, lo, hi, .55); ctx.fill();
    ctx.strokeStyle = `rgba(${edgeRgb},.95)`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, cy, r1, r1 * .55, 0, lo, hi); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(x, cy, r1 - 8, (r1 - 8) * .55, 0, lo, hi); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ gunbai & Uchiha Gaeshi
  function drawGunbai(ctx, x, y, size, rot, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, size * .3); ctx.lineTo(0, size * 1.25); ctx.stroke();
    ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, size * .3); ctx.lineTo(0, size * 1.22); ctx.stroke();
    // chain tied at the grip
    ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-4 - i * 3, size * 1.25 + i * 5, 2.4, 3.4, .5, 0, TAU); ctx.stroke(); }
    // fan face: red war fan with dark rim and the three-tomoe mark
    ctx.fillStyle = '#b3232c'; ctx.strokeStyle = '#2a0b0e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -size * .2, size * .62, size * .68, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a1820'; ctx.beginPath(); ctx.ellipse(size * .12, -size * .1, size * .5, size * .56, 0, -.6, 2.2); ctx.fill();
    ctx.strokeStyle = '#4a0f14'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, -size * .2, size * .5, size * .56, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#e9dccb'; ctx.beginPath(); ctx.arc(0, -size * .2, size * .26, 0, TAU); ctx.fill();
    ctx.fillStyle = '#16090a';
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 - .5, cx = Math.cos(a) * size * .12, cy = -size * .2 + Math.sin(a) * size * .12;
      ctx.beginPath(); ctx.arc(cx, cy, size * .065, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a + 1.6) * size * .065, cy + Math.sin(a + 1.6) * size * .065);
      ctx.quadraticCurveTo(cx + Math.cos(a + 2.4) * size * .17, cy + Math.sin(a + 2.4) * size * .17, cx + Math.cos(a + 3.3) * size * .14, cy + Math.sin(a + 3.3) * size * .14);
      ctx.lineTo(cx + Math.cos(a - 1.6) * size * .065, cy + Math.sin(a - 1.6) * size * .065); ctx.fill();
    }
    ctx.restore();
  }

  function drawGaeshi(ctx, fx, time) {
    const K = Kit(), k = fx.age / fx.dur, fade = 1 - easeIn(k), cy = fx.y - 34;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const r = 50 + easeOut(k * 1.2 - i * .12) * 270;
      if (r < 52) continue;
      ctx.globalAlpha = fade * (1 - i * .25);
      ctx.fillStyle = 'rgba(105,160,250,.45)';
      sector(ctx, fx.x, cy, Math.max(0, r - 34), r, fx.a - 1.05, fx.a + 1.05, .55); ctx.fill();
      ctx.fillStyle = 'rgba(236,246,255,.55)';
      sector(ctx, fx.x, cy, Math.max(0, r - 12), r, fx.a - 1.0, fx.a + 1.0, .55); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(225,240,255,.9)'; ctx.lineWidth = 3.5 - i;
      ctx.beginPath(); ctx.ellipse(fx.x, cy, r, r * .55, 0, fx.a - 1.05, fx.a + 1.05); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = fade;
    ctx.strokeStyle = 'rgba(240,248,255,.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const a = fx.a + (hash(i * 3.3) - .5) * 2, d0 = 40 + easeOut(k) * 160 + hash(i) * 40, d1 = d0 + 50 + hash(i * 2) * 50;
      ctx.beginPath(); ctx.moveTo(fx.x + Math.cos(a) * d0, cy + Math.sin(a) * d0 * .55); ctx.lineTo(fx.x + Math.cos(a) * d1, cy + Math.sin(a) * d1 * .55); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x + Math.cos(fx.a) * 40, cy + Math.sin(fx.a) * 20, 90, '170,210,255', fade * .6);
    ctx.restore();
  }

  function drawDome(ctx, z, st, time) {
    const K = Kit(), x = z.x, fy = z.y + 3, k = Math.min(1, (2.6 - st.dome) / .25) * Math.min(1, st.dome / .35), R = 96;
    if (!(k > .01)) return;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(170,140,255,.16)';
    ctx.beginPath(); ctx.ellipse(x, fy, R, 128, 0, Math.PI, TAU); ctx.ellipse(x, fy, R, R * .42, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = 'rgba(205,185,255,.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, fy, R, 128, 0, Math.PI, TAU); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(205,185,255,.45)';
    for (const rx of [.35, .7]) { ctx.beginPath(); ctx.ellipse(x, fy, R * rx, 128, 0, Math.PI, TAU); ctx.stroke(); }
    for (const ry of [.4, .75]) { ctx.beginPath(); ctx.ellipse(x, fy - 128 * ry, R * Math.sqrt(1 - ry * ry), R * .42 * Math.sqrt(1 - ry * ry), 0, 0, TAU); ctx.stroke(); }
    // Rinnegan ripples on the ground and chakra being drawn in
    for (let i = 0; i < 3; i++) {
      const r = ((time * .9 + i / 3) % 1) * R;
      ctx.strokeStyle = `rgba(190,160,255,${.6 * (1 - r / R)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, fy, r, r * .42, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(220,200,255,.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + hash(i) * .5, u = (time * 1.6 + hash(i * 3)) % 1, d = (1 - u) * 150 + 18;
      const px = x + Math.cos(a) * d, py = fy - 52 + Math.sin(a) * d * .6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (x - px) * .18, py + (fy - 52 - py) * .18); ctx.stroke();
    }
    K.glow(ctx, x, fy - 52, 60, '180,150,255', .35 * k);
    ctx.restore();
  }

  // ------------------------------------------------------------------ Tengai Shinsei
  const METEOR_DIR = { x: .42, y: -.91 }; // where in the sky it comes from (screen)
  function meteorGround(ctx, fx, time) {
    const K = Kit(), x = fx.x, y = fx.y, r = fx.r;
    ctx.save();
    if (fx.age < fx.fall) {
      const k = fx.age / fx.fall, pulse = .55 + Math.sin(time * (10 + k * 18)) * .2;
      // the shadow darkens and spreads as the rock blots out the sky
      ctx.fillStyle = `rgba(18,8,6,${.12 + .5 * easeIn(k)})`;
      ctx.beginPath(); ctx.ellipse(x, y, r * (.3 + .7 * easeIn(k)), r * (.3 + .7 * easeIn(k)) * .62, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff6a26'; ctx.lineWidth = 4; ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.globalAlpha = pulse * .7;
      ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .6;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r - 18), y + Math.sin(a) * (r - 18)); ctx.lineTo(x + Math.cos(a) * (r + 18), y + Math.sin(a) * (r + 18)); ctx.stroke();
      }
      // wind-blown dust as the air is pushed down just before impact
      if (k > .7) {
        const dust = K.puff('dust'), e = win(k, .7, 1);
        ctx.globalAlpha = 1;
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8 + hash(i + fx.seed), d = r * (.6 + e * .5);
          K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .55, r * .12, e * .5);
        }
      }
    } else {
      const t = fx.age - fx.fall, fade = 1 - win(t, fx.dur - fx.fall - 1.2, fx.dur - fx.fall);
      // crater: raised rim, dark bowl, molten cracks
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#6e5a46';
      ctx.beginPath(); ctx.ellipse(x, y, r * .86, r * .5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2c211b';
      ctx.beginPath(); ctx.ellipse(x, y + 4, r * .7, r * .38, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9c8466';
      ctx.beginPath(); ctx.ellipse(x, y - r * .36, r * .55, r * .1, 0, Math.PI, TAU); ctx.fill();
      const hot = 1 - win(t, .3, 3);
      ctx.strokeStyle = `rgba(255,${110 + 80 * hot | 0},40,${hot})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const a = hash(i * 4.7 + fx.seed) * TAU;
        let px = x + Math.cos(a) * r * .15, py = y + Math.sin(a) * r * .08;
        ctx.beginPath(); ctx.moveTo(px, py);
        for (let s = 1; s <= 3; s++) { const aa = a + (hash(i * 9 + s) - .5) * .8, d = r * (.15 + s * .26); px = x + Math.cos(aa) * d; py = y + 4 + Math.sin(aa) * d * .52; ctx.lineTo(px, py); }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y, r * .8, '255,110,30', .6 * hot, false, .55);
      ctx.globalCompositeOperation = 'source-over';
      // the broken meteor sitting half-buried in its crater
      const R = r * .5;
      ctx.save();
      ctx.beginPath(); ctx.rect(x - R * 1.2, y - R * 2.2, R * 2.4, R * 2.2 + 6); ctx.clip();
      ctx.drawImage(rockSprite(), x - R, y - R * 1.25, R * 2, R * 2);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x - R * .3, y - R * .2, R * .7, '255,120,40', .5 * hot);
      ctx.globalCompositeOperation = 'source-over';
      // fire licking round the rim for a few seconds
      const fire = (1 - win(t, 1.2, 3.4)) * win(t, .5, .9);
      if (fire > .02) {
        for (let i = 0; i < 9; i++) {
          if (hash(i * 5.3 + fx.seed) < .3) continue;
          const a = hash(i * 1.7 + fx.seed) * TAU, d = r * (.45 + hash(i * 3.1 + fx.seed) * .4);
          const h = r * (.12 + hash(i * 2 + fx.seed) * .22) * fire * (.85 + .15 * Math.sin(time * 11 + i));
          const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .5;
          ctx.drawImage(K.flame((i + Math.floor(time * 10)) % 6), px - h * .22, py - h * (114 / 128), h * .44, h);
        }
      }
      if (t < 1.2) K.fx.debris(ctx, x, y, r * 1.3, t / 1.2, fx.seed, '#3a2a22', 16);
    }
    ctx.restore();
  }

  function meteorSky(ctx, fx, time) {
    const K = Kit(), r = fx.r;
    ctx.save();
    if (fx.age < fx.fall) {
      const k = fx.age / fx.fall, e = Math.pow(k, 1.7), far = 1250 * (1 - e);
      const R = r * (.48 + .2 * k), mx = fx.x + METEOR_DIR.x * far, my = fx.y - R * .5 + METEOR_DIR.y * far;
      const trail = Math.atan2(METEOR_DIR.y, METEOR_DIR.x);
      // smoke trail
      const smoke = K.puff('smoke');
      for (let i = 6; i >= 1; i--) {
        const d = R * (.6 + i * .55);
        K.stamp(ctx, smoke, mx + Math.cos(trail) * d + Math.sin(time * 3 + i) * 6, my + Math.sin(trail) * d, R * (.45 + i * .1), .6 - i * .06);
      }
      // comet streak and a fire mantle wrapping the rock, streaming back the way it came
      const m = ctx.getTransform();
      ctx.translate(mx, my); ctx.rotate(trail + Math.PI / 2);
      ctx.fillStyle = 'rgba(255,120,40,.35)';
      ctx.beginPath(); ctx.moveTo(-R * .95, 0); ctx.lineTo(-R * .35, -R * 4.2); ctx.lineTo(R * .35, -R * 4.2); ctx.lineTo(R * .95, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,210,120,.35)';
      ctx.beginPath(); ctx.moveTo(-R * .55, 0); ctx.lineTo(0, -R * 3.2); ctx.lineTo(R * .55, 0); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 7; i++) {
        const ox = (i - 3) * R * .27, h = R * (1.25 + hash(i) * .5 - Math.abs(i - 3) * .12) * (.9 + .1 * Math.sin(time * 14 + i));
        ctx.drawImage(K.flame((i + Math.floor(time * 12)) % 6), ox - h * .25, -h * (114 / 128) + R * (.75 - Math.abs(i - 3) * .12), h * .5, h);
      }
      ctx.setTransform(m);
      ctx.drawImage(rockSprite(), mx - R, my - R, R * 2, R * 2);
      // red-hot leading face: a solid molten crescent (reads on any ground), then the additive heat
      ctx.save();
      ctx.beginPath(); ctx.arc(mx, my, R * .92, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(230,70,20,.75)';
      ctx.beginPath(); ctx.arc(mx - METEOR_DIR.x * R * 1.05, my - METEOR_DIR.y * R * 1.05, R * .95, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,90,.85)';
      ctx.beginPath(); ctx.arc(mx - METEOR_DIR.x * R * 1.45, my - METEOR_DIR.y * R * 1.45, R * .95, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, mx - METEOR_DIR.x * R * .7, my - METEOR_DIR.y * R * .7, R * 1.1, '255,120,30', .8, true);
      K.glow(ctx, mx, my, R * 1.9, '255,90,20', .3);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      const t = fx.age - fx.fall;
      ctx.globalCompositeOperation = 'lighter';
      if (t < .4) K.glow(ctx, fx.x, fx.y - r * .3, r * (1.6 + t * 3), '255,200,140', 1 - t / .4, true);
      ctx.globalCompositeOperation = 'source-over';
      if (t < 1.4) K.fx.fireBlast(ctx, fx.x, fx.y, r * .95, t / 1.4, 1, time, fx.seed);
      if (t < .9) {
        K.fx.shockRing(ctx, fx.x, fx.y, r * 1.6, t / .9, 1 - t / .9, '255,170,90');
        if (t > .1) K.fx.shockRing(ctx, fx.x, fx.y, r * 2.1, (t - .1) / .8, (1 - t / .9) * .7, '255,230,200');
      }
      // dust cloud rolling outward, then a lingering smoke column
      const dust = K.puff('dust'), smoke = K.puff('smoke');
      if (t < 2.6) {
        const e = easeOut(t / 1.4), a0 = 1 - win(t, 1, 2.6);
        for (let i = 0; i < 14; i++) {
          const a = i * TAU / 14 + hash(i + fx.seed) * .4, d = r * (.45 + e * (.6 + hash(i * 2.3 + fx.seed) * .35));
          K.stamp(ctx, dust, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * .5 - 8 - hash(i * 4.4) * r * .15, r * (.09 + e * (.07 + hash(i * 6.1) * .08)), a0 * .7, .75);
        }
      }
      if (t > .6 && t < 4) {
        const s = win(t, .6, 4);
        for (let i = 0; i < 5; i++) {
          const ox = (hash(i * 3.7 + fx.seed) - .5) * r * .5;
          K.stamp(ctx, smoke, fx.x + ox + s * 20, fx.y - r * .4 - s * r * 1.1 - i * r * .18, r * (.22 + s * .2), bell(s) * .55);
        }
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Gōka Mekkyaku
  function gokaGround(ctx, fx, time) {
    const K = Kit(), front = Math.min(fx.reach, fx.age * GOKA.speed), rolling = front < fx.reach;
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
    // a field of flame tongues; the rolling front wall is drawn over the characters (overlay)
    for (const p of fx.pts) {
      if (p.d > front || (rolling && p.d > front - 90)) continue;
      const since = fx.age - p.d / GOKA.speed;
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

  function gokaOverlay(ctx, fx, time) {
    const K = Kit(), front = Math.min(fx.reach, fx.age * GOKA.speed), rolling = front < fx.reach;
    const fade = 1 - win(fx.age, fx.dur - 1.1, fx.dur);
    ctx.save();
    if (rolling) {
      // the rolling wall of fire, tall and boiling
      // the rolling wall of fire: dense rows of tall tongues along the leading edge
      const grow = .55 + .45 * Math.min(1, front / 260), n = 24;
      for (let row = 1; row >= 0; row--) {
        for (let i = 0; i < n; i++) {
          const u = (i + row * .5) / n, aa = fx.a + (u * 2 - 1) * fx.half * .95, d = front - row * 34 - hash(i * 3.3 + row) * 16;
          if (d < 30) continue;
          const h = (96 + hash(i * 7.1 + row) * 56) * grow * (1 - row * .2) * (.88 + .12 * Math.sin(time * 15 + i * 1.7));
          const px = fx.x + Math.cos(aa) * d, py = fx.y + Math.sin(aa) * d;
          ctx.drawImage(K.flame((i + row * 3 + Math.floor(time * 13)) % 6), px - h * .26, py - h * (114 / 128), h * .52, h);
        }
      }
      for (const p of fx.pts) {
        if (p.d > front - 40 || p.d <= front - 110) continue;
        const h = p.s * 1.3 * (.85 + .15 * Math.sin(time * 15 + p.d));
        ctx.drawImage(K.flame((p.i + Math.floor(time * 13)) % 6), p.x - h * .24, p.y - h * (114 / 128), h * .48, h);
      }
      // the torrent pouring from Madara's mouth
      const mx = fx.x + Math.cos(fx.a) * 20, my = fx.y - 62 + Math.sin(fx.a) * 10, m = ctx.getTransform();
      ctx.translate(mx, my); ctx.rotate(Math.atan2(Math.sin(fx.a) * .6 + .35, Math.cos(fx.a)) + Math.PI / 2);
      for (let i = 4; i >= 0; i--) {
        const h = (60 + i * 26) * Math.min(1, fx.age * 4), w = h * (.42 + i * .05);
        ctx.drawImage(K.flame((i + Math.floor(time * 14)) % 6), -w / 2 + Math.sin(time * 20 + i) * 3, -h * (114 / 128) + 6 - i * 30, w, h);
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
    // smoke boiling off as the sea dies down
    if (fx.age > fx.dur - 2.2) {
      const smoke = K.puff('smoke'), s = win(fx.age, fx.dur - 2.2, fx.dur);
      for (let i = 0; i < fx.pts.length; i += 7) {
        const p = fx.pts[i];
        K.stamp(ctx, smoke, p.x, p.y - 30 - s * 70, 22 + s * 22, bell(s) * .55);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Jukai Kōtan
  // Trees are baked once into 5 variants (trunks for the ground pass, canopies for the overlay) and
  // stretched up from the ground as they burst out, so a whole forest costs a few drawImage calls.
  const TREE_W = 200, TREE_H = 190, TREE_BX = 100, TREE_BY = 175;
  function treeSprite(v, canopy) {
    return Kit().sprite('md:tree' + (canopy ? 'c' : 't') + v, TREE_W, TREE_H, g => {
      const seed = v * 13.7 + 3;
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
          // surface root snaking off the base, then the trunk (outline, bark, lit edge)
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
          g.fillStyle = '#244d1d';
          g.beginPath(); g.arc(tx, ty, r * 1.2, 0, TAU); g.arc(tx - r * .85, ty + r * .3, r * .85, 0, TAU); g.arc(tx + r * .9, ty + r * .25, r * .8, 0, TAU); g.fill();
          g.fillStyle = '#4a8c36'; g.beginPath(); g.arc(tx - r * .15, ty - r * .2, r * .88, 0, TAU); g.arc(tx + r * .6, ty + r * .1, r * .5, 0, TAU); g.fill();
          g.fillStyle = '#7cbf55'; g.beginPath(); g.arc(tx - r * .35, ty - r * .48, r * .38, 0, TAU); g.fill();
        }
      }
    });
  }
  function jukaiGround(ctx, fx, time) {
    const K = Kit(), end = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.save(); ctx.lineCap = 'round';
    for (const r of fx.roots) {
      const t = fx.age - r.delay;
      if (t < 0) continue;
      if (t < .55) {
        // the ground cracks and bulges where the root is about to burst
        const k = t / .55, pulse = .6 + Math.sin(time * 30) * .2;
        ctx.fillStyle = `rgba(60,40,24,${.25 + .3 * k})`;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, 70 * (.5 + .5 * k), 70 * (.5 + .5 * k) * .5, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(143,208,98,${pulse})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(r.x, r.y, 70, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = hash(r.seed + i * 2) * TAU, d = 20 + 40 * k;
          ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + Math.cos(a) * d * .6, r.y + Math.sin(a) * d * .3 + 3); ctx.lineTo(r.x + Math.cos(a + .3) * d, r.y + Math.sin(a + .3) * d * .5); ctx.stroke();
        }
        continue;
      }
      const g = easeOut((t - .55) / .22) * end;
      if (g <= .01) continue;
      ctx.fillStyle = `rgba(50,34,20,${.45 * end})`;
      ctx.beginPath(); ctx.ellipse(r.x, r.y + 2, 46, 18, 0, 0, TAU); ctx.fill();
      const s = r.h / 100;
      ctx.drawImage(treeSprite(r.v, false), r.x - TREE_BX * s, r.y - TREE_BY * s * g, TREE_W * s, TREE_H * s * g);
      if (t - .55 < .7) K.fx.debris(ctx, r.x, r.y, 70, (t - .55) / .7, r.seed, '#4a3320', 8);
    }
    ctx.restore();
  }
  function jukaiOverlay(ctx, fx, time) {
    const end = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.save();
    for (const r of fx.roots) {
      const t = fx.age - r.delay - .55;
      if (t < .06) continue;
      const g = easeOut(t / .22) * end, leaf = easeOut((t - .06) / .25) * end;
      if (leaf <= .01) continue;
      const s = r.h / 100, sway = Math.sin(time * 2 + r.seed) * 2;
      ctx.globalAlpha = .93 * leaf;
      ctx.drawImage(treeSprite(r.v, true), r.x - TREE_BX * s + sway, r.y - TREE_BY * s * g, TREE_W * s, TREE_H * s * g);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Six Paths: staff, sweep, limbo, shield, perfect Susanoo
  function drawStaff(ctx, x, y, ang, len, alpha, time) {
    const K = Kit();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(190,175,240,.4)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-len * .25, 0); ctx.lineTo(len, 0); ctx.stroke();
    ctx.strokeStyle = '#05060b'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#5b5c72'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-len * .22, -1.6); ctx.lineTo(len * .95, -1.6); ctx.stroke();
    // shakujō head: a ring with a crescent and small rings
    ctx.strokeStyle = '#05060b'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(len + 13, 0, 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,185,255,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#05060b';
    ctx.beginPath(); ctx.arc(len + 30, 0, 9, -1.4, 1.4); ctx.arc(len + 26, 0, 7, 1.2, -1.2, true); ctx.fill();
    for (const s of [-1, 1]) { ctx.strokeStyle = '#0c0c14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(len + 9, s * 13, 4, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, len + 13, 0, 22, '160,130,255', .4 * alpha);
    ctx.restore();
  }

  // Six Paths Madara's Perfect Susanoo: a winged, armoured tengu-masked giant, drawn in local coords
  // (origin under Madara, y up negative). Back pass: wings, hair, torso, head. Front pass: the sword arms.
  const PS_BODY = 'rgba(52,64,205,.5)', PS_DARK = 'rgba(26,32,130,.55)', PS_LINE = 'rgba(196,206,255,.95)';
  function perfectFrame(z, lvl) {
    return { x: z.x, fy: z.y + 3 - bodyLift(z) * .5, s: .72 + .28 * easeOut(lvl) };
  }
  function drawPerfectBack(ctx, z, lvl, time) {
    const K = Kit(), a = lvl, F = perfectFrame(z, lvl), f = Math.cos(z.angle || 0) >= 0 ? 1 : -1;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.translate(F.x, F.fy); ctx.scale(F.s, F.s);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, 0, -150, 210, '80,100,255', .3 * a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    ctx.strokeStyle = PS_LINE;
    // wings: layered feather blades sweeping up and out from behind the shoulders
    for (const side of [-1, 1]) {
      for (let layer = 0; layer < 2; layer++) {
        for (let k = 0; k < 7; k++) {
          const t = k / 6, ang = -Math.PI / 2 + side * (.35 + t * 1.35 + layer * .12) + Math.sin(time * 1.8 + k * .4) * .025;
          const L = (layer ? 120 : 175) * (1 - t * .38), W = (layer ? 13 : 17) * (1 - t * .3);
          const rx = side * 54, ry = -212, tx = rx + Math.cos(ang) * L, ty = ry + Math.sin(ang) * L;
          const nx = -Math.sin(ang) * W, ny = Math.cos(ang) * W, bend = side * 14;
          ctx.fillStyle = layer ? 'rgba(80,96,232,.55)' : PS_DARK;
          ctx.beginPath(); ctx.moveTo(rx, ry);
          ctx.quadraticCurveTo((rx + tx) / 2 + nx + bend, (ry + ty) / 2 + ny, tx, ty);
          ctx.quadraticCurveTo((rx + tx) / 2 - nx * .4 + bend, (ry + ty) / 2 - ny * .4, rx, ry);
          ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
        }
      }
    }
    // long hair-like mane down the back
    ctx.fillStyle = PS_DARK;
    ctx.beginPath(); ctx.moveTo(-22, -282); ctx.quadraticCurveTo(-56, -230, -40, -150); ctx.quadraticCurveTo(-10, -128, 0, -112);
    ctx.quadraticCurveTo(10, -128, 40, -150); ctx.quadraticCurveTo(56, -230, 22, -282); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
    // armoured torso, belt and plated skirt
    ctx.fillStyle = PS_BODY; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-18, -240); ctx.quadraticCurveTo(-60, -238, -84, -214); ctx.lineTo(-66, -176); ctx.quadraticCurveTo(-64, -138, -44, -112);
    ctx.lineTo(-60, -80); ctx.lineTo(-74, -36); ctx.quadraticCurveTo(0, -18, 74, -36); ctx.lineTo(60, -80); ctx.lineTo(44, -112);
    ctx.quadraticCurveTo(64, -138, 66, -176); ctx.lineTo(84, -214); ctx.quadraticCurveTo(60, -238, 18, -240); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, -236); ctx.lineTo(0, -116); ctx.stroke();
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 4, -214); ctx.quadraticCurveTo(side * 50, -212, side * 54, -172); ctx.quadraticCurveTo(side * 30, -160, side * 4, -166); ctx.stroke(); }
    for (let i = 0; i < 3; i++) { const y = -150 + i * 13, w = 46 - i * 2; ctx.beginPath(); ctx.moveTo(-w, y); ctx.quadraticCurveTo(0, y + 7, w, y); ctx.stroke(); }
    ctx.fillStyle = PS_DARK; ctx.fillRect(-48, -114, 96, 10); ctx.strokeRect(-48, -114, 96, 10);
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 26, -104); ctx.lineTo(i * 30, -34); ctx.stroke(); }
    // pauldrons
    for (const side of [-1, 1]) {
      for (let p = 0; p < 3; p++) {
        ctx.fillStyle = p ? PS_BODY : 'rgba(70,86,228,.6)';
        ctx.beginPath(); ctx.ellipse(side * (86 + p * 4), -212 + p * 13, 34 - p * 4, 16, side * .35, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    // head: helmet with crescent crest, tengu nose, glowing eyes
    ctx.fillStyle = 'rgba(62,76,218,.66)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -264, 25, 29, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f * 8, -262); ctx.quadraticCurveTo(f * 34, -262, f * 52, -250); ctx.lineTo(f * 10, -246); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(90,108,240,.7)';
    ctx.beginPath(); ctx.moveTo(-6, -290); ctx.quadraticCurveTo(-40, -300, -54, -334); ctx.quadraticCurveTo(-30, -312, 0, -306);
    ctx.quadraticCurveTo(30, -312, 54, -334); ctx.quadraticCurveTo(40, -300, 6, -290); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(10,12,50,.85)';
    ctx.beginPath(); ctx.ellipse(-9, -268, 7, 3.5, -.2 * f, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(9, -268, 7, 3.5, .2 * f, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, -9, -268, 11, '205,220,255', a, true); K.glow(ctx, 9, -268, 11, '205,220,255', a, true);
    ctx.globalCompositeOperation = 'source-over';
    // chakra mantle: blue flames wrapping the base
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * 24, h = (130 - Math.abs(i - 3) * 18 + hash(i * 2) * 24) * a * (.9 + .1 * Math.sin(time * 8 + i));
      if (h < 8) continue;
      ctx.globalAlpha = .55 * a;
      ctx.drawImage(K.flame((i + Math.floor(time * 11)) % 6, BLUE_FLAME, 'b'), ox - h * .28, -14 + Math.abs(i - 3) * 4 - h * (114 / 128), h * .56, h);
    }
    ctx.restore();
  }

  function drawPerfectFront(ctx, z, st, lvl, time) {
    const a = lvl, F = perfectFrame(z, lvl), s = F.s;
    const slash = st.fx.find(fx => fx.kind === 'bigslash');
    if (slash) drawSlashTrail(ctx, F.x, F.fy - 70, slash, slash.side, 150, 640, '70,80,235', '220,228,255');
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const shx = F.x + side * 90 * s, shy = F.fy - 204 * s;
      let hx, hy, ang;
      if (slash && side === slash.side) {
        const p = easeOut(slash.age / .28), th = slash.a - side * 1.15 + side * 2.3 * p;
        hx = F.x + Math.cos(th) * 120 * s; hy = F.fy - 110 * s + Math.sin(th) * 60 * s;
        ang = Math.atan2(Math.sin(th) * .55, Math.cos(th));
      } else {
        const rise = st.move === 'perfect' ? easeOut((st.windMax - st.windup) / 1.2) : .3;
        hx = shx + side * 34 * s; hy = shy + (70 - 110 * rise) * s;
        ang = -Math.PI / 2 + side * (.2 + .4 * rise);
      }
      const ex = (shx + hx) / 2 + side * 30 * s, ey = (shy + hy) / 2 + 26 * s;
      ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy);
      ctx.strokeStyle = `rgba(52,64,205,${.6 * a})`; ctx.lineWidth = 24 * s; ctx.stroke();
      ctx.strokeStyle = `rgba(196,206,255,${.9 * a})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = `rgba(70,86,228,${.6 * a})`; ctx.beginPath(); ctx.arc(hx, hy, 13 * s, 0, TAU); ctx.fill(); ctx.stroke();
      const fade = slash && side === slash.side ? 1 - win(slash.age, .5, slash.dur) : 1;
      drawChakraBlade(ctx, hx, hy, ang, 290 * s, 20 * s, a * fade, time, '60,70,220', '#d4dcff');
    }
    ctx.restore();
  }

  function drawSweep(ctx, z, fx, time) {
    const x = z.x, cy = z.y + 3 - bodyLift(z) - 34, p = easeOut(fx.age / .34), fade = 1 - win(fx.age, .34, fx.dur);
    const th0 = fx.a - fx.side * Math.PI, th = th0 + fx.side * TAU * p;
    const lo = fx.side > 0 ? Math.max(th0, th - 2.4) : th, hi = fx.side > 0 ? th : Math.min(th0, th + 2.4);
    ctx.save();
    if (hi - lo > .02) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(42,16,84,.58)';
      sector(ctx, x, cy, 50, 255, lo, hi, .5); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(170,140,255,.32)'; sector(ctx, x, cy, 150, 255, lo, hi, .5); ctx.fill();
      ctx.strokeStyle = 'rgba(230,220,255,.95)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(x, cy, 252, 126, 0, lo, hi); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fx.age < .45) {
      const ex = Math.cos(th) * 150, ey = Math.sin(th) * 75;
      drawStaff(ctx, x, cy, Math.atan2(ey, ex), Math.hypot(ex, ey), 1, time);
    }
    ctx.restore();
  }

  function drawShield(ctx, z, st, time) {
    const K = Kit(), k = Math.min(1, (2.6 - st.shield) / .3) * Math.min(1, st.shield / .3);
    if (!(k > .01)) return;
    const a = st.aim, lift = bodyLift(z);
    const cx = z.x + Math.cos(a) * 42, cy = z.y + 3 - lift - 50 + Math.sin(a) * 22;
    const w = 60 * (.3 + .7 * k), h = 74 * (.3 + .7 * k), tilt = Math.cos(a) * .35;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(150,130,220,.5)';
    ctx.beginPath(); ctx.ellipse(cx, cy, w * (.55 + .45 * Math.abs(Math.sin(a))) + 3, h + 3, tilt, 0, TAU); ctx.fill();
    ctx.fillStyle = '#060509';
    ctx.beginPath(); ctx.ellipse(cx, cy, w * (.55 + .45 * Math.abs(Math.sin(a))), h, tilt, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,180,.55)'; ctx.lineWidth = 1.6;
    for (let i = 1; i <= 3; i++) {
      const r = ((time * .7 + i / 3) % 1);
      ctx.beginPath(); ctx.ellipse(cx, cy, w * r * (.55 + .45 * Math.abs(Math.sin(a))), h * r, tilt, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160,150,190,.35)';
    ctx.beginPath(); ctx.ellipse(cx - w * .25, cy - h * .45, w * .18, h * .12, -.4, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, h * 1.3, '120,90,220', .25 * k);
    ctx.restore();
  }

  function drawLimboGround(ctx, z, st, time) {
    if (!st.clones) return;
    const S = Spr(), id = spriteId(z), prog = st.move === 'limbo' ? 1 - st.windup / st.windMax : 1;
    ctx.save();
    for (let i = 0; i < st.clones.length; i++) {
      const c = st.clones[i];
      if (c.hit) continue;
      const fy = c.y + 3, locked = st.move === 'limbo' && st.windup < .5;
      // faint Rinnegan ripples + hit circle on the ground
      ctx.strokeStyle = `rgba(170,140,255,${(locked ? .75 : .35) * prog})`; ctx.lineWidth = locked ? 2.5 : 1.5;
      ctx.beginPath(); ctx.arc(c.x, c.y, 100, 0, TAU); ctx.stroke();
      for (let j = 0; j < 2; j++) {
        const r = ((time * 1.2 + j * .5 + i * .25) % 1) * 40;
        ctx.strokeStyle = `rgba(150,120,240,${.5 * (1 - r / 40) * prog})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(c.x, fy, r, r * .4, 0, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = `rgba(20,10,34,${.22 * prog})`;
      ctx.beginPath(); ctx.ellipse(c.x, fy, 22, 8, 0, 0, TAU); ctx.fill();
      const facing = Math.cos(c.a + Math.PI) >= 0 ? 1 : -1;
      drawSilhouette(ctx, id, c.x, fy - bodyLift(z), facing, (.12 + .1 * Math.sin(time * 17 + i * 2)) * prog + (locked ? .1 : 0));
    }
    ctx.restore();
  }

  function drawLimboHit(ctx, z, fx, time) {
    const K = Kit(), k = fx.age / fx.dur, fy = fx.y + 3;
    ctx.save();
    drawSilhouette(ctx, spriteId(z), fx.x, fy - bodyLift(z), fx.facing, (1 - k) * .75);
    ctx.fillStyle = `rgba(24,10,40,${.55 * (1 - k)})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fy, 100 * easeOut(k * 2), 46 * easeOut(k * 2), 0, 0, TAU); ctx.fill();
    K.fx.shockRing(ctx, fx.x, fy, 110, k * 1.4, 1 - k, '170,130,255');
    ctx.strokeStyle = `rgba(10,4,18,${1 - k})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const cy = fy - 34, r = 14 + 26 * easeOut(k * 3);
    ctx.beginPath(); ctx.moveTo(fx.x - r, cy - r * .6); ctx.lineTo(fx.x + r, cy + r * .6); ctx.moveTo(fx.x + r, cy - r * .6); ctx.lineTo(fx.x - r, cy + r * .6); ctx.stroke();
    ctx.strokeStyle = `rgba(210,190,255,${1 - k})`; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }

  function drawBlink(ctx, z, fx) {
    const S = Spr(), k = 1 - fx.age / fx.dur;
    if (!S) return;
    ctx.save();
    ctx.globalAlpha = k * .45;
    S.draw(ctx, spriteId(z), fx.x, fx.y + 3 - bodyLift(z), { facing: fx.facing, frame: 'run', phase: 1, alpha: k * .45 });
    ctx.restore();
    const K = Kit();
    K.stamp(ctx, K.puff('dust'), fx.x, fx.y, 26 * (1 + fx.age * 2), k * .6, .5);
  }

  function drawFlakes(ctx, st) {
    ctx.save();
    for (const f of st.flakes) {
      const k = 1 - f.age / f.dur, rot = f.r + f.age * 7;
      ctx.globalAlpha = k;
      ctx.fillStyle = f.s > 3.5 ? '#d9cdb4' : '#8c8478';
      ctx.strokeStyle = '#3a342c'; ctx.lineWidth = .8;
      const c = Math.cos(rot) * f.s, s = Math.sin(rot) * f.s;
      ctx.beginPath(); ctx.moveTo(f.x + c, f.y + s * .5); ctx.lineTo(f.x - s, f.y + c * .5); ctx.lineTo(f.x - c, f.y - s * .5); ctx.lineTo(f.x + s, f.y - c * .5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ draw passes
  // When the boss is dead the game stops calling update; keep effects aging visually so nothing freezes mid-air.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.ev.length = 0; st.clones = null;
    st.sus = Math.max(0, st.sus - dt * 1.4); st.perf = Math.max(0, st.perf - dt * 1.1); st.susHold = st.perfHold = 0;
    st.shield = st.dome = 0; st.used = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.md;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    for (const fx of st.fx) {
      if (fx.kind === 'meteor') meteorGround(ctx, fx, time);
      else if (fx.kind === 'goka') gokaGround(ctx, fx, time);
      else if (fx.kind === 'jukai') jukaiGround(ctx, fx, time);
      else if (fx.kind === 'blink') drawBlink(ctx, z, fx);
    }
    if (z.health > 0) drawTelegraph(ctx, z, st, time);
    drawLimboGround(ctx, z, st, time);
    if (m.rikudo) {
      if (st.perf > .01) drawPerfectBack(ctx, z, st.perf, time);
      if (z.health > 0) {
        const hide = st.used, p = { x: 0, y: 0 };
        for (let i = 0; i < 9; i++) { if (i < hide) continue; ballPos(z, i, time, p); drawBall(ctx, p.x, p.y, 8); }
      }
    } else if (st.sus > .01) drawSusanooBack(ctx, z, st.sus, time);
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.md;
    if (!m || !st || !Kit()) return;
    for (const fx of st.fx) {
      if (fx.kind === 'goka') gokaOverlay(ctx, fx, time);
      else if (fx.kind === 'jukai') jukaiOverlay(ctx, fx, time);
      else if (fx.kind === 'gaeshi') drawGaeshi(ctx, fx, time);
      else if (fx.kind === 'limboHit') drawLimboHit(ctx, z, fx, time);
      else if (fx.kind === 'sweep') drawSweep(ctx, z, fx, time);
    }
    if (m.rikudo) {
      if (st.perf > .01) drawPerfectFront(ctx, z, st, st.perf, time);
      // balls drifting forward and stretching into rods
      if (st.move === 'rods' || (st.used === 5 && st.ev.some(e => e.op === 'rods'))) {
        const k = st.move === 'rods' ? easeOut((st.windMax - st.windup) / st.windMax) : 1, p = { x: 0, y: 0 };
        for (let i = 0; i < 5; i++) {
          ballPos(z, i, time, p);
          const fp = rodFront(z, st, i), x = lerp(p.x, fp.sx, k), y = lerp(p.y, fp.sy, k);
          const ang = Math.atan2((st.ty - fp.gy) * .9, st.tx - fp.gx), m2 = win(k, .45, 1);
          if (m2 <= 0) drawBall(ctx, x, y, 8);
          else drawRod(ctx, x, y, ang, lerp(16, 46, m2), lerp(14, 6, m2));
        }
      }
      // staff forming in his hand
      if (st.move === 'staff' && st.windup > 0) {
        const k = easeOut((st.windMax - st.windup) / st.windMax), f = Math.cos(st.aim) >= 0 ? 1 : -1;
        const hx = z.x + f * 20, hy = z.y + 3 - bodyLift(z) - 46;
        if (k < .35) drawBall(ctx, hx, hy - 10, 8);
        else drawStaff(ctx, hx, hy + 30, -Math.PI / 2 - f * .2, 60 * win(k, .35, 1) + 20, 1, time);
      }
      if (st.shield > 0) drawShield(ctx, z, st, time);
      const L = LIFT();
      for (const s of st.shots) {
        const b = s.b;
        drawRod(ctx, b.x, b.y - L, Math.atan2(b.vy, b.vx), 50, 6);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(170,150,255,.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(b.x, b.y - L); ctx.lineTo(b.x - b.vx * .05, b.y - L - b.vy * .05); ctx.stroke();
        ctx.restore();
      }
    } else {
      if (st.sus > .01) drawSusanooFront(ctx, z, st, st.sus, time);
      const showFan = (st.move === 'gaeshi' && st.windup > 0) || st.gaeshiShow > 0;
      if (showFan && z.health > 0) {
        const f = Math.cos(st.aim) >= 0 ? 1 : -1, k = st.move === 'gaeshi' ? easeOut((st.windMax - st.windup) / .3) : 1;
        drawGunbai(ctx, z.x + Math.cos(st.aim) * 26, z.y - 58 + Math.sin(st.aim) * 12, 44 * (.6 + .4 * k), f * .25, 1);
      }
      if (st.dome > 0) drawDome(ctx, z, st, time);
      if (st.flakes.length) drawFlakes(ctx, st);
    }
    for (const fx of st.fx) if (fx.kind === 'meteor') meteorSky(ctx, fx, time);
    if (z.health > 0) label(ctx, z, st, time);
  }

  // ------------------------------------------------------------------ rebirth cinematic
  // k 0 → 1 over ~4 s at Edo Madara's corpse: the Ten-Tails is drawn into him — a black-and-white chakra
  // vortex on the ground, a pillar of chakra into the sky, Six Paths Madara forming inside, then a flash.
  function drawTransform(ctx, x, y, k, time) {
    const K = Kit(), S = Spr();
    if (!K) return;
    k = clamp01(k);
    const gather = smooth(k / .2), pillar = smooth(win(k, .12, .35)) * (1 - smooth(win(k, .78, .93)));
    const fadeAll = 1 - smooth(win(k, .95, 1));
    ctx.save();
    // dark pool + vortex
    ctx.globalAlpha = fadeAll;
    ctx.fillStyle = `rgba(10,6,16,${.55 * gather})`;
    ctx.beginPath(); ctx.ellipse(x, y, 60 + 200 * gather, (60 + 200 * gather) * .45, 0, 0, TAU); ctx.fill();
    const vortex = K.swirl('md:vortex', ['#0c0c10', '#f2f2f6', '#2a2830', '#d6d6de'], 9, 1.4, .08, 256, 6);
    K.spin(ctx, vortex, x, y, 230 * gather, time * 3.2, .9 * gather, .45);
    K.spin(ctx, vortex, x, y, 140 * gather, -time * 4.5, .7 * gather, .45);
    // chakra streams spiralling inward and up
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a0 = i * TAU / 14 + time * 1.6, u = (time * .7 + hash(i)) % 1, R = 320 * (1 - u) * gather;
      const ax = x + Math.cos(a0) * R, ay = y + Math.sin(a0) * R * .45;
      const bx = x + Math.cos(a0 + 1.2) * R * .45, by = y - 40 - 120 * u + Math.sin(a0 + 1.2) * R * .2;
      ctx.strokeStyle = i % 2 ? `rgba(245,245,250,${.85 * (1 - u)})` : `rgba(8,8,12,${.85 * (1 - u)})`;
      ctx.lineWidth = 3 + 4 * (1 - u);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(x + Math.cos(a0 + .6) * R * .8, y + Math.sin(a0 + .6) * R * .4 - 30, bx, by); ctx.stroke();
    }
    // pillar of chakra
    if (pillar > .01) {
      const w = 20 + 48 * pillar, H = 1000;
      // flared base sitting in the vortex, then a column with wavering edges
      const side = (sgn, rate, ph) => {
        for (let i = 0; i <= 14; i++) {
          const t = i / 14, flare = 1 + 1.1 * Math.pow(1 - Math.min(1, t * 8), 2), wob = Math.sin(time * rate + t * 11 + ph) * 6;
          ctx.lineTo(x + sgn * w * flare * (1 + t * .35) + wob, y - 4 - t * H);
        }
      };
      ctx.beginPath(); ctx.ellipse(x, y - 4, w * 2.1, w * .7, 0, Math.PI, 0, true);
      side(1, 8, 2);
      ctx.lineTo(x - w * 1.35, y - 4 - H);
      for (let i = 14; i >= 0; i--) {
        const t = i / 14, flare = 1 + 1.1 * Math.pow(1 - Math.min(1, t * 8), 2), wob = Math.sin(time * 9 + t * 11) * 6;
        ctx.lineTo(x - w * flare * (1 + t * .35) + wob, y - 4 - t * H);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(12,8,20,${.8 * pillar})`; ctx.fill();
      // pale chakra core and streaks rushing upward
      ctx.fillStyle = `rgba(220,214,240,${.28 * pillar})`;
      ctx.fillRect(x - w * .28, y - H, w * .56, H - 8);
      ctx.strokeStyle = `rgba(240,240,255,${.7 * pillar})`; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const ox = (hash(i * 3) - .5) * w * 1.5, v = (time * 900 + hash(i) * 1000) % H;
        ctx.beginPath(); ctx.moveTo(x + ox, y - v); ctx.lineTo(x + ox * 1.05, y - v - 60); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y - 90, w * 2.4, '170,140,255', .5 * pillar);
      for (let i = 0; i < 3; i++) {
        const yy = y - 60 - ((time * 2 + i * .33) % 1) * 360;
        K.forkedBolt(ctx, x - w * 1.1, yy, x + w * 1.1, yy - 40 + hash(i) * 80, i * 13.7, time, { jitter: 18, width: 1.6, alpha: .8 * pillar, pal: ['150,110,255', '200,180,255', '255,255,255'], forks: 2, forkLen: 30, rate: 20 });
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // Six Paths Madara takes shape in the light
    const born = smooth(win(k, .55, .92));
    if (S && born > .01) {
      const id = S.has('madara_rikudo') ? 'madara_rikudo' : 'kaguya';
      S.draw(ctx, id, x, y + 3 - 26 * born, { facing: 1, frame: 'raise', alpha: born * fadeAll, flash: (1 - born) * 2 + .3 });
    }
    // white flash
    // peaks at k ≈ .93 and is still at ~30 % when the game swaps in the new boss at k = 1
    const flash = k < .93 ? smooth(win(k, .84, .93)) : 1 - .7 * smooth(win(k, .93, 1));
    if (flash > .01) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y - 60, 500 * flash + 80, '255,255,255', flash, true);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,255,255,${.75 * flash})`;
      ctx.fillRect(x - 2400, y - 1600, 4800, 3200);
    }
    ctx.restore();
  }

  window.MadaraBosses = { order, members, moveLabels, moves: MOVES, pick, update, draw, drawOverlay, bodyLift, drawTransform, spriteId };
})();
