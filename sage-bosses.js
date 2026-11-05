(() => {
  'use strict';

  // Lục Đạo · Khởi Nguyên (spawn panel, faction 'rikudo'): Ōtsutsuki Hagoromo (Sage of Six Paths),
  // his brother Hamura and his younger son Ashura. Same contract as uchiha-bosses.js: update(z, dt, api)
  // drives the jutsu, draw(ctx, z, time) paints the ground layer (telegraphs, craters, seals, Ashura's
  // chakra avatar standing behind him), drawOverlay(ctx, z, time) what is above the characters.
  // All per-boss state lives on z.sg (plain numbers; the delayed blows in st.ev and fx.upd are closures,
  // which the co-op serialiser drops). The three sprites are registered here through AnimeSprites.addSprite.
  //  Hagoromo: Truth-Seeking Ball spears, Truth-Seeking Ball meteors, Shinra Tensei, Yin-Yang creation,
  //            Planetary Devastation, Six Paths Chibaku Tensei sealing (ult). Floats, nine black orbs behind him.
  //  Hamura:   Air Palm, Vacuum Wall Palm, Rotation, Eight Trigrams 64 Palms, Tenseigan Truth-Seeking Balls,
  //            Golden Wheel Reincarnation Explosion (ult). Tenseigan chakra mode lights up when hurt / for the ult.
  //  Ashura:   prototype Rasengan dash, Sage Art thousand chakra fists, Wood Release roots, Sage Art ground slam,
  //            giant chakra hands, Asura thousand-armed chakra avatar barrage (ult).
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const turn = (a, b, max) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-max, Math.min(max, d)); };
  const R0 = v => Math.round(v);
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  const order = ['hagoromo', 'hamura', 'ashura'];
  const members = {
    hagoromo: {
      name: 'LỤC ĐẠO TIÊN NHÂN HAGOROMO', accent: '#f0e6c0', hpScale: 4.1, damageScale: 2.0, armor: .85, scale: 1.7,
      moves: ['spear', 'rain', 'shinra', 'yinyang', 'planet', 'chibaku', 'spear', 'yinyang', 'rain', 'planet', 'shinra', 'spear', 'chibaku']
    },
    hamura: {
      name: 'ŌTSUTSUKI HAMURA', accent: '#bcd8ff', hpScale: 3.9, damageScale: 2.0, armor: .86, scale: 1.62,
      moves: ['palm', 'kaiten', 'sixtyfour', 'tsb', 'kuheki', 'kinrin', 'palm', 'sixtyfour', 'tsb', 'kaiten', 'kuheki', 'palm', 'kinrin']
    },
    ashura: {
      name: 'ŌTSUTSUKI ASHURA', accent: '#ffb060', hpScale: 3.8, damageScale: 2.0, armor: .87, scale: 1.52,
      moves: ['rasengan', 'fists', 'roots', 'slam', 'hands', 'asura', 'rasengan', 'slam', 'roots', 'fists', 'hands', 'rasengan', 'asura']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    spear:     { label: 'CẦU ĐẠO NGỌC · HẮC THƯƠNG', rgb: '170,140,255', windup: .85, after: 1.2, ranged: 1 },
    rain:      { label: 'CẦU ĐẠO NGỌC · THIÊN VẪN', rgb: '160,130,255', windup: 1.0, after: 1.3, ranged: 1 },
    shinra:    { label: 'THẦN LA THIÊN CHINH', rgb: '200,180,255', windup: .75, after: 1.2 },
    yinyang:   { label: 'ÂM DƯƠNG ĐỘN · VẠN VẬT SÁNG TẠO', rgb: '255,236,170', windup: 1.0, after: 1.4, ranged: 1 },
    planet:    { label: 'THIÊN ĐẠO · TINH CẦU HOẠI DIỆT', rgb: '190,150,255', windup: 1.1, after: 1.5, ranged: 1 },
    chibaku:   { label: 'LỤC ĐẠO · ĐỊA BỘC THIÊN TINH', rgb: '255,220,140', windup: 1.7, after: 2.8, ranged: 1 },
    palm:      { label: 'BÁT QUÁI KHÔNG CHƯỞNG', rgb: '170,215,255', windup: .8, after: 1.1, ranged: 1 },
    kuheki:    { label: 'BÁT QUÁI KHÔNG BÍCH CHƯỞNG', rgb: '190,225,255', windup: .7, after: 1.1 },
    kaiten:    { label: 'BÁT QUÁI CHƯỞNG HỒI THIÊN', rgb: '205,232,255', windup: .5, after: 1.0 },
    sixtyfour: { label: 'NHU QUYỀN · BÁT QUÁI LỤC THẬP TỨ CHƯỞNG', rgb: '160,205,255', windup: .9, after: 1.2 },
    tsb:       { label: 'CHUYỂN SINH NHÃN · CẦU ĐẠO NGỌC', rgb: '120,190,255', windup: 1.0, after: 1.3, ranged: 1 },
    kinrin:    { label: 'KIM LUÂN CHUYỂN SINH BẠO', rgb: '255,214,110', windup: 2.0, after: 2.8, ranged: 1 },
    rasengan:  { label: 'LOA TOÀN HOÀN · NGUYÊN SƠ', rgb: '120,190,255', windup: .8, after: 1.1 },
    fists:     { label: 'TIÊN THUẬT · THIÊN THỦ QUYỀN', rgb: '255,190,90', windup: .9, after: 1.2 },
    roots:     { label: 'MỘC ĐỘN · THỤ CĂN BỘC', rgb: '200,160,90', windup: .9, after: 1.2, ranged: 1 },
    slam:      { label: 'TIÊN THUẬT · CHẤN ĐỊA QUYỀN', rgb: '255,170,80', windup: .85, after: 1.2 },
    hands:     { label: 'A TU LA · CỰ THỦ CHƯỞNG', rgb: '255,200,100', windup: 1.1, after: 1.3, ranged: 1 },
    asura:     { label: 'TIÊN THUẬT · A TU LA THIÊN THỦ', rgb: '255,180,70', windup: 1.8, after: 2.8, ranged: 1 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;
  // Manual control (team mode): each member's jutsu in key order 1..n, ultimate last.
  const MANUAL = {}, MOVE_LISTS = {};
  for (const id in members) {
    MANUAL[id] = [...new Set(members[id].moves)];
    MOVE_LISTS[id] = MANUAL[id].map(k => ({ id: k, label: MOVES[k].label }));
  }
  function moves(z) { return (z && MOVE_LISTS[z.bossId]) || []; }
  const ULTS = { chibaku: 1, kinrin: 1, asura: 1 };

  // ------------------------------------------------------------------ tuning
  const SP_N = 5, SP_SPREAD = .15, SP_LEN = 1000, SP_W = 30, SP_FLY = .34;
  const RAIN_N = 7, RAIN_R = 125, RAIN_FALL = .45;
  const SHIN_R = 430;
  const YY_R = 330, YY_T = 1.5;
  const PL_N = 4, PL_R = 190, PL_FLY = .45, PL_T = 1.3;
  const CB_R = 640, CB_CORE = 300, CB_T = 2.9, CB_H = 175;
  const PALM_LEN = 880, PALM_W = 88, PALM_SPEED = 2100;
  const KUH_LEN = 650, KUH_HALF = .55;
  const KAI_R = 240, KAI_T = 1.1;
  const SF_R = 270, SF_N = 8;
  const TSB_N = 6, TSB_R = 115;
  const KIN_R = 650, KIN_CORE = 270, KIN_DROP = .35;
  const RAS_W = 62, RAS_END = 200, RAS_T = .3;
  const FI_LEN = 720, FI_HALF = .42, FI_N = 16;
  const ROOT_W = 70, ROOT_N = 12, ROOT_T = .7;
  const SLAM_R = 270, SLAM_T = .5;
  const HAND_R = 200;
  const ASU_R = 540, ASU_T = 2.4;

  const INK_V = 'rgba(16,8,40,.85)';
  const VIO = ['90,60,220', '170,140,255', '240,235,255'];

  function pick(level) { return order[(Math.abs(level | 0)) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  const faceOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;

  function state(z) {
    return z.sg || (z.sg = { t: 0, casts: 0, timer: 1.3, move: '', windup: 0, windMax: 1, aim: 0, tx: R0(z.x), ty: R0(z.y),
      tele: [], ev: [], fx: [], hold: 0, holdMove: '', spots: null, path: null, lastDraw: 0, dash: null, leap: null,
      spin: 0, tense: 0, tsbOut: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = R0(Math.random() * 99);
    if (st.fx.length >= 16) {
      const k = st.fx.findIndex(f => !f.big);
      st.fx.splice(k < 0 ? 0 : k, 1);
    }
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });

  function curvePath(x, y, a, len, amp, n, phase = 0) {
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, off = Math.sin(t * TAU + phase) * amp * Math.sin(Math.PI * t * .5 + .2);
      pts.push([R0(x + ca * len * t + nx * off), R0(y + sa * len * t + ny * off)]);
    }
    return pts;
  }
  function sectorHit(api, x, y, a, R, half, dmg, kind, ks = [.3, .55, .8]) {
    for (const k of ks) {
      const rr = R * k, n = Math.max(2, Math.ceil(2 * half * rr / 130));
      for (let j = 0; j < n; j++) {
        const b = a - half + (j + .5) * 2 * half / n;
        api.strike(x + Math.cos(b) * rr, y + Math.sin(b) * rr, 125, dmg, null, j === (n >> 1) && k > .7 ? kind : null, true);
      }
    }
  }
  // Gravity pull toward (x, y): drifts the real target in (never a pseudo cursor target or a remote peer).
  function suck(api, x, y, R, speed, dt) {
    let p = api.player;
    if (p && p.pseudo) p = api.nearestFoe ? api.nearestFoe(x, y, R) : null;
    if (!p || p.pseudo || p.remote || !(p.health > 0)) return;
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d > R || d < 34) return;
    const s = Math.min(d - 30, speed * dt * (.55 + .45 * (1 - d / R)));
    const nx = p.x + dx / d * s, ny = p.y + dy / d * s;
    if (!api.blocked(nx, ny, p.r || 14)) { p.x = nx; p.y = ny; }
  }
  // Keep a target spot within reach of the caster.
  function reach(z, tx, ty, max, min = 0) {
    const a = Math.atan2(ty - z.y, tx - z.x), d = Math.max(min, Math.min(max, Math.hypot(tx - z.x, ty - z.y)));
    return [R0(z.x + Math.cos(a) * d), R0(z.y + Math.sin(a) * d)];
  }

  // ------------------------------------------------------------------ telegraphs
  const C = (x, y, r, faint, small) => ({ k: 'c', x, y, r, faint, small });
  function ringSpots(cx, cy, n, d0, d1, jitter) {
    const out = [{ x: cx, y: cy }], b = Math.random() * TAU;
    for (let i = 0; i < n - 1; i++) {
      const a = b + i * TAU / (n - 1) + rand(-jitter, jitter), d = (i % 2 ? d0 : d1) + rand(-25, 25);
      out.push({ x: R0(cx + Math.cos(a) * d), y: R0(cy + Math.sin(a) * d) });
    }
    return out;
  }
  const TELE = {
    spear() {
      const out = [];
      for (let i = 0; i < SP_N; i++) out.push({ k: 'line', follow: true, from: 40, boff: (i - (SP_N - 1) / 2) * SP_SPREAD, len: SP_LEN, w: SP_W });
      return out;
    },
    rain(z, st) {
      const c = reach(z, st.tx, st.ty, 760);
      const spots = ringSpots(c[0], c[1], RAIN_N, 170, 270, .25);
      spots.forEach((s, i) => { s.t = +(.08 + i * .085).toFixed(2); });
      st.spots = spots;
      return spots.map((s, i) => C(s.x, s.y, RAIN_R, i > 0, false));
    },
    shinra() { return [{ k: 'c', follow: true, r: SHIN_R }, { k: 'c', follow: true, r: SHIN_R * .45, faint: true }]; },
    yinyang(z, st) {
      const c = reach(z, st.tx, st.ty, 780);
      st.spots = [{ x: c[0], y: c[1] }];
      return [C(c[0], c[1], YY_R), C(c[0], c[1], YY_R * .4, true)];
    },
    planet(z, st) {
      const c = reach(z, st.tx, st.ty, 760), b = Math.random() * TAU, spots = [];
      for (let i = 0; i < PL_N; i++) { const a = b + i * TAU / PL_N, d = i % 2 ? 150 : 230; spots.push({ x: R0(c[0] + Math.cos(a) * d), y: R0(c[1] + Math.sin(a) * d) }); }
      st.spots = spots;
      return spots.map(s => C(s.x, s.y, PL_R));
    },
    chibaku(z, st) {
      const c = reach(z, st.tx, st.ty, 640);
      st.spots = [{ x: c[0], y: c[1] }];
      return [C(c[0], c[1], CB_R), C(c[0], c[1], CB_CORE, true), { k: 'ring', x: c[0], y: c[1], r0: CB_R, r1: CB_R + 90 }];
    },
    palm() { return [{ k: 'line', follow: true, from: 40, len: PALM_LEN, w: PALM_W }, { k: 'c', follow: true, along: PALM_LEN, r: 160, faint: true }]; },
    kuheki() { return [{ k: 'sector', follow: true, r: KUH_LEN, half: KUH_HALF }]; },
    kaiten() { return [{ k: 'c', follow: true, r: KAI_R }]; },
    sixtyfour(z, st) {
      const c = reach(z, st.tx, st.ty, 640);
      st.spots = [{ x: c[0], y: c[1] }];
      return [C(c[0], c[1], SF_R), C(c[0], c[1], 150, true)];
    },
    tsb(z, st) {
      const c = reach(z, st.tx, st.ty, 760);
      const spots = ringSpots(c[0], c[1], TSB_N, 160, 250, .3);
      spots.forEach((s, i) => { s.t = +(.42 + i * .09).toFixed(2); });
      st.spots = spots;
      return spots.map((s, i) => C(s.x, s.y, TSB_R, i > 0, i > 0));
    },
    kinrin(z, st) {
      const c = reach(z, st.tx, st.ty, 700);
      st.spots = [{ x: c[0], y: c[1] }];
      return [C(c[0], c[1], KIN_R), C(c[0], c[1], KIN_CORE, true), { k: 'ring', x: c[0], y: c[1], r0: KIN_R, r1: KIN_R + 80 }];
    },
    rasengan(z, st) {
      const d = Math.max(420, Math.min(760, Math.hypot(st.tx - z.x, st.ty - z.y) + 120));
      st.spots = [{ d: R0(d) }];
      return [{ k: 'line', follow: true, from: 0, len: d, w: RAS_W }, { k: 'c', follow: true, along: d, r: RAS_END }];
    },
    fists() { return [{ k: 'cone', follow: true, len: FI_LEN, half: FI_HALF }]; },
    roots(z, st) {
      const d = Math.max(520, Math.min(860, Math.hypot(st.tx - z.x, st.ty - z.y) + 180));
      st.path = curvePath(z.x, z.y, st.aim, d, 70, ROOT_N, Math.random() < .5 ? 0 : Math.PI);
      return [{ k: 'path', pts: st.path, w: ROOT_W }];
    },
    slam(z, st) {
      const c = reach(z, st.tx, st.ty, 620, 120);
      st.spots = [{ x: c[0], y: c[1] }];
      return [C(c[0], c[1], SLAM_R), C(c[0], c[1], SLAM_R * .45, true)];
    },
    hands(z, st) {
      const c = reach(z, st.tx, st.ty, 700, 200), a = st.aim, nx = -Math.sin(a), ny = Math.cos(a);
      st.spots = [{ x: R0(c[0] + nx * 150), y: R0(c[1] + ny * 150) }, { x: R0(c[0] - nx * 150), y: R0(c[1] - ny * 150) }];
      return st.spots.map(s => C(s.x, s.y, HAND_R));
    },
    asura(z, st) {
      const c = reach(z, st.tx, st.ty, 620);
      st.spots = [{ x: c[0], y: c[1] }];
      return [C(c[0], c[1], ASU_R), C(c[0], c[1], 300, true)];
    }
  };

  function announce(z, st, m, api, forced) {
    const move = forced || m.moves[st.casts % m.moves.length];
    if (!forced) st.casts++;
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = +aimAt(z, p).toFixed(3); st.tx = p ? R0(p.x) : R0(z.x + Math.cos(st.aim) * 300); st.ty = p ? R0(p.y) : R0(z.y + Math.sin(st.aim) * 300);
    st.tele = TELE[move] ? TELE[move](z, st) : [];
  }

  // ------------------------------------------------------------------ casting
  const CAST = {
    // ---- Hagoromo
    spear(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim, t = [];
      for (let i = 0; i < SP_N; i++) {
        const off = i - (SP_N - 1) / 2, b = a + off * SP_SPREAD, cb = Math.cos(b), sb = Math.sin(b), t0 = +(.02 + Math.abs(off) * .06).toFixed(2);
        t.push(t0);
        later(st, t0 + SP_FLY * .5, api => api.line(x + cb * 40, y + sb * 40, x + cb * SP_LEN, y + sb * SP_LEN, SP_W, D * 1.35, i === 2 ? 'blade' : null));
        later(st, t0 + SP_FLY, api => { api.strike(x + cb * SP_LEN, y + sb * SP_LEN, 80, D * .6, null, null, true); if (i === 2) { api.world(x + cb * SP_LEN, y + sb * SP_LEN, 110, D * 2, 'crater'); api.shake(10); } });
      }
      addFx(st, { kind: 'spear', x: R0(x), y: R0(y), a, t, dur: 1.9 });
      st.tsbOut = 1.6;
    },
    rain(z, st, api, D) {
      const spots = st.spots || [];
      addFx(st, { kind: 'rain', spots, x0: R0(z.x), y0: R0(z.y), dur: (spots.length ? spots[spots.length - 1].t : 0) + RAIN_FALL + 1.5 });
      spots.forEach((s, i) => later(st, s.t + RAIN_FALL, api => {
        api.strike(s.x, s.y, RAIN_R, D * 1.5, null, i % 3 === 0 ? 'crater' : null, true);
        if (i % 3 === 0) api.world(s.x, s.y, 120, D * 2, 'crater');
        api.shake(i ? 7 : 12);
      }));
      st.tsbOut = 2.2; st.spots = null;
    },
    shinra(z, st, api, D) {
      addFx(st, { kind: 'shinra', x: R0(z.x), y: R0(z.y), dur: 1.6 });
      api.knockback(z, SHIN_R, 280, D * 1.8);
      api.world(z.x, z.y, 260, D * 2.4, 'shockwave');
      api.shake(18);
      st.hold = .35; st.holdMove = 'shinra';
    },
    yinyang(z, st, api, D) {
      const s = (st.spots || [{ x: st.tx, y: st.ty }])[0];
      addFx(st, { kind: 'yinyang', x: s.x, y: s.y, T: YY_T, dur: YY_T + 1.4, dmg: D, big: true, upd: yyUpd });
      st.hold = .6; st.holdMove = 'yinyang'; st.spots = null;
    },
    planet(z, st, api, D) {
      const spots = st.spots || [];
      addFx(st, { kind: 'planet', spots, x0: R0(z.x), y0: R0(z.y), dur: PL_FLY + PL_T + 1.4, dmg: D, big: true, upd: planetUpd });
      spots.forEach((s, i) => later(st, PL_FLY + PL_T + i * .06, api => {
        api.strike(s.x, s.y, PL_R, D * 2.1, null, 'crater', true);
        api.world(s.x, s.y, 170, D * 2.4, 'crater');
        api.shake(14);
      }));
      st.hold = .5; st.holdMove = 'planet'; st.spots = null;
    },
    chibaku(z, st, api, D) {
      const s = (st.spots || [{ x: st.tx, y: st.ty }])[0];
      addFx(st, { kind: 'chibaku', x: s.x, y: s.y, x0: R0(z.x), y0: R0(z.y), T: CB_T, dur: CB_T + 2.4, dmg: D, big: true, nt: .4, upd: chibakuUpd });
      st.hold = CB_T + .4; st.holdMove = 'chibaku'; st.spots = null;
      st.tsbOut = CB_T + .6;
    },
    // ---- Hamura
    palm(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), T = PALM_LEN / PALM_SPEED;
      addFx(st, { kind: 'palm', x: R0(x), y: R0(y), a, T, dur: T + 1.0 });
      for (let k = 1; k <= 6; k++) {
        const d0 = 40 + (PALM_LEN - 40) * (k - 1) / 6, d1 = 40 + (PALM_LEN - 40) * k / 6;
        later(st, T * k / 6, api => api.line(x + ca * d0, y + sa * d0, x + ca * d1, y + sa * d1, PALM_W, D * 1.9, k === 6 ? 'shockwave' : null));
      }
      later(st, T + .02, api => {
        const ex = x + ca * PALM_LEN, ey = y + sa * PALM_LEN;
        api.strike(ex, ey, 160, D * 1.1, null, 'shockwave', true);
        api.knockback({ x: ex - ca * 160, y: ey - sa * 160 }, 330, 150, 0);
        api.shake(12);
      });
      st.hold = .3; st.holdMove = 'palm';
    },
    kuheki(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim;
      addFx(st, { kind: 'kuheki', x: R0(x), y: R0(y), a, dur: 1.2 });
      [.3, .55, .8].forEach((k, i) => later(st, .04 + i * .07, api => sectorHit(api, x, y, a, KUH_LEN, KUH_HALF, D * 1.5, i === 2 ? 'shockwave' : null, [k])));
      later(st, .26, api => { api.world(x + Math.cos(a) * 380, y + Math.sin(a) * 380, 150, D * 1.6, 'shockwave', a); api.shake(12); });
      st.hold = .3; st.holdMove = 'kuheki';
    },
    kaiten(z, st, api, D) {
      addFx(st, { kind: 'kaiten', x: R0(z.x), y: R0(z.y), dur: KAI_T + .5 });
      st.spin = KAI_T; st.hold = KAI_T; st.holdMove = 'kaiten';
      for (const t of [.04, .6]) later(st, t, api => { api.knockback(z, KAI_R, 120, D * 1.25); api.shake(9); });
      later(st, .1, api => api.world(z.x, z.y, 170, D * 1.4, 'vortex'));
    },
    sixtyfour(z, st, api, D) {
      const s = (st.spots || [{ x: st.tx, y: st.ty }])[0];
      // He closes in: one step of body flicker to the edge of the trigram field.
      const a = Math.atan2(s.y - z.y, s.x - z.x), d = Math.max(0, Math.hypot(s.x - z.x, s.y - z.y) - 70);
      if (d > 20) { st.dash = { a: +a.toFixed(3), d: R0(d), t: 0, T: .16 }; z.kageDash = .2; z.angle = a; }
      const fx = addFx(st, { kind: 'sixty', x: s.x, y: s.y, a: +a.toFixed(3), dur: .2 + SF_N * .12 + 1.2 });
      for (let i = 0; i < SF_N; i++) {
        const last = i === SF_N - 1;
        later(st, .2 + i * .12, api => {
          api.strike(s.x, s.y, last ? SF_R * .75 : 150, D * (last ? 1.8 : .55), null, last ? 'shockwave' : null, true);
          z.kageDash = .14;
          if (last) { api.knockback({ x: s.x - Math.cos(a) * 90, y: s.y - Math.sin(a) * 90 }, SF_R, 170, 0); api.shake(16); }
          else api.shake(4);
          fx.n = i + 1;
        });
      }
      st.hold = .2 + SF_N * .12 + .1; st.holdMove = 'sixtyfour'; st.spots = null;
    },
    tsb(z, st, api, D) {
      const spots = st.spots || [];
      addFx(st, { kind: 'htsb', spots, x0: R0(z.x), y0: R0(z.y), dur: (spots.length ? spots[spots.length - 1].t : 0) + .3 + 1.3 });
      spots.forEach((s, i) => later(st, s.t + .3, api => {
        api.strike(s.x, s.y, TSB_R, D * 1.45, null, i === 0 ? 'crater' : null, true);
        if (i === 0) api.world(s.x, s.y, 130, D * 2, 'crater');
        api.shake(i ? 6 : 11);
      }));
      st.hold = .5; st.holdMove = 'tsb'; st.spots = null;
    },
    kinrin(z, st, api, D) {
      const s = (st.spots || [{ x: st.tx, y: st.ty }])[0];
      addFx(st, { kind: 'kinrin', x: s.x, y: s.y, x0: R0(z.x), y0: R0(z.y), dur: KIN_DROP + 2.8, big: true });
      later(st, KIN_DROP, api => {
        api.strike(s.x, s.y, KIN_CORE, D * 3.8, null, 'crater', true);
        api.world(s.x, s.y, 300, D * 4, 'crater');
        api.shake(34);
      });
      later(st, KIN_DROP + .2, api => {
        api.strike(s.x, s.y, KIN_R, D * 1.8, null, 'shockwave', true);
        for (let i = 0; i < 3; i++) { const b = i * TAU / 3 + .4; api.world(s.x + Math.cos(b) * 400, s.y + Math.sin(b) * 400, 180, D * 2.4, 'shockwave'); }
      });
      st.hold = 1.1; st.holdMove = 'kinrin'; st.spots = null;
    },
    // ---- Ashura
    rasengan(z, st, api, D) {
      const sp = (st.spots && st.spots[0]) || { d: 500 }, a = st.aim, x0 = z.x, y0 = z.y, ca = Math.cos(a), sa = Math.sin(a), d = sp.d;
      st.dash = { a: +a.toFixed(3), d, t: 0, T: RAS_T };
      z.kageDash = RAS_T + .15; z.angle = a;
      const fx = addFx(st, { kind: 'ras', x0: R0(x0), y0: R0(y0), a: +a.toFixed(3), len: d, ex: R0(x0 + ca * d), ey: R0(y0 + sa * d), T: RAS_T, dur: RAS_T + 1.5 });
      later(st, RAS_T * .5, api => api.line(x0, y0, x0 + ca * d, y0 + sa * d, RAS_W, D * 1.8, null));
      later(st, RAS_T, api => {
        fx.ex = R0(z.x + ca * 30); fx.ey = R0(z.y + sa * 30);
        api.strike(fx.ex, fx.ey, RAS_END, D * 2.5, null, 'crater', true);
        api.world(fx.ex, fx.ey, 190, D * 2.8, 'vortex', a);
        api.shake(18);
      });
      later(st, RAS_T + .3, api => api.strike(fx.ex, fx.ey, RAS_END * .7, D * .8, null, null, true));
      st.spots = null;
    },
    fists(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim, spots = [];
      for (let i = 0; i < FI_N; i++) {
        const b = a + (hash(i * 3.7 + st.casts) - .5) * 2 * FI_HALF * .9, d = 140 + (FI_LEN - 160) * (.15 + .85 * hash(i * 5.1 + st.casts * 1.3));
        spots.push({ x: R0(x + Math.cos(b) * d), y: R0(y + Math.sin(b) * d), t: +(.05 + i * .055).toFixed(3) });
      }
      addFx(st, { kind: 'fists', x: R0(x), y: R0(y), a, spots, dur: .05 + FI_N * .055 + 1.1 });
      spots.forEach((s, i) => later(st, s.t + .12, api => {
        api.strike(s.x, s.y, 95, D * .75, null, i % 6 === 5 ? 'earth' : null, true);
        if (i % 4 === 0) api.shake(5);
      }));
      st.hold = FI_N * .055 + .2; st.holdMove = 'fists';
    },
    roots(z, st, api, D) {
      const pts = st.path || [[z.x, z.y], [z.x + 1, z.y]], n = pts.length - 1;
      addFx(st, { kind: 'roots', pts, T: ROOT_T, dur: ROOT_T + 2.6, dmg: D, nt: ROOT_T + .6, upd: rootsUpd });
      for (let k = 1; k <= n; k++) {
        const p = pts[k];
        later(st, k / n * ROOT_T, api => { api.strike(p[0], p[1], ROOT_W + 10, D * 1.25, null, k % 4 === 0 ? 'earth' : null, true); if (k % 3 === 0) api.shake(6); });
      }
      st.hold = .45; st.holdMove = 'roots'; st.path = null;
    },
    slam(z, st, api, D) {
      const s = (st.spots || [{ x: st.tx, y: st.ty }])[0];
      let x1 = s.x, y1 = s.y;
      if (api.blocked(x1, y1, z.r || 14)) { x1 = R0(z.x); y1 = R0(z.y); }
      st.leap = { x0: R0(z.x), y0: R0(z.y), x1, y1, t: 0, T: SLAM_T };
      z.kageDash = SLAM_T + .1;
      addFx(st, { kind: 'slam', x: x1, y: y1, T: SLAM_T, dur: SLAM_T + 1.6 });
      later(st, SLAM_T, api => {
        api.strike(x1, y1, SLAM_R, D * 2.3, null, 'crater', true);
        api.knockback({ x: x1, y: y1 }, SLAM_R + 20, 140, 0);
        api.world(x1, y1, 230, D * 2.6, 'earth');
        api.shake(20);
      });
      st.spots = null;
    },
    hands(z, st, api, D) {
      const spots = st.spots || [];
      addFx(st, { kind: 'hands', spots, x0: R0(z.x), y0: R0(z.y), dur: 2.2 });
      spots.forEach((s, i) => later(st, .3 + i * .22, api => {
        api.strike(s.x, s.y, HAND_R, D * 2.0, null, 'crater', true);
        api.world(s.x, s.y, 180, D * 2.4, 'earth');
        api.shake(16);
      }));
      st.hold = .8; st.holdMove = 'hands'; st.spots = null;
    },
    asura(z, st, api, D) {
      const s = (st.spots || [{ x: st.tx, y: st.ty }])[0];
      addFx(st, { kind: 'asura', x: s.x, y: s.y, x0: R0(z.x), y0: R0(z.y), T: ASU_T, dur: ASU_T + 1.8, dmg: D, big: true, nt: .05, n: 0, hits: [], upd: asuraUpd });
      st.hold = ASU_T + .5; st.holdMove = 'asura'; st.spots = null;
    }
  };

  // ------------------------------------------------------------------ lingering hits
  function yyUpd(fx, dt, api) {
    if (fx.age < fx.T - .5) suck(api, fx.x, fx.y, YY_R + 90, 160, dt);
    if (!fx.boom && fx.age >= fx.T) {
      fx.boom = 1;
      api.strike(fx.x, fx.y, YY_R, fx.dmg * 2.8, null, 'vortex', true);
      api.world(fx.x, fx.y, 250, fx.dmg * 3, 'vortex');
      api.shake(22);
    }
  }
  function planetUpd(fx, dt, api) {
    if (fx.age < PL_FLY || fx.age > PL_FLY + PL_T - .45) return;
    for (const s of fx.spots) suck(api, s.x, s.y, PL_R + 70, 110, dt / fx.spots.length * 1.6);
  }
  function chibakuUpd(fx, dt, api) {
    if (fx.age < fx.T - .6) suck(api, fx.x, fx.y, CB_R + 80, 175, dt);
    if (fx.age >= fx.nt && fx.age < fx.T - .6) { fx.nt += .55; api.strike(fx.x, fx.y, CB_R, fx.dmg * .22, null, null, true); }
    if (!fx.boom && fx.age >= fx.T) {
      fx.boom = 1;
      api.strike(fx.x, fx.y, CB_CORE, fx.dmg * 4.2, null, 'crater', true);
      api.strike(fx.x, fx.y, CB_R, fx.dmg * 1.6, null, null, true);
      api.world(fx.x, fx.y, 340, fx.dmg * 4.4, 'crater');
      for (let i = 0; i < 3; i++) { const b = i * TAU / 3 + .9; api.world(fx.x + Math.cos(b) * 420, fx.y + Math.sin(b) * 420, 170, fx.dmg * 2.4, 'earth'); }
      api.shake(34);
    }
  }
  function rootsUpd(fx, dt, api) {
    if (fx.age < fx.nt || fx.age > fx.dur - .8) return;
    fx.nt += .6;
    for (const s of [.2, .45, .7, .95]) { const i = Math.min(fx.pts.length - 1, R0(s * (fx.pts.length - 1))), p = fx.pts[i]; api.strike(p[0], p[1], ROOT_W, fx.dmg * .3, null, null, true); }
  }
  function asuraUpd(fx, dt, api) {
    while (fx.age >= fx.nt && fx.age < fx.T) {
      fx.nt += .09; fx.n++;
      const a = hash(fx.n * 3.17 + fx.seed) * TAU, d = Math.sqrt(hash(fx.n * 7.3 + fx.seed)) * (ASU_R - 60);
      const hx = R0(fx.x + Math.cos(a) * d), hy = R0(fx.y + Math.sin(a) * d);
      fx.hits.push([hx, hy, +fx.age.toFixed(2), fx.n % 6]);
      if (fx.hits.length > 14) fx.hits.shift();
      api.strike(hx, hy, 118, fx.dmg * .72, null, fx.n % 6 === 0 ? 'earth' : null, true);
      if (fx.n % 3 === 0) api.shake(7);
    }
    if (!fx.boom && fx.age >= fx.T + .12) {
      fx.boom = 1;
      api.strike(fx.x, fx.y, 300, fx.dmg * 3.3, null, 'crater', true);
      api.strike(fx.x, fx.y, ASU_R, fx.dmg * 1.4, null, null, true);
      api.world(fx.x, fx.y, 320, fx.dmg * 4, 'crater');
      for (let i = 0; i < 2; i++) { const b = i * Math.PI + .6; api.world(fx.x + Math.cos(b) * 330, fx.y + Math.sin(b) * 330, 160, fx.dmg * 2.2, 'earth'); }
      api.shake(34);
    }
  }

  // Paint the cached art when the boss appears rather than in the middle of the fight.
  function prewarm(id) {
    try {
      if (id === 'hagoromo') { orbSpr(); spearSpr(); taijiSpr(); sealSpr(); rockSpr(); for (let v = 0; v < 3; v++) chunkSpr(v); }
      else if (id === 'hamura') { palmSpr(0); trigramSpr(); goldOrbSpr(); wheelSpr(); kaitenSpr(); }
      else if (id === 'ashura') { fistSpr(); palmSpr(1); avatarSpr(); for (let v = 0; v < 3; v++) { rootSpr(v); chunkSpr(v); } }
    } catch (e) { /* cosmetic */ }
  }

  // ------------------------------------------------------------------ update
  function update(z, dt, api) {
    const m = members[z.bossId];
    if (!m) return;
    const st = state(z);
    if (!st.t && Kit()) prewarm(z.bossId);
    st.t += dt;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) {
      z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.dash = null; st.leap = null; st.spin = 0; st.windup = 0; st.move = '';
      z.manualBusy = false; return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.tsbOut = Math.max(0, st.tsbOut - dt);
    z.kageDash = Math.max(0, (z.kageDash || 0) - dt);
    z.armorScale = m.armor || 1;
    // Dashes (Rasengan charge, the 64 Palms step in).
    if (st.dash) {
      const ds = st.dash, t0 = ds.t;
      ds.t = Math.min(ds.T, ds.t + dt);
      const step = (ds.t - t0) / ds.T * ds.d, ca = Math.cos(ds.a), sa = Math.sin(ds.a);
      const nx = z.x + ca * step, ny = z.y + sa * step;
      if (!api.blocked(nx, ny, z.r || 14)) { z.x = nx; z.y = ny; } else ds.t = ds.T;
      if (ds.t >= ds.T) st.dash = null;
    }
    // Ashura's leap for the Sage Art slam.
    if (st.leap) {
      const lp = st.leap;
      lp.t = Math.min(lp.T, lp.t + dt);
      const k = easeOut(lp.t / lp.T * .9 + .1 * (lp.t / lp.T));
      const nx = lp.x0 + (lp.x1 - lp.x0) * k, ny = lp.y0 + (lp.y1 - lp.y0) * k;
      if (!api.blocked(nx, ny, z.r || 14)) { z.x = nx; z.y = ny; }
      z.kageDash = Math.max(z.kageDash, .05);
      if (lp.t >= lp.T) st.leap = null;
    }
    // Rotation: Hamura whirls (the sprite flips round and round).
    if (st.spin > 0) { st.spin = Math.max(0, st.spin - dt); z.angle = (z.angle || 0) + dt * 26; }

    const p = api.player;
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      // line moves keep tracking the target through the first part of the windup
      if ((st.move === 'spear' || st.move === 'palm' || st.move === 'kuheki' || st.move === 'fists' || st.move === 'rasengan') && st.windup > .3 && p)
        st.aim = +turn(st.aim, aimAt(z, p), dt * 1.4).toFixed(3);
      if (st.windup === 0) {
        CAST[st.move](z, st, api, api.damage || 60);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && !st.dash && !st.leap) {
      st.holdMove = '';
      if (z.manual) {
        const want = z.manualCast != null ? MANUAL[z.bossId][z.manualCast] : null;
        z.manualCast = null;
        if (want) announce(z, st, m, api, want);
      } else {
        st.timer -= dt;
        const d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
        if (st.timer <= 0 && p && d < 940) announce(z, st, m, api);
      }
    }
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.leap;
    const quickHold = st.holdMove === 'sixtyfour' || st.holdMove === 'kaiten';
    z.bossWindup = st.windup > 0 ? st.windup : st.hold > 0 && !quickHold ? st.hold : 0;
    const planted = (st.windup > 0 && ULTS[st.move]) || (st.hold > 0 && (ULTS[st.holdMove] || quickHold)) || st.dash || st.leap;
    // Hagoromo is a caster: he hovers at range instead of walking into melee.
    const hover = z.bossId === 'hagoromo' && !z.manual && p && Math.hypot(z.x - p.x, z.y - p.y) < 330;
    z.speedScale = planted || hover ? .02 : z.bossId === 'hagoromo' ? .82 : z.bossId === 'hamura' ? 1 : 1.08;
    // Hamura's Tenseigan chakra mode: lit when hurt, blazing through the Golden Wheel.
    if (z.bossId === 'hamura') {
      const want = (st.move === 'kinrin' || st.holdMove === 'kinrin') ? 1 : z.health < z.maxHealth * .55 ? .7 : 0;
      st.tense = +(st.tense + Math.max(-dt * 1.2, Math.min(dt * 1.6, want - st.tense))).toFixed(3);
    } else if (z.bossId === 'ashura') {
      const want = (st.move === 'asura' || st.holdMove === 'asura') ? 1 : (st.move || st.holdMove) ? .45 : 0;
      st.tense = +(st.tense + Math.max(-dt * 1.4, Math.min(dt * 2.2, want - st.tense))).toFixed(3);
    }
  }

  // ================================================================== cached art
  function orbSpr() {
    return Kit().sprite('sg:orb', 64, 64, g => {
      let gr = g.createRadialGradient(32, 32, 14, 32, 32, 32);
      gr.addColorStop(0, 'rgba(40,16,80,.75)'); gr.addColorStop(.5, 'rgba(40,16,80,.25)'); gr.addColorStop(1, 'rgba(40,16,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      gr = g.createRadialGradient(26, 25, 1, 32, 32, 20);
      gr.addColorStop(0, '#9a92ae'); gr.addColorStop(.18, '#3c3648'); gr.addColorStop(.55, '#100e16'); gr.addColorStop(1, '#020203');
      g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 20, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(215,200,255,.75)'; g.lineWidth = 1.6; g.beginPath(); g.arc(32, 32, 19.4, .2 * Math.PI, 1.05 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(25, 24, 4, 2.4, -.6, 0, TAU); g.fill();
    });
  }
  // Tenseigan Truth-Seeking Ball: black core in a blue-gold corona.
  function goldOrbSpr() {
    return Kit().sprite('sg:gorb', 64, 64, g => {
      let gr = g.createRadialGradient(32, 32, 12, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,226,120,1)'); gr.addColorStop(.55, 'rgba(255,190,70,.75)'); gr.addColorStop(.8, 'rgba(90,170,255,.35)'); gr.addColorStop(1, 'rgba(60,130,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      gr = g.createRadialGradient(27, 26, 1, 32, 32, 17);
      gr.addColorStop(0, '#8aa0c8'); gr.addColorStop(.2, '#2a3248'); gr.addColorStop(.6, '#0a0c14'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 17, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,236,170,.95)'; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 17, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(26, 25, 3.4, 2, -.6, 0, TAU); g.fill();
    });
  }
  function spearSpr() {
    return Kit().sprite('sg:spear', 260, 24, g => {
      g.lineJoin = 'round';
      const body = () => { g.beginPath(); g.moveTo(2, 10.5); g.lineTo(200, 8.6); g.lineTo(258, 12); g.lineTo(200, 15.4); g.lineTo(2, 13.5); g.closePath(); };
      body(); g.strokeStyle = 'rgba(200,180,255,.85)'; g.lineWidth = 3.4; g.stroke();
      body(); g.fillStyle = '#0c0a12'; g.fill();
      g.fillStyle = 'rgba(160,150,190,.8)'; g.beginPath(); g.moveTo(10, 11); g.lineTo(200, 9.6); g.lineTo(250, 11.6); g.lineTo(200, 10.8); g.lineTo(10, 12); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(214, 10.8, 30, 1);
    });
  }
  // Yin-Yang disc: black yin and white yang chasing each other inside a gold rim.
  function taijiSpr() {
    return Kit().sprite('sg:taiji', 256, 256, g => {
      const c = 128, R = 116;
      g.translate(c, c);
      g.fillStyle = '#f7f3e8'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.fillStyle = '#0b0a10';
      g.beginPath(); g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2); g.arc(0, R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -R / 2, R / 2, Math.PI / 2, -Math.PI / 2); g.closePath(); g.fill();
      g.fillStyle = '#f7f3e8'; g.beginPath(); g.arc(0, -R / 2, R * .14, 0, TAU); g.fill();
      g.fillStyle = '#0b0a10'; g.beginPath(); g.arc(0, R / 2, R * .14, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,20,10,.9)'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, R + 3, 0, TAU); g.stroke();
      g.strokeStyle = '#ffd774'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R + 3, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,240,190,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R - 6, 0, TAU); g.stroke();
    });
  }
  // The Six Paths seal: Rinnegan ripples, nine magatama and six sealing bands, ink black with gold edges.
  function sealSpr() {
    return Kit().sprite('sg:seal', 512, 512, g => {
      g.translate(256, 256); g.lineCap = 'round';
      const ring = (r, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); };
      ring(246, 12, 'rgba(10,6,20,.85)'); ring(246, 4, '#f0c860'); ring(226, 3, 'rgba(10,6,20,.8)');
      for (const r of [52, 100, 148, 192]) { ring(r, 7, 'rgba(10,6,20,.82)'); ring(r, 2, 'rgba(240,200,110,.85)'); }
      for (let i = 0; i < 6; i++) {
        g.save(); g.rotate(i * TAU / 6 + .26);
        g.fillStyle = 'rgba(10,6,20,.62)'; g.fillRect(58, -8, 186, 16);
        g.strokeStyle = '#f0c860'; g.lineWidth = 2; g.strokeRect(58, -9, 186, 18);
        g.strokeStyle = 'rgba(240,200,110,.9)'; g.lineWidth = 2.4; g.beginPath();
        for (let x = 66; x < 236; x += 14) { g.moveTo(x, -5); g.lineTo(x + 7, 5); g.lineTo(x + 14, -5); }
        g.stroke();
        g.restore();
      }
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9, x = Math.cos(a) * 214, y = Math.sin(a) * 214;
        g.fillStyle = '#0a0610'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
        g.strokeStyle = '#0a0610'; g.lineWidth = 7; g.beginPath(); g.arc(x - Math.cos(a + 1.6) * 12, y - Math.sin(a + 1.6) * 12, 14, a + 1.4, a + 2.9); g.stroke();
        g.strokeStyle = '#f0c860'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.stroke();
      }
      g.fillStyle = 'rgba(10,6,20,.9)'; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
      g.fillStyle = '#f0c860'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
    });
  }
  function rockSpr() {
    return Kit().sprite('sg:rock', 256, 256, g => {
      const lump = () => { g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, r = 112 + (hash(i * 2.3) - .5) * 16; i ? g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r) : g.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.closePath(); };
      const gr = g.createRadialGradient(92, 84, 10, 128, 128, 124);
      gr.addColorStop(0, '#b8aa96'); gr.addColorStop(.45, '#7d6e5c'); gr.addColorStop(.85, '#41372e'); gr.addColorStop(1, '#231d18');
      lump(); g.fillStyle = gr; g.fill(); g.lineWidth = 5; g.strokeStyle = '#1d1712'; g.stroke();
      g.save(); lump(); g.clip();
      for (let i = 0; i < 26; i++) {
        const x = 30 + hash(i * 3.1) * 196, y = 30 + hash(i * 7.7) * 196, r = 6 + hash(i * 1.9) * 16;
        g.fillStyle = 'rgba(30,22,16,.45)'; g.beginPath(); g.ellipse(x, y, r, r * .8, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(220,210,190,.28)'; g.beginPath(); g.ellipse(x - r * .25, y - r * .3, r * .6, r * .4, 0, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(20,14,10,.6)'; g.lineWidth = 2.5;
      for (let i = 0; i < 9; i++) { let a = hash(i * 4.4) * TAU, x = 128 + Math.cos(a) * 40, y = 128 + Math.sin(a) * 40; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { a += (hash(i + k * 5.3) - .5) * 1.2; x += Math.cos(a) * 22; y += Math.sin(a) * 22; g.lineTo(x, y); } g.stroke(); }
      g.restore();
    });
  }
  function chunkSpr(v) {
    return Kit().sprite('sg:chunk' + v, 40, 40, g => {
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + v, r = 12 + hash(v * 9 + i) * 7; i ? g.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r) : g.moveTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); }
      g.closePath(); g.fillStyle = ['#8a7a66', '#6e604f', '#9a8a72'][v % 3]; g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#231c15'; g.stroke();
      g.fillStyle = 'rgba(255,245,225,.35)'; g.beginPath(); g.moveTo(12, 12); g.lineTo(24, 9); g.lineTo(18, 18); g.closePath(); g.fill();
    });
  }
  // Open chakra palm, fingers up (Hamura's Air Palm white-blue, Ashura's giant hands gold).
  function palmSpr(gold) {
    return Kit().sprite('sg:palm' + (gold ? 'g' : ''), 200, 240, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const hand = () => {
        g.beginPath();
        g.moveTo(52, 230); g.lineTo(46, 130); g.lineTo(18, 92); g.quadraticCurveTo(14, 80, 26, 80); g.lineTo(56, 110);
        g.lineTo(58, 30); g.quadraticCurveTo(66, 18, 74, 30); g.lineTo(80, 100);
        g.lineTo(92, 14); g.quadraticCurveTo(102, 4, 110, 16); g.lineTo(112, 100);
        g.lineTo(126, 24); g.quadraticCurveTo(136, 14, 142, 28); g.lineTo(138, 108);
        g.lineTo(156, 50); g.quadraticCurveTo(166, 42, 170, 56); g.lineTo(158, 140); g.lineTo(150, 230); g.closePath();
      };
      const fill = gold ? 'rgba(255,196,90,.62)' : 'rgba(215,235,255,.55)', edge = gold ? 'rgba(255,246,210,.98)' : 'rgba(255,255,255,.96)';
      const ink = gold ? 'rgba(110,50,0,.65)' : 'rgba(20,40,110,.6)', mid = gold ? 'rgba(200,110,20,.75)' : 'rgba(120,160,230,.8)';
      hand(); g.strokeStyle = ink; g.lineWidth = 12; g.stroke();
      hand(); g.fillStyle = fill; g.fill(); g.lineWidth = 6; g.strokeStyle = edge; g.stroke();
      g.lineWidth = 2.4; g.strokeStyle = mid;
      g.beginPath(); g.moveTo(66, 150); g.quadraticCurveTo(100, 132, 140, 150); g.moveTo(70, 180); g.quadraticCurveTo(100, 166, 136, 176);
      g.moveTo(66, 112); g.lineTo(66, 60); g.moveTo(100, 108); g.lineTo(100, 44); g.moveTo(130, 112); g.lineTo(132, 56); g.stroke();
    });
  }
  // Eight Trigrams field: double rim with 64 ticks, the eight trigrams and a yin-yang heart.
  function trigramSpr() {
    return Kit().sprite('sg:tri', 512, 512, g => {
      g.translate(256, 256); g.lineCap = 'round';
      const dual = (fn, w) => { g.strokeStyle = 'rgba(10,24,70,.7)'; g.lineWidth = w + 5; fn(); g.stroke(); g.strokeStyle = 'rgba(230,242,255,.95)'; g.lineWidth = w; fn(); g.stroke(); };
      dual(() => { g.beginPath(); g.arc(0, 0, 244, 0, TAU); }, 4);
      dual(() => { g.beginPath(); g.arc(0, 0, 226, 0, TAU); }, 2.5);
      dual(() => { g.beginPath(); for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; g.moveTo(Math.cos(a) * 228, Math.sin(a) * 228); g.lineTo(Math.cos(a) * 242, Math.sin(a) * 242); } }, 2);
      const TRI = [7, 3, 5, 1, 6, 2, 4, 0];
      for (let i = 0; i < 8; i++) {
        g.save(); g.rotate(i * TAU / 8 - Math.PI / 2);
        for (let b = 0; b < 3; b++) {
          const r = 150 + b * 20, solid = (TRI[i] >> b) & 1, hw = 44 - b * 2;
          dual(() => {
            g.beginPath();
            if (solid) { g.moveTo(r, -hw); g.lineTo(r, hw); }
            else { g.moveTo(r, -hw); g.lineTo(r, -8); g.moveTo(r, 8); g.lineTo(r, hw); }
          }, 7);
        }
        g.restore();
      }
      dual(() => { g.beginPath(); g.arc(0, 0, 110, 0, TAU); }, 3);
      const R = 70;
      g.fillStyle = 'rgba(235,245,255,.92)'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.fillStyle = 'rgba(14,24,60,.92)';
      g.beginPath(); g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2); g.arc(0, R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -R / 2, R / 2, Math.PI / 2, -Math.PI / 2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(235,245,255,.92)'; g.beginPath(); g.arc(0, -R / 2, 9, 0, TAU); g.fill();
      g.fillStyle = 'rgba(14,24,60,.92)'; g.beginPath(); g.arc(0, R / 2, 9, 0, TAU); g.fill();
    });
  }
  // Hamura's Tenseigan wheel: a golden ring studded with eight black orbs.
  function wheelSpr() {
    return Kit().sprite('sg:wheel', 256, 256, g => {
      g.translate(128, 128);
      g.strokeStyle = 'rgba(80,40,0,.7)'; g.lineWidth = 20; g.beginPath(); g.arc(0, 0, 100, 0, TAU); g.stroke();
      g.strokeStyle = '#ffcf5a'; g.lineWidth = 12; g.stroke();
      g.strokeStyle = '#fff4c8'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 97, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,214,110,.75)'; g.lineWidth = 3;
      g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.moveTo(Math.cos(a) * 108, Math.sin(a) * 108); g.lineTo(Math.cos(a) * 124, Math.sin(a) * 124); } g.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        g.fillStyle = '#08080e'; g.beginPath(); g.arc(Math.cos(a) * 100, Math.sin(a) * 100, 12, 0, TAU); g.fill();
        g.strokeStyle = '#fff0b0'; g.lineWidth = 2.4; g.stroke();
      }
    });
  }
  function kaitenSpr() {
    return Kit().swirl('sg:kaiten', ['rgba(235,246,255,.95)', 'rgba(150,200,255,.85)', 'rgba(255,255,255,.9)'], 14, .9, .25, 192, 4.2);
  }
  function fistSpr() {
    return Kit().sprite('sg:fist', 120, 120, g => {
      g.lineJoin = 'round';
      const body = () => { g.beginPath(); g.moveTo(18, 62); g.quadraticCurveTo(16, 22, 60, 18); g.quadraticCurveTo(104, 20, 104, 60); g.quadraticCurveTo(106, 100, 60, 104); g.quadraticCurveTo(20, 102, 18, 62); g.closePath(); };
      body(); g.strokeStyle = 'rgba(110,50,0,.7)'; g.lineWidth = 10; g.stroke();
      body(); g.fillStyle = 'rgba(255,190,80,.78)'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff1c8'; g.stroke();
      for (let i = 0; i < 4; i++) {
        const y = 30 + i * 20;
        g.fillStyle = 'rgba(255,226,150,.92)'; g.beginPath(); g.ellipse(92, y, 12, 10, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(160,80,10,.85)'; g.lineWidth = 2; g.stroke();
      }
      g.fillStyle = 'rgba(255,250,230,.8)'; g.beginPath(); g.ellipse(48, 40, 16, 8, -.5, 0, TAU); g.fill();
    });
  }
  // Wood Release root spikes: three twisting stakes from one knot, bark lines and a lit edge.
  function rootSpr(v) {
    return Kit().sprite('sg:root' + v, 90, 150, g => {
      g.lineJoin = 'round';
      const spike = (bx, h, lean, w) => {
        g.beginPath(); g.moveTo(bx - w, 146);
        g.bezierCurveTo(bx - w * .8 + lean * .2, 146 - h * .4, bx - w * .2 + lean * .8, 146 - h * .7, bx + lean, 146 - h);
        g.bezierCurveTo(bx + w * .4 + lean * .7, 146 - h * .65, bx + w * .9 + lean * .2, 146 - h * .35, bx + w, 146); g.closePath();
        g.fillStyle = '#8a5a2e'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = '#2a170a'; g.stroke();
        g.save(); g.clip();
        g.fillStyle = 'rgba(40,20,6,.45)'; g.fillRect(bx, 146 - h, w + 20, h);
        g.strokeStyle = 'rgba(40,22,8,.7)'; g.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(bx - w * .6 + k * w * .4, 146); g.quadraticCurveTo(bx + lean * .5 + k * 2, 146 - h * .5, bx + lean, 146 - h + 10); g.stroke(); }
        g.fillStyle = 'rgba(255,220,160,.35)'; g.beginPath(); g.moveTo(bx - w * .7, 146); g.quadraticCurveTo(bx - w * .5 + lean * .5, 146 - h * .5, bx + lean - 2, 146 - h + 6); g.lineTo(bx - w * .3, 146); g.closePath(); g.fill();
        g.restore();
      };
      const s = v * 2.7 + 1;
      spike(24 + hash(s) * 6, 60 + hash(s + 1) * 26, -16, 10);
      spike(66 - hash(s + 2) * 6, 70 + hash(s + 3) * 24, 14, 10);
      spike(45, 112 + hash(s + 4) * 26, (hash(s + 5) - .5) * 18, 14);
      g.fillStyle = '#5a3a1c'; g.beginPath(); g.ellipse(45, 144, 34, 7, 0, 0, TAU); g.fill();
    });
  }
  // Ashura's Sage Art avatar: a towering golden chakra giant with six arms raised round a calm face.
  const AV_W = 760, AV_H = 600, AVC = AV_W / 2;
  function avatarSpr() {
    return Kit().sprite('sg:asura', AV_W, AV_H, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const fill = 'rgba(255,182,70,.52)', edge = 'rgba(255,244,205,.96)', ink = 'rgba(120,52,0,.6)', vein = 'rgba(200,110,20,.75)';
      const shape = (build, w = 5) => { build(); g.strokeStyle = ink; g.lineWidth = w + 8; g.stroke(); build(); g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = w; g.stroke(); };
      // A tapered limb through three points (shoulder, elbow, wrist) with half-widths w0, w1, w2.
      const limb = (p0, p1, p2, w0, w1, w2) => {
        const n = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
        const n0 = n(p0, p1), n2 = n(p1, p2), n1 = [(n0[0] + n2[0]) / 2, (n0[1] + n2[1]) / 2];
        g.beginPath();
        g.moveTo(p0[0] + n0[0] * w0, p0[1] + n0[1] * w0);
        g.quadraticCurveTo(p1[0] + n1[0] * w1 * 1.25, p1[1] + n1[1] * w1 * 1.25, p2[0] + n2[0] * w2, p2[1] + n2[1] * w2);
        g.lineTo(p2[0] - n2[0] * w2, p2[1] - n2[1] * w2);
        g.quadraticCurveTo(p1[0] - n1[0] * w1, p1[1] - n1[1] * w1, p0[0] - n0[0] * w0, p0[1] - n0[1] * w0);
        g.closePath();
      };
      // six arms (three a side) fanned up and out behind the body: shoulder -> elbow -> fist
      const ARMS = [[-1.3, 1, 1], [-.62, 1.05, .9], [.05, .92, .8]];
      for (const s of [-1, 1]) for (const [ang, k, z] of ARMS) {
        const sx = AVC + s * 118, sy = 344 - (1 - z) * 40, a = s > 0 ? ang : Math.PI - ang;
        const e = [sx + Math.cos(a) * 108 * k, sy + Math.sin(a) * 108 * k], b = a - s * .62;
        const f = [e[0] + Math.cos(b) * 96 * k, e[1] + Math.sin(b) * 96 * k];
        shape(() => limb([sx, sy], e, f, 30 * z, 24 * z, 17 * z), 4);
        g.strokeStyle = vein; g.lineWidth = 2.4; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(e[0], e[1], f[0], f[1]); g.stroke();
        // clenched fist with knuckle ridges facing outward
        const fr = 34 * k * z + 6;
        shape(() => { g.beginPath(); g.ellipse(f[0], f[1], fr, fr * .86, b, 0, TAU); }, 4);
        g.strokeStyle = vein; g.lineWidth = 2.6; g.beginPath();
        for (let i = 0; i < 4; i++) { const q = b + (i - 1.5) * .42; g.moveTo(f[0] + Math.cos(q) * fr * .45, f[1] + Math.sin(q) * fr * .45); g.lineTo(f[0] + Math.cos(q) * fr * .95, f[1] + Math.sin(q) * fr * .95); }
        g.stroke();
        g.fillStyle = 'rgba(255,252,235,.7)'; g.beginPath(); g.ellipse(f[0] - fr * .25, f[1] - fr * .3, fr * .35, fr * .18, -.5, 0, TAU); g.fill();
      }
      // broad shoulders and chest flaring into a flame-robed base
      shape(() => {
        g.beginPath(); g.moveTo(AVC - 160, 600); g.quadraticCurveTo(AVC - 150, 470, AVC - 130, 380); g.quadraticCurveTo(AVC - 150, 330, AVC - 110, 316);
        g.quadraticCurveTo(AVC, 286, AVC + 110, 316); g.quadraticCurveTo(AVC + 150, 330, AVC + 130, 380); g.quadraticCurveTo(AVC + 150, 470, AVC + 160, 600);
        for (let i = 0; i <= 8; i++) g.lineTo(AVC + 160 - i * 40, 600 - (i % 2) * 22);
        g.closePath();
      }, 6);
      g.strokeStyle = vein; g.lineWidth = 3;
      g.beginPath(); g.moveTo(AVC, 330); g.lineTo(AVC, 560);
      g.moveTo(AVC - 80, 380); g.quadraticCurveTo(AVC - 40, 410, AVC, 392); g.quadraticCurveTo(AVC + 40, 410, AVC + 80, 380);
      g.moveTo(AVC - 70, 450); g.quadraticCurveTo(AVC, 480, AVC + 70, 450); g.moveTo(AVC - 60, 506); g.quadraticCurveTo(AVC, 530, AVC + 60, 506); g.stroke();
      for (let i = 0; i < 7; i++) { const a = (.18 + i * .107) * Math.PI, x = AVC + Math.cos(a) * 96, y = 334 + Math.sin(a) * 40; g.fillStyle = 'rgba(255,248,220,.95)'; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); g.strokeStyle = ink; g.lineWidth = 2; g.stroke(); }
      // head: flame-like crown of hair, calm face, sage marks, the forehead jewel
      shape(() => { g.beginPath(); g.moveTo(AVC - 70, 230); for (let i = 0; i <= 14; i++) { const a = Math.PI + i / 14 * Math.PI, r = 84 + (i % 2) * 34; g.lineTo(AVC + Math.cos(a) * r * .86, 214 + Math.sin(a) * r); } g.closePath(); }, 5);
      shape(() => { g.beginPath(); g.ellipse(AVC, 224, 62, 74, 0, 0, TAU); }, 6);
      g.fillStyle = 'rgba(255,255,255,.98)';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(AVC + s * 12, 216); g.quadraticCurveTo(AVC + s * 28, 204, AVC + s * 44, 214); g.quadraticCurveTo(AVC + s * 28, 222, AVC + s * 12, 216); g.fill(); }
      g.strokeStyle = 'rgba(170,80,10,.95)'; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(AVC - 46, 198); g.lineTo(AVC - 12, 203); g.moveTo(AVC + 46, 198); g.lineTo(AVC + 12, 203); g.moveTo(AVC - 12, 264); g.quadraticCurveTo(AVC, 270, AVC + 12, 264); g.stroke();
      g.strokeStyle = 'rgba(255,110,40,.9)'; g.lineWidth = 3;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(AVC + s * 18, 228); g.lineTo(AVC + s * 40, 232); g.stroke(); }
      g.fillStyle = 'rgba(255,90,30,.9)'; g.beginPath(); g.arc(AVC, 182, 7, 0, TAU); g.fill();
    });
  }

  // ================================================================== primitives
  function ring(ctx, x, y, r, w, color, squash = .5) {
    if (!(r > 1)) return;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * squash, 0, 0, TAU); ctx.stroke();
  }
  function inkRing(ctx, x, y, r, a, w, inkRgb, rgb, squash = .5) {
    if (!(a > .01)) return;
    ring(ctx, x, y, r, w + 5, `rgba(${inkRgb},${.55 * a})`, squash);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ring(ctx, x, y, r, w, `rgba(${rgb},${.9 * a})`, squash);
    ctx.globalCompositeOperation = op;
  }
  function cracks(ctx, x, y, r, n, seed, alpha, w = 2.5) {
    if (alpha <= .01 || r < 4) return;
    ctx.strokeStyle = `rgba(24,16,22,${.7 * alpha})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
  function crater(ctx, x, y, r, alpha, seed) {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(40,30,26,${.35 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(20,14,12,${.3 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y + r * .04, r * .62, r * .3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(230,215,190,${.35 * alpha})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y - 2, r * .96, r * .47, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    cracks(ctx, x, y, r * 1.5, 9, seed, alpha);
  }
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10, kind = 'dust') {
    if (alpha <= .01) return;
    const K = Kit(), dust = K.puff(kind);
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  // Radial ink splash: black shards thrown out of an impact (Truth-Seeking Balls).
  function inkSplash(ctx, x, y, r, n, seed, alpha) {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(8,4,16,${.85 * alpha})`;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 1.7 + seed) * .4, l = r * (.6 + hash(i * 3.9 + seed) * .5), w = .09 + hash(i + seed) * .06;
      ctx.moveTo(x + Math.cos(a - w) * r * .3, y + Math.sin(a - w) * r * .15);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * .5);
      ctx.lineTo(x + Math.cos(a + w) * r * .3, y + Math.sin(a + w) * r * .15);
    }
    ctx.fill();
  }
  function orb(ctx, x, y, r, a = 1) { Kit().stamp(ctx, orbSpr(), x, y, r * 1.6, a); }
  function gorb(ctx, x, y, r, a = 1) { Kit().stamp(ctx, goldOrbSpr(), x, y, r * 1.88, a); }
  function spriteAt(ctx, img, x, y, w, h, rot, alpha, ox = .5, oy = .5) {
    if (!(alpha > .01)) return;
    ctx.save(); ctx.globalAlpha *= Math.min(1, alpha); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -w * ox, -h * oy, w, h); ctx.restore();
  }
  // Ground-plane sprite (squashed to the 0.5 view), optionally spinning.
  function groundSpr(ctx, img, x, y, r, rot, alpha) {
    if (!(alpha > .01) || !(r > 1)) return;
    ctx.save(); ctx.globalAlpha *= Math.min(1, alpha); ctx.translate(x, y); ctx.scale(1, .5); if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -r, -r, r * 2, r * 2); ctx.restore();
  }
  function streaks(ctx, x, y, R, n, time, seed, alpha, rgb, inward = true) {
    if (alpha <= .01) return;
    ctx.strokeStyle = `rgba(${rgb},${alpha})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ph = frac(time * 1.4 + hash(i * 2.9 + seed)), a = hash(i * 7.3 + seed) * TAU + time * .3;
      const d = inward ? R * (1 - ph) : R * ph, l = 30 + 40 * hash(i + seed);
      ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d * .5);
      ctx.lineTo(x + Math.cos(a) * (d + (inward ? l : -l)), y + Math.sin(a) * (d + (inward ? l : -l)) * .5);
    }
    ctx.stroke();
  }

  // ================================================================== telegraph painters
  const pulseOf = time => .55 + Math.sin(time * 22) * .2;
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = pulseOf(time);
    ctx.fillStyle = `rgba(14,12,34,${faint ? .08 : .16})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.ellipse(x, y, r * clamp01(k), r * .5 * clamp01(k), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(14,12,44,.45)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 1.8 : faint ? 2 : 3;
    ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14) * .5); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12) * .5);
      }
      ctx.stroke();
    }
  }
  function markRing(ctx, x, y, r0, r1, rgb, k, time) {
    const pulse = pulseOf(time);
    ctx.fillStyle = `rgba(${rgb},${.08 + .12 * k})`;
    ctx.beginPath(); ctx.ellipse(x, y, r1, r1 * .5, 0, 0, TAU); ctx.ellipse(x, y, r0, r0 * .5, 0, 0, TAU); ctx.fill('evenodd');
    ctx.setLineDash([22, 14]); ctx.lineDashOffset = -time * 120;
    ctx.strokeStyle = 'rgba(14,12,44,.4)'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.ellipse(x, y, r1, r1 * .5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.setLineDash([]);
  }
  function markLine(ctx, x, y, a, len, w, rgb, k, time, big, faint) {
    const pulse = pulseOf(time) * (faint ? .6 : 1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = `rgba(14,12,34,${big ? .2 : faint ? .07 : .14})`; ctx.fillRect(0, -w, len, w * 2);
    ctx.fillStyle = `rgba(${rgb},${(faint ? .06 : .12) + .16 * k})`; ctx.fillRect(0, -w, len * k, w * 2);
    ctx.strokeStyle = 'rgba(14,12,44,.4)'; ctx.lineWidth = big ? 6 : faint ? 3 : 4.5; ctx.strokeRect(0, -w, len, w * 2);
    ctx.lineWidth = big ? 3 : faint ? 1.4 : 2.2; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -w, len, w * 2);
    if (!faint) {
      ctx.lineWidth = 2.5; ctx.beginPath();
      const sp = big ? 150 : 120;
      for (let d = 60 + (time * (big ? 420 : 260)) % sp; d < len - 20; d += sp) { ctx.moveTo(d - 16, -w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, w * .4); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function markPath(ctx, pts, w, rgb, k, time) {
    const pulse = pulseOf(time);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const stroke = (n) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };
    ctx.strokeStyle = 'rgba(14,12,44,.4)'; ctx.lineWidth = w * 2 + 6; stroke(pts.length - 1);
    ctx.strokeStyle = 'rgba(14,12,34,.16)'; ctx.lineWidth = w * 2; stroke(pts.length - 1);
    ctx.strokeStyle = `rgba(${rgb},${.14 + .18 * k})`; ctx.lineWidth = w * 2 - 4; stroke(Math.max(1, Math.round((pts.length - 1) * k)));
    ctx.setLineDash([18, 16]); ctx.lineDashOffset = -time * 200;
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.4; stroke(pts.length - 1);
    ctx.setLineDash([]);
  }
  function markSector(ctx, x, y, a, r, half, rgb, k, time, squash) {
    const pulse = pulseOf(time);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, squash);
    const sec = rr => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rr, a - half, a + half); ctx.closePath(); };
    sec(r); ctx.fillStyle = 'rgba(14,12,34,.16)'; ctx.fill();
    sec(r * clamp01(k)); ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fill();
    sec(r); ctx.strokeStyle = 'rgba(14,12,44,.45)'; ctx.lineWidth = 5.5 / Math.max(.5, squash) * .7; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.restore();
  }
  function drawTele(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
    for (const s of st.tele) {
      if (s.k === 'c') {
        let x = s.x, y = s.y;
        if (s.follow) { const b = st.aim + (s.boff || 0), d = s.along || 0; x = z.x + Math.cos(b) * d; y = z.y + Math.sin(b) * d; }
        markCircle(ctx, x, y, s.r, rgb, k, time, s.faint, s.small);
      } else if (s.k === 'ring') markRing(ctx, s.x, s.y, s.r0, s.r1, rgb, k, time);
      else if (s.k === 'line') {
        const b0 = st.aim, b = b0 + (s.boff || 0), ox = z.x + Math.cos(b0) * (s.from || 0), oy = z.y + Math.sin(b0) * (s.from || 0);
        markLine(ctx, ox, oy, b, s.len, s.w, rgb, k, time, s.big, s.faint);
      } else if (s.k === 'path') markPath(ctx, s.pts, s.w, rgb, k, time);
      else if (s.k === 'cone') markSector(ctx, z.x, z.y, st.aim, s.len, s.half, rgb, k, time, 1);
      else if (s.k === 'sector') markSector(ctx, z.x, z.y, st.aim, s.r, s.half, rgb, k, time, .5);
    }
  }

  // ================================================================== HAGOROMO
  const HALO_N = 9;
  // Where the nine Truth-Seeking Balls hover behind his back.
  function haloCenter(z, lift) { return [z.x - faceOf(z) * 8, z.y - lift - 66]; }
  function drawHalo(ctx, z, st, time) {
    const out = st.tsbOut > 0 ? Math.min(HALO_N - 2, Math.ceil(st.tsbOut * 4)) : 0;
    const [cx, cy] = haloCenter(z, bodyLift(z));
    const n = HALO_N - out;
    ctx.globalCompositeOperation = 'lighter';
    Kit().glow(ctx, cx, cy + 10, 90, '90,60,200', .18);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < n; i++) {
      const a = i / HALO_N * TAU + time * .55, x = cx + Math.cos(a) * 60, y = cy + Math.sin(a) * 19 + Math.sin(time * 2 + i) * 3;
      orb(ctx, x, y, 7.2 + Math.sin(a) * 1.1, 1);
    }
  }

  // ---- Truth-Seeking Ball spears
  function spearG(ctx, fx, time) {
    const n = fx.t.length;
    for (let i = 0; i < n; i++) {
      const b = fx.a + (i - (n - 1) / 2) * SP_SPREAD, c = Math.cos(b), s = Math.sin(b), t0 = fx.t[i];
      const p = clamp01((fx.age - t0) / SP_FLY), d = 40 + (SP_LEN - 40) * easeOut(p), fade = 1 - win(fx.age, t0 + 1, t0 + 1.5);
      if (fx.age < t0 || fade <= 0) continue;
      ctx.strokeStyle = `rgba(20,10,40,${.22 * fade})`; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x + c * Math.max(40, d - 300), fx.y + s * Math.max(40, d - 300)); ctx.lineTo(fx.x + c * d, fx.y + s * d); ctx.stroke();
      if (p >= 1) {
        const ex = fx.x + c * SP_LEN, ey = fx.y + s * SP_LEN, ia = fx.age - t0 - SP_FLY;
        crater(ctx, ex, ey, 46, fade, fx.seed + i);
        inkSplash(ctx, ex, ey, 70 + 30 * easeOut(ia * 3), 9, fx.seed + i * 3, fade * .8);
      }
    }
  }
  function spearO(ctx, fx, time) {
    const n = fx.t.length, L = LIFT() * 1.7, img = spearSpr();
    for (let i = 0; i < n; i++) {
      const off = i - (n - 1) / 2, b = fx.a + off * SP_SPREAD, c = Math.cos(b), s = Math.sin(b), t0 = fx.t[i];
      if (fx.age < t0) {
        // the orb peels off the halo and lines up at his shoulder
        const k = fx.age / Math.max(.01, t0);
        orb(ctx, fx.x - c * 20 + (1 - k) * off * 18, fx.y - L - 50 * (1 - k), 9, 1);
        continue;
      }
      const p = clamp01((fx.age - t0) / SP_FLY), d = 40 + (SP_LEN - 40) * easeOut(p), fade = 1 - win(fx.age, t0 + .9, t0 + 1.4);
      if (fade <= 0) continue;
      const hx = fx.x + c * d, hy = fx.y + s * d - L * (1 - .6 * p), tail = Math.max(30, d - 340 * (1 - .5 * p));
      const tx = fx.x + c * tail, ty = fx.y + s * tail - L;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(14,6,34,${.6 * fade * (1 - p * .5)})`; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(160,130,255,${.55 * fade * (1 - p * .5)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      if (p < 1) Kit().glow(ctx, hx, hy, 40, '120,90,255', .5 * fade);
      ctx.globalCompositeOperation = 'source-over';
      const len = 150 + 110 * p;
      spriteAt(ctx, img, hx, hy, len * 1.15, 24, Math.atan2(hy - ty, hx - tx), fade, .96, .5);
      if (p >= 1) {
        const ia = fx.age - t0 - SP_FLY;
        if (ia < .4) {
          ctx.globalCompositeOperation = 'lighter';
          Kit().glow(ctx, hx, hy + L * .4, 90 * (1 - ia * 2), '200,170,255', .7 * (1 - ia / .4), true);
          ctx.globalCompositeOperation = 'source-over';
          inkRing(ctx, fx.x + c * SP_LEN, fx.y + s * SP_LEN, 30 + 160 * easeOut(ia / .4), 1 - ia / .4, 5, '12,6,30', '190,160,255');
        }
        dustRing(ctx, fx.x + c * SP_LEN, fx.y + s * SP_LEN, 40 + 80 * easeOut(ia * 2), 6, 22, fade * (1 - clamp01(ia * 1.3)), fx.seed + i, 12);
      }
    }
  }

  // ---- Truth-Seeking Ball meteors
  function rainG(ctx, fx, time) {
    fx.spots.forEach((s, i) => {
      const f = (fx.age - s.t) / RAIN_FALL;
      if (f < 0) return;
      if (f < 1) {
        ctx.fillStyle = `rgba(10,4,24,${.12 + .3 * f})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 20 + 50 * f, (20 + 50 * f) * .5, 0, 0, TAU); ctx.fill();
        return;
      }
      const ia = fx.age - s.t - RAIN_FALL, fade = 1 - win(ia, .9, 1.5);
      crater(ctx, s.x, s.y, RAIN_R * .62, fade, fx.seed + i * 5);
      inkSplash(ctx, s.x, s.y, RAIN_R * (1 + .4 * easeOut(ia * 3)), 10, fx.seed + i * 2, fade * .85);
    });
  }
  function rainO(ctx, fx, time) {
    const K = Kit();
    fx.spots.forEach((s, i) => {
      const f = (fx.age - s.t) / RAIN_FALL;
      if (f < -.6) return;
      if (f < 0) {
        // rising out of the halo toward the sky
        const k = 1 + f / .6, x = fx.x0 + (s.x - fx.x0) * k * .2, y = fx.y0 - 90 - k * 260;
        orb(ctx, x, y, 9, k);
        return;
      }
      if (f < 1) {
        const h = 620 * (1 - easeIn(f)), x = s.x + (1 - f) * 60, y = s.y - h;
        ctx.strokeStyle = 'rgba(14,6,34,.55)'; ctx.lineWidth = 14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 30, y - 140); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(170,140,255,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 30, y - 140); ctx.lineTo(x, y); ctx.stroke();
        K.glow(ctx, x, y, 46, '120,90,255', .5);
        ctx.globalCompositeOperation = 'source-over';
        orb(ctx, x, y, 17, 1);
        return;
      }
      const ia = fx.age - s.t - RAIN_FALL;
      if (ia < .5) {
        const e = easeOut(ia / .5);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, s.x, s.y - 20, RAIN_R * (1.2 - .6 * e), '210,190,255', 1 - e, true);
        ctx.globalCompositeOperation = 'source-over';
        inkRing(ctx, s.x, s.y, 30 + RAIN_R * 1.3 * e, 1 - e, 6, '10,4,26', '190,160,255');
        orb(ctx, s.x, s.y - 14 * (1 - e), 17 * (1 - e * .6), 1 - e);
        K.fx.debris(ctx, s.x, s.y, RAIN_R * 1.1, ia * 1.6, fx.seed + i, '#2a2230', 8);
      }
      dustRing(ctx, s.x, s.y, RAIN_R * (.7 + .6 * easeOut(ia * 1.5)), 7, 24, 1 - clamp01(ia * .9), fx.seed + i * 4, 14);
    });
  }

  // ---- Shinra Tensei
  function shinraG(ctx, fx, time) {
    const fade = 1 - win(fx.age, 1, 1.6), e = easeOut(fx.age / .5);
    crater(ctx, fx.x, fx.y, 150, fade, fx.seed);
    for (const k of [.3, .55, .8]) ring(ctx, fx.x, fx.y, SHIN_R * k * (.6 + .4 * e), 3, `rgba(40,20,80,${.35 * fade})`);
  }
  function shinraO(ctx, fx, time) {
    const K = Kit(), L = LIFT() * 1.3;
    ctx.globalCompositeOperation = 'lighter';
    if (fx.age < .35) K.glow(ctx, fx.x, fx.y - L, 260 * (1 - fx.age), '220,200,255', 1 - fx.age / .35, true);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) {
      const p = (fx.age - i * .1) / .7;
      if (p > 0 && p < 1) K.fx.shockRing(ctx, fx.x, fx.y, SHIN_R * (1 + i * .12), p, 1 - p, i === 1 ? '255,255,255' : '190,160,255');
    }
    // a translucent repulsion dome bulging outwards
    const p = clamp01(fx.age / .45);
    if (p < 1) {
      ctx.save(); ctx.translate(fx.x, fx.y - 10); ctx.scale(1, .62);
      ctx.strokeStyle = `rgba(20,10,50,${.4 * (1 - p)})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, SHIN_R * easeOut(p), Math.PI, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(235,225,255,${.85 * (1 - p)})`; ctx.lineWidth = 4; ctx.stroke();
      ctx.restore();
    }
    dustRing(ctx, fx.x, fx.y, SHIN_R * (.4 + .65 * easeOut(fx.age / .7)), 14, 34, 1 - win(fx.age, .4, 1.5), fx.seed, 12);
    K.fx.debris(ctx, fx.x, fx.y, SHIN_R, fx.age * 1.2, fx.seed, '#3c3236', 12);
  }

  // ---- Yin-Yang Release: Creation of All Things
  function yyG(ctx, fx, time) {
    const K = Kit(), grow = easeOut(fx.age / .45), live = fx.age < fx.T;
    const fade = live ? 1 : 1 - win(fx.age, fx.T + .5, fx.T + 1.3);
    if (live) {
      const k = fx.age / fx.T, r = YY_R * (.35 + .65 * grow) * (1 - .25 * easeIn(k));
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y, r * 1.5, '255,220,140', .25 + .25 * k, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      groundSpr(ctx, taijiSpr(), fx.x, fx.y, r, time * (2 + 9 * easeIn(k)), .72);
      streaks(ctx, fx.x, fx.y, YY_R + 80, 18, time * (1 + k), fx.seed, .6, '255,236,180');
      streaks(ctx, fx.x, fx.y, YY_R + 40, 12, time * 1.3, fx.seed + 7, .55, '20,12,30');
    } else {
      crater(ctx, fx.x, fx.y, YY_R * .7, fade, fx.seed);
      ring(ctx, fx.x, fx.y, YY_R * .95, 4, `rgba(255,214,110,${.5 * fade})`);
    }
  }
  function yyO(ctx, fx, time) {
    const K = Kit(), L = LIFT() * 1.5;
    if (fx.age < fx.T) {
      const k = fx.age / fx.T;
      // black and white chakra motes swirling inward and up
      for (let i = 0; i < 16; i++) {
        const ph = frac(time * .9 + hash(i * 3.1 + fx.seed)), a = hash(i * 7.7 + fx.seed) * TAU + time * 2.4 * (i % 2 ? 1 : -1);
        const d = (YY_R + 60) * (1 - ph), x = fx.x + Math.cos(a) * d, y = fx.y + Math.sin(a) * d * .5 - ph * 90 * k;
        if (i % 2) orb(ctx, x, y, 5, .9 * (1 - ph * .5));
        else { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 14, '255,240,200', .9 * (1 - ph * .5), true); ctx.globalCompositeOperation = 'source-over'; }
      }
      // white and black spheres orbiting above the centre, closing in
      const ra = 80 * (1 - k) + 10, h = fx.y - L - 40 * k;
      orb(ctx, fx.x + Math.cos(time * 6) * ra, h + Math.sin(time * 6) * ra * .35, 16, 1);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x - Math.cos(time * 6) * ra, h - Math.sin(time * 6) * ra * .35, 26, '255,245,215', 1, true);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const a = fx.age - fx.T;
    if (a < 1.1) {
      const e = easeOut(a / .6), f = 1 - clamp01(a / 1.1);
      ctx.globalCompositeOperation = 'lighter';
      // pillar of light
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(.36, 1);
      K.glow(ctx, 0, -260, 300 * (.5 + e), '255,236,170', .8 * f, true);
      ctx.restore();
      K.glow(ctx, fx.x, fx.y, YY_R * (1.2 + .5 * e), '255,220,140', .6 * f, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      orb(ctx, fx.x, fx.y - L, 34 * (1 - e), f);
      K.fx.shockRing(ctx, fx.x, fx.y, YY_R * 1.25, clamp01(a / .7), f, '255,220,140');
      if (a > .1) K.fx.shockRing(ctx, fx.x, fx.y, YY_R * 1.05, clamp01((a - .1) / .7), f, '255,255,255');
      K.fx.debris(ctx, fx.x, fx.y, YY_R, a * 1.3, fx.seed, '#2a2420', 12);
    }
    dustRing(ctx, fx.x, fx.y, YY_R * (.7 + .4 * easeOut(a)), 12, 34, 1 - clamp01(a / 1.3), fx.seed + 3, 16);
  }

  // ---- Planetary Devastation
  function planetG(ctx, fx, time) {
    const crush = PL_FLY + PL_T;
    fx.spots.forEach((s, i) => {
      if (fx.age < PL_FLY) return;
      if (fx.age < crush + i * .06) {
        const k = (fx.age - PL_FLY) / PL_T;
        ctx.fillStyle = `rgba(20,10,30,${.18 + .25 * k})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 30 + 60 * k, (30 + 60 * k) * .5, 0, 0, TAU); ctx.fill();
        streaks(ctx, s.x, s.y, PL_R + 70, 10, time, fx.seed + i * 9, .55, '40,20,60');
        cracks(ctx, s.x, s.y, PL_R * .9 * k, 7, fx.seed + i, .6 * k, 2);
        return;
      }
      const ia = fx.age - crush - i * .06;
      crater(ctx, s.x, s.y, PL_R * .75, 1 - win(ia, .7, 1.3), fx.seed + i * 3);
    });
  }
  function planetO(ctx, fx, time) {
    const K = Kit(), crush = PL_FLY + PL_T, rock = rockSpr();
    fx.spots.forEach((s, i) => {
      const H = 110;
      if (fx.age < PL_FLY) {
        const k = fx.age / PL_FLY, x = fx.x0 + (s.x - fx.x0) * k, y = fx.y0 - 90 + (s.y - H - fx.y0 + 90) * k - Math.sin(Math.PI * k) * 140;
        orb(ctx, x, y, 11, 1);
        return;
      }
      const at = crush + i * .06;
      if (fx.age < at) {
        const k = (fx.age - PL_FLY) / PL_T, r = 14 + 62 * easeOut(k), cy = s.y - H;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x, cy, r * 2, '110,70,220', .4); ctx.globalCompositeOperation = 'source-over';
        spriteAt(ctx, rock, s.x, cy, r * 2, r * 2, time * .6 + i, Math.min(1, k * 3));
        orb(ctx, s.x, cy, Math.max(6, 12 - k * 6), 1 - k);
        for (let j = 0; j < 8; j++) {
          const ph = frac(time * 1.1 + hash(j * 2.3 + i * 5 + fx.seed)), a = hash(j * 5.9 + i) * TAU + time;
          const d = (PL_R + 60) * (1 - ph), x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d * .5 - (H * ph);
          spriteAt(ctx, chunkSpr(j % 3), x, y, 18, 18, time * 4 + j, .95);
        }
        return;
      }
      const ia = fx.age - at;
      if (ia < .6) {
        const e = easeIn(ia / .22), fall = Math.min(1, e);
        spriteAt(ctx, rock, s.x, s.y - H * (1 - fall) - 30, 152 * (1 - .3 * clamp01((ia - .22) / .3)), 152 * (1 - .3 * clamp01((ia - .22) / .3)), time * .6 + i, 1 - clamp01((ia - .25) / .35));
        if (ia > .2) {
          const q = (ia - .2) / .4;
          K.fx.shockRing(ctx, s.x, s.y, PL_R * 1.3, q, 1 - q, '200,170,255');
          K.fx.debris(ctx, s.x, s.y, PL_R * 1.2, q, fx.seed + i, '#4a3e34', 10);
        }
      }
      dustRing(ctx, s.x, s.y, PL_R * (.6 + .6 * easeOut(ia)), 9, 30, 1 - clamp01(ia / 1.2), fx.seed + i * 2, 16);
    });
  }

  // ---- Six Paths Chibaku Tensei sealing
  function chibakuG(ctx, fx, time) {
    const K = Kit(), T = fx.T, live = fx.age < T;
    const grow = easeOut(fx.age / .8), fade = live ? 1 : 1 - win(fx.age, T + 1.4, T + 2.3);
    groundSpr(ctx, sealSpr(), fx.x, fx.y, CB_R * (.55 + .45 * grow) * (live ? 1 : 1 + .08 * easeOut((fx.age - T) * 2)), time * .25, (live ? .5 + .3 * grow : .85) * fade);
    if (live) {
      const k = fx.age / T;
      streaks(ctx, fx.x, fx.y, CB_R + 80, 26, time * (1 + k), fx.seed, .55, '30,16,50');
      ctx.fillStyle = `rgba(10,4,20,${.12 + .3 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 80 + 180 * k, (80 + 180 * k) * .5, 0, 0, TAU); ctx.fill();
      cracks(ctx, fx.x, fx.y, CB_R * .8 * k, 14, fx.seed, .6 * k, 2.6);
    } else {
      crater(ctx, fx.x, fx.y, CB_CORE * .9, fade, fx.seed);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y, CB_R * .9, '255,200,110', .35 * (1 - clamp01((fx.age - T) / .8)), false, .5);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function chibakuO(ctx, fx, time) {
    const K = Kit(), T = fx.T, rock = rockSpr(), cx = fx.x, cy = fx.y - CB_H;
    if (fx.age < T) {
      const k = fx.age / T, rise = easeOut(fx.age / .6), coreY = fx.y - 60 - (CB_H - 60) * rise;
      // the black core thrown up from the staff
      if (fx.age < .6) {
        const q = fx.age / .6, x = fx.x0 + (cx - fx.x0) * q, y = fx.y0 - 100 + (coreY - fx.y0 + 100) * q;
        orb(ctx, x, y, 14, 1);
        return;
      }
      const r = 20 + 135 * easeOut((fx.age - .6) / (T - .6));
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx, coreY, r * 2.2, '110,60,230', .35 + .2 * k);
      ctx.globalCompositeOperation = 'source-over';
      K.glow(ctx, cx, coreY, r * 1.4, '10,4,24', .4);
      spriteAt(ctx, rock, cx, coreY, r * 2, r * 2, time * .35, Math.min(1, (fx.age - .6) * 2));
      if (r < 80) orb(ctx, cx, coreY, 14, 1 - r / 80);
      // ground slabs and rubble torn up and flying into the moon
      for (let j = 0; j < 22; j++) {
        const ph = frac(time * .7 + hash(j * 1.9 + fx.seed)), a = hash(j * 4.3 + fx.seed) * TAU;
        const d = (CB_R * (.4 + .6 * hash(j * 8.1))) * (1 - easeIn(ph)), x = cx + Math.cos(a) * d, y = fx.y + Math.sin(a) * d * .5 + (coreY - fx.y) * easeIn(ph);
        const sz = 14 + 22 * hash(j * 2.2);
        spriteAt(ctx, chunkSpr(j % 3), x, y, sz, sz, time * 3 + j, Math.min(1, (1 - ph) * 4));
      }
      for (let i = 0; i < 4; i++) {
        const q = frac(time * .8 + i / 4);
        inkRing(ctx, cx, coreY, r * (1.6 - .6 * q), q * .7, 3, '20,8,40', '190,160,255', .9);
      }
      return;
    }
    const a = fx.age - T;
    // crushing flash, the moon compressing, the seal bands blazing up into it
    if (a < 1.6) {
      const e = easeOut(a / .5), f = 1 - clamp01(a / 1.6), r = 155 * (1 - .25 * e);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx, cy, 420 * (.5 + e), '255,220,150', .9 * f, true);
      for (let i = 0; i < 6; i++) {
        const b = i * TAU / 6 + time * .25 + .26, bx = fx.x + Math.cos(b) * CB_R * .7, by = fx.y + Math.sin(b) * CB_R * .35;
        ctx.strokeStyle = `rgba(255,214,120,${.7 * f})`; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx + (bx - cx) * .2, cy + 40); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      spriteAt(ctx, rock, cx, cy - 160 * easeIn(clamp01((a - .5) / 1.1)), r * 2, r * 2, time * .35, f * 1.4);
      K.fx.shockRing(ctx, fx.x, fx.y, CB_R * 1.1, clamp01(a / .8), f, '255,214,120');
      if (a > .12) K.fx.shockRing(ctx, fx.x, fx.y, CB_R * .8, clamp01((a - .12) / .8), f, '200,170,255');
      K.fx.debris(ctx, fx.x, fx.y, CB_R * .9, a * .9, fx.seed, '#3a3028', 16);
    }
    dustRing(ctx, fx.x, fx.y, CB_R * (.5 + .5 * easeOut(a)), 16, 44, 1 - clamp01(a / 2), fx.seed + 5, 20);
  }

  // ================================================================== HAMURA
  // ---- Air Palm
  function palmG(ctx, fx, time) {
    const p = clamp01(fx.age / fx.T), d = 40 + (PALM_LEN - 40) * p, c = Math.cos(fx.a), s = Math.sin(fx.a), fade = 1 - win(fx.age, fx.T + .3, fx.dur);
    ctx.strokeStyle = `rgba(40,50,90,${.16 * fade})`; ctx.lineWidth = PALM_W * 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x + c * 40, fx.y + s * 40); ctx.lineTo(fx.x + c * d, fx.y + s * d); ctx.stroke();
    for (let k = 1; k < 6; k++) { const q = k / 6; if (q < p) dustRing(ctx, fx.x + c * PALM_LEN * q, fx.y + s * PALM_LEN * q, 50, 4, 20, fade * .7, fx.seed + k, 6); }
  }
  function palmO(ctx, fx, time) {
    const K = Kit(), L = LIFT() * 1.6, p = clamp01(fx.age / fx.T), c = Math.cos(fx.a), s = Math.sin(fx.a);
    const d = 40 + (PALM_LEN - 40) * p, hx = fx.x + c * d, hy = fx.y + s * d - L, fade = 1 - clamp01((fx.age - fx.T) / .5);
    if (fade <= 0) return;
    const sz = 150 + 60 * p;
    // air rings shed behind the palm
    for (let i = 0; i < 4; i++) {
      const q = clamp01(p - i * .12);
      if (q <= 0) continue;
      const rx = fx.x + c * (40 + (PALM_LEN - 40) * q), ry = fx.y + s * (40 + (PALM_LEN - 40) * q) - L;
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(fx.a); ctx.scale(.35, 1);
      ctx.strokeStyle = `rgba(20,40,100,${.35 * fade * (1 - i * .2)})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 50 + i * 12, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(235,245,255,${.8 * fade * (1 - i * .2)})`; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, hx, hy, sz * .9, '140,190,255', .5 * fade);
    ctx.globalCompositeOperation = 'source-over';
    spriteAt(ctx, palmSpr(0), hx, hy, sz * .83, sz, fx.a + Math.PI / 2, fade);
    if (fx.age > fx.T) {
      const q = (fx.age - fx.T) / .5;
      K.fx.shockRing(ctx, fx.x + c * PALM_LEN, fx.y + s * PALM_LEN, 190, q, 1 - q, '200,225,255');
    }
  }
  // ---- Vacuum Wall Palm
  function kuhekiG(ctx, fx, time) {
    const p = easeOut(fx.age / .4), fade = 1 - win(fx.age, .5, 1.2);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5);
    ctx.fillStyle = `rgba(30,40,80,${.14 * fade})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, KUH_LEN * p, fx.a - KUH_HALF, fx.a + KUH_HALF); ctx.closePath(); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const b = fx.a + (i / 5 - .5) * KUH_HALF * 1.8, d = KUH_LEN * p * (.85 + .1 * hash(i + fx.seed));
      dustRing(ctx, fx.x + Math.cos(b) * d, fx.y + Math.sin(b) * d, 20, 2, 22, fade * .8, fx.seed + i, 6);
    }
  }
  function kuhekiO(ctx, fx, time) {
    const K = Kit(), L = LIFT() * 1.2;
    for (let w = 0; w < 3; w++) {
      const q = clamp01((fx.age - w * .07) / .55);
      if (q <= 0 || q >= 1) continue;
      const r = 50 + (KUH_LEN - 50) * easeOut(q) * (.72 + w * .14), a = 1 - q * q;
      ctx.save(); ctx.translate(fx.x, fx.y - L * (1 - q * .6)); ctx.scale(1, .55);
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(16,30,80,${.5 * a})`; ctx.lineWidth = 22 - w * 4; ctx.beginPath(); ctx.arc(0, 0, r, fx.a - KUH_HALF, fx.a + KUH_HALF); ctx.stroke();
      ctx.strokeStyle = `rgba(225,240,255,${.95 * a})`; ctx.lineWidth = 10 - w * 2; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(120,180,255,${.6 * a})`; ctx.lineWidth = 26; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      if (w === 0) { ctx.fillStyle = `rgba(210,232,255,${.22 * a})`; ctx.beginPath(); ctx.arc(0, 0, r, fx.a - KUH_HALF, fx.a + KUH_HALF); ctx.arc(0, 0, Math.max(10, r - 90), fx.a + KUH_HALF, fx.a - KUH_HALF, true); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    if (fx.age < .3) {
      const c = Math.cos(fx.a), s = Math.sin(fx.a);
      spriteAt(ctx, palmSpr(0), fx.x + c * 50, fx.y + s * 50 - LIFT() * 1.5, 70, 84, fx.a + Math.PI / 2, 1 - fx.age / .3);
    }
    K.fx.debris(ctx, fx.x + Math.cos(fx.a) * KUH_LEN * .6, fx.y + Math.sin(fx.a) * KUH_LEN * .6, 200, fx.age * 1.2, fx.seed, '#4a4038', 8);
  }
  // ---- Rotation
  function kaitenG(ctx, fx, time, z) {
    const x = z ? z.x : fx.x, y = z ? z.y : fx.y, fade = 1 - win(fx.age, KAI_T, KAI_T + .5), grow = easeOut(fx.age / .2);
    ctx.fillStyle = `rgba(30,40,80,${.16 * fade})`; ctx.beginPath(); ctx.ellipse(x, y, KAI_R * grow, KAI_R * .5 * grow, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
    ctx.strokeStyle = `rgba(30,30,50,${.4 * fade})`; ctx.lineWidth = 3;
    ctx.beginPath(); for (let i = 0; i < 3; i++) { const a0 = i * TAU / 3 + time * 3; for (let k = 0; k <= 16; k++) { const a = a0 + k * .2, r = KAI_R * grow * (.2 + k / 16 * .8); k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } } ctx.stroke();
    ctx.restore();
    dustRing(ctx, x, y, KAI_R * grow, 10, 18, fade * .55, fx.seed + R0(time * 6), 6);
  }
  function kaitenO(ctx, fx, time, z) {
    const K = Kit(), x = z ? z.x : fx.x, y = z ? z.y : fx.y, fade = 1 - win(fx.age, KAI_T - .1, KAI_T + .4), grow = easeOut(fx.age / .2);
    if (fade <= 0) return;
    const r = KAI_R * grow * .82, cy = y - 10;
    // dome: a hemisphere of spinning chakra over the ground ring, lit rim and swept arcs
    ctx.save(); ctx.translate(x, cy);
    ctx.fillStyle = `rgba(40,70,140,${.12 * fade})`; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .5, 0, 0, Math.PI); ctx.ellipse(0, 0, r, r * .78, 0, Math.PI, TAU); ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(14,26,70,${.4 * fade})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .78, 0, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(235,245,255,${.9 * fade})`; ctx.lineWidth = 3.2; ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const ph = frac(time * 2.6 + i / 7), sx = Math.cos(ph * Math.PI) * r, w = Math.sin(ph * Math.PI);
      ctx.strokeStyle = `rgba(225,240,255,${.6 * fade * w})`; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(sx) + 1, r * .78, 0, sx >= 0 ? Math.PI * 1.5 : Math.PI, sx >= 0 ? TAU : Math.PI * 1.5); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    K.spin(ctx, kaitenSpr(), x, cy - r * .3, r * .95, time * 22, .32 * fade, .7);
    K.spin(ctx, kaitenSpr(), x, cy, r * .9, -time * 18, .28 * fade, .5);
    K.glow(ctx, x, cy - r * .3, r * .9, '120,180,255', .3 * fade, false, .8);
    ctx.globalCompositeOperation = 'source-over';
  }
  // ---- Eight Trigrams Sixty-Four Palms
  function sixtyG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .7, fx.dur), grow = easeOut(fx.age / .25);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, SF_R * 1.3, '120,170,255', .3 * fade, false, .5);
    ctx.globalCompositeOperation = 'source-over';
    groundSpr(ctx, trigramSpr(), fx.x, fx.y, SF_R * (.7 + .3 * grow), -fx.a + time * .15, .95 * fade);
    if ((fx.n || 0) >= SF_N) crater(ctx, fx.x, fx.y, 120, fade, fx.seed);
  }
  function sixtyO(ctx, fx, time) {
    const K = Kit(), L = LIFT() * 1.4, n = fx.n || 0, active = fx.age < .2 + SF_N * .12 + .1;
    if (active && fx.age > .15) {
      // palms flashing round the victim, every strike a chakra point lit up
      const tick = Math.floor(fx.age * 30);
      for (let i = 0; i < 6; i++) {
        const a = hash(tick * 1.7 + i * 3.1) * TAU, d = 30 + hash(tick + i) * 70, x = fx.x + Math.cos(a) * d, y = fx.y + Math.sin(a) * d * .5 - L - hash(i * 9 + tick) * 40;
        spriteAt(ctx, palmSpr(0), x, y, 34, 41, a + Math.PI / 2, .75);
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 18, '170,210,255', .9, true); ctx.globalCompositeOperation = 'source-over';
      }
      for (let j = 0; j < Math.min(16, n * 2); j++) {
        const x = fx.x + (hash(j * 4.1 + fx.seed) - .5) * 60, y = fx.y - L + (hash(j * 2.7 + fx.seed) - .5) * 70;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 7, '200,230,255', .95, true); ctx.globalCompositeOperation = 'source-over';
      }
      ctx.strokeStyle = 'rgba(235,245,255,.8)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = hash(tick * 2.3 + i) * TAU, r0 = 30, r1 = 80 + hash(i + tick) * 40; ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y - L + Math.sin(a) * r0 * .6); ctx.lineTo(fx.x + Math.cos(a) * r1, fx.y - L + Math.sin(a) * r1 * .6); }
      ctx.stroke();
    }
    if (n >= SF_N) {
      const q = clamp01((fx.age - .2 - (SF_N - 1) * .12) / .6);
      if (q < 1) {
        K.fx.shockRing(ctx, fx.x, fx.y, SF_R * 1.1, q, 1 - q, '190,220,255');
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - L, 140 * (1 - q * .5), '200,230,255', 1 - q, true); ctx.globalCompositeOperation = 'source-over';
        dustRing(ctx, fx.x, fx.y, SF_R * (.5 + .5 * q), 10, 28, 1 - q, fx.seed, 10);
      }
    }
  }
  // ---- Tenseigan Truth-Seeking Balls
  function htsbG(ctx, fx, time) {
    fx.spots.forEach((s, i) => {
      const f = fx.age - s.t;
      if (f < 0) return;
      if (f < .3) { ctx.fillStyle = `rgba(10,20,50,${.15 + f})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 30 + 120 * f, (30 + 120 * f) * .5, 0, 0, TAU); ctx.fill(); return; }
      const ia = f - .3;
      crater(ctx, s.x, s.y, TSB_R * .6, 1 - win(ia, .7, 1.2), fx.seed + i);
    });
  }
  function htsbO(ctx, fx, time) {
    const K = Kit(), L = LIFT() * 1.6, n = fx.spots.length;
    fx.spots.forEach((s, i) => {
      const f = fx.age - s.t;
      // orbit beside Hamura before launch
      const a0 = i / n * TAU + fx.age * 4, ox = fx.x0 + Math.cos(a0) * 60, oy = fx.y0 - L - 40 + Math.sin(a0) * 24;
      if (f < 0) { gorb(ctx, ox, oy - (1 - clamp01(fx.age / .3)) * 30, 10, clamp01(fx.age / .2)); return; }
      if (f < .3) {
        const k = easeIn(f / .3), x = ox + (s.x - ox) * k, y = oy + (s.y - oy) * k - Math.sin(Math.PI * k) * 60;
        ctx.strokeStyle = 'rgba(255,220,140,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ox + (s.x - ox) * k * .6, oy + (s.y - oy) * k * .6); ctx.lineTo(x, y); ctx.stroke();
        gorb(ctx, x, y, 11, 1);
        return;
      }
      const ia = f - .3;
      if (ia < .5) {
        const e = easeOut(ia / .5);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, s.x, s.y - 20, TSB_R * 1.6 * (1 - .4 * e), '255,220,130', 1 - e, true);
        K.glow(ctx, s.x, s.y, TSB_R * 1.8, '80,160,255', .5 * (1 - e), false, .5);
        ctx.globalCompositeOperation = 'source-over';
        inkRing(ctx, s.x, s.y, 30 + TSB_R * 1.2 * e, 1 - e, 5, '10,20,60', '255,220,140');
        K.fx.debris(ctx, s.x, s.y, TSB_R, ia * 1.6, fx.seed + i, '#2a2a3a', 7);
      }
      dustRing(ctx, s.x, s.y, TSB_R * (.7 + .5 * easeOut(ia * 1.5)), 6, 22, 1 - clamp01(ia), fx.seed + i * 4, 12);
    });
  }
  // ---- Golden Wheel Reincarnation Explosion
  function kinrinG(ctx, fx, time) {
    const K = Kit(), a = fx.age - KIN_DROP;
    if (a < 0) { ctx.fillStyle = `rgba(30,20,0,${.15 + fx.age})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 60 + 200 * fx.age / KIN_DROP, (60 + 200 * fx.age / KIN_DROP) * .5, 0, 0, TAU); ctx.fill(); return; }
    const fade = 1 - win(a, 1.8, 2.8);
    crater(ctx, fx.x, fx.y, KIN_CORE * 1.05, fade, fx.seed);
    // molten golden fissures
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,190,70,${.7 * fade * (1 - clamp01(a / 2.6) * .6)})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      let b = i * TAU / 14 + hash(i + fx.seed) * .4, x = fx.x + Math.cos(b) * 60, y = fx.y + Math.sin(b) * 30;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { b += (hash(i * 3 + k) - .5) * .6; x += Math.cos(b) * KIN_R * .14; y += Math.sin(b) * KIN_R * .07; ctx.lineTo(x, y); }
    }
    ctx.stroke();
    K.glow(ctx, fx.x, fx.y, KIN_R * 1.05, '255,190,80', .32 * (1 - clamp01(a / 1.2)), false, .5);
    ctx.globalCompositeOperation = 'source-over';
  }
  function kinrinO(ctx, fx, time) {
    const K = Kit(), a = fx.age - KIN_DROP;
    if (a < 0) {
      // the golden sphere falls from Hamura's raised hands onto the target
      const k = easeIn(fx.age / KIN_DROP), x = fx.x0 + (fx.x - fx.x0) * k, y = (fx.y0 - 260) + (fx.y - 40 - fx.y0 + 260) * k;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y, 140, '255,210,110', .9, true);
      K.glow(ctx, x, y, 240, '90,160,255', .35);
      ctx.globalCompositeOperation = 'source-over';
      gorb(ctx, x, y, 34, 1);
      return;
    }
    if (a < 1.4) {
      const e = easeOut(a / .7), f = 1 - clamp01(a / 1.4);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - 60, KIN_R * (.3 + .45 * e), '255,236,180', .75 * f, true);
      K.glow(ctx, fx.x, fx.y, KIN_R * (.6 + .6 * e), '80,150,255', .45 * f, false, .55);
      ctx.globalCompositeOperation = 'source-over';
      // the dome of the blast and the golden wheel rings racing out
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .55);
      ctx.strokeStyle = `rgba(90,40,0,${.45 * f})`; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(0, 0, KIN_R * e, Math.PI, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,236,170,${.95 * f})`; ctx.lineWidth = 6; ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 3; i++) { const q = clamp01((a - i * .12) / .8); if (q > 0 && q < 1) K.fx.shockRing(ctx, fx.x, fx.y, KIN_R * (1.05 + i * .1), q, 1 - q, i === 1 ? '120,180,255' : '255,210,110'); }
      groundSpr(ctx, wheelSpr(), fx.x, fx.y, KIN_R * .5 * (.6 + .6 * e), time * 2, f * .9);
      K.fx.debris(ctx, fx.x, fx.y, KIN_R * .8, a * .9, fx.seed, '#3a3028', 18);
    }
    dustRing(ctx, fx.x, fx.y, KIN_R * (.5 + .45 * easeOut(a * .8)), 18, 46, 1 - clamp01(a / 2.4), fx.seed + 2, 24);
  }

  // ================================================================== ASHURA
  function rasG(ctx, fx, time) {
    const p = clamp01(fx.age / fx.T), c = Math.cos(fx.a), s = Math.sin(fx.a), fade = 1 - win(fx.age, fx.T + .8, fx.dur);
    ctx.strokeStyle = `rgba(30,40,80,${.2 * fade})`; ctx.lineWidth = RAS_W; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x0 + c * fx.len * p, fx.y0 + s * fx.len * p); ctx.stroke();
    if (fx.age > fx.T) {
      crater(ctx, fx.ex, fx.ey, RAS_END * .75, fade, fx.seed);
      ctx.save(); ctx.translate(fx.ex, fx.ey); ctx.scale(1, .5);
      ctx.strokeStyle = `rgba(30,40,80,${.45 * fade})`; ctx.lineWidth = 3;
      ctx.beginPath(); for (let i = 0; i < 4; i++) { const a0 = i * TAU / 4 + fx.seed; for (let k = 0; k <= 14; k++) { const a = a0 + k * .22, r = RAS_END * (.15 + k / 14 * .75); k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } } ctx.stroke();
      ctx.restore();
    }
  }
  function rasO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT() * 1.4;
    if (fx.age < fx.T && z) {
      const f = faceOf(z), x = z.x + Math.cos(fx.a) * 26, y = z.y - L + Math.sin(fx.a) * 10;
      for (let i = 1; i <= 3; i++) Spr()?.draw(ctx, 'ashura', z.x - Math.cos(fx.a) * i * 40, z.y + 3 - Math.sin(fx.a) * i * 40, { facing: f, frame: 'attack', alpha: .35 - i * .09, flash: .6 });
      ctx.save(); ctx.translate(x, y); K.fx.rasenganOrb(ctx, 26, time, 1); ctx.restore();
      return;
    }
    const a = fx.age - fx.T;
    if (a < .9) {
      const e = easeOut(a / .35), f = 1 - clamp01(a / .9);
      ctx.save(); ctx.translate(fx.ex, fx.ey - 30); K.fx.rasenganOrb(ctx, 30 + 66 * e * (1 - .5 * clamp01((a - .4) / .5)), time, f * 1.2); ctx.restore();
      K.fx.shockRing(ctx, fx.ex, fx.ey, RAS_END * 1.3, clamp01(a / .6), f, '150,200,255');
      K.fx.debris(ctx, fx.ex, fx.ey, RAS_END, a * 1.2, fx.seed, '#3a3430', 12);
    }
    dustRing(ctx, fx.ex, fx.ey, RAS_END * (.6 + .5 * easeOut(a)), 10, 30, 1 - clamp01(a / 1.2), fx.seed + 1, 14);
  }
  // ---- Thousand chakra fists
  function fistsG(ctx, fx, time) {
    fx.spots.forEach((s, i) => {
      const ia = fx.age - s.t - .12;
      if (ia < 0) return;
      cracks(ctx, s.x, s.y, 70, 6, fx.seed + i, 1 - win(ia, .5, 1), 2);
    });
  }
  function fistsO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT() * 1.5, img = fistSpr();
    const ox = z ? z.x : fx.x, oy = (z ? z.y : fx.y) - L;
    if (fx.age < FI_N * .055 + .2) {
      // the fan of chakra arms thrown from his back
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, ox, oy - 10, 110, '255,170,60', .45);
      ctx.globalCompositeOperation = 'source-over';
    }
    fx.spots.forEach((s, i) => {
      const f = (fx.age - s.t) / .12;
      if (f < 0) return;
      if (f < 1) {
        const x = ox + (s.x - ox) * f, y = oy + (s.y - L * .5 - oy) * f, a = Math.atan2(s.y - oy, s.x - ox);
        ctx.strokeStyle = 'rgba(120,50,0,.45)'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,214,130,.7)'; ctx.lineWidth = 6; ctx.stroke();
        spriteAt(ctx, img, x, y, 56, 56, a, 1);
        return;
      }
      const ia = (f - 1) * .12;
      if (ia < .35) {
        const e = ia / .35;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x, s.y - 16, 70 * (1 - e * .5), '255,200,110', 1 - e, true); ctx.globalCompositeOperation = 'source-over';
        spriteAt(ctx, img, s.x, s.y - L * .5, 56 * (1 + e * .3), 56 * (1 + e * .3), Math.atan2(s.y - oy, s.x - ox), 1 - e);
        inkRing(ctx, s.x, s.y, 20 + 80 * easeOut(e), 1 - e, 4, '80,30,0', '255,210,120');
      }
      dustRing(ctx, s.x, s.y, 40 + 30 * clamp01(ia * 2), 4, 20, 1 - clamp01(ia / .8), fx.seed + i, 10);
    });
  }
  // ---- Wood Release roots
  function rootPos(fx, i) { return fx.pts[i]; }
  function rootsG(ctx, fx, time) {
    const n = fx.pts.length - 1, fade = 1 - win(fx.age, fx.dur - .8, fx.dur), reachN = Math.min(n, Math.ceil(fx.age / fx.T * n));
    ctx.strokeStyle = `rgba(40,22,10,${.5 * fade})`; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(fx.pts[0][0], fx.pts[0][1]);
    for (let i = 1; i <= reachN; i++) ctx.lineTo(fx.pts[i][0], fx.pts[i][1]);
    ctx.stroke();
    for (let i = 1; i <= reachN; i++) { const p = rootPos(fx, i); cracks(ctx, p[0], p[1], 60, 5, fx.seed + i, fade * .7, 2); }
  }
  function rootsO(ctx, fx, time) {
    const n = fx.pts.length - 1, fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    for (let i = 1; i <= n; i++) {
      const t0 = i / n * fx.T, g = clamp01((fx.age - t0) / .16);
      if (g <= 0) continue;
      const p = fx.pts[i], q = fx.pts[i - 1], nx = -(p[1] - q[1]), ny = p[0] - q[0], nl = Math.hypot(nx, ny) || 1;
      for (const sd of [-1, 1]) {
        const off = sd * (18 + 14 * hash(i * 3 + sd + fx.seed)), x = p[0] + nx / nl * off, y = p[1] + ny / nl * off * .5;
        const h = (80 + 50 * hash(i * 7 + sd)) * easeOut(g) * (1 - .25 * (1 - fade)), w = h * .6;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); ctx.drawImage(rootSpr((i + (sd > 0 ? 1 : 0)) % 3), -w / 2, -h * .97, w, h); ctx.restore();
      }
      if (g < 1) Kit().fx.debris(ctx, p[0], p[1], 60, g, fx.seed + i, '#5a3a1c', 5);
    }
  }
  // ---- Sage Art ground slam
  function slamG(ctx, fx, time) {
    if (fx.age < fx.T) { const k = fx.age / fx.T; ctx.fillStyle = `rgba(30,20,10,${.15 + .3 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 30 + 40 * k, (30 + 40 * k) * .5, 0, 0, TAU); ctx.fill(); return; }
    const a = fx.age - fx.T, fade = 1 - win(a, .9, 1.6);
    crater(ctx, fx.x, fx.y, SLAM_R * .7, fade, fx.seed);
  }
  function slamO(ctx, fx, time) {
    const K = Kit();
    if (fx.age < fx.T) return;
    const a = fx.age - fx.T;
    if (a < .9) {
      const f = 1 - clamp01(a / .9);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 20, SLAM_R * (1 - .4 * f), '255,190,90', f, true); ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 2; i++) { const q = clamp01((a - i * .1) / .6); if (q > 0 && q < 1) K.fx.shockRing(ctx, fx.x, fx.y, SLAM_R * (1.15 + i * .2), q, 1 - q, i ? '255,240,200' : '255,170,70'); }
      // rock slabs heaved up round the impact
      for (let i = 0; i < 10; i++) {
        const b = i * TAU / 10 + hash(i + fx.seed) * .3, d = SLAM_R * (.55 + .2 * hash(i * 3)), up = bell(clamp01(a / .7)) * (30 + 30 * hash(i * 5));
        spriteAt(ctx, chunkSpr(i % 3), fx.x + Math.cos(b) * d, fx.y + Math.sin(b) * d * .5 - up, 34, 30, b + .4, f * 1.3);
      }
      K.fx.debris(ctx, fx.x, fx.y, SLAM_R * 1.1, a * 1.2, fx.seed, '#4a3a2c', 14);
    }
    dustRing(ctx, fx.x, fx.y, SLAM_R * (.6 + .5 * easeOut(a)), 14, 34, 1 - clamp01(a / 1.4), fx.seed + 2, 14);
  }
  // ---- Giant chakra hands
  function handsG(ctx, fx, time) {
    fx.spots.forEach((s, i) => {
      const t0 = .3 + i * .22, k = fx.age / t0;
      if (k < 1) { ctx.fillStyle = `rgba(40,20,0,${.12 + .3 * k})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, HAND_R * .5 * k + 20, (HAND_R * .5 * k + 20) * .5, 0, 0, TAU); ctx.fill(); return; }
      crater(ctx, s.x, s.y, HAND_R * .7, 1 - win(fx.age - t0, 1, 1.6), fx.seed + i);
    });
  }
  function handsO(ctx, fx, time) {
    const K = Kit(), img = palmSpr(1);
    fx.spots.forEach((s, i) => {
      const t0 = .3 + i * .22, k = fx.age / t0;
      if (k < 1) {
        const h = 520 * (1 - easeIn(k)), sz = 230;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x, s.y - h - 80, 170, '255,180,70', .35 * Math.min(1, k * 3)); ctx.globalCompositeOperation = 'source-over';
        spriteAt(ctx, img, s.x, s.y - h - 60, sz * .83, sz, i ? .15 : -.15, Math.min(1, k * 3));
        return;
      }
      const a = fx.age - t0;
      if (a < .7) {
        const f = 1 - a / .7;
        spriteAt(ctx, img, s.x, s.y - 60, 190 * (1 + (1 - f) * .2), 230 * (1 - (1 - f) * .3), i ? .15 : -.15, f);
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x, s.y - 30, HAND_R * 1.1, '255,200,110', .6 * f, true); ctx.globalCompositeOperation = 'source-over';
        K.fx.shockRing(ctx, s.x, s.y, HAND_R * 1.3, 1 - f, f, '255,190,90');
        K.fx.debris(ctx, s.x, s.y, HAND_R, a * 1.4, fx.seed + i, '#4a3a2c', 10);
      }
      dustRing(ctx, s.x, s.y, HAND_R * (.6 + .5 * easeOut(a)), 10, 30, 1 - clamp01(a / 1.2), fx.seed + i * 3, 14);
    });
  }
  // ---- Asura thousand-armed avatar barrage
  function avatarAt(ctx, x, y, a, time, s = 1) {
    const K = Kit(), w = AV_W * .6 * s, h = AV_H * .6 * s, bob = Math.sin(time * 2.2) * 6;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - h * .55 + bob, h * .75, '255,160,50', .4 * a);
    ctx.globalCompositeOperation = 'source-over';
    spriteAt(ctx, avatarSpr(), x, y + 16 + bob, w, h, 0, a, .5, 1);
    const fire = K.puff('fire');
    for (let i = 0; i < 6; i++) { const ph = frac(time * .9 + i / 6), xx = x + (hash(i * 2.2) - .5) * w * .5; K.stamp(ctx, fire, xx, y - ph * h * .5, 26 * (1 - ph), .5 * a * (1 - ph)); }
  }
  function asuraG(ctx, fx, time, z) {
    const live = fx.age < fx.T + .4, fade = live ? Math.min(1, fx.age * 3) : 1 - clamp01((fx.age - fx.T - .4) / .8);
    if (fade > .01) avatarAt(ctx, z ? z.x : fx.x0, (z ? z.y : fx.y0) - 30, fade * .95, time);
    for (const h of fx.hits) { const ia = fx.age - h[2]; if (ia < 1.2) cracks(ctx, h[0], h[1], 80, 6, h[3] * 7 + fx.seed, 1 - ia / 1.2, 2); }
    if (fx.boom) crater(ctx, fx.x, fx.y, 260, 1 - win(fx.age, fx.T + 1.2, fx.dur), fx.seed);
  }
  function asuraO(ctx, fx, time, z) {
    const K = Kit(), img = fistSpr(), ax = z ? z.x : fx.x0, ay = (z ? z.y : fx.y0) - 260;
    for (const h of fx.hits) {
      const ia = fx.age - h[2];
      if (ia > .8) continue;
      if (ia < .1) {
        const k = ia / .1, x = ax + (h[0] - ax) * (.6 + .4 * k), y = ay + (h[1] - 40 - ay) * (.6 + .4 * k), a = Math.atan2(h[1] - ay, h[0] - ax);
        ctx.strokeStyle = 'rgba(120,50,0,.4)'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax + (h[0] - ax) * .45, ay + (h[1] - ay) * .45); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,210,120,.75)'; ctx.lineWidth = 8; ctx.stroke();
        spriteAt(ctx, img, x, y, 84, 84, a, 1);
        continue;
      }
      const e = (ia - .1) / .7;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, h[0], h[1] - 20, 110 * (1 - e * .5), '255,190,90', 1 - e, true); ctx.globalCompositeOperation = 'source-over';
      if (e < .4) spriteAt(ctx, img, h[0], h[1] - 40, 84, 84, Math.atan2(h[1] - ay, h[0] - ax), 1 - e / .4);
      inkRing(ctx, h[0], h[1], 30 + 100 * easeOut(e), 1 - e, 4, '80,30,0', '255,200,110');
      dustRing(ctx, h[0], h[1], 60 + 40 * e, 5, 24, 1 - e, h[3] + fx.seed, 10);
    }
    const a = fx.age - fx.T - .12;
    if (a > -.3 && a < 1.4) {
      // the two biggest fists drop together on the centre
      if (a < 0) {
        const k = 1 + a / .3;
        for (const sd of [-1, 1]) spriteAt(ctx, img, fx.x + sd * 70 * (1 - k * .6), fx.y - 380 * (1 - k) - 60, 190, 190, Math.PI / 2 + sd * .3, 1);
      } else {
        const e = easeOut(a / .6), f = 1 - clamp01(a / 1.4);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x, fx.y - 60, 420 * (.5 + e), '255,214,140', f, true);
        ctx.globalCompositeOperation = 'source-over';
        if (a < .4) for (const sd of [-1, 1]) spriteAt(ctx, img, fx.x + sd * 28, fx.y - 60, 190, 190, Math.PI / 2 + sd * .3, 1 - a / .4);
        for (let i = 0; i < 3; i++) { const q = clamp01((a - i * .12) / .8); if (q > 0 && q < 1) K.fx.shockRing(ctx, fx.x, fx.y, ASU_R * (1 + i * .12), q, 1 - q, i === 1 ? '255,240,200' : '255,170,70'); }
        K.fx.debris(ctx, fx.x, fx.y, ASU_R * .8, a * .9, fx.seed, '#4a3a2c', 18);
        dustRing(ctx, fx.x, fx.y, ASU_R * (.5 + .45 * easeOut(a)), 16, 44, f, fx.seed + 4, 20);
      }
    }
  }

  // ================================================================== windup visuals
  function windupG(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, z.y, 70 + 50 * k, rgb, .25 + .25 * k, false, .5);
    ctx.globalCompositeOperation = 'source-over';
    if (st.move === 'sixtyfour' && st.spots) groundSpr(ctx, trigramSpr(), st.spots[0].x, st.spots[0].y, SF_R * .95, time * .3, .3 + .45 * k);
    if (st.move === 'chibaku' && st.spots) groundSpr(ctx, sealSpr(), st.spots[0].x, st.spots[0].y, CB_R * (.3 + .3 * k), -time * .4, .25 + .35 * k);
    if (st.move === 'yinyang' && st.spots) groundSpr(ctx, taijiSpr(), st.spots[0].x, st.spots[0].y, YY_R * .3 * k, time * 3, .6 * k);
    if (st.move === 'asura') avatarAt(ctx, z.x, z.y - 30, easeIn(k) * .85, time, .7 + .3 * easeOut(k));
    if (st.move === 'kaiten' || st.move === 'shinra') dustRing(ctx, z.x, z.y, 60 + 40 * k, 8, 16, .5 * k, R0(time * 5), 6);
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, f = faceOf(z), lift = bodyLift(z), m = members[z.bossId];
    const sc = m.scale, chestY = z.y - lift - 26 * sc, handX = z.x + f * 12 * sc, handY = z.y - lift - 32 * sc;
    switch (st.move) {
      case 'spear': case 'rain': case 'planet': {
        // Truth-Seeking Balls gathering at the staff head
        const sx = z.x + f * 4, sy = z.y - lift - 92;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, sx, sy, 50 + 40 * k, '150,120,255', .5 * k); ctx.globalCompositeOperation = 'source-over';
        const n = st.move === 'spear' ? SP_N : st.move === 'rain' ? 4 : PL_N;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + time * 5, r = 40 * (1 - k) + 16; orb(ctx, sx + Math.cos(a) * r, sy + Math.sin(a) * r * .6, 7, .4 + .6 * k); }
        break;
      }
      case 'shinra': {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, chestY, 60 + 90 * k, '200,180,255', .6 * k, true);
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 3; i++) { const q = frac(time * 2 + i / 3); inkRing(ctx, z.x, chestY, (120 - 100 * q) * (.5 + k), q * k, 3, '20,10,50', '220,200,255', .8); }
        break;
      }
      case 'yinyang': case 'chibaku': {
        const sx = z.x + f * 4, sy = z.y - lift - 96;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, sx, sy, 70 + 80 * k, st.move === 'chibaku' ? '255,214,130' : '255,240,200', .6 * k, true); ctx.globalCompositeOperation = 'source-over';
        orb(ctx, sx, sy - 10, 8 + 10 * k, 1);
        if (st.move === 'chibaku') for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - time * 3, r = 70 * (1 - k) + 24; orb(ctx, sx + Math.cos(a) * r, sy + Math.sin(a) * r * .5, 6, k); }
        break;
      }
      case 'palm': case 'kuheki': case 'sixtyfour': case 'tsb': {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, handX + f * 8, handY, 26 + 30 * k, '150,200,255', .5 + .4 * k, true);
        ctx.globalCompositeOperation = 'source-over';
        if (st.move === 'tsb') for (let i = 0; i < TSB_N; i++) { const a = i / TSB_N * TAU + time * 4; gorb(ctx, z.x + Math.cos(a) * 60, chestY - 30 + Math.sin(a) * 24, 9, k); }
        // Byakugan veins flare: thin lines about the head
        ctx.strokeStyle = `rgba(120,110,200,${.6 * k})`; ctx.lineWidth = 1.5;
        const hy = z.y - lift - 48 * m.scale;
        ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i - 1.5) * .5; ctx.moveTo(z.x + Math.cos(a) * 14, hy + Math.sin(a) * 14); ctx.lineTo(z.x + Math.cos(a) * 24, hy + Math.sin(a) * 24); } ctx.stroke();
        break;
      }
      case 'kaiten': {
        ctx.globalCompositeOperation = 'lighter'; K.spin(ctx, kaitenSpr(), z.x, z.y - 40, 60 + 80 * k, time * 14, .5 * k, .62); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'kinrin': {
        const sx = z.x, sy = z.y - lift - 150;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, sx, sy, 80 + 120 * k, '255,210,110', .8 * k, true);
        K.glow(ctx, sx, sy, 200 + 120 * k, '80,150,255', .35 * k);
        ctx.globalCompositeOperation = 'source-over';
        gorb(ctx, sx, sy, 10 + 26 * k, 1);
        for (let i = 0; i < 10; i++) { const ph = frac(time * 1.2 + i / 10), a = i / 10 * TAU; gorb(ctx, sx + Math.cos(a) * 160 * (1 - ph), sy + Math.sin(a) * 80 * (1 - ph), 5, ph * k); }
        break;
      }
      case 'rasengan': {
        const x = z.x + f * 22, y = z.y - LIFT() * 1.4;
        ctx.save(); ctx.translate(x, y); K.fx.rasenganOrb(ctx, 8 + 18 * k, time, 1); ctx.restore();
        break;
      }
      case 'fists': case 'hands': case 'slam': case 'roots': case 'asura': {
        const fire = K.puff('fire');
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, chestY, 50 + 60 * k, st.move === 'roots' ? '180,220,120' : '255,170,60', .5 * k);
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 6; i++) { const ph = frac(time * 1.6 + i / 6), a = i / 6 * TAU; K.stamp(ctx, fire, z.x + Math.cos(a) * 20, z.y - lift - ph * 90, 12 * (1 - ph) + 4, .5 * k * (1 - ph)); }
        if (st.move === 'roots') for (let i = 0; i < 3; i++) spriteAt(ctx, rootSpr(i), z.x + (i - 1) * 26, z.y + 6, 30 * k, 50 * k, 0, k, .5, .97);
        break;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Passive auras: Hamura's Tenseigan chakra mode, Ashura's Six Paths Senjutsu flare.
  function auraG(ctx, z, st, time) {
    const K = Kit();
    if (z.bossId === 'hamura' && st.tense > .02) {
      const lift = bodyLift(z), t = st.tense;
      groundSpr(ctx, wheelSpr(), z.x, z.y - lift - 2, 46 + 10 * t, time * 1.2, .45 * t);
      // the golden wheel halo upright behind his head
      spriteAt(ctx, wheelSpr(), z.x - faceOf(z) * 4, z.y - lift - 86, 72, 72, time * .8, .9 * t);
    }
  }
  function auraO(ctx, z, st, time) {
    const K = Kit();
    if (z.bossId === 'hamura' && st.tense > .02) {
      const t = st.tense, cy = z.y - 50;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, cy, 70, '255,210,110', .32 * t);
      K.glow(ctx, z.x, cy, 110, '70,140,255', .2 * t);
      ctx.globalCompositeOperation = 'source-over';
      const fire = K.puff('fire');
      for (let i = 0; i < 4; i++) { const ph = frac(time * 1.4 + i / 4), x = z.x + (hash(i * 1.3) - .5) * 40; K.stamp(ctx, fire, x, z.y - 20 - ph * 80, 9 * (1 - ph) + 3, .35 * t * (1 - ph)); }
    } else if (z.bossId === 'ashura' && st.tense > .02) {
      const t = st.tense;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, z.y - 44, 64, '255,160,50', .35 * t);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function label(ctx, z, st) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (!move || !MOVES[move]) return;
    const S = Spr(), top = z.y - bodyLift(z) - (S && S.height ? S.height(z.bossId) : 100) - 42;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#120c16'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = z.bossId === 'hagoromo' ? '#efe4ff' : z.bossId === 'hamura' ? '#dcecff' : '#ffe2b8'; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.tense = Math.max(0, st.tense - dt * 2);
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  const FX = {
    spear: [spearG, spearO], rain: [rainG, rainO], shinra: [shinraG, shinraO], yinyang: [yyG, yyO], planet: [planetG, planetO], chibaku: [chibakuG, chibakuO],
    palm: [palmG, palmO], kuheki: [kuhekiG, kuhekiO], kaiten: [kaitenG, kaitenO], sixty: [sixtyG, sixtyO], htsb: [htsbG, htsbO], kinrin: [kinrinG, kinrinO],
    ras: [rasG, rasO], fists: [fistsG, fistsO], roots: [rootsG, rootsO], slam: [slamG, slamO], hands: [handsG, handsO], asura: [asuraG, asuraO]
  };

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.sg;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    const alive = z.health > 0;
    if (!st.fx.length && !(st.windup > 0) && !(alive && (z.bossId === 'hagoromo' || st.tense > .02))) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, alive ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (alive) {
      if (st.windup > 0 && st.move) {
        drawTele(ctx, z, st, time);
        windupG(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      auraG(ctx, z, st, time);
      if (z.bossId === 'hagoromo') drawHalo(ctx, z, st, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.sg;
    if (!m || !st || !Kit()) return;
    ctx.save();
    const alive = z.health > 0;
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, alive ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (alive) {
      auraO(ctx, z, st, time);
      if (st.windup > 0 && st.move) windupO(ctx, z, st, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      label(ctx, z, st);
    }
    ctx.restore();
  }
  // Hagoromo floats; Ashura flies through the air on his Sage Art slam.
  function bodyLift(z) {
    const st = z.sg;
    if (z.bossId === 'hagoromo') return 14 + Math.sin(((st && st.t) || 0) * 1.8) * 4;
    if (z.bossId === 'ashura' && st && st.leap) return Math.sin(Math.PI * clamp01(st.leap.t / st.leap.T)) * 150;
    return 0;
  }

  // ================================================================== sprites
  function registerSprites() {
    const AS = window.AnimeSprites;
    if (!AS || !AS.kit || !AS.addSprite) return;
    const K = AS.kit;
    const { paint, line, dot, ell, dark, SHADE, horns, locks, sweptHair, maneDrape, fringeShadow, tomoe, HAIR, smooth } = K;

    // Hagoromo's shakujō: a black staff with gold bands and a ring head hung with small rings.
    function shakujo(ctx, pose, hand, O, held) {
      const hx = hand[0], hy = hand[1];
      let a = -Math.PI / 2 - .06, below = 20, above = 33;
      if (pose.attack) { a = -.42; below = 14; above = 28; }
      else if (held) { a = -Math.PI / 2 + (pose.raise ? .05 : pose.seal ? .1 : .04); below = pose.raise ? 12 : 22; above = pose.raise ? 36 : 32; }
      const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
      const bx = hx - ux * below, by = hy - uy * below, tx = hx + ux * above, ty = hy + uy * above;
      line(ctx, [[bx, by], [tx, ty]], O, 2.2);
      line(ctx, [[bx, by], [tx, ty]], '#2c2834', 1.35);
      line(ctx, [[bx + nx * .35, by + ny * .35], [tx + nx * .35, ty + ny * .35]], 'rgba(200,190,235,.5)', .35);
      for (const k of [.15, .55, .86]) { const x = bx + (tx - bx) * k, y = by + (ty - by) * k; line(ctx, [[x - nx * .9, y - ny * .9], [x + nx * .9, y + ny * .9]], '#d0a64a', .7); }
      const rx = tx + ux * 3.6, ry = ty + uy * 3.6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = O; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(rx, ry, 3.8, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#e0b85a'; ctx.lineWidth = .85; ctx.stroke();
      line(ctx, [[tx, ty], [rx + ux * 4.6, ry + uy * 4.6]], '#e0b85a', .7);
      for (const s of [-1, 1]) {
        const cx = rx + nx * s * 3.8 + ux * .8, cy = ry + ny * s * 3.8 + uy * .8;
        ctx.strokeStyle = '#e0b85a'; ctx.lineWidth = .5; ctx.beginPath(); ctx.arc(cx, cy, 1.1, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + nx * s * .6 - ux * 1.6, cy + ny * s * .6 - uy * 1.6, .9, 0, Math.PI * 2); ctx.stroke();
      }
    }

    function hagoromoSpec() {
      const O = '#1b1722', HAIRC = '#e3dfd9', ROBE = '#f2efe7', ROBE_D = '#c9c2b6', INK = '#16141b', INNER = '#34303f';
      return {
        outline: O, skin: '#ecdcd0', skinShade: '#bca49c', bulk: .6, noLegs: true,
        arms: { upper: ROBE, lower: ROBE, w1: 6.2, w2: 7.6, cuff: ROBE_D },
        torso: {
          base: ROBE, paint: ctx => {
            ctx.fillStyle = INNER; ctx.beginPath(); ctx.moveTo(.6, -13.6); ctx.lineTo(6.8, -13.6); ctx.lineTo(4.1, -6.2); ctx.closePath(); ctx.fill();
            line(ctx, [[.6, -13.6], [4.1, -6.2], [6.2, -1]], O, .5);
            line(ctx, [[1.1, -13.4], [4.4, -6.6]], 'rgba(255,255,255,.7)', .3);
            ctx.strokeStyle = 'rgba(110,100,120,.4)'; ctx.lineWidth = .38;
            for (const [x0, x1] of [[-3.4, -4.2], [-.4, .6], [7.2, 6.6]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .7, -6, x1, -2.6); ctx.stroke(); }
            ctx.fillStyle = INK; ctx.fillRect(-9, -3.8, 19, 3.2);
            ctx.fillStyle = 'rgba(190,180,230,.35)'; ctx.fillRect(-9, -3.8, 19, .5);
            ctx.fillStyle = '#2c2834'; ctx.fillRect(2.2, -3.6, 2.6, 2.8);
          }
        },
        skirt: {
          color: ROBE, hem: -1.2, flare: 3.4, opening: false, paint: (ctx, hem, hipY) => {
            ctx.fillStyle = INK; ctx.fillRect(-26, hem - 2.4, 52, 2.6);
            ctx.fillStyle = ROBE_D; ctx.fillRect(-26, hem - 3.3, 52, .7);
            ctx.strokeStyle = 'rgba(110,100,120,.42)'; ctx.lineWidth = .4;
            for (const x of [-7, -2.6, 2, 6]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.quadraticCurveTo(x - .8, (hipY + hem) / 2, x - 1.6, hem - 2); ctx.stroke(); }
            // the Rinnegan ripple and a row of magatama woven along the hem
            ctx.strokeStyle = 'rgba(60,50,80,.5)'; ctx.lineWidth = .4;
            for (const r of [2.2, 3.6]) { ctx.beginPath(); ctx.ellipse(-2, hem - 9, r * 1.4, r, 0, 0, Math.PI * 2); ctx.stroke(); }
            dot(ctx, -2, hem - 9, .7, '#3a2e58');
            for (let i = 0; i < 7; i++) tomoe(ctx, -11 + i * 3.3, hem - 4.6, .6, Math.PI * .5, INK);
          }
        },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-8.4, -21.6); ctx.quadraticCurveTo(-2.4, -19.4, 3.6, -18.6); ctx.lineTo(6.6, -12.2); ctx.closePath(); },
            ROBE_D, O, 1, () => { ctx.fillStyle = 'rgba(40,30,60,.3)'; ctx.fillRect(-10, -24, 6, 14); });
        },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.6, -18.6); ctx.quadraticCurveTo(-2.4, -16.4, 3.2, -15.4); ctx.quadraticCurveTo(6.4, -15, 8.6, -16.4);
            ctx.lineTo(8.2, -12.8); ctx.quadraticCurveTo(7.8, -11.6, 7.2, -11); ctx.closePath();
          }, ROBE, O, 1.05, () => {
            ctx.fillStyle = 'rgba(40,30,60,.22)'; ctx.fillRect(-10, -20, 5, 10);
            ctx.fillStyle = INNER; ctx.beginPath(); ctx.moveTo(-7.6, -18.6); ctx.quadraticCurveTo(-2.4, -16.4, 3.2, -15.4); ctx.quadraticCurveTo(6.4, -15, 8.6, -16.4);
            ctx.lineTo(8.6, -15.6); ctx.quadraticCurveTo(6.4, -14.2, 3.2, -14.6); ctx.quadraticCurveTo(-2.4, -15.6, -7.6, -17.6); ctx.fill();
          });
          // Nine black magatama on a cord round the chest.
          ctx.strokeStyle = '#3a3444'; ctx.lineWidth = .35;
          ctx.beginPath(); ctx.ellipse(1.8, -12.4, 7, 4.6, 0, .1 * Math.PI, .9 * Math.PI); ctx.stroke();
          for (let i = 0; i < 9; i++) {
            const a = (.12 + i * .095) * Math.PI, x = 1.8 + Math.cos(a) * 7, y = -12.4 + Math.sin(a) * 4.6;
            tomoe(ctx, x, y + .3, .9, Math.PI * .5, '#0d0c11');
            dot(ctx, x - .25, y + .05, .22, 'rgba(255,255,255,.6)');
          }
        },
        head: {
          drape: maneDrape(HAIRC),
          hair: (ctx, sp) => sweptHair(ctx, sp, HAIRC, [[-14, 14.6], [-38, 18], [-62, 19.6], [-86, 19.2], [-110, 20.6], [-134, 19.8], [-158, 20.6], [-182, 19.6], [-206, 18], [-228, 15]], { valley: 13.4, sweep: .22, gloss: '#ffffff' }),
          eyes: { type: 'rinnegan' }, mouth: 'frown', attackMouth: 'shout', browAngle: 'angry', brows: 'thick', browColor: '#d6d0ca', blush: false,
          marks(ctx) {
            // age lines under the eyes, down the cheeks and between the brows
            const c = 'rgba(120,80,80,.55)';
            line(ctx, [[.6, 5.4], [2.4, 6.1], [4, 5.6]], c, .32);
            line(ctx, [[7, 5.2], [8.4, 5.6]], c, .28);
            line(ctx, [[4.4, 6.2], [4, 8.8]], c, .3);
            line(ctx, [[9.6, 6.6], [9.2, 8.8]], c, .3);
            line(ctx, [[5.3, -1.6], [5.6, .2]], c, .3);
          },
          front(ctx, sp) {
            fringeShadow(ctx, [[-3, -6], [3.4, -6.4], [2.2, 2], [.4, 11], [-2.4, 4]]);
            locks(ctx, sp, HAIRC, [[10, -7.2, 11.8, 10.6, 1.6, .9], [-1.2, -8.4, -2.6, 11.6, 1.9, -1.1], [7.4, -8.6, 8.4, -4, 1.2, .4]], .9);
            horns(ctx, [[1.2, -10.4, 8.4, -106, 1.75], [6.8, -10, 8.4, -70, 1.75]], '#f4e8cc', '#2a2018');
          }
        },
        back(ctx, pose) { if (!pose.attack) shakujo(ctx, pose, [10.6, pose.raise ? -14 : -4], O, true); },
        front(ctx, pose, hand) { if (pose.attack) shakujo(ctx, pose, hand, O); }
      };
    }

    function hamuraSpec() {
      const O = '#191823', HAIRC = '#f2f0f5', ROBE = '#eceef4', ROBE_D = '#b8bfd2', TRIM = '#4d62a4', INNER = '#252b48', HAKAMA = '#3a4466';
      return {
        outline: O, skin: '#f0e2d8', skinShade: '#c4aaa6', bulk: .35, legK: 1.14,
        legs: { thigh: HAKAMA, shin: HAKAMA, foot: '#ece8e2', w1: 6.8, w2: 6 },
        arms: { upper: ROBE, lower: ROBE, w1: 5.8, w2: 6.8, cuff: TRIM },
        torso: {
          base: ROBE, paint: ctx => {
            ctx.fillStyle = INNER; ctx.beginPath(); ctx.moveTo(.6, -13.6); ctx.lineTo(6.8, -13.6); ctx.lineTo(4.1, -6.4); ctx.closePath(); ctx.fill();
            line(ctx, [[.6, -13.6], [4.1, -6.4], [6.3, -1]], TRIM, .95);
            line(ctx, [[.6, -13.6], [4.1, -6.4], [6.3, -1]], O, .35);
            line(ctx, [[6.8, -13.6], [4.1, -6.4]], O, .45);
            ctx.strokeStyle = 'rgba(90,100,140,.4)'; ctx.lineWidth = .38;
            for (const [x0, x1] of [[-3.2, -4], [-.2, .8], [7.2, 6.6]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .7, -6, x1, -2.6); ctx.stroke(); }
            ctx.fillStyle = TRIM; ctx.fillRect(-9, -3.8, 19, 3.2);
            ctx.fillStyle = 'rgba(200,220,255,.4)'; ctx.fillRect(-9, -3.8, 19, .5);
            ctx.fillStyle = INNER; ctx.fillRect(-9, -1.2, 19, .6);
            // a blue magatama pendant: the Tenseigan's tint
            dot(ctx, 4.6, -8.4, .9, '#4aa0ff'); dot(ctx, 4.4, -8.7, .3, 'rgba(255,255,255,.85)');
          }
        },
        skirt: {
          color: ROBE, hem: 9.4, flare: 2, paint: (ctx, hem, hipY) => {
            ctx.fillStyle = TRIM; ctx.fillRect(-20, hem - 1.6, 40, 1.8);
            ctx.strokeStyle = 'rgba(90,100,140,.4)'; ctx.lineWidth = .38;
            for (const x of [-6, -1.6, 5]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.quadraticCurveTo(x - .6, (hipY + hem) / 2, x - 1.2, hem); ctx.stroke(); }
          }
        },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-8.6, -22); ctx.quadraticCurveTo(-2.4, -19.6, 3.4, -18.8); ctx.lineTo(6.4, -12.2); ctx.closePath(); },
            ROBE_D, O, 1, () => { ctx.fillStyle = 'rgba(40,40,80,.32)'; ctx.fillRect(-10, -24, 6, 14); ctx.fillStyle = TRIM; ctx.fillRect(-10, -12.8, 20, 1); });
        },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.9, -10.8); ctx.lineTo(-7.8, -19.2);
            ctx.quadraticCurveTo(-2.6, -17, 2.2, -16); ctx.lineTo(2.6, -13.4); ctx.quadraticCurveTo(-1.6, -12.6, -2.4, -10.8); ctx.closePath();
          }, ROBE, O, 1.05, () => {
            ctx.fillStyle = 'rgba(40,40,80,.24)'; ctx.fillRect(-10, -21, 4.4, 11);
            ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(-7.8, -19.2); ctx.quadraticCurveTo(-2.6, -17, 2.2, -16); ctx.lineTo(2.2, -15.1); ctx.quadraticCurveTo(-2.6, -16.1, -7.8, -18.2); ctx.fill();
          });
        },
        head: {
          drape: HAIR.longBack(HAIRC, 38, 11.5),
          hair: HAIR.smooth(HAIRC, { bangs: [[9.6, 1.5, 8.6], [-.2, 1.7, 9.4], [5, 1.3, -1.6], [2.4, 1.2, -2.8], [7.4, 1.1, -2.4]] }),
          eyes: { type: 'byakugan' }, mouth: 'neutral', attackMouth: 'frown', browAngle: 'angry', browColor: '#c9c4d0', blush: false,
          marks(ctx) {
            // Byakugan veins at the temples
            const c = 'rgba(120,110,180,.75)';
            line(ctx, [[-.4, .4], [-1.4, -.6], [-2.2, .2]], c, .32);
            line(ctx, [[-.2, 3.8], [-1.4, 4.6]], c, .3);
            line(ctx, [[10.2, .2], [10.9, -.8]], c, .3);
          },
          front(ctx) { horns(ctx, [[2, -10.6, 4.4, -98, 1.05], [6.4, -10.2, 4.4, -78, 1.05]], '#eee6da'); }
        },
        front(ctx, pose, hand) {
          if (!pose.attack && !pose.seal) return;
          // Gentle Fist: chakra blazing from the open palm
          dot(ctx, hand[0] + 1.4, hand[1], 3.8, 'rgba(120,180,255,.42)');
          dot(ctx, hand[0] + 1.4, hand[1], 2.2, 'rgba(235,245,255,.95)');
        }
      };
    }

    function ashuraSpec() {
      const O = '#1c130d', HAIRC = '#6e4428', ARM = '#8e6a3a', ARM_D = '#4c3418', SUIT = '#2c2a32', WRAP = '#e6dfd0';
      return {
        outline: O, skin: '#efcfae', skinShade: '#c39a80', bulk: .9,
        legs: { thigh: SUIT, shin: SUIT, foot: '#2a2018', w1: 6, w2: 4.8, wrap: WRAP },
        arms: { upper: SUIT, lower: WRAP, w1: 5.2, w2: 4.7, cuff: ARM_D },
        torso: {
          base: ARM, paint: ctx => {
            // bronze lamellar breastplate with gold-lit rows
            for (let y = -12.4, r = 0; y < -3; y += 2.3, r++) {
              ctx.fillStyle = 'rgba(255,220,150,.3)'; ctx.fillRect(-8, y + .2, 17, .6);
              ctx.strokeStyle = ARM_D; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(-8, y + 2.1); ctx.lineTo(9, y + 1.8); ctx.stroke();
              ctx.fillStyle = '#2a1a0a'; for (let x = -5 + (r % 2) * 1.6; x < 8; x += 3.2) ctx.fillRect(x, y + 1.1, .45, .45);
            }
            line(ctx, [[2.6, -12.6], [3.1, -2.6]], ARM_D, .55);
            ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-9, -3, 19, 3);
            ctx.fillStyle = 'rgba(255,220,150,.3)'; ctx.fillRect(-9, -3, 19, .5);
            dot(ctx, 3, -1.5, 1, '#d8a84a');
          }
        },
        skirt: {
          color: ARM, hem: 7.6, flare: .9, opening: false, paint: (ctx, hem, hipY) => {
            ctx.strokeStyle = ARM_D; ctx.lineWidth = .6;
            for (let y = hipY + 2; y < hem; y += 2.3) { ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y); ctx.stroke(); }
            ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = .8;
            for (const x of [-4.2, .8, 5.4]) { ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x + .3, hem + 2); ctx.stroke(); }
          }
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.ellipse(1.4, -13.2, 5, 1.8, 0, 0, Math.PI * 2); }, SUIT, O, .85, () => { ctx.fillStyle = SHADE; ctx.fillRect(-4, -13, 12, 2); });
        },
        shoulder(ctx) {
          for (let i = 1; i >= 0; i--) {
            const dy = i * 2.2;
            paint(ctx, () => smooth(ctx, [[-8.6, -13 + dy], [-2.6, -15.2 + dy], [2.8, -12.6 + dy], [2, -9.4 + dy], [-5.6, -9 + dy], [-9.2, -10.4 + dy]]), i ? '#7a5a2e' : '#9c7842', O, .9, () => {
              ctx.fillStyle = SHADE; ctx.fillRect(-11, -10.8 + dy, 15, 3);
              ctx.fillStyle = 'rgba(255,230,170,.4)'; ell(ctx, -2.6, -13.6 + dy, 3.6, .7, .1); ctx.fill();
            });
          }
        },
        head: {
          drape: null,
          hair: (ctx, sp) => { HAIR.narutoBack(dark(HAIRC, .05))(ctx, sp); HAIR.naruto(HAIRC)(ctx, sp); },
          eyes: { iris: '#6a3e1e' }, mouth: 'smirk', attackMouth: 'shout', browAngle: 'angry', browColor: '#3a2414', brows: 'thick',
          marks(ctx) {
            // Six Paths Senjutsu: orange pigment over the eyelids
            ctx.fillStyle = 'rgba(235,110,40,.55)'; ell(ctx, 2.6, -.5, 2.4, .75, -.1); ctx.fill(); ell(ctx, 8, -.6, 1.6, .6); ctx.fill();
          },
          front(ctx, sp) { HAIR.narutoFringe(HAIRC)(ctx, sp); }
        },
        front(ctx, pose, hand) {
          if (!pose.attack && !pose.seal) return;
          // the first Rasengan swirling in his palm
          const x = hand[0] + 1.6, y = hand[1];
          dot(ctx, x, y, 4, 'rgba(90,160,255,.45)');
          dot(ctx, x, y, 2.6, 'rgba(160,210,255,.95)');
          ctx.strokeStyle = '#f2f8ff'; ctx.lineWidth = .4;
          ctx.beginPath(); ctx.arc(x, y, 1.8, .2, 2.4); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 1.2, 3, 5.2); ctx.stroke();
        }
      };
    }
    // Ashura's head has no drape: drop the key so renderCharacter skips it.
    const ash = ashuraSpec(); delete ash.head.drape;

    AS.addSprite('hagoromo', hagoromoSpec(), { scale: 1.7, box: [-40, -92, 40, 10] },
      { hair: '#e3dfd9', fringe: 'part', accent: '#9a7ae8', long: true, marks: ['wrinkles'], horns: [[-.6, -1.45, -.95], [.6, -1.45, .95]] });
    AS.addSprite('hamura', hamuraSpec(), { scale: 1.62, box: [-40, -86, 40, 8] },
      { hair: '#f2f0f5', fringe: 'part', accent: '#6aa0ff', long: true, horns: [[-.5, -1.45, -.85], [.5, -1.45, .85]] });
    AS.addSprite('ashura', ash, { scale: 1.52, box: [-40, -86, 42, 8] },
      { hair: '#6e4428', fringe: 'naruto', accent: '#ff9a40' });
  }
  try { registerSprites(); } catch (e) { console.warn('sage sprites', e); }

  window.SageBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, bodyLift, moves };
})();
