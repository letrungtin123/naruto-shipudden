(() => {
  'use strict';

  // Kage of past generations brought back by Edo Tensei (spawn panel, faction 'edokage').
  // Same contract as nagato-boss.js / danzo-boss.js: update(z, dt, api) drives the jutsu,
  // draw(ctx, z, time) paints the ground layer (telegraphs, scorch, sheets of sand),
  // drawOverlay(ctx, z, time) what stands above the characters. All state lives on z.ek
  // (plain JSON: no references to z, players or enemies; numbers rounded).
  //   raikage3  Sandaime Raikage: Black Lightning fan, Hell Stab four-finger volley, Lightning
  //             armour rush, Ground-breaker leap, the unbreakable body (takes almost nothing,
  //             then throws a counter-shock), ultimate Hell Stab One Finger (a 1250 px lance).
  //   kazekage3 the Third Kazekage as Sasori's human puppet (chakra threads rising from him):
  //             Iron Sand Drizzle, Gathering Assault (giant spiked mass), hidden arms with
  //             poison blades, magnetic pull + spike ring, iron spike lanes, ultimate Iron Sand
  //             World Order (spikes radiating everywhere from a sphere).
  //   rasa      Fourth Kazekage Rasa: Gold Dust wave, gold spears, Gold Pyramid Seal, gold
  //             shield, falling gold masses, ultimate Gold Dust Tsunami.
  // The two Edo bodies reform once from paper when brought low (Uế Thổ regeneration).
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeBack = t => { t = clamp01(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const R1 = v => Math.round(v * 10) / 10;
  const R3 = v => Math.round(v * 1000) / 1000;
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const HEIGHT = id => { const S = Spr(); return S && S.has && S.has(id) ? S.height(id) : 90; };

  const order = ['raikage3', 'kazekage3', 'rasa'];
  const members = {
    raikage3: {
      name: 'SANDAIME RAIKAGE — UẾ THỔ', short: 'RAIKAGE III', accent: '#ffe45a', hpScale: 3.7, damageScale: 2.0, armor: .85, edo: true,
      moves: ['kokuton', 'rush', 'nukite4', 'quake', 'body', 'nukite1', 'rush', 'kokuton', 'quake', 'nukite4', 'body', 'nukite1']
    },
    kazekage3: {
      name: 'KAZEKAGE ĐỜI 3 — NHÂN KHÔI', short: 'KAZEKAGE III', accent: '#b0aed0', hpScale: 3.6, damageScale: 1.95, armor: .9,
      moves: ['drizzle', 'arms', 'assault', 'pull', 'spikes', 'world', 'arms', 'drizzle', 'spikes', 'assault', 'pull', 'world']
    },
    rasa: {
      name: 'RASA — YONDAIME KAZEKAGE', short: 'RASA', accent: '#f0c040', hpScale: 3.5, damageScale: 1.9, armor: .9, edo: true,
      moves: ['goldwave', 'spears', 'pyramid', 'hammer', 'shield', 'tsunami', 'spears', 'goldwave', 'hammer', 'pyramid', 'shield', 'tsunami']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    kokuton:  { label: 'LÔI ĐỘN · HẮC LÔI', rgb: '190,160,255', windup: .9, after: 1.3 },
    nukite4:  { label: 'ĐỊA NGỤC THÍCH · TỨ BẢN QUÁN THỦ', rgb: '255,236,120', windup: .7, after: 1.2 },
    rush:     { label: 'LÔI ĐỘN · LÔI KHẢI XUNG PHONG', rgb: '255,228,90', windup: .55, after: 1.1 },
    body:     { label: 'BẤT HOẠI CHI THÂN', rgb: '255,240,170', windup: .45, after: .9 },
    quake:    { label: 'LÔI QUYỀN · ĐỊA LIỆT', rgb: '255,210,90', windup: .8, after: 1.3 },
    nukite1:  { label: 'ĐỊA NGỤC THÍCH · NHẤT BẢN QUÁN THỦ', rgb: '255,250,200', windup: 1.35, after: 2.0 },
    drizzle:  { label: 'TỪ ĐỘN · SA THIẾT THỜI VŨ', rgb: '170,165,210', windup: .9, after: 1.3 },
    assault:  { label: 'TỪ ĐỘN · SA THIẾT TẬP PHÁP', rgb: '170,165,210', windup: 1.0, after: 1.4 },
    arms:     { label: 'KHÔI LỖI · ẨN TÝ ĐỘC NHẬN', rgb: '200,150,240', windup: .7, after: 1.2 },
    pull:     { label: 'TỪ ĐỘN · TỪ LỰC DẪN', rgb: '160,170,255', windup: .6, after: 1.2 },
    spikes:   { label: 'SA THIẾT · THƯƠNG TRẬN', rgb: '170,165,210', windup: .85, after: 1.3 },
    world:    { label: 'TỪ ĐỘN · SA THIẾT GIỚI PHÁP', rgb: '200,195,240', windup: 1.5, after: 2.1 },
    goldwave: { label: 'SA KIM · KIM SA ĐẠI LÃNG', rgb: '255,214,100', windup: .85, after: 1.2 },
    spears:   { label: 'SA KIM · KIM THƯƠNG', rgb: '255,222,120', windup: .8, after: 1.1 },
    pyramid:  { label: 'SA KIM · KIM TỰ THÁP PHONG ẤN', rgb: '255,214,100', windup: .9, after: 1.3 },
    hammer:   { label: 'SA KIM · KIM SA TRỌNG KÍCH', rgb: '255,206,90', windup: .6, after: 1.1 },
    shield:   { label: 'SA KIM · KIM SA THUẪN', rgb: '255,226,140', windup: .45, after: .9 },
    tsunami:  { label: 'SA KIM · KIM SA ĐẠI BỘC BỐ', rgb: '255,214,100', windup: 1.5, after: 2.1 },
    regen:    { label: 'UẾ THỔ · TÁI SINH', rgb: '230,220,200', windup: 0, after: 0 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  // Raikage
  const KOK_LEN = 900, KOK_W = 38, KOK_SPEED = 3200;
  const STAB_N = 4, STAB_GAP = .44, STAB_TELE = .3, STAB_LEN = 560, STAB_W = 62;
  const RUSH_N = 3, RUSH_GAP = .62, RUSH_TELE = .36, RUSH_DUR = .15;
  const BODY_T = 3.0, BODY_R = 360;
  const QJ_T = .62, QUAKE_R = 250, QUAKE_RAY = 640, QUAKE_N = 8;
  const PIERCE_LEN = 1250, PIERCE_W = 62;
  // Kazekage
  const DRIZ_N = 30, DRIZ_R = 56, DRIZ_FALL = .42, DRIZ_AREA = 400;
  const ASL_LEN = 980, ASL_SPEED = 780, ASL_R = 84, ASL_BURST = 250;
  const ARM_N = 9, ARM_LEN = 470, ARM_HALF = .58, ARM_EXT = .16;
  const PULL_R = 560, PULL_RING = 220, PULL_T = 1.9;
  const SPK_LEN = 840, SPK_SPEED = 1150, SPK_END = 125;
  const WORLD_N = 18, WORLD_LEN = 820, WORLD_SPEED = 1700, WORLD_CORE = 210, WORLD_H = 165;
  // Rasa
  const GW_LEN = 880, GW_HALF = .62, GW_SPEED = 880;
  const SP_N = 7, SP_LEN = 980, SP_SPEED = 1350, SP_GAP = .17, SP_FLASH = .26;
  const PYR_R = 215, PYR_CLOSE = .75, PYR_HOLD = 1.6;
  const SH_T = 2.8, SH_R = 260, SH_N = 14, SH_LEN = 540;
  const HAM_N = 3, HAM_GAP = .8, HAM_T = .8, HAM_R = 175;
  const TSU_LEN = 1250, TSU_W = 440, TSU_SPEED = 700, TSU_BACK = 160;
  const REGEN_AT = .4, REGEN_T = 2.2, REGEN_HEAL = .1;

  function pick(level) { return order[(level | 0) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  function inCone(p, x, y, a, len, half) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > len + (p.r || 12)) return false;
    if (d < 40) return true;
    const da = Math.atan2(Math.sin(Math.atan2(p.y - y, p.x - x) - a), Math.cos(Math.atan2(p.y - y, p.x - x) - a));
    return Math.abs(da) <= half;
  }

  function state(z) {
    return z.ek || (z.ek = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], ghosts: [], force: null, hold: 0, holdMove: '', dash: null, jump: null,
      armor: 0, guard: 0, plan: null, regen: null, regenUsed: false, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = R1(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn, self) => st.ev.push({ t, fn, self: !!self });

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move, api) {
    const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), tx = st.tx, ty = st.ty, d = Math.hypot(tx - x, ty - y);
    const circ = (cx, cy, r, faint, small) => ({ k: 'c', x: R1(cx), y: R1(cy), r, faint, small });
    const ln = (x0, y0, aa, len, w, faint) => ({ k: 'line', x: R1(x0), y: R1(y0), a: R3(aa), len: Math.round(len), w, faint });
    st.plan = null;
    switch (move) {
      case 'kokuton': {
        st.plan = [-.46, -.23, 0, .23, .46].map((o, i) => ({ a: R3(a + o), len: Math.round(KOK_LEN * (i === 2 ? 1 : i % 4 === 0 ? .84 : .93)) }));
        return st.plan.map(l => ln(x + Math.cos(l.a) * 30, y + Math.sin(l.a) * 30, l.a, l.len - 30, KOK_W))
          .concat(st.plan.map(l => circ(x + Math.cos(l.a) * l.len, y + Math.sin(l.a) * l.len, 110, true, true)));
      }
      case 'nukite4': return [ln(x, y, a, STAB_LEN, STAB_W)];
      case 'rush': return [circ(x, y, 150, true), ln(x, y, a, Math.min(680, d + 160), 50, true)];
      case 'body': return [{ k: 'c', follow: true, r: BODY_R, faint: true }];
      case 'quake': {
        const L = Math.min(560, d), r = (z.r || 24) + 4;
        let px = x + ca * L, py = y + sa * L;
        for (let k = 0; k < 8 && api.blocked(px, py, r); k++) { px = lerp(px, x, .22); py = lerp(py, y, .22); }
        const b = Math.random() * TAU, rays = [];
        for (let i = 0; i < QUAKE_N; i++) rays.push({ a: R3(b + i * TAU / QUAKE_N + (Math.random() - .5) * .3), len: Math.round(QUAKE_RAY * (.75 + Math.random() * .25)), seed: R1(Math.random() * 99) });
        st.plan = { x: R1(px), y: R1(py), rays };
        return [circ(px, py, QUAKE_R)].concat(rays.map(rr => ln(px + Math.cos(rr.a) * 60, py + Math.sin(rr.a) * 60, rr.a, rr.len - 60, 28, true)));
      }
      case 'nukite1': return [ln(x, y, a, PIERCE_LEN, PIERCE_W), circ(x + ca * PIERCE_LEN, y + sa * PIERCE_LEN, 230, true)];
      case 'drizzle': {
        const spots = [{ x: tx, y: ty }];
        for (let i = 1; i < DRIZ_N; i++) { const aa = Math.random() * TAU, rr = 60 + Math.sqrt(Math.random()) * (DRIZ_AREA - 60); spots.push({ x: tx + Math.cos(aa) * rr, y: ty + Math.sin(aa) * rr * .85 }); }
        spots.forEach((s, i) => { s.x = R1(s.x); s.y = R1(s.y); s.t0 = R3(.1 + i * .045 + Math.random() * .05); s.v = i % 3; });
        st.plan = spots;
        return [circ(tx, ty, DRIZ_AREA, true)].concat(spots.map(s => circ(s.x, s.y, DRIZ_R, true, true)));
      }
      case 'assault': {
        const len = Math.min(ASL_LEN, Math.max(380, d + 60));
        st.plan = { len };
        return [ln(x + ca * 40, y + sa * 40, a, len - 40, ASL_R + 6), circ(x + ca * len, y + sa * len, ASL_BURST)];
      }
      case 'arms': return [{ k: 'cone', x: R1(x), y: R1(y), a: R3(a), len: ARM_LEN, half: ARM_HALF }];
      case 'pull': return [{ k: 'c', follow: true, r: PULL_R, faint: true, inward: true }, { k: 'c', follow: true, r: PULL_RING }];
      case 'spikes': {
        st.plan = [-.34, 0, .34].map((o, i) => {
          const aa = a + o;
          return { a: R3(aa), x0: R1(x + Math.cos(aa) * 40), y0: R1(y + Math.sin(aa) * 40), len: Math.round(SPK_LEN * (i === 1 ? 1 : .88)), t0: i === 1 ? .06 : .16, seed: R1(Math.random() * 99) };
        });
        return st.plan.map(l => ln(l.x0, l.y0, l.a, l.len, 46))
          .concat(st.plan.map(l => circ(l.x0 + Math.cos(l.a) * l.len, l.y0 + Math.sin(l.a) * l.len, SPK_END, true)));
      }
      case 'world': {
        const b = Math.random() * TAU, lanes = [];
        for (let i = 0; i < WORLD_N; i++) lanes.push({ a: R3(b + i * TAU / WORLD_N), seed: R1(Math.random() * 99) });
        st.plan = { lanes };
        return [{ k: 'c', follow: true, r: WORLD_CORE }].concat(lanes.map(l => ({ k: 'line', follow: true, a: l.a, len: WORLD_LEN, w: 30, faint: true })));
      }
      case 'goldwave': return [{ k: 'cone', x: R1(x), y: R1(y), a: R3(a), len: GW_LEN, half: GW_HALF }];
      case 'spears': return [ln(x, y, a, SP_LEN, 26, true)];
      case 'pyramid': return [circ(tx, ty, PYR_R), circ(tx, ty, PYR_R * .55, true)];
      case 'hammer': st.plan = { x: R1(tx), y: R1(ty) }; return [];
      case 'shield': return [{ k: 'c', follow: true, r: SH_R }];
      case 'tsunami': {
        st.plan = { x0: R1(x - ca * TSU_BACK), y0: R1(y - sa * TSU_BACK), a: R3(a) };
        return [ln(st.plan.x0, st.plan.y0, a, TSU_LEN, TSU_W)];
      }
    }
    return [];
  }

  function announce(z, st, m, api) {
    let move = st.force;
    if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = R3(aimAt(z, p)); st.tx = R1(p ? p.x : z.x); st.ty = R1(p ? p.y : z.y);
    st.tele = teleFor(z, st, move, api);
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
    switch (move) {
      // ---------------------------------------------------------- Sandaime Raikage
      case 'kokuton': {
        const x0 = z.x, y0 = z.y, lanes = (st.plan || []).map((l, i) => ({ a: l.a, len: l.len, t0: R3(.03 + Math.abs(i - 2) * .07), seed: R1(Math.random() * 99) }));
        lanes.forEach((l, i) => {
          const c = Math.cos(l.a), s = Math.sin(l.a), ex = x0 + c * l.len, ey = y0 + s * l.len;
          later(st, l.t0, api => api.line(x0 + c * 30, y0 + s * 30, ex, ey, KOK_W, D * 1.5, i % 2 === 0 ? 'lightning' : null));
          later(st, l.t0 + l.len / KOK_SPEED, api => {
            api.strike(ex, ey, 110, D * 1.3, null, null, true);
            if (i % 2 === 0) api.world(ex, ey, 110, D * 2, 'lightning', l.a);
            api.shake(8);
          });
        });
        addFx(st, { kind: 'kokuton', x: R1(x0), y: R1(y0), lanes, dur: 1.8 });
        st.hold = .6; st.holdMove = 'kokuton';
        api.shake(12);
        break;
      }
      case 'nukite4':
        st.hold = STAB_N * STAB_GAP + .25; st.holdMove = 'nukite4';
        for (let i = 0; i < STAB_N; i++) later(st, i * STAB_GAP, api => stab(z, st, api, i, a), true);
        break;
      case 'rush':
        st.armor = Math.max(st.armor, 7.5);
        addFx(st, { kind: 'flare', x: R1(z.x), y: R1(z.y), dur: .9 });
        st.hold = RUSH_N * RUSH_GAP + .35; st.holdMove = 'rush';
        for (let i = 0; i < RUSH_N; i++) later(st, i * RUSH_GAP, api => rushTele(z, st, api, i), true);
        api.shake(8);
        break;
      case 'body': {
        st.guard = BODY_T; st.armor = Math.max(st.armor, BODY_T + 1);
        const f = addFx(st, { kind: 'body', x: R1(z.x), y: R1(z.y), T: BODY_T, bx: 0, by: 0, dur: BODY_T + 1.3 });
        st.hold = BODY_T + .15; st.holdMove = 'body';
        later(st, BODY_T, api => {
          f.bx = R1(z.x); f.by = R1(z.y);
          api.knockback(z, BODY_R, 170, D * 2.2);
          api.world(z.x, z.y, 200, D * 2.4, 'shockwave');
          api.shake(18);
        });
        api.shake(6);
        break;
      }
      case 'quake': {
        const p = st.plan;
        if (!p) break;
        st.jump = { x0: R1(z.x), y0: R1(z.y), x1: p.x, y1: p.y, t: 0 };
        addFx(st, { kind: 'quake', x: p.x, y: p.y, rays: p.rays, t0: QJ_T, dur: QJ_T + 2.3 });
        later(st, QJ_T, api => {
          api.strike(p.x, p.y, QUAKE_R, D * 2.5, '#fff0a0', 'crater');
          api.world(p.x, p.y, 200, D * 3, 'crater');
          api.shake(22);
          p.rays.forEach((r, i) => later(st, .05 + i * .02, api => {
            const c = Math.cos(r.a), s = Math.sin(r.a);
            api.line(p.x + c * 60, p.y + s * 60, p.x + c * r.len, p.y + s * r.len, 28, D * 1.2, i % 3 === 0 ? 'lightning' : null);
          }));
        });
        st.hold = QJ_T + .5; st.holdMove = 'quake';
        break;
      }
      case 'nukite1': {
        const x0 = z.x, y0 = z.y, x1 = x0 + ca * PIERCE_LEN, y1 = y0 + sa * PIERCE_LEN;
        api.line(x0, y0, x1, y1, PIERCE_W, D * 5.2, 'lightning');
        for (const dd of [300, 600, 900]) api.world(x0 + ca * dd, y0 + sa * dd, 140, D * 3.2, 'lightning', a);
        later(st, .14, api => { api.strike(x1, y1, 230, D * 2.2, '#fff6c0', 'crater'); api.world(x1, y1, 220, D * 3.5, 'crater'); api.shake(24); });
        for (let t = .4; t < 1.8; t += .4) later(st, t, api => api.line(x0, y0, x1, y1, 44, D * .45, null));
        let L = 140;
        const r = (z.r || 24) + 2;
        while (L > 30 && api.blocked(x0 + ca * L, y0 + sa * L, r)) L -= 20;
        st.dash = { x0: R1(x0), y0: R1(y0), x1: R1(x0 + ca * L), y1: R1(y0 + sa * L), t: 0, dur: .12, a, kind: 'lunge' };
        addFx(st, { kind: 'pierce', x: R1(x0), y: R1(y0), a, len: PIERCE_LEN, dur: 2.6 });
        st.armor = Math.max(st.armor, 2.5);
        api.shake(32);
        st.hold = .9; st.holdMove = 'nukite1';
        break;
      }
      // ---------------------------------------------------------- Sandaime Kazekage
      case 'drizzle': {
        const spots = st.plan || [];
        let last = 0;
        spots.forEach((s, i) => {
          const tl = s.t0 + DRIZ_FALL;
          last = Math.max(last, tl);
          later(st, tl, api => { api.strike(s.x, s.y, DRIZ_R, D * 1.15, null, i % 6 === 0 ? 'earth' : null, true); if (i % 4 === 0) api.shake(5); });
        });
        addFx(st, { kind: 'drizzle', x: st.tx, y: st.ty, spots, last: R3(last), dur: last + 1.4 });
        st.hold = .5; st.holdMove = 'drizzle';
        break;
      }
      case 'assault': {
        const len = st.plan ? st.plan.len : 700;
        addFx(st, { kind: 'mass', x0: R1(z.x + ca * 40), y0: R1(z.y + sa * 40), a, len: Math.round(len - 40), t0: .05, dmg: D, burst: false, w1: false,
          dur: .05 + (len - 40) / ASL_SPEED + 2.1, upd: massUpd });
        st.hold = .55; st.holdMove = 'assault';
        api.shake(10);
        break;
      }
      case 'arms': {
        const x0 = z.x, y0 = z.y, arms = [], ord = [4, 3, 5, 2, 6, 1, 7, 0, 8];
        for (let i = 0; i < ARM_N; i++) {
          arms.push({ a: R3(a + (i / (ARM_N - 1) - .5) * ARM_HALF * 2 * .92), len: Math.round(ARM_LEN * (.8 + hash(i * 3.3 + st.casts) * .2)),
            t0: R3(ord.indexOf(i) * .04), bend: i % 2 ? 1 : -1, seed: R1(Math.random() * 99) });
        }
        arms.forEach((ar, i) => later(st, ar.t0 + ARM_EXT, api => {
          const c = Math.cos(ar.a), s = Math.sin(ar.a);
          api.line(x0 + c * 30, y0 + s * 30, x0 + c * ar.len, y0 + s * ar.len, 30, D * 1.05, null);
          if (i % 4 === 0) api.world(x0 + c * ar.len, y0 + s * ar.len, 70, D * 1.5, 'blade', ar.a);
        }));
        addFx(st, { kind: 'arms', x: R1(x0), y: R1(y0), arms, dmg: D, tick: .75, dur: 3.3, upd: armsUpd });
        st.hold = 1.15; st.holdMove = 'arms';
        api.shake(6);
        break;
      }
      case 'pull': {
        const x = z.x, y = z.y;
        addFx(st, { kind: 'pull', x: R1(x), y: R1(y), T: PULL_T, dur: PULL_T + 1.7 });
        // the ticks stop early enough that the spike ring is not swallowed by the shove's i-frames
        for (let t = .2; t < PULL_T - .7; t += .3) later(st, t, api => {
          const p = api.player;
          if (!p) return;
          const d = Math.hypot(p.x - x, p.y - y);
          if (d > PULL_R + 40) return;
          api.knockback({ x, y }, PULL_R + 60, -Math.min(115, Math.max(0, d - 80)), D * .16);
          api.shake(4);
        });
        later(st, PULL_T, api => {
          api.strike(x, y, PULL_RING, D * 2.7, '#c0bce0', 'earth');
          api.world(x, y, 190, D * 2.6, 'earth');
          api.shake(18);
        });
        st.hold = PULL_T + .3; st.holdMove = 'pull';
        break;
      }
      case 'spikes': {
        const lanes = st.plan || [];
        let last = 0;
        lanes.forEach(l => {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 70; d <= l.len; d += 85) later(st, l.t0 + d / SPK_SPEED, api => api.strike(l.x0 + c * d, l.y0 + s * d, 58, D * 1.3, null, null, true));
          const te = l.t0 + l.len / SPK_SPEED + .05, ex = l.x0 + c * l.len, ey = l.y0 + s * l.len;
          last = Math.max(last, te);
          later(st, te, api => { api.strike(ex, ey, SPK_END, D * 1.9, null, 'earth', true); api.world(ex, ey, 110, D * 2.2, 'earth', l.a); api.shake(9); });
        });
        addFx(st, { kind: 'spikes', lanes, dur: last + 1.9 });
        st.hold = .8; st.holdMove = 'spikes';
        break;
      }
      case 'world': {
        const x = z.x, y = z.y, lanes = st.plan ? st.plan.lanes : [];
        api.strike(x, y, WORLD_CORE, D * 3.0, '#c8c4e8', 'crater');
        api.world(x, y, 220, D * 3.2, 'crater');
        addFx(st, { kind: 'world', x: R1(x), y: R1(y), lanes, dmg: D, w: 0, dur: WORLD_LEN / WORLD_SPEED + 2.4, upd: worldUpd });
        api.shake(30);
        st.hold = 1.3; st.holdMove = 'world';
        break;
      }
      // ---------------------------------------------------------- Rasa
      case 'goldwave':
        addFx(st, { kind: 'gwave', x: R1(z.x), y: R1(z.y), a, dmg: D, pushed: 0, w: 0, dur: GW_LEN / GW_SPEED + 1.9, upd: gwaveUpd });
        st.hold = .6; st.holdMove = 'goldwave';
        api.shake(10);
        break;
      case 'spears': {
        const spears = [];
        for (let i = 0; i < SP_N; i++) { const o = i - (SP_N - 1) / 2; spears.push({ dx: Math.round(o * 34), h: Math.round(112 - Math.abs(o) * 13), a: 0, t0: -1, done: 0 }); }
        const f = addFx(st, { kind: 'spears', x: R1(z.x), y: R1(z.y), a, spears, dmg: D, dur: SP_N * SP_GAP + SP_FLASH + SP_LEN / SP_SPEED + 1.6, upd: spearsUpd });
        [3, 2, 4, 1, 5, 0, 6].forEach((idx, j) => later(st, j * SP_GAP, api => {
          const sp = f.spears[idx], p = api.player, ox = f.x + sp.dx, oy = f.y;
          sp.a = R3(p ? Math.atan2(p.y - oy, p.x - ox) : a); sp.t0 = R3(f.age + SP_FLASH);
        }));
        st.hold = SP_N * SP_GAP + .3; st.holdMove = 'spears';
        break;
      }
      case 'pyramid': {
        const x = st.tx, y = st.ty;
        addFx(st, { kind: 'pyr', x, y, dur: PYR_CLOSE + PYR_HOLD + 1.3 });
        later(st, PYR_CLOSE, api => { api.strike(x, y, PYR_R, D * 3.0, '#ffe08a', 'crater'); api.world(x, y, 180, D * 3, 'crater'); api.shake(20); });
        for (let t = PYR_CLOSE + .45; t < PYR_CLOSE + PYR_HOLD; t += .4) later(st, t, api => api.strike(x, y, PYR_R * .78, D * .35, null, null, true));
        st.hold = .7; st.holdMove = 'pyramid';
        break;
      }
      case 'hammer': {
        const p0 = st.plan || { x: st.tx, y: st.ty };
        st.hold = (HAM_N - 1) * HAM_GAP + HAM_T + .3; st.holdMove = 'hammer';
        for (let i = 0; i < HAM_N; i++) later(st, i * HAM_GAP, api => {
          if (z.health <= 0) return;
          const p = api.player, x = i === 0 || !p ? p0.x : R1(p.x), y = i === 0 || !p ? p0.y : R1(p.y);
          addFx(st, { kind: 'gblock', x, y, T: HAM_T, rot: R3(rand(-.25, .25)), dur: HAM_T + 1.8 });
          later(st, HAM_T, api => { api.strike(x, y, HAM_R, D * 2.3, '#ffe08a', 'crater'); api.world(x, y, 150, D * 2.6, 'crater'); api.shake(16); });
        });
        break;
      }
      case 'shield': {
        st.guard = SH_T;
        const b = Math.random() * TAU, shards = [];
        for (let i = 0; i < SH_N; i++) shards.push(R3(b + i * TAU / SH_N));
        const f = addFx(st, { kind: 'shield', x: R1(z.x), y: R1(z.y), T: SH_T, shards, bx: 0, by: 0, dur: SH_T + 1.4 });
        later(st, SH_T, api => {
          const x = z.x, y = z.y;
          f.bx = R1(x); f.by = R1(y);
          shards.forEach((aa, i) => {
            const c = Math.cos(aa), s = Math.sin(aa);
            api.line(x + c * 70, y + s * 70, x + c * SH_LEN, y + s * SH_LEN, 28, D * 1.4, i % 4 === 0 ? 'blade' : null);
          });
          api.knockback(z, 240, 130, D * 1.2);
          api.shake(16);
        });
        st.hold = SH_T + .15; st.holdMove = 'shield';
        break;
      }
      case 'tsunami': {
        const p = st.plan;
        if (!p) break;
        addFx(st, { kind: 'tsu', x0: p.x0, y0: p.y0, a: p.a, dmg: D, crash: 0, wd: 0, dur: TSU_LEN / TSU_SPEED + 2.7, upd: tsuUpd });
        st.hold = 1.2; st.holdMove = 'tsunami';
        api.shake(20);
        break;
      }
    }
    st.plan = null;
  }

  // ---- per-frame hit logic of the travelling jutsu
  function massUpd(fx, dt, api) {
    const d = (fx.age - fx.t0) * ASL_SPEED, c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (d < 0) return;
    if (d < fx.len) {
      const x = fx.x0 + c * d, y = fx.y0 + s * d;
      api.strike(x, y, ASL_R + 8, fx.dmg * 1.3, null, null, true);
      if (!fx.w1 && d > fx.len * .5) { fx.w1 = true; api.world(x, y, 130, fx.dmg * 2.2, 'earth', fx.a); }
    } else if (!fx.burst) {
      fx.burst = true;
      const ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
      api.strike(ex, ey, ASL_BURST, fx.dmg * 2.6, '#c8c4e8', 'crater');
      api.world(ex, ey, 220, fx.dmg * 3, 'crater');
      for (let i = 0; i < 3; i++) { const aa = i * TAU / 3 + fx.a; api.world(ex + Math.cos(aa) * 240, ey + Math.sin(aa) * 240, 110, fx.dmg * 2, 'earth', aa); }
      api.shake(20);
    }
  }
  // poison left by the hidden blades keeps hurting whoever stands in it
  const POISON = [1, 4, 7];
  function armsUpd(fx, dt, api) {
    if (fx.age < fx.tick || fx.age > fx.dur - .5) return;
    fx.tick += .45;
    for (const i of POISON) {
      const ar = fx.arms[i];
      if (ar) api.strike(fx.x + Math.cos(ar.a) * ar.len, fx.y + Math.sin(ar.a) * ar.len, 85, fx.dmg * .28, null, null, true);
    }
  }
  function worldUpd(fx, dt, api) {
    const d = fx.age * WORLD_SPEED;
    if (d <= WORLD_LEN) {
      for (const l of fx.lanes) if (d > 150) api.strike(fx.x + Math.cos(l.a) * d, fx.y + Math.sin(l.a) * d, 42, fx.dmg * 2.2, null, null, true);
    } else if (!fx.w) {
      fx.w = 1;
      fx.lanes.forEach((l, i) => { if (i % 3 === 0) api.world(fx.x + Math.cos(l.a) * WORLD_LEN * .85, fx.y + Math.sin(l.a) * WORLD_LEN * .85, 120, fx.dmg * 2.5, 'earth', l.a); });
      api.shake(14);
    }
  }
  function gwaveUpd(fx, dt, api) {
    const r = 60 + fx.age * GW_SPEED;
    if (r > GW_LEN) return;
    for (let k = 0; k < 7; k++) {
      const aa = fx.a + (k / 6 - .5) * GW_HALF * 2;
      api.strike(fx.x + Math.cos(aa) * r, fx.y + Math.sin(aa) * r, 72, fx.dmg * 1.6, null, null, true);
    }
    const p = api.player;
    if (p && !fx.pushed && inCone(p, fx.x, fx.y, fx.a, GW_LEN, GW_HALF)) {
      const d = Math.hypot(p.x - fx.x, p.y - fx.y);
      if (Math.abs(d - r) < 60) { fx.pushed = 1; api.knockback({ x: fx.x, y: fx.y }, d + 30, 150, 0); }
    }
    if (fx.w < 1 && r > 340) { fx.w = 1; api.world(fx.x + Math.cos(fx.a) * r, fx.y + Math.sin(fx.a) * r, 130, fx.dmg * 2.2, 'earth', fx.a); }
    if (fx.w < 2 && r > 700) {
      fx.w = 2;
      for (const o of [-.4, .4]) api.world(fx.x + Math.cos(fx.a + o) * r, fx.y + Math.sin(fx.a + o) * r, 130, fx.dmg * 2.2, 'earth', fx.a + o);
      api.shake(10);
    }
  }
  function spearsUpd(fx, dt, api) {
    for (const sp of fx.spears) {
      if (sp.t0 < 0 || sp.done) continue;
      const u = fx.age - sp.t0;
      if (u < 0) continue;
      const d = u * SP_SPEED, c = Math.cos(sp.a), s = Math.sin(sp.a), ox = fx.x + sp.dx, oy = fx.y;
      if (d > SP_LEN) { sp.done = 1; if (sp.dx === 0 || Math.abs(sp.dx) > 90) api.world(ox + c * SP_LEN, oy + s * SP_LEN, 80, fx.dmg * 1.6, 'blade', sp.a); continue; }
      api.strike(ox + c * d, oy + s * d, 36, fx.dmg * 1.25, null, null, true);
    }
  }
  function tsuUpd(fx, dt, api) {
    const d = fx.age * TSU_SPEED, c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (d < TSU_LEN) {
      const cx = fx.x0 + c * d, cy = fx.y0 + s * d;
      for (let k = -3; k <= 3; k++) api.strike(cx - s * k * TSU_W / 3.2, cy + c * k * TSU_W / 3.2, 92, fx.dmg * 1.6, null, null, true);
      const step = Math.floor(d / 300);
      if (step > fx.wd) {
        fx.wd = step;
        for (const k of [-1.6, 0, 1.6]) api.world(cx - s * k * TSU_W / 3.2, cy + c * k * TSU_W / 3.2, 140, fx.dmg * 2.4, 'earth', fx.a);
        api.shake(12);
      }
    } else if (!fx.crash) {
      fx.crash = 1;
      const ex = fx.x0 + c * TSU_LEN, ey = fx.y0 + s * TSU_LEN;
      for (const k of [-1.9, 0, 1.9]) {
        const x = ex - s * k * TSU_W / 3.2, y = ey + c * k * TSU_W / 3.2;
        api.strike(x, y, 240, fx.dmg * 3.0, '#ffe08a', 'crater');
        api.world(x, y, 220, fx.dmg * 3.2, 'crater');
      }
      api.shake(28);
    }
  }

  // ---- Raikage: Hell Stab volley and the armoured rush
  function stab(z, st, api, i, a0) {
    if (z.health <= 0) return;
    if (i === 0) { fireStab(z, st, api, a0); return; }
    const p = api.player, a = R3(p ? Math.atan2(p.y - z.y, p.x - z.x) : a0);
    addFx(st, { kind: 'tline', x: R1(z.x), y: R1(z.y), a, len: STAB_LEN, w: STAB_W, rgb: '255,236,120', dur: STAB_TELE });
    later(st, STAB_TELE, api => fireStab(z, st, api, a), true);
  }
  function fireStab(z, st, api, a) {
    if (z.health <= 0) return;
    const D = api.damage || 60, c = Math.cos(a), s = Math.sin(a), x0 = z.x, y0 = z.y;
    api.line(x0, y0, x0 + c * STAB_LEN, y0 + s * STAB_LEN, STAB_W, D * 1.55, 'lightning');
    let L = 80;
    const r = (z.r || 24) + 2;
    while (L > 20 && api.blocked(x0 + c * L, y0 + s * L, r)) L -= 20;
    st.dash = { x0: R1(x0), y0: R1(y0), x1: R1(x0 + c * L), y1: R1(y0 + s * L), t: 0, dur: .09, a, kind: 'lunge' };
    addFx(st, { kind: 'stab', x: R1(x0), y: R1(y0), a, dur: .8 });
    api.shake(9);
  }
  function rushTele(z, st, api, i) {
    if (z.health <= 0) return;
    const p = api.player, px = p ? p.x : st.tx, py = p ? p.y : st.ty;
    const a = R3(Math.atan2(py - z.y, px - z.x)), c = Math.cos(a), s = Math.sin(a), r = (z.r || 24) + 2;
    let len = Math.max(260, Math.min(680, Math.hypot(px - z.x, py - z.y) + 160));
    while (len > 90 && api.blocked(z.x + c * len, z.y + s * len, r)) len -= 30;
    addFx(st, { kind: 'tline', x: R1(z.x), y: R1(z.y), a, len: Math.round(len), w: 50, rgb: '255,228,90', dur: RUSH_TELE });
    later(st, RUSH_TELE, api => {
      if (z.health <= 0) return;
      let L = len;
      while (L > 60 && api.blocked(z.x + c * L, z.y + s * L, r)) L -= 30;
      const last = i === RUSH_N - 1;
      st.dash = { x0: R1(z.x), y0: R1(z.y), x1: R1(z.x + c * L), y1: R1(z.y + s * L), t: 0, dur: RUSH_DUR, a, kind: 'rush', last };
      addFx(st, { kind: 'rtrail', x0: st.dash.x0, y0: st.dash.y0, x1: st.dash.x1, y1: st.dash.y1, a, last, dur: 1.4 });
    }, true);
  }
  function dashUpdate(z, st, dt, api) {
    const d = st.dash, D = api.damage || 60;
    d.t += dt;
    const k = Math.min(1, d.t / d.dur), e = easeOut(k);
    z.x = lerp(d.x0, d.x1, e); z.y = lerp(d.y0, d.y1, e);
    if (d.kind === 'rush' && st.ghosts.length < 12) st.ghosts.push({ x: R1(z.x), y: R1(z.y), f: Math.cos(d.a) >= 0 ? 1 : -1, age: 0 });
    if (k < 1) return;
    st.dash = null;
    if (d.kind !== 'rush') return;
    api.line(d.x0, d.y0, d.x1, d.y1, 60, D * 1.8, 'lightning');
    api.strike(d.x1, d.y1, d.last ? 230 : 150, D * (d.last ? 2.0 : 1.2), '#fff2a0', d.last ? 'crater' : 'lightning');
    api.shake(d.last ? 16 : 10);
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
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.dash = null; st.jump = null; st.regen = null; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.armor = Math.max(0, st.armor - dt);
    st.guard = Math.max(0, st.guard - dt);

    // Uế Thổ: the body falls apart into paper and reforms, once, when brought low.
    if (m.edo && !st.regenUsed && z.health < z.maxHealth * REGEN_AT) {
      st.regenUsed = true; st.regen = { t: 0 };
      addFx(st, { kind: 'regen', dur: REGEN_T + .7 });
      api.burst(z.x, z.y - 40, '#efe8d8', 16);
    }
    if (st.regen) {
      st.regen.t += dt;
      z.health = Math.min(z.maxHealth, z.health + z.maxHealth * REGEN_HEAL * dt / REGEN_T);
      if (st.regen.t >= REGEN_T) st.regen = null;
    }

    if (st.jump) {
      const j = st.jump;
      j.t += dt;
      const e = clamp01(j.t / QJ_T);
      z.x = lerp(j.x0, j.x1, e); z.y = lerp(j.y0, j.y1, e);
      if (j.t >= QJ_T) st.jump = null;
    }
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
    } else if (st.hold <= 0 && !st.dash && !st.jump) {
      st.holdMove = '';
      st.timer -= dt;
      const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      if (st.timer <= 0 && p && (st.force || d < 900)) announce(z, st, m, api);
    }
    const guardK = z.bossId === 'raikage3' ? .12 : .2;
    z.armorScale = m.armor * (st.guard > 0 ? guardK : st.armor > 0 ? .85 : 1);
    z.kageDash = st.dash || st.jump ? .05 : 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.speedScale = z.bossId === 'raikage3' && st.armor > 0 ? 1.55 : .9;
  }
  function bodyLift(z) {
    const st = z.ek;
    return st && st.jump ? Math.sin(Math.PI * clamp01(st.jump.t / QJ_T)) * 170 : 0;
  }

  // ------------------------------------------------------------------ cached art
  function puffSpr(key, stops) {
    return Kit().sprite('ek:p' + key, 96, 96, g => {
      const gr = g.createRadialGradient(40, 38, 0, 48, 48, 48);
      for (const [s, c] of stops) gr.addColorStop(s, c);
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  const ironPuff = () => puffSpr('iron', [[0, 'rgba(126,124,148,.95)'], [.35, 'rgba(72,70,88,.9)'], [.7, 'rgba(40,38,50,.62)'], [.9, 'rgba(26,24,34,.22)'], [1, 'rgba(20,18,28,0)']]);
  const goldPuff = () => puffSpr('gold', [[0, '#fff6c8'], [.3, '#f6d470'], [.62, '#d8a030'], [.86, 'rgba(150,100,24,.55)'], [1, 'rgba(120,80,20,0)']]);
  const poisonPuff = () => puffSpr('poison', [[0, 'rgba(210,170,255,.8)'], [.4, 'rgba(140,90,200,.6)'], [.75, 'rgba(90,140,90,.3)'], [1, 'rgba(60,100,60,0)']]);
  const paperPuff = () => puffSpr('ash', [[0, 'rgba(240,232,214,.9)'], [.5, 'rgba(200,190,170,.6)'], [1, 'rgba(160,150,130,0)']]);
  const GOLDF = [[1, '#7a5410'], [.84, '#b8841e'], [.66, '#e0ae38'], [.46, '#f8d466'], [.25, '#fff6cc']];
  const IRONF = [[1, '#0e0c14'], [.84, '#22202c'], [.66, '#383646'], [.46, '#55536a'], [.25, '#8c8aa8']];
  function tongue(ctx, m, pal, tag, x, y, h, shear, v, alpha) {
    if (h < 4 || alpha < .02) return;
    ctx.globalAlpha = alpha;
    Kit().flameAt(ctx, m, Kit().flame(v, pal, tag), x, y, h * .5, h, shear);
  }

  // Iron sand spikes: a cluster of black needles standing on a base at (40, 112).
  function spikeSpr(v) {
    return Kit().sprite('ek:spk' + (v % 3), 80, 120, g => {
      const base = 112, cx = 40;
      g.fillStyle = 'rgba(14,12,20,.85)'; g.beginPath(); g.ellipse(cx, base, 30, 7, 0, 0, TAU); g.fill();
      for (const i of [0, 4, 1, 3, 2]) {
        const lean = (i - 2) * .22 + (hash(i + v * 7) - .5) * .2, h = i === 2 ? 104 : 58 + hash(i * 3 + v) * 34, w = i === 2 ? 10 : 6.5;
        const bx = cx + (i - 2) * 8, tx = bx + Math.sin(lean) * h, ty = base - Math.cos(lean) * h;
        g.fillStyle = '#0c0a12'; g.beginPath(); g.moveTo(bx - w - 1.6, base + 2); g.lineTo(tx, ty - 2.5); g.lineTo(bx + w + 1.6, base + 2); g.closePath(); g.fill();
        g.fillStyle = '#34323f'; g.beginPath(); g.moveTo(bx - w, base); g.lineTo(tx, ty); g.lineTo(bx + w, base); g.closePath(); g.fill();
        g.fillStyle = '#6c6a88'; g.beginPath(); g.moveTo(bx - w * .75, base); g.lineTo(tx, ty); g.lineTo(bx - w * .1, base); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(200,200,240,.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx - w * .45, base - 5); g.lineTo(lerp(tx, bx, .08), lerp(ty, base, .08)); g.stroke();
      }
      g.fillStyle = 'rgba(30,28,40,.9)';
      for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(cx + (hash(i * 2.1 + v) - .5) * 56, base - 1 + (hash(i * 3.7) - .5) * 8, 1.4 + hash(i) * 2, 0, TAU); g.fill(); }
    });
  }
  function drawSpike(ctx, v, x, y, s, alpha) {
    if (s < .05 || alpha < .02) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(spikeSpr(v), x - 40 * s, y - 112 * s, 80 * s, 120 * s);
    ctx.globalAlpha = 1;
  }
  // A ball of compressed iron sand bristling with spikes.
  function spikeBallSpr() {
    return Kit().sprite('ek:sball', 256, 256, g => {
      const c = 128, R = 66;
      for (let i = 0; i < 30; i++) {
        const a = i / 30 * TAU + hash(i) * .12, L = R + 26 + hash(i * 3.1) * 34, w = .1 + hash(i * 7.3) * .05;
        g.fillStyle = '#0c0a12';
        g.beginPath(); g.moveTo(c + Math.cos(a - w) * (R - 4), c + Math.sin(a - w) * (R - 4)); g.lineTo(c + Math.cos(a) * (L + 3), c + Math.sin(a) * (L + 3)); g.lineTo(c + Math.cos(a + w) * (R - 4), c + Math.sin(a + w) * (R - 4)); g.fill();
        g.fillStyle = Math.sin(a + 2.2) > 0 ? '#5a5874' : '#2c2a38';
        g.beginPath(); g.moveTo(c + Math.cos(a - w * .7) * R, c + Math.sin(a - w * .7) * R); g.lineTo(c + Math.cos(a) * L, c + Math.sin(a) * L); g.lineTo(c + Math.cos(a + w * .7) * R, c + Math.sin(a + w * .7) * R); g.fill();
      }
      const gr = g.createRadialGradient(c - 22, c - 24, 6, c, c, R);
      gr.addColorStop(0, '#7c7a98'); gr.addColorStop(.45, '#3e3c4e'); gr.addColorStop(1, '#141220');
      g.fillStyle = gr; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
      g.fillStyle = 'rgba(10,8,16,.55)';
      for (let i = 0; i < 70; i++) { const a = hash(i * 1.7) * TAU, d = Math.sqrt(hash(i * 2.9)) * R * .92; g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.2 + hash(i * 5.1) * 2.4, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(170,170,230,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, R - 3, 3.6, 5.0); g.stroke();
      g.strokeStyle = '#0a0810'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, R, 0, TAU); g.stroke();
    });
  }
  // Gold spear pointing +x (centre = middle of the shaft).
  function spearSpr() {
    return Kit().sprite('ek:gspear', 150, 30, g => {
      const path = () => { g.beginPath(); g.moveTo(147, 15); g.lineTo(96, 4); g.lineTo(10, 11); g.lineTo(2, 15); g.lineTo(10, 19); g.lineTo(96, 26); g.closePath(); };
      path(); g.fillStyle = '#5a3a08'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#e8b23a'; g.fillRect(0, 0, 150, 30);
      g.fillStyle = '#ffe78a'; g.beginPath(); g.moveTo(147, 15); g.lineTo(96, 5); g.lineTo(10, 12); g.lineTo(10, 15); g.closePath(); g.fill();
      g.fillStyle = '#a8761a'; g.beginPath(); g.moveTo(147, 15); g.lineTo(96, 26); g.lineTo(10, 18); g.lineTo(10, 15); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(40, 11, 70, 1.6);
      g.restore();
      path(); g.strokeStyle = '#4a3006'; g.lineWidth = 2; g.stroke();
    });
  }
  // A compressed lump of gold dust, crown of grains on top.
  function goldBlockSpr() {
    return Kit().sprite('ek:gblock', 200, 170, g => {
      const path = () => {
        g.beginPath();
        for (let k = 0; k <= 12; k++) {
          const a = k / 12 * TAU, r = 1 + (hash(k % 12 + 3) - .5) * .22;
          const x = 100 + Math.cos(a) * 88 * r, y = 92 + Math.sin(a) * 70 * r;
          if (k) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath();
      };
      path(); g.fillStyle = '#c8901e'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#f2c654'; g.beginPath(); g.ellipse(80, 66, 80, 50, -.2, 0, TAU); g.fill();
      g.fillStyle = '#fff0a8'; g.beginPath(); g.ellipse(70, 52, 40, 18, -.3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(110,70,10,.5)'; g.beginPath(); g.ellipse(130, 140, 100, 44, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,80,20,.5)';
      for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(20 + hash(i * 1.3) * 160, 30 + hash(i * 2.7) * 120, 1 + hash(i * 4.1) * 2.2, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(255,246,200,.6)'; g.lineWidth = 1.4;
      for (let i = 0; i < 7; i++) { const y = 40 + i * 16; g.beginPath(); g.moveTo(24, y + hash(i) * 6); g.quadraticCurveTo(100, y - 10, 176, y + hash(i + 5) * 6); g.stroke(); }
      g.restore();
      path(); g.strokeStyle = '#4a3006'; g.lineWidth = 4; g.stroke();
    });
  }

  // ------------------------------------------------------------------ shared draw helpers
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small, inward) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(18,16,30,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 1.8 : faint ? 2 : 3;
    ctx.stroke();
    if (inward) {
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) {
        const ph = frac(-time * .9 + i / 3), rr = r * (.2 + .8 * ph);
        ctx.strokeStyle = `rgba(${rgb},${.55 * ph})`; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
      }
    } else if (!faint) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14)); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12));
      }
      ctx.stroke();
    }
  }
  function markLine(ctx, x, y, a, len, w, faint, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = `rgba(18,16,30,${faint ? .08 : .16})`; ctx.fillRect(0, -w, len, w * 2);
    ctx.fillStyle = `rgba(${rgb},${(faint ? .08 : .14) + .16 * k})`; ctx.fillRect(0, -w, len * clamp01(k), w * 2);
    ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = faint ? 3.5 : 5; ctx.strokeRect(0, -w, len, w * 2);
    ctx.lineWidth = faint ? 1.8 : 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -w, len, w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    const ch = Math.min(w * .4, 26);
    for (let d = 60 + (time * 260) % 120; d < len - 20; d += 120) { ctx.moveTo(d - 16, -ch); ctx.lineTo(d, 0); ctx.lineTo(d - 16, ch); }
    ctx.stroke();
    ctx.restore();
  }
  function markCone(ctx, x, y, a, L, h, inward, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const wedge = r => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -h, h); ctx.closePath(); };
    wedge(L); ctx.fillStyle = 'rgba(18,16,30,.13)'; ctx.fill();
    wedge(L * clamp01(k)); ctx.fillStyle = `rgba(${rgb},${.1 + .16 * k})`; ctx.fill();
    wedge(L); ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const ph = frac(time * 1.6 * (inward ? -1 : 1) + i / 7), r = 50 + ph * (L - 70);
      ctx.moveTo(Math.cos(-h * .85) * r, Math.sin(-h * .85) * r); ctx.arc(0, 0, r, -h * .85, h * .85);
    }
    ctx.stroke();
    ctx.restore();
  }
  function cracks(ctx, x, y, r, n, seed, alpha, w = 2.5, color = '28,18,22') {
    if (alpha <= .01 || r < 4) return;
    ctx.strokeStyle = `rgba(${color},${.7 * alpha})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
  function crater(ctx, x, y, r, alpha, seed, tint) {
    if (alpha <= .01) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = tint ? tint[0] : '#6a5848'; ctx.beginPath(); ctx.ellipse(x, y, r * .9, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = tint ? tint[1] : '#2c221e'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .7, r * .34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,150,.35)'; ctx.beginPath(); ctx.ellipse(x, y - r * .36, r * .7, r * .08, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    cracks(ctx, x, y, r * 1.35, 9, seed, alpha, 3);
  }
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10, img) {
    if (alpha <= .01) return;
    const K = Kit(), dust = img || K.puff('dust');
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  // A jagged fissure along a ray; the same seed always gives the same crack.
  const FPX = new Float32Array(24), FPY = new Float32Array(24);
  function fissure(x, y, a, len, seed) {
    const c = Math.cos(a), s = Math.sin(a), n = 10;
    for (let i = 0; i <= n; i++) {
      const d = len * i / n, o = i === 0 ? 0 : (hash(seed + i * 2.7) - .5) * 26;
      FPX[i] = x + c * d - s * o; FPY[i] = y + (s * d + c * o) * .62 + s * d * .38;
    }
    return n + 1;
  }
  function strokeFissure(ctx, n, upto) {
    const m = Math.max(2, Math.min(n, Math.ceil(upto * (n - 1)) + 1));
    ctx.beginPath(); ctx.moveTo(FPX[0], FPY[0]);
    for (let i = 1; i < m; i++) ctx.lineTo(FPX[i], FPY[i]);
    ctx.stroke();
  }

  // Lightning palettes: Kumo yellow, armour blue, black lightning (dark body, white core).
  const BOLT_Y = ['255,200,60', '255,236,140', '255,255,235'];
  const BOLT_B = ['110,180,255', '190,228,255', '255,255,255'];
  const BOLT_K = ['120,80,230', '46,22,96', '242,236,255'];
  function bolt(ctx, x1, y1, x2, y2, seed, time, w, alpha, pal, o = {}) {
    if (alpha <= .01) return;
    Kit().forkedBolt(ctx, x1, y1, x2, y2, seed, time, { jitter: o.jitter || Math.min(40, Math.hypot(x2 - x1, y2 - y1) * .08 + 4), alpha: Math.min(1, alpha), width: w, pal,
      base: o.base, forkBase: !!o.base, step: o.step || 16, forks: o.forks == null ? 2 : o.forks, forkLen: o.forkLen || 30, rate: o.rate || 20, snap: true });
  }

  // ------------------------------------------------------------------ Raikage effects
  function tlineG(ctx, fx, time) { markLine(ctx, fx.x, fx.y, fx.a, fx.len, fx.w, false, fx.rgb, fx.age / fx.dur, time); }

  function kokutonG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.lineCap = 'round';
    for (const l of fx.lanes) {
      const u = fx.age - l.t0;
      if (u < 0) continue;
      const c = Math.cos(l.a), s = Math.sin(l.a), d = Math.min(l.len, u * KOK_SPEED);
      const x0 = fx.x + c * 30, y0 = fx.y + s * 30, x1 = fx.x + c * d, y1 = fx.y + s * d;
      ctx.strokeStyle = `rgba(30,14,46,${.3 * fade})`; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = `rgba(8,4,16,${.55 * fade})`; ctx.lineWidth = 6; ctx.stroke();
      if (u * KOK_SPEED >= l.len) {
        const v = u - l.len / KOK_SPEED;
        ctx.fillStyle = `rgba(20,10,30,${.35 * fade})`; ctx.beginPath(); ctx.ellipse(x1, y1, 80, 38, 0, 0, TAU); ctx.fill();
        cracks(ctx, x1, y1, 130 * easeOut(v * 4), 9, l.seed, fade, 2.5);
      }
    }
  }
  function kokutonO(ctx, fx, time, z) {
    const K = Kit(), hx = (z ? z.x : fx.x) + Math.cos(fx.lanes[2] ? fx.lanes[2].a : 0) * 22, hy = (z ? z.y : fx.y) - 46;
    ctx.globalCompositeOperation = 'lighter';
    const fadeAll = 1 - win(fx.age, fx.dur - .7, fx.dur);
    for (const l of fx.lanes) {
      const u = fx.age - l.t0;
      if (u < 0) continue;
      const c = Math.cos(l.a), s = Math.sin(l.a), d = Math.min(l.len, u * KOK_SPEED);
      const strong = 1 - win(u, .32, .85), ex = fx.x + c * d, ey = fx.y + s * d - 6;
      if (strong > 0) {
        bolt(ctx, hx, hy, ex, ey, l.seed, time, 3 * strong + 1.2, strong, BOLT_K, { base: 'rgba(6,2,14,.92)', forks: 3, forkLen: 46, jitter: 26 });
        bolt(ctx, hx, hy, ex - s * 34, ey + c * 34, l.seed + 9, time, 1.5, strong * .7, BOLT_K, { base: 'rgba(6,2,14,.85)', forks: 1, jitter: 36 });
        K.glow(ctx, ex, ey, 80, '150,110,255', .32 * strong);
      }
      // residual black crackle crawling along the burnt lane
      if (u > .25 && fadeAll > 0) {
        const tk = Math.floor(time * 12 + l.seed), d0 = 60 + hash(l.seed + tk) * (l.len - 160);
        const x0 = fx.x + c * d0, y0 = fx.y + s * d0 - 4, x1 = fx.x + c * (d0 + 90), y1 = fx.y + s * (d0 + 90) - 4;
        bolt(ctx, x0, y0, x1, y1, l.seed + tk, time, 1.3, .8 * fadeAll, BOLT_K, { base: 'rgba(6,2,14,.8)', forks: 1, jitter: 12, forkLen: 18 });
      }
      if (u * KOK_SPEED >= l.len) {
        const v = u - l.len / KOK_SPEED;
        if (v < .7) {
          K.fx.shockRing(ctx, ex, ey + 6, 150, v / .7, 1 - v / .7, '170,140,255');
          K.glow(ctx, ex, ey - 20, 110, '200,180,255', .5 * (1 - v / .7), true);
        }
      }
    }
    if (fx.age < .5) K.glow(ctx, hx, hy, 70, '170,140,255', .6 * (1 - fx.age / .5), true);
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age < 1.1) {
      const dark = K.puff('violet');
      for (const l of fx.lanes) {
        const v = fx.age - l.t0 - l.len / KOK_SPEED;
        if (v < 0 || v > .9) continue;
        const ex = fx.x + Math.cos(l.a) * l.len, ey = fx.y + Math.sin(l.a) * l.len;
        for (let i = 0; i < 4; i++) K.stamp(ctx, dark, ex + (hash(i + l.seed) - .5) * 90, ey - 14 - v * 50 - i * 8, 20 + v * 40, (1 - v / .9) * .55, .75);
      }
    }
  }

  function stabG(ctx, fx) {
    const fade = 1 - win(fx.age, .3, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(60,40,10,${.22 * fade})`; ctx.fillRect(30, -STAB_W * .6, STAB_LEN - 30, STAB_W * 1.2);
    ctx.strokeStyle = `rgba(30,20,10,${.5 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath(); for (const k of [-.4, -.13, .13, .4]) { ctx.moveTo(40, k * STAB_W); ctx.lineTo(STAB_LEN - 10, k * STAB_W * .3); } ctx.stroke();
    ctx.restore();
    void c; void s;
  }
  function stabO(ctx, fx, time) {
    const K = Kit(), u = fx.age, k = 1 - win(u, .12, .6);
    if (k <= 0) return;
    const c = Math.cos(fx.a), s = Math.sin(fx.a), L = STAB_LEN * easeOut(u / .07);
    const hx = fx.x + c * 26, hy = fx.y + s * 26 - 42, tx = fx.x + c * L, ty = fx.y + s * L - 20;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(70,46,8,${.38 * k})`; ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const nx = -s, ny = c * .6;
    for (let f = 0; f < 4; f++) { const o = (f - 1.5) * 13; bolt(ctx, hx + nx * o, hy + ny * o, tx, ty, fx.seed + f * 7, time, 2.2, k, BOLT_Y, { forks: 1, jitter: 10, step: 22 }); }
    ctx.strokeStyle = `rgba(255,220,110,${.45 * k})`; ctx.lineWidth = 28; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,240,${.9 * k})`; ctx.lineWidth = 7; ctx.stroke();
    for (let i = 0; i < 5; i++) K.glow(ctx, lerp(hx, tx, i / 4), lerp(hy, ty, i / 4), 60, '255,220,90', .3 * k);
    K.glow(ctx, tx, ty, 95, '255,240,170', .75 * k, true);
    K.glow(ctx, hx, hy, 60, '255,250,220', .6 * k, true);
    ctx.globalCompositeOperation = 'source-over';
    if (u < .5) K.fx.shockRing(ctx, tx, ty + 18, 120, u / .5, 1 - u / .5, '255,230,120');
  }

  function rtrailG(ctx, fx) {
    const fade = 1 - win(fx.age, .5, fx.dur);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(40,30,10,${.3 * fade})`; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
    ctx.strokeStyle = `rgba(20,14,6,${.45 * fade})`; ctx.lineWidth = 5; ctx.stroke();
    if (fx.age > .14) cracks(ctx, fx.x1, fx.y1, (fx.last ? 230 : 150) * easeOut((fx.age - .14) * 5), 8, fx.seed, fade, 2.5);
  }
  function rtrailO(ctx, fx, time) {
    const K = Kit(), u = fx.age, k = 1 - win(u, .15, .7);
    ctx.globalCompositeOperation = 'lighter';
    if (k > 0) {
      for (let i = 0; i < 3; i++) bolt(ctx, fx.x0, fx.y0 - 30 - i * 10, fx.x1, fx.y1 - 30 - i * 8, fx.seed + i * 5, time, 2.4 - i * .5, k, i % 2 ? BOLT_B : BOLT_Y, { forks: 2, jitter: 22, base: i === 0 ? 'rgba(80,60,10,.4)' : null });
      K.glow(ctx, fx.x1, fx.y1 - 30, 90, '255,230,120', .6 * k, true);
    }
    ctx.globalCompositeOperation = 'source-over';
    const v = u - .15;
    if (v > 0 && v < .9) {
      if (fx.last) K.fx.lightningBlast(ctx, fx.x1, fx.y1, 230, v, 1 - win(v, .4, .9), time, fx.seed);
      K.fx.shockRing(ctx, fx.x1, fx.y1, fx.last ? 260 : 170, v / .9, 1 - v / .9, '255,230,120');
      if (v < .6) K.fx.debris(ctx, fx.x1, fx.y1, 140, v / .6, fx.seed, '#3a2c22', 9);
    }
  }
  function flareO(ctx, fx, time, z) {
    const K = Kit(), u = fx.age / fx.dur, x = z ? z.x : fx.x, y = z ? z.y : fx.y;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - 44, 130 * easeOut(u * 2), '150,200,255', .55 * (1 - u), true);
    ctx.globalCompositeOperation = 'source-over';
    K.fx.shockRing(ctx, x, y, 180, u, 1 - u, '170,210,255');
  }
  // The Raikage's lightning armour: bolts crawling up the whole body (blue and Kumo yellow).
  function armorAura(ctx, z, st, time, power) {
    const K = Kit(), lift = bodyLift(z), H = HEIGHT('raikage3'), cx = z.x, top = z.y - lift - H + 4, a = Math.min(1, power);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, z.y - lift - H * .45, H * .75, '130,200,255', .16 * a);
    for (let i = 0; i < 6; i++) {
      const s = (i - 2.5) * 12, ph = hash(Math.floor(time * 20) + i * 7.7);
      bolt(ctx, cx + s, z.y - lift + 2, cx + s * .5 + (ph - .5) * 34, top - ph * 22, i * 13 + 5, time, 1.4, .72 * a, i % 2 ? BOLT_B : BOLT_Y,
        { jitter: 10, step: 12, forks: 1, forkLen: 18, rate: 22 });
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function bodyG(ctx, fx, time, z) {
    const x = z ? z.x : fx.x, y = z ? z.y : fx.y;
    if (fx.age < fx.T) {
      markCircle(ctx, x, y, BODY_R, '255,236,140', fx.age / fx.T, time, fx.age < fx.T - 1, false);
      Kit().fx.groundGlow(ctx, x, y, 120, '255,230,140', .35);
      return;
    }
    const v = fx.age - fx.T, fade = 1 - win(v, .6, 1.3);
    cracks(ctx, fx.bx, fx.by, BODY_R * easeOut(v * 3), 14, fx.seed, fade, 3);
    dustRing(ctx, fx.bx, fx.by, BODY_R * (.4 + easeOut(v / 1.2) * .7), 18, 30 + v * 30, .8 * fade, fx.seed, 8 + v * 20);
  }
  function bodyO(ctx, fx, time, z) {
    const K = Kit();
    if (fx.age < fx.T) {
      if (!z) return;
      const H = HEIGHT('raikage3'), cy = z.y - H * .5, p = .75 + .25 * Math.sin(time * 18);
      // the impervious body: a white-hot sheen over the skin, deflection sparks on every hit
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, cy, H * .9, '255,240,180', .3 * p);
      ctx.strokeStyle = `rgba(255,250,220,${.55 * p})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(z.x, cy, H * .42, H * .62, 0, 0, TAU); ctx.stroke();
      if (z.hitFlash > 0) {
        const tk = Math.floor(time * 30);
        ctx.strokeStyle = 'rgba(255,255,220,.95)'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = hash(tk + i * 3.1) * TAU, r0 = H * .4, r1 = r0 + 18 + hash(tk + i) * 26;
          ctx.moveTo(z.x + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 1.3); ctx.lineTo(z.x + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 1.3);
        }
        ctx.stroke();
        K.glow(ctx, z.x, cy, 60, '255,255,230', .7, true);
      }
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const v = fx.age - fx.T;
    if (v < 1.2) {
      K.fx.lightningBlast(ctx, fx.bx, fx.by, BODY_R * .8, v, 1 - win(v, .5, 1.2), time, fx.seed);
      K.fx.shockRing(ctx, fx.bx, fx.by, BODY_R * 1.1, v / 1, 1 - v, '255,236,140');
      K.fx.shockRing(ctx, fx.bx, fx.by, BODY_R * 1.5, v / 1.2, (1 - v / 1.2) * .6, '255,255,255');
      if (v < .8) K.fx.debris(ctx, fx.bx, fx.by, 260, v / .8, fx.seed, '#3a2c22', 14);
    }
  }

  function quakeG(ctx, fx, time) {
    const v = fx.age - fx.t0;
    if (v < 0) {
      const k = fx.age / fx.t0;
      ctx.fillStyle = `rgba(20,16,10,${.15 + .3 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 40 + 60 * k, 18 + 26 * k, 0, 0, TAU); ctx.fill();
      return;
    }
    const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    crater(ctx, fx.x, fx.y, QUAKE_R * .62, fade * .95, fx.seed);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const r of fx.rays) {
      const n = fissure(fx.x, fx.y, r.a, r.len, r.seed), up = clamp01((v - .04) * 2600 / r.len);
      if (up <= 0) continue;
      ctx.strokeStyle = `rgba(26,18,12,${.8 * fade})`; ctx.lineWidth = 7; strokeFissure(ctx, n, up);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,220,100,${.85 * fade * (1 - win(v, .4, 1.6))})`; ctx.lineWidth = 2.6; strokeFissure(ctx, n, up);
      ctx.globalCompositeOperation = 'source-over';
    }
    dustRing(ctx, fx.x, fx.y, QUAKE_R * (.5 + easeOut(v / 1.2) * .7), 20, 32 + v * 40, .85 * (1 - win(v, .6, 1.8)), fx.seed, 8 + v * 20);
  }
  function quakeO(ctx, fx, time) {
    const K = Kit(), v = fx.age - fx.t0;
    if (v < 0) return;
    if (v < 1.3) K.fx.lightningBlast(ctx, fx.x, fx.y, QUAKE_R * 1.15, v, 1 - win(v, .5, 1.3), time, fx.seed);
    if (v < 1) { K.fx.shockRing(ctx, fx.x, fx.y, QUAKE_R * 1.4, v, 1 - v, '255,230,120'); K.fx.shockRing(ctx, fx.x, fx.y, QUAKE_R * 2, v / 1, (1 - v) * .5, '255,255,255'); }
    if (v < .9) K.fx.debris(ctx, fx.x, fx.y, QUAKE_R * 1.3, v / .9, fx.seed, '#3a2c22', 16);
    const k = 1 - win(v, .2, .8);
    if (k > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (const r of fx.rays) {
        const d = Math.min(r.len, (v - .04) * 2600);
        if (d < 20) continue;
        bolt(ctx, fx.x, fx.y - 10, fx.x + Math.cos(r.a) * d, fx.y + Math.sin(r.a) * d - 6, r.seed, time, 2, k, BOLT_Y, { forks: 2, jitter: 18, base: 'rgba(80,56,10,.45)' });
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function pierceG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .9, fx.dur), e = easeOut(fx.age / .12), L = fx.len * e;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(52,36,14,${.3 * fade})`; ctx.fillRect(30, -PIERCE_W * .9, L - 30, PIERCE_W * 1.8);
    ctx.fillStyle = `rgba(24,16,8,${.45 * fade})`; ctx.fillRect(30, -PIERCE_W * .35, L - 30, PIERCE_W * .7);
    ctx.strokeStyle = `rgba(20,14,8,${.6 * fade})`; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const k of [-.85, .85]) { ctx.moveTo(30, k * PIERCE_W); for (let x = 90; x < L; x += 60) ctx.lineTo(x, k * PIERCE_W + (hash(x * .1 + k + fx.seed) - .5) * 16); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,220,110,${.6 * fade * (1 - win(fx.age, .4, 1.8))})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(40, 0); for (let x = 100; x < L; x += 50) ctx.lineTo(x, (hash(x * .3 + fx.seed) - .5) * 14); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    if (fx.age > .14) {
      const ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len, v = fx.age - .14;
      crater(ctx, ex, ey, 150, fade * .9, fx.seed);
      dustRing(ctx, ex, ey, 230 * (.4 + easeOut(v / 1.2) * .8), 18, 34 + v * 40, .85 * (1 - win(v, .6, 1.9)), fx.seed, 8 + v * 20);
    }
  }
  function pierceO(ctx, fx, time) {
    const K = Kit(), u = fx.age, c = Math.cos(fx.a), s = Math.sin(fx.a), L = fx.len * easeOut(u / .12);
    const k = 1 - win(u, .6, 1.4), hx = fx.x + c * 30, hy = fx.y + s * 30 - 42, tx = fx.x + c * L, ty = fx.y + s * L - 16;
    if (k > 0) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(70,46,8,${.4 * k})`; ctx.lineWidth = 90; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,200,70,${.35 * k})`; ctx.lineWidth = 74; ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,160,${.8 * k})`; ctx.lineWidth = 34; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.95 * k})`; ctx.lineWidth = 12; ctx.stroke();
      const n = Math.max(2, Math.round(L / 70));
      for (let i = 0; i <= n; i++) K.glow(ctx, lerp(hx, tx, i / n), lerp(hy, ty, i / n), 80, '255,220,90', .26 * k);
      // spiralling arcs wound round the lance
      for (let i = 0; i < 5; i++) bolt(ctx, hx, hy + (i - 2) * 8, tx, ty + (i - 2) * 4, fx.seed + i * 11, time, 2.2, k, i % 2 ? BOLT_B : BOLT_Y, { forks: 3, jitter: 34, forkLen: 50, step: 26 });
      K.glow(ctx, hx, hy, 110, '255,250,220', .8 * k, true);
      K.glow(ctx, tx, ty, 160, '255,240,170', .8 * k, true);
      ctx.globalCompositeOperation = 'source-over';
      // pressure rings travelling down the lance
      for (let i = 0; i < 6; i++) {
        const ph = frac(u * 2.4 + i / 6), px = lerp(hx, tx, ph), py = lerp(hy, ty, ph), rr = 30 + ph * 40;
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(ty - hy, tx - hx));
        ctx.strokeStyle = `rgba(80,56,10,${.35 * k * (1 - ph)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, rr * .3, rr, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,230,${.9 * k * (1 - ph)})`; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.restore();
      }
    }
    // the lance leaves crackling arcs along its path
    const res = (1 - win(u, 1.2, fx.dur)) * win(u, .3, .6);
    if (res > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const tk = Math.floor(u * 10 + i * 3.3), d0 = 80 + hash(fx.seed + tk + i) * (fx.len - 220);
        bolt(ctx, fx.x + c * d0, fx.y + s * d0 - 6, fx.x + c * (d0 + 140), fx.y + s * (d0 + 140) - 6, fx.seed + tk * 7 + i, u, 1.6, res, BOLT_Y, { forks: 1, jitter: 16, base: 'rgba(80,56,10,.4)' });
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    const v = u - .14;
    if (v > 0 && v < 1.4) {
      const ex = fx.x + c * fx.len, ey = fx.y + s * fx.len;
      K.fx.lightningBlast(ctx, ex, ey, 260, v, 1 - win(v, .5, 1.4), time, fx.seed);
      K.fx.shockRing(ctx, ex, ey, 300, v / 1.1, 1 - v / 1.1, '255,236,140');
      if (v < .9) K.fx.debris(ctx, ex, ey, 220, v / .9, fx.seed, '#3a2c22', 14);
    }
    if (u < .7) K.fx.shockRing(ctx, fx.x, fx.y, 200, u / .7, 1 - u / .7, '255,250,210');
  }

  // Uế Thổ: paper flakes peel off and whirl back onto the body as it reforms.
  function regenO(ctx, fx, time, z) {
    if (!z) return;
    const K = Kit(), H = HEIGHT(z.bossId), k = 1 - win(fx.age, fx.dur - .6, fx.dur), cy = z.y - H * .5;
    for (let i = 0; i < 22; i++) {
      const ph = frac(fx.age * .7 + hash(i * 3.1)), r = (1 - ph) * (90 + hash(i) * 60) + 10, a = hash(i * 7.7) * TAU + fx.age * 3 * (i % 2 ? 1 : -1);
      const x = z.x + Math.cos(a) * r, y = cy + Math.sin(a) * r * .7 - ph * 20;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + time * 4 + i);
      ctx.globalAlpha = k * bell(ph);
      ctx.fillStyle = '#2a2420'; ctx.fillRect(-4.6, -3.4, 9.2, 6.8);
      ctx.fillStyle = i % 3 ? '#f2ead8' : '#d8ccb4'; ctx.fillRect(-4, -2.8, 8, 5.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const ash = paperPuff();
    for (let i = 0; i < 5; i++) K.stamp(ctx, ash, z.x + Math.sin(time * 3 + i * 2) * 26, cy + 20 - i * 14, 16 + i * 3, .35 * k, .8);
  }

  // ------------------------------------------------------------------ Kazekage effects
  function chakraThreads(ctx, z, time) {
    const H = HEIGHT('kazekage3'), lift = bodyLift(z);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const ax = z.x + (i - 2) * 9, ay = z.y - lift - H * (.35 + (i % 3) * .2), top = z.y - 720;
      const sway = Math.sin(time * 1.6 + i) * 14, bx = z.x + (i - 2) * 46 + sway;
      ctx.strokeStyle = 'rgba(90,170,255,.22)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(lerp(ax, bx, .5) + sway, lerp(ay, top, .5), bx, top); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,235,255,.75)'; ctx.lineWidth = 1.1; ctx.stroke();
      Kit().glow(ctx, ax, ay, 8, '150,210,255', .7);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drizzleG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    for (const s of fx.spots) {
      const u = fx.age - s.t0;
      if (u < 0) continue;
      if (u < DRIZ_FALL) {
        const k = u / DRIZ_FALL;
        ctx.fillStyle = `rgba(16,14,24,${.12 + .3 * k})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 12 + 30 * k, 6 + 14 * k, 0, 0, TAU); ctx.fill();
        continue;
      }
      const v = u - DRIZ_FALL;
      ctx.fillStyle = `rgba(18,16,26,${.45 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 44, 20, 0, 0, TAU); ctx.fill();
      cracks(ctx, s.x, s.y, 70 * easeOut(v * 4), 6, s.t0 * 99, fade * .8, 2);
    }
  }
  function drizzleO(ctx, fx, time) {
    const K = Kit(), iron = ironPuff(), cloudK = (1 - win(fx.age, fx.last, fx.last + .7)) * easeOut(fx.age / .3);
    // the iron sand cloud hanging overhead
    if (cloudK > 0) for (let i = 0; i < 13; i++) {
      const a = i / 13 * TAU + time * .4, rx = DRIZ_AREA * .85 * (.4 + hash(i) * .6);
      K.stamp(ctx, iron, fx.x + Math.cos(a) * rx, fx.y - 300 + Math.sin(a) * 50, 70 + hash(i * 3) * 40, .78 * cloudK, .6);
    }
    ctx.lineCap = 'round';
    // a constant drizzle of fine iron grains under the cloud (harmless; the marked drops hurt)
    if (cloudK > 0) {
      ctx.strokeStyle = `rgba(16,14,24,${.55 * cloudK})`; ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < 46; i++) {
        const ph = frac(time * 1.8 + hash(i * 1.7)), x = fx.x + (hash(i * 3.1) - .5) * DRIZ_AREA * 1.8 + 30 * (1 - ph), y = fx.y - 280 + ph * 360 + (hash(i * 5.3) - .5) * 160;
        ctx.moveTo(x + 6, y - 26); ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (const s of fx.spots) {
      const u = fx.age - s.t0;
      if (u < 0) continue;
      if (u < DRIZ_FALL) {
        // a bundle of three iron needles falling at a slant, a trail of grains behind
        const k = easeIn(u / DRIZ_FALL), x = lerp(s.x + 70, s.x, k), y = lerp(s.y - 440, s.y, k);
        for (let j = 0; j < 3; j++) {
          const ox = (j - 1) * 9, oy = Math.abs(j - 1) * 14;
          ctx.fillStyle = '#0c0a12'; ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + 19, y + oy - 92); ctx.lineTo(x + ox + 7, y + oy - 92); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#7a7898'; ctx.beginPath(); ctx.moveTo(x + ox + 1, y + oy - 4); ctx.lineTo(x + ox + 13, y + oy - 84); ctx.lineTo(x + ox + 10, y + oy - 84); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(20,18,28,.75)';
        for (let j = 1; j <= 4; j++) { ctx.beginPath(); ctx.arc(x + 20 + j * 6, y - 100 - j * 20, 3 - j * .4, 0, TAU); ctx.fill(); }
        continue;
      }
      const v = u - DRIZ_FALL;
      if (v < .5) {
        drawSpike(ctx, s.v, s.x, s.y, .58 * easeBack(v / .12) * (1 - win(v, .3, .5) * .5), 1 - win(v, .3, .5));
        K.fx.shockRing(ctx, s.x, s.y, 70, v / .5, 1 - v / .5, '150,150,190');
        K.fx.debris(ctx, s.x, s.y, 60, v / .5, s.t0 * 77, '#1a1822', 6);
      } else if (v < 1.2) drawSpike(ctx, s.v, s.x, s.y, .3, (1 - win(v, .5, 1.2)) * .8);
    }
  }

  function massHead(fx) { return Math.max(0, Math.min(fx.len, (fx.age - fx.t0) * ASL_SPEED)); }
  function massG(ctx, fx) {
    const d = massHead(fx), fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    if (fx.age < fx.t0) return;
    ctx.save(); ctx.translate(fx.x0, fx.y0); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(30,28,40,${.3 * fade})`; ctx.fillRect(0, -ASL_R * .7, d, ASL_R * 1.4);
    ctx.fillStyle = `rgba(14,12,20,${.3 * fade})`;
    for (let x = 30; x < d; x += 46) { ctx.beginPath(); ctx.arc(x, (hash(x + fx.seed) - .5) * ASL_R, 6 + hash(x * .3) * 8, 0, TAU); ctx.fill(); }
    ctx.restore();
    const travel = fx.len / ASL_SPEED, v = fx.age - fx.t0 - travel;
    const ex = fx.x0 + Math.cos(fx.a) * fx.len, ey = fx.y0 + Math.sin(fx.a) * fx.len;
    if (v < 0) {
      ctx.fillStyle = 'rgba(14,12,20,.32)'; ctx.beginPath(); ctx.ellipse(fx.x0 + Math.cos(fx.a) * d, fx.y0 + Math.sin(fx.a) * d, ASL_R * 1.1, ASL_R * .42, 0, 0, TAU); ctx.fill();
    } else {
      crater(ctx, ex, ey, ASL_BURST * .55, fade * .9, fx.seed, ['#3e3a46', '#16141c']);
      cracks(ctx, ex, ey, ASL_BURST * 1.2 * easeOut(v * 3), 12, fx.seed + 2, fade, 3);
    }
  }
  function massO(ctx, fx, time) {
    const K = Kit(), c = Math.cos(fx.a), s = Math.sin(fx.a), travel = fx.len / ASL_SPEED, t = fx.age - fx.t0;
    if (t < 0) return;
    if (t < travel) {
      const d = t * ASL_SPEED, gx = fx.x0 + c * d, gy = fx.y0 + s * d, r = ASL_R * (1 + .04 * Math.sin(time * 30)), cy = gy - r * 1.05;
      const iron = ironPuff();
      for (let i = 0; i < 7; i++) K.stamp(ctx, iron, gx - c * i * 36 + (hash(i + Math.floor(time * 9)) - .5) * r, gy - s * i * 36 - 20 - i * 8, r * (.36 + i * .07), .8 - i * .1, .75);
      // grains streaming off it
      ctx.fillStyle = 'rgba(16,14,22,.85)';
      for (let i = 0; i < 16; i++) {
        const ph = frac(time * 3 + hash(i)), an = hash(i * 3.3) * TAU, rr = r * (1 + ph * .8);
        ctx.beginPath(); ctx.arc(cx_(gx, c, ph, r) + Math.cos(an) * rr * .6, cy + Math.sin(an) * rr * .6 - s * ph * 40, 2 + (1 - ph) * 2, 0, TAU); ctx.fill();
      }
      const spin = time * 5 * (c >= 0 ? 1 : -1);
      ctx.save(); ctx.translate(gx, cy); ctx.rotate(spin);
      ctx.drawImage(spikeBallSpr(), -r * 1.95, -r * 1.95, r * 3.9, r * 3.9);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, gx, cy, r * 1.8, '120,110,200', .18);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const v = t - travel, ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
    // spikes bursting out of the impact, then crumbling to grains
    const n = 14;
    for (let i = 0; i < n; i++) {
      const an = i / n * TAU + fx.seed, rr = ASL_BURST * (.25 + hash(i + fx.seed) * .55), x = ex + Math.cos(an) * rr, y = ey + Math.sin(an) * rr * .55;
      const g = easeBack(win(v, i * .012, i * .012 + .16)) * (1 - win(v, 1.3, 2));
      drawSpike(ctx, i % 3, x, y, (.7 + hash(i * 3) * .5) * g, 1);
    }
    drawSpike(ctx, 1, ex, ey, 1.5 * easeBack(v / .14) * (1 - win(v, 1.3, 2)), 1);
    if (v < 1.2) {
      const iron = ironPuff();
      dustRing(ctx, ex, ey, ASL_BURST * (.4 + easeOut(v / 1.2) * .8), 16, 34 + v * 40, .9 * (1 - win(v, .5, 1.2)), fx.seed, 10 + v * 30, iron);
      K.fx.shockRing(ctx, ex, ey, ASL_BURST * 1.3, v / 1.2, 1 - v / 1.2, '150,145,200');
      if (v < .9) K.fx.debris(ctx, ex, ey, ASL_BURST, v / .9, fx.seed, '#141220', 16);
    }
  }
  const cx_ = (gx, c, ph, r) => gx - c * ph * r * 1.4;

  function armK(fx, ar) {
    const u = fx.age - ar.t0;
    return u < 0 ? 0 : u < ARM_EXT ? easeOut(u / ARM_EXT) : u < .95 ? 1 : 1 - easeIn((u - .95) / .3);
  }
  function armsG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur), pp = poisonPuff();
    for (const ar of fx.arms) {
      const e = armK(fx, ar);
      if (e <= 0) continue;
      const c = Math.cos(ar.a), s = Math.sin(ar.a), L = ar.len * e;
      ctx.strokeStyle = 'rgba(16,10,20,.22)'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x + c * 20, fx.y + s * 20); ctx.lineTo(fx.x + c * L, fx.y + s * L); ctx.stroke();
    }
    for (const i of POISON) {
      const ar = fx.arms[i];
      if (!ar || fx.age < ar.t0 + ARM_EXT) continue;
      const x = fx.x + Math.cos(ar.a) * ar.len, y = fx.y + Math.sin(ar.a) * ar.len, g = easeOut((fx.age - ar.t0 - ARM_EXT) * 3);
      ctx.fillStyle = `rgba(80,40,110,${.4 * fade})`; ctx.beginPath(); ctx.ellipse(x, y, 85 * g, 40 * g, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(150,90,200,${.3 * fade})`; ctx.beginPath(); ctx.ellipse(x - 10, y - 4, 56 * g, 24 * g, 0, 0, TAU); ctx.fill();
      for (let b = 0; b < 4; b++) {
        const ph = frac(time * 1.2 + b / 4 + ar.seed);
        Kit().stamp(ctx, pp, x + (hash(b + ar.seed) - .5) * 100, y - ph * 30, 14 + ph * 14, (1 - ph) * .8 * fade, .8);
      }
    }
  }
  function armsO(ctx, fx, time, z) {
    const rx = (z ? z.x : fx.x), ry = (z ? z.y : fx.y) - 46;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // far arms first (screen y), so the near ones overlap them
    const list = fx.arms.slice().sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
    for (const ar of list) {
      const e = armK(fx, ar);
      if (e <= .01) continue;
      const c = Math.cos(ar.a), s = Math.sin(ar.a), L = ar.len * e;
      const tx = fx.x + c * L, ty = fx.y + s * L - 20;
      const mx = lerp(rx, tx, .45) - s * ar.bend * 30, my = lerp(ry, ty, .45) - 34 * e;
      // the jointed wooden arm: dark outline, wood fill, lit edge, joints
      ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = '#a27a52'; ctx.lineWidth = 9.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,190,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, ry - 2); ctx.lineTo(mx, my - 2); ctx.lineTo(tx, ty - 2); ctx.stroke();
      for (const [jx, jy] of [[mx, my], [lerp(mx, tx, .5), lerp(my, ty, .5)]]) {
        ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(jx, jy, 5.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6a5040'; ctx.beginPath(); ctx.arc(jx, jy, 3.2, 0, TAU); ctx.fill();
      }
      // blade with poison
      const ba = Math.atan2(ty - my, tx - mx), bc = Math.cos(ba), bs = Math.sin(ba);
      ctx.fillStyle = '#121018';
      ctx.beginPath(); ctx.moveTo(tx + bc * 34, ty + bs * 34); ctx.lineTo(tx - bs * 8, ty + bc * 8); ctx.lineTo(tx + bs * 8, ty - bc * 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d8dce8';
      ctx.beginPath(); ctx.moveTo(tx + bc * 31, ty + bs * 31); ctx.lineTo(tx - bs * 5.5, ty + bc * 5.5); ctx.lineTo(tx + bs * 2, ty - bc * 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(170,90,230,.85)';
      ctx.beginPath(); ctx.arc(tx + bc * 12 + 2, ty + bs * 12 + 6 + frac(time * 2 + ar.seed) * 10, 2.6, 0, TAU); ctx.fill();
      if (e > .9 && fx.age - ar.t0 < .5) {
        ctx.globalCompositeOperation = 'lighter';
        Kit().glow(ctx, tx + bc * 26, ty + bs * 26, 34, '200,140,255', .55 * (1 - (fx.age - ar.t0) / .5));
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // the robe torn open where the arms burst out
    if (fx.age < 1.3) {
      ctx.fillStyle = 'rgba(14,10,18,.9)'; ctx.beginPath(); ctx.ellipse(rx, ry, 12, 16, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(190,140,255,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  function pullG(ctx, fx, time, z) {
    const x = fx.x, y = fx.y;
    if (fx.age < fx.T) {
      const k = fx.age / fx.T;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
      for (let i = 0; i < 5; i++) {
        const ph = frac(-fx.age * .8 + i / 5), r = 60 + ph * (PULL_R - 60);
        ctx.strokeStyle = `rgba(20,18,34,${.35 * ph})`; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(160,170,255,${.5 * ph})`; ctx.lineWidth = 2; ctx.stroke();
      }
      // grains drawn in along spirals
      ctx.fillStyle = 'rgba(16,14,24,.8)';
      for (let i = 0; i < 48; i++) {
        const ph = frac(-fx.age * .7 + hash(i * 1.7)), r = 50 + ph * PULL_R, an = hash(i * 3.9) * TAU + (1 - ph) * 2.4;
        ctx.beginPath(); ctx.arc(Math.cos(an) * r, Math.sin(an) * r, 2.5 + ph * 2.5, 0, TAU); ctx.fill();
      }
      ctx.restore();
      void k;
      return;
    }
    const v = fx.age - fx.T, fade = 1 - win(v, 1, 1.7);
    crater(ctx, x, y, PULL_RING * .5, fade * .8, fx.seed, ['#3e3a46', '#16141c']);
    cracks(ctx, x, y, PULL_RING * 1.4 * easeOut(v * 4), 12, fx.seed, fade, 3);
    void z; void time;
  }
  function pullO(ctx, fx, time) {
    const K = Kit();
    if (fx.age < fx.T) {
      const iron = ironPuff();
      for (let i = 0; i < 12; i++) {
        const ph = frac(-fx.age * .9 + i / 12), r = 70 + ph * (PULL_R - 80), an = i * 2.4 + (1 - ph) * 2;
        K.stamp(ctx, iron, fx.x + Math.cos(an) * r, fx.y + Math.sin(an) * r * .5 - 18, 20 + ph * 16, .6 * (1 - ph * .4), .7);
      }
      ctx.globalCompositeOperation = 'lighter';
      // magnetic field lines curving in from the rim to the puppet
      ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const an = i / 10 * TAU + fx.age * .6, ph = frac(fx.age * 1.4 + i * .37), r = PULL_R * (1 - ph * .85);
        const x0 = fx.x + Math.cos(an) * r, y0 = fx.y + Math.sin(an) * r * .5, x1 = fx.x + Math.cos(an + .5) * r * .35, y1 = fx.y - 40 + Math.sin(an + .5) * r * .18;
        ctx.strokeStyle = `rgba(120,140,255,${.45 * bell(ph)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(lerp(x0, x1, .5), lerp(y0, y1, .5) - 70, x1, y1); ctx.stroke();
      }
      K.glow(ctx, fx.x, fx.y - 30, 120, '130,140,255', .25 + .1 * Math.sin(time * 12));
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const v = fx.age - fx.T, n = 18;
    const items = [];
    for (let i = 0; i < n; i++) {
      const an = i / n * TAU + fx.seed, rr = PULL_RING * (.62 + hash(i + fx.seed) * .4);
      items.push([fx.x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr * .55, i]);
    }
    items.sort((p, q) => p[1] - q[1]);
    for (const [x, y, i] of items) {
      const g = easeBack(win(v, (i % 6) * .015, (i % 6) * .015 + .15)) * (1 - win(v, 1.0, 1.7));
      drawSpike(ctx, i % 3, x, y, (.85 + hash(i * 3) * .5) * g, 1);
    }
    if (v < 1.1) {
      K.fx.shockRing(ctx, fx.x, fx.y, PULL_RING * 1.5, v / 1.1, 1 - v / 1.1, '160,170,255');
      dustRing(ctx, fx.x, fx.y, PULL_RING * (.6 + easeOut(v) * .6), 14, 30 + v * 30, .85 * (1 - win(v, .4, 1.1)), fx.seed, 10 + v * 20, ironPuff());
      if (v < .8) K.fx.debris(ctx, fx.x, fx.y, PULL_RING * 1.2, v / .8, fx.seed, '#141220', 14);
    }
  }

  function spikesG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.lineCap = 'round';
    for (const l of fx.lanes) {
      const d = Math.max(0, Math.min(l.len, (fx.age - l.t0) * SPK_SPEED));
      if (d <= 0) continue;
      const c = Math.cos(l.a), s = Math.sin(l.a);
      ctx.strokeStyle = `rgba(16,14,24,${.3 * fade})`; ctx.lineWidth = 50;
      ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x0 + c * d, l.y0 + s * d); ctx.stroke();
      if (d >= l.len) cracks(ctx, l.x0 + c * l.len, l.y0 + s * l.len, SPK_END * 1.2 * easeOut((fx.age - l.t0 - l.len / SPK_SPEED) * 4), 10, l.seed, fade, 2.6);
    }
  }
  function spikesO(ctx, fx, time) {
    const K = Kit();
    for (const l of fx.lanes) {
      const c = Math.cos(l.a), s = Math.sin(l.a), up = fx.age - l.t0;
      if (up < 0) continue;
      const sink = 1 - win(fx.age, fx.dur - 1, fx.dur - .2);
      // walk from far to near when the lane points up the screen, so nearer spikes overlap
      const n = Math.floor((l.len - 60) / 64) + 1;
      for (let j = 0; j < n; j++) {
        const i = s < 0 ? j : n - 1 - j, d = 60 + i * 64, u = up - d / SPK_SPEED;
        if (u < 0) continue;
        const o = (hash(i * 1.3 + l.seed) - .5) * 40, x = l.x0 + c * d - s * o, y = l.y0 + s * d + c * o * .5;
        drawSpike(ctx, i % 3, x, y, (.55 + hash(i * 2.2 + l.seed) * .35) * easeBack(u / .14) * sink, 1);
      }
      const ue = up - l.len / SPK_SPEED;
      if (ue > 0) {
        const ex = l.x0 + c * l.len, ey = l.y0 + s * l.len;
        for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + l.seed; drawSpike(ctx, i % 3, ex + Math.cos(an) * 50, ey + Math.sin(an) * 26, 1.05 * easeBack((ue - i * .02) / .16) * sink, 1); }
        drawSpike(ctx, 2, ex, ey + 4, 1.45 * easeBack(ue / .18) * sink, 1);
        if (ue < .9) { K.fx.shockRing(ctx, ex, ey, SPK_END * 1.5, ue / .9, 1 - ue / .9, '150,145,200'); K.fx.debris(ctx, ex, ey, 120, ue / .9, l.seed, '#141220', 10); }
      }
    }
  }

  // Iron Sand World Order: tapered black needles radiating from the sphere in every direction.
  function worldG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .8, fx.dur), d = Math.min(WORLD_LEN, fx.age * WORLD_SPEED);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(14,12,22,${.28 * fade})`; ctx.lineWidth = 34;
    ctx.beginPath();
    for (const l of fx.lanes) { ctx.moveTo(fx.x + Math.cos(l.a) * 60, fx.y + Math.sin(l.a) * 60); ctx.lineTo(fx.x + Math.cos(l.a) * d, fx.y + Math.sin(l.a) * d); }
    ctx.stroke();
    crater(ctx, fx.x, fx.y, WORLD_CORE * .6, fade * .9, fx.seed, ['#3e3a46', '#16141c']);
    cracks(ctx, fx.x, fx.y, WORLD_CORE * 1.5 * easeOut(fx.age * 3), 14, fx.seed, fade, 3);
  }
  function worldO(ctx, fx, time) {
    const K = Kit(), cx = fx.x, cy = fx.y - WORLD_H, d = Math.min(WORLD_LEN, fx.age * WORLD_SPEED);
    const crumble = win(fx.age, fx.dur - 1.1, fx.dur - .2), alive = 1 - crumble;
    // needles behind the sphere (pointing up the screen) first, the rest after it
    const draw = back => {
      for (const l of fx.lanes) {
        const s = Math.sin(l.a);
        if ((s < 0) !== back) continue;
        const c = Math.cos(l.a), L = d * (1 - crumble * .4);
        const tx = fx.x + c * L, ty = fx.y + s * L - 14, bx = cx + c * 40, by = cy + s * 26;
        const nx = -(ty - by), ny = tx - bx, nl = Math.hypot(nx, ny) || 1, w = 15;
        const px = nx / nl * w, py = ny / nl * w;
        ctx.globalAlpha = alive;
        ctx.fillStyle = '#0a0810';
        ctx.beginPath(); ctx.moveTo(bx + px * 1.25, by + py * 1.25); ctx.lineTo(tx, ty); ctx.lineTo(bx - px * 1.25, by - py * 1.25); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a3848';
        ctx.beginPath(); ctx.moveTo(bx + px, by + py); ctx.lineTo(tx, ty); ctx.lineTo(bx - px, by - py); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#76749a';
        ctx.beginPath(); ctx.moveTo(bx + px * .9, by + py * .9); ctx.lineTo(tx, ty); ctx.lineTo(bx + px * .15, by + py * .15); ctx.closePath(); ctx.fill();
        // side thorns branching off the needle
        for (const k of [.35, .6, .82]) {
          if (L < 200) break;
          const qx = lerp(bx, tx, k), qy = lerp(by, ty, k), side = hash(l.seed + k * 9) > .5 ? 1 : -1, len = 46 * (1 - k * .5);
          const ex = qx + px / w * len * side + (tx - bx) / nl * len * .2, ey = qy + py / w * len * side + (ty - by) / nl * len * .2;
          ctx.fillStyle = '#0a0810'; ctx.beginPath(); ctx.moveTo(qx - (tx - bx) / nl * 9, qy - (ty - by) / nl * 9); ctx.lineTo(ex, ey); ctx.lineTo(qx + (tx - bx) / nl * 9, qy + (ty - by) / nl * 9); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#4c4a60'; ctx.beginPath(); ctx.moveTo(qx - (tx - bx) / nl * 6, qy - (ty - by) / nl * 6); ctx.lineTo(ex, ey); ctx.lineTo(qx, qy); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (d >= WORLD_LEN) drawSpike(ctx, l.seed % 3 | 0, fx.x + c * WORLD_LEN, fx.y + s * WORLD_LEN, .8 * alive, 1);
      }
    };
    draw(true);
    // the core sphere, cracking and crumbling once the spikes are spent
    const R = 104 * (1 + .06 * Math.sin(time * 20)) * (1 - crumble * .5);
    ctx.globalAlpha = alive;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * .8); ctx.drawImage(spikeBallSpr(), -R * 1.95, -R * 1.95, R * 3.9, R * 3.9); ctx.restore();
    ctx.globalAlpha = 1;
    draw(false);
    if (fx.age < .5) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx, cy, 260 * easeOut(fx.age * 4), '170,165,255', .55 * (1 - fx.age / .5), true);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fx.age < 1.2) {
      K.fx.shockRing(ctx, fx.x, fx.y, WORLD_LEN * .9, fx.age / 1.2, 1 - fx.age / 1.2, '170,165,220');
      K.fx.shockRing(ctx, fx.x, fx.y, WORLD_CORE * 1.4, fx.age / .8, 1 - fx.age / .8, '255,255,255');
      dustRing(ctx, fx.x, fx.y, WORLD_CORE * (.6 + easeOut(fx.age) * .8), 18, 36 + fx.age * 40, .8 * (1 - win(fx.age, .4, 1.2)), fx.seed, 10 + fx.age * 24, ironPuff());
    }
    if (crumble > 0) {
      const iron = ironPuff();
      for (let i = 0; i < 8; i++) K.stamp(ctx, iron, cx + (hash(i + fx.seed) - .5) * 160, cy + crumble * 120 + i * 6, 30 + crumble * 30, .6 * (1 - crumble), .8);
    }
  }

  // ------------------------------------------------------------------ Rasa effects
  function gwaveFront(fx) { return 60 + fx.age * GW_SPEED; }
  function gwaveG(ctx, fx) {
    const r = Math.min(GW_LEN, gwaveFront(fx)), fade = 1 - win(fx.age, fx.dur - .9, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(214,168,60,${.3 * fade})`;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -GW_HALF, GW_HALF); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(140,96,20,${.4 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) { const rr = r * i / 8; ctx.moveTo(Math.cos(-GW_HALF * .9) * rr, Math.sin(-GW_HALF * .9) * rr); ctx.arc(0, 0, rr, -GW_HALF * .9, GW_HALF * .9); }
    ctx.stroke();
    ctx.restore();
  }
  function gwaveO(ctx, fx, time) {
    const K = Kit(), r = gwaveFront(fx);
    if (r > GW_LEN + 120) return;
    const k = 1 - win(r, GW_LEN - 80, GW_LEN + 120), m = ctx.getTransform(), gp = goldPuff();
    const pts = [];
    for (let i = 0; i < 15; i++) {
      const aa = fx.a + (i / 14 - .5) * GW_HALF * 2;
      pts.push([fx.x + Math.cos(aa) * r, fx.y + Math.sin(aa) * r, aa, i, 1]);
      if (i < 14 && r > 140) { const ab = aa + GW_HALF / 14, rb = r - 75; pts.push([fx.x + Math.cos(ab) * rb, fx.y + Math.sin(ab) * rb, ab, i + 30, .6]); }
    }
    pts.sort((p, q) => p[1] - q[1]);
    for (const [x, y, aa, i, hk] of pts) {
      K.stamp(ctx, gp, x - Math.cos(aa) * 30, y - Math.sin(aa) * 30 - 18, 34 * hk, .75 * k, .7);
      tongue(ctx, m, GOLDF, 'ekG', x, y + 4, (120 + hash(i + fx.seed) * 80) * hk * (.9 + .1 * Math.sin(time * 9 + i)) * k, Math.cos(aa) * .45, i, .95);
      ctx.setTransform(m);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const aa = fx.a + (hash(i * 3.1 + Math.floor(time * 8)) - .5) * GW_HALF * 2, rr = r - hash(i * 5.3) * 90;
      ctx.fillStyle = 'rgba(255,250,210,.9)'; ctx.fillRect(fx.x + Math.cos(aa) * rr, fx.y + Math.sin(aa) * rr - 30 - hash(i) * 80, 2.4, 2.4);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function spearAt(ctx, x, y, ang, scale, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(ang);
    ctx.drawImage(spearSpr(), -75 * scale, -15 * scale, 150 * scale, 30 * scale);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function spearsG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const sp of fx.spears) {
      if (sp.t0 < 0) continue;
      const u = fx.age - sp.t0, ox = fx.x + sp.dx, oy = fx.y;
      if (u < 0) { markLine(ctx, ox, oy, sp.a, SP_LEN, 24, true, '255,222,120', 1 + u / SP_FLASH, time); continue; }
      const d = Math.min(SP_LEN, u * SP_SPEED), c = Math.cos(sp.a), s = Math.sin(sp.a);
      ctx.strokeStyle = `rgba(150,104,24,${.25 * fade})`; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + c * d, oy + s * d); ctx.stroke();
      if (u * SP_SPEED > SP_LEN) cracks(ctx, ox + c * SP_LEN, oy + s * SP_LEN, 50, 6, sp.dx + 9, fade, 2);
    }
  }
  function spearsO(ctx, fx, time, z) {
    const K = Kit(), gp = goldPuff(), bx = z ? z.x : fx.x, by = z ? z.y : fx.y;
    for (const sp of fx.spears) {
      const u = sp.t0 < 0 ? -1 : fx.age - sp.t0;
      const hoverA = sp.t0 < 0 ? fx.a : sp.a;
      if (u < 0) {
        // floating round him, pointing where it will fly, gold dust trickling off
        const x = bx + sp.dx, y = by - sp.h + Math.sin(time * 4 + sp.dx) * 4, g = easeOut(fx.age / .2);
        spearAt(ctx, x, y, Math.atan2(Math.sin(hoverA) * .6, Math.cos(hoverA)), 1.05 * g, 1);
        K.stamp(ctx, gp, x, y + 12, 12, .5, .8);
        continue;
      }
      const ox = fx.x + sp.dx, oy = fx.y, c = Math.cos(sp.a), s = Math.sin(sp.a);
      if (u * SP_SPEED <= SP_LEN) {
        const d = u * SP_SPEED, h = sp.h * (1 - d / SP_LEN * .75) + 18, x = ox + c * d, y = oy + s * d - h;
        const ang = Math.atan2(s - sp.h * .75 / SP_LEN, c);
        for (let i = 1; i <= 4; i++) K.stamp(ctx, gp, x - c * i * 26, y - s * i * 26 + i * 3, 12 - i, .5 - i * .1, .8);
        spearAt(ctx, x, y, ang, 1.4, 1);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x + c * 50, y + s * 30, 30, '255,230,140', .4);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const v = (u * SP_SPEED - SP_LEN) / SP_SPEED, ex = ox + c * SP_LEN, ey = oy + s * SP_LEN, a2 = 1 - win(v, .6, 1.3);
        if (a2 <= 0) continue;
        // stuck in the ground, tilted
        spearAt(ctx, ex - c * 40, ey - 34, Math.atan2(.9, c * .5), 1.2, a2);
        if (v < .4) dustRing(ctx, ex, ey, 40, 6, 14, 1 - v / .4, sp.dx, 6, gp);
      }
    }
  }

  // Gold Pyramid Seal: four walls rise round the target and fold shut like petals.
  function pyrGeom(fx) {
    const x = fx.x, y = fx.y, rx = PYR_R * 1.05, ry = rx * .5, H = PYR_R * 1.35;
    return { F: [x, y + ry], Rt: [x + rx, y], B: [x, y - ry], L: [x - rx, y], A: [x, y - H], cx: x, cy: y, H, rx, ry };
  }
  function pyrG(ctx, fx, time) {
    const g = pyrGeom(fx), close = fx.age >= PYR_CLOSE, fade = 1 - win(fx.age, fx.dur - .9, fx.dur);
    ctx.fillStyle = `rgba(160,110,20,${(close ? .45 : .25) * fade})`;
    ctx.beginPath(); ctx.moveTo(...g.F); ctx.lineTo(...g.Rt); ctx.lineTo(...g.B); ctx.lineTo(...g.L); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(90,60,10,${.6 * fade})`; ctx.lineWidth = 3; ctx.stroke();
    if (close) cracks(ctx, fx.x, fx.y, PYR_R * 1.5 * easeOut((fx.age - PYR_CLOSE) * 4), 12, fx.seed, fade, 3);
    void time;
  }
  function pyrFace(ctx, p0, p1, tip, col, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(tip[0], tip[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(110,70,10,.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let t = .2; t < 1; t += .2) { ctx.moveTo(lerp(p0[0], tip[0], t), lerp(p0[1], tip[1], t)); ctx.lineTo(lerp(p1[0], tip[0], t), lerp(p1[1], tip[1], t)); }
    ctx.stroke();
    ctx.strokeStyle = '#4a3006'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(tip[0], tip[1]); ctx.closePath(); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function pyrO(ctx, fx, time) {
    const K = Kit(), g = pyrGeom(fx), e = easeIn(fx.age / PYR_CLOSE), gp = goldPuff();
    const crumble = win(fx.age, PYR_CLOSE + PYR_HOLD, fx.dur - .2), alpha = 1 - crumble;
    if (alpha <= 0) return;
    const sink = crumble * g.H * .5;
    const tipOf = (p0, p1) => {
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, ox = (mx - g.cx) * 1.1, oy = (my - g.cy) * 1.1;
      return [lerp(mx + ox, g.A[0], e), lerp(my + oy - g.H * .42, g.A[1] + sink, e)];
    };
    const rise = easeOut(fx.age / .25);
    const sq = (p) => [p[0], lerp(g.cy, p[1], 1)];
    // back walls (only seen while open), then the front two
    if (e < .98) { pyrFace(ctx, sq(g.L), sq(g.B), tipOf(g.L, g.B), '#8a6420', alpha * rise); pyrFace(ctx, sq(g.B), sq(g.Rt), tipOf(g.B, g.Rt), '#7a5618', alpha * rise); }
    pyrFace(ctx, sq(g.Rt), sq(g.F), tipOf(g.Rt, g.F), '#b8862a', alpha * rise);
    pyrFace(ctx, sq(g.F), sq(g.L), tipOf(g.F, g.L), '#eec254', alpha * rise);
    // gold dust trickling down the faces and glinting
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const t = frac(time * .8 + hash(i)), side = i % 2 ? g.L : g.Rt, tip = tipOf(g.F, side);
      const x = lerp(tip[0], lerp(g.F[0], side[0], hash(i * 3)), t), y = lerp(tip[1], lerp(g.F[1], side[1], hash(i * 3)), t);
      ctx.fillStyle = `rgba(255,246,200,${.8 * alpha * bell(t)})`; ctx.fillRect(x, y, 2.6, 2.6);
    }
    ctx.globalCompositeOperation = 'source-over';
    const v = fx.age - PYR_CLOSE;
    if (v > 0 && v < 1.1) {
      K.fx.shockRing(ctx, fx.x, fx.y, PYR_R * 1.5, v / 1.1, 1 - v / 1.1, '255,214,100');
      dustRing(ctx, fx.x, fx.y, PYR_R * (.9 + easeOut(v) * .5), 16, 30 + v * 30, .9 * (1 - win(v, .4, 1.1)), fx.seed, 6 + v * 20, gp);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, g.A[0], g.A[1], 120, '255,236,160', .7 * (1 - v / 1.1), true);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (crumble > 0) for (let i = 0; i < 8; i++) K.stamp(ctx, gp, fx.x + (hash(i + fx.seed) - .5) * PYR_R * 1.6, fx.y - g.H * .4 * (1 - crumble) + i * 4, 40 + crumble * 30, .7 * alpha, .7);
  }

  function shieldG(ctx, fx, time, z) {
    const x = z ? z.x : fx.x, y = z ? z.y : fx.y;
    if (fx.age < fx.T) {
      const k = fx.age / fx.T;
      markCircle(ctx, x, y, SH_R, '255,226,140', k, time, k < .6, false);
      if (k > .55) for (const aa of fx.shards) markLine(ctx, x + Math.cos(aa) * 70, y + Math.sin(aa) * 70, aa, SH_LEN - 70, 20, true, '255,226,140', (k - .55) / .45, time);
      shieldWall(ctx, fx, x, y, time, true);
      return;
    }
    const v = fx.age - fx.T, fade = 1 - win(v, .7, 1.4);
    cracks(ctx, fx.bx, fx.by, SH_R * easeOut(v * 3), 12, fx.seed, fade, 2.6);
  }
  // A ring of gold dust walls whirling round him; back half on the ground layer, front half above.
  function shieldWall(ctx, fx, x, y, time, back) {
    const m = ctx.getTransform(), n = 14, k = easeOut(fx.age / .3) * (1 - win(fx.age, fx.T - .15, fx.T));
    if (k <= 0) return;
    for (let j = 0; j < n; j++) {
      const i = back ? j : n - 1 - j, an = i / n * TAU + time * 2.6, s = Math.sin(an);
      if ((s < 0) !== back) continue;
      tongue(ctx, m, GOLDF, 'ekG', x + Math.cos(an) * 66, y + s * 33, (96 + hash(i) * 30) * k * (.9 + .1 * Math.sin(time * 10 + i)), -Math.cos(an) * .25, i, .9);
      ctx.setTransform(m);
    }
    ctx.globalAlpha = 1;
  }
  function shieldO(ctx, fx, time, z) {
    const K = Kit();
    if (fx.age < fx.T) {
      if (!z) return;
      shieldWall(ctx, fx, z.x, z.y, time, false);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, z.y - 50, 90, '255,220,120', .22);
      if (z.hitFlash > 0) K.glow(ctx, z.x, z.y - 50, 70, '255,246,200', .8, true);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const v = fx.age - fx.T, gp = goldPuff();
    for (const aa of fx.shards) {
      const d = Math.min(SH_LEN, 70 + v * 1500), c = Math.cos(aa), s = Math.sin(aa), a2 = 1 - win(v, .5, 1.1);
      if (a2 <= 0) continue;
      spearAt(ctx, fx.bx + c * d, fx.by + s * d - 40 + v * 30, Math.atan2(s * .6, c), .55, a2);
      if (d < SH_LEN) K.stamp(ctx, gp, fx.bx + c * (d - 40), fx.by + s * (d - 40) - 36, 14, .6 * a2, .8);
    }
    if (v < 1) {
      K.fx.shockRing(ctx, fx.bx, fx.by, SH_R * 1.3, v, 1 - v, '255,214,100');
      dustRing(ctx, fx.bx, fx.by, 90 + easeOut(v) * 150, 14, 30 + v * 30, .9 * (1 - v), fx.seed, 10 + v * 20, gp);
    }
  }

  function gblockG(ctx, fx, time) {
    if (fx.age < fx.T) {
      const k = fx.age / fx.T;
      markCircle(ctx, fx.x, fx.y, HAM_R, '255,206,90', k, time, false, false);
      ctx.fillStyle = `rgba(30,20,6,${.15 + .3 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, HAM_R * .7 * k, HAM_R * .32 * k, 0, 0, TAU); ctx.fill();
      return;
    }
    const v = fx.age - fx.T, fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    crater(ctx, fx.x, fx.y, HAM_R * .7, fade, fx.seed);
    ctx.fillStyle = `rgba(214,168,60,${.45 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, HAM_R * .8, HAM_R * .38, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, HAM_R * 1.5 * easeOut(v * 4), 10, fx.seed + 3, fade, 2.6);
  }
  function gblockO(ctx, fx, time) {
    const K = Kit(), gp = goldPuff(), img = goldBlockSpr();
    if (fx.age < fx.T) {
      const k = easeIn(fx.age / fx.T), y = lerp(fx.y - 640, fx.y - 60, k), s = .75 + .45 * k;
      for (let i = 1; i <= 5; i++) K.stamp(ctx, gp, fx.x + (hash(i + fx.seed) - .5) * 80, y - 60 - i * 34, 26 - i * 3, .5, .8);
      ctx.save(); ctx.translate(fx.x, y); ctx.rotate(fx.rot); ctx.drawImage(img, -100 * s, -92 * s, 200 * s, 170 * s); ctx.restore();
      return;
    }
    const v = fx.age - fx.T, m = ctx.getTransform();
    if (v < .7) {
      const a2 = 1 - win(v, .25, .7);
      ctx.save(); ctx.globalAlpha = a2; ctx.translate(fx.x, fx.y - 50 + v * 70); ctx.rotate(fx.rot); ctx.scale(1.25, 1.2 * (1 - v * .5)); ctx.drawImage(img, -100, -92, 200, 170); ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (v < .9) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const an = i / n * TAU + fx.seed, x = fx.x + Math.cos(an) * HAM_R * .75, y = fx.y + Math.sin(an) * HAM_R * .38;
        tongue(ctx, m, GOLDF, 'ekG', x, y, (120 + hash(i) * 60) * bell(v / .9), -Math.cos(an) * .7, i, .95);
        ctx.setTransform(m);
      }
      ctx.globalAlpha = 1;
      K.fx.shockRing(ctx, fx.x, fx.y, HAM_R * 1.6, v / .9, 1 - v / .9, '255,214,100');
      K.fx.debris(ctx, fx.x, fx.y, HAM_R * 1.2, v / .9, fx.seed, '#8a6014', 12);
    }
    if (v < 1.5) dustRing(ctx, fx.x, fx.y, HAM_R * (.6 + easeOut(v / 1.5) * .6), 14, 30 + v * 30, .9 * (1 - win(v, .5, 1.5)), fx.seed, 8 + v * 20, gp);
  }

  function tsuFront(fx) { return Math.min(TSU_LEN, fx.age * TSU_SPEED); }
  function tsuG(ctx, fx, time) {
    const d = tsuFront(fx), fade = 1 - win(fx.age, fx.dur - 1, fx.dur);
    ctx.save(); ctx.translate(fx.x0, fx.y0); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(214,168,60,${.52 * fade})`; ctx.fillRect(0, -TSU_W, d, TSU_W * 2);
    ctx.fillStyle = `rgba(150,104,24,${.25 * fade})`; ctx.fillRect(0, -TSU_W, d, TSU_W * .25); ctx.fillRect(0, TSU_W * .75, d, TSU_W * .25);
    ctx.strokeStyle = `rgba(110,72,14,${.4 * fade})`; ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const x = d - ((time * 120 + i * 140) % Math.max(140, d)); if (x < 0) continue; ctx.moveTo(x, -TSU_W * .95); ctx.quadraticCurveTo(x - 40, 0, x, TSU_W * .95); }
    ctx.stroke();
    ctx.restore();
    if (fx.age * TSU_SPEED > TSU_LEN) {
      const c = Math.cos(fx.a), s = Math.sin(fx.a), ex = fx.x0 + c * TSU_LEN, ey = fx.y0 + s * TSU_LEN, v = fx.age - TSU_LEN / TSU_SPEED;
      for (const k of [-1.9, 0, 1.9]) cracks(ctx, ex - s * k * TSU_W / 3.2, ey + c * k * TSU_W / 3.2, 260 * easeOut(v * 3), 10, fx.seed + k, fade, 3);
    }
  }
  function tsuO(ctx, fx, time) {
    const K = Kit(), c = Math.cos(fx.a), s = Math.sin(fx.a), gp = goldPuff(), m = ctx.getTransform();
    const d = tsuFront(fx), v = fx.age - TSU_LEN / TSU_SPEED, grow = easeOut(fx.age / .35);
    const wall = v < 0 ? 1 : 1 - win(v, 0, .5);
    if (wall > 0) {
      const cx = fx.x0 + c * d, cy = fx.y0 + s * d, n = 17;
      // the body of the wave: two lower rows trailing behind the crest, then the crest itself
      for (const [back, hk, row] of [[170, .5, 2], [85, .75, 1], [0, 1, 0]]) {
        const pts = [];
        for (let i = 0; i < n - row; i++) {
          const o = ((i + row * .5) / (n - 1) - .5) * 2 * TSU_W * .96;
          pts.push([cx - s * o - c * back, cy + c * o - s * back, i + row * 20]);
        }
        pts.sort((p, q) => p[1] - q[1]);
        for (const [x, y, i] of pts) {
          const h = (210 + hash(i + fx.seed) * 90) * hk * grow * wall * (.9 + .1 * Math.sin(time * 8 + i));
          K.stamp(ctx, gp, x - c * 50, y - s * 50 - 30, 56 * (row ? .8 : 1), .7 * wall, .7);
          tongue(ctx, m, GOLDF, 'ekG', x, y + 6, h, c * .55, i, .97);
          ctx.setTransform(m);
          ctx.globalAlpha = 1;
          if (!row) K.stamp(ctx, gp, x + c * 10, y - h * .78, 30 + hash(i) * 14, .85 * wall, .8);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const o = (hash(i * 3.3 + Math.floor(time * 7)) - .5) * 2 * TSU_W, hh = hash(i * 1.9) * 220;
        ctx.fillStyle = 'rgba(255,250,210,.9)'; ctx.fillRect(cx - s * o, cy + c * o - hh, 2.6, 2.6);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (v > 0 && v < 1.6) {
      const ex = fx.x0 + c * TSU_LEN, ey = fx.y0 + s * TSU_LEN;
      for (const k of [-1.9, 0, 1.9]) {
        const x = ex - s * k * TSU_W / 3.2, y = ey + c * k * TSU_W / 3.2;
        K.fx.shockRing(ctx, x, y, 300, v / 1.2, 1 - win(v, 0, 1.2), '255,214,100');
        dustRing(ctx, x, y, 240 * (.4 + easeOut(v / 1.6) * .8), 14, 40 + v * 40, .9 * (1 - win(v, .6, 1.6)), fx.seed + k, 10 + v * 40, gp);
        if (v < .9) K.fx.debris(ctx, x, y, 240, v / .9, fx.seed + k, '#8a6014', 12);
      }
    }
  }

  const FX = {
    tline: [tlineG, null], kokuton: [kokutonG, kokutonO], stab: [stabG, stabO], rtrail: [rtrailG, rtrailO], flare: [null, flareO],
    body: [bodyG, bodyO], quake: [quakeG, quakeO], pierce: [pierceG, pierceO], regen: [null, regenO],
    drizzle: [drizzleG, drizzleO], mass: [massG, massO], arms: [armsG, armsO], pull: [pullG, pullO], spikes: [spikesG, spikesO], world: [worldG, worldO],
    gwave: [gwaveG, gwaveO], spears: [spearsG, spearsO], pyr: [pyrG, pyrO], shield: [shieldG, shieldO], gblock: [gblockG, gblockO], tsu: [tsuG, tsuO]
  };

  // ------------------------------------------------------------------ windup visuals
  function handPos(z, st) {
    const H = HEIGHT(z.bossId), f = Math.cos(st.aim) >= 0 ? 1 : -1;
    return { x: z.x + f * 16, y: z.y - bodyLift(z) - H * .5, f };
  }
  function windupG(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k);
    switch (st.move) {
      case 'quake': case 'rush':
        dustRing(ctx, z.x, z.y, 40 + 20 * e, 8, 14 + 8 * e, .6 * k, 3, 4);
        break;
      case 'drizzle': case 'spikes': case 'pull': case 'assault': case 'world': {
        ctx.fillStyle = `rgba(16,14,24,${.3 * e})`; ctx.beginPath(); ctx.ellipse(z.x, z.y, 80 + 60 * e, 34 + 26 * e, 0, 0, TAU); ctx.fill();
        if (st.move === 'drizzle') { ctx.fillStyle = `rgba(16,14,24,${.18 * e})`; ctx.beginPath(); ctx.ellipse(st.tx, st.ty, DRIZ_AREA * e, DRIZ_AREA * .45 * e, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'pyramid': {
        const g = pyrGeom({ x: st.tx, y: st.ty });
        ctx.strokeStyle = `rgba(150,100,20,${.4 + .4 * k})`; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.moveTo(...g.F); ctx.lineTo(...g.Rt); ctx.lineTo(...g.B); ctx.lineTo(...g.L); ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
        K.fx.groundGlow(ctx, st.tx, st.ty, PYR_R, '255,214,100', .3 * k);
        break;
      }
      case 'goldwave': case 'shield': case 'spears': case 'hammer': case 'tsunami':
        ctx.fillStyle = `rgba(214,168,60,${.28 * e})`; ctx.beginPath(); ctx.ellipse(z.x, z.y, 70 + 50 * e, 30 + 22 * e, 0, 0, TAU); ctx.fill();
        if (st.move === 'hammer' && st.plan) markCircle(ctx, st.plan.x, st.plan.y, HAM_R, '255,206,90', k * .5, time, true, false);
        if (st.move === 'tsunami' && st.plan) {
          const c = Math.cos(st.plan.a), s = Math.sin(st.plan.a);
          ctx.save(); ctx.translate(st.plan.x0, st.plan.y0); ctx.rotate(st.plan.a);
          ctx.fillStyle = `rgba(214,168,60,${.35 * e})`; ctx.fillRect(-60, -TSU_W, 120 * e, TSU_W * 2);
          ctx.restore();
          void c; void s;
        }
        break;
    }
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), hp = handPos(z, st), H = HEIGHT(z.bossId), lift = bodyLift(z);
    switch (st.move) {
      case 'kokuton': {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const an = time * 7 + i * 1.6, r = 30 + 26 * e;
          bolt(ctx, hp.x, hp.y, hp.x + Math.cos(an) * r, hp.y + Math.sin(an) * r * .8, i * 9 + 3, time, 1.6, .5 + .5 * k, BOLT_K, { base: 'rgba(6,2,14,.9)', forks: 1, jitter: 8 });
        }
        K.glow(ctx, hp.x, hp.y, 40 + 40 * e, '150,110,255', .4);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'nukite4': case 'nukite1': {
        const big = st.move === 'nukite1', fx = hp.x + Math.cos(st.aim) * 14, fy = hp.y + Math.sin(st.aim) * 8;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx, fy, (big ? 60 + 90 * e : 40 + 40 * e), '255,230,120', .5 + .3 * k, true);
        if (big) {
          // chakra drawn in to a single fingertip: converging arcs and a needle of light
          for (let i = 0; i < 7; i++) {
            const an = i * TAU / 7 + time * 2, r = 160 * (1 - frac(time * 1.5 + i / 7)) + 20;
            bolt(ctx, fx + Math.cos(an) * r, fy + Math.sin(an) * r * .7, fx, fy, i * 7 + 1, time, 1.4, .7 * k, i % 2 ? BOLT_B : BOLT_Y, { forks: 0, jitter: 10 });
          }
          const L = 30 + 50 * e;
          ctx.strokeStyle = `rgba(255,255,240,${.9})`; ctx.lineWidth = 3 + 3 * e; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(st.aim) * L, fy + Math.sin(st.aim) * L * .6); ctx.stroke();
        } else {
          for (let i = 0; i < 4; i++) bolt(ctx, fx, fy, fx + Math.cos(st.aim + (i - 1.5) * .3) * 50 * e, fy + Math.sin(st.aim + (i - 1.5) * .3) * 30 * e, i * 5, time, 1.4, .8, BOLT_Y, { forks: 0, jitter: 6 });
        }
        ctx.globalCompositeOperation = 'source-over';
        if (big) armorAura(ctx, z, st, time, k);
        break;
      }
      case 'rush': case 'body': case 'quake':
        armorAura(ctx, z, st, time, .4 + .6 * k);
        break;
      case 'drizzle': case 'spikes': case 'pull': {
        const iron = ironPuff();
        for (let i = 0; i < 8; i++) {
          const ph = frac(time * 1.3 + i / 8), an = i * .8 + time;
          K.stamp(ctx, iron, z.x + Math.cos(an) * (70 - 40 * ph), z.y + Math.sin(an) * 30 - ph * (st.move === 'drizzle' ? 220 : 60), 14 + 10 * (1 - ph), .7 * (1 - ph), .7);
        }
        if (st.move === 'drizzle') for (let i = 0; i < 9; i++) K.stamp(ctx, iron, st.tx + Math.cos(i * .7 + time * .4) * DRIZ_AREA * .7 * e, st.ty - 380 + Math.sin(i * 1.9) * 30, 50 + 30 * e, .6 * e, .6);
        break;
      }
      case 'assault': case 'world': {
        const big = st.move === 'world', cx = z.x, cy = big ? z.y - WORLD_H : z.y - lift - H - 50;
        const R = (big ? 104 : ASL_R) * (.25 + .75 * e);
        // streams of iron sand rising into the forming mass
        ctx.strokeStyle = 'rgba(16,14,24,.75)'; ctx.lineCap = 'round';
        for (let i = 0; i < (big ? 14 : 8); i++) {
          const an = i / (big ? 14 : 8) * TAU + time * .5, gx = z.x + Math.cos(an) * (big ? 260 : 150), gy = z.y + Math.sin(an) * (big ? 130 : 70);
          ctx.lineWidth = 6 + 4 * k;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(lerp(gx, cx, .5) + Math.sin(time * 3 + i) * 30, lerp(gy, cy, .5) - 30, cx, cy); ctx.stroke();
          const ph = frac(time * 1.6 + i / 7);
          ctx.fillStyle = 'rgba(120,118,150,.9)'; ctx.beginPath(); ctx.arc(lerp(gx, cx, ph), lerp(gy, cy, ph) - bell(ph) * 30, 3, 0, TAU); ctx.fill();
        }
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 3); ctx.drawImage(spikeBallSpr(), -R * 1.95, -R * 1.95, R * 3.9, R * 3.9); ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, cx, cy, R * 2, '140,130,230', .25 + .15 * k);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'arms':
        ctx.strokeStyle = `rgba(190,140,255,${.4 + .4 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(z.x - 8, z.y - lift - H * .6); ctx.lineTo(z.x + 2, z.y - lift - H * .3); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, z.y - lift - H * .45, 40 + 30 * e, '190,140,255', .4); ctx.globalCompositeOperation = 'source-over';
        break;
      case 'goldwave': case 'shield': case 'spears': case 'pyramid': case 'hammer': {
        const gp = goldPuff();
        for (let i = 0; i < 10; i++) {
          const an = time * 2.4 + i * TAU / 10, r = 60 + 20 * Math.sin(time * 3 + i);
          K.stamp(ctx, gp, z.x + Math.cos(an) * r, z.y + Math.sin(an) * r * .5 - 20 - (i % 3) * 16, 14 + 8 * e, .7, .75);
        }
        if (st.move === 'hammer') {
          const y = z.y - lift - H - 70 - 30 * e, s = .3 + .4 * e;
          ctx.save(); ctx.translate(z.x, y); ctx.rotate(time); ctx.drawImage(goldBlockSpr(), -100 * s, -92 * s, 200 * s, 170 * s); ctx.restore();
        }
        if (st.move === 'spears') for (let i = 0; i < SP_N; i++) {
          const o = i - (SP_N - 1) / 2, x = z.x + o * 34, y = z.y - (112 - Math.abs(o) * 13) - 20 * (1 - e);
          spearAt(ctx, x, y, Math.atan2(Math.sin(st.aim) * .6, Math.cos(st.aim)), .8 * e, e);
        }
        if (st.move === 'pyramid') {
          ctx.strokeStyle = `rgba(255,214,100,${.6 * k})`; ctx.lineWidth = 3; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -time * 80;
          ctx.beginPath(); ctx.moveTo(z.x, z.y - 40); ctx.quadraticCurveTo((z.x + st.tx) / 2, Math.min(z.y, st.ty) - 200, st.tx, st.ty - 40); ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case 'tsunami': {
        if (!st.plan) break;
        const c = Math.cos(st.plan.a), s = Math.sin(st.plan.a), m = ctx.getTransform(), n = 13;
        for (let i = 0; i < n; i++) {
          const o = (i / (n - 1) - .5) * 2 * TSU_W * .9, x = st.plan.x0 - s * o, y = st.plan.y0 + c * o;
          tongue(ctx, m, GOLDF, 'ekG', x, y, (60 + 160 * e) * (.85 + .15 * Math.sin(time * 6 + i)), 0, i, .9);
          ctx.setTransform(m);
        }
        ctx.globalAlpha = 1;
        break;
      }
    }
  }

  function label(ctx, z, st, m) {
    let move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (st.regen && st.regen.t < 1.6) move = 'regen';
    if (!move || !MOVES[move]) return;
    const top = z.y - bodyLift(z) - HEIGHT(z.bossId) - 32;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#10121a'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = move === 'regen' ? '#f2ead8' : m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.armor = 0; st.guard = 0; st.regen = null;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
    st.ghosts.length = 0;
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.ek;
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
        const x = s.follow ? z.x : s.x, y = s.follow ? z.y : s.y;
        if (s.k === 'c') markCircle(ctx, x, y, s.r, rgb, k, time, s.faint, s.small, s.inward);
        else if (s.k === 'line') markLine(ctx, x, y, s.a, s.len, s.w, s.faint, rgb, k, time);
        else if (s.k === 'cone') markCone(ctx, x, y, s.a, s.len, s.half, s.inward, rgb, k, time);
      }
      windupG(ctx, z, st, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.ek;
    if (!m || !st || !Kit()) return;
    ctx.save();
    const alive = z.health > 0;
    if (alive && z.bossId === 'kazekage3') chakraThreads(ctx, z, time);
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, alive ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    const S = Spr();
    if (S && st.ghosts.length) {
      for (const g of st.ghosts) S.draw(ctx, z.bossId, g.x, g.y + 3, { facing: g.f, frame: 'attack', alpha: .38 * (1 - g.age / .32) });
      ctx.globalAlpha = 1;
    }
    if (alive) {
      if (z.bossId === 'raikage3' && st.armor > 0 && !(st.windup > 0 && (st.move === 'rush' || st.move === 'body' || st.move === 'quake' || st.move === 'nukite1'))) armorAura(ctx, z, st, time, Math.min(1, st.armor * 2) * (st.guard > 0 ? 1 : .8));
      if (st.windup > 0 && st.move) {
        windupO(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  window.EdoKageBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, bodyLift };
})();
