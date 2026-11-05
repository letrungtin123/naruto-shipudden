(() => {
  'use strict';

  // Gia tộc Uchiha (spawn panel, faction 'uchiha'): Uchiha Shisui, Uchiha Fugaku and Ōtsutsuki Indra.
  // Contract as sasuke-boss.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the ground
  // layer (telegraphs, scorch, the Susanoo standing behind the caster), drawOverlay(ctx, z, time) what is
  // above the characters. All per-boss state lives on z.uc (plain numbers; the delayed blows in st.ev are
  // closures, which the co-op serialiser drops). Each Susanoo has its own colour: Shisui green, Fugaku
  // orange-red, Indra violet-blue and winged. Amaterasu is pitch black with a crimson rim.
  //  Shisui: Shunshin combo, Great Dragon Fire, shadow shuriken, crow clone, Kotoamatsukami, Susanoo blade (ult).
  //  Fugaku: Great Fireball, Phoenix Flower, police kunai net set alight, crawling Amaterasu, Susanoo fist,
  //          Susanoo heaven-fire orb (ult).
  //  Indra:  Chidori dashes, Yasaka Magatama, closing ring of Amaterasu, Susanoo cleave, Kirin, Indra's Arrow (ult).
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

  const order = ['shisui', 'fugaku', 'indra'];
  const members = {
    shisui: {
      name: 'UCHIHA SHISUI — THUẤN THÂN', short: 'SHISUI', accent: '#5ad07a', hpScale: 3.5, damageScale: 1.9, armor: .9, blink: 'shisui',
      moves: ['shunshin', 'dragon', 'shuriken', 'crows', 'koto', 'shSus', 'shuriken', 'shunshin', 'dragon', 'crows', 'shunshin', 'koto', 'shSus']
    },
    fugaku: {
      name: 'UCHIHA FUGAKU — TỘC TRƯỞNG', short: 'FUGAKU', accent: '#e0603a', hpScale: 3.6, damageScale: 1.95, armor: .88, blink: 'fugaku',
      moves: ['fireball', 'phoenix', 'police', 'fgAma', 'fist', 'fgSus', 'phoenix', 'fist', 'fireball', 'fgAma', 'police', 'fgSus']
    },
    indra: {
      name: 'ŌTSUTSUKI INDRA — NHÂN ĐÀ LA', short: 'INDRA', accent: '#8a7aff', hpScale: 4.0, damageScale: 2.0, armor: .85, blink: 'indra',
      moves: ['chidori', 'magatama', 'inAma', 'sword', 'kirin', 'arrow', 'chidori', 'sword', 'magatama', 'kirin', 'inAma', 'chidori', 'arrow']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    shunshin: { label: 'THUẤN THÂN · SHUNSHIN NO SHISUI', rgb: '255,96,96', windup: .8, after: 1.1 },
    dragon:   { label: 'HỎA ĐỘN · HÀO LONG HỎA', rgb: '255,150,60', windup: .85, after: 1.3, ranged: 1 },
    shuriken: { label: 'ẢNH PHI TIÊU · KAGE SHURIKEN', rgb: '215,225,245', windup: .7, after: 1.1, ranged: 1 },
    crows:    { label: 'Ô NHA PHÂN THÂN · KARASU', rgb: '255,80,90', windup: .8, after: 1.2, ranged: 1 },
    koto:     { label: 'BIỆT THIÊN THẦN · KOTOAMATSUKAMI', rgb: '255,60,80', windup: 1.0, after: 1.3, ranged: 1 },
    shSus:    { label: 'TU TÁ NĂNG HỒ · LỤC QUANG KIẾM', rgb: '110,240,150', windup: 1.9, after: 2.4, ranged: 1 },
    fireball: { label: 'HỎA ĐỘN · HÀO HỎA CẦU', rgb: '255,140,50', windup: 1.0, after: 1.4, ranged: 1 },
    phoenix:  { label: 'HỎA ĐỘN · PHƯỢNG TIÊN HỎA', rgb: '255,170,70', windup: .8, after: 1.2, ranged: 1 },
    police:   { label: 'CẢNH VỤ BỘ · HỎA VÕNG KHỔ VÔ', rgb: '235,225,205', windup: .9, after: 1.3, ranged: 1 },
    fgAma:    { label: 'THIÊN CHIẾU · AMATERASU', rgb: '255,70,100', windup: .9, after: 1.4, ranged: 1 },
    fist:     { label: 'TU TÁ NĂNG HỒ · CỰ QUYỀN', rgb: '255,120,60', windup: .95, after: 1.3 },
    fgSus:    { label: 'TU TÁ NĂNG HỒ · VIÊM THIÊN CẦU', rgb: '255,110,40', windup: 2.2, after: 2.6, ranged: 1 },
    chidori:  { label: 'THIÊN ĐIỂU · CHIDORI', rgb: '150,200,255', windup: .8, after: 1.2, ranged: 1 },
    magatama: { label: 'BÁT XÍCH QUỲNH CÂU · YASAKA', rgb: '175,165,255', windup: .9, after: 1.3, ranged: 1 },
    inAma:    { label: 'THIÊN CHIẾU · HẮC VIÊM LUÂN', rgb: '255,70,110', windup: 1.0, after: 1.4, ranged: 1 },
    sword:    { label: 'TU TÁ NĂNG HỒ · CỰ KIẾM', rgb: '165,155,255', windup: 1.2, after: 1.5, ranged: 1 },
    kirin:    { label: 'KỲ LÂN · KIRIN', rgb: '160,210,255', windup: 1.7, after: 2.0, ranged: 1 },
    arrow:    { label: 'NHÂN ĐÀ LA CHI THỈ · INDRA', rgb: '185,175,255', windup: 2.7, after: 3.0, ranged: 1 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;
  // Susanoo moves: how the Susanoo level follows the cast.
  const SUS_OF = { shSus: 'shisui', fist: 'fugaku', fgSus: 'fugaku', magatama: 'indra', sword: 'indra', arrow: 'indra' };

  // ------------------------------------------------------------------ tuning
  const SHUN_R = 115, SHUN_R2 = 160, SHUN_D = 175, SHUN_GAP = .17;
  const DR_LEN = 920, DR_W = 72, DR_AMP = 85, DR_T = .85, DR_END = 215, DR_BURN = 3.2;
  const SH_N = 9, SH_SPREAD = .09, SH_LEN = 860, SH_W = 22, SH_SPEED = 2500, SH_W2 = .3;
  const CROW_LEN = 720, CROW_HALF = .42, CROW_R = 170, CROW_T = .9, CROW_N = 26;
  const KOTO_R = 430, KOTO_IN = 150, KOTO_T = 2.6, KOTO_BOOM = 210;
  const SS_R = 640, SS_HALF = 1.05, SS_LEN = 1150, SS_W = 80, SS_S2 = .45, SS_TH = .95;
  const FB_R = 300, FB_T = .8, FB_W = 105;
  const PH_N = 11, PH_HIT = 75, PH_FLY = .45;
  const NET_HALF = 290, NET_GAP = 170, NET_FIRE = .85;
  const AMA_W = 62, AMA_T = .55, AMA_END = 150, AMA_DUR = 4.6;
  const FIST_R = 170, FIST_GAP = .32;
  const ORB_R = 480, ORB_T = .6, ORB_RING = 540;
  const CHI_W = 50, CHI_T = .22, CHI_GAP = .6;
  const MAG_LEN = 920, MAG_W = 46, MAG_SPEED = 1700, MAG_SPREAD = .2;
  const RING_R1 = 430, RING_R0 = 130, RING_T = 1.3;
  const CLV_LEN = 1050, CLV_W = 92;
  const KIRIN_R = 400, KIRIN_DIVE = .42;
  const ARW_LEN = 1300, ARW_W = 100;

  // ------------------------------------------------------------------ palettes
  const BLUE = ['40,110,255', '120,190,255', '235,248,255'];
  const BLUE_HOT = ['70,140,255', '165,215,255', '250,253,255'];
  const VB = ['70,60,230', '140,135,255', '235,235,255'];
  const inkB = a => `rgba(4,12,46,${(.8 * clamp01(a)).toFixed(3)})`;
  const inkV = a => `rgba(14,8,52,${(.8 * clamp01(a)).toFixed(3)})`;
  const INK_B = inkB(1), INK_V = inkV(1);
  const FLAME_BASE = 114 / 128;
  // Susanoo colours: rgb = body, deep = shadow, light = edge, ink = under-stroke.
  const SUS = {
    shisui: { rgb: '70,210,120', deep: '18,110,56', light: '205,255,220', ink: 'rgba(4,40,18,.92)', glow: '60,230,120',
      flame: [[1, '#0d4a24'], [.84, '#1f8a46'], [.66, '#43c870'], [.46, '#9af0b8'], [.25, '#eafff0']] },
    fugaku: { rgb: '245,115,45', deep: '150,40,10', light: '255,225,180', ink: 'rgba(56,10,0,.92)', glow: '255,110,30',
      flame: [[1, '#6a1a06'], [.84, '#c0400e'], [.66, '#ff7a26'], [.46, '#ffc070'], [.25, '#fff0d8']] },
    indra: { rgb: '110,110,255', deep: '44,40,170', light: '225,225,255', ink: 'rgba(12,8,56,.92)', glow: '110,100,255',
      flame: [[1, '#1c1a6a'], [.84, '#3a3ac0'], [.66, '#6a70ff'], [.46, '#b0b8ff'], [.25, '#eef0ff']] }
  };

  function pick(level) { return order[(level | 0) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.uc || (z.uc = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: R0(z.x), ty: R0(z.y),
      tele: [], ev: [], fx: [], hold: 0, holdMove: '', blinkCd: 1.5, spots: null, path: null, lastDraw: 0, dash: null,
      hide: 0, police: 0, sus: 0, susMove: '' });
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

  // A gently S-curved lane of n+1 points from (x, y) along `a`.
  function curvePath(x, y, a, len, amp, n, phase = 0) {
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, off = Math.sin(t * TAU + phase) * amp * Math.sin(Math.PI * t * .5 + .2);
      pts.push([R0(x + ca * len * t + nx * off), R0(y + sa * len * t + ny * off)]);
    }
    return pts;
  }
  const PA = { x: 0, y: 0, a: 0 };
  function pathAt(pts, s) {
    const f = clamp01(s) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
    const p = pts[i], q = pts[i + 1];
    PA.x = p[0] + (q[0] - p[0]) * u; PA.y = p[1] + (q[1] - p[1]) * u; PA.a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    return PA;
  }
  // A sector (fan) of circles hitting everything within `half` of `a`, out to R.
  function sectorHit(api, x, y, a, R, half, dmg, kind) {
    api.strike(x, y, 100, dmg, null, null, true);
    for (const k of [.3, .55, .8]) {
      const rr = R * k, n = Math.max(2, Math.ceil(2 * half * rr / 130));
      for (let j = 0; j < n; j++) {
        const b = a - half + (j + .5) * 2 * half / n;
        api.strike(x + Math.cos(b) * rr, y + Math.sin(b) * rr, 125, dmg, null, j === (n >> 1) && k > .7 ? kind : null, true);
      }
    }
  }

  // ------------------------------------------------------------------ telegraphs
  const C = (x, y, r, faint, small) => ({ k: 'c', x, y, r, faint, small });
  const TELE = {
    shunshin(z, st) {
      const b = Math.random() * TAU, spots = [{ x: st.tx, y: st.ty, r: SHUN_R }];
      for (let i = 0; i < 3; i++) { const a = b + i * TAU / 3; spots.push({ x: R0(st.tx + Math.cos(a) * SHUN_D), y: R0(st.ty + Math.sin(a) * SHUN_D), r: SHUN_R }); }
      spots.push({ x: st.tx, y: st.ty, r: SHUN_R2 });
      st.spots = spots;
      return spots.map((s, i) => C(s.x, s.y, s.r, i < 4, i < 4));
    },
    dragon(z, st) {
      st.path = curvePath(z.x, z.y, st.aim, DR_LEN, DR_AMP, 14, Math.random() < .5 ? 0 : Math.PI);
      const e = st.path[st.path.length - 1];
      return [{ k: 'path', pts: st.path, w: DR_W }, C(e[0], e[1], DR_END, true)];
    },
    shuriken() {
      const out = [];
      for (let i = 0; i < SH_N; i++) out.push({ k: 'line', follow: true, from: 30, boff: (i - 4) * SH_SPREAD, len: SH_LEN, w: SH_W });
      for (let i = 0; i < SH_N - 1; i++) out.push({ k: 'line', follow: true, from: 30, boff: (i - 3.5) * SH_SPREAD, len: SH_LEN, w: SH_W * .8, faint: true });
      return out;
    },
    crows(z, st) { return [{ k: 'cone', follow: true, len: CROW_LEN, half: CROW_HALF }, C(st.tx, st.ty, CROW_R)]; },
    koto(z, st) { return [C(st.tx, st.ty, KOTO_R), C(st.tx, st.ty, KOTO_IN, true)]; },
    shSus() { return [{ k: 'sector', follow: true, r: SS_R, half: SS_HALF }, { k: 'line', follow: true, from: 60, len: SS_LEN - 60, w: SS_W, big: true }]; },
    fireball(z, st) {
      const d = Math.max(300, Math.min(720, Math.hypot(st.tx - z.x, st.ty - z.y)));
      st.spots = [{ x: R0(z.x + Math.cos(st.aim) * d), y: R0(z.y + Math.sin(st.aim) * d) }];
      return [{ k: 'line', follow: true, from: 40, len: d - 40, w: FB_W }, C(st.spots[0].x, st.spots[0].y, FB_R)];
    },
    phoenix(z, st) {
      const spots = [{ x: st.tx, y: st.ty }], b = Math.random() * TAU;
      for (let i = 0; i < PH_N - 1; i++) {
        const a = b + i * TAU / (PH_N - 1) + rand(-.2, .2), d = (i % 2 ? 150 : 290) + rand(-30, 30);
        spots.push({ x: R0(st.tx + Math.cos(a) * d), y: R0(st.ty + Math.sin(a) * d) });
      }
      spots.forEach((s, i) => { s.t = +(.05 + i * .055 + Math.random() * .04).toFixed(2); });
      st.spots = spots;
      return spots.map(s => C(s.x, s.y, PH_HIT, true, true));
    },
    police(z, st) {
      const a = st.aim, ca = Math.cos(a), sa = Math.sin(a), wires = [];
      for (const o of [-NET_GAP, 0, NET_GAP]) {
        wires.push([R0(st.tx - ca * NET_HALF - sa * o), R0(st.ty - sa * NET_HALF + ca * o), R0(st.tx + ca * NET_HALF - sa * o), R0(st.ty + sa * NET_HALF + ca * o)]);
        wires.push([R0(st.tx + sa * NET_HALF + ca * o), R0(st.ty - ca * NET_HALF + sa * o), R0(st.tx - sa * NET_HALF + ca * o), R0(st.ty + ca * NET_HALF + sa * o)]);
      }
      st.spots = wires;
      return wires.map(w => ({ k: 'seg', x1: w[0], y1: w[1], x2: w[2], y2: w[3], w: 30 }));
    },
    fgAma(z, st) {
      const d = Math.max(320, Math.min(760, Math.hypot(st.tx - z.x, st.ty - z.y) + 60));
      st.path = curvePath(z.x, z.y, st.aim, d, 55, 10, Math.random() * TAU);
      const e = st.path[st.path.length - 1];
      return [{ k: 'path', pts: st.path, w: AMA_W }, C(e[0], e[1], AMA_END)];
    },
    fist(z, st) {
      const d0 = Math.max(220, Math.min(560, Math.hypot(st.tx - z.x, st.ty - z.y))), spots = [];
      for (const [d, s] of [[d0 - 210, 1], [d0, -1], [d0 + 210, 1]]) {
        const b = st.aim + s * .12;
        spots.push({ x: R0(z.x + Math.cos(b) * Math.max(120, d)), y: R0(z.y + Math.sin(b) * Math.max(120, d)) });
      }
      st.spots = spots;
      return spots.map(s => C(s.x, s.y, FIST_R));
    },
    fgSus(z, st) { return [C(st.tx, st.ty, ORB_R), { k: 'ring', x: st.tx, y: st.ty, r0: ORB_R, r1: ORB_RING + 110 }]; },
    chidori(z, st) {
      const d = Math.max(420, Math.min(780, Math.hypot(st.tx - z.x, st.ty - z.y) + 170));
      st.spots = [{ d: R0(d) }];
      return [{ k: 'line', follow: true, from: 0, len: d, w: CHI_W }, { k: 'c', follow: true, along: d, r: 140, faint: true }];
    },
    magatama() {
      const out = [];
      for (let i = 0; i < 3; i++) out.push({ k: 'line', follow: true, from: 40, boff: (i - 1) * MAG_SPREAD, len: MAG_LEN, w: MAG_W });
      return out;
    },
    inAma(z, st) { return [{ k: 'ring', x: st.tx, y: st.ty, r0: RING_R0, r1: RING_R1 }, C(st.tx, st.ty, RING_R0)]; },
    sword() { return [{ k: 'line', follow: true, from: 50, len: CLV_LEN, w: CLV_W, big: true }]; },
    kirin(z, st) { return [C(st.tx, st.ty, KIRIN_R), C(st.tx, st.ty, KIRIN_R * .5, true)]; },
    arrow() { return [{ k: 'line', follow: true, from: 60, len: ARW_LEN, w: ARW_W, big: true }]; }
  };

  // Ranged jutsu are cast from a distance: if he is in the target's face, he flickers out first.
  function announce(z, st, m, api) {
    const move = m.moves[st.casts % m.moves.length];
    st.casts++;
    const def = MOVES[move], p = api.player;
    if (p && def.ranged) {
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (move === 'arrow' || move === 'fgSus' || move === 'shSus') {
        // ultimates are cast from beside the target, a little below it, so the whole Susanoo stands in view
        const side = z.x < p.x ? -1 : 1;
        const spots = [[400, 150], [400, 80], [400, 220], [420, 10], [300, 260]].flatMap(([x, y]) => [[x * side, y], [-x * side, y]]);
        flicker(z, st, api, move === 'shSus' ? 400 : 430, spots, m.blink);
      } else if (d < 300) flicker(z, st, api, 420, null, m.blink);
    }
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = +aimAt(z, p).toFixed(3); st.tx = p ? R0(p.x) : R0(z.x); st.ty = p ? R0(p.y) : R0(z.y);
    st.tele = TELE[move] ? TELE[move](z, st) : [];
  }

  // Body flicker: Shisui leaves after-images, Fugaku a puff of smoke, Indra a crackle of lightning.
  function flicker(z, st, api, dist = 380, pref = null, who = 'shisui') {
    const p = api.player;
    if (!p) return;
    // pref: one angle (tried with growing offsets) or a list of exact spots [dx, dy] round the target
    const list = Array.isArray(pref) ? pref : null, base = list ? 0 : pref != null ? pref : Math.atan2(z.y - p.y, z.x - p.x);
    const offs = list || [0, .6, -.6, 1.2, -1.2, 2, -2];
    for (const off of offs) {
      const b = list ? Math.atan2(off[1], off[0]) : base + off, x = p.x + Math.cos(b) * dist, y = p.y + Math.sin(b) * dist;
      if (Math.abs(x - z.x) + Math.abs(y - z.y) < 40) return;
      if (api.blocked(x, y, z.r || 14)) continue;
      addFx(st, { kind: 'blink', who, x1: R0(z.x), y1: R0(z.y), x2: R0(x), y2: R0(y), f: x > z.x ? 1 : -1, dur: who === 'fugaku' ? .8 : .5 });
      z.x = x; z.y = y;
      return;
    }
  }

  // ------------------------------------------------------------------ casting
  const CAST = {
    // ---- Shisui
    shunshin(z, st, api, D) {
      const spots = st.spots || [];
      const fx = addFx(st, { kind: 'shun', pts: [], spots, dur: spots.length * SHUN_GAP + 1.0 });
      st.hold = spots.length * SHUN_GAP + .25; st.holdMove = 'shunshin';
      spots.forEach((s, i) => later(st, .02 + i * SHUN_GAP, api => {
        const last = i === spots.length - 1, from = Math.atan2(s.y - z.y, s.x - z.x), ox = z.x, oy = z.y;
        let nx = s.x + Math.cos(from) * 60, ny = s.y + Math.sin(from) * 60;
        if (api.blocked(nx, ny, z.r || 14)) { nx = s.x; ny = s.y; }
        if (!api.blocked(nx, ny, z.r || 14)) { z.x = nx; z.y = ny; }
        z.angle = from; z.kageDash = .16;
        fx.pts.push({ x0: R0(ox), y0: R0(oy), x: R0(z.x), y: R0(z.y), a: +from.toFixed(2), t: +fx.age.toFixed(2), i });
        api.strike(s.x, s.y, s.r, D * (last ? 2.1 : 1.25), null, last ? 'blade' : null, true);
        if (last) api.world(s.x, s.y, 120, D * 2, 'blade', from);
        api.shake(last ? 14 : 7);
      }));
      st.spots = null;
    },
    dragon(z, st, api, D) {
      const pts = st.path || [[z.x, z.y], [z.x + 1, z.y]], n = pts.length - 1, e = pts[n];
      addFx(st, { kind: 'dragon', pts, T: DR_T, dur: DR_T + DR_BURN, nt: DR_T + .5, dmg: D, upd: dragonUpd });
      for (let k = 1; k <= n; k++) {
        const p = pts[k];
        later(st, k / n * DR_T, api => { api.strike(p[0], p[1], DR_W + 6, D * 1.15, null, k % 5 === 0 ? 'fire' : null, true); if (k % 3 === 0) api.shake(5); });
      }
      later(st, DR_T + .02, api => {
        api.strike(e[0], e[1], DR_END, D * 2.4, null, 'fire', true);
        api.world(e[0], e[1], 190, D * 2.6, 'fire');
        api.burst(e[0], e[1] - 30, '#ffb060', 18);
        api.shake(18);
      });
      st.hold = .55; st.holdMove = 'dragon';
      st.path = null;
    },
    shuriken(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim;
      addFx(st, { kind: 'shur', x: R0(x), y: R0(y), a, dur: 1.5 });
      for (let w = 0; w < 2; w++) {
        const n = w ? SH_N - 1 : SH_N, c = (n - 1) / 2;
        for (let i = 0; i < n; i++) {
          const b = a + (i - c) * SH_SPREAD, cb = Math.cos(b), sb = Math.sin(b), t0 = (w ? SH_W2 : .02) + Math.abs(i - c) * .015;
          later(st, t0 + .12, api => { api.line(x + cb * 30, y + sb * 30, x + cb * SH_LEN, y + sb * SH_LEN, SH_W, D * .95, null); if (i === 0) api.shake(4); });
        }
      }
    },
    crows(z, st, api, D) {
      const x0 = z.x, y0 = z.y, a = st.aim, tx = st.tx, ty = st.ty;
      addFx(st, { kind: 'crows', x0: R0(x0), y0: R0(y0), a, tx, ty, dur: CROW_T + 1.0 });
      st.hide = CROW_T; st.hold = CROW_T + .3; st.holdMove = 'crows';
      for (let j = 0; j < 5; j++) {
        const b = a + (j - 2) / 2 * CROW_HALF * .8;
        later(st, .15 + j * .04, api => api.line(x0, y0, x0 + Math.cos(b) * CROW_LEN, y0 + Math.sin(b) * CROW_LEN, 40, D * .9, null));
      }
      later(st, CROW_T, api => {
        const from = Math.atan2(ty - y0, tx - x0);
        let nx = tx - Math.cos(from) * 70, ny = ty - Math.sin(from) * 70;
        if (api.blocked(nx, ny, z.r || 14)) { nx = tx; ny = ty; }
        if (!api.blocked(nx, ny, z.r || 14)) { z.x = nx; z.y = ny; }
        z.angle = from; z.kageDash = .25;
        api.strike(tx, ty, CROW_R, D * 1.9, null, 'blade', true);
        api.shake(13);
      });
    },
    koto(z, st, api, D) {
      addFx(st, { kind: 'koto', x: st.tx, y: st.ty, T: KOTO_T, dur: KOTO_T + 1.1, nt: .25, dmg: D, px: st.tx, py: st.ty, pin: 0, boom: 0, big: true, upd: kotoUpd });
      st.hold = KOTO_T + .2; st.holdMove = 'koto';
    },
    shSus(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
      addFx(st, { kind: 'shsus', x: R0(x), y: R0(y), a, dur: 2.4, big: true });
      st.hold = 1.55; st.holdMove = 'shSus';
      later(st, .05, api => {
        sectorHit(api, x, y, a, SS_R, SS_HALF, D * 2.4, 'blade');
        api.world(x + Math.cos(a - .6) * 430, y + Math.sin(a - .6) * 430, 120, D * 2.2, 'blade', a + 1);
        api.shake(18);
      });
      later(st, SS_S2, api => {
        sectorHit(api, x, y, a, SS_R, SS_HALF, D * 2.0, 'blade');
        api.world(x + Math.cos(a + .6) * 430, y + Math.sin(a + .6) * 430, 120, D * 2.2, 'blade', a - 1);
        api.shake(16);
      });
      later(st, SS_TH, api => {
        api.line(x + ca * 60, y + sa * 60, x + ca * SS_LEN, y + sa * SS_LEN, SS_W, D * 4.6, 'crater');
        for (const [t, r] of [[.45, 150], [.75, 170], [1, 230]]) api.world(x + ca * SS_LEN * t, y + sa * SS_LEN * t, r, D * 4, 'crater', a);
        api.burst(x + ca * SS_LEN, y + sa * SS_LEN - 30, '#bfffd6', 24);
        api.shake(28);
      });
    },
    // ---- Fugaku
    fireball(z, st, api, D) {
      const e = (st.spots || [{ x: st.tx, y: st.ty }])[0], x = z.x, y = z.y;
      addFx(st, { kind: 'fball', x0: R0(x), y0: R0(y), x1: e.x, y1: e.y, T: FB_T, dur: FB_T + 3.0, nt: FB_T + .4, dmg: D, upd: fballUpd });
      for (let k = 1; k <= 5; k++) later(st, k / 6 * FB_T, api => api.strike(x + (e.x - x) * k / 6, y + (e.y - y) * k / 6, FB_W, D * 1.0, null, null, true));
      later(st, FB_T, api => {
        api.strike(e.x, e.y, FB_R, D * 2.8, null, 'fire', true);
        api.world(e.x, e.y, 260, D * 3, 'fire');
        api.burst(e.x, e.y - 40, '#ffb060', 26);
        api.shake(22);
      });
      st.hold = .6; st.holdMove = 'fireball';
      st.spots = null;
    },
    phoenix(z, st, api, D) {
      const spots = st.spots || [];
      let last = 0;
      spots.forEach((s, i) => {
        last = Math.max(last, s.t + PH_FLY);
        later(st, s.t + PH_FLY, api => { api.strike(s.x, s.y, PH_HIT, D * 1.1, null, i % 4 === 0 ? 'fire' : null, true); if (i % 3 === 0) api.shake(6); });
        // a shuriken hidden in each fireball cuts a moment later
        later(st, s.t + PH_FLY + .14, api => api.strike(s.x, s.y, 46, D * .55, null, null, true));
      });
      addFx(st, { kind: 'phoenix', hx: R0(z.x), hy: R0(z.y), spots, last, dur: last + 1.2 });
      st.spots = null;
    },
    police(z, st, api, D) {
      const wires = st.spots || [];
      addFx(st, { kind: 'net', wires, hx: R0(z.x), hy: R0(z.y), dur: NET_FIRE + 1.6 });
      wires.forEach((w, i) => {
        later(st, .22, api => api.line(w[0], w[1], w[2], w[3], 16, D * .7, null));
        later(st, NET_FIRE + i * .04, api => { api.line(w[0], w[1], w[2], w[3], 34, D * 1.4, i === 2 || i === 3 ? 'fire' : null); api.shake(6); });
      });
      // Konoha Military Police officers drop in on both sides.
      const a = st.aim, sa = Math.sin(a), ca = Math.cos(a);
      if (st.police < 6) for (const s of [-1, 1]) {
        const px = st.tx - sa * s * (NET_HALF + 90), py = st.ty + ca * s * (NET_HALF + 90);
        if (!api.blocked(px, py, 14) && api.summon('walker', px, py)) { st.police++; addFx(st, { kind: 'poof', x: R0(px), y: R0(py), dur: .9 }); }
      }
      st.hold = .5; st.holdMove = 'police';
      st.spots = null;
    },
    fgAma(z, st, api, D) {
      const pts = st.path || [[z.x, z.y], [z.x + 1, z.y]], n = pts.length - 1, e = pts[n];
      addFx(st, { kind: 'ama', pts, T: AMA_T, dur: AMA_T + AMA_DUR, nt: AMA_T + .5, dmg: D, upd: amaUpd });
      for (let k = 1; k <= n; k++) { const p = pts[k]; later(st, k / n * AMA_T, api => api.strike(p[0], p[1], AMA_W + 6, D * 1.1, null, null, true)); }
      later(st, AMA_T + .03, api => { api.strike(e[0], e[1], AMA_END, D * 2.0, null, 'fire', true); api.world(e[0], e[1], 130, D * 2.2, 'fire'); api.shake(14); });
      st.hold = .4; st.holdMove = 'fgAma';
      st.path = null;
    },
    fist(z, st, api, D) {
      const spots = st.spots || [];
      addFx(st, { kind: 'fist', spots, x: R0(z.x), y: R0(z.y), dur: spots.length * FIST_GAP + 1.2 });
      spots.forEach((s, i) => later(st, .18 + i * FIST_GAP, api => {
        api.strike(s.x, s.y, FIST_R, D * 2.2, null, 'crater', true);
        api.world(s.x, s.y, 150, D * 2.6, 'crater');
        api.knockback({ x: s.x, y: s.y }, FIST_R + 40, 90, 0);
        api.shake(15);
      }));
      st.hold = .18 + spots.length * FIST_GAP + .2; st.holdMove = 'fist';
      st.spots = null;
    },
    fgSus(z, st, api, D) {
      const tx = st.tx, ty = st.ty, f = Math.cos(st.aim) >= 0 ? 1 : -1;
      addFx(st, { kind: 'orb', x0: R0(z.x), y0: R0(z.y), f, tx, ty, T: ORB_T, dur: ORB_T + 4.4, nt: ORB_T + .6, dmg: D, big: true, upd: orbUpd });
      st.hold = ORB_T + .5; st.holdMove = 'fgSus';
      later(st, ORB_T, api => {
        api.strike(tx, ty, ORB_R, D * 5.0, '#ffd2a0', 'crater');
        api.world(tx, ty, 330, D * 4.4, 'crater');
        api.burst(tx, ty - 50, '#ffb060', 34);
        api.shake(30);
      });
      later(st, ORB_T + .35, api => {
        for (let i = 0; i < 8; i++) { const b = i * TAU / 8 + .2; api.strike(tx + Math.cos(b) * ORB_RING, ty + Math.sin(b) * ORB_RING, 120, D * 1.6, null, i % 2 ? null : 'fire', true); }
        api.shake(18);
      });
    },
    // ---- Indra
    chidori(z, st, api, D) {
      const d = (st.spots && st.spots[0] && st.spots[0].d) || 600;
      dashFrom(z, st, api, D, st.aim, d);
      st.hold = CHI_T + .1 + CHI_GAP + CHI_T + .2; st.holdMove = 'chidori';
      later(st, CHI_T + .1, api => {
        const p = api.player, a2 = p ? Math.atan2(p.y - z.y, p.x - z.x) : st.aim + Math.PI;
        const d2 = p ? Math.max(380, Math.min(760, Math.hypot(p.x - z.x, p.y - z.y) + 160)) : 600;
        addFx(st, { kind: 'chmark', x: R0(z.x), y: R0(z.y), a: +a2.toFixed(3), len: R0(d2), dur: CHI_GAP });
        later(st, CHI_GAP, api => dashFrom(z, st, api, D, a2, d2));
      });
      st.spots = null;
    },
    magatama(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim;
      addFx(st, { kind: 'mag', x: R0(x), y: R0(y), a, dur: 1.9, big: true });
      st.hold = .9; st.holdMove = 'magatama';
      for (let i = 0; i < 3; i++) {
        const b = a + (i - 1) * MAG_SPREAD, cb = Math.cos(b), sb = Math.sin(b), t0 = .05 + [1, 0, 2][i] * .16;
        later(st, t0 + .2, api => api.line(x + cb * 40, y + sb * 40, x + cb * MAG_LEN, y + sb * MAG_LEN, MAG_W, D * 1.5, i === 1 ? 'shockwave' : null));
        later(st, t0 + MAG_LEN / MAG_SPEED, api => { api.strike(x + cb * MAG_LEN, y + sb * MAG_LEN, 120, D * 1.2, null, 'shockwave', true); api.shake(9); });
      }
    },
    inAma(z, st, api, D) {
      const x = st.tx, y = st.ty;
      addFx(st, { kind: 'ring', x, y, T: RING_T, dur: RING_T + 3.4, nt: RING_T + .5, dmg: D, upd: ringUpd });
      for (let k = 0; k <= 4; k++) {
        const t = k / 4 * RING_T, r = RING_R1 + (RING_R0 - RING_R1) * easeIn(k / 4);
        later(st, t, api => {
          for (let i = 0; i < 14; i++) { const b = i * TAU / 14 + k * .2; api.strike(x + Math.cos(b) * r, y + Math.sin(b) * r, 62, D * .9, null, null, true); }
          api.shake(5);
        });
      }
      later(st, RING_T, api => { api.strike(x, y, RING_R0 + 20, D * 2.3, null, 'fire', true); api.world(x, y, 150, D * 2.4, 'fire'); api.shake(16); });
      st.hold = .7; st.holdMove = 'inAma';
    },
    sword(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
      addFx(st, { kind: 'cleave', x: R0(x), y: R0(y), a, dur: 2.2, big: true });
      st.hold = 1.0; st.holdMove = 'sword';
      later(st, .12, api => {
        api.line(x + ca * 50, y + sa * 50, x + ca * CLV_LEN, y + sa * CLV_LEN, CLV_W, D * 3.6, 'crater');
        for (const [t, r] of [[.35, 140], [.7, 160], [1, 200]]) api.world(x + ca * CLV_LEN * t, y + sa * CLV_LEN * t, r, D * 3.4, 'crater', a);
        api.shake(26);
      });
      later(st, .45, api => {
        for (const t of [.25, .5, .75, 1]) api.strike(x + ca * CLV_LEN * t, y + sa * CLV_LEN * t, 170, D * .9, null, null, true);
        api.shake(10);
      });
    },
    kirin(z, st, api, D) {
      const tx = st.tx, ty = st.ty;
      addFx(st, { kind: 'kirin', x: tx, y: ty, side: z.x < tx ? -1 : 1, dur: 2.8, big: true });
      st.hold = KIRIN_DIVE + .3; st.holdMove = 'kirin';
      later(st, KIRIN_DIVE, api => {
        api.strike(tx, ty, KIRIN_R, D * 4.2, '#d8ecff', 'lightning');
        api.world(tx, ty, 290, D * 4, 'crater');
        api.burst(tx, ty - 40, '#e6f4ff', 30);
        api.shake(28);
      });
      later(st, KIRIN_DIVE + .45, api => {
        for (let i = 0; i < 6; i++) { const b = i * TAU / 6 + .4; api.strike(tx + Math.cos(b) * 340, ty + Math.sin(b) * 340, 90, D * 1.0, null, i % 2 ? null : 'lightning', true); }
        api.shake(10);
      });
    },
    arrow(z, st, api, D) {
      const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
      const x1 = x + ca * 60, y1 = y + sa * 60, x2 = x + ca * (60 + ARW_LEN), y2 = y + sa * (60 + ARW_LEN);
      addFx(st, { kind: 'arrow', x: R0(x), y: R0(y), a, dur: 2.7, big: true });
      st.hold = .95; st.holdMove = 'arrow';
      later(st, .05, api => {
        api.line(x1, y1, x2, y2, ARW_W, D * 5.6, 'crater');
        for (const [t, r] of [[.3, 150], [.65, 180], [1, 250]]) api.world(x + ca * (60 + ARW_LEN * t), y + sa * (60 + ARW_LEN * t), r, D * 4.6, 'crater', a);
        api.shake(32);
      });
      for (const t of [.4, .75]) later(st, t, api => api.line(x1, y1, x2, y2, ARW_W, D * .6, null));
    }
  };

  function dashFrom(z, st, api, D, a, d) {
    const x0 = z.x, y0 = z.y, ca = Math.cos(a), sa = Math.sin(a);
    st.dash = { x0: R0(x0), y0: R0(y0), a: +a.toFixed(3), d: R0(d), t: 0, T: CHI_T };
    addFx(st, { kind: 'chidori', x: R0(x0), y: R0(y0), a: +a.toFixed(3), len: R0(d), dur: 1.3 });
    z.kageDash = CHI_T + .15; z.angle = a;
    later(st, CHI_T * .5, api => api.line(x0, y0, x0 + ca * d, y0 + sa * d, CHI_W, D * 2.3, 'lightning'));
    later(st, CHI_T, api => {
      api.strike(z.x, z.y, 145, D * 1.4, null, 'lightning', true);
      api.world(z.x, z.y, 110, D * 1.8, 'lightning', a);
      api.shake(13);
    });
  }

  function dragonUpd(fx, dt, api) {
    if (fx.age < fx.nt || fx.age > fx.dur - .6) return;
    fx.nt += .5;
    for (const s of [.25, .5, .75]) { const p = pathAt(fx.pts, s); api.strike(p.x, p.y, 75, fx.dmg * .25, null, null, true); }
    const e = fx.pts[fx.pts.length - 1];
    api.strike(e[0], e[1], 150, fx.dmg * .3, null, null, true);
  }
  function fballUpd(fx, dt, api) {
    if (fx.age < fx.nt || fx.age > fx.dur - .6) return;
    fx.nt += .5;
    api.strike(fx.x1, fx.y1, 210, fx.dmg * .3, null, null, true);
  }
  function amaUpd(fx, dt, api) {
    if (fx.age < fx.nt || fx.age > fx.dur - .7) return;
    fx.nt += .45;
    for (const s of [.2, .4, .6, .8]) { const p = pathAt(fx.pts, s); api.strike(p.x, p.y, AMA_W, fx.dmg * .3, null, null, true); }
    const e = fx.pts[fx.pts.length - 1];
    api.strike(e[0], e[1], AMA_END * .9, fx.dmg * .34, null, null, true);
  }
  function ringUpd(fx, dt, api) {
    if (fx.age < fx.nt || fx.age > fx.dur - .6) return;
    fx.nt += .45;
    api.strike(fx.x, fx.y, RING_R0, fx.dmg * .32, null, null, true);
  }
  function orbUpd(fx, dt, api) {
    if (fx.age < fx.nt || fx.age > fx.dur - .8) return;
    fx.nt += .5;
    api.strike(fx.tx, fx.ty, 230, fx.dmg * .35, null, null, true);
  }
  // Kotoamatsukami: the genjutsu bends the target's will toward the centre of the eye.
  function kotoUpd(fx, dt, api) {
    const p = api.player;
    if (p) {
      fx.px = R0(p.x); fx.py = R0(p.y);
      fx.pin = Math.hypot(p.x - fx.x, p.y - fx.y) < KOTO_R + 60 ? 1 : 0;
    }
    if (fx.age >= fx.nt && fx.age < fx.T) {
      fx.nt += .32;
      if (p && fx.pin) {
        const d = Math.hypot(p.x - fx.x, p.y - fx.y);
        api.knockback({ x: fx.x, y: fx.y }, KOTO_R + 80, -Math.min(75, Math.max(0, d - 25)), fx.dmg * .12);
      }
    }
    if (!fx.boom && fx.age >= fx.T) {
      fx.boom = 1;
      api.strike(fx.x, fx.y, KOTO_BOOM, fx.dmg * 2.8, null, 'shockwave', true);
      api.world(fx.x, fx.y, 230, fx.dmg * 3, 'vortex');
      api.shake(22);
    }
  }

  // Paint the big cached art when the boss appears rather than in the middle of the fight.
  function prewarm(id) {
    try {
      if (id === 'shisui') { susSprite('shisui'); kotoSpr(); crowSpr(0); crowSpr(1); shurSpr(); dheadSpr(); }
      else if (id === 'fugaku') { susSprite('fugaku'); shurSpr(); for (let v = 0; v < 6; v++) amaFlame(v); }
      else if (id === 'indra') { susSprite('indra'); yasakaSpr(); for (let v = 0; v < 6; v++) amaFlame(v); }
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
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.hide = 0; st.dash = null; st.sus = Math.max(0, st.sus - dt * 2); return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.hide = Math.max(0, st.hide - dt);
    st.blinkCd -= dt;
    z.kageDash = Math.max(0, (z.kageDash || 0) - dt);
    z.armorScale = m.armor || 1;
    // Chidori dash: he rides the lightning along the lane.
    if (st.dash) {
      const ds = st.dash, t0 = ds.t;
      ds.t = Math.min(ds.T, ds.t + dt);
      const step = (ds.t - t0) / ds.T * ds.d, ca = Math.cos(ds.a), sa = Math.sin(ds.a);
      const nx = z.x + ca * step, ny = z.y + sa * step;
      if (!api.blocked(nx, ny, z.r || 14)) { z.x = nx; z.y = ny; } else ds.t = ds.T;
      if (ds.t >= ds.T) st.dash = null;
    }

    const p = api.player;
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if ((st.move === 'arrow' && st.windup > .55) || (st.move === 'magatama' && st.windup > .4) || (st.move === 'sword' && st.windup > .45) || (st.move === 'shSus' && st.windup > .6))
        if (p) st.aim = +turn(st.aim, aimAt(z, p), dt * 1.2).toFixed(3);
      if (st.windup === 0) {
        CAST[st.move](z, st, api, api.damage || 60);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.susMove = SUS_OF[st.move] ? st.move : st.susMove;
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0) {
      st.holdMove = '';
      st.timer -= dt;
      const d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      if (p && d > 720 && d < 1600 && st.blinkCd <= 0) { flicker(z, st, api, m.blink === 'fugaku' ? 440 : 380, null, m.blink); st.blinkCd = m.blink === 'shisui' ? 1.8 : 2.6; }
      else if (st.timer <= 0 && p && d < 900) announce(z, st, m, api);
    }
    // Susanoo level: rises through a Susanoo windup, holds while it acts, then fades.
    const sm = st.windup > 0 && SUS_OF[st.move] ? st.move : st.hold > 0 && SUS_OF[st.holdMove] ? st.holdMove : '';
    if (sm) { st.susMove = sm; st.sus = Math.min(1, st.sus + dt * (sm === 'arrow' || sm === 'fgSus' || sm === 'shSus' ? .9 : 2.2)); }
    else st.sus = Math.max(0, st.sus - dt * 1.4);
    st.sus = +st.sus.toFixed(3);
    z.bossWindup = st.windup > 0 ? st.windup : st.hold > 0 && st.holdMove !== 'shunshin' && st.holdMove !== 'chidori' && st.holdMove !== 'crows' ? st.hold : 0;
    const planted = (st.windup > 0 && (SUS_OF[st.move] || st.move === 'koto' || st.move === 'kirin')) || (st.hold > 0 && (SUS_OF[st.holdMove] || st.holdMove === 'koto' || st.holdMove === 'crows')) || st.dash;
    z.speedScale = planted ? .02 : m.blink === 'fugaku' ? .95 : 1.08;
  }

  // ------------------------------------------------------------------ cached art
  // Amaterasu's black fire (VFXKit.flame layout: base at y = 114 of 128), six variants.
  function amaFlame(v) {
    v = ((v % 6) + 6) % 6;
    return Kit().sprite('uc-ama:' + v, 64, 128, g => {
      const tongue = (cx, hw, h, lean, seed, grow) => {
        const N = 18, L = [], R = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, w = (hw + grow) * Math.pow(1 - t, .85) * (1 + .3 * Math.sin(t * 10 + seed) * t);
          const xc = cx + Math.sin(t * 4 + seed) * hw * .45 * t + lean * t * t * hw * 1.4, y = 114 - t * (h + grow * 1.5);
          L.push([xc - w, y]); R.push([xc + w, y]);
        }
        g.beginPath(); g.moveTo(L[0][0], L[0][1]);
        for (const p of L) g.lineTo(p[0], p[1]);
        for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
        g.quadraticCurveTo(cx, 114 + hw * .5, L[0][0], L[0][1]); g.closePath(); g.fill();
      };
      const sd = v * 1.9 + .7, lean = (hash(v + 13) - .5) * 1.3;
      const set = grow => {
        tongue(32, 17, 102, lean, sd, grow);
        tongue(16, 10, 58 + hash(v + 1) * 20, -.7, sd + 2, grow);
        tongue(48, 10, 66 + hash(v + 4) * 20, .7, sd + 4, grow);
        tongue(25, 7, 80, lean - .5, sd + 6, grow);
        tongue(41, 6, 50, lean + .6, sd + 8, grow);
      };
      g.fillStyle = 'rgba(140,16,60,.92)'; set(2.8);
      g.fillStyle = '#1c0410'; set(1.2);
      g.fillStyle = '#000000'; set(0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(90,20,90,.3)'; g.beginPath(); g.ellipse(32, 108, 7, 14, 0, 0, TAU); g.fill();
    });
  }
  function blackFire(ctx, x, y, r, n, seed, hk, time, tick, alpha) {
    if (!(hk > .02) || !(alpha > .01)) return;
    ctx.globalAlpha = .96 * alpha;
    for (let i = 0; i < n; i++) {
      const aa = hash(seed + i * 7.7) * TAU, d = Math.sqrt(hash(seed * 1.3 + i * 1.37)) * .92;
      const dx = Math.cos(aa) * d, dy = Math.sin(aa) * d * .5;
      const h = (44 + hash(seed + i * 5.3) * 70) * hk * (1 - d * .35) * (.86 + .14 * Math.sin(time * 9 + i * 1.7));
      if (h < 6) continue;
      ctx.drawImage(amaFlame(i + tick), x + dx * r - h * .36, y + dy * r - h * FLAME_BASE, h * .72, h);
    }
    ctx.globalAlpha = 1;
  }

  // Kotoamatsukami: Shisui's four-bladed Mangekyō as a disc laid on the ground.
  function kotoSpr() {
    return Kit().sprite('uc-koto', 256, 256, g => {
      g.translate(128, 128);
      g.fillStyle = 'rgba(165,8,22,.6)'; g.beginPath(); g.arc(0, 0, 124, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(20,0,4,.92)'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 121, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,100,110,.85)'; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, 114, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,80,90,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.stroke();
      const P = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
      g.fillStyle = 'rgba(14,0,6,.9)';
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4;
        const p0 = P(a, 24), c1 = P(a + .05, 92), p1 = P(a + .22, 120), p2 = P(a + .98, 86), c2 = P(a + .62, 42), p3 = P(a + .4, 24);
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]); g.lineTo(p2[0], p2[1]);
        g.quadraticCurveTo(c2[0], c2[1], p3[0], p3[1]); g.closePath(); g.fill();
      }
      g.beginPath(); g.arc(0, 0, 28, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,120,120,.5)'; g.beginPath(); g.arc(-8, -9, 6, 0, TAU); g.fill();
    });
  }
  // A crow (side view, facing right) with a Sharingan-red eye; f = wings up (0) / down (1).
  function crowSpr(f) {
    return Kit().sprite('uc-crow' + f, 64, 52, g => {
      g.translate(30, 28); g.lineJoin = 'round';
      const O = '#020205', B = '#17151d';
      const fillPath = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fillStyle = B; g.fill(); g.strokeStyle = O; g.lineWidth = 1.8; g.stroke(); };
      fillPath(f ? [[-2, 1], [-12, 20], [-6, 17], [-3, 24], [2, 16], [5, 22], [9, 3]] : [[-2, -1], [-14, -21], [-6, -16], [-4, -25], [1, -15], [6, -23], [9, -3]]);
      fillPath([[-11, 1], [-25, -4], [-22, 2], [-26, 7], [-11, 5]]);
      g.beginPath(); g.ellipse(0, 2, 13, 6.4, -.08, 0, TAU); g.fillStyle = B; g.fill(); g.strokeStyle = O; g.lineWidth = 1.8; g.stroke();
      g.beginPath(); g.arc(12, -2.6, 5.6, 0, TAU); g.fill(); g.stroke();
      fillPath([[16, -4.2], [25, -1.6], [16, .2]]);
      g.fillStyle = '#ff2a32'; g.beginPath(); g.arc(13.4, -3.6, 1.6, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,130,170,.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(0, -3, 9, -2); g.stroke();
      g.beginPath(); g.moveTo(f ? -4 : -6, f ? 6 : -8); g.lineTo(f ? -8 : -10, f ? 14 : -16); g.stroke();
    });
  }
  // Four-point steel shuriken with a ring hole.
  function shurSpr() {
    return Kit().sprite('uc-shur', 44, 44, g => {
      g.translate(22, 22); g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 5.4 : 20; if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(r, 0); }
      g.closePath(); g.fillStyle = '#8b93a4'; g.fill(); g.strokeStyle = '#141820'; g.lineWidth = 2.2; g.stroke();
      g.fillStyle = '#dfe6f2';
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); g.lineTo(Math.cos(a + .55) * 6, Math.sin(a + .55) * 6); g.closePath(); g.fill(); }
      g.fillStyle = '#141820'; g.beginPath(); g.arc(0, 0, 3.2, 0, TAU); g.fill();
    });
  }
  // Fire dragon head facing +x: open jaws, swept horns, flame mane.
  function dheadSpr() {
    return Kit().sprite('uc-dhead', 180, 120, g => {
      g.translate(40, 60); g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#5e1204';
      const shape = (pts, fill, w = 3) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = O; g.lineWidth = w; g.stroke(); };
      // mane of flame tongues behind the head
      for (let i = 0; i < 6; i++) shape([[-6 + i * 8, -18 + i * 2], [-40 - i * 4, -44 + i * 10], [-14 + i * 8, -8 + i * 2]], i % 2 ? '#ff9a2a' : '#e8501a', 2);
      // horns
      shape([[10, -22], [-34, -52], [-20, -40], [0, -14]], '#ffd86a', 2.6);
      shape([[22, -20], [-8, -54], [4, -36], [26, -14]], '#ffe490', 2.6);
      // lower jaw (open)
      shape([[0, 8], [40, 14], [96, 30], [132, 40], [128, 48], [84, 42], [30, 36], [-6, 24]], '#e8581a');
      g.fillStyle = '#fff6d8'; for (let i = 0; i < 6; i++) { const x = 44 + i * 14; g.beginPath(); g.moveTo(x, 18 + i * 3.4); g.lineTo(x + 5, 10 + i * 3.4); g.lineTo(x + 9, 19 + i * 3.4); g.fill(); }
      // mouth interior
      shape([[30, 4], [126, 10], [124, 30], [40, 18]], '#7a1606', 2);
      // upper head and snout
      shape([[-14, -10], [10, -26], [50, -30], [96, -20], [138, -8], [146, 2], [128, 10], [70, 4], [20, 8], [-10, 10]], '#ff8a22');
      g.fillStyle = '#fff6d8'; for (let i = 0; i < 7; i++) { const x = 34 + i * 14; g.beginPath(); g.moveTo(x, 6 - i * .3); g.lineTo(x + 5, 14 - i * .3); g.lineTo(x + 9, 5 - i * .3); g.fill(); }
      g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(10, -22); g.quadraticCurveTo(70, -32, 136, -8); g.lineTo(120, -6); g.quadraticCurveTo(60, -20, 14, -12); g.fill();
      // eye + brow ridge
      shape([[40, -22], [70, -28], [64, -16]], '#b83008', 2);
      g.fillStyle = '#fff3a0'; g.beginPath(); g.ellipse(58, -17, 7, 3.6, -.2, 0, TAU); g.fill(); g.strokeStyle = O; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#3a0800'; g.beginPath(); g.ellipse(59, -17, 1.6, 3.2, 0, 0, TAU); g.fill();
      // whiskers
      g.strokeStyle = '#ffcf60'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(120, 4); g.quadraticCurveTo(110, 40, 70, 56); g.moveTo(132, -2); g.quadraticCurveTo(150, -40, 118, -56); g.stroke();
    });
  }
  // Yasaka Magatama: three violet-black tomoe joined in a spinning ring.
  function yasakaSpr() {
    return Kit().sprite('uc-yasaka', 140, 140, g => {
      g.translate(70, 70); g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = 'rgba(14,8,52,.9)'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(160,150,255,.95)'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = 'rgba(245,245,255,.9)'; g.lineWidth = 1.4; g.stroke();
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3, cx = Math.cos(a) * 44, cy = Math.sin(a) * 44;
        g.save(); g.translate(cx, cy); g.rotate(a + Math.PI * .5);
        g.beginPath(); g.arc(0, 0, 17, 0, TAU);
        g.moveTo(-17, 0); g.bezierCurveTo(-18, 26, 6, 44, 34, 40); g.bezierCurveTo(14, 30, 10, 16, 17, 0);
        g.fillStyle = '#1a1244'; g.fill();
        g.strokeStyle = 'rgba(14,8,52,.95)'; g.lineWidth = 4; g.stroke();
        g.strokeStyle = 'rgba(170,160,255,.95)'; g.lineWidth = 2; g.stroke();
        g.fillStyle = 'rgba(200,195,255,.55)'; g.beginPath(); g.arc(-5, -6, 6, 0, TAU); g.fill();
        g.restore();
      }
    });
  }

  // Susanoo (upper body rising out of chakra flames), front view, 520×560 canvas, ground at (260, 545).
  // Shisui: green samurai with a kuwagata crest; Fugaku: horned orange-red oni; Indra: winged
  // violet-blue tengu with a flame crest.
  const SW = 520, SH = 560, SOX = 260, SOY = 545;
  function susSprite(kind) {
    return Kit().sprite('uc-sus-' + kind, SW, SH, g => {
      const P = SUS[kind];
      g.translate(SOX, SOY); g.lineJoin = 'round'; g.lineCap = 'round';
      const F = a => `rgba(${P.rgb},${a})`, Dp = a => `rgba(${P.deep},${a})`, Lt = a => `rgba(${P.light},${a})`;
      const shape = (build, fill, w = 1) => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 3.6 * w; g.stroke(); g.strokeStyle = Lt(.95); g.lineWidth = 1.3 * w; g.stroke(); };
      const vg = (y0, y1, c0, c1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
      if (kind === 'indra') {
        // Wings: two layers of long pointed feathers fanning from the shoulders.
        for (const side of [-1, 1]) for (const layer of [0, 1]) {
          const n = layer ? 6 : 8;
          for (let k = n - 1; k >= 0; k--) {
            const u = (k + (layer ? .5 : 0)) / n, rx = side * (70 + u * 150), ry = -300 - u * 110 + u * u * 40;
            const ang = Math.PI / 2 - side * (.25 + u * 1.25), L = (layer ? 110 : 175) + u * (layer ? 40 : 80), W = layer ? 15 : 20;
            const tx = rx + Math.cos(ang) * L, ty = ry + Math.sin(ang) * L, nx = -Math.sin(ang) * W, ny = Math.cos(ang) * W;
            shape(() => {
              g.beginPath(); g.moveTo(rx - nx * .4, ry - ny * .4);
              g.quadraticCurveTo(rx + (tx - rx) * .55 + nx, ry + (ty - ry) * .55 + ny, tx, ty);
              g.quadraticCurveTo(rx + (tx - rx) * .5 - nx * .7, ry + (ty - ry) * .5 - ny * .7, rx + nx * .4, ry + ny * .4); g.closePath();
            }, layer ? vg(ry, ty, F(.7), Dp(.55)) : vg(ry, ty, Dp(.7), Dp(.5)), .75);
          }
          g.beginPath(); g.moveTo(side * 70, -300); g.quadraticCurveTo(side * 150, -420, side * 225, -380);
          g.strokeStyle = P.ink; g.lineWidth = 14; g.stroke(); g.strokeStyle = F(.95); g.lineWidth = 9; g.stroke(); g.strokeStyle = Lt(.95); g.lineWidth = 2; g.stroke();
        }
      }
      if (kind === 'fugaku') {
        // Flame mane rising behind the oni head.
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * .32, x0 = Math.cos(a) * 40, y0 = -372 + Math.sin(a) * 30;
          shape(() => { g.beginPath(); g.moveTo(x0 - 14, y0 + 10); g.quadraticCurveTo(x0 + Math.cos(a) * 50 - 10, y0 + Math.sin(a) * 60, x0 + Math.cos(a) * 92, y0 + Math.sin(a) * 96); g.quadraticCurveTo(x0 + Math.cos(a) * 40 + 12, y0 + Math.sin(a) * 50, x0 + 14, y0 + 10); g.closePath(); }, i % 2 ? F(.6) : Dp(.6), .8);
        }
      }
      // Torso: armoured chest tapering to the waist where the body dissolves into flame.
      shape(() => {
        g.beginPath(); g.moveTo(-74, -40); g.quadraticCurveTo(-96, -150, -112, -230); g.quadraticCurveTo(-120, -300, -60, -322);
        g.lineTo(60, -322); g.quadraticCurveTo(120, -300, 112, -230); g.quadraticCurveTo(96, -150, 74, -40); g.closePath();
      }, vg(-322, -40, Dp(.72), Dp(.4)), 1.1);
      // ribs showing through
      for (let i = 0; i < 4; i++) {
        const y = -250 + i * 34, w = 92 - i * 8;
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 8, y); g.quadraticCurveTo(s * w * .6, y - 16, s * w, y + 10); g.strokeStyle = P.ink; g.lineWidth = 7; g.stroke(); g.strokeStyle = Lt(.75); g.lineWidth = 3; g.stroke(); }
      }
      g.beginPath(); g.moveTo(0, -310); g.lineTo(0, -120); g.strokeStyle = P.ink; g.lineWidth = 8; g.stroke(); g.strokeStyle = Lt(.8); g.lineWidth = 3; g.stroke();
      // chest plates
      for (const s of [-1, 1]) shape(() => {
        g.beginPath(); g.moveTo(s * 6, -306); g.quadraticCurveTo(s * 80, -310, s * 92, -250); g.quadraticCurveTo(s * 56, -222, s * 6, -232); g.closePath();
      }, vg(-310, -222, F(.72), Dp(.6)), .9);
      // abdominal lames
      for (let r = 0; r < 3; r++) {
        const y = -200 + r * 40, w = 70 - r * 6;
        shape(() => { g.beginPath(); g.moveTo(-w, y); g.quadraticCurveTo(0, y - 8, w, y); g.lineTo(w - 4, y + 30); g.quadraticCurveTo(0, y + 24, -w + 4, y + 30); g.closePath(); }, F(.42 - r * .06), .75);
      }
      // pauldrons
      for (const s of [-1, 1]) for (let t = 2; t >= 0; t--) {
        shape(() => {
          const cx = s * (118 + t * 8), cy = -298 + t * 20;
          g.beginPath(); g.moveTo(cx - s * 50, cy - 8); g.quadraticCurveTo(cx, cy - 40, cx + s * 52, cy - 2);
          g.quadraticCurveTo(cx + s * 46, cy + 18, cx + s * 8, cy + 20); g.quadraticCurveTo(cx - s * 34, cy + 16, cx - s * 50, cy - 8); g.closePath();
        }, t ? Dp(.7) : vg(-340, -280, F(.85), Dp(.75)));
      }
      // neck
      shape(() => { g.beginPath(); g.ellipse(0, -326, 36, 12, 0, 0, TAU); }, Dp(.8), .9);
      // Head
      const hy = -372;
      if (kind === 'shisui') {
        // kuwagata crest: two long horns sweeping up and out from the brow
        for (const s of [-1, 1]) shape(() => { g.beginPath(); g.moveTo(s * 10, hy - 30); g.quadraticCurveTo(s * 40, hy - 70, s * 82, hy - 140); g.quadraticCurveTo(s * 34, hy - 84, s * 22, hy - 28); g.closePath(); }, vg(hy - 140, hy - 28, Lt(.9), F(.8)), .9);
        shape(() => { g.beginPath(); g.moveTo(-46, hy + 4); g.quadraticCurveTo(-50, hy - 46, 0, hy - 52); g.quadraticCurveTo(50, hy - 46, 46, hy + 4); g.lineTo(58, hy + 14); g.lineTo(-58, hy + 14); g.closePath(); }, vg(hy - 52, hy + 14, F(.85), Dp(.8)));
        shape(() => { g.beginPath(); g.moveTo(-30, hy - 4); g.lineTo(30, hy - 4); g.lineTo(26, hy + 26); g.lineTo(0, hy + 40); g.lineTo(-26, hy + 26); g.closePath(); }, F(.7), .9);
        shape(() => { g.beginPath(); g.moveTo(-26, hy + 18); g.lineTo(26, hy + 18); g.lineTo(18, hy + 34); g.lineTo(-18, hy + 34); g.closePath(); }, Dp(.9), .7);
        g.fillStyle = 'rgba(4,30,14,.95)';
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, hy + 4); g.lineTo(s * 24, hy - 2); g.lineTo(s * 22, hy + 8); g.lineTo(s * 8, hy + 10); g.closePath(); g.fill(); }
        shape(() => { g.beginPath(); g.ellipse(0, hy - 30, 10, 8, 0, 0, TAU); }, Lt(.9), .6);
      } else if (kind === 'fugaku') {
        for (const s of [-1, 1]) shape(() => { g.beginPath(); g.moveTo(s * 18, hy - 34); g.quadraticCurveTo(s * 40, hy - 60, s * 36, hy - 96); g.quadraticCurveTo(s * 56, hy - 60, s * 38, hy - 24); g.closePath(); }, vg(hy - 96, hy - 24, Lt(.9), F(.8)), .9);
        shape(() => { g.beginPath(); g.moveTo(-50, hy + 6); g.quadraticCurveTo(-54, hy - 44, 0, hy - 48); g.quadraticCurveTo(54, hy - 44, 50, hy + 6); g.quadraticCurveTo(44, hy + 46, 0, hy + 50); g.quadraticCurveTo(-44, hy + 46, -50, hy + 6); g.closePath(); }, vg(hy - 48, hy + 50, F(.85), Dp(.8)));
        // heavy brow, glaring eyes, tusked mouth
        shape(() => { g.beginPath(); g.moveTo(-40, hy - 8); g.lineTo(0, hy + 2); g.lineTo(40, hy - 8); g.lineTo(38, hy - 18); g.lineTo(0, hy - 8); g.lineTo(-38, hy - 18); g.closePath(); }, Dp(.95), .8);
        g.fillStyle = 'rgba(40,6,0,.95)';
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 18, hy + 6, 10, 6, s * .25, 0, TAU); g.fill(); }
        shape(() => { g.beginPath(); g.moveTo(-28, hy + 26); g.quadraticCurveTo(0, hy + 40, 28, hy + 26); g.lineTo(24, hy + 36); g.quadraticCurveTo(0, hy + 48, -24, hy + 36); g.closePath(); }, 'rgba(50,8,0,.95)', .7);
        g.fillStyle = Lt(.95);
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 20, hy + 30); g.lineTo(s * 26, hy + 14); g.lineTo(s * 14, hy + 30); g.closePath(); g.fill(); }
      } else {
        // flame crest rising from the helm
        shape(() => { g.beginPath(); g.moveTo(-10, hy - 34); g.quadraticCurveTo(-34, hy - 84, -14, hy - 140); g.quadraticCurveTo(0, hy - 96, 8, hy - 90); g.quadraticCurveTo(16, hy - 112, 36, hy - 124); g.quadraticCurveTo(16, hy - 76, 12, hy - 34); g.closePath(); }, vg(hy - 140, hy - 34, Lt(.92), F(.85)), .9);
        for (const s of [-1, 1]) shape(() => { g.beginPath(); g.moveTo(s * 22, hy - 20); g.quadraticCurveTo(s * 66, hy - 36, s * 96, hy - 92); g.quadraticCurveTo(s * 62, hy - 52, s * 34, hy - 6); g.closePath(); }, F(.8), .85);
        shape(() => { g.beginPath(); g.ellipse(0, hy, 38, 42, 0, 0, TAU); }, vg(hy - 42, hy + 42, F(.85), Dp(.85)));
        shape(() => { g.beginPath(); g.moveTo(-30, hy - 8); g.lineTo(30, hy - 8); g.lineTo(28, hy + 18); g.lineTo(18, hy + 38); g.lineTo(0, hy + 46); g.lineTo(-18, hy + 38); g.lineTo(-28, hy + 18); g.closePath(); }, Lt(.55), .9);
        g.fillStyle = 'rgba(8,4,40,.95)';
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, hy + 2); g.lineTo(s * 26, hy - 4); g.lineTo(s * 24, hy + 6); g.lineTo(s * 8, hy + 9); g.closePath(); g.fill(); }
        // the long tengu nose
        shape(() => { g.beginPath(); g.moveTo(4, hy + 6); g.quadraticCurveTo(44, hy + 10, 82, hy + 30); g.lineTo(8, hy + 22); g.closePath(); }, F(.85), .8);
        shape(() => { g.beginPath(); g.moveTo(-22, hy + 28); g.lineTo(22, hy + 28); g.lineTo(16, hy + 40); g.lineTo(-16, hy + 40); g.closePath(); }, 'rgba(20,12,80,.92)', .7);
      }
    });
  }
  // Runtime Susanoo: flames at the waist, the cached body, eye glows. lvl 0..1, s = scale.
  function drawSus(ctx, kind, x, y, lvl, time, f, s = .72) {
    if (!(lvl > .02)) return null;
    const K = Kit(), P = SUS[kind], fy = y + 6 + (1 - lvl) * 70, flick = .82 + .18 * Math.sin(time * 13) * Math.sin(time * 7.3);
    ctx.save();
    K.glow(ctx, x, y, 190 * s / .72, P.deep, .4 * lvl, false, .5);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, fy - 230 * s, 300 * s, P.glow, .3 * lvl);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, lvl * flick * .92);
    ctx.translate(x, fy); if (f < 0) ctx.scale(-1, 1);
    ctx.drawImage(susSprite(kind), -SOX * s, -SOY * s, SW * s, SH * s);
    ctx.restore();
    // chakra flames swallowing the waist
    const tick = Math.floor(time * 11);
    ctx.save();
    ctx.globalAlpha = .75 * lvl;
    for (let i = 0; i < 9; i++) {
      const ox = (i - 4) * 26 * s / .72, h = (120 - Math.abs(i - 4) * 14 + hash(i * 3) * 30) * lvl * s / .72 * (.85 + .15 * Math.sin(time * 9 + i));
      ctx.drawImage(K.flame((i + tick) % 6, P.flame, 'uc' + kind), x + ox - h * .3, fy - 20 * s - h * FLAME_BASE, h * .6, h);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    const ey = fy - 372 * s;
    for (const e of [-1, 1]) K.glow(ctx, x + e * 16 * s * f, ey + 4 * s, 16 * s / .72, '255,250,240', lvl, true);
    ctx.restore();
    return { fy, s };
  }
  function susArm(ctx, P, sx, sy, hx, hy, s, lvl, bend = 0, fist = 0) {
    const ex = (sx + hx) / 2 + bend, ey = Math.min(sy, hy) + 10 * s;
    for (const [x0, y0, x1, y1, w] of [[sx, sy, ex, ey, 44], [ex, ey, hx, hy, 36]]) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = P.ink.replace('.92', (.75 * lvl).toFixed(2)); ctx.lineWidth = (w + 7) * s; ctx.stroke();
      ctx.strokeStyle = `rgba(${P.rgb},${.6 * lvl})`; ctx.lineWidth = w * s; ctx.stroke();
      ctx.strokeStyle = `rgba(${P.light},${.45 * lvl})`; ctx.lineWidth = w * .3 * s; ctx.stroke();
    }
    // forearm armour plate and bracer bands
    const fdx = hx - ex, fdy = hy - ey, fl = Math.hypot(fdx, fdy) || 1, ux = fdx / fl, uy = fdy / fl, nx = -uy, ny = ux, pw = 30 * s;
    ctx.beginPath();
    ctx.moveTo(ex + ux * 10 * s + nx * pw, ey + uy * 10 * s + ny * pw); ctx.lineTo(hx - ux * 26 * s + nx * pw * .75, hy - uy * 26 * s + ny * pw * .75);
    ctx.lineTo(hx - ux * 26 * s - nx * pw * .75, hy - uy * 26 * s - ny * pw * .75); ctx.lineTo(ex + ux * 10 * s - nx * pw, ey + uy * 10 * s - ny * pw); ctx.closePath();
    ctx.fillStyle = `rgba(${P.deep},${.6 * lvl})`; ctx.fill();
    ctx.strokeStyle = P.ink.replace('.92', (.8 * lvl).toFixed(2)); ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = `rgba(${P.light},${.85 * lvl})`; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath();
    for (const t of [.3, .6]) { const bx = ex + fdx * t, by = ey + fdy * t; ctx.moveTo(bx + nx * pw * .9, by + ny * pw * .9); ctx.lineTo(bx - nx * pw * .9, by - ny * pw * .9); }
    ctx.strokeStyle = `rgba(${P.light},${.7 * lvl})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineWidth = 1.8; ctx.strokeStyle = `rgba(${P.light},${.9 * lvl})`; ctx.fillStyle = `rgba(${P.rgb},${.85 * lvl})`;
    ctx.beginPath(); ctx.arc(sx, sy, 24 * s, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, 17 * s, 0, TAU); ctx.fill(); ctx.stroke();
    const fr = (fist ? 34 : 22) * s;
    ctx.beginPath(); ctx.ellipse(hx, hy, fr, fr * .8, Math.atan2(hy - ey, hx - ex), 0, TAU); ctx.fill(); ctx.stroke();
    if (fist) {
      ctx.strokeStyle = P.ink; ctx.lineWidth = 3 * s / .72;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(hx - fr * .5, hy + i * fr * .32); ctx.lineTo(hx + fr * .5, hy + i * fr * .32); ctx.stroke(); }
    }
  }
  // A glowing chakra blade from (hx, hy) to (tx, ty).
  function chakraBlade(ctx, P, hx, hy, tx, ty, w, a) {
    if (!(a > .01)) return;
    const dx = tx - hx, dy = ty - hy, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const path = k => {
      ctx.beginPath(); ctx.moveTo(hx + nx * w * .5 * k, hy + ny * w * .5 * k);
      ctx.lineTo(tx - dx / l * w * 1.4 + nx * w * .55 * k, ty - dy / l * w * 1.4 + ny * w * .55 * k);
      ctx.lineTo(tx, ty); ctx.lineTo(hx - nx * w * .4 * k, hy - ny * w * .4 * k); ctx.closePath();
    };
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = P.ink.replace('.92', (.85 * a).toFixed(2)); path(1.5); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${P.rgb},${.85 * a})`; path(1); ctx.fill();
    ctx.fillStyle = `rgba(${P.light},${.8 * a})`; path(.45); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${.9 * a})`; path(.14); ctx.fill();
    Kit().glow(ctx, tx, ty, w * 2.2, P.glow, .7 * a, true);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ primitives
  function ring(ctx, x, y, r, w, color, squash = .5) {
    if (!(r > 1)) return;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * squash, 0, 0, TAU); ctx.stroke();
  }
  function inkRing(ctx, x, y, r, a, w, inkRgb, rgb) {
    if (!(a > .01)) return;
    ring(ctx, x, y, r, w + 5, `rgba(${inkRgb},${.55 * a})`);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ring(ctx, x, y, r, w, `rgba(${rgb},${.9 * a})`);
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
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10) {
    if (alpha <= .01) return;
    const K = Kit(), dust = K.puff('dust');
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  function chirps(ctx, x, y, n, rad, len, time, seed, alpha, rgb = '235,248,255') {
    if (!(alpha > .01)) return;
    ctx.strokeStyle = `rgba(${rgb},${alpha})`; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const cyc = time * 5 + hash(seed + i), ph = frac(cyc), m = Math.floor(cyc);
      if (ph > .8) continue;
      const a = hash(seed + i * 3.1 + m * 7.7) * TAU, d = rad * (.3 + ph);
      const c = Math.cos(a), s = Math.sin(a) * .7, j = (hash(seed + i + m) - .5) * len;
      ctx.moveTo(x + c * d, y + s * d);
      ctx.lineTo(x + c * (d + len * .5) - s * j, y + s * (d + len * .5) + c * j);
      ctx.lineTo(x + c * (d + len), y + s * (d + len));
    }
    ctx.stroke();
  }
  function groundRays(ctx, x, y, n, r0, r1, time, seed, alpha, width = 1.5, pal = BLUE, base = inkB) {
    const k = Kit();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(seed + i) * .5 + (k.wobble(seed + i, time, 2) - .5) * .4;
      const c = Math.cos(a), s = Math.sin(a) * .5;
      k.forkedBolt(ctx, x + c * r0, y + s * r0, x + c * r1, y + s * r1, seed + i * 9, time,
        { jitter: 10 + r1 * .03, alpha, width, pal, base: base(alpha), step: Math.max(18, (r1 - r0) / 12), forks: 1, forkLen: 18 + r1 * .05, rate: 22, snap: true });
    }
  }
  function crescent(ctx, x, y, r, a0, a1, thick, color) {
    const mid = (a0 + a1) / 2;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, a0, a1);
    ctx.quadraticCurveTo(x + Math.cos(mid) * (r - thick * 2), y + Math.sin(mid) * (r - thick * 2), x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    ctx.fill();
  }
  // Fire ball: rolling flame puffs round a white-hot heart over a dark smoke rim.
  function fireOrb(ctx, x, y, r, time, seed, alpha, blackCore) {
    if (!(alpha > .01) || !(r > 2)) return;
    const K = Kit(), fire = K.puff('fire'), smk = K.puff('smoke');
    for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + time * .8 + seed; K.stamp(ctx, smk, x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .45 + r * .1, r * .55, .5 * alpha); }
    for (let i = 0; i < 9; i++) {
      const a = i * TAU / 9 - time * 2.4 + seed, d = r * (.38 + .1 * Math.sin(time * 7 + i));
      K.stamp(ctx, fire, x + Math.cos(a) * d, y + Math.sin(a) * d * .85, r * (.5 + .08 * Math.sin(time * 9 + i * 2)), alpha);
    }
    K.stamp(ctx, fire, x, y, r * .7, alpha);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 1.6, '255,120,30', .45 * alpha);
    K.glow(ctx, x, y, r * .7, '255,230,170', .8 * alpha, true);
    ctx.globalCompositeOperation = 'source-over';
    if (blackCore) {
      K.glow(ctx, x, y, r * .62, '0,0,0', .95 * alpha);
      K.glow(ctx, x, y, r * .4, '0,0,0', alpha);
      ctx.globalCompositeOperation = 'lighter';
      ring(ctx, x, y, r * .44, 3, `rgba(255,60,110,${.8 * alpha})`, .9);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function ghost(ctx, id, x, y, f, frame, a, flash = .7) {
    const S = Spr();
    if (S && a > .02) S.draw(ctx, id, x, y, { facing: f, frame, alpha: Math.min(1, a), flash });
  }

  // ------------------------------------------------------------------ telegraph painters
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
      } else if (s.k === 'seg') markLine(ctx, s.x1, s.y1, Math.atan2(s.y2 - s.y1, s.x2 - s.x1), Math.hypot(s.x2 - s.x1, s.y2 - s.y1), s.w, rgb, k, time, false, false);
      else if (s.k === 'path') markPath(ctx, s.pts, s.w, rgb, k, time);
      else if (s.k === 'cone') markSector(ctx, z.x, z.y, st.aim, s.len, s.half, rgb, k, time, 1);
      else if (s.k === 'sector') markSector(ctx, z.x, z.y, st.aim, s.r, s.half, rgb, k, time, .5);
    }
  }

  // ================================================================== SHISUI
  // ---- Shunshin no Shisui: after-images at every spot he cut through, streaks between them.
  function shunG(ctx, fx, time) {
    for (const p of fx.pts) {
      const u = fx.age - p.t, s = fx.spots[p.i];
      if (u < .6) dustRing(ctx, p.x0, p.y0, 26 + u * 60, 7, 12 + u * 14, .7 * (1 - u / .6), fx.seed + p.i, 4);
      if (!s) continue;
      const f = 1 - win(u, .3, 1.1);
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, .5);
      ctx.strokeStyle = `rgba(30,10,16,${.45 * f})`; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, s.r * .9, p.a - 1.1, p.a + 1.1); ctx.stroke();
      ctx.restore();
      if (p.i === fx.spots.length - 1) cracks(ctx, s.x, s.y, 120 * easeOut(u * 4), 9, fx.seed, f, 2.4);
    }
  }
  function shunO(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    ctx.save();
    fx.pts.forEach((p, j) => {
      const u = fx.age - p.t, s = fx.spots[p.i], f = Math.cos(p.a) >= 0 ? 1 : -1;
      // the streak of the flicker itself
      if (u < .22) {
        const g = 1 - u / .22;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(20,6,10,${.55 * g})`; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(p.x0, p.y0 - L); ctx.lineTo(p.x, p.y - L); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,90,90,${.6 * g})`; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.9 * g})`; ctx.lineWidth = 2; ctx.stroke();
        const dx = p.x - p.x0, dy = p.y - p.y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        ctx.strokeStyle = `rgba(255,255,255,${.5 * g})`; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const o of [-18, -9, 9, 18]) { ctx.moveTo(p.x0 + nx * o + dx * .2, p.y0 - L + ny * o * .6 + dy * .2); ctx.lineTo(p.x0 + nx * o + dx * .8, p.y0 - L + ny * o * .6 + dy * .8); }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      // after-images: where he left, and where he stood until the next cut
      if (u < .5) ghost(ctx, 'shisui', p.x0, p.y0, f, 'run3', .55 * (1 - u / .5), .9);
      const nxt = fx.pts[j + 1];
      if (nxt) { const v = fx.age - nxt.t; if (v < .55) ghost(ctx, 'shisui', p.x, p.y, f, 'attack', .7 * (1 - v / .55), .6); }
      // the cut: a red-white crescent through the spot
      if (s && u < .35) {
        const q = easeOut(u / .1), g = 1 - win(u, .1, .35), R = s.r * 1.05, sd = j % 2 ? 1 : -1;
        const a0 = p.a - sd * 1.3, a1 = a0 + sd * 2.6 * q, lo = Math.min(a0, a1), hi = Math.max(a0, a1);
        if (hi - lo > .05) {
          ctx.save(); ctx.translate(s.x, s.y - L * .7); ctx.scale(1, .55);
          crescent(ctx, 0, 0, R + 4, lo, hi, 15 * g + 2, `rgba(40,4,10,${.75 * g})`);
          crescent(ctx, 0, 0, R, lo + .04, hi - .02, 12 * g + 2, `rgba(220,40,50,${.85 * g})`);
          ctx.globalCompositeOperation = 'lighter';
          crescent(ctx, 0, 0, R - 2, lo + .08, hi - .05, 3 * g + .6, `rgba(255,250,250,${g})`);
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, s.x, s.y - L, 60 * g + 10, '255,120,120', .7 * g, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    });
    ctx.restore();
  }

  // ---- Great Dragon Fire: a fire dragon writhing down the lane, a blast at the end, burning trail.
  function dragonG(ctx, fx, time) {
    const K = Kit(), s = clamp01(fx.age / fx.T), fade = 1 - win(fx.age, fx.dur - .8, fx.dur), n = fx.pts.length - 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const upto = Math.max(1, Math.ceil(n * s));
    ctx.strokeStyle = `rgba(40,14,6,${.32 * fade})`; ctx.lineWidth = 56;
    ctx.beginPath(); ctx.moveTo(fx.pts[0][0], fx.pts[0][1]); for (let i = 1; i <= upto; i++) ctx.lineTo(fx.pts[i][0], fx.pts[i][1]); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,110,30,${.22 * fade * (.8 + .2 * Math.sin(time * 9))})`; ctx.lineWidth = 30; ctx.stroke();
    if (fx.age < fx.T) { const h = pathAt(fx.pts, s); K.glow(ctx, h.x, h.y, 170, '255,120,30', .55, false, .5); }
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age > fx.T) {
      const u = fx.age - fx.T, e = fx.pts[n];
      cracks(ctx, e[0], e[1], DR_END * .8 * easeOut(u * 4), 10, fx.seed, fade, 2.4);
      if (u < .8) dustRing(ctx, e[0], e[1], DR_END * (.5 + u), 14, 20 + u * 26, .6 * (1 - u / .8), fx.seed, 8 + u * 20);
    }
  }
  function dragonO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), s = clamp01(fx.age / fx.T), fire = K.puff('fire'), smk = K.puff('smoke'), m = ctx.getTransform();
    ctx.save();
    if (fx.age < fx.T + .12) {
      const gone = clamp01((fx.age - fx.T) / .12), N = 26, BX = [], BY = [];
      // body: a writhing serpentine trunk of fire trailing back along the lane, thickest behind the head
      for (let j = 0; j <= N; j++) {
        const sj = Math.max(0, s - j * .018), p = pathAt(fx.pts, sj);
        BX.push(p.x); BY.push(p.y - L - 22 - Math.sin(sj * 18 + time * 6) * 12);
      }
      if (gone < 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const trunk = (w, c) => {
          for (let j = 0; j < N; j++) {
            if (BX[j] === BX[j + 1] && BY[j] === BY[j + 1]) continue;
            ctx.strokeStyle = c; ctx.lineWidth = w * (1 - j / (N + 4)) * (1 - gone);
            ctx.beginPath(); ctx.moveTo(BX[j], BY[j]); ctx.lineTo(BX[j + 1], BY[j + 1]); ctx.stroke();
          }
        };
        trunk(78, 'rgba(110,22,6,.75)');
        trunk(62, 'rgba(232,74,20,.95)');
        ctx.globalCompositeOperation = 'lighter';
        trunk(30, 'rgba(255,190,70,.8)');
        trunk(10, 'rgba(255,245,210,.85)');
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let j = N; j >= 1; j -= 2) {
        if (BX[j] === BX[j - 1] && BY[j] === BY[j - 1]) continue;
        const r = (40 - j * 1.1) * (1 - gone);
        K.stamp(ctx, smk, BX[j] - 6, BY[j] + 16, r * 1.1, .35);
        K.stamp(ctx, fire, BX[j] + Math.sin(j * 2.1 + time * 9) * 8, BY[j] - 12, r * .8, .9);
      }
      // flame scales licking up off the back
      const tk = Math.floor(time * 12);
      for (let j = 2; j < N; j += 3) {
        if (BX[j] === BX[j - 1] && BY[j] === BY[j - 1]) continue;
        const hh = (60 - j * 1.4) * (1 - gone) * (.85 + .15 * Math.sin(time * 11 + j));
        if (hh > 8) ctx.drawImage(K.flame((j + tk) % 6), BX[j] - hh * .3, BY[j] - 18 - hh * FLAME_BASE, hh * .6, hh);
      }
      const h = pathAt(fx.pts, s), hx = h.x, hy = h.y - L - 26;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx, hy, 140, '255,150,40', .7 * (1 - gone));
      ctx.globalCompositeOperation = 'source-over';
      if (gone < 1) {
        ctx.setTransform(m); ctx.translate(hx, hy); ctx.rotate(h.a); if (Math.cos(h.a) < 0) ctx.scale(1, -1);
        const sc = .95 + .05 * Math.sin(time * 20);
        ctx.globalAlpha = 1 - gone;
        ctx.drawImage(dheadSpr(), -40 * sc - 30, -60 * sc, 180 * sc, 120 * sc);
        ctx.globalAlpha = 1;
        ctx.setTransform(m);
      }
    }
    if (fx.age > fx.T) {
      const u = fx.age - fx.T, e = fx.pts[fx.pts.length - 1];
      if (u < 1.6) K.fx.fireBlast(ctx, e[0], e[1], DR_END, u, 1 - win(u, .9, 1.6), time, fx.seed);
      // the lane keeps burning
      const tick = Math.floor(time * 12), fade = clamp01((fx.dur - fx.age) / .8) * easeOut(u / .3);
      ctx.globalAlpha = .85 * fade;
      for (let i = 1; i < 12; i++) {
        const p = pathAt(fx.pts, i / 12), hh = (34 + hash(i * 3.1 + fx.seed) * 30) * (.85 + .15 * Math.sin(time * 8 + i));
        ctx.drawImage(K.flame((i + tick) % 6), p.x - hh * .3 + (hash(i) - .5) * 30, p.y - hh * FLAME_BASE, hh * .6, hh);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---- Shadow Shuriken: a fan of shuriken, a second hidden wave flying in their shadows.
  function shurG(ctx, fx, time) {
    const f = 1 - win(fx.age, .9, fx.dur);
    ctx.strokeStyle = `rgba(30,30,40,${.3 * f})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let w = 0; w < 2; w++) {
      const n = w ? SH_N - 1 : SH_N, c = (n - 1) / 2;
      for (let i = 0; i < n; i++) {
        // a short scuff on the ground under each shuriken, trailing behind it
        const b = fx.a + (i - c) * SH_SPREAD, t0 = (w ? SH_W2 : .02) + Math.abs(i - c) * .015, d = 30 + Math.max(0, fx.age - t0) * SH_SPEED;
        if (d <= 30 || d > SH_LEN + 200) continue;
        const d0 = Math.max(30, d - 200), d1 = Math.min(SH_LEN, d);
        if (d1 <= d0) continue;
        ctx.moveTo(fx.x + Math.cos(b) * d0, fx.y + Math.sin(b) * d0); ctx.lineTo(fx.x + Math.cos(b) * d1, fx.y + Math.sin(b) * d1);
      }
    }
    ctx.stroke();
  }
  function shurO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), img = shurSpr(), m = ctx.getTransform();
    ctx.save();
    for (let w = 0; w < 2; w++) {
      const n = w ? SH_N - 1 : SH_N, c = (n - 1) / 2;
      for (let i = 0; i < n; i++) {
        const b = fx.a + (i - c) * SH_SPREAD, cb = Math.cos(b), sb = Math.sin(b), t0 = (w ? SH_W2 : .02) + Math.abs(i - c) * .015, u = fx.age - t0;
        if (u < 0) continue;
        const d = 30 + u * SH_SPEED;
        if (d < SH_LEN) {
          const x = fx.x + cb * d, y = fx.y + sb * d - L, sz = w ? 20 : 24;
          K.stamp(ctx, K.puff('smoke'), x, y + L, 10, .35, .4);
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(16,16,26,.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - cb * 90, y - sb * 90); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = w ? 'rgba(255,90,90,.55)' : 'rgba(220,230,255,.7)'; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          ctx.setTransform(m); ctx.translate(x, y); ctx.rotate(time * 38 + i);
          ctx.globalAlpha = w ? Math.min(1, u * 6) : 1;
          ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
          ctx.globalAlpha = 1; ctx.setTransform(m);
        } else {
          const v = (d - SH_LEN) / SH_SPEED, a = 1 - win(v, .3, .7);
          if (a <= 0) continue;
          const x = fx.x + cb * SH_LEN, y = fx.y + sb * SH_LEN;
          ctx.globalAlpha = a;
          ctx.setTransform(m); ctx.translate(x, y - 6); ctx.scale(1, .55); ctx.rotate(i);
          ctx.drawImage(img, -10, -10, 20, 20);
          ctx.setTransform(m); ctx.globalAlpha = 1;
          if (v < .12) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - 8, 30, '255,240,220', 1 - v / .12, true); ctx.globalCompositeOperation = 'source-over'; }
        }
      }
    }
    ctx.restore();
  }

  // ---- Crow clone: he bursts into a murder of crows that sweeps the cone and reforms on the target.
  function crowPos(fx, i, t, L) {
    const seed = fx.seed, ang = fx.a + (hash(i * 3.1 + seed) - .5) * 2 * CROW_HALF, dist = CROW_LEN * (.5 + .45 * hash(i * 7.7 + seed));
    const t0 = hash(i * 1.9 + seed) * .12, h0 = L + 30 + hash(i * 4.3 + seed) * 50;
    const ox = fx.x0 + Math.cos(ang) * dist, oy = fx.y0 + Math.sin(ang) * dist;
    const u = (t - t0) / .5;
    if (u < 0) return null;
    if (u <= 1) { const e = easeOut(u); return [fx.x0 + (ox - fx.x0) * e, fx.y0 + (oy - fx.y0) * e - h0 - Math.sin(Math.PI * u) * 40, Math.cos(ang) >= 0 ? 1 : -1, 1]; }
    if (t < CROW_T) {
      const v = easeIn((t - t0 - .5) / (CROW_T - t0 - .5)), sw = Math.sin(v * Math.PI) * 60 * (hash(i + seed) - .5);
      return [ox + (fx.tx - ox) * v + sw, oy + (fx.ty - oy) * v - h0 + (h0 - L) * v, fx.tx >= ox ? 1 : -1, 1];
    }
    const w = (t - CROW_T) / .8;
    if (w > 1) return null;
    const b = hash(i * 9.3 + seed) * TAU, d = 50 + 220 * easeOut(w);
    return [fx.tx + Math.cos(b) * d, fx.ty + Math.sin(b) * d * .5 - L - 60 * w - 40 * hash(i + 2), Math.cos(b) >= 0 ? 1 : -1, 1 - w];
  }
  function crowsG(ctx, fx, time) {
    const L = LIFT();
    ctx.fillStyle = 'rgba(12,10,18,.22)';
    for (let i = 0; i < CROW_N; i++) {
      const p = crowPos(fx, i, fx.age, L);
      if (!p) continue;
      ctx.globalAlpha = p[3]; ctx.beginPath(); ctx.ellipse(p[0], p[1] + L + 40, 11, 4, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const u = fx.age - CROW_T;
    if (u > 0 && u < .9) {
      inkRing(ctx, fx.tx, fx.ty, 30 + CROW_R * easeOut(u * 3), 1 - u / .9, 3, '40,4,10', '255,110,110');
      cracks(ctx, fx.tx, fx.ty, CROW_R * .8 * easeOut(u * 5), 8, fx.seed, 1 - u / .9, 2.2);
    }
  }
  function crowsO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), tick = Math.floor(time * 14);
    ctx.save();
    // the burst where his body came apart
    if (fx.age < .35) {
      const q = fx.age / .35;
      K.stamp(ctx, K.puff('violet'), fx.x0, fx.y0 - L, 30 + 60 * q, .8 * (1 - q));
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x0, fx.y0 - L - 10, 80, '255,60,70', .6 * (1 - q), true); ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < CROW_N; i++) {
      const p = crowPos(fx, i, fx.age, L);
      if (!p) continue;
      const sz = 40 * (.8 + .45 * hash(i * 5.1 + fx.seed)), img = crowSpr((tick + i) % 2);
      ctx.globalAlpha = p[3];
      ctx.save(); ctx.translate(p[0], p[1]); if (p[2] < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -sz * .5, -sz * .42, sz, sz * .81);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // black feathers drifting down over the whole sweep
    ctx.fillStyle = 'rgba(16,14,22,.85)';
    for (let i = 0; i < 30; i++) {
      const t0 = hash(i * 2.7 + fx.seed) * .9, u = (fx.age - t0) / .9;
      if (u < 0 || u > 1) continue;
      const ang = fx.a + (hash(i * 6.1) - .5) * 2 * CROW_HALF, d = CROW_LEN * hash(i * 8.3 + fx.seed);
      const x = fx.x0 + Math.cos(ang) * d + Math.sin(time * 3 + i) * 12, y = fx.y0 + Math.sin(ang) * d - L - 70 + u * 80;
      ctx.globalAlpha = 1 - u;
      ctx.beginPath(); ctx.ellipse(x, y, 5, 1.8, Math.sin(time * 4 + i) * 1.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // reforming: a red flash and a slash
    const u = fx.age - CROW_T;
    if (u > -.1 && u < .4) {
      const g = 1 - clamp01(u / .4);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.tx, fx.ty - L, 120 * g + 20, '255,80,80', g, true);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(fx.tx, fx.ty - L * .7); ctx.scale(1, .55);
      const a = Math.atan2(fx.ty - fx.y0, fx.tx - fx.x0);
      crescent(ctx, 0, 0, CROW_R, a - 1.3, a + 1.3, 14 * g + 2, `rgba(40,4,10,${.75 * g})`);
      ctx.globalCompositeOperation = 'lighter';
      crescent(ctx, 0, 0, CROW_R - 3, a - 1.2, a + 1.25, 4 * g + 1, `rgba(255,240,240,${g})`);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---- Kotoamatsukami: the Mangekyō opens on the ground and draws the target's will inward.
  function kotoG(ctx, fx, time) {
    const K = Kit(), k = easeOut(fx.age / .35), T = fx.T, fade = 1 - win(fx.age, T, T + .25), R = KOTO_R * k;
    if (fade <= 0) {
      const u = fx.age - T;
      K.fx.shockRing(ctx, fx.x, fx.y, KOTO_R * 1.1, u / 1, 1 - u, '255,90,100');
      cracks(ctx, fx.x, fx.y, KOTO_BOOM * easeOut(u * 4), 12, fx.seed, 1 - win(u, .4, 1.1), 2.6);
      return;
    }
    K.glow(ctx, fx.x, fx.y, R * 1.2, '40,0,10', .6 * fade, false, .5);
    const spin = time * .7 + easeIn(fx.age / T) * 7;
    K.spin(ctx, kotoSpr(), fx.x, fx.y, R * .98, spin, .9 * fade, .5);
    // ripples flowing inward
    for (let i = 0; i < 4; i++) {
      const ph = frac(time * .9 + i / 4), r = R * (1 - ph) + 20;
      inkRing(ctx, fx.x, fx.y, r, fade * ph, 2.2, '40,0,10', '255,90,100');
    }
    inkRing(ctx, fx.x, fx.y, R, fade, 3.5, '40,0,10', '255,110,120');
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, R * .5, '255,40,60', .35 * fade * (.8 + .2 * Math.sin(time * 6)), false, .5);
    ctx.globalCompositeOperation = 'source-over';
  }
  function kotoO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), T = fx.T, fade = 1 - win(fx.age, T, T + .2);
    ctx.save();
    if (fade > 0) {
      ctx.globalCompositeOperation = 'lighter';
      // red threads: his eye to the eye on the ground, and on to the target held in the genjutsu
      if (z) {
        const S = Spr(), ey = z.y - (S ? S.height('shisui') * .8 : 70);
        ctx.strokeStyle = `rgba(255,60,70,${.5 * fade})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(z.x, ey);
        for (let i = 1; i <= 10; i++) { const t = i / 10; ctx.lineTo(z.x + (fx.x - z.x) * t + Math.sin(t * 9 + time * 8) * 8, ey + (fx.y - 30 - ey) * t - Math.sin(Math.PI * t) * 60); }
        ctx.stroke();
        K.glow(ctx, z.x, ey, 12, '255,40,60', .7 * fade, true);
      }
      if (fx.pin) {
        const px = fx.px, py = fx.py - L - 40;
        ctx.strokeStyle = `rgba(255,70,80,${.55 * fade})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y - 20); ctx.lineTo(px, py + 40); ctx.stroke();
        for (let i = 0; i < 5; i++) { const t = frac(time * 1.4 + i / 5), x = px + (fx.x - px) * t, y = py + 40 + (fx.y - 20 - py - 40) * t; K.glow(ctx, x, y, 10, '255,60,70', fade, true); }
        ctx.globalCompositeOperation = 'source-over';
        K.spin(ctx, kotoSpr(), px, py - 30, 18, -time * 6, .95 * fade);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, px, py - 30, 34, '255,40,60', .5 * fade);
      }
      ctx.globalCompositeOperation = 'source-over';
      // crow feathers spiralling into the eye
      ctx.fillStyle = 'rgba(14,12,20,.9)';
      for (let i = 0; i < 16; i++) {
        const ph = frac(time * .35 + hash(i * 3.3 + fx.seed)), r = KOTO_R * (1 - ph * .85), a = hash(i * 7.1) * TAU + ph * 5;
        ctx.globalAlpha = fade * Math.min(1, ph * 4) * (1 - ph * .5);
        ctx.beginPath(); ctx.ellipse(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r * .5 - 30 - 50 * (1 - ph), 6, 2, a, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      const u = fx.age - T;
      if (u < .5) {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x, fx.y - 40, 320 * (.4 + u), '255,80,90', 1 - u / .5, true, .7);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (u < 1) K.fx.debris(ctx, fx.x, fx.y, 200, u, fx.seed, '#2a1418', 14);
    }
    ctx.restore();
  }

  // ---- Susanoo blade (ultimate): two great sweeps across the fan, then a thrust down the lane.
  function shsusPhase(fx) {
    const t = fx.age;
    if (t < SS_S2) return { mode: 'slash', p: clamp01(t / .2), dir: 1, u: t };
    if (t < SS_TH) return { mode: 'slash', p: clamp01((t - SS_S2) / .2), dir: -1, u: t - SS_S2 };
    return { mode: 'thrust', p: clamp01((t - SS_TH) / .1), u: t - SS_TH };
  }
  function shsusG(ctx, fx, time, z) {
    const f = Math.cos(fx.a) >= 0 ? 1 : -1, lvl = 1 - win(fx.age, fx.dur - .6, fx.dur);
    drawSus(ctx, 'shisui', fx.x, fx.y, lvl, time, f);
    // ground cuts left by both sweeps and the thrust
    const fade = 1 - win(fx.age, 1.4, fx.dur);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5); ctx.lineCap = 'round';
    for (const [t0, rr] of [[0, SS_R * .82], [SS_S2, SS_R * .66]]) {
      if (fx.age < t0 + .05) continue;
      const q = easeOut((fx.age - t0) / .2);
      ctx.strokeStyle = `rgba(6,30,14,${.45 * fade})`; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(0, 0, rr, fx.a - SS_HALF, fx.a - SS_HALF + 2 * SS_HALF * q); ctx.stroke();
      ctx.strokeStyle = `rgba(150,255,190,${.55 * fade})`; ctx.lineWidth = 2.4; ctx.stroke();
    }
    ctx.restore();
    if (fx.age > SS_TH) {
      const u = fx.age - SS_TH, ca = Math.cos(fx.a), sa = Math.sin(fx.a), ex = fx.x + ca * SS_LEN, ey = fx.y + sa * SS_LEN;
      ctx.strokeStyle = `rgba(6,30,14,${.5 * fade})`; ctx.lineWidth = 40; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x + ca * 60, fx.y + sa * 60); ctx.lineTo(fx.x + ca * SS_LEN * easeOut(u / .1), fx.y + sa * SS_LEN * easeOut(u / .1)); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(90,240,140,${.45 * fade})`; ctx.lineWidth = 10; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      if (u < 1) { inkRing(ctx, ex, ey, 40 + 220 * easeOut(u * 2.5), 1 - u, 4, '6,30,14', '150,255,190'); cracks(ctx, ex, ey, 220 * easeOut(u * 4), 12, fx.seed, 1 - win(u, .4, 1.2), 3); }
    }
  }
  function shsusO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), P = SUS.shisui, x = fx.x, y = fx.y, f = Math.cos(fx.a) >= 0 ? 1 : -1, s = .72;
    const lvl = 1 - win(fx.age, fx.dur - .6, fx.dur), fy = y + 6, sx = x + f * 120 * s, sy = fy - 300 * s, ph = shsusPhase(fx);
    if (lvl <= .02) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (ph.mode === 'slash') {
      const a0 = ph.dir > 0 ? fx.a - SS_HALF : fx.a + SS_HALF, th = a0 + ph.dir * 2 * SS_HALF * easeOut(ph.p), R = SS_R * (ph.dir > 0 ? .9 : .78);
      const tx = x + Math.cos(th) * R, ty = y + Math.sin(th) * R * .5 - L, hx = x + Math.cos(th) * 150 * s, hy = fy - 210 * s + Math.sin(th) * 50 * s;
      // the swept arc: a broad crescent trail of green chakra
      const g = 1 - win(ph.u, .2, .45), lo = Math.min(a0, th), hi = Math.max(a0, th);
      if (hi - lo > .05 && g > 0) {
        ctx.save(); ctx.translate(x, y - L); ctx.scale(1, .5);
        crescent(ctx, 0, 0, R + 8, lo, hi, 34 * g + 4, `rgba(4,40,18,${.6 * g})`);
        crescent(ctx, 0, 0, R, lo + .03, hi - .02, 28 * g + 3, `rgba(60,210,110,${.8 * g})`);
        ctx.globalCompositeOperation = 'lighter';
        crescent(ctx, 0, 0, R - 4, lo + .05, hi - .04, 10 * g + 2, `rgba(200,255,220,${.9 * g})`);
        crescent(ctx, 0, 0, R * .72, lo + .2, hi - .15, 8 * g + 1, `rgba(90,240,140,${.5 * g})`);
        ctx.restore();
      }
      susArm(ctx, P, sx, sy, hx, hy, s, lvl, f * 40 * s);
      chakraBlade(ctx, P, hx, hy, tx, ty, 26, lvl);
      if (ph.u < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, tx, ty, 120, '150,255,190', 1 - ph.u / .25, true); ctx.globalCompositeOperation = 'source-over'; }
    } else {
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a), e = easeOut(ph.p), g = 1 - win(ph.u, .35, 1.1);
      const hx = x + ca * 190 * s, hy = fy - 220 * s + sa * 60 * s, tx = x + ca * (200 + (SS_LEN - 200) * e), ty = y + sa * (200 + (SS_LEN - 200) * e) - L * .8;
      susArm(ctx, P, sx, sy, hx, hy, s, lvl, f * 30 * s);
      chakraBlade(ctx, P, hx, hy, tx, ty, 40 * g + 8, Math.max(g, .2) * lvl);
      if (ph.u < .6) {
        const q = ph.u / .6;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, tx, ty, 260 * (.5 + q), '120,255,170', (1 - q) * .9, true, .7);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (ph.u < 1.2) K.fx.debris(ctx, x + ca * SS_LEN, y + sa * SS_LEN, 220, ph.u, fx.seed, '#123a20', 16);
    }
    ctx.restore();
  }

  // ================================================================== FUGAKU
  // ---- Great Fireball: breathed out, rolls down the lane and bursts into a sea of fire.
  function fballG(ctx, fx, time) {
    const K = Kit(), p = clamp01(fx.age / fx.T), x = fx.x0 + (fx.x1 - fx.x0) * p, y = fx.y0 + (fx.y1 - fx.y0) * p;
    const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(44,16,6,${.3 * fade})`; ctx.lineWidth = FB_W * 1.4;
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(x, y); ctx.stroke();
    if (fx.age < fx.T) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 200, '255,120,30', .55, false, .5); ctx.globalCompositeOperation = 'source-over'; }
    else {
      const u = fx.age - fx.T;
      K.glow(ctx, fx.x1, fx.y1, FB_R * 1.2, '40,12,4', .55 * fade, false, .5);
      cracks(ctx, fx.x1, fx.y1, FB_R * .85 * easeOut(u * 4), 12, fx.seed, fade, 2.8);
      if (u < .9) dustRing(ctx, fx.x1, fx.y1, FB_R * (.6 + u * .8), 16, 22 + u * 30, .6 * (1 - u / .9), fx.seed, 8 + u * 24);
    }
  }
  function fballO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), p = clamp01(fx.age / fx.T);
    ctx.save();
    if (fx.age < fx.T) {
      const e = easeIn(p) * .6 + p * .4, x = fx.x0 + (fx.x1 - fx.x0) * e, y = fx.y0 + (fx.y1 - fx.y0) * e - L - 60, r = 80 + 40 * p;
      // the stream from his mouth feeding the ball
      if (fx.age < .45 && z) {
        const S = Spr(), my = z.y - (S ? S.height('fugaku') * .72 : 64), g = 1 - fx.age / .45;
        for (let i = 1; i <= 6; i++) { const t = i / 7; K.stamp(ctx, K.puff('fire'), z.x + (x - z.x) * t, my + (y - my) * t, 16 + 30 * t, g); }
      }
      for (let j = 1; j <= 5; j++) { const t = Math.max(0, e - j * .06); K.stamp(ctx, K.puff('fire'), fx.x0 + (fx.x1 - fx.x0) * t, fx.y0 + (fx.y1 - fx.y0) * t - L - 60, r * (1 - j * .14), .7 - j * .1); }
      fireOrb(ctx, x, y, r, time, fx.seed, 1, false);
    } else {
      const u = fx.age - fx.T;
      if (u < 1.8) K.fx.fireBlast(ctx, fx.x1, fx.y1, FB_R, u, 1 - win(u, 1, 1.8), time, fx.seed);
      const tick = Math.floor(time * 12), fade = clamp01((fx.dur - fx.age) / .8) * easeOut(u / .4);
      ctx.globalAlpha = .9 * fade;
      for (let i = 0; i < 14; i++) {
        const a = hash(i * 3.7 + fx.seed) * TAU, d = Math.sqrt(hash(i * 1.3 + fx.seed)) * FB_R * .75, hh = (40 + hash(i * 5.1) * 40) * (1 - d / FB_R * .5) * (.85 + .15 * Math.sin(time * 9 + i));
        const x = fx.x1 + Math.cos(a) * d, y = fx.y1 + Math.sin(a) * d * .5;
        ctx.drawImage(K.flame((i + tick) % 6), x - hh * .3, y - hh * FLAME_BASE, hh * .6, hh);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---- Phoenix Flower: a volley of small fireballs arcing onto the marked spots.
  function phoenixG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    for (const s of fx.spots) {
      const u = fx.age - s.t - PH_FLY;
      if (u < 0) { markCircle(ctx, s.x, s.y, PH_HIT, MOVES.phoenix.rgb, clamp01(fx.age / (s.t + PH_FLY)), time, true, true); continue; }
      ctx.fillStyle = `rgba(40,14,6,${.42 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 46, 22, 0, 0, TAU); ctx.fill();
      if (u < .5) inkRing(ctx, s.x, s.y, 14 + 70 * easeOut(u / .5), 1 - u / .5, 2.4, '50,14,4', '255,170,80');
    }
  }
  function phoenixO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), fire = K.puff('fire'), m = ctx.getTransform(), hx = z ? z.x : fx.hx, hy = (z ? z.y : fx.hy) - L - 22;
    ctx.save();
    fx.spots.forEach((s, i) => {
      const u = (fx.age - s.t) / PH_FLY;
      if (u < 0) return;
      if (u <= 1) {
        const x = hx + (s.x - hx) * u, y = hy + (s.y - L * .5 - hy) * u - Math.sin(Math.PI * u) * 110;
        for (let j = 1; j <= 3; j++) { const v = Math.max(0, u - j * .07); K.stamp(ctx, fire, hx + (s.x - hx) * v, hy + (s.y - L * .5 - hy) * v - Math.sin(Math.PI * v) * 110, 18 - j * 4, .7 - j * .18); }
        K.stamp(ctx, fire, x, y, 22, 1);
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 44, '255,150,50', .8, true); ctx.globalCompositeOperation = 'source-over';
      } else {
        const v = fx.age - s.t - PH_FLY;
        if (v < .8) {
          const q = v / .8;
          for (let j = 0; j < 5; j++) { const a = j * TAU / 5 + i; K.stamp(ctx, fire, s.x + Math.cos(a) * 30 * easeOut(q * 2), s.y - 20 - q * 30 + Math.sin(a) * 12, 26 * (1 - q * .6), 1 - q); }
          K.stamp(ctx, K.puff('smoke'), s.x, s.y - 40 - q * 50, 24 + q * 26, .5 * (1 - q));
          if (v < .15) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x, s.y - 20, 90, '255,210,140', 1 - v / .15, true); ctx.globalCompositeOperation = 'source-over'; }
        }
        // the shuriken that was hidden in the flame, stuck in the ground
        const w = v - .14;
        if (w > 0 && w < .9) {
          ctx.globalAlpha = 1 - win(w, .5, .9);
          ctx.setTransform(m); ctx.translate(s.x + 6, s.y - 6); ctx.scale(1, .55); ctx.rotate(i);
          ctx.drawImage(shurSpr(), -9, -9, 18, 18);
          ctx.setTransform(m); ctx.globalAlpha = 1;
          if (w < .1) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x + 6, s.y - 8, 26, '255,245,230', 1 - w / .1, true); ctx.globalCompositeOperation = 'source-over'; }
        }
      }
    });
    ctx.restore();
  }

  // ---- Police kunai net: kunai pin steel wires over the target, then fire races down every wire.
  function netWireAt(w, t) { return [w[0] + (w[2] - w[0]) * t, w[1] + (w[3] - w[1]) * t]; }
  function netG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.lineCap = 'round';
    fx.wires.forEach((w, i) => {
      const k = easeOut((fx.age - i * .02) / .22);
      if (k <= 0) return;
      const e = netWireAt(w, k), u = fx.age - NET_FIRE - i * .04;
      // wire shadow
      ctx.strokeStyle = `rgba(20,18,26,${.3 * fade})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w[0], w[1] + 6); ctx.lineTo(e[0], e[1] + 6); ctx.stroke();
      if (u > 0) {
        const q = easeOut(u / .35), f = netWireAt(w, q);
        ctx.strokeStyle = `rgba(44,16,6,${.4 * fade})`; ctx.lineWidth = 26;
        ctx.beginPath(); ctx.moveTo(w[0], w[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,120,30,${.3 * fade})`; ctx.lineWidth = 14; ctx.stroke();
        K.glow(ctx, f[0], f[1], 70, '255,140,40', .6 * fade * (1 - win(u, .35, .8)), false, .5);
        ctx.globalCompositeOperation = 'source-over';
      }
    });
  }
  function netO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), m = ctx.getTransform(), tick = Math.floor(time * 12), fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.save(); ctx.lineCap = 'round';
    fx.wires.forEach((w, i) => {
      const k = easeOut((fx.age - i * .02) / .22);
      if (k <= 0) return;
      const e = netWireAt(w, k), u = fx.age - NET_FIRE - i * .04, burn = u > 0 ? 1 - win(u, .5, 1.2) : 1;
      // the taut steel wire, lifted a little off the ground
      if (burn > 0) {
        ctx.strokeStyle = `rgba(20,18,26,${.75 * burn})`; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(w[0], w[1] - 10); ctx.lineTo(e[0], e[1] - 10); ctx.stroke();
        ctx.strokeStyle = `rgba(235,240,250,${.9 * burn})`; ctx.lineWidth = 1.3; ctx.stroke();
        const gl = frac(time * 1.6 + i * .17);
        ctx.globalCompositeOperation = 'lighter';
        const g = netWireAt(w, gl * k); K.glow(ctx, g[0], g[1] - 10, 16, '255,255,240', .8 * burn, true);
        ctx.globalCompositeOperation = 'source-over';
      }
      // a kunai at each end pinning the wire
      for (const [t, rot] of [[0, Math.atan2(w[1] - w[3], w[0] - w[2])], [k, Math.atan2(w[3] - w[1], w[2] - w[0])]]) {
        if (t === k && k < .98) continue;
        const p = netWireAt(w, t);
        ctx.setTransform(m); ctx.translate(p[0], p[1] - 8); ctx.rotate(rot + .6);
        ctx.fillStyle = '#a4adb8'; ctx.strokeStyle = '#1a1612'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(2, -3); ctx.lineTo(16, 0); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(2, 0); ctx.stroke();
        ctx.setTransform(m);
      }
      // Katon running along the wire
      if (u > 0 && u < 1.4) {
        const q = easeOut(u / .35), alpha = (1 - win(u, .6, 1.4)) * fade;
        ctx.globalAlpha = alpha;
        for (let j = 0; j < 9; j++) {
          const t = j / 8 * q, p = netWireAt(w, t), hh = (30 + hash(i * 9 + j) * 26) * (t > q - .15 ? 1.4 : 1) * (.85 + .15 * Math.sin(time * 10 + j));
          ctx.drawImage(K.flame((j + tick + i) % 6), p[0] - hh * .3, p[1] - hh * FLAME_BASE, hh * .6, hh);
        }
        ctx.globalAlpha = 1;
      }
    });
    // kunai flying out from his hands
    if (fx.age < .24 && z) {
      const hx = z.x, hy = z.y - L;
      ctx.strokeStyle = 'rgba(230,235,245,.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const w of fx.wires) { const k = easeOut(fx.age / .22), p = netWireAt(w, k); ctx.moveTo(hx, hy); ctx.lineTo(p[0], p[1] - 10); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function poofO(ctx, fx) { Kit().fx.smokePoof(ctx, fx.x, fx.y, 90, fx.age / fx.dur); }

  // ---- Crawling Amaterasu: black flames race along the ground and flare up at the target.
  function amaG(ctx, fx, time) {
    const K = Kit(), s = clamp01(fx.age / fx.T), fade = 1 - win(fx.age, fx.dur - .9, fx.dur), n = fx.pts.length - 1, upto = Math.max(1, Math.ceil(n * s));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(6,0,4,${.5 * fade})`; ctx.lineWidth = AMA_W * 1.4;
    ctx.beginPath(); ctx.moveTo(fx.pts[0][0], fx.pts[0][1]); for (let i = 1; i <= upto; i++) ctx.lineTo(fx.pts[i][0], fx.pts[i][1]); ctx.stroke();
    ctx.strokeStyle = `rgba(160,20,60,${.35 * fade})`; ctx.lineWidth = 3; ctx.stroke();
    if (fx.age > fx.T) {
      const e = fx.pts[n], u = fx.age - fx.T;
      K.glow(ctx, e[0], e[1], AMA_END * 1.3 * easeOut(u / .3), '8,2,10', .7 * fade, false, .5);
      ring(ctx, e[0], e[1], AMA_END * easeOut(u / .3), 2.6, `rgba(170,20,70,${.5 * fade})`);
      if (u < .6) { ring(ctx, e[0], e[1], AMA_END * (.3 + 1.2 * easeOut(u * 2)), 7, `rgba(30,0,14,${.5 * (1 - u / .6)})`); ring(ctx, e[0], e[1], AMA_END * (.3 + 1.2 * easeOut(u * 2)), 2.5, `rgba(255,60,90,${.8 * (1 - u / .6)})`); }
    }
  }
  function amaO(ctx, fx, time) {
    const K = Kit(), s = clamp01(fx.age / fx.T), fade = clamp01((fx.dur - fx.age) / .9), tick = Math.floor(time * 12), n = 22, sm = K.puff('smoke');
    ctx.save();
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (t > s + .02) break;
      const p = pathAt(fx.pts, t), front = 1 - clamp01((s - t) / .2), hh = (40 + hash(i * 4.1 + fx.seed) * 30) * (1 + front * .8) * (.86 + .14 * Math.sin(time * 9 + i)) * fade;
      if (hh < 6) continue;
      ctx.drawImage(amaFlame(i + tick), p.x - hh * .36 + (hash(i) - .5) * 20, p.y - hh * FLAME_BASE, hh * .72, hh);
    }
    if (fx.age > fx.T) {
      const e = fx.pts[fx.pts.length - 1], u = fx.age - fx.T, erupt = easeOut(u / .25), burst = 1 + .9 * (1 - win(u, .1, .5));
      blackFire(ctx, e[0], e[1], AMA_END, 24, fx.seed, erupt * burst * fade, time, tick, 1);
      for (let i = 0; i < 4; i++) {
        const ph = frac(time * .35 + i * .25), x = e[0] + (hash(fx.seed + i) - .5) * AMA_END * 1.2;
        K.stamp(ctx, sm, x, e[1] - 50 - ph * 170, 30 + ph * 46, .45 * (1 - ph) * erupt * fade);
      }
      if (u < .4) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, e[0], e[1] - 30, AMA_END, '140,10,60', .55 * (1 - u / .4), false, .6); ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.restore();
  }

  // ---- Susanoo fist: the orange-red Susanoo half-forms and pounds three craters in a row.
  function fistG(ctx, fx, time, z) {
    const lvl = 1 - win(fx.age, fx.dur - .5, fx.dur), sp = fx.spots, f = sp.length && sp[0].x >= fx.x ? 1 : -1;
    drawSus(ctx, 'fugaku', z ? z.x : fx.x, z ? z.y : fx.y, lvl, time, f, .62);
    sp.forEach((s, i) => {
      const u = fx.age - .18 - i * FIST_GAP;
      if (u < 0) { markCircle(ctx, s.x, s.y, FIST_R, MOVES.fist.rgb, clamp01((fx.age + .5) / (.68 + i * FIST_GAP)), time, false, false); return; }
      const g = 1 - win(u, .6, 1.4);
      Kit().glow(ctx, s.x, s.y, FIST_R * 1.1, '30,12,6', .5 * g, false, .5);
      cracks(ctx, s.x, s.y, FIST_R * 1.05 * easeOut(u * 5), 11, fx.seed + i, g, 3);
      inkRing(ctx, s.x, s.y, 30 + FIST_R * 1.2 * easeOut(u * 2.5), 1 - win(u, 0, .7), 4, '50,14,4', '255,170,90');
      if (u < .8) dustRing(ctx, s.x, s.y, FIST_R * (.7 + u), 14, 20 + u * 30, .7 * (1 - u / .8), fx.seed + i, 8 + u * 26);
    });
  }
  function fistO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), P = SUS.fugaku, s = .62, lvl = 1 - win(fx.age, fx.dur - .5, fx.dur);
    if (lvl <= .02) return;
    const x = z ? z.x : fx.x, y = z ? z.y : fx.y, sp = fx.spots, f = sp.length && sp[0].x >= x ? 1 : -1, fy = y + 6;
    ctx.save(); ctx.lineCap = 'round';
    // which slam is active: the fist rises off the shoulder, hangs over the mark, then drops
    let idx = 0;
    for (let i = 0; i < sp.length; i++) if (fx.age >= .18 + i * FIST_GAP - .2) idx = i;
    const t = fx.age - (.18 + idx * FIST_GAP), tgt = sp[idx];
    if (tgt) {
      const drop = t < -.2 ? 0 : t < 0 ? easeIn((t + .2) / .2) : 1, hover = 170 * (1 - drop) * (t < .15 ? 1 : 1 - win(t, .15, .3));
      const back = t > .15 ? win(t, .15, FIST_GAP) : 0;
      const hx = tgt.x, hy = tgt.y - L - 30 - hover - back * 120;
      const side = (idx % 2 ? -1 : 1) * f;
      susArm(ctx, P, x + side * 110 * s, fy - 300 * s, hx, hy, s, lvl, side * 80 * s, 1);
      if (t >= 0 && t < .25) {
        const q = t / .25;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, tgt.x, tgt.y - 30, 190 * (.5 + q), '255,190,120', (1 - q) * .9, true, .6);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    sp.forEach((s2, i) => { const u = fx.age - .18 - i * FIST_GAP; if (u > 0 && u < 1.1) K.fx.debris(ctx, s2.x, s2.y, 170, u, fx.seed + i * 3, '#3a2a20', 12); });
    ctx.restore();
  }

  // ---- Susanoo heaven-fire orb (ultimate): Katon fed into the Susanoo's hands with a heart of
  // Amaterasu, hurled down on the mark; a ring of blasts follows and black fire keeps burning.
  function orbPos(fx, s, p) {
    const sx = fx.x0 + fx.f * 40 * s, sy = fx.y0 + 6 - 560 * s;
    const e = easeIn(p);
    return [sx + (fx.tx - sx) * e, sy + (fx.ty - LIFT() - 40 - sy) * e - Math.sin(Math.PI * p) * 120];
  }
  function orbG(ctx, fx, time, z) {
    const K = Kit(), lvl = 1 - win(fx.age, fx.T + .6, fx.T + 1.4);
    drawSus(ctx, 'fugaku', z ? z.x : fx.x0, z ? z.y : fx.y0, lvl, time, fx.f);
    const u = fx.age - fx.T, fade = 1 - win(fx.age, fx.dur - 1, fx.dur);
    if (u < 0) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.tx, fx.ty, ORB_R * (.4 + .6 * fx.age / fx.T), '255,100,30', .45, false, .5); ctx.globalCompositeOperation = 'source-over'; return; }
    K.glow(ctx, fx.tx, fx.ty, ORB_R * 1.15, '30,8,2', .6 * fade, false, .5);
    cracks(ctx, fx.tx, fx.ty, ORB_R * .9 * easeOut(u * 3), 16, fx.seed, fade, 3.2);
    K.fx.shockRing(ctx, fx.tx, fx.ty, ORB_R * 1.2, clamp01(u / 1.1), 1 - clamp01(u / 1.1), '255,140,60');
    if (u < 1.2) dustRing(ctx, fx.tx, fx.ty, ORB_R * (.7 + u * .6), 22, 30 + u * 40, .6 * (1 - u / 1.2), fx.seed, 10 + u * 30);
    const v = u - .35;
    if (v > 0) for (let i = 0; i < 8; i++) {
      const b = i * TAU / 8 + .2, x = fx.tx + Math.cos(b) * ORB_RING, y = fx.ty + Math.sin(b) * ORB_RING;
      K.glow(ctx, x, y, 140, '30,8,2', .5 * fade, false, .5);
      if (v < .6) inkRing(ctx, x, y, 20 + 120 * easeOut(v * 3), 1 - v / .6, 3, '50,14,4', '255,170,90');
    }
  }
  function orbO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), P = SUS.fugaku, s = .72, u = fx.age - fx.T;
    ctx.save(); ctx.lineCap = 'round';
    const lvl = 1 - win(fx.age, fx.T + .6, fx.T + 1.4), x = z ? z.x : fx.x0, y = z ? z.y : fx.y0, fy = y + 6;
    if (u < 0) {
      // both hands thrown forward as the orb leaves them
      const p = clamp01(fx.age / fx.T), o = orbPos(fx, s, p), r = 150 - 30 * p;
      for (const sd of [-1, 1]) susArm(ctx, P, x + sd * 110 * s, fy - 300 * s, x + fx.f * 120 * s + sd * 60 * s, fy - 420 * s, s, lvl, sd * 50 * s);
      for (let j = 1; j <= 5; j++) { const q = orbPos(fx, s, Math.max(0, p - j * .06)); K.stamp(ctx, K.puff('fire'), q[0], q[1], r * (1 - j * .14), .7 - j * .1); }
      fireOrb(ctx, o[0], o[1], r, time, fx.seed, 1, true);
    } else {
      if (lvl > .02) for (const sd of [-1, 1]) susArm(ctx, P, x + sd * 110 * s, fy - 300 * s, x + fx.f * 150 * s + sd * 70 * s, fy - 260 * s, s, lvl, sd * 50 * s);
      if (u < 2) K.fx.fireBlast(ctx, fx.tx, fx.ty, ORB_R, u * .8, 1 - win(u, 1.2, 2), time, fx.seed);
      if (u < .3) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.tx, fx.ty - 60, ORB_R * (1 + u * 2), '255,220,160', 1 - u / .3, true, .7); ctx.globalCompositeOperation = 'source-over'; }
      const v = u - .35;
      if (v > 0 && v < 1.3) for (let i = 0; i < 8; i++) { const b = i * TAU / 8 + .2; K.fx.fireBlast(ctx, fx.tx + Math.cos(b) * ORB_RING, fx.ty + Math.sin(b) * ORB_RING, 120, v, 1 - win(v, .7, 1.3), time, fx.seed + i); }
      // the black fire left burning in the crater
      const tick = Math.floor(time * 12), fade = clamp01((fx.dur - fx.age) / 1) * easeOut(u / .4);
      blackFire(ctx, fx.tx, fx.ty, 220, 26, fx.seed + 3, fade, time, tick, 1);
      if (u < 1.5) K.fx.debris(ctx, fx.tx, fx.ty, 320, u * .7, fx.seed, '#2a1810', 18);
    }
    ctx.restore();
  }

  // ================================================================== INDRA
  // ---- Chidori: he rides the lightning down the lane; a second dash follows the target.
  function chidoriG(ctx, fx, time) {
    const K = Kit(), ca = Math.cos(fx.a), sa = Math.sin(fx.a), p = easeOut(fx.age / CHI_T), f = 1 - win(fx.age, .4, fx.dur);
    const ex = fx.x + ca * fx.len * p, ey = fx.y + sa * fx.len * p;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(8,14,40,${.4 * f})`; ctx.lineWidth = 34;
    ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(60,140,255,${.45 * f})`; ctx.lineWidth = 8; ctx.stroke();
    if (fx.age > CHI_T) {
      const u = fx.age - CHI_T;
      K.glow(ctx, ex, ey, 160, '80,150,255', .5 * (1 - u), false, .5);
      ctx.globalCompositeOperation = 'source-over';
      inkRing(ctx, ex, ey, 30 + 130 * easeOut(u * 3), 1 - u / 1.1, 3, '4,14,52', '150,205,255');
      cracks(ctx, ex, ey, 130 * easeOut(u * 5), 9, fx.seed, f, 2.4);
      if (u < .6) { ctx.globalCompositeOperation = 'lighter'; groundRays(ctx, ex, ey, 9, 10, 150, time, fx.seed, 1 - u / .6, 1.5); }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function chidoriO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), ca = Math.cos(fx.a), sa = Math.sin(fx.a), p = easeOut(fx.age / CHI_T), f = 1 - win(fx.age, .3, .9);
    ctx.save();
    if (f > 0) {
      const hx = fx.x + ca * fx.len * p, hy = fx.y + sa * fx.len * p - L;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++)
        K.forkedBolt(ctx, fx.x, fx.y - L, hx, hy, fx.seed + i * 7, time, { jitter: 18 + i * 8, alpha: f * (1 - i * .25), width: 1.8 - i * .3, pal: BLUE_HOT, base: inkB(f), forkBase: true, step: 30, forks: 4, forkLen: 34, rate: 24, snap: true });
      if (fx.age < CHI_T + .05 && z) K.chidoriBall(ctx, z.x + ca * 18, z.y - L + sa * 8, 18, time, fx.seed, { pal: BLUE_HOT, body: '30,80,200', base: INK_B, power: 1, bolts: 9, width: 1 });
      ctx.globalCompositeOperation = 'source-over';
      // after-images along the dash
      for (let j = 1; j <= 3; j++) { const t = p - j * .22; if (t > 0) ghost(ctx, 'indra', fx.x + ca * fx.len * t, fx.y + sa * fx.len * t, ca >= 0 ? 1 : -1, 'attack', .45 * f * (1 - j * .25), 1); }
    }
    if (fx.age > CHI_T && fx.age < CHI_T + 1.1) K.fx.lightningBlast(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, 150, fx.age - CHI_T, 1 - win(fx.age - CHI_T, .4, 1.1), time, fx.seed);
    ctx.restore();
  }
  function chmarkG(ctx, fx, time) {
    markLine(ctx, fx.x, fx.y, fx.a, fx.len, CHI_W, MOVES.chidori.rgb, clamp01(fx.age / fx.dur), time, false, false);
  }

  // ---- Yasaka Magatama: the Susanoo's arm hurls three spinning rings of tomoe.
  function magG(ctx, fx, time, z) {
    const lvl = 1 - win(fx.age, fx.dur - .5, fx.dur), f = Math.cos(fx.a) >= 0 ? 1 : -1;
    drawSus(ctx, 'indra', z ? z.x : fx.x, z ? z.y : fx.y, lvl, time, f, .6);
    for (let i = 0; i < 3; i++) {
      const b = fx.a + (i - 1) * MAG_SPREAD, t0 = .05 + [1, 0, 2][i] * .16, d = Math.min(MAG_LEN, 40 + Math.max(0, fx.age - t0) * MAG_SPEED);
      if (d <= 40) continue;
      ctx.strokeStyle = `rgba(14,8,52,${.28 * lvl})`; ctx.lineWidth = 30; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x + Math.cos(b) * 40, fx.y + Math.sin(b) * 40); ctx.lineTo(fx.x + Math.cos(b) * d, fx.y + Math.sin(b) * d); ctx.stroke();
      const u = fx.age - t0 - MAG_LEN / MAG_SPEED;
      if (u > 0 && u < .8) { const x = fx.x + Math.cos(b) * MAG_LEN, y = fx.y + Math.sin(b) * MAG_LEN; inkRing(ctx, x, y, 20 + 110 * easeOut(u * 3), 1 - u / .8, 3, '14,8,52', '190,180,255'); cracks(ctx, x, y, 110 * easeOut(u * 5), 8, fx.seed + i, 1 - u / .8, 2.2); }
    }
  }
  function magO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), P = SUS.indra, s = .6, x = z ? z.x : fx.x, y = z ? z.y : fx.y, f = Math.cos(fx.a) >= 0 ? 1 : -1, fy = y + 6;
    const lvl = 1 - win(fx.age, fx.dur - .5, fx.dur), img = yasakaSpr();
    ctx.save();
    // throwing arm follows through toward the lane
    const thr = easeOut(fx.age / .3), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    if (lvl > .02) susArm(ctx, P, x + f * 110 * s, fy - 300 * s, x + ca * (80 + 140 * thr) * s * 1.6, fy - (420 - 220 * thr) * s + sa * 60 * s, s, lvl, f * 40 * s);
    for (let i = 0; i < 3; i++) {
      const b = fx.a + (i - 1) * MAG_SPREAD, t0 = .05 + [1, 0, 2][i] * .16, u = fx.age - t0;
      if (u < 0) continue;
      const d = 40 + u * MAG_SPEED;
      if (d > MAG_LEN) {
        const v = (d - MAG_LEN) / MAG_SPEED;
        if (v < .5) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x + Math.cos(b) * MAG_LEN, y + Math.sin(b) * MAG_LEN - L, 130 * (.5 + v * 2), '170,160,255', 1 - v / .5, true, .7); ctx.globalCompositeOperation = 'source-over'; }
        continue;
      }
      const px = fx.x + Math.cos(b) * d, py = fx.y + Math.sin(b) * d - L - 20, r = 58;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, px, py, r * 2.2, '110,100,255', .5);
      for (let j = 1; j <= 4; j++) K.spin(ctx, img, px - Math.cos(b) * j * 26, py - Math.sin(b) * j * 26, r * (1 - j * .1), -time * 18 - j * .3, .22 - j * .04, .7);
      ctx.globalCompositeOperation = 'source-over';
      K.spin(ctx, img, px, py, r, -time * 18, 1, .7);
      chirps(ctx, px, py, 6, 30, 12, time, fx.seed + i, .8, '220,215,255');
    }
    ctx.restore();
  }

  // ---- Black-flame ring: Amaterasu blooms in a wide ring and closes on the target.
  function ringR(fx) { return RING_R1 + (RING_R0 - RING_R1) * easeIn(clamp01(fx.age / fx.T)); }
  function ringG(ctx, fx, time) {
    const K = Kit(), r = ringR(fx), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    K.glow(ctx, fx.x, fx.y, r * 1.25, '8,2,10', .5 * fade, false, .5);
    ring(ctx, fx.x, fx.y, r, 26, `rgba(6,0,4,${.55 * fade})`);
    ring(ctx, fx.x, fx.y, r + 14, 2.2, `rgba(200,30,80,${.55 * fade})`);
    if (fx.age > fx.T) {
      const u = fx.age - fx.T;
      K.glow(ctx, fx.x, fx.y, RING_R0 * 1.3, '0,0,0', .6 * fade, false, .5);
      if (u < .6) { ring(ctx, fx.x, fx.y, RING_R0 * (.4 + 1.3 * easeOut(u * 2)), 7, `rgba(30,0,14,${.5 * (1 - u / .6)})`); ring(ctx, fx.x, fx.y, RING_R0 * (.4 + 1.3 * easeOut(u * 2)), 2.5, `rgba(255,60,90,${.8 * (1 - u / .6)})`); }
    }
  }
  function ringO(ctx, fx, time) {
    const K = Kit(), tick = Math.floor(time * 12), fade = clamp01((fx.dur - fx.age) / .8), sm = K.puff('smoke');
    ctx.save();
    if (fx.age < fx.T + .3) {
      const r = ringR(fx), n = 30, close = 1 - win(fx.age, fx.T, fx.T + .3), grow = easeOut(fx.age / .25);
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n + fx.seed, x = fx.x + Math.cos(a) * r, y = fx.y + Math.sin(a) * r * .5;
        const hh = (60 + hash(i * 3.3 + fx.seed) * 50) * grow * close * (.86 + .14 * Math.sin(time * 9 + i));
        if (hh > 6) ctx.drawImage(amaFlame(i + tick), x - hh * .36, y - hh * FLAME_BASE, hh * .72, hh);
      }
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + time * .3, ph = frac(time * .5 + i / 6);
        K.stamp(ctx, sm, fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r * .5 - 60 - ph * 120, 30 + ph * 40, .4 * (1 - ph) * close);
      }
    }
    if (fx.age > fx.T) {
      const u = fx.age - fx.T, erupt = easeOut(u / .25), burst = 1 + 1.1 * (1 - win(u, .1, .5));
      blackFire(ctx, fx.x, fx.y, RING_R0, 22, fx.seed, erupt * burst * fade, time, tick, 1);
      if (u < .4) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 40, RING_R0 * 1.5, '150,10,60', .6 * (1 - u / .4), false, .6); ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.restore();
  }

  // ---- Susanoo cleave: a colossal violet-blue blade comes down along the lane.
  function cleaveG(ctx, fx, time, z) {
    const K = Kit(), f = Math.cos(fx.a) >= 0 ? 1 : -1, lvl = 1 - win(fx.age, fx.dur - .6, fx.dur);
    drawSus(ctx, 'indra', z ? z.x : fx.x, z ? z.y : fx.y, lvl, time, f, .66);
    if (fx.age < .1) return;
    const u = fx.age - .1, ca = Math.cos(fx.a), sa = Math.sin(fx.a), fade = 1 - win(fx.age, 1.2, fx.dur), x0 = fx.x + ca * 50, y0 = fx.y + sa * 50, x1 = fx.x + ca * CLV_LEN, y1 = fx.y + sa * CLV_LEN;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(10,6,40,${.5 * fade})`; ctx.lineWidth = 46;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(120,110,255,${.5 * fade * (.8 + .2 * Math.sin(time * 14))})`; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = `rgba(235,235,255,${.6 * fade})`; ctx.lineWidth = 3; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (const t of [.35, .7, 1]) { const x = fx.x + ca * CLV_LEN * t, y = fx.y + sa * CLV_LEN * t; cracks(ctx, x, y, 150 * easeOut(u * 4), 9, fx.seed + t * 9, fade, 2.6); }
    const v = fx.age - .45;
    if (v > 0 && v < 1) for (const t of [.25, .5, .75, 1]) inkRing(ctx, fx.x + ca * CLV_LEN * t, fx.y + sa * CLV_LEN * t, 40 + 150 * easeOut(v * 2), 1 - v, 3, '14,8,52', '190,180,255');
  }
  function cleaveO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), P = SUS.indra, s = .66, x = z ? z.x : fx.x, y = z ? z.y : fx.y, f = Math.cos(fx.a) >= 0 ? 1 : -1, fy = y + 6;
    const lvl = 1 - win(fx.age, fx.dur - .6, fx.dur), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    if (lvl <= .02) return;
    ctx.save(); ctx.lineCap = 'round';
    const p = easeIn(clamp01(fx.age / .12)), g = 1 - win(fx.age, .3, 1.2);
    // hands come down from overhead; the blade lies along the lane at the end of the swing
    const hx = x + ca * (40 + 150 * p) * s, hy = fy - (520 - 300 * p) * s + sa * 60 * s * p;
    const tipD = 200 + (CLV_LEN - 200) * p, tx = x + ca * tipD, ty = y + sa * tipD - L * .6 - (1 - p) * 700;
    for (const sd of [-1, 1]) susArm(ctx, P, x + sd * 110 * s, fy - 300 * s, hx + sd * 12, hy, s, lvl, sd * 50 * s);
    chakraBlade(ctx, P, hx, hy, tx, ty, 46 * Math.max(g, .25) + 6, lvl * Math.max(g, .3));
    if (fx.age > .1 && fx.age < .7) {
      const q = (fx.age - .1) / .6;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) K.forkedBolt(ctx, x + ca * 80, y + sa * 80 - 10, x + ca * CLV_LEN, y + sa * CLV_LEN - 10, fx.seed + i * 5, time, { jitter: 30, alpha: 1 - q, width: 1.6, pal: VB, base: inkV(1 - q), step: 40, forks: 5, forkLen: 44, rate: 22, snap: true });
      K.glow(ctx, x + ca * CLV_LEN, y + sa * CLV_LEN - 40, 240 * (.5 + q), '170,160,255', (1 - q) * .9, true, .7);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const t of [.35, .7, 1]) if (fx.age > .1 && fx.age < 1.3) K.fx.debris(ctx, fx.x + ca * CLV_LEN * t, fx.y + sa * CLV_LEN * t, 150, fx.age - .1, fx.seed + t * 7, '#1e1a30', 10);
    ctx.restore();
  }

  // ---- Kirin: a serpent of lightning plunges out of the thunderclouds onto the mark.
  function kirinPts(fx, out, n) {
    const sx = fx.x + fx.side * 300, sy = fx.y - 330, c1x = fx.x + fx.side * 640, c1y = fx.y - 90, c2x = fx.x - fx.side * 300, c2y = fx.y - 260, ex = fx.x, ey = fx.y - 18;
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out[i * 2] = u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex;
      out[i * 2 + 1] = u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey;
    }
    return out;
  }
  const KP = new Float32Array(66);
  function clouds(ctx, cx, cy, e, alpha, time, seed) {
    const K = Kit(), sm = K.puff('smoke');
    for (let i = 0; i < 14; i++) {
      const a = hash(seed + i * 3.7) * TAU, d = 60 + hash(seed + i) * 260, x = cx + Math.cos(a) * d * (.6 + .4 * e) + (K.wobble(seed + i, time, .3) - .5) * 40;
      K.stamp(ctx, sm, x, cy + Math.sin(a) * d * .25, (70 + hash(seed + i * 9) * 70) * (.4 + .6 * e), .75 * alpha);
    }
  }
  function kirinG(ctx, fx, time) {
    const K = Kit(), u = fx.age - KIRIN_DIVE, f = 1 - win(fx.age, 1.4, fx.dur);
    if (u < 0) { K.glow(ctx, fx.x, fx.y, KIRIN_R * 1.4, '10,12,30', .55, false, .5); return; }
    K.glow(ctx, fx.x, fx.y, KIRIN_R * 1.2, '8,12,30', .55 * f, false, .5);
    cracks(ctx, fx.x, fx.y, KIRIN_R * .9 * easeOut(u * 4), 16, fx.seed, f, 3);
    inkRing(ctx, fx.x, fx.y, 40 + KIRIN_R * 1.05 * easeOut(u * 2.5), 1 - win(u, .2, 1.2), 5, '4,14,52', '150,205,255');
    if (u < .9) { ctx.globalCompositeOperation = 'lighter'; groundRays(ctx, fx.x, fx.y, 16, 30, KIRIN_R * 1.05, time, fx.seed * 3, 1 - u / .9, 2); ctx.globalCompositeOperation = 'source-over'; }
    const v = fx.age - KIRIN_DIVE - .45;
    if (v > 0 && v < .7) for (let i = 0; i < 6; i++) { const b = i * TAU / 6 + .4; inkRing(ctx, fx.x + Math.cos(b) * 340, fx.y + Math.sin(b) * 340, 20 + 80 * easeOut(v * 3), 1 - v / .7, 2.5, '4,14,52', '150,205,255'); }
  }
  function kirinO(ctx, fx, time) {
    const K = Kit(), n = 32, p = easeIn(clamp01(fx.age / KIRIN_DIVE)), u = fx.age - KIRIN_DIVE, fade = 1 - win(u, .05, .55);
    ctx.save();
    clouds(ctx, fx.x + fx.side * 260, fx.y - 300, 1, 1 - win(fx.age, 1.6, fx.dur), time, fx.seed);
    if (fade > 0) {
      kirinPts(fx, KP, n);
      const hi = Math.round(n * p), lo = Math.max(0, Math.round(n * (p - .6)));
      if (hi > lo + 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const body = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(KP[lo * 2], KP[lo * 2 + 1]); for (let i = lo + 1; i <= hi; i++) ctx.lineTo(KP[i * 2], KP[i * 2 + 1]); ctx.stroke(); };
        body(46 * fade, inkB(.9 * fade));
        ctx.globalCompositeOperation = 'lighter';
        body(34 * fade, `rgba(60,130,255,${.7 * fade})`);
        body(14 * fade, `rgba(190,230,255,${.9 * fade})`);
        body(4, `rgba(255,255,255,${fade})`);
        for (let i = lo; i < hi; i += 3) K.forkedBolt(ctx, KP[i * 2], KP[i * 2 + 1], KP[Math.min(hi, i + 3) * 2], KP[Math.min(hi, i + 3) * 2 + 1], fx.seed + i, time,
          { jitter: 30, alpha: fade, width: 1.6, pal: BLUE_HOT, base: null, forks: 2, forkLen: 50, step: 18, rate: 24, snap: true });
        // the head: jagged horns and an open jaw of white lightning
        const hx = KP[hi * 2], hy = KP[hi * 2 + 1], ang = Math.atan2(hy - KP[(hi - 1) * 2 + 1], hx - KP[(hi - 1) * 2]);
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1);
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(-30, -10); ctx.lineTo(-80, -58); ctx.lineTo(-24, -26); ctx.lineTo(-50, -80); ctx.lineTo(4, -28); ctx.lineTo(70, -26); ctx.lineTo(96, -8);
        ctx.lineTo(48, -2); ctx.lineTo(92, 16); ctx.lineTo(60, 26); ctx.lineTo(0, 22); ctx.lineTo(-60, 36); ctx.lineTo(-36, 10); ctx.closePath();
        ctx.fillStyle = inkB(.9 * fade); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(110,175,255,${.85 * fade})`; ctx.scale(.86, .8); ctx.fill();
        ctx.fillStyle = `rgba(235,248,255,${.9 * fade})`; ctx.scale(.7, .6); ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, hx, hy, 160, '160,210,255', .9 * fade, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (u > 0 && u < 1.4) K.fx.lightningBlast(ctx, fx.x, fx.y, KIRIN_R, u, 1 - win(u, .7, 1.4), time, fx.seed);
    if (u > 0 && u < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 80, KIRIN_R * 1.5, '230,245,255', 1 - u / .25, true, .8); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  }

  // ---- Indra's Arrow (ultimate): the winged Perfect Susanoo looses a colossal lightning arrow.
  function bowAt(x, fy, ang, s) {
    let dx = Math.cos(ang), dy = Math.sin(ang) * .55; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    return { dx, dy, px: -dy, py: dx, gx: x + dx * 150 * s, gy: fy - 270 * s + dy * 70 * s };
  }
  function drawBow(ctx, P, x, fy, ang, s, lvl, drawK, time) {
    const B = bowAt(x, fy, ang, s), { dx, dy, px, py, gx, gy } = B, f = dx >= 0 ? 1 : -1;
    const nx = gx - dx * 190 * s * drawK, ny = gy - dy * 190 * s * drawK;
    const t1x = gx + px * 250 * s - dx * 90 * s, t1y = gy + py * 250 * s - dy * 90 * s, t2x = gx - px * 250 * s - dx * 90 * s, t2y = gy - py * 250 * s - dy * 90 * s;
    susArm(ctx, P, x + f * 110 * s, fy - 300 * s, gx, gy, s, lvl, f * 40 * s);
    susArm(ctx, P, x - f * 110 * s, fy - 300 * s, nx, ny, s, lvl, -f * 30 * s);
    // a double-curved bow with flame-tipped limbs
    ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.quadraticCurveTo(gx + px * 150 * s + dx * 50 * s, gy + py * 150 * s + dy * 50 * s, gx, gy);
    ctx.quadraticCurveTo(gx - px * 150 * s + dx * 50 * s, gy - py * 150 * s + dy * 50 * s, t2x, t2y);
    ctx.strokeStyle = P.ink.replace('.92', (.9 * lvl).toFixed(2)); ctx.lineWidth = 22 * s + 3; ctx.stroke();
    ctx.strokeStyle = `rgba(${P.rgb},${.95 * lvl})`; ctx.lineWidth = 15 * s + 1; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${lvl})`; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = `rgba(${P.light},${.95 * lvl})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.lineTo(nx, ny); ctx.lineTo(t2x, t2y); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    for (const [tx, ty] of [[t1x, t1y], [t2x, t2y]]) Kit().glow(ctx, tx, ty, 40 * s / .72, P.glow, .8 * lvl, true);
    ctx.globalCompositeOperation = 'source-over';
    return { nx, ny, tipX: gx + dx * 230 * s, tipY: gy + dy * 230 * s, dx, dy };
  }
  function spearPath(ctx, hx, hy, tx, ty, w) {
    const dx = tx - hx, dy = ty - hy, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, mx = hx + dx * .82, my = hy + dy * .82;
    ctx.beginPath();
    ctx.moveTo(hx + nx * w * .4, hy + ny * w * .4); ctx.lineTo(mx + nx * w * .3, my + ny * w * .3); ctx.lineTo(mx + nx * w * .9, my + ny * w * .9);
    ctx.lineTo(tx, ty); ctx.lineTo(mx - nx * w * .9, my - ny * w * .9); ctx.lineTo(mx - nx * w * .3, my - ny * w * .3); ctx.lineTo(hx - nx * w * .4, hy - ny * w * .4); ctx.closePath();
  }
  function lightningArrow(ctx, hx, hy, tx, ty, w, a, seed, time) {
    if (!(a > .01)) return;
    const K = Kit();
    ctx.fillStyle = inkV(a); spearPath(ctx, hx, hy, tx, ty, w + 7); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(90,80,255,${.85 * a})`; spearPath(ctx, hx, hy, tx, ty, w); ctx.fill();
    ctx.fillStyle = `rgba(190,190,255,${.85 * a})`; spearPath(ctx, hx, hy, tx, ty, w * .5); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${.95 * a})`; spearPath(ctx, hx, hy, tx, ty, w * .16); ctx.fill();
    K.forkedBolt(ctx, hx, hy, tx, ty, seed, time, { jitter: w * .8 + 8, alpha: a, width: 2.4, pal: VB, base: INK_V, forkBase: true, forks: 8, forkLen: 60, step: 40, rate: 24, snap: true });
    ctx.globalCompositeOperation = 'source-over';
  }
  function arrowG(ctx, fx, time, z) {
    const lvl = 1 - win(fx.age, 1.6, fx.dur), f = Math.cos(fx.a) >= 0 ? 1 : -1;
    drawSus(ctx, 'indra', fx.x, fx.y, lvl, time, f);
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), e = easeOut(fx.age / .14), fade = 1 - win(fx.age, 1.1, fx.dur);
    const x1 = fx.x + ca * 60, y1 = fx.y + sa * 60, x2 = fx.x + ca * (60 + ARW_LEN * e), y2 = fx.y + sa * (60 + ARW_LEN * e);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(10,6,40,${.5 * fade})`; ctx.lineWidth = ARW_W * 1.2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(110,100,255,${.35 * fade})`; ctx.lineWidth = ARW_W * .5; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (const t of [.3, .65, 1]) {
      const x = fx.x + ca * (60 + ARW_LEN * t), y = fx.y + sa * (60 + ARW_LEN * t), u = fx.age - .05;
      if (u > 0) { cracks(ctx, x, y, 200 * easeOut(u * 4) * (t === 1 ? 1.3 : 1), 12, fx.seed + t * 7, fade, 3); inkRing(ctx, x, y, 40 + 200 * easeOut(u * 2), 1 - win(u, .2, 1), 4, '14,8,52', '200,190,255'); }
    }
  }
  function arrowO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), P = SUS.indra, s = .72, fy = fx.y + 6, lvl = 1 - win(fx.age, 1.6, fx.dur);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (lvl > .02) drawBow(ctx, P, fx.x, fy, fx.a, s, lvl, 0, time);
    // the beam: the arrow's flight leaves a trench of violet lightning
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), B = bowAt(fx.x, fy, fx.a, s), e = easeOut(fx.age / .14), f = 1 - win(fx.age, .5, 1.6);
    // it dives from the bow onto the lane, then skims the ground down the whole lane
    const x0 = B.gx, y0 = B.gy, dm = Math.min(60 + ARW_LEN * e, 380), xm = fx.x + ca * dm, ym = fx.y + sa * dm - L;
    const x2 = fx.x + ca * (60 + ARW_LEN * e), y2 = fx.y + sa * (60 + ARW_LEN * e) - L;
    if (f > 0) {
      const body = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.lineTo(x2, y2); ctx.stroke(); };
      body(ARW_W * 1.3 * f, inkV(.75 * f));
      ctx.globalCompositeOperation = 'lighter';
      body(ARW_W * .9 * f, `rgba(90,80,255,${.7 * f})`);
      body(ARW_W * .4 * f, `rgba(200,200,255,${.85 * f})`);
      body(8 * f + 2, `rgba(255,255,255,${f})`);
      K.forkedBolt(ctx, x0, y0, xm, ym, fx.seed + 5, time, { jitter: 40, alpha: f, width: 2, pal: VB, base: null, forks: 4, forkLen: 60, step: 40, rate: 22, snap: true });
      for (let i = 0; i < 3; i++) K.forkedBolt(ctx, xm, ym, x2, y2, fx.seed + i * 11, time, { jitter: 50 + i * 20, alpha: f, width: 2, pal: VB, base: null, forks: 7, forkLen: 70, step: 50, rate: 22, snap: true });
      K.glow(ctx, x2, y2, 260, '190,180,255', f, true);
      ctx.globalCompositeOperation = 'source-over';
      if (fx.age < .14) lightningArrow(ctx, x2 - (x2 - x0) * .12, y2 - (y2 - y0) * .12, x2 + ca * 60, y2 + sa * 30, 46, 1, 91, time);
    }
    if (fx.age < .3) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x0, y0, 400 * (.5 + fx.age * 3), '230,225,255', 1 - fx.age / .3, true, .8); ctx.globalCompositeOperation = 'source-over'; }
    const ex = fx.x + ca * (60 + ARW_LEN), ey = fx.y + sa * (60 + ARW_LEN);
    if (fx.age > .1 && fx.age < 1.6) K.fx.debris(ctx, ex, ey, 260, (fx.age - .1) * .8, fx.seed, '#1e1a30', 18);
    ctx.restore();
  }

  // ------------------------------------------------------------------ body flicker
  function blinkG(ctx, fx) {
    const f = 1 - fx.age / fx.dur;
    if (fx.who === 'fugaku') return;
    for (const [x, y] of [[fx.x1, fx.y1], [fx.x2, fx.y2]]) inkRing(ctx, x, y, 14 + 56 * easeOut(fx.age / .35), f, 2, fx.who === 'indra' ? '4,14,52' : '40,4,10', fx.who === 'indra' ? '150,205,255' : '255,120,120');
  }
  function blinkO(ctx, fx, time) {
    const K = Kit(), f = 1 - fx.age / fx.dur, L = LIFT();
    ctx.save();
    if (fx.who === 'fugaku') {
      K.fx.smokePoof(ctx, fx.x1, fx.y1, 80, fx.age / fx.dur);
      K.fx.smokePoof(ctx, fx.x2, fx.y2, 70, Math.min(1, fx.age / fx.dur + .15));
    } else if (fx.who === 'indra') {
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y] of [[fx.x1, fx.y1], [fx.x2, fx.y2]]) { K.glow(ctx, x, y - L, 50 * f + 10, '120,180,255', f, true); chirps(ctx, x, y - L, 7, 24, 10, time, fx.seed + x, f); }
      K.forkedBolt(ctx, fx.x1, fx.y1 - L, fx.x2, fx.y2 - L, fx.seed, time, { jitter: 22, alpha: f * .8, width: 1.4, pal: BLUE_HOT, base: inkB(f * .6), step: 30, forks: 2, forkLen: 26, rate: 24, snap: true });
    } else {
      // Shisui of the Body Flicker: a chain of after-images strung between the two spots
      for (let j = 0; j < 4; j++) { const t = j / 3; ghost(ctx, 'shisui', fx.x1 + (fx.x2 - fx.x1) * t, fx.y1 + (fx.y2 - fx.y1) * t, fx.f, 'run3', .5 * f * (.4 + t * .6), .8); }
      ctx.strokeStyle = `rgba(255,255,255,${.6 * f})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); for (const o of [-14, 0, 14]) { ctx.moveTo(fx.x1, fx.y1 - L + o); ctx.lineTo(fx.x2, fx.y2 - L + o); } ctx.stroke();
    }
    ctx.restore();
  }

  const FX = {
    shun: [shunG, shunO], dragon: [dragonG, dragonO], shur: [shurG, shurO], crows: [crowsG, crowsO], koto: [kotoG, kotoO], shsus: [shsusG, shsusO],
    fball: [fballG, fballO], phoenix: [phoenixG, phoenixO], net: [netG, netO], poof: [null, poofO], ama: [amaG, amaO], fist: [fistG, fistO], orb: [orbG, orbO],
    chidori: [chidoriG, chidoriO], chmark: [chmarkG, null], mag: [magG, magO], ring: [ringG, ringO], cleave: [cleaveG, cleaveO], kirin: [kirinG, kirinO],
    arrow: [arrowG, arrowO], blink: [blinkG, blinkO]
  };

  // ------------------------------------------------------------------ windup looks
  function eyePos(z) { const S = Spr(), h = S ? S.height(z.bossId) : 90; return { x: z.x + (z.facing || 1) * 4, y: z.y + 3 - h * .82 }; }
  const SUS_SCALE = { shSus: .72, fist: .62, fgSus: .72, magatama: .6, sword: .66, arrow: .72 };
  function windupG(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, move = st.move, m = members[z.bossId];
    const rgb = MOVES[move].rgb;
    // chakra ripples from his feet in the jutsu's colour
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5);
    for (let i = 0; i < 4; i++) {
      const ph = frac(time * 1.2 + i / 4), r = 20 + ph * (90 + 70 * k);
      ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(30,8,14,${(1 - ph) * .5})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = `rgba(${rgb},${(1 - ph) * .75})`; ctx.stroke();
    }
    ctx.restore();
    if (SUS_OF[move]) drawSus(ctx, SUS_OF[move], z.x, z.y, st.sus, time, Math.cos(st.aim) >= 0 ? 1 : -1, SUS_SCALE[move]);
    if (move === 'kirin') K.glow(ctx, st.tx, st.ty, KIRIN_R * 1.5, '10,12,26', .5 * easeOut(k), false, .5);
    if (move === 'koto') K.spin(ctx, kotoSpr(), st.tx, st.ty, KOTO_R * easeOut(k), time * .6, .45 * k, .5);
    if (move === 'inAma') {
      const tick = Math.floor(time * 12);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12, x = st.tx + Math.cos(a) * RING_R1, y = st.ty + Math.sin(a) * RING_R1 * .5, h = 26 * easeOut(k);
        if (h > 4) ctx.drawImage(amaFlame(i + tick), x - h * .36, y - h * FLAME_BASE, h * .72, h);
      }
    }
    void m;
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, f = Math.cos(st.aim) >= 0 ? 1 : -1, L = LIFT();
    const hx = z.x + f * 18, hy = z.y - L - 4, ey = eyePos(z);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, ey.x + f * 3, ey.y, 10 + 6 * k, '255,40,60', .85, true);
    K.glow(ctx, ey.x - f * 4, ey.y, 10 + 6 * k, '255,40,60', .7, true);
    ctx.globalCompositeOperation = 'source-over';
    const susLvl = st.sus, s = SUS_SCALE[move] || .72, fy = z.y + 6 + (1 - susLvl) * 70;
    switch (move) {
      case 'shunshin': {
        // he seems to be in several places at once
        for (let i = 0; i < 3; i++) {
          const a = time * 9 + i * TAU / 3, r = 26 + 20 * e;
          ghost(ctx, 'shisui', z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * .5, f, 'run3', .3 + .2 * Math.sin(time * 30 + i), .9);
        }
        break;
      }
      case 'dragon': case 'fireball': case 'phoenix': {
        // flame gathering at the mouth behind the seal
        const S = Spr(), mx = z.x + f * 10, my = z.y - (S ? S.height(z.bossId) * .72 : 64);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, mx, my, 20 + 40 * e, '255,140,40', .9, true);
        ctx.globalCompositeOperation = 'source-over';
        const fire = K.puff('fire');
        for (let i = 0; i < 6; i++) { const a = time * 4 + i * TAU / 6, r = 40 * (1 - frac(time * 1.5 + i / 6)); K.stamp(ctx, fire, mx + Math.cos(a) * r, my + Math.sin(a) * r * .6, 6 + 8 * e, .8); }
        if (move === 'fireball') K.stamp(ctx, fire, mx + f * 20, my, 10 + 30 * e, .9);
        break;
      }
      case 'shuriken': {
        const img = shurSpr(), m2 = ctx.getTransform();
        for (let i = 0; i < 5; i++) {
          const a = st.aim + (i - 2) * .35, x = z.x + Math.cos(a) * (20 + 12 * e), y = z.y - L + Math.sin(a) * 10;
          ctx.setTransform(m2); ctx.translate(x, y); ctx.rotate(time * 4 + i); ctx.drawImage(img, -10, -10, 20, 20);
        }
        ctx.setTransform(m2);
        break;
      }
      case 'crows': {
        const tick = Math.floor(time * 14);
        for (let i = 0; i < 7; i++) {
          const a = time * 3 + i * TAU / 7, r = 50 + 20 * Math.sin(time * 2 + i), x = z.x + Math.cos(a) * r, y = z.y - L - 30 + Math.sin(a) * r * .4 - 20 * Math.sin(time * 5 + i);
          ctx.save(); ctx.translate(x, y); if (-Math.sin(a) < 0) ctx.scale(-1, 1); ctx.drawImage(crowSpr((tick + i) % 2), -14, -11, 28, 23); ctx.restore();
        }
        break;
      }
      case 'koto': case 'fgAma': case 'inAma': {
        // the Mangekyō bleeds as he focuses
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, ey.x + f * 3, ey.y, 18 + 8 * Math.sin(time * 40), '255,30,50', .9, true);
        if (move === 'koto') K.spin(ctx, kotoSpr(), ey.x + f * 3, ey.y - 30, 14 + 10 * e, time * 4, .9);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(170,0,20,.9)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(ey.x + f * 3, ey.y + 3); ctx.lineTo(ey.x + f * 3.4, ey.y + 3 + 9 * e); ctx.stroke();
        if (move === 'fgAma') {
          const tick = Math.floor(time * 12), h = 30 * e;
          if (h > 4) ctx.drawImage(amaFlame(tick), st.tx - h * .36, st.ty - h * FLAME_BASE, h * .72, h);
        }
        break;
      }
      case 'police': {
        ctx.strokeStyle = 'rgba(230,235,245,.8)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
          const a = st.aim + (i - 2.5) * .3, x = z.x + Math.cos(a) * 26, y = z.y - L + Math.sin(a) * 12;
          ctx.fillStyle = '#a4adb8'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 7); ctx.lineTo(x + Math.cos(a + .3) * 4, y + Math.sin(a + .3) * 4); ctx.fill();
        }
        break;
      }
      case 'shSus': {
        // the blade raised high over the green Susanoo
        const P = SUS.shisui, sx = z.x + f * 120 * s, sy = fy - 300 * s, hx2 = z.x + f * 70 * s, hy2 = fy - 500 * s;
        susArm(ctx, P, sx, sy, hx2, hy2, s, susLvl, f * 60 * s);
        chakraBlade(ctx, P, hx2, hy2, hx2 - f * 240 * s * e, hy2 - 300 * s * e - 40, 24, susLvl);
        break;
      }
      case 'fist': {
        const P = SUS.fugaku, sx = z.x + f * 110 * s, sy = fy - 300 * s;
        susArm(ctx, P, sx, sy, z.x + f * 170 * s, fy - (440 + 80 * e) * s, s, susLvl, f * 60 * s, 1);
        break;
      }
      case 'fgSus': {
        // both hands raised, the orb of Katon swelling between them with Amaterasu at its heart
        const P = SUS.fugaku, ox = z.x + f * 40 * s, oy = fy - 560 * s, r = 40 + 110 * e;
        for (const sd of [-1, 1]) susArm(ctx, P, z.x + sd * 110 * s, fy - 300 * s, ox + sd * r * .7, oy + r * .3, s, susLvl, sd * 50 * s);
        fireOrb(ctx, ox, oy, r, time, 3.3, Math.min(1, k * 2), k > .4);
        const fire = K.puff('fire');
        for (let i = 0; i < 6; i++) { const ph = frac(time * 1.2 + i / 6), a = i * TAU / 6 + time; K.stamp(ctx, fire, ox + Math.cos(a) * r * 2.2 * (1 - ph), oy + Math.sin(a) * r * 1.4 * (1 - ph), 16, .8 * ph); }
        break;
      }
      case 'chidori': {
        K.chidoriBall(ctx, hx, hy, 10 + 14 * e, time, 3.3, { pal: BLUE_HOT, body: '30,80,200', base: INK_B, power: .4 + .6 * k, bolts: 7 + Math.round(k * 4), width: 1 });
        ctx.globalCompositeOperation = 'lighter'; chirps(ctx, hx, hy, 10, 30 + 30 * e, 12, time, 4.4, .8); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'magatama': {
        const P = SUS.indra, sx = z.x + f * 110 * s, sy = fy - 300 * s, gx = z.x - f * 40 * s, gy = fy - 480 * s;
        susArm(ctx, P, sx, sy, gx, gy, s, susLvl, -f * 40 * s);
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, gx, gy, 90, '110,100,255', .6 * e); ctx.globalCompositeOperation = 'source-over';
        K.spin(ctx, yasakaSpr(), gx, gy, 20 + 26 * e, -time * 10, susLvl, .8);
        break;
      }
      case 'sword': {
        const P = SUS.indra, hx2 = z.x + f * 30 * s, hy2 = fy - 520 * s;
        for (const sd of [-1, 1]) susArm(ctx, P, z.x + sd * 110 * s, fy - 300 * s, hx2 + sd * 12, hy2, s, susLvl, sd * 50 * s);
        chakraBlade(ctx, P, hx2, hy2, hx2 - f * 120 * s, hy2 - 520 * s * e - 30, 36, susLvl);
        break;
      }
      case 'kirin': {
        const cx = st.tx + (z.x < st.tx ? -1 : 1) * 260, cy = st.ty - 300;
        ctx.save();
        clouds(ctx, cx, cy, e, 1, time, 41.3);
        ctx.globalCompositeOperation = 'lighter';
        const tick = Math.floor(time * 9);
        if (k > .45 && hash(41.3 + tick) > .4)
          K.forkedBolt(ctx, cx + (hash(tick) - .5) * 400, cy + 60, st.tx + (K.wobble(41, time, 3) - .5) * 300, st.ty - 10, 41 + tick, time,
            { jitter: 40, alpha: .75, width: 1.6, pal: BLUE_HOT, base: INK_B, forkBase: true, forks: 3, forkLen: 50, step: 40, rate: 20, snap: true });
        const ax = z.x + f * 4, ay = z.y - L - 40;
        K.chidoriBall(ctx, ax, ay, 10 + 6 * e, time, 8.8, { pal: BLUE_HOT, body: '30,80,200', base: INK_B, power: k, bolts: 6, width: .9 });
        K.forkedBolt(ctx, ax, ay, ax + 30, ay - 460, 77, time, { jitter: 26, alpha: .5 + .5 * k, width: 1.4, pal: BLUE_HOT, base: INK_B, step: 36, forks: 2, forkLen: 30, rate: 22, snap: true });
        ctx.restore();
        break;
      }
      case 'arrow': {
        const P = SUS.indra, el = st.windMax - st.windup, drawK = easeOut(win(el, .9, st.windMax - .15));
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const R = drawBow(ctx, P, z.x, fy, st.aim, s, susLvl, drawK, time);
        const c = win(el, .6, st.windMax);
        if (c > 0) {
          lightningArrow(ctx, R.nx - R.dx * 20, R.ny - R.dy * 20, R.tipX, R.tipY, (10 + 30 * c) * s * 1.2, c, 91, time);
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, R.tipX, R.tipY, (60 + 140 * c) * s, '200,190,255', c, true);
          K.glow(ctx, R.tipX, R.tipY, (160 + 240 * c) * s, '90,70,255', .35 * c);
          ctx.strokeStyle = `rgba(220,215,255,${.75 * c})`; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const ph = frac(time * 1.6 + hash(i * 3.3)), a = hash(i * 7.1) * TAU, r0 = (290 - 240 * ph) * s, r1 = r0 + 40 * s;
            ctx.moveTo(R.tipX + Math.cos(a) * r1, R.tipY + Math.sin(a) * r1 * .7); ctx.lineTo(R.tipX + Math.cos(a) * r0, R.tipY + Math.sin(a) * r0 * .7);
          }
          ctx.stroke();
          chirps(ctx, R.tipX, R.tipY, 12, 50 * s, 16, time, 95, c, '235,230,255');
        }
        ctx.restore();
        break;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function label(ctx, z, st) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (!move || !MOVES[move] || st.hide > 0) return;
    const S = Spr(), top = z.y - (S && S.height ? S.height(z.bossId) : 100) - 42;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#140a10'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = SUS_OF[move] ? `rgb(${SUS[SUS_OF[move]].light})` : '#ffd0c8'; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.hide = 0; st.sus = Math.max(0, st.sus - dt * 2);
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ draw entry points
  // Fx kinds that paint their own Susanoo (so the generic one is not drawn twice).
  const OWN_SUS = { shsus: 1, fist: 1, orb: 1, mag: 1, cleave: 1, arrow: 1 };
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.uc;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    if (!st.fx.length && !(st.windup > 0) && !(st.sus > 0)) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.windup > 0 && st.move) {
      drawTele(ctx, z, st, time);
      windupG(ctx, z, st, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } else if (st.sus > .02 && SUS_OF[st.susMove] && !st.fx.some(fx => OWN_SUS[fx.kind])) {
      drawSus(ctx, SUS_OF[st.susMove], z.x, z.y, st.sus, time, Math.cos(st.aim) >= 0 ? 1 : -1, SUS_SCALE[st.susMove]);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.uc;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null, st); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        windupO(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      label(ctx, z, st);
    }
    ctx.restore();
  }

  function hidden(z) { return !!(z.uc && z.uc.hide > 0 && z.health > 0); }

  window.UchihaBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden };
})();
