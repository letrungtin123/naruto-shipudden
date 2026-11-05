(() => {
  'use strict';

  // Kurama, the Nine-Tailed Fox (spawn panel, group "VĨ THÚ", faction 'kyubi').
  // A giant: the game hides its sprite (hidden(z)) and this module paints the whole beast (about
  // 460 px to the ear tips) in draw() (ground layer, under the ninjas so they stay readable) and
  // its jutsu in draw()/drawOverlay(). All per-boss state lives on z.ky (small, no references to
  // other objects: co-op snapshots serialise it). It prowls to a spot below its target and
  // flattens the houses in its way. Moves: the roar, the Tailed-Beast Ball, the claw rampage
  // charge, the nine-tail sweep, the rapid Bijūdama volley, giant chakra arms that grab and slam,
  // the red chakra-flame breath, a paw smash when its target stands under it, and the ultimate:
  // the colossal Tailed-Beast Ball fed by all nine tails, swallowed and spat on a whole district.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOutBack = t => { t = clamp01(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const r1 = v => Math.round(v);
  const Kit = () => window.VFXKit;

  const ID = 'kurama';
  const order = [ID];
  const members = {
    kurama: {
      name: 'CỬU VĨ · KURAMA', accent: '#ff6a1a', hpScale: 6.0, damageScale: 2.0, armor: .85,
      // Every jutsu shows once in the first ~28 s; the second lap reorders them.
      moves: ['roar', 'tbb', 'claw', 'sweep', 'rapid', 'arms', 'breath', 'mega',
        'tbb', 'claw', 'breath', 'sweep', 'arms', 'rapid', 'roar', 'tbb', 'claw', 'mega']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    roar:   { label: 'CỬU VĨ · BẠO HỐNG', rgb: '255,160,100', windup: 1.0, after: 1.0 },
    tbb:    { label: 'VĨ THÚ NGỌC', rgb: '205,130,255', windup: 1.3, after: 1.4 },
    claw:   { label: 'CỬU VĨ · BẠO TRẢO XUNG KÍCH', rgb: '255,130,60', windup: .95, after: 1.0 },
    sweep:  { label: 'CỬU VĨ · CUỒNG VĨ TẢO', rgb: '255,205,150', windup: 1.0, after: 1.2 },
    rapid:  { label: 'VĨ THÚ NGỌC · LIÊN XẠ', rgb: '215,140,255', windup: .9, after: 1.1 },
    arms:   { label: 'CỬU VĨ · CHAKRA CỰ THỦ', rgb: '255,175,80', windup: .95, after: 1.2 },
    breath: { label: 'CỬU VĨ · XÍCH DIỄM PHÚN', rgb: '255,120,50', windup: 1.0, after: 1.0 },
    mega:   { label: 'CỬU VĨ · CỰC ĐẠI VĨ THÚ NGỌC', rgb: '255,100,70', windup: 2.6, after: 3.0 },
    slam:   { label: 'CỬU VĨ · CỰ TRẢO', rgb: '255,185,120', windup: .75, after: 1.0 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;
  // Manual control (team mode): keys 1..8, the ultimate last.
  const MANUAL = ['roar', 'tbb', 'claw', 'sweep', 'rapid', 'arms', 'breath', 'mega'];
  const MANUAL_LIST = MANUAL.map(k => ({ label: MOVES[k].label }));
  function moves() { return MANUAL_LIST; }
  // The unit a grab/swat works on: api.player, or (manual mode: a cursor pseudo-target) the nearest foe.
  const victim = (api, x, y, r) => { const p = api.player; if (p && !p.pseudo) return p; return api.nearestFoe ? api.nearestFoe(x, y, r) : null; };

  const BODY_R = 100, SCALE = .66;
  const ROAR_R = 560, TBB_R = 340, TBB_SPEED = 1300, RAPID_R = 105;
  const SWEEP_R = 700, SWEEP_HALF = 1.0, SWEEP_T = .6;
  const CLAW_LEN = 780, CLAW_W = 112, CLAW_T = .5, SLASH_HALF = 230;
  const ARM_R = 150, ARM_EXT = .32, ARM_HOLD = 1.05;
  const BREATH_R = 660, BREATH_HALF = .42, BREATH_T = 1.5;
  const MEGA_R = 740, MEGA_FLY = .75, SLAM_R = 165;
  const WALK_SPEED = 80;
  // Kurama palette: vermilion-orange fur, dark ink, black eye markings and lips, red slit eyes.
  const C = {
    line: '#2a0a04', fur: '#e8581a', light: '#ff8a3c', pale: '#ffb468', dark: '#b8380e', deep: '#7e2208',
    far: '#cc4814', black: '#170504', claw: '#2a110a', inner: '#3c0a08', mouth: '#3a0606', tongue: '#b0242c', tooth: '#fff4e4'
  };
  const KY_FLAME = [[1, '#8a1206'], [.84, '#d0300c'], [.66, '#ff6a1a'], [.46, '#ffb040'], [.25, '#fff0c0']];
  const VIOLET_FLAME = [[1, '#2c0a48'], [.84, '#5a1c96'], [.66, '#8e46e0'], [.46, '#c99cff'], [.25, '#f6ecff']];

  function pick() { return order[0]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.ky || (z.ky = { t: 0, casts: 0, timer: 1.0, move: '', windup: 0, windMax: 1, aim: 0, tx: r1(z.x), ty: r1(z.y),
      tele: [], ev: [], fx: [], force: null, hold: 0, holdMove: '', plan: null, sweepDir: 1,
      walk: 0, moving: 0, lastSin: 0, crushCd: 0, stomps: [], near: 0, slamCd: 12, dash: null,
      gape: 0, raise: 0, rear: 0, spread: 0, crouch: 0, tailsUp: 0, swallow: 0, recoil: 0, look: 0, lean: 0, rage: 0,
      reach: { x: 0, y: 0, k: 0, up: 0, side: 1, go: 0, hold: 0 },
      tips: new Array(18).fill(0), mouth: { x: r1(z.x), y: r1(z.y - 300) }, sh: [0, 0, 0, 0], lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = Math.round(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const circ = (cx, cy, r, faint, small) => ({ k: 'c', x: r1(cx), y: r1(cy), r, faint, small });
    switch (move) {
      case 'roar': return [{ k: 'c', follow: true, r: ROAR_R }, { k: 'c', follow: true, r: ROAR_R * .5, faint: true }];
      case 'tbb': {
        const L = Math.min(1000, Math.hypot(tx - x, ty - y)), ex = x + ca * L, ey = y + sa * L;
        st.plan = { x: r1(ex), y: r1(ey) };
        return [{ k: 'line', x: r1(x), y: r1(y), a, len: L, w: 46 }, circ(ex, ey, TBB_R), circ(ex, ey, TBB_R * .5, true)];
      }
      case 'claw': {
        const L = Math.max(320, Math.min(CLAW_LEN, Math.hypot(tx - x, ty - y) + 80));
        const ex = x + ca * L, ey = y + sa * L;
        st.plan = { x1: r1(ex), y1: r1(ey), a };
        return [{ k: 'line', x: r1(x), y: r1(y), a, len: L, w: CLAW_W }, circ(ex + ca * 120, ey + sa * 120, SLASH_HALF, true)];
      }
      case 'rapid': {
        const spots = [{ x: tx, y: ty }], b = Math.random() * TAU;
        for (let i = 0; i < 4; i++) spots.push({ x: tx + Math.cos(b + i * TAU / 4) * 170, y: ty + Math.sin(b + i * TAU / 4) * 170 });
        for (let i = 0; i < 5; i++) { const aa = b + (i + .5) * TAU / 5, d = rand(310, 380); spots.push({ x: tx + Math.cos(aa) * d, y: ty + Math.sin(aa) * d }); }
        spots.forEach((s, i) => { s.x = r1(s.x); s.y = r1(s.y); s.t0 = i === 0 ? 0 : +(.1 + i * .12 + Math.random() * .04).toFixed(2); s.seed = i * 7 + 3; });
        st.plan = spots;
        return spots.map(s => circ(s.x, s.y, RAPID_R, true, true));
      }
      case 'sweep': st.sweepDir = Math.random() < .5 ? 1 : -1; return [{ k: 'cone', x: r1(x), y: r1(y), a, len: SWEEP_R, half: SWEEP_HALF, dir: st.sweepDir }];
      case 'arms': {
        const px = -sa, py = ca, hands = [{ x: r1(tx + px * 60), y: r1(ty + py * 60) }, { x: r1(tx - px * 60), y: r1(ty - py * 60) }];
        st.plan = { hands, x: r1(tx), y: r1(ty) };
        const out = [circ(tx, ty, ARM_R)];
        for (const s of [-1, 1]) {
          const sx = x + s * 110, sy = y - 10, hx = hands[s < 0 ? 0 : 1].x, hy = hands[s < 0 ? 0 : 1].y;
          out.push({ k: 'line', x: r1(sx), y: r1(sy), a: Math.atan2(hy - sy, hx - sx), len: Math.hypot(hx - sx, hy - sy), w: 40 });
        }
        return out;
      }
      case 'breath': return [{ k: 'cone', x: r1(x), y: r1(y), a, len: BREATH_R, half: BREATH_HALF, dir: 0 }];
      case 'mega': st.plan = { x: r1(tx), y: r1(ty) }; return [circ(tx, ty, MEGA_R), circ(tx, ty, MEGA_R * .55, true), circ(tx, ty, MEGA_R * .22, true)];
      case 'slam': {
        st.plan = { side: tx < x ? -1 : 1, x: r1(tx), y: r1(ty) };
        return [circ(tx, ty, SLAM_R)];
      }
    }
    return [];
  }

  function announce(z, st, m, api) {
    let move = st.force;
    if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? r1(p.x) : r1(z.x); st.ty = p ? r1(p.y) : r1(z.y);
    st.tele = teleFor(z, st, move);
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, a = st.aim;
    switch (move) {
      case 'roar': {
        const x = z.x, y = z.y, R = ROAR_R;
        addFx(st, { kind: 'roar', x: r1(x), y: r1(y), R, dur: 2.3 });
        api.knockback(z, R, 230, D * 1.6);
        api.world(x, y, 260, D * 3, 'shockwave');
        for (let i = 0; i < 3; i++) { const aa = i * TAU / 3 + .5; api.world(x + Math.cos(aa) * 400, y + Math.sin(aa) * 400, 160, D * 2.4, 'shockwave', aa); }
        later(st, .35, api => { api.knockback(z, R * .7, 130, D * .5); api.shake(12); });
        api.burst(x, y - 60, '#ffb070', 24);
        api.shake(24);
        st.hold = .9; st.holdMove = 'roar';
        break;
      }
      case 'tbb': {
        const T = st.plan || { x: st.tx, y: st.ty }, M = st.mouth;
        const fly = Math.max(.32, Math.min(.85, Math.hypot(T.x - z.x, T.y - z.y) / TBB_SPEED));
        const fx = addFx(st, { kind: 'tbb', mx: M.x, my: M.y, x: T.x, y: T.y, R: TBB_R, fly, dur: fly + 3.2, tick: .35 });
        later(st, fly, api => {
          api.strike(T.x, T.y, TBB_R, D * 3.1, '#c090ff', 'crater');
          for (let i = 0; i < 3; i++) api.world(T.x + Math.cos(i * TAU / 3 + .5) * TBB_R * .6, T.y + Math.sin(i * TAU / 3 + .5) * TBB_R * .6, 150, D * 2.4, 'crater');
          api.shake(24); api.burst(T.x, T.y - 40, '#d0a8ff', 30);
        });
        fx.upd = (fx, dt, api) => {
          const u = fx.age - fx.fly;
          if (u > .3 && u < 1.8 && (fx.tick -= dt) <= 0) { fx.tick = .45; api.strike(fx.x, fx.y, fx.R * .5, D * .45, null, null, true); }
        };
        st.recoil = 1;
        st.plan = null;
        break;
      }
      case 'claw': {
        const P = st.plan || { x1: z.x + Math.cos(a) * 500, y1: z.y + Math.sin(a) * 500, a };
        st.dash = { x0: r1(z.x), y0: r1(z.y), x1: P.x1, y1: P.y1, a: P.a, t: 0, n: 0 };
        const fx = addFx(st, { kind: 'claw', x0: r1(z.x), y0: r1(z.y), x1: P.x1, y1: P.y1, a: P.a, dur: CLAW_T + 2.6, sx: 0, sy: 0, st: -1 });
        later(st, CLAW_T + .04, api => {
          // the rampage ends in three huge claw rakes across the ground ahead
          const ca = Math.cos(P.a), sa = Math.sin(P.a), px = -sa, py = ca, cx = z.x + ca * 150, cy = z.y + sa * 150;
          fx.sx = r1(cx); fx.sy = r1(cy); fx.st = +fx.age.toFixed(2);
          for (let j = -1; j <= 1; j++) {
            const ox = cx + ca * j * 64, oy = cy + sa * j * 64;
            api.line(ox - px * SLASH_HALF - ca * 70, oy - py * SLASH_HALF - sa * 70, ox + px * SLASH_HALF + ca * 70, oy + py * SLASH_HALF + sa * 70, 44, D * 1.35, j === 0 ? 'blade' : null);
          }
          api.world(cx + ca * 60, cy + sa * 60, 200, D * 4, 'blade', P.a);
          api.shake(20);
        });
        st.hold = CLAW_T + .45; st.holdMove = 'claw';
        st.plan = null;
        break;
      }
      case 'rapid': {
        const spots = st.plan || [], M = st.mouth;
        let last = 0;
        spots.forEach((s, i) => {
          s.fly = +(.36 + Math.hypot(s.x - z.x, s.y - z.y) / 3600).toFixed(2);
          last = Math.max(last, s.t0 + s.fly);
          later(st, s.t0 + s.fly, api => {
            api.strike(s.x, s.y, RAPID_R, D * 1.15, null, i % 4 === 0 ? 'crater' : null, true);
            if (i % 3 === 0) api.shake(7);
          });
        });
        addFx(st, { kind: 'rapid', spots, mx: M.x, my: M.y, dur: last + 1.5 });
        st.hold = Math.max(.3, last - .3); st.holdMove = 'rapid';
        st.plan = null;
        break;
      }
      case 'sweep': {
        const dir = st.sweepDir, a0 = a - dir * SWEEP_HALF, a1 = a + dir * SWEEP_HALF, x = z.x, y = z.y, t0 = .06;
        addFx(st, { kind: 'sweep', x: r1(x), y: r1(y), a0, a1, dir, R: SWEEP_R, t0, T: SWEEP_T, dur: 2.0 });
        const N = 14;
        for (let j = 0; j <= N; j++) {
          const u = j / N, aa = lerp(a0, a1, u), ca = Math.cos(aa), sa = Math.sin(aa);
          later(st, t0 + u * SWEEP_T, api => {
            api.line(x + ca * 110, y + sa * 110, x + ca * SWEEP_R, y + sa * SWEEP_R, 62, D * 1.9, j % 7 === 3 ? 'blade' : null);
            const p = victim(api, x, y, SWEEP_R + 20);
            if (p) {
              const along = (p.x - x) * ca + (p.y - y) * sa, off = Math.abs(-(p.x - x) * sa + (p.y - y) * ca);
              if (along > 90 && along < SWEEP_R + 20 && off < 80) {
                const pa = aa + dir * Math.PI / 2;
                api.knockback({ x: p.x - Math.cos(pa) * 12, y: p.y - Math.sin(pa) * 12 }, 40, 230, 0);
              }
            }
            if (j % 5 === 0) api.shake(9);
          });
        }
        st.hold = t0 + SWEEP_T; st.holdMove = 'sweep';
        break;
      }
      case 'arms': {
        const P = st.plan || { hands: [{ x: st.tx, y: st.ty }, { x: st.tx, y: st.ty }], x: st.tx, y: st.ty };
        const fx = addFx(st, { kind: 'arms', hands: P.hands.map(h => ({ x: h.x, y: h.y })), cx: P.x, cy: P.y, hx: P.x, hy: P.y,
          grab: 0, pulls: 0, slam: -1, dur: ARM_HOLD + 1.4 });
        later(st, ARM_EXT, api => {
          api.strike(fx.cx, fx.cy, ARM_R, D * 1.4, '#ffb060', 'earth');
          api.shake(12);
          const v = victim(api, fx.cx, fx.cy, ARM_R + 40);
          if (v && Math.hypot(v.x - fx.cx, v.y - fx.cy) < ARM_R + 30 + (v.r || 0)) { fx.grab = 1; fx.hx = r1(v.x); fx.hy = r1(v.y); }
        });
        fx.upd = (fx, dt, api) => {
          if (fx.grab && fx.age > ARM_EXT && fx.age < ARM_HOLD && z.health > 0) {
            // the caught unit is dragged in toward the fox's jaws, a shove at a time
            const v = victim(api, fx.hx, fx.hy, 200);
            if (v) {
              fx.hx = r1(v.x); fx.hy = r1(v.y);
              const gx = z.x + Math.max(-120, Math.min(120, v.x - z.x)), gy = z.y + 270, d = Math.hypot(gx - v.x, gy - v.y);
              if (d > 60 && fx.pulls < 7 && fx.age > ARM_EXT + .08 + fx.pulls * .1) {
                fx.pulls++;
                const pa = Math.atan2(gy - v.y, gx - v.x);
                api.knockback({ x: v.x - Math.cos(pa) * 12, y: v.y - Math.sin(pa) * 12 }, 40, Math.min(60, d), 0);
              }
            }
          }
          if (fx.age >= ARM_HOLD && fx.slam < 0) {
            fx.slam = +fx.age.toFixed(2);
            if (!fx.grab) { fx.hx = fx.cx; fx.hy = fx.cy; }
            api.strike(fx.hx, fx.hy, 145, D * 1.7, '#ff9040', 'crater');
            api.shake(18);
          }
        };
        st.hold = ARM_HOLD; st.holdMove = 'arms';
        st.plan = null;
        break;
      }
      case 'breath': {
        const x = z.x, y = z.y, ca = Math.cos(a), sa = Math.sin(a);
        const fx = addFx(st, { kind: 'breath', x: r1(x), y: r1(y), a, R: BREATH_R, half: BREATH_HALF, T: BREATH_T, dur: BREATH_T + 2.6, tick: 0, n: 0 });
        fx.upd = (fx, dt, api) => {
          if ((fx.tick -= dt) > 0) return;
          if (fx.age < fx.T) {
            fx.tick = .25; fx.n++;
            const reach = Math.min(1, fx.age / .35) * fx.R;
            for (const o of [-.6, 0, .6]) {
              const b = a + o * BREATH_HALF;
              api.line(x + ca * 90, y + sa * 90, x + Math.cos(b) * reach, y + Math.sin(b) * reach, 62, D * .42, o === 0 && fx.n % 2 ? 'fire' : null);
            }
          } else if (fx.age < fx.T + 2) {
            // the scorched ground keeps burning for a moment
            fx.tick = .5;
            api.strike(x + ca * fx.R * .62, y + sa * fx.R * .62, 190, D * .25, null, null, true);
          }
        };
        api.shake(10);
        st.hold = BREATH_T; st.holdMove = 'breath';
        break;
      }
      case 'mega': {
        const T = st.plan || { x: st.tx, y: st.ty }, M = st.mouth, R = MEGA_R;
        const fx = addFx(st, { kind: 'mega', mx: M.x, my: M.y, x: T.x, y: T.y, R, fly: MEGA_FLY, dur: MEGA_FLY + 5.2, tick: .5 });
        later(st, MEGA_FLY, api => {
          api.strike(T.x, T.y, R, D * 5, '#ffb090', 'crater');
          api.world(T.x, T.y, 320, D * 4, 'crater');
          for (let i = 0; i < 5; i++) { const aa = i * TAU / 5 + .3; api.world(T.x + Math.cos(aa) * R * .6, T.y + Math.sin(aa) * R * .6, 210, D * 3, 'crater', aa); }
          api.shake(34); api.burst(T.x, T.y - 60, '#ffc0a0', 40);
        });
        later(st, MEGA_FLY + .25, api => api.knockback(T, R * 1.25, 220, 0));
        fx.upd = (fx, dt, api) => {
          const u = fx.age - fx.fly;
          if (u > .45 && u < 3.0 && (fx.tick -= dt) <= 0) { fx.tick = .5; api.strike(fx.x, fx.y, fx.R * .55, D * .4, null, null, true); }
        };
        st.recoil = 1.4;
        st.hold = MEGA_FLY + .4; st.holdMove = 'mega';
        st.plan = null;
        break;
      }
      case 'slam': {
        const P = st.plan || { side: 1, x: st.tx, y: st.ty };
        const hit = (x, y, side, api) => {
          api.strike(x, y, SLAM_R, D * 2.0, null, 'crater', true);
          api.knockback({ x, y }, SLAM_R + 30, 150, 0);
          addFx(st, { kind: 'slam', x: r1(x), y: r1(y), dur: 1.7 });
          const r = st.reach; r.x = r1(x); r.y = r1(y); r.k = 1; r.up = 0; r.hold = .35; r.side = side;
          api.shake(18);
        };
        hit(P.x, P.y, P.side, api);
        // ...and the other paw comes down where the target fled to.
        const p = api.player, qx = p ? r1(p.x) : P.x, qy = p ? r1(p.y) : P.y;
        addFx(st, { kind: 'mark', x: qx, y: qy, r: SLAM_R, dur: .5 });
        later(st, .5, api => hit(qx, qy, -P.side, api));
        st.hold = .7; st.holdMove = 'slam';
        st.plan = null;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ update
  // It prowls to a spot just south of its target: a giant standing north of the camera's ninja
  // would tower off the top edge, so it looms up from below instead.
  function stomp(z, st, api, D) {
    const s = Math.sin(st.walk * TAU);
    if ((st.lastSin > 0) !== (s > 0)) {
      // A foot comes down: the ground shakes and whatever stood under it is flattened.
      const side = s > 0 ? -1 : 1, fx = z.x + side * 112 * SCALE, fy = z.y + 6;
      if (st.stomps.length >= 4) st.stomps.shift();
      st.stomps.push({ x: r1(fx), y: r1(fy), age: 0, seed: Math.round(Math.random() * 99) });
      if (api.blocked(fx, fy, 70)) api.world(fx, fy, 110, D * 5, 'earth');
      api.shake(4);
    }
    st.lastSin = s;
  }
  function walk(z, st, dt, api, p, d) {
    const D = api.damage || 60;
    if (z.manual) { manualWalk(z, st, dt, api, D); return; }
    st.mx = null;
    if (st.dash) { st.moving = 0; return; }
    const gx = p ? p.x + Math.max(-240, Math.min(240, z.x - p.x)) : z.x, gy = p ? p.y + 220 : z.y;
    const gd = Math.hypot(gx - z.x, gy - z.y);
    const want = p && st.windup <= 0 && st.hold <= 0 && (d > 900 || gd > (st.moving > .5 ? 40 : 110)) ? 1 : 0;
    st.moving += (want - st.moving) * Math.min(1, dt * 3);
    if (st.moving < .02) return;
    const stride = 1 + Math.min(2.2, Math.max(0, (d > 900 ? d - 600 : gd) - 180) / 160);
    st.walk += dt * .6 * st.moving * Math.min(1.8, stride);
    stomp(z, st, api, D);
    if (!p) return;
    const a = d > 900 ? Math.atan2(p.y - z.y, p.x - z.x) : Math.atan2(gy - z.y, gx - z.x), v = WALK_SPEED * stride * st.moving * dt;
    const nx = z.x + Math.cos(a) * v, ny = z.y + Math.sin(a) * v;
    if (api.blocked(nx, ny, 44)) {
      if (st.crushCd <= 0) { st.crushCd = .45; api.world(z.x + Math.cos(a) * 130, z.y + Math.sin(a) * 130, 150, D * 6, 'earth', a); }
      if (!api.blocked(nx, z.y, 44)) z.x = nx; else if (!api.blocked(z.x, ny, 44)) z.y = ny;
    } else { z.x = nx; z.y = ny; }
  }
  // Manual control: the game moves the body (WASD); the legs, stomps and crushing follow that motion.
  function manualWalk(z, st, dt, api, D) {
    const ox = st.mx == null ? z.x : st.mx, oy = st.mx == null ? z.y : st.my;
    const v = dt > 0 ? Math.hypot(z.x - ox, z.y - oy) / dt : 0;
    st.mx = r1(z.x); st.my = r1(z.y);
    st.moving += ((v > 6 && !st.dash ? 1 : 0) - st.moving) * Math.min(1, dt * 3);
    if (st.moving < .02) return;
    st.walk += dt * .6 * st.moving * Math.min(1.8, Math.max(1, v / WALK_SPEED));
    stomp(z, st, api, D);
    if (v > 6) {
      const a = Math.atan2(z.y - oy, z.x - ox);
      if (st.crushCd <= 0 && api.blocked(z.x + Math.cos(a) * 120, z.y + Math.sin(a) * 120, 44)) {
        st.crushCd = .45; api.world(z.x + Math.cos(a) * 130, z.y + Math.sin(a) * 130, 150, D * 6, 'earth', a);
      }
    }
  }
  // The claw rampage: the fox bounds along the marked lane, flattening what stands in it.
  function dashStep(z, st, dt, api) {
    const d = st.dash, D = api.damage || 60, ca = Math.cos(d.a), sa = Math.sin(d.a);
    d.t += dt;
    const k = easeInOut(d.t / CLAW_T), nx = lerp(d.x0, d.x1, k), ny = lerp(d.y0, d.y1, k);
    if (api.blocked(nx, ny, 50) && st.crushCd <= 0) { st.crushCd = .1; api.world(nx + ca * 70, ny + sa * 70, 180, D * 6, 'earth', d.a); }
    if (!api.blocked(nx, ny, 50)) { z.x = nx; z.y = ny; } else d.t = Math.max(d.t, CLAW_T);
    if (d.n < 5 && d.t >= d.n * .1) { d.n++; api.strike(z.x + ca * 70, z.y + sa * 70, 150, D * 1.15, null, d.n % 2 ? 'earth' : null, true); api.shake(7); }
    z.kageDash = Math.max(.05, CLAW_T - d.t);
    if (d.t >= CLAW_T) { st.dash = null; z.kageDash = 0; }
  }

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
    for (let i = st.stomps.length - 1; i >= 0; i--) if ((st.stomps[i].age += dt) > 1.2) st.stomps.splice(i, 1);
    if (z.health <= 0) { z.bossWindup = 0; z.manualBusy = false; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.dash = null; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.slamCd -= dt; st.crushCd -= dt;
    z.r = BODY_R;
    z.armorScale = m.armor || 1;
    // The game's own walk is switched off (speedScale ignores 0): the giant prowls by itself.
    // Under manual control the game walks it (WASD) at a giant's pace.
    z.speedScale = z.manual ? .75 : 1e-4;
    if (st.dash) dashStep(z, st, dt, api);

    const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
    walk(z, st, dt, api, p, d);
    st.near = p && !p.pseudo && d < 235 ? st.near + dt : 0;

    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && !st.dash) {
      st.holdMove = '';
      st.timer -= dt;
      if (z.manual) {
        if (z.manualCast != null) {
          const k = MANUAL[z.manualCast];
          z.manualCast = null;
          if (k) { st.force = k; announce(z, st, m, api); }
        }
      } else if (p && st.near > 1.5 && st.slamCd <= 0 && st.timer > .3) { st.slamCd = 10; st.force = 'slam'; announce(z, st, m, api); }
      else if (st.timer <= 0 && p && d < 1150) announce(z, st, m, api);
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || st.ev.length > 0 || !!st.dash;
    pose(z, st, dt, p);
  }

  // Smoothed body language read by the painter.
  function pose(z, st, dt, p) {
    const k = st.windup > 0 ? 1 - st.windup / st.windMax : 0, mv = st.windup > 0 ? st.move : '', hm = st.hold > 0 ? st.holdMove : '';
    const gape = mv === 'tbb' || mv === 'rapid' ? easeOut(k * 1.4) : mv === 'roar' ? k * .6 : mv === 'breath' ? .3 + .5 * k
      : mv === 'mega' ? (k < .78 ? .75 * easeOut(k * 3) : 0) : hm === 'roar' || hm === 'rapid' || hm === 'breath' ? 1 : hm === 'mega' ? .9 : mv === 'claw' ? .35 : hm === 'claw' ? .7 : 0;
    const raise = mv === 'mega' ? easeOut(k * 1.4) * .45 : hm === 'mega' ? .3 : 0;
    const rear = mv === 'roar' ? easeOut(k) : mv === 'mega' ? easeOut(k) * .8 : hm === 'roar' ? .6 : hm === 'mega' ? .5 : mv === 'breath' ? .3 * k : 0;
    const spread = mv === 'roar' ? easeOut(k) * .85 : hm === 'roar' ? 1 : 0;
    const crouch = mv === 'claw' ? easeOut(k) : hm === 'claw' ? (st.dash ? .7 : .4) : mv === 'arms' ? .45 * easeOut(k) : hm === 'arms' ? .3 : mv === 'sweep' ? .3 * k : 0;
    const tailsUp = mv === 'mega' ? easeOut(k * 1.5) : hm === 'mega' ? 1 : 0;
    const swallow = mv === 'mega' ? win(k, .78, 1) : 0;
    const lean = st.dash ? Math.cos(st.dash.a) * .32 : mv === 'claw' ? Math.cos(st.aim) * .14 * k : 0;
    const rage = mv || hm || st.dash ? 1 : 0;
    const f = Math.min(1, dt * 9);
    st.gape += (gape - st.gape) * f; st.raise += (raise - st.raise) * Math.min(1, dt * 6); st.rear += (rear - st.rear) * f;
    st.spread += (spread - st.spread) * Math.min(1, dt * 7); st.rage += (rage - st.rage) * Math.min(1, dt * 3);
    st.crouch += (crouch - st.crouch) * f; st.tailsUp += (tailsUp - st.tailsUp) * Math.min(1, dt * 5);
    st.swallow += (swallow - st.swallow) * Math.min(1, dt * 12); st.lean += (lean - st.lean) * Math.min(1, dt * 8);
    st.recoil = Math.max(0, st.recoil - dt * 2.2);
    const look = p ? Math.max(-34, Math.min(34, (p.x - z.x) * .06)) : 0;
    st.look += (look - st.look) * Math.min(1, dt * 3);
    // The paw smash: the hand rises over the target during the windup, then crashes down.
    const r = st.reach;
    if (mv === 'slam' && st.plan) { r.x = st.plan.x; r.y = st.plan.y; r.side = st.plan.side; r.k = easeOut(k * 1.5); r.up = 1; }
    else if (r.hold > 0) r.hold -= dt;
    else { r.k = Math.max(0, r.k - dt * 1.8); r.up = Math.max(0, r.up - dt * 2); }
    for (const key of ['gape', 'raise', 'rear', 'spread', 'rage', 'crouch', 'tailsUp', 'swallow', 'lean', 'look', 'recoil']) st[key] = Math.round(st[key] * 1000) / 1000;
  }

  // ------------------------------------------------------------------ cached art
  function rockSpr(i) {
    return Kit().sprite('ky:rock' + (i % 3), 64, 64, g => {
      const c = 32, R = 27, path = () => {
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = k / 8 * TAU, r = R * (.72 + hash(k % 8 + i * 9) * .28);
          if (k) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = ['#6a5446', '#7a6250', '#584638'][i % 3]; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = 'rgba(230,210,180,.4)'; g.beginPath(); g.arc(c - 9, c - 11, R * .55, 0, TAU); g.fill();
      g.fillStyle = 'rgba(30,16,10,.5)'; g.beginPath(); g.arc(c + 12, c + 14, R * .7, 0, TAU); g.fill();
      g.restore();
      path(); g.strokeStyle = '#1a0e08'; g.lineWidth = 3; g.stroke();
    });
  }
  function drawRock(ctx, i, x, y, s, rot, alpha = 1) {
    if (s < 1 || alpha <= .01) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(rockSpr(i), -s, -s, s * 2, s * 2);
    ctx.restore();
  }
  // Kurama's Bijūdama: a black core, a violet rim and a crimson halo.
  function orbSprite() {
    return Kit().sphere('ky:orb', [[0, '#9a6aa8'], [.14, '#341a38'], [.5, '#0e0610'], [.86, '#070207'], [.95, '#6a1a5a'], [1, 'rgba(230,60,50,0)']]);
  }
  function orbSwirl() { return Kit().swirl('ky:orbswirl', ['rgba(255,255,255,.9)', 'rgba(255,160,110,.85)', 'rgba(170,90,240,.85)'], 7, 1.1, .12, 128, 3); }
  // Claw gouge: three glowing furrows torn into the ground, cached once (long axis = x).
  function gougeSpr() {
    return Kit().sprite('ky:gouge', 256, 64, g => {
      for (let i = 0; i < 3; i++) {
        const y = 14 + i * 18;
        g.beginPath(); g.moveTo(6, y + 4); g.quadraticCurveTo(128, y - 8, 250, y + 2); g.quadraticCurveTo(128, y + 6, 6, y + 4); g.closePath();
        g.fillStyle = 'rgba(40,12,6,.85)'; g.lineWidth = 9; g.strokeStyle = 'rgba(40,12,6,.6)'; g.stroke(); g.fill();
        g.beginPath(); g.moveTo(20, y + 3); g.quadraticCurveTo(128, y - 5, 236, y + 2); g.strokeStyle = 'rgba(255,120,40,.95)'; g.lineWidth = 3.4; g.stroke();
        g.strokeStyle = 'rgba(255,235,180,.9)'; g.lineWidth = 1.2; g.stroke();
      }
    });
  }

  // ------------------------------------------------------------------ shared draw helpers
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(40,10,4,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(50,12,4,.45)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
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
    ctx.fillStyle = 'rgba(40,10,4,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
    ctx.strokeStyle = 'rgba(50,12,4,.45)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  // Wedge telegraph; arrows race round the arc the way the tails will sweep (dir ±1) or rush
  // outward along the wedge (dir 0: the breath).
  function markCone(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2, a0 = s.a - s.half, a1 = s.a + s.half, r0 = s.dir ? 100 : 80;
    const wedge = (ra, rb, b0, b1) => { ctx.beginPath(); ctx.arc(s.x, s.y, rb, b0, b1); ctx.arc(s.x, s.y, ra, b1, b0, true); ctx.closePath(); };
    wedge(r0, s.len, a0, a1); ctx.fillStyle = 'rgba(40,10,4,.16)'; ctx.fill();
    if (s.dir) {
      const from = s.dir > 0 ? a0 : a1, to = from + s.dir * 2 * s.half * clamp01(k);
      wedge(r0, s.len, Math.min(from, to), Math.max(from, to));
    } else wedge(r0, r0 + (s.len - r0) * clamp01(k), a0, a1);
    ctx.fillStyle = `rgba(${rgb},${.14 + .18 * k})`; ctx.fill();
    wedge(r0, s.len, a0, a1); ctx.strokeStyle = 'rgba(50,12,4,.45)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath();
    if (s.dir) {
      const from = s.dir > 0 ? a0 : a1;
      for (const r of [s.len * .45, s.len * .75]) {
        for (let j = 0; j < 6; j++) {
          const an = from + s.dir * 2 * s.half * frac(time * .7 + j / 6);
          const px = s.x + Math.cos(an) * r, py = s.y + Math.sin(an) * r, tx = -Math.sin(an) * s.dir, ty = Math.cos(an) * s.dir;
          const nx = Math.cos(an), ny = Math.sin(an);
          ctx.moveTo(px - tx * 14 + nx * 12, py - ty * 14 + ny * 12); ctx.lineTo(px, py); ctx.lineTo(px - tx * 14 - nx * 12, py - ty * 14 - ny * 12);
        }
      }
    } else {
      for (const o of [-.6, 0, .6]) {
        const an = s.a + o * s.half, ca = Math.cos(an), sa = Math.sin(an);
        for (let d = 120 + (time * 300) % 110; d < s.len - 20; d += 110) {
          const px = s.x + ca * d, py = s.y + sa * d;
          ctx.moveTo(px - ca * 16 - sa * 12, py - sa * 16 + ca * 12); ctx.lineTo(px, py); ctx.lineTo(px - ca * 16 + sa * 12, py - sa * 16 - ca * 12);
        }
      }
    }
    ctx.stroke();
  }
  function cracks(ctx, x, y, r, n, seed, alpha, w = 2.5) {
    if (alpha <= .01 || r < 4) return;
    ctx.strokeStyle = `rgba(36,16,10,${.7 * alpha})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 4.7 + seed) * .5, l = r * (.55 + hash(i * 9.1 + seed) * .45);
      ctx.moveTo(x + Math.cos(a) * r * .12, y + Math.sin(a) * r * .06);
      for (let k = 1; k <= 5; k++) {
        const b = a + (hash(i * 3 + k * 1.7 + seed) - .5) * .5, dd = l * k / 5;
        const nx = x + Math.cos(b) * dd, ny = y + Math.sin(b) * dd * .5;
        ctx.lineTo(nx, ny);
        if (k === 2) { const c = a + (hash(i + seed) > .5 ? .7 : -.7); ctx.lineTo(nx + Math.cos(c) * l * .22, ny + Math.sin(c) * l * .11); ctx.moveTo(nx, ny); }
      }
    }
    ctx.stroke();
  }
  function crater(ctx, x, y, r, alpha, seed) {
    if (alpha <= .01) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#5e4a40'; ctx.beginPath(); ctx.ellipse(x, y, r * .9, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#261812'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .7, r * .34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(230,190,160,.3)'; ctx.beginPath(); ctx.ellipse(x, y - r * .36, r * .7, r * .08, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    cracks(ctx, x, y, r * 1.35, 9, seed, alpha, 3);
  }
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10, kind = 'dust') {
    if (alpha <= .01) return;
    const K = Kit(), dust = K.puff(kind);
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  function drawOrb(ctx, x, y, r, time, seed, power) {
    const K = Kit();
    if (r < 1) return;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 2.9, '255,70,30', .38 * power);
    K.glow(ctx, x, y, r * 2.0, '150,70,255', .42 * power);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(50,8,40,.6)'; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, TAU); ctx.fill();
    ctx.drawImage(orbSprite(), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'lighter';
    K.spin(ctx, orbSwirl(), x, y, r * 1.12, time * 7 + seed, .55 * power);
    ctx.strokeStyle = `rgba(255,225,210,${.8 * power})`; ctx.lineWidth = Math.max(1.5, r * .04);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const t0 = time * (3 + i) + i * 2; ctx.moveTo(x + Math.cos(t0) * r * 1.2, y + Math.sin(t0) * r * .4); ctx.ellipse(x, y, r * 1.2, r * .4, i * 1.05 + time * .5, t0, t0 + 2.4); }
    ctx.stroke();
    K.glow(ctx, x - r * .35, y - r * .4, r * .35, '255,255,255', .35 * power, true);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Positive (white-blue) and negative (black-red) chakra motes spiralling into a point.
  function converge(ctx, x, y, r, reach, n, time, alpha) {
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ph = frac(time * 1.8 + hash(i * 2.7)), a = i * TAU / n + ph * 2.2;
      const d = r + (1 - ph) * (reach + hash(i) * reach * .5), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .8;
      const qx = x + Math.cos(a - .35) * (d + 22), qy = y + Math.sin(a - .35) * (d + 22) * .8;
      ctx.strokeStyle = i % 3 === 0 ? `rgba(60,6,20,${.8 * ph * alpha})` : i % 3 === 1 ? `rgba(255,90,40,${.85 * ph * alpha})` : `rgba(225,240,255,${.9 * ph * alpha})`;
      ctx.lineWidth = i % 3 === 0 ? 4 : 2.6;
      ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
    }
  }
  function blastO(ctx, x, y, R, u, span, time, seed) {
    const K = Kit(), k = Math.min(1, u / 1.4);
    ctx.globalCompositeOperation = 'lighter';
    if (u < .3) K.glow(ctx, x, y - R * .3, R * 1.5, '255,225,210', (1 - u / .3), true);
    ctx.globalCompositeOperation = 'source-over';
    K.fx.beastBlast(ctx, x, y, R, k, 1 - win(u, span - 1, span), time, seed);
    if (u < .5) {
      const q = u / .5, r = R * (.3 + .4 * easeOut(q));
      ctx.fillStyle = `rgba(14,2,12,${.85 * (1 - q)})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .8, 0, Math.PI, TAU); ctx.ellipse(x, y, r, r * .45, 0, 0, Math.PI); ctx.fill();
    }
    if (u < 1.2) K.fx.shockRing(ctx, x, y, R * 1.5, u / 1.2, 1 - u / 1.2, '255,140,90');
    if (u > .2 && u < 1.6) K.fx.shockRing(ctx, x, y, R * 1.9, (u - .2) / 1.4, 1 - (u - .2) / 1.4, '255,240,230');
    dustRing(ctx, x, y, R * (.35 + easeOut(u * 1.2) * .7), 18, 22 + u * 30, 1 - win(u, .6, 2.2), seed, 6 + u * 16);
    for (let i = 0; i < 7; i++) {
      const q = clamp01(u / 1.2 - hash(i) * .1), a = hash(i * 3.7 + seed) * TAU, d = R * (.3 + q * .8);
      if (q <= 0 || q >= 1) continue;
      drawRock(ctx, i, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - Math.sin(Math.PI * q) * R * .55, 12 + hash(i * 2.2) * 12, q * 8 + i);
    }
  }
  function blastG(ctx, x, y, R, u, fade, seed) {
    ctx.fillStyle = `rgba(40,8,24,${.42 * fade})`; ctx.beginPath(); ctx.ellipse(x, y, R * .95, R * .5, 0, 0, TAU); ctx.fill();
    crater(ctx, x, y, R * .55 * easeOut(u * 3), fade, seed);
    cracks(ctx, x, y, R * 1.1, 14, seed + 3, fade, 2.4);
  }
  // Burning ground: red chakra flames licking up over an area (deterministic, no particle list).
  function flameField(ctx, x, y, R, n, a, time, seed, pal, tag, size = 34) {
    const K = Kit();
    if (a <= .01) return;
    for (let i = 0; i < n; i++) {
      const an = hash(i * 2.9 + seed) * TAU, d = Math.sqrt(hash(i * 1.3 + seed)) * R, px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5;
      const fl = K.flame(i + Math.floor(time * 12), pal, tag), s = size + hash(i * 4.1 + seed) * size * .9;
      ctx.globalAlpha = a * (.6 + .4 * Math.sin(time * 9 + i));
      ctx.drawImage(fl, px - s * .25, py - s * .9, s * .5, s);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ moves: ground (G) and overlay (O)
  function roarG(ctx, fx) {
    const K = Kit(), t = fx.age, R = fx.R, e = easeOut(t / .6), fade = 1 - win(t, 1.4, fx.dur);
    ctx.fillStyle = `rgba(70,24,10,${.24 * fade})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * .6 * e, R * .3 * e, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, R * 1.05 * e, 18, fx.seed, fade, 2.8);
    for (let i = 0; i < 3; i++) {
      const tt = t - i * .14;
      if (tt > 0 && tt < 1.2) K.fx.shockRing(ctx, fx.x, fx.y, R * (1.05 + i * .2), tt / 1.2, (1 - tt / 1.2) * (1 - i * .2), i === 1 ? '255,250,240' : '255,120,60');
    }
    dustRing(ctx, fx.x, fx.y, R * (.2 + e * .95), 26, 24 + e * 36, .85 * (1 - win(t, .45, 2.0)), fx.seed, 6 + t * 16);
  }
  function roarO(ctx, fx, time, z, st) {
    const K = Kit(), t = fx.age;
    if (t > 1.6 || !st) return;
    const mx = st.mouth.x, my = st.mouth.y;
    // sound rings bursting out of the jaws and rolling down onto the ground
    for (let i = 0; i < 6; i++) {
      const ph = t * 1.5 - i * .14;
      if (ph <= 0 || ph >= 1) continue;
      const r = 50 + easeOut(ph) * 700, cy = lerp(my, fx.y, easeOut(ph)), a = (1 - ph) * (1 - win(t, 1.0, 1.6));
      ctx.lineWidth = 16 * (1 - ph) + 4; ctx.strokeStyle = `rgba(90,20,6,${.35 * a})`;
      ctx.beginPath(); ctx.ellipse(mx, cy, r, r * (.75 - ph * .25), 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 6 * (1 - ph) + 2; ctx.strokeStyle = `rgba(255,150,80,${.7 * a})`; ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(255,255,240,${.8 * a})`;
      ctx.beginPath(); ctx.ellipse(mx, cy, r * .97, r * (.73 - ph * .25), 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (t < .35) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, mx, my, 170, '255,170,110', 1 - t / .35, true); ctx.globalCompositeOperation = 'source-over'; }
    ctx.strokeStyle = `rgba(255,240,220,${.75 * (1 - t / 1.6)})`; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const an = i * TAU / 26 + hash(i * 1.7 + fx.seed) * .2, ra = 120 + easeOut(t * 1.5) * 380 * (.7 + hash(i * 3 + fx.seed) * .3), rb = ra + 50 + hash(i * 5) * 90;
      ctx.moveTo(fx.x + Math.cos(an) * ra, fx.y + Math.sin(an) * ra * .5 - 40); ctx.lineTo(fx.x + Math.cos(an) * rb, fx.y + Math.sin(an) * rb * .5 - 40);
    }
    ctx.stroke();
    K.fx.debris(ctx, fx.x, fx.y, fx.R * 1.1, t / 1.4, fx.seed, '#3e2a20', 22);
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + hash(fx.seed + i), q = easeOut(t * 1.1), d = fx.R * (.2 + q * (.75 + hash(i * 2.2) * .35)), h = bell(t * .9) * (60 + hash(i * 5) * 140);
      drawRock(ctx, i, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - h, 10 + hash(i * 7.7) * 12, t * 8 + i, 1 - win(t, 1.0, 1.6));
    }
  }

  function tbbG(ctx, fx, time) {
    const u = fx.age - fx.fly, fade = 1 - win(fx.age, fx.dur - 1, fx.dur);
    if (u < 0) markCircle(ctx, fx.x, fx.y, fx.R, '205,130,255', 1, time, false);
    else blastG(ctx, fx.x, fx.y, fx.R, u, fade, fx.seed);
  }
  function orbFlight(ctx, fx, k, r, time, arc) {
    const e = easeIn(k), x = lerp(fx.mx, fx.x, e), y = lerp(fx.my, fx.y - 50, e) - Math.sin(Math.PI * k) * arc;
    const k0 = Math.max(0, k - .18), e0 = easeIn(k0), x0 = lerp(fx.mx, fx.x, e0), y0 = lerp(fx.my, fx.y - 50, e0) - Math.sin(Math.PI * k0) * arc;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(60,8,30,.45)'; ctx.lineWidth = r * 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,90,60,.4)'; ctx.lineWidth = r * 1.1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,220,.5)'; ctx.lineWidth = r * .3; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    drawOrb(ctx, x, y, r, time, fx.seed, 1);
  }
  function tbbO(ctx, fx, time) {
    const u = fx.age - fx.fly;
    if (u < 0) { orbFlight(ctx, fx, fx.age / fx.fly, 54, time, 90); return; }
    blastO(ctx, fx.x, fx.y, fx.R, u, fx.dur - fx.fly, time, fx.seed);
  }

  function rapidG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const s of fx.spots) {
      const u = fx.age - s.t0 - (s.fly || .4);
      if (u < 0) { markCircle(ctx, s.x, s.y, RAPID_R, '215,140,255', clamp01(fx.age / (s.t0 + (s.fly || .4))), time, true, true); continue; }
      ctx.fillStyle = `rgba(40,8,30,${.36 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, RAPID_R * .85, RAPID_R * .42, 0, 0, TAU); ctx.fill();
      cracks(ctx, s.x, s.y, RAPID_R * 1.1, 7, s.seed, fade, 2);
      if (u < .5) Kit().fx.shockRing(ctx, s.x, s.y, RAPID_R * 1.5, u / .5, 1 - u / .5, '220,150,255');
    }
  }
  function rapidO(ctx, fx, time) {
    const K = Kit();
    for (const s of fx.spots) {
      const t = fx.age - s.t0, fly = s.fly || .4;
      if (t < 0) continue;
      if (t < fly) {
        const k = t / fly, e = easeIn(k), x = lerp(fx.mx, s.x, e), y = lerp(fx.my, s.y - 30, e) - Math.sin(Math.PI * k) * 60;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,100,70,.45)'; ctx.lineWidth = 16; ctx.lineCap = 'round';
        const k0 = Math.max(0, k - .25), e0 = easeIn(k0);
        ctx.beginPath(); ctx.moveTo(lerp(fx.mx, s.x, e0), lerp(fx.my, s.y - 30, e0) - Math.sin(Math.PI * k0) * 60); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        drawOrb(ctx, x, y, 20, time, s.seed, 1);
        continue;
      }
      const u = t - fly;
      if (u > 1.1) continue;
      const q = u / 1.1, R = RAPID_R;
      ctx.globalCompositeOperation = 'lighter';
      if (u < .18) K.glow(ctx, s.x, s.y - 30, R * 1.6, '255,225,215', 1 - u / .18, true);
      K.glow(ctx, s.x, s.y - 30, R * 1.3, '160,70,255', .45 * (1 - q));
      K.glow(ctx, s.x, s.y - 20, R * 1.1, '255,80,40', .3 * (1 - q));
      ctx.globalCompositeOperation = 'source-over';
      if (u < .45) {
        const r = R * (.35 + .6 * easeOut(u / .45)), a = 1 - u / .45;
        ctx.fillStyle = `rgba(20,4,16,${.8 * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .75, 0, Math.PI, TAU); ctx.ellipse(s.x, s.y, r, r * .42, 0, 0, Math.PI); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(240,200,255,${.9 * a})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .75, 0, Math.PI, TAU); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      dustRing(ctx, s.x, s.y, R * (.4 + q * .6), 8, 16 + q * 18, 1 - q, s.seed, 4 + q * 12);
      K.fx.debris(ctx, s.x, s.y, R, q, s.seed, '#2e1820', 6);
    }
  }

  // The claw rampage: a scoured lane, three burning gouges at its end and slash arcs in the air.
  function clawG(ctx, fx, time) {
    const t = fx.age, fade = 1 - win(t, fx.dur - .8, fx.dur), k = easeInOut(t / CLAW_T);
    const x1 = lerp(fx.x0, fx.x1, k), y1 = lerp(fx.y0, fx.y1, k), L = Math.hypot(x1 - fx.x0, y1 - fx.y0);
    if (L > 4) {
      ctx.save(); ctx.translate(fx.x0, fx.y0); ctx.rotate(fx.a);
      ctx.fillStyle = `rgba(60,30,18,${.26 * fade})`; ctx.beginPath(); ctx.ellipse(L / 2, 0, L / 2 + 60, 70, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(40,16,8,${.5 * fade})`; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let j = -2; j <= 2; j++) { ctx.moveTo(10, j * 22); ctx.quadraticCurveTo(L / 2, j * 26 + (hash(j + fx.seed) - .5) * 20, L, j * 18); }
      ctx.stroke();
      ctx.restore();
    }
    if (fx.st >= 0) {
      const u = t - fx.st, a = 1 - win(u, 1.2, fx.dur - fx.st);
      ctx.save(); ctx.translate(fx.sx, fx.sy); ctx.scale(1, .55); ctx.rotate(fx.a + Math.PI / 2 + .35);
      const w = SLASH_HALF * 2.3 * easeOut(u * 6);
      ctx.globalAlpha = a; ctx.drawImage(gougeSpr(), -w / 2, -70, w, 140); ctx.globalAlpha = 1;
      ctx.restore();
      if (u < 1.6) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, fx.sx, fx.sy, 220, '255,90,30', .4 * (1 - u / 1.6), false, .5); ctx.globalCompositeOperation = 'source-over'; }
      cracks(ctx, fx.sx, fx.sy, 260, 10, fx.seed + 5, a * .8, 2.4);
    }
  }
  function clawO(ctx, fx, time) {
    const K = Kit(), t = fx.age, k = easeInOut(t / CLAW_T);
    const x = lerp(fx.x0, fx.x1, k), y = lerp(fx.y0, fx.y1, k);
    if (t < CLAW_T + .4) {
      // a smear of red chakra and kicked-up dust behind the charging fox
      const a = 1 - win(t, CLAW_T, CLAW_T + .4), dust = K.puff('dust'), fire = K.puff('fire');
      for (let i = 0; i < 8; i++) {
        const q = i / 8, px = lerp(fx.x0, x, q), py = lerp(fx.y0, y, q);
        K.stamp(ctx, dust, px + (hash(i + fx.seed) - .5) * 90, py - 20 - hash(i * 3) * 30, 30 + q * 30, .7 * a * q, .75);
      }
      // speed lines streaming off the body at every height, over a faint red chakra smear
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,70,20,${.14 * a})`; ctx.lineWidth = 220;
      ctx.beginPath(); ctx.moveTo(lerp(fx.x0, x, .35), lerp(fx.y0, y, .35) - 160); ctx.lineTo(x, y - 160); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      const L = Math.hypot(x - fx.x0, y - fx.y0), ux = L ? (x - fx.x0) / L : 0, uy = L ? (y - fx.y0) / L : 0;
      for (let i = 0; i < 9; i++) {
        const h = 30 + hash(i * 2.7 + fx.seed) * 340, back = 140 + hash(i * 4.1 + fx.seed) * 260, off = (hash(i * 1.3) - .5) * 260, j = frac(t * 3 + hash(i));
        const hx = x - uy * off * .3 - ux * (60 + j * 80), hy = y + ux * off * .3 - uy * (60 + j * 80) - h;
        ctx.strokeStyle = `rgba(90,20,6,${.35 * a})`; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * back, hy - uy * back); ctx.stroke();
        ctx.strokeStyle = i % 3 ? `rgba(255,150,70,${.8 * a})` : `rgba(255,245,225,${.9 * a})`; ctx.lineWidth = 3; ctx.stroke();
      }
      for (let j = 0; j < 3; j++) K.stamp(ctx, fire, x - Math.cos(fx.a) * (60 + j * 50), y - 120 - Math.sin(fx.a) * (60 + j * 50), 40 - j * 8, .6 * a);
    }
    if (fx.st >= 0) {
      const u = t - fx.st;
      if (u < .5) {
        // three crescent rakes flashing across the ground ahead
        const q = u / .5, ca = Math.cos(fx.a), sa = Math.sin(fx.a), px = -sa, py = ca;
        ctx.lineCap = 'round';
        for (let j = -1; j <= 1; j++) {
          const ox = fx.sx + ca * j * 64, oy = fx.sy + sa * j * 64 - 60;
          const ax = ox - px * SLASH_HALF - ca * 70, ay = oy - py * SLASH_HALF * .55 - sa * 70 * .55, bx = ox + px * SLASH_HALF + ca * 70, by = oy + py * SLASH_HALF * .55 + sa * 70 * .55;
          const mx = (ax + bx) / 2 + ca * 60, my = (ay + by) / 2 + sa * 30 - 30, e = easeOut(q * 2.5);
          const ex = lerp(ax, bx, e), ey = lerp(ay, by, e);
          ctx.strokeStyle = `rgba(70,10,4,${.5 * (1 - q)})`; ctx.lineWidth = 20 * (1 - q) + 4;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,120,40,${.85 * (1 - q)})`; ctx.lineWidth = 13 * (1 - q) + 3; ctx.stroke();
          ctx.strokeStyle = `rgba(255,250,230,${.95 * (1 - q)})`; ctx.lineWidth = 4 * (1 - q) + 1; ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      if (u < 1.3) {
        dustRing(ctx, fx.sx, fx.sy, 120 + easeOut(u * 1.5) * 170, 14, 24 + u * 26, 1 - u / 1.3, fx.seed, 6 + u * 18);
        K.fx.debris(ctx, fx.sx, fx.sy, 260, u / 1.1, fx.seed, '#3e2a20', 14);
      }
    }
  }

  // The tails stretched out over the ground, raking round the arc.
  const TL = new Float32Array(40), TR = new Float32Array(40);
  function groundTail(ctx, x0, y0, ang, len, w0, dir, lag, seed, time, alpha) {
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = ang - dir * lag * (t * t) + Math.sin(time * 9 + t * 7 + seed) * .03, d = 70 + t * len;
      const x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d - 60 * (1 - t) - 10;
      const w = w0 * Math.pow(Math.sin(Math.PI * (.2 + .8 * t)), .55) + 2, nx = -Math.sin(a), ny = Math.cos(a);
      TL[i * 2] = x + nx * w; TL[i * 2 + 1] = y + ny * w - w * .3; TR[i * 2] = x - nx * w; TR[i * 2 + 1] = y - ny * w - w * .3;
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(TL[0], TL[1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(TL[i * 2], TL[i * 2 + 1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(TR[i * 2], TR[i * 2 + 1]);
    ctx.closePath();
    ctx.fillStyle = C.fur; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,130,.6)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(TL[2] * .7 + TR[2] * .3, TL[3] * .7 + TR[3] * .3);
    for (let i = 2; i < N - 1; i++) ctx.lineTo(TL[i * 2] * .7 + TR[i * 2] * .3, TL[i * 2 + 1] * .7 + TR[i * 2 + 1] * .3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function sweepAngle(fx) { return lerp(fx.a0, fx.a1, easeOut(clamp01((fx.age - fx.t0) / fx.T))); }
  function sweepG(ctx, fx) {
    const K = Kit(), u = clamp01((fx.age - fx.t0) / fx.T), cur = sweepAngle(fx), fade = 1 - win(fx.age, 1.0, fx.dur);
    const lo = Math.min(fx.a0, cur), hi = Math.max(fx.a0, cur);
    if (hi - lo > .01) {
      ctx.save(); ctx.translate(fx.x, fx.y);
      ctx.beginPath(); ctx.arc(0, 0, fx.R, lo, hi); ctx.arc(0, 0, 110, hi, lo, true); ctx.closePath();
      ctx.fillStyle = `rgba(70,36,22,${.22 * fade})`; ctx.fill();
      ctx.strokeStyle = `rgba(40,18,10,${.45 * fade})`; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const r = 180 + i * 95; ctx.moveTo(Math.cos(lo) * r, Math.sin(lo) * r); ctx.arc(0, 0, r, lo, hi); }
      ctx.stroke();
      ctx.restore();
    }
    if (u > 0 && fx.age < fx.t0 + fx.T + .8) {
      const dust = K.puff('dust'), a = 1 - win(fx.age, fx.t0 + fx.T, fx.t0 + fx.T + .8);
      for (let i = 0; i < 9; i++) {
        const d = 160 + i * 66, an = cur - fx.dir * (.08 + hash(i) * .12);
        K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d - 14 - hash(i * 3) * 20, 26 + hash(i * 5) * 20, .7 * a, .7);
      }
    }
  }
  function sweepTails(ctx, fx, time) {
    const t = fx.age - fx.t0;
    if (t < -.06 || t > fx.T + .55) return;
    const cur = sweepAngle(fx), back = win(t, fx.T, fx.T + .55), len = (fx.R - 60) * (1 - back * .6);
    for (let i = 0; i < 5; i++) groundTail(ctx, fx.x, fx.y, cur - fx.dir * i * .07, len * (1 - i * .06), 40 - i * 3, fx.dir, .5 + i * .1, i * 2.3, time, 1 - back);
    // red chakra smouldering on the raking tails
    const K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x + Math.cos(cur) * len * .6, fx.y + Math.sin(cur) * len * .6 - 40, 200, '255,80,30', .3 * (1 - back), false, .5);
    ctx.globalCompositeOperation = 'source-over';
  }
  function sweepB(ctx, fx, time) { if (Math.sin(sweepAngle(fx)) < .2) sweepTails(ctx, fx, time); }
  function sweepO(ctx, fx, time) {
    const K = Kit(), t = fx.age - fx.t0;
    if (t < -.06 || t > fx.T + .55) return;
    const cur = sweepAngle(fx);
    if (t > 0 && t < fx.T + .3) {
      const a = 1 - win(t, fx.T, fx.T + .3);
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .55);
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const r = 200 + i * 90, from = cur - fx.dir * (.55 + i * .04);
        ctx.strokeStyle = `rgba(80,20,6,${.3 * a})`; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(0, -40 / .55, r, Math.min(from, cur), Math.max(from, cur)); ctx.stroke();
        ctx.strokeStyle = `rgba(255,236,210,${.75 * a})`; ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (Math.sin(cur) >= .2) sweepTails(ctx, fx, time);
    K.fx.debris(ctx, fx.x + Math.cos(cur) * fx.R * .7, fx.y + Math.sin(cur) * fx.R * .35, 160, clamp01(t / .6), fx.seed, '#3e2a20', 10);
  }

  // Giant chakra arms: translucent red-orange limbs with claws, reaching from the shoulders.
  function armsHand(fx, i, z, st) {
    const h = fx.hands[i], ext = easeOut(fx.age / ARM_EXT);
    const sx = st && st.sh[0] ? st.sh[i * 2] : (z ? z.x : h.x), sy = st && st.sh[1] ? st.sh[i * 2 + 1] : (z ? z.y - 230 : h.y);
    let tx = h.x, ty = h.y;
    if (fx.age > ARM_EXT) { tx = lerp(h.x, fx.hx + (i ? 34 : -34), clamp01((fx.age - ARM_EXT) * 4)); ty = lerp(h.y, fx.hy, clamp01((fx.age - ARM_EXT) * 4)); }
    // lift before the final slam, then the crash
    let lift = 0;
    if (fx.slam < 0 && fx.age > ARM_HOLD - .35) lift = easeOut((fx.age - (ARM_HOLD - .35)) / .35) * 150;
    const back = fx.slam >= 0 ? easeIn((fx.age - fx.slam - .25) / .6) : 0;
    const x = lerp(sx, tx, ext * (1 - back)), y = lerp(sy, ty - lift - 20, ext * (1 - back));
    return { sx, sy, x, y, back };
  }
  function armsG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    if (fx.age > ARM_EXT) {
      const u = fx.age - ARM_EXT;
      crater(ctx, fx.cx, fx.cy, ARM_R * .55 * easeOut(u * 5), fade * .8, fx.seed);
      if (u < .6) Kit().fx.shockRing(ctx, fx.cx, fx.cy, ARM_R * 1.4, u / .6, 1 - u / .6, '255,160,80');
    }
    if (fx.slam >= 0) {
      const u = fx.age - fx.slam;
      crater(ctx, fx.hx, fx.hy, 110 * easeOut(u * 5), fade, fx.seed + 7);
      if (u < .7) Kit().fx.shockRing(ctx, fx.hx, fx.hy, 200, u / .7, 1 - u / .7, '255,140,60');
    }
  }
  function armsO(ctx, fx, time, z, st) {
    const K = Kit();
    const alpha = 1 - win(fx.age, fx.dur - .7, fx.dur - .1);
    if (alpha <= .01) return;
    for (let i = 0; i < 2; i++) {
      const H = armsHand(fx, i, z, st);
      if (H.back >= 1) continue;
      const mx = (H.sx + H.x) / 2 + (i ? 60 : -60), my = Math.min(H.sy, H.y) - 90;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(90,10,4,${.42 * alpha})`; ctx.lineWidth = 64;
      ctx.beginPath(); ctx.moveTo(H.sx, H.sy); ctx.quadraticCurveTo(mx, my, H.x, H.y); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,70,20,${.42 * alpha})`; ctx.lineWidth = 52; ctx.stroke();
      ctx.strokeStyle = `rgba(255,160,70,${.5 * alpha})`; ctx.lineWidth = 28; ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,200,${.6 * alpha})`; ctx.lineWidth = 7; ctx.stroke();
      ctx.setLineDash([30, 26]); ctx.lineDashOffset = -time * 300 - i * 20;
      ctx.strokeStyle = `rgba(255,250,235,${.45 * alpha})`; ctx.lineWidth = 3; ctx.stroke();
      ctx.setLineDash([]);
      // the chakra hand: palm glow and five hooked claws, open while reaching, clenched once it grips
      const ang = Math.atan2(H.y - my, H.x - mx), closed = fx.age > ARM_EXT + .08 ? 1 : 0;
      K.glow(ctx, H.x, H.y, 90, '255,110,40', .7 * alpha);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,120,50,${.55 * alpha})`; ctx.strokeStyle = `rgba(110,16,6,${.7 * alpha})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(H.x, H.y, 40, 30, ang, 0, TAU); ctx.fill(); ctx.stroke();
      for (let f = -2; f <= 2; f++) {
        const fa = ang + f * (closed ? .32 : .5), L = closed ? 34 : 62, bx = H.x + Math.cos(ang + f * .45) * 30, by = H.y + Math.sin(ang + f * .45) * 24;
        const tx = bx + Math.cos(fa) * L, ty = by + Math.sin(fa) * L, cx = bx + Math.cos(fa - (closed ? 1.2 : .4)) * L * .7, cy = by + Math.sin(fa - (closed ? 1.2 : .4)) * L * .7;
        ctx.strokeStyle = `rgba(110,16,6,${.6 * alpha})`; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(cx, cy, tx, ty); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,170,90,${.75 * alpha})`; ctx.lineWidth = 9; ctx.stroke();
        ctx.strokeStyle = `rgba(255,250,230,${.8 * alpha})`; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    const fire = K.puff('fire');
    if (fx.age > ARM_EXT && fx.age < ARM_EXT + .9) {
      const u = (fx.age - ARM_EXT) / .9;
      dustRing(ctx, fx.cx, fx.cy, ARM_R * (.5 + u * .6), 12, 22 + u * 20, 1 - u, fx.seed, 6 + u * 16);
    }
    if (fx.slam >= 0 && fx.age - fx.slam < 1.1) {
      const u = (fx.age - fx.slam) / 1.1;
      dustRing(ctx, fx.hx, fx.hy, 80 + u * 120, 12, 24 + u * 26, 1 - u, fx.seed + 3, 6 + u * 18);
      for (let j = 0; j < 6; j++) { const an = j * TAU / 6 + fx.seed; K.stamp(ctx, fire, fx.hx + Math.cos(an) * (30 + u * 90), fx.hy + Math.sin(an) * (15 + u * 45) - 30 - u * 40, 30 - u * 14, .8 * (1 - u)); }
      K.fx.debris(ctx, fx.hx, fx.hy, 180, u, fx.seed, '#3e2a20', 12);
    }
  }

  // The red chakra-flame breath: a stream of fire billows pouring out of the jaws across the wedge.
  function breathG(ctx, fx, time) {
    const K = Kit(), t = fx.age, fade = 1 - win(t, fx.dur - .8, fx.dur), reach = Math.min(1, t / .35) * fx.R;
    ctx.save(); ctx.translate(fx.x, fx.y);
    ctx.beginPath(); ctx.arc(0, 0, reach, fx.a - fx.half, fx.a + fx.half); ctx.arc(0, 0, 90, fx.a + fx.half, fx.a - fx.half, true); ctx.closePath();
    ctx.fillStyle = `rgba(50,14,6,${.3 * fade})`; ctx.fill();
    ctx.restore();
    const cx = fx.x + Math.cos(fx.a) * fx.R * .6, cy = fx.y + Math.sin(fx.a) * fx.R * .6;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, fx.R * .55, '255,90,30', .35 * fade * Math.min(1, t * 3), false, .5);
    ctx.globalCompositeOperation = 'source-over';
    // flames left burning on the ground
    for (let i = 0; i < 14; i++) {
      const d = 140 + hash(i * 3.3 + fx.seed) * (fx.R - 160), b = fx.a + (hash(i * 1.7 + fx.seed) - .5) * 2 * fx.half * .85;
      if (d > reach) continue;
      const px = fx.x + Math.cos(b) * d, py = fx.y + Math.sin(b) * d, s = 40 + hash(i * 5.1) * 36;
      const fl = K.flame(i + Math.floor(time * 12), KY_FLAME, 'ky');
      ctx.globalAlpha = fade * (.55 + .4 * Math.sin(time * 9 + i)) * (1 - win(t, fx.T + 1.2, fx.dur));
      ctx.drawImage(fl, px - s * .25, py - s * .9, s * .5, s);
    }
    ctx.globalAlpha = 1;
  }
  function breathO(ctx, fx, time, z, st) {
    const K = Kit(), t = fx.age;
    if (t > fx.T + .5) return;
    const M = st ? st.mouth : { x: fx.x, y: fx.y - 300 }, fire = K.puff('fire'), ember = K.puff('ember'), smoke = K.puff('smoke');
    const a = 1 - win(t, fx.T, fx.T + .5), reach = Math.min(1, t / .35);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, M.x, M.y, 150, '255,190,110', .8 * a, true);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 30; i++) {
      const ph = frac(t * 1.9 + hash(i * 1.37)), q = ph * reach;
      if (ph > reach + .05) continue;
      const b = fx.a + (hash(i * 3.1) - .5) * 2 * fx.half * q * .95, d = 70 + q * (fx.R - 70);
      const gx = fx.x + Math.cos(b) * d, gy = fx.y + Math.sin(b) * d;
      const x = lerp(M.x, gx, Math.pow(q, .8)), y = lerp(M.y, gy - 30, Math.pow(q, .6)), s = 22 + q * 70;
      K.stamp(ctx, i % 5 === 0 ? smoke : q > .7 ? ember : fire, x, y, s, a * (1 - q * .45) * (i % 5 === 0 ? .4 : .95));
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const ex = fx.x + Math.cos(fx.a) * fx.R * reach, ey = fx.y + Math.sin(fx.a) * fx.R * reach - 30;
    ctx.strokeStyle = `rgba(255,90,30,${.3 * a})`; ctx.lineWidth = 90;
    ctx.beginPath(); ctx.moveTo(M.x, M.y); ctx.quadraticCurveTo((M.x + ex) / 2, (M.y + ey) / 2 - 40, ex, ey); ctx.stroke();
    ctx.strokeStyle = `rgba(255,220,150,${.35 * a})`; ctx.lineWidth = 26; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  function megaG(ctx, fx, time) {
    const K = Kit(), u = fx.age - fx.fly, fade = 1 - win(fx.age, fx.dur - 1.2, fx.dur);
    if (u < 0) { markCircle(ctx, fx.x, fx.y, fx.R, '255,100,70', 1, time, false); return; }
    blastG(ctx, fx.x, fx.y, fx.R, u, fade, fx.seed);
    crater(ctx, fx.x, fx.y, fx.R * .32 * easeOut(u * 2), fade, fx.seed + 9);
    // the district burns with Kurama's red chakra fire and violet Bijūdama flames
    if (u > .3 && u < fx.dur - fx.fly) {
      const a = clamp01((u - .3) * 2) * fade;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y, fx.R * .85, '255,80,30', .3 * a, false, .5);
      K.glow(ctx, fx.x, fx.y, fx.R * .5, '150,70,255', .25 * a, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      flameField(ctx, fx.x, fx.y, fx.R * .75, 12, a, time, fx.seed, KY_FLAME, 'ky', 38);
      flameField(ctx, fx.x, fx.y, fx.R * .4, 6, a, time, fx.seed + 31, VIOLET_FLAME, 'kyv', 34);
    }
  }
  function megaO(ctx, fx, time) {
    const K = Kit(), u = fx.age - fx.fly;
    if (u < 0) { orbFlight(ctx, fx, fx.age / fx.fly, 150, time, 170); return; }
    const R = fx.R, span = fx.dur - fx.fly;
    ctx.globalCompositeOperation = 'lighter';
    if (u < .5) K.glow(ctx, fx.x, fx.y - R * .35, R * 2.2, '255,230,220', (1 - u / .5), true);
    ctx.globalCompositeOperation = 'source-over';
    blastO(ctx, fx.x, fx.y, R, u, span, time, fx.seed);
    for (let i = 0; i < 3; i++) { const tt = u - .1 - i * .22; if (tt > 0 && tt < 1.6) K.fx.shockRing(ctx, fx.x, fx.y, R * (2.2 + i * .3), tt / 1.6, (1 - tt / 1.6) * .9, i === 1 ? '255,255,255' : '255,120,70'); }
    if (u > .35) {
      const s = clamp01((u - .35) / 2.6), a = bell(Math.min(1, (u - .35) / (span - .6))) * .9, fire = K.puff('ember'), smoke = K.puff('smoke'), vio = K.puff('violet');
      for (let i = 0; i < 9; i++) {
        const h = R * (.1 + s * .75) * (i / 8), w = R * (.12 + s * .06);
        K.stamp(ctx, i % 3 === 0 ? fire : i % 3 === 1 ? smoke : vio, fx.x + Math.sin(time * 1.5 + i) * 10, fx.y - h, w * (1 + hash(i * 3 + fx.seed) * .4), a * (.45 + i * .04));
      }
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + hash(i + fx.seed) * .3, cx = fx.x + Math.cos(an) * R * (.12 + s * .28), cy = fx.y - R * (.1 + s * .75) + Math.sin(an) * R * .1;
        K.stamp(ctx, i % 3 ? smoke : fire, cx, cy, R * (.1 + s * .12), a * .6);
      }
      dustRing(ctx, fx.x, fx.y, R * (.6 + s * .5), 26, 40 + s * 40, a * .9, fx.seed + 4, 10 + s * 30);
    }
    for (let i = 0; i < 12; i++) {
      const q = clamp01(u / 1.6 - hash(i + 2) * .15), a = hash(i * 5.7 + fx.seed) * TAU, d = R * (.2 + q * 1.0);
      if (q > 0 && q < 1) drawRock(ctx, i, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * .5 - Math.sin(Math.PI * q) * R * .7, 14 + hash(i * 2.2) * 16, q * 7 + i);
    }
  }

  function slamG(ctx, fx) {
    const K = Kit(), t = fx.age, fade = 1 - win(t, 1.0, fx.dur);
    crater(ctx, fx.x, fx.y, SLAM_R * .75 * easeOut(t * 5), fade, fx.seed);
    cracks(ctx, fx.x, fx.y, SLAM_R * 1.5, 12, fx.seed + 4, fade, 2.6);
    if (t < .7) K.fx.shockRing(ctx, fx.x, fx.y, SLAM_R * 1.6, t / .7, 1 - t / .7, '255,170,100');
  }
  function slamO(ctx, fx) {
    const K = Kit(), t = fx.age;
    if (t > 1.2) return;
    dustRing(ctx, fx.x, fx.y, SLAM_R * (.5 + easeOut(t * 2) * .7), 14, 24 + t * 30, 1 - t / 1.2, fx.seed, 6 + t * 20);
    K.fx.debris(ctx, fx.x, fx.y, SLAM_R * 1.2, t / .9, fx.seed, '#3e2a20', 12);
  }
  function markG(ctx, fx, time) { markCircle(ctx, fx.x, fx.y, fx.r, '255,185,120', fx.age / fx.dur, time, false); }

  const FX = {
    roar: [roarG, roarO], tbb: [tbbG, tbbO], rapid: [rapidG, rapidO], sweep: [sweepG, sweepO, sweepB], claw: [clawG, clawO],
    arms: [armsG, armsO], breath: [breathG, breathO], mega: [megaG, megaO], slam: [slamG, slamO], mark: [markG, null]
  };

  // ------------------------------------------------------------------ the beast
  function limb(ctx, x0, y0, x1, y1, x2, y2, w, fill) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x1, y1, x2, y2);
    ctx.strokeStyle = C.line; ctx.lineWidth = w + 8; ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
  }
  // Four hooked black claws along the front of a paw.
  function claws(ctx, x, y, size, down) {
    ctx.fillStyle = C.claw; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    for (let c = -1.5; c <= 1.5; c++) {
      const bx = x + c * size * .62;
      ctx.beginPath();
      if (down) { ctx.moveTo(bx - size * .26, y); ctx.quadraticCurveTo(bx + c * size * .1, y + size * .6, bx + c * size * .16, y + size * 1.05); ctx.lineTo(bx + size * .26, y); }
      else { ctx.moveTo(bx - size * .26, y); ctx.quadraticCurveTo(bx + c * size * .2, y - size * .6, bx + c * size * .3, y - size * 1.05); ctx.lineTo(bx + size * .26, y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  function smoothPath(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    let mx = (pts[n - 1][0] + pts[0][0]) / 2, my = (pts[n - 1][1] + pts[0][1]) / 2;
    ctx.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
      const q = pts[(i + 1) % n];
      mx = (pts[i][0] + q[0]) / 2; my = (pts[i][1] + q[1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.closePath();
  }
  // Fur spikes: a row of jagged tufts from base points, pointing along `ang` (rad).
  function tufts(ctx, list, fill) {
    ctx.fillStyle = fill; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [x, y, ang, len, w] of list) {
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      ctx.moveTo(x + nx * w, y + ny * w);
      ctx.quadraticCurveTo(x + Math.cos(ang) * len * .5 + nx * w * .5, y + Math.sin(ang) * len * .5 + ny * w * .5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.quadraticCurveTo(x + Math.cos(ang) * len * .4 - nx * w * .4, y + Math.sin(ang) * len * .4 - ny * w * .4, x - nx * w, y - ny * w);
    }
    ctx.fill(); ctx.stroke();
  }
  const qPt = (p0, p1, p2, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];

  const TORSO = [[-96, -110], [-138, -170], [-160, -250], [-192, -330], [-124, -386], [0, -402], [124, -386], [192, -330], [160, -250], [138, -170], [96, -110], [0, -96]];
  const TP = TORSO.map(p => [p[0], p[1]]);
  const BL = new Float32Array(32), BR = new Float32Array(32);

  // Smooth outline through a strip of edge points (quadratic midpoints).
  function edgeTo(ctx, E, from, to, step) {
    for (let k = from; k !== to; k += step) {
      const q = k + step;
      ctx.quadraticCurveTo(E[k * 2], E[k * 2 + 1], (E[k * 2] + E[q * 2]) / 2, (E[k * 2 + 1] + E[q * 2 + 1]) / 2);
    }
    ctx.lineTo(E[to * 2], E[to * 2 + 1]);
  }
  function tailPath(ctx, N) {
    ctx.beginPath(); ctx.moveTo(BL[0], BL[1]);
    edgeTo(ctx, BL, 0, N, 1);
    edgeTo(ctx, BR, N, 0, -1);
    ctx.closePath();
  }
  // One of the nine tails: thick at the root, swelling bushy, tapering to a flicked point; they fan
  // up behind the fox like a crown of flames and wave out of phase.
  function drawTail(ctx, i, P, time, out) {
    const o = (i - 4) / 4, sgn = o < 0 ? -1 : 1, near = i % 2 === 1, ao = Math.abs(o);
    const bx = o * 60, by = -175 + P.U(-175);
    const a0 = lerp(-Math.PI / 2 + o * 1.28 + Math.sin(time * .8 + i * 2.1) * .06, -Math.PI / 2 + o * .8, P.tailsUp);
    const len = (560 + 60 * (1 - ao) + 40 * Math.sin(i * 1.9 + .5)) * (1 + .07 * P.rage + .1 * P.tailsUp);
    const curl0 = ao < .2 ? .35 * (i % 2 ? 1 : -1) : -sgn * (.75 + (i % 3) * .16), curl = lerp(curl0, -sgn * 1.1 + (ao < .2 ? .3 : 0), P.tailsUp);
    const N = 14, W = near ? 56 : 52;
    let x = bx, y = by;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = a0 + curl * t * t + Math.sin(time * (1.5 + P.rage * .9) + i * 1.3 - t * 4.6) * (.24 + P.rage * .1) * t;
      if (k) { x += Math.cos(a) * len / N; y += Math.sin(a) * len / N; }
      const w = W * Math.pow(Math.sin(Math.PI * (.16 + .84 * t)), .55) * (1 - .25 * t) + 1;
      const nx = -Math.sin(a), ny = Math.cos(a);
      BL[k * 2] = x + nx * w; BL[k * 2 + 1] = y + ny * w;
      BR[k * 2] = x - nx * w; BR[k * 2 + 1] = y - ny * w;
    }
    if (out) { out.tips[i * 2] = x; out.tips[i * 2 + 1] = y; }
    tailPath(ctx, N);
    ctx.fillStyle = near ? C.fur : C.far; ctx.fill();
    ctx.save(); ctx.clip();
    // shaded underside, lit upper side, fur clumps
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(120,28,6,.42)'; ctx.lineWidth = 26;
    ctx.beginPath(); ctx.moveTo(BR[0], BR[1]); edgeTo(ctx, BR, 0, N - 1, 1); ctx.stroke();
    ctx.strokeStyle = near ? 'rgba(255,190,110,.55)' : 'rgba(255,175,105,.38)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(BL[2] * .7 + BR[2] * .3, BL[3] * .7 + BR[3] * .3);
    for (let k = 3; k <= N - 2; k++) ctx.lineTo(BL[k * 2] * .7 + BR[k * 2] * .3, BL[k * 2 + 1] * .7 + BR[k * 2 + 1] * .3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,26,6,.45)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 3; k <= 11; k += 2) {
      const cx = (BL[k * 2] + BR[k * 2]) / 2, cy = (BL[k * 2 + 1] + BR[k * 2 + 1]) / 2, ex = BR[k * 2 + 4], ey = BR[k * 2 + 5];
      ctx.moveTo(BL[k * 2] * .4 + cx * .6, BL[k * 2 + 1] * .4 + cy * .6); ctx.quadraticCurveTo(cx, cy, cx * .5 + ex * .5, cy * .5 + ey * .5);
    }
    ctx.stroke();
    ctx.restore();
    tailPath(ctx, N);
    ctx.strokeStyle = C.line; ctx.lineWidth = 4.5; ctx.stroke();
  }

  // The whole fox in body-local units (feet at the origin, y up = negative). P is the pose; out
  // (optional) receives the local positions of the mouth, the shoulders and the tail tips.
  function paintBeast(ctx, P, time, out) {
    const K = Kit(), U = P.U;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // contact shadow
    ctx.fillStyle = 'rgba(30,8,4,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 260, 80, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(30,8,4,.22)'; ctx.beginPath(); ctx.ellipse(0, -4, 170, 46, 0, 0, TAU); ctx.fill();
    // chakra halo behind everything
    if (K) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, 0, -300, 440, '255,70,20', .07 + P.rage * .06 + Math.sin(time * 3) * .02, false, .9);
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---- the nine tails fanned out behind (outermost first)
    for (const i of [0, 8, 1, 7, 2, 6, 3, 5, 4]) drawTail(ctx, i, P, time, out);
    // ---- chakra flames licking off the silhouette (their bases hide behind the body)
    if (K) {
      const m = ctx.getTransform(), ga = ctx.globalAlpha;
      const pts = [[-196, -336, -.5], [196, -336, .5], [-178, -240, -.7], [178, -240, .7], [-130, -380, -.3], [130, -380, .3], [-70, -170, -.2], [70, -170, .2],
        [P.look - 120, -500, -.4], [P.look + 120, -500, .4]];
      pts.forEach(([x, y, lean], i) => {
        const h = (90 + hash(i * 3.3) * 50) * (1 + Math.sin(time * 11 + i * 1.7) * .12) * (1 + P.rage * .25);
        ctx.globalAlpha = ga * (.26 + .1 * Math.sin(time * 7 + i) + P.rage * .1);
        K.flameAt(ctx, m, K.flame(i + Math.floor(time * 10), KY_FLAME, 'ky'), x, y + U(y) + 30, h * .55, h, lean + Math.sin(time * 4 + i) * .15);
      });
      ctx.setTransform(m); ctx.globalAlpha = ga;
    }
    // ---- hind legs: big crouched haunches, paws flat on the ground
    const ph = Math.sin(P.walk * TAU), liftL = P.moving * Math.max(0, ph), liftR = P.moving * Math.max(0, -ph);
    for (const s of [-1, 1]) {
      const lift = s < 0 ? liftL : liftR, c = s < 0 ? C.fur : C.dark, cy = -128 - lift * 12 + P.crouch * 14;
      limb(ctx, s * 164, cy + 30, s * 186, -60 - lift * 18, s * 152, -26 - lift * 30, 46, c);
      ctx.fillStyle = c; ctx.strokeStyle = C.line; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(s * 124, cy, 76, 98, s * .38, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = s < 0 ? 'rgba(255,190,120,.45)' : 'rgba(120,30,6,.3)'; ctx.beginPath(); ctx.ellipse(s * 106, cy - 36, 34, 46, s * .38, 0, TAU); ctx.fill();
      tufts(ctx, [[s * 186, cy + 10, s * .2 + .3, 34, 12], [s * 192, cy + 40, s * .4 + .9, 30, 11]], c);
      ctx.fillStyle = c; ctx.strokeStyle = C.line; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(s * 150, -14 - lift * 30, 54, 20, 0, 0, TAU); ctx.fill(); ctx.stroke();
      claws(ctx, s * 150 + s * 4, -6 - lift * 30, 15, true);
    }
    // ---- the torso
    for (let i = 0; i < TORSO.length; i++) { TP[i][0] = TORSO[i][0] * (1 + P.spread * .04 + Math.sin(time * 1.6) * .012); TP[i][1] = TORSO[i][1] + U(TORSO[i][1]); }
    smoothPath(ctx, TP);
    ctx.fillStyle = C.fur; ctx.fill();
    ctx.save(); ctx.clip();
    const topY = -402 + U(-402);
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.ellipse(150, -220, 110, 220, -.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -70, 220, 60, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.light;
    ctx.beginPath(); ctx.ellipse(-90, topY + 80, 90, 46, -.35, 0, TAU); ctx.fill();
    // the pale chest ruff, jagged at its lower edge
    ctx.fillStyle = '#f9853a';
    ctx.beginPath(); ctx.moveTo(-96, topY + 30);
    for (let i = 0; i <= 8; i++) { const t = i / 8, x = -96 + t * 192, yb = topY + 150 + Math.sin(t * Math.PI) * 70; ctx.lineTo(x - 10, yb - 18); ctx.lineTo(x, yb + (i % 2 ? 0 : 16)); }
    ctx.lineTo(96, topY + 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(200,90,30,.35)';
    ctx.beginPath(); ctx.ellipse(40, topY + 130, 60, 70, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(110,30,6,.5)'; ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of [[-150, -200, -120, -170], [-160, -250, -132, -222], [140, -190, 112, -162], [150, -250, 124, -228], [-60, -140, -40, -120], [60, -140, 40, -120], [-20, -170, 0, -150]]) {
      ctx.moveTo(x0, y0 + U(y0)); ctx.quadraticCurveTo((x0 + x1) / 2 + 8, (y0 + y1) / 2 + U(y0), x1, y1 + U(y1));
    }
    ctx.stroke();
    ctx.restore();
    smoothPath(ctx, TP);
    ctx.strokeStyle = C.line; ctx.lineWidth = 5; ctx.stroke();
    // spiky fur at the shoulders
    for (const s of [-1, 1]) {
      const y0 = -336 + U(-336);
      tufts(ctx, [[s * 140, y0 - 34, -Math.PI / 2 + s * .7, 52, 18], [s * 176, y0 - 8, -Math.PI / 2 + s * 1.05, 54, 18], [s * 196, y0 + 30, -Math.PI / 2 + s * 1.4, 44, 15]], s < 0 ? C.fur : C.dark);
    }
    // ---- arms: thick furred forelegs, paws planted on the ground in front
    const reach = P.reach;
    for (const s of [-1, 1]) {
      const sx = s * 160, sy = -336 + U(-336), liftA = P.moving * Math.max(0, s < 0 ? -ph : ph);
      let ex = s * 262, ey = -214 + U(-214) * .5 + P.crouch * 16, hx = s * (232 + P.crouch * 28), hy = -30 - liftA * 30;
      ex = lerp(ex, s * 226, P.raise); ey = lerp(ey, -430 + U(-430), P.raise); hx = lerp(hx, s * 182, P.raise); hy = lerp(hy, -560 + U(-560), P.raise);
      ex = lerp(ex, s * 296, P.spread); ey = lerp(ey, -300 + U(-300), P.spread); hx = lerp(hx, s * 370, P.spread); hy = lerp(hy, -230 + U(-230), P.spread);
      if (reach && reach.k > .01 && reach.side === s) {
        hx = lerp(hx, reach.lx, reach.k); hy = lerp(hy, reach.ly - reach.up * 230, reach.k);
        ex = lerp(ex, (sx + hx) / 2 + s * 70, reach.k); ey = lerp(ey, Math.min(sy, hy) - 110, reach.k);
      }
      if (out) { out.sh[s < 0 ? 0 : 2] = sx; out.sh[s < 0 ? 1 : 3] = sy; }
      const fill = s < 0 ? C.fur : C.dark;
      limb(ctx, sx, sy, s * 236, sy - 18, ex, ey, 80, fill);
      // bulging biceps
      const bmx = (sx + ex) / 2 + s * 18, bmy = (sy + ey) / 2 - 18, ba = Math.atan2(ey - sy, ex - sx);
      ctx.fillStyle = fill; ctx.strokeStyle = C.line; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(bmx, bmy, 62, 40, ba, Math.PI, TAU); ctx.fill(); ctx.stroke();
      limb(ctx, ex, ey, (ex + hx) / 2 + s * 14, (ey + hy) / 2, hx, hy, 64, fill);
      ctx.strokeStyle = s < 0 ? 'rgba(255,200,130,.55)' : 'rgba(255,170,100,.3)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(sx - s * 6, sy - 22); ctx.quadraticCurveTo(s * 226, sy - 38, ex - s * 4, ey - 26); ctx.stroke();
      ctx.strokeStyle = 'rgba(110,26,6,.4)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(ex - s * 14, ey + 30); ctx.quadraticCurveTo((ex + hx) / 2 - s * 18, (ey + hy) / 2, hx - s * 20, hy - 50); ctx.stroke();
      // a ruff of fur at the elbow
      const ea = Math.atan2(ey - sy, ex - sx) + s * .9;
      tufts(ctx, [[ex + s * 18, ey, ea, 38, 13], [ex + s * 12, ey + 22, ea + s * .4, 30, 11]], fill);
      // the paw with black claws
      ctx.fillStyle = fill; ctx.strokeStyle = C.line; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(hx, hy - 12, 58, 34, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(110,26,6,.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); for (let f = -1; f <= 1; f++) { ctx.moveTo(hx + f * 24, hy + 4); ctx.lineTo(hx + f * 22, hy - 16); } ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,130,.4)'; ctx.beginPath(); ctx.ellipse(hx - 14, hy - 28, 24, 9, -.2, 0, TAU); ctx.fill();
      const pointUp = (P.raise > .5 || P.spread > .5) && !(reach && reach.k > .3 && reach.side === s);
      claws(ctx, hx, pointUp ? hy - 40 : hy + 8, 22, !pointUp);
    }
    // ---- the head
    const hx = P.look, hy = -458 + U(-458) - P.recoil * 12 + P.crouch * 26, g = P.gape, HS = 1.18;
    if (out) { out.mouth[0] = hx; out.mouth[1] = hy + (86 + g * 50) * HS; }
    ctx.save(); ctx.translate(hx, hy); ctx.scale(HS, HS);
    // long rabbit-like ears, flattened back when it roars
    for (const s of [-1, 1]) {
      const tw = Math.sin(time * 2.3 + s * 1.3) * 5, tipX = s * (158 + P.spread * 60) + tw, tipY = -276 + P.spread * 90 + P.crouch * 30;
      ctx.beginPath(); ctx.moveTo(s * 24, -100); ctx.quadraticCurveTo(s * 64, -230, tipX, tipY); ctx.quadraticCurveTo(s * 148, -150, s * 108, -54); ctx.closePath();
      ctx.fillStyle = s < 0 ? C.fur : C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 4.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 44, -94); ctx.quadraticCurveTo(s * 74, -200, lerp(s * 70, tipX, .86), lerp(-90, tipY, .86)); ctx.quadraticCurveTo(s * 128, -140, s * 94, -68); ctx.closePath();
      ctx.fillStyle = C.inner; ctx.fill();
      ctx.strokeStyle = 'rgba(210,60,30,.55)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(s * 70, -96); ctx.quadraticCurveTo(s * 92, -180, lerp(s * 70, tipX, .7), lerp(-90, tipY, .7)); ctx.stroke();
    }
    // cheek fur flaring out sideways
    for (const s of [-1, 1]) {
      tufts(ctx, [[s * 100, -26, s > 0 ? -.35 : Math.PI + .35, 64, 18], [s * 108, 10, s > 0 ? .05 : Math.PI - .05, 66, 18], [s * 98, 44, s > 0 ? .45 : Math.PI - .45, 58, 16]], s < 0 ? C.fur : C.dark);
    }
    // skull and jaw (the chin drops when the jaws open)
    const HEADP = [[-110, -26], [-98, -86], [-54, -120], [0, -128], [54, -120], [98, -86], [110, -26], [118, 26], [86, 74 + g * 16], [44, 104 + g * 52], [0, 112 + g * 76], [-44, 104 + g * 52], [-86, 74 + g * 16], [-118, 26]];
    smoothPath(ctx, HEADP);
    ctx.fillStyle = C.fur; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.dark; ctx.beginPath(); ctx.ellipse(104, 0, 46, 130, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 118 + g * 70, 100, 30, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,205,140,.5)'; ctx.beginPath(); ctx.ellipse(-34, -100, 54, 16, -.15, 0, TAU); ctx.fill();
    ctx.restore();
    smoothPath(ctx, HEADP); ctx.strokeStyle = C.line; ctx.lineWidth = 5; ctx.stroke();
    // forehead furrows
    ctx.strokeStyle = 'rgba(110,26,6,.55)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-10, -112); ctx.quadraticCurveTo(-16, -90, -8, -70); ctx.moveTo(10, -112); ctx.quadraticCurveTo(16, -90, 8, -70); ctx.stroke();
    // the black markings round the eyes, swept up toward the ears
    ctx.fillStyle = C.black;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 10, -10); ctx.quadraticCurveTo(s * 48, 6, s * 96, -44); ctx.quadraticCurveTo(s * 116, -66, s * 118, -92);
      ctx.quadraticCurveTo(s * 92, -78, s * 70, -72); ctx.quadraticCurveTo(s * 34, -66, s * 14, -40); ctx.closePath(); ctx.fill();
    }
    // red slit eyes glaring under heavy brows
    const flare = P.dying ? 0 : Math.max(P.rage, P.hit);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 22, -22); ctx.quadraticCurveTo(s * 46, -64, s * 90, -56); ctx.quadraticCurveTo(s * 64, -12, s * 22, -22); ctx.closePath();
      ctx.fillStyle = P.dying ? '#5a1a14' : '#c8100e'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = P.dying ? '#6a2a20' : '#ff5a22'; ctx.beginPath(); ctx.ellipse(s * 58, -46, 28, 11, -s * .4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffb060'; ctx.beginPath(); ctx.ellipse(s * 50, -48, 10, 4, -s * .4, 0, TAU); ctx.fill();
      ctx.fillStyle = C.black; ctx.beginPath(); ctx.ellipse(s * 55 + P.look * .12, -38, 4.6 - flare * 1.2, 16, -s * .22, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = C.black; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,230,.9)'; ctx.beginPath(); ctx.arc(s * 44 - 4, -44, 3.4, 0, TAU); ctx.fill();
      // angry brow ridge
      ctx.strokeStyle = C.deep; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(s * 12, -54); ctx.quadraticCurveTo(s * 52, -90, s * 104, -96); ctx.stroke();
    }
    // the muzzle with its black nose
    const MUZ = [[-28, -42], [28, -42], [48, 10], [52, 52], [0, 70], [-52, 52], [-48, 10]];
    smoothPath(ctx, MUZ); ctx.fillStyle = '#f06a24'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(180,60,14,.45)'; ctx.beginPath(); ctx.ellipse(36, 20, 20, 60, 0, 0, TAU); ctx.fill(); ctx.restore();
    smoothPath(ctx, MUZ); ctx.strokeStyle = 'rgba(90,24,6,.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,160,.5)'; ctx.beginPath(); ctx.ellipse(-8, -4, 9, 40, 0, 0, TAU); ctx.fill();
    // the grin: black lips stretched almost to the cheeks; the jaws gape wide for a Bijūdama
    const L0 = [-104, 40], L1 = [-56, 88], LM = [0, 78], R1 = [56, 88], R0 = [104, 40];
    if (g > .05) {
      const B1 = [60, 96 + g * 110], BM = [0, 100 + g * 122], B0 = [-60, 96 + g * 110];
      ctx.beginPath(); ctx.moveTo(L0[0], L0[1]); ctx.quadraticCurveTo(L1[0], L1[1], LM[0], LM[1]); ctx.quadraticCurveTo(R1[0], R1[1], R0[0], R0[1]);
      ctx.quadraticCurveTo(B1[0], B1[1], BM[0], BM[1]); ctx.quadraticCurveTo(B0[0], B0[1], L0[0], L0[1]); ctx.closePath();
      ctx.fillStyle = C.mouth; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = C.tongue; ctx.beginPath(); ctx.ellipse(0, 92 + g * 96, 50, 14 + g * 12, 0, 0, TAU); ctx.fill();
      if (P.swallow > .02 || P.rage > .5) { ctx.fillStyle = `rgba(255,120,60,${.25 + P.swallow * .5})`; ctx.beginPath(); ctx.ellipse(0, 70 + g * 60, 40, 20 + g * 30, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = C.tooth;
      ctx.beginPath();
      for (let i = 1; i < 10; i++) {
        const t = i / 10, [x, y] = t < .5 ? qPt(L0, L1, LM, t * 2) : qPt(LM, R1, R0, t * 2 - 1), fang = i === 2 || i === 8, l = fang ? 26 : 12;
        ctx.moveTo(x - 6, y - 2); ctx.lineTo(x, y + l); ctx.lineTo(x + 6, y - 2);
        const [bx, by] = t < .5 ? qPt(L0, B0, BM, t * 2) : qPt(BM, B1, R0, t * 2 - 1);
        if (i > 1 && i < 9) { ctx.moveTo(bx - 5.5, by + 2); ctx.lineTo(bx, by - (fang ? 20 : 10)); ctx.lineTo(bx + 5.5, by + 2); }
      }
      ctx.fill();
      ctx.strokeStyle = C.black; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(L0[0], L0[1]); ctx.quadraticCurveTo(L1[0], L1[1], LM[0], LM[1]); ctx.quadraticCurveTo(R1[0], R1[1], R0[0], R0[1]);
      ctx.quadraticCurveTo(B1[0], B1[1], BM[0], BM[1]); ctx.quadraticCurveTo(B0[0], B0[1], L0[0], L0[1]); ctx.stroke();
    } else {
      ctx.strokeStyle = C.black; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(L0[0], L0[1]); ctx.quadraticCurveTo(L1[0], L1[1], LM[0], LM[1]); ctx.quadraticCurveTo(R1[0], R1[1], R0[0], R0[1]); ctx.moveTo(0, 66); ctx.lineTo(0, 79); ctx.stroke();
      ctx.fillStyle = C.tooth;
      ctx.beginPath();
      for (const t of [.22, .32, .68, .78]) {
        const [x, y] = t < .5 ? qPt(L0, L1, LM, t * 2) : qPt(LM, R1, R0, t * 2 - 1), l = t === .32 || t === .68 ? 16 : 10;
        ctx.moveTo(x - 5, y + 1); ctx.lineTo(x, y + l); ctx.lineTo(x + 5, y + 1);
      }
      ctx.fill();
    }
    ctx.fillStyle = C.black; ctx.beginPath(); ctx.moveTo(-24, 50); ctx.quadraticCurveTo(0, 42, 24, 50); ctx.quadraticCurveTo(14, 70, 0, 68); ctx.quadraticCurveTo(-14, 70, -24, 50); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-8, 51, 8, 3, -.15, 0, TAU); ctx.fill();
    // ---- light: blazing eyes, a red-chakra rim when it rages
    if (K) {
      ctx.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) K.glow(ctx, s * 56, -40, 46 + flare * 16, '255,50,20', (P.dying ? .08 : .3) + flare * .35 + Math.sin(time * 4) * .05);
      if (P.swallow > .02) K.glow(ctx, 0, 60, 160, '255,120,60', P.swallow * .5);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    if (K) {
      ctx.globalCompositeOperation = 'lighter';
      if (P.hit > 0) K.glow(ctx, 0, -300, 300, '255,235,220', P.hit * .1);
      if (P.swallow > .02) K.glow(ctx, 0, -260, 300, '170,80,255', P.swallow * .35);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // Pose of the giant for this frame.
  function beastPose(z, st, time, dying) {
    const by = Math.sin(time * 1.6) * 5, up = -st.rear * 40 + st.crouch * 30 + st.recoil * 10;
    const r = st.reach, S = SCALE;
    return { by, up, U: y => y < -110 ? (by + up) * clamp01((-110 - y) / 170) : 0, look: dying ? 0 : st.look, gape: dying ? 0 : Math.max(.13, st.gape) * (1 - st.swallow),
      raise: st.raise, spread: st.spread, crouch: st.crouch, rage: dying ? 0 : st.rage, tailsUp: st.tailsUp, swallow: st.swallow,
      walk: st.walk, moving: st.moving, hit: z.hitFlash > 0 ? Math.min(1, z.hitFlash * 6) : 0, dying, recoil: st.recoil,
      reach: r.k > .01 && !dying ? { k: r.k, up: r.up, side: r.side, lx: (r.x - z.x) / S, ly: (r.y - z.y - 4) / S } : null };
  }
  const LOCAL = { tips: new Array(18).fill(0), sh: [0, 0, 0, 0], mouth: [0, 0] };
  function drawBeast(ctx, z, st, time, alpha, dying) {
    const S = SCALE, P = beastPose(z, st, time, dying);
    ctx.save();
    ctx.translate(z.x, z.y + 4);
    // leaning into the claw rampage
    if (Math.abs(st.lean) > .005) ctx.transform(1, 0, -st.lean * .6, 1, 0, 0);
    ctx.scale(S, S);
    ctx.globalAlpha = alpha;
    paintBeast(ctx, P, time, LOCAL);
    ctx.restore();
    // world-space anchors read by the jutsu painters (rounded: they ride in co-op snapshots)
    const sh = st.lean * .6;
    const wx = (lx, ly) => r1(z.x + lx * S - sh * ly * S), wy = ly => r1(z.y + 4 + ly * S);
    st.mouth.x = wx(LOCAL.mouth[0], LOCAL.mouth[1]); st.mouth.y = wy(LOCAL.mouth[1]);
    for (let i = 0; i < 9; i++) { st.tips[i * 2] = wx(LOCAL.tips[i * 2], LOCAL.tips[i * 2 + 1]); st.tips[i * 2 + 1] = wy(LOCAL.tips[i * 2 + 1]); }
    for (let i = 0; i < 2; i++) { st.sh[i * 2] = wx(LOCAL.sh[i * 2], LOCAL.sh[i * 2 + 1]); st.sh[i * 2 + 1] = wy(LOCAL.sh[i * 2 + 1]); }
  }

  // Stomp dust + cracks.
  function ambientG(ctx, z, st) {
    const K = Kit();
    for (const s of st.stomps) {
      const q = s.age / 1.2;
      cracks(ctx, s.x, s.y, 90, 7, s.seed, 1 - q, 2.4);
      dustRing(ctx, s.x, s.y, 50 + q * 90, 9, 20 + q * 24, (1 - q) * .8, s.seed, 4 + q * 16);
      if (q < .5) K.fx.shockRing(ctx, s.x, s.y, 150, q * 2, 1 - q * 2, '230,180,140');
    }
  }
  // Red chakra embers and heat rising off the fox.
  function ambientO(ctx, z, st, time, alpha) {
    const K = Kit(), S = SCALE, ember = K.puff('ember'), fire = K.puff('fire');
    for (let i = 0; i < 9; i++) {
      const ph = frac(time * (.34 + st.rage * .25) + i / 9);
      const px = z.x + (hash(i * 3.1) - .5) * 400 * S + Math.sin(ph * 5 + i) * 12, py = z.y - (200 + ph * 340) * S;
      K.stamp(ctx, i % 3 ? ember : fire, px, py, (14 + ph * 22) * S, bell(ph) * (.2 + st.rage * .2) * alpha);
    }
  }

  // ------------------------------------------------------------------ windup looks
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, M = st.mouth;
    switch (move) {
      case 'tbb': case 'rapid': {
        converge(ctx, M.x, M.y, 20, move === 'tbb' ? 160 : 90, 18, time, Math.min(1, k * 2));
        drawOrb(ctx, M.x, M.y - 10, move === 'tbb' ? 6 + 48 * easeOutBack(k) : 6 + 16 * e, time, 1, Math.min(1, .4 + k));
        break;
      }
      case 'roar': {
        ctx.save(); ctx.translate(z.x, z.y - 260);
        for (let i = 0; i < 3; i++) {
          const ph = frac(time * 1.6 + i / 3), r = 360 * (1 - ph) + 60;
          ctx.lineWidth = 6; ctx.strokeStyle = `rgba(110,24,8,${ph * .45})`; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .7, 0, 0, TAU); ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,220,190,${ph * .8})`; ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'breath': {
        converge(ctx, M.x, M.y, 16, 80, 12, time, k);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, M.x, M.y, 60 + 70 * e, '255,120,40', .5 + .4 * k, true);
        ctx.globalCompositeOperation = 'source-over';
        const fire = K.puff('fire');
        for (let i = 0; i < 5; i++) { const ph = frac(time * 2 + i / 5); K.stamp(ctx, fire, M.x + (hash(i) - .5) * 70, M.y - ph * 50, 12 + ph * 14, bell(ph) * .8 * k); }
        break;
      }
      case 'claw': {
        // red chakra boiling off the coiled body, claws glinting
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - 180, 300, '255,80,30', .3 * e, false, .7);
        for (const s of [-1, 1]) K.glow(ctx, z.x + s * 160 * SCALE, z.y - 20, 70, '255,200,140', .6 * e, true);
        ctx.globalCompositeOperation = 'source-over';
        const dust = K.puff('dust');
        for (let i = 0; i < 6; i++) { const ph = frac(time * 2.2 + i / 6); K.stamp(ctx, dust, z.x + (hash(i * 2) - .5) * 380, z.y - ph * 30, 20 + ph * 20, bell(ph) * .6 * k, .7); }
        break;
      }
      case 'arms': {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) if (st.sh[i * 2]) K.glow(ctx, st.sh[i * 2], st.sh[i * 2 + 1], 90 + 60 * e, '255,110,40', .5 * e);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'sweep': {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - 120, 280, '255,120,60', .25 * e, false, .6);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }
  }
  // The ultimate's orb: fed by all nine tails above the jaws, then swallowed whole.
  function megaChargeO(ctx, z, st, time, k) {
    const K = Kit(), M = st.mouth, grow = easeOut(k / .78), sw = win(k, .78, 1);
    const r = (22 + 128 * grow) * (1 - easeIn(sw) * .92), x = M.x, y = lerp(M.y - 250 * SCALE / .66 - r * .55, M.y, easeIn(sw));
    ctx.lineCap = 'round';
    if (sw < 1) {
      for (let i = 0; i < 9; i++) {
        const tx = st.tips[i * 2], ty = st.tips[i * 2 + 1];
        if (!tx) continue;
        const mx = (tx + x) / 2 + (hash(i) - .5) * 80, my = Math.min(ty, y) - 60, a = 1 - sw;
        for (const [style, w, dash] of [[`rgba(70,8,20,${.55 * a})`, 10, 0], [`rgba(255,120,60,${.75 * a})`, 5, 1], [`rgba(255,245,235,${.85 * a})`, 2, 1]]) {
          ctx.strokeStyle = style; ctx.lineWidth = w * (.5 + .5 * k);
          if (dash) { ctx.setLineDash([26, 18]); ctx.lineDashOffset = -time * 420 - i * 13; ctx.globalCompositeOperation = 'lighter'; }
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my, x, y); ctx.stroke();
          ctx.setLineDash([]); ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 3 + 40, '255,70,30', .12 + .12 * k);
    K.glow(ctx, x, y, r * 2.2 + 20, '150,70,255', .2 + .15 * k);
    ctx.globalCompositeOperation = 'source-over';
    converge(ctx, x, y, r, 160 + r, 22, time, 1 - sw * .7);
    drawOrb(ctx, x, y, r, time, 7, 1);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a0 = time * 3 + i * 1.57, a1 = a0 + 1.2 + Math.sin(time * 5 + i);
      K.forkedBolt(ctx, x + Math.cos(a0) * r * 1.05, y + Math.sin(a0) * r * 1.05, x + Math.cos(a1) * r * 1.3, y + Math.sin(a1) * r * 1.3, i * 9, time,
        { jitter: 14, alpha: .9, width: 1.6, pal: ['255,80,40', '255,170,120', '255,255,255'], base: 'rgba(70,10,20,.6)', forks: 1, forkLen: 30, rate: 24, snap: true });
    }
    // the swallowed ball glows through the fox's throat and chest
    if (sw > 0) {
      K.glow(ctx, z.x, z.y - 280 * SCALE, 220, '170,80,255', .5 * sw);
      K.glow(ctx, M.x, M.y - 20, 120, '255,200,160', .7 * sw, true);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function label(ctx, z, st, m, top) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    ctx.save();
    ctx.textAlign = 'center';
    // name + health over the ears (the game skips its own bar for a hidden body)
    const w = 190, x = z.x - w / 2, y = top;
    ctx.fillStyle = 'rgba(14,6,4,.82)'; ctx.fillRect(x - 2, y - 2, w + 4, 11);
    ctx.fillStyle = m.accent; ctx.fillRect(x, y, w * clamp01(z.health / z.maxHealth), 7);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w * clamp01(z.health / z.maxHealth), 2);
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#120804';
    ctx.strokeText(m.name, z.x, y - 7); ctx.fillStyle = '#fff2ea'; ctx.fillText(m.name, z.x, y - 7);
    if (move) {
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#1a0a04'; ctx.strokeText(MOVES[move].label, z.x, y - 25);
      ctx.fillStyle = `rgb(${MOVES[move].rgb})`; ctx.fillText(MOVES[move].label, z.x, y - 25);
    }
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
    for (let i = st.stomps.length - 1; i >= 0; i--) if ((st.stomps[i].age += dt) > 1.2) st.stomps.splice(i, 1);
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.ky;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    const live = z.health > 0 ? z : null;
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, live, st); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    ambientG(ctx, z, st);
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[2]) { f[2](ctx, fx, time, live, st); ctx.globalAlpha = 1; } }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
      for (const s of st.tele) {
        if (s.k === 'c') markCircle(ctx, s.follow ? z.x : s.x, s.follow ? z.y : s.y, s.r, rgb, k, time, s.faint, s.small);
        else if (s.k === 'line') markLine(ctx, s, rgb, k, time);
        else if (s.k === 'cone') markCone(ctx, s, rgb, k, time);
      }
    }
    // The giant itself (under the ninjas so they stay visible against it); it sinks and
    // dissolves into red chakra smoke when felled.
    if (z.health > 0) drawBeast(ctx, z, st, time, 1, false);
    else {
      const q = clamp01(1 - (z.deathTimer || 0) / 2.2);
      ctx.save(); ctx.translate(0, q * 70);
      drawBeast(ctx, z, st, time, 1 - win(q, .5, .85), true);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.ky;
    if (!m || !st || !Kit()) return;
    ctx.save();
    const live = z.health > 0 ? z : null;
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, live, st); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      ambientO(ctx, z, st, time, 1);
      if (st.windup > 0 && st.move) { windupO(ctx, z, st, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (st.move === 'mega' && st.windup > 0) megaChargeO(ctx, z, st, time, 1 - st.windup / st.windMax);
      label(ctx, z, st, m, z.y - (800 - st.crouch * 30 + st.rear * 40) * SCALE);
    } else {
      const K = Kit(), q = clamp01(1 - (z.deathTimer || 0) / 2.2), smoke = K.puff('smoke'), ember = K.puff('ember'), S = SCALE;
      for (let i = 0; i < 20; i++) {
        const ph = frac(q * 1.3 + hash(i * 1.9)), x = z.x + (hash(i * 3.3) - .5) * 520 * S, y = z.y - (30 + hash(i * 7.1) * 420 + ph * 120) * S;
        K.stamp(ctx, i % 2 ? smoke : ember, x, y, (50 + ph * 60) * S, Math.min(1, bell(ph) * 1.4) * .85 * bell(q * 1.05));
      }
      dustRing(ctx, z.x, z.y, 140 + q * 220, 16, 30 + q * 30, bell(q) * .8, z.seed || 1, 8 + q * 20);
    }
    ctx.restore();
  }

  function hidden() { return true; }

  // ------------------------------------------------------------------ sprite (spawn panel)
  // The panel bust is the very same painter, framed on the head; the humanoid spec only exists
  // for the sprite cache (the game hides it), so it stays a plain fox-coloured stand-in.
  const PORTRAIT_POSE = { by: 0, up: 0, U: () => 0, look: 4, gape: .32, raise: 0, spread: 0, crouch: 0, rage: .5, tailsUp: 0, swallow: 0,
    walk: 0, moving: 0, hit: 0, dying: false, recoil: 0, reach: null };
  function portrait(ctx, size) {
    ctx.save(); ctx.scale(size / 100, size / 100);
    ctx.translate(50, 66 + 458 * .168); ctx.scale(.168, .168);
    paintBeast(ctx, PORTRAIT_POSE, .7, null);
    ctx.restore();
  }
  function kuramaSpec() {
    const K = window.AnimeSprites.kit, O = C.line, FUR = C.fur, DK = C.dark;
    return {
      outline: O, skin: FUR, skinShade: DK, hunch: .18, headDrop: .6, bulk: .8, portrait,
      legs: { thigh: FUR, shin: FUR, foot: DK, w1: 6.4, w2: 5.4, boots: true },
      arms: { upper: FUR, lower: FUR, w1: 5.6, w2: 5 },
      torso: { base: FUR, paint: ctx => {
        ctx.fillStyle = C.pale; ctx.beginPath(); ctx.moveTo(-2.4, -12); ctx.lineTo(4.6, -12); ctx.lineTo(1.2, -5); ctx.closePath(); ctx.fill();
      } },
      head: {
        hair(ctx) {
          K.kuramaEar(ctx, -6, -7, 30, -120, 6, -1, K.KURAMA_EAR);
          K.kuramaEar(ctx, 2.2, -8, 29, -70, 5.8, 1, K.KURAMA_EAR);
        },
        noEyes: true, brows: false, blush: false,
        marks(ctx) {
          ctx.fillStyle = C.black; ctx.beginPath(); ctx.ellipse(4.6, 1.2, 2.6, 1.3, -.3, 0, TAU); ctx.fill();
          ctx.fillStyle = '#e0181a'; ctx.beginPath(); ctx.ellipse(4.6, 1.2, 1.6, .8, -.3, 0, TAU); ctx.fill();
        }
      }
    };
  }
  try {
    const AS = window.AnimeSprites;
    if (AS && AS.addSprite && AS.kit) AS.addSprite(ID, kuramaSpec(), { scale: .02 }, { hair: '#f0661c', fringe: 'bald', accent: '#ff6a1a' });
  } catch (e) { /* sprite registration is cosmetic */ }

  window.KyubiBoss = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden, moves };
})();
