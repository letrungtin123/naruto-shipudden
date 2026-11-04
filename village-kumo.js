/* village-kumo.js — Kumogakure, the Hidden Cloud Village of the Land of Lightning.
   White drum towers with slate-blue domes perched among charcoal rock spires above the clouds,
   in the same 3/4 oblique cel-shaded style as konoha-world.js. Original procedural Canvas 2D art.
   Exposes window.ShinobiVillages.kumo (local coords: the village is the square [0,5200]²). */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, N = 10, SIZE = BLOCK * N;
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const OUT = '#2f2a33';
  const PADL = 40, PADR = 64, PADT = 112, PADB = 44;   // building canvases overhang their footprint by this much
  const GATE_X = 2600;
  const PLAZA = { x: 2450, y: 2330, rx: 400, ry: 262 };
  const SPAWN = { x: 2560, y: 2430 };

  // One letter per 520px cell: S = rock spire (solid), K = Raikage tower, G = gate pillar, a..h = house variants.
  // r / m / n = variants a / h / g perched on their own rock pedestal.
  const MAP = [
    '..rS.bS.cS',
    '.d.e..f.S.',
    'b.S.nh.d..',
    '.c.fKe.n.S',
    'S.r....c..',
    '.e.m.dg.bS',
    'r.S.c..S..',
    '.m.d.ebS..',
    'S.b.m..c..',
    '.r.SGGS.e.',
  ];
  const VSIZE = { a: [200, 230], b: [320, 240], c: [300, 220], d: [260, 250], e: [300, 220], f: [280, 200], g: [220, 180], h: [240, 240],
    r: [280, 350], m: [300, 330], n: [280, 300],
    K: [400, 400], S0: [300, 320], S1: [320, 300], S2: [280, 330], S3: [320, 310] };
  // Decorative paved ways (all lie on the 120px+ lanes between footprints).
  const PATHS = [
    { x: 2520, y: 2520, w: 160, h: 2680 },   // gate avenue: south edge -> plaza
    { x: 560, y: 2550, w: 4080, h: 100 },    // east-west avenue
    { x: 990, y: 560, w: 100, h: 4080 },     // west ring
    { x: 4110, y: 560, w: 100, h: 4080 },    // east ring
    { x: 990, y: 990, w: 3220, h: 100 },     // north ring
    { x: 990, y: 4110, w: 3220, h: 100 },    // south ring
    { x: 2550, y: 1090, w: 100, h: 1110 },   // north spur to the plaza
  ];
  const STEPS = [{ x: 2520, y: 3470, w: 160 }, { x: 2520, y: 4380, w: 160 }, { x: 2550, y: 1420, w: 100 }, { x: 990, y: 1800, w: 100 }, { x: 4110, y: 3300, w: 100 }];

  // ------------------------------------------------------------------ utils
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); c.getContext('2d', { willReadFrequently: true }); return c; };
  function rng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function mix(a, b, t) { const A = rgbOf(a), B = rgbOf(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  // cool tone ramp: light toward white, shadows toward navy
  function ctone(base) { return { base, light: mix(base, '#ffffff', .36), hi: mix(base, '#ffffff', .62), dark: mix(base, '#25304a', .22), deep: mix(base, '#151b2e', .48) }; }

  // ------------------------------------------------------------------ palette
  const WHITE = ctone('#eceeea'), CREAM = ctone('#efe6d0'), STONE = ctone('#aeb2b4');
  const SLATE = ctone('#5d7d9e'), STEEL = ctone('#86a0b8'), NAVY = ctone('#3d5576'), PALE = ctone('#c3cfda');
  const ROCKP = { hi: '#bcc2c9', light: '#98a0aa', base: '#78808b', dark: '#5c626d', deep: '#464b55', top: '#a5acb4' };
  const GRASSK = { base: '#7b9c55', dark: '#5d7f40', light: '#a4c472', edge: '#506f37' };
  const YEL = '#f4d43c';
  const PALS = [{ W: WHITE, D: SLATE, B: NAVY, A: STEEL }, { W: CREAM, D: STEEL, B: SLATE, A: NAVY }];

  // ------------------------------------------------------------------ primitives
  function poly(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
  function fpoly(c, p, col) { poly(c, p); c.fillStyle = col; c.fill(); }
  function frect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function fell(c, x, y, rx, ry, col) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); c.fillStyle = col; c.fill(); }
  function sk(c, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
  function line(c, x1, y1, x2, y2, col, lw) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); sk(c, col, lw); }
  function srect(c, x, y, w, h, col = OUT, lw = 2) { c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function pathFrom(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; }
  function txt(c, s, x, y, size, col, o = {}) {
    c.font = `${o.weight || '700'} ${size}px ${o.font || MINCHO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 3; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function txtV(c, s, x, y, size, col) { [...s].forEach((ch, i) => txt(c, ch, x, y + size * .55 + i * size * 1.02, size, col)); }
  // Cel shading: base fill, light rim on the upper-left, dark rim on the lower-right (light from top-left).
  function celFill(c, path, base, light, dark, o = {}) {
    const ld = o.ld ?? 6, dd = o.dd ?? 8;
    c.save();
    c.fillStyle = base; c.fill(path);
    c.clip(path);
    if (light) { const p = new Path2D(); p.rect(-5000, -5000, 10000, 10000); p.addPath(path, new DOMMatrix([1, 0, 0, 1, ld, ld])); c.fillStyle = light; c.fill(p, 'evenodd'); }
    if (dark) { const p = new Path2D(); p.rect(-5000, -5000, 10000, 10000); p.addPath(path, new DOMMatrix([1, 0, 0, 1, -dd, -dd])); c.fillStyle = dark; c.fill(p, 'evenodd'); }
    c.restore();
  }
  function shadowE(c, x, y, rx, ry) { fell(c, x, y, rx, ry, 'rgba(26,34,56,.26)'); }
  function tuft(c, x, y, s, col = GRASSK.dark) { fpoly(c, [x - 4 * s, y, x - 2 * s, y - 6 * s, x - .5 * s, y, x + 1 * s, y - 8 * s, x + 2.5 * s, y, x + 4 * s, y - 5 * s, x + 5 * s, y], col); }
  // Kumogakure crest: a three-lobed cloud over a horizontal stroke.
  function kumoCrest(c, x, y, s, col, lw = .14) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-.86, .34);
    c.arc(-.54, .06, .36, Math.PI * .78, Math.PI * 1.7);
    c.arc(0, -.16, .5, Math.PI * 1.12, Math.PI * 1.88);
    c.arc(.54, .06, .36, Math.PI * 1.3, Math.PI * 2.22);
    c.closePath();
    c.moveTo(-.62, .6); c.lineTo(.62, .6);
    c.moveTo(-.2, .12); c.quadraticCurveTo(.05, -.18, .28, .1);
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
    c.restore();
  }
  function bolt(c, x, y, s, col = YEL) {
    const p = [.3, -1, -.5, .12, -.04, .12, -.34, 1, .52, -.26, .06, -.26].map((v, i) => i % 2 ? y + v * s : x + v * s);
    fpoly(c, p, col); poly(c, p); sk(c, '#5a4410', 1);
  }

  // ------------------------------------------------------------------ building parts
  function win(c, x, y, w, h, kind = 'glass') {
    frect(c, x - 2, y - 2, w + 4, h + 4, '#4b5664');
    if (kind === 'lit') { frect(c, x, y, w, h, '#ffe9a6'); frect(c, x, y, w, 3, 'rgba(160,110,30,.35)'); }
    else {
      frect(c, x, y, w, h, '#34485f');
      fpoly(c, [x + w * .12, y + h, x + w * .5, y, x + w * .72, y, x + w * .34, y + h], 'rgba(175,212,236,.45)');
      frect(c, x, y, w, 3, 'rgba(0,0,0,.3)');
    }
    if (w > 16) frect(c, x + w / 2 - 1, y, 2, h, '#4b5664');
    frect(c, x - 3, y + h + 2, w + 6, 3, '#9aa3ad');
  }
  function door(c, x, y, w, h, col = '#56708c') {
    frect(c, x - 3, y - 3, w + 6, h + 3, '#3a4350');
    frect(c, x, y, w, h, col);
    frect(c, x, y, 3, h, 'rgba(255,255,255,.22)');
    frect(c, x + w - 4, y, 4, h, 'rgba(0,0,0,.2)');
    frect(c, x + 4, y + 7, w - 8, 2, 'rgba(255,255,255,.2)');
    if (w > 26) line(c, x + w / 2, y, x + w / 2, y + h, '#3a4350', 2);
    fell(c, x + w - 7, y + h * .55, 1.8, 1.8, YEL);
  }
  function awning(c, x, y, w, h, R) {
    c.fillStyle = 'rgba(25,30,50,.25)'; c.fillRect(x + 4, y + h, w - 8, 6);
    frect(c, x, y, w, h, R.base); frect(c, x, y, w, 3, R.light); frect(c, x, y + h - 3, w, 3, R.deep);
    srect(c, x, y, w, h, OUT, 1.5);
  }
  function stepsAt(c, cx, y, w, n, sh = 6) {
    for (let i = 0; i < n; i++) {
      const ww = w + i * 8, yy = y + i * sh;
      frect(c, cx - ww / 2, yy, ww, sh, i % 2 ? '#c4c8ca' : '#ccd0d1');
      frect(c, cx - ww / 2, yy + sh - 2, ww, 2, '#868c92');
      line(c, cx - ww / 2, yy, cx - ww / 2, yy + sh, OUT, 1.2); line(c, cx + ww / 2, yy, cx + ww / 2, yy + sh, OUT, 1.2);
    }
    line(c, cx - (w + (n - 1) * 8) / 2, y + n * sh, cx + (w + (n - 1) * 8) / 2, y + n * sh, OUT, 1.5);
  }
  function antenna(c, x, y, h) {
    line(c, x + 1.5, y, x + 1.5, y - h, 'rgba(20,24,40,.35)', 2);
    line(c, x, y, x, y - h, '#3a4350', 2.2);
    line(c, x - 6, y - h * .55, x + 6, y - h * .55, '#3a4350', 1.5);
    line(c, x - 4, y - h * .8, x + 4, y - h * .8, '#3a4350', 1.3);
    fell(c, x, y - h, 2.4, 2.4, YEL);
    bolt(c, x, y - h - 7, 6);
  }
  function wallLamp(c, x, y) {
    line(c, x, y + 6, x, y - 2, '#3a4350', 2);
    frect(c, x - 4, y - 9, 8, 9, '#fff3c4'); srect(c, x - 4, y - 9, 8, 9, '#3a4350', 1.3);
    frect(c, x - 5, y - 11, 10, 3, '#3a4350');
  }
  function cylPath(cx, ty, rx, ry, h) {
    const p = new Path2D();
    p.moveTo(cx - rx, ty); p.lineTo(cx - rx, ty + h);
    p.ellipse(cx, ty + h, rx, ry, 0, Math.PI, 0, true);
    p.lineTo(cx + rx, ty);
    p.ellipse(cx, ty, rx, ry, 0, 0, Math.PI, false);
    p.closePath(); return p;
  }
  function cylinder(c, cx, ty, rx, h, T, o = {}) {
    const ry = rx * (o.k ?? .4), g = { cx, ty, rx, ry, h, by: ty + h };
    const p = cylPath(cx, ty, rx, ry, h);
    c.save();
    c.fillStyle = T.base; c.fill(p); c.clip(p);
    if (o.band) for (const [yo, bh, col] of o.band) {
      const y0 = ty + yo;
      c.beginPath(); c.ellipse(cx, y0, rx + 1, ry, 0, 0, Math.PI); c.lineTo(cx - rx - 1, y0 + bh);
      c.ellipse(cx, y0 + bh, rx + 1, ry, 0, Math.PI, 0, true); c.closePath(); c.fillStyle = col; c.fill();
    }
    if (o.paint) o.paint(c, g);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(cx - rx, ty - ry, rx * .36, h + ry * 2 + 2);
    c.fillStyle = 'rgba(30,40,72,.13)'; c.fillRect(cx + rx * .3, ty - ry, rx * .75, h + ry * 2 + 2);
    c.fillStyle = 'rgba(30,40,72,.17)'; c.fillRect(cx + rx * .72, ty - ry, rx * .35, h + ry * 2 + 2);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = o.lw || 2; c.stroke(p);
    return g;
  }
  function cylWindows(c, g, yo, n, ww, wh, kind = 'glass', span = 1.15, skip = 0, litEvery = 0) {
    for (let i = 0; i < n; i++) {
      const th = n === 1 ? 0 : -span + 2 * span * i / (n - 1);
      if (Math.abs(th) < skip) continue;
      const x = g.cx + g.rx * Math.sin(th), w = ww * Math.cos(th), y = g.ty + g.ry * Math.cos(th) + yo;
      win(c, x - w / 2, y, w, wh, litEvery && i % litEvery === 1 ? 'lit' : kind);
    }
  }
  function capFlat(c, g, R, top) {
    const { cx, ty, rx, ry } = g;
    fell(c, cx, ty, rx, ry, R.light);
    fell(c, cx, ty + 1, rx - 6, ry - 3, mix(top, '#1e2638', .25));
    c.save(); c.beginPath(); c.ellipse(cx, ty + 1, rx - 6, ry - 3, 0, 0, TAU); c.clip();
    fell(c, cx + 5, ty + 4, rx - 6, ry - 3, top); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, R.base, 3);
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, TAU); sk(c, OUT, 2);
  }
  // Railing around a flat roof edge (back half first, then front half).
  function ringRail(c, g, hgt = 10, inset = 3) {
    const cx = g.cx, ty = g.ty, rx = g.rx - inset, ry = g.ry - inset * .4;
    for (const [a0, a1, col] of [[Math.PI, TAU, '#6f7c8b'], [0, Math.PI, '#4a5664']]) {
      c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath();
      const n = Math.max(8, Math.round(rx / 7));
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = cx + Math.cos(a) * rx, y = ty + Math.sin(a) * ry; c.moveTo(x, y); c.lineTo(x, y - hgt); }
      c.stroke();
      c.beginPath(); c.ellipse(cx, ty - hgt, rx, ry, 0, a0, a1); sk(c, col, 2.4);
    }
  }
  // Ring balcony sticking out from a cylinder (front half only).
  function ringBalc(c, g, yo, ext = 15) {
    const cx = g.cx, y = g.ty + yo, rx = g.rx + ext, ry = g.ry * rx / g.rx;
    c.fillStyle = 'rgba(25,32,52,.22)';
    c.beginPath(); c.ellipse(cx, y + 9, rx - 4, ry, 0, 0, Math.PI); c.ellipse(cx, y + 2, g.rx, g.ry, 0, Math.PI, 0, true); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(cx, y, rx, ry, 0, 0, Math.PI); c.ellipse(cx, y, g.rx, g.ry, 0, Math.PI, 0, true); c.closePath();
    c.fillStyle = '#cdd2d6'; c.fill();
    c.beginPath(); c.ellipse(cx, y, rx, ry, 0, 0, Math.PI); c.lineTo(cx - rx, y + 6); c.ellipse(cx, y + 6, rx, ry, 0, Math.PI, 0, true); c.closePath();
    c.fillStyle = STEEL.dark; c.fill(); sk(c, OUT, 1.5);
    c.strokeStyle = '#4a5664'; c.lineWidth = 1.5; c.beginPath();
    const n = Math.max(8, Math.round(rx / 6));
    for (let i = 0; i <= n; i++) { const a = Math.PI * i / n, x = cx + Math.cos(a) * rx, yb = y + Math.sin(a) * ry; c.moveTo(x, yb); c.lineTo(x, yb - 13); }
    c.stroke();
    c.beginPath(); c.ellipse(cx, y - 13, rx, ry, 0, 0, Math.PI); sk(c, '#4a5664', 2.6);
    c.beginPath(); c.ellipse(cx, y - 14, rx, ry, 0, Math.PI * .55, Math.PI * .95); sk(c, 'rgba(255,255,255,.5)', 1);
  }
  function cone(c, cx, ty, rx, ry, h, R, ov = 6) {
    const ay = ty - h, L = cx - rx - ov, Rr = cx + rx + ov, ery = ry + ov * .4;
    const p = new Path2D(); p.moveTo(L, ty); p.lineTo(cx, ay); p.lineTo(Rr, ty); p.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); p.closePath();
    c.save(); c.fillStyle = R.base; c.fill(p); c.clip(p);
    fpoly(c, [L - 2, ty - 2, cx, ay, cx - rx * .22, ty + ery + 2, L - 2, ty + ery + 2], R.light);
    fpoly(c, [cx, ay, Rr + 2, ty - 2, Rr + 2, ty + ery + 2, cx + rx * .42, ty + ery + 2], R.dark);
    c.strokeStyle = 'rgba(20,28,48,.22)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = -7; i <= 7; i++) { const t = i / 7.5 * 1.45; c.moveTo(cx, ay); c.lineTo(cx + (rx + ov) * Math.sin(t), ty + ery * Math.cos(t)); }
    c.stroke(); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); sk(c, R.deep, 4);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    return ay;
  }
  // Onion-free Kumo dome: cel-shaded half ellipsoid with meridian ribs and a rim band. Returns apex y.
  function dome(c, cx, ty, rx, ry, dh, R, o = {}) {
    const p = new Path2D(); p.moveTo(cx - rx, ty); p.ellipse(cx, ty, rx, dh, 0, Math.PI, TAU); p.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); p.closePath();
    celFill(c, p, R.base, R.light, R.dark, { ld: rx * .2, dd: rx * .3 });
    c.save(); c.clip(p);
    if (o.ribs) {
      c.strokeStyle = 'rgba(20,28,50,.26)'; c.lineWidth = 1.4; c.beginPath();
      for (let k = 1; k < o.ribs; k++) {
        const t = -Math.PI / 2 + Math.PI * k / o.ribs;
        for (let s = 0; s <= 10; s++) {
          const ph = Math.PI / 2 * s / 10, x = cx + rx * Math.cos(ph) * Math.sin(t), y = ty + ry * Math.cos(ph) * Math.cos(t) - dh * Math.sin(ph);
          if (!s) c.moveTo(x, y); else c.lineTo(x, y);
        }
      }
      c.stroke();
    }
    if (o.band !== false) {
      const bc = o.bandCol || R.deep;
      c.beginPath(); c.ellipse(cx, ty - dh * .12, rx, ry, 0, 0, Math.PI); sk(c, bc, 5);
      c.beginPath(); c.ellipse(cx, ty - dh * .12 - 3, rx, ry, 0, Math.PI * .55, Math.PI * .95); sk(c, 'rgba(255,255,255,.35)', 1.2);
    }
    fell(c, cx - rx * .38, ty - dh * .58, rx * .17, dh * .12, 'rgba(255,255,255,.42)');
    c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, R.deep, 3);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    return ty - dh;
  }
  function waterTank(c, cx, baseY, r, h, T) {
    const ry = r * .4;
    shadowE(c, cx + 6, baseY + 1, r * 1.05, ry * .9);
    c.strokeStyle = '#3a4350'; c.lineWidth = 3; c.beginPath();
    c.moveTo(cx - r * .7, baseY); c.lineTo(cx - r * .7, baseY - 12); c.moveTo(cx + r * .7, baseY); c.lineTo(cx + r * .7, baseY - 12); c.stroke();
    const ty = baseY - 10 - h - ry;
    cylinder(c, cx, ty, r, h, T, { band: [[h * .3, 3, T.dark], [h * .68, 3, T.dark]] });
    cone(c, cx, ty, r, ry, r * .5, NAVY, 3);
  }
  function pipe(c, pts, w = 5, col = '#8995a2') {
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    sk(c, OUT, w + 3); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke();
    c.translate(-1, -1); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.2; c.stroke(); c.translate(1, 1);
  }

  // A rock column: faceted body (light left, dark right) with strata cracks and a flat grassy top.
  function rockMass(c, cx, baseY, bRx, topY, tRx, seed, o = {}) {
    const R = rng(seed), F = o.facets || 7, tRy = tRx * .38, bRy = bRx * .32;
    shadowE(c, cx + bRx * .35, baseY + bRy * .55, bRx * 1.1, bRy * 1.3);
    const bnd = [];
    for (let k = 0; k <= F; k++) {
      const a = Math.PI * (1 - k / F), edge = k === 0 || k === F;
      const tx = cx + tRx * Math.cos(a), ty = topY + tRy * Math.sin(a);
      const bx = cx + bRx * Math.cos(a) * (edge ? 1 : 1 + (R() - .5) * .1), by = baseY + bRy * Math.sin(a);
      const pts = [[tx, ty]];
      for (let q = 1; q <= 3; q++) { const t = q / 4; pts.push([tx + (bx - tx) * t + (R() - .5) * (edge ? 34 : 16), ty + (by - ty) * t + (R() - .5) * 8]); }
      pts.push([bx, by]);
      bnd.push(pts);
    }
    const tones = [ROCKP.light, ROCKP.light, ROCKP.base, ROCKP.base, ROCKP.dark, ROCKP.dark, ROCKP.deep];
    for (let f = 0; f < F; f++) {
      const p = pathFrom(bnd[f].concat(bnd[f + 1].slice().reverse()));
      const col = tones[Math.min(6, Math.floor((f + .5) / F * 7))];
      c.save(); c.fillStyle = col; c.fill(p); c.clip(p);
      const ys = []; for (let y = topY + 16 + R() * 14; y < baseY + bRy; y += 18 + R() * 20) ys.push([y, (R() - .5) * 12]);
      c.strokeStyle = 'rgba(24,26,36,.34)'; c.lineWidth = 1.7; c.beginPath();
      for (const [y, sl] of ys) { c.moveTo(cx - bRx - 10, y); c.lineTo(cx + bRx + 10, y + sl); }
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1.2; c.beginPath();
      for (const [y, sl] of ys) { c.moveTo(cx - bRx - 10, y + 2.5); c.lineTo(cx + bRx + 10, y + sl + 2.5); }
      c.stroke();
      const mx = (bnd[f][2][0] + bnd[f + 1][2][0]) / 2;
      c.strokeStyle = 'rgba(24,26,36,.18)'; c.lineWidth = 2; c.beginPath(); c.moveTo(mx + (R() - .5) * 8, topY + 10); c.lineTo(mx + (R() - .5) * 14, baseY); c.stroke();
      c.fillStyle = 'rgba(20,24,40,.16)'; c.fillRect(cx - bRx - 20, baseY - 10, bRx * 2 + 40, 60);
      c.restore();
      c.strokeStyle = 'rgba(24,26,36,.5)'; c.lineWidth = 1.2; c.stroke(p);
    }
    const sil = bnd[0].slice();
    for (let k = 1; k < F; k++) sil.push(bnd[k][4]);
    sil.push(...bnd[F].slice().reverse());
    for (let k = F - 1; k >= 1; k--) sil.push(bnd[k][0]);
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(pathFrom(sil));
    // flat top
    const tp = [];
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, j = 1 + (R() - .5) * .1; tp.push([cx + Math.cos(a) * tRx * 1.03 * j, topY + Math.sin(a) * tRy * j]); }
    const top = pathFrom(tp);
    celFill(c, top, ROCKP.top, ROCKP.hi, '#868d97', { ld: 5, dd: 6 });
    if (o.grass !== false) {
      c.save(); c.clip(top);
      for (let k = 0; k < 4; k++) {
        const gx = cx + (R() - .6) * tRx * .9, gy = topY + (R() - .6) * tRy * .8, r = tRx * (.22 + R() * .2);
        fell(c, gx, gy + 2, r + 2, r * .42 + 2, GRASSK.edge); fell(c, gx, gy, r, r * .42, GRASSK.base); fell(c, gx - r * .25, gy - r * .12, r * .5, r * .2, GRASSK.light);
      }
      for (let k = 0; k < 10; k++) tuft(c, cx + (R() - .5) * tRx * 1.4, topY + (R() - .3) * tRy * 1.2, .7 + R() * .4);
      c.restore();
    }
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(top);
    // talus at the foot
    for (let k = 0; k < (o.talus ?? 4); k++) {
      const a = .2 + R() * 2.7, x = cx + Math.cos(a) * bRx * 1.02, y = baseY + Math.sin(a) * bRy + 4, r = 6 + R() * 7;
      const p = new Path2D(); p.ellipse(x, y - r * .4, r, r * .7, 0, 0, TAU);
      celFill(c, p, ROCKP.base, ROCKP.hi, ROCKP.deep, { ld: 2.5, dd: 3 }); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(p);
    }
    for (let k = 0; k < 6; k++) tuft(c, cx + (R() - .5) * bRx * 2, baseY + bRy * (.5 + R() * .5) + 3, .8 + R() * .4, GRASSK.base);
    return { cx, topY, tRx, tRy };
  }

  // ------------------------------------------------------------------ building variants (drawn in footprint-local coords)
  // a: tall white drum tower, ring balcony, ribbed dome, lightning rod
  function vA(c, P, w, h) {
    const { W, D, B } = P, cx = 100, rx = 76, ry = rx * .4, by = h - 10 - ry, ty = by - 214;
    shadowE(c, cx + 34, by + 10, rx * 1.25, ry * 1.5);
    cylinder(c, cx, by - 12, rx + 9, 14, STONE);
    const g = cylinder(c, cx, ty, rx, by - 12 - ty, W, {
      band: [[0, 12, D.base], [12, 3, YEL], [96, 6, B.base], [160, 4, D.dark]],
      paint: (cc, gg) => { cylWindows(cc, gg, 28, 5, 14, 22, 'glass', 1.2, 0, 3); cylWindows(cc, gg, 112, 5, 14, 22, 'glass', 1.2); cylWindows(cc, gg, 150, 4, 12, 18, 'glass', 1.2, .4); }
    });
    ringBalc(c, g, 96, 15);
    const ay = dome(c, cx, ty, rx, ry, 54, D, { ribs: 8 });
    antenna(c, cx, ay, 16);
    const fb = by - 12 + ry;
    door(c, cx - 15, fb - 44, 30, 44); awning(c, cx - 24, fb - 54, 48, 9, B);
    wallLamp(c, cx - 30, fb - 30); P.lamps.push([cx - 30, fb - 36]);
    stepsAt(c, cx, fb + 1, 40, 3);
    P.anchors = { l: [cx - rx - 15, ty + 96], r: [cx + rx + 15, ty + 96] };
  }
  // b: tall slim tower behind a wide drum with a roof terrace, joined by a covered skybridge
  function vB(c, P, w, h) {
    const { W, D, B, A } = P;
    const lx = 78, lrx = 60, lry = lrx * .4, lby = h - 40 - lry, lty = lby - 200;
    const rx2 = 82, rcx = 232, rry = rx2 * .4, rby = h - 8 - rry, rty = rby - 12 - 106;
    shadowE(c, lx + 30, lby + 8, lrx * 1.2, lry * 1.5); shadowE(c, rcx + 34, rby + 10, rx2 * 1.2, rry * 1.5);
    cylinder(c, lx, lby - 12, lrx + 8, 14, STONE);
    const g = cylinder(c, lx, lty, lrx, lby - 12 - lty, W, {
      band: [[0, 10, D.base], [10, 3, YEL], [70, 5, B.base], [140, 5, B.base]],
      paint: (cc, gg) => { cylWindows(cc, gg, 26, 4, 13, 20); cylWindows(cc, gg, 92, 4, 13, 20, 'glass', 1.15, 0, 2); cylWindows(cc, gg, 154, 4, 12, 18); }
    });
    ringBalc(c, g, 70, 12);
    antenna(c, lx, dome(c, lx, lty, lrx, lry, 48, D, { ribs: 7 }), 16);
    // skybridge (box with windows) landing on the drum's roof terrace
    const sy = rty - 34;
    frect(c, lx + 30, sy - 8, 92, 8, A.light); frect(c, lx + 30, sy, 92, 26, W.base);
    for (let x = lx + 48; x < lx + 116; x += 20) win(c, x, sy + 6, 11, 12);
    frect(c, lx + 30, sy + 22, 92, 4, A.dark); srect(c, lx + 30, sy - 8, 92, 34, OUT, 1.6);
    cylinder(c, rcx, rby - 12, rx2 + 8, 14, STONE);
    const g2 = cylinder(c, rcx, rty, rx2, rby - 12 - rty, W, {
      band: [[0, 8, A.base], [8, 3, YEL], [62, 5, B.base]],
      paint: (cc, gg) => { cylWindows(cc, gg, 24, 6, 14, 22, 'glass', 1.25, 0, 4); cylWindows(cc, gg, 74, 6, 13, 20, 'glass', 1.25, .35); }
    });
    capFlat(c, g2, A, '#b9c1c8');
    ringRail(c, g2, 10, 4);
    waterTank(c, rcx + 34, rty + 6, 18, 22, PALE);
    antenna(c, rcx - 40, rty + 8, 46);
    const fb = rby - 12 + rry;
    door(c, rcx - 16, fb - 44, 32, 44); awning(c, rcx - 26, fb - 54, 52, 9, B);
    wallLamp(c, rcx + 30, fb - 30); P.lamps.push([rcx + 30, fb - 36]);
    stepsAt(c, rcx, fb + 1, 42, 3);
    P.anchors = { l: [lx - lrx - 12, lty + 70], r: [rcx + rx2, rty] };
  }
  // c: wide low drum hall with a shallow ribbed dome and a cupola
  function vC(c, P, w, h) {
    const { W, D, B } = P, cx = 150, rx = 134, ry = rx * .4, by = h - 8 - ry, ty = by - 12 - 84;
    shadowE(c, cx + 40, by + 12, rx * 1.15, ry * 1.4);
    cylinder(c, cx, by - 12, rx + 8, 14, STONE);
    const g = cylinder(c, cx, ty, rx, 84, W, {
      band: [[0, 10, B.base], [10, 3, YEL], [62, 4, D.dark]],
      paint: (cc, gg) => cylWindows(cc, gg, 26, 10, 14, 22, 'glass', 1.32, .22, 4)
    });
    const ay = dome(c, cx, ty, rx, ry, 72, D, { ribs: 12 });
    const cu = cylinder(c, cx, ay - 16, 26, 22, W, { paint: (cc, gg) => cylWindows(cc, gg, 6, 4, 7, 9, 'glass', 1.1) });
    antenna(c, cx, dome(c, cx, cu.ty, 26, 10.4, 18, B, { band: false }), 26);
    const fb = by - 12 + ry;
    door(c, cx - 22, fb - 46, 44, 46); awning(c, cx - 34, fb - 56, 68, 10, B);
    for (const lx of [cx - 46, cx + 46]) { wallLamp(c, lx, fb - 32); P.lamps.push([lx, fb - 38]); }
    stepsAt(c, cx, fb + 1, 54, 3);
    pipe(c, [[cx + rx - 30, ty + 40], [cx + rx - 30, fb - 30]], 4);
    P.anchors = { l: [cx - rx, ty + 20], r: [cx + rx, ty + 20] };
  }
  // d: drum tower standing on a rock pedestal, with a carved stone stairway
  function vD(c, P, w, h) {
    const { W, D, B } = P;
    const top = rockMass(c, 130, h - 8 - 40, 124, 100, 92, 4100 + P.seed, { grass: true, talus: 3 });
    const cx = 138, rx = 62, ry = rx * .4, by = top.topY + 6, ty = by - 128;
    shadowE(c, cx + 22, by + 4, rx * 1.1, ry * 1.2);
    const g = cylinder(c, cx, ty, rx, by - ty, W, {
      band: [[0, 10, D.base], [10, 3, YEL], [58, 5, B.base], [by - ty - 8, 8, '#9aa1a8']],
      paint: (cc, gg) => { cylWindows(cc, gg, 24, 4, 13, 20, 'glass', 1.15, 0, 2); cylWindows(cc, gg, 74, 4, 12, 18, 'glass', 1.15, .35); }
    });
    ringBalc(c, g, 58, 12);
    antenna(c, cx, dome(c, cx, ty, rx, ry, 42, D, { ribs: 7 }), 8);
    door(c, cx - 12, by + ry - 38, 24, 36);
    // stairway carved up the rock face (top step first so lower steps overlap it)
    const n = 12;
    for (let i = n - 1; i >= 0; i--) {
      const x = 46 + i * 5.6, y = h - 18 - i * 9.6;
      frect(c, x, y, 38, 5, '#d2d5d6'); frect(c, x, y + 5, 38, 5, '#8d939a');
      line(c, x, y, x + 38, y, 'rgba(255,255,255,.6)', 1);
      line(c, x + 38, y, x + 38, y + 10, OUT, 1.3);
    }
    c.beginPath(); c.moveTo(46, h - 8); c.lineTo(46 + (n - 1) * 5.6, h - 18 - (n - 1) * 9.6); sk(c, OUT, 1.6);
    line(c, 46 + 40, h - 8, 46 + 40 + (n - 1) * 5.6, h - 18 - (n - 1) * 9.6, '#4a5664', 2);
    P.anchors = { l: [cx - rx - 12, ty + 58], r: [cx + rx + 12, ty + 58] };
  }
  // e: two-storey white block with a round stair tower, roof tank and mast
  function vE(c, P, w, h) {
    const { W, D, B, A } = P;
    const tcx = 56, trx = 42, try_ = trx * .4, tby = h - 8 - 14 - try_, tty = tby - 178;
    shadowE(c, 200, h - 10, 120, 30); shadowE(c, tcx + 22, tby + 8, trx * 1.2, try_ * 1.5);
    const tg = cylinder(c, tcx, tty, trx, tby - tty, W, {
      band: [[0, 8, D.base], [8, 3, YEL], [100, 4, B.base]],
      paint: (cc, gg) => { for (let k = 0; k < 4; k++) cylWindows(cc, gg, 22 + k * 38, 1, 10, 18); }
    });
    antenna(c, tcx, cone(c, tcx, tty, trx, try_, 34, D, 5), 12);
    // main block
    const x0 = 90, x1 = 292, rT = 14, rB = 100, wB = h - 8;
    frect(c, x0, rT, x1 - x0, rB - rT, A.light);
    frect(c, x0 + 6, rT + 6, x1 - x0 - 12, rB - rT - 12, '#b8c0c6');
    c.fillStyle = 'rgba(30,36,56,.16)'; c.fillRect(x0 + 6, rT + 6, x1 - x0 - 12, 6); c.fillRect(x0 + 6, rT + 12, 6, rB - rT - 18);
    srect(c, x0 + 1, rT + 1, x1 - x0 - 2, rB - rT - 2, OUT, 2);
    waterTank(c, 250, 74, 22, 28, PALE);
    pipe(c, [[150, 92], [150, 56], [222, 56]], 4);
    antenna(c, 118, 60, 64);
    frect(c, x0, rB, x1 - x0, wB - rB, W.base);
    frect(c, x0, rB, x1 - x0, 12, D.base); frect(c, x0, rB + 12, x1 - x0, 3, YEL);
    frect(c, x0, rB + 56, x1 - x0, 5, B.base);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x0 + 2, rB + 15, 5, wB - rB - 15);
    c.fillStyle = 'rgba(30,40,72,.14)'; c.fillRect(x1 - 30, rB + 15, 30, wB - rB - 15);
    frect(c, x0, wB - 8, x1 - x0, 8, '#9aa1a8');
    for (const wx of [104, 148, 238]) { win(c, wx, rB + 24, 22, 22, wx === 148 ? 'lit' : 'glass'); win(c, wx, rB + 70, 22, 22); }
    win(c, 196, rB + 24, 22, 22);
    door(c, 190, wB - 50, 34, 42); awning(c, 182, wB - 60, 50, 9, B);
    wallLamp(c, 232, wB - 34); P.lamps.push([232, wB - 40]);
    pipe(c, [[282, rB + 16], [282, wB - 8]], 4);
    srect(c, x0 + 1, rB, x1 - x0 - 2, wB - rB, OUT, 2);
    P.anchors = { l: [tcx - trx, tty + 60], r: [x1, rB - 10] };
  }
  // f: cluster of white dome huts linked by pipes
  function hut(c, cx, by, rx, H, dh, P, doorOn) {
    const ry = rx * .4, ty = by - H;
    shadowE(c, cx + rx * .35, by + 6, rx * 1.15, ry * 1.4);
    cylinder(c, cx, ty, rx, H, P.W, { band: [[H - 8, 8, '#a3a9ae']], paint: (cc, gg) => cylWindows(cc, gg, 8, 3, 11, 14, 'glass', 1.05, doorOn ? .35 : 0) });
    const ay = dome(c, cx, ty, rx, ry, dh, P.W, { ribs: 0, bandCol: P.D.base });
    fell(c, cx, ay + dh * .12, rx * .3, rx * .12, P.D.base); c.beginPath(); c.ellipse(cx, ay + dh * .12, rx * .3, rx * .12, 0, 0, TAU); sk(c, OUT, 1.5);
    if (doorOn) door(c, cx - 12, by + ry - 36, 24, 34);
    return ay;
  }
  function vF(c, P, w, h) {
    const ay = hut(c, 150, 118, 74, 40, 62, P, false);
    antenna(c, 150, ay + 4, 40);
    pipe(c, [[96, 150], [96, 128], [118, 128]], 5);
    pipe(c, [[204, 150], [204, 132], [186, 132]], 5);
    hut(c, 70, 170, 58, 34, 48, P, true);
    hut(c, 222, 176, 50, 30, 42, P, true);
    wallLamp(c, 112, 178); P.lamps.push([112, 172]);
    P.anchors = { l: [12, 130], r: [272, 140] };
  }
  // g: small round house with a conical steel roof
  function vG(c, P, w, h) {
    const { W, D, B } = P, cx = 106, rx = 86, ry = rx * .4, by = h - 8 - ry, ty = by - 12 - 80;
    shadowE(c, cx + 36, by + 10, rx * 1.2, ry * 1.4);
    cylinder(c, cx, by - 12, rx + 8, 14, STONE);
    cylinder(c, cx, ty, rx, 80, W, { band: [[0, 8, B.base], [8, 3, YEL]], paint: (cc, gg) => cylWindows(cc, gg, 24, 6, 15, 22, 'glass', 1.25, .3, 3) });
    pipe(c, [[cx + 44, ty - 4], [cx + 44, ty - 60]], 7, '#7d8894');
    const ay = cone(c, cx, ty, rx, ry, 64, D, 8);
    antenna(c, cx, ay, 12);
    const fb = by - 12 + ry;
    door(c, cx - 15, fb - 44, 30, 44); awning(c, cx - 24, fb - 54, 48, 9, B);
    wallLamp(c, cx + 32, fb - 30); P.lamps.push([cx + 32, fb - 36]);
    stepsAt(c, cx, fb + 1, 40, 3);
    // stacked crates beside the house
    for (const [x, y, s] of [[184, h - 6, 22], [204, h - 4, 20], [192, h - 26, 18]]) {
      frect(c, x - s / 2, y - s, s, s, '#a07c55'); frect(c, x - s / 2, y - s, s, 4, '#c29a6c');
      line(c, x - s / 2, y - s, x + s / 2, y, '#6e5236', 1.3); srect(c, x - s / 2, y - s, s, s, OUT, 1.4);
    }
    P.anchors = { l: [cx - rx, ty + 30], r: [cx + rx, ty + 30] };
  }
  // h: slender minaret-like spire tower behind a domed drum
  function vH(c, P, w, h) {
    const { W, D, B, A } = P;
    const scx = 58, srx = 24, sry = srx * .4, sby = h - 62, sty = sby - 220;
    shadowE(c, scx + 24, sby + 6, srx * 1.6, sry * 2);
    const sg = cylinder(c, scx, sty, srx, 220, W, { band: [[0, 8, D.base], [8, 2, YEL], [120, 4, B.base]], paint: (cc, gg) => { for (let k = 0; k < 4; k++) cylWindows(cc, gg, 22 + k * 46, 1, 8, 14); } });
    ringBalc(c, sg, 62, 9); ringBalc(c, sg, 140, 9);
    antenna(c, scx, dome(c, scx, sty, srx, sry, 30, D, { ribs: 4 }), 18);
    const cx = 150, rx = 80, ry = rx * .4, by = h - 8 - ry, ty = by - 12 - 118;
    shadowE(c, cx + 34, by + 10, rx * 1.2, ry * 1.4);
    cylinder(c, cx, by - 12, rx + 8, 14, STONE);
    cylinder(c, cx, ty, rx, 118, W, {
      band: [[0, 10, A.base], [10, 3, YEL], [56, 5, B.base]],
      paint: (cc, gg) => { cylWindows(cc, gg, 22, 5, 14, 22, 'glass', 1.2, 0, 3); cylWindows(cc, gg, 72, 5, 13, 20, 'glass', 1.2, .35); }
    });
    const ay = dome(c, cx, ty, rx, ry, 56, D, { ribs: 9 });
    fell(c, cx, ay - 4, 6, 6, YEL); c.beginPath(); c.arc(cx, ay - 4, 6, 0, TAU); sk(c, OUT, 1.5);
    const fb = by - 12 + ry;
    door(c, cx - 15, fb - 44, 30, 44); awning(c, cx - 24, fb - 54, 48, 9, B);
    wallLamp(c, cx - 32, fb - 30); P.lamps.push([cx - 32, fb - 36]);
    stepsAt(c, cx, fb + 1, 40, 3);
    P.anchors = { l: [scx - srx - 9, sty + 62], r: [cx + rx, ty + 30] };
  }
  // K: the Raikage's tower — a huge white drum on a stone terrace, 雷 emblem, upper tier and great dome
  function lmRaikage(c, P) {
    const cx = 200;
    shadowE(c, cx + 46, 356, 214, 74);
    const T = cylinder(c, cx, 290, 192, 34, STONE, { band: [[0, 5, '#c8ccce'], [28, 6, '#7f858b']] });
    fell(c, cx, 290, 192, T.ry, '#c3c7c9');
    c.save(); c.beginPath(); c.ellipse(cx, 290, 192, T.ry, 0, 0, TAU); c.clip();
    c.strokeStyle = 'rgba(80,88,98,.35)'; c.lineWidth = 1; c.beginPath();
    for (let r = 30; r < 200; r += 26) c.ellipse(cx, 290, r, r * .4, 0, 0, TAU);
    c.stroke(); c.restore();
    c.beginPath(); c.ellipse(cx, 290, 192, T.ry, 0, 0, TAU); sk(c, OUT, 2);
    // main drum
    const g = cylinder(c, cx, 100, 172, 190, WHITE, {
      band: [[0, 16, SLATE.base], [16, 4, YEL], [20, 3, NAVY.dark], [118, 5, STEEL.base], [182, 8, '#9aa0a6']],
      paint: (cc, gg) => {
        cylWindows(cc, gg, 34, 14, 12, 22, 'glass', 1.38, .5, 5);
        cylWindows(cc, gg, 82, 12, 13, 24, 'glass', 1.34, .52);
        cylWindows(cc, gg, 134, 10, 13, 22, 'glass', 1.3, .5, 4);
      }
    });
    // pipes running down the drum
    for (const px of [cx - 150, cx + 150]) { const fy = 100 + g.ry * Math.cos(Math.asin(150 / 172)); pipe(c, [[px, fy + 6], [px, fy + 186]], 5); }
    // 雷 emblem
    const ey = 232;
    fell(c, cx, ey, 56, 56, NAVY.deep); fell(c, cx, ey, 50, 50, '#f8f7f1');
    c.beginPath(); c.arc(cx, ey, 44, 0, TAU); sk(c, SLATE.base, 3);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .2; bolt(c, cx + Math.cos(a) * 53, ey + Math.sin(a) * 53, 5); }
    txt(c, '雷', cx, ey + 3, 64, NAVY.deep, { weight: '900' });
    // entrance
    awning(c, cx - 48, 290, 96, 12, NAVY);
    door(c, cx - 30, 304, 60, 52, '#4e6784');
    for (const [bx, s] of [[cx - 70, '雷影'], [cx + 56, '雷影']]) {
      frect(c, bx, 300, 14, 50, '#f8f7f1'); srect(c, bx, 300, 14, 50, NAVY.base, 1.5);
      frect(c, bx, 300, 14, 4, NAVY.base); txtV(c, s, bx + 7, 306, 11, NAVY.deep);
    }
    for (const lx of [cx - 84, cx + 84]) { wallLamp(c, lx, 330); P.lamps.push([lx, 324]); }
    stepsAt(c, cx, 362, 100, 5, 7.6);
    // roof terrace, upper tier, dome, cupola
    capFlat(c, g, SLATE, '#b7bfc6');
    const g2 = cylinder(c, cx, 40, 118, 60, CREAM, {
      band: [[0, 8, NAVY.base], [8, 3, YEL], [52, 8, '#a3a9ae']],
      paint: (cc, gg) => cylWindows(cc, gg, 20, 12, 11, 20, 'glass', 1.35, 0, 3)
    });
    ringRail(c, g, 11, 5);
    const ay = dome(c, cx, g2.ty, 118, g2.ry, 84, SLATE, { ribs: 14 });
    const cu = cylinder(c, cx, ay - 16, 20, 18, WHITE, { paint: (cc, gg) => cylWindows(cc, gg, 5, 3, 6, 8, 'glass', 1) });
    antenna(c, cx, dome(c, cx, cu.ty, 20, 8, 14, NAVY, { band: false }), 14);
    for (const ax of [cx - 140, cx + 140]) antenna(c, ax, 116, 110);
    P.anchors = { l: [cx - 172, 160], r: [cx + 172, 160] };
  }
  // Rock spires (solid terrain)
  function sp0(c, P, w, h) {
    const t = rockMass(c, 150, h - 8 - 45, 140, -62, 88, 5101 + P.seed, { facets: 8 });
    P.anchors = { l: [t.cx - t.tRx, t.topY], r: [t.cx + t.tRx, t.topY] };
  }
  function sp1(c, P, w, h) {
    const t = rockMass(c, 160, h - 8 - 50, 156, -22, 104, 5202 + P.seed, { facets: 8 });
    const g = cylinder(c, t.cx + 6, t.topY - 38, 32, 34, WHITE, { band: [[0, 6, SLATE.base], [6, 2, YEL]], paint: (cc, gg) => cylWindows(cc, gg, 10, 3, 9, 12) });
    shadowE(c, t.cx + 30, t.topY + 2, 30, 8);
    antenna(c, g.cx, dome(c, g.cx, g.ty, 32, g.ry, 24, SLATE, { ribs: 5 }), 10);
    door(c, g.cx - 8, g.by + g.ry - 24, 16, 22);
    P.anchors = { l: [t.cx - t.tRx, t.topY], r: [t.cx + t.tRx, t.topY] };
  }
  function sp2(c, P, w, h) {
    rockMass(c, 96, h - 90, 86, -76, 52, 5303 + P.seed, { facets: 6, talus: 2 });
    const t = rockMass(c, 170, h - 8 - 32, 100, 10, 62, 5304 + P.seed, { facets: 7 });
    P.anchors = { l: [t.cx - t.tRx, t.topY], r: [t.cx + t.tRx, t.topY] };
  }
  // three needles of different heights
  function sp3(c, P, w, h) {
    rockMass(c, 200, h - 120, 70, -80, 40, 5401 + P.seed, { facets: 5, talus: 1 });
    rockMass(c, 96, h - 84, 78, -30, 48, 5402 + P.seed, { facets: 6, talus: 2 });
    const t = rockMass(c, 196, h - 8 - 30, 94, 60, 60, 5403 + P.seed, { facets: 7 });
    P.anchors = { l: [56, -10], r: [t.cx + t.tRx, t.topY] };
  }
  // a building standing on its own rock pedestal, reached by a carved stairway
  function onRock(v, rh) {
    return (c, P, w, h) => {
      const [bw, bh] = VSIZE[v], cx = w / 2, bRx = w / 2 - 6, bRy = bRx * .32, baseY = h - 8 - bRy, topY = baseY - rh, tRx = bw / 2 + 14, tRy = tRx * .38;
      rockMass(c, cx, baseY, bRx, topY, tRx, 6100 + P.seed + v.charCodeAt(0), { grass: false, talus: 3, facets: 8 });
      // carved stairway climbing the left face
      const x0 = cx - bRx * .72, y0 = baseY + bRy * .55, x1 = cx - tRx * .55, y1 = topY + tRy * .8, n = Math.max(4, Math.round((y0 - y1) / 10));
      for (let i = n - 1; i >= 0; i--) {
        const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 - (y0 - y1) * t;
        frect(c, x, y - 10, 34, 5, '#d2d5d6'); frect(c, x, y - 5, 34, 5, '#8d939a');
        line(c, x, y - 10, x + 34, y - 10, 'rgba(255,255,255,.6)', 1);
        line(c, x + 34, y - 10, x + 34, y, OUT, 1.3);
      }
      line(c, x0, y0, x1, y1 - 10, OUT, 1.6);
      line(c, x0 + 36, y0 - 10, x1 + 36, y1 - 20, '#4a5664', 2);
      const ox = cx - bw / 2, oy = topY + tRy * .72 - (bh - 3);
      const sub = { ...P, lamps: [], anchors: null };
      c.save(); c.translate(ox, oy); FN[v](c, sub, bw, bh); c.restore();
      for (const [lx, ly] of sub.lamps) P.lamps.push([lx + ox, ly + oy]);
      if (sub.anchors) P.anchors = { l: [sub.anchors.l[0] + ox, sub.anchors.l[1] + oy], r: [sub.anchors.r[0] + ox, sub.anchors.r[1] + oy] };
    };
  }
  const FN = { a: vA, b: vB, c: vC, d: vD, e: vE, f: vF, g: vG, h: vH, K: lmRaikage, S0: sp0, S1: sp1, S2: sp2, S3: sp3 };
  FN.r = onRock('a', 96); FN.m = onRock('h', 80); FN.n = onRock('g', 128);

  // ------------------------------------------------------------------ props
  function sprite(w, h, ax, ay, fn) { const cv = mk(w, h), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; fn(c, ax, ay); return { cv, ax, ay }; }
  function makeLampPost() {
    return sprite(30, 92, 13, 88, (c, ax, ay) => {
      shadowE(c, ax + 8, ay - 1, 10, 3.5);
      frect(c, ax - 7, ay - 9, 14, 9, '#a9aeb2'); frect(c, ax - 7, ay - 9, 14, 3, '#cfd3d5'); srect(c, ax - 7, ay - 9, 14, 9, OUT, 1.4);
      frect(c, ax - 2, ay - 66, 4, 58, '#46505c'); frect(c, ax - 2, ay - 66, 1.5, 58, '#7c8896');
      frect(c, ax - 8, ay - 82, 16, 15, '#fff4cc'); frect(c, ax + 3, ay - 82, 5, 15, 'rgba(200,150,60,.3)'); srect(c, ax - 8, ay - 82, 16, 15, '#3a4350', 1.6);
      line(c, ax, ay - 82, ax, ay - 67, '#3a4350', 1);
      fpoly(c, [ax - 11, ay - 82, ax, ay - 89, ax + 11, ay - 82], SLATE.base); poly(c, [ax - 11, ay - 82, ax, ay - 89, ax + 11, ay - 82]); sk(c, OUT, 1.4);
      frect(c, ax - 6, ay - 67, 12, 3, '#3a4350');
    });
  }
  function makeBoulder(r, seed) {
    const w = Math.ceil(r * 3), h = Math.ceil(r * 2.2);
    return sprite(w, h, Math.round(w * .42), h - 4, (c, ax, ay) => {
      const R = rng(seed);
      shadowE(c, ax + r * .4, ay - 1, r * 1.1, r * .32);
      const pts = []; for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI, d = r * (.85 + R() * .3); pts.push([ax + Math.cos(a) * d, ay - r * .2 + Math.sin(a) * d * .9]); }
      pts.push([ax + r, ay - 2], [ax - r, ay - 2]);
      const p = pathFrom(pts);
      celFill(c, p, ROCKP.base, ROCKP.hi, ROCKP.deep, { ld: r * .25, dd: r * .3 });
      c.save(); c.clip(p); line(c, ax - r * .3, ay - r * .9, ax + r * .1, ay - r * .2, 'rgba(24,26,36,.35)', 1.4); c.restore();
      c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(p);
      for (let k = 0; k < 3; k++) tuft(c, ax - r + R() * r * 2, ay, .8, GRASSK.base);
    });
  }
  // a low cluster of boulders (walk-through decor, kept under ~45px tall)
  function makeOutcrop(seed) {
    return sprite(130, 70, 60, 62, (c, ax, ay) => {
      const R = rng(seed), rocks = [];
      for (let i = 0; i < 4; i++) rocks.push([ax - 36 + i * 22 + (R() - .5) * 10, ay - 4 - R() * 14, 10 + R() * 12]);
      shadowE(c, ax + 14, ay, 58, 10);
      rocks.sort((a, b) => a[1] - b[1]);
      for (const [x, y, r] of rocks) {
        const pts = []; for (let i = 0; i < 8; i++) { const a = Math.PI + i / 7 * Math.PI, d = r * (.8 + R() * .35); pts.push([x + Math.cos(a) * d, y - r * .3 + Math.sin(a) * d * 1.05]); }
        pts.push([x + r, y], [x - r, y]);
        const p = pathFrom(pts);
        celFill(c, p, ROCKP.base, ROCKP.hi, ROCKP.deep, { ld: r * .25, dd: r * .3 });
        c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(p);
      }
      for (let k = 0; k < 6; k++) tuft(c, ax - 50 + R() * 100, ay + R() * 3, .8 + R() * .3, k % 2 ? GRASSK.base : GRASSK.dark);
    });
  }
  function makePine(seed) {
    return sprite(84, 96, 40, 92, (c, ax, ay) => {
      const R = rng(seed);
      shadowE(c, ax + 14, ay - 2, 26, 7);
      c.beginPath(); c.moveTo(ax - 4, ay); c.quadraticCurveTo(ax - 10, ay - 30, ax + 4, ay - 52); c.lineTo(ax + 9, ay - 50); c.quadraticCurveTo(ax - 2, ay - 30, ax + 5, ay); c.closePath();
      c.fillStyle = '#6b5442'; c.fill(); sk(c, OUT, 1.6);
      const pads = [[ax - 16, ay - 40, 20], [ax + 16, ay - 50, 18], [ax - 2, ay - 66, 22], [ax + 4, ay - 80, 13]];
      for (const [x, y, r] of pads) fell(c, x, y, r + 2.5, r * .5 + 2.5, '#1c3326');
      for (const [x, y, r] of pads) { fell(c, x, y, r, r * .5, '#2f5a3e'); fell(c, x - r * .15, y - r * .14, r * .78, r * .32, '#457a52'); fell(c, x - r * .35, y - r * .22, r * .35, r * .14, '#7fb07a'); }
      for (let k = 0; k < 6; k++) fell(c, ax - 20 + R() * 40, ay - 40 - R() * 40, 1.6, 1.2, '#a7d39a');
    });
  }
  function makeGrass() {
    return sprite(40, 22, 20, 18, (c, ax, ay) => {
      fell(c, ax, ay, 16, 4, 'rgba(60,90,40,.35)');
      for (let k = -2; k <= 2; k++) tuft(c, ax + k * 5, ay + Math.abs(k), 1 + (2 - Math.abs(k)) * .15, k % 2 ? GRASSK.dark : GRASSK.base);
      c.strokeStyle = GRASSK.light; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax - 3, ay); c.lineTo(ax - 1, ay - 7); c.moveTo(ax + 6, ay); c.lineTo(ax + 7, ay - 6); c.stroke();
    });
  }
  function makeCrates() {
    return sprite(56, 50, 26, 46, (c, ax, ay) => {
      shadowE(c, ax + 8, ay - 1, 26, 6);
      for (const [x, y, s] of [[ax - 12, ay, 22], [ax + 11, ay, 20], [ax - 2, ay - 22, 18]]) {
        frect(c, x - s / 2, y - s, s, s, '#a07c55'); frect(c, x - s / 2, y - s, s, 4, '#c29a6c'); frect(c, x + s / 2 - 4, y - s + 4, 4, s - 4, '#7f6142');
        line(c, x - s / 2, y - s + 4, x + s / 2, y, '#6e5236', 1.3); srect(c, x - s / 2, y - s, s, s, OUT, 1.4);
      }
    });
  }
  function makeGate() {
    // canvas covers local x 2120..3080, y 4960..5212: two solid wall wings ending in tall pillars, a beam and the 雲 plaque
    const cv = mk(960, 252), c = cv.getContext('2d'); c.lineJoin = 'round';
    const courses = (x0, y0, w, h, step) => {
      c.strokeStyle = 'rgba(50,56,66,.42)'; c.lineWidth = 1.3; c.beginPath();
      for (let y = y0 + step, r = 0; y < y0 + h; y += step, r++) { c.moveTo(x0, y); c.lineTo(x0 + w, y); }
      for (let y = y0, r = 0; y < y0 + h - 2; y += step, r++) for (let x = x0 + (r % 2 ? 14 : 30); x < x0 + w; x += 34) { c.moveTo(x, y); c.lineTo(x, Math.min(y0 + h, y + step)); }
      c.stroke();
    };
    const wing = (x0, w) => {
      shadowE(c, x0 + w / 2 + 24, 212, w / 2 + 10, 14);
      frect(c, x0, 140, w, 68, STONE.base); courses(x0, 148, w, 60, 15);
      frect(c, x0, 148, w, 5, 'rgba(30,40,72,.22)'); frect(c, x0, 200, w, 8, '#8d939a');
      srect(c, x0, 140, w, 68, OUT, 2);
      // blue tiled coping
      frect(c, x0 - 4, 130, w + 8, 14, SLATE.base); frect(c, x0 - 4, 130, w + 8, 4, SLATE.light); frect(c, x0 - 4, 141, w + 8, 3, SLATE.deep);
      c.strokeStyle = SLATE.dark; c.lineWidth = 1.5; c.beginPath(); for (let x = x0 + 4; x < x0 + w; x += 9) { c.moveTo(x, 134); c.lineTo(x, 141); } c.stroke();
      srect(c, x0 - 4, 130, w + 8, 14, OUT, 1.6);
    };
    const banner = x => {
      line(c, x - 14, 150, x + 14, 150, '#3a4350', 2.5);
      fpoly(c, [x - 11, 151, x + 11, 151, x + 11, 192, x, 186, x - 11, 192], NAVY.base);
      fpoly(c, [x + 5, 151, x + 11, 151, x + 11, 192, x + 5, 189], 'rgba(10,16,30,.25)');
      poly(c, [x - 11, 151, x + 11, 151, x + 11, 192, x, 186, x - 11, 192]); sk(c, OUT, 1.3);
      kumoCrest(c, x, 166, 8, '#f4f5f2', .2);
    };
    const pillar = x0 => {
      shadowE(c, x0 + 46, 210, 44, 12);
      frect(c, x0 - 4, 40, 64, 18, '#c3c7c9'); srect(c, x0 - 4, 40, 64, 18, OUT, 1.8);
      frect(c, x0, 58, 56, 150, STONE.base); courses(x0, 58, 56, 150, 19);
      frect(c, x0, 58, 8, 150, 'rgba(255,255,255,.3)'); frect(c, x0 + 40, 58, 16, 150, 'rgba(30,40,72,.2)');
      frect(c, x0 - 2, 196, 60, 12, '#8d939a'); srect(c, x0 - 2, 196, 60, 12, OUT, 1.4);
      srect(c, x0, 58, 56, 150, OUT, 2);
      fpoly(c, [x0 - 10, 42, x0 + 28, 22, x0 + 66, 42], SLATE.base); fpoly(c, [x0 + 28, 22, x0 + 66, 42, x0 + 28, 42], SLATE.dark);
      poly(c, [x0 - 10, 42, x0 + 28, 22, x0 + 66, 42]); sk(c, OUT, 1.8);
      bolt(c, x0 + 28, 13, 9);
    };
    wing(40, 280); wing(640, 280);
    for (const x of [120, 240, 720, 840]) banner(x);
    pillar(320); pillar(584);
    // beam
    frect(c, 376, 64, 208, 8, NAVY.light); frect(c, 376, 72, 208, 26, WHITE.base);
    frect(c, 376, 72, 208, 5, SLATE.base); frect(c, 376, 77, 208, 2, YEL); frect(c, 376, 91, 208, 7, '#9aa1a8');
    srect(c, 376, 64, 208, 34, OUT, 2);
    for (const x of [400, 560]) kumoCrest(c, x, 86, 9, NAVY.deep, .16);
    // hanging plaque
    line(c, 456, 98, 456, 106, '#3a4350', 2); line(c, 504, 98, 504, 106, '#3a4350', 2);
    frect(c, 446, 106, 68, 42, '#f8f7f1'); srect(c, 446, 106, 68, 42, NAVY.deep, 3);
    txt(c, '雲', 480, 128, 32, NAVY.deep, { weight: '900' });
    // hanging lanterns
    for (const x of [392, 568]) { line(c, x, 98, x, 120, '#3a4350', 1.5); frect(c, x - 7, 120, 14, 18, '#fff3c4'); srect(c, x - 7, 120, 14, 18, '#3a4350', 1.5); frect(c, x - 8, 118, 16, 3, '#3a4350'); }
    return cv;
  }

  // ------------------------------------------------------------------ ground
  function makeGround() {
    const S = 1040, cv = mk(S, S), c = cv.getContext('2d'), R = rng(9091);
    frect(c, 0, 0, S, S, '#a3a8ab');
    const wrap = (x, y, m, fn) => { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { if (x + ox < -m || x + ox > S + m || y + oy < -m || y + oy > S + m) continue; fn(x + ox, y + oy); } };
    const tonesG = ['#a8acae', '#9fa4a7', '#a6aaac', '#9da2a6', '#aaaeaf'];
    for (let i = 0; i < 70; i++) { const x = R() * S, y = R() * S, rx = 50 + R() * 110, ry = rx * (.45 + R() * .25), col = tonesG[i % 5]; wrap(x, y, rx, (X, Y) => fell(c, X, Y, rx, ry, col)); }
    for (let i = 0; i < 14; i++) { const x = R() * S, y = R() * S, rx = 90 + R() * 140, ry = rx * .5; wrap(x, y, rx, (X, Y) => fell(c, X, Y, rx, ry, 'rgba(80,88,100,.06)')); }
    // stone plates
    for (let i = 0; i < 34; i++) {
      const x = R() * S, y = R() * S, r = 26 + R() * 46, n = 6 + Math.floor(R() * 3), pts = [];
      for (let q = 0; q < n; q++) { const a = q / n * TAU + R() * .4, d = r * (.75 + R() * .35); pts.push(Math.cos(a) * d, Math.sin(a) * d * .6); }
      const col = R() < .5 ? '#adb1b3' : '#a0a5a8';
      wrap(x, y, r + 4, (X, Y) => {
        const p = pts.map((v, k) => k % 2 ? v + Y : v + X);
        fpoly(c, p.map((v, k) => v + (k % 2 ? 2.5 : 1)), 'rgba(60,66,76,.22)');
        fpoly(c, p, col); poly(c, p); sk(c, 'rgba(70,76,86,.22)', 1);
      });
    }
    // cracks
    for (let i = 0; i < 90; i++) {
      let x = R() * S, y = R() * S, a = R() * TAU; const segs = [[x, y]];
      for (let q = 0; q < 4; q++) { a += (R() - .5) * 1.2; const l = 14 + R() * 30; x += Math.cos(a) * l; y += Math.sin(a) * l * .7; segs.push([x, y]); }
      wrap(segs[0][0], segs[0][1], 140, (X, Y) => {
        const dx = X - segs[0][0], dy = Y - segs[0][1];
        c.beginPath(); segs.forEach(([px, py], k) => k ? c.lineTo(px + dx + 1, py + dy + 1.6) : c.moveTo(px + dx + 1, py + dy + 1.6)); sk(c, 'rgba(228,232,234,.55)', 1);
        c.beginPath(); segs.forEach(([px, py], k) => k ? c.lineTo(px + dx, py + dy) : c.moveTo(px + dx, py + dy)); sk(c, 'rgba(62,68,78,.6)', 1.5);
      });
    }
    // grass patches
    for (let i = 0; i < 20; i++) {
      const x = R() * S, y = R() * S, r = 20 + R() * 40, blobs = [], tufts = [];
      for (let q = 0, n = 4 + Math.floor(R() * 4); q < n; q++) blobs.push([(R() - .5) * r * 1.4, (R() - .5) * r * .7, r * (.35 + R() * .3)]);
      for (let q = 0, n = 16 + Math.floor(R() * 14); q < n; q++) tufts.push([(R() - .5) * r * 1.6, (R() - .5) * r * .8, .7 + R() * .6]);
      wrap(x, y, r * 1.6, (X, Y) => {
        for (const b of blobs) fell(c, X + b[0], Y + b[1] + 2, b[2] + 3, b[2] * .6 + 3, GRASSK.edge);
        for (const b of blobs) fell(c, X + b[0], Y + b[1], b[2], b[2] * .6, GRASSK.base);
        for (const b of blobs) fell(c, X + b[0] - b[2] * .2, Y + b[1] - b[2] * .15, b[2] * .55, b[2] * .28, '#90b163');
        for (const t of tufts) tuft(c, X + t[0], Y + t[1], t[2], (t[2] > 1 ? GRASSK.dark : '#6a8f47'));
      });
    }
    for (let i = 0; i < 170; i++) { const x = R() * S, y = R() * S, s = .7 + R() * .5; wrap(x, y, 8, (X, Y) => tuft(c, X, Y, s, i % 3 ? '#6c8f48' : GRASSK.dark)); }
    for (let i = 0; i < 280; i++) {
      const x = R() * S, y = R() * S, r = 1.2 + R() * 2.4;
      wrap(x, y, 6, (X, Y) => { fell(c, X + .8, Y + .8, r, r * .7, '#6e747b'); fell(c, X, Y, r, r * .7, '#b9bdc0'); fell(c, X - r * .3, Y - r * .3, r * .4, r * .28, '#e2e5e6'); });
    }
    return cv;
  }
  function makePaving() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(313);
    frect(c, 0, 0, S, S, '#a2a6a8');
    const rowsH = [22, 30, 26, 34, 24, 32, 28, 26, 34], cols = ['#cfd1cb', '#c6c8c2', '#d5d6d0', '#bfc3c0', '#cacbc4'];
    let Y = 0;
    for (const rowH of rowsH) {
      const cuts = [0]; let acc = 0;
      while (true) { acc += rowH * (.9 + R() * 1.4); if (acc > S - 20) break; cuts.push(acc); }
      cuts.push(S);
      const off = Math.floor(R() * S);
      for (let q = 0; q < cuts.length - 1; q++) {
        const x0 = (cuts[q] + off) % S, w = cuts[q + 1] - cuts[q], col = cols[Math.floor(R() * cols.length)];
        const specks = [0, 1, 2].map(() => [4 + R() * (w - 8), 4 + R() * (rowH - 8)]);
        for (const ox of [0, -S]) {
          const X = x0 + ox;
          if (X > S || X + w < 0) continue;
          rrect(c, X + 1.2, Y + 1.2, w - 2.4, rowH - 2.4, 4); c.fillStyle = col; c.fill();
          frect(c, X + 3, Y + 2, w - 6, 1.5, 'rgba(255,255,255,.35)');
          frect(c, X + 3, Y + rowH - 4, w - 6, 1.5, 'rgba(60,66,76,.12)');
          for (const [sx, sy] of specks) fell(c, X + sx, Y + sy, 1.2, .9, 'rgba(90,96,104,.25)');
        }
      }
      Y += rowH;
    }
    return cv;
  }
  function makePlazaEmblem() {
    const cv = mk(340, 220), c = cv.getContext('2d');
    c.save(); c.translate(170, 110); c.scale(1, .6);
    fell(c, 0, 0, 160, 160, '#7d8a99'); fell(c, 0, 0, 150, 150, '#dde0dc'); fell(c, 0, 0, 120, 120, '#c9ced2');
    c.beginPath(); c.arc(0, 0, 135, 0, TAU); sk(c, '#8f9aa6', 3);
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; line(c, Math.cos(a) * 122, Math.sin(a) * 122, Math.cos(a) * 148, Math.sin(a) * 148, '#9aa3ad', 2); }
    kumoCrest(c, 0, -6, 92, '#4f6684', .1);
    c.restore();
    return cv;
  }
  function makeCloudBank(w, h, seed) {
    const cv = mk(w, h), c = cv.getContext('2d'), R = rng(seed), puffs = [];
    const hump = R() * .5 + .25;
    for (let i = 0; i < 18; i++) { const u = .12 + R() * .76, top = Math.exp(-((u - hump) ** 2) / .06); puffs.push([w * u, h * (.62 - top * .22) + (R() - .5) * h * .14, h * (.11 + R() * .1 + top * .1)]); }
    for (let i = 0; i < 7; i++) puffs.push([w * (.1 + i * .133) + (R() - .5) * 14, h * .68, h * (.12 + R() * .05)]);
    puffs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of puffs) fell(c, x, y, r + 2.5, r * .8 + 2.5, 'rgba(120,138,160,.55)');
    for (const [x, y, r] of puffs) fell(c, x + 3, y + 3, r, r * .8, '#d4dce5');
    for (const [x, y, r] of puffs) fell(c, x - 2, y - 3, r * .88, r * .7, '#f6f8fa');
    for (const [x, y, r] of puffs) if (y < h * .5) fell(c, x - r * .3, y - r * .32, r * .38, r * .22, '#ffffff');
    return cv;
  }
  function makeWisp(seed) {
    const w = 380, h = 150, cv = mk(w, h), c = cv.getContext('2d'), R = rng(seed);
    for (let i = 0; i < 12; i++) {
      const x = 70 + R() * 240, y = 50 + R() * 50, r = 30 + R() * 40;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(250,252,255,.7)'); g.addColorStop(.6, 'rgba(236,242,250,.4)'); g.addColorStop(1, 'rgba(230,238,248,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    return cv;
  }

  // ------------------------------------------------------------------ state
  const A = { b: {} };
  let ready = false;
  const FP = [];          // footprints (returned by footprints())
  const ITEMS = [];       // painter-sorted drawables
  const EDGE = [];        // low cloud banks along the rim
  const WISPS = [];
  const lanterns = [];

  function buildCanvas(key) {
    if (A.b[key]) return A.b[key];
    const v = key[0] === 'S' ? key.slice(0, 2) : key[0];
    const [w, h] = VSIZE[v];
    const cv = mk(w + PADL + PADR, h + PADT + PADB), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round'; c.translate(PADL, PADT);
    const pal = PALS[key[0] === 'S' || key === 'K' ? 0 : +key[1] || 0];
    const P = { ...pal, lamps: [], anchors: null, seed: key.charCodeAt(0) + (+key[1] || 0) * 7 };
    FN[v](c, P, w, h);
    const t = trim(cv);
    return (A.b[key] = { cv: t.cv, ox: t.x - PADL, oy: t.y - PADT, lamps: P.lamps, anchors: P.anchors, w, h });
  }
  // Crop a sprite canvas to its opaque bounding box so blits never blend empty margins.
  function trim(cv) {
    const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      const row = y * W * 4;
      for (let x = 0; x < W; x++) if (d[row + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
    }
    if (x1 < 0) return { cv, x: 0, y: 0 };
    const out = mk(x1 - x0 + 1, y1 - y0 + 1);
    out.getContext('2d').drawImage(cv, -x0, -y0);
    return { cv: out, x: x0, y: y0 };
  }

  function buildAssets() {
    const tmp = mk(4, 4).getContext('2d');
    A.groundPat = tmp.createPattern(makeGround(), 'repeat');
    A.pavePat = tmp.createPattern(makePaving(), 'repeat');
    A.emblem = makePlazaEmblem();
    // 4 cloud-bank shapes x 3 pre-scaled sizes
    A.banks = [];
    for (const [w, h, seed] of [[420, 180, 61], [360, 160, 62], [280, 200, 63], [260, 170, 64]]) for (const sc of [.65, .85, 1.05]) A.banks.push(makeCloudBank(Math.round(w * sc), Math.round(h * sc), seed));
    A.outcrops = [makeOutcrop(85), makeOutcrop(86), makeOutcrop(87)];
    A.wisps = [makeWisp(71), makeWisp(72), makeWisp(73)];
    A.lamp = makeLampPost();
    A.boulders = [makeBoulder(9, 81), makeBoulder(14, 82), makeBoulder(20, 83)];
    A.pines = [makePine(91), makePine(92)];
    A.grass = makeGrass();
    A.crates = makeCrates();
    A.gate = makeGate();
    ready = true;
  }

  const inPlaza = (x, y, m = 0) => ((x - PLAZA.x) / (PLAZA.rx + m)) ** 2 + ((y - PLAZA.y) / (PLAZA.ry + m)) ** 2 < 1;
  const onPath = (x, y, m = 0) => PATHS.some(p => x > p.x - m && x < p.x + p.w + m && y > p.y - m && y < p.y + p.h + m);

  function plan() {
    FP.length = 0; ITEMS.length = 0; EDGE.length = 0; WISPS.length = 0; lanterns.length = 0;
    const grid = [];
    const addLamp = (x, y) => lanterns.push({ x: Math.round(x), y: Math.round(y) });
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
      const ch = MAP[cy][cx];
      if (ch === '.') continue;
      const gx = cx * BLOCK, gy = cy * BLOCK;
      if (ch === 'G') {
        const left = cx * BLOCK + BLOCK === GATE_X;
        const f = { x: left ? 2160 : 2704, y: 5100, w: 336, h: 68, solid: true, roof: SLATE.base, wall: STONE.base };
        const fi = FP.push(f) - 1;
        if (left) {
          const t = trim(A.gate);
          ITEMS.push({ fi, solid: true, img: t.cv, x: 2120 + t.x, y: 4960 + t.y, w: t.cv.width, h: t.cv.height, sy: 5168 });
          addLamp(2512, 5088); addLamp(2688, 5088);
        }
        continue;
      }
      const R = rng(cx * 131 + cy * 977 + 5);
      let key;
      if (ch === 'S') key = 'S' + Math.floor(hash2(cx, cy, 3) * 4);
      else if (ch === 'K') key = 'K';
      else key = ch + (hash2(cx, cy, 7) < .5 ? 0 : 1);
      const e = buildCanvas(key), w = e.w, h = e.h;
      let ox = 60 + Math.floor(R() * (400 - w + 1)), oy = 60 + Math.floor(R() * (400 - h + 1));
      if (ch === 'K') { ox = 60; oy = 60; }
      if (cy >= 4 && cx === 4) ox = Math.min(ox, GATE_X - 100 - gx - w);   // keep the gate avenue clear
      if (cy >= 4 && cx === 5) ox = Math.max(ox, 100);
      const fx = gx + ox, fy = gy + oy, solid = ch === 'S';
      const pal = PALS[+key[1] || 0];
      const f = solid ? { x: fx, y: fy, w, h, solid: true, roof: ROCKP.base, wall: ROCKP.dark }
        : { x: fx, y: fy, w, h, roof: ch === 'K' ? SLATE.base : pal.D.base, wall: ch === 'K' ? WHITE.base : pal.W.base };
      const fi = FP.push(f) - 1;
      ITEMS.push({ fi, solid, img: e.cv, x: fx + e.ox, y: fy + e.oy, w: e.cv.width, h: e.cv.height, sy: fy + h });
      for (const [lx, ly] of e.lamps) addLamp(fx + lx, fy + ly);
      grid[cx + cy * N] = { fx, fy, e, fi, solid };
    }
    // rope-and-plank bridges between neighbouring towers of the same row
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N - 1; cx++) {
      const L = grid[cx + cy * N], Rt = grid[cx + 1 + cy * N];
      if (!L || !Rt || !L.e.anchors || !Rt.e.anchors || (L.solid && Rt.solid)) continue;
      const ax = L.fx + L.e.anchors.r[0], ay = L.fy + L.e.anchors.r[1], bx = Rt.fx + Rt.e.anchors.l[0], by = Rt.fy + Rt.e.anchors.l[1];
      const gap = bx - ax;
      if (gap < 90 || gap > 470 || Math.abs(by - ay) > 130 || hash2(cx, cy, 77) > .62) continue;
      if (cy >= 4 && cx === 4) continue;   // keep the view down the gate avenue open
      ITEMS.push({ bridge: true, ax, ay, bx, by, sag: 16 + gap * .08, fa: L.solid ? -1 : L.fi, fb: Rt.solid ? -1 : Rt.fi,
        x: ax - 10, y: Math.min(ay, by) - 30, w: gap + 20, h: Math.abs(by - ay) + 60 + gap * .08, sy: Math.max(L.fy + L.e.h, Rt.fy + Rt.e.h) + 1 });
    }
    // street lamps: along the gate avenue and round the plaza
    const props = [];
    for (let y = 2780; y < 5050; y += 460) { props.push({ s: A.lamp, x: 2508, y }); props.push({ s: A.lamp, x: 2692, y: y + 230 }); }
    for (let k = 0; k < 10; k++) {
      const a = Math.PI * (.12 + k * .2);
      if (Math.sin(a) < -.3) continue;
      props.push({ s: A.lamp, x: PLAZA.x + Math.cos(a) * (PLAZA.rx + 18), y: PLAZA.y + Math.sin(a) * (PLAZA.ry + 14) });
    }
    for (const p of props) addLamp(p.x, p.y - 74);
    // scattered boulders, pines, grass and crates
    const R = rng(4711);
    const blocked = (x, y) => {
      if (x < 80 || x > SIZE - 80 || y < 90 || y > SIZE - 70) return true;
      if (onPath(x, y, 22) || inPlaza(x, y, 60) || (x > 2080 && x < 3120 && y > 4880)) return true;
      for (const it of ITEMS) if (!it.bridge && x > it.x + 10 && x < it.x + it.w + 4 && y > it.y + 40 && y < it.y + it.h + 30) return true;
      for (const p of props) if (Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 46) return true;
      return false;
    };
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
      let placed = 0;
      for (let t = 0; t < 14 && placed < 3; t++) {
        const x = cx * BLOCK + 20 + R() * 480, y = cy * BLOCK + 20 + R() * 480;
        if (blocked(x, y)) continue;
        const r = R();
        const s = r < .3 ? A.boulders[Math.floor(R() * 3)] : r < .52 ? A.outcrops[Math.floor(R() * 3)] : r < .72 ? A.grass : r < .9 ? A.pines[Math.floor(R() * 2)] : A.crates;
        props.push({ s, x: Math.round(x), y: Math.round(y) });
        placed++;
      }
    }
    for (const p of props) ITEMS.push({ fi: -1, img: p.s.cv, x: Math.round(p.x - p.s.ax), y: Math.round(p.y - p.s.ay), w: p.s.cv.width, h: p.s.cv.height, sy: p.y });
    ITEMS.sort((a, b) => a.sy - b.sy);
    // low cloud banks hugging the rim of the plateau
    const RC = rng(2024);
    // each bank: sprite k drawn at (x, y) scaled to (w, h); never more than 150px outside the village
    const bank = (k, cx, cy, sc) => {
      const q = sc < .75 ? 0 : sc < .95 ? 1 : 2, img = A.banks[k * 3 + q], w = img.width, h = img.height;
      k = k * 3 + q;
      const x = Math.max(-150, Math.min(SIZE + 150 - w, Math.round(cx - w / 2))), y = Math.max(-150, Math.min(SIZE + 150 - h, Math.round(cy - h / 2)));
      EDGE.push({ k, x, y, w, h });
    };
    for (let x = 40; x < SIZE; x += 170 + RC() * 150) {
      bank(Math.floor(RC() * 4), x, -20 + RC() * 50, .7 + RC() * .5);
      if (Math.abs(x - GATE_X) > 380) bank(Math.floor(RC() * 4), x, SIZE - 10 + RC() * 40, .7 + RC() * .5);
    }
    for (let y = 120; y < SIZE - 120; y += 150 + RC() * 170) {
      const s1 = .55 + RC() * .5, s2 = .55 + RC() * .5;
      bank(Math.floor(RC() * 4), -10 + RC() * 60 * s1, y, s1);
      bank(Math.floor(RC() * 4), SIZE + 10 - RC() * 60 * s2, y + 60 * (RC() - .5), s2);
    }
    EDGE.sort((a, b) => a.y - b.y);
    // drifting wisps for the ambient layer
    const RW = rng(77);
    for (let i = 0; i < 18; i++) WISPS.push({ x0: RW() * SIZE, y: 80 + RW() * (SIZE - 300), sp: 10 + RW() * 14, k: i % 3, a: .22 + RW() * .16, ph: RW() * TAU,
      per: 8 + (i % 5) * 3.3, storm: i % 3 === 0, bolt: Array.from({ length: 6 }, (_, q) => [120 + q * 28 + (RW() - .5) * 20, 60 + (RW() - .5) * 40]) });
  }

  // ------------------------------------------------------------------ per-frame drawing
  function drawBridge(ctx, b) {
    const { ax, ay, bx, by, sag } = b, n = Math.max(8, Math.round((bx - ax) / 9));
    const P = t => [ax + (bx - ax) * t, ay + (by - ay) * t + sag * 4 * t * (1 - t)];
    const rail = (dy, col, lw) => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = P(i / n); if (i) ctx.lineTo(x, y + dy); else ctx.moveTo(x, y + dy); } ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
    rail(-22, '#7a6650', 1.6);
    ctx.strokeStyle = '#4a3c30'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i <= n; i += 3) { const [x, y] = P(i / n); ctx.moveTo(x, y); ctx.lineTo(x, y - 22); }
    ctx.stroke();
    rail(3, '#3a2e24', 2.2);
    for (let i = 0; i < n; i++) {
      const [x, y] = P((i + .5) / n);
      ctx.fillStyle = OUT; ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = i % 2 ? '#a57c50' : '#8f6a44'; ctx.fillRect(x - 3.2, y - 3.5, 6.4, 6);
    }
    rail(-14, '#5b4a3a', 2);
    ctx.strokeStyle = '#4a3c30'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i <= n; i += 3) { const [x, y] = P(i / n); ctx.moveTo(x, y + 2); ctx.lineTo(x, y - 14); }
    ctx.stroke();
  }

  function drawStatic(ctx, bounds, isDestroyed) {
    if (!ready) init();
    const x0 = bounds.x, y0 = bounds.y, x1 = x0 + bounds.w, y1 = y0 + bounds.h;
    const dead = i => i >= 0 && typeof isDestroyed === 'function' && !!isDestroyed(i);
    ctx.save();
    const gx0 = Math.max(0, x0), gy0 = Math.max(0, y0), gx1 = Math.min(SIZE, x1), gy1 = Math.min(SIZE, y1);
    if (gx1 > gx0 && gy1 > gy0) {
      ctx.fillStyle = A.groundPat; ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
      ctx.save(); ctx.beginPath(); ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0); ctx.clip();
      const vis = p => p.x - 10 < x1 && p.x + p.w + 10 > x0 && p.y - 10 < y1 && p.y + p.h + 10 > y0;
      const plazaVis = PLAZA.x - PLAZA.rx - 20 < x1 && PLAZA.x + PLAZA.rx + 20 > x0 && PLAZA.y - PLAZA.ry - 20 < y1 && PLAZA.y + PLAZA.ry + 20 > y0;
      ctx.fillStyle = '#7e848a';
      for (const p of PATHS) if (vis(p)) ctx.fillRect(p.x - 6, p.y - 6, p.w + 12, p.h + 12);
      if (plazaVis) { ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx + 10, PLAZA.ry + 10, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = A.pavePat;
      for (const p of PATHS) if (vis(p)) ctx.fillRect(p.x, p.y, p.w, p.h);
      if (plazaVis) {
        ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(110,118,128,.6)'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx - 34, PLAZA.ry - 24, 0, 0, TAU); ctx.stroke();
        ctx.drawImage(A.emblem, PLAZA.x - 170, PLAZA.y - 104);
      }
      for (const s of STEPS) {
        if (!vis({ x: s.x, y: s.y, w: s.w, h: 44 })) continue;
        for (let i = 0; i < 3; i++) {
          const y = s.y + i * 14;
          ctx.fillStyle = '#d9dbd6'; ctx.fillRect(s.x, y, s.w, 9);
          ctx.fillStyle = '#8e9398'; ctx.fillRect(s.x, y + 9, s.w, 5);
          ctx.fillStyle = OUT; ctx.fillRect(s.x, y + 13, s.w, 1.5);
        }
      }
      ctx.restore();
    }
    // low clouds lapping at the rim (may spill up to ~150px outside the village)
    for (const e of EDGE) if (e.x < x1 && e.x + e.w > x0 && e.y < y1 && e.y + e.h > y0) ctx.drawImage(A.banks[e.k], e.x, e.y);
    // buildings, spires, props and bridges in painter's order
    for (const it of ITEMS) {
      if (it.x > x1 || it.x + it.w < x0 || it.y > y1 || it.y + it.h < y0) continue;
      if (it.bridge) { if (!dead(it.fa) && !dead(it.fb)) drawBridge(ctx, it); continue; }
      if (dead(it.fi)) continue;
      ctx.drawImage(it.img, it.x, it.y);
    }
    ctx.restore();
  }

  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    const t = time || 0, span = SIZE - 200;
    ctx.save();
    for (let i = 0; i < WISPS.length; i++) {
      const w = WISPS[i], img = A.wisps[w.k];
      const u = ((w.x0 + t * w.sp) % span + span) % span, cx = 100 + u, y = w.y + Math.sin(t * .23 + w.ph) * 14;
      const x = cx - img.width / 2;
      if (x > view.x + view.w || x + img.width < view.x || y > view.y + view.h || y + img.height < view.y) continue;
      const fade = Math.min(1, u / 500, (span - u) / 500);
      ctx.globalAlpha = w.a * fade;
      ctx.drawImage(img, x, y);
      if (!w.storm) continue;
      const cyc = (t + w.ph * 3) % w.per;
      if (cyc > .34 || (cyc > .1 && cyc < .2)) continue;
      ctx.globalAlpha = .55 * fade;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x + 190, y + 70, 0, x + 190, y + 70, 120);
      g.addColorStop(0, 'rgba(255,244,170,.55)'); g.addColorStop(1, 'rgba(255,244,170,0)');
      ctx.fillStyle = g; ctx.fillRect(x + 70, y - 50, 240, 240);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = .8 * fade;
      ctx.beginPath(); w.bolt.forEach(([bx, by], q) => q ? ctx.lineTo(x + bx, y + by) : ctx.moveTo(x + bx, y + by));
      ctx.strokeStyle = 'rgba(255,226,90,.45)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.restore();
  }

  function drawMinimap(ctx) {
    if (!ready) init();
    ctx.save();
    ctx.fillStyle = '#8b9198'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#7b9a5a';
    for (let i = 0; i < 26; i++) { const x = hash2(i, 1, 9) * SIZE, y = hash2(i, 2, 9) * SIZE; ctx.beginPath(); ctx.ellipse(x, y, 90, 50, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#e8ecf0'; ctx.fillRect(0, 0, SIZE, 70); ctx.fillRect(0, SIZE - 70, SIZE, 70); ctx.fillRect(0, 0, 70, SIZE); ctx.fillRect(SIZE - 70, 0, 70, SIZE);
    ctx.fillStyle = '#cfd1cb';
    for (const p of PATHS) ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
    for (const f of FP) {
      if (f.solid && f.h < 100) { ctx.fillStyle = '#9aa1a8'; ctx.fillRect(f.x, f.y, f.w, f.h); continue; }
      if (f.solid) { ctx.fillStyle = '#4c525c'; ctx.beginPath(); ctx.ellipse(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, f.h / 2, 0, 0, TAU); ctx.fill(); continue; }
      if (f.w >= 400) {
        ctx.fillStyle = '#f4d23a'; ctx.beginPath(); ctx.ellipse(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, f.h / 2, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3d5576'; ctx.beginPath(); ctx.ellipse(f.x + f.w / 2, f.y + f.h / 2, f.w * .3, f.h * .3, 0, 0, TAU); ctx.fill();
        continue;
      }
      ctx.fillStyle = f.wall; ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.fillStyle = f.roof; ctx.fillRect(f.x, f.y, f.w, f.h * .45);
    }
    ctx.restore();
  }

  function init() {
    if (!ready) buildAssets();
    if (!FP.length) plan();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  window.ShinobiVillages.kumo = {
    id: 'kumo', name: 'LÀNG MÂY', jp: '雲隠れの里', kage: 'RAIKAGE',
    cols: N, rows: N,
    gate: { side: 's', at: GATE_X },
    spawn: { x: SPAWN.x, y: SPAWN.y },
    lanterns,
    init,
    footprints() { if (!FP.length) init(); return FP.map(f => ({ ...f })); },
    drawStatic, drawAmbient, drawMinimap,
  };
})();
