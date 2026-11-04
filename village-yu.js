/* village-yu.js — Yugakure no Sato (Hidden Hot Water Village), Hidan's home: a quiet hot-spring resort in the mountains.
   Registers window.ShinobiVillages.yu. Procedural Canvas 2D in the same 3/4 oblique, cel-shaded style as the other villages
   (light from the top-left, dark outlines, cached sprites). No external images. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, NC = 7, SIZE = BLOCK * NC;
  const OUT = '#2e231d';
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const SM = 26, OVER = 126, BM = 22;           // building canvas margins: sides / above the footprint / below
  const FW = 340, FH = 300;                     // house footprint
  const LW = 440, LH = 400, LOVER = 240;        // onsen palace footprint + its tall overhang
  const WIN = 400, WOUT = 3240, WALLH = 64;     // inner wall lines, wall height
  const ROAD = { x: 1720, y: 0, w: 200, h: 1170 };
  const PLAZA = { x: 1820, y: 1330, rx: 250, ry: 182 };
  const SPAWN = { x: 1820, y: 470 };
  const PALACE = { x: 1600, y: 1640, w: LW, h: LH };
  const STREETS = [
    { x: 420, y: 1012, w: 2800, h: 88 },     // riverside promenade
    { x: 420, y: 1515, w: 2800, h: 100 },    // middle street
    { x: 420, y: 2545, w: 2800, h: 110 },    // south street
    { x: 985, y: 1012, w: 110, h: 2228 },    // west avenue
    { x: 2545, y: 1012, w: 110, h: 2228 },   // east avenue
    { x: 1752, y: 2040, w: 136, h: 505 }     // palace forecourt walk
  ];
  const STREAM = { x0: 440, x1: 3200, y0: 846, y1: 1016, cy: 932 };
  const yc = x => STREAM.cy + 12 * Math.sin(TAU * x / 780 + .6) + 6 * Math.sin(TAU * x / 310 + 2.1);
  const hw = x => 34 + 5 * Math.sin(TAU * x / 470 + 1.3);
  const YUBA = { x: 1820, y: 2885, w: 360, h: 236 };

  const GR = { base: '#7c8550', light: '#959d5f', dark: '#68723f', deep: '#55602f', hi: '#adb46c', dirt: '#97876a' };
  const ROCK = { base: '#8f8b81', light: '#bab5a8', dark: '#67635b', deep: '#4b4740', out: '#2c2823', moss: '#7b8d44', mossL: '#a5b660', mossD: '#5a6b33' };
  const WATER = { deep: '#2f9ea6', base: '#4cbdb6', light: '#88dccf', hi: '#e2fbf3' };
  const LEAFC = ['#c8402a', '#e0702c', '#e8b23a', '#a8301e', '#8a5a2a'];
  const MAPLE = {
    red: { out: '#4a1410', dark: '#8e2418', mid: '#c23a22', light: '#e2652e', hi: '#f6a64e' },
    crim: { out: '#46100e', dark: '#7e1a16', mid: '#b02a1e', light: '#d84a2a', hi: '#f08a4a' },
    orange: { out: '#4e2210', dark: '#a8481a', mid: '#d8742a', light: '#efa040', hi: '#fbd070' },
    yellow: { out: '#4a3812', dark: '#a87a1e', mid: '#d6a830', light: '#efcc52', hi: '#fbe88a' },
    green: { out: '#1e3a1e', dark: '#2f6a2e', mid: '#4a8f3a', light: '#74b04c', hi: '#a8d070' }
  };
  const PINE = { out: '#18281c', dark: '#2a4a30', mid: '#3d6a3c', light: '#5c8c4e', hi: '#8db46a' };
  const CED = { out: '#122218', dark: '#1d3a2a', mid: '#2b563b', light: '#40744c', hi: '#62985e' };

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
  function tone(base) { return { base, light: mix(base, '#fff6e4', .3), hi: mix(base, '#fffaf0', .56), dark: mix(base, '#24160f', .3), deep: mix(base, '#140c08', .52) }; }
  function wv(t, s) { const k = TAU * t / BLOCK; return .5 + .2 * Math.sin(k + s * 1.7) + .15 * Math.sin(2 * k + s * 2.9) + .1 * Math.sin(3 * k + s * .7) + .05 * Math.sin(5 * k + s * 4.1); }

  // ------------------------------------------------------------------ primitives
  function poly(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
  function fpoly(c, p, col) { poly(c, p); c.fillStyle = col; c.fill(); }
  function frect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function fell(c, x, y, rx, ry, col) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); c.fillStyle = col; c.fill(); }
  function sk(c, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
  function line(c, x1, y1, x2, y2, col, lw) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); sk(c, col, lw); }
  function srect(c, x, y, w, h, col = OUT, lw = 2) { c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function smoothPath(pts) {
    const n = pts.length, p = new Path2D();
    p.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) { const q = pts[(i + 1) % n]; p.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + q[0]) / 2, (pts[i][1] + q[1]) / 2); }
    p.closePath(); return p;
  }
  function txt(c, s, x, y, size, col, o = {}) {
    c.font = `${o.weight || '700'} ${size}px ${o.font || MINCHO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 3; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function txtV(c, s, x, y, size, col, o) { [...s].forEach((ch, i) => txt(c, ch, x, y + size * .55 + i * size * 1.02, size, col, o)); }
  function celFill(c, path, base, light, dark, o = {}) {
    const ld = o.ld ?? 6, dd = o.dd ?? 8, big = () => { const p = new Path2D(); p.rect(-1e5, -1e5, 2e5, 2e5); return p; };
    c.save();
    c.fillStyle = base; c.fill(path);
    c.clip(path);
    if (light) { const p = big(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, ld, ld])); c.fillStyle = light; c.fill(p, 'evenodd'); }
    if (dark) { const p = big(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, -dd, -dd])); c.fillStyle = dark; c.fill(p, 'evenodd'); }
    if (o.deep) { const p = big(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, -(o.deepD || 4), -(o.deepD || 4)])); c.fillStyle = o.deep; c.fill(p, 'evenodd'); }
    c.restore();
  }
  function sprite(w, h, ax, ay, fn) { const cv = mk(w, h), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; fn(c, ax, ay); return { cv, ax, ay }; }
  function wrapDraw(S, x, y, m, fn) { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { const X = x + ox, Y = y + oy; if (X < -m || X > S + m || Y < -m || Y > S + m) continue; fn(X, Y); } }

  // ------------------------------------------------------------------ palettes
  const DW = tone('#4e3628');                    // dark stained timber
  const WOOD = tone('#8a5e3e');                  // natural cedar
  const RED = tone('#c0392b');
  const PL = ['#f1e6cf', '#ece0c4', '#f5eddd', '#e9d9bb'].map(tone);
  const TL = ['#4b5462', '#3c424c', '#5a6472', '#5c524b', '#465863', '#6a5348'].map(tone);
  const NOREN = ['#2b3f70', '#a8322a', '#3d5c3e', '#5b3a6e', '#7a4a24', '#1f4a5a'];

  // ------------------------------------------------------------------ rocks
  function boulder(c, x, y, r, R, moss = true, K = ROCK) {
    const n = 9, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .3, rr = r * (.8 + R() * .28); pts.push([x + Math.cos(a) * rr * 1.1, y - r * .28 + Math.sin(a) * rr * .8]); }
    fell(c, x + r * .4, y + r * .42, r * 1.15, r * .3, 'rgba(28,22,16,.28)');
    const p = smoothPath(pts);
    celFill(c, p, K.base, K.light, K.dark, { ld: r * .22, dd: r * .3, deep: K.deep, deepD: Math.max(1.5, r * .1) });
    if (moss) {
      c.save(); c.clip(p);
      fell(c, x - r * .12, y - r * 1.02, r * .95, r * .42, K.moss);
      fell(c, x - r * .34, y - r * 1.1, r * .5, r * .2, K.mossL);
      c.fillStyle = K.mossD; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x - r * .6 + R() * r * 1.2, y - r * .74 + R() * r * .12, Math.max(.8, r * .07), 0, TAU); c.fill(); }
      c.restore();
    }
    if (r > 13) { c.beginPath(); c.moveTo(x - r * .05, y - r * .7); c.lineTo(x + r * .12, y - r * .36); c.lineTo(x + r * .02, y - r * .05); sk(c, 'rgba(40,34,28,.5)', 1.3); }
    c.strokeStyle = K.out; c.lineWidth = r > 20 ? 1.9 : 1.3; c.stroke(p);
  }

  // ------------------------------------------------------------------ building kit
  function dropShadow(c, x, yTop, w, yB) { fpoly(c, [x + w, yTop + 18, x + w + 22, yTop + 36, x + w + 22, yB + 16, x + 14, yB + 16, x + 14, yB], 'rgba(34,24,16,.26)'); }
  function boards(c, x, y, w, h, T) {
    frect(c, x, y, w, h, T.base);
    c.strokeStyle = T.dark; c.lineWidth = 1; c.beginPath(); for (let i = x + 6; i < x + w; i += 7) { c.moveTo(i, y + 2); c.lineTo(i, y + h); } c.stroke();
    frect(c, x, y, w, 3, T.light);
  }
  function wallJ(c, x, y, w, h, W, o = {}) {
    const fd = o.found ?? 8, hh = h - fd;
    frect(c, x, y, w, hh, W.base);
    if (o.koshi) boards(c, x, y + hh - o.koshi, w, o.koshi, DW);
    if (o.posts) {
      const n = Math.max(1, Math.round((w - 7) / o.posts));
      for (let i = 0; i <= n; i++) { const px = x + i * (w - 7) / n; frect(c, px, y, 7, hh, DW.base); frect(c, px, y, 2, hh, DW.light); frect(c, px + 5, y, 2, hh, DW.deep); }
    }
    if (o.beam !== false) { frect(c, x, y, w, 7, DW.base); frect(c, x, y + 5, w, 2, DW.deep); }
    if (o.mid) { frect(c, x, y + o.mid, w, 7, DW.base); frect(c, x, y + o.mid, w, 2, DW.light); frect(c, x, y + o.mid + 7, w, 3, 'rgba(30,18,12,.25)'); }
    if (fd) {
      frect(c, x - 2, y + hh, w + 4, fd, '#8f8a80'); frect(c, x - 2, y + hh, w + 4, 2, '#bdb7aa');
      c.strokeStyle = 'rgba(50,45,40,.5)'; c.lineWidth = 1; c.beginPath(); for (let i = x + 14; i < x + w; i += 22) { c.moveTo(i, y + hh + 2); c.lineTo(i, y + h); } c.stroke();
    }
    c.fillStyle = 'rgba(255,250,235,.2)'; c.fillRect(x, y, 5, hh);
    c.fillStyle = 'rgba(40,24,30,.14)'; c.fillRect(x + w - 10, y, 10, hh);
    if (o.eave !== 0) { c.fillStyle = 'rgba(30,18,14,.30)'; c.fillRect(x, y, w, o.eave ?? 9); }
    srect(c, x, y, w, h, OUT, 2);
  }
  function shoji(c, x, y, w, h, lit = false) {
    frect(c, x - 3, y - 3, w + 6, h + 6, DW.deep);
    frect(c, x, y, w, h, lit ? '#ffd27e' : '#f3e9d0');
    if (lit) frect(c, x + 3, y + 3, w - 6, h - 6, '#ffe6a8');
    const n = Math.max(2, Math.round(w / 9)), m = Math.max(2, Math.round(h / 9));
    c.strokeStyle = lit ? '#a8703a' : '#8a6a4a'; c.lineWidth = 1; c.beginPath();
    for (let i = 1; i < n; i++) { c.moveTo(x + i * w / n, y); c.lineTo(x + i * w / n, y + h); }
    for (let j = 1; j < m; j++) { c.moveTo(x, y + j * h / m); c.lineTo(x + w, y + j * h / m); }
    c.stroke();
    frect(c, x, y, w, 3, 'rgba(60,30,10,.22)');
    frect(c, x - 4, y + h + 3, w + 8, 3, DW.dark);
  }
  function koshi(c, x, y, w, h, lit) {
    frect(c, x - 3, y - 3, w + 6, h + 6, DW.deep);
    frect(c, x, y, w, h, lit ? '#a8682a' : '#2b1e17');
    if (lit) frect(c, x + 2, y + h * .3, w - 4, h * .5, 'rgba(255,214,140,.55)');
    c.strokeStyle = DW.light; c.lineWidth = 2; c.beginPath(); for (let i = x + 3; i < x + w; i += 5) { c.moveTo(i, y); c.lineTo(i, y + h); } c.stroke();
    frect(c, x, y + h * .42, w, 3, DW.base);
    frect(c, x - 4, y + h + 3, w + 8, 3, DW.deep);
  }
  function mushiko(c, x, y, w, h, W) {
    frect(c, x - 3, y - 3, w + 6, h + 6, W.dark); frect(c, x, y, w, h, '#2b211b');
    for (let i = x + 2; i < x + w - 2; i += 7) { frect(c, i, y, 4, h, W.light); frect(c, i + 3, y, 1, h, W.dark); }
  }
  function roofJ(c, x, y, w, d, R, o = {}) {
    const rf = o.rf ?? .3, hip = o.hip ?? 0, L = x, Rt = x + w, T = y, B = y + d, ry = y + d * rf;
    if (rf > 0) fpoly(c, [L, T, Rt, T, Rt - hip, ry, L + hip, ry], R.light);
    if (hip > 0) { fpoly(c, [L, T, L + hip, ry, L, B], R.light); fpoly(c, [Rt, T, Rt - hip, ry, Rt, B], R.dark); }
    const front = [L, B, Rt, B, Rt - hip, ry, L + hip, ry];
    fpoly(c, front, R.base);
    c.save(); poly(c, front); c.clip();
    c.strokeStyle = R.dark; c.lineWidth = 2.4; c.beginPath(); for (let tx = L + 5; tx < Rt; tx += 8) { c.moveTo(tx, ry); c.lineTo(tx, B); } c.stroke();
    c.globalAlpha = .5; c.strokeStyle = R.light; c.lineWidth = 1; c.beginPath(); for (let tx = L + 2; tx < Rt; tx += 8) { c.moveTo(tx, ry); c.lineTo(tx, B); } c.stroke(); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(12,10,18,.24)'; c.lineWidth = 1.2; c.beginPath(); for (let ty = ry + 11; ty < B - 4; ty += 11) { c.moveTo(L, ty); c.lineTo(Rt, ty); } c.stroke();
    c.fillStyle = 'rgba(16,10,22,.17)'; c.fillRect(Rt - w * .18, ry, w * .18, d);
    c.fillStyle = 'rgba(255,245,230,.10)'; c.fillRect(L, ry, w * .14, d);
    c.restore();
    if (rf > 0 && ry - T > 8) {
      c.save(); poly(c, [L, T, Rt, T, Rt - hip, ry, L + hip, ry]); c.clip();
      c.strokeStyle = R.base; c.lineWidth = 1.6; c.beginPath(); for (let tx = L + 5; tx < Rt; tx += 8) { c.moveTo(tx, T); c.lineTo(tx, ry); } c.stroke(); c.restore();
    }
    frect(c, L, B - 6, w, 6, R.deep);
    c.fillStyle = R.light; for (let tx = L + 5; tx < Rt - 2; tx += 8) { c.beginPath(); c.arc(tx, B - 3, 2, 0, TAU); c.fill(); }
    if (rf > 0) { line(c, L + hip - 2, ry, Rt - hip + 2, ry, R.deep, 7); line(c, L + hip, ry - 3, Rt - hip, ry - 3, R.hi, 1.5); }
    if (hip > 0) {
      line(c, L + hip, ry, L + 2, B - 3, R.deep, 4); line(c, Rt - hip, ry, Rt - 2, B - 3, R.deep, 4);
      line(c, L + hip, ry, L + 2, T + 2, R.deep, 3); line(c, Rt - hip, ry, Rt - 2, T + 2, R.deep, 3);
      line(c, L + hip - 1, ry - 1, L + 3, B - 5, R.hi, 1);
    } else if (rf > 0) { frect(c, L, T, 5, d, R.deep); frect(c, Rt - 5, T, 5, d, R.deep); }
    if (rf > 0 && o.oni !== false) for (const ex of [L + hip, Rt - hip]) {
      const p = [ex - 7, ry + 3, ex - 6, ry - 9, ex, ry - 13, ex + 6, ry - 9, ex + 7, ry + 3];
      fpoly(c, p, R.deep); poly(c, p); sk(c, OUT, 1.2); fell(c, ex - 1.5, ry - 6, 1.6, 1.6, R.hi);
    }
    poly(c, [L, T, Rt, T, Rt, B, L, B]); sk(c, OUT, 2);
    if (o.flare) for (const s of [-1, 1]) {
      const ex = s < 0 ? L : Rt, pts = [ex + s * 10, B - 16, ex - s * 20, B - 6, ex - s * 15, B, ex + s * 3, B - 4];
      fpoly(c, pts, R.deep); poly(c, pts); sk(c, OUT, 1.5);
    }
  }
  function pent(c, x, y, w, h, R) {
    c.fillStyle = 'rgba(30,18,14,.28)'; c.fillRect(x + 4, y + h, w - 8, 7);
    frect(c, x, y, w, h, R.base);
    c.strokeStyle = R.dark; c.lineWidth = 2.2; c.beginPath(); for (let tx = x + 5; tx < x + w; tx += 8) { c.moveTo(tx, y); c.lineTo(tx, y + h); } c.stroke();
    frect(c, x, y, w, 3, R.light); frect(c, x, y + h - 5, w, 5, R.deep);
    c.fillStyle = R.light; for (let tx = x + 5; tx < x + w - 2; tx += 8) { c.beginPath(); c.arc(tx, y + h - 2.5, 1.8, 0, TAU); c.fill(); }
    srect(c, x, y, w, h, OUT, 2);
  }
  function onsenMark(c, x, y, s, col, lw = 3.2) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = lw;
    c.beginPath(); c.ellipse(0, 5, 12, 6.5, 0, -.42, Math.PI + .42); c.stroke();
    for (const dx of [-6, 0, 6]) { c.beginPath(); c.moveTo(dx, 3); c.bezierCurveTo(dx + 3.5, -1, dx - 3.5, -4, dx, -7); c.bezierCurveTo(dx + 3.5, -10, dx - 2.5, -12, dx + .5, -15); c.stroke(); }
    c.restore();
  }
  // Gable roof whose ridge runs north-south (pointed gable faces the viewer). Returns the wall-top y.
  function gableJ(c, x, y, w, d, rH, R, Wt, o = {}) {
    const ov = o.ov ?? 8, L = x - ov, Rt = x + w + ov, mx = x + w / 2, gy = y + d + rH;
    const left = [L, y + rH, mx, y, mx, y + d, L, gy], right = [Rt, y + rH, mx, y, mx, y + d, Rt, gy];
    fpoly(c, left, R.light); fpoly(c, right, R.dark);
    c.save(); poly(c, left); c.clip(); c.strokeStyle = R.base; c.lineWidth = 2; c.beginPath(); for (let yy = y - rH; yy < gy; yy += 8) { c.moveTo(mx, yy); c.lineTo(L, yy + rH); } c.stroke(); c.restore();
    c.save(); poly(c, right); c.clip(); c.strokeStyle = R.deep; c.lineWidth = 2; c.beginPath(); for (let yy = y - rH; yy < gy; yy += 8) { c.moveTo(mx, yy); c.lineTo(Rt, yy + rH); } c.stroke(); c.restore();
    line(c, mx, y, mx, y + d, R.deep, 7); line(c, mx - 2, y + 2, mx - 2, y + d - 2, R.hi, 1.4);
    fpoly(c, [x, gy, mx, y + d + 3, x + w, gy], Wt.base);
    fpoly(c, [mx, y + d + 3, x + w, gy, mx + 6, gy], 'rgba(40,24,30,.13)');
    // timber struts in the gable
    line(c, mx, y + d + 5, mx, gy - 2, DW.base, 4); line(c, x + w * .2, gy - rH * .35, x + w * .8, gy - rH * .35, DW.base, 3);
    if (o.crest) {
      const vy = y + d + rH * .5, rr = Math.min(12, rH * .3);
      fell(c, mx, vy, rr + 2, rr + 2, DW.deep); fell(c, mx, vy, rr, rr, '#f7efdc');
      if (o.crest === '♨') onsenMark(c, mx, vy + 1, rr / 15, '#b8322a', 2.6); else txt(c, o.crest, mx, vy + 1, rr * 1.4, '#2a1a12', { weight: '900' });
    }
    line(c, x + 4, gy - 4, x + w - 4, gy - 4, DW.dark, 3);
    c.beginPath(); c.moveTo(L, gy + 2); c.lineTo(mx, y + d - 1); c.lineTo(Rt, gy + 2); sk(c, R.deep, 7);
    c.beginPath(); c.moveTo(L + 2, gy - 2); c.lineTo(mx, y + d - 5); c.lineTo(Rt - 2, gy - 2); sk(c, R.light, 1.4);
    // hanging gegyo ornament
    fpoly(c, [mx - 7, y + d + 1, mx + 7, y + d + 1, mx + 4, y + d + 10, mx - 4, y + d + 10], '#c9a040');
    poly(c, [L, y + rH, mx, y, Rt, y + rH, Rt, gy + 3, mx, y + d, L, gy + 3]); sk(c, OUT, 2);
    return gy;
  }
  function karaCurve(p, L, Rr, by, top, rev) {
    const cx = (L + Rr) / 2, w = Rr - L;
    if (!rev) { p.bezierCurveTo(L + w * .2, by - 1, cx - w * .32, top, cx, top); p.bezierCurveTo(cx + w * .32, top, Rr - w * .2, by - 1, Rr, by); }
    else { p.bezierCurveTo(Rr - w * .2, by - 1, cx + w * .32, top, cx, top); p.bezierCurveTo(cx - w * .32, top, L + w * .2, by - 1, L, by); }
  }
  // Karahafu: the cusped, curved gable over bathhouse entrances. by = eave line, h = rise.
  function karahafu(c, cx, by, w, h, R, o = {}) {
    const L = cx - w / 2, Rr = cx + w / 2, t = Math.max(10, h * .3), top = by - h;
    const g = new Path2D(); g.moveTo(L + 8, by + 2); karaCurve(g, L + 8, Rr - 8, by + 2, top + t, false); g.closePath();
    c.fillStyle = o.board || '#e9dcc0'; c.fill(g);
    c.save(); c.clip(g);
    frect(c, cx + w * .12, top, w, h + 4, 'rgba(40,24,20,.12)');
    c.strokeStyle = 'rgba(90,60,30,.35)'; c.lineWidth = 1; c.beginPath(); for (let yy = top + t + 8; yy < by; yy += 7) { c.moveTo(L, yy); c.lineTo(Rr, yy); } c.stroke();
    c.restore();
    if (o.mark) {
      const my = by - (h - t) * .42, rr = Math.min(13, (h - t) * .3);
      fell(c, cx, my, rr + 2.5, rr + 2.5, '#c9a040'); fell(c, cx, my, rr, rr, '#2a1c15');
      if (o.mark === '♨') onsenMark(c, cx, my + 1, rr / 15, '#f6dfa0', 2.4); else txt(c, o.mark, cx, my + 1, rr * 1.35, '#f6dfa0', { weight: '900' });
    }
    const p = new Path2D(); p.moveTo(L - 9, by + 4); karaCurve(p, L - 9, Rr + 9, by + 4, top, false); p.lineTo(Rr - 1, by + 4); karaCurve(p, L + 1, Rr - 1, by + 4, top + t, true); p.closePath();
    c.save(); c.fillStyle = R.base; c.fill(p); c.clip(p);
    c.strokeStyle = R.dark; c.lineWidth = 2; c.beginPath(); for (let tx = L - 8; tx < Rr + 9; tx += 7) { c.moveTo(tx, top - 2); c.lineTo(tx, by + 6); } c.stroke();
    frect(c, cx + w * .2, top - 4, w, h + 10, 'rgba(16,10,22,.18)');
    c.restore();
    const ip = new Path2D(); ip.moveTo(L + 1, by + 4); karaCurve(ip, L + 1, Rr - 1, by + 4, top + t, false);
    c.strokeStyle = DW.dark; c.lineWidth = 6; c.stroke(ip);
    c.strokeStyle = '#d6aa44'; c.lineWidth = 1.4; c.stroke(ip);
    const op = new Path2D(); op.moveTo(L - 7, by + 1); karaCurve(op, L - 7, Rr + 7, by + 1, top + 3, false);
    c.strokeStyle = R.hi; c.lineWidth = 1.4; c.stroke(op);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    fpoly(c, [cx - 6, top + 2, cx - 5, top - 9, cx, top - 12, cx + 5, top - 9, cx + 6, top + 2], R.deep);
    for (const s of [-1, 1]) fell(c, cx + s * w * .3, by - h * .55 + t, 2, 2, '#e0b850');
  }
  function railing(c, x, y, w, h, col, posts = 64) {
    const T = tone(col);
    c.fillStyle = 'rgba(30,18,14,.25)'; c.fillRect(x, y + h + 3, w, 6);
    frect(c, x - 2, y + h - 3, w + 4, 6, T.dark);
    c.strokeStyle = T.base; c.lineWidth = 2; c.beginPath(); for (let bx = x + 4; bx < x + w - 1; bx += 7) { c.moveTo(bx, y + 3); c.lineTo(bx, y + h - 3); } c.stroke();
    line(c, x, y + h * .6, x + w, y + h * .6, T.dark, 2);
    const n = Math.max(1, Math.round(w / posts));
    for (let i = 0; i <= n; i++) { const px = x + i * (w - 6) / n; frect(c, px, y - 3, 6, h + 1, T.dark); frect(c, px, y - 3, 2, h + 1, T.light); fell(c, px + 3, y - 4, 3.5, 2.5, col === '#b8322a' ? '#d9a93a' : T.deep); }
    frect(c, x - 3, y - 1, w + 6, 5, T.light); frect(c, x - 3, y + 3, w + 6, 1.5, T.deep);
  }
  function noren(c, x, y, w, h, col, chars, tcol) {
    const n = chars.length || 3, gap = 2, sw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const sx = x + i * (sw + gap);
      frect(c, sx, y + 2, sw, h, col);
      frect(c, sx + sw - 2, y + 2, 2, h, 'rgba(0,0,0,.2)');
      frect(c, sx, y + 2, sw, 4, 'rgba(0,0,0,.22)');
      if (chars[i]) txt(c, chars[i], sx + sw / 2, y + 2 + h * .56, Math.min(sw * .8, h * .6), tcol, { weight: '900' });
    }
    line(c, x - 4, y + 1, x + w + 4, y + 1, DW.deep, 3);
  }
  function chochin(c, x, y, s = 1, col = '#ec7a2c', label) {
    line(c, x, y - 13 * s, x, y - 8 * s, '#2a1e18', 1.5);
    frect(c, x - 4 * s, y - 10 * s, 8 * s, 3 * s, '#2a1e18');
    fell(c, x, y, 6.5 * s, 8.5 * s, col);
    c.save(); c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); c.clip();
    fell(c, x - 1.2 * s, y - .5 * s, 3.6 * s, 5.4 * s, 'rgba(255,236,170,.75)');
    frect(c, x + 2.6 * s, y - 9 * s, 5 * s, 18 * s, 'rgba(120,30,10,.3)');
    c.strokeStyle = 'rgba(110,30,10,.35)'; c.lineWidth = .8; c.beginPath();
    for (let k = -2; k <= 2; k++) { c.moveTo(x - 7 * s, y + k * 3.2 * s); c.lineTo(x + 7 * s, y + k * 3.2 * s); } c.stroke();
    if (label) txt(c, label, x, y + .5 * s, 7 * s, '#2a120c', { weight: '900' });
    c.restore();
    frect(c, x - 4 * s, y + 7 * s, 8 * s, 3 * s, '#2a1e18');
    c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); sk(c, '#5a1e0e', 1.2);
  }
  function signV(c, x, y, w, h, str, bg, fg, frame = '#3a2618') {
    frect(c, x - 2, y - 2, w + 4, h + 4, frame); frect(c, x, y, w, h, bg);
    const n = [...str].length, size = Math.min(w * .8, (h - 4) / n / 1.04);
    txtV(c, str, x + w / 2, y + (h - n * size * 1.02) / 2, size, fg, { weight: '900' });
  }
  function signH(c, x, y, w, h, str, bg, fg, frame = '#3a2618') {
    frect(c, x - 2, y - 2, w + 4, h + 4, frame); frect(c, x, y, w, h, bg);
    txt(c, str, x + w / 2, y + h / 2 + 1, Math.min(h * .76, (w - 6) / [...str].length), fg, { weight: '900' });
  }
  function nobori(c, x, by, h, col, str, tcol = '#fff4e2') {
    line(c, x, by, x, by - h, OUT, 4); line(c, x, by, x, by - h, '#b89a6a', 2);
    line(c, x, by - h + 4, x - 16, by - h + 4, '#b89a6a', 2);
    frect(c, x - 17, by - h + 5, 15, h * .7, col); frect(c, x - 6, by - h + 5, 4, h * .7, 'rgba(0,0,0,.18)');
    srect(c, x - 17, by - h + 5, 15, h * .7, OUT, 1.1);
    txtV(c, str, x - 9.5, by - h + 8, 10, tcol, { weight: '900' });
  }
  function woodDoor(c, x, y, w, h) {
    frect(c, x - 2, y - 2, w + 4, h + 2, DW.deep); frect(c, x, y, w, h, WOOD.dark);
    c.strokeStyle = 'rgba(30,15,8,.4)'; c.lineWidth = 1; c.beginPath(); for (let i = x + 6; i < x + w; i += 6) { c.moveTo(i, y + 2); c.lineTo(i, y + h); } c.stroke();
    frect(c, x, y, 3, h, 'rgba(255,230,190,.2)');
  }
  function doorway(c, x, y, w, h) { frect(c, x, y, w, h, '#22160f'); frect(c, x + 3, y + h * .45, w - 6, h * .55 - 2, 'rgba(255,186,100,.32)'); frect(c, x - 4, y + h, w + 8, 5, '#a59f92'); srect(c, x, y, w, h, OUT, 1.5); }
  function bucketsAt(c, x, y, s = 1) {
    const one = (bx, byy) => {
      fell(c, bx, byy, 9 * s, 3.6 * s, WOOD.dark);
      fpoly(c, [bx - 9 * s, byy - 10 * s, bx + 9 * s, byy - 10 * s, bx + 8 * s, byy, bx - 8 * s, byy], '#c9a06a');
      frect(c, bx - 9 * s, byy - 8 * s, 18 * s, 1.6 * s, '#5a3a22'); frect(c, bx - 8.5 * s, byy - 3 * s, 17 * s, 1.6 * s, '#5a3a22');
      frect(c, bx + 3 * s, byy - 10 * s, 5 * s, 10 * s, 'rgba(90,50,20,.22)');
      fell(c, bx, byy - 10 * s, 9 * s, 3.4 * s, '#e0c08a'); fell(c, bx, byy - 9.6 * s, 7 * s, 2.4 * s, '#6a4a2c');
      c.beginPath(); c.ellipse(bx, byy - 10 * s, 9 * s, 3.4 * s, 0, 0, TAU); sk(c, OUT, 1);
      poly(c, [bx - 9 * s, byy - 10 * s, bx - 8 * s, byy, bx + 8 * s, byy, bx + 9 * s, byy - 10 * s]); sk(c, OUT, 1.1);
    };
    fell(c, x + 8 * s, y + 2, 30 * s, 6 * s, 'rgba(30,22,14,.26)');
    one(x - 18 * s, y); one(x, y + 1); one(x + 18 * s, y);
    one(x - 9 * s, y - 11 * s); one(x + 9 * s, y - 11 * s); one(x, y - 22 * s);
  }
  function barrelsAt(c, x, y, s = 1, lab = '酒') {
    const one = (bx, byy) => {
      const p = new Path2D(); p.ellipse(bx, byy - 11 * s, 12 * s, 13 * s, 0, 0, TAU);
      celFill(c, p, '#e4d4a6', '#f6ead0', '#b8a274', { ld: 3, dd: 4 });
      c.save(); c.clip(p);
      c.strokeStyle = 'rgba(120,96,52,.55)'; c.lineWidth = 1; c.beginPath(); for (let i = -12; i <= 12; i += 3) { c.moveTo(bx + i * s, byy - 24 * s); c.lineTo(bx + i * s, byy + 2 * s); } c.stroke();
      frect(c, bx - 13 * s, byy - 19 * s, 26 * s, 2.4 * s, '#5a3a22'); frect(c, bx - 13 * s, byy - 5 * s, 26 * s, 2.4 * s, '#5a3a22');
      frect(c, bx - 6 * s, byy - 16 * s, 12 * s, 10 * s, '#b8322a'); txt(c, lab, bx, byy - 11 * s, 8 * s, '#fff4e0', { weight: '900' });
      c.restore(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(p);
    };
    fell(c, x + 8 * s, y + 2, 34 * s, 7 * s, 'rgba(30,22,14,.26)');
    one(x - 13 * s, y); one(x + 13 * s, y); one(x, y - 22 * s);
  }
  function chimney(c, cx, top, w, bot) {
    const h = bot - top;
    frect(c, cx - w / 2, top, w, h, '#8c4a36');
    c.strokeStyle = 'rgba(50,22,14,.45)'; c.lineWidth = 1; c.beginPath();
    for (let y = top + 6; y < bot; y += 6) { c.moveTo(cx - w / 2, y); c.lineTo(cx + w / 2, y); }
    for (let y = top, r = 0; y < bot; y += 6, r++) for (let x = cx - w / 2 + (r % 2) * 5; x < cx + w / 2; x += 10) { c.moveTo(x, y); c.lineTo(x, y + 6); }
    c.stroke();
    frect(c, cx - w / 2, top, w * .3, h, 'rgba(255,230,200,.2)'); frect(c, cx + w * .2, top, w * .3, h, 'rgba(40,10,5,.25)');
    for (const by of [top + 14, top + h * .45]) { frect(c, cx - w / 2 - 2, by, w + 4, 5, '#5a2e22'); }
    frect(c, cx - w / 2 - 4, top - 6, w + 8, 8, '#4a2a20'); frect(c, cx - w / 2 - 4, top - 6, w + 8, 2, '#8a5a48');
    txtV(c, 'ゆ', cx, top + 24, 13, '#f6ecd8');
    srect(c, cx - w / 2, top, w, h, OUT, 1.6); srect(c, cx - w / 2 - 4, top - 6, w + 8, 8, OUT, 1.4);
  }

  // ------------------------------------------------------------------ house variants (footprint 340x300, overhang up to 126 above)
  function vRyokan(c, P) {
    const { R, R2, W } = P;
    dropShadow(c, 2, -10, 334, 294);
    roofJ(c, -6, -64, 352, 156, R, { rf: .3, hip: 62, flare: true });
    wallJ(c, 12, 88, 316, 80, W, { posts: 64, found: 0, eave: 10 });
    for (let i = 0; i < 5; i++) shoji(c, 22 + i * 63, 104, 42, 34, (i + P.idx) % 2 === 0);
    railing(c, 8, 138, 324, 26, P.rail);
    for (let i = 0; i < 4; i++) { const x = 46 + i * 82; frect(c, x, 132, 3, 10, '#5a3a22'); frect(c, x - 9, 142, 22, 14, ['#f6f0e2', '#e8b0a0', '#a8c8e0', '#f6f0e2'][(i + P.idx) % 4]); }
    pent(c, -4, 168, 348, 24, R2);
    wallJ(c, 10, 192, 320, 104, W, { posts: 80, koshi: 34, eave: 9 });
    koshi(c, 26, 210, 74, 40, true); koshi(c, 240, 210, 74, 40, false);
    doorway(c, 128, 210, 84, 84);
    noren(c, 130, 210, 80, 44, P.nc, ['', '湯', ''], '#fff4e2');
    for (const px of [112, 222]) { frect(c, px, 200, 8, 96, P.pil); frect(c, px, 200, 3, 96, 'rgba(255,240,220,.3)'); srect(c, px, 200, 8, 96, OUT, 1.2); }
    karahafu(c, 170, 204, 132, 50, R2, { mark: P.idx % 2 ? '♨' : '宿' });
    chochin(c, 100, 222, 1.35); chochin(c, 240, 222, 1.35);
    signV(c, 316, 200, 18, 64, P.idx % 2 ? '湯宿' : '旅館', '#f4ead2', '#2a1a12');
    bucketsAt(c, 40, 298, .8);
    for (const [x, y] of [[262, 296], [292, 298]]) { fell(c, x + 4, y, 12, 4, 'rgba(30,22,14,.3)'); fpoly(c, [x - 9, y - 12, x + 9, y - 12, x + 7, y, x - 7, y], '#8a5a3a'); fell(c, x, y - 18, 11, 9, '#3d6a3c'); fell(c, x - 2, y - 20, 7, 5, '#5c8c4e'); }
    P.lamps.push([100, 222], [240, 222]);
  }
  function vShop(c, P) {
    const { R, R2, W, W2 } = P;
    dropShadow(c, 2, -40, 334, 294);
    const gy = gableJ(c, 198, -76, 134, 122, 46, R, W, { crest: '湯' });
    wallJ(c, 198, gy, 134, 296 - gy, W, { posts: 66, koshi: 30, eave: 0, mid: 96 });
    shoji(c, 214, gy + 24, 42, 32, true); shoji(c, 276, gy + 24, 42, 32, false);
    railing(c, 202, gy + 52, 126, 22, P.rail, 62);
    doorway(c, 236, 226, 62, 70);
    noren(c, 238, 226, 58, 34, P.nc2, ['御', '宿'], '#fff4e2');
    roofJ(c, -2, 40, 206, 122, R2, { rf: .32, hip: 40 });
    wallJ(c, 4, 160, 196, 136, W2, { found: 8 });
    signH(c, 30, 168, 144, 26, P.idx ? '温泉饅頭' : '湯の土産', '#2a1c15', '#f6dfa0', '#6a4428');
    pent(c, -2, 198, 206, 18, R);
    frect(c, 12, 216, 180, 72, '#2a1c15');
    frect(c, 14, 218, 176, 66, 'rgba(255,190,110,.18)');
    // shelves of souvenirs and hanging tenugui towels
    const TW = ['#d8564a', '#3a6aa8', '#f2e6c8', '#4a8a5a', '#e8a23a', '#8a4a9a'];
    for (let i = 0; i < 9; i++) { const x = 18 + i * 19; frect(c, x, 220, 13, 20, TW[(i + P.idx) % 6]); frect(c, x + 9, 220, 4, 20, 'rgba(0,0,0,.2)'); line(c, x, 220, x + 13, 220, '#5a3a22', 2); }
    frect(c, 16, 246, 172, 3, WOOD.light);
    for (let i = 0; i < 8; i++) { const x = 22 + i * 21; frect(c, x, 236, 16, 10, i % 2 ? '#f4e2c8' : '#e8a8a0'); srect(c, x, 236, 16, 10, 'rgba(40,20,10,.6)', 1); }
    frect(c, 8, 262, 188, 28, WOOD.base); frect(c, 8, 262, 188, 5, WOOD.light); srect(c, 8, 262, 188, 28, OUT, 1.4);
    for (let i = 0; i < 6; i++) { const x = 24 + i * 30; frect(c, x - 10, 252, 22, 10, '#f6ecd8'); frect(c, x - 10, 252, 22, 3, '#b8322a'); srect(c, x - 10, 252, 22, 10, OUT, 1); for (let k = 0; k < 3; k++) fell(c, x - 5 + k * 6, 257, 2.6, 2, i % 2 ? '#a0603a' : '#f8f0e0'); }
    nobori(c, 8, 300, 104, '#b8322a', P.idx ? '名物' : '土産');
    nobori(c, 196, 300, 100, P.nc, '湯の里');
    chochin(c, 224, 222, 1.2, '#ec7a2c', '湯'); P.lamps.push([224, 222], [100, 214]);
    chochin(c, 100, 212, 1.1);
  }
  function vSento(c, P) {
    const { R, R2, W } = P;
    dropShadow(c, 0, -20, 336, 294);
    chimney(c, 290, -116, 26, 40);
    roofJ(c, -4, -34, 348, 176, R, { rf: .34, hip: 72, flare: true });
    // raised steam vent (koshi-yane) on the ridge
    frect(c, 116, -40, 108, 22, '#2b1e17');
    c.strokeStyle = DW.light; c.lineWidth = 2; c.beginPath(); for (let x = 120; x < 222; x += 6) { c.moveTo(x, -40); c.lineTo(x, -18); } c.stroke();
    srect(c, 116, -40, 108, 22, OUT, 1.5);
    roofJ(c, 104, -78, 132, 42, R2, { rf: .42, hip: 24, oni: true });
    wallJ(c, 8, 142, 324, 154, W, { posts: 54, koshi: 46, eave: 10, mid: 58 });
    for (const x of [24, 70, 230, 276]) koshi(c, x, 160, 36, 24, x === 70 || x === 276);
    doorway(c, 116, 210, 108, 86);
    noren(c, 118, 210, 50, 50, '#2b3f70', ['男'], '#fff4e2'); noren(c, 172, 210, 50, 50, '#a8322a', ['女'], '#fff4e2');
    for (const px of [100, 232]) { frect(c, px, 200, 9, 96, '#b8322a'); frect(c, px, 200, 3, 96, 'rgba(255,220,200,.35)'); srect(c, px, 200, 9, 96, OUT, 1.2); }
    karahafu(c, 170, 204, 164, 64, R2, { mark: 'ゆ' });
    signV(c, 18, 196, 20, 60, '湯屋', '#f4ead2', '#2a1a12');
    bucketsAt(c, 270, 298, .9);
    frect(c, 36, 280, 50, 6, WOOD.light); frect(c, 40, 286, 4, 10, WOOD.dark); frect(c, 78, 286, 4, 10, WOOD.dark); srect(c, 36, 280, 50, 6, OUT, 1);
    chochin(c, 88, 222, 1.3, '#ec7a2c', 'ゆ'); chochin(c, 252, 222, 1.3, '#ec7a2c', 'ゆ');
    P.lamps.push([88, 222], [252, 222]);
  }
  function vTea(c, P) {
    const { R, W } = P;
    dropShadow(c, 4, 60, 330, 286);
    roofJ(c, -4, 28, 348, 152, R, { rf: .34, hip: 74, flare: true });
    wallJ(c, 12, 176, 316, 92, W, { posts: 62, found: 0, eave: 10 });
    frect(c, 90, 192, 160, 70, '#3a2a1f'); frect(c, 94, 236, 152, 26, '#cdbb7e');
    c.strokeStyle = '#7a6a3a'; c.lineWidth = 1.2; c.beginPath(); for (const x of [132, 170, 208]) { c.moveTo(x, 236); c.lineTo(x, 262); } c.moveTo(94, 249); c.lineTo(246, 249); c.stroke();
    frect(c, 94, 196, 152, 40, 'rgba(255,190,110,.2)');
    fell(c, 170, 246, 14, 5, '#5a3a22'); fell(c, 164, 243, 4, 3, '#e8e0d0'); fell(c, 176, 244, 4, 3, '#e8e0d0');
    shoji(c, 22, 192, 58, 62, false); shoji(c, 260, 192, 58, 62, true);
    noren(c, 104, 178, 132, 24, '#a8322a', ['甘', '味', '処'], '#fff4e2');
    // engawa veranda
    frect(c, 4, 266, 332, 12, WOOD.light); frect(c, 4, 278, 332, 14, DW.base);
    c.strokeStyle = WOOD.dark; c.lineWidth = 1; c.beginPath(); for (let x = 10; x < 336; x += 12) { c.moveTo(x, 266); c.lineTo(x, 278); } c.stroke();
    srect(c, 4, 266, 332, 26, OUT, 1.5);
    for (const px of [8, 104, 230, 326]) { frect(c, px, 176, 7, 104, DW.base); frect(c, px, 176, 2, 104, DW.light); srect(c, px, 176, 7, 104, OUT, 1); }
    // red bench, parasol and the tea flag
    frect(c, 30, 286, 76, 8, '#c0392b'); frect(c, 30, 286, 76, 3, '#e0604a'); frect(c, 34, 294, 4, 6, DW.dark); frect(c, 98, 294, 4, 6, DW.dark); srect(c, 30, 286, 76, 8, OUT, 1);
    line(c, 70, 298, 76, 196, OUT, 4); line(c, 70, 298, 76, 196, '#b89a6a', 2);
    const um = new Path2D(); um.moveTo(16, 214); um.quadraticCurveTo(76, 168, 136, 214); um.quadraticCurveTo(76, 228, 16, 214); um.closePath();
    celFill(c, um, '#c8382a', '#e2604a', '#962418', { ld: 5, dd: 6 });
    c.save(); c.clip(um); c.strokeStyle = 'rgba(90,20,10,.4)'; c.lineWidth = 1.2; c.beginPath(); for (let i = -4; i <= 4; i++) { c.moveTo(76, 190); c.lineTo(76 + i * 16, 228); } c.stroke(); c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(um); fell(c, 76, 190, 3, 2, '#2a1a12');
    nobori(c, 334, 296, 96, '#2b3f70', 'お茶');
    signV(c, 300, 196, 16, 46, '茶屋', '#f4ead2', '#2a1a12');
    chochin(c, 96, 196, 1.1); P.lamps.push([96, 196], [252, 214]);
  }
  function vInnTower(c, P) {
    const { R, R2, W, W2 } = P;
    dropShadow(c, 8, -70, 324, 294);
    roofJ(c, 222, 96, 120, 100, R2, { rf: .34, hip: 30 });
    wallJ(c, 228, 192, 108, 104, W2, { posts: 52, koshi: 30 });
    shoji(c, 244, 210, 76, 34, true);
    roofJ(c, -2, -124, 250, 100, R, { rf: .34, hip: 58, flare: true });
    wallJ(c, 16, -26, 214, 68, W, { posts: 53, found: 0, eave: 9 });
    for (let i = 0; i < 4; i++) shoji(c, 28 + i * 52, -12, 34, 26, i !== 1);
    railing(c, 12, 14, 222, 22, P.rail, 54);
    pent(c, 2, 42, 242, 20, R2);
    wallJ(c, 14, 62, 218, 76, W, { posts: 54, found: 0, eave: 8 });
    for (let i = 0; i < 4; i++) shoji(c, 26 + i * 52, 76, 34, 28, i % 2 === 0);
    railing(c, 10, 108, 226, 24, P.rail, 56);
    pent(c, 0, 138, 246, 22, R2);
    for (let i = 0; i < 5; i++) chochin(c, 24 + i * 50, 172, .9);
    wallJ(c, 12, 160, 222, 136, W, { posts: 74, koshi: 36, eave: 9 });
    koshi(c, 26, 190, 52, 40, true); koshi(c, 168, 190, 52, 40, false);
    doorway(c, 90, 196, 66, 98);
    noren(c, 92, 196, 62, 46, P.nc, ['湯', 'の', '宿'], '#fff4e2');
    signV(c, -2, 170, 18, 96, P.idx ? '雪月荘' : '湯煙荘', '#2a1c15', '#f6dfa0', '#6a4428');
    chochin(c, 82, 206, 1.25); chochin(c, 164, 206, 1.25);
    P.lamps.push([82, 206], [164, 206], [124, 172]);
  }
  function vRoten(c, P) {
    const { R, R2, W } = P;
    dropShadow(c, 2, -40, 334, 184);
    roofJ(c, -4, -70, 348, 140, R, { rf: .32, hip: 62, flare: true });
    wallJ(c, 10, 66, 320, 116, W, { posts: 64, mid: 58, eave: 10 });
    for (let i = 0; i < 5; i++) shoji(c, 22 + i * 63, 82, 42, 26, i % 2 === 1);
    railing(c, 6, 98, 328, 22, P.rail);
    koshi(c, 30, 136, 70, 30, true); koshi(c, 240, 136, 70, 30, false);
    doorway(c, 140, 128, 60, 52); noren(c, 142, 128, 56, 26, P.nc, ['', '湯', ''], '#fff4e2');
    // walled garden with a private rock bath
    frect(c, 6, 182, 328, 114, '#a69d8c');
    c.strokeStyle = 'rgba(80,70,55,.35)'; c.lineWidth = 1; c.beginPath(); for (let y = 188; y < 294; y += 6) { c.moveTo(8, y); c.lineTo(332, y); } c.stroke();
    const R0 = rng(77 + P.idx), wp = new Path2D(); wp.ellipse(130, 236, 100, 40, 0, 0, TAU);
    c.fillStyle = WATER.deep; c.fill(wp);
    c.save(); c.clip(wp); fell(c, 120, 240, 90, 32, WATER.base); fell(c, 110, 244, 60, 18, WATER.light); fell(c, 130, 206, 104, 12, 'rgba(20,60,70,.35)');
    c.strokeStyle = 'rgba(240,255,250,.5)'; c.lineWidth = 1.4; for (const [x, y, r] of [[90, 236, 14], [150, 248, 10], [170, 228, 8]]) { c.beginPath(); c.ellipse(x, y, r, r * .35, 0, 0, TAU); c.stroke(); }
    c.restore();
    const rim = []; for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; rim.push([130 + Math.cos(a) * 104, 236 + Math.sin(a) * 43, 7 + R0() * 6]); }
    rim.sort((a, b) => a[1] - b[1]); for (const [x, y, r] of rim) boulder(c, x, y + 3, r, R0, R0() < .5);
    // bamboo spout
    line(c, 20, 196, 52, 214, OUT, 6); line(c, 20, 196, 52, 214, '#8aa84a', 4); line(c, 52, 214, 54, 230, 'rgba(220,250,250,.8)', 2.2);
    bucketsAt(c, 210, 280, .6);
    // changing shed
    roofJ(c, 244, 168, 90, 50, R2, { rf: .36, hip: 20, oni: false });
    wallJ(c, 250, 214, 78, 66, W, { posts: 39, koshi: 18 });
    doorway(c, 272, 230, 34, 48); noren(c, 273, 230, 32, 22, '#a8322a', ['ゆ'], '#fff4e2');
    // low bamboo fence along the front and sides
    for (const [x0, x1] of [[4, 336]]) {
      frect(c, x0, 268, x1 - x0, 28, '#c9b06a');
      for (let x = x0; x < x1; x += 6) { frect(c, x, 268, 5, 28, x % 12 ? '#b89a50' : '#d8c27a'); frect(c, x + 4, 268, 1, 28, 'rgba(60,40,10,.4)'); }
      for (const y of [274, 288]) { frect(c, x0, y, x1 - x0, 3, '#5a4020'); }
      srect(c, x0, 268, x1 - x0, 28, OUT, 1.5);
    }
    for (const x of [4, 330]) { frect(c, x, 182, 6, 90, '#b89a50'); srect(c, x, 182, 6, 90, OUT, 1); }
    chochin(c, 130, 140, 1.2); chochin(c, 322, 196, 1.1);
    P.lamps.push([130, 140], [322, 196]);
  }
  function vMachiya(c, P) {
    const { R, R2, W } = P;
    dropShadow(c, 2, -10, 336, 294);
    roofJ(c, -4, -32, 348, 136, R, { rf: .28, hip: 0 });
    for (const x of [-6, 330]) { wallJ(c, x, 56, 16, 56, W, { found: 0, eave: 0, beam: false }); pent(c, x - 4, 46, 24, 12, R); }
    wallJ(c, 6, 104, 328, 70, W, { found: 0, eave: 12 });
    for (const x of [36, 140, 244]) mushiko(c, x, 124, 60, 30, W);
    if (!P.idx) signH(c, 110, 160, 120, 22, '湯隠酒造', '#2a1c15', '#f6dfa0', '#6a4428');
    else signH(c, 110, 160, 120, 22, '湯の花菓子', '#f4ead2', '#8a2a1a', '#6a4428');
    pent(c, -4, 172, 348, 22, R2);
    frect(c, 6, 194, 328, 94, DW.base);
    koshi(c, 20, 206, 118, 64, true); koshi(c, 238, 206, 84, 64, false);
    doorway(c, 154, 204, 70, 84);
    noren(c, 156, 204, 66, 46, P.nc, P.idx ? ['菓', '子'] : ['酒', '蔵'], '#fff4e2');
    wallJ(c, 6, 288, 328, 8, PL[3], { found: 8, eave: 0, beam: false });
    srect(c, 6, 194, 328, 102, OUT, 2);
    if (!P.idx) {
      line(c, 146, 196, 146, 206, '#2a1e18', 2);
      const sg = new Path2D(); sg.arc(146, 218, 13, 0, TAU);
      celFill(c, sg, '#6a7a3a', '#8a9a4a', '#4a5a28', { ld: 3, dd: 4 });
      c.save(); c.clip(sg); c.strokeStyle = 'rgba(40,50,20,.5)'; c.lineWidth = 1; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; line(c, 146, 218, 146 + Math.cos(a) * 13, 218 + Math.sin(a) * 13, 'rgba(40,50,20,.4)', 1); } c.restore();
      c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(sg);
      barrelsAt(c, 292, 298, 1);
    } else {
      for (let i = 0; i < 3; i++) { const x = 258 + i * 26; fell(c, x, 294, 12, 5, '#8a5a32'); for (let k = 0; k < 4; k++) fell(c, x - 6 + (k % 2) * 10, 290 - Math.floor(k / 2) * 5, 4, 4, '#e8782a'); }
      chochin(c, 146, 218, 1.4, '#ec7a2c', '菓');
    }
    chochin(c, 232, 214, 1.1); P.lamps.push([232, 214], [146, 218]);
    bucketsAt(c, 40, 298, .7);
  }

  // ------------------------------------------------------------------ onsen palace (footprint 440x400, overhang 240)
  function heron(c, x, y) {
    fpoly(c, [x - 12, y + 2, x + 10, y - 2, x + 14, y + 4, x - 4, y + 7], '#f6f2ea');
    fpoly(c, [x - 2, y + 1, x - 14, y - 10, x - 4, y - 4], '#e8e2d6');
    c.beginPath(); c.moveTo(x + 8, y); c.quadraticCurveTo(x + 6, y - 10, x + 12, y - 13); sk(c, '#f6f2ea', 3);
    line(c, x + 12, y - 13, x + 18, y - 12, '#d9a93a', 1.6);
    poly(c, [x - 12, y + 2, x + 10, y - 2, x + 14, y + 4, x - 4, y + 7]); sk(c, OUT, 1);
    line(c, x - 2, y + 6, x - 2, y + 12, '#d9a93a', 1.5);
  }
  function lmPalace(c, P) {
    const R = tone('#3d4551'), R2 = tone('#4a5361'), W = tone('#f3e9d3'), RD = '#b8322a';
    dropShadow(c, 0, -80, 440, 384);
    // stone podium
    frect(c, -4, 350, 448, 34, '#8e897f'); frect(c, -4, 350, 448, 4, '#c2bcaf');
    c.strokeStyle = 'rgba(50,45,40,.45)'; c.lineWidth = 1; c.beginPath();
    for (const y of [362, 373]) { c.moveTo(-4, y); c.lineTo(444, y); }
    for (let r = 0; r < 3; r++) for (let x = -4 + (r % 2) * 18; x < 444; x += 36) { c.moveTo(x, 350 + r * 11.3); c.lineTo(x, 361 + r * 11.3); }
    c.stroke(); srect(c, -4, 350, 448, 34, OUT, 2);
    // tower (shinrokaku) with red-glass windows and the white heron
    wallJ(c, 180, -150, 80, 64, W, { posts: 40, found: 0, eave: 8 });
    for (const x of [188, 224]) { frect(c, x, -138, 28, 30, '#7a1a12'); frect(c, x + 2, -136, 24, 26, '#d84a2a'); c.strokeStyle = '#ffb07a'; c.lineWidth = 1; c.beginPath(); for (let k = 1; k < 4; k++) { c.moveTo(x + 2 + k * 6, -136); c.lineTo(x + 2 + k * 6, -110); } c.moveTo(x + 2, -123); c.lineTo(x + 26, -123); c.stroke(); }
    railing(c, 176, -104, 88, 16, RD, 44);
    roofJ(c, 164, -214, 112, 70, R, { rf: .46, hip: 42, flare: true, oni: false });
    line(c, 220, -184, 220, -198, '#d9a93a', 3); fell(c, 220, -199, 4, 3, '#d9a93a');
    heron(c, 220, -210);
    // third tier
    roofJ(c, 78, -98, 284, 100, R, { rf: .36, hip: 66, flare: true });
    gableJ(c, 186, -104, 68, 40, 26, R, W, { crest: '湯' });
    wallJ(c, 100, -4, 240, 62, W, { posts: 60, found: 0, eave: 10 });
    for (let i = 0; i < 5; i++) shoji(c, 112 + i * 45, 10, 30, 26, true);
    railing(c, 94, 32, 252, 24, RD, 63);
    // second tier
    roofJ(c, 28, 52, 384, 92, R2, { rf: .34, hip: 62, flare: true });
    gableJ(c, 166, 40, 108, 52, 36, R2, W, { crest: '♨' });
    wallJ(c, 44, 140, 352, 66, W, { posts: 58, found: 0, eave: 10 });
    for (let i = 0; i < 7; i++) shoji(c, 56 + i * 48, 154, 32, 26, i !== 3);
    signH(c, 170, 150, 100, 28, '湯隠れの里', '#1e140e', '#e8c060', '#c9a040');
    railing(c, 38, 182, 364, 24, RD, 61);
    // ground tier
    roofJ(c, -10, 200, 460, 80, R, { rf: .32, hip: 54, flare: true });
    wallJ(c, 8, 276, 424, 76, W, { posts: 70, koshi: 26, eave: 10, found: 0 });
    for (const x of [24, 84, 316, 376]) shoji(c, x, 292, 40, 26, true);
    for (const px of [8, 78, 362, 425]) { frect(c, px, 276, 7, 76, RD); frect(c, px, 276, 2, 76, 'rgba(255,220,200,.35)'); }
    // entrance porch under a great karahafu
    doorway(c, 158, 292, 124, 60);
    noren(c, 160, 292, 120, 40, '#2b3f70', ['大', '湯', '殿'], '#fff4e2');
    for (const px of [140, 292]) { frect(c, px, 286, 10, 68, RD); frect(c, px, 286, 3, 68, 'rgba(255,220,200,.35)'); srect(c, px, 286, 10, 68, OUT, 1.3); fell(c, px + 5, 286, 7, 3, '#d9a93a'); }
    karahafu(c, 220, 288, 186, 70, R2, { mark: '♨', board: '#f0e2c4' });
    chochin(c, 128, 304, 1.6, '#ec7a2c', '湯'); chochin(c, 312, 304, 1.6, '#ec7a2c', '湯');
    for (let i = 0; i < 3; i++) { const w = 132 + i * 24, y = 384 + i * 6; frect(c, 220 - w / 2, y, w, 6, i % 2 ? '#a8a296' : '#bcb6a9'); srect(c, 220 - w / 2, y, w, 6, OUT, 1.1); }
    // ♨ banners either side of the steps
    for (const bx of [100, 356]) {
      line(c, bx, 396, bx, 262, OUT, 5); line(c, bx, 396, bx, 262, '#b89a6a', 3);
      line(c, bx, 266, bx - 22, 266, '#b89a6a', 3);
      frect(c, bx - 22, 268, 20, 92, RD); frect(c, bx - 7, 268, 5, 92, 'rgba(0,0,0,.2)'); srect(c, bx - 22, 268, 20, 92, OUT, 1.3);
      fell(c, bx - 12, 290, 8, 8, '#f6ecd8'); onsenMark(c, bx - 12, 291, .45, RD, 3);
      txtV(c, '湯隠', bx - 12, 304, 12, '#fff4e2');
    }
    P.lamps.push([128, 304], [312, 304], [220, -126], [220, 160]);
  }

  // ------------------------------------------------------------------ trees & props
  function drawPine(c, ax, ay, s, seed) {
    const R = rng(seed);
    fell(c, ax + 20 * s, ay, 36 * s, 9 * s, 'rgba(25,20,14,.28)');
    const tr = new Path2D(); tr.moveTo(ax - 6 * s, ay); tr.quadraticCurveTo(ax - 20 * s, ay - 42 * s, ax + 4 * s, ay - 86 * s); tr.lineTo(ax + 11 * s, ay - 84 * s); tr.quadraticCurveTo(ax - 7 * s, ay - 42 * s, ax + 7 * s, ay); tr.closePath();
    celFill(c, tr, '#5e4838', '#7e6450', '#40302a', { ld: 2.5 * s, dd: 3 * s }); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(tr);
    line(c, ax - 8 * s, ay - 40 * s, ax - 30 * s, ay - 54 * s, '#5e4838', 4 * s); line(c, ax + 2 * s, ay - 58 * s, ax + 26 * s, ay - 70 * s, '#5e4838', 3.5 * s);
    const pads = [[-32, -58, 25, 10], [28, -72, 27, 11], [-6, -96, 23, 9], [10, -116, 15, 7], [36, -46, 15, 6], [-40, -84, 14, 6]];
    pads.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, rx, ry] of pads) {
      const x = ax + dx * s + (R() - .5) * 4 * s, y = ay + dy * s;
      fell(c, x, y, (rx + 2.5) * s, (ry + 2.5) * s, PINE.out);
      fell(c, x, y, rx * s, ry * s, PINE.dark);
      fell(c, x - 3 * s, y - 2.5 * s, rx * .82 * s, ry * .7 * s, PINE.mid);
      fell(c, x - 7 * s, y - 4 * s, rx * .45 * s, ry * .36 * s, PINE.light);
      c.strokeStyle = PINE.out; c.lineWidth = 1; c.beginPath();
      for (let k = -2; k <= 2; k++) { const px = x + k * rx * .34 * s; c.moveTo(px, y + ry * .55 * s); c.lineTo(px + 2 * s, y + ry * .95 * s); } c.stroke();
      fell(c, x - 8 * s, y - 5 * s, 2 * s, 1.2 * s, PINE.hi);
    }
  }
  function drawCedar(c, ax, ay, s, seed) {
    const R = rng(seed);
    fell(c, ax + 16 * s, ay, 26 * s, 7 * s, 'rgba(25,20,14,.3)');
    frect(c, ax - 4 * s, ay - 26 * s, 8 * s, 26 * s, '#5a3e2c'); frect(c, ax - 4 * s, ay - 26 * s, 3 * s, 26 * s, '#7a5a40'); srect(c, ax - 4 * s, ay - 26 * s, 8 * s, 26 * s, OUT, 1.2);
    for (let k = 0; k < 6; k++) {
      const yb = ay - 20 * s - k * 21 * s, wk = (36 - k * 5.4) * s, top = yb - 38 * s, n = 7, pts = [ax, top];
      for (let i = 0; i <= n; i++) { const t = i / n, x = ax + wk - 2 * wk * t, y = yb + (i % 2 ? -5 * s : 2 * s) + (R() - .5) * 2 * s; pts.push(x, y); }
      fpoly(c, pts, CED.dark);
      fpoly(c, [ax, top, ax - wk * .9, yb - 1, ax - wk * .2, yb - 3, ax + wk * .1, top + 14 * s], CED.mid);
      fpoly(c, [ax - 1, top + 4 * s, ax - wk * .6, yb - 4 * s, ax - wk * .35, yb - 6 * s], CED.light);
      poly(c, pts); sk(c, CED.out, 1.4);
    }
    fell(c, ax - 3 * s, ay - 140 * s, 2 * s, 3 * s, CED.hi);
  }
  function drawMaple(c, ax, ay, s, seed, pal) {
    const R = rng(seed), cy = ay - 68 * s;
    fell(c, ax + 26 * s, ay - 2, 44 * s, 11 * s, 'rgba(25,20,14,.26)');
    c.fillStyle = pal.mid; for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(ax - 36 * s + R() * 80 * s, ay - 6 * s + R() * 12 * s, 2.2 * s, 1.3 * s, R() * 3, 0, TAU); c.fill(); }
    const tr = new Path2D(); tr.moveTo(ax - 6 * s, ay); tr.quadraticCurveTo(ax - 2 * s, ay - 30 * s, ax - 10 * s, cy + 14 * s); tr.lineTo(ax + 2 * s, cy + 16 * s); tr.quadraticCurveTo(ax + 6 * s, ay - 30 * s, ax + 7 * s, ay); tr.closePath();
    celFill(c, tr, '#5a3a2a', '#7a5a44', '#3e281c', { ld: 2 * s, dd: 3 * s }); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(tr);
    line(c, ax - 4 * s, cy + 18 * s, ax - 24 * s, cy, '#5a3a2a', 3 * s); line(c, ax + 1 * s, cy + 16 * s, ax + 22 * s, cy - 4 * s, '#5a3a2a', 3 * s);
    const bl = [];
    for (let i = 0; i < 15; i++) { const a = R() * TAU, d = Math.sqrt(R()); bl.push([ax + Math.cos(a) * d * 40 * s, cy + Math.sin(a) * d * 26 * s, (12 + R() * 9) * s]); }
    bl.sort((p, q) => p[1] - q[1]);
    for (const [x, y, r] of bl) fell(c, x, y, r + 2.5 * s, r + 2.2 * s, pal.out);
    for (const [x, y, r] of bl) fell(c, x, y, r, r * .92, pal.dark);
    for (const [x, y, r] of bl) fell(c, x - 1.5 * s, y - 2.5 * s, r * .8, r * .72, pal.mid);
    for (const [x, y, r] of bl) if (x < ax + 14 * s && y < cy + 6 * s) fell(c, x - 4 * s, y - 5 * s, r * .5, r * .42, pal.light);
    c.fillStyle = pal.hi; for (let i = 0; i < 16; i++) { const a = R() * TAU, d = Math.sqrt(R()) * .9, x = ax - 8 * s + Math.cos(a) * d * 36 * s, y = cy - 8 * s + Math.sin(a) * d * 22 * s; c.beginPath(); c.arc(x, y, 1.6 * s, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(40,10,5,.25)'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { const x = ax - 30 * s + R() * 60 * s, y = cy + R() * 20 * s; c.beginPath(); c.arc(x, y, 5 * s, .2, 1.6); c.stroke(); }
  }
  function drawBamboo(c, ax, ay, s, seed) {
    const R = rng(seed), cul = [];
    fell(c, ax + 16 * s, ay, 40 * s, 9 * s, 'rgba(25,20,14,.26)');
    for (let i = 0; i < 8; i++) cul.push([ax - 30 * s + R() * 60 * s, ay - 4 * s + R() * 8 * s, (110 + R() * 40) * s, (R() - .5) * 18 * s]);
    cul.sort((p, q) => p[1] - q[1]);
    for (const [x, y, h, lean] of cul) {
      line(c, x, y, x + lean, y - h, '#2a3a18', 6 * s); line(c, x, y, x + lean, y - h, '#6f9a3e', 4 * s); line(c, x - 1, y, x + lean - 1, y - h, '#a8c86a', 1.2 * s);
      for (let k = 18; k < h; k += 18 * s) { const t = k / h; line(c, x + lean * t - 3 * s, y - k, x + lean * t + 3 * s, y - k, '#3a5a20', 1.6 * s); }
    }
    for (let i = 0; i < 22; i++) {
      const [x, y, h, lean] = cul[i % cul.length], t = .45 + R() * .55, px = x + lean * t, py = y - h * t, dir = R() < .5 ? -1 : 1, L = (14 + R() * 10) * s;
      fpoly(c, [px, py, px + dir * L, py + 4 * s + R() * 6 * s, px + dir * L * .5, py + 5 * s], R() < .5 ? '#5a8a34' : '#7aaa44');
      poly(c, [px, py, px + dir * L, py + 4 * s, px + dir * L * .5, py + 5 * s]); sk(c, '#24361a', .8);
    }
  }
  function drawToro(c, x, y, s = 1) {
    const st = tone('#a39e94');
    fell(c, x + 6 * s, y, 14 * s, 4 * s, 'rgba(28,22,16,.3)');
    frect(c, x - 10 * s, y - 7 * s, 20 * s, 7 * s, st.dark); srect(c, x - 10 * s, y - 7 * s, 20 * s, 7 * s, OUT, 1.1);
    frect(c, x - 4 * s, y - 26 * s, 8 * s, 19 * s, st.base); frect(c, x - 4 * s, y - 26 * s, 3 * s, 19 * s, st.light); srect(c, x - 4 * s, y - 26 * s, 8 * s, 19 * s, OUT, 1.1);
    frect(c, x - 9 * s, y - 31 * s, 18 * s, 5 * s, st.dark); srect(c, x - 9 * s, y - 31 * s, 18 * s, 5 * s, OUT, 1.1);
    frect(c, x - 7 * s, y - 44 * s, 14 * s, 13 * s, st.base);
    frect(c, x - 4 * s, y - 41 * s, 8 * s, 8 * s, '#ffcf72'); frect(c, x - 4 * s, y - 41 * s, 8 * s, 3 * s, '#fff0b8');
    srect(c, x - 7 * s, y - 44 * s, 14 * s, 13 * s, OUT, 1.1);
    const rf = [x - 15 * s, y - 43 * s, x - 6 * s, y - 53 * s, x + 6 * s, y - 53 * s, x + 15 * s, y - 43 * s, x + 11 * s, y - 40 * s, x - 11 * s, y - 40 * s];
    fpoly(c, rf, st.base); fpoly(c, [x - 15 * s, y - 43 * s, x - 6 * s, y - 53 * s, x, y - 53 * s, x, y - 40 * s, x - 11 * s, y - 40 * s], st.light);
    fell(c, x - 5 * s, y - 49 * s, 4 * s, 1.6 * s, ROCK.moss);
    poly(c, rf); sk(c, OUT, 1.2);
    fell(c, x, y - 56 * s, 3 * s, 3.2 * s, st.dark); c.beginPath(); c.arc(x, y - 56 * s, 3 * s, 0, TAU); sk(c, OUT, 1);
  }
  function drawTorii(c, cx, by, w, h, label) {
    const RD = tone('#c8382a'), BK = '#272020', pw = Math.max(10, w * .07);
    for (const px of [cx - w * .36, cx + w * .36]) fell(c, px + 10, by + 2, pw * 1.4, pw * .45, 'rgba(28,22,16,.3)');
    for (const px of [cx - w * .36, cx + w * .36]) {
      frect(c, px - pw / 2, by - h * .88, pw, h * .88, RD.base); frect(c, px - pw / 2, by - h * .88, pw * .3, h * .88, RD.light); frect(c, px + pw * .2, by - h * .88, pw * .3, h * .88, RD.dark);
      frect(c, px - pw / 2 - 2, by - 16, pw + 4, 16, BK); srect(c, px - pw / 2 - 2, by - 16, pw + 4, 16, OUT, 1.2);
      srect(c, px - pw / 2, by - h * .88, pw, h * .88 - 16, OUT, 1.6);
    }
    const nb = by - h * .66, nh = Math.max(8, h * .055);
    frect(c, cx - w * .46, nb, w * .92, nh, RD.base); frect(c, cx - w * .46, nb, w * .92, 3, RD.light); srect(c, cx - w * .46, nb, w * .92, nh, OUT, 1.5);
    const sb = by - h * .86, shh = Math.max(8, h * .05);
    frect(c, cx - w * .45, sb, w * .9, shh, RD.base); frect(c, cx - w * .45, sb + shh - 3, w * .9, 3, RD.dark); srect(c, cx - w * .45, sb, w * .9, shh, OUT, 1.5);
    const pwid = w * .13, ph = nb - sb - shh;
    frect(c, cx - pwid / 2, sb + shh, pwid, ph, BK); frect(c, cx - pwid / 2 + 3, sb + shh + 3, pwid - 6, ph - 6, '#3a2a22'); srect(c, cx - pwid / 2, sb + shh, pwid, ph, '#c9a040', 1.6);
    if (label) txtV(c, label, cx, sb + shh + 4, Math.min(pwid * .7, (ph - 8) / [...label].length), '#e8c060');
    const k = new Path2D(); k.moveTo(cx - w * .56, by - h * 1.0); k.quadraticCurveTo(cx, by - h * .9, cx + w * .56, by - h * 1.0); k.lineTo(cx + w * .5, by - h * .9); k.quadraticCurveTo(cx, by - h * .83, cx - w * .5, by - h * .9); k.closePath();
    c.fillStyle = BK; c.fill(k);
    const k2 = new Path2D(); k2.moveTo(cx - w * .55, by - h * .985); k2.quadraticCurveTo(cx, by - h * .885, cx + w * .55, by - h * .985); c.strokeStyle = 'rgba(255,240,230,.28)'; c.lineWidth = 2; c.stroke(k2);
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(k);
    const k3 = new Path2D(); k3.moveTo(cx - w * .5, by - h * .9); k3.quadraticCurveTo(cx, by - h * .83, cx + w * .5, by - h * .9); k3.lineTo(cx + w * .48, by - h * .86); k3.quadraticCurveTo(cx, by - h * .8, cx - w * .48, by - h * .86); k3.closePath();
    c.fillStyle = RD.base; c.fill(k3); c.stroke(k3);
  }

  // ------------------------------------------------------------------ ground tiles & decals
  function makeGroundTile() {
    const S = 512, cv = mk(S, S), c = cv.getContext('2d'); c.lineCap = 'round';
    frect(c, 0, 0, S, S, GR.base);
    const R = rng(1207);
    for (let i = 0; i < 34; i++) {
      const x = R() * S, y = R() * S, rx = 30 + R() * 100, ry = rx * (.35 + R() * .3), q = R();
      const col = q < .4 ? 'rgba(160,170,100,.32)' : q < .72 ? 'rgba(80,92,48,.28)' : 'rgba(150,128,96,.32)';
      wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, ry, col));
    }
    for (let i = 0; i < 9; i++) {
      const gx = R() * S, gy = R() * S;
      for (let k = 0; k < 40; k++) { const x = gx + (R() - .5) * 90, y = gy + (R() - .5) * 50, r = .9 + R() * 1.8; wrapDraw(S, x, y, 4, (X, Y) => { fell(c, X + .6, Y + .6, r, r * .7, 'rgba(70,60,45,.4)'); fell(c, X, Y, r, r * .7, R() < .5 ? '#a8a08e' : '#bdb4a0'); }); }
    }
    for (let i = 0; i < 380; i++) {
      const x = R() * S, y = R() * S, h = 4 + R() * 5, dark = R() < .55;
      wrapDraw(S, x, y, 10, (X, Y) => {
        c.strokeStyle = dark ? GR.deep : GR.dark; c.lineWidth = 1.3; c.beginPath();
        c.moveTo(X, Y); c.lineTo(X - 3, Y - h * .8); c.moveTo(X, Y); c.lineTo(X + .5, Y - h); c.moveTo(X, Y); c.lineTo(X + 3, Y - h * .7); c.stroke();
        line(c, X + 1, Y - 1, X + 1.5, Y - h * .8, GR.hi, .8);
      });
    }
    for (let i = 0; i < 140; i++) {
      const x = R() * S, y = R() * S, a = R() * Math.PI, col = LEAFC[Math.floor(R() * LEAFC.length)], sz = 1.8 + R() * 1.6;
      wrapDraw(S, x, y, 6, (X, Y) => { c.save(); c.translate(X, Y); c.rotate(a); fell(c, 0, 0, sz * 1.6, sz, col); line(c, -sz * 1.6, 0, sz * 1.6, 0, 'rgba(60,20,10,.35)', .6); c.restore(); });
    }
    for (let i = 0; i < 60; i++) { const x = R() * S, y = R() * S, r = 1.4 + R() * 2.4; wrapDraw(S, x, y, 6, (X, Y) => { fell(c, X + .8, Y + .8, r, r * .7, '#5a5444'); fell(c, X, Y, r, r * .7, '#a49e90'); fell(c, X - r * .3, Y - r * .3, r * .4, r * .3, '#d4cfc2'); }); }
    c.fillStyle = 'rgba(50,60,30,.25)'; for (let i = 0; i < 900; i++) c.fillRect(R() * S, R() * S, 1.4, 1.4);
    c.fillStyle = 'rgba(220,230,170,.25)'; for (let i = 0; i < 500; i++) c.fillRect(R() * S, R() * S, 1.2, 1.2);
    return cv;
  }
  function makeRockTile() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d');
    frect(c, 0, 0, S, S, '#6a665b');
    const R = rng(4401);
    for (let i = 0; i < 70; i++) {
      const x = R() * S, y = R() * S, rx = 6 + R() * 18, ry = rx * (.5 + R() * .25), col = ['#7a766b', '#847f72', '#706b60', '#8c877a'][Math.floor(R() * 4)];
      wrapDraw(S, x, y, rx + 3, (X, Y) => { fell(c, X + 1.5, Y + 1.5, rx, ry, '#4a463e'); fell(c, X, Y, rx, ry, col); fell(c, X - rx * .3, Y - ry * .35, rx * .45, ry * .3, 'rgba(220,214,200,.22)'); });
    }
    for (let i = 0; i < 26; i++) { const x = R() * S, y = R() * S, rx = 10 + R() * 30; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, rx * .45, 'rgba(110,132,60,.4)')); }
    c.fillStyle = 'rgba(30,28,22,.3)'; for (let i = 0; i < 500; i++) c.fillRect(R() * S, R() * S, 1.5, 1.5);
    return cv;
  }
  function makePaveTile(o) {
    const S = 192, RH = o.rh, cv = mk(S, S), c = cv.getContext('2d');
    frect(c, 0, 0, S, S, o.grout);
    const R = rng(o.seed);
    for (let row = 0; row < S / RH; row++) {
      const ws = []; let sum = 0; while (sum < S - o.wmax) { const w = o.wmin + Math.floor(R() * (o.wmax - o.wmin)); ws.push(w); sum += w; } ws.push(S - sum);
      let x = Math.floor(R() * 40);
      for (const w of ws) {
        const col = o.tones[Math.floor(R() * o.tones.length)], y = row * RH;
        for (const ox of [0, -S]) {
          const X = x + ox;
          rrect(c, X + 1.5, y + 1.5, w - 3, RH - 3, 3); c.fillStyle = col; c.fill();
          frect(c, X + 3, y + 2.5, w - 7, 1.5, 'rgba(255,250,240,.3)'); frect(c, X + 3, y + RH - 4, w - 6, 1.5, 'rgba(30,26,20,.25)');
          if (R() < .3) fell(c, X + 5 + R() * (w - 10), y + 5 + R() * (RH - 10), 1.6, 1.1, 'rgba(40,36,30,.3)');
        }
        x += w;
      }
    }
    for (let i = 0; i < 12; i++) { const x = R() * S, y = R() * S, rx = 8 + R() * 18; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, rx * .4, o.drift)); }
    c.fillStyle = 'rgba(200,60,30,.55)'; for (let i = 0; i < 10; i++) { const x = R() * S, y = R() * S; c.beginPath(); c.ellipse(x, y, 2.4, 1.4, R() * 3, 0, TAU); c.fill(); }
    return cv;
  }
  function makeEmblem() {
    const W = 420, H = 300, cv = mk(W, H), c = cv.getContext('2d');
    c.translate(W / 2, H / 2); c.scale(1, .72); c.lineJoin = 'round';
    c.beginPath(); c.arc(0, 0, 196, 0, TAU); c.fillStyle = 'rgba(60,55,48,.16)'; c.fill();
    c.beginPath(); c.arc(0, 0, 196, 0, TAU); sk(c, 'rgba(60,54,46,.5)', 12);
    c.beginPath(); c.arc(0, 0, 184, 0, TAU); sk(c, 'rgba(235,228,214,.45)', 3);
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; fell(c, Math.cos(a) * 160, Math.sin(a) * 160, 7, 7, 'rgba(70,64,56,.35)'); }
    onsenMark(c, 2, 14, 7.6, 'rgba(60,20,12,.35)', 4.2);
    onsenMark(c, 0, 10, 7.6, 'rgba(176,58,40,.85)', 3.4);
    onsenMark(c, -1, 9, 7.6, 'rgba(240,200,170,.35)', 1);
    return cv;
  }
  function makePool(rx, ry, seed, o = {}) {
    const R = rng(seed), pad = 34, W = Math.ceil(rx * 2 + pad * 2), H = Math.ceil(ry * 2 + pad * 2 + 10), cx = W / 2, cy = pad + ry + 4;
    const cv = mk(W, H), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    const ph = [R() * TAU, R() * TAU, R() * TAU], n = 32;
    const kf = a => 1 + .09 * Math.sin(2 * a + ph[0]) + .06 * Math.sin(3 * a + ph[1]) + .04 * Math.sin(5 * a + ph[2]);
    const shape = (sx, sy, ox = 0, oy = 0) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = kf(a); pts.push([cx + ox + Math.cos(a) * rx * k * sx, cy + oy + Math.sin(a) * ry * k * sy]); } return smoothPath(pts); };
    c.fillStyle = 'rgba(50,44,32,.32)'; c.fill(shape(1.18, 1.24, 3, 4));
    c.fillStyle = '#8a8272'; c.fill(shape(1.1, 1.13));
    const wp = shape(1, 1);
    const g = c.createRadialGradient(cx - rx * .1, cy, 4, cx, cy, Math.max(rx, ry) * 1.05);
    g.addColorStop(0, WATER.deep); g.addColorStop(.55, WATER.base); g.addColorStop(1, WATER.light);
    c.fillStyle = g; c.fill(wp);
    c.save(); c.clip(wp);
    const sh = new Path2D(); sh.rect(-1e4, -1e4, 2e4, 2e4); sh.addPath(shape(1, 1, 0, ry * .2)); c.fillStyle = 'rgba(16,64,72,.38)'; c.fill(sh, 'evenodd');
    const li = new Path2D(); li.rect(-1e4, -1e4, 2e4, 2e4); li.addPath(shape(1, 1, 0, -6)); c.fillStyle = 'rgba(214,250,240,.4)'; c.fill(li, 'evenodd');
    c.strokeStyle = 'rgba(240,255,250,.45)'; c.lineWidth = 1.6;
    for (let i = 0; i < Math.max(2, Math.round(rx / 30)); i++) { const x = cx + (R() - .5) * rx * 1.1, y = cy + (R() - .3) * ry * .9, r = 8 + R() * rx * .18; c.beginPath(); c.ellipse(x, y, r, r * .34, 0, .2, Math.PI * 1.3); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(cx - rx * .3 + R() * rx * .5, cy - ry * .2 + R() * ry * .5, 4 + R() * 6, 1.2, 0, 0, TAU); c.fill(); }
    c.restore();
    const rocks = [], m = Math.round(TAU * Math.sqrt((rx * rx + ry * ry) / 2) / 22);
    for (let i = 0; i < m; i++) {
      const a = i / m * TAU + (R() - .5) * .12, k = kf(a), back = Math.sin(a) < 0;
      rocks.push([cx + Math.cos(a) * rx * k * 1.03, cy + Math.sin(a) * ry * k * 1.04, (7 + R() * 8) * (o.rs || 1) * (back ? 1.2 : .9)]);
    }
    for (let i = 0; i < (o.big || 2); i++) { const a = Math.PI * (1.15 + R() * .7), k = kf(a); rocks.push([cx + Math.cos(a) * rx * k * 1.05, cy + Math.sin(a) * ry * k * 1.05, 18 + R() * 8]); }
    rocks.sort((p, q) => p[1] - q[1]);
    for (const [x, y, r] of rocks) boulder(c, x, y + r * .25, r, R, R() < .55);
    const em = [], ne = Math.max(2, Math.min(9, Math.round(rx * ry / 2400)));
    for (let i = 0; i < ne; i++) { const a = R() * TAU, d = Math.sqrt(R()) * .6; em.push([Math.cos(a) * rx * d, Math.sin(a) * ry * d]); }
    return { cv, ax: cx, ay: cy, em, rx, ry };
  }
  function makeStream() {
    const W = STREAM.x1 - STREAM.x0, H = STREAM.y1 - STREAM.y0, cv = mk(W, H), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round'; c.translate(-STREAM.x0, -STREAM.y0);
    const band = (k, add, dy = 0) => { const p = new Path2D(); for (let x = STREAM.x0; x <= STREAM.x1; x += 8) { const y = yc(x) - hw(x) * k - add + dy; x === STREAM.x0 ? p.moveTo(x, y) : p.lineTo(x, y); } for (let x = STREAM.x1; x >= STREAM.x0; x -= 8) p.lineTo(x, yc(x) + hw(x) * k + add + dy); p.closePath(); return p; };
    c.fillStyle = 'rgba(50,44,32,.36)'; c.fill(band(1, 16, 3));
    c.fillStyle = '#857c6c'; c.fill(band(1, 8));
    const wp = band(1, 0);
    c.fillStyle = WATER.light; c.fill(wp);
    c.save(); c.clip(wp);
    c.fillStyle = WATER.base; c.fill(band(.78, 0, 2));
    c.fillStyle = 'rgba(47,158,166,.85)'; c.fill(band(.45, 0, 3));
    c.fillStyle = 'rgba(16,64,72,.35)'; c.fill(band(1, 0, -hw(0) * 1.5));
    const R = rng(5150);
    for (let i = 0; i < 220; i++) {
      const x = STREAM.x0 + R() * W, len = 18 + R() * 46, off = (R() - .5) * 1.5;
      c.strokeStyle = R() < .5 ? 'rgba(235,255,250,.55)' : 'rgba(20,90,100,.35)'; c.lineWidth = 1.2 + R();
      c.beginPath(); for (let t = 0; t <= len; t += 6) { const xx = x + t, yy = yc(xx) + hw(xx) * off * .8 + Math.sin(t * .2 + i) * 1.2; t ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
    }
    c.restore();
    for (const s of [-1, 1]) for (let x = STREAM.x0 + 4; x < STREAM.x1; x += 13 + R() * 15) {
      if (Math.abs(x - 1820) < 104 && s > 0) continue;
      const r = 4.5 + R() * 6.5; boulder(c, x, yc(x) + s * (hw(x) + 4) + r * .2, r, R, R() < .45);
    }
    return cv;
  }
  function makeYubatake() {
    const W = YUBA.w, H = YUBA.h, cv = mk(W, H), c = cv.getContext('2d'); c.lineJoin = 'round';
    fell(c, W / 2 + 8, H - 26, W * .5, 26, 'rgba(40,34,24,.3)');
    const R = rng(777), tw = 30, gap = 14, n = 7, x0 = (W - (n * tw + (n - 1) * gap)) / 2, xe = x0 + n * tw + (n - 1) * gap;
    // stone-flagged surround
    rrect(c, 6, 6, W - 12, 178, 18); c.fillStyle = '#9a958a'; c.fill();
    c.save(); rrect(c, 6, 6, W - 12, 178, 18); c.clip();
    for (let y = 6; y < 186; y += 16) for (let x = 6 - (y % 32 ? 12 : 0); x < W; x += 24) { rrect(c, x + 1, y + 1, 22, 14, 3); c.fillStyle = ['#a9a498', '#9f9a8e', '#b2ada0', '#948f84'][Math.floor(R() * 4)]; c.fill(); }
    c.restore();
    rrect(c, 6, 6, W - 12, 178, 18); sk(c, OUT, 2);
    // feeder channel along the top, then seven wooden troughs running south
    frect(c, x0 - 8, 16, xe - x0 + 16, 20, '#3a5a5a');
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (tw + gap);
      frect(c, x, 24, tw, 140, WATER.deep);
      frect(c, x + 2, 30, tw - 4, 132, WATER.base);
      frect(c, x + 6, 34, tw - 12, 126, WATER.light);
      frect(c, x, 24, tw, 10, 'rgba(10,50,58,.45)');
      frect(c, x, 24, 4, 140, '#e8dc98'); frect(c, x + tw - 4, 24, 4, 140, '#d2c47a'); frect(c, x + 4, 24, 2, 140, 'rgba(200,190,110,.6)');
      c.strokeStyle = 'rgba(250,255,252,.7)'; c.lineWidth = 1.3; c.beginPath();
      for (let k = 0; k < 9; k++) { const fy = 36 + k * 14 + R() * 4, fx = x + tw / 2 + (R() - .5) * 6; c.moveTo(fx - 6, fy); c.lineTo(fx, fy + 4); c.lineTo(fx + 6, fy); } c.stroke();
    }
    frect(c, x0 - 8, 18, xe - x0 + 16, 12, WATER.base); frect(c, x0 - 8, 18, xe - x0 + 16, 4, 'rgba(10,50,58,.4)');
    for (let i = 0; i <= n; i++) {
      const x = i === 0 ? x0 - gap : x0 + i * (tw + gap) - gap;
      frect(c, x, 30, gap, 136, WOOD.base); frect(c, x, 30, gap, 3, WOOD.hi); frect(c, x, 30, 3, 136, WOOD.light); frect(c, x + gap - 3, 30, 3, 136, WOOD.dark);
      srect(c, x, 30, gap, 136, OUT, 1.1);
    }
    frect(c, x0 - gap, 10, xe - x0 + gap * 2, 8, WOOD.dark); frect(c, x0 - gap, 10, xe - x0 + gap * 2, 2, WOOD.light); srect(c, x0 - gap, 10, xe - x0 + gap * 2, 8, OUT, 1.2);
    frect(c, x0 - gap, 164, xe - x0 + gap * 2, 10, '#7a766c'); frect(c, x0 - gap, 164, xe - x0 + gap * 2, 3, '#b8b3a6'); srect(c, x0 - gap, 164, xe - x0 + gap * 2, 10, OUT, 1.3);
    // cascade into the collecting pool
    const pl = new Path2D(); pl.ellipse(W / 2, 200, W * .46, 20, 0, 0, TAU);
    fell(c, W / 2, 202, W * .49, 24, '#857c6c');
    c.fillStyle = WATER.base; c.fill(pl); c.save(); c.clip(pl); fell(c, W / 2, 206, W * .4, 12, WATER.light); fell(c, W / 2, 182, W * .5, 8, 'rgba(10,50,58,.4)'); c.restore();
    for (let i = 0; i < n; i++) { const x = x0 + i * (tw + gap); frect(c, x + 3, 174, tw - 6, 16, 'rgba(232,252,248,.92)'); c.strokeStyle = 'rgba(80,170,175,.55)'; c.lineWidth = 1; c.beginPath(); for (let k = 5; k < tw - 4; k += 5) { c.moveTo(x + k, 174); c.lineTo(x + k, 190); } c.stroke(); fell(c, x + tw / 2, 192, tw * .6, 4, 'rgba(255,255,255,.8)'); }
    const rim = []; for (let i = 0; i < 26; i++) { const a = Math.PI * (i / 25) * .96 + Math.PI * .02; rim.push([W / 2 + Math.cos(a) * W * .47, 202 + Math.sin(a) * 22, 6 + R() * 5]); }
    for (const s of [-1, 1]) rim.push([W / 2 + s * W * .47, 198, 10]);
    rim.sort((a, b) => a[1] - b[1]); for (const [x, y, r] of rim) boulder(c, x, y + 2, r, R, R() < .5);
    return cv;
  }

  // ------------------------------------------------------------------ perimeter pieces
  function makeCliffN() {
    const W = BLOCK, H = 240, cv = mk(W, H), c = cv.getContext('2d'); c.lineJoin = 'round';  // local y = world y - 108
    const top = u => 80 + 22 * wv(u, 1), bot = H - 8;
    const face = new Path2D(); face.moveTo(0, top(0)); for (let u = 8; u <= W; u += 8) face.lineTo(u, top(u)); face.lineTo(W, bot); face.lineTo(0, bot); face.closePath();
    c.save(); c.clip(face);
    const g = c.createLinearGradient(0, 80, 0, bot); g.addColorStop(0, '#a39e92'); g.addColorStop(.45, '#878278'); g.addColorStop(1, '#58544c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const R = rng(3301); let u = 0;
    while (u < W - 1) {
      const u1 = Math.min(W, u + 44 + R() * 70), w = u1 - u;
      c.fillStyle = 'rgba(255,250,235,.14)'; c.fillRect(u, 0, w * .32, H);
      c.fillStyle = 'rgba(25,20,15,.16)'; c.fillRect(u1 - w * .26, 0, w * .26, H);
      if (u1 < W - 8) {
        const cp = new Path2D(), y0 = top(u1) + R() * 24; cp.moveTo(u1, y0); for (let y = y0; y <= bot + 8; y += 10) cp.lineTo(u1 + 3 * Math.sin(y * .07 + u1), y);
        c.strokeStyle = 'rgba(30,26,20,.55)'; c.lineWidth = 2.2; c.stroke(cp);
        c.save(); c.translate(-3, 0); c.strokeStyle = 'rgba(240,235,220,.3)'; c.lineWidth = 1.1; c.stroke(cp); c.restore();
      }
      u = u1;
    }
    for (const [k, j] of [[.33, 1], [.62, 2], [.84, 3]]) {
      const sp = new Path2D(); for (let x = 0; x <= W; x += 8) { const y = top(x) + (bot - top(x)) * k + 5 * Math.sin(TAU * x * 2 / W + j * 1.7) + 2 * Math.sin(TAU * x * 5 / W + j); x ? sp.lineTo(x, y) : sp.moveTo(x, y); }
      c.strokeStyle = 'rgba(30,26,20,.45)'; c.lineWidth = 2; c.stroke(sp);
      c.save(); c.translate(0, 2.5); c.strokeStyle = 'rgba(235,230,215,.35)'; c.lineWidth = 1.2; c.stroke(sp); c.restore();
    }
    // moss draped over the lip
    const mp = new Path2D(); mp.moveTo(0, top(0) - 4); for (let x = 8; x <= W; x += 8) mp.lineTo(x, top(x) - 4); for (let x = W; x >= 0; x -= 8) mp.lineTo(x, top(x) + 12 + 6 * Math.sin(x * .09) + 4 * Math.sin(x * .23)); mp.closePath();
    c.fillStyle = ROCK.moss; c.fill(mp);
    for (let i = 0; i < 18; i++) { const x = 12 + R() * (W - 24), y = top(x) + 10, l = 8 + R() * 26; c.strokeStyle = ROCK.mossD; c.lineWidth = 3 + R() * 3; line(c, x, y, x + (R() - .5) * 4, y + l, ROCK.mossD, 3 + R() * 2); }
    c.fillStyle = 'rgba(25,20,15,.35)'; c.fillRect(0, bot - 18, W, 18);
    c.restore();
    const tp = new Path2D(); tp.moveTo(0, top(0)); for (let u2 = 8; u2 <= W; u2 += 8) tp.lineTo(u2, top(u2));
    c.strokeStyle = ROCK.mossL; c.lineWidth = 4; c.stroke(tp);
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(tp);
    return cv;
  }
  function makeWallH(len, x0) {
    const H = WALLH + 36, g = H - 4, top = g - WALLH, cv = mk(len, H), c = cv.getContext('2d'), Rt = TL[1];
    const R = rng(Math.floor(x0) * 7 + len);
    frect(c, 0, g - 16, len, 16, '#858077');
    for (let x = -R() * 20, r = 0; x < len; r++) { const w = 18 + R() * 18; rrect(c, x + 1, g - 15, w - 2, 7, 2); c.fillStyle = ['#9a958a', '#8c877c', '#a5a094'][r % 3]; c.fill(); rrect(c, x + w * .5 + 1, g - 8, w - 2, 7, 2); c.fillStyle = ['#8c877c', '#a5a094', '#9a958a'][r % 3]; c.fill(); x += w; }
    boards(c, 0, top, len, WALLH - 16, DW);
    c.fillStyle = 'rgba(255,240,220,.06)'; for (let x = 3; x < len; x += 21) c.fillRect(x, top, 4, WALLH - 16);
    frect(c, 0, top + 10, len, 5, DW.dark); frect(c, 0, top + 10, len, 1.5, DW.light);
    for (let p = Math.ceil(x0 / 104) * 104; p <= x0 + len; p += 104) { const px = p - x0; frect(c, px - 6, top - 2, 12, WALLH - 14, DW.deep); frect(c, px - 6, top - 2, 3, WALLH - 14, DW.light); }
    c.fillStyle = 'rgba(20,12,8,.25)'; c.fillRect(0, g - 26, len, 10);
    frect(c, 0, top - 16, len, 12, Rt.light);
    c.strokeStyle = Rt.base; c.lineWidth = 1.5; c.beginPath(); for (let x = (8 - x0 % 8) % 8; x < len; x += 8) { c.moveTo(x, top - 16); c.lineTo(x, top - 5); } c.stroke();
    frect(c, 0, top - 22, len, 7, Rt.deep); frect(c, 0, top - 22, len, 2, Rt.hi);
    frect(c, 0, top - 5, len, 6, Rt.deep);
    c.fillStyle = Rt.light; for (let x = (8 - x0 % 8) % 8; x < len; x += 8) { c.beginPath(); c.arc(x, top - 2, 2.2, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(20,12,8,.35)'; c.fillRect(0, top + 1, len, 6);
    line(c, 0, top - 22, len, top - 22, OUT, 1.6); line(c, 0, top + 1, len, top + 1, OUT, 1.4); line(c, 0, g, len, g, OUT, 1.6);
    return { cv, dy: g };
  }
  function makeWallV(len, y0, east) {
    const W = 34, H = len + WALLH + 8, cv = mk(W, H), c = cv.getContext('2d'), Rt = TL[1];
    // strip covers world y0-WALLH .. y0+len-WALLH (+8); coping 22 wide plus an 8 px inner face
    const sx = east ? 10 : 2, fx = east ? 2 : 24;
    frect(c, fx, 0, 8, len + 4, DW.base); c.fillStyle = 'rgba(20,12,8,.25)'; c.fillRect(fx, 0, 8, len + 4);
    c.strokeStyle = DW.deep; c.lineWidth = 1; c.beginPath(); for (let y = (12 - y0 % 12) % 12; y < len; y += 12) { c.moveTo(fx, y); c.lineTo(fx + 8, y); } c.stroke();
    frect(c, sx, 0, 22, len + 4, Rt.base);
    c.strokeStyle = Rt.dark; c.lineWidth = 2; c.beginPath(); for (let y = (8 - y0 % 8) % 8; y < len + 4; y += 8) { c.moveTo(sx, y); c.lineTo(sx + 22, y); } c.stroke();
    frect(c, sx, 0, 8, len + 4, 'rgba(255,245,230,.2)'); frect(c, sx + 14, 0, 8, len + 4, 'rgba(10,6,14,.2)');
    frect(c, sx + 9, 0, 5, len + 4, Rt.deep); frect(c, sx + 9, 0, 1.5, len + 4, Rt.hi);
    line(c, sx, 0, sx, len + 4, OUT, 1.6); line(c, sx + 22, 0, sx + 22, len + 4, OUT, 1.6);
    return { cv, dx: east ? -10 : -2 };
  }
  function makeYagura() {
    return sprite(150, 230, 75, 222, (c, ax, ay) => {
      const R = TL[1], W = PL[1];
      fell(c, ax + 20, ay, 52, 12, 'rgba(28,22,16,.3)');
      for (const dx of [-38, 38]) { frect(c, ax + dx - 5, ay - 104, 10, 104, DW.base); frect(c, ax + dx - 5, ay - 104, 3, 104, DW.light); srect(c, ax + dx - 5, ay - 104, 10, 104, OUT, 1.3); }
      line(c, ax - 34, ay - 10, ax + 34, ay - 90, DW.dark, 4); line(c, ax + 34, ay - 10, ax - 34, ay - 90, DW.dark, 4);
      frect(c, ax - 48, ay - 112, 96, 10, WOOD.base); srect(c, ax - 48, ay - 112, 96, 10, OUT, 1.4);
      railing(c, ax - 46, ay - 130, 92, 18, '#6e4a32', 46);
      wallJ(c, ax - 36, ay - 168, 72, 42, W, { posts: 36, found: 0, eave: 7 });
      koshi(c, ax - 16, ay - 160, 32, 16, true);
      roofJ(c, ax - 54, ay - 214, 108, 54, R, { rf: .42, hip: 40, flare: true });
      chochin(c, ax + 42, ay - 124, 1.1);
    });
  }
  function makeGatepost(flip) {
    return sprite(70, 180, 35, 172, (c, ax, ay) => {
      fell(c, ax + 12, ay, 22, 6, 'rgba(28,22,16,.3)');
      frect(c, ax - 18, ay - 18, 36, 18, '#8e897f'); srect(c, ax - 18, ay - 18, 36, 18, OUT, 1.3);
      frect(c, ax - 12, ay - 136, 24, 120, DW.base); frect(c, ax - 12, ay - 136, 6, 120, DW.light); frect(c, ax + 6, ay - 136, 6, 120, DW.deep); srect(c, ax - 12, ay - 136, 24, 120, OUT, 1.6);
      for (const y of [ay - 110, ay - 50]) { frect(c, ax - 13, y, 26, 6, '#2a2220'); fell(c, ax, y + 3, 2, 2, '#d9a93a'); }
      roofJ(c, ax - 22, ay - 166, 44, 32, TL[1], { rf: .45, hip: 16, oni: false });
      chochin(c, ax + (flip ? -20 : 20), ay - 96, 1.3, '#ec7a2c', '湯');
      line(c, ax + (flip ? -12 : 12), ay - 112, ax + (flip ? -20 : 20), ay - 112, '#2a1e18', 2);
    });
  }
  function makeBooth(flip) {
    return sprite(130, 150, 65, 140, (c, ax, ay) => {
      fell(c, ax + 14, ay, 50, 10, 'rgba(28,22,16,.3)');
      wallJ(c, ax - 40, ay - 58, 80, 58, PL[0], { posts: 40, koshi: 16, eave: 8 });
      shoji(c, ax - 28, ay - 46, 24, 18, true);
      doorway(c, ax + 6, ay - 48, 22, 46);
      roofJ(c, ax - 52, ay - 112, 104, 58, TL[0], { rf: .38, hip: 34, flare: true });
      signV(c, ax + (flip ? 42 : -56), ay - 54, 14, 40, '番所', '#f4ead2', '#2a1a12');
      chochin(c, ax + 34, ay - 54, 1);
    });
  }
  function makeBridge() {
    return sprite(250, 200, 125, 186, (c, ax, ay) => {
      const y0 = ay - 142, y1 = ay, rise = 30, L = ax - 92, Rr = ax + 92, yy = v => y0 + v * (y1 - y0) - rise * Math.sin(Math.PI * v);
      fell(c, ax + 16, yy(.5) + 30, 100, 18, 'rgba(10,40,45,.28)');
      for (let i = 0; i < 40; i++) { const v0 = i / 40, v1 = (i + 1) / 40, a = yy(v0), b = yy(v1); frect(c, L, a, Rr - L, b - a + .6, i % 2 ? '#a0703c' : '#8e6232'); }
      c.strokeStyle = 'rgba(40,20,10,.5)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i <= 20; i++) { const y = yy(i / 20); c.moveTo(L, y); c.lineTo(Rr, y); } c.stroke();
      frect(c, L, y1 - 2, Rr - L, 10, '#7a1e14'); srect(c, L, y1 - 2, Rr - L, 10, OUT, 1.4);
      for (const s of [-1, 1]) {
        const x = s < 0 ? L : Rr, rail = (off) => { const p = new Path2D(); for (let i = 0; i <= 24; i++) { const v = i / 24, y = yy(v) - off; i ? p.lineTo(x, y) : p.moveTo(x, y); } return p; };
        c.strokeStyle = OUT; c.lineWidth = 10; c.stroke(rail(4)); c.strokeStyle = '#a8261c'; c.lineWidth = 7; c.stroke(rail(4));
        for (let i = 0; i <= 6; i++) { const v = i / 6, y = yy(v); frect(c, x - 4, y - 30, 8, 30, '#c0392b'); frect(c, x - 4, y - 30, 2.5, 30, '#e06048'); srect(c, x - 4, y - 30, 8, 30, OUT, 1.2); }
        const tr = rail(26); c.strokeStyle = OUT; c.lineWidth = 8; c.stroke(tr); c.strokeStyle = '#c8382a'; c.lineWidth = 5; c.stroke(tr); c.strokeStyle = '#ec6a50'; c.lineWidth = 1.4; c.stroke(rail(27.5));
        c.strokeStyle = '#a8261c'; c.lineWidth = 3; c.stroke(rail(14));
        for (const v of [0, 1]) { const y = yy(v) - 32; fell(c, x, y + 2, 6, 4, '#d9a93a'); fell(c, x, y - 4, 4, 5, '#e8c060'); fell(c, x, y - 10, 1.6, 2.4, '#d9a93a'); c.beginPath(); c.ellipse(x, y - 4, 4, 5, 0, 0, TAU); sk(c, OUT, 1); }
      }
    });
  }
  function makePlank() {
    return sprite(90, 170, 45, 160, (c, ax, ay) => {
      const y0 = ay - 132;
      fell(c, ax + 10, ay - 60, 34, 10, 'rgba(10,40,45,.25)');
      for (const dx of [-30, 30]) { frect(c, ax + dx - 4, y0, 8, 132, '#6a4a30'); srect(c, ax + dx - 4, y0, 8, 132, OUT, 1.2); }
      for (let y = y0 + 2; y < ay - 4; y += 9) { frect(c, ax - 28, y, 56, 7, (y / 9) % 2 < 1 ? '#a8804e' : '#9a7444'); srect(c, ax - 28, y, 56, 7, 'rgba(40,24,12,.7)', 1); }
      for (const dx of [-30, 30]) for (const y of [y0 + 30, ay - 30]) { frect(c, ax + dx - 3, y - 18, 6, 18, '#6a4a30'); srect(c, ax + dx - 3, y - 18, 6, 18, OUT, 1); }
      for (const dx of [-30, 30]) line(c, ax + dx, y0 + 12, ax + dx, ay - 48, '#7a5636', 3);
    });
  }

  // ------------------------------------------------------------------ props
  function makeProps() {
    const P = {};
    P.rocks = [8, 12, 17, 24].map((r, i) => sprite(Math.ceil(r * 3 + 22), Math.ceil(r * 2.4 + 20), Math.round(r * 1.3 + 8), Math.round(r * 1.5 + 14), (c, ax, ay) => boulder(c, ax, ay - r * .45, r, rng(300 + i * 17), true)));
    P.clusters = [];
    for (let i = 0; i < 10; i++) P.clusters.push(sprite(230, 180, 115, 150, (c, ax, ay) => {
      const R = rng(500 + i * 31), bs = [];
      const n = 3 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) bs.push([ax + (R() - .5) * 110, ay - 30 + R() * 30, (k === 0 ? 46 : 22) + R() * 22]);
      bs.sort((p, q) => p[1] - q[1]);
      for (const [x, y, r] of bs) boulder(c, x, y, r, R, R() < .8);
    }));
    P.pines = [0, 1, 2].map(i => sprite(190, 180, 84, 170, (c, ax, ay) => drawPine(c, ax, ay, 1 + i * .1, 900 + i * 31)));
    P.cedars = [0, 1, 2].map(i => sprite(110, 205, 55, 196, (c, ax, ay) => drawCedar(c, ax, ay, 1 + i * .07, 950 + i * 13)));
    P.maples = [['red', 1.05], ['orange', 1], ['crim', .95], ['yellow', 1], ['red', .85], ['green', .9]].map(([k, s], i) => sprite(160, 160, 76, 150, (c, ax, ay) => drawMaple(c, ax, ay, s, 700 + i * 23, MAPLE[k])));
    P.bamboo = sprite(130, 180, 62, 170, (c, ax, ay) => drawBamboo(c, ax, ay, 1, 1313));
    P.shrubs = [['#3d6a3c', '#5c8c4e', '#8db46a'], ['#9a2a1a', '#c84a28', '#ec8a4a']].map((pal, i) => sprite(74, 54, 36, 46, (c, ax, ay) => {
      fell(c, ax + 8, ay, 28, 7, 'rgba(28,22,16,.26)');
      const R = rng(41 + i), bl = []; for (let k = 0; k < 9; k++) bl.push([ax + (R() - .5) * 40, ay - 10 - R() * 18, 7 + R() * 6]);
      bl.sort((p, q) => p[1] - q[1]);
      for (const [x, y, r] of bl) fell(c, x, y, r + 2, r + 1.8, i ? '#4a140c' : '#1e301c');
      for (const [x, y, r] of bl) { fell(c, x, y, r, r * .9, pal[0]); fell(c, x - r * .25, y - r * .3, r * .6, r * .5, pal[1]); fell(c, x - r * .4, y - r * .45, r * .25, r * .2, pal[2]); }
    }));
    P.toro = sprite(46, 78, 22, 72, (c, ax, ay) => drawToro(c, ax, ay, 1));
    P.toroL = sprite(60, 104, 28, 96, (c, ax, ay) => drawToro(c, ax, ay, 1.4));
    P.andon = sprite(40, 104, 18, 96, (c, ax, ay) => {
      fell(c, ax + 6, ay, 12, 4, 'rgba(28,22,16,.3)');
      frect(c, ax - 6, ay - 8, 12, 8, '#8e897f'); srect(c, ax - 6, ay - 8, 12, 8, OUT, 1);
      line(c, ax, ay - 6, ax, ay - 62, OUT, 6); line(c, ax, ay - 6, ax, ay - 62, WOOD.base, 4); line(c, ax - 1, ay - 6, ax - 1, ay - 62, WOOD.light, 1);
      frect(c, ax - 11, ay - 88, 22, 26, '#fff0c4'); frect(c, ax - 9, ay - 86, 18, 22, '#ffe090');
      frect(c, ax + 3, ay - 88, 8, 26, 'rgba(200,110,40,.25)');
      txt(c, '湯', ax, ay - 75, 12, '#8a2a1a', { weight: '900' });
      srect(c, ax - 11, ay - 88, 22, 26, DW.deep, 2); line(c, ax - 11, ay - 66, ax + 11, ay - 66, DW.deep, 1.4);
      fpoly(c, [ax - 15, ay - 88, ax - 5, ay - 96, ax + 5, ay - 96, ax + 15, ay - 88], DW.base); poly(c, [ax - 15, ay - 88, ax - 5, ay - 96, ax + 5, ay - 96, ax + 15, ay - 88]); sk(c, OUT, 1.2);
    });
    P.lstring = sprite(268, 130, 134, 120, (c, ax, ay) => {
      for (const dx of [-120, 120]) { fell(c, ax + dx + 5, ay, 8, 3, 'rgba(28,22,16,.3)'); line(c, ax + dx, ay, ax + dx, ay - 104, OUT, 6); line(c, ax + dx, ay, ax + dx, ay - 104, WOOD.base, 4); fell(c, ax + dx, ay - 105, 4, 3, DW.deep); }
      const x1 = ax - 120, x2 = ax + 120, y1 = ay - 98, cy = ay - 70;
      c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(ax, cy, x2, y1); sk(c, '#2a1e18', 1.4);
      for (let i = 1; i < 7; i++) { const t = i / 7, m = 1 - t, x = m * m * x1 + 2 * m * t * ax + t * t * x2, y = m * m * y1 + 2 * m * t * cy + t * t * y1; chochin(c, x, y + 12, 1.05, i % 2 ? '#ec7a2c' : '#d84a2a', i === 3 ? '湯' : null); }
    });
    P.bench = sprite(84, 42, 40, 34, (c, ax, ay) => {
      fell(c, ax + 8, ay, 36, 6, 'rgba(28,22,16,.26)');
      frect(c, ax - 30, ay - 12, 7, 12, WOOD.dark); frect(c, ax + 23, ay - 12, 7, 12, WOOD.dark);
      frect(c, ax - 34, ay - 20, 68, 9, WOOD.light); frect(c, ax - 34, ay - 20, 68, 3, '#c09a6a'); srect(c, ax - 34, ay - 20, 68, 9, OUT, 1.3);
    });
    P.nodate = sprite(140, 150, 70, 140, (c, ax, ay) => {
      fell(c, ax + 14, ay, 56, 10, 'rgba(28,22,16,.26)');
      frect(c, ax - 40, ay - 16, 80, 9, '#c0392b'); frect(c, ax - 40, ay - 16, 80, 3, '#e0604a'); frect(c, ax - 36, ay - 7, 4, 7, DW.dark); frect(c, ax + 32, ay - 7, 4, 7, DW.dark); srect(c, ax - 40, ay - 16, 80, 9, OUT, 1.2);
      fell(c, ax - 18, ay - 19, 6, 2.4, '#3a2a1e'); fell(c, ax - 6, ay - 19, 4, 2, '#f0e8d8');
      line(c, ax + 6, ay - 2, ax + 10, ay - 104, OUT, 4); line(c, ax + 6, ay - 2, ax + 10, ay - 104, '#b89a6a', 2);
      const um = new Path2D(); um.moveTo(ax - 58, ay - 92); um.quadraticCurveTo(ax + 10, ay - 146, ax + 72, ay - 92); um.quadraticCurveTo(ax + 10, ay - 76, ax - 58, ay - 92); um.closePath();
      celFill(c, um, '#c8382a', '#e2604a', '#962418', { ld: 5, dd: 6 });
      c.save(); c.clip(um); c.strokeStyle = 'rgba(90,20,10,.4)'; c.lineWidth = 1.2; c.beginPath(); for (let i = -4; i <= 4; i++) { c.moveTo(ax + 10, ay - 118); c.lineTo(ax + 10 + i * 18, ay - 76); } c.stroke(); c.restore();
      c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(um);
    });
    P.buckets = sprite(80, 66, 36, 58, (c, ax, ay) => bucketsAt(c, ax, ay, 1));
    P.barrels = sprite(90, 72, 40, 64, (c, ax, ay) => barrelsAt(c, ax, ay, 1));
    P.tanuki = sprite(46, 64, 22, 58, (c, ax, ay) => {
      fell(c, ax + 6, ay, 16, 4, 'rgba(28,22,16,.3)');
      const b = new Path2D(); b.ellipse(ax, ay - 16, 13, 15, 0, 0, TAU); celFill(c, b, '#8a6a4a', '#a8885e', '#5e4430', { ld: 3, dd: 4 }); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(b);
      fell(c, ax, ay - 13, 8, 9, '#e8d8b8'); c.beginPath(); c.ellipse(ax, ay - 13, 8, 9, 0, 0, TAU); sk(c, OUT, 1);
      const h = new Path2D(); h.ellipse(ax, ay - 38, 10, 9, 0, 0, TAU); celFill(c, h, '#8a6a4a', '#a8885e', '#5e4430', { ld: 2, dd: 3 }); c.stroke(h);
      fpoly(c, [ax - 14, ay - 48, ax + 14, ay - 48, ax + 9, ay - 43, ax - 9, ay - 43], '#c9a46a'); fell(c, ax, ay - 50, 8, 4, '#c9a46a'); c.beginPath(); c.ellipse(ax, ay - 50, 8, 4, 0, 0, TAU); sk(c, OUT, 1);
      fell(c, ax - 4, ay - 38, 2.4, 2, '#2a1a12'); fell(c, ax + 4, ay - 38, 2.4, 2, '#2a1a12'); fell(c, ax, ay - 34, 2, 1.6, '#2a1a12');
      fell(c, ax + 12, ay - 22, 4, 6, '#f2ead6'); txt(c, '酒', ax + 12, ay - 22, 5, '#2a1a12');
    });
    P.board = sprite(100, 100, 50, 92, (c, ax, ay) => {
      fell(c, ax + 10, ay, 36, 6, 'rgba(28,22,16,.3)');
      for (const dx of [-32, 32]) { frect(c, ax + dx - 3, ay - 74, 6, 74, DW.base); srect(c, ax + dx - 3, ay - 74, 6, 74, OUT, 1.1); }
      frect(c, ax - 40, ay - 82, 80, 52, '#e8dcc0'); srect(c, ax - 40, ay - 82, 80, 52, DW.deep, 3);
      txt(c, '湯隠れの里', ax, ay - 74, 10, '#2a1a12', { weight: '900' });
      fell(c, ax - 6, ay - 52, 24, 12, '#7ccfc4'); onsenMark(c, ax - 6, ay - 51, .55, '#b8322a', 2.4);
      for (const [x, y] of [[-30, -60], [22, -46], [26, -62], [-28, -42]]) frect(c, ax + x, ay + y, 6, 5, '#5a6472');
      line(c, ax - 34, ay - 40, ax + 34, ay - 40, '#a89a7a', 2);
      fpoly(c, [ax - 46, ay - 82, ax, ay - 94, ax + 46, ay - 82], TL[1].base); poly(c, [ax - 46, ay - 82, ax, ay - 94, ax + 46, ay - 82]); sk(c, OUT, 1.2);
    });
    P.monument = sprite(90, 110, 42, 100, (c, ax, ay) => {
      fell(c, ax + 12, ay, 40, 9, 'rgba(28,22,16,.3)');
      boulder(c, ax - 22, ay - 2, 13, rng(9), true); boulder(c, ax + 24, ay, 11, rng(10), true);
      const p = new Path2D(); p.moveTo(ax - 22, ay - 6); p.lineTo(ax - 26, ay - 70); p.quadraticCurveTo(ax - 4, ay - 92, ax + 22, ay - 76); p.lineTo(ax + 24, ay - 6); p.closePath();
      celFill(c, p, '#8a8780', '#b2aea4', '#5e5b55', { ld: 4, dd: 6 }); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(p);
      txtV(c, '湯隠れの里', ax - 1, ay - 78, 12, '#3a2a20');
      txtV(c, '湯隠れの里', ax - 2, ay - 79, 12, '#e8e2d2');
      boulder(c, ax, ay + 4, 9, rng(11), true);
    });
    P.spout = sprite(110, 80, 60, 64, (c, ax, ay) => {
      for (const dx of [-30, 0]) { line(c, ax + dx - 4, ay, ax + dx + 4, ay - 30, OUT, 4); line(c, ax + dx + 4, ay, ax + dx - 4, ay - 30, OUT, 4); line(c, ax + dx - 4, ay, ax + dx + 4, ay - 30, '#8aa84a', 2); line(c, ax + dx + 4, ay, ax + dx - 4, ay - 30, '#8aa84a', 2); }
      line(c, ax - 50, ay - 34, ax + 26, ay - 22, OUT, 9); line(c, ax - 50, ay - 34, ax + 26, ay - 22, '#7a9a3e', 6); line(c, ax - 50, ay - 36, ax + 26, ay - 24, '#b8d07a', 1.6);
      for (const x of [-30, 0]) line(c, ax + x, ay - 33 + (x + 50) * .16, ax + x, ay - 27 + (x + 50) * .16, '#4a6a24', 2);
      fell(c, ax + 27, ay - 22, 4, 3.4, '#2a3a18');
      c.beginPath(); c.moveTo(ax + 28, ay - 21); c.quadraticCurveTo(ax + 34, ay - 12, ax + 34, ay + 8); sk(c, 'rgba(230,252,250,.9)', 3); sk(c, 'rgba(160,230,230,.6)', 1);
      fell(c, ax + 34, ay + 10, 8, 3, 'rgba(255,255,255,.7)');
    });
    const fence = (len, bamboo) => sprite(len + 10, 70, 5, 62, (c, ax, ay) => {
      fell(c, ax + len / 2 + 8, ay + 1, len / 2 + 6, 5, 'rgba(28,22,16,.24)');
      if (bamboo) {
        frect(c, ax, ay - 50, len, 50, '#c9b06a');
        for (let x = 0; x < len; x += 6) { frect(c, ax + x, ay - 50, 5, 50, x % 12 ? '#b89a50' : '#d8c27a'); frect(c, ax + x + 4, ay - 50, 1, 50, 'rgba(60,40,10,.4)'); }
        for (const y of [ay - 40, ay - 16]) frect(c, ax, y, len, 3, '#5a4020');
        srect(c, ax, ay - 50, len, 50, OUT, 1.4);
        for (const x of [0, len - 7]) { frect(c, ax + x, ay - 56, 7, 56, DW.base); frect(c, ax + x, ay - 56, 2, 56, DW.light); srect(c, ax + x, ay - 56, 7, 56, OUT, 1.2); }
      } else {
        boards(c, ax, ay - 54, len, 54, WOOD);
        frect(c, ax, ay - 54, len, 2, WOOD.hi);
        for (let x = 0; x <= len; x += 60) { frect(c, ax + Math.min(x, len - 6), ay - 58, 6, 58, DW.base); }
        fpoly(c, [ax - 3, ay - 54, ax + len + 3, ay - 54, ax + len, ay - 60, ax, ay - 60], TL[1].base);
        srect(c, ax, ay - 54, len, 54, OUT, 1.4);
      }
    });
    P.fence = fence(130, false); P.bfence = fence(120, true);
    P.fenceV = sprite(20, 200, 10, 196, (c, ax, ay) => {
      frect(c, ax - 5, ay - 190, 10, 190, WOOD.base); frect(c, ax - 5, ay - 190, 3, 190, WOOD.light); frect(c, ax + 2, ay - 190, 3, 190, WOOD.dark);
      for (let y = ay - 190; y < ay; y += 60) frect(c, ax - 6, y, 12, 6, DW.base);
      srect(c, ax - 5, ay - 190, 10, 190, OUT, 1.3);
    });
    P.hut = sprite(130, 130, 62, 120, (c, ax, ay) => {
      fell(c, ax + 12, ay, 50, 9, 'rgba(28,22,16,.28)');
      wallJ(c, ax - 40, ay - 52, 80, 52, PL[0], { posts: 40, koshi: 14, eave: 8 });
      doorway(c, ax - 12, ay - 44, 30, 42); noren(c, ax - 13, ay - 44, 32, 22, '#2b3f70', ['ゆ'], '#fff4e2');
      roofJ(c, ax - 52, ay - 100, 104, 50, TL[0], { rf: .38, hip: 30, flare: true });
    });
    P.hokora = sprite(120, 110, 60, 100, (c, ax, ay) => {
      fell(c, ax + 10, ay, 40, 8, 'rgba(28,22,16,.28)');
      frect(c, ax - 24, ay - 12, 48, 12, '#8e897f'); srect(c, ax - 24, ay - 12, 48, 12, OUT, 1.2);
      wallJ(c, ax - 18, ay - 44, 36, 32, WOOD, { found: 0, eave: 5 });
      frect(c, ax - 8, ay - 38, 16, 22, '#2a1c15'); fell(c, ax, ay - 26, 4, 4, '#d9a93a');
      roofJ(c, ax - 28, ay - 74, 56, 34, TL[1], { rf: .4, hip: 18, flare: true, oni: false });
      c.beginPath(); c.moveTo(ax - 19, ay - 42); c.quadraticCurveTo(ax, ay - 34, ax + 19, ay - 42); sk(c, '#8a7a48', 4); sk(c, '#e2d39a', 2);
      for (const sx of [-10, 0, 10]) { const sy = sx ? ay - 39 : ay - 37; fpoly(c, [ax + sx - 2, sy, ax + sx + 2, sy, ax + sx + 2, sy + 4, ax + sx, sy + 4, ax + sx, sy + 8, ax + sx + 2, sy + 8, ax + sx + 2, sy + 12, ax + sx - 2, sy + 12], '#fbf8f0'); }
      frect(c, ax - 10, ay - 12, 20, 10, WOOD.base); frect(c, ax - 10, ay - 12, 20, 3, WOOD.light); srect(c, ax - 10, ay - 12, 20, 10, OUT, 1);
      for (const s of [-1, 1]) { const x = ax + s * 34; fell(c, x + 3, ay, 8, 3, 'rgba(28,22,16,.3)'); frect(c, x - 6, ay - 6, 12, 6, '#8e897f'); fell(c, x, ay - 14, 6, 8, '#b5b0a5'); fell(c, x, ay - 25, 5, 5, '#b5b0a5'); frect(c, x - 5, ay - 18, 10, 5, '#c0392b'); c.beginPath(); c.ellipse(x, ay - 14, 6, 8, 0, 0, TAU); sk(c, OUT, 1); c.beginPath(); c.arc(x, ay - 25, 5, 0, TAU); sk(c, OUT, 1); }
    });
    P.deck = sprite(190, 60, 95, 46, (c, ax, ay) => {
      fell(c, ax + 10, ay + 2, 92, 9, 'rgba(28,22,16,.26)');
      frect(c, ax - 84, ay - 30, 168, 22, WOOD.light);
      c.strokeStyle = WOOD.dark; c.lineWidth = 1; c.beginPath(); for (let x = ax - 84; x < ax + 84; x += 10) { c.moveTo(x, ay - 30); c.lineTo(x, ay - 8); } c.stroke();
      frect(c, ax - 84, ay - 8, 168, 8, WOOD.dark); srect(c, ax - 84, ay - 30, 168, 30, OUT, 1.4);
      bucketsAt(c, ax - 56, ay - 14, .6);
      frect(c, ax + 30, ay - 26, 30, 10, '#f2ead6'); frect(c, ax + 34, ay - 30, 30, 10, '#e8c8b8'); srect(c, ax + 34, ay - 30, 30, 10, OUT, 1);
    });
    P.torii = sprite(440, 250, 220, 240, (c, ax, ay) => drawTorii(c, ax, ay, 340, 214, '湯隠'));
    P.toriiS = sprite(150, 130, 75, 122, (c, ax, ay) => drawTorii(c, ax, ay, 110, 100, '湯'));
    P.noboriR = sprite(36, 120, 22, 114, (c, ax, ay) => { fell(c, ax + 4, ay, 8, 3, 'rgba(28,22,16,.3)'); nobori(c, ax, ay, 108, '#b8322a', '湯の里'); });
    P.noboriB = sprite(36, 120, 22, 114, (c, ax, ay) => { fell(c, ax + 4, ay, 8, 3, 'rgba(28,22,16,.3)'); nobori(c, ax, ay, 108, '#2b3f70', '源泉'); });
    P.yagura = makeYagura();
    P.gateL = makeGatepost(false); P.gateR = makeGatepost(true);
    P.boothL = makeBooth(false); P.boothR = makeBooth(true);
    P.bridge = makeBridge(); P.plank = makePlank();
    return P;
  }

  // ------------------------------------------------------------------ ambient sprites
  function makePuffs() {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const S = 64, cv = mk(S, S), c = cv.getContext('2d'), R = rng(90 + i);
      for (let k = 0; k < 3 + i; k++) {
        const x = 32 + (R() - .5) * 22 * (i ? 1 : .4), y = 32 + (R() - .5) * 14, r = 14 + R() * 10;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(.5, 'rgba(250,252,252,.4)'); g.addColorStop(1, 'rgba(250,252,252,0)');
        c.fillStyle = g; c.fillRect(0, 0, S, S);
      }
      out.push(cv);
    }
    return out;
  }
  function makeGlow() {
    const S = 64, cv = mk(S, S), c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,200,110,.9)'); g.addColorStop(.35, 'rgba(255,160,70,.35)'); g.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S); return cv;
  }
  function makeLeaves() {
    const out = [];
    for (const col of ['#d8432a', '#e8822e', '#e8b83a', '#b8301e']) for (let r = 0; r < 4; r++) {
      const cv = mk(14, 14), c = cv.getContext('2d');
      c.translate(7, 7); c.rotate(r * Math.PI / 2.6); c.scale(1, .55 + .45 * Math.abs(Math.cos(r * 1.1)));
      const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k / 10 * TAU, rr = k % 2 ? 2.2 : 5.4; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
      fpoly(c, pts, col); poly(c, pts); sk(c, 'rgba(60,20,10,.6)', .8); line(c, 0, 0, 0, 6, 'rgba(60,20,10,.7)', .8);
      out.push(cv);
    }
    return out;
  }

  // ------------------------------------------------------------------ layout tables
  const VAR = {
    v0a: [vRyokan, 0, 1, 0, 1, 0, 1, '#8a5a3a'], v0b: [vRyokan, 3, 2, 2, 0, 1, 0, '#b8322a'], v0c: [vRyokan, 4, 1, 3, 1, 5, 1, '#6e4a32'],
    v1a: [vShop, 2, 0, 0, 2, 1, 2, '#8a5a3a'], v1b: [vShop, 5, 3, 1, 3, 3, 0, '#b8322a'],
    v2a: [vSento, 1, 4, 2, 0, 0, 1, '#8a5a3a'], v2b: [vSento, 0, 5, 0, 3, 0, 1, '#8a5a3a'],
    v3a: [vTea, 3, 0, 0, 1, 1, 0, '#8a5a3a'], v3b: [vTea, 2, 1, 1, 0, 4, 0, '#8a5a3a'],
    v4a: [vInnTower, 0, 3, 1, 2, 0, 1, '#b8322a'], v4b: [vInnTower, 4, 2, 3, 0, 2, 1, '#6e4a32'],
    v5a: [vRoten, 1, 0, 0, 2, 0, 1, '#8a5a3a'], v5b: [vRoten, 3, 4, 2, 1, 3, 0, '#b8322a'],
    v6a: [vMachiya, 0, 1, 0, 1, 0, 1, '#8a5a3a'], v6b: [vMachiya, 5, 0, 1, 2, 3, 1, '#8a5a3a']
  };
  const COLX = { 1: 580, 2: 1150, 4: 2150, 5: 2720 }, ROWY = { 1: 545, 2: 1150, 3: 1690, 4: 2170, 5: 2730 };
  const HOUSES = [
    [1, 1, 'v6a'], [2, 1, 'v0a'], [4, 1, 'v1a'], [5, 1, 'v4a'],
    [1, 2, 'v3a'], [2, 2, 'v1b'], [4, 2, 'v0b'], [5, 2, 'v2a'],
    [1, 3, 'v4b'], [5, 3, 'v5a'],
    [2, 4, 'v2b'], [4, 4, 'v5b'],
    [1, 5, 'v0c'], [4, 5, 'v3b'], [5, 5, 'v6b']
  ];
  // pools: [cx, cy, rx, ry, seed, rock scale, steam strength]
  const POOLS = [
    [2330, 1838, 178, 124, 11, 1.3, 1], [1312, 1842, 146, 100, 12, 1.1, 1], [780, 2330, 118, 80, 13, 1, 1], [2860, 2330, 120, 84, 14, 1, 1],
    [1302, 2884, 124, 84, 15, 1, 1], [1626, 2310, 86, 60, 16, .9, .9], [2014, 2310, 86, 60, 17, .9, .9],
    [494, 934, 66, 46, 18, .9, .8], [3150, 934, 70, 48, 19, .9, .8]
  ];

  // ------------------------------------------------------------------ state
  const A = {};
  let ready = false;
  const foots = [], objs = [], decals = [], steam = [], lanternsLocal = [];

  function buildingCanvas(fn, P, w, h, over) {
    const cv = mk(w + SM * 2, h + over + BM), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(SM, over);
    fn(c, P);
    return cv;
  }
  function inRect(x, y, r, m) { return x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m; }

  function build() {
    const tmp = mk(4, 4).getContext('2d');
    A.groundPat = tmp.createPattern(makeGroundTile(), 'repeat');
    A.rockPat = tmp.createPattern(makeRockTile(), 'repeat');
    A.pavePat = tmp.createPattern(makePaveTile({ seed: 61, rh: 22, wmin: 18, wmax: 42, grout: '#5e5a52', drift: 'rgba(96,120,56,.22)', tones: ['#a39d92', '#9a948a', '#aea89c', '#948e85', '#b5afa3', '#8e897f'] }), 'repeat');
    A.plazaPat = tmp.createPattern(makePaveTile({ seed: 83, rh: 32, wmin: 30, wmax: 62, grout: '#6a655c', drift: 'rgba(96,120,56,.16)', tones: ['#b3ada1', '#a8a296', '#bcb6aa', '#9f998e', '#c2bcb0'] }), 'repeat');
    A.emblem = makeEmblem();
    A.puffs = makePuffs(); A.glow = makeGlow(); A.leaves = makeLeaves();
    const PR = A.props = makeProps();

    foots.length = 0; objs.length = 0; decals.length = 0; steam.length = 0; lanternsLocal.length = 0;
    const addFoot = f => { foots.push(f); return foots.length - 1; };
    const addLamp = (x, y) => lanternsLocal.push({ x: Math.round(x), y: Math.round(y) });
    const taken = [];
    const put = (s, x, y, m = 0, lampDy = null, fi = -1) => {
      if (m) taken.push([x, y, m]);
      objs.push({ img: s.cv, x: Math.round(x - s.ax), y: Math.round(y - s.ay), w: s.cv.width, h: s.cv.height, by: y, fi });
      if (lampDy) addLamp(x + lampDy[0], y + lampDy[1]);
    };

    // ---- perimeter: one solid footprint per ring cell (gate cell (3,0) stays open)
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      if (cx > 0 && cx < NC - 1 && cy > 0 && cy < NC - 1) continue;
      if (cx === 3 && cy === 0) continue;
      const gx = cx * BLOCK, gy = cy * BLOCK;
      let f;
      if ((cx === 0 || cx === NC - 1) && (cy === 0 || cy === NC - 1)) f = { x: gx, y: gy, w: BLOCK, h: BLOCK };
      else if (cy === 0) f = { x: gx, y: 0, w: BLOCK, h: WIN };
      else if (cy === NC - 1) f = { x: gx, y: WOUT, w: BLOCK, h: SIZE - WOUT };
      else if (cx === 0) f = { x: 0, y: gy, w: WIN, h: BLOCK };
      else f = { x: WOUT, y: gy, w: SIZE - WOUT, h: BLOCK };
      addFoot(Object.assign(f, { solid: true, roof: '#6f6a60', wall: '#4e3628' }));
    }
    // cliff face behind the north wall
    const cliff = makeCliffN();
    for (const [x0, x1] of [[400, 520], [520, 1040], [1040, 1560], [2080, 2600], [2600, 3120], [3120, 3240]]) {
      const sx = x0 % BLOCK, sw = x1 - x0;
      objs.push({ img: cliff, x: x0, y: 108, w: sw, h: cliff.height, by: 330, fi: -1, sx, sw, solid: true });
    }
    // wooden walls with tile coping
    const wcache = {};
    const wallH = (x0, x1, gy) => { const k = (x1 - x0) + ',' + (x0 % 104); if (!wcache[k]) wcache[k] = makeWallH(x1 - x0, x0); const w = wcache[k]; objs.push({ img: w.cv, x: x0, y: gy - w.dy, w: w.cv.width, h: w.cv.height, by: gy, fi: -1 }); };
    const segs = [[400, 520], [520, 1040], [1040, 1560], [1560, 2080], [2080, 2600], [2600, 3120], [3120, 3240]];
    for (const [a, b] of segs) { if (a !== 1560) wallH(a, b, WIN); wallH(a, b, WOUT); }
    for (const [a, b] of segs) for (const east of [false, true]) {
      const k = 'v' + (b - a) + ',' + (a % 12) + east; if (!wcache[k]) wcache[k] = makeWallV(b - a, a, east);
      const w = wcache[k], x = east ? WOUT : WIN - 22;
      objs.push({ img: w.cv, x: x + w.dx + (east ? 0 : 0), y: a - WALLH, w: w.cv.width, h: w.cv.height, by: b, fi: -1 });
    }
    for (const [x, y] of [[WIN, WIN], [WOUT, WIN], [WIN, WOUT], [WOUT, WOUT]]) put(PR.yagura, x + (x === WIN ? -8 : 8), y + 4, 0, [x === WIN ? 34 : 50, -124]);
    // gate: posts, torii, guard booths, monument
    put(PR.gateL, 1560, WIN + 2, 0, [20, -96]); put(PR.gateR, 2080, WIN + 2, 0, [-20, -96]);
    put(PR.torii, 1820, 300, 0, null);
    put(PR.boothL, 1622, 386, 0, [34, -54]); put(PR.boothR, 2020, 386, 0, [34, -54]);
    put(PR.monument, 1640, 486, 40); put(PR.toroL, 2004, 480, 30, [0, -52]);
    // mountain ridge: boulder clusters and conifers / maples all round the band
    const ring = [], rr = rng(2024);
    const okBand = (x, y) => !(x > 1600 && x < 2040 && y > -60) && !(x > 1660 && x < 1980);
    const bandPt = (x, y, kind) => { if (!okBand(x, y)) return; ring.push([x, y, kind]); };
    for (let x = 30; x < SIZE - 20; x += 165) for (const y of [-36, 46, 128]) bandPt(x + (rr() - .5) * 70, y + (rr() - .5) * 26, 'c');
    for (let x = -40; x < SIZE + 60; x += 80) bandPt(x + (rr() - .5) * 50, 30 + rr() * 146, 't');
    for (let x = 1570; x < 2090; x += 90) for (const y of [210, 300]) bandPt(x + (rr() - .5) * 30, y + (rr() - .5) * 30, 'c');
    for (let y = 300; y < SIZE + 80; y += 170) for (const x of [10, 120, 240]) { ring.push([x + (rr() - .5) * 70, y + (rr() - .5) * 70, 'c']); ring.push([SIZE - x + (rr() - .5) * 70, y + (rr() - .5) * 70, 'c']); }
    for (let y = 300; y < SIZE + 60; y += 66) { ring.push([20 + rr() * 320, y + (rr() - .5) * 40, 't']); ring.push([SIZE - 20 - rr() * 320, y + (rr() - .5) * 40, 't']); }
    for (let x = 300; x < SIZE - 300; x += 165) for (const y of [3330, 3450, 3570]) ring.push([x + (rr() - .5) * 80, y + (rr() - .5) * 40, 'c']);
    for (let x = 340; x < SIZE - 340; x += 72) ring.push([x + (rr() - .5) * 50, 3290 + rr() * 330, 't']);
    for (const [x, y, k] of ring) {
      if (k === 'c') put(PR.clusters[Math.floor(rr() * PR.clusters.length)], Math.round(x), Math.round(y));
      else { const q = rr(); put(q < .46 ? PR.cedars[Math.floor(rr() * 3)] : q < .7 ? PR.pines[Math.floor(rr() * 3)] : q < .96 ? PR.maples[Math.floor(rr() * 5)] : PR.bamboo, Math.round(x), Math.round(y)); }
    }
    // inner-edge rocks at the cliff ends beside the gate
    for (const [x, y] of [[1540, 330], [1600, 360], [2100, 330], [2040, 362]]) put(PR.clusters[(x + y) % 10], x, y);

    // ---- onsen palace
    {
      const P = { lamps: [] };
      const cv = buildingCanvas(lmPalace, P, LW, LH, LOVER);
      const fi = addFoot({ x: PALACE.x, y: PALACE.y, w: LW, h: LH, roof: '#3d4551', wall: '#f3e9d3' });
      objs.push({ img: cv, x: PALACE.x - SM, y: PALACE.y - LOVER, w: cv.width, h: cv.height, by: PALACE.y + LH, fi });
      for (const [lx, ly] of P.lamps) addLamp(PALACE.x + lx, PALACE.y + ly);
    }
    // ---- houses
    const cache = {};
    for (const [cx, cy, key] of HOUSES) {
      const v = VAR[key];
      if (!cache[key]) {
        const P = { R: TL[v[1]], R2: TL[v[2]], W: PL[v[3]], W2: PL[v[4]], nc: NOREN[v[5]], nc2: NOREN[v[6]], rail: v[7], pil: v[7] === '#b8322a' ? '#b8322a' : '#6e4a32', idx: key.endsWith('b') ? 1 : key.endsWith('c') ? 2 : 0, lamps: [] };
        cache[key] = { cv: buildingCanvas(v[0], P, FW, FH, OVER), lamps: P.lamps, roof: P.R.base, wall: P.W.base };
      }
      const e = cache[key], x = COLX[cx], y = ROWY[cy] + Math.round((hash2(cx, cy, 3) - .5) * 20);
      const fi = addFoot({ x, y, w: FW, h: FH, roof: e.roof, wall: e.wall });
      objs.push({ img: e.cv, x: x - SM, y: y - OVER, w: e.cv.width, h: e.cv.height, by: y + FH, fi });
      for (const [lx, ly] of e.lamps) addLamp(x + lx, y + ly);
    }

    // ---- ground art: stream, pools, yubatake
    const st = makeStream();
    decals.push({ img: st, x: STREAM.x0, y: STREAM.y0, w: st.width, h: st.height });
    for (let x = 560; x < 3120; x += 170) steam.push({ x: x + (hash2(x, 1, 4) - .5) * 60, y: yc(x), r: 17, rise: 80, a: .34, sp: .2 + hash2(x, 2, 4) * .08, ph: hash2(x, 3, 4), i: x % 3 });
    for (const [cx, cy, rx, ry, seed, rs, str] of POOLS) {
      const p = makePool(rx, ry, seed, { rs });
      decals.push({ img: p.cv, x: Math.round(cx - p.ax), y: Math.round(cy - p.ay), w: p.cv.width, h: p.cv.height });
      p.em.forEach(([dx, dy], k) => steam.push({ x: cx + dx, y: cy + dy, r: (16 + Math.min(rx, 140) * .1) * (.8 + hash2(seed, k, 1) * .4), rise: 100 + ry * .35, a: .62 * str, sp: .18 + hash2(seed, k, 2) * .1, ph: hash2(seed, k, 3), i: k % 3 }));
    }
    A.yuba = makeYubatake();
    decals.push({ img: A.yuba, x: YUBA.x - YUBA.w / 2, y: YUBA.y - YUBA.h / 2, w: YUBA.w, h: YUBA.h });
    for (let i = 0; i < 9; i++) steam.push({ x: YUBA.x - 140 + i * 35, y: YUBA.y - 60 + (i % 3) * 40, r: 24, rise: 120, a: .5, sp: .2 + (i % 4) * .03, ph: i * .37 % 1, i: i % 3 });

    // ---- fixed props
    const pools = POOLS.map(p => ({ x: p[0], y: p[1], rx: p[2], ry: p[3] }));
    const blocked = (x, y, m) => {
      if (x < 440 || x > 3200 || y < 450 || y > 3205) return true;
      if (inRect(x, y, ROAD, m * .6 + 6)) return true;
      for (const s of STREETS) if (inRect(x, y, s, m * .5 + 6)) return true;
      { const dx = (x - PLAZA.x) / (PLAZA.rx + m), dy = (y - PLAZA.y) / (PLAZA.ry + m); if (dx * dx + dy * dy < 1) return true; }
      for (const p of pools) { const dx = (x - p.x) / (p.rx + m + 16), dy = (y - p.y) / (p.ry + m + 14); if (dx * dx + dy * dy < 1) return true; }
      if (x > STREAM.x0 - 20 && x < STREAM.x1 + 20 && Math.abs(y - yc(x)) < hw(x) + 22 + m * .5) return true;
      if (inRect(x, y, { x: YUBA.x - YUBA.w / 2, y: YUBA.y - YUBA.h / 2, w: YUBA.w, h: YUBA.h }, m + 10)) return true;
      for (const f of foots) if (inRect(x, y, f, m * .6 + 12)) return true;
      for (const t of taken) if (Math.hypot(t[0] - x, t[1] - y) < t[2] + m) return true;
      return false;
    };
    // road: torii-to-plaza lantern rows and lantern strings
    for (let y = 470, i = 0; y < 880; y += 130, i++) { put(PR.andon, 1694, y, 18, [0, -75]); put(PR.andon, 1946, y, 18, [0, -75]); }
    put(PR.lstring, 1820, 640, 0, [-60, -80]); put(PR.lstring, 1820, 800, 0, [60, -80]);
    put(PR.bridge, 1820, 1004, 0); put(PR.plank, 1040, 1004, 0); put(PR.plank, 2600, 1004, 0);
    put(PR.noboriR, 1700, 1138, 16); put(PR.noboriB, 1960, 1138, 16);
    // plaza rim lanterns, sign board, maples
    for (const deg of [200, 240, 300, 340, 160, 20]) { const a = deg * Math.PI / 180; put(PR.toro, PLAZA.x + (PLAZA.rx + 22) * Math.cos(a), PLAZA.y + (PLAZA.ry + 16) * Math.sin(a), 22, [0, -37]); }
    put(PR.board, 2000, 1214, 30); put(PR.maples[0], 1586, 1250, 40); put(PR.maples[1], 2060, 1270, 40);
    put(PR.bench, 1620, 1420, 28); put(PR.bench, 2020, 1420, 28);
    // palace forecourt: stone lanterns along the walk, cloud pines
    for (const y of [2110, 2250, 2400]) { put(PR.toroL, 1730, y, 22, [0, -52]); put(PR.toroL, 1910, y, 22, [0, -52]); }
    put(PR.pines[2], 1630, 2190, 50); put(PR.pines[1], 2010, 2190, 50);
    put(PR.maples[2], 1580, 2470, 40); put(PR.maples[3], 2068, 2470, 40);
    // the great pool beside the palace (4,3)
    put(PR.spout, 2300, 1720, 30); put(PR.deck, 2330, 2004, 60); put(PR.toroL, 2140, 1990, 24, [0, -52]); put(PR.toroL, 2518, 1980, 24, [0, -52]);
    put(PR.maples[0], 2500, 1700, 40); put(PR.maples[3], 2148, 1704, 40); put(PR.noboriR, 2520, 1760, 14);
    // rotenburo with wooden fence (2,3)
    put(PR.fence, 1135, 1712, 0); put(PR.fence, 1265, 1712, 0); put(PR.fence, 1395, 1712, 0);
    put(PR.fenceV, 1126, 1960, 0); put(PR.hut, 1450, 1990, 50); put(PR.buckets, 1180, 1990, 26); put(PR.spout, 1300, 1734, 24);
    // (1,4) maple grove pool, (5,4) pine garden pool, (2,5) tea corner pool
    put(PR.maples[1], 640, 2210, 40); put(PR.maples[2], 905, 2205, 40); put(PR.bench, 780, 2448, 30); put(PR.toro, 650, 2440, 20, [0, -37]);
    put(PR.pines[0], 2730, 2230, 46); put(PR.bamboo, 3000, 2220, 46); put(PR.spout, 2900, 2230, 24); put(PR.toro, 3000, 2440, 20, [0, -37]);
    put(PR.bfence, 1180, 2776, 0); put(PR.bfence, 1300, 2776, 0); put(PR.nodate, 1450, 2990, 40); put(PR.buckets, 1170, 2990, 26);
    // yubatake: lanterns at the corners, little shrine behind
    for (const [x, y] of [[1630, 2770], [2010, 2770], [1630, 3010], [2010, 3010]]) put(PR.andon, x, y, 18, [0, -75]);
    put(PR.hokora, 1820, 3130, 50); put(PR.noboriB, 1650, 3110, 14); put(PR.noboriR, 1990, 3110, 14);
    // street lanterns along the promenade and avenues
    for (let x = 560; x < 3120; x += 250) if (Math.abs(x - 1820) > 160) put(PR.andon, x, 1112, 16, [0, -75]);
    for (let y = 1240; y < 3200; y += 300) { put(PR.andon, 978, y, 16, [0, -75]); put(PR.andon, 2662, y, 16, [0, -75]); }
    for (let x = 640; x < 3100; x += 340) if (Math.abs(x - 1820) > 200) put(PR.toro, x, 2668, 18, [0, -37]);
    // scattered dressing in every cell
    const houseCells = new Set(HOUSES.map(h => h[0] + ',' + h[1]));
    for (let cy = 1; cy < NC - 1; cy++) for (let cx = 1; cx < NC - 1; cx++) {
      if (cx === 3 && cy <= 3) continue;
      const R = rng(cx * 977 + cy * 7919 + 5), house = houseCells.has(cx + ',' + cy);
      const list = house
        ? [PR.maples[Math.floor(R() * 5)], PR.rocks[2], PR.shrubs[Math.floor(R() * 2)], [PR.buckets, PR.barrels, PR.tanuki, PR.bench][Math.floor(R() * 4)], PR.rocks[1], PR.toro, PR.shrubs[0], PR.rocks[0]]
        : [PR.rocks[3], PR.maples[Math.floor(R() * 6)], PR.rocks[2], PR.shrubs[1], PR.cedars[Math.floor(R() * 3)], PR.rocks[1], PR.shrubs[0], PR.rocks[0]];
      for (const s of list) {
        const m = s === PR.toro ? 18 : Math.max(16, Math.min(46, s.cv.width * .26));
        for (let tries = 0; tries < 18; tries++) {
          const x = cx * BLOCK + 30 + R() * 460, y = cy * BLOCK + 40 + R() * 450;
          if (blocked(x, y, m)) continue;
          put(s, x, y, m, s === PR.toro ? [0, -37] : null);
          break;
        }
      }
    }
    // stray rocks and leaf-litter shrubs along the wall feet
    { const R = rng(4242); for (let i = 0; i < 90; i++) { const x = 440 + R() * 2760, y = 450 + R() * 2760; const s = R() < .5 ? PR.rocks[Math.floor(R() * 2)] : PR.shrubs[Math.floor(R() * 2)]; if (!blocked(x, y, 18)) put(s, x, y, 18); } }

    objs.sort((p, q) => p.by - q.by || p.x - q.x);
    ready = true;
  }

  // ------------------------------------------------------------------ drawing
  function fillPaths(ctx, x0, y0, x1, y1) {
    const hit = (r, m = 8) => r.x - m < x1 && r.x + r.w + m > x0 && r.y - m < y1 && r.y + r.h + m > y0;
    const pr = { x: PLAZA.x - PLAZA.rx - 12, y: PLAZA.y - PLAZA.ry - 12, w: PLAZA.rx * 2 + 24, h: PLAZA.ry * 2 + 24 };
    ctx.fillStyle = '#4e4a42';
    for (const s of STREETS) if (hit(s)) ctx.fillRect(s.x - 5, s.y - 5, s.w + 10, s.h + 10);
    if (hit(ROAD)) ctx.fillRect(ROAD.x - 5, ROAD.y, ROAD.w + 10, ROAD.h);
    if (hit(pr)) { ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx + 7, PLAZA.ry + 7, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = A.pavePat;
    for (const s of STREETS) if (hit(s, 0)) ctx.fillRect(s.x, s.y, s.w, s.h);
    if (hit(ROAD, 0)) ctx.fillRect(ROAD.x, ROAD.y, ROAD.w, ROAD.h);
    if (hit(pr)) {
      ctx.fillStyle = A.plazaPat; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx - 6, PLAZA.ry - 6, 0, 0, TAU); ctx.strokeStyle = 'rgba(230,224,210,.5)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.drawImage(A.emblem, PLAZA.x - A.emblem.width / 2, PLAZA.y - A.emblem.height / 2 + 6);
    }
    // soft shade along the inner wall feet (sun from the north-west)
    ctx.fillStyle = 'rgba(30,22,14,.22)';
    if (y0 < WIN + 24) { ctx.fillRect(WIN, WIN, 1160, 20); ctx.fillRect(2080, WIN, WOUT - 2080, 20); }
    if (x0 < WIN + 24) ctx.fillRect(WIN, WIN, 18, WOUT - WIN);
    if (y1 > WOUT - 30) ctx.fillRect(WIN, WOUT, WOUT - WIN, 10);
  }

  function drawStatic(ctx, bounds, isDestroyed) {
    if (!ready) build();
    const x0 = bounds.x, y0 = bounds.y, x1 = bounds.x + bounds.w, y1 = bounds.y + bounds.h;
    if (x1 < -170 || x0 > SIZE + 170 || y1 < -170 || y0 > SIZE + 170) return;
    const ix0 = Math.max(0, x0), iy0 = Math.max(0, y0), ix1 = Math.min(SIZE, x1), iy1 = Math.min(SIZE, y1);
    ctx.save();
    if (ix1 > ix0 && iy1 > iy0) {
      ctx.fillStyle = A.groundPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      ctx.fillStyle = A.rockPat;
      const band = (bx, by, bw, bh) => { const ax = Math.max(ix0, bx), ay = Math.max(iy0, by), bx1 = Math.min(ix1, bx + bw), by1 = Math.min(iy1, by + bh); if (bx1 > ax && by1 > ay) ctx.fillRect(ax, ay, bx1 - ax, by1 - ay); };
      band(0, 0, SIZE, WIN - 60); band(0, 0, WIN - 16, SIZE); band(WOUT + 16, 0, SIZE - WOUT - 16, SIZE); band(0, WOUT + 6, SIZE, SIZE - WOUT - 6);
      band(0, WIN - 60, 1560, 60); band(2080, WIN - 60, SIZE - 2080, 60);
      fillPaths(ctx, ix0, iy0, ix1, iy1);
      for (const d of decals) if (d.x < x1 && d.x + d.w > x0 && d.y < y1 && d.y + d.h > y0) ctx.drawImage(d.img, d.x, d.y);
    }
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (o.x > x1 || o.x + o.w < x0 || o.y > y1 || o.y + o.h < y0) continue;
      if (o.fi >= 0 && isDestroyed && isDestroyed(o.fi)) continue;
      if (o.sw) ctx.drawImage(o.img, o.sx, 0, o.sw, o.h, o.x, o.y, o.sw, o.h);
      else ctx.drawImage(o.img, o.x, o.y);
    }
    ctx.restore();
  }

  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    const t = time || 0, vx0 = view.x, vy0 = view.y, vx1 = view.x + view.w, vy1 = view.y + view.h;
    if (vx1 < -160 || vx0 > SIZE + 160 || vy1 < -160 || vy0 > SIZE + 160) return;
    ctx.save();
    // steam wisps rising from every pool, the stream and the yubatake
    const P = A.puffs;
    for (let j = 0; j < steam.length; j++) {
      const e = steam[j];
      if (e.x < vx0 - 90 || e.x > vx1 + 60 || e.y + 40 < vy0 || e.y - e.rise - 60 > vy1) continue;
      for (let k = 0; k < 3; k++) {
        const u = (t * e.sp + e.ph + k / 3) % 1, a = Math.sin(u * Math.PI) * (1 - u * .35) * e.a;
        if (a < .015) continue;
        const s = e.r * (.6 + u * 1.6), x = e.x + Math.sin(u * 4.5 + e.ph * 9 + t * .4) * 10 + u * u * 34, y = e.y - u * e.rise;
        ctx.globalAlpha = a; ctx.drawImage(P[(e.i + k) % 3], x - s, y - s, s * 2, s * 2);
      }
    }
    // gently flickering lantern glow
    ctx.globalCompositeOperation = 'lighter';
    const G = A.glow;
    for (let i = 0; i < lanternsLocal.length; i++) {
      const l = lanternsLocal[i];
      if (l.x < vx0 - 30 || l.x > vx1 + 30 || l.y < vy0 - 30 || l.y > vy1 + 30) continue;
      ctx.globalAlpha = .13 + .05 * Math.sin(t * 6.3 + i * 1.7) + .03 * Math.sin(t * 15.1 + i * 2.3);
      ctx.drawImage(G, l.x - 24, l.y - 24, 48, 48);
    }
    ctx.globalCompositeOperation = 'source-over';
    // falling maple leaves
    const lx0 = Math.max(vx0, 0), ly0 = Math.max(vy0, 0), lx1 = Math.min(vx1, SIZE), ly1 = Math.min(vy1, SIZE);
    if (lx1 > lx0 && ly1 > ly0) {
      ctx.globalAlpha = .92;
      const Q = 640, L = A.leaves;
      for (let i = 0; i < 12; i++) {
        const v = 24 + hash2(i, 1, 7) * 26, bx = hash2(i, 2, 7) * Q, by = hash2(i, 3, 7) * Q;
        const y = ((by + t * v) % Q + Q) % Q, x = ((bx + Math.sin(t * .9 + i * 2.1) * 26 + t * 10) % Q + Q) % Q;
        const img = L[(i & 3) * 4 + (Math.floor(t * 3.5 + i * 1.3) & 3)];
        for (let kx = Math.floor((lx0 - x) / Q); x + kx * Q < lx1; kx++) for (let ky = Math.floor((ly0 - y) / Q); y + ky * Q < ly1; ky++) ctx.drawImage(img, x + kx * Q, y + ky * Q);
      }
    }
    ctx.restore();
  }

  function drawMinimap(ctx) {
    if (!ready) build();
    ctx.save();
    ctx.fillStyle = GR.base; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#6a665b'; ctx.fillRect(0, 0, SIZE, WIN); ctx.fillRect(0, 0, WIN, SIZE); ctx.fillRect(WOUT, 0, SIZE - WOUT, SIZE); ctx.fillRect(0, WOUT, SIZE, SIZE - WOUT);
    ctx.fillStyle = '#a8a296'; for (const s of STREETS) ctx.fillRect(s.x, s.y, s.w, s.h); ctx.fillRect(ROAD.x, ROAD.y, ROAD.w, ROAD.h);
    ctx.fillStyle = '#bcb6aa'; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = WATER.base;
    ctx.beginPath(); for (let x = STREAM.x0; x <= STREAM.x1; x += 40) { const y = yc(x) - hw(x); x === STREAM.x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } for (let x = STREAM.x1; x >= STREAM.x0; x -= 40) ctx.lineTo(x, yc(x) + hw(x)); ctx.closePath(); ctx.fill();
    for (const [cx, cy, rx, ry] of POOLS) { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill(); }
    ctx.fillRect(YUBA.x - YUBA.w / 2 + 20, YUBA.y - YUBA.h / 2 + 20, YUBA.w - 40, YUBA.h - 50);
    ctx.fillStyle = '#4e3628';
    ctx.fillRect(WIN - 30, WIN - 30, 1160 + 30, 30); ctx.fillRect(2080, WIN - 30, WOUT - 2080 + 30, 30);
    ctx.fillRect(WIN - 30, WIN - 30, 30, WOUT - WIN + 60); ctx.fillRect(WOUT, WIN - 30, 30, WOUT - WIN + 60); ctx.fillRect(WIN - 30, WOUT, WOUT - WIN + 60, 30);
    for (const f of foots) {
      if (f.solid || f.x === PALACE.x) continue;
      ctx.fillStyle = f.roof; ctx.fillRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40);
      ctx.strokeStyle = '#2e231d'; ctx.lineWidth = 14; ctx.strokeRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40);
    }
    ctx.fillStyle = '#c0392b'; ctx.fillRect(PALACE.x + 10, PALACE.y + 10, LW - 20, LH - 20);
    ctx.strokeStyle = '#f0c850'; ctx.lineWidth = 36; ctx.strokeRect(PALACE.x + 10, PALACE.y + 10, LW - 20, LH - 20);
    ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = 12; ctx.strokeRect(PALACE.x + 10, PALACE.y + 10, LW - 20, LH - 20);
    ctx.restore();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  const mod = window.ShinobiVillages.yu = {
    id: 'yu', name: 'LÀNG SUỐI NƯỚC NÓNG', jp: '湯隠れの里', kage: 'HIDAN',
    cols: NC, rows: NC,
    gate: { side: 'n', at: 1820 },
    spawn: { x: SPAWN.x, y: SPAWN.y },
    lanterns: [],
    init() {
      if (!ready) build();
      mod.lanterns.length = 0;
      for (const l of lanternsLocal) mod.lanterns.push({ x: l.x, y: l.y });
    },
    footprints() { if (!ready) build(); return foots.map(f => ({ ...f })); },
    drawStatic, drawAmbient, drawMinimap
  };
})();
