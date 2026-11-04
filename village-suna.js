/* village-suna.js — Sunagakure no Sato (Hidden Sand Village, Land of Wind).
   Registers window.ShinobiVillages.suna. Procedural Canvas 2D in the same 3/4 oblique, cel-shaded style as
   konoha-world.js (light from the top-left, dark outlines, cached sprites). No external images. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, NC = 10, SIZE = BLOCK * NC;
  const OUT = '#3b2a22';
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const SM = 26, OVER = 84, BM = 22;           // building canvas margins: sides / above the footprint / below
  const FW = 340, FH = 320;                     // house footprint
  const KW = 420, KH = 400;                     // Kazekage footprint
  const GN = 2510, GS = 2690;                   // canyon gate: north wall ends / south wall starts (local y)
  const PLAZA = { x: 2340, y: 2850, rx: 360, ry: 262 };
  const SPAWN = { x: 2340, y: 2872 };
  const KAZE = { x: 2130, y: 2090, w: KW, h: KH };
  const AVENUE = { x: 2340, y: 2525, w: 2860, h: 150 };
  const APRON = { x: 2236, y: 2484, w: 208, h: 140 };
  const STREETS = [
    { x: 1505, y: 400, w: 110, h: 4400 }, { x: 3585, y: 400, w: 110, h: 4400 },
    { x: 400, y: 1505, w: 4400, h: 110 }, { x: 400, y: 3585, w: 4400, h: 110 }
  ];

  const SAND = { base: '#e2c08a', light: '#efd5a4', dark: '#cda46a', deep: '#b58a55' };
  const CL = { top: '#d9af77', topL: '#eed5a3', topD: '#b98a54', face: '#c99560', faceL: '#e2b77c', faceD: '#a5703f', deep: '#86562d', line: '#55341c' };
  const WOOD = { base: '#8b5a36', light: '#b07a4a', dark: '#64402a', deep: '#45301f' };

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
  // warm tone ramp: shadows go brown, not purple
  function toneW(base) { return { base, light: mix(base, '#fff4dc', .34), hi: mix(base, '#fffaf0', .6), dark: mix(base, '#7a3f1c', .26), deep: mix(base, '#45210f', .5) }; }
  // smooth periodic wobble (period = one block), range [0,1]
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
  function pathFrom(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; }
  function txt(c, s, x, y, size, col, o = {}) {
    c.font = `${o.weight || '700'} ${size}px ${o.font || MINCHO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 3; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  // Cel shading: base fill, light rim upper-left, dark rim lower-right.
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

  // ------------------------------------------------------------------ adobe building kit
  const SHADOW = 'rgba(122,66,26,.26)';
  const CLOTH = ['#b8432e', '#2f6f8f', '#d9822b', '#7b3f6b', '#3f7d5a', '#efe3c8'];
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
    const H = h + ry * 2 + 2;
    c.fillStyle = 'rgba(255,246,222,.30)'; c.fillRect(cx - rx, ty - ry, rx * .34, H);
    c.fillStyle = 'rgba(255,246,222,.13)'; c.fillRect(cx - rx * .66, ty - ry, rx * .3, H);
    c.fillStyle = 'rgba(122,58,22,.14)'; c.fillRect(cx + rx * .3, ty - ry, rx * .75, H);
    c.fillStyle = 'rgba(122,58,22,.18)'; c.fillRect(cx + rx * .72, ty - ry, rx * .32, H);
    if (o.dirt !== false) {
      c.beginPath(); c.ellipse(cx, ty + h - 12, rx + 2, ry, 0, 0, Math.PI); c.lineTo(cx - rx - 2, ty + h + ry + 6); c.lineTo(cx + rx + 2, ty + h + ry + 6); c.closePath();
      c.fillStyle = 'rgba(150,90,45,.2)'; c.fill();
    }
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    return g;
  }
  function dome(c, cx, ty, rx, ry, dh, R, o = {}) {
    const p = new Path2D(); p.moveTo(cx - rx, ty); p.ellipse(cx, ty, rx, dh, 0, Math.PI, TAU); p.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); p.closePath();
    celFill(c, p, R.base, R.light, R.dark, { ld: rx * .2, dd: rx * .3 });
    c.save(); c.clip(p);
    fell(c, cx - rx * .38, ty - dh * .62, rx * .2, dh * .13, 'rgba(255,250,232,.45)');
    c.beginPath(); c.ellipse(cx, ty - dh * .42, rx * .9, ry * .8, 0, .08 * Math.PI, .92 * Math.PI); sk(c, 'rgba(120,60,25,.22)', 1.5);
    c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, R.deep, 3);
    c.beginPath(); c.ellipse(cx, ty + 1, rx + 2, ry + 1, 0, .05 * Math.PI, .95 * Math.PI); sk(c, R.light, 1.2);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    if (o.vents) for (const [dx, dy] of o.vents) roundWin(c, cx + dx, ty - dh * dy, Math.max(3, rx * .05), Math.max(3, rx * .05));
    const top = ty - dh;
    if (o.finial === 'knob') { line(c, cx, top - 7, cx, top + 1, '#6b4428', 2.5); fell(c, cx, top - 9, 4, 4, '#c9955c'); c.beginPath(); c.arc(cx, top - 9, 4, 0, TAU); sk(c, OUT, 1.2); fell(c, cx - 1.3, top - 10.5, 1.4, 1.4, '#f6e2b8'); }
    else if (o.finial === 'spike') { fpoly(c, [cx - 4, top + 1, cx, top - 18, cx + 4, top + 1], '#7a4a2a'); poly(c, [cx - 4, top + 1, cx, top - 18, cx + 4, top + 1]); sk(c, OUT, 1.2); fell(c, cx, top - 8, 3, 3, '#e2b54a'); }
  }
  function capFlat(c, g, W, floor) {
    const { cx, ty, rx, ry } = g;
    fell(c, cx, ty, rx, ry, W.light);
    fell(c, cx, ty + 1, rx - 6, ry - 3, mix(floor, '#5a3018', .25));
    c.save(); c.beginPath(); c.ellipse(cx, ty + 1, rx - 6, ry - 3, 0, 0, TAU); c.clip();
    fell(c, cx + 5, ty + 4, rx - 6, ry - 3, floor); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, W.base, 3);
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, TAU); sk(c, OUT, 2);
  }
  function roundWin(c, x, y, rx, ry = rx) {
    fell(c, x, y, rx + 3, ry + 3, '#9a6838');
    fell(c, x + .6, y + 1, rx, ry, '#2f1f15');
    c.beginPath(); c.ellipse(x, y, rx + 1.5, ry + 1.5, 0, .15 * Math.PI, .85 * Math.PI); sk(c, 'rgba(255,236,196,.85)', 1.5);
    c.beginPath(); c.ellipse(x, y, rx + 3, ry + 3, 0, 0, TAU); sk(c, OUT, 1.3);
  }
  function archPath(x, y, w, h) { const p = new Path2D(), r = w / 2; p.moveTo(x, y + h); p.lineTo(x, y + Math.min(r, h)); p.arc(x + r, y + Math.min(r, h), r, Math.PI, 0); p.lineTo(x + w, y + h); p.closePath(); return p; }
  function archWin(c, x, y, w, h, o = {}) {
    if (w < 3) return;
    const outer = archPath(x - 3, y - 3, w + 6, h + 4);
    c.fillStyle = '#9a6838'; c.fill(outer);
    const inner = archPath(x, y, w, h); c.fillStyle = '#2f1f15'; c.fill(inner);
    if (o.cloth) { c.save(); c.clip(inner); frect(c, x, y, w, h * .52, o.cloth); frect(c, x, y + h * .52 - 3, w, 3, 'rgba(0,0,0,.25)'); line(c, x + w / 2, y, x + w / 2, y + h * .5, 'rgba(0,0,0,.3)', 1); c.restore(); }
    else { c.save(); c.clip(inner); fpoly(c, [x + w * .6, y + h, x + w, y + h * .55, x + w, y + h], 'rgba(255,200,140,.12)'); c.restore(); }
    frect(c, x - 5, y + h + 1, w + 10, 4, '#f3dfb4'); frect(c, x - 5, y + h + 5, w + 10, 2, 'rgba(90,45,20,.35)');
    c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(outer);
  }
  function archDoor(c, x, y, w, h, cloth) {
    const outer = archPath(x - 4, y - 4, w + 8, h + 4);
    c.fillStyle = '#9a6838'; c.fill(outer);
    const inner = archPath(x, y, w, h); c.fillStyle = '#2a1a12'; c.fill(inner);
    if (cloth) {
      c.save(); c.clip(inner);
      const half = w / 2;
      fpoly(c, [x - 1, y - 2, x + half - 1, y - 2, x + half - 4, y + h * .74, x - 1, y + h * .66], cloth);
      fpoly(c, [x + half + 1, y - 2, x + w + 1, y - 2, x + w + 1, y + h * .66, x + half + 4, y + h * .74], cloth);
      frect(c, x, y + h * .22, w, 4, 'rgba(255,240,210,.35)');
      c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + half - 6, y, 5, h * .72);
      c.restore();
    }
    frect(c, x - 9, y + h, w + 18, 6, '#d8bd8c'); frect(c, x - 9, y + h, w + 18, 2, '#efdcb4'); srect(c, x - 9, y + h, w + 18, 6, OUT, 1.2);
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(outer);
  }
  function cylRound(c, g, yo, n, r, span = 1.15, skip = 0) {
    for (let i = 0; i < n; i++) {
      const th = n === 1 ? 0 : -span + 2 * span * i / (n - 1);
      if (Math.abs(th) < skip) continue;
      const ct = Math.cos(th);
      roundWin(c, g.cx + g.rx * Math.sin(th), g.ty + g.ry * ct + yo, Math.max(1.2, r * ct), r);
    }
  }
  function cylArch(c, g, yo, n, w, h, span = 1.15, skip = 0, cloth = null) {
    for (let i = 0; i < n; i++) {
      const th = n === 1 ? 0 : -span + 2 * span * i / (n - 1);
      if (Math.abs(th) < skip) continue;
      const ww = w * Math.cos(th), x = g.cx + g.rx * Math.sin(th), y = g.ty + g.ry * Math.cos(th) + yo;
      archWin(c, x - ww / 2, y, ww, h, { cloth: cloth && i % 2 ? cloth : null });
    }
  }
  // Flat-roofed rounded adobe block: roof slab (y..y+d) then front face (y+d .. y+d+h). Returns geometry.
  function block(c, x, y, w, d, h, W, o = {}) {
    const r = o.r ?? 14, fy = y + d, by = fy + h;
    if (o.shadow !== false) { c.fillStyle = SHADOW; rrect(c, x + 16, fy + 14, w, h - 4, r); c.fill(); }
    const fp = new Path2D(); fp.moveTo(x, fy); fp.lineTo(x + w, fy); fp.lineTo(x + w, by - r); fp.quadraticCurveTo(x + w, by, x + w - r, by); fp.lineTo(x + r, by); fp.quadraticCurveTo(x, by, x, by - r); fp.closePath();
    c.save(); c.fillStyle = W.base; c.fill(fp); c.clip(fp);
    if (o.band) frect(c, x, fy + o.band[0], w, o.band[1], o.band[2]);
    if (o.paint) o.paint(c);
    c.fillStyle = 'rgba(255,248,225,.32)'; c.fillRect(x, fy, 7, h);
    c.fillStyle = 'rgba(255,248,225,.13)'; c.fillRect(x + 7, fy, 9, h);
    c.fillStyle = 'rgba(122,58,22,.16)'; c.fillRect(x + w - 18, fy, 18, h);
    c.fillStyle = 'rgba(122,58,22,.16)'; c.fillRect(x + w - 7, fy, 7, h);
    c.fillStyle = 'rgba(150,90,45,.2)'; c.fillRect(x, by - 12, w, 12);
    c.fillStyle = 'rgba(90,45,20,.28)'; c.fillRect(x, fy + 4, w, 6);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(fp);
    // roof slab with a low parapet
    const tp = new Path2D(); tp.moveTo(x, fy + 2); tp.lineTo(x, y + r); tp.quadraticCurveTo(x, y, x + r, y); tp.lineTo(x + w - r, y); tp.quadraticCurveTo(x + w, y, x + w, y + r); tp.lineTo(x + w, fy + 2); tp.closePath();
    c.fillStyle = W.light; c.fill(tp);
    const pi = 7, fl = new Path2D();
    { const ix = x + pi, iy = y + pi, iw = w - pi * 2, ih = d - pi * 2, rr = Math.max(2, r - 5); fl.moveTo(ix + rr, iy); fl.arcTo(ix + iw, iy, ix + iw, iy + ih, rr); fl.lineTo(ix + iw, iy + ih); fl.lineTo(ix, iy + ih); fl.arcTo(ix, iy, ix + iw, iy, rr); fl.closePath(); }
    c.fillStyle = o.floor || mix(W.base, '#b07a45', .22); c.fill(fl);
    c.save(); c.clip(fl); c.fillStyle = 'rgba(100,50,20,.2)'; c.fillRect(x, y, w, pi + 6); c.fillRect(x, y, pi + 6, d);
    c.strokeStyle = 'rgba(120,70,35,.12)'; c.lineWidth = 1; c.beginPath();
    for (let i = x + 26; i < x + w - 8; i += 26) { c.moveTo(i, y + pi); c.lineTo(i, fy - pi); } c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(80,40,20,.35)'; c.lineWidth = 1.2; c.stroke(fl);
    frect(c, x - 3, fy - 3, w + 6, 6, W.hi); frect(c, x - 3, fy + 3, w + 6, 2, W.dark);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(tp);
    srect(c, x - 3, fy - 3, w + 6, 8, OUT, 1.4);
    return { x, y, w, d, fy, by };
  }
  function awning(c, x, y, w, d, col, col2, groundY) {
    const L = x - 5, Rr = x + w + 5, fy = y + d, n = Math.max(3, Math.round(w / 13)), sw = (Rr - L) / n;
    c.fillStyle = 'rgba(90,45,20,.26)'; c.fillRect(x, y + 2, w, d + 12);
    if (groundY) for (const px of [L + 2, Rr - 2]) { line(c, px, fy, px, groundY, '#5a3a22', 3.4); line(c, px - .8, fy, px - .8, groundY, '#a87444', 1.2); }
    for (let i = 0; i < n; i++) {
      const ci = col2 && i % 2 ? col2 : col;
      fpoly(c, [x + i * w / n, y, x + (i + 1) * w / n, y, L + (i + 1) * sw, fy, L + i * sw, fy], ci);
      c.beginPath(); c.arc(L + (i + .5) * sw, fy, sw / 2, 0, Math.PI); c.fillStyle = ci; c.fill();
    }
    fpoly(c, [x, y, x + w, y, x + w + 2, y + d * .35, x - 2, y + d * .35], 'rgba(255,245,225,.2)');
    poly(c, [x, y, x + w, y, Rr, fy, L, fy]); sk(c, OUT, 1.4);
    c.beginPath(); for (let i = 0; i < n; i++) { c.moveTo(L + (i + 1) * sw, fy); c.arc(L + (i + .5) * sw, fy, sw / 2, 0, Math.PI); } sk(c, OUT, 1.1);
  }
  function ladder(c, x, y0, y1, lean = 4) {
    line(c, x - 3 + lean, y1 + 1, x + 9 + lean, y1 + 3, 'rgba(90,45,20,.25)', 4);
    for (let yy = y0 + 7; yy < y1 - 3; yy += 10) { const t = (yy - y0) / (y1 - y0); line(c, x - 7 + lean * t, yy, x + 7 + lean * t, yy, '#8a5a32', 2.6); }
    for (const dx of [-7, 7]) { line(c, x + dx, y0, x + dx + lean, y1, OUT, 4.6); line(c, x + dx, y0, x + dx + lean, y1, '#b07a48', 2.4); }
  }
  function pot(c, x, y, s = 1, col = '#b8643a') {
    const T = toneW(col);
    fell(c, x + 4 * s, y, 9 * s, 3 * s, 'rgba(110,60,25,.3)');
    const p = new Path2D(); p.ellipse(x, y - 9 * s, 8 * s, 9 * s, 0, 0, TAU);
    celFill(c, p, T.base, T.light, T.dark, { ld: 2.5 * s, dd: 3.5 * s });
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(p);
    c.beginPath(); c.ellipse(x, y - 11 * s, 7.4 * s, 2.2 * s, 0, 0, Math.PI); sk(c, T.deep, 1.2);
    frect(c, x - 3.5 * s, y - 20.5 * s, 7 * s, 4 * s, T.dark);
    fell(c, x, y - 20.5 * s, 5 * s, 1.8 * s, T.deep); c.beginPath(); c.ellipse(x, y - 20.5 * s, 5 * s, 1.8 * s, 0, 0, TAU); sk(c, OUT, 1);
  }
  function quadPt(x1, y1, cx, cy, x2, y2, t) { const m = 1 - t; return [m * m * x1 + 2 * m * t * cx + t * t * x2, m * m * y1 + 2 * m * t * cy + t * t * y2]; }
  function laundry(c, x1, y1, x2, y2, seed, sag = 9) {
    const R = rng(seed), cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 + sag * 2;
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); sk(c, '#5a4636', 1.1);
    const n = Math.max(2, Math.floor(Math.abs(x2 - x1) / 15));
    for (let i = 1; i < n; i++) {
      if (R() < .18) continue;
      const [px, py] = quadPt(x1, y1, cx, cy, x2, y2, i / n), w = 7 + R() * 6, h = 9 + R() * 9, col = CLOTH[Math.floor(R() * CLOTH.length)];
      frect(c, px - w / 2, py, w, h, col); frect(c, px + w / 2 - 2, py, 2, h, 'rgba(0,0,0,.2)'); srect(c, px - w / 2, py, w, h, 'rgba(59,42,34,.8)', 1);
    }
  }
  function post(c, x, y0, y1) { line(c, x, y0, x, y1, OUT, 4); line(c, x, y0, x, y1, '#9a6a40', 2); }
  function tank(c, cx, baseY, r, h, col) {
    const T = toneW(col);
    fell(c, cx + 6, baseY + 1, r + 4, r * .4 + 2, 'rgba(110,60,25,.25)');
    frect(c, cx - r * .8, baseY - 7, r * 1.6, 7, WOOD.dark); srect(c, cx - r * .8, baseY - 7, r * 1.6, 7, OUT, 1.2);
    const g = cylinder(c, cx, baseY - 6 - h - r * .4, r, h, T, { band: [[h * .3, 3, T.dark], [h * .68, 3, T.dark]], dirt: false });
    dome(c, cx, g.ty, r, g.ry, r * .45, toneW(mix(col, '#7a3f1c', .25)), { finial: 'knob' });
    return g;
  }
  function rug(c, x, y, w, h, col, col2) {
    frect(c, x + 3, y + 3, w, h, 'rgba(90,45,20,.25)');
    frect(c, x, y, w, h, col);
    for (let yy = y + 4; yy < y + h - 2; yy += 7) frect(c, x + 2, yy, w - 4, 2, col2);
    srect(c, x, y, w, h, OUT, 1.2);
  }
  function shadowEl(c, x, y, rx, ry) { fell(c, x, y, rx, ry, SHADOW); }

  // ------------------------------------------------------------------ house variants (footprint 340x320, may overhang 84 px above)
  function vDomeHome(c, P) {
    block(c, 214, 128, 118, 54, 120, P.W2, { paint: cc => { archWin(cc, 238, 208, 20, 30, { cloth: P.cl2 }); roundWin(cc, 302, 214, 7); archWin(cc, 286, 252, 18, 26); } });
    tank(c, 300, 168, 15, 18, '#e2d4b8');
    post(c, 232, 168, 120); post(c, 268, 160, 122);
    laundry(c, 232, 124, 268, 126, 11 + P.idx, 5);
    pot(c, 246, 176, .7, '#b8643a');
    shadowEl(c, 142, 300, 116, 40);
    const g = cylinder(c, 126, 140, 110, 118, P.W, {
      band: [[0, 9, P.W.dark], [66, 4, P.W.dark]],
      paint: (cc, gg) => { cylRound(cc, gg, 30, 6, 7.5, 1.25, .3); cylArch(cc, gg, 82, 4, 15, 22, 1.2, .5); }
    });
    dome(c, 126, 140, 110, g.ry, 92, P.R, { finial: 'knob', vents: [[-40, .45], [8, .52], [52, .4]] });
    archDoor(c, 108, 254, 36, 46, P.cl);
    awning(c, 96, 236, 60, 14, P.cl, '#efe3c8', 302);
    ladder(c, 318, 172, 304, 3);
    pot(c, 40, 312, 1.1, '#b8643a'); pot(c, 57, 316, .8, '#c98a4c'); pot(c, 186, 314, .9, '#a85a34');
    P.lamps.push([126, 250]);
  }
  function vTwinTower(c, P) {
    shadowEl(c, 264, 302, 86, 30);
    const s = cylinder(c, 248, 176, 82, 96, P.W2, { band: [[0, 8, P.W2.dark]], paint: (cc, g) => cylArch(cc, g, 26, 4, 16, 24, 1.2, .3, P.cl2) });
    capFlat(c, s, P.W2, mix(P.W2.base, '#b07a45', .25));
    tank(c, 272, 186, 17, 20, '#e3d6bc');
    pot(c, 222, 196, .75); pot(c, 236, 200, .6, '#c98a4c');
    archDoor(c, 236, 262, 30, 42, P.cl2);
    shadowEl(c, 124, 304, 90, 32);
    const t = cylinder(c, 106, 74, 84, 196, P.W, {
      band: [[0, 10, P.R.dark], [70, 5, P.W.dark], [136, 5, P.W.dark]],
      paint: (cc, g) => { cylRound(cc, g, 30, 5, 7, 1.2); cylArch(cc, g, 90, 4, 16, 26, 1.15, .3, P.cl); cylRound(cc, g, 158, 4, 7, 1.15, .4); }
    });
    dome(c, 106, 74, 84, t.ry, 64, P.R, { finial: 'spike', vents: [[-30, .4], [26, .45]] });
    // wooden balcony on the tower's right flank
    const by = 74 + 33.6 + 128;
    frect(c, 150, by, 46, 5, WOOD.dark); srect(c, 150, by, 46, 5, OUT, 1.2);
    for (let i = 0; i < 6; i++) line(c, 154 + i * 8, by - 16, 154 + i * 8, by, WOOD.base, 2);
    line(c, 150, by - 16, 196, by - 16, WOOD.dark, 3);
    line(c, 196, by + 5, 186, by + 22, WOOD.dark, 2.5);
    laundry(c, 190, by - 40, 290, 150, 31 + P.idx, 10);
    post(c, 290, 190, 148);
    archDoor(c, 92, 258, 30, 44, P.cl);
    awning(c, 80, 242, 54, 13, P.cl, '#efe3c8', 304);
    pot(c, 36, 310, 1); pot(c, 154, 314, .85, '#c98a4c');
    P.lamps.push([106, 252], [250, 258]);
  }
  function vFlatBlock(c, P) {
    const b = block(c, 14, 24, 312, 104, 176, P.W, {
      band: [62, 6, P.W.dark],
      paint: cc => {
        for (const wx of [40, 94, 246, 300]) archWin(cc, wx - 10, 144, 20, 30, { cloth: wx === 94 || wx === 300 ? P.cl2 : null });
        roundWin(cc, 170, 160, 14);
        for (const wx of [48, 108, 232, 292]) roundWin(cc, wx, 238, 7.5);
      }
    });
    awning(c, 22, 132, 40, 10, P.cl2, null);
    archDoor(c, 150, 252, 40, 50, P.cl);
    awning(c, 138, 234, 64, 16, P.cl, '#efe3c8', b.by);
    // roof: stair hut with a dome, water tank, washing line, hatch
    const g = cylinder(c, 84, 62, 42, 24, P.W, { band: [[0, 5, P.W.dark]], paint: (cc, gg) => cylRound(cc, gg, 12, 3, 4, 1) });
    dome(c, 84, 62, 42, g.ry, 34, P.R, { finial: 'knob' });
    tank(c, 274, 108, 21, 26, '#e3d6bc');
    frect(c, 176, 76, 30, 20, P.W.dark); frect(c, 179, 79, 24, 14, '#4a3020'); srect(c, 176, 76, 30, 20, OUT, 1.3);
    post(c, 140, 104, 60); post(c, 226, 100, 56);
    laundry(c, 140, 62, 226, 58, 41 + P.idx, 8);
    pot(c, 128, 116, .8); pot(c, 244, 118, .7, '#c98a4c');
    ladder(c, 308, 118, 304, 5);
    pot(c, 118, 312, 1); pot(c, 214, 312, .9, '#a85a34'); pot(c, 228, 315, .7, '#c98a4c');
    P.lamps.push([170, 246]);
  }
  function vStepped(c, P) {
    block(c, 148, -36, 180, 62, 276, P.W, {
      band: [96, 6, P.W.dark],
      paint: cc => {
        archWin(cc, 172, 46, 18, 28); archWin(cc, 226, 46, 18, 28, { cloth: P.cl2 }); archWin(cc, 280, 46, 18, 28);
        roundWin(cc, 186, 150, 8); roundWin(cc, 240, 150, 8); roundWin(cc, 292, 150, 8);
        archWin(cc, 226, 214, 20, 30);
      }
    });
    const g = cylinder(c, 290, -6, 26, 14, P.W, { dirt: false });
    dome(c, 290, -6, 26, g.ry, 22, P.R, { finial: 'knob' });
    tank(c, 196, 16, 14, 18, '#e3d6bc');
    archDoor(c, 270, 256, 34, 46, P.cl2);
    block(c, 10, 130, 200, 66, 106, P.W2, { paint: cc => { archWin(cc, 30, 222, 20, 28); roundWin(cc, 172, 236, 8); } });
    rug(c, 26, 146, 58, 36, P.cl, 'rgba(255,240,210,.45)');
    pot(c, 112, 182, .9); pot(c, 128, 186, .7, '#c98a4c'); pot(c, 98, 186, .6, '#a85a34');
    post(c, 30, 180, 140); post(c, 140, 176, 138);
    laundry(c, 30, 142, 140, 140, 51 + P.idx, 8);
    ladder(c, 182, 22, 186, 0);
    archDoor(c, 92, 252, 36, 48, P.cl);
    awning(c, 80, 236, 60, 14, P.cl, '#efe3c8', 304);
    awning(c, 258, 238, 58, 12, P.cl2, null, 304);
    pot(c, 64, 312, 1); pot(c, 244, 312, .9, '#a85a34');
    P.lamps.push([110, 246], [287, 250]);
  }
  function vTower(c, P) {
    shadowEl(c, 190, 302, 100, 34);
    const t = cylinder(c, 170, 30, 90, 236, P.W, {
      band: [[0, 10, P.R.dark], [80, 5, P.W.dark], [158, 5, P.W.dark]],
      paint: (cc, g) => { cylRound(cc, g, 36, 6, 7, 1.25); cylArch(cc, g, 100, 5, 15, 24, 1.2, 0, P.cl2); cylRound(cc, g, 182, 4, 7.5, 1.15, .35); }
    });
    dome(c, 170, 30, 90, t.ry, 74, P.R, { finial: 'spike', vents: [[-36, .4], [0, .55], [36, .4]] });
    // ring balcony in front of the middle floor
    const by = 30 + t.ry + 146;
    c.beginPath(); c.ellipse(170, by, 96, 18, 0, 0, Math.PI); sk(c, WOOD.dark, 6); c.beginPath(); c.ellipse(170, by - 1, 96, 18, 0, 0, Math.PI); sk(c, WOOD.light, 2);
    c.strokeStyle = WOOD.base; c.lineWidth = 2; c.beginPath();
    for (let a = .1; a < Math.PI; a += .16) { const x = 170 + Math.cos(a) * 96, y = by + Math.sin(a) * 18; c.moveTo(x, y); c.lineTo(x, y - 14); } c.stroke();
    c.beginPath(); c.ellipse(170, by - 14, 96, 18, 0, 0, Math.PI); sk(c, WOOD.dark, 2.5);
    block(c, 6, 204, 96, 38, 62, P.W2, { paint: cc => archWin(cc, 40, 258, 18, 26, { cloth: P.cl }) });
    block(c, 240, 210, 94, 34, 60, P.W2, { paint: cc => roundWin(cc, 300, 268, 7) });
    pot(c, 30, 236, .8); pot(c, 72, 236, .7, '#c98a4c');
    tank(c, 300, 240, 13, 16, '#e3d6bc');
    archDoor(c, 154, 252, 34, 50, P.cl);
    awning(c, 142, 236, 58, 13, P.cl, '#efe3c8', 304);
    ladder(c, 254, 246, 306, -3);
    pot(c, 120, 314, .9); pot(c, 220, 314, .8, '#a85a34');
    P.lamps.push([171, 246]);
  }
  function vMarket(c, P) {
    block(c, 8, 26, 324, 86, 124, P.W, { paint: cc => { for (let i = 0; i < 6; i++) archWin(cc, 26 + i * 52, 128, 18, 26, { cloth: i % 2 ? P.cl2 : null }); } });
    for (const cx of [72, 262]) { const g = cylinder(c, cx, 54, 30, 18, P.W, { dirt: false }); dome(c, cx, 54, 30, g.ry, 26, P.R, { finial: 'knob' }); }
    post(c, 120, 90, 54); post(c, 214, 88, 52);
    laundry(c, 120, 56, 214, 54, 61 + P.idx, 8);
    pot(c, 160, 100, .8);
    // shaded stall floor and three stalls
    frect(c, 10, 236, 320, 70, 'rgba(110,60,25,.16)');
    const goods = [['#e08a2a', '#f2b04a'], ['#8ab04a', '#b6cf6a'], ['#c0392b', '#e0604a']];
    for (let i = 0; i < 3; i++) {
      const x = 16 + i * 106, w = 96, cl = P.stalls[i];
      frect(c, x, 214, w, 30, 'rgba(60,30,15,.45)');
      frect(c, x + 2, 270, w - 4, 32, WOOD.base); frect(c, x + 2, 270, w - 4, 5, WOOD.light);
      c.strokeStyle = WOOD.dark; c.lineWidth = 1.2; c.beginPath(); for (let px = x + 12; px < x + w - 4; px += 12) { c.moveTo(px, 276); c.lineTo(px, 302); } c.stroke();
      srect(c, x + 2, 270, w - 4, 32, OUT, 1.4);
      if (i === 1) { pot(c, x + 22, 270, .8); pot(c, x + 42, 270, 1, '#c98a4c'); pot(c, x + 62, 270, .7, '#a85a34'); pot(c, x + 80, 270, .8); }
      else {
        const [a, b] = goods[i];
        for (let k = 0; k < 4; k++) { const gx = x + 16 + k * 21; fell(c, gx, 266, 9, 5, a); fell(c, gx - 2, 263, 6, 3, b); c.beginPath(); c.ellipse(gx, 266, 9, 5, 0, 0, TAU); sk(c, 'rgba(59,42,34,.7)', 1); }
        for (let k = 0; k < 3; k++) fell(c, x + 26 + k * 22, 259, 5, 4, b);
      }
      awning(c, x, 200, w, 42, cl[0], cl[1], 304);
    }
    P.lamps.push([120, 240], [226, 240]);
  }
  function vTriDome(c, P) {
    shadowEl(c, 232, 234, 100, 36);
    const b = cylinder(c, 214, 96, 96, 102, P.W, { band: [[0, 8, P.W.dark]], paint: (cc, g) => cylRound(cc, g, 28, 5, 7, 1.2) });
    dome(c, 214, 96, 96, b.ry, 76, P.R, { finial: 'knob', vents: [[-30, .45], [30, .45]] });
    shadowEl(c, 110, 302, 86, 30);
    const f = cylinder(c, 94, 178, 82, 92, P.W2, { band: [[0, 8, P.W2.dark]], paint: (cc, g) => cylArch(cc, g, 26, 4, 15, 24, 1.15, .4, P.cl2) });
    dome(c, 94, 178, 82, f.ry, 62, P.R2, { finial: 'knob' });
    archDoor(c, 78, 258, 32, 44, P.cl);
    awning(c, 68, 242, 52, 12, P.cl, '#efe3c8', 304);
    block(c, 170, 252, 64, 14, 42, P.W2, { r: 6, shadow: false, paint: cc => archWin(cc, 192, 280, 20, 26) });
    shadowEl(c, 282, 308, 62, 22);
    const r = cylinder(c, 270, 214, 58, 72, P.W, { paint: (cc, g) => cylRound(cc, g, 24, 3, 6, 1) });
    capFlat(c, r, P.W, mix(P.W.base, '#b07a45', .25));
    pot(c, 256, 216, .8); pot(c, 274, 220, .65, '#c98a4c');
    post(c, 296, 220, 182);
    laundry(c, 258, 150, 296, 184, 71 + P.idx, 6);
    ladder(c, 318, 214, 306, 4);
    pot(c, 158, 314, .9); pot(c, 22, 312, 1, '#a85a34');
    P.lamps.push([94, 252]);
  }

  // ------------------------------------------------------------------ Kazekage building (footprint 420x400)
  function lmKazekage(c, P) {
    const W = toneW('#e8c994'), R = toneW('#dcb47a'), BAND = '#b07a46';
    // paved forecourt
    c.fillStyle = '#d9c095'; rrect(c, 96, 344, 228, 54, 14); c.fill(); sk(c, 'rgba(120,80,40,.5)', 1.5);
    // flanking towers (behind the drum)
    for (const cx of [42, 378]) {
      shadowEl(c, cx + 14, 342, 44, 16);
      const g = cylinder(c, cx, 132, 38, 196, W, { band: [[0, 9, BAND], [96, 4, W.dark]], paint: (cc, gg) => { cylRound(cc, gg, 30, 2, 6, .7); cylRound(cc, gg, 120, 2, 6, .7); } });
      dome(c, cx, 132, 38, g.ry, 36, R, { finial: 'knob' });
    }
    tank(c, 378, 126, 14, 16, '#e3d6bc');
    // main drum
    shadowEl(c, 232, 378, 184, 62);
    const g = cylinder(c, 210, 170, 172, 140, W, {
      band: [[0, 14, BAND], [14, 3, '#f6e6c4'], [74, 7, BAND], [81, 2, '#f6e6c4']],
      paint: (cc, gg) => {
        cylRound(cc, gg, 42, 13, 7.5, 1.38, .2);
        cylArch(cc, gg, 96, 10, 15, 26, 1.38, .28);
        // water pipes poking out of the wall
        for (const th of [-1.05, -.62, .62, 1.05]) {
          const x = gg.cx + gg.rx * Math.sin(th), y = gg.ty + gg.ry * Math.cos(th) + 64;
          fell(cc, x, y, 5 * Math.cos(th) + 1.5, 5, '#8a5a32'); fell(cc, x, y, 3 * Math.cos(th) + .8, 3, '#2f1f15');
        }
      }
    });
    dome(c, 210, 170, 172, g.ry, 150, R, {});
    // ring of vents round the dome
    for (let i = 0; i < 9; i++) {
      const th = -1.25 + 2.5 * i / 8; if (Math.abs(th) < .3) continue;
      roundWin(c, 210 + 152 * Math.sin(th), 170 - 44 + g.ry * .85 * Math.cos(th) - 6, Math.max(2, 6 * Math.cos(th)), 6);
    }
    // 風 painted on the dome front
    const py = 102;
    fell(c, 214, py + 4, 50, 47, 'rgba(120,70,30,.25)');
    fell(c, 210, py, 50, 47, '#7a3a1c'); fell(c, 210, py, 45, 42, '#f7ead0');
    c.beginPath(); c.ellipse(210, py, 39, 36, 0, 0, TAU); sk(c, '#b8432e', 2.5);
    txt(c, '風', 212, py + 5, 62, 'rgba(90,40,20,.25)', { weight: '900' });
    txt(c, '風', 210, py + 3, 62, '#3a1a10', { weight: '900' });
    c.beginPath(); c.ellipse(210, py, 50, 47, 0, 0, TAU); sk(c, OUT, 2);
    // rooftop: drum, railing, sphere
    const cap = cylinder(c, 210, 10, 40, 14, toneW('#c99560'), { dirt: false });
    capFlat(c, cap, toneW('#c99560'), '#b98a58');
    c.strokeStyle = WOOD.dark; c.lineWidth = 1.6; c.beginPath();
    for (let a = 0; a <= Math.PI; a += .2) { const x = 210 + Math.cos(a) * 40, y = 10 + Math.sin(a) * 16; c.moveTo(x, y); c.lineTo(x, y - 9); } c.stroke();
    c.beginPath(); c.ellipse(210, 1, 40, 16, 0, 0, Math.PI); sk(c, WOOD.dark, 2);
    line(c, 210, 4, 210, -14, '#6b4428', 5);
    const sp = new Path2D(); sp.arc(210, -36, 24, 0, TAU);
    celFill(c, sp, '#d9a35f', '#f2cf8f', '#a8743f', { ld: 6, dd: 9, deep: '#86562d', deepD: 3 });
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(sp);
    c.beginPath(); c.ellipse(210, -36, 24, 7, 0, 0, Math.PI); sk(c, 'rgba(110,60,25,.5)', 1.5);
    fell(c, 202, -45, 6, 4, 'rgba(255,248,225,.75)');
    // entrance portico
    frect(c, 160, 300, 100, 14, '#b8432e'); frect(c, 160, 300, 100, 4, '#d8644a'); frect(c, 160, 314, 100, 3, 'rgba(60,20,10,.4)'); srect(c, 160, 300, 100, 14, OUT, 1.6);
    for (const px of [166, 244]) { frect(c, px, 314, 10, 62, '#efdcb4'); frect(c, px + 6, 314, 4, 62, 'rgba(122,58,22,.25)'); srect(c, px, 314, 10, 62, OUT, 1.4); }
    archDoor(c, 186, 320, 48, 56, '#8a2a1a');
    for (let i = 0; i < 3; i++) { const w = 80 + i * 22, y = 376 + i * 6; frect(c, 210 - w / 2, y, w, 6, i % 2 ? '#d8bd8c' : '#e6cfa2'); srect(c, 210 - w / 2, y, w, 6, OUT, 1.1); }
    // banners either side of the door
    for (const [bx, col] of [[132, '#b8432e'], [276, '#2f6f8f']]) {
      line(c, bx - 3, 252, bx + 15, 252, WOOD.dark, 3);
      frect(c, bx, 254, 12, 52, col); fpoly(c, [bx, 306, bx + 12, 306, bx + 6, 300], '#efe3c8'); srect(c, bx, 254, 12, 52, OUT, 1.2);
      txt(c, '風', bx + 6, 270, 10, '#fff4dc');
    }
    pot(c, 150, 386, 1.2); pot(c, 272, 386, 1.2, '#c98a4c');
    P.lamps.push([150, 330], [270, 330]);
  }

  // ------------------------------------------------------------------ palettes & house table
  const WALLS = ['#ecd4a4', '#e2bf8a', '#f2e2c0', '#ddb08a', '#e8c9a0'].map(toneW);
  const DOMES = ['#cf8c58', '#e2c08c', '#c0714a', '#ecd6aa', '#c99c66', '#b97c56'].map(toneW);
  const VAR = {
    v0a: [vDomeHome, 0, 2, 0, 1, 0, 1], v0b: [vDomeHome, 3, 4, 2, 3, 1, 2],
    v1a: [vTwinTower, 1, 2, 1, 2, 2, 0], v1b: [vTwinTower, 4, 0, 5, 0, 3, 5],
    v2a: [vFlatBlock, 2, 1, 4, 0, 1, 3], v2b: [vFlatBlock, 0, 3, 0, 2, 0, 4],
    v3a: [vStepped, 1, 2, 2, 4, 4, 0], v3b: [vStepped, 3, 0, 3, 1, 2, 1],
    v4a: [vTower, 0, 1, 0, 5, 0, 2], v4b: [vTower, 2, 3, 5, 4, 3, 1],
    v5a: [vMarket, 1, 0, 2, 3, 0, 1], v5b: [vMarket, 4, 2, 4, 0, 2, 4],
    v6a: [vTriDome, 0, 1, 1, 2, 1, 0], v6b: [vTriDome, 3, 2, 0, 5, 4, 2]
  };
  // [cell x, cell y, variant, offset x, offset y] (offsets keep >= 120 px lanes and the gate avenue clear)
  const HOUSES = [
    [1, 1, 'v2a', 120, 120], [3, 1, 'v6a', 90, 70], [5, 1, 'v4a', 80, 96], [7, 1, 'v3a', 70, 84],
    [2, 2, 'v0a', 80, 100], [6, 2, 'v1a', 100, 70],
    [1, 3, 'v5b', 90, 80], [3, 3, 'v0b', 70, 90], [7, 3, 'v2b', 90, 70],
    [2, 4, 'v3b', 80, 70], [6, 4, 'v6b', 90, 80],
    [1, 5, 'v1b', 100, 100], [7, 5, 'v5a', 80, 104],
    [3, 6, 'v4b', 90, 80], [6, 6, 'v0a', 70, 90],
    [4, 7, 'v2b', 100, 80], [7, 7, 'v6a', 80, 90],
    [2, 8, 'v3a', 90, 70], [5, 8, 'v1a', 80, 80],
    [4, 2, 'v6b', 90, 90], [8, 2, 'v4b', 80, 90], [1, 7, 'v2a', 100, 80], [5, 6, 'v1b', 90, 100], [6, 8, 'v0b', 70, 80], [8, 6, 'v3b', 80, 80]
  ];

  // ------------------------------------------------------------------ cliff ring (one global scene, rendered per cell window)
  const yN = x => 130 + 26 * wv(x, 1), yNb = x => 399 - 9 * wv(x, 2);           // north face: top edge / foot
  const xW = y => 348 + 24 * wv(y, 3), xWb = y => 399 - 7 * wv(y, 6);           // west wall: top edge / bevel foot
  const xE = y => 4828 + 24 * wv(y, 4), xEb = y => 4801 + 7 * wv(y, 7);          // east wall
  const yS = x => 4803 + 14 * wv(x, 5), ySf = x => 5040 + 18 * wv(x, 8);         // south wall: inner lip / outer face top
  const yG = x => 2296 + 22 * wv(x, 9), yGb = x => 2509 - 7 * wv(x, 10), yGS = x => 2692 + 12 * wv(x, 11); // canyon
  const xL = y => -46 + 30 * wv(y, 13), xR = y => 5246 - 30 * wv(y, 14), yR = x => -104 + 30 * wv(x, 12); // outer rims
  let TOP = null, FEAT = null, COLS = null, BEV = null;

  function topPolygon() {
    const P = [], st = 8;
    for (let y = GS; y <= 5040; y += st) P.push([xR(y), y]);
    for (let x = 5240; x >= -40; x -= st) P.push([x, ySf(x)]);
    for (let y = 5040; y >= -72; y -= st) P.push([xL(y), y]);
    for (let x = -8; x <= 5208; x += st) P.push([x, yR(x)]);
    for (let y = -72; y <= 2296; y += st) P.push([xR(y), y]);
    for (let x = 5240; x >= 4836; x -= st) P.push([x, yG(x)]);
    for (let y = 2296; y >= 140; y -= st) P.push([xE(y), y]);
    for (let x = 4840; x >= 360; x -= st) P.push([x, yN(x)]);
    for (let y = 140; y <= 4808; y += st) P.push([xW(y), y]);
    for (let x = 360; x <= 4840; x += st) P.push([x, yS(x)]);
    for (let y = 4808; y >= GS; y -= st) P.push([xE(y), y]);
    for (let x = 4836; x <= 5240; x += st) P.push([x, yGS(x)]);
    return pathFrom(P);
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
  function genCliffFeatures() {
    COLS = []; { const R = rng(4711); let u = 0; while (u < BLOCK - 40) { const w = 62 + R() * 90; COLS.push({ u0: u, u1: Math.min(BLOCK, u + w), ph: R() * TAU, top: R() < .4 ? R() * .45 : 0, sl: (R() - .5) * .08 }); u += w; } COLS[COLS.length - 1].u1 = BLOCK; }
    BEV = []; { const R = rng(4712); let v = 0; while (v < BLOCK - 40) { const h = 44 + R() * 50; BEV.push([v, Math.min(BLOCK, v + h), R()]); v += h; } BEV[BEV.length - 1][1] = BLOCK; }
    FEAT = { N: [], S: [], W: [], E: [] };
    const fill = (list, seed, uf, vf, nu, nv, r0) => {
      const R = rng(seed);
      // packed, rounded sandstone lobes on a jittered grid
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        if (R() < .12) continue;
        list.push({ t: 'l', u: uf((i + .5 + (R() - .5) * .7) / nu), v: vf((j + .5 + (R() - .5) * .6) / nv), r: r0 * (.8 + R() * .7), k: R() });
      }
      for (let i = 0; i < 4; i++) { const pts = [[0, 0]]; let x = 0, y = 0; for (let k = 0; k < 4; k++) { x += (R() - .5) * 40; y += 5 + R() * 12; pts.push([x, y]); } list.push({ t: 'c', u: uf(R()), v: vf(R()), r: 50, pts }); }
      for (let i = 0; i < 26; i++) list.push({ t: 'p', u: uf(R()), v: vf(R()), r: 1.4 + R() * 2.6, k: R() });
      list.sort((a, b) => ('lscp'.indexOf(a.t) - 'lscp'.indexOf(b.t)) || (a.v - b.v));
    };
    fill(FEAT.N, 11, r => r * BLOCK, r => -90 + r * 222, 7, 4, 44);
    fill(FEAT.S, 12, r => r * BLOCK, r => 4820 + r * 236, 7, 4, 44);
    fill(FEAT.W, 13, r => -44 + r * 396, r => r * BLOCK, 5, 8, 42);
    fill(FEAT.E, 14, r => 4846 + r * 396, r => r * BLOCK, 5, 8, 42);
    // talus along the north face and the bevels
    FEAT.tN = []; FEAT.tW = []; FEAT.tE = [];
    const R = rng(15);
    for (let i = 0; i < 7; i++) FEAT.tN.push({ u: R() * BLOCK, r: 6 + R() * 11, d: 4 + R() * 10, s: Math.floor(R() * 1e6) });
    for (let i = 0; i < 5; i++) FEAT.tW.push({ v: R() * BLOCK, r: 6 + R() * 10, d: 6 + R() * 12, s: Math.floor(R() * 1e6) });
    for (let i = 0; i < 5; i++) FEAT.tE.push({ v: R() * BLOCK, r: 6 + R() * 10, d: 6 + R() * 12, s: Math.floor(R() * 1e6) });
  }
  function lobe(c, x, y, r, k) {
    const R = rng(Math.floor(k * 1e6) + 7), ry = r * .6, pts = [];
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, q = .84 + R() * .26; pts.push([x + Math.cos(a) * r * q, y + Math.sin(a) * ry * q]); }
    const p = new Path2D(); p.moveTo((pts[10][0] + pts[0][0]) / 2, (pts[10][1] + pts[0][1]) / 2);
    for (let i = 0; i < 11; i++) { const n = pts[(i + 1) % 11]; p.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + n[0]) / 2, (pts[i][1] + n[1]) / 2); }
    p.closePath();
    c.save(); c.translate(r * .1, ry * .22); c.fillStyle = 'rgba(96,52,20,.55)'; c.fill(p); c.restore();
    celFill(c, p, k < .33 ? '#d9af77' : k < .66 ? '#cfa36b' : '#ddb47e', CL.topL, CL.topD, { ld: r * .16, dd: r * .26, deep: '#a0723f', deepD: r * .1 });
    c.strokeStyle = 'rgba(85,50,24,.6)'; c.lineWidth = 1.5; c.stroke(p);
    if (r > 40) { c.beginPath(); c.moveTo(x - r * .2, y - ry * .5); c.quadraticCurveTo(x, y - ry * .1, x - r * .05, y + ry * .35); sk(c, 'rgba(110,62,28,.4)', 1.3); }
  }
  function standRock(c, x, y, r, seed) {
    const R = rng(seed), pts = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI, rr = r * (.8 + R() * .35); pts.push([x + Math.cos(a) * rr * 1.1, y - 2 + Math.sin(a) * rr]); }
    pts.push([x + r * .9, y + r * .12], [x, y + r * .22], [x - r * .9, y + r * .12]);
    fell(c, x + r * .5, y + r * .16, r * 1.15, r * .34, 'rgba(110,60,25,.28)');
    const p = pathFrom(pts);
    celFill(c, p, '#cf9f66', '#ebc890', '#a8743f', { ld: r * .25, dd: r * .35, deep: '#8a5a30', deepD: Math.max(1.5, r * .12) });
    c.strokeStyle = CL.line; c.lineWidth = r > 20 ? 2 : 1.5; c.stroke(p);
    if (r > 16) { c.beginPath(); c.moveTo(x - r * .1, y - r * .75); c.lineTo(x + r * .1, y - r * .4); c.lineTo(x, y - r * .1); sk(c, 'rgba(90,50,25,.55)', 1.4); }
  }
  function rockFace(c, path, a, b, f0, f1) {
    let y0 = 1e9, y1 = -1e9; for (let x = a; x <= b; x += 16) { y0 = Math.min(y0, f0(x)); y1 = Math.max(y1, f1(x)); }
    c.save(); c.clip(path);
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, CL.faceL); g.addColorStop(.32, CL.face); g.addColorStop(1, CL.faceD);
    c.fillStyle = g; c.fillRect(a - 10, y0 - 10, b - a + 20, y1 - y0 + 20);
    for (let k = Math.floor(a / BLOCK) - 1; k * BLOCK < b + BLOCK; k++) for (const col of COLS) {
      const x0 = k * BLOCK + col.u0, x1 = k * BLOCK + col.u1, w = x1 - x0;
      if (x1 < a - 20 || x0 > b + 20) continue;
      c.fillStyle = 'rgba(255,238,200,.2)'; c.fillRect(x0, y0, w * .3, y1 - y0);
      c.fillStyle = 'rgba(100,50,20,.15)'; c.fillRect(x1 - w * .24, y0, w * .24, y1 - y0);
      const gy0 = y0 + col.top * (y1 - y0), gp = new Path2D(); gp.moveTo(x1, gy0); for (let y = gy0; y <= y1 + 12; y += 12) gp.lineTo(x1 + 4 * Math.sin(y * .045 + col.ph) + (y - gy0) * col.sl, y);
      c.strokeStyle = 'rgba(85,45,20,.5)'; c.lineWidth = 2.2; c.stroke(gp);
      c.save(); c.translate(-3, 0); c.strokeStyle = 'rgba(255,232,190,.35)'; c.lineWidth = 1.2; c.stroke(gp); c.restore();
    }
    // sedimentary layers: alternating tinted bands with a dark seam and a lit ledge
    const TS = [0, .2, .38, .6, .79, 1.02], s8 = Math.floor(a / 8) * 8;
    const sy = (j, x) => j === 0 ? f0(x) - 4 : j === TS.length - 1 ? f1(x) + 4 : f0(x) + (f1(x) - f0(x)) * TS[j] + 6 * Math.sin(TAU * x * 2 / BLOCK + j * 1.9) + 3 * Math.sin(TAU * x * 5 / BLOCK + j);
    for (let j = 0; j < TS.length - 1; j++) {
      const bp = new Path2D();
      for (let x = s8; x <= b + 8; x += 8) x === s8 ? bp.moveTo(x, sy(j, x)) : bp.lineTo(x, sy(j, x));
      for (let x = Math.ceil((b + 8) / 8) * 8; x >= s8; x -= 8) bp.lineTo(x, sy(j + 1, x));
      bp.closePath();
      c.fillStyle = ['rgba(255,236,196,.10)', 'rgba(150,80,35,.10)', 'rgba(255,226,180,.14)', 'rgba(150,80,35,.14)', 'rgba(120,60,25,.08)'][j]; c.fill(bp);
      if (j === 0) continue;
      const sp = new Path2D();
      for (let x = s8; x <= b + 8; x += 8) x === s8 ? sp.moveTo(x, sy(j, x)) : sp.lineTo(x, sy(j, x));
      c.strokeStyle = 'rgba(105,55,22,.5)'; c.lineWidth = j % 2 ? 2.6 : 1.6; c.stroke(sp);
      c.save(); c.translate(0, 2.5); c.strokeStyle = 'rgba(255,236,190,.45)'; c.lineWidth = 1.3; c.stroke(sp); c.restore();
    }
    c.fillStyle = 'rgba(80,40,15,.34)'; c.fill(bandH(f0, x => f0(x) + 15, a, b));
    c.fillStyle = 'rgba(80,40,15,.18)'; c.fill(bandH(x => f1(x) - 22, f1, a, b));
    c.restore();
    c.strokeStyle = CL.line; c.lineWidth = 2.2; c.stroke(path);
  }
  // narrow side face of the west / east wall, drawn as bulging rock chunks (period = one block)
  function bevel(c, path, lit, a, b, edge) {
    c.save(); c.clip(path);
    c.fillStyle = lit ? CL.face : CL.deep; c.fillRect(-200, a - 10, 5600, b - a + 20);
    for (let k = Math.floor(a / BLOCK) - 1; k * BLOCK < b + BLOCK; k++) for (const [v0, v1, q] of BEV) {
      const y0 = v0 + k * BLOCK, y1 = v1 + k * BLOCK, ym = (y0 + y1) / 2;
      if (y1 < a - 10 || y0 > b + 10) continue;
      const ex = edge(ym), w = 46, bp = new Path2D(); bp.ellipse(ex, ym, w, (y1 - y0) * .56, 0, 0, TAU);
      celFill(c, bp, lit ? CL.faceL : CL.faceD, lit ? '#efc994' : CL.face, lit ? CL.faceD : CL.deep, { ld: 6, dd: 9 });
      c.strokeStyle = 'rgba(70,35,15,.7)'; c.lineWidth = 1.6; c.stroke(bp);
      if (q > .55) line(c, ex - 30, ym + (q - .7) * 30, ex + 30, ym + (q - .7) * 30 + 6, 'rgba(80,40,15,.4)', 1.4);
    }
    c.restore();
    c.strokeStyle = CL.line; c.lineWidth = 2; c.stroke(path);
  }
  function gateHut(c, cx, base, col) {
    const W = toneW('#e8cfa0');
    shadowEl(c, cx + 12, base, 40, 14);
    const g = cylinder(c, cx, base - 30 - 13.6, 34, 30, W, { band: [[0, 5, W.dark]] });
    dome(c, cx, g.ty, 34, g.ry, 28, toneW('#c98a55'), { finial: 'knob' });
    archDoor(c, cx - 8, base - 26, 16, 22, col);
    line(c, cx + 30, base - 6, cx + 30, base - 76, WOOD.dark, 3);
    fpoly(c, [cx + 31, base - 74, cx + 58, base - 68, cx + 31, base - 60], col); poly(c, [cx + 31, base - 74, cx + 58, base - 68, cx + 31, base - 60]); sk(c, OUT, 1.2);
  }
  // Draw every part of the ring that touches [X0,X1]x[Y0,Y1] (world-local coords).
  function drawRing(c, X0, Y0, X1, Y1) {
    const a = X0 - 24, b = X1 + 24;
    const SH = 'rgba(120,64,26,.24)';
    // ground shadows cast by the walls (sun from the north-west)
    if (Y0 < 440 && b > 300) { c.fillStyle = SH; c.fill(bandH(yNb, x => yNb(x) + 26, Math.max(a, 300), Math.min(b, 4900))); }
    if (X0 < 440) { c.fillStyle = SH; c.fill(bandV(xWb, y => xWb(y) + 26, Math.max(Y0 - 24, 396), Math.min(Y1 + 24, 4808))); }
    if (X1 > 4780 && Y0 < 2560 && Y1 > 2490) { c.fillStyle = SH; c.fill(bandH(yGb, x => yGb(x) + 28, Math.max(a, 4792), Math.min(b, 5228))); }
    // faces
    if (Y0 < 404 && b > 300 && a < 4900) rockFace(c, bandH(yN, yNb, Math.max(a, 300), Math.min(b, 4900)), Math.max(a, 300), Math.min(b, 4900), yN, yNb);
    if (X1 > 4780 && Y0 < 2516 && Y1 > 2280) rockFace(c, bandH(yG, yGb, Math.max(a, 4794), Math.min(b, 5236)), Math.max(a, 4794), Math.min(b, 5236), yG, yGb);
    if (Y1 > 5030) rockFace(c, bandH(ySf, () => 5201, Math.max(a, -30), Math.min(b, 5230)), Math.max(a, -30), Math.min(b, 5230), ySf, () => 5201);
    // side bevels
    if (X0 < 410) { const s = Math.max(Y0 - 24, 396), e = Math.min(Y1 + 24, 4808); if (e > s) bevel(c, bandV(xW, xWb, s, e), false, s, e, xW); }
    if (X1 > 4790) {
      let s = Math.max(Y0 - 24, 396), e = Math.min(Y1 + 24, 2300); if (e > s) bevel(c, bandV(xEb, xE, s, e), true, s, e, xE);
      s = Math.max(Y0 - 24, GS); e = Math.min(Y1 + 24, 4808); if (e > s) bevel(c, bandV(xEb, xE, s, e), true, s, e, xE);
    }
    // talus rocks at the feet
    for (let k = Math.floor(X0 / BLOCK) - 1; k * BLOCK < X1 + BLOCK; k++) {
      if (Y0 < 440) for (const t of FEAT.tN) { const x = t.u + k * BLOCK; if (x > a && x < b && x > 400 && x < 4800) standRock(c, x, yNb(x) + t.d, t.r, t.s); }
    }
    for (let k = Math.floor(Y0 / BLOCK) - 1; k * BLOCK < Y1 + BLOCK; k++) {
      if (X0 < 440) for (const t of FEAT.tW) { const y = t.v + k * BLOCK; if (y > Y0 - 24 && y < Y1 + 24 && y > 420 && y < 4780) standRock(c, xWb(y) + t.d, y, t.r, t.s); }
      if (X1 > 4760) for (const t of FEAT.tE) { const y = t.v + k * BLOCK; if (y > Y0 - 24 && y < Y1 + 24 && y > 420 && y < 4780 && (y < 2290 || y > GS + 20)) standRock(c, xEb(y) - t.d, y, t.r, t.s); }
    }
    if (X1 > 4780 && Y0 < 2560 && Y1 > 2490) for (const [x, d, r, s] of [[4836, 6, 12, 7], [4900, 10, 8, 8], [5050, 5, 14, 9], [5150, 9, 9, 10]]) standRock(c, x, yGb(x) + d, r, s);
    // plateau top
    c.fillStyle = '#c4955f'; c.fill(TOP);
    c.save(); c.clip(TOP);
    c.lineJoin = 'round';
    const drawF = (f, x, y) => {
      if (x < a - f.r - 20 || x > b + f.r + 20 || y < Y0 - f.r - 40 || y > Y1 + f.r + 40) return;
      if (f.t === 'l') lobe(c, x, y, f.r, f.k);
      else if (f.t === 'c') { const p = new Path2D(); f.pts.forEach(([px, py], i) => i ? p.lineTo(x + px, y + py) : p.moveTo(x + px, y + py)); c.strokeStyle = 'rgba(105,60,28,.55)'; c.lineWidth = 2; c.stroke(p); c.save(); c.translate(2, 1); c.strokeStyle = 'rgba(255,238,200,.4)'; c.lineWidth = 1.2; c.stroke(p); c.restore(); }
      else { fell(c, x + .8, y + .8, f.r, f.r * .7, '#a87c4c'); fell(c, x, y, f.r, f.r * .7, f.k < .5 ? '#d8b282' : '#c99c66'); }
    };
    for (let k = Math.floor(X0 / BLOCK) - 1; k * BLOCK < X1 + BLOCK; k++) {
      if (Y0 < 160) for (const f of FEAT.N) drawF(f, f.u + k * BLOCK, f.v);
      if (Y1 > 4800) for (const f of FEAT.S) drawF(f, f.u + k * BLOCK, f.v);
    }
    for (let k = Math.floor(Y0 / BLOCK) - 1; k * BLOCK < Y1 + BLOCK; k++) {
      if (X0 < 400) for (const f of FEAT.W) drawF(f, f.u, f.v + k * BLOCK);
      if (X1 > 4800) for (const f of FEAT.E) drawF(f, f.u, f.v + k * BLOCK);
    }
    // rounded, sun-lit lip along every edge
    c.strokeStyle = 'rgba(120,64,26,.35)'; c.lineWidth = 34; c.stroke(TOP);
    c.strokeStyle = CL.topL; c.lineWidth = 22; c.stroke(TOP);
    c.strokeStyle = 'rgba(255,250,230,.6)'; c.lineWidth = 7; c.stroke(TOP);
    c.restore();
    c.strokeStyle = CL.line; c.lineWidth = 3; c.stroke(TOP);
    // boulder piles in the four inner corners
    const piles = [[462, 486, 40], [424, 446, 28], [494, 438, 20], [416, 498, 17]];
    for (const [px, py, r] of piles) for (const [mx, my] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = mx ? SIZE - px : px, y = my ? py + 4300 : py;
      if (x + r * 1.7 > X0 && x - r * 1.3 < X1 && y + r > Y0 && y - r * 1.2 < Y1) standRock(c, x, y, r, px + py + mx * 7 + my * 13);
    }
    // canyon gate: guard huts on the walls and banners on the north face
    if (X1 > 4780 && Y0 < 2900 && Y1 > 2080) {
      gateHut(c, 4990, 2232, '#b8432e');
      gateHut(c, 5010, 2860, '#2f6f8f');
      for (const [bx, col, ch] of [[4892, '#b8432e', '砂'], [5100, '#2f6f8f', '風']]) {
        const ty = yG(bx) + 14;
        line(c, bx - 6, ty, bx + 34, ty, WOOD.dark, 4);
        frect(c, bx, ty + 2, 28, 104, col); frect(c, bx + 22, ty + 2, 6, 104, 'rgba(0,0,0,.18)');
        fpoly(c, [bx, ty + 106, bx + 28, ty + 106, bx + 14, ty + 96], mix(col, '#000000', .1));
        srect(c, bx, ty + 2, 28, 104, OUT, 1.4);
        fell(c, bx + 14, ty + 34, 11, 11, '#f6e8c8'); txt(c, ch, bx + 14, ty + 35, 16, '#2a1a12', { weight: '900' });
      }
    }
  }
  function renderCliffCell(cx, cy) {
    const x0 = cx * BLOCK - (cx === 0 ? 60 : 0), x1 = (cx + 1) * BLOCK + (cx === NC - 1 ? 60 : 0);
    const y0 = cy * BLOCK - (cy === 0 ? 124 : 0), y1 = (cy + 1) * BLOCK + (cy === NC - 1 ? 30 : 0);
    const cv = mk(x1 - x0, y1 - y0), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(-x0, -y0);
    drawRing(c, x0, y0, x1, y1);
    return { cv, dx: cx * BLOCK - x0, dy: cy * BLOCK - y0 };
  }

  // ------------------------------------------------------------------ ground tiles
  function wrapDraw(S, x, y, m, fn) { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { const X = x + ox, Y = y + oy; if (X < -m || X > S + m || Y < -m || Y > S + m) continue; fn(X, Y); } }
  function makeSandTile() {
    const S = 512, cv = mk(S, S), c = cv.getContext('2d');
    c.lineCap = 'round'; c.lineJoin = 'round';
    frect(c, 0, 0, S, S, SAND.base);
    const R = rng(808);
    for (let i = 0; i < 28; i++) {
      const x = R() * S, y = R() * S, rx = 40 + R() * 100, ry = rx * (.3 + R() * .25), col = R() < .55 ? 'rgba(250,228,182,.35)' : 'rgba(190,140,80,.14)';
      wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, ry, col));
    }
    // wind ripples
    for (let i = 0; i < 90; i++) {
      const x = R() * S, y = R() * S, len = 40 + R() * 110, amp = 1.5 + R() * 3, ph = R() * TAU, sl = (R() - .5) * .2;
      wrapDraw(S, x, y, len + 10, (X, Y) => {
        const p = new Path2D();
        for (let t = 0; t <= len; t += 5) { const px = X + t, py = Y + Math.sin(t / len * TAU * .9 + ph) * amp + t * sl; t ? p.lineTo(px, py) : p.moveTo(px, py); }
        c.strokeStyle = 'rgba(176,124,66,.30)'; c.lineWidth = 2; c.stroke(p);
        c.save(); c.translate(-1, -2); c.strokeStyle = 'rgba(255,242,210,.55)'; c.lineWidth = 1.4; c.stroke(p); c.restore();
      });
    }
    for (let i = 0; i < 70; i++) { const x = R() * S, y = R() * S, r = 1.2 + R() * 2.6; wrapDraw(S, x, y, 6, (X, Y) => { fell(c, X + .8, Y + .8, r, r * .7, '#a8804e'); fell(c, X, Y, r, r * .7, R() < .5 ? '#d4ab74' : '#c49a64'); fell(c, X - r * .3, Y - r * .3, r * .4, r * .3, '#f2dcb2'); }); }
    c.fillStyle = 'rgba(150,100,50,.22)'; for (let i = 0; i < 900; i++) c.fillRect(R() * S, R() * S, 1.4, 1.4);
    c.fillStyle = 'rgba(255,246,220,.35)'; for (let i = 0; i < 500; i++) c.fillRect(R() * S, R() * S, 1.2, 1.2);
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
          frect(c, X + 3, y + 2.5, w - 7, 1.5, 'rgba(255,250,232,.38)'); frect(c, X + 3, y + RH - 4, w - 6, 1.5, 'rgba(120,80,40,.22)');
          if (R() < .35) fell(c, X + 5 + R() * (w - 10), y + 5 + R() * (RH - 10), 1.4, 1, 'rgba(120,80,40,.3)');
        }
        x += w;
      }
    }
    // worn sand drifting over the stones
    for (let i = 0; i < 10; i++) { const x = R() * S, y = R() * S, rx = 14 + R() * 26; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, rx * .45, o.drift)); }
    return cv;
  }
  function makeEmblem() {
    const W = 560, H = 420, cv = mk(W, H), c = cv.getContext('2d');
    c.translate(W / 2, H / 2); c.scale(1, .72);
    c.lineJoin = 'round';
    c.beginPath(); c.arc(0, 0, 250, 0, TAU); c.fillStyle = 'rgba(150,100,55,.22)'; c.fill();
    c.beginPath(); c.arc(0, 0, 250, 0, TAU); sk(c, 'rgba(140,90,45,.55)', 12);
    c.beginPath(); c.arc(0, 0, 236, 0, TAU); sk(c, 'rgba(255,244,214,.6)', 3);
    c.beginPath(); c.arc(0, 0, 150, 0, TAU); sk(c, 'rgba(140,90,45,.55)', 9);
    // the Sand crest: an hourglass (two triangles meeting at the waist) crossed by a bar
    for (const s of [-1, 1]) {
      const p = new Path2D(); p.moveTo(-86, s * 112); p.quadraticCurveTo(0, s * 100, 86, s * 112); p.quadraticCurveTo(40, s * 50, 7, s * 10); p.lineTo(-7, s * 10); p.quadraticCurveTo(-40, s * 50, -86, s * 112); p.closePath();
      c.fillStyle = 'rgba(160,100,48,.6)'; c.fill(p); c.strokeStyle = 'rgba(105,60,25,.75)'; c.lineWidth = 5; c.stroke(p);
      const q = new Path2D(); q.moveTo(-54, s * 96); q.quadraticCurveTo(0, s * 88, 54, s * 96); q.quadraticCurveTo(24, s * 56, 4, s * 30); q.lineTo(-4, s * 30); q.quadraticCurveTo(-24, s * 56, -54, s * 96); q.closePath();
      c.fillStyle = 'rgba(250,232,195,.45)'; c.fill(q);
    }
    rrect(c, -120, -10, 240, 20, 9); c.fillStyle = 'rgba(160,100,48,.65)'; c.fill(); sk(c, 'rgba(105,60,25,.75)', 5);
    for (const sx of [-1, 1]) { rrect(c, sx * 120 - 8, -26, 16, 52, 6); c.fillStyle = 'rgba(160,100,48,.65)'; c.fill(); sk(c, 'rgba(105,60,25,.75)', 4); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; fell(c, Math.cos(a) * 200, Math.sin(a) * 200, 9, 9, 'rgba(150,100,55,.4)'); }
    return cv;
  }

  // ------------------------------------------------------------------ props
  function drawPalm(c, x, y, s, seed) {
    const R = rng(seed), lean = (R() - .4) * 34 * s, h = (110 + R() * 26) * s, tx = x + lean, ty = y - h, cx = x + lean * .15, cy = y - h * .55;
    fell(c, x + 30 * s, y - 2, 40 * s, 10 * s, 'rgba(110,60,25,.2)');
    fell(c, x + 4, y, 10 * s, 4 * s, 'rgba(110,60,25,.3)');
    const tr = new Path2D(); tr.moveTo(x - 7 * s, y); tr.quadraticCurveTo(cx - 7 * s, cy, tx - 4 * s, ty); tr.lineTo(tx + 4 * s, ty); tr.quadraticCurveTo(cx + 7 * s, cy, x + 7 * s, y); tr.closePath();
    celFill(c, tr, '#8a6440', '#b08454', '#6a4a2c', { ld: 3 * s, dd: 4 * s });
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(tr);
    for (let t = .05; t < .98; t += .065) { const [px, py] = quadPt(x, y, cx, cy, tx, ty, t), w = (7 - 3 * t) * s; line(c, px - w, py, px + w, py + 2 * s, 'rgba(70,45,25,.75)', 1.3); }
    fell(c, tx + 2 * s, ty + 8 * s, 9 * s, 7 * s, '#b8642a'); fell(c, tx - 4 * s, ty + 6 * s, 6 * s, 5 * s, '#d8843a');
    const fr = [];
    for (let i = 0; i < 9; i++) fr.push({ a: i / 9 * TAU + R() * .35, l: (44 + R() * 18) * s });
    fr.sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
    for (const f of fr) {
      const dx = Math.cos(f.a) * f.l, dy = Math.sin(f.a) * f.l * .42;
      const ex = tx + dx, ey = ty + dy + 24 * s, mx = tx + dx * .55, my = ty + dy * .55 - 16 * s;
      const len = Math.hypot(ex - tx, ey - ty) || 1, nx = -(ey - ty) / len, ny = (ex - tx) / len, w = 7 * s;
      const p = new Path2D(); p.moveTo(tx, ty); p.quadraticCurveTo(mx + nx * w * 2, my + ny * w * 2, ex, ey); p.quadraticCurveTo(mx - nx * w * 2, my - ny * w * 2, tx, ty); p.closePath();
      const back = Math.sin(f.a) < 0;
      c.fillStyle = back ? '#3f7434' : '#4f8f3a'; c.fill(p);
      c.strokeStyle = '#1f3d1c'; c.lineWidth = 1.3; c.stroke(p);
      c.strokeStyle = back ? 'rgba(120,180,80,.4)' : 'rgba(150,205,95,.75)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
      c.strokeStyle = 'rgba(25,50,20,.5)'; c.lineWidth = 1; c.beginPath();
      for (let t = .2; t < .95; t += .12) { const [px, py] = quadPt(tx, ty, mx, my, ex, ey, t); c.moveTo(px, py); c.lineTo(px + nx * w * 1.2 + 2, py + ny * w * 1.2 + 4); } c.stroke();
    }
  }
  function makeProps() {
    const P = {};
    P.rocks = [11, 16, 23, 31].map((r, i) => sprite(Math.ceil(r * 3 + 14), Math.ceil(r * 1.9 + 16), Math.round(r * 1.35 + 5), Math.round(r * 1.25 + 6), (c, ax, ay) => standRock(c, ax, ay, r, 300 + i * 17)));
    P.palms = [0, 1, 2].map(i => sprite(170, 200, 80, 190, (c, ax, ay) => drawPalm(c, ax, ay, .95 + i * .1, 900 + i * 31)));
    P.shrub = sprite(70, 50, 34, 42, (c, ax, ay) => {
      fell(c, ax + 8, ay, 26, 7, 'rgba(110,60,25,.25)');
      const R = rng(5);
      for (let i = 0; i < 9; i++) { const a = R() * Math.PI, d = 4 + R() * 12; line(c, ax, ay, ax + Math.cos(a + Math.PI) * d * 1.6, ay - 6 - Math.sin(a) * d, '#6b4a2a', 1.4); }
      const blobs = []; for (let i = 0; i < 9; i++) blobs.push([ax + (R() - .5) * 38, ay - 10 - R() * 18, 6 + R() * 6]);
      blobs.sort((p, q) => p[1] - q[1]);
      for (const [x, y, r] of blobs) fell(c, x, y, r + 1.6, r + 1.4, '#3e4a1e');
      for (const [x, y, r] of blobs) { fell(c, x, y, r, r * .9, '#7f8f3c'); fell(c, x - r * .25, y - r * .3, r * .55, r * .45, '#a8b45c'); }
    });
    P.agave = sprite(70, 56, 35, 50, (c, ax, ay) => {
      fell(c, ax + 6, ay, 24, 6, 'rgba(110,60,25,.25)');
      const ls = []; for (let i = 0; i < 11; i++) { const a = Math.PI + (i / 10) * Math.PI; ls.push([Math.cos(a) * (18 + (i % 2) * 8), Math.sin(a) * (24 + (i % 3) * 8)]); }
      ls.sort((p, q) => Math.abs(q[0]) - Math.abs(p[0]));
      for (const [dx, dy] of ls) { fpoly(c, [ax - 4, ay - 2, ax + dx, ay + dy, ax + 4, ay - 2], dx < 0 ? '#7fa889' : '#5f8a6c'); poly(c, [ax - 4, ay - 2, ax + dx, ay + dy, ax + 4, ay - 2]); sk(c, '#2a4432', 1.1); }
    });
    P.well = sprite(100, 100, 50, 86, (c, ax, ay) => {
      fell(c, ax + 10, ay, 40, 11, 'rgba(110,60,25,.28)');
      const S = toneW('#c9a67a');
      const g = cylinder(c, ax, ay - 34, 30, 22, S, { paint: (cc, gg) => { cc.strokeStyle = 'rgba(90,60,35,.5)'; cc.lineWidth = 1; cc.beginPath(); for (let yy = gg.ty + 4; yy < gg.by + gg.ry; yy += 8) { cc.moveTo(gg.cx - gg.rx, yy + gg.ry * .6); cc.lineTo(gg.cx + gg.rx, yy + gg.ry * .6); } cc.stroke(); } });
      fell(c, ax, g.ty, 30, g.ry, S.light); fell(c, ax, g.ty + 1, 24, g.ry - 3, '#3a5866'); fell(c, ax + 4, g.ty + 2, 16, g.ry - 6, '#4f7a8a');
      c.beginPath(); c.ellipse(ax, g.ty, 30, g.ry, 0, 0, TAU); sk(c, OUT, 1.6);
      for (const px of [ax - 26, ax + 26]) { line(c, px, ay - 22, px, ay - 76, OUT, 5); line(c, px, ay - 22, px, ay - 76, WOOD.light, 3); }
      line(c, ax - 30, ay - 74, ax + 30, ay - 74, OUT, 5); line(c, ax - 30, ay - 74, ax + 30, ay - 74, WOOD.base, 3);
      line(c, ax + 6, ay - 74, ax + 6, ay - 50, '#d8c49a', 1.2);
      frect(c, ax + 1, ay - 50, 10, 9, WOOD.base); srect(c, ax + 1, ay - 50, 10, 9, OUT, 1.1);
    });
    const stall = (cl, cl2, kind) => sprite(140, 120, 70, 108, (c, ax, ay) => {
      fell(c, ax + 14, ay, 62, 12, 'rgba(110,60,25,.24)');
      for (const px of [ax - 52, ax + 52]) line(c, px, ay - 86, px, ay - 22, WOOD.dark, 3);
      frect(c, ax - 50, ay - 30, 100, 30, WOOD.base); frect(c, ax - 50, ay - 30, 100, 5, WOOD.light);
      c.strokeStyle = WOOD.dark; c.lineWidth = 1.2; c.beginPath(); for (let px = ax - 40; px < ax + 50; px += 12) { c.moveTo(px, ay - 25); c.lineTo(px, ay); } c.stroke();
      srect(c, ax - 50, ay - 30, 100, 30, OUT, 1.4);
      if (kind === 0) { for (let k = 0; k < 4; k++) { const gx = ax - 36 + k * 24; fell(c, gx, ay - 33, 10, 5, '#e08a2a'); fell(c, gx - 2, ay - 36, 6, 3, '#f2b04a'); c.beginPath(); c.ellipse(gx, ay - 33, 10, 5, 0, 0, TAU); sk(c, 'rgba(59,42,34,.7)', 1); } }
      else if (kind === 1) { pot(c, ax - 30, ay - 30, .8); pot(c, ax - 8, ay - 30, 1, '#c98a4c'); pot(c, ax + 14, ay - 30, .7, '#a85a34'); pot(c, ax + 34, ay - 30, .9); }
      else { for (let k = 0; k < 5; k++) { const gx = ax - 38 + k * 19; frect(c, gx, ay - 40, 15, 10, CLOTH[k]); srect(c, gx, ay - 40, 15, 10, OUT, 1); fell(c, gx + 15, ay - 35, 2.5, 5, mix(CLOTH[k], '#000000', .2)); } }
      awning(c, ax - 52, ay - 92, 104, 28, cl, cl2, ay);
    });
    P.stalls = [stall('#b8432e', '#efe3c8', 0), stall('#2f6f8f', '#efe3c8', 1), stall('#d9822b', '#7b3f6b', 2)];
    P.rug = sprite(130, 60, 62, 46, (c, ax, ay) => {
      fpoly(c, [ax - 46, ay - 26, ax + 50, ay - 26, ax + 56, ay + 4, ax - 40, ay + 4], 'rgba(90,45,20,.2)');
      const q = [ax - 50, ay - 30, ax + 46, ay - 30, ax + 52, ay, ax - 44, ay];
      fpoly(c, q, '#9a3426');
      c.save(); poly(c, q); c.clip();
      for (let i = 0; i < 6; i++) frect(c, ax - 60, ay - 27 + i * 5, 120, 2, i % 2 ? '#e8c46a' : '#2f5f7f');
      frect(c, ax - 60, ay - 18, 120, 6, '#efe3c8'); c.restore();
      poly(c, q); sk(c, OUT, 1.3);
      pot(c, ax - 28, ay - 8, .8); pot(c, ax - 10, ay - 6, 1, '#c98a4c'); pot(c, ax + 10, ay - 8, .7, '#a85a34');
      for (let k = 0; k < 3; k++) { fell(c, ax + 28 + k * 8, ay - 10 - (k % 2) * 4, 6, 4, ['#e08a2a', '#8ab04a', '#c0392b'][k]); }
    });
    P.cart = sprite(120, 80, 56, 66, (c, ax, ay) => {
      fell(c, ax + 12, ay, 50, 9, 'rgba(110,60,25,.26)');
      line(c, ax + 30, ay - 22, ax + 58, ay - 10, OUT, 4.5); line(c, ax + 30, ay - 22, ax + 58, ay - 10, WOOD.light, 2.5);
      fpoly(c, [ax - 40, ay - 40, ax + 34, ay - 40, ax + 38, ay - 46, ax - 36, ay - 46], WOOD.light);
      frect(c, ax - 40, ay - 40, 74, 18, WOOD.base); c.strokeStyle = WOOD.dark; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax - 40, ay - 31); c.lineTo(ax + 34, ay - 31); c.stroke();
      srect(c, ax - 40, ay - 40, 74, 18, OUT, 1.4);
      for (const [dx, col] of [[-26, '#e9dcc0'], [-6, '#d9c7a0'], [14, '#e9dcc0']]) { fell(c, ax + dx, ay - 46, 11, 8, col); c.beginPath(); c.ellipse(ax + dx, ay - 46, 11, 8, 0, 0, TAU); sk(c, OUT, 1.2); line(c, ax + dx - 3, ay - 53, ax + dx + 3, ay - 53, '#8a6a42', 2); }
      for (const wx of [-24, 18]) { fell(c, ax + wx, ay - 12, 12, 12, WOOD.dark); fell(c, ax + wx, ay - 12, 8, 8, WOOD.base); fell(c, ax + wx, ay - 12, 2.5, 2.5, WOOD.deep); c.beginPath(); c.arc(ax + wx, ay - 12, 12, 0, TAU); sk(c, OUT, 1.4); }
    });
    P.crates = sprite(80, 70, 36, 62, (c, ax, ay) => {
      fell(c, ax + 12, ay, 34, 8, 'rgba(110,60,25,.26)');
      const box = (x, y, w, h, d) => {
        fpoly(c, [x, y, x + w, y, x + w + d * .4, y - d, x + d * .4, y - d], WOOD.light);
        frect(c, x, y, w, h, WOOD.base); c.strokeStyle = WOOD.dark; c.lineWidth = 1.2; c.beginPath(); for (let yy = y + h / 3; yy < y + h - 1; yy += h / 3) { c.moveTo(x, yy); c.lineTo(x + w, yy); } c.moveTo(x, y); c.lineTo(x + w, y + h); c.stroke();
        fpoly(c, [x + w, y, x + w + d * .4, y - d, x + w + d * .4, y + h - d, x + w, y + h], WOOD.dark);
        poly(c, [x, y, x + d * .4, y - d, x + w + d * .4, y - d, x + w + d * .4, y + h - d, x + w, y + h, x, y + h]); sk(c, OUT, 1.4);
      };
      box(ax - 30, ay - 24, 30, 24, 14); box(ax + 2, ay - 22, 26, 22, 12); box(ax - 20, ay - 48, 26, 22, 12);
    });
    P.barrels = sprite(70, 60, 32, 54, (c, ax, ay) => {
      fell(c, ax + 10, ay, 30, 7, 'rgba(110,60,25,.26)');
      const T = toneW('#9a6a40');
      for (const [dx, dy] of [[-14, -2], [12, 0]]) { const g = cylinder(c, ax + dx, ay + dy - 34, 13, 28, T, { band: [[5, 3, T.deep], [20, 3, T.deep]], dirt: false }); fell(c, g.cx, g.ty, 13, g.ry, T.light); c.beginPath(); c.ellipse(g.cx, g.ty, 13, g.ry, 0, 0, TAU); sk(c, OUT, 1.4); }
    });
    P.pots = sprite(70, 50, 30, 44, (c, ax, ay) => { pot(c, ax - 14, ay - 4, 1.1); pot(c, ax + 6, ay - 1, 1.3, '#c98a4c'); pot(c, ax + 22, ay + 1, .8, '#a85a34'); });
    P.lamp = sprite(56, 112, 24, 104, (c, ax, ay) => {
      fell(c, ax + 6, ay, 12, 4, 'rgba(110,60,25,.3)');
      frect(c, ax - 7, ay - 8, 14, 8, '#b9946a'); srect(c, ax - 7, ay - 8, 14, 8, OUT, 1.2);
      line(c, ax, ay - 6, ax, ay - 86, OUT, 5); line(c, ax, ay - 6, ax, ay - 86, WOOD.base, 3);
      line(c, ax, ay - 82, ax + 20, ay - 82, OUT, 4); line(c, ax, ay - 82, ax + 20, ay - 82, WOOD.base, 2);
      line(c, ax + 18, ay - 82, ax + 18, ay - 76, '#3a2a20', 1.4);
      fpoly(c, [ax + 11, ay - 76, ax + 25, ay - 76, ax + 22, ay - 72, ax + 14, ay - 72], '#5a3a22');
      frect(c, ax + 12, ay - 72, 12, 16, '#f3b24a'); frect(c, ax + 12, ay - 72, 4, 16, '#ffe0a0'); srect(c, ax + 12, ay - 72, 12, 16, OUT, 1.2);
      frect(c, ax + 11, ay - 56, 14, 3, '#5a3a22');
    });
    P.torch = sprite(40, 80, 20, 72, (c, ax, ay) => {
      fell(c, ax + 5, ay, 10, 3, 'rgba(110,60,25,.3)');
      line(c, ax, ay, ax, ay - 50, OUT, 5); line(c, ax, ay, ax, ay - 50, WOOD.base, 3);
      fpoly(c, [ax - 9, ay - 54, ax + 9, ay - 54, ax + 5, ay - 46, ax - 5, ay - 46], '#5a4030'); poly(c, [ax - 9, ay - 54, ax + 9, ay - 54, ax + 5, ay - 46, ax - 5, ay - 46]); sk(c, OUT, 1.2);
      fpoly(c, [ax - 7, ay - 55, ax - 2, ay - 70, ax, ay - 62, ax + 3, ay - 72, ax + 7, ay - 55], '#f08a2a');
      fpoly(c, [ax - 4, ay - 55, ax, ay - 65, ax + 4, ay - 55], '#ffd86a');
    });
    P.laundry = sprite(150, 80, 75, 70, (c, ax, ay) => {
      for (const px of [ax - 62, ax + 62]) { fell(c, px + 4, ay, 6, 2, 'rgba(110,60,25,.3)'); post(c, px, ay, ay - 58); }
      laundry(c, ax - 62, ay - 54, ax + 62, ay - 54, 333, 9);
    });
    P.sign = sprite(60, 70, 30, 62, (c, ax, ay) => {
      fell(c, ax + 6, ay, 14, 4, 'rgba(110,60,25,.3)');
      post(c, ax, ay, ay - 30);
      frect(c, ax - 22, ay - 56, 44, 28, '#c99a62'); frect(c, ax - 22, ay - 56, 44, 4, '#e2b77c'); srect(c, ax - 22, ay - 56, 44, 28, OUT, 1.6);
      txt(c, '砂', ax, ay - 41, 18, '#3a1a10', { weight: '900' });
    });
    P.bench = sprite(80, 40, 38, 32, (c, ax, ay) => {
      fell(c, ax + 8, ay, 36, 6, 'rgba(110,60,25,.26)');
      frect(c, ax - 30, ay - 12, 8, 12, '#c4a272'); frect(c, ax + 22, ay - 12, 8, 12, '#c4a272');
      frect(c, ax - 34, ay - 20, 68, 9, '#e6cfa2'); frect(c, ax - 34, ay - 20, 68, 3, '#f6e6c4'); srect(c, ax - 34, ay - 20, 68, 9, OUT, 1.4);
      srect(c, ax - 30, ay - 11, 8, 11, OUT, 1.2); srect(c, ax + 22, ay - 11, 8, 11, OUT, 1.2);
    });
    P.planter = sprite(170, 220, 80, 206, (c, ax, ay) => {
      fell(c, ax + 12, ay, 46, 12, 'rgba(110,60,25,.28)');
      const S = toneW('#d2b07e');
      const g = cylinder(c, ax, ay - 30, 40, 18, S, { dirt: false });
      fell(c, ax, g.ty, 40, g.ry, S.light); fell(c, ax, g.ty + 1, 34, g.ry - 3, '#8a6a42');
      c.beginPath(); c.ellipse(ax, g.ty, 40, g.ry, 0, 0, TAU); sk(c, OUT, 1.6);
      drawPalm(c, ax, g.ty + 2, 1, 1234);
    });
    return P;
  }

  // ------------------------------------------------------------------ ambient sprites
  function makeStreaks() {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const W = 260 + i * 70, H = 26, cv = mk(W, H), c = cv.getContext('2d'), R = rng(70 + i);
      c.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const g = c.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(250,230,190,0)'); g.addColorStop(.3 + R() * .2, 'rgba(250,232,195,.75)'); g.addColorStop(1, 'rgba(250,230,190,0)');
        c.strokeStyle = g; c.lineWidth = 1.2 + R() * 2.2;
        c.beginPath(); const y0 = 6 + R() * 14, ph = R() * TAU;
        for (let x = 0; x <= W; x += 10) { const y = y0 + Math.sin(x / W * TAU + ph) * 3; x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
      out.push(cv);
    }
    return out;
  }

  // ------------------------------------------------------------------ state
  const A = {};
  let ready = false;
  const foots = [];       // footprint array (stable order)
  const objs = [];        // drawable objects sorted by base y
  const lanternsLocal = [];

  function buildingCanvas(fn, P, w, h) {
    const cv = mk(w + SM * 2, h + OVER + BM), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(SM, OVER);
    fn(c, P);
    return cv;
  }
  function inRect(x, y, r, m) { return x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m; }
  function inPlaza(x, y, m) { const dx = (x - PLAZA.x) / (PLAZA.rx + m), dy = (y - PLAZA.y) / (PLAZA.ry + m); return dx * dx + dy * dy < 1; }

  function build() {
    A.sandPat = null;
    const tmp = mk(4, 4).getContext('2d');
    A.sand = makeSandTile(); A.sandPat = tmp.createPattern(A.sand, 'repeat');
    A.pavePat = tmp.createPattern(makePaveTile({ seed: 77, rh: 24, wmin: 20, wmax: 44, grout: '#b8946a', drift: 'rgba(226,196,140,.35)', tones: ['#e8d5ab', '#e2cb9f', '#dcc396', '#ecdcb7', '#d9bd90'] }), 'repeat');
    A.dirtPat = tmp.createPattern(makePaveTile({ seed: 91, rh: 16, wmin: 14, wmax: 30, grout: '#b38654', drift: 'rgba(226,192,138,.55)', tones: ['#d8b684', '#d1ad7a', '#dcbd8e', '#cca673'] }), 'repeat');
    A.emblem = makeEmblem();
    A.props = makeProps();
    A.streaks = makeStreaks();
    TOP = topPolygon();
    genCliffFeatures();

    foots.length = 0; objs.length = 0; lanternsLocal.length = 0;
    const addFoot = f => { foots.push(f); return foots.length - 1; };
    const addLamp = (x, y) => lanternsLocal.push({ x: Math.round(x), y: Math.round(y) });

    // ---- cliff ring: one solid footprint per perimeter cell
    const tiles = {};
    const tileFor = (cx, cy) => {
      let key = cx + ',' + cy;
      if (cy === 0 && cx > 0 && cx < NC - 1) key = 'N';
      else if (cy === NC - 1 && cx > 0 && cx < NC - 1) key = 'S';
      else if (cx === 0 && cy > 0 && cy < NC - 1) key = 'W';
      else if (cx === NC - 1 && cy > 0 && cy < NC - 1 && cy !== 4 && cy !== 5) key = 'E';
      if (!tiles[key]) tiles[key] = renderCliffCell(key === 'N' ? 1 : key === 'S' ? 1 : key === 'W' ? 0 : key === 'E' ? NC - 1 : cx, key === 'N' ? 0 : key === 'S' ? NC - 1 : key === 'W' ? 1 : key === 'E' ? 1 : cy);
      return tiles[key];
    };
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      if (cx > 0 && cx < NC - 1 && cy > 0 && cy < NC - 1) continue;
      const gx = cx * BLOCK, gy = cy * BLOCK;
      let f;
      if ((cx === 0 || cx === NC - 1) && (cy === 0 || cy === NC - 1)) f = { x: gx, y: gy, w: BLOCK, h: BLOCK };
      else if (cy === 0) f = { x: gx, y: 0, w: BLOCK, h: 400 };
      else if (cy === NC - 1) f = { x: gx, y: 4800, w: BLOCK, h: 400 };
      else if (cx === 0) f = { x: 0, y: gy, w: 400, h: BLOCK };
      else if (cy === 4) f = { x: 4800, y: gy, w: 400, h: GN - gy };
      else if (cy === 5) f = { x: 4800, y: GS, w: 400, h: gy + BLOCK - GS };
      else f = { x: 4800, y: gy, w: 400, h: BLOCK };
      Object.assign(f, { solid: true, roof: '#c99560', wall: '#b98a54' });
      const fi = addFoot(f), t = tileFor(cx, cy);
      objs.push({ img: t.cv, x: gx - t.dx, y: gy - t.dy, w: t.cv.width, h: t.cv.height, by: f.y + f.h, fi, solid: true });
    }

    // ---- Kazekage building
    {
      const P = { lamps: [] };
      const cv = buildingCanvas(lmKazekage, P, KW, KH);
      const fi = addFoot({ x: KAZE.x, y: KAZE.y, w: KW, h: KH, roof: '#dcb47a', wall: '#e8c994' });
      objs.push({ img: cv, x: KAZE.x - SM, y: KAZE.y - OVER, w: cv.width, h: cv.height, by: KAZE.y + KH, fi });
      for (const [lx, ly] of P.lamps) addLamp(KAZE.x + lx, KAZE.y + ly);
    }

    // ---- houses (one cached canvas per variant)
    const cache = {};
    for (const [cx, cy, key, ox, oy] of HOUSES) {
      const v = VAR[key];
      if (!cache[key]) {
        const P = { W: WALLS[v[1]], W2: WALLS[v[2]], R: DOMES[v[3]], R2: DOMES[v[4]], cl: CLOTH[v[5]], cl2: CLOTH[v[6]], idx: Object.keys(cache).length, lamps: [],
          stalls: [[CLOTH[v[5]], '#efe3c8'], [CLOTH[v[6]], '#efe3c8'], ['#d9822b', '#7b3f6b']] };
        cache[key] = { cv: buildingCanvas(v[0], P, FW, FH), lamps: P.lamps, roof: P.R.base, wall: P.W.base };
      }
      const e = cache[key], x = cx * BLOCK + ox, y = cy * BLOCK + oy;
      const fi = addFoot({ x, y, w: FW, h: FH, roof: e.roof, wall: e.wall });
      objs.push({ img: e.cv, x: x - SM, y: y - OVER, w: e.cv.width, h: e.cv.height, by: y + FH, fi });
      for (const [lx, ly] of e.lamps) addLamp(x + lx, y + ly);
    }

    // ---- props
    const PR = A.props, taken = [];
    const blocked = (x, y, m) => {
      if (x < 450 || x > 4750 || y < 470 || y > 4760) return true;
      if (inPlaza(x, y, m + 10) || inRect(x, y, AVENUE, m + 6) || inRect(x, y, APRON, m)) return true;
      if (x > 4600 && y > 2440 && y < 2760) return true;
      for (const s of STREETS) if (inRect(x, y, s, m)) return true;
      for (const f of foots) if (inRect(x, y, f, m + 14)) return true;
      for (const t of taken) if (Math.hypot(t[0] - x, t[1] - y) < t[2] + m) return true;
      return false;
    };
    const place = (s, x, y, m, lampDy) => {
      taken.push([x, y, m]);
      objs.push({ img: s.cv, x: Math.round(x - s.ax), y: Math.round(y - s.ay), w: s.cv.width, h: s.cv.height, by: y, fi: -1 });
      if (lampDy) addLamp(x + lampDy[0], y + lampDy[1]);
    };
    // plaza: lamps round the rim, two palm planters, benches, the village sign
    for (const deg of [100, 150, 205, 40, 0]) {
      const a = deg * Math.PI / 180, x = PLAZA.x + (PLAZA.rx + 26) * Math.cos(a), y = PLAZA.y + (PLAZA.ry + 18) * Math.sin(a);
      place(PR.lamp, x, y, 30, [18, -64]);
    }
    place(PR.planter, PLAZA.x - 250, PLAZA.y + 40, 60); place(PR.planter, PLAZA.x + 250, PLAZA.y + 40, 60);
    place(PR.bench, PLAZA.x - 150, PLAZA.y + 190, 30); place(PR.bench, PLAZA.x + 150, PLAZA.y + 190, 30);
    place(PR.sign, 2470, 2486, 20);
    // avenue: lamps along both kerbs, torches at the canyon mouth
    for (let x = 2820, i = 0; x < 4640; x += 340, i++) place(PR.lamp, x, i % 2 ? AVENUE.y - 6 : AVENUE.y + AVENUE.h + 14, 24, [18, -64]);
    for (const y of [AVENUE.y - 8, AVENUE.y + AVENUE.h + 12]) place(PR.torch, 4740, y, 20, [0, -62]);
    // the open cells: little themed clusters
    const houseCells = new Set(HOUSES.map(h => h[0] + ',' + h[1]).concat(['4,4', '4,5', '5,5']));
    for (let cy = 1; cy < NC - 1; cy++) for (let cx = 1; cx < NC - 1; cx++) {
      if (houseCells.has(cx + ',' + cy)) continue;
      const R = rng(cx * 977 + cy * 7919 + 3), theme = Math.floor(hash2(cx, cy, 5) * 5);
      const list = theme === 0 ? [PR.rocks[3], PR.rocks[2], PR.shrub, PR.rocks[0], PR.agave, PR.rocks[1], PR.shrub]
        : theme === 1 ? [PR.palms[0], PR.palms[2], PR.palms[1], PR.rocks[2], PR.shrub, PR.agave, PR.rocks[0]]
        : theme === 2 ? [PR.well, PR.pots, PR.laundry, PR.shrub, PR.crates, PR.palms[1], PR.rug]
        : theme === 3 ? [PR.rug, PR.crates, PR.pots, PR.cart]
        : [PR.cart, PR.crates, PR.barrels, PR.agave, PR.rocks[1], PR.palms[1], PR.laundry];
      if (theme === 3) {
        // a little bazaar: a straight row of stalls
        for (let tries = 0; tries < 6; tries++) {
          const y = cy * BLOCK + 170 + R() * 240, x0 = cx * BLOCK + 110 + R() * 40;
          const xs = [x0, x0 + 132, x0 + 264].filter(x => !blocked(x, y, 56));
          if (xs.length < 2) continue;
          xs.forEach((x, i) => place(PR.stalls[(i + cx + cy) % 3], x, y, 56));
          break;
        }
      }
      for (const s of list) {
        const m = Math.max(24, s.cv.width * .4);
        for (let tries = 0; tries < 14; tries++) {
          const x = cx * BLOCK + 80 + R() * 360, y = cy * BLOCK + 90 + R() * 360;
          if (blocked(x, y, m)) continue;
          place(s, x, y, m);
          break;
        }
      }
    }
    // a few stray rocks and shrubs in the lanes beside the cliffs
    { const R = rng(4242); for (let i = 0; i < 80; i++) { const x = 460 + R() * 4280, y = 470 + R() * 4280; const s = R() < .45 ? PR.rocks[Math.floor(R() * 2)] : R() < .6 ? PR.shrub : PR.agave; if (!blocked(x, y, 24)) place(s, x, y, 24); } }
    objs.sort((p, q) => p.by - q.by || p.x - q.x);
    ready = true;
  }

  // ------------------------------------------------------------------ drawing
  function fillPaths(ctx, x0, y0, x1, y1) {
    const hit = r => r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0;
    for (const s of STREETS) if (hit(s)) {
      const v = s.w < s.h;
      ctx.fillStyle = '#a97d4c'; if (v) { ctx.fillRect(s.x - 5, s.y, 6, s.h); ctx.fillRect(s.x + s.w - 1, s.y, 6, s.h); } else { ctx.fillRect(s.x, s.y - 5, s.w, 6); ctx.fillRect(s.x, s.y + s.h - 1, s.w, 6); }
      ctx.fillStyle = 'rgba(255,240,205,.55)'; if (v) { ctx.fillRect(s.x - 5, s.y, 2, s.h); ctx.fillRect(s.x + s.w - 1, s.y, 2, s.h); } else { ctx.fillRect(s.x, s.y - 5, s.w, 2); ctx.fillRect(s.x, s.y + s.h - 1, s.w, 2); }
    }
    ctx.fillStyle = A.dirtPat;
    for (const s of STREETS) if (hit(s)) ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = A.pavePat;
    if (hit(AVENUE)) ctx.fillRect(AVENUE.x, AVENUE.y, AVENUE.w, AVENUE.h);
    if (hit(APRON)) ctx.fillRect(APRON.x, APRON.y, APRON.w, APRON.h);
    const pr = { x: PLAZA.x - PLAZA.rx - 20, y: PLAZA.y - PLAZA.ry - 20, w: PLAZA.rx * 2 + 40, h: PLAZA.ry * 2 + 40 };
    if (hit(pr)) { ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill(); }
    if (hit(AVENUE)) {
      ctx.fillStyle = '#b68e5c'; ctx.fillRect(AVENUE.x + 200, AVENUE.y - 7, AVENUE.w - 200, 8); ctx.fillRect(AVENUE.x + 200, AVENUE.y + AVENUE.h - 1, AVENUE.w - 200, 8);
      ctx.fillStyle = '#ecd6aa'; ctx.fillRect(AVENUE.x + 200, AVENUE.y - 7, AVENUE.w - 200, 2); ctx.fillRect(AVENUE.x + 200, AVENUE.y + AVENUE.h - 1, AVENUE.w - 200, 2);
    }
    if (hit(pr)) {
      ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU);
      ctx.strokeStyle = '#b68e5c'; ctx.lineWidth = 12; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx - 7, PLAZA.ry - 7, 0, 0, TAU); ctx.strokeStyle = '#efdcb4'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx + 6, PLAZA.ry + 6, 0, 0, TAU); ctx.strokeStyle = 'rgba(90,55,25,.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.drawImage(A.emblem, PLAZA.x - A.emblem.width / 2, PLAZA.y - A.emblem.height / 2);
    }
  }

  function drawStatic(ctx, bounds, isDestroyed) {
    if (!ready) build();
    const x0 = bounds.x, y0 = bounds.y, x1 = bounds.x + bounds.w, y1 = bounds.y + bounds.h;
    const ix0 = Math.max(0, x0), iy0 = Math.max(0, y0), ix1 = Math.min(SIZE, x1), iy1 = Math.min(SIZE, y1);
    if (ix1 <= ix0 || iy1 <= iy0) {
      if (x1 < -160 || x0 > SIZE + 160 || y1 < -160 || y0 > SIZE + 160) return;
    }
    ctx.save();
    if (ix1 > ix0 && iy1 > iy0) {
      ctx.fillStyle = A.sandPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      fillPaths(ctx, ix0, iy0, ix1, iy1);
    }
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (o.x > x1 || o.x + o.w < x0 || o.y > y1 || o.y + o.h < y0) continue;
      if (o.fi >= 0 && isDestroyed && isDestroyed(o.fi)) continue;
      ctx.drawImage(o.img, o.x, o.y);
    }
    ctx.restore();
  }

  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    const t = time || 0, vx0 = Math.max(view.x, -150), vy0 = Math.max(view.y, -150), vx1 = Math.min(view.x + view.w, SIZE + 150), vy1 = Math.min(view.y + view.h, SIZE + 150);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    ctx.save();
    const P = 1300;
    for (let i = 0; i < 9; i++) {
      const v = 150 + hash2(i, 1, 9) * 160, bx = hash2(i, 2, 9) * P, by = hash2(i, 3, 9) * P;
      const life = Math.sin((t * .35 + hash2(i, 4, 9) * 7) % Math.PI);
      if (life < .05) continue;
      ctx.globalAlpha = .22 * life + .05;
      const img = A.streaks[i % 3];
      const x = ((bx - t * v) % P + P) % P, y = by + Math.sin(t * .6 + i) * 18;
      for (let kx = Math.floor((vx0 - img.width - x) / P); x + kx * P < vx1; kx++) for (let ky = Math.floor((vy0 - 30 - y) / P); y + ky * P < vy1; ky++) ctx.drawImage(img, x + kx * P, y + ky * P);
    }
    ctx.globalAlpha = .5; ctx.fillStyle = '#f6e2b4';
    const Q = 700;
    for (let i = 0; i < 18; i++) {
      const v = 90 + hash2(i, 5, 3) * 120, bx = hash2(i, 6, 3) * Q, by = hash2(i, 7, 3) * Q;
      const x = ((bx - t * v) % Q + Q) % Q, y = by + Math.sin(t * 2 + i * 1.7) * 10;
      for (let kx = Math.floor((vx0 - x) / Q); x + kx * Q < vx1; kx++) for (let ky = Math.floor((vy0 - y) / Q); y + ky * Q < vy1; ky++) ctx.fillRect(x + kx * Q, y + ky * Q, 2.4, 1.6);
    }
    ctx.restore();
  }

  function drawMinimap(ctx) {
    if (!ready) build();
    ctx.save();
    ctx.fillStyle = SAND.base; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#cfa46c'; for (const s of STREETS) ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#ecd8ae'; ctx.fillRect(AVENUE.x, AVENUE.y, SIZE - AVENUE.x, AVENUE.h); ctx.fillRect(APRON.x, APRON.y, APRON.w, APRON.h);
    ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
    for (const f of foots) {
      if (f.solid) { ctx.fillStyle = '#b9864f'; ctx.fillRect(f.x, f.y, f.w, f.h); }
      else if (f.x === KAZE.x && f.y === KAZE.y) continue;
      else { ctx.fillStyle = f.roof; ctx.fillRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40); ctx.strokeStyle = '#6b4428'; ctx.lineWidth = 14; ctx.strokeRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40); }
    }
    ctx.fillStyle = '#d06a3a'; ctx.beginPath(); ctx.ellipse(KAZE.x + KW / 2, KAZE.y + KH / 2, KW / 2, KH / 2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 44; ctx.stroke();
    ctx.strokeStyle = '#5a2414'; ctx.lineWidth = 14; ctx.stroke();
    ctx.restore();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  const mod = window.ShinobiVillages.suna = {
    id: 'suna', name: 'LÀNG CÁT', jp: '砂隠れの里', kage: 'KAZEKAGE',
    cols: NC, rows: NC,
    gate: { side: 'e', at: 2600 },
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
