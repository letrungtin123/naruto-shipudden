/* village-oto.js — Otogakure no Sato (Hidden Sound Village, Land of Rice Fields).
   Orochimaru's hidden hideout compound: stone bunkers, half-buried lair entrances, bell towers, laboratory sheds
   with specimen jars, snake statues, all enclosed by a forested rock ridge. Registers window.ShinobiVillages.oto.
   Procedural Canvas 2D in the same 3/4 oblique, cel-shaded style as the other villages (light from the top-left,
   dark outlines, cached sprites). No external images. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, NC = 7, SIZE = BLOCK * NC;
  const OUT = '#24221f';
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const SM = 34, OVER = 136, BM = 28;          // building canvas margins: sides / above the footprint / below
  const FW = 320, FH = 300;                     // house footprint
  const LW = 440, LH = 400, LOVER = 216;        // hideout footprint and its overhang
  const LM = { x: 1600, y: 1600 };
  const ROAD = { x: 1720, y: 1990, w: 200, h: SIZE - 1990 };
  const PLAZA = { x: 1580, y: 1990, w: 480, h: 572 };
  const STREETS = [
    { x: 996, y: 400, w: 88, h: 2840 }, { x: 2556, y: 400, w: 88, h: 2840 },
    { x: 400, y: 996, w: 2840, h: 88 }, { x: 400, y: 2556, w: 2840, h: 88 }
  ];
  const SPAWN = { x: 1820, y: 3010 };

  const EARTH = '#5d6046';
  const MOSS = { base: '#5a7a3a', light: '#86a352', dark: '#3e5a2a', deep: '#2a3f1f' };
  const PURP = { base: '#7b4fa0', light: '#a886cc', dark: '#533274', deep: '#351d4e' };
  const ROCKP = { base: '#79817b', light: '#a3aba3', dark: '#576059', deep: '#3f4742' };
  const WOOD = { base: '#6a5240', light: '#8c705a', dark: '#4a392d', deep: '#30251e' };
  const TR = { out: '#0e1712', d: '#1b3022', m: '#284530', l: '#3b5f42', h: '#5d845c' };
  const SHADOW = 'rgba(10,18,12,.32)';
  const GLOW_P = 'rgba(178,128,232,.7)', GLOW_A = 'rgba(236,196,112,.62)', GLOW_G = 'rgba(140,226,150,.7)';
  const LIQ = ['#7fcf86', '#d4ba5c', '#a47cc6', '#8fb39a'];

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
  // cool tone ramp: shadows go green-black
  function tone(base) { return { base, light: mix(base, '#eef4e6', .3), hi: mix(base, '#fafff2', .56), dark: mix(base, '#141c18', .3), deep: mix(base, '#0c120e', .52) }; }
  // smooth periodic wobble (period = one block), range ~[0,1]
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
  function quadPt(x1, y1, cx, cy, x2, y2, t) { const m = 1 - t; return [m * m * x1 + 2 * m * t * cx + t * t * x2, m * m * y1 + 2 * m * t * cy + t * t * y2]; }
  function archPath(x, y, w, h) { const p = new Path2D(), r = w / 2; p.moveTo(x, y + h); p.lineTo(x, y + Math.min(r, h)); p.arc(x + r, y + Math.min(r, h), r, Math.PI, 0); p.lineTo(x + w, y + h); p.closePath(); return p; }
  function tuft(c, x, y, s = 1) {
    for (let k = -2; k <= 2; k++) line(c, x + k * 1.6 * s, y, x + k * 3.2 * s, y - (6 + (2 - Math.abs(k)) * 3) * s, k % 2 ? '#86a552' : '#5c7e3a', 1.4);
  }
  function grassTex(c, path, x, y, w, h, n, seed) {
    const R = rng(seed); c.save(); c.clip(path);
    for (let i = 0; i < n; i++) { const px = x + R() * w, py = y + R() * h, r = 6 + R() * 14; fell(c, px, py, r, r * .5, R() < .5 ? 'rgba(134,163,82,.45)' : 'rgba(40,62,28,.4)'); }
    for (let i = 0; i < n * 1.4; i++) tuft(c, x + R() * w, y + R() * h, .7 + R() * .5);
    c.restore();
  }

  // ------------------------------------------------------------------ stone & slate building kit
  // stone-block front face with mortar courses, moss and cel shading
  function stoneFace(c, x, y, w, h, T, o = {}) {
    const rh = o.rh || 15, R = rng(o.seed || ((x * 31 + y * 17 + w * 7 + h) | 0));
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    frect(c, x, y, w, h, T.base);
    for (let r = 0, yy = y; yy < y + h; r++, yy += rh) {
      let xx = x - R() * rh * 2;
      while (xx < x + w) {
        const bw = rh * (1.5 + R() * 1.7), q = R();
        if (q < .28) frect(c, xx + 1, yy + 1, bw - 2, rh - 2, 'rgba(235,242,228,.14)');
        else if (q > .74) frect(c, xx + 1, yy + 1, bw - 2, rh - 2, 'rgba(15,22,18,.15)');
        frect(c, xx + 2, yy + 1.5, bw - 4, 1.5, 'rgba(240,246,232,.24)');
        frect(c, xx, yy, 1.6, rh, 'rgba(20,26,22,.45)');
        if (R() < .08) line(c, xx + bw * .3, yy + 2, xx + bw * .5, yy + rh - 2, 'rgba(20,26,22,.4)', 1);
        xx += bw;
      }
      frect(c, x, yy, w, 1.6, 'rgba(20,26,22,.5)');
    }
    const mo = o.moss ?? .6;
    if (mo > 0) {
      for (let i = 0; i < w / 10 * mo; i++) { const mx = x + R() * w; frect(c, mx, y, 2 + R() * 3, 5 + R() * 20 * mo, 'rgba(70,100,48,.34)'); }
      for (let i = 0; i < w / 8 * mo; i++) { const mx = x + R() * w, r = 4 + R() * 9; fell(c, mx, y + h - R() * 4, r, r * .55, R() < .5 ? MOSS.dark : MOSS.base); }
      for (let i = 0; i < w / 16 * mo; i++) { const mx = x + R() * w, r = 3 + R() * 5; fell(c, mx - 1, y + h - 4 - R() * 4, r, r * .45, MOSS.light); }
    }
    c.fillStyle = 'rgba(235,244,228,.2)'; c.fillRect(x, y, 6, h);
    c.fillStyle = 'rgba(235,244,228,.08)'; c.fillRect(x + 6, y, 8, h);
    c.fillStyle = 'rgba(8,14,10,.2)'; c.fillRect(x + w - 16, y, 16, h);
    c.fillStyle = 'rgba(8,14,10,.16)'; c.fillRect(x + w - 6, y, 6, h);
    if (o.eave !== false) { c.fillStyle = 'rgba(8,12,10,.32)'; c.fillRect(x, y, w, o.eave || 6); }
    c.restore();
    srect(c, x, y, w, h, OUT, 2);
  }
  // box: top surface y..y+d, front face y+d..y+d+h
  function stoneBox(c, x, y, w, d, h, T, o = {}) {
    const fy = y + d, by = fy + h;
    if (o.shadow !== false) { c.fillStyle = SHADOW; c.fillRect(x + 14, fy + 12, w, h - 4); }
    stoneFace(c, x, fy, w, h, T, o);
    if (o.top && o.top !== 'none') {
      const tp = [x, fy, x, y, x + w, y, x + w, fy];
      fpoly(c, tp, T.light);
      c.save(); c.beginPath(); c.rect(x + 6, y + 6, w - 12, d - 8); c.clip();
      const R = rng((x * 13 + y * 7) | 0);
      if (o.top === 'moss') {
        frect(c, x, y, w, d, MOSS.base);
        for (let i = 0; i < w * d / 500; i++) { const px = x + R() * w, py = y + R() * d, r = 5 + R() * 12; fell(c, px, py, r, r * .5, R() < .5 ? MOSS.light : MOSS.dark); }
        for (let i = 0; i < w * d / 260; i++) tuft(c, x + R() * w, y + 6 + R() * d, .8);
      } else {
        frect(c, x, y, w, d, mix(T.base, T.light, .4));
        c.strokeStyle = 'rgba(20,26,22,.3)'; c.lineWidth = 1; c.beginPath();
        for (let i = x + 30 + R() * 10; i < x + w - 6; i += 28 + R() * 14) { c.moveTo(i, y); c.lineTo(i, fy); }
        if (d > 30) { c.moveTo(x, y + d / 2); c.lineTo(x + w, y + d / 2); }
        c.stroke();
        for (let i = 0; i < w / 40; i++) fell(c, x + R() * w, y + R() * d, 6 + R() * 10, 3 + R() * 3, 'rgba(84,116,58,.5)');
      }
      c.fillStyle = 'rgba(8,12,10,.28)'; c.fillRect(x, y, w, 7); c.fillRect(x, y, 7, d);
      c.restore();
      frect(c, x - 2, fy - 3, w + 4, 6, T.hi); frect(c, x - 2, fy + 3, w + 4, 2, T.dark);
      poly(c, tp); sk(c, OUT, 2); srect(c, x - 2, fy - 3, w + 4, 8, OUT, 1.4);
    }
    return { x, y, w, d, fy, by };
  }
  // Japanese hip roof seen in 3/4 view: back slope, hips, tiled front slope, ridge with ornaments
  function roofJ(c, x, y, w, d, R, o = {}) {
    const rf = o.rf ?? .34, hip = o.hip ?? Math.round(w * .16), L = x, Rt = x + w, T = y, B = y + d, ry = y + d * rf, ti = hip * .5;
    c.fillStyle = 'rgba(8,12,10,.34)'; c.fillRect(L + 8, B - 2, w - 16, 12);
    const sil = [L + ti, T, Rt - ti, T, Rt, B, L, B];
    const back = [L + ti, T, Rt - ti, T, Rt - hip, ry, L + hip, ry];
    const lh = [L + ti, T, L + hip, ry, L, B], rh = [Rt - ti, T, Rt - hip, ry, Rt, B];
    const front = [L, B, Rt, B, Rt - hip, ry, L + hip, ry];
    fpoly(c, back, R.light); fpoly(c, lh, mix(R.base, R.light, .5)); fpoly(c, rh, R.dark); fpoly(c, front, R.base);
    c.save(); poly(c, front); c.clip();
    c.lineWidth = 1.8; c.strokeStyle = R.dark; c.beginPath();
    for (let tx = L + 5; tx < Rt; tx += 9) { c.moveTo(tx, ry); c.lineTo(tx, B); } c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(235,242,230,.18)'; c.beginPath();
    for (let tx = L + 8; tx < Rt; tx += 9) { c.moveTo(tx, ry); c.lineTo(tx, B); } c.stroke();
    c.strokeStyle = 'rgba(10,14,12,.34)'; c.lineWidth = 1.6; c.beginPath();
    for (let yy = ry + 11; yy < B - 4; yy += 11) { c.moveTo(L, yy); c.lineTo(Rt, yy); } c.stroke();
    c.fillStyle = 'rgba(8,12,10,.25)'; c.fillRect(L, ry, w, 6);
    c.restore();
    c.save(); poly(c, back); c.clip();
    c.lineWidth = 1.4; c.strokeStyle = R.base; c.beginPath();
    for (let tx = L + 5; tx < Rt; tx += 9) { c.moveTo(tx, T); c.lineTo(tx, ry); } c.stroke();
    c.restore();
    if (o.moss) {
      const Rm = rng((x * 7 + y * 3 + w) | 0);
      c.save(); poly(c, sil); c.clip();
      for (let i = 0; i < w / 22; i++) { const mx = L + 10 + Rm() * (w - 20), my = ry + 6 + Rm() * (B - ry - 12), r = 6 + Rm() * 12; fell(c, mx, my, r, r * .45, 'rgba(78,110,52,.75)'); fell(c, mx - r * .3, my - r * .2, r * .5, r * .2, 'rgba(140,170,90,.55)'); }
      c.restore();
    }
    frect(c, L, B - 7, w, 7, R.deep);
    c.fillStyle = R.light; for (let tx = L + 5; tx < Rt - 2; tx += 9) { c.beginPath(); c.arc(tx + 4, B - 3.5, 2.2, 0, TAU); c.fill(); }
    line(c, L + hip, ry, L + 2, B - 4, R.deep, 4.5); line(c, L + hip - 1.5, ry, L + .5, B - 5, R.hi, 1.2);
    line(c, Rt - hip, ry, Rt - 2, B - 4, R.deep, 4.5);
    line(c, L + hip, ry, L + ti, T + 1, R.deep, 3); line(c, Rt - hip, ry, Rt - ti, T + 1, R.deep, 3);
    const rc = o.ridge || R.deep;
    line(c, L + hip - 4, ry, Rt - hip + 4, ry, OUT, 10); line(c, L + hip - 4, ry, Rt - hip + 4, ry, rc, 7);
    line(c, L + hip - 2, ry - 2, Rt - hip + 2, ry - 2, o.ridge ? PURP.light : R.hi, 1.5);
    for (const ex of [L + hip - 5, Rt - hip + 5]) { fell(c, ex, ry - 3, 7, 7, rc); c.beginPath(); c.arc(ex, ry - 3, 7, 0, TAU); sk(c, OUT, 1.5); fell(c, ex - 2, ry - 5, 2.2, 2.2, 'rgba(255,255,255,.35)'); }
    if (o.flare) for (const s of [-1, 1]) {
      const ex = s < 0 ? L : Rt;
      const pts = [ex + s * 10, B - 17, ex - s * 18, B - 7, ex - s * 14, B, ex + s * 3, B - 4];
      fpoly(c, pts, R.deep); poly(c, pts); sk(c, OUT, 1.5);
    }
    poly(c, sil); sk(c, OUT, 2);
  }
  function ironDoor(c, x, y, w, h, o = {}) {
    const fr = o.arch ? archPath(x - 6, y - 6, w + 12, h + 6) : (() => { const p = new Path2D(); p.rect(x - 6, y - 6, w + 12, h + 6); return p; })();
    c.fillStyle = o.frame || '#505752'; c.fill(fr); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(fr);
    const dp = o.arch ? archPath(x, y, w, h) : (() => { const p = new Path2D(); p.rect(x, y, w, h); return p; })();
    c.save(); c.clip(dp);
    frect(c, x, y, w, h, '#3a3f3d');
    c.strokeStyle = 'rgba(10,14,12,.5)'; c.lineWidth = 1; c.beginPath(); for (let xx = x + 7; xx < x + w; xx += 7) { c.moveTo(xx, y); c.lineTo(xx, y + h); } c.stroke();
    for (const f of [.24, .56, .86]) {
      const yy = y + h * f; frect(c, x, yy, w, 5, '#272b29'); frect(c, x, yy, w, 1.2, 'rgba(200,210,200,.25)');
      for (let xx = x + 4; xx < x + w - 2; xx += 8) fell(c, xx, yy + 2.5, 1.3, 1.3, '#a4ada6');
    }
    frect(c, x, y, 3, h, 'rgba(220,230,220,.15)');
    if (o.ajar) { frect(c, x + w / 2 - 3, y, 7, h, '#0b0c0b'); frect(c, x + w / 2 - 1, y + 4, 3, h - 4, 'rgba(176,124,232,.6)'); }
    else line(c, x + w / 2, y, x + w / 2, y + h, '#1e2120', 1.6);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(dp);
    for (const dx of [-7, 7]) { c.beginPath(); c.arc(x + w / 2 + dx, y + h * .46, 3.6, 0, TAU); sk(c, '#b08a4a', 1.8); }
    frect(c, x - 8, y + h, w + 16, 5, '#8a8f88'); frect(c, x - 8, y + h, w + 16, 1.5, '#b4b9b0'); srect(c, x - 8, y + h, w + 16, 5, OUT, 1.2);
  }
  function slitWin(c, x, y, w, h, glow) {
    frect(c, x - 3, y - 3, w + 6, h + 6, '#4f5651'); frect(c, x, y, w, h, '#141715');
    if (glow) frect(c, x + 1, y + h * .4, w - 2, h * .6, glow);
    frect(c, x - 4, y + h + 2, w + 8, 3, '#9aa098'); srect(c, x - 3, y - 3, w + 6, h + 6, OUT, 1.2);
  }
  function rope(c, x1, y1, x2, y2, sag, o = {}) {
    const cx = (x1 + x2) / 2, cy = Math.max(y1, y2) + sag * 2, w = o.w || 6;
    const p = new Path2D(); p.moveTo(x1, y1); p.quadraticCurveTo(cx, cy, x2, y2);
    c.strokeStyle = OUT; c.lineWidth = w + 3; c.stroke(p);
    c.strokeStyle = PURP.base; c.lineWidth = w; c.stroke(p);
    c.setLineDash([3, 4]); c.strokeStyle = PURP.dark; c.lineWidth = w * .75; c.stroke(p); c.setLineDash([]);
    c.save(); c.translate(-.5, -w * .28); c.strokeStyle = PURP.light; c.lineWidth = 1.2; c.stroke(p); c.restore();
    if (o.shide !== false) {
      const n = o.n || 3;
      for (let k = 1; k <= n; k++) {
        const [px, py] = quadPt(x1, y1, cx, cy, x2, y2, k / (n + 1)), s = w / 6;
        const z = [px - 3 * s, py + 2, px + 2 * s, py + 2, px + 2 * s, py + 9 * s, px + 5 * s, py + 9 * s, px + 5 * s, py + 17 * s, px, py + 17 * s, px, py + 10 * s, px - 3 * s, py + 10 * s];
        fpoly(c, z, '#eeeae0'); poly(c, z); sk(c, 'rgba(36,34,31,.7)', .8);
      }
    }
  }
  // Orochimaru's purple rope bow
  function ropeBow(c, x, y, s) {
    for (const sx of [-1, 1]) {
      const tl = [x, y, x + sx * 6 * s, y + 18 * s, x + sx * 2 * s, y + 22 * s, x + sx * 1 * s, y + 4 * s];
      fpoly(c, tl, PURP.dark); poly(c, tl); sk(c, OUT, 1.2);
    }
    for (const sx of [-1, 1]) {
      c.save(); c.translate(x + sx * 10 * s, y - 1 * s); c.rotate(sx * -.42);
      fell(c, 0, 0, 11 * s, 6 * s, PURP.base); fell(c, -1.5 * s, -1.5 * s, 7 * s, 2.6 * s, PURP.light); fell(c, sx * 2 * s, .5 * s, 4 * s, 2 * s, PURP.deep);
      c.beginPath(); c.ellipse(0, 0, 11 * s, 6 * s, 0, 0, TAU); sk(c, OUT, 1.3); c.restore();
    }
    fell(c, x, y, 4.5 * s, 4.5 * s, PURP.dark); c.beginPath(); c.arc(x, y, 4.5 * s, 0, TAU); sk(c, OUT, 1.2);
  }
  // the Sound crest: an eighth note
  function noteSym(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.fillStyle = col;
    c.beginPath(); c.ellipse(0, 0, 7 * s, 5 * s, -.4, 0, TAU); c.fill();
    c.fillRect(4.4 * s, -26 * s, 2.7 * s, 25 * s);
    c.beginPath(); c.moveTo(4.4 * s, -26 * s); c.bezierCurveTo(8 * s, -18 * s, 18 * s, -16 * s, 14 * s, -5 * s); c.bezierCurveTo(13 * s, -12 * s, 9 * s, -15 * s, 6 * s, -17 * s); c.closePath(); c.fill();
    c.restore();
  }
  function crestDisc(c, x, y, r, bg = '#efe9dc', fg = '#1e1b22') {
    fell(c, x, y, r, r, bg); c.beginPath(); c.arc(x, y, r, 0, TAU); sk(c, OUT, 1.2);
    noteSym(c, x - r * .2, y + r * .42, r / 30 * 1.75, fg);
  }
  function hangBanner(c, x, y, w, h, col = PURP.base) {
    line(c, x - 4, y, x + w + 4, y, WOOD.dark, 3.5);
    const cl = [x, y + 2, x + w, y + 2, x + w, y + h, x + w / 2, y + h - 9, x, y + h];
    fpoly(c, cl, col); c.save(); poly(c, cl); c.clip();
    frect(c, x + w - 5, y, 5, h, 'rgba(0,0,0,.22)'); frect(c, x, y, 3, h, 'rgba(255,255,255,.18)');
    c.restore(); poly(c, cl); sk(c, OUT, 1.3);
    crestDisc(c, x + w / 2, y + h * .36, w * .34);
  }
  function snakeFace(c, x, y, s, T, eye = '#e3b84a') {
    const p = new Path2D();
    p.moveTo(x - 22 * s, y - 8 * s); p.quadraticCurveTo(x, y - 19 * s, x + 22 * s, y - 8 * s); p.quadraticCurveTo(x + 21 * s, y + 7 * s, x + 7 * s, y + 15 * s);
    p.quadraticCurveTo(x, y + 19 * s, x - 7 * s, y + 15 * s); p.quadraticCurveTo(x - 21 * s, y + 7 * s, x - 22 * s, y - 8 * s); p.closePath();
    celFill(c, p, T.base, T.light, T.dark, { ld: 3 * s, dd: 4 * s });
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(p);
    for (const sx of [-1, 1]) {
      fell(c, x + sx * 12 * s, y - 3 * s, 5 * s, 3.2 * s, eye); fell(c, x + sx * 12 * s, y - 3 * s, 1.1 * s, 2.8 * s, '#1a1410');
      c.beginPath(); c.ellipse(x + sx * 12 * s, y - 3 * s, 5 * s, 3.2 * s, 0, 0, TAU); sk(c, OUT, 1);
      line(c, x + sx * 19 * s, y - 10 * s, x + sx * 5 * s, y - 7 * s, T.deep, 1.6 * s);
      fell(c, x + sx * 3.5 * s, y + 10 * s, 1.4 * s, 1 * s, T.deep);
      const f = [x + sx * 5.5 * s, y + 14.5 * s, x + sx * 3.6 * s, y + 24 * s, x + sx * 2 * s, y + 15.5 * s];
      fpoly(c, f, '#ece6d0'); poly(c, f); sk(c, OUT, .9);
    }
  }
  // a thick cel-shaded tube (snake bodies)
  function tube(c, path, w, T) {
    c.strokeStyle = OUT; c.lineWidth = w + 4; c.stroke(path);
    c.strokeStyle = T.dark; c.lineWidth = w; c.stroke(path);
    c.save(); c.translate(-w * .1, -w * .16); c.strokeStyle = T.base; c.lineWidth = w * .7; c.stroke(path); c.restore();
    c.save(); c.translate(-w * .2, -w * .3); c.strokeStyle = T.light; c.lineWidth = w * .2; c.stroke(path); c.restore();
    c.setLineDash([2, w * .32]); c.strokeStyle = 'rgba(25,32,28,.32)'; c.lineWidth = w * .55; c.stroke(path); c.setLineDash([]);
  }
  function mossRock(c, x, y, r, seed, pal = ROCKP) {
    const R = rng(seed), pts = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI, rr = r * (.8 + R() * .35); pts.push([x + Math.cos(a) * rr * 1.1, y - 2 + Math.sin(a) * rr]); }
    pts.push([x + r * .9, y + r * .12], [x, y + r * .22], [x - r * .9, y + r * .12]);
    fell(c, x + r * .5, y + r * .16, r * 1.15, r * .34, 'rgba(10,18,12,.32)');
    const p = pathFrom(pts);
    celFill(c, p, pal.base, pal.light, pal.dark, { ld: r * .25, dd: r * .35, deep: pal.deep, deepD: Math.max(1.5, r * .12) });
    c.save(); c.clip(p);
    fell(c, x - r * .2, y - r * .9, r * .85, r * .36, 'rgba(90,124,58,.85)');
    fell(c, x - r * .38, y - r * 1.0, r * .45, r * .16, 'rgba(150,182,96,.65)');
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = r > 20 ? 2 : 1.5; c.stroke(p);
    if (r > 15) { c.beginPath(); c.moveTo(x + r * .1, y - r * .6); c.lineTo(x + r * .3, y - r * .3); c.lineTo(x + r * .2, y); sk(c, 'rgba(25,32,28,.55)', 1.3); }
  }

  // ------------------------------------------------------------------ prop drawing
  function drawPineO(c, ax, ay, s, seed) {
    const R = rng(seed);
    fell(c, ax + 14 * s, ay + 1, 34 * s, 10 * s, 'rgba(4,10,6,.38)');
    frect(c, ax - 4.5 * s, ay - 30 * s, 9 * s, 30 * s, '#3b2d23'); frect(c, ax - 4.5 * s, ay - 30 * s, 3 * s, 30 * s, '#5a4433');
    srect(c, ax - 4.5 * s, ay - 30 * s, 9 * s, 30 * s, TR.out, 1.2);
    for (let k = 0; k < 5; k++) {
      const yb = ay - 20 * s - k * 23 * s, w = (40 - k * 7) * s * (.92 + R() * .16), top = yb - (40 - k * 3) * s, lean = (R() - .5) * 4 * s, n = 7;
      const p = new Path2D(); p.moveTo(ax + lean, top); p.lineTo(ax + w, yb);
      for (let i = n - 1; i >= 1; i--) { const u = i / n; p.lineTo(ax - w + 2 * w * u, yb + Math.sin(u * Math.PI) * 5 * s + (i % 2 ? 4 * s : -3 * s)); }
      p.lineTo(ax - w, yb); p.closePath();
      celFill(c, p, TR.m, TR.l, TR.d, { ld: 4 * s, dd: 6 * s });
      c.strokeStyle = TR.out; c.lineWidth = 1.5; c.stroke(p);
      for (let i = 0; i < 3; i++) { const hx = ax - w * (.2 + R() * .5), hy = yb - (8 + R() * 14) * s; line(c, hx, hy, hx + 5 * s, hy - 4 * s, TR.h, 1.2); }
    }
  }
  function drawBroadO(c, ax, ay, s, seed) {
    const R = rng(seed);
    fell(c, ax + 16 * s, ay + 1, 42 * s, 12 * s, 'rgba(4,10,6,.38)');
    const tr = new Path2D(); tr.moveTo(ax - 6 * s, ay); tr.quadraticCurveTo(ax - 3 * s, ay - 26 * s, ax - 10 * s, ay - 52 * s); tr.lineTo(ax + 3 * s, ay - 52 * s); tr.quadraticCurveTo(ax + 4 * s, ay - 26 * s, ax + 7 * s, ay); tr.closePath();
    celFill(c, tr, '#3f3226', '#5c4a38', '#2a2119', { ld: 2 * s, dd: 3 * s }); c.strokeStyle = TR.out; c.lineWidth = 1.3; c.stroke(tr);
    const cy = ay - 76 * s, blobs = [];
    for (let i = 0; i < 12; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 34 * s; blobs.push([ax + Math.cos(a) * d * 1.25, cy + Math.sin(a) * d * .8, (16 + R() * 10) * s]); }
    blobs.sort((p, q) => p[1] - q[1]);
    for (const [x, y, r] of blobs) fell(c, x, y, r + 2, r * .9 + 2, TR.out);
    for (const [x, y, r] of blobs) { fell(c, x, y, r, r * .9, TR.d); fell(c, x - r * .12, y - r * .14, r * .86, r * .74, TR.m); fell(c, x - r * .34, y - r * .36, r * .46, r * .36, TR.l); }
    for (let i = 0; i < 6; i++) { const [x, y, r] = blobs[i]; fell(c, x - r * .45, y - r * .5, r * .18, r * .13, TR.h); }
  }
  function drawDeadO(c, ax, ay, s, seed) {
    const R = rng(seed), segs = [];
    fell(c, ax + 10 * s, ay + 1, 26 * s, 7 * s, 'rgba(4,10,6,.35)');
    const br = (x, y, a, len, w, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; segs.push([x, y, x2, y2, w]);
      if (d > 0) { br(x2, y2, a - .35 - R() * .4, len * (.62 + R() * .15), w * .65, d - 1); br(x2, y2, a + .3 + R() * .4, len * (.6 + R() * .15), w * .65, d - 1); }
    };
    br(ax, ay, -Math.PI / 2 + (R() - .5) * .2, 44 * s, 9 * s, 4);
    for (const [x1, y1, x2, y2, w] of segs) line(c, x1, y1, x2, y2, TR.out, w + 2.4);
    for (const [x1, y1, x2, y2, w] of segs) line(c, x1, y1, x2, y2, '#5b544c', w);
    for (const [x1, y1, x2, y2, w] of segs) if (w > 2) line(c, x1 - w * .2, y1, x2 - w * .2, y2, '#837a6e', w * .3);
  }
  function toro(c, x, y, s = 1) {
    const st = tone('#8f958d');
    fell(c, x + 6 * s, y, 14 * s, 4.5 * s, SHADOW);
    frect(c, x - 10 * s, y - 7 * s, 20 * s, 7 * s, st.dark); srect(c, x - 10 * s, y - 7 * s, 20 * s, 7 * s, OUT, 1.2);
    frect(c, x - 4 * s, y - 26 * s, 8 * s, 19 * s, st.base); frect(c, x - 4 * s, y - 26 * s, 3 * s, 19 * s, st.light); srect(c, x - 4 * s, y - 26 * s, 8 * s, 19 * s, OUT, 1.2);
    frect(c, x - 9 * s, y - 31 * s, 18 * s, 5 * s, st.dark); srect(c, x - 9 * s, y - 31 * s, 18 * s, 5 * s, OUT, 1.2);
    frect(c, x - 7 * s, y - 44 * s, 14 * s, 13 * s, st.base); frect(c, x - 4 * s, y - 41 * s, 8 * s, 8 * s, '#f2c46a'); frect(c, x - 4 * s, y - 41 * s, 3 * s, 8 * s, '#fff0b0');
    srect(c, x - 7 * s, y - 44 * s, 14 * s, 13 * s, OUT, 1.2);
    const rf = [x - 15 * s, y - 44 * s, x, y - 55 * s, x + 15 * s, y - 44 * s, x + 11 * s, y - 41 * s, x - 11 * s, y - 41 * s];
    fpoly(c, rf, st.base); fpoly(c, [x - 15 * s, y - 44 * s, x, y - 55 * s, x, y - 41 * s, x - 11 * s, y - 41 * s], st.light); poly(c, rf); sk(c, OUT, 1.3);
    fell(c, x - 5 * s, y - 47 * s, 6 * s, 2 * s, 'rgba(90,122,58,.85)');
    fell(c, x, y - 57 * s, 2.6 * s, 2.6 * s, st.dark); c.beginPath(); c.arc(x, y - 57 * s, 2.6 * s, 0, TAU); sk(c, OUT, 1);
  }
  function brazier(c, x, y, s = 1) {
    fell(c, x + 6 * s, y, 14 * s, 4 * s, SHADOW);
    frect(c, x - 5 * s, y - 26 * s, 10 * s, 26 * s, '#6f7670'); frect(c, x - 5 * s, y - 26 * s, 3 * s, 26 * s, '#969d95'); srect(c, x - 5 * s, y - 26 * s, 10 * s, 26 * s, OUT, 1.2);
    const p = new Path2D(); p.moveTo(x - 14 * s, y - 34 * s); p.quadraticCurveTo(x, y - 14 * s, x + 14 * s, y - 34 * s); p.closePath();
    c.fillStyle = '#3d4240'; c.fill(p); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(p);
    fell(c, x, y - 34 * s, 14 * s, 4 * s, '#2a2d2b'); c.beginPath(); c.ellipse(x, y - 34 * s, 14 * s, 4 * s, 0, 0, TAU); sk(c, OUT, 1.2);
    fpoly(c, [x - 10 * s, y - 34 * s, x - 7 * s, y - 50 * s, x - 2 * s, y - 42 * s, x + 2 * s, y - 60 * s, x + 6 * s, y - 44 * s, x + 9 * s, y - 52 * s, x + 11 * s, y - 34 * s], '#e8742a');
    fpoly(c, [x - 6 * s, y - 34 * s, x - 1 * s, y - 49 * s, x + 3 * s, y - 40 * s, x + 6 * s, y - 34 * s], '#ffd25a');
    fell(c, x, y - 36 * s, 5 * s, 2 * s, '#fff1b0');
  }
  function bell(c, x, y, s) {
    const p = new Path2D();
    p.moveTo(x - 6 * s, y); p.quadraticCurveTo(x - 10 * s, y + 2 * s, x - 10 * s, y + 10 * s); p.lineTo(x - 11 * s, y + 20 * s); p.quadraticCurveTo(x - 13 * s, y + 24 * s, x - 12 * s, y + 25 * s);
    p.lineTo(x + 12 * s, y + 25 * s); p.quadraticCurveTo(x + 13 * s, y + 24 * s, x + 11 * s, y + 20 * s); p.lineTo(x + 10 * s, y + 10 * s); p.quadraticCurveTo(x + 10 * s, y + 2 * s, x + 6 * s, y); p.closePath();
    celFill(c, p, '#86683a', '#c4a060', '#5a4224', { ld: 2.5 * s, dd: 3.5 * s });
    c.save(); c.clip(p);
    line(c, x - 14 * s, y + 8 * s, x + 14 * s, y + 8 * s, '#4a3620', 1.4 * s); line(c, x - 14 * s, y + 19 * s, x + 14 * s, y + 19 * s, '#4a3620', 1.4 * s);
    for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) fell(c, x + i * 3.6 * s, y + (3 + j * 2.6) * s, .9 * s, .9 * s, '#d8b874');
    fell(c, x, y + 14 * s, 2.6 * s, 2.6 * s, '#c4a060');
    c.restore(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(p);
    c.beginPath(); c.arc(x, y - 1.5 * s, 2.5 * s, Math.PI, 0); sk(c, OUT, 2);
  }
  function drawBellTower(c, ax, ay) {
    fell(c, ax + 14, ay + 2, 56, 14, SHADOW);
    const st = tone('#7c837d');
    frect(c, ax - 46, ay - 14, 92, 14, st.base); frect(c, ax - 46, ay - 22, 92, 8, st.light); srect(c, ax - 46, ay - 22, 92, 22, OUT, 1.6); line(c, ax - 46, ay - 14, ax + 46, ay - 14, OUT, 1.2);
    for (const px of [ax - 30, ax + 30]) { line(c, px, ay - 22, px, ay - 130, OUT, 7); line(c, px, ay - 22, px, ay - 130, WOOD.dark, 5); }
    line(c, ax, ay - 128, ax, ay - 118, '#2a2420', 3);
    bell(c, ax, ay - 118, 1.4);
    line(c, ax + 26, ay - 126, ax + 22, ay - 100, '#cfc6ad', 1.2); line(c, ax + 50, ay - 126, ax + 48, ay - 100, '#cfc6ad', 1.2);
    line(c, ax + 20, ay - 99, ax + 50, ay - 99, OUT, 7); line(c, ax + 20, ay - 99, ax + 50, ay - 99, WOOD.light, 5);
    for (const px of [ax - 39, ax + 39]) { line(c, px, ay - 14, px, ay - 124, OUT, 8); line(c, px, ay - 14, px, ay - 124, WOOD.base, 6); line(c, px - 1.5, ay - 14, px - 1.5, ay - 124, WOOD.light, 1.5); }
    line(c, ax - 43, ay - 44, ax + 43, ay - 44, OUT, 6); line(c, ax - 43, ay - 44, ax + 43, ay - 44, WOOD.base, 4);
    rope(c, ax - 39, ay - 70, ax + 39, ay - 70, 5, { n: 2, w: 4 });
    roofJ(c, ax - 60, ay - 176, 120, 54, tone('#4e4858'), { hip: 36, flare: true, ridge: PURP.base, rf: .42 });
  }
  function jar(c, x, y, s, liq, kind) {
    const w = 8 * s, h = 24 * s;
    fell(c, x + 2 * s, y, w + 2, 2.5 * s, 'rgba(10,16,12,.3)');
    rrect(c, x - w, y - h, 2 * w, h, 3 * s); c.fillStyle = 'rgba(175,205,195,.5)'; c.fill();
    c.save(); rrect(c, x - w, y - h, 2 * w, h, 3 * s); c.clip();
    frect(c, x - w, y - h * .76, 2 * w, h * .76, liq); frect(c, x - w, y - h * .76, 2 * w, 2 * s, 'rgba(255,255,240,.4)');
    c.fillStyle = 'rgba(28,38,28,.6)';
    if (kind % 3 === 0) { fell(c, x, y - h * .38, 4.4 * s, 4.4 * s, '#efe8d8'); fell(c, x + .8 * s, y - h * .38, 1.8 * s, 1.8 * s, '#6a3a2a'); fell(c, x + .8 * s, y - h * .38, .8 * s, .8 * s, '#120a08'); }
    else if (kind % 3 === 1) { c.beginPath(); c.ellipse(x, y - h * .26, 5 * s, 2.6 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x - 1 * s, y - h * .42, 3.6 * s, 2.2 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 2 * s, y - h * .56, 2 * s, 0, TAU); c.fill(); }
    else { c.beginPath(); c.ellipse(x, y - h * .4, 3.4 * s, 6.5 * s, .3, 0, TAU); c.fill(); }
    fell(c, x + 3 * s, y - h * .62, 1 * s, 1 * s, 'rgba(255,255,255,.7)'); fell(c, x - 2 * s, y - h * .5, .8 * s, .8 * s, 'rgba(255,255,255,.6)');
    frect(c, x - w + 1.5 * s, y - h + 2 * s, 2 * s, h - 4 * s, 'rgba(255,255,255,.5)');
    frect(c, x + w - 3 * s, y - h, 3 * s, h, 'rgba(10,20,15,.22)');
    c.restore();
    rrect(c, x - w, y - h, 2 * w, h, 3 * s); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
    frect(c, x - w * .75, y - h - 4 * s, w * 1.5, 4.5 * s, '#7a5a3c'); srect(c, x - w * .75, y - h - 4 * s, w * 1.5, 4.5 * s, OUT, 1);
  }
  function specimenTank(c, x, y, r, h) {
    const ry = r * .38, mb = tone('#5a6260');
    fell(c, x + 10, y + 1, r + 10, ry + 5, SHADOW);
    c.beginPath(); c.moveTo(x - r - 4, y - 14); c.lineTo(x - r - 4, y); c.ellipse(x, y, r + 4, ry + 1, 0, Math.PI, 0, true); c.lineTo(x + r + 4, y - 14); c.closePath();
    c.fillStyle = mb.base; c.fill(); sk(c, OUT, 1.5);
    frect(c, x - r - 3, y - 14, 5, 14, mb.light);
    const gy = y - 14, gp = new Path2D();
    gp.moveTo(x - r, gy - h); gp.lineTo(x - r, gy); gp.ellipse(x, gy, r, ry, 0, Math.PI, 0, true); gp.lineTo(x + r, gy - h); gp.ellipse(x, gy - h, r, ry, 0, 0, Math.PI, false); gp.closePath();
    c.save(); c.fillStyle = '#4caa6c'; c.fill(gp); c.clip(gp);
    frect(c, x - r, gy - h - ry, 2 * r, h * .3, 'rgba(170,245,190,.32)');
    const fig = 'rgba(18,52,30,.62)';
    c.fillStyle = fig;
    c.beginPath(); c.arc(x, gy - h * .74, r * .26, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(x, gy - h * .45, r * .3, h * .2, 0, 0, TAU); c.fill();
    line(c, x - r * .26, gy - h * .54, x - r * .52, gy - h * .3, fig, r * .14);
    line(c, x + r * .26, gy - h * .54, x + r * .5, gy - h * .32, fig, r * .14);
    line(c, x - r * .12, gy - h * .28, x - r * .18, gy - h * .05, fig, r * .16);
    line(c, x + r * .12, gy - h * .28, x + r * .2, gy - h * .06, fig, r * .16);
    line(c, x, gy - h - ry, x, gy - h * .8, 'rgba(18,40,28,.6)', 1.4);
    for (let i = 0; i < 7; i++) fell(c, x + (hash2(i, 1, 3) - .5) * r * 1.4, gy - hash2(i, 2, 3) * h, 1 + hash2(i, 3, 3) * 1.6, 1 + hash2(i, 3, 3) * 1.6, 'rgba(225,255,230,.55)');
    frect(c, x - r * .8, gy - h - ry, r * .22, h + ry * 2, 'rgba(230,255,240,.45)');
    frect(c, x + r * .5, gy - h - ry, r * .5, h + ry * 2, 'rgba(8,30,18,.25)');
    c.restore(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(gp);
    c.beginPath(); c.moveTo(x - r - 3, gy - h - 8); c.lineTo(x - r - 3, gy - h); c.ellipse(x, gy - h, r + 3, ry + 1, 0, Math.PI, 0, true); c.lineTo(x + r + 3, gy - h - 8); c.closePath();
    c.fillStyle = mb.base; c.fill(); sk(c, OUT, 1.4);
    fell(c, x, gy - h - 8, r + 3, ry + 1, mb.light); c.beginPath(); c.ellipse(x, gy - h - 8, r + 3, ry + 1, 0, 0, TAU); sk(c, OUT, 1.4);
    line(c, x + r * .4, gy - h - 8, x + r * .4, gy - h - 26, OUT, 6); line(c, x + r * .4, gy - h - 8, x + r * .4, gy - h - 26, '#7a8480', 4);
    line(c, x + r * .4, gy - h - 26, x + r * 1.4, gy - h - 26, OUT, 6); line(c, x + r * .4, gy - h - 26, x + r * 1.4, gy - h - 26, '#7a8480', 4);
  }
  // big guardian snake statue (coiled on a plinth, head reared); base at (ax, ay)
  function snakeStatue(c, ax, ay, s, flip, pal) {
    const SN = pal || tone('#8a918a');
    c.save(); c.translate(ax, ay); c.scale(flip ? -s : s, s); c.lineCap = 'round'; c.lineJoin = 'round';
    fell(c, 14, 2, 66, 15, 'rgba(10,16,12,.35)');
    const ST = tone('#767d78');
    stoneFace(c, -56, -38, 112, 38, ST, { rh: 13, moss: .9, eave: false, seed: 77 });
    fpoly(c, [-60, -38, -54, -52, 54, -52, 60, -38], ST.light); poly(c, [-60, -38, -54, -52, 54, -52, 60, -38]); sk(c, OUT, 1.8);
    for (let k = 0; k < 3; k++) {
      const cy = -60 - k * 15, rx = 44 - k * 9, ry = 14 - k * 2.4, w = 15 - k * 1.5;
      const b = new Path2D(); b.ellipse(0, cy, rx, ry, 0, Math.PI, TAU); tube(c, b, w, SN);
      const f = new Path2D(); f.ellipse(0, cy, rx, ry, 0, 0, Math.PI); tube(c, f, w, SN);
    }
    const neck = new Path2D(); neck.moveTo(16, -92); neck.bezierCurveTo(46, -116, -28, -132, -6, -162); neck.bezierCurveTo(4, -176, 16, -182, 24, -186);
    tube(c, neck, 13, SN);
    c.save(); c.translate(-8, -146); c.rotate(-.5);
    fell(c, 0, 0, 10, 4, PURP.base); c.beginPath(); c.ellipse(0, 0, 10, 4, 0, 0, TAU); sk(c, OUT, 1.2); c.restore();
    fpoly(c, [-12, -142, -8, -142, -8, -132, -5, -132, -5, -124, -10, -124], '#eeeae0');
    const hx = 26, hy = -190;
    const jaw = [hx - 2, hy + 6, hx + 16, hy + 9, hx + 40, hy + 18, hx + 38, hy + 23, hx + 10, hy + 18];
    fpoly(c, jaw, SN.dark); poly(c, jaw); sk(c, OUT, 1.5);
    fpoly(c, [hx + 12, hy + 3, hx + 44, hy + 2, hx + 39, hy + 18, hx + 16, hy + 9], '#2a2e2b');
    fpoly(c, [hx + 20, hy + 8, hx + 38, hy + 6, hx + 34, hy + 14], '#7a3a40');
    const head = new Path2D(); head.moveTo(hx - 8, hy + 6); head.quadraticCurveTo(hx - 8, hy - 12, hx + 12, hy - 16); head.quadraticCurveTo(hx + 34, hy - 16, hx + 47, hy - 3);
    head.lineTo(hx + 44, hy + 3); head.lineTo(hx + 14, hy + 5); head.closePath();
    celFill(c, head, SN.base, SN.light, SN.dark, { ld: 3, dd: 4 }); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(head);
    for (const fx of [hx + 40, hx + 31]) { const f = [fx - 2, hy + 3, fx + 1, hy + 13, fx + 2.5, hy + 3]; fpoly(c, f, '#ece6d0'); poly(c, f); sk(c, OUT, .9); }
    fell(c, hx + 24, hy - 7, 4.6, 3, '#e8bc48'); fell(c, hx + 24.5, hy - 7, 1, 2.6, '#1a1410'); c.beginPath(); c.ellipse(hx + 24, hy - 7, 4.6, 3, 0, 0, TAU); sk(c, OUT, 1);
    line(c, hx + 14, hy - 12, hx + 31, hy - 11, SN.deep, 1.8);
    fell(c, hx + 41, hy - 4, 1.3, 1, SN.deep);
    fell(c, -30, -52, 16, 4, 'rgba(90,124,58,.85)'); fell(c, 34, -64, 10, 3, 'rgba(90,124,58,.8)'); fell(c, -20, -90, 8, 2.5, 'rgba(120,154,80,.8)');
    c.restore();
  }
  function drawSkull(c, ax, ay) {
    const BN = tone('#d4ccb2');
    fell(c, ax + 6, ay - 4, 150, 34, 'rgba(10,16,12,.35)');
    const m = smoothPath([[ax - 150, ay + 4], [ax - 120, ay - 26], [ax, ay - 34], [ax + 130, ay - 24], [ax + 156, ay + 6], [ax, ay + 16]]);
    celFill(c, m, '#565a40', '#6f7550', '#40442f', { ld: 6, dd: 8 }); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(m);
    const lj = new Path2D(); lj.moveTo(ax - 84, ay - 6); lj.lineTo(ax + 108, ay - 4); lj.quadraticCurveTo(ax + 118, ay + 2, ax + 106, ay + 9); lj.lineTo(ax - 70, ay + 8); lj.closePath();
    celFill(c, lj, BN.dark, BN.base, BN.deep, { ld: 2, dd: 3 }); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(lj);
    const cr = new Path2D(); cr.moveTo(ax - 112, ay - 10); cr.quadraticCurveTo(ax - 124, ay - 72, ax - 60, ay - 94); cr.quadraticCurveTo(ax + 10, ay - 110, ax + 62, ay - 82);
    cr.quadraticCurveTo(ax + 104, ay - 62, ax + 128, ay - 40); cr.quadraticCurveTo(ax + 136, ay - 26, ax + 120, ay - 18); cr.lineTo(ax + 40, ay - 14); cr.quadraticCurveTo(ax - 40, ay - 4, ax - 112, ay - 10); cr.closePath();
    celFill(c, cr, BN.base, BN.light, BN.dark, { ld: 8, dd: 11, deep: BN.deep, deepD: 4 }); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(cr);
    c.save(); c.clip(cr);
    c.beginPath(); c.moveTo(ax - 90, ay - 50); c.quadraticCurveTo(ax - 20, ay - 84, ax + 70, ay - 62); sk(c, 'rgba(90,80,60,.4)', 2);
    c.beginPath(); c.moveTo(ax - 70, ay - 24); c.quadraticCurveTo(ax + 10, ay - 40, ax + 100, ay - 30); sk(c, 'rgba(90,80,60,.3)', 1.5);
    fell(c, ax - 60, ay - 90, 40, 12, 'rgba(84,116,58,.75)'); fell(c, ax - 70, ay - 94, 20, 5, 'rgba(140,170,90,.6)');
    line(c, ax + 20, ay - 96, ax + 36, ay - 70, 'rgba(60,52,40,.6)', 1.4); line(c, ax + 36, ay - 70, ax + 30, ay - 52, 'rgba(60,52,40,.6)', 1.2);
    c.restore();
    fell(c, ax - 18, ay - 58, 27, 21, '#2a2724'); fell(c, ax - 14, ay - 54, 18, 13, '#141210');
    c.beginPath(); c.ellipse(ax - 18, ay - 58, 27, 21, 0, 0, TAU); sk(c, OUT, 1.6);
    c.beginPath(); c.ellipse(ax - 18, ay - 60, 30, 24, 0, 1.15 * Math.PI, 1.85 * Math.PI); sk(c, BN.light, 3);
    fell(c, ax + 100, ay - 46, 8, 5, '#1d1b18'); fell(c, ax + 80, ay - 40, 6, 4, '#1d1b18');
    for (let i = 0; i < 8; i++) { const tx = ax + 4 + i * 13; fpoly(c, [tx - 3, ay - 15, tx + 3, ay - 15, tx, ay - 6], BN.light); }
    for (const [fx, len] of [[96, 40], [64, 28]]) {
      const f = new Path2D(); f.moveTo(ax + fx - 6, ay - 17); f.quadraticCurveTo(ax + fx - 4, ay - 17 + len * .7, ax + fx - 10, ay - 17 + len); f.quadraticCurveTo(ax + fx + 2, ay - 17 + len * .6, ax + fx + 4, ay - 17); f.closePath();
      celFill(c, f, '#ece6d2', '#fffaee', '#b9b29a', { ld: 1.5, dd: 2 }); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(f);
    }
    const lip = smoothPath([[ax - 156, ay + 10], [ax - 120, ay - 2], [ax - 60, ay + 6], [ax + 20, ay + 2], [ax + 150, ay + 8], [ax, ay + 22]]);
    celFill(c, lip, '#5e6346', '#76805a', '#454a33', { ld: 3, dd: 4 }); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(lip);
    for (let i = 0; i < 12; i++) tuft(c, ax - 140 + i * 25 + hash2(i, 1, 7) * 10, ay + 6 + hash2(i, 2, 7) * 8, .9);
  }
  function drawTorii(c, ax, ay, s) {
    const col = '#4a2e36', hi = '#6e4652';
    fell(c, ax + 8 * s, ay + 2, 62 * s, 9 * s, SHADOW);
    for (const sx of [-1, 1]) {
      const px = ax + sx * 40 * s;
      frect(c, px - 5 * s, ay - 92 * s, 10 * s, 92 * s, col); frect(c, px - 5 * s, ay - 92 * s, 3 * s, 92 * s, hi); srect(c, px - 5 * s, ay - 92 * s, 10 * s, 92 * s, OUT, 1.5);
      frect(c, px - 7 * s, ay - 10 * s, 14 * s, 10 * s, '#2a2a28'); srect(c, px - 7 * s, ay - 10 * s, 14 * s, 10 * s, OUT, 1.2);
    }
    frect(c, ax - 54 * s, ay - 78 * s, 108 * s, 8 * s, col); frect(c, ax - 54 * s, ay - 78 * s, 108 * s, 2 * s, hi); srect(c, ax - 54 * s, ay - 78 * s, 108 * s, 8 * s, OUT, 1.4);
    const k = [ax - 64 * s, ay - 98 * s, ax, ay - 94 * s, ax + 64 * s, ay - 98 * s, ax + 60 * s, ay - 88 * s, ax - 60 * s, ay - 88 * s];
    fpoly(c, k, '#2a2224'); fpoly(c, [ax - 64 * s, ay - 98 * s, ax, ay - 94 * s, ax + 64 * s, ay - 98 * s, ax + 63 * s, ay - 95 * s, ax - 63 * s, ay - 95 * s], '#544046'); poly(c, k); sk(c, OUT, 1.5);
    frect(c, ax - 9 * s, ay - 90 * s, 18 * s, 14 * s, '#2e2a26'); srect(c, ax - 9 * s, ay - 90 * s, 18 * s, 14 * s, '#b89a5a', 1.2);
    txt(c, '音', ax, ay - 82.5 * s, 10 * s, '#e0c890', { weight: '900' });
    rope(c, ax - 36 * s, ay - 64 * s, ax + 36 * s, ay - 64 * s, 6 * s, { n: 3, w: 5 * s });
  }
  function drawBanner(c, ax, ay, h) {
    fell(c, ax + 8, ay, 14, 4, SHADOW);
    line(c, ax, ay, ax, ay - h, OUT, 6); line(c, ax, ay, ax, ay - h, WOOD.base, 4); line(c, ax - 1, ay, ax - 1, ay - h, WOOD.light, 1.2);
    fpoly(c, [ax - 4, ay - h, ax, ay - h - 14, ax + 4, ay - h], '#9aa098'); poly(c, [ax - 4, ay - h, ax, ay - h - 14, ax + 4, ay - h]); sk(c, OUT, 1.2);
    line(c, ax - 2, ay - h + 8, ax + 34, ay - h + 8, OUT, 5); line(c, ax - 2, ay - h + 8, ax + 34, ay - h + 8, WOOD.dark, 3);
    const x0 = ax + 3, x1 = ax + 31, y0 = ay - h + 10, y1 = y0 + h * .62;
    const cl = [x0, y0, x1, y0, x1 + 2, y1, (x0 + x1) / 2 + 1, y1 - 10, x0 + 1, y1];
    fpoly(c, cl, PURP.base); c.save(); poly(c, cl); c.clip();
    frect(c, x1 - 6, y0, 8, y1 - y0, PURP.dark); frect(c, x0, y0, 4, y1 - y0, PURP.light); frect(c, x0, y0 + 4, 30, 3, PURP.deep);
    c.restore(); poly(c, cl); sk(c, OUT, 1.3);
    crestDisc(c, (x0 + x1) / 2, y0 + 30, 10);
    txt(c, '音', (x0 + x1) / 2, y0 + 58, 15, '#efe9dc', { weight: '900' });
  }
  function drawBooth(c, ax, ay) {
    stoneBox(c, ax - 40, ay - 92, 80, 26, 66, tone('#7b848a'), { moss: .7, rh: 14 });
    roofJ(c, ax - 54, ay - 130, 108, 68, tone('#4e4858'), { hip: 32, flare: true, ridge: PURP.base });
    slitWin(c, ax - 28, ay - 46, 20, 9, GLOW_A); ironDoor(c, ax + 6, ay - 42, 22, 42, {});
    line(c, ax - 40, ay - 58, ax - 50, ay - 58, '#2a2420', 2);
    fell(c, ax - 50, ay - 46, 6, 8, PURP.base); fell(c, ax - 52, ay - 48, 2, 5, PURP.light); c.beginPath(); c.ellipse(ax - 50, ay - 46, 6, 8, 0, 0, TAU); sk(c, OUT, 1.1);
    frect(c, ax - 54, ay - 55, 8, 2, '#222'); frect(c, ax - 54, ay - 38, 8, 2, '#222');
  }
  // the gate: a giant stone serpent arching over the road
  function drawGateArch(c, ax, ay) {
    const SN = tone('#7f8780'), ST = tone('#6f7771');
    for (const sx of [-1, 1]) {
      const bx = ax + sx * 168;
      fell(c, bx + 10, ay + 2, 62, 16, SHADOW);
      stoneFace(c, bx - 46, ay - 34, 92, 34, ST, { rh: 12, moss: 1, eave: false, seed: 91 + sx });
      fpoly(c, [bx - 50, ay - 34, bx - 44, ay - 48, bx + 44, ay - 48, bx + 50, ay - 34], ST.light); poly(c, [bx - 50, ay - 34, bx - 44, ay - 48, bx + 44, ay - 48, bx + 50, ay - 34]); sk(c, OUT, 1.8);
      for (let k = 0; k < 2; k++) {
        const cy = ay - 56 - k * 16, rx = 38 - k * 8, ry = 12 - k * 2;
        const b = new Path2D(); b.ellipse(bx, cy, rx, ry, 0, Math.PI, TAU); tube(c, b, 16, SN);
        const f = new Path2D(); f.ellipse(bx, cy, rx, ry, 0, 0, Math.PI); tube(c, f, 16, SN);
      }
    }
    const body = new Path2D(); body.moveTo(ax - 168, ay - 80); body.bezierCurveTo(ax - 196, ay - 330, ax + 196, ay - 330, ax + 168, ay - 80);
    tube(c, body, 32, SN);
    c.save(); c.translate(0, 9); c.setLineDash([6, 4]); c.strokeStyle = 'rgba(205,200,180,.5)'; c.lineWidth = 7; c.stroke(body); c.setLineDash([]); c.restore();
    for (const t of [.2, .8]) {
      const m = 1 - t, px = m * m * m * (ax - 168) + 3 * m * m * t * (ax - 196) + 3 * m * t * t * (ax + 196) + t * t * t * (ax + 168);
      const py = m * m * m * (ay - 80) + 3 * m * m * t * (ay - 330) + 3 * m * t * t * (ay - 330) + t * t * t * (ay - 80);
      c.save(); c.translate(px, py); c.rotate(t < .5 ? .5 : -.5);
      frect(c, -19, -4, 38, 8, PURP.base); frect(c, -19, -4, 38, 2, PURP.light); srect(c, -19, -4, 38, 8, OUT, 1.2); c.restore();
      fpoly(c, [px - 3, py + 5, px + 3, py + 5, px + 3, py + 14, px + 6, py + 14, px + 6, py + 22, px, py + 22, px, py + 15, px - 3, py + 15], '#eeeae0');
    }
    line(c, ax - 22, ay - 222, ax - 22, ay - 196, '#2a2420', 2); line(c, ax + 22, ay - 222, ax + 22, ay - 196, '#2a2420', 2);
    frect(c, ax - 40, ay - 198, 80, 44, '#2e2a26'); frect(c, ax - 36, ay - 194, 72, 36, '#3a3530'); srect(c, ax - 40, ay - 198, 80, 44, '#b89a5a', 2); srect(c, ax - 41, ay - 199, 82, 46, OUT, 1.3);
    txt(c, '音隠れ', ax, ay - 176, 20, '#e6cf96', { weight: '900' });
    const hy = ay - 262;
    fpoly(c, [ax - 4, hy + 30, ax + 4, hy + 30, ax + 3, hy + 46, ax + 8, hy + 54, ax + 1, hy + 48, ax, hy + 54, ax - 1, hy + 48, ax - 8, hy + 54, ax - 3, hy + 46], '#a8323a');
    const jaw = new Path2D(); jaw.moveTo(ax - 30, hy + 12); jaw.quadraticCurveTo(ax, hy + 44, ax + 30, hy + 12); jaw.closePath();
    celFill(c, jaw, '#2c2f2c', '#3e423e', '#1a1c1a', { ld: 2, dd: 3 }); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(jaw);
    snakeFace(c, ax, hy, 2.3, SN, '#efc04c');
    fell(c, ax - 18, hy - 30, 12, 4, 'rgba(90,124,58,.85)');
  }

  // ------------------------------------------------------------------ house variants (footprint 320x300, overhang up to 136 px above)
  function berm(c, pts, seed) {
    const p = smoothPath(pts);
    celFill(c, p, '#4a6634', '#63804a', '#33482a', { ld: 6, dd: 10, deep: '#283a20', deepD: 4 });
    grassTex(c, p, -40, 100, 400, 220, 10, seed);
    c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(p);
  }
  function horn(c, x, y, dir) {
    line(c, x, y, x + dir * 6, y, OUT, 4);
    const p = [x + dir * 4, y - 3, x + dir * 22, y - 10, x + dir * 22, y + 10, x + dir * 4, y + 3];
    fpoly(c, p, '#8a9290'); fpoly(c, [x + dir * 4, y - 3, x + dir * 22, y - 10, x + dir * 22, y - 3, x + dir * 4, y - 1], '#b4bcb8'); poly(c, p); sk(c, OUT, 1.3);
    fell(c, x + dir * 22, y, 3, 10, '#2a2e2d'); c.beginPath(); c.ellipse(x + dir * 22, y, 3, 10, 0, 0, TAU); sk(c, OUT, 1.2);
  }
  function labWin(c, x, y, w, h) {
    frect(c, x - 4, y - 4, w + 8, h + 8, '#4f5651');
    frect(c, x, y, w, h, '#86d49a'); frect(c, x, y, w, h * .3, 'rgba(220,255,225,.35)');
    for (let i = 0; i < 4; i++) { const jx = x + 7 + i * (w - 12) / 3; frect(c, jx - 4, y + h * .45, 8, h * .55, 'rgba(30,70,45,.55)'); fell(c, jx, y + h * .45, 4, 2, 'rgba(30,70,45,.55)'); }
    line(c, x + w / 2, y, x + w / 2, y + h, '#3d433f', 2.5); line(c, x, y + h / 2, x + w, y + h / 2, '#3d433f', 2);
    frect(c, x - 5, y + h + 3, w + 10, 4, '#9aa098'); srect(c, x - 4, y - 4, w + 8, h + 8, OUT, 1.4);
  }
  function crates(c, ax, ay) {
    fell(c, ax + 12, ay, 34, 8, SHADOW);
    const box = (x, y, w, h, d) => {
      fpoly(c, [x, y, x + w, y, x + w + d * .4, y - d, x + d * .4, y - d], WOOD.light);
      frect(c, x, y, w, h, WOOD.base); c.strokeStyle = WOOD.dark; c.lineWidth = 1.2; c.beginPath(); for (let yy = y + h / 3; yy < y + h - 1; yy += h / 3) { c.moveTo(x, yy); c.lineTo(x + w, yy); } c.moveTo(x, y); c.lineTo(x + w, y + h); c.stroke();
      fpoly(c, [x + w, y, x + w + d * .4, y - d, x + w + d * .4, y + h - d, x + w, y + h], WOOD.dark);
      poly(c, [x, y, x + d * .4, y - d, x + w + d * .4, y - d, x + w + d * .4, y + h - d, x + w, y + h, x, y + h]); sk(c, OUT, 1.4);
    };
    box(ax - 30, ay - 24, 30, 24, 14); box(ax + 2, ay - 22, 26, 22, 12); box(ax - 20, ay - 48, 26, 22, 12);
  }
  function barrels(c, ax, ay) {
    fell(c, ax + 10, ay, 30, 7, SHADOW);
    const T = tone('#6e5a44');
    for (const [dx, dy] of [[-13, -2], [12, 0]]) {
      const x = ax + dx, y = ay + dy;
      c.beginPath(); c.moveTo(x - 12, y - 30); c.lineTo(x - 12, y); c.ellipse(x, y, 12, 4.5, 0, Math.PI, 0, true); c.lineTo(x + 12, y - 30); c.closePath();
      c.fillStyle = T.base; c.fill(); c.save(); c.clip(); frect(c, x - 12, y - 36, 4, 40, T.light); frect(c, x + 6, y - 36, 6, 40, T.dark); frect(c, x - 12, y - 24, 24, 3, '#3a3f3d'); frect(c, x - 12, y - 9, 24, 3, '#3a3f3d'); c.restore();
      sk(c, OUT, 1.4); fell(c, x, y - 30, 12, 4.5, T.light); c.beginPath(); c.ellipse(x, y - 30, 12, 4.5, 0, 0, TAU); sk(c, OUT, 1.4);
    }
  }

  function vBunker(c, P) {
    const S = P.S;
    berm(c, [[-16, 300], [-18, 170], [60, 92], [160, 66], [262, 92], [338, 170], [336, 300]], 3 + P.idx);
    const b = stoneBox(c, 42, 122, 236, 58, 120, S, { top: 'moss', moss: .8, rh: 17 });
    // grass lip drooping over the slab edge
    for (let x = 46; x < 274; x += 9) fpoly(c, [x, b.fy - 2, x + 9, b.fy - 2, x + 5, b.fy + 4 + ((x * 7) % 9)], MOSS.dark);
    frect(c, 122, 202, 76, 14, S.light); frect(c, 122, 212, 76, 4, S.dark); srect(c, 122, 202, 76, 14, OUT, 1.6);
    ironDoor(c, 134, 216, 52, 84, { ajar: P.idx % 2 === 0 });
    rope(c, 118, 208, 202, 208, 7, { n: 3 });
    slitWin(c, 66, 230, 36, 9, GLOW_P); slitWin(c, 218, 230, 36, 9, GLOW_A);
    frect(c, 222, 254, 28, 32, '#3a3f3d'); srect(c, 222, 254, 28, 32, OUT, 1.3); crestDisc(c, 236, 270, 10);
    // vent pipe and roof hatch
    line(c, 246, 150, 246, 96, OUT, 12); line(c, 246, 150, 246, 96, '#646b68', 9); line(c, 243, 150, 243, 96, '#8a918d', 2);
    fpoly(c, [234, 98, 258, 98, 252, 88, 240, 88], '#4a504d'); poly(c, [234, 98, 258, 98, 252, 88, 240, 88]); sk(c, OUT, 1.3);
    frect(c, 70, 136, 40, 22, '#4a504d'); frect(c, 74, 139, 32, 16, '#3a3f3d'); srect(c, 70, 136, 40, 22, OUT, 1.3); c.beginPath(); c.arc(90, 147, 4, 0, TAU); sk(c, '#a8a088', 1.6);
    // side berms swallow the face edges: the bunker is half buried
    berm(c, [[-18, 300], [-10, 250], [22, 214], [58, 210], [66, 300]], 9 + P.idx);
    berm(c, [[254, 300], [262, 210], [298, 214], [330, 250], [338, 300]], 13 + P.idx);
    line(c, 114, 222, 114, 232, '#2a2420', 1.5); fell(c, 114, 240, 5, 7, PURP.base); fell(c, 112, 238, 1.6, 4, PURP.light); c.beginPath(); c.ellipse(114, 240, 5, 7, 0, 0, TAU); sk(c, OUT, 1);
    P.lamps.push([114, 240]);
  }
  function vLair(c, P) {
    const S = P.S;
    const m = smoothPath([[-12, 300], [-8, 226], [14, 156], [60, 96], [124, 58], [196, 50], [256, 78], [302, 134], [328, 208], [334, 300]]);
    celFill(c, m, '#6a7269', '#929a8e', '#4a524b', { ld: 12, dd: 16, deep: '#373e38', deepD: 6 });
    c.save(); c.clip(m);
    for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(-20, 130 + k * 40); c.quadraticCurveTo(160, 112 + k * 42 + (k % 2) * 18, 340, 128 + k * 38); sk(c, 'rgba(28,34,30,.35)', 2); c.save(); c.translate(0, 2.5); sk(c, 'rgba(220,230,215,.15)', 1.2); c.restore(); }
    fell(c, 160, 72, 160, 44, 'rgba(90,122,58,.92)'); fell(c, 136, 64, 110, 24, 'rgba(134,163,82,.6)');
    fell(c, 30, 180, 40, 18, 'rgba(90,122,58,.8)'); fell(c, 300, 170, 36, 16, 'rgba(90,122,58,.8)');
    c.restore();
    grassTex(c, m, 40, 50, 240, 70, 14, 31 + P.idx);
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(m);
    mossRock(c, 36, 262, 26, 11 + P.idx); mossRock(c, 288, 270, 22, 17 + P.idx); mossRock(c, 254, 128, 15, 23 + P.idx);
    // portal
    const fr = [92, 300, 104, 142, 216, 142, 228, 300];
    c.save(); poly(c, fr); c.clip(); stoneFace(c, 88, 142, 144, 158, S, { rh: 18, moss: .6, eave: false, seed: 5 + P.idx }); c.restore(); poly(c, fr); sk(c, OUT, 2);
    const op = [118, 300, 126, 176, 194, 176, 202, 300];
    fpoly(c, op, '#0f1110');
    c.save(); poly(c, op); c.clip();
    const steps = [[300, 12, '#525a55'], [288, 11, '#454c48'], [277, 10, '#3a403d'], [267, 9, '#2f3532'], [258, 8, '#262b28'], [250, 7, '#1d211f'], [243, 6, '#161918']];
    for (const [yy, hh, col] of steps) { frect(c, 100, yy - hh, 120, hh, col); frect(c, 100, yy - hh, 120, 2, 'rgba(220,230,220,.14)'); }
    fell(c, 160, 206, 34, 20, 'rgba(160,110,215,.28)');
    fpoly(c, [118, 300, 126, 176, 136, 176, 131, 300], 'rgba(220,230,220,.08)'); fpoly(c, [202, 300, 194, 176, 186, 176, 190, 300], 'rgba(0,0,0,.3)');
    c.restore(); poly(c, op); sk(c, OUT, 1.6);
    frect(c, 84, 126, 152, 22, S.light); frect(c, 84, 144, 152, 4, S.dark); srect(c, 84, 126, 152, 22, OUT, 1.8);
    snakeFace(c, 160, 128, .95, S);
    rope(c, 96, 152, 224, 152, 8, { n: 4 });
    brazier(c, 74, 304, 1); brazier(c, 246, 304, 1);
    drawBroadO(c, 262, 104, .48, 70 + P.idx);
    if (P.idx % 2) drawDeadO(c, 70, 112, .55, 90); else drawPineO(c, 74, 112, .5, 91);
    P.lamps.push([74, 262], [246, 262]);
  }
  function vTower(c, P) {
    const S = P.S, S2 = P.S2, R = P.R;
    stoneBox(c, 154, 176, 154, 44, 80, S2, { moss: .5 });
    roofJ(c, 142, 136, 178, 92, R, { hip: 34, flare: true, moss: !!(P.idx % 2) });
    ironDoor(c, 248, 246, 36, 54, {});
    slitWin(c, 178, 252, 30, 10, GLOW_A);
    const t = stoneBox(c, 26, -14, 120, 34, 294, S, { top: 'stone', moss: .7, rh: 18 });
    for (const ly of [112, 196]) { frect(c, 22, ly, 128, 8, S.light); frect(c, 22, ly + 6, 128, 3, S.dark); srect(c, 22, ly, 128, 9, OUT, 1.4); fell(c, 40 + (ly % 50), ly - 1, 12, 3, 'rgba(90,124,58,.85)'); }
    slitWin(c, 78, 62, 16, 26, GLOW_P); slitWin(c, 78, 128, 16, 24, null); crestDisc(c, 86, 174, 11);
    ironDoor(c, 66, 228, 40, 72, { arch: true });
    // ivy creeping down the shaft
    const Rv = rng(40 + P.idx);
    for (let v = 0; v < 3; v++) {
      let x = 34 + Rv() * 100, y = t.fy + 2; const p = new Path2D(); p.moveTo(x, y);
      const pts = []; for (let k = 0; k < 8; k++) { x += (Rv() - .5) * 14; y += 12 + Rv() * 14; p.lineTo(x, y); pts.push([x, y]); }
      c.strokeStyle = '#2f4a26'; c.lineWidth = 2; c.stroke(p);
      for (const [lx, ly] of pts) { fell(c, lx - 3, ly, 4, 3, MOSS.base); fell(c, lx + 3, ly - 4, 3.5, 2.6, MOSS.light); }
    }
    // belfry on the top platform
    for (const px of [40, 132]) { line(c, px, -6, px, -80, OUT, 7); line(c, px, -6, px, -80, WOOD.dark, 5); }
    line(c, 36, -78, 136, -78, OUT, 7); line(c, 36, -78, 136, -78, WOOD.base, 5);
    line(c, 86, -78, 86, -70, '#2a2420', 3);
    bell(c, 86, -70, 1.15);
    for (const px of [32, 140]) { line(c, px, 16, px, -72, OUT, 8); line(c, px, 16, px, -72, WOOD.base, 6); line(c, px - 1.5, 16, px - 1.5, -72, WOOD.light, 1.5); }
    line(c, 28, 2, 144, 2, OUT, 6); line(c, 28, 2, 144, 2, WOOD.base, 4);
    c.strokeStyle = WOOD.dark; c.lineWidth = 2; c.beginPath(); for (let x = 44; x < 132; x += 11) { c.moveTo(x, 3); c.lineTo(x, 16); } c.stroke();
    horn(c, 30, -48, -1); horn(c, 142, -48, 1);
    rope(c, 32, 6, 140, 6, 4, { n: 3, w: 5 });
    roofJ(c, 8, -130, 156, 64, R, { hip: 54, flare: true, ridge: PURP.base, rf: .4 });
    P.bells.push([86, -54]); P.lamps.push([86, -46], [266, 244]);
  }
  function vLab(c, P) {
    const S = P.S, R = P.R;
    specimenTank(c, 284, 296, 22, 78);
    stoneBox(c, 10, 140, 228, 40, 120, S, { moss: .5 });
    roofJ(c, -2, 44, 252, 146, R, { hip: 28, rf: .3, moss: !!(P.idx % 2) });
    const gl = [146, 104, 214, 104, 222, 150, 140, 150];
    fpoly(c, gl, 'rgba(140,220,160,.75)'); c.save(); poly(c, gl); c.clip(); line(c, 160, 104, 168, 150, 'rgba(255,255,255,.4)', 4); c.restore();
    poly(c, gl); sk(c, '#3d433f', 3); line(c, 180, 104, 181, 150, '#3d433f', 2); line(c, 143, 127, 218, 127, '#3d433f', 2);
    line(c, 56, 92, 56, 30, OUT, 12); line(c, 56, 92, 56, 30, '#646b68', 9); line(c, 53, 92, 53, 30, '#8a918d', 2);
    fpoly(c, [44, 32, 68, 32, 62, 22, 50, 22], '#4a504d'); poly(c, [44, 32, 68, 32, 62, 22, 50, 22]); sk(c, OUT, 1.3);
    labWin(c, 26, 206, 56, 40); labWin(c, 168, 206, 56, 40);
    ironDoor(c, 104, 222, 40, 78, { ajar: !!(P.idx % 2) });
    const pipe = new Path2D(); pipe.moveTo(238, 232); pipe.lineTo(262, 232); pipe.lineTo(262, 212);
    c.strokeStyle = OUT; c.lineWidth = 8; c.stroke(pipe); c.strokeStyle = '#7d8783'; c.lineWidth = 5; c.stroke(pipe); c.strokeStyle = '#b0b8b4'; c.lineWidth = 1.5; c.stroke(pipe);
    frect(c, 16, 296, 78, 6, WOOD.base); srect(c, 16, 296, 78, 6, OUT, 1.2); frect(c, 20, 302, 5, 10, WOOD.dark); frect(c, 86, 302, 5, 10, WOOD.dark);
    for (let k = 0; k < 4; k++) jar(c, 28 + k * 18, 296, .75, LIQ[(k + P.idx) % 4], k + P.idx);
    P.lamps.push([54, 226], [196, 226], [284, 240]);
  }
  function vShrine(c, P) {
    const S = P.S, R = P.R;
    stoneBox(c, 6, 186, 308, 52, 62, S, { top: 'stone', moss: .9, rh: 16 });
    const hx = 52, hy = 150, hw = 216, hh = 80;
    frect(c, hx, hy, hw, hh, WOOD.dark);
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.beginPath(); for (let x = hx + 6; x < hx + hw; x += 7) { c.moveTo(x, hy); c.lineTo(x, hy + hh); } c.stroke();
    frect(c, 106, hy + 14, 108, hh - 14, '#d4cdb2');
    c.strokeStyle = WOOD.deep; c.lineWidth = 1.6; c.beginPath();
    for (let x = 106; x <= 214; x += 13.5) { c.moveTo(x, hy + 14); c.lineTo(x, hy + hh); }
    for (let y = hy + 14; y <= hy + hh; y += 11) { c.moveTo(106, y); c.lineTo(214, y); } c.stroke();
    line(c, 160, hy + 14, 160, hy + hh, WOOD.deep, 3);
    for (const px of [hx, 100, 214, hx + hw - 10]) { frect(c, px, hy, 10, hh, WOOD.base); frect(c, px, hy, 3, hh, WOOD.light); srect(c, px, hy, 10, hh, OUT, 1.2); }
    frect(c, hx, hy, hw, 8, 'rgba(0,0,0,.35)'); srect(c, hx, hy, hw, hh, OUT, 1.8);
    roofJ(c, 18, 38, 284, 124, R, { hip: 76, flare: true, moss: true, ridge: PURP.base, rf: .38 });
    rope(c, 58, 166, 262, 166, 9, { n: 5, w: 8 });
    ropeBow(c, 160, 186, 1.15);
    const st = tone('#8a8f88');
    for (let i = 0; i < 4; i++) { const w = 70 + i * 8, y = 240 + i * 15; frect(c, 160 - w / 2, y, w, 15, i % 2 ? st.base : st.light); frect(c, 160 - w / 2, y, w, 3, st.hi); srect(c, 160 - w / 2, y, w, 15, OUT, 1.2); }
    frect(c, 146, 212, 28, 18, WOOD.base); c.strokeStyle = WOOD.deep; c.lineWidth = 1; c.beginPath(); for (let x = 150; x < 172; x += 4) { c.moveTo(x, 212); c.lineTo(x, 218); } c.stroke(); srect(c, 146, 212, 28, 18, OUT, 1.2);
    snakeStatue(c, 32, 232, .34, false); snakeStatue(c, 288, 232, .34, true);
    toro(c, 96, 318, 1); toro(c, 224, 318, 1);
    P.lamps.push([96, 284], [224, 284]);
  }
  function vBarracks(c, P) {
    const S = P.S, R = P.R;
    stoneBox(c, 10, 150, 300, 46, 104, S, { moss: .6, rh: 16 });
    roofJ(c, -6, 40, 332, 166, R, { hip: 58, rf: .36, flare: true, moss: !!P.idx, ridge: P.idx ? null : PURP.base });
    ironDoor(c, 54, 230, 44, 70, {}); ironDoor(c, 222, 230, 44, 70, { ajar: true });
    for (const x of [118, 150, 182]) slitWin(c, x, 238, 22, 10, x === 150 ? GLOW_A : GLOW_P);
    hangBanner(c, 18, 210, 24, 60); hangBanner(c, 278, 210, 24, 60);
    frect(c, 150, 256, 22, 36, '#3a3530'); srect(c, 150, 256, 22, 36, '#b89a5a', 1.2); txt(c, '音', 161, 266, 13, '#e6cf96', { weight: '900' }); txt(c, '忍', 161, 283, 13, '#e6cf96', { weight: '900' });
    // weapon rack in front
    line(c, 112, 318, 112, 286, OUT, 4); line(c, 210, 318, 210, 286, OUT, 4); line(c, 108, 294, 214, 294, OUT, 5); line(c, 108, 294, 214, 294, WOOD.base, 3);
    for (let x = 122; x < 206; x += 12) { line(c, x, 316, x + 2, 270, '#4a3a2c', 2); fpoly(c, [x - 1, 272, x + 2, 260, x + 5, 272], '#b8c0bc'); }
    P.lamps.push([76, 236], [244, 236]);
  }

  // ------------------------------------------------------------------ Orochimaru's hideout (footprint 440x400)
  function snakePillar(c, x, y0, y1, T) {
    frect(c, x - 14, y0, 28, y1 - y0, T.light); frect(c, x + 6, y0, 8, y1 - y0, T.dark); frect(c, x - 14, y0, 4, y1 - y0, T.hi); srect(c, x - 14, y0, 28, y1 - y0, OUT, 1.6);
    frect(c, x - 18, y1 - 10, 36, 10, T.base); srect(c, x - 18, y1 - 10, 36, 10, OUT, 1.4); frect(c, x - 18, y0 - 8, 36, 10, T.base); srect(c, x - 18, y0 - 8, 36, 10, OUT, 1.4);
    const p = new Path2D(); p.moveTo(x - 4, y1 - 14);
    for (let k = 0, yy = y1 - 14; yy > y0 + 34; k++, yy -= 26) p.quadraticCurveTo(x + (k % 2 ? -18 : 18), yy - 13, x + (k % 2 ? -2 : 2), yy - 26);
    tube(c, p, 8, tone('#6d7570'));
    snakeFace(c, x, y0 + 22, .55, tone('#7a827c'));
  }
  function lmHideout(c, P) {
    const S = tone('#7d8580'), S2 = tone('#6c746f'), R = tone('#4d4658');
    const mound = smoothPath([[-30, 300], [-24, 200], [6, 120], [60, 40], [130, -30], [210, -70], [290, -40], [360, 20], [420, 110], [462, 200], [470, 300]]);
    celFill(c, mound, '#636b65', '#8b938a', '#444b47', { ld: 16, dd: 22, deep: '#323834', deepD: 8 });
    c.save(); c.clip(mound);
    for (let k = 0; k < 7; k++) { const yy = -40 + k * 46; c.beginPath(); c.moveTo(-40, yy + 30); c.quadraticCurveTo(220, yy - 12 + (k % 2) * 22, 480, yy + 24); sk(c, 'rgba(25,30,27,.38)', 2.2); c.save(); c.translate(0, 3); sk(c, 'rgba(225,232,220,.14)', 1.4); c.restore(); }
    for (let k = 0; k < 9; k++) { const x = 20 + k * 48; line(c, x, -20 + (k % 3) * 30, x + 10, 60 + (k % 4) * 30, 'rgba(25,30,27,.3)', 1.6); }
    fell(c, 210, -52, 120, 32, MOSS.base); fell(c, 190, -60, 70, 14, MOSS.light);
    fell(c, 66, 52, 76, 28, MOSS.base); fell(c, 52, 44, 40, 10, MOSS.light);
    fell(c, 380, 56, 80, 30, MOSS.base); fell(c, 364, 46, 40, 10, MOSS.light);
    c.restore();
    grassTex(c, mound, 0, -70, 440, 150, 22, 707);
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.stroke(mound);
    drawPineO(c, 64, 70, .72, 801); drawBroadO(c, 392, 92, .62, 802); drawPineO(c, 300, -12, .6, 803); drawBroadO(c, 132, 4, .56, 804); drawDeadO(c, 236, -62, .5, 805);
    mossRock(c, 10, 276, 30, 806); mossRock(c, 432, 282, 28, 807); mossRock(c, 36, 196, 18, 808); mossRock(c, 414, 200, 16, 809);
    // terrace
    stoneBox(c, 36, 236, 368, 44, 48, S2, { top: 'stone', moss: .8, rh: 16 });
    // temple bunker
    stoneBox(c, 84, 112, 272, 22, 148, S, { moss: .6, rh: 21 });
    slitWin(c, 104, 196, 30, 12, GLOW_P); slitWin(c, 306, 196, 30, 12, GLOW_P);
    slitWin(c, 104, 236, 30, 10, null); slitWin(c, 306, 236, 30, 10, GLOW_A);
    snakePillar(c, 160, 160, 282, S); snakePillar(c, 280, 160, 282, S);
    ironDoor(c, 184, 178, 72, 104, { arch: true, ajar: true, frame: S.dark });
    rope(c, 166, 176, 274, 176, 12, { n: 4, w: 9 });
    ropeBow(c, 220, 196, 1.7);
    roofJ(c, 46, 4, 348, 142, R, { hip: 76, flare: true, moss: true, ridge: PURP.base, rf: .36 });
    // ridge serpents
    for (const sx of [-1, 1]) {
      const ex = 220 + sx * 98, ey = 50;
      const p = new Path2D(); p.moveTo(ex - sx * 30, ey + 1); p.quadraticCurveTo(ex, ey - 4, ex + sx * 8, ey - 22);
      tube(c, p, 7, tone('#6a6476'));
      c.save(); c.translate(ex + sx * 9, ey - 26); c.scale(sx, 1);
      fpoly(c, [-6, 4, -4, -5, 8, -6, 14, -1, 12, 3, 0, 6], '#6a6476'); poly(c, [-6, 4, -4, -5, 8, -6, 14, -1, 12, 3, 0, 6]); sk(c, OUT, 1.2);
      fell(c, 5, -2, 1.6, 1.2, '#e8bc48'); c.restore();
    }
    // plaque under the eave
    line(c, 200, 146, 200, 152, '#2a2420', 2); line(c, 240, 146, 240, 152, '#2a2420', 2);
    frect(c, 186, 150, 68, 38, '#2e2a26'); frect(c, 190, 154, 60, 30, '#3a3530'); srect(c, 186, 150, 68, 38, '#b89a5a', 2); srect(c, 185, 149, 70, 40, OUT, 1.4);
    txt(c, '音', 220, 170, 26, '#e6cf96', { weight: '900' });
    // stairs down the terrace
    for (let i = 0; i < 6; i++) {
      const w = 124 + i * 12, yy = 280 + i * 19, x = 220 - w / 2;
      frect(c, x, yy, w, 7, S.light); frect(c, x, yy + 7, w, 12, S.base); frect(c, x, yy + 7, w, 3, 'rgba(10,14,12,.3)'); frect(c, x, yy, w, 1.5, S.hi);
      srect(c, x, yy, w, 19, OUT, 1.3);
      fell(c, x + 6, yy + 16, 7, 3, 'rgba(90,124,58,.8)'); fell(c, x + w - 8, yy + 16, 6, 3, 'rgba(90,124,58,.7)');
    }
    for (const sx of [-1, 1]) { const bx = 220 + sx * 112 - 14; frect(c, bx, 300, 28, 96, S2.base); frect(c, bx, 300, 28, 8, S2.light); frect(c, bx + 20, 300, 8, 96, S2.dark); srect(c, bx, 300, 28, 96, OUT, 1.5); }
    drawBanner(c, 6, 338, 196); drawBanner(c, 402, 338, 196);
    toro(c, 66, 394, 1.25); toro(c, 374, 394, 1.25);
    P.lamps.push([66, 342], [374, 342], [220, 230]);
  }

  // ------------------------------------------------------------------ ground tiles
  function wrapDraw(S, x, y, m, fn) { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { const X = x + ox, Y = y + oy; if (X < -m || X > S + m || Y < -m || Y > S + m) continue; fn(X, Y); } }
  function makeEarthTile() {
    const S = 512, cv = mk(S, S), c = cv.getContext('2d'), R = rng(1337);
    c.lineCap = 'round';
    frect(c, 0, 0, S, S, EARTH);
    for (let i = 0; i < 26; i++) {
      const x = R() * S, y = R() * S, n = 6 + Math.floor(R() * 8), q = R(), sc = 18 + R() * 40;
      const col = q < .45 ? 'rgba(84,112,56,.30)' : q < .75 ? 'rgba(58,60,42,.30)' : 'rgba(126,122,90,.20)';
      const parts = []; for (let k = 0; k < n; k++) parts.push([(R() - .5) * sc * 3, (R() - .5) * sc * 1.2, sc * (.5 + R() * .7)]);
      wrapDraw(S, x, y, sc * 3, (X, Y) => { for (const [dx, dy, r] of parts) fell(c, X + dx, Y + dy, r, r * .5, col); });
    }
    for (let i = 0; i < 24; i++) {
      const x = R() * S, y = R() * S, n = 5 + Math.floor(R() * 10), blobs = [], sp = 18 + R() * 40;
      for (let k = 0; k < n; k++) blobs.push([(R() - .5) * sp * 2, (R() - .5) * sp * .7, 3 + R() * 8]);
      blobs.sort((a, b) => a[1] - b[1]);
      wrapDraw(S, x, y, sp * 1.5, (X, Y) => {
        for (const [dx, dy, r] of blobs) fell(c, X + dx, Y + dy + 1.5, r + 1, r * .55 + 1, 'rgba(30,44,22,.45)');
        for (const [dx, dy, r] of blobs) { fell(c, X + dx, Y + dy, r, r * .55, r > 7 ? MOSS.base : MOSS.dark); fell(c, X + dx - r * .25, Y + dy - r * .2, r * .5, r * .25, MOSS.light); }
      });
    }
    for (let i = 0; i < 90; i++) {
      const x = R() * S, y = R() * S, a = R() * TAU, col = ['#7a6a3e', '#6a5a36', '#8a7a4a', '#5e6a38'][Math.floor(R() * 4)];
      wrapDraw(S, x, y, 6, (X, Y) => { c.save(); c.translate(X, Y); c.rotate(a); fell(c, 0, 0, 3.4, 1.6, col); line(c, -3, 0, 3, 0, 'rgba(30,30,20,.4)', .6); c.restore(); });
    }
    for (let i = 0; i < 10; i++) {
      const x = R() * S, y = R() * S, a = R() * TAU, len = 20 + R() * 40;
      wrapDraw(S, x, y, len, (X, Y) => { const p = new Path2D(); p.moveTo(X, Y); p.quadraticCurveTo(X + Math.cos(a) * len * .5 + 8, Y + Math.sin(a) * len * .3, X + Math.cos(a) * len, Y + Math.sin(a) * len * .4); c.strokeStyle = 'rgba(40,34,24,.5)'; c.lineWidth = 2.4; c.stroke(p); c.strokeStyle = 'rgba(140,120,90,.35)'; c.lineWidth = 1; c.stroke(p); });
    }
    for (let i = 0; i < 160; i++) { const x = R() * S, y = R() * S, s = .7 + R() * .6; wrapDraw(S, x, y, 12, (X, Y) => tuft(c, X, Y, s)); }
    for (let i = 0; i < 60; i++) {
      const x = R() * S, y = R() * S, r = 1.6 + R() * 3, light = R() < .5;
      wrapDraw(S, x, y, 6, (X, Y) => { fell(c, X + .8, Y + .8, r, r * .7, '#3a3c2e'); fell(c, X, Y, r, r * .7, light ? '#8f948a' : '#767b72'); fell(c, X - r * .3, Y - r * .3, r * .4, r * .3, '#c4c8bc'); });
    }
    c.fillStyle = 'rgba(30,32,22,.3)'; for (let i = 0; i < 1100; i++) c.fillRect(R() * S, R() * S, 1.5, 1.5);
    c.fillStyle = 'rgba(190,196,150,.25)'; for (let i = 0; i < 500; i++) c.fillRect(R() * S, R() * S, 1.3, 1.3);
    return cv;
  }
  function makeForestTile() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(4040);
    frect(c, 0, 0, S, S, '#1e2a20');
    for (let i = 0; i < 26; i++) { const x = R() * S, y = R() * S, r = 20 + R() * 50, col = R() < .5 ? 'rgba(44,64,40,.45)' : 'rgba(12,18,13,.45)'; wrapDraw(S, x, y, r, (X, Y) => fell(c, X, Y, r, r * .5, col)); }
    for (let i = 0; i < 40; i++) { const x = R() * S, y = R() * S; wrapDraw(S, x, y, 14, (X, Y) => { for (let k = 0; k < 5; k++) line(c, X, Y, X + (k - 2) * 5, Y - 7 + Math.abs(k - 2) * 2, '#35543a', 1.6); }); }
    c.fillStyle = 'rgba(80,72,46,.45)'; for (let i = 0; i < 500; i++) c.fillRect(R() * S, R() * S, 2, 1.4);
    c.fillStyle = 'rgba(6,10,7,.5)'; for (let i = 0; i < 400; i++) c.fillRect(R() * S, R() * S, 1.6, 1.6);
    return cv;
  }
  function makeFlagTile(S, rows, wmin, wmax, seed, tones, grout) {
    const cv = mk(S, S), c = cv.getContext('2d'), R = rng(seed);
    frect(c, 0, 0, S, S, grout);
    let y = 0;
    for (const rh of rows) {
      const ws = []; let sum = 0; while (sum < S - wmax) { const w = wmin + Math.floor(R() * (wmax - wmin)); ws.push(w); sum += w; } ws.push(S - sum);
      let x = Math.floor(R() * 40);
      for (const w of ws) {
        const col = tones[Math.floor(R() * tones.length)], j = () => (R() - .5) * 5;
        const pts = [x + 2 + j(), y + 2 + j(), x + w - 2 + j(), y + 2 + j(), x + w - 2 + j(), y + rh - 2 + j(), x + 2 + j(), y + rh - 2 + j()];
        const moss = R() < .3, crack = R() < .25, mx = R(), my = R();
        for (const ox of [0, -S]) {
          const p = pts.map((v, i) => i % 2 ? v : v + ox);
          fpoly(c, p, col);
          line(c, p[0] + 1, p[1] + 1.5, p[2] - 1, p[3] + 1.5, 'rgba(235,240,228,.35)', 1.5);
          line(c, p[0] + 1.5, p[1] + 1, p[6] + 1.5, p[7] - 1, 'rgba(235,240,228,.2)', 1.2);
          line(c, p[6] + 1, p[7] - 1.5, p[4] - 1, p[5] - 1.5, 'rgba(20,26,22,.38)', 1.6);
          line(c, p[2] - 1.5, p[3] + 1, p[4] - 1.5, p[5] - 1, 'rgba(20,26,22,.28)', 1.2);
          if (moss) fell(c, x + ox + w * mx, y + rh * my, 5 + mx * 7, 3, 'rgba(84,116,58,.5)');
          if (crack) line(c, x + ox + w * .3, y + 4, x + ox + w * .45, y + rh * .6, 'rgba(20,26,22,.38)', 1);
        }
        x += w;
      }
      y += rh;
    }
    for (let i = 0; i < S / 5; i++) fell(c, R() * S, R() * S, 1.4 + R() * 2, 1.1, 'rgba(110,150,70,.45)');
    return cv;
  }
  function makeFaceTile(H, seed) {
    const W = 520, cv = mk(W, H), c = cv.getContext('2d'), R = rng(seed);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#87918a'); g.addColorStop(.35, '#6b7570'); g.addColorStop(1, '#424a46');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    let u = 0;
    while (u < W) {
      let w = 46 + R() * 70; if (W - (u + w) < 40) w = W - u;
      c.fillStyle = 'rgba(225,235,222,.17)'; c.fillRect(u, 0, w * .28, H);
      c.fillStyle = 'rgba(8,14,10,.17)'; c.fillRect(u + w * .72, 0, w * .28, H);
      const ph = R() * TAU, x1 = u + w, y0 = R() * H * .25;
      for (const ox of [0, -W]) {
        const jp = new Path2D(); jp.moveTo(x1 + ox, y0); for (let y = y0; y <= H + 10; y += 10) jp.lineTo(x1 + ox + 3 * Math.sin(y * .05 + ph), y);
        c.strokeStyle = 'rgba(20,26,22,.55)'; c.lineWidth = 2.2; c.stroke(jp);
        c.save(); c.translate(-3, 0); c.strokeStyle = 'rgba(230,238,226,.3)'; c.lineWidth = 1.2; c.stroke(jp); c.restore();
      }
      // jagged horizontal fractures split the column into faceted chunks
      let cy0 = 0;
      while (cy0 < H) {
        const ch = 34 + R() * 52, cy1 = Math.min(H + 4, cy0 + ch), tint = R(), sl = (R() - .5) * 10;
        const pts = [u + 2, cy0, u + w * .5, cy0 + sl * .5, u + w - 2, cy0 + sl, u + w - 2, cy1 + sl, u + w * .55, cy1 + sl * .5 + (R() - .5) * 6, u + 2, cy1];
        if (tint < .35) fpoly(c, pts, 'rgba(230,238,226,.10)'); else if (tint > .7) fpoly(c, pts, 'rgba(8,14,10,.14)');
        const cr = [u + 1, cy1, u + w * .3, cy1 + 3, u + w * .55, cy1 + sl * .5 - 2, u + w - 1, cy1 + sl];
        c.beginPath(); c.moveTo(cr[0], cr[1]); for (let q = 2; q < cr.length; q += 2) c.lineTo(cr[q], cr[q + 1]);
        c.strokeStyle = 'rgba(20,26,22,.5)'; c.lineWidth = 2; c.stroke();
        c.save(); c.translate(0, 2.5); c.strokeStyle = 'rgba(230,238,226,.28)'; c.lineWidth = 1.2; c.stroke(); c.restore();
        cy0 = cy1;
      }
      u += w;
    }
    for (let i = 0; i < 18; i++) {
      const x = R() * W, y0 = R() * H * .5, len = 8 + R() * 46, r = 5 + R() * 11, dark = R() < .5;
      for (const X of [x, x - W, x + W]) {
        frect(c, X - 1.5, y0, 3, len, 'rgba(70,100,48,.32)');
        fell(c, X, y0, r, r * .55, dark ? MOSS.dark : MOSS.base); fell(c, X - r * .3, y0 - r * .2, r * .5, r * .22, MOSS.light);
      }
    }
    for (let i = 0; i < 7; i++) {
      const x = R() * W, len = 40 + R() * 80, ph = R() * TAU;
      for (const X of [x, x - W, x + W]) {
        const p = new Path2D(); p.moveTo(X, 0); for (let y = 0; y < len; y += 8) p.lineTo(X + 4 * Math.sin(y * .08 + ph), y);
        c.strokeStyle = '#2e4a26'; c.lineWidth = 1.8; c.stroke(p);
        for (let y = 6; y < len; y += 11) { const lx = X + 4 * Math.sin(y * .08 + ph); fell(c, lx - 3, y, 3.5, 2.4, MOSS.base); fell(c, lx + 3, y + 4, 3, 2.2, MOSS.light); }
      }
    }
    const fg = c.createLinearGradient(0, H - 46, 0, H); fg.addColorStop(0, 'rgba(10,16,12,0)'); fg.addColorStop(1, 'rgba(10,16,12,.5)'); c.fillStyle = fg; c.fillRect(0, H - 46, W, 46);
    return cv;
  }
  function makeBevelTile(lit) {
    const W = 64, H = 520, cv = mk(W, H), c = cv.getContext('2d'), R = rng(lit ? 61 : 62);
    frect(c, 0, 0, W, H, lit ? '#7b857e' : '#3f4743');
    let v = 0;
    while (v < H) {
      let h = 40 + R() * 46; if (H - (v + h) < 30) h = H - v;
      const p = new Path2D(); p.ellipse(32 + (R() - .5) * 8, v + h / 2, 30, h * .58, 0, 0, TAU);
      celFill(c, p, lit ? '#869089' : '#505853', lit ? '#aab3ab' : '#6a726c', lit ? '#5d6661' : '#323935', { ld: 5, dd: 8 });
      c.strokeStyle = 'rgba(20,26,22,.7)'; c.lineWidth = 1.6; c.stroke(p);
      fell(c, 28, v + 7, 16, 4.5, 'rgba(90,122,58,.75)'); fell(c, 24, v + 5, 7, 2, 'rgba(150,182,96,.6)');
      v += h;
    }
    return cv;
  }

  // ------------------------------------------------------------------ ground decals
  function makePaddy(w, h, seed) {
    const cv = mk(w, h), c = cv.getContext('2d'), R = rng(seed);
    c.lineCap = 'round';
    rrect(c, 0, 0, w, h, 20); c.fillStyle = '#5a5a40'; c.fill();
    const gap = 18, pw = (w - gap * 3) / 2, ph = (h - gap * 3) / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = gap + i * (pw + gap), y = gap + j * (ph + gap), flooded = (i + j + seed) % 4 === 0;
      rrect(c, x, y, pw, ph, 8); c.fillStyle = '#46625c'; c.fill();
      c.save(); rrect(c, x, y, pw, ph, 8); c.clip();
      for (let k = 0; k < 7; k++) { const yy = y + 10 + R() * (ph - 20); line(c, x + R() * pw * .5, yy, x + pw * (.5 + R() * .5), yy, 'rgba(200,225,220,.22)', 2); }
      fell(c, x + pw * .3, y + ph * .3, pw * .25, ph * .12, 'rgba(170,200,205,.18)');
      frect(c, x, y, pw, 6, 'rgba(20,30,25,.35)'); frect(c, x, y, 5, ph, 'rgba(20,30,25,.25)');
      if (!flooded) for (let yy = y + 16; yy < y + ph - 4; yy += 15) for (let xx = x + 11 + ((yy / 15) % 2) * 6; xx < x + pw - 6; xx += 14) {
        line(c, xx + 1, yy + 2, xx + 3, yy + 3, 'rgba(20,40,30,.4)', 2);
        for (let k = -1; k <= 1; k++) line(c, xx, yy, xx + k * 3.5, yy - 8 - (k ? 0 : 3), k ? '#6f9a3c' : '#9cc456', 1.5);
      }
      c.restore();
      rrect(c, x, y, pw, ph, 8); c.strokeStyle = 'rgba(36,34,24,.7)'; c.lineWidth = 1.6; c.stroke();
    }
    for (let i = 0; i < 40; i++) { const t = R(); const onX = R() < .5; const x = onX ? t * w : (R() < .5 ? gap / 2 : (R() < .5 ? w / 2 : w - gap / 2)); const y = onX ? (R() < .5 ? gap / 2 : (R() < .5 ? h / 2 : h - gap / 2)) : t * h; tuft(c, x, y + 4, .8); }
    rrect(c, 0, 0, w, h, 20); c.strokeStyle = 'rgba(36,34,24,.75)'; c.lineWidth = 2; c.stroke();
    return cv;
  }
  function makePond(w, h) {
    const cv = mk(w, h), c = cv.getContext('2d'), R = rng(888), pts = [], pts2 = [];
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, q = .82 + R() * .18; pts.push([w / 2 + Math.cos(a) * w * .47 * q, h / 2 + Math.sin(a) * h * .45 * q]); pts2.push([w / 2 + Math.cos(a) * w * .41 * q, h / 2 + Math.sin(a) * h * .39 * q]); }
    const shore = smoothPath(pts), water = smoothPath(pts2);
    c.fillStyle = '#4b4934'; c.fill(shore);
    c.fillStyle = '#2b433d'; c.fill(water);
    c.save(); c.clip(water);
    c.save(); c.translate(10, 12); c.fillStyle = '#35524a'; c.fill(water); c.restore();
    for (let i = 0; i < 9; i++) { const y = h * .2 + R() * h * .6, x = w * .2 + R() * w * .5; line(c, x, y, x + 30 + R() * 50, y, 'rgba(190,215,210,.2)', 2); }
    c.fillStyle = 'rgba(8,14,12,.35)'; c.fillRect(0, 0, w, 14);
    for (let i = 0; i < 12; i++) {
      const x = w * .2 + R() * w * .6, y = h * .2 + R() * h * .6, r = 8 + R() * 8, a = R() * TAU;
      c.beginPath(); c.moveTo(x, y); c.ellipse(x, y, r, r * .55, 0, a + .4, a + TAU - .1); c.closePath(); c.fillStyle = '#3f6a3a'; c.fill(); sk(c, '#1c2e1a', 1);
      fell(c, x - r * .3, y - r * .15, r * .4, r * .18, 'rgba(140,180,100,.5)');
      if (R() < .35) { fell(c, x + 2, y - 3, 4, 3, '#c49ad8'); fell(c, x + 2, y - 4, 2, 1.5, '#f0dcf6'); }
    }
    c.restore();
    c.strokeStyle = 'rgba(20,26,20,.7)'; c.lineWidth = 2; c.stroke(water);
    c.strokeStyle = 'rgba(30,30,20,.6)'; c.lineWidth = 1.5; c.stroke(shore);
    for (let i = 0; i < 30; i++) { const [px, py] = pts[i % 14]; tuft(c, px + (R() - .5) * 30, py + (R() - .5) * 14, 1); }
    return cv;
  }
  function makeEmblem() {
    const W = 340, H = 250, cv = mk(W, H), c = cv.getContext('2d');
    c.translate(W / 2, H / 2); c.scale(1, .7);
    c.beginPath(); c.arc(0, 0, 160, 0, TAU); c.fillStyle = 'rgba(30,36,34,.2)'; c.fill();
    c.beginPath(); c.arc(0, 0, 160, 0, TAU); sk(c, 'rgba(50,56,52,.7)', 14);
    c.beginPath(); c.arc(0, 0, 151, 0, TAU); sk(c, 'rgba(123,79,160,.65)', 5);
    c.beginPath(); c.arc(0, 0, 168, 0, TAU); sk(c, 'rgba(200,208,195,.35)', 2);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.save(); c.rotate(a); fpoly(c, [-6, -132, 6, -132, 0, -118], 'rgba(50,56,52,.6)'); c.restore(); }
    c.save(); c.translate(-14, 44); noteSym(c, 4, 4, 5.2, 'rgba(200,210,195,.3)'); noteSym(c, 0, 0, 5.2, 'rgba(40,30,58,.72)'); c.restore();
    return cv;
  }
  function makeMossPatch(k) {
    const R = rng(500 + k), w = 90 + k * 20, h = 44 + k * 8, cv = mk(w, h), c = cv.getContext('2d');
    const blobs = []; for (let i = 0; i < 9; i++) blobs.push([w * .2 + R() * w * .6, h * .3 + R() * h * .4, 8 + R() * 12]);
    for (const [x, y, r] of blobs) fell(c, x, y + 2, r + 2, r * .5 + 2, 'rgba(26,40,20,.5)');
    for (const [x, y, r] of blobs) { fell(c, x, y, r, r * .5, MOSS.base); fell(c, x - r * .3, y - r * .15, r * .5, r * .22, MOSS.light); }
    for (let i = 0; i < 6; i++) tuft(c, w * .2 + R() * w * .6, h * .4 + R() * h * .3, .8);
    return cv;
  }
  function makePuddle(k) {
    const R = rng(600 + k), w = 60 + k * 22, h = 24 + k * 6, cv = mk(w, h), c = cv.getContext('2d');
    fell(c, w / 2, h / 2, w / 2 - 2, h / 2 - 2, '#3e443a');
    fell(c, w / 2 + 2, h / 2 + 1, w / 2 - 6, h / 2 - 5, '#3e5a56');
    fell(c, w * .38, h * .4, w * .18, h * .12, 'rgba(200,222,218,.45)');
    line(c, w * .55, h * .6, w * .75, h * .6, 'rgba(200,222,218,.3)', 1.5);
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, TAU); sk(c, 'rgba(30,32,24,.5)', 1.2);
    return cv;
  }
  function makeMist(k) {
    const W = 760 + k * 120, H = 150, cv = mk(W, H), c = cv.getContext('2d'), R = rng(300 + k);
    for (let i = 0; i < 9; i++) {
      const x = 110 + R() * (W - 220), y = H / 2 + (R() - .5) * 30, rx = 90 + R() * 110, ry = 22 + R() * 22;
      c.save(); c.translate(x, y); c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(206,220,210,.22)'); g.addColorStop(1, 'rgba(206,220,210,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
    }
    return cv;
  }
  function makeMote(rgb) {
    const cv = mk(18, 18), c = cv.getContext('2d'), g = c.createRadialGradient(9, 9, 0, 9, 9, 9);
    g.addColorStop(0, 'rgba(255,255,235,1)'); g.addColorStop(.22, `rgba(${rgb},.9)`); g.addColorStop(.5, `rgba(${rgb},.3)`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(0, 0, 18, 18); return cv;
  }

  // ------------------------------------------------------------------ ridge geometry (rock wall + forest round the compound)
  const yN = x => 236 + 30 * wv(x, 1), yNb = x => 398 - 8 * wv(x, 2);           // north face: top edge / foot
  const xW = y => 362 + 18 * wv(y, 3), xWb = y => 400 - 6 * wv(y, 6);           // west bevel: top edge / foot
  const xE = y => 3278 - 18 * wv(y, 4), xEb = y => 3240 + 6 * wv(y, 7);         // east bevel
  const yS = x => 3244 + 14 * wv(x, 5);                                          // south inner lip
  const ySf = x => 3594 + 20 * wv(x, 8), yB = x => 3756 + 16 * wv(x, 9);        // south outer face top / foot
  const xL = y => -80 + 40 * wv(y, 13), xR = y => 3720 - 40 * wv(y, 14), yR = x => -110 + 40 * wv(x, 12);
  const GL = y => 1590 + 8 * wv(y, 15), GR = y => 2050 - 8 * wv(y, 16);         // ridge gap at the gate
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
  function lineH(f, a, b) { const p = new Path2D(); p.moveTo(a, f(a)); for (let x = a + 8; x <= b; x += 8) p.lineTo(x, f(x)); return p; }
  function topPolygon() {
    const P = [], st = 8;
    for (let x = -100; x <= 3740; x += st) P.push([x, yR(x)]);
    for (let y = -100; y <= 3760; y += st) P.push([xR(y), y]);
    for (let x = 3740; x >= 2056; x -= st) P.push([x, yB(x)]);
    for (let y = Math.round(yB(2050)); y >= 3240; y -= st) P.push([GR(y), y]);
    for (let x = 2056; x <= 3280; x += st) P.push([x, yS(x)]);
    for (let y = 3244; y >= 250; y -= st) P.push([xE(y), y]);
    for (let x = 3280; x >= 360; x -= st) P.push([x, yN(x)]);
    for (let y = 250; y <= 3244; y += st) P.push([xW(y), y]);
    for (let x = 360; x <= 1584; x += st) P.push([x, yS(x)]);
    for (let y = 3240; y <= Math.round(yB(1590)); y += st) P.push([GL(y), y]);
    for (let x = 1584; x >= -100; x -= st) P.push([x, yB(x)]);
    for (let y = 3760; y >= -100; y -= st) P.push([xL(y), y]);
    return pathFrom(P);
  }

  // ------------------------------------------------------------------ prop sprites
  function makeProps() {
    const P = {};
    P.pines = [.85, 1, 1.15].map((s, i) => sprite(Math.ceil(96 * s + 30), Math.ceil(172 * s + 24), Math.ceil(48 * s + 12), Math.ceil(172 * s + 10), (c, ax, ay) => drawPineO(c, ax, ay, s, 100 + i * 7)));
    P.broads = [.85, 1, 1.15].map((s, i) => sprite(Math.ceil(140 * s + 40), Math.ceil(130 * s + 30), Math.ceil(70 * s + 16), Math.ceil(130 * s + 14), (c, ax, ay) => drawBroadO(c, ax, ay, s, 200 + i * 11)));
    P.dead = [.9, 1.15].map((s, i) => sprite(Math.ceil(150 * s), Math.ceil(140 * s), Math.ceil(75 * s), Math.ceil(132 * s), (c, ax, ay) => drawDeadO(c, ax, ay, s, 300 + i * 13)));
    P.rocks = [12, 18, 26, 36].map((r, i) => sprite(Math.ceil(r * 3 + 16), Math.ceil(r * 1.9 + 18), Math.round(r * 1.35 + 5), Math.round(r * 1.25 + 7), (c, ax, ay) => mossRock(c, ax, ay, r, 400 + i * 17)));
    P.fern = sprite(76, 50, 38, 44, (c, ax, ay) => {
      fell(c, ax + 6, ay, 24, 6, SHADOW);
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + .25 + i / 7 * (Math.PI - .5), len = 22 + (i % 3) * 5, ex = ax + Math.cos(a) * len * 1.2, ey = ay + Math.sin(a) * len * .9;
        const p = new Path2D(); p.moveTo(ax, ay - 2); p.quadraticCurveTo((ax + ex) / 2, ey - 10, ex, ey + 4);
        c.strokeStyle = TR.out; c.lineWidth = 4.5; c.stroke(p); c.strokeStyle = i % 2 ? '#3f6a38' : '#4f7d40'; c.lineWidth = 3; c.stroke(p);
        for (let t = .25; t < 1; t += .18) { const [px, py] = quadPt(ax, ay - 2, (ax + ex) / 2, ey - 10, ex, ey + 4, t); line(c, px, py, px - 3, py + 3, '#6a9a4e', 1.4); line(c, px, py, px + 3, py + 2, '#6a9a4e', 1.4); }
      }
    });
    P.reeds = sprite(64, 74, 32, 66, (c, ax, ay) => {
      fell(c, ax + 5, ay, 20, 5, SHADOW);
      const R = rng(77);
      for (let i = 0; i < 12; i++) {
        const x = ax + (R() - .5) * 32, h = 34 + R() * 24, lean = (R() - .5) * 14;
        line(c, x, ay, x + lean, ay - h, TR.out, 3); line(c, x, ay, x + lean, ay - h, i % 2 ? '#6d8a3e' : '#8aa44e', 1.6);
        if (R() < .45) { fell(c, x + lean * .92, ay - h * .9, 2.6, 6.5, '#5e4028'); c.beginPath(); c.ellipse(x + lean * .92, ay - h * .9, 2.6, 6.5, 0, 0, TAU); sk(c, OUT, .9); }
      }
    });
    P.mush = sprite(46, 30, 22, 26, (c, ax, ay) => {
      fell(c, ax + 3, ay, 16, 4, SHADOW);
      for (const [dx, dy, r] of [[-8, 0, 6], [4, 2, 8], [12, -1, 4.5]]) {
        frect(c, ax + dx - r * .25, ay + dy - r * 1.2, r * .5, r * 1.2, '#d8d0bc'); srect(c, ax + dx - r * .25, ay + dy - r * 1.2, r * .5, r * 1.2, OUT, .8);
        const p = new Path2D(); p.moveTo(ax + dx - r, ay + dy - r * 1.1); p.quadraticCurveTo(ax + dx, ay + dy - r * 2.6, ax + dx + r, ay + dy - r * 1.1); p.closePath();
        celFill(c, p, '#8c6aa0', '#b494c6', '#5e4472', { ld: 1.5, dd: 2 }); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke(p);
        fell(c, ax + dx - r * .3, ay + dy - r * 1.6, r * .18, r * .14, '#efe6f4'); fell(c, ax + dx + r * .35, ay + dy - r * 1.4, r * .14, r * .1, '#efe6f4');
      }
    });
    P.toro = sprite(44, 74, 22, 66, (c, ax, ay) => toro(c, ax, ay, 1.15));
    P.brazier = sprite(44, 80, 22, 72, (c, ax, ay) => brazier(c, ax, ay, 1.1));
    P.bellTower = sprite(140, 200, 70, 188, (c, ax, ay) => drawBellTower(c, ax, ay));
    P.jarRack = sprite(116, 96, 54, 86, (c, ax, ay) => {
      fell(c, ax + 10, ay, 50, 9, SHADOW);
      for (const px of [ax - 44, ax + 44]) { line(c, px, ay, px, ay - 74, OUT, 5); line(c, px, ay, px, ay - 74, WOOD.base, 3); }
      for (const sy of [ay - 8, ay - 46]) { frect(c, ax - 48, sy, 96, 6, WOOD.light); frect(c, ax - 48, sy + 4, 96, 2, WOOD.dark); srect(c, ax - 48, sy, 96, 6, OUT, 1.2); }
      for (let k = 0; k < 4; k++) jar(c, ax - 33 + k * 22, ay - 8, .82, LIQ[k], k);
      for (let k = 0; k < 4; k++) jar(c, ax - 31 + k * 21, ay - 46, .7, LIQ[(k + 2) % 4], k + 1);
    });
    P.tank = sprite(80, 140, 34, 128, (c, ax, ay) => specimenTank(c, ax, ay, 24, 86));
    P.crates = sprite(84, 74, 38, 64, (c, ax, ay) => crates(c, ax, ay));
    P.barrels = sprite(74, 60, 34, 52, (c, ax, ay) => barrels(c, ax, ay));
    P.statueL = sprite(250, 270, 120, 252, (c, ax, ay) => snakeStatue(c, ax, ay, 1.1, false));
    P.statueR = sprite(250, 270, 130, 252, (c, ax, ay) => snakeStatue(c, ax, ay, 1.1, true));
    P.coil = sprite(110, 110, 50, 100, (c, ax, ay) => snakeStatue(c, ax, ay, .45, false));
    P.skull = sprite(330, 160, 160, 130, (c, ax, ay) => drawSkull(c, ax, ay));
    P.torii = sprite(150, 130, 75, 120, (c, ax, ay) => drawTorii(c, ax, ay, 1.05));
    P.tablets = sprite(124, 74, 58, 62, (c, ax, ay) => {
      fell(c, ax + 8, ay, 52, 9, SHADOW);
      const st = tone('#888d86');
      for (const [dx, dy, w, h, rot] of [[-38, 0, 16, 34, -.07], [-14, 3, 18, 44, .02], [12, 0, 15, 30, .12], [36, 4, 17, 38, -.04]]) {
        c.save(); c.translate(ax + dx, ay + dy); c.rotate(rot);
        const p = new Path2D(); p.moveTo(-w / 2, 0); p.lineTo(-w / 2, -h + w / 2); p.arc(0, -h + w / 2, w / 2, Math.PI, 0); p.lineTo(w / 2, 0); p.closePath();
        celFill(c, p, st.base, st.light, st.dark, { ld: 2, dd: 3 }); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(p);
        frect(c, -1.5, -h + 10, 3, h - 16, 'rgba(30,36,32,.35)');
        fell(c, -w * .15, -h + w * .3, w * .35, 2.5, 'rgba(90,122,58,.85)');
        c.restore();
      }
      line(c, ax - 2, ay + 6, ax - 2, ay - 6, '#c8b88a', 1); line(c, ax + 2, ay + 6, ax + 3, ay - 5, '#c8b88a', 1);
    });
    P.scarecrow = sprite(74, 104, 37, 94, (c, ax, ay) => {
      fell(c, ax + 6, ay, 16, 4, SHADOW);
      line(c, ax, ay, ax, ay - 76, OUT, 5); line(c, ax, ay, ax, ay - 76, WOOD.light, 3);
      line(c, ax - 27, ay - 56, ax + 27, ay - 56, OUT, 5); line(c, ax - 27, ay - 56, ax + 27, ay - 56, WOOD.light, 3);
      const coat = [ax - 22, ay - 58, ax + 22, ay - 58, ax + 15, ay - 30, ax + 5, ay - 34, ax - 5, ay - 28, ax - 16, ay - 33];
      fpoly(c, coat, '#5e4f72'); fpoly(c, [ax - 22, ay - 58, ax - 6, ay - 58, ax - 10, ay - 32, ax - 16, ay - 33], '#7a6a8e'); poly(c, coat); sk(c, OUT, 1.3);
      frect(c, ax + 4, ay - 50, 8, 8, '#8a7a50'); srect(c, ax + 4, ay - 50, 8, 8, OUT, .8);
      rope(c, ax - 14, ay - 42, ax + 14, ay - 42, 1, { shide: false, w: 3 });
      fell(c, ax, ay - 68, 9, 9, '#cbb47a'); c.beginPath(); c.arc(ax, ay - 68, 9, 0, TAU); sk(c, OUT, 1.2);
      fell(c, ax - 3, ay - 68, 1.5, 1.5, OUT); fell(c, ax + 3, ay - 68, 1.5, 1.5, OUT);
      const hat = [ax - 22, ay - 71, ax, ay - 86, ax + 22, ay - 71];
      fpoly(c, hat, '#b89a58'); fpoly(c, [ax - 22, ay - 71, ax, ay - 86, ax, ay - 71], '#d2b878'); poly(c, hat); sk(c, OUT, 1.3);
    });
    P.banner = sprite(54, 220, 14, 210, (c, ax, ay) => drawBanner(c, ax, ay, 180));
    P.booth = sprite(150, 180, 76, 166, (c, ax, ay) => drawBooth(c, ax, ay));
    P.arch = sprite(500, 380, 250, 346, (c, ax, ay) => drawGateArch(c, ax, ay));
    return P;
  }

  // ------------------------------------------------------------------ state
  const A = {};
  let ready = false;
  const foots = [];          // footprint array (stable order)
  const objs = [];           // drawable objects sorted by base y
  const DECALS = [];         // flat ground art
  const BELLS = [];          // sound-wave ring sources (bell / speaker towers)
  const lanternsLocal = [];

  const STONES = ['#868c85', '#7b848a', '#8d8a7e', '#727d73'].map(tone);
  const ROOFS = ['#4a5459', '#435a48', '#574c62', '#5b605a'].map(tone);
  const VAR = {
    tw: [vTower, 0, 1, 0], tw2: [vTower, 2, 3, 2],
    lb: [vLab, 1, 0, 3], lb2: [vLab, 3, 2, 1],
    bk: [vBarracks, 0, 2, 2], bk2: [vBarracks, 1, 3, 0],
    sh: [vShrine, 2, 0, 1], sh2: [vShrine, 0, 1, 2],
    bu: [vBunker, 3, 0, 1], bu2: [vBunker, 1, 2, 0],
    lr: [vLair, 0, 1, 0], lr2: [vLair, 2, 3, 1]
  };
  // [cell x, cell y, variant, offset x, offset y]
  const HOUSES = [
    [1, 1, 'tw', 96, 118], [2, 1, 'lb', 104, 112], [3, 1, 'bk', 100, 104], [4, 1, 'sh', 100, 112], [5, 1, 'bu', 106, 118],
    [1, 2, 'bu2', 96, 104], [5, 2, 'lr', 104, 108],
    [1, 3, 'lr2', 100, 100], [5, 3, 'lb2', 100, 106],
    [1, 4, 'sh2', 98, 100], [2, 4, 'bu', 100, 96], [4, 4, 'tw2', 100, 96], [5, 4, 'bk2', 100, 100],
    [1, 5, 'lr', 100, 112], [5, 5, 'lb', 100, 110]
  ];

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
    const pat = (cv, tx = 0, ty = 0) => { const p = tmp.createPattern(cv, 'repeat'); if (tx || ty) p.setTransform(new DOMMatrix([1, 0, 0, 1, tx, ty])); return p; };
    A.earthPat = pat(makeEarthTile());
    A.forestPat = pat(makeForestTile());
    A.flagPat = pat(makeFlagTile(256, [44, 52, 40, 64, 56], 28, 70, 71, ['#8a8f88', '#7d837e', '#949890', '#868a80', '#767c78'], '#3f4a34'));
    A.smallFlagPat = pat(makeFlagTile(192, [30, 34, 28, 36, 32, 32], 20, 46, 93, ['#7c817a', '#73796f', '#868a80', '#6c726b'], '#3d4532'));
    A.nFacePat = pat(makeFaceTile(190, 11), 0, 224);
    A.sFacePat = pat(makeFaceTile(200, 12), 0, 3586);
    const bevD = makeBevelTile(false), bevL = makeBevelTile(true);
    A.bevW = pat(bevD, 340, 0); A.bevE = pat(bevL, 3216, 0); A.bevGL = pat(bevD, 1574, 0); A.bevGR = pat(bevL, 2002, 0);
    A.mist = [0, 1, 2].map(makeMist);
    A.moteY = makeMote('214,236,120'); A.moteP = makeMote('186,128,255');
    A.TOP = topPolygon();
    A.NFACE = bandH(yN, yNb, 352, 3288); A.NTOP = lineH(yN, 352, 3288);
    A.WBEV = bandV(xW, xWb, 392, 3250); A.EBEV = bandV(xEb, xE, 392, 3250);
    A.GBEVL = bandV(GL, y => GL(y) + 28, 3236, 3764); A.GBEVR = bandV(y => GR(y) - 28, GR, 3236, 3764);
    A.SFACEL = bandH(ySf, yB, -100, 1584); A.SFACER = bandH(ySf, yB, 2056, 3740);
    A.SLIPL = lineH(ySf, -100, 1584); A.SLIPR = lineH(ySf, 2056, 3740);
    A.NSH = bandH(yNb, x => yNb(x) + 26, 380, 3270); A.WSH = bandV(xWb, y => xWb(y) + 24, 396, 3244);
    A.GSH = bandV(y => GL(y) + 28, y => GL(y) + 50, 3240, 3640);
    const PR = A.props = makeProps();

    foots.length = 0; objs.length = 0; lanternsLocal.length = 0; DECALS.length = 0; BELLS.length = 0;
    const addFoot = f => { foots.push(f); return foots.length - 1; };
    const addLamp = (x, y) => lanternsLocal.push({ x: Math.round(x), y: Math.round(y) });
    const taken = [];
    const place = (s, x, y, m, lampDy) => {
      taken.push([x, y, m]);
      objs.push({ img: s.cv, x: Math.round(x - s.ax), y: Math.round(y - s.ay), w: s.cv.width, h: s.cv.height, by: y, fi: -1 });
      if (lampDy) addLamp(x + lampDy[0], y + lampDy[1]);
    };

    // ---- ridge: one solid footprint per perimeter cell (gate cell (3,6) left open)
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      if (cx > 0 && cx < NC - 1 && cy > 0 && cy < NC - 1) continue;
      if (cx === 3 && cy === NC - 1) continue;
      const gx = cx * BLOCK, gy = cy * BLOCK;
      let f;
      if ((cx === 0 || cx === NC - 1) && (cy === 0 || cy === NC - 1)) f = { x: gx, y: gy, w: BLOCK, h: BLOCK };
      else if (cy === 0) f = { x: gx, y: 0, w: BLOCK, h: 400 };
      else if (cy === NC - 1) f = { x: gx, y: 3240, w: BLOCK, h: 400 };
      else if (cx === 0) f = { x: 0, y: gy, w: 400, h: BLOCK };
      else f = { x: 3240, y: gy, w: 400, h: BLOCK };
      addFoot(Object.assign(f, { solid: true, roof: '#2f4230', wall: '#5d655e' }));
    }

    // ---- the hideout
    {
      const P = { lamps: [] };
      const cv = buildingCanvas(lmHideout, P, LW, LH, LOVER);
      const fi = addFoot({ x: LM.x, y: LM.y, w: LW, h: LH, roof: '#6a4a8a', wall: '#7d8580' });
      objs.push({ img: cv, x: LM.x - SM, y: LM.y - LOVER, w: cv.width, h: cv.height, by: LM.y + LH, fi });
      for (const [lx, ly] of P.lamps) addLamp(LM.x + lx, LM.y + ly);
    }

    // ---- houses (one cached canvas per variant)
    const cache = {};
    for (const [cx, cy, key, ox, oy] of HOUSES) {
      const v = VAR[key];
      if (!cache[key]) {
        const P = { S: STONES[v[1]], S2: STONES[v[2]], R: ROOFS[v[3]], idx: Object.keys(cache).length, lamps: [], bells: [] };
        cache[key] = { cv: buildingCanvas(v[0], P, FW, FH, OVER), lamps: P.lamps, bells: P.bells, roof: P.R.base, wall: P.S.base };
      }
      const e = cache[key], x = cx * BLOCK + ox, y = cy * BLOCK + oy;
      const fi = addFoot({ x, y, w: FW, h: FH, roof: e.roof, wall: e.wall });
      objs.push({ img: e.cv, x: x - SM, y: y - OVER, w: e.cv.width, h: e.cv.height, by: y + FH, fi });
      for (const [lx, ly] of e.lamps) addLamp(x + lx, y + ly);
      for (const [bx, bY] of e.bells) BELLS.push([x + bx, y + bY]);
    }

    // ---- ground decals
    const addDecal = (img, x, y, block) => DECALS.push({ img, x: Math.round(x), y: Math.round(y), w: img.width, h: img.height, block });
    A.emblem = makeEmblem(); addDecal(A.emblem, 1820 - A.emblem.width / 2, 2300 - A.emblem.height / 2, false);
    addDecal(makePaddy(420, 380, 1), 1100, 2700, true); addDecal(makePaddy(420, 380, 2), 2120, 2700, true);
    addDecal(makePond(380, 360), 2150, 1120, true);
    const mp = [0, 1, 2].map(makeMossPatch), pd = [0, 1, 2].map(makePuddle);
    {
      const R = rng(5150);
      for (let i = 0; i < 70; i++) {
        const x = 440 + R() * 2760, y = 440 + R() * 2760, img = R() < .62 ? mp[i % 3] : pd[i % 3];
        if (inRect(x, y, PLAZA, 40) || inRect(x, y, ROAD, 40) || STREETS.some(s => inRect(x, y, s, 30))) continue;
        if (foots.some(f => !f.solid && inRect(x, y, f, 10))) continue;
        if (DECALS.some(d => d.block && inRect(x, y, d, 40))) continue;
        addDecal(img, x - img.width / 2, y - img.height / 2, false);
      }
    }

    // ---- ridge forest (dense dark trees and boulders on the plateau)
    {
      const RT = rng(9001);
      for (let gy = -96; gy < 3780; gy += 54) for (let gx = -90; gx < 3730; gx += 54) {
        const x = gx + (RT() - .5) * 44, y = gy + (RT() - .5) * 44, k = RT(), vi = Math.floor(RT() * 3);
        if (x > 440 && x < 3200 && y > 440 && y < 3200) continue;
        if (!tmp.isPointInPath(A.TOP, x, y)) continue;
        if (y > 3400 && y > ySf(x) - 14) continue;
        if (y < 420 && y > yN(x) - 10) continue;
        if (x < 420 && x > xW(y) - 10) continue;
        if (x > 3220 && x < xE(y) + 10) continue;
        if (y > 3200 && y < yS(x) + 12) continue;
        const s = k < .06 ? PR.dead[vi % 2] : k < .1 ? PR.rocks[2 + (vi % 2)] : k < .56 ? PR.pines[vi] : PR.broads[vi];
        objs.push({ img: s.cv, x: Math.round(x - s.ax), y: Math.round(y - s.ay), w: s.cv.width, h: s.cv.height, by: y, fi: -1 });
      }
      // talus and ferns at the foot of the walls
      const RF = rng(9002);
      for (let x = 430; x < 3220; x += 70 + RF() * 70) { const y = yNb(x) + 8 + RF() * 16; place(RF() < .55 ? PR.rocks[Math.floor(RF() * 3)] : PR.fern, x, y, 20); }
      for (let y = 440; y < 3220; y += 80 + RF() * 80) {
        const xa = xWb(y) + 8 + RF() * 14; place(RF() < .55 ? PR.rocks[Math.floor(RF() * 3)] : PR.fern, xa, y, 20);
        const xb = xEb(y) - 8 - RF() * 14; place(RF() < .55 ? PR.rocks[Math.floor(RF() * 3)] : PR.fern, xb, y, 20);
      }
      for (const [x, y, r] of [[450, 470, 3], [418, 432, 2], [3190, 470, 3], [3222, 436, 2], [452, 3200, 2], [3188, 3196, 2], [500, 440, 1], [3140, 444, 1]]) place(PR.rocks[r], x, y, 30);
      // watch bells on the north ridge
      for (const bx of [1040, 2600]) { const by = Math.round(yN(bx) - 14); place(PR.bellTower, bx, by, 60, [0, -96]); BELLS.push([bx, by - 100]); }
    }

    // ---- hand-placed features
    // (2,2) giant snake skull
    place(PR.skull, 1310, 1350, 150); place(PR.rocks[2], 1150, 1230, 30); place(PR.rocks[1], 1470, 1470, 24); place(PR.dead[1], 1170, 1480, 40); place(PR.fern, 1460, 1220, 24); place(PR.mush, 1240, 1420, 16);
    // (3,2) dark grove behind the hideout
    for (const [x, y, s] of [[1640, 1420, PR.pines[2]], [1730, 1330, PR.pines[1]], [1910, 1320, PR.broads[1]], [2010, 1410, PR.pines[2]], [1820, 1270, PR.pines[0]], [1600, 1500, PR.rocks[3]], [2040, 1510, PR.rocks[2]]]) place(s, x, y, 30);
    // (4,2) marsh pond
    for (const [x, y] of [[2170, 1300], [2250, 1150], [2470, 1220], [2500, 1400], [2300, 1470], [2190, 1420]]) place(PR.reeds, x, y, 20);
    place(PR.dead[0], 2530, 1150, 30); place(PR.rocks[1], 2160, 1180, 20);
    // (2,3) shrine grove
    place(PR.torii, 1300, 1900, 60); place(PR.coil, 1300, 1740, 40, [0, -40]);
    place(PR.toro, 1215, 1830, 20, [0, -48]); place(PR.toro, 1385, 1830, 20, [0, -48]);
    place(PR.tablets, 1150, 1690, 40); place(PR.tablets, 1450, 1700, 40);
    place(PR.pines[1], 1110, 1610, 30); place(PR.broads[0], 1490, 1610, 30); place(PR.fern, 1180, 1980, 20); place(PR.fern, 1430, 1990, 20);
    // (4,3) laboratory yard with a bell tower
    place(PR.bellTower, 2340, 1770, 60, [0, -96]); BELLS.push([2340, 1670]);
    place(PR.tank, 2180, 1720, 34, [0, -60]); place(PR.tank, 2240, 1690, 30);
    place(PR.jarRack, 2200, 1980, 50); place(PR.jarRack, 2470, 1975, 50);
    place(PR.crates, 2490, 1690, 34); place(PR.barrels, 2140, 1880, 30); place(PR.crates, 2350, 1900, 30);
    // (3,4) plaza before the hideout
    place(PR.statueL, 1650, 2118, 90); place(PR.statueR, 1990, 2118, 90);
    place(PR.brazier, 1738, 2024, 16, [0, -58]); place(PR.brazier, 1902, 2024, 16, [0, -58]);
    place(PR.bellTower, 1640, 2490, 50, [0, -96]); place(PR.bellTower, 2000, 2490, 50, [0, -96]);
    BELLS.push([1640, 2390], [2000, 2390]);
    place(PR.banner, 1596, 2300, 20); place(PR.banner, 2016, 2300, 20);
    // (3,5) avenue to the gate
    for (const y of [2730, 2910, 3090]) { place(PR.toro, 1698, y, 16, [0, -48]); place(PR.toro, 1942, y, 16, [0, -48]); }
    place(PR.banner, 1680, 2820, 16); place(PR.banner, 1946, 3000, 16);
    // (2,5),(4,5) rice paddies
    place(PR.scarecrow, 1310, 2900, 20); place(PR.scarecrow, 2330, 2910, 20);
    for (const [x, y] of [[1090, 2700], [1530, 3090], [2110, 3080], [2550, 2700], [1530, 2700], [2550, 3090]]) place(PR.reeds, x, y, 16);
    // gate
    place(PR.arch, 1820, 3336, 40);
    place(PR.booth, 1658, 3566, 30, [-50, -46]); place(PR.booth, 1982, 3566, 30, [-50, -46]);
    place(PR.brazier, 1706, 3446, 14, [0, -58]); place(PR.brazier, 1934, 3446, 14, [0, -58]);

    // ---- scatter
    const blocked = (x, y, m) => {
      if (x < 450 || x > 3190 || y < 440 || y > 3200) return true;
      if (inRect(x, y, PLAZA, m) || inRect(x, y, ROAD, m)) return true;
      for (const s of STREETS) if (inRect(x, y, s, m * .6)) return true;
      for (const f of foots) if (!f.solid && inRect(x, y, f, m + 10)) return true;
      for (const d of DECALS) if (d.block && inRect(x, y, d, m * .4)) return true;
      for (const t of taken) if (Math.hypot(t[0] - x, t[1] - y) < t[2] + m) return true;
      return false;
    };
    {
      const R = rng(4242);
      const pool = [PR.fern, PR.fern, PR.rocks[0], PR.rocks[1], PR.mush, PR.rocks[0], PR.fern, PR.crates, PR.barrels, PR.broads[0], PR.pines[0], PR.tablets, PR.mush];
      for (let i = 0; i < 520; i++) {
        const x = 450 + R() * 2740, y = 450 + R() * 2740, s = pool[Math.floor(R() * pool.length)], m = Math.max(18, s.cv.width * .35);
        if (!blocked(x, y, m)) place(s, x, y, m);
      }
    }
    objs.sort((p, q) => p.by - q.by || p.x - q.x);
    ready = true;
  }

  // ------------------------------------------------------------------ drawing
  function fillPaths(ctx, x0, y0, x1, y1) {
    const hit = r => r.x - 8 < x1 && r.x + r.w + 8 > x0 && r.y - 8 < y1 && r.y + r.h + 8 > y0;
    ctx.fillStyle = 'rgba(26,34,22,.5)';
    for (const s of STREETS) if (hit(s)) ctx.fillRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8);
    ctx.fillStyle = A.smallFlagPat;
    for (const s of STREETS) if (hit(s)) ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = 'rgba(26,34,22,.55)';
    for (const s of [ROAD, PLAZA]) if (hit(s)) ctx.fillRect(s.x - 6, s.y - 6, s.w + 12, s.h + 12);
    ctx.fillStyle = A.flagPat;
    for (const s of [ROAD, PLAZA]) if (hit(s)) ctx.fillRect(s.x, s.y, s.w, s.h);
    if (hit(PLAZA)) {
      ctx.strokeStyle = '#5a615b'; ctx.lineWidth = 12; ctx.strokeRect(PLAZA.x + 6, PLAZA.y + 6, PLAZA.w - 12, PLAZA.h - 12);
      ctx.strokeStyle = 'rgba(205,214,200,.35)'; ctx.lineWidth = 2; ctx.strokeRect(PLAZA.x + 13, PLAZA.y + 13, PLAZA.w - 26, PLAZA.h - 26);
    }
    if (hit(ROAD)) { ctx.fillStyle = '#5a615b'; ctx.fillRect(ROAD.x, PLAZA.y + PLAZA.h, 8, SIZE); ctx.fillRect(ROAD.x + ROAD.w - 8, PLAZA.y + PLAZA.h, 8, SIZE); }
  }
  function drawRing(c, X0, Y0, X1, Y1) {
    if (X0 > 430 && X1 < 3210 && Y0 > 430 && Y1 < 3210) return;
    c.save();
    c.fillStyle = SHADOW; c.fill(A.NSH); c.fill(A.WSH); c.fill(A.GSH);
    c.fillStyle = A.nFacePat; c.fill(A.NFACE);
    c.save(); c.clip(A.NFACE); c.strokeStyle = MOSS.dark; c.lineWidth = 18; c.stroke(A.NTOP); c.strokeStyle = MOSS.base; c.lineWidth = 8; c.stroke(A.NTOP); c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(A.NFACE);
    c.fillStyle = A.bevW; c.fill(A.WBEV); c.fillStyle = A.bevE; c.fill(A.EBEV);
    c.fillStyle = A.bevGL; c.fill(A.GBEVL); c.fillStyle = A.bevGR; c.fill(A.GBEVR);
    c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(A.WBEV); c.stroke(A.EBEV); c.stroke(A.GBEVL); c.stroke(A.GBEVR);
    c.fillStyle = A.forestPat; c.fill(A.TOP);
    c.fillStyle = A.sFacePat; c.fill(A.SFACEL); c.fill(A.SFACER);
    c.save(); c.clip(A.TOP);
    c.strokeStyle = 'rgba(70,100,52,.55)'; c.lineWidth = 22; c.stroke(A.TOP);
    c.strokeStyle = 'rgba(150,185,105,.4)'; c.lineWidth = 6; c.stroke(A.TOP);
    c.strokeStyle = MOSS.dark; c.lineWidth = 12; c.stroke(A.SLIPL); c.stroke(A.SLIPR);
    c.strokeStyle = MOSS.base; c.lineWidth = 5; c.stroke(A.SLIPL); c.stroke(A.SLIPR);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(A.SLIPL); c.stroke(A.SLIPR);
    c.lineWidth = 2.6; c.stroke(A.TOP);
    c.restore();
  }

  function drawStatic(ctx, bounds, isDestroyed) {
    if (!ready) build();
    const x0 = bounds.x, y0 = bounds.y, x1 = bounds.x + bounds.w, y1 = bounds.y + bounds.h;
    if (x1 < -160 || x0 > SIZE + 160 || y1 < -160 || y0 > SIZE + 160) return;
    const ix0 = Math.max(0, x0), iy0 = Math.max(0, y0), ix1 = Math.min(SIZE, x1), iy1 = Math.min(SIZE, y1);
    ctx.save();
    if (ix1 > ix0 && iy1 > iy0) {
      ctx.save(); ctx.beginPath(); ctx.rect(ix0, iy0, ix1 - ix0, iy1 - iy0); ctx.clip();
      ctx.fillStyle = A.earthPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      fillPaths(ctx, ix0, iy0, ix1, iy1);
      for (const d of DECALS) if (d.x < x1 && d.x + d.w > x0 && d.y < y1 && d.y + d.h > y0) ctx.drawImage(d.img, d.x, d.y);
      ctx.restore();
    }
    drawRing(ctx, x0, y0, x1, y1);
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
    const t = time || 0, vx0 = Math.max(view.x, -120), vy0 = Math.max(view.y, -120), vx1 = Math.min(view.x + view.w, SIZE + 120), vy1 = Math.min(view.y + view.h, SIZE + 120);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    ctx.save();
    // slow drifting low mist bands
    const SP = SIZE + 1000;
    for (let i = 0; i < 12; i++) {
      const img = A.mist[i % 3], v = 6 + hash2(i, 1, 21) * 10, y = 160 + hash2(i, 2, 21) * (SIZE - 300) + Math.sin(t * .07 + i * 1.3) * 26;
      const x = ((hash2(i, 3, 21) * SP + t * v) % SP) - 700;
      if (x > vx1 || x + img.width < vx0 || y > vy1 || y + img.height < vy0) continue;
      ctx.globalAlpha = .6 + .3 * Math.sin(t * .11 + i * 2.1);
      ctx.drawImage(img, x, y);
    }
    // fireflies and purple chakra motes
    for (let i = 0; i < 150; i++) {
      const bx = 300 + hash2(i, 4, 21) * (SIZE - 600), by = 300 + hash2(i, 5, 21) * (SIZE - 600);
      const x = bx + Math.sin(t * .4 + i * 2.3) * 46 + Math.sin(t * 1.1 + i) * 8, y = by + Math.cos(t * .33 + i * 1.7) * 30 - (i % 4 === 0 ? (t * 9 + i * 13) % 60 : 0);
      if (x < vx0 - 10 || x > vx1 + 10 || y < vy0 - 10 || y > vy1 + 10) continue;
      const b = .5 + .5 * Math.sin(t * (1.6 + (i % 5) * .3) + i * 3.1);
      if (b < .15) continue;
      ctx.globalAlpha = b;
      ctx.drawImage(i % 4 === 0 ? A.moteP : A.moteY, x - 9, y - 9);
    }
    // sound-wave rings pulsing from the bell / speaker towers
    ctx.strokeStyle = '#d4c0f4'; ctx.lineWidth = 2.2;
    for (let i = 0; i < BELLS.length; i++) {
      const bx = BELLS[i][0], by = BELLS[i][1];
      if (bx < vx0 - 260 || bx > vx1 + 260 || by < vy0 - 200 || by > vy1 + 200) continue;
      const lt = (t + i * 1.9) % 7;
      if (lt > 3.2) continue;
      for (let k = 0; k < 3; k++) {
        const ph = (lt - k * .45) / 2.2;
        if (ph <= 0 || ph >= 1) continue;
        const r = 16 + ph * 200;
        ctx.globalAlpha = (1 - ph) * .55;
        ctx.beginPath(); ctx.ellipse(bx, by, r, r * .55, 0, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawMinimap(ctx) {
    if (!ready) build();
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, SIZE, SIZE); ctx.clip();
    ctx.fillStyle = EARTH; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#7a8078'; for (const s of STREETS) ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#8f948c'; ctx.fillRect(ROAD.x, ROAD.y, ROAD.w, ROAD.h); ctx.fillRect(PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h);
    ctx.fillStyle = '#5f7f62'; ctx.fillRect(1100, 2700, 420, 380); ctx.fillRect(2120, 2700, 420, 380);
    ctx.fillStyle = '#2f4a44'; ctx.beginPath(); ctx.ellipse(2340, 1300, 180, 170, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#25352a'; ctx.fill(A.TOP);
    ctx.fillStyle = '#5b625c'; ctx.fill(A.NFACE);
    for (const f of foots) {
      if (f.solid) continue;
      if (f.x === LM.x && f.y === LM.y) continue;
      ctx.fillStyle = f.roof; ctx.fillRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40);
      ctx.strokeStyle = '#2a2620'; ctx.lineWidth = 14; ctx.strokeRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40);
    }
    ctx.fillStyle = '#7b4fa0'; ctx.fillRect(LM.x, LM.y, LW, LH);
    ctx.strokeStyle = '#e6cf96'; ctx.lineWidth = 36; ctx.strokeRect(LM.x + 18, LM.y + 18, LW - 36, LH - 36);
    ctx.strokeStyle = '#2a1a3a'; ctx.lineWidth = 12; ctx.strokeRect(LM.x, LM.y, LW, LH);
    ctx.restore();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  const mod = window.ShinobiVillages.oto = {
    id: 'oto', name: 'LÀNG ÂM THANH', jp: '音隠れの里', kage: 'OROCHIMARU',
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
