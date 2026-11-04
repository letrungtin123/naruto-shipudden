/* village-kusa.js — Kusagakure no Sato (Hidden Grass Village, Land of Grass).
   Registers window.ShinobiVillages.kusa. Procedural Canvas 2D in the same 3/4 oblique, cel-shaded style as
   village-suna.js / village-kiri.js (light from the top-left, dark outlines, cached sprites). No external images.
   A pastoral village swallowed by nature: thatched minka, raised granaries, a watermill on a stream,
   the leader's great thatched hall beside a huge sacred tree, inside a bamboo thicket and wooden palisade. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, NC = 7, SIZE = BLOCK * NC;   // 3640
  const WIN = 400, WOUT = SIZE - 400;             // inner edges of the boundary hedge (wall footprints are 400 thick)
  const RX0 = 1720, RX1 = 1920;                   // the road through the south gate
  const OUT = '#3b2a22';
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const SM = 46, OVER = 172, BM = 30;             // building canvas margins: sides / above the footprint / below
  const SPAWN = { x: 1820, y: 3070 };
  const PLAZA = { x: 1820, y: 1726, rx: 300, ry: 196 };
  const HALL = { x: 1600, y: 1062, w: 440, h: 398 };
  const TREE = { x: 2250, y: 1334, w: 180, h: 138 };      // sacred tree trunk footprint (solid)
  const TREE_A = { x: 2340, y: 1468 };
  const POND = { x: 2345, y: 2345, rx: 196, ry: 120 };
  const SH = 'rgba(28,50,18,.30)';

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
  function tone(base) { return { base, light: mix(base, '#fff2cc', .3), hi: mix(base, '#fffbe6', .58), dark: mix(base, '#4a300e', .3), deep: mix(base, '#2a1a08', .55) }; }
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
  function softPath(pts, r) {
    const p = new Path2D(), n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = mid(pts[n - 1], pts[0]); p.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const a = pts[i], m = mid(a, pts[(i + 1) % n]); p.arcTo(a[0], a[1], m[0], m[1], r); }
    p.closePath(); return p;
  }
  function txt(c, s, x, y, size, col, o = {}) {
    c.font = `${o.weight || '700'} ${size}px ${o.font || MINCHO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 3; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function txtV(c, s, x, y, size, col, o) { [...s].forEach((ch, i) => txt(c, ch, x, y + size * .55 + i * size * 1.04, size, col, o)); }
  function celFill(c, path, base, light, dark, o = {}) {
    const ld = o.ld ?? 6, dd = o.dd ?? 8, big = () => { const p = new Path2D(); p.rect(-1e5, -1e5, 2e5, 2e5); return p; };
    c.save();
    c.fillStyle = base; c.fill(path);
    c.clip(path);
    if (light) { const p = big(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, ld, ld])); c.fillStyle = light; c.fill(p, 'evenodd'); }
    if (dark) { const p = big(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, -dd, -dd])); c.fillStyle = dark; c.fill(p, 'evenodd'); }
    c.restore();
  }
  // rim shading only (no base fill): colour the part of `path` not covered by itself shifted by (dx,dy)
  function shade(c, path, col, dx, dy) {
    const p = new Path2D(); p.rect(-1e5, -1e5, 2e5, 2e5); p.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy]));
    c.save(); c.clip(path); c.fillStyle = col; c.fill(p, 'evenodd'); c.restore();
  }
  function sprite(w, h, ax, ay, fn) { const cv = mk(w, h), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; fn(c, ax, ay); return { cv, ax, ay }; }
  function quadPt(x1, y1, cx, cy, x2, y2, t) { const m = 1 - t; return [m * m * x1 + 2 * m * t * cx + t * t * x2, m * m * y1 + 2 * m * t * cy + t * t * y2]; }
  function wrapDraw(S, x, y, m, fn) { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { const X = x + ox, Y = y + oy; if (X < -m || X > S + m || Y < -m || Y > S + m) continue; fn(X, Y); } }
  function shadowEl(c, x, y, rx, ry) { fell(c, x, y, rx, ry, SH); }

  // ------------------------------------------------------------------ palettes
  const WOOD = tone('#7a5232'), WOODL = tone('#9a6e44'), WOODR = tone('#6e3a26');
  const LEAF = { out: '#1d3316', dark: '#30552a', mid: '#467c33', light: '#64a043', hi: '#9acb62' };
  const LEAF2 = { out: '#1e3418', dark: '#3b6330', mid: '#5a913a', light: '#7db84c', hi: '#b8de7a' };
  const LEAF3 = { out: '#22341a', dark: '#4f6a2a', mid: '#738f36', light: '#9cb64a', hi: '#d0dc7a' };
  const BLOSSOM = { out: '#5e3444', dark: '#c98ca2', mid: '#e7b2c4', light: '#f6d4de', hi: '#fff3f6' };
  const STRAWS = ['#c9a250', '#b8914e', '#d4b468', '#a9915f', '#c29a54', '#bda46c'].map(tone);
  const PLASTER = ['#dac79c', '#cdb287', '#e4d5b2', '#c8b590'];
  const WOODS = [tone('#7a5232'), tone('#6a4a30'), tone('#8a5e38')];
  const NOREN = ['#2f4f7a', '#3c6b3a', '#a8742a', '#7a2e2e', '#e6dcc0', '#4a5f2a'];
  const FLOWER = ['#f6f2e6', '#f2d24a', '#f0a0b8', '#9a7ad0', '#f09a3a', '#e8e0ff'];

  // ------------------------------------------------------------------ the Kusa crest: three blades of grass from one root
  function kusaMark(c, x, y, s, col, o = {}) {
    const blade = (bx, by, tx, ty, qx, qy, w) => { const p = new Path2D(); p.moveTo(bx - w, by); p.quadraticCurveTo(qx - w, qy, tx, ty); p.quadraticCurveTo(qx + w, qy, bx + w, by); p.closePath(); return p; };
    const ps = [
      blade(x, y + s, x + s * .05, y - s, x + s * .1, y, s * .17),
      blade(x - s * .08, y + s, x - s * .86, y - s * .46, x - s * .5, y + s * .38, s * .15),
      blade(x + s * .08, y + s, x + s * .86, y - s * .46, x + s * .5, y + s * .38, s * .15)
    ];
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 2; for (const p of ps) c.stroke(p); }
    c.fillStyle = col; for (const p of ps) c.fill(p);
    if (o.bar) { c.fillStyle = col; c.fillRect(x - s * .55, y + s * .98, s * 1.1, s * .16); }
    if (o.ring) { c.beginPath(); c.arc(x, y + s * .08, s * 1.32, 0, TAU); sk(c, o.ring, o.rw || 2); }
  }

  // ------------------------------------------------------------------ thatch kit
  function thatchFace(c, path, box, T, o = {}) {
    const R = rng(o.seed || 7), { x, y, w, h } = box;
    const [ux0, uy0] = o.u || [0, 1], ul = Math.hypot(ux0, uy0) || 1, ux = ux0 / ul, uy = uy0 / ul;
    c.save(); c.fillStyle = o.col || T.base; c.fill(path); c.clip(path);
    // straw strands in three tones
    const pD = new Path2D(), pL = new Path2D(), pH = new Path2D();
    const n = Math.min(9000, Math.floor(w * h / (o.dens || 15)));
    for (let i = 0; i < n; i++) {
      const px = x + R() * w, py = y + R() * h, len = 5 + R() * 9, k = R();
      const p = k < .5 ? pD : k < .88 ? pL : pH;
      p.moveTo(px, py); p.lineTo(px + ux * len + (R() - .5) * 1.4, py + uy * len + (R() - .5) * 1.4);
    }
    c.lineCap = 'round';
    c.globalAlpha = .5; c.strokeStyle = mix(T.dark, '#3a2008', .2); c.lineWidth = 1.3; c.stroke(pD);
    c.globalAlpha = .55; c.strokeStyle = T.light; c.lineWidth = 1.2; c.stroke(pL);
    c.globalAlpha = .7; c.strokeStyle = T.hi; c.lineWidth = 1; c.stroke(pH);
    c.globalAlpha = 1;
    // courses: stepped layers of thatch
    if (o.courses !== 'none') {
      const st = o.course || 24, p = new Path2D(), vert = o.courses === 'v';
      if (vert) for (let xx = x + st * .5; xx < x + w; xx += st) { for (let yy = y - 4; yy <= y + h + 10; yy += 10) { const xv = xx + Math.sin(yy * .07 + xx) * 2; yy === y - 4 ? p.moveTo(xv, yy) : p.lineTo(xv, yy); } }
      else for (let yy = y + st * .6; yy < y + h; yy += st) { for (let xx = x - 4; xx <= x + w + 10; xx += 10) { const yv = yy + Math.sin(xx * .07 + yy) * 2; xx === x - 4 ? p.moveTo(xx, yv) : p.lineTo(xx, yv); } }
      c.strokeStyle = 'rgba(70,40,10,.34)'; c.lineWidth = 3; c.stroke(p);
      c.save(); c.translate(vert ? (ux < 0 ? -3 : 3) : 0, vert ? 0 : -3); c.strokeStyle = 'rgba(255,240,190,.3)'; c.lineWidth = 1.6; c.stroke(p); c.restore();
    }
    shade(c, path, 'rgba(255,244,205,.30)', 7, 7);
    shade(c, path, 'rgba(60,32,8,.26)', -8, -8);
    c.restore();
    if (!o.noOutline) { c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(path); }
  }
  function moss(c, path, box, n, seed) {
    if (!n) return;
    const R = rng(seed);
    c.save(); c.clip(path);
    for (let i = 0; i < n; i++) {
      const x = box.x + R() * box.w, y = box.y + box.h * (.12 + R() * .82), r = 5 + R() * 11;
      for (let k = 0; k < 7; k++) {
        const dx = (R() - .5) * r * 1.8, dy = (R() - .5) * r * .5, rr = r * (.22 + R() * .3);
        fell(c, x + dx + .8, y + dy + 1.6, rr, rr * .55, 'rgba(40,52,18,.45)');
        fell(c, x + dx, y + dy, rr, rr * .55, k % 3 ? 'rgba(92,120,46,.92)' : 'rgba(106,134,52,.92)');
        if (k % 2) fell(c, x + dx - rr * .25, y + dy - rr * .22, rr * .45, rr * .25, 'rgba(150,176,84,.8)');
      }
    }
    c.restore();
  }
  // the cut ends of the thatch along the front eave (thick, slightly drooping)
  function eaveBand(c, x0, x1, y, th, T, sag = 5) {
    const mx = (x0 + x1) / 2, p = new Path2D();
    p.moveTo(x0, y - th); p.quadraticCurveTo(mx, y - th + sag, x1, y - th);
    p.quadraticCurveTo(x1 + 5, y - th / 2, x1 - 2, y); p.quadraticCurveTo(mx, y + sag, x0 + 2, y); p.quadraticCurveTo(x0 - 5, y - th / 2, x0, y - th); p.closePath();
    c.save(); c.fillStyle = T.dark; c.fill(p); c.clip(p);
    const R = rng(Math.round(x0 * 7 + y));
    c.lineCap = 'butt';
    for (let xx = x0 - 2; xx < x1 + 2; xx += 2.2) {
      const t = (xx - mx) / ((x1 - x0) / 2), yy = y + sag * (1 - t * t);
      c.strokeStyle = R() < .45 ? T.deep : R() < .7 ? T.base : T.light; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(xx, yy - th - 2 + R() * 3); c.lineTo(xx + (R() - .5), yy + 1); c.stroke();
    }
    c.beginPath(); c.moveTo(x0, y - 2); c.quadraticCurveTo(mx, y + sag - 2, x1, y - 2); sk(c, T.hi, 2.2);
    c.beginPath(); c.moveTo(x0, y - th + 2); c.quadraticCurveTo(mx, y - th + sag + 2, x1, y - th + 2); sk(c, 'rgba(40,22,6,.45)', 2.5);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(p);
  }
  function ridgeCap(c, a, b, y, T, o = {}) {
    const p = softPath([[a, y - 13], [b, y - 13], [b + 5, y + 9], [a - 5, y + 9]], 8);
    const R = rng((o.seed || 1) * 31 + 5);
    if (o.sod) {
      celFill(c, p, '#5d8a36', '#86b04e', '#426626', { ld: 3, dd: 4 });
      c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(p);
      for (let x = a + 2; x < b - 1; x += 3 + R() * 3) line(c, x, y - 11, x + (R() - .5) * 6, y - 18 - R() * 9, R() < .5 ? '#4a7a2a' : '#7fae4a', 1.5);
      for (let x = a + 10; x < b - 6; x += 16 + R() * 12) { // irises on the grass ridge (shibamune)
        line(c, x, y - 11, x + 1, y - 27, '#3d6a2a', 1.6); line(c, x - 2, y - 11, x - 6, y - 22, '#4f8a34', 1.4);
        fell(c, x - 3, y - 28, 3.4, 2.2, '#5f44a8'); fell(c, x + 4, y - 28, 3.4, 2.2, '#5f44a8'); fell(c, x + .5, y - 31.5, 2.4, 3.2, '#8a6cd8'); fell(c, x + .5, y - 28, 1.3, 1.1, '#f2d24a');
      }
    } else {
      celFill(c, p, T.deep, T.dark, mix(T.deep, '#000000', .3), { ld: 3, dd: 4 });
      c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(p);
      for (let x = a + 10; x < b - 6; x += 20) { frect(c, x, y - 13, 5, 22, '#b2a86a'); frect(c, x + 3.5, y - 13, 1.5, 22, 'rgba(0,0,0,.25)'); }
    }
    // umanori: crossed sticks straddling the ridge
    const xs = [];
    if (o.sod) xs.push(a + 6, b - 6); else { const n = Math.max(2, Math.round((b - a) / 34)); for (let i = 0; i <= n; i++) xs.push(a + 6 + (b - a - 12) * i / n); }
    for (const x of xs) {
      line(c, x + 9, y - 27, x - 7, y + 5, OUT, 5.4); line(c, x + 9, y - 27, x - 7, y + 5, WOOD.base, 3.2);
      line(c, x - 9, y - 27, x + 7, y + 5, OUT, 5.4); line(c, x - 9, y - 27, x + 7, y + 5, WOODL.base, 3.2);
    }
    // end bundles
    for (const x of [a - 2, b + 2]) { fell(c, x, y - 1, 9, 11, T.deep); c.beginPath(); c.ellipse(x, y - 1, 9, 11, 0, 0, TAU); sk(c, OUT, 1.6); fell(c, x - 2, y - 4, 4, 5, T.dark); }
  }
  // hipped thatch roof (yosemune) in 3/4 view: ridge on top, two hip triangles, big front slope, thick eave
  function hipRoof(c, o) {
    const { x0, x1, yr, yb, ye, hip, T } = o, th = o.th || 16, ey = ye - th, rl = x0 + hip, rr = x1 - hip;
    const sil = softPath([[x0, yb], [rl, yr], [rr, yr], [x1, yb], [x1 + 2, ey + 2], [x0 - 2, ey + 2]], 14);
    const box = { x: x0 - 4, y: yr - 4, w: x1 - x0 + 8, h: ey - yr + 10 };
    c.fillStyle = 'rgba(30,20,8,.18)'; c.save(); c.translate(6, 8); c.fill(sil); c.restore();
    thatchFace(c, sil, box, T, { seed: o.seed, u: [0, 1], courses: 'h', col: T.base, noOutline: true });
    c.save(); c.clip(sil);
    const L = pathFrom([[x0 - 40, yr - 40], [rl, yr - 40], [rl, yr], [x0 + 1, ey + 3], [x0 - 40, ey + 3]]);
    const Rr = pathFrom([[x1 + 40, yr - 40], [rr, yr - 40], [rr, yr], [x1 - 1, ey + 3], [x1 + 40, ey + 3]]);
    thatchFace(c, L, box, T, { seed: o.seed + 1, u: [-1, .5], courses: 'v', col: T.light, noOutline: true });
    thatchFace(c, Rr, box, T, { seed: o.seed + 2, u: [1, .5], courses: 'v', col: mix(T.base, T.dark, .55), noOutline: true });
    c.restore();
    line(c, rl, yr, x0 + 2, ey + 1, T.deep, 3.2); line(c, rl + 3, yr + 3, x0 + 7, ey + 1, 'rgba(255,240,190,.4)', 1.6);
    line(c, rr, yr, x1 - 2, ey + 1, T.deep, 3.2); line(c, rr - 3, yr + 4, x1 - 6, ey + 1, 'rgba(255,240,190,.22)', 1.4);
    moss(c, sil, box, o.moss, (o.seed || 1) + 3);
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(sil);
    eaveBand(c, x0 - 4, x1 + 4, ye, th, T);
    ridgeCap(c, rl - 8, rr + 8, yr, T, o);
  }
  // steep gassho-zukuri gable facing the viewer; o.face(c, apexY, xl, xr, ye) paints the gable wall
  function gasshoRoof(c, o) {
    const { cx, ay, hw, ye, D, T } = o, th = o.th || 16, L = cx - hw, R = cx + hw;
    const left = softPath([[cx, ay - D], [cx, ay], [L, ye], [L, ye - D]], 6);
    const right = softPath([[cx, ay - D], [R, ye - D], [R, ye], [cx, ay]], 6);
    const box = { x: L - 4, y: ay - D - 4, w: hw * 2 + 8, h: ye - ay + D + 8 };
    thatchFace(c, left, box, T, { seed: o.seed, u: [-hw, ye - ay], courses: 'v', col: T.light, course: 26 });
    thatchFace(c, right, box, T, { seed: (o.seed || 1) + 1, u: [hw, ye - ay], courses: 'v', col: mix(T.base, T.dark, .4), course: 26 });
    if (o.moss) { moss(c, left, box, Math.ceil(o.moss / 2), (o.seed || 1) + 5); moss(c, right, box, Math.ceil(o.moss / 2), (o.seed || 1) + 6); }
    // gable wall (recessed under the thatch)
    const ia = ay + th * 1.5, il = L + th + 4, ir = R - th - 4;
    if (o.face) o.face(c, ia, il, ir, ye);
    // the cut thickness of the thatch along the front V
    const band = pathFrom([[L - 5, ye + 3], [cx, ay - 7], [R + 5, ye + 3], [ir - 2, ye + 3], [cx, ia], [il + 2, ye + 3]]);
    c.save(); c.fillStyle = T.dark; c.fill(band); c.clip(band);
    const Rn = rng((o.seed || 1) + 9);
    c.lineCap = 'butt';
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      for (const s of [-1, 1]) {
        const ox = cx + s * (hw + 5) * t, oy = ay - 7 + (ye + 3 - ay + 7) * t, ix = cx + s * (cx - il - 2) * t, iy = ia + (ye + 3 - ia) * t;
        c.strokeStyle = Rn() < .45 ? T.deep : Rn() < .7 ? T.base : T.light; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(ox, oy); c.lineTo(ix, iy); c.stroke();
      }
    }
    c.beginPath(); c.moveTo(il + 2, ye + 3); c.lineTo(cx, ia); c.lineTo(ir - 2, ye + 3); sk(c, T.hi, 2);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(band);
    // ridge running straight back
    const rp = softPath([[cx - 15, ay - D - 8], [cx + 15, ay - D - 8], [cx + 13, ay + 4], [cx - 13, ay + 4]], 9);
    celFill(c, rp, T.deep, T.dark, mix(T.deep, '#000000', .3), { ld: 3, dd: 4 });
    c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(rp);
    for (const t of [.25, .55]) { frect(c, cx - 14, ay - D + D * t, 28, 5, '#b2a86a'); frect(c, cx - 14, ay - D + D * t + 4, 28, 1.5, 'rgba(0,0,0,.3)'); }
    line(c, cx - 7, ay - D - 2, cx - 6, ay - 2, 'rgba(255,240,190,.3)', 3);
    for (const yy of [ay - 8]) {
      line(c, cx - 15, yy - 14, cx + 13, yy + 2, OUT, 5.4); line(c, cx - 15, yy - 14, cx + 13, yy + 2, WOODL.base, 3.2);
      line(c, cx + 15, yy - 14, cx - 13, yy + 2, OUT, 5.4); line(c, cx + 15, yy - 14, cx - 13, yy + 2, WOOD.base, 3.2);
    }
  }
  function gableWall(c, ia, il, ir, ye, P, o = {}) {
    const cx = (il + ir) / 2, tri = pathFrom([[cx, ia], [ir, ye], [il, ye]]);
    c.save(); c.fillStyle = P.plaster; c.fill(tri); c.clip(tri);
    const W = P.wood;
    // timber frame
    const levels = o.levels || [ye - 58, ye - 108];
    frect(c, il, ye - 10, ir - il, 10, W.dark);
    for (const ly of levels) { frect(c, il, ly, ir - il, 7, W.dark); frect(c, il, ly, ir - il, 2, W.light); }
    for (const dx of [-.62, -.3, 0, .3, .62]) { const x = cx + dx * (ir - il) / 2; frect(c, x - 3.5, ia, 7, ye - ia, W.dark); frect(c, x - 3.5, ia, 2, ye - ia, W.light); }
    // windows on each attic floor
    const lw = levels[0];
    for (const dx of [-.46, .46]) shoji(c, cx + dx * (ir - il) / 2 - 18, lw + 12, 36, ye - lw - 26, W);
    if (levels[1] && levels[1] - ia > 30) koshi(c, cx - 15, levels[1] + 12, 30, lw - levels[1] - 20, W);
    shade(c, tri, 'rgba(255,246,220,.2)', 5, 5);
    c.fillStyle = 'rgba(40,24,8,.32)'; c.beginPath(); c.moveTo(cx, ia); c.lineTo(ir, ye); c.lineTo(ir - 16, ye); c.lineTo(cx, ia + 22); c.lineTo(il + 16, ye); c.lineTo(il, ye); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(tri);
  }

  // ------------------------------------------------------------------ wall kit
  function houseWall(c, x0, x1, yt, yb, P, o = {}) {
    const w = x1 - x0, fy = yb - 9, W = P.wood, R = rng((P.seed || 3) * 17 + x0);
    // stone footing
    frect(c, x0 - 5, fy, w + 10, 10, '#85806f');
    for (let x = x0 - 4; x < x1 + 4;) { const sw = 11 + R() * 14; rrect(c, x, fy + 1, Math.min(sw, x1 + 4 - x) - 1.5, 8, 3); c.fillStyle = R() < .5 ? '#aaa592' : '#9a9583'; c.fill(); x += sw; }
    frect(c, x0 - 5, fy, w + 10, 2, 'rgba(255,255,240,.35)'); srect(c, x0 - 5, fy, w + 10, 10, OUT, 1.3);
    // earthen plaster
    frect(c, x0, yt, w, fy - yt, P.plaster);
    c.save(); c.beginPath(); c.rect(x0, yt, w, fy - yt); c.clip();
    for (let i = 0; i < w * (fy - yt) / 200; i++) fell(c, x0 + R() * w, yt + R() * (fy - yt), 2 + R() * 5, 1.5 + R() * 3, R() < .5 ? 'rgba(255,248,225,.2)' : 'rgba(120,90,50,.11)');
    const kh = o.kh ?? Math.round((fy - yt) * .36);
    frect(c, x0, fy - kh, w, kh, W.base);
    c.strokeStyle = W.dark; c.lineWidth = 1; c.beginPath(); for (let x = x0 + 9; x < x1; x += 9) { c.moveTo(x, fy - kh + 4); c.lineTo(x, fy); } c.stroke();
    frect(c, x0, fy - kh, w, 4, W.light); frect(c, x0, fy - kh + 4, w, 2, W.deep);
    c.restore();
    // beam and posts
    frect(c, x0, yt + 16, w, 7, W.dark); frect(c, x0, yt + 16, w, 2, W.light);
    const bays = o.bays || Math.max(2, Math.round(w / 68)), bw = w / bays;
    for (let i = 0; i <= bays; i++) {
      const pw = i === 0 || i === bays ? 10 : 8, px = i === 0 ? x0 : i === bays ? x1 - pw : x0 + i * bw - pw / 2;
      frect(c, px, yt, pw, fy - yt, W.dark); frect(c, px, yt, 2.5, fy - yt, W.light); frect(c, px + pw - 2, yt, 2, fy - yt, W.deep);
    }
    c.fillStyle = 'rgba(255,246,220,.14)'; c.fillRect(x0, yt, 12, fy - yt);
    c.fillStyle = 'rgba(60,35,10,.16)'; c.fillRect(x1 - 18, yt, 18, fy - yt);
    c.fillStyle = 'rgba(40,24,8,.42)'; c.fillRect(x0, yt, w, 18);
    c.fillStyle = 'rgba(40,24,8,.18)'; c.fillRect(x0, yt + 18, w, 8);
    srect(c, x0, yt, w, fy - yt, OUT, 2);
    const wt = yt + 26, wb = fy - kh - 3;
    return { bays, bw, fy, wt, wb, bay: i => [x0 + i * bw + 7, x0 + (i + 1) * bw - 7] };
  }
  function shoji(c, x, y, w, h, W = WOOD) {
    if (w < 6 || h < 6) return;
    frect(c, x - 2, y - 2, w + 4, h + 4, W.dark);
    frect(c, x, y, w, h, '#efe5c6');
    frect(c, x, y, w, 3, 'rgba(120,90,50,.25)');
    c.strokeStyle = 'rgba(110,78,46,.6)'; c.lineWidth = 1; c.beginPath();
    for (let k = 1; k < 3; k++) { c.moveTo(x + w * k / 3, y); c.lineTo(x + w * k / 3, y + h); }
    for (let k = 1; k < 4; k++) { c.moveTo(x, y + h * k / 4); c.lineTo(x + w, y + h * k / 4); }
    c.stroke();
    line(c, x + w / 2, y, x + w / 2, y + h, W.dark, 2);
    srect(c, x - 2, y - 2, w + 4, h + 4, OUT, 1.2);
  }
  function koshi(c, x, y, w, h, W = WOOD) {
    if (w < 6 || h < 6) return;
    frect(c, x - 2, y - 2, w + 4, h + 4, W.dark);
    frect(c, x, y, w, h, '#2a1e14');
    c.strokeStyle = W.light; c.lineWidth = 2; c.beginPath();
    for (let xx = x + 3; xx < x + w - 1; xx += 5) { c.moveTo(xx, y); c.lineTo(xx, y + h); }
    c.stroke();
    frect(c, x, y + h * .5 - 1, w, 2, W.dark);
    srect(c, x - 2, y - 2, w + 4, h + 4, OUT, 1.2);
  }
  function amado(c, x, y, w, h, W = WOOD) {
    frect(c, x, y, w, h, W.light);
    c.strokeStyle = W.dark; c.lineWidth = 1.2; c.beginPath();
    for (let yy = y + 6; yy < y + h; yy += 6) { c.moveTo(x, yy); c.lineTo(x + w, yy); }
    for (let k = 1; k < 3; k++) { c.moveTo(x + w * k / 3, y); c.lineTo(x + w * k / 3, y + h); }
    c.stroke();
    srect(c, x, y, w, h, OUT, 1.2);
  }
  function doorway(c, x, y, w, h, P, o = {}) {
    frect(c, x, y, w, h, '#20160d');
    frect(c, x + 2, y + h - 12, w - 4, 10, 'rgba(140,96,50,.45)');
    fell(c, x + w * .35, y + h * .55, w * .2, h * .2, 'rgba(255,190,110,.10)');
    if (!o.open) { const dw = Math.round(w * .46); frect(c, x + w - dw, y, dw, h, P.wood.base); c.strokeStyle = P.wood.dark; c.lineWidth = 1; c.beginPath(); for (let xx = x + w - dw + 6; xx < x + w; xx += 6) { c.moveTo(xx, y); c.lineTo(xx, y + h); } c.stroke(); frect(c, x + w - dw, y + h * .45, dw, 3, P.wood.deep); srect(c, x + w - dw, y, dw, h, OUT, 1); }
    const n = o.panels || 2, nh = h * (o.nh || .46), gap = 2, sw = (w + 6 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const sx = x - 3 + i * (sw + gap);
      frect(c, sx, y, sw, nh, P.noren); frect(c, sx, y, 2, nh, 'rgba(255,255,255,.14)'); frect(c, sx + sw - 2.5, y, 2.5, nh, 'rgba(0,0,0,.22)');
      srect(c, sx, y, sw, nh, 'rgba(40,24,16,.7)', 1);
    }
    const tc = P.noren === '#e6dcc0' ? '#3c5a2a' : '#f2ead2';
    if (o.mark !== false) kusaMark(c, x + w / 2, y + nh * .5, Math.min(nh * .32, w * .2), tc);
    line(c, x - 6, y + 1, x + w + 6, y + 1, '#3a2a1a', 3);
    srect(c, x, y, w, h, OUT, 1.6);
    frect(c, x - 5, y + h, w + 10, 5, '#a29d8c'); srect(c, x - 5, y + h, w + 10, 5, OUT, 1);
  }
  function engawa(c, x, y, w, W = WOOD) {
    frect(c, x - 3, y, w + 6, 9, W.light);
    c.strokeStyle = 'rgba(80,50,25,.45)'; c.lineWidth = 1; c.beginPath(); for (let xx = x + 16; xx < x + w; xx += 16) { c.moveTo(xx, y); c.lineTo(xx, y + 9); } c.stroke();
    frect(c, x - 3, y, w + 6, 2, W.hi);
    frect(c, x - 3, y + 9, w + 6, 7, W.dark);
    for (let xx = x + 6; xx < x + w; xx += 40) frect(c, xx, y + 9, 6, 7, W.deep);
    srect(c, x - 3, y, w + 6, 16, OUT, 1.3);
    rrect(c, x + w * .5 - 14, y + 17, 28, 8, 4); c.fillStyle = '#a7a290'; c.fill(); sk(c, OUT, 1);
  }
  function chochin(c, x, y, s = 1, col = '#c8452e', label) {
    line(c, x, y - 15 * s, x, y - 8 * s, '#2e2620', 1.5);
    frect(c, x - 4 * s, y - 10 * s, 8 * s, 3 * s, '#2a221c');
    fell(c, x, y, 6.5 * s, 8.5 * s, col);
    c.save(); c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); c.clip();
    frect(c, x + 2 * s, y - 9 * s, 5 * s, 18 * s, 'rgba(70,10,20,.3)');
    frect(c, x - 6.5 * s, y - 9 * s, 2.6 * s, 18 * s, 'rgba(255,220,170,.4)');
    c.strokeStyle = 'rgba(70,20,10,.35)'; c.lineWidth = .8; c.beginPath();
    for (let k = -2; k <= 2; k++) { c.moveTo(x - 7 * s, y + k * 3.2 * s); c.lineTo(x + 7 * s, y + k * 3.2 * s); } c.stroke();
    if (label) txt(c, label, x, y, 7 * s, '#1d1210', { weight: '800' });
    c.restore();
    frect(c, x - 4 * s, y + 7 * s, 8 * s, 3 * s, '#2a221c');
    c.beginPath(); c.ellipse(x, y, 6.5 * s, 8.5 * s, 0, 0, TAU); sk(c, '#4a1712', 1.2);
  }

  // ------------------------------------------------------------------ small things around the houses
  function firewood(c, x, y, w, rows) {
    const R = rng(Math.round(x * 13 + y));
    frect(c, x - 2, y - 4, w + 4, 4, WOOD.dark);
    for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(w / 9); i++) {
      const cx = x + 5 + i * 9 + (r % 2) * 4.5, cy = y - 8 - r * 8.4;
      if (cx > x + w - 3) continue;
      fell(c, cx, cy, 4.8, 4.4, '#5e4028'); fell(c, cx, cy, 3.8, 3.4, R() < .5 ? '#d8b27a' : '#c99f68'); fell(c, cx - .6, cy - .6, 1.5, 1.3, '#ecd2a0');
      c.beginPath(); c.ellipse(cx, cy, 4.8, 4.4, 0, 0, TAU); sk(c, 'rgba(59,42,34,.8)', .8);
    }
    const top = y - 8 - rows * 8.4 - 2;
    fpoly(c, [x - 6, top + 4, x + w / 2, top - 8, x + w + 6, top + 4], STRAWS[1].base); poly(c, [x - 6, top + 4, x + w / 2, top - 8, x + w + 6, top + 4]); sk(c, OUT, 1.2);
  }
  function barrel(c, x, y, s = 1) {
    fell(c, x + 4 * s, y, 13 * s, 4 * s, SH);
    const p = new Path2D(); p.moveTo(x - 11 * s, y - 26 * s); p.quadraticCurveTo(x - 13.5 * s, y - 13 * s, x - 10 * s, y); p.lineTo(x + 10 * s, y); p.quadraticCurveTo(x + 13.5 * s, y - 13 * s, x + 11 * s, y - 26 * s); p.closePath();
    celFill(c, p, '#9a6c40', '#c08e58', '#704a2a', { ld: 3 * s, dd: 4 * s });
    c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(p);
    for (const yy of [7, 19]) line(c, x - 12 * s, y - yy * s, x + 12 * s, y - yy * s, '#4a3a2a', 2 * s);
    fell(c, x, y - 26 * s, 11 * s, 3.6 * s, '#5a3e24'); fell(c, x, y - 26 * s, 9 * s, 2.6 * s, '#3d6476'); fell(c, x - 3 * s, y - 27 * s, 3 * s, 1 * s, 'rgba(220,240,250,.6)');
    c.beginPath(); c.ellipse(x, y - 26 * s, 11 * s, 3.6 * s, 0, 0, TAU); sk(c, OUT, 1.1);
  }
  function tawara(c, x, y, s = 1) { // straw rice bale lying sideways
    const T = STRAWS[2];
    fell(c, x + 3, y, 18 * s, 4 * s, SH);
    const p = new Path2D(); rrectP(p, x - 16 * s, y - 18 * s, 32 * s, 17 * s, 8 * s);
    celFill(c, p, T.base, T.light, T.dark, { ld: 2, dd: 3 });
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(p);
    for (const dx of [-8, 0, 8]) line(c, x + dx * s, y - 18 * s, x + dx * s, y - 1, T.deep, 1.6);
    fell(c, x - 16 * s, y - 9.5 * s, 3.5 * s, 8 * s, T.dark); c.beginPath(); c.ellipse(x - 16 * s, y - 9.5 * s, 3.5 * s, 8 * s, 0, 0, TAU); sk(c, OUT, 1);
  }
  function rrectP(p, x, y, w, h, r) { p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); }
  function persimmons(c, x, y, n, len) {
    for (let i = 0; i < n; i++) {
      const sx = x + i * 10;
      line(c, sx, y, sx, y + len, '#5a4636', 1);
      for (let k = 0; k < len / 7; k++) { fell(c, sx, y + 5 + k * 7, 3.4, 3.1, '#d9702a'); fell(c, sx - 1, y + 4 + k * 7, 1.2, 1, '#f6b060'); }
    }
  }
  function cornHang(c, x, y) {
    line(c, x, y, x, y + 6, '#5a4636', 1.2);
    for (const [dx, a] of [[-6, -.25], [0, 0], [6, .25]]) {
      c.save(); c.translate(x + dx * .4, y + 6); c.rotate(a);
      fell(c, 0, 13, 4, 11, '#e6b83a'); fell(c, -1.2, 11, 1.6, 8, '#f6d870');
      c.beginPath(); c.ellipse(0, 13, 4, 11, 0, 0, TAU); sk(c, '#6a4a1a', .9);
      fpoly(c, [-3, 2, 0, -4, 3, 2], '#cdb98a');
      c.restore();
    }
  }
  function strawBundle(c, x, y, s = 1) {
    const T = STRAWS[0];
    fell(c, x + 4, y, 10 * s, 3 * s, SH);
    const p = pathFrom([[x - 8 * s, y], [x - 3 * s, y - 40 * s], [x + 3 * s, y - 40 * s], [x + 8 * s, y]]);
    celFill(c, p, T.base, T.light, T.dark, { ld: 2, dd: 3 });
    c.strokeStyle = T.deep; c.lineWidth = .8; c.beginPath(); for (let k = -6; k <= 6; k += 3) { c.moveTo(x + k * s, y); c.lineTo(x + k * .35 * s, y - 40 * s); } c.stroke();
    line(c, x - 6 * s, y - 14 * s, x + 6 * s, y - 14 * s, '#6a4a22', 2);
    c.strokeStyle = OUT; c.lineWidth = 1.1; c.stroke(p);
  }
  function tuftDraw(c, ax, ay, s, lean, bright, seed, pal) {
    const R = rng(seed), n = 9 + Math.floor(R() * 5), bl = [];
    for (let i = 0; i < n; i++) bl.push({ dx: (R() - .5) * 20 * s, h: (22 + R() * 24) * s, w: (2 + R() * 1.6) * s, bend: (R() - .5) * 12 * s, k: R() });
    bl.sort((a, b) => a.k - b.k);
    fell(c, ax + 3, ay, 12 * s, 3.4 * s, 'rgba(28,50,18,.26)');
    const cols = pal || (bright ? ['#4f7f30', '#73a843', '#9ccf5a'] : ['#3d6a2a', '#568c38', '#78ae48']);
    for (const b of bl) {
      const bx = ax + b.dx * .45, tx = ax + b.dx * 1.3 + b.bend + lean * b.h * .5, ty = ay - b.h * (1 - Math.abs(lean) * .1);
      const mx = (bx + tx) / 2 + b.bend * .3 - lean * b.h * .1, my = (ay + ty) / 2;
      const p = new Path2D(); p.moveTo(bx - b.w, ay); p.quadraticCurveTo(mx - b.w * .5, my, tx, ty); p.quadraticCurveTo(mx + b.w * .5, my, bx + b.w, ay); p.closePath();
      c.fillStyle = cols[b.k < .33 ? 0 : b.k < .7 ? 1 : 2]; c.fill(p);
      c.strokeStyle = 'rgba(25,45,15,.55)'; c.lineWidth = .7; c.stroke(p);
      if (b.k > .5) { c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo((mx + tx) / 2 + 1, (my + ty) / 2, tx, ty); sk(c, bright ? 'rgba(230,248,170,.85)' : 'rgba(176,214,110,.55)', 1.1); }
    }
  }
  function flowerBunch(c, x, y, seed, n = 7, cols) {
    const R = rng(seed);
    for (let i = 0; i < n + 3; i++) { const dx = (R() - .5) * 26, dy = (R() - .5) * 8; fell(c, x + dx, y + dy, 4 + R() * 3, 2.4, R() < .5 ? '#3f6a2c' : '#55883a'); }
    for (let i = 0; i < n; i++) {
      const dx = (R() - .5) * 24, dy = (R() - .5) * 8 - 3, col = (cols || FLOWER)[Math.floor(R() * (cols || FLOWER).length)], r = 1.8 + R() * 1.2;
      line(c, x + dx, y + dy + 4, x + dx, y + dy, '#3f6a2c', 1);
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; fell(c, x + dx + Math.cos(a) * r, y + dy + Math.sin(a) * r * .8, r * .75, r * .65, col); }
      fell(c, x + dx, y + dy, r * .55, r * .5, col === '#f2d24a' ? '#c8701a' : '#f2c63a');
    }
  }
  function bucket(c, x, y) {
    fell(c, x + 3, y, 9, 3, SH);
    fpoly(c, [x - 8, y - 16, x + 8, y - 16, x + 6, y, x - 6, y], '#a8784a'); frect(c, x - 8, y - 16, 4, 16, 'rgba(255,240,200,.25)');
    line(c, x - 7, y - 5, x + 7, y - 5, '#4a3a2a', 1.6); line(c, x - 8, y - 12, x + 8, y - 12, '#4a3a2a', 1.6);
    fell(c, x, y - 16, 8, 2.6, '#5a3e24'); poly(c, [x - 8, y - 16, x + 8, y - 16, x + 6, y, x - 6, y]); sk(c, OUT, 1.1);
    c.beginPath(); c.arc(x, y - 18, 7, Math.PI, 0); sk(c, '#5a4030', 1.3);
  }
  function basket(c, x, y) {
    fell(c, x + 3, y, 11, 3, SH);
    const p = new Path2D(); p.moveTo(x - 11, y - 12); p.quadraticCurveTo(x - 10, y, x, y); p.quadraticCurveTo(x + 10, y, x + 11, y - 12); p.closePath();
    celFill(c, p, '#b89a5a', '#d8bc7a', '#8a7040', { ld: 2, dd: 3 });
    c.strokeStyle = 'rgba(90,60,25,.6)'; c.lineWidth = .9; c.beginPath(); for (let k = -8; k <= 8; k += 4) { c.moveTo(x + k, y - 12); c.lineTo(x + k * .8, y - 1); } c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.1; c.stroke(p);
    fell(c, x, y - 12, 11, 3, '#6a5028'); fell(c, x - 3, y - 13, 4, 2, '#7ab040'); fell(c, x + 4, y - 13, 4, 2, '#d0562a');
  }

  // ------------------------------------------------------------------ house variants (footprint-local coords)
  function vMinka(c, P) {
    shadowEl(c, 184, 304, 182, 30);
    const w = houseWall(c, 26, 314, 186, 306, P, { bays: 5 });
    let [a, b] = w.bay(0); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(1); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(2); doorway(c, a - 2, w.wt - 4, b - a + 4, w.fy - w.wt + 4, P);
    [a, b] = w.bay(3); koshi(c, a + 2, w.wt + 4, b - a - 4, w.wb - w.wt - 8, P.wood);
    [a, b] = w.bay(4); amado(c, a - 3, w.wt - 6, b - a + 6, w.fy - w.wt + 2, P.wood);
    engawa(c, 30, 276, 108, P.wood);
    hipRoof(c, { x0: 4, x1: 336, yr: -6, yb: 66, ye: 196, hip: 94, th: 18, T: P.T, seed: P.seed, moss: P.moss, sod: P.sod });
    persimmons(c, 208, 197, 4, 30);
    firewood(c, 262, 300, 48, 4);
    barrel(c, 326, 316, .9); bucket(c, 14, 314);
    tuftDraw(c, 6, 316, .9, -.1, false, P.seed + 1); tuftDraw(c, 338, 306, .8, .1, false, P.seed + 2);
    flowerBunch(c, 90, 316, P.seed + 3); flowerBunch(c, 240, 318, P.seed + 4, 5);
    chochin(c, 146, 218, 1.1, '#d0502e'); P.lamps.push([146, 222]);
    P.door = 170;
  }
  function vGassho(c, P) {
    shadowEl(c, 172, 304, 170, 30);
    const w = houseWall(c, 22, 298, 194, 306, P, { bays: 4 });
    let [a, b] = w.bay(0); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(1); doorway(c, a - 2, w.wt - 4, b - a + 4, w.fy - w.wt + 4, P, { panels: 3 });
    [a, b] = w.bay(2); koshi(c, a + 2, w.wt + 4, b - a - 4, w.wb - w.wt - 8, P.wood);
    [a, b] = w.bay(3); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    gasshoRoof(c, { cx: 160, ay: 40, hw: 162, ye: 198, D: 150, th: 18, T: P.T, seed: P.seed, moss: P.moss, face: (cc, ia, il, ir, ye) => gableWall(cc, ia, il, ir, ye, P) });
    cornHang(c, 40, 200); cornHang(c, 56, 200);
    strawBundle(c, 304, 312, .9); strawBundle(c, 316, 314, .8);
    basket(c, 250, 318); tuftDraw(c, 8, 314, 1, 0, false, P.seed + 7); flowerBunch(c, 200, 318, P.seed + 8, 6);
    chochin(c, 98, 222, 1.1, '#d0502e'); P.lamps.push([98, 226]);
    P.door = 125;
  }
  function vKabuto(c, P) {
    shadowEl(c, 184, 304, 182, 30);
    const w = houseWall(c, 24, 316, 190, 306, P, { bays: 5 });
    let [a, b] = w.bay(0); amado(c, a - 3, w.wt - 6, b - a + 6, w.fy - w.wt + 2, P.wood);
    [a, b] = w.bay(1); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(2); doorway(c, a - 4, w.wt - 4, b - a + 8, w.fy - w.wt + 4, P, { panels: 3, open: true });
    [a, b] = w.bay(3); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(4); koshi(c, a + 2, w.wt + 4, b - a - 4, w.wb - w.wt - 8, P.wood);
    engawa(c, 196, 280, 116, P.wood);
    hipRoof(c, { x0: 4, x1: 336, yr: -10, yb: 62, ye: 200, hip: 86, th: 18, T: P.T, seed: P.seed, moss: P.moss, sod: P.sod });
    // kabuto notch: the upper front of the hip is cut vertical for the silkworm attic
    const kx0 = 118, kx1 = 222, ky0 = 10, ky1 = 70;
    frect(c, kx0, ky0, kx1 - kx0, ky1 - ky0, P.wood.dark);
    shoji(c, kx0 + 8, ky0 + 10, 40, ky1 - ky0 - 18, P.wood); shoji(c, kx1 - 48, ky0 + 10, 40, ky1 - ky0 - 18, P.wood);
    frect(c, kx0, ky1 - 6, kx1 - kx0, 6, P.wood.deep);
    srect(c, kx0, ky0, kx1 - kx0, ky1 - ky0, OUT, 1.6);
    const ap = pathFrom([[kx0 - 8, ky1], [kx1 + 8, ky1], [kx1 + 18, ky1 + 16], [kx0 - 18, ky1 + 16]]);
    thatchFace(c, ap, { x: kx0 - 20, y: ky1, w: kx1 - kx0 + 40, h: 16 }, P.T, { seed: P.seed + 11, courses: 'none' });
    eaveBand(c, kx0 - 12, kx1 + 12, ky0 + 6, 12, P.T, 3);
    ridgeCap(c, kx0 - 4, kx1 + 4, ky0 - 6, P.T, { seed: P.seed, sod: P.sod });
    tawara(c, 30, 314); tawara(c, 50, 316, .9); tawara(c, 40, 300, .9);
    tuftDraw(c, 334, 312, 1, .1, false, P.seed + 12); flowerBunch(c, 120, 318, P.seed + 13, 7);
    chochin(c, 140, 224, 1.1, '#d0502e'); P.lamps.push([140, 228]);
    P.door = 170;
  }
  function vGranary(c, P) {
    const T2 = STRAWS[(P.si + 2) % STRAWS.length];
    shadowEl(c, 120, 290, 112, 22); shadowEl(c, 286, 292, 70, 18);
    // little farmhouse on the left
    const w = houseWall(c, 14, 196, 186, 290, P, { bays: 3 });
    let [a, b] = w.bay(0); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(1); doorway(c, a - 2, w.wt - 4, b - a + 4, w.fy - w.wt + 4, P);
    [a, b] = w.bay(2); koshi(c, a + 2, w.wt + 4, b - a - 4, w.wb - w.wt - 8, P.wood);
    hipRoof(c, { x0: -4, x1: 210, yr: 44, yb: 100, ye: 192, hip: 62, th: 16, T: P.T, seed: P.seed, moss: P.moss, sod: P.sod });
    // raised granary (takakura) on stilts with rat guards
    const st = [222, 270, 318];
    for (const x of st) { line(c, x, 150, x, 262, OUT, 7); line(c, x, 150, x, 262, P.wood.dark, 5); fell(c, x, 176, 12, 4, '#8a6a44'); c.beginPath(); c.ellipse(x, 176, 12, 4, 0, 0, TAU); sk(c, OUT, 1.2); }
    tawara(c, 246, 286); tawara(c, 294, 288); tawara(c, 270, 274, .9);
    for (const x of st) { line(c, x, 176, x, 292, OUT, 8); line(c, x, 176, x, 292, P.wood.base, 6); line(c, x - 1.5, 176, x - 1.5, 292, P.wood.light, 1.6); fell(c, x, 208, 14, 5, '#9a7a50'); fell(c, x, 207, 12, 3.6, '#b89668'); c.beginPath(); c.ellipse(x, 208, 14, 5, 0, 0, TAU); sk(c, OUT, 1.2); }
    frect(c, 208, 168, 126, 12, P.wood.dark); frect(c, 208, 168, 126, 3, P.wood.light); srect(c, 208, 168, 126, 12, OUT, 1.4);
    frect(c, 214, 106, 114, 62, P.wood.base);
    c.strokeStyle = P.wood.dark; c.lineWidth = 1.2; c.beginPath(); for (let yy = 114; yy < 168; yy += 8) { c.moveTo(214, yy); c.lineTo(328, yy); } c.stroke();
    frect(c, 214, 106, 6, 62, P.wood.light); frect(c, 320, 106, 8, 62, 'rgba(50,30,10,.25)');
    frect(c, 254, 124, 32, 40, P.wood.dark); frect(c, 257, 127, 26, 34, '#3a2818'); line(c, 270, 127, 270, 161, P.wood.base, 2);
    srect(c, 214, 106, 114, 62, OUT, 1.6);
    hipRoof(c, { x0: 202, x1: 342, yr: -34, yb: 8, ye: 116, hip: 44, th: 14, T: T2, seed: P.seed + 20, moss: Math.ceil(P.moss / 2) });
    // ladder
    for (const dx of [-7, 7]) { line(c, 246 + dx, 294, 256 + dx, 176, OUT, 4.4); line(c, 246 + dx, 294, 256 + dx, 176, P.wood.light, 2.4); }
    for (let yy = 184; yy < 290; yy += 12) { const t = (yy - 176) / 118; line(c, 249 - 7 - t * 0, yy, 263 - t * 10, yy, P.wood.base, 2.4); }
    basket(c, 160, 306); barrel(c, 334, 302, .8);
    tuftDraw(c, 6, 300, .9, 0, false, P.seed + 21); tuftDraw(c, 212, 298, .8, 0, false, P.seed + 22);
    chochin(c, 88, 218, 1, '#d0502e'); P.lamps.push([88, 222]);
    P.door = 105;
  }
  function vNagaya(c, P) {
    shadowEl(c, 190, 306, 182, 28);
    // open lean-to shed on the right (drawn first, tucked under the main roof)
    frect(c, 232, 206, 112, 94, '#2a1f15');
    const hay = new Path2D(); hay.moveTo(240, 300); hay.quadraticCurveTo(262, 236, 300, 248); hay.quadraticCurveTo(330, 254, 336, 300); hay.closePath();
    thatchFace(c, hay, { x: 236, y: 236, w: 104, h: 66 }, STRAWS[2], { seed: P.seed + 30, courses: 'none', u: [.2, 1] });
    line(c, 252, 300, 278, 214, '#6a4a2c', 3); line(c, 274, 212, 286, 210, '#8a8a90', 4); // hoe
    for (const x of [234, 290, 340]) { line(c, x, 206, x, 302, OUT, 7); line(c, x, 206, x, 302, P.wood.base, 5); line(c, x - 1.5, 206, x - 1.5, 302, P.wood.light, 1.4); }
    const sr = pathFrom([[226, 146], [348, 146], [356, 210], [222, 210]]);
    thatchFace(c, sr, { x: 220, y: 144, w: 140, h: 70 }, P.T, { seed: P.seed + 31, course: 20 });
    moss(c, sr, { x: 220, y: 144, w: 140, h: 70 }, Math.ceil(P.moss / 3), P.seed + 32);
    eaveBand(c, 220, 358, 214, 13, P.T, 3);
    // main house
    const w = houseWall(c, 16, 236, 190, 306, P, { bays: 4 });
    let [a, b] = w.bay(0); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(1); doorway(c, a - 2, w.wt - 4, b - a + 4, w.fy - w.wt + 4, P);
    [a, b] = w.bay(2); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(3); koshi(c, a + 2, w.wt + 4, b - a - 4, w.wb - w.wt - 8, P.wood);
    hipRoof(c, { x0: -2, x1: 254, yr: -4, yb: 64, ye: 194, hip: 72, th: 18, T: P.T, seed: P.seed, moss: P.moss, sod: P.sod });
    persimmons(c, 150, 195, 3, 26);
    tawara(c, 300, 318); tawara(c, 326, 320, .9);
    bucket(c, 8, 316); tuftDraw(c, 344, 312, .9, 0, false, P.seed + 33); flowerBunch(c, 180, 318, P.seed + 34, 6);
    chochin(c, 76, 222, 1.05, '#d0502e'); P.lamps.push([76, 226]);
    P.door = 98;
  }
  function vGarden(c, P) {
    shadowEl(c, 128, 250, 120, 22);
    const w = houseWall(c, 22, 214, 166, 252, P, { bays: 3 });
    let [a, b] = w.bay(0); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    [a, b] = w.bay(1); doorway(c, a - 2, w.wt - 4, b - a + 4, w.fy - w.wt + 4, P);
    [a, b] = w.bay(2); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    gasshoRoof(c, { cx: 118, ay: 38, hw: 116, ye: 170, D: 116, th: 16, T: P.T, seed: P.seed, moss: P.moss, face: (cc, ia, il, ir, ye) => gableWall(cc, ia, il, ir, ye, P, { levels: [ye - 50] }) });
    // persimmon tree and rain barrel on the right
    shadowEl(c, 296, 250, 44, 12);
    broadleaf(c, 290, 248, .62, P.seed + 40, LEAF2, '#e0782a');
    barrel(c, 236, 252, .9);
    // kitchen garden in front with a low bamboo fence
    frect(c, 6, 258, 328, 44, '#6e5034');
    for (let r = 0; r < 4; r++) {
      const yy = 264 + r * 10;
      frect(c, 8, yy, 324, 4, '#5a3e26'); frect(c, 8, yy + 4, 324, 2, '#8a6a46');
      for (let x = 14 + (r % 2) * 6; x < 330; x += 13) {
        if (r === 0) { fell(c, x, yy, 5, 3.4, '#5a9a3a'); fell(c, x - 1, yy - 1, 2.6, 1.6, '#9ad06a'); }
        else if (r === 1) { line(c, x, yy + 2, x - 2, yy - 8, '#4f8a34', 1.6); line(c, x, yy + 2, x + 2, yy - 9, '#6aa844', 1.6); }
        else if (r === 2) { fell(c, x, yy, 5.5, 3.6, '#4a8a36'); if (x % 3 < 1.5) fell(c, x + 2, yy + 1, 2.2, 2.6, '#6a3a8a'); }
        else { fell(c, x, yy, 4.5, 3, '#5c9440'); if (x % 2 < 1) fell(c, x - 1, yy - 1, 1.8, 1.8, '#d8402a'); }
      }
    }
    for (let x = 4; x <= 336; x += 24) { if (x > 106 && x < 132) continue; line(c, x, 316, x, 290, OUT, 4.4); line(c, x, 316, x, 290, '#b8a86a', 2.6); }
    for (const yy of [296, 306]) { line(c, 2, yy, 106, yy, OUT, 4); line(c, 2, yy, 106, yy, '#c8b878', 2.4); line(c, 132, yy, 338, yy, OUT, 4); line(c, 132, yy, 338, yy, '#c8b878', 2.4); }
    tuftDraw(c, 340, 318, .8, 0, false, P.seed + 41);
    chochin(c, 96, 196, 1, '#d0502e'); P.lamps.push([96, 200]);
    P.door = 118;
  }
  function waterWheel(c, cx, cy, r) {
    fell(c, cx + 10, cy + r + 4, r * .9, 10, 'rgba(20,40,40,.35)');
    const n = 12;
    for (let i = 0; i < n; i++) { // paddles
      const a = i / n * TAU + .13, x = cx + Math.cos(a) * (r + 3), y = cy + Math.sin(a) * (r + 3);
      c.save(); c.translate(x, y); c.rotate(a); frect(c, -6, -7, 13, 14, WOOD.dark); frect(c, -6, -7, 13, 3, WOOD.light); srect(c, -6, -7, 13, 14, OUT, 1); c.restore();
    }
    for (const rr of [r, r * .78]) { c.beginPath(); c.arc(cx, cy, rr, 0, TAU); sk(c, OUT, rr === r ? 10 : 8); c.beginPath(); c.arc(cx, cy, rr, 0, TAU); sk(c, WOOD.base, rr === r ? 7 : 5); c.beginPath(); c.arc(cx, cy, rr, Math.PI * .85, Math.PI * 1.6); sk(c, WOOD.light, 2); }
    for (let i = 0; i < n; i++) { const a = i / n * TAU + .13; line(c, cx + Math.cos(a) * r * .78, cy + Math.sin(a) * r * .78, cx + Math.cos(a) * r, cy + Math.sin(a) * r, WOOD.dark, 3); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; line(c, cx, cy, cx + Math.cos(a) * r * .78, cy + Math.sin(a) * r * .78, OUT, 5.5); line(c, cx, cy, cx + Math.cos(a) * r * .78, cy + Math.sin(a) * r * .78, WOODL.base, 3.4); }
    fell(c, cx, cy, r * .2, r * .2, WOOD.dark); fell(c, cx - 2, cy - 2, r * .1, r * .1, WOOD.light); c.beginPath(); c.arc(cx, cy, r * .2, 0, TAU); sk(c, OUT, 1.6);
    // water spilling over the right side of the wheel
    c.globalAlpha = .75;
    for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(cx, cy, r + 8 + k * 2, -Math.PI * .45, Math.PI * .45); sk(c, k % 2 ? '#9ad6ea' : '#5aa8c6', 2); }
    c.globalAlpha = 1;
  }
  function vMill(c, P) {
    shadowEl(c, 160, 298, 160, 24);
    // tail pool under the wheel
    fell(c, 290, 284, 54, 20, '#5b4a2c'); fell(c, 290, 284, 48, 16, '#3a7d9c'); fell(c, 284, 281, 34, 9, '#5ba6c2');
    for (const [x, y] of [[246, 288], [334, 288], [262, 300], [318, 300]]) { fell(c, x, y, 7, 4.5, '#8f8a7c'); fell(c, x - 1.5, y - 1.5, 3.5, 2, '#bdb8a8'); }
    // flume from the sluice in the stream down to the top of the wheel
    for (const yy of [-20, 50]) { for (const dx of [-12, 12]) { line(c, 290 + dx, yy, 290 + dx, yy + 120, OUT, 5.4); line(c, 290 + dx, yy, 290 + dx, yy + 120, P.wood.base, 3.4); } line(c, 276, yy + 70, 304, yy + 70, P.wood.dark, 3); }
    frect(c, 274, -96, 32, 30, P.wood.dark); frect(c, 278, -92, 24, 22, '#3a7d9c'); srect(c, 274, -96, 32, 30, OUT, 1.6);
    frect(c, 277, -70, 26, 196, P.wood.dark); frect(c, 281, -70, 18, 196, '#4a92b0');
    c.strokeStyle = 'rgba(200,236,246,.8)'; c.lineWidth = 1.4; c.beginPath(); for (let yy = -64; yy < 120; yy += 16) { c.moveTo(285, yy); c.lineTo(285, yy + 8); c.moveTo(294, yy + 7); c.lineTo(294, yy + 13); } c.stroke();
    frect(c, 277, -70, 3, 196, P.wood.light); srect(c, 277, -70, 26, 196, OUT, 1.6);
    // mill house
    const w = houseWall(c, 12, 234, 172, 296, P, { bays: 3 });
    let [a, b] = w.bay(0); koshi(c, a + 2, w.wt + 4, b - a - 4, w.wb - w.wt - 8, P.wood);
    [a, b] = w.bay(1); doorway(c, a - 4, w.wt - 4, b - a + 8, w.fy - w.wt + 4, P, { open: true, panels: 3 });
    [a, b] = w.bay(2); shoji(c, a, w.wt, b - a, w.wb - w.wt, P.wood);
    hipRoof(c, { x0: -6, x1: 250, yr: -12, yb: 52, ye: 176, hip: 72, th: 17, T: P.T, seed: P.seed, moss: P.moss, sod: P.sod });
    waterWheel(c, 290, 196, 62);
    // spout pouring onto the wheel
    c.globalAlpha = .85; for (let k = 0; k < 4; k++) line(c, 284 + k * 3, 126, 286 + k * 4, 140 + k * 2, k % 2 ? '#bfe6f2' : '#6ab4d0', 2.4); c.globalAlpha = 1;
    // millstone and flour sacks
    fell(c, 40, 304, 22, 7, SH);
    fell(c, 34, 286, 20, 20, '#9a9688'); fell(c, 34, 286, 6, 6, '#6a675c'); c.beginPath(); c.arc(34, 286, 20, 0, TAU); sk(c, OUT, 1.6); c.beginPath(); c.arc(34, 286, 20, Math.PI * .9, Math.PI * 1.5); sk(c, '#c8c4b4', 2);
    for (const [x, y] of [[200, 312], [218, 314], [209, 302]]) { const p = new Path2D(); rrectP(p, x - 9, y - 18, 18, 18, 6); celFill(c, p, '#e8e0cc', '#fffaf0', '#bcb29a', { ld: 2, dd: 3 }); c.strokeStyle = OUT; c.lineWidth = 1.1; c.stroke(p); line(c, x - 4, y - 18, x + 4, y - 18, '#8a7a5a', 2); }
    tuftDraw(c, 4, 312, .9, 0, false, P.seed + 51);
    chochin(c, 112, 204, 1.05, '#d0502e'); P.lamps.push([112, 208]);
    P.door = 122;
  }

  // ------------------------------------------------------------------ leader's hall (footprint 440x398)
  function lmHall(c, P) {
    const T = tone('#c6a25a'), W = WOODR;
    const HP = { ...P, wood: W, plaster: '#e8dab6', noren: '#3c6b3a' };
    // forecourt
    c.fillStyle = '#b4a888'; rrect(c, 10, 350, 420, 46, 10); c.fill();
    c.strokeStyle = 'rgba(90,80,60,.35)'; c.lineWidth = 1; c.beginPath(); for (let x = 30; x < 420; x += 28) { c.moveTo(x, 352); c.lineTo(x - 6, 394); } c.moveTo(14, 372); c.lineTo(426, 372); c.stroke();
    c.strokeStyle = 'rgba(80,70,50,.55)'; c.lineWidth = 1.5; rrect(c, 10, 350, 420, 46, 10); c.stroke();
    shadowEl(c, 236, 350, 230, 26);
    // stone platform
    frect(c, 16, 296, 408, 16, '#c4bda6'); frect(c, 16, 296, 408, 3, '#e2dcc6');
    frect(c, 16, 312, 408, 36, '#9d9682');
    const R = rng(77);
    for (let row = 0; row < 3; row++) for (let x = 16 + (row % 2) * 18; x < 424;) { const bw = 30 + R() * 22, bx = Math.min(x + bw, 424); frect(c, x + 1, 313 + row * 12, bx - x - 2, 10, R() < .5 ? '#aaa38e' : '#a09984'); frect(c, x + 1, 313 + row * 12, bx - x - 2, 2, 'rgba(255,255,240,.25)'); x = bx; }
    for (const [x, y] of [[40, 340], [120, 344], [356, 338], [400, 346]]) { fell(c, x, y, 10, 4, '#6e8a3a'); fell(c, x - 2, y - 1, 5, 2, '#93ad52'); }
    srect(c, 16, 296, 408, 52, OUT, 2);
    // steps
    for (let i = 0; i < 4; i++) { const sw = 116 + i * 14, y = 346 + i * 12; frect(c, 220 - sw / 2, y, sw, 12, i % 2 ? '#b8b19c' : '#c8c1aa'); frect(c, 220 - sw / 2, y, sw, 2, '#e6e0cc'); srect(c, 220 - sw / 2, y, sw, 12, OUT, 1.3); }
    // walls
    const w = houseWall(c, 44, 396, 214, 300, HP, { bays: 5, kh: 22 });
    for (const i of [0, 4]) { const [a, b] = w.bay(i); shoji(c, a, w.wt, (b - a) / 2 - 2, w.wb - w.wt, W); shoji(c, a + (b - a) / 2 + 2, w.wt, (b - a) / 2 - 2, w.wb - w.wt, W); }
    for (const i of [1, 3]) { const [a, b] = w.bay(i); koshi(c, a + 2, w.wt + 2, b - a - 4, w.wb - w.wt - 4, W); }
    { const [a, b] = w.bay(2); doorway(c, a - 6, w.wt - 6, b - a + 12, w.fy - w.wt + 6, HP, { open: true, panels: 3, nh: .5 }); }
    // veranda railing
    frect(c, 36, 280, 368, 12, W.light); frect(c, 36, 280, 368, 2, W.hi); frect(c, 36, 292, 368, 6, W.dark); srect(c, 36, 280, 368, 18, OUT, 1.4);
    for (const [x0, x1] of [[38, 170], [270, 402]]) {
      for (let x = x0; x <= x1; x += 22) { line(c, x, 262, x, 282, OUT, 5); line(c, x, 262, x, 282, W.base, 3); }
      line(c, x0 - 2, 262, x1 + 2, 262, OUT, 6); line(c, x0 - 2, 262, x1 + 2, 262, W.light, 4); line(c, x0, 272, x1, 272, W.dark, 2.4);
      for (const x of [x0, x1]) { fell(c, x, 258, 4.5, 4.5, '#c8a040'); c.beginPath(); c.arc(x, 258, 4.5, 0, TAU); sk(c, OUT, 1); }
    }
    // pent roof skirt (mokoshi)
    const pr = pathFrom([[8, 174], [432, 174], [454, 232], [-14, 232]]);
    thatchFace(c, pr, { x: -16, y: 172, w: 472, h: 62 }, T, { seed: 401, course: 20 });
    moss(c, pr, { x: -16, y: 172, w: 472, h: 62 }, 4, 402);
    eaveBand(c, -18, 458, 236, 15, T, 4);
    // main roof
    hipRoof(c, { x0: 6, x1: 434, yr: -86, yb: 26, ye: 186, hip: 128, th: 22, T, seed: 405, moss: 16, sod: true });
    // front porch gable with the Kusa crest
    gasshoRoof(c, {
      cx: 220, ay: 90, hw: 100, ye: 244, D: 64, th: 16, T, seed: 409, moss: 2,
      face: (cc, ia, il, ir, ye) => {
        const cx = 220, tri = pathFrom([[cx, ia], [ir, ye], [il, ye]]);
        cc.save(); cc.fillStyle = W.dark; cc.fill(tri); cc.clip(tri);
        for (let x = il; x < ir; x += 12) frect(cc, x, ia, 2, ye - ia, 'rgba(255,220,180,.12)');
        frect(cc, il, ye - 12, ir - il, 12, W.deep);
        shade(cc, tri, 'rgba(255,230,190,.18)', 4, 4);
        cc.restore();
        cc.strokeStyle = OUT; cc.lineWidth = 1.6; cc.stroke(tri);
        const my = ye - 52;
        fell(cc, cx + 2, my + 3, 31, 31, 'rgba(0,0,0,.3)');
        fell(cc, cx, my, 31, 31, '#d8b048'); fell(cc, cx, my, 26, 26, '#2f5a2a');
        cc.beginPath(); cc.arc(cx, my, 31, 0, TAU); sk(cc, OUT, 1.8);
        cc.beginPath(); cc.arc(cx, my, 22, 0, TAU); sk(cc, '#d8b048', 1.4);
        kusaMark(cc, cx, my + 1, 15, '#f2d470');
      }
    });
    // porch posts
    for (const x of [128, 312]) { frect(c, x - 5, 240, 10, 58, W.dark); frect(c, x - 5, 240, 3, 58, W.light); srect(c, x - 5, 240, 10, 58, OUT, 1.4); }
    // big paper lanterns under the porch
    chochin(c, 152, 262, 1.7, '#e0dccc', '草'); chochin(c, 288, 262, 1.7, '#e0dccc', '草');
    P.lamps.push([152, 266], [288, 266]);
    // stone lanterns on the forecourt
    for (const x of [64, 376]) { toro(c, x, 390, 1.15); P.lamps.push([x, 352]); }
    // nobori banners
    nobori(c, 22, 396, '#3c6b3a', 1); nobori(c, 418, 396, '#3c6b3a', 2);
  }
  function nobori(c, x, y, col, seed) {
    fell(c, x + 6, y, 10, 3, SH);
    line(c, x, y, x, y - 230, OUT, 5); line(c, x, y, x, y - 230, '#5a3e26', 3);
    line(c, x, y - 226, x + 30, y - 226, OUT, 4); line(c, x, y - 226, x + 30, y - 226, '#5a3e26', 2);
    const bx = x + 2, by = y - 224, bw = 28, bh = 150, sw = Math.sin(seed) * 3;
    const p = new Path2D(); p.moveTo(bx, by); p.lineTo(bx + bw, by); p.quadraticCurveTo(bx + bw + sw, by + bh / 2, bx + bw, by + bh); p.lineTo(bx, by + bh); p.closePath();
    c.fillStyle = col; c.fill(p); c.save(); c.clip(p);
    frect(c, bx, by, 4, bh, 'rgba(255,255,255,.18)'); frect(c, bx + bw - 6, by, 6, bh, 'rgba(0,0,0,.2)');
    for (let i = 0; i < 5; i++) frect(c, bx, by + 6 + i * 30, bw, 2, 'rgba(0,0,0,.08)');
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(p);
    for (let i = 0; i < 4; i++) { fell(c, bx + 1, by + 8 + i * 40, 2.2, 2.2, '#e8dcc0'); }
    kusaMark(c, bx + bw / 2, by + 26, 9, '#f2ead2');
    txtV(c, '草隠', bx + bw / 2, by + 48, 17, '#f2ead2', { weight: '900' });
  }
  function toro(c, x, y, s = 1) { // moss-covered stone lantern
    const st = tone('#9a968a');
    fell(c, x + 6 * s, y, 15 * s, 4.5 * s, SH);
    frect(c, x - 11 * s, y - 7 * s, 22 * s, 7 * s, st.dark); srect(c, x - 11 * s, y - 7 * s, 22 * s, 7 * s, OUT, 1.1);
    frect(c, x - 4 * s, y - 26 * s, 8 * s, 19 * s, st.base); frect(c, x - 4 * s, y - 26 * s, 2.5 * s, 19 * s, st.light); srect(c, x - 4 * s, y - 26 * s, 8 * s, 19 * s, OUT, 1.1);
    frect(c, x - 9 * s, y - 31 * s, 18 * s, 5 * s, st.dark); srect(c, x - 9 * s, y - 31 * s, 18 * s, 5 * s, OUT, 1.1);
    frect(c, x - 7 * s, y - 44 * s, 14 * s, 13 * s, st.base);
    frect(c, x - 4 * s, y - 41 * s, 8 * s, 7 * s, '#f6d48a'); frect(c, x - 4 * s, y - 41 * s, 8 * s, 2 * s, '#fff0c0');
    srect(c, x - 7 * s, y - 44 * s, 14 * s, 13 * s, OUT, 1.1);
    const roof = [x - 15 * s, y - 44 * s, x, y - 55 * s, x + 15 * s, y - 44 * s, x + 11 * s, y - 41 * s, x - 11 * s, y - 41 * s];
    fpoly(c, roof, st.base); fpoly(c, [x - 15 * s, y - 44 * s, x, y - 55 * s, x, y - 43 * s], st.light); poly(c, roof); sk(c, OUT, 1.2);
    fell(c, x - 6 * s, y - 47 * s, 5 * s, 2 * s, '#6e8a3a'); fell(c, x + 4 * s, y - 45 * s, 4 * s, 1.6 * s, '#7a9a3e');
    fell(c, x, y - 57 * s, 3 * s, 3 * s, st.dark); c.beginPath(); c.arc(x, y - 57 * s, 3 * s, 0, TAU); sk(c, OUT, 1);
  }

  // ------------------------------------------------------------------ sacred tree (shinboku) with shimenawa
  function sacredTree(c, ax, ay) {
    const R = rng(2024);
    fell(c, ax + 60, ay - 4, 270, 56, 'rgba(28,50,18,.26)');
    fell(c, ax, ay - 2, 150, 36, '#557f34'); fell(c, ax - 10, ay - 6, 120, 26, '#62903c');
    for (let i = 0; i < 40; i++) { const a = R() * TAU, d = 40 + R() * 100; fell(c, ax + Math.cos(a) * d, ay - 2 + Math.sin(a) * d * .25, 4 + R() * 7, 2 + R() * 3, R() < .5 ? '#7aa648' : '#46702c'); }
    // roots
    const roots = [[-140, 4, 16], [-96, 16, 22], [-48, 22, 22], [120, 6, 16], [84, 18, 22], [36, 24, 20], [-20, 26, 18]];
    for (const [dx, dy, w] of roots) {
      const p = new Path2D(); p.moveTo(ax + dx * .25 - w, ay - 30); p.quadraticCurveTo(ax + dx * .6, ay - 18, ax + dx, ay + dy - 4); p.quadraticCurveTo(ax + dx * .6 + w * .3, ay - 4, ax + dx * .25 + w, ay - 24); p.closePath();
      celFill(c, p, '#6a4a30', '#8e6a46', '#4a3220', { ld: 3, dd: 4 }); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(p);
    }
    // trunk with branching limbs
    const tr = new Path2D();
    tr.moveTo(ax - 72, ay - 12); tr.quadraticCurveTo(ax - 44, ay - 70, ax - 46, ay - 170);
    tr.quadraticCurveTo(ax - 50, ay - 230, ax - 120, ay - 290); tr.lineTo(ax - 92, ay - 306); tr.quadraticCurveTo(ax - 40, ay - 260, ax - 16, ay - 236);
    tr.quadraticCurveTo(ax - 14, ay - 290, ax - 30, ay - 340); tr.lineTo(ax + 4, ay - 346); tr.quadraticCurveTo(ax + 12, ay - 290, ax + 18, ay - 240);
    tr.quadraticCurveTo(ax + 60, ay - 270, ax + 118, ay - 300); tr.lineTo(ax + 132, ay - 280); tr.quadraticCurveTo(ax + 64, ay - 236, ax + 48, ay - 180);
    tr.quadraticCurveTo(ax + 44, ay - 70, ax + 76, ay - 12); tr.quadraticCurveTo(ax, ay + 4, ax - 72, ay - 12); tr.closePath();
    celFill(c, tr, '#6e4c30', '#94704a', '#4c3420', { ld: 10, dd: 14 });
    c.save(); c.clip(tr);
    c.strokeStyle = 'rgba(50,32,18,.55)'; c.lineWidth = 2;
    for (let i = 0; i < 16; i++) { const x = ax - 50 + i * 6.6 + (R() - .5) * 4; c.beginPath(); c.moveTo(x, ay - 6); for (let yy = ay - 6; yy > ay - 360; yy -= 18) c.lineTo(x + Math.sin(yy * .05 + i) * 4 + (x - ax) * (ay - yy) * -.0018, yy); c.stroke(); }
    c.strokeStyle = 'rgba(200,170,120,.35)'; c.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) { const x = ax - 40 + i * 6; c.beginPath(); c.moveTo(x, ay - 10); for (let yy = ay - 10; yy > ay - 200; yy -= 18) c.lineTo(x + Math.sin(yy * .05 + i * 2) * 3, yy); c.stroke(); }
    fell(c, ax + 16, ay - 150, 9, 14, '#3e2a1a'); fell(c, ax + 15, ay - 152, 5, 8, '#2a1c12');
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(tr);
    // moss on the trunk
    for (let i = 0; i < 12; i++) fell(c, ax - 40 + R() * 70, ay - 40 - R() * 140, 4 + R() * 6, 2.5 + R() * 3, R() < .5 ? '#6e8a38' : '#8aa848');
    // shimenawa (sacred straw rope) with shide and tassels
    const ry = ay - 112;
    c.beginPath(); c.moveTo(ax - 58, ry - 12); c.quadraticCurveTo(ax, ry + 16, ax + 60, ry - 12); sk(c, OUT, 19);
    c.beginPath(); c.moveTo(ax - 58, ry - 12); c.quadraticCurveTo(ax, ry + 16, ax + 60, ry - 12); sk(c, '#d6bc78', 15);
    c.beginPath(); c.moveTo(ax - 58, ry - 16); c.quadraticCurveTo(ax, ry + 11, ax + 60, ry - 16); sk(c, '#ecd89c', 4);
    for (let t = .04; t < .98; t += .06) { const [px, py] = quadPt(ax - 58, ry - 12, ax, ry + 16, ax + 60, ry - 12, t); line(c, px - 5, py - 7, px + 4, py + 7, 'rgba(110,80,30,.7)', 2); }
    for (const t of [.22, .5, .78]) {
      const [px, py] = quadPt(ax - 58, ry - 12, ax, ry + 16, ax + 60, ry - 12, t);
      for (let k = -4; k <= 4; k += 2) line(c, px + k * .7, py + 6, px + k, py + 28, '#c8ac66', 1.6);
      line(c, px - 4, py + 10, px + 4, py + 10, '#8a6a2a', 2);
    }
    for (const t of [.36, .64]) {
      const [px, py] = quadPt(ax - 58, ry - 12, ax, ry + 16, ax + 60, ry - 12, t);
      const z = [px - 3, py + 6, px + 5, py + 6, px + 5, py + 16, px + 1, py + 16, px + 1, py + 26, px + 9, py + 26, px + 9, py + 36, px + 3, py + 36, px + 3, py + 46, px - 3, py + 46, px - 3, py + 30, px - 7, py + 30, px - 7, py + 20, px - 3, py + 20];
      fpoly(c, z, '#fbf8ee'); poly(c, z); sk(c, '#6a6458', 1);
    }
    // canopy
    const cy = ay - 352, rx = 268, rys = 150, cl = [];
    for (let i = 0; i < 46; i++) { const a = R() * TAU, d = Math.sqrt(R()); cl.push([ax + Math.cos(a) * rx * d * .86, cy + Math.sin(a) * rys * d * .8, 40 + R() * 26]); }
    cl.sort((p, q) => p[1] - q[1]);
    for (const [x, y, r] of cl) fell(c, x, y, r + 3, r * .82 + 3, LEAF.out);
    for (const [x, y, r] of cl) {
      fell(c, x, y, r, r * .82, LEAF.dark);
      fell(c, x - r * .14, y - r * .16, r * .84, r * .66, LEAF.mid);
      fell(c, x - r * .3, y - r * .32, r * .52, r * .4, LEAF.light);
      fell(c, x - r * .4, y - r * .42, r * .22, r * .16, LEAF.hi);
    }
    for (let i = 0; i < 70; i++) { const a = R() * TAU, d = Math.sqrt(R()); fell(c, ax + Math.cos(a) * rx * d * .8, cy + Math.sin(a) * rys * d * .74, 3 + R() * 3, 2 + R() * 2, R() < .5 ? LEAF.hi : 'rgba(25,45,18,.5)'); }
    // a few hanging leaf strands under the canopy
    for (let i = 0; i < 9; i++) { const x = ax - 200 + i * 50 + (R() - .5) * 20, y = cy + 100 + R() * 30; line(c, x, y, x + 2, y + 24 + R() * 14, LEAF.dark, 4); line(c, x, y, x + 2, y + 20, LEAF.mid, 2); }
    // little stone curb in front of the trunk
    for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12), x = ax + Math.cos(a) * 118, y = ay + 10 + Math.sin(a) * 24 - 16; fell(c, x, y, 9, 5, '#8f8a7c'); fell(c, x - 2, y - 2, 4.5, 2.2, '#bdb8a8'); c.beginPath(); c.ellipse(x, y, 9, 5, 0, 0, TAU); sk(c, 'rgba(59,42,34,.7)', 1); }
  }

  // ------------------------------------------------------------------ nature sprites
  function broadleaf(c, ax, ay, s, seed, pal = LEAF, fruit) {
    const R = rng(seed), th = (54 + R() * 22) * s;
    shadowEl(c, ax + 24 * s, ay - 2, 58 * s, 15 * s);
    const tr = new Path2D(); tr.moveTo(ax - 11 * s, ay); tr.quadraticCurveTo(ax - 6 * s, ay - th * .5, ax - 5 * s, ay - th); tr.lineTo(ax + 5 * s, ay - th); tr.quadraticCurveTo(ax + 6 * s, ay - th * .5, ax + 11 * s, ay); tr.closePath();
    celFill(c, tr, '#6e4e32', '#94704a', '#4e3622', { ld: 3 * s, dd: 4 * s });
    c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(tr);
    line(c, ax - 2 * s, ay - th * .7, ax - 24 * s, ay - th - 14 * s, '#5e4028', 5 * s); line(c, ax + 2 * s, ay - th * .8, ax + 22 * s, ay - th - 18 * s, '#5e4028', 4.5 * s);
    const cy = ay - th - 38 * s, rx = 64 * s, ry = 50 * s, cl = [];
    for (let i = 0; i < 17; i++) { const a = R() * TAU, d = Math.sqrt(R()); cl.push([ax + Math.cos(a) * rx * d * .8, cy + Math.sin(a) * ry * d * .76, (19 + R() * 12) * s]); }
    cl.sort((p, q) => p[1] - q[1]);
    for (const [x, y, r] of cl) fell(c, x, y, r + 2.2, r * .84 + 2.2, pal.out);
    for (const [x, y, r] of cl) {
      fell(c, x, y, r, r * .84, pal.dark);
      fell(c, x - r * .14, y - r * .18, r * .82, r * .66, pal.mid);
      fell(c, x - r * .3, y - r * .34, r * .5, r * .38, pal.light);
      fell(c, x - r * .38, y - r * .44, r * .2, r * .14, pal.hi);
    }
    if (fruit) for (let i = 0; i < 14; i++) { const a = R() * TAU, d = Math.sqrt(R()); const x = ax + Math.cos(a) * rx * d * .72, y = cy + Math.sin(a) * ry * d * .7 + 6 * s; fell(c, x, y, 3.6 * s, 3.4 * s, fruit); fell(c, x - 1, y - 1, 1.3 * s, 1.1 * s, '#ffd090'); }
  }
  function bambooClump(c, ax, ay, h, n, seed) {
    const R = rng(seed), st = [];
    shadowEl(c, ax + 14, ay, 50, 12);
    for (let i = 0; i < n; i++) st.push({ x: ax + (R() - .5) * 64, lean: (R() - .5) * .16, h: h * (.68 + R() * .32), w: 5 + R() * 3, k: R() });
    st.sort((a, b) => a.k - b.k);
    // leaf sprays: drooping lance leaves fanned from the nodes, densest in the crown
    const leaves = (front) => {
      const P3 = [new Path2D(), new Path2D(), new Path2D()];
      for (const s of st) {
        if ((s.k > .45) !== front) continue;
        const tx = s.x + s.lean * s.h, ty = ay - s.h;
        for (let t = .34; t < 1.04; t += .085) {
          const px = s.x + (tx - s.x) * t, py = ay + (ty - ay) * t, m = Math.round(2 + t * 5 + R() * 2);
          for (let k = 0; k < m; k++) {
            const side = R() < .5 ? -1 : 1, a = (.15 + R() * .95), len = 20 + R() * 20 + t * 8, lw = 2.8 + R() * 1.8;
            const ex = px + side * Math.cos(a) * len, ey = py + Math.sin(a) * len * .7 - 4;
            const nx = -(ey - py), ny = ex - px, nl = Math.hypot(nx, ny) || 1, ox = nx / nl * lw, oy = ny / nl * lw;
            const p = P3[Math.min(2, Math.floor(R() * 2 + t * 1.3))], mx = (px + ex) / 2, my = (py + ey) / 2 - 3;
            p.moveTo(px, py); p.quadraticCurveTo(mx + ox, my + oy, ex, ey); p.quadraticCurveTo(mx - ox, my - oy, px, py); p.closePath();
          }
        }
      }
      const cols = front ? ['#3f7230', '#55903a', '#76ad4a'] : ['#203c1a', '#2c5024', '#3c6a2e'];
      for (let i = 0; i < 3; i++) { c.fillStyle = cols[i]; c.fill(P3[i]); c.strokeStyle = 'rgba(22,40,14,.6)'; c.lineWidth = .8; c.stroke(P3[i]); }
    };
    leaves(false);
    for (const s of st) {
      const tx = s.x + s.lean * s.h, ty = ay - s.h, col = s.k < .4 ? '#5f8f3a' : s.k < .75 ? '#77a646' : '#8cb852';
      line(c, s.x, ay, tx, ty, '#1f3a16', s.w + 2.6);
      line(c, s.x, ay, tx, ty, col, s.w);
      line(c, s.x - s.w * .25, ay, tx - s.w * .25, ty, 'rgba(210,236,150,.6)', s.w * .3);
      for (let yy = ay - 18 - R() * 10; yy > ty + 10; yy -= 22 + R() * 8) {
        const t = (ay - yy) / s.h, px = s.x + (tx - s.x) * t;
        line(c, px - s.w * .5, yy, px + s.w * .5, yy, 'rgba(40,70,26,.8)', 1.6); line(c, px - s.w * .4, yy + 1.8, px + s.w * .2, yy + 1.8, 'rgba(220,240,170,.5)', 1);
      }
    }
    leaves(true);
    for (let i = 0; i < 2; i++) { const x = ax + (R() - .5) * 60, y = ay + 2; fpoly(c, [x - 4, y, x, y - 13, x + 4, y], '#8a6a3a'); fpoly(c, [x - 2, y, x, y - 13, x + 1, y], '#b89458'); poly(c, [x - 4, y, x, y - 13, x + 4, y]); sk(c, OUT, .9); }
  }
  function bush(c, ax, ay, s, seed, pal = LEAF, flowers) {
    const R = rng(seed), cl = [];
    shadowEl(c, ax + 8 * s, ay, 34 * s, 9 * s);
    for (let i = 0; i < 10; i++) cl.push([ax + (R() - .5) * 46 * s, ay - 12 * s - R() * 22 * s, (9 + R() * 8) * s]);
    cl.sort((p, q) => p[1] - q[1]);
    for (const [x, y, r] of cl) fell(c, x, y, r + 2, r * .86 + 2, pal.out);
    for (const [x, y, r] of cl) { fell(c, x, y, r, r * .86, pal.dark); fell(c, x - r * .15, y - r * .2, r * .78, r * .62, pal.mid); fell(c, x - r * .32, y - r * .36, r * .42, r * .32, pal.light); }
    if (flowers) for (let i = 0; i < 12; i++) { const x = ax + (R() - .5) * 44 * s, y = ay - 16 * s - R() * 20 * s; fell(c, x, y, 2.6 * s, 2.4 * s, flowers); fell(c, x - .6, y - .6, 1 * s, 1 * s, '#fffbe8'); }
  }
  function susuki(c, ax, ay, s, seed) { // Japanese pampas grass
    const R = rng(seed);
    shadowEl(c, ax + 6 * s, ay, 26 * s, 6 * s);
    for (let i = 0; i < 18; i++) {
      const side = R() < .5 ? -1 : 1, h = (36 + R() * 30) * s, dx = (R() - .5) * 14 * s;
      c.beginPath(); c.moveTo(ax + dx, ay); c.quadraticCurveTo(ax + dx + side * 8 * s, ay - h, ax + dx + side * (16 + R() * 18) * s, ay - h * (.5 + R() * .3));
      sk(c, R() < .5 ? '#4f7f30' : '#76a646', 1.8 * s);
    }
    for (let i = 0; i < 7; i++) {
      const dx = (R() - .5) * 18 * s, h = (62 + R() * 26) * s, lean = (R() - .3) * 14 * s, tx = ax + dx + lean, ty = ay - h;
      line(c, ax + dx * .4, ay, tx, ty, '#8a8a52', 1.4);
      for (let k = 0; k < 9; k++) {
        const t = k / 8, px = tx + (lean > 0 ? 1 : -1) * t * 6 * s, py = ty + t * 22 * s;
        c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + 6 * s, py + 2, px + (10 + R() * 6) * s, py + (8 + R() * 6) * s); sk(c, k % 2 ? 'rgba(236,226,200,.95)' : 'rgba(206,188,150,.95)', 1.5);
      }
      fell(c, tx + 4 * s, ty + 10 * s, 5 * s, 10 * s, 'rgba(255,248,228,.35)');
    }
  }
  function mossRock(c, x, y, r, seed) {
    const R = rng(seed), pts = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI, rr = r * (.8 + R() * .35); pts.push([x + Math.cos(a) * rr * 1.15, y - 2 + Math.sin(a) * rr * .9]); }
    pts.push([x + r, y + r * .12], [x, y + r * .22], [x - r, y + r * .12]);
    shadowEl(c, x + r * .45, y + r * .14, r * 1.2, r * .32);
    const p = pathFrom(pts);
    celFill(c, p, '#8e8a7c', '#b4b0a0', '#686458', { ld: r * .25, dd: r * .35 });
    c.strokeStyle = '#3a3630'; c.lineWidth = r > 16 ? 1.8 : 1.4; c.stroke(p);
    c.save(); c.clip(p);
    for (let i = 0; i < 5; i++) { const mx = x + (R() - .6) * r, my = y - r * (.5 + R() * .4); fell(c, mx, my, r * (.3 + R() * .3), r * .2, '#6c8a36'); fell(c, mx - 2, my - 1, r * .18, r * .1, '#93ad52'); }
    c.restore();
  }

  // ------------------------------------------------------------------ farm & village props
  function haystack(c, ax, ay, s) {
    shadowEl(c, ax + 14 * s, ay, 42 * s, 10 * s);
    line(c, ax, ay - 70 * s, ax + 3 * s, ay - 98 * s, OUT, 5 * s); line(c, ax, ay - 70 * s, ax + 3 * s, ay - 98 * s, WOOD.light, 3 * s);
    const p = new Path2D(); p.moveTo(ax - 36 * s, ay); p.bezierCurveTo(ax - 40 * s, ay - 40 * s, ax - 16 * s, ay - 78 * s, ax, ay - 80 * s); p.bezierCurveTo(ax + 16 * s, ay - 78 * s, ax + 40 * s, ay - 40 * s, ax + 36 * s, ay); p.quadraticCurveTo(ax, ay + 7 * s, ax - 36 * s, ay); p.closePath();
    thatchFace(c, p, { x: ax - 42 * s, y: ay - 82 * s, w: 84 * s, h: 90 * s }, STRAWS[2], { seed: Math.round(ax + ay), course: 15 * s, u: [0, 1] });
    for (const yy of [-28, -52]) { c.beginPath(); c.ellipse(ax, ay + yy * s, 34 * s * (1 + yy / 140), 6 * s, 0, .05 * Math.PI, .95 * Math.PI); sk(c, '#6a4a1e', 2.2); }
    fell(c, ax, ay - 80 * s, 9 * s, 5 * s, STRAWS[1].dark); c.beginPath(); c.ellipse(ax, ay - 80 * s, 9 * s, 5 * s, 0, 0, TAU); sk(c, OUT, 1.2);
    const R = rng(Math.round(ax * 3));
    for (let i = 0; i < 12; i++) { const x = ax + (R() - .5) * 80 * s; line(c, x, ay + 2, x + (R() - .5) * 10, ay - 2 - R() * 4, STRAWS[2].light, 1.2); }
  }
  function hasa(c, ax, ay, w) { // rice drying rack (hasa-gake) with hanging sheaves
    shadowEl(c, ax + 10, ay + 2, w * .55, 8);
    const xs = [ax - w / 2, ax, ax + w / 2];
    for (const x of xs) { line(c, x - 9, ay, x + 7, ay - 78, OUT, 5); line(c, x - 9, ay, x + 7, ay - 78, '#8a7a4a', 3); line(c, x + 9, ay, x - 7, ay - 78, OUT, 5); line(c, x + 9, ay, x - 7, ay - 78, '#9a8a58', 3); }
    for (const ry of [ay - 62, ay - 36]) {
      line(c, ax - w / 2 - 10, ry, ax + w / 2 + 10, ry, OUT, 5); line(c, ax - w / 2 - 10, ry, ax + w / 2 + 10, ry, '#b4a46a', 3);
      for (let x = ax - w / 2 + 4; x < ax + w / 2 - 2; x += 8) {
        fpoly(c, [x - 1, ry, x - 5, ry + 22, x + 1, ry + 24], '#c9a248'); fpoly(c, [x + 1, ry, x + 5, ry + 22, x - 1, ry + 24], '#e0bc5c');
        line(c, x - 3, ry + 3, x + 3, ry + 3, '#7a5a1a', 1.4);
      }
      c.strokeStyle = 'rgba(80,60,20,.6)'; c.lineWidth = .8; c.beginPath(); for (let x = ax - w / 2 + 4; x < ax + w / 2 - 2; x += 8) { c.moveTo(x - 5, ry + 22); c.lineTo(x + 5, ry + 22); } c.stroke();
    }
  }
  function scarecrow(c, ax, ay) {
    shadowEl(c, ax + 8, ay, 18, 5);
    line(c, ax, ay, ax, ay - 76, OUT, 5); line(c, ax, ay, ax, ay - 76, WOOD.light, 3);
    line(c, ax - 28, ay - 56, ax + 28, ay - 56, OUT, 5); line(c, ax - 28, ay - 56, ax + 28, ay - 56, WOOD.light, 3);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) line(c, ax + s * 28, ay - 56, ax + s * (32 + k * 2), ay - 52 + k * 3, STRAWS[2].light, 1.3);
    const coat = pathFrom([[ax - 22, ay - 60], [ax + 22, ay - 60], [ax + 16, ay - 26], [ax - 16, ay - 26]]);
    celFill(c, coat, '#3e5f8a', '#5a7aa4', '#2a4466', { ld: 3, dd: 4 }); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(coat);
    frect(c, ax - 8, ay - 52, 9, 10, '#a8742a'); srect(c, ax - 8, ay - 52, 9, 10, OUT, .8);
    line(c, ax - 16, ay - 40, ax + 16, ay - 40, '#c8a050', 2.4);
    for (let k = -3; k <= 3; k++) line(c, ax + k * 3, ay - 26, ax + k * 3.4, ay - 18, STRAWS[2].base, 1.4);
    fell(c, ax, ay - 70, 9, 9, '#efe6cc'); c.beginPath(); c.arc(ax, ay - 70, 9, 0, TAU); sk(c, OUT, 1.2);
    line(c, ax - 5, ay - 72, ax - 2, ay - 71, OUT, 1.2); line(c, ax + 2, ay - 71, ax + 5, ay - 72, OUT, 1.2); c.beginPath(); c.arc(ax, ay - 67, 3, .2, Math.PI - .2); sk(c, OUT, 1.1);
    fpoly(c, [ax - 20, ay - 76, ax, ay - 90, ax + 20, ay - 76], STRAWS[0].base); fell(c, ax, ay - 76, 20, 4, STRAWS[0].dark); poly(c, [ax - 20, ay - 76, ax, ay - 90, ax + 20, ay - 76]); sk(c, OUT, 1.2);
  }
  function hives(c, ax, ay) { // straw skeps on a bench + a log hive
    shadowEl(c, ax + 10, ay, 54, 9);
    for (const x of [ax - 38, ax + 30]) { frect(c, x, ay - 18, 6, 18, WOOD.dark); srect(c, x, ay - 18, 6, 18, OUT, 1); }
    frect(c, ax - 46, ay - 24, 86, 8, WOOD.light); frect(c, ax - 46, ay - 24, 86, 2, WOOD.hi); srect(c, ax - 46, ay - 24, 86, 8, OUT, 1.2);
    for (const x of [ax - 28, ax, ax + 26]) {
      const T = STRAWS[2], p = new Path2D(); p.moveTo(x - 13, ay - 24); p.bezierCurveTo(x - 14, ay - 46, x + 14, ay - 46, x + 13, ay - 24); p.closePath();
      celFill(c, p, T.base, T.light, T.dark, { ld: 3, dd: 4 });
      c.save(); c.clip(p); for (let yy = ay - 27; yy > ay - 46; yy -= 4) { c.beginPath(); c.ellipse(x, yy, 14, 2.2, 0, 0, Math.PI); sk(c, T.deep, 1); } c.restore();
      c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(p);
      fell(c, x, ay - 27, 3, 2, '#2a1a0a');
    }
    // log hive (vertical stacked boxes with a stone on the lid)
    const hx = ax + 54;
    for (let i = 0; i < 3; i++) { const y = ay - 14 - i * 14; frect(c, hx - 12, y, 24, 14, i % 2 ? '#9a6c40' : '#a8784a'); frect(c, hx - 12, y, 4, 14, 'rgba(255,240,200,.25)'); srect(c, hx - 12, y, 24, 14, OUT, 1.1); }
    fpoly(c, [hx - 16, ay - 42, hx + 16, ay - 42, hx + 12, ay - 50, hx - 12, ay - 50], '#6a4a30'); poly(c, [hx - 16, ay - 42, hx + 16, ay - 42, hx + 12, ay - 50, hx - 12, ay - 50]); sk(c, OUT, 1.1);
    fell(c, hx, ay - 54, 8, 5, '#9a968a'); c.beginPath(); c.ellipse(hx, ay - 54, 8, 5, 0, 0, TAU); sk(c, OUT, 1);
    fell(c, hx, ay - 8, 3, 2, '#2a1a0a');
  }
  function wellSprite(c, ax, ay) {
    shadowEl(c, ax + 12, ay, 40, 10);
    frect(c, ax - 30, ay - 30, 60, 30, '#8a6a44');
    c.strokeStyle = '#5a4028'; c.lineWidth = 1.2; c.beginPath(); for (let x = ax - 30; x < ax + 30; x += 10) { c.moveTo(x, ay - 30); c.lineTo(x, ay); } c.stroke();
    frect(c, ax - 30, ay - 30, 5, 30, 'rgba(255,240,200,.25)'); srect(c, ax - 30, ay - 30, 60, 30, OUT, 1.4);
    fpoly(c, [ax - 34, ay - 30, ax + 34, ay - 30, ax + 30, ay - 46, ax - 30, ay - 46], '#a07a4e');
    fpoly(c, [ax - 24, ay - 34, ax + 24, ay - 34, ax + 21, ay - 43, ax - 21, ay - 43], '#2a4a58'); fell(c, ax - 6, ay - 39, 9, 2, 'rgba(180,220,235,.45)');
    poly(c, [ax - 34, ay - 30, ax + 34, ay - 30, ax + 30, ay - 46, ax - 30, ay - 46]); sk(c, OUT, 1.4);
    for (const x of [ax - 26, ax + 26]) { line(c, x, ay - 32, x, ay - 92, OUT, 5.5); line(c, x, ay - 32, x, ay - 92, WOOD.base, 3.5); }
    line(c, ax - 30, ay - 84, ax + 30, ay - 84, OUT, 5); line(c, ax - 30, ay - 84, ax + 30, ay - 84, WOOD.light, 3);
    fell(c, ax, ay - 84, 6, 6, WOOD.dark); c.beginPath(); c.arc(ax, ay - 84, 6, 0, TAU); sk(c, OUT, 1.2);
    line(c, ax + 5, ay - 84, ax + 5, ay - 58, '#d8c49a', 1.2); bucket(c, ax + 6, ay - 46);
    const rp = pathFrom([[ax - 40, ay - 92], [ax, ay - 118], [ax + 40, ay - 92], [ax + 36, ay - 86], [ax - 36, ay - 86]]);
    thatchFace(c, rp, { x: ax - 42, y: ay - 120, w: 84, h: 36 }, STRAWS[1], { seed: 55, course: 12 });
  }
  function jizo(c, ax, ay) {
    shadowEl(c, ax + 5, ay, 14, 4);
    fell(c, ax, ay - 4, 12, 4, '#8a8678');
    const b = new Path2D(); b.moveTo(ax - 9, ay - 4); b.quadraticCurveTo(ax - 11, ay - 26, ax, ay - 28); b.quadraticCurveTo(ax + 11, ay - 26, ax + 9, ay - 4); b.closePath();
    celFill(c, b, '#a4a092', '#c4c0b2', '#7a7668', { ld: 2, dd: 3 }); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(b);
    fell(c, ax, ay - 34, 7, 7, '#a8a496'); fell(c, ax - 2, ay - 36, 3, 3, '#cac6b8'); c.beginPath(); c.arc(ax, ay - 34, 7, 0, TAU); sk(c, OUT, 1.1);
    fpoly(c, [ax - 8, ay - 26, ax + 8, ay - 26, ax, ay - 14], '#c8352a'); poly(c, [ax - 8, ay - 26, ax + 8, ay - 26, ax, ay - 14]); sk(c, OUT, 1);
    fpoly(c, [ax - 7, ay - 37, ax, ay - 46, ax + 7, ay - 37], '#c8352a');
    line(c, ax - 2, ay - 34, ax - 1, ay - 34, OUT, 1); line(c, ax + 1, ay - 34, ax + 2, ay - 34, OUT, 1);
    fell(c, ax + 14, ay - 2, 4, 2, '#e8e0cc'); fell(c, ax - 14, ay - 2, 3, 3, '#e07a2a');
  }
  function hokora(c, ax, ay) { // tiny wayside shrine with a little torii
    shadowEl(c, ax + 10, ay, 40, 9);
    frect(c, ax - 22, ay - 16, 44, 16, '#8f8a7c'); frect(c, ax - 22, ay - 16, 44, 3, '#b8b4a6'); srect(c, ax - 22, ay - 16, 44, 16, OUT, 1.2);
    frect(c, ax - 15, ay - 46, 30, 30, '#8a5a36'); frect(c, ax - 10, ay - 40, 20, 22, '#3a2416'); frect(c, ax - 15, ay - 46, 4, 30, 'rgba(255,230,190,.25)');
    frect(c, ax - 3, ay - 36, 6, 9, '#f2ead2'); srect(c, ax - 15, ay - 46, 30, 30, OUT, 1.2);
    const rp = pathFrom([[ax - 24, ay - 46], [ax, ay - 66], [ax + 24, ay - 46], [ax + 20, ay - 42], [ax - 20, ay - 42]]);
    thatchFace(c, rp, { x: ax - 26, y: ay - 68, w: 52, h: 28 }, STRAWS[3], { seed: 66, course: 10 });
    line(c, ax - 16, ay - 50, ax + 16, ay - 50, '#d6bc78', 3);
    for (const x of [ax - 6, ax + 6]) { fpoly(c, [x - 2, ay - 49, x + 2, ay - 49, x + 2, ay - 42, x, ay - 40, x - 2, ay - 42], '#fbf8ee'); }
    const tx = ax, ty = ay + 18;
    for (const dx of [-14, 14]) { line(c, tx + dx, ty, tx + dx, ty - 36, OUT, 5); line(c, tx + dx, ty, tx + dx, ty - 36, '#d0452e', 3); }
    line(c, tx - 20, ty - 36, tx + 20, ty - 36, OUT, 6); line(c, tx - 20, ty - 36, tx + 20, ty - 36, '#d0452e', 4); line(c, tx - 16, ty - 28, tx + 16, ty - 28, '#b03a26', 3);
    line(c, tx - 21, ty - 39, tx + 21, ty - 39, '#2a2420', 3);
  }
  function cart(c, ax, ay) {
    shadowEl(c, ax + 12, ay, 50, 9);
    line(c, ax + 30, ay - 22, ax + 64, ay - 8, OUT, 4.5); line(c, ax + 30, ay - 22, ax + 64, ay - 8, WOOD.light, 2.5);
    line(c, ax + 30, ay - 28, ax + 64, ay - 14, OUT, 4.5); line(c, ax + 30, ay - 28, ax + 64, ay - 14, WOOD.light, 2.5);
    frect(c, ax - 40, ay - 36, 74, 14, WOOD.base); frect(c, ax - 40, ay - 36, 74, 3, WOOD.light); srect(c, ax - 40, ay - 36, 74, 14, OUT, 1.4);
    tawara(c, ax - 22, ay - 36, .9); tawara(c, ax + 10, ay - 36, .9); tawara(c, ax - 6, ay - 50, .85);
    for (const wx of [-26, 20]) { fell(c, ax + wx, ay - 12, 12, 12, WOOD.dark); fell(c, ax + wx, ay - 12, 8, 8, WOOD.base); for (let a = 0; a < 6; a++) line(c, ax + wx, ay - 12, ax + wx + Math.cos(a) * 8, ay - 12 + Math.sin(a) * 8, WOOD.dark, 1.4); c.beginPath(); c.arc(ax + wx, ay - 12, 12, 0, TAU); sk(c, OUT, 1.4); }
  }
  function bench(c, ax, ay) {
    shadowEl(c, ax + 8, ay, 36, 6);
    for (const x of [ax - 30, ax + 22]) { frect(c, x, ay - 12, 8, 12, WOOD.dark); srect(c, x, ay - 12, 8, 12, OUT, 1); }
    frect(c, ax - 36, ay - 20, 72, 9, WOOD.light); frect(c, ax - 36, ay - 20, 72, 3, WOOD.hi); srect(c, ax - 36, ay - 20, 72, 9, OUT, 1.3);
  }
  function signpost(c, ax, ay) {
    shadowEl(c, ax + 8, ay, 20, 5);
    for (const dx of [-14, 14]) { line(c, ax + dx, ay, ax + dx, ay - 78, OUT, 5); line(c, ax + dx, ay, ax + dx, ay - 78, WOOD.base, 3); }
    frect(c, ax - 18, ay - 76, 36, 58, '#c8a46a'); frect(c, ax - 18, ay - 76, 36, 4, '#e2c48a'); frect(c, ax + 12, ay - 76, 6, 58, 'rgba(90,50,20,.2)'); srect(c, ax - 18, ay - 76, 36, 58, OUT, 1.6);
    txtV(c, '草隠れ', ax, ay - 74, 15, '#2a1a10', { weight: '900' });
    const rp = pathFrom([[ax - 26, ay - 78], [ax, ay - 94], [ax + 26, ay - 78], [ax + 22, ay - 74], [ax - 22, ay - 74]]);
    thatchFace(c, rp, { x: ax - 28, y: ay - 96, w: 56, h: 24 }, STRAWS[0], { seed: 77, course: 10 });
  }
  function vegPlot(c, ax, ay, seed) { // fenced kitchen garden, 200 x 120, anchor at the front centre
    const R = rng(seed), x0 = ax - 100, y0 = ay - 112;
    frect(c, x0, y0 + 10, 200, 96, '#6a4c30');
    for (let r = 0; r < 7; r++) {
      const yy = y0 + 18 + r * 13;
      frect(c, x0 + 4, yy, 192, 5, '#57391f'); frect(c, x0 + 4, yy + 5, 192, 2, '#8e6c46');
      const kind = (r + seed) % 4;
      for (let x = x0 + 10 + (r % 2) * 6; x < x0 + 194; x += 12) {
        if (kind === 0) { fell(c, x, yy, 5.5, 3.8, '#5a9a3a'); fell(c, x - 1, yy - 1, 3, 1.8, '#a2d470'); }
        else if (kind === 1) { line(c, x, yy + 2, x - 2, yy - 9, '#4f8a34', 1.7); line(c, x, yy + 2, x + 3, yy - 10, '#6aa844', 1.7); }
        else if (kind === 2) { fell(c, x, yy, 6, 4, '#47873a'); if (R() < .4) fell(c, x + 2, yy + 1, 2.2, 2.8, '#6a3a8a'); }
        else { line(c, x, yy + 3, x, yy - 12, '#8a7a4a', 1.2); fell(c, x, yy - 4, 4.5, 4, '#5c9440'); if (R() < .5) fell(c, x - 1, yy - 2, 2, 2, '#d8402a'); }
      }
    }
    const fence = (yy) => { for (let x = x0; x <= x0 + 200; x += 25) { line(c, x, yy, x, yy - 24, OUT, 4.4); line(c, x, yy, x, yy - 24, '#b8a86a', 2.6); } for (const dy of [-18, -8]) { line(c, x0 - 4, yy + dy, x0 + 204, yy + dy, OUT, 4); line(c, x0 - 4, yy + dy, x0 + 204, yy + dy, '#c8b878', 2.4); } };
    fence(y0 + 12);
    for (const x of [x0, x0 + 200]) for (let yy = y0 + 14; yy < ay; yy += 22) { line(c, x, yy, x, yy - 20, OUT, 4.2); line(c, x, yy, x, yy - 20, '#b8a86a', 2.4); }
    fence(ay);
  }
  function reeds(c, ax, ay, seed) {
    const R = rng(seed);
    for (let i = 0; i < 10; i++) { const dx = (R() - .5) * 30, h = 30 + R() * 30, l = (R() - .5) * 10; c.beginPath(); c.moveTo(ax + dx, ay); c.quadraticCurveTo(ax + dx, ay - h * .6, ax + dx + l, ay - h); sk(c, R() < .5 ? '#4f7f30' : '#6e9e40', 1.8); }
    for (let i = 0; i < 4; i++) { const dx = (R() - .5) * 22, h = 44 + R() * 18; line(c, ax + dx, ay, ax + dx + 1, ay - h, '#5a7a34', 1.4); fell(c, ax + dx + 1, ay - h + 6, 2.6, 7, '#6a4428'); c.beginPath(); c.ellipse(ax + dx + 1, ay - h + 6, 2.6, 7, 0, 0, TAU); sk(c, OUT, .8); }
  }
  function kagaribi(c, ax, ay) { // fire basket on a tripod
    shadowEl(c, ax + 5, ay, 14, 4);
    for (const dx of [-10, 0, 10]) { line(c, ax + dx, ay, ax - dx * .2, ay - 46, OUT, 4.2); line(c, ax + dx, ay, ax - dx * .2, ay - 46, '#4a3a2a', 2.4); }
    fpoly(c, [ax - 11, ay - 56, ax + 11, ay - 56, ax + 7, ay - 44, ax - 7, ay - 44], '#3a3430'); poly(c, [ax - 11, ay - 56, ax + 11, ay - 56, ax + 7, ay - 44, ax - 7, ay - 44]); sk(c, OUT, 1.2);
    fpoly(c, [ax - 9, ay - 56, ax - 4, ay - 72, ax - 1, ay - 63, ax + 3, ay - 76, ax + 9, ay - 56], '#f08a2a');
    fpoly(c, [ax - 5, ay - 56, ax, ay - 68, ax + 5, ay - 56], '#ffd86a');
  }
  // horizontal palisade segment (104 px), sharpened log stakes lashed with rope
  function palisadeH(c, ax, ay, seed) {
    const R = rng(seed);
    fell(c, ax + 52, ay + 3, 60, 7, 'rgba(28,50,18,.3)');
    line(c, ax - 2, ay - 40, ax + 106, ay - 40, OUT, 7); line(c, ax - 2, ay - 40, ax + 106, ay - 40, WOOD.dark, 5);
    for (let i = 0; i < 8; i++) {
      const x = ax + 6.5 + i * 13, h = 64 + R() * 18, w = 6.2 + R() * .8, col = R() < .5 ? '#8a6440' : '#7a5636';
      const p = pathFrom([[x - w, ay], [x - w, ay - h], [x, ay - h - 11], [x + w, ay - h], [x + w, ay]]);
      celFill(c, p, col, mix(col, '#fff2cc', .3), mix(col, '#2a1a08', .35), { ld: 3, dd: 4 });
      c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(p);
      fpoly(c, [x - w + 1, ay - h, x, ay - h - 10, x, ay - h + 2], '#c8a070');
      if (R() < .3) fell(c, x - 1, ay - h * .4, 2, 3, '#4a3020');
      if (R() < .25) fell(c, x, ay - 6, 5, 3, '#6e8a3a');
    }
    for (const yy of [ay - 22, ay - 52]) { line(c, ax, yy, ax + 104, yy + 1, '#3a2a18', 3.4); line(c, ax, yy - .8, ax + 104, yy + .2, '#c8ac6a', 1.6); for (let x = ax + 6; x < ax + 104; x += 13) line(c, x - 2, yy - 3, x + 2, yy + 3, '#8a6a3a', 1.4); }
  }
  // vertical palisade segment (104 px along y), seen end-on
  function palisadeV(c, ax, ay, seed) {
    const R = rng(seed);
    fell(c, ax + 14, ay - 52, 14, 56, 'rgba(28,50,18,.26)');
    for (let i = 0; i < 9; i++) {
      const y = ay - 104 + i * 13, h = 64 + R() * 18, col = R() < .5 ? '#8a6440' : '#7a5636';
      const p = pathFrom([[ax - 7, y], [ax - 7, y - h], [ax, y - h - 10], [ax + 7, y - h], [ax + 7, y]]);
      celFill(c, p, col, mix(col, '#fff2cc', .3), mix(col, '#2a1a08', .35), { ld: 3, dd: 4 });
      c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(p);
      fell(c, ax, y + 1, 7, 2.6, mix(col, '#2a1a08', .2));
    }
    for (const hh of [22, 52]) { line(c, ax - 7, ay - 104 - hh, ax - 7, ay - hh, '#3a2a18', 2.6); line(c, ax + 7, ay - 104 - hh, ax + 7, ay - hh, '#3a2a18', 2.6); }
  }
  // south gate: two great posts, a tie beam and a thatched roof with the crest plaque
  function gateSprite(c, ax, ay) {
    const T = STRAWS[0];
    for (const dx of [-118, 118]) {
      shadowEl(c, ax + dx + 10, ay + 2, 22, 7);
      fell(c, ax + dx, ay - 4, 18, 7, '#8f8a7c'); c.beginPath(); c.ellipse(ax + dx, ay - 4, 18, 7, 0, 0, TAU); sk(c, OUT, 1.2);
      const p = new Path2D(); p.rect(ax + dx - 12, ay - 196, 24, 192);
      celFill(c, p, '#7a5232', '#a07448', '#553620', { ld: 5, dd: 6 }); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
      for (const yy of [ay - 40, ay - 150]) line(c, ax + dx - 12, yy, ax + dx + 12, yy, '#3a2a18', 3);
      // hedge wing
      bush(c, ax + dx + (dx < 0 ? -40 : 40), ay + 8, 1.2, 900 + dx, LEAF);
    }
    for (const yy of [ay - 168, ay - 138]) { const p = new Path2D(); p.rect(ax - 140, yy - 9, 280, 18); celFill(c, p, '#6e4a2c', '#94683e', '#4a3020', { ld: 3, dd: 4 }); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(p); }
    hipRoof(c, { x0: ax - 168, x1: ax + 168, yr: ay - 252, yb: ay - 226, ye: ay - 176, hip: 54, th: 16, T, seed: 811, moss: 6, sod: true });
    // plaque
    frect(c, ax - 24, ay - 160, 48, 66, '#2a1e16'); frect(c, ax - 20, ay - 156, 40, 58, '#3a2a1e'); srect(c, ax - 24, ay - 160, 48, 66, '#c8a040', 2);
    kusaMark(c, ax, ay - 140, 10, '#e8c860');
    txtV(c, '草隠', ax, ay - 126, 13, '#e8c860', { weight: '900' });
    chochin(c, ax - 80, ay - 112, 1.3, '#e0dccc', '草'); chochin(c, ax + 80, ay - 112, 1.3, '#e0dccc', '草');
  }
  function booth(c, ax, ay) {
    shadowEl(c, ax + 10, ay, 52, 10);
    const P = { wood: WOOD, plaster: PLASTER[0], seed: 31, noren: '#3c6b3a' };
    const w = houseWall(c, ax - 44, ax + 44, ay - 66, ay, P, { bays: 2, kh: 20 });
    koshi(c, ax - 36, w.wt, 28, w.wb - w.wt, WOOD); doorway(c, ax + 6, w.wt - 4, 30, w.fy - w.wt + 4, P);
    hipRoof(c, { x0: ax - 58, x1: ax + 58, yr: ay - 122, yb: ay - 104, ye: ay - 62, hip: 34, th: 12, T: STRAWS[1], seed: 821, moss: 3 });
    chochin(c, ax - 2, ay - 52, 1, '#d0502e');
  }
  function bridgeSprite(c, ax, ay, w, len, rails) { // N-S wooden bridge, anchor at the south end centre
    const x0 = ax - w / 2, y0 = ay - len;
    fell(c, ax + 8, ay - len / 2 + 6, w / 2 + 14, len / 2 + 4, 'rgba(20,40,40,.28)');
    for (const dx of [-w / 2 + 8, w / 2 - 8]) for (const yy of [y0 + 24, ay - 18]) { line(c, ax + dx, yy, ax + dx, yy + 14, OUT, 6); line(c, ax + dx, yy, ax + dx, yy + 14, WOOD.dark, 4); }
    frect(c, x0, y0, w, len, WOOD.base);
    for (let yy = y0; yy < ay; yy += 9) { frect(c, x0, yy, w, 8, (yy / 9) % 2 < 1 ? '#a07448' : '#94683e'); frect(c, x0, yy + 7, w, 1.5, 'rgba(50,30,15,.45)'); }
    fell(c, ax, y0 + len * .5, w * .4, len * .3, 'rgba(255,240,200,.12)');
    frect(c, x0, y0, 7, len, WOOD.dark); frect(c, x0 + w - 7, y0, 7, len, WOOD.dark);
    srect(c, x0, y0, w, len, OUT, 1.8);
    if (rails) for (const x of [x0 + 3, x0 + w - 3]) {
      for (let yy = y0 + 6; yy <= ay; yy += 26) { line(c, x, yy, x, yy - 24, OUT, 5.5); line(c, x, yy, x, yy - 24, WOODL.base, 3.5); }
      line(c, x, y0 - 18, x, ay - 24, OUT, 6); line(c, x, y0 - 18, x, ay - 24, WOODL.light, 3.6);
      for (const yy of [y0 - 22, ay - 28]) { fell(c, x, yy, 4.5, 4.5, '#c8a040'); c.beginPath(); c.arc(x, yy, 4.5, 0, TAU); sk(c, OUT, 1); }
    }
  }
  function pier(c, ax, ay) {
    fell(c, ax + 6, ay + 4, 40, 8, 'rgba(20,40,40,.25)');
    for (const [dx, dy] of [[-26, 0], [26, 0], [-26, -50], [26, -50]]) { line(c, ax + dx, ay + dy - 6, ax + dx, ay + dy + 10, OUT, 6); line(c, ax + dx, ay + dy - 6, ax + dx, ay + dy + 10, WOOD.dark, 4); }
    frect(c, ax - 30, ay - 64, 60, 64, '#a07448');
    for (let x = ax - 30; x < ax + 30; x += 10) frect(c, x + 9, ay - 64, 1.4, 64, 'rgba(50,30,15,.45)');
    srect(c, ax - 30, ay - 64, 60, 64, OUT, 1.6);
    bucket(c, ax + 14, ay - 12);
  }

  // ------------------------------------------------------------------ tiles and decals
  function makeGrassTile() {
    const S = 512, cv = mk(S, S), c = cv.getContext('2d'), R = rng(1301);
    c.lineCap = 'round';
    frect(c, 0, 0, S, S, '#679a42');
    for (let i = 0; i < 46; i++) {
      const x = R() * S, y = R() * S, rx = 30 + R() * 90, ry = rx * (.4 + R() * .3), col = R() < .5 ? 'rgba(150,196,90,.20)' : 'rgba(60,110,40,.16)';
      wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, ry, col));
    }
    const pD = new Path2D(), pM = new Path2D(), pL = new Path2D();
    for (let i = 0; i < 5200; i++) {
      const x = R() * S, y = R() * S, h = 3 + R() * 6, l = (R() - .5) * 3, k = R();
      const p = k < .42 ? pD : k < .78 ? pM : pL;
      for (const [X, Y] of [[x, y], [x - S, y], [x, y - S], [x - S, y - S]]) { if (X < -10 || Y < -10) continue; p.moveTo(X, Y); p.lineTo(X + l, Y - h); }
    }
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(46,92,30,.55)'; c.stroke(pD);
    c.lineWidth = 1.3; c.strokeStyle = 'rgba(120,170,70,.55)'; c.stroke(pM);
    c.lineWidth = 1.1; c.strokeStyle = 'rgba(190,226,130,.55)'; c.stroke(pL);
    for (let i = 0; i < 40; i++) { // clover
      const x = R() * S, y = R() * S;
      wrapDraw(S, x, y, 14, (X, Y) => { for (let k = 0; k < 5; k++) { const dx = (R() - .5) * 18, dy = (R() - .5) * 9; for (let j = 0; j < 3; j++) { const a = j / 3 * TAU - Math.PI / 2; fell(c, X + dx + Math.cos(a) * 2.2, Y + dy + Math.sin(a) * 1.8, 2, 1.6, '#4f8a34'); } fell(c, X + dx - .6, Y + dy - .8, 1, .8, '#86bc5a'); } });
    }
    for (let i = 0; i < 70; i++) { // tiny wildflowers
      const x = R() * S, y = R() * S, col = FLOWER[Math.floor(R() * FLOWER.length)];
      wrapDraw(S, x, y, 6, (X, Y) => { for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; fell(c, X + Math.cos(a) * 1.7, Y + Math.sin(a) * 1.4, 1.3, 1.1, col); } fell(c, X, Y, .9, .8, '#e8a020'); });
    }
    c.fillStyle = 'rgba(40,80,25,.25)'; for (let i = 0; i < 1400; i++) c.fillRect(R() * S, R() * S, 1.4, 1.4);
    c.fillStyle = 'rgba(210,240,160,.25)'; for (let i = 0; i < 900; i++) c.fillRect(R() * S, R() * S, 1.2, 1.2);
    return cv;
  }
  function makeThicketTile() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(1402);
    frect(c, 0, 0, S, S, '#2a4a22');
    for (let i = 0; i < 260; i++) {
      const x = R() * S, y = R() * S, r = 6 + R() * 8, k = R();
      wrapDraw(S, x, y, r + 4, (X, Y) => {
        fell(c, X, Y, r + 2, r * .8 + 2, '#1a2e14');
        fell(c, X, Y, r, r * .8, k < .5 ? '#2f5427' : '#3a622e');
        fell(c, X - r * .2, Y - r * .25, r * .62, r * .45, k < .5 ? '#437536' : '#4e853a');
        fell(c, X - r * .35, Y - r * .4, r * .25, r * .16, '#74a650');
      });
    }
    // fallen bamboo leaves and blades
    const pL = new Path2D(), pD = new Path2D();
    for (let i = 0; i < 700; i++) {
      const x = R() * S, y = R() * S, a = R() * TAU, l = 6 + R() * 8, p = R() < .5 ? pL : pD;
      for (const [X, Y] of [[x, y], [x - S, y], [x, y - S], [x - S, y - S]]) { if (X < -16 || Y < -16) continue; p.moveTo(X, Y); p.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l * .6); }
    }
    c.lineCap = 'round'; c.lineWidth = 2.2; c.strokeStyle = 'rgba(120,170,70,.45)'; c.stroke(pL); c.strokeStyle = 'rgba(15,30,10,.45)'; c.stroke(pD);
    return cv;
  }
  function makeDirtTile(base, seed) {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(seed);
    frect(c, 0, 0, S, S, base);
    for (let i = 0; i < 40; i++) { const x = R() * S, y = R() * S, rx = 14 + R() * 40, col = R() < .5 ? 'rgba(230,200,150,.22)' : 'rgba(110,80,45,.14)'; wrapDraw(S, x, y, rx, (X, Y) => fell(c, X, Y, rx, rx * .5, col)); }
    for (let i = 0; i < 80; i++) { const x = R() * S, y = R() * S, r = 1.2 + R() * 2.6; wrapDraw(S, x, y, 6, (X, Y) => { fell(c, X + .7, Y + .8, r, r * .7, 'rgba(80,60,35,.6)'); fell(c, X, Y, r, r * .7, R() < .5 ? '#a8987e' : '#c0ae8c'); fell(c, X - r * .3, Y - r * .3, r * .4, r * .3, '#e6dcc4'); }); }
    c.fillStyle = 'rgba(90,64,36,.25)'; for (let i = 0; i < 900; i++) c.fillRect(R() * S, R() * S, 1.4, 1.4);
    c.fillStyle = 'rgba(255,240,210,.25)'; for (let i = 0; i < 500; i++) c.fillRect(R() * S, R() * S, 1.2, 1.2);
    return cv;
  }
  function makeEmblem() {
    const W = 460, H = 330, cv = mk(W, H), c = cv.getContext('2d');
    c.translate(W / 2, H / 2); c.scale(1, .7);
    c.beginPath(); c.arc(0, 0, 210, 0, TAU); c.fillStyle = 'rgba(80,110,50,.22)'; c.fill();
    c.beginPath(); c.arc(0, 0, 210, 0, TAU); sk(c, 'rgba(70,90,45,.6)', 12);
    c.beginPath(); c.arc(0, 0, 198, 0, TAU); sk(c, 'rgba(240,230,190,.55)', 3);
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; fell(c, Math.cos(a) * 172, Math.sin(a) * 172, 10, 10, 'rgba(110,130,80,.45)'); }
    kusaMark(c, 0, -6, 110, 'rgba(60,100,45,.62)', { stroke: 'rgba(40,60,30,.55)', sw: 8 });
    kusaMark(c, -4, -12, 80, 'rgba(160,200,110,.3)');
    return cv;
  }
  function makeDecals() {
    const D = {};
    D.meadow = [0, 1, 2].map(i => {
      const W = 320, H = 190, cv = mk(W, H), c = cv.getContext('2d'), R = rng(1500 + i);
      for (let k = 0; k < 7; k++) {
        const x = 70 + R() * 180, y = 50 + R() * 90, rx = 50 + R() * 50, ry = rx * .55;
        const g = c.createRadialGradient(x, y, 4, x, y, rx);
        g.addColorStop(0, i === 2 ? 'rgba(200,214,110,.45)' : 'rgba(150,200,90,.42)'); g.addColorStop(1, 'rgba(150,200,90,0)');
        c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = g; c.beginPath(); c.arc(x, y, rx, 0, TAU); c.fill(); c.restore();
      }
      for (let k = 0; k < 26; k++) { const x = 60 + R() * 200, y = 40 + R() * 110, col = FLOWER[(k + i) % FLOWER.length]; for (let j = 0; j < 5; j++) { const a = j / 5 * TAU; fell(c, x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.5, 1.3, 1.1, col); } fell(c, x, y, .9, .8, '#e8a020'); }
      return cv;
    });
    D.flowers = [0, 1, 2, 3, 4].map(i => sprite(80, 44, 40, 26, (c, ax, ay) => {
      const cols = [[FLOWER[0], FLOWER[1]], [FLOWER[2], FLOWER[0]], [FLOWER[3], FLOWER[5]], [FLOWER[1], FLOWER[4]], [FLOWER[2], FLOWER[3], FLOWER[0]]][i];
      flowerBunch(c, ax - 10, ay, 1600 + i, 6, cols); flowerBunch(c, ax + 12, ay + 4, 1610 + i, 5, cols);
    }));
    D.edge = [0, 1, 2].map(i => sprite(30, 22, 15, 18, (c, ax, ay) => {
      const R = rng(1700 + i);
      for (let k = 0; k < 7; k++) { const dx = (R() - .5) * 18, h = 6 + R() * 9; line(c, ax + dx, ay, ax + dx + (R() - .5) * 5, ay - h, k % 2 ? '#4a7e2e' : '#78ac48', 1.6); }
    }));
    D.stone = [0, 1].map(i => sprite(44, 28, 22, 16, (c, ax, ay) => { fell(c, ax + 2, ay + 2, 16 - i * 3, 8 - i, 'rgba(30,40,20,.3)'); fell(c, ax, ay, 16 - i * 3, 8 - i, '#a8a492'); fell(c, ax - 3, ay - 2, 9 - i * 2, 4, '#c8c4b2'); c.beginPath(); c.ellipse(ax, ay, 16 - i * 3, 8 - i, 0, 0, TAU); sk(c, 'rgba(59,52,40,.6)', 1); }));
    D.lily = [0, 1, 2].map(i => sprite(44, 28, 22, 14, (c, ax, ay) => {
      const r = 13 - i * 2;
      c.beginPath(); c.moveTo(ax, ay); c.ellipse(ax, ay, r, r * .55, 0, .3, TAU - .1); c.closePath(); c.fillStyle = '#4f8a34'; c.fill(); sk(c, '#2a4a1e', 1);
      c.beginPath(); c.ellipse(ax - 2, ay - 1, r * .6, r * .3, 0, 0, TAU); c.fillStyle = 'rgba(150,200,90,.45)'; c.fill();
      if (i === 1) { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; fell(c, ax + 3 + Math.cos(a) * 3, ay - 3 + Math.sin(a) * 2, 2.4, 1.6, '#f6c6d6'); } fell(c, ax + 3, ay - 3, 1.4, 1.2, '#f2d24a'); }
    }));
    return D;
  }

  // ------------------------------------------------------------------ ambient sprites
  function makeAmbient() {
    const Am = {};
    // tall-grass tufts: 3 shapes x (normal, wind-lit) x 5 lean frames
    Am.tufts = [0, 1, 2].map(k => [0, 1].map(b => [-1, -.5, 0, .5, 1].map(l => sprite(70, 64, 35, 58, (c, ax, ay) => tuftDraw(c, ax, ay, 1 + k * .12, l * .55, b === 1, 4000 + k * 13)))));
    Am.petals = [];
    const pc = ['#f6c6d6', '#fbf6e8', '#f2d24a', '#86bc4a'];
    for (let i = 0; i < 4; i++) for (let f = 0; f < 4; f++) Am.petals.push(sprite(12, 12, 6, 6, (c, ax, ay) => {
      c.translate(ax, ay); c.rotate(f * Math.PI / 4 + i); c.scale(1, f % 2 ? .5 : 1);
      if (i === 3) { c.beginPath(); c.moveTo(-5, 0); c.quadraticCurveTo(0, -3.5, 5, 0); c.quadraticCurveTo(0, 3.5, -5, 0); c.fillStyle = pc[i]; c.fill(); line(c, -5, 0, 5, 0, '#4a7a2a', .8); }
      else { fell(c, 0, 0, 3.4, 2.2, pc[i]); fell(c, -1, -.6, 1.4, .8, '#ffffff'); }
    }));
    const bc = [['#f2d24a', '#2a2010'], ['#fbfaf2', '#3a3a3a'], ['#e8823a', '#2a1a10'], ['#8ab0f0', '#1a2a4a']];
    Am.flies = bc.map(([w, b]) => [0, 1].map(f => sprite(18, 14, 9, 7, (c, ax, ay) => {
      const s = f ? .35 : 1;
      for (const sd of [-1, 1]) { fell(c, ax + sd * 4.2 * s, ay - 1.5, 4.2 * s + .5, 3.4, w); fell(c, ax + sd * 3.2 * s, ay + 2.4, 3 * s + .4, 2.2, w); c.beginPath(); c.ellipse(ax + sd * 4.2 * s, ay - 1.5, 4.2 * s + .5, 3.4, 0, 0, TAU); sk(c, 'rgba(40,30,20,.6)', .7); }
      line(c, ax, ay - 3, ax, ay + 4, b, 1.6);
    })));
    return Am;
  }

  // ------------------------------------------------------------------ layout
  const VARS = {
    minka: { fn: vMinka, w: 340, h: 320 }, gassho: { fn: vGassho, w: 320, h: 320 }, kabuto: { fn: vKabuto, w: 340, h: 320 },
    granary: { fn: vGranary, w: 340, h: 300 }, nagaya: { fn: vNagaya, w: 350, h: 320 }, garden: { fn: vGarden, w: 340, h: 320 }, mill: { fn: vMill, w: 340, h: 310 }
  };
  // [cell x, cell y, variant, offset x, offset y, straw, plaster, wood, noren, moss, sod]
  const HOUSES = [
    [1, 1, 'minka', 70, 80, 0, 0, 0, 0, 6, 0], [2, 1, 'gassho', 80, 86, 1, 2, 1, 1, 10, 0], [4, 1, 'granary', 90, 90, 2, 1, 0, 2, 3, 0], [5, 1, 'kabuto', 80, 82, 3, 3, 2, 3, 12, 1],
    [1, 2, 'nagaya', 60, 72, 4, 0, 1, 4, 8, 0], [2, 2, 'minka', 70, 80, 5, 2, 2, 1, 14, 1], [5, 2, 'gassho', 90, 76, 0, 1, 0, 5, 4, 0],
    [1, 3, 'kabuto', 70, 84, 1, 2, 1, 0, 6, 0], [4, 3, 'garden', 100, 80, 2, 0, 2, 3, 9, 0],
    [1, 4, 'mill', 70, 130, 3, 1, 1, 2, 10, 0], [2, 4, 'granary', 70, 130, 4, 3, 0, 5, 12, 1], [5, 4, 'minka', 80, 140, 1, 1, 0, 4, 5, 1],
    [1, 5, 'gassho', 90, 76, 5, 0, 2, 3, 14, 0], [4, 5, 'nagaya', 70, 76, 0, 2, 1, 1, 6, 0]
  ];
  const LANES_H = [1000, 1535, 2595, 3110], LANES_V = [1040, 2600];
  const STREAM_A = [[110, 2146], [180, 2138], [420, 2160], [700, 2142], [980, 2162], [1240, 2140], [1500, 2160], [1700, 2146], [1900, 2152], [2040, 2186], [2130, 2262], [2200, 2330]];
  const STREAM_B = [[2500, 2320], [2600, 2244], [2700, 2160], [2900, 2148], [3100, 2160], [3300, 2150], [3520, 2156]];
  const SW = 62;

  function wobble(pts, amp, seed, step = 24) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(L / step)), nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
      for (let k = 0; k < n; k++) { const t = k / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, s = x * .7 + y * 1.3, o = amp * (Math.sin(s * .011 + seed) * .6 + Math.sin(s * .027 + seed * 2.3) * .4); out.push([x + nx * o, y + ny * o]); }
    }
    out.push(pts[pts.length - 1]); return out;
  }
  function smoothPath(pts) {
    const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const l = pts[pts.length - 1]; p.lineTo(l[0], l[1]); return p;
  }
  function segDist(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1; let t = ((px - x1) * dx + (py - y1) * dy) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - x1 - dx * t, py - y1 - dy * t); }
  function inEll(x, y, E, m) { const dx = (x - E.x) / (E.rx + m), dy = (y - E.y) / (E.ry + m); return dx * dx + dy * dy < 1; }

  // ------------------------------------------------------------------ state
  const A = {};
  let ready = false;
  const foots = [], objs = [], decals = [], lanternsLocal = [];
  const PATHS = [], SEGS = [], STREAMS = [], GLINTS = [];
  let TUFTS = null;             // ambient tall grass, bucketed per 520 cell
  let BAND = null, INNER = null, OUTER = null, GRASS = null;
  const NOTCH = [[126, 3240], [130, 3400], [144, 3520], [168, 3610], [198, 3690], [220, 3830]];   // gate notch half-width by y
  const notchHalf = y => { if (y <= NOTCH[0][1]) return NOTCH[0][0]; for (let i = 1; i < NOTCH.length; i++) if (y <= NOTCH[i][1]) { const [a, ya] = NOTCH[i - 1], [b, yb] = NOTCH[i]; return a + (b - a) * (y - ya) / (yb - ya); } return NOTCH[NOTCH.length - 1][0]; };

  function buildingCanvas(fn, P, w, h) {
    const cv = mk(w + SM * 2, h + OVER + BM), c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(SM, OVER);
    fn(c, P);
    return cv;
  }

  function build() {
    const tmp = mk(4, 4).getContext('2d');
    A.grassPat = tmp.createPattern(makeGrassTile(), 'repeat');
    A.thicketPat = tmp.createPattern(makeThicketTile(), 'repeat');
    A.dirtPat = tmp.createPattern(makeDirtTile('#b08a5a', 1801), 'repeat');
    A.plazaPat = tmp.createPattern(makeDirtTile('#c4a376', 1802), 'repeat');
    A.emblem = makeEmblem();
    A.dec = makeDecals();
    A.amb = makeAmbient();

    foots.length = 0; objs.length = 0; decals.length = 0; lanternsLocal.length = 0;
    PATHS.length = 0; SEGS.length = 0; STREAMS.length = 0; GLINTS.length = 0;
    const addFoot = f => { foots.push(f); return foots.length - 1; };
    const addLamp = (x, y) => lanternsLocal.push({ x: Math.round(x), y: Math.round(y) });
    const put = (s, x, y, fi = -1) => objs.push({ img: s.cv, x: Math.round(x - s.ax), y: Math.round(y - s.ay), w: s.cv.width, h: s.cv.height, by: y, fi });

    // ---- boundary hedge: one solid footprint per perimeter cell (gate cell (3,6) left open)
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      if (cx > 0 && cx < NC - 1 && cy > 0 && cy < NC - 1) continue;
      if (cx === 3 && cy === NC - 1) continue;
      const gx = cx * BLOCK, gy = cy * BLOCK;
      let f;
      if ((cx === 0 || cx === NC - 1) && (cy === 0 || cy === NC - 1)) f = { x: gx, y: gy, w: BLOCK, h: BLOCK };
      else if (cy === 0) f = { x: gx, y: 0, w: BLOCK, h: WIN };
      else if (cy === NC - 1) f = { x: gx, y: WOUT, w: BLOCK, h: WIN };
      else if (cx === 0) f = { x: 0, y: gy, w: WIN, h: BLOCK };
      else f = { x: WOUT, y: gy, w: WIN, h: BLOCK };
      Object.assign(f, { solid: true, roof: '#2f5a2a', wall: '#7a5636' });
      addFoot(f);
    }
    // inner edge of the hedge (with the gate notch) and the band region
    {
      const nE = x => 410 + 12 * wv(x, 1), sE = x => 3230 - 12 * wv(x, 2), wE = y => 410 + 12 * wv(y, 3), eE = y => 3230 - 12 * wv(y, 4);
      const pts = [];
      for (let x = 430; x <= 3210; x += 20) pts.push([x, nE(x)]);
      for (let y = 430; y <= 3210; y += 20) pts.push([eE(y), y]);
      for (let x = 3210; x >= 1950; x -= 20) pts.push([x, sE(x)]);
      // gate notch: the hedge ends flare away from the road so they can be rounded off with bushes
      for (const [dx, y] of NOTCH) pts.push([1820 + dx, y]);
      for (let i = NOTCH.length - 1; i >= 0; i--) pts.push([1820 - NOTCH[i][0], NOTCH[i][1]]);
      for (let x = 1690; x >= 430; x -= 20) pts.push([x, sE(x)]);
      for (let y = 3210; y >= 430; y -= 20) pts.push([wE(y), y]);
      INNER = pathFrom(pts);
      BAND = new Path2D(); BAND.rect(-400, -400, SIZE + 800, SIZE + 800); BAND.addPath(INNER);
      // blobby outer silhouette 18..140 px beyond the square (the wilderness shows past it); full depth at the gate road
      const off = (t, s) => Math.max(18, Math.min(140, 76 + 36 * Math.sin(t * .0121 + s) + 22 * Math.sin(t * .033 + s * 2.1) + 13 * Math.sin(t * .077 + s * 3.7)));
      const op = [];
      for (let x = 0; x <= SIZE; x += 16) op.push([x, -off(x, 1)]);
      op.push([SIZE + off(0, 5) * .72, -off(SIZE, 1) * .72]);
      for (let y = 0; y <= SIZE; y += 16) op.push([SIZE + off(y, 2), y]);
      op.push([SIZE + off(SIZE, 2) * .72, SIZE + off(SIZE, 3) * .72]);
      for (let x = SIZE; x >= 0; x -= 16) { const g = Math.abs(x - 1820); op.push([x, SIZE + (g < 260 ? Math.max(off(x, 3), 150 - Math.max(0, g - 120) * .9) : off(x, 3))]); }
      op.push([-off(SIZE, 4) * .72, SIZE + off(0, 3) * .72]);
      for (let y = SIZE; y >= 0; y -= 16) op.push([-off(y, 4), y]);
      op.push([-off(0, 4) * .72, -off(0, 1) * .72]);
      OUTER = pathFrom(op);
      // grass of the village floor; in the gate notch it tapers into the arriving road
      GRASS = pathFrom([[-10, -10], [SIZE + 10, -10], [SIZE + 10, 3600], [2010, 3600], [1968, 3612], [1950, 3640], [1928, 3662], [1910, 3690], [1730, 3690], [1712, 3664], [1690, 3638], [1672, 3612], [1630, 3600], [-10, 3600]]);
    }

    // ---- leader's hall
    {
      const P = { lamps: [], seed: 400, wood: WOODR, plaster: '#e8dab6', noren: '#3c6b3a' };
      const cv = buildingCanvas(lmHall, P, HALL.w, HALL.h);
      const fi = addFoot({ x: HALL.x, y: HALL.y, w: HALL.w, h: HALL.h, roof: '#c6a25a', wall: '#6e3a26' });
      objs.push({ img: cv, x: HALL.x - SM, y: HALL.y - OVER, w: cv.width, h: cv.height, by: HALL.y + HALL.h, fi });
      for (const [lx, ly] of P.lamps) addLamp(HALL.x + lx, HALL.y + ly);
    }
    // ---- sacred tree (solid)
    {
      addFoot({ x: TREE.x, y: TREE.y, w: TREE.w, h: TREE.h, solid: true, roof: '#3d6a2c', wall: '#6e4c30' });
      put(sprite(640, 600, 320, 560, (c, ax, ay) => sacredTree(c, ax, ay)), TREE_A.x, TREE_A.y);
    }
    // ---- houses (one cached canvas per distinct look)
    const cache = {}, doors = [];
    HOUSES.forEach(([cx, cy, key, ox, oy, si, pi, wi, ni, mo, so], idx) => {
      const V = VARS[key], ck = HOUSES.slice(0, idx).find(h => h[2] === key && h[5] === si && h[6] === pi && h[7] === wi && h[8] === ni) ? key + si + pi + wi + ni : key + idx;
      if (!cache[ck]) {
        const P = { T: STRAWS[si], si, plaster: PLASTER[pi], wood: WOODS[wi], noren: NOREN[ni], moss: mo, sod: !!so, seed: 100 + idx * 37, lamps: [], door: V.w / 2 };
        cache[ck] = { cv: buildingCanvas(V.fn, P, V.w, V.h), lamps: P.lamps, door: P.door, roof: P.T.base, wall: P.plaster };
      }
      const e = cache[ck], x = cx * BLOCK + ox, y = cy * BLOCK + oy;
      const fi = addFoot({ x, y, w: V.w, h: V.h, roof: e.roof, wall: e.wall });
      objs.push({ img: e.cv, x: x - SM, y: y - OVER, w: e.cv.width, h: e.cv.height, by: y + V.h, fi });
      for (const [lx, ly] of e.lamps) addLamp(x + lx, y + ly);
      doors.push([x + e.door, y + V.h - 4]);
    });

    // ---- paths
    const addPath = (pts, w, kind, amp = 9, seed = 1) => {
      const wp = amp ? wobble(pts, amp, seed) : pts;
      PATHS.push({ p: smoothPath(wp), w, kind, pts: wp });
      for (let i = 0; i < wp.length - 1; i++) SEGS.push([wp[i][0], wp[i][1], wp[i + 1][0], wp[i + 1][1], w / 2]);
    };
    addPath([[1820, 3600], [1820, 3300], [1824, 2700], [1818, 2300], [1820, 1900]], 176, 'road', 6, 2);
    addPath([[380, 1540], [1000, 1530], [1500, 1538], [1820, 1530], [2200, 1528], [2640, 1532], [3260, 1540]], 104, 'lane', 15, 3);
    addPath([[380, 1000], [1040, 995], [1820, 1004], [2600, 996], [3260, 1000]], 62, 'foot', 22, 4);
    addPath([[380, 2596], [1040, 2590], [1820, 2598], [2600, 2590], [3260, 2596]], 62, 'foot', 22, 5);
    addPath([[380, 3110], [1040, 3104], [1820, 3112], [2600, 3104], [3260, 3110]], 54, 'foot', 18, 6);
    addPath([[1040, 994], [1036, 1530], [1046, 2158], [1038, 2590], [1040, 3104]], 70, 'lane', 16, 7);
    addPath([[2600, 996], [2604, 1530], [2596, 2244], [2602, 2590], [2600, 3104]], 70, 'lane', 16, 8);
    for (const [dx, dy] of doors) {
      const below = LANES_H.find(ly => ly > dy - 4);
      if (below !== undefined && below - dy < 200) addPath([[dx, dy], [dx, below]], 44, 'foot', 0);
      else { const lx = LANES_V.reduce((a, b) => Math.abs(b - dx) < Math.abs(a - dx) ? b : a); addPath([[dx, dy], [dx, dy + 48], [lx, dy + 48]], 44, 'foot', 0); }
    }
    addPath([[1820, 3540], [1820, 3700], [1820, 3810]], 148, 'road', 0);   // narrows to the width of the world road it joins
    // ---- stream + bridges
    for (const s of [STREAM_A, STREAM_B]) {
      const wp = wobble(s, 10, 9, 30);
      STREAMS.push({ p: smoothPath(wp), pts: wp });
      for (let i = 0; i < wp.length - 1; i += 2) GLINTS.push([wp[i][0], wp[i][1]]);
    }
    const streamY = (x) => { let best = 2150, bd = 1e9; for (const s of STREAMS) for (const [px, py] of s.pts) { const d = Math.abs(px - x); if (d < bd) { bd = d; best = py; } } return best; };
    const nearStream = (x, y, m) => { for (const s of STREAMS) for (let i = 0; i < s.pts.length - 1; i++) if (segDist(x, y, s.pts[i][0], s.pts[i][1], s.pts[i + 1][0], s.pts[i + 1][1]) < SW / 2 + 12 + m) return true; return false; };
    {
      const xAt = (pi, x) => { const sy = streamY(x); let bx = x, bd = 1e9; for (const [px, py] of PATHS[pi].pts) if (Math.abs(py - sy) < bd) { bd = Math.abs(py - sy); bx = px; } return [Math.round(bx), sy]; };
      { const [bx, sy] = xAt(0, 1820); put(sprite(240, 200, 120, 172, (c, ax, ay) => bridgeSprite(c, ax, ay, 184, 128, true)), bx, sy + 62); }
      for (const pi of [5, 6]) { const [bx, sy] = xAt(pi, LANES_V[pi - 5]); put(sprite(130, 160, 65, 140, (c, ax, ay) => bridgeSprite(c, ax, ay, 84, 112, false)), bx, sy + 56); }
    }

    // ---- placement helpers
    const taken = [];
    const nearPath = (x, y, m) => { for (const s of SEGS) { if (x < Math.min(s[0], s[2]) - s[4] - m || x > Math.max(s[0], s[2]) + s[4] + m || y < Math.min(s[1], s[3]) - s[4] - m || y > Math.max(s[1], s[3]) + s[4] + m) continue; if (segDist(x, y, s[0], s[1], s[2], s[3]) < s[4] + m) return true; } return false; };
    const blocked = (x, y, m, o = {}) => {
      if (x < 450 || x > 3190 || y < 460 || y > 3200) return true;
      if (inEll(x, y, PLAZA, m) || inEll(x, y, POND, m + 16)) return true;
      if (nearPath(x, y, m)) return true;
      if (!o.water && nearStream(x, y, m)) return true;
      for (const f of foots) if (x > f.x - m - 12 && x < f.x + f.w + m + 12 && y > f.y - m - 12 && y < f.y + f.h + m + 12) return true;
      for (const t of taken) if (Math.hypot(t[0] - x, t[1] - y) < t[2] + m) return true;
      return false;
    };
    const place = (s, x, y, m, lamp) => { taken.push([x, y, m]); put(s, x, y); if (lamp) addLamp(x + lamp[0], y + lamp[1]); };
    const tryPlace = (s, x0, y0, w, h, m, n, R, lamp) => { for (let k = 0; k < n; k++) { const x = x0 + R() * w, y = y0 + R() * h; if (!blocked(x, y, m)) { place(s, x, y, m, lamp); return true; } } return false; };

    // ---- prop sprites
    const S = {};
    S.trees = [[1, 3001, LEAF], [1.15, 3002, LEAF2], [.9, 3003, LEAF3], [1.05, 3004, BLOSSOM], [.95, 3005, LEAF2]].map(([s, sd, pal]) => sprite(220, 230, 100, 214, (c, ax, ay) => broadleaf(c, ax, ay, s, sd, pal)));
    S.bamboo = [[300, 9], [330, 10], [270, 8], [310, 11]].map(([h, n], i) => sprite(220, h + 76, 110, h + 60, (c, ax, ay) => bambooClump(c, ax, ay, h, n, 3100 + i)));
    S.bambooS = [[170, 7], [150, 6]].map(([h, n], i) => sprite(220, h + 76, 110, h + 60, (c, ax, ay) => bambooClump(c, ax, ay, h, n, 3200 + i)));
    S.bush = [[1, LEAF, null], [1.2, LEAF2, '#f6f2e6'], [.9, LEAF3, null], [1.1, LEAF, '#f0a0b8']].map(([s, pal, fl], i) => sprite(110, 80, 55, 66, (c, ax, ay) => bush(c, ax, ay, s, 3300 + i, pal, fl)));
    S.susuki = [0, 1, 2].map(i => sprite(110, 120, 52, 108, (c, ax, ay) => susuki(c, ax, ay, 1 + i * .12, 3400 + i)));
    S.tuft = [0, 1, 2].map(i => sprite(70, 64, 35, 58, (c, ax, ay) => tuftDraw(c, ax, ay, 1 + i * .15, (i - 1) * .12, false, 3500 + i)));
    S.rocks = [12, 18, 26].map((r, i) => sprite(r * 3 + 20, r * 2 + 18, Math.round(r * 1.4 + 8), Math.round(r * 1.2 + 8), (c, ax, ay) => mossRock(c, ax, ay, r, 3600 + i)));
    S.haystack = [1, .85].map(s => sprite(110, 120, 52, 110, (c, ax, ay) => haystack(c, ax, ay, s)));
    S.hasa = sprite(220, 110, 110, 98, (c, ax, ay) => hasa(c, ax, ay, 170));
    S.scarecrow = sprite(80, 110, 40, 100, (c, ax, ay) => scarecrow(c, ax, ay));
    S.hives = sprite(150, 80, 64, 70, (c, ax, ay) => hives(c, ax, ay));
    S.well = sprite(110, 150, 52, 136, (c, ax, ay) => wellSprite(c, ax, ay));
    S.toro = sprite(50, 80, 22, 72, (c, ax, ay) => toro(c, ax, ay, 1.1));
    S.jizo = sprite(50, 60, 24, 52, (c, ax, ay) => jizo(c, ax, ay));
    S.hokora = sprite(90, 120, 44, 90, (c, ax, ay) => hokora(c, ax, ay));
    S.cart = sprite(140, 90, 60, 76, (c, ax, ay) => cart(c, ax, ay));
    S.bench = sprite(90, 40, 42, 32, (c, ax, ay) => bench(c, ax, ay));
    S.sign = sprite(70, 110, 34, 100, (c, ax, ay) => signpost(c, ax, ay));
    S.plot = [0, 1].map(i => sprite(230, 150, 115, 136, (c, ax, ay) => vegPlot(c, ax, ay, 3700 + i)));
    S.reeds = [0, 1].map(i => sprite(60, 80, 30, 72, (c, ax, ay) => reeds(c, ax, ay, 3800 + i)));
    S.kagaribi = sprite(40, 90, 20, 82, (c, ax, ay) => kagaribi(c, ax, ay));
    S.nobori = [1, 2].map(i => sprite(60, 260, 16, 246, (c, ax, ay) => nobori(c, ax, ay, '#3c6b3a', i)));
    S.palH = [0, 1, 2].map(i => sprite(130, 110, 12, 100, (c, ax, ay) => palisadeH(c, ax, ay, 3900 + i)));
    S.palV = [0, 1].map(i => sprite(50, 220, 22, 210, (c, ax, ay) => palisadeV(c, ax, ay, 3950 + i)));
    S.gate = sprite(440, 310, 220, 286, (c, ax, ay) => gateSprite(c, ax, ay));
    S.booth = sprite(150, 160, 70, 146, (c, ax, ay) => booth(c, ax, ay));
    S.pier = sprite(90, 90, 44, 76, (c, ax, ay) => pier(c, ax, ay));
    S.tawara = sprite(90, 50, 44, 40, (c, ax, ay) => { tawara(c, ax - 16, ay); tawara(c, ax + 16, ay + 2); tawara(c, ax, ay - 14, .95); });
    S.firewood = sprite(80, 70, 38, 60, (c, ax, ay) => firewood(c, ax - 30, ay, 60, 4));

    // ---- boundary: bamboo thicket, bushes, palisade, corners
    {
      const R = rng(5150);
      const bam = () => S.bamboo[Math.floor(R() * S.bamboo.length)];
      // every boundary sprite must stay within 150 px of the square (the game clips at 160)
      const fits = (s, x, y) => { const L = x - s.ax, T = y - s.ay; return L >= -150 && T >= -150 && L + s.cv.width <= SIZE + 150 && T + s.cv.height <= SIZE + 150; };
      const putFit = (list, x, y) => { for (const s of list) if (fits(s, x, y)) { put(s, x, y); return true; } return false; };
      const pick = a => a[Math.floor(R() * a.length)];
      const spillList = () => { const k = R(); return k < .38 ? [pick(S.bush), S.rocks[1]] : k < .62 ? [pick(S.susuki), pick(S.bush)] : k < .8 ? [pick(S.rocks), S.rocks[0]] : [pick(S.bambooS), pick(S.bush), S.rocks[0]]; };
      const inNotch = (x, y, m) => y > 3200 && Math.abs(x - 1820) < notchHalf(y) + m;
      // north: tall bamboo behind the palisade, lower thicket towards the outer edge
      for (const [ry, j] of [[250, 30], [334, 22]]) for (let x = -40; x < SIZE + 50; x += 50 + R() * 26) putFit([bam(), bam(), S.bambooS[0]], x + (R() - .5) * 14, ry + (R() - .5) * j);
      for (let x = -40; x < SIZE + 50; x += 56 + R() * 34) putFit([pick(S.bambooS), pick(S.bush)], x, 150 + (R() - .5) * 40);
      for (let x = -40; x < SIZE + 50; x += 54 + R() * 30) putFit([pick(S.bush), pick(S.susuki), pick(S.rocks)], x, 50 + (R() - .5) * 50);
      for (let x = 430; x < 3220; x += 60 + R() * 40) put(R() < .6 ? S.bush[Math.floor(R() * 4)] : S.susuki[Math.floor(R() * 3)], x, 378 + R() * 12);
      // west / east
      for (const [x0, x1] of [[20, 380], [3260, 3620]]) for (let y = 420; y < 3250; y += 62 + R() * 34) {
        const n = R() < .5 ? 2 : 3;
        for (let k = 0; k < n; k++) putFit([bam(), pick(S.bambooS)], x0 + 40 + (k + R() * .8) * (x1 - x0 - 60) / n, y + (R() - .5) * 26);
        if (R() < .45) put(S.bush[Math.floor(R() * 4)], x0 + 30 + R() * (x1 - x0 - 60), y + 30);
      }
      for (const x of [376, 3264]) for (let y = 440; y < 3220; y += 70 + R() * 50) put(S.bush[Math.floor(R() * 4)], x + (R() - .5) * 10, y);
      // south: lower vegetation so the houses in front are not hidden
      for (const ry of [3330, 3430, 3540, 3640]) for (let x = -40; x < SIZE + 50; x += 46 + R() * 26) {
        const xx = x + (R() - .5) * 14, yy = ry + (R() - .5) * 26;
        if (inNotch(xx, yy, 40)) continue;
        const k = R(); putFit(ry < 3400 ? (k < .5 ? [pick(S.bush)] : [pick(S.susuki)]) : (k < .55 ? [pick(S.bambooS), pick(S.bush)] : [pick(S.bush)]), xx, yy);
      }
      // spill past the square edge with irregular depth (30..140 px) so the outline is ragged, not ruled
      const depth = (t, s) => 30 + 110 * Math.max(0, Math.min(1, .5 + .32 * Math.sin(t * .013 + s) + .2 * Math.sin(t * .041 + s * 2) + (R() - .5) * .5));
      for (let x = -90; x < SIZE + 90; x += 34 + R() * 40) {
        const d = depth(x, 1); if (R() < .82) putFit(spillList(), x, -d * .55);
        const e = depth(x, 3), sy = SIZE + e * .62;
        if (!inNotch(x, sy, 50) && R() < .85) putFit(spillList(), x, sy);
      }
      for (let y = -60; y < SIZE + 60; y += 34 + R() * 40) {
        if (R() < .85) putFit(spillList(), -depth(y, 4) * .6, y);
        if (R() < .85) putFit(spillList(), SIZE + depth(y, 2) * .6, y);
      }
      // the stream rises from a rocky spring in the west thicket and sinks into the east one
      put(S.rocks[2], 104, 2170); put(S.rocks[1], 136, 2190); put(S.bush[2], 92, 2196);
      put(S.rocks[2], 3532, 2180); put(S.rocks[0], 3508, 2196); put(S.bush[0], 3548, 2204);
      // round off the hedge ends beside the gate road with bushes, rocks and pampas grass
      for (const sd of [-1, 1]) for (let y = 3290; y < 3790; y += 34 + R() * 22) {
        const x = 1820 + sd * (notchHalf(y) + 18 + R() * 26);
        putFit(R() < .6 ? [pick(S.bush), S.rocks[1]] : R() < .5 ? [pick(S.rocks), S.rocks[0]] : [pick(S.susuki), S.rocks[0]], x, y);
      }
      // corner thickets on the inner squares of the corner cells
      for (const [cx, cy] of [[460, 470], [3180, 470], [460, 3170], [3180, 3170]]) {
        put(S.rocks[2], cx - 10, cy + 10); put(S.bush[1], cx + 20, cy + 30); put(S.susuki[1], cx - 30, cy + 40);
      }
      // palisade
      for (let x = WIN - 6; x < WOUT; x += 104) put(S.palH[Math.floor(R() * 3)], Math.min(x, WOUT - 98), 404);
      for (let x = WIN - 6; x < 1540; x += 104) put(S.palH[Math.floor(R() * 3)], Math.min(x, 1450), 3246);
      for (let x = 1954; x < WOUT; x += 104) put(S.palH[Math.floor(R() * 3)], Math.min(x, WOUT - 98), 3246);
      for (let y = 508; y < 3352; y += 104) { y = Math.min(y, 3248); put(S.palV[Math.floor(R() * 2)], WIN, y); put(S.palV[Math.floor(R() * 2)], WOUT, y); }
      // banners along the north palisade
      for (const x of [700, 1300, 2340, 2940]) put(S.nobori[x % 2], x, 430);
    }
    // ---- south gate
    put(S.gate, 1820, 3262);
    put(S.booth, 1612, 3244); addLamp(1610, 3192);
    put(S.kagaribi, 1990, 3214); addLamp(1990, 3150);
    put(S.nobori[0], 1666, 3118); put(S.nobori[1], 1958, 3118);
    addLamp(1740, 3150); addLamp(1900, 3150);
    put(S.sign, 1966, 3046);
    taken.push([1612, 3200, 80], [1990, 3214, 40], [1966, 3046, 40]);

    // ---- plaza
    for (const deg of [160, 20, 212, 328]) {
      const a = deg * Math.PI / 180, x = PLAZA.x + (PLAZA.rx + 30) * Math.cos(a), y = PLAZA.y + (PLAZA.ry + 22) * Math.sin(a);
      place(S.toro, x, y, 30, [0, -48]);
    }
    place(S.bench, PLAZA.x - 200, PLAZA.y + 170, 36); place(S.bench, PLAZA.x + 200, PLAZA.y + 170, 36);
    place(S.bush[1], PLAZA.x - 330, PLAZA.y + 20, 34); place(S.bush[3], PLAZA.x + 330, PLAZA.y + 30, 34);
    // ---- road side
    for (const y of [2420, 2760, 3000]) { place(S.toro, 1690, y, 26, [0, -48]); place(S.toro, 1952, y + 30, 26, [0, -48]); }
    place(S.jizo, 1680, 2300, 24);

    // ---- themed open cells
    const R = rng(6060);
    // (3,1) hay meadow
    place(S.haystack[0], 1680, 760, 50); place(S.haystack[1], 1800, 700, 46); place(S.haystack[0], 1930, 820, 50);
    place(S.hasa, 1820, 930, 60); place(S.scarecrow, 2000, 700, 30);
    // (2,3) kitchen gardens + well
    place(S.plot[0], 1240, 1760, 110); place(S.plot[1], 1290, 1980, 100); place(S.well, 1460, 1820, 46); place(S.scarecrow, 1110, 1900, 26);
    // (5,3) beehives & wildflowers
    place(S.hives, 2800, 1720, 70); place(S.hives, 2980, 1840, 70); place(S.bench, 2760, 1930, 40);
    // (4,4) pond
    place(S.pier, 2420, 2240, 30);
    for (const [x, y, i] of [[2170, 2400, 0], [2230, 2460, 1], [2470, 2455, 0], [2540, 2390, 1], [2300, 2215, 1], [2520, 2270, 0]]) { taken.push([x, y, 20]); put(S.reeds[i], x, y); }
    place(S.rocks[1], 2560, 2470, 24); place(S.jizo, 2150, 2500, 22);
    // (2,5) harvest field
    place(S.haystack[0], 1180, 2760, 50); place(S.haystack[1], 1300, 2720, 44); place(S.hasa, 1300, 2960, 60); place(S.cart, 1460, 2830, 50); place(S.tawara, 1150, 2960, 40);
    // (5,5) bamboo grove with a wayside shrine
    place(S.hokora, 2860, 2860, 60); addLamp(2860, 2830);
    place(S.toro, 2800, 2950, 24, [0, -48]); place(S.toro, 2930, 2950, 24, [0, -48]);
    for (const [x, y, k] of [[2700, 2800, 0], [3060, 2790, 1], [2690, 2960, 2], [2770, 3060, 3], [3080, 2950, 4], [2990, 3060, 5]]) {
      const s = y < 2900 ? S.bambooS[k % 2] : S.bamboo[k % 4];
      if (!blocked(x, y, 30)) place(s, x, y, 40);
    }
    // ---- scattered nature
    for (let i = 0; i < 70; i++) tryPlace(S.trees[Math.floor(R() * S.trees.length)], 460, 470, 2730, 2730, 62, 6, R);
    for (let i = 0; i < 90; i++) tryPlace(S.bush[Math.floor(R() * 4)], 460, 470, 2730, 2730, 30, 6, R);
    for (let i = 0; i < 60; i++) tryPlace(S.susuki[Math.floor(R() * 3)], 460, 470, 2730, 2730, 28, 6, R);
    for (let i = 0; i < 40; i++) tryPlace(S.rocks[Math.floor(R() * 3)], 460, 470, 2730, 2730, 22, 6, R);
    for (let i = 0; i < 120; i++) tryPlace(S.tuft[Math.floor(R() * 3)], 460, 470, 2730, 2730, 18, 4, R);
    for (let i = 0; i < 10; i++) tryPlace(i % 2 ? S.firewood : S.tawara, 460, 470, 2730, 2730, 30, 6, R);

    // ---- ground decals (flat, drawn in the ground pass)
    const decal = (s, x, y) => decals.push({ img: s.cv || s, x: Math.round(x - (s.ax ?? s.width / 2)), y: Math.round(y - (s.ay ?? s.height / 2)), w: (s.cv || s).width, h: (s.cv || s).height });
    for (let i = 0; i < 70; i++) { const x = 480 + R() * 2680, y = 480 + R() * 2680; if (!blocked(x, y, 40, { water: false })) decal(A.dec.meadow[i % 3], x, y); }
    for (let i = 0; i < 260; i++) { const x = 470 + R() * 2700, y = 470 + R() * 2700; if (!blocked(x, y, 16)) decal(A.dec.flowers[Math.floor(R() * 5)], x, y); }
    // wildflower meadows: around the beehives and in the hay meadow
    for (const [mx, my] of [[2620, 1580], [1580, 540]]) {
      for (let i = 0; i < 3; i++) decal(A.dec.meadow[i], mx + 120 + i * 130, my + 140 + (i % 2) * 180);
      for (let i = 0; i < 60; i++) { const x = mx + 30 + R() * 460, y = my + 40 + R() * 440; if (!blocked(x, y, 10)) decal(A.dec.flowers[Math.floor(R() * 5)], x, y); }
    }
    for (const pth of PATHS) {
      const pts = pth.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
        for (let d = 0; d < L; d += 26 + R() * 30) for (const sd of [-1, 1]) {
          if (R() < .3) continue;
          const x = x1 + (x2 - x1) * d / L + nx * sd * (pth.w / 2 + 2), y = y1 + (y2 - y1) * d / L + ny * sd * (pth.w / 2 + 2);
          if (inEll(x, y, PLAZA, 0) || x < 420 || x > 3220 || y < 420 || y > 3230) continue;
          decal(A.dec.edge[Math.floor(R() * 3)], x, y + 6);
        }
      }
    }
    // stepping stones by the pond and lily pads on it
    for (const [x, y] of [[2190, 2490], [2226, 2512], [2268, 2524], [2560, 2214], [2584, 2190]]) decal(A.dec.stone[(x + y) % 2], x, y);
    for (let i = 0; i < 16; i++) { const a = R() * TAU, d = .3 + R() * .55; decal(A.dec.lily[i % 3], POND.x + Math.cos(a) * POND.rx * d, POND.y + Math.sin(a) * POND.ry * d); }
    for (let i = 0; i < 26; i++) { const s = STREAMS[i % 2], p = s.pts[Math.floor(R() * s.pts.length)]; if (p[0] > 420 && p[0] < 3220 && Math.abs(p[0] - 1820) > 120 && LANES_V.every(l => Math.abs(p[0] - l) > 70)) decal(A.dec.lily[i % 3], p[0] + (R() - .5) * 20, p[1] + (R() - .5) * 14); }
    // reeds and stones along the stream banks
    for (const s of STREAMS) for (let i = 2; i < s.pts.length - 2; i += 3) {
      const [x, y] = s.pts[i]; if (x < 440 || x > 3200 || Math.abs(x - 1820) < 130 || LANES_V.some(l => Math.abs(x - l) < 80)) continue;
      const sd = R() < .5 ? -1 : 1, yy = y + sd * (SW / 2 + 6);
      if (!foots.some(f => x > f.x - 30 && x < f.x + f.w + 30 && yy > f.y - 20 && yy < f.y + f.h + 30)) {
        if (R() < .55) put(S.reeds[Math.floor(R() * 2)], x + (R() - .5) * 20, yy + 4); else decal(A.dec.stone[Math.floor(R() * 2)], x, yy);
      }
    }

    // ---- ambient tall grass that waves in the wind (kept clear of every sprite so it never draws over one)
    TUFTS = []; for (let i = 0; i < NC * NC; i++) TUFTS.push([]);
    {
      const rects = objs.map(o => [o.x - 10, o.y - 6, o.x + o.w + 10, o.y + o.h + 6]);
      const Rt = rng(7070);
      for (let i = 0; i < 2600; i++) {
        const x = 450 + Rt() * 2740, y = 470 + Rt() * 2730;
        if (blocked(x, y, 22)) continue;
        if (rects.some(r => x + 34 > r[0] && x - 34 < r[2] && y + 8 > r[1] && y - 60 < r[3])) continue;
        if (TUFTS.some(b => b.some(t => Math.abs(t.x - x) < 46 && Math.abs(t.y - y) < 30))) continue;
        TUFTS[Math.floor(y / BLOCK) * NC + Math.floor(x / BLOCK)].push({ x: Math.round(x), y: Math.round(y), k: Math.floor(Rt() * 3) });
      }
      for (const b of TUFTS) b.sort((p, q) => p.y - q.y);
    }

    objs.sort((p, q) => p.by - q.by || p.x - q.x);
    ready = true;
  }

  // ------------------------------------------------------------------ drawing
  function drawGround(ctx, x0, y0, x1, y1) {
    ctx.save(); ctx.clip(GRASS); ctx.fillStyle = A.grassPat; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
    const hit = (x, y, w, h) => x < x1 && x + w > x0 && y < y1 && y + h > y0;
    for (const d of decals) if (d.h > 100 && hit(d.x, d.y, d.w, d.h)) ctx.drawImage(d.img, d.x, d.y);
    // hedge band
    ctx.fillStyle = A.thicketPat; ctx.fill(BAND, 'evenodd');
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(20,40,14,.5)'; ctx.lineWidth = 14; ctx.stroke(INNER);
    // paths: edge, rim, dirt
    ctx.strokeStyle = 'rgba(60,64,24,.32)'; for (const p of PATHS) { ctx.lineWidth = p.w + 14; ctx.stroke(p.p); }
    ctx.strokeStyle = '#8c7848'; for (const p of PATHS) { ctx.lineWidth = p.w + 5; ctx.stroke(p.p); }
    ctx.strokeStyle = A.dirtPat; for (const p of PATHS) { ctx.lineWidth = p.w; ctx.stroke(p.p); }
    ctx.strokeStyle = 'rgba(255,240,200,.16)'; for (const p of PATHS) if (p.kind !== 'foot') { ctx.lineWidth = p.w * .45; ctx.stroke(p.p); }
    // plaza
    const pr = { x: PLAZA.x - PLAZA.rx - 30, y: PLAZA.y - PLAZA.ry - 30, w: PLAZA.rx * 2 + 60, h: PLAZA.ry * 2 + 60 };
    if (hit(pr.x, pr.y, pr.w, pr.h)) {
      ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx + 12, PLAZA.ry + 10, 0, 0, TAU); ctx.fillStyle = 'rgba(60,64,24,.3)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fillStyle = A.plazaPat; ctx.fill();
      ctx.strokeStyle = '#9a9482'; ctx.lineWidth = 14; ctx.stroke();
      ctx.setLineDash([22, 6]); ctx.strokeStyle = '#bcb6a2'; ctx.lineWidth = 10; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx - 8, PLAZA.ry - 7, 0, 0, TAU); ctx.strokeStyle = 'rgba(90,70,40,.35)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.drawImage(A.emblem, PLAZA.x - A.emblem.width / 2, PLAZA.y - A.emblem.height / 2 + 10);
    }
    // stream and pond
    ctx.strokeStyle = 'rgba(40,52,22,.35)'; ctx.lineWidth = SW + 34; for (const s of STREAMS) ctx.stroke(s.p);
    ctx.strokeStyle = '#7a6a48'; ctx.lineWidth = SW + 18; for (const s of STREAMS) ctx.stroke(s.p);
    ctx.strokeStyle = '#9a8a66'; ctx.lineWidth = SW + 8; for (const s of STREAMS) ctx.stroke(s.p);
    const ph = { x: POND.x - POND.rx - 30, y: POND.y - POND.ry - 30, w: POND.rx * 2 + 60, h: POND.ry * 2 + 60 };
    const pondHit = hit(ph.x, ph.y, ph.w, ph.h);
    if (pondHit) {
      fell(ctx, POND.x, POND.y, POND.rx + 22, POND.ry + 18, 'rgba(40,52,22,.35)');
      fell(ctx, POND.x, POND.y, POND.rx + 12, POND.ry + 10, '#7a6a48');
      fell(ctx, POND.x, POND.y, POND.rx + 5, POND.ry + 4, '#9a8a66');
    }
    ctx.strokeStyle = '#2f6f8e'; ctx.lineWidth = SW; for (const s of STREAMS) ctx.stroke(s.p);
    if (pondHit) fell(ctx, POND.x, POND.y, POND.rx, POND.ry, '#2f6f8e');
    ctx.save(); ctx.translate(-3, -5);
    ctx.strokeStyle = '#4592b0'; ctx.lineWidth = SW - 22; for (const s of STREAMS) ctx.stroke(s.p);
    if (pondHit) fell(ctx, POND.x, POND.y, POND.rx - 18, POND.ry - 14, '#4592b0');
    ctx.setLineDash([26, 54]); ctx.strokeStyle = 'rgba(200,236,246,.55)'; ctx.lineWidth = 2.5; for (const s of STREAMS) ctx.stroke(s.p); ctx.setLineDash([]);
    ctx.restore();
    if (pondHit) { fell(ctx, POND.x - 50, POND.y - 30, 70, 18, 'rgba(160,215,235,.35)'); fell(ctx, POND.x + 60, POND.y + 20, 40, 10, 'rgba(160,215,235,.25)'); }
    for (const d of decals) if (d.h <= 100 && hit(d.x, d.y, d.w, d.h)) ctx.drawImage(d.img, d.x, d.y);
  }

  function drawStatic(ctx, bounds, isDestroyed) {
    if (!ready) build();
    const x0 = bounds.x, y0 = bounds.y, x1 = bounds.x + bounds.w, y1 = bounds.y + bounds.h;
    if (x1 < -170 || x0 > SIZE + 170 || y1 < -170 || y0 > SIZE + 170) return;
    const ix0 = Math.max(-150, x0), iy0 = Math.max(-150, y0), ix1 = Math.min(SIZE + 150, x1), iy1 = Math.min(SIZE + 150, y1);
    ctx.save();
    if (ix1 > ix0 && iy1 > iy0) {
      ctx.save(); ctx.beginPath(); ctx.rect(ix0, iy0, ix1 - ix0, iy1 - iy0); ctx.clip(); ctx.clip(OUTER);
      drawGround(ctx, ix0, iy0, ix1, iy1);
      ctx.restore();
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
    const vx0 = view.x, vy0 = view.y, vx1 = view.x + view.w, vy1 = view.y + view.h;
    if (vx1 < -120 || vy1 < -120 || vx0 > SIZE + 120 || vy0 > SIZE + 120) return;
    const t = time || 0;
    ctx.save();
    // 1. tall grass swaying as wind waves roll across the meadows (west -> east)
    const cx0 = Math.max(0, Math.floor((vx0 - 40) / BLOCK)), cx1 = Math.min(NC - 1, Math.floor((vx1 + 40) / BLOCK));
    const cy0 = Math.max(0, Math.floor((vy0 - 10) / BLOCK)), cy1 = Math.min(NC - 1, Math.floor((vy1 + 70) / BLOCK));
    const TF = A.amb.tufts;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const b = TUFTS[cy * NC + cx];
      for (let i = 0; i < b.length; i++) {
        const tf = b[i];
        if (tf.x < vx0 - 40 || tf.x > vx1 + 40 || tf.y < vy0 - 10 || tf.y > vy1 + 64) continue;
        const ph = t * 1.9 - tf.x * .0062 - tf.y * .0024, gust = .55 + .45 * Math.sin(t * .5 - tf.x * .0011 + tf.y * .0007);
        const lean = Math.sin(ph) * gust, idx = Math.max(0, Math.min(4, Math.round((lean + 1) * 2))), lit = lean > .62 ? 1 : 0;
        const s = TF[tf.k][lit][idx];
        ctx.drawImage(s.cv, tf.x - s.ax, tf.y - s.ay);
      }
    }
    // 2. glints on the stream
    ctx.fillStyle = 'rgba(235,250,255,.8)';
    for (let i = 0; i < GLINTS.length; i++) {
      const [gx, gy] = GLINTS[i];
      if (gx < vx0 - 10 || gx > vx1 + 10 || gy < vy0 - 40 || gy > vy1 + 40) continue;
      const a = Math.sin(t * 2.6 + i * 1.7);
      if (a < .4) continue;
      const dx = ((t * 22 + i * 13) % 30) - 15;
      ctx.globalAlpha = (a - .4) * 1.4; ctx.fillRect(gx + dx, gy - 6 + (i % 3) * 6, 9, 1.8);
    }
    ctx.globalAlpha = 1;
    // 3. drifting petals and leaves
    const vxa = Math.max(vx0, 0), vya = Math.max(vy0, 0), vxb = Math.min(vx1, SIZE), vyb = Math.min(vy1, SIZE);
    if (vxb > vxa && vyb > vya) {
      const Q = 760, PS = A.amb.petals;
      for (let i = 0; i < 16; i++) {
        const v = 26 + hash2(i, 1, 21) * 30, bx = hash2(i, 2, 21) * Q, by = hash2(i, 3, 21) * Q;
        const x = ((bx + t * v) % Q + Q) % Q, y = ((by + t * v * .35 + Math.sin(t * 1.3 + i) * 14) % Q + Q) % Q;
        const s = PS[(i % 4) * 4 + (Math.floor(t * 3 + i) % 4)];
        for (let X = x + Math.floor((vxa - x) / Q) * Q; X < vxb; X += Q) for (let Y = y + Math.floor((vya - y) / Q) * Q; Y < vyb; Y += Q) ctx.drawImage(s.cv, X - 6, Y - 6);
      }
      // 4. butterflies fluttering over the meadow
      const BQ = 1100, BF = A.amb.flies;
      for (let i = 0; i < 6; i++) {
        const bx = 120 + hash2(i, 4, 33) * (BQ - 240), by = 120 + hash2(i, 5, 33) * (BQ - 240), sp = .35 + hash2(i, 6, 33) * .3;
        const x = bx + Math.sin(t * sp + i) * 90 + Math.sin(t * sp * 2.7 + i * 3) * 24, y = by + Math.cos(t * sp * .8 + i * 2) * 60 + Math.sin(t * 5.3 + i) * 5;
        const s = BF[i % 4][Math.floor(t * 14 + i * 3) % 2];
        for (let X = x + Math.floor((vxa - x) / BQ) * BQ; X < vxb; X += BQ) for (let Y = y + Math.floor((vya - y) / BQ) * BQ; Y < vyb; Y += BQ) {
          if (X < 420 || X > 3220 || Y < 440 || Y > 3200) continue;
          ctx.fillStyle = 'rgba(28,50,18,.18)'; ctx.fillRect(X - 3, Y + 16, 6, 2);
          ctx.drawImage(s.cv, X - s.ax, Y - s.ay);
        }
      }
    }
    ctx.restore();
  }

  function drawMinimap(ctx) {
    if (!ready) build();
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, SIZE, SIZE); ctx.clip();
    ctx.fillStyle = '#679a42'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#2c5426'; ctx.fill(BAND, 'evenodd');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#c4a46e'; for (const p of PATHS) { ctx.lineWidth = Math.max(60, p.w); ctx.stroke(p.p); }
    ctx.fillStyle = '#d2b484'; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3f86a8'; ctx.lineWidth = SW + 20; for (const s of STREAMS) ctx.stroke(s.p);
    ctx.fillStyle = '#3f86a8'; ctx.beginPath(); ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7a5636'; ctx.lineWidth = 30; ctx.beginPath();
    ctx.moveTo(1694, WOUT); ctx.lineTo(WIN, WOUT); ctx.lineTo(WIN, WIN); ctx.lineTo(WOUT, WIN); ctx.lineTo(WOUT, WOUT); ctx.lineTo(1946, WOUT); ctx.stroke();
    for (const f of foots) {
      if (f.solid) continue;
      if (f.x === HALL.x && f.y === HALL.y) continue;
      ctx.fillStyle = f.roof; ctx.fillRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40);
      ctx.strokeStyle = '#5a3e22'; ctx.lineWidth = 14; ctx.strokeRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40);
    }
    ctx.fillStyle = '#d8b04a'; ctx.fillRect(HALL.x, HALL.y, HALL.w, HALL.h);
    ctx.strokeStyle = '#3c6b3a'; ctx.lineWidth = 40; ctx.strokeRect(HALL.x + 20, HALL.y + 20, HALL.w - 40, HALL.h - 40);
    ctx.fillStyle = '#2f6a2a'; ctx.beginPath(); ctx.arc(TREE.x + TREE.w / 2, TREE.y + TREE.h / 2 - 120, 240, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1c3a18'; ctx.lineWidth = 24; ctx.stroke();
    ctx.restore();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  const mod = window.ShinobiVillages.kusa = {
    id: 'kusa', name: 'LÀNG CỎ', jp: '草隠れの里', kage: null,
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
