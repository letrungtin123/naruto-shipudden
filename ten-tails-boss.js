(() => {
  'use strict';

  // The Ten-Tails (Jūbi) of the Fourth Great Ninja War (spawn panel, faction 'jubi').
  // A giant: the game hides its sprite (hidden(z)) and this module paints the whole beast, about
  // 550 px tall, in draw() (ground layer, under the ninjas so they stay readable) and its jutsu in
  // draw()/drawOverlay(). All per-boss state lives on z.jb. It plods toward its target and crushes
  // the houses in its way. Moves: Bijūdama, rapid-fire mini Bijūdama, the roar, the ten-tail
  // sweep, Wood Release stake forest, Ten-Tails clones (White Zetsu stand-ins), a meteor shower,
  // a giant palm slam when the target stands under it, the transformation into its taller second
  // form at half health, and the ultimate: the giant Tailed-Beast Bomb that levels a district.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeOutBack = t => { t = clamp01(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;

  const ID = 'jubi';
  const order = [ID];
  const members = {
    jubi: {
      name: 'THẬP VĨ · JŪBI', accent: '#c06aff', hpScale: 5.5, damageScale: 2.0, armor: .8,
      // Every jutsu shows once in the first ~25 s; the second lap reorders them.
      moves: ['roar', 'tbb', 'sweep', 'rapid', 'wood', 'clones', 'meteor', 'mega',
        'tbb', 'wood', 'sweep', 'meteor', 'rapid', 'roar', 'clones', 'tbb', 'mega']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    roar:   { label: 'THẬP VĨ · CHẤN THIÊN HỐNG', rgb: '205,165,255', windup: 1.0, after: 1.8 },
    tbb:    { label: 'VĨ THÚ NGỌC', rgb: '185,115,255', windup: 1.35, after: 2.0 },
    sweep:  { label: 'THẬP VĨ · CUỒNG VĨ TẢO', rgb: '235,210,255', windup: 1.05, after: 1.7 },
    rapid:  { label: 'VĨ THÚ NGỌC · LIÊN XẠ', rgb: '195,125,255', windup: .95, after: 2.0 },
    wood:   { label: 'MỘC ĐỘN · THỤ THỨ LÂM', rgb: '230,200,140', windup: 1.0, after: 2.0 },
    clones: { label: 'THẬP VĨ · PHÂN THÂN', rgb: '238,238,226', windup: .85, after: 1.5 },
    meteor: { label: 'THẬP VĨ · HỎA THIÊN THẠCH', rgb: '255,150,80', windup: 1.0, after: 2.6 },
    mega:   { label: 'THẬP VĨ · SIÊU CỰ VĨ THÚ NGỌC', rgb: '180,100,255', windup: 2.4, after: 3.6 },
    slam:   { label: 'THẬP VĨ · CỰ CHƯỞNG', rgb: '225,195,255', windup: .8, after: 1.1 },
    evolve: { label: 'THẬP VĨ · HOÀN THỂ', rgb: '255,95,120', windup: 1.6, after: 1.4 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;
  // Manual control (team mode): keys 1..8, ultimate last. Below half health key 1 becomes the evolution roar.
  const MANUAL = ['roar', 'tbb', 'sweep', 'rapid', 'wood', 'clones', 'meteor', 'mega'];
  const MANUAL_LIST = MANUAL.map(k => ({ label: MOVES[k].label }));
  const MANUAL_EVO = [{ label: MOVES.evolve.label }].concat(MANUAL_LIST.slice(1));
  const canEvolve = (z, st) => !st.evolved && st.form === 0 && z.health < z.maxHealth * .5;
  function moves(z) { return z && z.jb && canEvolve(z, z.jb) ? MANUAL_EVO : MANUAL_LIST; }
  // The unit a swat works on: api.player, or (manual mode: a cursor pseudo-target) the nearest foe.
  const victim = (api, x, y, r) => { const p = api.player; if (p && !p.pseudo) return p; return api.nearestFoe ? api.nearestFoe(x, y, r) : null; };

  const BODY_R = 108;
  const ROAR_R = 600, TBB_R = 360, TBB_SPEED = 1300, RAPID_R = 105;
  const SWEEP_R = 720, SWEEP_HALF = 1.05, SWEEP_T = .62;
  const WOOD_LEN = 900, WOOD_SPEED = 1150, METEOR_R = 150, MEGA_R = 720, MEGA_FLY = .8, SLAM_R = 170;
  const WALK_SPEED = 62;
  // Ten-Tails palette: ash-grey hide with a violet cast, bone horns and claws.
  const C = {
    line: '#130e17', skin: '#6d6577', light: '#958ca5', dark: '#463e51', deep: '#2e2836',
    far: '#575062', bone: '#e6dfd2', boneDark: '#a99f90', vein: 'rgba(30,20,40,.45)'
  };

  function pick() { return order[0]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.jb || (z.jb = { t: 0, casts: 0, timer: 1.0, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], force: null, hold: 0, holdMove: '', plan: null, sweepDir: 1,
      form: 0, grow: 0, evolved: false, walk: 0, moving: 0, lastSin: 0, crushCd: 0, stomps: [],
      near: 0, slamCd: 3, gape: 0, raise: 0, rear: 0, spread: 0, recoil: 0, look: 0, rage: 0,
      reach: [{ x: 0, y: 0, k: 0, up: 0 }, { x: 0, y: 0, k: 0, up: 0 }], tips: new Float32Array(20),
      mouth: { x: z.x, y: z.y - 330 }, crown: { x: z.x, y: z.y - 560 }, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = Math.random() * 99;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });
  // Body scale: the first form stands ~470 px tall; the second, complete form ~10% taller.
  const scaleOf = st => .78 * (1 + .1 * st.grow);

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move, api) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty;
    const circ = (cx, cy, r, faint, small) => ({ k: 'c', x: cx, y: cy, r, faint, small });
    switch (move) {
      case 'roar': case 'evolve': return [{ k: 'c', follow: true, r: ROAR_R + (move === 'evolve' ? 50 : 0) }, { k: 'c', follow: true, r: ROAR_R * .5, faint: true }];
      case 'tbb': {
        const L = Math.min(1000, Math.hypot(tx - x, ty - y)), ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
        st.plan = { x: ex, y: ey };
        return [{ k: 'line', x, y, a, len: L, w: 46 }, circ(ex, ey, TBB_R), circ(ex, ey, TBB_R * .5, true)];
      }
      case 'rapid': {
        const spots = [{ x: tx, y: ty }], b = Math.random() * TAU;
        for (let i = 0; i < 5; i++) spots.push({ x: tx + Math.cos(b + i * TAU / 5) * 175, y: ty + Math.sin(b + i * TAU / 5) * 175 });
        for (let i = 0; i < 7; i++) { const aa = b + (i + .5) * TAU / 7, d = rand(320, 400); spots.push({ x: tx + Math.cos(aa) * d, y: ty + Math.sin(aa) * d }); }
        // Fire order sweeps round the ring so the barrage walks across the ground.
        spots.forEach((s, i) => { s.t0 = i === 0 ? 0 : .1 + i * .11 + Math.random() * .04; s.seed = Math.random() * 99; });
        st.plan = spots;
        return spots.map(s => circ(s.x, s.y, RAPID_R, true, true));
      }
      case 'sweep': {
        st.sweepDir = Math.random() < .5 ? 1 : -1;
        return [{ k: 'cone', x, y, a, len: SWEEP_R, half: SWEEP_HALF, dir: st.sweepDir }];
      }
      case 'wood': {
        const lanes = [-.52, -.26, 0, .26, .52].map(o => ({ a: a + o, x0: x + Math.cos(a + o) * 150, y0: y + Math.sin(a + o) * 150 }));
        st.plan = lanes;
        return lanes.map(l => ({ k: 'line', x: l.x0, y: l.y0, a: l.a, len: WOOD_LEN - 150, w: 64 }));
      }
      case 'clones': return [{ k: 'c', follow: true, r: 270, faint: true }];
      case 'meteor': {
        const rocks = [{ x: tx, y: ty }];
        for (let i = 1; i < 9; i++) {
          const aa = Math.random() * TAU, d = 140 + Math.random() * 360;
          rocks.push({ x: tx + Math.cos(aa) * d, y: ty + Math.sin(aa) * d });
        }
        rocks.forEach((r, i) => { r.t = .55 + i * .26; r.seed = Math.random() * 99; r.r = METEOR_R * (i === 0 ? 1.15 : .9 + Math.random() * .2); });
        st.plan = rocks;
        return rocks.map(r => circ(r.x, r.y, r.r, true));
      }
      case 'mega': st.plan = { x: tx, y: ty }; return [circ(tx, ty, MEGA_R), circ(tx, ty, MEGA_R * .5, true), circ(tx, ty, MEGA_R * .2, true)];
      case 'slam': {
        const side = tx < x ? 0 : 1;
        st.plan = { side, x: tx, y: ty };
        return [circ(tx, ty, SLAM_R)];
      }
    }
    void api;
    return [];
  }

  function announce(z, st, m, api) {
    let move = st.force;
    if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup * (st.form && move !== 'mega' && move !== 'evolve' ? .88 : 1);
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.tele = teleFor(z, st, move, api);
    if (move === 'evolve') st.form = 1;
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, a = st.aim;
    switch (move) {
      case 'roar': case 'evolve': {
        const x = z.x, y = z.y, R = ROAR_R + (move === 'evolve' ? 50 : 0);
        addFx(st, { kind: 'roar', x, y, R, dur: 2.4, red: move === 'evolve' });
        if (move === 'evolve') { addFx(st, { kind: 'evolve', x, y, dur: 2.2 }); st.evolved = true; }
        api.knockback(z, R, 240, D * (move === 'evolve' ? 1.9 : 1.7));
        api.world(x, y, 280, D * 3, 'shockwave');
        for (let i = 0; i < 3; i++) { const aa = i * TAU / 3 + .3; api.world(x + Math.cos(aa) * 430, y + Math.sin(aa) * 430, 170, D * 2.4, 'shockwave', aa); }
        later(st, .4, api => { api.knockback(z, R * .7, 140, D * .6); api.shake(12); });
        api.burst(x, y - 60, '#d8c0ff', 24);
        api.shake(24);
        st.hold = .9; st.holdMove = 'roar';
        break;
      }
      case 'tbb': {
        const T = st.plan || { x: st.tx, y: st.ty }, M = st.mouth;
        const fly = Math.max(.32, Math.min(.85, Math.hypot(T.x - z.x, T.y - z.y) / TBB_SPEED));
        const fx = addFx(st, { kind: 'tbb', mx: M.x, my: M.y, x: T.x, y: T.y, R: TBB_R, fly, dur: fly + 3.3, tick: .35, big: 1 });
        later(st, fly, api => {
          api.strike(T.x, T.y, TBB_R, D * 3.2, '#b58aff', 'crater');
          for (let i = 0; i < 3; i++) api.world(T.x + Math.cos(i * TAU / 3 + .5) * TBB_R * .6, T.y + Math.sin(i * TAU / 3 + .5) * TBB_R * .6, 150, D * 2.4, 'crater');
          api.shake(24); api.burst(T.x, T.y - 40, '#c8a8ff', 30);
        });
        fx.upd = (fx, dt, api) => {
          const u = fx.age - fx.fly;
          if (u > .3 && u < 1.8 && (fx.tick -= dt) <= 0) { fx.tick = .45; api.strike(fx.x, fx.y, fx.R * .5, D * .45, null, null, true); }
        };
        st.recoil = 1;
        break;
      }
      case 'rapid': {
        const spots = st.plan || [], M = st.mouth;
        let last = 0;
        spots.forEach((s, i) => {
          s.fly = .38 + Math.hypot(s.x - z.x, s.y - z.y) / 3600;
          last = Math.max(last, s.t0 + s.fly);
          later(st, s.t0 + s.fly, api => {
            api.strike(s.x, s.y, RAPID_R, D * 1.15, null, i % 4 === 0 ? 'crater' : null, true);
            if (i % 3 === 0) api.shake(7);
          });
        });
        addFx(st, { kind: 'rapid', spots, mx: M.x, my: M.y, dur: last + 1.5 });
        st.hold = last - .3; st.holdMove = 'rapid';
        break;
      }
      case 'sweep': {
        const dir = st.sweepDir, a0 = a - dir * SWEEP_HALF, a1 = a + dir * SWEEP_HALF, x = z.x, y = z.y, t0 = .06;
        addFx(st, { kind: 'sweep', x, y, a0, a1, dir, R: SWEEP_R, t0, T: SWEEP_T, dur: 2.0 });
        const N = 14;
        for (let j = 0; j <= N; j++) {
          const u = j / N, aa = lerp(a0, a1, u), ca = Math.cos(aa), sa = Math.sin(aa);
          later(st, t0 + u * SWEEP_T, api => {
            api.line(x + ca * 110, y + sa * 110, x + ca * SWEEP_R, y + sa * SWEEP_R, 62, D * 2.0, j % 7 === 3 ? 'blade' : null);
            // Whoever the tails catch is swatted along the sweep.
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
      case 'wood': {
        const lanes = st.plan || [], spikes = [];
        let last = 0;
        lanes.forEach((l, li) => {
          const ca = Math.cos(l.a), sa = Math.sin(l.a);
          for (let d = 0, i = 0; d <= WOOD_LEN - 150; d += 76, i++) {
            const j = (hash(li * 31 + i * 7.7) - .5) * 40, x = l.x0 + ca * d - sa * j, y = l.y0 + sa * d + ca * j, t = .08 + d / WOOD_SPEED;
            spikes.push({ x, y, t, h: 120 + hash(li + i * 3.1) * 90 + d * .05, w: 30 + hash(i * 1.7 + li) * 14, lean: (hash(i * 5.3 + li * 2) - .5) * .5 + Math.sin(l.a) * 0, v: (li + i) % 3, seed: li * 13 + i });
            last = Math.max(last, t);
            later(st, t, api => { api.strike(x, y, 72, D * 1.35, null, null, true); if (i % 3 === 0) api.shake(5); });
          }
          // a thicket bursts up where each lane ends
          const ex = l.x0 + ca * (WOOD_LEN - 110), ey = l.y0 + sa * (WOOD_LEN - 110), te = .1 + (WOOD_LEN - 110) / WOOD_SPEED;
          for (let k = 0; k < 4; k++) {
            const aa = k * TAU / 4 + li, r = k ? 46 : 0;
            spikes.push({ x: ex + Math.cos(aa) * r, y: ey + Math.sin(aa) * r * .7, t: te + k * .03, h: 230 + k * 20, w: 44, lean: Math.cos(aa) * .35, v: k % 3, seed: li * 7 + k * 3 + 50 });
          }
          later(st, te, api => { api.strike(ex, ey, 130, D * 1.6, null, 'earth', true); api.shake(8); });
          last = Math.max(last, te + .1);
        });
        spikes.sort((p, q) => p.y - q.y);
        addFx(st, { kind: 'wood', spikes, last, dur: last + 2.6 });
        st.plan = null;
        break;
      }
      case 'clones': {
        const blobs = [];
        for (let i = 0; i < 10; i++) blobs.push({ a: i * TAU / 10 + rand(-.2, .2), d: rand(200, 430), h: rand(180, 300), t: i * .04 });
        addFx(st, { kind: 'clones', x: z.x, y: z.y, sh: 300 * scaleOf(st), blobs, dur: 2.0 });
        api.knockback(z, 260, 170, D * 1.0);
        later(st, .55, api => {
          let n = 0;
          for (let i = 0; i < 9; i++) if (api.summon('zetsu_white', z.x, z.y)) n++;
          if (n) api.shake(8);
        });
        api.shake(10);
        break;
      }
      case 'meteor': {
        const rocks = st.plan || [];
        let last = 0;
        rocks.forEach((r, i) => {
          last = Math.max(last, r.t);
          later(st, r.t, api => { api.strike(r.x, r.y, r.r, D * 1.9, null, i % 2 ? null : i % 4 ? 'fire' : 'crater', true); api.shake(10); });
        });
        const fx = addFx(st, { kind: 'meteor', rocks, dur: last + 2.4, tick: .5 });
        fx.upd = (fx, dt, api) => {
          if ((fx.tick -= dt) > 0) return;
          fx.tick = .5;
          // the craters keep burning for a moment
          for (const r of fx.rocks) { const u = fx.age - r.t; if (u > .2 && u < 1.8) api.strike(r.x, r.y, r.r * .6, D * .3, null, null, true); }
        };
        st.hold = .6; st.holdMove = 'meteor';
        st.plan = null;
        break;
      }
      case 'mega': {
        const T = st.plan || { x: st.tx, y: st.ty }, Cr = st.crown, R = MEGA_R;
        const fx = addFx(st, { kind: 'mega', mx: Cr.x, my: Cr.y, x: T.x, y: T.y, R, fly: MEGA_FLY, dur: MEGA_FLY + 5.2, tick: .5 });
        later(st, MEGA_FLY, api => {
          api.strike(T.x, T.y, R, D * 5, '#c8a8ff', 'crater');
          api.world(T.x, T.y, 320, D * 4, 'crater');
          for (let i = 0; i < 5; i++) { const aa = i * TAU / 5 + .3; api.world(T.x + Math.cos(aa) * R * .6, T.y + Math.sin(aa) * R * .6, 210, D * 3, 'crater', aa); }
          api.shake(34); api.burst(T.x, T.y - 60, '#d8c0ff', 40);
        });
        later(st, MEGA_FLY + .25, api => api.knockback(T, R * 1.25, 220, 0));
        fx.upd = (fx, dt, api) => {
          const u = fx.age - fx.fly;
          if (u > .45 && u < 3.0 && (fx.tick -= dt) <= 0) { fx.tick = .5; api.strike(fx.x, fx.y, fx.R * .55, D * .4, null, null, true); }
        };
        st.hold = MEGA_FLY + .4; st.holdMove = 'mega';
        st.plan = null;
        break;
      }
      case 'slam': {
        const P = st.plan || { side: 1, x: st.tx, y: st.ty }, side = P.side;
        const hit = (x, y, s, api) => {
          api.strike(x, y, SLAM_R, D * 2.1, null, 'crater', true);
          api.knockback({ x, y }, SLAM_R + 30, 150, 0);
          addFx(st, { kind: 'slam', x, y, dur: 1.7 });
          const r = st.reach[s]; r.x = x; r.y = y; r.k = 1; r.up = 0; r.hold = .35;
          api.shake(18);
        };
        hit(P.x, P.y, side, api);
        // ...and the other hand comes down where the target fled to.
        const p = api.player, qx = p ? p.x : P.x, qy = p ? p.y : P.y, o = st.reach[1 - side];
        o.x = qx; o.y = qy; o.k = 0; o.up = 1; o.go = .55; o.hold = 0;
        addFx(st, { kind: 'mark', x: qx, y: qy, r: SLAM_R, dur: .55 });
        later(st, .55, api => hit(qx, qy, 1 - side, api));
        st.hold = .75; st.holdMove = 'slam';
        st.plan = null;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ update
  // It plods to a spot just south of its target: on this top-down screen a giant standing north
  // of the camera's ninja would tower off the top edge, so it looms up from below instead.
  function walk(z, st, dt, api, p, d) {
    const D = api.damage || 60;
    if (z.manual) { manualWalk(z, st, dt, api, D); return; }
    st.mx = null;
    const gx = p ? p.x + Math.max(-240, Math.min(240, z.x - p.x)) : z.x, gy = p ? p.y + 300 : z.y;
    const gd = Math.hypot(gx - z.x, gy - z.y);
    const want = p && st.windup <= 0 && st.hold <= 0 && (d > 900 || gd > (st.moving > .5 ? 40 : 110)) ? 1 : 0;
    st.moving += (want - st.moving) * Math.min(1, dt * 3);
    if (st.moving < .02) return;
    // longer, faster strides while it is far from where it wants to stand
    const stride = 1 + Math.min(2.2, Math.max(0, (d > 900 ? d - 600 : gd) - 180) / 160);
    st.walk += dt * .5 * st.moving * Math.min(1.8, stride);
    const s = Math.sin(st.walk * TAU);
    if ((st.lastSin > 0) !== (s > 0)) {
      // A foot comes down: the ground shakes and whatever stood under it is flattened.
      const side = s > 0 ? -1 : 1, S = scaleOf(st), fx = z.x + side * 112 * S, fy = z.y + 6;
      if (st.stomps.length >= 4) st.stomps.shift();
      st.stomps.push({ x: fx, y: fy, age: 0, seed: Math.random() * 99 });
      if (api.blocked(fx, fy, 70)) api.world(fx, fy, 110, D * 5, 'earth');
      api.shake(4);
    }
    st.lastSin = s;
    if (!p) return;
    const a = d > 900 ? Math.atan2(p.y - z.y, p.x - z.x) : Math.atan2(gy - z.y, gx - z.x), v = WALK_SPEED * stride * (st.form ? 1.2 : 1) * st.moving * dt;
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
    st.mx = z.x; st.my = z.y;
    st.moving += ((v > 6 ? 1 : 0) - st.moving) * Math.min(1, dt * 3);
    if (st.moving < .02) return;
    st.walk += dt * .5 * st.moving * Math.min(1.8, Math.max(1, v / WALK_SPEED));
    const s = Math.sin(st.walk * TAU);
    if ((st.lastSin > 0) !== (s > 0)) {
      const side = s > 0 ? -1 : 1, S = scaleOf(st), fx = z.x + side * 112 * S, fy = z.y + 6;
      if (st.stomps.length >= 4) st.stomps.shift();
      st.stomps.push({ x: fx, y: fy, age: 0, seed: Math.random() * 99 });
      if (api.blocked(fx, fy, 70)) api.world(fx, fy, 110, D * 5, 'earth');
      api.shake(4);
    }
    st.lastSin = s;
    if (v > 6) {
      const a = Math.atan2(z.y - oy, z.x - ox);
      if (st.crushCd <= 0 && api.blocked(z.x + Math.cos(a) * 120, z.y + Math.sin(a) * 120, 44)) {
        st.crushCd = .45; api.world(z.x + Math.cos(a) * 130, z.y + Math.sin(a) * 130, 150, D * 6, 'earth', a);
      }
    }
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
    if (z.health <= 0) { z.bossWindup = 0; z.manualBusy = false; st.ev.length = 0; st.hold = 0; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.slamCd -= dt; st.crushCd -= dt;
    if (st.form) st.grow = Math.min(1, st.grow + dt / 1.5);
    z.r = BODY_R * (1 + .1 * st.grow);
    z.armorScale = (m.armor || 1) * (st.move === 'evolve' ? .3 : 1);
    // The game's own walk is switched off (speedScale ignores 0): the giant plods by itself.
    // Under manual control the game walks it (WASD) at a giant's pace.
    z.speedScale = z.manual ? .7 : 1e-4;

    const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
    walk(z, st, dt, api, p, d);
    st.near = p && d < 235 ? st.near + dt : 0;

    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (st.form ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0) {
      st.holdMove = '';
      st.timer -= dt;
      if (z.manual) {
        if (z.manualCast != null) {
          let k = MANUAL[z.manualCast];
          z.manualCast = null;
          if (k === 'roar' && canEvolve(z, st)) k = 'evolve';
          if (k) { st.force = k; announce(z, st, m, api); }
        }
      } else if (canEvolve(z, st)) { st.force = 'evolve'; announce(z, st, m, api); }
      else if (p && st.near > 1.0 && st.slamCd <= 0 && st.timer > .3) { st.slamCd = 6.5; st.force = 'slam'; announce(z, st, m, api); }
      else if (st.timer <= 0 && p && d < 1150) announce(z, st, m, api);
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || st.ev.length > 0;
    pose(z, st, dt, p);
  }

  // Smoothed body language read by the painter.
  function pose(z, st, dt, p) {
    const k = st.windup > 0 ? 1 - st.windup / st.windMax : 0, mv = st.windup > 0 ? st.move : '', hm = st.hold > 0 ? st.holdMove : '';
    const gape = mv === 'tbb' || mv === 'rapid' ? easeOut(k * 1.4) : mv === 'roar' || mv === 'evolve' ? k * .7 : mv === 'mega' ? .5 + .3 * k
      : hm === 'roar' || hm === 'rapid' ? 1 : hm === 'mega' ? .8 : 0;
    const raise = mv === 'meteor' || mv === 'mega' ? easeOut(k * 1.6) : hm === 'meteor' || hm === 'mega' ? 1 : 0;
    const rear = mv === 'roar' || mv === 'evolve' ? easeOut(k) : hm === 'roar' ? .6 : 0;
    const spread = mv === 'roar' || mv === 'evolve' ? easeOut(k) * .8 : hm === 'roar' ? 1 : mv === 'clones' ? k * .5 : 0;
    const rage = mv || hm ? 1 : 0;
    const f = Math.min(1, dt * 9);
    st.gape += (gape - st.gape) * f; st.raise += (raise - st.raise) * Math.min(1, dt * 6); st.rear += (rear - st.rear) * f;
    st.spread += (spread - st.spread) * Math.min(1, dt * 7); st.rage += (rage - st.rage) * Math.min(1, dt * 3);
    st.recoil = Math.max(0, st.recoil - dt * 2.2);
    const look = p ? Math.max(-34, Math.min(34, (p.x - z.x) * .06)) : 0;
    st.look += (look - st.look) * Math.min(1, dt * 3);
    // The giant palm: the hand rises over the target during the windup, then smashes down.
    if (mv === 'slam' && st.plan) {
      const r = st.reach[st.plan.side];
      r.x = st.plan.x; r.y = st.plan.y; r.k = easeOut(k * 1.5); r.up = 1;
    }
    for (const r of st.reach) {
      if (r.go > 0) { r.go -= dt; r.k = Math.min(1, r.k + dt * 3.2); r.up = 1; continue; }
      if (r.hold > 0) { r.hold -= dt; continue; }
      if (!(mv === 'slam' && st.plan && r === st.reach[st.plan.side])) { r.k = Math.max(0, r.k - dt * 1.8); r.up = Math.max(0, r.up - dt * 2); }
    }
  }

  // ------------------------------------------------------------------ cached art
  function rockSpr(i) {
    return Kit().sprite('jb:rock' + (i % 3), 64, 64, g => {
      const c = 32, R = 27, path = () => {
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = k / 8 * TAU, r = R * (.72 + hash(k % 8 + i * 9) * .28);
          if (k) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = ['#5e5466', '#6c6272', '#4e4656'][i % 3]; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = 'rgba(210,200,220,.4)'; g.beginPath(); g.arc(c - 9, c - 11, R * .55, 0, TAU); g.fill();
      g.fillStyle = 'rgba(24,16,30,.5)'; g.beginPath(); g.arc(c + 12, c + 14, R * .7, 0, TAU); g.fill();
      g.restore();
      path(); g.strokeStyle = '#140e18'; g.lineWidth = 3; g.stroke();
    });
  }
  function drawRock(ctx, i, x, y, s, rot, alpha = 1) {
    if (s < 1 || alpha <= .01) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(rockSpr(i), -s, -s, s * 2, s * 2);
    ctx.restore();
  }
  // Burning meteor: dark rock with molten seams and a white-hot leading face.
  function meteorSpr() {
    return Kit().sprite('jb:meteor', 96, 96, g => {
      const c = 48, R = 40, path = () => {
        g.beginPath();
        for (let k = 0; k <= 10; k++) { const a = k / 10 * TAU, r = R * (.78 + hash(k % 10 + 3) * .22); if (k) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c); }
        g.closePath();
      };
      path(); g.fillStyle = '#3a2420'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = 'rgba(255,170,60,.9)'; g.beginPath(); g.arc(c + 14, c + 16, R * .62, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,240,190,.9)'; g.beginPath(); g.arc(c + 20, c + 22, R * .32, 0, TAU); g.fill();
      g.strokeStyle = '#ff9a3a'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) { let x = c + (hash(i) - .5) * 50, y = c + (hash(i + 9) - .5) * 50; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (hash(i * 3 + k) - .5) * 26; y += (hash(i * 5 + k) - .5) * 26; g.lineTo(x, y); } g.stroke(); }
      g.restore();
      path(); g.strokeStyle = '#140a08'; g.lineWidth = 3.5; g.stroke();
    });
  }
  // Ten-Tails Wood Release stake: a tapered bark-grey spike, base at the bottom centre.
  function spikeSpr(v) {
    return Kit().sprite('jb:spike' + v, 64, 224, g => {
      const base = 220, top = 6, hw = 26 - v * 2, lean = (v - 1) * 5;
      const path = () => {
        g.beginPath(); g.moveTo(32 - hw, base);
        g.quadraticCurveTo(32 - hw * .7 + lean * .2, base * .55, 32 + lean, top);
        g.quadraticCurveTo(32 + hw * .75 + lean * .2, base * .55, 32 + hw, base);
        g.closePath();
      };
      path(); g.fillStyle = '#7a6a58'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#4a3c32'; g.fillRect(32 + 2, 0, 40, 224);
      g.fillStyle = '#b8a88c'; g.beginPath(); g.moveTo(32 - hw + 4, base); g.quadraticCurveTo(32 - hw * .55, base * .55, 32 + lean - 2, top + 14); g.lineTo(32 - hw * .2, base); g.fill();
      g.strokeStyle = 'rgba(40,28,20,.55)'; g.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) { const x = 32 - hw * .7 + i * hw * .35; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean * .3, base * .5, 32 + lean, top + 20 + i * 6); g.stroke(); }
      // knots
      g.fillStyle = 'rgba(40,28,20,.6)';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(32 + (hash(v * 3 + i) - .5) * hw, 70 + i * 48, 3.5, 6, 0, 0, TAU); g.fill(); }
      g.restore();
      path(); g.strokeStyle = '#1e140e'; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke();
    });
  }
  // Wood-chip / bone violet flame palette for the giant bomb's burning crater.
  const VIOLET_FLAME = [[1, '#2c0a48'], [.84, '#5a1c96'], [.66, '#8e46e0'], [.46, '#c99cff'], [.25, '#f6ecff']];
  function orbSprite() {
    return Kit().sphere('jb:orb', [[0, '#7a6a9a'], [.14, '#2c2040'], [.5, '#0c0814'], [.86, '#060309'], [.95, '#4a1a80'], [1, 'rgba(120,60,220,0)']]);
  }
  function orbSwirl() { return Kit().swirl('jb:orbswirl', ['rgba(255,255,255,.9)', 'rgba(190,150,255,.85)', 'rgba(120,70,220,.85)'], 7, 1.1, .12, 128, 3); }

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
    ctx.fillStyle = 'rgba(24,12,30,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
    ctx.strokeStyle = 'rgba(30,16,44,.4)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  // Wedge telegraph; arrows race round the arc the way the tails will sweep.
  function markCone(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2, a0 = s.a - s.half, a1 = s.a + s.half;
    const wedge = (r0, r1, b0, b1) => { ctx.beginPath(); ctx.arc(s.x, s.y, r1, b0, b1); ctx.arc(s.x, s.y, r0, b1, b0, true); ctx.closePath(); };
    wedge(100, s.len, a0, a1); ctx.fillStyle = 'rgba(24,12,30,.16)'; ctx.fill();
    const from = s.dir > 0 ? a0 : a1, to = from + s.dir * 2 * s.half * clamp01(k);
    wedge(100, s.len, Math.min(from, to), Math.max(from, to)); ctx.fillStyle = `rgba(${rgb},${.14 + .18 * k})`; ctx.fill();
    wedge(100, s.len, a0, a1); ctx.strokeStyle = 'rgba(30,16,44,.4)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath();
    for (const r of [s.len * .45, s.len * .75]) {
      for (let j = 0; j < 6; j++) {
        const an = from + s.dir * 2 * s.half * frac(time * .7 + j / 6);
        const px = s.x + Math.cos(an) * r, py = s.y + Math.sin(an) * r, tx = -Math.sin(an) * s.dir, ty = Math.cos(an) * s.dir;
        const nx = Math.cos(an), ny = Math.sin(an);
        ctx.moveTo(px - tx * 14 + nx * 12, py - ty * 14 + ny * 12); ctx.lineTo(px, py); ctx.lineTo(px - tx * 14 - nx * 12, py - ty * 14 - ny * 12);
      }
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
    ctx.fillStyle = '#5c4c56'; ctx.beginPath(); ctx.ellipse(x, y, r * .9, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#241a22'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .7, r * .34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,200,.3)'; ctx.beginPath(); ctx.ellipse(x, y - r * .36, r * .7, r * .08, 0, 0, TAU); ctx.fill();
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
  // A Tailed-Beast Ball: black core, violet rim, white chakra wound round it.
  function drawOrb(ctx, x, y, r, time, seed, power) {
    const K = Kit();
    if (r < 1) return;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 2.8, '140,70,255', .5 * power);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(40,10,70,.6)'; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, TAU); ctx.fill();
    ctx.drawImage(orbSprite(), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'lighter';
    K.spin(ctx, orbSwirl(), x, y, r * 1.12, time * 7 + seed, .55 * power);
    ctx.strokeStyle = `rgba(230,210,255,${.8 * power})`; ctx.lineWidth = Math.max(1.5, r * .04);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const t0 = time * (3 + i) + i * 2; ctx.moveTo(x + Math.cos(t0) * r * 1.2, y + Math.sin(t0) * r * .4); ctx.ellipse(x, y, r * 1.2, r * .4, i * 1.05 + time * .5, t0, t0 + 2.4); }
    ctx.stroke();
    K.glow(ctx, x - r * .35, y - r * .4, r * .35, '255,255,255', .35 * power, true);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Dark and white chakra motes spiralling into a point.
  function converge(ctx, x, y, r, reach, n, time, alpha) {
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ph = frac(time * 1.8 + hash(i * 2.7)), a = i * TAU / n + ph * 2.2;
      const d = r + (1 - ph) * (reach + hash(i) * reach * .5), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .8;
      const qx = x + Math.cos(a - .35) * (d + 22), qy = y + Math.sin(a - .35) * (d + 22) * .8;
      ctx.strokeStyle = i % 2 ? `rgba(40,8,70,${.8 * ph * alpha})` : `rgba(255,235,255,${.9 * ph * alpha})`;
      ctx.lineWidth = i % 2 ? 4 : 2.4;
      ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
    }
  }
  // Orb explosion (Bijūdama): flash, violet dome, black core, rings, dust, thrown rocks.
  function blastO(ctx, x, y, R, u, span, time, seed) {
    const K = Kit(), k = Math.min(1, u / 1.4);
    ctx.globalCompositeOperation = 'lighter';
    if (u < .3) K.glow(ctx, x, y - R * .3, R * 1.5, '230,210,255', (1 - u / .3), true);
    ctx.globalCompositeOperation = 'source-over';
    K.fx.beastBlast(ctx, x, y, R, k, 1 - win(u, span - 1, span), time, seed);
    if (u < .5) {
      const q = u / .5, r = R * (.3 + .4 * easeOut(q));
      ctx.fillStyle = `rgba(10,2,18,${.85 * (1 - q)})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .8, 0, Math.PI, TAU); ctx.ellipse(x, y, r, r * .45, 0, 0, Math.PI); ctx.fill();
    }
    if (u < 1.2) K.fx.shockRing(ctx, x, y, R * 1.5, u / 1.2, 1 - u / 1.2, '200,150,255');
    if (u > .2 && u < 1.6) K.fx.shockRing(ctx, x, y, R * 1.9, (u - .2) / 1.4, 1 - (u - .2) / 1.4, '255,240,255');
    dustRing(ctx, x, y, R * (.35 + easeOut(u * 1.2) * .7), 18, 22 + u * 30, 1 - win(u, .6, 2.2), seed, 6 + u * 16);
    for (let i = 0; i < 7; i++) {
      const q = clamp01(u / 1.2 - hash(i) * .1), a = hash(i * 3.7 + seed) * TAU, d = R * (.3 + q * .8);
      if (q <= 0 || q >= 1) continue;
      drawRock(ctx, i, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - Math.sin(Math.PI * q) * R * .55, 12 + hash(i * 2.2) * 12, q * 8 + i);
    }
  }
  function blastG(ctx, x, y, R, u, fade, seed) {
    ctx.fillStyle = `rgba(30,10,46,${.42 * fade})`; ctx.beginPath(); ctx.ellipse(x, y, R * .95, R * .5, 0, 0, TAU); ctx.fill();
    crater(ctx, x, y, R * .55 * easeOut(u * 3), fade, seed);
    cracks(ctx, x, y, R * 1.1, 14, seed + 3, fade, 2.4);
  }

  // ------------------------------------------------------------------ moves: ground (G) and overlay (O)
  function roarG(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.R, e = easeOut(t / .6), fade = 1 - win(t, 1.4, fx.dur);
    ctx.fillStyle = `rgba(48,30,60,${.26 * fade})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * .6 * e, R * .3 * e, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, R * 1.05 * e, 18, fx.seed, fade, 2.8);
    const rgb = fx.red ? '255,120,140' : '205,170,255';
    for (let i = 0; i < 3; i++) {
      const tt = t - i * .14;
      if (tt > 0 && tt < 1.2) K.fx.shockRing(ctx, fx.x, fx.y, R * (1.05 + i * .2), tt / 1.2, (1 - tt / 1.2) * (1 - i * .2), i === 1 ? '255,255,255' : rgb);
    }
    dustRing(ctx, fx.x, fx.y, R * (.2 + e * .95), 26, 24 + e * 36, .85 * (1 - win(t, .45, 2.0)), fx.seed, 6 + t * 16);
  }
  function roarO(ctx, fx, time, z, st) {
    const K = Kit(), t = fx.age;
    if (t > 1.6 || !st) return;
    const mx = st.mouth.x, my = st.mouth.y;
    // The roar itself: sound rings bursting out of the maw and rolling down onto the ground.
    for (let i = 0; i < 6; i++) {
      const ph = t * 1.5 - i * .14;
      if (ph <= 0 || ph >= 1) continue;
      const r = 50 + easeOut(ph) * 720, cy = lerp(my, fx.y, easeOut(ph)), a = (1 - ph) * (1 - win(t, 1.0, 1.6));
      ctx.lineWidth = 16 * (1 - ph) + 4; ctx.strokeStyle = `rgba(40,20,70,${.35 * a})`;
      ctx.beginPath(); ctx.ellipse(mx, cy, r, r * (.75 - ph * .25), 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 6 * (1 - ph) + 2; ctx.strokeStyle = fx.red ? `rgba(255,140,160,${.7 * a})` : `rgba(215,185,255,${.7 * a})`; ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(255,255,255,${.8 * a})`;
      ctx.beginPath(); ctx.ellipse(mx, cy, r * .97, r * (.73 - ph * .25), 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (t < .35) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, mx, my, 160, fx.red ? '255,150,170' : '230,210,255', 1 - t / .35, true); ctx.globalCompositeOperation = 'source-over'; }
    // air streaks blasting outward
    ctx.strokeStyle = `rgba(245,235,255,${.75 * (1 - t / 1.6)})`; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const an = i * TAU / 26 + hash(i * 1.7 + fx.seed) * .2, r1 = 120 + easeOut(t * 1.5) * 380 * (.7 + hash(i * 3 + fx.seed) * .3), r2 = r1 + 50 + hash(i * 5) * 90;
      ctx.moveTo(fx.x + Math.cos(an) * r1, fx.y + Math.sin(an) * r1 * .5 - 40); ctx.lineTo(fx.x + Math.cos(an) * r2, fx.y + Math.sin(an) * r2 * .5 - 40);
    }
    ctx.stroke();
    K.fx.debris(ctx, fx.x, fx.y, fx.R * 1.1, t / 1.4, fx.seed, '#3b3040', 22);
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + hash(fx.seed + i), q = easeOut(t * 1.1), d = fx.R * (.2 + q * (.75 + hash(i * 2.2) * .35)), h = bell(t * .9) * (60 + hash(i * 5) * 140);
      drawRock(ctx, i, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - h, 10 + hash(i * 7.7) * 12, t * 8 + i, 1 - win(t, 1.0, 1.6));
    }
  }
  function evolveO(ctx, fx, time) {
    const K = Kit(), t = fx.age, a = 1 - win(t, .6, fx.dur);
    ctx.globalCompositeOperation = 'lighter';
    // a pillar of red-violet chakra torn up off the transformed body
    for (let i = 0; i < 5; i++) K.glow(ctx, fx.x, fx.y - 120 - i * 130, 220 - i * 20, i % 2 ? '255,80,110' : '170,80,255', .35 * a, false, 1.4);
    K.glow(ctx, fx.x, fx.y - 300, 520, '200,60,120', .3 * a);
    ctx.globalCompositeOperation = 'source-over';
    const vio = K.puff('violet');
    for (let i = 0; i < 14; i++) {
      const ph = frac(t * .8 + hash(i * 3.1)), x = fx.x + (hash(i) - .5) * 420, y = fx.y - 60 - ph * 520;
      K.stamp(ctx, vio, x, y, 40 + ph * 50, bell(ph) * .6 * a);
    }
  }

  function tbbG(ctx, fx, time) {
    const u = fx.age - fx.fly, fade = 1 - win(fx.age, fx.dur - 1, fx.dur);
    if (u < 0) markCircle(ctx, fx.x, fx.y, fx.R, '185,115,255', 1, time, false);
    else blastG(ctx, fx.x, fx.y, fx.R, u, fade, fx.seed);
  }
  function orbFlight(ctx, fx, k, r, time, arc) {
    const e = easeIn(k), x = lerp(fx.mx, fx.x, e), y = lerp(fx.my, fx.y - 50, e) - Math.sin(Math.PI * k) * arc;
    const k0 = Math.max(0, k - .18), e0 = easeIn(k0), x0 = lerp(fx.mx, fx.x, e0), y0 = lerp(fx.my, fx.y - 50, e0) - Math.sin(Math.PI * k0) * arc;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(40,10,70,.45)'; ctx.lineWidth = r * 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(160,100,255,.45)'; ctx.lineWidth = r * 1.1; ctx.stroke();
    ctx.strokeStyle = 'rgba(240,225,255,.5)'; ctx.lineWidth = r * .3; ctx.stroke();
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
      const u = fx.age - s.t0 - s.fly;
      if (u < 0) { markCircle(ctx, s.x, s.y, RAPID_R, '195,125,255', clamp01(fx.age / (s.t0 + s.fly)), time, true, true); continue; }
      ctx.fillStyle = `rgba(30,10,46,${.36 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, RAPID_R * .85, RAPID_R * .42, 0, 0, TAU); ctx.fill();
      cracks(ctx, s.x, s.y, RAPID_R * 1.1, 7, s.seed, fade, 2);
      if (u < .5) Kit().fx.shockRing(ctx, s.x, s.y, RAPID_R * 1.5, u / .5, 1 - u / .5, '200,150,255');
    }
  }
  function rapidO(ctx, fx, time) {
    const K = Kit();
    for (const s of fx.spots) {
      const t = fx.age - s.t0;
      if (t < 0) continue;
      if (t < s.fly) {
        const k = t / s.fly, e = easeIn(k), x = lerp(fx.mx, s.x, e), y = lerp(fx.my, s.y - 30, e) - Math.sin(Math.PI * k) * 60;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(170,110,255,.5)'; ctx.lineWidth = 16; ctx.lineCap = 'round';
        const k0 = Math.max(0, k - .25), e0 = easeIn(k0);
        ctx.beginPath(); ctx.moveTo(lerp(fx.mx, s.x, e0), lerp(fx.my, s.y - 30, e0) - Math.sin(Math.PI * k0) * 60); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        drawOrb(ctx, x, y, 20, time, s.seed, 1);
        continue;
      }
      const u = t - s.fly;
      if (u > 1.1) continue;
      const q = u / 1.1, R = RAPID_R;
      ctx.globalCompositeOperation = 'lighter';
      if (u < .18) K.glow(ctx, s.x, s.y - 30, R * 1.6, '235,215,255', 1 - u / .18, true);
      K.glow(ctx, s.x, s.y - 30, R * 1.3, '150,70,255', .5 * (1 - q));
      ctx.globalCompositeOperation = 'source-over';
      if (u < .45) {
        const r = R * (.35 + .6 * easeOut(u / .45)), a = 1 - u / .45;
        ctx.fillStyle = `rgba(16,4,28,${.8 * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .75, 0, Math.PI, TAU); ctx.ellipse(s.x, s.y, r, r * .42, 0, 0, Math.PI); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(230,200,255,${.9 * a})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .75, 0, Math.PI, TAU); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      dustRing(ctx, s.x, s.y, R * (.4 + q * .6), 8, 16 + q * 18, 1 - q, s.seed, 4 + q * 12);
      K.fx.debris(ctx, s.x, s.y, R, q, s.seed, '#2a1830', 6);
    }
  }

  // The tails stretched out over the ground, raking round the arc.
  const TL = new Float32Array(40), TR = new Float32Array(40);
  function groundTail(ctx, x0, y0, ang, len, w0, dir, lag, seed, time, alpha) {
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = ang - dir * lag * (t * t) + Math.sin(time * 9 + t * 7 + seed) * .03, d = 70 + t * len;
      const x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d - 60 * (1 - t) - 10;
      const w = w0 * Math.pow(1 - t, .7) + 2, nx = -Math.sin(a), ny = Math.cos(a);
      TL[i * 2] = x + nx * w; TL[i * 2 + 1] = y + ny * w - w * .3; TR[i * 2] = x - nx * w; TR[i * 2 + 1] = y - ny * w - w * .3;
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(TL[0], TL[1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(TL[i * 2], TL[i * 2 + 1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(TR[i * 2], TR[i * 2 + 1]);
    ctx.closePath();
    ctx.fillStyle = C.skin; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(205,196,222,.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(TL[2] * .7 + TR[2] * .3, TL[3] * .7 + TR[3] * .3);
    for (let i = 2; i < N - 1; i++) ctx.lineTo(TL[i * 2] * .7 + TR[i * 2] * .3, TL[i * 2 + 1] * .7 + TR[i * 2 + 1] * .3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function sweepAngle(fx) { return lerp(fx.a0, fx.a1, easeOut(clamp01((fx.age - fx.t0) / fx.T))); }
  function sweepG(ctx, fx, time) {
    const K = Kit(), u = clamp01((fx.age - fx.t0) / fx.T), cur = sweepAngle(fx), fade = 1 - win(fx.age, 1.0, fx.dur);
    // the ground scoured where the tails dragged
    const lo = Math.min(fx.a0, cur), hi = Math.max(fx.a0, cur);
    if (hi - lo > .01) {
      ctx.save(); ctx.translate(fx.x, fx.y);
      ctx.beginPath(); ctx.arc(0, 0, fx.R, lo, hi); ctx.arc(0, 0, 110, hi, lo, true); ctx.closePath();
      ctx.fillStyle = `rgba(52,38,44,${.22 * fade})`; ctx.fill();
      ctx.strokeStyle = `rgba(30,20,26,${.45 * fade})`; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const r = 180 + i * 95; ctx.moveTo(Math.cos(lo) * r, Math.sin(lo) * r); ctx.arc(0, 0, r, lo, hi); }
      ctx.stroke();
      ctx.restore();
    }
    // dust thrown up along the leading edge
    if (u > 0 && fx.age < fx.t0 + fx.T + .8) {
      const dust = K.puff('dust'), a = 1 - win(fx.age, fx.t0 + fx.T, fx.t0 + fx.T + .8);
      for (let i = 0; i < 9; i++) {
        const d = 160 + i * 66, an = cur - fx.dir * (.08 + hash(i) * .12);
        K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d - 14 - hash(i * 3) * 20, 26 + hash(i * 5) * 20, .7 * a, .7);
      }
    }
  }
  // The tails themselves: drawn behind the body while they rake the far side (sweepB), in front
  // of it on the near side (sweepO).
  function sweepTails(ctx, fx, time) {
    const t = fx.age - fx.t0;
    if (t < -.06 || t > fx.T + .55) return;
    const cur = sweepAngle(fx), back = win(t, fx.T, fx.T + .55), len = (fx.R - 60) * (1 - back * .6);
    for (let i = 0; i < 4; i++) groundTail(ctx, fx.x, fx.y, cur - fx.dir * i * .07, len * (1 - i * .06), 34 - i * 3, fx.dir, .5 + i * .1, i * 2.3, time, 1 - back);
  }
  function sweepB(ctx, fx, time) { if (Math.sin(sweepAngle(fx)) < .2) sweepTails(ctx, fx, time); }
  function sweepO(ctx, fx, time) {
    const K = Kit(), t = fx.age - fx.t0;
    if (t < -.06 || t > fx.T + .55) return;
    const cur = sweepAngle(fx);
    // motion streaks over the swept arc
    if (t > 0 && t < fx.T + .3) {
      const a = 1 - win(t, fx.T, fx.T + .3);
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .55);
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const r = 200 + i * 90, from = cur - fx.dir * (.55 + i * .04);
        ctx.strokeStyle = `rgba(40,20,60,${.3 * a})`; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(0, -40 / .55, r, Math.min(from, cur), Math.max(from, cur)); ctx.stroke();
        ctx.strokeStyle = `rgba(250,245,255,${.75 * a})`; ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (Math.sin(cur) >= .2) sweepTails(ctx, fx, time);
    K.fx.debris(ctx, fx.x + Math.cos(cur) * fx.R * .7, fx.y + Math.sin(cur) * fx.R * .35, 160, clamp01(t / .6), fx.seed, '#3b3040', 10);
  }

  function woodG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    for (const s of fx.spikes) {
      const u = fx.age - s.t;
      if (u < 0) continue;
      ctx.fillStyle = `rgba(28,20,16,${.5 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.w * .75, s.w * .32, 0, 0, TAU); ctx.fill();
      if (s.seed % 2 === 0) cracks(ctx, s.x, s.y, s.w * 2.2, 5, s.seed, fade * Math.min(1, u * 5), 2);
    }
  }
  function woodO(ctx, fx, time) {
    const K = Kit(), dust = K.puff('dust'), retract = win(fx.age, fx.dur - .55, fx.dur);
    for (const s of fx.spikes) {
      const u = fx.age - s.t;
      if (u < 0) continue;
      const g = easeOutBack(u / .2) * (1 - easeIn(retract)), h = s.h * g;
      if (h > 2) {
        ctx.save(); ctx.translate(s.x, s.y + 4); ctx.rotate(s.lean * .6);
        ctx.drawImage(spikeSpr(s.v), -s.w, -h, s.w * 2, h);
        ctx.restore();
      }
      if (u < .6) {
        const q = u / .6;
        K.stamp(ctx, dust, s.x - s.w * .8, s.y - 6 - q * 16, s.w * (.6 + q * .7), (1 - q) * .8, .7);
        K.stamp(ctx, dust, s.x + s.w * .8, s.y - 4 - q * 12, s.w * (.5 + q * .6), (1 - q) * .7, .7);
      }
    }
  }

  function clonesO(ctx, fx, time) {
    const K = Kit(), poof = K.puff('poof'), smoke = K.puff('smoke');
    for (const b of fx.blobs) {
      const t = fx.age - b.t;
      if (t < 0) continue;
      const fl = .55, k = clamp01(t / fl), x = fx.x + Math.cos(b.a) * b.d * easeOut(k), gy = fx.y + Math.sin(b.a) * b.d * .6 * easeOut(k);
      if (t < fl) {
        const y = gy - fx.sh * (1 - k) - Math.sin(Math.PI * k) * b.h * .6;
        // a white husk pod with a dark seam, tumbling through the air
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 9 + b.a);
        ctx.fillStyle = '#efeee6'; ctx.strokeStyle = '#3c3e34'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(80,90,70,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(0, -4, 10, 0); ctx.stroke();
        ctx.restore();
      } else {
        const u = t - fl, q = clamp01(u / 1.1);
        if (q >= 1) continue;
        K.stamp(ctx, smoke, x, gy - 20 - q * 30, 26 + q * 26, (1 - q) * .45);
        K.stamp(ctx, poof, x, gy - 26 - q * 26, 22 + q * 22, (1 - q) * .9);
      }
    }
    // the pods tearing off the hide
    if (fx.age < .4) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - fx.sh, 200, '240,240,230', 1 - fx.age / .4); ctx.globalCompositeOperation = 'source-over'; }
  }
  function clonesG(ctx, fx) {
    for (const b of fx.blobs) {
      const t = fx.age - b.t - .55;
      if (t < 0) continue;
      const a = 1 - win(t, .8, 1.4), x = fx.x + Math.cos(b.a) * b.d, y = fx.y + Math.sin(b.a) * b.d * .6;
      ctx.fillStyle = `rgba(232,232,220,${.55 * a})`; ctx.beginPath(); ctx.ellipse(x, y, 30, 13, b.a, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(60,64,52,${.5 * a})`; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  const METEOR_FALL = .6;
  function meteorG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    for (const r of fx.rocks) {
      const u = fx.age - r.t;
      if (u < 0) { markCircle(ctx, r.x, r.y, r.r, '255,150,80', clamp01(1 - (r.t - fx.age) / 1.4), time, u < -.9, false); continue; }
      ctx.fillStyle = `rgba(40,16,8,${.45 * fade})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * .9, r.r * .45, 0, 0, TAU); ctx.fill();
      crater(ctx, r.x, r.y, r.r * .6, fade, r.seed);
      // embers smouldering in the crater
      if (u < 1.9) {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, r.x, r.y, r.r * .9, '255,110,30', .55 * (1 - u / 1.9), false, .5);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
  function meteorO(ctx, fx, time) {
    const K = Kit(), fire = K.puff('fire'), smoke = K.puff('smoke');
    for (let i = 0; i < fx.rocks.length; i++) {
      const r = fx.rocks[i], u = fx.age - r.t;
      if (u < -METEOR_FALL) continue;
      if (u < 0) {
        // streaking in from high up-left, trailing fire and smoke
        const k = 1 + u / METEOR_FALL, sx = r.x - 380, sy = r.y - 900, x = lerp(sx, r.x, k), y = lerp(sy, r.y - 20, k), ang = Math.atan2(r.y - sy, r.x - sx);
        for (let j = 6; j >= 1; j--) {
          const b = j * .045, tx = x - Math.cos(ang) * j * 46, ty = y - Math.sin(ang) * j * 46;
          K.stamp(ctx, smoke, tx + Math.sin(j + i) * 6, ty, 18 + j * 6, .45 * (1 - b * 2));
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,150,60,.55)'; ctx.lineWidth = 34;
        ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 200, y - Math.sin(ang) * 200); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,200,.7)'; ctx.lineWidth = 12; ctx.stroke();
        K.glow(ctx, x, y, 90, '255,140,40', .8);
        ctx.globalCompositeOperation = 'source-over';
        for (let j = 0; j < 3; j++) K.stamp(ctx, fire, x - Math.cos(ang) * (16 + j * 18), y - Math.sin(ang) * (16 + j * 18), 28 - j * 5, .9);
        ctx.save(); ctx.translate(x, y); ctx.rotate(time * 3 + i);
        ctx.drawImage(meteorSpr(), -34, -34, 68, 68);
        ctx.restore();
        // its shadow growing over the mark
        ctx.fillStyle = `rgba(20,8,4,${.35 * k})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, 40 * k + 10, 18 * k + 4, 0, 0, TAU); ctx.fill();
        continue;
      }
      if (u < 1.6) K.fx.fireBlast(ctx, r.x, r.y, r.r, Math.min(1, u / 1.3), 1 - win(u, 1.0, 1.6), time, r.seed);
      if (u < .8) K.fx.shockRing(ctx, r.x, r.y, r.r * 1.5, u / .8, 1 - u / .8, '255,170,90');
      if (u < 1.2) for (let j = 0; j < 5; j++) {
        const q = clamp01(u / 1.1 - hash(j) * .1), a = hash(j * 3.7 + r.seed) * TAU, d = r.r * (.2 + q * .7);
        if (q > 0 && q < 1) drawRock(ctx, j, r.x + Math.cos(a) * d, r.y + Math.sin(a) * d * .5 - Math.sin(Math.PI * q) * 110, 7 + hash(j * 2.2) * 7, q * 9 + j);
      }
    }
  }

  function megaG(ctx, fx, time) {
    const K = Kit(), u = fx.age - fx.fly, fade = 1 - win(fx.age, fx.dur - 1.2, fx.dur);
    if (u < 0) { markCircle(ctx, fx.x, fx.y, fx.R, '180,100,255', 1, time, false); return; }
    blastG(ctx, fx.x, fx.y, fx.R, u, fade, fx.seed);
    crater(ctx, fx.x, fx.y, fx.R * .32 * easeOut(u * 2), fade, fx.seed + 9);
    // the district burns with the Ten-Tails' violet fire
    if (u > .3 && u < fx.dur - fx.fly) {
      const a = clamp01((u - .3) * 2) * fade;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y, fx.R * .8, '150,70,255', .35 * a, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 14; i++) {
        const an = hash(i * 2.9 + fx.seed) * TAU, d = Math.sqrt(hash(i * 1.3 + fx.seed)) * fx.R * .7, x = fx.x + Math.cos(an) * d, y = fx.y + Math.sin(an) * d * .5;
        const fl = K.flame(i + Math.floor(time * 12), VIOLET_FLAME, 'jbv'), s = 34 + hash(i * 4.1) * 30;
        ctx.globalAlpha = a * (.6 + .4 * Math.sin(time * 9 + i));
        ctx.drawImage(fl, x - s * .25, y - s * .9, s * .5, s);
      }
      ctx.globalAlpha = 1;
    }
  }
  function megaO(ctx, fx, time) {
    const K = Kit(), u = fx.age - fx.fly;
    if (u < 0) { orbFlight(ctx, fx, fx.age / fx.fly, 150, time, 160); return; }
    const R = fx.R, span = fx.dur - fx.fly;
    ctx.globalCompositeOperation = 'lighter';
    if (u < .5) K.glow(ctx, fx.x, fx.y - R * .35, R * 2.2, '240,225,255', (1 - u / .5), true);
    ctx.globalCompositeOperation = 'source-over';
    blastO(ctx, fx.x, fx.y, R, u, span, time, fx.seed);
    // outer shock fronts racing far past the blast
    for (let i = 0; i < 3; i++) { const tt = u - .1 - i * .22; if (tt > 0 && tt < 1.6) K.fx.shockRing(ctx, fx.x, fx.y, R * (2.2 + i * .3), tt / 1.6, (1 - tt / 1.6) * .9, i === 1 ? '255,255,255' : '190,130,255'); }
    // the mushroom cloud boiling up over the crater
    if (u > .35) {
      const s = clamp01((u - .35) / 2.6), a = bell(Math.min(1, (u - .35) / (span - .6))) * .9, vio = K.puff('violet'), smoke = K.puff('smoke');
      for (let i = 0; i < 9; i++) {
        const h = R * (.1 + s * .75) * (i / 8), w = R * (.12 + s * .06);
        K.stamp(ctx, i % 2 ? vio : smoke, fx.x + Math.sin(time * 1.5 + i) * 10, fx.y - h, w * (1 + hash(i * 3 + fx.seed) * .4), a * (.45 + i * .04));
      }
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + hash(i + fx.seed) * .3, cx = fx.x + Math.cos(an) * R * (.12 + s * .28), cy = fx.y - R * (.1 + s * .75) + Math.sin(an) * R * .1;
        K.stamp(ctx, i % 3 ? smoke : vio, cx, cy, R * (.1 + s * .12), a * .6);
      }
      dustRing(ctx, fx.x, fx.y, R * (.6 + s * .5), 26, 40 + s * 40, a * .9, fx.seed + 4, 10 + s * 30);
    }
    for (let i = 0; i < 12; i++) {
      const q = clamp01(u / 1.6 - hash(i + 2) * .15), a = hash(i * 5.7 + fx.seed) * TAU, d = R * (.2 + q * 1.0);
      if (q > 0 && q < 1) drawRock(ctx, i, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * .5 - Math.sin(Math.PI * q) * R * .7, 14 + hash(i * 2.2) * 16, q * 7 + i);
    }
  }

  function slamG(ctx, fx, time) {
    const K = Kit(), t = fx.age, fade = 1 - win(t, 1.0, fx.dur);
    crater(ctx, fx.x, fx.y, SLAM_R * .75 * easeOut(t * 5), fade, fx.seed);
    cracks(ctx, fx.x, fx.y, SLAM_R * 1.5, 12, fx.seed + 4, fade, 2.6);
    if (t < .7) K.fx.shockRing(ctx, fx.x, fx.y, SLAM_R * 1.6, t / .7, 1 - t / .7, '210,180,255');
  }
  function slamO(ctx, fx, time) {
    const K = Kit(), t = fx.age;
    if (t > 1.2) return;
    dustRing(ctx, fx.x, fx.y, SLAM_R * (.5 + easeOut(t * 2) * .7), 14, 24 + t * 30, 1 - t / 1.2, fx.seed, 6 + t * 20);
    K.fx.debris(ctx, fx.x, fx.y, SLAM_R * 1.2, t / .9, fx.seed, '#3b3040', 12);
  }
  function markG(ctx, fx, time) { markCircle(ctx, fx.x, fx.y, fx.r, '225,195,255', fx.age / fx.dur, time, false); }

  const FX = {
    roar: [roarG, roarO], evolve: [null, evolveO], tbb: [tbbG, tbbO], rapid: [rapidG, rapidO], sweep: [sweepG, sweepO, sweepB],
    wood: [woodG, woodO], clones: [clonesG, clonesO], meteor: [meteorG, meteorO], mega: [megaG, megaO],
    slam: [slamG, slamO], mark: [markG, null]
  };

  // ------------------------------------------------------------------ the beast
  // Rinne Sharingan: blood-red iris with ripple rings and nine tomoe; the pupil follows the target.
  function eye(ctx, x, y, r, time, flare, lx, ly) {
    ctx.fillStyle = C.deep; ctx.beginPath(); ctx.ellipse(x, y, r * 1.42, r * 1.1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f0e2df'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * .96, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.clip();
    const ix = x + lx, iy = y + ly;
    ctx.fillStyle = '#c8101f'; ctx.beginPath(); ctx.arc(ix, iy, r * .9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ef3a3a'; ctx.beginPath(); ctx.arc(ix - r * .06, iy - r * .14, r * .6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8101f'; ctx.beginPath(); ctx.arc(ix, iy, r * .48, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3c0309'; ctx.lineWidth = Math.max(1, r * .06);
    const rings = [.25, .5, .74];
    ctx.beginPath();
    for (const k of rings) { ctx.moveTo(ix + r * .9 * k, iy); ctx.arc(ix, iy, r * .9 * k, 0, TAU); }
    ctx.moveTo(ix + r * .9, iy); ctx.arc(ix, iy, r * .9, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#1e0205';
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 3; i++) {
      const a = time * (.5 - ring * .12) * (ring % 2 ? -1 : 1) + i * TAU / 3 + ring * .7, d = r * .9 * rings[ring];
      const tx = ix + Math.cos(a) * d, ty = iy + Math.sin(a) * d, tr = r * (.07 + ring * .012);
      ctx.beginPath(); ctx.arc(tx, ty, tr, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx + Math.cos(a + 1.6) * tr, ty + Math.sin(a + 1.6) * tr);
      ctx.quadraticCurveTo(tx + Math.cos(a + .6) * tr * 2.4, ty + Math.sin(a + .6) * tr * 2.4, tx + Math.cos(a - .9) * tr * 2.6, ty + Math.sin(a - .9) * tr * 2.6);
      ctx.lineTo(tx + Math.cos(a - 1.6) * tr, ty + Math.sin(a - 1.6) * tr); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(ix, iy, r * .12, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(30,10,30,.55)';
    ctx.beginPath(); ctx.ellipse(x, y - r * 1.05, r * 1.5, r * .55, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(255,236,236,${.8 + flare * .2})`;
    ctx.beginPath(); ctx.arc(ix - r * .38, iy - r * .28, r * .14, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * .96, 0, 0, TAU); ctx.stroke();
  }
  function limb(ctx, x0, y0, x1, y1, x2, y2, w, fill) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x1, y1, x2, y2);
    ctx.strokeStyle = C.line; ctx.lineWidth = w + 7; ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
  }
  function claws(ctx, x, y, dir, size, down) {
    ctx.fillStyle = C.bone; ctx.strokeStyle = C.line; ctx.lineWidth = 2.5;
    for (let c = -1.5; c <= 1.5; c++) {
      const bx = x + c * size * .55;
      ctx.beginPath();
      if (down) { ctx.moveTo(bx - size * .26, y); ctx.quadraticCurveTo(bx + dir * size * .15, y + size * .55, bx + c * size * .18, y + size); ctx.lineTo(bx + size * .26, y); }
      else { ctx.moveTo(bx - size * .26, y); ctx.quadraticCurveTo(bx + c * size * .2, y - size * .6, bx + c * size * .3, y - size); ctx.lineTo(bx + size * .26, y); }
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
  const TORSO = [[-95, -105], [-150, -165], [-190, -255], [-162, -330], [-92, -378], [0, -394], [92, -378], [162, -330], [190, -255], [150, -165], [95, -105], [0, -86]];
  const TP = TORSO.map(p => [p[0], p[1]]);
  const BL = new Float32Array(32), BR = new Float32Array(32);

  // Pose of the giant for this frame (body-local units, feet at the origin, y up = negative).
  function beastPose(z, st, time, dying) {
    const by = Math.sin(time * 1.7) * 4, up = -st.rear * 34 + st.recoil * 10;
    return { by, up, U: y => y < -120 ? (by + up) * clamp01((-120 - y) / 160) : 0, look: dying ? 0 : st.look, gape: st.gape, raise: st.raise, spread: st.spread,
      rage: st.rage, grow: st.grow };
  }

  function drawTail(ctx, i, P, time, st, S, z) {
    const near = i % 2 === 1, o = (i - 4.5) / 4.5;
    // Fanned like a crown behind the hump: the outer tails sweep out sideways and curl their tips
    // up, the middle ones rise straight over the horns.
    const rx = o * 80, ry = -240 + P.U(-240);
    const a0 = -Math.PI / 2 + o * 1.48 + Math.sin(time * .7 + i * 2.1) * .05;
    const len = (330 + 150 * Math.abs(o) + 30 * Math.sin(i * 1.9 + .5)) * (1 + .18 * P.grow) * (1 + .06 * P.rage);
    const curl = Math.abs(o) < .25 ? (o >= 0 ? .5 : -.5) : -(o >= 0 ? 1 : -1) * (1.0 + (i % 3) * .2);
    const N = 14, W = (near ? 40 : 35) * (1 + .15 * P.grow);
    let x = rx, y = ry;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = a0 + curl * t * t + Math.sin(time * (1.3 + P.rage * .9) + i * 1.3 - t * 5.5) * (.32 + P.rage * .12) * t;
      if (k) { x += Math.cos(a) * len / N; y += Math.sin(a) * len / N; }
      const w = W * Math.pow(1 - t, .75) + 2;
      const nx = -Math.sin(a), ny = Math.cos(a);
      BL[k * 2] = x + nx * w; BL[k * 2 + 1] = y + ny * w;
      BR[k * 2] = x - nx * w; BR[k * 2 + 1] = y - ny * w;
    }
    st.tips[i * 2] = z.x + x * S; st.tips[i * 2 + 1] = z.y + 4 + y * S;
    ctx.beginPath(); ctx.moveTo(BL[0], BL[1]);
    for (let k = 1; k <= N; k++) ctx.lineTo(BL[k * 2], BL[k * 2 + 1]);
    for (let k = N; k >= 0; k--) ctx.lineTo(BR[k * 2], BR[k * 2 + 1]);
    ctx.closePath();
    ctx.fillStyle = near ? C.skin : C.far; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 3.5; ctx.stroke();
    // lit ridge and a darker underside band
    ctx.strokeStyle = near ? 'rgba(205,196,222,.55)' : 'rgba(170,160,185,.38)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(BL[2] * .7 + BR[2] * .3, BL[3] * .7 + BR[3] * .3);
    for (let k = 2; k <= N - 2; k++) ctx.lineTo(BL[k * 2] * .7 + BR[k * 2] * .3, BL[k * 2 + 1] * .7 + BR[k * 2 + 1] * .3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(25,18,32,.35)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(BR[2] * .8 + BL[2] * .2, BR[3] * .8 + BL[3] * .2);
    for (let k = 2; k <= N - 3; k++) ctx.lineTo(BR[k * 2] * .8 + BL[k * 2] * .2, BR[k * 2 + 1] * .8 + BL[k * 2 + 1] * .2);
    ctx.stroke();
    // bony spines along the outer edge
    ctx.fillStyle = C.deep;
    ctx.beginPath();
    for (let k = 2; k <= 10; k += 2) {
      const px = BL[k * 2], py = BL[k * 2 + 1], qx = BL[k * 2 + 2], qy = BL[k * 2 + 3];
      const dx = qx - px, dy = qy - py, d = Math.hypot(dx, dy) || 1, s = 15 - k;
      ctx.moveTo(px, py); ctx.lineTo(px + dx * .5 - dy / d * s + dx / d * s * .5, py + dy * .5 + dx / d * s + dy / d * s * .5); ctx.lineTo(qx, qy);
    }
    ctx.fill();
  }

  // The whole giant, painted at (z.x, z.y) in body-local units.
  function drawBeast(ctx, z, st, time, alpha, dying) {
    const K = Kit(), S = scaleOf(st), P = beastPose(z, st, time, dying), U = P.U;
    const mv = st.windup > 0 ? st.move : '', k = st.windup > 0 ? 1 - st.windup / st.windMax : 0;
    ctx.save();
    ctx.translate(z.x, z.y + 4); ctx.scale(S, S);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // contact shadow
    ctx.fillStyle = 'rgba(10,6,14,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 250, 78, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(10,6,14,.25)'; ctx.beginPath(); ctx.ellipse(0, -4, 160, 46, 0, 0, TAU); ctx.fill();
    // ---- the ten tails fanned out behind (outermost first)
    for (const i of [0, 9, 1, 8, 2, 7, 3, 6, 4, 5]) drawTail(ctx, i, P, time, st, S, z);
    // ---- jagged spikes jutting off the back of the hump
    const spikeL = 1 + P.grow * .7;
    ctx.fillStyle = C.deep; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
    for (let i = 0; i < 13; i++) {
      const t = i / 12, a = Math.PI * (1.2 + t * .6), cx = 0, cy = -250 + U(-300);
      const bx = cx + Math.cos(a) * 168, byy = cy + Math.sin(a) * 138;
      const L = (34 + Math.sin(t * Math.PI) * 34 + hash(i * 3.3) * 20) * spikeL, w = 16 + Math.sin(t * Math.PI) * 6;
      const da = a + (hash(i) - .5) * .3, nx = -Math.sin(a), ny = Math.cos(a);
      ctx.beginPath();
      ctx.moveTo(bx + nx * w, byy + ny * w);
      ctx.lineTo(bx + Math.cos(da) * L * .55 + nx * w * .3, byy + Math.sin(da) * L * .55 + ny * w * .3);
      ctx.lineTo(bx + Math.cos(da) * L, byy + Math.sin(da) * L);
      ctx.lineTo(bx + Math.cos(da) * L * .5 - nx * w * .5, byy + Math.sin(da) * L * .5 - ny * w * .5);
      ctx.lineTo(bx - nx * w, byy - ny * w);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,140,170,.5)'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 13; i += 2) {
      const t = i / 12, a = Math.PI * (1.2 + t * .6), bx = Math.cos(a) * 168, byy = -250 + U(-300) + Math.sin(a) * 138, L = (34 + Math.sin(t * Math.PI) * 34) * spikeL * .8;
      ctx.moveTo(bx, byy); ctx.lineTo(bx + Math.cos(a) * L, byy + Math.sin(a) * L);
    }
    ctx.stroke();
    // ---- legs: thick bent haunches stamping in turn
    const ph = Math.sin(st.walk * TAU), liftL = st.moving * Math.max(0, ph), liftR = st.moving * Math.max(0, -ph);
    for (const s of [-1, 1]) {
      const lift = s < 0 ? liftL : liftR, hx = s * 80, hy = -150, kx = s * 158, ky = -96 - lift * 22, fx = s * 116, fy = -10 - lift * 34;
      limb(ctx, hx, hy, kx, ky - 30, kx, ky, 62, s < 0 ? C.skin : C.dark);
      limb(ctx, kx, ky, kx - s * 10, (ky + fy) / 2, fx, fy, 50, s < 0 ? C.skin : C.dark);
      ctx.fillStyle = s < 0 ? C.skin : C.dark; ctx.strokeStyle = C.line; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(fx, fy + 2, 44, 18, 0, 0, TAU); ctx.fill(); ctx.stroke();
      claws(ctx, fx, fy + 8, s, 14, true);
    }
    // ---- the hunched torso
    for (let i = 0; i < TORSO.length; i++) { TP[i][0] = TORSO[i][0] * (1 + P.spread * .04); TP[i][1] = TORSO[i][1] + U(TORSO[i][1]); }
    smoothPath(ctx, TP);
    ctx.fillStyle = C.skin; ctx.fill();
    ctx.save(); ctx.clip();
    const topY = -394 + U(-394);
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.ellipse(150, -210, 120, 230, -.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -60, 220, 70, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.light;
    ctx.beginPath(); ctx.ellipse(-80, topY + 70, 100, 50, -.35, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(205,196,222,.35)';
    ctx.beginPath(); ctx.ellipse(-110, topY + 120, 50, 90, -.4, 0, TAU); ctx.fill();
    // wrinkled, bark-like hide and the ribbed chest
    ctx.strokeStyle = C.vein; ctx.lineWidth = 4;
    ctx.beginPath();
    for (const [x0, y0, x1, y1, cx, cy] of [[-160, -200, -100, -260, -140, -250], [-170, -150, -110, -200, -150, -190], [-140, -300, -60, -340, -110, -340],
      [60, -350, 130, -310, 100, -350], [120, -250, 170, -200, 160, -240], [100, -170, 150, -130, 140, -160]]) {
      ctx.moveTo(x0, y0 + U(y0)); ctx.quadraticCurveTo(cx, cy + U(cy), x1, y1 + U(y1));
    }
    for (let i = 0; i < 5; i++) { const y = -230 + i * 26; ctx.moveTo(-70 + i * 4, y + U(y)); ctx.quadraticCurveTo(0, y + 16 + U(y), 70 - i * 4, y + U(y)); }
    ctx.stroke();
    // bumps on the hide
    ctx.fillStyle = 'rgba(30,20,40,.25)';
    for (let i = 0; i < 9; i++) { const x = (hash(i * 3.1) - .5) * 300, y = -140 - hash(i * 7.3) * 200; ctx.beginPath(); ctx.ellipse(x + 3, y + U(y) + 4, 10, 7, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(205,196,222,.35)';
    for (let i = 0; i < 9; i++) { const x = (hash(i * 3.1) - .5) * 300, y = -140 - hash(i * 7.3) * 200; ctx.beginPath(); ctx.ellipse(x - 2, y + U(y) - 2, 7, 4, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    smoothPath(ctx, TP);
    ctx.strokeStyle = C.line; ctx.lineWidth = 5; ctx.stroke();
    // ---- complete form: red-violet chakra veins burning through the hide
    if (P.grow > .02 && !dying) {
      const vk = P.grow * (.7 + .3 * Math.sin(time * 3));
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        let x = (hash(i * 5.1) - .5) * 240, y = -130 - hash(i * 2.3) * 220;
        ctx.moveTo(x, y + U(y));
        for (let j = 0; j < 4; j++) { x += (hash(i * 7 + j) - .5) * 70; y -= 18 + hash(i + j * 3) * 26; ctx.lineTo(x, y + U(y)); }
      }
      ctx.strokeStyle = `rgba(60,10,40,${.5 * vk})`; ctx.lineWidth = 7; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,70,120,${.55 * vk})`; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---- clone pods swelling on the shoulders
    if (mv === 'clones') {
      const e = Math.max(0, easeOutBack(k * 1.2));
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 52, y = -330 + Math.abs(i - 2.5) * 22 + U(-330), r = (14 + hash(i) * 8) * e;
        ctx.fillStyle = '#efeee6'; ctx.strokeStyle = '#3c3e34'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    // ---- long gorilla arms (knuckles on the ground at rest)
    for (const s of [-1, 1]) {
      const sx = s * 152, sy = -318 + U(-318);
      let ex = s * 252, ey = -205 + U(-205) * .5, hx = s * 228, hy = -26;
      // arms up to the sky (meteor, the giant orb)
      ex = lerp(ex, s * 238, P.raise); ey = lerp(ey, -440 + U(-440), P.raise); hx = lerp(hx, s * 150, P.raise); hy = lerp(hy, -580 + U(-580), P.raise);
      // arms flung wide (roar)
      ex = lerp(ex, s * 300, P.spread); ey = lerp(ey, -270 + U(-270), P.spread); hx = lerp(hx, s * 380, P.spread); hy = lerp(hy, -170, P.spread);
      const r = st.reach[s < 0 ? 0 : 1];
      if (r.k > .01 && !dying) {
        // reaching out to slam: the hand goes to the target's ground spot (lifted while it rises)
        const tx = (r.x - z.x) / S, ty = (r.y - z.y - 4) / S - r.up * 230;
        hx = lerp(hx, tx, r.k); hy = lerp(hy, ty, r.k);
        ex = lerp(ex, (sx + hx) / 2 + s * 70, r.k); ey = lerp(ey, Math.min(sy, hy) - 110, r.k);
      }
      const fill = s < 0 ? C.skin : C.dark;
      limb(ctx, sx, sy, s * 205, sy - 10, ex, ey, 58, fill);
      limb(ctx, ex, ey, (ex + hx) / 2 + s * 8, (ey + hy) / 2, hx, hy, 48, fill);
      ctx.strokeStyle = 'rgba(205,196,222,.45)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(sx - s * 6, sy - 14); ctx.quadraticCurveTo(s * 200, sy - 26, ex - s * 4, ey - 18); ctx.stroke();
      // fist / palm with bone claws
      ctx.fillStyle = fill; ctx.strokeStyle = C.line; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(hx, hy - 8, 38, 26, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(205,196,222,.4)'; ctx.beginPath(); ctx.ellipse(hx - 10, hy - 18, 18, 8, -.2, 0, TAU); ctx.fill();
      const pointUp = P.raise > .5 && r.k < .3;
      claws(ctx, hx, pointUp ? hy - 26 : hy + 6, s, 16, !pointUp);
    }
    // ---- the head: horn crown, one great eye, the jagged maw
    const hx = P.look, hy = -362 + U(-362) - st.recoil * 14, gape = P.gape, hornL = 1 + P.grow * .9;
    st.mouth.x = z.x + hx * S; st.mouth.y = z.y + 4 + (hy + 44 + gape * 20) * S;
    st.crown.x = z.x + hx * S; st.crown.y = z.y + 4 + (hy - 250 - P.grow * 40) * S;
    ctx.fillStyle = C.bone; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const t = i / 6, a = -Math.PI * (.86 - t * .72), x0 = hx + Math.cos(a) * 70, y0 = hy - 30 + Math.sin(a) * 66;
      const len = (46 + Math.sin(t * Math.PI) * 36) * hornL, ang = a - (t - .5) * .5, w = 11 + Math.sin(t * Math.PI) * 4;
      const nx = -Math.sin(ang), ny = Math.cos(ang), tx = x0 + Math.cos(ang) * len, ty = y0 + Math.sin(ang) * len;
      ctx.beginPath(); ctx.moveTo(x0 - nx * w, y0 - ny * w);
      ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * .6 - nx * w * .2, y0 + Math.sin(ang) * len * .6 - ny * w * .2, tx, ty);
      ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * .5 + nx * w * .6, y0 + Math.sin(ang) * len * .5 + ny * w * .6, x0 + nx * w, y0 + ny * w);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = C.boneDark; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const t = i / 6, a = -Math.PI * (.86 - t * .72), x0 = hx + Math.cos(a) * 70, y0 = hy - 30 + Math.sin(a) * 66, len = (46 + Math.sin(t * Math.PI) * 36) * hornL, ang = a - (t - .5) * .5;
      ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(ang) * len * .6, y0 + Math.sin(ang) * len * .6);
    }
    ctx.stroke();
    // skull dropping into a heavy jaw that hinges open
    const HEAD = [[hx - 92, hy + 6], [hx - 88, hy - 56], [hx - 46, hy - 98], [hx, hy - 104], [hx + 46, hy - 98], [hx + 88, hy - 56], [hx + 92, hy + 6],
      [hx + 74, hy + 66 + gape * 26], [hx, hy + 96 + gape * 52], [hx - 74, hy + 66 + gape * 26]];
    smoothPath(ctx, HEAD);
    ctx.fillStyle = C.skin; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.ellipse(hx + 96, hy, 40, 110, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx, hy + 110 + gape * 50, 110, 40, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(205,196,222,.5)'; ctx.beginPath(); ctx.ellipse(hx - 26, hy - 88, 46, 13, -.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.vein; ctx.lineWidth = 3; ctx.beginPath();
    for (const s of [-1, 1]) { ctx.moveTo(hx + s * 80, hy - 10); ctx.quadraticCurveTo(hx + s * 66, hy + 26, hx + s * 72, hy + 54); ctx.moveTo(hx + s * 30, hy - 96); ctx.quadraticCurveTo(hx + s * 40, hy - 76, hx + s * 64, hy - 70); }
    ctx.stroke();
    ctx.restore();
    smoothPath(ctx, HEAD); ctx.strokeStyle = C.line; ctx.lineWidth = 5; ctx.stroke();
    // heavy angry brow ridge
    const er = 34 * (1 + .1 * P.grow), ey = hy - 26;
    ctx.fillStyle = C.deep;
    ctx.beginPath(); ctx.moveTo(hx - 84, ey - 52); ctx.quadraticCurveTo(hx, ey - 8, hx + 84, ey - 52);
    ctx.lineTo(hx + 80, ey - 70); ctx.quadraticCurveTo(hx, ey - 34, hx - 80, ey - 70); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
    // the eye: pupil tracking the target
    const flare = dying ? 0 : Math.max(P.rage, z.hitFlash > 0 ? Math.min(1, z.hitFlash * 5) : 0);
    eye(ctx, hx, ey, er, time, flare, P.look * .22, (mv ? -.06 : .08) * er);
    if (dying) { ctx.fillStyle = `rgba(30,24,36,${.6})`; ctx.beginPath(); ctx.ellipse(hx, ey, er * 1.25, er * .96, 0, 0, TAU); ctx.fill(); }
    // the maw: a jagged mouth that gapes open, tall, for the Bijūdama
    const my = hy + 40, mw = 66, mh = 10 + gape * 74;
    ctx.fillStyle = '#1c070d';
    ctx.beginPath(); ctx.moveTo(hx - mw, my); ctx.quadraticCurveTo(hx, my - 10 - gape * 8, hx + mw, my);
    ctx.quadraticCurveTo(hx + mw * .6, my + mh, hx, my + mh + 6); ctx.quadraticCurveTo(hx - mw * .6, my + mh, hx - mw, my);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 3.5; ctx.stroke();
    if (gape > .05) {
      ctx.fillStyle = `rgba(130,20,50,${.8 * gape})`; ctx.beginPath(); ctx.ellipse(hx, my + mh * .65, mw * .45, mh * .3, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = C.bone;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const t = i / 8, x = hx - mw * .88 + t * mw * 1.76, yt = my - (10 + gape * 8) * Math.sin(t * Math.PI) * .5 + 2;
      ctx.moveTo(x - 6, yt); ctx.lineTo(x, yt + 12 + (i % 2) * 5 + gape * 6); ctx.lineTo(x + 6, yt);
      if (i > 0 && i < 8) {
        const yb = my + (mh + 4) * Math.pow(Math.sin(t * Math.PI), .7) * .95;
        ctx.moveTo(x - 5.5, yb); ctx.lineTo(x + 1, yb - 11 - (i % 2) * 4 - gape * 5); ctx.lineTo(x + 6, yb);
      }
    }
    ctx.fill();
    // ---- light: the eye blazes, the hide is rim-lit violet when it rages
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, hx, ey, er * 2.2 + flare * 30, '255,40,60', (dying ? .1 : .35) + flare * .4 + Math.sin(time * 4) * .05);
    if (P.rage > .05) K.glow(ctx, 0, -250, 300, '170,70,255', P.rage * .16);
    if (z.hitFlash > 0) K.glow(ctx, 0, -260, 320, '255,255,255', Math.min(1, z.hitFlash * 6) * .28);
    if (mv === 'evolve') K.glow(ctx, 0, -260, 340, '255,70,110', .5 * k);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Dark chakra smouldering off the giant + stomp dust.
  function ambientG(ctx, z, st, time) {
    const K = Kit();
    for (const s of st.stomps) {
      const q = s.age / 1.2;
      cracks(ctx, s.x, s.y, 90, 7, s.seed, 1 - q, 2.4);
      dustRing(ctx, s.x, s.y, 50 + q * 90, 9, 20 + q * 24, (1 - q) * .8, s.seed, 4 + q * 16);
      if (q < .5) K.fx.shockRing(ctx, s.x, s.y, 150, q * 2, 1 - q * 2, '190,170,210');
    }
  }
  function ambientO(ctx, z, st, time, alpha) {
    const K = Kit(), S = scaleOf(st), vio = K.puff('violet');
    for (let i = 0; i < 8; i++) {
      const ph = frac(time * (.32 + st.rage * .25) + i / 8);
      const px = z.x + (hash(i * 3.1) - .5) * 360 * S + Math.sin(ph * 5 + i) * 10, py = z.y - (220 + ph * 300) * S;
      K.stamp(ctx, vio, px, py, (26 + ph * 40) * S, bell(ph) * (.28 + st.rage * .2) * alpha);
    }
  }

  // ------------------------------------------------------------------ windup looks
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, M = st.mouth;
    switch (move) {
      case 'tbb': case 'rapid': {
        // chakra drawn into the open maw, the orb swelling between the teeth
        converge(ctx, M.x, M.y, 20, move === 'tbb' ? 150 : 90, 16, time, Math.min(1, k * 2));
        drawOrb(ctx, M.x, M.y, move === 'tbb' ? 6 + 48 * easeOutBack(k) : 6 + 16 * e, time, 1, Math.min(1, .4 + k));
        break;
      }
      case 'mega': break;
      case 'roar': case 'evolve': {
        ctx.save(); ctx.translate(z.x, z.y - 250);
        for (let i = 0; i < 3; i++) {
          const ph = frac(time * 1.6 + i / 3), r = 360 * (1 - ph) + 60;
          ctx.lineWidth = 6; ctx.strokeStyle = `rgba(60,26,110,${ph * .45})`; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .7, 0, 0, TAU); ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = move === 'evolve' ? `rgba(255,170,190,${ph * .8})` : `rgba(235,225,255,${ph * .8})`; ctx.stroke();
        }
        ctx.restore();
        if (move === 'evolve') {
          const vio = K.puff('violet');
          for (let i = 0; i < 10; i++) { const ph = frac(time * 1.2 + i / 10); K.stamp(ctx, vio, z.x + (hash(i) - .5) * 420, z.y - 40 - ph * 420, 30 + ph * 40, bell(ph) * .6 * k); }
        }
        break;
      }
      case 'meteor': {
        // the sky over the target reddens
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, st.tx - 200, st.ty - 600, 380, '255,110,40', .35 * e);
        K.glow(ctx, st.crown.x, st.crown.y + 40, 120, '255,140,60', .5 * e);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'sweep': {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - 120, 260, '200,170,255', .25 * e, false, .6);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'wood': {
        const dust = K.puff('dust');
        for (const s of st.tele) for (let i = 0; i < 3; i++) {
          const d = 80 + i * 200 + frac(time * 1.5 + i * .3) * 120;
          K.stamp(ctx, dust, s.x + Math.cos(s.a) * d, s.y + Math.sin(s.a) * d - 8, 16 + 10 * k, .5 * k, .7);
        }
        break;
      }
      case 'slam': break;
    }
  }
  // The ultimate's orb, held high over the horn crown and fed by all ten tails.
  function megaChargeO(ctx, z, st, time, k) {
    const K = Kit(), Cr = st.crown, r = 22 + 128 * easeOut(k), x = Cr.x, y = Cr.y - r * .4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const tx = st.tips[i * 2], ty = st.tips[i * 2 + 1];
      if (!tx) continue;
      const mx = (tx + x) / 2 + (hash(i) - .5) * 80, my = Math.min(ty, y) - 60;
      for (const [style, w, dash] of [['rgba(40,10,70,.55)', 9, 0], ['rgba(250,240,255,.85)', 3, 1]]) {
        ctx.strokeStyle = style; ctx.lineWidth = w * (.5 + .5 * k);
        if (dash) { ctx.setLineDash([26, 18]); ctx.lineDashOffset = -time * 420 - i * 13; ctx.globalCompositeOperation = 'lighter'; }
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my, x, y); ctx.stroke();
        ctx.setLineDash([]); ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 4, '150,70,255', .35 + .3 * k);
    ctx.globalCompositeOperation = 'source-over';
    converge(ctx, x, y, r, 160 + r, 20, time, 1);
    drawOrb(ctx, x, y, r, time, 7, 1);
    // lightning crackling over the swollen orb
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a0 = time * 3 + i * 1.57, a1 = a0 + 1.2 + Math.sin(time * 5 + i);
      K.forkedBolt(ctx, x + Math.cos(a0) * r * 1.05, y + Math.sin(a0) * r * 1.05, x + Math.cos(a1) * r * 1.3, y + Math.sin(a1) * r * 1.3, i * 9, time,
        { jitter: 14, alpha: .9, width: 1.6, pal: ['150,90,255', '200,160,255', '255,255,255'], base: 'rgba(40,10,70,.6)', forks: 1, forkLen: 30, rate: 24, snap: true });
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function label(ctx, z, st, m, top) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    ctx.save();
    ctx.textAlign = 'center';
    // name + health over the horn crown (the game skips its own bar for a hidden body)
    const w = 190, x = z.x - w / 2, y = top;
    ctx.fillStyle = 'rgba(8,6,14,.82)'; ctx.fillRect(x - 2, y - 2, w + 4, 11);
    ctx.fillStyle = m.accent; ctx.fillRect(x, y, w * clamp01(z.health / z.maxHealth), 7);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w * clamp01(z.health / z.maxHealth), 2);
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#0d0a10';
    ctx.strokeText(m.name, z.x, y - 7); ctx.fillStyle = '#fff2f4'; ctx.fillText(m.name, z.x, y - 7);
    if (move) {
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#140c1c'; ctx.strokeText(MOVES[move].label, z.x, y - 25);
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
    const m = members[z.bossId], st = z.jb;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null, st); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    ambientG(ctx, z, st, time);
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[2]) { f[2](ctx, fx, time, z.health > 0 ? z : null, st); ctx.globalAlpha = 1; } }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
      for (const s of st.tele) {
        if (s.k === 'c') markCircle(ctx, s.follow ? z.x : s.x, s.follow ? z.y : s.y, s.r, rgb, k, time, s.faint, s.small);
        else if (s.k === 'line') markLine(ctx, s, rgb, k, time);
        else if (s.k === 'cone') markCone(ctx, s, rgb, k, time);
      }
    }
    // The giant itself (under the ninjas so they stay visible against it); it sinks and
    // crumbles into dark smoke when felled.
    if (z.health > 0) drawBeast(ctx, z, st, time, 1, false);
    else {
      const q = clamp01(1 - (z.deathTimer || 0) / 2.2);
      ctx.save(); ctx.translate(0, q * 70);
      // solid while it sinks (per-shape alpha would show the limbs through each other), then gone in smoke
      drawBeast(ctx, z, st, time, 1 - win(q, .5, .85), true);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.jb;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null, st); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    const S = scaleOf(st);
    if (z.health > 0) {
      ambientO(ctx, z, st, time, 1);
      if (st.windup > 0 && st.move) { windupO(ctx, z, st, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (st.move === 'mega' && st.windup > 0) megaChargeO(ctx, z, st, time, 1 - st.windup / st.windMax);
      else if (st.hold > 0 && st.holdMove === 'mega' && !st.fx.some(f => f.kind === 'mega' && f.age > .02)) megaChargeO(ctx, z, st, time, 1);
      label(ctx, z, st, m, z.y - (560 + st.grow * 70) * S);
    } else {
      // collapsing into smoke
      const K = Kit(), q = clamp01(1 - (z.deathTimer || 0) / 2.2), smoke = K.puff('smoke'), vio = K.puff('violet');
      for (let i = 0; i < 20; i++) {
        const ph = frac(q * 1.3 + hash(i * 1.9)), x = z.x + (hash(i * 3.3) - .5) * 480 * S, y = z.y - (30 + hash(i * 7.1) * 400 + ph * 120) * S;
        K.stamp(ctx, i % 2 ? smoke : vio, x, y, (50 + ph * 60) * S, Math.min(1, bell(ph) * 1.4) * .85 * bell(q * 1.05));
      }
      dustRing(ctx, z.x, z.y, 140 + q * 220, 16, 30 + q * 30, bell(q) * .8, z.seed || 1, 8 + q * 20);
    }
    ctx.restore();
  }

  function hidden() { return true; }

  window.TenTailsBoss = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden, moves };
})();
