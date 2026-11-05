/* The eight tailed beasts (Ichibi → Hachibi) as giant enemies: anime-style upright
 * Canvas art plus their own jutsu. Each beast has four signature jutsu and a giant
 * Bijūdama as its ultimate; every big hit is telegraphed on the ground first.
 * All state lives on the enemy object (z.tb). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const order = ['shukaku', 'matatabi', 'isobu', 'songoku', 'kokuo', 'saiken', 'chomei', 'gyuki'];
  // mouth: where the Bijūdama gathers, in the beast's local art frame (facing right, feet at 0).
  const members = {
    shukaku:  { name: 'NHẤT VĨ · SHUKAKU',  tails: 1, accent: '#e2c27f', height: 182, mouth: [44, -104] },
    matatabi: { name: 'NHỊ VĨ · MATATABI',  tails: 2, accent: '#5aa8ff', height: 150, mouth: [104, -86] },
    isobu:    { name: 'TAM VĨ · ISOBU',     tails: 3, accent: '#7fc7b6', height: 140, mouth: [104, -52] },
    songoku:  { name: 'TỨ VĨ · SON GOKŪ',   tails: 4, accent: '#ff6a2e', height: 190, mouth: [58, -118] },
    kokuo:    { name: 'NGŨ VĨ · KOKUŌ',     tails: 5, accent: '#f2f4f2', height: 172, mouth: [128, -128] },
    saiken:   { name: 'LỤC VĨ · SAIKEN',    tails: 6, accent: '#b6e7f2', height: 150, mouth: [74, -100] },
    chomei:   { name: 'THẤT VĨ · CHŌMEI',   tails: 7, accent: '#ffb84a', height: 170, mouth: [80, -100] },
    gyuki:    { name: 'BÁT VĨ · GYŪKI',     tails: 8, accent: '#c89a7a', height: 200, mouth: [54, -136] }
  };

  function pick(index) { return order[((index % order.length) + order.length) % order.length]; }

  // ---------------------------------------------------------------- small math
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const c01 = v => Math.max(0, Math.min(1, v));
  const eOut = t => 1 - Math.pow(1 - c01(t), 3);
  const eIn = t => { t = c01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * c01(t));
  const win = (t, a, b) => c01((t - a) / (b - a));
  const hsh = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;

  // ---------------------------------------------------------------- state
  function state(z) {
    return z.tb || (z.tb = { fx: [], trail: [], casts: 0, timer: 1.3, windup: 0, windMax: 1, after: 2,
      combo: null, lift: 0, rollA: 0, trailT: 0, dead: false });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.delay === undefined) fx.delay = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  // Ground point just ahead of the beast's mouth, and the mouth's height above the ground.
  function mouthOf(z) {
    const m = members[z.beastId], f = facingOf(z), lift = z.tb ? z.tb.lift * 110 : 0;
    return { x: z.x + f * (m.mouth[0] + 16), y: z.y, h: -m.mouth[1] + 3 + lift };
  }

  // ---------------------------------------------------------------- spot patterns
  function sp(x, y, r, d) { return { x, y, r, d, seed: Math.random() * 100, hit: false }; }
  // A scatter around (cx, cy) that always includes the centre (the target) first.
  function scatter(cx, cy, n, R, r, d0, step) {
    const out = [sp(cx, cy, r, d0)], off = Math.random() * TAU;
    for (let i = 1; i < n; i++) {
      const a = off + i * 2.39996 + rand(-.3, .3), d = R * Math.sqrt(i / (n - 1)) * rand(.82, 1.08);
      out.push(sp(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * rand(.88, 1.1), d0 + i * step));
    }
    return out;
  }
  function ringSpots(out, cx, cy, n, R, r, d0, step, a0 = 0) {
    for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n; out.push(sp(cx + Math.cos(a) * R, cy + Math.sin(a) * R, r, d0 + i * step)); }
    return out;
  }
  // Strike circles covering a cone (same geometry as its telegraph), with their distance from the apex.
  function coneHits(x, y, a, reach, half, from = 60) {
    const out = [];
    for (let d = from; d <= reach; d += 80) {
      const cnt = Math.max(1, Math.ceil(2 * half * d / 110)), r = Math.max(52, (2 * half * d / cnt) * .64);
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half * .92);
        out.push({ x: x + Math.cos(aa) * d, y: y + Math.sin(aa) * d, r, d, done: false });
      }
    }
    return out;
  }
  function spots(st, look, sty, list, dmg, o = {}) {
    let last = 0, first = 99;
    for (const s of list) { last = Math.max(last, s.d); first = Math.min(first, s.d); }
    return addFx(st, Object.assign({ kind: 'spots', look, sty, spots: list, dmg, delay: first, wk: PAL[sty].wk, wkEvery: 2,
      end: last + (o.puddle ? o.puddle.dur : Math.max(1.7, LOOKS[look].dur + .1)) }, o));
  }
  function wave(st, o) {
    o.hits = coneHits(o.x, o.y, o.a, o.reach, o.half);
    o.end = o.delay + o.reach / o.speed + (o.leave ? o.leave.dur : .8);
    return addFx(st, Object.assign({ kind: 'wave', wk: PAL[o.sty].wk }, o));
  }
  function orb(st, o) {
    o.end = o.delay + o.len / o.speed + (o.look === 'bijuu' ? 2.0 : 1.0);
    return addFx(st, Object.assign({ kind: 'orb', done: false, hitT: 0, seed: Math.random() * 50 }, o));
  }
  function beam(st, o) { o.end = o.delay + o.dur + 1.4; return addFx(st, Object.assign({ kind: 'beam', ticks: 0 }, o)); }
  function startCombo(z, st, api, o) {
    st.combo = Object.assign({ i: 0, n: 1, phase: 'aim', t: 0, hitT: 0, worldD: 0, contact: 0, endR: 0, max: 600, next: .55 }, o);
    if (o.tx === undefined) aimCombo(z, st.combo, api.player);
    else st.combo.a = Math.atan2(o.ty - z.y, o.tx - z.x);
  }
  function aimCombo(z, c, p) {
    if (!p) { if (c.a === undefined) c.a = Math.cos(z.angle || 0) >= 0 ? 0 : Math.PI; c.tx = z.x + Math.cos(c.a) * c.max * .6; c.ty = z.y + Math.sin(c.a) * c.max * .6; return; }
    const a = Math.atan2(p.y - z.y, p.x - z.x), d = Math.min(c.max, Math.hypot(p.x - z.x, p.y - z.y) + (c.over || 0));
    c.a = a; c.tx = z.x + Math.cos(a) * d; c.ty = z.y + Math.sin(a) * d;
  }

  // ---------------------------------------------------------------- the jutsu
  // P: { tx, ty } target · a aim · d distance · dmg base damage · W windup
  const PLAN = {
    // ===== Shukaku
    renku(z, st, api, P) {
      const len = clamp(P.d + 40, 300, 840), mo = mouthOf(z);
      for (let i = 0; i < 3; i++)
        orb(st, { look: 'wind', sty: 'wind', x: mo.x, y: mo.y, h0: mo.h, a: P.a + (i - 1) * .3, len, speed: 1150, r: 46, delay: P.W + i * .22,
          dmg: P.dmg * .8, blastR: 160, blastDmg: P.dmg * 1.9 });
    },
    sandWave(z, st, api, P) {
      wave(st, { look: 'sand', sty: 'sand', x: z.x, y: z.y, a: P.a, half: .62, reach: 800, speed: 860, delay: P.W, H: 120, dmg: P.dmg * 2.1, knock: 170 });
    },
    coffin(z, st, api, P) {
      const list = [sp(P.tx, P.ty, 125, P.W + .15)];
      for (const s of [-1, 1]) { const a = P.a + Math.PI + s * 1.15; list.push(sp(P.tx + Math.cos(a) * 210, P.ty + Math.sin(a) * 210, 115, P.W + .3 + (s + 1) * .08)); }
      spots(st, 'coffin', 'sand', list, P.dmg * 2.4, { wkEvery: 1, shake: 12 });
    },
    spears(z, st, api, P) {
      const list = [];
      for (const off of [-.22, 0, .22]) for (let d = 110; d <= 900; d += 112) list.push(sp(z.x + Math.cos(P.a + off) * d, z.y + Math.sin(P.a + off) * d, 64, P.W + d / 1500 + Math.abs(off) * .3));
      spots(st, 'sandSpike', 'sand', list, P.dmg * 1.7, { wkEvery: 3 });
    },
    // ===== Matatabi
    pillars(z, st, api, P) {
      spots(st, 'bluePillar', 'blue', scatter(P.tx, P.ty, 9, 330, 96, P.W, .11), P.dmg * 1.7, { wkEvery: 3 });
    },
    claws(z, st, api, P) {
      const len = clamp(P.d - 90, 120, 380), ex = z.x + Math.cos(P.a) * len, ey = z.y + Math.sin(P.a) * len;
      startCombo(z, st, api, { aim: P.W, tx: ex, ty: ey, speed: 1300, contact: P.dmg * 1.2, trail: 'blue', hw: 56, wk: 'fire', after: 1.6 });
      addFx(st, { kind: 'slash', sty: 'blue', x: ex, y: ey, a: P.a, reach: 420, half: .85, delay: P.W + len / 1300 + .1, end: P.W + len / 1300 + 1.6,
        dmg: P.dmg * 2.2, hits: coneHits(ex, ey, P.a, 420, .85, 40) });
    },
    flameSea(z, st, api, P) {
      wave(st, { look: 'blue', sty: 'blue', x: z.x, y: z.y, a: P.a, half: .72, reach: 740, speed: 820, delay: P.W, H: 70, dmg: P.dmg * 1.9, leave: { dur: 3.2, dmg: P.dmg * .28 } });
    },
    ring(z, st, api, P) {
      addFx(st, { kind: 'ring', sty: 'blue', x: P.tx, y: P.ty, r0: 400, r1: 56, delay: P.W + .1, dur: 1.15, end: P.W + 1.7, dmg: P.dmg * 2.0, tick: 0 });
    },
    // ===== Isobu
    coral(z, st, api, P) {
      const list = [sp(P.tx, P.ty, 82, P.W)];
      ringSpots(list, P.tx, P.ty, 6, 150, 78, P.W + .2, .015, Math.random());
      ringSpots(list, P.tx, P.ty, 10, 295, 78, P.W + .4, .012, Math.random());
      spots(st, 'coral', 'coral', list, P.dmg * 1.8, { wkEvery: 3 });
    },
    tide(z, st, api, P) {
      wave(st, { look: 'water', sty: 'water', x: z.x, y: z.y, a: P.a, half: .8, reach: 860, speed: 880, delay: P.W, H: 135, dmg: P.dmg * 2.0, knock: 230 });
    },
    roll(z, st, api, P) {
      const len = 780, ex = z.x + Math.cos(P.a) * len, ey = z.y + Math.sin(P.a) * len;
      startCombo(z, st, api, { aim: P.W, tx: ex, ty: ey, speed: 1250, contact: P.dmg * 2.2, trail: 'mist', roll: true, hw: 74, wk: 'earth', after: 1.7, endR: 170, endDmg: P.dmg * 1.5, sty: 'water' });
      addFx(st, { kind: 'field', look: 'mist', sty: 'water', x: z.x, y: z.y, r: 260, delay: P.W * .3, dur: 3.2, end: 3.6, dmg: 0 });
    },
    waterBombs(z, st, api, P) {
      const mo = mouthOf(z);
      spots(st, 'waterBomb', 'water', scatter(P.tx, P.ty, 8, 310, 100, P.W + .35, .1), P.dmg * 1.6, { ox: mo.x, oy: mo.y, oh: mo.h, fallT: .6, wkEvery: 3 });
    },
    // ===== Son Gokū
    lavaRain(z, st, api, P) {
      spots(st, 'lavaBomb', 'lava', scatter(P.tx, P.ty, 12, 370, 88, P.W + .2, .085), P.dmg * 1.5, { fallT: .75, puddle: { dur: 2.8, dmg: P.dmg * .25 }, wkEvery: 3 });
    },
    lavaWave(z, st, api, P) {
      wave(st, { look: 'lava', sty: 'lava', x: z.x, y: z.y, a: P.a, half: .66, reach: 760, speed: 720, delay: P.W, H: 90, dmg: P.dmg * 2.1, leave: { dur: 3.0, dmg: P.dmg * .3 } });
    },
    eruption(z, st, api, P) {
      const list = [sp(z.x, z.y, 125, P.W - .05)];
      ringSpots(list, z.x, z.y, 6, 175, 84, P.W, .015, Math.random());
      ringSpots(list, z.x, z.y, 10, 335, 84, P.W + .32, .012, Math.random());
      ringSpots(list, z.x, z.y, 13, 495, 84, P.W + .64, .01, Math.random());
      spots(st, 'geyser', 'lava', list, P.dmg * 1.8, { wkEvery: 3, shake: 9 });
    },
    fist(z, st, api, P) {
      const len = clamp(P.d, 150, 500), ex = z.x + Math.cos(P.a) * len, ey = z.y + Math.sin(P.a) * len, hit = P.W + len / 1400 + .05;
      startCombo(z, st, api, { aim: P.W, tx: ex, ty: ey, speed: 1400, contact: P.dmg * 1.4, trail: 'lava', hw: 60, wk: 'fire', after: 1.8 });
      spots(st, 'slam', 'lava', [sp(ex, ey, 240, hit)], P.dmg * 2.4, { wkEvery: 1, shake: 18 });
      spots(st, 'geyser', 'lava', ringSpots([], ex, ey, 9, 330, 78, hit + .28, .02, P.a), P.dmg * 1.4, { wkEvery: 3 });
    },
    // ===== Kokuō
    steamCharge(z, st, api, P) {
      const len = 860, ex = z.x + Math.cos(P.a) * len, ey = z.y + Math.sin(P.a) * len, list = [];
      startCombo(z, st, api, { aim: P.W, tx: ex, ty: ey, speed: 1500, contact: P.dmg * 2.0, trail: 'steam', hw: 70, wk: 'shockwave', after: 1.6 });
      for (let d = 70; d <= len; d += 105) list.push(sp(z.x + Math.cos(P.a) * d, z.y + Math.sin(P.a) * d, 90, P.W + d / 1500 + .4));
      spots(st, 'steamBurst', 'steam', list, P.dmg * 1.2, { wkEvery: 3 });
    },
    steamDome(z, st, api, P) {
      addFx(st, { kind: 'dome', sty: 'steam', x: z.x, y: z.y, r: 410, delay: P.W, end: P.W + 1.5, dmg: P.dmg * 2.4, knock: 240 });
    },
    hornRush(z, st, api, P) {
      startCombo(z, st, api, { n: 3, aim: P.W, next: .5, max: 470, over: 60, speed: 1600, contact: P.dmg * 1.4, trail: 'steam', hw: 60, wk: 'shockwave',
        endR: 155, endDmg: P.dmg * 1.7, sty: 'steam', after: 1.5 });
    },
    geysers(z, st, api, P) {
      spots(st, 'steamGeyser', 'steam', scatter(P.tx, P.ty, 8, 300, 96, P.W, .1), P.dmg * 1.6, { wkEvery: 3 });
    },
    // ===== Saiken
    acidBubbles(z, st, api, P) {
      const mo = mouthOf(z);
      spots(st, 'acidBubble', 'acid', scatter(P.tx, P.ty, 10, 340, 86, P.W + .55, .07), P.dmg * 1.4, { ox: mo.x, oy: mo.y, oh: mo.h, fallT: 1.1, puddle: { dur: 2.6, dmg: P.dmg * .25 }, wkEvery: 4 });
    },
    slimeWave(z, st, api, P) {
      wave(st, { look: 'acid', sty: 'acid', x: z.x, y: z.y, a: P.a, half: .7, reach: 720, speed: 640, delay: P.W, H: 80, dmg: P.dmg * 1.9, leave: { dur: 3.4, dmg: P.dmg * .3 } });
    },
    bombBubbles(z, st, api, P) {
      const list = ringSpots([], z.x, z.y, 8, 320, 125, P.W + 1.0, .03, P.a);
      ringSpots(list, z.x, z.y, 4, 160, 110, P.W + 1.15, .03, P.a + .4);
      spots(st, 'bombBubble', 'bomb', list, P.dmg * 2.0, { ox: z.x, oy: z.y, oh: 70, fallT: 1.5, wkEvery: 2, shake: 12 });
    },
    acidSpray(z, st, api, P) {
      const mo = mouthOf(z);
      [-.34, .34, 0].forEach((off, i) => beam(st, { look: 'acid', sty: 'acid', x: mo.x, y: mo.y, h: mo.h, a: P.a + off, len: 720, hw: 44, delay: P.W + i * .32, dur: .55, dmg: P.dmg * 1.7 }));
    },
    // ===== Chōmei
    scales(z, st, api, P) {
      wave(st, { look: 'powder', sty: 'powder', x: z.x, y: z.y, a: P.a, half: .78, reach: 680, speed: 760, delay: P.W, H: 70, dmg: P.dmg * 1.6, leave: { dur: 1.8, dmg: P.dmg * .22 } });
    },
    dive(z, st, api, P) {
      startCombo(z, st, api, { n: 3, aim: P.W, next: .65, max: 640, speed: 1500, contact: P.dmg * 1.2, trail: 'powder', hw: 50, lift: true, wk: 'shockwave',
        endR: 205, endDmg: P.dmg * 2.0, sty: 'powder', after: 1.6 });
    },
    gust(z, st, api, P) {
      wave(st, { look: 'wind', sty: 'wind', x: z.x, y: z.y, a: P.a, half: .56, reach: 820, speed: 1050, delay: P.W, H: 80, dmg: P.dmg * 1.6, knock: 290 });
    },
    powderBomb(z, st, api, P) {
      spots(st, 'powderBurst', 'powder', scatter(P.tx, P.ty, 13, 350, 82, P.W + .35, .06), P.dmg * 1.5, { wkEvery: 3 });
    },
    // ===== Gyūki
    inkCannon(z, st, api, P) {
      const mo = mouthOf(z), len = 940;
      beam(st, { look: 'ink', sty: 'ink', x: mo.x, y: mo.y, h: mo.h, a: P.a, len, hw: 58, delay: P.W, dur: .75, dmg: P.dmg * 2.2 });
      spots(st, 'inkSplash', 'ink', [sp(mo.x + Math.cos(P.a) * len, mo.y + Math.sin(P.a) * len, 175, P.W + .08)], P.dmg * 1.4, { wkEvery: 1 });
      for (const d of [330, 620]) addFx(st, { kind: 'field', look: 'ink', sty: 'ink', x: mo.x + Math.cos(P.a) * d, y: mo.y + Math.sin(P.a) * d, r: 95, delay: P.W + .1, dur: 2.6, end: P.W + 2.8, dmg: P.dmg * .22 });
    },
    tentacles(z, st, api, P) {
      const list = [], td = Math.min(P.d, 420);
      list.push(sp(z.x + Math.cos(P.a) * td, z.y + Math.sin(P.a) * td, 110, P.W));
      ringSpots(list, z.x, z.y, 8, 265, 105, P.W + .12, .085, P.a + Math.PI / 8);
      spots(st, 'tentacle', 'ink', list, P.dmg * 2.0, { ox: z.x, oy: z.y, wk: 'earth', wkEvery: 2, shake: 10 });
    },
    clone(z, st, api, P) {
      const nx = -Math.sin(P.a), ny = Math.cos(P.a);
      [-1, 1].forEach((s, i) => {
        const cx = P.tx + nx * 230 * s - Math.cos(P.a) * 40, cy = P.ty + ny * 230 * s - Math.sin(P.a) * 40;
        const tx = P.tx + nx * 40 * s, ty = P.ty + ny * 40 * s, slam = P.W + .45 + i * .3;
        addFx(st, { kind: 'clone', sty: 'ink', x: cx, y: cy, tx, ty, r: 160, appear: P.W * .45, slam, delay: slam, end: slam + 1.3, dmg: P.dmg * 2.2, cz: { beastPulse: 1, pulse: i * 2 } });
      });
    },
    inkPool(z, st, api, P) {
      addFx(st, { kind: 'field', look: 'ink', sty: 'ink', x: P.tx, y: P.ty, r: 310, delay: P.W * .5, dur: 4.4, end: P.W * .5 + 4.6, dmg: P.dmg * .25 });
      spots(st, 'inkSpout', 'ink', scatter(P.tx, P.ty, 7, 250, 86, P.W + .3, .14), P.dmg * 1.5, { wkEvery: 3 });
    },
    // ===== every beast: the Tailed Beast Ball
    bomb(z, st, api, P) {
      const mo = mouthOf(z), len = clamp(P.d + 30, 260, 900);
      addFx(st, { kind: 'charge', delay: P.W, end: P.W + .2 });
      orb(st, { look: 'bijuu', sty: 'bijuu', x: mo.x, y: mo.y, h0: mo.h, a: P.a, len, speed: 1500, r: 52, delay: P.W, dmg: P.dmg * 1.1, blastR: 290, blastDmg: P.dmg * 4.2 });
    }
  };

  const BOMB = { id: 'bomb', label: 'VĨ THÚ NGỌC', windup: 1.6, after: 2.4 };
  const mv = (id, label, windup, after) => ({ id, label, windup, after });
  const MOVES = {
    shukaku:  [mv('renku', 'PHONG ĐỘN · LUYỆN KHÔNG ĐẠN', 1.0, 1.9), mv('sandWave', 'SA ĐỘN · SA BA ĐẠI LÃNG', 1.1, 2.0), mv('coffin', 'SA PHƯỢC TÁNG', 1.0, 1.9), mv('spears', 'SA ĐỘN · SA THƯƠNG TRẬN', .95, 1.8)],
    matatabi: [mv('pillars', 'QUỶ HỎA · LAM VIÊM TRỤ', 1.0, 1.9), mv('claws', 'MIÊU TRẢO · QUỶ HỎA TRẢM', .8, 1.6), mv('flameSea', 'QUỶ ĐĂNG · LAM HỎA HẢI', 1.1, 2.0), mv('ring', 'HỎA LUÂN QUỶ ĐĂNG', .9, 1.9)],
    isobu:    [mv('coral', 'SAN HÔ THỨ LÂM', 1.0, 1.9), mv('tide', 'THỦY ĐỘN · ĐẠI HẢI KHIẾU', 1.15, 2.0), mv('roll', 'VỤ ẨN · THỨ GIÁP LUÂN', .9, 1.7), mv('waterBombs', 'THỦY ĐỘN · THỦY PHÁO ĐẠN', .9, 1.8)],
    songoku:  [mv('lavaRain', 'DUNG ĐỘN · NHAM VŨ', 1.0, 1.9), mv('lavaWave', 'DUNG ĐỘN · DUNG NHAM ĐẠI LÃNG', 1.1, 2.0), mv('eruption', 'HỎA SƠN BỘC PHÁT', 1.05, 2.0), mv('fist', 'DUNG ĐỘN · NHAM QUYỀN', .85, 1.8)],
    kokuo:    [mv('steamCharge', 'BỘC ĐỘN · CHƯNG KHÍ XUNG KÍCH', .9, 1.6), mv('steamDome', 'CHƯNG KHÍ BỘC · VIÊN CẦU', 1.1, 1.9), mv('hornRush', 'NGŨ VĨ · GIÁC XUNG LIÊN KÍCH', .8, 1.5), mv('geysers', 'CHƯNG KHÍ TUYỀN', 1.0, 1.8)],
    saiken:   [mv('acidBubbles', 'TOAN BÀO TRƯỜNG', .9, 1.9), mv('slimeWave', 'ĂN MÒN · DỊCH NHỜN ĐẠI LÃNG', 1.1, 2.0), mv('bombBubbles', 'BỘC BÀO · BONG BÓNG NỔ', .8, 2.0), mv('acidSpray', 'TOAN ĐỘC PHÚN XẠ', .9, 1.7)],
    chomei:   [mv('scales', 'LÂN PHẤN LÓA MẮT', 1.0, 1.8), mv('dive', 'THẤT VĨ · BỔ NHÀO OANH TẠC', .8, 1.6), mv('gust', 'SÍ PHONG · CUỒNG PHONG', 1.0, 1.8), mv('powderBomb', 'LÂN PHẤN BỘC LIỆT', .95, 1.9)],
    gyuki:    [mv('inkCannon', 'MẶC ĐỘN · MẶC PHÁO', 1.0, 1.8), mv('tentacles', 'BÁT VĨ · XÚC TU OANH KÍCH', .95, 1.9), mv('clone', 'CHƯƠNG NGƯ PHÂN THÂN', .9, 2.0), mv('inkPool', 'MẶC ĐỘN · MẶC TRÌ', 1.0, 1.9)]
  };
  for (const id in MOVES) MOVES[id].push(BOMB);
  // Manual control (team mode): the beast's jutsu in key order 1..n, the Bijūdama last.
  const MANUAL = {};
  for (const id in MOVES) MANUAL[id] = MOVES[id].slice(0, 8).map(d => ({ id: d.id, label: d.label }));
  function moves(z) { return (z && MANUAL[z.beastId || z.bossId]) || []; }
  // The hero (or a co-op teammate) carries invuln frames; units of another team and the cursor do not.
  const heroTarget = p => !!p && !p.pseudo && !p.type;

  // ---------------------------------------------------------------- behaviour
  function announce(z, st, api) {
    const list = MOVES[z.beastId];
    let def = null;
    if (z.tbForce) { def = list.find(d => d.id === z.tbForce) || null; z.tbForce = null; }
    if (!def) { def = list[st.casts % list.length]; st.casts++; }
    const p = api.player || { x: z.x + facingOf(z) * 300, y: z.y }, a = Math.atan2(p.y - z.y, p.x - z.x), d = Math.hypot(p.x - z.x, p.y - z.y);
    st.after = def.after; st.windMax = def.windup;
    z.beastSkill = def.id; z.beastLabel = def.label;
    PLAN[def.id](z, st, api, { tx: p.x, ty: p.y, a, d, dmg: api.damage, W: def.windup });
    if (!st.combo) { st.windup = def.windup; z.beastWindup = def.windup; }
    api.burst(z.x, z.y - 40, members[z.beastId].accent, 10);
  }

  function updateCombo(z, st, api, dt) {
    const c = st.combo;
    c.t += dt;
    if (c.phase === 'aim') {
      z.beastWindup = Math.max(.02, c.aim - c.t); z.beastDashTimer = 0;
      if (c.lift && (c.i === 0 || c.t > .22)) st.lift = Math.min(1, st.lift + dt * 2.8);
      if (c.t >= c.aim) {
        c.phase = 'go'; c.t = 0; c.dist = Math.hypot(c.tx - z.x, c.ty - z.y); c.dur = c.dist / c.speed + .15;
        z.beastPulse = .3; api.shake(6);
      }
      return;
    }
    z.beastWindup = 0; z.beastDashTimer = .1;
    const dx = c.tx - z.x, dy = c.ty - z.y, rem = Math.hypot(dx, dy), step = c.speed * dt, k = Math.min(1, step / (rem || 1));
    const ox = z.x, oy = z.y;
    api.move(dx * k, dy * k);
    const moved = Math.hypot(z.x - ox, z.y - oy);
    if (c.roll) st.rollA += moved / 46;
    if (c.lift) st.lift = c01(rem / Math.max(1, c.dist)) * .9;
    if ((st.trailT -= dt) <= 0 && c.trail) { st.trailT = .035; st.trail.push({ x: z.x, y: z.y, age: 0, look: c.trail, seed: Math.random() * 40 }); if (st.trail.length > 16) st.trail.shift(); }
    if ((c.hitT -= dt) <= 0 && c.contact) { c.hitT = .05; st.tickAt = api.time; api.strike(z.x, z.y, z.r + 34, c.contact, null, null, true); }
    c.worldD += moved;
    if (c.worldD > 150 && c.wk) { c.worldD = 0; api.world(z.x, z.y, 56, c.contact * 1.3, c.wk, c.a); }
    if (rem <= step + 2 || c.t >= c.dur || moved < step * .1 && c.t > .1) {
      z.beastDashTimer = 0;
      if (c.endR) {
        unblock(st, api);
        api.strike(z.x, z.y, c.endR, c.endDmg, null, c.wk, true);
        addFx(st, { kind: 'blast', x: z.x, y: z.y, r: c.endR, sty: c.sty, end: 1.3, seed: Math.random() * 50 });
        api.shake(13);
      }
      c.i++;
      if (c.i < c.n) { c.phase = 'aim'; c.t = 0; c.aim = c.next; aimCombo(z, c, api.player); }
      else { st.combo = null; st.lift = 0; z.beastPulse = .4; st.timer = c.after * (z.health < z.maxHealth * .5 ? .78 : 1); }
    }
  }

  // A lingering tick (puddle, burning field) leaves the target briefly invulnerable; a big telegraphed
  // hit that lands right after one of our own ticks should not be swallowed by it.
  function unblock(st, api) {
    const p = api.player;
    if (heroTarget(p) && p.invuln > 0 && p.invuln <= .38 && api.time - (st.tickAt === undefined ? -9 : st.tickAt) < .4) p.invuln = 0;
  }
  function tickFx(z, st, fx, dt, api) {
    const t = fx.age;
    switch (fx.kind) {
      case 'spots': {
        for (let i = 0; i < fx.spots.length; i++) {
          const s = fx.spots[i];
          if (s.hit || t < s.d) continue;
          s.hit = true;
          unblock(st, api);
          api.strike(s.x, s.y, s.r, fx.dmg, null, fx.wk && i % fx.wkEvery === 0 ? fx.wk : null, true);
          if (i % 3 === 0) api.shake(fx.shake || 7);
        }
        if (fx.puddle && (fx.tick = (fx.tick || .5) - dt) <= 0) {
          fx.tick = .5; st.tickAt = api.time;
          for (const s of fx.spots) if (s.hit && t - s.d < fx.puddle.dur) api.strike(s.x, s.y, s.r * .75, fx.puddle.dmg, null, null, true);
        }
        break;
      }
      case 'wave': {
        if (t < fx.delay) break;
        if (!fx.shook) { fx.shook = true; api.shake(11); }
        const front = Math.min(fx.reach, (t - fx.delay) * fx.speed), p = api.player, hero = heroTarget(p);
        for (let i = 0; i < fx.hits.length; i++) {
          const h = fx.hits[i];
          if (h.done || h.d > front) continue;
          // each strike circle stays live for a moment after the front passes, until the wave lands once
          // (a unit of another team or the cursor has no invuln frames: each circle lands once)
          if (fx.landed || front - h.d > fx.speed * .3 || !hero) h.done = true;
          if (!h.tried) { h.tried = true; unblock(st, api); if (fx.wk && i % 4 === 0) api.world(h.x, h.y, h.r, fx.dmg * 1.3, fx.wk, fx.a); }
          const pre = hero ? p.invuln : 0;
          api.strike(h.x, h.y, h.r, fx.dmg, null, null, true);
          if (hero && pre <= 0 && p.invuln > 0) fx.landed = true;
          if (fx.knock && !fx.knocked && p && !p.pseudo && Math.hypot(p.x - h.x, p.y - h.y) < h.r + (p.r || 12)) { fx.knocked = true; api.knockback({ x: fx.x, y: fx.y }, front + 80, fx.knock, 0); }
        }
        if (fx.leave && front >= fx.reach && (fx.tick = (fx.tick === undefined ? .3 : fx.tick) - dt) <= 0) {
          fx.tick = .5; st.tickAt = api.time;
          for (const h of fx.hits) api.strike(h.x, h.y, h.r * .85, fx.leave.dmg, null, null, true);
        }
        break;
      }
      case 'orb': {
        if (t < fx.delay || fx.done) break;
        const p = (t - fx.delay) * fx.speed;
        if (p >= fx.len) {
          fx.done = true; fx.doneAt = t;
          const ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
          unblock(st, api);
          api.strike(ex, ey, fx.blastR, fx.blastDmg, null, PAL[fx.sty].wk, true);
          if (fx.look === 'bijuu') { api.world(ex, ey, fx.blastR * 1.1, fx.blastDmg * 2, 'crater', fx.a); api.shake(22); }
          else api.shake(12);
        } else if ((fx.hitT -= dt) <= 0) {
          fx.hitT = .05; st.tickAt = api.time;
          api.strike(fx.x + Math.cos(fx.a) * p, fx.y + Math.sin(fx.a) * p, fx.r + 26, fx.dmg, null, null, true);
        }
        break;
      }
      case 'beam': {
        if (t < fx.delay) break;
        const ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
        if (fx.ticks === 0) { fx.ticks = 1; unblock(st, api); api.line(fx.x, fx.y, ex, ey, fx.hw, fx.dmg, PAL[fx.sty].wk); api.shake(12); }
        else if (fx.ticks === 1 && t > fx.delay + .42) { fx.ticks = 2; api.line(fx.x, fx.y, ex, ey, fx.hw * .8, fx.dmg * .35); }
        break;
      }
      case 'ring': {
        if (t < fx.delay || t > fx.delay + fx.dur) break;
        if ((fx.tick -= dt) > 0) break;
        fx.tick = .06; unblock(st, api);
        const k = (t - fx.delay) / fx.dur, r = fx.r0 + (fx.r1 - fx.r0) * k, n = Math.max(6, Math.ceil(TAU * r / 52));
        for (let i = 0; i < n; i++) { const a = i * TAU / n; api.strike(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 30, fx.dmg, null, null, true); }
        break;
      }
      case 'dome': {
        if (t < fx.delay || fx.fired) break;
        fx.fired = true; unblock(st, api);
        api.strike(fx.x, fx.y, fx.r, fx.dmg, null, 'shockwave', true);
        api.knockback({ x: fx.x, y: fx.y }, fx.r, fx.knock, 0);
        api.shake(18);
        break;
      }
      case 'field': {
        if (!fx.dmg || t < fx.delay || t > fx.delay + fx.dur) break;
        if ((fx.tick = (fx.tick || .5) - dt) <= 0) { fx.tick = .5; st.tickAt = api.time; api.strike(fx.x, fx.y, fx.r * .92, fx.dmg, null, null, true); }
        break;
      }
      case 'slash': {
        if (t < fx.delay || fx.fired) break;
        fx.fired = true; unblock(st, api);
        fx.hits.forEach((h, i) => api.strike(h.x, h.y, h.r, fx.dmg, null, i % 4 === 0 ? 'blade' : null, true));
        api.shake(12);
        break;
      }
      case 'clone': {
        if (t < fx.slam || fx.fired) break;
        fx.fired = true; unblock(st, api);
        api.strike(fx.tx, fx.ty, fx.r, fx.dmg, null, 'earth', true);
        api.shake(13);
        break;
      }
    }
  }

  function update(z, dt, api) {
    if (!members[z.beastId]) return;
    const st = state(z);
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      tickFx(z, st, fx, dt, api);
      if (fx.age >= fx.end) st.fx.splice(i, 1);
    }
    for (let i = st.trail.length - 1; i >= 0; i--) if ((st.trail[i].age += dt) > .6) st.trail.splice(i, 1);
    if (z.health <= 0) {
      if (!st.dead) {
        // A beast that falls mid-jutsu takes its unreleased jutsu with it.
        st.dead = true; st.combo = null; st.windup = 0; st.lift = 0;
        st.fx = st.fx.filter(fx => fx.age >= fx.delay && fx.kind !== 'charge');
      }
      z.beastWindup = 0; z.beastDashTimer = 0; z.manualBusy = false;
      return;
    }
    z.manualBusy = !!st.combo || st.windup > 0;
    z.beastPulse = Math.max(0, (z.beastPulse || 0) - dt);
    if (st.combo) { updateCombo(z, st, api, dt); return; }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      z.beastWindup = st.windup;
      if (st.windup === 0) {
        z.beastPulse = .45;
        st.timer = st.after * (z.health < z.maxHealth * .5 ? .78 : 1);
      }
      return;
    }
    if (z.manual) {
      // Controlled by the user: only the requested jutsu, once nothing is still running.
      if (z.manualCast != null) {
        const mv = moves(z)[z.manualCast];
        z.manualCast = null;
        if (mv) { z.tbForce = mv.id; announce(z, st, api); }
      }
    } else {
      st.timer -= dt;
      const p = api.player;
      if (st.timer <= 0 && p && Math.hypot(p.x - z.x, p.y - z.y) < 980) announce(z, st, api);
    }
    z.manualBusy = !!st.combo || st.windup > 0;
  }

  // ---------------------------------------------------------------- drawing helpers
  // Anime cel look: flat base, a hard bottom-right form shadow (the shape minus a copy of
  // itself nudged up-left), a thin top-left rim light and a crisp dark outline. Static body
  // parts are rendered once into 2x offscreen canvases; tails, limbs and effects stay live.
  const ell = (g, x, y, rx, ry, r = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, r, 0, TAU); };
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  const isAct = z => z.beastPulse > 0 || z.beastWindup > 0;

  // Smooth closed outline through the midpoints of a control polygon.
  function blob(g, p) {
    const n = p.length;
    g.beginPath(); g.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    g.closePath();
  }
  function bez(p0, p1, p2, n = 10) {
    const out = [];
    for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); }
    return out;
  }
  // Centre line of a tail: bends steadily (curl), harder near the tip (tc) and whips with a travelling wave.
  function spine(x, y, ang, len, curl, amp, ph, n = 12, tc = 0) {
    const pts = [[x, y]], st = len / n;
    for (let k = 1; k <= n; k++) {
      const u = (k - .5) / n, a = ang + curl * u + tc * u * u * u + amp * u * Math.sin(ph - u * 2.8);
      x += Math.cos(a) * st; y += Math.sin(a) * st; pts.push([x, y]);
    }
    return pts;
  }
  function ribbon(pts, wf) {
    const n = pts.length - 1, L = [], R = [];
    for (let k = 0; k <= n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n, k + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = wf(k / n);
      L.push([pts[k][0] - dy / d * w, pts[k][1] + dx / d * w]); R.push([pts[k][0] + dy / d * w, pts[k][1] - dx / d * w]);
    }
    const a = pts[n - 1], b = pts[n], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, w = wf(1) * 1.3;
    return { L, R, P: pts, E: [b[0] + (b[0] - a[0]) / d * w, b[1] + (b[1] - a[1]) / d * w] };
  }
  function ribbonPath(g, rb, keep) {
    const { L, R, E } = rb, n = L.length - 1;
    if (!keep) g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let k = 1; k < n; k++) g.quadraticCurveTo(L[k][0], L[k][1], (L[k][0] + L[k + 1][0]) / 2, (L[k][1] + L[k + 1][1]) / 2);
    g.lineTo(L[n][0], L[n][1]); g.quadraticCurveTo(E[0], E[1], R[n][0], R[n][1]);
    for (let k = n - 1; k > 0; k--) g.quadraticCurveTo(R[k][0], R[k][1], (R[k][0] + R[k - 1][0]) / 2, (R[k][1] + R[k - 1][1]) / 2);
    g.lineTo(R[0][0], R[0][1]); g.closePath();
  }

  // The cut-out rectangle only needs to cover one beast's local frame (keeps fill area small).
  function carve(g, build, dx, dy) { g.save(); g.translate(dx, dy); build(); g.restore(); g.rect(-200, -320, 400, 460); }
  // A 'multiply' tint is costly on accelerated canvases, so each shadow tint is turned into a
  // translucent overlay that darkens a mid-tone base by about the same amount.
  const shades = new Map();
  function shadeOf(hex) {
    let c = shades.get(hex);
    if (!c) {
      const m = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), a = Math.min(.85, 1 - (m[0] + m[1] + m[2]) / 3 + .04);
      const ch = m.map(v => Math.round(Math.max(0, Math.min(1, .62 * (v - (1 - a)) / a)) * 255));
      c = 'rgba(' + ch.join(',') + ',' + a.toFixed(3) + ')'; shades.set(hex, c);
    }
    return c;
  }
  // o: f fill · d markings (clipped) · s multiply shadow + so offset · h rim light + ho offset · d2 late detail · l/w outline
  function cel(g, build, o) {
    build(); g.fillStyle = o.f; g.fill();
    if (o.d || o.s || o.h || o.d2) {
      g.save(); g.clip();
      if (o.d) o.d();
      if (o.s) {
        const so = o.so || [-8, -7];
        carve(g, build, so[0], so[1]); g.fillStyle = shadeOf(o.s); g.fill('evenodd');
      }
      if (o.h) { const ho = o.ho || [3, 3]; carve(g, build, ho[0], ho[1]); g.fillStyle = o.h; g.fill('evenodd'); }
      if (o.d2) o.d2();
      g.restore();
    }
    if (o.l) { build(); g.strokeStyle = o.l; g.lineWidth = o.w || 2.4; g.stroke(); }
  }
  // Tapered brush stroke (markings, stripes, creases).
  function brush(g, p0, p1, p2, w, color, keep) {
    const rb = ribbon(bez(p0, p1, p2, 8), u => w * Math.sin(Math.PI * (.06 + .88 * u)));
    ribbonPath(g, rb, keep);
    if (!keep) { g.fillStyle = color; g.fill(); }
  }
  function limb(g, p0, p1, p2, w0, w1, o) {
    const rb = ribbon(bez(p0, p1, p2, 8), u => w0 + (w1 - w0) * u);
    cel(g, () => ribbonPath(g, rb), o);
    return rb;
  }
  function claws(g, x, y, n, gap, len, ang, color, line) {
    g.fillStyle = color; g.strokeStyle = line; g.lineWidth = 1.2;
    for (let i = 0; i < n; i++) {
      const bx = x + (i - (n - 1) / 2) * gap, a = ang + (i - (n - 1) / 2) * .12;
      const tx = bx + Math.cos(a) * len, ty = y + Math.sin(a) * len;
      g.beginPath(); g.moveTo(bx - 2.4, y); g.quadraticCurveTo(bx + Math.cos(a - .5) * len * .7, y + Math.sin(a - .5) * len * .7, tx, ty);
      g.lineTo(bx + 2.4, y); g.closePath(); g.fill(); g.stroke();
    }
  }
  function teethAlong(g, pts, size, dir, color) {
    g.fillStyle = color || '#fbf6e8';
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i], s = size * (.75 + .25 * Math.sin(i * 2.3));
      g.beginPath(); g.moveTo(x - s * .55, y - dir * 2); g.lineTo(x, y + dir * s); g.lineTo(x + s * .55, y - dir * 2); g.closePath(); g.fill();
    }
  }
  // Anime eye: sclera cut by a slanted upper lid (l0 back corner, l1 front corner, -1 = no cut).
  function eye(g, x, y, rx, ry, o) {
    const l0 = o.l0 === undefined ? -1.3 : o.l0, l1 = o.l1 === undefined ? -1.3 : o.l1, line = o.line || '#140a0a';
    g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot);
    g.save();
    g.beginPath(); g.moveTo(-rx - 3, l0 * ry); g.lineTo(rx + 3, l1 * ry); g.lineTo(rx + 3, ry + 3); g.lineTo(-rx - 3, ry + 3); g.closePath(); g.clip();
    ell(g, 0, 0, rx, ry); g.fillStyle = o.sclera; g.fill();
    g.save(); g.clip();
    const lx = (o.look === undefined ? .18 : o.look) * rx, ir = o.irisR || .62;
    if (o.iris) { ell(g, lx, 0, rx * ir, ry * ir * 1.05); g.fillStyle = o.iris; g.fill(); }
    g.fillStyle = o.pupilColor || '#120808';
    if (o.pupil === 'slit') { ell(g, lx, 0, rx * .13, ry * .78); g.fill(); }
    else if (o.pupil === 'dot') { ell(g, lx, 0, rx * (o.pr || .26), ry * (o.pr || .26) * 1.1); g.fill(); }
    else if (o.pupil === 'star') {
      const r = Math.min(rx, ry) * .62;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * .22 : r; g.lineTo(lx + Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ell(g, lx + Math.cos(a) * r * .72, Math.sin(a) * r * .72, r * .13, r * .13); g.fill(); }
    }
    g.fillStyle = 'rgba(40,10,40,.28)'; ell(g, 0, -ry * 1.15, rx * 1.3, ry * .62); g.fill();
    g.fillStyle = 'rgba(255,255,255,.92)'; ell(g, lx - rx * .3, -ry * .3, Math.max(1.2, rx * .17), Math.max(1.1, ry * .16)); g.fill();
    g.restore();
    ell(g, 0, 0, rx, ry); g.strokeStyle = line; g.lineWidth = 1.4; g.stroke();
    g.restore();
    if (l0 > -1.05 || l1 > -1.05) { g.beginPath(); g.moveTo(-rx - 1.5, l0 * ry); g.lineTo(rx + 1.5, l1 * ry); g.strokeStyle = line; g.lineWidth = o.lidW || 3; g.stroke(); }
    g.restore();
  }
  // Flames are batched: every tongue of one colour goes into a single path and a single fill.
  function flamePath(g, x, y, h, w, lean) {
    g.moveTo(x - w, y);
    g.quadraticCurveTo(x - w * .8 + lean * .2, y - h * .62, x + lean, y - h);
    g.quadraticCurveTo(x + w * .9 + lean * .3, y - h * .5, x + w, y);
    g.quadraticCurveTo(x, y + w * .9, x - w, y); g.closePath();
  }
  function flames(g, list, colors) {
    colors.forEach((c, i) => {
      if (!c) return;
      const k = [1, .62, .34][i];
      g.beginPath();
      for (const [x, y, h, w, lean] of list) flamePath(g, x, y + i, h * k, w * (1 - i * .25), lean * k);
      g.fillStyle = c; g.fill();
    });
  }

  const S = 2;
  const parts = new Map();
  function part(ctx, key, x, y, w, h, fn) {
    let c = parts.get(key);
    if (c === undefined) {
      c = null;
      try {
        c = document.createElement('canvas');
        c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
        const g = c.getContext('2d');
        g.scale(S, S); g.translate(-x, -y); g.lineJoin = 'round'; g.lineCap = 'round';
        fn(g);
      } catch (e) { c = null; }
      parts.set(key, c);
    }
    if (c) ctx.drawImage(c, x, y, w, h); else { ctx.save(); fn(ctx); ctx.restore(); }
  }
  const glows = new Map();
  function glow(ctx, x, y, r, color, a) {
    let c = glows.get(color);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, color); gr.addColorStop(.45, color.replace(/[\d.]+\)$/, '0.35)')); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glows.set(color, c);
    }
    const ga = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    ctx.globalAlpha = ga * a; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(c, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
  }

  // Live tails can't afford clipping, so their cel shading is geometric: bands hugging whichever
  // edge faces away from (shadow) or towards (rim light) the top-left light.
  function tailCel(g, rb, o) {
    ribbonPath(g, rb); g.fillStyle = o.f; g.fill();
    if (o.d) o.d();
    const { L, R, P } = rb, n = P.length - 1;
    for (const [col, sign, depth] of [[o.s && shadeOf(o.s), 1, o.sd || .5], [o.h, -1, o.hd || .17]]) {
      if (!col) continue;
      g.beginPath();
      for (const E of [L, R]) {
        g.moveTo(E[0][0], E[0][1]);
        for (let k = 1; k <= n; k++) g.lineTo(E[k][0], E[k][1]);
        for (let k = n; k >= 0; k--) {
          const ex = E[k][0] - P[k][0], ey = E[k][1] - P[k][1], len = Math.hypot(ex, ey) || 1;
          const f = Math.max(0, sign * (ex + ey) / len * Math.SQRT1_2), d = Math.min(.95, depth * 2 * Math.pow(f, .6));
          g.lineTo(E[k][0] - ex * d, E[k][1] - ey * d);
        }
        g.closePath();
      }
      g.fillStyle = col; g.fill();
    }
    if (o.l) { ribbonPath(g, rb); g.strokeStyle = o.l; g.lineWidth = o.w || 2.4; g.stroke(); }
  }
  // Cached sprite drawn around a pivot (hip / shoulder) with rotation and shear for walk cycles.
  function sprite(ctx, key, px, py, rot, shear, x, y, w, h, fn) {
    ctx.save(); ctx.translate(px, py);
    if (rot) ctx.rotate(rot);
    if (shear) ctx.transform(1, 0, shear, 1, 0, 0);
    part(ctx, key, x, y, w, h, fn);
    ctx.restore();
  }
  // ---------------------------------------------------------------- the eight
  const ART = {};

  // ===== Ichibi · Shukaku: pot-bellied sand tanuki covered in indigo seal markings
  const SHU = { line: '#3a2410', sand: '#dcb877', sandD: '#c39c5e', belly: '#f0dba9', mul: '#b49cb2', hi: 'rgba(255,248,224,.6)', ink: '#34479e', inkD: '#1d275f' };
  function shukakuBody(g) {
    const C = SHU;
    limb(g, [-30, -116], [-66, -102], [-60, -68], 12, 9, { f: C.sandD, s: C.mul, so: [-5, -5], l: C.line, w: 2.4,
      d: () => { brush(g, [-38, -112], [-56, -100], [-62, -84], 3.2, C.ink); } });
    claws(g, -62, -62, 3, 5, 8, 1.8, '#f6efdc', C.line);
    cel(g, () => blob(g, [[-52, -20], [-74, -80], [-48, -138], [10, -150], [60, -122], [70, -60], [44, -10], [0, -2]]), {
      f: C.sand, s: C.mul, so: [-18, -12], h: C.hi, ho: [5, 5], l: C.line, w: 3,
      d: () => {
        g.fillStyle = C.belly; blob(g, [[6, -16], [-12, -62], [8, -116], [52, -106], [66, -52], [40, -14]]); g.fill();
        brush(g, [-50, -34], [-68, -88], [-36, -130], 6, C.ink);
        brush(g, [-30, -26], [-46, -66], [-24, -104], 4.2, C.ink);
        brush(g, [-12, -128], [12, -142], [40, -134], 5, C.ink);
        brush(g, [6, -106], [28, -90], [54, -104], 4.6, C.ink);
        brush(g, [10, -78], [30, -62], [58, -76], 4, C.ink);
        brush(g, [14, -48], [30, -34], [52, -46], 3.6, C.ink);
        brush(g, [-10, -36], [-14, -60], [-4, -80], 3, C.ink);
        g.fillStyle = C.ink;
        for (const [x, y, r] of [[-32, -86, 3.6], [-18, -118, 3], [-56, -58, 3.2], [24, -118, 2.6], [40, -88, 2.4], [-6, -98, 2.4], [-40, -108, 2.6]]) { ell(g, x, y, r, r); g.fill(); }
      }
    });
  }
  function shukakuHead(g, act) {
    const C = SHU;
    g.translate(0, 18);
    for (const [p, q] of [[[[-26, -150], [-46, -206], [2, -178]], [[-22, -160], [-40, -196], [-6, -176]]], [[[24, -182], [48, -214], [60, -168]], [[32, -178], [47, -204], [54, -172]]]])
      cel(g, () => poly(g, p), { f: C.sand, s: C.mul, so: [-4, -4], l: C.line, w: 2.4, d: () => { g.fillStyle = C.ink; poly(g, q); g.fill(); } });
    cel(g, () => blob(g, [[-30, -146], [-26, -180], [12, -194], [54, -188], [78, -158], [70, -124], [26, -110], [-20, -116]]), {
      f: C.sand, s: C.mul, so: [-12, -9], h: C.hi, ho: [4, 4], l: C.line, w: 3,
      d: () => {
        g.fillStyle = C.belly; blob(g, [[0, -132], [20, -144], [56, -144], [76, -134], [64, -112], [24, -108]]); g.fill();
        g.fillStyle = C.ink;
        blob(g, [[-4, -160], [8, -178], [30, -168], [44, -180], [70, -166], [72, -148], [50, -146], [30, -152], [10, -144], [-6, -148]]); g.fill();
        brush(g, [0, -190], [22, -176], [46, -190], 3.8, C.ink);
        brush(g, [-22, -172], [-26, -148], [-16, -128], 4.4, C.ink);
        brush(g, [74, -150], [60, -130], [68, -116], 3, C.ink);
      }
    });
    eye(g, 16, -160, 11, 9.5, { sclera: '#f7d03c', pupil: 'star', l0: -1.3, l1: -.5, line: C.inkD, look: .1 });
    eye(g, 52, -160, 9.5, 8.5, { sclera: '#f7d03c', pupil: 'star', l0: -.55, l1: -1.3, line: C.inkD, look: .1 });
    const jaw = act ? -66 : -94, up = [-2, -138], upc = [38, -124], end = [76, -142];
    const mouth = () => { g.beginPath(); g.moveTo(up[0], up[1]); g.quadraticCurveTo(upc[0], upc[1], end[0], end[1]); g.quadraticCurveTo(40, jaw, up[0], up[1]); g.closePath(); };
    cel(g, mouth, { f: '#521216', l: C.line, w: 2.6, d: () => {
      g.fillStyle = '#b4404a'; ell(g, 38, (jaw - 140) / 2 + 12, act ? 22 : 16, act ? 9 : 5); g.fill();
      teethAlong(g, bez(up, upc, end, 11), act ? 9 : 7, 1);
      teethAlong(g, bez(up, [40, jaw], end, 9), act ? 9 : 7, -1);
    } });
  }
  ART.shukaku = (ctx, t, z) => {
    const C = SHU, act = isAct(z), ph = (z.pulse || 0) * 1.6, step = Math.sin(ph);
    const breath = Math.sin(t * 2.1) * .012;
    const tp = ribbon(spine(-30, -62, -2.8, 182, 1.6, .22, t * 1.5, 13), u => (22 + 16 * Math.sin(u * 3)) * (1 - u * u) + 1.5);
    tailCel(ctx, tp, { f: C.sand, s: C.mul, h: C.hi, l: C.line, w: 2.8,
      d: () => { ctx.beginPath(); for (let k = 2; k < 12; k += 2) brush(ctx, tp.L[k], tp.P[k + 1], tp.R[k], k > 8 ? 2.6 : 3.6, C.ink, true); ctx.fillStyle = C.ink; ctx.fill(); } });
    for (const [lx, far] of [[-26, 1], [22, 0]]) {
      const s = (far ? -step : step) * 4, lift = Math.max(0, far ? -step : step) * 3;
      sprite(ctx, far ? 'shukaku:legF' : 'shukaku:legN', lx, -40 - lift, 0, s / 38, -30, -12, 82, 62, g => {
        cel(g, () => blob(g, [[-20, -2], [16, -4], [22, 28], [34, 36], [-18, 38]]),
          { f: far ? C.sandD : C.sand, s: C.mul, so: [-6, -5], h: far ? null : C.hi, ho: [3, 3], l: C.line, w: 2.6, d: () => brush(g, [-14, 10], [2, 18], [18, 10], 3, C.ink) });
        claws(g, 24, 36, 3, 6, 6, .4, '#f6efdc', C.line);
      });
    }
    ctx.save(); ctx.scale(1, 1 + breath);
    part(ctx, 'shukaku:body', -84, -158, 162, 160, shukakuBody);
    ctx.translate(0, -2 * breath * 100);
    part(ctx, act ? 'shukaku:head1' : 'shukaku:head0', -54, -204, 140, 120, g => shukakuHead(g, act));
    ctx.restore();
    part(ctx, act ? 'shukaku:arm1' : 'shukaku:arm0', 18, -130, 92, 110, g => {
      const ax = act ? 84 : 66, ay = act ? -104 : -40;
      limb(g, [34, -84], [act ? 70 : 72, act ? -84 : -72], [ax, ay], 16, 11, { f: C.sand, s: C.mul, so: [-6, -5], h: C.hi, ho: [3, 3], l: C.line, w: 2.6,
        d: () => { brush(g, [42, -86], [60, -80], [68, -66], 3.4, C.ink); } });
      cel(g, () => ell(g, ax, ay, 14, 12), { f: C.sand, s: C.mul, so: [-5, -5], h: C.hi, ho: [2, 2], l: C.line, w: 2.6 });
      claws(g, ax + 6, ay + (act ? -8 : 8), 3, 7, 10, act ? -.7 : 1.0, '#f6efdc', C.line);
    });
  };

  // ===== Nibi · Matatabi: a cat of living blue flame with mismatched eyes
  const MAT = { line: '#0a1440', body: '#2f6fe8', dark: '#1f4fc4', belly: '#79b6ff', stripe: '#0d1a56', mul: '#8e8fd8', hi: 'rgba(200,236,255,.6)',
    f1: '#2456d8', f2: '#5aa8ff', f3: '#d4f0ff' };
  function matatabiBody(g) {
    const C = MAT;
    cel(g, () => blob(g, [[-74, -86], [-50, -90], [-36, -66], [-44, -40], [-70, -44]]), { f: C.dark, s: C.mul, so: [-6, -5], l: C.line, w: 2.6 });
    cel(g, () => blob(g, [[-70, -58], [-70, -98], [-32, -106], [18, -100], [50, -116], [70, -88], [52, -50], [0, -42], [-52, -44]]), {
      f: C.body, s: C.mul, so: [-12, -10], h: C.hi, ho: [4, 4], l: C.line, w: 2.8,
      d: () => {
        g.fillStyle = C.belly; blob(g, [[-50, -40], [-24, -62], [30, -64], [64, -74], [64, -46], [0, -36]]); g.fill();
        for (let i = 0; i < 5; i++) { const x = -52 + i * 21; brush(g, [x, -108], [x + 8, -90], [x - 2, -66], 5, C.stripe); }
        brush(g, [-62, -88], [-70, -72], [-58, -56], 4, C.stripe);
      }
    });
  }
  // Near haunch and shoulder sit over the near legs' tops.
  function matatabiHaunch(g) {
    const C = MAT;
    cel(g, () => blob(g, [[-64, -84], [-36, -92], [-24, -64], [-34, -40], [-62, -44]]), { f: C.body, s: C.mul, so: [-7, -6], h: C.hi, ho: [3, 3], l: C.line, w: 2.6,
      d: () => { brush(g, [-56, -80], [-40, -70], [-42, -50], 3.6, C.stripe); } });
    cel(g, () => blob(g, [[34, -96], [60, -96], [64, -64], [56, -44], [36, -50]]), { f: C.body, s: C.mul, so: [-7, -6], h: C.hi, ho: [3, 3], l: C.line, w: 2.6,
      d: () => { g.fillStyle = C.belly; ell(g, 58, -58, 10, 14); g.fill(); } });
  }
  function matatabiHead(g, act) {
    const C = MAT;
    for (const [p, q] of [[[[48, -118], [50, -158], [74, -132]], [[53, -124], [54, -148], [68, -132]]], [[[80, -132], [100, -160], [104, -118]], [[86, -132], [99, -152], [100, -124]]]])
      cel(g, () => poly(g, p), { f: C.body, s: C.mul, so: [-3, -3], l: C.line, w: 2.2, d: () => { g.fillStyle = '#9fd0ff'; poly(g, q); g.fill(); } });
    cel(g, () => blob(g, [[42, -110], [52, -138], [88, -138], [108, -114], [112, -92], [94, -78], [62, -78], [42, -92]]), {
      f: C.body, s: C.mul, so: [-8, -7], h: C.hi, ho: [3, 3], l: C.line, w: 2.8,
      d: () => {
        g.fillStyle = '#d9eeff'; blob(g, [[78, -98], [96, -104], [114, -96], [110, -80], [86, -78]]); g.fill();
        brush(g, [60, -136], [64, -126], [60, -116], 3.6, C.stripe); brush(g, [72, -138], [76, -128], [72, -118], 3.6, C.stripe);
        brush(g, [48, -100], [56, -96], [64, -98], 2.6, C.stripe); brush(g, [46, -92], [54, -88], [62, -90], 2.4, C.stripe);
      }
    });
    eye(g, 70, -108, 9, 7.5, { sclera: '#a8f05a', iris: null, pupil: 'slit', l0: -1.3, l1: -.45, line: C.line, look: .1 });
    eye(g, 94, -108, 7, 6.8, { sclera: '#ffd83a', pupil: 'slit', l0: -.5, l1: -1.3, line: C.line, look: .1 });
    poly(g, [[106, -98], [114, -97], [110, -92]]); g.fillStyle = '#0a1440'; g.fill();
    const jaw = act ? -74 : -84;
    g.beginPath(); g.moveTo(84, -88); g.quadraticCurveTo(100, act ? -86 : -88, 112, -92); g.quadraticCurveTo(100, jaw, 84, -88); g.closePath();
    g.fillStyle = '#2a0a28'; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = '#ffffff'; g.strokeStyle = C.line; g.lineWidth = 1;
    for (const fx of [92, 104]) { g.beginPath(); g.moveTo(fx - 2.4, -89); g.lineTo(fx, act ? -78 : -81); g.lineTo(fx + 2.4, -89.5); g.closePath(); g.fill(); g.stroke(); }
    g.strokeStyle = 'rgba(210,240,255,.85)'; g.lineWidth = 1.2;
    for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(98, -94 + k * 3); g.quadraticCurveTo(110, -98 + k * 5, 122, -96 + k * 8); g.stroke(); }
  }
  ART.matatabi = (ctx, t, z) => {
    const C = MAT, act = isAct(z), ph = (z.pulse || 0) * 1.6;
    glow(ctx, 0, -86, 120, 'rgba(70,140,255,1)', act ? .55 : .35);
    const tips = [];
    for (let i = 0; i < 2; i++) {
      const tp = ribbon(spine(-60, -84, -2.45 - i * .45, 128 - i * 10, 1.9 + i * .3, .3, t * 2.1 + i * 1.4, 12, .6), u => 12 * (1 - u * .72));
      tailCel(ctx, tp, { f: i ? C.dark : C.body, s: C.mul, h: C.hi, l: C.line, w: 2.4,
        d: () => { ctx.beginPath(); for (let k = 3; k < 12; k += 3) brush(ctx, tp.L[k], tp.P[k + 1], tp.R[k], 2.6, C.stripe, true); ctx.fillStyle = C.stripe; ctx.fill(); } });
      const [ex, ey] = tp.P[12];
      for (let j = 0; j < 3; j++) tips.push([ex + (j - 1) * 6, ey + 4, 24 + 9 * Math.sin(t * 9 + j * 2 + i), 7.5, Math.sin(t * 6 + j) * 5 - 4]);
    }
    flames(ctx, tips, [C.f2, C.f3]);
    const legs = [[-46, 1, 0], [34, 1, Math.PI], [-36, 0, Math.PI], [44, 0, 0]];
    const drawLeg = ([lx, far, off]) => {
      const s = Math.sin(ph + off) * 7, lift = Math.max(0, Math.cos(ph + off)) * 4, back = lx < 0;
      sprite(ctx, 'matatabi:leg' + (back ? 'B' : 'F') + (far ? 'f' : 'n'), lx, -70 - lift, -s / 64, 0, -36, -16, 60, 92, g => {
        limb(g, [0, 0], [back ? -24 : 6, back ? 44 : 34], [2, 64], back ? 15 : 12, 6, { f: far ? C.dark : C.body, s: C.mul, so: [-4, -4], h: far ? null : C.hi, ho: [2, 2], l: C.line, w: 2.2 });
        cel(g, () => ell(g, 6, 65, 10, 5.5), { f: far ? C.dark : C.body, s: C.mul, so: [-3, -3], l: C.line, w: 2 });
        g.strokeStyle = C.line; g.lineWidth = 1.2; g.beginPath(); g.moveTo(9, 62); g.lineTo(10, 69); g.moveTo(13, 62); g.lineTo(14, 69); g.stroke();
      });
    };
    legs.slice(0, 2).forEach(drawLeg);
    part(ctx, 'matatabi:body', -84, -124, 164, 88, matatabiBody);
    legs.slice(2).forEach(drawLeg);
    part(ctx, 'matatabi:haunch', -74, -104, 146, 70, matatabiHaunch);
    const hb = Math.sin(t * 2.4) * 1.5, back = [];
    for (let i = 0; i < 9; i++) {
      const x = -60 + i * 13, y = -100 + (i > 6 ? -(i - 6) * 5 : 0);
      back.push([x, y + 8, 25 + 11 * Math.sin(t * 10 + i * 1.7), 9, Math.sin(t * 7 + i) * 5 - 10]);
    }
    for (let i = 0; i < 3; i++) back.push([60 + i * 12, -132 + Math.abs(i - 1) * 4 + hb, 16 + 7 * Math.sin(t * 11 + i * 2), 6, -4]);
    flames(ctx, back, [C.f1, C.f2, C.f3]);
    ctx.save(); ctx.translate(0, hb);
    part(ctx, act ? 'matatabi:head1' : 'matatabi:head0', 36, -166, 92, 98, g => matatabiHead(g, act));
    ctx.restore();
  };

  // ===== Sanbi · Isobu: coral-spiked shell, shrimp tails and a single red eye
  const ISO = { line: '#162424', skin: '#9fb3a6', skinD: '#7d9289', belly: '#e0d6b6', shell: '#5f807c', plate: '#3c5a57', spike: '#f1e8d0', mul: '#9da2c2', hi: 'rgba(230,255,246,.5)' };
  function isobuBody(g) {
    const C = ISO;
    cel(g, () => blob(g, [[-70, -40], [-40, -56], [40, -58], [66, -44], [40, -30], [-40, -28]]), { f: C.belly, s: C.mul, so: [-6, -5], l: C.line, w: 2.4,
      d: () => { g.strokeStyle = 'rgba(120,100,70,.5)'; g.lineWidth = 1.6; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-50 + i * 18, -54); g.lineTo(-52 + i * 18, -30); g.stroke(); } } });
    const shell = () => blob(g, [[-76, -48], [-74, -108], [-36, -142], [14, -146], [60, -116], [70, -56], [0, -40]]);
    cel(g, shell, { f: C.shell, s: C.mul, so: [-16, -12], h: C.hi, ho: [4, 4], l: C.line, w: 3,
      d: () => {
        g.strokeStyle = C.plate; g.lineWidth = 3; g.lineJoin = 'round';
        const cells = [[-36, -102, 18], [4, -116, 20], [40, -96, 16], [-6, -78, 17], [-48, -68, 13], [28, -64, 14]];
        for (const [x, y, r] of cells) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * .8); } g.closePath(); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.1)'; for (const [x, y, r] of cells) { ell(g, x - r * .3, y - r * .3, r * .5, r * .3); g.fill(); }
        g.fillStyle = '#4a6a66'; ell(g, 0, -46, 80, 10); g.fill();
      } });
    const spikes = [];
    for (let i = 0; i < 11; i++) { const a = Math.PI + .18 + i * .29; spikes.push([-4 + Math.cos(a) * 68, -84 + Math.sin(a) * 58, a, 20 - Math.abs(i - 5) * 1.2]); }
    for (const [x, y] of [[-30, -120], [6, -132], [36, -112], [-14, -100], [20, -92], [-44, -88]]) spikes.push([x, y, -Math.PI / 2 + x * .006, 14]);
    for (const [x, y, a, len] of spikes) spike(g, x, y, a, len, 6.5);
  }
  function spike(g, x, y, a, len, w) {
    const C = ISO, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    const tip = [x + ca * len, y + sa * len], b0 = [x + nx * w, y + ny * w], b1 = [x - nx * w, y - ny * w];
    const bend = [x + ca * len * .55 + nx * 2, y + sa * len * .55 + ny * 2];
    const build = () => { g.beginPath(); g.moveTo(b0[0], b0[1]); g.quadraticCurveTo(bend[0] + nx * w * .4, bend[1] + ny * w * .4, tip[0], tip[1]); g.quadraticCurveTo(bend[0] - nx * w * .4, bend[1] - ny * w * .4, b1[0], b1[1]); g.closePath(); };
    cel(g, build, { f: C.spike, l: C.line, w: 1.6, d: () => {
      g.fillStyle = 'rgba(150,130,120,.45)';
      if (nx > 0 || ny > 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(tip[0], tip[1]); g.lineTo(b0[0], b0[1]); g.closePath(); } else { g.beginPath(); g.moveTo(x, y); g.lineTo(tip[0], tip[1]); g.lineTo(b1[0], b1[1]); g.closePath(); }
      g.fill();
    } });
  }
  function isobuHead(g, act) {
    const C = ISO;
    cel(g, () => blob(g, [[40, -84], [62, -98], [92, -96], [116, -78], [118, -56], [98, -42], [64, -42], [42, -56]]), {
      f: C.skin, s: C.mul, so: [-9, -7], h: C.hi, ho: [3, 3], l: C.line, w: 2.8,
      d: () => { g.fillStyle = C.belly; blob(g, [[70, -52], [100, -58], [120, -54], [108, -40], [76, -40]]); g.fill(); }
    });
    cel(g, () => blob(g, [[46, -92], [66, -110], [100, -106], [120, -86], [112, -76], [92, -82], [78, -76], [56, -80]]), {
      f: C.shell, s: C.mul, so: [-6, -5], h: C.hi, ho: [3, 3], l: C.line, w: 2.6,
      d: () => { g.strokeStyle = C.plate; g.lineWidth = 2.4; g.beginPath(); g.moveTo(60, -98); g.quadraticCurveTo(84, -92, 110, -96); g.stroke(); }
    });
    for (const [x, y, a] of [[62, -104, -1.9], [80, -106, -1.6], [98, -102, -1.25], [112, -90, -.9]]) spike(g, x, y, a, 12, 4.5);
    glowEye(g, 88, -70, 9);
    eye(g, 88, -70, 9.5, 8.5, { sclera: '#ffe9b8', iris: '#e2301f', irisR: .78, pupil: 'dot', pr: .2, l0: -.85, l1: -.25, line: C.line, look: .1 });
    const jaw = act ? -34 : -46;
    g.beginPath(); g.moveTo(80, -52); g.quadraticCurveTo(100, -54, 120, -60); g.quadraticCurveTo(102, jaw, 80, -52); g.closePath();
    g.fillStyle = '#3a1418'; g.fill(); g.save(); g.clip();
    teethAlong(g, bez([80, -52], [100, -54], [120, -60], 7), 6, 1); teethAlong(g, bez([80, -52], [102, jaw + 6], [120, -60], 6), 5, -1);
    g.restore(); g.strokeStyle = C.line; g.lineWidth = 2; g.stroke();
  }
  function glowEye(g, x, y, r) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    gr.addColorStop(0, 'rgba(255,80,40,.55)'); gr.addColorStop(1, 'rgba(255,40,20,0)');
    g.fillStyle = gr; ell(g, x, y, r * 2.4, r * 2.4); g.fill();
  }
  ART.isobu = (ctx, t, z) => {
    const C = ISO, act = isAct(z), ph = (z.pulse || 0) * 1.4;
    for (let i = 0; i < 3; i++) {
      const tp = ribbon(spine(-62, -60 + i * 4, -2.75 - i * .32 + .3, 118 - i * 8, .9 - i * .2, .2, t * 1.5 + i * 1.1, 12, .5), u => 13 * (1 - u * .62));
      tailCel(ctx, tp, { f: i === 1 ? C.skinD : C.skin, s: C.mul, l: C.line, w: 2.4,
        d: () => { ctx.strokeStyle = 'rgba(30,50,50,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); for (let k = 2; k < 12; k += 2) { ctx.moveTo(tp.L[k][0], tp.L[k][1]); ctx.quadraticCurveTo(tp.P[k + 1][0], tp.P[k + 1][1], tp.R[k][0], tp.R[k][1]); } ctx.stroke(); } });
      const [ex, ey] = tp.P[12], [px, py] = tp.P[10], a = Math.atan2(ey - py, ex - px);
      ctx.beginPath();
      for (const d of [-.6, 0, .6]) { const cx = ex + Math.cos(a + d) * 8, cy = ey + Math.sin(a + d) * 8; ctx.moveTo(cx + Math.cos(a + d) * 10, cy + Math.sin(a + d) * 10); ctx.ellipse(cx, cy, 10, 4.5, a + d, 0, TAU); }
      ctx.fillStyle = C.skinD; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.6; ctx.stroke();
    }
    const legs = [[-46, 1, 0], [30, 1, Math.PI], [-30, 0, Math.PI], [44, 0, 0]];
    const drawLeg = ([lx, far, off]) => {
      const s = Math.sin(ph + off) * 4, lift = Math.max(0, Math.cos(ph + off)) * 3;
      sprite(ctx, far ? 'isobu:legF' : 'isobu:legN', lx, -44 - lift, 0, s / 40, -24, -8, 58, 60, g => {
        cel(g, () => blob(g, [[-16, 0], [16, 0], [18, 38], [-16, 40]]), { f: far ? C.skinD : C.skin, s: C.mul, so: [-5, -5], h: far ? null : C.hi, ho: [2, 2], l: C.line, w: 2.4,
          d: () => { g.strokeStyle = 'rgba(30,50,50,.4)'; g.lineWidth = 1.4; for (const k of [20, 28]) { g.beginPath(); g.moveTo(-12, k); g.lineTo(12, k - 2); g.stroke(); } } });
        claws(g, 12, 38, 3, 5, 7, .35, C.spike, C.line);
      });
    };
    legs.slice(0, 2).forEach(drawLeg);
    part(ctx, 'isobu:body', -96, -170, 186, 142, isobuBody);
    legs.slice(2).forEach(drawLeg);
    const hb = Math.sin(t * 1.6) * 1.5;
    ctx.save(); ctx.translate(6, hb);
    part(ctx, act ? 'isobu:head1' : 'isobu:head0', 34, -122, 92, 92, g => isobuHead(g, act));
    ctx.restore();
  };

  // ===== Yonbi · Son Gokū: horned red ape with a white mane and a lava-filled maw
  const SON = { line: '#2a0806', fur: '#c4382c', furD: '#952218', chest: '#e2674c', mane: '#f4e8cc', face: '#a7bf8a', horn: '#f1e5cc', fist: '#5a2a22', mul: '#b296ac', hi: 'rgba(255,224,200,.5)' };
  function songokuBody(g) {
    const C = SON;
    limb(g, [-40, -136], [-80, -104], [-64, -48], 17, 13, { f: C.furD, s: C.mul, so: [-5, -5], l: C.line, w: 2.6,
      d: () => { g.strokeStyle = C.line; g.lineWidth = 1.2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-74 + k * 2, -100 + k * 10); g.lineTo(-68 + k * 2, -94 + k * 10); g.stroke(); } } });
    cel(g, () => blob(g, [[-78, -50], [-80, -28], [-54, -24], [-50, -46]]), { f: C.fist, s: C.mul, so: [-3, -3], l: C.line, w: 2.4 });
    cel(g, () => blob(g, [[-40, -44], [-58, -92], [-70, -140], [-30, -162], [28, -164], [66, -140], [56, -92], [38, -44], [0, -34]]), {
      f: C.fur, s: C.mul, so: [-16, -12], h: C.hi, ho: [5, 5], l: C.line, w: 3,
      d: () => {
        g.fillStyle = C.chest; blob(g, [[4, -46], [-6, -90], [6, -134], [48, -132], [54, -86], [34, -46]]); g.fill();
        brush(g, [8, -118], [26, -104], [48, -116], 2.8, C.furD); brush(g, [8, -92], [26, -84], [46, -92], 2.4, C.furD);
        brush(g, [10, -72], [26, -66], [42, -72], 2.2, C.furD); brush(g, [26, -124], [24, -88], [28, -52], 2, C.furD);
        g.strokeStyle = C.furD; g.lineWidth = 1.6;
        for (let i = 0; i < 10; i++) { const x = -54 + i * 6; g.beginPath(); g.moveTo(x, -76 + (i % 3) * 9); g.lineTo(x - 4, -64 + (i % 3) * 9); g.stroke(); }
      }
    });
    const ruff = [];
    for (let i = 0; i <= 18; i++) { const a = Math.PI * .78 + i / 18 * Math.PI * 1.46, r = i % 2 ? 50 : 66; ruff.push([18 + Math.cos(a) * r, -136 + Math.sin(a) * r * .55]); }
    ruff.push([56, -110], [40, -96], [26, -106], [12, -94], [-2, -104], [-20, -98], [-34, -108]);
    cel(g, () => poly(g, ruff), { f: C.mane, s: C.mul, so: [-9, -8], h: 'rgba(255,255,255,.8)', ho: [2, 2], l: C.line, w: 2.4,
      d: () => { g.strokeStyle = 'rgba(160,130,100,.55)'; g.lineWidth = 1.4; for (let i = 0; i < 14; i++) { const a = Math.PI * .85 + i * .2; g.beginPath(); g.moveTo(18 + Math.cos(a) * 30, -132 + Math.sin(a) * 16); g.lineTo(18 + Math.cos(a) * 52, -132 + Math.sin(a) * 28); g.stroke(); } } });
  }
  function songokuHead(g, act) {
    const C = SON;
    g.translate(38, -144); g.scale(1.2, 1.2); g.translate(-30, 160);
    for (const [p0, p1, p2] of [[[8, -178], [-26, -184], [-16, -212]], [[46, -184], [72, -190], [62, -214]]]) {
      limb(g, p0, p1, p2, 7, .5, { f: C.horn, s: C.mul, so: [-3, -3], l: C.line, w: 2.2,
        d: () => { g.strokeStyle = 'rgba(150,120,90,.6)'; g.lineWidth = 1.4; const b = bez(p0, p1, p2, 6); for (let k = 1; k < 5; k++) { ell(g, b[k][0], b[k][1], 7 - k, 2.5, .8); g.stroke(); } } });
    }
    cel(g, () => blob(g, [[-4, -154], [-2, -182], [26, -196], [56, -184], [66, -154], [52, -134], [10, -136]]), {
      f: C.fur, s: C.mul, so: [-9, -8], h: C.hi, ho: [3, 3], l: C.line, w: 2.6,
      d: () => {
        g.fillStyle = C.face; blob(g, [[12, -166], [34, -178], [62, -166], [66, -144], [48, -132], [16, -140]]); g.fill();
        g.fillStyle = 'rgba(70,90,50,.35)'; blob(g, [[14, -152], [30, -156], [44, -150], [36, -140], [18, -142]]); g.fill();
        g.fillStyle = C.mane; for (let i = 0; i < 5; i++) { poly(g, [[-2 + i * 6, -190 + i * 1.5], [-10 + i * 6, -204 + i * 2], [4 + i * 6, -192 + i * 1.5]]); g.fill(); }
      }
    });
    g.fillStyle = '#3a1410'; poly(g, [[18, -172], [36, -168], [32, -164], [18, -167]]); g.fill(); poly(g, [[42, -168], [58, -174], [56, -168], [44, -165]]); g.fill();
    eye(g, 28, -160, 6.5, 5.5, { sclera: '#ffe27a', pupil: 'dot', pr: .3, l0: -1.2, l1: -.3, line: C.line, lidW: 2.6 });
    eye(g, 50, -161, 5.5, 5, { sclera: '#ffe27a', pupil: 'dot', pr: .3, l0: -.3, l1: -1.2, line: C.line, lidW: 2.4 });
    g.fillStyle = '#2a1410'; ell(g, 56, -150, 2, 1.6); g.fill(); ell(g, 62, -151, 2, 1.6); g.fill();
    const jaw = act ? -112 : -130;
    g.beginPath(); g.moveTo(22, -144); g.quadraticCurveTo(44, -140, 66, -146); g.quadraticCurveTo(44, jaw, 22, -144); g.closePath();
    g.fillStyle = act ? '#ff6a14' : '#4a0e0a'; g.fill();
    if (act) { g.save(); g.clip(); g.fillStyle = '#ffd23a'; ell(g, 44, -132, 12, 5); g.fill(); g.restore(); }
    g.strokeStyle = C.line; g.lineWidth = 2; g.stroke();
    const jy = act ? -126 : -136;
    for (const tx of [30, 58]) cel(g, () => poly(g, [[tx - 3.2, jy + 3], [tx, jy - 10], [tx + 3.2, jy + 3]]), { f: C.horn, l: C.line, w: 1.2 });
  }
  ART.songoku = (ctx, t, z) => {
    const C = SON, act = isAct(z), ph = (z.pulse || 0) * 1.5, step = Math.sin(ph);
    for (let i = 0; i < 4; i++) {
      const tp = ribbon(spine(-36, -88 + i * 5, -2.25 - i * .32, 138 - i * 6, 1.3, .28, t * 1.8 + i * .9, 12, 1.1), u => 11.5 * (1 - u * .7));
      tailCel(ctx, tp, { f: i % 2 ? C.furD : C.fur, s: C.mul, l: C.line, w: 2.4,
        d: () => { ctx.strokeStyle = C.furD; ctx.lineWidth = 1.2; ctx.beginPath(); for (let k = 3; k < 11; k += 3) { ctx.moveTo(tp.P[k][0], tp.P[k][1]); ctx.lineTo(tp.R[k + 1][0], tp.R[k + 1][1]); } ctx.stroke(); } });
    }
    for (const [lx, far] of [[-26, 1], [24, 0]]) {
      const s = (far ? -step : step) * 4, lift = Math.max(0, far ? -step : step) * 3;
      sprite(ctx, far ? 'songoku:legF' : 'songoku:legN', lx, -68 - lift, 0, s / 66, -28, -8, 68, 82, g => {
        cel(g, () => blob(g, [[-22, 0], [20, -2], [22, 42], [10, 54], [-18, 54]]), { f: far ? C.furD : C.fur, s: C.mul, so: [-6, -6], h: far ? null : C.hi, ho: [3, 3], l: C.line, w: 2.6 });
        cel(g, () => blob(g, [[-14, 50], [24, 52], [32, 66], [-16, 66]]), { f: C.fist, s: C.mul, so: [-3, -3], l: C.line, w: 2.2 });
      });
    }
    const breath = Math.sin(t * 1.9) * .012;
    ctx.save(); ctx.scale(1, 1 + breath);
    part(ctx, 'songoku:body', -96, -176, 172, 156, songokuBody);
    ctx.restore();
    const fx = act ? 92 : 64, fy = act ? -146 : -40;
    part(ctx, act ? 'songoku:arm1' : 'songoku:arm0', 20, -168, 98, 150, g => {
      limb(g, [42, -124], [act ? 74 : 80, act ? -110 : -96], [fx - (act ? 6 : 0), fy + (act ? 12 : -8)], 18, 13, { f: C.fur, s: C.mul, so: [-6, -6], h: C.hi, ho: [3, 3], l: C.line, w: 2.8,
        d: () => { g.strokeStyle = C.furD; g.lineWidth = 1.4; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(60 + k * 3, -110 + k * 12); g.lineTo(56 + k * 3, -102 + k * 12); g.stroke(); } } });
      cel(g, () => blob(g, [[fx - 15, fy - 13], [fx + 13, fy - 15], [fx + 19, fy + 6], [fx + 4, fy + 15], [fx - 15, fy + 11]]), { f: C.fist, s: C.mul, so: [-4, -4], h: 'rgba(255,200,180,.4)', ho: [2, 2], l: C.line, w: 2.4,
        d: () => { g.strokeStyle = '#2a120e'; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(fx + 4 + k * 4, fy - 11); g.lineTo(fx + 4 + k * 4, fy + 9); g.stroke(); } } });
    });
    if (act) glow(ctx, fx, fy, 32, 'rgba(255,110,30,1)', .55);
    ctx.save(); ctx.scale(1, 1 + breath); ctx.translate(0, -breath * 160);
    part(ctx, act ? 'songoku:head1' : 'songoku:head0', -44, -230, 146, 136, g => songokuHead(g, act));
    ctx.restore();
    if (act) {
      glow(ctx, 55, -112, 30, 'rgba(255,120,30,1)', .85);
      for (let i = 0; i < 4; i++) { const k = (t * 1.4 + i / 4) % 1; ctx.fillStyle = k < .5 ? '#ffd23a' : '#ff6a14'; ell(ctx, 46 + i * 6, -108 + k * 46, 3.4 - k * 1.6, 5 - k * 2); ctx.fill(); }
    }
  };

  // ===== Gobi · Kokuō: white horse-dolphin with red markings and three horns
  const KOK = { line: '#2a2228', white: '#f3f4f0', grey: '#d9dce0', red: '#cc2f3a', hoof: '#3c3236', horn: '#f7f1df', mul: '#b4bad6', hi: 'rgba(255,255,255,.9)' };
  function kokuoBody(g) {
    const C = KOK;
    cel(g, () => blob(g, [[-72, -86], [-64, -122], [-16, -126], [36, -124], [62, -104], [58, -74], [12, -68], [-52, -70]]), {
      f: C.white, s: C.mul, so: [-14, -11], h: C.hi, ho: [3, 3], l: C.line, w: 2.8,
      d: () => {
        g.fillStyle = C.red;
        brush(g, [-50, -114], [-30, -122], [-6, -116], 6, C.red); brush(g, [-62, -98], [-56, -84], [-40, -78], 4.5, C.red);
        brush(g, [24, -116], [40, -106], [44, -88], 5, C.red); brush(g, [-20, -100], [-4, -94], [12, -100], 3, C.red);
      }
    });
    cel(g, () => blob(g, [[30, -114], [52, -138], [76, -158], [96, -142], [72, -112], [60, -84], [36, -90]]), {
      f: C.white, s: C.mul, so: [-9, -8], h: C.hi, ho: [3, 3], l: C.line, w: 2.6,
      d: () => { brush(g, [56, -142], [70, -132], [72, -112], 4, C.red); }
    });
  }
  function kokuoHead(g, act) {
    const C = KOK;
    const horn = (p0, p1, p2, w) => limb(g, p0, p1, p2, w, .4, { f: C.horn, s: C.mul, so: [-3, -3], l: C.line, w: 2,
      d: () => { g.strokeStyle = 'rgba(170,150,120,.6)'; g.lineWidth = 1.2; const b = bez(p0, p1, p2, 6); for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(b[k][0] - w, b[k][1] + 1); g.lineTo(b[k][0] + w, b[k][1] - 1); g.stroke(); } } });
    horn([70, -168], [52, -176], [44, -194], 5);
    horn([88, -174], [84, -190], [92, -204], 5);
    cel(g, () => blob(g, [[62, -152], [66, -176], [92, -182], [110, -166], [132, -154], [142, -144], [130, -136], [100, -134], [74, -136]]), {
      f: C.white, s: C.mul, so: [-8, -7], h: C.hi, ho: [3, 3], l: C.line, w: 2.6,
      d: () => {
        g.fillStyle = C.red;
        blob(g, [[78, -164], [92, -168], [110, -160], [104, -152], [90, -154], [80, -154]]); g.fill();
        brush(g, [108, -160], [124, -154], [138, -148], 2.6, C.red);
        brush(g, [70, -148], [80, -140], [92, -140], 3, C.red);
        g.fillStyle = C.grey; blob(g, [[100, -140], [124, -144], [140, -142], [128, -134], [104, -134]]); g.fill();
      }
    });
    horn([100, -170], [116, -182], [128, -202], 6);
    eye(g, 95, -156, 5.5, 4.8, { sclera: '#ffffff', iris: '#9a1a28', irisR: .7, pupil: 'dot', pr: .26, l0: -1.2, l1: -.5, line: C.line, lidW: 2.2 });
    g.strokeStyle = C.line; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(108, -141); g.quadraticCurveTo(124, act ? -134 : -140, 140, -143); g.stroke();
    if (act) { g.beginPath(); g.moveTo(108, -141); g.quadraticCurveTo(124, -128, 138, -138); g.fillStyle = '#5a1a24'; g.fill(); g.stroke(); }
    g.fillStyle = C.line; ell(g, 136, -149, 1.6, 1.2); g.fill();
  }
  ART.kokuo = (ctx, t, z) => {
    const C = KOK, act = isAct(z), dash = z.beastDashTimer > 0, ph = (z.pulse || 0) * (dash ? 3.2 : 1.8);
    if (dash) ctx.rotate(.07);
    for (let i = 0; i < 5; i++) {
      const tp = ribbon(spine(-62, -104 + i * 3, -2.4 - i * .22 + .2, 132 - Math.abs(i - 2) * 8, .9 + i * .1, .3, t * 1.7 + i * .9, 12, .5), u => 12 * (1 + .25 * Math.sin(u * 3.1)) * (1 - u * .75));
      tailCel(ctx, tp, { f: i % 2 ? C.grey : C.white, s: C.mul, l: C.line, w: 2.2,
        d: () => { ctx.strokeStyle = 'rgba(150,160,190,.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tp.P[2][0], tp.P[2][1]); for (let k = 3; k < 12; k++) ctx.lineTo(tp.P[k][0], tp.P[k][1]); ctx.stroke(); } });
    }
    const legs = [[-46, 1, 0], [34, 1, Math.PI], [-34, 0, Math.PI], [46, 0, 0]];
    const drawLeg = ([lx, far, off]) => {
      const s = Math.sin(ph + off) * 9, lift = Math.max(0, Math.cos(ph + off)) * 6, back = lx < 0;
      sprite(ctx, 'kokuo:leg' + (back ? 'B' : 'F') + (far ? 'f' : 'n'), lx, -88 - lift, -s / 80, 0, -24, -16, 48, 110, g => {
        limb(g, [0, 0], [back ? -10 : 6, 44], [0, 78], back ? 14 : 12, 5.5, { f: far ? C.grey : C.white, s: C.mul, so: [-4, -4], h: far ? null : C.hi, ho: [2, 2], l: C.line, w: 2.2,
          d: () => { g.fillStyle = C.red; g.fillRect(-16, 38, 32, 6); } });
        cel(g, () => poly(g, [[-6, 76], [7, 76], [9, 88], [-8, 88]]), { f: C.hoof, l: C.line, w: 1.8 });
      });
    };
    legs.slice(0, 2).forEach(drawLeg);
    part(ctx, 'kokuo:body', -86, -186, 192, 128, kokuoBody);
    legs.slice(2).forEach(drawLeg);
    const nod = 12 + Math.sin(t * 2) * 1.6;
    ctx.save(); ctx.translate(0, nod);
    part(ctx, act ? 'kokuo:head1' : 'kokuo:head0', 44, -224, 108, 98, g => kokuoHead(g, act));
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const k = (t * .7 + i / 5) % 1;
      ctx.fillStyle = 'rgba(255,255,255,' + ((1 - k) * .5).toFixed(3) + ')';
      ell(ctx, -30 + i * 14 + Math.sin(t + i) * 5, -126 - k * 56, 6 + k * 12, 5 + k * 9); ctx.fill();
    }
  };

  // ===== Rokubi · Saiken: glossy white-blue slug with yellow spots, acid and bubbles
  const SAI = { line: '#1d3a4c', body: '#e3f0f6', blue: '#b9d8ea', spot: '#f4cf48', spotRim: '#e09a2a', lips: '#f0a24e', mul: '#a8b4dc', hi: 'rgba(255,255,255,.9)' };
  function saikenBody(g) {
    const C = SAI;
    cel(g, () => blob(g, [[-80, -4], [-86, -40], [-46, -66], [-4, -120], [38, -154], [78, -132], [76, -80], [60, -26], [40, -2]]), {
      f: C.body, s: C.mul, so: [-16, -12], h: C.hi, ho: [3, 3], l: C.line, w: 3,
      d: () => {
        g.fillStyle = C.blue; blob(g, [[-90, 0], [-84, -18], [-30, -24], [30, -20], [70, -20], [64, 2]]); g.fill();
        g.strokeStyle = 'rgba(29,58,76,.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-84, -16);
        for (let i = 0; i <= 10; i++) g.quadraticCurveTo(-78 + i * 15 - 7, -24, -78 + i * 15, -18); g.stroke();
        for (const [x, y, r] of [[-56, -36, 7], [-30, -54, 9], [-8, -84, 8], [16, -112, 7], [-14, -38, 5], [16, -60, 7], [40, -88, 6], [52, -124, 5], [34, -36, 5], [-44, -18, 4]]) {
          g.fillStyle = C.spotRim; ell(g, x, y, r + 1.6, (r + 1.6) * .82); g.fill();
          g.fillStyle = C.spot; ell(g, x - .6, y - .6, r, r * .8); g.fill();
        }
      },
      d2: () => {
        g.fillStyle = 'rgba(255,255,255,.75)'; ell(g, 18, -136, 20, 6, -.6); g.fill(); ell(g, -40, -60, 12, 4, -.5); g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)'; ell(g, 2, -118, 4, 2.4, -.6); g.fill();
      }
    });
    for (const [ax, ay, far] of [[62, -88, 1], [58, -60, 1], [70, -76, 0], [64, -46, 0]]) {
      cel(g, () => blob(g, [[ax - 6, ay - 7], [ax + 12, ay - 9], [ax + 22, ay], [ax + 24, ay + 10], [ax + 14, ay + 12], [ax + 6, ay + 4], [ax - 6, ay + 6]]),
        { f: far ? C.blue : C.body, s: C.mul, so: [-3, -3], h: far ? null : C.hi, ho: [1.5, 1.5], l: C.line, w: 2 });
      g.strokeStyle = C.line; g.lineWidth = 1.3; g.beginPath();
      for (const k of [0, 1, 2]) { g.moveTo(ax + 14 + k * 3.5, ay + 6 - k * 1.5); g.lineTo(ax + 16 + k * 3.5, ay + 10 - k * 1.5); }
      g.stroke();
    }
  }
  function saikenHead(g, act) {
    const C = SAI;
    eye(g, 50, -124, 5, 6.5, { sclera: '#16283a', iris: '#f7d23a', irisR: .7, pupil: 'dot', pr: .28, l0: -1.2, l1: -.5, line: C.line, lidW: 2.2 });
    eye(g, 66, -122, 4, 5.5, { sclera: '#16283a', iris: '#f7d23a', irisR: .7, pupil: 'dot', pr: .28, l0: -.5, l1: -1.2, line: C.line, lidW: 2 });
    const o = act ? 10 : 4;
    cel(g, () => blob(g, [[52, -108], [66, -112], [84, -106], [86, -98 + o * .5], [70, -94 + o], [54, -98]]), { f: C.lips, s: '#d8a8b8', so: [-3, -3], h: 'rgba(255,240,220,.8)', ho: [1.5, 1.5], l: C.line, w: 2,
      d: () => { g.fillStyle = '#6a1a2a'; ell(g, 70, -103 + o * .4, 9, 1.4 + o * .35); g.fill(); } });
  }
  ART.saiken = (ctx, t, z) => {
    const C = SAI, act = isAct(z);
    for (let i = 0; i < 6; i++) {
      const tp = ribbon(spine(-68, -26 - i * 6, -2.0 - i * .34, 108 - Math.abs(i - 2.5) * 8, .7 - i * .08, .36, t * 1.5 + i * .8, 12, 1.1), u => 9.5 * (1 - u * .78));
      tailCel(ctx, tp, { f: i % 2 ? C.blue : C.body, s: C.mul, l: C.line, w: 2,
        d: () => { ctx.beginPath(); for (const k of [4, 8]) { ctx.moveTo(tp.P[k][0] + 2.6, tp.P[k][1]); ctx.ellipse(tp.P[k][0], tp.P[k][1], 2.6, 2.2, 0, 0, TAU); } ctx.fillStyle = C.spot; ctx.fill(); } });
    }
    const sq = Math.sin(t * 2.2) * .03;
    ctx.save(); ctx.scale(1 + sq * .6, 1 - sq);
    part(ctx, 'saiken:body', -102, -172, 196, 178, saikenBody);
    part(ctx, act ? 'saiken:head1' : 'saiken:head0', 40, -136, 52, 50, g => saikenHead(g, act));
    ctx.restore();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const k = (t * .8 + i * .27) % 1, x = 66 + i * 4, y = -96 + k * 26, r = (1 - k * .6) * 2.6;
      ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * 1.3 + k * 2, 0, 0, TAU);
    }
    ctx.fillStyle = 'rgba(150,240,110,.8)'; ctx.fill();
    const bub = [];
    for (let i = 0; i < 6; i++) {
      const k = (t * .35 + i / 6) % 1;
      bub.push([-60 + i * 22 + Math.sin(t * 2 + i * 2) * 6, -60 - k * 120, (4 + (i % 3) * 2.5 + k * 3) * Math.min(1, (1 - k) * 4)]);
    }
    ctx.beginPath(); for (const [x, y, r] of bub) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fillStyle = 'rgba(200,240,255,.22)'; ctx.fill(); ctx.strokeStyle = 'rgba(230,250,255,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); for (const [x, y, r] of bub) { ctx.moveTo(x - r * .1, y - r * .35); ctx.ellipse(x - r * .35, y - r * .35, r * .25, r * .2, 0, 0, TAU); }
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
  };

  // ===== Nanabi · Chōmei: hovering rhino beetle with six amber wings and a stinger tail
  const CHO = { line: '#0b2630', shell: '#2f9fb2', dark: '#1d6a7c', belly: '#a6e6dc', mul: '#8f98cc', hi: 'rgba(220,255,250,.65)', eye: '#ff8a1e' };
  function chomeiWing(g) {
    const build = () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(20, -14, 70, -16, 96, -4); g.bezierCurveTo(78, 8, 30, 12, 0, 0); g.closePath(); };
    build(); const gr = g.createLinearGradient(0, 0, 96, 0);
    gr.addColorStop(0, 'rgba(255,150,40,.75)'); gr.addColorStop(.6, 'rgba(255,196,90,.5)'); gr.addColorStop(1, 'rgba(255,230,160,.35)');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(255,236,190,.8)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(50, -8, 94, -4); g.stroke();
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(k * 18, -k * 1.4); g.lineTo(k * 18 + 12, -10 + k * .4); g.moveTo(k * 18, -k * 1.4); g.lineTo(k * 18 + 10, 6); g.stroke(); }
    build(); g.strokeStyle = 'rgba(130,60,10,.85)'; g.lineWidth = 1.6; g.stroke();
  }
  function chomeiBody(g) {
    const C = CHO;
    cel(g, () => blob(g, [[-82, -98], [-66, -122], [-24, -124], [2, -108], [-10, -84], [-50, -76], [-76, -84]]), {
      f: C.shell, s: C.mul, so: [-10, -8], h: C.hi, ho: [3, 3], l: C.line, w: 2.8,
      d: () => { g.strokeStyle = C.dark; g.lineWidth = 2.6; for (let k = 0; k < 4; k++) { const x = -66 + k * 16; g.beginPath(); g.moveTo(x, -124); g.quadraticCurveTo(x - 6, -100, x, -76); g.stroke(); }
        g.fillStyle = C.belly; blob(g, [[-70, -84], [-40, -86], [-6, -92], [-14, -76], [-56, -74]]); g.fill(); }
    });
    cel(g, () => blob(g, [[-10, -104], [0, -132], [30, -136], [46, -116], [36, -92], [8, -88]]), {
      f: C.shell, s: C.mul, so: [-8, -7], h: C.hi, ho: [3, 3], l: C.line, w: 2.8,
      d: () => { g.strokeStyle = C.dark; g.lineWidth = 2.2; g.beginPath(); g.moveTo(4, -130); g.quadraticCurveTo(22, -112, 18, -90); g.stroke(); }
    });
    limb(g, [44, -126], [64, -148], [58, -186], 8, 2.5, { f: C.dark, s: C.mul, so: [-3, -3], h: C.hi, ho: [2, 2], l: C.line, w: 2.2 });
    limb(g, [58, -178], [66, -182], [70, -192], 3, 1, { f: C.dark, l: C.line, w: 1.8 });
    cel(g, () => blob(g, [[34, -112], [44, -132], [66, -128], [74, -110], [64, -94], [42, -94]]), {
      f: C.shell, s: C.mul, so: [-6, -5], h: C.hi, ho: [2, 2], l: C.line, w: 2.6
    });
    eye(g, 58, -114, 9, 10, { sclera: C.eye, iris: '#ffc04a', irisR: .5, pupil: 'dot', pr: .18, pupilColor: '#5a1a00', l0: -1.2, l1: -.6, line: C.line, look: .25, lidW: 2.4 });
    g.fillStyle = 'rgba(120,40,0,.35)'; for (let k = 0; k < 5; k++) { ell(g, 54 + (k % 3) * 4, -118 + Math.floor(k / 3) * 8, 1.2, 1.2); g.fill(); }
    g.strokeStyle = C.line; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(70, -98); g.quadraticCurveTo(80, -96, 82, -88); g.moveTo(66, -96); g.quadraticCurveTo(72, -88, 70, -82); g.stroke();
  }
  ART.chomei = (ctx, t, z) => {
    const C = CHO, act = isAct(z), dive = z.beastDashTimer > 0;
    const bob = Math.sin(t * 3) * 6 - (dive ? 0 : 6);
    ctx.save(); ctx.translate(0, bob); if (dive) ctx.rotate(.2);
    const flapSpd = act || dive ? 34 : 24, ga = ctx.globalAlpha;
    const wing = (k, far) => {
      const flap = Math.sin(t * flapSpd + k * .5) * .32;
      ctx.globalAlpha = far ? ga * .75 : ga;
      sprite(ctx, 'chomei:wing', 4, -122, -3.2 + k * .62 + (far ? .32 : 0) + flap, 0, -2, -18, 100, 32, g => { g.scale(.9, .9); chomeiWing(g); });
    };
    for (let k = 0; k < 3; k++) wing(k, true);
    ctx.globalAlpha = ga;
    const tp = ribbon(spine(-78, -96, Math.PI + .3, 64, -.9, .3, t * 2.2, 8), u => 9 * (1 - u * .7));
    tailCel(ctx, tp, { f: C.dark, s: C.mul, h: C.hi, l: C.line, w: 2.2,
      d: () => { ctx.strokeStyle = C.shell; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 2; k < 8; k += 2) { ctx.moveTo(tp.L[k][0], tp.L[k][1]); ctx.lineTo(tp.R[k][0], tp.R[k][1]); } ctx.stroke(); } });
    const [ex, ey] = tp.P[8], [px, py] = tp.P[7], a = Math.atan2(ey - py, ex - px);
    poly(ctx, [[ex + Math.cos(a + 1.6) * 4, ey + Math.sin(a + 1.6) * 4], [ex + Math.cos(a) * 16, ey + Math.sin(a) * 16], [ex + Math.cos(a - 1.6) * 4, ey + Math.sin(a - 1.6) * 4]]);
    ctx.fillStyle = '#ffcf6a'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = C.line; ctx.lineWidth = 3.2; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const lx = -20 + i * 18, sw = Math.sin(t * 4 + i) * 3; ctx.moveTo(lx, -88); ctx.lineTo(lx + 8 + sw, -66); ctx.lineTo(lx + 2 + sw, -46); }
    ctx.stroke();
    part(ctx, 'chomei:body', -96, -200, 186, 128, chomeiBody);
    ctx.strokeStyle = C.line; ctx.lineWidth = 4.4; ctx.beginPath();
    const near = [];
    for (let i = 0; i < 3; i++) { const lx = -14 + i * 18, sw = Math.sin(t * 4 + i + 1) * 3; near.push([lx, sw]); ctx.moveTo(lx, -86); ctx.lineTo(lx + 10 + sw, -62); ctx.lineTo(lx + 4 + sw, -40); }
    ctx.stroke(); ctx.strokeStyle = C.dark; ctx.lineWidth = 2.4; ctx.stroke();
    for (let k = 0; k < 3; k++) wing(k, false);
    ctx.globalAlpha = ga;
    ctx.restore();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const k = (t * .6 + i / 10) % 1, x = -70 + i * 15 + Math.sin(t * 2 + i) * 6, y = -70 + k * 60 + bob, s = 3.2 * (1 - k);
      ctx.moveTo(x, y - s); ctx.lineTo(x + s * .45, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * .45, y); ctx.closePath();
    }
    ctx.fillStyle = 'rgba(255,232,150,.85)'; ctx.fill();
  };

  // ===== Hachibi · Gyūki: ox-headed, muscular, standing on eight octopus tentacles
  const GYU = { line: '#1c1220', skin: '#735e78', skinD: '#544159', chest: '#b79eae', horn: '#efe6d0', ring: '#b9aa8a', sucker: '#e0c4cc', mul: '#a596b6', hi: 'rgba(240,226,255,.55)' };
  function gyukiBody(g) {
    const C = GYU;
    limb(g, [-30, -160], [-70, -130], [-62, -84], 16, 12, { f: C.skinD, s: C.mul, so: [-5, -5], l: C.line, w: 2.6 });
    cel(g, () => blob(g, [[-76, -88], [-62, -72], [-48, -84], [-56, -98]]), { f: C.skinD, s: C.mul, so: [-3, -3], l: C.line, w: 2.4 });
    cel(g, () => blob(g, [[-40, -52], [-52, -110], [-44, -164], [0, -180], [48, -166], [56, -112], [38, -54], [0, -44]]), {
      f: C.skin, s: C.mul, so: [-16, -12], h: C.hi, ho: [5, 5], l: C.line, w: 3,
      d: () => {
        g.fillStyle = C.chest;
        blob(g, [[-6, -150], [16, -164], [48, -150], [50, -126], [22, -120], [-2, -126]]); g.fill();
        blob(g, [[0, -116], [24, -118], [46, -112], [42, -64], [20, -56], [0, -66]]); g.fill();
        g.strokeStyle = C.skinD; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(22, -160); g.quadraticCurveTo(20, -140, 22, -122); g.stroke();
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(4, -104 + i * 15); g.quadraticCurveTo(22, -100 + i * 15, 42, -104 + i * 15); g.stroke(); }
        g.beginPath(); g.moveTo(22, -116); g.lineTo(22, -60); g.stroke();
        brush(g, [-36, -150], [-46, -120], [-40, -90], 3, C.skinD);
      }
    });
  }
  function gyukiHead(g, act) {
    const C = GYU;
    for (const [p0, p1, p2] of [[[8, -204], [-34, -206], [-34, -240]], [[46, -206], [90, -206], [84, -242]]]) {
      limb(g, p0, p1, p2, 10, 1, { f: C.horn, s: C.mul, so: [-4, -4], h: 'rgba(255,255,255,.7)', ho: [2, 2], l: C.line, w: 2.4,
        d: () => { g.strokeStyle = C.ring; g.lineWidth = 2.2; const b = bez(p0, p1, p2, 8); for (let k = 1; k < 7; k++) { const [x0, y0] = b[k - 1], [x1, y1] = b[k], a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2; g.beginPath(); g.moveTo(x1 + Math.cos(a) * 12, y1 + Math.sin(a) * 12); g.lineTo(x1 - Math.cos(a) * 12, y1 - Math.sin(a) * 12); g.stroke(); } } });
    }
    cel(g, () => blob(g, [[-4, -186], [4, -216], [32, -224], [60, -210], [64, -180], [56, -160], [22, -156], [0, -166]]), {
      f: C.skin, s: C.mul, so: [-9, -8], h: C.hi, ho: [3, 3], l: C.line, w: 2.8,
      d: () => {
        g.fillStyle = C.chest; blob(g, [[28, -182], [52, -186], [70, -174], [66, -158], [40, -154], [26, -164]]); g.fill();
        g.fillStyle = C.skinD; blob(g, [[6, -214], [30, -222], [56, -212], [40, -206], [20, -206]]); g.fill();
        brush(g, [14, -186], [20, -178], [16, -168], 2.4, '#2a1a30'); brush(g, [46, -188], [44, -180], [48, -172], 2.2, '#2a1a30');
      }
    });
    eye(g, 22, -196, 7, 5, { sclera: '#fff2b8', pupil: 'dot', pr: .3, l0: -1.2, l1: -.2, line: C.line, rot: .1, lidW: 3 });
    eye(g, 48, -197, 6, 4.5, { sclera: '#fff2b8', pupil: 'dot', pr: .3, l0: -.2, l1: -1.2, line: C.line, rot: -.1, lidW: 2.8 });
    g.fillStyle = C.line; ell(g, 56, -172, 2.6, 2); g.fill(); ell(g, 66, -172, 2.6, 2); g.fill();
    const jaw = act ? -142 : -156;
    g.beginPath(); g.moveTo(30, -162); g.quadraticCurveTo(50, -160, 68, -164); g.quadraticCurveTo(50, jaw, 30, -162); g.closePath();
    g.fillStyle = '#3a0e14'; g.fill();
    if (act) { g.save(); g.clip(); teethAlong(g, bez([30, -162], [50, -160], [68, -164], 7), 5, 1); g.restore(); }
    g.strokeStyle = C.line; g.lineWidth = 2; g.stroke();
  }
  ART.gyuki = (ctx, t, z) => {
    const C = GYU, act = isAct(z);
    const tent = (x, y, ang, len, curl, tc, ph, w, fill) => {
      const tp = ribbon(spine(x, y, ang, len, curl, .22, ph, 12, tc), u => w * (1 - u * .82));
      tailCel(ctx, tp, { f: fill, s: C.mul, l: C.line, w: 2.4,
        d: () => { ctx.beginPath(); for (let k = 2; k < 11; k += 2) { const a = tp.R[k], b = tp.P[k], x = (a[0] * 2 + b[0]) / 3, y = (a[1] * 2 + b[1]) / 3, r = 2.8 - k * .15; ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * .8, 0, 0, TAU); } ctx.fillStyle = C.sucker; ctx.fill(); } });
    };
    for (let i = 0; i < 4; i++) tent(-26, -74 + i * 6, -2.0 - i * .32, 150 - i * 8, .5 + i * .15, 2.2, t * 1.8 + i * .9, 14, i % 2 ? C.skinD : C.skin);
    tent(-20, -40, 2.7, 86, -.5, -2.2, t * 2 + 1, 15, C.skinD);
    tent(10, -42, .6, 84, .3, -2.4, t * 2 + 2, 15, C.skinD);
    const breath = Math.sin(t * 1.8) * .012;
    ctx.save(); ctx.scale(1, 1 + breath);
    part(ctx, 'gyuki:body', -84, -192, 150, 150, gyukiBody);
    ctx.restore();
    tent(-8, -40, 2.2, 78, -.6, -2.0, t * 2 + 3, 16, C.skin);
    tent(20, -40, 1.0, 80, .2, -2.2, t * 2 + 4, 16, C.skin);
    part(ctx, act ? 'gyuki:arm1' : 'gyuki:arm0', 14, -194, 112, 140, g => {
      const fx = act ? 96 : 62, fy = act ? -168 : -74;
      limb(g, [36, -146], [act ? 86 : 78, act ? -140 : -124], [fx - (act ? 6 : 0), fy + (act ? 12 : -10)], 18, 13, { f: C.skin, s: C.mul, so: [-6, -6], h: C.hi, ho: [3, 3], l: C.line, w: 2.8,
        d: () => { g.strokeStyle = C.skinD; g.lineWidth = 1.8; g.beginPath(); g.moveTo(52, -140); g.quadraticCurveTo(64, -128, 66, -114); g.stroke(); } });
      cel(g, () => blob(g, [[fx - 15, fy - 12], [fx + 12, fy - 14], [fx + 19, fy + 6], [fx + 4, fy + 15], [fx - 15, fy + 10]]), { f: C.skinD, s: C.mul, so: [-4, -4], h: C.hi, ho: [2, 2], l: C.line, w: 2.4,
        d: () => { g.strokeStyle = C.line; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(fx + 4 + k * 4, fy - 10); g.lineTo(fx + 4 + k * 4, fy + 8); g.stroke(); } } });
    });
    ctx.save(); ctx.scale(1, 1 + breath); ctx.translate(0, 24 - breath * 190);
    part(ctx, act ? 'gyuki:head1' : 'gyuki:head0', -50, -254, 154, 106, g => gyukiHead(g, act));
    ctx.restore();
  };

  // ---------------------------------------------------------------- jutsu VFX
  // Glows, puffs and flame tongues are cached sprites stamped with drawImage (VFXKit); the only
  // live paths are telegraph shapes, crescents, beams and a few tentacles.
  const KIT = () => window.VFXKit;
  const PAL = {
    sand:   { rgb: '236,200,130', hot: '255,240,200', puff: 'sand',   scorch: '96,70,36',  debris: '#7a5a30', wk: 'earth',     tele: '255,196,96' },
    wind:   { rgb: '205,228,255', hot: '255,255,255', puff: 'wind',   scorch: '110,100,84', debris: '#8a7a60', wk: 'shockwave', tele: '130,200,255' },
    blue:   { rgb: '60,130,255',  hot: '210,240,255', puff: 'blue',   scorch: '14,22,70',  debris: '#1c2a5a', wk: 'fire',      tele: '90,165,255' },
    water:  { rgb: '70,170,255',  hot: '230,250,255', puff: 'water',  scorch: '26,64,104', debris: '#2a5a7a', wk: 'vortex',    tele: '90,200,255' },
    coral:  { rgb: '255,226,196', hot: '255,250,235', puff: 'dust',   scorch: '70,62,54',  debris: '#6a5a4a', wk: 'earth',     tele: '255,140,120' },
    lava:   { rgb: '255,100,30',  hot: '255,220,140', puff: 'fire',   scorch: '40,12,6',   debris: '#3a2218', wk: 'fire',      tele: '255,110,40' },
    steam:  { rgb: '255,150,120', hot: '255,236,220', puff: 'steamW', scorch: '100,100,110', debris: '#7a7a80', wk: 'shockwave', tele: '255,120,110' },
    acid:   { rgb: '140,240,80',  hot: '235,255,200', puff: 'acid',   scorch: '46,96,14',  debris: '#3a6a1a', wk: 'fire',      tele: '165,250,90' },
    bomb:   { rgb: '255,160,70',  hot: '255,245,210', puff: 'fire',   scorch: '60,30,10',  debris: '#4a3020', wk: 'crater',    tele: '255,150,70' },
    powder: { rgb: '255,196,80',  hot: '255,250,215', puff: 'powder', scorch: '120,80,20', debris: '#7a5a20', wk: 'fire',      tele: '255,205,90' },
    ink:    { rgb: '150,90,210',  hot: '230,205,255', puff: 'ink',    scorch: '12,6,18',   debris: '#120818', wk: 'crater',    tele: '180,120,240' },
    bijuu:  { rgb: '190,110,255', hot: '255,235,255', puff: 'violet', scorch: '28,8,38',   debris: '#2a1830', wk: 'crater',    tele: '205,120,255' }
  };
  const CUSTOM_PUFF = {
    sand: [[0, '#f8e7bc'], [.42, '#e0bd7d'], [.72, '#bf9752'], [.9, 'rgba(150,112,58,.6)'], [1, 'rgba(150,112,58,0)']],
    blue: [[0, '#f2fbff'], [.2, '#a6d6ff'], [.45, '#3f8cff'], [.7, '#1d4fd8'], [.88, 'rgba(14,28,140,.7)'], [1, 'rgba(10,20,120,0)']],
    steamW: [[0, 'rgba(255,255,255,.95)'], [.35, 'rgba(236,238,244,.9)'], [.65, 'rgba(196,200,214,.75)'], [.86, 'rgba(160,164,182,.4)'], [1, 'rgba(150,154,172,0)']],
    acid: [[0, '#efffd2'], [.32, '#b2f46e'], [.62, '#5cc23a'], [.86, 'rgba(36,116,26,.62)'], [1, 'rgba(30,100,20,0)']],
    powder: [[0, '#fffbe2'], [.3, '#ffe28e'], [.62, 'rgba(255,172,60,.72)'], [1, 'rgba(255,140,40,0)']],
    ink: [[0, '#3c2c4c'], [.42, '#1e1428'], [.74, 'rgba(14,8,22,.88)'], [.92, 'rgba(10,6,14,.42)'], [1, 'rgba(10,6,14,0)']],
    deep: [[0, '#c4ecff'], [.32, '#4fa9ee'], [.68, '#1f6cc6'], [.9, 'rgba(14,58,150,.7)'], [1, 'rgba(14,58,150,0)']],
    wind: [[0, 'rgba(255,255,255,.72)'], [.5, 'rgba(226,238,255,.46)'], [.85, 'rgba(200,220,245,.16)'], [1, 'rgba(200,220,245,0)']]
  };
  function puffImg(kind) {
    const stops = CUSTOM_PUFF[kind];
    if (!stops) return KIT().puff(kind);
    return KIT().sprite('tb:puff:' + kind, 96, 96, g => {
      const gr = g.createRadialGradient(38, 36, 0, 48, 48, 48);
      for (const [s, c] of stops) gr.addColorStop(s, c);
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  const BLUE_FLAME = [[1, '#0a2a9c'], [.84, '#1d5ce6'], [.66, '#3f8cff'], [.46, '#a6d6ff'], [.25, '#f2fbff']];
  const FB = 114 / 128;
  const flameImg = (v, blue) => blue ? KIT().flame(v, BLUE_FLAME, 'tbBlue') : KIT().flame(v);
  function tongue(ctx, img, x, y, w, h) { if (h > 2) ctx.drawImage(img, x - w / 2, y - h * FB, w, h); }
  const kglow = (ctx, x, y, r, rgb, a, hot, sq) => KIT().glow(ctx, x, y, r, rgb, a, hot, sq);
  const stamp = (ctx, img, x, y, r, a, sq) => KIT().stamp(ctx, img, x, y, r, a, sq);
  const lighter = ctx => { ctx.globalCompositeOperation = 'lighter'; };
  const normal = ctx => { ctx.globalCompositeOperation = 'source-over'; };
  const hexRgb = new Map();
  function rgbOf(hex) {
    let v = hexRgb.get(hex);
    if (!v) { v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(','); hexRgb.set(hex, v); }
    return v;
  }

  // ---- sprites
  function coralImg() {
    return KIT().sprite('tb:coral', 64, 128, g => {
      const br = (x0, y0, x1, y1, w) => {
        const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
        g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.quadraticCurveTo((x0 + x1) / 2 + nx * .5 + 3, (y0 + y1) / 2 + ny * .5, x1, y1);
        g.quadraticCurveTo((x0 + x1) / 2 - nx * .5 + 3, (y0 + y1) / 2 - ny * .5, x0 - nx, y0 - ny); g.closePath();
      };
      const shapes = [[32, 124, 30, 6, 12], [30, 80, 10, 40, 5], [34, 66, 54, 30, 5], [31, 100, 14, 70, 4]];
      g.lineJoin = 'round';
      for (const [x0, y0, x1, y1, w] of shapes) { br(x0, y0, x1, y1, w); g.fillStyle = '#f2e6cf'; g.fill(); }
      g.save(); g.beginPath(); g.rect(33, 0, 40, 128); g.clip();
      for (const [x0, y0, x1, y1, w] of shapes) { br(x0, y0, x1, y1, w); g.fillStyle = '#c9b494'; g.fill(); }
      g.restore();
      g.fillStyle = 'rgba(244,150,140,.8)';
      for (const [x, y] of [[30, 8], [10, 42], [54, 32], [14, 72]]) { g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); }
      g.strokeStyle = '#3a3028'; g.lineWidth = 2;
      for (const [x0, y0, x1, y1, w] of shapes) { br(x0, y0, x1, y1, w); g.stroke(); }
    });
  }
  function sandSpikeImg() {
    return KIT().sprite('tb:sandspike', 64, 128, g => {
      const path = () => { g.beginPath(); g.moveTo(10, 124); g.quadraticCurveTo(22, 70, 34, 4); g.quadraticCurveTo(40, 70, 56, 124); g.closePath(); };
      path(); g.fillStyle = '#e0bd7d'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#b48a4c'; g.beginPath(); g.moveTo(34, 0); g.quadraticCurveTo(38, 70, 60, 128); g.lineTo(34, 128); g.closePath(); g.fill();
      g.strokeStyle = '#34479e'; g.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const y = 40 + i * 22; g.beginPath(); g.moveTo(12, y + 8); g.quadraticCurveTo(32, y - 4, 58, y + 6); g.stroke(); }
      g.fillStyle = 'rgba(255,246,220,.55)'; g.beginPath(); g.moveTo(33, 8); g.quadraticCurveTo(24, 70, 16, 124); g.lineTo(22, 124); g.quadraticCurveTo(28, 70, 33, 8); g.fill();
      g.restore();
      path(); g.strokeStyle = '#5a3a18'; g.lineWidth = 2.2; g.stroke();
    });
  }
  function rockImg() {
    return KIT().sprite('tb:rock', 64, 64, g => {
      const path = () => { g.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, r = 27 * (.82 + hsh(i % 12 + 3) * .18); i ? g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r) : g.moveTo(32 + r, 32); } g.closePath(); };
      path(); g.fillStyle = '#3a2620'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#5c3e30'; g.beginPath(); g.arc(24, 22, 22, 0, TAU); g.fill();
      g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(44, 46, 20, 0, TAU); g.fill();
      g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(48, 50, 11, 0, TAU); g.fill();
      g.strokeStyle = '#ff7a20'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(14, 30); g.lineTo(26, 34); g.lineTo(32, 44); g.moveTo(26, 34); g.lineTo(36, 26); g.stroke();
      g.restore();
      path(); g.strokeStyle = '#170c08'; g.lineWidth = 2.4; g.stroke();
    });
  }
  const bubbleImg = tint => KIT().sphere('tb:bubble:' + tint, tint === 'acid'
    ? [[0, 'rgba(255,255,255,.95)'], [.14, 'rgba(225,255,190,.45)'], [.62, 'rgba(140,230,80,.22)'], [.9, 'rgba(190,255,140,.75)'], [1, 'rgba(210,255,170,0)']]
    : [[0, 'rgba(255,255,255,.95)'], [.14, 'rgba(255,240,200,.5)'], [.55, 'rgba(255,150,60,.45)'], [.88, 'rgba(255,210,150,.8)'], [1, 'rgba(255,230,190,0)']]);
  const bijuuImg = () => KIT().sphere('tb:bijuu', [[0, '#d6b8ff'], [.1, '#6a2e9a'], [.38, '#1c0a2a'], [.84, '#070309'], [1, '#000']]);
  const bijuuSwirl = () => KIT().swirl('tb:bswirl', ['rgba(230,160,255,.95)', 'rgba(255,90,150,.85)', 'rgba(120,170,255,.85)'], 8, 1.3, .18);
  const windSwirl = () => KIT().swirl('tb:wswirl', ['rgba(255,255,255,.95)', 'rgba(190,220,255,.85)'], 7, 1.1, .16);
  function isoBallImg() {
    return KIT().sprite('tb:isoball', 180, 180, g => {
      g.translate(90, 90); g.lineJoin = 'round';
      for (let i = 0; i < 14; i++) {
        const a = i * TAU / 14, ca = Math.cos(a), sa = Math.sin(a), nx = -sa * 9, ny = ca * 9;
        g.beginPath(); g.moveTo(ca * 54 + nx, sa * 54 + ny); g.lineTo(ca * 86, sa * 86); g.lineTo(ca * 54 - nx, sa * 54 - ny); g.closePath();
        g.fillStyle = '#f1e8d0'; g.fill(); g.strokeStyle = '#162424'; g.lineWidth = 2; g.stroke();
      }
      g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fillStyle = '#5f807c'; g.fill();
      g.fillStyle = 'rgba(30,50,60,.4)'; g.beginPath(); g.arc(10, 12, 56, 0, TAU); g.fill();
      g.fillStyle = 'rgba(230,255,246,.35)'; g.beginPath(); g.arc(-16, -18, 30, 0, TAU); g.fill();
      g.strokeStyle = '#3c5a57'; g.lineWidth = 3;
      for (const [x, y, r] of [[0, 0, 18], [-30, -14, 14], [26, -22, 13], [22, 28, 14], [-24, 28, 13], [0, -40, 11]]) {
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.stroke();
      }
      g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.strokeStyle = '#162424'; g.lineWidth = 3; g.stroke();
    });
  }

  // ---- telegraphs: what you see is exactly what is hit
  function teleCircle(ctx, x, y, r, k, rgb, time) {
    const pulse = .55 + Math.sin(time * 18) * .2;
    ctx.fillStyle = `rgba(${rgb},${.07 + .08 * k})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},.2)`;
    ctx.beginPath(); ctx.arc(x, y, r * Math.max(.03, eOut(k)), 0, TAU); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(24,8,8,.28)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.6; ctx.strokeStyle = `rgba(${rgb},${Math.min(1, pulse + .25 * k)})`; ctx.stroke();
  }
  function sectorPath(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath(); ctx.arc(x, y, r1, a0, a1);
    if (r0 > 0) ctx.arc(x, y, r0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  function teleSector(ctx, x, y, a, half, reach, k, rgb, time) {
    const pulse = .55 + Math.sin(time * 18) * .2;
    ctx.fillStyle = `rgba(${rgb},${.07 + .07 * k})`; sectorPath(ctx, x, y, 0, reach, a - half, a + half); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(24,8,8,.28)'; ctx.stroke();
    ctx.lineWidth = 2.6; ctx.strokeStyle = `rgba(${rgb},${Math.min(1, pulse + .25 * k)})`; ctx.stroke();
    ctx.fillStyle = `rgba(${rgb},.2)`; sectorPath(ctx, x, y, 0, Math.max(4, reach * eOut(k)), a - half, a + half); ctx.fill();
  }
  function teleLine(ctx, x, y, a, len, hw, k, rgb, time) {
    const pulse = .55 + Math.sin(time * 18) * .2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = `rgba(${rgb},${.07 + .07 * k})`; ctx.fillRect(0, -hw, len, hw * 2);
    ctx.fillStyle = `rgba(${rgb},.2)`; ctx.fillRect(0, -hw, len * eOut(k), hw * 2);
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(24,8,8,.28)'; ctx.strokeRect(0, -hw, len, hw * 2);
    ctx.lineWidth = 2.6; ctx.strokeStyle = `rgba(${rgb},${Math.min(1, pulse + .25 * k)})`; ctx.strokeRect(0, -hw, len, hw * 2);
    // chevrons running toward the far end
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${.35 + .3 * k})`; ctx.beginPath();
    const s = Math.min(hw * .55, 26);
    for (let i = 0; i < 5; i++) { const px = ((i / 5 + time * .9) % 1) * (len - s * 2) + s; ctx.moveTo(px - s * .6, -s); ctx.lineTo(px + s * .4, 0); ctx.lineTo(px - s * .6, s); }
    ctx.stroke();
    ctx.restore();
  }

  // ---- impacts
  function blastGround(ctx, x, y, r, u, pal, life = 1.6) {
    const fade = 1 - win(u, life - .6, life);
    ctx.fillStyle = `rgba(${pal.scorch},${.42 * fade})`;
    ctx.beginPath(); ctx.ellipse(x, y, r * .92, r * .56, 0, 0, TAU); ctx.fill();
    if (u < .6) KIT().fx.shockRing(ctx, x, y, r * 1.35, u / .6, 1 - u / .6, pal.rgb);
  }
  // Flash, billowing puffs, debris. n = puff count (small for chained spots).
  function blastOver(ctx, x, y, r, u, pal, seed, n = 8) {
    if (u >= 1) return;
    const e = eOut(u * 1.7), fade = Math.pow(1 - u, 1.2);
    lighter(ctx);
    if (u < .3) kglow(ctx, x, y - r * .25, r * (1 + u * 2.2), pal.hot, 1 - u / .3, true);
    kglow(ctx, x, y - r * .2, r * 1.5, pal.rgb, .45 * fade, false, .7);
    normal(ctx);
    const img = puffImg(pal.puff);
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hsh(i + seed) * .6, d = r * (.18 + .72 * e * (.7 + hsh(i * 3.1 + seed) * .4));
      stamp(ctx, img, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - u * r * .45 - hsh(i * 1.7 + seed) * r * .18,
        r * (.2 + .2 * e) * (.8 + hsh(i * 2.3 + seed) * .4), fade * .95);
    }
    if (n > 5) KIT().fx.debris(ctx, x, y, r * 1.25, u, seed, pal.debris, 9);
  }

  // ---- spot looks: pre = drawn while the jutsu is on its way (falling, rising...), erupt = after it lands
  function bluePillar(ctx, fx, s, u, time, i) {
    const grow = eOut(u * 5), die = 1 - win(u, .55, 1.1), H = s.r * 3.6 * grow * (.35 + .65 * die), f = Math.floor(time * 12);
    lighter(ctx);
    kglow(ctx, s.x, s.y - H * .45, s.r * 1.3, '60,130,255', .6 * die, false, 1.5);
    kglow(ctx, s.x, s.y, s.r * .9, '200,235,255', .7 * die, true, .45);
    normal(ctx);
    tongue(ctx, flameImg((i + f) % 6, true), s.x - s.r * .42, s.y + 2, s.r * .9 * die + 8, H * .62);
    tongue(ctx, flameImg((i + f + 3) % 6, true), s.x + s.r * .42, s.y + 2, s.r * .9 * die + 8, H * .58);
    tongue(ctx, flameImg((i + f + 1) % 6, true), s.x, s.y + 4, s.r * 1.25 * (.55 + .45 * die), H);
  }
  function lavaGeyser(ctx, fx, s, u, time, i) {
    const grow = eOut(u * 4.5), die = 1 - win(u, .5, 1.1), H = s.r * 3.2 * grow * (.3 + .7 * die), f = Math.floor(time * 12);
    lighter(ctx); kglow(ctx, s.x, s.y - H * .4, s.r * 1.3, '255,100,30', .55 * die, false, 1.4); normal(ctx);
    tongue(ctx, flameImg((i + f) % 6), s.x - s.r * .35, s.y + 2, s.r * .8 + 6, H * .6);
    tongue(ctx, flameImg((i + f + 2) % 6), s.x, s.y + 4, s.r * 1.2 * (.5 + .5 * die), H);
    tongue(ctx, flameImg((i + f + 4) % 6), s.x + s.r * .38, s.y + 2, s.r * .8 + 6, H * .55);
    if (u < 1) KIT().fx.debris(ctx, s.x, s.y, s.r * 1.7, u, s.seed, '#2a1810', 6);
    if (u > .4) stamp(ctx, KIT().puff('smoke'), s.x + Math.sin(time + i) * 8, s.y - H - s.r * .3 - (u - .4) * 60, s.r * (.4 + u * .3), (1 - u) * .5);
  }
  function steamColumn(ctx, fx, s, u, time, i, tall = 3.6) {
    const grow = eOut(u * 4), die = 1 - win(u, .5, 1.2), H = s.r * tall * grow, img = puffImg('steamW');
    lighter(ctx); kglow(ctx, s.x, s.y - H * .4, s.r * 1.1, '255,170,140', .22 * die, false, 1.4); normal(ctx);
    for (let j = 0; j < 5; j++) {
      const k = j / 4, wob = Math.sin(time * 6 + j * 1.7 + i) * s.r * .12;
      stamp(ctx, img, s.x + wob, s.y - H * k - u * 30 * k, s.r * (.42 + k * .32) * (.7 + .3 * grow), die * (.95 - k * .25));
    }
    lighter(ctx); kglow(ctx, s.x, s.y, s.r * .7, '255,200,170', .35 * die, true, .5); kglow(ctx, s.x, s.y - H * .3, s.r * .9, '255,90,60', .45 * die, false, 1.2); normal(ctx);
  }
  function inkSpout(ctx, fx, s, u, time, i) {
    const grow = eOut(u * 4.5), die = 1 - win(u, .5, 1.1), H = s.r * 3.3 * grow * (.4 + .6 * die), img = puffImg('ink');
    for (let j = 0; j < 5; j++) { const k = j / 4; stamp(ctx, img, s.x + Math.sin(time * 5 + j + i) * s.r * .1, s.y - H * k, s.r * (.5 - k * .14), die); }
    ctx.fillStyle = '#140a1c';
    for (let j = 0; j < 7; j++) {
      const a = hsh(j + s.seed) * TAU, tt = c01(u * 1.3 - hsh(j * 2 + s.seed) * .2), d = s.r * (.3 + 1.1 * tt);
      const px = s.x + Math.cos(a) * d, py = s.y + Math.sin(a) * d * .5 - Math.sin(Math.PI * tt) * H * .7;
      if (tt > 0 && tt < 1) { ctx.beginPath(); ctx.arc(px, py, 4 + hsh(j * 3) * 5, 0, TAU); ctx.fill(); }
    }
    lighter(ctx); kglow(ctx, s.x, s.y - H * .5, s.r, '150,90,210', .3 * die, false, 1.3); normal(ctx);
  }
  function spikes(ctx, s, u, img, n, tall, life) {
    const rise = KIT().ease.outBack(u * 5), sink = 1 - win(u, life - .4, life);
    for (let j = 0; j < n; j++) {
      const ox = (j === 0 ? 0 : (hsh(j * 3.1 + s.seed) - .5) * s.r * 1.1), oy = (j === 0 ? 0 : (hsh(j * 5.3 + s.seed) - .5) * s.r * .6);
      const h = s.r * tall * (j === 0 ? 1 : .55 + hsh(j + s.seed) * .3) * rise * sink;
      if (h < 3) continue;
      ctx.save(); ctx.translate(s.x + ox, s.y + oy + 4); ctx.rotate((hsh(j * 7 + s.seed) - .5) * .5);
      ctx.drawImage(img, -h * .25, -h * (122 / 128), h * .5, h);
      ctx.restore();
    }
    if (u < .5) stamp(ctx, KIT().puff('dust'), s.x, s.y - 6, s.r * (.5 + u), (1 - u * 2) * .8, .7);
  }
  function tentacleShape(ctx, bx, by, tx, ty, lift, w, alpha) {
    if (alpha <= .02) return;
    const C = GYU, mx = (bx + tx) / 2, my = Math.min(by, ty) - 40 - lift * 1.05;
    const rb = ribbon(bez([bx, by], [mx, my], [tx, ty - lift], 10), u => w * (1 - u * .8) + 2);
    ctx.globalAlpha = alpha;
    ribbonPath(ctx, rb); ctx.fillStyle = C.skin; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath();
    for (let k = 2; k < 10; k += 2) { const a = rb.R[k], b = rb.P[k], x = (a[0] * 2 + b[0]) / 3, y = (a[1] * 2 + b[1]) / 3, r = 3.6 - k * .2; ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * .8, 0, 0, TAU); }
    ctx.fillStyle = C.sucker; ctx.fill();
    ctx.globalAlpha = 1;
  }
  function tentacleBase(fx, s) {
    const dx = s.x - fx.ox, dy = s.y - fx.oy, d = Math.hypot(dx, dy) || 1;
    return [s.x - dx / d * s.r * 1.9, s.y - dy / d * s.r * 1.9];
  }
  // Sabaku Sōsō: a wall of sand rises round the target, closes over it like a cocoon, then crushes.
  function sandCup(ctx, s, rise, close, time, alpha, squeeze) {
    const rb = s.r * .88 * squeeze, h = 112 * rise * (2 - squeeze), rt = rb * (1 - .92 * close), x = s.x, y = s.y, top = y - h;
    if (h < 3) return;
    ctx.globalAlpha = alpha;
    const side = () => {
      ctx.beginPath(); ctx.ellipse(x, y, rb, rb * .45, 0, 0, Math.PI);
      ctx.bezierCurveTo(x - rb * 1.08, y - h * .55, x - rt * 1.3 - 6, top + h * .12, x - rt, top);
      if (rt > 1) ctx.ellipse(x, top, rt, rt * .45, 0, Math.PI, 0, true);
      ctx.bezierCurveTo(x + rt * 1.3 + 6, top + h * .12, x + rb * 1.08, y - h * .55, x + rb, y); ctx.closePath();
    };
    if (rt > 4) { ctx.fillStyle = '#6e5028'; ctx.beginPath(); ctx.ellipse(x, top, rt, rt * .45, 0, 0, TAU); ctx.fill(); }
    side();
    const gr = ctx.createLinearGradient(x - rb, 0, x + rb, 0);
    gr.addColorStop(0, '#f4dba2'); gr.addColorStop(.42, '#d9b170'); gr.addColorStop(1, '#94692f');
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    // spiral bands of sand winding up the cocoon
    ctx.strokeStyle = 'rgba(110,76,34,.45)'; ctx.lineWidth = 7; ctx.beginPath();
    for (let j = 0; j < 4; j++) {
      const yy = y + 10 - ((time * 60 + j * 34) % (h + 40));
      ctx.moveTo(x - rb * 1.1, yy + 18); ctx.quadraticCurveTo(x, yy + 38, x + rb * 1.1, yy - 14);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,205,.45)'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(x - rb * .6, y + 6); ctx.quadraticCurveTo(x - rb * .7, y - h * .5, x - rt * .6, top + 4); ctx.stroke();
    ctx.restore();
    side(); ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 2.2; ctx.stroke();
    // lumpy rim and a skirt of dust so it reads as poured sand, not a solid wall
    const sand = puffImg('sand'), dust = KIT().puff('dust');
    if (rt > 6) for (let j = 0; j < 7; j++) { const a = j * TAU / 7 + time * 2; stamp(ctx, sand, x + Math.cos(a) * rt, top + Math.sin(a) * rt * .45 - 3, 10 + rt * .16, .9 * alpha); }
    else stamp(ctx, sand, x, top + 4, 18, alpha);
    for (let j = 0; j < 7; j++) { const a = j * TAU / 7 + .3; stamp(ctx, dust, x + Math.cos(a) * rb * 1.02, y + Math.sin(a) * rb * .46 - 4, 20 + 6 * Math.sin(time * 5 + j), .75 * alpha, .7); }
    ctx.globalAlpha = 1;
  }
  function lob(fx, s, t, flight, arc) {
    const k = 1 - (s.d - t) / flight;
    if (k < 0) return null;
    return { k, x: fx.ox + (s.x - fx.ox) * k, y: fx.oy + (s.y - fx.oy) * k, h: fx.oh * (1 - k) + arc * 4 * k * (1 - k) };
  }

  const LOOKS = {
    bluePillar: { erupt: bluePillar, dur: 1.1, blast: .8, n: 4 },
    geyser: { erupt: lavaGeyser, dur: 1.1, blast: .75, n: 4 },
    steamGeyser: { erupt: steamColumn, dur: 1.2, blast: .8, n: 4 },
    steamBurst: { erupt: (c, f, s, u, t, i) => steamColumn(c, f, s, u, t, i, 1.6), dur: 1.1, blast: .9, n: 4 },
    inkSpout: { erupt: inkSpout, dur: 1.1, blast: .8, n: 4 },
    inkSplash: { erupt: (c, f, s, u, t, i) => inkSpout(c, f, { x: s.x, y: s.y, r: s.r * .5, seed: s.seed }, u, t, i), dur: 1.1, blast: 1, n: 9 },
    coral: { erupt: (c, f, s, u) => spikes(c, s, u, coralImg(), 3, 1.75, 1.8), dur: 1.8, blast: .6, n: 3 },
    sandSpike: { erupt: (c, f, s, u) => spikes(c, s, u, sandSpikeImg(), 2, 1.9, 1.3), dur: 1.3, blast: .6, n: 3 },
    slam: {
      erupt(ctx, fx, s, u, time, i) {
        const die = 1 - win(u, .4, 1.2), f = Math.floor(time * 12);
        for (let j = 0; j < 10; j++) {
          const a = j * TAU / 10 + s.seed, d = s.r * (.45 + eOut(u * 3) * .4), h = s.r * .7 * bell(u * 1.2) * (.7 + hsh(j + s.seed) * .5);
          tongue(ctx, flameImg((j + f) % 6), s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * .55, h * .45, h);
        }
        lighter(ctx); kglow(ctx, s.x, s.y - 20, s.r * 1.3, '255,110,30', .6 * die, false, .6); normal(ctx);
      }, dur: 1.2, blast: 1, n: 12
    },
    tentacle: {
      pre(ctx, fx, s, t) {
        const k = 1 - (s.d - t) / .5;
        if (k <= 0) return;
        const [bx, by] = tentacleBase(fx, s);
        tentacleShape(ctx, bx, by, s.x, s.y, 190 * eOut(k * 1.3) - 60 * eIn(win(k, .75, 1)), 26, c01(k * 3));
      },
      erupt(ctx, fx, s, u) {
        const [bx, by] = tentacleBase(fx, s), out = win(u, .4, .8);
        tentacleShape(ctx, bx + (s.x - bx) * out * .6, by + (s.y - by) * out * .6, s.x, s.y, 8 * bell(u * 3), 26 * (1 - out * .5), 1 - out);
      }, dur: .8, blast: .7, n: 5
    },
    coffin: {
      pre(ctx, fx, s, t, time) {
        const k = 1 - (s.d - t) / 1.0;
        if (k > 0) sandCup(ctx, s, eOut(k * 1.2), eIn(win(k, .4, 1)), time, c01(k * 5), 1);
      },
      erupt(ctx, fx, s, u, time) {
        if (u < .16) sandCup(ctx, s, 1, 1, time, 1, 1 - u / .16 * .55);
        if (u < .1) return;
        u -= .1;
        const img = puffImg('sand'), e = eOut(u * 2.2), fade = 1 - win(u, .45, 1.1);
        for (let j = 0; j < 10; j++) {
          const a = j * TAU / 10 + s.seed, d = s.r * .7 * (1 - eOut(u * 6)) + s.r * .6 * win(u, .25, 1) * hsh(j + s.seed);
          stamp(ctx, img, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * .55 - 60 * (1 - e) - 20, s.r * (.35 + .2 * e), fade);
        }
        stamp(ctx, img, s.x, s.y - 50 - u * 30, s.r * (.5 + .4 * e), fade);
      }, dur: 1.2, blast: 1.1, n: 10
    },
    waterBomb: {
      pre(ctx, fx, s, t, time) {
        const p = lob(fx, s, t, fx.fallT, 230);
        if (!p) return;
        const img = puffImg('water');
        for (let q = 3; q >= 1; q--) { const b = lob(fx, s, t - q * .05, fx.fallT, 230); if (b) stamp(ctx, img, b.x, b.y - b.h, 12 - q * 2, .5 - q * .1); }
        lighter(ctx); kglow(ctx, p.x, p.y - p.h, 34, '80,180,255', .5); normal(ctx);
        stamp(ctx, img, p.x, p.y - p.h, 20, 1);
        ctx.fillStyle = 'rgba(10,30,50,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 16, 7, 0, 0, TAU); ctx.fill();
      },
      erupt(ctx, fx, s, u) {
        const img = puffImg('water'), foam = KIT().puff('poof'), e = eOut(u * 2), fade = 1 - win(u, .3, .9);
        for (let j = 0; j < 9; j++) {
          const a = j * TAU / 9 + s.seed, d = s.r * (.3 + .6 * e), h = s.r * .9 * bell(u * 1.3) * (.6 + hsh(j + s.seed) * .5);
          stamp(ctx, j % 3 ? img : foam, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * .5 - h, s.r * .2, fade);
        }
      }, dur: .9, blast: .85, n: 5
    },
    lavaBomb: {
      pre(ctx, fx, s, t, time, i) {
        const k = 1 - (s.d - t) / fx.fallT;
        if (k <= 0) return;
        const e = k * k, x = s.x - 260 * (1 - e), y = s.y - 760 * (1 - e) - 20, f = Math.floor(time * 14);
        ctx.fillStyle = `rgba(30,8,4,${.15 + .3 * k})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 26 * (.4 + k), 12 * (.4 + k), 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(760, 260) + Math.PI / 2);
        for (let j = 0; j < 3; j++) ctx.drawImage(flameImg((i + j + f) % 6), -14 + j * 7 - 4, -10, 22, 70);
        ctx.restore();
        lighter(ctx); kglow(ctx, x, y, 46, '255,110,30', .7); normal(ctx);
        ctx.drawImage(rockImg(), x - 22, y - 22, 44, 44);
      },
      erupt(ctx, fx, s, u, time, i) {
        const die = 1 - win(u, .3, 1), f = Math.floor(time * 12);
        for (let j = 0; j < 3; j++) tongue(ctx, flameImg((i + j + f) % 6), s.x + (j - 1) * s.r * .4, s.y, s.r * .6, s.r * 1.6 * bell(u * 1.1) * die);
      }, dur: 1, blast: .9, n: 6
    },
    acidBubble: {
      pre(ctx, fx, s, t, time) {
        const p = lob(fx, s, t, Math.min(s.d, fx.fallT), 150);
        if (!p) return;
        const r = 14 + s.r * .14 * p.k, y = p.y - p.h + Math.sin(time * 5 + s.seed) * 6;
        ctx.fillStyle = 'rgba(20,50,10,.2)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * .4, 0, 0, TAU); ctx.fill();
        stamp(ctx, bubbleImg('acid'), p.x, y, r, .95);
      },
      erupt(ctx, fx, s, u) {
        const e = eOut(u * 2.5), fade = 1 - u / .6;
        if (fade > 0) { ctx.strokeStyle = `rgba(225,255,200,${fade})`; ctx.lineWidth = 3 * fade + 1; ctx.beginPath(); ctx.ellipse(s.x, s.y - 30, s.r * (.3 + e * .7), s.r * (.3 + e * .7) * .7, 0, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#9fe060';
        for (let j = 0; j < 8; j++) {
          const a = j * TAU / 8 + s.seed, tt = c01(u * 1.6), d = s.r * (.2 + .8 * tt);
          if (tt < 1) { ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * .5 - 30 - Math.sin(Math.PI * tt) * 40, 4, 0, TAU); ctx.fill(); }
        }
      }, dur: .7, blast: .7, n: 5
    },
    bombBubble: {
      pre(ctx, fx, s, t, time) {
        const p = lob(fx, s, t, fx.fallT, 120);
        if (!p) return;
        const r = 18 + 22 * eOut(p.k * 2), y = p.y - p.h - 26 + Math.sin(time * 4 + s.seed) * 7, beat = .5 + .5 * Math.sin(time * (8 + p.k * 22));
        ctx.fillStyle = 'rgba(40,20,10,.2)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * .4, 0, 0, TAU); ctx.fill();
        stamp(ctx, bubbleImg('bomb'), p.x, y, r, .95);
        lighter(ctx); kglow(ctx, p.x, y, r * (1.2 + beat * .6), '255,140,50', .35 + .4 * beat * p.k); normal(ctx);
      },
      dur: .1, blast: 1.05, n: 9
    },
    powderBurst: {
      pre(ctx, fx, s, t, time) {
        const k = 1 - (s.d - t) / .9;
        if (k <= 0) return;
        ctx.fillStyle = '#fff2b0';
        for (let j = 0; j < 7; j++) {
          const a = j * TAU / 7 + time * 3 + s.seed, d = s.r * (1.1 - k * .9), x = s.x + Math.cos(a) * d, y = s.y - 30 + Math.sin(a) * d * .45, z = 2.5 + 2 * k;
          ctx.beginPath(); ctx.moveTo(x, y - z); ctx.lineTo(x + z * .5, y); ctx.lineTo(x, y + z); ctx.lineTo(x - z * .5, y); ctx.closePath(); ctx.fill();
        }
        lighter(ctx); kglow(ctx, s.x, s.y - 30, s.r * (.3 + k * .5), '255,200,90', .3 + .5 * k * (.6 + .4 * Math.sin(time * 30))); normal(ctx);
      },
      dur: .1, blast: 1, n: 6
    },
    blastOnly: { dur: .1, blast: 1, n: 9 }
  };

  function puddleGround(ctx, fx, s, u, time) {
    const life = fx.puddle.dur, a = Math.min(1, u * 4) * (1 - win(u, life - .6, life)), r = s.r * .8;
    if (a <= 0) return;
    if (fx.sty === 'lava') {
      ctx.fillStyle = `rgba(60,14,4,${.75 * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,${120 + 40 * Math.sin(time * 4 + s.seed) | 0},30,${.7 * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, r * .72, r * .4, 0, 0, TAU); ctx.fill();
      lighter(ctx); kglow(ctx, s.x, s.y, r * 1.2, '255,110,30', .45 * a, false, .55); normal(ctx);
    } else {
      ctx.fillStyle = `rgba(70,150,30,${.55 * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(170,250,110,${.5 * a})`; ctx.beginPath(); ctx.ellipse(s.x - r * .15, s.y - r * .1, r * .55, r * .28, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(230,255,200,${.8 * a})`; ctx.lineWidth = 1.4;
      for (let j = 0; j < 3; j++) { const ph = (time * .9 + hsh(j + s.seed)) % 1; ctx.beginPath(); ctx.arc(s.x + (hsh(j * 3 + s.seed) - .5) * r, s.y + (hsh(j * 5 + s.seed) - .5) * r * .5, 2 + ph * 6, 0, TAU); ctx.stroke(); }
    }
  }

  // ---- per-kind painters
  function spotsGround(ctx, fx, time) {
    const pal = PAL[fx.sty], t = fx.age;
    for (const s of fx.spots) {
      if (t < s.d) { teleCircle(ctx, s.x, s.y, s.r, t / s.d, pal.tele, time); continue; }
      const u = t - s.d;
      blastGround(ctx, s.x, s.y, s.r, u, pal, fx.puddle ? fx.puddle.dur : 1.7);
      if (fx.puddle) puddleGround(ctx, fx, s, u, time);
    }
  }
  function spotsOver(ctx, fx, time) {
    const L = LOOKS[fx.look], pal = PAL[fx.sty], t = fx.age;
    for (let i = 0; i < fx.spots.length; i++) {
      const s = fx.spots[i];
      if (t < s.d) { if (L.pre) L.pre(ctx, fx, s, t, time, i); continue; }
      const u = t - s.d;
      if (L.erupt && u < L.dur) L.erupt(ctx, fx, s, u, time, i);
      if (L.blast && u < 1) blastOver(ctx, s.x, s.y, s.r * L.blast, u, pal, s.seed, L.n);
    }
  }

  // trough · face · leading edge colours of each wave, and whether ripples run through it
  const BANDS = {
    water: ['16,80,180', '46,140,235', '210,245,255', 1],
    sand: ['140,100,52', '200,160,96', '248,228,180', 1],
    acid: ['44,120,24', '118,208,58', '225,255,175', 1],
    lava: ['80,16,6', '226,72,16', '255,206,96', 0],
    blue: ['12,34,140', '44,112,250', '205,238,255', 0],
    powder: ['190,130,40', '255,196,90', '255,248,210', 0]
  };
  function waveFront(fx) { return Math.min(fx.reach, Math.max(0, fx.age - fx.delay) * fx.speed); }
  function waveGround(ctx, fx, time) {
    const pal = PAL[fx.sty];
    if (fx.age < fx.delay) { teleSector(ctx, fx.x, fx.y, fx.a, fx.half, fx.reach, fx.age / fx.delay, pal.tele, time); return; }
    const front = waveFront(fx), after = fx.age - fx.delay - fx.reach / fx.speed;
    const fade = fx.leave ? 1 - win(after, fx.leave.dur - .8, fx.leave.dur) : 1 - win(after, 0, .8);
    ctx.fillStyle = `rgba(${pal.scorch},${.34 * fade})`;
    sectorPath(ctx, fx.x, fx.y, 30, front, fx.a - fx.half, fx.a + fx.half); ctx.fill();
    // the body of the wave sweeping over the ground: dark trough, bright face, a lit leading edge
    const band = BANDS[fx.look], bAl = after < 0 ? 1 : 1 - win(after, 0, .5);
    if (band && bAl > 0) {
      const a0 = fx.a - fx.half, a1 = fx.a + fx.half;
      ctx.fillStyle = `rgba(${band[0]},${.42 * bAl})`; sectorPath(ctx, fx.x, fx.y, Math.max(30, front - 170), front, a0, a1); ctx.fill();
      ctx.fillStyle = `rgba(${band[1]},${.55 * bAl})`; sectorPath(ctx, fx.x, fx.y, Math.max(30, front - 85), front, a0, a1); ctx.fill();
      ctx.fillStyle = `rgba(${band[2]},${.6 * bAl})`; sectorPath(ctx, fx.x, fx.y, Math.max(30, front - 24), front + 6, a0, a1); ctx.fill();
      if (band[3]) {
        ctx.strokeStyle = `rgba(${band[2]},${.5 * bAl})`; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let q = 0; q < 3; q++) { const r = front - 40 - ((time * 140 + q * 45) % 130); if (r > 40) { ctx.moveTo(fx.x + Math.cos(a0) * r, fx.y + Math.sin(a0) * r); ctx.arc(fx.x, fx.y, r, a0, a1); } }
        ctx.stroke();
      }
    }
    if (!fx.leave || fade <= 0) return;
    // the burning / corroding field left behind
    const f = Math.floor(time * 11);
    for (let j = 0; j < 34; j++) {
      const d = 80 + hsh(j * 2.7 + fx.x) * (fx.reach - 100), a = fx.a + (hsh(j * 4.1 + fx.y) - .5) * 2 * fx.half * .9;
      if (d > front) continue;
      const px = fx.x + Math.cos(a) * d, py = fx.y + Math.sin(a) * d, born = c01((front - d) / 120);
      if (fx.look === 'blue' || fx.look === 'lava') {
        const h = (34 + hsh(j) * 36) * born * fade * (.8 + .2 * Math.sin(time * 9 + j));
        tongue(ctx, flameImg((j + f) % 6, fx.look === 'blue'), px, py, h * .5, h);
      } else if (fx.look === 'acid') {
        const ph = (time * .8 + hsh(j)) % 1;
        ctx.strokeStyle = `rgba(220,255,180,${(1 - ph) * fade})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, 3 + ph * 9, 0, TAU); ctx.stroke();
      } else if (fx.look === 'powder') {
        const tw = .5 + .5 * Math.sin(time * 9 + j * 2.1), z = 2 + tw * 2.5;
        ctx.fillStyle = `rgba(255,236,150,${tw * fade})`;
        ctx.beginPath(); ctx.moveTo(px, py - 20 - z); ctx.lineTo(px + z * .5, py - 20); ctx.lineTo(px, py - 20 + z); ctx.lineTo(px - z * .5, py - 20); ctx.closePath(); ctx.fill();
      }
    }
    if (fx.look === 'blue' || fx.look === 'lava') {
      lighter(ctx);
      for (let j = 0; j < 5; j++) { const d = front * (j + .5) / 5; kglow(ctx, fx.x + Math.cos(fx.a) * d, fx.y + Math.sin(fx.a) * d, 50 + d * .3, pal.rgb, .25 * fade, false, .55); }
      normal(ctx);
    }
  }
  function waveOver(ctx, fx, time) {
    if (fx.age < fx.delay) return;
    const front = waveFront(fx), after = fx.age - fx.delay - fx.reach / fx.speed;
    const al = 1 - win(after, 0, .45);
    if (fx.look === 'powder' && after > -.15 && after < .5) {
      // the scale powder catches the light all at once: a blinding golden flash over the cone
      const md = fx.reach * .55;
      lighter(ctx); kglow(ctx, fx.x + Math.cos(fx.a) * md, fx.y + Math.sin(fx.a) * md - 30, fx.reach * .75, '255,236,180', .55 * c01(1 - Math.abs(after - .1) / .4), true, .7); normal(ctx);
    }
    if (al <= 0 || front < 20) return;
    const H = fx.H * (after > 0 ? 1 - after * 1.6 : 1) * (.4 + .6 * eOut(front / 160)), pal = PAL[fx.sty];
    const M = Math.max(6, Math.ceil(front * 2 * fx.half / 40)), ca = Math.cos(fx.a), sa = Math.sin(fx.a), f = Math.floor(time * 12);
    if (fx.look === 'wind') {
      lighter(ctx);
      for (let q = 0; q < 3; q++) {
        const r = front - q * 34;
        if (r < 20) continue;
        ctx.strokeStyle = `rgba(235,245,255,${al * (.55 - q * .14)})`; ctx.lineWidth = 9 - q * 3;
        ctx.beginPath(); ctx.arc(fx.x, fx.y - 30 - q * 10, r, fx.a - fx.half, fx.a + fx.half); ctx.stroke();
      }
      normal(ctx);
      const dust = KIT().puff('dust'), wi = puffImg('wind');
      for (let j = 0; j < M; j += 2) {
        const an = fx.a - fx.half + (j + .5) / M * 2 * fx.half, px = fx.x + Math.cos(an) * front, py = fx.y + Math.sin(an) * front;
        stamp(ctx, dust, px, py - 8, 18 + hsh(j) * 10, al * .7, .7);
        stamp(ctx, wi, px + ca * 10, py - 40, 30, al * .8);
      }
      ctx.strokeStyle = `rgba(255,255,255,${al * .7})`; ctx.lineWidth = 2; ctx.beginPath();
      for (let j = 0; j < 14; j++) {
        const an = fx.a + (hsh(j * 1.3) - .5) * 2 * fx.half, d = front - 40 - ((time * 600 + j * 80) % 200);
        if (d < 40) continue;
        const px = fx.x + Math.cos(an) * d, py = fx.y + Math.sin(an) * d - 20 - hsh(j) * 50;
        ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(an) * 46, py + Math.sin(an) * 46);
      }
      ctx.stroke();
      return;
    }
    const look = fx.look, img = puffImg(pal.puff);
    const crest = look === 'water' ? KIT().puff('poof') : look === 'sand' ? KIT().puff('dust') : img;
    if (look === 'blue' || look === 'lava') { lighter(ctx); for (let j = 0; j < M; j += 4) { const an = fx.a - fx.half + (j + .5) / M * 2 * fx.half; kglow(ctx, fx.x + Math.cos(an) * front, fx.y + Math.sin(an) * front - H * .4, H * 1.1, pal.rgb, .35 * al); } normal(ctx); }
    for (let j = 0; j < M; j++) {
      const an = fx.a - fx.half + (j + .5) / M * 2 * fx.half, w = .8 + .35 * Math.sin(j * 2.3 + time * 5);
      const px = fx.x + Math.cos(an) * front, py = fx.y + Math.sin(an) * front, edge = 1 - Math.pow(Math.abs((j + .5) / M * 2 - 1), 3) * .6;
      const h = H * edge * w;
      if (look === 'blue' || look === 'lava') {
        // a band of fire: a low skirt at the leading edge, tallest tongues just behind it
        const cx = Math.cos(an), cy = Math.sin(an), blue = look === 'blue', vh = h * (.65 + hsh(j * 1.7) * .7);
        stamp(ctx, blue ? img : KIT().puff('ember'), px - cx * 70, py - cy * 70 - 10, 34 * edge, al * .8);
        tongue(ctx, flameImg((j + f + 5) % 6, blue), px - cx * 105, py - cy * 105, vh * .5, vh * .8);
        tongue(ctx, flameImg((j + f + 3) % 6, blue), px - cx * 55 + cy * 14, py - cy * 55 - cx * 14, vh * .7, vh * 1.5);
        stamp(ctx, img, px - cx * 10, py - cy * 10 - 8, 28 * edge, al * .9);
        tongue(ctx, flameImg((j + f) % 6, blue), px, py + 4, h * .6, h * .9);
      } else if (look === 'powder') {
        stamp(ctx, img, px - Math.cos(an) * 30, py - Math.sin(an) * 30 - h * .3, 40 * edge, al * .7); stamp(ctx, img, px, py - h * .7, 30 * edge, al * .6);
        ctx.fillStyle = `rgba(255,240,170,${al})`;
        for (let q = 0; q < 2; q++) { const z = 2.5 + hsh(j * 3 + q) * 2.5, yy = py - hsh(j * 7 + q + Math.floor(time * 6)) * h * 1.2, xx = px - ca * q * 18; ctx.fillRect(xx - z / 2, yy - z / 2, z, z); }
      } else {
        // sand / water / acid: a thick rolling wall, low at the back, the crest curling forward
        const cx = Math.cos(an), cy = Math.sin(an), s = H * edge * w, back = look === 'water' ? puffImg('deep') : img;
        stamp(ctx, back, px - cx * 80, py - cy * 80 - s * .14, s * .3, al * .85);
        stamp(ctx, back, px - cx * 42, py - cy * 42 - s * .36, s * .38, al);
        stamp(ctx, img, px - cx * 6, py - cy * 6 - s * .6, s * .4, al);
        stamp(ctx, crest, px + cx * 14, py + cy * 14 - s * .9, s * .27, al * .95);
      }
    }
    if (look === 'water' || look === 'acid') {
      lighter(ctx);
      for (let j = 0; j < M; j += 3) { const an = fx.a - fx.half + (j + .5) / M * 2 * fx.half; kglow(ctx, fx.x + Math.cos(an) * front, fx.y + Math.sin(an) * front - H * .6, 40, pal.hot, .3 * al); }
      normal(ctx);
    }
  }

  function orbPos(fx, p) {
    const k = c01(p / fx.len), gx = fx.x + Math.cos(fx.a) * p, gy = fx.y + Math.sin(fx.a) * p;
    return { gx, gy, h: fx.h0 + (28 - fx.h0) * k };
  }
  function orbGround(ctx, fx, time) {
    const pal = PAL[fx.sty], ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
    if (fx.age < fx.delay) {
      const k = fx.age / fx.delay;
      teleLine(ctx, fx.x, fx.y, fx.a, fx.len, fx.r + 24, k, pal.tele, time);
      teleCircle(ctx, ex, ey, fx.blastR, k, pal.tele, time);
      return;
    }
    const p = Math.min(fx.len, (fx.age - fx.delay) * fx.speed), o = orbPos(fx, p);
    if (fx.look === 'bijuu') {
      const fade = fx.done ? 1 - win(fx.age - fx.doneAt, 1, 2) : 1;
      ctx.strokeStyle = `rgba(${pal.scorch},${.45 * fade})`; ctx.lineWidth = fx.r * 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(o.gx, o.gy); ctx.stroke();
    }
    if (!fx.done) {
      ctx.fillStyle = 'rgba(14,6,20,.3)'; ctx.beginPath(); ctx.ellipse(o.gx, o.gy, fx.r, fx.r * .4, 0, 0, TAU); ctx.fill();
      if (fx.look === 'wind') stamp(ctx, KIT().puff('dust'), o.gx - Math.cos(fx.a) * 30, o.gy - 4, 26, .5, .6);
    } else if (fx.look === 'wind') blastGround(ctx, ex, ey, fx.blastR, fx.age - fx.doneAt, pal, 1);
  }
  function orbOver(ctx, fx, time) {
    if (fx.age < fx.delay) return;
    const K = KIT(), pal = PAL[fx.sty], ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
    if (!fx.done) {
      const p = (fx.age - fx.delay) * fx.speed, o = orbPos(fx, p), y = o.gy - o.h;
      if (fx.look === 'wind') {
        const wi = puffImg('wind');
        for (let q = 4; q >= 1; q--) { const b = orbPos(fx, Math.max(0, p - q * 26)); stamp(ctx, wi, b.gx, b.gy - b.h, fx.r * (1 - q * .14), .5 - q * .08); }
        lighter(ctx); kglow(ctx, o.gx, y, fx.r * 1.8, '190,220,255', .45); normal(ctx);
        stamp(ctx, wi, o.gx, y, fx.r, .9);
        K.spin(ctx, windSwirl(), o.gx, y, fx.r * 1.1, time * 14, .85);
        ctx.strokeStyle = 'rgba(80,140,230,.6)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(o.gx, y, fx.r * .95, 0, TAU); ctx.stroke();
      } else {
        // the streak of chakra back to the mouth, then the ball itself
        const s0 = orbPos(fx, 0), fade = 1 - win(p, 0, fx.len * .9) * .6;
        lighter(ctx);
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(170,80,255,${.35 * fade})`; ctx.lineWidth = fx.r * 1.6;
        ctx.beginPath(); ctx.moveTo(s0.gx, s0.gy - s0.h); ctx.lineTo(o.gx, y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,220,255,${.5 * fade})`; ctx.lineWidth = fx.r * .35; ctx.stroke();
        kglow(ctx, o.gx, y, fx.r * 3.2, pal.rgb, .65);
        normal(ctx);
        ctx.fillStyle = 'rgba(190,140,255,.45)'; ctx.beginPath(); ctx.arc(o.gx, y, fx.r + 3, 0, TAU); ctx.fill();
        ctx.drawImage(bijuuImg(), o.gx - fx.r, y - fx.r, fx.r * 2, fx.r * 2);
        lighter(ctx); K.spin(ctx, bijuuSwirl(), o.gx, y, fx.r * 1.05, -time * 12, .28); kglow(ctx, o.gx - fx.r * .3, y - fx.r * .3, fx.r * .5, '255,230,255', .5, true); normal(ctx);
      }
      return;
    }
    const u = fx.age - fx.doneAt;
    if (fx.look === 'wind') {
      if (u < .9) K.fx.windDome(ctx, ex, ey, fx.blastR, u / .9, 1 - u / .9, time);
      blastOver(ctx, ex, ey, fx.blastR * .7, u, PAL.sand, fx.seed, 7);
    } else {
      lighter(ctx);
      if (u < .45) kglow(ctx, ex, ey - 60, fx.blastR * (1.6 + u * 3), '255,225,255', 1 - u / .45, true);
      normal(ctx);
      if (u < 1.9) K.fx.beastBlast(ctx, ex, ey, fx.blastR, u / 1.9, 1 - win(u, 1.3, 1.9), time, fx.seed);
    }
  }

  function beamEnd(fx) { return [fx.x + Math.cos(fx.a) * fx.len, fx.y + Math.sin(fx.a) * fx.len]; }
  function beamGround(ctx, fx, time) {
    const pal = PAL[fx.sty];
    if (fx.age < fx.delay) { teleLine(ctx, fx.x, fx.y, fx.a, fx.len, fx.hw, fx.age / fx.delay, pal.tele, time); return; }
    const u = fx.age - fx.delay, [ex, ey] = beamEnd(fx), fade = 1 - win(u, fx.dur, fx.dur + 1.3), grow = eOut(u / .15);
    ctx.strokeStyle = `rgba(${pal.scorch},${.5 * fade})`; ctx.lineWidth = fx.hw * 1.7 * grow; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + (ex - fx.x) * grow, fx.y + (ey - fx.y) * grow); ctx.stroke();
  }
  function beamOver(ctx, fx, time) {
    const u = fx.age - fx.delay;
    if (u < 0 || u > fx.dur) return;
    const pal = PAL[fx.sty], [ex, ey] = beamEnd(fx), grow = eOut(u / .12), fade = 1 - win(u, fx.dur - .25, fx.dur);
    const w = fx.hw * (.5 + .5 * grow) * fade * (1 + .06 * Math.sin(time * 50)), sx = fx.x, sy = fx.y - fx.h;
    const tx = sx + (ex - sx) * grow, ty = sy + (ey - 24 - sy) * grow;
    ctx.lineCap = 'round';
    lighter(ctx);
    ctx.strokeStyle = `rgba(${pal.rgb},.32)`; ctx.lineWidth = w * 2.6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    normal(ctx);
    const blobs = puffImg(pal.puff), n = 9, dx = tx - sx, dy = ty - sy;
    if (fx.look === 'ink') {
      ctx.strokeStyle = '#120a18'; ctx.lineWidth = w * 1.7; ctx.stroke();
      ctx.strokeStyle = '#2c1c3c'; ctx.lineWidth = w * .9; ctx.stroke();
      for (let j = 0; j < n; j++) { const k = ((j / n) + u * 2.4) % 1; stamp(ctx, blobs, sx + dx * k, sy + dy * k + Math.sin(j * 3 + time * 9) * w * .3, w * (.7 + hsh(j) * .4), fade); }
      ctx.strokeStyle = `rgba(210,180,255,${.45 * fade})`; ctx.lineWidth = Math.max(1.5, w * .12);
      ctx.beginPath(); ctx.moveTo(sx, sy - w * .45); ctx.lineTo(tx, ty - w * .45); ctx.stroke();
    } else {
      lighter(ctx);
      ctx.strokeStyle = `rgba(${pal.rgb},.75)`; ctx.lineWidth = w * 1.3; ctx.stroke();
      ctx.strokeStyle = `rgba(${pal.hot},.9)`; ctx.lineWidth = w * .45; ctx.stroke();
      normal(ctx);
      for (let j = 0; j < n; j++) { const k = ((j / n) + u * 2.8) % 1; stamp(ctx, blobs, sx + dx * k, sy + dy * k + Math.sin(j * 3 + time * 9) * w * .4, w * (.45 + hsh(j) * .3), .75 * fade); }
    }
    // mouth flare and the splash where it lands
    lighter(ctx); kglow(ctx, sx, sy, w * 2.4, pal.hot, .7 * fade, true); kglow(ctx, tx, ty, w * 3, pal.rgb, .5 * fade); normal(ctx);
    for (let j = 0; j < 6; j++) { const a = j * TAU / 6 + time * 4; stamp(ctx, blobs, tx + Math.cos(a) * w * 1.3, ty + Math.sin(a) * w * .6 - j * 3, w * .9, fade * .9); }
  }

  function ringGround(ctx, fx, time) {
    const pal = PAL[fx.sty];
    if (fx.age < fx.delay) {
      const k = fx.age / fx.delay, pulse = .55 + Math.sin(time * 18) * .2;
      ctx.fillStyle = `rgba(${pal.tele},${.1 + .08 * k})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r0, 0, TAU); ctx.arc(fx.x, fx.y, fx.r1, 0, TAU, true); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(24,8,8,.28)'; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${pal.tele},${pulse + .25 * k})`; ctx.stroke();
      ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.strokeStyle = `rgba(220,255,230,${.7})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r1, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${pal.tele},.8)`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r0 - (fx.r0 - fx.r1) * eOut(k) * .15, 0, TAU); ctx.stroke();
      return;
    }
    const k = c01((fx.age - fx.delay) / fx.dur), r = fx.r0 + (fx.r1 - fx.r0) * k, fade = 1 - win(fx.age - fx.delay - fx.dur, 0, .4);
    ctx.fillStyle = `rgba(${pal.scorch},${.3 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r0, 0, TAU); ctx.arc(fx.x, fx.y, Math.max(1, r), 0, TAU, true); ctx.fill();
    ctx.strokeStyle = `rgba(30,80,220,${.35 * fade})`; ctx.lineWidth = 30; ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, TAU); ctx.stroke();
  }
  function ringOver(ctx, fx, time) {
    const u = fx.age - fx.delay;
    if (u < 0) return;
    const k = c01(u / fx.dur), r = fx.r0 + (fx.r1 - fx.r0) * k, fade = 1 - win(u - fx.dur, 0, .4), n = Math.round(clamp(r / 13, 10, 30)), f = Math.floor(time * 12);
    if (fade <= 0) return;
    lighter(ctx);
    for (let j = 0; j < 6; j++) { const a = j * TAU / 6 + time; kglow(ctx, fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r - 30, 70, '60,130,255', .35 * fade); }
    normal(ctx);
    for (let j = 0; j < n; j++) {
      const a = j * TAU / n + time * .6, h = (64 + 18 * Math.sin(time * 9 + j * 1.3)) * fade * (.6 + .4 * eOut(u * 4));
      tongue(ctx, flameImg((j + f) % 6, true), fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, h * .55, h);
    }
    if (u > fx.dur) blastOver(ctx, fx.x, fx.y, fx.r1 * 1.6, (u - fx.dur) * 2, PAL.blue, 3, 6);
  }

  function domeGround(ctx, fx, time) {
    const pal = PAL[fx.sty];
    if (fx.age < fx.delay) { teleCircle(ctx, fx.x, fx.y, fx.r, fx.age / fx.delay, pal.tele, time); return; }
    const u = fx.age - fx.delay;
    blastGround(ctx, fx.x, fx.y, fx.r * .85, u, pal, 1.5);
    if (u > .1 && u < .8) KIT().fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.5, (u - .1) / .7, 1 - (u - .1) / .7, '255,255,255');
  }
  function domeOver(ctx, fx, time) {
    const u = fx.age - fx.delay;
    if (u < 0 || u > 1.5) return;
    const img = puffImg('steamW'), R = fx.r * eOut(u * 2.4), fade = 1 - win(u, .5, 1.5);
    lighter(ctx);
    if (u < .3) kglow(ctx, fx.x, fx.y - 60, fx.r * (.8 + u * 2), '255,255,255', 1 - u / .3, true);
    kglow(ctx, fx.x, fx.y - R * .3, R * 1.2, '255,200,180', .35 * fade, false, .7); kglow(ctx, fx.x, fx.y - R * .2, R * .8, '255,80,50', .5 * fade, false, .6);
    normal(ctx);
    for (const [rows, phi] of [[22, 0], [16, .55], [9, 1.05]]) {
      const rr = R * Math.cos(phi), hh = R * Math.sin(phi) * .75;
      for (let j = 0; j < rows; j++) {
        const a = j * TAU / rows + phi + time * .3;
        stamp(ctx, img, fx.x + Math.cos(a) * rr, fx.y + Math.sin(a) * rr * .5 - hh - u * 20, fx.r * (.13 + .06 * u) * (1.2 - phi * .3), fade * (.9 - phi * .25));
      }
    }
    stamp(ctx, img, fx.x, fx.y - R * .78 - u * 30, fx.r * .2, fade * .8);
  }

  function fieldGround(ctx, fx, time) {
    if (fx.look !== 'ink' || fx.age < fx.delay) return;
    const u = fx.age - fx.delay, r = fx.r * eOut(u * 1.8), fade = 1 - win(u, fx.dur - .6, fx.dur);
    if (fade <= 0 || r < 2) return;
    ctx.fillStyle = `rgba(16,8,24,${.78 * fade})`;
    ctx.beginPath();
    for (let j = 0; j <= 40; j++) { const a = j / 40 * TAU, rr = r * (.94 + .06 * Math.sin(a * 5 + fx.x + time * 1.5)); j ? ctx.lineTo(fx.x + Math.cos(a) * rr, fx.y + Math.sin(a) * rr) : ctx.moveTo(fx.x + rr, fx.y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(150,100,210,${.5 * fade})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = `rgba(190,160,240,${.22 * fade})`; ctx.beginPath(); ctx.ellipse(fx.x - r * .25, fx.y - r * .3, r * .4, r * .12, -.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(180,140,230,${.5 * fade})`; ctx.lineWidth = 1.4;
    for (let j = 0; j < 4; j++) { const ph = (time * .7 + hsh(j + fx.y)) % 1, a = hsh(j * 3 + fx.x) * TAU, d = r * .6 * hsh(j * 7); ctx.beginPath(); ctx.ellipse(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, 4 + ph * 14, (4 + ph * 14) * .5, 0, 0, TAU); ctx.stroke(); }
  }
  function fieldOver(ctx, fx, time) {
    if (fx.look !== 'mist' || fx.age < fx.delay) return;
    const u = fx.age - fx.delay, fade = c01(u * 2) * (1 - win(u, fx.dur - 1, fx.dur)), img = KIT().puff('poof');
    for (let j = 0; j < 9; j++) {
      const a = hsh(j * 2.1 + fx.x) * TAU + time * .15, d = fx.r * (.2 + .8 * hsh(j * 3.3 + fx.y)) * (.6 + .4 * eOut(u));
      stamp(ctx, img, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * .5 - 30, fx.r * (.35 + .1 * Math.sin(time + j)), fade * .3);
    }
  }

  function slashGround(ctx, fx, time) {
    const pal = PAL[fx.sty];
    if (fx.age < fx.delay) { teleSector(ctx, fx.x, fx.y, fx.a, fx.half, fx.reach, fx.age / fx.delay, pal.tele, time); return; }
    const u = fx.age - fx.delay, fade = 1 - win(u, .8, 1.5);
    ctx.strokeStyle = `rgba(10,16,50,${.5 * fade})`; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (let c = 0; c < 3; c++) { const R = fx.reach * (.5 + c * .2); ctx.beginPath(); ctx.arc(fx.x, fx.y, R, fx.a - fx.half * .7, fx.a + fx.half * .7); ctx.stroke(); }
  }
  // Three blue-fire claw crescents raking across the cone, one after another.
  function slashOver(ctx, fx, time) {
    const u = fx.age - fx.delay;
    if (u < 0 || u > .7) return;
    for (let c = 0; c < 3; c++) {
      const uc = (u - c * .07) / .3;
      if (uc <= 0 || uc >= 1.6) continue;
      const R = fx.reach * (.5 + c * .2), sw = eOut(uc), a0 = fx.a - fx.half, a1 = a0 + fx.half * 2 * sw, al = 1 - win(uc, .8, 1.6);
      const cx = fx.x, cy = fx.y - 40, T = 30 + c * 6;
      ctx.beginPath();
      for (let q = 0; q <= 14; q++) { const a = a0 + (a1 - a0) * q / 14; ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
      for (let q = 14; q >= 0; q--) { const a = a0 + (a1 - a0) * q / 14, rr = R - T * Math.sin(Math.PI * q / 14) * (.4 + .6 * q / 14); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.closePath();
      ctx.fillStyle = `rgba(30,90,240,${.85 * al})`; ctx.fill();
      ctx.strokeStyle = `rgba(140,200,255,${al})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = `rgba(245,252,255,${al})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R - 3, a0 + (a1 - a0) * .2, a1); ctx.stroke();
      lighter(ctx); kglow(ctx, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, 60, '90,160,255', al, true); normal(ctx);
    }
  }

  function cloneGround(ctx, fx, time) {
    const pal = PAL.ink;
    if (fx.age < fx.slam) teleCircle(ctx, fx.tx, fx.ty, fx.r, fx.age / fx.slam, pal.tele, time);
    else blastGround(ctx, fx.tx, fx.ty, fx.r, fx.age - fx.slam, pal, 1.3);
    if (fx.age > fx.appear * .5) {
      const a = c01((fx.age - fx.appear * .5) * 3) * (1 - win(fx.age, fx.end - .4, fx.end));
      ctx.fillStyle = `rgba(16,8,24,${.7 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 2, 70, 26, 0, 0, TAU); ctx.fill();
    }
  }
  function cloneOver(ctx, fx, time) {
    if (fx.age < fx.appear) return;
    const u = fx.age - fx.appear, a = c01(u * 4) * (1 - win(fx.age, fx.end - .45, fx.end)), f = fx.tx >= fx.x ? 1 : -1;
    if (u < .5) blastOver(ctx, fx.x, fx.y, 110, u * 2, PAL.ink, fx.cz.pulse + 1, 7);
    if (a <= .02) return;
    // the tentacle lashes from the clone onto the target
    const pre = fx.slam - fx.age;
    const bx = fx.x + f * 30, by = fx.y - 10;
    if (pre > 0 && pre < .45) tentacleShape(ctx, bx, by, fx.tx, fx.ty, 200 * eOut((.45 - pre) / .3), 30, a);
    else if (pre <= 0 && pre > -.6) tentacleShape(ctx, bx, by, fx.tx, fx.ty, 6, 30, a * (1 - win(-pre, .3, .6)));
    if (pre <= 0 && pre > -1) blastOver(ctx, fx.tx, fx.ty, fx.r, -pre, PAL.ink, fx.cz.pulse + 9, 9);
    ctx.save(); ctx.globalAlpha = a * .92; ctx.translate(fx.x, fx.y); ctx.scale(f * .6, .6);
    ART.gyuki(ctx, time + fx.cz.pulse, fx.cz);
    ctx.restore();
    lighter(ctx); kglow(ctx, fx.x, fx.y - 60, 90, '150,90,210', .3 * a); normal(ctx);
  }

  function chargeOver(ctx, z, fx, time) {
    if (fx.age >= fx.delay || z.health <= 0) return;
    const k = fx.age / fx.delay, m = members[z.beastId], f = facingOf(z), lift = z.tb.lift * 110;
    const x = z.x + f * (m.mouth[0] + 16), y = z.y + 3 + m.mouth[1] - lift, r = 6 + 38 * eOut(k), K = KIT();
    lighter(ctx);
    // red and blue chakra streaming in from all around, then compressing into black
    for (let i = 0; i < 16; i++) {
      const ph = (time * 1.6 + hsh(i * 3.7)) % 1, a = hsh(i * 1.3) * TAU + time * 2, d = r + 170 * (1 - ph) * (1 - k * .35);
      kglow(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * .75, 8 + 6 * ph, i % 2 ? '255,70,90' : '90,140,255', .8 * ph);
    }
    ctx.strokeStyle = `rgba(235,190,255,${.25 + .4 * k})`; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ph = (time * 2.4 + hsh(i * 5.1)) % 1, a = i * TAU / 10 + hsh(i) * .4, d0 = r * 1.2 + 220 * (1 - ph), d1 = d0 + 40 * (1 - ph);
      ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0 * .75); ctx.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1 * .75);
    }
    ctx.stroke();
    kglow(ctx, x, y, r * 3.4, '170,80,255', .5 + .3 * k);
    kglow(ctx, z.x, z.y, 150 + 60 * k, '170,80,255', .35 * k, false, .4);
    normal(ctx);
    const shake = k > .7 ? (Math.random() - .5) * 3 * k : 0;
    ctx.fillStyle = 'rgba(200,150,255,.5)'; ctx.beginPath(); ctx.arc(x + shake, y, r + 3, 0, TAU); ctx.fill();
    ctx.drawImage(bijuuImg(), x + shake - r, y - r, r * 2, r * 2);
    lighter(ctx);
    K.spin(ctx, bijuuSwirl(), x + shake, y, r * 1.15, time * 10, .3);
    kglow(ctx, x - r * .3, y - r * .3, r * .5, '255,235,255', .55, true);
    normal(ctx);
  }

  function trailGround(ctx, st, time) {
    for (const p of st.trail) {
      const u = p.age / .6, a = 1 - u;
      switch (p.look) {
        case 'steam': stamp(ctx, puffImg('steamW'), p.x, p.y - 40 - u * 40, 34 + u * 34, a * .75); break;
        case 'mist': stamp(ctx, KIT().puff('poof'), p.x, p.y - 30, 40 + u * 40, a * .45); break;
        case 'blue': tongue(ctx, flameImg(Math.floor(p.seed + time * 10) % 6, true), p.x, p.y, 36 * a, 80 * a); break;
        case 'lava': stamp(ctx, KIT().puff('fire'), p.x, p.y - 30 - u * 30, 30 * a + 8, a); break;
        case 'powder':
          lighter(ctx); kglow(ctx, p.x, p.y - 80 + u * 30, 30 * a + 6, '255,200,90', a * .8); normal(ctx);
          ctx.fillStyle = `rgba(255,240,170,${a})`; ctx.fillRect(p.x + Math.sin(p.seed) * 30, p.y - 60 + u * 40, 3, 3); break;
      }
    }
  }

  function comboGround(ctx, z, st, time) {
    const c = st.combo;
    if (!c || c.phase !== 'aim') return;
    const pal = PAL[c.sty || (c.trail === 'blue' ? 'blue' : c.trail === 'lava' ? 'lava' : c.trail === 'mist' ? 'water' : 'steam')];
    const k = c01(c.t / c.aim), len = Math.hypot(c.tx - z.x, c.ty - z.y), a = Math.atan2(c.ty - z.y, c.tx - z.x);
    if (c.lift) teleCircle(ctx, c.tx, c.ty, c.endR, k, pal.tele, time);
    else { teleLine(ctx, z.x, z.y, a, len, c.hw || 60, k, pal.tele, time); if (c.endR) teleCircle(ctx, c.tx, c.ty, c.endR, k, pal.tele, time); }
  }

  // ---------------------------------------------------------------- public drawing
  function drawGround(ctx, z, time) {
    const st = z.tb, m = members[z.beastId];
    if (!st || !m) return;
    ctx.save();
    if (z.health > 0 && (z.beastWindup > 0 || st.combo)) {
      // chakra flaring under the beast while it gathers a jutsu
      const rgb = rgbOf(m.accent);
      lighter(ctx); kglow(ctx, z.x, z.y, 120, rgb, .4, false, .42); normal(ctx);
      ctx.strokeStyle = `rgba(${rgb},.55)`; ctx.lineWidth = 3; ctx.setLineDash([18, 14]); ctx.lineDashOffset = -time * 60;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, 96, 40, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const fx of st.fx) {
      switch (fx.kind) {
        case 'spots': spotsGround(ctx, fx, time); break;
        case 'wave': waveGround(ctx, fx, time); break;
        case 'orb': orbGround(ctx, fx, time); break;
        case 'beam': beamGround(ctx, fx, time); break;
        case 'ring': ringGround(ctx, fx, time); break;
        case 'dome': domeGround(ctx, fx, time); break;
        case 'field': fieldGround(ctx, fx, time); break;
        case 'slash': slashGround(ctx, fx, time); break;
        case 'clone': cloneGround(ctx, fx, time); break;
        case 'blast': blastGround(ctx, fx.x, fx.y, fx.r, fx.age, PAL[fx.sty], 1.3); break;
      }
    }
    if (z.health > 0) comboGround(ctx, z, st, time);
    trailGround(ctx, st, time);
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.tb;
    if (!st || !members[z.beastId]) return;
    ctx.save();
    ctx.lineJoin = 'round';
    for (const fx of st.fx) {
      switch (fx.kind) {
        case 'spots': spotsOver(ctx, fx, time); break;
        case 'wave': waveOver(ctx, fx, time); break;
        case 'orb': orbOver(ctx, fx, time); break;
        case 'beam': beamOver(ctx, fx, time); break;
        case 'ring': ringOver(ctx, fx, time); break;
        case 'dome': domeOver(ctx, fx, time); break;
        case 'field': fieldOver(ctx, fx, time); break;
        case 'slash': slashOver(ctx, fx, time); break;
        case 'clone': cloneOver(ctx, fx, time); break;
        case 'charge': chargeOver(ctx, z, fx, time); break;
        case 'blast': blastOver(ctx, fx.x, fx.y, fx.r, fx.age, PAL[fx.sty], fx.seed, 10); break;
      }
    }
    ctx.globalAlpha = 1; normal(ctx);
    ctx.restore();
  }

  // Telegraphs now live on the ground layer (drawGround), so they stay visible off-body.
  function drawTelegraph() {}

  function draw(ctx, z, time) {
    const m = members[z.beastId];
    if (!m) return;
    const st = z.tb, facing = facingOf(z);
    const dead = z.health <= 0;
    const alpha = dead ? Math.max(0, Math.min(1, z.deathTimer / 1.2)) : 1;
    if (alpha <= 0) return;
    const lift = st ? st.lift * 110 : 0;
    // Ground shadow under the beast (shrinks while Chōmei is high in the air).
    const fly = (z.beastId === 'chomei' ? .7 : 1) * (1 - lift / 300);
    ctx.fillStyle = 'rgba(16,10,20,.22)';
    ctx.beginPath(); ctx.ellipse(z.x, z.y + 3, 74 * fly, 23 * fly, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(z.x + 4, z.y + 3, 50 * fly, 14 * fly, 0, 0, TAU); ctx.fill();
    const rolling = st && st.combo && st.combo.roll && st.combo.phase === 'go';
    if (rolling) {
      // Isobu curled into its spiked shell, rolling through everything in its path.
      const ca = Math.cos(st.combo.a), sa = Math.sin(st.combo.a), wi = puffImg('deep');
      for (let j = 0; j < 4; j++) {
        const ph = (time * 3 + j / 4) % 1;
        stamp(ctx, wi, z.x - ca * (40 + ph * 70) + (j % 2 ? -sa : sa) * 40 * ph, z.y - 12 - ph * 30 - sa * (40 + ph * 70), 20 + ph * 16, (1 - ph) * .8);
      }
      ctx.save(); ctx.translate(z.x, z.y - 70); ctx.rotate(st.rollA * facing);
      ctx.drawImage(isoBallImg(), -80, -80, 160, 160);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(z.x, z.y + 3 - lift + (dead ? (1 - alpha) * 30 : 0));
      ctx.scale(facing, 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      try { ART[z.beastId](ctx, time + (z.seed || 0), z); } finally { ctx.restore(); }
    }
    if (z.hitFlash > 0 && !dead) {
      // Soft white bloom over the body (cached radial sprite, additive).
      ctx.save(); ctx.translate(z.x, z.y - lift - m.height * .45); ctx.scale(1, m.height / 130);
      glow(ctx, 0, 0, 82, 'rgba(255,255,255,1)', Math.min(.75, z.hitFlash * 5));
      ctx.restore();
    }
    if (dead) return;
    // Name plate and the thick health bar above the beast.
    const top = z.y - lift - m.height - 16, barW = 150;
    ctx.fillStyle = 'rgba(8,6,12,.85)'; ctx.fillRect(z.x - barW / 2 - 2, top - 2, barW + 4, 11);
    ctx.fillStyle = m.accent; ctx.fillRect(z.x - barW / 2, top, barW * Math.max(0, z.health / z.maxHealth), 7);
    ctx.font = '900 13px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#0c0810'; ctx.strokeText(m.name, z.x, top - 6);
    ctx.fillStyle = '#fff4e2'; ctx.fillText(m.name, z.x, top - 6);
    if (z.beastWindup > 0 && z.beastLabel) {
      ctx.font = '900 15px sans-serif';
      ctx.strokeText(z.beastLabel, z.x, top - 24);
      ctx.fillStyle = z.beastSkill === 'bomb' ? '#d9a2ff' : m.accent; ctx.fillText(z.beastLabel, z.x, top - 24);
    }
  }

  window.TailedBeasts = { members, order, pick, update, draw, drawTelegraph, drawGround, drawOverlay, moves };
})();
