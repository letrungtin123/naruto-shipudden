(() => {
  'use strict';

  // Kẻ thù truyền kiếp: Uchiha Sasuke with the Rinnegan (spawn panel, faction 'sasuke').
  // Contract as nagato-boss.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
  // ground layer (telegraphs, scorches, the Perfect Susanoo standing behind him), drawOverlay(ctx, z,
  // time) what stands above the characters (spears, flames, the bow, Kirin, Indra's Arrow).
  // All per-boss state lives on z.sk. His Chidori is the classic blue-white (inked dark blue so it
  // reads on bright ground); Susanoo and the Rinnegan are violet; Amaterasu is pitch black.
  // Moves: Chidori Eisō (branching spear), Amenotejikara (two swap-and-cut hops), Amaterasu (three
  // lingering black fires), Chidori Nagashi (discharge + outer ring), Chidori Senbon (needle rain),
  // Susanoo arrow volley, Enton Kagutsuchi (black-flame blades that keep burning), Kirin, and the
  // ultimate Indra's Arrow from a winged Perfect Susanoo. When he takes a beating he raises the
  // Susanoo ribcage for a moment.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const turn = (a, b, max) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-max, Math.min(max, d)); };
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const SPRITE = 'sasuke';

  const order = ['sasuke'];
  const members = {
    sasuke: {
      name: 'UCHIHA SASUKE — RINNEGAN', short: 'SASUKE', accent: '#9a6bff', hpScale: 3.8, damageScale: 2.0, armor: .88,
      // Every jutsu shows once in the first ~25 s, Indra's Arrow last; the second lap reorders them.
      moves: ['eiso', 'tejikara', 'amaterasu', 'nagashi', 'senbon', 'arrows', 'kagutsuchi', 'kirin', 'indra',
        'tejikara', 'nagashi', 'eiso', 'kirin', 'amaterasu', 'senbon', 'kagutsuchi', 'arrows', 'indra']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    eiso:       { label: 'THIÊN ĐIỂU DUỆ THƯƠNG · CHIDORI EISŌ', rgb: '150,200,255', windup: .8, after: 1.3 },
    tejikara:   { label: 'THIÊN THỦ LỰC · AMENOTEJIKARA', rgb: '205,175,255', windup: .65, after: 1.3 },
    amaterasu:  { label: 'THIÊN CHIẾU · AMATERASU', rgb: '255,90,110', windup: .9, after: 1.5 },
    nagashi:    { label: 'THIÊN ĐIỂU LƯU · CHIDORI NAGASHI', rgb: '150,200,255', windup: .75, after: 1.4 },
    senbon:     { label: 'THIÊN ĐIỂU THIÊN BẢN · CHIDORI SENBON', rgb: '170,215,255', windup: .8, after: 1.3 },
    arrows:     { label: 'TU TÁ NĂNG HỒ · TIỄN VŨ', rgb: '205,165,255', windup: 1.05, after: 1.5 },
    kagutsuchi: { label: 'VIÊM ĐỘN · GIA CỤ THỔ MỆNH', rgb: '255,90,140', windup: .85, after: 1.5 },
    kirin:      { label: 'KỲ LÂN · KIRIN', rgb: '160,210,255', windup: 1.6, after: 2.0 },
    indra:      { label: 'NHÂN ĐÀ LA CHI THỈ · INDRA', rgb: '215,175,255', windup: 2.5, after: 3.0 },
    guard:      { label: 'TU TÁ NĂNG HỒ · SUSANOO' }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const EISO_LEN = 980, EISO_W = 40, BR_AT = 560, BR_LEN = 430, BR_ANG = .42;
  const NAG_R = 340, NAG_R2 = 560, NAG_OUT = .42;
  const AMA_R = 165, AMA_GAP = 250, AMA_DUR = 6.2;
  const KAGU_LEN = 800, KAGU_SPREAD = .2, KAGU_PATCH = 95, KAGU_DUR = 4.8;
  const SEN_R = 330, SEN_HIT = 50, SEN_FLY = .16;
  const ARR_LEN = 1080, ARR_SPREAD = .11;
  const KIRIN_R = 440, KIRIN_DIVE = .28, KIRIN_CLOUD = 215;
  const INDRA_LEN = 1250, INDRA_W = 92, INDRA_RISE = 1.0;
  const TEJI_R = 210, TEJI_GAP = 72, TEJI_SECOND = .8;
  const KAGU_ORDER = [2, 1, 3, 0, 4];
  const kaguLaunch = i => KAGU_ORDER.indexOf(i) * .05;
  const ARROW_ORDER = [3, 2, 4, 1, 5, 0, 6];
  const arrowRel = i => Math.abs(i - 3) * .035;

  // ------------------------------------------------------------------ palettes
  const BLUE = ['40,110,255', '120,190,255', '235,248,255'];
  const BLUE_HOT = ['70,140,255', '165,215,255', '250,253,255'];
  const PAL = ['120,24,220', '178,62,255', '232,196,255'];
  const PAL_HOT = ['170,40,240', '206,104,255', '246,226,255'];
  const inkB = a => `rgba(4,12,46,${(.8 * clamp01(a)).toFixed(3)})`;
  const inkV = a => `rgba(22,0,44,${(.78 * clamp01(a)).toFixed(3)})`;
  const INK_B = inkB(1), INK_V = inkV(1);
  const VIOLET_FLAME = [[1, '#3a0f6e'], [.84, '#6a24c0'], [.66, '#9450ff'], [.46, '#c79bff'], [.25, '#f4eaff']];
  const FLAME_BASE = 114 / 128;

  function pick() { return order[0]; }
  // Manual control (team mode): keys 1..8, Indra's Arrow (the ultimate) last. Chidori Senbon stays AI-only (max 8 keys).
  const KEYS = ['eiso', 'tejikara', 'amaterasu', 'nagashi', 'arrows', 'kagutsuchi', 'kirin', 'indra'];
  const moves = () => KEYS.map(k => ({ label: MOVES[k].label }));
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.sk || (z.sk = { t: 0, casts: 0, timer: 1.0, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], force: null, hold: 0, holdMove: '', guard: 0, guardVis: 0, reactCd: 3,
      hpMark: z.health, hpClock: 0, blinkCd: 1.5, spots: null, lastDraw: 0, dash: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = Math.random() * 99;
    if (st.fx.length >= 16) {
      let k = st.fx.findIndex(f => f.kind !== 'indra' && f.kind !== 'kirin');
      st.fx.splice(k < 0 ? 0 : k, 1);
    }
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });

  // ------------------------------------------------------------------ telegraphs
  // Line and circle telegraphs can follow him (origin = his feet, angle = st.aim + boff).
  function teleFor(z, st, move) {
    const tx = st.tx, ty = st.ty, a = st.aim;
    const C = (x, y, r, faint, small) => ({ k: 'c', x, y, r, faint, small });
    switch (move) {
      case 'eiso': return [{ k: 'line', follow: true, from: 0, boff: 0, len: EISO_LEN, w: EISO_W },
        { k: 'line', follow: true, from: BR_AT, boff: BR_ANG, len: BR_LEN, w: 30 },
        { k: 'line', follow: true, from: BR_AT, boff: -BR_ANG, len: BR_LEN, w: 30 },
        { k: 'c', follow: true, along: EISO_LEN, boff: 0, r: 120, faint: true }];
      case 'tejikara': return [C(tx, ty, TEJI_R)];
      case 'amaterasu': {
        const nx = -Math.sin(a), ny = Math.cos(a);
        st.spots = [{ x: tx, y: ty }, { x: tx + nx * AMA_GAP + Math.cos(a) * 90, y: ty + ny * AMA_GAP + Math.sin(a) * 90 },
          { x: tx - nx * AMA_GAP + Math.cos(a) * 90, y: ty - ny * AMA_GAP + Math.sin(a) * 90 }];
        return st.spots.map(s => C(s.x, s.y, AMA_R));
      }
      case 'nagashi': return [{ k: 'c', follow: true, r: NAG_R }, { k: 'ring', follow: true, r0: NAG_R, r1: NAG_R2 }];
      case 'senbon': {
        const spots = [{ x: tx, y: ty }], b = Math.random() * TAU;
        for (const [n, d] of [[6, 100], [9, 200], [9, 300]])
          for (let i = 0; i < n; i++) {
            const aa = b + (i + (d === 200 ? .5 : 0)) * TAU / n + rand(-.12, .12), dd = d + rand(-18, 18);
            spots.push({ x: tx + Math.cos(aa) * dd, y: ty + Math.sin(aa) * dd });
          }
        spots.forEach((s, i) => { s.t = .14 + i * .03 + Math.random() * .05; s.seed = Math.random() * 99; s.a = rand(-.4, .4); });
        st.spots = spots;
        return [C(tx, ty, SEN_R, true)].concat(spots.map(s => C(s.x, s.y, SEN_HIT, true, true)));
      }
      case 'arrows': {
        const out = [];
        for (let i = 0; i < 7; i++) out.push({ k: 'line', follow: true, from: 40, boff: (i - 3) * ARR_SPREAD, len: ARR_LEN, w: 26 });
        return out;
      }
      case 'kagutsuchi': {
        const out = [];
        for (let i = 0; i < 5; i++) {
          out.push({ k: 'line', follow: true, from: 20, boff: (i - 2) * KAGU_SPREAD, len: KAGU_LEN - 20, w: 30 });
          out.push({ k: 'c', follow: true, along: KAGU_LEN, boff: (i - 2) * KAGU_SPREAD, r: KAGU_PATCH, faint: true });
        }
        return out;
      }
      case 'kirin': return [C(tx, ty, KIRIN_R), C(tx, ty, KIRIN_R * .5, true)];
      case 'indra': return [{ k: 'line', follow: true, from: 60, boff: 0, len: INDRA_LEN, w: INDRA_W, big: true }];
    }
    return [];
  }

  // Ranged jutsu are cast from a distance: if he is in the target's face, he flickers out first.
  // Indra's Arrow is fired from below the target so the whole Perfect Susanoo stands in view.
  const RANGED = { eiso: 1, amaterasu: 1, senbon: 1, arrows: 1, kagutsuchi: 1, kirin: 1, indra: 1, tejikara: 1 };
  function announce(z, st, m, api) {
    let move = st.force;
    if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = MOVES[move], p = api.player;
    // Under the player's control he casts from where he stands (no repositioning flicker).
    if (p && RANGED[move] && !z.manual) {
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (move === 'indra') { const side = z.x < p.x ? -1 : 1; flicker(z, st, api, 390, Math.atan2(210, 330 * side)); }
      else if (d < 300) flicker(z, st, api, move === 'tejikara' ? 460 : 400, null);
    }
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.tele = teleFor(z, st, move);
  }

  // ------------------------------------------------------------------ casting
  // Amenotejikara: swap places with a boulder on the far side of (cx, cy) and cut through it.
  function hop(z, st, api, cx, cy) {
    const base = Math.atan2(cy - z.y, cx - z.x);
    for (const off of [0, .8, -.8, 1.6, -1.6, Math.PI]) {
      const b = base + off, x = cx + Math.cos(b) * TEJI_GAP, y = cy + Math.sin(b) * TEJI_GAP;
      if (api.blocked(x, y, z.r || 14)) continue;
      addFx(st, { kind: 'swap', x1: z.x, y1: z.y, x2: x, y2: y, f1: Math.cos(base) >= 0 ? 1 : -1, dur: 1.0 });
      z.x = x; z.y = y; z.angle = Math.atan2(cy - y, cx - x);
      return true;
    }
    return false;
  }
  function cutAt(z, st, api, cx, cy, D) {
    const a = Math.atan2(cy - z.y, cx - z.x);
    api.strike(cx, cy, TEJI_R, D * 2.0, null, 'blade', true);
    addFx(st, { kind: 'slash', x: z.x, y: z.y, a, R: 180, dur: .55, side: st.dash = -(st.dash || 1) });
    z.kageDash = .26;
    api.shake(11);
  }

  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
    switch (move) {
      case 'eiso': {
        const x = z.x, y = z.y, ex = x + ca * EISO_LEN, ey = y + sa * EISO_LEN;
        api.line(x, y, ex, ey, EISO_W, D * 2.4, 'lightning');
        api.world(ex, ey, 130, D * 2.6, 'lightning', a);
        const bx = x + ca * BR_AT, by = y + sa * BR_AT;
        later(st, .08, api => {
          for (const s of [-1, 1]) {
            const b = a + s * BR_ANG, x2 = bx + Math.cos(b) * BR_LEN, y2 = by + Math.sin(b) * BR_LEN;
            api.line(bx, by, x2, y2, 30, D * 1.6, null);
            api.world(x2, y2, 85, D * 1.8, 'lightning', b);
          }
          api.shake(9);
        });
        addFx(st, { kind: 'eiso', x, y, a, dur: 1.15 });
        api.burst(x, y - 30, '#bfe0ff', 12);
        api.shake(13);
        break;
      }
      case 'tejikara': {
        const cx = st.tx, cy = st.ty;
        st.hold = TEJI_SECOND + .45; st.holdMove = 'tejikara';
        hop(z, st, api, cx, cy);
        later(st, .1, api => cutAt(z, st, api, cx, cy, D));
        later(st, .16, api => {
          const p = api.player, mx = p ? p.x : cx, my = p ? p.y : cy;
          addFx(st, { kind: 'mark', x: mx, y: my, r: TEJI_R, dur: TEJI_SECOND - .16 });
          later(st, TEJI_SECOND - .16, api => {
            hop(z, st, api, mx, my);
            later(st, .1, api => cutAt(z, st, api, mx, my, D));
          });
        });
        break;
      }
      case 'amaterasu': {
        const spots = (st.spots || []).map((s, j) => {
          const fl = [];
          for (let i = 0; i < 26; i++) {
            const aa = hash(j * 31 + i * 7.7) * TAU, d = Math.sqrt(hash(j * 13 + i * 1.37)) * .92;
            fl.push({ dx: Math.cos(aa) * d, dy: Math.sin(aa) * d * .5, d, h: hash(i * 5.3 + j), i });
          }
          fl.sort((p, q) => p.dy - q.dy);
          return { x: s.x, y: s.y, fl, t: j * .08 };
        });
        spots.forEach(s => later(st, s.t, api => { api.strike(s.x, s.y, AMA_R, D * 1.4, null, 'fire', true); api.shake(8); }));
        addFx(st, { kind: 'ama', spots, r: AMA_R, dur: AMA_DUR, nt: .6, dmg: D, upd: amaUpd });
        st.spots = null;
        break;
      }
      case 'nagashi': {
        const x = z.x, y = z.y;
        api.strike(x, y, NAG_R, D * 2.2, null, 'lightning', true);
        addFx(st, { kind: 'nagashi', x, y, R: NAG_R, R2: NAG_R2, dur: 1.5 });
        later(st, NAG_OUT, api => {
          const rr = (NAG_R + NAG_R2) / 2, w = (NAG_R2 - NAG_R) / 2 + 26;
          for (let i = 0; i < 12; i++) { const b = i * TAU / 12; api.strike(x + Math.cos(b) * rr, y + Math.sin(b) * rr, w, D * 1.4, null, i % 4 === 0 ? 'lightning' : null, true); }
          api.shake(10);
        });
        api.burst(x, y - 30, '#cfe6ff', 18);
        api.shake(15);
        break;
      }
      case 'senbon': {
        const spots = st.spots || [];
        let last = 0;
        spots.forEach((s, i) => {
          last = Math.max(last, s.t);
          later(st, s.t, api => { api.strike(s.x, s.y, SEN_HIT, D * 1.0, null, i % 9 === 0 ? 'lightning' : null, true); if (i % 5 === 0) api.shake(5); });
        });
        addFx(st, { kind: 'senbon', hx: z.x, hy: z.y, spots, last, dur: last + 1.0 });
        st.spots = null;
        break;
      }
      case 'arrows': {
        const x = z.x, y = z.y;
        for (const i of ARROW_ORDER) {
          const b = a + (i - 3) * ARR_SPREAD, cb = Math.cos(b), sb = Math.sin(b);
          later(st, arrowRel(i) + .1, api => {
            api.line(x + cb * 40, y + sb * 40, x + cb * ARR_LEN, y + sb * ARR_LEN, 26, D * 1.7, i === 3 ? 'lightning' : null);
            if (i === 3) api.world(x + cb * ARR_LEN, y + sb * ARR_LEN, 110, D * 2.2, 'lightning', b);
            if (i % 2) api.shake(6);
          });
        }
        addFx(st, { kind: 'arrows', x, y, a, dur: 1.7 });
        break;
      }
      case 'kagutsuchi': {
        const x = z.x, y = z.y, ends = [];
        for (let i = 0; i < 5; i++) {
          const b = a + (i - 2) * KAGU_SPREAD, cb = Math.cos(b), sb = Math.sin(b), t0 = kaguLaunch(i);
          const ex = x + cb * KAGU_LEN, ey = y + sb * KAGU_LEN;
          ends.push({ x: ex, y: ey, t: t0 + .3, i });
          later(st, t0 + .15, api => api.line(x + cb * 20, y + sb * 20, ex, ey, 30, D * 1.5, i === 2 ? 'fire' : null));
          later(st, t0 + .3, api => { api.strike(ex, ey, KAGU_PATCH, D * .8, null, i % 2 ? null : 'fire', true); api.shake(6); });
        }
        addFx(st, { kind: 'kagu', x, y, a, ends, dur: KAGU_DUR, nt: .8, dmg: D, upd: kaguUpd });
        break;
      }
      case 'kirin': {
        const tx = st.tx, ty = st.ty;
        addFx(st, { kind: 'kirin', x: tx, y: ty, r: KIRIN_R, side: z.x < tx ? 1 : -1, dur: 2.8 });
        st.hold = KIRIN_DIVE + .3; st.holdMove = 'kirin';
        later(st, KIRIN_DIVE, api => {
          api.strike(tx, ty, KIRIN_R, D * 4.0, '#d8ecff', 'lightning');
          api.world(tx, ty, 300, D * 4, 'crater');
          for (let i = 0; i < 4; i++) { const b = i * TAU / 4 + .6; api.world(tx + Math.cos(b) * 330, ty + Math.sin(b) * 330, 140, D * 2.6, 'lightning', b); }
          api.burst(tx, ty - 40, '#e6f4ff', 30);
          api.shake(28);
        });
        later(st, KIRIN_DIVE + .45, api => api.strike(tx, ty, KIRIN_R * .9, D * .8, null, null, true));
        break;
      }
      case 'indra': {
        const x = z.x, y = z.y, x1 = x + ca * 60, y1 = y + sa * 60, x2 = x + ca * (60 + INDRA_LEN), y2 = y + sa * (60 + INDRA_LEN);
        addFx(st, { kind: 'indra', x, y, a, len: INDRA_LEN, dur: 2.6 });
        st.hold = .9; st.holdMove = 'indra';
        later(st, .05, api => {
          api.line(x1, y1, x2, y2, INDRA_W, D * 5.2, 'crater');
          for (const [t, r] of [[.3, 150], [.65, 180], [1, 240]]) api.world(x + ca * (60 + INDRA_LEN * t), y + sa * (60 + INDRA_LEN * t), r, D * 4.4, 'crater', a);
          api.shake(32);
        });
        for (const t of [.4, .75]) later(st, t, api => api.line(x1, y1, x2, y2, INDRA_W, D * .6, null));
        break;
      }
    }
  }

  function amaUpd(fx, dt, api) {
    // Amaterasu's black flames don't go out: they keep burning whoever stands in them.
    if (fx.age < fx.nt || fx.age > fx.dur - .7) return;
    fx.nt += .45;
    for (const s of fx.spots) api.strike(s.x, s.y, fx.r * .9, fx.dmg * .32, null, null, true);
  }
  function kaguUpd(fx, dt, api) {
    if (fx.age < fx.nt || fx.age > fx.dur - .6) return;
    fx.nt += .5;
    for (const e of fx.ends) api.strike(e.x, e.y, KAGU_PATCH * .85, fx.dmg * .28, null, null, true);
  }

  // Body flicker: he never chases for long; he appears at fighting distance in a crackle of lightning.
  function flicker(z, st, api, dist = 380, pref = null) {
    const p = api.player;
    if (!p) return;
    const base = pref != null ? pref : Math.atan2(z.y - p.y, z.x - p.x);
    for (const off of [0, .6, -.6, 1.2, -1.2, 2, -2]) {
      const b = base + off, x = p.x + Math.cos(b) * dist, y = p.y + Math.sin(b) * dist;
      if (Math.abs(x - z.x) + Math.abs(y - z.y) < 40) return;
      if (api.blocked(x, y, z.r || 14)) continue;
      addFx(st, { kind: 'blink', x1: z.x, y1: z.y, x2: x, y2: y, dur: .45 });
      z.x = x; z.y = y;
      return;
    }
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
    st.guardVis = st.guard > 0 ? Math.min(1, st.guardVis + dt * 5) : Math.max(0, st.guardVis - dt * 2.5);
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.guard = 0; st.hold = 0; z.manualBusy = false; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.rec = Math.max(0, (st.rec || 0) - dt);
    st.reactCd -= dt; st.blinkCd -= dt;
    z.kageDash = Math.max(0, (z.kageDash || 0) - dt);

    // Susanoo ribcage: raised for a moment when he takes a beating; blows glance off the bones.
    if (st.guard > 0) st.guard = Math.max(0, st.guard - dt);
    z.armorScale = (m.armor || 1) * (st.guard > 0 ? .3 : 1);
    st.hpClock += dt;
    if (st.hpClock > 1.5) { st.hpClock = 0; st.hpMark = z.health; }
    if (!z.manual && st.reactCd <= 0 && st.hpMark - z.health > z.maxHealth * .05) { st.reactCd = 12; st.hpMark = z.health; st.guard = 2.8; }

    const p = api.player;
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      // Indra's Arrow follows the target while the string is drawn, then locks.
      if (st.move === 'indra' && st.windup > .55 && p) st.aim = turn(st.aim, aimAt(z, p), dt * 1.1);
      if (st.move === 'arrows' && st.windup > .5 && p) st.aim = turn(st.aim, aimAt(z, p), dt * 1.4);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.rec = .4;
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = '';
        st.tele = [];
      }
    } else if (st.hold <= 0 && z.manual) {
      // Driven by the player: only the requested jutsu; no rotation, no blink, no Susanoo reflex.
      st.holdMove = '';
      if (z.manualCast != null && st.rec <= 0) {
        const k = KEYS[z.manualCast]; z.manualCast = null;
        if (k) { st.force = k; announce(z, st, m, api); }
      }
    } else if (st.hold <= 0) {
      st.holdMove = '';
      st.timer -= dt;
      const d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
      if (p && d > 720 && d < 1600 && st.blinkCd <= 0) { flicker(z, st, api); st.blinkCd = 2.4; }
      else if (st.timer <= 0 && p && d < 900) announce(z, st, m, api);
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold > 0 && st.holdMove !== 'tejikara' ? st.hold : 0;
    // He plants his feet for the Susanoo jutsu and Kirin.
    const planted = (st.windup > 0 && (st.move === 'indra' || st.move === 'arrows' || st.move === 'kirin')) || (st.hold > 0 && st.holdMove === 'indra');
    z.speedScale = planted ? .02 : 1.05;
    z.manualBusy = st.windup > 0 || st.hold > 0 || st.rec > 0;
  }

  // ------------------------------------------------------------------ cached art
  // Amaterasu's black fire (VFXKit.flame layout: base at y = 114 of 128): wavy tongues with a
  // crimson-violet rim and a pitch-black body. Six variants swapped for flicker.
  function amaFlame(v) {
    v = ((v % 6) + 6) % 6;
    return Kit().sprite('skb-ama:' + v, 64, 128, g => {
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
      const sd = v * 1.7 + .3, lean = (hash(v + 9) - .5) * 1.2;
      const set = grow => {
        tongue(32, 17, 104, lean, sd, grow);
        tongue(17, 10, 62 + hash(v) * 18, -.6, sd + 2, grow);
        tongue(48, 10, 70 + hash(v + 3) * 18, .7, sd + 4, grow);
        tongue(26, 7, 84, lean - .5, sd + 6, grow);
        tongue(40, 6, 52, lean + .6, sd + 8, grow);
      };
      g.fillStyle = 'rgba(130,20,70,.92)'; set(2.8);
      g.fillStyle = '#1a0412'; set(1.2);
      g.fillStyle = '#000000'; set(0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(80,20,100,.3)';
      g.beginPath(); g.ellipse(32, 108, 7, 14, 0, 0, TAU); g.fill();
    });
  }

  function boneStroke(g, w, a = 1) {
    g.strokeStyle = `rgba(28,4,62,${.75 * a})`; g.lineWidth = w + 2.4; g.stroke();
    g.strokeStyle = `rgba(140,70,250,${.85 * a})`; g.lineWidth = w; g.stroke();
    g.strokeStyle = `rgba(238,220,255,${.95 * a})`; g.lineWidth = Math.max(1, w * .28); g.stroke();
  }
  // Susanoo ribcage around him: back half (behind) and front half (over him). 2× into 280×300, feet at (140, 290).
  function ribSprite(front) {
    return Kit().sprite('skb-ribs-' + (front ? 'f' : 'b'), 280, 300, g => {
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
        g.beginPath(); g.moveTo(-54, -110); g.lineTo(-64, -72); g.lineTo(-52, -40); boneStroke(g, 4);
        g.beginPath(); g.arc(-52, -38, 4.4, 0, TAU); boneStroke(g, 2.4);
        g.beginPath(); g.moveTo(54, -110); g.lineTo(66, -76); g.lineTo(58, -46); boneStroke(g, 4);
      }
    });
  }

  // Perfect Susanoo: winged, armoured violet warrior with a crested demon helm and a tengu nose.
  // Faces right; 680×520 canvas, feet at (340, 505). Painted once.
  const PS_W = 680, PS_H = 520, PS_OX = 340, PS_OY = 505, PS_SCALE = .8;
  function psSprite() {
    return Kit().sprite('skb-perfect', PS_W, PS_H, g => {
      g.translate(PS_OX, PS_OY); g.lineJoin = 'round'; g.lineCap = 'round';
      const shape = (build, fill, w = 1) => {
        build(); g.fillStyle = fill; g.fill();
        g.strokeStyle = 'rgba(22,2,50,.92)'; g.lineWidth = 3.4 * w; g.stroke();
        g.strokeStyle = 'rgba(238,222,255,.95)'; g.lineWidth = 1.2 * w; g.stroke();
      };
      const vgrad = (y0, y1, c0, c1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
      const line = (pts, w, c) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.strokeStyle = c; g.lineWidth = w; g.stroke(); };
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
      shape(() => {
        g.beginPath(); g.moveTo(-30, -392); g.quadraticCurveTo(-84, -320, -70, -190); g.lineTo(-48, -214); g.lineTo(-40, -150);
        g.lineTo(-14, -176); g.lineTo(0, -128); g.lineTo(14, -176); g.lineTo(40, -150); g.lineTo(48, -214); g.lineTo(70, -190);
        g.quadraticCurveTo(84, -320, 30, -392); g.closePath();
      }, 'rgba(52,14,116,.7)');
      for (let i = -2; i <= 2; i++) {
        const x0 = i * 34, w = 22 - Math.abs(i) * 1.5;
        for (let r = 0; r < 3; r++) {
          const y = -150 + r * 34;
          shape(() => {
            g.beginPath(); g.moveTo(x0 - w, y); g.lineTo(x0 + w, y); g.lineTo(x0 + w * 1.08 + i * 3, y + 36); g.quadraticCurveTo(x0 + i * 4, y + 42, x0 - w * 1.08 + i * 3, y + 36); g.closePath();
          }, vgrad(y, y + 36, 'rgba(150,92,250,.66)', 'rgba(82,30,170,.6)'), .8);
        }
      }
      shape(() => {
        g.beginPath();
        g.moveTo(-24, -332); g.quadraticCurveTo(-80, -330, -108, -298); g.lineTo(-88, -250); g.quadraticCurveTo(-84, -196, -62, -160);
        g.lineTo(62, -160); g.quadraticCurveTo(84, -196, 88, -250); g.lineTo(108, -298); g.quadraticCurveTo(80, -330, 24, -332); g.closePath();
      }, vgrad(-332, -160, 'rgba(146,88,246,.72)', 'rgba(74,24,164,.66)'), 1.1);
      for (const side of [-1, 1]) shape(() => {
        g.beginPath(); g.moveTo(side * 6, -304); g.quadraticCurveTo(side * 66, -304, side * 74, -252); g.quadraticCurveTo(side * 44, -232, side * 6, -238); g.closePath();
      }, 'rgba(176,128,255,.6)', .8);
      for (let i = 0; i < 3; i++) shape(() => {
        const y = -226 + i * 21, w = 56 - i * 5;
        g.beginPath(); g.moveTo(-w, y); g.quadraticCurveTo(0, y - 6, w, y); g.lineTo(w - 4, y + 16); g.quadraticCurveTo(0, y + 10, -w + 4, y + 16); g.closePath();
      }, 'rgba(120,62,226,.6)', .7);
      line([[0, -326], [0, -164]], 2, 'rgba(240,226,255,.8)');
      shape(() => { g.beginPath(); g.moveTo(-66, -166); g.quadraticCurveTo(0, -152, 66, -166); g.lineTo(64, -148); g.quadraticCurveTo(0, -134, -64, -148); g.closePath(); }, 'rgba(58,16,128,.85)', .8);
      shape(() => { g.beginPath(); g.ellipse(18, -150, 11, 8, 0, 0, TAU); }, 'rgba(150,96,250,.8)', .7);
      shape(() => { g.beginPath(); g.ellipse(0, -330, 40, 13, 0, 0, TAU); }, 'rgba(96,40,196,.8)', .9);
      for (const side of [-1, 1]) for (let p = 2; p >= 0; p--) {
        shape(() => {
          const cx = side * (108 + p * 7), cy = -300 + p * 18;
          g.beginPath(); g.moveTo(cx - side * 44, cy - 8); g.quadraticCurveTo(cx, cy - 34, cx + side * 46, cy - 2);
          g.quadraticCurveTo(cx + side * 40, cy + 16, cx + side * 8, cy + 18); g.quadraticCurveTo(cx - side * 30, cy + 14, cx - side * 44, cy - 8); g.closePath();
        }, p ? 'rgba(112,52,218,.72)' : vgrad(-334, -280, 'rgba(196,150,255,.8)', 'rgba(120,60,226,.75)'));
      }
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
      shape(() => { g.beginPath(); g.moveTo(-30, -378); g.lineTo(0, -368); g.lineTo(30, -378); g.lineTo(28, -370); g.lineTo(0, -360); g.lineTo(-28, -370); g.closePath(); }, 'rgba(60,16,130,.9)', .7);
      g.fillStyle = 'rgba(12,0,34,.95)';
      for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * 6, -364); g.lineTo(side * 24, -370); g.lineTo(side * 22, -360); g.lineTo(side * 8, -357); g.closePath(); g.fill(); }
      shape(() => { g.beginPath(); g.moveTo(4, -360); g.quadraticCurveTo(36, -356, 68, -340); g.lineTo(8, -344); g.closePath(); }, 'rgba(160,110,255,.85)', .8);
      shape(() => { g.beginPath(); g.moveTo(-20, -342); g.lineTo(20, -342); g.lineTo(14, -328); g.lineTo(-14, -328); g.closePath(); }, 'rgba(40,8,90,.92)', .7);
      g.fillStyle = 'rgba(244,234,255,.95)';
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 5 - 2, -342); g.lineTo(i * 5 + 2, -342); g.lineTo(i * 5, -335 + Math.abs(i) * .8); g.closePath(); g.fill(); }
    });
  }

  // The boulder Amenotejikara swaps into the spot he left.
  function rockSpr() {
    return Kit().sprite('skb-rock', 96, 80, g => {
      const path = () => { g.beginPath(); g.moveTo(10, 70); g.lineTo(6, 44); g.lineTo(20, 18); g.lineTo(46, 8); g.lineTo(74, 16); g.lineTo(90, 42); g.lineTo(86, 70); g.closePath(); };
      path(); g.fillStyle = '#7a6a5a'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#9a8a76'; g.beginPath(); g.moveTo(20, 18); g.lineTo(46, 8); g.lineTo(74, 16); g.lineTo(60, 34); g.lineTo(30, 36); g.closePath(); g.fill();
      g.fillStyle = 'rgba(30,22,18,.45)'; g.fillRect(50, 34, 50, 40);
      g.strokeStyle = 'rgba(30,20,16,.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(30, 36); g.lineTo(26, 70); g.moveTo(60, 34); g.lineTo(66, 52); g.lineTo(58, 70); g.stroke();
      g.restore();
      path(); g.strokeStyle = '#1c1612'; g.lineWidth = 3.5; g.lineJoin = 'round'; g.stroke();
    });
  }

  // Kirin's head, facing +x (local units).
  function kirinHead(ctx) {
    ctx.beginPath();
    ctx.moveTo(-26, -8);
    ctx.lineTo(-74, -64); ctx.lineTo(-18, -30);
    ctx.lineTo(-40, -86); ctx.lineTo(6, -32);
    ctx.lineTo(44, -30); ctx.lineTo(96, -20); ctx.lineTo(122, -10);
    ctx.lineTo(126, -2); ctx.lineTo(84, 0);
    ctx.lineTo(62, 6);
    ctx.lineTo(118, 22); ctx.lineTo(112, 32); ctx.lineTo(56, 26);
    ctx.lineTo(0, 30); ctx.lineTo(-56, 40); ctx.lineTo(-30, 16);
    ctx.lineTo(-84, 14); ctx.lineTo(-34, 0); ctx.closePath();
  }

  // ------------------------------------------------------------------ primitives
  function ring(ctx, x, y, r, w, color, squash = .5) {
    if (!(r > 1)) return;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * squash, 0, 0, TAU); ctx.stroke();
  }
  // Ground ring: dark under-stroke, bright line (blue Chidori or violet chakra).
  function inkRing(ctx, x, y, r, a, w = 3, violet) {
    if (!(a > .01)) return;
    ring(ctx, x, y, r, w + 5, violet ? `rgba(24,4,52,${.55 * a})` : `rgba(4,14,52,${.55 * a})`);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ring(ctx, x, y, r, w, violet ? `rgba(200,150,255,${.9 * a})` : `rgba(150,205,255,${.9 * a})`);
    ctx.globalCompositeOperation = op;
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
  // Radial lightning flattened onto the ground.
  function groundRays(ctx, x, y, n, r0, r1, time, seed, alpha, width = 1.5, violet) {
    const k = Kit();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(seed + i) * .5 + (k.wobble(seed + i, time, 2) - .5) * .4;
      const c = Math.cos(a), s = Math.sin(a) * .5;
      k.forkedBolt(ctx, x + c * r0, y + s * r0, x + c * r1, y + s * r1, seed + i * 9, time,
        { jitter: 10 + r1 * .03, alpha, width, pal: violet ? PAL : BLUE, base: violet ? inkV(alpha) : inkB(alpha), step: Math.max(18, (r1 - r0) / 12),
          forks: 1, forkLen: 18 + r1 * .05, rate: 22, snap: true });
    }
  }
  function crescent(ctx, x, y, r, a0, a1, thick, color) {
    const mid = (a0 + a1) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.quadraticCurveTo(x + Math.cos(mid) * (r - thick * 2), y + Math.sin(mid) * (r - thick * 2), x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    ctx.fill();
  }
  // Tapered lightning spear (shaft narrowing to a barbed point).
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
  function lightningSpear(ctx, hx, hy, tx, ty, w, a, seed, time, big, violet) {
    if (!(a > .01)) return;
    const k = Kit(), hot = violet ? PAL_HOT : BLUE_HOT, cool = violet ? PAL : BLUE;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = violet ? inkV(a) : inkB(a); spearPath(ctx, hx, hy, tx, ty, w + 6); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = violet ? `rgba(140,50,250,${.8 * a})` : `rgba(50,120,255,${.8 * a})`; spearPath(ctx, hx, hy, tx, ty, w); ctx.fill();
    ctx.fillStyle = violet ? `rgba(214,170,255,${.8 * a})` : `rgba(170,215,255,${.85 * a})`; spearPath(ctx, hx, hy, tx, ty, w * .5); ctx.fill();
    ctx.fillStyle = `rgba(255,252,255,${.95 * a})`; spearPath(ctx, hx, hy, tx, ty, w * .18); ctx.fill();
    k.forkedBolt(ctx, hx, hy, tx, ty, seed, time, { jitter: w * .9 + 6, alpha: a, width: big ? 2.6 : 1.8, pal: hot, base: violet ? INK_V : INK_B, forkBase: true,
      forks: big ? 9 : 5, forkLen: big ? 70 : 40, step: big ? 40 : 30, rate: 24, snap: true });
    if (big) k.forkedBolt(ctx, hx, hy, tx, ty, seed + 9, time, { jitter: w * 1.5 + 10, alpha: .6 * a, width: 1.1, pal: cool, forks: 3, forkLen: 30, step: 34, rate: 18, snap: true });
  }
  // Radial ground cracks (ground perspective).
  function cracks(ctx, x, y, r, n, seed, alpha, w = 2.5) {
    if (alpha <= .01 || r < 4) return;
    ctx.strokeStyle = `rgba(22,16,26,${.7 * alpha})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 4.7 + seed) * .5, l = r * (.55 + hash(i * 9.1 + seed) * .45);
      ctx.moveTo(x + Math.cos(a) * r * .12, y + Math.sin(a) * r * .06);
      for (let k = 1; k <= 4; k++) {
        const b = a + (hash(i * 3 + k * 1.7 + seed) - .5) * .5, d = l * k / 4;
        const nx = x + Math.cos(b) * d, ny = y + Math.sin(b) * d * .5;
        ctx.lineTo(nx, ny);
        if (k === 2) { const c = a + (hash(i + seed) > .5 ? .7 : -.7); ctx.lineTo(nx + Math.cos(c) * l * .22, ny + Math.sin(c) * l * .11); ctx.moveTo(nx, ny); }
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
  // Black fire cluster (Amaterasu patch) with flicker, base on the ground.
  function blackFire(ctx, x, y, r, list, hk, time, tick, alpha) {
    if (!(hk > .02) || !(alpha > .01)) return;
    ctx.globalAlpha = .96 * alpha;
    for (const s of list) {
      const h = (44 + s.h * 72) * hk * (1 - s.d * .35) * (.86 + .14 * Math.sin(time * 9 + s.i * 1.7));
      if (h < 6) continue;
      ctx.drawImage(amaFlame(s.i + tick), x + s.dx * r - h * .36, y + s.dy * r - h * FLAME_BASE, h * .72, h);
    }
    ctx.globalAlpha = 1;
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
      ctx.lineWidth = 2;
      ctx.beginPath();
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
  function markLine(ctx, x, y, a, len, w, rgb, k, time, big) {
    const pulse = pulseOf(time);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = `rgba(14,12,34,${big ? .2 : .14})`; ctx.fillRect(0, -w, len, w * 2);
    ctx.fillStyle = `rgba(${rgb},${.12 + .16 * k})`; ctx.fillRect(0, -w, len * k, w * 2);
    ctx.strokeStyle = 'rgba(14,12,44,.4)'; ctx.lineWidth = big ? 6 : 4.5; ctx.strokeRect(0, -w, len, w * 2);
    ctx.lineWidth = big ? 3 : 2.2; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -w, len, w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    const sp = big ? 150 : 120;
    for (let d = 60 + (time * (big ? 420 : 260)) % sp; d < len - 20; d += sp) { ctx.moveTo(d - 16, -w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  function drawTele(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
    for (const s of st.tele) {
      if (s.k === 'c') {
        let x = s.x, y = s.y;
        if (s.follow) { const b = st.aim + (s.boff || 0), d = s.along || 0; x = z.x + Math.cos(b) * d; y = z.y + Math.sin(b) * d; }
        markCircle(ctx, x, y, s.r, rgb, k, time, s.faint, s.small);
      } else if (s.k === 'ring') markRing(ctx, z.x, z.y, s.r0, s.r1, rgb, k, time);
      else if (s.k === 'line') {
        const b0 = st.aim, b = b0 + (s.boff || 0), ox = z.x + Math.cos(b0) * (s.from || 0), oy = z.y + Math.sin(b0) * (s.from || 0);
        markLine(ctx, ox, oy, b, s.len, s.w, rgb, k, time, s.big);
      }
    }
  }

  // ------------------------------------------------------------------ Chidori Eisō
  function eisoPts(fx) {
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), bx = fx.x + ca * BR_AT, by = fx.y + sa * BR_AT;
    return { ca, sa, ex: fx.x + ca * EISO_LEN, ey: fx.y + sa * EISO_LEN, bx, by };
  }
  function eisoG(ctx, fx, time) {
    const K = Kit(), t = fx.age, f = 1 - win(t, .4, fx.dur), P = eisoPts(fx);
    ctx.lineCap = 'round';
    const scorch = (x1, y1, x2, y2, w) => {
      ctx.strokeStyle = `rgba(10,16,40,${.4 * f})`; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    scorch(fx.x, fx.y, P.ex, P.ey, 36);
    const bk = win(t, .07, .16);
    for (const s of [-1, 1]) { const b = fx.a + s * BR_ANG; scorch(P.bx, P.by, P.bx + Math.cos(b) * BR_LEN * bk, P.by + Math.sin(b) * BR_LEN * bk, 24); }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(60,140,255,${.45 * f})`; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(P.ex, P.ey); ctx.stroke();
    K.glow(ctx, P.ex, P.ey, 150 * easeOut(t * 4), '80,150,255', .6 * f, false, .5);
    ctx.globalCompositeOperation = 'source-over';
    inkRing(ctx, P.ex, P.ey, 30 + 120 * easeOut(t * 3), f, 3);
    if (t > .05) inkRing(ctx, P.ex, P.ey, 20 + 200 * easeOut((t - .05) * 2.2), f * .6, 2);
    cracks(ctx, P.ex, P.ey, 140 * easeOut(t * 5), 9, fx.seed, f, 2.6);
    for (const s of [-1, 1]) {
      const b = fx.a + s * BR_ANG, x = P.bx + Math.cos(b) * BR_LEN, y = P.by + Math.sin(b) * BR_LEN;
      if (t > .16) { inkRing(ctx, x, y, 20 + 80 * easeOut((t - .16) * 3), f, 2.5); cracks(ctx, x, y, 90, 7, fx.seed + s * 9, f, 2); }
    }
  }
  function eisoO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), t = fx.age, P = eisoPts(fx), f = 1 - win(t, .38, .75), seed = fx.seed * 7.3;
    const hx = fx.x + P.ca * 18, hy = fx.y - L + P.sa * 8;
    ctx.save();
    if (f > 0) {
      const ext = easeOut(t / .09), reach = 18 + EISO_LEN * ext, tx = fx.x + P.ca * reach, ty = fx.y + P.sa * reach - L * .8;
      lightningSpear(ctx, hx, hy, tx, ty, 18 * f + 4, f, seed, time, true);
      // Branches splitting off the shaft (the spear forks like lightning).
      const bk = easeOut(win(t, .06, .14)), bxL = P.bx, byL = P.by - L * .8;
      if (bk > 0) for (const s of [-1, 1]) {
        const b = fx.a + s * BR_ANG, x2 = bxL + Math.cos(b) * BR_LEN * bk, y2 = byL + Math.sin(b) * BR_LEN * bk;
        lightningSpear(ctx, bxL, byL, x2, y2, 11 * f + 3, f, seed + s * 5, time, false);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x2, y2, 60, '150,200,255', f, true);
        chirps(ctx, x2, y2, 6, 22, 12, time, seed + s, f);
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx, hy, 50, '120,180,255', .9 * f, true);
      K.glow(ctx, tx, ty, 70 + 60 * (1 - ext), '170,220,255', f, true);
      chirps(ctx, tx, ty, 9, 28, 15, time, seed, f);
      chirps(ctx, hx, hy, 7, 18, 10, time, seed + 3, f);
    }
    // Impact at the far end: white flash, the column of light, debris.
    if (t < .45) {
      const q = t / .45;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, P.ex, P.ey - 20, 220 * (.4 + q), '200,230,255', (1 - q) * .9, true, .7);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (t < 1) K.fx.debris(ctx, P.ex, P.ey, 140, t, fx.seed, '#1c2236', 14);
    ctx.restore();
  }

  // ------------------------------------------------------------------ Chidori Nagashi
  function nagashiG(ctx, fx, time) {
    const K = Kit(), t = fx.age, f = 1 - win(t, .7, fx.dur), e = easeOut(t / .22), R0 = fx.R * (.15 + .85 * e);
    K.glow(ctx, fx.x, fx.y, fx.R * 1.15, '10,30,80', .4 * f, false, .5);
    ctx.fillStyle = `rgba(6,14,40,${.24 * f})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R0 * .7, R0 * .35, 0, 0, TAU); ctx.fill();
    cracks(ctx, fx.x, fx.y, fx.R * e, 14, fx.seed, f, 2.4);
    inkRing(ctx, fx.x, fx.y, R0, f, 4);
    if (t < .9) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.1, t / .9, 1 - t / .9, '120,180,255');
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, R0 * 1.05, '60,130,255', .3 * f, false, .5);
    if (t < .7) groundRays(ctx, fx.x, fx.y, 13, 20, R0 * .98, time, fx.seed * 3, f * (1 - win(t, .4, .7)), 1.8);
    ctx.globalCompositeOperation = 'source-over';
    // The second discharge: a crackling ring racing outward to the outer edge.
    const u = t - NAG_OUT;
    if (u > -.08) {
      const q = easeOut((u + .08) / .25), rr = fx.R + (fx.R2 - fx.R) * q, g = 1 - win(u, .25, 1.0);
      inkRing(ctx, fx.x, fx.y, rr, g, 5);
      inkRing(ctx, fx.x, fx.y, rr * .92, g * .6, 2.5);
      if (g > 0) {
        ctx.globalCompositeOperation = 'lighter';
        groundRays(ctx, fx.x, fx.y, 16, rr - 90, rr + 20, time, fx.seed * 5, g, 1.6);
        ctx.globalCompositeOperation = 'source-over';
      }
      dustRing(ctx, fx.x, fx.y, rr, 18, 18 + u * 30, .6 * g, fx.seed, 6 + u * 20);
    }
  }
  function nagashiO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), t = fx.age, f = 1 - win(t, .35, .9), seed = fx.seed * 3.7;
    const cx = z ? z.x : fx.x, cy = (z ? z.y : fx.y) - L;
    if (f <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (t < .2) K.glow(ctx, cx, cy, 120 + 900 * t, '220,240,255', 1 - t / .2, true);
    K.glow(ctx, cx, cy, 150, '60,130,255', .5 * f, false, .85);
    // Current pouring out of his whole body: arcs whipping up and out.
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * .5 + (Kit().wobble(seed + i * 3, time, 6) - .5) * .5;
      const l = (80 + hash(seed + i) * 70) * (.6 + .4 * f);
      K.forkedBolt(ctx, cx, cy + 6, cx + Math.cos(a) * l * 1.3, cy + Math.sin(a) * l * .9, seed + i * 17, time,
        { jitter: 16, alpha: f, width: 1.7, pal: BLUE_HOT, base: inkB(f), forkBase: true, step: 12, forks: 2, forkLen: 24, rate: 24, snap: true });
    }
    // An electric dome: arcs from the ground at the rim curving over him.
    const R = fx.R * easeOut(t / .2);
    if (t < .55) {
      const d = 1 - win(t, .25, .55);
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7 + hash(seed + i) * .6 + time * .5, gx = fx.x + Math.cos(a) * R * .95, gy = fx.y + Math.sin(a) * R * .47;
        K.forkedBolt(ctx, gx, gy, (gx + cx) / 2, cy - R * .32, seed + i * 5, time,
          { jitter: 26, alpha: d, width: 1.6, pal: BLUE_HOT, base: inkB(d), step: 26, forks: 1, forkLen: 30, rate: 24, snap: true });
      }
    }
    chirps(ctx, cx, cy, 14, 60 + 220 * easeOut(t * 3), 18, time, seed, f);
    ctx.restore();
  }

  // ------------------------------------------------------------------ Amaterasu
  function amaG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .9, fx.dur);
    for (const s of fx.spots) {
      const u = fx.age - s.t;
      if (u < 0) continue;
      const e = easeOut(u / .3);
      K.glow(ctx, s.x, s.y, fx.r * 1.2 * e, '8,2,10', .66 * fade, false, .5);
      K.glow(ctx, s.x, s.y, fx.r * .8 * e, '0,0,0', .7 * fade, false, .5);
      ring(ctx, s.x, s.y, fx.r * e, 2.6, `rgba(160,20,60,${.5 * fade})`);
      if (u < .6) {
        ring(ctx, s.x, s.y, fx.r * (.3 + 1.2 * easeOut(u * 2)), 7, `rgba(30,0,14,${.5 * (1 - u / .6)})`);
        ring(ctx, s.x, s.y, fx.r * (.3 + 1.2 * easeOut(u * 2)), 2.5, `rgba(255,60,90,${.8 * (1 - u / .6)})`);
      }
    }
  }
  function amaO(ctx, fx, time) {
    const K = Kit(), fade = clamp01((fx.dur - fx.age) / .9), tick = Math.floor(time * 12), sm = K.puff('smoke');
    ctx.save();
    for (const s of fx.spots) {
      const u = fx.age - s.t;
      if (u < 0) continue;
      const erupt = easeOut(u / .25), burst = 1 + .8 * (1 - win(u, .1, .5));
      blackFire(ctx, s.x, s.y, fx.r, s.fl, erupt * burst * fade, time, tick, 1);
      for (let i = 0; i < 4; i++) {
        const ph = frac(time * .35 + i * .25 + s.t), x = s.x + (hash(fx.seed + i + s.t * 9) - .5) * fx.r * 1.3;
        K.stamp(ctx, sm, x, s.y - 50 - ph * 170, 30 + ph * 46, .45 * (1 - ph) * erupt * fade);
      }
      if (u < .4) {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, s.x, s.y - 30, fx.r * .9, '140,10,60', .55 * (1 - u / .4), false, .6);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Enton: Kagutsuchi
  function kaguG(ctx, fx, time) {
    const K = Kit(), f = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.lineCap = 'round';
    for (const e of fx.ends) {
      const b = fx.a + (e.i - 2) * KAGU_SPREAD, u = fx.age - e.t + .3;
      if (u <= 0) continue;
      const p = easeOut(u / .3) * KAGU_LEN;
      ctx.strokeStyle = `rgba(30,6,30,${.26 * f})`; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(fx.x + Math.cos(b) * 20, fx.y + Math.sin(b) * 20); ctx.lineTo(fx.x + Math.cos(b) * p, fx.y + Math.sin(b) * p); ctx.stroke();
      if (fx.age > e.t) {
        const q = easeOut((fx.age - e.t) / .3);
        K.glow(ctx, e.x, e.y, KAGU_PATCH * 1.3 * q, '8,2,10', .62 * f, false, .5);
        ring(ctx, e.x, e.y, KAGU_PATCH * q, 2.2, `rgba(170,20,80,${.5 * f})`);
      }
    }
  }
  function kaguO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), m = ctx.getTransform(), tick = Math.floor(time * 14), smk = K.puff('smoke');
    const fade = clamp01((fx.dur - fx.age) / .8);
    ctx.save();
    for (const e of fx.ends) {
      const b = fx.a + (e.i - 2) * KAGU_SPREAD, ca = Math.cos(b), sa = Math.sin(b), t0 = e.t - .3, p = (fx.age - t0) / .3;
      if (p < 0) continue;
      if (p <= 1) {
        // A blade of black fire flying out, with a dark streak and smoke behind it.
        const d = 20 + (KAGU_LEN - 20) * easeOut(p), x = fx.x + ca * d, y = fx.y + sa * d - L * .7, d0 = Math.max(20, d - 220);
        ctx.strokeStyle = 'rgba(40,6,50,.3)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x + ca * d0, fx.y + sa * d0 - L * .7); ctx.lineTo(x, y); ctx.stroke();
        for (let j = 1; j <= 3; j++) if (d - j * 50 > 20) K.stamp(ctx, smk, x - ca * j * 50, y - sa * j * 50 - j * 4, 16 + j * 6, .5 - j * .12);
        K.glow(ctx, x, y, 70, '70,0,40', .55);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, y, 56, '170,30,110', .5);
        ctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(m); ctx.translate(x, y); ctx.rotate(b + Math.PI / 2);
        ctx.drawImage(amaFlame(e.i * 2 + tick), -33, -106, 66, 160);
        ctx.drawImage(amaFlame(e.i * 2 + tick + 3), -20, -40, 40, 100);
        ctx.setTransform(m);
      } else {
        // Landed: a pillar of black fire that settles into a patch that keeps burning.
        const u = fx.age - e.t, pil = 1 - win(u, .1, .6);
        for (let j = 0; j < 3; j++) {
          const h = (80 - j * 16) * pil * (j === 1 ? 1.25 : 1);
          if (h < 4) continue;
          ctx.drawImage(amaFlame(j + e.i + tick), e.x + (j - 1) * 18 - h * .36, e.y - h * FLAME_BASE, h * .72, h);
        }
        if (!e.fl) {
          e.fl = [];
          for (let i = 0; i < 9; i++) { const aa = hash(e.i * 17 + i * 3.3) * TAU, dd = Math.sqrt(hash(e.i + i * 1.9)) * .9; e.fl.push({ dx: Math.cos(aa) * dd, dy: Math.sin(aa) * dd * .5, d: dd, h: hash(i * 2.7 + e.i), i }); }
          e.fl.sort((p, q) => p.dy - q.dy);
        }
        blackFire(ctx, e.x, e.y, KAGU_PATCH, e.fl, .62 * easeOut(u / .4) * fade, time, tick + e.i, 1);
        if (u < .5) K.fx.debris(ctx, e.x, e.y, 90, u / .5, e.i + fx.seed, '#1a0a14', 7);
      }
    }
    // Black flames gathering into blades around him during the launch.
    if (fx.age < .3 && z) {
      const c = 1 - fx.age / .3, hx = z.x + Math.cos(fx.a) * 16, hy = z.y - L;
      for (let i = 0; i < 3; i++) { const h = 50 * c; ctx.drawImage(amaFlame(i + tick), hx - h * .3 + (i - 1) * 12, hy + 14 - h * FLAME_BASE, h * .6, h); }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Amenotejikara
  function swapG(ctx, fx, time) {
    const f = 1 - fx.age / fx.dur;
    for (const [x, y] of [[fx.x1, fx.y1], [fx.x2, fx.y2]]) {
      for (let j = 0; j < 3; j++) {
        const r = 16 + easeOut(fx.age / .5 - j * .12) * 120;
        ring(ctx, x, y, r, 3, `rgba(40,10,90,${.5 * f})`);
        ring(ctx, x, y, r, 1.3, `rgba(215,185,255,${.85 * f})`);
      }
    }
    // dust kicked up where the boulder lands
    if (fx.age < .7) dustRing(ctx, fx.x1, fx.y1, 50 + fx.age * 60, 8, 16 + fx.age * 20, .7 * (1 - fx.age / .7), fx.seed, 4);
  }
  function swapO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), S = Spr(), t = fx.age, f = 1 - win(t, .3, fx.dur);
    ctx.save();
    // Afterimage where he stood, flickering out as the boulder takes his place.
    if (S && t < .3) S.draw(ctx, SPRITE, fx.x1, fx.y1 + 3, { facing: fx.f1 || 1, frame: 'seal', alpha: .6 * (1 - t / .3), flash: .8 });
    const pop = easeOut(t / .12), rs = 1 + .25 * (1 - pop);
    ctx.globalAlpha = f;
    if (S) S.shadow(ctx, fx.x1, fx.y1 + 2, 30);
    ctx.drawImage(rockSpr(), fx.x1 - 34 * rs, fx.y1 + 4 - 62 * rs, 68 * rs, 58 * rs);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    if (t < .35) {
      const g = 1 - t / .35;
      K.glow(ctx, fx.x1, fx.y1 - L, 70 * g + 14, '180,130,255', g, true);
      K.glow(ctx, fx.x2, fx.y2 - L, 80 * g + 14, '180,130,255', g, true);
      // the space folds: a violet ripple disc at both ends
      K.spin(ctx, K.swirl('skb:teji', ['rgba(255,255,255,.95)', 'rgba(190,150,255,.85)', 'rgba(120,70,230,.7)'], 5, 1.2, .12), fx.x2, fx.y2 - L, 50 + 40 * (1 - g), time * 8, g, .7);
    }
    chirps(ctx, fx.x2, fx.y2 - L, 6, 26, 10, time, fx.seed, f * .8, '225,205,255');
    ctx.restore();
  }
  function slashO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), t = fx.age, p = easeOut(t / .14), f = 1 - win(t, .14, fx.dur), sd = fx.side || 1;
    const a0 = fx.a - sd * 1.4, a1 = a0 + sd * 2.8 * p, lo = Math.min(a0, a1), hi = Math.max(a0, a1), R = fx.R;
    if (hi - lo < .05 || f <= 0) return;
    const cx = fx.x + Math.cos(fx.a) * 40, cy = fx.y - L * .7 + Math.sin(fx.a) * 20;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, .55);
    crescent(ctx, 0, 0, R + 4, lo, hi, 16 * f + 2, inkB(.75 * f));
    crescent(ctx, 0, 0, R, lo + .04, hi - .02, 13 * f + 2, `rgba(46,110,240,${.85 * f})`);
    ctx.globalCompositeOperation = 'lighter';
    crescent(ctx, 0, 0, R - 1, lo + .06, hi - .03, 7 * f + 1, `rgba(110,180,255,${.7 * f})`);
    crescent(ctx, 0, 0, R - 2, lo + .1, hi - .05, 2.4 * f + .6, `rgba(250,253,255,${f})`);
    crescent(ctx, 0, 0, R * .7, lo + .3, hi - .2, 6 * f + 1, `rgba(140,90,255,${.55 * f})`);
    ctx.restore(); ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Chidori running down Kusanagi's arc.
    const q0 = sd > 0 ? lo + .2 : hi - .2, q1 = sd > 0 ? hi : lo;
    K.forkedBolt(ctx, cx + Math.cos(q0) * R, cy + Math.sin(q0) * R * .55, cx + Math.cos(q1) * R, cy + Math.sin(q1) * R * .55, fx.seed, time,
      { jitter: 20, alpha: f, width: 1.6, pal: BLUE_HOT, base: inkB(f), forkBase: true, step: 18, forks: 3, forkLen: 28, rate: 24, snap: true });
    if (t < .2) K.glow(ctx, cx + Math.cos(fx.a) * R * .6, cy + Math.sin(fx.a) * R * .3, 110, '160,210,255', 1 - t / .2, true);
    chirps(ctx, cx + Math.cos(q1) * R, cy + Math.sin(q1) * R * .55, 8, 18, 12, time, fx.seed, f);
    ctx.restore();
  }
  function slashG(ctx, fx, time) {
    const t = fx.age, f = 1 - win(t, .2, fx.dur), cx = fx.x + Math.cos(fx.a) * 40, cy = fx.y + Math.sin(fx.a) * 20;
    // the cut gouged into the ground
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .5);
    ctx.strokeStyle = `rgba(16,14,36,${.45 * f})`; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, fx.R * .95, fx.a - 1.2, fx.a + 1.2); ctx.stroke();
    ctx.strokeStyle = `rgba(150,200,255,${.5 * f})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function markG(ctx, fx, time) {
    const k = clamp01(fx.age / fx.dur);
    markCircle(ctx, fx.x, fx.y, fx.r, MOVES.tejikara.rgb, k, time, false, false);
    // Rinnegan tomoe spinning over the marked spot: where he will appear next.
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5);
    for (let i = 0; i < 6; i++) {
      const a = time * 3 + i * TAU / 6, r = fx.r * (.55 - .2 * k);
      ctx.fillStyle = 'rgba(40,10,90,.55)'; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(215,185,255,.9)'; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Chidori Senbon
  function senbonG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    for (const s of fx.spots) {
      const u = fx.age - s.t;
      if (u < 0) { markCircle(ctx, s.x, s.y, SEN_HIT, MOVES.senbon.rgb, clamp01(fx.age / s.t), time, true, true); continue; }
      ctx.fillStyle = `rgba(8,14,36,${.45 * fade})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 16, 7, 0, 0, TAU); ctx.fill();
      cracks(ctx, s.x, s.y, 46, 5, s.seed, fade * clamp01(u / .1), 1.6);
      if (u < .4) inkRing(ctx, s.x, s.y, 10 + 60 * easeOut(u / .4), 1 - u / .4, 2);
    }
  }
  function senbonO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), hx = z ? z.x : fx.hx, hy = (z ? z.y : fx.hy) - L - 30, fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.save();
    // Chidori in his raised hand, throwing the needles.
    if (fx.age < fx.last && z) K.chidoriBall(ctx, hx, hy, 15, time, fx.seed, { pal: BLUE_HOT, body: '30,80,200', base: INK_B, power: 1, bolts: 8, width: .9 });
    ctx.lineCap = 'round';
    for (const s of fx.spots) {
      const u = (fx.age - s.t + SEN_FLY) / SEN_FLY;
      if (u < 0) continue;
      const tx = s.x, ty = s.y - 4;
      if (u <= 1) {
        const e = easeIn(u), x = hx + (tx - hx) * e, y = hy + (ty - hy) * e - Math.sin(Math.PI * e) * 40;
        const dx = tx - hx, dy = ty - hy, l = Math.hypot(dx, dy) || 1, bx = x - dx / l * 70, by = y - dy / l * 70;
        ctx.strokeStyle = INK_B; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(90,160,255,.8)'; ctx.lineWidth = 3.4; ctx.stroke();
        ctx.strokeStyle = 'rgba(245,250,255,.95)'; ctx.lineWidth = 1.4; ctx.stroke();
        K.glow(ctx, x, y, 18, '170,215,255', .9, true);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const v = fx.age - s.t;
        // the needle stuck in the ground, crackling, then fading
        const a = (1 - win(v, .25, .7)) * fade;
        if (a > 0) {
          const ang = -Math.PI / 2 + s.a, x2 = tx + Math.cos(ang) * 20, y2 = ty + Math.sin(ang) * 20;
          ctx.strokeStyle = inkB(a); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx, ty + 4); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(200,230,255,${a})`; ctx.lineWidth = 1.6; ctx.stroke();
          if (v < .25) { K.glow(ctx, tx, ty - 10, 46, '150,200,255', 1 - v / .25, true); chirps(ctx, tx, ty - 10, 5, 14, 9, time, s.seed, 1 - v / .25); }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Susanoo bow (arrows, Indra)
  // Susanoo's arms and great bow aimed along `ang`. `s` = Susanoo scale, `drawK` = how far the string is drawn.
  const RIG = { gx: 0, gy: 0, nx: 0, ny: 0, tipX: 0, tipY: 0, dx: 1, dy: 0 };
  function rigPts(x, fy, ang, s, drawK) {
    let dx = Math.cos(ang), dy = Math.sin(ang) * .55; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const gx = x + dx * 170 * s, gy = fy - 245 * s + dy * 80 * s;
    RIG.gx = gx; RIG.gy = gy; RIG.nx = gx - dx * 170 * s * drawK; RIG.ny = gy - dy * 170 * s * drawK; RIG.dx = dx; RIG.dy = dy;
    RIG.tipX = gx + dx * 200 * s; RIG.tipY = gy + dy * 200 * s;
    return RIG;
  }
  function bowRig(ctx, x, fy, ang, s, lvl, drawK) {
    const R = rigPts(x, fy, ang, s, drawK), dx = R.dx, dy = R.dy, gx = R.gx, gy = R.gy, nx = R.nx, ny = R.ny;
    const px = -dy, py = dx, side = dx >= 0 ? 1 : -1;
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
    const t1x = gx + px * 230 * s - dx * 80 * s, t1y = gy + py * 230 * s - dy * 80 * s;
    const t2x = gx - px * 230 * s - dx * 80 * s, t2y = gy - py * 230 * s - dy * 80 * s;
    ctx.beginPath(); ctx.moveTo(t1x + dx * 26 * s + px * 8 * s, t1y + dy * 26 * s + py * 8 * s);
    ctx.quadraticCurveTo(t1x, t1y, t1x + dx * 4 * s, t1y + dy * 4 * s);
    ctx.quadraticCurveTo(gx + px * 140 * s + dx * 30 * s, gy + py * 140 * s + dy * 30 * s, gx, gy);
    ctx.quadraticCurveTo(gx - px * 140 * s + dx * 30 * s, gy - py * 140 * s + dy * 30 * s, t2x + dx * 4 * s, t2y + dy * 4 * s);
    ctx.quadraticCurveTo(t2x, t2y, t2x + dx * 26 * s - px * 8 * s, t2y + dy * 26 * s - py * 8 * s);
    ctx.strokeStyle = `rgba(24,4,54,${.85 * lvl})`; ctx.lineWidth = 20 * s + 2; ctx.stroke();
    ctx.strokeStyle = `rgba(150,80,250,${.9 * lvl})`; ctx.lineWidth = 14 * s + 1; ctx.stroke();
    ctx.strokeStyle = `rgba(250,238,255,${lvl})`; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = `rgba(235,215,255,${.9 * lvl})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.lineTo(nx, ny); ctx.lineTo(t2x, t2y); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    Kit().glow(ctx, gx, gy, 200 * s, '150,70,255', .3 * lvl);
    ctx.globalCompositeOperation = 'source-over';
    return R;
  }
  // Ribcage + head of the half-formed Susanoo behind him (arrow volley).
  const HALF_S = .62;
  function halfSusanoo(ctx, x, y, lvl, time) {
    if (!(lvl > .02)) return;
    const K = Kit(), flick = .8 + .2 * Math.sin(time * 13) * Math.sin(time * 7.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - 120, 190, '110,40,240', .35 * lvl);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = lvl * flick * .8;
    ctx.drawImage(ribSprite(false), x - 105, y + 3 - 218, 210, 225);
    ctx.globalAlpha = 1;
    // a skull-like helm over the ribs
    const hy = y - 210;
    ctx.fillStyle = `rgba(110,52,220,${.55 * lvl})`; ctx.strokeStyle = `rgba(22,2,50,${.8 * lvl})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, hy, 30, 34, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = `rgba(238,222,255,${.85 * lvl})`; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = `rgba(12,0,34,${.9 * lvl})`;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 11, hy - 4, 7, 5, 0, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x - 11, hy - 4, 10, '235,215,255', lvl, true); K.glow(ctx, x + 11, hy - 4, 10, '235,215,255', lvl, true);
    ctx.restore();
  }
  function arrowsG(ctx, fx, time, z) {
    const f = 1 - win(fx.age, 1.0, fx.dur);
    if (z) halfSusanoo(ctx, z.x, z.y, 1 - win(fx.age, .25, .6), time);
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const p = (fx.age - arrowRel(i)) / .3;
      if (p < 1) continue;
      const b = fx.a + (i - 3) * ARR_SPREAD, x2 = fx.x + Math.cos(b) * ARR_LEN, y2 = fx.y + Math.sin(b) * ARR_LEN;
      ctx.strokeStyle = `rgba(30,6,60,${.22 * f})`; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(fx.x + Math.cos(b) * 60, fx.y + Math.sin(b) * 60); ctx.lineTo(x2, y2); ctx.stroke();
      inkRing(ctx, x2, y2, 20 + 70 * easeOut((p - 1) * 2), f, 2.5, true);
      if (i === 3) cracks(ctx, x2, y2, 110, 8, fx.seed, f, 2.4);
    }
  }
  function arrowsO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), t = fx.age;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const lvl = 1 - win(t, .25, .6);
    if (lvl > 0 && z) bowRig(ctx, z.x, z.y + 3, fx.a, PS_SCALE * HALF_S, lvl, Math.max(0, 1 - t / .06) * .55);
    for (let i = 0; i < 7; i++) {
      const p = (t - arrowRel(i)) / .3;
      if (p < 0) continue;
      const b = fx.a + (i - 3) * ARR_SPREAD, ux = Math.cos(b), uy = Math.sin(b);
      if (p <= 1) {
        const at = d => [fx.x + ux * d, fx.y + uy * d - (L + 90 * (1 - smooth(d / ARR_LEN * 1.4)))];
        const d1 = 60 + (ARR_LEN - 60) * p, [hx, hy] = at(d1), [tx, ty] = at(Math.max(60, d1 - 220));
        lightningSpear(ctx, tx, ty, hx, hy, 13, 1, fx.seed * 9 + i, time, false, true);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, hx, hy, 50, '210,150,255', .9, true);
        ctx.globalCompositeOperation = 'source-over';
      } else if (p < 2.4) {
        const q = (p - 1) / 1.4, x = fx.x + ux * ARR_LEN, y = fx.y + uy * ARR_LEN;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, y - L, 110 * (1 - q * .5), '180,90,255', 1 - q, true);
        chirps(ctx, x, y - L, 7, 30 + 46 * q, 13, time, i, 1 - q, '242,222,255');
        ctx.globalCompositeOperation = 'source-over';
        if (q < .8) K.fx.debris(ctx, x, y, 80, q, i + fx.seed, '#24103c', 6);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Kirin
  function clouds(ctx, cx, cy, gather, fade, time, seed) {
    const K = Kit(), a = gather * fade;
    if (!(a > .01)) return;
    K.glow(ctx, cx, cy, 600 * (.5 + .5 * gather), '6,8,22', .9 * a, false, .32);
    K.glow(ctx, cx, cy, 380 * (.5 + .5 * gather), '4,6,16', .8 * a, false, .3);
    const sm = K.puff('smoke'), vi = K.puff('violet');
    for (let i = 0; i < 22; i++) {
      const an = hash(seed + i) * TAU + time * .15 * (i % 2 ? 1 : -1), rr = (40 + hash(seed + i * 3) * 360) * (.4 + .6 * gather);
      const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * .26 + (hash(i) - .5) * 50;
      const s = (90 + hash(seed + i * 7) * 90) * (.5 + .5 * gather);
      K.stamp(ctx, i % 4 ? sm : vi, x, y, s, .92 * a, .6);
    }
    // sheet lightning flickering inside the clouds
    ctx.globalCompositeOperation = 'lighter';
    const tick = Math.floor(time * 9);
    for (let i = 0; i < 3; i++) {
      if (hash(seed + i * 5 + tick) < .5) continue;
      const an = hash(seed + i * 13 + tick) * TAU, rr = hash(seed + i + tick) * 280;
      K.glow(ctx, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * .26, 130, '120,180,255', .55 * a);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function kirinG(ctx, fx, time) {
    const K = Kit(), t = fx.age - KIRIN_DIVE, fade = 1 - win(fx.age, 1.9, fx.dur);
    K.glow(ctx, fx.x, fx.y, fx.r * 1.5, '10,12,26', .5 * fade, false, .5);
    if (t < 0) return;
    const f = 1 - win(t, .5, fx.dur - KIRIN_DIVE);
    K.glow(ctx, fx.x, fx.y, fx.r * 1.05, '4,10,24', .55 * f, false, .5);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, fx.r * (.6 + .5 * easeOut(t * 3)), '50,120,255', .55 * f, false, .5);
    groundRays(ctx, fx.x, fx.y, 11, 30, fx.r * (.5 + .55 * easeOut(t * 3)), time, fx.seed * 5, f, 2.4);
    ctx.globalCompositeOperation = 'source-over';
    cracks(ctx, fx.x, fx.y, fx.r * 1.1 * easeOut(t * 4), 16, fx.seed, f, 3);
    inkRing(ctx, fx.x, fx.y, fx.r * (.3 + .9 * easeOut(t * 2)), f, 5);
    inkRing(ctx, fx.x, fx.y, fx.r * (.1 + .6 * easeOut(t * 2.6)), f * .7, 3);
    if (t < 1) K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.4, t, 1 - t, '140,200,255');
    dustRing(ctx, fx.x, fx.y, fx.r * (.4 + easeOut(t * 1.4) * .8), 22, 26 + t * 40, .75 * (1 - win(t, .3, 1.6)), fx.seed, 8 + t * 20);
  }
  function kirinO(ctx, fx, time) {
    const K = Kit(), t = fx.age, fade = 1 - win(t, 1.6, fx.dur), cx = fx.x, cy = fx.y - KIRIN_CLOUD, seed = fx.seed * 11.3, side = fx.side || 1;
    ctx.save();
    clouds(ctx, cx, cy, 1, fade, time, seed);
    ctx.globalCompositeOperation = 'lighter';
    // Kirin: the lightning dragon diving out of the clouds.
    if (t < KIRIN_DIVE + .6) {
      const P0 = [cx + 230 * side, cy + 10], P1 = [fx.x - 300 * side, fx.y - 250], P2 = [fx.x + 220 * side, fx.y - 120], P3 = [fx.x, fx.y - 14];
      const B = u => { const v = 1 - u; return [v * v * v * P0[0] + 3 * v * v * u * P1[0] + 3 * v * u * u * P2[0] + u * u * u * P3[0], v * v * v * P0[1] + 3 * v * v * u * P1[1] + 3 * v * u * u * P2[1] + u * u * u * P3[1]]; };
      const head = easeIn(t / KIRIN_DIVE), tail = win(t, KIRIN_DIVE, KIRIN_DIVE + .5), a = 1 - win(t, KIRIN_DIVE + .25, KIRIN_DIVE + .6);
      const N = 24, pts = [], t0 = Math.max(0, head - .95, tail * head);
      for (let i = 0; i <= N; i++) pts.push(B(t0 + (head - t0) * i / N));
      const layers = [['source-over', `rgba(4,12,46,${.82 * a})`, 74], ['lighter', `rgba(40,110,255,${.7 * a})`, 60],
        ['lighter', `rgba(150,205,255,${.8 * a})`, 30], ['lighter', `rgba(255,255,255,${a})`, 10]];
      for (const [op, col, w] of layers) {
        ctx.globalCompositeOperation = op; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
        K.forkedBolt(ctx, p0[0], p0[1], p1[0], p1[1], seed + c * 7, time, { jitter: 38, alpha: a, width: 2.2, pal: BLUE_HOT, base: inkB(a), forkBase: true,
          forks: 4, forkLen: 64, step: 26, rate: 24, snap: true });
      }
      const hp = pts[N], hq = pts[N - 2], dir = Math.atan2(hp[1] - hq[1], hp[0] - hq[0]);
      if (head < 1 || t < KIRIN_DIVE + .2) {
        const ha = head < 1 ? 1 : 1 - win(t, KIRIN_DIVE, KIRIN_DIVE + .2);
        ctx.save(); ctx.translate(hp[0], hp[1]); ctx.rotate(dir); if (Math.cos(dir) < 0) ctx.scale(1, -1);
        ctx.scale(1.3, 1.3); ctx.translate(-66, 0);
        ctx.globalCompositeOperation = 'source-over';
        kirinHead(ctx); ctx.fillStyle = `rgba(4,12,46,${.85 * ha})`; ctx.fill();
        ctx.strokeStyle = `rgba(4,12,46,${.85 * ha})`; ctx.lineWidth = 10; ctx.stroke();
        ctx.fillStyle = `rgba(50,120,240,${.95 * ha})`; ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(235,248,255,${ha})`; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.save(); ctx.translate(30, 0); ctx.scale(.62, .5); kirinHead(ctx); ctx.restore();
        ctx.fillStyle = `rgba(190,225,255,${.7 * ha})`; ctx.fill();
        K.glow(ctx, 52, -14, 24, '255,255,255', ha, true);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, hp[0], hp[1], 100, '90,160,255', .4 * ha);
      }
    }
    // Impact: a blinding flash and a column of light.
    const u = t - KIRIN_DIVE;
    if (u >= 0 && u < .5) {
      const q = u / .5;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - 40, 380 * (.5 + q), '210,235,255', (1 - q) * .95, true, .7);
      K.glow(ctx, fx.x, fx.y - 300, 100 * (1 - q * .5), '140,200,255', 1 - q, false, 4);
    }
    if (u > 0 && u < 1.2) {
      const v = 1 - u / 1.2;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * .55 + (K.wobble(seed + i * 3, time, 5) - .5) * .6, l = 150 + hash(seed + i) * 130;
        const bx = fx.x + (i - 2) * 80, by = fx.y + (hash(i + seed) - .5) * 70;
        K.forkedBolt(ctx, bx, by, bx + Math.cos(a) * l * .6, by + Math.sin(a) * l, seed + i * 17, time,
          { jitter: 24, alpha: v, width: 1.9, pal: BLUE_HOT, base: inkB(v), forkBase: true, step: 22, forks: 1, forkLen: 30, rate: 22, snap: true });
      }
      ctx.globalCompositeOperation = 'source-over';
      if (u < 1.1) K.fx.debris(ctx, fx.x, fx.y, fx.r, u / 1.1, fx.seed, '#1c2232', 22);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Indra's Arrow
  const susLevel = (st, fx) => {
    if (st.windup > 0 && st.move === 'indra') return easeOut((st.windMax - st.windup) / INDRA_RISE);
    return fx ? 1 - win(fx.age, .7, 1.4) : 0;
  };
  function drawPerfect(ctx, x, y, facing, lvl, time) {
    if (!(lvl > .01)) return;
    const K = Kit(), s = PS_SCALE * (.85 + .15 * lvl), fy = y + 3 + (1 - lvl) * 60;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, fy - 220 * s, 320 * s, '110,40,240', .4 * lvl);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .92 * lvl;
    ctx.translate(x, fy); ctx.scale(facing * s, s);
    ctx.drawImage(psSprite(), -PS_OX, -PS_OY);
    ctx.globalAlpha = 1;
    // violet chakra flames wrapping the base, and the glowing eyes
    const tick = Math.floor(time * 11);
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * 30, h = (150 - Math.abs(i - 3) * 22 + hash(i * 2) * 30) * lvl * (.9 + .1 * Math.sin(time * 8 + i));
      if (h < 8) continue;
      ctx.globalAlpha = .6 * lvl;
      ctx.drawImage(Kit().flame((i + tick) % 6, VIOLET_FLAME, 'sv'), ox - h * .28, -10 + Math.abs(i - 3) * 5 - h * FLAME_BASE, h * .56, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    const pulse = .8 + .2 * Math.sin(time * 6);
    K.glow(ctx, -15, -364, 18, '235,215,255', lvl * pulse, true); K.glow(ctx, 15, -364, 18, '235,215,255', lvl * pulse, true);
    ctx.restore();
  }
  function indraBeam(ctx, fx, time, tipX, tipY) {
    const K = Kit(), t = fx.age, L = LIFT(), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    const front = easeOut(t / .14), f = 1 - win(t, .9, fx.dur);
    const width = (f * .85 + .15) * (1 + .07 * Math.sin(time * 42));
    const endX = fx.x + ca * (60 + fx.len), endY = fx.y + sa * (60 + fx.len) - L;
    const cX = fx.x + ca * (60 + fx.len * .3), cY = fx.y + sa * (60 + fx.len * .3) - L;
    const c1x = tipX + (cX - tipX) * front, c1y = tipY + (cY - tipY) * front;
    const ex = (1 - front) * (1 - front) * tipX + 2 * (1 - front) * front * cX + front * front * endX;
    const ey = (1 - front) * (1 - front) * tipY + 2 * (1 - front) * front * cY + front * front * endY;
    const P = (u, out) => { const v = 1 - u; out[0] = v * v * tipX + 2 * v * u * c1x + u * u * ex; out[1] = v * v * tipY + 2 * v * u * c1y + u * u * ey; return out; };
    const A = [0, 0], Bq = [0, 0];
    ctx.save(); ctx.lineCap = 'round';
    const stroke = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo(c1x, c1y, ex, ey); ctx.stroke(); };
    stroke(186 * width, `rgba(20,0,44,${.72 * f})`);
    ctx.globalCompositeOperation = 'lighter';
    stroke(164 * width, `rgba(104,28,226,${.55 * f})`);
    stroke(116 * width, `rgba(168,88,255,${.6 * f})`);
    stroke(68 * width, `rgba(228,192,255,${.8 * f})`);
    stroke(28 * width, `rgba(255,252,255,${.95 * f})`);
    // ribbons of chakra twisting round the beam
    ctx.lineWidth = 5 * width; ctx.lineJoin = 'round';
    for (const ph of [0, Math.PI]) {
      ctx.strokeStyle = `rgba(240,215,255,${.55 * f})`;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const u = i / 48; P(u, A); P(Math.min(1, u + .01), Bq);
        const dl = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]) || 1, o = Math.sin(u * 15 - time * 24 + ph) * 66 * width * Math.min(1, u * 6);
        const qx = A[0] - (Bq[1] - A[1]) / dl * o, qy = A[1] + (Bq[0] - A[0]) / dl * o;
        if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy);
      }
      ctx.stroke();
    }
    // speed streaks racing alongside
    ctx.lineWidth = 2.2; ctx.strokeStyle = `rgba(250,240,255,${.75 * f})`;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const u0 = frac(hash(i * 3.7) + time * 2.2), u1 = Math.min(1, u0 + .08 + hash(i) * .06), side = i % 2 ? 1 : -1, off = side * (96 + hash(i * 5.1) * 52) * width;
      P(u0, A); P(u1, Bq);
      const dl = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]) || 1, ox = -(Bq[1] - A[1]) / dl * off, oy = (Bq[0] - A[0]) / dl * off;
      ctx.moveTo(A[0] + ox, A[1] + oy); ctx.lineTo(Bq[0] + ox, Bq[1] + oy);
    }
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const p0 = P(i / 3, [0, 0]), p1 = P((i + 1) / 3, [0, 0]);
      K.forkedBolt(ctx, p0[0], p0[1], p1[0], p1[1], fx.seed * 3 + i, time,
        { jitter: 60 * width, alpha: f, width: 2.4, pal: PAL_HOT, base: inkV(f), forkBase: true, forks: 5, forkLen: 80, step: 30, rate: 26, snap: true });
    }
    for (let i = 1; i < 6; i++) { const ph = frac(time * 3 + i * .37); P(i / 6, A); K.glow(ctx, A[0], A[1], (130 + 70 * ph) * width, '190,120,255', .45 * f); }
    if (t < .35) K.glow(ctx, tipX, tipY, 480 * easeOut(t / .1), '240,220,255', 1 - t / .35, true);
    K.glow(ctx, ex, ey, 220 * width + 80 * (1 - front), '230,200,255', f, true);
    if (front >= 1) {
      const q = win(t, .14, 1.4);
      K.glow(ctx, endX, endY + L, 460 * easeOut(q * 2), '170,80,255', .7 * (1 - q), false, .6);
      ctx.globalCompositeOperation = 'source-over';
      const sm = K.puff('smoke'), vi = K.puff('violet');
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + fx.seed, d = 50 + 200 * easeOut(q * 1.5);
        K.stamp(ctx, i % 2 ? sm : vi, endX + Math.cos(a) * d, endY + L + Math.sin(a) * d * .45 - q * 90, 60 + 60 * q, .6 * (1 - q));
      }
      K.fx.debris(ctx, endX, endY + L, 260, q * 1.3, fx.seed, '#1e0c30', 18);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * .6 + (K.wobble(fx.seed + i * 3, time, 5) - .5) * .5, l = (170 + hash(i + fx.seed) * 120) * (1 - q);
        if (l < 20) continue;
        K.forkedBolt(ctx, endX, endY + L, endX + Math.cos(a) * l * .7, endY + L + Math.sin(a) * l, fx.seed + i * 17, time,
          { jitter: 22, alpha: 1 - q, width: 1.8, pal: PAL_HOT, base: inkV(1 - q), forkBase: true, step: 18, forks: 2, forkLen: 30, rate: 22, snap: true });
      }
    }
    ctx.restore();
  }
  function indraG(ctx, fx, time) {
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), x1 = fx.x + ca * 60, y1 = fx.y + sa * 60;
    const t = fx.age, f = 1 - win(t, 1.0, fx.dur), front = easeOut(t / .15), len = fx.len * front;
    const x2 = x1 + ca * len, y2 = y1 + sa * len, nx = -sa * INDRA_W, ny = ca * INDRA_W;
    // the trench the beam gouges: a scorched band with molten violet edges
    ctx.fillStyle = `rgba(16,2,30,${.45 * f})`;
    ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.lineTo(x2 - nx, y2 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.strokeStyle = `rgba(170,90,255,${.55 * f})`; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(x1 + nx * s * .95, y1 + ny * s * .95); ctx.lineTo(x2 + nx * s * .95, y2 + ny * s * .95); ctx.stroke();
      ctx.strokeStyle = `rgba(240,220,255,${.7 * f})`; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (front >= 1) {
      const ex = fx.x + ca * (60 + fx.len), ey = fx.y + sa * (60 + fx.len);
      inkRing(ctx, ex, ey, 60 + 300 * easeOut((t - .15) * 1.6), f, 5, true);
      inkRing(ctx, ex, ey, 30 + 180 * easeOut((t - .15) * 2.2), f * .8, 3, true);
      cracks(ctx, ex, ey, 320 * easeOut((t - .15) * 3), 14, fx.seed, f, 3.2);
      if (t < 1.3) Kit().fx.shockRing(ctx, ex, ey, 420, (t - .15) / 1.15, 1 - (t - .15) / 1.15, '190,120,255');
    }
  }
  function indraO(ctx, fx, time, z, st) {
    const L = LIFT(), lvl = z ? susLevel(st, fx) : 0, s = PS_SCALE * (.85 + .15 * Math.max(lvl, .01)), x = fx.x, y = fx.y;
    const fy = y + 3 + (1 - lvl) * 60;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let R;
    if (lvl > .01) R = bowRig(ctx, x, fy, fx.a, s, lvl, Math.max(0, 1 - fx.age / .08));
    else R = rigPts(fx.x, fx.y + 3, fx.a, PS_SCALE, 0);
    const tipX = fx.tipX != null ? fx.tipX : (fx.tipX = R.tipX), tipY = fx.tipY != null ? fx.tipY : (fx.tipY = R.tipY);
    ctx.restore();
    indraBeam(ctx, fx, time, tipX, tipY);
    void L;
  }

  // ------------------------------------------------------------------ body flicker
  function blinkG(ctx, fx) {
    const f = 1 - fx.age / fx.dur;
    for (const [x, y] of [[fx.x1, fx.y1], [fx.x2, fx.y2]]) inkRing(ctx, x, y, 14 + 56 * easeOut(fx.age / .35), f, 2);
  }
  function blinkO(ctx, fx, time) {
    const K = Kit(), f = 1 - fx.age / fx.dur, L = LIFT();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y] of [[fx.x1, fx.y1], [fx.x2, fx.y2]]) { K.glow(ctx, x, y - L, 50 * f + 10, '120,180,255', f, true); chirps(ctx, x, y - L, 7, 24, 10, time, fx.seed + x, f); }
    K.forkedBolt(ctx, fx.x1, fx.y1 - L, fx.x2, fx.y2 - L, fx.seed, time, { jitter: 22, alpha: f * .8, width: 1.4, pal: BLUE_HOT, base: inkB(f * .6), step: 30, forks: 2, forkLen: 26, rate: 24, snap: true });
    ctx.restore();
  }

  const FX = {
    eiso: [eisoG, eisoO], nagashi: [nagashiG, nagashiO], ama: [amaG, amaO], kagu: [kaguG, kaguO],
    swap: [swapG, swapO], slash: [slashG, slashO], mark: [markG, null], senbon: [senbonG, senbonO],
    arrows: [arrowsG, arrowsO], kirin: [kirinG, kirinO], indra: [indraG, indraO], blink: [blinkG, blinkO]
  };

  // ------------------------------------------------------------------ windup looks
  function eyePos(z, f) { const S = Spr(), h = S ? S.height(SPRITE) : 92; return { x: z.x + f * 6, y: z.y + 3 - h * .8 }; }
  function windupG(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, move = st.move;
    // Chakra ripples spreading over the ground from his feet: blue for Chidori, violet otherwise.
    const blue = move === 'eiso' || move === 'nagashi' || move === 'senbon' || move === 'kirin';
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .5);
    for (let i = 0; i < 4; i++) {
      const ph = frac(time * 1.2 + i / 4), r = 20 + ph * (90 + 70 * k);
      ctx.lineWidth = 3.5; ctx.strokeStyle = blue ? `rgba(8,30,90,${(1 - ph) * .55})` : `rgba(60,20,120,${(1 - ph) * .55})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = blue ? `rgba(190,225,255,${(1 - ph) * .75})` : `rgba(225,205,255,${(1 - ph) * .75})`; ctx.stroke();
    }
    ctx.restore();
    if (blue && move !== 'kirin') {
      ctx.globalCompositeOperation = 'lighter';
      groundRays(ctx, z.x, z.y, 5, 8, 50 + 60 * k, time, 7.7, .5 + .5 * k, 1.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (move === 'kirin') K.glow(ctx, st.tx, st.ty, KIRIN_R * 1.5, '10,12,26', .5 * easeOut(k), false, .5);
    if (move === 'arrows') halfSusanoo(ctx, z.x, z.y, easeOut(k * 2.5), time);
    if (move === 'indra') drawPerfect(ctx, z.x, z.y, Math.cos(st.aim) >= 0 ? 1 : -1, susLevel(st, null), time);
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, e = easeOut(k), move = st.move, f = Math.cos(st.aim) >= 0 ? 1 : -1, L = LIFT();
    const hx = z.x + f * 18, hy = z.y - L - 4, ey = eyePos(z, f);
    ctx.globalCompositeOperation = 'lighter';
    // Eternal Mangekyō (red) and Rinnegan (violet) flaring.
    K.glow(ctx, ey.x + f * 3, ey.y, 9 + 5 * k, '255,40,60', .8, true);
    K.glow(ctx, ey.x - f * 4, ey.y, 10 + 6 * k, '190,150,255', .85, true);
    ctx.globalCompositeOperation = 'source-over';
    switch (move) {
      case 'eiso': {
        // Chidori screaming in his palm, growing into a ball of birds.
        K.chidoriBall(ctx, hx, hy, 10 + 14 * e, time, 3.3, { pal: BLUE_HOT, body: '30,80,200', base: INK_B, power: .4 + .6 * k, bolts: 7 + Math.round(k * 4), width: 1 });
        ctx.globalCompositeOperation = 'lighter'; chirps(ctx, hx, hy, 10, 30 + 30 * e, 12, time, 4.4, .8); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'nagashi': {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - L, 50 + 50 * e, '60,130,255', .5);
        for (let i = 0; i < 4; i++) {
          const a = time * 3 + i * TAU / 4, r = 26 + 10 * Math.sin(time * 9 + i);
          K.forkedBolt(ctx, z.x + Math.cos(a) * r, z.y - L - 20 + Math.sin(a) * 34, z.x + Math.cos(a + 1.4) * r, z.y - L - 20 + Math.sin(a + 1.4) * 34, 9 + i, time,
            { jitter: 10, alpha: .5 + .5 * k, width: 1.2, pal: BLUE_HOT, base: INK_B, step: 10, forks: 1, forkLen: 14, rate: 26, snap: true });
        }
        chirps(ctx, z.x, z.y - L, 12, 30 + 40 * e, 12, time, 6.1, .9);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'senbon': {
        // Chidori held high, needles of lightning forming in a fan behind it.
        const cx = z.x + f * 6, cy = z.y - L - 30;
        K.chidoriBall(ctx, cx, cy, 10 + 8 * e, time, 5.1, { pal: BLUE_HOT, body: '30,80,200', base: INK_B, power: k, bolts: 8, width: .9 });
        ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * .26, r0 = 24, r1 = 24 + 40 * e;
          ctx.strokeStyle = INK_B; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(200,230,255,.95)'; ctx.lineWidth = 1.4; ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        break;
      }
      case 'amaterasu': {
        // His eye bleeds as he focuses; black sparks kindle at the marked spots.
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, ey.x + f * 3, ey.y, 16 + 8 * Math.sin(time * 40), '255,30,50', .9, true);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(170,0,20,.9)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(ey.x + f * 3, ey.y + 3); ctx.lineTo(ey.x + f * 3.4, ey.y + 3 + 9 * e); ctx.stroke();
        const tick = Math.floor(time * 12);
        for (const s of st.tele) {
          if (s.k !== 'c') continue;
          K.glow(ctx, s.x, s.y - 10, 40 * e, '0,0,0', .85, false, .8);
          const h = 30 * e;
          if (h > 4) ctx.drawImage(amaFlame(tick + (s.x | 0)), s.x - h * .36, s.y - h * FLAME_BASE, h * .72, h);
        }
        break;
      }
      case 'kagutsuchi': {
        // Black flames gathering round him and shaping into blades.
        const tick = Math.floor(time * 14);
        for (let i = 0; i < 5; i++) {
          const a = st.aim + (i - 2) * KAGU_SPREAD, r = 30 + 10 * e, h = 26 + 30 * e;
          const x = z.x + Math.cos(a) * r, y = z.y - L * .7 + Math.sin(a) * r * .5;
          ctx.drawImage(amaFlame(i + tick), x - h * .3, y - h * .7, h * .6, h);
        }
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 40 * e, '150,30,110', .5); ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'tejikara': {
        // The Rinnegan's tomoe spin; the space round the target ripples.
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, K.swirl('skb:teji', ['rgba(255,255,255,.95)', 'rgba(190,150,255,.85)', 'rgba(120,70,230,.7)'], 5, 1.2, .12), st.tx, st.ty - L, 40 + 30 * e, -time * 7, .6 * e, .6);
        K.glow(ctx, ey.x - f * 4, ey.y, 22, '200,160,255', .9 * e, true);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'arrows': {
        // Half-formed Susanoo raises its bow; seven arrows nocked in a fan.
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const R = bowRig(ctx, z.x, z.y + 3, st.aim, PS_SCALE * HALF_S, easeOut(k * 2.5), easeOut(k / .8) * .55);
        const ap = easeOut(k * 2);
        for (let i = 0; i < 7; i++) {
          const a = st.aim + (i - 3) * ARR_SPREAD, ux = Math.cos(a), uy = Math.sin(a) * .55, ul = Math.hypot(ux, uy);
          lightningSpear(ctx, R.nx, R.ny, R.nx + ux / ul * 150, R.ny + uy / ul * 150, 7, ap, 30 + i, time, false, true);
        }
        ctx.globalCompositeOperation = 'lighter';
        Kit().glow(ctx, R.nx, R.ny, 50, '210,150,255', ap, true);
        ctx.restore();
        break;
      }
      case 'kirin': {
        // Thunderclouds churning over the target, leaders crackling down; his arm raised to the sky.
        const seed = 41.3, cx = st.tx, cy = st.ty - KIRIN_CLOUD;
        ctx.save();
        clouds(ctx, cx, cy, e, 1, time, seed);
        ctx.globalCompositeOperation = 'lighter';
        const tick = Math.floor(time * 9);
        if (k > .45 && hash(seed + tick) > .4)
          K.forkedBolt(ctx, cx + (hash(tick) - .5) * 300, cy + 40, st.tx + (K.wobble(seed, time, 3) - .5) * 320, st.ty - 10, seed + tick, time,
            { jitter: 40, alpha: .75, width: 1.6, pal: BLUE_HOT, base: INK_B, forkBase: true, forks: 3, forkLen: 50, step: 40, rate: 20, snap: true });
        // a thin leader from his raised hand up into the sky
        const ax = z.x + f * 4, ay = z.y - L - 40;
        K.chidoriBall(ctx, ax, ay, 10 + 6 * e, time, 8.8, { pal: BLUE_HOT, body: '30,80,200', base: INK_B, power: k, bolts: 6, width: .9 });
        K.forkedBolt(ctx, ax, ay, ax + 30, ay - 420, 77, time, { jitter: 26, alpha: .5 + .5 * k, width: 1.4, pal: BLUE_HOT, base: INK_B, step: 36, forks: 2, forkLen: 30, rate: 22, snap: true });
        ctx.restore();
        break;
      }
      case 'indra': {
        // Perfect Susanoo (drawn on the ground pass) draws the colossal arrow.
        const lvl = susLevel(st, null), s = PS_SCALE * (.85 + .15 * lvl), fy = z.y + 3 + (1 - lvl) * 60, el = st.windMax - st.windup;
        const drawK = easeOut(win(el, INDRA_RISE * .8, st.windMax - .15));
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const R = bowRig(ctx, z.x, fy, st.aim, s, lvl, drawK);
        const c = win(el, INDRA_RISE * .6, st.windMax);
        if (c > 0) {
          lightningSpear(ctx, R.nx - R.dx * 20, R.ny - R.dy * 20, R.tipX, R.tipY, (10 + 28 * c) * s * 1.2, c, 91, time, true, true);
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, R.tipX, R.tipY, (60 + 130 * c) * s, '210,150,255', c, true);
          K.glow(ctx, R.tipX, R.tipY, (150 + 220 * c) * s, '200,40,225', .35 * c);
          ctx.strokeStyle = `rgba(230,200,255,${.75 * c})`; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const ph = frac(time * 1.6 + hash(i * 3.3)), a = hash(i * 7.1) * TAU, r0 = (280 - 230 * ph) * s, r1 = r0 + 40 * s;
            ctx.moveTo(R.tipX + Math.cos(a) * r1, R.tipY + Math.sin(a) * r1 * .7); ctx.lineTo(R.tipX + Math.cos(a) * r0, R.tipY + Math.sin(a) * r0 * .7);
          }
          ctx.stroke();
          for (let i = 0; i < 2; i++) {
            const a0 = time * 7 + i * Math.PI, rr = (40 + 30 * c) * s;
            K.forkedBolt(ctx, R.tipX + Math.cos(a0) * rr, R.tipY + Math.sin(a0) * rr * .6, R.tipX + Math.cos(a0 + 2.2) * rr, R.tipY + Math.sin(a0 + 2.2) * rr * .6,
              93 + i * 5, time, { jitter: 12, alpha: c, width: 1.4, pal: PAL_HOT, base: INK_V, step: 12, forks: 1, forkLen: 20, rate: 26, snap: true });
          }
          chirps(ctx, R.tipX, R.tipY, 12, 50 * s, 16, time, 95, c, '242,222,255');
        }
        ctx.restore();
        break;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawRibs(ctx, z, st, time, front) {
    const lvl = st.guardVis;
    if (!(lvl > .03)) return;
    const K = Kit(), flick = .8 + .2 * Math.sin(time * 13 + (front ? 1 : 0)) * Math.sin(time * 7.3);
    ctx.save();
    if (!front) {
      // violet chakra pooling on the ground and licking up round the bones
      K.glow(ctx, z.x, z.y, 120, '40,10,90', .45 * lvl, false, .5);
      ring(ctx, z.x, z.y, 95, 5, `rgba(24,4,52,${.5 * lvl})`); ring(ctx, z.x, z.y, 95, 2, `rgba(205,165,255,${.85 * lvl})`);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, z.y - 80, 140, '120,50,240', .45 * lvl); ctx.globalCompositeOperation = 'source-over';
      const tick = Math.floor(time * 11);
      for (let i = 0; i < 6; i++) {
        const ox = (i - 2.5) * 30, h = (70 - Math.abs(i - 2.5) * 10 + hash(i * 2) * 20) * lvl * (.85 + .15 * Math.sin(time * 9 + i));
        ctx.globalAlpha = .55 * lvl;
        ctx.drawImage(K.flame((i + tick) % 6, VIOLET_FLAME, 'sv'), z.x + ox - h * .28, z.y + 8 - h * FLAME_BASE, h * .56, h);
      }
    }
    ctx.globalAlpha = Math.min(1, lvl * flick * (front ? .8 : .95));
    ctx.drawImage(ribSprite(front), z.x - 100, z.y + 3 - 207, 200, 214);
    ctx.restore();
  }

  function label(ctx, z, st, m) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : st.guard > 0 ? 'guard' : '';
    if (!move) return;
    const S = Spr(), top = z.y - (S && S.height ? S.height(SPRITE) : 100) - 42;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#0c0a1c'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = move === 'indra' ? '#f2e2ff' : '#c9b2ff'; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.guard = 0; st.guardVis = Math.max(0, st.guardVis - dt * 2.5);
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.sk;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    if (!st.fx.length && !(st.windup > 0) && !(st.guardVis > 0)) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.windup > 0 && st.move) {
      drawTele(ctx, z, st, time);
      windupG(ctx, z, st, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // The Perfect Susanoo lingers a moment after Indra's Arrow leaves the bow.
    const ind = st.fx.find(f => f.kind === 'indra');
    if (ind && z.health > 0 && !(st.windup > 0)) drawPerfect(ctx, ind.x, ind.y, Math.cos(ind.a) >= 0 ? 1 : -1, susLevel(st, ind), time);
    drawRibs(ctx, z, st, time, false);
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.sk;
    if (!m || !st || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null, st); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    drawRibs(ctx, z, st, time, true);
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        windupO(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  window.SasukeBoss = { members, order, moveLabels, pick, update, draw, drawOverlay, moves };
})();
