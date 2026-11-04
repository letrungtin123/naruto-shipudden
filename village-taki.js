/* village-taki.js — Takigakure no Sato (Hidden Waterfall Village, Land of Waterfalls).
   Registers window.ShinobiVillages.taki. Procedural Canvas 2D in the same 3/4 oblique, cel-shaded style as
   village-suna.js / village-kiri.js (light from the top-left, dark outlines, cached sprites). No external images.
   Layout: a great waterfall pours off the mossy north cliff into a turquoise lake; the giant tree of the Hero's Water
   stands on an island in the middle, reached from the south gate by a long wooden bridge. Stilt houses stand over the
   water linked by plank boardwalks; farmhouses, a teahouse, a mill and a storehouse line the southern banks. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, NC = 7, SIZE = BLOCK * NC;          // 3640
  const OUT = '#2c2a1e';
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const SM = 46, OVER = 190, BM = 34;                     // building canvas margins: sides / above / below
  const FW = 320, FH = 300;                               // house footprint
  const EL = 40;                                          // stilt deck height above the water
  const SPAWN = { x: 1820, y: 3075 };
  const LAKE = { cx: 1820, cy: 1480, rx: 1250, ryN: 1260, ryS: 960 };
  const ISLE = { cx: 1820, cy: 1660, rx: 410, ry: 320 };
  const TREE = { x: 1670, y: 1580, w: 300, h: 220 };      // trunk footprint (landmark)
  const TM = { l: 430, t: 830, b: 190 };                  // tree canvas margins
  const WF = { L: 1330, R: 2310 };                        // waterfall curtain
  const TRK = [[1110, 15], [2570, 18]];                   // thin side falls [x, half width]
  const PLAZA = { x: 1820, y: 2800, rx: 290, ry: 150 };
  const IPLAZA = { x: 1820, y: 1882, rx: 175, ry: 72 };   // island forecourt
  const GL = 1660, GR = 1980;                             // palisade ends beside the gate
  const BRIDGE = { x: 1712, y: 1930, w: 216, h: 545 };
  const DECKS = [
    { x: 905, y: 610, w: 60, h: 1650, d: 'v' }, { x: 2675, y: 610, w: 60, h: 1650, d: 'v' },
    { x: 965, y: 1470, w: 525, h: 56, d: 'h' }, { x: 2150, y: 1470, w: 525, h: 56, d: 'h' },
    { x: 1296, y: 2170, w: 58, h: 280, d: 'v' }
  ];
  const DIRT = [
    { x: 430, y: 2522, w: 2780, h: 70 }, { x: 430, y: 3048, w: 2780, h: 62 },
    { x: 446, y: 2190, w: 60, h: 920 }, { x: 3134, y: 2190, w: 60, h: 920 },
    { x: 905, y: 2230, w: 60, h: 330 }, { x: 2675, y: 2230, w: 60, h: 330 },
    { x: 690, y: 2440, w: 60, h: 110 }, { x: 2890, y: 2440, w: 60, h: 110 }, { x: 2336, y: 2462, w: 60, h: 90 },
    { x: 1296, y: 2420, w: 58, h: 130 }
  ];
  const ROAD = { x: 1720, y: 2430, w: 200, h: SIZE - 2430 };

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
  function tone(base) { return { base, light: mix(base, '#fff6dc', .3), hi: mix(base, '#fffbef', .58), dark: mix(base, '#1c2a1c', .28), deep: mix(base, '#121a10', .52) }; }
  function wv(t, s) { const k = TAU * t / BLOCK; return .5 + .2 * Math.sin(k + s * 1.7) + .15 * Math.sin(2 * k + s * 2.9) + .1 * Math.sin(3 * k + s * .7) + .05 * Math.sin(5 * k + s * 4.1); }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
  function smoothPath(pts) {
    const p = new Path2D(), n = pts.length;
    p.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    p.closePath(); return p;
  }
  function txt(c, s, x, y, size, col, o = {}) {
    c.font = `${o.weight || '700'} ${size}px ${o.font || MINCHO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 3; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function txtV(c, s, x, y, size, col) { [...s].forEach((ch, i) => txt(c, ch, x, y + size * .55 + i * size * 1.04, size, col)); }
  function celFill(c, path, base, light, dark, o = {}) {
    const ld = o.ld ?? 6, dd = o.dd ?? 8, big = () => { const p = new Path2D(); p.rect(-1e5, -1e5, 2e5, 2e5); return p; };
    c.save();
    c.fillStyle = base; c.fill(path);
    c.clip(path);
    if (light) { const p = big(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, ld, ld])); c.fillStyle = light; c.fill(p, 'evenodd'); }
    if (dark) { const p = big(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, -dd, -dd])); c.fillStyle = dark; c.fill(p, 'evenodd'); }
    c.restore();
  }
  function sprite(w, h, ax, ay, fn) { const cv = mk(w, h), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; fn(c, ax, ay); return { cv, ax, ay }; }
  function quadPt(x1, y1, cx, cy, x2, y2, t) { const m = 1 - t; return [m * m * x1 + 2 * m * t * cx + t * t * x2, m * m * y1 + 2 * m * t * cy + t * t * y2]; }

  // ------------------------------------------------------------------ palettes
  const WOOD = tone('#a5733f'), WOODD = tone('#6e4a2a'), PLASTER = tone('#f1e9d2'), STONE = tone('#a3a28e');
  const BARK = { base: '#7b5b3b', light: '#a67f55', dark: '#56402a', deep: '#3b2c1c' };
  const ROCK = { base: '#7f8a78', light: '#a9b39d', dark: '#5a6553', deep: '#414a3c', line: '#2b3127' };
  const LEAF = [
    { out: '#1b3a1e', deep: '#25502a', dark: '#2f6a31', mid: '#468a3a', light: '#68aa4c', hi: '#a4d468' },
    { out: '#163525', deep: '#1f4a36', dark: '#2a6046', mid: '#3f8159', light: '#5fa271', hi: '#98d092' },
    { out: '#2a3a16', deep: '#3a5420', dark: '#4d7027', mid: '#6a9234', light: '#8fb548', hi: '#c6e070' }
  ];
  const MAPLE = { out: '#4a1c10', deep: '#7a2a18', dark: '#a8401f', mid: '#cf5f2a', light: '#ea8a3a', hi: '#f8c069' };
  const HYDR = [['#5a7fd0', '#a8c4f4'], ['#8a62c4', '#c9a8ef'], ['#e07aa0', '#f6c0d4']];
  const THATCH = ['#b39a5e', '#a08b57', '#a3a062'].map(tone);
  const BOARD = ['#3f7f70', '#4f7d4a', '#56707a', '#7a5a3a', '#35685e', '#5b6f45'].map(tone);
  const CLOTH = ['#2f6f8f', '#3f7d5a', '#b8432e', '#245a72', '#7b3f6b', '#2f8f88'];
  const VERM = tone('#c8452e');
  const LANT = '#d0542f';

  // ------------------------------------------------------------------ shared symbols / small kit
  // Takigakure mark: the cliff lip, three falling streams and the pool below.
  function takiMark(c, x, y, s, col, lw) {
    c.save(); c.translate(x, y); c.strokeStyle = col; c.lineWidth = lw || Math.max(1.2, s * .17); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-s * .85, -s * .5); c.quadraticCurveTo(0, -s * 1.02, s * .85, -s * .5); c.stroke();
    c.beginPath(); for (const dx of [-.4, 0, .4]) { c.moveTo(dx * s, -s * .62 + Math.abs(dx) * s * .22); c.lineTo(dx * s * .85, s * .3); } c.stroke();
    c.beginPath(); c.moveTo(-s * .9, s * .34); c.quadraticCurveTo(0, s * 1.08, s * .9, s * .34); c.stroke();
    c.restore();
  }
  function chochin(c, x, y, s = 1, col = LANT, label) {
    line(c, x, y - 15 * s, x, y - 8 * s, '#2e2a22', 1.5);
    frect(c, x - 4 * s, y - 10 * s, 8 * s, 3 * s, '#25221c');
    fell(c, x, y, 6.5 * s, 8.5 * s, col);
    c.save(); c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); c.clip();
    frect(c, x + 2 * s, y - 9 * s, 5 * s, 18 * s, 'rgba(70,10,20,.3)');
    frect(c, x - 6.5 * s, y - 9 * s, 2.6 * s, 18 * s, 'rgba(255,220,170,.42)');
    c.strokeStyle = 'rgba(70,10,10,.35)'; c.lineWidth = .8; c.beginPath();
    for (let k = -2; k <= 2; k++) { c.moveTo(x - 7 * s, y + k * 3.2 * s); c.lineTo(x + 7 * s, y + k * 3.2 * s); } c.stroke();
    if (label) txt(c, label, x, y, 7 * s, '#1d1210', { weight: '800' });
    c.restore();
    frect(c, x - 4 * s, y + 7 * s, 8 * s, 3 * s, '#25221c');
    c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); sk(c, '#4a1712', 1.2);
  }
  function post(c, x, y0, y1, w = 8, T = WOODD) {
    frect(c, x - w / 2, y0, w, y1 - y0, T.base); frect(c, x - w / 2, y0, w * .32, y1 - y0, T.light); frect(c, x + w / 2 - w * .28, y0, w * .28, y1 - y0, T.deep);
    srect(c, x - w / 2, y0, w, y1 - y0, OUT, 1.2);
  }
  function woodWall(c, x, y, w, h, o = {}) {
    const W = o.W || WOOD, ph = h * (o.plaster || 0);
    frect(c, x, y, w, h, W.base);
    c.strokeStyle = 'rgba(70,40,18,.38)'; c.lineWidth = 1; c.beginPath();
    for (let i = x + 8; i < x + w; i += 8) { c.moveTo(i, y + ph); c.lineTo(i, y + h); } c.stroke();
    c.strokeStyle = 'rgba(255,225,170,.2)'; c.beginPath(); for (let i = x + 9.5; i < x + w; i += 16) { c.moveTo(i, y + ph); c.lineTo(i, y + h); } c.stroke();
    if (ph) { frect(c, x, y, w, ph, PLASTER.base); frect(c, x, y + ph - 5, w, 5, WOODD.dark); frect(c, x, y + ph - 5, w, 1.5, WOODD.light); }
    if (o.bay) for (let px = x + o.bay; px < x + w - 14; px += o.bay) { frect(c, px - 3, y, 6, h, WOODD.base); frect(c, px - 3, y, 2, h, WOODD.light); }
    frect(c, x, y, 7, h, WOODD.base); frect(c, x, y, 2.5, h, WOODD.light); frect(c, x + w - 7, y, 7, h, WOODD.dark);
    frect(c, x - 2, y + h - 7, w + 4, 7, WOODD.dark); frect(c, x - 2, y + h - 7, w + 4, 2, WOODD.light);
    c.fillStyle = 'rgba(255,245,215,.16)'; c.fillRect(x + 7, y, 10, h - 7);
    c.fillStyle = 'rgba(30,25,10,.16)'; c.fillRect(x + w - 26, y, 19, h - 7);
    c.fillStyle = 'rgba(20,25,10,.3)'; c.fillRect(x, y, w, o.eave ?? 10);
    srect(c, x, y, w, h, OUT, 2);
  }
  function shoji(c, x, y, w, h, lit) {
    frect(c, x - 3, y - 3, w + 6, h + 6, WOODD.dark);
    frect(c, x, y, w, h, lit ? '#f8dc96' : '#efe8d2');
    c.strokeStyle = lit ? 'rgba(140,90,30,.55)' : 'rgba(90,70,45,.5)'; c.lineWidth = 1; c.beginPath();
    for (let i = 1; i < 4; i++) { c.moveTo(x + w * i / 4, y); c.lineTo(x + w * i / 4, y + h); }
    for (let j = 1; j < 3; j++) { c.moveTo(x, y + h * j / 3); c.lineTo(x + w, y + h * j / 3); } c.stroke();
    frect(c, x, y, w, 3, 'rgba(60,40,20,.25)');
    srect(c, x - 3, y - 3, w + 6, h + 6, OUT, 1.2);
  }
  function lattice(c, x, y, w, h) {
    frect(c, x - 2, y - 2, w + 4, h + 4, WOODD.deep); frect(c, x, y, w, h, '#3a2a1c');
    for (let i = x + 2; i < x + w - 2; i += 5) { frect(c, i, y, 3, h, WOOD.dark); frect(c, i, y, 1, h, WOOD.light); }
    frect(c, x, y + h * .5, w, 2, WOODD.dark);
    srect(c, x - 2, y - 2, w + 4, h + 4, OUT, 1.2);
  }
  function doorway(c, x, y, w, h, cl, ch) {
    frect(c, x - 4, y - 4, w + 8, h + 4, WOODD.dark); frect(c, x, y, w, h, '#2a1e14');
    fpoly(c, [x + w * .55, y + h, x + w, y + h * .4, x + w, y + h], 'rgba(255,200,140,.1)');
    if (cl) {
      const n = w > 44 ? 3 : 2, sw = (w - (n - 1) * 2) / n;
      for (let i = 0; i < n; i++) { const sx = x + i * (sw + 2); frect(c, sx, y + 2, sw, h * .46, cl); frect(c, sx + sw - 2, y + 2, 2, h * .46, 'rgba(0,0,0,.22)'); frect(c, sx, y + 2, sw, 2, 'rgba(255,255,255,.2)'); }
      if (ch) txt(c, ch, x + w / 2, y + 3 + h * .23, Math.min(h * .28, w * .38), '#f6efe0');
      else takiMark(c, x + w / 2, y + 2 + h * .23, Math.min(h * .14, w * .2), '#f6efe0');
    }
    frect(c, x - 8, y + h, w + 16, 5, STONE.light); srect(c, x - 8, y + h, w + 16, 5, OUT, 1);
    srect(c, x - 4, y - 4, w + 8, h + 4, OUT, 1.4);
  }
  function stonePlinth(c, x, y, w, h) {
    frect(c, x, y, w, h, '#7f7e6c');
    const R = rng(Math.round(x * 7 + w));
    for (let row = 0; row < Math.ceil(h / 9); row++) for (let sx = x + (row % 2) * 7 - 4; sx < x + w; sx += 13 + R() * 6) {
      const rx = 6 + R() * 3, cy = y + 5 + row * 9;
      if (sx + rx < x || sx - rx > x + w) continue;
      fell(c, sx, cy, rx, 4.6, R() < .5 ? '#a8a692' : '#959482'); fell(c, sx - 1.5, cy - 1.5, rx * .5, 1.6, 'rgba(255,255,240,.35)');
    }
    c.fillStyle = 'rgba(90,140,60,.35)'; for (let i = 0; i < w / 18; i++) c.fillRect(x + R() * w, y + h - 4 - R() * 4, 6 + R() * 8, 3);
    frect(c, x, y, w, 3, 'rgba(30,30,20,.3)');
    srect(c, x, y, w, h, OUT, 1.5);
  }
  function railing(c, x0, x1, y, h = 18, gaps = []) {
    const segs = []; let a = x0;
    for (const [g0, g1] of gaps) { segs.push([a, g0]); a = g1; }
    segs.push([a, x1]);
    for (const [s, e] of segs) {
      if (e - s < 4) continue;
      line(c, s, y - h + 2, e, y - h + 2, OUT, 5.5); line(c, s, y - h + 2, e, y - h + 2, WOOD.base, 3.5); line(c, s, y - h + 1, e, y - h + 1, WOOD.hi, 1.2);
      line(c, s, y - h * .45, e, y - h * .45, WOODD.base, 2.5);
      const n = Math.max(1, Math.round((e - s) / 26));
      for (let i = 0; i <= n; i++) post(c, s + (e - s) * i / n, y - h, y, 5, WOODD);
    }
  }
  function ladder(c, x, y0, y1) {
    for (let yy = y0 + 6; yy < y1 - 2; yy += 9) line(c, x - 7, yy, x + 7, yy, WOODD.base, 2.6);
    for (const dx of [-7, 7]) { line(c, x + dx, y0 - 14, x + dx, y1, OUT, 4.6); line(c, x + dx, y0 - 14, x + dx, y1, WOOD.light, 2.4); }
  }
  function barrel(c, x, y, s = 1, col = '#8a5e36') {
    const T = tone(col), rx = 11 * s, ry = 4 * s, h = 24 * s;
    fell(c, x + 4 * s, y + 1, rx + 3, ry + 1, 'rgba(15,30,15,.3)');
    const p = new Path2D(); p.moveTo(x - rx, y - h); p.lineTo(x - rx, y); p.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); p.lineTo(x + rx, y - h); p.closePath();
    celFill(c, p, T.base, T.light, T.dark, { ld: 3 * s, dd: 4 * s }); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(p);
    for (const yy of [y - h * .75, y - h * .25]) { c.beginPath(); c.ellipse(x, yy, rx, ry, 0, 0, Math.PI); sk(c, '#3a3328', 2); }
    fell(c, x, y - h, rx, ry, T.light); fell(c, x + 1, y - h + .5, rx - 3, ry - 1.4, T.dark);
    c.beginPath(); c.ellipse(x, y - h, rx, ry, 0, 0, TAU); sk(c, OUT, 1.2);
  }
  function netHang(c, x, y, w, h) {
    post(c, x, y - 12, y + h + 30, 6, WOODD); post(c, x + w, y - 12, y + h + 30, 6, WOODD);
    line(c, x - 4, y - 8, x + w + 4, y - 8, WOODD.dark, 4);
    c.save(); c.beginPath(); c.moveTo(x + 2, y - 6); c.quadraticCurveTo(x + w / 2, y + h * 1.25, x + w - 2, y - 6); c.lineTo(x + w - 2, y - 6); c.closePath();
    c.fillStyle = 'rgba(70,90,80,.25)'; c.fill(); c.clip();
    c.strokeStyle = 'rgba(50,60,50,.75)'; c.lineWidth = 1; c.beginPath();
    for (let i = -h; i < w + h; i += 6) { c.moveTo(x + i, y - 6); c.lineTo(x + i + h, y + h); c.moveTo(x + i, y - 6); c.lineTo(x + i - h, y + h); } c.stroke();
    c.restore();
    for (let i = 0; i < 4; i++) fell(c, x + 8 + i * (w - 16) / 3, y - 4, 2.6, 2.6, '#d8c49a');
  }
  function fishRack(c, x, y, w = 60) {
    post(c, x, y - 46, y, 5, WOODD); post(c, x + w, y - 46, y, 5, WOODD);
    line(c, x - 3, y - 42, x + w + 3, y - 42, WOODD.dark, 3); line(c, x - 3, y - 26, x + w + 3, y - 26, WOODD.dark, 2.5);
    for (let i = 0; i < Math.floor(w / 9); i++) for (const yy of [y - 40, y - 24]) {
      const fx = x + 6 + i * 9;
      const p = new Path2D(); p.moveTo(fx, yy); p.quadraticCurveTo(fx + 4, yy + 7, fx, yy + 14); p.quadraticCurveTo(fx - 4, yy + 7, fx, yy); p.closePath();
      c.fillStyle = '#b8b3a0'; c.fill(p); c.strokeStyle = '#4a4a40'; c.lineWidth = .8; c.stroke(p);
      fpoly(c, [fx - 3, yy + 16, fx, yy + 12, fx + 3, yy + 16], '#8a8678');
    }
  }
  function flagPole(c, x, y, h, col) {
    post(c, x, y - h, y, 4, WOODD);
    const fy = y - h + 4;
    fpoly(c, [x + 2, fy, x + 34, fy + 3, x + 30, fy + 12, x + 34, fy + 22, x + 2, fy + 24], col);
    poly(c, [x + 2, fy, x + 34, fy + 3, x + 30, fy + 12, x + 34, fy + 22, x + 2, fy + 24]); sk(c, OUT, 1.1);
    takiMark(c, x + 16, fy + 12, 6, '#f4f1e6', 1.4);
  }
  function banner(c, x, y, w, h, col) {
    line(c, x - 4, y, x + w + 4, y, WOODD.dark, 3.5);
    frect(c, x, y + 2, w, h, col); frect(c, x + w - 4, y + 2, 4, h, 'rgba(0,0,0,.2)'); frect(c, x, y + 2, 3, h, 'rgba(255,255,255,.18)');
    fpoly(c, [x, y + h + 2, x + w / 2, y + h - 6, x + w, y + h + 2, x + w, y + h + 8, x, y + h + 8], col);
    poly(c, [x, y + 2, x + w, y + 2, x + w, y + h + 8, x + w / 2, y + h, x, y + h + 8]); sk(c, OUT, 1.2);
    takiMark(c, x + w / 2, y + 2 + h * .36, w * .3, '#f6f2e4', Math.max(1.2, w * .06));
  }

  // ------------------------------------------------------------------ roofs
  // Hip roof in 3/4 view. (x, y): back-eave line, w x d: eave rectangle; rf: ridge position (negative = ridge rises above the back eave).
  function roofHip(c, x, y, w, d, R, o = {}) {
    const hip = o.hip ?? w * .18, L = x, Rt = x + w, T = y, B = y + d, ry = y + d * (o.rf ?? .25);
    const sil = ry < T ? [L, T, L + hip, ry, Rt - hip, ry, Rt, T, Rt, B, L, B] : [L, T, Rt, T, Rt, B, L, B];
    c.fillStyle = 'rgba(20,28,12,.3)'; c.fillRect(L + 10, B - 3, w - 20, o.shadow ?? 12);
    if (ry > T) fpoly(c, [L, T, Rt, T, Rt - hip, ry, L + hip, ry], R.light);
    if (hip > 0) { fpoly(c, [L, T, L + hip, ry, L, B], R.light); fpoly(c, [Rt, T, Rt - hip, ry, Rt, B], R.dark); }
    const front = [L, B, Rt, B, Rt - hip, ry, L + hip, ry];
    fpoly(c, front, R.base);
    const top = Math.min(T, ry);
    c.save(); poly(c, sil); c.clip();
    const R2 = rng(o.seed || 7);
    if (o.thatch) {
      c.lineWidth = 1.2;
      for (const [col, off] of [[R.dark, 0], [R.hi, 2.5]]) {
        c.strokeStyle = col; c.globalAlpha = off ? .4 : .55; c.beginPath();
        for (let yy = top; yy < B; yy += 7) for (let xx = L + ((yy / 7) % 2) * 3 + off; xx < Rt; xx += 6) { const len = 5 + R2() * 6; c.moveTo(xx, yy); c.lineTo(xx + (R2() - .5) * 2, yy + len); }
        c.stroke();
      }
      c.globalAlpha = 1;
      for (let yy = ry + 20; yy < B - 10; yy += 21) { c.fillStyle = 'rgba(60,45,20,.16)'; c.fillRect(L, yy, w, 3); c.fillStyle = 'rgba(255,240,200,.12)'; c.fillRect(L, yy + 3, w, 2); }
      for (let i = 0; i < (o.moss ?? 7); i++) { const mx = L + hip * .6 + R2() * (w - hip * 1.2), my = ry + 12 + R2() * (B - ry - 26); fell(c, mx, my, 10 + R2() * 20, 4 + R2() * 6, 'rgba(78,128,46,.42)'); fell(c, mx - 4, my - 2, 5 + R2() * 6, 2 + R2() * 2, 'rgba(150,200,90,.35)'); }
    } else {
      c.strokeStyle = R.deep; c.lineWidth = 1.5; c.beginPath();
      for (let yy = ry + 8; yy < B; yy += 8) { c.moveTo(L, yy); c.lineTo(Rt, yy); }
      if (ry > T) for (let yy = T + 7; yy < ry; yy += 7) { c.moveTo(L, yy); c.lineTo(Rt, yy); }
      c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1; c.beginPath();
      for (let yy = ry + 8, r = 0; yy < B; yy += 8, r++) for (let xx = L + (r % 2) * 7; xx < Rt; xx += 14) { c.moveTo(xx, yy); c.lineTo(xx, yy + 8); }
      c.stroke();
      c.strokeStyle = 'rgba(255,255,230,.16)'; c.beginPath(); for (let yy = ry + 9.5; yy < B; yy += 8) { c.moveTo(L, yy); c.lineTo(Rt, yy); } c.stroke();
      for (let i = 0; i < (o.moss ?? 3); i++) { const mx = L + R2() * w, my = ry + 6 + R2() * (B - ry - 12); fell(c, mx, my, 8 + R2() * 14, 3 + R2() * 4, 'rgba(90,140,60,.35)'); }
    }
    c.fillStyle = 'rgba(255,250,220,.12)'; c.fillRect(L, top, w * .3, B - top);
    c.fillStyle = 'rgba(20,30,10,.15)'; c.fillRect(Rt - w * .24, top, w * .24, B - top);
    c.restore();
    if (hip > 0) { line(c, L + hip, ry, L + 3, B - 3, R.deep, o.thatch ? 3.5 : 2.6); line(c, Rt - hip, ry, Rt - 3, B - 3, R.deep, o.thatch ? 3.5 : 2.6); }
    if (o.thatch) {
      c.beginPath(); c.moveTo(L, B - 11); c.lineTo(Rt, B - 11); c.lineTo(Rt - 3, B); c.lineTo(L + 3, B); c.closePath(); c.fillStyle = R.dark; c.fill();
      frect(c, L, B - 11, w, 2.5, R.hi);
      c.strokeStyle = 'rgba(40,30,12,.5)'; c.lineWidth = 1; c.beginPath(); for (let xx = L + 4; xx < Rt - 2; xx += 4) { c.moveTo(xx, B - 8); c.lineTo(xx, B - 1); } c.stroke();
    } else { frect(c, L - 2, B - 6, w + 4, 6, R.deep); frect(c, L - 2, B - 6, w + 4, 1.6, R.light); }
    const rl = L + hip, rr = Rt - hip;
    if (o.thatch) {
      if (rr - rl > 6) {
        rrect(c, rl - 8, ry - 8, rr - rl + 16, 15, 7); c.fillStyle = '#4e4028'; c.fill(); sk(c, OUT, 1.6);
        frect(c, rl - 4, ry - 6, rr - rl + 8, 3, 'rgba(255,230,170,.35)');
        for (let xx = rl + 10; xx < rr - 4; xx += 24) { line(c, xx - 7, ry - 16, xx + 7, ry + 2, '#3b2c1c', 3); line(c, xx + 7, ry - 16, xx - 7, ry + 2, '#3b2c1c', 3); }
      }
    } else if (rr - rl > 4) {
      frect(c, rl - 4, ry - 5, rr - rl + 8, 9, R.deep); frect(c, rl - 4, ry - 5, rr - rl + 8, 2, R.hi); srect(c, rl - 4, ry - 5, rr - rl + 8, 9, OUT, 1.3);
      for (const ex of [rl - 10, rr + 2]) { frect(c, ex, ry - 10, 8, 15, R.deep); srect(c, ex, ry - 10, 8, 15, OUT, 1.2); }
    }
    poly(c, sil); sk(c, OUT, 2);
    if (o.flare && !o.thatch) {
      for (const s of [-1, 1]) {
        const ex = s < 0 ? L : Rt, pts = [ex + s * 10, B - 16, ex - s * 18, B - 6, ex - s * 14, B, ex + s * 3, B - 4];
        fpoly(c, pts, R.deep); poly(c, pts); sk(c, OUT, 1.4);
      }
    }
  }

  // ------------------------------------------------------------------ house kit: stilts
  function stiltBase(c, P, x0, x1, top, posts) {
    const fy = FH - EL;
    fpoly(c, [x0 + 8, fy + 8, x1 + 16, fy + 8, x1 + 16, FH + 6, x0 + 8, FH + 6], 'rgba(8,45,50,.36)');
    for (const px of posts) line(c, px + 14, fy + 4, px + 14, FH - 12, '#4a321e', 6);
    c.strokeStyle = WOODD.dark; c.lineWidth = 3.5; c.beginPath();
    for (let i = 0; i < posts.length - 1; i++) { const a = posts[i], b = posts[i + 1]; c.moveTo(a, fy + 12); c.lineTo(b, FH - 8); c.moveTo(b, fy + 12); c.lineTo(a, FH - 8); }
    c.stroke();
    for (const px of posts) { post(c, px, fy + 6, FH + 2, 11, WOODD); frect(c, px - 5.5, FH - 9, 11, 7, 'rgba(40,95,85,.55)'); }
    frect(c, x0, top, x1 - x0, fy - top, '#b58650');
    c.strokeStyle = 'rgba(80,50,25,.45)'; c.lineWidth = 1.2; c.beginPath();
    for (let yy = top + 10; yy < fy; yy += 10) { c.moveTo(x0, yy); c.lineTo(x1, yy); }
    for (let yy = top, r = 0; yy < fy; yy += 10, r++) for (let xx = x0 + 30 + (r % 3) * 37; xx < x1; xx += 110) { c.moveTo(xx, yy); c.lineTo(xx, Math.min(fy, yy + 10)); }
    c.stroke();
    c.strokeStyle = 'rgba(255,230,180,.25)'; c.beginPath(); for (let yy = top + 11.5; yy < fy; yy += 10) { c.moveTo(x0, yy); c.lineTo(x1, yy); } c.stroke();
    frect(c, x0, top, x1 - x0, 3, 'rgba(255,230,180,.4)');
    srect(c, x0, top, x1 - x0, fy - top, OUT, 1.6);
    frect(c, x0 - 3, fy, x1 - x0 + 6, 11, WOODD.base); frect(c, x0 - 3, fy, x1 - x0 + 6, 3, WOODD.light); srect(c, x0 - 3, fy, x1 - x0 + 6, 11, OUT, 1.4);
    for (const px of posts) P.posts.push([px, FH - 2]);
  }

  // ------------------------------------------------------------------ house variants (footprint 320x300)
  function vHut(c, P) {
    const fy = FH - EL;
    stiltBase(c, P, 6, 314, 104, [16, 92, 168, 244, 304]);
    barrel(c, 26, 150, .8); barrel(c, 296, 156, .7, '#7a5232');
    woodWall(c, 44, 126, 232, 96, { plaster: .4, bay: 78 });
    shoji(c, 62, 168, 40, 34); shoji(c, 218, 168, 40, 34, true);
    doorway(c, 136, 160, 48, 62, P.cl);
    roofHip(c, 20, 0, 280, 134, P.R, { thatch: true, hip: 60, rf: -.32, seed: 11 + P.idx });
    for (const lx of [124, 196]) { line(c, lx, 134, lx, 160, '#2e2a22', 1.2); chochin(c, lx, 170, 1, LANT); }
    netHang(c, 262, fy - 86, 40, 52);
    railing(c, 10, 310, fy, 20, [[30, 58]]);
    ladder(c, 44, fy + 6, FH + 4);
    flagPole(c, 252, -40, 46, P.cl2);
    P.lamps.push([124, 170], [196, 170]);
  }
  function vLong(c, P) {
    const fy = FH - EL;
    stiltBase(c, P, 4, 316, 100, [14, 90, 166, 242, 306]);
    woodWall(c, 206, 150, 98, 72, { W: P.W2 });
    shoji(c, 232, 170, 46, 28, true);
    roofHip(c, 196, 92, 120, 66, P.R2, { thatch: true, hip: 22, rf: -.12, seed: 21 + P.idx, moss: 3 });
    woodWall(c, 16, 114, 198, 108, { plaster: .44, bay: 66 });
    shoji(c, 32, 166, 36, 34); lattice(c, 148, 174, 48, 32);
    doorway(c, 84, 162, 50, 60, P.cl);
    roofHip(c, 2, -6, 230, 130, P.R, { hip: 46, rf: .16, flare: true, seed: 23 + P.idx });
    line(c, 150, 124, 150, 150, '#2e2a22', 1.2); chochin(c, 150, 160, .95, LANT);
    fishRack(c, 214, fy - 2, 50);
    railing(c, 8, 312, fy, 18, [[272, 300]]);
    ladder(c, 286, fy + 6, FH + 4);
    banner(c, 6, 120, 14, 56, P.cl2);
    P.lamps.push([150, 160]);
  }
  function vTower(c, P) {
    const fy = FH - EL;
    stiltBase(c, P, 10, 310, 120, [20, 96, 172, 248, 300]);
    woodWall(c, 38, 150, 244, 72, { bay: 61 });
    shoji(c, 54, 168, 38, 32); shoji(c, 228, 168, 38, 32, true);
    doorway(c, 136, 164, 48, 58, P.cl);
    woodWall(c, 72, 40, 176, 86, { plaster: .56, bay: 58, eave: 8 });
    shoji(c, 88, 72, 30, 30, true); shoji(c, 145, 72, 30, 30); shoji(c, 202, 72, 30, 30, true);
    roofHip(c, 22, 106, 276, 54, P.R2, { hip: 30, rf: .3, flare: true, seed: 31 + P.idx, moss: 2 });
    roofHip(c, 50, -58, 220, 106, P.R, { thatch: true, hip: 64, rf: -.3, seed: 33 + P.idx });
    for (const lx of [124, 196]) { line(c, lx, 160, lx, 166, '#2e2a22', 1.2); chochin(c, lx, 176, .9, LANT); }
    railing(c, 14, 306, fy, 18, [[266, 294]]);
    ladder(c, 280, fy + 6, FH + 4);
    barrel(c, 26, 160, .75);
    P.lamps.push([124, 176], [196, 176]);
  }
  function vMachiya(c, P) {
    stonePlinth(c, 8, 272, 304, 22);
    woodWall(c, 14, 170, 292, 102, { bay: 73, eave: 12 });
    lattice(c, 28, 198, 72, 52); lattice(c, 220, 198, 72, 52);
    doorway(c, 128, 196, 64, 76, P.cl, '宿');
    woodWall(c, 34, 56, 252, 88, { plaster: .64, bay: 84, eave: 10 });
    for (const wx of [56, 136, 216]) { frect(c, wx, 72, 48, 24, '#3a2a1c'); for (let i = wx + 3; i < wx + 46; i += 6) frect(c, i, 72, 3, 24, PLASTER.dark); srect(c, wx, 72, 48, 24, OUT, 1.2); }
    roofHip(c, 0, 124, 320, 58, P.R2, { hip: 0, rf: .25, seed: 41 + P.idx, moss: 2 });
    roofHip(c, 18, -40, 284, 106, P.R, { hip: 48, rf: .05, flare: true, seed: 43 + P.idx });
    frect(c, 126, 178, 68, 18, '#3a2a1c'); frect(c, 129, 180, 62, 14, '#e8d6a8'); txt(c, '滝の宿', 160, 188, 11, '#2a1a10', { weight: '900' }); srect(c, 126, 178, 68, 18, OUT, 1.2);
    for (const lx of [114, 206]) chochin(c, lx, 212, 1, LANT, '宿');
    barrel(c, 20, 296, .8, '#5f6f68'); barrel(c, 300, 294, .75);
    for (const px of [104, 216]) { fell(c, px, 292, 9, 4, 'rgba(15,30,15,.3)'); frect(c, px - 7, 280, 14, 12, '#8a5a3a'); srect(c, px - 7, 280, 14, 12, OUT, 1); fell(c, px, 274, 11, 9, LEAF[0].mid); fell(c, px - 3, 271, 5, 4, LEAF[0].light); }
    P.lamps.push([114, 212], [206, 212]);
  }
  function vFarm(c, P) {
    stonePlinth(c, 16, 278, 288, 16);
    woodWall(c, 26, 186, 268, 92, { bay: 67, plaster: .34 });
    shoji(c, 40, 220, 52, 38); shoji(c, 222, 220, 54, 38, true);
    doorway(c, 122, 208, 70, 70, null);
    frect(c, 132, 214, 50, 30, '#a08a52'); c.strokeStyle = '#6a5a32'; c.lineWidth = 1; c.beginPath(); for (let i = 134; i < 182; i += 3) { c.moveTo(i, 214); c.lineTo(i, 244); } c.stroke(); srect(c, 132, 214, 50, 30, OUT, 1);
    roofHip(c, 0, -10, 320, 206, P.R, { thatch: true, hip: 72, rf: -.42, seed: 51 + P.idx, moss: 12 });
    // smoke-vent gablet on the ridge
    fpoly(c, [136, -96, 160, -124, 184, -96], PLASTER.dark); for (let i = 142; i < 180; i += 6) line(c, i, -98, i, -110 + Math.abs(i - 160) * .6, WOODD.dark, 1.5); poly(c, [136, -96, 160, -124, 184, -96]); sk(c, OUT, 1.5);
    // dried persimmon garlands under the eave
    for (const gx of [60, 250]) { line(c, gx, 196, gx, 236, '#6a5a32', 1); for (let k = 0; k < 6; k++) fell(c, gx + (k % 2 ? 2 : -2), 200 + k * 6, 3.4, 3, '#e8782a'); }
    // firewood stack
    for (let r = 0; r < 3; r++) for (let k = 0; k < 5 - r; k++) { const fx = 274 + k * 9 + r * 4.5, fy = 292 - r * 8; fell(c, fx, fy, 4.6, 4, '#8a6a42'); fell(c, fx, fy, 2.4, 2, '#d4b07a'); c.beginPath(); c.arc(fx, fy, 4.6, 0, TAU); sk(c, OUT, .9); }
    line(c, 160, 192, 160, 206, '#2e2a22', 1.2); chochin(c, 160, 214, .9, LANT);
    P.lamps.push([160, 214]);
  }
  function vTea(c, P) {
    stonePlinth(c, 6, 268, 308, 20);
    woodWall(c, 14, 150, 292, 118, { bay: 73, eave: 12 });
    doorway(c, 104, 178, 112, 90, '#3f7d5a', '茶');
    shoji(c, 30, 188, 56, 48); shoji(c, 234, 188, 56, 48, true);
    roofHip(c, -4, 0, 328, 162, P.R, { hip: 58, rf: .12, flare: true, seed: 61 + P.idx });
    frect(c, 124, 116, 72, 24, '#3a2a1c'); frect(c, 127, 119, 66, 18, '#efe2b8'); txt(c, '茶屋', 160, 129, 14, '#2a1a10', { weight: '900' }); srect(c, 124, 116, 72, 24, OUT, 1.2);
    for (const lx of [92, 228]) { line(c, lx, 162, lx, 172, '#2e2a22', 1.2); chochin(c, lx, 182, 1.05, LANT, '茶'); }
    // red bench and parasol (nodate-gasa)
    frect(c, 24, 286, 70, 7, '#c8452e'); frect(c, 24, 286, 70, 2, '#e8705a'); frect(c, 30, 293, 5, 10, WOODD.dark); frect(c, 83, 293, 5, 10, WOODD.dark); srect(c, 24, 286, 70, 7, OUT, 1.2);
    post(c, 274, 210, 304, 4, WOODD);
    const pp = new Path2D(); pp.moveTo(226, 226); pp.quadraticCurveTo(274, 178, 322, 226); pp.quadraticCurveTo(274, 214, 226, 226); pp.closePath();
    celFill(c, pp, '#cf4a32', '#ec7a5c', '#a2321e', { ld: 3, dd: 5 }); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(pp);
    c.strokeStyle = 'rgba(80,20,10,.5)'; c.lineWidth = 1; c.beginPath(); for (let i = -4; i <= 4; i++) { c.moveTo(274, 196); c.lineTo(274 + i * 11, 222 - Math.abs(i) * .5); } c.stroke();
    for (const [px, col] of [[110, HYDR[0]], [218, HYDR[1]]]) { fell(c, px, 290, 11, 4, 'rgba(15,30,15,.3)'); frect(c, px - 8, 278, 16, 12, '#7a6a5a'); srect(c, px - 8, 278, 16, 12, OUT, 1); fell(c, px, 272, 12, 9, LEAF[1].mid); for (let k = 0; k < 4; k++) fell(c, px - 6 + k * 4, 268 + (k % 2) * 4, 4, 3.4, col[k % 2]); }
    P.lamps.push([92, 182], [228, 182]);
  }
  function vKura(c, P) {
    stonePlinth(c, 30, 268, 260, 26);
    const x = 40, w = 240, y = 104;
    frect(c, x, y, w, 164, PLASTER.base);
    c.fillStyle = 'rgba(120,110,80,.12)'; for (let i = 0; i < 9; i++) c.fillRect(x + 12 + i * 26, y + 10, 3, 30 + (i * 17) % 40);
    frect(c, x, 196, w, 72, '#4a4f4a');
    c.strokeStyle = '#e8e4d6'; c.lineWidth = 2.4; c.beginPath();
    for (let k = -72; k < w; k += 18) { c.moveTo(x + k, 268); c.lineTo(x + k + 72, 196); c.moveTo(x + k, 196); c.lineTo(x + k + 72, 268); } c.save(); c.rect(x, 196, w, 72); c.clip(); c.stroke(); c.restore();
    frect(c, x, 192, w, 6, PLASTER.dark);
    frect(c, x, y, 8, 164, 'rgba(255,255,240,.3)'); frect(c, x + w - 20, y, 20, 164, 'rgba(40,40,20,.14)');
    srect(c, x, y, w, 164, OUT, 2);
    frect(c, 128, 180, 64, 88, '#2a2620'); frect(c, 134, 186, 52, 82, '#5a4632'); line(c, 160, 186, 160, 268, '#2a2620', 2);
    for (const by of [204, 236]) { frect(c, 134, by, 52, 4, '#2a2620'); fell(c, 142, by + 2, 2, 2, '#c9b27a'); fell(c, 178, by + 2, 2, 2, '#c9b27a'); }
    srect(c, 128, 180, 64, 88, OUT, 1.6);
    for (const wx of [70, 226]) { frect(c, wx, 122, 26, 22, '#2a2620'); for (let i = wx + 4; i < wx + 24; i += 6) frect(c, i, 124, 2.5, 18, '#8a8a80'); srect(c, wx, 122, 26, 22, OUT, 1.2); }
    takiMark(c, 160, 146, 22, '#2a2620', 5);
    roofHip(c, 24, -18, 272, 132, P.R, { hip: 0, rf: .3, seed: 71 + P.idx, moss: 4 });
    barrel(c, 22, 298, .9, '#5f6f68'); barrel(c, 300, 296, .8);
    for (let k = 0; k < 3; k++) { const sx = 238 + k * 16; fell(c, sx, 296, 9, 7, '#d8c89a'); fell(c, sx - 2, 292, 4, 2, '#f0e4c0'); c.beginPath(); c.ellipse(sx, 296, 9, 7, 0, 0, TAU); sk(c, OUT, 1); }
    chochin(c, 112, 196, .9, LANT);
    P.lamps.push([112, 196]);
  }
  function vMill(c, P) {
    // stone-lined millrace under the wheel
    frect(c, -10, 238, 178, 60, '#7f7e6c');
    frect(c, -4, 246, 166, 48, '#2f9c9c'); frect(c, -4, 246, 166, 8, 'rgba(10,50,60,.35)');
    c.strokeStyle = 'rgba(210,250,240,.6)'; c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i < 9; i++) { const sx = 4 + i * 18; c.moveTo(sx, 262 + (i % 3) * 9); c.lineTo(sx + 10, 262 + (i % 3) * 9); } c.stroke();
    srect(c, -10, 238, 178, 60, OUT, 1.6); srect(c, -4, 246, 166, 48, 'rgba(20,40,40,.6)', 1.2);
    stonePlinth(c, 120, 272, 196, 22);
    woodWall(c, 126, 156, 186, 116, { bay: 62, plaster: .3 });
    shoji(c, 244, 196, 46, 36, true); doorway(c, 172, 200, 50, 72, P.cl);
    roofHip(c, 104, -6, 216, 170, P.R, { thatch: true, hip: 48, rf: -.3, seed: 81 + P.idx, moss: 8 });
    // the wheel (vertical plane facing the viewer)
    const cx = 70, cy = 184, Rr = 76;
    post(c, cx + 2, cy, 260, 10, WOODD); line(c, cx, cy, 128, cy + 4, WOODD.deep, 7); line(c, cx, cy - 1, 128, cy + 3, WOODD.light, 2);
    c.beginPath(); c.arc(cx + 8, cy + 3, Rr, 0, TAU); sk(c, WOODD.deep, 9);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, x1 = cx + Math.cos(a) * (Rr - 6), y1 = cy + Math.sin(a) * (Rr - 6), x2 = cx + Math.cos(a) * (Rr + 10), y2 = cy + Math.sin(a) * (Rr + 10); line(c, x1, y1, x2, y2, OUT, 7); line(c, x1, y1, x2, y2, WOOD.base, 5); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2; line(c, cx, cy, cx + Math.cos(a) * Rr, cy + Math.sin(a) * Rr, OUT, 5); line(c, cx, cy, cx + Math.cos(a) * Rr, cy + Math.sin(a) * Rr, WOOD.light, 3); }
    c.beginPath(); c.arc(cx, cy, Rr, 0, TAU); sk(c, OUT, 8); c.beginPath(); c.arc(cx, cy, Rr, 0, TAU); sk(c, WOOD.base, 5); c.beginPath(); c.arc(cx, cy, Rr, Math.PI * .9, Math.PI * 1.6); sk(c, WOOD.hi, 1.6);
    c.beginPath(); c.arc(cx, cy, Rr * .4, 0, TAU); sk(c, OUT, 5); c.beginPath(); c.arc(cx, cy, Rr * .4, 0, TAU); sk(c, WOOD.base, 3);
    fell(c, cx, cy, 11, 11, WOODD.base); c.beginPath(); c.arc(cx, cy, 11, 0, TAU); sk(c, OUT, 1.5); fell(c, cx - 3, cy - 3, 4, 4, WOODD.light);
    // flume and falling water
    fpoly(c, [-30, 70, 52, 96, 52, 108, -30, 82], WOODD.base); poly(c, [-30, 70, 52, 96, 52, 108, -30, 82]); sk(c, OUT, 1.4);
    fpoly(c, [-30, 72, 52, 98, 52, 101, -30, 75], '#7fd6d0');
    c.fillStyle = 'rgba(200,245,240,.85)'; c.beginPath(); c.moveTo(48, 100); c.quadraticCurveTo(62, 112, 60, 140); c.lineTo(46, 142); c.quadraticCurveTo(46, 116, 40, 104); c.closePath(); c.fill();
    for (const [sx, sy, r] of [[34, 258, 12], [56, 254, 14], [80, 260, 10], [20, 262, 8]]) { fell(c, sx, sy, r, r * .6, 'rgba(240,255,252,.9)'); c.beginPath(); c.ellipse(sx, sy, r, r * .6, 0, 0, TAU); sk(c, 'rgba(60,140,150,.6)', 1); }
    for (let k = 0; k < 3; k++) { const sx = 250 + k * 18; fell(c, sx, 296, 9, 7, '#d8c89a'); c.beginPath(); c.ellipse(sx, 296, 9, 7, 0, 0, TAU); sk(c, OUT, 1); }
    fell(c, 150, 292, 18, 6, '#8a8a7a'); c.beginPath(); c.ellipse(150, 292, 18, 6, 0, 0, TAU); sk(c, OUT, 1.2); fell(c, 150, 290, 4, 1.6, '#5a5a4a');
    line(c, 196, 166, 196, 186, '#2e2a22', 1.2); chochin(c, 158, 196, .9, LANT);
    P.lamps.push([158, 196]);
  }

  // ------------------------------------------------------------------ foliage kit
  function clump(c, x, y, r, pal, R, o = {}) {
    const n = 5 + Math.floor(R() * 3), bl = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .6, d = r * (.32 + R() * .3); bl.push([x + Math.cos(a) * d, y + Math.sin(a) * d * .72, r * (.42 + R() * .2)]); }
    bl.push([x, y - r * .06, r * .56]);
    if (o.shadow) fell(c, x + r * .3, y + r * .55, r * 1.05, r * .38, 'rgba(10,30,15,.3)');
    for (const [bx, by, br] of bl) fell(c, bx, by, br + 2.6, br + 2.6, pal.out);
    for (const [bx, by, br] of bl) fell(c, bx, by, br, br, pal.dark);
    for (const [bx, by, br] of bl) fell(c, bx - br * .16, by - br * .22, br * .8, br * .74, pal.mid);
    for (const [bx, by, br] of bl) if (by < y + r * .15) fell(c, bx - br * .32, by - br * .4, br * .44, br * .36, pal.light);
    c.lineWidth = 1.5; c.strokeStyle = pal.hi; c.beginPath();
    for (let i = 0; i < n + 2; i++) { const a = R() * TAU, d = R() * r * .6, lx = x + Math.cos(a) * d - r * .15, ly = y + Math.sin(a) * d * .6 - r * .25; c.moveTo(lx + 3, ly - 1); c.arc(lx, ly, 3 + R() * 2.5, -.3, -Math.PI * .9, true); }
    c.stroke();
    c.strokeStyle = pal.deep; c.lineWidth = 1.2; c.beginPath();
    for (let i = 0; i < n; i++) { const a = R() * Math.PI, d = r * (.4 + R() * .4), lx = x + Math.cos(a) * d * .9, ly = y + Math.sin(a) * d * .55; c.moveTo(lx - 3, ly - 2); c.lineTo(lx, ly + 1); c.lineTo(lx + 3, ly - 2); }
    c.stroke();
  }
  function broadTree(c, ax, ay, s, seed, pal) {
    const R = rng(seed);
    fell(c, ax + 30 * s, ay + 2, 64 * s, 16 * s, 'rgba(15,40,20,.28)');
    const tr = new Path2D(); tr.moveTo(ax - 11 * s, ay); tr.quadraticCurveTo(ax - 5 * s, ay - 40 * s, ax - 12 * s, ay - 78 * s); tr.lineTo(ax + 10 * s, ay - 78 * s); tr.quadraticCurveTo(ax + 6 * s, ay - 40 * s, ax + 12 * s, ay); tr.closePath();
    celFill(c, tr, BARK.base, BARK.light, BARK.dark, { ld: 3 * s, dd: 4 * s }); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(tr);
    line(c, ax - 2 * s, ay - 52 * s, ax - 28 * s, ay - 84 * s, BARK.dark, 5 * s); line(c, ax + 3 * s, ay - 58 * s, ax + 28 * s, ay - 92 * s, BARK.dark, 5 * s);
    const cl = [[-34, -100, 34], [34, -106, 36], [0, -134, 40], [-20, -158, 30], [24, -152, 28], [-4, -92, 30], [44, -132, 24], [-44, -130, 24]];
    cl.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, r] of cl) clump(c, ax + (dx + (R() - .5) * 8) * s, ay + dy * s, r * s, pal, R);
  }
  function pineTree(c, ax, ay, s, seed) {
    const R = rng(seed), PK = { out: '#14281a', dark: '#22432a', mid: '#2f5d36', light: '#4c7f48', hi: '#79a96a' };
    fell(c, ax + 18 * s, ay + 1, 40 * s, 10 * s, 'rgba(15,35,20,.3)');
    c.beginPath(); c.moveTo(ax - 6 * s, ay); c.quadraticCurveTo(ax - 18 * s, ay - 46 * s, ax + 10 * s, ay - 96 * s);
    c.lineTo(ax + 16 * s, ay - 92 * s); c.quadraticCurveTo(ax - 4 * s, ay - 46 * s, ax + 7 * s, ay); c.closePath();
    c.fillStyle = '#5a4434'; c.fill(); sk(c, OUT, 1.4);
    line(c, ax - 6 * s, ay - 48 * s, ax - 34 * s, ay - 58 * s, '#5a4434', 3.5 * s); line(c, ax + 4 * s, ay - 70 * s, ax + 34 * s, ay - 78 * s, '#5a4434', 3.5 * s);
    const pads = [[-34, -62, 26, 10], [32, -82, 28, 10], [-6, -104, 24, 9], [8, -126, 16, 7], [36, -54, 15, 6], [-30, -90, 14, 6]];
    pads.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, rx, ry] of pads) {
      const x = ax + dx * s + (R() - .5) * 4 * s, y = ay + dy * s;
      const bl = [], nb = 4 + Math.floor(rx / 8);
      for (let k = 0; k < nb; k++) { const u = (k + .5) / nb * 2 - 1; bl.push([x + u * rx * s * .8, y + (R() - .3) * ry * s * .5 - (1 - u * u) * ry * s * .5, (ry * .8 + R() * ry * .4) * s]); }
      for (const [bx, b2, br] of bl) fell(c, bx, b2, br * 1.25 + 2, br + 2, PK.out);
      for (const [bx, b2, br] of bl) fell(c, bx, b2, br * 1.25, br, PK.dark);
      for (const [bx, b2, br] of bl) fell(c, bx - br * .2, b2 - br * .3, br * .95, br * .62, PK.mid);
      for (const [bx, b2, br] of bl) fell(c, bx - br * .4, b2 - br * .5, br * .5, br * .3, PK.light);
      c.strokeStyle = PK.hi; c.lineWidth = 1; c.beginPath(); for (const [bx, b2, br] of bl) for (let k = -1; k <= 1; k++) { c.moveTo(bx + k * br * .4, b2 - br * .2); c.lineTo(bx + k * br * .4 + k * 2, b2 - br * .75); } c.stroke();
    }
  }
  function leafSpray(c, x, y, dir, s, R) {
    for (let i = 0; i < 4; i++) {
      const a = (dir < 0 ? Math.PI - .35 : .35) + (R() - .5) * 1.1, L = (14 + R() * 10) * s;
      const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L * .6 + 5 * s;
      const p = new Path2D(); p.moveTo(x, y); p.quadraticCurveTo((x + ex) / 2 - 3 * s, (y + ey) / 2 - 4 * s, ex, ey); p.quadraticCurveTo((x + ex) / 2 + 3 * s, (y + ey) / 2 + 2 * s, x, y); p.closePath();
      c.fillStyle = R() < .5 ? '#4e8a32' : '#6aa83e'; c.fill(p); c.strokeStyle = '#1f3a16'; c.lineWidth = .9; c.stroke(p);
    }
  }
  function bamboo(c, ax, ay, s, seed) {
    const R = rng(seed);
    fell(c, ax + 14 * s, ay + 1, 38 * s, 9 * s, 'rgba(15,40,20,.28)');
    const st = []; for (let i = 0; i < 9; i++) st.push([(R() - .5) * 46 * s, (R() - .5) * 10 * s, (120 + R() * 70) * s, (R() - .5) * .26]);
    st.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, h, lean] of st) {
      const x0 = ax + dx, y0 = ay + dy, x1 = x0 + lean * h, y1 = y0 - h;
      line(c, x0, y0, x1, y1, '#24401a', 6.5 * s); line(c, x0, y0, x1, y1, '#7fae4a', 4.4 * s); line(c, x0 - 1.2 * s, y0, x1 - 1.2 * s, y1, '#b8dc7c', 1.4 * s);
      for (let t = .12; t < 1; t += .15) { const nx = x0 + (x1 - x0) * t, ny = y0 + (y1 - y0) * t; line(c, nx - 3 * s, ny, nx + 3 * s, ny, '#3d6a26', 1.6 * s); }
      for (let k = 0; k < 4; k++) { const t = .5 + R() * .5; leafSpray(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, R() < .5 ? -1 : 1, s, R); }
    }
  }
  function bush(c, ax, ay, s, pal, flowers, seed) {
    const R = rng(seed);
    fell(c, ax + 8 * s, ay, 30 * s, 8 * s, 'rgba(15,40,20,.3)');
    const bl = []; for (let i = 0; i < 7; i++) bl.push([ax + (R() - .5) * 40 * s, ay - 10 * s - R() * 18 * s, (9 + R() * 7) * s]);
    bl.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of bl) fell(c, x, y, r + 2, r + 2, pal.out);
    for (const [x, y, r] of bl) { fell(c, x, y, r, r * .9, pal.dark); fell(c, x - r * .2, y - r * .25, r * .72, r * .62, pal.mid); fell(c, x - r * .35, y - r * .4, r * .35, r * .28, pal.light); }
    if (flowers) for (let i = 0; i < 7; i++) {
      const [x, y, r] = bl[Math.floor(R() * bl.length)], fx = x + (R() - .5) * r, fy = y - r * .3 + (R() - .5) * r * .5;
      fell(c, fx, fy, 6 * s, 5 * s, flowers[0]); fell(c, fx - 1.5 * s, fy - 1.5 * s, 3.4 * s, 2.8 * s, flowers[1]);
      c.beginPath(); c.ellipse(fx, fy, 6 * s, 5 * s, 0, 0, TAU); sk(c, 'rgba(30,30,60,.45)', .9);
    }
  }
  function mossRock(c, x, y, r, seed, wet) {
    const R = rng(seed), n = 9, pts = [];
    for (let i = 0; i < n; i++) { const a = Math.PI + i / (n - 1) * Math.PI, rr = r * (.8 + R() * .3); pts.push([x + Math.cos(a) * rr * 1.15, y - 2 + Math.sin(a) * rr * .95]); }
    pts.push([x + r * 1.05, y + r * .1], [x, y + r * .24], [x - r * 1.05, y + r * .1]);
    if (!wet) fell(c, x + r * .45, y + r * .18, r * 1.25, r * .34, 'rgba(15,40,20,.3)');
    const p = pathFrom(pts);
    celFill(c, p, wet ? '#6d7a6c' : ROCK.base, ROCK.light, ROCK.dark, { ld: r * .25, dd: r * .35 });
    c.save(); c.clip(p);
    fell(c, x - r * .2, y - r * .85, r * .95, r * .42, 'rgba(92,148,58,.88)'); fell(c, x - r * .42, y - r * .98, r * .45, r * .18, 'rgba(165,210,100,.75)');
    if (wet) fell(c, x - r * .5, y - r * .3, r * .2, r * .12, 'rgba(255,255,255,.55)');
    c.restore();
    c.strokeStyle = ROCK.line; c.lineWidth = r > 18 ? 2 : 1.5; c.stroke(p);
    if (r > 14) { c.beginPath(); c.moveTo(x + r * .1, y - r * .55); c.lineTo(x + r * .25, y - r * .25); c.lineTo(x + r * .15, y); sk(c, 'rgba(35,45,30,.55)', 1.3); }
  }
  function waterRock(c, x, y, r, seed) {
    fell(c, x + 2, y + r * .16, r * 1.6, r * .52, 'rgba(235,252,248,.55)');
    c.beginPath(); c.ellipse(x + 2, y + r * .16, r * 1.6, r * .52, 0, 0, TAU); sk(c, 'rgba(255,255,255,.85)', 1.6);
    fell(c, x + 4, y + r * .2, r * 1.2, r * .34, 'rgba(10,60,65,.42)');
    mossRock(c, x, y, r, seed, true);
  }
  function reeds(c, ax, ay, s, seed) {
    const R = rng(seed);
    fell(c, ax + 4, ay, 22 * s, 6 * s, 'rgba(15,50,40,.3)');
    const bl = []; for (let i = 0; i < 16; i++) bl.push([(R() - .5) * 34 * s, (30 + R() * 36) * s, (R() - .5) * .8, R()]);
    bl.sort((a, b) => a[3] - b[3]);
    for (const [dx, h, lean, k] of bl) {
      const x0 = ax + dx, x1 = x0 + lean * h * .6, y1 = ay - h;
      c.beginPath(); c.moveTo(x0 - 1.8 * s, ay); c.quadraticCurveTo(x0 + lean * h * .2, ay - h * .5, x1, y1); c.quadraticCurveTo(x0 + lean * h * .2 + 2 * s, ay - h * .5, x0 + 1.8 * s, ay); c.closePath();
      c.fillStyle = k < .4 ? '#3f6e2c' : k < .8 ? '#5f9240' : '#8ab858'; c.fill(); c.strokeStyle = 'rgba(25,45,18,.8)'; c.lineWidth = .8; c.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const dx = (R() - .5) * 26 * s, h = (44 + R() * 22) * s, x = ax + dx;
      line(c, x, ay, x + 1, ay - h, '#4a6a2a', 1.6 * s);
      rrect(c, x - 2.6 * s, ay - h - 4 * s, 5.2 * s, 14 * s, 2.6 * s); c.fillStyle = '#6b4226'; c.fill(); sk(c, OUT, 1);
      line(c, x + 1, ay - h - 4 * s, x + 1, ay - h - 10 * s, '#4a6a2a', 1.2);
    }
  }
  function lilies(c, ax, ay, seed) {
    const R = rng(seed);
    for (let i = 0; i < 6; i++) {
      const x = ax + (R() - .5) * 70, y = ay + (R() - .5) * 26, r = 7 + R() * 7, a0 = R() * TAU;
      fell(c, x + 2, y + 2, r, r * .55, 'rgba(10,60,60,.3)');
      c.beginPath(); c.moveTo(x, y); c.ellipse(x, y, r, r * .55, 0, a0 + .35, a0 + TAU - .35); c.closePath();
      c.fillStyle = R() < .5 ? '#4f9a3e' : '#6ab04a'; c.fill(); c.strokeStyle = 'rgba(20,60,30,.85)'; c.lineWidth = 1.1; c.stroke();
      fell(c, x - r * .3, y - r * .18, r * .35, r * .14, 'rgba(190,235,140,.45)');
    }
    for (let i = 0; i < 2; i++) if (R() < .75) {
      const x = ax + (R() - .5) * 50, y = ay + (R() - .5) * 16, col = R() < .6 ? ['#f2a6c4', '#fbe0ea'] : ['#f6f2ea', '#ffffff'];
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; fell(c, x + Math.cos(a) * 4, y - 3 + Math.sin(a) * 2, 3.4, 2.2, col[0]); }
      fell(c, x, y - 4, 3, 2, col[1]); fell(c, x, y - 4, 1.4, 1.1, '#f2c94a');
    }
  }

  // ------------------------------------------------------------------ the giant tree of the Hero's Water (landmark)
  function root(c, x0, y0, ang, len, w, seed) {
    const R = rng(seed), dx = Math.cos(ang), dy = Math.sin(ang) * .5;
    const ex = x0 + dx * len, ey = y0 + dy * len + 6, mx = x0 + dx * len * .5 + (R() - .5) * 40, my = y0 + dy * len * .5 - 10 - R() * 16;
    const nx = -dy, ny = dx, L = Math.hypot(nx, ny) || 1, ux = nx / L, uy = ny / L;
    const p = new Path2D();
    p.moveTo(x0 + ux * w, y0 + uy * w - 6);
    p.quadraticCurveTo(mx + ux * w * .45, my + uy * w * .45 - 8, ex, ey);
    p.quadraticCurveTo(mx - ux * w * .45, my - uy * w * .45 + 6, x0 - ux * w, y0 - uy * w + 4);
    p.closePath();
    fell(c, (x0 + ex) / 2 + 10, (y0 + ey) / 2 + 12, len * .45, w * .5, 'rgba(15,35,20,.25)');
    celFill(c, p, BARK.base, BARK.light, BARK.dark, { ld: 5, dd: 7 });
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    c.save(); c.clip(p);
    c.strokeStyle = 'rgba(50,35,20,.45)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x0, y0 - 2); c.quadraticCurveTo(mx, my - 2, ex, ey); c.stroke();
    fell(c, mx - 6, my - 8, w * .5, w * .22, 'rgba(96,150,62,.75)');
    c.restore();
  }
  function lmTree(c, P) {
    const cx = 150, by = 196;
    fell(c, cx + 70, by - 30, 450, 130, 'rgba(15,45,25,.26)');
    // roots behind the trunk
    const back = [[-2.7, 230, 30], [-.45, 220, 28], [-1.9, 170, 24], [-1.2, 180, 24]];
    for (const [a, l, w] of back) root(c, cx, by - 30, a, l, w, Math.round(a * 100 + 500));
    // trunk
    const tp = new Path2D();
    tp.moveTo(cx - 168, by + 4);
    tp.bezierCurveTo(cx - 90, by - 10, cx - 70, by - 90, cx - 80, by - 190);
    tp.bezierCurveTo(cx - 88, by - 280, cx - 120, by - 330, cx - 170, by - 380);
    tp.lineTo(cx - 120, by - 400);
    tp.quadraticCurveTo(cx - 60, by - 360, cx - 30, by - 330);
    tp.quadraticCurveTo(cx - 10, by - 400, cx - 30, by - 450);
    tp.lineTo(cx + 26, by - 450);
    tp.quadraticCurveTo(cx + 20, by - 390, cx + 40, by - 330);
    tp.quadraticCurveTo(cx + 80, by - 370, cx + 150, by - 390);
    tp.lineTo(cx + 180, by - 364);
    tp.bezierCurveTo(cx + 120, by - 320, cx + 86, by - 270, cx + 82, by - 190);
    tp.bezierCurveTo(cx + 78, by - 90, cx + 100, by - 12, cx + 176, by + 6);
    tp.quadraticCurveTo(cx, by + 40, cx - 168, by + 4);
    tp.closePath();
    celFill(c, tp, BARK.base, BARK.light, BARK.dark, { ld: 20, dd: 30 });
    c.save(); c.clip(tp);
    const R = rng(4040);
    for (let i = 0; i < 26; i++) {
      const x = cx - 120 + i * 9.6 + (R() - .5) * 6, sw = (R() - .5) * 40;
      const p = new Path2D(); p.moveTo(x + sw * .3 + (x - cx) * .25, by + 10); p.bezierCurveTo(x - sw * .2, by - 120, x + sw, by - 230, x + (x - cx) * .5 + sw, by - 440);
      c.strokeStyle = 'rgba(40,28,16,.55)'; c.lineWidth = 2 + R() * 2.5; c.stroke(p);
      c.save(); c.translate(-3, 0); c.strokeStyle = 'rgba(220,180,130,.22)'; c.lineWidth = 1.4; c.stroke(p); c.restore();
    }
    for (const [kx, ky, kr] of [[cx - 40, by - 250, 14], [cx + 46, by - 170, 11], [cx - 10, by - 330, 9]]) { fell(c, kx, ky, kr + 4, kr * .7 + 4, BARK.dark); fell(c, kx + 1, ky + 1, kr, kr * .6, BARK.deep); c.beginPath(); c.ellipse(kx, ky, kr + 4, kr * .7 + 4, 0, 0, TAU); sk(c, OUT, 1.5); }
    for (let i = 0; i < 16; i++) { const mx = cx - 110 + R() * 90, my = by - 20 - R() * 380; fell(c, mx, my, 12 + R() * 22, 5 + R() * 9, 'rgba(92,148,58,.55)'); fell(c, mx - 4, my - 3, 6 + R() * 8, 2 + R() * 3, 'rgba(170,215,100,.45)'); }
    c.fillStyle = 'rgba(15,30,12,.35)'; c.fillRect(cx - 200, by - 470, 420, 70);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.stroke(tp);
    // hollow with the Hero's Water shrine
    const hp = new Path2D(); hp.moveTo(cx - 36, by + 2); hp.lineTo(cx - 34, by - 50); hp.quadraticCurveTo(cx - 30, by - 92, cx + 2, by - 98); hp.quadraticCurveTo(cx + 34, by - 92, cx + 38, by - 50); hp.lineTo(cx + 40, by + 4); hp.closePath();
    c.fillStyle = BARK.deep; c.fill(hp); c.save(); c.clip(hp);
    fell(c, cx + 2, by - 40, 50, 70, '#1d150d');
    fell(c, cx + 2, by - 14, 30, 22, 'rgba(110,230,215,.35)'); fell(c, cx + 2, by - 14, 18, 12, 'rgba(170,250,240,.55)');
    c.restore();
    c.strokeStyle = BARK.light; c.lineWidth = 3; c.stroke(hp); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(hp);
    // little hokora inside
    roofHip(c, cx - 22, by - 66, 48, 18, BOARD[0], { hip: 8, rf: .2, shadow: 4, moss: 0 });
    frect(c, cx - 16, by - 48, 36, 28, '#c8a46a'); frect(c, cx - 8, by - 44, 20, 24, '#3a2a1a'); srect(c, cx - 16, by - 48, 36, 28, OUT, 1.2);
    fell(c, cx + 2, by - 6, 22, 7, '#8a8a7a'); fell(c, cx + 2, by - 7, 17, 4.5, '#6fe0d2'); fell(c, cx - 3, by - 8, 6, 1.6, '#e8fffb'); c.beginPath(); c.ellipse(cx + 2, by - 6, 22, 7, 0, 0, TAU); sk(c, OUT, 1.2);
    // sacred rope (shimenawa) with paper streamers
    const ry = by - 150;
    c.beginPath(); c.moveTo(cx - 84, ry - 10); c.quadraticCurveTo(cx, ry + 34, cx + 88, ry - 10); sk(c, '#7a6230', 13);
    c.beginPath(); c.moveTo(cx - 84, ry - 10); c.quadraticCurveTo(cx, ry + 34, cx + 88, ry - 10); sk(c, '#d8c27a', 9);
    c.strokeStyle = '#8a7238'; c.lineWidth = 2; c.beginPath();
    for (let t = .04; t < 1; t += .06) { const [px, py] = quadPt(cx - 84, ry - 10, cx, ry + 34, cx + 88, ry - 10, t); c.moveTo(px - 4, py - 4); c.lineTo(px + 3, py + 4); } c.stroke();
    for (const t of [.2, .4, .6, .8]) {
      const [px, py] = quadPt(cx - 84, ry - 10, cx, ry + 34, cx + 88, ry - 10, t);
      fpoly(c, [px - 4, py + 4, px + 4, py + 4, px + 4, py + 12, px, py + 12, px, py + 20, px + 4, py + 20, px + 4, py + 30, px - 4, py + 30, px - 4, py + 22, px - 8 + 4, py + 22, px - 4, py + 14], '#f8f6ee');
      line(c, px - 4, py + 4, px - 4, py + 30, 'rgba(60,60,50,.5)', .8);
      for (let k = 0; k < 4; k++) line(c, px + 8 + k * 2, py + 4, px + 8 + k * 2, py + 14 + k, '#a88a42', 1.3);
    }
    // front roots over the ground
    const front = [[3.05, 250, 34], [.12, 260, 34], [2.35, 210, 30], [.82, 220, 30], [2.75, 140, 22], [.4, 150, 22]];
    for (const [a, l, w] of front) root(c, cx + Math.cos(a) * 60, by - 14, a, l, w, Math.round(a * 100 + 900));
    // limbs into the canopy (drawn under it)
    for (const [x1, y1, x2, y2, w] of [[cx - 150, by - 390, cx - 300, by - 470, 22], [cx + 165, by - 378, cx + 320, by - 450, 22], [cx - 2, by - 450, cx - 40, by - 560, 26], [cx - 60, by - 380, cx - 160, by - 560, 16], [cx + 60, by - 360, cx + 190, by - 560, 16]]) {
      line(c, x1, y1, x2, y2, OUT, w + 4); line(c, x1, y1, x2, y2, BARK.base, w); line(c, x1 - w * .25, y1, x2 - w * .25, y2, BARK.light, w * .25);
    }
    // canopy
    const CR = rng(777), cl = [];
    const ccx = cx + 10, ccy = by - 600, crx = 470, cry = 250;
    for (let j = 0; j < 6; j++) for (let i = 0; i < 9; i++) {
      const u = (i + .5 + (CR() - .5) * .6) / 9 * 2 - 1, v = (j + .5 + (CR() - .5) * .5) / 6 * 2 - 1;
      if (u * u + v * v > 1.02) continue;
      cl.push([ccx + u * crx, ccy + v * cry, 78 + CR() * 44, j]);
    }
    cl.push([ccx - 420, ccy + 120, 70, 6], [ccx + 430, ccy + 110, 74, 6], [ccx - 250, ccy + 230, 80, 6], [ccx + 240, ccy + 236, 84, 6], [ccx, ccy + 250, 90, 6], [ccx - 120, ccy + 270, 70, 7], [ccx + 120, ccy + 270, 72, 7]);
    cl.sort((a, b) => a[1] - b[1]);
    fell(c, ccx + 20, ccy + 60, crx + 40, cry + 60, LEAF[0].out);
    fell(c, ccx + 20, ccy + 60, crx + 30, cry + 50, LEAF[0].deep);
    for (const [x, y, r, j] of cl) clump(c, x, y, r, j < 2 ? LEAF[1] : j > 5 ? LEAF[0] : LEAF[CR() < .5 ? 0 : 1], CR);
    // hanging vines with leaves
    for (let i = 0; i < 16; i++) {
      const vx = ccx - 400 + i * 52 + (CR() - .5) * 20, top = ccy + cry * Math.sqrt(Math.max(0, 1 - Math.pow((vx - ccx) / (crx + 30), 2))) + 10, len = 40 + CR() * 110;
      if (Math.abs(vx - cx) < 110 && CR() < .6) continue;
      c.beginPath(); c.moveTo(vx, top); c.quadraticCurveTo(vx + 8, top + len * .5, vx - 4, top + len); sk(c, '#2c5a26', 2);
      for (let k = 0; k < len; k += 11) fell(c, vx + (k % 22 ? 4 : -3) + Math.sin(k) * 2, top + k + 4, 4, 2.6, k % 22 ? LEAF[0].mid : LEAF[0].light);
    }
    P.lamps.push([cx + 2, by - 20], [cx - 84, ry], [cx + 88, ry]);
  }

  // ------------------------------------------------------------------ ground tiles
  function wrapDraw(S, x, y, m, fn) { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { const X = x + ox, Y = y + oy; if (X < -m || X > S + m || Y < -m || Y > S + m) continue; fn(X, Y); } }
  function makeGrassTile(base, seed, dense) {
    const S = 512, cv = mk(S, S), c = cv.getContext('2d'), R = rng(seed);
    c.lineCap = 'round';
    frect(c, 0, 0, S, S, base);
    for (let i = 0; i < 30; i++) { const x = R() * S, y = R() * S, rx = 40 + R() * 110, ry = rx * (.35 + R() * .3), col = R() < .5 ? 'rgba(130,190,80,.2)' : 'rgba(25,60,25,.18)'; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, ry, col)); }
    for (let i = 0; i < 560; i++) {
      const x = R() * S, y = R() * S, h = 4 + R() * 7, dark = R() < .55;
      wrapDraw(S, x, y, 12, (X, Y) => {
        c.strokeStyle = dark ? 'rgba(28,66,26,.55)' : 'rgba(160,212,105,.5)'; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(X - 3, Y - h * .8); c.lineTo(X, Y); c.lineTo(X + 1, Y - h); c.moveTo(X, Y); c.lineTo(X + 4, Y - h * .7); c.stroke();
      });
    }
    if (!dense) for (let i = 0; i < 70; i++) { const x = R() * S, y = R() * S, col = ['#f4f1e0', '#f2d64a', '#e9a6c0', '#b8d8f0'][Math.floor(R() * 4)]; wrapDraw(S, x, y, 6, (X, Y) => { fell(c, X + .6, Y + .8, 2.2, 1.6, 'rgba(30,60,25,.4)'); fell(c, X, Y, 2, 1.5, col); }); }
    else for (let i = 0; i < 90; i++) { const x = R() * S, y = R() * S, r = 4 + R() * 6, col = R() < .5 ? 'rgba(120,90,50,.35)' : 'rgba(150,120,60,.3)'; wrapDraw(S, x, y, 12, (X, Y) => fell(c, X, Y, r, r * .5, col)); }
    for (let i = 0; i < 36; i++) { const x = R() * S, y = R() * S, r = 1.5 + R() * 2.5; wrapDraw(S, x, y, 6, (X, Y) => { fell(c, X + .8, Y + .8, r, r * .7, '#3d5a32'); fell(c, X, Y, r, r * .7, '#9a9a84'); fell(c, X - r * .3, Y - r * .3, r * .4, r * .3, '#d8d8c4'); }); }
    c.fillStyle = 'rgba(25,60,25,.25)'; for (let i = 0; i < 1200; i++) c.fillRect(R() * S, R() * S, 1.5, 1.5);
    c.fillStyle = 'rgba(190,230,140,.25)'; for (let i = 0; i < 700; i++) c.fillRect(R() * S, R() * S, 1.3, 1.3);
    return cv;
  }
  function makeDirtTile() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(515);
    frect(c, 0, 0, S, S, '#b5916a');
    for (let i = 0; i < 24; i++) { const x = R() * S, y = R() * S, rx = 20 + R() * 50, col = R() < .5 ? 'rgba(212,184,136,.32)' : 'rgba(120,85,50,.18)'; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, rx * .5, col)); }
    for (let i = 0; i < 90; i++) { const x = R() * S, y = R() * S, r = 1.2 + R() * 2.8, col = R() < .5 ? '#c9a77a' : '#9a7a52'; wrapDraw(S, x, y, 6, (X, Y) => { fell(c, X + .8, Y + .8, r, r * .7, '#7a5a3a'); fell(c, X, Y, r, r * .7, col); fell(c, X - r * .3, Y - r * .3, r * .4, r * .3, '#e8d4ae'); }); }
    c.fillStyle = 'rgba(90,60,30,.25)'; for (let i = 0; i < 500; i++) c.fillRect(R() * S, R() * S, 1.4, 1.4);
    return cv;
  }
  function makePaveTile() {
    const S = 192, RH = 24, cv = mk(S, S), c = cv.getContext('2d'), R = rng(77);
    const tones = ['#bdb9a3', '#b1ae97', '#c7c2aa', '#a9a890', '#b8b298'];
    frect(c, 0, 0, S, S, '#7c7a66');
    for (let row = 0; row < S / RH; row++) {
      const ws = []; let sum = 0; while (sum < S - 44) { const w = 22 + Math.floor(R() * 22); ws.push(w); sum += w; } ws.push(S - sum);
      let x = Math.floor(R() * 40);
      for (const w of ws) {
        const col = tones[Math.floor(R() * tones.length)], y = row * RH;
        for (const ox of [0, -S]) {
          const X = x + ox;
          rrect(c, X + 1.5, y + 1.5, w - 3, RH - 3, 4); c.fillStyle = col; c.fill();
          frect(c, X + 3, y + 2.5, w - 7, 1.5, 'rgba(255,255,240,.38)'); frect(c, X + 3, y + RH - 4, w - 6, 1.5, 'rgba(60,60,40,.22)');
        }
        x += w;
      }
    }
    for (let i = 0; i < 40; i++) { const x = R() * S, y = Math.floor(R() * 8) * RH; wrapDraw(S, x, y, 20, (X, Y) => frect(c, X, Y - 1, 8 + R() * 14, 3, 'rgba(90,140,60,.45)')); }
    return cv;
  }
  function makeWaterTile() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(6161);
    frect(c, 0, 0, S, S, '#2c9c9c');
    for (let i = 0; i < 12; i++) { const x = R() * S, y = R() * S, rx = 40 + R() * 40, col = R() < .5 ? 'rgba(30,120,130,.35)' : 'rgba(90,200,185,.22)'; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, rx * .3, col)); }
    c.lineCap = 'round';
    for (let i = 0; i < 36; i++) { const x = R() * S, y = R() * S, w = 10 + R() * 22, col = R() < .6 ? 'rgba(195,248,236,.45)' : 'rgba(20,95,105,.4)', lw = 1.5 + R(); wrapDraw(S, x, y, w + 4, (X, Y) => { c.beginPath(); c.moveTo(X - w, Y); c.quadraticCurveTo(X, Y - 4, X + w, Y); sk(c, col, lw); }); }
    return cv;
  }
  function makePlank(vert) {
    const S = 128, cv = mk(S, S), c = cv.getContext('2d'), R = rng(vert ? 41 : 43);
    frect(c, 0, 0, S, S, '#a8784a');
    for (let i = 0; i < 8; i++) { const sh = mix('#a8784a', R() < .5 ? '#c99c66' : '#7a5434', R() * .45); if (vert) frect(c, i * 16, 0, 16, S, sh); else frect(c, 0, i * 16, S, 16, sh); }
    c.strokeStyle = '#5a3a20'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 8; i++) { if (vert) { c.moveTo(i * 16, 0); c.lineTo(i * 16, S); } else { c.moveTo(0, i * 16); c.lineTo(S, i * 16); } } c.stroke();
    c.strokeStyle = 'rgba(255,230,180,.35)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 8; i++) { if (vert) { c.moveTo(i * 16 + 2, 0); c.lineTo(i * 16 + 2, S); } else { c.moveTo(0, i * 16 + 2); c.lineTo(S, i * 16 + 2); } } c.stroke();
    c.strokeStyle = 'rgba(80,50,25,.3)'; c.beginPath(); for (let i = 0; i < 30; i++) { const a = R() * S, b = R() * S, l = 10 + R() * 30; if (vert) { c.moveTo(a, b); c.lineTo(a, b + l); } else { c.moveTo(b, a); c.lineTo(b + l, a); } } c.stroke();
    for (let i = 0; i < 8; i++) { const j = 8 + Math.floor(R() * (S - 16)); if (vert) { frect(c, i * 16, j, 16, 2, '#5a3a20'); fell(c, i * 16 + 8, j - 5, 1.3, 1.3, '#3a2a1a'); fell(c, i * 16 + 8, j + 6, 1.3, 1.3, '#3a2a1a'); } else { frect(c, j, i * 16, 2, 16, '#5a3a20'); fell(c, j - 5, i * 16 + 8, 1.3, 1.3, '#3a2a1a'); fell(c, j + 6, i * 16 + 8, 1.3, 1.3, '#3a2a1a'); } }
    return cv;
  }
  function makeEmblem() {
    const W = 460, H = 300, cv = mk(W, H), c = cv.getContext('2d');
    c.translate(W / 2, H / 2); c.scale(1, .56); c.lineJoin = 'round';
    c.beginPath(); c.arc(0, 0, 210, 0, TAU); c.fillStyle = 'rgba(90,110,80,.2)'; c.fill();
    c.beginPath(); c.arc(0, 0, 210, 0, TAU); sk(c, 'rgba(70,80,60,.55)', 12);
    c.beginPath(); c.arc(0, 0, 196, 0, TAU); sk(c, 'rgba(255,250,230,.55)', 3);
    c.beginPath(); c.arc(0, 0, 150, 0, TAU); c.fillStyle = 'rgba(60,150,150,.35)'; c.fill(); sk(c, 'rgba(60,80,60,.6)', 7);
    takiMark(c, 0, 4, 100, 'rgba(40,60,50,.75)', 22);
    takiMark(c, -4, 0, 100, 'rgba(240,250,240,.75)', 12);
    for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; fell(c, Math.cos(a) * 178, Math.sin(a) * 178, 7, 7, 'rgba(70,90,60,.4)'); }
    return cv;
  }

  // ------------------------------------------------------------------ lake / island geometry
  function lakePt(th) {
    const c = Math.cos(th), s = Math.sin(th), w = 1 + .03 * Math.sin(3 * th + .7) + .02 * Math.sin(5 * th + 2.1) + .012 * Math.sin(11 * th + .4);
    const x = LAKE.cx + LAKE.rx * Math.sign(c) * Math.pow(Math.abs(c), .77) * w;
    const y = s < 0 ? LAKE.cy - LAKE.ryN * Math.pow(-s, .625) * w : LAKE.cy + LAKE.ryS * Math.pow(s, .909) * w;
    return [x, y];
  }
  function islePt(th) {
    const w = 1 + .05 * Math.sin(3 * th + 1) + .03 * Math.sin(7 * th + .5);
    return [ISLE.cx + ISLE.rx * Math.cos(th) * w, ISLE.cy + ISLE.ry * Math.sin(th) * w];
  }
  let HC = null, LAKEP = null, ISLEP = null, LAKEPTS = null;
  const inP = (p, x, y) => HC.isPointInPath(p, x, y);
  const OFFS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]];
  const allIn = (p, x, y, m) => OFFS.every(([a, b]) => inP(p, x + a * m, y + b * m));
  const anyIn = (p, x, y, m) => OFFS.some(([a, b]) => inP(p, x + a * m, y + b * m));
  const inLake = (x, y, m = 0) => allIn(LAKEP, x, y, m) && !anyIn(ISLEP, x, y, m);   // open water
  const onBank = (x, y, m = 0) => !anyIn(LAKEP, x, y, m);

  // ------------------------------------------------------------------ cliff ring (N / W / E cliffs, S palisade)
  const yN = x => -34 + 30 * wv(x, 1);                       // north cliff lip
  const yNb = x => 398 - 9 * wv(x, 2);                       // north cliff foot
  const xW = y => 342 + 24 * wv(y, 3), xWb = y => 399 - 7 * wv(y, 6);
  const xE = y => 3298 - 24 * wv(y, 4), xEb = y => 3241 + 7 * wv(y, 7);
  const ySt = x => 3246 + 8 * wv(x, 5);                      // south strip inner edge
  const yP = x => 3300 + 5 * wv(x, 9);                       // palisade foot
  // organic outer silhouette: perimeter art spills 30..140 px beyond the square (periodic per block so wall tiles can be shared)
  const oEdge = (t, s) => clamp(30 + 64 * wv(t, s) + 34 * wv(t * 2, s + 5) + 12 * wv(t * 4, s + 9), 30, 140);
  const oN = x => -oEdge(x, 21), oS = x => SIZE + oEdge(x, 22), oW = y => -oEdge(y, 23), oE = y => SIZE + oEdge(y, 24);
  const fun = y => Math.max(0, 150 * Math.pow(clamp((y - 3330) / 450, 0, 1), 1.4) + 10 * Math.sin(y * .045));   // gate funnel widening outwards
  const RTOP = -100;                                         // river head (hidden under trees)
  const rvT = y => clamp((-26 - y) / 140, 0, 1);
  const rvL = y => WF.L + 150 * rvT(y) + 10 * Math.sin(y * .03);
  const rvR = y => WF.R - 150 * rvT(y) + 10 * Math.sin(y * .027 + 1);
  const FACE = { L: '#a7b29c', M: '#7e8a77', D: '#56614f', deep: '#3e4739', line: '#2a3026' };
  let TOP = null, FEAT = null, COLS = null, BEV = null;

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
  function topPolygon() {
    const P = [], st = 8;
    P.push([oW(SIZE) * .7, SIZE + (oS(0) - SIZE) * .7]);
    for (let y = SIZE; y >= 0; y -= st) P.push([oW(y), y]);
    P.push([oW(0) * .7, oN(0) * .7]);
    for (let x = 0; x <= SIZE; x += st) P.push([x, oN(x)]);
    P.push([SIZE + (oE(0) - SIZE) * .7, oN(SIZE) * .7]);
    for (let y = 0; y <= SIZE; y += st) P.push([oE(y), y]);
    P.push([SIZE + (oE(SIZE) - SIZE) * .7, SIZE + (oS(SIZE) - SIZE) * .7]);
    for (let x = SIZE; x >= 3304; x -= st) P.push([x, oS(x)]);
    for (let y = oS(3300); y > 0; y -= st) P.push([xE(y), y]);
    for (let x = Math.floor(xE(0) / st) * st; x >= xW(0); x -= st) P.push([x, yN(x)]);
    for (let y = 0; y <= oS(340); y += st) P.push([xW(y), y]);
    for (let x = 336; x >= 0; x -= st) P.push([x, oS(x)]);
    return pathFrom(P);
  }
  function lipPath() {
    const p = new Path2D(), st = 8;
    p.moveTo(xE(oS(3300)), oS(3300));
    for (let y = Math.floor(oS(3300) / st) * st; y > 0; y -= st) p.lineTo(xE(y), y);
    for (let x = Math.floor(xE(0) / st) * st; x >= xW(0); x -= st) p.lineTo(x, yN(x));
    for (let y = 0; y <= oS(340); y += st) p.lineTo(xW(y), y);
    return p;
  }
  // south forest strip, one piece either side of the gate; the inner ends open into a funnel towards the world road
  function stripPath(side) {
    const p = new Path2D(), st = 8;
    if (side === 0) {
      p.moveTo(390, ySt(390)); for (let x = 392; x <= GL; x += st) p.lineTo(x, ySt(x));
      let x = GL; for (let y = ySt(GL); y < SIZE + 200; y += st) { x = GL - fun(y); if (y >= oS(x) - 2) break; p.lineTo(x, y); }
      for (let xx = Math.floor(x / st) * st; xx >= 390; xx -= st) p.lineTo(xx, oS(xx));
    } else {
      p.moveTo(3250, ySt(3250)); for (let x = 3248; x >= GR; x -= st) p.lineTo(x, ySt(x));
      let x = GR; for (let y = ySt(GR); y < SIZE + 200; y += st) { x = GR + fun(y); if (y >= oS(x) - 2) break; p.lineTo(x, y); }
      for (let xx = Math.ceil(x / st) * st; xx <= 3250; xx += st) p.lineTo(xx, oS(xx));
    }
    p.closePath(); return p;
  }
  // ground outside the gate: grass and a dirt road blending into the world's 146 px road, faded at the outer edge
  function gateApron(c, X0, Y0, X1, Y1) {
    const tc = mk(X1 - X0, Y1 - Y0), g = tc.getContext('2d');
    g.translate(-X0, -Y0);
    const xa = 1380, xb = 2260, p = new Path2D();
    p.moveTo(xa, 3600); p.lineTo(xb, 3600); for (let x = xb; x >= xa; x -= 8) p.lineTo(x, oS(x) - 4); p.closePath();
    g.fillStyle = A.grassPat; g.fill(p);
    const rp = new Path2D(); rp.moveTo(1745, 3600);
    for (let y = 3600; y <= 3820; y += 10) rp.lineTo(1747 + 5 * Math.sin(y * .09), y);
    for (let y = 3820; y >= 3600; y -= 10) rp.lineTo(1893 + 5 * Math.sin(y * .07 + 1), y);
    rp.closePath();
    g.save(); g.clip(p); g.strokeStyle = 'rgba(70,55,30,.35)'; g.lineWidth = 10; g.stroke(rp); g.fillStyle = A.dirtPat; g.fill(rp); g.restore();
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createLinearGradient(0, 3650, 0, 3790); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr; g.fillRect(xa - 10, 3640, xb - xa + 20, 200);
    c.drawImage(tc, X0, Y0);
  }
  function fallPath() {
    const p = new Path2D(), L = WF.L, Rr = WF.R;
    p.moveTo(L, yN(L)); for (let x = L + 8; x <= Rr; x += 8) p.lineTo(x, yN(x));
    p.lineTo(Rr + 26, yNb(Rr + 26) + 16);
    for (let x = Rr + 24; x >= L - 24; x -= 8) p.lineTo(x, yNb(x) + 16 + 4 * Math.sin(x * .05));
    p.closePath();
    return p;
  }
  function trickPath(x, hw) {
    const p = new Path2D();
    p.moveTo(x - hw, yN(x - hw) + 2); p.lineTo(x + hw, yN(x + hw) + 2); p.lineTo(x + hw + 6, yNb(x) + 12); p.lineTo(x - hw - 6, yNb(x) + 12); p.closePath();
    return p;
  }
  function genFeatures() {
    COLS = []; { const R = rng(4711); let u = 0; while (u < BLOCK - 40) { const w = 50 + R() * 80; COLS.push({ u0: u, u1: Math.min(BLOCK, u + w), ph: R() * TAU, top: R() < .4 ? R() * .45 : 0, sl: (R() - .5) * .08 }); u += w; } COLS[COLS.length - 1].u1 = BLOCK; }
    BEV = []; { const R = rng(4712); let v = 0; while (v < BLOCK - 40) { const h = 44 + R() * 50; BEV.push([v, Math.min(BLOCK, v + h), R()]); v += h; } BEV[BEV.length - 1][1] = BLOCK; }
    FEAT = { N: [], W: [], E: [], S: [], moss: [], vines: [], tN: [], tW: [], tE: [] };
    const fill = (list, seed, uf, vf, nu, nv, r0) => {
      const R = rng(seed);
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const t = R();
        list.push({ t: t < .18 ? 'p' : 'c', u: uf((i + .5 + (R() - .5) * .8) / nu), v: vf((j + .5 + (R() - .5) * .7) / nv), r: r0 * (.75 + R() * .55), k: R(), s: Math.floor(R() * 1e6) });
      }
      list.sort((a, b) => a.v - b.v);
    };
    fill(FEAT.N, 11, r => r * BLOCK, r => -150 + r * 120, 8, 3, 46);
    fill(FEAT.W, 13, r => -150 + r * 470, r => r * BLOCK, 6, 8, 46);
    fill(FEAT.E, 14, r => 3320 + r * 470, r => r * BLOCK, 6, 8, 46);
    { const R = rng(17); for (let i = 0; i < 140; i++) { const t = R(); FEAT.S.push({ t: t < .3 ? 'b' : t < .45 ? 'r' : t < .75 ? 'c' : 'p', u: 400 + R() * 2840, v: 3340 + R() * 460, r: 30 + R() * 30, k: R(), s: Math.floor(R() * 1e6) }); } }
    FEAT.S.forEach(f => { if (f.t === 'c' || f.t === 'p') f.v = Math.max(f.v, 3560); if (f.t === 'b') f.v = Math.min(f.v, 3600); });
    FEAT.S.sort((a, b) => a.v - b.v);
    { const R = rng(19); for (let i = 0; i < 26; i++) FEAT.moss.push({ u: R() * BLOCK, t: R(), r: 10 + R() * 22, k: R() }); }
    { const R = rng(23); for (let i = 0; i < 12; i++) FEAT.vines.push({ u: R() * BLOCK, len: 50 + R() * 170, k: R() }); }
    const edge = (seed, n) => { const R = rng(seed), L = []; for (let i = 0; i < n; i++) L.push({ t: R() < .2 ? 'p' : 'c', w: (i + R() * .7) / n * BLOCK, r: 24 + R() * 22, d: R(), k: R(), s: Math.floor(R() * 1e6) }); return L; };
    FEAT.eN = edge(31, 11); FEAT.eW = edge(32, 11); FEAT.eE = edge(33, 11);
    const R = rng(29);
    for (let i = 0; i < 6; i++) FEAT.tN.push({ u: R() * BLOCK, r: 8 + R() * 14, d: 2 + R() * 14, s: Math.floor(R() * 1e6) });
    for (let i = 0; i < 4; i++) FEAT.tW.push({ v: R() * BLOCK, r: 8 + R() * 12, d: 6 + R() * 12, s: Math.floor(R() * 1e6) });
    for (let i = 0; i < 4; i++) FEAT.tE.push({ v: R() * BLOCK, r: 8 + R() * 12, d: 6 + R() * 12, s: Math.floor(R() * 1e6) });
  }
  function rockFace(c, path, a, b, f0, f1) {
    let y0 = 1e9, y1 = -1e9; for (let x = a; x <= b; x += 16) { y0 = Math.min(y0, f0(x)); y1 = Math.max(y1, f1(x)); }
    c.save(); c.clip(path);
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, FACE.L); g.addColorStop(.3, FACE.M); g.addColorStop(1, FACE.D);
    c.fillStyle = g; c.fillRect(a - 10, y0 - 10, b - a + 20, y1 - y0 + 20);
    for (let k = Math.floor(a / BLOCK) - 1; k * BLOCK < b + BLOCK; k++) for (const col of COLS) {
      const x0 = k * BLOCK + col.u0, x1 = k * BLOCK + col.u1, w = x1 - x0;
      if (x1 < a - 20 || x0 > b + 20) continue;
      c.fillStyle = 'rgba(240,250,225,.16)'; c.fillRect(x0, y0, w * .32, y1 - y0);
      c.fillStyle = 'rgba(20,35,20,.18)'; c.fillRect(x1 - w * .26, y0, w * .26, y1 - y0);
      const gy0 = y0 + col.top * (y1 - y0), gp = new Path2D(); gp.moveTo(x1, gy0); for (let y = gy0; y <= y1 + 12; y += 12) gp.lineTo(x1 + 4 * Math.sin(y * .045 + col.ph) + (y - gy0) * col.sl, y);
      c.strokeStyle = 'rgba(25,35,22,.55)'; c.lineWidth = 2.4; c.stroke(gp);
      c.save(); c.translate(-3, 0); c.strokeStyle = 'rgba(220,235,200,.3)'; c.lineWidth = 1.2; c.stroke(gp); c.restore();
    }
    const TS = [0, .22, .45, .66, .84, 1.02], s8 = Math.floor(a / 8) * 8;
    const sy = (j, x) => j === 0 ? f0(x) - 4 : j === TS.length - 1 ? f1(x) + 4 : f0(x) + (f1(x) - f0(x)) * TS[j] + 7 * Math.sin(TAU * x * 2 / BLOCK + j * 1.9) + 3 * Math.sin(TAU * x * 5 / BLOCK + j);
    for (let j = 1; j < TS.length - 1; j++) {
      const sp = new Path2D();
      for (let x = s8; x <= b + 8; x += 8) x === s8 ? sp.moveTo(x, sy(j, x)) : sp.lineTo(x, sy(j, x));
      c.strokeStyle = 'rgba(30,40,25,.5)'; c.lineWidth = j % 2 ? 3 : 2; c.stroke(sp);
      c.save(); c.translate(0, 3); c.strokeStyle = 'rgba(225,235,205,.4)'; c.lineWidth = 1.4; c.stroke(sp); c.restore();
      // moss cushions sitting on the ledge
      for (let k = Math.floor(a / BLOCK) - 1; k * BLOCK < b + BLOCK; k++) for (const m of FEAT.moss) {
        if (Math.floor(m.t * 4) !== j - 1) continue;
        const x = k * BLOCK + m.u; if (x < a - 30 || x > b + 30) continue;
        const y = sy(j, x);
        fell(c, x + 2, y + 3, m.r * 1.15, m.r * .42, 'rgba(25,45,20,.5)');
        fell(c, x, y, m.r, m.r * .4, m.k < .5 ? '#5f9440' : '#4f8436'); fell(c, x - m.r * .3, y - m.r * .12, m.r * .5, m.r * .16, '#9ccb68');
        c.strokeStyle = '#3f7a30'; c.lineWidth = 1.6; c.beginPath(); for (let q = 0; q < 5; q++) { const qx = x - m.r * .75 + q * m.r * .37; c.moveTo(qx, y + 2); c.quadraticCurveTo(qx + 3, y + 8, qx + 1, y + 10 + ((q * 7 + (m.k * 10 | 0)) % 5) * 4); } c.stroke();
      }
    }
    // wet, darker rock beside the falls
    for (const [x, hw] of [[(WF.L + WF.R) / 2, (WF.R - WF.L) / 2 + 110], [TRK[0][0], 60], [TRK[1][0], 60]]) if (x + hw > a && x - hw < b) { c.fillStyle = 'rgba(20,45,45,.22)'; c.fillRect(x - hw, y0, hw * 2, y1 - y0); }
    c.fillStyle = 'rgba(20,30,15,.36)'; c.fill(bandH(f0, x => f0(x) + 16, a, b));
    c.fillStyle = 'rgba(20,30,15,.22)'; c.fill(bandH(x => f1(x) - 24, f1, a, b));
    c.restore();
    // hanging vines from the lip
    for (let k = Math.floor(a / BLOCK) - 1; k * BLOCK < b + BLOCK; k++) for (const v of FEAT.vines) {
      const x = k * BLOCK + v.u; if (x < a - 10 || x > b + 10 || (x > WF.L - 30 && x < WF.R + 30)) continue;
      const y = f0(x) + 2;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y + v.len * .5, x - 4, y + v.len); sk(c, '#2a5224', 2);
      for (let q = 6; q < v.len; q += 10) fell(c, x + (q % 20 ? 4 : -3) + Math.sin(q * .1) * 3, y + q, 4.2, 2.6, q % 20 ? '#4f8a3a' : '#7ab34e');
    }
    c.strokeStyle = FACE.line; c.lineWidth = 2.2; c.stroke(path);
  }
  function bevel(c, path, lit, a, b, edge) {
    c.save(); c.clip(path);
    c.fillStyle = lit ? FACE.M : FACE.deep; c.fillRect(-300, a - 10, SIZE + 600, b - a + 20);
    for (let k = Math.floor(a / BLOCK) - 1; k * BLOCK < b + BLOCK; k++) for (const [v0, v1, q] of BEV) {
      const y0 = v0 + k * BLOCK, y1 = v1 + k * BLOCK, ym = (y0 + y1) / 2;
      if (y1 < a - 10 || y0 > b + 10) continue;
      const ex = edge(ym), bp = new Path2D(); bp.ellipse(ex, ym, 44, (y1 - y0) * .56, 0, 0, TAU);
      celFill(c, bp, lit ? FACE.L : FACE.D, lit ? '#c3ccb4' : FACE.M, lit ? FACE.D : FACE.deep, { ld: 6, dd: 9 });
      c.strokeStyle = 'rgba(25,35,20,.7)'; c.lineWidth = 1.6; c.stroke(bp);
      if (q > .5) { fell(c, ex - 18, ym - (y1 - y0) * .3, 16, 7, 'rgba(92,148,58,.8)'); fell(c, ex - 22, ym - (y1 - y0) * .34, 7, 3, 'rgba(165,210,100,.7)'); }
    }
    c.restore();
    c.strokeStyle = FACE.line; c.lineWidth = 2; c.stroke(path);
  }
  function canopyTop(c, f, x, y) {
    const R = rng(f.s);
    if (f.t === 'p') {
      const PK = ['#14281a', '#22432a', '#2f5d36', '#4c7f48'];
      fell(c, x + f.r * .35, y + f.r * .3, f.r * .9, f.r * .4, 'rgba(5,20,10,.35)');
      for (let l = 0; l < 4; l++) {
        const rr = f.r * (1 - l * .22), pts = [];
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, q = i % 2 ? .72 : 1; pts.push([x - l * 3 + Math.cos(a) * rr * q, y - l * 5 + Math.sin(a) * rr * q * .7]); }
        const p = pathFrom(pts); c.fillStyle = PK[l]; c.fill(p); if (l === 0) { c.strokeStyle = PK[0]; c.lineWidth = 2; c.stroke(p); }
      }
    } else clump(c, x, y, f.r, LEAF[f.k < .45 ? 0 : f.k < .8 ? 1 : 2], R, { shadow: true });
  }
  function palisade(c, a, b) {
    const k0 = Math.floor(a / 20) - 1, k1 = Math.ceil(b / 20) + 1;
    c.fillStyle = 'rgba(15,30,12,.35)'; c.fill(bandH(x => yP(x) - 6, x => yP(x) + 12, a - 20, b + 20));
    for (let k = k0; k <= k1; k++) {
      const x = k * 20, km = ((k % 26) + 26) % 26;
      if ((x > GL - 2 && x < GR + 2) || x < 396 || x > 3244) continue;
      const base = yP(x), h = 96 + 24 * hash2(km, 3, 9), top = base - h, w = 11;
      const p = pathFrom([[x - w, base], [x - w, top + 12], [x, top - 4], [x + w, top + 12], [x + w, base]]);
      celFill(c, p, '#8a6440', '#b48c5c', '#5e4228', { ld: 4, dd: 6 });
      c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(p);
      line(c, x - 5, top + 4, x - 5, base - 4, 'rgba(60,40,20,.35)', 1);
      fell(c, x - 3, base - 10, 6, 4, 'rgba(92,148,58,.6)');
    }
    for (const yo of [30, 74]) {
      const rp = new Path2D(); let first = true;
      for (let x = Math.floor((a - 20) / 8) * 8; x <= b + 20; x += 8) { if ((x > GL - 12 && x < GR + 12) || x < 390 || x > 3250) { first = true; continue; } const y = yP(x) - yo; first ? rp.moveTo(x, y) : rp.lineTo(x, y); first = false; }
      c.strokeStyle = '#4a3a20'; c.lineWidth = 6; c.stroke(rp); c.strokeStyle = '#c7ae72'; c.lineWidth = 3.5; c.stroke(rp);
    }
  }
  function drawStripFeat(c, f, x, y) {
    if (f.t === 'b') bush(c, x, y, f.r / 34, LEAF[f.k < .5 ? 0 : 2], f.k > .8 ? HYDR[Math.floor(f.k * 10) % 3] : null, f.s);
    else if (f.t === 'r') mossRock(c, x, y, f.r * .6, f.s);
    else if (f.t === 'c') broadTree(c, x, y, .8 + f.r / 100, f.s, LEAF[f.k < .5 ? 0 : 1]);
    else pineTree(c, x, y, .9 + f.r / 120, f.s);
  }
  // Draw everything of the perimeter that touches [X0,X1]x[Y0,Y1].
  function drawRing(c, X0, Y0, X1, Y1) {
    const a = X0 - 24, b = X1 + 24;
    const SH = 'rgba(10,35,25,.28)';
    if (Y0 < 450 && b > 380 && a < 3260) { c.fillStyle = SH; c.fill(bandH(yNb, x => yNb(x) + 34, Math.max(a, 380), Math.min(b, 3260))); }
    if (X0 < 450) { const s = Math.max(Y0 - 24, 396), e = Math.min(Y1 + 24, 3250); if (e > s) { c.fillStyle = SH; c.fill(bandV(xWb, y => xWb(y) + 30, s, e)); } }
    // north face + falls
    if (Y0 < 404 && b > 300 && a < 3340) {
      const s = Math.max(a, 300), e = Math.min(b, 3340);
      rockFace(c, bandH(yN, yNb, s, e), s, e, yN, yNb);
      if (e > WF.L - 40 && s < WF.R + 40) {
        c.save(); c.fillStyle = A.fallGrad; c.fill(A.fallP); c.clip(A.fallP);
        for (const bd of A.fallBands) { if (bd.x + bd.w < s - 10 || bd.x > e + 10) continue; c.fillStyle = bd.col; c.fillRect(bd.x, -60, bd.w, 480); }
        for (const st of A.fallStreaks) { if (st.x < s - 10 || st.x > e + 10) continue; c.beginPath(); c.moveTo(st.x, st.y0); c.quadraticCurveTo(st.x + st.b, (st.y0 + st.y1) / 2, st.x + st.b * .5, st.y1); sk(c, st.col, st.w); }
        c.fillStyle = 'rgba(245,255,252,.9)'; c.fill(bandH(x => yN(x) - 2, x => yN(x) + 13 + 5 * Math.sin(x * .07), WF.L - 8, WF.R + 8));
        c.fillStyle = 'rgba(30,110,120,.3)'; c.fill(bandH(x => yN(x) + 13 + 5 * Math.sin(x * .07), x => yN(x) + 22 + 5 * Math.sin(x * .07), WF.L - 8, WF.R + 8));
        c.fillStyle = 'rgba(20,80,90,.28)'; c.fillRect(WF.L - 30, -60, 46, 480); c.fillRect(WF.R - 24, -60, 54, 480);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(WF.L - 30, -60, 6, 480);
        const sp = c.createLinearGradient(0, 230, 0, 410); sp.addColorStop(0, 'rgba(240,255,252,0)'); sp.addColorStop(1, 'rgba(240,255,252,.7)');
        c.fillStyle = sp; c.fillRect(WF.L - 40, 230, WF.R - WF.L + 80, 190);
        c.restore();
        c.strokeStyle = 'rgba(25,85,90,.55)'; c.lineWidth = 2; c.stroke(A.fallP);
      }
      for (const [tx, hw] of TRK) if (e > tx - hw - 20 && s < tx + hw + 20) {
        const tp = trickPath(tx, hw);
        c.save(); c.fillStyle = A.fallGrad; c.fill(tp); c.clip(tp);
        for (let i = 0; i < 9; i++) { const x = tx - hw + (i + .5) * hw * 2 / 9; line(c, x, yN(x) + (i % 3) * 30, x + 2, yNb(x), i % 2 ? 'rgba(255,255,255,.55)' : 'rgba(30,120,130,.3)', 2 + (i % 3)); }
        c.restore(); c.strokeStyle = 'rgba(25,85,90,.55)'; c.lineWidth = 1.5; c.stroke(tp);
      }
    }
    // west / east bevels
    if (X0 < 410) { const s = Math.max(Y0 - 24, 392), e = Math.min(Y1 + 24, oS(372) - 2); if (e > s) bevel(c, bandV(xW, xWb, s, e), false, s, e, xW); }
    if (X1 > 3230) { const s = Math.max(Y0 - 24, 392), e = Math.min(Y1 + 24, oS(3268) - 2); if (e > s) bevel(c, bandV(xEb, xE, s, e), true, s, e, xE); }
    // talus at the feet
    for (let k = Math.floor(X0 / BLOCK) - 1; k * BLOCK < X1 + BLOCK; k++) if (Y0 < 450) for (const t of FEAT.tN) {
      const x = t.u + k * BLOCK; if (x < a || x > b || x < 430 || x > 3210 || (x > WF.L - 50 && x < WF.R + 50)) continue;
      const y = yNb(x) + t.d;
      if (x > 1000 && x < 2640) waterRock(c, x, y, t.r, t.s); else mossRock(c, x, y, t.r, t.s);
    }
    for (let k = Math.floor(Y0 / BLOCK) - 1; k * BLOCK < Y1 + BLOCK; k++) {
      if (X0 < 450) for (const t of FEAT.tW) { const y = t.v + k * BLOCK; if (y > Y0 - 24 && y < Y1 + 24 && y > 440 && y < 3200) mossRock(c, xWb(y) + t.d, y, t.r, t.s); }
      if (X1 > 3190) for (const t of FEAT.tE) { const y = t.v + k * BLOCK; if (y > Y0 - 24 && y < Y1 + 24 && y > 440 && y < 3200) mossRock(c, xEb(y) - t.d, y, t.r, t.s); }
    }
    // plateau top
    const needTop = Y0 < 60 || X0 < 400 || X1 > 3240;
    if (needTop) {
      c.fillStyle = '#2c4d2a'; c.fill(TOP);
      c.save(); c.clip(TOP);
      c.fillStyle = A.forestPat; c.globalAlpha = .55; c.fill(TOP); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(10,25,10,.35)'; c.lineWidth = 16; c.stroke(TOP);
      c.strokeStyle = 'rgba(15,30,12,.45)'; c.lineWidth = 34; c.stroke(A.lip);
      c.strokeStyle = '#5f8f42'; c.lineWidth = 18; c.stroke(A.lip);
      c.strokeStyle = 'rgba(190,225,130,.6)'; c.lineWidth = 5; c.stroke(A.lip);
      c.restore();
      c.strokeStyle = 'rgba(20,35,15,.6)'; c.lineWidth = 1.5; c.stroke(TOP);
      c.strokeStyle = FACE.line; c.lineWidth = 2.6; c.stroke(A.lip);
      // the river feeding the falls
      if (Y0 < 10 && b > WF.L - 60 && a < WF.R + 60) {
        const rp = new Path2D(); rp.moveTo(rvL(RTOP), RTOP);
        for (let y = RTOP + 8; y < yN(WF.L); y += 8) rp.lineTo(rvL(y), y);
        for (let x = WF.L; x <= WF.R; x += 8) rp.lineTo(x, yN(x) + 1);
        for (let y = yN(WF.R); y > RTOP; y -= 8) rp.lineTo(rvR(y), y);
        for (let x = rvR(RTOP); x > rvL(RTOP); x -= 8) rp.lineTo(x, RTOP + 6 * Math.sin(x * .03));
        rp.closePath();
        c.strokeStyle = '#3f4a36'; c.lineWidth = 16; c.stroke(rp);
        c.strokeStyle = '#8a8a70'; c.lineWidth = 8; c.stroke(rp);
        c.fillStyle = A.waterPat; c.fill(rp);
        c.save(); c.clip(rp);
        c.fillStyle = 'rgba(150,230,220,.25)'; c.fillRect(WF.L - 20, -180, WF.R - WF.L + 40, 180);
        const R = rng(66); c.lineCap = 'round';
        for (let i = 0; i < 70; i++) { const x = WF.L + R() * (WF.R - WF.L), y = RTOP + R() * 80, l = 10 + R() * 18; line(c, x, y, x + (x - (WF.L + WF.R) / 2) * .02, y + l, R() < .7 ? 'rgba(235,255,250,.6)' : 'rgba(20,90,100,.4)', 1.5 + R() * 1.5); }
        c.fillStyle = 'rgba(245,255,252,.75)'; c.fill(bandH(x => yN(x) - 16, x => yN(x) + 2, WF.L, WF.R));
        c.restore();
        for (const [rx, ry, rr] of [[WF.L + 40, -78, 18], [WF.R - 50, -70, 20], [WF.L + 300, -56, 12], [WF.R - 330, -80, 13], [(WF.L + WF.R) / 2, -72, 10], [WF.L + 10, -40, 20], [WF.R - 6, -48, 18]]) if (rx > a - 30 && rx < b + 30) waterRock(c, rx, ry, rr, rx | 0);
      }
      // forest canopy on the plateaus
      const rl = rvL(RTOP) - 40, rr = rvR(RTOP) + 40;
      for (let k = Math.floor(X0 / BLOCK) - 1; k * BLOCK < X1 + BLOCK; k++) if (Y0 < 60) {
        for (const f of FEAT.eN) {
          const x = f.w + k * BLOCK; if (x < a - 80 || x > b + 80 || x < 0 || x > SIZE || (x > rl && x < rr)) continue;
          canopyTop(c, f, x, Math.max(oN(x) + f.r * (.15 + f.d * .5), -148 + f.r * 1.12 + 3));
        }
        for (const f of FEAT.N) {
          const x = f.u + k * BLOCK, y = f.v;
          if (x < a - f.r - 20 || x > b + f.r + 20 || x < 300 || x > 3340) continue;
          if (x > rvL(y) - f.r - 20 && x < rvR(y) + f.r + 20) continue;
          if (y - f.r * 1.12 - 3 < -148 || y < oN(x) + 8) continue;
          canopyTop(c, f, x, y);
        }
      }
      if (Y0 < 60 && b > rl - 60 && a < rr + 60) { const R = rng(4321); for (let x = rl + 10; x < rr; x += 46 + R() * 30) { const r = 30 + R() * 18, f = { t: R() < .15 ? 'p' : 'c', r, k: R(), s: Math.floor(R() * 1e6) }; canopyTop(c, f, x, Math.min(-148 + r * 1.12 + 4 + R() * 28, -58)); } }
      for (let k = Math.floor(Y0 / BLOCK) - 1; k * BLOCK < Y1 + BLOCK; k++) {
        if (X0 < 400) {
          for (const f of FEAT.eW) { const y = f.w + k * BLOCK; if (y < 0 || y > SIZE + 40 || y < Y0 - 80 || y > Y1 + 80) continue; canopyTop(c, f, Math.max(oW(y) + f.r * (.2 + f.d * .6), -148 + f.r * 1.3), y); }
          for (const f of FEAT.W) { const y = f.v + k * BLOCK; if (y > Y0 - f.r - 30 && y < Y1 + f.r + 30 && f.u - f.r * 1.3 >= -148 && f.u >= oW(y) + 8 && y < oS(f.u) - 10) canopyTop(c, f, f.u, y); }
        }
        if (X1 > 3240) {
          for (const f of FEAT.eE) { const y = f.w + k * BLOCK; if (y < 0 || y > SIZE + 40 || y < Y0 - 80 || y > Y1 + 80) continue; canopyTop(c, f, Math.min(oE(y) - f.r * (.2 + f.d * .6), SIZE + 148 - f.r * 1.4), y); }
          for (const f of FEAT.E) { const y = f.v + k * BLOCK; if (y > Y0 - f.r - 30 && y < Y1 + f.r + 30 && f.u + f.r * 1.4 <= SIZE + 148 && f.u <= oE(y) - 8 && y < oS(f.u) - 10) canopyTop(c, f, f.u, y); }
        }
      }
    }
    // south: forest strip with a log palisade
    if (Y1 > 3230) {
      const s0 = Math.max(a - 20, 390), e0 = Math.min(b + 20, 3250);
      if (X1 > 1380 && X0 < 2260 && Y1 > 3600) gateApron(c, X0, Y0, X1, Y1);
      for (const [side, s, e] of [[0, s0, Math.min(e0, GL)], [1, Math.max(s0, GR), e0]]) {
        const p = A.stripP[side];
        c.fillStyle = A.forestPat; c.fill(p);
        c.save(); c.clip(p); c.strokeStyle = 'rgba(10,25,10,.35)'; c.lineWidth = 16; c.stroke(p); c.restore();
        c.strokeStyle = 'rgba(20,35,15,.55)'; c.lineWidth = 1.5; c.stroke(p);
        if (e > s) {
          c.fillStyle = 'rgba(40,30,15,.4)'; c.fill(bandH(ySt, x => ySt(x) + 8, s, e));
          c.strokeStyle = 'rgba(25,35,18,.7)'; c.lineWidth = 2; c.beginPath(); for (let x = Math.floor(s / 8) * 8; x <= e; x += 8) x === Math.floor(s / 8) * 8 ? c.moveTo(x, ySt(x)) : c.lineTo(x, ySt(x)); c.stroke();
        }
      }
      if (s0 < e0) palisade(c, s0, e0);
      for (const ex of [GL, GR]) if (ex > a - 60 && ex < b + 60) { const x = ex + (ex === GL ? -12 : 12), base = yP(x); post(c, x, base - 128, base, 20, WOODD); fpoly(c, [x - 10, base - 128, x, base - 140, x + 10, base - 128], WOODD.dark); mossRock(c, x + (ex === GL ? -18 : 18), base + 22, 16, ex); }
      for (const f of A.sAll) {
        const x = f.u, y = f.v;
        if (x < a - 90 || x > b + 90 || y < Y0 - 10 || y > Y1 + 260) continue;
        drawStripFeat(c, f, x, y);
      }
    }
    // foam at the foot of the falls
    if (Y0 < 520 && b > WF.L - 120 && a < WF.R + 120) {
      for (const f of A.foamBlobs) {
        if (f.x < a - 60 || f.x > b + 60) continue;
        fell(c, f.x + 2, f.y + 3, f.r + 3, f.r * .62 + 3, 'rgba(40,120,130,.5)');
      }
      for (const f of A.foamBlobs) {
        if (f.x < a - 60 || f.x > b + 60) continue;
        fell(c, f.x, f.y, f.r, f.r * .62, '#f2fffc'); fell(c, f.x + f.r * .2, f.y + f.r * .18, f.r * .75, f.r * .4, '#cdeeea'); fell(c, f.x - f.r * .3, f.y - f.r * .22, f.r * .4, f.r * .2, '#ffffff');
      }
    }
    for (const [tx] of TRK) if (Y0 < 520 && tx > a - 60 && tx < b + 60) for (const [dx, r] of [[-14, 12], [6, 15], [20, 10]]) { const y = yNb(tx) + 14; fell(c, tx + dx, y, r, r * .6, '#f2fffc'); fell(c, tx + dx + 3, y + 2, r * .7, r * .35, '#cdeeea'); }
    // boulders capping the outer ends of the side bevels
    for (const [x, r, sd] of [[368, 24, 1], [338, 16, 2], [3272, 24, 3], [3302, 16, 4]]) { const y = oS(x) - 12; if (x + r * 1.4 > X0 && x - r * 1.4 < X1 && y + r > Y0 && y - r * 1.2 < Y1) mossRock(c, x, y, r, 600 + sd); }
    // boulder piles in the four inner corners
    const piles = [[452, 470, 34], [418, 440, 24], [496, 432, 18], [414, 500, 16]];
    for (const [px, py, r] of piles) for (const [mx, my] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = mx ? SIZE - px : px, y = my ? py + 2830 : py;
      if (x + r * 1.7 > X0 && x - r * 1.3 < X1 && y + r > Y0 && y - r * 1.2 < Y1) mossRock(c, x, y, r, px + py + mx * 7 + my * 13);
    }
  }
  function renderCliffCell(cx, cy) {
    const x0 = cx * BLOCK - (cx === 0 ? 160 : 0), x1 = (cx + 1) * BLOCK + (cx === NC - 1 ? 160 : 0);
    const y0 = cy * BLOCK - (cy === 0 ? 160 : 0), y1 = (cy + 1) * BLOCK + (cy === NC - 1 ? 160 : 0);
    const cv = mk(x1 - x0, y1 - y0), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(-x0, -y0);
    drawRing(c, x0, y0, x1, y1);
    return { cv, dx: cx * BLOCK - x0, dy: cy * BLOCK - y0 };
  }

  // ------------------------------------------------------------------ props
  function toro(c, x, y, s = 1) {
    const st = tone('#a5a593');
    fell(c, x + 6 * s, y, 14 * s, 4 * s, 'rgba(15,30,15,.32)');
    frect(c, x - 10 * s, y - 7 * s, 20 * s, 7 * s, st.dark);
    frect(c, x - 4 * s, y - 26 * s, 8 * s, 19 * s, st.base); frect(c, x - 4 * s, y - 26 * s, 3 * s, 19 * s, st.light);
    frect(c, x - 9 * s, y - 30 * s, 18 * s, 5 * s, st.dark);
    frect(c, x - 7 * s, y - 43 * s, 14 * s, 13 * s, st.base);
    frect(c, x - 4 * s, y - 40 * s, 8 * s, 7 * s, '#f6d48a');
    fpoly(c, [x - 14 * s, y - 43 * s, x, y - 54 * s, x + 14 * s, y - 43 * s, x + 10 * s, y - 40 * s, x - 10 * s, y - 40 * s], st.base);
    fpoly(c, [x - 14 * s, y - 43 * s, x, y - 54 * s, x, y - 42 * s], st.light);
    fell(c, x - 4 * s, y - 49 * s, 6 * s, 2.4 * s, 'rgba(92,148,58,.85)');
    poly(c, [x - 14 * s, y - 43 * s, x, y - 54 * s, x + 14 * s, y - 43 * s, x + 10 * s, y - 40 * s, x - 10 * s, y - 40 * s]); sk(c, OUT, 1.3);
    fell(c, x, y - 56 * s, 2.6 * s, 2.6 * s, st.dark);
    srect(c, x - 7 * s, y - 43 * s, 14 * s, 13 * s, OUT, 1.2); srect(c, x - 4 * s, y - 26 * s, 8 * s, 19 * s, OUT, 1.2); srect(c, x - 10 * s, y - 7 * s, 20 * s, 7 * s, OUT, 1.2);
  }
  function torii(c, ax, ay, w, h) {
    const T = VERM;
    for (const sx of [-1, 1]) {
      const px = ax + sx * w / 2;
      fell(c, px + 6, ay, 12, 4, 'rgba(15,40,20,.35)');
      frect(c, px - 6, ay - h, 12, h, T.base); frect(c, px - 6, ay - h, 4, h, T.light); frect(c, px + 3, ay - h, 3, h, T.dark);
      frect(c, px - 8, ay - 10, 16, 10, '#2a2a26'); srect(c, px - 8, ay - 10, 16, 10, OUT, 1.2);
      srect(c, px - 6, ay - h, 12, h - 10, OUT, 1.4);
    }
    frect(c, ax - w / 2 - 14, ay - h + 24, w + 28, 9, T.base); frect(c, ax - w / 2 - 14, ay - h + 24, w + 28, 3, T.light); srect(c, ax - w / 2 - 14, ay - h + 24, w + 28, 9, OUT, 1.3);
    const kp = new Path2D(); kp.moveTo(ax - w / 2 - 28, ay - h - 8); kp.quadraticCurveTo(ax, ay - h + 4, ax + w / 2 + 28, ay - h - 8); kp.lineTo(ax + w / 2 + 24, ay - h + 4); kp.quadraticCurveTo(ax, ay - h + 14, ax - w / 2 - 24, ay - h + 4); kp.closePath();
    c.fillStyle = T.base; c.fill(kp);
    const kt = new Path2D(); kt.moveTo(ax - w / 2 - 30, ay - h - 13); kt.quadraticCurveTo(ax, ay - h - 1, ax + w / 2 + 30, ay - h - 13); kt.lineTo(ax + w / 2 + 28, ay - h - 7); kt.quadraticCurveTo(ax, ay - h + 5, ax - w / 2 - 28, ay - h - 7); kt.closePath();
    c.fillStyle = '#2a2622'; c.fill(kt); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(kp); c.stroke(kt);
    frect(c, ax - 10, ay - h + 4, 20, 22, '#2a2622'); frect(c, ax - 8, ay - h + 6, 16, 18, '#3a3a34'); txt(c, '滝', ax, ay - h + 15, 12, '#e8d28a', { weight: '900' });
  }
  function boatSprite(vert) {
    const L = 96, Wd = 32;
    return sprite(vert ? 60 : 120, vert ? 120 : 60, vert ? 30 : 60, vert ? 60 : 30, (c, ax, ay) => {
      c.save(); c.translate(ax, ay); if (vert) c.rotate(Math.PI / 2);
      fell(c, 0, 4, L / 2 + 8, Wd / 2 + 4, 'rgba(225,250,245,.35)');
      fell(c, 4, 6, L / 2, Wd / 2 - 2, 'rgba(10,50,55,.35)');
      const hull = pathFrom([[-L / 2, 0], [-L / 2 + 16, -Wd / 2], [L / 2 - 20, -Wd / 2], [L / 2, -4], [L / 2, 4], [L / 2 - 20, Wd / 2], [-L / 2 + 16, Wd / 2]]);
      celFill(c, hull, '#8a6038', '#b08050', '#5e4024', { ld: 3, dd: 4 });
      c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(hull);
      const inner = pathFrom([[-L / 2 + 8, 0], [-L / 2 + 19, -Wd / 2 + 5], [L / 2 - 22, -Wd / 2 + 5], [L / 2 - 8, 0], [L / 2 - 22, Wd / 2 - 5], [-L / 2 + 19, Wd / 2 - 5]]);
      c.fillStyle = '#5a3c22'; c.fill(inner);
      for (const bx of [-18, 14]) frect(c, bx - 3, -Wd / 2 + 5, 6, Wd - 10, '#c09060');
      line(c, -6, -2, 30, 10, '#d8b07a', 2.2);
      c.restore();
    });
  }
  function makeProps() {
    const P = {};
    P.trees = [0, 1, 2].map(i => sprite(210, 240, 105, 226, (c, ax, ay) => broadTree(c, ax, ay, .9 + i * .12, 300 + i * 41, LEAF[i])));
    P.maple = sprite(210, 240, 105, 226, (c, ax, ay) => broadTree(c, ax, ay, .9, 777, MAPLE));
    P.pines = [0, 1].map(i => sprite(150, 190, 70, 180, (c, ax, ay) => pineTree(c, ax, ay, 1.05 + i * .2, 500 + i * 13)));
    P.bamboo = sprite(170, 230, 85, 220, (c, ax, ay) => bamboo(c, ax, ay, 1, 909));
    P.bushes = [0, 1, 2].map(i => sprite(80, 56, 40, 48, (c, ax, ay) => bush(c, ax, ay, 1 + i * .1, LEAF[i], null, 60 + i)));
    P.hydr = HYDR.map((f, i) => sprite(80, 56, 40, 48, (c, ax, ay) => bush(c, ax, ay, 1, LEAF[1], f, 70 + i)));
    P.rocks = [10, 15, 21, 28].map((r, i) => sprite(Math.ceil(r * 3 + 16), Math.ceil(r * 2 + 18), Math.round(r * 1.35 + 6), Math.round(r * 1.25 + 8), (c, ax, ay) => mossRock(c, ax, ay, r, 300 + i * 17)));
    P.wrocks = [12, 18, 26].map((r, i) => sprite(Math.ceil(r * 3.6 + 16), Math.ceil(r * 2.2 + 18), Math.round(r * 1.7 + 8), Math.round(r * 1.25 + 8), (c, ax, ay) => waterRock(c, ax, ay, r, 400 + i * 23)));
    P.reeds = [0, 1, 2].map(i => sprite(70, 90, 34, 82, (c, ax, ay) => reeds(c, ax, ay, .9 + i * .12, 800 + i * 7)));
    P.lilies = [0, 1, 2, 3].map(i => sprite(100, 50, 50, 25, (c, ax, ay) => lilies(c, ax, ay, 900 + i * 5)));
    P.boatH = boatSprite(false); P.boatV = boatSprite(true);
    P.toro = sprite(40, 66, 20, 62, (c, ax, ay) => toro(c, ax, ay, 1));
    P.toroBig = sprite(54, 88, 27, 84, (c, ax, ay) => toro(c, ax, ay, 1.4));
    P.lampPost = sprite(44, 96, 14, 90, (c, ax, ay) => {
      fell(c, ax + 5, ay, 10, 3, 'rgba(15,30,15,.3)');
      post(c, ax, ay - 76, ay, 6, WOODD);
      line(c, ax - 3, ay - 72, ax + 18, ay - 72, WOODD.deep, 3);
      chochin(c, ax + 14, ay - 58, 1.1, LANT);
    });
    P.torii = sprite(200, 150, 100, 140, (c, ax, ay) => torii(c, ax, ay, 104, 110));
    P.basin = sprite(90, 70, 40, 60, (c, ax, ay) => {
      fell(c, ax + 6, ay, 34, 8, 'rgba(15,30,15,.3)');
      const g = new Path2D(); g.moveTo(ax - 28, ay - 26); g.lineTo(ax - 26, ay); g.lineTo(ax + 26, ay); g.lineTo(ax + 28, ay - 26); g.closePath();
      celFill(c, g, '#9a9a88', '#c4c4b0', '#6f6f60', { ld: 4, dd: 5 }); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(g);
      fell(c, ax, ay - 26, 28, 8, '#b4b4a0'); fell(c, ax, ay - 25, 22, 5.5, '#4fc4c0'); fell(c, ax - 6, ay - 27, 8, 1.8, '#e8fffb'); c.beginPath(); c.ellipse(ax, ay - 26, 28, 8, 0, 0, TAU); sk(c, OUT, 1.3);
      fell(c, ax - 18, ay - 4, 8, 3, 'rgba(92,148,58,.7)');
      line(c, ax + 34, ay - 50, ax + 14, ay - 34, '#3d6a26', 6); line(c, ax + 34, ay - 50, ax + 14, ay - 34, '#9cc860', 3.5);
      line(c, ax + 14, ay - 34, ax + 12, ay - 27, 'rgba(200,250,245,.9)', 2);
      line(c, ax - 10, ay - 30, ax + 10, ay - 44, '#c09a62', 2); fell(c, ax + 12, ay - 45, 4, 2.6, '#c09a62');
    });
    P.sign = sprite(60, 120, 30, 112, (c, ax, ay) => {
      fell(c, ax + 6, ay, 16, 4, 'rgba(15,30,15,.3)');
      post(c, ax - 14, ay - 96, ay, 5, WOODD); post(c, ax + 14, ay - 96, ay, 5, WOODD);
      fpoly(c, [ax - 22, ay - 100, ax, ay - 110, ax + 22, ay - 100], WOODD.dark); poly(c, [ax - 22, ay - 100, ax, ay - 110, ax + 22, ay - 100]); sk(c, OUT, 1.2);
      frect(c, ax - 13, ay - 96, 26, 74, '#d9c49a'); frect(c, ax - 13, ay - 96, 26, 3, '#efe0bc'); srect(c, ax - 13, ay - 96, 26, 74, OUT, 1.4);
      txtV(c, '滝隠れ', ax, ay - 94, 19, '#2a1a10');
    });
    P.heroSign = sprite(60, 80, 30, 72, (c, ax, ay) => {
      fell(c, ax + 6, ay, 14, 4, 'rgba(15,30,15,.3)');
      post(c, ax, ay - 40, ay, 5, WOODD);
      frect(c, ax - 24, ay - 66, 48, 28, '#d9c49a'); srect(c, ax - 24, ay - 66, 48, 28, OUT, 1.4);
      txt(c, '英雄の水', ax, ay - 52, 11, '#2a1a10', { weight: '900' });
    });
    P.barrels = sprite(70, 56, 34, 48, (c, ax, ay) => { barrel(c, ax - 13, ay - 2, .9); barrel(c, ax + 12, ay, 1, '#7a5232'); });
    P.crates = sprite(80, 70, 36, 62, (c, ax, ay) => {
      fell(c, ax + 12, ay, 34, 8, 'rgba(15,30,15,.26)');
      const box = (x, y, w, h, d) => {
        fpoly(c, [x, y, x + w, y, x + w + d * .4, y - d, x + d * .4, y - d], WOOD.light);
        frect(c, x, y, w, h, WOOD.base); c.strokeStyle = WOOD.dark; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.moveTo(x, y); c.lineTo(x + w, y + h); c.stroke();
        fpoly(c, [x + w, y, x + w + d * .4, y - d, x + w + d * .4, y + h - d, x + w, y + h], WOOD.dark);
        poly(c, [x, y, x + d * .4, y - d, x + w + d * .4, y - d, x + w + d * .4, y + h - d, x + w, y + h, x, y + h]); sk(c, OUT, 1.4);
      };
      box(ax - 30, ay - 24, 30, 24, 14); box(ax + 2, ay - 22, 26, 22, 12); box(ax - 20, ay - 48, 26, 22, 12);
    });
    P.firewood = sprite(80, 50, 40, 42, (c, ax, ay) => {
      fell(c, ax + 6, ay, 34, 7, 'rgba(15,30,15,.28)');
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6 - r; k++) { const fx = ax - 24 + k * 9.6 + r * 4.8, fy = ay - 6 - r * 8; fell(c, fx, fy, 5, 4.3, '#8a6a42'); fell(c, fx, fy, 2.6, 2.2, '#d4b07a'); c.beginPath(); c.arc(fx, fy, 5, 0, TAU); sk(c, OUT, .9); }
    });
    P.netRack = sprite(90, 110, 40, 100, (c, ax, ay) => { fell(c, ax + 8, ay, 34, 6, 'rgba(15,30,15,.28)'); netHang(c, ax - 30, ay - 88, 60, 58); });
    P.fishRack = sprite(90, 70, 40, 62, (c, ax, ay) => { fell(c, ax + 8, ay, 36, 6, 'rgba(15,30,15,.28)'); fishRack(c, ax - 30, ay, 60); });
    P.flowerBed = sprite(110, 50, 55, 40, (c, ax, ay) => {
      const R = rng(55);
      rrect(c, ax - 48, ay - 16, 96, 22, 8); c.fillStyle = '#6a4e30'; c.fill(); sk(c, OUT, 1.2);
      for (let i = 0; i < 14; i++) { const x = ax - 40 + R() * 80, y = ay - 10 + R() * 12; fell(c, x, y - 4, 7, 5, LEAF[0].mid); fell(c, x - 1, y - 7, 3, 2.4, ['#f2d64a', '#e9a6c0', '#f4f1e0', '#e8783a'][i % 4]); }
    });
    P.bench = sprite(84, 40, 40, 32, (c, ax, ay) => {
      fell(c, ax + 8, ay, 36, 6, 'rgba(15,30,15,.26)');
      frect(c, ax - 30, ay - 12, 7, 12, WOODD.dark); frect(c, ax + 23, ay - 12, 7, 12, WOODD.dark);
      frect(c, ax - 35, ay - 20, 70, 9, WOOD.base); frect(c, ax - 35, ay - 20, 70, 3, WOOD.hi); srect(c, ax - 35, ay - 20, 70, 9, OUT, 1.4);
    });
    P.laundry = sprite(150, 84, 75, 74, (c, ax, ay) => {
      for (const px of [ax - 62, ax + 62]) { fell(c, px + 4, ay, 6, 2, 'rgba(15,30,15,.3)'); post(c, px, ay - 58, ay, 5, WOODD); }
      const R = rng(333), x1 = ax - 62, x2 = ax + 62, y1 = ay - 54, cx = ax, cy = ay - 36;
      c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y1); sk(c, '#5a4636', 1.1);
      for (let i = 1; i < 8; i++) { if (R() < .2) continue; const [px, py] = quadPt(x1, y1, cx, cy, x2, y1, i / 8), w = 8 + R() * 6, h = 10 + R() * 9, col = CLOTH[Math.floor(R() * CLOTH.length)]; frect(c, px - w / 2, py, w, h, col); frect(c, px + w / 2 - 2, py, 2, h, 'rgba(0,0,0,.2)'); srect(c, px - w / 2, py, w, h, 'rgba(40,40,30,.8)', 1); }
    });
    P.gate = sprite(400, 300, 200, 270, (c, ax, ay) => {
      const H = 210, px = 128;
      for (const sx of [-1, 1]) {
        const x = ax + sx * px;
        fell(c, x + 10, ay + 2, 26, 8, 'rgba(15,30,15,.35)');
        frect(c, x - 20, ay - 18, 40, 18, '#8a8a78'); frect(c, x - 20, ay - 18, 40, 4, '#b4b4a0'); srect(c, x - 20, ay - 18, 40, 18, OUT, 1.4);
        post(c, x, ay - H, ay - 16, 26, WOODD);
        for (const by of [ay - 60, ay - 150]) { frect(c, x - 13, by, 26, 6, '#3a3630'); fell(c, x - 6, by + 3, 1.6, 1.6, '#c9b27a'); fell(c, x + 6, by + 3, 1.6, 1.6, '#c9b27a'); }
      }
      frect(c, ax - px - 30, ay - H + 50, px * 2 + 60, 14, WOODD.base); frect(c, ax - px - 30, ay - H + 50, px * 2 + 60, 4, WOODD.light); srect(c, ax - px - 30, ay - H + 50, px * 2 + 60, 14, OUT, 1.4);
      frect(c, ax - px - 40, ay - H + 4, px * 2 + 80, 16, WOODD.base); frect(c, ax - px - 40, ay - H + 4, px * 2 + 80, 5, WOODD.light); srect(c, ax - px - 40, ay - H + 4, px * 2 + 80, 16, OUT, 1.4);
      roofHip(c, ax - px - 54, ay - H - 40, px * 2 + 108, 46, BOARD[0], { hip: 34, rf: .1, flare: true, seed: 99, moss: 4, shadow: 6 });
      frect(c, ax - 46, ay - H + 18, 92, 34, '#2a2622'); frect(c, ax - 42, ay - H + 21, 84, 28, '#3d4a3a'); srect(c, ax - 46, ay - H + 18, 92, 34, OUT, 1.4);
      txt(c, '滝隠れ', ax + 8, ay - H + 35, 18, '#e8d28a', { weight: '900' }); takiMark(c, ax - 30, ay - H + 35, 9, '#e8d28a', 2.2);
      for (const sx of [-1, 1]) { banner(c, ax + sx * (px - 52) - 11, ay - H + 64, 22, 74, '#2f8f88'); line(c, ax + sx * 60, ay - H + 64, ax + sx * 60, ay - H + 78, '#2e2a22', 1.3); chochin(c, ax + sx * 60, ay - H + 90, 1.25, LANT, '滝'); }
    });
    P.yagura = sprite(140, 250, 70, 236, (c, ax, ay) => {
      fell(c, ax + 14, ay + 2, 50, 12, 'rgba(15,30,15,.32)');
      for (const dx of [-26, 26]) line(c, ax + dx + 6, ay - 8, ax + dx * .7 + 6, ay - 140, '#4a321e', 7);
      c.strokeStyle = WOODD.dark; c.lineWidth = 3.5; c.beginPath();
      for (const [y0, y1] of [[ay - 10, ay - 70], [ay - 70, ay - 136]]) { c.moveTo(ax - 30, y0); c.lineTo(ax + 28, y1); c.moveTo(ax + 30, y0); c.lineTo(ax - 28, y1); } c.stroke();
      for (const dx of [-30, 30]) post(c, ax + dx - Math.sign(dx) * (dx > 0 ? 4 : -4) * 0, ay - 140, ay, 9, WOODD);
      frect(c, ax - 44, ay - 146, 88, 10, WOODD.base); frect(c, ax - 44, ay - 146, 88, 3, WOODD.light); srect(c, ax - 44, ay - 146, 88, 10, OUT, 1.4);
      woodWall(c, ax - 34, ay - 186, 68, 40, { eave: 6 });
      frect(c, ax - 24, ay - 176, 48, 16, '#2a1e14');
      railing(c, ax - 42, ax + 42, ay - 146, 16);
      roofHip(c, ax - 48, ay - 214, 96, 36, THATCH[0], { thatch: true, hip: 30, rf: -.4, seed: 5, moss: 2, shadow: 6 });
      chochin(c, ax + 38, ay - 160, 1, LANT);
      flagPole(c, ax - 40, ay - 214, 30, '#2f8f88');
    });
    P.torch = sprite(40, 84, 20, 76, (c, ax, ay) => {
      fell(c, ax + 5, ay, 10, 3, 'rgba(15,30,15,.3)');
      line(c, ax, ay, ax, ay - 52, OUT, 5); line(c, ax, ay, ax, ay - 52, WOOD.base, 3);
      fpoly(c, [ax - 9, ay - 56, ax + 9, ay - 56, ax + 5, ay - 48, ax - 5, ay - 48], '#4a3a2a'); poly(c, [ax - 9, ay - 56, ax + 9, ay - 56, ax + 5, ay - 48, ax - 5, ay - 48]); sk(c, OUT, 1.2);
      fpoly(c, [ax - 7, ay - 57, ax - 2, ay - 72, ax, ay - 64, ax + 3, ay - 74, ax + 7, ay - 57], '#f08a2a');
      fpoly(c, [ax - 4, ay - 57, ax, ay - 67, ax + 4, ay - 57], '#ffd86a');
    });
    return P;
  }

  // ------------------------------------------------------------------ ambient sprites
  function makeFallStrip(seed, W, H) {
    const cv = mk(W, H), c = cv.getContext('2d'), R = rng(seed);
    c.lineCap = 'round';
    for (let i = 0; i < W / 4; i++) {
      const x = R() * W, len = 30 + R() * 100, y = R() * H, w = 1.2 + R() * 3.4, a = .2 + R() * .5, dark = R() < .12;
      for (const oy of [0, -H, H]) {
        const y0 = y + oy, col = dark ? `rgba(20,110,120,${a * .35})` : `rgba(255,255,255,${a * .5})`, col2 = dark ? `rgba(20,110,120,${a * .6})` : `rgba(255,255,255,${a})`;
        if (y0 + len < 0 || y0 > H) continue;
        line(c, x, y0, x, y0 + len, col, w); line(c, x, y0 + len * .2, x, y0 + len * .75, col2, w * .7);
      }
    }
    return cv;
  }
  function softBlob(w, h, a, col = '255,255,255') {
    const cv = mk(w, h), c = cv.getContext('2d');
    c.translate(w / 2, h / 2); c.scale(1, h / w);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(.55, `rgba(${col},${a * .5})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, w / 2, 0, TAU); c.fill();
    return cv;
  }

  // ------------------------------------------------------------------ state
  const A = {};
  let ready = false;
  const foots = [], objs = [], decals = [], lanternsLocal = [];

  function buildingCanvas(fn, P) {
    const cv = mk(FW + SM * 2, FH + OVER + BM), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(SM, OVER);
    fn(c, P);
    return cv;
  }
  const inRect = (x, y, r, m) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;
  const inEll = (x, y, e, m) => { const dx = (x - e.x) / (e.rx + m), dy = (y - e.y) / (e.ry + m); return dx * dx + dy * dy < 1; };

  const VAR = {
    hut: [vHut, true], long: [vLong, true], tower: [vTower, true],
    machiya: [vMachiya, false], farm: [vFarm, false], tea: [vTea, false], kura: [vKura, false], mill: [vMill, false]
  };
  // [x, y, variant, palette]
  const HOUSES = [
    [580, 600, 'hut', 0], [2740, 600, 'tower', 0],
    [580, 1120, 'long', 0], [1090, 1130, 'tower', 1], [2230, 1130, 'hut', 1], [2740, 1120, 'long', 1],
    [580, 1640, 'tower', 2], [2740, 1640, 'hut', 2],
    [560, 2150, 'farm', 0], [2160, 2170, 'mill', 0], [2760, 2150, 'kura', 0],
    [600, 2700, 'machiya', 0], [1130, 2700, 'tea', 0], [2190, 2700, 'machiya', 1], [2720, 2700, 'farm', 1]
  ];

  function build() {
    HC = mk(4, 4).getContext('2d');
    LAKEPTS = []; for (let i = 0; i < 200; i++) LAKEPTS.push(lakePt(i / 200 * TAU));
    LAKEP = smoothPath(LAKEPTS);
    const ip = []; for (let i = 0; i < 90; i++) ip.push(islePt(i / 90 * TAU));
    ISLEP = smoothPath(ip);
    A.lakeGrad = HC.createRadialGradient(LAKE.cx, LAKE.cy + 100, 150, LAKE.cx, LAKE.cy + 100, 1250);
    A.lakeGrad.addColorStop(0, 'rgba(12,70,92,.42)'); A.lakeGrad.addColorStop(.55, 'rgba(12,70,92,.22)'); A.lakeGrad.addColorStop(1, 'rgba(12,70,92,0)');
    A.grassPat = HC.createPattern(makeGrassTile('#4f8e3e', 808, false), 'repeat');
    A.islePat = HC.createPattern(makeGrassTile('#59993f', 919, false), 'repeat');
    A.forestPat = HC.createPattern(makeGrassTile('#355f2f', 717, true), 'repeat');
    A.dirtPat = HC.createPattern(makeDirtTile(), 'repeat');
    A.pavePat = HC.createPattern(makePaveTile(), 'repeat');
    A.waterPat = HC.createPattern(makeWaterTile(), 'repeat');
    A.plankV = HC.createPattern(makePlank(true), 'repeat');
    A.plankH = HC.createPattern(makePlank(false), 'repeat');
    A.emblem = makeEmblem();
    A.props = makeProps();
    // falls geometry and static detail
    A.fallP = fallPath();
    A.fallGrad = HC.createLinearGradient(0, -34, 0, 418);
    [[0, '#effdf9'], [.06, '#c2efea'], [.2, '#80d3d2'], [.55, '#58bcc2'], [.82, '#7fd2d0'], [1, '#eafbf6']].forEach(([o, col]) => A.fallGrad.addColorStop(o, col));
    A.fallStreaks = []; { const R = rng(2468); for (let i = 0; i < 300; i++) { const x = WF.L - 20 + R() * (WF.R - WF.L + 40); A.fallStreaks.push({ x, y0: yN(x) + R() * 140, y1: yNb(x) + 14 - R() * 120, b: (R() - .5) * 8, w: 1.4 + R() * 4.2, col: R() < .66 ? `rgba(245,255,252,${(.22 + R() * .45).toFixed(2)})` : `rgba(25,115,125,${(.12 + R() * .18).toFixed(2)})` }); } }
    A.fallBands = []; { const R = rng(1122); for (let x = WF.L - 10; x < WF.R; ) { const w = 18 + R() * 46; A.fallBands.push({ x, w, col: R() < .5 ? `rgba(255,255,255,${(.08 + R() * .14).toFixed(2)})` : `rgba(20,100,115,${(.05 + R() * .08).toFixed(2)})` }); x += w; } }
    A.foamBlobs = []; { const R = rng(1357); for (let x = WF.L - 70; x <= WF.R + 70; x += 15) for (let k = 0; k < 2; k++) A.foamBlobs.push({ x: x + (R() - .5) * 12, y: yNb(x) + 6 + R() * 46 - (k ? 0 : 10), r: 16 + R() * 26 * (1 - Math.abs(x - (WF.L + WF.R) / 2) / ((WF.R - WF.L) / 2 + 140) * .5) }); A.foamBlobs.sort((p, q) => p.y - q.y); }
    TOP = topPolygon(); A.lip = lipPath(); A.stripP = [stripPath(0), stripPath(1)];
    genFeatures();
    A.sAll = FEAT.S.filter(f => f.u > 420 && f.u < 3220 && f.v < oS(f.u) - 16 && !(f.u > GL - 70 - fun(f.v) && f.u < GR + 70 + fun(f.v)));
    { const R = rng(7777);
      for (let x = 410; x < 3232; x += 30 + R() * 30) { if (x > GL - 190 && x < GR + 190) continue; const t = R() < .65 ? 'b' : 'r'; A.sAll.push({ t, u: x, v: Math.min(oS(x) - 6 + (R() - .55) * 34, SIZE + 136), r: t === 'b' ? 22 + R() * 12 : 18 + R() * 12, k: R(), s: Math.floor(R() * 1e6) }); }
      for (let y = 3350; y < 3790; y += 26 + R() * 20) for (const side of [0, 1]) { const fx = side ? GR + fun(y) : GL - fun(y); if (y > oS(fx) - 6) continue; const t = R() < .6 ? 'b' : 'r'; A.sAll.push({ t, u: fx + (side ? 1 : -1) * (6 + R() * 16), v: y, r: t === 'b' ? 22 + R() * 12 : 18 + R() * 12, k: R(), s: Math.floor(R() * 1e6) }); }
      A.sAll.sort((p, q) => p.v - q.v);
    }
    A.roadEnd = pathFrom([[1712, 3546], [1722, 3580], [1736, 3612], [1745, 3640], [1895, 3640], [1904, 3612], [1918, 3580], [1928, 3546]]);
    A.roadStones = []; { const R = rng(2020), tones = ['#bdb9a3', '#b1ae97', '#c7c2aa', '#a9a890']; for (let x = 1726; x < 1916; x += 13) { const n = 1 + Math.floor(R() * 3); for (let k = 0; k < n; k++) { const y = 3560 + R() * R() * 46, hw = 100 - (y - 3546) * .6; if (Math.abs(x - 1820) > hw - 8 || R() < .25) continue; A.roadStones.push([x + (R() - .5) * 6, y, 6 + R() * 4, 4 + R() * 1.5, tones[Math.floor(R() * 4)]]); } } }
    // ambient sprites
    A.strips = [makeFallStrip(91, WF.R - WF.L + 80, 256), makeFallStrip(92, WF.R - WF.L + 80, 256)];
    A.foam = [56, 72, 90].map((w, i) => sprite(w + 8, w * .66 + 8, (w + 8) / 2, (w * .66 + 8) / 2, (c, ax, ay) => { const R = rng(30 + i); for (let k = 0; k < 5; k++) { const x = ax + (R() - .5) * w * .5, y = ay + (R() - .5) * w * .2, r = w * (.18 + R() * .12); fell(c, x, y, r, r * .7, 'rgba(250,255,253,.9)'); fell(c, x + r * .2, y + r * .2, r * .6, r * .35, 'rgba(200,238,234,.8)'); } }));
    A.mist = softBlob(420, 150, .55);
    A.mistBig = softBlob(900, 320, .35);
    A.ring = sprite(124, 46, 62, 23, (c, ax, ay) => { c.beginPath(); c.ellipse(ax, ay, 58, 20, 0, 0, TAU); sk(c, 'rgba(235,255,250,.75)', 2.2); c.beginPath(); c.ellipse(ax, ay + 1.5, 58, 20, 0, .1 * Math.PI, .9 * Math.PI); sk(c, 'rgba(15,80,90,.3)', 1.5); });
    A.spark = sprite(14, 14, 7, 7, (c, ax, ay) => { fpoly(c, [ax, ay - 6, ax + 1.4, ay - 1.4, ax + 6, ay, ax + 1.4, ay + 1.4, ax, ay + 6, ax - 1.4, ay + 1.4, ax - 6, ay, ax - 1.4, ay - 1.4], '#ffffff'); });
    A.leaves = ['#6aaa4c', '#9fd065', '#cf5f2a'].map(col => sprite(10, 8, 5, 4, (c, ax, ay) => { fell(c, ax, ay, 4.4, 2.4, col); line(c, ax - 4, ay, ax + 4, ay, 'rgba(30,50,20,.6)', .8); }));

    foots.length = 0; objs.length = 0; decals.length = 0; lanternsLocal.length = 0;
    const addFoot = f => { foots.push(f); return foots.length - 1; };
    const addLamp = (x, y) => lanternsLocal.push({ x: Math.round(x), y: Math.round(y) });

    // ---- perimeter: one solid footprint per ring cell (gate cell (3,6) left open)
    const tiles = {};
    const tileFor = (cx, cy) => {
      let key = cx + ',' + cy;
      if (cx === 0 && cy > 0 && cy < NC - 1) key = 'W';
      else if (cx === NC - 1 && cy > 0 && cy < NC - 1) key = 'E';
      if (!tiles[key]) tiles[key] = key === 'W' ? renderCliffCell(0, 1) : key === 'E' ? renderCliffCell(NC - 1, 1) : renderCliffCell(cx, cy);
      return tiles[key];
    };
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      if (cx > 0 && cx < NC - 1 && cy > 0 && cy < NC - 1) continue;
      const gx = cx * BLOCK, gy = cy * BLOCK, t = tileFor(cx, cy);
      if (cx === 3 && cy === NC - 1) { objs.push({ img: t.cv, x: gx - t.dx, y: gy - t.dy, w: t.cv.width, h: t.cv.height, by: 3292, fi: -1 }); continue; }
      let f, by;
      if ((cx === 0 || cx === NC - 1) && (cy === 0 || cy === NC - 1)) { f = { x: gx, y: gy, w: BLOCK, h: BLOCK }; by = cy === 0 ? 400 : SIZE; }
      else if (cy === 0) { f = { x: gx, y: 0, w: BLOCK, h: 400 }; by = 400; }
      else if (cy === NC - 1) { f = { x: gx, y: 3240, w: BLOCK, h: 400 }; by = SIZE; }
      else if (cx === 0) { f = { x: 0, y: gy, w: 400, h: BLOCK }; by = gy + 1; }
      else { f = { x: 3240, y: gy, w: 400, h: BLOCK }; by = gy + 1; }
      Object.assign(f, { solid: true, roof: cy === NC - 1 ? '#8a6440' : '#5f7a4e', wall: cy === NC - 1 ? '#6e4a2a' : '#6f7a68' });
      const fi = addFoot(f);
      objs.push({ img: t.cv, x: gx - t.dx, y: gy - t.dy, w: t.cv.width, h: t.cv.height, by, fi, solid: true });
    }

    // ---- the giant tree (landmark)
    {
      const P = { lamps: [] }, cv = mk(TREE.w + TM.l * 2, TREE.h + TM.t + TM.b), c = cv.getContext('2d');
      c.lineJoin = 'round'; c.lineCap = 'round'; c.translate(TM.l, TM.t);
      lmTree(c, P);
      const fi = addFoot({ x: TREE.x, y: TREE.y, w: TREE.w, h: TREE.h, roof: '#3f8a3a', wall: '#7b5b3b' });
      objs.push({ img: cv, x: TREE.x - TM.l, y: TREE.y - TM.t, w: cv.width, h: cv.height, by: TREE.y + TREE.h, fi });
      for (const [lx, ly] of P.lamps) addLamp(TREE.x + lx, TREE.y + ly);
    }

    // ---- houses
    const cache = {};
    for (const [x, y, key, pal] of HOUSES) {
      const ck = key + pal, [fn, stilt] = VAR[key];
      if (!cache[ck]) {
        const thatchy = key === 'hut' || key === 'farm' || key === 'mill';
        const idx = Object.keys(cache).length;
        const P = { idx, lamps: [], posts: [], R: thatchy ? THATCH[pal % 3] : BOARD[(idx * 2 + pal) % BOARD.length], R2: thatchy ? BOARD[(idx + pal) % BOARD.length] : THATCH[(idx + pal) % 3], W2: tone(['#b07c48', '#9a6a3c', '#a87a50'][pal % 3]), cl: CLOTH[(idx + pal) % CLOTH.length], cl2: CLOTH[(idx + pal + 3) % CLOTH.length] };
        if (key === 'tower' && pal === 1) P.R2 = BOARD[4];
        if (key === 'kura') P.R = BOARD[2];
        cache[ck] = { cv: buildingCanvas(fn, P), lamps: P.lamps, posts: P.posts, roof: P.R.base, wall: stilt ? '#a5733f' : '#b08458' };
      }
      const e = cache[ck];
      const fi = addFoot({ x, y, w: FW, h: FH, roof: e.roof, wall: e.wall });
      objs.push({ img: e.cv, x: x - SM, y: y - OVER, w: e.cv.width, h: e.cv.height, by: y + FH, fi });
      for (const [lx, ly] of e.lamps) addLamp(x + lx, y + ly);
      if (stilt) for (const [px, py] of e.posts) if (inP(LAKEP, x + px, y + py)) decals.push({ s: A.ring, x: x + px, y: y + py + 2, sc: .22 });
    }

    // ---- props
    const PR = A.props, taken = [];
    const inDeck = (x, y, m) => DECKS.some(d => inRect(x, y, d, m)) || inRect(x, y, BRIDGE, m + 10);
    const inPath = (x, y, m) => DIRT.some(d => inRect(x, y, d, m)) || inRect(x, y, ROAD, m) || inEll(x, y, PLAZA, m);
    const nearFoot = (x, y, m) => foots.some(f => inRect(x, y, f, m));
    const nearTaken = (x, y, m) => taken.some(t => Math.hypot(t[0] - x, t[1] - y) < t[2] + m);
    const place = (s, x, y, m, lamp) => {
      taken.push([x, y, m]);
      objs.push({ img: s.cv, x: Math.round(x - s.ax), y: Math.round(y - s.ay), w: s.cv.width, h: s.cv.height, by: y, fi: -1 });
      if (lamp) addLamp(x + lamp[0], y + lamp[1]);
    };
    const decal = (s, x, y) => { taken.push([x, y, 30]); decals.push({ s, x, y, sc: 1 }); };
    const bankOK = (x, y, m) => x > 440 && x < 3200 && y > 430 && y < 3215 && onBank(x, y, m + 16) && !inPath(x, y, m * .6) && !nearFoot(x, y, m + 10) && !nearTaken(x, y, m) && !inEll(x, y, PLAZA, m + 20);
    const waterOK = (x, y, m) => inLake(x, y, m + 10) && !inDeck(x, y, m + 6) && !nearFoot(x, y, m + 20) && !nearTaken(x, y, m) && y > 440;

    // gate: frame, watchtowers, torches, sign
    place(PR.gate, 1820, 3306, 40, null); addLamp(1760, 3216); addLamp(1880, 3216);
    place(PR.yagura, 1606, 3322, 40, [38, -160]); place(PR.yagura, 2034, 3322, 40, [38, -160]);
    for (const x of [1694, 1946]) place(PR.torch, x, 3176, 16, [0, -64]);
    place(PR.sign, 1660, 3150, 24);
    // plaza: emblem inlay is ground art; lanterns, benches, flower beds around the rim
    for (const deg of [200, 340, 160, 20]) { const a = deg * Math.PI / 180, x = PLAZA.x + (PLAZA.rx + 24) * Math.cos(a), y = PLAZA.y + (PLAZA.ry + 16) * Math.sin(a); place(PR.toroBig, x, y, 26, [0, -54]); }
    place(PR.bench, PLAZA.x - 210, PLAZA.y + 118, 30); place(PR.bench, PLAZA.x + 210, PLAZA.y + 118, 30);
    place(PR.flowerBed, PLAZA.x - 236, PLAZA.y - 96, 40); place(PR.flowerBed, PLAZA.x + 236, PLAZA.y - 96, 40);
    // road: lanterns along both kerbs
    for (let y = 2990, i = 0; y < 3160; y += 150, i++) for (const x of [1696, 1944]) place(PR.lampPost, x, y, 18, [14, -58]);
    for (const x of [1690, 1950]) place(PR.toro, x, 2484, 18, [0, -38]);
    for (let x = 520; x < 3150; x += 300) { if (Math.abs(x - 1820) < 200) continue; const y = 2514; if (!nearFoot(x, y, 14) && !inDeck(x, y, 14) && !DIRT.slice(4).some(d => inRect(x, y, d, 14))) place(PR.lampPost, x, y, 16, [14, -58]); }
    // island shrine of the Hero's Water
    place(PR.torii, 1820, 1948, 30, null);
    place(PR.basin, 1690, 1876, 30, null); place(PR.heroSign, 1950, 1866, 24);
    for (const x of [1708, 1932]) place(PR.toro, x, 1918, 16, [0, -38]);
    for (const [x, y, s] of [[1520, 1640, PR.hydr[0]], [2120, 1650, PR.hydr[1]], [1560, 1760, PR.bushes[0]], [2090, 1770, PR.bushes[1]], [1600, 1880, PR.hydr[2]], [2050, 1890, PR.hydr[0]], [1480, 1720, PR.rocks[1]], [2160, 1730, PR.rocks[2]], [1640, 1960, PR.rocks[0]], [2010, 1966, PR.bushes[2]]]) if (inP(ISLEP, x, y)) place(s, x, y, 20);
    // boardwalk lanterns
    for (const d of DECKS) {
      if (d.d === 'v' && d.h > 600) for (let y = d.y + 140; y < d.y + d.h - 60; y += 300) place(PR.lampPost, d.x + (d.x < 1820 ? d.w + 8 : -8), y, 12, [14, -58]);
      if (d.d === 'h') for (const x of [d.x + 90, d.x + d.w - 120]) place(PR.lampPost, x, d.y + d.h + 6, 12, [14, -58]);
    }
    for (let y = BRIDGE.y + 70; y < BRIDGE.y + BRIDGE.h - 40; y += 136) addLamp(BRIDGE.x - 2, y - 30), addLamp(BRIDGE.x + BRIDGE.w + 2, y - 30);
    // boats moored by the jetty and stilt houses
    for (const [x, y, v] of [[1250, 2260, 1], [1400, 2330, 1], [1040, 1990, 0], [2560, 1990, 0], [980, 820, 1], [2620, 860, 1], [1180, 1560, 0], [2440, 1580, 0]]) if (waterOK(x, y, 30)) decal(v ? PR.boatV : PR.boatH, x, y);
    // water rocks in the plunge pool and around the lake
    { const R = rng(8080);
      for (let i = 0; i < 14; i++) { const x = WF.L - 60 + R() * (WF.R - WF.L + 120), y = 470 + R() * 160; if (waterOK(x, y, 24)) place(PR.wrocks[Math.floor(R() * 3)], x, y, 26); }
      for (let i = 0; i < 26; i++) { const x = 700 + R() * 2240, y = 500 + R() * 1900; if (waterOK(x, y, 30) && !inP(LAKEP, x, y + 60) === false && R() < .55) place(PR.wrocks[Math.floor(R() * 2)], x, y, 26); }
    }
    // reeds along the shore (both sides of the waterline) and round the island
    { const R = rng(5150), n = LAKEPTS.length;
      for (let i = 0; i < n; i += 2) {
        const [x, y] = LAKEPTS[i]; if (y < 470) continue;
        const [x2, y2] = LAKEPTS[(i + 1) % n], nx = -(y2 - y), ny = x2 - x, L = Math.hypot(nx, ny) || 1, off = (R() - .3) * 40;
        const px = x + nx / L * off, py = y + ny / L * off;
        if (R() < .45 || inDeck(px, py, 30) || nearFoot(px, py, 26) || inPath(px, py, 10) || nearTaken(px, py, 26) || px < 450 || px > 3190) continue;
        if (R() < .7) place(PR.reeds[Math.floor(R() * 3)], px, py, 24); else place(PR.rocks[Math.floor(R() * 2)], px, py, 22);
      }
      for (let i = 0; i < 30; i++) { const th = i / 30 * TAU, [x, y] = islePt(th); if (y > 1860 && Math.abs(x - 1820) < 140) continue; if (R() < .5 && !inDeck(x, y, 24) && !nearTaken(x, y, 24)) place(PR.reeds[Math.floor(R() * 3)], x + Math.cos(th) * 14, y + Math.sin(th) * 8, 22); }
    }
    // lily pads
    { const R = rng(6262); for (let i = 0; i < 160 && decals.length < 70; i++) { const x = 650 + R() * 2340, y = 480 + R() * 1960; if (waterOK(x, y, 34) && (!inLake(x, y, 150) || R() < .25)) decal(PR.lilies[Math.floor(R() * 4)], x, y); } }
    // banks: house yards, trees, bushes, flowers, rocks
    const yard = [[PR.barrels, 30], [PR.crates, 34], [PR.firewood, 32], [PR.laundry, 66], [PR.netRack, 40], [PR.fishRack, 40], [PR.flowerBed, 44], [PR.hydr[0], 26], [PR.hydr[1], 26]];
    { const R = rng(7272);
      for (const [hx, hy, key] of HOUSES) {
        if (VAR[key][1]) continue;
        for (let k = 0; k < 3; k++) { const [s, m] = yard[Math.floor(R() * yard.length)]; for (let t = 0; t < 10; t++) { const x = hx - 50 + R() * (FW + 100), y = hy + FH + 10 + R() * 60; if (bankOK(x, y, m)) { place(s, x, y, m); break; } } }
      }
      const flora = [[PR.trees[0], 70], [PR.trees[1], 74], [PR.trees[2], 76], [PR.pines[0], 56], [PR.pines[1], 62], [PR.bamboo, 64], [PR.maple, 70], [PR.bushes[0], 26], [PR.bushes[1], 26], [PR.hydr[0], 26], [PR.hydr[2], 26], [PR.rocks[2], 26], [PR.rocks[3], 30], [PR.rocks[0], 18], [PR.bushes[2], 26]];
      for (let i = 0; i < 900; i++) {
        const x = 450 + R() * 2740, y = 440 + R() * 2770, [s, m] = flora[Math.floor(R() * flora.length)];
        if (m > 50 && (x < 520 || x > 3120 || y > 3150)) continue;   // keep tall trees off the walls
        if (bankOK(x, y, m)) place(s, x, y, m);
      }
    }
    // ---- ambient anchors
    A.ripples = [];
    for (let i = 0; i < 9; i++) { const x = WF.L + 40 + (i + .5) / 9 * (WF.R - WF.L - 80); A.ripples.push({ x, y: 500 + (i % 3) * 30, ph: hash2(i, 1, 7), sc: 1.4 + (i % 2) * .5, sp: .5 }); }
    { const R = rng(3131); for (let i = 0; i < 300 && A.ripples.length < 34; i++) { const x = 700 + R() * 2240, y = 520 + R() * 1900; if (inLake(x, y, 60) && !inDeck(x, y, 40) && !nearFoot(x, y, 30)) A.ripples.push({ x, y, ph: R(), sc: .5 + R() * .5, sp: .3 + R() * .2 }); } }
    A.sparks = []; { const R = rng(4141); for (let i = 0; i < 400 && A.sparks.length < 60; i++) { const x = 650 + R() * 2340, y = 450 + R() * 2000; if (inLake(x, y, 20) && !inDeck(x, y, 20) && !nearFoot(x, y, 20)) A.sparks.push({ x, y, ph: R() * TAU, sp: 1.5 + R() * 1.8 }); } }

    objs.sort((p, q) => p.by - q.by || p.x - q.x);
    ready = true;
  }

  // ------------------------------------------------------------------ drawing
  function deck(ctx, d) {
    ctx.fillStyle = 'rgba(8,45,50,.35)'; ctx.fillRect(d.x + 8, d.y + 8, d.w, d.h + 6);
    ctx.fillStyle = d.d === 'v' ? A.plankH : A.plankV; ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = WOODD.base;
    if (d.d === 'v') { ctx.fillRect(d.x - 4, d.y, 6, d.h); ctx.fillRect(d.x + d.w - 2, d.y, 6, d.h); }
    else { ctx.fillRect(d.x, d.y - 3, d.w, 5); }
    ctx.fillStyle = WOODD.dark; ctx.fillRect(d.x - 4, d.y + d.h, d.w + 8, 8);
    ctx.fillStyle = 'rgba(255,230,180,.35)'; if (d.d === 'v') ctx.fillRect(d.x - 4, d.y, 2, d.h); else ctx.fillRect(d.x, d.y - 3, d.w, 1.5);
    ctx.fillStyle = WOODD.deep;
    if (d.d === 'v') for (let y = d.y + 60; y < d.y + d.h; y += 120) { ctx.fillRect(d.x - 6, y, 8, 12); ctx.fillRect(d.x + d.w - 2, y, 8, 12); }
    else for (let x = d.x + 40; x < d.x + d.w; x += 110) ctx.fillRect(x, d.y + d.h + 6, 9, 10);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.strokeRect(d.x - 4, d.y, d.w + 8, d.h + 8);
  }
  function drawBridge(ctx) {
    const b = BRIDGE;
    ctx.fillStyle = 'rgba(8,45,50,.38)'; ctx.fillRect(b.x + 12, b.y + 10, b.w + 6, b.h);
    ctx.fillStyle = A.plankH; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,240,200,.08)'; ctx.fillRect(b.x, b.y, b.w * .3, b.h);
    ctx.fillStyle = 'rgba(40,20,5,.1)'; ctx.fillRect(b.x + b.w * .75, b.y, b.w * .25, b.h);
    for (const ex of [b.x - 10, b.x + b.w]) { ctx.fillStyle = WOODD.base; ctx.fillRect(ex, b.y, 10, b.h); ctx.fillStyle = WOODD.light; ctx.fillRect(ex, b.y, 3, b.h); ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.strokeRect(ex, b.y, 10, b.h); }
    // rails with bronze-capped posts (giboshi)
    const posts = []; for (let y = b.y + 70; y < b.y + b.h - 40; y += 136) posts.push(y);
    for (const ex of [b.x - 5, b.x + b.w + 5]) {
      ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex, posts[0] - 26); ctx.lineTo(ex, posts[posts.length - 1] - 26); ctx.stroke();
      ctx.strokeStyle = WOOD.base; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = WOOD.hi; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ex - 1, posts[0] - 27); ctx.lineTo(ex - 1, posts[posts.length - 1] - 27); ctx.stroke();
      for (const y of posts) {
        ctx.fillStyle = WOODD.base; ctx.fillRect(ex - 5, y - 30, 10, 32); ctx.fillStyle = WOODD.light; ctx.fillRect(ex - 5, y - 30, 3, 32);
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.strokeRect(ex - 5, y - 30, 10, 32);
        ctx.fillStyle = '#4f8a72'; ctx.beginPath(); ctx.moveTo(ex - 6, y - 30); ctx.quadraticCurveTo(ex - 7, y - 40, ex, y - 44); ctx.quadraticCurveTo(ex + 7, y - 40, ex + 6, y - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9fd0b0'; ctx.fillRect(ex - 3, y - 39, 2, 6);
      }
    }
  }

  function drawStatic(ctx, bounds, isDestroyed) {
    if (!ready) build();
    const dz = typeof isDestroyed === 'function' ? isDestroyed : () => false;
    const x0 = bounds.x, y0 = bounds.y, x1 = x0 + bounds.w, y1 = y0 + bounds.h;
    if (x1 < -160 || x0 > SIZE + 160 || y1 < -160 || y0 > SIZE + 160) return;
    const hit = (x, y, w, h) => x < x1 && x + w > x0 && y < y1 && y + h > y0;
    ctx.save();
    const ix0 = Math.max(0, x0), iy0 = Math.max(0, y0), ix1 = Math.min(SIZE, x1), iy1 = Math.min(SIZE, y1);
    if (ix1 > ix0 && iy1 > iy0) {
      ctx.beginPath(); ctx.rect(ix0, iy0, ix1 - ix0, iy1 - iy0); ctx.clip();
      ctx.fillStyle = A.grassPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      // dirt paths
      for (const d of DIRT) if (hit(d.x - 8, d.y - 8, d.w + 16, d.h + 16)) { ctx.fillStyle = 'rgba(70,55,30,.35)'; rrect(ctx, d.x - 5, d.y - 3, d.w + 10, d.h + 8, 18); ctx.fill(); }
      ctx.fillStyle = A.dirtPat;
      for (const d of DIRT) if (hit(d.x - 8, d.y - 8, d.w + 16, d.h + 16)) { rrect(ctx, d.x, d.y, d.w, d.h, 16); ctx.fill(); }
      // paved road and plaza
      if (hit(ROAD.x - 12, ROAD.y, ROAD.w + 24, ROAD.h)) {
        const ph = 3560 - ROAD.y;
        ctx.fillStyle = '#6a6a58'; ctx.fillRect(ROAD.x - 8, ROAD.y, ROAD.w + 16, ph);
        ctx.strokeStyle = 'rgba(70,55,30,.35)'; ctx.lineWidth = 10; ctx.stroke(A.roadEnd); ctx.fillStyle = A.dirtPat; ctx.fill(A.roadEnd);
        ctx.fillStyle = A.pavePat; ctx.fillRect(ROAD.x, ROAD.y, ROAD.w, ph);
        ctx.fillStyle = '#c9c4ac'; ctx.fillRect(ROAD.x - 8, ROAD.y, 3, ph); ctx.fillRect(ROAD.x + ROAD.w + 5, ROAD.y, 3, ph);
        for (const st of A.roadStones) { fell(ctx, st[0] + 1, st[1] + 1.5, st[2], st[3], 'rgba(60,60,40,.35)'); fell(ctx, st[0], st[1], st[2], st[3], st[4]); }
      }
      if (hit(PLAZA.x - PLAZA.rx - 20, PLAZA.y - PLAZA.ry - 20, PLAZA.rx * 2 + 40, PLAZA.ry * 2 + 40)) {
        ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx + 9, PLAZA.ry + 9, 0, 0, TAU); ctx.fillStyle = '#6a6a58'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fillStyle = A.pavePat; ctx.fill();
        ctx.strokeStyle = '#d4cfb6'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx - 6, PLAZA.ry - 6, 0, 0, TAU); ctx.stroke();
        ctx.drawImage(A.emblem, PLAZA.x - A.emblem.width / 2, PLAZA.y - A.emblem.height / 2);
      }
      // lake
      if (hit(540, 200, 2560, 2300)) {
        ctx.strokeStyle = 'rgba(60,55,30,.5)'; ctx.lineWidth = 52; ctx.stroke(LAKEP);
        ctx.strokeStyle = '#b9ad80'; ctx.lineWidth = 40; ctx.stroke(LAKEP);
        ctx.strokeStyle = '#d3c79a'; ctx.lineWidth = 26; ctx.stroke(LAKEP);
        ctx.fillStyle = A.waterPat; ctx.fill(LAKEP);
        ctx.fillStyle = A.lakeGrad; ctx.fill(LAKEP);
        ctx.save(); ctx.clip(LAKEP);
        ctx.strokeStyle = 'rgba(110,210,190,.32)'; ctx.lineWidth = 130; ctx.stroke(LAKEP);
        ctx.strokeStyle = 'rgba(160,230,205,.4)'; ctx.lineWidth = 46; ctx.stroke(LAKEP);
        ctx.strokeStyle = 'rgba(245,255,250,.75)'; ctx.lineWidth = 7; ctx.stroke(LAKEP);
        // outflow ripples spreading from the plunge pool
        if (hit(WF.L - 120, 400, WF.R - WF.L + 240, 320)) {
          ctx.strokeStyle = 'rgba(225,250,245,.4)'; ctx.lineWidth = 3;
          for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse((WF.L + WF.R) / 2, 430, (WF.R - WF.L) / 2 + 40 + k * 46, 60 + k * 36, 0, .08 * Math.PI, .92 * Math.PI); ctx.stroke(); }
        }
        ctx.restore();
        // island (wet sand rim, grass, forecourt)
        if (hit(ISLE.cx - ISLE.rx - 60, ISLE.cy - ISLE.ry - 60, ISLE.rx * 2 + 120, ISLE.ry * 2 + 120)) {
          ctx.strokeStyle = 'rgba(245,255,250,.7)'; ctx.lineWidth = 56; ctx.stroke(ISLEP);
          ctx.strokeStyle = 'rgba(110,210,190,.5)'; ctx.lineWidth = 50; ctx.stroke(ISLEP);
          ctx.strokeStyle = '#b9ad80'; ctx.lineWidth = 34; ctx.stroke(ISLEP);
          ctx.strokeStyle = '#d6ca9d'; ctx.lineWidth = 22; ctx.stroke(ISLEP);
        }
      }
      // water decals: ripples at posts, lily pads, boats
      for (const d of decals) { const w = d.s.cv.width * d.sc, h = d.s.cv.height * d.sc; if (hit(d.x - w / 2, d.y - h / 2, w, h)) { if (d.sc === 1) ctx.drawImage(d.s.cv, d.x - d.s.ax, d.y - d.s.ay); else ctx.drawImage(d.s.cv, d.x - w / 2, d.y - h / 2, w, h); } }
      // boardwalks and the bridge
      for (const d of DECKS) if (hit(d.x - 10, d.y - 10, d.w + 30, d.h + 30)) deck(ctx, d);
      if (hit(BRIDGE.x - 20, BRIDGE.y - 50, BRIDGE.w + 40, BRIDGE.h + 70)) drawBridge(ctx);
      // island ground drawn over the walkway ends
      if (hit(ISLE.cx - ISLE.rx - 30, ISLE.cy - ISLE.ry - 30, ISLE.rx * 2 + 60, ISLE.ry * 2 + 60)) {
        ctx.fillStyle = A.islePat; ctx.fill(ISLEP);
        ctx.save(); ctx.clip(ISLEP);
        ctx.strokeStyle = 'rgba(30,60,25,.3)'; ctx.lineWidth = 14; ctx.stroke(ISLEP);
        ctx.fillStyle = '#6a6a58'; ctx.fillRect(1734, 1880, 172, 140);
        ctx.fillStyle = A.pavePat; ctx.fillRect(1742, 1880, 156, 140);
        ctx.beginPath(); ctx.ellipse(IPLAZA.x, IPLAZA.y, IPLAZA.rx + 7, IPLAZA.ry + 7, 0, 0, TAU); ctx.fillStyle = '#6a6a58'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(IPLAZA.x, IPLAZA.y, IPLAZA.rx, IPLAZA.ry, 0, 0, TAU); ctx.fillStyle = A.pavePat; ctx.fill();
        ctx.restore();
      }
      // building shadows (towards the lower right)
      ctx.fillStyle = 'rgba(14,40,30,.22)'; ctx.beginPath();
      for (let i = 0; i < foots.length; i++) {
        const f = foots[i]; if (f.solid || f.x === TREE.x || !hit(f.x, f.y, f.w + 30, f.h + 24) || dz(i)) continue;
        const r = f.x + f.w, b = f.y + f.h;
        ctx.moveTo(r, f.y + 40); ctx.lineTo(r + 22, f.y + 56); ctx.lineTo(r + 22, b + 12); ctx.lineTo(f.x + 30, b + 12); ctx.lineTo(f.x + 16, b); ctx.lineTo(r, b); ctx.closePath();
      }
      ctx.fill();
      ctx.restore(); ctx.save();
    }
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (o.x > x1 || o.x + o.w < x0 || o.y > y1 || o.y + o.h < y0) continue;
      if (o.fi >= 0 && dz(o.fi)) continue;
      ctx.drawImage(o.img, o.x, o.y);
    }
    ctx.restore();
  }

  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    const t = time || 0;
    const vx0 = Math.max(view.x, -160), vy0 = Math.max(view.y, -160), vx1 = Math.min(view.x + view.w, SIZE + 160), vy1 = Math.min(view.y + view.h, SIZE + 160);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    ctx.save();
    // 1. falling water: two pre-rendered streak strips scrolled down inside the curtain
    const fx0 = WF.L - 40, fy0 = -40, fy1 = 420;
    if (vx0 < WF.R + 40 && vx1 > fx0 && vy0 < fy1 && vy1 > fy0) {
      ctx.save(); ctx.clip(A.fallP);
      for (let l = 0; l < 2; l++) {
        const S = A.strips[l], H = S.height, sx0 = Math.max(0, vx0 - fx0), sx1 = Math.min(S.width, vx1 - fx0), sw = sx1 - sx0;
        if (sw <= 0) break;
        ctx.globalAlpha = l ? .55 : .9;
        const off = ((t * (l ? 430 : 290)) % H + H) % H;
        for (let y = fy0 - H + off; y < fy1; y += H) if (y + H > vy0 && y < vy1) ctx.drawImage(S, sx0, 0, sw, H, fx0 + sx0, y, sw, H);
      }
      ctx.restore();
      // river surface on the cliff top: short dashes sliding towards the lip
      ctx.globalAlpha = .7; ctx.fillStyle = '#eafffb';
      for (let i = 0; i < 18; i++) { const x = WF.L + 60 + hash2(i, 1, 4) * (WF.R - WF.L - 120), p = (t * .6 + hash2(i, 2, 4)) % 1, y = RTOP + 6 + p * 66; if (x > vx0 && x < vx1 && y > vy0 && y < vy1) ctx.fillRect(x, y, 2, 10 + p * 8); }
    }
    // 2. foam and spray boiling at the foot of the falls
    if (vx0 < WF.R + 160 && vx1 > WF.L - 160 && vy0 < 560 && vy1 > 300) {
      for (let i = 0; i < 24; i++) {
        const x = WF.L - 40 + (i + .5) / 24 * (WF.R - WF.L + 80) + Math.sin(i * 7.1) * 14, p = (t * .7 + hash2(i, 3, 5)) % 1;
        const s = .6 + p * .9, f = A.foam[i % 3], w = f.cv.width * s, h = f.cv.height * s, y = yNb(x) + 14 - p * 34;
        if (x + w < vx0 || x - w > vx1) continue;
        ctx.globalAlpha = .95 * (1 - p); ctx.drawImage(f.cv, x - w / 2, y - h / 2, w, h);
      }
      for (let i = 0; i < 4; i++) {
        const x = WF.L - 140 + i * (WF.R - WF.L + 80) / 3 + Math.sin(t * .4 + i * 2) * 50, y = 330 + Math.sin(t * .6 + i) * 18;
        ctx.globalAlpha = .45 + .18 * Math.sin(t * .9 + i * 1.7); ctx.drawImage(A.mist, x, y);
      }
    }
    // 3. ripples and sparkles on the lake
    if (vx0 < 3100 && vx1 > 560 && vy0 < 2500 && vy1 > 400) {
      for (const r of A.ripples) {
        if (r.x < vx0 - 100 || r.x > vx1 + 100 || r.y < vy0 - 40 || r.y > vy1 + 40) continue;
        const p = (t * r.sp + r.ph) % 1, s = (.25 + p) * r.sc, w = A.ring.cv.width * s, h = A.ring.cv.height * s;
        ctx.globalAlpha = .75 * (1 - p); ctx.drawImage(A.ring.cv, r.x - w / 2, r.y - h / 2, w, h);
      }
      for (const s of A.sparks) {
        if (s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1) continue;
        const a = Math.sin(t * s.sp + s.ph); if (a < .45) continue;
        ctx.globalAlpha = (a - .45) * 1.6; ctx.drawImage(A.spark.cv, s.x - 7, s.y - 7);
      }
    }
    // 4. leaves drifting down from the giant tree
    if (vx0 < 2400 && vx1 > 1240 && vy0 < 2000 && vy1 > 900) {
      for (let i = 0; i < 12; i++) {
        const p = (t * (.08 + hash2(i, 5, 2) * .05) + hash2(i, 6, 2)) % 1, x = 1380 + hash2(i, 7, 2) * 880 + Math.sin(t * 1.3 + i) * 26 + p * 60, y = 1060 + p * 820;
        if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
        ctx.globalAlpha = Math.min(1, (1 - p) * 3); ctx.drawImage(A.leaves[i % 3].cv, x - 5, y - 4);
      }
    }
    // 5. drifting mist banks over the valley
    ctx.globalAlpha = .22;
    const PX = 2900, PY = 2400, MW = A.mistBig.width, MH = A.mistBig.height;
    for (let i = 0; i < 3; i++) {
      const bx = hash2(i, 1, 3) * PX + t * (9 + i * 4), by = hash2(i, 2, 3) * PY + Math.sin(t * .05 + i * 1.7) * 50;
      const kx0 = Math.floor((vx0 - MW - bx) / PX), ky0 = Math.floor((vy0 - MH - by) / PY);
      for (let kx = kx0; kx <= kx0 + 1; kx++) for (let ky = ky0; ky <= ky0 + 1; ky++) {
        const x = bx + kx * PX, y = by + ky * PY;
        if (x < vx1 && x + MW > vx0 && y < vy1 && y + MH > vy0) ctx.drawImage(A.mistBig, x, y);
      }
    }
    ctx.restore();
  }

  function drawMinimap(ctx) {
    if (!ready) build();
    ctx.save();
    ctx.fillStyle = '#4f8e3e'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#c9ad7f'; for (const d of DIRT) ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#c4c0a8'; ctx.fillRect(ROAD.x, ROAD.y, ROAD.w, ROAD.h);
    ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b9a9c'; ctx.fill(LAKEP);
    ctx.fillStyle = '#2c4d2a'; ctx.fillRect(0, 0, SIZE, 300); ctx.fillRect(0, 0, 400, SIZE); ctx.fillRect(3240, 0, 400, SIZE);
    ctx.fillStyle = '#355f2f'; ctx.fillRect(400, 3240, GL - 400, 400); ctx.fillRect(GR, 3240, 3240 - GR, 400);
    ctx.fillStyle = '#6e8a62'; ctx.fillRect(400, 300, 2840, 100);
    ctx.fillStyle = '#e8faf5'; ctx.fillRect(WF.L, 0, WF.R - WF.L, 420); ctx.fillStyle = '#5fc4c4'; ctx.fillRect(WF.L + 140, 0, WF.R - WF.L - 280, 300);
    ctx.fillStyle = '#5fa04a'; ctx.fill(ISLEP);
    ctx.fillStyle = '#a0703f'; for (const d of DECKS) ctx.fillRect(d.x, d.y, d.w, d.h); ctx.fillRect(BRIDGE.x, BRIDGE.y, BRIDGE.w, BRIDGE.h);
    for (const f of foots) {
      if (f.solid || f.x === TREE.x) continue;
      ctx.fillStyle = f.roof; ctx.fillRect(f.x + 16, f.y + 16, f.w - 32, f.h - 32);
      ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 14; ctx.strokeRect(f.x + 16, f.y + 16, f.w - 32, f.h - 32);
    }
    ctx.fillStyle = '#2f7a34'; ctx.beginPath(); ctx.ellipse(TREE.x + TREE.w / 2, TREE.y - 150, 330, 260, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 40; ctx.stroke();
    ctx.fillStyle = '#7b5b3b'; ctx.beginPath(); ctx.arc(TREE.x + TREE.w / 2, TREE.y + TREE.h / 2, 90, 0, TAU); ctx.fill();
    ctx.restore();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  const mod = window.ShinobiVillages.taki = {
    id: 'taki', name: 'LÀNG THÁC NƯỚC', jp: '滝隠れの里', kage: 'KAKUZU',
    cols: NC, rows: NC,
    gate: { side: 's', at: 1820 },
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
