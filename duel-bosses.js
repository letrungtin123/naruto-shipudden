/* Duel rivals (spawn panel, faction 'duel'): Hanzō of the Salamander, Might Guy and Rock Lee.
 * Same contract as killer-bee-boss.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
 * telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above the characters. All per-boss
 * state lives on z.dv (plain numbers / small arrays; closures in ev/upd are skipped by the co-op snapshot).
 *
 * Hanzō  (~30 s): kusarigama throw that drags the target in, poison gas canisters (lingering clouds),
 *        kusarigama whirl, Ibuse's poison breath, gas body-flicker ambush, and the ultimate Ibuse poison
 *        storm: he rides the giant salamander (sweeping breath, gas bomb rain, a final poison blast).
 * Guy    (~30 s): Konoha Gōriki Senpū, Dynamic Entry, Asa Kujaku, opening the gates, Hirudora, Sekizō,
 *        and the ultimate Night Guy (Eighth Gate, the red steam dragon kick).
 * Lee    (~30 s): Konoha Senpū, Front Lotus, Drunken Fist, Konoha Daisenpū, dropping his weights (blink
 *        dashes), Hidden Lotus, and the ultimate Morning Peacock chain at the Sixth Gate.
 * Guy's taijutsu art is painted by might-guy-vfx.js (window.MightGuyVFX.drawEffects); this file adds the
 * enemy telegraphs, gates aura, afterimages and everything Hanzō / Lee need. */
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
  const r1 = v => Math.round(v * 10) / 10;
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const IS = 1.0;            // Ibuse drawing scale (normal summon)
  const IS_ULT = 1.32;       // Ibuse in the ultimate

  const members = {
    hanzo: { name: 'HANZŌ — KỲ NHÔNG', accent: '#b48cff', hpScale: 3.5, damageScale: 1.9, armor: .9,
      moves: ['kusa', 'gas', 'whirl', 'ibuse', 'blink', 'storm', 'gas', 'kusa', 'ibuse', 'whirl', 'blink', 'storm'] },
    guy: { name: 'MAITO GUY — BÁT MÔN ĐỘN GIÁP', accent: '#ff5a3a', hpScale: 3.6, damageScale: 1.95, armor: .9,
      moves: ['senpu', 'entry', 'peacock', 'gate', 'tiger', 'elephant', 'night', 'entry', 'tiger', 'senpu', 'elephant', 'gate', 'peacock', 'night'] },
    lee: { name: 'ROCK LEE — THỂ THUẬT', accent: '#5fd04a', hpScale: 3.2, damageScale: 1.8,
      moves: ['whirl', 'lotus', 'drunk', 'hurricane', 'weights', 'ura', 'peacock', 'drunk', 'whirl', 'weights', 'lotus', 'hurricane', 'ura', 'peacock'] }
  };
  const order = Object.keys(members);
  const pick = level => order[(level | 0) % order.length];

  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    hanzo: {
      kusa:  { label: 'KUSARIGAMA · XÍCH LIÊM PHI TRẢM', rgb: '210,220,240', windup: .8, after: 1.2 },
      gas:   { label: 'ĐỘC VỤ · ĐỘC KHÍ ĐẠN', rgb: '190,120,255', windup: .85, after: 1.3 },
      whirl: { label: 'KUSARIGAMA · LIÊM XÍCH LUÂN VŨ', rgb: '220,230,255', windup: .9, after: 1.2 },
      ibuse: { label: 'KHẨU KÝ · IBUSE ĐỘC VỤ', rgb: '200,110,255', windup: 1.0, after: 1.4 },
      blink: { label: 'ĐỘC VỤ · ẨN THÂN TRẢM', rgb: '200,150,255', windup: .6, after: 1.1 },
      storm: { label: 'IBUSE · ĐỘC VỤ BẠO PHONG', shout: 'NGƯƠI KHÔNG THỂ THẮNG HANZŌ!', rgb: '190,90,255', windup: 1.3, after: 1.8 }
    },
    guy: {
      senpu:    { label: 'MỘC DIỆP CƯƠNG LỰC TOÀN PHONG', rgb: '255,150,80', windup: .8, after: 1.1 },
      entry:    { label: 'DYNAMIC ENTRY!', rgb: '255,120,60', windup: .7, after: 1.1 },
      peacock:  { label: 'TRIÊU KHỔNG TƯỚC', shout: 'TUỔI TRẺ BÙNG CHÁY!', rgb: '255,110,40', windup: .95, after: 1.3 },
      gate:     { label: 'BÁT MÔN · KINH MÔN, KHAI!', rgb: '255,60,50', windup: .7, after: .9 },
      tiger:    { label: 'TRÚ HỔ', rgb: '150,220,255', windup: 1.1, after: 1.4 },
      elephant: { label: 'TỊCH TƯỢNG', rgb: '200,230,255', windup: .9, after: 1.3 },
      night:    { label: 'DẠ KHẢI · TỬ MÔN, KHAI!', shout: 'ĐÂY LÀ TUỔI TRẺ CUỐI CÙNG CỦA TA!', rgb: '255,40,40', windup: 1.6, after: 2.0 }
    },
    lee: {
      whirl:     { label: 'MỘC DIỆP TOÀN PHONG', rgb: '160,240,140', windup: .6, after: 1.0 },
      lotus:     { label: 'BIỂU LIÊN', rgb: '240,235,215', windup: .75, after: 1.2 },
      drunk:     { label: 'TÚY QUYỀN', shout: 'HỨC... TA CHƯA SAY ĐÂU!', rgb: '255,150,190', windup: .7, after: 1.1 },
      hurricane: { label: 'MỘC DIỆP ĐẠI TOÀN PHONG', rgb: '170,245,150', windup: .8, after: 1.1 },
      weights:   { label: 'THÁO TẠ · TỐC ĐỘ THẬT SỰ', rgb: '230,240,255', windup: .65, after: 1.1 },
      ura:       { label: 'BÁT MÔN · LÝ LIÊN', rgb: '255,70,90', windup: 1.0, after: 1.4 },
      peacock:   { label: 'TRIÊU KHỔNG TƯỚC · LIÊN HOÀN CƯỚC', shout: 'SỨC MẠNH CỦA TUỔI TRẺ!', rgb: '255,100,50', windup: 1.4, after: 1.8 }
    }
  };
  const moveLabels = {};
  for (const id in MOVES) for (const k in MOVES[id]) moveLabels[id + ':' + k] = MOVES[id][k].label;
  // Manual control (team mode): each fighter's moves in key order 1..n, ultimate last.
  const MANUAL = {}, MOVE_LISTS = {};
  for (const id in members) {
    MANUAL[id] = [...new Set(members[id].moves)];
    MOVE_LISTS[id] = MANUAL[id].map(k => ({ id: k, label: MOVES[id][k].label }));
  }
  function moves(z) { return (z && MOVE_LISTS[z.bossId]) || []; }

  function state(z) {
    return z.dv || (z.dv = { t: 0, casts: 0, timer: 1.1, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y, tele: [], ev: [], fx: [],
      dash: null, arc: null, lift: 0, hold: 0, seed: 0, gate: z.bossId === 'guy' ? .35 : 0, gateT: 0, vanish: 0, drunk: 0, ib: null, spots: null, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = r1(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => { if (st.ev.length < 200) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = id => (Spr() && Spr().has && Spr().has(id) ? Spr().height(id) : 88);

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
  const segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp01(((px - x1) * dx + (py - y1) * dy) / l2);
    return Math.hypot(px - x1 - dx * t, py - y1 - dy * t);
  };
  // A free spot near (x, y) (falls back to the original point).
  function freeSpot(api, x, y, r) {
    if (!api.blocked(x, y, r)) return { x, y };
    for (let i = 1; i <= 8; i++) {
      const a = i * TAU / 8, d = 60 + i * 18;
      if (!api.blocked(x + Math.cos(a) * d, y + Math.sin(a) * d, r)) return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    }
    return null;
  }

  // ------------------------------------------------------------------ telegraphs per move
  function teleFor(z, st, id, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const d = Math.hypot(tx - x, ty - y);
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    if (id === 'hanzo') switch (move) {
      case 'kusa': return [line(760, 40), circ(x, y, 190, true)];
      case 'gas': {
        const spots = [{ x: tx, y: ty, r: 150 }], b = Math.random() * TAU;
        for (let i = 0; i < 5; i++) spots.push({ x: tx + Math.cos(b + i * TAU / 5) * 240, y: ty + Math.sin(b + i * TAU / 5) * 240, r: 130 });
        st.spots = spots.map(s => ({ x: Math.round(s.x), y: Math.round(s.y), r: s.r }));
        return st.spots.map(s => circ(s.x, s.y, s.r));
      }
      case 'whirl': return [circ(x, y, 430), circ(x, y, 100, true)];
      case 'ibuse': {
        // The salamander rises beside him on the side away from the camera.
        const f = ca >= 0 ? 1 : -1, bx = x - f * 70, by = y - 110;
        const mx = bx + f * 118 * IS;
        const ba = Math.atan2(ty - (by + 6), tx - mx);
        st.spots = [{ x: Math.round(bx), y: Math.round(by), f, mx: Math.round(mx), my: Math.round(by + 6), a: r1(ba) }];
        return [{ k: 'cone', x: mx, y: by + 6, a: ba, r: 880, h: .42 }];
      }
      case 'blink': return [circ(tx, ty, 260, true)];
      case 'storm': return [circ(x, y, 340), circ(x, y, 800, true)];
    }
    if (id === 'guy') switch (move) {
      case 'senpu': { const len = Math.max(0, d - 40); return [line(len, 40), circ(x + ca * len, y + sa * len, 300)]; }
      case 'entry': return [circ(tx, ty, 260), line(d, 26)];
      case 'peacock': return [{ k: 'cone', x, y, a, r: 640, h: .55 }];
      case 'gate': return [circ(x, y, 280)];
      case 'tiger': { const len = Math.max(320, Math.min(920, d + 120)); st.spots = [{ len }]; return [line(len, 70), circ(x + ca * len, y + sa * len, 320)]; }
      case 'elephant': {
        const out = [];
        for (let i = 0; i < 5; i++) { const dd = 150 + i * 150, r = 120 + i * 10; out.push(circ(x + ca * dd, y + sa * dd, r)); }
        return out;
      }
      case 'night': { const len = Math.max(500, Math.min(1150, d + 260)); st.spots = [{ len }]; return [line(len, 95), circ(x + ca * len, y + sa * len, 420)]; }
    }
    if (id === 'lee') switch (move) {
      case 'whirl': { const len = Math.max(0, d - 30); return [line(len, 34), circ(x + ca * len, y + sa * len, 210)]; }
      case 'lotus': return [circ(tx, ty, 230), line(d, 26)];
      case 'drunk': return [circ(tx, ty, 300, true)];
      case 'hurricane': return [circ(x, y, 340), circ(x, y, 170, true)];
      case 'weights': return [circ(x, y, 130), circ(tx, ty, 300, true)];
      case 'ura': return [circ(tx, ty, 300), circ(tx, ty, 150, true)];
      case 'peacock': return [circ(tx, ty, 420, true)];
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    const id = z.bossId, move = forced || m.moves[st.casts % m.moves.length];
    if (!forced) st.casts++;
    const def = MOVES[id][move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = r1(p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0);
    st.tx = Math.round(p ? p.x : z.x); st.ty = Math.round(p ? p.y : z.y);
    st.seed = r1(Math.random() * 99);
    st.tele = teleFor(z, st, id, move);
    if (id === 'guy' && (move === 'night' || move === 'gate')) st.gateT = def.windup + .5;
    if (id === 'lee' && (move === 'ura' || move === 'peacock')) st.gateT = def.windup + 4;
    if (id === 'lee' && move === 'drunk') st.drunk = def.windup + 3.4;
    if (id === 'hanzo' && move === 'storm') addFx(st, { kind: 'poof', x: z.x, y: z.y, r: 220, dur: 1.2 });
  }

  // ------------------------------------------------------------------ movement helpers
  // Straight dash: houses on the way are smashed, walls stop it.
  function startDash(z, st, a, len, dur, dmg, w, end, trail, heavy) {
    st.dash = { a: r1(a), speed: len / dur, left: dur, hit: 0, wt: 0, w, dmg, end, heavy: heavy ? 1 : 0 };
    addFx(st, { kind: 'dash', pts: [], a: r1(a), dur: dur + .45, x0: Math.round(z.x), y0: Math.round(z.y), x1: Math.round(z.x), y1: Math.round(z.y), rgb: trail || '255,255,255' });
  }
  // Leap along a parabola from where he stands to (x1, y1), peak h px.
  function startArc(z, st, x1, y1, dur, h, end, spin) {
    st.arc = { t: 0, dur, h, x0: z.x, y0: z.y, x1, y1, end, spin: spin || 0 };
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, api) {
    const id = z.bossId, move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), seed = st.seed;
    const p = api.player;
    if (id === 'hanzo') castHanzo(z, st, api, move, D, a, ca, sa, seed, p);
    else if (id === 'guy') castGuy(z, st, api, move, D, a, ca, sa, seed, p);
    else castLee(z, st, api, move, D, a, ca, sa, seed, p);
  }

  function fogFx(st, pts, dur, D, k = .28) {
    const fx = addFx(st, { kind: 'fog', pts, dur, tick: .5 });
    fx.upd = (f, dt, api) => {
      if ((f.tick -= dt) > 0) return;
      f.tick = .5;
      for (const q of f.pts) if (f.age > q.t0 + .15 && f.age < f.dur - .8) api.strike(q.x, q.y, q.r * .82, D * k, null, null, true);
    };
    return fx;
  }

  function castHanzo(z, st, api, move, D, a, ca, sa, seed, p) {
    const fac = facingOf(z);
    switch (move) {
      case 'kusa': {
        const len = 760, sp = 2400, x0 = z.x, y0 = z.y;
        addFx(st, { kind: 'chain', x: Math.round(x0), y: Math.round(y0), a: r1(a), len, sp, dur: 1.35 });
        for (let d0 = 0; d0 < len; d0 += 190) later(st, d0 / sp, api => api.line(x0 + ca * d0, y0 + sa * d0, x0 + ca * (d0 + 190), y0 + sa * (d0 + 190), 40, D * 1.7, d0 > 380 ? 'blade' : null));
        later(st, len / sp + .02, api => {
          const p0 = api.player;
          const q = p0 && p0.pseudo ? (api.nearestFoe ? api.nearestFoe(x0 + ca * len / 2, y0 + sa * len / 2, len / 2 + 70) : null) : p0;
          if (q && segDist(q.x, q.y, x0, y0, x0 + ca * len, y0 + sa * len) < 70) {
            const dd = Math.hypot(q.x - z.x, q.y - z.y);
            api.knockback(z, len + 80, -Math.min(520, Math.max(0, dd - 110)), D * .4);
          }
          api.shake(8);
        });
        later(st, .78, api => {
          api.strike(z.x, z.y, 190, D * 1.9, null, 'blade', true);
          api.knockback(z, 200, 150, 0);
          addFx(st, { kind: 'slash', x: Math.round(z.x), y: Math.round(z.y), a: r1(a), r: 200, h: 1.4, side: 1, dur: .6, rgb: '220,230,255' });
          api.shake(9);
        });
        st.hold = 1.0;
        break;
      }
      case 'gas': {
        const hx = z.x + fac * 14, hy = z.y;
        const list = st.spots.map((s, i) => ({ x: s.x, y: s.y, r: s.r, t0: r1(.05 + i * .08), fl: .55 }));
        addFx(st, { kind: 'lob', x: Math.round(hx), y: Math.round(hy), list, dur: 1.4 });
        const pts = [];
        list.forEach((s, i) => {
          later(st, s.t0 + s.fl, api => {
            api.strike(s.x, s.y, s.r, D * 1.4, null, i === 0 ? 'vortex' : null, true);
            api.shake(i ? 4 : 9);
          });
          pts.push({ x: s.x, y: s.y, r: s.r * 1.05, t0: r1(s.t0 + s.fl), seed: r1(hash(i + seed) * 50) });
        });
        fogFx(st, pts, 6.2, D);
        st.hold = .5;
        break;
      }
      case 'whirl': {
        const dir = Math.random() < .5 ? 1 : -1;
        const fx = addFx(st, { kind: 'whirl', x: Math.round(z.x), y: Math.round(z.y), a0: r1(a), dir, sw: 1.15, dur: 1.5, tick: 0, wt: .2 });
        fx.upd = (f, dt, api) => {
          if (f.age > f.sw) return;
          const ang = f.a0 + f.dir * TAU * 2 * easeInOut(f.age / f.sw), rr = 110 + 320 * easeOut(f.age / .3);
          if ((f.tick -= dt) <= 0) { f.tick = .05; api.line(f.x, f.y, f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr, 34, D * 1.5); }
          if ((f.wt -= dt) <= 0) { f.wt = .28; api.world(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr, 90, D * 2, 'blade', ang); }
        };
        st.hold = 1.2;
        api.shake(6);
        break;
      }
      case 'ibuse': {
        const s = st.spots[0], T = 3.3;
        const fx = addFx(st, { kind: 'ibuse', bx: s.x, by: s.y, f: s.f, mx: s.mx, my: s.my, a: s.a, r: 880, h: .42, T, dur: T + .9 });
        api.shake(12); api.burst(s.x, s.y - 40, '#c8b8e8', 12);
        const pts = conePts(s.mx, s.my, s.a, 880, .42);
        pts.forEach(q => later(st, .45 + q.d / 900, api => api.strike(q.x, q.y, q.r, D * 1.6, null, null, true)));
        const fog = [];
        for (let i = 0; i < 11; i++) {
          const dd = 140 + i * 68 + rand(-20, 20), aa = s.a + rand(-.8, .8) * .42 * Math.min(1, dd / 300);
          fog.push({ x: Math.round(s.mx + Math.cos(aa) * dd), y: Math.round(s.my + Math.sin(aa) * dd), r: Math.round(80 + i * 6 + rand(0, 26)), t0: r1(.5 + dd / 900), seed: r1(rand(0, 50)) });
        }
        fogFx(st, fog, 6.4, D);
        later(st, .9, api => { api.world(s.mx + Math.cos(s.a) * 420, s.my + Math.sin(s.a) * 420, 150, D * 2, 'vortex', s.a); });
        st.hold = 2.0;
        void fx;
        break;
      }
      case 'blink': {
        addFx(st, { kind: 'poof', x: Math.round(z.x), y: Math.round(z.y), r: 110, dur: .9, pk: 'violet' });
        for (let k = 0; k < 3; k++) {
          const t0 = k * .85;
          later(st, t0, api => {
            const q = api.player; if (!q) return;
            // Melt into the gas, then form again just behind the target.
            if (k) addFx(st, { kind: 'poof', x: Math.round(z.x), y: Math.round(z.y), r: 100, dur: .9, pk: 'violet' });
            const back = Math.atan2(q.y - z.y, q.x - z.x) + (k === 1 ? Math.PI * .6 : 0);
            const spot = freeSpot(api, q.x + Math.cos(back) * 130, q.y + Math.sin(back) * 130, z.r) || { x: z.x, y: z.y };
            st.vanish = .5;
            const mk = addFx(st, { kind: 'mark', x: Math.round(spot.x), y: Math.round(spot.y), r: 175, dur: .55, rgb: '200,150,255' });
            later(st, .5, api => {
              z.x = spot.x; z.y = spot.y;
              const q2 = api.player; if (q2) z.angle = Math.atan2(q2.y - z.y, q2.x - z.x);
              addFx(st, { kind: 'poof', x: Math.round(z.x), y: Math.round(z.y), r: 90, dur: .8, pk: 'violet' });
              api.strike(z.x, z.y, 175, D * 1.9, null, 'blade', true);
              addFx(st, { kind: 'slash', x: Math.round(z.x), y: Math.round(z.y), a: r1(z.angle), r: 185, h: 1.6, side: k % 2 ? -1 : 1, dur: .55, rgb: '220,200,255' });
              api.shake(10);
              void mk;
            });
          });
        }
        st.hold = 2.7;
        break;
      }
      case 'storm': castStorm(z, st, api, D, seed);
    }
  }

  // Ultimate: Hanzō rides Ibuse. 0 s rise, 1.0–3.2 s sweeping breath, 3.4–5.0 s gas bomb rain,
  // 5.2 s aim, 6.5 s the poison blast, 7.6 s Ibuse vanishes in smoke.
  function castStorm(z, st, api, D, seed) {
    const p = api.player, f = p && p.x < z.x ? -1 : 1;
    const ib = st.ib = { t: 0, x: Math.round(z.x - f * 80 * IS_ULT), y: Math.round(z.y), f, dur: 7.7, act: 0, seed };
    const mouth = () => ({ x: ib.x + ib.f * 118 * IS_ULT, y: ib.y + 6 });
    addFx(st, { kind: 'poof', x: Math.round(z.x), y: Math.round(z.y), r: 230, dur: 1.1 });
    addFx(st, { kind: 'impact', x: Math.round(z.x), y: Math.round(z.y), r: 330, dur: 1.5, rgb: '200,120,255' });
    api.strike(z.x, z.y, 330, D * 2.4, null, 'crater', true);
    api.knockback(z, 340, 130, 0);
    api.shake(22);
    // Sweeping breath: telegraphed as a sector, then the plume swings across it.
    later(st, .25, api => {
      const q = api.player, m = mouth(), aa = q ? Math.atan2(q.y - m.y, q.x - m.x) : (ib.f > 0 ? 0 : Math.PI), dir = Math.random() < .5 ? 1 : -1;
      const fx = addFx(st, { kind: 'sweep', x: Math.round(m.x), y: Math.round(m.y), a0: r1(aa - dir * 1.5), a1: r1(aa + dir * 1.5), r0: 60, r1: 760, warn: .85, sw: 1.5, dur: 3.0, tick: 0, ft: .18, n: 0 });
      fx.upd = (g, dt, api) => {
        if (g.age < g.warn || g.age > g.warn + g.sw) return;
        const ang = g.a0 + (g.a1 - g.a0) * easeInOut((g.age - g.warn) / g.sw), c = Math.cos(ang), s = Math.sin(ang);
        if ((g.tick -= dt) <= 0) { g.tick = .06; api.line(g.x + c * g.r0, g.y + s * g.r0, g.x + c * g.r1, g.y + s * g.r1, 70, D * 1.3); }
        if ((g.ft -= dt) <= 0 && g.n < 9) {
          g.ft = .17; g.n++;
          const fg = st.fx.find(e => e.kind === 'fog' && e.storm);
          const dd = 220 + Math.random() * 480;
          if (fg && fg.pts.length < 16) fg.pts.push({ x: Math.round(g.x + c * dd), y: Math.round(g.y + s * dd), r: Math.round(90 + Math.random() * 40), t0: r1(fg.age), seed: r1(Math.random() * 50) });
          if (g.n % 3 === 0) api.world(g.x + c * dd, g.y + s * dd, 110, D * 1.6, 'vortex', ang);
        }
      };
      const fg = fogFx(st, [], 7.2, D, .32); fg.storm = 1;
    });
    // Gas bomb rain spat high and falling round the target (one lob + one marks effect hold them all).
    later(st, 3.35, api => {
      const m = mouth();
      addFx(st, { kind: 'lob', x: Math.round(m.x), y: Math.round(m.y), list: [], dur: 3.3, high: 1, lift: Math.round(60 * IS_ULT) });
      addFx(st, { kind: 'marks', list: [], dur: 3.3, rgb: '200,120,255' });
    });
    for (let i = 0; i < 10; i++) later(st, 3.4 + i * .14, api => {
      const q = api.player; if (!q || !st.ib) return;
      const off = i === 0 ? 0 : 110 + Math.random() * 300, oa = Math.random() * TAU;
      const lob = st.fx.find(e => e.kind === 'lob' && e.high), mk = st.fx.find(e => e.kind === 'marks');
      const s = { x: Math.round(q.x + Math.cos(oa) * off), y: Math.round(q.y + Math.sin(oa) * off), r: 150, t0: lob ? r1(lob.age) : 0, fl: .95 };
      if (lob) lob.list.push(s);
      if (mk) mk.list.push({ x: s.x, y: s.y, r: 150, t0: r1(mk.age), d: s.fl });
      later(st, s.fl, api => {
        api.strike(s.x, s.y, 150, D * 2.0, null, i % 3 ? null : 'crater', true);
        api.shake(8);
        const fg = st.fx.find(e => e.kind === 'fog' && e.storm);
        if (fg && fg.pts.length < 16) fg.pts.push({ x: s.x, y: s.y, r: 120, t0: r1(fg.age), seed: r1(Math.random() * 50) });
      });
    });
    // The final blast: a huge cone of poison, telegraphed 1.3 s ahead.
    later(st, 5.2, api => {
      if (!st.ib) return;
      const q = api.player, m = mouth(), aa = q ? Math.atan2(q.y - m.y, q.x - m.x) : 0;
      ib.blast = { a: r1(aa), t0: r1(ib.t), x: Math.round(m.x), y: Math.round(m.y) };
      addFx(st, { kind: 'coneMark', x: Math.round(m.x), y: Math.round(m.y), a: r1(aa), r: 950, h: .62, dur: 1.3, rgb: '190,90,255' });
    });
    later(st, 6.5, api => {
      const b = ib.blast; if (!b || !st.ib) return;
      conePts(b.x, b.y, b.a, 950, .62).forEach(q => later(st, q.d / 1600, api => api.strike(q.x, q.y, q.r, D * 3.4, null, null, true)));
      addFx(st, { kind: 'blastCone', x: b.x, y: b.y, a: b.a, r: 950, h: .62, dur: 1.8 });
      const pts = [];
      for (let i = 0; i < 14; i++) {
        const dd = 160 + (i / 13) * 720 + rand(-30, 30), aa = b.a + rand(-.85, .85) * .62;
        pts.push({ x: Math.round(b.x + Math.cos(aa) * dd), y: Math.round(b.y + Math.sin(aa) * dd), r: Math.round(95 + rand(0, 45)), t0: r1(.1 + dd / 1600), seed: r1(rand(0, 50)) });
      }
      fogFx(st, pts, 6.5, D, .32);
      for (const dd of [380, 700]) api.world(b.x + Math.cos(b.a) * dd, b.y + Math.sin(b.a) * dd, 190, D * 3, 'vortex', b.a);
      api.shake(24);
    });
  }

  // Might Guy's painter wrapper (might-guy-vfx.js), fed one effect at a time.
  function mgFx(st, sub, o, dur, layer) { return addFx(st, { kind: 'mg', sub, o, dur, layer: layer || 1 }); }

  function castGuy(z, st, api, move, D, a, ca, sa, seed, p) {
    switch (move) {
      case 'senpu': {
        const len = st.tele[0] ? st.tele[0].len : 0;
        const go = () => {
          const ex = z.x, ey = z.y;
          api.strike(ex, ey, 300, D * 2.3, null, 'shockwave', true);
          api.knockback(z, 310, 210, 0);
          api.shake(15);
          addFx(st, { kind: 'kick', x: Math.round(ex), y: Math.round(ey), r: 300, dur: .9, rgb: '255,150,70', hot: 1 });
          addFx(st, { kind: 'impact', x: Math.round(ex), y: Math.round(ey), r: 300, dur: 1.4, rgb: '255,120,60' });
        };
        if (len > 20) startDash(z, st, a, len, .26, D * 1.8, 54, go, '255,170,110', 1); else go();
        break;
      }
      case 'entry': {
        const tx = st.tx, ty = st.ty, spot = freeSpot(api, tx, ty, z.r) || { x: z.x, y: z.y }, dur = .62;
        mgFx(st, 'entry', { x: Math.round(spot.x), y: Math.round(spot.y), radius: 300, land: .3 }, dur / .3, 0);
        startArc(z, st, spot.x, spot.y, dur, 170, api => {
          api.strike(z.x, z.y, 260, D * 2.7, null, 'crater', true);
          api.knockback(z, 280, 220, 0);
          api.shake(22);
        });
        break;
      }
      case 'peacock': {
        const s = st.tele[0], x0 = z.x, y0 = z.y;
        mgFx(st, 'peacock', { x: Math.round(x0), y: Math.round(y0), angle: r1(a), radius: 640, scale: 1.7 }, 1.25, 1);
        for (let k = 0; k < 5; k++) later(st, .1 + k * .15, api => {
          conePts(x0, y0, s.a, s.r * (.7 + k * .075), s.h).forEach(q => api.strike(q.x, q.y, q.r, D * 1.0, null, null, true));
          api.shake(6);
        });
        later(st, .5, api => { api.world(x0 + ca * 380, y0 + sa * 380, 170, D * 2.4, 'fire', a); api.world(x0 + ca * 600, y0 + sa * 600, 150, D * 2.4, 'fire', a); });
        const pts = [];
        for (let i = 0; i < 7; i++) { const dd = 180 + i * 70, aa = a + (hash(i + seed) - .5) * 1.0; pts.push({ x: Math.round(x0 + Math.cos(aa) * dd), y: Math.round(y0 + Math.sin(aa) * dd), r: 60 + i * 5, t0: r1(.3 + i * .05) }); }
        addFx(st, { kind: 'embers', pts, dur: 3.2 });
        st.hold = .95;
        break;
      }
      case 'gate': {
        st.gate = Math.min(1, st.gate + .33);
        z.speedScale = 1 + .3 * st.gate;
        api.strike(z.x, z.y, 280, D * 1.5, null, 'shockwave', true);
        api.knockback(z, 290, 240, 0);
        api.shake(14);
        addFx(st, { kind: 'gateBurst', x: Math.round(z.x), y: Math.round(z.y), r: 280, dur: 1.5, lvl: r1(st.gate) });
        st.hold = .5;
        break;
      }
      case 'tiger': {
        const len = st.spots[0].len, x0 = z.x, y0 = z.y, ex = x0 + ca * len, ey = y0 + sa * len, T = 1.3;
        mgFx(st, 'tiger', { x: Math.round(ex), y: Math.round(ey), fromX: Math.round(x0 + ca * 30), fromY: Math.round(y0 + sa * 30), angle: r1(a), radius: 330 }, T, 1);
        const travel = T * .4;
        for (let d0 = 0; d0 < len; d0 += 200) later(st, travel * d0 / len, api => api.line(x0 + ca * d0, y0 + sa * d0, x0 + ca * Math.min(len, d0 + 200), y0 + sa * Math.min(len, d0 + 200), 70, D * 1.6, d0 % 400 === 0 ? 'shockwave' : null));
        later(st, T * .37, api => {
          api.strike(ex, ey, 320, D * 3.2, null, 'crater', true);
          api.knockback({ x: ex, y: ey }, 340, 260, 0);
          api.shake(24);
        });
        st.hold = .8;
        api.shake(8);
        break;
      }
      case 'elephant': {
        const x0 = z.x, y0 = z.y, cols = [], M = 1.7, step = .17;
        for (let i = 0; i < 5; i++) { const dd = 150 + i * 150; cols.push(Math.round(ca * dd), Math.round(sa * dd)); }
        mgFx(st, 'elephant', { x: Math.round(x0), y: Math.round(y0), cols, step: r1(step / M * 1000) / 1000, scale: 1.45, fist: 1.2 }, M, 0);
        for (let i = 0; i < 5; i++) {
          const dd = 150 + i * 150, r = 120 + i * 10;
          later(st, M * (i * step / M + .12), api => {
            api.strike(x0 + ca * dd, y0 + sa * dd, r, D * 2.1, null, i % 2 ? 'shockwave' : 'crater', true);
            api.shake(10);
          });
        }
        st.hold = 1.1;
        break;
      }
      case 'night': {
        const len = st.spots[0].len, x0 = z.x, y0 = z.y, ex = x0 + ca * len, ey = y0 + sa * len, dur = .42;
        st.gate = 1; z.speedScale = 1.3;
        addFx(st, { kind: 'nightTrail', x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(ex), y1: Math.round(ey), a: r1(a), dur: 2.6 });
        mgFx(st, 'finisher', { x: Math.round(ex), y: Math.round(ey), angle: r1(a), radius: 520 }, 1.7, 1);
        startDash(z, st, a, len, dur, D * 3.0, 95, api => {
          api.strike(ex, ey, 420, D * 5.2, null, 'crater', true);
          api.knockback({ x: ex, y: ey }, 440, 300, 0);
          api.shake(32);
          addFx(st, { kind: 'impact', x: Math.round(ex), y: Math.round(ey), r: 430, dur: 1.9, rgb: '255,50,40' });
          // He burns out: kneels steaming for a moment.
          st.hold = 1.6; st.gateT = 0; st.gate = .35; z.speedScale = 1;
        }, '255,60,50', 1);
        api.shake(14);
        break;
      }
    }
  }

  function castLee(z, st, api, move, D, a, ca, sa, seed, p) {
    switch (move) {
      case 'whirl': {
        const len = st.tele[0] ? st.tele[0].len : 0;
        const go = () => {
          api.strike(z.x, z.y, 210, D * 1.7, null, 'shockwave', true);
          api.knockback(z, 220, 170, 0);
          api.shake(10);
          addFx(st, { kind: 'kick', x: Math.round(z.x), y: Math.round(z.y), r: 210, dur: .8, rgb: '190,255,170' });
          addFx(st, { kind: 'leaves', x: Math.round(z.x), y: Math.round(z.y), r: 240, dur: 1.2 });
        };
        if (len > 20) startDash(z, st, a, len, .22, D * 1.4, 44, go, '200,255,190'); else go();
        break;
      }
      case 'lotus': {
        const tx = st.tx, ty = st.ty, spot = freeSpot(api, tx, ty, z.r) || { x: z.x, y: z.y };
        const d = Math.hypot(spot.x - z.x, spot.y - z.y);
        addFx(st, { kind: 'mark', x: Math.round(spot.x), y: Math.round(spot.y), r: 230, dur: 1.05, rgb: '240,235,215' });
        const rise = () => {
          api.strike(z.x, z.y, 110, D * 1.0, null, null, true);
          api.shake(6);
          addFx(st, { kind: 'ribbon', x: Math.round(z.x), y: Math.round(z.y), dur: 1.0 });
          startArc(z, st, z.x, z.y, .85, 230, api => {
            api.strike(z.x, z.y, 230, D * 2.6, null, 'crater', true);
            api.knockback(z, 240, 160, 0);
            api.shake(18);
            addFx(st, { kind: 'impact', x: Math.round(z.x), y: Math.round(z.y), r: 240, dur: 1.4, rgb: '255,240,210' });
          }, 1);
        };
        if (d > 20) startDash(z, st, Math.atan2(spot.y - z.y, spot.x - z.x), d, .2, D * 1.2, 40, rise, '230,240,220'); else rise();
        break;
      }
      case 'drunk': {
        st.drunk = 4;
        for (let k = 0; k < 5; k++) later(st, k * .55, api => {
          const q = api.player; if (!q) return;
          const oa = Math.random() * TAU, off = k === 4 ? 0 : 40 + Math.random() * 110;
          const spot = freeSpot(api, q.x + Math.cos(oa) * off, q.y + Math.sin(oa) * off, z.r) || { x: z.x, y: z.y };
          addFx(st, { kind: 'mark', x: Math.round(spot.x), y: Math.round(spot.y), r: 125, dur: .42, rgb: '255,150,190' });
          later(st, .28, api => {
            const dd = Math.hypot(spot.x - z.x, spot.y - z.y), aa = Math.atan2(spot.y - z.y, spot.x - z.x);
            const hit = () => {
              api.strike(z.x, z.y, 125, D * 1.4, null, k === 4 ? 'crater' : null, true);
              api.shake(k === 4 ? 12 : 6);
              addFx(st, { kind: 'kick', x: Math.round(z.x), y: Math.round(z.y), r: 140, dur: .55, rgb: '255,190,220', wild: 1 });
            };
            if (dd > 15) startDash(z, st, aa, dd, .14, D * 1.0, 36, hit, '255,200,220'); else hit();
          });
        });
        st.hold = 3.0;
        break;
      }
      case 'hurricane': {
        mgFx(st, 'senpu', { x: Math.round(z.x), y: Math.round(z.y), radius: 360 }, 1.25, 1);
        [160, 260, 340].forEach((r, i) => later(st, .12 + i * .18, api => {
          api.strike(z.x, z.y, r, D * 1.25, null, i === 2 ? 'shockwave' : null, true);
          if (i === 2) api.knockback(z, 350, 200, 0);
          api.shake(6 + i * 3);
        }));
        addFx(st, { kind: 'kick', x: Math.round(z.x), y: Math.round(z.y), r: 200, dur: .7, rgb: '210,255,190' });
        st.hold = .9;
        break;
      }
      case 'weights': {
        const fac = facingOf(z);
        addFx(st, { kind: 'weights', x: Math.round(z.x), y: Math.round(z.y), f: fac, dur: 2.4 });
        later(st, .35, api => {
          api.strike(z.x, z.y, 130, D * 1.2, null, 'crater', true);
          api.shake(16);
        });
        // Blink dashes through the target in a star: each line marked .4 s ahead.
        for (let k = 0; k < 4; k++) later(st, .6 + k * .5, api => {
          const q = api.player; if (!q) return;
          const aa = Math.atan2(q.y - z.y, q.x - z.x) + (k % 2 ? .5 : -.5) * (k ? 1 : .3), len = Math.hypot(q.x - z.x, q.y - z.y) + 260;
          addFx(st, { kind: 'lineMark', x: Math.round(z.x), y: Math.round(z.y), a: r1(aa), len: Math.round(len), w: 46, dur: .38, rgb: '230,240,255' });
          later(st, .36, api => {
            startDash(z, st, aa, len, .12, D * 1.6, 46, api => {
              addFx(st, { kind: 'boom', x: Math.round(z.x), y: Math.round(z.y), a: r1(aa), dur: .7 });
              api.shake(7);
            }, '235,245,255');
          });
        });
        st.hold = 2.8;
        break;
      }
      case 'ura': {
        const cx = st.tx, cy = st.ty, pts = [], n = 6;
        for (let i = 0; i <= n; i++) {
          if (i === n) { pts.push(0, 0); break; }
          const aa = i * 2.4 + seed, rr = 170 + hash(i + seed) * 90;
          pts.push(Math.round(Math.cos(aa) * rr), Math.round(Math.sin(aa) * rr * .7));
        }
        const T = 2.4, bloom = .4;
        mgFx(st, 'lotus', { x: cx, y: cy, pts, bloom, radius: 320 }, T, 0);
        st.vanish = T * bloom;
        for (let i = 0; i < n; i++) later(st, T * bloom * (i + 1) / n * .95, api => {
          api.strike(cx + pts[i * 2 + 2], cy + pts[i * 2 + 3], 115, D * 1.0, null, null, true);
          api.shake(5);
        });
        later(st, T * bloom, api => {
          const spot = freeSpot(api, cx, cy, z.r); if (spot) { z.x = spot.x; z.y = spot.y; }
          api.strike(cx, cy, 300, D * 3.0, null, 'crater', true);
          api.knockback({ x: cx, y: cy }, 320, 230, 0);
          api.shake(22);
        });
        st.hold = T * bloom + .6;
        break;
      }
      case 'peacock': {
        const N = 5, gap = .48;
        // Phase 1: five ricochet dashes across the target's area, each line marked .5 s ahead.
        for (let k = 0; k < N; k++) later(st, k * gap, api => {
          const q = api.player; if (!q) return;
          const aa = Math.atan2(q.y - z.y, q.x - z.x) + (hash(k + st.seed) - .5) * .7, len = Math.min(900, Math.hypot(q.x - z.x, q.y - z.y) + 300);
          addFx(st, { kind: 'lineMark', x: Math.round(z.x), y: Math.round(z.y), a: r1(aa), len: Math.round(len), w: 50, dur: .4, rgb: '255,120,60' });
          later(st, .38, api => startDash(z, st, aa, len, .13, D * 1.6, 50, api => {
            addFx(st, { kind: 'boom', x: Math.round(z.x), y: Math.round(z.y), a: r1(aa), dur: .7, hot: 1 });
            api.shake(8);
          }, '255,140,90'));
        });
        // Phase 2: the peacock: a barrage of burning fists fanned at the target.
        const t2 = N * gap + .3;
        later(st, t2, api => {
          const q = api.player, aa = q ? Math.atan2(q.y - z.y, q.x - z.x) : st.aim;
          addFx(st, { kind: 'coneMark', x: Math.round(z.x), y: Math.round(z.y), a: r1(aa), r: 700, h: .7, dur: .8, rgb: '255,100,40' });
          later(st, .8, api => {
            const x0 = z.x, y0 = z.y;
            mgFx(st, 'peacock', { x: Math.round(x0), y: Math.round(y0), angle: r1(aa), radius: 700, scale: 2 }, 1.45, 1);
            for (let k = 0; k < 6; k++) later(st, .08 + k * .14, api => {
              conePts(x0, y0, aa, 700 * (.7 + k * .06), .7).forEach(q => api.strike(q.x, q.y, q.r, D * 1.0, null, null, true));
              api.shake(7);
            });
            later(st, .5, api => { for (const dd of [320, 560]) api.world(x0 + Math.cos(aa) * dd, y0 + Math.sin(aa) * dd, 170, D * 2.6, 'fire', aa); });
            const pts = [];
            for (let i = 0; i < 8; i++) { const dd = 180 + i * 70, an = aa + (hash(i * 3 + st.seed) - .5) * 1.2; pts.push({ x: Math.round(x0 + Math.cos(an) * dd), y: Math.round(y0 + Math.sin(an) * dd), r: 64 + i * 5, t0: r1(.3 + i * .05) }); }
            addFx(st, { kind: 'embers', pts, dur: 3.4 });
          });
        });
        st.hold = t2 + 2.1;
        break;
      }
    }
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
    if (z.health <= 0) {
      z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.arc = null; st.ev.length = 0; st.windup = 0; st.move = ''; st.lift = 0; st.vanish = 0;
      if (st.ib) { addFx(st, { kind: 'poof', x: st.ib.x, y: st.ib.y, r: 300, dur: 1.4 }); st.ib = null; }
      z.speedScale = 1;
      z.manualBusy = false;
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.gateT = Math.max(0, st.gateT - dt);
    st.drunk = Math.max(0, st.drunk - dt);
    st.vanish = Math.max(0, st.vanish - dt);
    z.armorScale = (m.armor || 1) * (st.ib ? .7 : 1) * (z.bossId === 'guy' && st.gateT > 0 ? .75 : 1);
    z.kageDash = 0;

    if (st.dash) {
      const ds = st.dash, D = api.damage || 60;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if (ds.heavy && (ds.wt -= dt) <= 0) { ds.wt = .1; api.world(nx, ny, 80, D * 2.5, 'shockwave', ds.a); }
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .05; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      z.angle = ds.a;
      const tr = st.fx.find(f => f.kind === 'dash' && f.age < .4 && f.a === ds.a);
      if (tr) { tr.x1 = Math.round(z.x); tr.y1 = Math.round(z.y); tr.pts.push(Math.round(z.x), Math.round(z.y)); if (tr.pts.length > 16) tr.pts.splice(0, 2); }
      if (ds.left <= 0) { const end = ds.end; st.dash = null; if (end) end(api); }
    }
    if (st.arc) {
      const ar = st.arc;
      ar.t += dt;
      const k = clamp01(ar.t / ar.dur), e = ar.spin ? k : easeInOut(k);
      const nx = ar.x0 + (ar.x1 - ar.x0) * e, ny = ar.y0 + (ar.y1 - ar.y0) * e;
      if (!api.blocked(nx, ny, z.r * .5)) { z.x = nx; z.y = ny; }
      // Front Lotus: shoot up fast, hang, then drill down; a jump otherwise.
      st.lift = ar.spin ? ar.h * (k < .55 ? easeOut(k / .55) : 1 - easeIn((k - .55) / .45)) : ar.h * Math.sin(Math.PI * k);
      z.kageDash = .05;
      if (k >= 1) { const end = ar.end; st.arc = null; st.lift = 0; if (end) end(api); }
    }
    if (st.vanish > 0) z.kageDash = Math.max(z.kageDash, .05);
    if (st.ib) {
      const ib = st.ib;
      ib.t += dt;
      // Hanzō stands on Ibuse's head while it fights.
      z.x = ib.x + ib.f * 80 * IS_ULT; z.y = ib.y;
      z.kageDash = Math.max(z.kageDash, .05);
      st.lift = 112 * IS_ULT * clamp01(ib.t / .5);
      if (ib.t >= ib.dur) {
        addFx(st, { kind: 'poof', x: ib.x, y: ib.y, r: 300, dur: 1.4 });
        st.ib = null; st.lift = 0; st.timer = MOVES.hanzo.storm.after;
      }
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[z.bossId][st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.arc && !st.ib && st.hold <= 0) {
      if (z.manual) {
        // driven by the user: cast only what was asked for, aimed at the cursor
        const want = z.manualCast != null ? MANUAL[z.bossId][z.manualCast] : null;
        z.manualCast = null;
        if (want) announce(z, st, m, api, want);
      } else {
        st.timer -= dt;
        const p = api.player;
        if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 950) announce(z, st, m, api);
      }
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.arc || !!st.ib;
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.lift = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ cached art
  function blob(g, pts) {
    const n = pts.length, m = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    g.beginPath();
    let q = m(n - 1); g.moveTo(q[0], q[1]);
    for (let i = 0; i < n; i++) { q = m(i); g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
    g.closePath();
  }
  const IB = { line: '#121219', body: '#3b4052', dark: '#262a39', spot: '#7a7f9c', belly: '#a69fb6', bellyD: '#7c7590' };
  function cel(g, path, fill, shadeFn, lw = 3.4) {
    path(); g.fillStyle = fill; g.fill();
    if (shadeFn) { g.save(); path(); g.clip(); shadeFn(); g.restore(); }
    path(); g.strokeStyle = IB.line; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
  }
  // Ibuse, the giant salamander: flat wide head, beady eyes, a long body low on four stubby legs,
  // a paddle tail; slate-dark hide with pale spots and a lilac belly. Faces +x; origin = ground under its head.
  function ibuseSpr(open) {
    return Kit().sprite('dv:ibuse' + (open ? 1 : 0), 780, 340, g => {
      g.scale(2, 2); g.translate(270, 160);   // covers x -270..120, y -160..10
      g.lineJoin = 'round'; g.lineCap = 'round';
      const leg = (x, y, w, h, c, fw) => {
        cel(g, () => blob(g, [[x - w * .5, y - h], [x + w * .5, y - h], [x + w * .6, y - 6], [x + w * .5 + fw, y], [x - w * .6, y], [x - w * .6, y - 8]]), c, () => {
          g.fillStyle = 'rgba(10,10,20,.3)'; g.fillRect(x - w, y - h * .5, w * .7, h);
        }, 3);
        g.strokeStyle = IB.line; g.lineWidth = 2;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + w * .1 + i * 6 + fw * .3, y - 2); g.lineTo(x + w * .2 + i * 7 + fw * .5, y + 3); g.stroke(); }
      };
      // far legs
      leg(-150, -4, 26, 44, IB.dark, 10); leg(30, -6, 26, 46, IB.dark, 12);
      // tail: a long flattened paddle curling up at the tip
      cel(g, () => blob(g, [[-150, -90], [-205, -86], [-250, -70], [-268, -84], [-262, -50], [-220, -36], [-160, -30]]), IB.body, () => {
        g.fillStyle = IB.dark; g.fillRect(-280, -56, 140, 30);
        g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(-260, -86, 110, 6);
      });
      // body
      const body = () => blob(g, [[-170, -94], [-110, -112], [-30, -116], [40, -106], [70, -60], [40, -26], [-60, -18], [-150, -24], [-185, -54]]);
      cel(g, body, IB.body, () => {
        g.fillStyle = IB.belly; blob(g, [[-150, -40], [-60, -46], [40, -50], [50, -20], [-60, -12], [-150, -18]]); g.fill();
        g.fillStyle = IB.bellyD; g.fillRect(-180, -28, 260, 20);
        g.fillStyle = 'rgba(255,255,255,.12)'; blob(g, [[-140, -106], [-40, -114], [20, -106], [-40, -100], [-130, -98]]); g.fill();
        g.fillStyle = IB.dark; g.fillRect(-200, -70, 260, 14);
        // pale spots scattered along the back, with darker rims
        for (let i = 0; i < 16; i++) {
          const x = -165 + hash(i * 3.1) * 200, y = -104 + hash(i * 7.7) * 40, r = 4 + hash(i * 1.9) * 7;
          g.fillStyle = IB.dark; g.beginPath(); g.ellipse(x, y, r + 1.6, (r + 1.6) * .7, 0, 0, TAU); g.fill();
          g.fillStyle = IB.spot; g.beginPath(); g.ellipse(x, y, r, r * .7, 0, 0, TAU); g.fill();
        }
        // skin folds along the flank
        g.strokeStyle = 'rgba(15,15,25,.55)'; g.lineWidth = 2.2;
        for (let i = 0; i < 6; i++) { const x = -140 + i * 30; g.beginPath(); g.moveTo(x, -52); g.quadraticCurveTo(x + 8, -42, x + 2, -30); g.stroke(); }
      });
      // head: broad and flat, wider than the neck
      const head = () => blob(g, [[30, -112], [80, -120], [116, -98], [122, -62], [100, -36], [50, -32], [20, -56]]);
      cel(g, head, IB.body, () => {
        g.fillStyle = IB.belly; blob(g, [[40, -56], [100, -60], [122, -50], [104, -34], [50, -34]]); g.fill();
        g.fillStyle = 'rgba(255,255,255,.14)'; blob(g, [[50, -114], [92, -118], [110, -100], [80, -104]]); g.fill();
        for (let i = 0; i < 6; i++) {
          const x = 44 + hash(i * 5.3 + 2) * 60, y = -108 + hash(i * 2.9 + 1) * 34, r = 3 + hash(i * 4.1) * 4;
          g.fillStyle = IB.spot; g.beginPath(); g.ellipse(x, y, r, r * .7, 0, 0, TAU); g.fill();
        }
      });
      // mouth: the wide salamander grin, or gaping and leaking poison
      if (open) {
        g.beginPath(); g.moveTo(56, -64); g.quadraticCurveTo(96, -74, 124, -70); g.quadraticCurveTo(118, -36, 84, -30); g.quadraticCurveTo(62, -40, 56, -64); g.closePath();
        g.fillStyle = '#3a0f3e'; g.fill(); g.strokeStyle = IB.line; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#9a3aa8'; g.beginPath(); g.ellipse(94, -46, 18, 7, -.1, 0, TAU); g.fill();
        g.fillStyle = 'rgba(200,120,255,.7)'; g.beginPath(); g.ellipse(100, -52, 10, 4, -.2, 0, TAU); g.fill();
      } else {
        g.strokeStyle = IB.line; g.lineWidth = 3; g.beginPath(); g.moveTo(50, -58); g.quadraticCurveTo(90, -50, 122, -60); g.stroke();
      }
      // beady eyes on top of the head
      for (const [x, y, s] of [[78, -110, 1], [100, -106, .8]]) {
        g.fillStyle = IB.line; g.beginPath(); g.ellipse(x, y, 7 * s, 5 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8d070'; g.beginPath(); g.ellipse(x, y, 5 * s, 3.6 * s, 0, 0, TAU); g.fill();
        g.fillStyle = IB.line; g.beginPath(); g.ellipse(x + 1, y, 1.6 * s, 3.2 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 1.6 * s, y - 1.4 * s, 1.2 * s, 0, TAU); g.fill();
      }
      g.fillStyle = IB.line; g.beginPath(); g.ellipse(116, -86, 2.4, 1.6, .3, 0, TAU); g.fill();
      // near legs
      leg(-120, 2, 30, 48, IB.body, 12); leg(56, 0, 30, 50, IB.body, 14);
    });
  }
  function drawIbuse(ctx, x, y, f, s, open, k, time, seed) {
    if (k <= .01) return;
    const K = Kit(), vio = K.puff('violet');
    ctx.save();
    ctx.globalAlpha = clamp01(k * 1.4);
    ctx.fillStyle = 'rgba(16,10,24,.3)'; ctx.beginPath(); ctx.ellipse(x - f * 70 * s, y, 220 * s, 34 * s, 0, 0, TAU); ctx.fill();
    // poison seeping off its hide
    for (let i = 0; i < 6; i++) {
      const ph = (time * .5 + hash(i * 1.7 + seed)) % 1, px = x + f * (-220 + hash(i * 3.1 + seed) * 300) * s;
      K.stamp(ctx, vio, px, y - (60 + ph * 120) * s, (20 + ph * 26) * s, bell(ph) * .35 * k);
    }
    const sc = s * (.55 + .45 * easeOut(k)), breath = 1 + Math.sin(time * 2.2 + seed) * .012;
    ctx.translate(x, y); ctx.scale(f * sc, sc * breath);
    ctx.drawImage(ibuseSpr(open), -270, -160, 390, 170);
    ctx.restore();
  }
  function fogSprite() {
    return Kit().sprite('dv:fog', 128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(150,80,190,.75)'); gr.addColorStop(.45, 'rgba(110,50,150,.55)'); gr.addColorStop(.75, 'rgba(80,40,110,.25)'); gr.addColorStop(1, 'rgba(70,30,100,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }
  function canisterSpr() {
    return Kit().sprite('dv:can', 28, 40, g => {
      g.translate(14, 20);
      g.fillStyle = '#121218'; g.beginPath(); g.roundRect ? g.roundRect(-8, -14, 16, 28, 5) : g.rect(-8, -14, 16, 28); g.fill();
      g.fillStyle = '#5a5e6c'; g.beginPath(); g.roundRect ? g.roundRect(-6, -12, 12, 24, 4) : g.rect(-6, -12, 12, 24); g.fill();
      g.fillStyle = '#9a3ad0'; g.fillRect(-6, -3, 12, 5);
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-4, -11, 2, 20);
      g.fillStyle = '#2a2c34'; g.fillRect(-3, -17, 6, 4);
    });
  }
  function sickleImg() {
    return Kit().sprite('dv:sickle', 70, 50, g => {
      g.translate(20, 26); g.lineCap = 'round';
      g.strokeStyle = '#121218'; g.lineWidth = 7; g.beginPath(); g.moveTo(-16, 0); g.lineTo(14, 0); g.stroke();
      g.strokeStyle = '#7a5434'; g.lineWidth = 4; g.stroke();
      g.beginPath(); g.moveTo(12, -3); g.quadraticCurveTo(36, -8, 46, 18); g.quadraticCurveTo(32, 2, 12, 3); g.closePath();
      g.fillStyle = '#121218'; g.lineWidth = 3; g.strokeStyle = '#121218'; g.stroke(); g.fillStyle = '#e4e9f0'; g.fill();
      g.fillStyle = 'rgba(70,80,110,.5)'; g.beginPath(); g.moveTo(12, 1); g.quadraticCurveTo(32, 1, 46, 18); g.lineTo(12, 3); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(14, -3, 14, 1.4);
    });
  }
  function leafImg(v) {
    return Kit().sprite('dv:leaf' + v, 24, 12, g => {
      g.fillStyle = ['#7fc95a', '#a8d86b', '#5fae46'][v];
      g.beginPath(); g.moveTo(1, 6); g.quadraticCurveTo(12, -2, 23, 6); g.quadraticCurveTo(12, 14, 1, 6); g.fill();
      g.strokeStyle = 'rgba(40,80,30,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(3, 6); g.lineTo(21, 6); g.stroke();
    });
  }
  function weightImg() {
    return Kit().sprite('dv:weight', 40, 30, g => {
      g.translate(20, 15);
      g.fillStyle = '#121218'; g.beginPath(); g.ellipse(0, 0, 17, 11, 0, 0, TAU); g.fill();
      g.fillStyle = '#d88a3a'; g.beginPath(); g.ellipse(0, 0, 15, 9, 0, 0, TAU); g.fill();
      g.fillStyle = '#a85e22'; g.fillRect(-15, 0, 30, 6);
      g.strokeStyle = '#4a2a10'; g.lineWidth = 1; for (let x = -10; x <= 10; x += 5) { g.beginPath(); g.moveTo(x, -8); g.lineTo(x, 8); g.stroke(); }
      g.font = 'bold 10px serif'; g.fillStyle = '#2a1608'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('根', 0, 0);
    });
  }

  // ------------------------------------------------------------------ telegraph painters
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = faint ? 3.5 : 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
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
      return;
    }
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    if (s.k === 'line') {
      if (s.len < 4) { ctx.restore(); return; }
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
  function dustRing(ctx, x, y, r, t, seed, n = 12, kind = 'dust', a = .5) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.2), a0 = 1 - win(t, .6, 1.8);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(i + seed) * .4, d = r * (.3 + e * (.62 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8 - hash(i * 4.4 + seed) * r * .1, r * (.07 + e * (.06 + hash(i * 6.1 + seed) * .05)), a0 * a, .75);
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
  function crescent(ctx, cx, cy, R, w, a0, a1, sq, sym) {
    const n = 18;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const an = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R * sq); }
    for (let i = n; i >= 0; i--) {
      const u = i / n, an = a0 + (a1 - a0) * u;
      const prof = sym ? Math.sin(Math.PI * u) : Math.pow(Math.sin(Math.PI * Math.pow(u, .7)), .8) * (.35 + .65 * u);
      ctx.lineTo(cx + Math.cos(an) * (R - w * prof), cy + Math.sin(an) * (R - w * prof) * sq);
    }
    ctx.closePath();
  }
  function speedLines(ctx, x0, y0, x1, y1, w, alpha, seed, rgb = '255,255,255', lift = 34) {
    const len = Math.hypot(x1 - x0, y1 - y0); if (len < 4) return;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(${rgb},${alpha * .8})` : `rgba(30,14,30,${alpha * .35})`;
      ctx.lineWidth = pass ? 2 : 4.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const o = (hash(i + seed) - .5) * w * 2, s0 = hash(i * 3.1 + seed) * len * .7, l = len * (.25 + hash(i * 1.7 + seed) * .4);
        ctx.moveTo(x0 + ux * s0 + nx * o, y0 + uy * s0 + ny * o - lift); ctx.lineTo(x0 + ux * (s0 + l) + nx * o, y0 + uy * (s0 + l) + ny * o - lift);
      }
      ctx.stroke();
    }
  }
  function smokePoof(ctx, x, y, r, t, seed, kind = 'poof') {
    const K = Kit(), pf = K.puff(kind), e = easeOut(t / .6), a = 1 - win(t, .35, 1);
    if (a <= 0) return;
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + hash(i + seed) * .5, d = r * (.15 + e * (.5 + hash(i * 2.1 + seed) * .3));
      K.stamp(ctx, pf, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - r * .25 - e * r * .2 * hash(i * 3 + seed), r * (.22 + e * .2), a * .9);
    }
    K.stamp(ctx, pf, x, y - r * .35, r * (.35 + e * .25), a);
  }
  // Mini fog painter: dark violet puffs low on the ground with a sickly glow.
  function fogPatch(ctx, q, alpha, time) {
    const K = Kit(), vio = K.puff('violet'), fg = fogSprite(), s = q.seed || 0;
    ctx.globalAlpha = alpha * .9;
    ctx.drawImage(fg, q.x - q.r * 1.1, q.y - q.r * .62, q.r * 2.2, q.r * 1.24);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const ph = time * .25 + hash(i + s) * 6, dx = Math.cos(ph + i * 1.7) * q.r * .45, dy = Math.sin(ph * 1.3 + i) * q.r * .18;
      K.stamp(ctx, vio, q.x + dx, q.y + dy - 10, q.r * (.42 + hash(i * 3 + s) * .2), alpha * .55, .7);
    }
  }

  // ------------------------------------------------------------------ Might Guy painter bridge
  const MGS = { moves: [], tigers: [], finishers: [] };
  function mgDraw(ctx, fx, time) {
    const M = window.MightGuyVFX; if (!M) return;
    const o = fx.o; o.kind = fx.sub; o.maxLife = 1; o.life = Math.max(.0001, 1 - fx.age / fx.dur);
    MGS.moves.length = MGS.tigers.length = MGS.finishers.length = 0;
    if (fx.sub === 'tiger') MGS.tigers.push(o); else if (fx.sub === 'finisher') MGS.finishers.push(o); else MGS.moves.push(o);
    M.drawEffects(ctx, MGS, time);
    MGS.moves.length = MGS.tigers.length = MGS.finishers.length = 0;
  }

  // ------------------------------------------------------------------ effect painters [ground, overlay]
  const FX = {
    impact: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r, 1 - win(fx.age, fx.dur - .6, fx.dur), fx.seed),
      (ctx, fx) => impactO(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, fx.rgb || '255,200,160')
    ],
    mg: [
      (ctx, fx, time) => { if (fx.layer === 0) mgDraw(ctx, fx, time); },
      (ctx, fx, time) => { if (fx.layer === 1) mgDraw(ctx, fx, time); }
    ],
    mark: [(ctx, fx, time) => markCircle(ctx, fx.x, fx.y, fx.r, fx.rgb, clamp01(fx.age / fx.dur), time, false), null],
    marks: [(ctx, fx, time) => { for (const q of fx.list) { const k = (fx.age - q.t0) / q.d; if (k >= 0 && k < 1) markCircle(ctx, q.x, q.y, q.r, fx.rgb, k, time, false); } }, null],
    lineMark: [(ctx, fx, time) => teleShape(ctx, { k: 'line', x: fx.x, y: fx.y, a: fx.a, len: fx.len, w: fx.w }, fx.rgb, clamp01(fx.age / fx.dur), time), null],
    coneMark: [(ctx, fx, time) => teleShape(ctx, { k: 'cone', x: fx.x, y: fx.y, a: fx.a, r: fx.r, h: fx.h }, fx.rgb, clamp01(fx.age / fx.dur), time), null],
    dash: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), K = Kit(), dust = K.puff('dust');
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
        if (len < 5) return;
        ctx.strokeStyle = `rgba(40,24,18,${.3 * a})`; ctx.lineWidth = 22; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
        for (let d = 0; d < len; d += 50) {
          const t = d / len, j = hash(d * .1 + fx.seed);
          K.stamp(ctx, dust, fx.x0 + (fx.x1 - fx.x0) * t + (j - .5) * 40, fx.y0 + (fx.y1 - fx.y0) * t - 10 - j * 14, 16 + j * 14, a * .65, .75);
        }
      },
      (ctx, fx, time, z) => {
        const S = Spr(), a = 1 - win(fx.age, fx.dur - .4, fx.dur), fac = Math.cos(fx.a) >= 0 ? 1 : -1;
        for (let i = 0; i + 1 < fx.pts.length; i += 4) {
          const k = i / fx.pts.length;
          if (S) S.draw(ctx, z.bossId, fx.pts[i], fx.pts[i + 1] + 3, { facing: fac, frame: 'attack', alpha: (.12 + k * .3) * a });
        }
        speedLines(ctx, fx.x0, fx.y0, fx.x1, fx.y1, 40, a, fx.seed, fx.rgb);
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
      (ctx, fx) => {
        const t = fx.age / .2, a = 1 - win(fx.age, .2, fx.dur), K = Kit();
        const s = fx.side, from = fx.a - fx.h * s, to = from + 2 * fx.h * s * easeOut(t), cy = fx.y - 30, SQ = .6;
        for (const [k, w, lag] of [[1, 30, 0], [.78, 20, .16]]) {
          const e = to - lag * s;
          if (s * (e - from) <= .04) continue;
          crescent(ctx, fx.x, cy, fx.r * k, w, from, e, SQ, false);
          ctx.strokeStyle = `rgba(16,20,40,${.6 * a})`; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.fillStyle = `rgba(250,252,255,${.95 * a})`; ctx.fill();
          crescent(ctx, fx.x, cy, fx.r * k - 3, w * .35, from, e, SQ, false);
          ctx.fillStyle = `rgba(${fx.rgb},${.8 * a})`; ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x + Math.cos(to) * fx.r * .9, cy + Math.sin(to) * fx.r * .9 * SQ, 50, fx.rgb, .7 * a * (1 - win(fx.age, .18, .35)), true);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    // Kick arcs: two tilted crescents sweeping round the body (fiery for Guy, green-white for Lee).
    kick: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, .3, fx.dur);
        ctx.strokeStyle = `rgba(40,22,18,${.35 * a})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * .9, fx.r * .45, 0, 0, TAU); ctx.stroke();
        if (!fx.hot) dustRing(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, 12);
      },
      (ctx, fx, time) => {
        const K = Kit(), t = fx.age, a = 1 - win(t, .35, fx.dur), sw = easeOut(t / .28);
        const rot = (fx.seed % 6) + (fx.wild ? Math.sin(t * 30) * .5 : 0);
        for (const [h, rr, w, tilt] of [[-34, fx.r * .78, 26, .45], [-14, fx.r * .96, 34, .36]]) {
          const a0 = rot, a1 = rot + TAU * .85 * sw;
          if (a1 - a0 < .1) continue;
          ctx.save(); ctx.translate(fx.x, fx.y + h);
          crescent(ctx, 0, 0, rr, w, a0, a1, tilt, false);
          ctx.strokeStyle = `rgba(30,14,10,${.55 * a})`; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.fillStyle = `rgba(255,252,240,${.92 * a})`; ctx.fill();
          crescent(ctx, 0, 0, rr - 4, w * .45, a0, a1, tilt, false);
          ctx.fillStyle = `rgba(${fx.rgb},${.85 * a})`; ctx.fill();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x, fx.y - 26, fx.r * .7, fx.rgb, .45 * a, false, .6);
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r, t * 1.5, a, fx.rgb);
        if (fx.hot) {
          const FB = 114 / 128;
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 0; i < 14; i++) {
            const an = i * TAU / 14 + fx.seed, d = fx.r * (.5 + sw * .45), hh = (30 + hash(i + fx.seed) * 40) * a;
            if (hh < 4) continue;
            ctx.drawImage(K.flame(i % 6), fx.x + Math.cos(an) * d - hh * .22, fx.y + Math.sin(an) * d * .5 - hh * FB, hh * .44, hh);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    leaves: [
      null,
      (ctx, fx, time) => {
        const a = 1 - win(fx.age, .6, fx.dur), e = easeOut(fx.age / fx.dur);
        for (let i = 0; i < 26; i++) {
          const h1 = hash(i * 2.3 + fx.seed), h2 = hash(i * 5.9 + fx.seed), an = h2 * TAU + fx.age * (4 + h1 * 4);
          const d = fx.r * (.2 + e * (.6 + h1 * .5)), lx = fx.x + Math.cos(an) * d, ly = fx.y + Math.sin(an) * d * .5 - 20 - h2 * 60 * (1 - e * .5);
          ctx.save(); ctx.globalAlpha = a * (.6 + h1 * .4); ctx.translate(lx, ly); ctx.rotate(an * 2 + time * 6 + i);
          ctx.drawImage(leafImg(i % 3), -10, -5, 20, 10); ctx.restore();
        }
      }
    ],
    poof: [null, (ctx, fx) => { if (fx.pk) smokePoof(ctx, fx.x, fx.y, fx.r * 1.1, fx.age, fx.seed + 7, fx.pk); smokePoof(ctx, fx.x, fx.y, fx.r * (fx.pk ? .7 : 1), fx.age, fx.seed); }],
    // Gates opening: a geyser of blood-red steam, the ground cracking and stones lifting.
    gateBurst: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .6, fx.dur);
        scorchG(ctx, fx.x, fx.y, fx.r * .7, a, fx.seed, '50,14,12');
        dustRing(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, 14);
      },
      (ctx, fx, time) => {
        const K = Kit(), t = fx.age, a = 1 - win(t, .5, fx.dur), steam = K.puff('steam');
        ctx.globalCompositeOperation = 'lighter';
        if (t < .25) K.glow(ctx, fx.x, fx.y - 40, fx.r * (.6 + t * 3), '255,90,70', (1 - t / .25), true, .8);
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.1, t * 1.3, a, '255,80,60');
        if (t > .12) K.fx.shockRing(ctx, fx.x, fx.y, fx.r * .8, (t - .12) * 1.3, a * .8, '255,200,180');
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 16; i++) {
          const ph = clamp01(t / fx.dur + hash(i + fx.seed) * .3), an = hash(i * 3.3 + fx.seed) * TAU, d = 14 + ph * 50;
          K.stamp(ctx, steam, fx.x + Math.cos(an) * d, fx.y - 20 - ph * (150 + hash(i * 7 + fx.seed) * 90), 18 + ph * 34, a * (1 - ph * .6) * .8);
        }
        // stones lifted by the pressure
        ctx.fillStyle = `rgba(70,52,40,${a})`;
        for (let i = 0; i < 10; i++) {
          const an = hash(i * 5.1 + fx.seed) * TAU, d = fx.r * (.2 + hash(i + fx.seed) * .5), up = Math.sin(clamp01(t / 1.1) * Math.PI) * (30 + hash(i * 2 + fx.seed) * 60);
          ctx.beginPath(); ctx.arc(fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - up, 3 + hash(i * 9) * 4, 0, TAU); ctx.fill();
        }
      }
    ],
    // Night Guy: the scorched groove and red steam hanging along the dragon's path.
    nightTrail: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .8, fx.dur), k = easeOut(fx.age / .45);
        const ex = fx.x0 + (fx.x1 - fx.x0) * k, ey = fx.y0 + (fx.y1 - fx.y0) * k;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(40,10,10,${.45 * a})`; ctx.lineWidth = 70; ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = `rgba(20,6,6,${.5 * a})`; ctx.lineWidth = 24; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,70,40,${.35 * a * (1 - win(fx.age, .6, 1.6))})`; ctx.lineWidth = 10; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      },
      (ctx, fx, time) => {
        const K = Kit(), steam = K.puff('steam'), a = 1 - win(fx.age, .4, fx.dur), k = easeOut(fx.age / .45);
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
        for (let d = 0; d < len * k; d += 55) {
          const t = d / len, j = hash(d * .07 + fx.seed), ph = clamp01(fx.age - t * .45);
          K.stamp(ctx, steam, fx.x0 + (fx.x1 - fx.x0) * t + (j - .5) * 50, fx.y0 + (fx.y1 - fx.y0) * t - 20 - ph * 60 - j * 30, 22 + ph * 30, a * .7 * (1 - ph * .5));
        }
        if (fx.age < .5) speedLines(ctx, fx.x0, fx.y0, fx.x1, fx.y1, 90, 1 - fx.age / .5, fx.seed, '255,180,160', 40);
      }
    ],
    embers: [
      (ctx, fx, time) => {
        const K = Kit(), a = 1 - win(fx.age, fx.dur - .8, fx.dur);
        for (const q of fx.pts) {
          const k = win(fx.age, q.t0, q.t0 + .2) * a;
          if (k <= 0) continue;
          ctx.fillStyle = `rgba(30,12,8,${.35 * k})`; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r, q.r * .45, 0, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, q.x, q.y, q.r * 1.2, '255,110,40', .4 * k * (.8 + Math.sin(time * 9 + q.x) * .2), false, .5);
          ctx.globalCompositeOperation = 'source-over';
        }
      },
      (ctx, fx, time) => {
        const K = Kit(), a = 1 - win(fx.age, fx.dur - .8, fx.dur), FB = 114 / 128;
        fx.pts.forEach((q, i) => {
          const k = win(fx.age, q.t0, q.t0 + .2) * a;
          if (k <= 0) return;
          const h = q.r * (.9 + Math.sin(time * 11 + i) * .15) * k;
          ctx.drawImage(K.flame(i % 6), q.x - h * .22, q.y - h * FB, h * .44, h);
        });
      }
    ],
    // ---- Hanzō
    chain: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), d = Math.min(fx.len, fx.age * fx.sp);
        ctx.strokeStyle = `rgba(40,24,20,${.5 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + Math.cos(fx.a) * d, fx.y + Math.sin(fx.a) * d); ctx.stroke();
      },
      (ctx, fx, time, z) => {
        const out = fx.len / fx.sp, back = .4, t = fx.age, c = Math.cos(fx.a), s = Math.sin(fx.a);
        let d = t < out ? t * fx.sp : fx.len * (1 - easeIn((t - out) / back));
        if (t > out + back) return;
        const fac = c >= 0 ? 1 : -1, hx = z.x + fac * 14, hy = z.y - 42, tx = fx.x + c * d, ty = fx.y + s * d - 36;
        // the chain: a sagging dark line with bright links
        const sag = 26 * (1 - clamp01(d / fx.len)) + 6, mx = (hx + tx) / 2, my = (hy + ty) / 2 + sag;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#121218'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
        ctx.strokeStyle = '#c4cad6'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -time * 60; ctx.stroke(); ctx.setLineDash([]);
        const K = Kit();
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(fx.a + (t < out ? time * 26 : time * -20)); ctx.drawImage(sickleImg(), -20, -26, 70, 50); ctx.restore();
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, tx, ty, 40, '210,225,255', .6); ctx.globalCompositeOperation = 'source-over';
        if (t < out) speedLines(ctx, fx.x, fx.y, fx.x + c * d, fx.y + s * d, 18, .7, fx.seed, '230,236,255', 36);
      }
    ],
    whirl: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.sw, fx.dur);
        ctx.strokeStyle = `rgba(40,22,18,${.4 * a})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 430, 215, 0, 0, TAU); ctx.stroke();
        dustRing(ctx, fx.x, fx.y, 430, fx.age, fx.seed, 10);
      },
      (ctx, fx, time, z) => {
        if (fx.age > fx.sw + .1) return;
        const K = Kit(), ang = fx.a0 + fx.dir * TAU * 2 * easeInOut(fx.age / fx.sw), rr = 110 + 320 * easeOut(fx.age / .3);
        const hx = z.x, hy = z.y - 42, tx = fx.x + Math.cos(ang) * rr, ty = fx.y + Math.sin(ang) * rr * .55 - 34;
        // motion smear behind the sickle
        ctx.fillStyle = 'rgba(220,230,255,.18)';
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const an = ang - fx.dir * i * .09; ctx.lineTo(fx.x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr * .55 - 34); }
        for (let i = 10; i >= 0; i--) { const an = ang - fx.dir * i * .09; ctx.lineTo(fx.x + Math.cos(an) * rr * .6, fx.y + Math.sin(an) * rr * .33 - 34); }
        ctx.closePath(); ctx.fill();
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#121218'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#c4cad6'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang + fx.dir * Math.PI / 2); ctx.drawImage(sickleImg(), -20, -26, 70, 50); ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, tx, ty, 46, '210,225,255', .7);
        ctx.strokeStyle = 'rgba(230,240,255,.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y - 34, rr, rr * .55, 0, ang - fx.dir * 1.2, ang, fx.dir < 0); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    lob: [
      null,
      (ctx, fx, time) => {
        const K = Kit(), can = canisterSpr();
        for (const s of fx.list) {
          const k = (fx.age - s.t0) / s.fl;
          if (k < 0) continue;
          if (k < 1) {
            const H = fx.high ? 420 : 170, L0 = fx.lift || 46, x = fx.x + (s.x - fx.x) * k, y = fx.y - L0 + (s.y - fx.y + L0) * k - Math.sin(k * Math.PI) * H;
            // violet trail of gas leaking from the canister
            for (let j = 1; j <= 4; j++) {
              const kk = Math.max(0, k - j * .05), xx = fx.x + (s.x - fx.x) * kk, yy = fx.y - L0 + (s.y - fx.y + L0) * kk - Math.sin(kk * Math.PI) * H;
              K.stamp(ctx, K.puff('violet'), xx, yy, 8 + j * 3, .5 - j * .1);
            }
            ctx.save(); ctx.translate(x, y); ctx.rotate(time * 12 + s.x); ctx.drawImage(can, -9, -13, 18, 26); ctx.restore();
          } else if (k < 1 + .6 / s.fl) {
            const b = (fx.age - s.t0 - s.fl) / .6;
            ctx.globalCompositeOperation = 'lighter';
            K.glow(ctx, s.x, s.y - 20, s.r * (.6 + b), '190,110,255', (1 - b) * .75, true, .7);
            K.fx.shockRing(ctx, s.x, s.y, s.r * 1.05, b * 1.2, 1 - b, '200,140,255');
            ctx.globalCompositeOperation = 'source-over';
            smokePoof(ctx, s.x, s.y, s.r * .9, b * .9, s.x * .1, 'violet');
          }
        }
      }
    ],
    fog: [
      (ctx, fx, time) => {
        const fade = 1 - win(fx.age, fx.dur - 1.0, fx.dur);
        for (const q of fx.pts) {
          const k = win(fx.age, q.t0, q.t0 + .45) * fade;
          if (k > .01) fogPatch(ctx, q, k, time);
        }
      },
      (ctx, fx, time) => {
        const K = Kit(), vio = K.puff('violet'), fade = 1 - win(fx.age, fx.dur - 1.0, fx.dur);
        ctx.globalCompositeOperation = 'lighter';
        for (const q of fx.pts) {
          const k = win(fx.age, q.t0, q.t0 + .45) * fade;
          if (k <= .01) continue;
          K.glow(ctx, q.x, q.y - 14, q.r * .7, '170,90,230', .16 * k, false, .55);
        }
        ctx.globalCompositeOperation = 'source-over';
        // wisps curling up out of each cloud
        fx.pts.forEach((q, i) => {
          const k = win(fx.age, q.t0, q.t0 + .45) * fade;
          if (k <= .01) return;
          for (let j = 0; j < 2; j++) {
            const ph = (time * .45 + hash(i * 3 + j + (q.seed || 0))) % 1;
            K.stamp(ctx, vio, q.x + Math.sin(time + i + j * 2) * q.r * .35, q.y - 16 - ph * 70, q.r * (.18 + ph * .22), bell(ph) * .5 * k);
          }
        });
      }
    ],
    ibuse: [
      (ctx, fx, time) => {
        const k = win(fx.age, 0, .35) * (1 - win(fx.age, fx.T, fx.T + .5));
        const open = fx.age > .3 && fx.age < 1.9;
        drawIbuse(ctx, fx.bx, fx.by, fx.f, IS, open, k, time, fx.seed);
      },
      (ctx, fx, time) => {
        if (fx.age < .1) smokePoof(ctx, fx.bx, fx.by, 220, fx.age + .05, fx.seed);
        if (fx.age > fx.T && fx.age < fx.T + .9) smokePoof(ctx, fx.bx, fx.by, 220, fx.age - fx.T, fx.seed + 3);
        breathPlume(ctx, fx.mx, fx.my, 55 * IS, fx.a, fx.r, fx.h, fx.age - .4, 1.4, fx.seed, time);
      }
    ],
    sweep: [
      (ctx, fx, time) => {
        if (fx.age < fx.warn) teleShape(ctx, { k: 'ring', x: fx.x, y: fx.y, a0: fx.a0, a1: fx.a1, r0: fx.r0, r1: fx.r1 }, '190,90,255', fx.age / fx.warn, time);
      },
      (ctx, fx, time) => {
        const t = fx.age - fx.warn;
        if (t < 0 || t > fx.sw + .5) return;
        const ang = fx.a0 + (fx.a1 - fx.a0) * easeInOut(t / fx.sw);
        breathPlume(ctx, fx.x, fx.y, 55 * IS_ULT, ang, fx.r1, .2, Math.min(t, .6), 99, fx.seed, time, 1 - win(t, fx.sw, fx.sw + .5));
      }
    ],
    blastCone: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .6, fx.dur);
        ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
        ctx.fillStyle = `rgba(40,12,50,${.25 * a})`; sector(ctx, 0, 0, 0, fx.r * easeOut(fx.age / .5), -fx.h, fx.h); ctx.fill();
        ctx.restore();
      },
      (ctx, fx, time) => {
        const K = Kit(), a = 1 - win(fx.age, .9, fx.dur);
        breathPlume(ctx, fx.x, fx.y, 55 * IS_ULT, fx.a, fx.r, fx.h, fx.age, .9, fx.seed, time, a, 1.6);
        if (fx.age < .3) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 72, 260, '210,140,255', 1 - fx.age / .3, true); ctx.globalCompositeOperation = 'source-over'; }
      }
    ],
    // ---- Lee
    ribbon: [
      null,
      (ctx, fx, time, z) => {
        // Bandages unwinding off his arms, spiralling round the rising kick.
        const st = z.dv, a = 1 - win(fx.age, fx.dur - .3, fx.dur), lift = st ? st.lift : 0, cx = z.x, cy = z.y - 40 - lift;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // two bandage strips spiralling from his arms down the column he rose through
        const top = z.y - 30 - lift, span = lift + 30;
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          for (let i = 0; i <= 28; i++) {
            const u = i / 28, an = time * 16 + j * Math.PI + u * 11, rr = 16 + Math.sin(u * Math.PI) * 40 + u * 10, y = top + u * span;
            const x = cx + Math.cos(an) * rr, yy = y + Math.sin(an) * rr * .3;
            if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
          }
          ctx.strokeStyle = `rgba(30,24,20,${.55 * a})`; ctx.lineWidth = 8; ctx.stroke();
          ctx.strokeStyle = `rgba(246,240,224,${.97 * a})`; ctx.lineWidth = 5; ctx.stroke();
          ctx.strokeStyle = `rgba(180,166,140,${.8 * a})`; ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.stroke(); ctx.setLineDash([]);
        }
        // drilling down: spinning white crescents under him
        if (st && st.arc && st.arc.t > st.arc.dur * .55) {
          const K = Kit(), sp = time * 30;
          for (let i = 0; i < 3; i++) {
            ctx.save(); ctx.translate(cx, cy + 34 + i * 16);
            crescent(ctx, 0, 0, 36 - i * 8, 10, sp + i * 2, sp + i * 2 + 4, .4, true);
            ctx.strokeStyle = `rgba(30,20,20,${.5 * a})`; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = `rgba(255,255,250,${.9 * a})`; ctx.fill();
            ctx.restore();
          }
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, cx, cy + 40, 60, '255,250,230', .6 * a, true); ctx.globalCompositeOperation = 'source-over';
        }
        if (lift > 20) {
          const K = Kit();
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, cx, cy, 70, '255,240,210', .35 * a);
          ctx.globalCompositeOperation = 'source-over';
          speedLines(ctx, cx, z.y + 20, cx, z.y - lift - 60, 26, .8 * a, fx.seed, '255,250,235', 0);
        }
      }
    ],
    weights: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .6, fx.dur), land = win(fx.age, .3, .36);
        if (land <= 0) return;
        for (const s of [-1, 1]) {
          const x = fx.x + s * 30, y = fx.y + 10;
          ctx.fillStyle = `rgba(40,26,16,${.5 * a})`; ctx.beginPath(); ctx.ellipse(x, y, 50, 22, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(30,18,10,${.7 * a})`; ctx.lineWidth = 2.5; ctx.beginPath();
          for (let i = 0; i < 7; i++) { const an = i * TAU / 7 + s, r2 = 60 + hash(i + s * 3) * 40; ctx.moveTo(x + Math.cos(an) * 40, y + Math.sin(an) * 18); ctx.lineTo(x + Math.cos(an) * r2, y + Math.sin(an) * r2 * .45); }
          ctx.stroke();
          ctx.drawImage(weightImg(), x - 18, y - 16, 36, 27);
        }
        dustRing(ctx, fx.x, fx.y, 170, fx.age - .32, fx.seed, 14);
      },
      (ctx, fx) => {
        const K = Kit();
        for (const s of [-1, 1]) {
          const k = clamp01(fx.age / .32), x = fx.x + s * (10 + 20 * k), y = fx.y - 30 + (40 * easeIn(k));
          if (k < 1) ctx.drawImage(weightImg(), x - 18, y - 16, 36, 27);
        }
        const b = fx.age - .32;
        if (b > 0 && b < .6) { ctx.globalCompositeOperation = 'lighter'; K.fx.shockRing(ctx, fx.x, fx.y + 10, 200, b * 1.6, 1 - b / .6, '255,230,200'); ctx.globalCompositeOperation = 'source-over'; }
      }
    ],
    boom: [
      null,
      (ctx, fx) => {
        const K = Kit(), t = fx.age, a = 1 - t / fx.dur;
        ctx.save(); ctx.translate(fx.x, fx.y - 34); ctx.rotate(fx.a);
        for (let i = 0; i < 3; i++) {
          const k = clamp01(t * 2.2 - i * .15); if (k <= 0) continue;
          ctx.strokeStyle = `rgba(30,20,30,${.35 * a})`; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.ellipse(-k * 80, 0, 10 + k * 16, 22 + k * 50, 0, -1.3, 1.3); ctx.stroke();
          ctx.strokeStyle = fx.hot ? `rgba(255,${200 - i * 40},${150 - i * 40},${a})` : `rgba(240,248,255,${a})`; ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x, fx.y - 34, 60, fx.hot ? '255,140,80' : '220,240,255', .6 * a, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    ]
  };

  // Poison breath / fog plume: dark violet puffs racing out from (x, y) along angle a, filling a cone.
  function breathPlume(ctx, x, y, lift, a, R, h, t, len, seed, time, alpha = 1, dens = 1) {
    if (t < 0 || t > len + 1.2 || alpha <= 0) return;
    const K = Kit(), vio = K.puff('violet'), fg = fogSprite();
    const stop = t > len ? 1 - (t - len) / 1.2 : 1, n = Math.round(34 * dens);
    for (let i = 0; i < n; i++) {
      const sp = .55 + hash(i * 1.3 + seed) * .45, ph = ((t * sp * 1.4 + hash(i * 4.1 + seed)) % 1), d = 30 + ph * R;
      if (t * 1600 < d) continue;
      const an = a + (hash(i * 7.7 + seed) - .5) * 2 * h * Math.min(1, ph * 1.4), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d - lift * (1 - ph) - 14;
      const r = 18 + ph * (60 + h * 120);
      K.stamp(ctx, vio, px, py, r, bell(ph) * .75 * stop * alpha, .8);
      if (i % 3 === 0) { ctx.globalAlpha = bell(ph) * .5 * stop * alpha; ctx.drawImage(fg, px - r, py - r * .6, r * 2, r * 1.2); ctx.globalAlpha = 1; }
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - lift, 70, '200,120,255', .5 * stop * alpha);
    K.glow(ctx, x + Math.cos(a) * R * .4, y + Math.sin(a) * R * .4, R * .45, '150,70,220', .14 * stop * alpha, false, .6);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ windup / persistent overlays
  function windupFx(ctx, z, st, time, H) {
    const K = Kit(), id = z.bossId, k = 1 - st.windup / st.windMax, def = MOVES[id][st.move];
    const fy = z.y + 3 - st.lift, fac = facingOf(z);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - H * .5, 40 + 40 * k, def.rgb, .25 + .3 * k);
    // chakra lines converging on him
    ctx.strokeStyle = `rgba(${def.rgb},${.4 + .4 * k})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = i * TAU / 8 + time * 2, ph = (time * 2.4 + hash(i + st.seed)) % 1, d0 = 120 * (1 - ph) + 30;
      ctx.moveTo(z.x + Math.cos(an) * d0, fy - H * .5 + Math.sin(an) * d0 * .6); ctx.lineTo(z.x + Math.cos(an) * (d0 - 22), fy - H * .5 + Math.sin(an) * (d0 - 22) * .6);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    if (id === 'hanzo' && (st.move === 'gas' || st.move === 'ibuse' || st.move === 'storm' || st.move === 'blink')) {
      const vio = K.puff('violet');
      for (let i = 0; i < 6; i++) {
        const ph = (time * .9 + hash(i * 2.1)) % 1;
        K.stamp(ctx, vio, z.x + fac * 10 + Math.sin(time * 3 + i) * 14, fy - H * .62 - ph * 40, 8 + ph * 14, bell(ph) * .7);
      }
    }
    if (id === 'guy' && st.move === 'tiger') {
      // Hirudora stance: the air compresses into a sphere in front of his palm.
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x + fac * 30, fy - H * .55, 20 + 30 * k, '170,230,255', .8 * k, true);
      K.fx.shockRing(ctx, z.x + fac * 30, fy - H * .55, 60, (time * 2) % 1, .6 * k, '200,240,255');
      ctx.globalCompositeOperation = 'source-over';
    }
    if (id === 'guy' && st.move === 'night') {
      // Eighth Gate: a pillar of blood-red steam boiling off him, the ground cracking around his feet.
      const steam = K.puff('steam');
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, fy - 80, 130 + 60 * k, '255,40,30', .5 + .3 * k, false, 1.4);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 14; i++) {
        const ph = (time * 1.1 + hash(i * 1.7)) % 1;
        K.stamp(ctx, steam, z.x + Math.sin(i * 2.3 + time) * (16 + ph * 30), fy - 20 - ph * (200 + 80 * k), 16 + ph * 36, (1 - ph) * .8);
      }
    }
  }

  function label(ctx, z, st, m, time) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[z.bossId][st.move], top = z.y + 3 - st.lift - bodyH(z.bossId) - 40;
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#160f1d';
    ctx.strokeText(def.label, z.x, top); ctx.fillStyle = m.accent; ctx.fillText(def.label, z.x, top);
    if (def.shout) {
      const bob = Math.sin(time * 9) * 1.5;
      ctx.font = 'italic 800 10px sans-serif'; ctx.lineWidth = 3;
      ctx.strokeText(def.shout, z.x, top - 14 + bob); ctx.fillStyle = '#ffffff'; ctx.fillText(def.shout, z.x, top - 14 + bob);
    }
    ctx.restore();
  }

  function gatesLevel(z, st) {
    if (z.bossId === 'guy') return Math.min(1, st.gate + (st.gateT > 0 ? .5 : 0));
    if (z.bossId === 'lee') return st.gateT > 0 ? Math.min(1, st.gateT * 2) : 0;
    return 0;
  }
  function drawGates(ctx, z, st, time, above) {
    const S = Spr(), lvl = gatesLevel(z, st);
    if (!S || !S.drawGatesAura || lvl < .03 || st.vanish > 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, lvl * 1.2);
    S.drawGatesAura(ctx, z.x, z.y + 3 - st.lift, facingOf(z), time, (z.bossId === 'guy' ? 1.18 : 1.14) * (.9 + lvl * .25), st.dash || st.arc ? 1 : 0, above);
    ctx.restore();
  }
  function drawDrunk(ctx, z, st, time) {
    if (st.drunk <= 0 || st.vanish > 0) return;
    const a = Math.min(1, st.drunk * 2), H = bodyH('lee'), fy = z.y + 3 - st.lift, fac = facingOf(z);
    // flushed cheeks and hiccup bubbles
    ctx.fillStyle = `rgba(255,90,120,${.35 * a})`;
    ctx.beginPath(); ctx.ellipse(z.x + fac * 8, fy - H * .8, 9, 5, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const ph = (time * .8 + i / 4) % 1, x = z.x + fac * (12 + ph * 14) + Math.sin(time * 4 + i) * 5, y = fy - H - 6 - ph * 34, r = 3 + ph * 5;
      ctx.strokeStyle = `rgba(40,30,50,${(1 - ph) * a * .6})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,240,${(1 - ph) * a})`; ctx.lineWidth = 1.4; ctx.stroke();
    }
  }

  // ------------------------------------------------------------------ module hooks
  function draw(ctx, z, time) {
    const st = z.dv;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    if (st.ib) {
      const ib = st.ib, k = win(ib.t, 0, .4) * (1 - win(ib.t, ib.dur - .4, ib.dur));
      const open = (ib.t > 1 && ib.t < 2.9) || (ib.blast && ib.t - ib.blast.t0 > 1.0 && ib.t - ib.blast.t0 < 2.6) || (ib.t > 3.3 && ib.t < 4.9 && Math.floor(ib.t * 7) % 2 === 0);
      drawIbuse(ctx, ib.x, ib.y, ib.f, IS_ULT, open, k, time, ib.seed);
    }
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[z.bossId][st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      drawGates(ctx, z, st, time, false);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.dv, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      drawGates(ctx, z, st, time, true);
      if (z.bossId === 'lee') drawDrunk(ctx, z, st, time);
      if (st.windup > 0 && st.move) {
        windupFx(ctx, z, st, time, bodyH(z.bossId));
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m, time);
      }
    }
    ctx.restore();
  }

  const hidden = z => !!(z.dv && z.dv.vanish > 0 && z.health > 0);
  const bodyLift = z => (z.dv && z.health > 0 ? z.dv.lift || 0 : 0);

  window.DuelBosses = { members, order, pick, update, draw, drawOverlay, hidden, bodyLift, moveLabels, moves };
})();
