(() => {
  'use strict';

  // Edo Tensei Mizukage (spawn panel, faction 'edomizu'): Hōzuki Gengetsu, the Second Mizukage, and
  // Karatachi Yagura, the Fourth Mizukage and Three-Tails jinchūriki. Contract as danzo-boss.js:
  // update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the ground layer (telegraphs, wet
  // ground, coral, puddles), drawOverlay(ctx, z, time) what stands above the characters. All per-boss
  // state lives on z.em (plain data; closures in st.ev / fx.upd are dropped by the co-op serializer).
  //
  // Gengetsu: Water Gun volleys, Great Water Arm haymaker, Hydrification (melts into a puddle, slides
  // and erupts; also shrugs off one heavy blow every few seconds), the Giant Clam's mirage copies, the
  // Steam Imp that hunts and explodes, and the ultimate: a ring of Steam Imps closing in and blowing up.
  // Yagura: hook-staff combo, Water Mirror (the target's own reflection strikes back), Coral Palm,
  // Water Dragon, Isobu shell rolls, the Three-Tails' hallucination mist, and the ultimate: full Isobu
  // transformation firing a Tailed Beast Ball.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeBack = t => { t = clamp01(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const rand = (a, b) => a + Math.random() * (b - a);
  const R = Math.round;
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const HEIGHT = id => { const S = Spr(); return S && S.has && S.has(id) ? S.height(id) : 84; };

  const order = ['gengetsu', 'yagura'];
  const members = {
    gengetsu: {
      name: 'GENGETSU — MIZUKAGE ĐỜI 2', short: 'GENGETSU', accent: '#7fd0ff', hpScale: 3.5, damageScale: 1.95, armor: .92,
      // Every jutsu shows once in the first ~30 s; the second lap reorders them.
      moves: ['gun', 'arm', 'clam', 'hydro', 'imp', 'gun', 'army', 'arm', 'hydro', 'clam', 'imp', 'gun', 'army']
    },
    yagura: {
      name: 'YAGURA — MIZUKAGE ĐỜI 4', short: 'YAGURA', accent: '#6fe0c8', hpScale: 3.6, damageScale: 1.95, armor: .9,
      moves: ['hook', 'dragon', 'coral', 'mirror', 'shell', 'mist', 'isobu', 'hook', 'coral', 'dragon', 'shell', 'mirror', 'mist', 'isobu']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    gun:    { label: 'THỦY ĐỘN · THỦY THIẾT PHÁO', rgb: '140,215,255', windup: .7, after: 1.3 },
    arm:    { label: 'HÀO THỦY OẢN', rgb: '120,200,255', windup: .7, after: 1.2 },
    hydro:  { label: 'THỦY HÓA CHI THUẬT', rgb: '150,225,255', windup: .5, after: .9 },
    clam:   { label: 'THẬN KHÍ LÂU · ĐẠI CÁP', rgb: '255,215,235', windup: 1.0, after: 1.5 },
    imp:    { label: 'CHƯNG NGUY BẠO UY', rgb: '255,236,220', windup: 1.05, after: 1.3 },
    army:   { label: 'CHƯNG NGUY BẠO UY · BÁCH QUỶ', rgb: '255,226,200', windup: 1.35, after: 2.2 },
    dodge:  { label: 'THỦY HÓA', rgb: '150,225,255', windup: 0, after: 0 },
    hook:   { label: 'CÂU TRƯỢNG · LIÊN HOÀN KÍCH', rgb: '150,240,200', windup: .6, after: 1.2 },
    mirror: { label: 'THỦY ĐỘN · THỦY KÍNH CHI THUẬT', rgb: '170,225,255', windup: .9, after: 1.3 },
    coral:  { label: 'SAN HÔ CHƯỞNG', rgb: '255,190,200', windup: 1.0, after: 1.4 },
    dragon: { label: 'THỦY ĐỘN · THỦY LONG ĐẠN', rgb: '120,200,255', windup: .95, after: 1.4 },
    shell:  { label: 'TAM VĨ · GIÁP XÁC LUÂN', rgb: '120,235,210', windup: .8, after: 1.2 },
    mist:   { label: 'TAM VĨ · ẢO VỤ', rgb: '220,235,240', windup: .9, after: 1.3 },
    isobu:  { label: 'TAM VĨ HÓA · VĨ THÚ NGỌC', rgb: '170,140,255', windup: 1.3, after: 2.2 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const GUN_LEN = 1050, GUN_SPEED = 1900, GUN_R = 30, GUN_LEAD = .3;
  const ARM_DASH = 420, ARM_CONE = 310, ARM_HALF = .78, ARM_DUR = .2;
  const HYD_T = .95, HYD_R = 210, HYD_RING = 440;
  const CLAM_R = 340, CLAM_LEN = 800, CLAM_W = 26;
  const IMP_SPEED = 235, IMP_WALK = 2.6, IMP_FUSE = .8, IMP_R = 300;
  const ARMY_N = 7, ARMY_R0 = 540, ARMY_R1 = 200, ARMY_WALK = 2.3, ARMY_BLAST = 240, ARMY_CORE = 400;
  const HOOK_CONE = 270, HOOK_HALF = 1.0, HOOK_LEN = 660, HOOK_W = 34;
  const MIR_BLAST = 190;
  const CORAL_SPEED = 950, CORAL_END = 200, CORAL_STEP = 105;
  const DRAGON_T = 1.2, DRAGON_R = 80, DRAGON_END = 260;
  const ROLL_N = 3, ROLL_GAP = .72, ROLL_TELE = .38, ROLL_DUR = .3, ROLL_LEN = 540;
  const MIST_R = 520, MIST_T = 3.4;
  const BK = 2.2, BEAST_T = 5.0, LAND_R = 270, TBB_LEN = 1150, TBB_W = 95, TBB_BLAST = 430, TBB_SPEED = 1500, SLAM_R = 340;
  const MOUTH = [104 * BK, -52 * BK];

  function pick(level) { return order[((level | 0) % order.length + order.length) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
    const t = clamp01(((px - x0) * dx + (py - y0) * dy) / L);
    return Math.hypot(px - x0 - dx * t, py - y0 - dy * t);
  }
  // A wedge approximated by circles (strike hits every teammate; damagePlayer i-frames stop repeats).
  function coneStrikes(api, x, y, a, len, half, dmg) {
    api.strike(x + Math.cos(a) * 50, y + Math.sin(a) * 50, 70, dmg, null, null, true);
    for (const f of [.45, .82]) for (const k of [-.66, 0, .66]) {
      const aa = a + k * half, d = len * f;
      api.strike(x + Math.cos(aa) * d, y + Math.sin(aa) * d, len * (f > .5 ? .26 : .22), dmg, null, null, true);
    }
  }
  function freeSpot(api, x, y, r, base, dist) {
    for (let k = 0; k < 12; k++) {
      const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .5, px = x + Math.cos(a) * dist, py = y + Math.sin(a) * dist * .9;
      if (!api.blocked(px, py, r)) return { x: R(px), y: R(py) };
    }
    return null;
  }

  function state(z) {
    return z.em || (z.em = { t: 0, casts: 0, timer: 1.3, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], ghosts: [], force: null, hold: 0, holdMove: '', atk: 0, dash: null, roll: null, rollA: 0,
      puddle: null, beast: null, plan: null, dodgeCd: 4, lastHp: z.health, r0: z.r || 24, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = R(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  // `self` events move the boss himself; a transformation cancels them.
  const later = (st, t, fn, self) => st.ev.push({ t, fn, self: !!self });

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move, api) {
    const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), tx = st.tx, ty = st.ty;
    const circ = (cx, cy, r, faint, small) => ({ k: 'c', x: R(cx), y: R(cy), r, faint, small });
    const dist = Math.hypot(tx - x, ty - y);
    switch (move) {
      case 'gun': return [{ k: 'line', x: x + ca * 30, y: y + sa * 30, a, len: GUN_LEN, w: GUN_R, faint: true }];
      case 'arm': {
        const L = Math.max(120, Math.min(ARM_DASH, dist - 40));
        st.plan = { L };
        return [{ k: 'line', x, y, a, len: L, w: 50, faint: true }, { k: 'cone', x: x + ca * L, y: y + sa * L, a, len: ARM_CONE, half: ARM_HALF }];
      }
      case 'hydro': {
        const s = freeSpot(api, tx, ty, (z.r || 24) + 4, a + (Math.random() < .5 ? 1.9 : -1.9), 300) || { x: R(tx - ca * 300), y: R(ty - sa * 300) };
        st.plan = s;
        return [circ(s.x, s.y, HYD_R), circ(s.x, s.y, HYD_RING, true)];
      }
      case 'clam': {
        const b = Math.random() * TAU, copies = [];
        for (let i = 0; i < 4; i++) {
          const an = b + i * TAU / 4 + rand(-.25, .25), cx = tx + Math.cos(an) * CLAM_R, cy = ty + Math.sin(an) * CLAM_R * .9;
          copies.push({ x: R(cx), y: R(cy), a: +Math.atan2(ty - cy, tx - cx).toFixed(3), t0: +(.08 + i * .1).toFixed(2), tf: +(.95 + i * .3).toFixed(2), fired: 0 });
        }
        // The clam rises behind him, on the side away from his target.
        st.plan = { copies, cx: R(x - ca * 170), cy: R(y - sa * 120 - 30), f: ca >= 0 ? 1 : -1 };
        return copies.map(c => circ(c.x, c.y, 60, true, true)).concat([circ(st.plan.cx, st.plan.cy, 120, true)]);
      }
      case 'imp': {
        const f = ca >= 0 ? 1 : -1, sx = R(x - sa * 90 + f * 30), sy = R(y + ca * 50 - 20);
        st.plan = { sx, sy };
        return [circ(sx, sy, 70, true, true)];
      }
      case 'army': {
        const b = Math.random() * TAU, spots = [];
        for (let i = 0; i < ARMY_N; i++) { const an = b + i * TAU / ARMY_N; spots.push({ x: R(tx + Math.cos(an) * ARMY_R0), y: R(ty + Math.sin(an) * ARMY_R0 * .92) }); }
        st.plan = { spots, cx: R(tx), cy: R(ty) };
        return [circ(tx, ty, ARMY_R0, true), circ(tx, ty, ARMY_CORE * .5, true)].concat(spots.map(s => circ(s.x, s.y, 70, true, true)));
      }
      case 'hook': return [{ k: 'cone', x, y, a, len: HOOK_CONE, half: HOOK_HALF }, { k: 'line', x: x + ca * 30, y: y + sa * 30, a, len: HOOK_LEN, w: HOOK_W, faint: true }];
      case 'mirror': {
        const md = Math.max(110, Math.min(260, dist * .45)), mx = R(x + ca * md), my = R(y + sa * md);
        st.plan = { mx, my };
        const L = Math.hypot(tx - mx, ty - my);
        return [{ k: 'line', x: mx, y: my, a: Math.atan2(ty - my, tx - mx), len: L, w: 46, faint: true }, circ(tx, ty, MIR_BLAST)];
      }
      case 'coral': {
        const offs = [-.3, 0, .3], reach = Math.max(300, Math.min(900, dist + 40));
        const lanes = offs.map((o, i) => {
          const aa = a + o * (i === 1 ? 0 : 1), x0 = x + Math.cos(aa) * 36, y0 = y + Math.sin(aa) * 36;
          // the side lanes bend back in toward the target
          const len = i === 1 ? reach : reach * .92;
          return { a: +aa.toFixed(3), x0: R(x0), y0: R(y0), len: R(len), t0: +(.08 + Math.abs(i - 1) * .08).toFixed(2), seed: R(Math.random() * 99) };
        });
        st.plan = { lanes, ex: R(x + ca * reach), ey: R(y + sa * reach) };
        return lanes.map(l => ({ k: 'line', x: l.x0, y: l.y0, a: l.a, len: l.len, w: 46 })).concat([circ(st.plan.ex, st.plan.ey, CORAL_END)]);
      }
      case 'dragon': {
        const side = Math.random() < .5 ? 1 : -1, x0 = x + ca * 40, y0 = y + sa * 40;
        const x2 = tx + ca * 240, y2 = ty + sa * 240, mx = (x0 + x2) / 2, my = (y0 + y2) / 2;
        const x1 = mx - sa * side * Math.min(300, dist * .45), y1 = my + ca * side * Math.min(300, dist * .45);
        st.plan = { p: [R(x0), R(y0), R(x1), R(y1), R(x2), R(y2)] };
        return [{ k: 'curve', p: st.plan.p, w: DRAGON_R }, circ(x2, y2, DRAGON_END)];
      }
      case 'shell': return [{ k: 'line', x, y, a, len: ROLL_LEN, w: 60, faint: true }];
      case 'mist': return [circ(tx, ty, MIST_R, true), circ(tx, ty, MIST_R * .55, true)];
      case 'isobu': return [{ k: 'c', follow: true, r: LAND_R }, { k: 'c', follow: true, r: TBB_BLAST * .9, faint: true }];
    }
    return [];
  }

  function announce(z, st, m, api) {
    let move = st.force;
    if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? R(p.x) : R(z.x); st.ty = p ? R(p.y) : R(z.y);
    st.plan = null;
    st.tele = teleFor(z, st, move, api);
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), f = ca >= 0 ? 1 : -1;
    switch (move) {
      // ---------------- Gengetsu
      case 'gun': {
        const fx = addFx(st, { kind: 'gun', shots: [], dmg: D, dur: 3.3, upd: gunUpd });
        for (let v = 0; v < 3; v++) later(st, v * .42, api => {
          const p = api.player;
          if (!p || z.health <= 0) return;
          const aa = Math.atan2(p.y - z.y, p.x - z.x), c = Math.cos(aa), s = Math.sin(aa);
          // Double Water Gun: both hands; the last volley fans out into five.
          const list = v < 2 ? [[-.035, -9], [.035, 9]] : [[-.16, -6], [-.08, -3], [0, 0], [.08, 3], [.16, 6]];
          for (const [da, off] of list) fx.shots.push({ x0: R(z.x + c * 26 - s * off), y0: R(z.y + s * 26 + c * off), a: +(aa + da).toFixed(3), t0: +(fx.age + GUN_LEAD).toFixed(3), end: -1, de: -1 });
        });
        st.hold = 1.35; st.holdMove = 'gun'; st.atk = 1.35;
        break;
      }
      case 'arm': {
        const want = st.plan ? st.plan.L : 300, r = (z.r || 24) + 2;
        let L = 1;
        for (let d = 30; d <= want; d += 30) { if (api.blocked(z.x + ca * d, z.y + sa * d, r)) break; L = d; }
        st.dash = { x0: R(z.x), y0: R(z.y), x1: R(z.x + ca * L), y1: R(z.y + sa * L), t: 0, a: +a.toFixed(3), kind: 'arm' };
        st.hold = .9; st.holdMove = 'arm';
        break;
      }
      case 'hydro': {
        const s = st.plan || { x: R(z.x), y: R(z.y) };
        st.puddle = { x0: R(z.x), y0: R(z.y), x1: s.x, y1: s.y, t: 0 };
        addFx(st, { kind: 'melt', x: R(z.x), y: R(z.y), dur: 1.1 });
        api.burst(z.x, z.y - 20, '#9fe0ff', 10);
        break;
      }
      case 'clam': {
        const P = st.plan;
        if (!P) break;
        addFx(st, { kind: 'clam', x: P.cx, y: P.cy, f: P.f, dur: 4.6 });
        const fx = addFx(st, { kind: 'mirage', copies: P.copies, dmg: D, dur: 3.1, upd: mirageUpd });
        const last = P.copies[P.copies.length - 1];
        // When the mirage fades, the real Gengetsu is standing where the last copy was.
        later(st, last.tf + .4, api => {
          if (z.health <= 0 || st.puddle || api.blocked(last.x, last.y, (z.r || 24) + 2)) return;
          addFx(st, { kind: 'melt', x: R(z.x), y: R(z.y), dur: 1.1 });
          z.x = last.x; z.y = last.y;
          addFx(st, { kind: 'melt', x: last.x, y: last.y, dur: 1.1 });
        }, true);
        st.hold = .7; st.holdMove = 'clam';
        void fx;
        break;
      }
      case 'imp': {
        const P = st.plan || { sx: R(z.x + f * 80), sy: R(z.y) };
        addFx(st, { kind: 'imp', army: 0, imps: [{ x: P.sx, y: P.sy, a: +a.toFixed(3), t: 0, fz: 0, fuse: 0, boom: -1, nt: 0 }], dmg: D, dur: 7.5, upd: impUpd });
        api.shake(8);
        st.hold = .6; st.holdMove = 'imp';
        break;
      }
      case 'army': {
        const P = st.plan;
        if (!P) break;
        const imps = P.spots.map((s, i) => ({ x: s.x, y: s.y, a: +Math.atan2(P.cy - s.y, P.cx - s.x).toFixed(3), t: -i * .05, fz: 0, fuse: 0, boom: -1, nt: 0 }));
        addFx(st, { kind: 'imp', army: 1, imps, cx: P.cx, cy: P.cy, core: -1, coreT: -1, dmg: D, dur: 9, upd: impUpd });
        api.shake(14);
        st.hold = 1.1; st.holdMove = 'army';
        break;
      }
      // ---------------- Yagura
      case 'hook': {
        addFx(st, { kind: 'sweep', x: R(z.x), y: R(z.y), a: +a.toFixed(3), dur: .7 });
        coneStrikes(api, z.x, z.y, a, HOOK_CONE, HOOK_HALF, D * 1.5);
        api.shake(7);
        later(st, .3, api => {
          if (z.health <= 0) return;
          const p = api.player, aa = p ? Math.atan2(p.y - z.y, p.x - z.x) : a;
          addFx(st, { kind: 'hookx', x0: R(z.x), y0: R(z.y), a: +aa.toFixed(3), hit: 0, dmg: D, dur: .75, upd: hookUpd });
        });
        st.hold = 1.0; st.holdMove = 'hook'; st.atk = 1.0;
        break;
      }
      case 'mirror': {
        const P = st.plan || { mx: R(z.x + ca * 150), my: R(z.y + sa * 150) };
        const p = api.player, tx = p ? R(p.x) : st.tx, ty = p ? R(p.y) : st.ty;
        addFx(st, { kind: 'mirror', mx: P.mx, my: P.my, tx, ty, a: +Math.atan2(ty - P.my, tx - P.mx).toFixed(3), hit: 0, dmg: D, dur: 2.4, upd: mirrorUpd });
        st.hold = .6; st.holdMove = 'mirror';
        break;
      }
      case 'coral': {
        const P = st.plan;
        if (!P) break;
        let last = 0;
        P.lanes.forEach((l, li) => {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 80, i = 0; d < l.len - 40; d += CORAL_STEP, i++) {
            const x = l.x0 + c * d, y = l.y0 + s * d;
            later(st, l.t0 + d / CORAL_SPEED, api => api.strike(x, y, 58, D * 1.3, null, null, true));
          }
          last = Math.max(last, l.t0 + l.len / CORAL_SPEED);
          void li;
        });
        later(st, last + .05, api => {
          api.strike(P.ex, P.ey, CORAL_END, D * 2.0, null, 'earth', true);
          api.world(P.ex, P.ey, 150, D * 2.4, 'earth');
          api.shake(12);
        });
        addFx(st, { kind: 'coral', lanes: P.lanes, ex: P.ex, ey: P.ey, last: +last.toFixed(2), tick: +(last + .6).toFixed(2), dmg: D, dur: last + 3.6, upd: coralUpd });
        st.hold = .8; st.holdMove = 'coral';
        break;
      }
      case 'dragon': {
        const P = st.plan;
        if (!P) break;
        addFx(st, { kind: 'dragon', p: P.p, burst: 0, mid: 0, dmg: D, dur: DRAGON_T + 2.2, upd: dragonUpd });
        api.shake(9);
        st.hold = .9; st.holdMove = 'dragon';
        break;
      }
      case 'shell': {
        st.hold = ROLL_N * ROLL_GAP + .45; st.holdMove = 'shell';
        for (let i = 0; i < ROLL_N; i++) later(st, i * ROLL_GAP, api => rollTele(z, st, api, i), true);
        api.shake(6);
        break;
      }
      case 'mist': {
        addFx(st, { kind: 'mist', x: st.tx, y: st.ty, spots: [], n: 0, dmg: D, dur: MIST_T + 1.6, upd: mistUpd });
        st.hold = .8; st.holdMove = 'mist';
        break;
      }
      case 'isobu': {
        st.ev = st.ev.filter(e => !e.self);
        st.beast = { t: 0, x: R(z.x), y: R(z.y), a: +a.toFixed(3), f, fired: 0, slam: 0, out: 0 };
        api.strike(z.x, z.y, LAND_R, D * 1.6, null, 'crater', true);
        api.world(z.x, z.y, 200, D * 2.6, 'crater');
        addFx(st, { kind: 'splash', x: R(z.x), y: R(z.y), r: LAND_R, dur: 1.4 });
        api.shake(20);
        st.hold = BEAST_T + .2; st.holdMove = 'isobu';
        break;
      }
    }
  }

  // ---------------- per-frame jutsu logic
  function gunUpd(fx, dt, api) {
    const p = api.player;
    for (const b of fx.shots) {
      const u = fx.age - b.t0;
      if (u < 0 || b.de >= 0) continue;
      const d = u * GUN_SPEED;
      if (d >= GUN_LEN) { b.end = GUN_LEN; b.de = +fx.age.toFixed(3); continue; }
      const c = Math.cos(b.a), s = Math.sin(b.a), hx = b.x0 + c * d, hy = b.y0 + s * d;
      api.strike(hx, hy, GUN_R, fx.dmg * .85, null, null, true);
      if ((p && Math.hypot(p.x - hx, p.y - hy) < GUN_R + (p.r || 12)) || api.blocked(hx, hy, 4)) { b.end = R(d); b.de = +fx.age.toFixed(3); }
    }
  }
  function mirageUpd(fx, dt, api) {
    for (const c of fx.copies) {
      if (c.fired || fx.age < c.tf) continue;
      c.fired = 1;
      api.line(c.x, c.y, c.x + Math.cos(c.a) * CLAM_LEN, c.y + Math.sin(c.a) * CLAM_LEN, CLAM_W, fx.dmg * 1.3);
      api.shake(6);
    }
  }
  function impUpd(fx, dt, api) {
    const p = api.player;
    let alive = 0, allWalked = true;
    for (let i = 0; i < fx.imps.length; i++) {
      const m = fx.imps[i];
      if (m.boom >= 0) {
        // scalding steam lingers over the blast
        if (fx.age >= m.nt && fx.age < m.boom + 2.2) { m.nt = +(m.nt + .5).toFixed(2); api.strike(m.x, m.y, fx.army ? 170 : 200, fx.dmg * .28, null, null, true); }
        continue;
      }
      alive++;
      m.t += dt;
      if (m.fz) {
        m.fuse += dt;
        if (m.fuse >= IMP_FUSE) {
          m.boom = +fx.age.toFixed(3); m.nt = +(fx.age + .5).toFixed(2);
          const r = fx.army ? ARMY_BLAST : IMP_R;
          api.strike(m.x, m.y, r, fx.dmg * (fx.army ? 2.4 : 3.0), null, null, true);
          if (!fx.army || i % 3 === 0) api.world(m.x, m.y, fx.army ? 150 : 200, fx.dmg * 2.6, 'crater');
          api.shake(fx.army ? 14 : 20);
        }
        continue;
      }
      if (m.t < 0) { allWalked = false; continue; }
      if (fx.army) {
        const d = Math.hypot(fx.cx - m.x, fx.cy - m.y);
        if (d > ARMY_R1) {
          const step = Math.min(d - ARMY_R1, (ARMY_R0 - ARMY_R1) / ARMY_WALK * dt);
          m.x = Math.round((m.x + Math.cos(m.a) * step) * 10) / 10; m.y = Math.round((m.y + Math.sin(m.a) * step) * 10) / 10;
        }
        if (m.t < ARMY_WALK) allWalked = false;
      } else {
        // the single imp hunts its target, turning like a heavy beast
        if (p) {
          const want = Math.atan2(p.y - m.y, p.x - m.x), da = Math.atan2(Math.sin(want - m.a), Math.cos(want - m.a));
          m.a = +(m.a + Math.max(-2.2 * dt, Math.min(2.2 * dt, da))).toFixed(3);
        }
        m.x = Math.round((m.x + Math.cos(m.a) * IMP_SPEED * dt) * 10) / 10; m.y = Math.round((m.y + Math.sin(m.a) * IMP_SPEED * dt) * 10) / 10;
        if (m.t > IMP_WALK || (p && Math.hypot(p.x - m.x, p.y - m.y) < 110)) { m.fz = 1; m.fuse = 0; }
      }
    }
    if (fx.army) {
      if (allWalked && alive && fx.imps.every(m => m.boom >= 0 || !m.fz)) fx.imps.forEach((m, i) => { if (m.boom < 0) { m.fz = 1; m.fuse = -i * .14; } });
      if (!alive && fx.coreT < 0) fx.coreT = +(fx.age + .3).toFixed(2);
      if (fx.coreT >= 0 && fx.core < 0 && fx.age >= fx.coreT) {
        fx.core = +fx.age.toFixed(3);
        api.strike(fx.cx, fx.cy, ARMY_CORE, fx.dmg * 3.4, null, 'crater', true);
        api.world(fx.cx, fx.cy, 260, fx.dmg * 3.6, 'crater');
        for (let i = 0; i < 3; i++) { const aa = i * TAU / 3 + .5; api.world(fx.cx + Math.cos(aa) * 340, fx.cy + Math.sin(aa) * 300, 130, fx.dmg * 2.4, 'shockwave', aa); }
        api.burst(fx.cx, fx.cy - 40, '#f4f8ff', 30);
        api.shake(28);
      }
    }
  }
  function hookUpd(fx, dt, api) {
    if (fx.hit || fx.age < .22) return;
    fx.hit = 1;
    const c = Math.cos(fx.a), s = Math.sin(fx.a), x1 = fx.x0 + c * HOOK_LEN, y1 = fx.y0 + s * HOOK_LEN, p = api.player;
    api.line(fx.x0, fx.y0, x1, y1, HOOK_W, fx.dmg * 1.2);
    if (p && segDist(p.x, p.y, fx.x0, fx.y0, x1, y1) < HOOK_W + (p.r || 12)) {
      const d = Math.hypot(p.x - fx.x0, p.y - fx.y0);
      api.knockback({ x: fx.x0, y: fx.y0 }, HOOK_LEN + 80, -Math.max(0, Math.min(420, d - 90)), 0);
    }
    api.shake(8);
  }
  function mirrorUpd(fx, dt, api) {
    if (fx.hit || fx.age < .85) return;
    fx.hit = 1;
    api.line(fx.mx, fx.my, fx.tx, fx.ty, 40, fx.dmg * 1.0);
    api.strike(fx.tx, fx.ty, MIR_BLAST, fx.dmg * 2.3, null, 'shockwave', true);
    api.shake(14);
  }
  function coralUpd(fx, dt, api) {
    // the coral thicket stays: standing in it keeps hurting
    if (fx.age < fx.tick || fx.age > fx.dur - 1.0) return;
    fx.tick = +(fx.tick + .5).toFixed(2);
    api.strike(fx.ex, fx.ey, CORAL_END * .8, fx.dmg * .3, null, null, true);
  }
  function bez(p, u) {
    const v = 1 - u;
    return [v * v * p[0] + 2 * v * u * p[2] + u * u * p[4], v * v * p[1] + 2 * v * u * p[3] + u * u * p[5]];
  }
  const dragonU = age => { const t = clamp01(age / DRAGON_T); return t * t * (3 - 2 * t) * .35 + t * .65; };
  function dragonUpd(fx, dt, api) {
    if (fx.age <= DRAGON_T) {
      const [hx, hy] = bez(fx.p, dragonU(fx.age));
      api.strike(hx, hy, DRAGON_R, fx.dmg * 1.6, null, null, true);
      if (!fx.mid && fx.age > DRAGON_T * .5) { fx.mid = 1; api.world(hx, hy, 120, fx.dmg * 2, 'shockwave'); }
    } else if (!fx.burst) {
      fx.burst = 1;
      api.strike(fx.p[4], fx.p[5], DRAGON_END, fx.dmg * 2.2, null, 'crater', true);
      api.world(fx.p[4], fx.p[5], 200, fx.dmg * 2.6, 'shockwave');
      api.shake(18);
    }
  }
  function mistUpd(fx, dt, api) {
    const p = api.player;
    // spears of coral and water lunge out of the fog wherever the target stands
    if (fx.n < 9 && fx.age >= .3 + fx.n * .32 && fx.age < MIST_T) {
      const j = fx.n === 0 ? 0 : 70, ox = p ? p.x : fx.x, oy = p ? p.y : fx.y;
      const an = Math.random() * TAU;
      fx.spots.push({ x: R(ox + Math.cos(an) * j * Math.random()), y: R(oy + Math.sin(an) * j * Math.random()), t: +fx.age.toFixed(2), hit: 0, v: fx.n % 3 });
      fx.n++;
    }
    for (const s of fx.spots) if (!s.hit && fx.age >= s.t + .6) {
      s.hit = 1;
      api.strike(s.x, s.y, 105, fx.dmg * 1.35, null, null, true);
      if (s.v === 0) api.world(s.x, s.y, 80, fx.dmg * 1.6, 'earth');
      api.shake(6);
    }
  }
  function tbbUpd(fx, dt, api) {
    const d = (fx.age - .05) * TBB_SPEED, c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (d < 0) return;
    if (d < fx.len) {
      api.strike(fx.x0 + c * d, fx.y0 + s * d, TBB_W, fx.dmg * 2.0, null, null, true);
    } else if (!fx.burst) {
      fx.burst = 1; fx.bt = +fx.age.toFixed(3);
      const ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
      api.strike(ex, ey, TBB_BLAST, fx.dmg * 4.6, null, 'crater', true);
      api.world(ex, ey, 320, fx.dmg * 4.2, 'crater');
      for (let i = 0; i < 4; i++) { const aa = i * TAU / 4 + fx.a + .4; api.world(ex + Math.cos(aa) * 360, ey + Math.sin(aa) * 320, 150, fx.dmg * 3, 'vortex', aa); }
      api.burst(ex, ey - 40, '#c8b8ff', 34);
      api.shake(30);
    }
  }

  // Gengetsu's dash for the Great Water Arm; Yagura's shell rolls.
  function dashUpdate(z, st, dt, api) {
    const d = st.dash, D = api.damage || 60;
    d.t += dt;
    const k = Math.min(1, d.t / ARM_DUR), e = easeOut(k);
    z.x = lerp(d.x0, d.x1, e); z.y = lerp(d.y0, d.y1, e);
    if (st.ghosts.length < 12) st.ghosts.push({ x: R(z.x), y: R(z.y), f: Math.cos(d.a) >= 0 ? 1 : -1, age: 0, id: 'gengetsu' });
    if (k < 1) return;
    st.dash = null;
    const c = Math.cos(d.a), s = Math.sin(d.a);
    api.line(d.x0, d.y0, d.x1, d.y1, 52, D * 1.2);
    coneStrikes(api, d.x1, d.y1, d.a, ARM_CONE, ARM_HALF, D * 2.3);
    api.knockback({ x: d.x1 - c * 30, y: d.y1 - s * 30 }, 260, 190, 0);
    api.world(d.x1 + c * 160, d.y1 + s * 160, 130, D * 2.4, 'shockwave', d.a);
    addFx(st, { kind: 'punch', x: R(d.x1), y: R(d.y1), a: d.a, dur: 1.5 });
    st.atk = .5;
    api.shake(16);
  }
  function rollTele(z, st, api, i) {
    if (st.beast || z.health <= 0) return;
    const p = api.player, px = p ? p.x : st.tx, py = p ? p.y : st.ty;
    const a = Math.atan2(py - z.y, px - z.x), c = Math.cos(a), s = Math.sin(a), r = (z.r || 24) + 2;
    let len = Math.max(260, Math.min(ROLL_LEN, Math.hypot(px - z.x, py - z.y) + 160));
    while (len > 90 && api.blocked(z.x + c * len, z.y + s * len, r)) len -= 30;
    addFx(st, { kind: 'rtele', x: R(z.x), y: R(z.y), a: +a.toFixed(3), len: R(len), dur: ROLL_TELE });
    later(st, ROLL_TELE, api => {
      if (st.beast || z.health <= 0) return;
      let L = len;
      while (L > 60 && api.blocked(z.x + c * L, z.y + s * L, r)) L -= 30;
      st.roll = { x0: R(z.x), y0: R(z.y), x1: R(z.x + c * L), y1: R(z.y + s * L), t: 0, a: +a.toFixed(3), last: i === ROLL_N - 1 ? 1 : 0 };
    }, true);
  }
  function rollUpdate(z, st, dt, api) {
    const d = st.roll, D = api.damage || 60;
    d.t += dt;
    const k = Math.min(1, d.t / ROLL_DUR), e = easeInOut(k);
    z.x = lerp(d.x0, d.x1, e); z.y = lerp(d.y0, d.y1, e);
    st.rollA = +(st.rollA + dt * 22 * (Math.cos(d.a) >= 0 ? 1 : -1)).toFixed(2);
    if (st.ghosts.length < 10) st.ghosts.push({ x: R(z.x), y: R(z.y), f: 0, age: 0, id: 'ball' });
    if (k < 1) return;
    st.roll = null;
    api.line(d.x0, d.y0, d.x1, d.y1, 62, D * 1.7, d.last ? 'earth' : null);
    api.strike(d.x1, d.y1, 140, D * 1.0, null, null, true);
    addFx(st, { kind: 'rshock', x: R(d.x1), y: R(d.y1), a: d.a, x0: d.x0, y0: d.y0, dur: 1.3 });
    api.shake(d.last ? 14 : 9);
  }

  // Hydrification: a puddle sliding over the ground, then a geyser where he reforms.
  function puddleUpdate(z, st, dt, api) {
    const pd = st.puddle, D = api.damage || 60;
    pd.t += dt;
    const k = clamp01(pd.t / HYD_T), e = easeInOut(k);
    z.x = lerp(pd.x0, pd.x1, e); z.y = lerp(pd.y0, pd.y1, e);
    if (k < 1) return;
    st.puddle = null;
    api.strike(z.x, z.y, HYD_R, D * 1.7, null, 'shockwave', true);
    addFx(st, { kind: 'geyser', x: R(z.x), y: R(z.y), hit: 0, dmg: D, dur: 1.7, upd: geyserUpd });
    api.burst(z.x, z.y - 40, '#c8f0ff', 18);
    api.shake(14);
    st.timer = .45;
  }
  function geyserUpd(fx, dt, api) {
    // the reformed body throws a ring of water outward
    const p = api.player;
    if (fx.hit || !p || fx.age > .6) return;
    const r = HYD_R * .6 + (HYD_RING - HYD_R * .6) * easeOut(fx.age / .55), d = Math.hypot(p.x - fx.x, p.y - fx.y);
    if (Math.abs(d - r) < 46 + (p.r || 12)) { fx.hit = 1; api.damagePlayer(fx.dmg * 1.0); }
  }

  // Full Isobu: lands, charges the Tailed Beast Ball at its maw, fires, slams its shell, reverts.
  function beastUpdate(z, st, dt, api) {
    const b = st.beast, D = api.damage || 60, p = api.player;
    b.t += dt;
    z.x = b.x; z.y = b.y;
    if (b.t < 1.55 && p) { b.a = +Math.atan2(p.y - b.y, p.x - b.x).toFixed(3); b.f = Math.cos(b.a) >= 0 ? 1 : -1; }
    if (!b.fired && b.t >= 1.95) {
      b.fired = 1;
      const x0 = b.x + b.f * MOUTH[0] * .85, y0 = b.y;
      addFx(st, { kind: 'tbb', x0: R(x0), y0: R(y0), a: b.a, len: TBB_LEN, burst: 0, bt: -1, dmg: D, dur: TBB_LEN / TBB_SPEED + 2.4, upd: tbbUpd });
      api.shake(16);
    }
    if (!b.slam && b.t >= 3.95) {
      b.slam = 1;
      api.strike(b.x, b.y, SLAM_R, D * 1.8, null, 'earth', true);
      api.world(b.x, b.y, 240, D * 2.4, 'earth');
      addFx(st, { kind: 'splash', x: b.x, y: b.y, r: SLAM_R, coral: 1, dur: 1.6 });
      api.shake(20);
    }
    if (!b.out && b.t >= 4.55) { b.out = 1; addFx(st, { kind: 'splash', x: b.x, y: b.y, r: 200, dur: 1.2 }); api.burst(b.x, b.y - 60, '#c8f0ff', 20); }
    if (b.t >= BEAST_T) { st.beast = null; z.r = st.r0; st.timer = .3; }
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
    for (let i = st.ghosts.length - 1; i >= 0; i--) if ((st.ghosts[i].age += dt) > .3) st.ghosts.splice(i, 1);
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.dash = st.roll = st.puddle = st.beast = null; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.atk = Math.max(0, st.atk - dt);
    st.dodgeCd -= dt;

    // Hydrification reflex (Gengetsu): one heavy blow every few seconds just splashes through water.
    if (z.bossId === 'gengetsu' && !st.puddle) {
      const drop = st.lastHp - z.health;
      if (drop > z.maxHealth * .025 && st.dodgeCd <= 0) {
        z.health = Math.min(z.maxHealth, z.health + drop * .85);
        st.dodgeCd = 9;
        addFx(st, { kind: 'melt', x: R(z.x), y: R(z.y), dodge: 1, dur: 1.2 });
        api.burst(z.x, z.y - 30, '#9fe0ff', 12);
      }
    }

    if (st.puddle) {
      puddleUpdate(z, st, dt, api);
      z.armorScale = st.puddle ? 1e-4 : m.armor; z.kageDash = st.puddle ? .05 : 0; z.bossWindup = 0;
      st.lastHp = z.health;
      return;
    }
    if (st.beast) {
      z.r = 80;
      beastUpdate(z, st, dt, api);
      z.armorScale = st.beast ? m.armor * .6 : m.armor; z.kageDash = st.beast ? .05 : 0; z.bossWindup = 0;
      st.hold = Math.max(0, st.hold - dt);
      st.lastHp = z.health;
      return;
    }
    z.armorScale = (st.holdMove === 'shell' && st.hold > 0) || st.roll ? m.armor * .35 : m.armor;

    if (st.dash) dashUpdate(z, st, dt, api);
    if (st.roll) rollUpdate(z, st, dt, api);
    st.hold = Math.max(0, st.hold - dt);
    if (st.holdMove === 'shell' && st.hold > 0 && !st.roll) st.rollA = +(st.rollA + dt * 4).toFixed(2);
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && !st.dash && !st.roll) {
      st.holdMove = '';
      st.timer -= dt;
      const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      if (st.timer <= 0 && p && (st.force || d < 900)) announce(z, st, m, api);
    }
    z.kageDash = st.dash || st.roll || st.atk > 0 || (st.windup > 0 && st.move === 'gun') || (st.holdMove === 'shell' && st.hold > 0) ? .05 : 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.speedScale = .9;
    st.lastHp = z.health;
  }

  // ------------------------------------------------------------------ cached art
  const WATER = ['rgba(12,44,92,.55)', '#2f8fd8', '#8fdcff', 'rgba(255,255,255,.9)'];
  // Layered water stroke along the current path (dark under-stroke keeps it readable on bright ground).
  function waterStroke(ctx, w, alpha = 1) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    ctx.strokeStyle = WATER[0]; ctx.lineWidth = w * 1.45; ctx.stroke();
    ctx.strokeStyle = WATER[1]; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = WATER[2]; ctx.lineWidth = w * .55; ctx.stroke();
    ctx.strokeStyle = WATER[3]; ctx.lineWidth = Math.max(1, w * .16); ctx.stroke();
    ctx.globalAlpha = a;
  }
  function dropSpr() {
    return Kit().sprite('emz:drop', 64, 32, g => {
      g.translate(32, 16);
      g.fillStyle = 'rgba(12,44,92,.7)'; g.beginPath(); g.ellipse(0, 0, 30, 13, 0, 0, TAU); g.fill();
      const gr = g.createLinearGradient(0, -12, 0, 12);
      gr.addColorStop(0, '#e8fbff'); gr.addColorStop(.45, '#7fd0ff'); gr.addColorStop(1, '#2a7fd0');
      g.fillStyle = gr; g.beginPath(); g.moveTo(28, 0); g.quadraticCurveTo(14, -11, -10, -9); g.quadraticCurveTo(-27, -6, -27, 0); g.quadraticCurveTo(-27, 6, -10, 9); g.quadraticCurveTo(14, 11, 28, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(8, -3.5, 10, 2.6, 0, 0, TAU); g.fill();
    });
  }
  function steamPuff() { return Kit().puff('poof'); }
  function waterPuff() { return Kit().puff('water'); }
  function rasenSwirl() { return Kit().swirl('emz:wrasen', ['rgba(255,255,255,.95)', 'rgba(120,210,255,.9)', 'rgba(40,140,230,.85)'], 9, 1.3, .08, 128, 4); }
  function darkSwirl() { return Kit().swirl('emz:tbb', ['rgba(10,6,24,.95)', 'rgba(90,60,200,.8)', 'rgba(30,16,60,.9)', 'rgba(200,170,255,.5)'], 10, 1.4, .06, 256, 6); }
  function tbbSphere() { return Kit().sphere('emz:tbb', [[0, '#5a4a9a'], [.35, '#1c1238'], [.8, '#07040e'], [1, 'rgba(7,4,14,.9)']]); }
  function waterSphere() { return Kit().sphere('emz:wsph', [[0, 'rgba(255,255,255,.95)'], [.3, 'rgba(160,225,255,.85)'], [.75, 'rgba(40,140,230,.7)'], [1, 'rgba(20,80,170,.55)']]); }

  // Branching coral (pale pink, white tips), base at the bottom centre.
  function coralSpr(i) {
    return Kit().sprite('emz:coral' + (i % 3), 72, 92, g => {
      const seed = (i % 3) * 3.7 + 1;
      const branch = (x, y, a, len, w, depth, pass) => {
        const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
        g.strokeStyle = pass === 0 ? '#4a1e2a' : pass === 1 ? (depth === 0 ? '#d88a96' : '#f2b8bc') : 'rgba(255,248,244,.85)';
        g.lineWidth = pass === 0 ? w + 2.4 : pass === 1 ? w : Math.max(.8, w * .3);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .3) * len * .5, y + Math.sin(a + .3) * len * .5, x1, y1); g.stroke();
        if (depth < 3) {
          const n = depth === 0 ? 3 : 2;
          for (let k = 0; k < n; k++) {
            const da = (k - (n - 1) / 2) * (.7 - depth * .1) + (hash(seed + depth * 5 + k) - .5) * .5;
            branch(x1, y1, a + da, len * (.62 + hash(seed + k * 3 + depth) * .2), w * .66, depth + 1, pass);
          }
        } else if (pass === 1) { g.fillStyle = '#fff4ee'; g.beginPath(); g.arc(x1, y1, w * .9, 0, TAU); g.fill(); }
      };
      g.lineCap = 'round';
      for (let pass = 0; pass < 3; pass++) branch(36, 90, -Math.PI / 2 + (hash(seed) - .5) * .3, 30, 7, 0, pass);
    });
  }
  function drawCoral(ctx, i, x, y, s, alpha = 1, flip = false) {
    if (s <= .02 || alpha <= .01) return;
    const img = coralSpr(i), w = 72 * s, h = 92 * s;
    ctx.globalAlpha = alpha;
    if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, -h * .98, w, h); ctx.restore(); }
    else ctx.drawImage(img, x - w / 2, y - h * .98, w, h);
    ctx.globalAlpha = 1;
  }

  // Water-dragon head facing +x, jaws open.
  function dragonHeadSpr() {
    return Kit().sprite('emz:dhead', 150, 110, g => {
      g.translate(40, 55); g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#0e3a66', B = '#3c9ae0', L = '#bfeaff';
      const fillPath = (build, fill, w = 3) => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = O; g.lineWidth = w; g.stroke(); };
      // horns swept back
      fillPath(() => { g.beginPath(); g.moveTo(10, -22); g.quadraticCurveTo(-18, -44, -40, -46); g.quadraticCurveTo(-16, -34, 0, -14); g.closePath(); }, L, 2.4);
      fillPath(() => { g.beginPath(); g.moveTo(4, -14); g.quadraticCurveTo(-24, -26, -38, -22); g.quadraticCurveTo(-18, -16, -2, -6); g.closePath(); }, '#8fd0f4', 2);
      // upper jaw + skull
      fillPath(() => { g.beginPath(); g.moveTo(-26, -8); g.quadraticCurveTo(-10, -30, 24, -26); g.quadraticCurveTo(70, -22, 102, -8); g.quadraticCurveTo(84, -2, 60, -4); g.lineTo(20, -2); g.quadraticCurveTo(-6, 4, -26, 10); g.closePath(); }, B);
      // lower jaw
      fillPath(() => { g.beginPath(); g.moveTo(-20, 10); g.quadraticCurveTo(10, 8, 30, 12); g.quadraticCurveTo(64, 20, 88, 30); g.quadraticCurveTo(56, 34, 24, 28); g.quadraticCurveTo(-6, 26, -22, 18); g.closePath(); }, '#2f80c8');
      // mouth interior
      g.fillStyle = '#0a2a52'; g.beginPath(); g.moveTo(20, -2); g.lineTo(60, -4); g.quadraticCurveTo(84, -2, 98, -6); g.lineTo(86, 28); g.quadraticCurveTo(56, 20, 30, 12); g.closePath(); g.fill();
      // fangs
      g.fillStyle = '#f4fcff';
      for (let i = 0; i < 6; i++) { const x = 30 + i * 11; g.beginPath(); g.moveTo(x, -3); g.lineTo(x + 4, 7); g.lineTo(x + 7, -3.4); g.fill(); g.beginPath(); g.moveTo(x - 2, 12 + i * 1.6); g.lineTo(x + 3, 3 + i * 1.4); g.lineTo(x + 6, 13 + i * 1.6); g.fill(); }
      // light along the snout, scale ridges
      g.strokeStyle = L; g.lineWidth = 3; g.beginPath(); g.moveTo(-8, -18); g.quadraticCurveTo(30, -26, 92, -11); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -20); g.quadraticCurveTo(30, -27, 70, -19); g.stroke();
      // eye
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(18, -15, 7, 4.2, -.2, 0, TAU); g.fill(); g.strokeStyle = O; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#0e3a66'; g.beginPath(); g.arc(20, -15, 2.2, 0, TAU); g.fill();
      // whiskers
      g.strokeStyle = O; g.lineWidth = 4.4;
      for (const [y0, cy, ey] of [[-8, -2, 10], [-4, 14, 26]]) { g.beginPath(); g.moveTo(80, y0); g.quadraticCurveTo(50, cy + 20, 6, ey + 18); g.stroke(); }
      g.strokeStyle = L; g.lineWidth = 2;
      for (const [y0, cy, ey] of [[-8, -2, 10], [-4, 14, 26]]) { g.beginPath(); g.moveTo(80, y0); g.quadraticCurveTo(50, cy + 20, 6, ey + 18); g.stroke(); }
      // mane fins at the back of the skull
      for (let i = 0; i < 4; i++) fillPath(() => { g.beginPath(); g.moveTo(-24 + i * 4, -6 + i * 6); g.lineTo(-40 - i * 2, -10 + i * 9); g.lineTo(-22 + i * 3, 2 + i * 6); g.closePath(); }, i % 2 ? '#8fd0f4' : L, 1.8);
    });
  }

  // The Steam Imp: a hulking giant of water wrapped in steam, armour-like chest, horned little head.
  function impSpr() {
    return Kit().sprite('emz:imp', 170, 210, g => {
      g.translate(85, 204); g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#173a58', BODY = '#a8daf0', SH = '#6aa8cc', HI = '#eefbff', PLATE = '#3d6e92';
      const cel = (build, fill, shade, w = 3.2) => {
        build(); g.fillStyle = fill; g.fill();
        if (shade) { g.save(); build(); g.clip(); g.fillStyle = shade; g.translate(-10, 6); build(); g.fill(); g.restore(); }
        build(); g.strokeStyle = O; g.lineWidth = w; g.stroke();
      };
      // legs: short, thick
      for (const sx of [-1, 1]) cel(() => { g.beginPath(); g.moveTo(sx * 16 - 14, -54); g.lineTo(sx * 18 + 14, -54); g.lineTo(sx * 22 + 16, -6); g.quadraticCurveTo(sx * 22, 2, sx * 22 - 18, -4); g.closePath(); }, sx < 0 ? SH : BODY, sx < 0 ? null : 'rgba(40,90,140,.25)');
      // far arm
      cel(() => { g.beginPath(); g.moveTo(-40, -150); g.quadraticCurveTo(-78, -120, -70, -60); g.quadraticCurveTo(-70, -36, -54, -30); g.quadraticCurveTo(-40, -40, -46, -66); g.quadraticCurveTo(-48, -110, -26, -128); g.closePath(); }, SH, null);
      // torso: a huge barrel
      cel(() => { g.beginPath(); g.moveTo(-46, -60); g.quadraticCurveTo(-64, -120, -40, -160); g.quadraticCurveTo(0, -186, 44, -160); g.quadraticCurveTo(66, -118, 48, -60); g.quadraticCurveTo(0, -42, -46, -60); g.closePath(); }, BODY, 'rgba(40,90,140,.3)', 3.6);
      // chest plate with seams
      cel(() => { g.beginPath(); g.moveTo(-30, -146); g.quadraticCurveTo(4, -160, 38, -144); g.quadraticCurveTo(44, -112, 30, -90); g.quadraticCurveTo(4, -80, -24, -92); g.quadraticCurveTo(-38, -116, -30, -146); g.closePath(); }, PLATE, 'rgba(10,30,60,.3)', 3);
      g.strokeStyle = 'rgba(200,240,255,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, -154); g.lineTo(4, -84); g.moveTo(-26, -118); g.quadraticCurveTo(4, -110, 38, -118); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-20, -144); g.quadraticCurveTo(4, -154, 30, -142); g.stroke();
      // belly: hot core glowing under the skin
      g.fillStyle = 'rgba(255,170,120,.35)'; g.beginPath(); g.ellipse(6, -72, 26, 12, 0, 0, TAU); g.fill();
      // steam vents on the shoulders
      for (const sx of [-1, 1]) cel(() => { g.beginPath(); g.ellipse(sx * 36 + 4, -160, 12, 7, sx * .4, 0, TAU); }, '#2c5878', null, 2.4);
      // head: small, round, two horns
      cel(() => { g.beginPath(); g.moveTo(-6, -170); g.lineTo(-18, -200); g.lineTo(2, -178); g.closePath(); }, HI, null, 2.4);
      cel(() => { g.beginPath(); g.moveTo(18, -172); g.lineTo(30, -202); g.lineTo(28, -174); g.closePath(); }, HI, null, 2.4);
      cel(() => { g.beginPath(); g.ellipse(10, -168, 22, 18, 0, 0, TAU); }, BODY, 'rgba(40,90,140,.3)', 3);
      // eyes and grin
      g.fillStyle = '#fff6c8'; for (const ex of [6, 22]) { g.beginPath(); g.ellipse(ex, -172, 4.6, 3, 0, 0, TAU); g.fill(); }
      g.strokeStyle = O; g.lineWidth = 1.6; for (const ex of [6, 22]) { g.beginPath(); g.ellipse(ex, -172, 4.6, 3, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#163050'; g.beginPath(); g.moveTo(0, -160); g.quadraticCurveTo(14, -150, 30, -161); g.quadraticCurveTo(14, -156, 0, -160); g.fill();
      g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(4 + i * 6, -159); g.lineTo(6 + i * 6, -155); g.lineTo(8 + i * 6, -159); g.fill(); }
      // near arm: massive, knuckles near the ground
      cel(() => { g.beginPath(); g.moveTo(34, -152); g.quadraticCurveTo(84, -132, 82, -70); g.quadraticCurveTo(84, -34, 64, -24); g.quadraticCurveTo(42, -30, 50, -66); g.quadraticCurveTo(52, -110, 30, -124); g.closePath(); }, BODY, 'rgba(40,90,140,.3)');
      cel(() => { g.beginPath(); g.ellipse(66, -26, 20, 16, 0, 0, TAU); }, BODY, 'rgba(40,90,140,.28)');
      // water highlights
      g.strokeStyle = HI; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(-36, -134); g.quadraticCurveTo(-44, -110, -38, -84); g.stroke();
      g.beginPath(); g.moveTo(58, -128); g.quadraticCurveTo(70, -104, 68, -76); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(2, -174, 6, 3, -.4, 0, TAU); g.fill();
    });
  }

  // The giant clam: lower shell and the hinged top shell (both fans with ridges).
  // Side view, hinge at the back (-x), lip line at y = 0 of each half. Bottom canvas: lip at y = 12;
  // top canvas: lip at y = 128. Ridges fan out from the hinge (umbo) with growth rings round it.
  function clamSpr(top) {
    return Kit().sprite('emz:clam' + (top ? 't' : 'b'), 250, top ? 140 : 84, g => {
      g.translate(125, top ? 128 : 12); g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#43222c', s = top ? -1 : 1, H = top ? 104 : 62;
      const shell = () => {
        g.beginPath(); g.moveTo(-112, 0);
        g.bezierCurveTo(-118, s * H * .7, -40, s * H * 1.08, 30, s * H * .92);
        g.bezierCurveTo(90, s * H * .76, 118, s * H * .3, 114, 0);
        // wavy lip
        for (let i = 1; i <= 9; i++) g.quadraticCurveTo(114 - i * 25.1 + 12.5, s * (i % 2 ? 7 : -3), 114 - i * 25.1, 0);
        g.closePath();
      };
      shell(); g.fillStyle = top ? '#f2d6cc' : '#dcb8b0'; g.fill();
      g.save(); shell(); g.clip();
      // cel shadow away from the light, bright band along the crown
      g.fillStyle = 'rgba(110,50,80,.28)'; g.beginPath(); g.ellipse(-30, s * H * .9, 150, H * .55, 0, 0, TAU); g.fill();
      if (top) { g.fillStyle = 'rgba(255,250,246,.5)'; g.beginPath(); g.ellipse(10, -H * .78, 70, 10, -.08, 0, TAU); g.fill(); }
      for (let i = 0; i < 12; i++) {
        const a = (i + .5) / 12 * Math.PI * .5, ex = -112 + Math.cos(a) * 260, ey = s * Math.sin(a) * H * 1.5;
        g.strokeStyle = 'rgba(100,46,60,.5)'; g.lineWidth = 4; g.beginPath(); g.moveTo(-104, s * 4); g.lineTo(ex, ey); g.stroke();
        g.strokeStyle = 'rgba(255,246,240,.65)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-102, s * 2); g.lineTo(ex + 3, ey - s * 3); g.stroke();
      }
      for (let k = 1; k <= 4; k++) { g.strokeStyle = 'rgba(110,56,70,.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(-112, 0, 60 * k, H * .3 * k, 0, top ? Math.PI * 1.5 : 0, top ? TAU : Math.PI * .5); g.stroke(); }
      g.restore();
      shell(); g.strokeStyle = O; g.lineWidth = 4.5; g.stroke();
      // the umbo knob at the hinge
      g.fillStyle = '#c99a90'; g.beginPath(); g.ellipse(-106, s * 6, 12, 9, 0, 0, TAU); g.fill(); g.strokeStyle = O; g.lineWidth = 3; g.stroke();
    });
  }

  // Yagura curled in a spiked shell (Isobu's armour).
  function shellSpr() {
    return Kit().sprite('emz:shell', 130, 130, g => {
      g.translate(65, 65); g.lineJoin = 'round';
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12, ca = Math.cos(a), sa = Math.sin(a), nx = -sa * 7, ny = ca * 7;
        g.beginPath(); g.moveTo(ca * 38 + nx, sa * 38 + ny); g.lineTo(ca * 62, sa * 62); g.lineTo(ca * 38 - nx, sa * 38 - ny); g.closePath();
        g.fillStyle = '#f1e8d0'; g.fill(); g.strokeStyle = '#162424'; g.lineWidth = 2; g.stroke();
        g.fillStyle = 'rgba(150,130,120,.45)'; g.beginPath(); g.moveTo(ca * 38, sa * 38); g.lineTo(ca * 62, sa * 62); g.lineTo(ca * 38 - nx, sa * 38 - ny); g.fill();
      }
      g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fillStyle = '#5f807c'; g.fill();
      g.fillStyle = 'rgba(30,50,60,.4)'; g.beginPath(); g.arc(8, 9, 40, 0, TAU); g.fill();
      g.fillStyle = 'rgba(230,255,246,.35)'; g.beginPath(); g.arc(-12, -14, 22, 0, TAU); g.fill();
      g.strokeStyle = '#3c5a57'; g.lineWidth = 2.6;
      for (const [x, y, r] of [[0, 0, 13], [-22, -10, 10], [19, -16, 9.5], [16, 20, 10], [-17, 20, 9.5], [0, -29, 8]]) {
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.stroke();
      }
      g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.strokeStyle = '#162424'; g.lineWidth = 3; g.stroke();
    });
  }

  // A tinted copy of a character sprite (mirror reflection / mirage), feet at (w/2, h-6).
  function tintSpr(id, frame, facing, tint) {
    return Kit().sprite('emz:t:' + id + frame + facing + tint, 170, 170, g => {
      const S = Spr();
      if (!S) return;
      S.draw(g, id, 85, 164, { facing, frame });
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = tint; g.fillRect(0, 0, 170, 170);
      // horizontal shimmer bands
      g.fillStyle = 'rgba(255,255,255,.22)';
      for (let y = 6; y < 170; y += 9) g.fillRect(0, y, 170, 2);
      g.globalCompositeOperation = 'source-over';
    });
  }
  function drawTint(ctx, id, frame, facing, tint, x, y, alpha, wob = 0) {
    const img = tintSpr(id, frame, facing, tint);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - 85 + wob, y - 164, 170, 170);
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ drawing primitives
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(10,26,46,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(10,26,50,.45)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 1.8 : faint ? 2 : 3;
    ctx.stroke();
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
  function markLine(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.fillStyle = `rgba(10,26,46,${s.faint ? .08 : .16})`; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${(s.faint ? .08 : .14) + .16 * k})`; ctx.fillRect(0, -s.w, s.len * clamp01(k), s.w * 2);
    ctx.strokeStyle = 'rgba(10,26,50,.45)'; ctx.lineWidth = s.faint ? 3.5 : 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = s.faint ? 1.8 : 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  function markCone(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2, L = s.len, h = s.half;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    const wedge = r => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -h, h); ctx.closePath(); };
    wedge(L); ctx.fillStyle = 'rgba(10,26,46,.13)'; ctx.fill();
    wedge(L * clamp01(k)); ctx.fillStyle = `rgba(${rgb},${.1 + .16 * k})`; ctx.fill();
    wedge(L); ctx.strokeStyle = 'rgba(10,26,50,.45)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ph = frac(time * 1.6 + i / 5), r = 40 + ph * (L - 50);
      ctx.moveTo(Math.cos(-h * .85) * r, Math.sin(-h * .85) * r); ctx.arc(0, 0, r, -h * .85, h * .85);
    }
    ctx.stroke();
    ctx.restore();
  }
  function curvePath(ctx, p, u0 = 0, u1 = 1) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const [x, y] = bez(p, lerp(u0, u1, i / 24)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  }
  function markCurve(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    curvePath(ctx, s.p); ctx.strokeStyle = 'rgba(10,26,46,.14)'; ctx.lineWidth = s.w * 2; ctx.stroke();
    curvePath(ctx, s.p, 0, clamp01(k)); ctx.strokeStyle = `rgba(${rgb},${.12 + .16 * k})`; ctx.lineWidth = s.w * 2; ctx.stroke();
    curvePath(ctx, s.p); ctx.strokeStyle = 'rgba(10,26,50,.4)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.4; ctx.stroke();
    // chevrons racing along the path
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const u = frac(time * .9 + i / 6), [x, y] = bez(s.p, u), [x2, y2] = bez(s.p, Math.min(1, u + .01)), a = Math.atan2(y2 - y, x2 - x);
      ctx.moveTo(x - Math.cos(a - .6) * 16, y - Math.sin(a - .6) * 16); ctx.lineTo(x, y); ctx.lineTo(x - Math.cos(a + .6) * 16, y - Math.sin(a + .6) * 16);
    }
    ctx.stroke();
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
        ctx.lineTo(x + Math.cos(b) * d, y + Math.sin(b) * d * .5);
      }
    }
    ctx.stroke();
  }
  // Wet ground: a dark-blue stain with a light rim.
  function wet(ctx, x, y, r, alpha, seed = 0) {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(30,70,110,${.28 * alpha})`;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) { const a = i * TAU / 14, rr = r * (.82 + hash(seed + i * 1.3) * .3); if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .5); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .5); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(190,235,255,${.35 * alpha})`; ctx.lineWidth = 2; ctx.stroke();
  }
  function waterRing(ctx, x, y, r, alpha, w = 6) {
    if (alpha <= .01 || r < 2) return;
    ctx.strokeStyle = `rgba(12,44,92,${.5 * alpha})`; ctx.lineWidth = w * 1.6; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(140,215,255,${.85 * alpha})`; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.8 * alpha})`; ctx.lineWidth = Math.max(1, w * .3); ctx.stroke();
  }
  // Crown splash: droplets flung outward and up, then falling. k: 0..1 progress.
  function splash(ctx, x, y, r, k, seed, n = 14, alpha = 1) {
    if (k <= 0 || k >= 1 || alpha <= .01) return;
    const K = Kit(), wp = waterPuff(), drop = dropSpr();
    const a0 = 1 - k;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(seed + i) * .4, sp = r * (.55 + hash(seed + i * 3.1) * .55);
      const dx = Math.cos(an) * sp * easeOut(k), dy = Math.sin(an) * sp * .5 * easeOut(k);
      const up = (hash(seed + i * 7.7) * .6 + .5) * r * .9 * bell(k);
      const px = x + dx, py = y + dy - up, sz = (6 + hash(seed + i * 2.2) * 8) * (1 - k * .5);
      const va = Math.atan2(-(r * 1.8) * Math.cos(Math.PI * k) + 1, Math.cos(an) * sp);
      ctx.save(); ctx.translate(px, py); ctx.rotate(va); ctx.globalAlpha = alpha * Math.min(1, a0 * 1.8); ctx.drawImage(drop, -sz, -sz * .45, sz * 2, sz * .9); ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      const an = i * TAU / 5 + seed, d = r * .35 * easeOut(k);
      K.stamp(ctx, wp, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 10 - r * .25 * bell(k), r * .22 * (1 - k * .4), alpha * a0 * .8, .8);
    }
  }
  function steamCloud(ctx, x, y, r, n, alpha, time, seed, rise = 1) {
    if (alpha <= .01) return;
    const K = Kit(), puff = steamPuff();
    for (let i = 0; i < n; i++) {
      const ph = frac(time * .35 * rise + hash(seed + i)), an = hash(seed + i * 2.7) * TAU, d = r * Math.sqrt(hash(seed + i * 5.3));
      K.stamp(ctx, puff, x + Math.cos(an) * d + Math.sin(time + i) * 8, y + Math.sin(an) * d * .5 - ph * r * .5 * rise - 10, r * (.22 + hash(seed + i * 1.9) * .14) * (.8 + ph * .5), alpha * bell(ph) * .75, .8);
    }
  }

  // ------------------------------------------------------------------ effect painters [ground, overlay]
  function gunG(ctx, fx, time) {
    for (const b of fx.shots) {
      const u = fx.age - b.t0, c = Math.cos(b.a), s = Math.sin(b.a);
      if (u < 0) {
        // the aim line flashes just before each shot
        const k = 1 + u / GUN_LEAD;
        if (k <= 0) continue;
        ctx.strokeStyle = 'rgba(10,30,60,.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x0 + c * GUN_LEN, b.y0 + s * GUN_LEN); ctx.stroke();
        ctx.strokeStyle = `rgba(160,225,255,${.4 + .5 * k})`; ctx.lineWidth = 2; ctx.stroke();
        continue;
      }
      const d = b.de >= 0 ? b.end : Math.min(GUN_LEN, u * GUN_SPEED);
      if (b.de < 0) { ctx.fillStyle = 'rgba(10,30,60,.25)'; ctx.beginPath(); ctx.ellipse(b.x0 + c * d, b.y0 + s * d, 16, 6, 0, 0, TAU); ctx.fill(); }
      else {
        const k = (fx.age - b.de) / 1.6;
        wet(ctx, b.x0 + c * b.end, b.y0 + s * b.end, 40, 1 - k, b.a * 10);
        if (k < .4) waterRing(ctx, b.x0 + c * b.end, b.y0 + s * b.end, 20 + 70 * easeOut(k / .4), 1 - k / .4, 3);
      }
    }
  }
  function gunO(ctx, fx, time) {
    const lift = 38, drop = dropSpr(), K = Kit();
    for (const b of fx.shots) {
      const u = fx.age - b.t0;
      if (u < 0) continue;
      const c = Math.cos(b.a), s = Math.sin(b.a);
      if (b.de < 0) {
        const d = Math.min(GUN_LEN, u * GUN_SPEED), hx = b.x0 + c * d, hy = b.y0 + s * d - lift, tl = Math.min(d, 200);
        ctx.beginPath(); ctx.moveTo(hx - c * tl, hy - s * tl); ctx.lineTo(hx, hy); waterStroke(ctx, 7, .85);
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(b.a); ctx.drawImage(drop, -30, -11, 60, 22); ctx.restore();
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 26, '150,220,255', .45); ctx.globalCompositeOperation = 'source-over';
        // spray flicked off the trail
        for (let i = 0; i < 4; i++) { const q = hash(b.t0 * 50 + i + Math.floor(time * 20)), dd = tl * q; ctx.fillStyle = 'rgba(200,240,255,.85)'; ctx.beginPath(); ctx.arc(hx - c * dd + (q - .5) * 18, hy - s * dd + (hash(i + q) - .5) * 14, 2.2, 0, TAU); ctx.fill(); }
        // muzzle ring at the fingertip while it leaves
        if (u < .12) waterRing(ctx, b.x0 + c * 10, b.y0 + s * 10 - lift, 8 + 90 * u, 1 - u / .12, 3);
      } else {
        const k = (fx.age - b.de) / .5;
        if (k < 1) splash(ctx, b.x0 + c * b.end, b.y0 + s * b.end, 60, k, b.t0 * 31, 10);
      }
    }
  }

  function punchG(ctx, fx, time) {
    const k = fx.age / fx.dur, c = Math.cos(fx.a), s = Math.sin(fx.a);
    for (let i = 0; i < 3; i++) wet(ctx, fx.x + c * (90 + i * 90), fx.y + s * (90 + i * 90), 70 + i * 26, 1 - k, fx.seed + i);
    cracks(ctx, fx.x + c * 60, fx.y + s * 60, 140, 9, fx.seed, 1 - k, 3);
  }
  function punchO(ctx, fx, time) {
    const K = Kit(), t = fx.age, c = Math.cos(fx.a), s = Math.sin(fx.a), f = c >= 0 ? 1 : -1;
    // the swollen water arm: shoots out, hangs, sloshes back
    const ext = t < .12 ? easeOut(t / .12) : t < .4 ? 1 : 1 - easeIn((t - .4) / .35);
    if (ext > 0) {
      const sx = fx.x + f * 6, sy = fx.y - LIFT() - 14, L = 40 + 150 * ext, ex = sx + c * L, ey = sy + s * L * .6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); waterStroke(ctx, 30 + 10 * ext, .95);
      const fr = 30 + 16 * ext;
      ctx.drawImage(waterSphere(), ex - fr, ey - fr, fr * 2, fr * 2);
      ctx.strokeStyle = 'rgba(12,44,92,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey, fr, 0, TAU); ctx.stroke();
      // knuckle ridges
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(ex + c * fr * .4, ey + i * fr * .3, fr * .3, -1, 1); ctx.stroke(); }
    }
    // the cone of water thrown forward by the blow
    if (t < .9) {
      const k = t / .9;
      for (let i = 0; i < 4; i++) {
        const r = 40 + (ARM_CONE + 40) * easeOut(clamp01(k * 1.3 - i * .08));
        ctx.save(); ctx.translate(fx.x, fx.y - 20); ctx.rotate(fx.a); ctx.scale(1, .7);
        ctx.beginPath(); ctx.arc(0, 0, r, -ARM_HALF * .9, ARM_HALF * .9); waterStroke(ctx, 10 - i * 2, (1 - k) * (1 - i * .18));
        ctx.restore();
      }
      splash(ctx, fx.x + c * 170, fx.y + s * 170, 150, k, fx.seed, 16);
    }
  }

  function meltG(ctx, fx, time) {
    const k = fx.age / fx.dur;
    wet(ctx, fx.x, fx.y, 60 + 40 * easeOut(k), 1 - k, fx.seed);
    waterRing(ctx, fx.x, fx.y, 20 + 90 * easeOut(k), 1 - k, 4);
  }
  function meltO(ctx, fx, time) {
    const k = fx.age / fx.dur;
    splash(ctx, fx.x, fx.y - (fx.dodge ? 40 : 10), fx.dodge ? 80 : 60, Math.min(.99, k * 1.4), fx.seed, fx.dodge ? 14 : 10);
    if (fx.dodge && k < .5) {
      // the body itself turned to water for an instant: a translucent splash shell over him
      ctx.globalAlpha = (1 - k * 2) * .7;
      ctx.drawImage(waterSphere(), fx.x - 34, fx.y - 96, 68, 96);
      ctx.globalAlpha = 1;
    }
  }
  function geyserG(ctx, fx, time) {
    const k = fx.age / fx.dur;
    wet(ctx, fx.x, fx.y, HYD_R * (.7 + .3 * easeOut(k)), 1 - k * .8, fx.seed);
    cracks(ctx, fx.x, fx.y, HYD_R, 10, fx.seed, 1 - k);
    const rk = fx.age / .55;
    if (rk < 1) waterRing(ctx, fx.x, fx.y, HYD_R * .6 + (HYD_RING - HYD_R * .6) * easeOut(rk), 1 - rk, 9);
  }
  function geyserO(ctx, fx, time) {
    const k = fx.age / fx.dur, h = 220 * bell(Math.min(1, fx.age / .9)), w = 46 * (1 - k * .4);
    if (h > 4) {
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + Math.sin(time * 9) * 6, fx.y - h); waterStroke(ctx, w, Math.min(1, (1 - k) * 2));
      ctx.drawImage(waterPuff(), fx.x - w * 1.2, fx.y - h - w * .9, w * 2.4, w * 1.8);
    }
    splash(ctx, fx.x, fx.y - h * .6, 140, Math.min(.99, fx.age / 1.2), fx.seed, 18);
  }
  function puddleDraw(ctx, z, st, time) {
    const pd = st.puddle, k = clamp01(pd.t / HYD_T);
    // a wet streak where the puddle has been
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(30,70,110,.25)'; ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(pd.x0, pd.y0); ctx.lineTo(z.x, z.y); ctx.stroke();
    const r = 46 + 6 * Math.sin(time * 14);
    ctx.fillStyle = 'rgba(12,44,92,.45)'; ctx.beginPath(); ctx.ellipse(z.x, z.y, r + 6, (r + 6) * .45, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(80,170,230,.8)'; ctx.beginPath(); ctx.ellipse(z.x, z.y, r, r * .42, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(220,250,255,.7)'; ctx.beginPath(); ctx.ellipse(z.x - 10, z.y - 5, r * .45, r * .12, -.1, 0, TAU); ctx.fill();
    for (let i = 0; i < 2; i++) waterRing(ctx, z.x, z.y, r * (.3 + frac(time * 2 + i * .5) * .9), 1 - frac(time * 2 + i * .5), 2);
    // telegraph of the eruption
    markCircle(ctx, pd.x1, pd.y1, HYD_R, MOVES.hydro.rgb, k, time, false);
  }

  function clamG(ctx, fx, time) {
    const k = fx.age / fx.dur;
    ctx.fillStyle = 'rgba(20,30,50,.16)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 6, 120, 30, 0, 0, TAU); ctx.fill();
    wet(ctx, fx.x, fx.y + 4, 150, Math.min(1, (1 - k) * 3), fx.seed);
  }
  function clamO(ctx, fx, time) {
    const K = Kit(), t = fx.age, k = t / fx.dur;
    const rise = t < .4 ? easeBack(t / .4) : t > fx.dur - .6 ? 1 - easeIn((t - fx.dur + .6) / .6) : 1;
    if (rise <= .02) return;
    const open = t < .4 ? 0 : t < .8 ? easeOut((t - .4) / .4) : t > fx.dur - 1 ? 1 - easeOut((t - fx.dur + 1) / .5) : 1;
    const s = rise * .95, x = fx.x, y = fx.y - 40;
    // summon smoke
    if (t < .5) for (let i = 0; i < 7; i++) K.stamp(ctx, steamPuff(), x + (i - 3) * 34, y - hash(i) * 30 - t * 60, 40 + t * 50, (1 - t / .5) * .9, .8);
    ctx.save(); ctx.translate(x, y); ctx.scale(s * fx.f, s);
    ctx.drawImage(clamSpr(false), -125, -12, 250, 84);
    if (open > .05) {
      // the soft pink mantle and a glowing pearl between the shells
      ctx.fillStyle = '#e88aa6'; ctx.strokeStyle = '#43222c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-104, 0); ctx.quadraticCurveTo(0, -70 * open, 110, -8 * open); ctx.quadraticCurveTo(0, 14, -104, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff4fa'; ctx.beginPath(); ctx.arc(40, -16 * open, 10 * open, 0, TAU); ctx.fill(); ctx.stroke();
    }
    // the shell lid hinged at the back
    ctx.save(); ctx.translate(-110, 0); ctx.rotate(-open * .62); ctx.translate(110, 0); ctx.drawImage(clamSpr(true), -125, -128, 250, 140); ctx.restore();
    ctx.restore();
    if (open > .1) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y - 30, 90, '255,200,230', .3 * open);
      ctx.globalCompositeOperation = 'source-over';
      steamCloud(ctx, x, y - 40, 260, 12, open * .8 * (1 - k * .5), time, fx.seed, 1.4);
    }
  }
  function mirageG(ctx, fx, time) {
    for (const c of fx.copies) {
      const u = fx.age - c.t0, ca = Math.cos(c.a), sa = Math.sin(c.a);
      if (u < 0) continue;
      if (!c.fired) {
        const k = clamp01((fx.age - c.t0) / (c.tf - c.t0));
        markLine(ctx, { x: c.x, y: c.y, a: c.a, len: CLAM_LEN, w: CLAM_W }, MOVES.gun.rgb, k, time);
      } else {
        const k = (fx.age - c.tf) / 1.2;
        if (k < 1) { ctx.strokeStyle = `rgba(30,70,110,${.3 * (1 - k)})`; ctx.lineWidth = CLAM_W * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + ca * CLAM_LEN, c.y + sa * CLAM_LEN); ctx.stroke(); }
      }
      ctx.fillStyle = 'rgba(20,30,50,.18)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 3, 22, 7, 0, 0, TAU); ctx.fill();
    }
  }
  function mirageO(ctx, fx, time) {
    for (let i = 0; i < fx.copies.length; i++) {
      const c = fx.copies[i], u = fx.age - c.t0;
      if (u < 0) continue;
      const fade = c.fired ? 1 - clamp01((fx.age - c.tf - .25) / .4) : Math.min(1, u / .3);
      if (fade <= 0) continue;
      const f = Math.cos(c.a) >= 0 ? 1 : -1, wob = Math.sin(time * 7 + i * 2) * 3;
      const frame = fx.age > c.tf - .45 ? 'attack' : 'seal';
      // heat-haze copies: two shimmering layers slightly apart
      drawTint(ctx, 'gengetsu', frame, f, 'rgba(255,225,245,.22)', c.x, c.y + 3, .82 * fade, wob);
      drawTint(ctx, 'gengetsu', frame, f, 'rgba(170,220,255,.5)', c.x, c.y + 3, .32 * fade, -wob * 2.2);
      if (c.fired) {
        const k = (fx.age - c.tf) / .35;
        if (k < 1) {
          const ca = Math.cos(c.a), sa = Math.sin(c.a), x0 = c.x + ca * 24, y0 = c.y - 44, L = CLAM_LEN * easeOut(Math.min(1, k * 3));
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + ca * L, y0 + sa * L + 30 * Math.min(1, k * 3)); waterStroke(ctx, 16 * (1 - k * .6), 1 - k * .5);
          splash(ctx, c.x + ca * CLAM_LEN, c.y + sa * CLAM_LEN, 70, Math.min(.99, k), c.t0 * 40, 10);
        }
      } else if (fx.age > c.tf - .45) {
        const ca = Math.cos(c.a), x0 = c.x + ca * 24, y0 = c.y - 44, q = (fx.age - c.tf + .45) / .45;
        ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, x0, y0, 8 + 14 * q, '150,220,255', .9, true); ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function impScale(m) { return m.fz && m.fuse > 0 ? 1 + .22 * easeIn(m.fuse / IMP_FUSE) : 1; }
  function impG(ctx, fx, time) {
    const army = fx.army, R0 = army ? ARMY_BLAST : IMP_R;
    for (const m of fx.imps) {
      if (m.boom >= 0) {
        const k = (fx.age - m.boom) / 3;
        if (k < 1) {
          ctx.globalAlpha = (1 - k) * .45;
          ctx.fillStyle = '#5a5a5e'; ctx.beginPath(); ctx.ellipse(m.x, m.y, R0 * .55, R0 * .27, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2c2a30'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 3, R0 * .4, R0 * .19, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          wet(ctx, m.x, m.y, R0 * .9, 1 - k, m.x);
          cracks(ctx, m.x, m.y, R0 * .9, 10, m.y, 1 - k, 3);
        }
        continue;
      }
      if (m.t < 0) continue;
      ctx.fillStyle = 'rgba(16,24,40,.25)'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 3, 60, 18, 0, 0, TAU); ctx.fill();
      if (m.fz && m.fuse >= 0) markCircle(ctx, m.x, m.y, R0, MOVES.imp.rgb, m.fuse / IMP_FUSE, time, false);
      else if (army) markCircle(ctx, m.x, m.y, R0, MOVES.imp.rgb, 0, time, true);
    }
    if (army) {
      if (fx.core < 0 && fx.imps.some(m => m.fz)) markCircle(ctx, fx.cx, fx.cy, ARMY_CORE, '255,240,220', .5 + .5 * Math.sin(time * 12), time, false);
      if (fx.core >= 0) {
        const k = (fx.age - fx.core) / 3.5;
        if (k < 1) { wet(ctx, fx.cx, fx.cy, ARMY_CORE, 1 - k, 7); cracks(ctx, fx.cx, fx.cy, ARMY_CORE * 1.1, 14, 3.3, 1 - k, 4); }
      }
    }
  }
  function blast(ctx, x, y, r, k, seed, hot) {
    // steam explosion: white dome, shock ring, droplets, rolling steam
    const K = Kit();
    if (k < .35) {
      const q = k / .35;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y - r * .3, r * (.6 + .7 * q), hot ? '255,220,190' : '220,240,255', (1 - q) * .9, true);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = (1 - q) * .85;
      ctx.fillStyle = '#f6fbff'; ctx.beginPath(); ctx.ellipse(x, y - r * .2, r * (.4 + .6 * easeOut(q)), r * (.3 + .45 * easeOut(q)), 0, Math.PI, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (k < .6) waterRing(ctx, x, y, r * (.3 + .9 * easeOut(k / .6)), 1 - k / .6, 10);
    splash(ctx, x, y, r * .8, Math.min(.99, k * 1.4), seed, 16);
    steamCloud(ctx, x, y, r * .9, 14, 1 - k, k * 3 + seed, seed, 1.6);
  }
  function impO(ctx, fx, time) {
    const K = Kit(), img = impSpr(), army = fx.army;
    for (let i = 0; i < fx.imps.length; i++) {
      const m = fx.imps[i];
      if (m.boom >= 0) {
        const k = (fx.age - m.boom) / 1.4;
        if (k < 1) blast(ctx, m.x, m.y, army ? ARMY_BLAST : IMP_R, k, i * 7 + 3, true);
        const sk = (fx.age - m.boom) / 2.4;
        if (sk < 1) steamCloud(ctx, m.x, m.y, army ? 170 : 200, 8, (1 - sk) * .8, time, i * 3 + 1, .8);
        continue;
      }
      const born = m.t < 0 ? 0 : Math.min(1, m.t / .45);
      if (born <= 0) continue;
      const f = Math.cos(m.a) >= 0 ? 1 : -1, sc = impScale(m) * (.4 + .6 * easeBack(born)) * (army ? .82 : 1);
      const walk = m.fz ? 0 : Math.sin(m.t * 7 + i), bob = Math.abs(walk) * 4;
      const shake = m.fz && m.fuse > 0 ? Math.sin(time * 70) * 3 * m.fuse : 0;
      // rising from a puddle
      if (born < 1) { waterRing(ctx, m.x, m.y, 40 + 50 * born, 1 - born, 5); }
      ctx.save(); ctx.translate(m.x + shake, m.y + 2 - bob); ctx.scale(f * sc, sc);
      ctx.rotate(walk * .04);
      ctx.drawImage(img, -85, -204, 170, 210);
      ctx.restore();
      // steam pouring off the shoulders and head
      for (let j = 0; j < 4; j++) {
        const ph = frac(time * 1.3 + j / 4 + i * .3);
        K.stamp(ctx, steamPuff(), m.x + f * (j % 2 ? 32 : -26) * sc + Math.sin(time * 3 + j) * 6, m.y - 168 * sc - ph * 60, 14 + 22 * ph, bell(ph) * .75, .8);
      }
      // the pressure inside: belly and seams glowing hot before it bursts
      if (m.fz && m.fuse > 0) {
        const q = clamp01(m.fuse / IMP_FUSE), fl = .7 + .3 * Math.sin(time * 40);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, m.x + f * 6 * sc, m.y - 90 * sc, 70 * sc * (.6 + q), '255,150,90', q * fl * .9);
        K.glow(ctx, m.x, m.y - 110 * sc, 40 * sc, '255,240,220', q * fl, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (army && fx.core >= 0) {
      const k = (fx.age - fx.core) / 1.8;
      if (k < 1) blast(ctx, fx.cx, fx.cy, ARMY_CORE, k, 11, false);
    }
  }

  function sweepG(ctx, fx, time) {
    const k = fx.age / fx.dur;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a); ctx.scale(1, .55);
    ctx.fillStyle = `rgba(30,70,110,${.22 * (1 - k)})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, HOOK_CONE, -HOOK_HALF, HOOK_HALF); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function sweepO(ctx, fx, time) {
    const k = fx.age / fx.dur;
    if (k >= 1) return;
    // a crescent of water chakra following the hook's arc
    const sw = easeOut(Math.min(1, k * 2.4)), a0 = -HOOK_HALF * 1.1, a1 = a0 + HOOK_HALF * 2.2 * sw;
    ctx.save(); ctx.translate(fx.x, fx.y - 26); ctx.rotate(fx.a); ctx.scale(1, .62);
    for (const [r, w] of [[HOOK_CONE * .95, 16], [HOOK_CONE * .78, 10], [HOOK_CONE * .6, 6]]) {
      ctx.beginPath(); ctx.arc(0, 0, r, Math.max(a0, a1 - 1.3), a1); waterStroke(ctx, w * (1 - k * .5), 1 - k);
    }
    ctx.restore();
    const ex = fx.x + Math.cos(fx.a + a1) * HOOK_CONE * .9, ey = fx.y + Math.sin(fx.a + a1) * HOOK_CONE * .5 - 26;
    if (k < .5) splash(ctx, ex, ey + 26, 60, k * 2, fx.seed, 8);
  }
  function hookxG(ctx, fx, time) {
    const out = fx.age < .22 ? easeOut(fx.age / .22) : fx.age < .4 ? 1 : 1 - easeInOut((fx.age - .4) / .3);
    const c = Math.cos(fx.a), s = Math.sin(fx.a), L = HOOK_LEN * out;
    ctx.fillStyle = 'rgba(16,24,40,.2)'; ctx.beginPath(); ctx.ellipse(fx.x0 + c * L, fx.y0 + s * L, 24, 8, 0, 0, TAU); ctx.fill();
  }
  function hookxO(ctx, fx, time) {
    const out = fx.age < .22 ? easeOut(fx.age / .22) : fx.age < .4 ? 1 : 1 - easeInOut((fx.age - .4) / .3);
    if (out <= .01) return;
    const c = Math.cos(fx.a), s = Math.sin(fx.a), L = HOOK_LEN * out, lift = 46, f = c >= 0 ? 1 : -1;
    const x0 = fx.x0 + f * 20, y0 = fx.y0 - lift, x1 = fx.x0 + c * L, y1 = fx.y0 + s * L - lift;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 30 * out, x1, y1); waterStroke(ctx, 9, .95);
    // the hook head: a big green crook of chakra
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(fx.a + Math.PI / 2 * f * .2); ctx.scale(f, 1);
    const crook = () => { ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(6, 0); ctx.arc(18, -10, 16, Math.PI * .8, Math.PI * 2.1); ctx.quadraticCurveTo(36, 16, 26, 24); };
    crook(); ctx.lineCap = 'round'; ctx.strokeStyle = '#102418'; ctx.lineWidth = 11; ctx.stroke();
    crook(); ctx.strokeStyle = '#4c9a5c'; ctx.lineWidth = 7; ctx.stroke();
    crook(); ctx.strokeStyle = 'rgba(210,255,220,.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, x1, y1, 40, '120,255,200', .5); ctx.globalCompositeOperation = 'source-over';
    if (fx.age > .2 && fx.age < .5) splash(ctx, x1, y1 + lift, 70, (fx.age - .2) / .3, fx.seed, 8);
  }

  function mirrorPos(fx) {
    const t = fx.age;
    if (t < .45) return { x: fx.mx, y: fx.my, k: 0 };
    const k = easeIn(clamp01((t - .45) / .4));
    return { x: lerp(fx.mx, fx.tx, k), y: lerp(fx.my, fx.ty, k), k };
  }
  function mirrorG(ctx, fx, time) {
    const t = fx.age;
    if (t < 1.1) { ctx.fillStyle = 'rgba(30,80,130,.3)'; ctx.beginPath(); ctx.ellipse(fx.mx, fx.my + 4, 60, 16, 0, 0, TAU); ctx.fill(); }
    if (!fx.hit) markCircle(ctx, fx.tx, fx.ty, MIR_BLAST, MOVES.mirror.rgb, clamp01(t / .85), time, false);
    else {
      const k = (t - .85) / 1.5;
      wet(ctx, fx.tx, fx.ty, MIR_BLAST, 1 - k, fx.seed); cracks(ctx, fx.tx, fx.ty, MIR_BLAST, 9, fx.seed, 1 - k);
      ctx.strokeStyle = `rgba(30,70,110,${.25 * (1 - k)})`; ctx.lineWidth = 40; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(fx.mx, fx.my); ctx.lineTo(fx.tx, fx.ty); ctx.stroke();
    }
  }
  function mirrorO(ctx, fx, time) {
    const K = Kit(), t = fx.age, f = Math.cos(fx.a) >= 0 ? 1 : -1;
    const mx = fx.mx, my = fx.my, W = 54, H = 96;
    // the mirror: a tall oval of standing water, shattering after the copy leaves
    if (t < 1.0) {
      const grow = Math.min(1, t / .2 + .6);
      ctx.save(); ctx.translate(mx, my - H * grow - 4);
      ctx.beginPath(); ctx.ellipse(0, 0, W * grow, H * grow, 0, 0, TAU);
      ctx.fillStyle = 'rgba(12,44,92,.55)'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(120,200,250,.55)'; ctx.fillRect(-W, -H, W * 2, H * 2);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-W * .3, -H * .35, W * .35, H * .5, .3, 0, TAU); ctx.fill();
      // the reflection of the target inside, until it steps out
      if (t < .5) drawTint(ctx, 'naruto', 'idle', -f, 'rgba(60,150,230,.45)', 0, H * .8, .9);
      ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = '#0e3a66'; ctx.beginPath(); ctx.ellipse(0, 0, W * grow, H * grow, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#bfeaff'; ctx.stroke();
      for (let i = 0; i < 3; i++) { const ph = frac(time * 1.5 + i / 3); ctx.strokeStyle = `rgba(230,250,255,${.6 * (1 - ph)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, W * grow * (1 + ph * .2), H * grow * (1 + ph * .1), 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
    } else if (t < 2.0) {
      // shards and droplets falling
      const k = (t - 1.0) / 1.0;
      for (let i = 0; i < 12; i++) {
        const an = hash(fx.seed + i) * TAU, d = 30 + 110 * easeOut(k) * hash(i * 3.3 + fx.seed), x = mx + Math.cos(an) * d, y = my - H + Math.sin(an) * d * .6 + 200 * k * k;
        ctx.save(); ctx.translate(x, y); ctx.rotate(an + k * 6); ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#9fdcff'; ctx.strokeStyle = '#0e3a66'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 4); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // the reflected copy: steps out with a water Rasengan and rams it home
    if (t >= .45 && t < .9) {
      const p = mirrorPos(fx);
      drawTint(ctx, 'naruto', 'attack', f, 'rgba(60,150,230,.5)', p.x, p.y + 3, .92);
      const bx = p.x + f * 22, by = p.y - 40, r = 16 + 6 * p.k;
      ctx.drawImage(waterSphere(), bx - r, by - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'lighter'; K.spin(ctx, rasenSwirl(), bx, by, r * 1.1, time * 18, .85); K.glow(ctx, bx, by, r * 2, '140,210,255', .5); ctx.globalCompositeOperation = 'source-over';
      for (let i = 1; i <= 3; i++) { const q = Math.max(0, p.k - i * .12); drawTint(ctx, 'naruto', 'attack', f, 'rgba(60,150,230,.5)', lerp(fx.mx, fx.tx, q), lerp(fx.my, fx.ty, q) + 3, .25 / i); }
    }
    if (fx.hit) {
      const k = (t - .85) / .9;
      if (k < 1) {
        const r = MIR_BLAST * (.4 + .8 * easeOut(k));
        ctx.globalAlpha = (1 - k) * .9; ctx.drawImage(waterSphere(), fx.tx - r, fx.ty - 40 - r * .8, r * 2, r * 1.6); ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter'; K.spin(ctx, rasenSwirl(), fx.tx, fx.ty - 40, r, time * 14, 1 - k); ctx.globalCompositeOperation = 'source-over';
        waterRing(ctx, fx.tx, fx.ty, MIR_BLAST * (.5 + .8 * easeOut(k)), 1 - k, 8);
        splash(ctx, fx.tx, fx.ty, MIR_BLAST, Math.min(.99, k * 1.2), fx.seed, 16);
      }
    }
  }

  function coralFront(fx, l) { return Math.max(0, Math.min(l.len, (fx.age - l.t0) * CORAL_SPEED)); }
  function coralG(ctx, fx, time) {
    const fade = clamp01((fx.dur - fx.age) / .8);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const l of fx.lanes) {
      const d = coralFront(fx, l), c = Math.cos(l.a), s = Math.sin(l.a);
      if (d < 4) continue;
      // pink veins crawling over the ground, with side twigs
      ctx.beginPath(); ctx.moveTo(l.x0, l.y0);
      for (let q = 30; q <= d; q += 30) { const w = Math.sin(q * .05 + l.seed) * 14; ctx.lineTo(l.x0 + c * q - s * w, l.y0 + s * q + c * w * .5); }
      ctx.strokeStyle = `rgba(74,30,42,${.55 * fade})`; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = `rgba(242,184,188,${.9 * fade})`; ctx.lineWidth = 4; ctx.stroke();
      for (let q = 80; q < d - 20; q += CORAL_STEP) cracks(ctx, l.x0 + c * q, l.y0 + s * q, 46, 6, l.seed + q, fade * .8, 2);
    }
    if (fx.age > fx.last) {
      const k = clamp01((fx.age - fx.last) / .3);
      ctx.fillStyle = `rgba(74,30,42,${.18 * fade})`; ctx.beginPath(); ctx.ellipse(fx.ex, fx.ey, CORAL_END * k, CORAL_END * .5 * k, 0, 0, TAU); ctx.fill();
      cracks(ctx, fx.ex, fx.ey, CORAL_END * 1.1, 12, fx.seed, fade, 3);
    }
  }
  function coralO(ctx, fx, time) {
    const fade = clamp01((fx.dur - fx.age) / .8);
    for (const l of fx.lanes) {
      const c = Math.cos(l.a), s = Math.sin(l.a);
      let i = 0;
      for (let q = 80; q < l.len - 40; q += CORAL_STEP, i++) {
        const te = l.t0 + q / CORAL_SPEED, u = fx.age - te;
        if (u < 0) break;
        const g = easeBack(Math.min(1, u / .22)), x = l.x0 + c * q, y = l.y0 + s * q;
        drawCoral(ctx, i + l.seed, x - 16, y + 2, .8 * g, fade, true);
        drawCoral(ctx, i + 1 + l.seed, x + 12, y + 6, 1.0 * g, fade);
        if (u < .3) splash(ctx, x, y, 40, u / .3, q + l.seed, 6);
      }
    }
    if (fx.age > fx.last) {
      // the cage of coral closing round the target
      const u = fx.age - fx.last;
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + fx.seed, rr = CORAL_END * (.7 + hash(i + fx.seed) * .3), g = easeBack(Math.min(1, (u - i * .02) / .3));
        if (g <= 0) continue;
        drawCoral(ctx, i, fx.ex + Math.cos(an) * rr, fx.ey + Math.sin(an) * rr * .5 + 4, (1.5 + hash(i * 2) * .7) * g, fade, i % 2 === 0);
      }
      for (let i = 0; i < 3; i++) drawCoral(ctx, i + 1, fx.ex + (i - 1) * 40, fx.ey + 8, 1.9 * easeBack(Math.min(1, u / .3)), fade, i === 1);
      if (u < .6) splash(ctx, fx.ex, fx.ey, CORAL_END, u / .6, fx.seed, 14);
    }
  }

  function dragonG(ctx, fx, time) {
    const u = dragonU(fx.age), p = fx.p;
    if (fx.age < DRAGON_T + .5) {
      ctx.lineCap = 'round';
      curvePath(ctx, p, Math.max(0, u - .45), u);
      ctx.strokeStyle = 'rgba(16,30,56,.22)'; ctx.lineWidth = 50; ctx.stroke();
    }
    // wet trail left on the ground
    curvePath(ctx, p, 0, u); ctx.strokeStyle = `rgba(30,70,110,${.2 * clamp01((fx.dur - fx.age) / 1)})`; ctx.lineWidth = 70; ctx.stroke();
    if (fx.burst) {
      const k = (fx.age - DRAGON_T) / 2.2;
      wet(ctx, p[4], p[5], DRAGON_END, 1 - k, fx.seed); cracks(ctx, p[4], p[5], DRAGON_END * 1.1, 12, fx.seed, 1 - k, 3.5);
      if (k < .4) waterRing(ctx, p[4], p[5], DRAGON_END * (.4 + 1.2 * easeOut(k / .4)), 1 - k / .4, 10);
    }
  }
  const DPX = new Float32Array(32), DPY = new Float32Array(32);
  function dragonO(ctx, fx, time) {
    const p = fx.p, t = fx.age;
    // water pillar at the source
    if (t < .7) {
      const k = t / .7;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 160 * bell(k)); waterStroke(ctx, 40 * (1 - k * .5), 1 - k);
    }
    if (t > DRAGON_T + .12) {
      const k = (t - DRAGON_T) / 1.4;
      if (k < 1) { blastWater(ctx, p[4], p[5], DRAGON_END, k, fx.seed); }
      return;
    }
    const u = dragonU(t), u0 = Math.max(0, u - .42), N = 22;
    for (let i = 0; i <= N; i++) {
      const q = lerp(u0, u, i / N), [x, y] = bez(p, q);
      DPX[i] = x + Math.sin(q * 30 - time * 10) * 10 * (i / N);
      DPY[i] = y - (50 + 50 * Math.sin(Math.PI * q)) - Math.cos(q * 26 - time * 9) * 8;
    }
    // body: tapering water ribbon, tail first
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let layer = 0; layer < 4; layer++) {
      ctx.strokeStyle = WATER[layer];
      for (let i = 0; i < N; i++) {
        const w = (10 + 46 * Math.pow(i / N, .7)) * [1.45, 1, .55, .16][layer];
        ctx.lineWidth = Math.max(1, w);
        ctx.beginPath(); ctx.moveTo(DPX[i], DPY[i]); ctx.lineTo(DPX[i + 1], DPY[i + 1]); ctx.stroke();
      }
    }
    // scale arcs and spray along the back
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
    for (let i = 3; i < N - 1; i += 3) {
      const a = Math.atan2(DPY[i + 1] - DPY[i], DPX[i + 1] - DPX[i]), w = 10 + 40 * (i / N);
      ctx.beginPath(); ctx.arc(DPX[i], DPY[i], w * .45, a - 2.4, a - 1.2); ctx.stroke();
    }
    const K = Kit();
    for (let i = 0; i < 6; i++) { const j = Math.floor(hash(i + Math.floor(time * 12)) * N); K.stamp(ctx, waterPuff(), DPX[j] + (hash(i * 3) - .5) * 30, DPY[j] - 10, 10 + hash(i) * 10, .6, .8); }
    // head along the tangent
    const hx = DPX[N], hy = DPY[N], a = Math.atan2(DPY[N] - DPY[N - 2], DPX[N] - DPX[N - 2]);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); if (Math.cos(a) < 0) ctx.scale(1, -1);
    ctx.drawImage(dragonHeadSpr(), -50, -55, 150, 110);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 70, '120,200,255', .35); ctx.globalCompositeOperation = 'source-over';
  }
  function blastWater(ctx, x, y, r, k, seed) {
    const K = Kit();
    if (k < .3) { const q = k / .3; ctx.globalAlpha = 1 - q; ctx.drawImage(waterSphere(), x - r * (.5 + .5 * q), y - r * (.6 + .4 * q), r * (1 + q), r * (.9 + .5 * q)); ctx.globalAlpha = 1; }
    splash(ctx, x, y, r, Math.min(.99, k * 1.1), seed, 20);
    for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + seed; K.stamp(ctx, waterPuff(), x + Math.cos(an) * r * .5 * easeOut(k), y + Math.sin(an) * r * .25 - 30 - 40 * k, 30 + 20 * k, (1 - k) * .8, .8); }
  }

  function rteleG(ctx, fx, time) { markLine(ctx, { x: fx.x, y: fx.y, a: fx.a, len: fx.len, w: 60 }, MOVES.shell.rgb, fx.age / fx.dur, time); }
  function rshockG(ctx, fx, time) {
    const k = fx.age / fx.dur;
    ctx.strokeStyle = `rgba(40,30,30,${.35 * (1 - k)})`; ctx.lineWidth = 50; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x, fx.y); ctx.stroke();
    cracks(ctx, fx.x, fx.y, 140, 9, fx.seed, 1 - k, 3);
  }
  function rshockO(ctx, fx, time) {
    const k = fx.age / fx.dur;
    if (k < .5) { const q = k / .5; ctx.strokeStyle = `rgba(230,250,240,${.8 * (1 - q)})`; ctx.lineWidth = 8 * (1 - q); ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 40 + 140 * easeOut(q), (40 + 140 * easeOut(q)) * .5, 0, 0, TAU); ctx.stroke(); }
    const K = Kit(), dust = K.puff('dust');
    for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + fx.seed, d = 60 + 60 * easeOut(k); K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - 14 - 20 * k, 22 + 14 * k, (1 - k) * .8, .75); }
  }

  function mistG(ctx, fx, time) {
    const k = fx.age, spread = easeOut(Math.min(1, k / .6)), fade = clamp01((fx.dur - k) / 1.2);
    ctx.fillStyle = `rgba(30,50,70,${.18 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, MIST_R * spread, MIST_R * .5 * spread, 0, 0, TAU); ctx.fill();
    for (const s of fx.spots) {
      const u = fx.age - s.t;
      if (!s.hit) markCircle(ctx, s.x, s.y, 105, MOVES.mist.rgb, u / .6, time, false, true);
      else { const q = (u - .6) / 1.4; if (q < 1) cracks(ctx, s.x, s.y, 110, 8, s.x, 1 - q, 2.6); }
    }
  }
  function mistO(ctx, fx, time) {
    const K = Kit(), k = fx.age, spread = easeOut(Math.min(1, k / .6)), fade = clamp01((fx.dur - k) / 1.2);
    // a looming Isobu silhouette shifting inside the fog
    const TB = window.TailedBeasts;
    if (TB && fade > .05) {
      const sx = fx.x + Math.sin(time * .4 + fx.seed) * 260, sy = fx.y - 160 + Math.cos(time * .3) * 40;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(1.8, 1.8);
      // TailedBeasts.draw sets its own alpha from deathTimer (alpha = deathTimer / 1.2)
      FAKE.beastId = 'isobu'; FAKE.x = 0; FAKE.y = 0; FAKE.angle = Math.sin(time * .2) > 0 ? 0 : Math.PI; FAKE.beastWindup = 0; FAKE.pulse = time;
      FAKE.deathTimer = .2 * fade * spread * 1.2;
      ctx.globalAlpha = .2 * fade * spread;
      try { TB.draw(ctx, FAKE, time); } catch (e) { /* the silhouette is cosmetic */ }
      FAKE.deathTimer = 99;
      ctx.restore(); ctx.globalAlpha = 1;
    }
    for (const s of fx.spots) {
      if (!s.hit) continue;
      const u = fx.age - s.t - .6;
      if (u > .9) continue;
      const g = easeBack(Math.min(1, u / .18)) * (u > .6 ? 1 - (u - .6) / .3 : 1);
      drawCoral(ctx, s.v, s.x - 20, s.y + 6, 1.6 * g, 1, true); drawCoral(ctx, s.v + 1, s.x + 18, s.y + 4, 1.9 * g, 1); drawCoral(ctx, s.v + 2, s.x, s.y + 10, 1.3 * g, 1);
      splash(ctx, s.x, s.y, 90, Math.min(.99, u / .7), s.x + s.y, 10);
    }
    // the fog itself: big drifting puffs
    const puff = steamPuff();
    for (let i = 0; i < 20; i++) {
      const an = hash(fx.seed + i * 1.7) * TAU + time * .08 * (i % 2 ? 1 : -1), d = MIST_R * spread * (.2 + .8 * Math.sqrt(hash(fx.seed + i * 3.1)));
      K.stamp(ctx, puff, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - 30 - hash(i) * 40, 90 + hash(i * 2.2) * 60, .3 * fade, .7);
    }
  }

  function splashG(ctx, fx, time) {
    const k = fx.age / fx.dur;
    wet(ctx, fx.x, fx.y, fx.r, 1 - k, fx.seed);
    cracks(ctx, fx.x, fx.y, fx.r * 1.1, 12, fx.seed, 1 - k, 3.5);
    if (k < .5) waterRing(ctx, fx.x, fx.y, fx.r * (.4 + .9 * easeOut(k * 2)), 1 - k * 2, 9);
  }
  function splashO(ctx, fx, time) {
    const k = fx.age / fx.dur;
    blastWater(ctx, fx.x, fx.y, fx.r * .8, Math.min(.99, k * 1.2), fx.seed);
    if (fx.coral) for (let i = 0; i < 10; i++) {
      const an = i * TAU / 10 + fx.seed, g = easeBack(Math.min(1, fx.age / .25)) * (1 - easeIn(clamp01((fx.age - 1.1) / .5)));
      drawCoral(ctx, i, fx.x + Math.cos(an) * fx.r * .85, fx.y + Math.sin(an) * fx.r * .42, 1.6 * g, 1, i % 2 === 0);
    }
  }
  function tbbG(ctx, fx, time) {
    const d = Math.max(0, Math.min(fx.len, (fx.age - .05) * TBB_SPEED)), c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (!fx.burst) {
      markLine(ctx, { x: fx.x0, y: fx.y0, a: fx.a, len: fx.len, w: TBB_W }, MOVES.isobu.rgb, 1, time);
      markCircle(ctx, fx.x0 + c * fx.len, fx.y0 + s * fx.len, TBB_BLAST, MOVES.isobu.rgb, d / fx.len, time, false);
      ctx.fillStyle = 'rgba(10,6,20,.3)'; ctx.beginPath(); ctx.ellipse(fx.x0 + c * d, fx.y0 + s * d, 80, 26, 0, 0, TAU); ctx.fill();
    } else {
      const k = (fx.age - fx.bt) / 2.2, ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#4a4650'; ctx.beginPath(); ctx.ellipse(ex, ey, TBB_BLAST * .7, TBB_BLAST * .34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1e1a24'; ctx.beginPath(); ctx.ellipse(ex, ey + 4, TBB_BLAST * .5, TBB_BLAST * .24, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      cracks(ctx, ex, ey, TBB_BLAST * 1.2, 16, fx.seed, 1 - k, 4.5);
      ctx.strokeStyle = `rgba(30,20,40,${.3 * (1 - k)})`; ctx.lineWidth = TBB_W * 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(ex, ey); ctx.stroke();
    }
  }
  function tbbBall(ctx, x, y, r, time, alpha = 1) {
    const K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 2.4, '120,90,255', .55 * alpha);
    K.glow(ctx, x, y, r * 1.5, '255,80,120', .25 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(tbbSphere(), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    K.spin(ctx, darkSwirl(), x, y, r * 1.02, time * 9, .85 * alpha);
    ctx.strokeStyle = `rgba(200,180,255,${.7 * alpha})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r * 1.04, 0, TAU); ctx.stroke();
  }
  function tbbO(ctx, fx, time) {
    const K = Kit(), c = Math.cos(fx.a), s = Math.sin(fx.a);
    if (!fx.burst) {
      const d = Math.max(0, Math.min(fx.len, (fx.age - .05) * TBB_SPEED)), q = d / fx.len;
      const x = fx.x0 + c * d, y = fx.y0 + s * d - lerp(-MOUTH[1], 60, easeOut(q));
      // wake of churned water and chakra
      for (let i = 1; i <= 5; i++) { const dd = Math.max(0, d - i * 50); K.stamp(ctx, steamPuff(), fx.x0 + c * dd, fx.y0 + s * dd - 50, 30 + i * 6, .5 - i * .08, .8); }
      tbbBall(ctx, x, y, 58, time);
    } else {
      const k = (fx.age - fx.bt) / 2.0, ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
      if (k >= 1) return;
      // the Tailed Beast Ball goes off: a dark dome, a white flash, then a water column and rings
      if (k < .45) {
        const q = k / .45;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, ex, ey - 60, TBB_BLAST * (1 + q), '170,140,255', (1 - q) * .9, true); ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = (1 - q) * .9;
        ctx.fillStyle = '#140c26'; ctx.beginPath(); ctx.ellipse(ex, ey, TBB_BLAST * (.3 + .75 * easeOut(q)), TBB_BLAST * (.25 + .55 * easeOut(q)), 0, Math.PI, TAU); ctx.fill();
        ctx.strokeStyle = '#c8b8ff'; ctx.lineWidth = 5; ctx.stroke();
        ctx.globalAlpha = 1;
        K.spin(ctx, darkSwirl(), ex, ey - TBB_BLAST * .3 * easeOut(q), TBB_BLAST * .5 * easeOut(q), time * 4, (1 - q) * .8, .6);
      }
      for (let i = 0; i < 3; i++) { const q = clamp01(k * 1.6 - i * .12); if (q > 0 && q < 1) waterRing(ctx, ex, ey, TBB_BLAST * (.4 + .9 * easeOut(q)), 1 - q, 12 - i * 3); }
      splash(ctx, ex, ey, TBB_BLAST, Math.min(.99, k * 1.1), fx.seed, 22);
      steamCloud(ctx, ex, ey, TBB_BLAST, 16, 1 - k, k * 4, fx.seed, 1.4);
    }
  }

  const FX = {
    gun: [gunG, gunO], punch: [punchG, punchO], melt: [meltG, meltO], geyser: [geyserG, geyserO], clam: [clamG, clamO],
    mirage: [mirageG, mirageO], imp: [impG, impO], sweep: [sweepG, sweepO], hookx: [hookxG, hookxO], mirror: [mirrorG, mirrorO],
    coral: [coralG, coralO], dragon: [dragonG, dragonO], rtele: [rteleG, null], rshock: [rshockG, rshockO], mist: [mistG, mistO],
    splash: [splashG, splashO], tbb: [tbbG, tbbO]
  };

  // ------------------------------------------------------------------ the Isobu body
  // Scratch object handed to TailedBeasts.draw (never stored on z). health 0 + a long deathTimer
  // makes it paint just the body, without its own name plate and health bar.
  const FAKE = { beastId: 'isobu', x: 0, y: 0, angle: 0, health: 0, maxHealth: 1, deathTimer: 99, pulse: 0, beastWindup: 0, seed: 0, tb: null };
  function beastScale(b) { return b.t < .35 ? easeBack(b.t / .35) : b.t > BEAST_T - .45 ? 1 - easeIn((b.t - BEAST_T + .45) / .45) : 1; }
  function beastG(ctx, z, st, time) {
    const b = st.beast, s = beastScale(b);
    ctx.fillStyle = 'rgba(14,20,30,.3)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 4, 230 * s, 64 * s, 0, 0, TAU); ctx.fill();
    wet(ctx, b.x, b.y, 280 * s, .8, 5);
    if (b.t < 1.95 && b.t > .3) {
      const x0 = b.x + b.f * MOUTH[0] * .85, c = Math.cos(b.a), sn = Math.sin(b.a), k = clamp01((b.t - .3) / 1.65);
      markLine(ctx, { x: x0, y: b.y, a: b.a, len: TBB_LEN, w: TBB_W }, MOVES.isobu.rgb, k, time);
      markCircle(ctx, x0 + c * TBB_LEN, b.y + sn * TBB_LEN, TBB_BLAST, MOVES.isobu.rgb, k, time, false);
    }
    if (b.t > 3.1 && !b.slam) markCircle(ctx, b.x, b.y, SLAM_R, MOVES.shell.rgb, clamp01((b.t - 3.1) / .85), time, false);
  }
  function beastO(ctx, z, st, time, m) {
    const b = st.beast, s = beastScale(b), K = Kit(), TB = window.TailedBeasts;
    // water column it bursts out of / sinks back into
    if (b.t < .5 || b.t > BEAST_T - .6) {
      const q = b.t < .5 ? b.t / .5 : (BEAST_T - b.t) / .6;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - 360 * bell(q)); waterStroke(ctx, 150 * (1 - q * .4), .8);
    }
    if (s > .02) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(BK * s, BK * s);
      FAKE.beastId = 'isobu'; FAKE.x = 0; FAKE.y = 0; FAKE.angle = b.f > 0 ? 0 : Math.PI;
      FAKE.beastWindup = b.t > .3 && b.t < 2.1 ? 1 : 0; FAKE.pulse = b.t * 2;
      if (TB) { try { TB.draw(ctx, FAKE, time); } catch (e) { /* fall back to nothing */ } }
      else { ctx.drawImage(shellSpr(), -70, -150, 140, 140); }
      ctx.restore();
    }
    // the Tailed Beast Ball condensing at the maw: dark and light chakra spheres spiralling in
    if (b.t > .3 && b.t < 2.0) {
      const k = clamp01((b.t - .3) / 1.6), mx = b.x + b.f * MOUTH[0] * s, my = b.y + MOUTH[1] * s - 10;
      for (let i = 0; i < 14; i++) {
        const ph = frac(time * 1.4 + hash(i * 3.3)), an = hash(i * 7.7) * TAU + time, d = 220 * (1 - ph) + 20;
        const col = i % 2 ? '#7a5aff' : '#ff6080';
        ctx.fillStyle = 'rgba(10,6,20,.6)'; ctx.beginPath(); ctx.arc(mx + Math.cos(an) * d, my + Math.sin(an) * d * .7, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx + Math.cos(an) * d, my + Math.sin(an) * d * .7, 4, 0, TAU); ctx.fill();
      }
      tbbBall(ctx, mx, my, 10 + 52 * easeOut(k), time, Math.min(1, k * 3));
    }
    // name and health above the beast
    if (s > .5) {
      const top = b.y - 150 * BK * s - 28, w = 180;
      ctx.fillStyle = 'rgba(8,13,20,.82)'; ctx.fillRect(b.x - w / 2 - 2, top - 2, w + 4, 11);
      ctx.fillStyle = m.accent; ctx.fillRect(b.x - w / 2, top, w * clamp01(z.health / z.maxHealth), 7);
      ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#0d0a10'; ctx.strokeText('TAM VĨ · ISOBU — YAGURA', b.x, top - 7);
      ctx.fillStyle = '#fff2f4'; ctx.fillText('TAM VĨ · ISOBU — YAGURA', b.x, top - 7);
    }
  }

  // ------------------------------------------------------------------ windup looks
  function handPos(z, f) { return { x: z.x + f * 24, y: z.y - 44 }; }
  function mouthPos(z, f) { const H = HEIGHT(z.bossId); return { x: z.x + f * 8, y: z.y + 3 - H * .72 }; }
  function windupG(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, move = st.move;
    switch (move) {
      case 'hydro': wet(ctx, z.x, z.y, 30 + 40 * k, 1, 3); waterRing(ctx, z.x, z.y, 20 + 50 * frac(time * 2), 1 - frac(time * 2), 3); break;
      case 'clam': if (st.plan) { ctx.fillStyle = `rgba(20,30,50,${.3 * k})`; ctx.beginPath(); ctx.ellipse(st.plan.cx, st.plan.cy + 6, 130 * k, 36 * k, 0, 0, TAU); ctx.fill(); } break;
      case 'army': if (st.plan) for (const s of st.plan.spots) { wet(ctx, s.x, s.y, 30 + 30 * k, 1, s.x); waterRing(ctx, s.x, s.y, 10 + 50 * frac(time * 2.4 + s.y * .01), 1 - frac(time * 2.4 + s.y * .01), 3); } break;
      case 'imp': if (st.plan) wet(ctx, st.plan.sx, st.plan.sy, 40 + 40 * k, 1, 9); break;
      case 'coral': {
        // coral veins crawling out from under his palm
        ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const an = i * TAU / 7 + .3, L = 30 + 70 * easeOut(k) * (.6 + hash(i) * .5);
          ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.quadraticCurveTo(z.x + Math.cos(an + .4) * L * .6, z.y + Math.sin(an + .4) * L * .3, z.x + Math.cos(an) * L, z.y + Math.sin(an) * L * .5);
          ctx.strokeStyle = 'rgba(74,30,42,.6)'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#f2b8bc'; ctx.lineWidth = 2.6; ctx.stroke();
        }
        break;
      }
      case 'mirror': if (st.plan) wet(ctx, st.plan.mx, st.plan.my, 30 + 40 * k, 1, 4); break;
      case 'isobu': {
        // the seal of the Three-Tails spreading under him
        ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5); ctx.rotate(time * .8);
        ctx.strokeStyle = 'rgba(12,44,92,.5)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 60 + 160 * easeOut(k), 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(150,240,220,${.4 + .5 * k})`; ctx.lineWidth = 3; ctx.stroke();
        for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * TAU / 3); ctx.beginPath(); ctx.arc(70 * easeOut(k), 0, 30 * easeOut(k), 0, TAU); ctx.stroke(); ctx.restore(); }
        ctx.restore();
        break;
      }
    }
  }
  function cloak(ctx, z, time, k, f) {
    // Isobu's chakra boiling up round Yagura, three tails lashing behind him
    const K = Kit(), cx = z.x, cy = z.y - 40;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const base = -f * (.9 + i * .35), sw = Math.sin(time * 5 + i * 2) * .4, L = (40 + 30 * k) * (1 - i * .1);
      const x0 = cx - f * 10, y0 = cy + 18, x1 = x0 + Math.cos(Math.PI / 2 + base + sw) * L, y1 = y0 - Math.abs(Math.sin(Math.PI / 2 + base)) * L * .8 - 10;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 - f * 20, (y0 + y1) / 2 + 10, x1, y1);
      ctx.strokeStyle = 'rgba(10,40,50,.55)'; ctx.lineWidth = 16 * k; ctx.stroke();
      ctx.strokeStyle = 'rgba(80,220,200,.8)'; ctx.lineWidth = 10 * k; ctx.stroke();
      ctx.strokeStyle = 'rgba(220,255,250,.8)'; ctx.lineWidth = 3 * k; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, 50 + 20 * k, '80,230,200', .45 * k);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      const ph = frac(time * 1.6 + hash(i)), an = hash(i * 2.1) * TAU, d = 20 + 16 * hash(i * 5);
      const x = cx + Math.cos(an) * d, y = cy + 30 - ph * 70 + Math.sin(an) * 8, r = (3 + 4 * hash(i * 3)) * bell(ph) * k;
      ctx.strokeStyle = 'rgba(10,50,60,.6)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,255,240,.9)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, f = Math.cos(st.aim) >= 0 ? 1 : -1;
    const hp = handPos(z, f), mp = mouthPos(z, f);
    switch (move) {
      case 'gun': {
        // water drawn into the fingertip
        for (let i = 0; i < 10; i++) {
          const ph = frac(time * 2.4 + hash(i * 1.7)), an = hash(i * 3.1) * TAU, d = 70 * (1 - ph) + 6;
          ctx.fillStyle = 'rgba(12,44,92,.6)'; ctx.beginPath(); ctx.arc(hp.x + Math.cos(an) * d, hp.y + Math.sin(an) * d * .7, 3.6, 0, TAU); ctx.fill();
          ctx.fillStyle = '#bfeaff'; ctx.beginPath(); ctx.arc(hp.x + Math.cos(an) * d, hp.y + Math.sin(an) * d * .7, 2.2, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hp.x, hp.y, 14 + 12 * e, '150,220,255', .9, true); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'arm': {
        // the arm swells with water, bigger and bigger
        const sx = z.x + f * 8, sy = z.y - 50, L = 30 + 16 * e;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + f * L * .5, sy + 26); waterStroke(ctx, 16 + 18 * e, .95);
        const r = 14 + 18 * e + Math.sin(time * 18) * 2;
        ctx.drawImage(waterSphere(), sx + f * L * .5 - r, sy + 26 - r, r * 2, r * 2);
        ctx.strokeStyle = 'rgba(12,44,92,.6)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx + f * L * .5, sy + 26, r, 0, TAU); ctx.stroke();
        break;
      }
      case 'hydro': {
        // he starts to melt: water streaming down his body
        for (let i = 0; i < 8; i++) {
          const ph = frac(time * 2 + hash(i)), x = z.x + (hash(i * 3) - .5) * 40, y = z.y - 90 + ph * 90;
          ctx.fillStyle = 'rgba(12,44,92,.6)'; ctx.beginPath(); ctx.ellipse(x, y, 3.6, 5.5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#9fdcff'; ctx.beginPath(); ctx.ellipse(x, y, 2.2, 4, 0, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = .35 * k; ctx.drawImage(waterSphere(), z.x - 30, z.y - 100, 60, 100); ctx.globalAlpha = 1;
        break;
      }
      case 'clam': {
        if (!st.plan) break;
        const smoke = steamPuff();
        for (let i = 0; i < 6; i++) { const ph = frac(time * 1.4 + i / 6); K.stamp(ctx, smoke, st.plan.cx + Math.sin(i * 2.3 + time) * 70 * e, st.plan.cy - ph * 90, 20 + 26 * ph, bell(ph) * .7 * Math.min(1, k * 2), .8); }
        break;
      }
      case 'imp': case 'army': {
        // steam pouring out of his grin
        const big = move === 'army', puff = steamPuff();
        for (let i = 0; i < (big ? 10 : 6); i++) {
          const ph = frac(time * 1.8 + i / (big ? 10 : 6));
          K.stamp(ctx, puff, mp.x + f * (10 + ph * 70), mp.y - ph * 40 + Math.sin(time * 6 + i) * 6, 6 + 22 * ph, bell(ph) * .85, .8);
        }
        if (move === 'imp' && st.plan) for (let i = 0; i < 5; i++) { const ph = frac(time * 1.2 + i / 5); K.stamp(ctx, puff, st.plan.sx + Math.sin(i * 2.1) * 30, st.plan.sy - ph * 140 * e, 20 + 30 * ph, bell(ph) * .8 * k, .8); }
        if (big && st.plan) for (const s of st.plan.spots) for (let i = 0; i < 2; i++) { const ph = frac(time * 1.3 + i / 2 + s.x * .01); K.stamp(ctx, puff, s.x, s.y - ph * 100 * e, 16 + 24 * ph, bell(ph) * .75 * k, .8); }
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, z.y - 50, 40 + 40 * e, '230,245,255', .3); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'hook': case 'dragon': case 'mirror': {
        // water chakra spiralling up round him
        ctx.save(); ctx.translate(z.x, z.y);
        for (let i = 0; i < 3; i++) {
          const a0 = time * (7 - i) + i * 2.1, r = 34 + i * 10, h = 20 + i * 18 + 40 * e;
          ctx.beginPath();
          for (let q = 0; q <= 12; q++) { const an = a0 + q * .32; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r * .45 - q * h / 12); }
          waterStroke(ctx, 4 + 2 * e, .8);
        }
        ctx.restore();
        if (move === 'mirror' && st.plan) {
          const q = e;
          ctx.beginPath(); ctx.moveTo(st.plan.mx, st.plan.my); ctx.lineTo(st.plan.mx + Math.sin(time * 9) * 4, st.plan.my - 190 * q); waterStroke(ctx, 18 + 26 * q, .85);
        }
        if (move === 'hook') { const tip = { x: z.x + f * 28, y: z.y - 92 }; ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, tip.x, tip.y, 20 + 14 * e, '120,255,200', .8); ctx.globalCompositeOperation = 'source-over'; }
        break;
      }
      case 'coral': {
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x + f * 14, z.y - 12, 30 + 20 * e, '255,170,190', .5); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'shell': cloak(ctx, z, time, e, f); break;
      case 'mist': {
        const puff = steamPuff();
        for (let i = 0; i < 8; i++) { const ph = frac(time * 1.2 + i / 8); K.stamp(ctx, puff, mp.x + f * ph * 110 + Math.sin(i * 2 + time) * 10, mp.y + ph * 30, 10 + 40 * ph, bell(ph) * .7, .8); }
        cloak(ctx, z, time, e * .6, f);
        break;
      }
      case 'isobu': {
        cloak(ctx, z, time, Math.min(1, e * 1.4), f);
        // a water vortex rising and swallowing him
        ctx.save(); ctx.translate(z.x, z.y);
        for (let i = 0; i < 5; i++) {
          const a0 = time * (9 - i) + i * 1.3, r = 50 + i * 18 + 40 * e, h = 60 + 160 * e;
          ctx.beginPath();
          for (let q = 0; q <= 16; q++) { const an = a0 + q * .4; ctx.lineTo(Math.cos(an) * r * (1 - q / 24), Math.sin(an) * r * .45 - q * h / 16); }
          waterStroke(ctx, 6 + 6 * e, .5 + .4 * e);
        }
        ctx.restore();
        break;
      }
    }
  }

  function label(ctx, z, st, m) {
    let move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (st.fx.find(f => f.kind === 'melt' && f.dodge && f.age < 1)) move = 'dodge';
    if (!move || !MOVES[move]) return;
    const top = st.beast ? st.beast.y - 150 * BK - 52 : z.y - HEIGHT(z.bossId) - 32;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#10121a'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.puddle = null; st.beast = null; st.roll = null; st.dash = null;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
    st.ghosts.length = 0;
  }

  // Bake the cached art once per member when it first shows up, not mid-jutsu.
  const warmed = {};
  function prewarm(id) {
    warmed[id] = 1;
    try {
      dropSpr(); waterSphere(); steamPuff(); waterPuff();
      if (id === 'gengetsu') {
        impSpr(); clamSpr(true); clamSpr(false);
        for (const f of [1, -1]) for (const fr of ['seal', 'attack']) { tintSpr('gengetsu', fr, f, 'rgba(255,225,245,.22)'); tintSpr('gengetsu', fr, f, 'rgba(170,220,255,.5)'); }
      } else {
        coralSpr(0); coralSpr(1); coralSpr(2); dragonHeadSpr(); shellSpr(); rasenSwirl(); darkSwirl(); tbbSphere();
        for (const f of [1, -1]) { tintSpr('naruto', 'idle', f, 'rgba(60,150,230,.45)'); tintSpr('naruto', 'attack', f, 'rgba(60,150,230,.5)'); }
      }
    } catch (e) { /* art is baked lazily on use anyway */ }
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.em;
    if (!m || !st || !Kit()) return;
    if (!warmed[z.bossId]) prewarm(z.bossId);
    visualAge(z, st, time);
    if (!st.fx.length && !(st.windup > 0) && z.health <= 0) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (st.puddle) puddleDraw(ctx, z, st, time);
      if (st.beast) beastG(ctx, z, st, time);
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
        for (const s of st.tele) {
          if (s.k === 'c') markCircle(ctx, s.follow ? z.x : s.x, s.follow ? z.y : s.y, s.r, rgb, k, time, s.faint, s.small);
          else if (s.k === 'line') markLine(ctx, s, rgb, k, time);
          else if (s.k === 'cone') markCone(ctx, s, rgb, k, time);
          else if (s.k === 'curve') markCurve(ctx, s, rgb, k, time);
        }
        windupG(ctx, z, st, time);
      }
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.em;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    const S = Spr();
    if (S && st.ghosts.length) {
      for (const g of st.ghosts) {
        const a = .4 * (1 - g.age / .3);
        if (g.id === 'ball') { ctx.globalAlpha = a; ctx.drawImage(shellSpr(), g.x - 40, g.y - 74, 80, 80); }
        else S.draw(ctx, g.id, g.x, g.y + 3, { facing: g.f, frame: 'attack', alpha: a });
      }
      ctx.globalAlpha = 1;
    }
    if (z.health > 0) {
      if (st.beast) beastO(ctx, z, st, time, m);
      else if ((st.holdMove === 'shell' && st.hold > 0) || st.roll) {
        // Yagura curled inside Isobu's spiked shell
        const K = Kit(), y = z.y - 36 - (st.roll ? Math.abs(Math.sin(st.roll.t * 20)) * 6 : 0);
        ctx.fillStyle = 'rgba(10,20,20,.3)'; ctx.beginPath(); ctx.ellipse(z.x, z.y + 3, 44, 14, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, y, 70, '80,230,200', .35); ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(z.x, y); ctx.rotate(st.rollA); ctx.drawImage(shellSpr(), -46, -46, 92, 92); ctx.restore();
        if (st.roll) splash(ctx, z.x, z.y, 50, frac(st.roll.t * 4), st.roll.x0, 6, .8);
      } else if (st.windup > 0 && st.move) {
        windupO(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  function hidden(z) {
    const st = z.em;
    return !!(st && z.health > 0 && (st.puddle || st.beast || st.roll || (st.holdMove === 'shell' && st.hold > 0)));
  }

  window.EdoMizukageBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden };
})();
