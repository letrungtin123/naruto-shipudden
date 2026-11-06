/* Pixel art pilot: Naruto and Sasuke drawn on a real pixel grid, plus pixel Rasengan and Chidori.
 * Press L in game to cycle the art style: original painted look, this pixel look, the anime look of
 * anime-vfx.js (saved in localStorage).
 *
 * Characters: each frame is built at 1 art pixel per canvas pixel from hand-placed head/torso grids
 * and limbs posed per frame, every layer gets its own dark outline (so the arm in front of the body
 * reads as a separate shape), then the frame is cached and drawn at PX screen pixels per art pixel
 * with smoothing off. Effects are painted the same way into a small buffer and blown up.
 *
 * Overrides AnimeSprites.draw for the ids in CHARS and NinjaVFX.draw for the Rasengan and Chidori
 * pieces; everything else falls through to the painted originals. */
(() => {
  'use strict';
  const S = window.AnimeSprites;
  if (!S) return;
  const STORE = 'shinobi.pixel.v1';
  const PX = 2;                       // screen pixels per art pixel
  const W = 36, H = 46, AX = 18, AY = 44; // frame size and the feet anchor, in art pixels
  // Art style switch shared with anime-vfx.js: 'og' (the painted originals), 'pixel', 'anime'. L cycles it.
  const ArtStyle = window.ArtStyle = window.ArtStyle || (() => {
    const KEY = 'shinobi.style.v1', LIST = ['og', 'pixel', 'anime'];
    let cur = 'og';
    try {
      const v = localStorage.getItem(KEY);
      if (LIST.includes(v)) cur = v; else if (localStorage.getItem(STORE) === '1') cur = 'pixel';
      const m = /[?&]style=(\w+)/.exec(location.search);
      if (m && LIST.includes(m[1])) cur = m[1];
    } catch (e) { /* private mode */ }
    return {
      LIST, get: () => cur,
      set(v) { if (!LIST.includes(v)) return; cur = v; try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } },
      next() { this.set(LIST[(LIST.indexOf(cur) + 1) % LIST.length]); return cur; }
    };
  })();
  const isOn = () => ArtStyle.get() === 'pixel';

  // ---------------------------------------------------------------- tiny pixel toolkit
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function put(g, x, y, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  // Bresenham line with a w×w square brush.
  function thick(g, x0, y0, x1, y1, w, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    g.fillStyle = col;
    const o = Math.floor((w - 1) / 2);
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      g.fillRect(x0 - o, y0 - o, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function stamp(g, grid, ox, oy, pal) {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const c = pal[row[x]];
        if (c) { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); }
      }
    }
  }
  // Selective outline: every empty pixel touching the shape takes a very dark version of that colour.
  function outline(c, ink) {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const d = g.getImageData(0, 0, w, h), p = d.data, src = new Uint8ClampedArray(p);
    const [ir, ig, ib] = hex(ink);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3]) continue;
      let n = -1;
      if (x > 0 && src[i - 1]) n = i - 4;
      else if (x < w - 1 && src[i + 7]) n = i + 4;
      else if (y > 0 && src[i - w * 4 + 3]) n = i - w * 4;
      else if (y < h - 1 && src[i + w * 4 + 3]) n = i + w * 4;
      if (n < 0) continue;
      p[i] = ir * .7 + src[n] * .18; p[i + 1] = ig * .7 + src[n + 1] * .18; p[i + 2] = ib * .7 + src[n + 2] * .18; p[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }

  // ---------------------------------------------------------------- characters
  // Grids face right. '.' is empty; every other letter is a palette key.
  const NARUTO = {
    ink: '#2a1408',
    pal: {
      Y: '#ffd23c', y: '#e09a1c', h: '#fff4a0', B: '#232a44', M: '#c9d2e0', m: '#7d8698',
      S: '#fbd0a4', s: '#dd9a72', w: '#a2563a', K: '#22160e', E: '#2f74e8', W: '#ffffff', r: '#c0705a',
      O: '#ff8a1c', o: '#c85a10', D: '#26262e', d: '#121216', Z: '#fff0d6', N: '#2c3c78', n: '#1a2448', T: '#f2ece0'
    },
    head: [
      '......Y....Y......',
      '....YYY...YY..Y...',
      '..Y.YYYY.YYY.YY...',
      '..YYYYYYYYYYYYYy..',
      '.YYYhYYYYhhYYYYYY.',
      'YYYYhhYYYYYYYYYYYY',
      '.yYYYYYYYYYYYYYYYY',
      'yYYYYBBBBMMMMMMMBY',
      '.yYYYBBBBMmMMmMMBB',
      'yYYYYYSYSSYSSSYSY.',
      '..yYYSSSSSSSSSSSS.',
      '..yYSSSSSKKSSSKKS.',
      '.SsYSSSSSEWSSSEWS.',
      '.SsySSSSSEESSSEES.',
      '..SSSwwSSSSSSwSSw.',
      '...SSSSwwSSSSwrwS.',
      '....sSSSSSSSSSSS..',
      '......sSSSSSSs....'
    ],
    torso: [
      '..DdDDdD..',
      '.DDDDDDDDD',
      '.oDDDDDDDO',
      '.ooOOOZOOO',
      '.ooOOOZOOO',
      '.ooOOOZOOO',
      '.ooOOOZOOO',
      '.dDDDDDDDD',
      '.ooOOOOOOO',
      '.ooOOOOOOO'
    ],
    arm: { up: 'O', upB: 'o', lo: 'O', loB: 'o', hand: 'S', handB: 's' },
    leg: { th: 'O', thB: 'o', sh: 'O', shB: 'o', wrap: 'T', foot: 'N', footB: 'n' }
  };
  const SASUKE = {
    ink: '#0c0a14',
    pal: {
      H: '#2c2f52', h: '#1c1d36', j: '#5b66a8', S: '#f4dac6', s: '#d4a690', K: '#121018', R: '#e0202c', r: '#c88874',
      T: '#eceaf4', t: '#b4b0c8', P: '#8a5ed0', p: '#4e2c86', V: '#3c4274', v: '#272b4c', G: '#b4bacc', g: '#6a6e84', N: '#1c1b24', n: '#0e0d14'
    },
    headX: -11,
    head: [
      '....h.....HH........',
      '...hH..HHHHHHH......',
      '..hHHhHHHHHHHHHH....',
      'hhHHHHHHHjjHHHHHH...',
      '.hHHHHHHjHHHHHHHHH..',
      'hhHHHHHHHHHHHHHHHHH.',
      '.hHHHHHHHHHHHHHHHHHH',
      '..hHHHHHHHHSHHHHHHHH',
      '.hHHHHHHHSSSHSSHHHH.',
      '..hHHHHSSSSSSSSHSHH.',
      '....hHSSSSSSSSSSSHH.',
      '....hHSSSSKKSSSKKSH.',
      '....HSsSSSSRKSSSRKH.',
      '....HSsSSSSRRSSSRRH.',
      '.....SSSSSSSSSSSSSH.',
      '......SSSSSSSSSrSS..',
      '.......sSSSSSSSSS...',
      '........sSSSSSs.....'
    ],
    torso: [
      '..TTTTTTT.',
      '.TTTTSSTTT',
      '.tTTTSSTTT',
      '.tTTTTSTTT',
      '.tTTTTTTTT',
      '.tTTTTTTTT',
      '.PPPPPPPPP',
      'PpPPPpPPPp',
      '.vVVVVVVVV',
      '.vVVVVVVVV',
      '.vVVV.VVVV',
      '..VVV..VV.',
      '..VV....V.'
    ],
    arm: { up: 'T', upB: 't', lo: 'T', loB: 't', guard: 'V', hand: 'S', handB: 's' },
    leg: { th: 'V', thB: 'v', sh: 'V', shB: 'v', foot: 'N', footB: 'n' },
    sword: true
  };
  const CHARS = { naruto: NARUTO, sasuke: SASUKE };

  // Poses: angles in degrees from straight down, positive swings toward the facing side.
  // arm: [shoulder, elbow bend], leg: [hip, knee bend]; dx/bob shift the upper body.
  const POSES = {
    idle: { bA: [-12, 14], fA: [14, 20], bL: [-7, 0], fL: [9, 0], bob: 0, dx: 0 },
    idle1: { bA: [-10, 16], fA: [12, 24], bL: [-7, 0], fL: [9, 0], bob: 1, dx: 0 },
    attack: { bA: [-70, -10], fA: [92, 0], bL: [-34, -6], fL: [34, -14], bob: 1, dx: 2 },
    seal: { bA: [58, 70], fA: [40, 90], bL: [-9, 0], fL: [10, 0], bob: 0, dx: 0 },
    raise: { bA: [-30, 10], fA: [168, 0], bL: [-9, 0], fL: [10, 0], bob: 0, dx: 0 }
  };
  for (let i = 0; i < 8; i++) {
    const p = i / 8 * Math.PI * 2;
    const leg = q => [Math.round(40 * Math.sin(q)), -Math.round(18 + 42 * Math.max(0, Math.cos(q)))];
    // The ninja run: arms swept back, body leaning in.
    POSES['run' + i] = { bA: [-108 + 6 * Math.sin(p), 4], fA: [-96 - 6 * Math.sin(p), 8], fL: leg(p), bL: leg(p + Math.PI),
      bob: Math.abs(Math.sin(p)) > .6 ? 0 : 1, dx: 3 };
  }
  const RAD = Math.PI / 180;
  function limb(g, x, y, a1, a2, l1, l2, w, c1, c2) {
    const ex = x + Math.sin(a1 * RAD) * l1, ey = y + Math.cos(a1 * RAD) * l1;
    const a = (a1 + a2) * RAD, hx = ex + Math.sin(a) * l2, hy = ey + Math.cos(a) * l2;
    thick(g, x, y, ex, ey, w, c1);
    thick(g, ex, ey, hx, hy, w, c2);
    return [hx, hy, a];
  }
  function buildFrame(ch, frame) {
    const P = POSES[frame] || POSES.idle, pal = ch.pal, k = c => pal[c];
    const layers = [];
    const L = () => { const c = canvas(W, H); layers.push(c); return c.getContext('2d'); };
    const hipY = AY - 10 + P.bob, top = hipY - 9, cx = AX + P.dx;
    const legAt = (g, x, pose, back) => {
      const t = ch.leg;
      const [fx, fy] = limb(g, x, hipY, pose[0], pose[1], 5, 5, 3, k(back ? t.thB : t.th), k(back ? t.shB : t.sh));
      if (t.wrap && !back) thick(g, fx, fy - 2, fx, fy - 1, 3, k(t.wrap));
      g.fillStyle = k(back ? t.footB : t.foot);
      g.fillRect(Math.round(fx) - 1, Math.round(fy) + 1, 4, 2);
    };
    const armAt = (g, x, y, pose, back) => {
      const t = ch.arm;
      const [hx, hy, a] = limb(g, x, y, pose[0], pose[1], 4, 4, 2, k(back ? t.upB : t.up), k(back ? t.loB : t.lo));
      if (t.guard) thick(g, hx - Math.sin(a) * 2, hy - Math.cos(a) * 2, hx - Math.sin(a), hy - Math.cos(a), 2, k(t.guard));
      g.fillStyle = k(back ? t.handB : t.hand);
      g.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2);
    };
    // Back: far leg, far arm and Sasuke's sword. Then the near leg, the body, the head and the near arm.
    let g = L();
    if (ch.sword) { thick(g, cx - 8, top + 13, cx + 3, top - 4, 2, pal.g); thick(g, cx + 1, top - 1, cx + 4, top - 6, 2, pal.G); }
    legAt(g, cx - 2, P.bL, true);
    armAt(g, cx - 3, top + 2, P.bA, true);
    const sweptBack = P.fA[0] < -40;
    if (sweptBack) { g = L(); armAt(g, cx + 2, top + 2, P.fA, false); }
    g = L(); legAt(g, cx + 1, P.fL, false);
    g = L(); stamp(g, ch.torso, cx - 5, top, pal);
    g = L(); stamp(g, ch.head, cx + (ch.headX || -9) + (P.dx > 0 ? 1 : 0), top - 17, pal);
    if (!sweptBack) { g = L(); armAt(g, cx + 3, top + 2, P.fA, false); }
    const out = canvas(W, H), og = out.getContext('2d');
    for (const c of layers) { outline(c, ch.ink); og.drawImage(c, 0, 0); }
    const mir = canvas(W, H), mg = mir.getContext('2d');
    mg.translate(W, 0); mg.scale(-1, 1); mg.drawImage(out, 0, 0);
    return [out, mir];
  }
  const cache = new Map();
  function frameCanvas(id, frame, flip) {
    const key = id + '|' + frame;
    let e = cache.get(key);
    if (!e) { e = buildFrame(CHARS[id], frame); cache.set(key, e); }
    return e[flip ? 1 : 0];
  }
  function frameOf(opts, x) {
    const f = opts.frame || 'idle';
    if (f === 'run') return 'run' + (((Math.floor((opts.phase || 0) * 2) % 8) + 8) % 8);
    if (f === 'idle') {
      const t = opts.phase !== undefined ? opts.phase * .25 : performance.now() / 900 + x * .013;
      return (((Math.floor(t) % 2) + 2) % 2) ? 'idle1' : 'idle';
    }
    return POSES[f] ? f : 'idle';
  }
  function drawPixel(ctx, id, x, y, opts) {
    const c = frameCanvas(id, frameOf(opts, x), (opts.facing || 1) < 0);
    const k = (opts.scale || 1) * PX;
    const dx = Math.round(x - AX * k), dy = Math.round(y - AY * k + (opts.yOffset || 0));
    const alpha = opts.alpha === undefined ? 1 : opts.alpha;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(c, dx, dy, W * k, H * k);
    if (opts.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * Math.min(1, opts.flash);
      ctx.drawImage(c, dx, dy, W * k, H * k);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (alpha < 1 || opts.flash > 0) ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = smooth;
    return opts.scale || 1;
  }
  const origDraw = S.draw;
  S.draw = function (ctx, id, x, y, opts = {}) {
    if (isOn() && CHARS[id]) return drawPixel(ctx, id, x, y, opts);
    return origDraw.call(this, ctx, id, x, y, opts);
  };

  // ---------------------------------------------------------------- effects
  // A shared low-res buffer: paint art pixels with plot(), then blit() blows it up onto the world.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const fx = { c: canvas(8, 8), g: null, ox: 0, oy: 0, w: 0, h: 0 };
  function begin(x0, y0, x1, y1) {
    // Snap the buffer to the world pixel grid so every effect shares one grid.
    fx.ox = Math.floor(x0 / PX) * PX; fx.oy = Math.floor(y0 / PX) * PX;
    fx.w = Math.ceil((x1 - fx.ox) / PX) + 1; fx.h = Math.ceil((y1 - fx.oy) / PX) + 1;
    if (fx.c.width < fx.w || fx.c.height < fx.h) { fx.c.width = Math.max(fx.c.width, fx.w); fx.c.height = Math.max(fx.c.height, fx.h); fx.g = null; }
    fx.g = fx.g || fx.c.getContext('2d');
    fx.g.clearRect(0, 0, fx.w, fx.h);
    return fx.g;
  }
  // World point to buffer pixel.
  const bx = x => Math.round((x - fx.ox) / PX), by = y => Math.round((y - fx.oy) / PX);
  // Dithered plot: draws only when the Bayer threshold at that pixel is under `a` (pixel-art fade).
  function plot(px, py, col, a = 1) {
    if (px < 0 || py < 0 || px >= fx.w || py >= fx.h) return;
    if (a < 1 && BAYER[(py & 3) * 4 + (px & 3)] > a) return;
    fx.g.fillStyle = col; fx.g.fillRect(px, py, 1, 1);
  }
  function blit(ctx, add) {
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (add) ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(fx.c, 0, 0, fx.w, fx.h, fx.ox, fx.oy, fx.w * PX, fx.h * PX);
    if (add) ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = smooth;
  }
  function seg(x0, y0, x1, y1, col, a = 1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (let n = 0; n < 400; n++) {
      plot(x0, y0, col, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const RAS = ['#ffffff', '#d6fbff', '#7ce4ff', '#33a8ff', '#1a5ce0', '#16308a'];

  // The Rasengan sphere: a white core, cyan bands spiralling round it and a ragged blue rim.
  function orb(cx, cy, R, t, a = 1) {
    const r2 = (R + 1) * (R + 1);
    for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
      const d2 = x * x + y * y;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2) / R, th = Math.atan2(y, x);
      const sw = Math.sin(th * 3 - d * 7 + t * 16);
      let c;
      if (d < .32) c = 0;
      else if (d < .55) c = sw > .2 ? 1 : 2;
      else if (d < .82) c = sw > .45 ? 1 : sw > -.3 ? 2 : 3;
      else if (d <= 1) c = sw > .1 ? 3 : 4;
      else { if (sw < .5) continue; c = 5; }
      plot(cx + x, cy + y, RAS[c], a);
    }
    // Wind streaks orbiting just outside.
    for (let i = 0; i < 3; i++) {
      const base = t * 11 + i * 2.09;
      for (let s = 0; s < 6; s++) {
        const th = base + s * .14, rr = R + 2 + (s > 3 ? 1 : 0);
        plot(Math.round(cx + Math.cos(th) * rr), Math.round(cy + Math.sin(th) * rr * .8), s < 2 ? RAS[1] : RAS[2], a);
      }
    }
  }
  function drawCharge(ctx, state, t) {
    const ch = state.charge, p = state.player;
    const ratio = Math.min(1, ch.ratio || 0), ang = p.angle || 0;
    const hand = state.hand || { x: p.x + Math.cos(ang) * 16, y: p.y - 20 };
    const Rw = Math.max(9, (ch.radius || 16) * .42) * (.75 + ratio * .5);
    const x = hand.x + Math.cos(ang) * Rw * .9, y = hand.y + Math.sin(ang) * Rw * .5;
    const ring = 30 + ratio * 46;
    begin(Math.min(x - Rw, p.x - ring) - 8, Math.min(y - Rw, p.y - ring * .5) - 8, Math.max(x + Rw, p.x + ring) + 8, Math.max(y + Rw, p.y + ring * .5) + 8);
    // A dashed chakra ring turning round the feet.
    const rr = ring / PX, n = Math.round(rr * 5);
    for (let i = 0; i < n; i++) {
      const th = i / n * Math.PI * 2 + t * 4;
      if ((i + Math.floor(t * 20)) % 5 > 2) continue;
      plot(bx(p.x) + Math.round(Math.cos(th) * rr), by(p.y) + Math.round(Math.sin(th) * rr * .45), RAS[i % 3 === 0 ? 1 : 3], .4 + ratio * .5);
    }
    orb(bx(x), by(y), Math.max(4, Math.round(Rw / PX)), t, 1);
    blit(ctx);
  }
  // Rasengan hit: the sphere grinds into the ground as a spinning disc, then bursts into a ring and chips.
  function drawVortex(ctx, v, t) {
    const life = Math.max(0, v.life / (v.maxLife || 1));
    if (life <= 0) return;
    const age = 1 - life, R = Math.max(16, v.radius || 64);
    begin(v.x - R * 1.2, v.y - R * .8, v.x + R * 1.2, v.y + R * .8);
    const cx = bx(v.x), cy = by(v.y), r = R / PX * (.55 + age * .5);
    for (let arm = 0; arm < 4; arm++) {
      for (let s = 0; s < 40; s++) {
        const f = s / 40, th = arm * Math.PI / 2 + f * 4.2 - t * 9;
        const rad = r * f;
        const col = f < .25 ? RAS[0] : f < .55 ? RAS[1] : f < .8 ? RAS[2] : RAS[3];
        plot(Math.round(cx + Math.cos(th) * rad), Math.round(cy + Math.sin(th) * rad * .5), col, life * 1.3);
        plot(Math.round(cx + Math.cos(th) * rad), Math.round(cy + Math.sin(th) * rad * .5) + 1, RAS[4], life);
      }
    }
    if (age < .45) orb(cx, cy - Math.round(4 * (1 - age)), Math.max(3, Math.round(r * .32 * (1 - age))), t, 1);
    blit(ctx);
  }
  function drawBurst(ctx, e, t, bolt) {
    const life = Math.max(0, e.life / (e.maxLife || 1));
    if (life <= 0) return;
    const age = 1 - life, R = Math.max(8, e.radius || 40);
    begin(e.x - R * 1.3, e.y - R * 1.1, e.x + R * 1.3, e.y + R * .8);
    const cx = bx(e.x), cy = by(e.y), rr = R / PX * (.35 + age * .8), n = Math.round(rr * 6);
    // Expanding ground ring, dashed and dithering away.
    for (let i = 0; i < n; i++) {
      const th = i / n * Math.PI * 2;
      if (i % 4 === 3) continue;
      plot(Math.round(cx + Math.cos(th) * rr), Math.round(cy + Math.sin(th) * rr * .5), bolt ? '#bff6ff' : RAS[1], life);
      plot(Math.round(cx + Math.cos(th) * (rr - 1)), Math.round(cy + Math.sin(th) * (rr - 1) * .5), bolt ? '#3aa8ff' : RAS[3], life);
    }
    // Chips of earth thrown out, falling back.
    const seed = Math.floor(e.x * .37 + e.y * .11);
    for (let i = 0; i < 10; i++) {
      const th = hash(seed + i) * Math.PI * 2, sp = (.5 + hash(seed + i * 3) * .7) * R / PX;
      const x = cx + Math.round(Math.cos(th) * sp * age * 1.1), y = cy + Math.round(Math.sin(th) * sp * age * .5 - Math.sin(age * Math.PI) * 6);
      plot(x, y, '#8a6a48', life * 1.5); plot(x + 1, y, '#5a4430', life * 1.5);
    }
    if (bolt) {
      // Chidori: forked bolts snapping out from the centre, re-drawn 20 times a second.
      const tick = Math.floor(t * 20);
      for (let b = 0; b < 6; b++) {
        let x = cx, y = cy - 6;
        const th = b / 6 * Math.PI * 2 + hash(tick + b) * .8, len = rr * (.7 + hash(tick * 3 + b) * .6);
        for (let s = 1; s <= 5; s++) {
          const f = s / 5, j = (hash(tick * 7 + b * 13 + s) - .5) * 6;
          const nx = Math.round(cx + Math.cos(th) * len * f - Math.sin(th) * j), ny = Math.round(cy - 6 + Math.sin(th) * len * f * .7 + Math.cos(th) * j);
          seg(x, y, nx, ny, '#3aa8ff', life * 1.2); seg(x, y - 1, nx, ny - 1, '#ffffff', life * 1.2);
          x = nx; y = ny;
        }
      }
    } else if (age < .3) orb(cx, cy - 4, Math.max(3, Math.round(R / PX * .25)), t, 1);
    blit(ctx);
  }
  // Chidori dash trail: a jagged bolt along the path, white core in a blue sheath, plus side forks.
  function drawTrail(ctx, tr, t) {
    const life = Math.max(0, tr.life / (tr.maxLife || 1));
    if (life <= 0) return;
    const lift = 22;
    begin(Math.min(tr.x1, tr.x2) - 30, Math.min(tr.y1, tr.y2) - lift - 30, Math.max(tr.x1, tr.x2) + 30, Math.max(tr.y1, tr.y2) + 10);
    const x1 = bx(tr.x1), y1 = by(tr.y1 - lift), x2 = bx(tr.x2), y2 = by(tr.y2 - lift);
    const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / (L || 1), ny = (x2 - x1) / (L || 1);
    const n = Math.max(3, Math.round(L / 6)), tick = Math.floor(t * 24);
    // Two bolts (main and a thinner twin), each a dark-blue sheath, a cyan body and a white core,
    // with forks branching off. Jitter re-rolls 24 times a second so the bolt crackles.
    for (let bolt = 0; bolt < 2; bolt++) {
      const pts = [[x1, y1]], amp = bolt ? 10 : 7;
      for (let i = 1; i <= n; i++) {
        const f = i / n, j = i === n ? 0 : (hash(tick * 11 + i + bolt * 97) - .5) * amp;
        pts.push([Math.round(x1 + (x2 - x1) * f + nx * j), Math.round(y1 + (y2 - y1) * f + ny * j)]);
      }
      const a = bolt ? life * .8 : life * 1.4;
      const layers = bolt ? [[1, '#2e8cff'], [0, '#bff6ff']] : [[2, '#1e4cc8'], [1, '#4cc4ff'], [0, '#ffffff']];
      for (const [w, col] of layers) for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [qx, qy] = pts[i];
        for (let o = -w; o <= w; o++) seg(ax, ay + o, qx, qy + o, col, a);
        if (w) for (let o = -w; o <= w; o++) seg(ax + o, ay, qx + o, qy, col, a);
      }
      if (!bolt) for (let i = 2; i < pts.length; i += 2) {
        const [qx, qy] = pts[i], s = hash(tick + i) < .5 ? 1 : -1, len = 5 + hash(tick * 5 + i) * 6;
        const fx1 = qx + Math.round(nx * len * s * .7 + (x2 - x1) / n * .6), fy1 = qy + Math.round(ny * len * s * .7 + (y2 - y1) / n * .6);
        seg(qx, qy, fx1, fy1, '#7cdcff', life); seg(fx1, fy1, fx1 + Math.round(nx * 3 * s), fy1 + Math.round(ny * 3 * s) + 1, '#ffffff', life);
      }
    }
    blit(ctx);
  }

  function hookVfx() {
    const V = window.NinjaVFX;
    if (!V || V.__pixel) return;
    const origVfx = V.draw;
    V.draw = function (ctx, state) {
      if (!isOn() || !ctx || !state) return origVfx.call(this, ctx, state);
      const t = Number.isFinite(state.elapsed) ? state.elapsed : 0;
      const ex = state.explosions || [], keep = [], mine = [];
      for (const e of ex) (e && (e.kind === 'vortex' || e.kind === 'lightning') ? mine : keep).push(e);
      const rasCharge = state.charge && state.charge.kind === 'rasengan' && state.player;
      origVfx.call(this, ctx, Object.assign({}, state, { explosions: keep, vortices: [], trails: [], charge: rasCharge ? null : state.charge }));
      for (const v of state.vortices || []) if (v) drawVortex(ctx, v, t);
      for (const e of mine) drawBurst(ctx, e, t, e.kind === 'lightning');
      for (const tr of state.trails || []) if (tr) drawTrail(ctx, tr, t);
      if (rasCharge) drawCharge(ctx, state, t);
    };
    V.__pixel = true;
  }
  hookVfx();
  addEventListener('load', hookVfx);

  // ---------------------------------------------------------------- toggle (L)
  let badge = null, badgeTimer = 0;
  function showBadge() {
    if (!badge) {
      badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:60;padding:5px 9px;font:800 11px/1 system-ui,sans-serif;letter-spacing:.06em;color:#fff4e2;background:rgba(18,13,10,.82);border:2px solid #ffb43c;pointer-events:none;image-rendering:pixelated';
      document.body.appendChild(badge);
    }
    const st = ArtStyle.get();
    badge.textContent = 'ĐỒ HOẠ: ' + (st === 'pixel' ? 'PIXEL ART (THỬ)' : st === 'anime' ? 'ANIME (THỬ)' : 'GỐC') + ' · L ĐỔI';
    badge.style.display = 'block';
    clearTimeout(badgeTimer); badgeTimer = setTimeout(() => { badge.style.display = 'none'; }, 1600);
  }
  // set(true/false) for the pixel look, or set('og' | 'pixel' | 'anime').
  function setOn(v) {
    ArtStyle.set(typeof v === 'string' ? v : v ? 'pixel' : 'og');
    showBadge();
  }
  addEventListener('keydown', e => {
    if (e.code !== 'KeyL' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    ArtStyle.next(); showBadge();
  });

  window.PixelArt = {
    get on() { return isOn(); }, set: setOn, CHARS, POSES, W, H, AX, AY, PX,
    frame: (id, frame, flip) => frameCanvas(id, frame, flip)
  };
})();
