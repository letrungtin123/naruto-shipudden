/* Killer Bee — the Eight-Tails' jinchūriki (spawn panel, faction 'bee', id 'killer_bee').
 * Same contract as legend-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
 * telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above the characters. Every bit of
 * per-boss state lives on z.kb. The body is the AnimeSprites 'killer_bee' character; during the ultimate he
 * becomes the giant ox-octopus Gyūki, which this file draws itself (hidden(z) hides the sprite).
 *
 * Moves (one cycle ≈ 30 s): Lariat in the Eight-Tails' cloak, octopus ink cannon, seven-sword dance,
 * tentacle slams, tentacle sweep, Tailed Beast Ball, Double Lariat with the Raikage, and the full
 * Gyūki transformation (tentacle barrage, Tailed Beast Ball rain, giant Tailed Beast Ball). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const ID = 'killer_bee';
  const GY = .92;           // Gyūki drawing scale (≈ 370 px tall)
  const MOUTH_Y = 70;       // Bee's mouth above his feet (px)
  const LIFT_CHEST = 30;    // beams level out at chest height

  const members = {
    [ID]: { name: 'KILLER BEE — NHÂN TRỤ LỰC BÁT VĨ', accent: '#ffcf3a', hpScale: 3.8, damageScale: 2.0, armor: .85 }
  };
  const order = [ID];
  const pick = () => ID;

  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    lariat:    { label: 'BÁT VĨ · LARIAT', rap: '♪ YEAH! LAO TỚI, KHÔNG ĐƯỜNG LÙI! ♪', rgb: '255,80,120', windup: .85, after: 1.3 },
    ink:       { label: 'MẶC ĐỘN · MẶC VỤ PHÁO', rap: '♪ MỰC ĐEN PHUN RA, BAKA YARO! ♪', rgb: '170,120,240', windup: .9, after: 1.4 },
    swords:    { label: 'THẤT ĐAO LƯU · LOẠN VŨ', rap: '♪ BẢY THANH KIẾM, MỘT NHỊP RAP! ♪', rgb: '235,245,255', windup: .85, after: 1.5 },
    tentacles: { label: 'BÁT VĨ · XÚC TU OANH KÍCH', rap: '♪ TÁM XÚC TU, CHƯA ĐỦ ĐÂU! ♪', rgb: '255,120,150', windup: 1.0, after: 1.5 },
    tbb:       { label: 'BÁT VĨ · VĨ THÚ NGỌC', rap: '♪ VĨ THÚ NGỌC, NỔ TUNG NÓC! ♪', rgb: '190,120,255', windup: 1.3, after: 1.7 },
    double:    { label: 'LÔI ĐỘN · SONG LARIAT', rap: '♪ BRO! SONG LARIAT, YEAH! ♪', rgb: '150,220,255', windup: 1.15, after: 1.7 },
    sweep:     { label: 'BÁT VĨ · XÚC TU HOÀNH TẢO', rap: '♪ QUÉT MỘT VÒNG, KONO YARO! ♪', rgb: '255,150,110', windup: 1.0, after: 1.4 },
    gyuki:     { label: 'VĨ THÚ HÓA · BÁT VĨ GYŪKI', rap: '♪ BAKA YARO, KONO YARO! ♪', rgb: '255,70,110', windup: 1.4, after: 2.0 }
  };
  const CYCLE = ['lariat', 'ink', 'swords', 'tentacles', 'tbb', 'double', 'sweep', 'gyuki'];
  const CLOAKED = new Set(['lariat', 'tentacles', 'tbb', 'double', 'sweep', 'gyuki']);

  function state(z) {
    return z.kb || (z.kb = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y, tele: [], ev: [], fx: [],
      dash: null, ally: null, allyAt: null, gy: null, cloak: 0, cloakT: 0, hold: 0, spots: null, dashLen: 400, sweepDir: 1, seed: 0, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => { if (st.ev.length < 200) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = () => (Spr() && Spr().height ? Spr().height(ID) : 88);

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

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    const d = Math.hypot(tx - x, ty - y);
    switch (move) {
      case 'lariat': {
        const len = Math.max(380, Math.min(760, d + 170));
        st.dashLen = len;
        return [line(len, 62), circ(x + ca * len, y + sa * len, 210)];
      }
      case 'ink': return [{ k: 'cone', x, y, a, r: 840, h: .42 }];
      case 'swords': return [{ k: 'cone', x, y, a, r: 540, h: .85 }, circ(x, y, 310, true), line(980, 46)];
      case 'tentacles': {
        const spots = [{ x: tx, y: ty, r: 150, delay: 0 }], b = Math.random() * TAU;
        for (let i = 0; i < 6; i++) spots.push({ x: tx + Math.cos(b + i * TAU / 6) * 260, y: ty + Math.sin(b + i * TAU / 6) * 260, r: 125, delay: .12 + i * .1 });
        st.spots = spots;
        return spots.map(s => circ(s.x, s.y, s.r));
      }
      case 'sweep': {
        const dir = Math.random() < .5 ? 1 : -1;
        st.sweepDir = dir;
        return [{ k: 'ring', x, y, a0: a - dir * 2.0, a1: a + dir * 2.0, r0: 70, r1: 660 }];
      }
      case 'tbb': return [line(1150, 80), circ(x + ca * 1150, y + sa * 1150, 340)];
      case 'double': {
        const ax = tx + ca * 430, ay = ty + sa * 430;
        st.allyAt = { x: ax, y: ay };
        return [line(d + 40, 60), line(470, 60, a + Math.PI, ax, ay), circ(tx, ty, 260)];
      }
      case 'gyuki': return [circ(x, y, 330), circ(x, y, 900, true)];
    }
    return [];
  }

  function announce(z, st, api) {
    const move = CYCLE[st.casts % CYCLE.length];
    st.casts++;
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
    st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.seed = Math.random() * 99;
    st.tele = teleFor(z, st, move);
    if (CLOAKED.has(move)) st.cloakT = def.windup + 1.4;
    if (move === 'double') st.ally = { x: st.allyAt.x, y: st.allyAt.y, a: st.aim + Math.PI, t: 0, phase: 'charge' };
  }

  // Bee bulldozes in a straight line: houses on the way are smashed, walls stop him.
  function startDash(z, st, a, len, dur, dmg, w, end) {
    st.dash = { a, speed: len / dur, left: dur, hit: 0, wt: 0, w, dmg, end };
    addFx(st, { kind: 'dash', pts: [], a, dur: dur + .45, seed: Math.random() * 99, x0: z.x, y0: z.y, x1: z.x, y1: z.y });
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, api) {
    const move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), seed = st.seed;
    const fac = facingOf(z);
    api.burst(z.x, z.y - 30, '#ff7a9a', 8);
    switch (move) {
      case 'lariat': {
        startDash(z, st, a, st.dashLen, .34, D * 2.6, 64, api => {
          const ex = z.x, ey = z.y;
          api.strike(ex, ey, 210, D * 2.4, null, 'crater', true);
          api.knockback(z, 230, 240, 0);
          api.world(ex + ca * 70, ey + sa * 70, 170, D * 3, 'shockwave', a);
          api.shake(16); api.burst(ex, ey - 24, '#ff6a8a', 16);
          addFx(st, { kind: 'impact', x: ex, y: ey, r: 230, dur: 1.5, seed, rgb: '255,70,110', a });
        });
        break;
      }
      case 'ink': {
        const s = st.tele[0], ox = z.x + ca * 18, oy = z.y + sa * 8;
        conePts(ox, oy, s.a, s.r, s.h).forEach(p => later(st, .04 + p.d / 1700, api => api.strike(p.x, p.y, p.r, D * 1.7, null, null, true)));
        const pools = [];
        for (let i = 0; i < 8; i++) {
          const d = 190 + i * 85 + rand(-25, 25), aa = a + rand(-.8, .8) * s.h;
          pools.push({ x: ox + Math.cos(aa) * d, y: oy + Math.sin(aa) * d, r: 62 + i * 7 + rand(0, 30), v: i % 3, rot: rand(0, TAU), t0: .06 + d / 1700 });
        }
        addFx(st, { kind: 'inkJet', x: ox, y: oy, a, r: s.r, h: s.h, dur: 1.3, seed });
        const pool = addFx(st, { kind: 'inkPool', pools, dur: 5.2, tick: .9, seed });
        pool.upd = (fx, dt, api) => {
          if (fx.age > .7 && fx.age < 4.4 && (fx.tick -= dt) <= 0) { fx.tick = .5; for (const p of fx.pools) api.strike(p.x, p.y, p.r * .85, D * .35, null, null, true); }
        };
        later(st, .3, api => { api.world(ox + ca * 420, oy + sa * 420, 170, D * 2.2, 'vortex', a); api.world(ox + ca * 720, oy + sa * 720, 160, D * 2.2, 'vortex', a); });
        st.hold = .6;
        api.shake(9);
        break;
      }
      case 'swords': {
        const s = st.tele[0];
        for (let k = 0; k < 3; k++) later(st, k * .17, api => {
          conePts(z.x, z.y, s.a, s.r, s.h).forEach(p => api.strike(p.x, p.y, p.r, D * 1.25, null, null, true));
          addFx(st, { kind: 'slash', x: z.x, y: z.y, a: s.a + (k - 1) * .22, r: s.r, h: s.h, side: k % 2 ? 1 : -1, dur: .6, seed: seed + k * 5 });
          api.shake(6);
        });
        later(st, .5, api => {
          const x0 = z.x, y0 = z.y;
          addFx(st, { kind: 'wave', x: x0, y: y0, a, len: 980, speed: 2100, dur: 980 / 2100 + .7, seed });
          for (let d = 0; d < 980; d += 245) later(st, d / 2100, api => api.line(x0 + ca * d, y0 + sa * d, x0 + ca * (d + 245), y0 + sa * (d + 245), 46, D * 1.6, 'blade'));
        });
        later(st, .66, api => {
          api.strike(z.x, z.y, 310, D * 1.9, null, 'blade', true);
          api.knockback(z, 310, 170, 0);
          addFx(st, { kind: 'spin', x: z.x, y: z.y, r: 310, dur: 1.0, seed });
          api.shake(11);
        });
        st.hold = .9;
        break;
      }
      case 'tentacles': {
        const list = st.spots.map((s, i) => ({ x: s.x, y: s.y, r: s.r, delay: s.delay, side: i % 2 ? 1 : -1, seed: seed + i * 3.3 }));
        addFx(st, { kind: 'tents', list, fac, dur: 2.1, seed });
        list.forEach((s, i) => later(st, s.delay + .28, api => {
          api.strike(s.x, s.y, s.r, D * 2.2, null, i < 3 ? 'crater' : null, true);
          api.shake(i ? 7 : 12); api.burst(s.x, s.y - 10, '#c8a0b0', 6);
        }));
        st.hold = 1.0;
        break;
      }
      case 'sweep': {
        const s = st.tele[0], sw = .62;
        const fx = addFx(st, { kind: 'sweep', x: z.x, y: z.y, a0: s.a0, a1: s.a1, r0: s.r0, r1: s.r1, sw, dur: sw + 1.0, tick: 0, wt: .08, seed });
        fx.upd = (fx, dt, api) => {
          if (fx.age > fx.sw + .04) return;
          const ang = fx.a0 + (fx.a1 - fx.a0) * easeInOut(fx.age / fx.sw), c = Math.cos(ang), s2 = Math.sin(ang);
          if ((fx.tick -= dt) <= 0) { fx.tick = .05; api.line(fx.x + c * fx.r0, fx.y + s2 * fx.r0, fx.x + c * fx.r1, fx.y + s2 * fx.r1, 58, D * 1.7); }
          if ((fx.wt -= dt) <= 0) { fx.wt = .2; api.world(fx.x + c * fx.r1 * .62, fx.y + s2 * fx.r1 * .62, 150, D * 2.4, 'shockwave', ang); }
        };
        st.hold = .9;
        api.shake(10);
        break;
      }
      case 'tbb': {
        const len = 1150, x0 = z.x + ca * 24, y0 = z.y + sa * 12, sp = 2500;
        addFx(st, { kind: 'tbbShot', x: x0, y: y0, a, len, speed: sp, dur: len / sp + .7, seed });
        for (let d = 0; d < len; d += 230) later(st, d / sp, api => api.line(x0 + ca * d, y0 + sa * d, x0 + ca * Math.min(len, d + 230), y0 + sa * Math.min(len, d + 230), 80, D * 2.4, d % 460 === 0 ? 'crater' : null));
        later(st, len / sp, api => {
          const ex = x0 + ca * len, ey = y0 + sa * len;
          api.strike(ex, ey, 340, D * 3.4, null, 'crater', true);
          api.world(ex, ey, 300, D * 3.5, 'crater');
          api.shake(20);
          addFx(st, { kind: 'blast', x: ex, y: ey, r: 340, dur: 1.7, seed });
        });
        api.shake(12);
        st.hold = .5;
        break;
      }
      case 'double': {
        const mx = st.tx, my = st.ty, al = st.ally, d = Math.hypot(mx - z.x, my - z.y), dur = .3;
        startDash(z, st, a, Math.max(10, d - 30), dur, D * 2.0, 58, api => {
          api.strike(mx, my, 260, D * 3.6, null, 'lightning', true);
          api.knockback({ x: mx, y: my }, 280, 260, 0);
          api.world(mx, my, 230, D * 3.2, 'crater');
          api.shake(24); api.burst(mx, my - 30, '#bfe8ff', 20);
          addFx(st, { kind: 'clash', x: mx, y: my, r: 270, dur: 1.6, seed });
          if (st.ally) { st.ally.phase = 'stay'; st.ally.t = 0; }
        });
        if (al) {
          Object.assign(al, { phase: 'dash', t: 0, x0: al.x, y0: al.y, x1: mx + ca * 30, y1: my + sa * 30, dur });
          later(st, dur * .6, api => api.line(al.x0, al.y0, mx, my, 58, D * 2.0, 'lightning'));
        }
        break;
      }
      case 'gyuki': {
        const gy = st.gy = { t: 0, x: z.x, y: z.y, dur: 8.4, act: 0, charge: 0, beam: null, slams: [], balls: [], seed };
        st.cloakT = 0; st.cloak = 0;
        addFx(st, { kind: 'transform', x: z.x, y: z.y, r: 340, dur: 2.0, seed });
        api.strike(z.x, z.y, 330, D * 2.6, null, 'crater', true);
        api.knockback(z, 340, 120, 0);
        api.shake(24);
        // Tentacle barrage: eight slams hunting the target, each marked on the ground .7 s ahead.
        for (let i = 0; i < 8; i++) {
          const tHit = 1.1 + i * .27;
          later(st, tHit - .7, api => {
            const p = api.player; if (!p || !st.gy) return;
            const off = i % 3 === 0 ? 0 : 90 + Math.random() * 130, oa = Math.random() * TAU;
            const s = { x: p.x + Math.cos(oa) * off, y: p.y + Math.sin(oa) * off, r: 155, t0: gy.t, hit: .7, i, seed: seed + i * 7 };
            gy.slams.push(s); if (gy.slams.length > 8) gy.slams.shift();
          });
          later(st, tHit, api => {
            const s = gy.slams.find(q => q.i === i); if (!s || !st.gy) return;
            api.strike(s.x, s.y, s.r, D * 2.6, null, i % 2 ? null : 'crater', true);
            api.shake(13); api.burst(s.x, s.y - 10, '#d0a8c0', 8);
          });
        }
        // Tailed Beast Ball rain: eight small balls lobbed around the target.
        for (let i = 0; i < 8; i++) {
          later(st, 3.5 + i * .17, api => {
            const p = api.player; if (!p || !st.gy) return;
            const off = i === 0 ? 0 : 140 + Math.random() * 300, oa = Math.random() * TAU;
            const b = { x1: p.x + Math.cos(oa) * off, y1: p.y + Math.sin(oa) * off, t0: gy.t, fl: .9, i, seed: seed + i * 5 };
            gy.balls.push(b); if (gy.balls.length > 8) gy.balls.shift();
            later(st, b.fl, api => {
              if (!st.gy && z.health <= 0) return;
              api.strike(b.x1, b.y1, 190, D * 2.6, null, i % 3 ? null : 'crater', true);
              api.shake(10);
              addFx(st, { kind: 'blast', x: b.x1, y: b.y1, r: 190, dur: 1.3, seed: b.seed });
            });
          });
        }
        // The giant Tailed Beast Ball, aimed at 5.7 s, fired at 7.0 s.
        later(st, 5.7, api => {
          const p = api.player; if (!st.gy) return;
          const ba = p ? Math.atan2(p.y - gy.y, p.x - gy.x) : 0;
          gy.beam = { a: ba, t0: gy.t, fire: 1.3, len: 1200 };
        });
        later(st, 7.0, api => {
          const bm = gy.beam; if (!bm || !st.gy) return;
          const c = Math.cos(bm.a), s = Math.sin(bm.a), x0 = gy.x + c * 60, y0 = gy.y + s * 30;
          for (let d = 0; d < bm.len; d += 240) later(st, d / 3000, api => api.line(x0 + c * d, y0 + s * d, x0 + c * Math.min(bm.len, d + 240), y0 + s * Math.min(bm.len, d + 240), 110, D * 3.2, d % 480 === 0 ? 'crater' : null));
          later(st, bm.len / 3000, api => {
            const ex = x0 + c * bm.len, ey = y0 + s * bm.len;
            api.strike(ex, ey, 430, D * 5, null, 'crater', true);
            api.world(ex, ey, 380, D * 4, 'crater');
            api.shake(30);
            addFx(st, { kind: 'blast', x: ex, y: ey, r: 430, dur: 2.0, seed: seed + 50 });
          });
          addFx(st, { kind: 'tbbShot', x: x0, y: y0, a: bm.a, len: bm.len, speed: 3000, dur: bm.len / 3000 + .8, seed, big: true });
          api.shake(18);
        });
        break;
      }
    }
  }

  // ------------------------------------------------------------------ update
  function update(z, dt, api) {
    if (!members[z.bossId]) return;
    const st = state(z), m = members[z.bossId];
    st.t += dt;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) {
      z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.ev.length = 0; st.windup = 0; st.move = '';
      if (st.gy) { addFx(st, { kind: 'transform', x: st.gy.x, y: st.gy.y, r: 300, dur: 1.6, seed: 3, revert: true }); st.gy = null; }
      st.ally = null;
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.cloakT = Math.max(0, st.cloakT - dt);
    const want = st.cloakT > 0 || st.dash ? 1 : 0;
    st.cloak += (want - st.cloak) * Math.min(1, dt * (want ? 7 : 3));
    z.armorScale = (m.armor || 1) * (st.gy ? .6 : 1);
    z.kageDash = 0;

    if (st.dash) {
      const ds = st.dash, D = api.damage || 60;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if ((ds.wt -= dt) <= 0) { ds.wt = .1; api.world(nx, ny, 90, D * 3, 'shockwave', ds.a); }
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .06; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      const tr = st.fx.find(f => f.kind === 'dash');
      if (tr) { tr.x1 = z.x; tr.y1 = z.y; tr.pts.push(z.x, z.y); if (tr.pts.length > 16) tr.pts.splice(0, 2); }
      if (ds.left <= 0) { const end = ds.end; st.dash = null; if (end) end(api); }
    }
    if (st.ally) {
      const al = st.ally;
      al.t += dt;
      if (al.phase === 'dash') {
        const k = clamp01(al.t / al.dur);
        al.x = al.x0 + (al.x1 - al.x0) * k; al.y = al.y0 + (al.y1 - al.y0) * k;
      } else if (al.phase === 'stay' && al.t > .7) { al.phase = 'leave'; al.t = 0; }
      else if (al.phase === 'leave' && al.t > .35) st.ally = null;
      else if (al.phase === 'charge' && st.move !== 'double' && !st.dash) st.ally = null;
    }
    if (st.gy) {
      const gy = st.gy;
      gy.t += dt;
      z.kageDash = Math.max(z.kageDash, .05);
      gy.act = Math.max(0, gy.act - dt);
      for (const s of gy.slams) if (gy.t - s.t0 > s.hit - .25 && gy.t - s.t0 < s.hit + .3) gy.act = .3;
      if (gy.beam) gy.act = .3;
      if (gy.t >= gy.dur) {
        addFx(st, { kind: 'transform', x: gy.x, y: gy.y, r: 300, dur: 1.6, seed: gy.seed + 9, revert: true });
        st.gy = null; st.timer = MOVES.gyuki.after;
      }
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.gy) {
      st.timer -= dt;
      const p = api.player;
      if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 950) announce(z, st, api);
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.ally = null; st.cloak = Math.max(0, st.cloak - dt * 3);
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ cached art
  const C = { line: '#1c1220', skin: '#7b6578', skinD: '#574460', chest: '#b9a0b0', horn: '#efe6d0', hornD: '#b9aa8a', sucker: '#e3c6ce' };

  function inkSplat(v) {
    return Kit().sprite('kb:ink' + v, 160, 160, g => {
      g.translate(80, 80);
      const blob = (x, y, r, n, s) => {
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = i / n * TAU, rr = r * (.78 + hash(s + i % n * 1.7) * .34);
          if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + rr, y);
        }
        g.closePath();
      };
      g.fillStyle = 'rgba(70,40,110,.55)'; blob(0, 0, 62, 22, v * 9); g.fill();
      g.fillStyle = '#0e0914'; blob(0, 0, 56, 22, v * 9);
      g.fill();
      for (let i = 0; i < 9; i++) {
        const a = hash(v * 5 + i * 2.3) * TAU, d = 52 + hash(v + i * 3.1) * 22, r = 4 + hash(v * 2 + i) * 8;
        g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU); g.fill();
        g.lineWidth = r * .9; g.strokeStyle = '#0e0914';
        g.beginPath(); g.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); g.lineTo(Math.cos(a) * d, Math.sin(a) * d); g.stroke();
      }
      // Wet gloss: a cool sheen and sharp white highlights.
      g.fillStyle = 'rgba(120,110,170,.35)'; blob(-12, -14, 30, 14, v * 3 + 1); g.fill();
      g.fillStyle = 'rgba(255,255,255,.75)';
      g.beginPath(); g.ellipse(-20, -22, 12, 4, -.5, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(14, -30, 5, 2, -.3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(-30, 6, 4, 2, -.9, 0, TAU); g.fill();
    });
  }
  function inkBall() {
    return Kit().sphere('kb:inkball', [[0, '#9a8ab8'], [.12, '#3a2c50'], [.4, '#120c1c'], [.85, '#07040b'], [1, 'rgba(7,4,11,0)']], .34, .3);
  }
  function tbbSphere() {
    return Kit().sphere('kb:tbb', [[0, '#d8c8ff'], [.1, '#5a3a8a'], [.42, '#140a24'], [.86, '#060309'], [.96, '#3a1460'], [1, 'rgba(90,30,150,0)']], .36, .32);
  }
  function tbbSwirl() { return Kit().swirl('kb:tbbswirl', ['rgba(255,255,255,.9)', 'rgba(200,150,255,.85)', 'rgba(120,60,220,.85)'], 7, 1.1, .12, 128, 3); }
  function swordImg() {
    return Kit().sprite('kb:sword', 120, 20, g => {
      g.lineCap = 'round';
      g.strokeStyle = '#120c10'; g.lineWidth = 7; g.beginPath(); g.moveTo(4, 10); g.lineTo(30, 10); g.stroke();
      g.strokeStyle = '#e8e2d2'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(5, 10); g.lineTo(29, 10); g.stroke();
      g.strokeStyle = '#2a2430'; g.lineWidth = 1;
      for (let x = 8; x < 28; x += 4) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 3, 12); g.moveTo(x + 3, 8); g.lineTo(x, 12); g.stroke(); }
      g.fillStyle = '#b89a52'; g.strokeStyle = '#120c10'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(32, 10, 3, 7, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(35, 7); g.lineTo(108, 8.2); g.quadraticCurveTo(116, 9.5, 117, 11); g.lineTo(35, 13); g.closePath();
      g.fillStyle = '#1a1820'; g.fill();
      g.beginPath(); g.moveTo(35, 8); g.lineTo(107, 9); g.quadraticCurveTo(113, 10, 114, 11); g.lineTo(35, 12); g.closePath();
      g.fillStyle = '#cfd6e2'; g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(36, 8.3, 70, 1.4);
    });
  }

  // ---- tentacles: a tapered ribbon along a spine (Float32Array [x0,y0,x1,y1,…]) with suckers underneath.
  const SP = new Float32Array(64), LE = new Float32Array(64), RI = new Float32Array(64);
  function ribbon(ctx, P, n, w0, w1, fill, shade, line, sucker, lw = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = P[b * 2] - P[a * 2], ty = P[b * 2 + 1] - P[a * 2 + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const t = i / (n - 1), w = (w0 + (w1 - w0) * Math.pow(t, .8)) * .5;
      LE[i * 2] = P[i * 2] - ty * w; LE[i * 2 + 1] = P[i * 2 + 1] + tx * w;
      RI[i * 2] = P[i * 2] + ty * w; RI[i * 2 + 1] = P[i * 2 + 1] - tx * w;
    }
    const path = () => {
      ctx.beginPath(); ctx.moveTo(LE[0], LE[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(LE[i * 2], LE[i * 2 + 1]);
      const ex = P[(n - 1) * 2], ey = P[(n - 1) * 2 + 1];
      ctx.quadraticCurveTo(ex + (ex - P[(n - 2) * 2]) * .6, ey + (ey - P[(n - 2) * 2 + 1]) * .6, RI[(n - 1) * 2], RI[(n - 1) * 2 + 1]);
      for (let i = n - 2; i >= 0; i--) ctx.lineTo(RI[i * 2], RI[i * 2 + 1]);
      ctx.closePath();
    };
    path();
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
    if (shade) {
      // Shadow half: between the spine and the lower edge.
      ctx.beginPath(); ctx.moveTo(P[0], P[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(P[i * 2], P[i * 2 + 1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(RI[i * 2], RI[i * 2 + 1]);
      ctx.closePath(); ctx.fillStyle = shade; ctx.fill();
    }
    if (sucker) {
      ctx.fillStyle = sucker;
      ctx.beginPath();
      for (let i = 1; i < n - 1; i++) {
        const x = P[i * 2] * .35 + RI[i * 2] * .65, y = P[i * 2 + 1] * .35 + RI[i * 2 + 1] * .65;
        const r = Math.max(1, (w0 + (w1 - w0) * i / (n - 1)) * .13);
        ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * .8, 0, 0, TAU);
      }
      ctx.fill();
    }
  }
  // Spine from (x, y) heading `ang`, bending by `curl` toward the tip and swaying.
  function spine(x, y, ang, len, curl, sway, ph, n) {
    const step = len / (n - 1);
    SP[0] = x; SP[1] = y;
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1), h = ang + curl * t * t + Math.sin(ph + t * 3.2) * sway * t;
      x += Math.cos(h) * step; y += Math.sin(h) * step;
      SP[i * 2] = x; SP[i * 2 + 1] = y;
    }
    return SP;
  }
  // Quadratic-bezier spine root → control → tip.
  function bezSpine(x0, y0, cx, cy, x1, y1, n, wob, ph) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), u = 1 - t;
      const w = Math.sin(t * Math.PI) * Math.sin(ph + t * 6) * wob;
      SP[i * 2] = u * u * x0 + 2 * u * t * cx + t * t * x1 + w;
      SP[i * 2 + 1] = u * u * y0 + 2 * u * t * cy + t * t * y1;
    }
    return SP;
  }

  // ---- Gyūki: ox head with ringed horns, a muscled purple-grey torso, two arms, eight octopus legs.
  function blob(g, pts) {
    const n = pts.length, m = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    g.beginPath();
    let p = m(n - 1); g.moveTo(p[0], p[1]);
    for (let i = 0; i < n; i++) { p = m(i); g.quadraticCurveTo(pts[i][0], pts[i][1], p[0], p[1]); }
    g.closePath();
  }
  function cel(g, path, fill, shadeFn, lw = 4) {
    path(); g.fillStyle = fill; g.fill();
    if (shadeFn) { g.save(); path(); g.clip(); shadeFn(); g.restore(); }
    path(); g.strokeStyle = C.line; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
  }
  function limbG(g, a, b, c, w1, w2, col) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = C.line; g.lineWidth = w1 + 7; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.lineWidth = w2 + 7; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
    g.strokeStyle = col; g.lineWidth = w1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.lineWidth = w2; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
    g.strokeStyle = 'rgba(40,20,60,.35)'; g.lineWidth = w1 * .35;
    g.beginPath(); g.moveTo(a[0] - 6, a[1] + 4); g.lineTo(b[0] - 6, b[1] + 4); g.lineTo(c[0] - 5, c[1] + 2); g.stroke();
    g.strokeStyle = 'rgba(255,240,255,.28)'; g.lineWidth = w1 * .16;
    g.beginPath(); g.moveTo(a[0] + 5, a[1] - 5); g.lineTo(b[0] + 5, b[1] - 6); g.stroke();
  }
  function horn(g, p0, p1, p2, w) {
    const N = 14, L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]), l = Math.hypot(dx, dy) || 1;
      const ww = w * (1 - t * .9) * .5;
      L.push([x - dy / l * ww, y + dx / l * ww]); R.push([x + dy / l * ww, y - dx / l * ww, x, y, dx / l, dy / l, ww]);
    }
    const path = () => { g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); };
    cel(g, path, C.horn, () => {
      g.fillStyle = 'rgba(120,96,70,.45)'; g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][2], R[i][3]); g.closePath(); g.fill();
      g.strokeStyle = C.hornD; g.lineWidth = 2.6;
      for (let i = 2; i < N - 1; i += 2) { const r = R[i]; g.beginPath(); g.moveTo(r[2] - r[5] * r[6] * 1.2, r[3] + r[4] * r[6] * 1.2); g.lineTo(r[2] + r[5] * r[6] * 1.2, r[3] - r[4] * r[6] * 1.2); g.stroke(); }
    }, 3.4);
  }
  function gyukiBody() {
    return Kit().sprite('kb:gybody', 600, 600, g => {
      g.scale(2, 2); g.translate(130, 300);   // local origin = beast's feet; covers x -130..170, y -300..0
      g.lineJoin = 'round'; g.lineCap = 'round';
      // far arm behind the torso
      limbG(g, [-46, -235], [-94, -188], [-90, -134], 34, 28, C.skinD);
      cel(g, () => blob(g, [[-112, -150], [-80, -152], [-70, -126], [-92, -110], [-114, -124]]), C.skinD, null, 3.4);
      // torso
      const torso = () => blob(g, [[-46, -92], [-74, -150], [-82, -215], [-62, -262], [-10, -282], [46, -275], [80, -240], [82, -186], [62, -132], [40, -92]]);
      cel(g, torso, C.skin, () => {
        g.fillStyle = C.skinD; g.beginPath(); g.ellipse(-78, -175, 52, 120, .08, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,240,255,.2)'; g.beginPath(); g.ellipse(36, -246, 34, 16, -.3, 0, TAU); g.fill();
        // chest plates and abs in the light belly colour
        g.fillStyle = C.chest;
        blob(g, [[2, -252], [44, -260], [76, -238], [70, -212], [30, -206], [4, -222]]); g.fill();
        blob(g, [[8, -198], [60, -202], [62, -150], [44, -104], [10, -118]]); g.fill();
        g.strokeStyle = 'rgba(90,60,90,.8)'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(34, -196); g.lineTo(32, -108); g.stroke();
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(10, -180 + i * 22); g.quadraticCurveTo(34, -174 + i * 22, 60, -180 + i * 22); g.stroke(); }
        g.beginPath(); g.moveTo(4, -222); g.quadraticCurveTo(36, -204, 72, -214); g.stroke();
        g.fillStyle = 'rgba(70,40,80,.35)'; g.beginPath(); g.ellipse(-40, -200, 20, 70, .15, 0, TAU); g.fill();
      });
      // hump behind the head
      cel(g, () => blob(g, [[-36, -262], [-30, -296], [8, -300], [30, -280], [0, -262]]), C.skinD, null, 3.4);
    });
  }
  function gyukiArm(act) {
    return Kit().sprite('kb:gyarm' + (act ? 1 : 0), 440, 440, g => {
      g.scale(2, 2); g.translate(20, 300);  // covers x -20..200, y -300..-80
      const sh = [48, -238], el = act ? [104, -238] : [98, -186], fi = act ? [142, -270] : [96, -132];
      limbG(g, sh, el, fi, 38, 32, C.skin);
      cel(g, () => blob(g, [[fi[0] - 22, fi[1] - 16], [fi[0] + 16, fi[1] - 20], [fi[0] + 26, fi[1] + 6], [fi[0] + 6, fi[1] + 22], [fi[0] - 20, fi[1] + 14]]), C.skin, () => {
        g.fillStyle = 'rgba(60,30,70,.35)'; g.fillRect(fi[0] - 30, fi[1] + 4, 60, 30);
        g.strokeStyle = C.line; g.lineWidth = 2;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(fi[0] + 2 + k * 7, fi[1] - 16); g.lineTo(fi[0] + 4 + k * 7, fi[1] + 12); g.stroke(); }
      }, 3.6);
      g.strokeStyle = 'rgba(70,40,80,.6)'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(sh[0] + 12, sh[1] + 8); g.quadraticCurveTo(sh[0] + 30, sh[1] + 20, el[0] - 6, el[1] + 4); g.stroke();
    });
  }
  function gyukiHead(open) {
    return Kit().sprite('kb:gyhead' + (open ? 1 : 0), 480, 360, g => {
      g.scale(2, 2); g.translate(90, 430);  // covers x -90..150, y -430..-250
      g.lineJoin = 'round'; g.lineCap = 'round';
      horn(g, [8, -326], [-48, -330], [-66, -396], 26);
      cel(g, () => blob(g, [[-4, -298], [4, -336], [40, -350], [74, -338], [88, -312], [84, -284], [50, -276], [12, -280]]), C.skin, () => {
        g.fillStyle = C.skinD; g.beginPath(); g.ellipse(0, -300, 26, 46, 0, 0, TAU); g.fill();
        g.fillStyle = C.chest; blob(g, [[52, -314], [86, -320], [104, -302], [100, -282], [68, -276], [50, -292]]); g.fill();
        g.fillStyle = 'rgba(255,240,255,.25)'; g.beginPath(); g.ellipse(46, -336, 22, 7, -.15, 0, TAU); g.fill();
        g.fillStyle = C.skinD; blob(g, [[20, -334], [44, -346], [72, -334], [54, -326], [34, -326]]); g.fill();
      }, 3.8);
      horn(g, [46, -340], [104, -348], [102, -410], 28);
      // eyes: small angry yellow slits
      for (const [x, y, s] of [[34, -318, 1], [62, -320, .8]]) {
        g.fillStyle = '#fff2a8'; g.beginPath(); g.ellipse(x, y, 8 * s, 4.6 * s, -.15, 0, TAU); g.fill();
        g.fillStyle = '#1a0e10'; g.beginPath(); g.arc(x + 2, y + .5, 2.2 * s, 0, TAU); g.fill();
        g.strokeStyle = C.line; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 10 * s, y - 8 * s); g.lineTo(x + 9 * s, y - 3 * s); g.stroke();
      }
      g.fillStyle = C.line; g.beginPath(); g.ellipse(90, -302, 3.6, 2.6, .3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(100, -298, 3, 2.2, .3, 0, TAU); g.fill();
      if (open) {
        g.beginPath(); g.moveTo(58, -288); g.quadraticCurveTo(82, -290, 104, -292); g.quadraticCurveTo(98, -258, 66, -262); g.closePath();
        g.fillStyle = '#3a0e16'; g.fill(); g.strokeStyle = C.line; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#f4ece0';
        for (let i = 0; i < 5; i++) { const x = 64 + i * 8; g.beginPath(); g.moveTo(x, -289); g.lineTo(x + 3.5, -282); g.lineTo(x + 7, -289.5); g.fill(); }
      } else {
        g.strokeStyle = C.line; g.lineWidth = 3; g.beginPath(); g.moveTo(60, -284); g.quadraticCurveTo(82, -282, 102, -288); g.stroke();
      }
    });
  }
  // Gyūki at (x, y) facing `fac`; act 0..1 raises the arm / opens the jaw; k fades it in/out.
  function drawGyuki(ctx, x, y, fac, time, act, k, seed) {
    const sc = GY * (.6 + .4 * easeOut(k));
    ctx.save();
    ctx.globalAlpha = clamp01(k * 1.5);
    ctx.translate(x, y); ctx.scale(fac * sc, sc);
    // chakra steam boiling off the shoulders and a faint crimson aura behind the beast
    const K = Kit(), vio = K.puff('violet');
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, 10, -200, 230, '255,40,90', .16 * k, false, 1.2);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 7; i++) {
      const ph = (time * .55 + hash(i * 1.3 + seed)) % 1, px = -80 + hash(i * 2.9 + seed) * 170 + Math.sin(time + i) * 10;
      K.stamp(ctx, vio, px, -230 - ph * 170, 26 + ph * 34, bell(ph) * .4 * k);
    }
    // back legs
    const legs = [[-24, -100, 2.55, 190, 1.4, 0], [-14, -96, 2.25, 200, 1.6, 1], [-34, -108, 2.85, 170, 1.2, 2], [-4, -92, 1.95, 180, 1.8, 3]];
    for (const [lx, ly, ang, len, curl, i] of legs) {
      spine(lx, ly, ang, len, curl, .22, time * 1.7 + i * 1.3 + seed, 14);
      ribbon(ctx, SP, 14, 40, 6, i % 2 ? C.skinD : '#665070', 'rgba(40,20,60,.3)', C.line, C.sucker, 3.4);
    }
    const breath = Math.sin(time * 1.8) * .012;
    ctx.save(); ctx.scale(1, 1 + breath);
    ctx.drawImage(gyukiBody(), -130, -300, 300, 300);
    ctx.restore();
    // front legs
    const front = [[10, -96, .95, 190, -1.6, 4], [24, -100, .55, 200, -1.4, 5], [2, -92, 1.35, 150, -1.8, 6], [30, -108, .2, 180, -1.2, 7]];
    for (const [lx, ly, ang, len, curl, i] of front) {
      spine(lx, ly, ang, len, curl, .2, time * 1.6 + i * 1.1 + seed, 14);
      ribbon(ctx, SP, 14, 44, 6, i % 2 ? C.skin : '#866f84', 'rgba(40,20,60,.3)', C.line, C.sucker, 3.4);
    }
    ctx.drawImage(gyukiArm(act > .5), -20, -300, 220, 220);
    ctx.save(); ctx.translate(0, -breath * 260);
    ctx.drawImage(gyukiHead(act > .5), -90, -430, 240, 180);
    ctx.restore();
    ctx.restore();
  }
  // Mouth of Gyūki in world space.
  const gyMouth = (gx, gy, fac) => ({ x: gx + fac * 86 * GY, y: gy - 280 * GY });

  // ------------------------------------------------------------------ telegraphs
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = faint ? 3.5 : 5;
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
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath(); ctx.arc(x, y, r1, a0, a1, a1 < a0); ctx.arc(x, y, r0, a1, a0, a1 >= a0); ctx.closePath();
  }
  function teleShape(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    if (s.k === 'c') { markCircle(ctx, s.x, s.y, s.r, rgb, k, time, s.faint); return; }
    if (s.k === 'ring') {
      const am = s.a0 + (s.a1 - s.a0) * clamp01(k);
      ctx.fillStyle = 'rgba(24,12,8,.15)'; sector(ctx, s.x, s.y, s.r0, s.r1, s.a0, s.a1); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, s.x, s.y, s.r0, s.r1, s.a0, am); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; sector(ctx, s.x, s.y, s.r0, s.r1, s.a0, s.a1); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
      // chevrons pointing the way the tentacle will sweep
      const dir = s.a1 > s.a0 ? 1 : -1, rm = (s.r0 + s.r1) / 2;
      ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const f = ((i + time * 1.5) % 6) / 6, an = s.a0 + (s.a1 - s.a0) * f, c = Math.cos(an), sn = Math.sin(an);
        const tx = -sn * dir, ty = c * dir;
        for (const rr of [rm - 120, rm + 120]) {
          const px = s.x + c * rr, py = s.y + sn * rr;
          ctx.moveTo(px - tx * 16 + c * 14, py - ty * 16 + sn * 14); ctx.lineTo(px, py); ctx.lineTo(px - tx * 16 - c * 14, py - ty * 16 - sn * 14);
        }
      }
      ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    if (s.k === 'line') {
      ctx.fillStyle = 'rgba(24,12,8,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(24,12,8,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ shared VFX pieces
  function dustRing(ctx, x, y, r, t, seed, n = 12, kind = 'dust', a = .8) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.2), a0 = 1 - win(t, .6, 1.8);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(i + seed) * .4, d = r * (.3 + e * (.62 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8 - hash(i * 4.4 + seed) * r * .1, r * (.1 + e * (.08 + hash(i * 6.1 + seed) * .07)), a0 * a, .75);
    }
  }
  function impactO(ctx, x, y, r, t, seed, rgb) {
    const K = Kit();
    if (t < 0) return;
    ctx.globalCompositeOperation = 'lighter';
    if (t < .35) K.glow(ctx, x, y - 10, r * (.6 + t * 2), rgb, (1 - t / .35) * .9, true, .7);
    K.fx.shockRing(ctx, x, y, r * 1.1, t * 1.4, Math.max(0, 1 - t * 1.2), rgb);
    if (t > .1) K.fx.shockRing(ctx, x, y, r * 1.35, (t - .1) * 1.2, Math.max(0, .8 - t), '255,240,240');
    ctx.globalCompositeOperation = 'source-over';
    dustRing(ctx, x, y, r, t, seed, 12);
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.1, t / 1.1, seed, '#3a2c22', 12);
  }
  function scorchG(ctx, x, y, r, alpha, seed, col = '30,18,14') {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(${col},${.32 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, r * .8, r * .4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${.7 * alpha})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = hash(i * 4.7 + seed) * TAU, b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.moveTo(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .25);
      ctx.lineTo(x + Math.cos(b) * r * .85, y + Math.sin(b) * r * .43);
      ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * .58);
    }
    ctx.stroke();
  }
  // Tapered crescent path along an (elliptical, squash sq) arc from a0 to a1, outer radius R, max width w.
  // sym: thickest in the middle; otherwise thickest near the leading end (a1) like a fresh sword cut.
  function crescent(ctx, cx, cy, R, w, a0, a1, sq, sym) {
    const n = 18;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const an = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R * sq); }
    for (let i = n; i >= 0; i--) {
      const u = i / n, an = a0 + (a1 - a0) * u;
      const prof = sym ? Math.sin(Math.PI * u) : Math.pow(Math.sin(Math.PI * Math.pow(u, .7)), .8) * (.35 + .65 * u);
      const rr = R - w * prof;
      ctx.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * sq);
    }
    ctx.closePath();
  }
  function speedLines(ctx, x0, y0, x1, y1, w, alpha, seed, rgb = '255,255,255') {
    const len = Math.hypot(x1 - x0, y1 - y0); if (len < 4) return;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(${rgb},${alpha * .8})` : `rgba(30,14,30,${alpha * .35})`;
      ctx.lineWidth = pass ? 2 : 4.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const o = (hash(i + seed) - .5) * w * 2, s0 = hash(i * 3.1 + seed) * len * .7, l = len * (.25 + hash(i * 1.7 + seed) * .4);
        ctx.moveTo(x0 + ux * s0 + nx * o, y0 + uy * s0 + ny * o - 34); ctx.lineTo(x0 + ux * (s0 + l) + nx * o, y0 + uy * (s0 + l) + ny * o - 34);
      }
      ctx.stroke();
    }
  }

  // ---- the Eight-Tails' cloak (partial transformation): crimson chakra shroud, ox horns, small tails.
  function cloakBehind(ctx, x, fy, fac, k, time, seed) {
    if (k < .02) return;
    const K = Kit(), H = bodyH();
    // tails fanning out behind his back
    for (let i = 0; i < 8; i++) {
      const base = fac > 0 ? -2.45 : -.69, ang = base + (i - 3.5) * .2 * fac;
      spine(x - fac * 8, fy - 36, ang, (34 + 26 * k) * (1 + (i % 3) * .12), -1.1 * fac, .35, time * 3 + i * .9 + seed, 9);
      ribbon(ctx, SP, 9, 15 * k + 3, 1.5, `rgba(150,16,48,${.82 * k})`, `rgba(70,4,24,${.5 * k})`, `rgba(40,4,16,${.7 * k})`, null, 2);
    }
    // the shroud: a flickering flame silhouette hugging the body
    ctx.fillStyle = `rgba(110,10,40,${.42 * k})`;
    ctx.beginPath();
    const cx = x, cy = fy - H * .5, rx = 30, ry = H * .62;
    for (let i = 0; i <= 26; i++) {
      const a = i / 26 * TAU, up = Math.max(0, -Math.sin(a));
      const fl = 1 + (hash(i + Math.floor(time * 12) * .37 + seed) * .22 + up * .25) * (i % 2 ? 1 : .4);
      const px = cx + Math.cos(a) * rx * fl, py = cy + Math.sin(a) * ry * (a > 0 && a < Math.PI ? .78 : fl);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, ry * 1.3, '255,40,80', .32 * k, false, 1.2);
    ctx.globalCompositeOperation = 'source-over';
  }
  function cloakFront(ctx, x, fy, fac, k, time, seed) {
    if (k < .02) return;
    const K = Kit(), H = bodyH(), hy = fy - H + 14;
    // ox horns rising from the shroud around his head
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const bx = x + s * 9 + fac * 2, by = hy + 2;
      ctx.strokeStyle = `rgba(40,4,16,${.85 * k})`; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + s * 18, by - 4, bx + s * 20, by - 22 * k); ctx.stroke();
      ctx.strokeStyle = `rgba(200,30,70,${.9 * k})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + s * 18, by - 4, bx + s * 20, by - 22 * k); ctx.stroke();
    }
    // a thin crimson film over the body, and flame licks rising off the shroud
    ctx.fillStyle = `rgba(170,20,60,${.12 * k})`;
    ctx.beginPath(); ctx.ellipse(x, fy - H * .48, 22, H * .52, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,60,100,${.35 * k})`;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const ph = (time * 2.2 + hash(i * 1.9 + seed)) % 1, bx = x + (i - 3) * 8 + Math.sin(time * 5 + i) * 3, by = fy - H * (.15 + hash(i + seed) * .7) - ph * 26;
      const hh = 10 + 8 * (1 - ph), ww = 3.5 * (1 - ph * .6);
      ctx.moveTo(bx - ww, by); ctx.quadraticCurveTo(bx - ww * .6, by - hh * .6, bx + Math.sin(i + time * 7) * 2, by - hh); ctx.quadraticCurveTo(bx + ww * .7, by - hh * .5, bx + ww, by); ctx.closePath();
    }
    ctx.fill();
    // chakra bubbles boiling off
    for (let i = 0; i < 8; i++) {
      const ph = (time * .9 + hash(i + seed)) % 1, bx = x + (hash(i * 3.3 + seed) - .5) * 52, by = fy - 10 - ph * (H + 30);
      K.glow(ctx, bx + Math.sin(time * 3 + i) * 4, by, 6 + 5 * (1 - ph), '255,60,100', (1 - ph) * .7 * k);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ effect painters [ground, overlay]
  const FX = {
    impact: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r, 1 - win(fx.age, fx.dur - .6, fx.dur), fx.seed),
      (ctx, fx) => impactO(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, fx.rgb || '255,90,120')
    ],
    dash: [
      (ctx, fx) => {
        // gouged ground and kicked-up dust along the path
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), K = Kit(), dust = K.puff('dust');
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
        if (len < 5) return;
        ctx.strokeStyle = `rgba(40,24,18,${.35 * a})`; ctx.lineWidth = 26; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
        for (let d = 0; d < len; d += 46) {
          const t = d / len, j = hash(d * .1 + fx.seed);
          K.stamp(ctx, dust, fx.x0 + (fx.x1 - fx.x0) * t + (j - .5) * 40, fx.y0 + (fx.y1 - fx.y0) * t - 10 - j * 14, 18 + j * 14, a * .7, .75);
        }
      },
      (ctx, fx, time, z) => {
        const S = Spr(), a = 1 - win(fx.age, fx.dur - .4, fx.dur), fac = Math.cos(fx.a) >= 0 ? 1 : -1;
        for (let i = 0; i + 1 < fx.pts.length; i += 4) {
          const k = (i / fx.pts.length);
          if (S) S.draw(ctx, ID, fx.pts[i], fx.pts[i + 1] + 3, { facing: fac, frame: 'attack', alpha: (.12 + k * .3) * a });
        }
        speedLines(ctx, fx.x0, fx.y0, fx.x1, fx.y1, 40, a, fx.seed, '255,200,210');
      }
    ],
    slash: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, .2, fx.dur);
        ctx.strokeStyle = `rgba(40,22,18,${.45 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) { const r = fx.r * (.45 + i * .22); ctx.moveTo(fx.x + Math.cos(fx.a - fx.h) * r, fx.y + Math.sin(fx.a - fx.h) * r); ctx.arc(fx.x, fx.y, r, fx.a - fx.h, fx.a + fx.h); }
        ctx.stroke();
      },
      (ctx, fx, time) => {
        const t = fx.age / .2, a = 1 - win(fx.age, .2, fx.dur), K = Kit();
        const s = fx.side, from = fx.a - fx.h * s, to = from + 2 * fx.h * s * easeOut(t);
        const cy = fx.y - 26, SQ = .62;
        // motion smear over the swept fan
        if (Math.abs(to - from) > .05) {
          ctx.fillStyle = `rgba(215,232,255,${.2 * a})`;
          ctx.beginPath();
          for (let i = 0; i <= 12; i++) { const an = from + (to - from) * i / 12; ctx.lineTo(fx.x + Math.cos(an) * fx.r, cy + Math.sin(an) * fx.r * SQ); }
          for (let i = 12; i >= 0; i--) { const an = from + (to - from) * i / 12; ctx.lineTo(fx.x + Math.cos(an) * fx.r * .3, cy + Math.sin(an) * fx.r * .3 * SQ); }
          ctx.closePath(); ctx.fill();
        }
        // three blade crescents (the seven swords move as one fan), thickest at the leading edge
        for (const [k, w, lag] of [[1, 36, 0], [.78, 26, .14], [.56, 18, .28]]) {
          const e = to - lag * s;
          if (s * (e - from) <= .04) continue;
          crescent(ctx, fx.x, cy, fx.r * k, w, from, e, SQ, false);
          ctx.strokeStyle = `rgba(16,20,40,${.6 * a})`; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.fillStyle = `rgba(250,252,255,${.96 * a})`; ctx.fill();
          crescent(ctx, fx.x, cy, fx.r * k - 3, w * .35, from, e, SQ, false);
          ctx.fillStyle = `rgba(150,195,255,${.8 * a})`; ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        const tr = fx.r * .92, tx = fx.x + Math.cos(to) * tr, ty = cy + Math.sin(to) * tr * SQ;
        K.glow(ctx, tx, ty, 54, '170,210,255', .7 * a * (1 - win(fx.age, .18, .35)), true);
        ctx.strokeStyle = `rgba(255,255,255,${.9 * a})`; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const an = to + (hash(i + fx.seed) - .5) * .5, d = tr * (1 + hash(i * 3 + fx.seed) * .25 * t);
          ctx.moveTo(fx.x + Math.cos(an) * tr, cy + Math.sin(an) * tr * SQ); ctx.lineTo(fx.x + Math.cos(an) * d, cy + Math.sin(an) * d * SQ);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    wave: [
      (ctx, fx) => {
        const d = Math.min(fx.len, fx.age * fx.speed), a = 1 - win(fx.age, fx.dur - .4, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a);
        ctx.strokeStyle = `rgba(36,20,16,${.5 * a})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x + c * 40, fx.y + s * 40); ctx.lineTo(fx.x + c * d, fx.y + s * d); ctx.stroke();
      },
      (ctx, fx, time) => {
        const d = Math.min(fx.len, fx.age * fx.speed), done = fx.age * fx.speed > fx.len;
        if (done && fx.age > fx.len / fx.speed + .15) return;
        const c = Math.cos(fx.a), s = Math.sin(fx.a), x = fx.x + c * d, y = fx.y + s * d - 26, K = Kit();
        const a = done ? 1 - (fx.age - fx.len / fx.speed) / .15 : 1;
        ctx.save(); ctx.translate(x, y); ctx.rotate(fx.a);
        // a flying crescent blade with two fading ghosts behind it
        for (let i = 2; i >= 0; i--) {
          const off = -i * 34, al = (1 - i * .32) * a;
          crescent(ctx, off - 70, 0, 100, 38 - i * 8, -1.05, 1.05, 1, true);
          ctx.strokeStyle = `rgba(16,20,40,${.6 * al})`; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.fillStyle = `rgba(248,251,255,${.95 * al})`; ctx.fill();
          crescent(ctx, off - 70, 0, 96, 12 - i * 3, -.9, .9, 1, true);
          ctx.fillStyle = `rgba(140,190,255,${.85 * al})`; ctx.fill();
        }
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, y, 90, '150,200,255', .55 * a, true, 1);
        ctx.globalCompositeOperation = 'source-over';
        speedLines(ctx, x - c * 260, y + 26 - s * 260, x, y + 26, 50, .8 * a, fx.seed, '220,235,255');
      }
    ],
    spin: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, .3, fx.dur);
        ctx.strokeStyle = `rgba(40,22,18,${.4 * a})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * .9, fx.r * .45, 0, 0, TAU); ctx.stroke();
        dustRing(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, 14);
      },
      (ctx, fx, time) => {
        const K = Kit(), t = fx.age, a = 1 - win(t, .45, fx.dur), sw = swordImg();
        const rr = fx.r * (.25 + easeOut(t / .3) * .75), cy = fx.y - 30, rot = t * 22;
        for (let i = 0; i < 7; i++) {
          const an = rot + i * TAU / 7, px = fx.x + Math.cos(an) * rr * .9, py = cy + Math.sin(an) * rr * .5;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(px, py); ctx.rotate(an + Math.PI / 2 + .3); ctx.drawImage(sw, -60, -10, 120, 20); ctx.restore();
        }
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const r = rr * (.6 + i * .2), a0 = rot * .6 + i * 2;
          ctx.strokeStyle = `rgba(20,24,40,${.4 * a})`; ctx.lineWidth = 9;
          ctx.beginPath(); ctx.ellipse(fx.x, cy, r, r * .5, 0, a0, a0 + 2.4); ctx.stroke();
          ctx.strokeStyle = `rgba(240,248,255,${.9 * a})`; ctx.lineWidth = 4; ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r, t * 1.6, a, '190,220,255');
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    inkJet: [
      null,
      (ctx, fx, time) => {
        const K = Kit(), t = fx.age, a = 1 - win(t, .9, fx.dur);
        const cy = -MOUTH_Y + 14, c = Math.cos(fx.a), s = Math.sin(fx.a);
        // the jet: three thick tongues of ink gushing out of the mouth and arcing down onto the ground
        const reach = Math.min(fx.r, t * 1900), gush = 1 - win(t, .45, .8);
        if (gush > 0 && reach > 30) {
          for (let j = 0; j < 3; j++) {
            const aa = fx.a + (j - 1) * fx.h * .45, ca = Math.cos(aa), sa = Math.sin(aa), L = reach * (j === 1 ? 1 : .82), n = 12;
            const back = L * win(t, .45, .8);
            for (let i = 0; i < n; i++) {
              const u = i / (n - 1), d = back + (L - back) * u, prog = d / fx.r;
              const h = cy * (1 - prog) - Math.sin(prog * Math.PI) * 40, wob = Math.sin(u * 7 + time * 18 + j * 2) * 6 * u;
              SP[i * 2] = fx.x + ca * d - sa * wob; SP[i * 2 + 1] = fx.y + sa * d + ca * wob + h;
            }
            ribbon(ctx, SP, n, 16 * gush, (54 - j * 6) * gush, `rgba(14,9,22,${.92 * a})`, `rgba(60,40,100,${.35 * a})`, `rgba(8,4,12,${.6 * a})`, null, 2);
            ctx.strokeStyle = `rgba(190,170,255,${.55 * a * gush})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
            ctx.beginPath(); for (let i = 2; i < n - 1; i++) ctx.lineTo(SP[i * 2] - sa * 5, SP[i * 2 + 1] - 7); ctx.stroke();
          }
        }
        // flying globs, stretched along their flight, then splattering
        ctx.fillStyle = `rgba(14,9,22,${a})`;
        ctx.beginPath();
        const HL = [];
        for (let i = 0; i < 40; i++) {
          const t0 = hash(i * 1.3 + fx.seed) * .5, tt = t - t0;
          if (tt < 0) continue;
          const end = fx.r * (.3 + hash(i * 5.1 + fx.seed) * .75), sp = 1500 + hash(i * 2.7 + fx.seed) * 600, d = Math.min(end, tt * sp);
          if (d >= end - 1 && tt > end / sp + .1) continue;
          const an = fx.a + (hash(i * 3.9 + fx.seed) - .5) * 2 * fx.h * 1.05, prog = d / fx.r;
          const h = cy * (1 - prog) - Math.sin(prog * Math.PI) * 40;
          const x = fx.x + Math.cos(an) * d, y = fx.y + Math.sin(an) * d + h, r = 4 + hash(i * 7.7 + fx.seed) * 9;
          const p2 = (d + 8) / fx.r, h2 = cy * (1 - p2) - Math.sin(p2 * Math.PI) * 40;
          const rot = Math.atan2(Math.sin(an) * 8 + h2 - h, Math.cos(an) * 8);
          ctx.moveTo(x + Math.cos(rot) * r * 2, y + Math.sin(rot) * r * 2); ctx.ellipse(x, y, r * 2, r, rot, 0, TAU);
          HL.push(x - Math.cos(rot) * r * .4, y - r * .45, r * .32);
        }
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${.7 * a})`;
        ctx.beginPath();
        for (let i = 0; i < HL.length; i += 3) { ctx.moveTo(HL[i] + HL[i + 2], HL[i + 1]); ctx.arc(HL[i], HL[i + 1], HL[i + 2], 0, TAU); }
        ctx.fill();
        // spray at the mouth
        if (t < .5) {
          const sm = K.puff('violet');
          for (let i = 0; i < 5; i++) K.stamp(ctx, sm, fx.x + Math.cos(fx.a) * (20 + i * 22), fx.y + Math.sin(fx.a) * (20 + i * 22) + cy, 14 + i * 5, (1 - t / .5) * .8);
        }
      }
    ],
    inkPool: [
      (ctx, fx, time) => {
        const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
        for (const p of fx.pools) {
          const tt = fx.age - p.t0; if (tt < 0) continue;
          const sc = easeOut(tt / .25) * (1 + .04 * Math.sin(time * 2 + p.rot));
          ctx.save(); ctx.globalAlpha = fade * .92; ctx.translate(p.x, p.y); ctx.scale(1, .55); ctx.rotate(p.rot);
          const R = p.r * 1.08 * sc; ctx.drawImage(inkSplat(p.v), -R, -R, R * 2, R * 2);
          ctx.restore();
          // splash crown when it lands
          if (tt < .4) {
            ctx.fillStyle = `rgba(14,9,20,${1 - tt / .4})`;
            for (let j = 0; j < 7; j++) {
              const an = j / 7 * TAU + p.rot, dd = p.r * (.6 + tt * 2.4), hh = Math.sin(tt / .4 * Math.PI) * 26;
              ctx.beginPath(); ctx.arc(p.x + Math.cos(an) * dd, p.y + Math.sin(an) * dd * .5 - hh, 4, 0, TAU); ctx.fill();
            }
          }
        }
      },
      (ctx, fx, time) => {
        // bubbles popping on the ink
        const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
        ctx.strokeStyle = `rgba(190,170,240,${.6 * fade})`; ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < fx.pools.length; i++) {
          const p = fx.pools[i]; if (fx.age < p.t0 + .3) continue;
          for (let j = 0; j < 2; j++) {
            const ph = (time * 1.3 + hash(i * 3 + j + fx.seed)) % 1, an = hash(i * 7 + j + Math.floor(time * 1.3 + hash(i * 3 + j + fx.seed))) * TAU, dd = p.r * .6 * hash(i + j * 9);
            const bx = p.x + Math.cos(an) * dd, by = p.y + Math.sin(an) * dd * .5, r = 2 + ph * 5;
            ctx.moveTo(bx + r, by - r * .4); ctx.ellipse(bx, by - r * .4, r, r * .7, 0, 0, TAU);
          }
        }
        ctx.stroke();
      }
    ],
    tents: [
      (ctx, fx) => {
        for (const s of fx.list) {
          const t = fx.age - s.delay - .28;
          if (t < 0) continue;
          scorchG(ctx, s.x, s.y, s.r * .9, 1 - win(fx.age, fx.dur - .5, fx.dur), s.seed);
        }
      },
      (ctx, fx, time, z) => {
        const fy = z.y + 3, fac = fx.fac, rx = z.x - fac * 10, ry = fy - 44;
        for (const s of fx.list) {
          const t = fx.age - s.delay;
          if (t < 0) continue;
          drawSlam(ctx, rx, ry, s.x, s.y, t, .28, 30, 8, s.side, s.seed, time, 1);
          impactO(ctx, s.x, s.y, s.r, t - .28, s.seed, '255,110,150');
        }
      }
    ],
    sweep: [
      (ctx, fx) => {
        const k = clamp01(fx.age / fx.sw), ang = fx.a0 + (fx.a1 - fx.a0) * easeInOut(k), a = 1 - win(fx.age, fx.dur - .6, fx.dur);
        const lo = Math.min(fx.a0, ang), hi = Math.max(fx.a0, ang);
        ctx.strokeStyle = `rgba(40,24,18,${.32 * a})`; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const r = fx.r0 + (fx.r1 - fx.r0) * (.2 + i * .19);
          ctx.lineWidth = 4 + i;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, r, lo, hi); ctx.stroke();
        }
        const K = Kit(), dust = K.puff('dust');
        for (let i = 0; i < 10; i++) {
          const f = i / 9, an = fx.a0 + (ang - fx.a0) * f, r = fx.r1 * (.7 + hash(i + fx.seed) * .3), age = (1 - f) * fx.sw;
          K.stamp(ctx, dust, fx.x + Math.cos(an) * r, fx.y + Math.sin(an) * r - 12, 26 + age * 30, a * (1 - age) * .8, .75);
        }
      },
      (ctx, fx, time) => {
        const k = clamp01(fx.age / fx.sw), ang = fx.a0 + (fx.a1 - fx.a0) * easeInOut(k);
        const out = fx.age < fx.sw ? 1 : 1 - win(fx.age, fx.sw, fx.sw + .5);
        if (out <= 0) return;
        const c = Math.cos(ang), s = Math.sin(ang), n = 16, len = (fx.r1 + 30) * (.4 + .6 * easeOut(fx.age / .12)) * out;
        const x0 = fx.x, y0 = fx.y - 40, perpx = -s, perpy = c, dir = fx.a1 > fx.a0 ? 1 : -1, K = Kit();
        // motion smear over the arc just swept, under the tentacle
        if (fx.age < fx.sw + .1) {
          const tail = ang - dir * .7;
          ctx.fillStyle = 'rgba(255,236,220,.22)';
          ctx.beginPath(); ctx.arc(fx.x, fx.y - 20, len * .98, tail, ang, dir < 0); ctx.arc(fx.x, fx.y - 20, fx.r0, ang, tail, dir > 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(40,20,30,.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(fx.x, fx.y - 20, len * .98, tail, ang, dir < 0); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,250,240,.85)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
          ctx.beginPath();
          for (let i = 0; i < 7; i++) {
            const r = fx.r0 + (len - fx.r0) * (.2 + i * .12), a1 = ang - dir * (.08 + hash(i + fx.seed) * .1), a2 = a1 - dir * (.35 + hash(i * 2 + fx.seed) * .3);
            ctx.moveTo(fx.x + Math.cos(a1) * r, fx.y - 20 + Math.sin(a1) * r);
            ctx.arc(fx.x, fx.y - 20, r, a1, a2, dir > 0);
          }
          ctx.stroke();
        }
        // shadow on the ground
        ctx.strokeStyle = 'rgba(20,10,20,.28)'; ctx.lineWidth = 56; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x + c * 40, fx.y + s * 40); ctx.lineTo(fx.x + c * len, fx.y + s * len); ctx.stroke();
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1), lag = -dir * Math.sin(t * Math.PI * .9) * 90 * t;
          SP[i * 2] = x0 + c * len * t + perpx * lag;
          SP[i * 2 + 1] = y0 + s * len * t + perpy * lag + t * 26 - Math.sin(t * 9 + time * 10) * 6;
        }
        ribbon(ctx, SP, n, 84, 12, C.skin, 'rgba(40,20,60,.32)', C.line, C.sucker, 3.6);
        // dust and rubble thrown off the tip
        if (fx.age < fx.sw) {
          const dust = K.puff('dust'), tx = SP[(n - 1) * 2], ty = SP[(n - 1) * 2 + 1] + 20;
          for (let i = 0; i < 5; i++) {
            const ph = (time * 4 + hash(i + fx.seed)) % 1;
            K.stamp(ctx, dust, tx - perpx * dir * ph * 70 + (hash(i * 3) - .5) * 30, ty - perpy * dir * ph * 70 - ph * 30, 20 + ph * 26, (1 - ph) * .9, .8);
          }
        }
      }
    ],
    tbbShot: [
      (ctx, fx) => {
        const d = Math.min(fx.len, fx.age * fx.speed), a = 1 - win(fx.age, fx.dur - .5, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a);
        ctx.strokeStyle = `rgba(30,10,40,${.35 * a})`; ctx.lineWidth = fx.big ? 90 : 60; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + c * d, fx.y + s * d); ctx.stroke();
      },
      (ctx, fx, time) => {
        const K = Kit(), c = Math.cos(fx.a), s = Math.sin(fx.a), fly = fx.len / fx.speed;
        const d = Math.min(fx.len, fx.age * fx.speed), lift = fx.big ? 230 * GY : MOUTH_Y - 10;
        const a = 1 - win(fx.age, fly, fx.dur), W = fx.big ? 1.7 : 1.1;
        // the dark chakra trail dropping from the mouth to chest height: under-stroke, violet body, white core
        const hAt = dd => { const k = 1 - dd / fx.len; return LIFT_CHEST + (lift - LIFT_CHEST) * k * k * k; };
        const path = () => { ctx.beginPath(); for (let i = 0; i <= 10; i++) { const dd = d * i / 10; ctx.lineTo(fx.x + c * dd, fx.y + s * dd - hAt(dd)); } };
        const x1 = fx.x + c * d, y1 = fx.y + s * d - hAt(d), thin = 1 - .5 * win(fx.age, fly, fx.dur);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        path();
        ctx.strokeStyle = `rgba(16,6,24,${.8 * a})`; ctx.lineWidth = 58 * W * thin; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(150,70,240,${.7 * a})`; ctx.lineWidth = 40 * W * thin; ctx.stroke();
        ctx.strokeStyle = `rgba(210,150,255,${.6 * a})`; ctx.lineWidth = 20 * W * thin; ctx.stroke();
        ctx.strokeStyle = `rgba(255,245,255,${.95 * a})`; ctx.lineWidth = 8 * W * thin; ctx.stroke();
        for (let i = 0; i < 6; i++) { const dd = d * (i + .5) / 6; K.glow(ctx, fx.x + c * dd, fx.y + s * dd - hAt(dd), 60 * W, '150,70,255', .35 * a); }
        ctx.globalCompositeOperation = 'source-over';
        if (fx.age < fly) {
          const r = 34 * W;
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, x1, y1, r * 3, '160,80,255', .7);
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(tbbSphere(), x1 - r, y1 - r, r * 2, r * 2);
          ctx.globalCompositeOperation = 'lighter';
          K.spin(ctx, tbbSwirl(), x1, y1, r * .95, time * 16, .6);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    ],
    blast: [
      null,
      (ctx, fx, time) => {
        const a = 1 - win(fx.age, fx.dur - .5, fx.dur);
        Kit().fx.beastBlast(ctx, fx.x, fx.y, fx.r, fx.age, a, time, fx.seed);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    ],
    clash: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r, 1 - win(fx.age, fx.dur - .5, fx.dur), fx.seed, '20,24,40'),
      (ctx, fx, time) => {
        const K = Kit(), a = 1 - win(fx.age, fx.dur - .6, fx.dur);
        K.fx.lightningBlast(ctx, fx.x, fx.y, fx.r * 1.2, fx.age, a, time, fx.seed);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        impactO(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed + 3, '255,80,120');
      }
    ],
    transform: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r * .8, 1 - win(fx.age, fx.dur - .5, fx.dur), fx.seed, '40,8,24'),
      (ctx, fx, time) => {
        const K = Kit(), t = fx.age;
        if (!fx.revert) {
          ctx.globalCompositeOperation = 'lighter';
          if (t < .4) K.glow(ctx, fx.x, fx.y - 140, 260, '255,60,100', (1 - t / .4) * .8, true, 1.1);
          K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.2, t * 1.2, Math.max(0, 1 - t), '255,90,130');
          ctx.globalCompositeOperation = 'source-over';
          dustRing(ctx, fx.x, fx.y, fx.r, t, fx.seed, 16);
        }
        // a pillar of ink-dark smoke billowing out where Bee stood
        const sm = K.puff('smoke'), vio = K.puff('violet'), p = t / fx.dur;
        for (let i = 0; i < 18; i++) {
          const an = hash(i * 1.7 + fx.seed) * TAU, d = fx.r * (.15 + hash(i * 2.9 + fx.seed) * .55) * (.4 + easeOut(t * 2) * .8);
          const h = hash(i * 4.1 + fx.seed) * (fx.revert ? 120 : 300) * easeOut(t * 1.5);
          K.stamp(ctx, i % 3 ? sm : vio, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .45 - h - 20, fx.r * (.16 + p * .2 + hash(i) * .08), bell(Math.min(1, p * 1.6)) * .85);
        }
        if (fx.revert && t < .9) K.fx.smokePoof(ctx, fx.x, fx.y, 120, t / .9);
      }
    ]
  };

  // A tentacle whipping from (rx, ry) up over the target and slamming onto (x, y).
  // t: time since it started; th: time of the slam; w0/w1 root/tip widths; S scale for Gyūki.
  function drawSlam(ctx, rx, ry, x, y, t, th, w0, w1, side, seed, time, S) {
    let tipX, tipY, ext = 1;
    const hover = 240 * S;
    if (t < th * .7) { const k = easeOut(t / (th * .7)); tipX = rx + (x - rx) * k; tipY = ry + (y - hover - ry) * k; ext = .3 + .7 * k; }
    else if (t < th) { const k = easeIn((t - th * .7) / (th * .3)); tipX = x; tipY = y - hover * (1 - k); }
    else if (t < th + .35) { tipX = x; tipY = y; }
    else if (t < th + .75) { const k = easeIn((t - th - .35) / .4); tipX = x + (rx - x) * k; tipY = y + (ry - y) * k; ext = 1 - k; }
    else return;
    if (ext <= .02) return;
    const mx = (rx + tipX) / 2 + side * 60 * S, my = Math.min(ry, tipY) - (160 + Math.hypot(tipX - rx, tipY - ry) * .25) * S;
    bezSpine(rx, ry, mx, my, tipX, tipY, 16, 10 * S, time * 6 + seed);
    ribbon(ctx, SP, 16, w0 * S, w1 * S, side > 0 ? C.skin : '#866f84', 'rgba(40,20,60,.32)', C.line, C.sucker, 3 * Math.max(1, S * .8));
    if (t >= th && t < th + .35) {
      // the tip flattened on the ground with a splash of dust
      ctx.fillStyle = 'rgba(30,16,30,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 34 * S, 12 * S, 0, 0, TAU); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ windup visuals (overlay)
  function windupOverlay(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, fac = facingOf(z), fy = z.y + 3;
    const mx = z.x + fac * 16, my = fy - MOUTH_Y;
    switch (st.move) {
      case 'tbb': {
        // Tailed Beast Ball condensing in front of his mouth: black and white chakra spiralling in.
        const r = 6 + 28 * easeOut(k), bx = z.x + Math.cos(st.aim) * (r + 22), by = my - 6 + Math.sin(st.aim) * 10;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, bx, by, r * 4, '170,80,255', .5 + .3 * k);
        ctx.lineCap = 'round';
        for (let i = 0; i < 16; i++) {
          const ph = (time * 1.8 + hash(i + st.seed)) % 1, an = hash(i * 3.7 + st.seed) * TAU + time;
          const d0 = r + 130 * (1 - ph), d1 = r + 130 * (1 - ph) * .7 + 6;
          ctx.strokeStyle = i % 2 ? `rgba(255,255,255,${ph * .9})` : `rgba(150,80,255,${ph})`; ctx.lineWidth = 2 + ph * 2;
          ctx.beginPath(); ctx.moveTo(bx + Math.cos(an) * d0, by + Math.sin(an) * d0 * .8); ctx.lineTo(bx + Math.cos(an) * d1, by + Math.sin(an) * d1 * .8); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        // dark motes being sucked in too (read on the bright ground)
        ctx.fillStyle = 'rgba(20,6,30,.85)';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const ph = (time * 1.4 + hash(i * 5 + st.seed)) % 1, an = hash(i * 9.1 + st.seed) * TAU - time, d = r + 110 * (1 - ph);
          ctx.moveTo(bx + Math.cos(an) * d + 3, by + Math.sin(an) * d * .8); ctx.arc(bx + Math.cos(an) * d, by + Math.sin(an) * d * .8, 3 * ph + 1, 0, TAU);
        }
        ctx.fill();
        ctx.drawImage(tbbSphere(), bx - r, by - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, tbbSwirl(), bx, by, r * .95, time * 14, .55);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'ink': {
        const ball = inkBall();
        for (let i = 0; i < 9; i++) {
          const ph = (time * 2 + hash(i + st.seed)) % 1, an = hash(i * 2.2 + st.seed) * TAU, d = 50 * (1 - ph);
          K.stamp(ctx, ball, mx + Math.cos(an) * d, my + Math.sin(an) * d * .7, 3 + ph * 4, .9);
        }
        K.stamp(ctx, ball, mx + fac * 4, my, 5 + 9 * k, 1);
        break;
      }
      case 'swords': {
        // the seven swords drawn and whirling around him
        const sw = swordImg(), rot = time * (4 + k * 8);
        for (let i = 0; i < 7; i++) {
          const an = rot + i * TAU / 7, px = z.x + Math.cos(an) * 30, py = fy - 40 + Math.sin(an) * 14;
          ctx.save(); ctx.translate(px, py); ctx.rotate(an); ctx.drawImage(sw, -6, -7, 84 * (.5 + .5 * k), 14); ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        if (Math.floor(time * 12) % 3 === 0) K.glow(ctx, z.x + Math.cos(rot) * 60, fy - 40 + Math.sin(rot) * 24, 22, '220,240,255', .9, true);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'gyuki': {
        // chakra boiling up into a column; the ground cracks glow
        ctx.fillStyle = `rgba(90,6,30,${.2 + .2 * k})`;
        ctx.beginPath(); ctx.ellipse(z.x, fy - 70, 40 + 40 * k, 90 + 70 * k, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, fy - 60, 90 + 70 * k, '255,40,80', .22 + .15 * k, false, 1.4);
        ctx.globalCompositeOperation = 'source-over';
        const vio = K.puff('violet');
        for (let i = 0; i < 12; i++) {
          const ph = (time * 1.2 + hash(i + st.seed)) % 1, an = hash(i * 3.3 + st.seed) * TAU;
          K.stamp(ctx, vio, z.x + Math.cos(an) * (30 + 40 * k), fy - 20 - ph * (120 + 160 * k), 18 + 20 * ph, (1 - ph) * .75 * k);
        }
        break;
      }
    }
  }
  function label(ctx, z, st, m, time) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[st.move], top = z.y + 3 - bodyH() - 40;
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#160f1d';
    ctx.strokeText(def.label, z.x, top); ctx.fillStyle = m.accent; ctx.fillText(def.label, z.x, top);
    const bob = Math.sin(time * 9) * 1.5;
    ctx.font = 'italic 800 10px sans-serif'; ctx.lineWidth = 3;
    ctx.strokeText(def.rap, z.x, top - 14 + bob); ctx.fillStyle = '#ffffff'; ctx.fillText(def.rap, z.x, top - 14 + bob);
    ctx.restore();
  }

  // ------------------------------------------------------------------ the Raikage (Double Lariat)
  function drawAlly(ctx, st, time) {
    const al = st.ally, S = Spr(), K = Kit();
    if (!al || !S) return;
    const fac = Math.cos(al.a) >= 0 ? 1 : -1;
    let alpha = 1;
    if (al.phase === 'charge') alpha = clamp01(al.t / .25);
    if (al.phase === 'leave') alpha = 1 - al.t / .35;
    if (alpha <= 0) return;
    const flick = al.phase === 'leave' && Math.floor(time * 30) % 2 ? .3 : 1;
    const fy = al.y + 3;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, al.x, fy - 45, 90, '120,200,255', .55 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    if (S.has('ay')) S.draw(ctx, 'ay', al.x, fy, { facing: fac, frame: al.phase === 'charge' ? 'seal' : 'attack', alpha: alpha * flick });
    // Lightning Release armour: bolts crawling over the body
    const H = S.height('ay');
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a0 = hash(i + Math.floor(time * 20) * 1.3) * TAU, a1 = a0 + 1 + hash(i * 2.2 + Math.floor(time * 20)) * 2;
      K.forkedBolt(ctx, al.x + Math.cos(a0) * 24, fy - H * .5 + Math.sin(a0) * H * .5, al.x + Math.cos(a1) * 30, fy - H * .5 + Math.sin(a1) * H * .55, i * 7, time,
        { jitter: 10, alpha: .9 * alpha, width: 1.4, pal: ['80,170,255', '160,220,255', '255,255,255'], base: 'rgba(20,50,110,.8)', step: 10, forks: 1, forkLen: 18, rate: 30, snap: true });
    }
    ctx.globalCompositeOperation = 'source-over';
    if (al.phase === 'dash') speedLines(ctx, al.x0, al.y0, al.x, al.y, 40, 1, 7, '190,230,255');
  }

  // ------------------------------------------------------------------ Gyūki (ultimate) painting
  function gyFade(gy) { return Math.min(easeOut(gy.t / .5), 1 - win(gy.t, gy.dur - .35, gy.dur)); }
  function drawGyGround(ctx, z, st, time) {
    const gy = st.gy;
    ctx.fillStyle = 'rgba(16,10,20,.28)';
    ctx.beginPath(); ctx.ellipse(gy.x, gy.y + 3, 190 * GY, 60 * GY, 0, 0, TAU); ctx.fill();
    for (const s of gy.slams) {
      const k = (gy.t - s.t0) / s.hit;
      if (k < 1) markCircle(ctx, s.x, s.y, s.r, '255,90,130', k, time, false);
      else scorchG(ctx, s.x, s.y, s.r, 1 - win(gy.t - s.t0, s.hit + .8, s.hit + 1.4), s.seed);
    }
    for (const b of gy.balls) {
      const k = (gy.t - b.t0) / b.fl;
      if (k < 1) markCircle(ctx, b.x1, b.y1, 190, '190,120,255', k, time, false);
    }
    if (gy.beam) {
      const bm = gy.beam, k = (gy.t - bm.t0) / bm.fire;
      if (k < 1) {
        const c = Math.cos(bm.a), s = Math.sin(bm.a);
        teleShape(ctx, { k: 'line', x: gy.x + c * 60, y: gy.y + s * 30, a: bm.a, len: bm.len, w: 110 }, '200,110,255', k, time);
        markCircle(ctx, gy.x + c * 60 + c * bm.len, gy.y + s * 30 + s * bm.len, 430, '200,110,255', k, time, false);
      }
    }
  }
  function drawGyOver(ctx, z, st, time) {
    const gy = st.gy, K = Kit(), fac = facingOf(z), fade = gyFade(gy);
    // slamming tentacles reaching out from behind the beast
    for (const s of gy.slams) {
      const t = gy.t - s.t0 - (s.hit - .3);
      if (t < 0) continue;
      drawSlam(ctx, gy.x - fac * 30, gy.y - 110 * GY, s.x, s.y, t, .3, 58, 12, s.i % 2 ? 1 : -1, s.seed, time, 1.25);
    }
    drawGyuki(ctx, gy.x, gy.y, fac, time + gy.seed, gy.act, fade, gy.seed);
    for (const s of gy.slams) impactO(ctx, s.x, s.y, s.r, gy.t - s.t0 - s.hit, s.seed, '255,100,140');
    const mo = gyMouth(gy.x, gy.y, fac);
    // Tailed Beast Ball rain: small balls lobbed from the mouth
    for (const b of gy.balls) {
      const k = (gy.t - b.t0) / b.fl;
      if (k < 0 || k >= 1) continue;
      const x = mo.x + (b.x1 - mo.x) * k, y = mo.y + (b.y1 - mo.y) * k - Math.sin(k * Math.PI) * 260, r = 20;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 60, '160,80,255', .7); ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tbbSphere(), x - r, y - r, r * 2, r * 2);
    }
    // the giant ball charging in front of the open jaws
    if (gy.beam) {
      const k = clamp01((gy.t - gy.beam.t0) / gy.beam.fire);
      if (k < 1) {
        const r = 12 + 62 * easeOut(k), bx = mo.x + fac * (r + 24), by = mo.y + 6;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, bx, by, r * 4, '170,80,255', .7);
        ctx.lineCap = 'round';
        for (let i = 0; i < 20; i++) {
          const ph = (time * 1.6 + hash(i + gy.seed)) % 1, an = hash(i * 3.7 + gy.seed) * TAU + time;
          const d0 = r + 260 * (1 - ph), d1 = d0 * .75;
          ctx.strokeStyle = i % 2 ? `rgba(255,255,255,${ph})` : `rgba(160,90,255,${ph})`; ctx.lineWidth = 3 + ph * 3;
          ctx.beginPath(); ctx.moveTo(bx + Math.cos(an) * d0, by + Math.sin(an) * d0 * .8); ctx.lineTo(bx + Math.cos(an) * d1, by + Math.sin(an) * d1 * .8); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tbbSphere(), bx - r, by - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, tbbSwirl(), bx, by, r * .95, time * 12, .6);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // name plate over the beast
    if (fade > .5) {
      const top = gy.y - 400 * GY, m = members[ID], barW = 150;
      ctx.fillStyle = 'rgba(8,6,12,.85)'; ctx.fillRect(gy.x - barW / 2 - 2, top - 2, barW + 4, 11);
      ctx.fillStyle = m.accent; ctx.fillRect(gy.x - barW / 2, top, barW * Math.max(0, z.health / z.maxHealth), 7);
      ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#0c0810';
      ctx.strokeText('BÁT VĨ · GYŪKI', gy.x, top - 6); ctx.fillStyle = '#fff4e2'; ctx.fillText('BÁT VĨ · GYŪKI', gy.x, top - 6);
      if (gy.beam && gy.t - gy.beam.t0 < gy.beam.fire) {
        const bob = Math.sin(time * 9) * 1.5;
        ctx.font = 'italic 800 11px sans-serif'; ctx.lineWidth = 3;
        ctx.strokeText('♪ VĨ THÚ NGỌC, ĂN TRỌN ĐI! WEE! ♪', gy.x, top - 22 + bob); ctx.fillStyle = '#ffffff'; ctx.fillText('♪ VĨ THÚ NGỌC, ĂN TRỌN ĐI! WEE! ♪', gy.x, top - 22 + bob);
      }
    }
  }

  // ------------------------------------------------------------------ module hooks
  function draw(ctx, z, time) {
    const st = z.kb;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      if (st.gy) drawGyGround(ctx, z, st, time);
      if (st.ally) {
        ctx.globalCompositeOperation = 'lighter';
        Kit().glow(ctx, st.ally.x, st.ally.y + 3, 70, '120,200,255', .5, false, .4);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (st.cloak > .02 && !st.gy) cloakBehind(ctx, z.x, z.y + 3, facingOf(z), st.cloak, time, z.seed || 0);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.kb, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (st.gy) drawGyOver(ctx, z, st, time);
      else if (st.cloak > .02) cloakFront(ctx, z.x, z.y + 3, facingOf(z), st.cloak, time, z.seed || 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      drawAlly(ctx, st, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (st.windup > 0 && st.move) {
        windupOverlay(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m, time);
      }
    }
    ctx.restore();
  }

  const hidden = z => !!(z.kb && z.kb.gy && z.health > 0 && z.kb.gy.t > .15);

  window.KillerBeeBoss = { members, order, pick, update, draw, drawOverlay, hidden, moveLabels: Object.fromEntries(Object.entries(MOVES).map(([k, v]) => [k, v.label])) };
})();
