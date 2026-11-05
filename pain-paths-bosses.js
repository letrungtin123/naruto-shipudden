(() => {
  'use strict';

  // Pain Rikudō: the five paths beside Tendō (spawn panel, faction 'paths'). Each path is its own boss,
  // spawned on its own; together they read as one team: the same Rinnegan ripples and black chakra
  // receivers, black chakra threads linking paths that stand near each other (shared Rinnegan vision),
  // Naraka's King of Hell repairing and even reviving a fallen path, Preta's field shielding the others.
  // Contract as nagato-boss.js. All per-boss state lives on z.pp (plain numbers/arrays: co-op JSON).
  //   Asura  (Tu La Đạo):     missile barrage, chakra laser cannon, twin rocket fists, six-arm blade spin
  //                           + drill tail; ultimate: head laser sweep + missile storm.
  //   Human  (Nhân Gian Đạo): soul-rip tether, chakra rod volleys, mind read (predictive blink strike);
  //                           ultimate: soul extraction of everything inside a circle.
  //   Animal (Súc Sinh Đạo):  three-headed dog that splits, rhino charge, giant bird swoop, chameleon
  //                           ambush; ultimate: summoning stampede.
  //   Preta  (Ngạ Quỷ Đạo):   chakra-drain grab, absorption seal, suction vortex + body slam, absorbed
  //                           chakra spat back; ultimate: absorption field (drains, heals, shields the paths).
  //   Naraka (Địa Ngục Đạo):  King of Hell tongue + bite, rod rain, judgement flames, repair / revive a
  //                           path; ultimate: the King of Hell's giant bite.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const R = v => Math.round(v);
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const HEIGHT = id => { const S = Spr(); return S && S.has && S.has(id) ? S.height(id) : 92; };

  const order = ['pain_asura', 'pain_human', 'pain_animal', 'pain_preta', 'pain_naraka'];
  const members = {
    pain_asura: { name: 'PAIN — TU LA ĐẠO', short: 'TU LA ĐẠO', accent: '#ff9a5a', hpScale: 3.5, damageScale: 1.95, armor: .85,
      moves: ['a_missiles', 'a_laser', 'a_blades', 'a_rocket', 'a_storm', 'a_laser', 'a_rocket', 'a_missiles', 'a_blades', 'a_storm'] },
    pain_human: { name: 'PAIN — NHÂN GIAN ĐẠO', short: 'NHÂN GIAN ĐẠO', accent: '#9fb4d8', hpScale: 3.4, damageScale: 1.9,
      moves: ['h_soul', 'h_rods', 'h_read', 'h_field', 'h_rods', 'h_soul', 'h_read', 'h_field'] },
    pain_animal: { name: 'PAIN — SÚC SINH ĐẠO', short: 'SÚC SINH ĐẠO', accent: '#e0b46a', hpScale: 3.3, damageScale: 1.9,
      moves: ['n_dog', 'n_rhino', 'n_bird', 'n_cham', 'n_stampede', 'n_rhino', 'n_dog', 'n_cham', 'n_bird', 'n_stampede'] },
    pain_preta: { name: 'PAIN — NGẠ QUỶ ĐẠO', short: 'NGẠ QUỶ ĐẠO', accent: '#b58aff', hpScale: 3.8, damageScale: 1.8, armor: .9,
      moves: ['p_drain', 'p_absorb', 'p_vortex', 'p_spit', 'p_field', 'p_vortex', 'p_drain', 'p_spit', 'p_absorb', 'p_field'] },
    pain_naraka: { name: 'PAIN — ĐỊA NGỤC ĐẠO', short: 'ĐỊA NGỤC ĐẠO', accent: '#ff5a5a', hpScale: 3.4, damageScale: 1.85,
      moves: ['k_tongue', 'k_rods', 'k_judge', 'k_heal', 'k_bite', 'k_rods', 'k_tongue', 'k_judge', 'k_heal', 'k_bite'] }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    a_missiles: { label: 'TU LA ĐẠO · ĐẠN ĐẠO LIÊN PHÁT', rgb: '255,170,110', windup: .9, after: 1.5 },
    a_laser:    { label: 'TU LA ĐẠO · CHAKRA LASER PHÁO', rgb: '150,230,255', windup: 1.0, after: 1.4 },
    a_rocket:   { label: 'TU LA ĐẠO · HỎA TIỄN QUYỀN', rgb: '255,160,100', windup: .8, after: 1.5 },
    a_blades:   { label: 'TU LA ĐẠO · LỤC THỦ TOÀN TRẢM', rgb: '225,235,250', windup: .7, after: 1.4 },
    a_storm:    { label: 'TU LA ĐẠO · THIÊN HỎA PHÁO VŨ', rgb: '255,120,80', windup: 1.4, after: 2.2 },
    h_soul:     { label: 'NHÂN GIAN ĐẠO · TRỪU HỒN', rgb: '170,225,255', windup: .9, after: 1.3 },
    h_rods:     { label: 'NHÂN GIAN ĐẠO · HẮC BỔNG XẠ', rgb: '205,190,255', windup: .7, after: 1.3 },
    h_read:     { label: 'NHÂN GIAN ĐẠO · ĐỘC TÂM THUẬT', rgb: '190,170,255', windup: .8, after: 1.4 },
    h_field:    { label: 'NHÂN GIAN ĐẠO · VẠN HỒN TRỪU XUẤT', rgb: '160,230,255', windup: 1.3, after: 2.2 },
    n_dog:      { label: 'SÚC SINH ĐẠO · KHẨU KÝ · TAM ĐẦU KHUYỂN', rgb: '240,214,170', windup: .9, after: 1.6 },
    n_rhino:    { label: 'SÚC SINH ĐẠO · KHẨU KÝ · TÊ GIÁC', rgb: '236,214,176', windup: 1.0, after: 1.5 },
    n_bird:     { label: 'SÚC SINH ĐẠO · KHẨU KÝ · CỰ ĐIỂU', rgb: '220,235,255', windup: 1.0, after: 1.5 },
    n_cham:     { label: 'SÚC SINH ĐẠO · KHẨU KÝ · TẮC KÈ HOA', rgb: '170,240,190', windup: .6, after: 1.3 },
    n_stampede: { label: 'SÚC SINH ĐẠO · BÁCH THÚ CUỒNG BÔN', rgb: '255,200,120', windup: 1.4, after: 2.4 },
    p_drain:    { label: 'NGẠ QUỶ ĐẠO · HẤP TINH THỦ', rgb: '170,210,255', windup: .7, after: 1.3 },
    p_absorb:   { label: 'NGẠ QUỶ ĐẠO · PHONG THUẬT HẤP ẤN', rgb: '190,160,255', windup: .3, after: 3.2 },
    p_vortex:   { label: 'NGẠ QUỶ ĐẠO · HẤP THU LOA XOÁY', rgb: '180,150,255', windup: .8, after: 1.4 },
    p_spit:     { label: 'NGẠ QUỶ ĐẠO · PHẢN HỒI CHAKRA', rgb: '205,170,255', windup: .75, after: 1.3 },
    p_field:    { label: 'NGẠ QUỶ ĐẠO · VÔ HẠN HẤP THU KẾT GIỚI', rgb: '170,130,255', windup: 1.3, after: 2.2 },
    k_tongue:   { label: 'ĐỊA NGỤC ĐẠO · DIÊM VƯƠNG THIỆT', rgb: '255,120,150', windup: .9, after: 1.4 },
    k_rods:     { label: 'ĐỊA NGỤC ĐẠO · HẮC BỔNG VŨ', rgb: '205,175,255', windup: .8, after: 1.4 },
    k_judge:    { label: 'ĐỊA NGỤC ĐẠO · DIÊM VƯƠNG PHÁN XỬ', rgb: '205,120,255', windup: 1.0, after: 1.5 },
    k_heal:     { label: 'ĐỊA NGỤC ĐẠO · DIÊM VƯƠNG TU PHỤC', rgb: '170,255,200', windup: .9, after: 1.3 },
    k_revive:   { label: 'ĐỊA NGỤC ĐẠO · DIÊM VƯƠNG HỒI SINH', rgb: '170,255,200', windup: .9, after: 1.4 },
    k_bite:     { label: 'ĐỊA NGỤC ĐẠO · DIÊM VƯƠNG ĐẠI PHỆ', rgb: '255,80,110', windup: 1.35, after: 2.4 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;
  // Manual control (team mode): each path's jutsu in key order 1..n, ultimate last.
  const MANUAL = {
    pain_asura: ['a_missiles', 'a_laser', 'a_blades', 'a_rocket', 'a_storm'],
    pain_human: ['h_soul', 'h_rods', 'h_read', 'h_field'],
    pain_animal: ['n_dog', 'n_rhino', 'n_bird', 'n_cham', 'n_stampede'],
    pain_preta: ['p_drain', 'p_absorb', 'p_vortex', 'p_spit', 'p_field'],
    pain_naraka: ['k_tongue', 'k_rods', 'k_judge', 'k_heal', 'k_revive', 'k_bite']
  };
  const MOVE_LISTS = {};
  for (const id in MANUAL) MOVE_LISTS[id] = MANUAL[id].map(k => ({ id: k, label: MOVES[k].label }));
  function moves(z) { return (z && MOVE_LISTS[z.bossId]) || []; }
  // While the user drives a path, api.player is a cursor point: grabs and drains take the nearest
  // hostile unit instead, and a latch keeps hold of the unit it caught (HELD: fx -> unit).
  const pseudoOf = api => !!(api.player && api.player.pseudo);
  const victim = (api, x, y, r) => pseudoOf(api) ? (api.nearestFoe ? api.nearestFoe(x, y, r) : null) : api.player;
  const HELD = new WeakMap();
  function held(api, fx) { const v = HELD.get(fx); return v ? (v.health > 0 ? v : null) : api.player; }
  function grab(api, fx, v) { if (pseudoOf(api) && v) HELD.set(fx, v); return fx; }

  const MIS_R = 72, LASER_LEN = 1100, LASER_W = 36, FIST_SPEED = 1500, FIST_BLAST = 150, SPIN_R = 95, DRILL_R = 130;
  const STORM_LEN = 1150, STORM_HALF = .95, STORM_R = 560, STORM_T = 2.5;
  const SOUL_LEN = 660, ROD_LEN = 900, ROD_SPEED = 1500, READ_R = 135, HF_R = 430, HF_T = 2.4;
  const DOG_SPEED = 980, DOG_SPLIT = 430, RHINO_LEN = 1050, RHINO_SPEED = 1400, BIRD_LEN = 1500, BIRD_SPEED = 1250, BIRD_W = 95;
  const ST_PACK = 125, TONGUE_LEN = 580, ST_LANES = 5, ST_GAP = 170, ST_LEN = 1350, ST_SPEED = 1150;
  const DRAIN_LEN = 560, VORTEX_R = 520, SLAM_R = 175, ORB_SPEED = 640, ORB_LEN = 780, PF_R = 500, PF_T = 4.0;
  const KT_LEN = 700, JUDGE_R0 = 165, JUDGE_R1 = 305, NR_R = 420, BITE_R = 300, BITE_T = .42;

  const KEEP = { pain_human: 300, pain_animal: 330 };
  function pick(level) { return order[(level | 0) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  const facing = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, t = clamp01(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(x1 + dx * t - px, y1 + dy * t - py);
  }

  // ------------------------------------------------------------------ the team (shared Rinnegan vision)
  // Live paths seen this second (module registry, never stored on z: co-op serialises z whole).
  const TEAM = new Map();
  const nowS = () => performance.now() / 1000;
  function seen(z) { TEAM.set(z, nowS()); }
  function team(z, maxAge = 1.2) {
    const out = [], t = nowS();
    for (const [o, at] of TEAM) {
      if (t - at > 3) { TEAM.delete(o); continue; }
      if (o !== z && t - at <= maxAge && members[o.bossId] && o.team === z.team) out.push(o);
    }
    return out;
  }
  const byId = id => { for (const o of TEAM.keys()) if (o.id === id) return o; return null; };

  function state(z) {
    if (z.pp && !z.pp.ev) Object.defineProperty(z.pp, 'ev', { value: [], writable: true, enumerable: false });
    return z.pp || (z.pp = mkState(z));
  }
  // Pending blows (closures) live in a non-enumerable list: the host runs them, co-op snapshots skip them.
  function mkState(z) {
    const st = { t: 0, casts: 0, timer: 1 + Math.random() * .6, move: '', windup: 0, windMax: 1, aim: 0, tx: R(z.x), ty: R(z.y),
      tele: [], ev: [], fx: [], force: null, hold: 0, holdMove: '', dash: 0, guard: 0, guardHp: 0, absorb: 0, hide: 0, shield: 0,
      reactCd: 6, hpMark: z.health, hpClock: 0, revLeft: 2, revCd: 0, tid: 0, pl: null, pv: [0, 0], spots: null, lanes: null, lastDraw: 0 };
    delete st.ev;
    Object.defineProperty(st, 'ev', { value: [], writable: true, enumerable: false });
    return st;
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = R(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });
  const findFx = (st, kind) => { for (const f of st.fx) if (f.kind === kind) return f; return null; };

  // ------------------------------------------------------------------ jutsu selection + telegraphs
  function teleFor(z, st, move, api) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const d = Math.hypot(tx - x, ty - y);
    const circ = (cx, cy, r, faint, small) => ({ k: 'c', x: R(cx), y: R(cy), r, faint, small });
    const ln = (lx, ly, la, len, w, faint) => ({ k: 'line', x: R(lx), y: R(ly), a: la, len: R(len), w, faint });
    switch (move) {
      case 'a_missiles': {
        const b = Math.random() * TAU, s = [[tx, ty]];
        for (let i = 0; i < 5; i++) s.push([tx + Math.cos(b + i * TAU / 5) * 135, ty + Math.sin(b + i * TAU / 5) * 135]);
        for (let i = 0; i < 8; i++) s.push([tx + Math.cos(b + (i + .5) * TAU / 8) * 270, ty + Math.sin(b + (i + .5) * TAU / 8) * 270]);
        st.spots = s.map(([sx, sy]) => [R(sx), R(sy)]);
        return [circ(tx, ty, 340, true)].concat(st.spots.map(([sx, sy]) => circ(sx, sy, MIS_R, true, true)));
      }
      case 'a_laser': return [ln(x + ca * 30, y + sa * 30, a, LASER_LEN, LASER_W)];
      case 'a_rocket': {
        const len = Math.min(980, d + 120);
        return [-.11, .11].flatMap(o => [ln(x + Math.cos(a + o) * 30, y + Math.sin(a + o) * 30, a + o, len, 30), circ(x + Math.cos(a + o) * len, y + Math.sin(a + o) * len, FIST_BLAST)]);
      }
      case 'a_blades': {
        const len = Math.min(580, d + 60);
        return [ln(x, y, a, len, SPIN_R * .8), circ(x + ca * len, y + sa * len, DRILL_R)];
      }
      case 'a_storm': return [{ k: 'cone', x: R(x), y: R(y), a, len: STORM_LEN, half: STORM_HALF, dir: st.dir }, circ(tx, ty, STORM_R, true)];
      case 'h_soul': return [ln(x + ca * 20, y + sa * 20, a, SOUL_LEN, 40)];
      case 'h_rods': {
        const out = [];
        for (let i = 0; i < 9; i++) out.push(ln(x, y, a + (i - 4) * .12, ROD_LEN, 12, true));
        return out;
      }
      case 'h_read': return [];
      case 'h_field': return [circ(tx, ty, HF_R), circ(tx, ty, HF_R * .45, true)];
      case 'n_dog': {
        const len = Math.min(900, d + 130);
        return [ln(x + ca * 60, y + sa * 60, a, len, 70), circ(x + ca * (60 + len), y + sa * (60 + len), 120)];
      }
      case 'n_rhino': {
        st.lanes = [-.15, .15].map((o, i) => [+(a + o).toFixed(3), R(x + Math.cos(a + o) * 70), R(y + Math.sin(a + o) * 70), .3 + i * .22]);
        return st.lanes.map(l => ln(l[1], l[2], l[0], RHINO_LEN, 66));
      }
      case 'n_bird': {
        const sx = tx - ca * 760, sy = ty - sa * 760;
        st.lanes = [[R(sx), R(sy)]];
        return [ln(sx, sy, a, BIRD_LEN, BIRD_W)];
      }
      case 'n_cham': return [];
      case 'n_stampede': {
        const px = -sa, py = ca, sx = x - ca * 120, sy = y - sa * 120, ordr = [2, 0, 4, 1, 3];
        st.lanes = [];
        for (let i = 0; i < ST_LANES; i++) {
          const o = (i - (ST_LANES - 1) / 2) * ST_GAP;
          st.lanes.push([R(sx + px * o), R(sy + py * o), +(.35 + ordr[i] * .34).toFixed(2), i % 2 ? 1 : 0]);
        }
        return st.lanes.map(l => ln(l[0], l[1], a, ST_LEN, 62)).concat([circ(sx + ca * (ST_LEN + 40), sy + sa * (ST_LEN + 40), 250, true)]);
      }
      case 'p_drain': return [ln(x, y, a, Math.min(DRAIN_LEN, d + 40), 50)];
      case 'p_absorb': return [];
      case 'p_vortex': return [{ k: 'c', follow: true, r: VORTEX_R, faint: true }, { k: 'c', follow: true, r: SLAM_R }];
      case 'p_spit': {
        const out = [];
        for (let i = 0; i < 7; i++) out.push(ln(x, y, a + (i - 3) * .17, ORB_LEN, 22, true));
        return out;
      }
      case 'p_field': return [{ k: 'c', follow: true, r: PF_R }, { k: 'c', follow: true, r: PF_R * .5, faint: true }];
      case 'k_tongue': {
        const side = st.side, kx = x - sa * 70 * side, ky = y + ca * 70 * side;
        const ka = Math.atan2(ty - ky, tx - kx);
        st.spots = [[R(kx), R(ky)]];
        return [ln(kx, ky, ka, Math.min(KT_LEN, Math.hypot(tx - kx, ty - ky) + 60), 40)];
      }
      case 'k_rods': {
        const s = [[tx, ty]], b = Math.random() * TAU;
        for (let i = 0; i < 5; i++) s.push([tx + Math.cos(b + i * TAU / 5) * 125, ty + Math.sin(b + i * TAU / 5) * 125]);
        for (let i = 0; i < 9; i++) { const aa = b + (i + .5) * TAU / 9, dd = rand(250, 360); s.push([tx + Math.cos(aa) * dd, ty + Math.sin(aa) * dd]); }
        st.spots = s.map(([sx, sy]) => [R(sx), R(sy)]);
        return [circ(tx, ty, NR_R, true)].concat(st.spots.map(([sx, sy]) => circ(sx, sy, 60, true, true)));
      }
      case 'k_judge': return [{ k: 'ring', x: R(tx), y: R(ty), r0: JUDGE_R0, r1: JUDGE_R1 }, circ(tx, ty, 125, true)];
      case 'k_heal': case 'k_revive': return [];
      case 'k_bite': return [circ(tx, ty, BITE_R), circ(tx, ty, BITE_R * .5, true)];
    }
    return [];
  }

  // The most hurt path (self included) the King of Hell can reach, or a fallen one for k_revive.
  function healTarget(z, dead) {
    let best = null, worst = dead ? 0 : .88;
    const list = team(z, 1.6);
    if (!dead) list.push(z);
    for (const o of list) {
      if (Math.hypot(o.x - z.x, o.y - z.y) > 1000) continue;
      if (dead) { if (o.health <= 0 && o.deathTimer > .9 && !(o.pp && o.pp.revived >= 1)) return o; continue; }
      if (o.health <= 0) continue;
      const f = o.health / o.maxHealth;
      if (f < worst) { worst = f; best = o; }
    }
    return best;
  }

  function announce(z, st, m, api, forced) {
    let move = st.force;
    if (forced) {
      // the user's pick; with no fallen path to raise, the King of Hell repairs instead
      move = forced === 'k_revive' && !healTarget(z, true) ? 'k_heal' : forced;
      st.force = null;
    } else if (move && MOVES[move]) st.force = null;
    else {
      move = m.moves[st.casts % m.moves.length]; st.casts++;
      if (move === 'k_heal' && !healTarget(z, false)) { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = +aimAt(z, p).toFixed(3); st.tx = R(p ? p.x : z.x); st.ty = R(p ? p.y : z.y);
    st.dir = Math.random() < .5 ? 1 : -1; st.side = Math.random() < .5 ? 1 : -1;
    if (move === 'k_heal' || move === 'k_revive') {
      const o = move === 'k_revive' ? healTarget(z, true) : healTarget(z, false) || (forced ? z : null);
      st.tid = o ? o.id : 0;
      if (o) { st.tx = R(o.x); st.ty = R(o.y); if (move === 'k_revive') o.deathTimer = Math.max(o.deathTimer, def.windup + 1.8); }
    }
    st.tele = teleFor(z, st, move, api);
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), x = z.x, y = z.y, f = facing(z);
    const tx = st.tx, ty = st.ty;
    api.burst(x, y - 40, m.accent, 8);
    switch (move) {
      // ---------------------------------------------------------------- Asura
      case 'a_missiles': {
        const s = [];
        (st.spots || []).forEach(([sx, sy], i) => {
          const l = +(i * .045).toFixed(3), t = +(l + .6 + Math.random() * .25 + Math.hypot(sx - x, sy - y) / 2400).toFixed(3);
          s.push([sx, sy, l, t, R(rand(150, 240))]);
          later(st, t, api => { api.strike(sx, sy, MIS_R, D * 1.0, null, i % 4 === 0 ? 'crater' : null, true); if (i % 3 === 0) api.shake(6); });
        });
        if (s.length) addFx(st, { kind: 'missiles', x0: R(x - f * 8), y0: R(y), s, dur: Math.max(...s.map(v => v[3])) + 2.6 });
        st.spots = null;
        api.shake(4);
        break;
      }
      case 'a_laser': {
        const x0 = x + ca * 30, y0 = y + sa * 30, x1 = x0 + ca * LASER_LEN, y1 = y0 + sa * LASER_LEN;
        api.line(x0, y0, x1, y1, LASER_W, D * 2.3, 'fire');
        for (let i = 1; i <= 3; i++) api.world(x0 + ca * LASER_LEN * i / 3, y0 + sa * LASER_LEN * i / 3, 80, D * 1.6, 'fire', a);
        addFx(st, { kind: 'laser', x: R(x0), y: R(y0), a, len: LASER_LEN, dur: 2.6 });
        api.shake(13);
        break;
      }
      case 'a_rocket': {
        const len = Math.min(980, Math.hypot(tx - x, ty - y) + 120);
        [-.11, .11].forEach((o, k) => {
          const aa = a + o, c = Math.cos(aa), s = Math.sin(aa), x0 = x + c * 30, y0 = y + s * 30, t0 = k * .28;
          for (let dd = 100; dd < len; dd += 110) later(st, t0 + dd / FIST_SPEED, api => api.strike(x0 + c * dd, y0 + s * dd, 44, D * 1.1, null, null, true));
          later(st, t0 + len / FIST_SPEED, api => { api.strike(x0 + c * len, y0 + s * len, FIST_BLAST, D * 1.9, null, 'crater', true); api.shake(12); });
          addFx(st, { kind: 'rocket', x: R(x0), y: R(y0), a: +aa.toFixed(3), len: R(len), t0, dur: t0 + len / FIST_SPEED + 1.8 });
        });
        api.shake(5);
        break;
      }
      case 'a_blades': {
        const len = Math.min(580, Math.hypot(tx - x, ty - y) + 60);
        addFx(st, { kind: 'spin', x0: R(x), y0: R(y), cx: R(x), cy: R(y), a, len: R(len), T: .46, tick: 0, done: 0, dur: .46 + 2.4, upd: spinUpd });
        api.shake(6);
        break;
      }
      case 'a_storm': {
        const dir = st.dir || 1, a0 = a - dir * STORM_HALF, a1 = a + dir * STORM_HALF;
        st.hold = STORM_T + .3; st.holdMove = 'a_storm';
        addFx(st, { kind: 'storm', ox: R(x), oy: R(y), a0: +a0.toFixed(3), a1: +a1.toFixed(3), cur: +a0.toFixed(3), T: STORM_T, tick: 0, wtick: .25, trail: [], dur: STORM_T + 2.6, upd: stormUpd });
        const s = [];
        for (let i = 0; i < 26; i++) {
          const rr = STORM_R * Math.sqrt(Math.random()), aa = Math.random() * TAU, sx = R(tx + Math.cos(aa) * rr), sy = R(ty + Math.sin(aa) * rr);
          const l = +(i * .085).toFixed(3), t = +(l + .7 + Math.random() * .2).toFixed(3);
          s.push([sx, sy, l, t, R(rand(190, 290))]);
          later(st, t, api => { api.strike(sx, sy, MIS_R + 6, D * 1.0, null, i % 3 === 0 ? 'crater' : null, true); if (i % 3 === 0) api.shake(7); });
        }
        addFx(st, { kind: 'missiles', x0: R(x - f * 8), y0: R(y), s, dur: s[s.length - 1][3] + 2.6 });
        api.shake(10);
        break;
      }
      // ---------------------------------------------------------------- Human
      case 'h_soul': {
        const x1 = x + ca * (SOUL_LEN + 20), y1 = y + sa * (SOUL_LEN + 20), p = victim(api, (x + x1) / 2, (y + y1) / 2, SOUL_LEN / 2 + 60);
        if (p && segDist(p.x, p.y, x, y, x1, y1) < 40 + (p.r || 12)) {
          st.hold = 2.5; st.holdMove = 'h_soul';
          grab(api, addFx(st, { kind: 'soul', live: 1, px: R(p.x), py: R(p.y), T: 2.3, tick: .3, rip: 0, dur: 2.3 + 1.2, upd: soulUpd }), p);
          api.shake(6);
        } else addFx(st, { kind: 'grasp', x: R(x + ca * SOUL_LEN), y: R(y + sa * SOUL_LEN), a, dur: 1.1 });
        break;
      }
      case 'h_rods': {
        const list = [];
        for (let v = 0; v < 2; v++) for (let i = 0; i < 9 - v; i++) list.push([+(a + (i - 4 + v * .5) * .12).toFixed(3), +(v * .34).toFixed(2)]);
        addFx(st, { kind: 'hrods', x: R(x), y: R(y), list, dur: .34 + ROD_LEN / ROD_SPEED + 2.4, upd: hrodsUpd });
        api.shake(5);
        break;
      }
      case 'h_read': {
        const p = api.player;
        if (!p) break;
        let px = p.x + Math.max(-500, Math.min(500, st.pv[0])) * .6, py = p.y + Math.max(-500, Math.min(500, st.pv[1])) * .6;
        const dd = Math.hypot(px - p.x, py - p.y);
        if (dd > 260) { px = p.x + (px - p.x) * 260 / dd; py = p.y + (py - p.y) * 260 / dd; }
        if (api.blocked(px, py, 10)) { px = p.x; py = p.y; }
        const ba = Math.atan2(py - y, px - x), nx = px - Math.cos(ba) * 85, ny = py - Math.sin(ba) * 85;
        const ox = x, oy = y;
        if (!api.blocked(nx, ny, z.r)) { z.x = nx; z.y = ny; }
        addFx(st, { kind: 'read', x: R(px), y: R(py), ox: R(ox), oy: R(oy), nx: R(z.x), ny: R(z.y), T: .6, dur: .6 + 1.8 });
        later(st, .6, api => { api.strike(px, py, READ_R, D * 1.9, null, 'shockwave', true); api.knockback({ x: px, y: py }, READ_R + 40, 150, 0); api.shake(12); });
        st.hold = .75; st.holdMove = 'h_read';
        break;
      }
      case 'h_field': {
        st.hold = HF_T + .3; st.holdMove = 'h_field';
        const hands = [];
        for (let i = 0; i < 14; i++) { const rr = HF_R * (.2 + .72 * Math.sqrt(hash(i * 3.7 + st.casts))), aa = i * 2.399 + st.casts; hands.push([R(tx + Math.cos(aa) * rr), R(ty + Math.sin(aa) * rr)]); }
        addFx(st, { kind: 'hfield', x: tx, y: ty, R: HF_R, T: HF_T, tick: .35, done: 0, hands, dur: HF_T + 1.5, upd: hfieldUpd });
        api.shake(8);
        break;
      }
      // ---------------------------------------------------------------- Animal
      case 'n_dog': {
        const len = Math.min(900, Math.hypot(tx - x, ty - y) + 130), x0 = x + ca * 60, y0 = y + sa * 60, t0 = .25;
        const ex = x0 + ca * len, ey = y0 + sa * len, tEnd = +(t0 + len / DOG_SPEED).toFixed(3), tS = +(tEnd + .5).toFixed(3);
        for (let dd = 90; dd < len; dd += 110) later(st, t0 + dd / DOG_SPEED, api => api.strike(x0 + ca * dd, y0 + sa * dd, 78, D * 1.0, null, null, true));
        later(st, tEnd, api => { api.strike(ex, ey, 120, D * 1.8, null, 'earth', true); api.shake(10); });
        const splits = [-.75, 0, .75].map(o => +(a + o).toFixed(3));
        for (const s2 of splits) {
          const c = Math.cos(s2), s = Math.sin(s2);
          for (let dd = 80; dd < DOG_SPLIT; dd += 100) later(st, tS + dd / 900, api => api.strike(ex + c * dd, ey + s * dd, 70, D * 1.1, null, null, true));
          later(st, tS + DOG_SPLIT / 900, api => { api.strike(ex + c * DOG_SPLIT, ey + s * DOG_SPLIT, 95, D * 1.3, null, 'earth', true); api.shake(7); });
        }
        addFx(st, { kind: 'dog', x0: R(x0), y0: R(y0), a, len: R(len), t0, tEnd, tS, splits, dur: tS + DOG_SPLIT / 900 + 1.6 });
        break;
      }
      case 'n_rhino': {
        const lanes = st.lanes || [];
        for (const [la, lx, ly, t0] of lanes) {
          const c = Math.cos(la), s = Math.sin(la);
          for (let dd = 60, i = 0; dd <= RHINO_LEN; dd += 105, i++) later(st, t0 + dd / RHINO_SPEED, api => { api.strike(lx + c * dd, ly + s * dd, 80, D * 1.6, null, i % 4 === 3 ? 'earth' : null, true); if (i % 4 === 0) api.shake(6); });
          later(st, t0 + RHINO_LEN / RHINO_SPEED + .05, api => { api.strike(lx + c * (RHINO_LEN + 40), ly + s * (RHINO_LEN + 40), 150, D * 2.0, null, 'crater', true); api.shake(12); });
        }
        addFx(st, { kind: 'rhino', lanes, dur: .6 + RHINO_LEN / RHINO_SPEED + 1.9 });
        st.lanes = null;
        break;
      }
      case 'n_bird': {
        const [sx, sy] = (st.lanes || [[R(tx - ca * 760), R(ty - sa * 760)]])[0];
        for (let dd = 60, i = 0; dd < BIRD_LEN; dd += 110, i++) {
          const px = sx + ca * dd, py = sy + sa * dd;
          later(st, .2 + dd / BIRD_SPEED, api => { api.strike(px, py, BIRD_W, D * 1.5, null, i % 6 === 3 ? 'shockwave' : null, true); if (i % 3 === 0) api.knockback({ x: px, y: py }, BIRD_W + 30, 140, 0); });
        }
        addFx(st, { kind: 'bird', x: sx, y: sy, a, dur: .2 + BIRD_LEN / BIRD_SPEED + 1.3 });
        st.lanes = null;
        api.shake(6);
        break;
      }
      case 'n_cham': {
        st.hide = 1.25; st.hold = 1.25 + .6 + .35; st.holdMove = 'n_cham';
        addFx(st, { kind: 'vanish', x: R(x), y: R(y), dur: 1.3 });
        later(st, 1.25, api => {
          const p = api.player;
          if (!p) return;
          const b = Math.atan2(p.y - y, p.x - x);
          let nx = z.x, ny = z.y;
          for (const o of [0, .9, -.9, 1.8, -1.8]) {
            const cx = p.x + Math.cos(b + o) * 230, cy = p.y + Math.sin(b + o) * 230;
            if (!api.blocked(cx, cy, z.r + 4)) { nx = cx; ny = cy; break; }
          }
          z.x = nx; z.y = ny;
          const ta = Math.atan2(p.y - ny, p.x - nx);
          addFx(st, { kind: 'cham', x: R(nx), y: R(ny), a: +ta.toFixed(3), T: .6, dur: .6 + 1.4 });
          addFx(st, { kind: 'poof', x: R(nx), y: R(ny), r: 95, dur: .9 });
          later(st, .6, api => {
            const x1 = nx + Math.cos(ta) * TONGUE_LEN, y1 = ny + Math.sin(ta) * TONGUE_LEN;
            api.line(nx, ny, x1, y1, 34, D * 1.5, null);
            const q = victim(api, (nx + x1) / 2, (ny + y1) / 2, TONGUE_LEN / 2 + 40);
            if (q && segDist(q.x, q.y, nx, ny, x1, y1) < 34 + 14) {
              const dq = Math.hypot(q.x - nx, q.y - ny);
              api.knockback({ x: nx, y: ny }, dq + 20, -Math.max(0, Math.min(260, dq - 90)), 0);
            }
            api.shake(8);
          });
        });
        break;
      }
      case 'n_stampede': {
        const lanes = st.lanes || [];
        let tEnd = 0;
        for (const [lx, ly, t0] of lanes) {
          for (const lag of [0, ST_PACK * 2 / ST_SPEED]) for (let dd = 70, i = 0; dd <= ST_LEN; dd += 105, i++) later(st, t0 + lag + dd / ST_SPEED, api => { api.strike(lx + ca * dd, ly + sa * dd, 72, D * (lag ? 1.1 : 1.6), null, !lag && i % 5 === 4 ? 'earth' : null, true); if (i % 4 === 0) api.shake(6); });
          tEnd = Math.max(tEnd, t0 + (ST_LEN + ST_PACK * 2) / ST_SPEED);
        }
        const sx = x - ca * 120, sy = y - sa * 120, ex = sx + ca * (ST_LEN + 40), ey = sy + sa * (ST_LEN + 40);
        later(st, tEnd + .05, api => { api.strike(ex, ey, 250, D * 2.2, '#ffd8a0', 'crater'); api.shake(20); });
        st.hold = 1.1; st.holdMove = 'n_stampede';
        addFx(st, { kind: 'stampede', x: R(x), y: R(y), a, ex: R(ex), ey: R(ey), lanes, tEnd: +tEnd.toFixed(3), dur: tEnd + 2.0 });
        st.lanes = null;
        api.shake(10);
        break;
      }
      // ---------------------------------------------------------------- Preta
      case 'p_drain': {
        const len = Math.min(DRAIN_LEN, Math.hypot(tx - x, ty - y) + 40);
        addFx(st, { kind: 'pdash', x0: R(x), y0: R(y), cx: R(x), cy: R(y), a, len: R(len), T: .32, tick: 0, done: 0, dur: .32 + 1.2, upd: pdashUpd });
        break;
      }
      case 'p_absorb':
        st.guard = 3.0; st.guardHp = z.health;
        addFx(st, { kind: 'absorb', dur: 3.0 });
        break;
      case 'p_vortex':
        st.hold = 1.9; st.holdMove = 'p_vortex';
        addFx(st, { kind: 'vortex', x: R(x), y: R(y), T: 1.8, tick: .1, done: 0, dur: 1.8 + 1.4, upd: vortexUpd });
        break;
      case 'p_spit': {
        const list = [];
        for (let i = 0; i < 7; i++) list.push([+(a + (i - 3) * .17).toFixed(3), -1, 0]);
        addFx(st, { kind: 'orbs', x: R(x + ca * 20), y: R(y + sa * 20), list, dur: ORB_LEN / ORB_SPEED + 1.0, upd: orbsUpd });
        api.shake(5);
        break;
      }
      case 'p_field':
        st.hold = PF_T + .25; st.holdMove = 'p_field';
        addFx(st, { kind: 'pfield', x: R(x), y: R(y), T: PF_T, tick: .3, done: 0, dur: PF_T + 1.4, upd: pfieldUpd });
        api.shake(8);
        break;
      // ---------------------------------------------------------------- Naraka
      case 'k_tongue': {
        const [kx, ky] = (st.spots || [[R(x), R(y)]])[0];
        const ka = Math.atan2(ty - ky, tx - kx), len = Math.min(KT_LEN, Math.hypot(tx - kx, ty - ky) + 60);
        addFx(st, { kind: 'king', x: kx, y: ky, a: +ka.toFixed(3), mode: 't', len: R(len), dur: 2.3 });
        later(st, .28, api => {
          const x1 = kx + Math.cos(ka) * len, y1 = ky + Math.sin(ka) * len;
          api.line(kx, ky, x1, y1, 40, D * 1.4, null);
          const q = victim(api, (kx + x1) / 2, (ky + y1) / 2, len / 2 + 50);
          if (q && segDist(q.x, q.y, kx, ky, x1, y1) < 40 + 14) {
            const dq = Math.hypot(q.x - kx, q.y - ky);
            api.knockback({ x: kx, y: ky }, dq + 20, -Math.max(0, Math.min(300, dq - 95)), 0);
          }
          api.shake(7);
        });
        later(st, .8, api => { api.strike(kx + Math.cos(ka) * 80, ky + Math.sin(ka) * 80, 115, D * 1.7, null, 'earth', true); api.shake(11); });
        st.spots = null;
        break;
      }
      case 'k_rods': {
        const spots = (st.spots || []).map((s, i) => [s[0], s[1], +(.12 + i * .06 + Math.random() * .05).toFixed(3), +rand(-.3, .3).toFixed(2)]);
        spots.forEach(([sx, sy, t], i) => later(st, t, api => { api.strike(sx, sy, 60, D * 1.0, null, i % 5 === 0 ? 'crater' : null, true); if (i % 4 === 0) api.shake(6); }));
        const last = spots.length ? Math.max(...spots.map(s => s[2])) : 0;
        later(st, last + .9, api => { for (const [sx, sy] of spots) api.strike(sx, sy, 66, D * .3, null, null, true); });
        addFx(st, { kind: 'nrods', x: tx, y: ty, spots, last, dur: last + 3.2 });
        st.spots = null;
        break;
      }
      case 'k_judge': {
        addFx(st, { kind: 'judge', x: tx, y: ty, dur: 2.7 });
        addFx(st, { kind: 'king', x: tx, y: R(ty - JUDGE_R1 - 40), a: Math.PI / 2, mode: 'j', len: 0, dur: 2.4 });
        const rm = (JUDGE_R0 + JUDGE_R1) / 2, hw = (JUDGE_R1 - JUDGE_R0) / 2 + 10;
        for (let i = 0; i < 12; i++) { const aa = i * TAU / 12; api.strike(tx + Math.cos(aa) * rm, ty + Math.sin(aa) * rm, hw, D * 1.6, null, i % 4 === 0 ? 'fire' : null, true); }
        later(st, .65, api => { api.strike(tx, ty, 125, D * 1.9, null, 'fire', true); api.shake(12); });
        // The King of Hell restores every path standing near Naraka.
        for (const o of [z, ...team(z)]) if (o.health > 0 && Math.hypot(o.x - z.x, o.y - z.y) < 900) o.health = Math.min(o.maxHealth, o.health + o.maxHealth * .06);
        api.shake(10);
        break;
      }
      case 'k_heal': case 'k_revive': {
        const o = byId(st.tid), rev = move === 'k_revive', ox = o ? o.x : st.tx, oy = o ? o.y : st.ty;
        addFx(st, { kind: 'king', x: R(ox), y: R(oy - 46), a: Math.PI / 2, mode: rev ? 'r' : 'h', len: 0, dur: 2.4 });
        addFx(st, { kind: 'heal', x: R(ox), y: R(oy), rev: rev ? 1 : 0, dur: 2.0 });
        const tid = st.tid;
        later(st, .6, api => {
          const q = byId(tid);
          if (!q) return;
          if (rev) {
            if (q.health <= 0 && q.deathTimer > 0) {
              q.health = Math.round(q.maxHealth * .5); q.deathTimer = 0; q.hitFlash = 0; q.woundLevel = .5;
              if (q.pp) Object.assign(q.pp, { revived: (q.pp.revived || 0) + 1, windup: 0, move: '', hold: 0, timer: 1.2, tele: [] });
              st.revLeft--;
            }
          } else if (q.health > 0) q.health = Math.min(q.maxHealth, q.health + q.maxHealth * .22);
          api.burst(q.x, q.y - 40, '#b8ffd0', 18);
          api.shake(6);
        });
        break;
      }
      case 'k_bite': {
        st.hold = .7; st.holdMove = 'k_bite';
        addFx(st, { kind: 'bite', x: tx, y: ty, T: BITE_T, tick: BITE_T + .5, n: 0, dur: BITE_T + 3.4, upd: biteUpd });
        later(st, BITE_T, api => {
          api.strike(tx, ty, BITE_R, D * 3.8, '#ff6a8a', 'crater');
          for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + .5; api.world(tx + Math.cos(aa) * 260, ty + Math.sin(aa) * 260, 140, D * 2.4, 'crater', aa); }
          api.shake(26);
        });
        break;
      }
    }
  }

  // ------------------------------------------------------------------ running jutsu (fx.upd)
  function dashMove(z, fx, api, st) {
    const k = easeInOut(fx.age / fx.T), c = Math.cos(fx.a), s = Math.sin(fx.a);
    const gx = fx.x0 + c * fx.len * k, gy = fx.y0 + s * fx.len * k;
    api.move(gx - z.x, gy - z.y);
    fx.cx = R(z.x); fx.cy = R(z.y);
    st.dash = .05;
  }
  function spinUpd(fx, dt, api, z, st) {
    if (fx.age < fx.T) {
      dashMove(z, fx, api, st);
      if ((fx.tick -= dt) <= 0) { fx.tick = .07; api.strike(z.x, z.y, SPIN_R, api.damage * .7, null, null, true); }
    } else if (!fx.done) {
      fx.done = 1; fx.cx = R(z.x); fx.cy = R(z.y);
      api.strike(z.x, z.y, DRILL_R, api.damage * 1.7, null, 'earth', true);
      api.shake(12);
    }
  }
  function stormUpd(fx, dt, api, z) {
    if (fx.age >= fx.T) return;
    const ang = fx.a0 + (fx.a1 - fx.a0) * easeInOut(fx.age / fx.T), c = Math.cos(ang), s = Math.sin(ang);
    fx.cur = +ang.toFixed(3); fx.ox = R(z.x); fx.oy = R(z.y);
    const ex = z.x + c * STORM_LEN, ey = z.y + s * STORM_LEN;
    if ((fx.tick -= dt) <= 0) { fx.tick = .1; api.line(z.x, z.y, ex, ey, 34, api.damage * .9, null); }
    if ((fx.wtick -= dt) <= 0) {
      fx.wtick = .3;
      api.world(z.x + c * STORM_LEN * .55, z.y + s * STORM_LEN * .55, 80, api.damage * 1.6, 'fire', ang);
      api.world(ex, ey, 110, api.damage * 1.8, 'fire', ang);
      fx.trail.push(fx.cur);
      if (fx.trail.length > 10) fx.trail.shift();
      api.shake(6);
    }
  }
  function soulUpd(fx, dt, api, z, st) {
    if (!fx.live) return;
    const p = held(api, fx);
    if (!p) { fx.live = 0; return; }
    fx.px = R(p.x); fx.py = R(p.y);
    const d = Math.hypot(p.x - z.x, p.y - z.y);
    if (d > SOUL_LEN + 160) { fx.live = 0; fx.rip = -fx.age; st.hold = Math.min(st.hold, .3); return; }
    if ((fx.tick -= dt) <= 0) { fx.tick = .5; api.knockback(z, d + 30, -Math.min(48, Math.max(0, d - 70)), api.damage * .45); }
    if (fx.age >= fx.T) {
      fx.live = 0; fx.rip = +fx.age.toFixed(2);
      api.strike(p.x, p.y, 70, api.damage * 1.5, null, null, true);
      api.shake(10);
    }
  }
  function hrodsUpd(fx, dt, api) {
    for (const [a, t0] of fx.list) {
      const d = (fx.age - t0) * ROD_SPEED;
      if (d > 0 && d < ROD_LEN) api.strike(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, 24, api.damage * .9, null, null, true);
    }
  }
  function hfieldUpd(fx, dt, api) {
    if (fx.age < fx.T) {
      if ((fx.tick -= dt) <= 0) { fx.tick = .45; api.knockback(fx, fx.R, -50, api.damage * .5); api.shake(4); }
    } else if (!fx.done) {
      fx.done = 1;
      api.strike(fx.x, fx.y, fx.R, api.damage * 2.6, '#cfeaff', 'vortex');
      api.world(fx.x, fx.y, 260, api.damage * 2.4, 'vortex');
      api.shake(20);
    }
  }
  function pdashUpd(fx, dt, api, z, st) {
    if (fx.age < fx.T) {
      dashMove(z, fx, api, st);
      if ((fx.tick -= dt) <= 0) { fx.tick = .08; api.strike(z.x, z.y, 70, api.damage * .9, null, null, true); }
      return;
    }
    if (fx.done) return;
    fx.done = 1; fx.cx = R(z.x); fx.cy = R(z.y);
    const p = victim(api, z.x, z.y, 125), d = p ? Math.hypot(p.x - z.x, p.y - z.y) : 1e9;
    if (d < 125) {
      st.hold = 1.9; st.holdMove = 'p_drain';
      grab(api, addFx(st, { kind: 'drain', live: 1, px: R(p.x), py: R(p.y), T: 1.8, tick: .15, n: 0, dur: 1.8 + .9, upd: drainUpd }), p);
    } else {
      api.strike(z.x, z.y, 105, api.damage * 1.2, null, 'earth', true);
      api.shake(8);
    }
  }
  function drainUpd(fx, dt, api, z, st) {
    if (!fx.live) return;
    const p = held(api, fx);
    if (!p) { fx.live = 0; return; }
    fx.px = R(p.x); fx.py = R(p.y);
    const d = Math.hypot(p.x - z.x, p.y - z.y);
    if (d > 380) { fx.live = 0; st.hold = Math.min(st.hold, .3); return; }
    if ((fx.tick -= dt) <= 0) {
      fx.tick = .45; fx.n++;
      api.knockback(z, d + 30, -Math.min(30, Math.max(0, d - 50)), api.damage * .55);
      z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .025);
    }
    if (fx.age >= fx.T) fx.live = 0;
  }
  function vortexUpd(fx, dt, api, z) {
    fx.x = R(z.x); fx.y = R(z.y);
    if (fx.age < fx.T) {
      if ((fx.tick -= dt) <= 0) { fx.tick = .3; api.knockback(z, VORTEX_R, -44, api.damage * .25); }
    } else if (!fx.done) {
      fx.done = 1;
      api.strike(z.x, z.y, SLAM_R, api.damage * 2.1, null, 'crater', true);
      api.world(z.x, z.y, 200, api.damage * 2.2, 'crater');
      api.shake(16);
    }
  }
  function orbsUpd(fx, dt, api) {
    const p = api.player, d = fx.age * ORB_SPEED, pseudo = pseudoOf(api);
    for (const o of fx.list) {
      if (o[1] >= 0) continue;
      const ox = fx.x + Math.cos(o[0]) * d, oy = fx.y + Math.sin(o[0]) * d;
      const touch = pseudo ? !!(api.nearestFoe && api.nearestFoe(ox, oy, 52)) : p && Math.hypot(p.x - ox, p.y - oy) < 40 + (p.r || 12);
      if (d >= ORB_LEN || api.blocked(ox, oy, 6) || touch) {
        o[1] = +fx.age.toFixed(2); o[2] = R(Math.min(d, ORB_LEN));
        api.strike(ox, oy, 85, api.damage * 1.3, null, null, true);
      }
    }
  }
  function pfieldUpd(fx, dt, api, z) {
    fx.x = R(z.x); fx.y = R(z.y);
    if (fx.age < fx.T) {
      if ((fx.tick -= dt) <= 0) {
        fx.tick = .5;
        api.knockback(z, PF_R, -36, api.damage * .45);
        const p = victim(api, z.x, z.y, PF_R);
        if (p && Math.hypot(p.x - z.x, p.y - z.y) < PF_R) z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .012);
        for (const o of team(z)) if (o.health > 0 && o.pp && Math.hypot(o.x - z.x, o.y - z.y) < 800) o.pp.shield = 1.2;
      }
    } else if (!fx.done) {
      fx.done = 1;
      api.strike(z.x, z.y, PF_R, api.damage * 2.4, '#d8c8ff', 'vortex');
      api.world(z.x, z.y, 280, api.damage * 2.4, 'vortex');
      api.shake(22);
    }
  }
  function biteUpd(fx, dt, api) {
    if (fx.age < fx.tick || fx.n >= 5) return;
    fx.tick += .5; fx.n++;
    api.strike(fx.x, fx.y, BITE_R - 50, api.damage * .4, null, null, true);
  }

  function release(z, st, api) {
    const D = api.damage || 60;
    api.knockback(z, 320, 230, D * 1.7);
    api.world(z.x, z.y, 220, D * 2, 'shockwave');
    addFx(st, { kind: 'release', x: R(z.x), y: R(z.y), r: 320, dur: 1.4 });
    api.shake(13);
  }

  // ------------------------------------------------------------------ update
  function update(z, dt, api) {
    const m = members[z.bossId];
    if (!m) return;
    const st = state(z);
    seen(z);
    st.t += dt;
    st.dash = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      if (!fx) continue;
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api, z, st);
      if (fx.age >= fx.dur) { const j = st.fx.indexOf(fx); if (j >= 0) st.fx.splice(j, 1); }
    }
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.guard = 0; st.hide = 0; st.windup = 0; st.move = ''; z.manualBusy = false; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if (ev && (ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    // Rinnegan vision: track how the target moves (mind reading predicts where it will be).
    const p = api.player;
    if (p && p.pseudo) { st.pv[0] = st.pv[1] = 0; st.pl = [R(p.x), R(p.y)]; }
    else if (p) {
      if (st.pl && dt > 0) {
        const vx = (p.x - st.pl[0]) / dt, vy = (p.y - st.pl[1]) / dt;
        if (Math.abs(vx) < 2500 && Math.abs(vy) < 2500) { st.pv[0] = R(lerp(st.pv[0], vx, .12)); st.pv[1] = R(lerp(st.pv[1], vy, .12)); }
      }
      st.pl = [+p.x.toFixed(1), +p.y.toFixed(1)];
    }
    st.hold = Math.max(0, st.hold - dt);
    st.hide = Math.max(0, st.hide - dt);
    st.shield = Math.max(0, st.shield - dt);
    st.absorb = Math.max(0, st.absorb - dt);
    st.reactCd -= dt; st.revCd -= dt;
    // Preta's seal drinks every blow; when it lifts, the excess bursts back out.
    if (st.guard > 0) {
      if (z.health < st.guardHp) { z.health = Math.min(z.maxHealth, z.health + (st.guardHp - z.health) * .8); st.absorb = .35; }
      st.guardHp = z.health;
      st.guard -= dt;
      if (st.guard <= 0) { st.guard = 0; release(z, st, api); }
    }
    const fielding = st.hold > 0 && st.holdMove === 'p_field';
    z.armorScale = (m.armor || 1) * (st.guard > 0 ? .25 : 1) * (fielding ? .35 : 1) * (st.shield > 0 ? .5 : 1) * (st.hide > 0 ? .3 : 1);
    st.hpClock += dt;
    if (st.hpClock > 1.5) { st.hpClock = 0; st.hpMark = z.health; }

    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && !st.dash && z.manual) {
      // driven by the user: no reflex seal or revive, cast only what was asked for
      st.holdMove = '';
      const want = z.manualCast != null && st.guard <= 0 ? MANUAL[z.bossId][z.manualCast] : null;
      if (st.guard <= 0) z.manualCast = null;
      if (want) announce(z, st, m, api, want);
    } else if (st.hold <= 0 && !st.dash) {
      st.holdMove = '';
      st.timer -= dt;
      const d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      const hurt = st.hpMark - z.health > z.maxHealth * .045;
      if (z.bossId === 'pain_preta' && hurt && st.reactCd <= 0 && st.guard <= 0 && st.timer > .2) { st.reactCd = 10; st.hpMark = z.health; st.force = 'p_absorb'; announce(z, st, m, api); }
      else if (z.bossId === 'pain_naraka' && st.revLeft > 0 && st.revCd <= 0 && healTarget(z, true)) { st.revCd = 12; st.force = 'k_revive'; announce(z, st, m, api); }
      else if (st.timer <= 0 && p && (st.force || d < 950)) announce(z, st, m, api);
    }
    z.kageDash = st.dash > 0 ? .05 : 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    // Human and Animal fight from range: they hold their distance and back off when crowded.
    let spd = st.guard > 0 || fielding ? .45 : .9;
    const keep = KEEP[z.bossId];
    if (keep && p && !z.manual && st.windup <= 0 && st.hold <= 0 && !st.dash) {
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (d < keep) { spd = .06; if (d < keep - 90 && d > 1) api.move((z.x - p.x) / d * 140 * dt, (z.y - p.y) / d * 140 * dt); }
    }
    z.speedScale = spd;
    z.manualBusy = st.windup > 0 || st.hold > 0 || st.dash > 0 || st.guard > 0;
  }

  // ------------------------------------------------------------------ cached art
  function sm(g, pts) {
    const n = pts.length, m = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    g.beginPath();
    let p = m(n - 1); g.moveTo(p[0], p[1]);
    for (let i = 0; i < n; i++) { p = m(i); g.quadraticCurveTo(pts[i][0], pts[i][1], p[0], p[1]); }
    g.closePath();
  }
  function pg(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  function fs(g, fill, O, lw) { g.fillStyle = fill; g.fill(); if (O) { g.strokeStyle = O; g.lineWidth = lw || 2; g.stroke(); } }
  // Shade the part of the current path below/behind a line: fill clipped to the path.
  function shadeIn(g, color, x, y, w, h) { g.save(); g.clip(); g.fillStyle = color; g.fillRect(x, y, w, h); g.restore(); }
  // Rinnegan eye: lilac with concentric rings.
  function rinneEye(g, x, y, r) {
    g.fillStyle = '#d8ccf4'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = '#4a3480'; g.lineWidth = Math.max(.8, r * .14);
    for (const k of [.72, .45]) { g.beginPath(); g.arc(x, y, r * k, 0, TAU); g.stroke(); }
    g.fillStyle = '#2a1a50'; g.beginPath(); g.arc(x, y, r * .2, 0, TAU); g.fill();
    g.strokeStyle = '#140a20'; g.lineWidth = Math.max(1, r * .2); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }
  // A black chakra receiver sticking out of a summon's hide.
  function pierce(g, x, y, ang, len) {
    g.strokeStyle = '#0c0a12'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
    g.strokeStyle = 'rgba(170,160,210,.8)'; g.lineWidth = .9; g.beginPath(); g.moveTo(x + 1, y - 1); g.lineTo(x + Math.cos(ang) * len + 1, y + Math.sin(ang) * len - 1); g.stroke();
    g.fillStyle = '#0c0a12'; g.beginPath(); g.ellipse(x + Math.cos(ang) * len, y + Math.sin(ang) * len, 2.6, 4, ang, 0, TAU); g.fill();
  }

  function missileSpr() {
    return Kit().sprite('pp:missile', 40, 16, g => {
      g.fillStyle = '#16121a'; g.beginPath(); g.moveTo(3, 3.6); g.lineTo(27, 3.6); g.quadraticCurveTo(39, 8, 27, 12.4); g.lineTo(3, 12.4); g.closePath(); g.fill();
      g.fillStyle = '#9ea6b2'; g.beginPath(); g.moveTo(4.4, 5); g.lineTo(26.6, 5); g.quadraticCurveTo(35.6, 8, 26.6, 11); g.lineTo(4.4, 11); g.closePath(); g.fill();
      g.fillStyle = '#d2342c'; g.beginPath(); g.moveTo(25, 5); g.quadraticCurveTo(35.6, 8, 25, 11); g.closePath(); g.fill();
      g.fillStyle = '#eef3f8'; g.fillRect(6, 5.6, 18, 1.4);
      g.fillStyle = '#566070'; g.fillRect(6, 9.2, 19, 1.5);
      g.fillStyle = '#34383f'; pg(g, [[2, 1], [9, 4.4], [4, 4.4]]); g.fill(); pg(g, [[2, 15], [9, 11.6], [4, 11.6]]); g.fill();
    });
  }
  function fistSpr() {
    return Kit().sprite('pp:fist', 56, 36, g => {
      const O = '#14121a';
      g.lineJoin = 'round';
      pg(g, [[2, 11], [22, 9], [22, 27], [2, 25]]); fs(g, '#5a616c', O, 2);
      g.fillStyle = '#c8d0da'; g.fillRect(4, 12, 16, 3);
      for (const x of [8, 15]) { g.strokeStyle = '#2a2e36'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, 10); g.lineTo(x, 26); g.stroke(); }
      sm(g, [[20, 6], [44, 4], [53, 12], [53, 24], [44, 32], [20, 30]]); fs(g, '#9aa2ae', O, 2.4);
      shadeIn(g, 'rgba(30,30,50,.35)', 0, 22, 60, 20);
      g.strokeStyle = '#3c424c'; g.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(44, 10 + i * 6.5); g.quadraticCurveTo(50, 12 + i * 6.5, 53, 13 + i * 6.5); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(34, 10, 10, 2.4, -.1, 0, TAU); g.fill();
      g.fillStyle = '#ff8a3a'; g.fillRect(0, 13, 3, 10);
    });
  }

  // Three-headed summon dog (side view, facing right; feet on y = 122).
  function dogSpr(fr) {
    return Kit().sprite('pp:dog' + fr, 210, 132, g => {
      const O = '#1a1210', FUR = '#8c7662', FUR_D = '#5c4a3c', FUR_L = '#c0a68c';
      g.lineJoin = 'round'; g.lineCap = 'round';
      const sw = fr ? 1 : -1;
      const leg = (hx, hy, kx, fx, col) => {
        g.strokeStyle = O; g.lineWidth = 15; g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, hy + 26); g.lineTo(fx, 120); g.stroke();
        g.strokeStyle = col; g.lineWidth = 11; g.stroke();
        g.fillStyle = col; g.beginPath(); g.ellipse(fx + 4, 120, 9, 4.5, 0, 0, TAU); g.fill(); g.strokeStyle = O; g.lineWidth = 1.6; g.stroke();
      };
      leg(62, 84, 54 - sw * 6, 50 - sw * 14, FUR_D);
      leg(132, 84, 140 + sw * 6, 138 + sw * 14, FUR_D);
      // bushy tail
      sm(g, [[44, 70], [24, 54], [10, 34], [18, 30], [32, 46], [52, 60]]); fs(g, FUR_D, O, 2);
      // body with a spiky ridge of fur along the back
      sm(g, [[38, 74], [48, 50], [90, 40], [134, 44], [156, 62], [146, 90], [100, 96], [54, 92]]); fs(g, FUR, O, 2.6);
      shadeIn(g, 'rgba(50,30,30,.32)', 0, 76, 210, 40);
      g.fillStyle = FUR_D;
      g.beginPath(); g.moveTo(46, 54);
      for (let i = 0; i <= 10; i++) { const x = 46 + i * 9.5; g.lineTo(x + 4, 40 - (i % 2 ? 12 : 4) - Math.sin(i) * 2); g.lineTo(x + 9.5, 48 - Math.abs(i - 5) * .6); }
      g.lineTo(140, 52); g.closePath(); g.fill(); g.strokeStyle = O; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = 'rgba(255,240,220,.35)'; g.beginPath(); g.ellipse(96, 58, 30, 6, -.05, 0, TAU); g.fill();
      pierce(g, 78, 50, -2.1, 22); pierce(g, 106, 46, -1.7, 26); pierce(g, 128, 50, -1.2, 20);
      leg(72, 86, 66 + sw * 8, 64 + sw * 18, FUR);
      leg(142, 84, 150 - sw * 8, 150 - sw * 18, FUR);
      // three heads: the far one howling up, the main one, the near one lunging low
      const head = (cx, cy, s, rot, tint) => {
        g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(s, s);
        sm(g, [[-16, -10], [-6, -20], [10, -16], [18, -8], [20, 6], [4, 14], [-14, 10]]); fs(g, tint ? FUR_D : FUR, O, 2.4);
        pg(g, [[-10, -14], [-16, -30], [-2, -18]]); fs(g, FUR_D, O, 2);
        // muzzle + open jaw
        sm(g, [[12, -10], [36, -6], [40, 0], [16, 4]]); fs(g, tint ? FUR_D : FUR_L, O, 2);
        sm(g, [[12, 6], [34, 8], [36, 14], [14, 14]]); fs(g, FUR_D, O, 2);
        g.fillStyle = '#8a1a20'; pg(g, [[14, 3], [38, 2], [34, 8], [14, 7]]); g.fill();
        g.fillStyle = '#f4eee0';
        for (let i = 0; i < 4; i++) { pg(g, [[16 + i * 5.4, 2.4], [19 + i * 5.4, 2.4], [17.5 + i * 5.4, 7]]); g.fill(); pg(g, [[16 + i * 5, 8], [19 + i * 5, 8], [17.5 + i * 5, 4.4]]); g.fill(); }
        g.fillStyle = O; g.beginPath(); g.ellipse(38, -4, 3.4, 2.6, 0, 0, TAU); g.fill();
        rinneEye(g, 6, -6, 5.2);
        g.strokeStyle = O; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-1, -12); g.lineTo(11, -9); g.stroke();
        pierce(g, -2, 6, 2.4, 9);
        g.restore();
      };
      head(152, 34, .9, -.45, true);
      head(164, 60, 1, 0, false);
      head(170, 84, .92, .22, false);
    });
  }

  // Summon rhinoceros (side view, facing right; feet on y = 122).
  function rhinoSpr(fr) {
    return Kit().sprite('pp:rhino' + fr, 230, 132, g => {
      const O = '#18161c', HIDE = '#8e8a92', HIDE_D = '#5e5a66', HIDE_L = '#c6c2ca', HORN = '#efe6d2';
      g.lineJoin = 'round'; g.lineCap = 'round';
      const sw = fr ? 1 : -1;
      const leg = (x, dx, col) => { sm(g, [[x - 13, 80], [x + 13, 80], [x + 12 + dx, 120], [x - 12 + dx, 121]]); fs(g, col, O, 2.2); g.fillStyle = HIDE_D; g.fillRect(x - 12 + dx, 115, 24, 5); };
      leg(64, -sw * 8, HIDE_D); leg(150, sw * 8, HIDE_D);
      sm(g, [[26, 74], [36, 40], [90, 26], [150, 30], [186, 52], [184, 84], [140, 100], [60, 100], [30, 92]]); fs(g, HIDE, O, 3);
      shadeIn(g, 'rgba(40,30,60,.32)', 0, 74, 230, 40);
      // armoured folds and plates
      g.strokeStyle = HIDE_D; g.lineWidth = 2.2;
      for (const x of [70, 112, 150]) { g.beginPath(); g.moveTo(x, 30); g.quadraticCurveTo(x - 8, 64, x + 2, 98); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(100, 40, 44, 7, -.05, 0, TAU); g.fill();
      pierce(g, 84, 32, -2.0, 24); pierce(g, 120, 28, -1.5, 28);
      leg(80, sw * 8, HIDE); leg(166, -sw * 8, HIDE);
      // head with the great horn
      sm(g, [[168, 40], [196, 44], [222, 66], [216, 86], [190, 92], [170, 80]]); fs(g, HIDE, O, 2.6);
      shadeIn(g, 'rgba(40,30,60,.3)', 160, 78, 70, 30);
      pg(g, [[204, 58], [226, 14], [214, 62]]); fs(g, HORN, O, 2);
      g.fillStyle = 'rgba(160,140,110,.45)'; pg(g, [[212, 60], [225, 20], [216, 62]]); g.fill();
      pg(g, [[190, 50], [198, 30], [196, 52]]); fs(g, HORN, O, 1.8);
      pg(g, [[170, 42], [166, 26], [178, 40]]); fs(g, HIDE_D, O, 1.6);
      rinneEye(g, 186, 60, 5.4);
      g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.moveTo(208, 80); g.lineTo(220, 78); g.stroke();
      g.fillStyle = HIDE_L; g.beginPath(); g.ellipse(196, 50, 12, 3, -.3, 0, TAU); g.fill();
    });
  }

  // Giant summon bird seen from above (facing +x); frame 0 wings spread, 1 on the downstroke.
  function birdSpr(fr) {
    return Kit().sprite('pp:bird' + fr, 360, 240, g => {
      const O = '#1c140e', W = '#6e5644', W_D = '#3c2c22', W_L = '#b49a7c', BODY = '#7a604a';
      g.lineJoin = 'round'; g.lineCap = 'round';
      const cx = 180, cy = 120, span = fr ? 92 : 112, sweep = fr ? 30 : 8;
      for (const s of [-1, 1]) {
        const tipY = cy + s * span, tipX = cx - 10 - sweep;
        const pts = [[cx + 22, cy + s * 12], [cx + 30, cy + s * (span * .5)], [tipX + 30, tipY], [tipX + 6, tipY + s * 6]];
        for (let i = 0; i < 6; i++) pts.push([tipX - 8 - i * 12, cy + s * (span - i * 9) + s * (i % 2 ? -4 : 6)]);
        pts.push([cx - 66, cy + s * 34], [cx - 26, cy + s * 14]);
        pg(g, pts); fs(g, W, O, 2.6);
        shadeIn(g, W_D, tipX - 100, s > 0 ? cy + span * .55 : cy - span * 1.2, 160, span * .65);
        g.save(); pg(g, pts); g.clip();
        g.fillStyle = W_L; sm(g, [[cx + 24, cy + s * 14], [cx + 22, cy + s * span * .45], [cx - 40, cy + s * span * .42], [cx - 44, cy + s * 20]]); g.fill();
        g.strokeStyle = W_D; g.lineWidth = 1.6;
        for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(cx + 14 - i * 12, cy + s * span * .44); g.lineTo(cx - 6 - i * 13, cy + s * (span - 4)); g.stroke(); }
        g.restore();
      }
      // tail fan
      pg(g, [[cx - 40, cy - 12], [cx - 104, cy - 30], [cx - 112, cy], [cx - 104, cy + 30], [cx - 40, cy + 12]]); fs(g, W_D, O, 2.2);
      g.strokeStyle = W; g.lineWidth = 1.4; for (const o of [-18, -6, 6, 18]) { g.beginPath(); g.moveTo(cx - 44, cy + o * .3); g.lineTo(cx - 106, cy + o * 1.4); g.stroke(); }
      // body, head, hooked beak
      sm(g, [[cx - 54, cy], [cx - 30, cy - 20], [cx + 30, cy - 18], [cx + 46, cy], [cx + 30, cy + 18], [cx - 30, cy + 20]]); fs(g, BODY, O, 2.6);
      g.fillStyle = 'rgba(255,240,220,.3)'; g.beginPath(); g.ellipse(cx, cy - 6, 30, 6, 0, 0, TAU); g.fill();
      sm(g, [[cx + 38, cy - 14], [cx + 62, cy - 12], [cx + 70, cy], [cx + 62, cy + 12], [cx + 38, cy + 14]]); fs(g, '#e8dccc', O, 2.2);
      pg(g, [[cx + 66, cy - 7], [cx + 92, cy], [cx + 66, cy + 7]]); fs(g, '#e0a83a', O, 2);
      rinneEye(g, cx + 60, cy - 8, 3.6); rinneEye(g, cx + 60, cy + 8, 3.6);
      pierce(g, cx - 10, cy - 4, -2.6, 16); pierce(g, cx + 8, cy + 6, 2.8, 14);
    });
  }

  // Chameleon (side view, facing right; feet on y = 120).
  function chamSpr() {
    return Kit().sprite('pp:cham', 240, 134, g => {
      const O = '#10201a', S = '#4f9a84', S_D = '#2f6658', S_L = '#9ad8b8';
      g.lineJoin = 'round'; g.lineCap = 'round';
      // curled tail
      g.strokeStyle = O; g.lineWidth = 14; g.beginPath(); g.moveTo(56, 80); g.quadraticCurveTo(20, 84, 18, 62); g.arc(34, 62, 16, Math.PI, Math.PI * 2.6); g.stroke();
      g.strokeStyle = S_D; g.lineWidth = 10; g.stroke();
      const leg = (x, dx, col) => { g.strokeStyle = O; g.lineWidth = 11; g.beginPath(); g.moveTo(x, 84); g.lineTo(x + dx, 100); g.lineTo(x + dx * .4, 118); g.stroke(); g.strokeStyle = col; g.lineWidth = 7; g.stroke(); };
      leg(78, -10, S_D); leg(150, 10, S_D);
      sm(g, [[50, 82], [70, 52], [120, 40], [168, 50], [186, 76], [160, 98], [100, 100], [60, 96]]); fs(g, S, O, 2.6);
      shadeIn(g, 'rgba(10,40,40,.3)', 0, 80, 240, 40);
      g.strokeStyle = S_D; g.lineWidth = 3;
      for (const x of [86, 110, 134, 156]) { g.beginPath(); g.moveTo(x, 46); g.quadraticCurveTo(x - 6, 70, x + 2, 96); g.stroke(); }
      // crest
      g.fillStyle = S_D; g.beginPath(); g.moveTo(66, 56);
      for (let i = 0; i < 9; i++) { g.lineTo(72 + i * 11, 40 - (i % 2 ? 8 : 2)); g.lineTo(78 + i * 11, 46); }
      g.lineTo(170, 54); g.closePath(); g.fill();
      leg(92, 10, S); leg(164, -8, S);
      // head with casque and the bulging Rinnegan eye
      sm(g, [[166, 52], [190, 40], [222, 60], [228, 76], [200, 88], [176, 84]]); fs(g, S, O, 2.6);
      pg(g, [[176, 50], [188, 26], [204, 44]]); fs(g, S_D, O, 2);
      g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.moveTo(196, 76); g.lineTo(228, 74); g.stroke();
      g.fillStyle = S_L; g.beginPath(); g.arc(198, 60, 11, 0, TAU); g.fill(); g.strokeStyle = O; g.lineWidth = 2; g.stroke();
      rinneEye(g, 200, 60, 6.4);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(120, 52, 34, 5, -.05, 0, TAU); g.fill();
      pierce(g, 116, 44, -1.9, 20);
    });
  }

  // The King of Hell (Enma-like judge): a giant head rising out of the ground; base on y = 300.
  function kingSpr(open) {
    return Kit().sprite('pp:king' + (open ? 1 : 0), 260, 300, g => {
      const O = '#10071a', SKIN = '#4c5a4a', SKIN_D = '#2c3a30', HAT = '#2a1838', HAT_L = '#4a2c60', GOLD = '#d8a840';
      g.lineJoin = 'round'; g.lineCap = 'round';
      sm(g, [[30, 300], [50, 236], [210, 236], [230, 300]]); fs(g, SKIN_D, O, 4);
      // flame-like beard and side locks
      for (const s of [-1, 1]) {
        const pts = [[130 + s * 70, 150], [130 + s * 98, 176]];
        for (let i = 0; i < 5; i++) pts.push([130 + s * (104 - i * 4), 196 + i * 18], [130 + s * (88 - i * 6), 192 + i * 18]);
        pts.push([130 + s * 60, 250]);
        pg(g, pts); fs(g, '#1c1424', O, 3);
      }
      const face = [[52, 150], [60, 110], [130, 98], [200, 110], [208, 150], [200, 214], [170, 258], [130, 268], [90, 258], [60, 214]];
      sm(g, face); fs(g, SKIN, O, 4);
      sm(g, face); shadeIn(g, 'rgba(10,20,20,.35)', 0, 0, 92, 300);
      sm(g, face); shadeIn(g, 'rgba(10,20,20,.25)', 0, 232, 260, 60);
      g.fillStyle = 'rgba(220,255,220,.18)'; g.beginPath(); g.ellipse(150, 128, 40, 12, -.1, 0, TAU); g.fill();
      // the tall judge's crown
      pg(g, [[40, 120], [52, 44], [86, 22], [130, 12], [174, 22], [208, 44], [220, 120], [130, 106]]); fs(g, HAT, O, 4);
      g.fillStyle = HAT_L; pg(g, [[130, 14], [174, 24], [204, 46], [212, 112], [130, 104]]); g.fill();
      for (let i = 0; i < 5; i++) { const x = 66 + i * 32; pg(g, [[x - 10, 30 - Math.abs(i - 2) * -4], [x, 2 + Math.abs(i - 2) * 6], [x + 10, 30 - Math.abs(i - 2) * -4]]); fs(g, HAT, O, 2.6); }
      pg(g, [[44, 104], [216, 104], [218, 124], [42, 124]]); fs(g, GOLD, O, 3);
      g.fillStyle = '#8a6420'; for (let x = 52; x < 214; x += 16) g.fillRect(x, 108, 8, 3);
      pg(g, [[130, 40], [152, 70], [130, 100], [108, 70]]); fs(g, GOLD, O, 3);
      rinneEye(g, 130, 70, 12);
      // brows, glaring eyes, broad nose
      g.fillStyle = '#120a14';
      pg(g, [[62, 136], [120, 150], [118, 160], [66, 148]]); g.fill();
      pg(g, [[198, 136], [140, 150], [142, 160], [194, 148]]); g.fill();
      for (const x of [96, 164]) {
        g.fillStyle = '#fff4b8'; g.beginPath(); g.ellipse(x, 168, 18, 9, 0, 0, TAU); g.fill(); g.strokeStyle = O; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#c02020'; g.beginPath(); g.arc(x + (x < 130 ? 3 : -3), 168, 5.4, 0, TAU); g.fill();
        g.fillStyle = '#100'; g.beginPath(); g.arc(x + (x < 130 ? 3 : -3), 168, 2.4, 0, TAU); g.fill();
      }
      sm(g, [[118, 176], [142, 176], [150, 204], [130, 210], [110, 204]]); fs(g, '#3c4a3c', O, 2.6);
      g.strokeStyle = 'rgba(10,20,10,.6)'; g.lineWidth = 2;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(130 + s * 34, 192); g.quadraticCurveTo(130 + s * 44, 216, 130 + s * 36, 236); g.stroke(); }
      if (!open) {
        g.strokeStyle = O; g.lineWidth = 5; g.beginPath(); g.moveTo(90, 226); g.quadraticCurveTo(130, 218, 170, 226); g.stroke();
        g.fillStyle = '#f2ecd8';
        for (const s of [-1, 1]) { pg(g, [[130 + s * 26, 222], [130 + s * 34, 222], [130 + s * 30, 244]]); g.fill(); g.strokeStyle = O; g.lineWidth = 2; g.stroke(); }
      } else {
        sm(g, [[78, 214], [130, 206], [182, 214], [176, 258], [130, 280], [84, 258]]); fs(g, '#3a0610', O, 4);
        g.fillStyle = '#7a1424'; g.beginPath(); g.ellipse(130, 248, 40, 18, 0, 0, TAU); g.fill();
        g.fillStyle = '#d0506a'; g.beginPath(); g.ellipse(130, 260, 30, 12, 0, 0, TAU); g.fill();
        g.fillStyle = '#f2ecd8'; g.strokeStyle = O; g.lineWidth = 1.6;
        for (let i = 0; i < 7; i++) { const x = 88 + i * 14; pg(g, [[x, 212], [x + 12, 212], [x + 6, 228 + (i % 3 === 0 ? 8 : 0)]]); g.fill(); g.stroke(); }
        for (let i = 0; i < 6; i++) { const x = 94 + i * 14; pg(g, [[x, 266], [x + 12, 266], [x + 6, 252 - (i % 2 ? 6 : 0)]]); g.fill(); g.stroke(); }
      }
    });
  }
  // Spectral hand reaching out of the ground (Human Path): base on y = 84.
  function handSpr() {
    return Kit().sprite('pp:hand', 56, 88, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const pts = [[16, 86], [18, 50], [8, 30], [6, 14], [12, 14], [18, 34], [20, 10], [26, 10], [27, 32], [30, 6], [36, 6], [35, 32], [40, 12], [46, 14], [42, 40], [50, 30], [54, 34], [40, 58], [38, 86]];
      pg(g, pts); g.fillStyle = 'rgba(190,240,255,.55)'; g.fill();
      g.strokeStyle = 'rgba(40,90,130,.8)'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = 'rgba(240,252,255,.95)'; g.lineWidth = 1.4; g.stroke();
    });
  }
  // A soul being torn out: pale ghost of a ninja with a trailing wisp; centre (28, 34).
  function soulSpr() {
    return Kit().sprite('pp:soul', 56, 100, g => {
      g.lineJoin = 'round';
      sm(g, [[28, 8], [42, 18], [42, 34], [38, 56], [34, 80], [28, 98], [22, 80], [18, 56], [14, 34], [14, 18]]);
      g.fillStyle = 'rgba(200,245,255,.55)'; g.fill();
      g.strokeStyle = 'rgba(60,120,160,.7)'; g.lineWidth = 2.4; g.stroke();
      g.strokeStyle = 'rgba(250,255,255,.9)'; g.lineWidth = 1.1; g.stroke();
      g.fillStyle = 'rgba(30,70,110,.75)'; g.beginPath(); g.ellipse(23, 22, 2.4, 3.6, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(33, 22, 2.4, 3.6, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(28, 31, 3, 4.4, 0, 0, TAU); g.fill();
    });
  }
  // Absorption seal (Preta's field): drawn as a true circle, radius 250 in the sprite.
  function sealSpr() {
    return Kit().sprite('pp:seal', 512, 512, g => {
      g.translate(256, 256); g.lineCap = 'round';
      g.strokeStyle = 'rgba(200,170,255,.9)'; g.lineWidth = 5;
      for (const r of [250, 236, 150, 70]) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); g.lineWidth = 2.5; }
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6, b = a + TAU / 6;
        g.beginPath(); g.moveTo(Math.cos(a) * 236, Math.sin(a) * 236); g.lineTo(Math.cos(b) * 236, Math.sin(b) * 236); g.stroke();
        g.beginPath(); g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70); g.lineTo(Math.cos(a) * 236, Math.sin(a) * 236); g.stroke();
      }
      g.lineWidth = 2;
      for (let i = 0; i < 48; i++) {
        const a = i * TAU / 48, r0 = 160 + (i % 3) * 8;
        g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a + .04) * (r0 + 20), Math.sin(a + .04) * (r0 + 20)); g.stroke();
      }
      for (let i = 0; i < 6; i++) { const a = (i + .5) * TAU / 6; g.beginPath(); g.arc(Math.cos(a) * 196, Math.sin(a) * 196, 16, 0, TAU); g.stroke(); g.beginPath(); g.arc(Math.cos(a) * 196, Math.sin(a) * 196, 7, 0, TAU); g.stroke(); }
    });
  }
  // Summoning formula drawn on the ground (radius 120 in the sprite).
  function summonSpr() {
    return Kit().sprite('pp:summon', 256, 256, g => {
      g.translate(128, 128); g.strokeStyle = 'rgba(20,14,24,.85)'; g.lineCap = 'round';
      g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 120, 0, TAU); g.stroke();
      for (let i = 0; i < 16; i++) {
        const a = i * TAU / 16, r1 = i % 2 ? 100 : 116;
        g.lineWidth = 3; g.beginPath(); g.moveTo(Math.cos(a) * 32, Math.sin(a) * 32); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
        g.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const r = 44 + k * 16, b = a + .08; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(b) * (r + 6), Math.sin(b) * (r + 6)); g.stroke(); }
      }
    });
  }

  // ------------------------------------------------------------------ shared draw helpers
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,30,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,16,44,.4)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 1.8 : faint ? 2 : 3;
    ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
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
    ctx.fillStyle = `rgba(24,12,30,${s.faint ? .08 : .16})`; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${(s.faint ? .08 : .14) + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
    ctx.strokeStyle = 'rgba(30,16,44,.4)'; ctx.lineWidth = s.faint ? 3 : 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = s.faint ? 1.5 : 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    if (!s.faint) {
      ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function markCone(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(s.x, s.y);
    const wedge = r => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, s.a - s.half, s.a + s.half); ctx.closePath(); };
    wedge(s.len); ctx.fillStyle = 'rgba(24,12,30,.14)'; ctx.fill();
    wedge(s.len * clamp01(k)); ctx.fillStyle = `rgba(${rgb},${.12 + .14 * k})`; ctx.fill();
    wedge(s.len); ctx.strokeStyle = 'rgba(30,16,44,.4)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    // sweep direction: chevrons racing round the arc
    const dir = s.dir || 1;
    ctx.lineWidth = 3; ctx.beginPath();
    for (let j = 0; j < 4; j++) {
      const u = frac(time * .9 + j / 4), an = s.a - dir * s.half + dir * 2 * s.half * u, r = s.len * .72;
      const px = Math.cos(an) * r, py = Math.sin(an) * r, tx = -Math.sin(an) * dir, ty = Math.cos(an) * dir;
      ctx.moveTo(px - tx * 18 - px / r * 12, py - ty * 18 - py / r * 12); ctx.lineTo(px, py); ctx.lineTo(px - tx * 18 + px / r * 12, py - ty * 18 + py / r * 12);
    }
    ctx.stroke();
    ctx.restore();
  }
  function markRing(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r1, 0, TAU); ctx.arc(s.x, s.y, s.r0, 0, TAU, true);
    ctx.fillStyle = `rgba(${rgb},${.14 + .2 * k})`; ctx.fill();
    for (const r of [s.r0, s.r1]) {
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.strokeStyle = 'rgba(30,16,44,.4)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
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
    cracks(ctx, x, y, r * 1.35, 8, seed, alpha, 3);
  }
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10) {
    if (alpha <= .01) return;
    const K = Kit(), dust = K.puff('dust');
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  // Black chakra receiver: a rod with a flat disc head (local +x from base to tip).
  function rod(ctx, x, y, ang, len, w, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(160,130,230,.5)'; ctx.fillRect(-1, -w / 2 - 1.5, len + 2, w + 3);
    ctx.fillStyle = '#0c0a12'; ctx.fillRect(0, -w / 2, len, w);
    ctx.beginPath(); ctx.ellipse(len, 0, w * .55, w * 1.1, 0, 0, TAU); ctx.fill();
    for (const d of [len * .3, len * .62]) ctx.fillRect(d, -w * .8, w * .5, w * 1.6);
    ctx.fillStyle = 'rgba(170,160,210,.75)'; ctx.fillRect(1, -w / 2 + .6, len - 2, Math.max(.8, w * .18));
    ctx.restore();
  }
  // Fireball explosion (overlay): k 0..1.
  function boom(ctx, x, y, r, k, seed) {
    const K = Kit(), e = easeOut(k), fade = 1 - k;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - r * .25, r * (1 + e * .5), '255,140,50', fade * .55, true);
    ctx.globalCompositeOperation = 'source-over';
    const fire = K.puff('fire'), smoke = K.puff('smoke');
    for (let i = 0; i < 7; i++) {
      const a = hash(seed + i * 3.1) * TAU, d = r * .6 * e * (.5 + hash(seed + i) * .6);
      K.stamp(ctx, smoke, x + Math.cos(a) * d * 1.2, y + Math.sin(a) * d * .5 - r * .3 * e - k * r * .45, r * .4 * (.7 + e), fade * .8 * win(k, .05, .3), 1);
    }
    for (let i = 0; i < 6; i++) {
      const a = hash(seed + i * 5.3 + 1) * TAU, d = r * .45 * e * (.4 + hash(seed + i * 2) * .6);
      K.stamp(ctx, fire, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - r * .2 * e, r * .34 * (1 - k * .5), 1 - win(k, .25, .75), 1);
    }
    ctx.strokeStyle = `rgba(255,236,200,${fade * .8})`; ctx.lineWidth = 1 + 3 * fade;
    ctx.beginPath(); ctx.ellipse(x, y, r * (.4 + e * .9), r * (.2 + e * .45), 0, 0, TAU); ctx.stroke();
  }
  // White summoning smoke bursting out (overlay): k 0..1.
  function poofDraw(ctx, x, y, r, k, seed = 1) {
    if (k <= 0 || k >= 1) return;
    const K = Kit(), poof = K.puff('poof'), e = easeOut(k), fade = 1 - easeIn(k);
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + hash(seed + i) * .4, d = r * (.25 + .75 * e) * (.7 + hash(seed + i * 2.1) * .4);
      K.stamp(ctx, poof, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - r * .35 - e * 14, r * (.3 + .2 * e) * (.8 + hash(i + seed) * .4), fade, 1);
    }
    K.stamp(ctx, poof, x, y - r * .45, r * .55 * (1 + e * .3), fade * .9, 1);
  }
  // Side-view beast sprite with its feet at (x, y); flips to face left.
  function beast(ctx, img, x, y, s, flip, footY, alpha = 1) {
    const w = img.width * s, h = img.height * s;
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, -w / 2, -footY * s, w, h);
    ctx.restore();
  }
  const PURPLE_FLAME = [[1, '#2a0848'], [.84, '#6a1cb0'], [.66, '#a24cf0'], [.46, '#dca6ff'], [.25, '#fff0ff']];
  function purpleFlame(ctx, x, y, h, v, alpha = 1) {
    const K = Kit(), img = K.flame(v, PURPLE_FLAME, 'pp');
    const a = ctx.globalAlpha; ctx.globalAlpha = a * alpha;
    ctx.drawImage(img, x - h * .25, y - h * (114 / 128), h * .5, h);
    ctx.globalAlpha = a;
  }
  function shadowEll(ctx, x, y, rx, ry, a) { ctx.fillStyle = `rgba(20,14,20,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }

  // ------------------------------------------------------------------ Asura
  const MP = { x: 0, y: 0 };
  function mpos(fx, s, k) {
    const h = 82 * (1 - k) + s[4] * 4 * k * (1 - k);
    MP.x = lerp(fx.x0, s[0], k); MP.y = lerp(fx.y0, s[1], k) - h;
    return MP;
  }
  function missilesG(ctx, fx, time) {
    const t = fx.age;
    for (const s of fx.s) {
      const x = s[0], y = s[1], l = s[2], T = s[3];
      if (t < T) {
        const k = clamp01((t - l) / (T - l)), pulse = .5 + .3 * Math.sin(time * 20 + x * .1), r = MIS_R * (1 - .25 * k);
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,10,10,.4)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,110,60,${pulse})`; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - r * .45, y); ctx.lineTo(x + r * .45, y); ctx.moveTo(x, y - r * .45); ctx.lineTo(x, y + r * .45); ctx.stroke();
        if (t >= l) shadowEll(ctx, lerp(fx.x0, x, k), lerp(fx.y0, y, k), 9, 4, .25);
      } else {
        const a = 1 - win(t, T + 1.0, T + 2.5);
        if (a > .01) {
          crater(ctx, x, y, MIS_R * .7, a * .85, x * .37 + y);
          if (t < T + .6) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, x, y, MIS_R * 1.1, '255,120,40', (1 - (t - T) / .6) * .6, false, .5); ctx.globalCompositeOperation = 'source-over'; }
        }
      }
    }
  }
  function missilesO(ctx, fx, time) {
    const K = Kit(), t = fx.age, smoke = K.puff('smoke'), spr = missileSpr();
    for (const s of fx.s) {
      const x = s[0], y = s[1], l = s[2], T = s[3];
      if (t >= l && t < T) {
        const k = (t - l) / (T - l);
        for (let j = 8; j >= 1; j--) { const kk = k - j * .04; if (kk < 0) continue; const P = mpos(fx, s, kk); K.stamp(ctx, smoke, P.x, P.y, 5 + j * 2.8, .62 * (1 - j / 9), 1); }
        const Q = mpos(fx, s, Math.min(1, k + .02)), qx = Q.x, qy = Q.y, P = mpos(fx, s, k), px = P.x, py = P.y, ang = Math.atan2(qy - py, qx - px);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, px - Math.cos(ang) * 16, py - Math.sin(ang) * 16, 22, '255,160,70', 1, true);
        ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.drawImage(spr, -34, -10, 52, 21); ctx.restore();
      } else if (t >= T && t < T + .8) boom(ctx, x, y, MIS_R * 1.05, (t - T) / .8, x * .13 + y * .07);
    }
  }
  function laserG(ctx, fx, time) {
    const t = fx.age, c = Math.cos(fx.a), s = Math.sin(fx.a), x1 = fx.x + c * fx.len, y1 = fx.y + s * fx.len;
    const fade = 1 - win(t, 1.0, fx.dur);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(36,22,18,${.42 * fade})`; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = `rgba(20,12,10,${.5 * fade})`; ctx.lineWidth = 12; ctx.stroke();
    if (t < 1.4) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,140,60,${(1 - t / 1.4) * .7})`; ctx.lineWidth = 7; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 1; i <= 5; i++) cracks(ctx, fx.x + c * fx.len * i / 5.5, fx.y + s * fx.len * i / 5.5, 46, 5, fx.seed + i * 7, fade * .8, 2);
  }
  function beam(ctx, x0, y0, x1, y1, w, al, time, pal) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${pal[3]},${.45 * al})`; ctx.lineWidth = w * 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${pal[0]},${.35 * al})`; ctx.lineWidth = w * 1.3; ctx.stroke();
    ctx.strokeStyle = `rgba(${pal[1]},${.7 * al})`; ctx.lineWidth = w * .7; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.95 * al})`; ctx.lineWidth = w * .28; ctx.stroke();
    // energy ribbons spiralling along the beam
    const len = Math.hypot(x1 - x0, y1 - y0), c = (x1 - x0) / len, s = (y1 - y0) / len;
    ctx.strokeStyle = `rgba(${pal[2]},${.65 * al})`; ctx.lineWidth = 2;
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      for (let d = 0; d <= len; d += 28) {
        const o = Math.sin(d * .03 - time * 40 + j * Math.PI) * w * .55, px = x0 + c * d - s * o, py = y0 + s * d + c * o;
        if (d) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const CYAN = ['60,150,255', '130,220,255', '210,245,255', '10,30,70'], HOT = ['255,110,40', '255,190,110', '255,240,200', '70,20,10'];
  function laserO(ctx, fx, time) {
    const t = fx.age;
    if (t > .75) return;
    const K = Kit(), L = LIFT(), al = t < .06 ? t / .06 : 1 - win(t, .42, .75);
    const c = Math.cos(fx.a), s = Math.sin(fx.a), x0 = fx.x, y0 = fx.y - L, x1 = x0 + c * fx.len, y1 = y0 + s * fx.len;
    const w = 38 * (.85 + .15 * Math.sin(time * 70)) * (1 - t * .5);
    beam(ctx, x0, y0, x1, y1, w, al, time, CYAN);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x0, y0, 54, '120,210,255', al, true);
    K.glow(ctx, x1, y1 + L * .6, 100, '255,170,90', al * .8, true);
    ctx.globalCompositeOperation = 'source-over';
    const fire = K.puff('fire');
    for (let i = 0; i < 5; i++) K.stamp(ctx, fire, x1 + (hash(i + fx.seed) - .5) * 70, y1 + L * .5 - hash(i * 3 + fx.seed) * 50 - t * 40, 22 + hash(i * 2) * 14, al, 1);
    // chakra rings round the muzzle
    ctx.strokeStyle = `rgba(200,240,255,${al * .8})`; ctx.lineWidth = 2.5;
    for (let i = 0; i < 2; i++) { const ph = frac(time * 4 + i * .5); ctx.beginPath(); ctx.ellipse(x0 + c * 20 * ph, y0 + s * 20 * ph, 10 + ph * 30, 18 + ph * 30, fx.a, 0, TAU); ctx.stroke(); }
  }
  function rocketG(ctx, fx, time) {
    const t = fx.age - fx.t0, tI = fx.len / FIST_SPEED, c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (t >= 0 && t < tI) shadowEll(ctx, fx.x + c * t * FIST_SPEED, fx.y + s * t * FIST_SPEED, 18, 7, .22);
    if (t >= tI) crater(ctx, fx.x + c * fx.len, fx.y + s * fx.len, FIST_BLAST * .7, 1 - win(t - tI, 1, 1.8), fx.seed);
  }
  function cable(ctx, x0, y0, x1, y1) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#18161e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,200,215,.8)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  function rocketO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), t = fx.age - fx.t0, tI = fx.len / FIST_SPEED, c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (t < 0) return;
    const ox = fx.x, oy = fx.y - L;
    if (t < tI) {
      const d = t * FIST_SPEED, px = ox + c * d, py = oy + s * d, smoke = K.puff('smoke'), fire = K.puff('fire');
      cable(ctx, ox, oy, px - c * 20, py - s * 20);
      for (let j = 1; j <= 6; j++) K.stamp(ctx, smoke, px - c * (20 + j * 24), py - s * (20 + j * 24) - j * 2, 6 + j * 2.4, .5 * (1 - j / 7), 1);
      K.stamp(ctx, fire, px - c * 30, py - s * 30, 14 + Math.sin(time * 50) * 3, 1, 1);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, px - c * 30, py - s * 30, 26, '255,170,80', .9, true); ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(px, py); ctx.rotate(fx.a); if (c < 0) ctx.scale(1, -1); ctx.drawImage(fistSpr(), -40, -14, 48, 31); ctx.restore();
    } else {
      const k = (t - tI) / .9, ex = ox + c * fx.len, ey = fx.y + s * fx.len;
      if (k < 1) boom(ctx, ex, ey, FIST_BLAST * .9, k, fx.seed);
      const back = clamp01((t - tI) / .55), d = fx.len * (1 - easeIn(back));
      if (back < 1) {
        const px = ox + c * d, py = oy + s * d;
        cable(ctx, ox, oy, px, py);
        ctx.save(); ctx.translate(px, py); ctx.rotate(fx.a); if (c < 0) ctx.scale(1, -1); ctx.drawImage(fistSpr(), -40, -14, 48, 31); ctx.restore();
      }
    }
  }
  function spinG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.T + .9, fx.dur), x1 = fx.cx, y1 = fx.cy, a = Math.atan2(y1 - fx.y0, x1 - fx.x0), nx = -Math.sin(a), ny = Math.cos(a);
    ctx.lineCap = 'round';
    for (const o of [-30, -10, 10, 30]) {
      ctx.strokeStyle = `rgba(40,26,20,${.36 * fade})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(fx.x0 + nx * o, fx.y0 + ny * o * .5); ctx.lineTo(x1 + nx * o, y1 + ny * o * .5); ctx.stroke();
    }
    if (fx.age >= fx.T) {
      crater(ctx, x1, y1, DRILL_R * .85, fade, fx.seed);
      // spiral gouge left by the drill tail
      ctx.strokeStyle = `rgba(30,20,18,${.6 * fade})`; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const u = i / 40, an = u * 10, r = 8 + u * DRILL_R * .8; const px = x1 + Math.cos(an) * r, py = y1 + Math.sin(an) * r * .5; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    }
  }
  function spinO(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    if (fx.age < fx.T) {
      const x = fx.cx, y = fx.cy - L, rot = time * 28;
      ctx.globalCompositeOperation = 'lighter';
      for (const r of [64, 80]) { ctx.strokeStyle = `rgba(220,235,255,${r === 80 ? .3 : .45})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(x, y + 6, r, r * .52, 0, 0, TAU); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 6; i++) {
        const an = rot + i * TAU / 6, ca = Math.cos(an), sa = Math.sin(an) * .52, bx = x + ca * 74, by = y + 6 + sa * 74;
        ctx.strokeStyle = '#2a2e36'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + ca * 16, y + sa * 16); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = '#a8b0bc'; ctx.lineWidth = 2.6; ctx.stroke();
        const ta = an + Math.PI / 2, tx = Math.cos(ta), ty = Math.sin(ta) * .52;
        ctx.fillStyle = '#eef3f8'; ctx.strokeStyle = '#1a1c22'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(bx - ca * 4, by - sa * 4); ctx.lineTo(bx + tx * 26, by + ty * 26); ctx.lineTo(bx + ca * 6, by + sa * 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,240,200,.95)'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const an = hash(i + Math.floor(time * 30)) * TAU, r = 70 + hash(i * 3 + Math.floor(time * 30)) * 20; ctx.moveTo(x + Math.cos(an) * r, y + 6 + Math.sin(an) * r * .52); ctx.lineTo(x + Math.cos(an + .3) * (r + 18), y + 6 + Math.sin(an + .3) * (r + 18) * .52); }
      ctx.stroke();
      dustRing(ctx, fx.cx, fx.cy, 50, 6, 16, .6, Math.floor(time * 12), 6);
    } else {
      const k = (fx.age - fx.T) / 1.1;
      if (k < 1) {
        dustRing(ctx, fx.cx, fx.cy, DRILL_R * (.6 + easeOut(k) * .7), 12, 26, 1 - k, fx.seed, 10 + k * 20);
        ctx.fillStyle = '#5a4a3e';
        for (let i = 0; i < 10; i++) { const an = hash(i + fx.seed) * TAU, d = easeOut(k) * (60 + hash(i * 2) * 80), h = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (40 + hash(i * 3) * 50); ctx.fillRect(fx.cx + Math.cos(an) * d - 4, fx.cy + Math.sin(an) * d * .5 - h - 4, 8, 7); }
      }
    }
  }
  function stormG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.T + .6, fx.dur), K = Kit(), ember = K.puff('ember');
    ctx.lineCap = 'round';
    const list = fx.age < fx.T ? fx.trail.concat([fx.cur]) : fx.trail;
    for (const ang of list) {
      const ex = fx.ox + Math.cos(ang) * STORM_LEN, ey = fx.oy + Math.sin(ang) * STORM_LEN;
      ctx.strokeStyle = `rgba(34,18,14,${.3 * fade})`; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(fx.ox + Math.cos(ang) * 40, fx.oy + Math.sin(ang) * 40); ctx.lineTo(ex, ey); ctx.stroke();
      K.stamp(ctx, ember, ex, ey - 8, 22 + Math.sin(time * 9 + ang * 7) * 4, fade * .8, .8);
    }
  }
  function stormO(ctx, fx, time, z) {
    if (fx.age >= fx.T + .15) return;
    const K = Kit(), al = fx.age < .1 ? fx.age / .1 : 1 - win(fx.age, fx.T - .05, fx.T + .15);
    const ox = z ? z.x : fx.ox, oy = z ? z.y : fx.oy, hy = oy - HEIGHT('pain_asura') * .8;
    const ang = fx.cur, c = Math.cos(ang), s = Math.sin(ang), ex = ox + c * STORM_LEN, ey = oy + s * STORM_LEN;
    beam(ctx, ox + c * 8, hy, ex, ey - 6, 34 * (.88 + .12 * Math.sin(time * 60)), al, time, HOT);
    // the face plate split open round the barrel
    ctx.strokeStyle = '#2a2e36'; ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + .3; ctx.beginPath(); ctx.moveTo(ox + Math.cos(an) * 8, hy + Math.sin(an) * 8); ctx.lineTo(ox + Math.cos(an) * 20, hy + Math.sin(an) * 20); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, ox, hy, 46, '255,170,90', al, true);
    K.glow(ctx, ex, ey - 10, 110, '255,140,60', al * .85, true);
    ctx.globalCompositeOperation = 'source-over';
    const fire = K.puff('fire');
    for (let i = 0; i < 5; i++) K.stamp(ctx, fire, ex + (hash(i + Math.floor(time * 20)) - .5) * 90, ey - 10 - hash(i * 7 + Math.floor(time * 20)) * 50, 22 + hash(i) * 14, al, 1);
  }

  // ------------------------------------------------------------------ Human
  function strand(ctx, x0, y0, x1, y1, time, al, cols, seed) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.lineCap = 'round';
    for (let j = 0; j < 4; j++) {
      ctx.globalCompositeOperation = j ? 'lighter' : 'source-over';
      ctx.strokeStyle = j ? `rgba(${cols[Math.min(2, j - 1)]},${al * (j === 3 ? .95 : .55)})` : `rgba(${cols[3]},${al * .4})`;
      ctx.lineWidth = [9, 6, 3, 1.4][j];
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const u = i / 18, w = Math.sin(u * 9 + time * 12 + j * 1.3 + seed) * 10 * Math.sin(Math.PI * u);
        const x = x0 + dx * u + nx * w, y = y0 + dy * u + ny * w;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const SOULC = ['80,170,255', '170,230,255', '245,255,255', '16,40,90'];
  function soulO(ctx, fx, time, z) {
    if (!z) return;
    const K = Kit(), L = LIFT(), t = fx.age, f = facing(z), hx = z.x + f * 16, hy = z.y - L - 10, px = fx.px, py = fx.py - L;
    if (fx.live) {
      const k = clamp01(t / fx.T);
      strand(ctx, px, py, hx, hy, time, 1, SOULC, 0);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) { const u = frac(time * 1.3 + i / 10); K.glow(ctx, lerp(px, hx, u), lerp(py, hy, u) - Math.sin(u * Math.PI) * 10, 7, '190,240,255', .9 * bell(u)); }
      K.glow(ctx, px, py, 34 + 10 * Math.sin(time * 9), '150,220,255', .6);
      K.glow(ctx, hx, hy, 22, '200,245,255', .8, true);
      ctx.globalCompositeOperation = 'source-over';
      // the soul itself, half dragged out of the body toward his hand
      const pull = .18 + .32 * easeIn(k) + .03 * Math.sin(time * 8), sx = lerp(px, hx, pull), sy = lerp(py, hy, pull) - 6;
      ctx.save(); ctx.globalAlpha = .55 + .3 * k; ctx.translate(sx, sy); ctx.rotate(Math.atan2(hy - py, hx - px) - Math.PI / 2 + Math.PI);
      ctx.drawImage(soulSpr(), -28, -34, 56, 100); ctx.restore();
    } else if (fx.rip > 0 && t - fx.rip < .9) {
      const k = (t - fx.rip) / .9;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, px, py, 70 * (1 - k * .5), '200,240,255', 1 - k, true);
      for (let i = 0; i < 9; i++) {
        const u = easeOut(clamp01(k * 1.3 - i * .03)), o = (hash(i + fx.seed) - .5) * 80 * Math.sin(Math.PI * u);
        K.glow(ctx, lerp(px, hx, u) + o, lerp(py, hy, u) - o * .4, 10, '190,240,255', (1 - k));
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function graspO(ctx, fx, time) {
    const k = fx.age / fx.dur, L = LIFT();
    ctx.save(); ctx.globalAlpha = (1 - k) * .9; ctx.translate(fx.x, fx.y - L); ctx.rotate(fx.a + Math.PI / 2); ctx.scale(1 - k * .4, 1 - k * .4);
    ctx.drawImage(handSpr(), -28, -44, 56, 88); ctx.restore();
  }
  function hrodsO(ctx, fx, time) {
    const L = LIFT();
    ctx.lineCap = 'round';
    for (const [a, t0] of fx.list) {
      const d = (fx.age - t0) * ROD_SPEED;
      if (d <= 0 || d >= ROD_LEN) continue;
      const c = Math.cos(a), s = Math.sin(a), x = fx.x + c * d, y = fx.y + s * d - L * (1 - d / ROD_LEN * .7);
      ctx.strokeStyle = 'rgba(30,16,50,.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - c * 90, y - s * 90); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = 'rgba(210,195,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
      rod(ctx, x - c * 26, y - s * 26, a, 50, 3.6);
    }
  }
  function hrodsG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const [a, t0] of fx.list) {
      const d = (fx.age - t0) * ROD_SPEED;
      if (d < 0) continue;
      const c = Math.cos(a), s = Math.sin(a);
      if (d < ROD_LEN) { shadowEll(ctx, fx.x + c * d, fx.y + s * d, 14, 4, .2); continue; }
      const x = fx.x + c * ROD_LEN, y = fx.y + s * ROD_LEN, since = d / ROD_SPEED - ROD_LEN / ROD_SPEED;
      shadowEll(ctx, x + 6, y + 2, 10, 4, .3 * fade);
      cracks(ctx, x, y, 22, 4, a * 10, fade * .7, 1.6);
      rod(ctx, x, y, -Math.PI / 2 + c * .45, 40, 3.4, fade);
      if (since < .5) { ctx.strokeStyle = `rgba(200,180,255,${(1 - since / .5) * .8})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 10 + since * 60, 5 + since * 30, 0, 0, TAU); ctx.stroke(); }
    }
  }
  function rinneSigil(ctx, x, y, r, al, time, rgbDark, rgbLight) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
    for (let i = 0; i < 5; i++) {
      const rr = r * (1 - i * .19) * (1 + .03 * Math.sin(time * 6 + i));
      ctx.lineWidth = 5; ctx.strokeStyle = `rgba(${rgbDark},${al * .5})`; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${rgbLight},${al * .85})`; ctx.stroke();
    }
    ctx.fillStyle = `rgba(${rgbDark},${al * .6})`; ctx.beginPath(); ctx.arc(0, 0, r * .12, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function readG(ctx, fx, time) {
    const t = fx.age, T = fx.T, x = fx.x, y = fx.y;
    if (t < T) {
      const k = t / T;
      markCircle(ctx, x, y, READ_R, '190,170,255', k, time, false, false);
      rinneSigil(ctx, x, y, READ_R * (1.3 - .3 * k), .9, time, '60,30,120', '225,210,255');
    } else {
      const k = (t - T) / (fx.dur - T), e = easeOut(k * 2.4);
      crater(ctx, x, y, READ_R * .75, 1 - k, fx.seed);
      ctx.strokeStyle = `rgba(230,220,255,${(1 - e) * .9})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y, READ_R * (.4 + e), READ_R * (.2 + e * .5), 0, 0, TAU); ctx.stroke();
    }
  }
  function readO(ctx, fx, time) {
    const S = Spr(), t = fx.age, K = Kit(), L = LIFT();
    if (S && t < .45) {
      const face = fx.nx >= fx.ox ? 1 : -1;
      for (let i = 0; i < 4; i++) { const u = i / 4; S.draw(ctx, 'pain_human', lerp(fx.ox, fx.nx, u), lerp(fx.oy, fx.ny, u), { frame: 'run2', facing: face, alpha: (1 - t / .45) * (.12 + .3 * u) }); }
    }
    if (t >= fx.T - .1 && t < fx.T + .5) {
      const k = (t - fx.T + .1) / .6;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - L, 90 * (1 - k * .4), '200,180,255', 1 - k, true);
      ctx.globalCompositeOperation = 'source-over';
      dustRing(ctx, fx.x, fx.y, READ_R * (.6 + k * .6), 10, 22, 1 - k, fx.seed);
    }
  }
  function hfieldG(ctx, fx, time) {
    const t = fx.age, k = easeOut(t / .4), fade = 1 - win(t, fx.T + .3, fx.dur), x = fx.x, y = fx.y, Rr = fx.R;
    ctx.fillStyle = `rgba(14,30,48,${.38 * fade})`; ctx.beginPath(); ctx.arc(x, y, Rr * k, 0, TAU); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = `rgba(20,40,70,${.55 * fade})`; ctx.beginPath(); ctx.arc(x, y, Rr * k, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(160,230,255,${.8 * fade})`; ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * .4);
    ctx.setLineDash([18, 14]); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(190,240,255,${.6 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, Rr * .72 * k, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = Rr * .86 * k; ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a + .06) * (r + 16), Math.sin(a + .06) * (r + 16)); ctx.lineTo(Math.cos(a + .12) * r, Math.sin(a + .12) * r); }
    ctx.stroke();
    ctx.restore();
    if (t > fx.T) {
      const e = easeOut((t - fx.T) / .7);
      ctx.strokeStyle = `rgba(230,250,255,${(1 - e) * .9})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, Rr * (.2 + e * .9), 0, TAU); ctx.stroke();
      crater(ctx, x, y, 140, fade, fx.seed);
    }
  }
  function hfieldO(ctx, fx, time, z) {
    const K = Kit(), t = fx.age, hand = handSpr(), soul = soulSpr();
    fx.hands.forEach(([hx, hy], i) => {
      const rise = easeOut(win(t, i * .05, i * .05 + .4)) * (1 - win(t, fx.T, fx.T + .35));
      if (rise <= .01) return;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.sin(time * 3 + i) * .18); ctx.globalAlpha = .85;
      ctx.drawImage(hand, -20, -84 * rise * 1.1, 40, 84 * rise * 1.1); ctx.restore();
      // souls torn up out of the ground, streaming to the Human Path
      if (z && t < fx.T) {
        const u = frac(time * .8 + i * .37), L = LIFT(), tx = z.x, ty = z.y - L - 10;
        const sx = lerp(hx, tx, easeIn(u)), sy = lerp(hy - 50, ty, easeIn(u)) - Math.sin(u * Math.PI) * 60;
        ctx.globalAlpha = .7 * bell(u); ctx.drawImage(soul, sx - 12, sy - 15, 24, 43); ctx.globalAlpha = 1;
      }
    });
    ctx.globalCompositeOperation = 'lighter';
    if (t < fx.T) for (let i = 0; i < 12; i++) { const a = hash(i * 3.3 + fx.seed) * TAU, r = fx.R * Math.sqrt(hash(i * 1.7)), ph = frac(time * .9 + i / 12); K.glow(ctx, fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r - ph * 120, 9, '170,235,255', bell(ph) * .9); }
    if (t > fx.T && t < fx.T + .8) K.glow(ctx, fx.x, fx.y - 30, fx.R * (1 - (t - fx.T)), '200,245,255', 1 - (t - fx.T) / .8, true, .6);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ Animal
  function dogG(ctx, fx, time) {
    const t = fx.age, c = Math.cos(fx.a), s = Math.sin(fx.a), ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len, K = Kit(), dust = K.puff('dust');
    ctx.drawImage(summonSpr(), fx.x0 - 60, fx.y0 - 30, 120, 60);
    if (t >= fx.t0) {
      const d = Math.min(fx.len, (t - fx.t0) * DOG_SPEED);
      for (let dd = Math.max(0, d - 260); dd < d; dd += 40) K.stamp(ctx, dust, fx.x0 + c * dd, fx.y0 + s * dd - 6, 14 + (d - dd) * .05, (1 - (d - dd) / 260) * .6, .7);
      if (t < fx.tEnd) shadowEll(ctx, fx.x0 + c * d, fx.y0 + s * d, 70, 16, .28);
    }
    if (t >= fx.tEnd) crater(ctx, ex, ey, 90, 1 - win(t, fx.tEnd + 1, fx.dur), fx.seed);
    if (t >= fx.tEnd - .1 && t < fx.tS) {
      const k = clamp01((t - fx.tEnd + .1) / .6);
      for (const a2 of fx.splits) markLine(ctx, { x: ex, y: ey, a: a2, len: DOG_SPLIT, w: 60 }, '255,200,140', k, time);
    }
    if (t >= fx.tS) for (const a2 of fx.splits) {
      const d = Math.min(DOG_SPLIT, (t - fx.tS) * 900);
      if (d < DOG_SPLIT) shadowEll(ctx, ex + Math.cos(a2) * d, ey + Math.sin(a2) * d, 48, 12, .25);
      else crater(ctx, ex + Math.cos(a2) * DOG_SPLIT, ey + Math.sin(a2) * DOG_SPLIT, 60, 1 - win(t, fx.dur - .8, fx.dur), fx.seed + a2);
    }
  }
  function dogO(ctx, fx, time) {
    const t = fx.age, c = Math.cos(fx.a), s = Math.sin(fx.a), flip = c < 0, ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
    if (t < .55) poofDraw(ctx, fx.x0, fx.y0, 100, t / .55, fx.seed);
    if (t >= fx.t0 && t < fx.tEnd + .3) {
      const d = Math.min(fx.len, (t - fx.t0) * DOG_SPEED), fr = Math.floor(time * 12) % 2, bob = Math.abs(Math.sin(time * 18)) * 6;
      beast(ctx, dogSpr(fr), fx.x0 + c * d, fx.y0 + s * d - bob, 1.05, flip, 122, t > fx.tEnd ? 1 - (t - fx.tEnd) / .3 : 1);
    }
    if (t >= fx.tEnd && t < fx.tEnd + .8) poofDraw(ctx, ex, ey, 140, (t - fx.tEnd) / .8, fx.seed + 3);
    if (t >= fx.tS) fx.splits.forEach((a2, i) => {
      const u = t - fx.tS, d = Math.min(DOG_SPLIT, u * 900);
      if (u > DOG_SPLIT / 900 + .35) return;
      const fr = Math.floor(time * 13 + i) % 2;
      beast(ctx, dogSpr(fr), ex + Math.cos(a2) * d, ey + Math.sin(a2) * d - Math.abs(Math.sin(time * 18 + i)) * 4, .66, Math.cos(a2) < 0, 122, u > DOG_SPLIT / 900 ? 1 - (u - DOG_SPLIT / 900) / .35 : 1);
    });
  }
  function rhinoG(ctx, fx, time) {
    const K = Kit(), dust = K.puff('dust');
    for (const [la, lx, ly, t0] of fx.lanes) {
      const t = fx.age - t0, c = Math.cos(la), s = Math.sin(la);
      if (t < -.3) continue;
      ctx.drawImage(summonSpr(), lx - 55, ly - 28, 110, 56);
      if (t < 0) continue;
      const d = Math.min(RHINO_LEN, t * RHINO_SPEED), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
      ctx.strokeStyle = `rgba(50,36,28,${.3 * fade})`; ctx.lineWidth = 34; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + c * d, ly + s * d); ctx.stroke();
      for (let dd = Math.max(0, d - 300); dd < d; dd += 45) K.stamp(ctx, dust, lx + c * dd, ly + s * dd - 8, 18 + (d - dd) * .05, (1 - (d - dd) / 300) * .7, .7);
      if (d < RHINO_LEN) shadowEll(ctx, lx + c * d, ly + s * d, 80, 18, .3);
      else crater(ctx, lx + c * (RHINO_LEN + 40), ly + s * (RHINO_LEN + 40), 120, fade, la * 9);
    }
  }
  function rhinoO(ctx, fx, time) {
    for (const [la, lx, ly, t0] of fx.lanes) {
      const t = fx.age - t0, c = Math.cos(la), s = Math.sin(la);
      if (t > -.3 && t < .3) poofDraw(ctx, lx, ly, 100, (t + .3) / .6, la * 5);
      if (t < 0) continue;
      const d = t * RHINO_SPEED;
      if (d < RHINO_LEN + 40) beast(ctx, rhinoSpr(Math.floor(time * 14) % 2), lx + c * d, ly + s * d - Math.abs(Math.sin(time * 16)) * 4, 1.05, c < 0, 122);
      else if (d < RHINO_LEN + 40 + .6 * RHINO_SPEED) {
        const k = (d - RHINO_LEN - 40) / (.6 * RHINO_SPEED);
        dustRing(ctx, lx + c * (RHINO_LEN + 40), ly + s * (RHINO_LEN + 40), 90 + k * 80, 12, 30, 1 - k, la * 3, 12 + k * 20);
        poofDraw(ctx, lx + c * (RHINO_LEN + 40), ly + s * (RHINO_LEN + 40), 110, k, la * 7);
      }
    }
  }
  function birdPos(fx) { const d = (fx.age - .2) * BIRD_SPEED; return d; }
  function birdG(ctx, fx, time) {
    const d = birdPos(fx), c = Math.cos(fx.a), s = Math.sin(fx.a), K = Kit(), dust = K.puff('dust');
    if (d < -200 || d > BIRD_LEN + 300) return;
    const gx = fx.x + c * d, gy = fx.y + s * d;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(fx.a); ctx.scale(1, .55);
    ctx.globalAlpha = .26; ctx.drawImage(birdSpr(Math.floor(time * 7) % 2), -190, -130, 380, 260);
    ctx.restore(); ctx.globalAlpha = 1;
    for (let dd = Math.max(0, d - 380); dd < Math.min(d, BIRD_LEN); dd += 55) {
      const k = (d - dd) / 380;
      for (const o of [-1, 1]) K.stamp(ctx, dust, fx.x + c * dd - s * o * BIRD_W * (.6 + k * .8), fx.y + s * dd + c * o * BIRD_W * (.6 + k * .8) - 6, 16 + k * 18, (1 - k) * .55, .7);
    }
  }
  function birdO(ctx, fx, time) {
    const d = birdPos(fx), c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (d < -260 || d > BIRD_LEN + 300) return;
    const gx = fx.x + c * d, gy = fx.y + s * d, h = 200 - Math.sin(clamp01(d / BIRD_LEN) * Math.PI) * 70, bx = gx, by = gy - h;
    // wind streaks trailing the wings
    ctx.lineCap = 'round'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 8; i++) {
      const o = (i - 3.5) * 26, len = 90 + hash(i + fx.seed) * 120, ph = frac(time * 3 + hash(i));
      const sx = bx - c * (60 + ph * 140) - s * o, sy = by - s * (60 + ph * 140) + c * o * .6;
      ctx.strokeStyle = `rgba(255,255,255,${.55 * (1 - ph)})`; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - c * len, sy - s * len); ctx.stroke();
    }
    ctx.save(); ctx.translate(bx, by); ctx.rotate(fx.a); ctx.drawImage(birdSpr(Math.floor(time * 7) % 2), -190, -130, 380, 260); ctx.restore();
    ctx.fillStyle = '#6e5644';
    for (let i = 0; i < 6; i++) { const ph = frac(time * .8 + i / 6), fx2 = bx - c * (40 + ph * 220) + Math.sin(time * 4 + i) * 30, fy = by - s * (40 + ph * 220) + ph * h * .8; ctx.save(); ctx.translate(fx2, fy); ctx.rotate(time * 3 + i); ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.4, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  function vanishO(ctx, fx, time) {
    const k = fx.age / fx.dur, L = LIFT();
    ctx.save(); ctx.globalAlpha = (1 - k) * .8; ctx.translate(fx.x, fx.y);
    // heat-shimmer ripples and the chameleon's faint outline melting into the air
    ctx.strokeStyle = 'rgba(170,240,200,.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const ph = frac(k * 2 + i / 4); ctx.beginPath(); ctx.ellipse(0, -L, 20 + ph * 60, 40 + ph * 50, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = (1 - k) * .35; ctx.drawImage(chamSpr(), -120, -120, 240, 134);
    ctx.restore();
  }
  function chamG(ctx, fx, time) {
    if (fx.age < fx.T) markLine(ctx, { x: fx.x, y: fx.y, a: fx.a, len: TONGUE_LEN, w: 34 }, '170,240,190', fx.age / fx.T, time);
  }
  function chamO(ctx, fx, time) {
    const t = fx.age, c = Math.cos(fx.a), s = Math.sin(fx.a), flip = c < 0, al = Math.min(1, t * 4) * (1 - win(t, fx.dur - .5, fx.dur));
    const cx = fx.x - c * 40, cy = fx.y - s * 20 + 10;
    beast(ctx, chamSpr(), cx, cy, 1.05, flip, 120, al * .95);
    // the tongue lashing out of its mouth along the line, then reeling back
    const mx = cx + (flip ? -1 : 1) * 105, my = cy - 60;
    const out = t < fx.T ? 0 : t < fx.T + .14 ? (t - fx.T) / .14 : 1 - clamp01((t - fx.T - .3) / .3);
    if (out > 0) {
      const ex = fx.x + c * TONGUE_LEN * out, ey = fx.y + s * TONGUE_LEN * out - LIFT();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3a0a18'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo((mx + ex) / 2, (my + ey) / 2 - 30, ex, ey); ctx.stroke();
      ctx.strokeStyle = '#e0607a'; ctx.lineWidth = 8; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,230,.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#e0607a'; ctx.strokeStyle = '#3a0a18'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(ex, ey, 11, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
  function stampedeG(ctx, fx, time) {
    const K = Kit(), dust = K.puff('dust'), c = Math.cos(fx.a), s = Math.sin(fx.a), fade = 1 - win(fx.age, fx.dur - 1, fx.dur);
    const k = easeOut(fx.age / .4);
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(fx.x, fx.y); ctx.rotate(fx.age * .3);
    ctx.drawImage(summonSpr(), -150 * k, -150 * k, 300 * k, 300 * k); ctx.restore(); ctx.globalAlpha = 1;
    for (const [lx, ly, t0] of fx.lanes) {
      const t = fx.age - t0;
      if (t < 0) continue;
      const d = Math.min(ST_LEN, t * ST_SPEED);
      ctx.strokeStyle = `rgba(50,36,28,${.26 * fade})`; ctx.lineWidth = 40; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + c * d, ly + s * d); ctx.stroke();
      for (let dd = Math.max(0, d - 280); dd < d; dd += 50) K.stamp(ctx, dust, lx + c * dd, ly + s * dd - 8, 18 + (d - dd) * .05, (1 - (d - dd) / 280) * .7, .7);
      if (d < ST_LEN) shadowEll(ctx, lx + c * d, ly + s * d, 76, 17, .28);
    }
    if (fx.age > fx.tEnd) crater(ctx, fx.ex, fx.ey, 220, fade, fx.seed);
  }
  function stampedeO(ctx, fx, time) {
    const c = Math.cos(fx.a), s = Math.sin(fx.a), flip = c < 0;
    fx.lanes.forEach(([lx, ly, t0, kind], i) => {
      const t = fx.age - t0;
      if (t > -.4 && t < .3) poofDraw(ctx, lx, ly, 95, (t + .4) / .7, i * 3.1 + fx.seed);
      if (t < 0) return;
      for (let k = 2; k >= 0; k--) {
        const d = t * ST_SPEED - k * ST_PACK;
        if (d < 0 || d > ST_LEN + 40) continue;
        const fr = Math.floor(time * 13 + i + k) % 2, bob = Math.abs(Math.sin(time * 17 + i + k * 1.3)) * 5;
        if ((kind + k) % 2) beast(ctx, dogSpr(fr), lx + c * d, ly + s * d - bob, k ? .8 : .95, flip, 122);
        else beast(ctx, rhinoSpr(fr), lx + c * d, ly + s * d - bob, k ? .85 : 1, flip, 122);
      }
    });
    const k = (fx.age - fx.tEnd) / 1.2;
    if (k > 0 && k < 1) { dustRing(ctx, fx.ex, fx.ey, 160 + k * 140, 16, 36, 1 - k, fx.seed, 14 + k * 30); poofDraw(ctx, fx.ex, fx.ey, 200, k, fx.seed); }
  }
  function poofO(ctx, fx, time) { poofDraw(ctx, fx.x, fx.y, fx.r, (fx.age - (fx.t0 || 0) + .2) / .9, fx.seed); }

  // ------------------------------------------------------------------ Preta
  function pdashG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.strokeStyle = `rgba(40,26,40,${.3 * fade})`; ctx.lineWidth = 28; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.cx, fx.cy); ctx.stroke();
  }
  function pdashO(ctx, fx, time) {
    if (fx.age >= fx.T + .2) return;
    const S = Spr(), k = clamp01(fx.age / fx.T), face = Math.cos(fx.a) >= 0 ? 1 : -1;
    if (S) for (let i = 1; i <= 3; i++) { const u = Math.max(0, k - i * .12); S.draw(ctx, 'pain_preta', lerp(fx.x0, fx.cx, u / Math.max(k, .01)), lerp(fx.y0, fx.cy, u / Math.max(k, .01)), { frame: 'attack', facing: face, alpha: .22 * (1 - i / 4) * (1 - win(fx.age, fx.T, fx.T + .2)) }); }
  }
  function drainO(ctx, fx, time, z) {
    if (!z || !fx.live) return;
    const K = Kit(), L = LIFT(), f = facing(z), hx = z.x + f * 18, hy = z.y - L - 4, px = fx.px, py = fx.py - L;
    strand(ctx, px, py, hx, hy, time, .9, ['120,180,255', '170,220,255', '235,250,255', '20,30,70'], 2);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { const u = frac(time * 1.8 + i / 14), o = Math.sin(i * 2.3 + time * 5) * 14 * bell(u); K.glow(ctx, lerp(px, hx, u) + o, lerp(py, hy, u) - o * .5, 8, '140,200,255', bell(u)); }
    K.glow(ctx, px, py, 40, '120,180,255', .6);
    K.glow(ctx, z.x, z.y - 46, 60 + 8 * Math.sin(time * 10), '170,140,255', .5);
    ctx.globalCompositeOperation = 'source-over';
  }
  function absorbG(ctx, fx, time, z) {
    if (!z) return;
    const k = easeOut(fx.age / .3), fade = 1 - win(fx.age, fx.dur - .3, fx.dur);
    ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(time * .8); ctx.scale(1, .5); ctx.globalAlpha = .8 * fade;
    ctx.drawImage(sealSpr(), -110 * k, -110 * k, 220 * k, 220 * k); ctx.restore(); ctx.globalAlpha = 1;
  }
  function absorbO(ctx, fx, time, z) {
    if (!z) return;
    const K = Kit(), st = z.pp, k = easeOut(fx.age / .3), fade = 1 - win(fx.age, fx.dur - .3, fx.dur), hit = st && st.absorb > 0 ? st.absorb / .35 : 0;
    const cx = z.x, cy = z.y - 44, rx = 64 * k, ry = 78 * k;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, 90 * k, '170,130,255', (.35 + hit * .4) * fade);
    ctx.strokeStyle = `rgba(200,175,255,${(.55 + hit * .4) * fade})`; ctx.lineWidth = 3 + hit * 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.4 * fade})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(cx - rx * .25, cy - ry * .35, rx * .45, ry * .3, -.5, Math.PI, Math.PI * 1.6); ctx.stroke();
    // chakra swirling into his open palms
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + time * 2, ph = frac(time * 1.5 + i / 12), r = (1 - ph) * 110 + 10; K.glow(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .7, 6, '200,180,255', bell(ph) * fade); }
    if (hit > 0) for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(230,220,255,${hit * .7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, rx * (1 + i * .15 * (1 - hit)), ry * (1 + i * .15 * (1 - hit)), 0, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function releaseG(ctx, fx, time) {
    const k = fx.age / fx.dur, e = easeOut(k * 2);
    cracks(ctx, fx.x, fx.y, fx.r * e, 14, fx.seed, 1 - k, 2.6);
    ctx.strokeStyle = `rgba(210,190,255,${(1 - e) * .9})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * e, fx.r * e * .5, 0, 0, TAU); ctx.stroke();
  }
  function releaseO(ctx, fx, time) {
    const k = fx.age / fx.dur, K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y - 40, 160 * easeOut(k * 2), '180,140,255', 1 - k, true);
    ctx.globalCompositeOperation = 'source-over';
    dustRing(ctx, fx.x, fx.y, fx.r * easeOut(k * 1.5), 16, 30, 1 - k, fx.seed, 12);
  }
  function vortexG(ctx, fx, time) {
    const t = fx.age, x = fx.x, y = fx.y, k = easeOut(t / .3), fade = t < fx.T ? 1 : 1 - win(t, fx.T, fx.dur);
    if (t < fx.T) {
      ctx.lineCap = 'round';
      for (let j = 0; j < 6; j++) {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const u = i / 24, r = VORTEX_R * k * (1 - u * .9), an = j * TAU / 6 + u * 4.2 + time * 3.2;
          const px = x + Math.cos(an) * r, py = y + Math.sin(an) * r;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.strokeStyle = 'rgba(40,20,60,.35)'; ctx.lineWidth = 7; ctx.stroke();
        ctx.strokeStyle = 'rgba(200,175,255,.7)'; ctx.lineWidth = 2.4; ctx.stroke();
      }
    } else {
      crater(ctx, x, y, SLAM_R, fade, fx.seed);
      const e = easeOut((t - fx.T) / .6);
      ctx.strokeStyle = `rgba(220,200,255,${(1 - e) * .9})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, y, SLAM_R * (.4 + e), SLAM_R * (.2 + e * .5), 0, 0, TAU); ctx.stroke();
    }
  }
  function vortexO(ctx, fx, time) {
    const K = Kit(), t = fx.age, dust = K.puff('dust');
    if (t < fx.T) {
      for (let i = 0; i < 18; i++) {
        const ph = frac(time * .7 + i / 18), an = hash(i * 2.7) * TAU + ph * 5, r = VORTEX_R * (1 - ph) * .95;
        K.stamp(ctx, dust, fx.x + Math.cos(an) * r, fx.y + Math.sin(an) * r * .55 - 14 - ph * 20, 12 + (1 - ph) * 10, bell(ph) * .8, .8);
      }
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 40, 80, '170,130,255', .5 + .2 * Math.sin(time * 12)); ctx.globalCompositeOperation = 'source-over';
    } else if (t < fx.T + .9) {
      const k = (t - fx.T) / .9;
      dustRing(ctx, fx.x, fx.y, SLAM_R * (.7 + k * .8), 14, 30, 1 - k, fx.seed, 10 + k * 26);
    }
  }
  const SPH = () => Kit().sphere('pp:orb', [[0, 'rgba(255,255,255,.95)'], [.25, 'rgba(220,190,255,.95)'], [.6, 'rgba(140,80,230,.85)'], [.9, 'rgba(60,20,120,.7)'], [1, 'rgba(40,10,90,0)']]);
  function orbsO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), d = fx.age * ORB_SPEED, orb = SPH();
    for (const [a, pop, pd] of fx.list) {
      const c = Math.cos(a), s = Math.sin(a);
      if (pop < 0) {
        const x = fx.x + c * d, y = fx.y + s * d - L;
        ctx.strokeStyle = 'rgba(60,30,110,.35)'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - c * 60, y - s * 60); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(190,160,255,.5)'; ctx.lineWidth = 8; ctx.stroke();
        K.glow(ctx, x, y, 34, '170,130,255', .8);
        ctx.globalCompositeOperation = 'source-over';
        K.spin(ctx, orb, x, y, 16, time * 6, 1);
        ctx.fillStyle = 'rgba(30,10,60,.8)'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
      } else {
        const k = (fx.age - pop) / .6;
        if (k >= 1) continue;
        const x = fx.x + c * pd, y = fx.y + s * pd;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - 20, 90 * easeOut(k), '190,150,255', 1 - k, true); ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(220,200,255,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 85 * easeOut(k), 42 * easeOut(k), 0, 0, TAU); ctx.stroke();
      }
    }
  }
  function pfieldG(ctx, fx, time) {
    const t = fx.age, k = easeOut(t / .5), fade = t < fx.T ? 1 : 1 - win(t, fx.T, fx.dur), x = fx.x, y = fx.y;
    ctx.fillStyle = `rgba(30,12,60,${.22 * fade})`; ctx.beginPath(); ctx.arc(x, y, PF_R * k, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * .25); ctx.globalAlpha = .75 * fade;
    ctx.drawImage(sealSpr(), -PF_R * k * 1.024, -PF_R * k * 1.024, PF_R * k * 2.048, PF_R * k * 2.048);
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.lineWidth = 5; ctx.strokeStyle = `rgba(30,12,60,${.45 * fade})`; ctx.beginPath(); ctx.arc(x, y, PF_R * k, 0, TAU); ctx.stroke();
    if (t > fx.T) { const e = easeOut((t - fx.T) / .6); ctx.strokeStyle = `rgba(230,215,255,${(1 - e)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y, PF_R * (1 - e * .8), 0, TAU); ctx.stroke(); }
  }
  function pfieldO(ctx, fx, time, z) {
    const K = Kit(), t = fx.age, x = fx.x, y = fx.y, fade = t < fx.T ? Math.min(1, t * 3) : 1 - win(t, fx.T, fx.T + .6);
    if (fade <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    // the dome's shell (a half-ellipse rising out of the field's rim)
    ctx.strokeStyle = `rgba(170,130,255,${.35 * fade})`; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(x, y, PF_R, PF_R * .62, 0, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(230,215,255,${.55 * fade})`; ctx.lineWidth = 2.4; ctx.stroke();
    for (let i = 1; i <= 3; i++) { ctx.strokeStyle = `rgba(200,170,255,${.22 * fade})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, PF_R * (1 - i * .22), PF_R * .62 * (1 - i * .1), 0, Math.PI, TAU); ctx.stroke(); }
    // chakra drawn in from the rim toward Preta
    for (let i = 0; i < 20; i++) {
      const a = hash(i * 1.9 + fx.seed) * TAU, ph = frac(time * 1.1 + i / 20), r = PF_R * (1 - ph);
      K.glow(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r - 30 * ph, 9, '190,160,255', bell(ph));
    }
    K.glow(ctx, x, y - 46, 90 + 14 * Math.sin(time * 8), '170,130,255', .55 * fade);
    // allies under its shield glow too
    if (z) for (const o of team(z)) if (o.health > 0 && o.pp && o.pp.shield > 0) K.glow(ctx, o.x, o.y - 40, 60, '170,130,255', .45);
    if (t > fx.T && t < fx.T + .8) K.glow(ctx, x, y - 20, PF_R * (1 - (t - fx.T)), '220,200,255', 1 - (t - fx.T) / .8, true, .6);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ Naraka
  // The King of Hell rising out of the ground; mode t (tongue), h/r (heal/revive), j (judge).
  function kingG(ctx, fx, time) {
    const k = easeOut(fx.age / .3), fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.fillStyle = `rgba(20,6,30,${.5 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 110 * k, 40 * k, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, 170 * k, 12, fx.seed, fade, 2.4);
    ctx.globalCompositeOperation = 'lighter';
    Kit().glow(ctx, fx.x, fx.y, 150 * k, '150,60,255', .45 * fade, false, .4);
    ctx.globalCompositeOperation = 'source-over';
  }
  function kingO(ctx, fx, time) {
    const t = fx.age, rise = easeOut(t / .32) * (1 - easeIn(win(t, fx.dur - .6, fx.dur))), S = fx.mode === 'j' ? 1.15 : .82;
    if (rise <= .01) return;
    const open = fx.mode === 't' ? (t > .18 && t < 1.0) : fx.mode === 'j' ? (t > .2 && t < .9) : (t > .3 && t < 1.2);
    const img = kingSpr(open), w = 260 * S, h = 300 * S, x = fx.x, y = fx.y;
    // purple flames of hell licking up round it
    for (let i = 0; i < 9; i++) { const o = (i - 4) * 26 * S, fh = (70 + hash(i + fx.seed) * 60) * S * rise; purpleFlame(ctx, x + o, y + 6 - Math.abs(i - 4) * 3, fh * (.85 + .15 * Math.sin(time * 9 + i)), (i + Math.floor(time * 12)) % 6, .9); }
    ctx.save(); ctx.beginPath(); ctx.rect(x - w, y - h * 1.2, w * 2, h * 1.2 + 6); ctx.clip();
    ctx.drawImage(img, x - w / 2, y - h * rise, w, h);
    ctx.restore();
    if (fx.mode === 't' && t > .2) {
      const out = t < .32 ? (t - .2) / .12 : 1 - clamp01((t - .55) / .3);
      if (out > 0) {
        const mx = x, my = y - h * rise + 240 * S, c = Math.cos(fx.a), s = Math.sin(fx.a), ex = x + c * fx.len * out, ey = y + s * fx.len * out - 16;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#2a0610'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo((mx + ex) / 2, Math.min(my, ey) - 60, ex, ey); ctx.stroke();
        ctx.strokeStyle = '#c84060'; ctx.lineWidth = 16; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,190,210,.7)'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = '#c84060'; ctx.strokeStyle = '#2a0610'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ex, ey, 18, 12, fx.a, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    for (let i = 0; i < 5; i++) { const o = (i - 2) * 40 * S; purpleFlame(ctx, x + o, y + 14, (50 + hash(i * 7 + fx.seed) * 40) * S * rise, (i * 2 + Math.floor(time * 14)) % 6, .95); }
    ctx.globalCompositeOperation = 'lighter';
    Kit().glow(ctx, x - 34 * S, y - h * rise + 168 * S, 24 * S, '255,240,150', .7 * rise, true);
    Kit().glow(ctx, x + 34 * S, y - h * rise + 168 * S, 24 * S, '255,240,150', .7 * rise, true);
    ctx.globalCompositeOperation = 'source-over';
  }
  function healO(ctx, fx, time) {
    const K = Kit(), t = fx.age, k = t / fx.dur, al = Math.min(1, t * 4) * (1 - easeIn(k)), x = fx.x, y = fx.y;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - 50, 90, fx.rev ? '190,255,210' : '160,255,200', al * .8, true, 1.4);
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const ph = frac(time * 1.2 + i / 4); ctx.strokeStyle = `rgba(190,255,215,${al * (1 - ph)})`; ctx.beginPath(); ctx.ellipse(x, y - ph * 120, 50 - ph * 16, 18 - ph * 6, 0, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 14; i++) { const ph = frac(time * .9 + i / 14), a = hash(i * 2.1) * TAU; K.glow(ctx, x + Math.cos(a) * 40, y - ph * 150, 7, '210,255,220', al * bell(ph)); }
    ctx.globalCompositeOperation = 'source-over';
    if (fx.rev) for (let i = 0; i < 6; i++) purpleFlame(ctx, x + (i - 2.5) * 22, y + 4, 60 + 20 * Math.sin(time * 8 + i), (i + Math.floor(time * 12)) % 6, al * .8);
  }
  function judgeG(ctx, fx, time) {
    const t = fx.age, fade = 1 - win(t, fx.dur - .8, fx.dur), x = fx.x, y = fx.y;
    ctx.beginPath(); ctx.arc(x, y, JUDGE_R1, 0, TAU); ctx.arc(x, y, JUDGE_R0, 0, TAU, true);
    ctx.fillStyle = `rgba(40,10,50,${.35 * fade})`; ctx.fill();
    cracks(ctx, x, y, JUDGE_R1 * 1.05, 18, fx.seed, fade, 2.2);
    if (t < .65) markCircle(ctx, x, y, 125, '205,120,255', t / .65, time, false, false);
    else crater(ctx, x, y, 100, fade, fx.seed);
  }
  function judgeO(ctx, fx, time) {
    const K = Kit(), t = fx.age, x = fx.x, y = fx.y, ringA = 1 - win(t, 1.0, 1.8), rm = (JUDGE_R0 + JUDGE_R1) / 2;
    if (ringA > 0) for (let i = 0; i < 26; i++) {
      const a = i * TAU / 26 + hash(i) * .1, r = rm + (hash(i * 3 + fx.seed) - .5) * (JUDGE_R1 - JUDGE_R0) * .8;
      const fh = (90 + hash(i * 5) * 70) * easeOut(t / .2) * ringA * (.85 + .15 * Math.sin(time * 10 + i));
      purpleFlame(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, fh, (i + Math.floor(time * 14)) % 6, 1);
    }
    if (t >= .6 && t < 1.8) {
      const k = (t - .6) / 1.2;
      for (let i = 0; i < 7; i++) { const a = i * TAU / 7, r = 40 * (i ? 1 : 0); purpleFlame(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * .5, (200 - i * 12) * bell(k * 1.2), (i + Math.floor(time * 14)) % 6, 1); }
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - 70, 120, '200,120,255', bell(k), true, 1.3); ctx.globalCompositeOperation = 'source-over';
    }
  }
  function nrodsG(ctx, fx, time) {
    const t = fx.age, fade = 1 - win(t, fx.dur - .7, fx.dur);
    for (const [x, y, ts, lean] of fx.spots) {
      if (t < ts) { const k = clamp01((t - ts + .5) / .5); shadowEll(ctx, x, y, 8 + 10 * k, 3 + 3 * k, .3 * k); continue; }
      const u = t - ts;
      shadowEll(ctx, x + 5, y + 2, 9, 4, .3 * fade);
      cracks(ctx, x, y, 34, 6, x * .3 + y, fade * .8, 2);
      const pulse = Math.abs(u - (fx.last - ts + .9)) < .3;
      if (pulse || u < .4) { ctx.strokeStyle = `rgba(200,170,255,${pulse ? .8 : (1 - u / .4) * .8})`; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(x, y, 20 + u * 60 % 46, 10 + u * 30 % 23, 0, 0, TAU); ctx.stroke(); }
    }
  }
  function nrodsO(ctx, fx, time) {
    const t = fx.age, fade = 1 - win(t, fx.dur - .7, fx.dur);
    for (const [x, y, ts, lean] of fx.spots) {
      if (t < ts - .3) continue;
      if (t < ts) { const k = (t - ts + .3) / .3, h = (1 - k) * 420; ctx.strokeStyle = 'rgba(210,190,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - lean * 60, y - h - 120); ctx.lineTo(x - lean * h * .2, y - h); ctx.stroke(); rod(ctx, x - lean * h * .2, y - h, -Math.PI / 2 + lean, 54, 4); continue; }
      rod(ctx, x, y, -Math.PI / 2 + lean, 54, 4, fade);
      if (t - ts < .35) dustRing(ctx, x, y, 30, 6, 12, 1 - (t - ts) / .35, x + y, 4);
    }
  }
  function biteG(ctx, fx, time) {
    const t = fx.age, x = fx.x, y = fx.y, fade = 1 - win(t, fx.dur - .8, fx.dur);
    ctx.fillStyle = `rgba(30,6,24,${.4 * fade})`; ctx.beginPath(); ctx.arc(x, y, BITE_R * easeOut(t / .3), 0, TAU); ctx.fill();
    cracks(ctx, x, y, BITE_R * 1.2 * easeOut(t / .3), 18, fx.seed, fade, 3);
    if (t > fx.T) crater(ctx, x, y, BITE_R * .8, fade, fx.seed + 2);
  }
  function biteO(ctx, fx, time) {
    const K = Kit(), t = fx.age, x = fx.x, y = fx.y, T = fx.T;
    const rise = easeOut(t / .3) * (1 - easeIn(win(t, fx.dur - 1.2, fx.dur - .4)));
    // the giant head looming behind the trap, jaws gaping wide
    if (rise > .01) {
      const S = 1.9, w = 260 * S, h = 300 * S, hy = y - BITE_R * .55;
      ctx.save(); ctx.globalAlpha = .96; ctx.beginPath(); ctx.rect(x - w, hy - h * 1.3, w * 2, h * 1.3 + 4); ctx.clip();
      ctx.drawImage(kingSpr(t < T + .05), x - w / 2, hy - h * rise, w, h); ctx.restore(); ctx.globalAlpha = 1;
    }
    // two arcs of fangs closing on the circle (upper jaw from the far side, lower jaw from the near side)
    const close = t < T ? easeIn(win(t, .1, T)) : 1, open = t < T ? 1 - close : 0, gone = 1 - win(t, T + .4, T + .9);
    if (gone > 0) for (const side of [-1, 1]) {
      const cy = y + side * BITE_R * .5 * (1 - close * .9), r = BITE_R;
      ctx.save(); ctx.translate(x, cy); ctx.scale(1, .5);
      ctx.fillStyle = `rgba(60,8,20,${.85 * gone})`; ctx.beginPath(); ctx.arc(0, 0, r * 1.02, side < 0 ? Math.PI : 0, side < 0 ? TAU : Math.PI); ctx.lineTo(0, 0); ctx.fill();
      ctx.fillStyle = `rgba(244,236,216,${gone})`; ctx.strokeStyle = `rgba(30,6,12,${gone})`; ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const a = (side < 0 ? Math.PI : 0) + (i + .5) * Math.PI / 9, bx = Math.cos(a) * r, by = Math.sin(a) * r, l = 46 + (i % 3 === 1 ? 26 : 0);
        ctx.beginPath(); ctx.moveTo(bx + Math.sin(a) * 14, by - Math.cos(a) * 14); ctx.lineTo(bx * (1 - l / r), by * (1 - l / r)); ctx.lineTo(bx - Math.sin(a) * 14, by + Math.cos(a) * 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      void open;
    }
    if (t >= T && t < T + .7) {
      const k = (t - T) / .7;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - 30, BITE_R * 1.3, '255,90,140', 1 - k, true, .7); ctx.globalCompositeOperation = 'source-over';
      dustRing(ctx, x, y, BITE_R * (.8 + k * .5), 18, 40, 1 - k, fx.seed, 16 + k * 30);
    }
    // hellfire lingering in the bite marks
    if (t > T) {
      const fl = 1 - win(t, fx.dur - 1, fx.dur);
      for (let i = 0; i < 14; i++) { const a = hash(i * 2.2 + fx.seed) * TAU, r = (BITE_R - 60) * Math.sqrt(hash(i * 4.4 + fx.seed)); purpleFlame(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, (70 + hash(i) * 60) * fl * (.85 + .15 * Math.sin(time * 9 + i)), (i + Math.floor(time * 12)) % 6, .95); }
    }
  }

  const FX = {
    missiles: [missilesG, missilesO], laser: [laserG, laserO], rocket: [rocketG, rocketO], spin: [spinG, spinO], storm: [stormG, stormO],
    soul: [null, soulO], grasp: [null, graspO], hrods: [hrodsG, hrodsO], read: [readG, readO], hfield: [hfieldG, hfieldO],
    dog: [dogG, dogO], rhino: [rhinoG, rhinoO], bird: [birdG, birdO], vanish: [null, vanishO], cham: [chamG, chamO], stampede: [stampedeG, stampedeO], poof: [null, poofO],
    pdash: [pdashG, pdashO], drain: [null, drainO], absorb: [absorbG, absorbO], release: [releaseG, releaseO], vortex: [vortexG, vortexO], orbs: [null, orbsO], pfield: [pfieldG, pfieldO],
    king: [kingG, kingO], heal: [null, healO], judge: [judgeG, judgeO], nrods: [nrodsG, nrodsO], bite: [biteG, biteO]
  };

  // ------------------------------------------------------------------ windup looks
  function eyePos(z, f) { const h = HEIGHT(z.bossId); return { x: z.x + f * 6, y: z.y + 3 - h * .78 }; }
  function windupG(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, move = st.move;
    // Rinnegan ripples spreading over the ground from the feet (the paths' shared signature)
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5);
    for (let i = 0; i < 4; i++) {
      const ph = frac(time * 1.1 + i / 4), r = 20 + ph * (90 + 60 * k);
      ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(70,36,150,${(1 - ph) * .55})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = `rgba(230,215,255,${(1 - ph) * .7})`; ctx.stroke();
    }
    ctx.restore();
    if (move[0] === 'n' && move !== 'n_cham') {
      const e = easeOut(k);
      ctx.save(); ctx.translate(z.x + Math.cos(st.aim) * 30, z.y + Math.sin(st.aim) * 15); ctx.rotate(time); ctx.scale(1, .5);
      ctx.drawImage(summonSpr(), -110 * e, -110 * e, 220 * e, 220 * e); ctx.restore();
    }
    if (move === 'h_read' && st.pl) rinneSigil(ctx, st.pl[0], st.pl[1], 70 + 30 * Math.sin(time * 5), .9 * Math.min(1, k * 3), time, '60,30,120', '225,210,255');
    if (move === 'k_heal' || move === 'k_revive' || move === 'k_tongue') {
      const sx = move === 'k_tongue' && st.spots ? st.spots[0][0] : st.tx, sy = move === 'k_tongue' && st.spots ? st.spots[0][1] : st.ty;
      cracks(ctx, sx, sy, 60 + 90 * k, 10, 7, Math.min(1, k * 2), 2.4);
      ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, sx, sy, 80 + 60 * k, '150,60,255', .5 * k, false, .45); ctx.globalCompositeOperation = 'source-over';
    }
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, f = facing(z), L = LIFT(), ey = eyePos(z, f), h = HEIGHT(z.bossId);
    const hx = z.x + f * 20, hy = z.y - L - 6;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, ey.x - 2, ey.y, 10 + 6 * k, '200,170,255', .8, true);
    switch (move) {
      case 'a_laser': K.glow(ctx, hx + f * 10, hy, 20 + 30 * e, '120,210,255', .9, true); break;
      case 'a_storm': K.glow(ctx, z.x, z.y - h * .8, 20 + 40 * e, '255,160,80', .9, true); break;
      case 'a_missiles': for (const s of [-1, 1]) K.glow(ctx, z.x - f * 14 + s * 12, z.y - h * .62, 12 + 10 * e, '255,140,60', .8, true); break;
      case 'a_rocket': K.glow(ctx, hx, hy, 16 + 16 * e, '255,170,90', .9, true); break;
      case 'h_soul': case 'h_field': K.glow(ctx, hx, hy - 10, 20 + 30 * e, '170,230,255', .8, true); break;
      case 'p_drain': case 'p_spit': case 'p_absorb': case 'p_field': case 'p_vortex': K.glow(ctx, z.x, z.y - 46, 40 + 50 * e, '170,130,255', .5); break;
      case 'k_bite': case 'k_judge': K.glow(ctx, st.tx, st.ty, 120 * e, '255,80,120', .35, false, .5); break;
    }
    ctx.globalCompositeOperation = 'source-over';
    switch (move) {
      case 'a_blades': {
        // the hidden arms unfolding with their blades
        for (let i = 0; i < 4; i++) { const an = -Math.PI / 2 + (i - 1.5) * .5, r = 26 + 34 * e; ctx.strokeStyle = '#2a2e36'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(z.x - f * 6, z.y - L - 16); ctx.lineTo(z.x + Math.cos(an) * r, z.y - L - 16 + Math.sin(an) * r); ctx.stroke(); ctx.strokeStyle = '#c8d0da'; ctx.lineWidth = 2; ctx.stroke(); }
        break;
      }
      case 'h_rods': for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (i - 2) * .32; rod(ctx, hx, hy - 6, an, 30 + 20 * e, 3.2, Math.min(1, k * 3)); } break;
      case 'k_rods': for (let i = 0; i < 6; i++) { const an = -Math.PI / 2 + (i - 2.5) * .3, r = 30 + 40 * e; rod(ctx, z.x + Math.cos(an) * r * .5, z.y - 70 + Math.sin(an) * r, an, 40 + 20 * e, 4, Math.min(1, k * 3)); } break;
      case 'n_cham': { ctx.save(); ctx.globalAlpha = .5 * k; ctx.strokeStyle = 'rgba(170,240,200,.9)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(z.x, z.y - L, 30 + i * 10 + 10 * Math.sin(time * 9 + i), 50 + i * 8, 0, 0, TAU); ctx.stroke(); } ctx.restore(); break; }
      case 'p_vortex': case 'p_field': {
        ctx.strokeStyle = 'rgba(200,175,255,.75)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const an = hash(i * 3.1) * TAU, q = frac(time * 1.8 + hash(i * 1.7)), d0 = 150 * (1 - q) + 20; ctx.moveTo(z.x + Math.cos(an) * (d0 + 30), z.y - 40 + Math.sin(an) * (d0 + 30) * .6); ctx.lineTo(z.x + Math.cos(an) * d0, z.y - 40 + Math.sin(an) * d0 * .6); }
        ctx.stroke();
        break;
      }
      case 'p_spit': { const ox = z.x + f * 16, oy = z.y - h * .66; K.spin(ctx, SPH(), ox, oy, 6 + 12 * e, time * 8, 1); break; }
      case 'n_bird': case 'n_dog': case 'n_rhino': case 'n_stampede': {
        const smoke = K.puff('poof'), sx = z.x + Math.cos(st.aim) * 30, sy = z.y + Math.sin(st.aim) * 15;
        for (let i = 0; i < 6; i++) { const ph = frac(time * 1.4 + i / 6); K.stamp(ctx, smoke, sx + Math.sin(i * 2.3 + time) * 40 * e, sy - ph * 70, 12 + 14 * ph, bell(ph) * .55 * Math.min(1, k * 2), .8); }
        break;
      }
      case 'h_read': if (st.pl) { const px = st.pl[0], py = st.pl[1] - 120; ctx.fillStyle = 'rgba(30,14,50,.6)'; ctx.beginPath(); ctx.ellipse(px, py, 26, 12, 0, 0, TAU); ctx.fill(); ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.strokeStyle = '#e8dcff'; ctx.lineWidth = 2; for (const r of [9, 6, 3]) { ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke(); } ctx.restore(); } break;
    }
  }

  function label(ctx, z, st, m) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (!move || !MOVES[move]) return;
    const top = z.y - HEIGHT(z.bossId) - 46;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#140c1c'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // Shared Rinnegan vision: black chakra threads between paths that stand near each other.
  function links(ctx, z, time) {
    const K = Kit();
    for (const o of team(z)) {
      if (o.id < z.id || o.health <= 0) continue;
      const d = Math.hypot(o.x - z.x, o.y - z.y);
      if (d > 1100) continue;
      const al = .5 * (1 - win(d, 800, 1100)), x0 = z.x, y0 = z.y - 50, x1 = o.x, y1 = o.y - 50;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(16,10,24,${al * .55})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 40, x1, y1); ctx.stroke();
      ctx.strokeStyle = `rgba(200,180,255,${al * .5})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const u = frac(time * .6 + i / 3), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - 40, v = 1 - u;
        K.glow(ctx, v * v * x0 + 2 * v * u * mx + u * u * x1, v * v * y0 + 2 * v * u * my + u * u * y1, 8, '190,160,255', al * bell(u));
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.guard = 0; st.hide = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.pp;
    if (!m || !st || !Kit()) return;
    seen(z);
    visualAge(z, st, time);
    if (z.health > 0) links(ctx, z, time);
    if (!st.fx.length && !(st.windup > 0)) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
      for (const s of st.tele) {
        if (s.k === 'c') markCircle(ctx, s.follow ? z.x : s.x, s.follow ? z.y : s.y, s.r, rgb, k, time, s.faint, s.small);
        else if (s.k === 'line') markLine(ctx, s, rgb, k, time);
        else if (s.k === 'cone') markCone(ctx, s, rgb, k, time);
        else if (s.k === 'ring') markRing(ctx, s, rgb, k, time);
      }
      windupG(ctx, z, st, time);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.pp;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) { windupO(ctx, z, st, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (st.shield > 0) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, z.x, z.y - 44, 70, '170,130,255', .4 + .15 * Math.sin(time * 8)); ctx.globalCompositeOperation = 'source-over'; }
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  const hidden = z => !!(z.pp && z.pp.hide > 0 && z.health > 0);

  window.PainPathsBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden, moves };
})();
