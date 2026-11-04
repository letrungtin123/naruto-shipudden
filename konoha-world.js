/* konoha-world.js — procedural Hidden Leaf Village (Konoha) environment in 3/4 oblique view.
   Exposes window.KonohaWorld = { init, drawStatic, drawAmbient, drawMinimap }.
   Everything is original procedural Canvas 2D art (no external images). */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, ROAD = 150, PAD = 35, FOOT = 300;
  let CELLS = 14;                  // blocks per side; set from WORLD in init()
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const GOTHIC = '"Yu Gothic","YuGothic","Meiryo","MS Gothic",sans-serif';
  const OUT = '#3b2a22';
  const CLIFF_TOP = -560;          // world y where the cliff tile starts (cliff face ends at y = 0)
  const FACES_W = 2100, FACES_H = 480, FACES_Y = -490;
  let FACES_CX = 3640;             // centred on the world in init()
  const GATE_W = 380, GATE_H = 262, GATE_Y = -20; // gate canvas y is relative to WORLD.h
  let GATE_CX = 3715;              // on the middle north-south road, set in init()
  const WALL_TILE_H = 320;
  const LANDMARKS = { '6,3': 'hokage', '5,3': 'academy', '5,4': 'ichiraku', '3,10': 'training',
    '8,5': 'hospital', '8,2': 'hyuga', '12,3': 'naka', '1,7': 'tower' };

  const GRASS = { base: '#7cb342', dark: '#66a136', deep: '#4f8a2b', light: '#9ccc65', edge: '#5a9431', tuft: '#6aa83a' };
  const ROADC = { base: '#dcc393', rim: '#cdb07e', dark: '#c4a571', light: '#e7d4aa', peb: '#b59c74' };
  const LEAF = { out: '#1e4826', dark: '#2e7a34', mid: '#48a03c', light: '#79c24a', hi: '#b2e07a' };
  const FOREST = { out: '#143620', dark: '#22602c', mid: '#348736', light: '#56aa44', hi: '#8ccd60' };
  const PINE = { out: '#173b26', dark: '#255f3a', mid: '#357f4a', light: '#56a35f', hi: '#86c77e' };
  const WOOD = { base: '#8b5a36', light: '#b07a4a', dark: '#64402a', deep: '#45301f' };
  const FS = { base: '#dccaa4', light: '#efe3c6', mid: '#c2ad86', dark: '#a48e69', line: '#6a5640' };
  const HS = { base: '#cdb890', light: '#e4d5b2', mid: '#b19b75', dark: '#937c5a', line: '#5f4c38' };
  const CONCRETE = '#d6c7a5';

  // ------------------------------------------------------------------ utils
  // Asset canvases are CPU-backed so blitting them never forces a GPU readback, whatever backend the cache canvas uses.
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
  function tone(base) { return { base, light: mix(base, '#fff4dc', .32), hi: mix(base, '#fffaf0', .58), dark: mix(base, '#3a1f3a', .26), deep: mix(base, '#24122a', .52) }; }

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
  function mirrorPts(left) { return left.concat(left.slice().reverse().map(([x, y]) => [-x, y])); }
  function txt(c, s, x, y, size, col, o = {}) {
    c.font = `${o.weight || '700'} ${size}px ${o.font || MINCHO}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 3; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function txtV(c, s, x, y, size, col, o = {}) {
    [...s].forEach((ch, i) => {
      const cy = y + size * .55 + i * size * 1.02;
      if (ch === 'ー') { line(c, x, cy - size * .38, x, cy + size * .38, col, Math.max(1.5, size * .1)); return; }
      txt(c, ch, x, cy, size, col, o);
    });
  }
  // Cel shading: base fill, light rim on the upper-left, dark rim on the lower-right (light from top-left).
  function celFill(c, path, base, light, dark, o = {}) {
    const ld = o.ld ?? 6, dd = o.dd ?? 8;
    c.save();
    c.fillStyle = base; c.fill(path);
    c.clip(path);
    if (light) { const p = new Path2D(); p.rect(-5000, -5000, 10000, 10000); p.addPath(path, new DOMMatrix([1, 0, 0, 1, ld, ld])); c.fillStyle = light; c.fill(p, 'evenodd'); }
    if (dark) { const p = new Path2D(); p.rect(-5000, -5000, 10000, 10000); p.addPath(path, new DOMMatrix([1, 0, 0, 1, -dd, -dd])); c.fillStyle = dark; c.fill(p, 'evenodd'); }
    if (o.deep) { const p = new Path2D(); p.rect(-5000, -5000, 10000, 10000); p.addPath(path, new DOMMatrix([1, 0, 0, 1, -(o.deepD || 4), -(o.deepD || 4)])); c.fillStyle = o.deep; c.fill(p, 'evenodd'); }
    c.restore();
  }
  // Konoha leaf crest: a drop-shaped ring whose tip points down-left, with a spiral inside.
  function leafCrest(c, x, y, s, col, lw = .17) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const a0 = Math.PI * .76;
    c.beginPath();
    c.moveTo(Math.cos(a0) * 1.42, Math.sin(a0) * 1.42);
    c.arc(0, 0, .84, a0 + .52, a0 - .52 + TAU);
    c.closePath();
    for (let i = 0; i <= 52; i++) {
      const t = i / 52, ang = a0 + .1 + t * TAU * 1.12, r = .84 * (1 - t) * .82 + .06;
      const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
      if (!i) c.moveTo(Math.cos(a0) * 1.0, Math.sin(a0) * 1.0); else c.lineTo(px, py);
    }
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
    c.restore();
  }

  // ------------------------------------------------------------------ vegetation
  function canopy(c, cx, cy, r, R, pal = LEAF, n = 0) {
    const blobs = [[cx, cy, r * .6]];
    const k = n || (6 + Math.floor(R() * 3));
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + R() * .6, d = r * (.4 + R() * .16);
      blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * .82, r * (.36 + R() * .15)]);
    }
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, br] of blobs) fell(c, x, y, br + 2.4, br + 2.4, pal.out);
    for (const [x, y, br] of blobs) {
      fell(c, x, y, br, br, pal.dark);
      fell(c, x - br * .16, y - br * .2, br * .78, br * .75, pal.mid);
      if (y < cy + r * .25 && x < cx + r * .35) fell(c, x - br * .3, y - br * .36, br * .42, br * .34, pal.light);
    }
    const nh = Math.max(2, Math.round(r * .3));
    for (let i = 0; i < nh; i++) {
      const a = R() * TAU, d = R() * r * .7;
      const x = cx + Math.cos(a) * d - r * .15, y = cy + Math.sin(a) * d * .8 - r * .2;
      if (y < cy && x < cx + r * .2) fell(c, x, y, 1.6 + R() * 1.5, 1.1 + R(), pal.hi);
    }
  }
  function sprite(w, h, ax, ay, fn) { const cv = mk(w, h), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; fn(c, ax, ay); return { cv, ax, ay }; }
  function makeTree(r, seed, o = {}) {
    const trunkH = o.trunk ?? Math.round(r * .5 + 6);
    const w = Math.ceil(r * 2.9 + 18), h = Math.ceil(r * 2.05 + trunkH + 20);
    return sprite(w, h, Math.round(w / 2 - r * .12), h - 7, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + r * .4, ay - 1, r * .95, r * .3, 'rgba(24,56,20,.30)');
      fpoly(c, [ax - 5, ay, ax - 3, ay - trunkH - 12, ax + 3, ay - trunkH - 12, ax + 5, ay], '#6a4428');
      fpoly(c, [ax - 4, ay - 1, ax - 2.5, ay - trunkH - 10, ax - .8, ay - trunkH - 10, ax - 1.2, ay - 1], '#93683f');
      poly(c, [ax - 5, ay, ax - 3, ay - trunkH - 6, ax + 3, ay - trunkH - 6, ax + 5, ay]); sk(c, OUT, 1.4);
      canopy(c, ax, ay - trunkH - r * .78, r, R, o.pal || LEAF);
    });
  }
  function makeBush(r, seed, pal = LEAF) {
    const w = Math.ceil(r * 2.8 + 12), h = Math.ceil(r * 2.2 + 12);
    return sprite(w, h, Math.round(w / 2), h - 5, (c, ax, ay) => {
      fell(c, ax + r * .3, ay - 1, r * 1.05, r * .35, 'rgba(24,56,20,.28)');
      canopy(c, ax, ay - r * .8, r, rng(seed), pal, 5);
    });
  }
  function drawPineAt(c, ax, ay, s, seed) {
    const R = rng(seed);
    fell(c, ax + 14 * s, ay, 30 * s, 8 * s, 'rgba(24,56,20,.28)');
    c.beginPath(); c.moveTo(ax - 5 * s, ay); c.quadraticCurveTo(ax - 10 * s, ay - 30 * s, ax + 6 * s, ay - 58 * s);
    c.lineTo(ax + 11 * s, ay - 56 * s); c.quadraticCurveTo(ax - 2 * s, ay - 30 * s, ax + 5 * s, ay); c.closePath();
    c.fillStyle = '#6b4a35'; c.fill(); sk(c, OUT, 1.4);
    line(c, ax - 2 * s, ay - 34 * s, ax - 20 * s, ay - 40 * s, '#6b4a35', 3 * s);
    line(c, ax + 4 * s, ay - 46 * s, ax + 22 * s, ay - 56 * s, '#6b4a35', 3 * s);
    const pads = [[-22, -42, 22, 9], [20, -58, 22, 8], [-4, -70, 19, 8], [4, -86, 13, 6], [24, -38, 14, 6]];
    pads.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, rx, ry] of pads) {
      const x = ax + dx * s, y = ay + dy * s, jx = (R() - .5) * 4 * s;
      fell(c, x + jx, y, (rx + 2) * s, (ry + 2) * s, PINE.out);
      fell(c, x + jx, y, rx * s, ry * s, PINE.dark);
      fell(c, x + jx - 3 * s, y - 2 * s, rx * .8 * s, ry * .7 * s, PINE.mid);
      fell(c, x + jx - 6 * s, y - 3.5 * s, rx * .45 * s, ry * .35 * s, PINE.light);
    }
  }
  function makeForestTile() {
    const S = 360, cv = mk(S, S), c = cv.getContext('2d');
    frect(c, 0, 0, S, S, '#173d22');
    const R = rng(99), crowns = [], n = 6;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) crowns.push({ x: (i + (j % 2) * .5) * S / n + (R() - .5) * 22, y: j * S / n + (R() - .5) * 18, r: 32 + R() * 12, seed: Math.floor(R() * 1e9) });
    const inst = [];
    for (const k of crowns) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const x = k.x + ox, y = k.y + oy, m = k.r * 1.4;
      if (x > -m && x < S + m && y > -m && y < S + m) inst.push({ x, y, r: k.r, seed: k.seed });
    }
    inst.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const k of inst) canopy(c, k.x, k.y, k.r, rng(k.seed), FOREST, 6);
    return cv;
  }
  // Vertical strip of edge trees (period BLOCK). side -1 = west forest (canvas x0 = -140), +1 = east (canvas x0 = WORLD.w - 30)
  function makeEdgeStrip(side) {
    const Wd = 180, H = BLOCK, cv = mk(Wd, H), c = cv.getContext('2d');
    const R = rng(side < 0 ? 501 : 777), trees = [];
    for (let y = 0; y < H; y += 42 + R() * 16) trees.push({ x: side < 0 ? 104 + R() * 22 : 44 + R() * 22, y: y + R() * 8, r: 30 + R() * 10, seed: Math.floor(R() * 1e9) });
    const bushes = [];
    for (let y = 0; y < H; y += 26 + R() * 14) bushes.push({ x: side < 0 ? 132 + R() * 8 : 28 + R() * 8, y: y + R() * 6, r: 11 + R() * 5, seed: Math.floor(R() * 1e9) });
    const inst = [];
    for (const t of trees) for (const oy of [-H, 0, H]) inst.push({ ...t, y: t.y + oy, kind: 't' });
    for (const b of bushes) for (const oy of [-H, 0, H]) inst.push({ ...b, y: b.y + oy, kind: 'b' });
    inst.sort((a, b) => a.y - b.y);
    if (side < 0) { c.fillStyle = 'rgba(40,52,20,.16)'; c.fillRect(140, 0, 16, H); }
    for (const t of inst) {
      if (t.y < -90 || t.y > H + 90) continue;
      if (t.kind === 't') {
        fell(c, t.x + 14, t.y, t.r * .8, t.r * .26, 'rgba(20,40,16,.35)');
        frect(c, t.x - 4, t.y - 22, 8, 22, '#5c3d26'); frect(c, t.x - 3, t.y - 22, 3, 22, '#7d5634');
        canopy(c, t.x, t.y - 22 - t.r * .7, t.r, rng(t.seed), FOREST, 6);
      } else canopy(c, t.x, t.y - t.r * .6, t.r, rng(t.seed), LEAF, 4);
    }
    return cv;
  }

  // ------------------------------------------------------------------ building kit
  function lot(c, col = '#d6be8f') {
    frect(c, 0, 0, FOOT, FOOT, col);
    c.fillStyle = 'rgba(120,95,60,.18)';
    for (let i = 0; i < 40; i++) c.fillRect((i * 67) % 296, (i * 113) % 296, 3 + (i % 3), 2);
  }
  function paving(c, x, y, w, h, col = '#d4c9ad', ln = '#b4a688') {
    frect(c, x, y, w, h, col);
    c.strokeStyle = ln; c.lineWidth = 1; c.beginPath();
    for (let yy = y + 14; yy < y + h; yy += 14) { c.moveTo(x, yy); c.lineTo(x + w, yy); }
    for (let yy = y, r = 0; yy < y + h; yy += 14, r++) for (let xx = x + (r % 2) * 13; xx < x + w; xx += 26) { c.moveTo(xx, yy); c.lineTo(xx, Math.min(y + h, yy + 14)); }
    c.stroke();
  }
  function wall(c, x, y, w, h, W, o = {}) {
    frect(c, x, y, w, h, W.base);
    const bh = o.bandH ?? 11;
    if (o.band) { frect(c, x, y, w, bh, o.band); frect(c, x, y + bh, w, 2, 'rgba(60,30,30,.28)'); }
    const fh = o.found ?? 8;
    if (fh) { frect(c, x, y + h - fh, w, fh, '#968a7a'); frect(c, x, y + h - fh, w, 2, '#c2b8a8'); }
    c.fillStyle = 'rgba(255,255,245,.24)'; c.fillRect(x + 2, y, 4, h - fh);
    c.fillStyle = 'rgba(70,40,60,.13)'; c.fillRect(x + w - 8, y, 8, h - fh);
    if (o.eave !== 0) { c.fillStyle = 'rgba(70,35,40,.26)'; c.fillRect(x, y, w, o.eave ?? 7); }
    srect(c, x + 1, y + 1, w - 2, h - 2, OUT, 2);
  }
  function win(c, x, y, w, h, kind = 'glass') {
    frect(c, x - 2, y - 2, w + 4, h + 4, '#5a3d2b');
    if (kind === 'shoji' || kind === 'lit') {
      frect(c, x, y, w, h, kind === 'lit' ? '#ffe7a8' : '#f5ead0');
      const n = Math.max(1, Math.round(w / 9)), m = Math.max(1, Math.round(h / 10));
      c.strokeStyle = '#8a6a4a'; c.lineWidth = 1; c.beginPath();
      for (let i = 1; i < n; i++) { c.moveTo(x + i * w / n, y); c.lineTo(x + i * w / n, y + h); }
      for (let j = 1; j < m; j++) { c.moveTo(x, y + j * h / m); c.lineTo(x + w, y + j * h / m); }
      c.stroke();
    } else {
      frect(c, x, y, w, h, '#3b4f60');
      fpoly(c, [x + w * .12, y + h, x + w * .5, y, x + w * .72, y, x + w * .34, y + h], 'rgba(170,210,232,.45)');
      frect(c, x, y, w, 3, 'rgba(0,0,0,.28)');
      if (w > 18) frect(c, x + w / 2 - 1, y, 2, h, '#5a3d2b');
    }
    frect(c, x - 3, y + h + 2, w + 6, 3, '#7a5a40');
  }
  function koshiWindow(c, x, y, w, h) {
    frect(c, x - 3, y - 3, w + 6, h + 6, WOOD.dark);
    frect(c, x, y, w, h, '#f3e7c8');
    c.strokeStyle = WOOD.base; c.lineWidth = 2; c.beginPath();
    for (let i = x + 3; i < x + w; i += 5) { c.moveTo(i, y); c.lineTo(i, y + h); }
    c.stroke();
    frect(c, x, y + h * .45, w, 2, WOOD.dark);
    frect(c, x - 4, y + h + 3, w + 8, 3, WOOD.deep);
  }
  function shojiDoor(c, x, y, w, h) {
    frect(c, x - 2, y - 2, w + 4, h + 2, WOOD.dark);
    frect(c, x, y, w, h - 10, '#f5ecd3');
    c.strokeStyle = '#8a6a48'; c.lineWidth = 1.3; c.beginPath();
    for (let i = 1; i < 4; i++) { c.moveTo(x + w * i / 4, y); c.lineTo(x + w * i / 4, y + h - 10); }
    for (let j = 1; j < 4; j++) { c.moveTo(x, y + (h - 10) * j / 4); c.lineTo(x + w, y + (h - 10) * j / 4); }
    c.stroke();
    frect(c, x, y + h - 10, w, 10, WOOD.base);
    line(c, x + w / 2, y, x + w / 2, y + h, WOOD.dark, 2);
  }
  function woodDoor(c, x, y, w, h, col = WOOD.base) {
    frect(c, x - 2, y - 2, w + 4, h + 2, WOOD.deep);
    frect(c, x, y, w, h, col);
    frect(c, x, y, 3, h, 'rgba(255,230,190,.25)');
    c.strokeStyle = 'rgba(40,20,10,.35)'; c.lineWidth = 1; c.beginPath();
    for (let i = x + 6; i < x + w; i += 6) { c.moveTo(i, y + 2); c.lineTo(i, y + h); }
    c.stroke();
    fell(c, x + w - 5, y + h * .55, 1.6, 1.6, '#e6c27a');
  }
  function balcony(c, x, y, w, h = 15) {
    c.fillStyle = 'rgba(60,30,30,.24)'; c.fillRect(x, y + h + 4, w, 6);
    frect(c, x - 2, y + h, w + 4, 5, WOOD.dark);
    c.strokeStyle = WOOD.base; c.lineWidth = 2; c.beginPath();
    for (let bx = x + 3; bx < x + w; bx += 6) { c.moveTo(bx, y + 2); c.lineTo(bx, y + h); }
    c.stroke();
    frect(c, x - 2, y - 1, w + 4, 4, WOOD.light);
    line(c, x - 2, y + 3, x + w + 2, y + 3, WOOD.deep, 1);
  }
  function railing(c, x, y, w, h, col = '#6d4b33') {
    frect(c, x, y, w, 3, col); frect(c, x, y + h - 2, w, 2, col);
    c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath();
    for (let bx = x + 2; bx < x + w; bx += 5) { c.moveTo(bx, y); c.lineTo(bx, y + h); }
    c.stroke();
  }
  function roofHip(c, x, y, w, d, R, o = {}) {
    const rf = o.rf ?? .32, hip = o.hip ?? 0;
    const L = x, Rt = x + w, T = y, B = y + d, ry = y + d * rf;
    if (rf > 0) fpoly(c, [L, T, Rt, T, Rt - hip, ry, L + hip, ry], R.light);
    if (hip > 0) { fpoly(c, [L, T, L + hip, ry, L, B], R.light); fpoly(c, [Rt, T, Rt - hip, ry, Rt, B], R.dark); }
    const front = [L, B, Rt, B, Rt - hip, ry, L + hip, ry];
    fpoly(c, front, R.base);
    c.save(); poly(c, front); c.clip();
    c.strokeStyle = R.dark; c.lineWidth = 2; c.beginPath();
    for (let tx = L + 6; tx < Rt; tx += 9) { c.moveTo(tx, ry); c.lineTo(tx, B); }
    c.stroke();
    c.strokeStyle = 'rgba(255,240,220,.2)'; c.lineWidth = 1.4; c.beginPath();
    for (let ty = ry + 10; ty < B - 4; ty += 11) { c.moveTo(L, ty); c.lineTo(Rt, ty); }
    c.stroke();
    c.fillStyle = 'rgba(40,20,45,.12)'; c.fillRect(Rt - w * .16, ry, w * .16, d);
    c.restore();
    if (rf > 0 && ry - T > 8) {
      c.save(); poly(c, [L, T, Rt, T, Rt - hip, ry, L + hip, ry]); c.clip();
      c.strokeStyle = R.base; c.lineWidth = 1.5; c.beginPath();
      for (let tx = L + 6; tx < Rt; tx += 9) { c.moveTo(tx, T); c.lineTo(tx, ry); }
      c.stroke(); c.restore();
    }
    frect(c, L, B - 5, w, 5, R.deep);
    line(c, L, B - 6, Rt, B - 6, R.light, 1.2);
    if (rf > 0) { line(c, L + hip - 2, ry, Rt - hip + 2, ry, R.deep, 6); line(c, L + hip, ry - 2, Rt - hip, ry - 2, R.hi, 1.5); }
    if (hip > 0) {
      line(c, L + hip, ry, L + 2, B - 3, R.deep, 4); line(c, Rt - hip, ry, Rt - 2, B - 3, R.deep, 4);
      line(c, L + hip, ry, L + 2, T + 2, R.deep, 3); line(c, Rt - hip, ry, Rt - 2, T + 2, R.deep, 3);
      fell(c, L + hip, ry, 4, 4, R.deep); fell(c, Rt - hip, ry, 4, 4, R.deep);
    } else if (rf > 0) { frect(c, L, T, 5, d, R.deep); frect(c, Rt - 5, T, 5, d, R.deep); fell(c, L + 3, ry, 5, 5, R.deep); fell(c, Rt - 3, ry, 5, 5, R.deep); }
    poly(c, [L, T, Rt, T, Rt, B, L, B]); sk(c, OUT, 2);
    if (o.flare) {
      fpoly(c, [L - 8, B - 14, L + 18, B - 6, L + 14, B, L - 3, B - 4], R.deep);
      fpoly(c, [Rt + 8, B - 14, Rt - 18, B - 6, Rt - 14, B, Rt + 3, B - 4], R.deep);
      poly(c, [L - 8, B - 14, L + 18, B - 6, L + 14, B, L - 3, B - 4]); sk(c, OUT, 1.5);
      poly(c, [Rt + 8, B - 14, Rt - 18, B - 6, Rt - 14, B, Rt + 3, B - 4]); sk(c, OUT, 1.5);
    }
  }
  function pentRoof(c, x, y, w, h, R) {
    c.fillStyle = 'rgba(50,25,35,.28)'; c.fillRect(x + 4, y + h, w - 8, 7);
    frect(c, x, y, w, h, R.base);
    c.strokeStyle = R.dark; c.lineWidth = 2; c.beginPath();
    for (let tx = x + 5; tx < x + w; tx += 9) { c.moveTo(tx, y); c.lineTo(tx, y + h); }
    c.stroke();
    frect(c, x, y, w, 3, R.light);
    frect(c, x, y + h - 5, w, 5, R.deep);
    srect(c, x, y, w, h, OUT, 2);
  }
  // Gable roof whose ridge runs north-south: pointed front with a visible gable triangle. Returns wall top y.
  function roofGableFront(c, x, y, w, d, rH, R, Wt, o = {}) {
    const ov = o.ov ?? 7, L = x - ov, Rt = x + w + ov, mx = x + w / 2, gy = y + d + rH;
    const left = [L, y + rH, mx, y, mx, y + d, L, gy], right = [Rt, y + rH, mx, y, mx, y + d, Rt, gy];
    fpoly(c, left, R.light); fpoly(c, right, R.dark);
    c.save(); poly(c, left); c.clip(); c.strokeStyle = R.base; c.lineWidth = 2; c.beginPath();
    for (let yy = y - rH; yy < gy; yy += 8) { c.moveTo(mx, yy); c.lineTo(L, yy + rH); } c.stroke(); c.restore();
    c.save(); poly(c, right); c.clip(); c.strokeStyle = R.deep; c.lineWidth = 2; c.beginPath();
    for (let yy = y - rH; yy < gy; yy += 8) { c.moveTo(mx, yy); c.lineTo(Rt, yy + rH); } c.stroke(); c.restore();
    line(c, mx, y, mx, y + d, R.deep, 6); line(c, mx - 2, y + 2, mx - 2, y + d - 2, R.hi, 1.4);
    fpoly(c, [x, gy, mx, y + d + 3, x + w, gy], Wt.base);
    fpoly(c, [mx, y + d + 3, x + w, gy, mx + 6, gy], 'rgba(70,40,60,.12)');
    if (o.vent !== false) {
      const vy = y + d + rH * .62;
      fell(c, mx, vy, Math.min(10, rH * .26), Math.min(10, rH * .26), '#5a3d2b');
      if (o.crest) leafCrest(c, mx, vy, Math.min(7, rH * .18), '#f3e3bd', .22);
      else { fell(c, mx, vy, Math.min(7, rH * .18), Math.min(7, rH * .18), '#3b4f60'); line(c, mx - 7, vy, mx + 7, vy, '#5a3d2b', 1.5); }
    }
    line(c, x + 4, gy - 4, x + w - 4, gy - 4, WOOD.dark, 3);
    c.beginPath(); c.moveTo(L, gy + 2); c.lineTo(mx, y + d - 1); c.lineTo(Rt, gy + 2); sk(c, R.deep, 7);
    c.beginPath(); c.moveTo(L + 2, gy - 2); c.lineTo(mx, y + d - 5); c.lineTo(Rt - 2, gy - 2); sk(c, R.light, 1.4);
    poly(c, [L, y + rH, mx, y, Rt, y + rH, Rt, gy + 3, mx, y + d, L, gy + 3]); sk(c, OUT, 2);
    return gy;
  }
  function roofFlat(c, x, y, w, d, top, R) {
    frect(c, x, y, w, d, R.light);
    frect(c, x + 5, y + 5, w - 10, d - 10, top);
    c.fillStyle = 'rgba(40,25,30,.17)'; c.fillRect(x + 5, y + 5, w - 10, 6); c.fillRect(x + 5, y + 11, 6, d - 16);
    c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 1; c.beginPath();
    for (let i = x + 30; i < x + w - 10; i += 28) { c.moveTo(i, y + 6); c.lineTo(i, y + d - 6); }
    c.stroke();
    frect(c, x, y + d - 4, w, 4, R.base);
    srect(c, x + 1, y + 1, w - 2, d - 2, OUT, 2);
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
    c.fillStyle = 'rgba(255,250,235,.26)'; c.fillRect(cx - rx, ty - ry, rx * .4, h + ry * 2 + 2);
    c.fillStyle = 'rgba(60,30,60,.16)'; c.fillRect(cx + rx * .34, ty - ry, rx * .7, h + ry * 2 + 2);
    c.fillStyle = 'rgba(60,30,60,.2)'; c.fillRect(cx + rx * .76, ty - ry, rx * .3, h + ry * 2 + 2);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    return g;
  }
  function cylWindows(c, g, yo, n, ww, wh, kind = 'glass', span = 1.15, skip = 0) {
    for (let i = 0; i < n; i++) {
      const th = n === 1 ? 0 : -span + 2 * span * i / (n - 1);
      if (Math.abs(th) < skip) continue;
      const x = g.cx + g.rx * Math.sin(th), w = ww * Math.cos(th), y = g.ty + g.ry * Math.cos(th) + yo;
      win(c, x - w / 2, y, w, wh, kind);
    }
  }
  function capFlat(c, g, R, top) {
    const { cx, ty, rx, ry } = g;
    fell(c, cx, ty, rx, ry, R.light);
    fell(c, cx, ty + 1, rx - 6, ry - 3, mix(top, '#2a1a2a', .25));
    c.save(); c.beginPath(); c.ellipse(cx, ty + 1, rx - 6, ry - 3, 0, 0, TAU); c.clip();
    fell(c, cx + 5, ty + 4, rx - 6, ry - 3, top); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, R.base, 3);
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, TAU); sk(c, OUT, 2);
  }
  function cone(c, cx, ty, rx, ry, h, R, ov = 6) {
    const ay = ty - h, L = cx - rx - ov, Rr = cx + rx + ov, ery = ry + ov * .4;
    const p = new Path2D(); p.moveTo(L, ty); p.lineTo(cx, ay); p.lineTo(Rr, ty); p.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); p.closePath();
    c.save(); c.fillStyle = R.base; c.fill(p); c.clip(p);
    fpoly(c, [L - 2, ty - 2, cx, ay, cx - rx * .22, ty + ery + 2, L - 2, ty + ery + 2], R.light);
    fpoly(c, [cx, ay, Rr + 2, ty - 2, Rr + 2, ty + ery + 2, cx + rx * .42, ty + ery + 2], R.dark);
    c.strokeStyle = 'rgba(40,20,30,.22)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = -7; i <= 7; i++) { const t = i / 7.5 * 1.45; c.moveTo(cx, ay); c.lineTo(cx + (rx + ov) * Math.sin(t), ty + ery * Math.cos(t)); }
    c.stroke(); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); sk(c, R.deep, 4);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    fell(c, cx, ay, 3, 3, R.deep);
  }
  function dome(c, cx, ty, rx, ry, dh, R) {
    const p = new Path2D(); p.moveTo(cx - rx, ty); p.ellipse(cx, ty, rx, dh, 0, Math.PI, TAU); p.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); p.closePath();
    celFill(c, p, R.base, R.light, R.dark, { ld: rx * .22, dd: rx * .32 });
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, R.deep, 3);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    line(c, cx, ty - dh - 8, cx, ty - dh, '#4a3a30', 2); fell(c, cx, ty - dh - 8, 2.5, 2.5, '#e2b54a');
  }
  function waterTank(c, cx, baseY, r, h, col, o = {}) {
    const T = tone(col), ry = r * .42, legH = o.legH ?? 9;
    fell(c, cx + 6, baseY + 1, r * 1.05, ry * .9, 'rgba(40,25,30,.24)');
    c.strokeStyle = '#4a3c33'; c.lineWidth = 3; c.beginPath();
    c.moveTo(cx - r * .7, baseY); c.lineTo(cx - r * .7, baseY - legH - 4);
    c.moveTo(cx + r * .7, baseY); c.lineTo(cx + r * .7, baseY - legH - 4);
    c.moveTo(cx, baseY + 2); c.lineTo(cx, baseY - legH); c.stroke();
    if (legH > 14) { line(c, cx - r * .7, baseY - 2, cx + r * .7, baseY - legH + 2, '#4a3c33', 1.5); line(c, cx + r * .7, baseY - 2, cx - r * .7, baseY - legH + 2, '#4a3c33', 1.5); }
    const ty = baseY - legH - h - ry;
    cylinder(c, cx, ty, r, h, T, {
      band: [[h * .3, 3, T.dark], [h * .68, 3, T.dark]],
      paint: o.crest ? (cc, g) => leafCrest(cc, g.cx - 1, g.ty + g.ry + h * .52, r * .3, 'rgba(255,248,230,.9)', .2) : null
    });
    cone(c, cx, ty, r, ry, r * .55, tone(o.lid || mix(col, '#2a1a2a', .25)), 3);
  }
  function noren(c, x, y, w, h, col, chars, tcol) {
    const n = chars.length || 3, gap = 2, sw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const sx = x + i * (sw + gap);
      frect(c, sx, y + 2, sw, h, col);
      frect(c, sx + sw - 2, y + 2, 2, h, 'rgba(0,0,0,.18)');
      frect(c, sx, y + 2, sw, 3, 'rgba(0,0,0,.2)');
      if (chars[i]) txt(c, chars[i], sx + sw / 2, y + 2 + h * .55, Math.min(sw * .82 / Math.max(1, [...chars[i]].length), h * .64), tcol);
    }
    line(c, x - 4, y + 1, x + w + 4, y + 1, '#5a3d2b', 3);
  }
  function chochin(c, x, y, s = 1, col = '#d8352a', label) {
    line(c, x, y - 13 * s, x, y - 8 * s, '#3a2a20', 1.5);
    frect(c, x - 4 * s, y - 10 * s, 8 * s, 3 * s, '#2d2420');
    fell(c, x, y, 6.5 * s, 8.5 * s, col);
    c.save(); c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); c.clip();
    frect(c, x + 2 * s, y - 9 * s, 5 * s, 18 * s, 'rgba(90,10,20,.32)');
    frect(c, x - 6.5 * s, y - 9 * s, 2.6 * s, 18 * s, 'rgba(255,210,170,.38)');
    c.strokeStyle = 'rgba(80,10,10,.35)'; c.lineWidth = .8; c.beginPath();
    for (let k = -2; k <= 2; k++) { c.moveTo(x - 7 * s, y + k * 3.2 * s); c.lineTo(x + 7 * s, y + k * 3.2 * s); }
    c.stroke();
    if (label) txt(c, label, x, y, 7 * s, '#1d1210', { weight: '800' });
    c.restore();
    frect(c, x - 4 * s, y + 7 * s, 8 * s, 3 * s, '#2d2420');
    c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); sk(c, '#5a1a14', 1.2);
  }
  function signV(c, x, y, w, h, str, bg, fg, frame = '#4a3020') {
    frect(c, x - 2, y - 2, w + 4, h + 4, frame); frect(c, x, y, w, h, bg);
    const n = [...str].length, size = Math.min(w * .78, (h - 4) / n / 1.04);
    txtV(c, str, x + w / 2, y + (h - n * size * 1.02) / 2, size, fg);
  }
  function signH(c, x, y, w, h, str, bg, fg, frame = '#4a3020') {
    frect(c, x - 2, y - 2, w + 4, h + 4, frame); frect(c, x, y, w, h, bg);
    const n = [...str].length;
    txt(c, str, x + w / 2, y + h / 2 + 1, Math.min(h * .78, (w - 6) / n), fg);
  }
  function flowerPots(c, x, y, n, R) {
    const cols = ['#f06292', '#ffd54f', '#ffffff', '#e53935', '#ba68c8', '#ff8a65'];
    for (let i = 0; i < n; i++) {
      const px = x + i * 13 + (R() - .5) * 2;
      fpoly(c, [px - 5, y - 8, px + 5, y - 8, px + 4, y, px - 4, y], '#c0643a');
      frect(c, px - 5, y - 9, 10, 2, '#9a4a28');
      fell(c, px, y - 13, 7, 6, '#2e7a34'); fell(c, px - 1, y - 14, 5, 4, '#48a03c');
      const col = cols[Math.floor(R() * cols.length)];
      for (let k = 0; k < 3; k++) fell(c, px - 4 + k * 4, y - 15 - (k % 2) * 3, 2.2, 2.2, col);
    }
  }
  function compoundWall(c, x, y, w, faceH, R, wallCol = '#f6f0e2') {
    frect(c, x, y, w, 4, R.light); frect(c, x, y + 4, w, 6, R.base); frect(c, x, y + 9, w, 3, R.deep);
    c.strokeStyle = R.dark; c.lineWidth = 1.5; c.beginPath(); for (let i = x + 4; i < x + w; i += 7) { c.moveTo(i, y + 4); c.lineTo(i, y + 9); } c.stroke();
    frect(c, x, y + 12, w, faceH, wallCol);
    c.fillStyle = 'rgba(70,35,40,.22)'; c.fillRect(x, y + 12, w, 4);
    frect(c, x, y + 12 + faceH - 5, w, 5, '#8f8678');
    srect(c, x + 1, y, w - 2, faceH + 12, OUT, 1.6);
  }
  function fenceRow(c, x, y, w, h = 18) {
    c.fillStyle = 'rgba(40,40,20,.2)'; c.fillRect(x + 3, y + h - 1, w, 4);
    frect(c, x, y + 4, w, 3, WOOD.light); frect(c, x, y + h * .6, w, 3, WOOD.base);
    for (let px = x; px <= x + w; px += 24) { frect(c, px - 2, y, 5, h, WOOD.dark); frect(c, px - 2, y, 2, h, WOOD.light); }
  }
  function fenceCol(c, x, y, h) {
    frect(c, x - 1, y, 3, h, WOOD.base);
    for (let py = y; py <= y + h; py += 30) { frect(c, x - 2, py - 12, 5, 14, WOOD.dark); frect(c, x - 2, py - 12, 2, 14, WOOD.light); }
  }

  // ------------------------------------------------------------------ building variants (each draws in a 300x300 footprint)
  const NOREN_TXT = [['茶', '屋'], ['甘', '味', '処'], ['そ', 'ば']];
  const SIGN_TXT = ['お茶', '甘味', '手打'];
  const SHOP_TXT = ['団子', '焼肉', '忍具'];
  const DOJO_TXT = ['道場', '忍具', '武具'];

  function vMachiya(c, P) {
    const { R, W } = P;
    lot(c);
    roofHip(c, 4, 6, 292, 140, R, { rf: .3 });
    wall(c, 12, 140, 276, 156, W);
    for (const px of [12, 82, 152, 222, 282]) frect(c, px, 146, 6, 140, WOOD.dark);
    frect(c, 12, 196, 276, 6, WOOD.dark);
    for (const wx of [28, 98, 168, 238]) koshiWindow(c, wx, 156, 40, 28);
    pentRoof(c, 4, 200, 292, 24, P.R2);
    frect(c, 20, 226, 124, 62, '#3a2a24');
    frect(c, 24, 232, 116, 30, '#4a362c');
    for (let i = 0; i < 6; i++) fell(c, 36 + i * 18, 262, 6, 3, i % 2 ? '#e8d9b8' : '#9a3a2a');
    frect(c, 22, 266, 120, 22, WOOD.base); frect(c, 22, 266, 120, 4, WOOD.light); srect(c, 22, 266, 120, 22, OUT, 1.5);
    noren(c, 24, 226, 116, 26, P.idx === 1 ? '#2f4f8f' : '#3d5a3a', NOREN_TXT[P.idx], '#fff6e2');
    shojiDoor(c, 160, 232, 56, 56); shojiDoor(c, 222, 232, 58, 56);
    chochin(c, 16, 242, 1.15); chochin(c, 150, 242, 1.15);
    P.lamps.push([16, 242], [150, 242]);
    signV(c, 146, 150, 18, 44, SIGN_TXT[P.idx], '#f6ecd4', '#b2302a');
  }
  function vTower(c, P) {
    const { R, W } = P;
    lot(c);
    roofFlat(c, 128, 34, 166, 114, CONCRETE, R);
    waterTank(c, 254, 122, 20, 30, P.tank, { crest: true });
    waterTank(c, 196, 104, 13, 20, '#a8805a');
    wall(c, 130, 148, 162, 148, W, { band: R.base });
    for (const wx of [148, 198, 248]) win(c, wx, 172, 28, 22);
    balcony(c, 140, 204, 146);
    win(c, 148, 240, 28, 22, 'shoji'); win(c, 196, 240, 28, 22);
    woodDoor(c, 248, 246, 30, 44);
    const g = cylinder(c, 84, 62, 74, 205, W, {
      band: [[2, 12, R.base], [92, 5, R.dark], [152, 5, R.dark]],
      paint: (cc, gg) => { cylWindows(cc, gg, 30, 4, 18, 22); cylWindows(cc, gg, 104, 4, 18, 22, 'shoji'); cylWindows(cc, gg, 160, 4, 16, 20, 'glass', 1.15, .3); }
    });
    cone(c, 84, 62, 74, g.ry, 54, P.R2);
    woodDoor(c, 70, g.by + g.ry - 46, 28, 44);
    pentRoof(c, 62, g.by + g.ry - 56, 44, 10, P.R2);
  }
  function vApartment(c, P) {
    const { R, W } = P;
    lot(c);
    roofFlat(c, 8, 8, 284, 104, '#d8c8a4', R);
    roofFlat(c, 212, 18, 54, 30, CONCRETE, tone('#8c7b66'));
    wall(c, 214, 48, 50, 40, W, { found: 0 });
    woodDoor(c, 230, 58, 18, 28);
    waterTank(c, 62, 94, 21, 26, P.tank, { crest: true });
    waterTank(c, 116, 98, 15, 22, '#c08a54');
    line(c, 168, 96, 168, 30, '#4a3c33', 2); line(c, 158, 42, 178, 42, '#4a3c33', 2); line(c, 160, 54, 176, 54, '#4a3c33', 2);
    wall(c, 10, 112, 280, 184, W, { band: R.base, bandH: 10 });
    for (const fy of [172, 234]) { frect(c, 10, fy, 280, 6, W.dark); c.fillStyle = 'rgba(60,30,40,.22)'; c.fillRect(10, fy + 6, 280, 6); }
    const floors = [124, 186, 246];
    floors.forEach((fy, fi) => {
      for (let u = 0; u < 3; u++) {
        const ux = 22 + u * 72;
        woodDoor(c, ux, fy + 4, 20, 40, fi % 2 ? '#7a5236' : '#6d4a5a');
        win(c, ux + 30, fy + 10, 28, 20, u % 2 ? 'shoji' : 'glass');
      }
      if (fi < 2) railing(c, 14, fy + 26, 224, 20);
    });
    // exterior stair
    c.strokeStyle = '#6d4b33'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(288, 292); c.lineTo(244, 238); c.moveTo(244, 232); c.lineTo(288, 178); c.stroke();
    c.strokeStyle = '#a07650'; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i < 9; i++) { const t = i / 8; c.moveTo(286 - t * 42, 290 - t * 52); c.lineTo(274 - t * 42, 290 - t * 52); c.moveTo(246 + t * 42, 230 - t * 52); c.lineTo(258 + t * 42, 230 - t * 52); }
    c.stroke();
    // mail boxes + bike
    for (let i = 0; i < 3; i++) frect(c, 236 + i * 8, 264, 6, 8, '#c84a32');
    P.lamps.push([20, 170]);
  }
  function vCourtyard(c, P) {
    const { R, W } = P;
    frect(c, 0, 0, FOOT, FOOT, '#e4d8bb');
    c.strokeStyle = 'rgba(160,140,105,.28)'; c.lineWidth = 1; c.beginPath();
    for (let y = 214; y < 262; y += 6) { c.moveTo(0, y); c.lineTo(300, y); } c.stroke();
    compoundWall(c, 0, 0, 300, 12, R);
    frect(c, 0, 0, 9, 266, R.dark); frect(c, 291, 0, 9, 266, R.dark); frect(c, 2, 0, 3, 266, R.light); frect(c, 293, 0, 3, 266, R.light);
    roofHip(c, 24, 20, 252, 122, R, { rf: .34, hip: 52 });
    wall(c, 32, 136, 236, 62, W, { found: 0 });
    for (let i = 0; i < 6; i++) shojiDoor(c, 40 + i * 37, 146, 34, 50);
    frect(c, 28, 198, 244, 12, WOOD.light); frect(c, 28, 206, 244, 4, WOOD.dark);
    for (const px of [30, 110, 190, 268]) frect(c, px, 140, 4, 66, WOOD.dark);
    // garden
    fell(c, 96, 240, 50, 17, '#4f7f9a'); fell(c, 96, 239, 46, 14, '#6fb7d4'); fell(c, 88, 236, 30, 7, '#a6dcef');
    fell(c, 84, 242, 4, 2, '#f08a3c'); fell(c, 108, 236, 4, 2, '#ffffff'); fell(c, 112, 237, 2, 1.5, '#f08a3c');
    for (const [sx, sy] of [[160, 220], [176, 232], [166, 246], [182, 258]]) { fell(c, sx, sy, 9, 5, '#9b958a'); fell(c, sx - 1, sy - 1, 7, 3.5, '#c9c3b6'); }
    fell(c, 40, 232, 22, 8, '#5f9a3a'); fell(c, 200, 228, 16, 6, '#5f9a3a');
    drawToroAt(c, 36, 258, .9);
    drawPineAt(c, 236, 262, .95, 7 + P.idx);
    compoundWall(c, 0, 262, 300, 22, R);
    frect(c, 122, 246, 6, 50, WOOD.deep); frect(c, 172, 246, 6, 50, WOOD.deep);
    woodDoor(c, 128, 270, 44, 26, '#5b3a26');
    roofHip(c, 110, 240, 80, 24, R, { rf: .3, hip: 16, flare: true });
    P.lamps.push([36, 246]);
  }
  function vShop(c, P) {
    lot(c);
    const gy = roofGableFront(c, 168, 8, 122, 96, 34, P.R, P.W);
    wall(c, 168, gy, 122, 296 - gy, P.W, { eave: 0 });
    balcony(c, 176, 172, 106);
    win(c, 186, 150, 30, 20, 'shoji'); win(c, 238, 150, 30, 20, 'shoji');
    win(c, 182, 222, 26, 24); woodDoor(c, 236, 236, 32, 54);
    roofHip(c, 6, 60, 162, 100, P.R2, { rf: .3, hip: 34 });
    wall(c, 14, 154, 148, 142, P.W2);
    win(c, 52, 170, 30, 22); win(c, 108, 170, 30, 22);
    // striped awning
    const stripes = 9;
    for (let i = 0; i < stripes; i++) {
      const x0 = 12 + i * 152 / stripes, x1 = 12 + (i + 1) * 152 / stripes;
      fpoly(c, [x0 + 4, 212, x1 + 4, 212, x1, 236, x0, 236], i % 2 ? '#fff6e6' : '#d8352a');
    }
    for (let i = 0; i < stripes; i++) { const x0 = 12 + i * 152 / stripes; c.beginPath(); c.arc(x0 + 152 / stripes / 2, 236, 152 / stripes / 2, 0, Math.PI); c.fillStyle = i % 2 ? '#fff6e6' : '#d8352a'; c.fill(); }
    poly(c, [16, 212, 168, 212, 164, 236, 12, 236]); sk(c, OUT, 1.5);
    frect(c, 18, 246, 140, 44, '#3a2a24');
    frect(c, 16, 270, 144, 18, WOOD.base); frect(c, 16, 270, 144, 4, WOOD.light); srect(c, 16, 270, 144, 18, OUT, 1.5);
    for (let i = 0; i < 6; i++) { const dx = 30 + i * 21; line(c, dx, 268, dx + 4, 252, '#c9a46a', 1.5); fell(c, dx + 1, 265, 3, 3, '#f4a6b8'); fell(c, dx + 2, 260, 3, 3, '#ffffff'); fell(c, dx + 3, 255, 3, 3, '#7ccf6a'); }
    signV(c, 18, 160, 20, 46, SHOP_TXT[P.idx], '#f6ecd4', '#b2302a');
    // nobori banner
    line(c, 150, 296, 150, 196, '#4a3020', 2.5); frect(c, 136, 200, 14, 64, '#d8352a'); frect(c, 136, 200, 14, 4, '#7a1d16');
    txtV(c, SHOP_TXT[P.idx], 143, 208, 10, '#fff6e6');
    chochin(c, 22, 244, 1); P.lamps.push([22, 244]);
  }
  function vTwin(c, P) {
    paving(c, 0, 0, FOOT, FOOT);
    const gA = cylinder(c, 100, 52, 84, 168, P.W, {
      band: [[2, 12, P.R.base], [80, 5, P.R.dark]],
      paint: (cc, g) => { cylWindows(cc, g, 28, 5, 18, 22); cylWindows(cc, g, 98, 5, 18, 24, 'shoji'); }
    });
    capFlat(c, gA, P.R, CONCRETE);
    waterTank(c, 118, 60, 18, 24, P.tank, { crest: true });
    roofFlat(c, 52, 34, 34, 18, CONCRETE, tone('#8c7b66'));
    const gB = cylinder(c, 222, 148, 64, 118, P.W2, {
      band: [[2, 10, P.R2.base]],
      paint: (cc, g) => { cylWindows(cc, g, 24, 4, 16, 20, 'glass'); cylWindows(cc, g, 74, 4, 16, 20, 'glass', 1.15, .3); }
    });
    cone(c, 222, 148, 64, gB.ry, 46, P.R2);
    woodDoor(c, 210, gB.by + gB.ry - 46, 26, 44);
    pentRoof(c, 202, gB.by + gB.ry - 56, 42, 10, P.R2);
    woodDoor(c, 86, gA.by + gA.ry - 44, 28, 42);
    flowerPots(c, 18, 290, 4, rng(5 + P.idx));
    frect(c, 120, 274, 30, 6, WOOD.light); frect(c, 122, 280, 4, 10, WOOD.dark); frect(c, 144, 280, 4, 10, WOOD.dark);
    P.lamps.push([222, gB.by + gB.ry - 60]);
  }
  function vGablePair(c, P) {
    lot(c);
    waterTank(c, 252, 64, 18, 24, P.tank, { legH: 26 });
    line(c, 176, 40, 226, 30, '#5a4a3e', 1.2);
    for (let i = 0; i < 4; i++) frect(c, 182 + i * 11, 36 - i * 2, 8, 12, ['#e8e2d0', '#6aa0d8', '#e57373', '#f3d36b'][i]);
    const gR = roofGableFront(c, 160, 54, 130, 84, 32, P.R2, P.W2);
    wall(c, 160, gR, 130, 296 - gR, P.W2, { eave: 0 });
    win(c, 176, 188, 30, 24, 'shoji'); win(c, 244, 188, 30, 24, 'shoji');
    woodDoor(c, 208, 238, 32, 52);
    noren(c, 204, 236, 40, 18, '#2f4f8f', ['', ''], '#fff');
    const gL = roofGableFront(c, 12, 8, 136, 104, 38, P.R, P.W, { crest: P.idx === 0 });
    wall(c, 12, gL, 136, 296 - gL, P.W, { eave: 0 });
    balcony(c, 22, 184, 116);
    win(c, 36, 166, 30, 20); win(c, 94, 166, 30, 20);
    win(c, 30, 236, 32, 26); woodDoor(c, 92, 238, 34, 52);
    flowerPots(c, 30, 292, 3, rng(9 + P.idx));
    chochin(c, 154, 230, .9); P.lamps.push([154, 230]);
  }
  function vDojo(c, P) {
    const R = P.R, W = WALLS[1];
    lot(c);
    roofHip(c, 2, 6, 296, 168, R, { rf: .36, hip: 64, flare: true });
    fell(c, 150, 6 + 168 * .36, 13, 13, '#f3e3bd');
    c.beginPath(); c.arc(150, 6 + 168 * .36, 13, 0, TAU); sk(c, R.deep, 3);
    leafCrest(c, 150, 6 + 168 * .36, 7.5, '#b3261b', .24);
    wall(c, 14, 166, 272, 130, W);
    frect(c, 14, 240, 272, 48, WOOD.dark);
    c.strokeStyle = WOOD.deep; c.lineWidth = 1.5; c.beginPath(); for (let x = 20; x < 284; x += 10) { c.moveTo(x, 242); c.lineTo(x, 286); } c.stroke();
    for (const px of [14, 68, 122, 172, 226, 280]) frect(c, px, 172, 6, 116, WOOD.deep);
    frect(c, 14, 236, 272, 5, WOOD.deep);
    shojiDoor(c, 110, 214, 40, 76); shojiDoor(c, 150, 214, 40, 76);
    for (const wx of [32, 84, 214, 238]) win(c, wx, 190, 22, 26, 'shoji');
    signH(c, 112, 180, 76, 26, DOJO_TXT[P.idx], '#f3e7cc', '#1d1410', '#3a2414');
    chochin(c, 98, 222, 1.2); chochin(c, 202, 222, 1.2);
    P.lamps.push([98, 222], [202, 222]);
  }
  function vStepped(c, P) {
    lot(c);
    roofFlat(c, 118, 6, 176, 74, CONCRETE, P.R);
    waterTank(c, 262, 66, 17, 24, P.tank, { crest: true });
    line(c, 140, 66, 140, 22, '#4a3c33', 2); line(c, 132, 32, 148, 32, '#4a3c33', 2);
    wall(c, 120, 80, 172, 130, P.W, { band: P.R.base });
    for (const wy of [102, 150]) for (const wx of [136, 184, 232]) win(c, wx, wy, 26, 22, wy > 120 ? 'shoji' : 'glass');
    roofFlat(c, 6, 146, 206, 70, '#c9a678', P.R2);
    c.strokeStyle = 'rgba(90,60,30,.35)'; c.lineWidth = 1; c.beginPath(); for (let x = 14; x < 208; x += 8) { c.moveTo(x, 152); c.lineTo(x, 210); } c.stroke();
    flowerPots(c, 20, 176, 4, rng(3 + P.idx));
    line(c, 90, 160, 190, 158, '#5a4a3e', 1.2);
    for (let i = 0; i < 6; i++) frect(c, 96 + i * 15, 160, 10, 14 + (i % 2) * 4, ['#ffffff', '#e57373', '#6aa0d8', '#f3d36b', '#ffffff', '#81c784'][i]);
    wall(c, 8, 216, 202, 80, P.W2);
    woodDoor(c, 24, 238, 34, 52); win(c, 76, 236, 34, 26); win(c, 128, 236, 34, 26, 'shoji');
    noren(c, 20, 236, 42, 18, '#8a2f2a', ['', ''], '#fff');
    const g = cylinder(c, 250, 176, 42, 96, P.W, {
      band: [[0, 8, P.R2.base]],
      paint: (cc, gg) => { cylWindows(cc, gg, 22, 3, 14, 18); cylWindows(cc, gg, 60, 3, 14, 18, 'shoji'); }
    });
    dome(c, 250, 176, 42, g.ry, 30, P.R2);
    chochin(c, 70, 232, .9); P.lamps.push([70, 232]);
  }
  function vFlower(c, P) {
    lot(c);
    roofHip(c, 4, 8, 292, 128, P.R, { rf: .3, hip: 46 });
    wall(c, 12, 130, 276, 166, P.W);
    const R = rng(21 + P.idx);
    for (const wx of [40, 130, 220]) { win(c, wx, 146, 40, 26, 'shoji'); frect(c, wx - 4, 176, 48, 8, '#9a5a32'); for (let k = 0; k < 7; k++) fell(c, wx + k * 6.5, 175, 3, 3, ['#f06292', '#ffd54f', '#ffffff', '#e53935'][Math.floor(R() * 4)]); }
    signH(c, 96, 188, 108, 20, ['山中花', '花屋', '花'][P.idx], '#fff3e0', '#c2185b', '#5a3d2b');
    pentRoof(c, 4, 210, 292, 20, P.R2);
    frect(c, 18, 232, 186, 58, '#3a2a24');
    for (let tier = 0; tier < 3; tier++) {
      const ty = 252 + tier * 14;
      frect(c, 22, ty, 178, 4, WOOD.light);
      flowerPots(c, 30 + tier * 4, ty, 13 - tier, R);
    }
    flowerPots(c, 26, 296, 14, R);
    win(c, 222, 238, 56, 30); woodDoor(c, 232, 272, 36, 22);
  }
  const VARIANTS = [vMachiya, vTower, vApartment, vCourtyard, vShop, vTwin, vGablePair, vDojo, vStepped, vFlower];
  // [roof idx, wall idx, roof2 idx] per palette option
  const VPAL = [
    [[0, 0, 3], [3, 1, 0], [4, 0, 0]],
    [[1, 0, 0], [2, 1, 1], [0, 2, 3]],
    [[0, 2, 0], [1, 0, 1], [2, 1, 2]],
    [[4, 1, 4], [3, 0, 3], [2, 1, 4]],
    [[2, 0, 0], [0, 1, 3], [5, 0, 1]],
    [[1, 0, 0], [0, 1, 2], [3, 2, 1]],
    [[0, 0, 2], [3, 1, 5], [1, 2, 4]],
    [[4, 1, 4], [4, 0, 3], [3, 1, 4]],
    [[0, 0, 2], [1, 1, 3], [2, 2, 0]],
    [[2, 0, 0], [5, 1, 1], [0, 0, 2]]
  ];
  const ROOFS = ['#dc6538', '#e78b3d', '#3e9d93', '#b5503a', '#59677a', '#4c86bd', '#c9a24a'].map(tone);
  const WALLS = ['#f5e8ca', '#f8f2e4', '#f0d8aa', '#f3dcc4'].map(tone);
  const TANKS = ['#5f8f8a', '#8a9aa6', '#b07a52'];

  // ------------------------------------------------------------------ landmarks
  function lmHokage(c, P) {
    paving(c, 0, 0, FOOT, FOOT, '#ddd2b6', '#c2b495');
    for (const [bx, by] of [[18, 26], [282, 26], [16, 120], [284, 120]]) canopy(c, bx, by, 15, rng(bx + by), LEAF, 5);
    const V = tone('#d9542c');
    const g = cylinder(c, 150, 72, 132, 172, V, {
      band: [[2, 30, '#f1e1bd'], [32, 4, '#8a2d1a'], [102, 5, '#a8402a'], [158, 16, '#9b9083']],
      paint: (cc, gg) => {
        cylWindows(cc, gg, 7, 13, 13, 17, 'glass', 1.38);
        cylWindows(cc, gg, 52, 8, 15, 26, 'glass', 1.3, .42);
        cylWindows(cc, gg, 114, 8, 14, 22, 'shoji', 1.3, .42);
      }
    });
    capFlat(c, g, tone('#b8452a'), '#cbbd9c');
    c.strokeStyle = '#5a2a1a'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i <= 40; i++) { const a = Math.PI * i / 40, x = 150 + Math.cos(a) * 128, y = 72 + Math.sin(a) * 51; c.moveTo(x, y); c.lineTo(x, y - 8); }
    c.stroke();
    c.beginPath(); c.ellipse(150, 64, 128, 51, 0, 0, Math.PI); sk(c, '#5a2a1a', 2);
    // flag poles (flags flutter in drawAmbient)
    line(c, 58, 74, 58, 22, '#4a3020', 2.5); line(c, 242, 74, 242, 22, '#4a3020', 2.5);
    fell(c, 58, 21, 2.5, 2.5, '#e2b54a'); fell(c, 242, 21, 2.5, 2.5, '#e2b54a');
    const hut = cylinder(c, 150, 38, 40, 22, tone('#efe3c4'), { paint: (cc, gg) => cylWindows(cc, gg, 4, 5, 9, 10, 'glass', 1.1) });
    cone(c, 150, 38, 40, hut.ry, 30, tone('#c8462d'));
    // 火 emblem
    const ey = 196;
    fell(c, 150, ey, 31, 31, '#7a2716'); fell(c, 150, ey, 27, 27, '#fbf1dc');
    c.beginPath(); c.arc(150, ey, 22, 0, TAU); sk(c, '#d9542c', 2);
    txt(c, '火', 150, ey + 2, 34, '#b3261b', { weight: '900' });
    // entrance
    pentRoof(c, 114, 236, 72, 12, tone('#8a2d1a'));
    woodDoor(c, 128, 250, 22, 42, '#6b3a22'); woodDoor(c, 150, 250, 22, 42, '#6b3a22');
    frect(c, 120, 292, 60, 4, '#bcae8e'); frect(c, 114, 296, 72, 4, '#a89a7e');
    for (const [bx, t] of [[94, '火影'], [194, '火影']]) { frect(c, bx, 238, 12, 44, '#f6ecd4'); srect(c, bx, 238, 12, 44, '#7a2716', 1.5); txtV(c, t, bx + 6, 244, 10, '#b3261b'); }
    chochin(c, 116, 258, 1.2); chochin(c, 184, 258, 1.2);
    P.lamps.push([116, 258], [184, 258]);
    drawPineAt(c, 22, 298, .8, 3); drawPineAt(c, 280, 298, .8, 4);
    P.flags = [[58, 22], [242, 22]];
  }
  function lmAcademy(c, P) {
    lot(c, '#dcc394');
    c.fillStyle = 'rgba(150,120,80,.18)'; for (let i = 0; i < 30; i++) c.fillRect((i * 53) % 290, 210 + (i * 37) % 80, 6, 2);
    const R = tone('#d9673a'), W = WALLS[0];
    roofHip(c, 4, 6, 292, 104, R, { rf: .32, hip: 40, flare: true });
    wall(c, 12, 104, 276, 96, W, { band: '#c9562f' });
    for (const wx of [26, 64, 102, 182, 220, 258]) { win(c, wx, 122, 22, 22); win(c, wx, 160, 22, 22, 'shoji'); }
    const gy = roofGableFront(c, 120, 112, 60, 22, 26, tone('#c9562f'), W, { crest: true, ov: 6 });
    wall(c, 120, gy, 60, 200 - gy, W, { eave: 0, found: 6 });
    woodDoor(c, 134, 166, 16, 32, '#7a4a2a'); woodDoor(c, 150, 166, 16, 32, '#7a4a2a');
    signV(c, 190, 126, 14, 54, '忍者学校', '#f6ecd4', '#1d1410');
    // yard: kunai targets
    for (const tx of [230, 266]) {
      frect(c, tx - 2, 236, 4, 34, WOOD.dark);
      fell(c, tx + 2, 270, 10, 3, 'rgba(60,40,20,.25)');
      fell(c, tx, 232, 12, 12, '#f2e6c8'); fell(c, tx, 232, 8, 8, '#d8352a'); fell(c, tx, 232, 4, 4, '#f2e6c8'); fell(c, tx, 232, 1.8, 1.8, '#d8352a');
      c.beginPath(); c.arc(tx, 232, 12, 0, TAU); sk(c, OUT, 1.5);
      line(c, tx + 4, 226, tx + 10, 222, '#4a4a55', 2);
    }
    // logs pile
    for (let i = 0; i < 3; i++) { fell(c, 196 + i * 10, 280 - (i % 2) * 5, 6, 6, '#8b5a36'); fell(c, 196 + i * 10, 280 - (i % 2) * 5, 3.5, 3.5, '#d8b07c'); }
    // the tree with the swing
    const tx = 56, tby = 280;
    fell(c, tx + 26, tby, 46, 10, 'rgba(24,56,20,.3)');
    fpoly(c, [tx - 9, tby, tx - 6, tby - 46, tx + 6, tby - 46, tx + 9, tby], '#6a4428');
    fpoly(c, [tx - 7, tby - 1, tx - 5, tby - 44, tx - 1, tby - 44, tx - 2, tby - 1], '#93683f');
    canopy(c, tx, tby - 88, 46, rng(321), LEAF, 8);
    c.beginPath(); c.moveTo(tx + 30, tby - 76); c.quadraticCurveTo(tx + 58, tby - 84, tx + 80, tby - 78); sk(c, '#5a3a22', 6);
    c.beginPath(); c.moveTo(tx + 30, tby - 76); c.quadraticCurveTo(tx + 58, tby - 84, tx + 80, tby - 78); sk(c, '#8a5f3a', 2);
    fell(c, tx + 72, tby - 2, 14, 4, 'rgba(40,30,20,.25)');
    line(c, tx + 64, tby - 80, tx + 64, tby - 22, '#e8dcc0', 1.6); line(c, tx + 80, tby - 78, tx + 80, tby - 22, '#e8dcc0', 1.6);
    frect(c, tx + 60, tby - 24, 24, 5, WOOD.light); srect(c, tx + 60, tby - 24, 24, 5, OUT, 1.2);
    // fence with entrance gap
    fenceRow(c, 2, 280, 116, 16); fenceRow(c, 182, 280, 116, 16);
    fenceCol(c, 3, 206, 74); fenceCol(c, 297, 206, 74);
    P.lamps.push([150, 160]);
  }
  function lmIchiraku(c, P) {
    lot(c);
    const W = WALLS[2];
    roofHip(c, 4, 6, 292, 116, ROOFS[3], { rf: .3 });
    wall(c, 12, 116, 276, 180, W);
    for (const wx of [30, 100, 170, 240]) koshiWindow(c, wx, 132, 36, 26);
    win(c, 18, 214, 12, 20, 'shoji'); win(c, 272, 214, 12, 20, 'shoji');
    // stall
    pentRoof(c, 26, 186, 248, 40, tone('#b8402c'));
    signH(c, 104, 160, 92, 30, '一楽', '#fbf3e1', '#c62828', '#5a2a1a');
    frect(c, 34, 226, 232, 58, '#3a2420');
    fell(c, 90, 250, 16, 6, '#8a8a8a'); fell(c, 90, 248, 13, 4, '#d8c690');
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(86, 242); c.quadraticCurveTo(80, 232, 88, 226); c.moveTo(96, 242); c.quadraticCurveTo(102, 232, 94, 226); c.stroke();
    for (let i = 0; i < 4; i++) { fell(c, 150 + i * 26, 262, 7, 3, '#f6f1e6'); fell(c, 150 + i * 26, 261, 5, 2, '#c97b3a'); }
    noren(c, 36, 226, 228, 28, '#f6f1e6', ['ラ', 'ー', '一楽', 'メ', 'ン'], '#c62828');
    frect(c, 30, 266, 240, 18, WOOD.light); frect(c, 30, 266, 240, 4, '#d8a870'); srect(c, 30, 266, 240, 18, OUT, 1.5);
    for (let i = 0; i < 6; i++) {
      const sx = 52 + i * 39;
      frect(c, sx - 1.5, 288, 3, 8, '#4a3020');
      fell(c, sx, 288, 9, 4, '#5a1a14'); fell(c, sx, 287, 8, 3.2, '#d8352a');
    }
    chochin(c, 26, 236, 1.6, '#d8352a', '一'); chochin(c, 274, 236, 1.6, '#d8352a', '楽');
    P.lamps.push([26, 236], [274, 236]);
  }
  function lmTraining(c, P) {
    frect(c, 0, 0, FOOT, FOOT, '#86bd4a');
    const R = rng(77);
    c.fillStyle = '#74ab3d'; for (let i = 0; i < 80; i++) { const x = R() * 300, y = R() * 300; fpoly(c, [x - 3, y, x - 1, y - 6, x + 1, y, x + 3, y - 5, x + 4, y], '#6aa53a'); }
    fell(c, 150, 196, 104, 36, '#cdb27c'); fell(c, 140, 192, 80, 26, '#d8be8b');
    fenceRow(c, 2, 4, 296, 18);
    for (const [x, y, s] of [[46, 96, 0], [258, 84, 1], [196, 70, 2]]) drawSprite(c, A.trainTrees[s], x, y);
    // memorial stone
    fell(c, 78, 158, 22, 6, 'rgba(30,40,30,.3)');
    const st = pathFrom([[60, 158], [58, 126], [66, 114], [86, 112], [94, 124], [92, 158]]);
    celFill(c, st, '#5d6b78', '#7d8c98', '#47525d', { ld: 3, dd: 5 }); c.strokeStyle = '#2b3138'; c.lineWidth = 1.6; c.stroke(st);
    c.strokeStyle = 'rgba(220,230,240,.55)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(66, 124 + i * 5); c.lineTo(86, 124 + i * 5); } c.stroke();
    // three posts
    for (const [px, h] of [[104, 44], [150, 50], [196, 44]]) {
      fell(c, px + 8, 198, 16, 5, 'rgba(40,30,20,.3)');
      const g = cylinder(c, px, 198 - h - 4, 10, h, tone('#9a6a42'), { band: [[h * .45, 5, '#e8dcc0']] });
      fell(c, px, g.ty, 10, 4, '#d8b07c'); c.beginPath(); c.ellipse(px, g.ty, 6, 2.4, 0, 0, TAU); sk(c, '#8b5a36', 1);
      c.beginPath(); c.ellipse(px, g.ty, 10, 4, 0, 0, TAU); sk(c, OUT, 1.5);
    }
    for (const [sx, sy, r] of [[56, 236, 14], [238, 226, 12], [200, 262, 10], [112, 258, 9]]) {
      fell(c, sx + 6, sy + 4, r + 4, r * .4 + 2, 'rgba(40,30,20,.25)');
      const g = cylinder(c, sx, sy - 8, r, 8, tone('#8b5a36'));
      fell(c, sx, g.ty, r, g.ry, '#d8b07c'); c.beginPath(); c.ellipse(sx, g.ty, r * .55, g.ry * .55, 0, 0, TAU); sk(c, '#a07a4a', 1);
      c.beginPath(); c.ellipse(sx, g.ty, r, g.ry, 0, 0, TAU); sk(c, OUT, 1.4);
    }
    // kunai stuck in a stump and a target board
    line(c, 236, 216, 242, 206, '#4a4a55', 2.4);
    frect(c, 268, 140, 4, 40, WOOD.dark); fell(c, 270, 136, 13, 13, '#f2e6c8'); fell(c, 270, 136, 8, 8, '#d8352a'); fell(c, 270, 136, 3, 3, '#f2e6c8');
    c.beginPath(); c.arc(270, 136, 13, 0, TAU); sk(c, OUT, 1.5);
    fenceCol(c, 4, 22, 262); fenceCol(c, 296, 22, 262);
    fenceRow(c, 2, 278, 296, 18);
    signH(c, 112, 254, 76, 18, '第三演習場', '#f6ecd4', '#1d1410');
  }
  // ------------------------------------------------------------------ the wider village (as in the anime)
  // 14x14 blocks. West: the Forest of Death (Training Ground 44) behind its fence, the exam tower in the
  // middle. The Naka River runs down the col-10 road under red bridges, past the Uchiha district, and
  // spills over the Valley of the End between the Hashirama and Madara statues in the south-east.
  const FOD = { c0: 0, c1: 2, r0: 5, r1: 10 };
  const UCHIHA = { c0: 11, c1: 13, r0: 1, r1: 6 };
  const VOTE = { c0: 10, c1: 13, r0: 10, r1: 13 };
  const RIVER_COL = 10;
  const REG = {
    fod: { x0: FOD.c0 * BLOCK, x1: (FOD.c1 + 1) * BLOCK, y0: FOD.r0 * BLOCK + ROAD, y1: (FOD.r1 + 1) * BLOCK },
    vote: { x0: VOTE.c0 * BLOCK, x1: (VOTE.c1 + 1) * BLOCK, y0: VOTE.r0 * BLOCK + ROAD, y1: (VOTE.r1 + 1) * BLOCK },
    river: { x0: RIVER_COL * BLOCK, x1: RIVER_COL * BLOCK + ROAD }
  };
  // Valley of the End: high ground, the cliff edge, then the lake below the falls.
  REG.vote.cliff = REG.vote.y0 + 560; REG.vote.lake = REG.vote.cliff + 170;
  REG.vote.fallX0 = 6090; REG.vote.fallX1 = 6390;
  // The two statues face each other across the falls (feet on the cliff edge).
  const STATUES = [{ who: 'hashirama', x: 5860, y: REG.vote.cliff - 20 }, { who: 'madara', x: 6620, y: REG.vote.cliff - 20 }];

  function cellZone(cx, cy) {
    if (cx >= FOD.c0 && cx <= FOD.c1 && cy >= FOD.r0 && cy <= FOD.r1) return 'fod';
    if (cx >= VOTE.c0 && cx <= VOTE.c1 && cy >= VOTE.r0 && cy <= VOTE.r1) return 'vote';
    if (cx >= UCHIHA.c0 && cx <= UCHIHA.c1 && cy >= UCHIHA.r0 && cy <= UCHIHA.r1) return 'uchiha';
    return 'village';
  }

  // Collision footprint of a block, or null when it has no building (forest, valley).
  function footprint(cx, cy) {
    const gx = cx * BLOCK, gy = cy * BLOCK, zone = cellZone(cx, cy);
    const std = { x: gx + ROAD + PAD, y: gy + ROAD + PAD, w: FOOT, h: FOOT };
    if (zone === 'fod') return LANDMARKS[cx + ',' + cy] ? std : null;
    if (zone === 'vote') {
      const s = STATUES.find(st => Math.floor(st.x / BLOCK) === cx && Math.floor(st.y / BLOCK) === cy);
      return s ? { x: s.x - 62, y: s.y - 44, w: 124, h: 54, solid: true } : null;
    }
    return std;
  }

  // Uchiha clan crest: a paper fan (uchiwa), red above and white below, on a short handle.
  function uchihaCrest(c, x, y, s) {
    frect(c, x - s * .14, y + s * .74, s * .28, s * .6, '#f4efe6');
    c.strokeStyle = '#1d1416'; c.lineWidth = Math.max(1, s * .08); c.strokeRect(x - s * .14, y + s * .74, s * .28, s * .6);
    c.save();
    c.beginPath(); c.ellipse(x, y, s, s * .94, 0, 0, TAU); c.fillStyle = '#f6f1e8'; c.fill(); c.clip();
    c.beginPath(); c.moveTo(x - s * 1.1, y + s * .02); c.quadraticCurveTo(x, y + s * .5, x + s * 1.1, y + s * .02);
    c.lineTo(x + s * 1.1, y - s * 1.1); c.lineTo(x - s * 1.1, y - s * 1.1); c.closePath();
    c.fillStyle = '#c8102e'; c.fill();
    c.restore();
    c.beginPath(); c.ellipse(x, y, s, s * .94, 0, 0, TAU); sk(c, '#1d1416', Math.max(1.2, s * .1));
  }

  function lmUchiha(c, P, v) {
    lot(c, '#d6c59b');
    const R = tone(v === 1 ? '#414857' : '#30353f'), W = tone('#f4eee2');
    if (v === 0) {
      roofHip(c, 4, 6, 292, 128, R, { rf: .3, hip: 36, flare: true });
      wall(c, 12, 128, 276, 116, W, { band: '#9e2a22', bandH: 6 });
      for (const px of [12, 84, 210, 282]) frect(c, px, 136, 6, 100, WOOD.dark);
      koshiWindow(c, 28, 150, 42, 26); koshiWindow(c, 228, 150, 42, 26);
      uchihaCrest(c, 150, 164, 24);
      shojiDoor(c, 96, 204, 52, 40); shojiDoor(c, 152, 204, 52, 40);
      frect(c, 8, 244, 284, 12, WOOD.light); frect(c, 8, 254, 284, 4, WOOD.deep); srect(c, 8, 244, 284, 14, OUT, 1.4);
      chochin(c, 26, 222, 1.2); chochin(c, 274, 222, 1.2);
      P.lamps.push([26, 222], [274, 222]);
      flowerPots(c, 30, 290, 3, rng(41)); drawPineAt(c, 250, 294, .7, 9);
    } else if (v === 1) {
      roofHip(c, 34, 4, 232, 92, R, { rf: .34, hip: 30 });
      wall(c, 42, 92, 216, 70, W, { band: '#9e2a22', bandH: 5 });
      for (const wx of [56, 98, 178, 220]) win(c, wx, 108, 24, 30, 'shoji');
      uchihaCrest(c, 150, 118, 17);
      balcony(c, 42, 148, 216);
      pentRoof(c, 8, 168, 284, 26, R);
      wall(c, 14, 194, 272, 98, W, { found: 8 });
      shojiDoor(c, 30, 216, 60, 68); woodDoor(c, 126, 222, 48, 62, '#5a3a26'); shojiDoor(c, 210, 216, 60, 68);
      signV(c, 104, 222, 14, 44, 'うちは', '#f6ecd4', '#9e2a22');
      chochin(c, 112, 210, 1.1); chochin(c, 188, 210, 1.1);
      P.lamps.push([112, 210], [188, 210]);
    } else {
      // walled house: a crest on the gate, the roof behind the courtyard wall
      roofHip(c, 20, 6, 260, 110, R, { rf: .32, hip: 34 });
      wall(c, 30, 110, 240, 66, W, { band: '#9e2a22', bandH: 5 });
      for (const wx of [46, 92, 184, 230]) koshiWindow(c, wx, 124, 26, 22);
      fell(c, 150, 214, 62, 22, '#c9b98e');
      for (const [sx, sy] of [[110, 206], [140, 214], [176, 208]]) fell(c, sx, sy, 7, 4, '#a9a497');
      drawPineAt(c, 60, 232, .75, 5); drawPineAt(c, 238, 228, .7, 6);
      compoundWall(c, 0, 248, 112, 34, R); compoundWall(c, 188, 248, 112, 34, R);
      pentRoof(c, 104, 236, 92, 14, R);
      frect(c, 112, 250, 6, 46, WOOD.dark); frect(c, 182, 250, 6, 46, WOOD.dark);
      woodDoor(c, 120, 256, 30, 40, '#5a3a26'); woodDoor(c, 150, 256, 30, 40, '#5a3a26');
      uchihaCrest(c, 56, 268, 11); uchihaCrest(c, 244, 268, 11);
    }
  }

  function torii(c, cx, by, w, h) {
    const red = '#d0402c';
    for (const px of [cx - w * .36, cx + w * .36]) {
      fell(c, px + 8, by, 14, 4, 'rgba(30,20,10,.3)');
      frect(c, px - 6, by - h, 12, h, red); frect(c, px - 6, by - h, 4, h, '#ec7a5c');
      frect(c, px - 8, by - 10, 16, 10, '#2a1a14'); srect(c, px - 6, by - h, 12, h, OUT, 1.4);
    }
    frect(c, cx - w * .46, by - h * .74, w * .92, 9, red); srect(c, cx - w * .46, by - h * .74, w * .92, 9, OUT, 1.4);
    frect(c, cx - w * .48, by - h + 6, w * .96, 9, red); srect(c, cx - w * .48, by - h + 6, w * .96, 9, OUT, 1.4);
    c.beginPath(); c.moveTo(cx - w * .58, by - h - 8); c.quadraticCurveTo(cx, by - h + 6, cx + w * .58, by - h - 8);
    c.lineTo(cx + w * .54, by - h + 4); c.quadraticCurveTo(cx, by - h + 16, cx - w * .54, by - h + 4); c.closePath();
    c.fillStyle = '#2a1a14'; c.fill(); sk(c, OUT, 1.4);
    frect(c, cx - 11, by - h + 14, 22, h * .74 - 22, '#2a1a14');
    txtV(c, '南賀', cx, by - h + 16, 9, '#e8c06a');
  }

  function lmNaka(c, P) {
    paving(c, 0, 0, FOOT, FOOT, '#d8cfb6', '#bdb196');
    for (const [bx, by] of [[22, 40], [278, 40], [20, 150], [280, 150]]) canopy(c, bx, by, 18, rng(bx * 3 + by), PINE, 6);
    const R = tone('#373c47'), W = tone('#efe6d2');
    roofHip(c, 44, 12, 212, 92, R, { rf: .36, hip: 34, flare: true });
    wall(c, 56, 92, 188, 70, W, { band: '#8e2a20', bandH: 6, found: 10 });
    for (const px of [56, 104, 190, 238]) frect(c, px, 100, 6, 52, '#8e2a20');
    shojiDoor(c, 116, 108, 32, 44); shojiDoor(c, 152, 108, 32, 44);
    uchihaCrest(c, 150, 52, 15);
    frect(c, 118, 162, 64, 6, '#b9ad94'); frect(c, 112, 168, 76, 6, '#a89c84');
    frect(c, 130, 174, 40, 126, '#cfc3a6');
    c.strokeStyle = '#ada085'; c.lineWidth = 1; c.beginPath();
    for (let y = 186; y < 300; y += 14) { c.moveTo(130, y); c.lineTo(170, y); } c.stroke();
    drawToroAt(c, 96, 232, 1); drawToroAt(c, 204, 232, 1);
    P.lamps.push([96, 200], [204, 200]);
    signV(c, 254, 168, 16, 70, '南賀ノ神社', '#f6ecd4', '#1d1410');
    torii(c, 150, 298, 150, 112);
  }

  function lmHospital(c, P) {
    paving(c, 0, 0, FOOT, FOOT, '#dcd6c4', '#c2bba6');
    const W = tone('#f3f1ea'), R = tone('#8fa4a8');
    roofFlat(c, 10, 8, 280, 74, '#c6ccc4', R);
    waterTank(c, 64, 64, 15, 16, '#8a9aa6', { crest: true }); waterTank(c, 236, 64, 15, 16, '#8a9aa6');
    wall(c, 10, 82, 280, 194, W, { band: '#4f9474', bandH: 8 });
    leafCrest(c, 150, 86, 4, '#f6f4ee', .26);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 8; i++) {
      if (row === 3 && i >= 3 && i <= 4) continue;
      win(c, 26 + i * 31, 100 + row * 40, 18, 22);
    }
    signH(c, 112, 200, 76, 20, '病院', '#f6f4ee', '#2a6a4a');
    pentRoof(c, 100, 224, 100, 14, tone('#4f9474'));
    frect(c, 112, 238, 76, 34, '#3b4f60');
    for (const gx of [131, 150, 169]) line(c, gx, 238, gx, 272, '#a8c4d4', 1.4);
    signV(c, 270, 100, 16, 76, '木ノ葉病院', '#f6f4ee', '#2a6a4a');
    for (const bx of [28, 62, 238, 272]) canopy(c, bx, 286, 13, rng(bx), LEAF, 5);
    P.lamps.push([150, 246]);
  }

  function lmHyuga(c, P) {
    lot(c, '#d4c49c');
    const R = tone('#3d5a5e'), W = WALLS[1];
    roofHip(c, 20, 6, 260, 118, R, { rf: .34, hip: 42, flare: true });
    wall(c, 30, 118, 240, 76, W, { band: '#6b4a33', bandH: 6 });
    for (const px of [30, 90, 150, 210, 264]) frect(c, px, 126, 6, 60, WOOD.dark);
    for (const dx of [40, 100, 160, 220]) shojiDoor(c, dx, 134, 46, 52);
    frect(c, 24, 194, 252, 10, WOOD.light); frect(c, 24, 202, 252, 3, WOOD.deep); srect(c, 24, 194, 252, 11, OUT, 1.3);
    // garden: koi pond, stepping stones, raked gravel
    fell(c, 82, 232, 46, 18, '#2f6f8a'); fell(c, 78, 229, 38, 13, '#5aa0bf');
    fell(c, 70, 228, 4, 2, '#ff8a3a'); fell(c, 92, 234, 4, 2, '#f4f0e6');
    for (const [sx, sy] of [[134, 226], [150, 236], [168, 228]]) { fell(c, sx, sy, 8, 4, '#8e897f'); fell(c, sx - 1, sy - 1, 6, 3, '#bdb8a6'); }
    c.strokeStyle = 'rgba(150,130,95,.55)'; c.lineWidth = 1; c.beginPath();
    for (let y = 214; y < 250; y += 6) { c.moveTo(190, y); c.lineTo(280, y); } c.stroke();
    drawPineAt(c, 236, 244, .65, 11);
    compoundWall(c, 0, 258, 118, 30, R); compoundWall(c, 182, 258, 118, 30, R);
    pentRoof(c, 110, 246, 80, 12, R);
    frect(c, 116, 258, 6, 40, WOOD.dark); frect(c, 178, 258, 6, 40, WOOD.dark);
    signV(c, 192, 266, 14, 26, '日向', '#f6ecd4', '#1d1410');
    chochin(c, 108, 270, 1.1);
    P.lamps.push([108, 270]);
  }

  // The Chūnin Exam tower in the heart of the Forest of Death.
  function lmTower(c, P) {
    fell(c, 150, 176, 150, 124, '#7f7150'); fell(c, 146, 172, 132, 108, '#93855f');
    const T = tone('#cbc2a8');
    const g = cylinder(c, 150, 74, 94, 184, T, {
      band: [[4, 10, '#7a6a52'], [72, 8, '#7a6a52'], [140, 8, '#7a6a52']],
      paint: (cc, gg) => {
        cylWindows(cc, gg, 22, 9, 10, 18, 'glass', 1.3);
        cylWindows(cc, gg, 88, 9, 10, 18, 'glass', 1.3);
        cylWindows(cc, gg, 154, 5, 12, 20, 'shoji', 1.1, .3);
      }
    });
    cone(c, 150, 74, 94, g.ry, 58, tone('#7a3a2a'));
    woodDoor(c, 136, 226, 28, 40, '#5a3a26');
    signV(c, 72, 120, 16, 44, '天', '#f6ecd4', '#1d1410');
    signV(c, 212, 120, 16, 44, '地', '#f6ecd4', '#1d1410');
    P.lamps.push([150, 230]);
  }

  const LANDMARK_FN = { hokage: lmHokage, academy: lmAcademy, ichiraku: lmIchiraku, training: lmTraining,
    hospital: lmHospital, hyuga: lmHyuga, naka: lmNaka, tower: lmTower,
    uchiha0: (c, P) => lmUchiha(c, P, 0), uchiha1: (c, P) => lmUchiha(c, P, 1), uchiha2: (c, P) => lmUchiha(c, P, 2) };

  // ------------------------------------------------------------------ Forest of Death, river, Valley of the End
  const DEEP = { out: '#0b2111', dark: '#173f20', mid: '#225a2b', light: '#357a36', hi: '#5ea04c' };
  function makeGiantTree(r, seed) {
    const trunkH = 64, w = Math.ceil(r * 2.9 + 70), h = Math.ceil(r * 2.05 + trunkH + 40);
    return sprite(w, h, Math.round(w / 2), h - 14, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + r * .3, ay + 2, r * 1.15, r * .34, 'rgba(6,18,8,.42)');
      for (const [dx, len] of [[-1, 40], [1, 36], [-.35, 24], [.45, 28]]) {
        fpoly(c, [ax + dx * 10, ay - 26, ax + dx * len, ay + 5, ax + dx * (len - 12), ay + 8, ax + dx * 3, ay - 4], '#4e3624');
        line(c, ax + dx * 10, ay - 22, ax + dx * (len - 4), ay + 4, '#6f4f34', 2);
      }
      fpoly(c, [ax - 18, ay, ax - 13, ay - trunkH - 24, ax + 13, ay - trunkH - 24, ax + 18, ay], '#4e3624');
      fpoly(c, [ax - 15, ay - 1, ax - 11, ay - trunkH - 22, ax - 4, ay - trunkH - 22, ax - 6, ay - 1], '#6f4f34');
      c.strokeStyle = 'rgba(30,18,10,.5)'; c.lineWidth = 1.3; c.beginPath();
      for (let i = 0; i < 6; i++) { const bx = ax - 10 + R() * 22, by = ay - 10 - R() * trunkH; c.moveTo(bx, by); c.lineTo(bx + (R() - .5) * 4, by - 14); }
      c.stroke();
      poly(c, [ax - 18, ay, ax - 13, ay - trunkH - 16, ax + 13, ay - trunkH - 16, ax + 18, ay]); sk(c, OUT, 1.6);
      canopy(c, ax, ay - trunkH - r * .72, r, R, DEEP, 9);
    });
  }
  function makeForestFloor() {
    const S = 260, cv = mk(S, S), c = cv.getContext('2d'), R = rng(4444);
    frect(c, 0, 0, S, S, '#3c5629');
    const wrap = (x, y, m, fn) => { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) if (x + ox > -m && x + ox < S + m && y + oy > -m && y + oy < S + m) fn(x + ox, y + oy); };
    for (let i = 0; i < 22; i++) { const x = R() * S, y = R() * S, rx = 18 + R() * 30, ry = 8 + R() * 12, col = R() < .5 ? '#46632f' : '#334b24'; wrap(x, y, rx, (px, py) => fell(c, px, py, rx, ry, col)); }
    for (let i = 0; i < 40; i++) {
      const x = R() * S, y = R() * S, s = .7 + R() * .6;
      wrap(x, y, 12, (px, py) => { for (const a of [-1.1, -.5, 0, .5, 1.1]) line(c, px, py, px + Math.sin(a) * 10 * s, py - Math.cos(a) * 8 * s, '#5b8a3a', 2); });
    }
    for (let i = 0; i < 30; i++) { const x = R() * S, y = R() * S; wrap(x, y, 4, (px, py) => fell(c, px, py, 2.5, 1.6, ['#8a6a3a', '#a07a3a', '#6a4a2a'][i % 3])); }
    return cv;
  }
  function makeRockTile() {
    const S = 260, cv = mk(S, S), c = cv.getContext('2d'), R = rng(5151);
    frect(c, 0, 0, S, S, '#8ea25c');
    const wrap = (x, y, m, fn) => { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) if (x + ox > -m && x + ox < S + m && y + oy > -m && y + oy < S + m) fn(x + ox, y + oy); };
    for (let i = 0; i < 16; i++) { const x = R() * S, y = R() * S, rx = 14 + R() * 26; wrap(x, y, rx, (px, py) => fell(c, px, py, rx, rx * .5, '#7f9450')); }
    for (let i = 0; i < 12; i++) {
      const x = R() * S, y = R() * S, rx = 8 + R() * 16;
      wrap(x, y, rx + 4, (px, py) => { fell(c, px + 2, py + 2, rx, rx * .62, '#6a6656'); fell(c, px, py, rx, rx * .62, '#a8a290'); fell(c, px - rx * .3, py - rx * .2, rx * .5, rx * .3, '#c8c2b0'); });
    }
    return cv;
  }
  function makeWaterTile() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(6262);
    frect(c, 0, 0, S, S, '#3a86aa');
    c.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = R() * S, y = R() * S, w = 14 + R() * 26, col = R() < .6 ? 'rgba(130,200,230,.5)' : 'rgba(40,100,140,.5)';
      for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
        c.beginPath(); c.moveTo(x + ox - w, y + oy); c.quadraticCurveTo(x + ox, y + oy - 4, x + ox + w, y + oy); sk(c, col, 2);
      }
    }
    return cv;
  }

  // Stone figures at the Valley of the End, drawn facing east (Madara's sprite is mirrored).
  function makeStatue(who) {
    const k = 1.36, w = 300, h = 500;
    return sprite(w, h, w / 2, h - 14, (c, ax, ay) => {
      c.translate(ax, ay); if (who === 'madara') c.scale(-1, 1); c.scale(k, k);
      const S = who === 'madara' ? { base: '#9b978c', light: '#c3bfb2', dark: '#716e66', deep: '#55534c' } : { base: '#a29e90', light: '#cac6b6', dark: '#77746a', deep: '#5a5850' };
      const out = '#34332e', moss = 'rgba(96,130,64,.75)';
      const shape = (pts, fill = S.base) => { const p = pathFrom(pts); celFill(c, p, fill, S.light, S.dark, { ld: 3, dd: 4 }); c.strokeStyle = out; c.lineWidth = 1.6; c.stroke(p); return p; };
      // pedestal rock
      shape([[-84, 8], [-90, -18], [-62, -46], [64, -48], [90, -20], [84, 8]], S.dark);
      fell(c, 0, -46, 64, 9, S.base);
      // far arm hanging behind the body
      shape([[-54, -262], [-34, -264], [-38, -168], [-56, -170]]);
      // armoured skirt plates
      const skirt = shape([[-46, -46], [48, -46], [38, -152], [-36, -152]]);
      c.save(); c.clip(skirt); c.strokeStyle = S.deep; c.lineWidth = 1.2; c.beginPath();
      for (let x = -40; x < 46; x += 13) { c.moveTo(x, -152); c.lineTo(x + (x * .12), -46); }
      for (let y = -134; y < -46; y += 18) { c.moveTo(-50, y); c.lineTo(50, y); }
      c.stroke(); c.restore();
      shape([[-34, -46], [-6, -46], [-8, -60], [-30, -60]], S.dark); shape([[6, -46], [52, -46], [46, -60], [8, -60]], S.dark);
      // chest armour
      const torso = shape([[-38, -150], [40, -150], [44, -268], [-40, -272]]);
      c.save(); c.clip(torso); c.strokeStyle = S.deep; c.lineWidth = 1.2; c.beginPath();
      for (let y = -246; y < -150; y += 16) { c.moveTo(-44, y); c.lineTo(46, y + 2); }
      c.stroke(); c.restore();
      // shoulder guards
      shape([[-60, -278], [-24, -280], [-20, -226], [-62, -222]]);
      shape([[22, -282], [62, -276], [64, -224], [26, -228]]);
      c.strokeStyle = S.deep; c.lineWidth = 1; c.beginPath();
      for (const y of [-264, -250, -238]) { c.moveTo(-60, y + 2); c.lineTo(-22, y); c.moveTo(24, y - 2); c.lineTo(63, y + 2); }
      c.stroke();
      // raised arm: two fingers up in the Seal of Confrontation
      shape([[34, -262], [52, -262], [66, -210], [50, -202]]);
      shape([[50, -216], [68, -212], [70, -290], [54, -292]]);
      shape([[50, -306], [70, -306], [72, -288], [52, -286]], S.light);
      shape([[55, -330], [61, -331], [62, -305], [55, -304]], S.light);
      shape([[62, -328], [68, -328], [69, -305], [62, -305]], S.light);
      // neck and head in profile
      shape([[-8, -268], [12, -268], [12, -292], [-8, -292]], S.dark);
      const head = new Path2D(); head.ellipse(2, -316, 22, 26, 0, 0, TAU);
      celFill(c, head, S.base, S.light, S.dark, { ld: 3, dd: 4 }); c.strokeStyle = out; c.lineWidth = 1.6; c.stroke(head);
      shape([[20, -322], [28, -312], [21, -306]], S.base);
      line(c, 10, -320, 18, -320, S.deep, 2); line(c, 8, -328, 20, -330, S.deep, 2.4);
      line(c, 14, -300, 20, -301, S.deep, 1.4);
      // hair: Hashirama's falls straight down his back, Madara's is a wild spiky mane
      const hair = who === 'madara'
        ? [[22, -334], [10, -348], [-6, -350], [-22, -344], [-34, -332], [-44, -334], [-40, -316], [-56, -306], [-46, -294], [-60, -278], [-46, -270], [-58, -248], [-42, -246], [-52, -222], [-34, -232], [-26, -260], [-18, -290], [-10, -312], [6, -330]]
        : [[22, -332], [10, -344], [-6, -346], [-22, -340], [-32, -326], [-36, -300], [-38, -262], [-40, -214], [-30, -212], [-24, -258], [-18, -292], [-10, -318], [6, -332]];
      shape(hair, S.dark);
      c.strokeStyle = S.deep; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < 4; i++) { c.moveTo(-8 - i * 6, -340 + i * 2); c.lineTo(-24 - i * 5, who === 'madara' ? -250 : -230); }
      c.stroke();
      // moss and cracks from centuries of weather
      for (const [mx, my, mr] of [[-60, -30, 18], [52, -36, 14], [-40, -276, 9], [40, -278, 8], [-14, -342, 8], [-30, -120, 6]]) fell(c, mx, my, mr, mr * .5, moss);
      c.strokeStyle = 'rgba(40,38,34,.6)'; c.lineWidth = 1; c.beginPath();
      c.moveTo(-20, -200); c.lineTo(-12, -184); c.lineTo(-16, -168); c.moveTo(24, -120); c.lineTo(30, -102); c.lineTo(26, -84);
      c.stroke();
    });
  }

  function drawFence(ctx, x0, y0, x1, y1, ax, ay, bx, by) {
    // A chain-link fence seen from above: posts every 40px, wires and a mesh band.
    if (Math.max(ax, bx) < x0 - 40 || Math.min(ax, bx) > x1 + 40 || Math.max(ay, by) < y0 - 60 || Math.min(ay, by) > y1 + 40) return;
    const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
    ctx.fillStyle = 'rgba(150,160,150,.22)';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - 34); ctx.lineTo(ax, ay - 34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#59605c'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (const hgt of [0, 17, 34]) { ctx.moveTo(ax, ay - hgt); ctx.lineTo(bx, by - hgt); }
    ctx.stroke();
    ctx.strokeStyle = '#3e4440'; ctx.lineWidth = 1; ctx.beginPath();
    for (let d = 0; d < len; d += 9) { const x = ax + ux * d, y = ay + uy * d; ctx.moveTo(x, y); ctx.lineTo(x + ux * 9, y + uy * 9 - 34); }
    ctx.stroke();
    for (let d = 0; d <= len; d += 40) {
      const x = ax + ux * d, y = ay + uy * d;
      if (x < x0 - 10 || x > x1 + 10 || y < y0 - 10 || y > y1 + 50) continue;
      ctx.fillStyle = '#4a4f4c'; ctx.fillRect(x - 2, y - 40, 4, 40);
      ctx.fillStyle = '#8a918c'; ctx.fillRect(x - 2, y - 40, 1.5, 40);
    }
    // barbed wire on top
    ctx.strokeStyle = '#2e3230'; ctx.lineWidth = 1; ctx.beginPath();
    for (let d = 0; d < len; d += 12) { const x = ax + ux * d, y = ay + uy * d - 40; ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); }
    ctx.moveTo(ax, ay - 40); ctx.lineTo(bx, by - 40); ctx.stroke();
  }

  function drawForestOfDeath(ctx, x0, y0, x1, y1) {
    const F = REG.fod;
    if (x1 < F.x0 - 200 || x0 > F.x1 + 200 || y1 < F.y0 - 80 || y0 > F.y1 + 300) return;
    const ix0 = Math.max(F.x0, x0), iy0 = Math.max(F.y0, y0), ix1 = Math.min(F.x1, x1), iy1 = Math.min(F.y1, y1);
    if (ix1 > ix0 && iy1 > iy0) { ctx.fillStyle = A.floorPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0); }
    // dark canopy shade along the fence line
    ctx.fillStyle = 'rgba(8,20,8,.25)'; ctx.fillRect(F.x1 - 14, Math.max(F.y0, y0), 14, Math.max(0, Math.min(F.y1, y1) - Math.max(F.y0, y0)));
    for (const t of fodTrees) {
      if (t.x < x0 - 170 || t.x > x1 + 170 || t.y < y0 - 20 || t.y > y1 + 300) continue;
      drawSprite(ctx, A.giant[t.k], t.x, t.y);
    }
    const gateY = Math.round((F.y0 + F.y1) / 2);
    drawFence(ctx, x0, y0, x1, y1, F.x0, F.y0, F.x1, F.y0);
    drawFence(ctx, x0, y0, x1, y1, F.x1, F.y0, F.x1, gateY - 70);
    drawFence(ctx, x0, y0, x1, y1, F.x1, gateY + 70, F.x1, F.y1);
    drawFence(ctx, x0, y0, x1, y1, F.x0, F.y1, F.x1, F.y1);
    // gate 44 with its warning signs
    if (x1 > F.x1 - 120 && x0 < F.x1 + 120 && y1 > gateY - 160 && y0 < gateY + 120) {
      for (const gy of [gateY - 70, gateY + 70]) {
        ctx.fillStyle = '#5a5f5c'; ctx.fillRect(F.x1 - 5, gy - 70, 10, 70);
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.strokeRect(F.x1 - 5, gy - 70, 10, 70);
      }
      signV(ctx, F.x1 + 10, gateY - 64, 20, 104, '第四十四演習場', '#f6ecd4', '#1d1410');
      signH(ctx, F.x1 + 36, gateY - 118, 64, 18, '立入禁止', '#f2d24a', '#b3261b', '#3a2a1a');
    }
    for (let sy = F.y0 + 260; sy < F.y1 - 100; sy += 520) {
      if (Math.abs(sy - gateY) < 200 || sy < y0 - 40 || sy > y1 + 40 || x1 < F.x1 - 60 || x0 > F.x1 + 80) continue;
      signH(ctx, F.x1 + 6, sy - 30, 54, 16, '立入禁止', '#f2d24a', '#b3261b', '#3a2a1a');
    }
  }

  // Red bridges carry each cross street over the Naka River.
  function drawBridge(ctx, rx, by) {
    const x = rx - 8, w = ROAD + 16;
    ctx.fillStyle = 'rgba(20,40,60,.35)'; ctx.fillRect(x + 4, by + ROAD - 2, w - 8, 10);
    ctx.fillStyle = '#b48a5a'; ctx.fillRect(x, by + 6, w, ROAD - 12);
    ctx.strokeStyle = '#8a643c'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let px = x + 8; px < x + w; px += 10) { ctx.moveTo(px, by + 6); ctx.lineTo(px, by + ROAD - 6); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,210,.18)'; ctx.fillRect(x, by + 6, w, 18);
    for (const ry of [by + 8, by + ROAD - 6]) {
      ctx.fillStyle = '#c23a2a'; ctx.fillRect(x - 4, ry - 22, w + 8, 6);
      ctx.fillStyle = '#e8604a'; ctx.fillRect(x - 4, ry - 22, w + 8, 2);
      ctx.fillStyle = '#c23a2a';
      for (let px = x; px <= x + w; px += 28) { ctx.fillRect(px - 3, ry - 22, 6, 24); }
      ctx.fillStyle = '#e2b54a'; for (const px of [x - 2, x + w + 2]) { ctx.beginPath(); ctx.arc(px, ry - 26, 4, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.strokeRect(x - 4, ry - 22, w + 8, 6);
    }
  }

  function drawRiver(ctx, x0, y0, x1, y1) {
    const rx = REG.river.x0, end = REG.vote.y0;
    if (x1 < rx - 30 || x0 > rx + ROAD + 30 || y0 > end) return;
    const ya = Math.max(0, y0 - 20), yb = Math.min(end, y1 + 20);
    if (yb <= ya) return;
    ctx.fillStyle = '#8f8a78'; ctx.fillRect(rx, ya, ROAD, yb - ya);
    ctx.fillStyle = A.waterPat; ctx.fillRect(rx + 14, ya, ROAD - 28, yb - ya);
    ctx.fillStyle = 'rgba(20,60,90,.25)'; ctx.fillRect(rx + 14, ya, 10, yb - ya);
    ctx.strokeStyle = '#6c6858'; ctx.lineWidth = 1; ctx.beginPath();
    for (let y = Math.floor(ya / 26) * 26; y < yb; y += 26) for (const bx of [rx, rx + ROAD - 14]) { ctx.moveTo(bx, y); ctx.lineTo(bx + 14, y); }
    ctx.moveTo(rx + 14, ya); ctx.lineTo(rx + 14, yb); ctx.moveTo(rx + ROAD - 14, ya); ctx.lineTo(rx + ROAD - 14, yb);
    ctx.stroke();
    for (let cy = Math.max(0, Math.floor(ya / BLOCK)); cy * BLOCK < yb; cy++) drawBridge(ctx, rx, cy * BLOCK);
  }

  function valleyRiverPath() {
    const V = REG.vote, p = new Path2D();
    p.moveTo(REG.river.x0 + 14, V.y0);
    p.bezierCurveTo(REG.river.x0 + 10, V.y0 + 300, 5760, V.y0 + 250, V.fallX0, V.cliff + 6);
    p.lineTo(V.fallX1, V.cliff + 6);
    p.bezierCurveTo(6020, V.y0 + 200, REG.river.x1 - 10, V.y0 + 260, REG.river.x1 - 14, V.y0);
    p.closePath();
    return p;
  }

  function drawValley(ctx, x0, y0, x1, y1) {
    const V = REG.vote;
    if (x1 < V.x0 || x0 > V.x1 || y1 < V.y0 || y0 > V.y1 + 40) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(V.x0, V.y0, V.x1 - V.x0, V.y1 - V.y0); ctx.clip();
    ctx.fillStyle = A.rockPat; ctx.fillRect(V.x0, V.y0, V.x1 - V.x0, V.cliff - V.y0 + 10);
    ctx.fillStyle = A.waterPat; ctx.fillRect(V.x0, V.lake - 10, V.x1 - V.x0, V.y1 - V.lake + 10);
    ctx.fillStyle = 'rgba(10,40,70,.28)'; ctx.fillRect(V.x0, V.lake - 10, V.x1 - V.x0, 60);
    // cliff face with strata and ledges
    const top = x => V.cliff + 8 * Math.sin(x / 90) + 5 * Math.sin(x / 37);
    const face = new Path2D(); face.moveTo(V.x0, top(V.x0));
    for (let x = V.x0; x <= V.x1; x += 20) face.lineTo(x, top(x));
    face.lineTo(V.x1, V.lake + 8);
    for (let x = V.x1; x >= V.x0; x -= 20) face.lineTo(x, V.lake + 8 + 6 * Math.sin(x / 53));
    face.closePath();
    ctx.fillStyle = '#8c826e'; ctx.fill(face);
    ctx.save(); ctx.clip(face);
    ctx.strokeStyle = 'rgba(60,50,40,.55)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = V.x0 + 10; x < V.x1; x += 34 + (x % 17)) { ctx.moveTo(x, V.cliff); ctx.lineTo(x + 6, V.lake + 10); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,190,170,.35)';
    for (let x = V.x0; x < V.x1; x += 140) ctx.fillRect(x + 20, V.cliff + 60 + (x % 50), 80, 6);
    ctx.restore();
    ctx.strokeStyle = '#4c4436'; ctx.lineWidth = 3; ctx.stroke(face);
    // the river bends to the falls
    const river = valleyRiverPath();
    ctx.fillStyle = A.waterPat; ctx.fill(river);
    ctx.strokeStyle = '#6c6858'; ctx.lineWidth = 6; ctx.stroke(river);
    // waterfall and plunge pool
    const fx0 = V.fallX0, fx1 = V.fallX1;
    const fall = ctx.createLinearGradient(0, V.cliff, 0, V.lake + 20);
    fall.addColorStop(0, '#9fd6ee'); fall.addColorStop(1, '#e8f6fc');
    ctx.fillStyle = fall; ctx.fillRect(fx0, V.cliff, fx1 - fx0, V.lake - V.cliff + 16);
    ctx.strokeStyle = 'rgba(70,140,180,.6)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = fx0 + 8; x < fx1; x += 14) { ctx.moveTo(x, V.cliff + 4); ctx.lineTo(x + 2, V.lake + 10); }
    ctx.stroke();
    for (let i = 0; i < 14; i++) { const fx = fx0 - 30 + i * (fx1 - fx0 + 60) / 13; fell(ctx, fx, V.lake + 22 + (i % 3) * 8, 34, 14, 'rgba(240,250,255,.8)'); }
    // boulders along the shore
    const R = rng(808);
    for (let i = 0; i < 26; i++) {
      const bx = V.x0 + R() * (V.x1 - V.x0), by = V.lake + 60 + R() * (V.y1 - V.lake - 120), br = 12 + R() * 24;
      if (Math.abs(bx - (fx0 + fx1) / 2) < 260 && by < V.lake + 400) continue;
      fell(ctx, bx + 4, by + 5, br, br * .5, 'rgba(10,40,60,.35)');
      fell(ctx, bx, by, br, br * .62, '#7d776a'); fell(ctx, bx - br * .25, by - br * .2, br * .55, br * .32, '#aaa496');
    }
    ctx.restore();
  }

  function drawStatues(ctx, x0, y0, x1, y1) {
    for (const s of STATUES) {
      const sp = A.statues[s.who];
      if (s.x + 160 < x0 || s.x - 160 > x1 || s.y + 20 < y0 || s.y - 500 > y1) continue;
      drawSprite(ctx, sp, s.x, s.y);
    }
  }

  // ------------------------------------------------------------------ props
  function drawToroAt(c, x, y, s) {
    fell(c, x + 6 * s, y, 14 * s, 4 * s, 'rgba(30,40,20,.3)');
    const stone = '#a9a497', dk = '#7e796e', lt = '#cfcabd';
    fpoly(c, [x - 11 * s, y, x + 11 * s, y, x + 9 * s, y - 6 * s, x - 9 * s, y - 6 * s], dk);
    frect(c, x - 4 * s, y - 20 * s, 8 * s, 15 * s, stone); frect(c, x - 4 * s, y - 20 * s, 2.5 * s, 15 * s, lt);
    frect(c, x - 9 * s, y - 25 * s, 18 * s, 5 * s, dk);
    frect(c, x - 7 * s, y - 36 * s, 14 * s, 11 * s, stone);
    frect(c, x - 3.5 * s, y - 33 * s, 7 * s, 6 * s, '#ffd27a');
    fpoly(c, [x - 15 * s, y - 36 * s, x + 15 * s, y - 36 * s, x + 7 * s, y - 44 * s, x - 7 * s, y - 44 * s], stone);
    fpoly(c, [x - 15 * s, y - 36 * s, x - 7 * s, y - 44 * s, x, y - 44 * s, x - 4 * s, y - 36 * s], lt);
    fell(c, x, y - 46 * s, 3 * s, 3 * s, dk);
    c.strokeStyle = '#4e4a42'; c.lineWidth = 1.2;
    poly(c, [x - 15 * s, y - 36 * s, x + 15 * s, y - 36 * s, x + 7 * s, y - 44 * s, x - 7 * s, y - 44 * s]); c.stroke();
    c.strokeRect(x - 7 * s, y - 36 * s, 14 * s, 11 * s); c.strokeRect(x - 4 * s, y - 20 * s, 8 * s, 15 * s);
  }
  function makeProps() {
    const P = {};
    P.pole = sprite(48, 116, 24, 110, (c, ax, ay) => {
      fell(c, ax + 6, ay, 9, 3, 'rgba(30,40,20,.3)');
      frect(c, ax - 3, ay - 100, 6, 100, '#6b4a33'); frect(c, ax - 3, ay - 100, 2, 100, '#8d6745');
      srect(c, ax - 3, ay - 100, 6, 100, OUT, 1.2);
      frect(c, ax - 18, ay - 94, 36, 5, '#5a3d29'); srect(c, ax - 18, ay - 94, 36, 5, OUT, 1);
      for (const dx of [-14, -5, 5, 14]) { fell(c, dx + ax, ay - 96, 2, 2.4, '#f0ece0'); }
      line(c, ax + 3, ay - 66, ax + 12, ay - 68, '#3a2a20', 2);
      fpoly(c, [ax + 6, ay - 66, ax + 18, ay - 66, ax + 15, ay - 72, ax + 9, ay - 72], '#3d4a44');
      fell(c, ax + 12, ay - 64, 3, 2, '#ffe08a');
      frect(c, ax - 9, ay - 82, 6, 12, '#8b97a0'); srect(c, ax - 9, ay - 82, 6, 12, OUT, 1);
    });
    P.toro = sprite(36, 56, 18, 52, (c, ax, ay) => drawToroAt(c, ax, ay, 1));
    P.well = sprite(56, 64, 28, 58, (c, ax, ay) => {
      fell(c, ax + 6, ay, 22, 6, 'rgba(30,40,20,.3)');
      const g = cylinder(c, ax, ay - 20, 17, 12, tone('#a9a497'));
      fell(c, ax, g.ty, 17, g.ry, '#8e897f'); fell(c, ax, g.ty + 1, 12, g.ry - 2.5, '#2a3b48'); fell(c, ax - 3, g.ty, 5, 1.6, '#6c9ab8');
      c.beginPath(); c.ellipse(ax, g.ty, 17, g.ry, 0, 0, TAU); sk(c, OUT, 1.4);
      frect(c, ax - 18, ay - 50, 4, 32, WOOD.dark); frect(c, ax + 14, ay - 50, 4, 32, WOOD.dark);
      fpoly(c, [ax - 24, ay - 48, ax + 24, ay - 48, ax + 16, ay - 58, ax - 16, ay - 58], '#59677a');
      fpoly(c, [ax - 24, ay - 48, ax - 16, ay - 58, ax, ay - 58, ax - 6, ay - 48], '#7a8796');
      poly(c, [ax - 24, ay - 48, ax + 24, ay - 48, ax + 16, ay - 58, ax - 16, ay - 58]); sk(c, OUT, 1.4);
      line(c, ax, ay - 48, ax, ay - 30, '#d8c690', 1); frect(c, ax - 4, ay - 32, 8, 7, WOOD.base);
    });
    P.bench = sprite(50, 26, 25, 22, (c, ax, ay) => {
      fell(c, ax + 4, ay, 22, 4, 'rgba(30,40,20,.28)');
      frect(c, ax - 20, ay - 12, 40, 7, WOOD.light); frect(c, ax - 20, ay - 6, 40, 3, WOOD.dark);
      frect(c, ax - 17, ay - 4, 4, 5, WOOD.deep); frect(c, ax + 13, ay - 4, 4, 5, WOOD.deep);
      srect(c, ax - 20, ay - 12, 40, 9, OUT, 1.2);
    });
    P.barrels = sprite(44, 40, 22, 34, (c, ax, ay) => {
      fell(c, ax + 4, ay, 20, 5, 'rgba(30,40,20,.28)');
      for (const dx of [-9, 9]) {
        const g = cylinder(c, ax + dx, ay - 24 + (dx > 0 ? 2 : 0), 9, 18, tone('#9a6a42'), { band: [[4, 2, '#4a3a30'], [13, 2, '#4a3a30']] });
        fell(c, g.cx, g.ty, 9, g.ry, '#b88a5a'); c.beginPath(); c.ellipse(g.cx, g.ty, 9, g.ry, 0, 0, TAU); sk(c, OUT, 1.2);
      }
    });
    P.planter = sprite(44, 30, 22, 26, (c, ax, ay) => {
      fell(c, ax + 4, ay, 20, 4, 'rgba(30,40,20,.28)');
      frect(c, ax - 18, ay - 10, 36, 10, '#9a5a32'); frect(c, ax - 18, ay - 10, 36, 3, '#c07a48'); srect(c, ax - 18, ay - 10, 36, 10, OUT, 1.2);
      for (let i = 0; i < 5; i++) { fell(c, ax - 14 + i * 7, ay - 14, 6, 5, '#2e7a34'); fell(c, ax - 15 + i * 7, ay - 15, 4, 3, '#48a03c'); }
      for (let i = 0; i < 6; i++) fell(c, ax - 15 + i * 6, ay - 17 - (i % 2) * 2, 2.2, 2.2, ['#f06292', '#ffd54f', '#ffffff'][i % 3]);
    });
    P.sign = sprite(30, 50, 15, 46, (c, ax, ay) => {
      fell(c, ax + 3, ay, 9, 3, 'rgba(30,40,20,.28)');
      frect(c, ax - 2, ay - 18, 4, 18, WOOD.dark);
      frect(c, ax - 10, ay - 44, 20, 28, '#f6ecd4'); srect(c, ax - 10, ay - 44, 20, 28, WOOD.deep, 2);
      leafCrest(c, ax, ay - 30, 6, '#b3261b', .24);
    });
    return P;
  }
  function drawSprite(c, s, x, y) { c.drawImage(s.cv, Math.round(x - s.ax), Math.round(y - s.ay)); }

  // ------------------------------------------------------------------ ground tile (2x2 blocks, seamless)
  function makeGround() {
    const S = BLOCK * 2, cv = mk(S, S), c = cv.getContext('2d');
    frect(c, 0, 0, S, S, ROADC.base);
    const R = rng(4242);
    const roadPt = () => {
      const i = Math.floor(R() * 2), j = Math.floor(R() * 2), vert = R() < .5;
      return vert ? [i * BLOCK + 8 + R() * (ROAD - 16), j * BLOCK + R() * BLOCK] : [i * BLOCK + R() * BLOCK, j * BLOCK + 8 + R() * (ROAD - 16)];
    };
    const items = [];
    for (let i = 0; i < 34; i++) { const [x, y] = roadPt(); items.push(['patch', x, y, 12 + R() * 24, 4 + R() * 6, R() < .5]); }
    for (let i = 0; i < 150; i++) { const [x, y] = roadPt(); items.push(['peb', x, y, 1.5 + R() * 2.6]); }
    const wrapDraw = (x, y, m, fn) => { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { if (x + ox < -m || x + ox > S + m || y + oy < -m || y + oy > S + m) continue; fn(x + ox, y + oy); } };
    for (const it of items) {
      if (it[0] === 'patch') wrapDraw(it[1], it[2], it[3], (x, y) => fell(c, x, y, it[3], it[4], it[5] ? '#e2cb9e' : '#d5bb89'));
      else wrapDraw(it[1], it[2], 6, (x, y) => { fell(c, x + .8, y + .8, it[3], it[3] * .7, '#a88f68'); fell(c, x, y, it[3], it[3] * .7, '#c9b48e'); fell(c, x - it[3] * .3, y - it[3] * .3, it[3] * .45, it[3] * .3, '#efe2c4'); });
    }
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const seed = 900 + i * 31 + j * 57;
      for (const ox of [0, -S]) for (const oy of [0, -S]) drawBlockGround(c, i * BLOCK + ox, j * BLOCK + oy, seed);
    }
    return cv;
  }
  function drawBlockGround(c, gx, gy, seed) {
    const R = rng(seed), x = gx + ROAD, y = gy + ROAD, s = BLOCK - ROAD;
    rrect(c, x - 8, y - 8, s + 16, s + 16, 16); c.fillStyle = ROADC.rim; c.fill();
    rrect(c, x, y, s, s, 10); c.fillStyle = GRASS.base; c.fill();
    // edge tufts poking onto the road
    for (let k = 0; k < 120; k++) {
      const side = k % 4, t = 10 + R() * (s - 20);
      const px = side === 0 ? x + t : side === 1 ? x + s : side === 2 ? x + t : x;
      const py = side === 0 ? y : side === 1 ? y + t : side === 2 ? y + s : y + t;
      const nx = side === 1 ? 1 : side === 3 ? -1 : 0, ny = side === 0 ? -1 : side === 2 ? 1 : 0;
      const l = 3 + R() * 4, w = 2 + R() * 2;
      fpoly(c, [px - ny * w, py - nx * w, px + nx * l + (R() - .5) * 2, py + ny * l + (R() - .5) * 2, px + ny * w, py + nx * w], GRASS.edge);
    }
    rrect(c, x + 1, y + 1, s - 2, s - 2, 10); sk(c, GRASS.edge, 2.5);
    const ringPt = () => {
      const side = Math.floor(R() * 4), t = 6 + R() * (s - 12), d = 4 + R() * 30;
      return side === 0 ? [x + t, y + d] : side === 1 ? [x + s - d, y + t] : side === 2 ? [x + t, y + s - d] : [x + d, y + t];
    };
    for (let k = 0; k < 26; k++) { const [px, py] = ringPt(); fell(c, px, py, 10 + R() * 16, 4 + R() * 5, '#74ad3e'); }
    for (let k = 0; k < 90; k++) {
      const [px, py] = ringPt(), sc = .8 + R() * .6;
      fpoly(c, [px - 4 * sc, py, px - 2 * sc, py - 6 * sc, px - .5 * sc, py, px + 1 * sc, py - 8 * sc, px + 2.5 * sc, py, px + 4 * sc, py - 5 * sc, px + 5 * sc, py], GRASS.tuft);
    }
    c.strokeStyle = GRASS.light; c.lineWidth = 1.4; c.beginPath();
    for (let k = 0; k < 60; k++) { const [px, py] = ringPt(); c.moveTo(px, py); c.lineTo(px + 1.5, py - 4); }
    c.stroke();
    for (let k = 0; k < 16; k++) {
      const [px, py] = ringPt(), col = ['#ffffff', '#ffe066', '#f8a5c2'][k % 3];
      for (let q = 0; q < 3; q++) fell(c, px + (q - 1) * 4, py + (q % 2) * 3, 1.8, 1.8, col);
    }
    for (let k = 0; k < 5; k++) { const [px, py] = ringPt(); fell(c, px + 1, py + 1, 4, 2.6, '#7d7a6a'); fell(c, px, py, 4, 2.6, '#bdb8a6'); fell(c, px - 1, py - 1, 2, 1.2, '#e2ded0'); }
  }

  // ------------------------------------------------------------------ north: cliff tile + Hokage faces
  function makeCliffTile() {
    const S = BLOCK, H = -CLIFF_TOP, cv = mk(S, H), c = cv.getContext('2d');
    const TOP = 110, BOT = 540;
    const topY = x => TOP + 6 * Math.sin(x / S * TAU * 3) + 4 * Math.sin(x / S * TAU * 7 + 1);
    frect(c, 0, 0, S, TOP + 30, '#173d22');
    const R = rng(1717), crowns = [];
    for (let row = 0; row < 3; row++) for (let x = 0; x < S; x += 52) crowns.push({ x: x + (R() - .5) * 24 + row * 18, y: 18 + row * 38 + (R() - .5) * 10, r: 30 + R() * 10, seed: Math.floor(R() * 1e9) });
    const inst = []; for (const k of crowns) for (const ox of [-S, 0, S]) inst.push({ ...k, x: k.x + ox });
    inst.sort((a, b) => a.y - b.y);
    for (const k of inst) if (k.x > -60 && k.x < S + 60) canopy(c, k.x, k.y, k.r, rng(k.seed), FOREST, 6);
    // cliff face
    const face = new Path2D(); face.moveTo(-2, topY(0));
    for (let x = 0; x <= S; x += 8) face.lineTo(x, topY(x));
    face.lineTo(S + 2, BOT + 20); face.lineTo(-2, BOT + 20); face.closePath();
    c.fillStyle = '#8a7453'; c.fill(face);
    c.save(); c.clip(face);
    // irregular vertical rock ridges (seamless: the last boundary is the first one shifted by S)
    const tonesR = ['#ccb68e', '#c4ae86', '#d2bd96', '#bfa881'];
    const xs = []; for (let bx = 0; bx < S - 50;) { xs.push(bx); bx += 52 + R() * 70; }
    const bnd = xs.map(x0 => { const pts = []; for (let y = TOP - 40; y < BOT + 30; y += 30 + R() * 26) pts.push([x0 + (R() - .5) * 22, y]); pts.push([x0 + (R() - .5) * 8, BOT + 40]); return pts; });
    bnd.push(bnd[0].map(([x, y]) => [x + S, y]));
    const ridges = [];
    for (let i = 0; i < xs.length; i++) {
      const pts = bnd[i].concat(bnd[i + 1].slice().reverse());
      const cracks = [];
      const nc = 1 + Math.floor(R() * 2.4);
      for (let k = 0; k < nc; k++) cracks.push([TOP + 40 + R() * (BOT - TOP - 80), (R() - .5) * 18]);
      const streaks = []; for (let k = 0; k < 3; k++) streaks.push([R(), TOP + R() * 200, 30 + R() * 90]);
      ridges.push({ pts, tone: tonesR[Math.floor(R() * 4)], cracks, x0: xs[i], x1: i + 1 < xs.length ? xs[i + 1] : S, streaks });
    }
    for (const ox of [-S, 0, S]) for (const rd of ridges) {
      const p = pathFrom(rd.pts.map(([x, y]) => [x + ox, y]));
      celFill(c, p, rd.tone, '#e3d2ab', '#a08a65', { ld: 7, dd: 12, deep: '#8c7656', deepD: 4 });
      c.save(); c.clip(p);
      for (const [cy, sl] of rd.cracks) {
        line(c, rd.x0 + ox - 10, cy, rd.x1 + ox + 10, cy + sl, '#7a6449', 2.2);
        line(c, rd.x0 + ox - 10, cy + 3, rd.x1 + ox + 10, cy + sl + 3, 'rgba(240,226,190,.7)', 1.6);
      }
      c.strokeStyle = 'rgba(120,96,66,.35)'; c.lineWidth = 1.5; c.beginPath();
      for (const [fx, sy, len] of rd.streaks) { const x = rd.x0 + ox + 10 + fx * Math.max(4, rd.x1 - rd.x0 - 20); c.moveTo(x, sy); c.lineTo(x + 3, sy + len); }
      c.stroke();
      c.restore();
      c.strokeStyle = '#6b5741'; c.lineWidth = 1.6; c.stroke(p);
    }
    c.fillStyle = 'rgba(90,64,40,.10)'; c.fillRect(0, BOT - 70, S, 90);
    c.fillStyle = 'rgba(40,30,20,.22)'; c.fillRect(0, TOP - 10, S, 22);
    c.restore();
    for (let i = 0; i < 16; i++) {
      const vx = R() * S, vl = 20 + R() * 70;
      for (const ox of [-S, 0, S]) {
        const x = vx + ox, y0 = topY(vx) + 6;
        c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + 6, y0 + vl * .5, x - 2, y0 + vl); sk(c, '#2f6b2c', 2);
        for (let k = 8; k < vl; k += 9) fell(c, x + 3 * Math.sin(k), y0 + k, 3, 2, '#4f9a3c');
      }
    }
    // grassy lip on top edge
    c.beginPath(); c.moveTo(-2, topY(0) - 8);
    for (let x = 0; x <= S; x += 8) c.lineTo(x, topY(x) - 8);
    for (let x = S; x >= 0; x -= 6) c.lineTo(x, topY(x) + 6 + ((x / 6) % 2 ? 5 : 0));
    c.closePath(); c.fillStyle = '#5c9e38'; c.fill(); sk(c, '#2c5a22', 2);
    c.beginPath(); for (let x = 0; x <= S; x += 8) c.lineTo(x, topY(x) - 6); sk(c, '#86c45a', 2);
    // talus + grass base
    frect(c, 0, BOT, S, H - BOT, GRASS.base);
    c.fillStyle = 'rgba(40,60,20,.25)'; c.fillRect(0, BOT, S, 6);
    for (let i = 0; i < 26; i++) {
      const bx = R() * S, by = BOT - 2 + R() * 16, r = 6 + R() * 12;
      for (const ox of [-S, 0, S]) {
        const p = new Path2D(); p.ellipse(bx + ox, by, r, r * .7, 0, 0, TAU);
        celFill(c, p, '#b8a27c', '#ddcba4', '#8e7856', { ld: 3, dd: 4 }); c.strokeStyle = '#5c4b38'; c.lineWidth = 1.3; c.stroke(p);
      }
    }
    for (let i = 0; i < 50; i++) { const x = R() * S, y = BOT + 8 + R() * (H - BOT - 10); fpoly(c, [x - 4, y, x - 2, y - 6, x, y, x + 2, y - 7, x + 4, y], GRASS.tuft); }
    return cv;
  }
  function headPath(kind) {
    const k = kind === 'fem' ? .9 : kind === 'wide' ? 1.05 : 1, cy = kind === 'fem' ? 100 : 107;
    const p = new Path2D();
    p.moveTo(-70 * k, -30);
    p.bezierCurveTo(-72 * k, -98, 72 * k, -98, 70 * k, -30);
    p.bezierCurveTo(71 * k, 18, 64 * k, 52, 42 * k, cy - 27);
    p.quadraticCurveTo(20 * k, cy - 3, 0, cy);
    p.quadraticCurveTo(-20 * k, cy - 3, -42 * k, cy - 27);
    p.bezierCurveTo(-64 * k, 52, -71 * k, 18, -70 * k, -30);
    p.closePath(); return p;
  }
  function facePaths(who) {
    const M = left => pathFrom(mirrorPts(left));
    const both = (a) => { const p = new Path2D(); p.addPath(pathFrom(a)); p.addPath(pathFrom(a.map(([x, y]) => [-x, y]))); return p; };
    switch (who) {
      case 'hashirama': return { head: headPath(), kind: 'calm',
        back: both([[-74, -50], [-96, 10], [-102, 80], [-110, 150], [-98, 142], [-92, 168], [-80, 150], [-70, 166], [-60, 140], [-58, 92], [-62, 0]]),
        front: M([[0, -97], [-46, -100], [-80, -70], [-84, -20], [-88, 44], [-76, 66], [-68, 14], [-64, -34], [-42, -64], [-6, -74], [0, -66]]), long: true };
      case 'tobirama': return { head: headPath(), kind: 'stern',
        front: M([[0, -122], [-14, -98], [-30, -124], [-40, -94], [-62, -112], [-60, -82], [-86, -86], [-74, -58], [-92, -44], [-74, -24], [-70, -4], [-62, -40], [-40, -56], [-12, -60], [0, -56]]) };
      case 'hiruzen': return { head: headPath('wide'), kind: 'old',
        front: M([[0, -108], [-20, -94], [-34, -110], [-48, -90], [-68, -94], [-66, -70], [-84, -58], [-74, -22], [-66, -50], [-36, -62], [-10, -62], [0, -50]]),
        extra: pathFrom([[-16, 96], [0, 104], [16, 96], [9, 128], [0, 142], [-9, 128]]) };
      case 'minato': return { head: headPath(), kind: 'calm',
        front: M([[0, -140], [-14, -110], [-40, -132], [-48, -100], [-82, -112], [-74, -82], [-104, -74], [-84, -56], [-96, -30], [-76, -4], [-80, 58], [-66, 70], [-64, 12], [-54, -36], [-34, -48], [-22, -26], [-8, -52], [0, -34]]) };
      case 'tsunade': return { head: headPath('fem'), kind: 'fem',
        back: both([[-66, -60], [-92, 20], [-98, 100], [-104, 170], [-88, 158], [-78, 176], [-64, 156], [-58, 110], [-56, 60]]),
        front: M([[0, -92], [-40, -94], [-68, -70], [-78, -30], [-80, 20], [-74, 74], [-62, 78], [-60, 20], [-56, -22], [-42, -50], [-16, -62], [0, -66]]), long: true };
      case 'kakashi': return { head: headPath(), kind: 'sleepy',
        front: pathFrom([[-72, -6], [-84, -36], [-72, -56], [-88, -78], [-58, -86], [-66, -114], [-32, -100], [-22, -132], [4, -104], [26, -138], [38, -100], [70, -124], [64, -86], [106, -94], [82, -60], [114, -46], [80, -30], [92, -8], [72, -6], [60, -46], [-60, -46]]),
        band: pathFrom([[-82, -66], [82, -46], [82, 16], [-82, -34]]) };
      default: return { head: headPath(), kind: 'big',
        front: M([[0, -142], [-22, -108], [-50, -134], [-54, -100], [-90, -110], [-76, -80], [-108, -72], [-84, -52], [-100, -30], [-74, -16], [-62, -42], [-48, -30], [-36, -56], [-20, -34], [-6, -58], [0, -40]]) };
    }
  }
  function faceEye(c, ex, ey, who) {
    const m = ex < 0 ? 1 : -1; // +x points to the face centre
    c.save(); c.translate(ex, ey); c.scale(m, 1);
    fell(c, 1, -3, 22, 12, 'rgba(150,120,85,.28)');
    const stern = who === 'tobirama', sleepy = who === 'kakashi', old = who === 'hiruzen', fem = who === 'tsunade', big = who === 'naruto';
    const h = stern ? 8 : sleepy ? 7 : (fem || big) ? 12 : 10;
    const p = new Path2D(); p.moveTo(-17, 0); p.quadraticCurveTo(-2, -h - 2, 16, stern ? 3 : -1); p.quadraticCurveTo(0, 8, -17, 0); p.closePath();
    c.fillStyle = '#f1e6c9'; c.fill(p);
    c.save(); c.clip(p);
    fell(c, 2, -2, 6.5, 7, '#a38d6a'); fell(c, 2, -2, 3, 3.4, '#776147'); fell(c, 0, -5, 1.6, 1.6, '#fbf4e2');
    if (sleepy) frect(c, -20, -16, 40, 12, '#d6c39c');
    c.restore();
    c.beginPath(); c.moveTo(-18, 1); c.quadraticCurveTo(-2, -h - 3, 17, stern ? 4 : 0); sk(c, '#5e4b37', 3.4);
    if (sleepy) { c.beginPath(); c.moveTo(-17, -3); c.quadraticCurveTo(0, -6, 16, -3); sk(c, '#5e4b37', 2.6); }
    c.beginPath(); c.moveTo(-12, 4); c.quadraticCurveTo(0, 8, 12, 4); sk(c, '#7d6850', 1.4);
    if (fem) { line(c, -17, 0, -23, -5, '#5e4b37', 2); line(c, -15, -3, -20, -9, '#5e4b37', 2); }
    c.beginPath();
    if (stern) { c.moveTo(-21, -20); c.lineTo(17, -12); }
    else if (old) { c.moveTo(-23, -11); c.quadraticCurveTo(-4, -25, 17, -17); }
    else if (fem) { c.moveTo(-19, -19); c.quadraticCurveTo(-2, -26, 15, -19); }
    else if (big) { c.moveTo(-20, -19); c.quadraticCurveTo(-2, -27, 16, -17); }
    else { c.moveTo(-20, -16); c.quadraticCurveTo(-2, -26, 16, -18); }
    sk(c, '#6a5640', old ? 7 : fem ? 3 : 5);
    if (old) { c.beginPath(); c.moveTo(-14, 10); c.quadraticCurveTo(0, 14, 12, 9); sk(c, '#8a7356', 1.8); line(c, -22, -2, -28, -6, '#8a7356', 1.6); line(c, -22, 3, -28, 3, '#8a7356', 1.6); }
    c.restore();
  }
  function drawFace(c, x, y, s, who) {
    const F = facePaths(who);
    c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    c.save(); c.translate(16, 14); c.fillStyle = 'rgba(64,46,32,.5)';
    if (F.back) c.fill(F.back); c.fill(F.head); c.fill(F.front); if (F.extra) c.fill(F.extra); if (F.band) c.fill(F.band);
    c.restore();
    if (F.back) {
      celFill(c, F.back, HS.base, HS.light, HS.dark, { ld: 5, dd: 10 });
      c.save(); c.clip(F.back); c.strokeStyle = 'rgba(110,90,62,.5)'; c.lineWidth = 2; c.beginPath();
      for (const m of [-1, 1]) for (let k = 0; k < 3; k++) { c.moveTo(m * (70 + k * 10), -40); c.quadraticCurveTo(m * (88 + k * 7), 60, m * (82 + k * 9), 170); }
      c.stroke(); c.restore();
      c.strokeStyle = HS.line; c.lineWidth = 2.6; c.stroke(F.back);
    }
    const ek = who === 'hiruzen' ? 1.05 : who === 'tsunade' ? .9 : 1;
    for (const m of [-1, 1]) { const e = new Path2D(); e.ellipse(m * 71 * ek, 6, 10, 19, 0, 0, TAU); celFill(c, e, FS.base, FS.light, FS.mid, { ld: 3, dd: 5 }); c.strokeStyle = FS.line; c.lineWidth = 2.2; c.stroke(e); }
    celFill(c, F.head, FS.base, FS.light, FS.mid, { ld: 6, dd: 18, deep: FS.dark, deepD: 5 });
    c.strokeStyle = FS.line; c.lineWidth = 2.8; c.stroke(F.head);
    const eyes = who === 'kakashi' ? [-30] : [-30, 30];
    for (const ex of eyes) faceEye(c, ex, -6, who);
    if (who !== 'kakashi') {
      fpoly(c, [5, -2, 14, 26, 4, 30], 'rgba(140,112,80,.42)');
      c.beginPath(); c.moveTo(3, -8); c.quadraticCurveTo(10, 14, 11, 24); c.quadraticCurveTo(5, 31, -5, 28); sk(c, FS.line, 2.6);
      const smile = who === 'naruto' || who === 'hashirama' || who === 'minato';
      c.beginPath(); c.moveTo(-19, 54); c.quadraticCurveTo(0, smile ? 61 : 55, 19, smile ? 52 : 54); sk(c, FS.line, 3);
      c.beginPath(); c.moveTo(-9, 64); c.quadraticCurveTo(0, 66, 9, 64); sk(c, 'rgba(120,95,65,.55)', 2);
      if (who === 'tsunade') { c.beginPath(); c.moveTo(-12, 50); c.quadraticCurveTo(-5, 46, 0, 49); c.quadraticCurveTo(5, 46, 12, 50); sk(c, 'rgba(120,95,65,.6)', 1.6); }
    }
    if (who === 'tobirama') { line(c, -36, 12, -38, 42, '#7a6448', 4); line(c, 36, 12, 38, 42, '#7a6448', 4); line(c, 0, 84, 0, 102, '#7a6448', 4); }
    if (who === 'hiruzen') {
      c.strokeStyle = '#8a7356'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, -44); c.quadraticCurveTo(0, -50, 30, -44); c.moveTo(-24, -36); c.quadraticCurveTo(0, -41, 24, -36); c.stroke();
      c.beginPath(); c.moveTo(-14, 30); c.quadraticCurveTo(-28, 44, -26, 64); c.moveTo(16, 30); c.quadraticCurveTo(30, 44, 28, 64); c.stroke();
      c.beginPath(); c.moveTo(-50, 30); c.quadraticCurveTo(-48, 48, -40, 60); c.moveTo(50, 30); c.quadraticCurveTo(48, 48, 40, 60); c.stroke();
    }
    if (who === 'naruto') for (const m of [-1, 1]) { line(c, m * 36, 20, m * 62, 15, FS.line, 2.8); line(c, m * 37, 30, m * 64, 30, FS.line, 2.8); line(c, m * 36, 40, m * 60, 45, FS.line, 2.8); }
    if (who === 'tsunade') { const d = pathFrom([[0, -60], [7, -49], [0, -38], [-7, -49]]); c.fillStyle = '#8d7656'; c.fill(d); c.strokeStyle = FS.line; c.lineWidth = 1.5; c.stroke(d); }
    if (who === 'kakashi') {
      c.save(); c.clip(F.head);
      const m = pathFrom([[-100, 12], [-24, 10], [2, 0], [26, 10], [100, 12], [100, 200], [-100, 200]]);
      celFill(c, m, '#cbb894', '#dccba7', '#ab9570', { ld: 4, dd: 14 });
      c.restore();
      c.beginPath(); c.moveTo(-70, 12); c.lineTo(-24, 10); c.lineTo(2, 0); c.lineTo(26, 10); c.lineTo(70, 12); sk(c, FS.line, 2.6);
      c.beginPath(); c.moveTo(2, 2); c.quadraticCurveTo(9, 18, 6, 30); sk(c, 'rgba(100,80,55,.55)', 2);
    }
    celFill(c, F.front, HS.base, HS.light, HS.dark, { ld: 5, dd: 9, deep: HS.mid, deepD: 3 });
    // strands
    c.save(); c.clip(F.front); c.strokeStyle = 'rgba(110,90,62,.55)'; c.lineWidth = 2; c.beginPath();
    if (F.long) { for (const m of [-1, 1]) for (let k = 0; k < 4; k++) { c.moveTo(m * (12 + k * 14), -78 + k * 4); c.quadraticCurveTo(m * (40 + k * 12), -60, m * (62 + k * 6), 40 + k * 8); } }
    else { for (let a = -2.6; a <= -.5; a += .3) { c.moveTo(Math.cos(a) * 40, -40 + Math.sin(a) * 40); c.lineTo(Math.cos(a) * 92, -40 + Math.sin(a) * 92); } }
    c.stroke(); c.restore();
    c.strokeStyle = HS.line; c.lineWidth = 2.6; c.stroke(F.front);
    if (F.extra) { celFill(c, F.extra, HS.base, HS.light, HS.dark, { ld: 3, dd: 5 }); c.strokeStyle = HS.line; c.lineWidth = 2.2; c.stroke(F.extra); }
    if (F.band) {
      celFill(c, F.band, '#bfae8e', '#d6c7a8', '#9c8a6c', { ld: 3, dd: 6 }); c.strokeStyle = FS.line; c.lineWidth = 2.4; c.stroke(F.band);
      c.save(); c.translate(2, -32); c.rotate(.17);
      rrect(c, -27, -14, 54, 28, 5); c.fillStyle = '#d9cbac'; c.fill(); sk(c, FS.line, 2.2);
      rrect(c, -24, -11, 48, 22, 4); sk(c, 'rgba(255,248,230,.6)', 1.2);
      leafCrest(c, 0, 0, 8, '#7d6a50', .22);
      c.restore();
    }
    c.restore();
  }
  function makeFaces() {
    const cv = mk(FACES_W, FACES_H), c = cv.getContext('2d');
    const order = ['hashirama', 'tobirama', 'hiruzen', 'minato', 'tsunade', 'kakashi', 'naruto'];
    order.forEach((who, i) => drawFace(c, FACES_W / 2 + (i - 3) * 294, 236, 1.2, who));
    return cv;
  }

  // ------------------------------------------------------------------ south: village wall + A-Un gate
  function makeWallTile() {
    const S = BLOCK, H = WALL_TILE_H, cv = mk(S, H), c = cv.getContext('2d');
    frect(c, 0, 186, S, H - 186, '#173d22');
    const R = rng(2323), crowns = [];
    for (let row = 0; row < 3; row++) for (let x = 0; x < S; x += 50) crowns.push({ x: x + (R() - .5) * 20 + row * 20, y: 252 + row * 34 + (R() - .5) * 8, r: 30 + R() * 10, seed: Math.floor(R() * 1e9) });
    const inst = []; for (const k of crowns) for (const ox of [-S, 0, S]) inst.push({ ...k, x: k.x + ox });
    inst.sort((a, b) => a.y - b.y);
    for (const k of inst) if (k.x > -60 && k.x < S + 60) canopy(c, k.x, k.y, k.r, rng(k.seed), FOREST, 6);
    frect(c, 0, 184, S, 26, '#cfb383');
    for (let i = 0; i < 40; i++) { const x = R() * S, y = 206 + R() * 6; fpoly(c, [x - 4, y, x - 2, y - 6, x, y, x + 2, y - 7, x + 4, y], GRASS.tuft); }
    // cap
    frect(c, 0, 0, S, 9, '#7a8796'); frect(c, 0, 9, S, 17, '#59677a');
    c.strokeStyle = '#3c4651'; c.lineWidth = 2; c.beginPath(); for (let x = 3; x < S; x += 8) { c.moveTo(x, 10); c.lineTo(x, 25); } c.stroke();
    c.strokeStyle = '#94a1af'; c.lineWidth = 1.2; c.beginPath(); for (let x = 3; x < S; x += 8) { c.moveTo(x, 1); c.lineTo(x, 8); } c.stroke();
    line(c, 0, 9, S, 9, '#2b323b', 4); line(c, 0, 7, S, 7, '#aab6c2', 1.2);
    frect(c, 0, 24, S, 5, '#2b323b');
    // face
    frect(c, 0, 29, S, 150, '#f0dfb8');
    c.fillStyle = 'rgba(255,255,245,.2)'; c.fillRect(0, 40, S, 3);
    c.fillStyle = 'rgba(70,40,40,.28)'; c.fillRect(0, 29, S, 10);
    frect(c, 0, 46, S, 8, '#7a4b2c'); frect(c, 0, 46, S, 2, '#a06a42');
    for (let k = 0; k < 5; k++) { const px = k * 104 + 10; frect(c, px, 29, 12, 112, '#7a4b2c'); frect(c, px, 29, 3, 112, '#a06a42'); frect(c, px + 9, 29, 3, 112, '#5a341e'); }
    // stone base
    frect(c, 0, 134, S, 45, '#b9ad96');
    c.strokeStyle = '#7b6f5c'; c.lineWidth = 1.4; c.beginPath();
    for (let r = 0; r < 3; r++) { const y = 134 + r * 15; c.moveTo(0, y); c.lineTo(S, y); for (let x = (r % 2) * 26; x < S; x += 52) { c.moveTo(x, y); c.lineTo(x, y + 15); } }
    c.stroke();
    c.fillStyle = 'rgba(255,250,235,.35)'; for (let r = 0; r < 3; r++) c.fillRect(0, 135 + r * 15, S, 2);
    line(c, 0, 179, S, 179, '#5c5040', 3);
    c.fillStyle = 'rgba(30,30,20,.3)'; c.fillRect(0, 181, S, 6);
    // painted Konoha crest on the wall
    const crx = ((GATE_CX + 260) % S + S) % S;
    fell(c, crx, 92, 26, 26, '#7a2716'); fell(c, crx, 92, 23, 23, '#c8402c');
    leafCrest(c, crx, 92, 13, '#fbf1dc', .22);
    line(c, 0, 1, S, 1, OUT, 2); line(c, 0, 179, S, 179, OUT, 1.5);
    return cv;
  }
  function makeGate() {
    const cv = mk(GATE_W, GATE_H), c = cv.getContext('2d'), cx = GATE_W / 2;
    // road leaving the village
    frect(c, cx - 80, 220, 160, 42, ROADC.base); frect(c, cx - 80, 220, 160, 4, ROADC.rim);
    frect(c, cx - 100, 222, 200, 14, '#a39a88'); frect(c, cx - 100, 222, 200, 3, '#c9c1b0'); srect(c, cx - 100, 222, 200, 14, '#5c5040', 1.4);
    // doors
    const G = { base: '#3c8f5c', light: '#5fb27a', dark: '#2b6b44', deep: '#1e4b30' };
    for (const [dx, ch] of [[-124, '阿'], [0, '吽']]) {
      const x = cx + dx, y = 84, w = 124, h = 140;
      frect(c, x, y, w, h, G.base);
      frect(c, x, y, w, 6, G.light); frect(c, x, y, 5, h, G.light); frect(c, x + w - 6, y, 6, h, G.dark); frect(c, x, y + h - 6, w, 6, G.dark);
      c.strokeStyle = G.dark; c.lineWidth = 1.6; c.beginPath(); for (let px = x + 14; px < x + w - 4; px += 14) { c.moveTo(px, y + 6); c.lineTo(px, y + h - 6); } c.stroke();
      frect(c, x + 4, y + 16, w - 8, 8, G.deep); frect(c, x + 4, y + h - 26, w - 8, 8, G.deep);
      for (let px = x + 12; px < x + w - 6; px += 14) { fell(c, px, y + 20, 2.2, 2.2, '#c9b56a'); fell(c, px, y + h - 22, 2.2, 2.2, '#c9b56a'); }
      txt(c, ch, x + w / 2 + 2, y + h / 2 + 4, 76, 'rgba(20,40,25,.5)', { weight: '900' });
      txt(c, ch, x + w / 2, y + h / 2 + 2, 76, '#d6402b', { weight: '900', stroke: '#6a1a10', sw: 2 });
      srect(c, x, y, w, h, '#14301f', 2);
    }
    line(c, cx, 84, cx, 224, '#14301f', 3);
    // pillars & beams
    for (const px of [cx - 152, cx + 124]) {
      frect(c, px, 46, 28, 180, '#8a3f27'); frect(c, px, 46, 7, 180, '#ad5a3a'); frect(c, px + 20, 46, 8, 180, '#62281a');
      frect(c, px - 4, 214, 36, 12, '#9b9083'); srect(c, px - 4, 214, 36, 12, '#4e463c', 1.4);
      srect(c, px, 46, 28, 168, OUT, 2);
    }
    frect(c, cx - 170, 50, 340, 14, '#8a3f27'); frect(c, cx - 170, 50, 340, 4, '#ad5a3a'); srect(c, cx - 170, 50, 340, 14, OUT, 2);
    frect(c, cx - 160, 72, 320, 10, '#7a3522'); srect(c, cx - 160, 72, 320, 10, OUT, 1.6);
    // roof
    roofHip(c, cx - 182, 6, 364, 48, tone('#4a5868'), { rf: .32, hip: 46, flare: true });
    // roof sign 火
    frect(c, cx - 34, 2, 68, 56, '#3a2414'); frect(c, cx - 29, 7, 58, 46, '#f6ecd4');
    srect(c, cx - 29, 7, 58, 46, '#b8452a', 2);
    txt(c, '火', cx, 31, 40, '#c62828', { weight: '900' });
    srect(c, cx - 34, 2, 68, 56, OUT, 2);
    // guard lanterns on pillars
    chochin(c, cx - 160, 120, 1.3); chochin(c, cx + 160, 120, 1.3);
    return cv;
  }

  // ------------------------------------------------------------------ ambient sprites
  function makeCloudShadow() {
    const cv = mk(640, 380), c = cv.getContext('2d');
    const R = rng(55);
    for (let i = 0; i < 9; i++) {
      const x = 140 + R() * 360, y = 110 + R() * 160, r = 70 + R() * 80;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(18,34,58,1)'); g.addColorStop(.6, 'rgba(18,34,58,.75)'); g.addColorStop(1, 'rgba(18,34,58,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    return cv;
  }

  // ------------------------------------------------------------------ state
  const A = {}; // assets
  let ready = false;
  let cells = [];
  const bcache = new Map();
  let crestDecal = null;
  const flagSpots = [];
  let mini = null, miniKey = '';
  let worldRef = null;
  const fodTrees = [];

  // Giant trees fill the Forest of Death, leaving a clearing round the exam tower.
  function planForest() {
    fodTrees.length = 0;
    const F = REG.fod, R = rng(4404);
    const tower = Object.keys(LANDMARKS).find(k => LANDMARKS[k] === 'tower').split(',').map(Number);
    const tx = tower[0] * BLOCK + ROAD + PAD + FOOT / 2, ty = tower[1] * BLOCK + ROAD + PAD + FOOT / 2;
    for (let y = F.y0 + 70; y < F.y1 + 40; y += 120) {
      for (let x = F.x0 + 40 + ((y / 120) % 2) * 70; x < F.x1 - 30; x += 150) {
        const px = x + (R() - .5) * 70, py = y + (R() - .5) * 50;
        if (R() < .14 || Math.hypot(px - tx, py - ty) < 250) continue;
        fodTrees.push({ x: Math.round(px), y: Math.round(py), k: Math.floor(R() * A.giant.length) });
      }
    }
    fodTrees.sort((a, b) => a.y - b.y);
  }

  function buildAssets() {
    const tmp = mk(4, 4).getContext('2d');
    A.trees = [makeTree(19, 11), makeTree(22, 12), makeTree(24, 13), makeTree(20, 14, { pal: { out: '#1f4423', dark: '#37702e', mid: '#5a9a35', light: '#8cc04a', hi: '#c6e486' } }), makeTree(23, 15, { pal: { out: '#3a2a1a', dark: '#c45a2a', mid: '#e07a36', light: '#f4a24e', hi: '#ffd08a' } })];
    A.trainTrees = [makeTree(30, 21), makeTree(34, 22), makeTree(28, 23)];
    A.bushes = [makeBush(11, 31), makeBush(13, 32), makeBush(10, 33, { out: '#1f4423', dark: '#3a7a30', mid: '#5aa040', light: '#8fd060', hi: '#ffd1e0' })];
    A.props = makeProps();
    A.ground = makeGround();
    A.groundPat = tmp.createPattern(A.ground, 'repeat');
    A.forest = makeForestTile();
    A.forestPat = tmp.createPattern(A.forest, 'repeat');
    A.edgeW = makeEdgeStrip(-1);
    A.edgeE = makeEdgeStrip(1);
    A.cliff = makeCliffTile();
    A.faces = makeFaces();
    A.wall = makeWallTile();
    A.gate = makeGate();
    A.cloud = makeCloudShadow();
    A.giant = [makeGiantTree(62, 71), makeGiantTree(72, 72), makeGiantTree(56, 73)];
    A.floorPat = tmp.createPattern(makeForestFloor(), 'repeat');
    A.rockPat = tmp.createPattern(makeRockTile(), 'repeat');
    A.waterPat = tmp.createPattern(makeWaterTile(), 'repeat');
    A.statues = { hashirama: makeStatue('hashirama'), madara: makeStatue('madara') };
    crestDecal = mk(150, 150);
    const dc = crestDecal.getContext('2d');
    fell(dc, 75, 75, 66, 62, 'rgba(160,120,70,.22)');
    dc.beginPath(); dc.ellipse(75, 75, 64, 60, 0, 0, TAU); sk(dc, 'rgba(150,105,60,.45)', 3);
    leafCrest(dc, 77, 73, 34, 'rgba(150,100,55,.55)', .2);
    leafCrest(dc, 75, 71, 34, 'rgba(255,245,220,.5)', .1);
    ready = true;
  }
  function buildingCanvas(key) {
    if (bcache.has(key)) return bcache.get(key);
    const cv = mk(FOOT, FOOT), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'butt';
    const P = { lamps: [], flags: null };
    if (LANDMARK_FN[key]) { P.idx = 0; LANDMARK_FN[key](c, P); }
    else {
      const [v, p] = key.split(':').map(Number), pal = VPAL[v][p];
      Object.assign(P, { R: ROOFS[pal[0]], W: WALLS[pal[1]], R2: ROOFS[pal[2]], W2: WALLS[(pal[1] + 1) % 4], idx: p, tank: TANKS[(v + p) % 3] });
      VARIANTS[v](c, P);
    }
    const entry = { cv, lamps: P.lamps, flags: P.flags };
    bcache.set(key, entry);
    return entry;
  }

  function planCells(world) {
    cells = [];
    flagSpots.length = 0;
    const chosen = [];
    const lanterns = world.lanterns;
    if (lanterns) lanterns.length = 0;
    const pushLamp = (x, y) => { if (lanterns) lanterns.push({ x, y: y + 5 }); };
    for (let cx = 0; cx < CELLS; cx++) {
      cells[cx] = []; chosen[cx] = [];
      for (let cy = 0; cy < CELLS; cy++) {
        const b = world.buildingGrid && world.buildingGrid[cx] ? world.buildingGrid[cx][cy] : null;
        const gx = cx * BLOCK, gy = cy * BLOCK, fx = gx + ROAD + PAD, fy = gy + ROAD + PAD;
        const R = rng(cx * 7919 + cy * 104729 + 17);
        const lm = LANDMARKS[cx + ',' + cy];
        const cell = { cx, cy, gx, gy, fx, fy, b, img: null, back: [], front: [], poles: false, decals: [] };
        const zone = cellZone(cx, cy);
        if (zone === 'fod' || zone === 'vote') {
          // Forest and valley blocks are painted as regions; only the exam tower is a building.
          chosen[cx][cy] = -2;
          if (lm && b) { const e = buildingCanvas(lm); cell.key = lm; cell.img = e.cv; for (const [lx, ly] of e.lamps) pushLamp(fx + lx, fy + ly); }
          cells[cx][cy] = cell;
          continue;
        }
        let key = null;
        if (lm) key = lm;
        else if (zone === 'uchiha') key = 'uchiha' + Math.floor(hash2(cx, cy, 29) * 3);
        else {
          let v = Math.floor(hash2(cx, cy, 11) * VARIANTS.length);
          const left = cx > 0 ? chosen[cx - 1][cy] : -1, up = cy > 0 ? chosen[cx][cy - 1] : -1;
          let guard = 0; while ((v === left || v === up) && guard++ < 10) v = (v + 1) % VARIANTS.length;
          chosen[cx][cy] = v;
          key = v + ':' + Math.floor(hash2(cx, cy, 23) * 3);
        }
        if (lm || zone === 'uchiha') chosen[cx][cy] = -2;
        cell.key = key;
        if (b) {
          const e = buildingCanvas(key);
          cell.img = e.cv;
          for (const [lx, ly] of e.lamps) pushLamp(fx + lx, fy + ly);
          if (e.flags) for (const [px, py] of e.flags) flagSpots.push({ x: fx + px, y: fy + py, b });
        }
        // margin trees (west / east of the footprint)
        const WX = gx + ROAD + 17, EX = gx + BLOCK - 18;
        const add = (list, s, x, y) => list.push({ s, x: Math.round(x), y: Math.round(y) });
        for (const [mx, n] of [[WX, lm === 'hokage' ? 2 : Math.floor(R() * 3)], [EX, lm === 'hokage' ? 2 : Math.floor(R() * 3)]]) {
          for (let k = 0; k < n; k++) {
            const y = fy + 60 + k * 130 + R() * 60;
            const sp = R() < .2 ? A.bushes[Math.floor(R() * A.bushes.length)] : A.trees[Math.floor(R() * (R() < .12 ? 5 : 4))];
            add(cell.front, sp, mx + (R() - .5) * 6, y);
          }
        }
        // north margin: bushes / planters
        const nN = Math.floor(R() * 3);
        for (let k = 0; k < nN; k++) add(cell.back, R() < .7 ? A.bushes[Math.floor(R() * 3)] : A.props.planter, fx + 30 + R() * 240, fy - 10);
        // NW corner: stone lantern / well / signboard
        const corner = R();
        if (corner < .3) { add(cell.back, A.props.toro, gx + ROAD + 16, gy + ROAD + 26); pushLamp(gx + ROAD + 16, gy + ROAD - 5); }
        else if (corner < .42) add(cell.back, A.props.well, gx + ROAD + 18, gy + ROAD + 30);
        else if (corner < .5) add(cell.back, A.props.sign, gx + ROAD + 16, gy + ROAD + 28);
        // south margin: utility poles + street furniture
        if (cy < CELLS - 1 && !lm) {
          cell.poles = true;
          add(cell.front, A.props.pole, gx + ROAD + 18, gy + BLOCK - 10);
          add(cell.front, A.props.pole, gx + BLOCK - 18, gy + BLOCK - 10);
          if ((cx + cy) % 2 === 0) pushLamp(gx + ROAD + 18 + 12, gy + BLOCK - 10 - 64);
        }
        const sR = R();
        if (sR < .55) {
          const sp = sR < .2 ? A.props.bench : sR < .35 ? A.props.barrels : sR < .45 ? A.props.planter : A.bushes[Math.floor(R() * 3)];
          add(cell.front, sp, fx + 50 + R() * 200, gy + BLOCK - 12);
        }
        if (lm === 'hokage') { cell.decals.push({ img: crestDecal, x: gx + ROAD / 2 - 75, y: gy + ROAD / 2 - 75 }); add(cell.front, A.props.toro, fx - 18, fy + 300); add(cell.front, A.props.toro, fx + 318, fy + 300); }
        cell.back.sort((a, b) => a.y - b.y); cell.front.sort((a, b) => a.y - b.y);
        cells[cx][cy] = cell;
      }
    }
  }

  // ------------------------------------------------------------------ API
  function init(world) {
    worldRef = world;
    CELLS = Math.round(world.WORLD.w / BLOCK);
    FACES_CX = world.WORLD.w / 2;
    GATE_CX = world.WORLD.w / 2 + ROAD / 2;
    if (!ready) buildAssets();
    planCells(world);
    planForest();
    mini = null; miniKey = '';
  }

  function drawCells(ctx, x0, y0, x1, y1) {
    const cx0 = Math.max(0, Math.floor((x0 - 200) / BLOCK)), cx1 = Math.min(CELLS - 1, Math.floor((x1 + 60) / BLOCK));
    const cy0 = Math.max(0, Math.floor((y0 - 60) / BLOCK)), cy1 = Math.min(CELLS - 1, Math.floor((y1 + 40) / BLOCK));
    if (cx1 < cx0 || cy1 < cy0 || !cells.length) return;
    // pass 1: ground-level (building shadows, decals)
    ctx.fillStyle = 'rgba(34,62,22,.30)'; ctx.beginPath();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const cell = cells[cx][cy]; if (!cell.img || !cell.b || cell.b.destroyed) continue;
      const fx = cell.fx, fy = cell.fy;
      ctx.moveTo(fx + 300, fy + 22); ctx.lineTo(fx + 320, fy + 36); ctx.lineTo(fx + 320, fy + 312); ctx.lineTo(fx + 30, fy + 312); ctx.lineTo(fx + 16, fy + 300); ctx.lineTo(fx + 300, fy + 300); ctx.closePath();
    }
    ctx.fill();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) for (const d of cells[cx][cy].decals) ctx.drawImage(d.img, d.x, d.y);
    // pass 2: objects, row by row (painter's order)
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const cell = cells[cx][cy];
        for (const p of cell.back) drawSprite(ctx, p.s, p.x, p.y);
        if (cell.img && cell.b && !cell.b.destroyed) ctx.drawImage(cell.img, cell.fx, cell.fy);
        for (const p of cell.front) drawSprite(ctx, p.s, p.x, p.y);
      }
      // sagging power lines along the row
      ctx.strokeStyle = 'rgba(38,30,26,.85)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let cx = cx0; cx <= cx1; cx++) {
        const cell = cells[cx][cy]; if (!cell.poles) continue;
        const y = cell.gy + BLOCK - 10 - 96, xa = cell.gx + ROAD + 18, xb = cell.gx + BLOCK - 18;
        const spans = [[xa, xb]];
        const nx = cx + 1 < CELLS ? cells[cx + 1][cy] : null;
        if (nx && nx.poles) spans.push([xb, nx.gx + ROAD + 18]);
        for (const [a, b] of spans) for (const [o, sag] of [[-14, 14], [14, 18]]) {
          ctx.moveTo(a + o, y); ctx.quadraticCurveTo((a + b) / 2 + o, y + sag * 2, b + o, y);
        }
      }
      ctx.stroke();
    }
  }

  function drawStatic(ctx, bounds, world) {
    if (!ready) { ctx.fillStyle = GRASS.base; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h); return; }
    const WD = (world && world.WORLD) || (worldRef && worldRef.WORLD) || { w: 7280, h: 7280 };
    const x0 = bounds.x, y0 = bounds.y, x1 = bounds.x + bounds.w, y1 = bounds.y + bounds.h;
    ctx.save();
    if (x0 < 0 || y0 < 0 || x1 > WD.w || y1 > WD.h) { ctx.fillStyle = A.forestPat; ctx.fillRect(x0, y0, bounds.w, bounds.h); }
    const ix0 = Math.max(0, x0), iy0 = Math.max(0, y0), ix1 = Math.min(WD.w, x1), iy1 = Math.min(WD.h, y1);
    if (ix1 > ix0 && iy1 > iy0) { ctx.fillStyle = A.groundPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0); }
    drawRiver(ctx, x0, y0, x1, y1);
    drawValley(ctx, x0, y0, x1, y1);
    if (y1 > 0 && y0 < WD.h) {
      const ty0 = Math.max(0, Math.floor(y0 / BLOCK) * BLOCK), ty1 = Math.min(WD.h, y1);
      if (x0 < 60) for (let ty = ty0; ty < ty1; ty += BLOCK) ctx.drawImage(A.edgeW, -140, ty);
      if (x1 > WD.w - 60) for (let ty = ty0; ty < ty1; ty += BLOCK) ctx.drawImage(A.edgeE, WD.w - 30, ty);
    }
    drawForestOfDeath(ctx, x0, y0, x1, y1);
    drawCells(ctx, x0, y0, x1, y1);
    drawStatues(ctx, x0, y0, x1, y1);
    if (y0 < 0) {
      for (let tx = Math.floor(x0 / BLOCK) * BLOCK; tx < x1; tx += BLOCK) ctx.drawImage(A.cliff, tx, CLIFF_TOP);
      const fx0 = FACES_CX - FACES_W / 2;
      if (x1 > fx0 && x0 < fx0 + FACES_W && y0 < FACES_Y + FACES_H) ctx.drawImage(A.faces, fx0, FACES_Y);
      // The Naka River springs from the foot of the Hokage Rock.
      const rx = REG.river.x0 + 14, rw = ROAD - 28;
      if (x1 > rx && x0 < rx + rw) {
        const g = ctx.createLinearGradient(0, -150, 0, 0);
        g.addColorStop(0, 'rgba(160,215,240,.2)'); g.addColorStop(1, '#bfe6f6');
        ctx.fillStyle = g; ctx.fillRect(rx + 20, -150, rw - 40, 150);
        for (let i = 0; i < 6; i++) fell(ctx, rx + 14 + i * (rw - 28) / 5, 4, 18, 8, 'rgba(240,250,255,.85)');
      }
    }
    if (y1 > WD.h - 30) {
      for (let tx = Math.floor(x0 / BLOCK) * BLOCK; tx < x1; tx += BLOCK) ctx.drawImage(A.wall, tx, WD.h);
      const gx0 = GATE_CX - GATE_W / 2;
      if (x1 > gx0 && x0 < gx0 + GATE_W) ctx.drawImage(A.gate, gx0, WD.h + GATE_Y);
    }
    ctx.restore();
  }

  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    const t = time || 0;
    ctx.save();
    // drifting cloud shadows (world anchored, wrap every 2600px)
    const P = 2600;
    ctx.globalAlpha = .11;
    for (let i = 0; i < 2; i++) {
      const bx = i * 1300 + t * 16, by = i * 900 + t * 5;
      const kx0 = Math.floor((view.x - 640 - bx) / P), ky0 = Math.floor((view.y - 380 - by) / P);
      for (let kx = kx0; kx <= kx0 + 1; kx++) for (let ky = ky0; ky <= ky0 + 1; ky++) {
        const x = bx + kx * P, y = by + ky * P;
        if (x < view.x + view.w && x + 640 > view.x && y < view.y + view.h && y + 380 > view.y) ctx.drawImage(A.cloud, x, y);
      }
    }
    ctx.globalAlpha = 1;
    // the Naka River flows south; skip the stretches under bridges
    const rx = REG.river.x0 + 14, rw = ROAD - 28;
    if (view.x < rx + rw && view.x + view.w > rx) {
      ctx.strokeStyle = 'rgba(225,245,255,.7)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const lane = rx + 8 + hash2(i, 5, 9) * (rw - 16);
        const y = ((hash2(i, 8, 4) * 1500 + t * (60 + (i % 5) * 12)) % 1500) + Math.floor(view.y / 1500) * 1500;
        for (const yy of [y, y + 1500]) {
          if (yy < view.y - 20 || yy > view.y + view.h + 20 || yy > REG.vote.y0 || yy % BLOCK < ROAD + 6) continue;
          ctx.moveTo(lane, yy); ctx.lineTo(lane, yy + 9);
        }
      }
      ctx.stroke();
    }
    // Valley of the End: water pouring over the falls and churning below
    const V = REG.vote;
    if (view.x < V.fallX1 + 80 && view.x + view.w > V.fallX0 - 80 && view.y < V.lake + 120 && view.y + view.h > V.cliff - 20) {
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const x = V.fallX0 + 6 + hash2(i, 2, 7) * (V.fallX1 - V.fallX0 - 12);
        const len = V.lake - V.cliff, y = V.cliff + ((hash2(i, 3, 7) * len + t * 260) % len);
        ctx.moveTo(x, y); ctx.lineTo(x, Math.min(V.lake + 10, y + 26));
      }
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const ph = (t * .8 + i / 10) % 1, x = V.fallX0 + (i + .5) * (V.fallX1 - V.fallX0) / 10;
        fell(ctx, x, V.lake + 20 + ph * 30, 14 + ph * 26, 6 + ph * 10, `rgba(255,255,255,${.6 * (1 - ph)})`);
      }
    }
    // falling leaves
    const N = 16, spanX = view.w + 120, spanY = view.h + 120;
    const cols = ['#7cb342', '#9ccc65', '#5f9a35', '#e8a33a'];
    for (let i = 0; i < N; i++) {
      const sx = hash2(i, 3, 1) * 4000, sy = hash2(i, 7, 2) * 4000, sp = 20 + (i % 5) * 7;
      const wx = sx + t * sp + Math.sin(t * .9 + i) * 26, wy = sy + t * (26 + (i % 4) * 6);
      const x = view.x - 60 + (((wx - (view.x - 60)) % spanX) + spanX) % spanX;
      const y = view.y - 60 + (((wy - (view.y - 60)) % spanY) + spanY) % spanY;
      const a = t * (1.5 + (i % 3) * .7) + i;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(1, .45 + .4 * Math.abs(Math.sin(a * 1.3)));
      ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 2.4, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // fluttering flags on the Hokage residence and banners on the A-Un gate
    const flags = flagSpots.filter(f => !f.b || !f.b.destroyed);
    const WD = (worldRef && worldRef.WORLD) || { w: 7280, h: 7280 };
    const gateFlags = [[GATE_CX - 170, WD.h - 6], [GATE_CX + 170, WD.h - 6]];
    const all = flags.map(f => [f.x, f.y, '#d8352a']).concat(gateFlags.map(g => [g[0], g[1], '#e8a33a']));
    for (const [fx, fy, col] of all) {
      if (fx < view.x - 40 || fx > view.x + view.w + 40 || fy < view.y - 40 || fy > view.y + view.h + 40) continue;
      if (col === '#e8a33a') { ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy + 26); ctx.lineTo(fx, fy - 10); ctx.stroke(); }
      const top = col === '#e8a33a' ? fy - 10 : fy;
      ctx.beginPath(); ctx.moveTo(fx, top);
      for (let k = 1; k <= 6; k++) ctx.lineTo(fx + k * 5, top + Math.sin(t * 6 - k * .9) * 2.2 * (k / 6));
      for (let k = 6; k >= 0; k--) ctx.lineTo(fx + k * 5, top + 14 + Math.sin(t * 6 - k * .9 + .4) * 2.6 * (k / 6));
      ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(60,20,10,.7)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }

  function drawMinimap(mctx, size, world) {
    if (!ready) { mctx.fillStyle = '#76ad3e'; mctx.fillRect(0, 0, size, size); return; }
    const wr = world || worldRef;
    const WD = (wr && wr.WORLD) || { w: 7280, h: 7280 };
    let destroyed = 0;
    if (wr && wr.buildings) for (const b of wr.buildings) if (b.destroyed) destroyed++;
    const key = size + ':' + destroyed + ':' + cells.length;
    if (!mini || miniKey !== key) {
      if (!mini || mini.width !== size) mini = mk(size, size);
      miniKey = key;
      const c = mini.getContext('2d'), s = size / WD.w;
      c.fillStyle = '#76ad3e'; c.fillRect(0, 0, size, size);
      c.fillStyle = '#e0c896';
      for (let x = 0; x < WD.w; x += BLOCK) c.fillRect(x * s, 0, ROAD * s, size);
      for (let y = 0; y < WD.h; y += BLOCK) c.fillRect(0, y * s, size, ROAD * s);
      c.fillStyle = '#245c2c'; c.fillRect(0, 0, 2, size); c.fillRect(size - 2, 0, 2, size);
      c.fillStyle = '#b9a27c'; c.fillRect(0, 0, size, 2);
      c.fillStyle = '#f0dfb8'; c.fillRect(0, size - 2, size, 2);
      // Forest of Death, the Naka River and the Valley of the End
      const F = REG.fod, V = REG.vote;
      c.fillStyle = '#24452a'; c.fillRect(F.x0 * s, F.y0 * s, (F.x1 - F.x0) * s, (F.y1 - F.y0) * s);
      c.strokeStyle = '#8a918c'; c.lineWidth = 1; c.strokeRect(F.x0 * s + .5, F.y0 * s + .5, (F.x1 - F.x0) * s - 1, (F.y1 - F.y0) * s - 1);
      c.fillStyle = '#4f9fc8'; c.fillRect(REG.river.x0 * s + 1, 0, ROAD * s - 2, V.y0 * s);
      c.fillStyle = '#93a866'; c.fillRect(V.x0 * s, V.y0 * s, (V.x1 - V.x0) * s, (V.cliff - V.y0) * s);
      c.fillStyle = '#8c826e'; c.fillRect(V.x0 * s, V.cliff * s, (V.x1 - V.x0) * s, (V.lake - V.cliff) * s);
      c.fillStyle = '#3a86aa'; c.fillRect(V.x0 * s, V.lake * s, (V.x1 - V.x0) * s, (V.y1 - V.lake) * s);
      c.save(); c.scale(s, s); c.fillStyle = '#4f9fc8'; c.fill(valleyRiverPath()); c.restore();
      c.fillStyle = '#e8f6fc'; c.fillRect(V.fallX0 * s, V.cliff * s, (V.fallX1 - V.fallX0) * s, (V.lake - V.cliff) * s);
      c.fillStyle = '#d6d2c4'; for (const st of STATUES) { c.beginPath(); c.arc(st.x * s, st.y * s, Math.max(2, 40 * s), 0, TAU); c.fill(); }
      for (const col of cells) for (const cell of col) {
        if (!cell.b || cell.b.solid) continue;
        const x = cell.fx * s, y = cell.fy * s, w = FOOT * s;
        const lm = LANDMARKS[cell.cx + ',' + cell.cy];
        if (cell.b.destroyed) { c.fillStyle = '#6f6458'; c.fillRect(x, y, w, w); continue; }
        if (lm === 'hokage') { c.fillStyle = '#d9542c'; c.beginPath(); c.arc(x + w / 2, y + w / 2, w * .5, 0, TAU); c.fill(); c.fillStyle = '#fbf1dc'; c.beginPath(); c.arc(x + w / 2, y + w / 2, w * .18, 0, TAU); c.fill(); continue; }
        if (lm === 'training') { c.fillStyle = '#8cc152'; c.fillRect(x, y, w, w); c.fillStyle = '#8b5a36'; c.fillRect(x + w * .3, y + w * .5, 2, 2); c.fillRect(x + w * .5, y + w * .45, 2, 2); c.fillRect(x + w * .7, y + w * .5, 2, 2); continue; }
        const v = lm ? null : chosenVariant(cell);
        const special = { academy: '#d9673a', ichiraku: '#b5503a', hospital: '#e8ece4', hyuga: '#3d5a5e', naka: '#d0402c', tower: '#cbc2a8' };
        c.fillStyle = special[lm] || (cell.key && cell.key.startsWith('uchiha') ? '#353a45' : v ? ROOFS[VPAL[v[0]][v[1]][0]].base : '#c9a24a');
        c.fillRect(x, y, w, w);
        c.fillStyle = 'rgba(255,245,220,.3)'; c.fillRect(x, y, w, w * .25);
        c.fillStyle = '#f3e3c2'; c.fillRect(x, y + w * .68, w, w * .32);
        c.strokeStyle = 'rgba(60,40,30,.6)'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, w - 1);
      }
    }
    mctx.drawImage(mini, 0, 0, size, size);
  }
  function chosenVariant(cell) {
    const k = cell.key; if (!k || !k.includes(':')) return null;
    return k.split(':').map(Number);
  }

  window.KonohaWorld = { init, drawStatic, drawAmbient, drawMinimap, footprint };
})();
