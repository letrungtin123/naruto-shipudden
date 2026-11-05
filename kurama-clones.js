/* Z — "100 phân thân Naruto mode Cửu Vĩ cầm Rasengan to lao vào đánh địch".
 * Đa Trọng Ảnh Phân Thân: a hundred Nine-Tails Chakra Mode clones pop out of white smoke in five
 * rings round Naruto, each grows a giant Rasengan overhead on a Kurama chakra arm (a few carry a
 * Rasenshuriken or an orange Bijū-chakra Rasengan), then they charge the enemies in waves, leaving
 * golden streaks, and grind into them (Đại Ngọc Loa Toàn Hoàn · Đa Liên). The last sixteen gather,
 * pour their spheres into one colossal Rasengan wrapped in Kurama's chakra and hurl it at the main
 * target (Siêu Đại Ngọc Loa Toàn Hoàn).
 *
 * Contract (game.js): cast(st, p, api) -> bool, update(st, p, dt, api), drawGround / drawOverlay(ctx, st, p, time).
 * `st` (kuramaState) is plain JSON sent to teammates ~20×/s, kept compact:
 *   clones: [[x, y, angle, mode, t, kind, slot], ...]   mode 0 waiting · 1 formed · 2 charging · 3 vanishing · 4 gathering · 5 feeding the finisher
 *   fx:     [[x, y, kind, t], ...]                      Rasengan impacts (cap 32)
 *   fin:    { x, y, tx, ty, t, h }                      the finisher; cd / t / ox / oy / oa / ax / ay / lbl / cs
 * Enemy references live in a module WeakMap keyed by the state object, never on the state.
 * Every hit resolves in update() on the caster's machine; drawing works from st + p alone. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - c01(t), 3);
  const easeIn = t => { t = c01(t); return t * t; };
  const smooth = t => { t = c01(t); return t * t * (3 - 2 * t); };
  const bell = t => Math.sin(Math.PI * c01(t));
  const frac = v => v - Math.floor(v);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const r0 = v => Math.round(v);
  const r2 = v => Math.round(v * 100) / 100;
  const K = () => window.VFXKit;
  const SPR = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  // ------------------------------------------------------------------ tuning
  const N = 100, COOLDOWN = 18, MAX_FX = 18, GIANT_K = .38;
  const RINGS = [[12, 92], [18, 150], [22, 212], [24, 276], [24, 340]];   // [count, radius]
  const SQ = .6;                       // formation squash (rings read as ellipses on the ground)
  const FORM = .62;                    // Rasengan forming time after the pop
  const SPEED = 1150, ACCEL = .28, TURN = 9, MAX_RUN = 1.45;
  const HIT_R = { 0: 88, 1: 118, 2: 100 }, HIT_DMG = { 0: 820, 1: 1250, 2: 1150 };
  const FIN = { start: 3.55, gather: .5, combine: 1.55, fly: 1.95, grind: 2.4, end: 3.7, R: 118 };
  const NAMES = ['ĐA TRỌNG ẢNH PHÂN THÂN', 'ĐẠI NGỌC LOA TOÀN HOÀN · ĐA LIÊN', 'SIÊU ĐẠI NGỌC LOA TOÀN HOÀN'];

  // Slot table: ring, place, pop time, launch time, kind and finisher membership per clone.
  const SLOTS = [];
  {
    let s = 0;
    RINGS.forEach(([n, rad], ring) => {
      for (let j = 0; j < n; j++, s++) {
        const h = hash(s * 3.7 + 1.3), h2 = hash(s * 5.1 + 7.7);
        const fin = ring === 4 && j % 3 !== 2;
        const wave = ring < 4 ? ring : 4;
        SLOTS.push({
          ring, j, n, rad: rad + (h2 - .5) * 18, ang: j / n * TAU + ring * .37 + (h - .5) * .12,
          pop: .1 + ring * .13 + h * .2,
          launch: fin ? 99 : 1.3 + wave * .46 + h2 * .24,
          kind: fin ? 0 : h < .09 ? 1 : h > .91 ? 2 : 0,
          fin, fi: fin ? Math.round(j - Math.floor(j / 3)) : -1
        });
      }
    });
  }
  const FIN_COUNT = SLOTS.filter(s => s.fin).length;

  // Side table: enemy references per state (never serialised).
  const SIDE = new WeakMap();
  function side(st) {
    let s = SIDE.get(st);
    if (!s) { s = { tg: new Array(N).fill(null), cnt: new Map(), fin: null }; SIDE.set(st, s); }
    return s;
  }

  function ensure(st) {
    if (!Array.isArray(st.clones)) st.clones = [];
    if (!Array.isArray(st.fx)) st.fx = [];
    if (!Array.isArray(st.effects)) st.effects = [];
    if (typeof st.cd !== 'number') st.cd = 0;
    return st;
  }
  function addFx(st, x, y, kind) {
    // Clones piling into the same spot share one burst (the damage still lands per clone).
    for (const f of st.fx) if (f[3] < .22 && f[2] === kind && Math.abs(f[0] - x) < 48 && Math.abs(f[1] - y) < 40) return;
    st.fx.push([r0(x), r0(y), kind, 0]);
    if (st.fx.length > MAX_FX) st.fx.splice(0, st.fx.length - MAX_FX);
  }
  const label = (st, i) => { st.lbl = [i, 0]; };

  // ------------------------------------------------------------------ sprite warm-up
  // The KCM sprite is baked lazily by AnimeSprites (~2 ms a pose); warm one pose a frame up front
  // so the first cast never hitches.
  let warmIdx = 0, warmCtx = null;
  function warm() {
    const S = SPR();
    if (!S || !S.has || !S.has('naruto_kurama') || warmIdx >= S.FRAMES.length * 2) return;
    if (!warmCtx) { const c = document.createElement('canvas'); c.width = c.height = 4; warmCtx = c.getContext('2d'); }
    const f = S.FRAMES[warmIdx >> 1];
    S.draw(warmCtx, 'naruto_kurama', -500, -500, { frame: f, facing: warmIdx & 1 ? -1 : 1, phase: 0 });
    warmIdx++;
  }

  // ------------------------------------------------------------------ cast
  function cast(st, p, api) {
    if (!st || !p) return false;
    ensure(st);
    if (st.cd > 0 || st.clones.length) { st.cs = 1.3; return false; }
    const aim = api && api.aim ? api.aim(700) : { x: p.x + Math.cos(p.angle || 0) * 500, y: p.y + Math.sin(p.angle || 0) * 500 };
    const oa = Math.atan2(aim.y - p.y, aim.x - p.x);
    Object.assign(st, { cd: COOLDOWN, t: 0, ox: r0(p.x), oy: r0(p.y), oa: r2(oa), ax: r0(aim.x), ay: r0(aim.y), fin: null, cs: 0 });
    st.clones.length = 0; st.fx.length = 0;
    for (let s = 0; s < N; s++) {
      const sl = SLOTS[s], a = sl.ang + oa;
      st.clones.push([r0(p.x + Math.cos(a) * sl.rad), r0(p.y + Math.sin(a) * sl.rad * SQ), r2(oa + (hash(s * 9.1) - .5) * .5), 0, r2(-sl.pop), sl.kind, s]);
    }
    const sd = side(st); sd.tg.fill(null); sd.cnt.clear(); sd.fin = null;
    label(st, 0);
    if (api) { api.shake && api.shake(5); api.burst && api.burst(p.x, p.y, '#ffd25a', 18); }
    return true;
  }

  // ------------------------------------------------------------------ update
  const isGiant = e => e.type === 'boss' || e.type === 'beast' || (e.r || 0) > 40;
  let candFrame = -1, cands = [];
  function candidates(api, p) {
    const t = api.time;
    if (t === candFrame) return cands;
    candFrame = t; cands = [];
    const L = api.enemies || [];
    for (const e of L) {
      if (!e || !(e.health > 0)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 1200) cands.push(e);
      if (cands.length >= 140) break;
    }
    return cands;
  }
  function pickTarget(st, c, api, p) {
    const sd = side(st), list = candidates(api, p);
    let best = null, bestS = 1e9;
    for (const e of list) {
      const n = sd.cnt.get(e) || 0;
      const sc = Math.hypot(e.x - c[0], e.y - c[1]) + n * (isGiant(e) ? 26 : 170);
      if (sc < bestS) { bestS = sc; best = e; }
    }
    if (best) sd.cnt.set(best, (sd.cnt.get(best) || 0) + 1);
    sd.tg[c[6]] = best;
    return best;
  }
  // The finisher's mark, kept on screen: the nearest boss/beast within reach, else the heart of the
  // thickest crowd, else nothing (then the cursor point).
  function finTarget(api, p) {
    const list = candidates(api, p).filter(e => Math.abs(e.x - p.x) < 600 && Math.abs(e.y - p.y) < 310);
    let best = null, bestS = -1;
    for (const e of list) {
      let s = isGiant(e) ? 1000 - Math.hypot(e.x - p.x, e.y - p.y) * .1 : 0;
      if (!s) for (const o of list) if (Math.abs(o.x - e.x) < 220 && Math.abs(o.y - e.y) < 160) s++;
      if (s > bestS) { bestS = s; best = e; }
    }
    return best;
  }
  // Point a clone runs at when it has no enemy: the cursor point, fanned out per slot.
  function fallback(st, s) {
    const a = hash(s * 2.9) * TAU, d = 40 + hash(s * 6.3) * 220;
    return [st.ax + Math.cos(a) * d, st.ay + Math.sin(a) * d * SQ];
  }

  function impact(st, c, api) {
    const kind = c[5], x = c[0], y = c[1];
    const tg = side(st).tg[c[6]];
    // Bosses soak a whole wave: each clone dents them less than it hurts a grunt.
    const dmg = Math.round(HIT_DMG[kind] * (.8 + hash(c[6] * 4.4) * .45) * (tg && isGiant(tg) ? GIANT_K : 1));
    api.circle(x, y, HIT_R[kind], dmg, kind === 1 ? 24 : 42);
    addFx(st, x, y, kind);
    // A spiral scar now and then, only on open ground: a hundred clones must not flatten Naruto's own street.
    const sr = kind === 1 ? 80 : 56;
    if (st.wb >= 1 && !api.blocked(x, y, sr + 40)) { st.wb -= 1; api.world(x, y, sr, kind === 1 ? 700 : 420, 'vortex', c[2]); }
    api.shake && api.shake(kind === 1 ? 5 : 3.2);
    c[3] = 3; c[4] = 0;
  }

  function update(st, p, dt, api) {
    if (!st) return;
    ensure(st);
    warm(); warmComp();
    if (st.cd > 0) st.cd = Math.max(0, r2(st.cd - dt));
    if (st.cs > 0) st.cs = Math.max(0, r2(st.cs - dt));
    if (st.lbl) { st.lbl[1] = r2(st.lbl[1] + dt); if (st.lbl[1] > 1.8) st.lbl = null; }
    const FX = st.fx;
    for (let i = FX.length - 1; i >= 0; i--) {
      const f = FX[i], t0 = f[3];
      f[3] = r2(t0 + dt);
      // Rasenshuriken: the wind dome keeps cutting (two extra ticks).
      if (f[2] === 1 && api && p) for (const at of [.22, .46]) if (t0 < at && f[3] >= at) api.circle(f[0], f[1], 135, 340, 0);
      if (f[3] > 1.05) FX.splice(i, 1);
    }
    const C = st.clones;
    if (!C.length && !st.fin) return;
    if (!p || !api) return;
    st.t = r2((st.t || 0) + dt);
    st.wb = Math.min(2, r2((st.wb || 0) + dt * 1.6));
    const T = st.t, sd = side(st);
    if (T >= 1.3 && T - dt < 1.3) label(st, 1);
    // Finisher kicks off: pick the main target and the gathering point in front of Naruto.
    if (T >= FIN.start && !st.fin) {
      const boss = finTarget(api, p);
      const tx = boss ? boss.x : st.ax, ty = boss ? boss.y : st.ay;
      const a = Math.atan2(ty - p.y, tx - p.x), d = Math.hypot(tx - p.x, ty - p.y);
      const gd = Math.min(170, d * .45);
      st.fin = { x: r0(p.x + Math.cos(a) * gd), y: r0(p.y + Math.sin(a) * gd), tx: r0(tx), ty: r0(ty), t: 0, h: 0 };
      sd.fin = boss;
    }
    for (let i = C.length - 1; i >= 0; i--) {
      const c = C[i], sl = SLOTS[c[6]];
      c[4] = r2(c[4] + dt);
      const m = c[3];
      if (m === 0) { if (c[4] >= 0) { c[3] = 1; c[4] = 0; } continue; }
      if (m === 1) {
        // Formed: face the fight; launch on this clone's wave (finisher clones wait for the gather).
        if (sl.fin) { if (st.fin) { c[3] = 4; c[4] = 0; } continue; }
        const tgt = sd.tg[c[6]];
        const tx = tgt ? tgt.x : st.ax, ty = tgt ? tgt.y : st.ay;
        c[2] = r2(Math.atan2(ty - c[1], tx - c[0]));
        if (T >= sl.launch) { c[3] = 2; c[4] = 0; pickTarget(st, c, api, p); }
        continue;
      }
      if (m === 2) {
        let tgt = sd.tg[c[6]];
        if (tgt && !(tgt.health > 0)) { tgt = api.nearest(c[0], c[1], 420, false); sd.tg[c[6]] = tgt || null; }
        let tx, ty;
        if (tgt) { tx = tgt.x; ty = tgt.y; } else { [tx, ty] = fallback(st, c[6]); }
        const want = Math.atan2(ty - c[1], tx - c[0]);
        let da = Math.atan2(Math.sin(want - c[2]), Math.cos(want - c[2]));
        const turn = TURN * dt * (c[4] < .12 ? 2.5 : 1);
        c[2] = r2(c[2] + Math.max(-turn, Math.min(turn, da)));
        const v = lerp(260, SPEED, easeOut(c[4] / ACCEL));
        const nx = c[0] + Math.cos(c[2]) * v * dt, ny = c[1] + Math.sin(c[2]) * v * dt;
        const dist = Math.hypot(tx - nx, ty - ny);
        const reach = tgt ? (tgt.r || 14) + 26 : 30;
        if (dist <= reach || c[4] >= MAX_RUN || api.blocked(nx, ny, 8)) {
          if (dist <= reach) { c[0] = r0(lerp(nx, tx, .35)); c[1] = r0(lerp(ny, ty, .35)); } else { c[0] = r0(nx); c[1] = r0(ny); }
          impact(st, c, api);
        } else { c[0] = r0(nx); c[1] = r0(ny); }
        continue;
      }
      if (m === 3) { if (c[4] > .42) C.splice(i, 1); continue; }
      if (m === 4 || m === 5) {
        const F = st.fin;
        if (!F) { c[3] = 3; c[4] = 0; continue; }
        const a = sl.fi / FIN_COUNT * TAU + .3, sx = F.x + Math.cos(a) * 92, sy = F.y + Math.sin(a) * 92 * .55;
        if (m === 4) {
          const dx = sx - c[0], dy = sy - c[1], d = Math.hypot(dx, dy), step = 1000 * dt;
          if (d <= step) { c[0] = r0(sx); c[1] = r0(sy); c[3] = 5; c[4] = 0; }
          else { c[0] = r0(c[0] + dx / d * step); c[1] = r0(c[1] + dy / d * step); c[2] = r2(Math.atan2(dy, dx)); }
        } else c[2] = r2(Math.atan2(F.y - c[1], F.x - c[0]));
        if (F.t >= FIN.combine) { c[3] = 3; c[4] = 0; }
      }
    }
    updateFin(st, p, dt, api);
  }

  function updateFin(st, p, dt, api) {
    const F = st.fin;
    if (!F) return;
    const t0 = F.t;
    F.t = r2(F.t + dt);
    const t = F.t, sd = side(st), hit = bit => { if (F.h & bit) return false; F.h |= bit; return true; };
    // Track the main target until the sphere is thrown and lands.
    const tg = sd.fin;
    if (tg && tg.health > 0 && t < FIN.fly) { F.tx = r0(tg.x); F.ty = r0(tg.y); }
    if (t0 < FIN.gather && t >= FIN.gather) { label(st, 2); api.shake(4); }
    if (t >= FIN.gather && t < FIN.combine) api.pull(F.x, F.y, 240, 60 * dt);
    if (t >= FIN.combine && hit(1)) { api.shake(8); api.burst(F.x, F.y - 90, '#bfeaff', 16); }
    if (t >= FIN.fly && hit(2)) {
      api.circle(F.tx, F.ty, 210, 2400, -60);
      api.shake(12);
    }
    if (t >= FIN.fly + .22 && hit(4)) api.circle(F.tx, F.ty, 230, 2400, -40);
    if (t >= FIN.grind && hit(8)) {
      api.circle(F.tx, F.ty, 330, 7200, 270, .3);
      api.circle(F.tx, F.ty, 560, 2200, 200, .55);
      api.world(F.tx, F.ty, 300, 2600, 'vortex');
      api.world(F.tx + 160, F.ty + 60, 170, 1400, 'crater');
      api.clearShots && api.clearShots(F.tx, F.ty, 520);
      api.shake(20);
      api.burst(F.tx, F.ty, '#ffffff', 26); api.burst(F.tx, F.ty, '#ffb43a', 20);
    }
    if (t >= FIN.end) st.fin = null;
  }

  // ------------------------------------------------------------------ cached art
  const ART = {};
  // Rasengan frames: a 4-fold spiral turned a quarter turn over 8 frames, so the loop is seamless.
  const RAS_PAL = {
    0: { glow: '60,150,255', body: [[0, '#ffffff'], [.25, '#e6f8ff'], [.55, '#8fd2ff'], [.82, '#3f8fe8'], [1, 'rgba(40,110,230,.0)']], arms: ['rgba(255,255,255,.95)', 'rgba(170,228,255,.9)'], rim: 'rgba(30,70,160,.55)' },
    2: { glow: '255,140,30', body: [[0, '#fffbe8'], [.22, '#ffe7a0'], [.5, '#ffad38'], [.8, '#e8581a'], [1, 'rgba(200,50,10,0)']], arms: ['rgba(255,250,220,.95)', 'rgba(255,190,90,.9)'], rim: 'rgba(110,30,0,.6)' }
  };
  function rasFrames(kind) {
    const key = 'ras' + kind;
    if (ART[key]) return ART[key];
    const P = RAS_PAL[kind] || RAS_PAL[0], out = [];
    for (let f = 0; f < 8; f++) {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const g = c.getContext('2d'); g.translate(48, 48);
      // soft chakra halo baked in (normal blend: no additive pass per clone), then a dark rim so it reads on sand
      const hg = g.createRadialGradient(0, 0, 26, 0, 0, 48);
      hg.addColorStop(0, `rgba(${P.glow},.5)`); hg.addColorStop(.45, `rgba(${P.glow},.2)`); hg.addColorStop(1, `rgba(${P.glow},0)`);
      g.fillStyle = hg; g.fillRect(-48, -48, 96, 96);
      g.fillStyle = P.rim; g.beginPath(); g.arc(0, 0, 33, 0, TAU); g.fill();
      const gr = g.createRadialGradient(-8, -9, 2, 0, 0, 32);
      for (const [s, col] of P.body) gr.addColorStop(s, col);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 31, 0, TAU); g.fill();
      // swirl arms
      g.lineCap = 'round';
      const rot = f / 8 * TAU / 4;
      for (let s = 0; s < 4; s++) {
        for (let pass = 0; pass < 2; pass++) {
          g.strokeStyle = P.arms[pass]; g.lineWidth = pass ? 1.4 : 3;
          g.beginPath();
          for (let i = 0; i <= 18; i++) {
            const tt = i / 18, a = rot + s * TAU / 4 + tt * 3.6, r = 29 * (1 - tt * .85);
            const x = Math.cos(a) * r, y = Math.sin(a) * r * .92;
            if (i) g.lineTo(x, y); else g.moveTo(x, y);
          }
          g.stroke();
        }
      }
      // outer wind band
      g.strokeStyle = 'rgba(220,245,255,.75)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, 0, 30, rot * 2, rot * 2 + 2.4); g.stroke();
      g.beginPath(); g.arc(0, 0, 30, rot * 2 + 3.2, rot * 2 + 5.2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, 24, -2.6, -1.8); g.stroke();
      out.push(c);
    }
    return (ART[key] = out);
  }
  // Rasenshuriken: the sphere with four white wind blades and the ring, 8 frames over a quarter turn.
  function shurikenFrames() {
    if (ART.shu) return ART.shu;
    const ras = rasFrames(0), out = [];
    for (let f = 0; f < 8; f++) {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const g = c.getContext('2d'); g.translate(80, 80);
      const rot = f / 8 * TAU / 4;
      g.strokeStyle = 'rgba(140,200,255,.55)'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.stroke();
      for (let b = 0; b < 4; b++) {
        g.save(); g.rotate(rot + b * TAU / 4);
        g.fillStyle = 'rgba(40,90,170,.45)';
        g.beginPath(); g.moveTo(10, -8); g.quadraticCurveTo(52, -26, 76, -4); g.quadraticCurveTo(50, -8, 10, 10); g.closePath(); g.fill();
        g.fillStyle = 'rgba(236,250,255,.95)';
        g.beginPath(); g.moveTo(10, -6); g.quadraticCurveTo(50, -22, 72, -4); g.quadraticCurveTo(48, -6, 10, 7); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(160,215,255,.9)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(16, -3); g.quadraticCurveTo(44, -12, 64, -4); g.stroke();
        g.restore();
      }
      g.drawImage(ras[f], -30, -30, 60, 60);
      out.push(c);
    }
    return (ART.shu = out);
  }
  // White shadow-clone poof, 8 frames.
  function poofFrames() {
    if (ART.poof) return ART.poof;
    const S = SPR(), out = [];
    for (let f = 0; f < 8; f++) {
      const c = document.createElement('canvas'); c.width = 112; c.height = 112;
      const g = c.getContext('2d');
      if (S && S.drawSmoke) S.drawSmoke(g, 56, 70, (f + .5) / 8, 30);
      out.push(c);
    }
    return (ART.poof = out);
  }
  // Chakra-cloak flames round a clone: 4 frames of golden tongues, base at the feet.
  const GOLD_FLAME = [[1, '#b84e04'], [.84, '#ee8410'], [.66, '#ffb12a'], [.46, '#ffdf62'], [.25, '#fffbe2']];
  function auraFrames() {
    if (ART.aura) return ART.aura;
    const k = K(), out = [];
    for (let f = 0; f < 4; f++) {
      const c = document.createElement('canvas'); c.width = 88; c.height = 118;
      const g = c.getContext('2d');
      const tongues = [[44, 112, 34, 96, 0], [24, 104, 20, 70, -.2], [64, 104, 20, 70, .2], [34, 70, 16, 52, -.1], [56, 72, 16, 56, .15], [44, 46, 18, 46, 0]];
      tongues.forEach(([x, base, w, h, sh], i) => {
        const img = k.flame(f * 3 + i, GOLD_FLAME, 'kc');
        g.save(); g.translate(x, base); g.transform(1, 0, sh, 1, 0, 0);
        g.globalAlpha = .9; g.drawImage(img, -w / 2, -h * (114 / 128), w, h); g.restore();
      });
      out.push(c);
    }
    return (ART.aura = out);
  }
  // One texture atlas for everything a clone draws, so the GPU batches a hundred clones into a few
  // draws: 40 body cells (10 poses × 2 facings × 2 flame variants; cloak flames + the KCM sprite baked
  // together at 2× density, feet at (CW/2, CF) in clone units), the Rasengan / Bijū Rasengan /
  // Rasenshuriken frames and the white poof frames.
  const CW = 96, CH = 124, CF = 112, CD = 2, CELL_W = CW * CD, CELL_H = CH * CD;
  const POSES = ['run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'run6', 'run7', 'raise', 'attack'];
  const AT_W = CELL_W * 8, ORB_Y = CELL_H * 5, SHU_Y = ORB_Y + 192, POOF_Y = SHU_Y + 160, STREAK_Y = POOF_Y + 112, AT_H = STREAK_Y + 28;
  const AT = { c: null, g: null, baked: new Uint8Array(POSES.length * 4) };
  function atlas() {
    if (AT.c) return AT;
    const c = document.createElement('canvas'); c.width = AT_W; c.height = AT_H;
    const g = c.getContext('2d');
    rasFrames(0).forEach((f, i) => g.drawImage(f, i * 96, ORB_Y));
    rasFrames(2).forEach((f, i) => g.drawImage(f, i * 96, ORB_Y + 96));
    shurikenFrames().forEach((f, i) => g.drawImage(f, i * 160, SHU_Y));
    poofFrames().forEach((f, i) => g.drawImage(f, i * 112, POOF_Y));
    // Golden speed streak, head at the right end, tapering to the tail: dark halo, gold body, white core.
    g.save(); g.translate(0, STREAK_Y + 14);
    const streak = (w, col) => {
      const gr = g.createLinearGradient(0, 0, 192, 0);
      gr.addColorStop(0, col.replace('A', '0')); gr.addColorStop(.6, col.replace('A', '.55')); gr.addColorStop(1, col.replace('A', '1'));
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(120, -w * .8, 190, -w); g.arc(190, 0, w, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(120, w * .8, 0, 0); g.fill();
    };
    streak(12, 'rgba(110,46,0,A)'); streak(8.5, 'rgba(255,176,44,A)'); streak(5, 'rgba(255,226,120,A)'); streak(2, 'rgba(255,255,240,A)');
    g.restore();
    AT.c = c; AT.g = g;
    return AT;
  }
  // Atlas cell of a body pose; baked on first use.
  function cell(frame, facing, v) {
    const pi = POSES.indexOf(frame), idx = (pi < 0 ? 9 : pi) * 4 + (facing < 0 ? 2 : 0) + v;
    if (!AT.baked[idx]) {
      const g = atlas().g, cx = (idx & 7) * CELL_W, cy = (idx >> 3) * CELL_H;
      g.save(); g.translate(cx, cy); g.scale(CD, CD);
      g.beginPath(); g.rect(0, 0, CW, CH); g.clip();
      g.globalAlpha = .62; g.drawImage(auraFrames()[v], CW / 2 - 39, CF + 6 - 104, 78, 104);
      g.globalAlpha = 1;
      SPR().draw(g, 'naruto_kurama', CW / 2, CF + 3, { facing, frame: POSES[pi < 0 ? 9 : pi] });
      g.restore();
      AT.baked[idx] = 1;
    }
    return idx;
  }
  let compIdx = 0;
  function warmComp() {
    if (compIdx >= POSES.length * 4 || !SPR() || !K() || warmIdx < SPR().FRAMES.length * 2) return;
    const i = compIdx++;
    cell(POSES[i >> 2], i & 2 ? -1 : 1, i & 1);
  }
  function windSwirlS() {
    return K().swirl('kcWindS', ['rgba(255,255,255,.95)', 'rgba(170,225,255,.85)', 'rgba(90,170,255,.7)'], 6, 1.2, .12, 128, 4);
  }
  function scarSwirl() {
    return K().swirl('kcScar', ['rgba(70,44,22,.75)', 'rgba(40,26,14,.6)', 'rgba(110,80,50,.55)'], 6, 1.1, .12, 128, 4);
  }
  function windSwirl() {
    return K().swirl('kcWind', ['rgba(255,255,255,.95)', 'rgba(170,225,255,.85)', 'rgba(90,170,255,.7)'], 7, 1.3, .1, 256, 5);
  }
  function kuramaSwirl() {
    return K().swirl('kcFox', ['rgba(255,170,40,.9)', 'rgba(255,110,20,.8)', 'rgba(255,230,150,.9)'], 6, 1, .18, 256, 6);
  }

  // ------------------------------------------------------------------ view culling
  const VIEW = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
  function setView(ctx) {
    const m = ctx.getTransform ? ctx.getTransform() : null, c = ctx.canvas;
    if (!m || !c || !m.a || !m.d || m.b || m.c) { VIEW.x0 = VIEW.y0 = -1e9; VIEW.x1 = VIEW.y1 = 1e9; return; }
    const xa = -m.e / m.a, xb = (c.width - m.e) / m.a, ya = -m.f / m.d, yb = (c.height - m.f) / m.d;
    VIEW.x0 = Math.min(xa, xb); VIEW.x1 = Math.max(xa, xb); VIEW.y0 = Math.min(ya, yb); VIEW.y1 = Math.max(ya, yb);
  }
  const vis = (x, y, r) => x + r > VIEW.x0 && x - r < VIEW.x1 && y + r > VIEW.y0 && y - r < VIEW.y1;

  // ------------------------------------------------------------------ ground layer
  function ellRing(ctx, x, y, r, w, color, sq = .5) {
    if (!(r > 1)) return;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * sq, 0, 0, TAU); ctx.stroke();
  }

  function drawGround(ctx, st, p, time) {
    if (!st || !ctx || !K() || !SPR()) return;
    const C = st.clones, FX = st.fx, F = st.fin;
    if (!(C && C.length) && !(FX && FX.length) && !F) return;
    setView(ctx);
    const k = K(), S = SPR();
    ctx.save();
    // Chakra flare under Naruto as the hundred pop out.
    const T = st.t || 0;
    if (C && C.length && T < 1.6 && p) {
      const a = c01(1 - T / 1.6);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, st.ox, st.oy + 3, 320, '255,170,40', .4 * a, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        const q = c01(T / 1.1 - i * .12);
        if (q <= 0 || q >= 1) continue;
        ellRing(ctx, st.ox, st.oy + 3, 40 + q * 300, 7, `rgba(90,40,0,${.4 * (1 - q)})`, SQ);
        ctx.globalCompositeOperation = 'lighter';
        ellRing(ctx, st.ox, st.oy + 3, 40 + q * 300, 3, `rgba(255,210,90,${.85 * (1 - q)})`, SQ);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // Rasengan craters: a spiral gouge and cracks that fade out.
    if (FX && FX.length) {
      const sw = scarSwirl();
      for (const f of FX) {
        const [x, y, kind, t] = f;
        const R = (HIT_R[kind] || 88) * .8;
        if (!vis(x, y, R * 2)) continue;
        const a = c01((1.05 - t) / .5) * Math.min(1, t * 6);
        ctx.fillStyle = `rgba(40,26,12,${.32 * a})`;
        ctx.beginPath(); ctx.ellipse(x, y, R * .8 * easeOut(t * 4), R * .4 * easeOut(t * 4), 0, 0, TAU); ctx.fill();
        k.spin(ctx, sw, x, y, R * .85 * easeOut(t * 3), -t * 6 + x, .8 * a, .5);
        if (t < .5) {
          const q = t / .5;
          ellRing(ctx, x, y, R * (.5 + q * 1.3), 6 * (1 - q) + 1, `rgba(60,40,20,${.35 * (1 - q)})`);
        }
      }
    }
    // Clone shadows and golden ground scuffs for the chargers.
    if (C && C.length) {
      ctx.strokeStyle = 'rgba(120,64,10,.22)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const c of C) {
        if (c[3] !== 2 || !vis(c[0], c[1], 160)) continue;
        const L = Math.min(130, 30 + c[4] * 400);
        ctx.moveTo(c[0], c[1] + 3); ctx.lineTo(c[0] - Math.cos(c[2]) * L, c[1] + 3 - Math.sin(c[2]) * L);
      }
      ctx.stroke();
      // all shadows in one fill
      ctx.fillStyle = 'rgba(20,24,12,.28)';
      ctx.beginPath();
      for (const c of C) {
        if (c[3] === 0 || (c[3] === 3 && c[4] > .2) || !vis(c[0], c[1], 40)) continue;
        ctx.moveTo(c[0] + 13, c[1] + 4); ctx.ellipse(c[0], c[1] + 4, 13, 4.7, 0, 0, TAU);
      }
      ctx.fill();
      // Clones standing behind Naruto in the formation are drawn here, under the characters.
      if (p) drawClones(ctx, st, time, c => (c[3] === 1 || c[3] === 3 || c[3] === 5) && c[1] < p.y - 2);
    }
    if (F) drawFinGround(ctx, st, F, time);
    ctx.restore();
  }

  function drawFinGround(ctx, st, F, time) {
    const k = K(), t = F.t;
    // Gathering ring under the sixteen.
    if (t < FIN.combine + .3) {
      const a = c01(t / .3) * c01((FIN.combine + .3 - t) / .3);
      ctx.fillStyle = `rgba(80,36,0,${.2 * a})`;
      ctx.beginPath(); ctx.ellipse(F.x, F.y, 120, 66, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, F.x, F.y, 200, '255,160,40', .45 * a, false, .5);
      ellRing(ctx, F.x, F.y, 104 + Math.sin(time * 9) * 4, 3, `rgba(255,220,120,${.8 * a})`, .55);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Target telegraph: closing rings and the sphere's growing shadow.
    if (t >= FIN.gather - .2 && t < FIN.grind + .1) {
      const q = c01((t - FIN.gather + .2) / (FIN.fly - FIN.gather + .2));
      const R = 330;
      ctx.fillStyle = `rgba(60,20,0,${.14 + .16 * q})`;
      ctx.beginPath(); ctx.ellipse(F.tx, F.ty, R, R * .5, 0, 0, TAU); ctx.fill();
      ellRing(ctx, F.tx, F.ty, R, 7, `rgba(80,30,0,${.5})`);
      ctx.globalCompositeOperation = 'lighter';
      ellRing(ctx, F.tx, F.ty, R, 3, `rgba(255,200,90,${.6 + .3 * Math.sin(time * 14)})`);
      for (let i = 0; i < 3; i++) {
        const z = frac(time * 1.3 + i / 3);
        ellRing(ctx, F.tx, F.ty, R * (1 - z * .85), 2.5, `rgba(255,180,60,${.7 * z})`);
      }
      ctx.globalCompositeOperation = 'source-over';
      SPR().shadow(ctx, F.tx, F.ty, 60 + q * 90, .35);
    }
    // Grinding: the sphere bores a spiral crater; then the blast scorches a wide bowl.
    if (t >= FIN.fly) {
      const g = t - FIN.fly, sw = scarSwirl();
      const big = c01((t - FIN.grind) / .35), fade = c01((FIN.end + .1 - t) / .9);
      const R = 150 + big * 230;
      ctx.fillStyle = `rgba(36,22,10,${.42 * fade})`;
      ctx.beginPath(); ctx.ellipse(F.tx, F.ty, R * easeOut(g * 3), R * .5 * easeOut(g * 3), 0, 0, TAU); ctx.fill();
      k.spin(ctx, sw, F.tx, F.ty, R * .9, -g * 9, .9 * fade, .5);
      k.spin(ctx, sw, F.tx, F.ty, R * .55, g * 7, .7 * fade, .5);
      // radial cracks
      ctx.strokeStyle = `rgba(40,24,10,${.6 * fade})`; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU + hash(i) * .3, l = R * (.8 + hash(i * 3.1) * .7) * easeOut(g * 2.5);
        const mx = F.tx + Math.cos(a + .12) * l * .55, my = F.ty + Math.sin(a + .12) * l * .55 * .5;
        ctx.moveTo(F.tx + Math.cos(a) * R * .4, F.ty + Math.sin(a) * R * .2);
        ctx.lineTo(mx, my); ctx.lineTo(F.tx + Math.cos(a) * l, F.ty + Math.sin(a) * l * .5);
      }
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------------ clones
  const ORDER = [];
  function drawClones(ctx, st, time, filter) {
    const C = st.clones, S = SPR(), k = K(), lift = LIFT();
    ORDER.length = 0;
    for (const c of C) if (c[3] !== 0 && filter(c) && vis(c[0], c[1] - 40, 110)) ORDER.push(c);
    if (!ORDER.length) return;
    ORDER.sort((a, b) => a[1] - b[1]);
    const A = atlas().c;
    const tick = Math.floor(time * 30);
    // 1) streaks behind the chargers: dark under-stroke, then gold light, then a white core.
    let any = false;
    for (const c of ORDER) if (c[3] === 2) { any = true; break; }
    if (any) {
      // One rotated atlas quad per charger (batched by the GPU, unlike thick stroked paths).
      const m = ctx.getTransform();
      for (const c of ORDER) {
        if (c[3] !== 2) continue;
        const L = Math.min(160, 34 + c[4] * 480), ca = Math.cos(c[2]), sa = Math.sin(c[2]) * .8, n = Math.hypot(ca, sa) || 1;
        const cs = ca / n, sn = sa / n, hx = c[0] + ca * 10, hy = c[1] - lift - 6;
        ctx.setTransform(m.a * cs + m.c * sn, m.b * cs + m.d * sn, -m.a * sn + m.c * cs, -m.b * sn + m.d * cs, m.a * hx + m.c * hy + m.e, m.b * hx + m.d * hy + m.f);
        ctx.drawImage(A, 0, STREAK_Y, 192, 28, -L, -12, L + 12, 24);
      }
      ctx.setTransform(m);
    }
    // 2) chakra arm forming the Rasengan overhead (formed clones only).
    ctx.lineCap = 'round';
    ctx.beginPath();
    let arms = 0;
    for (const c of ORDER) {
      if ((c[3] !== 1 || c[4] < .14) && c[3] !== 5) continue;
      const f = Math.cos(c[2]) >= 0 ? 1 : -1, x = c[0], y = c[1];
      ctx.moveTo(x - f * 4, y - 40); ctx.quadraticCurveTo(x - f * 20, y - 70, x + f * 2, y - 88); arms++;
    }
    if (arms) {
      ctx.strokeStyle = 'rgba(120,40,0,.4)'; ctx.lineWidth = 8; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,160,40,.75)'; ctx.lineWidth = 4.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,180,.8)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // 3) bodies: one baked image each (cloak flames + the KCM sprite).
    const flick = Math.floor(time * 10);
    for (const c of ORDER) {
      const m = c[3], x = c[0], y = c[1], s = c[6], f = Math.cos(c[2]) >= 0 ? 1 : -1;
      if (m === 3 && c[4] > .16) continue;
      const pop = m === 1 && c[4] < .16 ? .82 + c[4] / .16 * .18 : 1;
      const frame = m === 2 || m === 4 ? 'run' + (Math.floor((time * 11 + s * .37) * 2) & 7) : m === 5 || (m === 1 && c[4] < FORM + .2) ? 'raise' : 'attack';
      const idx = cell(frame, f, (flick + s) & 1);
      if (m === 3) ctx.globalAlpha = 1 - c[4] / .16;
      ctx.drawImage(A, (idx & 7) * CELL_W, (idx >> 3) * CELL_H, CELL_W, CELL_H, x - CW / 2 * pop, y - CF * pop, CW * pop, CH * pop);
      if (m === 3) ctx.globalAlpha = 1;
    }
    // 4) spheres (their halo is baked in).
    for (const c of ORDER) {
      const m = c[3];
      if (m === 3 && c[4] > .05) continue;
      let ox, oy, r;
      const f = Math.cos(c[2]) >= 0 ? 1 : -1;
      if (m === 1 || m === 5) {
        const g = m === 5 ? 1 - c01(c[4] / 1.1) * .5 : easeOut((c[4] - .14) / FORM);
        if (g <= .02) continue;
        r = 15 * g; ox = c[0] + f * 2; oy = c[1] - 90 - r * .3;
      } else if (m === 2 || m === 4) {
        r = 16; ox = c[0] + Math.cos(c[2]) * 22; oy = c[1] - lift - 8 + Math.sin(c[2]) * 8;
      } else { r = 16; ox = c[0] + f * 16; oy = c[1] - lift - 6; }
      const kind = c[5], fi = (tick + c[6]) & 7;
      if (kind === 1) ctx.drawImage(A, fi * 160, SHU_Y, 160, 160, ox - r * 2.67, oy - r * 2.67, r * 5.33, r * 5.33);
      else ctx.drawImage(A, fi * 96, kind === 2 ? ORB_Y + 96 : ORB_Y, 96, 96, ox - r * 1.6, oy - r * 1.6, r * 3.2, r * 3.2);
    }
    // 5) white poofs (pop in and vanish).
    for (const c of ORDER) {
      let q = -1;
      if (c[3] === 1 && c[4] < .45) q = c[4] / .45; else if (c[3] === 3) q = c[4] / .42;
      if (q < 0 || q >= 1) continue;
      ctx.drawImage(A, Math.min(7, Math.floor(q * 8)) * 112, POOF_Y, 112, 112, c[0] - 46, c[1] - 76, 92, 92);
    }
  }

  // ------------------------------------------------------------------ impacts (overlay)
  function drawImpact(ctx, f, time, heavy) {
    const k = K(), [x, y, kind, t] = f, lift = LIFT();
    if (t > .75) return;
    const R = HIT_R[kind] || 88, sh = kind === 2 ? '255,140,40' : '90,170,255';
    // grinding sphere sinking into the ground
    if (t < .26) {
      const q = t / .26, r = 22 + q * 26, cy = y - lift * (1 - q) - 6;
      const fr = (kind === 2 ? rasFrames(2) : rasFrames(0))[Math.floor(time * 30 + x) & 7];
      ctx.drawImage(fr, x - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, x, cy, r * 2.4, sh, .6, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    // wind dome bursting out
    if (t > .12) {
      const q = c01((t - .12) / .6), e = easeOut(q), a = 1 - q;
      const D = R * (kind === 1 ? 1.35 : 1.05) * (.35 + e * .8);
      if (kind === 1) {
        // Rasenshuriken: a white dome of wind needles.
        ctx.fillStyle = `rgba(225,245,255,${.5 * a})`;
        ctx.beginPath(); ctx.ellipse(x, y - D * .25, D, D * .7, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(60,110,190,${.5 * a})`; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 26; i++) {
          const an = hash(i * 1.7 + Math.floor(time * 24)) * TAU, d0 = D * hash(i * 2.3) * .7, l = D * .3;
          const px = x + Math.cos(an) * d0, py = y - D * .25 + Math.sin(an) * d0 * .7;
          ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(an + 1.3) * l, py + Math.sin(an + 1.3) * l * .7);
        }
        ctx.stroke();
      }
      ellRing(ctx, x, y, D, 7 * a + 1, `rgba(30,60,120,${.35 * a})`);
      ctx.globalCompositeOperation = 'lighter';
      if (heavy) k.glow(ctx, x, y - 8, D * 1.1, sh, .4 * a, false, .6);
      ellRing(ctx, x, y, D, 3.5 * a + .5, `rgba(235,250,255,${.9 * a})`);
      ctx.globalCompositeOperation = 'source-over';
      // spiral wind
      if (q < .55) k.spin(ctx, windSwirlS(), x, y - 6, D * .8, time * 14 + x, .75 * a, .5);
      // debris arcs
      ctx.fillStyle = `rgba(92,70,48,${a})`;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const an = hash(x + i * 3.3) * TAU, sp = .6 + hash(y + i) * .6, d = D * 1.1 * e * sp;
        const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5 - bell(q) * 46 * sp, s2 = 2.5 + hash(i * 7.1) * 3.5;
        ctx.rect(px - s2 / 2, py - s2 / 2, s2, s2);
      }
      ctx.fill();
    }
    if (t < .4 && heavy) {
      const q = t / .4;
      k.stamp(ctx, k.puff('dust'), x - R * .5 * q, y - 8 - q * 14, 16 + q * 26, .55 * (1 - q), .6);
      k.stamp(ctx, k.puff('dust'), x + R * .5 * q, y - 4 - q * 10, 14 + q * 24, .5 * (1 - q), .6);
    }
  }

  // ------------------------------------------------------------------ finisher (overlay)
  function finOrb(F) {
    const t = F.t, lift = 74;
    if (t < FIN.combine) {
      const r = 12 + FIN.R * easeOut((t - FIN.gather + .1) / (FIN.combine - FIN.gather));
      return { x: F.x, y: F.y - lift - r * .4, r: Math.max(0, r) };
    }
    if (t < FIN.fly) {
      const q = easeIn((t - FIN.combine) / (FIN.fly - FIN.combine));
      const x = lerp(F.x, F.tx, q), y = lerp(F.y - lift - FIN.R * .4, F.ty - 40, q) - bell(q) * 90;
      return { x, y, r: FIN.R * (1 + q * .15) };
    }
    if (t < FIN.grind) {
      const q = (t - FIN.fly) / (FIN.grind - FIN.fly);
      return { x: F.tx, y: F.ty - 40 + q * 22, r: FIN.R * (1.15 + q * .35) };
    }
    return null;
  }
  function drawFinOverlay(ctx, st, F, time) {
    const k = K(), t = F.t;
    const o = finOrb(F);
    // Streams from the sixteen spheres pouring into the centre.
    if (t >= FIN.gather - .1 && t < FIN.combine && o) {
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < FIN_COUNT; i++) {
        const a = i / FIN_COUNT * TAU + .3, sx = F.x + Math.cos(a) * 92, sy = F.y + Math.sin(a) * 92 * .55 - 90;
        const w = Math.sin(time * 10 + i) * 14;
        ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + o.x) / 2 + w, (sy + o.y) / 2 - 30, o.x, o.y);
      }
      ctx.strokeStyle = 'rgba(20,60,140,.35)'; ctx.lineWidth = 9; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(120,200,255,.6)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (o && o.r > 4) drawGiantRasengan(ctx, o.x, o.y, o.r, time, t);
    // Blast: a towering wind dome, shock rings, flying rubble, dust wall.
    if (t >= FIN.grind) {
      const g = t - FIN.grind, q = c01(g / (FIN.end - FIN.grind)), e = easeOut(g / .7), a = 1 - smooth(q);
      const D = 140 + e * 400;
      ctx.fillStyle = `rgba(210,240,255,${.55 * a})`;
      ctx.beginPath(); ctx.ellipse(F.tx, F.ty - D * .3, D, D * .78, 0, 0, TAU); ctx.fill();
      ellRing(ctx, F.tx, F.ty, D * 1.05, 14 * a + 2, `rgba(30,60,120,${.4 * a})`);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, F.tx, F.ty - D * .3, D * 1.5, '110,190,255', .7 * a, true, .8);
      k.glow(ctx, F.tx, F.ty - D * .2, D * 1.1, '255,170,50', .45 * a, false, .7);
      for (let i = 0; i < 3; i++) {
        const z = c01(g / .9 - i * .18);
        if (z <= 0 || z >= 1) continue;
        ellRing(ctx, F.tx, F.ty, 120 + z * 620, 6 * (1 - z) + 1, `rgba(240,250,255,${.9 * (1 - z)})`);
      }
      ctx.globalCompositeOperation = 'source-over';
      k.spin(ctx, windSwirl(), F.tx, F.ty - D * .3, D * .95, time * 10, .75 * a, .78);
      k.spin(ctx, kuramaSwirl(), F.tx, F.ty - D * .3, D * .6, -time * 8, .5 * a, .78);
      // rubble
      ctx.fillStyle = `rgba(86,64,44,${a})`;
      ctx.beginPath();
      for (let i = 0; i < 30; i++) {
        const an = hash(i * 3.3) * TAU, sp = .5 + hash(i * 1.9) * .8, d = (120 + 520 * easeOut(g / 1.1)) * sp;
        const px = F.tx + Math.cos(an) * d, py = F.ty + Math.sin(an) * d * .5 - bell(c01(g / 1.1)) * 160 * sp, s2 = 4 + hash(i * 7.1) * 8;
        ctx.rect(px - s2 / 2, py - s2 / 2, s2, s2 * .8);
      }
      ctx.fill();
      // dust wall rolling out
      const dust = k.puff('dust');
      for (let i = 0; i < 12; i++) {
        const an = i / 12 * TAU + hash(i) * .4, d = 160 + 420 * easeOut(g / 1.2);
        k.stamp(ctx, dust, F.tx + Math.cos(an) * d, F.ty + Math.sin(an) * d * .5 - 20, 50 + g * 40, .6 * a, .62);
      }
    }
  }
  function drawGiantRasengan(ctx, x, y, r, time, t) {
    const k = K();
    // Kurama's chakra cloak wrapped round the sphere (Bijū Rasengan look), dark rim first.
    ctx.fillStyle = 'rgba(40,14,0,.32)';
    ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, x, y, r * 2.1, '255,150,30', .6);
    ctx.globalCompositeOperation = 'source-over';
    k.spin(ctx, kuramaSwirl(), x, y, r * 1.3, -time * 5, .9);
    // flame tongues licking off the cloak
    ctx.fillStyle = 'rgba(255,150,30,.75)';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + time * 1.5, l = r * (1.32 + .22 * Math.sin(time * 9 + i * 2.1));
      const a0 = a - .16, a1 = a + .16;
      ctx.moveTo(x + Math.cos(a0) * r * 1.1, y + Math.sin(a0) * r * 1.1);
      ctx.quadraticCurveTo(x + Math.cos(a - .25) * l * .95, y + Math.sin(a - .25) * l * .95, x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.quadraticCurveTo(x + Math.cos(a + .2) * l * .9, y + Math.sin(a + .2) * l * .9, x + Math.cos(a1) * r * 1.1, y + Math.sin(a1) * r * 1.1);
    }
    ctx.fill();
    // the Rasengan itself
    const fr = rasFrames(0)[Math.floor(time * 30) & 7];
    ctx.drawImage(fr, x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
    k.spin(ctx, windSwirl(), x, y, r * .98, time * 13, .8);
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, x, y, r * 1.9, '70,160,255', .6);
    k.glow(ctx, x, y, r * .7, '220,245,255', .85, true);
    // orbiting wind rings
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(200,240,255,${.55 - i * .12})`; ctx.lineWidth = 3 - i * .6;
      ctx.beginPath(); ctx.ellipse(x, y, r * (1.08 + i * .14), r * (.36 + i * .08), time * (1.6 + i) + i, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ labels
  function drawText(ctx, text, x, y, a, fill, stroke) {
    ctx.save();
    ctx.globalAlpha = c01(a);
    ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3.4; ctx.strokeStyle = stroke; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
    ctx.restore();
  }
  function drawLabels(ctx, st, p) {
    if (!p) return;
    const top = p.y + 3 - (SPR() ? SPR().height('naruto') : 70) - 26;
    if (st.lbl && NAMES[st.lbl[0]]) {
      const age = st.lbl[1];
      const a = Math.min(1, (1.8 - age) / .35) * Math.min(1, age / .08 + .3);
      drawText(ctx, NAMES[st.lbl[0]], p.x, top - age * 4, a, '#ffe08a', '#3a1600');
    } else if (st.cs > 0 && st.cd > 0) {
      drawText(ctx, `100 PHÂN THÂN · ${Math.ceil(st.cd)}s`, p.x, top, Math.min(1, st.cs / .3), '#ffd9a0', '#2a1206');
    }
  }

  function drawOverlay(ctx, st, p, time) {
    if (!st || !ctx || !K() || !SPR()) return;
    const C = st.clones, FX = st.fx, F = st.fin;
    const busy = (C && C.length) || (FX && FX.length) || F;
    if (!busy) { if (st.cs > 0) drawLabels(ctx, st, p); return; }
    setView(ctx);
    ctx.save();
    // Only the ten newest impacts get the extra glow and dust (dozens can overlap at once).
    if (FX && FX.length) for (let i = 0; i < FX.length; i++) { const f = FX[i]; if (vis(f[0], f[1], 200)) drawImpact(ctx, f, time, i >= FX.length - 10); }
    if (C && C.length) drawClones(ctx, st, time, c => !(p && (c[3] === 1 || c[3] === 3 || c[3] === 5) && c[1] < p.y - 2));
    if (F && vis((F.x + F.tx) / 2, (F.y + F.ty) / 2, Math.hypot(F.tx - F.x, F.ty - F.y) / 2 + 700)) drawFinOverlay(ctx, st, F, time);
    ctx.restore();
    drawLabels(ctx, st, p);
  }

  window.KuramaClones = { cast, update, drawGround, drawOverlay };
})();
