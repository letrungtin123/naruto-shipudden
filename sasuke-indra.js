/* Summoned Sasuke, Indra's reincarnation (B key).
 * Sasuke fights beside Naruto with his whole arsenal: Chidori Eisō, Chidori Nagashi, Amaterasu,
 * Enton Kagutsuchi, Amenotejikara, Susanoo arrows, Kirin, and the ultimate Indra's Arrow fired
 * from a winged violet Perfect Susanoo.
 *
 * State (`st` = indraState, sent to teammates as JSON ~20×/s): { ally: {...} | null, effects: [...] }.
 * Everything drawn comes from plain numbers on those objects; `ally.target` (a live enemy) is skipped
 * by the serializer. Hits land only in `update`, which runs on the owner's machine.
 * Sasuke's lightning is dark violet with an inked near-black edge so it reads on bright ground.
 */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const MAX_FX = 16;
  const ULT_COOLDOWN = 17;      // seconds between Indra's Arrows
  const FIRST_ULT = 8;          // the first one comes early
  const GAP = 1.05;             // breath between two jutsu
  const SPRITE = 'sasuke_indra';
  const K = () => window.VFXKit;
  const SPR = () => window.AnimeSprites;
  const lift = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const frac = v => v - Math.floor(v);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const alive = z => !!z && z.health > 0;
  const R = Math.round;
  const turn = (a, b, max) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-max, Math.min(max, d)); };

  // ------------------------------------------------------------------ palette
  const PAL = ['120,24,220', '178,62,255', '232,196,255'];
  const PAL_HOT = ['170,40,240', '206,104,255', '246,226,255'];
  const INK = 'rgba(22,0,44,.78)';
  const ink = a => `rgba(22,0,44,${(.78 * clamp01(a)).toFixed(3)})`;
  const BODY = '74,16,160';
  const MAGENTA = '200,40,225';
  // Susanoo mantle: violet flames.
  const VIOLET_FLAME = [[1, '#3a0f6e'], [.84, '#6a24c0'], [.66, '#9450ff'], [.46, '#c79bff'], [.25, '#f4eaff']];
  const FLAME_BASE = 114 / 128;

  // ------------------------------------------------------------------ moves
  const MOVES = {
    eiso:       { label: 'CHIDORI EISŌ · LÔI THƯƠNG', jp: '千鳥鋭槍', range: 640, dist: 360, lock: .95 },
    tejikara:   { label: 'AMENOTEJIKARA · THIÊN THỦ LỰC', jp: '天手力', range: 900, dist: 520, lock: .8 },
    amaterasu:  { label: 'AMATERASU · THIÊN CHIẾU', jp: '天照', range: 780, dist: 460, lock: 1 },
    arrows:     { label: 'SUSANOO · TU TÁ NĂNG HỒ TIỄN', jp: '須佐能乎', range: 880, dist: 500, lock: 1.45 },
    nagashi:    { label: 'CHIDORI NAGASHI · THIÊN ĐIỂU LƯU', jp: '千鳥流し', range: 150, dist: 60, lock: .95 },
    kirin:      { label: 'KIRIN · KỲ LÂN', jp: '麒麟', range: 920, dist: 480, lock: 1.85 },
    kagutsuchi: { label: 'VIÊM ĐỘN · KAGUTSUCHI', jp: '炎遁・加具土命', range: 540, dist: 320, lock: 1.05 },
    indra:      { label: 'INDRA TIỄN', jp: 'インドラの矢', range: 1050, dist: 520, lock: 3.6 }
  };
  const CYCLE = ['eiso', 'tejikara', 'amaterasu', 'arrows', 'nagashi', 'kirin', 'kagutsuchi'];
  const POSE = {
    eiso: t => t < .3 ? 'seal' : 'attack',
    tejikara: () => 'attack',
    amaterasu: () => 'seal',
    arrows: () => 'raise',
    nagashi: t => t < .26 ? 'seal' : 'raise',
    kirin: t => t < 1.3 ? 'raise' : 'attack',
    kagutsuchi: t => t < .3 ? 'seal' : 'attack',
    indra: t => t < 2 ? 'raise' : 'attack'
  };
  // Indra's Arrow timeline: Susanoo rises, the arrow is drawn, then released.
  const IN_RISE = 1, IN_FIRE = 2;
  const ARROW_REL = .62, KIRIN_STRIKE = 1.15, KIRIN_HIT = 1.35;

  let fxSeq = 0;
  function addFx(st, kind, props) {
    const list = st.effects;
    if (list.length >= MAX_FX) {
      let k = list.findIndex(f => f.kind !== 'indra' && f.kind !== 'kirin');
      if (k < 0) k = 0;
      list.splice(k, 1);
    }
    const fx = Object.assign({ kind, id: ++fxSeq, s: 0, maxLife: props.life }, props);
    list.push(fx);
    return fx;
  }
  function findFx(st, id) { for (const f of st.effects) if (f.id === id) return f; return null; }

  // ------------------------------------------------------------------ hits (owner only)
  const HIT = {
    summon(fx, age, api) {
      if (fx.s === 0 && age >= .12) {
        fx.s = 1;
        api.circle(fx.x, fx.y, 170, 800, 60);
        api.world(fx.x, fx.y, 95, 420, 'lightning');
        api.shake(10);
      }
    },
    eiso(fx, age, api) {
      if (fx.s === 0 && age >= .32) {
        fx.s = 1;
        const x2 = fx.x + Math.cos(fx.a) * fx.len, y2 = fx.y + Math.sin(fx.a) * fx.len;
        const n = api.line(fx.x, fx.y, x2, y2, 38, 1900, 46, 'lightning');
        api.world(x2, y2, 85, 1300, 'lightning', fx.a);
        api.shake(n ? 11 : 6);
      }
    },
    nagashi(fx, age, api) {
      if (fx.s === 0 && age >= .26) {
        fx.s = 1;
        api.circle(fx.x, fx.y, fx.r, 1400, 75, .2);
        api.world(fx.x, fx.y, 120, 900, 'lightning');
        api.shake(12);
      } else if (fx.s === 1 && age >= .56) {
        fx.s = 2;
        api.circle(fx.x, fx.y, fx.r, 800, 30, .2);
      }
    },
    amaterasu(fx, age, api) {
      if (fx.s === 0 && age >= .5) {
        fx.s = 1;
        api.circle(fx.x, fx.y, fx.r, 1200, 0);
        api.world(fx.x, fx.y, 140, 900, 'fire');
        api.shake(9);
      }
      // The black flames keep burning: damage over time while the patch lives.
      if (fx.s >= 1 && age >= fx.nt && fx.life > .5) {
        fx.nt += .4;
        api.circle(fx.x, fx.y, fx.r, 280, 0);
      }
    },
    kagutsuchi(fx, age, api) {
      while (fx.s < 5 && age >= kaguLaunch(fx.s)) {
        const i = KAGU_ORDER[fx.s], a = fx.a + (i - 2) * .2;
        const x2 = fx.x + Math.cos(a) * fx.len, y2 = fx.y + Math.sin(a) * fx.len;
        api.line(fx.x, fx.y, x2, y2, 30, 1200, 30, i === 2 ? 'fire' : undefined);
        if (i === 2) api.world(x2, y2, 90, 900, 'fire', a);
        fx.s++;
        api.shake(6);
      }
    },
    tejikara(fx, age, api) {
      if (fx.s === 0 && age >= .1) {
        fx.s = 1;
        api.cone(fx.x, fx.y, fx.a, 230, 1.3, 2200, 70);
        api.circle(fx.x, fx.y, 120, 600, 30);
        api.world(fx.x + Math.cos(fx.a) * 90, fx.y + Math.sin(fx.a) * 90, 75, 900, 'blade', fx.a);
        api.shake(11);
      }
    },
    arrows(fx, age, api) {
      while (fx.s < 7 && age >= arrowRelease(ARROW_ORDER[fx.s])) {
        const i = ARROW_ORDER[fx.s], a = fx.a + (i - 3) * .12;
        const x2 = fx.x + Math.cos(a) * fx.len, y2 = fx.y + Math.sin(a) * fx.len;
        api.line(fx.x, fx.y, x2, y2, 28, 1400, 40, i === 3 ? 'lightning' : undefined);
        if (i === 3) api.world(x2, y2, 100, 1100, 'lightning', a);
        fx.s++;
      }
      if (fx.s === 7 && !fx.sh) { fx.sh = 1; api.shake(12); }
    },
    kirin(fx, age, api) {
      if (fx.s === 0 && age >= KIRIN_HIT) {
        fx.s = 1;
        api.circle(fx.x, fx.y, fx.r, 4400, 90, .35);
        api.world(fx.x, fx.y, 270, 2800, 'lightning');
        api.shake(26);
      } else if (fx.s === 1 && age >= KIRIN_HIT + .4) {
        fx.s = 2;
        api.circle(fx.x, fx.y, fx.r, 900, 0);
      }
    },
    indra(fx, age, api) {
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a), x1 = fx.x + ca * 60, y1 = fx.y + sa * 60;
      const x2 = fx.x + ca * (60 + fx.len), y2 = fx.y + sa * (60 + fx.len);
      if (fx.s === 0 && age >= IN_FIRE) {
        fx.s = 1;
        api.line(x1, y1, x2, y2, 80, 8200, 130, 'crater');
        for (const [t, r] of [[.5, 150], [1, 210]])
          api.world(fx.x + ca * (60 + fx.len * t), fx.y + sa * (60 + fx.len * t), r, 4200, 'crater', fx.a);
        api.shake(32);
      } else if ((fx.s === 1 && age >= IN_FIRE + .35) || (fx.s === 2 && age >= IN_FIRE + .7)) {
        fx.s++;
        api.line(x1, y1, x2, y2, 80, 750, 40);
      }
    },
    slash(fx, age, api) {
      if (fx.s === 0 && age >= .03) {
        fx.s = 1;
        if (api.cone(fx.x, fx.y, fx.a, 125, 1.15, 700, 22)) api.shake(4);
      }
    }
  };
  // Kagutsuchi blades and Susanoo arrows leave the centre one first, then fan out.
  const KAGU_ORDER = [2, 1, 3, 0, 4];
  const kaguLaunch = n => .3 + n * .05;
  const kaguIndexTime = i => kaguLaunch(KAGU_ORDER.indexOf(i));
  const ARROW_ORDER = [3, 2, 4, 1, 5, 0, 6];
  const arrowRelease = i => ARROW_REL + Math.abs(i - 3) * .035;

  // ------------------------------------------------------------------ casting
  const CAST = {
    eiso: (st, al) => addFx(st, 'eiso', { x: R(al.x), y: R(al.y), a: al.angle, len: 700, life: .95 }),
    nagashi: (st, al) => addFx(st, 'nagashi', { x: R(al.x), y: R(al.y), r: 300, life: 1.05 }),
    amaterasu(st, al, t) {
      return addFx(st, 'amaterasu', { x: R(t.x), y: R(t.y), sx: R(al.x), sy: R(al.y), r: 260, life: 6.8, nt: .9 });
    },
    kagutsuchi: (st, al) => addFx(st, 'kagutsuchi', { x: R(al.x), y: R(al.y), a: al.angle, len: 600, life: 1.15 }),
    tejikara(st, al, t, api) {
      // Swap in right beside the target (behind it if possible) and cut.
      const a = al.angle, gap = (t.r || 14) + 42;
      let dx = t.x - Math.cos(a) * gap, dy = t.y - Math.sin(a) * gap;
      for (const c of [a, a + 1.3, a - 1.3, a + Math.PI]) {
        const px = t.x + Math.cos(c) * gap, py = t.y + Math.sin(c) * gap;
        if (!api.blocked(px, py, 14)) { dx = px; dy = py; break; }
      }
      const fx = addFx(st, 'tejikara', { x1: R(al.x), y1: R(al.y), x: R(dx), y: R(dy), a: Math.atan2(t.y - dy, t.x - dx), life: .85,
        f1: Math.cos(al.angle) >= 0 ? 1 : -1 });
      al.x = dx; al.y = dy; al.angle = fx.a; al.flash = .9;
      return fx;
    },
    arrows: (st, al) => addFx(st, 'arrows', { x: R(al.x), y: R(al.y), a: al.angle, len: 1000, life: 1.6 }),
    kirin: (st, al, t) => addFx(st, 'kirin', { x: R(t.x), y: R(t.y), r: 450, life: 3.1, side: al.x < t.x ? 1 : -1 }),
    indra: (st, al) => addFx(st, 'indra', { x: R(al.x), y: R(al.y), a: al.angle, len: 1200, life: 3.9 })
  };
  // While a jutsu winds up it keeps tracking the target.
  const TRACK = {
    eiso(al, fx, t, dt, age) { if (age < .3) fx.a = al.angle = turn(fx.a, Math.atan2(t.y - fx.y, t.x - fx.x), dt * 6); },
    kagutsuchi(al, fx, t, dt, age) { if (age < .28) fx.a = al.angle = turn(fx.a, Math.atan2(t.y - fx.y, t.x - fx.x), dt * 6); },
    arrows(al, fx, t, dt, age) { if (age < .55) fx.a = al.angle = turn(fx.a, Math.atan2(t.y - fx.y, t.x - fx.x), dt * 4); },
    indra(al, fx, t, dt, age) { if (age < IN_FIRE - .15) fx.a = al.angle = turn(fx.a, Math.atan2(t.y - fx.y, t.x - fx.x), dt * 1.6); },
    kirin(al, fx, t, dt, age) {
      if (age >= 1) return;
      const dx = t.x - fx.x, dy = t.y - fx.y, d = Math.hypot(dx, dy), step = Math.min(d, 650 * dt);
      if (d > 1) { fx.x = R(fx.x + dx / d * step); fx.y = R(fx.y + dy / d * step); }
      al.angle = Math.atan2(fx.y - al.y, fx.x - al.x);
    }
  };

  function startMove(st, al, name, t, api) {
    const def = MOVES[name], p = api.player;
    if (name === 'indra' && Math.hypot(al.x - p.x, al.y - p.y) > 220) {
      // The ultimate is fired from Naruto's side: Sasuke flickers back to him first.
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      for (const s of [1, -1]) {
        const bx = p.x + Math.cos(a + s * 1.9) * 110, by = p.y + Math.sin(a + s * 1.9) * 110;
        if (blinkTo(st, al, bx, by, api)) break;
      }
      al.angle = Math.atan2(t.y - al.y, t.x - al.x);
    }
    al.move = name; al.mt = 0; al.moving = 0; al.chase = 0;
    al.label = def.label; al.jp = def.jp; al.labelT = Math.min(2.6, def.lock + .6);
    if (name === 'indra') { al.ult = ULT_COOLDOWN; st.ultAt = R(api.time + ULT_COOLDOWN); } else al.step++;
    al.fx = CAST[name](st, al, t, api).id;
    al.pose = POSE[name](0);
  }

  function blinkTo(st, al, x, y, api) {
    if (api.blocked(x, y, al.r || 14)) return false;
    addFx(st, 'blink', { x: R(al.x), y: R(al.y), x2: R(x), y2: R(y), life: .45 });
    al.x = x; al.y = y; al.flash = .7;
    return true;
  }

  function follow(al, p, dt, api) {
    const side = al.side || 1, a = (p.angle || 0) + 2.3 * side;
    const tx = p.x + Math.cos(a) * 72, ty = p.y + Math.sin(a) * 72;
    const d = Math.hypot(tx - al.x, ty - al.y);
    al.chase = 0;
    if (d > 26) {
      al.angle = Math.atan2(ty - al.y, tx - al.x);
      api.walk(al, tx, ty, d > 300 ? 620 : 470, dt);
      al.moving = 1;
    } else { al.moving = 0; al.angle = p.angle || 0; }
    al.pose = al.moving ? 'run' : 'idle';
  }

  function think(st, al, dt, api) {
    const p = api.player;
    al.flash = Math.max(0, al.flash - dt * 2.5);
    al.labelT = Math.max(0, al.labelT - dt);
    al.swing = Math.max(0, al.swing - dt);
    al.gap -= dt; al.ult -= dt; al.seek -= dt; al.slashCd -= dt;
    let target = alive(al.target) ? al.target : null;
    if (al.move) {
      al.mt += dt;
      const name = al.move, def = MOVES[name], fx = findFx(st, al.fx);
      if (fx && target && TRACK[name]) TRACK[name](al, fx, target, dt, fx.maxLife - fx.life);
      al.pose = POSE[name](al.mt);
      al.aura += ((name === 'arrows' ? 1 : name === 'indra' ? 0 : .6) - al.aura) * Math.min(1, dt * 6);
      al.sus = name === 'indra' ? (al.mt < 3 ? easeOut(al.mt / IN_RISE) : 1 - ramp(al.mt, 3, 3.6)) : Math.max(0, al.sus - dt * 2);
      al.half = name === 'arrows' ? (al.mt < 1 ? easeOut(al.mt / .3) : 1 - ramp(al.mt, 1, 1.4)) : Math.max(0, al.half - dt * 3);
      if (al.mt >= def.lock) { al.move = ''; al.gap = GAP + Math.random() * .3; al.pose = 'idle'; al.label = ''; }
      return;
    }
    al.sus = Math.max(0, al.sus - dt * 2);
    al.half = Math.max(0, al.half - dt * 3);
    // Too far from Naruto: flicker back to his side.
    if (Math.hypot(al.x - p.x, al.y - p.y) > 1400) {
      const a = (p.angle || 0) + Math.PI;
      if (!blinkTo(st, al, p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60, api)) blinkTo(st, al, p.x, p.y, api);
      al.target = null;
      return;
    }
    if (al.seek <= 0 || !target || Math.hypot(target.x - p.x, target.y - p.y) > 1000) {
      target = al.target = api.nearest(p.x, p.y, 900, true) || null;
      al.seek = .3;
    }
    al.aura += ((target ? .6 : 0) - al.aura) * Math.min(1, dt * 3);
    if (!target) { follow(al, p, dt, api); return; }
    const d = Math.hypot(target.x - al.x, target.y - al.y);
    al.angle = Math.atan2(target.y - al.y, target.x - al.x);
    const name = al.ult <= 0 ? 'indra' : CYCLE[al.step % CYCLE.length];
    const def = MOVES[name], tr = target.r || 14;
    if (al.gap <= 0 && d <= def.range + tr) { startMove(st, al, name, target, api); return; }
    const want = def.dist + tr;
    al.moving = 0;
    if (d > want + 30) {
      // Fighting spot: on his side of the target, unless that strays far from Naruto.
      let wx = target.x - Math.cos(al.angle) * want, wy = target.y - Math.sin(al.angle) * want;
      if (Math.hypot(wx - p.x, wy - p.y) > 650) {
        const b = Math.atan2(p.y - target.y, p.x - target.x);
        wx = target.x + Math.cos(b) * want; wy = target.y + Math.sin(b) * want;
      }
      api.walk(al, wx, wy, d > 500 ? 600 : 500, dt);
      al.moving = 1;
      al.chase += dt;
      // Sasuke doesn't chase for long: a body flicker puts him at fighting distance.
      if (al.chase > 1.4 || (al.gap <= 0 && al.chase > .55)) {
        blinkTo(st, al, wx, wy, api);
        al.chase = 0;
      }
    } else al.chase = 0;
    // Kusanagi cuts whenever an enemy gets close between two jutsu.
    if (al.slashCd <= 0) {
      const z = api.nearest(al.x, al.y, 105, false);
      if (z) {
        al.angle = Math.atan2(z.y - al.y, z.x - al.x);
        al.swing = .26; al.slashCd = .5; al.sc = -(al.sc || 1);
        addFx(st, 'slash', { x: R(al.x), y: R(al.y), a: al.angle, life: .3, side: al.sc });
      }
    }
    al.pose = al.swing > 0 ? 'attack' : al.moving ? 'run' : 'idle';
  }

  // ------------------------------------------------------------------ view culling
  const VIEW = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
  function setView(ctx) {
    const m = ctx.getTransform(), c = ctx.canvas, sx = m.a || 1, sy = m.d || 1;
    VIEW.x0 = -m.e / sx; VIEW.y0 = -m.f / sy;
    VIEW.x1 = VIEW.x0 + c.width / sx; VIEW.y1 = VIEW.y0 + c.height / sy;
  }
  const vis = (x, y, r) => x + r > VIEW.x0 && x - r < VIEW.x1 && y + r > VIEW.y0 && y - r < VIEW.y1;

  // ------------------------------------------------------------------ cached art
  function boneStroke(g, w, a = 1) {
    g.strokeStyle = `rgba(28,4,62,${.75 * a})`; g.lineWidth = w + 2.4; g.stroke();
    g.strokeStyle = `rgba(140,70,250,${.85 * a})`; g.lineWidth = w; g.stroke();
    g.strokeStyle = `rgba(238,220,255,${.95 * a})`; g.lineWidth = Math.max(1, w * .28); g.stroke();
  }
  // First-stage Susanoo ribcage around Sasuke: back half (behind him) and front half (over him).
  // Painted at 2× into a 280×300 canvas, origin at the feet (140, 290).
  function ribSprite(front) {
    return K().sprite('indra-ribs-' + (front ? 'f' : 'b'), 280, 300, g => {
      g.translate(140, 290); g.scale(2, 2); g.lineCap = 'round'; g.lineJoin = 'round';
      if (!front) {
        g.beginPath(); g.moveTo(0, -30); g.lineTo(0, -118); boneStroke(g, 4.2);
        for (let i = 0; i < 5; i++) { const y = -108 + i * 14; g.beginPath(); g.moveTo(-5, y); g.lineTo(5, y); boneStroke(g, 3); }
        g.beginPath(); g.moveTo(-54, -110); g.quadraticCurveTo(0, -126, 54, -110); boneStroke(g, 4.4);
      }
      for (let i = 0; i < 5; i++) {
        const y = -104 + i * 14, w = (50 - Math.abs(i - 1.4) * 4.5), tip = 14 + i * 2.6;
        for (const s of [-1, 1]) {
          g.beginPath();
          if (front) { g.moveTo(s * w, y + 9); g.bezierCurveTo(s * w, y + 20, s * (tip + 10), y + 25, s * tip, y + 22); }
          else { g.moveTo(s * 4, y); g.bezierCurveTo(s * w * .5, y - 10, s * w, y - 4, s * w, y + 9); }
          boneStroke(g, front ? 3.2 : 3.4, front ? .9 : .8);
        }
      }
      if (front) {
        // A skeletal arm hanging at the near side.
        g.beginPath(); g.moveTo(-54, -110); g.lineTo(-64, -72); g.lineTo(-52, -40); boneStroke(g, 4);
        g.beginPath(); g.arc(-52, -38, 4.4, 0, TAU); boneStroke(g, 2.4);
      }
    });
  }

  // Sasuke's Perfect Susanoo: a winged, armoured violet warrior with a crested demon helm and a long
  // tengu nose. Faces right; 680×520 canvas, origin at the feet (340, 505). Painted once.
  const PS_W = 680, PS_H = 520, PS_OX = 340, PS_OY = 505;
  function psSprite() {
    return K().sprite('indra-perfect', PS_W, PS_H, g => {
      g.translate(PS_OX, PS_OY); g.lineJoin = 'round'; g.lineCap = 'round';
      const shape = (build, fill, w = 1) => {
        build(); g.fillStyle = fill; g.fill();
        g.strokeStyle = 'rgba(22,2,50,.92)'; g.lineWidth = 3.4 * w; g.stroke();
        g.strokeStyle = 'rgba(238,222,255,.95)'; g.lineWidth = 1.2 * w; g.stroke();
      };
      const vgrad = (y0, y1, c0, c1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
      const line = (pts, w, c) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.strokeStyle = c; g.lineWidth = w; g.stroke(); };

      // Wings: an armoured wing arm arcing out from each shoulder, two layers of broad feathers hanging from it.
      for (const side of [-1, 1]) {
        const A0 = [side * 78, -300], A1 = [side * 190, -440], A2 = [side * 318, -392];
        const arm = u => { const v = 1 - u; return [v * v * A0[0] + 2 * v * u * A1[0] + u * u * A2[0], v * v * A0[1] + 2 * v * u * A1[1] + u * u * A2[1]]; };
        for (const layer of [0, 1]) {
          const n = layer ? 8 : 9;
          for (let k = n - 1; k >= 0; k--) {
            const u = (k + (layer ? .5 : 0)) / (n - .2), [rx, ry] = arm(Math.min(1, u));
            const ang = Math.PI / 2 - side * (.12 + u * 1.25), L = (layer ? 105 : 165) + u * (layer ? 50 : 95), W = layer ? 16 : 21;
            const tx = rx + Math.cos(ang) * L, ty = ry + Math.sin(ang) * L, nx = -Math.sin(ang) * W, ny = Math.cos(ang) * W;
            shape(() => {
              g.beginPath(); g.moveTo(rx - nx * .4, ry - ny * .4);
              g.quadraticCurveTo(rx + (tx - rx) * .55 + nx, ry + (ty - ry) * .55 + ny, tx, ty);
              g.quadraticCurveTo(rx + (tx - rx) * .5 - nx * .7, ry + (ty - ry) * .5 - ny * .7, rx + nx * .4, ry + ny * .4); g.closePath();
            }, layer ? vgrad(ry, ty, 'rgba(160,104,255,.7)', 'rgba(110,52,220,.55)') : vgrad(ry, ty, 'rgba(92,36,184,.7)', 'rgba(52,14,120,.55)'), .75);
            line([[rx, ry], [rx + (tx - rx) * .8, ry + (ty - ry) * .8]], 1, 'rgba(225,200,255,.55)');
          }
        }
        g.beginPath(); g.moveTo(A0[0], A0[1]); g.quadraticCurveTo(A1[0], A1[1], A2[0], A2[1]);
        g.strokeStyle = 'rgba(22,2,50,.92)'; g.lineWidth = 15; g.stroke();
        g.strokeStyle = 'rgba(132,74,236,.95)'; g.lineWidth = 10; g.stroke();
        g.strokeStyle = 'rgba(240,226,255,.95)'; g.lineWidth = 2; g.stroke();
        g.fillStyle = 'rgba(200,170,255,.9)'; g.beginPath(); g.arc(A2[0], A2[1], 5, 0, TAU); g.fill();
      }
      // Long mane falling behind the back.
      shape(() => {
        g.beginPath(); g.moveTo(-30, -392); g.quadraticCurveTo(-84, -320, -70, -190); g.lineTo(-48, -214); g.lineTo(-40, -150);
        g.lineTo(-14, -176); g.lineTo(0, -128); g.lineTo(14, -176); g.lineTo(40, -150); g.lineTo(48, -214); g.lineTo(70, -190);
        g.quadraticCurveTo(84, -320, 30, -392); g.closePath();
      }, 'rgba(52,14,116,.7)');
      // Plated skirt: hanging tassets, each in three lames, fading toward the flames.
      for (let i = -2; i <= 2; i++) {
        const x0 = i * 34, w = 22 - Math.abs(i) * 1.5;
        for (let r = 0; r < 3; r++) {
          const y = -150 + r * 34;
          shape(() => {
            g.beginPath(); g.moveTo(x0 - w, y); g.lineTo(x0 + w, y); g.lineTo(x0 + w * 1.08 + i * 3, y + 36); g.quadraticCurveTo(x0 + i * 4, y + 42, x0 - w * 1.08 + i * 3, y + 36); g.closePath();
          }, vgrad(y, y + 36, 'rgba(150,92,250,.66)', 'rgba(82,30,170,.6)'), .8);
        }
      }
      // Torso armour.
      shape(() => {
        g.beginPath();
        g.moveTo(-24, -332); g.quadraticCurveTo(-80, -330, -108, -298); g.lineTo(-88, -250); g.quadraticCurveTo(-84, -196, -62, -160);
        g.lineTo(62, -160); g.quadraticCurveTo(84, -196, 88, -250); g.lineTo(108, -298); g.quadraticCurveTo(80, -330, 24, -332); g.closePath();
      }, vgrad(-332, -160, 'rgba(146,88,246,.72)', 'rgba(74,24,164,.66)'), 1.1);
      // Chest plates, centre ridge, segmented abdomen.
      for (const side of [-1, 1]) shape(() => {
        g.beginPath(); g.moveTo(side * 6, -304); g.quadraticCurveTo(side * 66, -304, side * 74, -252); g.quadraticCurveTo(side * 44, -232, side * 6, -238); g.closePath();
      }, 'rgba(176,128,255,.6)', .8);
      for (let i = 0; i < 3; i++) shape(() => {
        const y = -226 + i * 21, w = 56 - i * 5;
        g.beginPath(); g.moveTo(-w, y); g.quadraticCurveTo(0, y - 6, w, y); g.lineTo(w - 4, y + 16); g.quadraticCurveTo(0, y + 10, -w + 4, y + 16); g.closePath();
      }, 'rgba(120,62,226,.6)', .7);
      line([[0, -326], [0, -164]], 2, 'rgba(240,226,255,.8)');
      // Waist sash with a knot.
      shape(() => { g.beginPath(); g.moveTo(-66, -166); g.quadraticCurveTo(0, -152, 66, -166); g.lineTo(64, -148); g.quadraticCurveTo(0, -134, -64, -148); g.closePath(); }, 'rgba(58,16,128,.85)', .8);
      shape(() => { g.beginPath(); g.ellipse(18, -150, 11, 8, 0, 0, TAU); }, 'rgba(150,96,250,.8)', .7);
      // Gorget round the neck.
      shape(() => { g.beginPath(); g.ellipse(0, -330, 40, 13, 0, 0, TAU); }, 'rgba(96,40,196,.8)', .9);
      // Pauldrons: three overlapping plates per shoulder.
      for (const side of [-1, 1]) for (let p = 2; p >= 0; p--) {
        shape(() => {
          const cx = side * (108 + p * 7), cy = -300 + p * 18;
          g.beginPath(); g.moveTo(cx - side * 44, cy - 8); g.quadraticCurveTo(cx, cy - 34, cx + side * 46, cy - 2);
          g.quadraticCurveTo(cx + side * 40, cy + 16, cx + side * 8, cy + 18); g.quadraticCurveTo(cx - side * 30, cy + 14, cx - side * 44, cy - 8); g.closePath();
        }, p ? 'rgba(112,52,218,.72)' : vgrad(-334, -280, 'rgba(196,150,255,.8)', 'rgba(120,60,226,.75)'));
      }
      // Helm: horns sweeping back, a tall crescent crest, demon face plate, tengu nose, fanged mouth guard.
      for (const side of [-1, 1]) shape(() => {
        g.beginPath(); g.moveTo(side * 20, -386); g.quadraticCurveTo(side * 60, -404, side * 92, -462); g.quadraticCurveTo(side * 58, -420, side * 30, -366); g.closePath();
      }, 'rgba(120,62,228,.8)', .85);
      shape(() => { g.beginPath(); g.ellipse(0, -364, 34, 38, 0, 0, TAU); }, vgrad(-402, -326, 'rgba(150,96,250,.85)', 'rgba(70,24,160,.85)'));
      shape(() => {
        g.beginPath(); g.moveTo(-8, -396); g.quadraticCurveTo(-30, -440, -12, -488); g.quadraticCurveTo(0, -446, 8, -440);
        g.quadraticCurveTo(14, -458, 30, -470); g.quadraticCurveTo(14, -430, 10, -396); g.closePath();
      }, vgrad(-488, -396, 'rgba(240,226,255,.9)', 'rgba(150,96,250,.85)'), .9);
      shape(() => {
        g.beginPath(); g.moveTo(-28, -374); g.lineTo(28, -374); g.lineTo(26, -350); g.lineTo(16, -330); g.lineTo(0, -322); g.lineTo(-16, -330); g.lineTo(-26, -350); g.closePath();
      }, 'rgba(186,146,255,.78)', .9);
      // Brow ridge with deep eye sockets.
      shape(() => { g.beginPath(); g.moveTo(-30, -378); g.lineTo(0, -368); g.lineTo(30, -378); g.lineTo(28, -370); g.lineTo(0, -360); g.lineTo(-28, -370); g.closePath(); }, 'rgba(60,16,130,.9)', .7);
      g.fillStyle = 'rgba(12,0,34,.95)';
      for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * 6, -364); g.lineTo(side * 24, -370); g.lineTo(side * 22, -360); g.lineTo(side * 8, -357); g.closePath(); g.fill(); }
      shape(() => { g.beginPath(); g.moveTo(4, -360); g.quadraticCurveTo(36, -356, 68, -340); g.lineTo(8, -344); g.closePath(); }, 'rgba(160,110,255,.85)', .8);
      shape(() => { g.beginPath(); g.moveTo(-20, -342); g.lineTo(20, -342); g.lineTo(14, -328); g.lineTo(-14, -328); g.closePath(); }, 'rgba(40,8,90,.92)', .7);
      g.fillStyle = 'rgba(244,234,255,.95)';
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 5 - 2, -342); g.lineTo(i * 5 + 2, -342); g.lineTo(i * 5, -335 + Math.abs(i) * .8); g.closePath(); g.fill(); }
    });
  }

  // Kirin's head, facing +x (local units), drawn with any fill.
  function kirinHead(ctx) {
    ctx.beginPath();
    ctx.moveTo(-26, -8);
    ctx.lineTo(-74, -64); ctx.lineTo(-18, -30);          // back horn
    ctx.lineTo(-40, -86); ctx.lineTo(6, -32);            // front horn
    ctx.lineTo(44, -30); ctx.lineTo(96, -20); ctx.lineTo(122, -10);   // brow and snout
    ctx.lineTo(126, -2); ctx.lineTo(84, 0);              // upper jaw edge
    ctx.lineTo(62, 6);                                   // mouth corner
    ctx.lineTo(118, 22); ctx.lineTo(112, 32); ctx.lineTo(56, 26);     // open lower jaw
    ctx.lineTo(0, 30); ctx.lineTo(-56, 40); ctx.lineTo(-30, 16);       // throat mane
    ctx.lineTo(-84, 14); ctx.lineTo(-34, 0); ctx.closePath();
  }

  // Amaterasu's black fire: a cluster of wavy tongues with curling tips, a crimson-violet rim and a
  // pitch-black body. Six variants (base at y = 114 of 128, like VFXKit.flame) swapped for flicker.
  function amaFlame(v) {
    v = ((v % 6) + 6) % 6;
    return K().sprite('indra-ama:' + v, 64, 128, g => {
      const tongue = (cx, hw, h, lean, seed, grow) => {
        const N = 18, L = [], Rr = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, w = (hw + grow) * Math.pow(1 - t, .85) * (1 + .3 * Math.sin(t * 10 + seed) * t);
          const xc = cx + Math.sin(t * 4 + seed) * hw * .45 * t + lean * t * t * hw * 1.4, y = 114 - t * (h + grow * 1.5);
          L.push([xc - w, y]); Rr.push([xc + w, y]);
        }
        g.beginPath(); g.moveTo(L[0][0], L[0][1]);
        for (const p of L) g.lineTo(p[0], p[1]);
        for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
        g.quadraticCurveTo(cx, 114 + hw * .5, L[0][0], L[0][1]); g.closePath(); g.fill();
      };
      const sd = v * 1.7 + .3, lean = (hash(v + 9) - .5) * 1.2;
      const set = grow => {
        tongue(32, 17, 104, lean, sd, grow);
        tongue(17, 10, 62 + hash(v) * 18, -.6, sd + 2, grow);
        tongue(48, 10, 70 + hash(v + 3) * 18, .7, sd + 4, grow);
        tongue(26, 7, 84, lean - .5, sd + 6, grow);
        tongue(40, 6, 52, lean + .6, sd + 8, grow);
      };
      g.fillStyle = 'rgba(110,20,70,.9)'; set(2.6);
      g.fillStyle = '#1a0412'; set(1.2);
      g.fillStyle = '#000000'; set(0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(70,20,90,.28)';
      g.beginPath(); g.ellipse(32, 108, 7, 14, 0, 0, TAU); g.fill();
    });
  }

  // ------------------------------------------------------------------ primitives
  function crescent(ctx, x, y, r, a0, a1, thick, color) {
    const mid = (a0 + a1) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.quadraticCurveTo(x + Math.cos(mid) * (r - thick * 2), y + Math.sin(mid) * (r - thick * 2), x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    ctx.fill();
  }
  function ring(ctx, x, y, r, w, color, squash = .5) {
    if (!(r > 1)) return;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * squash, 0, 0, TAU); ctx.stroke();
  }
  // Inked violet ring on the ground: dark under-stroke, bright lavender line.
  function inkRing(ctx, x, y, r, a, w = 3) {
    ring(ctx, x, y, r, w + 5, `rgba(24,4,52,${.55 * a})`);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ring(ctx, x, y, r, w, `rgba(200,150,255,${.9 * a})`);
    ctx.globalCompositeOperation = op;
  }
  function chirps(ctx, x, y, n, rad, len, time, seed, alpha) {
    ctx.strokeStyle = `rgba(242,222,255,${alpha})`; ctx.lineWidth = 1.2;
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
  // Ground-plane ellipse sector bolts (radial lightning flattened onto the ground).
  function groundRays(ctx, x, y, n, r0, r1, time, seed, alpha, width = 1.5) {
    const k = K();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(seed + i) * .5 + (k.wobble(seed + i, time, 2) - .5) * .4;
      const c = Math.cos(a), s = Math.sin(a) * .5;
      k.forkedBolt(ctx, x + c * r0, y + s * r0, x + c * r1, y + s * r1, seed + i * 9, time,
        { jitter: 10 + r1 * .03, alpha, width, pal: PAL, base: ink(alpha), step: Math.max(18, r1 / 14), forks: 1, forkLen: 18 + r1 * .05, rate: 22, snap: true });
    }
  }

  // ------------------------------------------------------------------ ground pass
  const GROUND = {
    summon(ctx, fx, age, time) {
      const k = K(), p = easeOut(age / .5), a = 1 - ramp(age, .4, fx.maxLife);
      k.glow(ctx, fx.x, fx.y, 150 * p + 20, '20,6,36', .45 * a, false, .5);
      inkRing(ctx, fx.x, fx.y, 30 + 170 * p, a, 3);
      if (age > .1 && age < .7) {
        ctx.globalCompositeOperation = 'lighter';
        groundRays(ctx, fx.x, fx.y, 7, 10, 60 + 130 * p, time, fx.id, 1 - ramp(age, .3, .7));
        ctx.globalCompositeOperation = 'source-over';
      }
    },
    eiso(ctx, fx, age, time) {
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a), x2 = fx.x + ca * fx.len, y2 = fx.y + sa * fx.len;
      ctx.lineCap = 'round';
      if (age < .32) {
        const c = age / .32;
        ctx.strokeStyle = `rgba(60,16,130,${.3 * c})`; ctx.lineWidth = 16;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([18, 12]); ctx.lineDashOffset = -time * 160;
        ctx.strokeStyle = `rgba(190,130,255,${.75 * c})`; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.setLineDash([]);
        inkRing(ctx, x2, y2, 40 + 20 * c, c, 2);
        return;
      }
      const f = 1 - ramp(age, .4, fx.maxLife);
      ctx.strokeStyle = `rgba(26,6,44,${.4 * f})`; ctx.lineWidth = 34;
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(150,60,255,${.4 * f})`; ctx.lineWidth = 10; ctx.stroke();
      K().glow(ctx, x2, y2, 130 * easeOut((age - .32) * 4), '140,50,255', .6 * f, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      inkRing(ctx, x2, y2, 30 + 110 * easeOut((age - .32) * 3), f, 3);
    },
    nagashi(ctx, fx, age, time) {
      const k = K();
      if (age < .26) {
        const c = age / .26;
        inkRing(ctx, fx.x, fx.y, 30 + 30 * c, c, 2);
        ctx.globalCompositeOperation = 'lighter';
        groundRays(ctx, fx.x, fx.y, 4, 6, 40 + 30 * c, time, fx.id, c, 1);
        ctx.globalCompositeOperation = 'source-over';
        return;
      }
      const p = easeOut((age - .26) / .3), f = 1 - ramp(age, .6, fx.maxLife), R0 = fx.r * (.15 + .85 * p);
      k.glow(ctx, fx.x, fx.y, fx.r * 1.15, BODY, .45 * f, false, .5);
      ctx.fillStyle = `rgba(20,4,40,${.22 * f})`;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R0 * .6, R0 * .3, 0, 0, TAU); ctx.fill();
      inkRing(ctx, fx.x, fx.y, R0, f, 3.5);
      if (age > .56) inkRing(ctx, fx.x, fx.y, fx.r * (.2 + .8 * easeOut((age - .56) / .3)), f * .8, 2.5);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, fx.x, fx.y, R0 * 1.1, '120,40,240', .35 * f, false, .5);
      groundRays(ctx, fx.x, fx.y, 11, 18, R0 * .98, time, fx.id * 3, f, 1.6);
      ctx.globalCompositeOperation = 'source-over';
    },
    amaterasu(ctx, fx, age, time) {
      const k = K();
      if (age < .5) {
        const c = age / .5;
        ring(ctx, fx.x, fx.y, fx.r, 6, `rgba(30,0,14,${.45 * c})`);
        ring(ctx, fx.x, fx.y, fx.r, 2, `rgba(190,30,60,${.7 * c})`);
        ring(ctx, fx.x, fx.y, fx.r * (1 - c) + 6, 3, `rgba(40,0,20,${.8 * c})`);
        k.glow(ctx, fx.x, fx.y, 40 * c, '0,0,0', .8, false, .5);
        return;
      }
      const e = easeOut((age - .5) / .3), f = clamp01(fx.life / .9);
      k.glow(ctx, fx.x, fx.y, fx.r * 1.15 * e, '8,2,10', .62 * f, false, .5);
      k.glow(ctx, fx.x, fx.y, fx.r * .8 * e, '0,0,0', .7 * f, false, .5);
      ring(ctx, fx.x, fx.y, fx.r * e, 2.4, `rgba(150,20,60,${.45 * f})`);
      if (age < 1) inkRing(ctx, fx.x, fx.y, fx.r * (.3 + 1.1 * easeOut((age - .5) * 2)), 1 - ramp(age, .5, 1), 3);
    },
    kagutsuchi(ctx, fx, age) {
      ctx.lineCap = 'round';
      const f = 1 - ramp(age, .7, fx.maxLife);
      if (age < .55) {
        // Telegraph: five thin crimson-black lines fanning out along the blades' paths.
        const c = Math.min(1, age / .2) * (1 - ramp(age, .35, .55));
        for (let i = 0; i < 5; i++) {
          const a = fx.a + (i - 2) * .2, x2 = fx.x + Math.cos(a) * fx.len, y2 = fx.y + Math.sin(a) * fx.len;
          ctx.strokeStyle = `rgba(60,10,50,${.3 * c})`; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.strokeStyle = `rgba(200,60,140,${.6 * c})`; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      for (let i = 0; i < 5; i++) {
        const t0 = kaguIndexTime(i);
        if (age < t0) continue;
        const a = fx.a + (i - 2) * .2, p = easeOut((age - t0) / .3) * fx.len;
        ctx.strokeStyle = `rgba(40,8,50,${.22 * f})`; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(fx.x + Math.cos(a) * 20, fx.y + Math.sin(a) * 20); ctx.lineTo(fx.x + Math.cos(a) * p, fx.y + Math.sin(a) * p); ctx.stroke();
      }
    },
    tejikara(ctx, fx, age) {
      const f = 1 - age / fx.maxLife;
      for (const [x, y] of [[fx.x1, fx.y1], [fx.x, fx.y]]) {
        for (let j = 0; j < 3; j++) {
          const r = 16 + easeOut(age / .6 - j * .12) * 110;
          ring(ctx, x, y, r, 2.4, `rgba(40,10,90,${.55 * f})`);
          ring(ctx, x, y, r, 1.2, `rgba(205,175,255,${.8 * f})`);
        }
      }
    },
    arrows(ctx, fx, age) {
      if (age < ARROW_REL) {
        const c = age / ARROW_REL;
        ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const a = fx.a + (i - 3) * .12, x2 = fx.x + Math.cos(a) * fx.len, y2 = fx.y + Math.sin(a) * fx.len;
          ctx.strokeStyle = `rgba(60,16,130,${.22 * c})`; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.strokeStyle = `rgba(200,150,255,${.45 * c})`; ctx.lineWidth = 1.5; ctx.stroke();
        }
        return;
      }
      const f = 1 - ramp(age, 1.1, fx.maxLife);
      for (let i = 0; i < 7; i++) {
        const t0 = arrowRelease(i), p = (age - t0) / .36;
        if (p < 1) continue;
        const a = fx.a + (i - 3) * .12, x2 = fx.x + Math.cos(a) * fx.len, y2 = fx.y + Math.sin(a) * fx.len;
        inkRing(ctx, x2, y2, 20 + 60 * easeOut((p - 1) * 2), f, 2);
      }
    },
    kirin(ctx, fx, age, time) {
      const k = K(), gather = easeOut(age / 1);
      // The storm's shadow darkens the ground under the clouds.
      const fade = 1 - ramp(age, 2.4, fx.maxLife);
      k.glow(ctx, fx.x, fx.y, fx.r * 1.5, '14,8,26', .55 * gather * fade, false, .5);
      if (age < KIRIN_HIT) {
        const c = ramp(age, .2, 1.1);
        ctx.save();
        ctx.setLineDash([26, 16]); ctx.lineDashOffset = time * 90;
        ring(ctx, fx.x, fx.y, fx.r, 7, `rgba(24,4,52,${.4 * c})`);
        ring(ctx, fx.x, fx.y, fx.r, 2.4, `rgba(205,160,255,${.9 * c})`);
        ctx.setLineDash([]);
        ctx.restore();
        const pulse = frac(age * 2.2);
        inkRing(ctx, fx.x, fx.y, fx.r * (1 - pulse), c * (1 - pulse) * .8, 2);
        return;
      }
      const t = age - KIRIN_HIT, f = 1 - ramp(age, KIRIN_HIT + .5, fx.maxLife);
      k.glow(ctx, fx.x, fx.y, fx.r * 1.05, '10,2,20', .55 * f, false, .5);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, fx.x, fx.y, fx.r * (.6 + .5 * easeOut(t * 3)), '140,50,255', .55 * f, false, .5);
      groundRays(ctx, fx.x, fx.y, 9, 30, fx.r * (.5 + .5 * easeOut(t * 3)), time, fx.id * 5, f, 2.2);
      ctx.globalCompositeOperation = 'source-over';
      inkRing(ctx, fx.x, fx.y, fx.r * (.3 + .9 * easeOut(t * 2)), f, 4);
      inkRing(ctx, fx.x, fx.y, fx.r * (.1 + .6 * easeOut(t * 2.6)), f * .7, 2.5);
    },
    indra(ctx, fx, age, time) {
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a), x1 = fx.x + ca * 60, y1 = fx.y + sa * 60;
      const x2 = fx.x + ca * (60 + fx.len), y2 = fx.y + sa * (60 + fx.len);
      const nx = -sa * 80, ny = ca * 80 * .5;
      const band = (w, fill) => {
        ctx.fillStyle = fill; ctx.beginPath();
        ctx.moveTo(x1 + nx * w, y1 + ny * w); ctx.lineTo(x2 + nx * w, y2 + ny * w);
        ctx.lineTo(x2 - nx * w, y2 - ny * w); ctx.lineTo(x1 - nx * w, y1 - ny * w); ctx.closePath(); ctx.fill();
      };
      if (age < IN_FIRE) {
        const c = ramp(age, IN_RISE * .6, IN_FIRE);
        if (c <= 0) return;
        band(1, `rgba(60,16,130,${.16 * c})`);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(210,170,255,${.85 * c})`; ctx.lineWidth = 2.4;
        ctx.setLineDash([30, 18]); ctx.lineDashOffset = -time * 400;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x1 + nx * s, y1 + ny * s); ctx.lineTo(x2 + nx * s, y2 + ny * s); ctx.stroke(); }
        ctx.setLineDash([]);
        ctx.restore();
        // Chevrons streaming along the path.
        ctx.strokeStyle = `rgba(230,200,255,${.6 * c})`; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const t = frac(i / 8 + age * .8), px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
          ctx.moveTo(px - ca * 30 + nx * .45, py - sa * 30 + ny * .45); ctx.lineTo(px, py); ctx.lineTo(px - ca * 30 - nx * .45, py - sa * 30 - ny * .45);
        }
        ctx.stroke();
        return;
      }
      const t = age - IN_FIRE, f = 1 - ramp(age, IN_FIRE + 1, fx.maxLife), front = easeOut(t / .15);
      const ex = x1 + (x2 - x1) * front, ey = y1 + (y2 - y1) * front;
      // The trench the beam gouges: a scorched band with molten violet edges.
      ctx.fillStyle = `rgba(16,2,30,${.45 * f})`;
      ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(ex + nx, ey + ny); ctx.lineTo(ex - nx, ey - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.strokeStyle = `rgba(170,90,255,${.55 * f})`; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(x1 + nx * s * .95, y1 + ny * s * .95); ctx.lineTo(ex + nx * s * .95, ey + ny * s * .95); ctx.stroke();
        ctx.strokeStyle = `rgba(240,220,255,${.7 * f})`; ctx.lineWidth = 2; ctx.stroke();
      }
      K().glow(ctx, x2, y2, 300 * easeOut(t * 3), '170,70,255', .7 * f * front, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      if (front >= 1) {
        inkRing(ctx, x2, y2, 60 + 280 * easeOut((t - .15) * 1.6), f, 5);
        inkRing(ctx, x2, y2, 30 + 170 * easeOut((t - .15) * 2.2), f * .8, 3);
      }
    },
    blink(ctx, fx, age) {
      const f = 1 - age / fx.maxLife;
      for (const [x, y] of [[fx.x, fx.y], [fx.x2, fx.y2]]) ring(ctx, x, y, 14 + 50 * easeOut(age / .35), 2, `rgba(190,150,255,${.8 * f})`);
    },
    exit(ctx, fx, age) {
      ring(ctx, fx.x, fx.y, 20 + 60 * easeOut(age / .5), 2, `rgba(190,150,255,${.7 * (1 - age / fx.maxLife)})`);
    }
  };

  // ------------------------------------------------------------------ overlay pass
  const flameSpots = new Map();
  function amaSpots(fx) {
    const key = fx.id + ':' + fx.x + ':' + fx.y;
    let list = flameSpots.get(key);
    if (!list) {
      if (flameSpots.size > 40) flameSpots.clear();
      list = [];
      for (let i = 0; i < 32; i++) {
        const a = hash(fx.id * 3.1 + i * 7.7) * TAU, d = Math.sqrt(hash(fx.id + i * 1.37)) * .92;
        list.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d * .5, d, h: hash(i * 5.3 + fx.id), i });
      }
      list.sort((p, q) => p.dy - q.dy);
      flameSpots.set(key, list);
    }
    return list;
  }

  // Tapered lightning spear (shaft narrowing to a barbed point) between two points.
  function spearPath(ctx, hx, hy, tx, ty, w) {
    const dx = tx - hx, dy = ty - hy, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const mx = hx + dx * .86, my = hy + dy * .86;
    ctx.beginPath();
    ctx.moveTo(hx + nx * w * .5, hy + ny * w * .5);
    ctx.lineTo(mx + nx * w * .3, my + ny * w * .3);
    ctx.lineTo(mx + nx * w * .75, my + ny * w * .75);
    ctx.lineTo(tx, ty);
    ctx.lineTo(mx - nx * w * .75, my - ny * w * .75);
    ctx.lineTo(mx - nx * w * .3, my - ny * w * .3);
    ctx.lineTo(hx - nx * w * .5, hy - ny * w * .5);
    ctx.closePath();
  }
  function lightningSpear(ctx, hx, hy, tx, ty, w, a, seed, time, big) {
    const k = K();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = ink(a); spearPath(ctx, hx, hy, tx, ty, w + 6); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(140,50,250,${.8 * a})`; spearPath(ctx, hx, hy, tx, ty, w); ctx.fill();
    ctx.fillStyle = `rgba(214,170,255,${.8 * a})`; spearPath(ctx, hx, hy, tx, ty, w * .5); ctx.fill();
    ctx.fillStyle = `rgba(255,248,255,${.95 * a})`; spearPath(ctx, hx, hy, tx, ty, w * .18); ctx.fill();
    k.forkedBolt(ctx, hx, hy, tx, ty, seed, time, { jitter: w * .9 + 6, alpha: a, width: big ? 2.6 : 1.8, pal: PAL_HOT, base: INK, forkBase: true,
      forks: big ? 9 : 6, forkLen: big ? 70 : 42, step: big ? 40 : 28, rate: 24, snap: true });
    k.forkedBolt(ctx, hx, hy, tx, ty, seed + 9, time, { jitter: w * 1.5 + 10, alpha: .6 * a, width: 1.1, pal: PAL, forks: 3, forkLen: 30, step: 34, rate: 18, snap: true });
  }

  // Susanoo's two arms and great chakra bow, aimed along `ang` on the ground. `s` is the Susanoo's scale,
  // `drawK` how far the string is drawn (0..1). Returns the grip, nock and arrow-tip points.
  const RIG = { gx: 0, gy: 0, nx: 0, ny: 0, tipX: 0, tipY: 0, dx: 1, dy: 0 };
  function bowRig(ctx, x, fy, ang, s, lvl, drawK) {
    let dx = Math.cos(ang), dy = Math.sin(ang) * .55; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const px = -dy, py = dx, side = dx >= 0 ? 1 : -1;
    const gx = x + dx * 170 * s, gy = fy - 245 * s + dy * 80 * s;
    const nx = gx - dx * 170 * s * drawK, ny = gy - dy * 170 * s * drawK;
    const arm = (sx, sy, hx, hy, bend) => {
      const ex = (sx + hx) / 2 + bend, ey = (sy + hy) / 2 + 46 * s;
      for (const [x0, y0, x1, y1, w] of [[sx, sy, ex, ey, 40], [ex, ey, hx, hy, 32]]) {
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.strokeStyle = `rgba(22,2,50,${.7 * lvl})`; ctx.lineWidth = (w + 6) * s; ctx.stroke();
        ctx.strokeStyle = `rgba(122,60,226,${.55 * lvl})`; ctx.lineWidth = w * s; ctx.stroke();
        ctx.strokeStyle = `rgba(214,180,255,${.35 * lvl})`; ctx.lineWidth = w * .3 * s; ctx.stroke();
      }
      ctx.strokeStyle = `rgba(240,226,255,${.9 * lvl})`; ctx.lineWidth = 1.6;
      ctx.fillStyle = `rgba(150,96,250,${.85 * lvl})`;
      ctx.beginPath(); ctx.arc(ex, ey, 14 * s, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hx, hy, 20 * s, 15 * s, Math.atan2(hy - ey, hx - ex), 0, TAU); ctx.fill(); ctx.stroke();
    };
    arm(x + side * 108 * s, fy - 300 * s, gx, gy, side * 50 * s);
    arm(x - side * 108 * s, fy - 300 * s, nx, ny, -side * 26 * s);
    // Recurved bow: limbs sweep back from the grip and curl forward at the tips.
    const t1x = gx + px * 230 * s - dx * 80 * s, t1y = gy + py * 230 * s - dy * 80 * s;
    const t2x = gx - px * 230 * s - dx * 80 * s, t2y = gy - py * 230 * s - dy * 80 * s;
    const bow = () => {
      ctx.beginPath(); ctx.moveTo(t1x + dx * 26 * s + px * 8 * s, t1y + dy * 26 * s + py * 8 * s);
      ctx.quadraticCurveTo(t1x, t1y, t1x + dx * 4 * s, t1y + dy * 4 * s);
      ctx.quadraticCurveTo(gx + px * 140 * s + dx * 30 * s, gy + py * 140 * s + dy * 30 * s, gx, gy);
      ctx.quadraticCurveTo(gx - px * 140 * s + dx * 30 * s, gy - py * 140 * s + dy * 30 * s, t2x + dx * 4 * s, t2y + dy * 4 * s);
      ctx.quadraticCurveTo(t2x, t2y, t2x + dx * 26 * s - px * 8 * s, t2y + dy * 26 * s - py * 8 * s);
    };
    bow();
    ctx.strokeStyle = `rgba(24,4,54,${.85 * lvl})`; ctx.lineWidth = 20 * s + 2; ctx.stroke();
    ctx.strokeStyle = `rgba(150,80,250,${.9 * lvl})`; ctx.lineWidth = 14 * s + 1; ctx.stroke();
    ctx.strokeStyle = `rgba(250,238,255,${lvl})`; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = `rgba(235,215,255,${.9 * lvl})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.lineTo(nx, ny); ctx.lineTo(t2x, t2y); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    K().glow(ctx, gx, gy, 200 * s, '150,70,255', .3 * lvl);
    ctx.globalCompositeOperation = 'source-over';
    RIG.gx = gx; RIG.gy = gy; RIG.nx = nx; RIG.ny = ny; RIG.dx = dx; RIG.dy = dy;
    RIG.tipX = gx + dx * 200 * s; RIG.tipY = gy + dy * 200 * s;
    return RIG;
  }

  const OVER = {
    summon(ctx, fx, age, time) {
      const k = K(), L = lift();
      // Violet lightning strike from the sky.
      if (age < .4) {
        const a = 1 - ramp(age, .15, .4);
        k.forkedBolt(ctx, fx.x + 70, fx.y - 760, fx.x, fx.y - 6, fx.id, time, { jitter: 46, alpha: a, width: 4, pal: PAL_HOT, base: INK, forkBase: true,
          forks: 6, forkLen: 70, step: 34, rate: 30, snap: true });
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, fx.x, fx.y - L, 160 * (1 - age), '210,120,255', a, true);
        k.glow(ctx, fx.x, fx.y - 300, 50, '190,110,255', .6 * a, false, 6);
        ctx.globalCompositeOperation = 'source-over';
      }
      // Smoke of the summoning burst.
      const p = easeOut(age / .9), f = 1 - ramp(age, .5, fx.maxLife), po = k.puff('poof'), vi = k.puff('violet');
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9 + hash(fx.id + i), d = 20 + 70 * p * (.6 + hash(i) * .4);
        const x = fx.x + Math.cos(a) * d, y = fx.y - 18 + Math.sin(a) * d * .45 - p * 20;
        k.stamp(ctx, i % 3 ? po : vi, x, y, 28 + 30 * p, .8 * f);
      }
      ctx.globalCompositeOperation = 'lighter';
      chirps(ctx, fx.x, fx.y - L, 10, 30 + 40 * p, 12, time, fx.id, f);
      ctx.globalCompositeOperation = 'source-over';
    },
    exit(ctx, fx, age, time) {
      const k = K(), p = easeOut(age / .6), f = 1 - ramp(age, .3, fx.maxLife), sm = k.puff('smoke'), vi = k.puff('violet');
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7, d = 10 + 40 * p;
        k.stamp(ctx, i % 2 ? sm : vi, fx.x + Math.cos(a) * d, fx.y - 26 + Math.sin(a) * d * .5 - p * 16, 20 + 18 * p, .8 * f);
      }
      ctx.globalCompositeOperation = 'lighter';
      chirps(ctx, fx.x, fx.y - lift(), 8, 20 + 30 * p, 10, time, fx.id, f);
      ctx.globalCompositeOperation = 'source-over';
    },
    blink(ctx, fx, age, time) {
      const k = K(), f = 1 - age / fx.maxLife, L = lift();
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y] of [[fx.x, fx.y], [fx.x2, fx.y2]]) {
        k.glow(ctx, x, y - L, 46 * f + 10, '170,90,255', f, true);
        chirps(ctx, x, y - L, 6, 22, 9, time, fx.id + x, f);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(230,210,255,${.6 * f})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y - L); ctx.lineTo(fx.x2, fx.y2 - L); ctx.stroke();
    },
    eiso(ctx, fx, age, time) {
      const k = K(), L = lift(), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
      const hx = fx.x + ca * 18, hy = fx.y - L + sa * 8, seed = fx.id * 7.3;
      if (age < .32) {
        const c = age / .32;
        k.chidoriBall(ctx, hx, hy, 9 + c * 9, time, seed, { pal: PAL_HOT, body: BODY, dark: '26,2,52', base: INK, power: .4 + c * .6, bolts: 6 + Math.round(c * 4), width: .9 });
        return;
      }
      const t = age - .32, ext = easeOut(t / .09), f = 1 - ramp(age, .62, fx.maxLife);
      const reach = 18 + fx.len * ext;
      const tx = fx.x + ca * reach, ty = fx.y + sa * reach - L * .8;
      ctx.save();
      lightningSpear(ctx, hx, hy, tx, ty, 15 * f + 4, f, seed, time, false);
      k.glow(ctx, hx, hy, 42, '170,80,255', .8 * f, true);
      k.glow(ctx, tx, ty, 60 + 50 * (1 - ext), '200,120,255', f, true);
      if (t < .3) k.glow(ctx, tx, ty + L * .6, 190 * easeOut(t / .3), MAGENTA, (1 - t / .3) * .7, false, .6);
      chirps(ctx, tx, ty, 8, 26, 14, time, seed, f);
      ctx.restore();
    },
    nagashi(ctx, fx, age, time) {
      const k = K(), L = lift(), cx = fx.x, cy = fx.y - L, seed = fx.id * 3.7;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (age < .26) {
        const c = age / .26;
        k.glow(ctx, cx, cy, 30 + 30 * c, '150,60,255', .6 * c, true);
        chirps(ctx, cx, cy, 8, 22, 10, time, seed, c);
        ctx.restore();
        return;
      }
      const t = age - .26, f = 1 - ramp(age, .6, fx.maxLife);
      if (t < .2) k.glow(ctx, cx, cy, 90 + 260 * t, '230,200,255', 1 - t / .2, true);
      k.glow(ctx, cx, cy, 130, '120,40,240', .45 * f, false, .85);
      // Current pouring out of his whole body: arcs whipping up and out.
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * .55 + (k.wobble(seed + i * 3, time, 6) - .5) * .5;
        const l = (70 + hash(seed + i) * 60) * (.6 + .4 * f);
        k.forkedBolt(ctx, cx, cy + 6, cx + Math.cos(a) * l * 1.3, cy + Math.sin(a) * l * .9, seed + i * 17, time,
          { jitter: 16, alpha: f, width: 1.6, pal: PAL_HOT, base: ink(f), forkBase: true, step: 12, forks: 2, forkLen: 24, rate: 24, snap: true });
      }
      ctx.globalCompositeOperation = 'lighter';
      chirps(ctx, cx, cy, 12, 50 + 160 * easeOut(t * 3), 16, time, seed, f);
      ctx.restore();
    },
    amaterasu(ctx, fx, age, time) {
      const k = K();
      if (age < .5) {
        // Sasuke's eye bleeds as he focuses: a red glint at his face, a black spot igniting on the target.
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, fx.sx + 4, fx.sy - lift() - 34, 14 + 8 * Math.sin(age * 40), '255,40,60', .9, true);
        ctx.globalCompositeOperation = 'source-over';
        k.glow(ctx, fx.x, fx.y - 20, 30 * age / .5, '0,0,0', .9, false, 1);
        return;
      }
      const t = age - .5, erupt = easeOut(t / .25), burst = 1 + .7 * (1 - ramp(t, .1, .5)), f = clamp01(fx.life / .9);
      const m = ctx.getTransform(), spots = amaSpots(fx), tick = Math.floor(time * 12);
      ctx.save();
      k.glow(ctx, fx.x, fx.y - 14, fx.r * .95, '46,0,26', .5 * erupt * f, false, .6);
      for (const s of spots) {
        const h = (36 + s.h * 58) * erupt * burst * f * (1 - s.d * .35) * (.88 + .12 * Math.sin(time * 9 + s.i));
        if (h < 6) continue;
        const img = amaFlame((s.i + tick) % 6);
        const x = fx.x + s.dx * fx.r, y = fx.y + s.dy * fx.r;
        ctx.globalAlpha = .95;
        ctx.drawImage(img, x - h * .36, y - h * FLAME_BASE, h * .72, h);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(m);
      // Black smoke rising from the fire.
      const sm = k.puff('smoke');
      for (let i = 0; i < 5; i++) {
        const ph = frac(time * .35 + i * .2), x = fx.x + (hash(fx.id + i) - .5) * fx.r * 1.2;
        k.stamp(ctx, sm, x, fx.y - 40 - ph * 150, 30 + ph * 40, .4 * (1 - ph) * erupt * f);
      }
      if (t < .4) {
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, fx.x, fx.y - 30, fx.r * .8, '120,10,60', .5 * (1 - t / .4), false, .6);
      }
      ctx.restore();
    },
    kagutsuchi(ctx, fx, age, time) {
      const k = K(), L = lift(), m = ctx.getTransform(), tick = Math.floor(time * 14);
      ctx.save();
      if (age < .42) {
        // Black flames gathering into blades around Sasuke.
        const c = clamp01(age / .3), hx = fx.x + Math.cos(fx.a) * 16, hy = fx.y - L;
        for (let i = 0; i < 3; i++) {
          const h = (30 + 26 * c) * (1 - ramp(age, .3, .42)) * (1 - i * .2), img = amaFlame((i + tick) % 6);
          ctx.drawImage(img, hx - h * .3 + (i - 1) * 10, hy + 14 - h * FLAME_BASE, h * .6, h);
        }
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, hx, hy, 34 * c, '140,30,120', .5 * c);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let i = 0; i < 5; i++) {
        const t0 = kaguIndexTime(i);
        if (age < t0) continue;
        const a = fx.a + (i - 2) * .2, ca = Math.cos(a), sa = Math.sin(a), p = (age - t0) / .3;
        const img = amaFlame((i * 2 + tick) % 6);
        if (p <= 1) {
          const d = 20 + (fx.len - 20) * easeOut(p), x = fx.x + ca * d, y = fx.y + sa * d - L * .7;
          // Dark streak behind the blade.
          const d0 = Math.max(20, d - 200);
          ctx.strokeStyle = 'rgba(40,6,50,.28)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(fx.x + ca * d0, fx.y + sa * d0 - L * .7); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          k.glow(ctx, x, y, 44, '150,30,120', .45);
          ctx.globalCompositeOperation = 'source-over';
          // A blade of black fire with a tail of smaller tongues trailing behind it.
          const smk = k.puff('smoke');
          for (let j = 1; j <= 3; j++) if (d - j * 46 > 20) k.stamp(ctx, smk, x - ca * j * 46, y - sa * j * 46 - j * 4, 14 + j * 5, .5 - j * .12);
          ctx.setTransform(m); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
          ctx.drawImage(img, -24, -78, 48, 118);
          ctx.setTransform(m);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalCompositeOperation = 'source-over';
        } else {
          // Landed: the blade bursts into a short-lived pillar of black fire.
          const q = clamp01((p - 1) * .3 / Math.max(.2, fx.maxLife - t0 - .3)), x = fx.x + ca * fx.len, y = fx.y + sa * fx.len;
          for (let j = 0; j < 3; j++) {
            const h = (70 - j * 14) * (1 - q) * (j === 1 ? 1.2 : 1);
            if (h < 4) continue;
            ctx.drawImage(amaFlame((j + i + tick) % 6), x + (j - 1) * 16 - h * .36, y - h * FLAME_BASE, h * .72, h);
          }
        }
      }
      ctx.restore();
    },
    tejikara(ctx, fx, age, time) {
      const k = K(), L = lift(), S = SPR();
      const f = 1 - ramp(age, .35, fx.maxLife);
      ctx.save();
      // Afterimage left where he stood.
      if (S && age < .4) S.draw(ctx, SPRITE, fx.x1, fx.y1 + 3, { facing: fx.f1 || 1, frame: 'idle', alpha: .55 * (1 - age / .4), flash: .8 });
      ctx.globalCompositeOperation = 'lighter';
      if (age < .3) {
        const g = 1 - age / .3;
        k.glow(ctx, fx.x1, fx.y1 - L, 60 * g + 10, '170,110,255', g, true);
        k.glow(ctx, fx.x, fx.y - L, 70 * g + 10, '170,110,255', g, true);
      }
      // Kusanagi cut: a wide inked crescent with lightning running along the blade's path.
      const pr = easeOut(ramp(age, .06, .2)), a0 = fx.a - 1.35, a1 = a0 + 2.7 * pr;
      if (pr > 0 && f > 0) {
        const cx = fx.x, cy = fx.y - L * .7;
        ctx.translate(cx, cy); ctx.scale(1, .55);
        ctx.globalCompositeOperation = 'source-over';
        crescent(ctx, 0, 0, 132, a0, a1, 14 * f + 2, `rgba(36,6,78,${.65 * f})`);
        ctx.globalCompositeOperation = 'lighter';
        crescent(ctx, 0, 0, 128, a0 + .04, a1, 11 * f + 2, `rgba(170,80,255,${.85 * f})`);
        crescent(ctx, 0, 0, 126, a0 + .1, a1 - .03, 3.4 * f + .8, `rgba(255,246,255,${.95 * f})`);
        crescent(ctx, 0, 0, 92, a0 + .3, a1 - .2, 5 * f + 1, `rgba(150,60,240,${.5 * f})`);
        ctx.restore(); ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const p0x = cx + Math.cos(a0 + .2) * 128, p0y = cy + Math.sin(a0 + .2) * 70;
        const p1x = cx + Math.cos(a1) * 128, p1y = cy + Math.sin(a1) * 70;
        k.forkedBolt(ctx, p0x, p0y, p1x, p1y, fx.id, time, { jitter: 18, alpha: f, width: 1.4, pal: PAL_HOT, base: ink(f), forkBase: true, step: 18, forks: 3, forkLen: 26, rate: 24, snap: true });
        chirps(ctx, p1x, p1y, 8, 16, 12, time, fx.id, f);
      }
      ctx.restore();
    },
    arrows(ctx, fx, age, time, st) {
      const k = K(), L = lift();
      const appear = easeOut(age / .3), lvl = !st.ally ? 0 : age < 1 ? appear : 1 - ramp(age, 1, 1.4), s = PS_SCALE * HALF_SCALE;
      const drawK = age < ARROW_REL ? easeOut(age / .5) * .55 : Math.max(0, 1 - (age - ARROW_REL) / .06) * .55;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const R = lvl > .01 ? bowRig(ctx, fx.x, fx.y + 3, fx.a, s, lvl, drawK) : null;
      if (R && age < ARROW_REL) {
        // Seven arrows nocked in a fan.
        for (let i = 0; i < 7; i++) {
          const a = fx.a + (i - 3) * .12, ux = Math.cos(a), uy = Math.sin(a) * .55, ul = Math.hypot(ux, uy);
          lightningSpear(ctx, R.nx, R.ny, R.nx + ux / ul * 170, R.ny + uy / ul * 170, 7, appear, fx.id + i, time, false);
        }
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, R.nx, R.ny, 46, '210,150,255', appear, true);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 7; i++) {
        const t0 = arrowRelease(i), p = (age - t0) / .36;
        if (p < 0) continue;
        const a = fx.a + (i - 3) * .12, ux = Math.cos(a), uy = Math.sin(a);
        if (p <= 1) {
          const at = d => { const q = d / fx.len; return [fx.x + ux * d, fx.y + uy * d - (L + 90 * (1 - smooth(q * 1.4)))]; };
          const d1 = 60 + (fx.len - 60) * p, [hx, hy] = at(d1), [tx, ty] = at(Math.max(60, d1 - 200));
          lightningSpear(ctx, tx, ty, hx, hy, 12, 1, fx.id * 9 + i, time, false);
          ctx.globalCompositeOperation = 'lighter';
          k.glow(ctx, hx, hy, 46, '210,150,255', .9, true);
          ctx.globalCompositeOperation = 'source-over';
        } else if (p < 2.2) {
          const q = (p - 1) / 1.2, x = fx.x + ux * fx.len, y = fx.y + uy * fx.len;
          ctx.globalCompositeOperation = 'lighter';
          k.glow(ctx, x, y - L, 100 * (1 - q * .5), '180,90,255', 1 - q, true);
          chirps(ctx, x, y - L, 7, 30 + 46 * q, 13, time, i, 1 - q);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.restore();
    },
    kirin(ctx, fx, age, time) {
      const k = K(), gather = easeOut(age / 1), fade = 1 - ramp(age, 2.3, fx.maxLife);
      const cx = fx.x, cy = fx.y - 340, seed = fx.id * 11.3, side = fx.side || 1;
      ctx.save();
      // Thunderclouds churning over the target.
      k.glow(ctx, cx, cy, 470 * (.5 + .5 * gather), '18,10,32', .75 * gather * fade, false, .34);
      const sm = k.puff('smoke'), vi = k.puff('violet');
      for (let i = 0; i < 15; i++) {
        const a = hash(seed + i) * TAU + time * .15 * (i % 2 ? 1 : -1), rr = (60 + hash(seed + i * 3) * 280) * (.4 + .6 * gather);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .26 + (hash(i) - .5) * 40;
        const s = (80 + hash(seed + i * 7) * 70) * (.5 + .5 * gather);
        k.stamp(ctx, i % 4 ? sm : vi, x, y, s, .85 * gather * fade, .62);
      }
      ctx.globalCompositeOperation = 'lighter';
      const tick = Math.floor(time * 9);
      for (let i = 0; i < 3; i++) {
        if (hash(seed + i * 5 + tick) < .55) continue;
        const a = hash(seed + i * 13 + tick) * TAU, rr = hash(seed + i + tick) * 260;
        k.glow(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .26, 120, '170,110,255', .5 * gather * fade);
      }
      // Leaders crackling from the cloud before the strike.
      if (age > .6 && age < KIRIN_STRIKE) {
        const lx = fx.x + (k.wobble(seed, time, 3) - .5) * 300;
        if (hash(seed + tick) > .45) k.forkedBolt(ctx, cx + (hash(tick) - .5) * 300, cy + 40, lx, fx.y - 10, seed + tick, time,
          { jitter: 40, alpha: .7, width: 1.6, pal: PAL_HOT, base: INK, forkBase: true, forks: 3, forkLen: 50, step: 40, rate: 20, snap: true });
      }
      // Kirin: the lightning dragon diving out of the clouds.
      if (age >= KIRIN_STRIKE && age < KIRIN_HIT + .6) {
        const P0 = [cx + 190 * side, cy + 10], P1 = [fx.x - 250 * side, fx.y - 300], P2 = [fx.x + 190 * side, fx.y - 150], P3 = [fx.x, fx.y - 14];
        const B = t => {
          const u = 1 - t;
          return [u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0],
            u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]];
        };
        const head = easeIn((age - KIRIN_STRIKE) / (KIRIN_HIT - KIRIN_STRIKE));
        const tail = ramp(age, KIRIN_HIT, KIRIN_HIT + .5);
        const a = 1 - ramp(age, KIRIN_HIT + .25, KIRIN_HIT + .6);
        const N = 22, pts = [];
        const t0 = Math.max(0, head - .9, tail * head);
        for (let i = 0; i <= N; i++) pts.push(B(t0 + (head - t0) * i / N));
        // Body: thick inked serpent, violet glow, lavender and a white-hot spine; thin toward the tail.
        const layers = [['source-over', w => `rgba(22,0,48,${.8 * a})`, 66], ['lighter', () => `rgba(130,46,240,${.7 * a})`, 54],
          ['lighter', () => `rgba(210,160,255,${.8 * a})`, 26], ['lighter', () => `rgba(255,250,255,${a})`, 9]];
        for (const [op, col, w] of layers) {
          ctx.globalCompositeOperation = op; ctx.strokeStyle = col(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (let c = 0; c < 3; c++) {
            const i0 = Math.floor(c * N / 3), i1 = Math.floor((c + 1) * N / 3);
            ctx.lineWidth = w * (.45 + .28 * c);
            ctx.beginPath(); ctx.moveTo(pts[i0][0], pts[i0][1]);
            for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'lighter';
        for (let c = 0; c < 3; c++) {
          const p0 = pts[Math.floor(c * N / 3)], p1 = pts[Math.floor((c + 1) * N / 3)];
          k.forkedBolt(ctx, p0[0], p0[1], p1[0], p1[1], seed + c * 7, time, { jitter: 34, alpha: a, width: 2, pal: PAL_HOT, base: ink(a), forkBase: true,
            forks: 4, forkLen: 60, step: 26, rate: 24, snap: true });
        }
        // Head, oriented along the dive.
        const hp = pts[N], hq = pts[N - 2], dir = Math.atan2(hp[1] - hq[1], hp[0] - hq[0]);
        if (head < 1 || age < KIRIN_HIT + .2) {
          const ha = head < 1 ? 1 : 1 - ramp(age, KIRIN_HIT, KIRIN_HIT + .2);
          ctx.save(); ctx.translate(hp[0], hp[1]); ctx.rotate(dir); if (Math.cos(dir) < 0) ctx.scale(1, -1);
          ctx.scale(1.15, 1.15); ctx.translate(-66, 0);
          ctx.globalCompositeOperation = 'source-over';
          kirinHead(ctx); ctx.fillStyle = `rgba(22,0,48,${.85 * ha})`; ctx.fill();
          ctx.strokeStyle = `rgba(22,0,48,${.85 * ha})`; ctx.lineWidth = 10; ctx.stroke();
          ctx.fillStyle = `rgba(118,48,226,${.95 * ha})`; ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(245,230,255,${ha})`; ctx.lineWidth = 2.6; ctx.stroke();
          ctx.save(); ctx.translate(30, 0); ctx.scale(.62, .5); kirinHead(ctx); ctx.restore();
          ctx.fillStyle = `rgba(230,200,255,${.7 * ha})`; ctx.fill();
          k.glow(ctx, 52, -14, 22, '255,250,255', ha, true);
          ctx.restore();
          ctx.globalCompositeOperation = 'lighter';
          k.glow(ctx, hp[0], hp[1], 90, '170,90,255', .35 * ha);
        }
      }
      // Impact: blinding flash and a column of light.
      if (age >= KIRIN_HIT && age < KIRIN_HIT + .5) {
        const q = (age - KIRIN_HIT) / .5;
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, fx.x, fx.y - 40, 360 * (.5 + q), '230,200,255', (1 - q) * .9, true, .7);
        k.glow(ctx, fx.x, fx.y - 300, 90 * (1 - q * .5), '200,140,255', 1 - q, false, 4);
      }
      // Aftershock: arcs whipping up from the crater.
      if (age > KIRIN_HIT && age < KIRIN_HIT + 1.1) {
        const v = 1 - ramp(age, KIRIN_HIT, KIRIN_HIT + 1.1);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + (i - 1.5) * .6 + (k.wobble(seed + i * 3, time, 5) - .5) * .6, l = 140 + hash(seed + i) * 120;
          const bx = fx.x + (i - 1.5) * 70, by = fx.y + (hash(i + seed) - .5) * 60;
          k.forkedBolt(ctx, bx, by, bx + Math.cos(a) * l * .6, by + Math.sin(a) * l, seed + i * 17, time,
            { jitter: 24, alpha: v, width: 1.8, pal: PAL_HOT, base: ink(v), forkBase: true, step: 22, forks: 1, forkLen: 30, rate: 22, snap: true });
        }
      }
      ctx.restore();
    },
    indra(ctx, fx, age, time, st) {
      const k = K();
      // Perfect Susanoo frame (matches drawPerfect in drawAlly).
      const lvl = age < 3 ? easeOut(age / IN_RISE) : 1 - ramp(age, 3, 3.6);
      const s = PS_SCALE * (.85 + .15 * lvl), fy = fx.y + 3 + (1 - lvl) * 60;
      const drawK = age < IN_FIRE ? easeOut(ramp(age, IN_RISE * .8, IN_FIRE - .1)) : Math.max(0, 1 - (age - IN_FIRE) / .08);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // Without Sasuke (dismissed mid-cast) or once the Susanoo has faded, only the released beam remains.
      if (!st.ally || lvl <= .01) {
        ctx.restore();
        if (age >= IN_FIRE) { const S0 = PS_SCALE; let dx = Math.cos(fx.a), dy = Math.sin(fx.a) * .55; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
          drawIndraBeam(ctx, fx, age, time, fx.x + dx * 370 * S0, fx.y + 3 - 245 * S0 + dy * 280 * S0); }
        return;
      }
      const R = bowRig(ctx, fx.x, fy, fx.a, s, lvl, drawK);
      const nx = R.nx, ny = R.ny, dx = R.dx, dy = R.dy, tipX = R.tipX, tipY = R.tipY;
      // The arrow of lightning and chakra, swelling as it is drawn.
      if (age < IN_FIRE && age > IN_RISE * .6) {
        const c = ramp(age, IN_RISE * .6, IN_FIRE);
        lightningSpear(ctx, nx - dx * 20, ny - dy * 20, tipX, tipY, (10 + 26 * c) * s * 1.2, c, fx.id, time, true);
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, tipX, tipY, (60 + 120 * c) * s, '210,150,255', c, true);
        k.glow(ctx, tipX, tipY, (150 + 200 * c) * s, MAGENTA, .35 * c);
        // Chakra drawn into the arrowhead from all around.
        ctx.strokeStyle = `rgba(230,200,255,${.75 * c})`; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const ph = frac(time * 1.6 + hash(i * 3.3)), a = hash(i * 7.1 + fx.id) * TAU, r0 = (260 - 220 * ph) * s, r1 = r0 + 40 * s;
          ctx.moveTo(tipX + Math.cos(a) * r1, tipY + Math.sin(a) * r1 * .7); ctx.lineTo(tipX + Math.cos(a) * r0, tipY + Math.sin(a) * r0 * .7);
        }
        ctx.stroke();
        // Lightning rings coiling round the arrowhead.
        for (let i = 0; i < 2; i++) {
          const a0 = time * 7 + i * Math.PI, rr = (40 + 30 * c) * s;
          k.forkedBolt(ctx, tipX + Math.cos(a0) * rr, tipY + Math.sin(a0) * rr * .6, tipX + Math.cos(a0 + 2.2) * rr, tipY + Math.sin(a0 + 2.2) * rr * .6,
            fx.id + i * 5, time, { jitter: 12, alpha: c, width: 1.4, pal: PAL_HOT, base: INK, step: 12, forks: 1, forkLen: 20, rate: 26, snap: true });
        }
        chirps(ctx, tipX, tipY, 12, 50 * s, 16, time, fx.id, c);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
      if (age >= IN_FIRE) drawIndraBeam(ctx, fx, age, time, tipX, tipY);
    },
    slash(ctx, fx, age) {
      const L = lift(), p = easeOut(age / .14), f = 1 - ramp(age, .14, fx.maxLife), sd = fx.side || 1;
      const a0 = fx.a - sd * 1.1, a1 = a0 + sd * 2.2 * p;
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      if (hi - lo < .05 || f <= 0) return;
      ctx.save();
      ctx.translate(fx.x, fx.y - L * .7); ctx.scale(1, .6);
      crescent(ctx, 0, 0, 84, lo, hi, 7 * f + 1, `rgba(36,6,78,${.6 * f})`);
      ctx.globalCompositeOperation = 'lighter';
      crescent(ctx, 0, 0, 81, lo + .05, hi - .02, 5 * f + 1, `rgba(170,90,255,${.85 * f})`);
      crescent(ctx, 0, 0, 79, lo + .1, hi - .05, 1.6 * f + .5, `rgba(255,248,255,${f})`);
      ctx.restore();
    }
  };
  const PS_SCALE = .74, HALF_SCALE = .6;

  // Indra's Arrow released: a colossal beam diving from the bow onto its ground path.
  function drawIndraBeam(ctx, fx, age, time, tipX, tipY) {
    const k = K(), t = age - IN_FIRE, L = lift();
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    const front = easeOut(t / .14), f = 1 - ramp(age, IN_FIRE + .9, fx.maxLife);
    const width = (f * .85 + .15) * (1 + .07 * Math.sin(time * 42));
    // The arrow dives from the bow onto the ground and tears along it: a quadratic curve whose control
    // point sits on the ground path, cut at the advancing front (de Casteljau).
    const endX = fx.x + ca * (60 + fx.len), endY = fx.y + sa * (60 + fx.len) - L;
    const cX = fx.x + ca * (60 + fx.len * .3), cY = fx.y + sa * (60 + fx.len * .3) - L;
    const c1x = tipX + (cX - tipX) * front, c1y = tipY + (cY - tipY) * front;
    const ex = (1 - front) * (1 - front) * tipX + 2 * (1 - front) * front * cX + front * front * endX;
    const ey = (1 - front) * (1 - front) * tipY + 2 * (1 - front) * front * cY + front * front * endY;
    const P = u => { const v = 1 - u; return [v * v * tipX + 2 * v * u * c1x + u * u * ex, v * v * tipY + 2 * v * u * c1y + u * u * ey]; };
    ctx.save(); ctx.lineCap = 'round';
    const stroke = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo(c1x, c1y, ex, ey); ctx.stroke(); };
    stroke(176 * width, `rgba(20,0,44,${.72 * f})`);
    ctx.globalCompositeOperation = 'lighter';
    stroke(156 * width, `rgba(104,28,226,${.55 * f})`);
    stroke(110 * width, `rgba(168,88,255,${.6 * f})`);
    stroke(64 * width, `rgba(228,192,255,${.8 * f})`);
    stroke(26 * width, `rgba(255,252,255,${.95 * f})`);
    // Ribbons of chakra twisting round the beam.
    ctx.lineWidth = 5 * width; ctx.lineJoin = 'round';
    for (const ph of [0, Math.PI]) {
      ctx.strokeStyle = `rgba(240,215,255,${.55 * f})`;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const u = i / 64, [x, y] = P(u), [x2, y2] = P(Math.min(1, u + .01));
        const dl = Math.hypot(x2 - x, y2 - y) || 1, o = Math.sin(u * 15 - time * 24 + ph) * 64 * width * Math.min(1, u * 6);
        const qx = x - (y2 - y) / dl * o, qy = y + (x2 - x) / dl * o;
        if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy);
      }
      ctx.stroke();
    }
    // Speed streaks racing alongside the beam.
    ctx.lineWidth = 2.2; ctx.strokeStyle = `rgba(250,240,255,${.75 * f})`;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const u0 = frac(hash(i * 3.7) + time * 2.2), u1 = Math.min(1, u0 + .08 + hash(i) * .06), side = i % 2 ? 1 : -1, off = side * (92 + hash(i * 5.1) * 50) * width;
      const [ax, ay] = P(u0), [bx, by] = P(u1), dl = Math.hypot(bx - ax, by - ay) || 1, ox = -(by - ay) / dl * off, oy = (bx - ax) / dl * off;
      ctx.moveTo(ax + ox, ay + oy); ctx.lineTo(bx + ox, by + oy);
    }
    ctx.stroke();
    // Lightning wrapping the beam and glows riding along it.
    for (let i = 0; i < 3; i++) {
      const [x0, y0] = P(i / 3), [x1, y1] = P((i + 1) / 3);
      k.forkedBolt(ctx, x0, y0, x1, y1, fx.id * 3 + i, time,
        { jitter: 58 * width, alpha: f, width: 2.4, pal: PAL_HOT, base: ink(f), forkBase: true, forks: 5, forkLen: 80, step: 30, rate: 26, snap: true });
    }
    for (let i = 1; i < 6; i++) {
      const ph = frac(time * 3 + i * .37), [x, y] = P(i / 6);
      k.glow(ctx, x, y, (130 + 70 * ph) * width, '190,120,255', .45 * f);
    }
    // Release flash at the bow and the blast where it lands.
    if (t < .35) k.glow(ctx, tipX, tipY, 460 * easeOut(t / .1), '240,220,255', 1 - t / .35, true);
    k.glow(ctx, ex, ey, 210 * width + 80 * (1 - front), '230,200,255', f, true);
    if (front >= 1) {
      const q = ramp(t, .14, 1.3);
      k.glow(ctx, endX, endY + L, 420 * easeOut(q * 2), '170,80,255', .7 * (1 - q), false, .6);
      ctx.globalCompositeOperation = 'source-over';
      const sm = k.puff('smoke'), vi = k.puff('violet');
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7 + fx.id, d = 50 + 180 * easeOut(q * 1.5);
        k.stamp(ctx, i % 2 ? sm : vi, endX + Math.cos(a) * d, endY + L + Math.sin(a) * d * .45 - q * 90, 56 + 56 * q, .6 * (1 - q));
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * .6 + (k.wobble(fx.id + i * 3, time, 5) - .5) * .5, l = (160 + hash(i + fx.id) * 120) * (1 - q);
        if (l < 20) continue;
        k.forkedBolt(ctx, endX, endY + L, endX + Math.cos(a) * l * .7, endY + L + Math.sin(a) * l, fx.id + i * 17, time,
          { jitter: 22, alpha: 1 - q, width: 1.8, pal: PAL_HOT, base: ink(1 - q), forkBase: true, step: 18, forks: 2, forkLen: 30, rate: 22, snap: true });
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ ally drawing
  // Perfect Susanoo behind Sasuke (`k` scales it down for the half-formed Susanoo of the arrow volley).
  function drawPerfect(ctx, al, time, lvl, kS = 1, alpha = .92) {
    const k = K(), s = PS_SCALE * kS * (.85 + .15 * lvl);
    const fy = al.y + 3 + (1 - lvl) * 60 * kS, facing = Math.cos(al.angle || 0) >= 0 ? 1 : -1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, al.x, fy - 220 * s, 300 * s, '110,40,240', .35 * lvl);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha * lvl;
    ctx.translate(al.x, fy); ctx.scale(facing * s, s);
    ctx.drawImage(psSprite(), -PS_OX, -PS_OY);
    ctx.globalAlpha = 1;
    // Violet chakra flames wrapping the base, and the glowing eyes.
    const tick = Math.floor(time * 11);
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * 30, h = (150 - Math.abs(i - 3) * 22 + hash(i * 2) * 30) * lvl * (.9 + .1 * Math.sin(time * 8 + i));
      if (h < 8) continue;
      ctx.globalAlpha = .6 * lvl;
      ctx.drawImage(k.flame((i + tick) % 6, VIOLET_FLAME, 'sv'), ox - h * .28, -10 + Math.abs(i - 3) * 5 - h * FLAME_BASE, h * .56, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    const pulse = .8 + .2 * Math.sin(time * 6);
    k.glow(ctx, -15, -364, 16, '235,215,255', lvl * pulse, true); k.glow(ctx, 15, -364, 16, '235,215,255', lvl * pulse, true);
    ctx.restore();
  }

  function drawRibs(ctx, al, time, front) {
    const lvl = al.aura;
    if (!(lvl > .03)) return;
    const flick = .75 + .25 * Math.sin(time * 13 + (front ? 1 : 0)) * Math.sin(time * 7.3);
    ctx.save();
    ctx.globalAlpha = Math.min(1, lvl * flick * (front ? .55 : .7));
    ctx.drawImage(ribSprite(front), al.x - 70, al.y + 3 - 145, 140, 150);
    ctx.restore();
  }

  function drawLabel(ctx, al) {
    if (!(al.labelT > 0) || !al.label) return;
    const S = SPR(), a = Math.min(1, al.labelT / .3);
    const top = al.y + 3 - (S ? S.height(SPRITE) : 77) - 22;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#12061e'; ctx.strokeText(al.label, al.x, top);
    ctx.fillStyle = al.move === 'indra' ? '#f2e2ff' : '#d4b0ff'; ctx.fillText(al.label, al.x, top);
    if (al.jp) {
      ctx.font = '700 9px sans-serif'; ctx.lineWidth = 3;
      ctx.strokeText(al.jp, al.x, top - 13); ctx.fillStyle = '#fff4ff'; ctx.fillText(al.jp, al.x, top - 13);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ module
  window.SasukeIndra = {
    summon(st, x, y, angle, api) {
      st.ally = { x, y, r: 14, angle: angle || 0, pose: 'seal', moving: 0, aura: 0, sus: 0, flash: 1,
        half: 0, move: '', mt: 0, fx: 0, gap: .9, step: 0,
        // Re-summoning does not reset the ultimate's cooldown.
        ult: Math.max(FIRST_ULT, Math.min(ULT_COOLDOWN, (st.ultAt || 0) - (api ? api.time : 0))), seek: 0, slashCd: .6, chase: 0, swing: 0, sc: 1,
        side: Math.random() < .5 ? -1 : 1, label: '', jp: '', labelT: 0, target: null };
      addFx(st, 'summon', { x: R(x), y: R(y), life: 1.2 });
    },
    dismiss(st, api) {
      const al = st.ally;
      if (!al) return;
      // Jutsu still winding up are cancelled with him; released ones finish.
      for (let i = st.effects.length - 1; i >= 0; i--) {
        const f = st.effects[i];
        if (((f.kind === 'indra' || f.kind === 'arrows') && f.s === 0) || f.kind === 'slash') st.effects.splice(i, 1);
      }
      addFx(st, 'exit', { x: R(al.x), y: R(al.y), life: .8 });
      if (api && api.burst) api.burst(al.x, al.y - 20, '#a678ff', 12);
      st.ally = null;
    },
    update(st, dt, api) {
      const list = st.effects;
      for (let i = list.length - 1; i >= 0; i--) {
        const fx = list[i];
        fx.life -= dt;
        const hit = HIT[fx.kind];
        if (hit) hit(fx, fx.maxLife - fx.life, api);
        if (fx.life <= 0) list.splice(i, 1);
      }
      if (st.ally) think(st, st.ally, dt, api);
    },
    drawAlly(ctx, al, time) {
      const S = SPR();
      if (!S || !K()) return;
      const facing = Math.cos(al.angle || 0) >= 0 ? 1 : -1, feetY = al.y + 3;
      if (al.sus > .01) drawPerfect(ctx, al, time, al.sus);
      else if (al.half > .01) drawPerfect(ctx, al, time, al.half, HALF_SCALE, .62);
      S.shadow(ctx, al.x, feetY, 15);
      drawRibs(ctx, al, time, false);
      const frame = al.pose === 'run' ? 'run' : al.pose || 'idle';
      S.draw(ctx, SPRITE, al.x, feetY, frame === 'run' ? { facing, frame, phase: time * 14, flash: al.flash }
        : { facing, frame, flash: al.flash, seed: 3.1 });
      drawRibs(ctx, al, time, true);
      const top = feetY - S.height(SPRITE) - 6;
      ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = '#140a20'; ctx.strokeText('SASUKE · INDRA', al.x, top);
      ctx.fillStyle = '#c9a6ff'; ctx.fillText('SASUKE · INDRA', al.x, top);
      ctx.textBaseline = 'alphabetic';
    },
    drawGround(ctx, st, time) {
      const list = st.effects;
      if (!list || !list.length || !K()) return;
      setView(ctx);
      for (const fx of list) {
        const fn = GROUND[fx.kind];
        if (!fn || !vis(fx.x, fx.y, fx.kind === 'indra' ? 1400 : fx.kind === 'arrows' ? 1100 : fx.kind === 'eiso' ? 800 : 700)) continue;
        ctx.save();
        fn(ctx, fx, fx.maxLife - fx.life, time);
        ctx.restore();
      }
    },
    drawOverlay(ctx, st, time) {
      const list = st.effects, al = st.ally;
      if (!K()) return;
      if (list && list.length) {
        setView(ctx);
        for (const fx of list) {
          const fn = OVER[fx.kind];
          if (!fn || !vis(fx.x, fx.y, fx.kind === 'indra' ? 1500 : fx.kind === 'arrows' ? 1200 : fx.kind === 'kirin' ? 900 : 800)) continue;
          ctx.save();
          fn(ctx, fx, fx.maxLife - fx.life, time, st);
          ctx.restore();
        }
      }
      if (al) drawLabel(ctx, al);
    }
  };
})();
