/* Fourth Great Ninja War: the Allied Shinobi Forces fighting beside the player.
 * The five Kage (Tsunade, Gaara, Mei, Ay, Ōnoki) and ~80 Allied Shinobi: AI, anime jutsu and their VFX.
 * Allies are invulnerable; they only act on the world through the api the game hands to update().
 *
 * window.WarAllies = { createForces, update, blast, drawAlly, drawGround, drawOverlay, tuning, KAGE, SQUADS }
 * All state lives in `state` ({ allies, fx, timers, ... }). Effects use window.VFXKit (skill-vfx.js)
 * and characters are window.AnimeSprites bodies (missing sprite ids fall back to existing ones). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const c01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const eOut = t => 1 - Math.pow(1 - c01(t), 3);
  const eIn = t => c01(t) * c01(t);
  const eInOut = t => { t = c01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const eBack = t => { t = c01(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * c01(t));
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const alive = z => !!z && z.health > 0;
  const kit = () => window.VFXKit;
  const sprites = () => window.AnimeSprites;

  // Damage knobs for the lead: the five Kage average ~110-200 dps each against a single boss.
  const tuning = { kageDamage: 1, shinobiDamage: 1, shinobiVsBoss: .16, cutIns: true, cutInGap: 6 };

  // ------------------------------------------------------------------ roster
  const KAGE_ORDER = ['tsunade', 'gaara', 'mei', 'ay', 'onoki'];
  const KAGE = {
    tsunade: { name: 'TSUNADE · HOKAGE', sprite: 'tsunade', fallback: 'konan', color: '#8fe27a', rgb: '150,235,120', speed: 300, range: 85, home: [-80, -36], moves: ['katsuyu', 'tsuten', 'okasho'] },
    gaara:   { name: 'GAARA · KAZEKAGE', sprite: 'gaara', fallback: 'pain', color: '#ecc681', rgb: '236,198,129', speed: 250, range: 270, home: [80, -36], moves: ['coffin', 'tsunami', 'shuriken'] },
    mei:     { name: 'MEI · MIZUKAGE', sprite: 'mei', fallback: 'konan', color: '#ff8c52', rgb: '255,140,82', speed: 270, range: 250, home: [-124, 46], moves: ['mist', 'lava', 'dragon'] },
    ay:      { name: 'A · RAIKAGE', sprite: 'ay', fallback: 'kisame', color: '#ffe45a', rgb: '255,228,90', speed: 380, range: 90, home: [124, 46], moves: ['liger', 'lariat', 'dash'] },
    onoki:   { name: 'ŌNOKI · TSUCHIKAGE', sprite: 'onoki', fallback: 'hidan', color: '#eef3f8', rgb: '225,238,255', speed: 290, range: 300, home: [0, -104], moves: ['jinton', 'kajugan', 'fly'] }
  };
  // label (Vietnamese), jp, cooldown s, range px, cast lock s, base damage
  const MOVES = {
    tsuten:   { label: 'THỐNG THIÊN CƯỚC', jp: '痛天脚', cd: 7, range: 520, lock: 1.1, dmg: 620, cut: true },
    okasho:   { label: 'ANH HOA XUNG', jp: '桜花衝', cd: 3.4, range: 120, lock: .55, dmg: 210 },
    katsuyu:  { label: 'KHẨU TẬP · KATSUYU', jp: '口寄せ・蛞蝓', cd: 8.5, range: 0, lock: .6, heal: .08 },
    coffin:   { label: 'SA BỘC TỐNG TÁNG', jp: '砂瀑送葬', cd: 6.5, range: 540, lock: 1.4, dmg: 480, cut: true },
    tsunami:  { label: 'LƯU SA BỘC LƯU', jp: '流砂瀑流', cd: 7.5, range: 400, lock: .8, dmg: 240 },
    shuriken: { label: 'SA THỦ LÝ KIẾM', jp: '砂手裏剣', cd: 2.6, range: 480, lock: .4, dmg: 34 },
    shield:   { label: 'SA THUẪN', jp: '砂の盾', cd: 7 },
    lava:     { label: 'DUNG ĐỘN · DUNG QUÁI', jp: '溶遁・溶怪の術', cd: 5, range: 440, lock: .7, dmg: 42, cut: true },
    mist:     { label: 'PHÍ ĐỘN · XẢO VỤ', jp: '沸遁・巧霧の術', cd: 8, range: 430, lock: .6, dmg: 28 },
    dragon:   { label: 'THỦY ĐỘN · THỦY LONG ĐẠN', jp: '水遁・水龍弾の術', cd: 5.5, range: 480, lock: 1.1, dmg: 270 },
    liger:    { label: 'LIGER BOMB', jp: '雷我爆弾', cd: 6.5, range: 430, lock: .9, dmg: 560, cut: true },
    lariat:   { label: 'LARIAT', jp: 'ラリアット', cd: 4.2, range: 380, lock: .6, dmg: 220 },
    dash:     { label: '', jp: '', cd: 2.6, range: 900, minRange: 300, lock: .3, dmg: 90 },
    jinton:   { label: 'TRẦN ĐỘN · NGUYÊN GIỚI BÁC LY', jp: '塵遁・原界剥離の術', cd: 15, range: 560, lock: 2.2, dmg: 1500, cut: true },
    kajugan:  { label: 'GIA TRỌNG NHAM CHI THUẬT', jp: '加重岩の術', cd: 4.5, range: 430, lock: .8, dmg: 280 },
    fly:      { label: 'SIÊU KHINH TRỌNG NHAM', jp: '超軽重岩の術', cd: 3, range: 1400, minRange: 440, lock: .2 }
  };
  const SQUADS = [
    { id: 'konoha', sprite: 'shinobi_ally', fallback: 'walker', n: 22, element: 'fire', color: '#7cc957' },
    { id: 'suna', sprite: 'shinobi_ally_suna', fallback: 'suna_ninja', n: 14, element: 'wind', color: '#e6bf78' },
    { id: 'kumo', sprite: 'shinobi_ally_kumo', fallback: 'kumo_ninja', n: 14, element: 'lightning', color: '#ffe96a' },
    { id: 'kiri', sprite: 'shinobi_ally_kiri', fallback: 'kiri_ninja', n: 14, element: 'water', color: '#82d2ff' },
    { id: 'iwa', sprite: 'shinobi_ally_iwa', fallback: 'iwa_ninja', n: 14, element: 'earth', color: '#d29a68' }
  ];
  const SHINOBI = { slash: 28, fire: 70, wind: 36, lightning: 85, water: 60, earth: 72, kunai: 14 };

  const SAND = { dark: '#8d6738', base: '#cfa866', mid: '#ddbd80', light: '#f4e2b4' };

  // ------------------------------------------------------------------ helpers
  const leaderOf = (api, state) => api.leader || (api.players && api.players[0]) || state.origin || { x: 0, y: 0, angle: 0 };
  const callApi = (api, name, ...args) => { const f = api && api[name]; return typeof f === 'function' ? f(...args) : undefined; };

  function hurt(api, z, dmg, angle) {
    if (alive(z) && dmg > 0) api.hurt(z, Math.round(dmg), angle || 0);
  }
  // Hits every enemy within r of (x, y). opts: { max, push, from: [x,y], cone: [angle, half], skip, scale(z) }
  function area(api, x, y, r, dmg, opts = {}) {
    let hits = 0;
    const max = opts.max || 40;
    api.forEachEnemyNear(x, y, r, z => {
      if (hits >= max) return false;
      if (!alive(z) || z === opts.skip) return;
      if (opts.cone) {
        const a = Math.atan2(z.y - y, z.x - x), d = Math.hypot(z.x - x, z.y - y);
        if (d > z.r + 30 && Math.abs(angDiff(a, opts.cone[0])) > opts.cone[1]) return;
      }
      const fx = opts.from ? opts.from[0] : x, fy = opts.from ? opts.from[1] : y;
      const away = opts.angle ?? Math.atan2(z.y - fy, z.x - fx);
      hurt(api, z, dmg * (opts.scale ? opts.scale(z) : 1), away);
      if (opts.push && alive(z) && api.push) {
        const p = z.type === 'boss' ? opts.push * .15 : opts.push;
        api.push(z, Math.cos(away) * p, Math.sin(away) * p);
      }
      hits++;
    });
    return hits;
  }
  const kd = v => v * tuning.kageDamage;

  function addFx(state, fx, cheap) {
    if (cheap && state.fx.length > 230) return null;
    fx.t = 0; fx.seed = fx.seed ?? Math.random() * 100;
    state.fx.push(fx);
    return fx;
  }
  function later(state, delay, fn) { state.timers.push({ t: delay, fn }); }

  function cutIn(state, api, move, x, y, rgb) {
    if (!tuning.cutIns || state.cutInCd > 0 || !move.cut) return;
    state.cutInCd = tuning.cutInGap;
    callApi(api, 'cutIn', move.label, move.jp, rgb, x, y, false);
  }
  function callout(ally, move) {
    if (move.label) ally.call = { text: move.label, t: 1.4, max: 1.4 };
  }
  function pose(ally, frame, t) { ally.pose = frame; ally.poseT = t; }

  function place(ally, x, y, api) {
    for (let ring = 0; ring < 6; ring++) {
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * TAU + ring, d = ring * 26;
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        if (!api.blocked || !api.blocked(px, py, ally.r)) { ally.x = px; ally.y = py; return; }
        if (ring === 0) break;
      }
    }
    ally.x = x; ally.y = y;
  }

  function stepToward(ally, tx, ty, speed, dt, api, stop = 6) {
    const dx = tx - ally.x, dy = ty - ally.y, d = Math.hypot(dx, dy);
    if (d <= stop) { ally.moving = false; return 0; }
    const step = Math.min(d - stop, speed * dt);
    const ox = ally.x, oy = ally.y;
    api.move(ally, dx / d * step, dy / d * step);
    const moved = Math.hypot(ally.x - ox, ally.y - oy);
    ally.moving = moved > step * .2;
    ally.stuck = moved < step * .2 ? (ally.stuck || 0) + dt : 0;
    return moved;
  }

  // Shunshin back to the formation when an ally is stranded (walls) or left far behind.
  function shunshin(ally, x, y, api, state) {
    addFx(state, { kind: 'poof', x: ally.x, y: ally.y, dur: .5, r: ally.kind === 'kage' ? 30 : 22 }, true);
    place(ally, x, y, api);
    addFx(state, { kind: 'poof', x: ally.x, y: ally.y, dur: .5, r: ally.kind === 'kage' ? 30 : 22 }, true);
    ally.stuck = 0;
  }

  // ------------------------------------------------------------------ creation
  function createForces(state, x, y, api) {
    state.allies = state.allies || [];
    state.fx = state.fx || [];
    state.allies.length = 0; state.fx.length = 0;
    state.timers = []; state.cutInCd = 1.2; state.katsuyuOut = false; state.hpSeen = [];
    state.origin = { x, y, angle: 0 };
    api = api || {};
    let i = 0;
    for (const id of KAGE_ORDER) {
      const d = KAGE[id];
      const ally = { kind: 'kage', id, name: d.name, sprite: d.sprite, fallback: d.fallback, x, y, r: 14,
        hx: d.home[0], hy: d.home[1], angle: -Math.PI / 2, moving: false, target: null, seek: i * .06,
        lock: .6 + i * .3, cds: {}, pose: '', poseT: 0, lift: 0, act: null, age: -i * .14, call: null,
        stuck: 0, seed: i * 17.3 + 3, hitFlash: 0 };
      for (const m of d.moves) ally.cds[m] = (m === 'katsuyu' ? 2.5 : 1.2 + hash(i * 3 + m.length) * 2.4);
      place(ally, x + ally.hx, y + ally.hy, api);
      state.allies.push(ally); i++;
    }
    let n = 0;
    SQUADS.forEach((sq, si) => {
      // Each village holds one wedge of a loose ring around the leader, several ranks deep.
      const centre = -Math.PI / 2 + (si - 2) * .9 + Math.PI;
      for (let k = 0; k < sq.n; k++) {
        const col = k % 7, row = Math.floor(k / 7);
        const a = centre + (col - 3 + (row % 2) * .5) * .12 + (hash(n * 7.1) - .5) * .06;
        const rr = 170 + row * 44 + hash(n * 3.3) * 18;
        const ally = { kind: 'shinobi', id: sq.id + k, squad: si, element: sq.element, sprite: sq.sprite, fallback: sq.fallback,
          color: sq.color, x, y, r: 12, hx: Math.cos(a) * rr, hy: Math.sin(a) * rr * .8, angle: a + Math.PI,
          moving: false, target: null, seek: hash(n) * .5, slashCd: hash(n * 1.7), jutsuCd: 1.5 + hash(n * 2.9) * 4,
          pose: '', poseT: 0, lift: 0, age: -.25 - n * .025, stuck: 0, seed: n * 5.17 + 1,
          speed: 225 + hash(n * 4.1) * 50, bias: (hash(n * 9.7) - .5) * 1.4 };
        place(ally, x + ally.hx, y + ally.hy, api);
        state.allies.push(ally); n++;
      }
    });
    return state.allies;
  }

  // ------------------------------------------------------------------ Kage casts
  const CAST = {
    // Tsūtenkyaku: she leaps high and drops her heel on the target.
    tsuten(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      a.act = { kind: 'leap', t: 0, dur: .9, x0: a.x, y0: a.y, tx: t.x - Math.cos(ang) * t.r * .5, ty: t.y - Math.sin(ang) * t.r * .5, target: t };
      pose(a, 'raise', .3);
    },
    // Ōkashō: a chakra-loaded punch; the shock wave rolls out in a cone of cherry blossoms.
    okasho(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      a.angle = ang; pose(a, 'attack', .4);
      const x = a.x + Math.cos(ang) * 18, y = a.y + Math.sin(ang) * 18;
      addFx(state, { kind: 'okasho', x, y, a: ang, r: 180, dur: 1.1 });
      area(api, x, y, 180, kd(m.dmg), { cone: [ang, .8], push: 70, from: [a.x, a.y] });
      callApi(api, 'impact', x + Math.cos(ang) * 40, y + Math.sin(ang) * 40, 90, 420, 'shockwave', ang);
      callApi(api, 'shake', 5);
    },
    // Katsuyu: the giant slug is summoned once, then her clones cling to every ninja and heal them.
    katsuyu(a, t, api, state, m) {
      pose(a, 'seal', .6);
      if (!state.katsuyuOut) {
        state.katsuyuOut = true;
        const side = Math.cos(a.angle) >= 0 ? 1 : -1;
        addFx(state, { kind: 'katsuyu', x: a.x + side * 56, y: a.y + 6, facing: side, dur: 2.7 });
        callApi(api, 'cutIn', 'KHẨU TẬP CHI THUẬT · KATSUYU', '口寄せの術・蛞蝓', '150,235,170', a.x, a.y, false);
        state.cutInCd = tuning.cutInGap;
        later(state, 1.9, (api2, st) => healAll(api2, st, m.heal));
      } else healAll(api, state, m.heal);
    },

    // Sabaku Kyū → Sabaku Sōsō: sand crawls to the target, swallows it, then Gaara clenches his fist.
    coffin(a, t, api, state, m) {
      a.act = { kind: 'stand', t: 0, dur: 1.35 };
      pose(a, 'attack', .5);
      later(state, .95, () => pose(a, 'seal', .5));
      addFx(state, { kind: 'coffin', x0: a.x, y0: a.y, x: t.x, y: t.y, ax: t.x, ay: t.y, target: t,
        R: Math.max(44, Math.min(92, (t.r || 18) + 28)), dur: 1.9, crushed: false, dmg: kd(m.dmg) });
    },
    // Ryūsa Bakuryū: a tidal wave of sand rolls out of the gourd.
    tsunami(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      a.angle = ang; pose(a, 'raise', .7); a.act = { kind: 'stand', t: 0, dur: .55 };
      addFx(state, { kind: 'tsunami', x: a.x, y: a.y, a: ang, range: 430, spread: .62, travel: 1.0, dur: 1.75, front: 0, hit: new Set(), dmg: kd(m.dmg) });
      callApi(api, 'shake', 3);
    },
    // Sand shuriken: three spinning sand stars.
    shuriken(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      a.angle = ang; pose(a, 'attack', .3);
      for (let i = -1; i <= 1; i++) {
        const tx = t.x + Math.cos(ang + Math.PI / 2) * i * 18, ty = t.y + Math.sin(ang + Math.PI / 2) * i * 18;
        const d = Math.hypot(tx - a.x, ty - a.y);
        addFx(state, { kind: 'shot', style: 'sand', x0: a.x, y0: a.y, tx, ty, curve: i * 40, dur: .18 + d / 900, hitAt: .18 + d / 900,
          hit: (api2) => { area(api2, tx, ty, 26, kd(m.dmg), { max: 3 }); } });
      }
    },

    // Yōton: Yōkai no Jutsu — globs of lava arc from her mouth and burst into burning pools.
    lava(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      a.angle = ang; pose(a, 'attack', .6); a.act = { kind: 'stand', t: 0, dur: .5 };
      const face = Math.cos(ang) >= 0 ? 1 : -1;
      for (let i = 0; i < 5; i++) {
        later(state, .08 + i * .075, (api2, st) => {
          const tt = alive(t) ? t : { x: a.x + Math.cos(ang) * 260, y: a.y + Math.sin(ang) * 260 };
          const r = i === 0 ? 0 : 30 + hash(i * 3.1 + a.seed + st.fx.length) * 55, ta = i * 2.4 + hash(i);
          const tx = tt.x + Math.cos(ta) * r, ty = tt.y + Math.sin(ta) * r * .8;
          const d = Math.hypot(tx - a.x, ty - a.y);
          addFx(st, { kind: 'lava', x0: a.x + face * 7, y0: a.y, tx, ty, h: 70 + d * .25, dur: .45 + d / 1100, hitAt: .45 + d / 1100,
            hit: (api3, st3) => {
              area(api3, tx, ty, 60, kd(m.dmg));
              addFx(st3, { kind: 'splash', x: tx, y: ty, dur: .5 });
              addFx(st3, { kind: 'puddle', x: tx, y: ty, r: 50, dur: 3.2, tick: .5, tk: .5,
                onTick: (api4, st4, f) => area(api4, f.x, f.y, f.r * .9, kd(7), { max: 12 }) });
              callApi(api3, 'impact', tx, ty, 38, 160, 'fire', 0);
            } });
        });
      }
    },
    // Futton: Kōmu — a dense acidic mist that eats through whatever stands inside.
    mist(a, t, api, state, m) {
      a.angle = Math.atan2(t.y - a.y, t.x - a.x);
      pose(a, 'seal', .6); a.act = { kind: 'stand', t: 0, dur: .45 };
      addFx(state, { kind: 'mist', x0: a.x, y0: a.y, x: t.x, y: t.y, r: 150, dur: 5, tick: .5, tk: .9,
        onTick: (api2, st, f) => { if (f.t < f.dur - .5) area(api2, f.x, f.y, f.r, kd(m.dmg), { max: 20 }); } });
    },
    // Suiton: Suiryūdan — a water dragon rises beside her and dives onto the target.
    dragon(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      a.angle = ang; pose(a, 'seal', .9); a.act = { kind: 'stand', t: 0, dur: .7 };
      const side = Math.cos(ang) >= 0 ? -1 : 1;
      const f = addFx(state, { kind: 'dragon', x0: a.x + side * 34, y0: a.y + 6, tx: t.x, ty: t.y, target: t, dur: 1.35, hitAt: .95,
        hit: (api2, st, fx) => {
          area(api2, fx.tx, fx.ty, 100, kd(m.dmg), { push: 60, from: [fx.x0, fx.y0] });
          callApi(api2, 'impact', fx.tx, fx.ty, 85, 380, 'shockwave', Math.atan2(fx.ty - fx.y0, fx.tx - fx.x0));
          callApi(api2, 'shake', 5);
        } });
      return f;
    },

    // Raiton: dashes in a blur of lightning to close the gap.
    dash(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x), d = Math.hypot(t.x - a.x, t.y - a.y);
      a.angle = ang;
      a.act = { kind: 'dash', t: 0, dur: Math.max(.12, (d - 80) / 1700), ang, speed: 1700, hit: new Set(), dmg: kd(m.dmg), x0: a.x, y0: a.y, style: 'dash' };
      pose(a, 'run', .3);
    },
    // Liger Bomb: he rushes in, hoists the enemy and slams it into the ground.
    liger(a, t, api, state, m) {
      a.angle = Math.atan2(t.y - a.y, t.x - a.x);
      a.act = { kind: 'liger', t: 0, phase: 0, target: t, x0: a.x, y0: a.y, dmg: kd(m.dmg) };
      pose(a, 'run', .3);
    },
    // Lariat: arm out, he tears straight through the line.
    lariat(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x), d = Math.hypot(t.x - a.x, t.y - a.y) + 170;
      a.angle = ang;
      a.act = { kind: 'dash', t: 0, dur: d / 1500, ang, speed: 1500, hit: new Set(), dmg: kd(m.dmg), x0: a.x, y0: a.y, style: 'lariat' };
      pose(a, 'attack', d / 1500 + .15);
    },

    // Jinton: Genkai Hakuri — a cube of Dust Release that strips everything inside down to atoms.
    jinton(a, t, api, state, m) {
      a.angle = Math.atan2(t.y - a.y, t.x - a.x);
      a.act = { kind: 'jinton', t: 0, dur: 1.35, target: t, tx: t.x, ty: t.y, dmg: kd(m.dmg) };
      pose(a, 'raise', 1.6);
    },
    // Kajūgan: a boulder made immensely heavy is shoved into the target and crushes it into the earth.
    kajugan(a, t, api, state, m) {
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      a.angle = ang; pose(a, 'attack', .5);
      const sx = a.x + Math.cos(ang) * 30, sy = a.y + Math.sin(ang) * 30;
      addFx(state, { kind: 'boulder', x0: sx, y0: sy, tx: t.x, ty: t.y, a: ang, dur: 1.3, hitAt: .62, r: 30,
        hit: (api2, st, f) => {
          area(api2, f.tx, f.ty, 85, kd(m.dmg), { push: 55, from: [f.x0, f.y0] });
          callApi(api2, 'impact', f.tx, f.ty, 80, 460, 'earth', f.a);
          callApi(api2, 'shake', 5);
        } });
    },
    // Chōkeijūgan: he makes himself weightless and flies to where he is needed.
    fly(a, t, api, state, m, dest) {
      const tx = dest ? dest.x : t.x - Math.cos(Math.atan2(t.y - a.y, t.x - a.x)) * 280;
      const ty = dest ? dest.y : t.y - Math.sin(Math.atan2(t.y - a.y, t.x - a.x)) * 280;
      a.act = { kind: 'fly', t: 0, x0: a.x, y0: a.y, tx, ty, dur: Math.max(.45, Math.hypot(tx - a.x, ty - a.y) / 560) };
      a.angle = Math.atan2(ty - a.y, tx - a.x);
    }
  };

  function healAll(api, state, fraction) {
    callApi(api, 'heal', fraction);
    const ps = api.players || [];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p || p.down) continue;
      addFx(state, { kind: 'heal', pi: i, x: p.x, y: p.y, dur: 1.9, facing: i % 2 ? -1 : 1 });
    }
  }

  // ------------------------------------------------------------------ Kage actions over time
  const ACTS = {
    stand(a, dt) { a.moving = false; return a.act.t >= a.act.dur; },
    leap(a, dt, api, state) {
      const s = a.act, k = c01(s.t / s.dur);
      if (k < .62 && alive(s.target)) {
        const ang = Math.atan2(s.target.y - s.y0, s.target.x - s.x0);
        s.tx = lerp(s.tx, s.target.x - Math.cos(ang) * s.target.r * .5, .25);
        s.ty = lerp(s.ty, s.target.y - Math.sin(ang) * s.target.r * .5, .25);
      }
      const e = eInOut(k);
      a.x = lerp(s.x0, s.tx, e); a.y = lerp(s.y0, s.ty, e);
      a.lift = 170 * Math.sin(Math.PI * Math.pow(k, .78));
      a.angle = Math.atan2(s.ty - s.y0, s.tx - s.x0);
      if (k > .55) pose(a, 'attack', .25);
      if (k < 1) return false;
      a.lift = 0;
      if (api.blocked && api.blocked(a.x, a.y, a.r)) {
        for (let i = 1; i <= 8; i++) {
          const px = lerp(s.tx, s.x0, i / 8), py = lerp(s.ty, s.y0, i / 8);
          if (!api.blocked(px, py, a.r)) { a.x = px; a.y = py; break; }
        }
      }
      const m = MOVES.tsuten;
      addFx(state, { kind: 'crater', x: s.tx, y: s.ty, r: 150, dur: 3.4, pal: 'heel' });
      area(api, s.tx, s.ty, 150, kd(m.dmg), { push: 45 });
      callApi(api, 'impact', s.tx, s.ty, 150, 780, 'crater', a.angle);
      callApi(api, 'shake', 9);
      pose(a, 'attack', .35);
      return true;
    },
    dash(a, dt, api, state) {
      const s = a.act;
      const ox = a.x, oy = a.y, step = s.speed * dt;
      api.move(a, Math.cos(s.ang) * step, Math.sin(s.ang) * step);
      a.moving = true;
      const r = s.style === 'lariat' ? 72 : 56;
      api.forEachEnemyNear(a.x, a.y, r, z => {
        if (!alive(z) || s.hit.has(z)) return;
        s.hit.add(z);
        hurt(api, z, s.dmg, s.ang);
        if (alive(z) && api.push && z.type !== 'boss') {
          const side = angDiff(Math.atan2(z.y - a.y, z.x - a.x), s.ang) > 0 ? 1 : -1;
          const pa = s.ang + side * 1.1;
          api.push(z, Math.cos(pa) * 55, Math.sin(pa) * 55);
        }
        addFx(state, { kind: 'spark', x: z.x, y: z.y, r: 34, dur: .3 }, true);
      });
      const blockedNow = Math.hypot(a.x - ox, a.y - oy) < step * .25;
      if (s.t < s.dur && !blockedNow) return false;
      addFx(state, { kind: 'ayTrail', x0: s.x0, y0: s.y0, x1: a.x, y1: a.y, dur: .55, style: s.style });
      if (s.style === 'lariat') {
        addFx(state, { kind: 'spark', x: a.x, y: a.y, r: 70, dur: .45 });
        callApi(api, 'impact', a.x, a.y, 60, 300, 'shockwave', s.ang);
        callApi(api, 'shake', 4);
      }
      return true;
    },
    liger(a, dt, api, state) {
      const s = a.act, t = s.target;
      if (s.phase === 0) {
        // rush to the target's side
        if (!alive(t)) return true;
        const ang = Math.atan2(t.y - a.y, t.x - a.x), d = Math.hypot(t.x - a.x, t.y - a.y), stop = (t.r || 16) + 12;
        a.angle = ang; a.moving = true;
        if (d > stop + 4 && s.t < .45) {
          const step = Math.min(d - stop, 1800 * dt);
          const ox = a.x, oy = a.y;
          api.move(a, Math.cos(ang) * step, Math.sin(ang) * step);
          if (Math.hypot(a.x - ox, a.y - oy) > step * .25) return false;
        }
        addFx(state, { kind: 'ayTrail', x0: s.x0, y0: s.y0, x1: a.x, y1: a.y, dur: .45, style: 'dash' });
        s.phase = 1; s.p1 = s.t; s.gx = t.x; s.gy = t.y;
        pose(a, 'raise', .5);
        return false;
      }
      const k = (s.t - s.p1) / .62;
      if (alive(t) && api.push && t.type !== 'boss') api.push(t, (s.gx - t.x) * .5, (s.gy - t.y) * .5);
      if (k < .7) { a.lift = 78 * eOut(k / .7); a.moving = false; return false; }
      if (k < 1) { a.lift = 78 * (1 - eIn((k - .7) / .3)); pose(a, 'attack', .3); return false; }
      a.lift = 0;
      const x = alive(t) ? t.x : s.gx, y = alive(t) ? t.y : s.gy;
      addFx(state, { kind: 'liger', x, y, r: 140, dur: 1.1 });
      addFx(state, { kind: 'crater', x, y, r: 125, dur: 3, pal: 'bolt' });
      area(api, x, y, 140, s.dmg, { push: 40 });
      callApi(api, 'impact', x, y, 135, 700, 'crater', a.angle);
      callApi(api, 'shake', 9);
      return true;
    },
    jinton(a, dt, api, state) {
      const s = a.act;
      a.moving = false;
      if (alive(s.target)) { s.tx = s.target.x; s.ty = s.target.y; a.angle = Math.atan2(s.ty - a.y, s.tx - a.x); }
      if (s.t < s.dur) return false;
      const hy = a.y - a.liftNow - 60;
      const R = Math.max(130, Math.min(190, ((s.target && s.target.r) || 20) * 2 + 80));
      const dmg = s.dmg;
      addFx(state, { kind: 'jinton', x0: a.x, y0: hy, x: s.tx, y: s.ty, R, dur: 2.6, hitAt: .78,
        hit: (api2, st, f) => {
          area(api2, f.x, f.y, f.R, dmg, { max: 60 });
          callApi(api2, 'impact', f.x, f.y, f.R * .8, 1200, 'crater', 0);
          callApi(api2, 'shake', 11);
        } });
      return true;
    },
    fly(a, dt, api, state) {
      const s = a.act, k = c01(s.t / s.dur);
      const e = eInOut(k);
      const nx = lerp(s.x0, s.tx, e), ny = lerp(s.y0, s.ty, e);
      a.x = nx; a.y = ny; a.moving = false; a.flying = true;
      a.lift = 52 * bell(k);
      if (k < 1) return false;
      a.flying = false; a.lift = 0;
      if (api.blocked && api.blocked(a.x, a.y, a.r)) place(a, a.x, a.y, api);
      return true;
    }
  };

  // ------------------------------------------------------------------ Kage AI
  function kageTarget(a, api, L) {
    const b = api.boss;
    if (alive(b) && Math.hypot(b.x - a.x, b.y - a.y) < 760 && Math.hypot(b.x - L.x, b.y - L.y) < 1050) return b;
    let t = api.nearestEnemy(a.x, a.y, 700);
    if (t && Math.hypot(t.x - L.x, t.y - L.y) > 950) t = null;
    return t;
  }

  function updateKage(a, dt, api, state, L) {
    const def = KAGE[a.id];
    a.lock -= dt; a.poseT -= dt; a.hitFlash = Math.max(0, a.hitFlash - dt);
    for (const k in a.cds) a.cds[k] -= dt;
    if (a.call && (a.call.t -= dt) <= 0) a.call = null;
    a.liftNow = (a.lift || 0) + (a.id === 'onoki' ? 14 : 0);
    if (a.id === 'gaara') watchShield(a, api, state);
    if (a.act) {
      a.act.t += dt;
      if (ACTS[a.act.kind](a, dt, api, state)) { a.act = null; a.moving = false; }
      return;
    }
    if ((a.seek -= dt) <= 0 || !alive(a.target)) { a.target = kageTarget(a, api, L); a.seek = .3; }
    const t = alive(a.target) ? a.target : null;
    // Tsunade's healing does not need a target.
    if (a.id === 'tsunade' && a.cds.katsuyu <= 0 && a.lock <= 0) {
      const ps = api.players || [];
      if (ps.some(p => p && !p.down && p.health < p.maxHealth * .995)) {
        const m = MOVES.katsuyu; CAST.katsuyu(a, t, api, state, m); callout(a, m);
        a.cds.katsuyu = m.cd; a.lock = m.lock;
        return;
      }
      a.cds.katsuyu = 1;
    }
    if (t) {
      const d = Math.hypot(t.x - a.x, t.y - a.y);
      // cast the first ready move in priority order
      if (a.lock <= 0) {
        for (const id of def.moves) {
          const m = MOVES[id];
          if (id === 'katsuyu' || a.cds[id] > 0 || !m.range) continue;
          if (d > m.range + t.r || (m.minRange && d < m.minRange)) continue;
          CAST[id](a, t, api, state, m);
          callout(a, m);
          cutIn(state, api, m, a.x, a.y, def.rgb);
          a.cds[id] = m.cd * (.9 + Math.random() * .2);
          a.lock = m.lock;
          return;
        }
      }
      // keep the Kage's own fighting distance, drifting sideways so they don't stack in a line
      const desired = def.range + (t.r || 16);
      a.angle = Math.atan2(t.y - a.y, t.x - a.x);
      if (d > desired + 10) stepToward(a, t.x, t.y, def.speed, dt, api, desired);
      else {
        const side = Math.sin(state.clock * .6 + a.seed) * .5;
        const ta = a.angle + Math.PI / 2;
        stepToward(a, a.x + Math.cos(ta) * side * 40, a.y + Math.sin(ta) * side * 40, def.speed * .25, dt, api, 2);
        a.angle = Math.atan2(t.y - a.y, t.x - a.x);
      }
      if (a.stuck > 1.1) shunshin(a, L.x + a.hx, L.y + a.hy, api, state);
    } else {
      const hx = L.x + a.hx, hy = L.y + a.hy, d = Math.hypot(hx - a.x, hy - a.y);
      if (a.id === 'onoki' && d > 520 && a.cds.fly <= 0) { CAST.fly(a, null, api, state, MOVES.fly, { x: hx, y: hy }); a.cds.fly = MOVES.fly.cd; return; }
      if (d > 1100) shunshin(a, hx, hy, api, state);
      else if (d > 24) { stepToward(a, hx, hy, def.speed, dt, api, 18); a.angle = Math.atan2(hy - a.y, hx - a.x); }
      else { a.moving = false; a.angle = L.angle ?? a.angle; }
      if (a.stuck > 1.4) shunshin(a, hx, hy, api, state);
    }
  }

  // Gaara throws up a sand shield when a teammate takes a heavy blow.
  function watchShield(a, api, state) {
    const ps = api.players || [];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (!p) continue;
      const before = state.hpSeen[i];
      state.hpSeen[i] = p.health;
      if (before === undefined || p.down || a.cds.shield > 0) continue;
      if (before - p.health > p.maxHealth * .04) {
        addFx(state, { kind: 'shield', pi: i, x: p.x, y: p.y, dur: 1.4, R: 44 });
        a.cds.shield = MOVES.shield.cd;
        if (!a.call) callout(a, MOVES.shield);
      }
    }
  }

  // ------------------------------------------------------------------ shinobi AI
  function shinobiTarget(s, api, L, load) {
    let best = null, bd = Infinity, boss = null;
    api.forEachEnemyNear(s.x, s.y, 520, z => {
      if (!alive(z)) return;
      if (z.type === 'boss' || z === api.boss || z.type === 'beast') { boss = z; return; }
      if ((z.x - L.x) ** 2 + (z.y - L.y) ** 2 > 950 * 950) return;
      // spread the squads: an enemy already swarmed by others looks farther away
      const crowd = (load.get(z) || 0) - (s.target === z ? 1 : 0);
      const d = Math.hypot(z.x - s.x, z.y - s.y) + crowd * 130;
      if (d < bd) { bd = d; best = z; }
    });
    return best || (boss && Math.hypot(boss.x - L.x, boss.y - L.y) < 1000 ? boss : null);
  }

  function updateShinobi(s, dt, api, state, L) {
    s.poseT -= dt; s.slashCd -= dt; s.jutsuCd -= dt;
    if ((s.seek -= dt) <= 0 || !alive(s.target)) {
      const old = alive(s.target) ? s.target : null;
      s.target = shinobiTarget(s, api, L, state.load);
      if (old !== s.target) {
        if (old) state.load.set(old, Math.max(0, (state.load.get(old) || 1) - 1));
        if (s.target) state.load.set(s.target, (state.load.get(s.target) || 0) + 1);
      }
      s.seek = .4 + hash(s.seed + state.clock) * .3;
    }
    const t = alive(s.target) ? s.target : null;
    if (t) {
      const big = t.type === 'boss' || t === api.boss || t.type === 'beast';
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      const desired = big ? 230 + (s.seed % 5) * 14 : (t.r || 16) + s.r + 6;
      // come in from your own side of the target so the squad surrounds it instead of queueing
      const from = Math.atan2(s.y - t.y, s.x - t.x) + s.bias * .35;
      const px = t.x + Math.cos(from) * desired, py = t.y + Math.sin(from) * desired;
      stepToward(s, px, py, s.speed, dt, api, 5);
      s.angle = Math.atan2(t.y - s.y, t.x - s.x);
      const mult = (big ? tuning.shinobiVsBoss : 1) * tuning.shinobiDamage;
      if (!big && s.slashCd <= 0 && d < (t.r || 16) + s.r + 26) {
        hurt(api, t, SHINOBI.slash * mult, s.angle);
        s.slashCd = .75 + hash(s.seed + state.clock * 3) * .35;
        pose(s, 'attack', .22);
        addFx(state, { kind: 'slash', x: t.x, y: t.y - 22, a: s.angle, flip: hash(state.clock + s.seed) > .5 ? 1 : -1, dur: .2, color: s.color }, true);
      } else if (big && s.slashCd <= 0 && d < 430) {
        // kunai volleys at the giant from a safe distance
        s.slashCd = 1.2 + hash(s.seed + state.clock) * .5;
        pose(s, 'attack', .2);
        const tx = t.x + (hash(state.clock * 7 + s.seed) - .5) * t.r, ty = t.y + (hash(state.clock * 3 + s.seed) - .5) * t.r * .6;
        addFx(state, { kind: 'shot', style: 'kunai', x0: s.x, y0: s.y, tx, ty, curve: 0, dur: d / 900, hitAt: d / 900,
          hit: (api2) => hurt(api2, t, SHINOBI.kunai * mult, s.angle) }, true) || hurt(api, t, SHINOBI.kunai * mult, s.angle);
      }
      if (s.jutsuCd <= 0 && d < 340) {
        s.jutsuCd = 4.5 + hash(s.seed + state.clock * 1.3) * 2.6;
        pose(s, 'seal', .3);
        element(s, t, api, state, mult);
      }
      if (s.stuck > 1.5) shunshin(s, L.x + s.hx, L.y + s.hy, api, state);
    } else {
      const hx = L.x + s.hx, hy = L.y + s.hy, d = Math.hypot(hx - s.x, hy - s.y);
      if (d > 1100 || s.stuck > 1.6) shunshin(s, hx, hy, api, state);
      else if (d > 40) { stepToward(s, hx, hy, s.speed * .9, dt, api, 30); s.angle = Math.atan2(hy - s.y, hx - s.x); }
      else { s.moving = false; s.angle = L.angle ?? s.angle; }
    }
  }

  // Each village's signature element jutsu (cheap visuals, they are many).
  function element(s, t, api, state, mult) {
    const ang = Math.atan2(t.y - s.y, t.x - s.x), d = Math.hypot(t.x - s.x, t.y - s.y);
    switch (s.element) {
      case 'fire': {
        const tx = t.x, ty = t.y;
        addFx(state, { kind: 'shot', style: 'fire', x0: s.x, y0: s.y, tx, ty, curve: 0, dur: .12 + d / 560, hitAt: .12 + d / 560,
          hit: (api2, st) => { area(api2, tx, ty, 48, SHINOBI.fire * mult, { max: 5 }); addFx(st, { kind: 'pop', style: 'fire', x: tx, y: ty, dur: .5 }, true); } }, true)
          || area(api, tx, ty, 48, SHINOBI.fire * mult, { max: 5 });
        break;
      }
      case 'wind': {
        for (let i = -1; i <= 1; i++) {
          const a = ang + i * .16, tx = s.x + Math.cos(a) * (d + 30), ty = s.y + Math.sin(a) * (d + 30);
          addFx(state, { kind: 'shot', style: 'wind', x0: s.x, y0: s.y, tx, ty, curve: 0, dur: (d + 30) / 760, hitAt: (d + 30) / 760,
            hit: (api2) => area(api2, tx, ty, 34, SHINOBI.wind * mult, { max: 3 }) }, true) || area(api, tx, ty, 34, SHINOBI.wind * mult, { max: 3 });
        }
        break;
      }
      case 'lightning': {
        hurt(api, t, SHINOBI.lightning * mult, ang);
        addFx(state, { kind: 'bolt', x0: s.x, y0: s.y, target: t, x1: t.x, y1: t.y, dur: .24 }, true);
        addFx(state, { kind: 'spark', x: t.x, y: t.y, r: 26, dur: .28 }, true);
        break;
      }
      case 'water': {
        const tx = t.x, ty = t.y;
        addFx(state, { kind: 'shot', style: 'water', x0: s.x, y0: s.y, tx, ty, curve: 0, dur: .1 + d / 520, hitAt: .1 + d / 520,
          hit: (api2, st) => { area(api2, tx, ty, 44, SHINOBI.water * mult, { max: 5, push: 26 }); addFx(st, { kind: 'pop', style: 'water', x: tx, y: ty, dur: .45 }, true); } }, true)
          || area(api, tx, ty, 44, SHINOBI.water * mult, { max: 5 });
        break;
      }
      case 'earth': {
        const tx = t.x, ty = t.y;
        addFx(state, { kind: 'spikes', x: tx, y: ty, a: ang, dur: .8, hitAt: .12,
          hit: (api2) => area(api2, tx, ty, 52, SHINOBI.earth * mult, { max: 6 }) }, true) || area(api, tx, ty, 52, SHINOBI.earth * mult, { max: 6 });
        break;
      }
    }
  }

  // ------------------------------------------------------------------ update
  function update(state, dt, api) {
    if (!state || !api || !state.allies) return;
    if (!state.fx) state.fx = [];
    if (!state.timers) state.timers = [];
    if (!state.hpSeen) state.hpSeen = [];
    dt = Math.min(Math.max(dt || 0, 0), .05);
    state.clock = (state.clock || 0) + dt;
    state.cutInCd = (state.cutInCd || 0) - dt;
    const L = leaderOf(api, state);

    const timers = state.timers;
    for (let i = timers.length - 1; i >= 0; i--) {
      const tm = timers[i];
      if ((tm.t -= dt) <= 0) { timers.splice(i, 1); tm.fn(api, state); }
    }

    const fx = state.fx, n = fx.length;
    for (let i = 0; i < n; i++) {
      const f = fx[i];
      f.t += dt;
      if (f.pi !== undefined) { const p = api.players && api.players[f.pi]; if (p) { f.x = p.x; f.y = p.y; } }
      if (f.target && f.kind === 'bolt' && alive(f.target)) { f.x1 = f.target.x; f.y1 = f.target.y; }
      if (f.kind === 'coffin') updateCoffin(f, dt, api, state);
      else if (f.kind === 'tsunami') updateTsunami(f, dt, api, state);
      else if (f.kind === 'dragon' && f.t < f.hitAt * .8 && alive(f.target)) { f.tx = lerp(f.tx, f.target.x, .08); f.ty = lerp(f.ty, f.target.y, .08); }
      if (f.onTick && (f.tk -= dt) <= 0) { f.tk += f.tick; f.onTick(api, state, f); }
      if (f.hit && !f.done && f.t >= f.hitAt) { f.done = true; f.hit(api, state, f); }
    }
    let w = 0;
    for (let i = 0; i < fx.length; i++) if (fx[i].t < fx[i].dur) fx[w++] = fx[i];
    fx.length = w;

    const allies = state.allies;
    // how many shinobi already chase each enemy
    const load = state.load || (state.load = new Map());
    load.clear();
    for (const a of allies) if (a.kind === 'shinobi' && alive(a.target)) load.set(a.target, (load.get(a.target) || 0) + 1);
    for (const a of allies) {
      const wasHidden = a.age < 0;
      a.age += dt;
      if (a.age < 0) continue;
      if (a.fling) { updateFling(a, dt, api); continue; }
      if (wasHidden) {
        if (a.kind === 'kage') addFx(state, { kind: 'poof', x: a.x, y: a.y, dur: .6, r: 34 });
      }
      if (a.kind === 'kage') updateKage(a, dt, api, state, L);
      else updateShinobi(a, dt, api, state, L);
    }
    // spread out: allies never stack on one spot
    for (let i = 0; i < allies.length; i++) {
      const a = allies[i]; if (a.age < 0 || a.act) continue;
      for (let j = i + 1; j < allies.length; j++) {
        const b = allies[j]; if (b.age < 0 || b.act) continue;
        const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r + 6;
        if (dx > min || dx < -min || dy > min || dy < -min) continue;
        const d = Math.hypot(dx, dy);
        if (d >= min) continue;
        const push = (min - d) * .5, ux = d > .01 ? dx / d : Math.cos(i + j), uy = d > .01 ? dy / d : Math.sin(i + j);
        api.move(a, -ux * push, -uy * push);
        api.move(b, ux * push, uy * push);
      }
    }
  }

  // An enemy jutsu landing among the Alliance throws the shinobi in it through the air (they are
  // invulnerable: they tumble, land and fight on). The Kage stand their ground.
  function blast(state, x, y, r, api) {
    if (!state || !state.allies) return 0;
    let n = 0;
    for (const a of state.allies) {
      if (a.kind !== 'shinobi' || a.age < 0 || a.fling) continue;
      const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy);
      if (d > r) continue;
      const k = 1 - d / r, ang = d > 1 ? Math.atan2(dy, dx) : hash(a.seed) * TAU;
      a.fling = { t: 0, dur: .7 + k * .5, vx: Math.cos(ang) * (260 + k * 520), vy: Math.sin(ang) * (260 + k * 520), h: 50 + k * 90, spin: (hash(a.seed + 1) > .5 ? 1 : -1) };
      a.target = null; n++;
    }
    return n;
  }
  function updateFling(a, dt, api) {
    const f = a.fling;
    f.t += dt;
    const k = f.t / f.dur, slow = 1 - c01(k);
    api.move(a, f.vx * slow * dt, f.vy * slow * dt);
    a.lift = Math.sin(Math.PI * c01(k)) * f.h;
    a.angle = Math.atan2(-f.vy, -f.vx);
    a.moving = false; pose(a, 'raise', .1);
    if (k >= 1) { a.fling = null; a.lift = 0; pose(a, 'seal', .25); }
  }

  function updateCoffin(f, dt, api, state) {
    const z = f.target;
    // the sand reaches the target at .45 s, binds it, crushes at 1.15 s
    if (f.t < .45 && alive(z)) { f.x = z.x; f.y = z.y; f.ax = z.x; f.ay = z.y; }
    else if (f.t < 1.15 && alive(z) && api.push) {
      const k = z.type === 'boss' ? .35 : .8;
      api.push(z, (f.ax - z.x) * k, (f.ay - z.y) * k);
      f.x = lerp(f.x, z.x, .3); f.y = lerp(f.y, z.y, .3);
    }
    if (!f.crushed && f.t >= 1.15) {
      f.crushed = true;
      hurt(api, z, f.dmg, 0);
      area(api, f.x, f.y, f.R + 26, f.dmg * .35, { skip: z, max: 16 });
      callApi(api, 'impact', f.x, f.y, f.R, 320, 'earth', 0);
      callApi(api, 'shake', 6);
    }
  }

  function updateTsunami(f, dt, api, state) {
    const prev = f.front;
    f.front = f.range * eOut(Math.min(1, f.t / f.travel));
    if (f.t > f.travel + .1) return;
    const r = f.front + 30;
    api.forEachEnemyNear(f.x, f.y, r, z => {
      if (!alive(z) || f.hit.has(z)) return;
      const d = Math.hypot(z.x - f.x, z.y - f.y);
      if (d > r + z.r || d < prev - 60) return;
      if (Math.abs(angDiff(Math.atan2(z.y - f.y, z.x - f.x), f.a)) > f.spread + .1) return;
      f.hit.add(z);
      hurt(api, z, f.dmg, f.a);
      if (alive(z) && api.push) { const p = z.type === 'boss' ? 12 : 85; api.push(z, Math.cos(f.a) * p, Math.sin(f.a) * p); }
    });
  }

  // ================================================================== drawing
  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); ctx.fill(); }

  function spriteOf(a) {
    const S = sprites();
    return S.has(a.sprite) ? a.sprite : S.has(a.fallback) ? a.fallback : 'walker';
  }

  function sandPuff(K) {
    return K.sprite('wa:sandpuff', 96, 96, g => {
      const gr = g.createRadialGradient(38, 36, 0, 48, 48, 48);
      gr.addColorStop(0, '#f6e6bc'); gr.addColorStop(.45, '#dcbb7c'); gr.addColorStop(.76, '#b98f55');
      gr.addColorStop(.9, 'rgba(150,110,62,.6)'); gr.addColorStop(1, 'rgba(150,110,62,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  function mistPuff(K) {
    return K.sprite('wa:mistpuff', 96, 96, g => {
      const gr = g.createRadialGradient(42, 40, 0, 48, 48, 48);
      gr.addColorStop(0, 'rgba(255,253,236,.95)'); gr.addColorStop(.45, 'rgba(240,242,206,.8)');
      gr.addColorStop(.75, 'rgba(214,224,168,.4)'); gr.addColorStop(1, 'rgba(200,214,150,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  function sprayPuff(K) {
    return K.sprite('wa:spray', 96, 96, g => {
      const gr = g.createRadialGradient(42, 40, 0, 48, 48, 48);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.35, 'rgba(190,232,255,.85)');
      gr.addColorStop(.68, 'rgba(80,165,232,.45)'); gr.addColorStop(1, 'rgba(40,120,210,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  function rockSprite(K) {
    return K.sprite('wa:rock', 96, 80, g => {
      g.translate(48, 44);
      const pts = [[-40, 6], [-36, -18], [-18, -34], [8, -36], [30, -24], [42, -2], [36, 20], [10, 30], [-22, 28]];
      const path = s => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)); g.closePath(); };
      path(1.04); g.fillStyle = '#2e2218'; g.fill();
      path(1); g.fillStyle = '#7f6248'; g.fill();
      g.fillStyle = '#a8865f';
      g.beginPath(); g.moveTo(-34, -14); g.lineTo(-16, -31); g.lineTo(8, -33); g.lineTo(27, -22); g.lineTo(10, -10); g.lineTo(-20, -6); g.closePath(); g.fill();
      g.fillStyle = '#c9a77c';
      g.beginPath(); g.moveTo(-14, -27); g.lineTo(6, -29); g.lineTo(-4, -18); g.closePath(); g.fill();
      g.fillStyle = '#5a4332';
      g.beginPath(); g.moveTo(40, 0); g.lineTo(34, 18); g.lineTo(8, 28); g.lineTo(-20, 26); g.lineTo(-2, 14); g.lineTo(22, 8); g.closePath(); g.fill();
      g.strokeStyle = '#2e2218'; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-8, -8); g.lineTo(2, 4); g.lineTo(-4, 16); g.moveTo(14, -18); g.lineTo(22, -6); g.stroke();
    });
  }

  // ---------- Kage body
  const rings = new Map();
  function ringSprite(color) {
    let c = rings.get(color);
    if (!c) {
      c = document.createElement('canvas'); c.width = 52; c.height = 22;
      const g = c.getContext('2d');
      g.strokeStyle = color; g.lineWidth = 3.2;
      g.beginPath(); g.ellipse(26, 11, 24, 9.2, 0, 0, TAU); g.stroke();
      rings.set(color, c);
    }
    return c;
  }
  function drawAlly(ctx, a, time) {
    const S = sprites();
    if (!a || !S || a.age < 0) return;
    const K = kit();
    const id = spriteOf(a);
    const feetY = a.y + 3;
    const float = a.id === 'onoki' ? 14 + Math.sin(time * 2.3 + a.seed) * 3 : 0;
    const lift = (a.lift || 0) + float;
    const facing = Math.cos(a.angle || 0) >= 0 ? 1 : -1;
    const kage = a.kind === 'kage';
    S.shadow(ctx, a.x, feetY, kage ? 13 : 11, .3 * Math.max(.4, 1 - lift / 160));
    if (!kage) {
      // a thin village-coloured ring marks friend from foe (the fallback art shares enemy grunt sprites)
      ctx.globalAlpha = .75; ctx.drawImage(ringSprite(a.color), a.x - 13, feetY + 1 - 5.6, 26, 11.2); ctx.globalAlpha = 1;
    }
    let frame = a.poseT > 0 ? a.pose : a.moving ? 'run' : 'idle';
    if (a.act && a.act.kind === 'fly') frame = 'raise';
    if (a.act && a.act.kind === 'jinton') frame = 'raise';
    const y = feetY - lift;
    if (a.id === 'ay' && K) ayAura(ctx, a, y, time, K, false);
    if (a.id === 'onoki' && K && (a.flying || (a.act && a.act.kind === 'fly'))) lightRings(ctx, a, y, time, false);
    if (a.id === 'tsunade' && a.act && a.act.kind === 'leap' && K) leapStreak(ctx, a, y, time, K);
    if (a.id === 'gaara' && K) gourdSand(ctx, a, y, time, facing);
    const appear = a.age < .45;
    if (!appear || a.age > .12) S.draw(ctx, id, a.x, y, { facing, frame, phase: time * (a.moving ? 10 : 6) + a.seed, flash: a.hitFlash > 0 ? a.hitFlash * 3 : 0 });
    if (a.id === 'ay' && K) ayAura(ctx, a, y, time, K, true);
    if (a.id === 'onoki' && K && (a.flying || (a.act && a.act.kind === 'fly'))) lightRings(ctx, a, y, time, true);
    if (a.id === 'onoki' && K && a.act && a.act.kind === 'jinton') jintonCharge(ctx, a, y, time, K);
    if (kage) {
      const top = y - S.height(id) - 6;
      ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = '#101519'; ctx.strokeText(a.name, a.x, top);
      ctx.fillStyle = KAGE[a.id].color; ctx.fillText(a.name, a.x, top);
      ctx.textBaseline = 'alphabetic';
    }
    if (appear && !kage) S.drawSmoke(ctx, a.x, feetY - 14, a.age / .45, 20);
  }

  // Raiton no Yoroi: Ay's body is always sheathed in crackling blue-white lightning.
  const AY_PAL = ['110,170,255', '180,220,255', '255,255,255'];
  function ayAura(ctx, a, y, time, K, front) {
    const cx = a.x, cy = y - 36;
    ctx.save();
    if (!front) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx, cy, 44, '120,180,255', .32 + Math.sin(time * 31) * .06, false, 1.15);
      ctx.restore();
      return;
    }
    const n = 4;
    for (let i = 0; i < n; i++) {
      const ph = Math.floor(time * 14 + i * 1.7);
      const a1 = hash(ph + i * 3.1 + a.seed) * TAU, a2 = a1 + (hash(ph * 1.3 + i) - .5) * 2.4;
      const x1 = cx + Math.cos(a1) * 15, y1 = cy + Math.sin(a1) * 30;
      const x2 = cx + Math.cos(a2) * 24, y2 = cy + Math.sin(a2) * 36;
      K.forkedBolt(ctx, x1, y1, x2, y2, a.seed + i * 13 + ph, time, { jitter: 6, alpha: .85, width: 1, pal: AY_PAL, base: 'rgba(30,80,200,.5)', forks: 1, forkLen: 9, step: 7, rate: 24 });
    }
    // a few sparks skittering on the ground round his feet
    ctx.strokeStyle = 'rgba(200,232,255,.8)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const ph = Math.floor(time * 10 + i * 2.3), aa = hash(ph + i * 7) * TAU, rr = 14 + hash(ph * 2 + i) * 10;
      const sx = a.x + Math.cos(aa) * rr, sy = a.y + 3 + Math.sin(aa) * rr * .4;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 4, sy - 5); ctx.lineTo(sx + 1, sy - 7); ctx.lineTo(sx + 5, sy - 12); ctx.stroke();
    }
    ctx.restore();
  }

  // Chōkeijūgan: pale rings of weightlessness spin round the flying Tsuchikage.
  function lightRings(ctx, a, y, time, front) {
    ctx.save();
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const r = 22 + i * 8, cy = y - 22 - i * 12, ph = time * 3 + i * 1.6;
      ctx.strokeStyle = front ? 'rgba(255,255,255,.85)' : 'rgba(170,190,215,.55)';
      ctx.beginPath(); ctx.ellipse(a.x, cy, r, r * .3, Math.sin(ph) * .15, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // Tsunade's dive: chakra streak behind her and a target shadow growing on the ground.
  function leapStreak(ctx, a, y, time, K) {
    const s = a.act, k = c01(s.t / s.dur);
    ctx.save();
    // landing mark
    ctx.globalAlpha = .25 + k * .45;
    ctx.fillStyle = 'rgba(40,20,30,.5)'; ell(ctx, s.tx, s.ty + 3, 20 + k * 40, (20 + k * 40) * .42);
    ctx.strokeStyle = '#ff8fc0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(s.tx, s.ty + 3, 150 * (1.15 - k * .15), 150 * .45 * (1.15 - k * .15), 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    if (k > .5) {
      // diving heel-first: speed lines trailing above her and chakra gathering in the heel
      const e = (k - .5) / .5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const ox = (i - 2) * 7, top = y - 80 - 70 * e;
        ctx.strokeStyle = `rgba(196,60,120,${.55 * e})`; ctx.lineWidth = 4 - Math.abs(i - 2);
        ctx.beginPath(); ctx.moveTo(a.x + ox, top); ctx.lineTo(a.x + ox * .4, y - 40); ctx.stroke();
        ctx.strokeStyle = `rgba(255,225,240,${.85 * e})`; ctx.lineWidth = 1.6 - Math.abs(i - 2) * .3;
        ctx.beginPath(); ctx.moveTo(a.x + ox, top + 6); ctx.lineTo(a.x + ox * .4, y - 42); ctx.stroke();
      }
      ctx.fillStyle = `rgba(232,90,150,${.8 * e})`; ell(ctx, a.x, y - 2, 7 + 4 * e, 5 + 3 * e);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, a.x, y - 4, 30, '255,160,210', .7 * e, true);
    }
    ctx.restore();
  }

  // A thin stream of sand always drifts around Gaara.
  function gourdSand(ctx, a, y, time, facing) {
    ctx.save();
    ctx.fillStyle = SAND.base;
    for (let i = 0; i < 9; i++) {
      const ph = time * 1.6 + i * TAU / 9;
      const x = a.x + Math.cos(ph) * 22, yy = y - 18 + Math.sin(ph) * 7 - Math.sin(ph * 2 + i) * 6;
      ctx.globalAlpha = .55 + .4 * Math.sin(ph);
      ctx.fillRect(x - 1.3, yy - 1.3, 2.6, 2.6);
    }
    ctx.restore();
  }

  // ---------- Jinton cube (shared by the charge in his hands and the full-size cube)
  const CX = new Float32Array(8), CY = new Float32Array(8);
  const FACES = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
  function cubePoints(cx, cy, h, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < 8; i++) {
      const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1;
      const X = sx * c - sz * s, Z = sx * s + sz * c;
      CX[i] = cx + X * h; CY[i] = cy + Z * h * .5 - (sy + 1) * h * .95;
    }
  }
  function cubeEdges(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) {
      const j = i | b; if (j === i) continue;
      ctx.moveTo(CX[i], CY[i]); ctx.lineTo(CX[j], CY[j]);
    }
    ctx.stroke();
  }
  function cubeFaces(ctx) {
    for (const f of FACES) {
      ctx.beginPath(); ctx.moveTo(CX[f[0]], CY[f[0]]);
      for (let k = 1; k < 4; k++) ctx.lineTo(CX[f[k]], CY[f[k]]);
      ctx.closePath(); ctx.fill();
    }
  }
  function drawCube(ctx, cx, cy, h, yaw, alpha, K, white = 0) {
    cubePoints(cx, cy, h, yaw);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${lerp(200, 255, white)},${lerp(232, 255, white)},255,${.13 + white * .5})`;
    cubeFaces(ctx);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(46,82,120,.8)'; ctx.lineWidth = Math.max(1.6, h * .035); cubeEdges(ctx);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(.9, h * .016); cubeEdges(ctx);
    // the white sphere of the jutsu inside
    const sr = h * .52, sy = cy - h * .95;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath(); ctx.arc(cx, sy, sr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,196,230,.9)'; ctx.lineWidth = Math.max(1, h * .02);
    ctx.beginPath(); ctx.arc(cx, sy, sr, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, sy, sr * 2.4, '190,228,255', .55 + white * .45, true);
    ctx.restore();
  }
  function jintonCharge(ctx, a, y, time, K) {
    const k = c01(a.act.t / a.act.dur);
    const h = 6 + eOut(k) * 10;
    const hy = y - 60;
    drawCube(ctx, a.x, hy + h * .95, h, time * 2.2, Math.min(1, k * 3), K);
    // white light threads converging on the cube between his hands
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(220,240,255,${.5 * k})`; ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const ang = i * TAU / 6 + time * 3, r = 30 * (1 - ((time * 2 + i / 6) % 1));
      ctx.beginPath(); ctx.moveTo(a.x + Math.cos(ang) * r, hy + Math.sin(ang) * r * .6);
      ctx.lineTo(a.x + Math.cos(ang) * (r + 8), hy + Math.sin(ang) * (r + 8) * .6); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- Katsuyu (white slug with blue stripes and eye stalks); y is the ground contact
  function slug(ctx, x, y, s, facing, alpha) {
    if (alpha <= .01 || s <= .2) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(facing * s / 10, s / 10);
    ctx.globalAlpha *= alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const body = () => {
      ctx.beginPath(); ctx.moveTo(-13, 0);
      ctx.quadraticCurveTo(-9, -5.5, 0, -6.5); ctx.quadraticCurveTo(7, -8.6, 11, -6.8);
      ctx.quadraticCurveTo(14.4, -3.4, 12.5, 0); ctx.closePath();
    };
    body(); ctx.fillStyle = '#f6f9fd'; ctx.fill();
    ctx.strokeStyle = '#5d7799'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = '#d8e3f1'; ctx.beginPath(); ctx.ellipse(-.5, -.6, 12, 1.3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3f8ee6'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-10.5, -2.8); ctx.quadraticCurveTo(0, -6, 9.6, -6.2); ctx.stroke();
    ctx.strokeStyle = '#86bdf3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-8.5, -1.5); ctx.quadraticCurveTo(1, -3.8, 11, -4); ctx.stroke();
    // eye stalks
    ctx.strokeStyle = '#5d7799'; ctx.lineWidth = 2.1;
    ctx.beginPath(); ctx.moveTo(9.2, -7.4); ctx.lineTo(10.6, -11.8); ctx.moveTo(11, -6.8); ctx.lineTo(13.8, -10.8); ctx.stroke();
    ctx.strokeStyle = '#f6f9fd'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(9.2, -7.4); ctx.lineTo(10.6, -11.8); ctx.moveTo(11, -6.8); ctx.lineTo(13.8, -10.8); ctx.stroke();
    ctx.fillStyle = '#1d2a40';
    ctx.beginPath(); ctx.arc(10.7, -12, 1.1, 0, TAU); ctx.arc(13.9, -11, 1.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- small shared pieces
  function sparkle(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .25, y - s * .25); ctx.lineTo(x + s, y); ctx.lineTo(x + s * .25, y + s * .25);
    ctx.lineTo(x, y + s); ctx.lineTo(x - s * .25, y + s * .25); ctx.lineTo(x - s, y); ctx.lineTo(x - s * .25, y - s * .25); ctx.closePath(); ctx.fill();
  }
  function petal(ctx, x, y, s, rot, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= alpha;
    ctx.fillStyle = '#e2588e';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * .9, -s * .7, s * 1.6, -s * .1); ctx.lineTo(s * 1.25, 0); ctx.lineTo(s * 1.6, s * .1);
    ctx.quadraticCurveTo(s * .9, s * .7, 0, 0); ctx.fill();
    ctx.fillStyle = '#ffc6dc';
    ctx.beginPath(); ctx.moveTo(s * .15, 0); ctx.quadraticCurveTo(s * .8, -s * .45, s * 1.3, -s * .08); ctx.lineTo(s * 1.3, s * .08);
    ctx.quadraticCurveTo(s * .8, s * .45, s * .15, 0); ctx.fill();
    ctx.restore();
  }
  function shuriken(ctx, x, y, s, rot, fill, line) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * s * .32, Math.sin(a + Math.PI / 4) * s * .32);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  // Quadratic-bezier tube (tapering), used by the water dragon.
  const TL = new Float32Array(64), TR = new Float32Array(64);
  function tube(ctx, x0, y0, cx, cy, x1, y1, t0, t1, w0, w1, wave, phase) {
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const k = i / N, t = t0 + (t1 - t0) * k, u = 1 - t;
      const px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
      let dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const w = w0 + (w1 - w0) * k, sway = Math.sin(k * 10 + phase) * wave;
      TL[i * 2] = px - dy * (w + sway); TL[i * 2 + 1] = py + dx * (w + sway);
      TR[i * 2] = px + dy * (w - sway); TR[i * 2 + 1] = py - dx * (w - sway);
    }
    ctx.beginPath(); ctx.moveTo(TL[0], TL[1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(TL[i * 2], TL[i * 2 + 1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(TR[i * 2], TR[i * 2 + 1]);
    ctx.closePath();
  }
  const bez = (x0, y0, cx, cy, x1, y1, t) => { const u = 1 - t; return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]; };

  function dragonHead(ctx, x, y, angle, s, open) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (Math.cos(angle) < 0) ctx.scale(1, -1);
    ctx.lineJoin = 'round';
    const head = (k, col) => {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(-s * .6 * k, -s * .55 * k); ctx.quadraticCurveTo(s * .2, -s * .78 * k, s * 1.18 * k, -s * .25 * k);
      ctx.lineTo(s * .55 * k, -s * .02 - open * s * .1); ctx.lineTo(s * 1.08 * k, s * .22 * k + open * s * .45);
      ctx.quadraticCurveTo(s * .2, s * .58 * k, -s * .6 * k, s * .45 * k); ctx.closePath(); ctx.fill();
    };
    head(1.08, '#123f7a'); head(1, '#3d9de6');
    ctx.fillStyle = '#c8efff';
    ctx.beginPath(); ctx.moveTo(-s * .3, -s * .42); ctx.quadraticCurveTo(s * .3, -s * .58, s * .95, -s * .26);
    ctx.quadraticCurveTo(s * .3, -s * .36, -s * .3, -s * .26); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e4f8ff'; ctx.lineWidth = Math.max(1.5, s * .1); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * .2, -s * .5); ctx.quadraticCurveTo(-s * .7, -s * .95, -s * 1.2, -s * .85);
    ctx.moveTo(-s * .05, -s * .45); ctx.quadraticCurveTo(-s * .4, -s * 1.05, -s * .95, -s * 1.12); ctx.stroke();
    // whiskers of spray
    ctx.lineWidth = Math.max(1, s * .05);
    ctx.beginPath(); ctx.moveTo(s * .9, s * .05); ctx.quadraticCurveTo(s * .4, s * .7, -s * .2, s * .8); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(s * .3, -s * .3, s * .14, s * .07, -.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0b2a52'; ctx.beginPath(); ctx.arc(s * .33, -s * .3, s * .045, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(s * .7, -s * .12); ctx.lineTo(s * .76, s * .05); ctx.lineTo(s * .82, -s * .14); ctx.fill();
    ctx.restore();
  }

  // ---------- crater (Tsūtenkyaku heel drop, Liger Bomb) — ground part
  const CRATER_PAL = {
    heel: { rim: 'rgba(120,92,64,.75)', bowl: 'rgba(78,58,40,.7)', deep: 'rgba(40,28,20,.7)', crack: '#2b1f16', top: '#a88a68', side: '#5e4632', glow: '255,150,200' },
    bolt: { rim: 'rgba(96,88,84,.7)', bowl: 'rgba(58,52,56,.7)', deep: 'rgba(26,24,34,.75)', crack: '#1c1a26', top: '#9c8c7c', side: '#4e443e', glow: '120,180,255' }
  };
  function craterGround(ctx, f, K) {
    const P = CRATER_PAL[f.pal] || CRATER_PAL.heel;
    const fade = 1 - c01((f.t - (f.dur - 1)) / 1), grow = eOut(f.t / .14), r = f.r, x = f.x, y = f.y;
    ctx.save(); ctx.globalAlpha = fade;
    ctx.fillStyle = P.rim; ell(ctx, x, y, r * .66 * grow, r * .66 * .46 * grow);
    ctx.fillStyle = P.bowl; ell(ctx, x, y + 2, r * .5 * grow, r * .5 * .44 * grow);
    ctx.fillStyle = P.deep; ell(ctx, x, y + 4, r * .28 * grow, r * .28 * .42 * grow);
    // fissures splitting the ground outward: dark gash with a lit lower lip
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? P.top : P.crack;
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU + hash(f.seed + i) * .35, len = r * (.75 + .6 * hash(f.seed + i * 3.1)) * grow;
        ctx.lineWidth = pass ? 1.1 : 4.2 - (i % 3) * 1.1;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * .3, y + Math.sin(a) * r * .3 * .48 + pass * 2);
        for (let s = 1; s <= 6; s++) {
          const d = r * .3 + (len - r * .3) * s / 6, j = (hash(f.seed + i * 7 + s) - .5) * .32;
          ctx.lineTo(x + Math.cos(a + j) * d, y + Math.sin(a + j) * d * .48 + pass * 2);
          if (!pass && s === 3 && i % 2) {
            // a short branch
            const ba = a + j + (hash(f.seed + i * 11) > .5 ? .5 : -.5), bl = r * .25;
            ctx.lineTo(x + Math.cos(ba) * (d + bl), y + Math.sin(ba) * (d + bl) * .48);
            ctx.moveTo(x + Math.cos(a + j) * d, y + Math.sin(a + j) * d * .48);
          }
        }
        ctx.stroke();
      }
    }
    // slabs of earth flipped up round the rim
    const rise = eBack(f.t / .16) * (1 - c01((f.t - (f.dur - 1.4)) / 1.2) * .7);
    const order = [];
    for (let i = 0; i < 12; i++) order.push(i);
    order.sort((p, q) => Math.sin(p / 12 * TAU + hash(f.seed + p * 5.3) * .5) - Math.sin(q / 12 * TAU + hash(f.seed + q * 5.3) * .5));
    for (const i of order) {
      const a = i / 12 * TAU + hash(f.seed + i * 5.3) * .5, d = r * (.55 + .2 * hash(f.seed + i * 2.7)) * grow;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .48;
      const w = (14 + 12 * hash(f.seed + i * 1.7)) * (r / 150 * .7 + .3), h = (7 + 9 * hash(f.seed + i * 4.4)) * rise;
      const sk = Math.cos(a) * w * .35, dep = w * .42;
      ctx.fillStyle = P.side;
      ctx.beginPath(); ctx.moveTo(px - w * .5, py); ctx.lineTo(px + w * .5, py); ctx.lineTo(px + w * .5 + sk * .3, py - h); ctx.lineTo(px - w * .5 + sk * .3, py - h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.top;
      ctx.beginPath(); ctx.moveTo(px - w * .5 + sk * .3, py - h); ctx.lineTo(px + w * .5 + sk * .3, py - h);
      ctx.lineTo(px + w * .5 + sk, py - h - dep); ctx.lineTo(px - w * .5 + sk, py - h - dep); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function craterOver(ctx, f, time, K) {
    const P = CRATER_PAL[f.pal] || CRATER_PAL.heel;
    const t = f.t;
    if (t > 1.6) return;
    ctx.save();
    // a low ring of dust rolling out of the impact
    const dust = K.puff('dust');
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU + hash(f.seed + i * 2.2) * .3, k = eOut(t / 1.2);
      const d = f.r * (.3 + .85 * k) * (.85 + .25 * hash(f.seed + i));
      const al = (1 - c01((t - .2) / 1.3)) * .75;
      K.stamp(ctx, dust, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * .48 - 6 - k * 6, f.r * (.07 + .07 * k) * (.8 + .4 * hash(i + f.seed)), al, .8);
    }
    K.fx.debris(ctx, f.x, f.y, f.r * .95, t / 1.1, f.seed, P.side, 14);
    if (t < .5) {
      groundRing(ctx, f.x, f.y, f.r * 1.25, t / .5, 1 - t / .5, P.side, f.pal === 'bolt' ? '#cfe6ff' : '#ffd6e8');
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.x, f.y - 10, f.r * .9, P.glow, (1 - t / .3) * .9, true, .7);
    }
    ctx.restore();
  }

  // ---------- Ōkashō
  function okashoGround(ctx, f) {
    const k = eOut(f.t / .2), fade = 1 - c01((f.t - .5) / .6);
    ctx.save(); ctx.globalAlpha = fade * .9;
    ctx.strokeStyle = '#3a271c'; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = f.a + (i / 6 - .5) * 1.4 + (hash(f.seed + i) - .5) * .15, len = f.r * (.55 + .4 * hash(f.seed + i * 3)) * k;
      ctx.lineWidth = 2.6 - (i % 2);
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      for (let s = 1; s <= 3; s++) { const j = (hash(f.seed + i * 5 + s) - .5) * .3; ctx.lineTo(f.x + Math.cos(a + j) * len * s / 3, f.y + Math.sin(a + j) * len * s / 3); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function okashoOver(ctx, f, time, K) {
    const t = f.t;
    ctx.save();
    const cy = f.y - 22;
    // three pink shock fronts
    for (let i = 0; i < 3; i++) {
      const lt = t - i * .07; if (lt <= 0 || lt > .5) continue;
      const k = eOut(lt / .5), r = f.r * (.25 + .8 * k), al = 1 - lt / .5, th = (16 - i * 4) * (1 - k * .6) + 3;
      // a filled crescent of force: solid pink body, white-hot leading edge
      ctx.fillStyle = `rgba(222,74,138,${al * .85})`;
      ctx.beginPath(); ctx.ellipse(f.x, cy, r, r * .62, 0, f.a - .78, f.a + .78);
      ctx.ellipse(f.x, cy, Math.max(1, r - th), Math.max(1, (r - th) * .62), 0, f.a + .66, f.a - .66, true); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,228,240,${al})`; ctx.lineWidth = 2.4 * al + 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(f.x, cy, r, r * .62, 0, f.a - .7, f.a + .7); ctx.stroke();
    }
    if (t < .2) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.x, cy, 46, '255,150,200', 1 - t / .2, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    // cherry-blossom petals scatter along the blast
    for (let i = 0; i < 22; i++) {
      const lt = t - hash(f.seed + i) * .12; if (lt <= 0) continue;
      const a = f.a + (hash(f.seed + i * 2.3) - .5) * 1.6, sp = f.r * (.5 + .8 * hash(f.seed + i * 4.1));
      const k = eOut(lt / .9), d = sp * k;
      const px = f.x + Math.cos(a) * d + Math.sin(time * 3 + i) * 4 * k;
      const py = cy + Math.sin(a) * d * .62 - 18 * bell(k) + lt * lt * 28;
      petal(ctx, px, py, 4.2 + hash(i + f.seed) * 2.6, lt * 8 + i, 1 - c01((lt - .6) / .5));
    }
    ctx.restore();
  }

  // ---------- Katsuyu big summon + heal
  function katsuyuOver(ctx, f, time, K) {
    const t = f.t, S = sprites();
    ctx.save();
    if (t < .7 && K.fx.smokePoof) K.fx.smokePoof(ctx, f.x, f.y - 26, 64, t / .7);
    const grow = eBack((t - .1) / .5);
    const fade = 1 - c01((t - 1.75) / .35);
    if (t > .1 && fade > 0) {
      const s = 46 * grow * (1 - c01((t - 1.75) / .35) * .5);
      // summoning glow under her, then the giant slug itself
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.x, f.y - 6, 70, '150,230,190', .2 * fade, false, .45);
      ctx.globalCompositeOperation = 'source-over';
      slug(ctx, f.x, f.y + 4, s, f.facing, fade);
    }
    // splits into many small slugs that hop off to the ninja
    if (t > 1.7) {
      const k = c01((t - 1.7) / .55);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + .3, d = 30 + 110 * eOut(k);
        const px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d * .5 - 50 * bell(k);
        slug(ctx, px, py, 7, Math.cos(a) >= 0 ? 1 : -1, 1 - c01((k - .7) / .3));
      }
      if (k < .5 && S) S.drawSmoke(ctx, f.x, f.y - 20, k * 2, 50);
    }
    ctx.restore();
  }
  function healGround(ctx, f, time, K) {
    const t = f.t, k = eOut(t / .5), al = 1 - c01((t - 1.3) / .6);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.strokeStyle = '#2f9a52'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 3, 16 + 22 * k, (16 + 22 * k) * .42, 0, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, f.x, f.y + 3, 50, '120,255,160', .5 * al, false, .45);
    ctx.strokeStyle = 'rgba(210,255,220,.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 3, 16 + 22 * k, (16 + 22 * k) * .42, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function healOver(ctx, f, time, K) {
    const t = f.t, al = 1 - c01((t - 1.4) / .5);
    ctx.save();
    // chakra column and rising motes
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, f.x, f.y - 26, 34, '140,255,170', .45 * al * bell(t / 1.9 + .2), false, 1.5);
    for (let i = 0; i < 9; i++) {
      const ph = (t * .9 + hash(f.seed + i)) % 1, px = f.x + (hash(f.seed + i * 3) - .5) * 34 + Math.sin(t * 4 + i) * 3;
      const py = f.y - ph * 64;
      ctx.globalAlpha = al * bell(ph);
      sparkle(ctx, px, py, 2.5 + (i % 3), i % 2 ? '#d6ffe0' : '#7dffa2');
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // a little Katsuyu clinging to the shoulder, popping in with a puff
    const pop = eBack((t - .08) / .3), S = sprites();
    slug(ctx, f.x - f.facing * 13, f.y - 27, 6 * pop, f.facing, al);
    if (t < .3 && S) S.drawSmoke(ctx, f.x - f.facing * 13, f.y - 28, t / .3, 9);
    // '+' marks
    ctx.globalAlpha = al;
    ctx.fillStyle = '#3fcf6e';
    for (let i = 0; i < 2; i++) {
      const ph = c01((t - .2 - i * .35) / .9); if (ph <= 0 || ph >= 1) continue;
      const px = f.x + (i ? 14 : -15), py = f.y - 52 - ph * 22;
      ctx.globalAlpha = al * (1 - ph);
      ctx.fillRect(px - 4, py - 1.3, 8, 2.6); ctx.fillRect(px - 1.3, py - 4, 2.6, 8);
    }
    ctx.restore();
  }

  // ---------- Gaara: coffin, tsunami, shuriken, shield
  function coffinGround(ctx, f, time, K) {
    const t = f.t, reach = eOut(t / .45), fade = 1 - c01((t - 1.1) / .5);
    if (fade <= 0) return;
    ctx.save(); ctx.globalAlpha = fade;
    // the sand river crawling along the ground from Gaara to the target
    const dx = f.ax - f.x0, dy = f.ay - f.y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const N = 16;
    const path = (off, scale) => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const k = i / N * reach, w = Math.sin(k * 9 + time * 5 + f.seed) * 7 * Math.sin(Math.PI * k);
        const px = f.x0 + dx * k + nx * w, py = f.y0 + dy * k + ny * w * .5 + off;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.lineWidth = scale; ctx.stroke();
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = SAND.dark; path(1, 15);
    ctx.strokeStyle = SAND.base; path(0, 11);
    ctx.strokeStyle = SAND.light; path(-2, 3);
    // the sand pool spreading under the target
    const pool = eOut((t - .3) / .3);
    ctx.fillStyle = SAND.dark; ell(ctx, f.x, f.y + 2, f.R * 1.15 * pool, f.R * .52 * pool);
    ctx.fillStyle = SAND.base; ell(ctx, f.x, f.y + 1, f.R * 1.02 * pool, f.R * .44 * pool);
    ctx.restore();
    sandFingers(ctx, f, time, true);
  }
  // Sand fingers of the closing hand: each rises from the pool rim and bends in over the target.
  function sandFingers(ctx, f, time, back) {
    const t = f.t;
    if (t < .4 || t > 1.0) return;
    const g = eOut((t - .4) / .3), close = eInOut((t - .62) / .3), fade = 1 - c01((t - .85) / .15);
    const R = f.R, x = f.x, y = f.y;
    ctx.save(); ctx.globalAlpha = fade;
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + .3 + hash(f.seed + i) * .3, s = Math.sin(a);
      if ((s < 0) !== back) continue;
      const bx = x + Math.cos(a) * R * 1.05, by = y + s * R * .46;
      const h = (R * 1.5 + 26) * g * (.8 + .3 * hash(f.seed + i * 2));
      const tx = lerp(bx, x + Math.cos(a) * R * .2, close * .8 + .2), ty = by - h + close * h * .35;
      const cx = bx + Math.cos(a) * R * .35, cy = by - h * .6;
      const w = 5 + R * .1;
      ctx.fillStyle = SAND.dark; tube(ctx, bx, by + 2, cx, cy, tx, ty, 0, 1, w + 2, 1.5, 0, 0); ctx.fill();
      ctx.fillStyle = back ? SAND.base : SAND.mid; tube(ctx, bx, by, cx, cy, tx, ty, 0, 1, w, .8, .8, time * 9 + i); ctx.fill();
    }
    ctx.restore();
  }
  function coffinOver(ctx, f, time, K) {
    const t = f.t;
    if (t < .4) return;
    ctx.save();
    const R = f.R, x = f.x, y = f.y;
    if (t < 1.18) {
      sandFingers(ctx, f, time, false);
      if (t > .62) {
        // the hand closes into a lumpy cocoon of sand that wraps the target whole
        const g = eBack((t - .62) / .26), squeeze = t > 1.0 ? eIn((t - 1.0) / .18) : 0;
        const H = (R * 1.45 + 26) * Math.min(1, g) * (1 - squeeze * .25), w = R * 1.0 * (1 - squeeze * .18) * Math.min(1.06, g);
        const prof = u => w * Math.pow(Math.max(0, 1 - Math.pow(u, 2)), .5) * (1 + .08 * Math.sin(u * 13 + time * 7 + f.seed));
        const outline = () => {
          ctx.beginPath();
          for (let i = 0; i <= 14; i++) { const u = i / 14; ctx.lineTo(x - prof(u), y - H * u); }
          for (let i = 14; i >= 0; i--) { const u = i / 14; ctx.lineTo(x + prof(u), y - H * u); }
          ctx.ellipse(x, y, Math.max(.1, w), Math.max(.1, w * .4), 0, 0, Math.PI);
          ctx.closePath();
        };
        outline(); ctx.fillStyle = SAND.dark; ctx.fill();
        ctx.save(); outline(); ctx.clip();
        ctx.fillStyle = SAND.base; ell(ctx, x - w * .08, y - H * .45, w * .9, H * .62);
        ctx.fillStyle = SAND.mid; ell(ctx, x - w * .3, y - H * .55, w * .45, H * .45);
        // bands of sand winding round it, sliding upward
        ctx.lineCap = 'round';
        for (let b = 0; b < 5; b++) {
          const u = ((b / 5 + time * .9) % 1) * .9 + .05, pw = Math.max(.1, prof(u));
          ctx.strokeStyle = '#9a743f'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x, y - H * u + 2, pw, pw * .32, 0, .2, Math.PI - .2); ctx.stroke();
          ctx.strokeStyle = SAND.light; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(x, y - H * u, pw, pw * .32, 0, .35, Math.PI - .5); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(92,64,30,.8)'; ctx.lineWidth = 1.6; outline(); ctx.stroke();
        // grains pouring off the top
        ctx.fillStyle = SAND.base;
        for (let i = 0; i < 12; i++) {
          const ph = (time * 1.8 + hash(f.seed + i)) % 1, a = hash(f.seed + i * 3) * TAU;
          ctx.globalAlpha = 1 - ph;
          ctx.fillRect(x + Math.cos(a) * (w * .35 + ph * 18), y - H + 4 + ph * H * .5 + Math.sin(a) * 4, 2.4, 2.4);
        }
        ctx.globalAlpha = 1;
      }
    } else {
      // Sōsō: the coffin implodes and the sand bursts outward
      const k = (t - 1.18) / .7;
      const puff = sandPuff(K);
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU + hash(f.seed + i) * .4, d = R * (.2 + 1.1 * eOut(k)) * (.7 + .5 * hash(f.seed + i * 2));
        K.stamp(ctx, puff, x + Math.cos(a) * d, y - R * .6 + Math.sin(a) * d * .55 - k * 18, R * (.32 + .25 * k), (1 - k) * .95);
      }
      K.fx.debris(ctx, x, y - 10, R * 1.6, k, f.seed, SAND.dark, 14);
      if (k < .5) {
        const rr = R * (.6 + 1.4 * eOut(k / .5));
        ctx.globalAlpha = 1 - k / .5;
        ctx.strokeStyle = SAND.dark; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .46, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = SAND.light; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y - 2, rr, rr * .46, 0, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function tsunamiGround(ctx, f, time, K) {
    const d = f.front, fade = 1 - c01((f.t - (f.dur - .6)) / .6);
    if (d < 4 || fade <= 0) return;
    ctx.save();
    const s0 = f.a - f.spread, s1 = f.a + f.spread;
    // thin sand left behind
    ctx.globalAlpha = fade * .28 * (1 - c01(f.t / f.dur)); ctx.fillStyle = SAND.base;
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, d, s0, s1); ctx.closePath(); ctx.fill();
    // the thick body of the wave right behind its front
    const inner = Math.max(0, d - 105);
    ctx.globalAlpha = fade;
    ctx.fillStyle = SAND.dark;
    ctx.beginPath(); ctx.arc(f.x, f.y, d + 5, s0 - .02, s1 + .02); ctx.arc(f.x, f.y, inner, s1, s0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = SAND.base;
    ctx.beginPath(); ctx.arc(f.x, f.y, d, s0, s1); ctx.arc(f.x, f.y, inner + 10, s1, s0, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = SAND.light; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a = s0 + (i + .5) / 14 * (s1 - s0), r0 = inner + (d - inner) * ((hash(f.seed + i) + f.t * 1.6) % 1) * .8;
      ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); ctx.lineTo(f.x + Math.cos(a) * (r0 + 20), f.y + Math.sin(a) * (r0 + 20)); ctx.stroke();
    }
    ctx.restore();
  }
  function tsunamiOver(ctx, f, time, K) {
    const d = f.front;
    if (d < 10) return;
    const travelK = c01(f.t / f.travel), collapse = c01((f.t - f.travel) / .5);
    const H = (52 + 30 * (1 - travelK)) * (1 - collapse * .85);
    const puff = sandPuff(K);
    ctx.save();
    const N = 16, s0 = f.a - f.spread, s1 = f.a + f.spread;
    const hAt = i => H * (Math.sin(Math.PI * i / N) * .45 + .55) * (.88 + .12 * Math.sin(i * 1.7 + time * 7));
    const P = (r, i, h) => { const a = s0 + (s1 - s0) * i / N; return [f.x + Math.cos(a) * r, f.y + Math.sin(a) * r - h]; };
    // the heaped body of the wave: rows of sand billows, tallest at the front, rolling as it moves
    const fadeOut = 1 - c01((f.t - f.travel - .25) / .45);
    if (fadeOut > 0) for (let k = 3; k >= 0; k--) {
      // dark underside along the front so the mass reads on light ground
      if (k === 0) {
        ctx.globalAlpha = fadeOut;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) { const [px, py] = P(d + 4, i, 0); ctx.lineTo(px, py); }
        for (let i = N; i >= 0; i--) { const [px, py] = P(d - 14, i, hAt(i) * .75); ctx.lineTo(px, py); }
        ctx.closePath(); ctx.fillStyle = SAND.dark; ctx.fill();
        ctx.globalAlpha = 1;
      }
      // each ridge of the rolling sand is a solid strip; only the front crest breaks into billows
      const rowH = (kk, i) => hAt(i) * (.35 + .65 * (1 - kk / 3)) + Math.sin(time * 9 + i * 1.3 + kk * 2) * 3;
      if (k > 0) {
        ctx.globalAlpha = fadeOut;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) { const [px, py] = P(d - 8 - k * 26, i, rowH(k, i) - 10); ctx.lineTo(px, py); }
        for (let i = N; i >= 0; i--) { const [px, py] = P(d - 8 - (k - 1) * 26, i, rowH(k - 1, i) - 6); ctx.lineTo(px, py); }
        ctx.closePath();
        ctx.fillStyle = k % 2 ? SAND.base : SAND.mid; ctx.fill();
        ctx.strokeStyle = k % 2 ? 'rgba(141,103,56,.7)' : SAND.light; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) { const [px, py] = P(d - 8 - k * 26, i, rowH(k, i) - 10); ctx.lineTo(px, py); }
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        for (let i = 0; i <= N; i++) {
          const [px, py] = P(d - 8, i, rowH(0, i));
          const r = (16 + 8 * hash(f.seed + i)) * (1 + collapse * .5);
          K.stamp(ctx, puff, px, py, r, .95 * fadeOut);
        }
      }
    }
    ctx.fillStyle = SAND.base;
    for (let i = 0; i < 16; i++) {
      const ph = (time * 2.2 + hash(f.seed + i * 7)) % 1, ii = Math.floor(hash(f.seed + i) * N);
      const [px, py] = P(d + 6 + ph * 14, ii, hAt(ii) * (1 - ph));
      ctx.globalAlpha = (1 - ph) * (1 - collapse);
      ctx.fillRect(px, py, 2.6, 2.6);
    }
    ctx.restore();
  }
  function shotOver(ctx, f, time, K) {
    const k = c01(f.t / f.dur);
    const nx = -(f.ty - f.y0), ny = f.tx - f.x0, nl = Math.hypot(nx, ny) || 1;
    const bend = Math.sin(Math.PI * k) * (f.curve || 0);
    const x = lerp(f.x0, f.tx, k) + nx / nl * bend, y = lerp(f.y0, f.ty, k) + ny / nl * bend - 24;
    const ang = Math.atan2(f.ty - f.y0, f.tx - f.x0);
    ctx.save();
    switch (f.style) {
      case 'sand':
        ctx.globalAlpha = .55; K.stamp(ctx, sandPuff(K), x - Math.cos(ang) * 10, y - Math.sin(ang) * 10, 7, .7); ctx.globalAlpha = 1;
        shuriken(ctx, x, y, 11, time * 22, SAND.mid, SAND.dark);
        break;
      case 'kunai':
        ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-4, 0); ctx.stroke();
        ctx.fillStyle = '#2a2e38'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-1, -2.6); ctx.lineTo(-1, 2.6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#c9b67a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-7, 0); ctx.stroke();
        break;
      case 'fire': {
        ctx.fillStyle = '#c9340e'; ell(ctx, x, y, 8, 8);
        ctx.fillStyle = '#ff8a22'; ell(ctx, x + 1, y - 1, 6, 6);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, y, 22, '255,140,50', .8, true);
        for (let i = 1; i <= 3; i++) K.glow(ctx, x - Math.cos(ang) * i * 7, y - Math.sin(ang) * i * 7, 10 - i * 2, '255,110,30', .55);
        break;
      }
      case 'water':
        ctx.fillStyle = '#1f6fc0'; ell(ctx, x, y, 7.5, 7);
        ctx.fillStyle = '#5ab8f2'; ell(ctx, x, y, 6, 5.6);
        ctx.fillStyle = '#e4f7ff'; ell(ctx, x - 2, y - 2, 2.2, 1.8);
        ctx.fillStyle = 'rgba(120,200,255,.7)';
        for (let i = 1; i <= 3; i++) ell(ctx, x - Math.cos(ang) * i * 7 + Math.sin(i * 9 + time * 20) * 2, y - Math.sin(ang) * i * 7, 3 - i * .6, 3 - i * .6);
        break;
      case 'wind': {
        ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(70,120,110,.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(-6, 0, 14, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = 'rgba(235,255,250,.95)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-6, 0, 14, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,245,235,.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-14, 0, 12, -.9, .9); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
  function shotGround(ctx, f) {
    if (f.style === 'kunai' || f.style === 'wind') return;
    const k = c01(f.t / f.dur);
    ctx.fillStyle = 'rgba(20,24,12,.18)';
    ell(ctx, lerp(f.x0, f.tx, k), lerp(f.y0, f.ty, k) + 2, 6, 2.4);
  }
  function shieldGround(ctx, f) {
    const t = f.t, R = f.R, rise = eBack(t / .22), crumble = c01((t - 1.0) / .4);
    if (rise <= 0) return;
    ctx.save();
    ctx.globalAlpha = 1 - crumble;
    ctx.fillStyle = SAND.dark; ell(ctx, f.x, f.y + 3, R * 1.05, R * .46);
    // the back half of the dome stands behind the ninja
    const H = R * 1.25 * rise;
    ctx.fillStyle = SAND.base;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 3, R, H, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = SAND.mid;
    ctx.beginPath(); ctx.ellipse(f.x - R * .25, f.y + 3, R * .55, H * .9, 0, Math.PI, TAU); ctx.fill();
    ctx.restore();
  }
  function shieldOver(ctx, f, time, K) {
    const t = f.t, R = f.R, rise = eBack(t / .22), crumble = c01((t - 1.0) / .4);
    ctx.save();
    const H = R * 1.25 * rise, cy = f.y + 3;
    if (crumble < 1) {
      // translucent front shell so the ninja shows through, with sand bands and a hard rim
      ctx.globalAlpha = (1 - crumble) * .62;
      ctx.fillStyle = SAND.base;
      ctx.beginPath(); ctx.ellipse(f.x, cy, R, H, 0, Math.PI, TAU); ctx.ellipse(f.x, cy, R, R * .44, 0, 0, Math.PI); ctx.fill();
      ctx.globalAlpha = 1 - crumble;
      ctx.strokeStyle = SAND.dark; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(f.x, cy, R, H, 0, Math.PI, TAU); ctx.stroke();
      ctx.strokeStyle = SAND.light; ctx.lineWidth = 1.4;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath(); ctx.ellipse(f.x, cy - H * i * .22, R * Math.sqrt(1 - (i * .22) ** 2), R * .42 * Math.sqrt(1 - (i * .22) ** 2), 0, .2, Math.PI - .2); ctx.stroke();
      }
      if (t < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, f.x, cy - H * .5, R * 1.3, '255,225,160', .45 * (1 - t / .25), true); }
    }
    if (crumble > 0) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1 - crumble;
      ctx.fillStyle = SAND.base;
      for (let i = 0; i < 18; i++) {
        const a = Math.PI + hash(f.seed + i) * Math.PI, hh = hash(f.seed + i * 3);
        ctx.fillRect(f.x + Math.cos(a) * R * .9, cy + Math.sin(a) * H * hh + crumble * crumble * 30 * (1 - hh * .5), 3, 3);
      }
    }
    ctx.restore();
  }

  // ---------- Mei: lava, puddle, mist, dragon
  function lavaPos(f, k) {
    return [lerp(f.x0, f.tx, k), lerp(f.y0, f.ty, k) - 44 * (1 - k) - f.h * 4 * k * (1 - k)];
  }
  function lavaGround(ctx, f) {
    const k = c01(f.t / f.dur);
    ctx.fillStyle = 'rgba(30,14,8,.25)';
    ell(ctx, lerp(f.x0, f.tx, k), lerp(f.y0, f.ty, k) + 2, 8, 3.2);
  }
  function lavaOver(ctx, f, time, K) {
    const k = c01(f.t / f.dur);
    const [x, y] = lavaPos(f, k);
    const [px, py] = lavaPos(f, Math.max(0, k - .08));
    const ang = Math.atan2(y - py, x - px);
    ctx.save();
    // drips trailing behind
    for (let i = 1; i <= 3; i++) {
      const [dx, dy] = lavaPos(f, Math.max(0, k - i * .045));
      ctx.fillStyle = i === 1 ? '#d1400c' : '#a52a08';
      ell(ctx, dx, dy, 5 - i, 5 - i);
    }
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#7a1a06'; ell(ctx, 0, 0, 13, 10);
    ctx.fillStyle = '#e24a0e'; ell(ctx, 1, -1, 10.5, 8);
    ctx.fillStyle = '#ffa034'; ell(ctx, 3, -2, 5, 3.4);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, 24, '255,110,30', .65, true);
    ctx.restore();
  }
  function splashOver(ctx, f, time, K) {
    const k = c01(f.t / f.dur);
    ctx.save();
    for (let i = 0; i < 9; i++) {
      const a = hash(f.seed + i) * TAU, sp = 26 + hash(f.seed + i * 2) * 26;
      const px = f.x + Math.cos(a) * sp * eOut(k), py = f.y - 4 + Math.sin(a) * sp * .5 * eOut(k) - 34 * bell(k) * (.5 + hash(i + f.seed));
      ctx.fillStyle = '#7a1a06'; ell(ctx, px, py + .8, 5 * (1 - k * .5), 4.4 * (1 - k * .5));
      ctx.fillStyle = i % 2 ? '#e24a0e' : '#ff8a24';
      ell(ctx, px, py, 4 * (1 - k * .5), 3.6 * (1 - k * .5));
    }
    if (k < .5) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, f.x, f.y - 6, 40, '255,120,40', 1 - k * 2, true, .7); }
    ctx.restore();
  }
  function puddleGround(ctx, f, time, K) {
    const t = f.t, grow = eOut(t / .2), cool = c01((t - (f.dur - 1)) / 1), r = f.r * grow;
    ctx.save();
    ctx.globalAlpha = 1 - c01((t - (f.dur - .4)) / .4);
    const blob = (s) => {
      ctx.beginPath();
      // smooth lumpy outline through the midpoints of a jittered ring
      const n = 10, px = [], py = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, rr = r * s * (.8 + .3 * hash(f.seed + i));
        px.push(f.x + Math.cos(a) * rr); py.push(f.y + Math.sin(a) * rr * .46);
      }
      ctx.moveTo((px[n - 1] + px[0]) / 2, (py[n - 1] + py[0]) / 2);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; ctx.quadraticCurveTo(px[i], py[i], (px[i] + px[j]) / 2, (py[i] + py[j]) / 2); }
      ctx.closePath(); ctx.fill();
    };
    ctx.fillStyle = '#3a140a'; blob(1);
    ctx.fillStyle = cool > .5 ? '#5a2410' : '#b8300a'; blob(.8);
    ctx.fillStyle = `rgba(255,${120 + 40 * Math.sin(time * 5 + f.seed)},30,${.9 * (1 - cool)})`; blob(.52);
    // dark crust plates on the molten surface
    ctx.fillStyle = 'rgba(50,16,8,.85)';
    for (let i = 0; i < 4; i++) {
      const a = hash(f.seed + i * 5) * TAU, d = r * .45 * hash(f.seed + i * 7);
      ell(ctx, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * .46, r * .14, r * .07);
    }
    // bubbles
    for (let i = 0; i < 3; i++) {
      const ph = (time * 1.4 + hash(f.seed + i * 9)) % 1, a = hash(f.seed + i * 11 + Math.floor(time * 1.4)) * TAU, d = r * .4 * hash(i + f.seed);
      ctx.strokeStyle = `rgba(255,190,90,${(1 - ph) * (1 - cool)})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * .46, 1.5 + ph * 3, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, f.x, f.y, r * 1.2, '255,90,20', .45 * (1 - cool), false, .46);
    ctx.globalCompositeOperation = 'source-over';
    // licking flames
    if (cool < .8) {
      for (let i = 0; i < 3; i++) {
        const a = hash(f.seed + i * 13) * TAU, d = r * .5 * hash(f.seed + i * 17);
        const h = (16 + 10 * hash(i + f.seed)) * (1 - cool) * (.85 + .15 * Math.sin(time * 9 + i));
        const px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d * .46;
        ctx.drawImage(K.flame(i + Math.floor(time * 8)), px - h * .22, py - h * (114 / 128), h * .44, h);
      }
    }
    ctx.restore();
  }
  function mistGround(ctx, f) {
    const k = eOut(f.t / .6), fade = 1 - c01((f.t - (f.dur - .9)) / .9);
    ctx.save(); ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(190,206,110,.25)'; ell(ctx, f.x, f.y, f.r * k, f.r * .48 * k);
    ctx.strokeStyle = 'rgba(120,140,40,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * k, f.r * .48 * k, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function mistOver(ctx, f, time, K) {
    const t = f.t, k = eOut(t / .7), fade = 1 - c01((t - (f.dur - .9)) / .9);
    const puff = mistPuff(K);
    ctx.save();
    // first the breath travelling from Mei to the spot
    if (t < .5) {
      const s = t / .5;
      for (let i = 0; i < 5; i++) {
        const q = c01(s - i * .08);
        K.stamp(ctx, puff, lerp(f.x0, f.x, q), lerp(f.y0, f.y, q) - 38 + 20 * q, 12 + 26 * q, .7 * (1 - s * .4));
      }
    }
    for (let i = 0; i < 13; i++) {
      const a = i * 2.39 + f.seed, d = f.r * .7 * Math.sqrt(hash(f.seed + i)) * k;
      const px = f.x + Math.cos(a) * d + Math.sin(time * .5 + i) * 12;
      const py = f.y + Math.sin(a) * d * .46 - 18 - (i % 3) * 9 + Math.cos(time * .6 + i) * 4;
      K.stamp(ctx, puff, px, py, f.r * (.34 + .12 * hash(i * 3 + f.seed)) * k, .44 * fade);
    }
    // acid sizzle: yellow-green specks rising
    ctx.fillStyle = '#e9ff8a';
    for (let i = 0; i < 10; i++) {
      const ph = (time * .8 + hash(f.seed + i * 5)) % 1, a = hash(f.seed + i * 7) * TAU, d = f.r * .8 * hash(f.seed + i * 9);
      ctx.globalAlpha = fade * bell(ph) * .9;
      ctx.fillRect(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * .46 - ph * 46, 2, 2);
    }
    ctx.restore();
  }
  function dragonPath(f) {
    const mx = (f.x0 + f.tx) / 2, top = Math.min(f.y0, f.ty) - 190;
    return [f.x0, f.y0 - 10, mx + (f.x0 - f.tx) * .15, top, f.tx, f.ty - 16];
  }
  function dragonOver(ctx, f, time, K) {
    const t = f.t, [x0, y0, cx, cy, x1, y1] = dragonPath(f);
    const head = eInOut(t / f.hitAt), done = c01((t - f.hitAt) / (f.dur - f.hitAt));
    const water = sprayPuff(K);
    ctx.save();
    // water erupting where it rises
    if (t < .5) for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU, k = t / .5;
      K.stamp(ctx, water, x0 + Math.cos(a) * 16 * k, y0 + Math.sin(a) * 6 * k - 10 - 18 * bell(k), 10 + 6 * k, (1 - k) * .9);
    }
    if (done < 1) {
      const tail = Math.max(0, head - .62), front = head;
      const fade = 1 - done;
      ctx.globalAlpha = fade;
      tube(ctx, x0, y0, cx, cy, x1, y1, tail + done * (front - tail), front, 3, 21, 3.5, time * 8);
      ctx.fillStyle = '#123f7a'; ctx.fill();
      tube(ctx, x0, y0, cx, cy, x1, y1, tail + done * (front - tail), front, 2, 17.5, 3.5, time * 8);
      ctx.fillStyle = '#3d9de6'; ctx.fill();
      tube(ctx, x0, y0 - 3, cx, cy - 3, x1, y1 - 3, tail + done * (front - tail) + .02, front - .02, .8, 6, 2, time * 8 + 1);
      ctx.fillStyle = '#c8efff'; ctx.fill();
      // foam droplets peeling off the body
      ctx.fillStyle = 'rgba(235,250,255,.9)';
      for (let i = 0; i < 8; i++) {
        const q = lerp(tail, front, hash(f.seed + i)), [px, py] = bez(x0, y0, cx, cy, x1, y1, q);
        ell(ctx, px + Math.sin(time * 9 + i) * 8, py + Math.cos(time * 7 + i) * 6, 1.8, 1.8);
      }
      if (done === 0) {
        const [hx, hy] = bez(x0, y0, cx, cy, x1, y1, front), [bx, by] = bez(x0, y0, cx, cy, x1, y1, Math.max(0, front - .03));
        dragonHead(ctx, hx, hy, Math.atan2(hy - by, hx - bx), 27, .4 + .3 * Math.sin(time * 10));
      }
      ctx.globalAlpha = 1;
    }
    // the crash of water at the target
    if (t >= f.hitAt) {
      const k = c01((t - f.hitAt) / (f.dur - f.hitAt));
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU + f.seed, d = 70 * eOut(k);
        K.stamp(ctx, water, f.tx + Math.cos(a) * d, f.ty + Math.sin(a) * d * .48 - 14 - 30 * bell(k) * hash(i + f.seed), 16 + 8 * k, (1 - k) * .9);
      }
      if (k < .5) groundRing(ctx, f.tx, f.ty, 110, k * 2, 1 - k * 2, '#1f6fc0', '#d8f4ff');
      ctx.fillStyle = 'rgba(235,250,255,.9)';
      for (let i = 0; i < 14; i++) {
        const a = hash(f.seed + i * 3) * TAU, d = 20 + 80 * eOut(k) * hash(f.seed + i), hh = 50 * bell(k) * hash(i * 7 + f.seed);
        ctx.globalAlpha = 1 - k;
        ell(ctx, f.tx + Math.cos(a) * d, f.ty + Math.sin(a) * d * .46 - hh, 2.2, 2.2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function dragonGround(ctx, f) {
    if (f.t < f.hitAt) {
      const k = c01(f.t / f.hitAt);
      ctx.fillStyle = `rgba(20,60,110,${.12 + .2 * k})`;
      ell(ctx, f.tx, f.ty + 2, 30 + 60 * k, (30 + 60 * k) * .46);
      return;
    }
    const k = c01((f.t - f.hitAt) / (f.dur - f.hitAt + .6));
    ctx.fillStyle = `rgba(40,90,140,${.35 * (1 - k)})`;
    ell(ctx, f.tx, f.ty + 2, 100, 46);
  }

  // ---------- Ay: trails, sparks, Liger blast
  function ayTrailGround(ctx, f, time, K) {
    const k = c01(f.t / f.dur), S = sprites();
    ctx.save();
    const lariat = f.style === 'lariat';
    // scorched streak on the ground
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = 'rgba(30,34,52,.4)'; ctx.lineWidth = lariat ? 14 : 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.x0, f.y0 + 3); ctx.lineTo(f.x1, f.y1 + 3); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    K.forkedBolt(ctx, f.x0, f.y0 - 20, f.x1, f.y1 - 20, f.seed, time, { jitter: 12, alpha: 1 - k, width: lariat ? 2 : 1.5, pal: AY_PAL, base: `rgba(30,80,200,${.55 * (1 - k)})`, forks: 3, forkLen: 18, step: 18, rate: 18 });
    ctx.globalCompositeOperation = 'source-over';
    // after-images left by the Raikage's speed
    const id = S && S.has('ay') ? 'ay' : 'kisame';
    if (S && k < .7) {
      const facing = f.x1 >= f.x0 ? 1 : -1;
      for (let i = 1; i <= 3; i++) {
        const q = i / 4;
        S.draw(ctx, id, lerp(f.x0, f.x1, q), lerp(f.y0, f.y1, q) + 3, { facing, frame: lariat ? 'attack' : 'run', phase: i * 2, alpha: (1 - k / .7) * .35 * q });
      }
    }
    ctx.restore();
  }
  function sparkOver(ctx, f, time, K) {
    const k = c01(f.t / f.dur);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, f.x, f.y - 20, f.r * 1.2, '130,190,255', (1 - k) * .9, true);
    for (let i = 0; i < 4; i++) {
      const a = hash(f.seed + i) * TAU, l = f.r * (.6 + .5 * hash(f.seed + i * 2)) * (.4 + .6 * eOut(k));
      K.forkedBolt(ctx, f.x, f.y - 20, f.x + Math.cos(a) * l, f.y - 20 + Math.sin(a) * l * .6, f.seed + i * 7, time, { jitter: 5, alpha: 1 - k, width: .9, pal: AY_PAL, base: `rgba(30,80,200,${.5 * (1 - k)})`, step: 8, rate: 26 });
    }
    ctx.restore();
  }
  function ligerOver(ctx, f, time, K) {
    const k = c01(f.t / f.dur);
    ctx.save();
    K.fx.lightningBlast(ctx, f.x, f.y, f.r, k, 1 - k, time, f.seed);
    ctx.restore();
  }

  // ---------- Ōnoki: boulder, Jinton
  function boulderPos(f) {
    const t = f.t;
    if (t < .2) return [f.x0, f.y0, 26 + 10 * eOut(t / .2), eBack(t / .2)];
    if (t < f.hitAt) {
      const q = (t - .2) / (f.hitAt - .2), k = q * (.6 + .4 * q);
      return [lerp(f.x0, f.tx, k), lerp(f.y0, f.ty, k), (36 + 70 * Math.sin(Math.PI * Math.min(1, k * 1.15))) * (1 - k) + 20 * (1 - k), 1 + .35 * k];
    }
    return [f.tx, f.ty, 0, 1];
  }
  function boulderGround(ctx, f, time, K) {
    const [x, y, h, s] = boulderPos(f);
    ctx.save();
    if (f.t < f.hitAt) {
      ctx.fillStyle = 'rgba(20,16,10,.3)'; ell(ctx, x, y + 3, f.r * s * 1.1, f.r * s * .45);
      // dust kicked up along its path
      const dust = K.puff('dust');
      for (let i = 1; i <= 4; i++) {
        const q = c01((f.t - .2) / (f.hitAt - .2)) - i * .06; if (q <= 0) continue;
        K.stamp(ctx, dust, lerp(f.x0, f.tx, q), lerp(f.y0, f.ty, q) - 4, 10 + i * 2, .5 - i * .08);
      }
    } else {
      const k = c01((f.t - f.hitAt) / (f.dur - f.hitAt));
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = 'rgba(60,44,30,.6)'; ell(ctx, x, y + 2, 64, 28);
      ctx.strokeStyle = '#2b1f16'; ctx.lineWidth = 2.2;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + f.seed, l = 50 + 40 * hash(f.seed + i);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 9);
        ctx.lineTo(x + Math.cos(a + .15) * l * .6, y + Math.sin(a + .15) * l * .27); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * .45); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function boulderOver(ctx, f, time, K) {
    const [x, y, h, s] = boulderPos(f);
    const rock = rockSprite(K);
    ctx.save();
    if (f.t < f.hitAt + .08) {
      const w = f.r * 2.4 * s, hh = w * 80 / 96;
      // heavy-weight lines pressing down on it
      ctx.strokeStyle = 'rgba(60,60,70,.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const ox = (i - 1.5) * w * .22, ph = (time * 3 + i * .3) % 1;
        ctx.beginPath(); ctx.moveTo(x + ox, y - h - hh * .9 - 22 + ph * 12); ctx.lineTo(x + ox, y - h - hh * .9 - 8 + ph * 12); ctx.stroke();
      }
      ctx.translate(x, y - h - hh * .45);
      ctx.rotate(Math.sin(f.t * 9) * .08 * (f.t < f.hitAt ? 1 : 0));
      ctx.drawImage(rock, -w / 2, -hh / 2, w, hh);
    } else {
      const k = c01((f.t - f.hitAt) / (f.dur - f.hitAt));
      K.fx.debris(ctx, x, y, 80, k, f.seed, '#6e5640', 14);
      const dust = K.puff('dust');
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU, d = 30 + 50 * eOut(k);
        K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .46 - 12 - k * 10, 18 + 10 * k, (1 - k) * .85);
      }
      if (k < .4) groundRing(ctx, x, y, 100, k / .4, 1 - k / .4, '#5e4632', '#e8d6b8');
    }
    ctx.restore();
  }
  function jintonGround(ctx, f, time, K) {
    const t = f.t;
    if (t < .2) return;
    const grow = eBack((t - .2) / .4), h = f.R * .62 * Math.min(1.05, grow);
    const yaw = .5 + t * .4;
    cubePoints(f.x, f.y, h, yaw);
    ctx.save();
    if (t < f.hitAt + .2) {
      ctx.fillStyle = 'rgba(30,40,60,.22)';
      ctx.beginPath(); ctx.moveTo(CX[0], CY[0]); ctx.lineTo(CX[1], CY[1]); ctx.lineTo(CX[5], CY[5]); ctx.lineTo(CX[4], CY[4]); ctx.closePath(); ctx.fill();
    } else {
      // the ground inside is stripped clean: a pale, sharp-edged footprint fading away
      const k = c01((t - f.hitAt - .2) / (f.dur - f.hitAt - .2));
      cubePoints(f.x, f.y, f.R * .62, .5 + (f.hitAt + .2) * .4);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = 'rgba(236,240,244,.7)';
      ctx.beginPath(); ctx.moveTo(CX[0], CY[0]); ctx.lineTo(CX[1], CY[1]); ctx.lineTo(CX[5], CY[5]); ctx.lineTo(CX[4], CY[4]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(60,72,90,.7)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
  function jintonOver(ctx, f, time, K) {
    const t = f.t;
    ctx.save();
    // the small cube shoots out of his hands along a thin beam
    if (t < .24) {
      const k = eOut(t / .2), x = lerp(f.x0, f.x, k), y = lerp(f.y0, f.y - 50, k);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(220,240,255,.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      drawCube(ctx, x, y + 12, 12, time * 4, 1, K);
    } else if (t < f.hitAt + .25) {
      // it swells into a huge cube with the white core growing, then everything inside turns to light
      const grow = eBack((t - .2) / .4), h = f.R * .62 * Math.min(1.05, grow);
      const white = c01((t - f.hitAt + .15) / .2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(200,230,255,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x, f.y - h * .95); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      drawCube(ctx, f.x, f.y, h, .5 + t * .4, 1, K, white);
      if (white > 0) {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, f.x, f.y - h, h * 2.6, '235,245,255', white, true);
      }
    } else {
      // vanish: a white flash collapsing, light shards drifting up
      const k = c01((t - f.hitAt - .25) / .7);
      if (k < 1) {
        const h = f.R * .62;
        ctx.globalAlpha = 1 - k;
        drawCube(ctx, f.x, f.y, h * (1 - k * .2), .5 + t * .4, (1 - k) * .6, K, 1 - k);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, f.x, f.y - h, h * 2 * (1 - k * .5), '235,245,255', 1 - k, true);
        ctx.fillStyle = `rgba(240,248,255,${1 - k})`;
        for (let i = 0; i < 14; i++) {
          const a = hash(f.seed + i) * TAU, d = h * hash(f.seed + i * 3);
          ctx.fillRect(f.x + Math.cos(a) * d, f.y - h + Math.sin(a) * d * .6 - k * 60 * (.5 + hash(i)), 3, 3);
        }
      }
    }
    ctx.restore();
  }

  // ---------- shinobi cheap effects
  function slashOver(ctx, f) {
    const k = c01(f.t / f.dur), al = 1 - k;
    ctx.save();
    ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.scale(1, f.flip);
    ctx.lineCap = 'round';
    ctx.globalAlpha = al;
    ctx.strokeStyle = 'rgba(24,28,40,.75)'; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.arc(-6, 0, 19, -1.2 + k * .6, .9 + k * .6); ctx.stroke();
    ctx.strokeStyle = f.color || '#bfe3ff'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(-6, 0, 19, -1.15 + k * .6, .85 + k * .6); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-6, 0, 19, -1 + k * .6, .7 + k * .6); ctx.stroke();
    ctx.restore();
  }
  function popOver(ctx, f, time, K) {
    const k = c01(f.t / f.dur);
    ctx.save();
    if (f.style === 'fire') {
      for (let i = 0; i < 3; i++) {
        const h = (24 + 10 * hash(f.seed + i)) * bell(k * .9 + .1);
        const px = f.x + (i - 1) * 9;
        ctx.drawImage(K.flame(i + Math.floor(f.seed)), px - h * .22, f.y + 2 - h * (114 / 128), h * .44, h);
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.x, f.y - 10, 36, '255,140,50', (1 - k) * .8, true);
    } else if (f.style === 'water') {
      const water = sprayPuff(K);
      K.stamp(ctx, water, f.x, f.y - 14, 12 + 10 * k, (1 - k) * .8);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + f.seed, d = 30 * eOut(k);
        const px = f.x + Math.cos(a) * d, py = f.y - 12 + Math.sin(a) * d * .5 - 18 * bell(k) * (.6 + .6 * hash(i + f.seed));
        ctx.fillStyle = '#2a7fcf'; ell(ctx, px, py + .6, 3 * (1 - k * .5), 2.6 * (1 - k * .5));
        ctx.fillStyle = '#cfefff'; ell(ctx, px - .5, py - .4, 1.6 * (1 - k * .5), 1.3 * (1 - k * .5));
      }
      groundRing(ctx, f.x, f.y, 40, k, 1 - k, '#1f6fc0', '#d8f4ff');
    }
    ctx.restore();
  }
  function boltOver(ctx, f, time, K) {
    const k = c01(f.t / f.dur);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    K.forkedBolt(ctx, f.x0, f.y0 - 28, f.x1, f.y1 - 22, f.seed, time, { jitter: 9, alpha: 1 - k, width: 1.3, pal: ['255,230,120', '255,245,190', '255,255,255'], base: `rgba(200,140,20,${.6 * (1 - k)})`, forks: 2, forkLen: 14, step: 14, rate: 30 });
    ctx.restore();
  }
  function spikesGround(ctx, f) {
    const t = f.t, up = eBack(t / .14), down = c01((t - .5) / .3);
    const h = 26 * up * (1 - down);
    if (h <= .5) return;
    ctx.save();
    ctx.fillStyle = 'rgba(40,28,18,.35)'; ell(ctx, f.x, f.y + 2, 46, 20);
    for (let i = 0; i < 6; i++) {
      const a = hash(f.seed + i) * TAU, d = 30 * hash(f.seed + i * 3);
      const px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d * .46, hh = h * (.7 + .5 * hash(f.seed + i * 5)), w = 6 + 3 * hash(i);
      ctx.fillStyle = '#5c4430';
      ctx.beginPath(); ctx.moveTo(px - w, py); ctx.lineTo(px + 1, py - hh); ctx.lineTo(px + w, py); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a7865f';
      ctx.beginPath(); ctx.moveTo(px - w, py); ctx.lineTo(px + 1, py - hh); ctx.lineTo(px - 1, py); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function poofOver(ctx, f, time, K) {
    const S = sprites();
    if (S) S.drawSmoke(ctx, f.x, f.y - f.r * .5, c01(f.t / f.dur), f.r);
  }

  // Two-tone expanding ring on the ground (source-over, so it reads on grass and on dirt).
  function groundRing(ctx, x, y, r, k, alpha, dark, light) {
    if (alpha <= 0) return;
    const rr = r * (.2 + .9 * eOut(k));
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, alpha);
    ctx.strokeStyle = dark; ctx.lineWidth = 2 + 6 * alpha;
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .46, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = light; ctx.lineWidth = 1 + 1.6 * alpha;
    ctx.beginPath(); ctx.ellipse(x, y - 2, rr * .98, rr * .45, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  const GROUND = {
    crater: craterGround, okasho: okashoGround, heal: healGround, coffin: coffinGround, tsunami: tsunamiGround,
    shot: shotGround, shield: shieldGround, lava: lavaGround, puddle: puddleGround, mist: mistGround, dragon: dragonGround,
    ayTrail: ayTrailGround, boulder: boulderGround, jinton: jintonGround, spikes: spikesGround
  };
  const OVER = {
    crater: craterOver, okasho: okashoOver, katsuyu: katsuyuOver, heal: healOver, coffin: coffinOver, tsunami: tsunamiOver,
    shot: shotOver, shield: shieldOver, lava: lavaOver, splash: splashOver, mist: mistOver, dragon: dragonOver,
    spark: sparkOver, liger: ligerOver, boulder: boulderOver, jinton: jintonOver, slash: slashOver, pop: popOver,
    bolt: boltOver, poof: poofOver
  };

  function drawGround(ctx, state, time) {
    const K = kit();
    if (!ctx || !state || !state.fx || !K) return;
    for (const f of state.fx) { const fn = GROUND[f.kind]; if (fn) fn(ctx, f, time, K); }
  }
  function drawOverlay(ctx, state, time) {
    const K = kit();
    if (!ctx || !state || !state.fx || !K) return;
    for (const f of state.fx) { const fn = OVER[f.kind]; if (fn) fn(ctx, f, time, K); }
    // jutsu names called out over the Kage's heads
    const S = sprites();
    if (!state.allies || !S) return;
    ctx.save();
    ctx.font = '900 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const a of state.allies) {
      if (!a.call || a.kind !== 'kage') continue;
      const k = a.call.t / a.call.max, rise = (1 - k) * 10;
      const y = a.y + 3 - (a.lift || 0) - (a.id === 'onoki' ? 14 : 0) - S.height(spriteOf(a)) - 18 - rise;
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.lineWidth = 4; ctx.strokeStyle = '#160f1d'; ctx.strokeText(a.call.text, a.x, y);
      ctx.fillStyle = KAGE[a.id].color; ctx.fillText(a.call.text, a.x, y);
    }
    ctx.restore();
  }

  window.WarAllies = { createForces, update, blast, drawAlly, drawGround, drawOverlay, tuning, KAGE, SQUADS, MOVES };
})();
