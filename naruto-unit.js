/* AI Naruto units for the team battle mode (faction 'naruto', member 'naruto').
 * Same contract as the other boss modules: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
 * telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above the characters, moves(z) lists the
 * eight moves for manual control (keys 1..8, ultimate last). Every bit of per-unit state lives on z.nu; nothing
 * here touches the hero's skill state: the Rasengan / Rasen Shuriken / fireball / Tailed Beast Ball painters of
 * skill-vfx.js are driven through window.NinjaVFX with this unit's own effect lists (z.nu.vfx).
 *
 * Moves: Rasengan dash, Rasen Shuriken throw, multi shadow-clone rush, Odama Rasengan leap, Katon Gōka Mekkyaku
 * (sea of fire), Kurama chakra-cloak burst with chakra arms, Sage Mode frog kumite blitz, and the Tailed Beast
 * Ball in the Kurama cloak (ultimate). The body is the 'naruto' sprite; in the cloak the gold 'naruto_kurama'
 * look is painted over it. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const ID = 'naruto';

  const members = {
    [ID]: { name: 'UZUMAKI NARUTO', accent: '#ff8a1a', hpScale: 3.2, damageScale: 1.8 }
  };
  const order = [ID];
  const pick = () => ID;

  // windup = dodge window before the jutsu lands (s); busy = how long the move keeps running after it lands;
  // after = AI pause before the next one.
  const MOVES = {
    rasengan: { label: 'RASENGAN', rgb: '90,180,255', windup: .75, busy: .45, after: 1.2 },
    shuriken: { label: 'PHONG ĐỘN · RASEN SHURIKEN', rgb: '120,205,255', windup: 1.0, busy: .45, after: 1.4 },
    clones:   { label: 'ĐA TRỌNG ẢNH PHÂN THÂN THUẬT', rgb: '255,170,70', windup: .8, busy: 1.25, after: 1.5 },
    odama:    { label: 'ĐẠI NGỌC RASENGAN', rgb: '110,190,255', windup: .9, busy: .2, after: 1.5 },
    katon:    { label: 'HỎA ĐỘN · HÀO HỎA DIỆT KHƯỚC', rgb: '255,120,40', windup: .9, busy: .7, after: 1.5 },
    kurama:   { label: 'CỬU VĨ CHAKRA · BỘC PHÁT', rgb: '255,180,40', windup: .9, busy: 1.15, after: 1.4 },
    sage:     { label: 'TIÊN NHÂN THUẬT · OA KUMITE', rgb: '255,140,60', windup: .7, busy: 1.35, after: 1.4 },
    tbb:      { label: 'VĨ THÚ NGỌC', rgb: '190,110,255', windup: 1.7, busy: .9, after: 2.0 }
  };
  const KEYS = ['rasengan', 'shuriken', 'clones', 'odama', 'katon', 'kurama', 'sage', 'tbb'];
  const CYCLE = ['rasengan', 'clones', 'shuriken', 'katon', 'sage', 'odama', 'kurama', 'tbb'];
  const moveList = KEYS.map(k => ({ id: k, label: MOVES[k].label }));
  const moves = () => moveList;

  function state(z) {
    // Each unit starts at a random point of the cycle so a squad of Narutos doesn't cast in lockstep.
    return z.nu || (z.nu = { t: 0, casts: Math.floor(Math.random() * 7), timer: rand(.9, 2.6), move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y, tele: [], ev: [], fx: [],
      dash: null, leap: null, clones: [], helper: null, cloak: 0, cloakT: 0, sage: 0, sageT: 0, hold: 0, busyT: 0, seed: 0, lastDraw: 0,
      wasManual: false, ghosts: [],
      vfx: { elapsed: 0, fireballs: [], explosions: [], vortices: [], rasenShurikens: [], beastBombs: [] } });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const VFX_CAP = { fireballs: 6, explosions: 14, vortices: 4, rasenShurikens: 3, beastBombs: 2 };
  function addVfx(st, list, e) {
    const arr = st.vfx[list];
    if (arr.length >= VFX_CAP[list]) arr.shift();
    e.maxLife = e.life;
    arr.push(e);
    return e;
  }
  const later = (st, t, fn) => { if (st.ev.length < 200) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = () => (Spr() && Spr().height ? Spr().height(ID) : 80);
  const liftOf = z => (z.nu && z.nu.leap ? bell(z.nu.leap.t / z.nu.leap.dur) * z.nu.leap.h : 0);

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
  // A victim for a move in manual mode: the hostile unit nearest the aim point, else the point itself.
  function victimNear(api, x, y, r) {
    const f = api.nearestFoe ? api.nearestFoe(x, y, r) : null;
    return f && Number.isFinite(f.x) ? f : null;
  }
  function targetPoint(z, st, api) {
    const p = api.player;
    if (z.manual) { const f = victimNear(api, st.tx, st.ty, 220); return f ? { x: f.x, y: f.y } : { x: st.tx, y: st.ty }; }
    return p && Number.isFinite(p.x) ? { x: p.x, y: p.y } : { x: st.tx, y: st.ty };
  }

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const line = (len, w) => ({ k: 'line', x, y, a, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    const d = Math.hypot(tx - x, ty - y);
    switch (move) {
      case 'rasengan': {
        const len = Math.max(300, Math.min(640, d + 60));
        st.len = len;
        return [line(len, 58), circ(x + ca * len, y + sa * len, 175)];
      }
      case 'shuriken': {
        const len = Math.max(380, Math.min(950, d));
        st.len = len;
        return [line(len, 40), circ(x + ca * len, y + sa * len, 270)];
      }
      case 'clones': {
        const k = Math.min(1, 620 / Math.max(1, d));
        st.cx = x + (tx - x) * k; st.cy = y + (ty - y) * k;
        return [circ(st.cx, st.cy, 230), circ(x, y, 120, true)];
      }
      case 'odama': {
        const k = Math.min(1, 560 / Math.max(1, d));
        st.cx = x + (tx - x) * k; st.cy = y + (ty - y) * k;
        return [circ(st.cx, st.cy, 300), circ(st.cx, st.cy, 150, true)];
      }
      case 'katon': return [{ k: 'cone', x, y, a, r: 720, h: .42 }];
      case 'kurama': return [circ(x, y, 360), circ(tx, ty, 190, true)];
      case 'sage': {
        const k = Math.min(1, 600 / Math.max(1, d));
        st.cx = x + (tx - x) * k; st.cy = y + (ty - y) * k;
        return [circ(st.cx, st.cy, 230)];
      }
      case 'tbb': {
        const len = Math.max(500, Math.min(1100, d));
        st.len = len;
        return [line(len, 86), circ(x + ca * len, y + sa * len, 430)];
      }
    }
    return [];
  }

  function announce(z, st, api, move) {
    st.casts++;
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = p && Number.isFinite(p.x) ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
    st.tx = p && Number.isFinite(p.x) ? p.x : z.x + Math.cos(st.aim) * 300;
    st.ty = p && Number.isFinite(p.y) ? p.y : z.y + Math.sin(st.aim) * 300;
    st.seed = Math.random() * 99;
    st.tele = teleFor(z, st, move);
    if (move === 'tbb') st.cloakT = Math.max(st.cloakT, def.windup + 2.6);
    if (move === 'kurama') st.cloakT = Math.max(st.cloakT, def.windup + .2);
    if (move === 'sage') { st.sageT = Math.max(st.sageT, def.windup + 2.2); st.cloakT = 0; }
    if (move === 'odama') st.helper = { x: z.x - facingOf(z) * 34, y: z.y + 6, t: 0 };
  }

  // Naruto rushes in a straight line: houses on the way are smashed, walls stop him.
  function startDash(z, st, a, len, dur, dmg, w, end) {
    st.dash = { a, speed: len / dur, left: dur, hit: 0, wt: 0, w, dmg, end };
    addFx(st, { kind: 'dash', pts: [], a, dur: dur + .5, seed: Math.random() * 99, x0: z.x, y0: z.y, x1: z.x, y1: z.y, live: dur });
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, api) {
    const move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), seed = st.seed;
    st.busyT = MOVES[move].busy;
    switch (move) {
      case 'rasengan': {
        startDash(z, st, a, st.len, .32, D * 1.5, 56, api => {
          const ex = z.x + ca * 30, ey = z.y + sa * 30;
          api.strike(ex, ey, 175, D * 2.6, null, 'vortex', true);
          api.knockback({ x: ex, y: ey }, 200, 210, 0);
          api.world(ex, ey, 150, D * 2.6, 'vortex', a);
          api.shake(12); api.burst(ex, ey - 20, '#9fdcff', 14);
          addVfx(st, 'vortices', { x: ex, y: ey, radius: 175, life: .95 });
          addVfx(st, 'explosions', { x: ex, y: ey, radius: 175, life: .8, kind: 'vortex' });
          addFx(st, { kind: 'impact', x: ex, y: ey, r: 190, dur: 1.4, seed, rgb: '90,180,255' });
        });
        break;
      }
      case 'shuriken': {
        const len = st.len, sp = 1150, fl = len / sp, x0 = z.x + ca * 30, y0 = z.y + sa * 14;
        addVfx(st, 'rasenShurikens', { x: x0, y: y0, vx: ca * sp, vy: sa * sp, r: 30, angle: a, life: fl });
        for (let d = 0; d < len; d += 190) later(st, d / sp, api => api.line(x0 + ca * d, y0 + sa * d, x0 + ca * Math.min(len, d + 190), y0 + sa * Math.min(len, d + 190), 40, D * .8, null));
        later(st, fl, api => {
          const ex = x0 + ca * len, ey = y0 + sa * len;
          addVfx(st, 'explosions', { x: ex, y: ey, radius: 270, life: 1.5, kind: 'shuriken' });
          addFx(st, { kind: 'needles', x: ex, y: ey, r: 270, dur: 1.6, seed });
          api.world(ex, ey, 240, D * 3, 'shockwave');
          api.shake(16);
          // the wind needles shred everything inside the dome, then it collapses
          for (let i = 0; i < 5; i++) later(st, i * .2, api => api.strike(ex, ey, 270, D * .9, null, null, true));
          later(st, 1.05, api => { api.strike(ex, ey, 300, D * 1.8, null, 'crater', true); api.shake(12); });
        });
        api.burst(z.x, z.y - 40, '#c8eeff', 10);
        break;
      }
      case 'clones': {
        const cx = st.cx, cy = st.cy, n = 6, b = Math.random() * TAU;
        st.clones.length = 0;
        for (let i = 0; i < n; i++) {
          const sa0 = b + i * TAU / n, sx = z.x + Math.cos(sa0) * 70, sy = z.y + Math.sin(sa0) * 46;
          st.clones.push({ x: sx, y: sy, x0: sx, y0: sy, x1: cx, y1: cy, t: -i * .05, i, ang: 0, seed: seed + i * 7.7, hit: false, final: false });
        }
        // they launch at the target's position when they leave
        later(st, .3, api => {
          const p = targetPoint(z, st, api), k = Math.min(1, 700 / Math.max(1, Math.hypot(p.x - z.x, p.y - z.y)));
          const tx = z.x + (p.x - z.x) * k, ty = z.y + (p.y - z.y) * k;
          st.clones.forEach((c, i) => {
            const oa = b + i * TAU / n, r = i === 0 ? 0 : 70;
            c.x1 = tx + Math.cos(oa) * r; c.y1 = ty + Math.sin(oa) * r * .6; c.x0 = c.x; c.y0 = c.y;
          });
        });
        api.burst(z.x, z.y - 20, '#ffffff', 10);
        break;
      }
      case 'odama': {
        st.leap = { x0: z.x, y0: z.y, x1: st.cx, y1: st.cy, t: 0, dur: .62, h: 150, a: Math.atan2(st.cy - z.y, st.cx - z.x) };
        if (st.helper) st.helper.leave = true;
        break;
      }
      case 'katon': {
        const ox = z.x + ca * 22, oy = z.y + sa * 10, R = 720, H = .42;
        conePts(ox, oy, a, R, H).forEach(p => later(st, .05 + p.d / 1300, api => api.strike(p.x, p.y, p.r, D * 1.7, null, null, true)));
        const pts = [];
        for (let d = 90; d <= R; d += 62) {
          const cnt = Math.max(1, Math.round(2 * H * d / 95));
          for (let i = 0; i < cnt; i++) {
            const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * H * .92) + (hash(d + i * 3.1 + seed) - .5) * .05;
            const dd = d + (hash(i * 7.3 + d + seed) - .5) * 40;
            pts.push({ x: ox + Math.cos(aa) * dd, y: oy + Math.sin(aa) * dd, t0: .05 + dd / 1300, s: 34 + hash(i + d * .1 + seed) * 30 + dd * .03, v: (i + d) % 6 });
            if (pts.length >= 44) break;
          }
          if (pts.length >= 44) break;
        }
        const sea = addFx(st, { kind: 'fireSea', x: ox, y: oy, a, r: R, h: H, pts, dur: 3.6, tick: 1.0, seed });
        sea.upd = (fx, dt, api) => {
          if (fx.age > .9 && fx.age < 3.1 && (fx.tick -= dt) <= 0) {
            fx.tick = .5;
            for (let i = 0; i < fx.pts.length; i += 4) api.strike(fx.pts[i].x, fx.pts[i].y, 75, D * .3, null, null, true);
          }
        };
        for (const off of [-.24, 0, .24]) {
          const sp = 980, life = .66;
          addVfx(st, 'fireballs', { x: ox, y: oy, vx: Math.cos(a + off) * sp, vy: Math.sin(a + off) * sp, r: off ? 22 : 30, angle: a + off, life });
          later(st, life, api => {
            const ex = ox + Math.cos(a + off) * sp * life, ey = oy + Math.sin(a + off) * sp * life;
            addVfx(st, 'explosions', { x: ex, y: ey, radius: off ? 140 : 190, life: .9, kind: 'fire' });
            api.world(ex, ey, off ? 130 : 170, D * 2.6, 'fire');
            api.shake(9);
          });
        }
        later(st, .35, api => api.world(ox + ca * 300, oy + sa * 300, 150, D * 2.2, 'fire', a));
        api.shake(8);
        st.hold = .7;
        break;
      }
      case 'kurama': {
        st.cloakT = Math.max(st.cloakT, 7.5);
        api.strike(z.x, z.y, 360, D * 2.2, null, 'shockwave', true);
        api.knockback(z, 380, 280, 0);
        api.world(z.x, z.y, 260, D * 2.4, 'shockwave');
        api.shake(18); api.burst(z.x, z.y - 30, '#ffd060', 18);
        addFx(st, { kind: 'burst', x: z.x, y: z.y, r: 380, dur: 1.5, seed });
        // three chakra arms lunge out and slam the target
        for (let i = 0; i < 3; i++) later(st, .2 + i * .3, api => {
          const p = targetPoint(z, st, api), oa = seed + i * 2.1;
          const off = i === 1 ? 0 : 80 + hash(oa) * 60, an = hash(oa * 3) * TAU;
          let tx = p.x + Math.cos(an) * off, ty = p.y + Math.sin(an) * off * .6;
          const d = Math.hypot(tx - z.x, ty - z.y), m = Math.min(1, 640 / Math.max(1, d));
          tx = z.x + (tx - z.x) * m; ty = z.y + (ty - z.y) * m;
          const side = i % 2 ? 1 : -1;
          addFx(st, { kind: 'arm', x1: tx, y1: ty, side, dur: .9, seed: seed + i * 5, hitAt: .2 });
          later(st, .2, api => {
            api.strike(tx, ty, 175, D * 2.0, null, 'crater', true);
            api.shake(11); api.burst(tx, ty - 10, '#ffc040', 10);
            addFx(st, { kind: 'impact', x: tx, y: ty, r: 180, dur: 1.2, seed: seed + i * 9, rgb: '255,170,40' });
          });
        });
        break;
      }
      case 'sage': {
        st.sageT = Math.max(st.sageT, 2.4);
        const x0 = z.x, y0 = z.y;
        for (let i = 0; i < 4; i++) later(st, i * .28, api => {
          const p = i === 0 ? { x: st.cx, y: st.cy } : targetPoint(z, st, api);
          // never wander more than ~650 px from where the blitz began
          let px = p.x, py = p.y;
          const dd = Math.hypot(px - x0, py - y0), m = Math.min(1, 650 / Math.max(1, dd));
          px = x0 + (px - x0) * m; py = y0 + (py - y0) * m;
          const oa = (i * 2.3 + seed) % TAU, nx = px + Math.cos(oa) * 62, ny = py + Math.sin(oa) * 40;
          st.ghosts.push({ x: z.x, y: z.y, fac: facingOf(z), t: 0 }); if (st.ghosts.length > 5) st.ghosts.shift();
          if (!api.blocked(nx, ny, z.r)) { z.x = nx; z.y = ny; }
          z.angle = Math.atan2(py - z.y, px - z.x);
          const last = i === 3, r = last ? 230 : 150;
          api.strike(px, py, r, D * (last ? 2.5 : 1.45), null, last ? 'crater' : 'shockwave', true);
          if (last) api.knockback({ x: px, y: py }, 240, 260, 0);
          api.shake(last ? 16 : 8); api.burst(px, py - 20, '#ffb060', last ? 16 : 8);
          addFx(st, { kind: 'kumite', x: px, y: py, r, a: z.angle, last, dur: last ? 1.3 : .8, seed: seed + i * 3 });
        });
        st.hold = 1.2;
        break;
      }
      case 'tbb': {
        st.cloakT = Math.max(st.cloakT, 2.6);
        const len = st.len, sp = 1700, fl = len / sp, x0 = z.x + ca * 46, y0 = z.y + sa * 22;
        addVfx(st, 'beastBombs', { x: x0, y: y0, vx: ca * sp, vy: sa * sp, r: 34, angle: a, life: fl });
        for (let d = 0; d < len; d += 220) later(st, d / sp, api => api.line(x0 + ca * d, y0 + sa * d, x0 + ca * Math.min(len, d + 220), y0 + sa * Math.min(len, d + 220), 86, D * 2.2, d % 440 === 0 ? 'crater' : null));
        later(st, fl, api => {
          const ex = x0 + ca * len, ey = y0 + sa * len;
          api.strike(ex, ey, 430, D * 5, null, 'crater', true);
          api.world(ex, ey, 380, D * 4.5, 'crater');
          later(st, .25, api => { api.strike(ex, ey, 470, D * 1.4, null, null, true); api.world(ex + 160, ey, 200, D * 3, 'crater'); api.world(ex - 160, ey, 200, D * 3, 'crater'); });
          api.shake(30);
          addVfx(st, 'explosions', { x: ex, y: ey, radius: 430, life: 1.9, kind: 'beast' });
          addFx(st, { kind: 'tbbBlast', x: ex, y: ey, r: 430, dur: 2.4, seed });
        });
        api.knockback(z, 160, 120, 0);
        api.shake(14);
        st.hold = .6;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ update
  function ageVfx(st, dt) {
    const V = st.vfx;
    for (const name in VFX_CAP) {
      const arr = V[name];
      for (let i = arr.length - 1; i >= 0; i--) {
        const e = arr[i];
        e.life -= dt;
        if (e.vx) { e.x += e.vx * dt; e.y += e.vy * dt; }
        if (e.life <= 0) arr.splice(i, 1);
      }
    }
  }
  function updateClones(z, st, dt, api) {
    const D = api.damage || 60;
    for (let i = st.clones.length - 1; i >= 0; i--) {
      const c = st.clones[i];
      c.t += dt;
      const t = c.t;
      if (t < .3) { c.ang = Math.atan2(c.y1 - c.y, c.x1 - c.x); continue; }
      if (t < .64) {
        const k = easeInOut((t - .3) / .34);
        c.x = c.x0 + (c.x1 - c.x0) * k; c.y = c.y0 + (c.y1 - c.y0) * k;
        c.ang = Math.atan2(c.y1 - c.y0, c.x1 - c.x0);
        continue;
      }
      if (!c.hit && z.health > 0) {
        c.hit = true;
        api.strike(c.x1, c.y1, c.i === 0 ? 150 : 115, D * (c.i === 0 ? 1.9 : 1.2), null, c.i % 3 ? null : 'vortex', true);
        addVfx(st, 'explosions', { x: c.x1, y: c.y1, radius: c.i === 0 ? 150 : 100, life: .6, kind: 'vortex' });
        if (c.i === 0) { api.shake(12); api.world(c.x1, c.y1, 140, D * 2.4, 'vortex'); }
        else api.shake(5);
      }
      if (t > 1.25) st.clones.splice(i, 1);
    }
  }

  function update(z, dt, api) {
    if (!members[z.bossId]) return;
    const st = state(z);
    st.t += dt;
    ageVfx(st, dt);
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    for (let i = st.ghosts.length - 1; i >= 0; i--) if ((st.ghosts[i].t += dt) > .45) st.ghosts.splice(i, 1);
    if (z.health <= 0) {
      z.bossWindup = 0; z.kageDash = 0; z.manualBusy = false; z.manualCast = null;
      st.dash = null; st.leap = null; st.ev.length = 0; st.windup = 0; st.move = ''; st.helper = null;
      st.cloakT = st.sageT = 0;
      for (const c of st.clones) c.t = Math.max(c.t, 1.0);
      updateClones(z, st, dt, api);
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    updateClones(z, st, dt, api);
    st.hold = Math.max(0, st.hold - dt);
    st.busyT = Math.max(0, st.busyT - dt);
    st.cloakT = Math.max(0, st.cloakT - dt);
    st.sageT = Math.max(0, st.sageT - dt);
    st.cloak += ((st.cloakT > 0 ? 1 : 0) - st.cloak) * Math.min(1, dt * (st.cloakT > 0 ? 6 : 2.5));
    st.sage += ((st.sageT > 0 ? 1 : 0) - st.sage) * Math.min(1, dt * 5);
    z.kageDash = 0;
    if (st.helper) {
      st.helper.t += dt;
      if (st.helper.leave && (st.helper.out = (st.helper.out || 0) + dt) > .4) st.helper = null;
      else if (!st.helper.leave && st.move !== 'odama') st.helper.leave = true;
    }

    if (st.dash) {
      const ds = st.dash, D = api.damage || 60;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if ((ds.wt -= dt) <= 0) { ds.wt = .1; api.world(nx, ny, 80, D * 2.4, 'shockwave', ds.a); }
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .07; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      const tr = st.fx.find(f => f.kind === 'dash');
      if (tr) { tr.x1 = z.x; tr.y1 = z.y; tr.pts.push(z.x, z.y); if (tr.pts.length > 16) tr.pts.splice(0, 2); }
      if (ds.left <= 0) { const end = ds.end; st.dash = null; if (end) end(api); }
    }
    if (st.leap) {
      const lp = st.leap, D = api.damage || 60;
      lp.t += dt;
      const k = easeInOut(lp.t / lp.dur), nx = lp.x0 + (lp.x1 - lp.x0) * k, ny = lp.y0 + (lp.y1 - lp.y0) * k;
      // mid-air he clears houses; he only lands on open ground
      if (lp.t < lp.dur || !api.blocked(nx, ny, z.r)) { z.x = nx; z.y = ny; }
      z.kageDash = .05;
      if (lp.t >= lp.dur) {
        st.leap = null;
        const ex = z.x, ey = z.y;
        api.strike(ex, ey, 300, D * 3.0, null, 'crater', true);
        api.knockback({ x: ex, y: ey }, 320, 260, 0);
        api.world(ex, ey, 280, D * 3.4, 'crater');
        api.shake(22); api.burst(ex, ey - 20, '#bfe8ff', 18);
        for (let i = 1; i <= 3; i++) later(st, i * .16, api => api.strike(ex, ey, 240, D * .7, null, null, true));
        addVfx(st, 'vortices', { x: ex, y: ey, radius: 300, life: 1.15 });
        addVfx(st, 'explosions', { x: ex, y: ey, radius: 310, life: 1.1, kind: 'vortex' });
        addFx(st, { kind: 'impact', x: ex, y: ey, r: 320, dur: 1.6, seed: st.seed, rgb: '110,190,255' });
        st.hold = .5;
      }
    }

    const busy = () => st.windup > 0 || !!st.dash || !!st.leap || st.busyT > 0;
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (z.manual) {
      // Manual control (team mode): only start what the player asked for.
      if (z.manualCast !== null && z.manualCast !== undefined) {
        if (!busy()) {
          const key = KEYS[z.manualCast | 0];
          if (key) announce(z, st, api, key);
          z.manualCast = null;
        }
      }
    } else if (!busy()) {
      if (st.wasManual) st.timer = Math.max(st.timer, 1.0);
      st.timer -= dt;
      const p = api.player;
      if (st.timer <= 0 && p && Number.isFinite(p.x) && Math.hypot(z.x - p.x, z.y - p.y) < 900) announce(z, st, api, CYCLE[st.casts % CYCLE.length]);
    }
    st.wasManual = !!z.manual;
    z.manualBusy = busy();
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
  }

  // When the unit dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.helper = null;
    st.cloak = Math.max(0, st.cloak - dt * 3); st.sage = Math.max(0, st.sage - dt * 3);
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
    for (let i = st.clones.length - 1; i >= 0; i--) { st.clones[i].t = Math.max(st.clones[i].t, 1.0) + dt; if (st.clones[i].t > 1.25) st.clones.splice(i, 1); }
    ageVfx(st, dt);
  }

  // ------------------------------------------------------------------ cached art
  function tbbSphere() {
    return Kit().sphere('nu:tbb', [[0, '#d8c8ff'], [.1, '#5a3a8a'], [.42, '#140a24'], [.86, '#060309'], [.96, '#3a1460'], [1, 'rgba(90,30,150,0)']], .36, .32);
  }
  function tbbSwirl() { return Kit().swirl('nu:tbbswirl', ['rgba(255,255,255,.9)', 'rgba(200,150,255,.85)', 'rgba(120,60,220,.85)'], 7, 1.1, .12, 128, 3); }
  function goldSwirl() { return Kit().swirl('nu:goldswirl', ['rgba(255,250,210,.95)', 'rgba(255,200,60,.9)', 'rgba(255,130,20,.85)'], 6, 1.2, .1, 128, 3.4); }
  // Four curved wind blades of the Rasen Shuriken (spun at runtime).
  function bladesImg() {
    return Kit().sprite('nu:blades', 160, 160, g => {
      g.translate(80, 80);
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * Math.PI / 2);
        const path = () => { g.beginPath(); g.moveTo(-4, -10); g.quadraticCurveTo(34, -40, 76, -10); g.quadraticCurveTo(40, -16, 6, 10); g.closePath(); };
        path(); g.strokeStyle = 'rgba(20,70,160,.7)'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
        path(); g.fillStyle = 'rgba(150,215,255,.85)'; g.fill();
        g.beginPath(); g.moveTo(2, -8); g.quadraticCurveTo(34, -32, 70, -11); g.quadraticCurveTo(38, -18, 8, 2); g.closePath();
        g.fillStyle = 'rgba(245,252,255,.95)'; g.fill();
        g.restore();
      }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(140,210,255,.8)'); gr.addColorStop(1, 'rgba(60,140,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
    });
  }
  // A translucent giant fist (Sage Mode frog kumite: the natural energy hits beyond the knuckles).
  function fistImg() {
    return Kit().sprite('nu:fist', 128, 96, g => {
      g.translate(64, 48);
      const body = () => {
        g.beginPath();
        g.moveTo(-50, -22); g.quadraticCurveTo(-20, -34, 20, -30);
        for (let i = 0; i < 4; i++) { const y = -26 + i * 14; g.quadraticCurveTo(48, y - 4, 46, y + 7); }
        g.quadraticCurveTo(30, 34, -10, 30); g.quadraticCurveTo(-46, 26, -50, 10); g.closePath();
      };
      body(); g.fillStyle = 'rgba(255,150,40,.55)'; g.fill();
      g.strokeStyle = 'rgba(120,40,0,.8)'; g.lineWidth = 4; g.lineJoin = 'round'; g.stroke();
      g.strokeStyle = 'rgba(255,230,160,.9)'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(120,40,0,.55)'; g.lineWidth = 2;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(18, -26 + i * 14); g.lineTo(42, -26 + i * 14); g.stroke(); }
    });
  }

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
      // the Uzumaki swirl turning at the centre
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let j = 0; j <= 24; j++) {
        const t = j / 24, an = time * 2 + t * TAU * 1.6, rr = r * .12 + r * .3 * t;
        const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      for (let i = 0; i < 4; i++) {
        const an = i * Math.PI / 2 + time * .8;
        ctx.moveTo(x + Math.cos(an) * (r - 14), y + Math.sin(an) * (r - 14)); ctx.lineTo(x + Math.cos(an) * (r + 12), y + Math.sin(an) * (r + 12));
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
    if (t > .1) K.fx.shockRing(ctx, x, y, r * 1.35, (t - .1) * 1.2, Math.max(0, .8 - t), '255,245,230');
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
  function speedLines(ctx, x0, y0, x1, y1, w, alpha, seed, rgb = '255,255,255') {
    const len = Math.hypot(x1 - x0, y1 - y0); if (len < 4) return;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(${rgb},${alpha * .85})` : `rgba(14,30,70,${alpha * .35})`;
      ctx.lineWidth = pass ? 2 : 4.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const o = (hash(i + seed) - .5) * w * 2, s0 = hash(i * 3.1 + seed) * len * .7, l = len * (.25 + hash(i * 1.7 + seed) * .4);
        ctx.moveTo(x0 + ux * s0 + nx * o, y0 + uy * s0 + ny * o - 30); ctx.lineTo(x0 + ux * (s0 + l) + nx * o, y0 + uy * (s0 + l) + ny * o - 30);
      }
      ctx.stroke();
    }
  }
  function frameOf(z) {
    if (z.kageDash > 0) return 'attack';
    if (z.bossWindup > 0) return 'seal';
    if (z.attackTimer > .62) return 'attack';
    return 'run';
  }
  // Rasengan held in the palm, at the hand on the facing side.
  function orbAt(ctx, x, y, r, time, alpha = 1) {
    const K = Kit();
    if (!K || !K.fx || !K.fx.rasenganOrb) return;
    ctx.save(); ctx.translate(x, y); K.fx.rasenganOrb(ctx, r, time, alpha); ctx.restore();
  }
  function tbbBall(ctx, bx, by, r, time, seed, k) {
    const K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, bx, by, r * 4, '170,80,255', .5 + .3 * k);
    ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const ph = (time * 1.8 + hash(i + seed)) % 1, an = hash(i * 3.7 + seed) * TAU + time;
      const d0 = r + 170 * (1 - ph), d1 = r + 170 * (1 - ph) * .7 + 6;
      ctx.strokeStyle = i % 2 ? `rgba(255,255,255,${ph * .9})` : `rgba(150,80,255,${ph})`; ctx.lineWidth = 2 + ph * 2.5;
      ctx.beginPath(); ctx.moveTo(bx + Math.cos(an) * d0, by + Math.sin(an) * d0 * .8); ctx.lineTo(bx + Math.cos(an) * d1, by + Math.sin(an) * d1 * .8); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // dark motes being sucked in (read on bright ground), white and black chakra beads
    ctx.fillStyle = 'rgba(20,6,30,.85)';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const ph = (time * 1.4 + hash(i * 5 + seed)) % 1, an = hash(i * 9.1 + seed) * TAU - time, d = r + 140 * (1 - ph);
      const px = bx + Math.cos(an) * d, py = by + Math.sin(an) * d * .8;
      ctx.moveTo(px + 3, py); ctx.arc(px, py, 3 * ph + 1.2, 0, TAU);
    }
    ctx.fill();
    ctx.drawImage(tbbSphere(), bx - r, by - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'lighter';
    K.spin(ctx, tbbSwirl(), bx, by, r * .95, time * 14, .55);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ effects: [ground, overlay]
  const FX = {
    dash: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.live, fx.dur);
        if (a <= 0) return;
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0); if (len < 4) return;
        ctx.save(); ctx.translate(fx.x0, fx.y0); ctx.rotate(Math.atan2(fx.y1 - fx.y0, fx.x1 - fx.x0));
        ctx.fillStyle = `rgba(30,50,80,${.22 * a})`; ctx.fillRect(0, -26, len, 52);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(80,160,255,${.25 * a})`; ctx.fillRect(0, -18, len, 36);
        ctx.strokeStyle = `rgba(210,240,255,${.6 * a})`; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const o = (hash(i + fx.seed) - .5) * 40; ctx.moveTo(len * hash(i * 2 + fx.seed) * .5, o); ctx.lineTo(len, o * .4); }
        ctx.stroke();
        ctx.restore();
      },
      (ctx, fx, time, z) => {
        const a = 1 - win(fx.age, fx.live, fx.dur), S = Spr();
        if (a <= 0) return;
        // afterimages along the trail
        if (S) for (let i = 0; i + 1 < fx.pts.length; i += 4) {
          const al = (i / fx.pts.length) * .35 * a;
          S.draw(ctx, ID, fx.pts[i], fx.pts[i + 1] + 3, { facing: Math.cos(fx.a) >= 0 ? 1 : -1, frame: 'attack', alpha: al });
        }
        speedLines(ctx, fx.x0, fx.y0, fx.x1, fx.y1, 34, a, fx.seed, '200,235,255');
        if (fx.age < fx.live + .02 && z.health > 0) {
          orbAt(ctx, z.x + Math.cos(fx.a) * 26, z.y + 3 - 34 + Math.sin(fx.a) * 10, 20, time);
        }
      }
    ],
    impact: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r * .7, 1 - win(fx.age, fx.dur * .6, fx.dur), fx.seed),
      (ctx, fx) => impactO(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, fx.rgb)
    ],
    needles: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, 1.0, fx.dur);
        scorchG(ctx, fx.x, fx.y, fx.r * .75, a, fx.seed, '24,30,44');
        // the ground cut into a fine spiral by the wind needles
        ctx.strokeStyle = `rgba(20,40,70,${.45 * a})`; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let i = 0; i < 18; i++) {
          const an = hash(i * 2.7 + fx.seed) * TAU, d0 = fx.r * (.15 + hash(i + fx.seed) * .4), d1 = d0 + fx.r * (.25 + hash(i * 5 + fx.seed) * .35);
          ctx.moveTo(fx.x + Math.cos(an) * d0, fx.y + Math.sin(an) * d0 * .5); ctx.lineTo(fx.x + Math.cos(an + .3) * d1, fx.y + Math.sin(an + .3) * d1 * .5);
        }
        ctx.stroke();
      },
      (ctx, fx, time) => {
        const K = Kit(), a = 1 - win(fx.age, .9, fx.dur), R = fx.r * (.5 + .5 * easeOut(fx.age / .25)) * (1 - .45 * win(fx.age, .95, 1.25));
        if (a <= 0) return;
        // millions of microscopic wind blades: white needle streaks flickering inside the dome
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(20,60,130,${.4 * a})`; ctx.lineWidth = 3.4; ctx.beginPath();
        const tick = Math.floor(time * 24);
        for (let i = 0; i < 26; i++) {
          const an = hash(i * 3.1 + tick * .7 + fx.seed) * TAU, d = R * Math.sqrt(hash(i * 1.3 + tick + fx.seed)), l = 16 + hash(i + tick) * 22;
          const px = fx.x + Math.cos(an) * d, py = fx.y - 30 + Math.sin(an) * d * .55, ta = an + 1.4;
          ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ta) * l, py + Math.sin(ta) * l * .6);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(235,250,255,${.85 * a})`; ctx.lineWidth = 1.4; ctx.stroke();
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.25, fx.age * .9, a * .8, '120,200,255');
        ctx.globalCompositeOperation = 'source-over';
        dustRing(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, 12, 'dust', .7);
      }
    ],
    fireSea: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .8, fx.dur), reach = fx.r * easeOut(fx.age / .6);
        if (a <= 0) return;
        ctx.fillStyle = `rgba(48,18,8,${.34 * a})`; sector(ctx, fx.x, fx.y, 40, Math.max(41, reach), fx.a - fx.h, fx.a + fx.h); ctx.fill();
        const K = Kit();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < fx.pts.length; i += 3) {
          const p = fx.pts[i]; if (fx.age < p.t0) continue;
          K.glow(ctx, p.x, p.y, p.s * 2.4, '255,110,30', .38 * a, false, .45);
        }
        ctx.globalCompositeOperation = 'source-over';
      },
      (ctx, fx, time) => {
        const K = Kit(), fade = 1 - win(fx.age, fx.dur - .9, fx.dur), smoke = K.puff('smoke');
        if (fade <= 0) return;
        // rolling flame front, then a sea of tongues licking up
        const firePuff = K.puff('fire'), ember = K.puff('ember');
        for (let i = 0; i < fx.pts.length; i++) {
          const p = fx.pts[i], t = fx.age - p.t0;
          if (t < 0) continue;
          // the billowing wall of fire rolls over each spot first...
          if (t < 1.1) {
            const b = easeOut(t / .3) * (1 - win(t, .45, 1.1));
            K.stamp(ctx, i % 3 ? firePuff : ember, p.x + Math.sin(i * 2.3) * 8, p.y - 16 - t * 26, p.s * (.55 + .5 * b), .92 * b, .85);
          }
          // ...then tongues of flame keep licking up from the burning ground
          const grow = easeOut((t - .1) / .35), flick = .8 + .2 * Math.sin(time * 17 + i * 1.7), hv = .65 + hash(i * 1.37 + fx.seed) * .7;
          const h = p.s * 1.55 * hv * grow * flick * (1 - .5 * win(fx.age, 1.6, fx.dur)) * fade, w = p.s * .62 * grow;
          if (h < 4) continue;
          const v = p.v + Math.floor(time * 8 + i) % 6;
          ctx.drawImage(K.flame(v), p.x - w / 2, p.y - h * (114 / 128), w, h);
          if (i % 2) ctx.drawImage(K.flame(v + 3), p.x + p.s * .34 - w * .3, p.y + 4 - h * .6 * (114 / 128), w * .6, h * .6);
        }
        ctx.globalCompositeOperation = 'lighter';
        if (fx.age < .7) {
          const fr = fx.r * easeOut(fx.age / .6);
          K.glow(ctx, fx.x + Math.cos(fx.a) * fr, fx.y + Math.sin(fx.a) * fr - 30, 160, '255,170,60', .7 * (1 - fx.age / .7), true, .6);
        }
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 10; i++) {
          const p = fx.pts[(i * 5) % fx.pts.length], ph = (time * .6 + hash(i + fx.seed)) % 1;
          if (fx.age < p.t0 + .3) continue;
          K.stamp(ctx, smoke, p.x + Math.sin(time + i) * 10, p.y - 60 - ph * 140, 26 + ph * 40, (1 - ph) * .55 * fade, .8);
        }
      }
    ],
    burst: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, .8, fx.dur);
        scorchG(ctx, fx.x, fx.y, fx.r * .6, a, fx.seed, '60,26,6');
        ctx.globalCompositeOperation = 'lighter';
        Kit().glow(ctx, fx.x, fx.y, fx.r * (.5 + easeOut(fx.age / .4) * .6), '255,150,30', .5 * a, false, .45);
        ctx.globalCompositeOperation = 'source-over';
      },
      (ctx, fx, time) => {
        const K = Kit(), t = fx.age;
        ctx.globalCompositeOperation = 'lighter';
        if (t < .4) K.glow(ctx, fx.x, fx.y - 50, 160 + t * 300, '255,200,80', (1 - t / .4), true);
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r, t * 1.3, Math.max(0, 1 - t), '255,170,40');
        if (t > .12) K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.25, (t - .12) * 1.1, Math.max(0, .8 - t), '255,240,200');
        // a column of gold chakra flame bursting upward
        const col = 1 - win(t, .3, 1.1);
        if (col > 0) {
          for (let i = 0; i < 8; i++) {
            const ph = (time * 2 + hash(i + fx.seed)) % 1, ox = (hash(i * 3 + fx.seed) - .5) * 80;
            K.glow(ctx, fx.x + ox, fx.y - 40 - ph * 220, 40 + 30 * (1 - ph), i % 2 ? '255,200,60' : '255,120,20', col * (1 - ph) * .8);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        dustRing(ctx, fx.x, fx.y, fx.r, t, fx.seed, 14);
        if (t < 1.2) K.fx.debris(ctx, fx.x, fx.y, fx.r, t / 1.2, fx.seed, '#3a2c22', 14);
      }
    ],
    arm: [
      null,
      (ctx, fx, time, z) => {
        const K = Kit(), t = fx.age, reach = easeOut(t / fx.hitAt), back = win(t, fx.hitAt + .3, fx.dur);
        const k = reach * (1 - back);
        if (k <= .01 || z.health <= 0) return;
        const fy = z.y + 3 - liftOf(z), sx = z.x + fx.side * 12, sy = fy - 50;
        const ex = sx + (fx.x1 - sx) * k, ey = sy + (fx.y1 - 20 - sy) * k;
        const cx = (sx + ex) / 2 + fx.side * 60 * (1 - k * .4), cy = Math.min(sy, ey) - 110 * (1 - back * .5);
        const stroke = (w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke(); };
        ctx.lineCap = 'round';
        stroke(30, 'rgba(120,30,0,.55)');
        stroke(24, 'rgba(255,120,20,.85)');
        ctx.globalCompositeOperation = 'lighter';
        stroke(14, 'rgba(255,200,70,.85)');
        stroke(5, 'rgba(255,250,220,.9)');
        K.glow(ctx, ex, ey, 70, '255,170,40', .8);
        ctx.globalCompositeOperation = 'source-over';
        // chakra claw at the end of the arm
        const ang = Math.atan2(ey - cy, ex - cx);
        ctx.strokeStyle = 'rgba(255,150,30,.95)'; ctx.lineWidth = 6;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          const ca = ang + i * .45;
          ctx.moveTo(ex, ey); ctx.quadraticCurveTo(ex + Math.cos(ca) * 26, ey + Math.sin(ca) * 26, ex + Math.cos(ca + .5) * 38, ey + Math.sin(ca + .5) * 38);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,245,200,.9)'; ctx.lineWidth = 2; ctx.stroke();
      }
    ],
    kumite: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r * .6, 1 - win(fx.age, fx.dur * .5, fx.dur), fx.seed, '70,30,8'),
      (ctx, fx, time) => {
        const K = Kit(), t = fx.age;
        // the natural-energy fist landing beyond the real one
        if (t < .35) {
          const k = easeOut(t / .12), fade = 1 - win(t, .15, .35), sc = fx.last ? 1.7 : 1.15;
          ctx.save(); ctx.translate(fx.x - Math.cos(fx.a) * 30, fx.y - 34 - Math.sin(fx.a) * 10); ctx.rotate(fx.a);
          ctx.globalAlpha = fade; ctx.drawImage(fistImg(), -64 * sc * (.6 + .4 * k), -48 * sc, 128 * sc, 96 * sc); ctx.globalAlpha = 1;
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        if (t < .25) K.glow(ctx, fx.x, fx.y - 30, fx.r * (.6 + t * 2), '255,160,60', 1 - t / .25, true);
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r, t * 1.6, Math.max(0, 1 - t * 1.4), '255,140,50');
        ctx.globalCompositeOperation = 'source-over';
        dustRing(ctx, fx.x, fx.y, fx.r, t, fx.seed, fx.last ? 14 : 8);
        if (fx.last && t < 1.1) K.fx.debris(ctx, fx.x, fx.y, fx.r, t / 1.1, fx.seed, '#3a2c22', 12);
      }
    ],
    tbbBlast: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .8, fx.dur);
        scorchG(ctx, fx.x, fx.y, fx.r * .85, a, fx.seed, '26,8,34');
        ctx.fillStyle = `rgba(10,4,16,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * .5, fx.r * .25, 0, 0, TAU); ctx.fill();
      },
      (ctx, fx, time) => {
        const K = Kit(), t = fx.age, vio = K.puff('violet'), smoke = K.puff('smoke');
        ctx.globalCompositeOperation = 'lighter';
        if (t < .3) K.glow(ctx, fx.x, fx.y - 60, fx.r * (1 + t * 2), '230,200,255', 1 - t / .3, true);
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.5, t * .9, Math.max(0, 1 - t * .7), '190,110,255');
        if (t > .2) K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.9, (t - .2) * .8, Math.max(0, .7 - t * .4), '255,230,255');
        ctx.globalCompositeOperation = 'source-over';
        // the mushroom column of violet-black smoke rising out of the crater
        const rise = easeOut(t / 1.4), fade = 1 - win(t, 1.4, fx.dur);
        for (let i = 0; i < 14; i++) {
          const h = hash(i * 2.1 + fx.seed), up = (i / 14) * 320 * rise, spread = (h - .5) * fx.r * (.3 + .5 * i / 14);
          K.stamp(ctx, i % 3 ? vio : smoke, fx.x + spread, fx.y - 40 - up, 40 + 50 * rise * (.6 + h * .6), .75 * fade, .85);
        }
        dustRing(ctx, fx.x, fx.y, fx.r, t * .8, fx.seed, 16, 'dust', .9);
        if (t < 1.5) K.fx.debris(ctx, fx.x, fx.y, fx.r * 1.1, t / 1.5, fx.seed, '#2a1c22', 16);
      }
    ]
  };

  // ------------------------------------------------------------------ body overlays
  function drawCloak(ctx, z, st, time, behind) {
    const K = Kit(), S = Spr(), k = st.cloak, fy = z.y + 3 - liftOf(z), fac = facingOf(z), H = bodyH();
    if (behind) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, z.y + 3, 70 + 20 * k, '255,150,30', .45 * k, false, .42);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - H * .5, H * 1.1, '255,170,40', .4 * k, false, 1.2);
    ctx.globalCompositeOperation = 'source-over';
    // Kurama chakra mode: the gold body painted over the normal one
    if (S && S.has('naruto_kurama')) S.draw(ctx, 'naruto_kurama', z.x, fy, { facing: fac, frame: frameOf(z), phase: (z.pulse || 0) * 1.6 + (z.seed || 0), alpha: k });
    // flame licks rising off the cloak
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,190,60,${.45 * k})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ph = (time * 2.2 + hash(i * 1.9 + z.seed)) % 1, bx = z.x + (i - 3.5) * 7 + Math.sin(time * 5 + i) * 3, by = fy - H * (.15 + hash(i + z.seed) * .75) - ph * 28;
      const hh = 12 + 8 * (1 - ph), ww = 3.8 * (1 - ph * .6);
      ctx.moveTo(bx - ww, by); ctx.quadraticCurveTo(bx - ww * .6, by - hh * .6, bx + Math.sin(i + time * 7) * 2, by - hh); ctx.quadraticCurveTo(bx + ww * .7, by - hh * .5, bx + ww, by); ctx.closePath();
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawSage(ctx, z, st, time) {
    const K = Kit(), k = st.sage, fy = z.y + 3 - liftOf(z), H = bodyH();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - H * .5, H * .9, '255,140,40', .28 * k, false, 1.25);
    // natural energy motes drifting into his body
    for (let i = 0; i < 9; i++) {
      const ph = (time * .9 + hash(i + z.seed)) % 1, an = hash(i * 4.1 + z.seed) * TAU + time * .5, d = 70 * (1 - ph) + 8;
      K.glow(ctx, z.x + Math.cos(an) * d, fy - H * .5 + Math.sin(an) * d * .7, 7, i % 2 ? '255,200,90' : '120,230,140', ph * .9 * k, true);
    }
    ctx.globalCompositeOperation = 'source-over';
    // orange pigment around the eyes (a small dash on each side of the face)
    ctx.fillStyle = `rgba(230,90,20,${.85 * k})`;
    const fac = facingOf(z), hx = z.x + fac * 4, hy = fy - H + 22;
    ctx.fillRect(hx - 7, hy, 4, 2); ctx.fillRect(hx + 3, hy, 4, 2);
  }
  function drawClones(ctx, z, st, time) {
    const S = Spr(), K = Kit();
    if (!S) return;
    for (const c of st.clones) {
      const t = c.t;
      if (t < 0) continue;
      const fac = Math.cos(c.ang) >= 0 ? 1 : -1, fy = c.y + 3;
      const out = t > .95;
      if (t > .1 && !(out && t > 1.05)) {
        S.shadow(ctx, c.x, fy, 12);
        const frame = t < .3 ? 'seal' : t < .64 ? 'run' : 'attack';
        S.draw(ctx, ID, c.x, fy, { facing: fac, frame, phase: t * 14 + c.i, alpha: out ? 1 - (t - .95) / .1 : 1 });
        if (t > .3 && t < .9) orbAt(ctx, c.x + fac * 16, fy - 32, c.i === 0 ? 17 : 12, time + c.i, t < .64 ? 1 : 1 - win(t, .7, .9));
        if (t > .3 && t < .64) speedLines(ctx, c.x0, c.y0, c.x, c.y, 14, .7, c.seed, '220,240,255');
      }
      if (t < .4) S.drawSmoke(ctx, c.x, fy - 15, t / .4, 28);
      if (out && t < 1.25) S.drawSmoke(ctx, c.x, fy - 15, (t - .95) / .3, 30);
      if (t > .64 && t < 1.0) {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, c.x1, c.y1 - 20, c.i === 0 ? 110 : 70, '120,200,255', .7 * (1 - win(t, .64, 1.0)), true);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
  function drawHelper(ctx, z, st, time) {
    const h = st.helper, S = Spr();
    if (!h || !S) return;
    const fac = facingOf(z), fy = h.y + 3;
    if (!h.leave || (h.out || 0) < .1) {
      S.shadow(ctx, h.x, fy, 12);
      S.draw(ctx, ID, h.x, fy, { facing: fac, frame: 'seal', phase: time * 6 });
    }
    if (h.t < .4) S.drawSmoke(ctx, h.x, fy - 15, h.t / .4, 28);
    if (h.leave) S.drawSmoke(ctx, h.x, fy - 15, (h.out || 0) / .4, 30);
  }

  function windupOverlay(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, fac = facingOf(z), fy = z.y + 3 - liftOf(z), H = bodyH();
    const hx = z.x + fac * 18, hy = fy - 34;
    switch (st.move) {
      case 'rasengan': {
        // wisps of chakra converging into the palm, the ball steadying as it grows
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
          const ph = (time * 2.2 + hash(i + st.seed)) % 1, an = hash(i * 3.7 + st.seed) * TAU + time * 3;
          const d0 = 14 + 70 * (1 - ph), d1 = d0 * .6;
          ctx.strokeStyle = `rgba(140,210,255,${ph * .9})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(hx + Math.cos(an) * d0, hy + Math.sin(an) * d0 * .8); ctx.lineTo(hx + Math.cos(an + .5) * d1, hy + Math.sin(an + .5) * d1 * .8); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        orbAt(ctx, hx + fac * 4, hy, 6 + 14 * easeOut(k), time);
        break;
      }
      case 'shuriken': {
        // raised overhead on a column of chakra, the four blades unfurling and screaming
        const r = 16 + 34 * easeOut(k), ox = z.x, oy = fy - H - 26 - r * .6;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, ox, oy, r * 2.6, '90,170,255', .4 + .3 * k);
        ctx.strokeStyle = `rgba(170,225,255,${.35 + .3 * k})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(z.x + fac * 4, fy - H + 8); ctx.lineTo(ox, oy); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(ox, oy); ctx.scale(1, .8); ctx.rotate(time * 18);
        ctx.globalAlpha = .4 + .6 * k; ctx.drawImage(bladesImg(), -r * 1.6, -r * 1.6, r * 3.2, r * 3.2); ctx.globalAlpha = 1;
        ctx.restore();
        orbAt(ctx, ox, oy, r * .45, time);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(220,245,255,${.3 + .2 * Math.sin(time * 40)})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(ox, oy, r * 1.55, r * 1.25, 0, 0, TAU); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'clones': {
        // cross-shaped seal: smoke bursts of clones appearing around him one by one
        const S = Spr();
        for (let i = 0; i < 6; i++) {
          const at = .15 + i * .1;
          if (k < at) continue;
          const an = st.seed + i * TAU / 6, x = z.x + Math.cos(an) * 70, y = z.y + Math.sin(an) * 46 + 3;
          const p = (k - at) / .35;
          if (p > .25 && S) { S.shadow(ctx, x, y, 12); S.draw(ctx, ID, x, y, { facing: Math.cos(an) > 0 ? -1 : 1, frame: 'seal', phase: time * 6 + i, alpha: .95 }); }
          if (p < 1) S && S.drawSmoke(ctx, x, y - 15, p, 28);
        }
        break;
      }
      case 'odama': {
        drawHelper(ctx, z, st, time);
        const r = 14 + 32 * easeOut(k), ox = z.x - fac * 8, oy = fy - H - 6 - r;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, ox, oy, r * 2.5, '60,150,255', .5);
        ctx.globalCompositeOperation = 'source-over';
        orbAt(ctx, ox, oy, r, time);
        break;
      }
      case 'katon': {
        // tiger seal; fire swelling at his lips
        const mx = z.x + Math.cos(st.aim) * 22, my = fy - 58 + Math.sin(st.aim) * 8, r = 8 + 26 * easeOut(k);
        const fire = K.puff('fire');
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, mx, my, r * 3, '255,120,30', .55 + .3 * k);
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 8; i++) {
          const ph = (time * 2.4 + hash(i + st.seed)) % 1, an = hash(i * 2.9 + st.seed) * TAU + time * 2;
          K.stamp(ctx, fire, mx + Math.cos(an) * r * (1.4 - ph), my + Math.sin(an) * r * (1.1 - ph) - ph * 10, 4 + ph * 6, (1 - ph) * .95);
        }
        K.stamp(ctx, fire, mx, my, r, 1);
        break;
      }
      case 'kurama': {
        // chakra boiling up into a gold column; the ground glows
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, fy - 60, 90 + 90 * k, '255,170,40', .3 + .25 * k, false, 1.4);
        K.spin(ctx, goldSwirl(), z.x, z.y + 3, 60 + 80 * k, -time * 6, .35 + .3 * k, .45);
        for (let i = 0; i < 12; i++) {
          const ph = (time * 1.3 + hash(i + st.seed)) % 1, an = hash(i * 3.3 + st.seed) * TAU;
          K.glow(ctx, z.x + Math.cos(an) * (24 + 30 * k), fy - 20 - ph * (110 + 150 * k), 18 + 14 * ph, i % 2 ? '255,200,70' : '255,110,20', (1 - ph) * .8 * k);
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'sage': {
        // still, sensing: rings of natural energy closing in
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const ph = (time * 1.4 + i / 3) % 1, rr = 150 * (1 - ph) + 20;
          ctx.strokeStyle = `rgba(255,170,60,${ph * .7})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(z.x, z.y + 3, rr, rr * .5, 0, 0, TAU); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'tbb': {
        // black and white chakra beads spiralling into a ball before his mouth
        const r = 8 + 38 * easeOut(k), bx = z.x + Math.cos(st.aim) * (r + 26), by = fy - 52 + Math.sin(st.aim) * 12;
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, goldSwirl(), z.x, z.y + 3, 70 + 90 * k, time * 5, .3 + .3 * k, .45);
        ctx.globalCompositeOperation = 'source-over';
        // the ground splitting under the pressure, violet light seeping out of the cracks
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(200,130,255,${.35 + .4 * k})` : `rgba(30,10,40,${.4 + .3 * k})`;
          ctx.lineWidth = pass ? 1.6 : 4;
          if (pass) ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          for (let i = 0; i < 9; i++) {
            const an = hash(i * 3.3 + st.seed) * TAU, L = (60 + hash(i + st.seed) * 120) * easeOut(k * 1.3);
            let px = z.x, py = z.y + 3; ctx.moveTo(px, py);
            for (let j = 1; j <= 4; j++) { const aa = an + (hash(i * 7 + j + st.seed) - .5) * .7; px += Math.cos(aa) * L / 4; py += Math.sin(aa) * L / 8; ctx.lineTo(px, py); }
          }
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        // rubble torn off the ground and drawn up into the ball
        ctx.fillStyle = '#3a2c26';
        for (let i = 0; i < 10; i++) {
          const ph = (time * .9 + hash(i * 2.9 + st.seed)) % 1, an = hash(i * 5.1 + st.seed) * TAU, d = 150 * (1 - ph) + r;
          const px = bx + Math.cos(an) * d, py = by + 50 * (1 - ph) + Math.sin(an) * d * .4, s = 3 + hash(i) * 4;
          ctx.globalAlpha = Math.min(1, ph * 3) * k; ctx.fillRect(px - s / 2, py - s / 2, s, s * .8);
        }
        ctx.globalAlpha = 1;
        tbbBall(ctx, bx, by, r, time, st.seed, k);
        break;
      }
    }
  }
  function label(ctx, z, st, m) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[st.move], top = z.y + 3 - liftOf(z) - bodyH() - 40 - (st.move === 'shuriken' ? 72 : st.move === 'odama' ? 58 : 0);
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#1a0f06';
    ctx.strokeText(def.label, z.x, top); ctx.fillStyle = st.move === 'tbb' ? '#d9b8ff' : m.accent; ctx.fillText(def.label, z.x, top);
    ctx.restore();
  }

  // ------------------------------------------------------------------ module hooks
  function draw(ctx, z, time) {
    const st = z.nu;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    if (!st.fx.length && !(st.windup > 0) && st.cloak < .02 && !st.leap) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      if (st.cloak > .02) drawCloak(ctx, z, st, time, true);
      if (st.leap) {
        // his shadow racing across the ground under the leap
        ctx.fillStyle = 'rgba(16,20,30,.3)';
        ctx.beginPath(); ctx.ellipse(z.x, z.y + 3, 22, 9, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.nu, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    ctx.save();
    const V = st.vfx;
    if (window.NinjaVFX && (V.fireballs.length || V.explosions.length || V.vortices.length || V.rasenShurikens.length || V.beastBombs.length)) {
      V.elapsed = time;
      window.NinjaVFX.draw(ctx, V);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    // Sage Mode afterimages left behind by each blink
    const S = Spr();
    if (S) for (const g of st.ghosts) S.draw(ctx, ID, g.x, g.y + 3, { facing: g.fac, frame: 'attack', alpha: .45 * (1 - g.t / .45) });
    if (st.clones.length) drawClones(ctx, z, st, time);
    if (z.health > 0) {
      if (st.cloak > .02) drawCloak(ctx, z, st, time, false);
      else if (st.sage > .02) drawSage(ctx, z, st, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (st.leap) {
        // the giant Rasengan held overhead through the leap, then slammed down
        const k = st.leap.t / st.leap.dur, fy = z.y + 3 - liftOf(z), r = 46 + 12 * k;
        ctx.globalCompositeOperation = 'lighter';
        const la = st.leap.a, ox = z.x + Math.cos(la) * (r * .9 + 14), oy = fy - bodyH() * .55 + Math.sin(la) * r * .4 - r * .7 * (1 - k);
        Kit().glow(ctx, ox, oy, r * 2.4, '60,150,255', .5);
        ctx.globalCompositeOperation = 'source-over';
        orbAt(ctx, ox, oy, r, time);
      }
      if (st.helper && st.move !== 'odama') drawHelper(ctx, z, st, time);
      if (st.windup > 0 && st.move) {
        windupOverlay(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m);
      }
    }
    ctx.restore();
  }

  const bodyLift = z => liftOf(z);

  window.NarutoUnits = { members, order, pick, update, draw, drawOverlay, bodyLift, moves,
    moveLabels: Object.fromEntries(Object.entries(MOVES).map(([k, v]) => [k, v.label])) };
})();
