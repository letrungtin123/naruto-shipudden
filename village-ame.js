/* village-ame.js — Amegakure no Sato (Hidden Rain Village), a gloomy industrial city on a grey lake.
   Registers window.ShinobiVillages.ame. Procedural Canvas 2D in the same 3/4 oblique, cel-shaded style as
   village-suna.js / village-kiri.js (light from the top-left, dark outlines, cached sprites). No external images. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, NC = 7, SIZE = BLOCK * NC;
  const OUT = '#181d24';
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const SM = 30, OVER = 320, BM = 26;           // house canvas margins: sides / above the footprint / below
  const TSM = 46, TOVER = 620;                   // Pain's tower canvas margins
  const SHADOW = 'rgba(4,8,14,.34)';
  const LIT = '#f4c45a', LIT2 = '#fff0b8', LITD = '#d99a3c';
  // perimeter geometry (local px)
  const N_TOP = 118, N_FACE = 232, N_BASE = 400;   // north wall: walkway top, front face, foot
  const S_TOP = 3240, S_FACE = 3392, S_BASE = 3532; // south wall: walkway top, outer face, waterline
  const W_OUT = 112, W_IN = 360, W_BASE = 400;     // west wall: outer edge, inner edge of the walkway, foot of the side face
  const E_OUT = 3528, E_IN = 3280, E_BASE = 3240;  // east wall (mirror)
  const GATE = { x0: 1712, x1: 1928 };
  const PLAZA = { x: 1820, y: 1880, rx: 440, ry: 380 };
  const TOWER = { x: 1600, y: 1580, w: 440, h: 410 };
  const SPAWN = { x: 1820, y: 480 };
  const BASIN = { x: 600, y: 2170, w: 340, h: 290 };
  const STREETS = [
    { x: 1720, y: 380, w: 200, h: 1180 },          // gate avenue -> plaza
    { x: 1745, y: 2230, w: 150, h: 1012 },         // plaza -> south wall (market street)
    { x: 400, y: 985, w: 2840, h: 110 }, { x: 400, y: 2545, w: 2840, h: 110 },
    { x: 985, y: 400, w: 110, h: 2840 }, { x: 2545, y: 400, w: 110, h: 2840 }
  ];
  const RING_R = [8, 16, 32];                      // ripple sprite base radii
  const SLANT = .3;                             // rain: dx per dy

  // ------------------------------------------------------------------ utils
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
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
  // cool tone ramp: rain-washed concrete and steel
  function toneA(base) {
    return { base, light: mix(base, '#dce6f0', .28), hi: mix(base, '#f2f6fa', .55), dark: mix(base, '#141a22', .3), deep: mix(base, '#0b0f15', .55),
      roof: mix(base, '#1b222b', .42), roofD: mix(base, '#11161c', .56), roofL: mix(base, '#c8d4e0', .2) };
  }
  // smooth periodic wobble (period = one block), range ~[0,1]
  function wv(t, s) { const k = TAU * t / BLOCK; return .5 + .2 * Math.sin(k + s * 1.7) + .15 * Math.sin(2 * k + s * 2.9) + .1 * Math.sin(3 * k + s * .7) + .05 * Math.sin(5 * k + s * 4.1); }
  const mod = (a, m) => ((a % m) + m) % m;

  // ------------------------------------------------------------------ primitives
  function poly(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
  function fpoly(c, p, col) { poly(c, p); c.fillStyle = col; c.fill(); }
  function frect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function fell(c, x, y, rx, ry, col) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); c.fillStyle = col; c.fill(); }
  function sk(c, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
  function line(c, x1, y1, x2, y2, col, lw) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); sk(c, col, lw); }
  function srect(c, x, y, w, h, col = OUT, lw = 2) { c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function txt(c, s, x, y, size, col, o = {}) {
    c.font = `${o.weight || '700'} ${size}px ${o.font || MINCHO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 3; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
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
  function blob(cx, cy, rx, ry, R, n = 12, j = .26) {
    const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, q = 1 - j + R() * j; pts.push([cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]); }
    const p = new Path2D(); p.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) { const q = pts[(i + 1) % n]; p.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + q[0]) / 2, (pts[i][1] + q[1]) / 2); }
    p.closePath(); return p;
  }
  // horizontal band between y=f0(x) and y=f1(x), x in [a,b] (samples on a global 8 px grid -> seamless)
  function bandH(f0, f1, a, b) {
    const p = new Path2D(), s = Math.floor(a / 8) * 8, e = Math.ceil(b / 8) * 8;
    p.moveTo(s, f0(s)); for (let x = s + 8; x <= e; x += 8) p.lineTo(x, f0(x));
    for (let x = e; x >= s; x -= 8) p.lineTo(x, f1(x));
    p.closePath(); return p;
  }
  function bandV(g0, g1, a, b) {
    const p = new Path2D(), s = Math.floor(a / 8) * 8, e = Math.ceil(b / 8) * 8;
    p.moveTo(g0(s), s); for (let y = s + 8; y <= e; y += 8) p.lineTo(g0(y), y);
    for (let y = e; y >= s; y -= 8) p.lineTo(g1(y), y);
    p.closePath(); return p;
  }

  // ------------------------------------------------------------------ industrial building kit
  function win(c, x, y, w, h, lit) {
    frect(c, x - 2, y - 2, w + 4, h + 4, '#1a2027');
    if (lit) { frect(c, x, y, w, h, LITD); frect(c, x, y, w, h * .6, LIT); frect(c, x + 1, y + 1, Math.max(1.5, w * .28), h * .5, LIT2); }
    else { frect(c, x, y, w, h, '#24303b'); fpoly(c, [x + w * .1, y + h, x + w * .5, y, x + w * .78, y, x + w * .38, y + h], 'rgba(150,180,210,.2)'); }
    if (w >= 14) frect(c, x + w / 2 - .75, y, 1.5, h, '#1a2027');
    if (h >= 18) frect(c, x, y + h * .5 - .75, w, 1.5, '#1a2027');
    frect(c, x - 2, y + h + 2, w + 4, 2, 'rgba(165,182,198,.42)');
  }
  function winGrid(c, x, y, w, h, cols, rows, ww, wh, R, litP, P, maxL = 1) {
    const sx = (w - cols * ww) / (cols + 1), sy = (h - rows * wh) / (rows + 1);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const wx = Math.round(x + sx + k * (ww + sx)), wy = Math.round(y + sy + r * (wh + sy)), lit = R() < litP;
      win(c, wx, wy, ww, wh, lit);
      if (lit && P && P.wl < maxL && R() < .3) { P.lamps.push([wx + ww / 2, wy + wh / 2]); P.wl++; }
    }
  }
  function door(c, x, y, w, h, col = '#36404a') {
    frect(c, x - 4, y - 4, w + 8, h + 4, '#1d232a');
    frect(c, x, y, w, h, col);
    frect(c, x, y, 3, h, 'rgba(200,215,230,.16)');
    if (w > 26) line(c, x + w / 2, y, x + w / 2, y + h, '#1d232a', 1.5);
    srect(c, x + 4, y + 5, w - 8, h * .3, 'rgba(8,12,18,.45)', 1);
    fell(c, x + w - 6, y + h * .56, 1.6, 1.6, '#b8a070');
    frect(c, x + w / 2 - 7, y - 13, 14, 5, '#262c33'); fell(c, x + w / 2, y - 6, 4.5, 2.6, LIT2); fell(c, x + w / 2, y - 4, 9, 5, 'rgba(255,214,120,.16)');
    srect(c, x - 4, y - 4, w + 8, h + 4, OUT, 1.4);
  }
  function shutter(c, x, y, w, h, col = '#66707b') {
    frect(c, x - 3, y - 7, w + 6, 8, '#262c34'); srect(c, x - 3, y - 7, w + 6, 8, OUT, 1.2);
    frect(c, x, y, w, h, col);
    c.strokeStyle = 'rgba(12,18,26,.45)'; c.lineWidth = 1; c.beginPath();
    for (let yy = y + 4; yy < y + h; yy += 4) { c.moveTo(x, yy + .5); c.lineTo(x + w, yy + .5); } c.stroke();
    frect(c, x, y, 3, h, 'rgba(220,230,240,.18)'); frect(c, x + w - 5, y, 5, h, 'rgba(8,12,20,.25)');
    frect(c, x + w * .3, y, 3, h * .7, 'rgba(140,80,40,.28)'); frect(c, x + w * .72, y, 2, h * .45, 'rgba(140,80,40,.22)');
    frect(c, x, y + h - 4, w, 4, '#3a424b');
    srect(c, x, y, w, h, OUT, 1.4);
  }
  function drips(c, x, y, w, n, seed) {
    const R = rng(seed);
    for (let i = 0; i < n; i++) { const px = x + R() * w, len = 4 + R() * 9; line(c, px, y, px, y + len, 'rgba(175,200,225,.42)', 1.1); fell(c, px, y + len + 1.4, 1.1, 1.6, 'rgba(205,222,240,.65)'); }
  }
  function roofSlab(c, x, y, w, d, T) {
    frect(c, x - 3, y, w + 6, d, T.roof);
    frect(c, x + 4, y + 6, w - 8, d - 12, T.roofD);
    frect(c, x + 4, y + 6, w - 8, 4, 'rgba(0,0,0,.28)'); frect(c, x + 4, y + 6, 4, d - 12, 'rgba(0,0,0,.18)');
    if (d > 24 && w > 50) {
      fell(c, x + w * .62, y + d * .58, Math.min(w * .17, 30), Math.min(d * .17, 7), 'rgba(105,130,155,.42)');
      fell(c, x + w * .58, y + d * .54, Math.min(w * .07, 12), 1.4, 'rgba(200,215,235,.4)');
    }
    frect(c, x - 3, y, w + 6, 2, T.roofL);
    frect(c, x - 3, y + d - 4, w + 6, 4, T.light);
    srect(c, x - 3, y, w + 6, d, OUT, 2);
  }
  // Flat-roofed box: roof slab (y..y+d) then the south face (y+d .. y+d+h). Returns geometry.
  function box(c, x, y, w, d, h, T, o = {}) {
    const fy = y + d, by = fy + h, g = { x, y, w, d, h, fy, by };
    if (o.shadow !== false) {
      c.fillStyle = SHADOW; c.beginPath();
      c.moveTo(x + w, fy + 6); c.lineTo(x + w + 22, fy + 20); c.lineTo(x + w + 22, by + 12); c.lineTo(x + 18, by + 12); c.lineTo(x + 6, by); c.lineTo(x + w, by); c.closePath(); c.fill();
    }
    const R = rng(o.seed || (x * 31 + y * 17 + w * 7 + h));
    c.save(); c.beginPath(); c.rect(x, fy, w, h); c.clip();
    frect(c, x, fy, w, h, T.base);
    const pw = o.panel ?? 46;
    if (pw) { c.strokeStyle = 'rgba(8,12,20,.2)'; c.lineWidth = 1; c.beginPath(); for (let xx = x + pw; xx < x + w - 6; xx += pw) { c.moveTo(xx + .5, fy); c.lineTo(xx + .5, by); } c.stroke(); }
    if (o.floors) for (let yy = fy + o.floors; yy < by - 12; yy += o.floors) { frect(c, x, yy, w, 3, T.dark); frect(c, x, yy + 3, w, 1, 'rgba(200,215,230,.14)'); }
    for (let i = 0, n = Math.ceil(w / 15); i < n; i++) {
      const sx = x + R() * w, sy = fy + (R() < .6 ? 0 : R() * h * .6);
      c.fillStyle = R() < .22 ? 'rgba(125,72,40,.16)' : 'rgba(8,14,24,.15)'; c.fillRect(sx, sy, 2 + R() * 5, 18 + R() * h * .5);
    }
    if (o.paint) o.paint(c, g);
    frect(c, x, fy, 5, h, 'rgba(205,220,236,.22)'); frect(c, x + 5, fy, 8, h, 'rgba(205,220,236,.07)');
    frect(c, x + w - 16, fy, 16, h, 'rgba(4,8,15,.2)'); frect(c, x + w - 6, fy, 6, h, 'rgba(4,8,15,.2)');
    frect(c, x, fy, w, 7, 'rgba(4,8,15,.32)');
    frect(c, x, by - 14, w, 14, 'rgba(6,12,20,.3)'); frect(c, x, by - 3, w, 3, 'rgba(150,175,200,.16)');
    c.restore();
    srect(c, x, fy, w, h, OUT, 2);
    if (o.roof !== false) roofSlab(c, x, y, w, d, T);
    if (o.drips !== false) drips(c, x, fy + 2, w, Math.ceil(w / 40), (o.seed || 7) + 3);
    return g;
  }
  function cylPath(cx, ty, rx, ry, h) {
    const p = new Path2D();
    p.moveTo(cx - rx, ty); p.lineTo(cx - rx, ty + h);
    p.ellipse(cx, ty + h, rx, ry, 0, Math.PI, 0, true);
    p.lineTo(cx + rx, ty);
    p.ellipse(cx, ty, rx, ry, 0, 0, Math.PI, false);
    p.closePath(); return p;
  }
  function cyl(c, cx, ty, rx, h, T, o = {}) {
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
    const H = h + ry * 2 + 2;
    c.fillStyle = 'rgba(225,236,248,.24)'; c.fillRect(cx - rx, ty - ry, rx * .34, H);
    c.fillStyle = 'rgba(225,236,248,.1)'; c.fillRect(cx - rx * .66, ty - ry, rx * .3, H);
    c.fillStyle = 'rgba(6,12,22,.16)'; c.fillRect(cx + rx * .3, ty - ry, rx * .75, H);
    c.fillStyle = 'rgba(6,12,22,.2)'; c.fillRect(cx + rx * .72, ty - ry, rx * .32, H);
    c.beginPath(); c.ellipse(cx, ty + h - 10, rx + 2, ry, 0, 0, Math.PI); c.lineTo(cx - rx - 2, ty + h + ry + 6); c.lineTo(cx + rx + 2, ty + h + ry + 6); c.closePath();
    c.fillStyle = 'rgba(6,12,20,.26)'; c.fill();
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    return g;
  }
  function cylWins(c, g, yo, n, ww, wh, R, litP, span = 1.15, skip = 0) {
    for (let i = 0; i < n; i++) {
      const th = n === 1 ? 0 : -span + 2 * span * i / (n - 1);
      if (Math.abs(th) < skip) continue;
      const x = g.cx + g.rx * Math.sin(th), w = Math.max(3, ww * Math.cos(th)), y = g.ty + g.ry * Math.cos(th) + yo;
      win(c, x - w / 2, y, w, wh, R() < litP);
    }
  }
  function capTop(c, g, T) {
    fell(c, g.cx, g.ty, g.rx, g.ry, T.light); fell(c, g.cx, g.ty + 1, g.rx - 5, g.ry - 2.5, T.roofD);
    c.beginPath(); c.ellipse(g.cx, g.ty, g.rx, g.ry, 0, 0, TAU); sk(c, OUT, 1.8);
  }
  function cone(c, cx, ty, rx, ry, h, R, ov = 6) {
    const ay = ty - h, L = cx - rx - ov, Rr = cx + rx + ov, ery = ry + ov * .4;
    const p = new Path2D(); p.moveTo(L, ty); p.lineTo(cx, ay); p.lineTo(Rr, ty); p.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); p.closePath();
    c.save(); c.fillStyle = R.base; c.fill(p); c.clip(p);
    fpoly(c, [L - 2, ty - 2, cx, ay, cx - rx * .22, ty + ery + 2, L - 2, ty + ery + 2], R.light);
    fpoly(c, [cx, ay, Rr + 2, ty - 2, Rr + 2, ty + ery + 2, cx + rx * .42, ty + ery + 2], R.dark);
    c.strokeStyle = 'rgba(8,14,22,.25)'; c.lineWidth = 1.4; c.beginPath();
    for (let i = -7; i <= 7; i++) { const t = i / 7.5 * 1.45; c.moveTo(cx, ay); c.lineTo(cx + (rx + ov) * Math.sin(t), ty + ery * Math.cos(t)); }
    c.stroke(); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); sk(c, R.deep, 4);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    fell(c, cx, ay, 3, 3, R.deep);
  }
  function domeTop(c, cx, ty, rx, ry, dh, R) {
    const p = new Path2D(); p.moveTo(cx - rx, ty); p.ellipse(cx, ty, rx, dh, 0, Math.PI, TAU); p.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); p.closePath();
    celFill(c, p, R.base, R.light, R.dark, { ld: rx * .2, dd: rx * .3 });
    c.save(); c.clip(p); fell(c, cx - rx * .38, ty - dh * .6, rx * .2, dh * .14, 'rgba(230,240,250,.3)'); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, R.deep, 3);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
  }
  // Exposed pipe with a lit upper-left edge, collars and elbow joints (kiri style, wetter).
  function pipe(c, pts, w = 7, col = '#76828d') {
    const tr = (ox, oy) => { c.beginPath(); c.moveTo(pts[0] + ox, pts[1] + oy); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i] + ox, pts[i + 1] + oy); };
    c.save(); c.lineJoin = 'round'; c.lineCap = 'butt';
    tr(0, 0); sk(c, OUT, w + 3);
    tr(0, 0); sk(c, col, w);
    tr(w * .2, w * .2); sk(c, mix(col, '#121a24', .4), w * .32);
    tr(-w * .2, -w * .2); sk(c, mix(col, '#ffffff', .45), w * .2);
    c.restore();
    const dk = mix(col, '#121a24', .38);
    for (let i = 0; i < pts.length - 2; i += 2) {
      const x1 = pts[i], y1 = pts[i + 1], x2 = pts[i + 2], y2 = pts[i + 3], L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 1) continue;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy * (w / 2 + 1.5), ny = ux * (w / 2 + 1.5);
      for (let t = 24; t < L - 10; t += 40) { const px = x1 + ux * t, py = y1 + uy * t; line(c, px + nx, py + ny, px - nx, py - ny, dk, 3); }
    }
    for (let i = 2; i < pts.length - 2; i += 2) { fell(c, pts[i], pts[i + 1], w * .72, w * .72, dk); c.beginPath(); c.arc(pts[i], pts[i + 1], w * .72, 0, TAU); sk(c, OUT, 1); }
  }
  function tankLegs(c, cx, baseY, r, h, col, o = {}) {
    const T = toneA(col), ry = r * .42, legH = o.legH ?? 10;
    fell(c, cx + 6, baseY + 1, r * 1.05, ry * .9, SHADOW);
    c.strokeStyle = '#262c33'; c.lineWidth = 3; c.beginPath();
    c.moveTo(cx - r * .7, baseY); c.lineTo(cx - r * .7, baseY - legH - 4);
    c.moveTo(cx + r * .7, baseY); c.lineTo(cx + r * .7, baseY - legH - 4);
    c.moveTo(cx, baseY + 2); c.lineTo(cx, baseY - legH); c.stroke();
    if (legH > 14) { line(c, cx - r * .7, baseY - 2, cx + r * .7, baseY - legH + 2, '#262c33', 1.5); line(c, cx + r * .7, baseY - 2, cx - r * .7, baseY - legH + 2, '#262c33', 1.5); }
    const ty = baseY - legH - h - ry;
    cyl(c, cx, ty, r, h, T, { band: [[h * .3, 3, T.dark], [h * .7, 3, T.dark]],
      paint: (cc, g) => { cc.fillStyle = 'rgba(120,64,34,.32)'; cc.fillRect(cx + r * .1, g.ty + g.ry + h * .32, 3, h * .6); cc.fillRect(cx - r * .5, g.ty + g.ry + h * .72, 2, h * .3); } });
    cone(c, cx, ty, r, ry, r * .5, toneA(mix(col, '#10161c', .35)), 3);
    return ty;
  }
  function chimney(c, cx, baseY, r, h, col) {
    const T = toneA(col), g = cyl(c, cx, baseY - h, r, h, T, { band: [[6, 5, T.deep], [h * .45, 4, T.dark], [h * .75, 4, T.dark]] });
    fell(c, cx, g.ty, r, g.ry, T.dark); fell(c, cx, g.ty + 1, r - 3, g.ry - 1.5, '#0e1115');
    c.beginPath(); c.ellipse(cx, g.ty, r, g.ry, 0, 0, TAU); sk(c, OUT, 1.6);
    frect(c, cx - r, g.ty, r * 2, 10, 'rgba(10,12,16,.35)');
    return g;
  }
  function vent(c, x, y, w, h) {
    const tp = h * .38;
    frect(c, x + 4, y + h, w, 4, SHADOW);
    frect(c, x, y, w, tp, '#6c7782'); frect(c, x, y + tp, w, h - tp, '#47515b');
    c.strokeStyle = '#2a3139'; c.lineWidth = 1; c.beginPath(); for (let yy = y + tp + 3; yy < y + h - 1; yy += 3) { c.moveTo(x + 2, yy + .5); c.lineTo(x + w - 2, yy + .5); } c.stroke();
    srect(c, x, y, w, h, OUT, 1.3);
  }
  function antenna(c, x, y, h) {
    line(c, x, y, x, y - h, OUT, 4); line(c, x, y, x, y - h, '#6c7782', 2);
    for (const f of [.45, .7]) line(c, x - 9 * (1 - f) - 3, y - h * f, x + 9 * (1 - f) + 3, y - h * f, '#2a3139', 2);
    line(c, x, y - h * .55, x + 22, y - 2, 'rgba(25,30,36,.7)', 1);
    fell(c, x, y - h, 3, 3, '#d8463a'); fell(c, x, y - h, 7, 7, 'rgba(230,80,60,.2)');
  }
  function ladderV(c, x, y0, y1) {
    for (let yy = y0 + 6; yy < y1 - 2; yy += 8) line(c, x, yy, x + 12, yy, '#3e4750', 1.8);
    for (const dx of [0, 12]) { line(c, x + dx, y0, x + dx, y1, OUT, 3.6); line(c, x + dx, y0, x + dx, y1, '#7a8691', 1.6); }
  }
  function railing(c, x, y, w, ht = 12) {
    c.strokeStyle = '#2a3139'; c.lineWidth = 1.6; c.beginPath();
    for (let xx = x + 2; xx <= x + w - 1; xx += 10) { c.moveTo(xx, y); c.lineTo(xx, y - ht); } c.stroke();
    line(c, x, y - ht, x + w, y - ht, OUT, 3.2); line(c, x, y - ht - .5, x + w, y - ht - .5, '#7a8691', 1.3);
  }
  function rainMark(c, cx, cy, s, col, lw) {
    c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'butt'; c.beginPath();
    for (let i = 0; i < 4; i++) { const x = cx + (i - 1.5) * s * .27; c.moveTo(x, cy - s / 2); c.lineTo(x, cy + s / 2); }
    c.stroke(); c.lineCap = 'round';
  }
  function bannerRain(c, x, y, w, h, col) {
    line(c, x - 5, y, x + w + 5, y, OUT, 4.2); line(c, x - 5, y - .5, x + w + 5, y - .5, '#6c7782', 1.8);
    const p = [x, y + 2, x + w, y + 2, x + w, y + h, x + w * .75, y + h - 7, x + w * .5, y + h, x + w * .25, y + h - 7, x, y + h];
    fpoly(c, p, col);
    frect(c, x, y + 2, 3, h - 9, 'rgba(255,255,255,.12)'); frect(c, x + w - 4, y + 2, 4, h - 9, 'rgba(0,0,0,.28)');
    frect(c, x, y + 4, w, 2, 'rgba(210,220,232,.35)');
    rainMark(c, x + w / 2, y + h * .44, Math.min(h * .34, w * .95), '#d8dfe8', Math.max(1.4, w * .075));
    poly(c, p); sk(c, OUT, 1.3);
  }
  function signV(c, x, y, w, h, str, bg = '#262e38', fg = '#e8dcb4') {
    frect(c, x + 3, y + 3, w, h, 'rgba(0,0,0,.3)');
    frect(c, x, y, w, h, bg); srect(c, x, y, w, h, OUT, 1.5); srect(c, x + 2, y + 2, w - 4, h - 4, 'rgba(220,200,150,.35)', 1);
    const n = str.length, s = Math.min(w * .78, (h - 6) / n);
    [...str].forEach((ch, i) => txt(c, ch, x + w / 2, y + 3 + s * (i + .55), s, fg, { weight: '900' }));
  }
  function awningM(c, x, y, w, d, col) {
    const T = toneA(col);
    frect(c, x, y + d, w, 6, 'rgba(4,8,14,.35)');
    fpoly(c, [x, y, x + w, y, x + w + 5, y + d, x - 5, y + d], T.base);
    c.strokeStyle = T.dark; c.lineWidth = 1.3; c.beginPath();
    for (let i = 1; i < w / 6; i++) { const t = i * 6 / w; c.moveTo(x + w * t, y); c.lineTo(x - 5 + (w + 10) * t, y + d); } c.stroke();
    fpoly(c, [x, y, x + w, y, x + w + 1, y + 3, x - 1, y + 3], T.light);
    frect(c, x - 5, y + d - 2, w + 10, 3, T.deep);
    poly(c, [x, y, x + w, y, x + w + 5, y + d, x - 5, y + d]); sk(c, OUT, 1.4);
    drips(c, x - 4, y + d + 1, w + 8, Math.ceil(w / 12), Math.floor(x * 3 + y));
  }
  function fireEscape(c, x, y0, y1, w = 34) {
    for (let y = y0; y < y1 - 30; y += 52) {
      frect(c, x, y + 26, w, 4, '#2a3139');
      railing(c, x, y + 26, w, 10);
      const L = (y / 52) % 2 < 1;
      line(c, L ? x + 2 : x + w - 2, y + 26, L ? x + w - 2 : x + 2, y + 78, OUT, 3.4);
      line(c, L ? x + 2 : x + w - 2, y + 26, L ? x + w - 2 : x + 2, y + 78, '#6c7782', 1.4);
    }
  }
  function chochin(c, x, y, s = 1, col = '#b8402e') {
    line(c, x, y - 12 * s, x, y - 8 * s, '#20262d', 1.4);
    frect(c, x - 4 * s, y - 9 * s, 8 * s, 2.5 * s, '#20262d'); frect(c, x - 4 * s, y + 7 * s, 8 * s, 2.5 * s, '#20262d');
    fell(c, x, y, 7 * s, 8.5 * s, col); fell(c, x - 2 * s, y - 2 * s, 3 * s, 4 * s, 'rgba(255,220,160,.55)');
    c.strokeStyle = 'rgba(60,20,10,.5)'; c.lineWidth = 1; c.beginPath(); for (const k of [-4, 0, 4]) { c.moveTo(x - 6.5 * s, y + k * s); c.quadraticCurveTo(x, y + k * s + 2 * s, x + 6.5 * s, y + k * s); } c.stroke();
    c.beginPath(); c.ellipse(x, y, 7 * s, 8.5 * s, 0, 0, TAU); sk(c, OUT, 1.1);
  }
  // origami paper rose (Konan)
  function paperFlower(c, x, y, s, col = '#eef2f8', col2 = '#b9c3e6') {
    fell(c, x + s * .25, y + s * .4, s * .9, s * .35, 'rgba(4,8,14,.28)');
    for (let L = 0; L < 3; L++) {
      const r = s * (1 - L * .3), rot = L * .63 - .3;
      for (let i = 0; i < 5; i++) {
        const a = rot + i / 5 * TAU, a1 = a - .55, a2 = a + .55;
        const p = [x + Math.cos(a1) * r * .45, y + Math.sin(a1) * r * .3 - L * s * .12, x + Math.cos(a) * r, y + Math.sin(a) * r * .62 - L * s * .12, x + Math.cos(a2) * r * .45, y + Math.sin(a2) * r * .3 - L * s * .12, x, y - L * s * .12];
        fpoly(c, p, (L + i) % 2 ? col2 : col);
        poly(c, p); sk(c, 'rgba(40,48,70,.75)', .9);
      }
    }
    fell(c, x, y - s * .34, s * .14, s * .1, '#8f9ad0');
  }
  function umbrellaOpen(c, x, y, r, col) {
    const T = toneA(col);
    line(c, x, y, x + 3, y + r * 1.35, '#20262d', 2);
    c.beginPath(); c.arc(x + 6, y + r * 1.35, 3, 0, Math.PI); sk(c, '#20262d', 2);
    const n = 8, ry = r * .58, pts = [];
    for (let i = 0; i <= n; i++) pts.push([x - r + 2 * r * i / n, y]);
    const p = new Path2D(); p.moveTo(x - r, y); p.ellipse(x, y, r, ry, 0, Math.PI, TAU);
    for (let i = n; i > 0; i--) p.quadraticCurveTo((pts[i][0] + pts[i - 1][0]) / 2, y + r * .2, pts[i - 1][0], y);
    p.closePath();
    c.save(); c.fillStyle = T.base; c.fill(p); c.clip(p);
    for (let i = 0; i < n; i++) if (i % 2) fpoly(c, [x, y - ry, pts[i][0], y + 4, pts[i + 1][0], y + 4], T.dark);
    fpoly(c, [x, y - ry, pts[0][0], y + 4, pts[2][0], y + 4], 'rgba(230,240,250,.22)');
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(p);
    line(c, x, y - ry, x, y - ry - 6, '#20262d', 1.8);
  }
  function rivets(c, x0, x1, y, step = 13) { c.fillStyle = 'rgba(200,214,228,.4)'; for (let x = x0; x <= x1; x += step) c.fillRect(x, y, 1.6, 1.6); }

  // ------------------------------------------------------------------ house variants (footprint local, may overhang 260 px above)
  function vPipeTower(c, P) {
    const R = rng(P.seed);
    box(c, 168, 118, 140, 48, 134, P.T2, { floors: 44, seed: P.seed + 1, paint: (cc, g) => { winGrid(cc, g.x + 4, g.fy + 4, g.w - 8, 82, 3, 2, 18, 20, R, .42, P); door(cc, 254, 252, 34, 48); } });
    vent(c, 184, 126, 26, 18); tankLegs(c, 274, 152, 20, 24, P.rust);
    box(c, 22, -230, 156, 52, 478, P.T, { floors: 40, seed: P.seed, paint: (cc, g) => { winGrid(cc, g.x + 6, g.fy + 8, g.w - 12, 378, 4, 10, 16, 20, R, .32, P); shutter(cc, 36, 248, 58, 52); door(cc, 120, 252, 34, 48); } });
    tankLegs(c, 64, -192, 24, 30, P.rust, { legH: 12 }); vent(c, 108, -222, 28, 18); antenna(c, 156, -210, 100);
    pipe(c, [178, -170, 198, -170, 198, 296], 10, P.pipe);
    pipe(c, [178, 60, 214, 60, 214, 122], 7, P.pipe2);
    pipe(c, [24, -124, 10, -124, 10, 298], 8, P.pipe2);
    pipe(c, [178, -60, 190, -60, 190, -20, 178, -20], 6, P.pipe2);
    bannerRain(c, 140, 112, 26, 74, P.cloth);
    P.lamps.push([137, 245], [271, 245]);
    P.port = { l: [24, 30], r: [306, 196] };
  }
  function vTwinSlab(c, P) {
    const R = rng(P.seed);
    box(c, 196, -60, 146, 56, 304, P.T2, { floors: 38, seed: P.seed + 3, paint: (cc, g) => { winGrid(cc, g.x + 4, g.fy + 6, g.w - 8, 222, 4, 6, 14, 18, R, .36, P); door(cc, 254, 252, 36, 48); } });
    box(c, 214, -82, 58, 18, 30, P.T, { shadow: false, panel: 0, drips: false, paint: (cc, g) => door(cc, 236, g.fy + 8, 14, 20) });
    tankLegs(c, 312, -24, 16, 20, P.rust);
    box(c, 8, -210, 150, 56, 454, P.T, { floors: 40, seed: P.seed + 4, paint: (cc, g) => { winGrid(cc, g.x + 6, g.fy + 8, g.w - 12, 360, 4, 9, 16, 20, R, .3, P); shutter(cc, 22, 246, 70, 54); door(cc, 108, 252, 32, 48); } });
    box(c, 158, 30, 38, 14, 40, P.T2, { shadow: false, panel: 0, drips: false, paint: () => win(c, 164, 54, 26, 14, true) });
    pipe(c, [156, -24, 198, -24], 8, P.pipe); pipe(c, [156, -10, 198, -10], 6, P.pipe2);
    pipe(c, [340, 30, 350, 30, 350, 298], 8, P.pipe);
    tankLegs(c, 48, -170, 22, 28, P.rust); antenna(c, 126, -192, 104); vent(c, 82, -202, 22, 16);
    pipe(c, [10, -100, -4, -100, -4, 298], 7, P.pipe2);
    awningM(c, 236, 228, 74, 14, P.awn);
    signV(c, 166, 104, 22, 58, '宿');
    P.lamps.push([124, 245], [272, 245]);
    P.port = { l: [10, 16], r: [340, 70] };
  }
  function vSilo(c, P) {
    const R = rng(P.seed);
    box(c, 196, 150, 116, 40, 110, P.T2, { floors: 0, seed: P.seed + 5, paint: (cc, g) => { winGrid(cc, g.x + 4, g.fy + 2, g.w - 8, 40, 3, 1, 18, 18, R, .5, P); shutter(cc, 214, 246, 62, 54); } });
    tankLegs(c, 288, 174, 14, 16, P.rust); vent(c, 210, 158, 22, 14);
    const T = P.T, g = cyl(c, 104, -190, 84, 456, T, {
      band: [[0, 10, T.dark], [150, 4, T.dark], [300, 4, T.dark], [442, 14, '#333b44']],
      paint: (cc, gg) => { for (const yo of [30, 80, 180, 230]) cylWins(cc, gg, yo, 5, 13, 18, R, .32, 1.2); cylWins(cc, gg, 334, 5, 13, 18, R, .3, 1.2, .5); }
    });
    cone(c, 104, -190, 84, g.ry, 64, toneA(P.rust), 8);
    antenna(c, 104, -256, 40);
    for (const yo of [146, 296]) {
      const y = -190 + yo + g.ry;
      c.beginPath(); c.ellipse(104, y, 94, g.ry + 8, 0, 0, Math.PI); sk(c, OUT, 6); c.beginPath(); c.ellipse(104, y, 94, g.ry + 8, 0, 0, Math.PI); sk(c, '#5d6874', 3);
      c.strokeStyle = '#2a3139'; c.lineWidth = 1.5; c.beginPath();
      for (let a = .12; a < Math.PI; a += .2) { const px = 104 + Math.cos(a) * 94, py = y + Math.sin(a) * (g.ry + 8); c.moveTo(px, py); c.lineTo(px, py - 12); } c.stroke();
      c.beginPath(); c.ellipse(104, y - 12, 94, g.ry + 8, 0, 0, Math.PI); sk(c, '#7a8691', 1.6);
    }
    door(c, 88, 252, 34, 46);
    ladderV(c, 36, -146, 290);
    pipe(c, [188, 30, 232, 30, 232, 152], 9, P.pipe);
    pipe(c, [186, 206, 198, 206], 8, P.pipe2);
    P.lamps.push([105, 246]);
    P.port = { l: [22, 60], r: [310, 206] };
  }
  function vFactory(c, P) {
    const R = rng(P.seed);
    box(c, 0, 80, 360, 70, 140, P.T, { floors: 0, panel: 60, seed: P.seed + 7, paint: cc => {
      for (let i = 0; i < 7; i++) win(cc, 14 + i * 50, 164, 22, 14, R() < .45);
      shutter(cc, 128, 212, 94, 78);
      door(cc, 252, 242, 32, 48); door(cc, 42, 242, 32, 48);
      signV(cc, 302, 196, 22, 52, '鉄工');
    } });
    for (let r = 0; r < 3; r++) {
      const ty = 86 + r * 20;
      frect(c, 4, ty, 352, 12, P.T.light);
      c.strokeStyle = 'rgba(10,16,24,.3)'; c.lineWidth = 1; c.beginPath(); for (let x = 10; x < 356; x += 7) { c.moveTo(x + .5, ty); c.lineTo(x + .5, ty + 12); } c.stroke();
      frect(c, 4, ty + 12, 352, 7, '#22303c');
      for (let x = 10; x < 350; x += 18) if (R() < .3) frect(c, x, ty + 13, 12, 5, LIT);
      srect(c, 4, ty, 352, 19, OUT, 1.2);
    }
    chimney(c, 62, 112, 16, 360, P.rust);
    chimney(c, 108, 118, 12, 280, P.rust2);
    tankLegs(c, 302, 138, 22, 28, P.rust);
    pipe(c, [6, 172, 354, 172], 8, P.pipe);
    pipe(c, [340, 172, 340, 288], 8, P.pipe);
    pipe(c, [78, 30, 160, 30, 160, 112], 7, P.pipe2);
    P.lamps.push([58, 236], [268, 236]);
    P.port = { l: [4, 190], r: [356, 190] };
  }
  function vStepped(c, P) {
    const R = rng(P.seed);
    box(c, 0, 150, 330, 50, 110, P.T2, { floors: 0, seed: P.seed + 9, paint: (cc, g) => { winGrid(cc, 6, 206, 318, 32, 7, 1, 18, 16, R, .45, P); shutter(cc, 26, 250, 74, 50); door(cc, 148, 252, 34, 48); shutter(cc, 230, 250, 74, 50); } });
    railing(c, 2, 198, 326, 11);
    vent(c, 8, 158, 24, 16); vent(c, 298, 160, 24, 14);
    box(c, 40, -45, 250, 46, 174, P.T, { floors: 36, seed: P.seed + 10, paint: (cc, g) => winGrid(cc, g.x + 6, g.fy + 6, g.w - 12, 160, 6, 4, 16, 20, R, .32, P) });
    box(c, 92, -265, 146, 40, 215, P.T, { floors: 36, seed: P.seed + 11, paint: (cc, g) => winGrid(cc, g.x + 6, g.fy + 6, g.w - 12, 200, 4, 6, 16, 20, R, .3, P) });
    antenna(c, 212, -250, 58); tankLegs(c, 126, -238, 18, 22, P.rust);
    ladderV(c, 298, 4, 192);
    pipe(c, [238, -120, 262, -120, 262, -20], 8, P.pipe);
    pipe(c, [40, 60, 24, 60, 24, 160], 7, P.pipe2);
    bannerRain(c, 64, 12, 24, 66, P.cloth);
    P.lamps.push([165, 245]);
    P.port = { l: [44, 60], r: [288, 60] };
  }
  function vApart(c, P) {
    const R = rng(P.seed);
    box(c, 10, -30, 320, 64, 266, P.T, { floors: 34, seed: P.seed + 13, paint: cc => {
      winGrid(cc, 14, 38, 276, 198, 7, 6, 16, 18, R, .3, P);
      for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) if (R() < .22) { const bx = 14 + 7 + k * 38, by = 38 + 10 + r * 32 + 24; frect(cc, bx - 4, by, 26, 3, '#2a3139'); railing(cc, bx - 4, by, 26, 7); }
      door(cc, 122, 252, 40, 48); shutter(cc, 28, 250, 74, 50); shutter(cc, 184, 252, 60, 48);
    } });
    fireEscape(c, 294, 30, 300);
    tankLegs(c, 58, 12, 22, 26, P.rust); tankLegs(c, 108, 16, 18, 22, P.rust2);
    box(c, 218, -16, 60, 16, 30, P.T2, { shadow: false, panel: 0, drips: false, paint: (cc, g) => door(cc, 240, g.fy + 8, 14, 20) });
    antenna(c, 304, 22, 96);
    awningM(c, 112, 234, 60, 12, P.awn);
    umbrellaOpen(c, 170, 274, 12, '#a8423a');
    P.lamps.push([142, 245]);
    P.port = { l: [14, 80], r: [326, 90] };
  }
  function vTankHouse(c, P) {
    const R = rng(P.seed);
    box(c, 16, 70, 288, 60, 170, P.T, { floors: 40, seed: P.seed + 15, paint: () => { winGrid(c, 22, 134, 276, 102, 6, 2, 18, 20, R, .36, P); shutter(c, 40, 246, 80, 54); door(c, 200, 252, 36, 48); } });
    const ST = toneA(P.rust);
    for (const [lx, tx] of [[92, 104], [212, 200]]) { line(c, lx, 118, tx, 14, OUT, 6); line(c, lx, 118, tx, 14, '#5d6874', 3); }
    line(c, 98, 70, 206, 70, '#2a3139', 2); line(c, 98, 70, 206, 30, '#2a3139', 1.5); line(c, 206, 70, 98, 30, '#2a3139', 1.5);
    const sp = new Path2D(); sp.arc(152, -40, 86, 0, TAU);
    celFill(c, sp, ST.base, ST.light, ST.dark, { ld: 14, dd: 22, deep: ST.deep, deepD: 6 });
    c.save(); c.clip(sp);
    c.beginPath(); c.ellipse(152, -40, 86, 22, 0, 0, Math.PI); sk(c, ST.deep, 5);
    c.beginPath(); c.ellipse(152, -42, 86, 22, 0, 0, Math.PI); sk(c, ST.light, 1.2);
    c.strokeStyle = 'rgba(10,14,20,.3)'; c.lineWidth = 1; c.beginPath(); c.ellipse(152, -40, 50, 86, 0, 0, TAU); c.moveTo(152, -126); c.lineTo(152, 46); c.stroke();
    for (let i = 0; i < 7; i++) frect(c, 110 + R() * 90, -30 + R() * 30, 3, 20 + R() * 40, 'rgba(110,55,25,.3)');
    fell(c, 122, -84, 22, 13, 'rgba(235,240,248,.28)');
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(sp);
    c.beginPath(); c.arc(152, -40, 92, -2.4, -1.2); sk(c, OUT, 4); c.beginPath(); c.arc(152, -40, 92, -2.4, -1.2); sk(c, '#7a8691', 1.6);
    txt(c, '雨水', 152, -12, 22, 'rgba(230,235,240,.7)', { weight: '900' });
    for (const [lx, tx] of [[132, 140], [172, 164]]) { line(c, lx, 124, tx, 40, OUT, 6); line(c, lx, 124, tx, 40, '#6c7782', 3); }
    pipe(c, [152, 44, 152, 98, 294, 98, 294, 298], 9, P.pipe);
    pipe(c, [30, 140, 6, 140, 6, 298], 7, P.pipe2);
    vent(c, 40, 82, 24, 16);
    P.lamps.push([218, 245]);
    P.port = { l: [18, 160], r: [302, 160] };
  }
  function vSpire(c, P) {
    const R = rng(P.seed);
    for (const x of [0, 200]) box(c, x, 160, 100, 40, 100, P.T2, { floors: 0, seed: P.seed + x, paint: () => { winGrid(c, x + 4, 204, 92, 34, 3, 1, 16, 18, R, .45, P); x ? shutter(c, x + 22, 250, 56, 50) : door(c, x + 34, 252, 32, 48); } });
    box(c, 92, -170, 116, 42, 428, P.T, { floors: 40, seed: P.seed + 17, paint: () => { winGrid(c, 98, -122, 104, 352, 3, 9, 16, 20, R, .32, P); door(c, 132, 252, 36, 48); } });
    const ax = 150, ay = -308, Rt = toneA(P.rust);
    fpoly(c, [89, -170, 89, -128, ax, ay], Rt.light);
    fpoly(c, [211, -170, 211, -128, ax, ay], Rt.dark);
    fpoly(c, [89, -128, 211, -128, ax, ay], Rt.base);
    c.strokeStyle = 'rgba(8,12,18,.3)'; c.lineWidth = 1.2; c.beginPath(); for (let i = 1; i < 6; i++) { c.moveTo(89 + 122 * i / 6, -128); c.lineTo(ax, ay); } c.stroke();
    poly(c, [89, -128, 89, -170, ax, ay, 211, -170, 211, -128]); sk(c, OUT, 2);
    line(c, 89, -128, 211, -128, OUT, 2);
    fell(c, ax, ay - 2, 3, 3, '#d8463a'); fell(c, ax, ay - 2, 8, 8, 'rgba(230,80,60,.2)');
    bannerRain(c, 128, -116, 44, 170, P.cloth);
    pipe(c, [206, -90, 224, -90, 224, 162], 8, P.pipe); pipe(c, [94, -20, 80, -20, 80, 162], 7, P.pipe2);
    tankLegs(c, 250, 176, 16, 18, P.rust);
    P.lamps.push([150, 245]);
    P.port = { l: [96, 20], r: [204, 20] };
  }

  // ------------------------------------------------------------------ Pain's tower (footprint 440x410, overhang 620)
  function lmPain(c, P) {
    const TS = toneA('#58606b'), TP = toneA('#4c5560'), TH = toneA('#626a75'), R = rng(777);
    // forecourt steps
    for (let i = 0; i < 3; i++) { const w = 132 + i * 28, y = 386 + i * 8; frect(c, 220 - w / 2, y, w, 8, i % 2 ? '#525c66' : '#5f6973'); frect(c, 220 - w / 2, y, w, 2, 'rgba(200,215,230,.25)'); srect(c, 220 - w / 2, y, w, 8, OUT, 1.1); }
    // podium
    box(c, 0, 210, 440, 60, 140, TP, { floors: 0, panel: 55, seed: 91, paint: cc => {
      winGrid(cc, 4, 278, 150, 30, 4, 1, 18, 16, R, .6, P, 4); winGrid(cc, 286, 278, 150, 30, 4, 1, 18, 16, R, .6, P, 4);
      frect(cc, 162, 312, 116, 98, '#262d35'); srect(cc, 162, 312, 116, 98, OUT, 1.6);
      frect(cc, 172, 322, 96, 88, '#120f12');
      frect(cc, 178, 330, 42, 80, '#3a2a22'); frect(cc, 184, 336, 30, 74, '#d8902e'); frect(cc, 186, 338, 12, 72, '#f6c868');
      frect(cc, 220, 322, 48, 88, '#3e4852'); for (let y = 326; y < 408; y += 5) frect(cc, 220, y, 48, 1.4, '#2a3139'); srect(cc, 220, 322, 48, 88, OUT, 1.4);
      frect(cc, 156, 304, 128, 10, '#3b2f45'); frect(cc, 156, 304, 128, 3, '#5a4a6a');
      rainMark(cc, 220, 309, 7, '#d8dfe8', 1.6);
      bannerRain(cc, 112, 300, 30, 86, '#2e2a40'); bannerRain(cc, 298, 300, 30, 86, '#2e2a40');
    } });
    // side towers on the podium roof
    for (const sx of [16, 334]) box(c, sx, 10, 90, 34, 206, TS, { floors: 36, seed: 92 + sx, paint: (cc, g) => winGrid(cc, g.x + 4, g.fy + 6, g.w - 8, 180, 2, 5, 16, 18, R, .4, P, 5) });
    tankLegs(c, 48, 32, 18, 22, '#7d5a46'); antenna(c, 386, 28, 100); vent(c, 350, 16, 24, 14);
    // shaft
    box(c, 135, -250, 170, 48, 452, TS, { floors: 0, panel: 0, seed: 95, paint: (cc, g) => {
      for (let yy = g.fy + 70; yy < g.by - 20; yy += 84) { frect(cc, g.x, yy, g.w, 7, TS.deep); frect(cc, g.x, yy + 7, g.w, 1.5, 'rgba(200,215,230,.2)'); }
      for (const x of [158, 202, 238, 282]) { frect(cc, x - 6, g.fy, 12, g.h, TS.dark); frect(cc, x - 6, g.fy, 3, g.h, 'rgba(210,225,240,.22)'); }
      for (let yy = g.fy + 90; yy < g.by - 30; yy += 42) for (const x of [176, 262]) win(cc, x, yy, 9, 24, R() < .35);
      bannerRain(cc, 205, -120, 30, 200, '#2a3240');
    } });
    pipe(c, [134, -170, 116, -170, 116, 40, 104, 52], 12, '#66717c');
    pipe(c, [306, -150, 326, -150, 326, 60], 10, '#7d5a46');
    pipe(c, [306, 0, 334, 0], 8, '#66717c');
    pipe(c, [134, 60, 108, 60], 8, '#7d5a46');
    // the head: gargoyle face with horns, glowing eyes, toothed maw and protruding tongue
    const H = new Path2D();
    H.moveTo(110, -190); H.quadraticCurveTo(92, -240, 90, -320); H.lineTo(84, -410); H.lineTo(22, -606); H.lineTo(118, -482);
    H.quadraticCurveTo(140, -540, 176, -556); H.lineTo(194, -602); H.lineTo(212, -562); H.lineTo(228, -562); H.lineTo(246, -602); H.lineTo(264, -556);
    H.quadraticCurveTo(300, -540, 322, -482); H.lineTo(418, -606); H.lineTo(356, -410); H.lineTo(350, -320); H.quadraticCurveTo(348, -240, 330, -190);
    H.quadraticCurveTo(220, -172, 110, -190); H.closePath();
    pipe(c, [92, -300, 66, -300, 66, -150, 134, -150], 11, '#5d6874');
    pipe(c, [348, -300, 374, -300, 374, -110, 306, -110], 11, '#7d5a46');
    c.fillStyle = 'rgba(4,8,14,.3)'; c.save(); c.translate(14, 12); c.fill(H); c.restore();
    celFill(c, H, TH.base, TH.light, TH.dark, { ld: 14, dd: 22, deep: TH.deep, deepD: 8 });
    c.save(); c.clip(H);
    c.strokeStyle = 'rgba(8,12,18,.35)'; c.lineWidth = 1.4; c.beginPath();
    for (const y of [-500, -440, -370, -280, -220]) { c.moveTo(0, y); c.lineTo(440, y); }
    for (const x of [130, 175, 265, 310]) { c.moveTo(x, -560); c.lineTo(x, -180); }
    c.stroke();
    for (const y of [-497, -437, -367, -277]) rivets(c, 96, 344, y, 12);
    c.restore();
    // horn highlights
    line(c, 30, -596, 92, -432, 'rgba(225,235,245,.5)', 2.2); line(c, 410, -596, 352, -432, 'rgba(10,14,20,.4)', 2.2);
    // brow
    const brow = [108, -462, 208, -420, 232, -420, 332, -462, 336, -442, 232, -398, 208, -398, 104, -442];
    fpoly(c, brow, TH.deep); poly(c, brow); sk(c, OUT, 1.6);
    line(c, 112, -458, 208, -418, 'rgba(210,222,236,.35)', 1.5);
    // eyes
    for (const s of [-1, 1]) {
      const e = [220 + s * 96, -440, 220 + s * 20, -410, 220 + s * 24, -388, 220 + s * 88, -410];
      fell(c, 220 + s * 58, -412, 44, 22, 'rgba(255,190,80,.16)');
      fpoly(c, e, '#e09a38'); poly(c, e); c.save(); c.clip(); fell(c, 220 + s * 60, -412, 26, 9, LIT); fell(c, 220 + s * 66, -414, 9, 4, LIT2); c.restore();
      poly(c, e); sk(c, OUT, 1.8);
    }
    // nose ridges
    line(c, 212, -392, 208, -352, TH.deep, 3); line(c, 228, -392, 232, -352, TH.deep, 3); fell(c, 212, -350, 4, 2.5, '#151a20'); fell(c, 228, -350, 4, 2.5, '#151a20');
    // maw
    const maw = new Path2D(); maw.moveTo(116, -332); maw.lineTo(324, -332); maw.quadraticCurveTo(318, -280, 306, -242); maw.lineTo(134, -242); maw.quadraticCurveTo(122, -280, 116, -332); maw.closePath();
    c.fillStyle = '#100d10'; c.fill(maw);
    c.save(); c.clip(maw); fell(c, 220, -270, 80, 24, 'rgba(140,40,40,.45)'); fell(c, 220, -272, 40, 12, 'rgba(220,90,50,.35)');
    for (let i = 0; i < 10; i++) { const x = 122 + i * 20; fpoly(c, [x, -334, x + 20, -334, x + 10, -312], '#c3c9cf'); poly(c, [x, -334, x + 20, -334, x + 10, -312]); sk(c, OUT, 1); }
    for (let i = 0; i < 8; i++) { const x = 140 + i * 20; fpoly(c, [x, -240, x + 20, -240, x + 10, -260], '#aab1b8'); poly(c, [x, -240, x + 20, -240, x + 10, -260]); sk(c, OUT, 1); }
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(maw);
    // tongue: sticks out of the maw and hangs over the shaft like a balcony
    const tg = new Path2D(); tg.moveTo(186, -292); tg.bezierCurveTo(176, -220, 190, -150, 220, -140); tg.bezierCurveTo(250, -150, 264, -220, 254, -292); tg.closePath();
    c.fillStyle = 'rgba(4,8,14,.35)'; c.save(); c.translate(8, 10); c.fill(tg); c.restore();
    celFill(c, tg, '#7c4c56', '#a06c74', '#56343c', { ld: 6, dd: 9 });
    c.beginPath(); c.moveTo(220, -280); c.quadraticCurveTo(216, -200, 220, -150); sk(c, 'rgba(40,16,22,.6)', 2);
    fell(c, 204, -246, 6, 16, 'rgba(255,220,225,.22)');
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(tg);
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(H);
    // paper flowers by the door (Konan)
    for (const [fx, fy] of [[132, 400], [308, 400]]) {
      frect(c, fx - 26, fy - 14, 52, 16, '#5a636d'); frect(c, fx - 26, fy - 14, 52, 4, '#7a838c'); frect(c, fx + 16, fy - 14, 10, 16, 'rgba(0,0,0,.22)'); srect(c, fx - 26, fy - 14, 52, 16, OUT, 1.3);
      paperFlower(c, fx - 13, fy - 16, 11); paperFlower(c, fx + 12, fy - 18, 12, '#dfe6f4', '#a9b4e0'); paperFlower(c, fx, fy - 28, 10, '#f4f6fa', '#c5cdef');
    }
    P.lamps.push([196, 300], [244, 300], [162, -412], [278, -412], [220, -270]);
  }

  // ------------------------------------------------------------------ palettes & house table
  const PAL = [
    { T: '#76818d', T2: '#66717d', rust: '#7d5642', rust2: '#6f5a4e', pipe: '#7d8994', pipe2: '#7d5a46', cloth: '#2c3644', awn: '#4f5d6b' },
    { T: '#6a7480', T2: '#7d858f', rust: '#86603f', rust2: '#7a5a48', pipe: '#76828d', pipe2: '#8a5f45', cloth: '#3b3350', awn: '#5c4b44' },
    { T: '#818a94', T2: '#6b7581', rust: '#6f5a4e', rust2: '#86603f', pipe: '#86919b', pipe2: '#6d5a50', cloth: '#2e3a48', awn: '#47566a' },
    { T: '#65707d', T2: '#787f88', rust: '#8f5c3a', rust2: '#7d5642', pipe: '#73808c', pipe2: '#7d4f37', cloth: '#41364f', awn: '#5a6470' }
  ];
  const VAR = {
    A: [vPipeTower, 0, 320, 300], A2: [vPipeTower, 2, 320, 300],
    B: [vTwinSlab, 1, 350, 300], B2: [vTwinSlab, 3, 350, 300],
    C: [vSilo, 2, 320, 300], C2: [vSilo, 1, 320, 300],
    D: [vFactory, 3, 360, 290], D2: [vFactory, 0, 360, 290],
    E: [vStepped, 0, 330, 310], E2: [vStepped, 2, 330, 310],
    F: [vApart, 1, 340, 300], F2: [vApart, 3, 340, 300],
    G: [vTankHouse, 2, 320, 300], G2: [vTankHouse, 0, 320, 300],
    H: [vSpire, 3, 300, 300]
  };
  // [variant, footprint x, footprint y] (local px; one per 520 cell, lanes and streets kept clear)
  const HOUSES = [
    ['F', 590, 650], ['A', 1160, 650], ['E', 2150, 650], ['B', 2700, 650],
    ['G', 600, 1190], ['H', 2180, 1190], ['D', 2700, 1200],
    ['C', 600, 1640], ['A2', 2720, 1640],
    ['D2', 1140, 2210], ['G2', 2170, 2200], ['F2', 2700, 2200],
    ['B2', 590, 2760], ['E2', 1150, 2750], ['C2', 2160, 2760]
  ];
  const LINKS = [[0, 1], [1, 2, 'banner'], [2, 3], [5, 6], [10, 11], [12, 13]];

  // ------------------------------------------------------------------ perimeter: lake, shore, steel walls
  // Organic lake ring outside the square: the shore's outer silhouette sits 88..130 px beyond the edge and the
  // waterline 38..64 px beyond it, both wobbling with a 520 px period (so reused wall tiles stay seamless) and
  // rounding the corners. Nothing reaches the 160 px clip line, so the wilderness shows around it.
  const A = {};
  const dOut = (si, u) => 88 + 22 * wv(u, 11 + si * 5) + 20 * wv(u, 13 + si * 5);
  const dWat = (si, u) => 38 + 26 * wv(u, 31 + si * 5);
  const SIDES = [   // si: 0 n, 1 e, 2 s, 3 w — point at distance d outside the edge, inward normal
    { pt: (u, d) => [u, -d], n: [0, 1] }, { pt: (u, d) => [SIZE + d, u], n: [-1, 0] },
    { pt: (u, d) => [u, SIZE + d], n: [0, -1] }, { pt: (u, d) => [-d, u], n: [1, 0] }
  ];
  const CORNERS = [  // centre, start angle, side before (at u0) -> side after (at u1)
    { cx: SIZE, cy: 0, a0: -Math.PI / 2, s0: 0, u0: SIZE, s1: 1, u1: 0 },
    { cx: SIZE, cy: SIZE, a0: 0, s0: 1, u0: SIZE, s1: 2, u1: SIZE },
    { cx: 0, cy: SIZE, a0: Math.PI / 2, s0: 2, u0: 0, s1: 3, u1: SIZE },
    { cx: 0, cy: 0, a0: Math.PI, s0: 3, u0: 0, s1: 0, u1: 0 }
  ];
  const cornerPt = (k, t, df, wob) => {
    const C = CORNERS[k], a = C.a0 + t * Math.PI / 2, d = df(C.s0, C.u0) * (1 - t) + df(C.s1, C.u1) * t + wob * Math.sin(Math.PI * t) * Math.sin(t * 9 + k * 2.3);
    return [C.cx + Math.cos(a) * d, C.cy + Math.sin(a) * d, -Math.cos(a), -Math.sin(a)];
  };
  function ringPath(df, wob) {
    const p = new Path2D(); let first = true;
    const add = (x, y) => { if (first) { p.moveTo(x, y); first = false; } else p.lineTo(x, y); };
    const side = (si, rev) => { for (let i = 0; i <= SIZE; i += 8) { const u = rev ? SIZE - i : i, q = SIDES[si].pt(u, df(si, u)); add(q[0], q[1]); } };
    const corner = k => { for (let i = 1; i < 12; i++) { const q = cornerPt(k, i / 12, df, wob); add(q[0], q[1]); } };
    side(0, false); corner(0); side(1, false); corner(1); side(2, true); corner(2); side(3, true); corner(3);
    p.closePath(); return p;
  }
  function buildLakePaths() {
    A.outerPath = ringPath(dOut, 5); A.waterPath = ringPath(dWat, 4);
    A.waterFill = new Path2D(A.waterPath); A.waterFill.rect(152, 152, SIZE - 304, SIZE - 304);
    A.shoreFill = new Path2D(A.outerPath); A.shoreFill.addPath(A.waterPath);
  }
  function reeds(c, x, y, s, seed) {
    const R = rng(seed);
    fell(c, x + 2, y + 1, 7 * s, 2.4 * s, 'rgba(10,14,12,.35)');
    for (let i = 0; i < 6; i++) {
      const dx = (R() - .5) * 10 * s, h = (10 + R() * 12) * s, lean = (R() - .4) * 6 * s;
      c.beginPath(); c.moveTo(x + dx, y); c.quadraticCurveTo(x + dx + lean * .3, y - h * .6, x + dx + lean, y - h); sk(c, R() < .5 ? '#56643f' : '#6c7a4a', 1.4);
      if (R() < .4) { fell(c, x + dx + lean, y - h - 2, 1.4, 3.2, '#5a4232'); }
    }
  }
  // shore dressing: rocks, reeds, puddles and tufts along the outer silhouette and the waterline
  function shoreDecor(c, a, b, s, e) {
    const inR = (x, y) => x > a - 30 && x < b + 30 && y > s - 30 && y < e + 30;
    const put = (x, y, nx, ny, h1, h2, h3, dOuter, dWater) => {
      const span = dOuter - dWater;
      const tx = x - nx * 3, ty = y - ny * 3;   // tufts poke just past the silhouette
      for (let k = 0; k < 3; k++) line(c, tx + k * 2.5 - 2.5, ty, tx + k * 3.4 - 4, ty - 5 - h2 * 5, 'rgba(96,104,70,.75)', 1.2);
      if (h1 < .32) {
        const r = 4 + h2 * 7, px = x + nx * (5 + h3 * span * .5), py = y + ny * (5 + h3 * span * .5);
        fell(c, px + 1.5, py + 2, r, r * .62, 'rgba(0,0,0,.4)'); fell(c, px, py, r, r * .62, h3 < .5 ? '#5a5f5c' : '#4a4e4b'); fell(c, px - r * .3, py - r * .25, r * .42, r * .25, 'rgba(200,212,220,.3)');
        c.beginPath(); c.ellipse(px, py, r, r * .62, 0, 0, TAU); sk(c, 'rgba(14,16,18,.7)', 1);
      } else if (h1 < .5) {
        const px = x + nx * span * .5, py = y + ny * span * .5;
        fell(c, px, py, 9 + h2 * 8, 3.5 + h2 * 2, '#2c3a48'); fell(c, px - 2, py - 1, 4 + h2 * 3, 1.2, 'rgba(190,210,230,.4)');
      }
      if (h2 > .45) reeds(c, x + nx * (span - 4), y + ny * (span - 4), .8 + h3 * .5, Math.floor(h1 * 1e6));
    };
    for (let si = 0; si < 4; si++) {
      const S = SIDES[si];
      for (let u = 0; u <= SIZE; u += 26) {
        const d = dOut(si, u), q = S.pt(u, d);
        if (!inR(q[0], q[1])) continue;
        const m = mod(u, BLOCK) / 26 | 0;
        put(q[0], q[1], S.n[0], S.n[1], hash2(m, si, 91), hash2(m, si, 92), hash2(m, si, 93), d, dWat(si, u));
      }
    }
    for (let k = 0; k < 4; k++) for (let i = 1; i < 6; i++) {
      const q = cornerPt(k, i / 6, dOut, 5), w = cornerPt(k, i / 6, dWat, 4);
      if (!inR(q[0], q[1])) continue;
      put(q[0], q[1], q[2], q[3], hash2(i, k, 94), hash2(i, k, 95), hash2(i, k, 96), Math.hypot(q[0] - CORNERS[k].cx, q[1] - CORNERS[k].cy), Math.hypot(w[0] - CORNERS[k].cx, w[1] - CORNERS[k].cy));
    }
  }
  function drawLake(c, a, b, s, e) {
    c.save(); c.beginPath(); c.rect(a, s, b - a, e - s); c.clip();
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(70,56,44,.32)'; c.lineWidth = 10; c.stroke(A.outerPath);   // soft damp fringe onto the wilderness
    c.fillStyle = A.lakePat; c.fill(A.waterFill, 'evenodd');
    c.fillStyle = A.shorePat; c.fill(A.shoreFill, 'evenodd');
    c.strokeStyle = 'rgba(20,18,14,.55)'; c.lineWidth = 3; c.stroke(A.outerPath);
    c.strokeStyle = 'rgba(8,14,20,.55)'; c.lineWidth = 5; c.stroke(A.waterPath);
    c.strokeStyle = 'rgba(180,200,220,.38)'; c.lineWidth = 1.6; c.stroke(A.waterPath);
    shoreDecor(c, a, b, s, e);
    c.restore();
  }
  // crenellated parapet along a horizontal outer edge; yb = ground line of the merlons' front faces
  function parapetH(c, a, b, yb) {
    frect(c, a, yb - 8, b - a, 8, '#323a43'); frect(c, a, yb - 12, b - a, 4, '#5d6873');
    for (let x = Math.floor(a / 52) * 52; x < b; x += 52) {
      const x0 = Math.max(a, x + 6), x1 = Math.min(b, x + 40); if (x1 <= x0) continue;
      frect(c, x0, yb - 26, x1 - x0, 13, '#7e8994'); frect(c, x0, yb - 26, x1 - x0, 2, '#a9b4bf');
      frect(c, x0, yb - 13, x1 - x0, 13, '#3f4852'); frect(c, x1 - 5, yb - 13, 5, 13, 'rgba(0,0,0,.25)');
      srect(c, x0, yb - 26, x1 - x0, 26, OUT, 1.2);
    }
    line(c, a, yb, b, yb, OUT, 1.6);
  }
  function parapetV(c, s, e, x0, x1) {
    frect(c, x0, s, x1 - x0, e - s, '#4d5762');
    for (let y = Math.floor(s / 52) * 52; y < e; y += 52) {
      const y0 = Math.max(s, y + 4), y1 = Math.min(e, y + 36); if (y1 <= y0) continue;
      frect(c, x0, y0 - 12, x1 - x0, y1 - y0, '#7e8994'); frect(c, x0, y0 - 12, 2, y1 - y0, '#a9b4bf');
      frect(c, x0, y1 - 12, x1 - x0, 12, '#3f4852');
      srect(c, x0, y0 - 12, x1 - x0, y1 - y0 + 12, OUT, 1.2);
    }
  }
  function wallLamp(c, x, y) {
    fell(c, x + 4, y, 7, 3, SHADOW);
    line(c, x, y, x, y - 44, OUT, 4.4); line(c, x, y, x, y - 44, '#5d6874', 2.2);
    frect(c, x - 6, y - 50, 12, 6, '#262c33'); fell(c, x, y - 42, 4.5, 3, LIT); fell(c, x, y - 41, 12, 8, 'rgba(255,210,120,.16)');
  }
  function junction(c, x, y) {
    frect(c, x + 3, y + 2, 26, 6, SHADOW);
    frect(c, x, y - 22, 26, 8, '#7a8591'); frect(c, x, y - 14, 26, 16, '#46505a'); srect(c, x, y - 22, 26, 24, OUT, 1.2);
    fell(c, x + 8, y - 6, 2, 2, '#d8463a'); frect(c, x + 14, y - 10, 8, 2, '#2a3139');
  }
  function wallTopH(c, a, b, y0, y1, side) {
    c.fillStyle = A.platePat; c.fillRect(a, y0, b - a, y1 - y0);
    c.fillStyle = 'rgba(8,12,18,.35)'; for (let x = Math.ceil(a / 104) * 104; x < b; x += 104) c.fillRect(x, y0, 2, y1 - y0);
    // walkway pipes on low brackets
    const py1 = side === 'n' ? y0 + 50 : y0 + 46, py2 = py1 + 28;
    c.fillStyle = '#20262d'; for (let x = Math.ceil(a / 104) * 104 + 52; x < b; x += 104) c.fillRect(x - 3, py1 - 4, 6, py2 - py1 + 10);
    pipe(c, [a, py1, b, py1], 13, '#6f5546');
    pipe(c, [a, py2, b, py2], 8, '#6c7883');
    for (let k = Math.floor(a / BLOCK); k * BLOCK < b; k++) {
      const bx = k * BLOCK;
      if (bx + 470 > a && bx + 500 < b) junction(c, bx + 470, py2 + 26);
      for (const u of [70, 330]) if (bx + u - 8 > a && bx + u + 16 < b) wallLamp(c, bx + u, side === 'n' ? y1 - 12 : y0 + 34);
      if (bx + 210 > a && bx + 290 < b) { fell(c, bx + 250, py2 + 22, 30, 6, 'rgba(110,135,160,.35)'); fell(c, bx + 244, py2 + 21, 12, 1.4, 'rgba(200,215,235,.4)'); }
    }
    if (side === 'n') {
      parapetH(c, a, b, y0 + 26);
      frect(c, a, y1 - 7, b - a, 7, '#7a8591'); frect(c, a, y1 - 7, b - a, 2, '#a9b4bf');
    } else {
      frect(c, a, y0, b - a, 6, '#7a8591'); frect(c, a, y0, b - a, 2, '#a9b4bf');
      c.strokeStyle = '#20262d'; c.lineWidth = 2; c.beginPath();
      for (let x = Math.ceil(a / 26) * 26; x < b; x += 26) { c.moveTo(x, y0 + 4); c.lineTo(x, y0 - 11); } c.stroke();
      line(c, a, y0 - 11, b, y0 - 11, OUT, 3.4); line(c, a, y0 - 11.5, b, y0 - 11.5, '#8794a0', 1.4);
      parapetH(c, a, b, y1);
    }
  }
  function wallFaceH(c, a, b, y0, y1, side) {
    c.fillStyle = A.facePat; c.fillRect(a, y0, b - a, y1 - y0);
    frect(c, a, y0, b - a, 9, 'rgba(4,8,14,.42)');
    for (let k = Math.floor(a / 26); k * 26 < b; k++) {
      const h = hash2(mod(k, 20), side === 'n' ? 1 : 2, 3); if (h > .55) continue;
      const sx = k * 26 + hash2(mod(k, 20), 5, 3) * 18; if (sx < a || sx > b - 6) continue;
      c.fillStyle = h < .12 ? 'rgba(130,70,36,.22)' : 'rgba(6,10,18,.2)'; c.fillRect(sx, y0 + 8, 3 + h * 8, (y1 - y0) * (.3 + h));
    }
    pipe(c, [a, y0 + 34, b, y0 + 34], 12, '#7a5a46');
    pipe(c, [a, y1 - 46, b, y1 - 46], 9, '#6c7883');
    c.fillStyle = '#20262d'; for (let x = Math.ceil(a / 104) * 104; x < b; x += 104) { c.fillRect(x - 3, y0 + 24, 6, 20); c.fillRect(x - 3, y1 - 54, 6, 16); }
    // per-block features (period 520 so equal cells render identically)
    for (let k = Math.floor(a / BLOCK); k * BLOCK < b; k++) {
      const bx = k * BLOCK, inside = (u, w) => bx + u - w >= a && bx + u + w <= b;
      for (const u of [60, 330, 452]) if (inside(u, 12)) win(c, bx + u - 7, y0 + 62, 14, 20, hash2(u, side === 'n' ? 3 : 4, 9) < .7);
      if (inside(130, 16)) {   // drain spout with a stream of rainwater
        const x = bx + 130, y = y0 + 84;
        const end = y1 + (side === 'n' ? 4 : 8);
        line(c, x, y + 4, x, end, 'rgba(160,190,218,.5)', 7); line(c, x - 1, y + 4, x - 1, end, 'rgba(225,236,248,.75)', 2);
        frect(c, x - 9, y - 7, 18, 12, '#3a434c'); fell(c, x, y, 8, 6, '#20262d'); fell(c, x, y, 5, 4, '#0e1116'); c.beginPath(); c.ellipse(x, y, 8, 6, 0, 0, TAU); sk(c, OUT, 1.4);
        fell(c, x, end + 2, 16, 5, 'rgba(190,210,230,.35)'); c.beginPath(); c.ellipse(x, end + 2, 22, 7, 0, 0, TAU); sk(c, 'rgba(200,218,236,.35)', 1.2);
      }
      if (inside(250, 18)) bannerRain(c, bx + 236, y0 + 10, 28, Math.min(92, y1 - y0 - 40), side === 'n' ? '#2c3644' : '#3b3350');
      if (inside(392, 14)) {   // bracket lamp
        const x = bx + 392, y = y0 + 22;
        line(c, x, y + 10, x, y - 2, OUT, 4); line(c, x, y - 2, x + 12, y - 2, OUT, 3);
        frect(c, x + 6, y - 2, 13, 4, '#262c33'); fell(c, x + 12, y + 5, 5, 4, LIT); fell(c, x + 12, y + 6, 12, 8, 'rgba(255,210,120,.16)');
      }
    }
    frect(c, a, y1 - 16, b - a, 16, 'rgba(6,12,20,.35)'); frect(c, a, y1 - 3, b - a, 3, 'rgba(150,175,200,.16)');
    line(c, a, y0, b, y0, OUT, 2); line(c, a, y1, b, y1, OUT, 2);
  }
  function pumpHouse(c, x, baseY, T, seed) {
    const R = rng(seed);
    box(c, x, baseY - 200, 150, 50, 150, T, { floors: 0, seed, paint: (cc, g) => { winGrid(cc, g.x + 6, g.fy + 8, g.w - 12, 70, 3, 2, 16, 18, R, .5, null); door(cc, x + 58, baseY - 48, 32, 46); } });
    chimney(c, x + 30, baseY - 170, 11, 90, '#6f5a4e');
    tankLegs(c, x + 112, baseY - 168, 18, 22, '#7d5642');
    pipe(c, [x + 150, baseY - 120, x + 168, baseY - 120, x + 168, baseY - 10], 9, '#6c7883');
    bannerRain(c, x + 108, baseY - 140, 24, 60, '#2c3644');
  }
  function wallKit(c, x, baseY) {
    chimney(c, x - 44, baseY, 9, 64, '#5d6874');
    tankLegs(c, x, baseY, 22, 30, '#7d5642', { legH: 16 });
    tankLegs(c, x + 56, baseY + 4, 16, 22, '#6f5a4e');
    vent(c, x + 84, baseY - 20, 26, 18);
    pipe(c, [x + 20, baseY - 30, x + 44, baseY - 30, x + 44, baseY - 14], 6, '#6c7883');
  }
  function drawNorthWall(c, a, b, variant) {
    const ta = Math.max(a, W_OUT), tb = Math.min(b, E_OUT), fa = Math.max(a, W_IN), fb = Math.min(b, E_IN);
    if (fb > fa) { frect(c, fa, N_BASE, fb - fa, 28, 'rgba(4,8,14,.34)'); frect(c, fa, N_BASE + 2, fb - fa, 3, 'rgba(150,180,210,.22)'); }
    if (tb > ta) wallTopH(c, ta, tb, N_TOP, N_FACE, 'n');
    if (fb > fa) wallFaceH(c, fa, fb, N_FACE, N_BASE, 'n');
    if (variant === 2) { const k = Math.floor(a / BLOCK); wallKit(c, k * BLOCK + 250, N_FACE - 18); } else if (variant === 1) for (let k = Math.floor(a / BLOCK); k * BLOCK < b; k++) if (k * BLOCK + 180 >= a && k * BLOCK + 340 <= b) pumpHouse(c, k * BLOCK + 186, N_FACE - 10, toneA('#59626d'), 300 + mod(k, 2));
  }
  function drawSouthWall(c, a, b, variant) {
    const ta = Math.max(a, W_OUT), tb = Math.min(b, E_OUT), ga = Math.max(a, W_BASE), gb = Math.min(b, E_BASE);
    if (gb > ga) { frect(c, ga, S_TOP - 8, gb - ga, 8, 'rgba(6,10,16,.45)'); frect(c, ga, S_TOP - 5, gb - ga, 2, 'rgba(150,180,210,.3)'); }
    if (tb > ta) { wallTopH(c, ta, tb, S_TOP, S_FACE, 's'); wallFaceH(c, ta, tb, S_FACE, S_BASE, 's'); }
    if (variant === 2) { const k = Math.floor(a / BLOCK); wallKit(c, k * BLOCK + 250, S_FACE - 30); } else if (variant === 1) for (let k = Math.floor(a / BLOCK); k * BLOCK < b; k++) if (k * BLOCK + 180 >= a && k * BLOCK + 340 <= b) pumpHouse(c, k * BLOCK + 186, S_FACE - 6, toneA('#5f6772'), 310 + mod(k, 2));
  }
  function wallTopV(c, s, e, x0, x1, west) {
    c.fillStyle = A.platePat; c.fillRect(x0, s, x1 - x0, e - s);
    const outer = west ? x0 : x1, inner = west ? x1 : x0;
    frect(c, outer - 3, s, 6, e - s, '#20262d');
    const p1 = west ? x1 - 44 : x0 + 44, p2 = west ? x1 - 76 : x0 + 76;
    pipe(c, [p1, s, p1, e], 13, '#6f5546'); pipe(c, [p2, s, p2, e], 8, '#6c7883');
    c.fillStyle = 'rgba(8,12,18,.35)'; for (let y = Math.ceil(s / 104) * 104; y < e; y += 104) c.fillRect(x0, y, x1 - x0, 2);
    frect(c, west ? inner - 6 : inner, s, 6, e - s, '#7a8591'); frect(c, west ? inner - 6 : inner, s, 2, e - s, '#a9b4bf');
    for (let k = Math.floor(s / BLOCK); k * BLOCK < e; k++) {
      const by = k * BLOCK;
      for (const u of [120, 400]) if (by + u - 50 > s && by + u + 4 < e) wallLamp(c, west ? x1 - 22 : x0 + 22, by + u);
      if (by + 40 > s && by + 64 < e) junction(c, west ? x1 - 112 : x0 + 86, by + 60);
      if (by + 230 > s && by + 280 < e) { fell(c, (x0 + x1) / 2, by + 250, 34, 8, 'rgba(110,135,160,.35)'); fell(c, (x0 + x1) / 2 - 6, by + 248, 14, 1.6, 'rgba(200,215,235,.4)'); }
    }
    if (west) parapetV(c, s, e, x0, x0 + 18); else parapetV(c, s, e, x1 - 18, x1);
  }
  function bevelV(c, s, e, x0, x1, lit) {
    frect(c, x0, s, x1 - x0, e - s, lit ? '#56616c' : '#2b323a');
    c.fillStyle = lit ? 'rgba(10,16,24,.35)' : 'rgba(0,0,0,.4)';
    for (let y = Math.ceil(s / 52) * 52; y < e; y += 52) c.fillRect(x0, y, x1 - x0, 2);
    for (let y = Math.ceil(s / 26) * 26; y < e; y += 26) { const h = hash2(mod(y / 26, 20), lit ? 7 : 8, 1); if (h < .4) { c.fillStyle = 'rgba(6,10,18,.25)'; c.fillRect(x0 + 4 + h * 20, y, 3, 20 + h * 40); } }
    frect(c, lit ? x0 : x1 - 4, s, 4, e - s, lit ? 'rgba(210,225,240,.25)' : 'rgba(0,0,0,.35)');
    line(c, x0, s, x0, e, OUT, 2); line(c, x1, s, x1, e, OUT, 2);
  }
  function guardTower(c, x, baseY, seed) {
    const R = rng(seed), T = toneA('#5c6570');
    box(c, x, baseY - 190, 200, 54, 136, T, { floors: 0, seed, paint: (cc, g) => { winGrid(cc, g.x + 6, g.fy + 8, g.w - 12, 60, 5, 2, 16, 18, R, .5, null); shutter(cc, x + 30, baseY - 52, 60, 48); door(cc, x + 128, baseY - 48, 30, 44); } });
    tankLegs(c, x + 40, baseY - 160, 20, 24, '#7d5642'); antenna(c, x + 168, baseY - 170, 80); vent(c, x + 90, baseY - 182, 30, 18);
    bannerRain(c, x + 96, baseY - 126, 24, 58, '#3b3350');
  }
  function drawWestWall(c, s, e, variant) {
    const ts = Math.max(s, N_FACE), te = Math.min(e, S_TOP), bs = Math.max(s, N_BASE), be = Math.min(e, S_TOP);
    if (be > bs) { frect(c, W_BASE, bs, 28, be - bs, 'rgba(4,8,14,.32)'); frect(c, W_BASE + 2, bs, 3, be - bs, 'rgba(150,180,210,.2)'); }
    if (te > ts) wallTopV(c, ts, te, W_OUT, W_IN, true);
    if (be > bs) bevelV(c, bs, be, W_IN, W_BASE, false);
    if (variant === 2) { const k = Math.floor(s / BLOCK); wallKit(c, 210, k * BLOCK + 300); } else if (variant === 1) for (let k = Math.floor(s / BLOCK); k * BLOCK < e; k++) if (k * BLOCK + 100 >= s && k * BLOCK + 330 <= e) guardTower(c, 136, k * BLOCK + 320, 400 + mod(k, 2));
  }
  function drawEastWall(c, s, e, variant) {
    const ts = Math.max(s, N_FACE), te = Math.min(e, S_TOP), bs = Math.max(s, N_BASE), be = Math.min(e, S_TOP);
    if (te > ts) wallTopV(c, ts, te, E_IN, E_OUT, false);
    if (be > bs) bevelV(c, bs, be, E_BASE, E_IN, true);
    if (variant === 2) { const k = Math.floor(s / BLOCK); wallKit(c, 3360, k * BLOCK + 300); } else if (variant === 1) for (let k = Math.floor(s / BLOCK); k * BLOCK < e; k++) if (k * BLOCK + 100 >= s && k * BLOCK + 330 <= e) guardTower(c, 3306, k * BLOCK + 320, 410 + mod(k, 2));
  }
  function cornerTower(c, cx, baseY, h, seed) {
    const R = rng(seed), T = toneA('#56606b');
    fell(c, cx + 24, baseY + 14, 124, 50, SHADOW);
    const g = cyl(c, cx, baseY - h, 112, h, T, {
      band: [[0, 12, T.deep], [h * .36, 5, T.dark], [h * .66, 5, T.dark], [h - 26, 26, '#3a434c']],
      paint: (cc, gg) => { for (const yo of [30, 78, 128, 176]) if (yo < h - 50) cylWins(cc, gg, yo, 7, 13, 18, R, .35, 1.25, yo > 150 ? .4 : 0); }
    });
    for (const yo of [h * .36]) {
      const y = g.ty + yo + g.ry;
      c.beginPath(); c.ellipse(cx, y, 122, g.ry + 10, 0, 0, Math.PI); sk(c, OUT, 6); c.beginPath(); c.ellipse(cx, y, 122, g.ry + 10, 0, 0, Math.PI); sk(c, '#5d6874', 3);
      c.strokeStyle = '#2a3139'; c.lineWidth = 1.5; c.beginPath();
      for (let a = .1; a < Math.PI; a += .16) { const px = cx + Math.cos(a) * 122, py = y + Math.sin(a) * (g.ry + 10); c.moveTo(px, py); c.lineTo(px, py - 12); } c.stroke();
      c.beginPath(); c.ellipse(cx, y - 12, 122, g.ry + 10, 0, 0, Math.PI); sk(c, '#7a8691', 1.6);
    }
    cone(c, cx, g.ty, 112, g.ry, 70, toneA('#4a5360'), 10);
    antenna(c, cx, g.ty - 70, 44);
    pipe(c, [cx + 100, g.ty + 40, cx + 128, g.ty + 40, cx + 128, baseY - 6], 11, '#7a5a46');
    pipe(c, [cx - 104, g.ty + 90, cx - 126, g.ty + 90, cx - 126, baseY - 10], 8, '#6c7883');
    bannerRain(c, cx - 15, g.ty + g.ry + 36, 30, 80, '#2c3644');
    return [[cx - 60, g.ty + g.ry + 90], [cx + 60, g.ty + g.ry + 90]];
  }
  function bridge(c, x0, x1, y0, y1) {
    frect(c, x1, y0, 22, y1 - y0, 'rgba(4,8,14,.35)');
    for (let y = y0 + 40; y < y1 - 10; y += 110) { frect(c, x0 - 6, y, 10, 18, '#262c33'); frect(c, x1 - 4, y, 10, 18, '#262c33'); }
    c.fillStyle = A.platePat; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    frect(c, x0 + 20, y0, x1 - x0 - 40, y1 - y0, 'rgba(30,36,44,.25)');
    c.strokeStyle = 'rgba(200,214,228,.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo((x0 + x1) / 2, y0); c.lineTo((x0 + x1) / 2, y1); c.stroke();
    for (const x of [x0 + 6, x1 - 6]) {
      c.strokeStyle = '#20262d'; c.lineWidth = 2.4; c.beginPath(); for (let y = Math.ceil(y0 / 20) * 20; y < y1; y += 20) { c.moveTo(x, y); c.lineTo(x, y - 16); } c.stroke();
      line(c, x, y0 - 16, x, y1 - 16, OUT, 4.4); line(c, x - .7, y0 - 16, x - .7, y1 - 16, '#8794a0', 1.6);
    }
    frect(c, x0, y0, 4, y1 - y0, '#20262d'); frect(c, x1 - 4, y0, 4, y1 - y0, '#20262d');
  }
  function gateTower(c, x, T, seed, flip) {
    const R = rng(seed);
    box(c, x, 0, 140, 64, 336, T, { floors: 42, seed, paint: (cc, g) => {
      winGrid(cc, g.x + 6, g.fy + 10, g.w - 12, 220, 4, 5, 16, 20, R, .45, null);
      door(cc, flip ? x + 18 : x + 88, 352, 34, 46);
    } });
    tankLegs(c, x + (flip ? 100 : 40), 34, 22, 26, '#7d5642', { legH: 12 });
    antenna(c, x + (flip ? 34 : 106), 28, 70);
    pipe(c, [flip ? x : x + 140, 120, flip ? x - 10 : x + 150, 120, flip ? x - 10 : x + 150, 398], 9, '#6c7883');
    bannerRain(c, x + 52, 104, 36, 120, '#2c3644');
  }
  function drawGate(c) {
    drawLake(c, 1560, 2080, -170, 152);
    // landing / abutment: picks up the world's 146 px dirt road just outside the shore and widens onto the bridge
    {
      const ab = [1747, -150, 1893, -150, 1936, -98, 1704, -98];
      fpoly(c, [1749, -146, 1897, -146, 1946, -92, 1712, -92], 'rgba(10,10,8,.35)');
      poly(c, ab); c.fillStyle = A.roadPat; c.fill();
      fpoly(c, ab, 'rgba(70,58,44,.18)');
      fpoly(c, [1747, -150, 1893, -150, 1893, -138, 1747, -138], 'rgba(110,88,64,.45)');      // road dirt tracked onto the slab
      const R = rng(4321); for (let i = 0; i < 60; i++) { const x = 1750 + R() * 140, y = -150 + R() * 22; fell(c, x, y, 1 + R() * 2.2, .8 + R(), R() < .5 ? 'rgba(130,104,78,.7)' : 'rgba(60,48,38,.6)'); }
      fpoly(c, [1704, -98, 1747, -150, 1736, -150, 1690, -98], '#3e454c'); fpoly(c, [1936, -98, 1893, -150, 1904, -150, 1950, -98], '#2c3238');   // wing walls
      line(c, 1690, -98, 1736, -150, OUT, 1.6); line(c, 1950, -98, 1904, -150, OUT, 1.6);
      for (const x of [1712, 1928]) { frect(c, x - 9, -112, 18, 16, '#4c555e'); frect(c, x - 9, -112, 18, 4, '#7a8591'); srect(c, x - 9, -112, 18, 16, OUT, 1.3); }   // bollards
      line(c, 1704, -98, 1936, -98, OUT, 2);
    }
    bridge(c, GATE.x0, GATE.x1, -98, N_TOP + 6);
    for (const x of [GATE.x0 + 6, GATE.x1 - 6]) wallLamp(c, x, -40);
    c.fillStyle = 'rgba(8,12,18,.4)'; for (let y = -98 + 58; y < N_TOP; y += 58) c.fillRect(GATE.x0 + 4, y, GATE.x1 - GATE.x0 - 8, 2);
    c.drawImage(A.grate, 1820 - 24, -60); c.drawImage(A.grate, 1820 - 24, 40);
    drawNorthWall(c, 1560, GATE.x0, 0); drawNorthWall(c, GATE.x1, 2080, 0);
    c.fillStyle = A.roadPat; c.fillRect(GATE.x0, N_TOP, GATE.x1 - GATE.x0, N_BASE - N_TOP + 2);
    frect(c, GATE.x0, N_TOP, 8, N_BASE - N_TOP, '#20262d'); frect(c, GATE.x1 - 8, N_TOP, 8, N_BASE - N_TOP, '#20262d');
    frect(c, GATE.x0 + 3, N_TOP, 2, N_BASE - N_TOP, 'rgba(150,180,210,.4)'); frect(c, GATE.x1 - 5, N_TOP, 2, N_BASE - N_TOP, 'rgba(150,180,210,.4)');
    frect(c, GATE.x0, N_TOP, GATE.x1 - GATE.x0, 80, 'rgba(4,8,14,.4)');
    c.drawImage(A.grate, 1820 - A.grate.width / 2, 330);
    const T = toneA('#5a636e');
    gateTower(c, 1572, T, 501, false); gateTower(c, 1928, T, 502, true);
    // overhead beam with the village plate, and the raised steel shutter
    box(c, 1704, 24, 232, 30, 62, toneA('#4c5560'), { shadow: false, floors: 0, panel: 29, drips: false });
    frect(c, 1712, 116, 216, 30, '#5d6772'); c.strokeStyle = 'rgba(10,16,24,.5)'; c.lineWidth = 1; c.beginPath(); for (let y = 119; y < 146; y += 4) { c.moveTo(1712, y + .5); c.lineTo(1928, y + .5); } c.stroke();
    frect(c, 1712, 142, 216, 6, '#2a3139'); srect(c, 1712, 116, 216, 32, OUT, 1.5);
    drips(c, 1714, 148, 212, 16, 77);
    frect(c, 1764, 60, 112, 50, '#20262d'); frect(c, 1768, 64, 104, 42, '#2e2a40'); srect(c, 1764, 60, 112, 50, OUT, 1.6);
    rainMark(c, 1792, 85, 26, '#d8dfe8', 3);
    txt(c, '雨隠れ', 1840, 86, 17, '#e8dcb4', { weight: '900' });
    for (const x of [1716, 1924]) { line(c, x, 116, x, 106, OUT, 2); fell(c, x, 112, 5, 4, LIT); }
  }

  // ------------------------------------------------------------------ ground tiles
  function wrapDraw(S, x, y, m, fn) { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { const X = x + ox, Y = y + oy; if (X < -m || X > S + m || Y < -m || Y > S + m) continue; fn(X, Y); } }
  function makeGroundTile() {
    const S = 512, cv = mk(S, S), c = cv.getContext('2d'), R = rng(4401);
    frect(c, 0, 0, S, S, '#232a31');
    const tones = ['#3a434c', '#3e4750', '#373f48', '#424b54', '#353d46', '#3c454e', '#40484f'];
    const rows = []; let y = 0;
    while (S - y > 0) { let h = 30 + Math.floor(R() * 26); if (S - y - h < 30) h = S - y; rows.push([y, h]); y += h; }
    for (const [ry, rh] of rows) {
      const x0 = Math.floor(R() * 60); let x = x0;
      while (x0 + S - x > 0) {
        let w = 34 + Math.floor(R() * 52); if (x0 + S - x - w < 30) w = x0 + S - x;
        const col = tones[Math.floor(R() * tones.length)], sheen = R() < .3, sx = R(), crack = R() < .12;
        for (const ox of [0, -S]) {
          const X = x + ox; if (X > S || X + w < 0) continue;
          rrect(c, X + 1.5, ry + 1.5, w - 3, rh - 3, 4); c.fillStyle = col; c.fill();
          frect(c, X + 3, ry + 2.5, w - 7, 1.5, 'rgba(170,190,212,.13)'); frect(c, X + 3, ry + rh - 4, w - 6, 1.5, 'rgba(0,0,0,.22)');
          if (sheen) fell(c, X + w * (.3 + sx * .4), ry + rh * .45, w * .28, rh * .16, 'rgba(140,165,192,.12)');
          if (crack) { c.beginPath(); c.moveTo(X + w * .2, ry + 4); c.lineTo(X + w * .45, ry + rh * .5); c.lineTo(X + w * .38, ry + rh - 4); sk(c, 'rgba(10,14,20,.45)', 1); }
        }
        x += w;
      }
    }
    for (let i = 0; i < 16; i++) { const x = R() * S, yy = R() * S, rx = 50 + R() * 110; wrapDraw(S, x, yy, rx, (X, Y) => fell(c, X, Y, rx, rx * .5, R() < .6 ? 'rgba(8,14,22,.14)' : 'rgba(110,135,160,.07)')); }
    for (let i = 0; i < 40; i++) { const x = R() * S, yy = R() * S; wrapDraw(S, x, yy, 6, (X, Y) => fell(c, X, Y, 3 + R() * 4, 1.5, 'rgba(60,90,70,.22)')); }
    c.fillStyle = 'rgba(160,180,200,.12)'; for (let i = 0; i < 700; i++) c.fillRect(R() * S, R() * S, 1.2, 1.2);
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 700; i++) c.fillRect(R() * S, R() * S, 1.4, 1.4);
    return cv;
  }
  function makeRoadTile() {
    const S = 192, cv = mk(S, S), c = cv.getContext('2d'), R = rng(5511);
    frect(c, 0, 0, S, S, '#2a3038');
    const tones = ['#58626c', '#5d6771', '#545e68', '#616b75'];
    for (let r = 0; r < 3; r++) {
      const y = r * 64, off = (r % 2) * 48;
      for (let k = -1; k < 3; k++) {
        const x = off + k * 96, col = tones[(r * 2 + mod(k, 2)) % 4], RR = rng(r * 10 + mod(k, 2) + 3);
        rrect(c, x + 1.5, y + 1.5, 93, 61, 3); c.fillStyle = col; c.fill();
        frect(c, x + 3, y + 2.5, 89, 1.5, 'rgba(180,198,215,.15)'); frect(c, x + 3, y + 59, 90, 2, 'rgba(0,0,0,.22)');
        for (let i = 0; i < 6; i++) fell(c, x + 8 + RR() * 80, y + 8 + RR() * 48, 1 + RR() * 1.6, 1, 'rgba(0,0,0,.25)');
        if (RR() < .5) fell(c, x + 30 + RR() * 30, y + 30, 26, 8, 'rgba(140,165,190,.1)');
        if (RR() < .35) { c.beginPath(); c.moveTo(x + 10 + RR() * 30, y + 4); c.lineTo(x + 40 + RR() * 20, y + 30); c.lineTo(x + 30 + RR() * 40, y + 60); sk(c, 'rgba(10,14,20,.4)', 1); }
      }
    }
    for (let i = 0; i < 5; i++) { const x = R() * S, y = R() * S; wrapDraw(S, x, y, 30, (X, Y) => fell(c, X, Y, 14 + R() * 12, 6, 'rgba(10,12,18,.18)')); }
    return cv;
  }
  function makePlateTile() {
    const S = 104, cv = mk(S, S), c = cv.getContext('2d'), R = rng(6123);
    frect(c, 0, 0, S, S, '#1f252c');
    const tones = ['#5f6a75', '#65707b', '#5a6570', '#626d78'];
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const x = i * 52, y = j * 52;
      frect(c, x + 1, y + 1, 50, 50, tones[j * 2 + i]);
      c.strokeStyle = 'rgba(10,14,20,.22)'; c.lineWidth = 1; c.beginPath();
      for (let k = 6; k < 50; k += 9) { c.moveTo(x + k, y + 4); c.lineTo(x + k + 4, y + 8); c.moveTo(x + k + 4, y + 24); c.lineTo(x + k, y + 28); c.moveTo(x + k, y + 40); c.lineTo(x + k + 4, y + 44); } c.stroke();
      frect(c, x + 1, y + 1, 50, 1.5, 'rgba(190,205,220,.2)'); frect(c, x + 1, y + 49, 50, 2, 'rgba(0,0,0,.3)');
      c.fillStyle = 'rgba(200,214,228,.45)'; for (const [px, py] of [[4, 4], [46, 4], [4, 46], [46, 46]]) c.fillRect(x + px, y + py, 2, 2);
      if (R() < .6) fell(c, x + 10 + R() * 30, y + 10 + R() * 30, 5 + R() * 8, 3 + R() * 4, 'rgba(120,64,34,.28)');
      if (R() < .5) fell(c, x + 26, y + 30, 14, 4, 'rgba(140,165,190,.18)');
    }
    return cv;
  }
  function makeFaceTile() {
    const W = 260, H = 84, cv = mk(W, H), c = cv.getContext('2d');
    frect(c, 0, 0, W, H, '#1f252c');
    const tones = ['#434c56', '#3d4650', '#48515b', '#3a434d', '#454e58'];
    for (let r = 0; r < 2; r++) {
      const y = r * 42, off = r ? 65 : 0;
      for (let k = -1; k < 3; k++) {
        const x = off + k * 130, m2 = mod(k, 2), RR = rng(r * 7 + m2 * 3 + 1), col = tones[(r * 2 + m2 * 3) % 5];
        frect(c, x + 1.5, y + 1.5, 127, 39, col);
        frect(c, x + 2, y + 2, 126, 2, 'rgba(180,196,212,.14)'); frect(c, x + 1.5, y + 37, 127, 3, 'rgba(0,0,0,.26)');
        for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(6,10,18,.16)'; c.fillRect(x + 6 + RR() * 116, y + 3, 2 + RR() * 4, 10 + RR() * 26); }
        for (let i = 0; i < 6; i++) fell(c, x + 6 + RR() * 116, y + 6 + RR() * 30, 1.2, 1, 'rgba(0,0,0,.3)');
        if (RR() < .5) { c.fillStyle = 'rgba(125,70,38,.18)'; c.fillRect(x + 20 + RR() * 90, y + 3, 3, 30); }
      }
    }
    return cv;
  }
  function makeLakeTile() {
    const S = 260, cv = mk(S, S), c = cv.getContext('2d'), R = rng(7301);
    frect(c, 0, 0, S, S, '#3f505e');
    for (let i = 0; i < 10; i++) { const x = R() * S, y = R() * S, rx = 40 + R() * 80; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, rx * .3, R() < .5 ? 'rgba(90,112,134,.18)' : 'rgba(20,30,40,.2)')); }
    for (let i = 0; i < 46; i++) {
      const x = R() * S, y = R() * S, len = 30 + R() * 90, ph = R() * TAU, light = R() < .55;
      wrapDraw(S, x, y, len + 10, (X, Y) => {
        c.beginPath(); for (let t = 0; t <= len; t += 6) { const px = X + t, py = Y + Math.sin(t / len * TAU + ph) * 2; t ? c.lineTo(px, py) : c.moveTo(px, py); }
        sk(c, light ? 'rgba(160,184,206,.22)' : 'rgba(14,22,32,.3)', light ? 1.4 : 2);
      });
    }
    for (let i = 0; i < 26; i++) { const x = R() * S, y = R() * S, r = 3 + R() * 9; wrapDraw(S, x, y, r + 2, (X, Y) => { c.beginPath(); c.ellipse(X, Y, r, r * .4, 0, 0, TAU); sk(c, 'rgba(190,208,226,.22)', 1); }); }
    return cv;
  }
  function makeShoreTile() {
    const S = 260, cv = mk(S, S), c = cv.getContext('2d'), R = rng(8101);
    frect(c, 0, 0, S, S, '#2d3330');
    for (let i = 0; i < 14; i++) { const x = R() * S, y = R() * S, rx = 20 + R() * 50; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, rx * .5, R() < .5 ? 'rgba(60,66,58,.4)' : 'rgba(14,18,20,.3)')); }
    for (let i = 0; i < 70; i++) {
      const x = R() * S, y = R() * S, r = 2 + R() * 7, col = ['#4a5052', '#3e4446', '#555b5c'][Math.floor(R() * 3)];
      wrapDraw(S, x, y, r + 3, (X, Y) => { fell(c, X + 1, Y + 1.5, r, r * .65, 'rgba(0,0,0,.35)'); fell(c, X, Y, r, r * .65, col); fell(c, X - r * .3, Y - r * .3, r * .4, r * .25, 'rgba(190,205,215,.25)'); });
    }
    for (let i = 0; i < 30; i++) { const x = R() * S, y = R() * S; wrapDraw(S, x, y, 10, (X, Y) => { for (let k = -2; k <= 2; k++) line(c, X + k * 2, Y, X + k * 3.4, Y - 7 - R() * 6, 'rgba(78,92,64,.7)', 1.2); }); }
    return cv;
  }
  function makePlaza() {
    const W = PLAZA.rx * 2 + 40, H = PLAZA.ry * 2 + 40, cv = mk(W, H), c = cv.getContext('2d'), R = rng(9091);
    c.translate(W / 2, H / 2); c.lineJoin = 'round';
    const k = PLAZA.ry / PLAZA.rx, ringW = 46;
    for (let r = PLAZA.rx, i = 0; r > 20; r -= ringW, i++) {
      c.beginPath(); c.ellipse(0, 0, r, r * k, 0, 0, TAU); c.fillStyle = ['#4a535d', '#454e58', '#4e5761'][i % 3]; c.fill();
      c.beginPath(); c.ellipse(0, 0, r, r * k, 0, 0, TAU); sk(c, 'rgba(10,14,20,.55)', 2);
      const r2 = Math.max(0, r - ringW), n = Math.max(8, Math.floor(TAU * r / 84));
      c.strokeStyle = 'rgba(10,14,20,.45)'; c.lineWidth = 1.5; c.beginPath();
      for (let j = 0; j < n; j++) { const a = j / n * TAU + i * .37; c.moveTo(Math.cos(a) * r, Math.sin(a) * r * k); c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 * k); }
      c.stroke();
      c.beginPath(); c.ellipse(0, 1.5, r - 2, (r - 2) * k, 0, Math.PI * 1.05, Math.PI * 1.7); sk(c, 'rgba(180,198,215,.12)', 1.5);
    }
    for (let i = 0; i < 30; i++) { const a = R() * TAU, d = R() * .9; fell(c, Math.cos(a) * PLAZA.rx * d, Math.sin(a) * PLAZA.ry * d, 20 + R() * 40, 6 + R() * 8, 'rgba(140,165,192,.08)'); }
    c.beginPath(); c.ellipse(0, 0, PLAZA.rx, PLAZA.ry, 0, 0, TAU); sk(c, '#2a3139', 16);
    c.beginPath(); c.ellipse(0, 0, PLAZA.rx - 6, PLAZA.ry - 6, 0, 0, TAU); sk(c, '#6d7883', 4);
    c.beginPath(); c.ellipse(0, 0, PLAZA.rx + 8, PLAZA.ry + 8, 0, 0, TAU); sk(c, 'rgba(4,8,14,.6)', 2);
    for (let j = 0; j < 12; j++) { const a = j / 12 * TAU + .26, x = Math.cos(a) * (PLAZA.rx - 28), y = Math.sin(a) * (PLAZA.ry - 24); c.drawImage(A.grate, x - A.grate.width / 2, y - A.grate.height / 2); }
    // the rain emblem in front of the tower
    const ey = PLAZA.ry - 120;
    c.save(); c.translate(0, ey); c.scale(1, .62);
    c.beginPath(); c.arc(0, 0, 92, 0, TAU); c.fillStyle = 'rgba(20,26,34,.45)'; c.fill();
    c.beginPath(); c.arc(0, 0, 92, 0, TAU); sk(c, '#66717c', 8); c.beginPath(); c.arc(0, 0, 84, 0, TAU); sk(c, 'rgba(190,205,220,.3)', 2);
    c.restore();
    c.save(); c.translate(0, ey); rainMark(c, 2, 2, 60, 'rgba(8,12,18,.6)', 9); rainMark(c, 0, 0, 60, '#8a96a2', 8); rainMark(c, -1, -1, 60, 'rgba(220,230,240,.35)', 2); c.restore();
    return cv;
  }
  function makePuddle(rx, ry, seed) {
    const W = Math.ceil(rx * 2 + 10), H = Math.ceil(ry * 2 + 10), cv = mk(W, H), c = cv.getContext('2d'), R = rng(seed);
    const cx = W / 2, cy = H / 2, p = blob(cx, cy, rx, ry, R, 14, .24);
    c.save(); c.translate(0, 1.5); c.fillStyle = 'rgba(4,8,14,.45)'; c.fill(p); c.restore();
    c.fillStyle = '#2c3a48'; c.fill(p);
    c.save(); c.clip(p);
    fell(c, cx - rx * .2, cy - ry * .25, rx * .75, ry * .5, 'rgba(110,136,162,.45)');
    fell(c, cx - rx * .35, cy - ry * .35, rx * .35, ry * .18, 'rgba(190,210,230,.35)');
    for (let i = 0; i < 3; i++) frect(c, cx - rx + R() * rx * 2, cy - ry, 2 + R() * 5, ry * 2, 'rgba(12,18,28,.35)');
    if (R() < .5) frect(c, cx - rx * .1 + R() * rx * .5, cy - ry, 3, ry * 2, 'rgba(255,200,110,.25)');
    c.restore();
    c.strokeStyle = 'rgba(170,192,214,.42)'; c.lineWidth = 1.2; c.stroke(p);
    return cv;
  }
  function makeGrate() {
    const cv = mk(48, 22), c = cv.getContext('2d');
    frect(c, 0, 0, 48, 22, '#1d2329'); frect(c, 2, 2, 44, 18, '#0d1014');
    for (let x = 5; x < 44; x += 5) frect(c, x, 3, 2, 16, '#55606b');
    frect(c, 2, 2, 44, 2, 'rgba(190,205,220,.35)'); srect(c, .5, .5, 47, 21, '#0b0e12', 1);
    return cv;
  }
  function makeManhole() {
    const cv = mk(40, 22), c = cv.getContext('2d');
    fell(c, 20, 12, 18, 9, '#1a1f25'); fell(c, 20, 11, 16, 8, '#3d4650');
    c.save(); c.beginPath(); c.ellipse(20, 11, 14, 7, 0, 0, TAU); c.clip();
    c.strokeStyle = 'rgba(10,14,20,.6)'; c.lineWidth = 1; c.beginPath(); for (let x = 4; x < 38; x += 4) { c.moveTo(x, 2); c.lineTo(x + 6, 20); c.moveTo(x + 6, 2); c.lineTo(x, 20); } c.stroke();
    c.restore();
    c.beginPath(); c.ellipse(20, 11, 16, 8, 0, Math.PI, TAU); sk(c, 'rgba(190,205,220,.3)', 1);
    return cv;
  }
  function makeStain() {
    const cv = mk(70, 34), c = cv.getContext('2d'), R = rng(11);
    c.fillStyle = 'rgba(8,10,14,.32)'; c.fill(blob(35, 17, 30, 13, R));
    c.fillStyle = 'rgba(120,90,170,.12)'; c.fill(blob(30, 15, 16, 6, R)); c.fillStyle = 'rgba(90,170,150,.1)'; c.fill(blob(40, 19, 12, 4, R));
    return cv;
  }
  function makeRain(S, n, l0, l1, alpha, lw, seed) {
    const cv = mk(S, S), c = cv.getContext('2d'), R = rng(seed);
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = R() * S, y = R() * S, L = l0 + R() * (l1 - l0), a = alpha * (.45 + R() * .55);
      c.strokeStyle = `rgba(205,220,240,${a.toFixed(3)})`; c.lineWidth = lw * (.7 + R() * .6);
      wrapDraw(S, x, y, L + 4, (X, Y) => { c.beginPath(); c.moveTo(X, Y); c.lineTo(X - SLANT * L, Y + L); c.stroke(); });
    }
    return cv;
  }

  // ------------------------------------------------------------------ props
  function deadTree(c, ax, ay, seed, s = 1) {
    const R = rng(seed);
    fell(c, ax + 20 * s, ay, 40 * s, 10 * s, SHADOW);
    const br = (x, y, a, len, w, d) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, mx = (x + ex) / 2 + (R() - .5) * len * .25, my = (y + ey) / 2;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, ex, ey); sk(c, OUT, w + 2.4);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, ex, ey); sk(c, '#3a3f45', w);
      if (w > 3) { c.beginPath(); c.moveTo(x - w * .25, y); c.quadraticCurveTo(mx - w * .25, my, ex - w * .2, ey); sk(c, '#5d646c', w * .3); }
      if (d < 4) { const n = d < 2 ? 3 : 2; for (let i = 0; i < n; i++) br(ex, ey, a + (i - (n - 1) / 2) * (.55 + R() * .3) + (R() - .5) * .2, len * (.62 + R() * .12), w * .62, d + 1); }
    };
    br(ax, ay, -Math.PI / 2 + (R() - .5) * .2, 62 * s, 10 * s, 0);
  }
  function stall(cl, kind, seed) {
    return sprite(160, 140, 80, 126, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + 14, ay + 2, 70, 12, SHADOW);
      for (const px of [ax - 62, ax + 62]) { line(c, px, ay, px, ay - 86, OUT, 4.6); line(c, px, ay, px, ay - 86, '#5a4a3e', 2.6); }
      frect(c, ax - 58, ay - 34, 116, 34, '#3e342c'); frect(c, ax - 58, ay - 34, 116, 6, '#6a5646');
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.beginPath(); for (let x = ax - 48; x < ax + 58; x += 12) { c.moveTo(x, ay - 28); c.lineTo(x, ay); } c.stroke();
      srect(c, ax - 58, ay - 34, 116, 34, OUT, 1.4);
      if (kind === 0) { // umbrellas
        for (let i = 0; i < 6; i++) { const x = ax - 46 + i * 17, col = ['#a8423a', '#3d5a7a', '#c9c2b2', '#5d4c6a', '#2f6f6f', '#b8862e'][i]; fpoly(c, [x - 4, ay - 36, x + 4, ay - 36, x + 1.5, ay - 62, x - 1.5, ay - 62], col); poly(c, [x - 4, ay - 36, x + 4, ay - 36, x + 1.5, ay - 62, x - 1.5, ay - 62]); sk(c, OUT, 1); line(c, x, ay - 62, x, ay - 68, '#20262d', 1.4); }
        umbrellaOpen(c, ax + 34, ay - 52, 18, '#a8423a');
      } else if (kind === 1) { // food: steaming bowls and a pot
        for (let i = 0; i < 4; i++) { const x = ax - 40 + i * 20; fell(c, x, ay - 37, 8, 3.5, '#d8d2c4'); fell(c, x, ay - 38, 6, 2.2, '#a0603a'); c.beginPath(); c.ellipse(x, ay - 37, 8, 3.5, 0, 0, TAU); sk(c, OUT, 1); }
        const g = cyl(c, ax + 36, ay - 56, 13, 16, toneA('#55606b'), { band: [[4, 2, '#2a3139']] }); capTop(c, g, toneA('#55606b'));
        for (const dx of [-4, 4]) { c.beginPath(); c.moveTo(ax + 36 + dx, ay - 62); c.quadraticCurveTo(ax + 30 + dx, ay - 72, ax + 38 + dx, ay - 82); sk(c, 'rgba(220,230,240,.35)', 2); }
      } else { // paper goods & bottles
        for (let i = 0; i < 5; i++) { const x = ax - 44 + i * 18; frect(c, x, ay - 46, 6, 12, ['#3d5a5a', '#6a4a3a', '#4a5a3a', '#3a4a6a', '#6a3a3a'][i]); frect(c, x + 1.5, ay - 52, 3, 6, '#2a3038'); srect(c, x, ay - 46, 6, 12, OUT, .8); }
        paperFlower(c, ax + 26, ay - 40, 9); paperFlower(c, ax + 42, ay - 42, 8, '#dfe6f4', '#a9b4e0');
      }
      const T = toneA(cl);
      fpoly(c, [ax - 70, ay - 82, ax + 70, ay - 82, ax + 66, ay - 106, ax - 66, ay - 106], T.base);
      c.strokeStyle = T.dark; c.lineWidth = 1.3; c.beginPath(); for (let x = ax - 64; x < ax + 66; x += 8) { c.moveTo(x, ay - 106); c.lineTo(x + (x - ax) * .06, ay - 82); } c.stroke();
      frect(c, ax - 66, ay - 106, 132, 3, T.light); frect(c, ax - 70, ay - 85, 140, 4, T.deep);
      poly(c, [ax - 70, ay - 82, ax + 70, ay - 82, ax + 66, ay - 106, ax - 66, ay - 106]); sk(c, OUT, 1.5);
      drips(c, ax - 68, ay - 81, 136, 10, seed + 5);
      chochin(c, ax - 46, ay - 70, 1);
      void R;
    });
  }
  function makeProps() {
    const P = {};
    P.lamp = sprite(70, 140, 24, 130, (c, ax, ay) => {
      fell(c, ax + 26, ay - 2, 34, 9, 'rgba(255,200,110,.09)');
      fell(c, ax + 5, ay, 11, 3.5, SHADOW);
      frect(c, ax - 6, ay - 9, 12, 9, '#262c33'); srect(c, ax - 6, ay - 9, 12, 9, OUT, 1.2);
      line(c, ax, ay - 8, ax, ay - 104, OUT, 6); line(c, ax, ay - 8, ax, ay - 104, '#46505a', 3.4); line(c, ax - 1, ay - 8, ax - 1, ay - 104, '#7d8994', 1);
      c.beginPath(); c.moveTo(ax, ay - 100); c.quadraticCurveTo(ax + 3, ay - 116, ax + 22, ay - 112); sk(c, OUT, 5);
      c.beginPath(); c.moveTo(ax, ay - 100); c.quadraticCurveTo(ax + 3, ay - 116, ax + 22, ay - 112); sk(c, '#46505a', 2.6);
      fpoly(c, [ax + 11, ay - 110, ax + 33, ay - 110, ax + 29, ay - 101, ax + 15, ay - 101], '#262c33'); poly(c, [ax + 11, ay - 110, ax + 33, ay - 110, ax + 29, ay - 101, ax + 15, ay - 101]); sk(c, OUT, 1.2);
      fell(c, ax + 22, ay - 97, 14, 9, 'rgba(255,210,120,.2)'); fell(c, ax + 22, ay - 99, 6, 3.5, LIT); fell(c, ax + 22, ay - 100, 3, 1.8, LIT2);
    });
    P.lamp2 = sprite(90, 170, 45, 160, (c, ax, ay) => {
      fell(c, ax, ay - 2, 40, 10, 'rgba(255,200,110,.08)'); fell(c, ax + 6, ay, 13, 4, SHADOW);
      frect(c, ax - 8, ay - 12, 16, 12, '#262c33'); srect(c, ax - 8, ay - 12, 16, 12, OUT, 1.2);
      line(c, ax, ay - 10, ax, ay - 138, OUT, 7); line(c, ax, ay - 10, ax, ay - 138, '#46505a', 4); line(c, ax - 1.2, ay - 10, ax - 1.2, ay - 138, '#7d8994', 1.2);
      line(c, ax - 28, ay - 136, ax + 28, ay - 136, OUT, 5); line(c, ax - 28, ay - 136.5, ax + 28, ay - 136.5, '#5d6874', 2.4);
      for (const s of [-1, 1]) { const x = ax + s * 24; fpoly(c, [x - 10, ay - 136, x + 10, ay - 136, x + 7, ay - 128, x - 7, ay - 128], '#262c33'); fell(c, x, ay - 124, 13, 8, 'rgba(255,210,120,.2)'); fell(c, x, ay - 126, 5.5, 3.2, LIT); fell(c, x, ay - 127, 2.6, 1.6, LIT2); }
      bannerRain(c, ax + 6, ay - 112, 20, 50, '#2c3644');
    });
    P.banner = [0, 1].map(k => sprite(56, 160, 14, 150, (c, ax, ay) => {
      fell(c, ax + 6, ay, 10, 3.5, SHADOW);
      line(c, ax, ay, ax, ay - 140, OUT, 5); line(c, ax, ay, ax, ay - 140, '#5d6874', 2.6);
      fell(c, ax, ay - 142, 3.4, 3.4, '#8a96a2');
      bannerRain(c, ax + 4, ay - 132, 28, 96, k ? '#3b3350' : '#2c3644');
    }));
    P.barrels = sprite(80, 64, 36, 56, (c, ax, ay) => {
      fell(c, ax + 10, ay, 34, 8, SHADOW);
      for (const [dx, dy, col] of [[-16, -3, '#4f6070'], [12, -1, '#7a5440'], [-2, 4, '#5d6a74']]) {
        const T = toneA(col), g = cyl(c, ax + dx, ay + dy - 34, 13, 26, T, { band: [[5, 3, T.deep], [18, 3, T.deep]] });
        fell(c, g.cx, g.ty, 13, g.ry, T.light); fell(c, g.cx + 4, g.ty, 3, 1.4, T.deep); c.beginPath(); c.ellipse(g.cx, g.ty, 13, g.ry, 0, 0, TAU); sk(c, OUT, 1.4);
        fell(c, g.cx - 2, g.ty, 6, 1.6, 'rgba(160,185,210,.35)');
      }
    });
    P.crates = sprite(84, 72, 38, 62, (c, ax, ay) => {
      fell(c, ax + 12, ay, 36, 8, SHADOW);
      const bx = (x, y, w, h, d) => {
        fpoly(c, [x, y, x + w, y, x + w + d * .4, y - d, x + d * .4, y - d], '#6a5a4a');
        frect(c, x, y, w, h, '#4e4236'); c.strokeStyle = '#2e261f'; c.lineWidth = 1.2; c.beginPath(); for (let yy = y + h / 3; yy < y + h - 1; yy += h / 3) { c.moveTo(x, yy); c.lineTo(x + w, yy); } c.moveTo(x, y); c.lineTo(x + w, y + h); c.stroke();
        fpoly(c, [x + w, y, x + w + d * .4, y - d, x + w + d * .4, y + h - d, x + w, y + h], '#3a3028');
        poly(c, [x, y, x + d * .4, y - d, x + w + d * .4, y - d, x + w + d * .4, y + h - d, x + w, y + h, x, y + h]); sk(c, OUT, 1.4);
      };
      bx(ax - 32, ay - 24, 30, 24, 14); bx(ax + 2, ay - 22, 26, 22, 12); bx(ax - 22, ay - 48, 26, 22, 12);
      txt(c, '雨', ax - 17, ay - 12, 12, 'rgba(220,210,180,.55)', { weight: '900' });
    });
    P.gas = sprite(70, 70, 32, 62, (c, ax, ay) => {
      fell(c, ax + 8, ay, 28, 7, SHADOW);
      for (const [dx, col] of [[-14, '#6a4a3e'], [0, '#4f6070'], [14, '#6a4a3e']]) {
        const T = toneA(col), g = cyl(c, ax + dx, ay - 46, 7, 42, T, { band: [[6, 3, '#d8d0b8']] });
        domeTop(c, g.cx, g.ty, 7, g.ry, 6, T); line(c, g.cx, g.ty - 6, g.cx, g.ty - 11, '#20262d', 3);
      }
    });
    P.bigTank = sprite(210, 230, 100, 214, (c, ax, ay) => {
      const T = toneA('#6a5a4f');
      fell(c, ax + 24, ay - 6, 96, 30, SHADOW);
      const g = cyl(c, ax, ay - 28 - 128, 70, 128, T, { band: [[18, 4, T.dark], [62, 4, T.dark], [106, 4, T.dark]], paint: (cc, gg) => {
        const R = rng(31); for (let i = 0; i < 12; i++) frect(cc, ax - 60 + R() * 120, gg.ty + gg.ry + R() * 60, 3, 20 + R() * 50, 'rgba(120,58,28,.3)');
        frect(cc, ax - 26, gg.ty + gg.ry + 34, 52, 22, '#d8d0b8'); srect(cc, ax - 26, gg.ty + gg.ry + 34, 52, 22, OUT, 1.2); txt(cc, '雨水', ax, gg.ty + gg.ry + 46, 15, '#2a1a12', { weight: '900' });
      } });
      domeTop(c, ax, g.ty, 70, g.ry, 26, toneA('#5a4c44'));
      ladderV(c, ax - 52, g.ty + 8, ay - 6);
      railing(c, ax - 30, g.ty - 12, 60, 10);
      pipe(c, [ax + 66, ay - 70, ax + 88, ay - 70, ax + 88, ay - 6], 9, '#76828d');
      fell(c, ax + 88, ay - 48, 8, 8, '#9a3a32'); c.beginPath(); c.arc(ax + 88, ay - 48, 8, 0, TAU); sk(c, OUT, 1.4); line(c, ax + 80, ay - 48, ax + 96, ay - 48, '#5a1e1a', 1.6); line(c, ax + 88, ay - 56, ax + 88, ay - 40, '#5a1e1a', 1.6);
    });
    P.waterTower = sprite(110, 200, 55, 188, (c, ax, ay) => {
      fell(c, ax + 16, ay, 40, 10, SHADOW);
      tankLegs(c, ax, ay - 2, 30, 36, '#6a5a4f', { legH: 104 });
      ladderV(c, ax + 14, ay - 108, ay - 2);
    });
    P.pipeRun = sprite(270, 80, 135, 66, (c, ax, ay) => {
      fell(c, ax + 14, ay, 130, 9, SHADOW);
      for (const sx of [-90, 0, 90]) { frect(c, ax + sx - 9, ay - 22, 18, 22, '#4a535d'); frect(c, ax + sx - 9, ay - 22, 18, 4, '#6d7883'); srect(c, ax + sx - 9, ay - 22, 18, 22, OUT, 1.2); }
      pipe(c, [ax - 120, ay - 2, ax - 120, ay - 30, ax + 120, ay - 30, ax + 120, ay - 2], 12, '#66717c');
      pipe(c, [ax - 110, ay - 6, ax - 110, ay - 46, ax + 110, ay - 46, ax + 110, ay - 6], 8, '#7a5a46');
      fell(c, ax + 34, ay - 58, 9, 9, '#9a3a32'); c.beginPath(); c.arc(ax + 34, ay - 58, 9, 0, TAU); sk(c, OUT, 1.4); line(c, ax + 25, ay - 58, ax + 43, ay - 58, '#5a1e1a', 1.6); line(c, ax + 34, ay - 67, ax + 34, ay - 49, '#5a1e1a', 1.6); line(c, ax + 34, ay - 49, ax + 34, ay - 46, OUT, 3);
      drips(c, ax - 100, ay - 22, 200, 8, 91);
    });
    P.pipeRunV = sprite(70, 280, 35, 272, (c, ax, ay) => {
      fell(c, ax + 10, ay - 120, 22, 130, 'rgba(4,8,14,.22)');
      for (const sy of [-30, -130, -230]) { frect(c, ax - 20, ay + sy - 8, 40, 14, '#4a535d'); frect(c, ax - 20, ay + sy - 8, 40, 3, '#6d7883'); srect(c, ax - 20, ay + sy - 8, 40, 14, OUT, 1.2); }
      pipe(c, [ax - 8, ay - 258, ax - 8, ay - 4], 12, '#66717c'); pipe(c, [ax + 12, ay - 250, ax + 12, ay - 8], 8, '#7a5a46');
    });
    P.valve = sprite(80, 80, 40, 70, (c, ax, ay) => {
      fell(c, ax + 8, ay, 30, 7, SHADOW);
      pipe(c, [ax - 26, ay - 2, ax - 26, ay - 30, ax + 26, ay - 30, ax + 26, ay - 2], 10, '#66717c');
      frect(c, ax - 12, ay - 44, 24, 26, '#55606b'); frect(c, ax - 12, ay - 44, 24, 5, '#7d8994'); srect(c, ax - 12, ay - 44, 24, 26, OUT, 1.3);
      c.beginPath(); c.ellipse(ax, ay - 52, 14, 6, 0, 0, TAU); sk(c, OUT, 4.6); c.beginPath(); c.ellipse(ax, ay - 52, 14, 6, 0, 0, TAU); sk(c, '#a8403a', 2.4);
      line(c, ax - 14, ay - 52, ax + 14, ay - 52, '#6a2420', 1.6); line(c, ax, ay - 58, ax, ay - 46, '#6a2420', 1.6);
    });
    P.vent = sprite(60, 90, 28, 80, (c, ax, ay) => {
      fell(c, ax + 6, ay, 18, 5, SHADOW);
      const T = toneA('#5d6874'), g = cyl(c, ax, ay - 56, 10, 52, T, { band: [[16, 3, T.dark], [36, 3, T.dark]] });
      const cap = new Path2D(); cap.moveTo(ax - 18, g.ty - 2); cap.quadraticCurveTo(ax, g.ty - 22, ax + 18, g.ty - 2); cap.closePath();
      c.fillStyle = T.dark; c.fill(cap); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(cap);
      line(c, ax - 6, g.ty, ax - 6, g.ty - 6, OUT, 2); line(c, ax + 6, g.ty, ax + 6, g.ty - 6, OUT, 2);
    });
    P.scrap = sprite(110, 70, 52, 58, (c, ax, ay) => {
      fell(c, ax + 10, ay, 48, 10, SHADOW);
      const R = rng(55);
      for (let i = 0; i < 9; i++) { const x = ax - 40 + R() * 80, y = ay - 6 - R() * 22, w = 14 + R() * 26, h = 6 + R() * 8, a = (R() - .5) * .8; c.save(); c.translate(x, y); c.rotate(a); frect(c, -w / 2, -h / 2, w, h, ['#5d6874', '#6a4a3e', '#4a535d', '#7a5a46'][i % 4]); frect(c, -w / 2, -h / 2, w, 2, 'rgba(200,214,228,.25)'); srect(c, -w / 2, -h / 2, w, h, OUT, 1.1); c.restore(); }
      pipe(c, [ax - 36, ay - 20, ax + 30, ay - 34], 7, '#66717c');
    });
    P.bench = sprite(84, 44, 40, 34, (c, ax, ay) => {
      fell(c, ax + 8, ay, 36, 6, SHADOW);
      for (const x of [-30, 24]) { frect(c, ax + x, ay - 13, 6, 13, '#2a3139'); }
      frect(c, ax - 34, ay - 20, 68, 8, '#55606b'); frect(c, ax - 34, ay - 20, 68, 2, '#8a96a2'); srect(c, ax - 34, ay - 20, 68, 8, OUT, 1.3);
      frect(c, ax - 34, ay - 34, 68, 6, '#4a535d'); srect(c, ax - 34, ay - 34, 68, 6, OUT, 1.2); line(c, ax - 30, ay - 28, ax - 30, ay - 20, OUT, 2); line(c, ax + 30, ay - 28, ax + 30, ay - 20, OUT, 2);
    });
    P.planter = sprite(90, 70, 44, 60, (c, ax, ay) => {
      fell(c, ax + 8, ay, 36, 7, SHADOW);
      frect(c, ax - 32, ay - 22, 64, 22, '#5a636d'); frect(c, ax - 32, ay - 22, 64, 4, '#7a838c'); frect(c, ax + 20, ay - 22, 12, 22, 'rgba(0,0,0,.2)'); srect(c, ax - 32, ay - 22, 64, 22, OUT, 1.3);
      frect(c, ax - 28, ay - 22, 56, 5, '#2a2622');
      paperFlower(c, ax - 18, ay - 24, 9); paperFlower(c, ax + 2, ay - 27, 11, '#dfe6f4', '#a9b4e0'); paperFlower(c, ax + 19, ay - 24, 8, '#f4f6fa', '#c9b4e0'); paperFlower(c, ax - 6, ay - 36, 8, '#eef2f8', '#9fb0e0');
    });
    P.shrine = sprite(180, 170, 90, 150, (c, ax, ay) => {
      fell(c, ax + 14, ay, 80, 16, SHADOW);
      frect(c, ax - 60, ay - 22, 120, 22, '#4f5862'); frect(c, ax - 60, ay - 22, 120, 4, '#717a84'); srect(c, ax - 60, ay - 22, 120, 22, OUT, 1.5);
      frect(c, ax - 34, ay - 74, 68, 52, '#5c656f'); frect(c, ax - 34, ay - 74, 6, 52, 'rgba(210,225,240,.2)'); frect(c, ax + 24, ay - 74, 10, 52, 'rgba(0,0,0,.25)'); srect(c, ax - 34, ay - 74, 68, 52, OUT, 1.6);
      rainMark(c, ax, ay - 48, 30, 'rgba(10,14,20,.55)', 4); rainMark(c, ax - 1, ay - 49, 30, '#9aa6b2', 3);
      fpoly(c, [ax - 40, ay - 74, ax + 40, ay - 74, ax + 30, ay - 82, ax - 30, ay - 82], '#6d7680'); poly(c, [ax - 40, ay - 74, ax + 40, ay - 74, ax + 30, ay - 82, ax - 30, ay - 82]); sk(c, OUT, 1.3);
      paperFlower(c, ax, ay - 92, 24, '#eef2f8', '#b7c2e8');
      const R = rng(808);
      for (let i = 0; i < 9; i++) { const a = Math.PI * (.05 + .9 * i / 8), x = ax + Math.cos(a) * 74, y = ay + 4 - Math.sin(a) * 6 + (i % 2) * 6; paperFlower(c, x, y, 6 + R() * 3, R() < .5 ? '#eef2f8' : '#e4dcf4', R() < .5 ? '#b7c2e8' : '#c9b4e0'); }
      for (const dx of [-48, 48]) { frect(c, ax + dx - 3, ay - 34, 6, 12, '#e8e2d0'); srect(c, ax + dx - 3, ay - 34, 6, 12, OUT, 1); fell(c, ax + dx, ay - 38, 2.4, 4, LIT); fell(c, ax + dx, ay - 38, 7, 8, 'rgba(255,200,110,.18)'); }
      for (let i = 0; i < 4; i++) { const x = ax - 30 + i * 20; line(c, x, ay - 84, x + 4, ay - 100 - (i % 2) * 6, 'rgba(240,244,250,.8)', 2); }
    });
    P.trees = [0, 1, 2].map(i => sprite(170, 200, 85, 188, (c, ax, ay) => deadTree(c, ax, ay, 600 + i * 37, .95 + i * .1)));
    P.umbrellas = sprite(70, 80, 32, 70, (c, ax, ay) => {
      fell(c, ax + 6, ay, 22, 6, SHADOW);
      const T = toneA('#4a535d'); const g = cyl(c, ax - 6, ay - 26, 10, 22, T); capTop(c, g, T);
      for (const [dx, col] of [[-10, '#3d5a7a'], [-5, '#c9c2b2'], [0, '#5d4c6a']]) { line(c, ax - 6 + dx * .3, g.ty, ax - 6 + dx, g.ty - 34, OUT, 4); line(c, ax - 6 + dx * .3, g.ty, ax - 6 + dx, g.ty - 34, col, 2.4); }
      umbrellaOpen(c, ax + 14, ay - 30, 16, '#a8423a');
    });
    P.flowers = sprite(60, 30, 30, 22, (c, ax, ay) => { paperFlower(c, ax - 12, ay - 2, 6); paperFlower(c, ax + 6, ay - 6, 7, '#e4dcf4', '#c9b4e0'); paperFlower(c, ax + 16, ay + 2, 5, '#dfe6f4', '#a9b4e0'); });
    P.stalls = [stall('#4f5d6b', 0, 21), stall('#5c4b44', 1, 22), stall('#47566a', 2, 23), stall('#4b3f5a', 0, 24)];
    P.sign = sprite(60, 90, 30, 82, (c, ax, ay) => {
      fell(c, ax + 6, ay, 12, 4, SHADOW);
      line(c, ax, ay, ax, ay - 30, OUT, 5); line(c, ax, ay, ax, ay - 30, '#5d6874', 2.6);
      signV(c, ax - 13, ay - 80, 26, 52, '傘');
      chochin(c, ax + 18, ay - 60, .8);
    });
    return P;
  }

  // ------------------------------------------------------------------ state & build
  let ready = false;
  const foots = [];        // footprints (stable order)
  const objs = [];         // sprites sorted by base y
  const lanternsLocal = [];
  const DEC = [];          // ground decals: puddles, grates, manholes, stains
  const PUD = [];          // puddles for the ripple animation

  function renderRegion(x0, y0, x1, y1, fn) {
    const cv = mk(x1 - x0, y1 - y0), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(-x0, -y0); fn(c);
    return { cv, x0, y0 };
  }
  function canvasFor(fn, P, w, h, sm, over) {
    const cv = mk(w + sm * 2, h + over + BM), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(sm, over); fn(c, P);
    return cv;
  }
  const inRect = (x, y, r, m) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;
  const inEll = (x, y, E, m) => { const dx = (x - E.x) / (E.rx + m), dy = (y - E.y) / (E.ry + m); return dx * dx + dy * dy < 1; };

  function build() {
    const tmp = mk(4, 4).getContext('2d');
    A.grate = makeGrate(); A.manhole = makeManhole(); A.stain = makeStain();
    A.groundPat = tmp.createPattern(makeGroundTile(), 'repeat');
    A.roadPat = tmp.createPattern(makeRoadTile(), 'repeat');
    A.platePat = tmp.createPattern(makePlateTile(), 'repeat');
    A.facePat = tmp.createPattern(makeFaceTile(), 'repeat');
    A.lakePat = tmp.createPattern(makeLakeTile(), 'repeat');
    A.shorePat = tmp.createPattern(makeShoreTile(), 'repeat');
    A.plaza = makePlaza();
    buildLakePaths();
    A.puddles = [[26, 10, 1], [40, 14, 2], [58, 18, 3], [80, 24, 4], [34, 12, 5], [110, 30, 6]].map(([rx, ry, s]) => ({ cv: makePuddle(rx, ry, s * 131), rx, ry }));
    A.rings = RING_R.map(R0 => Array.from({ length: 10 }, (_, k) => {
      const cv = mk(R0 * 2 + 6, R0 * .84 + 6), c = cv.getContext('2d'), a = .62 * (1 - k / 10), cx = cv.width / 2, cy = cv.height / 2;
      c.strokeStyle = `rgba(222,234,246,${a.toFixed(3)})`; c.lineWidth = 1.3 * Math.max(1, R0 / 16); c.beginPath(); c.ellipse(cx, cy, R0, R0 * .42, 0, 0, TAU); c.stroke();
      if (k > 2) { c.strokeStyle = `rgba(222,234,246,${(a * .6).toFixed(3)})`; c.beginPath(); c.ellipse(cx, cy, R0 * .55, R0 * .23, 0, 0, TAU); c.stroke(); }
      return cv;
    }));
    A.splash = [0, 1, 2, 3].map(f => {
      const cv = mk(32, 20), c = cv.getContext('2d'), r = 2 + f * 3.4, a = .5 * (1 - f / 4.5);
      c.strokeStyle = `rgba(215,228,242,${a.toFixed(3)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(16, 15, r, r * .4, 0, 0, TAU); c.stroke();
      if (f < 2) { c.fillStyle = `rgba(225,236,248,${(a * 1.2).toFixed(3)})`; for (const [dx, dy] of [[-3, -4 - f * 3], [2, -6 - f * 3], [5, -3 - f * 2]]) c.fillRect(16 + dx, 15 + dy, 1.4, 1.6); }
      return cv;
    });
    A.rain = makeRain(512, 520, 12, 28, .42, 1.15, 71);
    { const r2 = makeRain(512, 90, 32, 62, .55, 1.6, 72); A.rain.getContext('2d').drawImage(r2, 0, 0); }
    A.props = makeProps();
    // wet-ground reflection: a column of shimmering horizontal strokes that fades with distance
    const reflStreak = (c, x, y0, len, w, col, a0) => {
      for (let k = 0; k * 3 < len; k++) {
        const t = k * 3 / len, ww = w * (1 - t * .55) * (.55 + .45 * Math.abs(Math.sin(k * 1.7 + x))), a = a0 * (1 - t);
        c.fillStyle = `rgba(${col},${a.toFixed(3)})`; c.fillRect(x - ww / 2 + Math.sin(k * 2.3 + x) * 1.6, y0 + k * 3, ww, 1.6);
      }
    };
    A.lampRefl = (() => { const cv = mk(18, 64), c = cv.getContext('2d'); reflStreak(c, 9, 2, 58, 12, '255,205,120', .5); return cv; })();
    A.platePatch = (() => {
      const cv = mk(124, 76), c = cv.getContext('2d');
      frect(c, 0, 2, 124, 74, 'rgba(4,8,14,.4)'); c.fillStyle = A.platePat; c.fillRect(2, 2, 120, 70);
      frect(c, 2, 2, 120, 70, 'rgba(14,20,28,.28)'); frect(c, 2, 2, 120, 2, 'rgba(200,214,228,.3)');
      c.fillStyle = '#9aa6b2'; for (const [x, y] of [[6, 6], [114, 6], [6, 64], [114, 64], [60, 6], [60, 64]]) c.fillRect(x, y, 3, 3);
      srect(c, 2, 2, 120, 70, '#12161b', 1.6); return cv;
    })();
    A.channel = (() => {
      const cv = mk(170, 20), c = cv.getContext('2d');
      frect(c, 0, 0, 170, 20, '#1b2026'); frect(c, 3, 3, 164, 14, '#0c0f13');
      for (let x = 6; x < 166; x += 6) frect(c, x, 4, 2.4, 12, '#56616c');
      frect(c, 3, 3, 164, 2, 'rgba(190,205,220,.3)'); for (let x = 10; x < 160; x += 37) frect(c, x, 9, 14, 2, 'rgba(150,180,210,.35)');
      return cv;
    })();
    const houseRefl = (w, lamps) => {
      const cv = mk(w + 20, 72), c = cv.getContext('2d');
      for (let i = 0; i < 7; i++) frect(c, 10, i * 9, w, 9, `rgba(8,14,24,${(.2 - i * .028).toFixed(3)})`);
      for (let x = 16; x < w; x += 37) reflStreak(c, 10 + x, 2, 36, 5, '160,185,210', .16);
      for (const [lx, ly] of lamps) { if (ly < 150) continue; reflStreak(c, 10 + lx, 2, 60, 14, '255,205,120', .42); }
      return cv;
    };

    foots.length = 0; objs.length = 0; lanternsLocal.length = 0; DEC.length = 0; PUD.length = 0;
    const addFoot = f => { foots.push(f); return foots.length - 1; };
    const addLamp = (x, y) => lanternsLocal.push({ x: Math.round(x), y: Math.round(y) });
    const WALL = { solid: true, roof: '#3a434d', wall: '#2a3139' };

    // ---- perimeter: one solid footprint per cell, tiles rendered once per kind and reused
    const tiles = {};
    const tile = (key, make) => tiles[key] || (tiles[key] = make());
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      if (cx > 0 && cx < NC - 1 && cy > 0 && cy < NC - 1) continue;
      const gx = cx * BLOCK, gy = cy * BLOCK;
      if (cx === 3 && cy === 0) {   // gate: decorative only, no footprint
        const t = tile('gate', () => renderRegion(1530, -170, 2110, 440, drawGate));
        objs.push({ img: t.cv, x: t.x0, y: t.y0, w: t.cv.width, h: t.cv.height, by: N_BASE, fi: -1 });
        for (const [lx, ly] of [[1716, 112], [1924, 112], [1718, -82], [1922, -82]]) addLamp(lx, ly);
        continue;
      }
      let f, t, rep, by;
      const corner = (cx === 0 || cx === NC - 1) && (cy === 0 || cy === NC - 1);
      if (corner) {
        f = { x: gx, y: gy, w: BLOCK, h: BLOCK };
        const north = cy === 0, west = cx === 0;
        const tcx = west ? 236 : SIZE - 236, base = north ? 214 : 3384, h = north ? 240 : 270;
        let lamps = [];
        t = tile('c' + cx + cy, () => renderRegion(west ? -170 : gx - 90, north ? -170 : gy - 260, west ? gx + BLOCK + 90 : SIZE + 170, north ? gy + BLOCK + 40 : SIZE + 170, c => {
          drawLake(c, west ? -170 : gx, west ? BLOCK : SIZE + 170, north ? -170 : gy, north ? BLOCK : SIZE + 170);
          if (north) drawNorthWall(c, gx, gx + BLOCK, 0);
          if (west) drawWestWall(c, gy, gy + BLOCK, 0); else drawEastWall(c, gy, gy + BLOCK, 0);
          if (!north) drawSouthWall(c, gx, gx + BLOCK, 0);
          lamps = cornerTower(c, tcx, base, h, 900 + cx + cy);
        }));
        rep = [gx, gy]; by = north ? BLOCK : SIZE + 1;
        for (const [lx, ly] of (t.lamps || (t.lamps = lamps))) addLamp(lx, ly);
      } else if (cy === 0 || cy === NC - 1) {
        const north = cy === 0, v = cx % 2 === 0 ? 1 : 2, rcx = v === 1 ? 2 : 1;
        f = north ? { x: gx, y: 0, w: BLOCK, h: 400 } : { x: gx, y: 3240, w: BLOCK, h: 400 };
        t = tile((north ? 'N' : 'S') + v, () => renderRegion(rcx * BLOCK, north ? -170 : 3150, rcx * BLOCK + BLOCK, north ? 440 : SIZE + 170, c => {
          drawLake(c, rcx * BLOCK, rcx * BLOCK + BLOCK, north ? -170 : 3150, north ? 440 : SIZE + 170);
          if (north) drawNorthWall(c, rcx * BLOCK, rcx * BLOCK + BLOCK, v); else drawSouthWall(c, rcx * BLOCK, rcx * BLOCK + BLOCK, v);
        }));
        rep = [rcx * BLOCK, gy]; by = north ? N_BASE : SIZE;
        if (north) addLamp(gx + 404, N_FACE + 27); else addLamp(gx + 404, S_FACE + 27);
      } else {
        const west = cx === 0, v = cy % 2 === 0 ? 1 : 2, rcy = v === 1 ? 2 : 1;
        f = west ? { x: 0, y: gy, w: 400, h: BLOCK } : { x: 3240, y: gy, w: 400, h: BLOCK };
        t = tile((west ? 'W' : 'E') + v, () => renderRegion(west ? -170 : 3200, rcy * BLOCK, west ? 440 : SIZE + 170, rcy * BLOCK + BLOCK, c => {
          drawLake(c, west ? -170 : 3200, west ? 440 : SIZE + 170, rcy * BLOCK, rcy * BLOCK + BLOCK);
          if (west) drawWestWall(c, rcy * BLOCK, rcy * BLOCK + BLOCK, v); else drawEastWall(c, rcy * BLOCK, rcy * BLOCK + BLOCK, v);
        }));
        rep = [gx, rcy * BLOCK]; by = gy + BLOCK;
        if (v === 1) addLamp(west ? 236 : 3406, gy + 250);
      }
      Object.assign(f, WALL);
      const fi = addFoot(f);
      objs.push({ img: t.cv, x: t.x0 + gx - rep[0], y: t.y0 + gy - rep[1], w: t.cv.width, h: t.cv.height, by, fi, solid: true });
    }

    // ---- Pain's tower
    {
      const P = { lamps: [], wl: 0 };
      const cv = canvasFor(lmPain, P, TOWER.w, TOWER.h, TSM, TOVER);
      const fi = addFoot({ x: TOWER.x, y: TOWER.y, w: TOWER.w, h: TOWER.h, roof: '#6b5a7e', wall: '#58606b' });
      objs.push({ img: cv, x: TOWER.x - TSM, y: TOWER.y - TOVER, w: cv.width, h: cv.height, by: TOWER.y + TOWER.h, fi });
      for (const [lx, ly] of P.lamps) addLamp(TOWER.x + lx, TOWER.y + ly);
      DEC.push({ img: houseRefl(TOWER.w, P.lamps.concat([[220, 380], [300, 300], [140, 300]])), x: TOWER.x - 10, y: TOWER.y + TOWER.h + 2, fi });
    }

    // ---- houses (one cached canvas per variant key)
    const cache = {}, hfi = [];
    HOUSES.forEach(([key, x, y], idx) => {
      const v = VAR[key], pal = PAL[v[1]];
      if (!cache[key]) {
        const P = { T: toneA(pal.T), T2: toneA(pal.T2), rust: pal.rust, rust2: pal.rust2, pipe: pal.pipe, pipe2: pal.pipe2, cloth: pal.cloth, awn: pal.awn,
          seed: 1000 + Object.keys(cache).length * 97, lamps: [], wl: 0 };
        cache[key] = { cv: canvasFor(v[0], P, v[2], v[3], SM, OVER), P, roof: mix(pal.T, '#a8b6c4', .3), wall: pal.T };
        cache[key].refl = houseRefl(v[2], P.lamps);
      }
      const e = cache[key];
      DEC.push({ img: e.refl, x: x - 10, y: y + v[3] + 2, fi: foots.length });
      const fi = addFoot({ x, y, w: v[2], h: v[3], roof: e.roof, wall: e.wall });
      hfi[idx] = { fi, x, y, w: v[2], h: v[3], port: e.P.port };
      objs.push({ img: e.cv, x: x - SM, y: y - OVER, w: e.cv.width, h: e.cv.height, by: y + v[3], fi });
      for (const [lx, ly] of e.P.lamps) addLamp(x + lx, y + ly);
    });

    // ---- tangled overhead pipes and cables between neighbouring towers
    for (const [ia, ib, extra] of LINKS) {
      const a = hfi[ia], b = hfi[ib];
      const x1 = a.x + a.port.r[0], y1 = a.y + a.port.r[1], x2 = b.x + b.port.l[0], y2 = b.y + b.port.l[1];
      const X0 = Math.min(x1, x2) - 20, Y0 = Math.min(y1, y2) - 30, X1 = Math.max(x1, x2) + 20, Y1 = Math.max(y1, y2) + 120;
      const t = renderRegion(X0, Y0, X1, Y1, c => {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        c.strokeStyle = 'rgba(20,24,30,.85)'; c.lineWidth = 1.3; c.beginPath();
        for (const s of [22, 38, 56]) { c.moveTo(x1, y1 + 6); c.quadraticCurveTo(mx, my + s * 1.6, x2, y2 + 6); }
        c.stroke();
        pipe(c, [x1, y1, x1 + 16, y1, x2 - 16, y2, x2, y2], 10, '#66717c');
        pipe(c, [x1, y1 + 16, x1 + 26, y1 + 16, x2 - 26, y2 + 18, x2, y2 + 18], 6, '#7a5a46');
        for (const [px, py] of [[x1, y1], [x2, y2], [x1, y1 + 16], [x2, y2 + 18]]) { fell(c, px, py, 6, 7, '#2a3139'); c.beginPath(); c.ellipse(px, py, 6, 7, 0, 0, TAU); sk(c, OUT, 1); }
        drips(c, Math.min(x1, x2) + 30, (y1 + y2) / 2 + 8, Math.abs(x2 - x1) - 60, 8, ia * 13 + ib);
        if (extra === 'banner') { const bx = mx - 16, byy = my + 6; bannerRain(c, bx, byy, 32, 92, '#2c3644'); chochin(c, mx - 60, my + 40, 1); chochin(c, mx + 60, my + 40, 1); }
      });
      objs.push({ img: t.cv, x: t.x0, y: t.y0, w: t.cv.width, h: t.cv.height, by: Math.max(a.y + a.h, b.y + b.h) + 2, fi: -1, deps: [a.fi, b.fi] });
      if (extra === 'banner') { addLamp((x1 + x2) / 2 - 60, (y1 + y2) / 2 + 40); addLamp((x1 + x2) / 2 + 60, (y1 + y2) / 2 + 40); }
    }

    // ---- props
    const PR = A.props, taken = [];
    const houseShadow = (x, y, m) => { for (const f of foots) if (!f.solid && x > f.x - m && x < f.x + f.w + m && y > f.y - 70 && y < f.y + f.h + m + 8) return true; return false; };
    const free = (x, y, m) => {
      if (x < 430 || x > 3210 || y < 440 || y > 3232) return false;
      if (inEll(x, y, PLAZA, m * .6)) return false;
      if (inRect(x, y, BASIN, m)) return false;
      if (x > TOWER.x - 60 && x < TOWER.x + TOWER.w + 60 && y > TOWER.y - 640 && y < TOWER.y + TOWER.h + m) return false;
      if (houseShadow(x, y, m)) return false;
      for (const t of taken) if (Math.hypot(t[0] - x, t[1] - y) < t[2] + m) return false;
      return true;
    };
    const blocked = (x, y, m) => { if (!free(x, y, m)) return true; for (const s of STREETS) if (inRect(x, y, s, m)) return true; return false; };
    const place = (s, x, y, m, lamp) => {
      taken.push([x, y, m]);
      objs.push({ img: s.cv, x: Math.round(x - s.ax), y: Math.round(y - s.ay), w: s.cv.width, h: s.cv.height, by: y, fi: -1 });
      if (lamp) {
        addLamp(x + lamp[0], y + lamp[1]);
        for (const dx of s === PR.lamp2 ? [-24, 24] : [lamp[0]]) DEC.push({ img: A.lampRefl, x: Math.round(x + dx - 9), y: Math.round(y + 3) });
      }
    };
    const tryPlace = (s, x, y, m, lamp) => { if (!blocked(x, y, m)) { place(s, x, y, m, lamp); return true; } return false; };
    // gate avenue: lamps on both kerbs, rain banners
    for (let y = 560, i = 0; y < 1000; y += 210, i++) {
      place(PR.lamp, 1700, y, 18, [22, -98]); place(PR.lamp, 1946, y + 105, 18, [22, -98]);
    }
    place(PR.banner[0], 1690, 880, 16); place(PR.banner[1], 1956, 600, 16);
    place(PR.pipeRunV, 2010, 830, 30);
    // plaza: lamps round the rim, banners & paper flowers before the tower, benches
    for (const deg of [200, 160, 20, -20, 120, 60]) {
      const a = deg * Math.PI / 180, x = PLAZA.x + (PLAZA.rx + 30) * Math.cos(a), y = PLAZA.y + (PLAZA.ry + 22) * Math.sin(a);
      place(deg === 120 || deg === 60 ? PR.lamp2 : PR.lamp, x, y, 24, deg === 120 || deg === 60 ? [0, -126] : [22, -98]);
    }
    place(PR.banner[1], 1652, 2040, 14); place(PR.banner[1], 1988, 2040, 14);
    place(PR.planter, 1560, 2130, 24); place(PR.planter, 2080, 2130, 24);
    place(PR.bench, 1450, 1980, 24); place(PR.bench, 2190, 1980, 24);
    place(PR.flowers, 1720, 2210, 12); place(PR.flowers, 1922, 2216, 12);
    // tank yard (2,2)
    place(PR.bigTank, 1230, 1330, 80); place(PR.bigTank, 1440, 1480, 80);
    place(PR.pipeRun, 1330, 1530, 40); place(PR.valve, 1160, 1480, 26); place(PR.gas, 1500, 1260, 22);
    place(PR.barrels, 1150, 1210, 24); place(PR.waterTower, 1450, 1200, 40);
    // reservoir basin (1,4): ground art + rim props
    place(PR.lamp, BASIN.x - 6, BASIN.y + BASIN.h + 20, 18, [22, -98]); place(PR.lamp, BASIN.x + BASIN.w - 20, BASIN.y + BASIN.h + 20, 18, [22, -98]);
    place(PR.valve, BASIN.x + BASIN.w / 2, BASIN.y + BASIN.h + 26, 20);
    // market street (3,5)
    for (let i = 0; i < 3; i++) {
      const y = 2760 + i * 150;
      place(PR.stalls[i % 4], 1650, y, 50, [-46, -70]); place(PR.stalls[(i + 1) % 4 + (i === 2 ? 0 : 0)], 1992, y + 40, 50, [-46, -70]);
    }
    place(PR.sign, 1712, 2690, 14, [18, -60]); place(PR.umbrellas, 1934, 2700, 18);
    place(PR.lamp2, 1720, 3170, 20, [0, -126]); place(PR.lamp2, 1924, 3120, 20, [0, -126]);
    // Konan's memorial park (5,5)
    place(PR.shrine, 2880, 2900, 70, [-48, -38]);
    place(PR.trees[0], 2730, 2770, 40); place(PR.trees[1], 3040, 2780, 40); place(PR.trees[2], 2750, 3070, 40); place(PR.trees[0], 3060, 3080, 40);
    place(PR.bench, 2780, 2960, 24); place(PR.bench, 2990, 2990, 24);
    place(PR.planter, 2880, 3040, 24); place(PR.flowers, 2820, 2840, 10); place(PR.flowers, 2960, 2820, 10); place(PR.flowers, 2940, 3100, 10);
    place(PR.lamp, 2700, 2900, 18, [22, -98]); place(PR.lamp, 3070, 2930, 18, [22, -98]);
    // plaza flanks (2,3) & (4,3)
    place(PR.waterTower, 1200, 1820, 40); place(PR.crates, 1290, 1700, 24); place(PR.barrels, 1300, 1930, 24); place(PR.vent, 1130, 1660, 18);
    place(PR.scrap, 2420, 1720, 34); place(PR.gas, 2330, 1900, 22); place(PR.vent, 2480, 1980, 18); place(PR.pipeRun, 2380, 2060, 40);
    // pipe runs and drums along the lanes under the walls
    for (const [x, y] of [[470, 1560], [470, 2420], [3190, 900], [3190, 2000], [3190, 3000]]) tryPlace(PR.pipeRunV, x, y, 30);
    for (const [x, y] of [[700, 480], [1300, 470], [2350, 480], [2900, 470], [520, 3200], [1300, 3200], [2400, 3200], [3000, 3190]]) tryPlace(hash2(x, y, 2) < .5 ? PR.barrels : PR.crates, x, y, 26);
    for (const [x, y] of [[880, 3190], [2200, 3200], [3100, 470], [560, 470]]) tryPlace(PR.pipeRun, x, y, 40);
    // street lamps along the cross streets
    for (const s of STREETS.slice(2)) {
      const horiz = s.w > s.h;
      for (let k = 0, p = (horiz ? s.x : s.y) + 150; p < (horiz ? s.x + s.w : s.y + s.h) - 100; p += 270, k++) {
        const x = horiz ? p : (k % 2 ? s.x - 16 : s.x + s.w + 18), y = horiz ? (k % 2 ? s.y - 8 : s.y + s.h + 16) : p;
        if (free(x, y, 22) && !STREETS.some(o => o !== s && inRect(x, y, o, 10))) place(PR.lamp, x, y, 22, [22, -98]);
      }
    }
    // clutter in the lanes and corners
    {
      const R = rng(4242), list = [PR.barrels, PR.crates, PR.gas, PR.vent, PR.scrap, PR.barrels, PR.crates, PR.pipeRun, PR.valve, PR.trees[1], PR.banner[0]];
      for (let i = 0; i < 500 && taken.length < 240; i++) {
        const s = list[Math.floor(R() * list.length)], x = 440 + R() * 2760, y = 460 + R() * 2760, m = Math.max(22, s.cv.width * .38);
        tryPlace(s, x, y, m);
      }
    }
    // ---- ground decals
    {
      const R = rng(777), onFoot = (x, y, m) => foots.some(f => inRect(x, y, f, m));
      for (let i = 0; i < 260 && PUD.length < 80; i++) {
        const k = Math.floor(R() * 5), pd = A.puddles[k], x = 450 + R() * 2740, y = 450 + R() * 2760;
        if (onFoot(x, y, pd.rx + 8) || inEll(x, y, { x: PLAZA.x, y: PLAZA.y, rx: 150, ry: 150 }, 0) || inRect(x, y, BASIN, pd.rx)) continue;
        if (PUD.some(p => Math.hypot(p.x - x, p.y - y) < p.rx + pd.rx + 20)) continue;
        DEC.push({ img: pd.cv, x: Math.round(x - pd.cv.width / 2), y: Math.round(y - pd.cv.height / 2) });
        PUD.push({ x, y, rx: pd.rx, ry: pd.ry, rr: Math.min(pd.rx * .45, 26), n: pd.rx > 50 ? 3 : 2, h: R() });
      }
      // a big puddle in front of the gate and around the plaza
      for (const [x, y, k] of [[1790, 520, 3], [1500, 1700, 5], [2140, 2120, 2], [1900, 2400, 3]]) {
        const pd = A.puddles[k]; DEC.push({ img: pd.cv, x: Math.round(x - pd.cv.width / 2), y: Math.round(y - pd.cv.height / 2) }); PUD.push({ x, y, rx: pd.rx, ry: pd.ry, rr: Math.min(pd.rx * .45, 30), n: 3, h: hash2(x, y, 1) });
      }
      for (const s of STREETS) {
        const horiz = s.w > s.h;
        for (let p = (horiz ? s.x : s.y) + 90; p < (horiz ? s.x + s.w : s.y + s.h) - 40; p += 230) {
          if (horiz) { DEC.push({ img: A.grate, x: p - 24, y: s.y + 4 }); DEC.push({ img: A.grate, x: p + 90, y: s.y + s.h - 26 }); }
          else { DEC.push({ img: A.grate, x: s.x + 4, y: p - 11 }); }
        }
      }
      for (const [x, y] of [[1040, 1040], [2600, 1040], [1040, 2600], [2600, 2600], [1820, 760], [1820, 2900], [1820, 2600]]) DEC.push({ img: A.manhole, x: x - 20, y: y - 11 });
      for (let i = 0; i < 30; i++) { const x = 450 + R() * 2740, y = 450 + R() * 2760; if (!onFoot(x, y, 40)) DEC.push({ img: A.stain, x: Math.round(x - 35), y: Math.round(y - 17) }); }
      // steel floor plates and drainage channels let into the paving
      const offStreet = (x, y, m) => !STREETS.some(s => inRect(x, y, s, m)) && !inEll(x, y, PLAZA, m);
      for (let i = 0, n = 0; i < 200 && n < 22; i++) {
        const x = 450 + R() * 2740, y = 450 + R() * 2760, img = n % 3 === 2 ? A.channel : A.platePatch;
        if (onFoot(x, y, 90) || !offStreet(x, y, 80) || inRect(x, y, BASIN, 90) || PUD.some(p => Math.hypot(p.x - x, p.y - y) < p.rx + 90)) continue;
        DEC.unshift({ img, x: Math.round(x - img.width / 2), y: Math.round(y - img.height / 2) }); n++;
      }
      for (const [dx, dy] of [[90, 80], [250, 150], [160, 220]]) PUD.push({ x: BASIN.x + dx, y: BASIN.y + dy, rx: 60, ry: 24, rr: 30, n: 3, h: dx / 300 });
    }
    objs.sort((p, q) => p.by - q.by || p.x - q.x);
    ready = true;
  }

  // ------------------------------------------------------------------ drawing
  function paths(ctx, x0, y0, x1, y1, dz) {
    const hit = r => r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0;
    for (const s of STREETS) if (hit({ x: s.x - 8, y: s.y - 8, w: s.w + 16, h: s.h + 16 })) {
      ctx.fillStyle = '#1f252c'; ctx.fillRect(s.x - 7, s.y - 7, s.w + 14, s.h + 14);
      ctx.fillStyle = '#6d7883'; ctx.fillRect(s.x - 5, s.y - 5, s.w + 10, s.h + 10);
      ctx.fillStyle = '#97a3ae'; ctx.fillRect(s.x - 5, s.y - 5, s.w + 10, 2); ctx.fillRect(s.x - 5, s.y - 5, 2, s.h + 10);
    }
    ctx.fillStyle = A.roadPat;
    for (const s of STREETS) if (hit(s)) ctx.fillRect(s.x, s.y, s.w, s.h);
    for (const s of STREETS) if (hit(s)) {     // gutters with running water
      const v = s.w < s.h;
      ctx.fillStyle = 'rgba(8,12,18,.55)'; if (v) { ctx.fillRect(s.x, s.y, 5, s.h); ctx.fillRect(s.x + s.w - 5, s.y, 5, s.h); } else { ctx.fillRect(s.x, s.y, s.w, 5); ctx.fillRect(s.x, s.y + s.h - 5, s.w, 5); }
      ctx.fillStyle = 'rgba(150,180,210,.35)'; if (v) { ctx.fillRect(s.x + 2, s.y, 1.5, s.h); ctx.fillRect(s.x + s.w - 3, s.y, 1.5, s.h); } else { ctx.fillRect(s.x, s.y + 2, s.w, 1.5); ctx.fillRect(s.x, s.y + s.h - 3, s.w, 1.5); }
    }
    { const w = A.plaza.width, h = A.plaza.height, r = { x: PLAZA.x - w / 2, y: PLAZA.y - h / 2, w, h }; if (hit(r)) ctx.drawImage(A.plaza, r.x, r.y); }
    // reservoir basin
    const B = BASIN;
    if (hit({ x: B.x - 20, y: B.y - 20, w: B.w + 50, h: B.h + 50 })) {
      ctx.fillStyle = 'rgba(4,8,14,.4)'; ctx.fillRect(B.x - 8, B.y - 4, B.w + 26, B.h + 24);
      ctx.fillStyle = '#5d6772'; ctx.fillRect(B.x - 12, B.y - 12, B.w + 24, B.h + 24);
      ctx.fillStyle = '#7a8591'; ctx.fillRect(B.x - 12, B.y - 12, B.w + 24, 4); ctx.fillRect(B.x - 12, B.y - 12, 4, B.h + 24);
      ctx.fillStyle = A.lakePat; ctx.fillRect(B.x, B.y, B.w, B.h);
      ctx.fillStyle = '#2f3740'; ctx.fillRect(B.x, B.y, B.w, 16);
      ctx.fillStyle = 'rgba(4,8,14,.35)'; ctx.fillRect(B.x, B.y + 16, B.w, 10); ctx.fillRect(B.x, B.y, 10, B.h);
      ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(B.x - 12, B.y - 12, B.w + 24, B.h + 24); ctx.strokeRect(B.x, B.y, B.w, B.h);
      for (const u of [.25, .7]) {      // outfall pipes pouring into the basin
        const x = B.x + B.w * u;
        ctx.fillStyle = '#20262d'; ctx.fillRect(x - 10, B.y + 2, 20, 12);
        ctx.fillStyle = 'rgba(170,200,226,.55)'; ctx.fillRect(x - 4, B.y + 12, 8, 26); ctx.fillStyle = 'rgba(230,240,250,.7)'; ctx.fillRect(x - 1, B.y + 12, 2, 26);
        ctx.beginPath(); ctx.ellipse(x, B.y + 40, 18, 6, 0, 0, TAU); ctx.strokeStyle = 'rgba(210,225,240,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    for (let i = 0; i < DEC.length; i++) {
      const d = DEC[i];
      if (d.x < x1 && d.x + d.img.width > x0 && d.y < y1 && d.y + d.img.height > y0 && !(dz && d.fi !== undefined && dz(d.fi))) ctx.drawImage(d.img, d.x, d.y);
    }
  }

  function drawStatic(ctx, bounds, isDestroyed) {
    if (!ready) build();
    const x0 = bounds.x, y0 = bounds.y, x1 = bounds.x + bounds.w, y1 = bounds.y + bounds.h;
    if (x1 < -170 || x0 > SIZE + 170 || y1 < -170 || y0 > SIZE + 170) return;
    const dz = typeof isDestroyed === 'function' ? isDestroyed : null;
    ctx.save();
    const ix0 = Math.max(0, x0), iy0 = Math.max(0, y0), ix1 = Math.min(SIZE, x1), iy1 = Math.min(SIZE, y1);
    if (ix1 > ix0 && iy1 > iy0) {
      ctx.fillStyle = A.groundPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      paths(ctx, ix0, iy0, ix1, iy1, dz);
    }
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (o.x > x1 || o.x + o.w < x0 || o.y > y1 || o.y + o.h < y0) continue;
      if (dz) {
        if (o.fi >= 0 && dz(o.fi)) continue;
        if (o.deps && (dz(o.deps[0]) || dz(o.deps[1]))) continue;
      }
      ctx.drawImage(o.img, o.x, o.y);
    }
    ctx.restore();
  }

  // Calls cb(x0,y0,x1,y1) for rects covering (view ∩ village-inside-the-shore): the square, then 16 px strips out
  // to just inside the shore silhouette on each side, with rounded corners.
  function edgeRects(vx0, vy0, vx1, vy1, cb, st = 16) {
    const ix0 = Math.max(vx0, 0), iy0 = Math.max(vy0, 0), ix1 = Math.min(vx1, SIZE), iy1 = Math.min(vy1, SIZE);
    if (ix1 > ix0 && iy1 > iy0) cb(ix0, iy0, ix1, iy1);
    const cr = k => Math.min(dOut(CORNERS[k].s0, CORNERS[k].u0), dOut(CORNERS[k].s1, CORNERS[k].u1)) - 8;
    const cExt = (k, dx) => { const r = cr(k); return dx >= r ? 0 : Math.sqrt(r * r - dx * dx); };
    const hExt = (si, kl, kr, x) => x < 0 ? cExt(kl, -x) : x > SIZE ? cExt(kr, x - SIZE) : dOut(si, x) - 6;
    const hx0 = Math.max(vx0, -150), hx1 = Math.min(vx1, SIZE + 150);
    if (vy0 < 0) for (let x = hx0; x < hx1; x += st) { const e = hExt(0, 3, 0, x + st / 2), y0 = Math.max(vy0, -e), y1 = Math.min(vy1, 0); if (y1 > y0) cb(x, y0, Math.min(x + st, hx1), y1); }
    if (vy1 > SIZE) for (let x = hx0; x < hx1; x += st) { const e = hExt(2, 2, 1, x + st / 2), y0 = Math.max(vy0, SIZE), y1 = Math.min(vy1, SIZE + e); if (y1 > y0) cb(x, y0, Math.min(x + st, hx1), y1); }
    if (vx0 < 0) for (let y = iy0; y < iy1; y += st) { const e = dOut(3, y + st / 2) - 6, x0 = Math.max(vx0, -e), x1 = Math.min(vx1, 0); if (x1 > x0) cb(x0, y, x1, Math.min(y + st, iy1)); }
    if (vx1 > SIZE) for (let y = iy0; y < iy1; y += st) { const e = dOut(1, y + st / 2) - 6, x0 = Math.max(vx0, SIZE), x1 = Math.min(vx1, SIZE + e); if (x1 > x0) cb(x0, y, x1, Math.min(y + st, iy1)); }
  }
  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    const t = time || 0;
    const vx0 = Math.max(view.x, -150), vy0 = Math.max(view.y, -150), vx1 = Math.min(view.x + view.w, SIZE + 150), vy1 = Math.min(view.y + view.h, SIZE + 150);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    const vw = vx1 - vx0, vh = vy1 - vy0;
    ctx.save();
    // ripple rings in puddles: pre-rendered ring sprites (3 sizes x 10 fade steps), scaled per ring
    for (let i = 0; i < PUD.length; i++) {
      const p = PUD[i];
      if (p.x + p.rx < vx0 || p.x - p.rx > vx1 || p.y + p.ry < vy0 || p.y - p.ry > vy1) continue;
      for (let j = 0; j < p.n; j++) {
        const u = t * .75 + p.h * 5 + j / p.n, n = Math.floor(u), ph = u - n;
        const cx = p.x + (hash2(i, n * 3 + j, 6) - .5) * p.rx * .9, cy = p.y + (hash2(i, n * 3 + j, 7) - .5) * p.ry * .7, r = 2 + ph * p.rr;
        const set = r <= 8 ? 0 : r <= 16 ? 1 : 2, img = A.rings[set][Math.min(9, Math.floor(ph * 10))], s = r / RING_R[set];
        const dw = img.width * s, dh = img.height * s;
        ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      }
    }
    // rain splashes on the ground (world grid, pure function of time)
    {
      const G = 96, gx0 = Math.floor(Math.max(vx0, 0) / G), gx1 = Math.ceil(Math.min(vx1, SIZE) / G), gy0 = Math.floor(Math.max(vy0, 0) / G), gy1 = Math.ceil(Math.min(vy1, SIZE) / G);
      for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
        const u = t * 1.9 + hash2(gx, gy, 41) * 7, n = Math.floor(u), ph = u - n;
        if (ph > .3) continue;
        const img = A.splash[Math.min(3, Math.floor(ph * 13.4))];
        ctx.drawImage(img, Math.round(gx * G + hash2(gx * 7 + n, gy, 42) * G - img.width / 2), Math.round(gy * G + hash2(gx, gy * 7 + n, 43) * G - img.height + 4));
      }
    }
    // heavy slanted rain: one pre-rendered 512 px tile (fine + heavy streaks) blitted with a time offset along the
    // streak direction, cropped to the square plus 16 px strips that follow the organic shore silhouette
    // (no clip path, no straight seam over the wilderness)
    {
      const img = A.rain, S = img.width, f = t * 940, ox = mod(-f * SLANT, S), oy = mod(f, S);
      edgeRects(vx0, vy0, vx1, vy1, (X0, Y0, X1, Y1) => {
        const x0 = X0 - mod(X0 - ox, S), y0 = Y0 - mod(Y0 - oy, S);
        for (let y = y0; y < Y1; y += S) for (let x = x0; x < X1; x += S) {
          const sx = Math.max(0, X0 - x), sy = Math.max(0, Y0 - y), sw = Math.min(S, X1 - x) - sx, sh = Math.min(S, Y1 - y) - sy;
          if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, x + sx, y + sy, sw, sh);
        }
      });
    }
    // occasional lightning: a double flash at a hashed moment of each 9 s cycle
    {
      const P = 9, k = Math.floor(t / P), d = t - k * P - (1 + hash2(k, 7, 77) * 6);
      let a = 0;
      if (hash2(k, 8, 77) > .3 && d >= 0) a = d < .08 ? .34 : d < .16 ? .06 : d < .26 ? .24 : d < .9 ? .1 * (1 - (d - .26) / .64) : 0;
      if (a > .005) { ctx.fillStyle = 'rgba(205,218,255,' + a.toFixed(3) + ')'; edgeRects(vx0, vy0, vx1, vy1, (X0, Y0, X1, Y1) => ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0), 6); }
    }
    ctx.restore();
  }

  function drawMinimap(ctx) {
    if (!ready) build();
    ctx.save();
    ctx.fillStyle = '#4f6274'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#3b444d'; ctx.fillRect(W_BASE, N_BASE, E_BASE - W_BASE, S_TOP - N_BASE);
    ctx.fillStyle = '#66717c'; for (const s of STREETS) ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillRect(GATE.x0, 0, GATE.x1 - GATE.x0, N_BASE);
    ctx.fillStyle = '#56616c'; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4f6274'; ctx.fillRect(BASIN.x, BASIN.y, BASIN.w, BASIN.h);
    ctx.fillStyle = '#7d8a96'; ctx.fillRect(1240, 1200, 200, 200);
    for (const f of foots) {
      if (f.solid) { ctx.fillStyle = '#20262d'; ctx.fillRect(f.x, f.y, f.w, f.h); ctx.fillStyle = '#4f6274'; continue; }
      if (f.x === TOWER.x && f.y === TOWER.y) continue;
      ctx.fillStyle = f.roof; ctx.fillRect(f.x + 16, f.y + 16, f.w - 32, f.h - 32);
      ctx.strokeStyle = '#11151a'; ctx.lineWidth = 14; ctx.strokeRect(f.x + 16, f.y + 16, f.w - 32, f.h - 32);
    }
    // lake ring outside the walls
    ctx.fillStyle = '#4f6274'; ctx.fillRect(0, 0, SIZE, 100); ctx.fillRect(0, SIZE - 100, SIZE, 100); ctx.fillRect(0, 0, 100, SIZE); ctx.fillRect(SIZE - 100, 0, 100, SIZE);
    ctx.fillStyle = '#66717c'; ctx.fillRect(GATE.x0, 0, GATE.x1 - GATE.x0, N_BASE);
    ctx.fillStyle = '#6b5a7e'; ctx.fillRect(TOWER.x, TOWER.y, TOWER.w, TOWER.h);
    ctx.strokeStyle = '#e0b24a'; ctx.lineWidth = 40; ctx.strokeRect(TOWER.x, TOWER.y, TOWER.w, TOWER.h);
    ctx.fillStyle = '#d8dfe8'; for (let i = 0; i < 4; i++) ctx.fillRect(TOWER.x + 130 + i * 50, TOWER.y + 110, 22, 190);
    ctx.restore();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  const modl = window.ShinobiVillages.ame = {
    id: 'ame', name: 'LÀNG MƯA', jp: '雨隠れの里', kage: 'PAIN',
    cols: NC, rows: NC,
    gate: { side: 'n', at: 1820 },
    spawn: { x: SPAWN.x, y: SPAWN.y },
    lanterns: [],
    init() {
      if (!ready) build();
      modl.lanterns.length = 0;
      for (const l of lanternsLocal) modl.lanterns.push({ x: l.x, y: l.y });
    },
    footprints() { if (!ready) build(); return foots.map(f => ({ ...f })); },
    drawStatic, drawAmbient, drawMinimap
  };
})();
