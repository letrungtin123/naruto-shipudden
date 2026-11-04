/* village-kiri.js — Kirigakure (Hidden Mist Village, Land of Water) in 3/4 oblique view.
   Registers window.ShinobiVillages.kiri. Self-contained procedural Canvas 2D art (no images).
   Local coords: the village is a 5200x5200 island; (0,0) is its top-left corner. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, NC = 10, SIZE = BLOCK * NC;
  const E = 120;                       // sea band between the island edge and the stone platforms
  const CW = 130, CANALS = [1560, 3640]; // canal centre lines (both axes) and width
  const FACE = 24;                     // height of a platform's south stone face
  const PATH0 = 2520, PATH1 = 2680;    // gate path corridor (west edge -> plaza)
  const OUT = '#2b2f34';
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const MX = 34, MT = 132, MB = 26;    // building sprite margins around the footprint
  const PLAZA = { x: 2860, y: 2810, rx: 370, ry: 250 };
  const SPAWN = { x: 2860, y: 2700 };

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
  function tone(base) { return { base, light: mix(base, '#eef8fa', .3), hi: mix(base, '#ffffff', .55), dark: mix(base, '#1b2733', .28), deep: mix(base, '#0f1820', .5) }; }

  // ------------------------------------------------------------------ primitives
  function poly(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
  function fpoly(c, p, col) { poly(c, p); c.fillStyle = col; c.fill(); }
  function frect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function fell(c, x, y, rx, ry, col) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); c.fillStyle = col; c.fill(); }
  function sk(c, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
  function line(c, x1, y1, x2, y2, col, lw) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); sk(c, col, lw); }
  function srect(c, x, y, w, h, col = OUT, lw = 2) { c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
  function rrPath(x, y, w, h, r) { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; }
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
  function sprite(w, h, ax, ay, fn) { const cv = mk(w, h), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; fn(c, ax, ay); return { cv, ax, ay }; }

  // ------------------------------------------------------------------ palettes
  const ROOFS = ['#3f8a8b', '#5b7689', '#4a5866', '#4c9584', '#46709a', '#6a8c91'].map(tone);
  const WALLS = ['#e4e8e2', '#d5dcd7', '#ebe6d9', '#cfd8d8'].map(tone);
  const TANKS = ['#6f8f96', '#8a9ba2', '#5f7f7a'];
  const ROCK = { base: '#7e8a8f', light: '#a6b1b3', dark: '#5a656b', out: '#283036' };
  const WOODK = { base: '#7a6a5a', light: '#9c8a76', dark: '#56493d', deep: '#3a3129' };
  const PINEK = { out: '#16262a', dark: '#24413e', mid: '#335a54', light: '#4e786e', hi: '#79a395' };
  const LANT = '#b24a3c';

  // ------------------------------------------------------------------ building kit
  function plinth(c, w, h, col = '#a2aaa9') {
    frect(c, 0, 0, w, h, col);
    c.strokeStyle = 'rgba(55,68,76,.32)'; c.lineWidth = 1; c.beginPath();
    for (let y = 18; y < h; y += 18) { c.moveTo(0, y); c.lineTo(w, y); }
    for (let y = 0, r = 0; y < h; y += 18, r++) for (let x = (r % 2) * 16; x < w; x += 32) { c.moveTo(x, y); c.lineTo(x, Math.min(h, y + 18)); }
    c.stroke();
    frect(c, 0, 0, w, 3, 'rgba(255,255,255,.25)'); frect(c, 0, 0, 3, h, 'rgba(255,255,255,.18)');
    frect(c, 0, h - 6, w, 6, '#6c777b');
    srect(c, .75, .75, w - 1.5, h - 1.5, 'rgba(30,40,48,.65)', 1.5);
  }
  function wall(c, x, y, w, h, W, o = {}) {
    frect(c, x, y, w, h, W.base);
    const bh = o.bandH ?? 10;
    if (o.band) { frect(c, x, y, w, bh, o.band); frect(c, x, y + bh, w, 2, 'rgba(20,30,40,.25)'); }
    const fh = o.found ?? 8;
    if (fh) { frect(c, x, y + h - fh, w, fh, '#7d878a'); frect(c, x, y + h - fh, w, 2, '#a9b2b3'); }
    if (o.planks) { c.strokeStyle = 'rgba(40,40,40,.22)'; c.lineWidth = 1; c.beginPath(); for (let i = x + 10; i < x + w; i += 10) { c.moveTo(i, y); c.lineTo(i, y + h - fh); } c.stroke(); }
    if (o.stain !== false) {
      c.fillStyle = 'rgba(70,95,100,.11)';
      for (let i = 0; i < Math.floor(w / 36); i++) { const sx = x + 10 + ((i * 53) % Math.max(1, w - 20)); c.fillRect(sx, y + (o.band ? bh + 2 : 6), 3, Math.min(h - fh - 12, 16 + (i * 29) % 34)); }
    }
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x + 2, y, 4, h - fh);
    c.fillStyle = 'rgba(25,40,55,.15)'; c.fillRect(x + w - 9, y, 9, h - fh);
    if (o.eave !== 0) { c.fillStyle = 'rgba(20,30,45,.26)'; c.fillRect(x, y, w, o.eave ?? 7); }
    srect(c, x + 1, y + 1, w - 2, h - 2, OUT, 2);
  }
  function win(c, x, y, w, h, kind = 'glass') {
    frect(c, x - 2, y - 2, w + 4, h + 4, '#47525c');
    if (kind === 'lit') { frect(c, x, y, w, h, '#f4d996'); frect(c, x, y, w, 3, 'rgba(120,80,30,.3)'); }
    else if (kind === 'shut') {
      frect(c, x, y, w, h, '#71828a'); c.strokeStyle = '#4d5a62'; c.lineWidth = 1; c.beginPath();
      for (let yy = y + 3; yy < y + h; yy += 3) { c.moveTo(x, yy); c.lineTo(x + w, yy); } c.stroke();
    } else {
      frect(c, x, y, w, h, '#324a5a');
      fpoly(c, [x + w * .12, y + h, x + w * .5, y, x + w * .72, y, x + w * .34, y + h], 'rgba(170,215,235,.42)');
      frect(c, x, y, w, 3, 'rgba(0,0,0,.28)');
    }
    if (w > 16) frect(c, x + w / 2 - 1, y, 2, h, '#47525c');
    frect(c, x - 3, y + h + 2, w + 6, 3, '#7c878d');
  }
  function porthole(c, x, y, r, lit) {
    fell(c, x, y, r + 3, r + 3, '#47525c'); fell(c, x, y, r, r, lit ? '#f4d996' : '#324a5a');
    if (!lit) fell(c, x - r * .3, y - r * .3, r * .38, r * .3, 'rgba(190,225,240,.55)');
    line(c, x - r, y, x + r, y, '#47525c', 1.5);
    c.beginPath(); c.arc(x, y, r + 3, 0, TAU); sk(c, OUT, 1.4);
  }
  function door(c, x, y, w, h, col = '#55646e') {
    frect(c, x - 3, y - 3, w + 6, h + 3, '#3a444c'); frect(c, x, y, w, h, col);
    frect(c, x, y, 3, h, 'rgba(255,255,255,.18)');
    if (w > 24) line(c, x + w / 2, y, x + w / 2, y + h, '#3a444c', 1.5);
    srect(c, x + 4, y + 5, w - 8, h * .36, 'rgba(20,30,40,.35)', 1);
    fell(c, x + w - 6, y + h * .56, 1.6, 1.6, '#c9b27a');
  }
  function pentK(c, x, y, w, h, R) {
    c.fillStyle = 'rgba(15,25,35,.28)'; c.fillRect(x + 4, y + h, w - 8, 6);
    frect(c, x, y, w, h, R.base);
    c.strokeStyle = R.dark; c.lineWidth = 1.6; c.beginPath();
    for (let tx = x + 5; tx < x + w; tx += 7) { c.moveTo(tx, y); c.lineTo(tx, y + h); } c.stroke();
    frect(c, x, y, w, 2, R.light); frect(c, x, y + h - 3, w, 3, R.deep);
    srect(c, x, y, w, h, OUT, 1.6);
  }
  // Exposed pipe with a lit upper-left edge, collars and elbow joints.
  function pipe(c, pts, w = 7, col = '#8d9a9e') {
    const tr = (ox, oy) => { c.beginPath(); c.moveTo(pts[0] + ox, pts[1] + oy); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i] + ox, pts[i + 1] + oy); };
    c.save(); c.lineJoin = 'round'; c.lineCap = 'butt';
    tr(0, 0); sk(c, OUT, w + 3);
    tr(0, 0); sk(c, col, w);
    tr(w * .2, w * .2); sk(c, mix(col, '#1c2a36', .35), w * .32);
    tr(-w * .2, -w * .2); sk(c, mix(col, '#ffffff', .5), w * .22);
    c.restore();
    const dk = mix(col, '#1c2a36', .32);
    for (let i = 0; i < pts.length - 2; i += 2) {
      const x1 = pts[i], y1 = pts[i + 1], x2 = pts[i + 2], y2 = pts[i + 3], L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 1) continue;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy * (w / 2 + 1.5), ny = ux * (w / 2 + 1.5);
      for (let t = 24; t < L - 10; t += 40) { const px = x1 + ux * t, py = y1 + uy * t; line(c, px + nx, py + ny, px - nx, py - ny, dk, 3); }
    }
    for (let i = 2; i < pts.length - 2; i += 2) { fell(c, pts[i], pts[i + 1], w * .72, w * .72, dk); c.beginPath(); c.arc(pts[i], pts[i + 1], w * .72, 0, TAU); sk(c, OUT, 1); }
  }
  function wires(c, segs, col = 'rgba(30,34,38,.85)') {
    c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath();
    for (const [x1, y1, x2, y2, sag] of segs) { c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag, x2, y2); }
    c.stroke();
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
    c.fillStyle = 'rgba(245,252,255,.26)'; c.fillRect(cx - rx, ty - ry, rx * .38, h + ry * 2 + 2);
    c.fillStyle = 'rgba(20,35,52,.15)'; c.fillRect(cx + rx * .34, ty - ry, rx * .7, h + ry * 2 + 2);
    c.fillStyle = 'rgba(20,35,52,.2)'; c.fillRect(cx + rx * .76, ty - ry, rx * .3, h + ry * 2 + 2);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    return g;
  }
  function cylWindows(c, g, yo, n, ww, wh, kind = 'glass', span = 1.15, skip = 0) {
    for (let i = 0; i < n; i++) {
      const th = n === 1 ? 0 : -span + 2 * span * i / (n - 1);
      if (Math.abs(th) < skip) continue;
      const x = g.cx + g.rx * Math.sin(th), w = ww * Math.cos(th), y = g.ty + g.ry * Math.cos(th) + yo;
      win(c, x - w / 2, y, w, wh, typeof kind === 'function' ? kind(i) : kind);
    }
  }
  // Ribbed dome (Kiri's signature roof).
  function domeK(c, cx, ty, rx, ry, dh, R, o = {}) {
    const p = new Path2D(); p.moveTo(cx - rx, ty); p.ellipse(cx, ty, rx, dh, 0, Math.PI, TAU); p.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); p.closePath();
    celFill(c, p, R.base, R.light, R.dark, { ld: rx * .2, dd: rx * .28 });
    c.save(); c.clip(p);
    const n = o.ribs ?? 8;
    c.strokeStyle = 'rgba(12,28,38,.26)'; c.lineWidth = 1.6; c.beginPath();
    for (let i = -n; i <= n; i++) {
      const t = i / n * 1.52;
      for (let k = 0; k <= 12; k++) {
        const ph = k / 12 * Math.PI / 2, x = cx + rx * Math.cos(ph) * Math.sin(t), y = ty + ry * Math.cos(ph) * Math.cos(t) - dh * Math.sin(ph);
        if (k) c.lineTo(x, y); else c.moveTo(x, y);
      }
    }
    c.stroke();
    for (const ph of [.42, .86]) { const rr = Math.cos(ph); c.beginPath(); c.ellipse(cx, ty - dh * Math.sin(ph), rx * rr, ry * rr, 0, 0, Math.PI); sk(c, 'rgba(12,28,38,.22)', 1.4); }
    fell(c, cx - rx * .36, ty - dh * .58, rx * .2, dh * .14, 'rgba(255,255,255,.22)');
    c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, R.deep, 4);
    c.beginPath(); c.ellipse(cx, ty - 3, rx - 1, ry, 0, .15, Math.PI - .15); sk(c, R.light, 1.2);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    if (o.finial !== false) {
      const fh = o.fh ?? 14;
      fell(c, cx, ty - dh, 6, 2.6, R.deep);
      if (fh > 0) { line(c, cx, ty - dh - fh, cx, ty - dh + 1, '#3d464d', 2.5); fell(c, cx, ty - dh - fh, 3, 3, '#c9b27a'); }
    }
  }
  function cone(c, cx, ty, rx, ry, h, R, ov = 6) {
    const ay = ty - h, L = cx - rx - ov, Rr = cx + rx + ov, ery = ry + ov * .4;
    const p = new Path2D(); p.moveTo(L, ty); p.lineTo(cx, ay); p.lineTo(Rr, ty); p.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); p.closePath();
    c.save(); c.fillStyle = R.base; c.fill(p); c.clip(p);
    fpoly(c, [L - 2, ty - 2, cx, ay, cx - rx * .22, ty + ery + 2, L - 2, ty + ery + 2], R.light);
    fpoly(c, [cx, ay, Rr + 2, ty - 2, Rr + 2, ty + ery + 2, cx + rx * .42, ty + ery + 2], R.dark);
    c.strokeStyle = 'rgba(15,25,35,.22)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = -7; i <= 7; i++) { const t = i / 7.5 * 1.45; c.moveTo(cx, ay); c.lineTo(cx + (rx + ov) * Math.sin(t), ty + ery * Math.cos(t)); }
    c.stroke(); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); sk(c, R.deep, 4);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    fell(c, cx, ay, 3, 3, R.deep);
  }
  function waterTank(c, cx, baseY, r, h, col, o = {}) {
    const T = tone(col), ry = r * .42, legH = o.legH ?? 9;
    fell(c, cx + 6, baseY + 1, r * 1.05, ry * .9, 'rgba(15,30,40,.24)');
    c.strokeStyle = '#3c454c'; c.lineWidth = 3; c.beginPath();
    c.moveTo(cx - r * .7, baseY); c.lineTo(cx - r * .7, baseY - legH - 4);
    c.moveTo(cx + r * .7, baseY); c.lineTo(cx + r * .7, baseY - legH - 4);
    c.moveTo(cx, baseY + 2); c.lineTo(cx, baseY - legH); c.stroke();
    if (legH > 14) { line(c, cx - r * .7, baseY - 2, cx + r * .7, baseY - legH + 2, '#3c454c', 1.5); line(c, cx + r * .7, baseY - 2, cx - r * .7, baseY - legH + 2, '#3c454c', 1.5); }
    const ty = baseY - legH - h - ry;
    cylinder(c, cx, ty, r, h, T, { band: [[h * .3, 3, T.dark], [h * .68, 3, T.dark]],
      paint: (cc, g) => { cc.fillStyle = 'rgba(120,70,40,.22)'; cc.fillRect(cx + r * .2, g.ty + g.ry + h * .7, 3, h * .3); } });
    cone(c, cx, ty, r, ry, r * .55, tone(o.lid || mix(col, '#16222c', .3)), 3);
  }
  function roofPillow(c, x, y, w, d, R, o = {}) {
    const r = Math.min(d * .42, w * .2, o.r ?? 34);
    const p = rrPath(x, y, w, d, r);
    const g = c.createLinearGradient(0, y, 0, y + d);
    g.addColorStop(0, R.light); g.addColorStop(.38, R.base); g.addColorStop(.78, R.base); g.addColorStop(1, R.dark);
    c.save(); c.fillStyle = g; c.fill(p); c.clip(p);
    c.globalAlpha = .5; c.strokeStyle = R.dark; c.lineWidth = 1.6; c.beginPath();
    for (let sx = x + 8; sx < x + w; sx += 11) { c.moveTo(sx, y); c.lineTo(sx, y + d); } c.stroke(); c.globalAlpha = 1;
    c.fillStyle = 'rgba(15,28,40,.16)'; c.fillRect(x + w * .82, y, w * .18, d);
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x, y, w * .1, d);
    line(c, x + r * .7, y + d * .26, x + w - r * .7, y + d * .26, 'rgba(255,255,255,.3)', 3);
    frect(c, x, y + d - 6, w, 6, R.deep);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
  }
  // Barrel vault whose axis runs north-south: arched gable faces the viewer. y0 = wall top.
  function archPts(x, w, yb, rise, n = 28) { const a = []; for (let i = 0; i <= n; i++) { const u = i / n; a.push([x + w * u, yb - rise * Math.sin(Math.PI * u)]); } return a; }
  function vaultNS(c, x, y0, w, d, rise, R, W) {
    const front = archPts(x, w, y0, rise), back = archPts(x, w, y0 - d, rise);
    const roof = new Path2D(); roof.moveTo(front[0][0], front[0][1]);
    for (const [px, py] of front) roof.lineTo(px, py);
    for (let i = back.length - 1; i >= 0; i--) roof.lineTo(back[i][0], back[i][1]);
    roof.closePath();
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, R.light); g.addColorStop(.3, R.light); g.addColorStop(.5, R.base); g.addColorStop(.85, R.dark); g.addColorStop(1, R.deep);
    c.save(); c.fillStyle = g; c.fill(roof); c.clip(roof);
    c.strokeStyle = 'rgba(12,24,34,.28)'; c.lineWidth = 1.6; c.beginPath();
    for (let u = 1 / 16; u < 1; u += 1 / 16) { const px = x + w * u, yy = rise * Math.sin(Math.PI * u); c.moveTo(px, y0 - yy); c.lineTo(px, y0 - d - yy); }
    c.stroke(); c.restore();
    const gab = new Path2D(); gab.moveTo(x, y0); for (const [px, py] of front) gab.lineTo(px, py); gab.closePath();
    c.save(); c.fillStyle = W.base; c.fill(gab); c.clip(gab); frect(c, x + w * .78, y0 - rise, w * .22, rise, 'rgba(25,40,55,.14)'); c.restore();
    c.beginPath(); front.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); sk(c, R.deep, 7);
    c.beginPath(); front.forEach(([px, py], i) => i ? c.lineTo(px, py - 3) : c.moveTo(px, py - 3)); sk(c, R.light, 1.4);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(roof);
    c.beginPath(); front.forEach(([px, py], i) => i ? c.lineTo(px, py + 3) : c.moveTo(px, py + 3)); sk(c, OUT, 1.5);
  }
  // Barrel vault with an east-west axis (corrugated, front eave straight).
  function vaultEW(c, x, y, w, d, R) {
    const p = rrPath(x, y, w, d, 10);
    const g = c.createLinearGradient(0, y, 0, y + d);
    g.addColorStop(0, R.base); g.addColorStop(.28, R.light); g.addColorStop(.42, R.hi); g.addColorStop(.56, R.base); g.addColorStop(1, R.dark);
    c.save(); c.fillStyle = g; c.fill(p); c.clip(p);
    c.strokeStyle = 'rgba(12,24,34,.2)'; c.lineWidth = 1.2; c.beginPath();
    for (let yy = y + 5; yy < y + d; yy += 6) { c.moveTo(x, yy); c.lineTo(x + w, yy); } c.stroke();
    c.strokeStyle = 'rgba(12,24,34,.3)'; c.lineWidth = 2; c.beginPath();
    for (let xx = x + 40; xx < x + w - 10; xx += 46) { c.moveTo(xx, y); c.lineTo(xx, y + d); } c.stroke();
    c.fillStyle = 'rgba(15,28,40,.18)'; c.fillRect(x + w - 14, y, 14, d);
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x, y, 10, d);
    frect(c, x, y + d - 6, w, 6, R.deep);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
  }
  function roofFlatK(c, x, y, w, d, R) {
    frect(c, x, y, w, d, R.light);
    frect(c, x + 5, y + 5, w - 10, d - 10, '#a7b0b0');
    c.fillStyle = 'rgba(20,30,40,.18)'; c.fillRect(x + 5, y + 5, w - 10, 6); c.fillRect(x + 5, y + 11, 6, d - 16);
    c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 1; c.beginPath();
    for (let i = x + 30; i < x + w - 10; i += 28) { c.moveTo(i, y + 6); c.lineTo(i, y + d - 6); } c.stroke();
    fell(c, x + w * .3, y + d * .6, 22, 6, 'rgba(120,160,175,.35)');
    frect(c, x, y + d - 4, w, 4, R.base);
    srect(c, x + 1, y + 1, w - 2, d - 2, OUT, 2);
  }
  function roofHip(c, x, y, w, d, R, o = {}) {
    const rf = o.rf ?? .32, hip = o.hip ?? 0;
    const L = x, Rt = x + w, T = y, B = y + d, ry = y + d * rf;
    fpoly(c, [L, T, Rt, T, Rt - hip, ry, L + hip, ry], R.light);
    if (hip > 0) { fpoly(c, [L, T, L + hip, ry, L, B], R.light); fpoly(c, [Rt, T, Rt - hip, ry, Rt, B], R.dark); }
    const front = [L, B, Rt, B, Rt - hip, ry, L + hip, ry];
    fpoly(c, front, R.base);
    c.save(); poly(c, front); c.clip();
    c.strokeStyle = R.dark; c.lineWidth = 2; c.beginPath();
    for (let tx = L + 6; tx < Rt; tx += 8) { c.moveTo(tx, ry); c.lineTo(tx, B); } c.stroke();
    c.restore();
    frect(c, L, B - 5, w, 5, R.deep);
    line(c, L + hip - 2, ry, Rt - hip + 2, ry, R.deep, 5); line(c, L + hip, ry - 2, Rt - hip, ry - 2, R.hi, 1.4);
    if (hip > 0) { line(c, L + hip, ry, L + 2, B - 3, R.deep, 4); line(c, Rt - hip, ry, Rt - 2, B - 3, R.deep, 4); line(c, L + hip, ry, L + 2, T + 2, R.deep, 3); line(c, Rt - hip, ry, Rt - 2, T + 2, R.deep, 3); }
    poly(c, [L, T, Rt, T, Rt, B, L, B]); sk(c, OUT, 2);
    if (o.flare) {
      for (const s of [-1, 1]) {
        const ex = s < 0 ? L : Rt;
        const pts = [ex + s * 9, B - 15, ex - s * 18, B - 6, ex - s * 14, B, ex + s * 3, B - 4];
        fpoly(c, pts, R.deep); poly(c, pts); sk(c, OUT, 1.5);
      }
    }
  }
  function chochin(c, x, y, s = 1, col = LANT, label) {
    line(c, x, y - 15 * s, x, y - 8 * s, '#2e3236', 1.5);
    frect(c, x - 4 * s, y - 10 * s, 8 * s, 3 * s, '#25292c');
    fell(c, x, y, 6.5 * s, 8.5 * s, col);
    c.save(); c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); c.clip();
    frect(c, x + 2 * s, y - 9 * s, 5 * s, 18 * s, 'rgba(70,10,20,.32)');
    frect(c, x - 6.5 * s, y - 9 * s, 2.6 * s, 18 * s, 'rgba(255,210,170,.38)');
    c.strokeStyle = 'rgba(70,10,10,.35)'; c.lineWidth = .8; c.beginPath();
    for (let k = -2; k <= 2; k++) { c.moveTo(x - 7 * s, y + k * 3.2 * s); c.lineTo(x + 7 * s, y + k * 3.2 * s); } c.stroke();
    if (label) txt(c, label, x, y, 7 * s, '#1d1210', { weight: '800' });
    c.restore();
    frect(c, x - 4 * s, y + 7 * s, 8 * s, 3 * s, '#25292c');
    c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); sk(c, '#4a1712', 1.2);
  }
  function signV(c, x, y, w, h, str, bg, fg, frame = '#3a444c') {
    frect(c, x - 2, y - 2, w + 4, h + 4, frame); frect(c, x, y, w, h, bg);
    const n = [...str].length, size = Math.min(w * .78, (h - 4) / n / 1.04);
    txtV(c, str, x + w / 2, y + (h - n * size * 1.02) / 2, size, fg);
  }
  function signH(c, x, y, w, h, str, bg, fg, frame = '#3a444c') {
    frect(c, x - 2, y - 2, w + 4, h + 4, frame); frect(c, x, y, w, h, bg);
    txt(c, str, x + w / 2, y + h / 2 + 1, Math.min(h * .78, (w - 6) / [...str].length), fg);
  }
  function noren(c, x, y, w, h, col, chars, tcol) {
    const n = chars.length, gap = 2, sw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const sx = x + i * (sw + gap);
      frect(c, sx, y + 2, sw, h, col);
      frect(c, sx + sw - 2, y + 2, 2, h, 'rgba(0,0,0,.2)');
      if (chars[i]) txt(c, chars[i], sx + sw / 2, y + 2 + h * .55, Math.min(sw * .8, h * .62), tcol);
    }
    line(c, x - 4, y + 1, x + w + 4, y + 1, '#3a3129', 3);
  }
  function drawToro(c, x, y, s = 1) {
    const st = tone('#9aa3a3');
    fell(c, x + 6 * s, y, 13 * s, 4 * s, 'rgba(15,30,40,.3)');
    frect(c, x - 9 * s, y - 6 * s, 18 * s, 6 * s, st.dark);
    frect(c, x - 3.5 * s, y - 24 * s, 7 * s, 18 * s, st.base); frect(c, x - 3.5 * s, y - 24 * s, 2.5 * s, 18 * s, st.light);
    frect(c, x - 8 * s, y - 28 * s, 16 * s, 5 * s, st.dark);
    frect(c, x - 6 * s, y - 40 * s, 12 * s, 12 * s, st.base);
    frect(c, x - 3.5 * s, y - 37 * s, 7 * s, 7 * s, '#f6d48a');
    fpoly(c, [x - 13 * s, y - 40 * s, x, y - 50 * s, x + 13 * s, y - 40 * s, x + 9 * s, y - 37 * s, x - 9 * s, y - 37 * s], st.base);
    fpoly(c, [x - 13 * s, y - 40 * s, x, y - 50 * s, x, y - 39 * s], st.light);
    poly(c, [x - 13 * s, y - 40 * s, x, y - 50 * s, x + 13 * s, y - 40 * s, x + 9 * s, y - 37 * s, x - 9 * s, y - 37 * s]); sk(c, OUT, 1.3);
    fell(c, x, y - 52 * s, 2.5 * s, 2.5 * s, st.dark);
    srect(c, x - 6 * s, y - 40 * s, 12 * s, 12 * s, OUT, 1.2); srect(c, x - 3.5 * s, y - 24 * s, 7 * s, 18 * s, OUT, 1.2);
  }
  function boulder(c, x, y, r, R, pal = ROCK) {
    const n = 7 + Math.floor(R() * 3), pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .4, rr = r * (.78 + R() * .3); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * .74]); }
    const p = pathFrom(pts);
    celFill(c, p, pal.base, pal.light, pal.dark, { ld: r * .24, dd: r * .32 });
    c.strokeStyle = pal.out; c.lineWidth = 1.6; c.stroke(p);
    if (r > 15) { c.beginPath(); c.moveTo(x - r * .1, y - r * .4); c.lineTo(x + r * .05, y - r * .05); c.lineTo(x + r * .3, y + r * .1); sk(c, 'rgba(30,40,46,.5)', 1.2); }
    if (R() < .5) fell(c, x - r * .2, y - r * .44, r * .38, r * .14, 'rgba(92,128,104,.55)');
  }
  function drawPineK(c, ax, ay, s, seed) {
    const R = rng(seed);
    fell(c, ax + 14 * s, ay, 30 * s, 8 * s, 'rgba(15,30,40,.28)');
    c.beginPath(); c.moveTo(ax - 5 * s, ay); c.quadraticCurveTo(ax - 14 * s, ay - 30 * s, ax + 8 * s, ay - 60 * s);
    c.lineTo(ax + 13 * s, ay - 57 * s); c.quadraticCurveTo(ax - 4 * s, ay - 30 * s, ax + 5 * s, ay); c.closePath();
    c.fillStyle = '#5a4c42'; c.fill(); sk(c, OUT, 1.4);
    line(c, ax - 4 * s, ay - 32 * s, ax - 24 * s, ay - 40 * s, '#5a4c42', 3 * s);
    line(c, ax + 4 * s, ay - 46 * s, ax + 24 * s, ay - 52 * s, '#5a4c42', 3 * s);
    const pads = [[-24, -42, 20, 8], [22, -54, 21, 8], [-2, -68, 18, 7], [6, -82, 12, 5], [26, -36, 12, 5]];
    pads.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, rx, ry] of pads) {
      const x = ax + dx * s + (R() - .5) * 4 * s, y = ay + dy * s;
      fell(c, x, y, (rx + 2) * s, (ry + 2) * s, PINEK.out);
      fell(c, x, y, rx * s, ry * s, PINEK.dark);
      fell(c, x - 3 * s, y - 2 * s, rx * .8 * s, ry * .7 * s, PINEK.mid);
      fell(c, x - 6 * s, y - 3.5 * s, rx * .45 * s, ry * .35 * s, PINEK.light);
    }
  }

  // ------------------------------------------------------------------ building variants (footprint-local coords)
  function vTower(c, P) {
    const { R, W, R2, W2 } = P;
    plinth(c, 240, 250);
    roofPillow(c, 114, 64, 124, 78, R2);
    wall(c, 120, 142, 114, 102, W2, { band: R2.dark });
    win(c, 134, 162, 22, 18); win(c, 192, 162, 22, 18, 'lit');
    pentK(c, 158, 190, 46, 8, R2);
    door(c, 166, 200, 28, 42);
    waterTank(c, 206, 118, 15, 20, P.tank);
    const g = cylinder(c, 78, 28, 70, 190, W, {
      band: [[2, 12, R.base], [76, 5, R.dark], [136, 5, R.dark], [176, 16, '#89949a']],
      paint: (cc, gg) => { cylWindows(cc, gg, 28, 5, 14, 22, 'glass', 1.2); cylWindows(cc, gg, 90, 5, 14, 22, i => i === 1 || i === 4 ? 'lit' : 'glass', 1.2, .3); cylWindows(cc, gg, 146, 4, 14, 18, 'shut', 1.1, .4); }
    });
    domeK(c, 78, 28, 76, 30, 62, R, { fh: 18 });
    pentK(c, 52, 194, 52, 8, R2);
    door(c, 64, 204, 28, 40);
    pipe(c, [140, 62, 154, 62, 154, 244], 7);
    pipe(c, [228, 128, 228, 244], 6, '#7f8c91');
    pipe(c, [154, 150, 174, 150], 5);
    wires(c, [[154, 96, 228, 116, 10], [154, 100, 228, 120, 18]]);
  }
  function vTwin(c, P) {
    const { R, W, R2, W2 } = P;
    plinth(c, 300, 260);
    cylinder(c, 218, 96, 68, 128, W2, {
      band: [[2, 10, R2.base], [60, 5, R2.dark], [114, 12, '#89949a']],
      paint: (cc, gg) => { cylWindows(cc, gg, 22, 4, 14, 20, 'glass', 1.15); cylWindows(cc, gg, 72, 4, 14, 20, i => i === 2 ? 'lit' : 'glass', 1.15, .3); }
    });
    domeK(c, 218, 96, 72, 29, 36, R2, { ribs: 6, fh: 10 });
    // sky bridge
    frect(c, 124, 104, 54, 8, R.deep); srect(c, 124, 104, 54, 8, OUT, 1.5);
    wall(c, 128, 112, 46, 40, W, { found: 0, eave: 4, stain: false });
    win(c, 138, 122, 26, 16, 'lit');
    const g = cylinder(c, 80, 6, 66, 214, W, {
      band: [[2, 12, R.base], [72, 5, R.dark], [142, 5, R.dark], [200, 14, '#89949a']],
      paint: (cc, gg) => { cylWindows(cc, gg, 26, 5, 13, 20, 'glass', 1.2); cylWindows(cc, gg, 92, 5, 13, 20, i => i === 3 ? 'lit' : 'glass', 1.2); cylWindows(cc, gg, 160, 4, 13, 18, 'glass', 1.1, .4); }
    });
    domeK(c, 80, 6, 72, 29, 58, R, { fh: 20 });
    pentK(c, 56, 198, 48, 8, R2); door(c, 66, 206, 28, 40);
    pentK(c, 196, 204, 44, 8, R2); door(c, 204, 212, 28, 37);
    pipe(c, [144, 50, 160, 50, 160, 104], 7);
    pipe(c, [160, 152, 160, 256], 7);
    pipe(c, [288, 140, 288, 256], 6, '#7f8c91');
    wires(c, [[146, 60, 210, 70, 12], [146, 66, 214, 80, 20]]);
  }
  function vVault(c, P) {
    const { R, W, R2 } = P;
    plinth(c, 300, 240);
    const y0 = 132;
    vaultNS(c, 10, y0, 280, 84, 48, R, W);
    wall(c, 10, y0, 280, 104, W, { eave: 6 });
    porthole(c, 150, y0 - 22, 12, P.idx === 1);
    for (const wx of [28, 72, 206, 250]) win(c, wx, 154, 24, 18);
    for (const wx of [28, 72, 206, 250]) win(c, wx, 192, 24, 18, wx === 72 || wx === 250 ? 'lit' : 'glass');
    pentK(c, 116, 178, 68, 9, R2);
    door(c, 128, 190, 44, 42);
    signV(c, 186, 150, 14, 36, P.idx ? '宿' : '霧', '#e8ece6', '#2f4250');
    frect(c, 104, 152, 18, 14, '#9aa6aa'); srect(c, 104, 152, 18, 14, OUT, 1.2);
    c.strokeStyle = '#5d6a70'; c.lineWidth = 1; c.beginPath(); for (let i = 155; i < 165; i += 3) { c.moveTo(106, i); c.lineTo(120, i); } c.stroke();
    pipe(c, [14, 143, 282, 143, 282, 236], 6);
    pipe(c, [40, 143, 40, 236], 5, '#7f8c91');
    wires(c, [[60, 146, 120, 150, 10], [180, 148, 250, 146, 14]]);
  }
  function vStack(c, P) {
    const { R, W, R2, W2 } = P;
    plinth(c, 280, 260);
    roofFlatK(c, 0, 64, 280, 90, R2);
    waterTank(c, 236, 142, 18, 22, P.tank);
    waterTank(c, 194, 128, 13, 16, '#8e9ea3');
    vaultEW(c, 8, -26, 156, 68, R);
    wall(c, 12, 42, 148, 96, W2, { band: R.dark });
    for (const wx of [26, 62, 98, 132]) { win(c, wx, 62, 20, 18, wx === 62 ? 'lit' : 'glass'); win(c, wx, 100, 20, 18); }
    // terrace railing
    frect(c, 166, 140, 110, 3, '#4d585f'); c.strokeStyle = '#4d585f'; c.lineWidth = 1.5; c.beginPath();
    for (let x = 168; x < 276; x += 6) { c.moveTo(x, 140); c.lineTo(x, 152); } c.stroke();
    wall(c, 4, 154, 272, 102, W, { band: R2.base });
    for (const wx of [22, 64, 176, 218]) win(c, wx, 176, 22, 18, wx === 218 ? 'lit' : 'glass');
    for (const wx of [22, 64, 176, 218]) win(c, wx, 212, 22, 16, 'shut');
    pentK(c, 106, 200, 64, 8, R);
    door(c, 118, 210, 40, 42);
    pipe(c, [166, 70, 172, 70, 172, 154], 6);
    pipe(c, [268, 150, 268, 254], 6, '#7f8c91');
    pipe(c, [12, 166, 100, 166], 5);
    wires(c, [[172, 90, 236, 110, 14], [20, 150, 160, 152, 16]]);
  }
  function vDrum(c, P) {
    const { R, W, R2, W2 } = P;
    plinth(c, 260, 240);
    cylinder(c, 130, 96, 118, 92, W, {
      band: [[2, 10, R.base], [56, 5, R.dark], [80, 10, '#89949a']],
      paint: (cc, gg) => { cylWindows(cc, gg, 18, 7, 14, 20, 'glass', 1.3, .25); cylWindows(cc, gg, 62, 8, 10, 10, i => i % 3 === 1 ? 'lit' : 'glass', 1.35, .3); }
    });
    domeK(c, 130, 96, 124, 50, 72, R, { ribs: 9, finial: false });
    cylinder(c, 130, 8, 20, 16, W2, { paint: (cc, gg) => cylWindows(cc, gg, 3, 3, 6, 8, 'lit', 1) });
    domeK(c, 130, 8, 24, 10, 16, R2, { ribs: 4, fh: 12 });
    pentK(c, 100, 182, 60, 9, R2);
    door(c, 112, 192, 36, 42);
    pipe(c, [236, 112, 252, 112, 252, 236], 7);
    pipe(c, [24, 124, 8, 124, 8, 236], 6, '#7f8c91');
  }
  function vShop(c, P) {
    const { R, W, R2 } = P;
    plinth(c, 280, 200);
    roofPillow(c, 0, 0, 280, 92, R, { r: 30 });
    waterTank(c, 236, 52, 14, 16, P.tank);
    wall(c, 8, 92, 264, 104, W, { band: R.dark });
    for (const wx of [24, 66, 192, 234]) win(c, wx, 108, 22, 14, wx === 66 ? 'lit' : 'glass');
    const T = P.idx ? ['茶', '屋'] : ['魚', '屋'];
    signH(c, 112, 104, 56, 22, P.idx ? '茶房' : '鮮魚', '#e8ece6', '#2f4250');
    pentK(c, 8, 130, 264, 16, R2);
    frect(c, 22, 148, 236, 42, '#2d373d');
    if (!P.idx) for (let i = 0; i < 7; i++) { const fx = 150 + i * 14; fpoly(c, [fx, 168, fx + 10, 164, fx + 10, 172], '#9fb6bf'); fpoly(c, [fx + 10, 168, fx + 14, 164, fx + 14, 172], '#7f97a0'); }
    else for (let i = 0; i < 5; i++) { fell(c, 156 + i * 20, 170, 7, 8, '#8a6a52'); fell(c, 156 + i * 20, 163, 4, 2, '#5a4636'); }
    noren(c, 26, 146, 104, 26, '#3c5670', T, '#eef3f2');
    frect(c, 140, 176, 116, 12, WOODK.light); frect(c, 140, 176, 116, 3, '#b6a48e'); srect(c, 140, 176, 116, 12, OUT, 1.4);
    pipe(c, [266, 90, 266, 196], 5, '#7f8c91');
    wires(c, [[20, 96, 140, 100, 12]]);
  }
  function vBoathouse(c, P) {
    const { R, W } = P;
    plinth(c, 300, 200, '#8f8678');
    vaultEW(c, 0, 0, 300, 96, R);
    const Wd = tone('#b8b2a4');
    wall(c, 6, 96, 288, 100, Wd, { band: R.deep, planks: true });
    for (const dx of [30, 176]) {
      frect(c, dx - 3, 120, 100, 76, '#3a3129'); frect(c, dx, 124, 94, 72, '#5b4a3c');
      c.strokeStyle = '#3a3129'; c.lineWidth = 3; c.beginPath(); c.moveTo(dx, 124); c.lineTo(dx + 47, 196); c.moveTo(dx + 47, 124); c.lineTo(dx, 196);
      c.moveTo(dx + 47, 124); c.lineTo(dx + 94, 196); c.moveTo(dx + 94, 124); c.lineTo(dx + 47, 196); c.stroke();
      line(c, dx + 47, 124, dx + 47, 196, '#3a3129', 3);
      frect(c, dx, 124, 94, 3, 'rgba(255,255,255,.15)');
    }
    c.strokeStyle = 'rgba(50,46,40,.7)'; c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < 6; i++) { c.moveTo(134 + i * 6, 124); c.lineTo(134 + i * 6 - 10, 180); c.moveTo(130 + i * 6, 124); c.lineTo(130 + i * 6 + 10, 180); } c.stroke();
    signH(c, 118, 100, 64, 16, '船倉', '#e8e2d0', '#33404a');
    for (let i = 0; i < 3; i++) { fell(c, 140 + i * 8, 190, 6, 3, '#a08a62'); }
    pipe(c, [292, 40, 292, 196], 5, '#7f8c91');
  }
  function vTanks(c, P) {
    const { R, W } = P;
    plinth(c, 240, 220, '#9aa3a3');
    c.strokeStyle = 'rgba(40,50,58,.35)'; c.lineWidth = 1; c.beginPath(); for (let x = 6; x < 236; x += 6) { c.moveTo(x, 120); c.lineTo(x, 214); } c.stroke();
    waterTank(c, 176, 118, 34, 46, '#8e9ea3', { legH: 20 });
    waterTank(c, 72, 150, 44, 62, P.tank, { legH: 24 });
    roofPillow(c, 138, 126, 98, 42, R, { r: 14 });
    wall(c, 142, 168, 90, 48, W, { found: 6 });
    door(c, 174, 180, 26, 34);
    pipe(c, [108, 136, 128, 136, 128, 196, 142, 196], 8, '#7f8f95');
    pipe(c, [206, 98, 226, 98, 226, 128], 6);
    pipe(c, [30, 160, 30, 214], 7, '#7f8f95');
    fell(c, 128, 166, 8, 8, '#9a3f36'); c.beginPath(); c.arc(128, 166, 8, 0, TAU); sk(c, OUT, 1.4);
    line(c, 120, 166, 136, 166, '#5a1f1a', 2); line(c, 128, 158, 128, 174, '#5a1f1a', 2);
  }
  function vShrine(c, P) {
    const R = tone('#3f6f74'), W = tone('#e8e4d8'), RD = tone('#9a4038');
    plinth(c, 170, 130, '#a9b1af');
    roofHip(c, 22, 4, 126, 60, R, { rf: .34, hip: 26, flare: true });
    wall(c, 32, 64, 106, 44, W, { found: 4, eave: 5, stain: false });
    for (const [dx, dw] of [[40, 40], [90, 40]]) {
      frect(c, dx, 70, dw, 36, '#2d2a28');
      c.strokeStyle = RD.base; c.lineWidth = 1.5; c.beginPath();
      for (let i = dx + 5; i < dx + dw; i += 6) { c.moveTo(i, 70); c.lineTo(i, 106); }
      for (let j = 74; j < 106; j += 6) { c.moveTo(dx, j); c.lineTo(dx + dw, j); } c.stroke();
    }
    for (const px of [32, 82, 131]) { frect(c, px, 64, 7, 44, RD.base); frect(c, px, 64, 2, 44, RD.light); srect(c, px, 64, 7, 44, OUT, 1); }
    c.beginPath(); c.moveTo(30, 68); c.quadraticCurveTo(85, 84, 140, 68); sk(c, '#8c7a50', 8);
    c.beginPath(); c.moveTo(30, 68); c.quadraticCurveTo(85, 84, 140, 68); sk(c, '#d6c58e', 5);
    for (const sx of [56, 85, 114]) { const sy = sx === 85 ? 78 : 74; fpoly(c, [sx - 3, sy, sx + 3, sy, sx + 3, sy + 5, sx - 1, sy + 5, sx - 1, sy + 10, sx + 3, sy + 10, sx + 3, sy + 15, sx - 3, sy + 15], '#f6f4ee'); }
    frect(c, 66, 106, 38, 12, '#5f4a38'); srect(c, 66, 106, 38, 12, OUT, 1.2);
    frect(c, 60, 118, 50, 6, '#b9c1bf'); frect(c, 54, 124, 62, 6, '#aab3b1');
    drawToro(c, 16, 126, .82); drawToro(c, 154, 126, .82);
  }
  function vRock(c, P) {
    const R = rng(P.seed || 5);
    fell(c, 118, 150, 112, 18, 'rgba(15,30,40,.3)');
    const bs = [[110, 74, 44], [56, 100, 40], [168, 96, 38], [96, 128, 36], [150, 136, 32], [36, 140, 26], [196, 142, 22]];
    for (const [x, y, r] of bs) boulder(c, x, y, r, R);
    drawPineK(c, 104, 64, 1.05, (P.seed || 5) * 7 + 3);
    for (let i = 0; i < 8; i++) fell(c, 30 + R() * 160, 120 + R() * 34, 4 + R() * 6, 2, 'rgba(92,128,104,.5)');
  }
  function lmMizukage(c, P) {
    const R = tone('#3f8f8a'), R2 = tone('#356f78'), W = tone('#e6eae4'), W2 = tone('#dce2de'), ST = tone('#9aa3a4');
    plinth(c, 400, 380, '#a7afad');
    // round stone dais
    cylinder(c, 200, 274, 198, 16, ST, { band: [[0, 3, ST.light]] });
    fell(c, 200, 274, 198, 79, '#b9c1bf');
    for (const f of [.92, .8]) { c.beginPath(); c.ellipse(200, 274, 198 * f, 79 * f, 0, 0, TAU); sk(c, 'rgba(70,84,92,.4)', 1.5); }
    c.beginPath(); c.ellipse(200, 274, 198, 79, 0, 0, TAU); sk(c, OUT, 2);
    // lower drum
    cylinder(c, 200, 192, 168, 84, W, {
      band: [[0, 10, R2.dark], [72, 12, '#89949a']],
      paint: (cc, gg) => { cylWindows(cc, gg, 22, 11, 16, 26, i => i === 2 || i === 8 ? 'lit' : 'glass', 1.42, .32); }
    });
    // eave skirt
    fell(c, 200, 198, 186, 74, R2.deep);
    const er = new Path2D(); er.ellipse(200, 190, 186, 74, 0, 0, TAU);
    celFill(c, er, R2.base, R2.light, R2.dark, { ld: 10, dd: 14 });
    c.save(); c.clip(er); c.strokeStyle = 'rgba(12,24,34,.25)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; c.moveTo(200 + Math.cos(a) * 150, 190 + Math.sin(a) * 60); c.lineTo(200 + Math.cos(a) * 186, 190 + Math.sin(a) * 74); } c.stroke(); c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(er);
    waterTank(c, 66, 180, 17, 20, '#7f9aa0'); waterTank(c, 334, 180, 17, 20, '#7f9aa0');
    // upper drum
    cylinder(c, 200, 98, 150, 88, W2, {
      band: [[0, 10, R.dark], [76, 12, R.dark]],
      paint: (cc, gg) => { cylWindows(cc, gg, 20, 9, 14, 24, i => i % 2 ? 'lit' : 'glass', 1.38, .5); }
    });
    domeK(c, 200, 98, 160, 64, 96, R, { ribs: 10, finial: false });
    // 水 painted on the dome front
    const ey = 110;
    fell(c, 200, ey + 3, 46, 36, 'rgba(10,30,36,.35)');
    fell(c, 200, ey, 46, 36, '#f2f4ee');
    c.beginPath(); c.ellipse(200, ey, 40, 31, 0, 0, TAU); sk(c, R.dark, 2.5);
    c.beginPath(); c.ellipse(200, ey, 46, 36, 0, 0, TAU); sk(c, OUT, 2);
    c.save(); c.translate(200, ey + 1); c.scale(1, .82); txt(c, '水', 0, 0, 52, '#1f4f58', { weight: '900' }); c.restore();
    // cupola
    cylinder(c, 200, -14, 26, 18, W, { paint: (cc, gg) => cylWindows(cc, gg, 4, 4, 7, 9, 'lit', 1.1) });
    domeK(c, 200, -14, 30, 12, 20, R2, { ribs: 5, fh: 22 });
    // pipes rising from the dais
    pipe(c, [40, 316, 40, 214, 54, 200], 8);
    pipe(c, [360, 316, 360, 214, 346, 200], 8);
    pipe(c, [24, 290, 24, 236], 6, '#7f8c91'); pipe(c, [376, 290, 376, 236], 6, '#7f8c91');
    // entrance
    pentK(c, 156, 286, 88, 12, R2);
    frect(c, 166, 298, 68, 50, '#7a3a32'); frect(c, 172, 302, 56, 46, '#2f3a40');
    door(c, 176, 306, 22, 42, '#4a5a64'); door(c, 202, 306, 22, 42, '#4a5a64');
    srect(c, 166, 298, 68, 50, OUT, 1.6);
    for (let i = 0; i < 4; i++) { frect(c, 164 - i * 6, 348 + i * 7, 72 + i * 12, 7, i % 2 ? '#aab2b0' : '#bec6c4'); srect(c, 164 - i * 6, 348 + i * 7, 72 + i * 12, 7, 'rgba(30,40,48,.6)', 1); }
    signV(c, 144, 292, 14, 46, '水影', '#eef1ec', '#1f4f58');
    signV(c, 242, 292, 14, 46, '霧隠', '#eef1ec', '#1f4f58');
  }

  // ------------------------------------------------------------------ layout
  const VDEF = {
    T: { w: 240, h: 250, fn: vTower, lamps: [[50, 216], [106, 216]], anchors: [[154, 92], [228, 112]] },
    W: { w: 300, h: 260, fn: vTwin, lamps: [[44, 216], [258, 222]], anchors: [[146, 58], [288, 136]] },
    B: { w: 300, h: 240, fn: vVault, lamps: [[112, 200], [188, 200]], anchors: [[150, 0], [282, 140]] },
    S: { w: 280, h: 260, fn: vStack, lamps: [[100, 220]], anchors: [[86, -26], [268, 146]] },
    D: { w: 260, h: 240, fn: vDrum, lamps: [[96, 206], [164, 206]], anchors: [[252, 108], [8, 120]] },
    H: { w: 280, h: 200, fn: vShop, lamps: [[16, 158], [264, 158]], anchors: [[140, 2], [266, 88]] },
    O: { w: 300, h: 200, fn: vBoathouse, lamps: [[150, 128]], anchors: [[20, 4], [292, 40]] },
    Q: { w: 240, h: 220, fn: vTanks, lamps: [], anchors: [[226, 96], [30, 158]] },
    R: { w: 170, h: 130, fn: vShrine, lamps: [[16, 96], [154, 96]], noDraw: true, solid: true, anchors: [] },
    K: { w: 220, h: 160, fn: vRock, lamps: [], solid: true, anchors: [] },
    M: { w: 400, h: 380, fn: lmMizukage, lamps: [[134, 318], [266, 318]], anchors: [] }
  };
  const GRID = [
    'K.T.S..W.K',
    '.D..H.T.B.',
    'S.O.Q.D...',
    '.T.B..RT.D',
    '..S..MB.T.',
    '..O....W..',
    '.S.T..DQ.S',
    'T.B.H.O.D.',
    '.W.S.T.B.K',
    'K....R.H..'
  ];
  const DR = [[E, CANALS[0] - CW / 2], [CANALS[0] + CW / 2, CANALS[1] - CW / 2], [CANALS[1] + CW / 2, SIZE - E]];
  // Each outer district is cut in two by a narrow channel on a lane line, so the village reads as islets.
  const SC = 80;
  const SPLITS = { '0,0': ['v', 1040], '1,0': ['h', 520], '2,0': ['v', 4680], '0,1': ['h', 3120], '2,1': ['v', 4680], '0,2': ['v', 520], '1,2': ['h', 4680], '2,2': ['h', 4160] };
  const PLATFORMS = [];
  // bridges: 'h' crosses a vertical canal (travel east-west), 'v' crosses a horizontal canal
  const BRIDGES = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const x = DR[i][0], y = DR[j][0], w = DR[i][1] - x, h = DR[j][1] - y, sp = SPLITS[i + ',' + j];
    if (!sp) { PLATFORMS.push({ x, y, w, h, center: i === 1 && j === 1 }); continue; }
    const S = sp[1], n0 = PLATFORMS.length;
    if (sp[0] === 'v') {
      PLATFORMS.push({ x, y, w: S - SC / 2 - x, h }, { x: S + SC / 2, y, w: x + w - S - SC / 2, h });
      for (let ly = Math.ceil(y / BLOCK) * BLOCK; ly < y + h; ly += BLOCK) if (ly > y + 200 && ly < y + h - 200) BRIDGES.push({ x: S - SC / 2 - 22, y: ly - 45, w: SC + 44, h: 90, d: 'h' });
    } else {
      PLATFORMS.push({ x, y, w, h: S - SC / 2 - y }, { x, y: S + SC / 2, w, h: y + h - S - SC / 2 });
      for (let lx = Math.ceil(x / BLOCK) * BLOCK; lx < x + w; lx += BLOCK) if (lx > x + 200 && lx < x + w - 200) BRIDGES.push({ x: lx - 45, y: S - SC / 2 - 22, w: 90, h: SC + 44, d: 'v' });
    }
    // a few islets are wooden boardwalk decks on pilings instead of stone
    const wd = { '0,0': 1, '2,2': 0, '0,1': 1 }[i + ',' + j];
    if (wd !== undefined) PLATFORMS[n0 + wd].wood = true;
  }
  for (const [X, yc, wd] of [[1560, 2600, 180], [1560, 1040, 120], [1560, 4160, 120], [3640, 2600, 160], [3640, 1040, 120], [3640, 4680, 120]])
    BRIDGES.push({ x: X - CW / 2 - 30, y: yc - wd / 2, w: CW + 60, h: wd, d: 'h' });
  for (const [Y, xc, wd] of [[1560, 1040, 120], [1560, 2600, 120], [1560, 4160, 120], [3640, 520, 120], [3640, 2860, 160], [3640, 4680, 120]])
    BRIDGES.push({ x: xc - wd / 2, y: Y - CW / 2 - 30, w: wd, h: CW + 60, d: 'v' });
  // wooden decks over the sea: the west gate pier and fishing jetties
  const PIER = { x: -40, y: 2505, w: 270, h: 190, d: 'h' };
  const JETTIES = [
    { x: 2820, y: -40, w: 80, h: E + 70, d: 'v' },
    { x: SIZE - E - 40, y: 1260, w: E + 80, h: 80, d: 'h' },
    { x: 1260, y: SIZE - E - 20, w: 80, h: E + 60, d: 'v' },
    { x: 4120, y: SIZE - E - 20, w: 80, h: E + 60, d: 'v' }
  ];
  const mouths = [[CANALS[0] - CW / 2, CANALS[0] + CW / 2], [CANALS[1] - CW / 2, CANALS[1] + CW / 2]];
  const GAPS = {
    n: [...mouths, [2800, 2920]],
    s: [...mouths, [1240, 1360], [4100, 4220]],
    w: [...mouths, [2490, 2710]],
    e: [...mouths, [1240, 1360]]
  };

  const FP = [];          // internal footprints: {x,y,w,h,solid,roof,wall,key,ch}
  const ITEMS = [];       // sorted sprites: {kind:'b'|'p', i?, s?, key?, x,y, bx,by,bw,bh, base}
  const BOATS = [], POSTS = [], DOCKS = [], PUDDLES = [], CABLES = [];
  const LANTERNS = [];

  const onPlatform = (x, y, m = 30) => PLATFORMS.some(p => x > p.x + m && x < p.x + p.w - m && y > p.y + m && y < p.y + p.h - m);
  const inPath = (x, y) => x < 2600 && y > PATH0 - 40 && y < PATH1 + 40;
  const inPlaza = (x, y, m = 30) => { const dx = (x - PLAZA.x) / (PLAZA.rx + m), dy = (y - PLAZA.y) / (PLAZA.ry + m); return dx * dx + dy * dy < 1; };
  const nearFoot = (x, y, m) => FP.some(f => x > f.x - m && x < f.x + f.w + m && y > f.y - m && y < f.y + f.h + m);
  const nearBridge = (x, y, m) => BRIDGES.some(b => x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m);
  const okProp = (x, y) => onPlatform(x, y, 40) && !inPath(x, y) && !inPlaza(x, y) && !nearFoot(x, y, 26) && !nearBridge(x, y, 40);

  function place(a0, a1, w, c) { if (a1 - a0 <= w) return Math.round((a0 + a1 - w) / 2); return Math.round(Math.min(a1 - w, Math.max(a0, c - w / 2))); }

  const PROPS = {}; // filled with sprite descriptors at init; plan uses names only
  const PROP_META = {
    lampPost: { lamp: [12, -60] }, toro: { lamp: [0, -33] }, toroBig: { lamp: [0, -44] }, pole: { anchor: [0, -104] },
    tankStilt: {}, barrels: {}, crates: {}, pine: {}, bare: {}, monument: {}, gate: { lamps: [[-52, -100], [-52, -310]] }
  };

  function plan() {
    // buildings
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      const ch = GRID[cy][cx]; if (ch === '.') continue;
      const d = VDEF[ch]; let x, y;
      if (ch === 'M') { x = 2660; y = 2110; }
      else {
        const cx0 = cx * BLOCK, cy0 = cy * BLOCK;
        const pf = PLATFORMS.find(p => cx0 + 260 > p.x && cx0 + 260 < p.x + p.w && cy0 + 260 > p.y && cy0 + 260 < p.y + p.h);
        const ax0 = Math.max(cx0 + 60, pf.x + 40), ax1 = Math.min(cx0 + BLOCK - 60, pf.x + pf.w - 40);
        let ay0 = Math.max(cy0 + 60, pf.y + 40), ay1 = Math.min(cy0 + BLOCK - 60, pf.y + pf.h - 40);
        if (cx <= 4 && cy === 4) ay1 = Math.min(ay1, PATH0 - 20);
        if (cx <= 4 && cy === 5) ay0 = Math.max(ay0, PATH1 + 20);
        x = place(ax0, ax1, d.w, cx0 + BLOCK / 2 + (hash2(cx, cy, 3) - .5) * 40);
        y = place(ay0, ay1, d.h, cy0 + BLOCK / 2 + (hash2(cx, cy, 5) - .5) * 40);
      }
      const pal = ch === 'M' ? 0 : (hash2(cx, cy, 7) < .5 ? 0 : 1);
      const vi = 'TWBSDHOQRKM'.indexOf(ch);
      const R = ROOFS[(vi * 2 + pal) % ROOFS.length], W = WALLS[(vi + pal) % WALLS.length];
      const f = { x, y, w: d.w, h: d.h, solid: !!d.solid, roof: ch === 'M' ? '#3f8f8a' : ch === 'R' ? '#3f6f74' : ch === 'K' ? '#7e8a8f' : R.base, wall: ch === 'K' ? '#5a656b' : ch === 'M' ? '#e6eae4' : W.base, key: ch + pal, ch, cx, cy };
      FP.push(f);
      for (const [lx, ly] of d.lamps) LANTERNS.push({ x: x + lx, y: y + ly });
    }
    FP.forEach((f, i) => ITEMS.push({ kind: 'b', i, key: f.key, x: f.x, y: f.y, bx: f.x - MX, by: f.y - MT, bw: f.w + MX * 2, bh: f.h + MT + MB, base: f.y + f.h }));
    const props = [];
    const addProp = (name, x, y) => {
      props.push({ name, x: Math.round(x), y: Math.round(y) });
      const m = PROP_META[name];
      if (m.lamp) LANTERNS.push({ x: Math.round(x + m.lamp[0]), y: Math.round(y + m.lamp[1]) });
      if (m.lamps) for (const [lx, ly] of m.lamps) LANTERNS.push({ x: x + lx, y: y + ly });
    };
    // gate, monument and plaza lanterns
    addProp('gate', 172, 2705);
    addProp('monument', 300, 2466);
    addProp('toro', 250, 2490); addProp('toro', 250, 2750); addProp('toro', 350, 2750);
    addProp('pine', 420, 2400); addProp('pine', 450, 2830); addProp('tankStilt', 320, 2300);
    addProp('barrels', 300, 2900); addProp('pole', 470, 2470);
    for (const deg of [-25, 25, 70, 110, 155, 205, 335]) {
      const a = deg * Math.PI / 180, x = PLAZA.x + (PLAZA.rx + 34) * Math.cos(a), y = PLAZA.y + (PLAZA.ry + 26) * Math.sin(a);
      if (!inPath(x, y) && !nearBridge(x, y, 30)) addProp('toroBig', x, y);
    }
    addProp('lampPost', 2610, 2520); addProp('lampPost', 3100, 2520);
    // per-cell dressing
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      const R = rng(cx * 7919 + cy * 104729 + 17), gx = cx * BLOCK, gy = cy * BLOCK;
      const f = FP.find(q => q.cx === cx && q.cy === cy);
      const tryAdd = (name, x, y) => { if (okProp(x, y)) { addProp(name, x, y); return true; } return false; };
      if (f) {
        if (f.solid) continue;
        if (!tryAdd('lampPost', f.x - 34, f.y + f.h + 6)) tryAdd('lampPost', f.x + f.w + 30, f.y + f.h + 6);
        if (R() < .65) tryAdd('pole', f.x + f.w + 56, f.y + f.h * .45) || tryAdd('pole', f.x - 56, f.y + f.h * .45);
        const r = R();
        if (r < .35) tryAdd('barrels', f.x + f.w + 40, f.y + f.h - 20);
        else if (r < .6) tryAdd('crates', f.x - 40, f.y + f.h - 30);
        else if (r < .75) tryAdd('pine', f.x - 50, f.y + 40);
        continue;
      }
      if (GRID[cy][cx] !== '.') continue;
      const ccx = gx + BLOCK / 2, ccy = gy + BLOCK / 2, set = Math.floor(R() * 5);
      const jit = () => (R() - .5) * 160;
      if (set === 0) { tryAdd('tankStilt', ccx + jit(), ccy + jit()); tryAdd('barrels', ccx + jit(), ccy + jit()); tryAdd('pole', ccx + jit(), ccy + jit()); }
      else if (set === 1) { tryAdd('pine', ccx - 60 + jit() * .4, ccy + jit() * .4); tryAdd('pine', ccx + 70 + jit() * .4, ccy + 40 + jit() * .4); tryAdd('toro', ccx + jit(), ccy + 90); }
      else if (set === 2) { tryAdd('bare', ccx + jit(), ccy + jit()); tryAdd('crates', ccx + jit(), ccy + jit()); tryAdd('lampPost', ccx + jit(), ccy + jit()); }
      else if (set === 3) { tryAdd('tankStilt', ccx - 70, ccy + jit() * .5); tryAdd('tankStilt', ccx + 50, ccy + 30 + jit() * .3); tryAdd('pole', ccx + jit(), ccy - 120); }
      else { tryAdd('pine', ccx + jit(), ccy + jit()); tryAdd('lampPost', ccx + jit(), ccy + jit()); }
    }
    for (const p of props) ITEMS.push({ kind: 'p', name: p.name, x: p.x, y: p.y, base: p.y, bx: 0, by: 0, bw: 0, bh: 0 });
    ITEMS.sort((a, b) => a.base - b.base || a.x - b.x);
    // cables: tangled wires between building anchors and utility poles
    const nodes = [];
    FP.forEach((f, i) => { for (const [ax, ay] of VDEF[f.ch].anchors) nodes.push({ x: f.x + ax, y: f.y + ay, o: i, n: 0 }); });
    for (const p of props) if (p.name === 'pole') { nodes.push({ x: p.x - 14, y: p.y - 100, o: -1, n: 0 }); nodes.push({ x: p.x + 14, y: p.y - 100, o: -1, n: 0 }); }
    const pairs = [];
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const A = nodes[a], B = nodes[b]; if (A.o === B.o && A.o >= 0) continue;
      const d = Math.hypot(A.x - B.x, A.y - B.y); if (d < 180 || d > 560) continue;
      pairs.push([d, a, b]);
    }
    pairs.sort((p, q) => p[0] - q[0]);
    for (const [d, a, b] of pairs) {
      const A = nodes[a], B = nodes[b]; if (A.n >= 2 || B.n >= 2) continue;
      if (hash2(a, b, 41) > .7) continue;
      A.n++; B.n++;
      const sag1 = 16 + d * .06, sag2 = 30 + d * .09;
      CABLES.push({ x1: A.x, y1: A.y, x2: B.x, y2: B.y, s: [sag1, sag2], o1: A.o, o2: B.o,
        bx: Math.min(A.x, B.x), by: Math.min(A.y, B.y), bw: Math.abs(A.x - B.x), bh: Math.abs(A.y - B.y) + sag2 });
    }
    // canal life: boats, mooring posts, small docks
    const R = rng(4711);
    for (const X of CANALS) for (let y = E + 160; y < SIZE - E - 160; y += 210) {
      if (CANALS.some(c => Math.abs(y - c) < 170) || BRIDGES.some(b => b.d === 'h' && Math.abs(b.x + b.w / 2 - X) < 5 && Math.abs(b.y + b.h / 2 - y) < 190)) continue;
      const r = R(), side = R() < .5 ? -1 : 1, yy = y + (R() - .5) * 60;
      if (r < .45) { BOATS.push({ k: 'v', x: X + side * 30, y: yy }); POSTS.push({ x: X + side * (CW / 2 + 10), y: yy - 26 }, { x: X + side * (CW / 2 + 10), y: yy + 30 }); }
      else if (r < .65) { DOCKS.push({ x: side < 0 ? X - CW / 2 - 6 : X + CW / 2 - 40, y: yy - 30, w: 46, h: 60, d: 'h' }); POSTS.push({ x: side < 0 ? X - CW / 2 + 34 : X + CW / 2 - 34, y: yy - 26 }); }
    }
    for (const Y of CANALS) for (let x = E + 160; x < SIZE - E - 160; x += 230) {
      if (CANALS.some(c => Math.abs(x - c) < 180) || BRIDGES.some(b => b.d === 'v' && Math.abs(b.y + b.h / 2 - Y) < 5 && Math.abs(b.x + b.w / 2 - x) < 200)) continue;
      const r = R(), side = R() < .5 ? -1 : 1, xx = x + (R() - .5) * 60;
      if (r < .45) { BOATS.push({ k: 'h', x: xx, y: Y + side * 26 }); POSTS.push({ x: xx - 34, y: Y + side * (CW / 2 + 8) }, { x: xx + 36, y: Y + side * (CW / 2 + 8) }); }
      else if (r < .6) { DOCKS.push({ x: xx - 30, y: side < 0 ? Y - CW / 2 - 6 : Y + CW / 2 - 40, w: 60, h: 46, d: 'v' }); }
    }
    // boats at the jetties and by the gate pier
    BOATS.push({ k: 'v', x: 2786, y: 40 }, { k: 'v', x: 2934, y: 60 }, { k: 'h', x: 5150, y: 1222 }, { k: 'v', x: 1226, y: 5160 }, { k: 'v', x: 4234, y: 5150 }, { k: 'h', x: 20, y: 2478 });
    for (const j of JETTIES.concat([PIER])) {
      if (j.d === 'v') for (let y = j.y + 20; y < j.y + j.h - 10; y += 60) POSTS.push({ x: j.x + 4, y }, { x: j.x + j.w - 4, y });
      else for (let x = j.x + 20; x < j.x + j.w - 10; x += 60) POSTS.push({ x, y: j.y + 4 }, { x, y: j.y + j.h - 4 });
    }
    // rain puddles in the lanes
    const R2 = rng(99);
    for (let cy = 0; cy <= NC; cy++) for (let cx = 0; cx <= NC; cx++) {
      if (R2() < .45) continue;
      const x = cx * BLOCK + (R2() - .5) * 120, y = cy * BLOCK + (R2() - .5) * 120;
      if (onPlatform(x, y, 60) && !nearFoot(x, y, 30) && !inPlaza(x, y, 10)) PUDDLES.push({ x, y, k: Math.floor(R2() * 3) });
    }
  }
  plan();

  // ------------------------------------------------------------------ assets
  const A = {};
  const bcache = new Map();
  let ready = false;

  function buildingCanvas(f) {
    if (bcache.has(f.key)) return bcache.get(f.key);
    const d = VDEF[f.ch], cv = mk(d.w + MX * 2, d.h + MT + MB), c = cv.getContext('2d');
    c.translate(MX, MT); c.lineJoin = 'round'; c.lineCap = 'round';
    const pal = +f.key.slice(1), vi = 'TWBSDHOQRKM'.indexOf(f.ch);
    const P = { idx: pal, seed: pal + 3, R: ROOFS[(vi * 2 + pal) % ROOFS.length], R2: ROOFS[(vi * 2 + pal + 3) % ROOFS.length], W: WALLS[(vi + pal) % WALLS.length], W2: WALLS[(vi + pal + 2) % WALLS.length], tank: TANKS[(vi + pal) % 3] };
    d.fn(c, P);
    if (!d.noDraw) for (const [lx, ly] of d.lamps) { line(c, lx, ly - 15, lx + (lx < d.w / 2 ? 8 : -8), ly - 15, '#2e3236', 2); chochin(c, lx, ly, 1.05); }
    bcache.set(f.key, cv);
    return cv;
  }

  function makeWaterTile() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(6262);
    frect(c, 0, 0, S, S, '#3e7f8e');
    for (let i = 0; i < 10; i++) { const x = R() * S, y = R() * S; for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) fell(c, x + ox, y + oy, 50 + R() * 30, 14 + R() * 8, 'rgba(52,108,122,.35)'); }
    c.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      const x = R() * S, y = R() * S, w = 12 + R() * 24, col = R() < .6 ? 'rgba(160,210,220,.42)' : 'rgba(30,80,98,.45)';
      for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { c.beginPath(); c.moveTo(x + ox - w, y + oy); c.quadraticCurveTo(x + ox, y + oy - 4, x + ox + w, y + oy); sk(c, col, 2); }
    }
    return cv;
  }
  function makePave(light) {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(light ? 818 : 717);
    const base = light ? '#aab3b1' : '#959fa0', joint = light ? '#7d888a' : '#6c787b';
    frect(c, 0, 0, S, S, joint);
    if (light) {
      for (let j = 0; j < 4; j++) for (let i = -1; i < 5; i++) {
        const x = i * 64 + (j % 2) * 32, y = j * 64, sh = mix(base, R() < .5 ? '#c9d0ce' : '#8a9496', R() * .35);
        frect(c, x + 2, y + 2, 60, 60, sh);
      }
      for (let j = 0; j < 4; j++) for (let i = -1; i < 5; i++) { const x = i * 64 + (j % 2) * 32 + 2, y = j * 64 + 2; frect(c, x, y, 60, 3, 'rgba(255,255,255,.18)'); frect(c, x, y, 3, 60, 'rgba(255,255,255,.12)'); }
    } else {
      for (let row = 0; row < 8; row++) {
        const y = row * 32; let x = R() * 40;
        const start = x;
        while (x < start + S) {
          const w = Math.min(36 + R() * 34, start + S - x), sh = mix(base, R() < .5 ? '#b9c2c0' : '#77828a', R() * .4);
          for (const ox of [0, -S]) { frect(c, x + ox + 1.5, y + 1.5, w - 3, 29, sh); frect(c, x + ox + 1.5, y + 1.5, w - 3, 2, 'rgba(255,255,255,.16)'); frect(c, x + ox + w - 4, y + 3, 2.5, 27, 'rgba(20,30,40,.12)'); }
          x += w;
        }
      }
    }
    for (let i = 0; i < 26; i++) { const x = R() * S, y = R() * S; fell(c, x, y, 3 + R() * 8, 1.5 + R() * 3, R() < .5 ? 'rgba(84,118,96,.32)' : 'rgba(40,60,70,.18)'); }
    return cv;
  }
  function makePlank(vertSeams) {
    const S = 128, cv = mk(S, S), c = cv.getContext('2d'), R = rng(vertSeams ? 31 : 37);
    frect(c, 0, 0, S, S, '#8a7a68');
    for (let i = 0; i < 8; i++) {
      const sh = mix('#8a7a68', R() < .5 ? '#a8977f' : '#62574b', R() * .5);
      if (vertSeams) frect(c, i * 16, 0, 16, S, sh); else frect(c, 0, i * 16, S, 16, sh);
    }
    c.strokeStyle = '#4c4238'; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i <= 8; i++) { if (vertSeams) { c.moveTo(i * 16, 0); c.lineTo(i * 16, S); } else { c.moveTo(0, i * 16); c.lineTo(S, i * 16); } }
    c.stroke();
    c.strokeStyle = 'rgba(60,50,40,.3)'; c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < 24; i++) { const a = R() * S, b = R() * S, l = 10 + R() * 30; if (vertSeams) { c.moveTo(a, b); c.lineTo(a, b + l); } else { c.moveTo(b, a); c.lineTo(b + l, a); } }
    c.stroke();
    for (let i = 0; i < 8; i++) for (const t of [20, 84]) { if (vertSeams) fell(c, i * 16 + 8, t, 1.2, 1.2, '#3a332c'); else fell(c, t, i * 16 + 8, 1.2, 1.2, '#3a332c'); }
    return cv;
  }
  function makeFace() {
    const Wd = 520, H = FACE + 16, cv = mk(Wd, H), c = cv.getContext('2d'), R = rng(313);
    frect(c, 0, 0, Wd, FACE, '#46535a');
    for (let row = 0; row < 2; row++) {
      const y = 4 + row * 10; let x = -row * 22;
      while (x < Wd) { const bw = 34 + R() * 24; frect(c, x + 1, y, bw - 2, 9, R() < .5 ? '#6a7880' : '#5c6971'); frect(c, x + 1, y, bw - 2, 2, 'rgba(255,255,255,.12)'); x += bw; }
    }
    frect(c, 0, 0, Wd, 3, '#c3cbc9'); frect(c, 0, 3, Wd, 1, '#3c474e');
    frect(c, 0, FACE - 5, Wd, 5, 'rgba(25,50,58,.6)');
    for (let i = 0; i < 14; i++) frect(c, R() * Wd, 4, 2 + R() * 3, 8 + R() * 10, 'rgba(84,118,96,.45)');
    c.fillStyle = 'rgba(16,40,52,.38)'; c.fillRect(0, FACE, Wd, 9);
    c.strokeStyle = 'rgba(225,240,245,.55)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 26; i++) { const x = R() * Wd, y = FACE + 3 + R() * 9; c.moveTo(x, y); c.lineTo(x + 6 + R() * 12, y); } c.stroke();
    return cv;
  }
  function makeFaceWood() {
    const Wd = 520, H = FACE + 16, cv = mk(Wd, H), c = cv.getContext('2d'), R = rng(919);
    frect(c, 0, 0, Wd, 10, '#4e4136'); frect(c, 0, 0, Wd, 2, '#8c7a66'); frect(c, 0, 9, Wd, 1, '#2c241e');
    for (let x = 14; x < Wd; x += 52) {
      frect(c, x - 5, 10, 10, FACE - 6, '#3e342b'); frect(c, x - 5, 10, 3, FACE - 6, '#6a5a4a');
      fell(c, x, FACE + 4, 9, 3, 'rgba(225,240,245,.45)');
    }
    for (let i = 0; i < 8; i++) frect(c, R() * Wd, 10, 3, 6 + R() * 8, 'rgba(84,118,96,.5)');
    c.fillStyle = 'rgba(16,40,52,.32)'; c.fillRect(0, FACE, Wd, 9);
    c.strokeStyle = 'rgba(225,240,245,.5)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 20; i++) { const x = R() * Wd, y = FACE + 4 + R() * 8; c.moveTo(x, y); c.lineTo(x + 6 + R() * 10, y); } c.stroke();
    return cv;
  }
  function makeRockStrip(horiz) {
    const L = 520, T = 150, cv = horiz ? mk(L, T) : mk(T, L), c = cv.getContext('2d'), R = rng(horiz ? 2024 : 4048);
    const rocks = [];
    for (let t = -10; t < L + 10; t += 16 + R() * 18) rocks.push({ t, o: (R() - .5) * 44, r: 12 + R() * 18, seed: Math.floor(R() * 1e9) });
    const inst = [];
    for (const k of rocks) for (const sh of [-L, 0, L]) if (k.t + sh > -40 && k.t + sh < L + 40) inst.push({ ...k, t: k.t + sh });
    const pos = k => horiz ? [k.t, T / 2 + k.o] : [T / 2 + k.o, k.t];
    inst.sort((a, b) => pos(a)[1] - pos(b)[1]);
    for (const k of inst) { const [x, y] = pos(k); fell(c, x + 2, y + k.r * .5, k.r * 1.25, k.r * .38, 'rgba(225,240,244,.5)'); }
    for (const k of inst) { const [x, y] = pos(k); boulder(c, x, y, k.r, rng(k.seed)); }
    return cv;
  }
  function makeCorner() {
    const S = 260, cv = mk(S, S), c = cv.getContext('2d'), R = rng(77);
    const bs = [];
    for (let i = 0; i < 22; i++) { const a = R() * TAU, d = R() * 90; bs.push([S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d * .8, 16 + R() * 22]); }
    bs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of bs) fell(c, x + 2, y + r * .5, r * 1.2, r * .36, 'rgba(225,240,244,.45)');
    for (const [x, y, r] of bs) boulder(c, x, y, r, R);
    return cv;
  }
  function makePlaza() {
    const { rx: RX, ry: RY } = PLAZA, W = RX * 2 + 20, H = RY * 2 + 30, cx = W / 2, cy = RY + 10;
    const cv = mk(W, H), c = cv.getContext('2d');
    fell(c, cx + 6, cy + 10, RX, RY, 'rgba(20,35,45,.25)');
    fell(c, cx, cy, RX, RY, '#6f7b7f');
    const rings = [.97, .82, .66, .5];
    rings.forEach((f, k) => {
      fell(c, cx, cy, RX * f, RY * f, k % 2 ? '#a7b0ae' : '#b9c1bf');
      const n = Math.round(90 * f), fi = rings[k + 1] || 0;
      c.strokeStyle = 'rgba(80,92,98,.5)'; c.lineWidth = 1.2; c.beginPath();
      for (let i = 0; i < n; i++) { const a = i / n * TAU; c.moveTo(cx + Math.cos(a) * RX * f, cy + Math.sin(a) * RY * f); c.lineTo(cx + Math.cos(a) * RX * fi, cy + Math.sin(a) * RY * fi); }
      c.stroke();
      c.beginPath(); c.ellipse(cx, cy, RX * f, RY * f, 0, 0, TAU); sk(c, '#6f7b7f', 3);
    });
    // water mosaic with the 水 inlay
    const ir = .5;
    c.save(); c.beginPath(); c.ellipse(cx, cy, RX * ir - 2, RY * ir - 2, 0, 0, TAU); c.clip();
    frect(c, 0, 0, W, H, '#56818e');
    c.strokeStyle = 'rgba(190,225,230,.5)'; c.lineWidth = 3;
    for (let y = cy - RY * ir; y < cy + RY * ir; y += 18) { c.beginPath(); for (let x = cx - RX * ir; x < cx + RX * ir; x += 4) c.lineTo(x, y + Math.sin(x / 14) * 4); c.stroke(); }
    c.restore();
    c.save(); c.translate(cx, cy + 6); c.scale(1, RY / RX);
    txt(c, '水', 0, 0, 230, '#e9eeea', { weight: '900', stroke: '#2f4f58', sw: 10 });
    c.restore();
    c.beginPath(); c.ellipse(cx, cy, RX * ir, RY * ir, 0, 0, TAU); sk(c, '#4d5a60', 5);
    c.beginPath(); c.ellipse(cx, cy, RX, RY, 0, 0, TAU); sk(c, OUT, 2);
    return cv;
  }
  function makePuddle(k) {
    const R = rng(50 + k), w = 70 + k * 18, h = 26 + k * 6, cv = mk(w, h), c = cv.getContext('2d');
    c.beginPath();
    for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU, r = .78 + R() * .22; c.lineTo(w / 2 + Math.cos(a) * (w / 2 - 3) * r, h / 2 + Math.sin(a) * (h / 2 - 2) * r); }
    c.closePath(); c.fillStyle = 'rgba(70,110,125,.45)'; c.fill();
    c.strokeStyle = 'rgba(40,60,70,.35)'; c.lineWidth = 1.5; c.stroke();
    line(c, w * .25, h * .4, w * .55, h * .4, 'rgba(225,240,245,.55)', 2);
    return cv;
  }
  function makeBoat(vert) {
    const L = 96, Wd = 34;
    return sprite(vert ? 60 : 120, vert ? 120 : 60, vert ? 30 : 60, vert ? 60 : 30, (c, ax, ay) => {
      c.save(); c.translate(ax, ay); if (vert) c.rotate(Math.PI / 2);
      fell(c, 0, 4, L / 2 + 8, Wd / 2 + 4, 'rgba(225,240,245,.35)');
      fell(c, 4, 6, L / 2, Wd / 2 - 2, 'rgba(10,30,40,.35)');
      const hull = pathFrom([[-L / 2, 0], [-L / 2 + 16, -Wd / 2], [L / 2 - 20, -Wd / 2], [L / 2, -4], [L / 2, 4], [L / 2 - 20, Wd / 2], [-L / 2 + 16, Wd / 2]]);
      celFill(c, hull, '#6b5644', '#8c735c', '#4a3a2e', { ld: 3, dd: 4 });
      c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(hull);
      const inner = pathFrom([[-L / 2 + 8, 0], [-L / 2 + 20, -Wd / 2 + 5], [L / 2 - 22, -Wd / 2 + 5], [L / 2 - 8, 0], [L / 2 - 22, Wd / 2 - 5], [-L / 2 + 20, Wd / 2 - 5]]);
      c.fillStyle = '#a28a6c'; c.fill(inner);
      for (const sx of [-18, 14]) frect(c, sx, -Wd / 2 + 5, 6, Wd - 10, '#5a4838');
      line(c, -36, -2, 30, 2, '#3a3129', 2);
      c.restore();
    });
  }
  function buildProps() {
    const P = PROPS;
    P.lampPost = sprite(40, 90, 14, 84, (c, ax, ay) => {
      fell(c, ax + 5, ay, 10, 3, 'rgba(15,30,40,.3)');
      frect(c, ax - 3, ay - 72, 6, 72, WOODK.dark); frect(c, ax - 3, ay - 72, 2, 72, WOODK.light); srect(c, ax - 3, ay - 72, 6, 72, OUT, 1.2);
      line(c, ax - 3, ay - 70, ax + 16, ay - 70, WOODK.deep, 3);
      chochin(c, ax + 12, ay - 58, 1.1);
    });
    P.toro = sprite(40, 64, 20, 60, (c, ax, ay) => drawToro(c, ax, ay, 1));
    P.toroBig = sprite(50, 84, 25, 80, (c, ax, ay) => drawToro(c, ax, ay, 1.36));
    P.pole = sprite(50, 120, 25, 114, (c, ax, ay) => {
      fell(c, ax + 6, ay, 10, 3, 'rgba(15,30,40,.3)');
      frect(c, ax - 3, ay - 108, 6, 108, '#5d564e'); frect(c, ax - 3, ay - 108, 2, 108, '#857d72'); srect(c, ax - 3, ay - 108, 6, 108, OUT, 1.2);
      frect(c, ax - 18, ay - 102, 36, 4, '#4a443e');
      for (const dx of [-14, 14]) fell(c, ax + dx, ay - 104, 2, 2.5, '#d8d8d0');
      frect(c, ax + 3, ay - 70, 9, 12, '#7d8a90'); srect(c, ax + 3, ay - 70, 9, 12, OUT, 1);
    });
    P.tankStilt = sprite(70, 120, 35, 112, (c, ax, ay) => waterTank(c, ax, ay, 20, 26, TANKS[0], { legH: 34 }));
    P.barrels = sprite(70, 50, 35, 44, (c, ax, ay) => {
      fell(c, ax + 4, ay, 30, 6, 'rgba(15,30,40,.28)');
      for (const [dx, dy] of [[-14, -4], [12, -6], [0, 4]]) {
        const g = cylinder(c, ax + dx, ay + dy - 22, 10, 18, tone('#6d5a48'), { band: [[4, 2, '#3c454c'], [13, 2, '#3c454c']] });
        fell(c, g.cx, g.ty, 10, 4, '#8c7660'); c.beginPath(); c.ellipse(g.cx, g.ty, 10, 4, 0, 0, TAU); sk(c, OUT, 1.2);
      }
    });
    P.crates = sprite(70, 56, 35, 50, (c, ax, ay) => {
      fell(c, ax + 4, ay, 30, 6, 'rgba(15,30,40,.28)');
      const box = (x, y, s) => { frect(c, x, y - s, s, s * .35, '#a8916f'); frect(c, x, y - s * .65, s, s * .65, '#8a7356'); line(c, x, y - s * .65, x + s, y, '#5e4c3a', 1.5); line(c, x + s, y - s * .65, x, y, '#5e4c3a', 1.5); srect(c, x, y - s, s, s, OUT, 1.3); };
      box(ax - 26, ay - 2, 24); box(ax, ay, 26); box(ax - 14, ay - 22, 20);
    });
    P.pine = sprite(110, 120, 46, 112, (c, ax, ay) => drawPineK(c, ax, ay, 1.15, 11));
    P.bare = sprite(100, 110, 50, 104, (c, ax, ay) => {
      fell(c, ax + 10, ay, 22, 6, 'rgba(15,30,40,.28)');
      const R = rng(9);
      const br = (x, y, a, l, w) => { if (l < 6) return; const x2 = x + Math.sin(a) * l, y2 = y - Math.cos(a) * l; line(c, x, y, x2, y2, '#4a4f52', w); br(x2, y2, a - .35 - R() * .3, l * .72, w * .68); br(x2, y2, a + .3 + R() * .3, l * .66, w * .68); };
      br(ax, ay, -.05, 34, 6);
      fpoly(c, [ax - 6, ay, ax - 3, ay - 10, ax + 3, ay - 10, ax + 6, ay], '#4a4f52');
    });
    P.monument = sprite(60, 110, 30, 104, (c, ax, ay) => {
      fell(c, ax + 8, ay, 26, 7, 'rgba(15,30,40,.3)');
      frect(c, ax - 22, ay - 10, 44, 10, '#77838a'); srect(c, ax - 22, ay - 10, 44, 10, OUT, 1.3);
      const st = pathFrom([[ax - 15, ay - 10], [ax - 17, ay - 88], [ax - 8, ay - 98], [ax + 10, ay - 96], [ax + 16, ay - 86], [ax + 15, ay - 10]]);
      celFill(c, st, '#8a969b', '#aeb8bb', '#66727a', { ld: 3, dd: 4 }); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(st);
      txtV(c, '霧隠れの里', ax, ay - 90, 13, '#26343c');
    });
    // West gate: two stone pillars on either side of the pier, joined by a roofed beam (seen from the side).
    P.gate = sprite(150, 440, 75, 420, (c, ax, ay) => {
      const H = 150, yN = ay - 210, R = tone('#3f8a8b');
      const top = yN - H - 44, bot = ay - H + 22, x0 = ax - 38, x1 = ax + 38;
      const pill = (y, cut) => {
        fell(c, ax + 12, y + 2, 24, 7, 'rgba(15,30,40,.32)');
        frect(c, ax - 18, y - 16, 36, 18, '#6d787e'); frect(c, ax - 18, y - 16, 36, 3, '#9aa5aa'); srect(c, ax - 18, y - 16, 36, 18, OUT, 1.5);
        const p = pathFrom([[ax - 12, y - 16], [ax - 12, cut], [ax + 12, cut], [ax + 12, y - 16]]);
        celFill(c, p, '#8d989d', '#b1bbbe', '#6a767c', { ld: 4, dd: 5 }); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(p);
        frect(c, ax - 12, y - 60, 24, 4, '#5d6a70');
        line(c, ax - 58, y - H + 34, ax - 10, y - H + 34, '#3a3129', 3);
        chochin(c, ax - 52, y - H + 50, 1.4);
      };
      pill(yN, yN - H);
      // gabled roof running north-south along the cross beam
      fell(c, ax + 26, (top + bot) / 2 + 30, 30, (bot - top) / 2, 'rgba(15,30,40,.18)');
      frect(c, x0, top, ax - x0, bot - top, R.light); frect(c, ax, top, x1 - ax, bot - top, R.dark);
      c.strokeStyle = R.base; c.lineWidth = 2; c.beginPath(); for (let y = top + 6; y < bot; y += 8) { c.moveTo(x0, y); c.lineTo(ax, y); } c.stroke();
      c.strokeStyle = R.deep; c.lineWidth = 2; c.beginPath(); for (let y = top + 6; y < bot; y += 8) { c.moveTo(ax, y); c.lineTo(x1, y); } c.stroke();
      frect(c, x0, top, 5, bot - top, R.deep); frect(c, x1 - 5, top, 5, bot - top, R.deep);
      line(c, ax, top - 3, ax, bot + 3, R.deep, 8); line(c, ax - 2, top - 1, ax - 2, bot + 1, R.hi, 1.6);
      fpoly(c, [x0, bot, ax, bot - 10, x1, bot, x1, bot + 9, ax, bot + 1, x0, bot + 9], R.deep);
      for (const [ex, ey, s] of [[x0, top, -1], [x1, top, 1], [x0, bot + 8, -1], [x1, bot + 8, 1]]) { const pts = [ex, ey, ex + s * 9, ey - 9, ex + s * 4, ey + 4]; fpoly(c, pts, R.deep); poly(c, pts); sk(c, OUT, 1.2); }
      poly(c, [x0, top, x1, top, x1, bot + 9, x0, bot + 9]); sk(c, OUT, 2);
      // the village crest plaque at the middle of the beam
      const my = (top + bot) / 2;
      fell(c, ax, my, 22, 22, '#2f3a40'); fell(c, ax, my, 19, 19, '#eef1ec');
      c.beginPath(); c.arc(ax, my, 15, 0, TAU); sk(c, R.dark, 2);
      txt(c, '霧', ax, my + 1, 24, '#1f4f58', { weight: '900' });
      pill(ay, bot + 9);
    });
  }

  function init() {
    if (ready) return;
    const tmp = mk(4, 4).getContext('2d');
    A.waterPat = tmp.createPattern(makeWaterTile(), 'repeat');
    A.pavePat = tmp.createPattern(makePave(false), 'repeat');
    A.pave2Pat = tmp.createPattern(makePave(true), 'repeat');
    A.plankV = tmp.createPattern(makePlank(true), 'repeat');
    A.plankH = tmp.createPattern(makePlank(false), 'repeat');
    A.face = makeFace(); A.faceWood = makeFaceWood();
    A.rockH = makeRockStrip(true); A.rockV = makeRockStrip(false);
    A.corner = makeCorner();
    A.plaza = makePlaza();
    A.puddles = [0, 1, 2].map(makePuddle);
    A.boatH = makeBoat(false); A.boatV = makeBoat(true);
    buildProps();
    for (const f of FP) buildingCanvas(f);
    A.mist = mk(480, 180);
    { const c = A.mist.getContext('2d'), R = rng(5);
      for (let i = 0; i < 14; i++) {
        const x = 110 + R() * 260, y = 66 + R() * 48, r = 40 + R() * 54;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(240,247,250,.42)'); g.addColorStop(1, 'rgba(240,247,250,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * .62, 0, 0, TAU); c.fill();
      } }
    ready = true;
  }

  // ------------------------------------------------------------------ drawing
  let bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
  const hit = (x, y, w, h) => x < bx1 && x + w > bx0 && y < by1 && y + h > by0;
  function drawSprite(ctx, s, x, y) { ctx.drawImage(s.cv, Math.round(x - s.ax), Math.round(y - s.ay)); }
  function deck(ctx, b) {
    if (!hit(b.x - 10, b.y - 20, b.w + 20, b.h + 34)) return;
    ctx.fillStyle = b.d === 'h' ? A.plankV : A.plankH; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#3e352d'; ctx.fillRect(b.x, b.y + b.h, b.w, 9);
    ctx.fillStyle = 'rgba(16,40,52,.35)'; ctx.fillRect(b.x + 4, b.y + b.h + 9, b.w, 7);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  function rails(ctx, b) {
    if (!hit(b.x - 10, b.y - 20, b.w + 20, b.h + 34)) return;
    ctx.strokeStyle = WOODK.deep; ctx.lineWidth = 3; ctx.beginPath();
    const posts = [];
    if (b.d === 'h') {
      for (const y of [b.y + 3, b.y + b.h - 3]) { ctx.moveTo(b.x + 30, y - 14); ctx.lineTo(b.x + b.w - 30, y - 14); for (let x = b.x + 30; x <= b.x + b.w - 29; x += (b.w - 60) / 3) posts.push([x, y]); }
    } else {
      for (const x of [b.x + 3, b.x + b.w - 3]) { ctx.moveTo(x, b.y + 30 - 14); ctx.lineTo(x, b.y + b.h - 30 - 14); for (let y = b.y + 30; y <= b.y + b.h - 29; y += (b.h - 60) / 3) posts.push([x, y]); }
    }
    ctx.stroke();
    for (const [x, y] of posts) { ctx.fillStyle = WOODK.dark; ctx.fillRect(x - 3, y - 16, 6, 16); ctx.fillStyle = WOODK.light; ctx.fillRect(x - 3, y - 16, 2, 16); }
  }
  function stripH(ctx, img, y, gaps) {
    if (!(y < by1 && y + img.height > by0)) return;
    const segs = []; let a = -60;
    for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) { segs.push([a, g0]); a = g1; }
    segs.push([a, SIZE + 60]);
    for (const [s0, s1] of segs) {
      const x0 = Math.max(s0, bx0 - 10), x1 = Math.min(s1, bx1 + 10);
      for (let tx = Math.floor(x0 / 520) * 520; tx < x1; tx += 520) {
        const a2 = Math.max(tx, x0), b2 = Math.min(tx + 520, x1); if (b2 <= a2) continue;
        ctx.drawImage(img, a2 - tx, 0, b2 - a2, img.height, a2, y, b2 - a2, img.height);
      }
    }
  }
  function stripV(ctx, img, x, gaps) {
    if (!(x < bx1 && x + img.width > bx0)) return;
    const segs = []; let a = -60;
    for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) { segs.push([a, g0]); a = g1; }
    segs.push([a, SIZE + 60]);
    for (const [s0, s1] of segs) {
      const y0 = Math.max(s0, by0 - 10), y1 = Math.min(s1, by1 + 10);
      for (let ty = Math.floor(y0 / 520) * 520; ty < y1; ty += 520) {
        const a2 = Math.max(ty, y0), b2 = Math.min(ty + 520, y1); if (b2 <= a2) continue;
        ctx.drawImage(img, 0, a2 - ty, img.width, b2 - a2, x, a2, img.width, b2 - a2);
      }
    }
  }

  function drawStatic(ctx, bounds, isDestroyed) {
    if (!ready) init();
    const dz = typeof isDestroyed === 'function' ? isDestroyed : () => false;
    bx0 = Math.max(-150, bounds.x); by0 = Math.max(-150, bounds.y);
    bx1 = Math.min(SIZE + 150, bounds.x + bounds.w); by1 = Math.min(SIZE + 150, bounds.y + bounds.h);
    if (bx1 <= bx0 || by1 <= by0) return;
    ctx.save();
    // 1. water everywhere inside the village square
    const ix0 = Math.max(0, bx0), iy0 = Math.max(0, by0), ix1 = Math.min(SIZE, bx1), iy1 = Math.min(SIZE, by1);
    if (ix1 > ix0 && iy1 > iy0) {
      ctx.fillStyle = A.waterPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      ctx.fillStyle = 'rgba(150,205,210,.16)';
      ctx.fillRect(E - 60, E - 60, SIZE - 2 * E + 120, 60); ctx.fillRect(E - 60, SIZE - E, SIZE - 2 * E + 120, 70);
      ctx.fillRect(E - 60, E, 60, SIZE - 2 * E); ctx.fillRect(SIZE - E, E, 60, SIZE - 2 * E);
    }
    // 2. stone platforms with their south faces
    for (const p of PLATFORMS) {
      if (!hit(p.x, p.y, p.w, p.h + FACE + 16)) continue;
      ctx.fillStyle = p.wood ? A.plankV : p.center ? A.pave2Pat : A.pavePat; ctx.fillRect(p.x, p.y, p.w, p.h);
      const fy = p.y + p.h, face = p.wood ? A.faceWood : A.face;
      if (fy < by1 && fy + FACE + 16 > by0) for (let fx = p.x; fx < p.x + p.w; fx += 520) {
        if (fx > bx1 || fx + 520 < bx0) continue;
        const sw = Math.min(520, p.x + p.w - fx);
        ctx.drawImage(face, 0, 0, sw, face.height, fx, fy, sw, face.height);
      }
      if (p.wood) {
        ctx.strokeStyle = '#5a4c40'; ctx.lineWidth = 8; ctx.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
        ctx.strokeStyle = 'rgba(160,140,115,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
        ctx.fillStyle = 'rgba(40,32,26,.35)';
        for (let yy = p.y + 128; yy < p.y + p.h - 20; yy += 256) if (yy > by0 - 10 && yy < by1 + 10) ctx.fillRect(Math.max(p.x, bx0), yy, Math.min(p.x + p.w, bx1) - Math.max(p.x, bx0), 6);
      } else {
        ctx.strokeStyle = '#bcc5c3'; ctx.lineWidth = 5; ctx.strokeRect(p.x + 2.5, p.y + 2.5, p.w - 5, p.h - 5);
        ctx.strokeStyle = 'rgba(70,82,90,.55)'; ctx.lineWidth = 1.2; ctx.strokeRect(p.x + 6, p.y + 6, p.w - 12, p.h - 12);
      }
      ctx.strokeStyle = 'rgba(25,38,48,.75)'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
    // 3. plaza mosaic and puddles
    { const w = A.plaza.width, h = A.plaza.height, x = PLAZA.x - w / 2, y = PLAZA.y - PLAZA.ry - 10;
      if (hit(x, y, w, h)) ctx.drawImage(A.plaza, x, y); }
    for (const p of PUDDLES) { const img = A.puddles[p.k]; if (hit(p.x, p.y, img.width, img.height)) ctx.drawImage(img, p.x - img.width / 2, p.y - img.height / 2); }
    // 4. wooden decks: bridges, docks, jetties, the gate pier
    for (const d of DOCKS) deck(ctx, d);
    for (const b of BRIDGES) deck(ctx, b);
    for (const j of JETTIES) deck(ctx, j);
    deck(ctx, PIER);
    for (const b of BRIDGES) rails(ctx, b);
    // 5. boats and mooring posts
    for (const b of BOATS) { const s = b.k === 'v' ? A.boatV : A.boatH; if (hit(b.x - s.ax, b.y - s.ay, s.cv.width, s.cv.height)) drawSprite(ctx, s, b.x, b.y); }
    ctx.fillStyle = '#3e352d';
    for (const p of POSTS) if (hit(p.x - 6, p.y - 20, 12, 26)) {
      ctx.fillStyle = 'rgba(16,40,52,.35)'; ctx.fillRect(p.x - 2, p.y, 10, 4);
      ctx.fillStyle = '#3e352d'; ctx.fillRect(p.x - 4, p.y - 16, 8, 18);
      ctx.fillStyle = '#7a6a5a'; ctx.fillRect(p.x - 4, p.y - 16, 3, 18);
      ctx.fillStyle = '#5a4c40'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 16, 4, 2, 0, 0, TAU); ctx.fill();
    }
    // 6. rocky shoreline
    stripH(ctx, A.rockH, E - 78, GAPS.n);
    stripV(ctx, A.rockV, E - 75, GAPS.w);
    stripV(ctx, A.rockV, SIZE - E - 75, GAPS.e);
    stripH(ctx, A.rockH, SIZE - E - 62, GAPS.s);
    for (const [x, y] of [[E, E], [SIZE - E, E], [E, SIZE - E + 10], [SIZE - E, SIZE - E + 10]]) if (hit(x - 130, y - 130, 260, 260)) ctx.drawImage(A.corner, x - 130, y - 130);
    // 7. building shadows (toward the lower right)
    ctx.fillStyle = 'rgba(14,32,44,.26)'; ctx.beginPath();
    for (let i = 0; i < FP.length; i++) {
      const f = FP[i]; if (f.ch === 'K' || !hit(f.x, f.y, f.w + 30, f.h + 20) || dz(i)) continue;
      const r = f.x + f.w, b = f.y + f.h;
      ctx.moveTo(r, f.y + 22); ctx.lineTo(r + 22, f.y + 38); ctx.lineTo(r + 22, b + 12); ctx.lineTo(f.x + 30, b + 12); ctx.lineTo(f.x + 16, b); ctx.lineTo(r, b); ctx.closePath();
    }
    ctx.fill();
    // 8. buildings and props in painter's order
    for (const it of ITEMS) {
      if (it.kind === 'b') {
        if (!hit(it.bx, it.by, it.bw, it.bh) || dz(it.i)) continue;
        ctx.drawImage(bcache.get(it.key), it.bx, it.by);
      } else {
        const s = PROPS[it.name];
        if (hit(it.x - s.ax, it.y - s.ay, s.cv.width, s.cv.height)) drawSprite(ctx, s, it.x, it.y);
      }
    }
    // 9. tangled overhead cables
    ctx.strokeStyle = 'rgba(28,32,36,.8)'; ctx.lineWidth = 1.3; ctx.beginPath();
    for (const cb of CABLES) {
      if (!hit(cb.bx, cb.by, cb.bw + 1, cb.bh + 1)) continue;
      if ((cb.o1 >= 0 && dz(cb.o1)) || (cb.o2 >= 0 && dz(cb.o2))) continue;
      const mx = (cb.x1 + cb.x2) / 2, my = (cb.y1 + cb.y2) / 2;
      for (const s of cb.s) { ctx.moveTo(cb.x1, cb.y1); ctx.quadraticCurveTo(mx, my + s * 2, cb.x2, cb.y2); }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    const t = time || 0;
    const vx0 = Math.max(view.x, -150), vy0 = Math.max(view.y, -150), vx1 = Math.min(view.x + view.w, SIZE + 150), vy1 = Math.min(view.y + view.h, SIZE + 150);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    ctx.save();
    ctx.fillStyle = 'rgba(214,230,236,.08)'; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    // drifting mist banks (world anchored, wrapping)
    const PX = 2600, PY = 1900, MW = 1000, MH = 380;
    ctx.globalAlpha = .55;
    for (let i = 0; i < 4; i++) {
      const bx = hash2(i, 1, 3) * PX + t * (10 + i * 4), by = hash2(i, 2, 3) * PY + Math.sin(t * .05 + i * 1.7) * 60;
      const kx0 = Math.floor((vx0 - MW - bx) / PX), ky0 = Math.floor((vy0 - MH - by) / PY);
      for (let kx = kx0; kx <= kx0 + 2; kx++) for (let ky = ky0; ky <= ky0 + 2; ky++) {
        const x = bx + kx * PX, y = by + ky * PY;
        if (x < vx1 && x + MW > vx0 && y < vy1 && y + MH > vy0) ctx.drawImage(A.mist, x, y, MW, MH);
      }
    }
    ctx.globalAlpha = 1;
    // light drizzle
    const N = 90, sx = view.w + 80, sy = view.h + 80;
    ctx.strokeStyle = 'rgba(215,232,240,.38)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const wx = hash2(i, 4, 1) * 5000 - t * 60, wy = hash2(i, 5, 1) * 5000 + t * (420 + (i % 5) * 40);
      const x = view.x - 40 + (((wx - (view.x - 40)) % sx) + sx) % sx, y = view.y - 40 + (((wy - (view.y - 40)) % sy) + sy) % sy;
      if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawMinimap(ctx) {
    ctx.save();
    ctx.fillStyle = '#3a7b8c'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = '#6f7a7f'; ctx.lineWidth = 60; ctx.strokeRect(E, E, SIZE - 2 * E, SIZE - 2 * E);
    ctx.fillStyle = '#9ca6a6'; for (const p of PLATFORMS) ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#b8c0be'; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a7560'; for (const b of BRIDGES.concat(JETTIES, [PIER])) ctx.fillRect(b.x, b.y, b.w, b.h);
    for (const f of FP) {
      if (f.ch === 'M') continue;
      ctx.fillStyle = f.solid ? '#6d787d' : f.roof; ctx.fillRect(f.x, f.y, f.w, f.h);
      if (!f.solid) { ctx.fillStyle = 'rgba(240,245,245,.55)'; ctx.fillRect(f.x, f.y + f.h * .66, f.w, f.h * .34); }
    }
    const m = FP.find(f => f.ch === 'M');
    ctx.fillStyle = '#3f8f8a'; ctx.beginPath(); ctx.arc(m.x + m.w / 2, m.y + m.h / 2, m.w / 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f2e6a8'; ctx.lineWidth = 36; ctx.stroke();
    ctx.fillStyle = '#f2f4ee'; ctx.beginPath(); ctx.arc(m.x + m.w / 2, m.y + m.h / 2, m.w * .2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  window.ShinobiVillages.kiri = {
    id: 'kiri', name: 'LÀNG SƯƠNG MÙ', jp: '霧隠れの里', kage: 'MIZUKAGE',
    cols: NC, rows: NC,
    gate: { side: 'w', at: 2600 },
    spawn: { x: SPAWN.x, y: SPAWN.y },
    lanterns: LANTERNS,
    init,
    footprints() { return FP.map(f => { const o = { x: f.x, y: f.y, w: f.w, h: f.h, roof: f.roof, wall: f.wall }; if (f.solid) o.solid = true; return o; }); },
    drawStatic, drawAmbient, drawMinimap
  };
})();
