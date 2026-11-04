/* village-iwa.js — Iwagakure (Hidden Stone Village, Land of Earth) in 3/4 oblique view.
   Registers window.ShinobiVillages.iwa. All art is original procedural Canvas 2D (no images).
   Local coords: the village is a 5200x5200 square, gate on the south edge at x = 2600. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const TAU = Math.PI * 2;
  const BLOCK = 520, NCELL = 10, SIZE = BLOCK * NCELL;
  const GATE_X = 2600;
  const MINCHO = '"Yu Mincho","YuMincho","MS Mincho","Hiragino Mincho ProN",serif';
  const OUT = '#3b2a22';
  const PADX = 26, PADB = 26;
  const PLAZA = { x: 2860, y: 2330, r: 285 };
  const SPAWN = { x: 2860, y: 2400 };

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
  function tone(base) { return { base, light: mix(base, '#fff4dc', .32), hi: mix(base, '#fffaf0', .58), dark: mix(base, '#3a1f2a', .26), deep: mix(base, '#24120f', .52) }; }
  function rockPal(base, top) {
    return { base, light: mix(base, '#ffe0b0', .3), dark: mix(base, '#2a1208', .3), deep: mix(base, '#1a0a05', .5), line: mix(base, '#1a0a05', .62),
      top, topL: mix(top, '#fff2d6', .32), topD: mix(top, '#3a1a0a', .2) };
  }
  const mod = (a, n) => ((a % n) + n) % n;

  // ------------------------------------------------------------------ primitives
  function poly(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
  function fpoly(c, p, col) { poly(c, p); c.fillStyle = col; c.fill(); }
  function frect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function fell(c, x, y, rx, ry, col) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); c.fillStyle = col; c.fill(); }
  function sk(c, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
  function line(c, x1, y1, x2, y2, col, lw) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); sk(c, col, lw); }
  function srect(c, x, y, w, h, col = OUT, lw = 2) { c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
  function pathFrom(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; }
  function txt(c, s, x, y, size, col, o = {}) {
    c.font = `${o.weight || '700'} ${size}px ${o.font || MINCHO}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 3; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  function txtV(c, s, x, y, size, col, o = {}) { [...s].forEach((ch, i) => txt(c, ch, x, y + size * .55 + i * size * 1.02, size, col, o)); }
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
  // wrap-around drawing for seamless tiles
  const wrapAt = (S, x, y, m, fn) => { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) if (x + ox > -m && x + ox < S + m && y + oy > -m && y + oy < S + m) fn(x + ox, y + oy); };

  // ------------------------------------------------------------------ palettes
  const ROCKS = [rockPal('#a8643c', '#cf9c66'), rockPal('#b5834a', '#d9b47c'), rockPal('#8a6248', '#b8957a')]; // rust, ochre, umber
  const ROOFS = [tone('#8b3a2f'), tone('#5d7083'), tone('#6e6259'), tone('#a8957a')];          // dark red, grey-blue, slate, stone
  const WALLS = [tone('#d6c09a'), tone('#c9a878'), tone('#bfae94')];                           // pale sandstone, ochre clay, grey stone
  const GROUND = { base: '#ae895c', light: '#bd9a6c', dark: '#9d7a50', crack: '#76563a', crackHi: '#caa97c' };
  const RED = tone('#8e3328');

  // ------------------------------------------------------------------ geometry kit
  // superellipse point (p = 2: ellipse, larger p: squarer)
  function sePt(a, p) { const ca = Math.cos(a), sa = Math.sin(a), e = 2 / p; return [Math.sign(ca) * Math.pow(Math.abs(ca), e), Math.sign(sa) * Math.pow(Math.abs(sa), e)]; }

  // A rock column / mesa seen in 3/4: irregular top surface + layered front face, lit from the top-left.
  function rockPillar(c, cx, ty, rx, ry, h, K, seed, o = {}) {
    const R = rng(seed), n = o.n ?? 28, jag = o.jag ?? .08, flare = o.flare ?? 1.05, p = o.p ?? 2;
    const top = [];
    for (let i = 0; i < n; i++) { const [u, v] = sePt(i / n * TAU, p), j = 1 + (R() - .5) * 2 * jag; top.push([cx + u * rx * j, ty + v * ry * j]); }
    const hn = n / 2, front = top.slice(0, hn + 1);
    const bot = front.map(([x, y]) => [cx + (x - cx) * flare + (R() - .5) * 5, y + h + (R() - .5) * Math.min(9, h * .1)]);
    const kk = Math.max(1, Math.round(h / 26));
    const side = (a, b) => { const out = []; for (let i = 1; i < kk; i++) { const t = i / kk; out.push([a[0] + (b[0] - a[0]) * t + (R() - .5) * rx * .07, a[1] + (b[1] - a[1]) * t]); } return out; };
    const face = pathFrom([...front, ...side(front[hn], bot[hn]), ...bot.slice().reverse(), ...side(bot[0], front[0])]);
    if (o.shadow !== false) fell(c, cx + rx * .28, ty + h + ry * .45, rx * flare * 1.1, ry * 1.05, 'rgba(58,30,12,.28)');
    c.save(); c.fillStyle = K.base; c.fill(face); c.clip(face);
    const Y0 = ty - ry - 10, YH = h + ry * 2 + 30;
    const bandPoly = (xa, xb, col) => {
      const pts = [];
      for (let y = Y0; y <= Y0 + YH; y += 20) pts.push([xa + (R() - .5) * rx * .07, y]);
      for (let y = Y0 + YH; y >= Y0; y -= 20) pts.push([xb + (R() - .5) * rx * .07, y]);
      c.fillStyle = col; c.fill(pathFrom(pts));
    };
    const B = p > 3 ? [-.84, -.72, .66, .86] : [-.55, -.28, .3, .7];
    bandPoly(cx - rx * 1.5, cx + rx * B[0], K.light);
    bandPoly(cx + rx * B[0], cx + rx * B[1], mix(K.light, K.base, .5));
    bandPoly(cx + rx * B[2], cx + rx * B[3], K.dark);
    bandPoly(cx + rx * B[3], cx + rx * 1.5, K.deep);
    // sediment strata following the curvature of the face
    const nS = Math.max(1, Math.floor(h / (o.strata ?? 21)));
    let prev = null;
    for (let k = 1; k <= nS; k++) {
      const yo = ty + h * k / (nS + 1) + (R() - .5) * 5, fl = 1 + (flare - 1) * k / (nS + 1), pts = [];
      for (let i = 0; i <= 16; i++) { const [u, v] = sePt(i / 16 * Math.PI, p); pts.push([cx + u * rx * fl * 1.02, yo + v * ry + (R() - .5) * 3]); }
      if (o.bands && prev) {
        c.fillStyle = k % 2 ? 'rgba(255,226,170,.13)' : 'rgba(70,28,10,.12)';
        c.fill(pathFrom([...prev, ...pts.slice().reverse()]));
      }
      const i0 = Math.floor(R() * 4), i1 = 16 - Math.floor(R() * 4);
      c.beginPath(); c.moveTo(pts[i0][0], pts[i0][1]); for (let i = i0 + 1; i <= i1; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.globalAlpha = .5; sk(c, K.line, 1.8);
      c.save(); c.translate(0, 2.2); c.globalAlpha = .4; sk(c, K.light, 1.1); c.restore();
      c.globalAlpha = 1;
      prev = pts;
    }
    // vertical cracks
    c.globalAlpha = .6; c.strokeStyle = K.line; c.lineWidth = 1.5;
    for (let i = 0; i < (o.cracks ?? 3); i++) {
      let x = cx + (R() - .5) * rx * 1.6, y = ty + ry * .9 + R() * h * .3;
      const len = h * (.3 + R() * .5);
      c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < len; s += 9) { x += (R() - .5) * 7; y += 9; c.lineTo(x, y); }
      c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(50,24,10,.16)'; c.fillRect(cx - rx * 2, ty + h + ry * .55, rx * 4, ry + 20);
    c.restore();
    const topP = pathFrom(top);
    celFill(c, topP, K.top, K.topL, K.topD, { ld: Math.min(8, ry * .22), dd: Math.min(9, ry * .26) });
    if (o.speckle !== false) {
      c.save(); c.clip(topP);
      for (let i = 0; i < Math.round(rx * ry / 500) + 4; i++) {
        const a = R() * TAU, d = Math.sqrt(R()) * .85;
        fell(c, cx + Math.cos(a) * rx * d, ty + Math.sin(a) * ry * d, 1.5 + R() * 3, 1 + R() * 1.6, R() < .5 ? K.topD : K.topL);
      }
      c.restore();
    }
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(face); c.stroke(topP);
    return { cx, ty, rx, ry, h, top, front, topP, face };
  }

  // A tall jagged rock spire (hoodoo) with a small flat top facet.
  function rockSpire(c, cx, by, bw, H, K, seed, o = {}) {
    const R = rng(seed), n = Math.max(5, Math.round(H / 30)), lean = o.lean ?? 0;
    if (o.shadow !== false) fell(c, cx + bw * .34, by - 1, bw * .74, bw * .2, 'rgba(58,30,12,.3)');
    const Lp = [], Rp = [], Mp = [], Dp = [], topW = bw * (o.top ?? .42);
    const ph = R() * 3, ledges = [];
    let stepL = 1, stepR = 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n, y = by - H * t + (i && i < n ? (R() - .5) * 8 : 0);
      if (i > 0 && i < n - 1 && R() < .3) { stepL *= .9 + R() * .06; ledges.push(i); }
      if (i > 0 && i < n - 1 && R() < .3) stepR *= .9 + R() * .06;
      const hw = (bw / 2) * (1 - t) + (topW / 2) * t + Math.sin(t * Math.PI * 1.6 + ph) * bw * .05;
      const x0 = cx + lean * H * t;
      const jl = i === n ? 0 : (R() - .5) * bw * .16, jr = i === n ? 0 : (R() - .5) * bw * .16;
      Lp.push([x0 - hw * (i === n ? 1 : stepL) + jl, y]); Rp.push([x0 + hw * (i === n ? 1 : stepR) + jr, y]);
      Mp.push([x0 - hw * .12 + (R() - .5) * hw * .22, y]); Dp.push([x0 + hw * .42 + (R() - .5) * hw * .16, y]);
    }
    const topY = by - H, tcx = cx + lean * H, tr = topW / 2, try_ = topW * .2;
    Lp[n] = [tcx - tr, topY]; Rp[n] = [tcx + tr, topY];
    // jagged crown of broken peaks
    const crown = [];
    for (let i = 1; i <= 4; i++) crown.push([tcx - tr + 2 * tr * i / 5 + (R() - .5) * tr * .2, topY - (i % 2 ? .3 + R() * .35 : .04 + R() * .14) * topW * .5]);
    const sil = pathFrom([...Lp, ...crown, ...Rp.slice().reverse(), [cx + bw * .26, by + bw * .06], [cx - bw * .26, by + bw * .06]]);
    c.save(); c.fillStyle = K.base; c.fill(sil); c.clip(sil);
    c.fillStyle = K.light; c.fill(pathFrom([[Lp[0][0] - 20, by + 30], ...Lp.map(([x, y]) => [x - 8, y]), ...Mp.slice().reverse(), [Mp[0][0], by + 30]]));
    c.fillStyle = K.dark; c.fill(pathFrom([[Dp[0][0], by + 30], ...Dp, ...Rp.slice().reverse().map(([x, y]) => [x + 10, y]), [Rp[0][0] + 20, by + 30]]));
    c.beginPath(); Rp.forEach(([x, y], i) => i ? c.lineTo(x - 3, y) : c.moveTo(x - 3, y)); sk(c, K.deep, 7);
    for (let k = 1; k < n; k++) {
      const y = Lp[k][1] + (R() - .5) * 10, x0 = Lp[k][0] - 4, x1 = Rp[k][0] + 4, mid = x0 + (x1 - x0) * (.3 + R() * .4), sl = (R() - .5) * 8;
      for (const [a, b] of [[x0, mid - 6 - R() * 10], [mid + 4, x1]]) {
        if (b <= a) continue;
        line(c, a, y + (a - x0) / (x1 - x0) * sl, b, y + (b - x0) / (x1 - x0) * sl, 'rgba(60,26,10,.45)', 1.8);
        line(c, a, y + 2.2 + (a - x0) / (x1 - x0) * sl, b, y + 2.2 + (b - x0) / (x1 - x0) * sl, 'rgba(255,224,176,.32)', 1.1);
      }
    }
    c.strokeStyle = 'rgba(50,22,8,.55)'; c.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      let x = cx + (R() - .5) * bw * .5, y = by - H * (.25 + R() * .6);
      c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 50 + R() * 50; s += 9) { x += (R() - .5) * 6; y += 9; c.lineTo(x, y); } c.stroke();
    }
    // sun-lit ledge tops
    for (const i of ledges) { const [lx, ly] = Lp[i]; line(c, lx, ly, lx + (Mp[i][0] - lx) * .9, ly + 2, K.topL, 3); line(c, lx, ly + 3, lx + (Mp[i][0] - lx) * .9, ly + 5, K.line, 1.2); }
    c.fillStyle = 'rgba(50,24,10,.18)'; c.fillRect(cx - bw, by - 12, bw * 2, 40);
    // upward-facing top surfaces
    const tp = pathFrom([Lp[n], ...crown, Rp[n], [tcx + tr * .55, topY + try_ * 1.2], [tcx - tr * .5, topY + try_ * 1.4]]);
    celFill(c, tp, K.top, K.topL, K.topD, { ld: 3, dd: 4 });
    c.strokeStyle = K.line; c.lineWidth = 1.2; c.globalAlpha = .6; c.stroke(tp); c.globalAlpha = 1;
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(sil);
    if (o.rubble !== false) for (let i = 0; i < 4; i++) {
      const x = cx + (i < 2 ? -1 : 1) * bw * (.42 + R() * .2), y = by + 2 + R() * 6, r = 4 + R() * 7;
      pebbleRock(c, x, y, r, K);
    }
    return { topY, tcx, tr, try_, Lp, Rp };
  }
  function pebbleRock(c, x, y, r, K) {
    fell(c, x + r * .4, y + 1, r * 1.1, r * .4, 'rgba(58,30,12,.28)');
    const p = new Path2D(); p.moveTo(x - r, y); p.quadraticCurveTo(x - r * .9, y - r * 1.1, x - r * .1, y - r * 1.05); p.quadraticCurveTo(x + r * .9, y - r, x + r, y); p.quadraticCurveTo(x, y + r * .3, x - r, y); p.closePath();
    celFill(c, p, K.base, K.light, K.dark, { ld: r * .35, dd: r * .4 });
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(p);
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
    if (o.shadow) fell(c, cx + rx * .35, ty + h + ry * .5, rx * 1.15, ry * 1.05, 'rgba(58,30,12,.26)');
    c.save();
    c.fillStyle = T.base; c.fill(p); c.clip(p);
    if (o.band) for (const [yo, bh, col] of o.band) {
      const y0 = ty + yo;
      c.beginPath(); c.ellipse(cx, y0, rx + 1, ry, 0, 0, Math.PI); c.lineTo(cx - rx - 1, y0 + bh);
      c.ellipse(cx, y0 + bh, rx + 1, ry, 0, Math.PI, 0, true); c.closePath(); c.fillStyle = col; c.fill();
    }
    if (o.paint) o.paint(c, g);
    c.fillStyle = 'rgba(255,248,230,.24)'; c.fillRect(cx - rx, ty - ry, rx * .4, h + ry * 2 + 2);
    c.fillStyle = 'rgba(70,30,30,.16)'; c.fillRect(cx + rx * .34, ty - ry, rx * .7, h + ry * 2 + 2);
    c.fillStyle = 'rgba(70,30,30,.2)'; c.fillRect(cx + rx * .76, ty - ry, rx * .3, h + ry * 2 + 2);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    return g;
  }
  function stoneCourses(c, g, step = 14) {
    const { cx, ty, rx, ry, h } = g;
    c.strokeStyle = 'rgba(90,55,35,.3)'; c.lineWidth = 1.1; c.beginPath();
    let row = 0;
    for (let yy = ty + step; yy < ty + h + ry; yy += step, row++) {
      c.moveTo(cx + rx, yy); c.ellipse(cx, yy, rx, ry, 0, 0, Math.PI);
      for (let a = .12 + (row % 2) * .19; a < Math.PI; a += .38) {
        const x = cx + rx * Math.cos(a), y = yy + ry * Math.sin(a);
        c.moveTo(x, y); c.lineTo(x, y + step);
      }
    }
    c.stroke();
  }
  function blockTex(c, x, y, w, h, step = 13) {
    c.strokeStyle = 'rgba(90,55,35,.28)'; c.lineWidth = 1.1; c.beginPath();
    for (let yy = y + step, row = 0; yy < y + h; yy += step, row++) {
      c.moveTo(x, yy); c.lineTo(x + w, yy);
      for (let xx = x + (row % 2) * 13 + 8; xx < x + w; xx += 26) { c.moveTo(xx, yy); c.lineTo(xx, Math.min(y + h, yy + step)); }
    }
    c.stroke();
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
  // flat round terrace with crenellated parapet on the front rim
  function terrace(c, g, R, top) {
    capFlat(c, g, R, top);
    for (let a = .1; a < Math.PI; a += .3) {
      const x = g.cx + g.rx * Math.cos(a), y = g.ty + g.ry * Math.sin(a);
      frect(c, x - 4, y - 8, 8, 8, R.light); frect(c, x + 1, y - 8, 3, 8, R.dark); srect(c, x - 4, y - 8, 8, 8, OUT, 1);
    }
  }
  function cone(c, cx, ty, rx, ry, h, R, ov = 6) {
    const ay = ty - h, L = cx - rx - ov, Rr = cx + rx + ov, ery = ry + ov * .4;
    const p = new Path2D(); p.moveTo(L, ty); p.lineTo(cx, ay); p.lineTo(Rr, ty); p.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); p.closePath();
    c.save(); c.fillStyle = R.base; c.fill(p); c.clip(p);
    fpoly(c, [L - 2, ty - 2, cx, ay, cx - rx * .22, ty + ery + 2, L - 2, ty + ery + 2], R.light);
    fpoly(c, [cx, ay, Rr + 2, ty - 2, Rr + 2, ty + ery + 2, cx + rx * .42, ty + ery + 2], R.dark);
    // stone slab courses
    c.strokeStyle = 'rgba(40,20,20,.24)'; c.lineWidth = 1.4; c.beginPath();
    for (let k = 1; k < 5; k++) { const t = k / 5, yy = ay + (ty - ay) * t; c.moveTo(cx + (rx + ov) * t, yy); c.ellipse(cx, yy, (rx + ov) * t, ery * t, 0, 0, Math.PI); }
    for (let i = -6; i <= 6; i++) { const t = i / 6.5 * 1.45; c.moveTo(cx + (rx + ov) * Math.sin(t) * .5, ay + (ty - ay) * .5 + ery * .5 * Math.cos(t)); c.lineTo(cx + (rx + ov) * Math.sin(t), ty + ery * Math.cos(t)); }
    c.stroke(); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx + ov, ery, 0, 0, Math.PI); sk(c, R.deep, 4);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    fell(c, cx, ay, 3.5, 3, R.deep);
  }
  function dome(c, cx, ty, rx, ry, dh, R) {
    const p = new Path2D(); p.moveTo(cx - rx, ty); p.ellipse(cx, ty, rx, dh, 0, Math.PI, TAU); p.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); p.closePath();
    celFill(c, p, R.base, R.light, R.dark, { ld: rx * .22, dd: rx * .32 });
    c.save(); c.clip(p); c.strokeStyle = 'rgba(40,20,20,.2)'; c.lineWidth = 1.3; c.beginPath();
    for (let k = 1; k < 4; k++) { const yy = ty - dh * k / 4, rr = rx * Math.sqrt(1 - (k / 4) ** 2); c.moveTo(cx + rr, yy); c.ellipse(cx, yy, rr, ry * rr / rx, 0, 0, Math.PI); }
    c.stroke(); c.restore();
    c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI); sk(c, R.deep, 3);
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(p);
    line(c, cx, ty - dh - 9, cx, ty - dh, '#4a3a30', 2); fell(c, cx, ty - dh - 9, 2.5, 2.5, '#d6a84a');
  }

  // ------------------------------------------------------------------ details
  function sWin(c, x, y, w, h, lit) {
    frect(c, x - 3, y - 4, w + 6, 4, '#8f7d66');
    frect(c, x, y, w, h, lit ? '#f4c66e' : '#2f2521');
    if (lit) { frect(c, x, y, w, 3, 'rgba(150,80,20,.45)'); frect(c, x, y + h * .55, w, h * .45, 'rgba(255,236,170,.5)'); }
    else fpoly(c, [x + w * .15, y + h, x + w * .55, y, x + w * .75, y, x + w * .35, y + h], 'rgba(130,160,180,.22)');
    if (w > 12) line(c, x + w / 2, y, x + w / 2, y + h, '#5a3d2b', 1.4);
    frect(c, x - 3, y + h, w + 6, 3, '#bfae90');
    srect(c, x, y, w, h, OUT, 1.2);
  }
  function cylWins(c, g, yo, n, ww, wh, R, span = 1.15, skip = 0, litP = .35) {
    for (let i = 0; i < n; i++) {
      const th = n === 1 ? 0 : -span + 2 * span * i / (n - 1);
      if (Math.abs(th) < skip) continue;
      const x = g.cx + g.rx * Math.sin(th), w = ww * Math.cos(th), y = g.ty + g.ry * Math.cos(th) + yo;
      sWin(c, x - w / 2, y, w, wh, R() < litP);
    }
  }
  function archDoor(c, x, y, w, h, col = '#6b4228', frame = '#a8977c') {
    const r = w / 2, p = new Path2D();
    p.moveTo(x, y + h); p.lineTo(x, y + r); p.arc(x + r, y + r, r, Math.PI, 0); p.lineTo(x + w, y + h); p.closePath();
    c.save(); c.lineWidth = 7; c.strokeStyle = frame; c.stroke(p); c.lineWidth = 1.2; c.strokeStyle = OUT; c.translate(0, 0); c.restore();
    c.fillStyle = col; c.fill(p);
    c.save(); c.clip(p);
    c.strokeStyle = 'rgba(30,15,8,.4)'; c.lineWidth = 1; c.beginPath();
    for (let i = x + 6; i < x + w; i += 6) { c.moveTo(i, y); c.lineTo(i, y + h); }
    c.stroke();
    frect(c, x, y, 3, h, 'rgba(255,220,180,.22)');
    frect(c, x, y + h * .35, w, 2.5, 'rgba(30,15,8,.5)'); frect(c, x, y + h * .72, w, 2.5, 'rgba(30,15,8,.5)');
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(p);
    fell(c, x + w - 6, y + h * .58, 1.8, 1.8, '#e2b86a');
  }
  function carvedWin(c, x, y, w, h, lit) {
    const r = w / 2, p = new Path2D();
    p.moveTo(x, y + h); p.lineTo(x, y + r); p.arc(x + r, y + r, r, Math.PI, 0); p.lineTo(x + w, y + h); p.closePath();
    c.save(); c.translate(-2, -2); c.fillStyle = 'rgba(255,220,170,.35)'; c.fill(p); c.restore();
    c.fillStyle = lit ? '#e9b45e' : '#2a1d18'; c.fill(p);
    c.save(); c.clip(p);
    frect(c, x, y, 5, h, 'rgba(20,8,4,.5)'); frect(c, x, y, w, 5, 'rgba(20,8,4,.45)');
    if (lit) { frect(c, x + 5, y + h * .5, w - 5, h * .5, 'rgba(255,240,190,.45)'); line(c, x + w / 2, y + 4, x + w / 2, y + h, '#5a3d2b', 1.5); }
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke(p);
    frect(c, x - 3, y + h, w + 6, 4, '#7a5636'); srect(c, x - 3, y + h, w + 6, 4, OUT, 1);
  }
  function steps(c, cx, y, n, w0, sh, col = '#c9b796') {
    for (let i = 0; i < n; i++) {
      const w = w0 + i * 12, yy = y + i * sh;
      frect(c, cx - w / 2, yy, w, sh, col); frect(c, cx - w / 2, yy, w, 2, 'rgba(255,248,230,.5)');
      frect(c, cx + w / 2 - 8, yy, 8, sh, 'rgba(60,30,20,.18)'); srect(c, cx - w / 2, yy, w, sh, OUT, 1.2);
    }
  }
  function awning(c, x, y, w, h, col) {
    const T = tone(col);
    fpoly(c, [x + 4, y, x + w - 4, y, x + w + 4, y + h, x - 4, y + h], T.base);
    c.save(); poly(c, [x + 4, y, x + w - 4, y, x + w + 4, y + h, x - 4, y + h]); c.clip();
    for (let i = 0; i < w + 8; i += 12) frect(c, x - 4 + i, y, 6, h, T.light);
    c.restore();
    c.beginPath(); c.moveTo(x - 4, y + h);
    for (let i = 0; i <= 8; i++) { const xx = x - 4 + (w + 8) * i / 8; c.quadraticCurveTo(xx - (w + 8) / 16, y + h + 5, xx, y + h); }
    c.lineTo(x - 4, y + h); c.fillStyle = T.dark; c.fill();
    poly(c, [x + 4, y, x + w - 4, y, x + w + 4, y + h, x - 4, y + h]); sk(c, OUT, 1.4);
    frect(c, x - 6, y - 3, w + 12, 4, '#5a3d2b');
  }
  // Iwagakure mark: a large and a small rock peak on a base line.
  function iwaMark(c, x, y, s, col, lw = .15) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-.95, .5); c.lineTo(-.42, -.72); c.lineTo(-.1, -.55); c.lineTo(.2, .05);
    c.moveTo(-.12, .5); c.lineTo(.42, -.28); c.lineTo(.62, -.18); c.lineTo(.95, .5);
    c.moveTo(-1.05, .5); c.lineTo(1.05, .5);
    c.moveTo(-.55, -.2); c.lineTo(-.3, .1);
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
    c.restore();
  }
  function banner(c, x, y, w, h, col, mark) {
    const T = tone(col);
    line(c, x - 4, y, x + w + 4, y, '#4a3020', 2.5);
    const p = pathFrom([[x, y], [x + w, y], [x + w, y + h], [x + w / 2, y + h - w * .35], [x, y + h]]);
    c.fillStyle = T.base; c.fill(p);
    c.save(); c.clip(p); frect(c, x, y, w * .25, h, T.light); frect(c, x + w * .78, y, w * .22, h, T.dark); c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(p);
    if (mark === 'iwa') iwaMark(c, x + w / 2, y + h * .32, w * .36, '#f2e4c4', .2);
    else if (mark) { const n = [...mark].length, sz = Math.min(w * .7, (h * .72) / n); txtV(c, mark, x + w / 2, y + 4, sz, '#f2e4c4'); }
  }
  function lantern(c, x, y, s = 1) {
    line(c, x, y - 12 * s, x, y - 8 * s, '#3a2a20', 1.5);
    frect(c, x - 4 * s, y - 9 * s, 8 * s, 3 * s, '#2d2420');
    fell(c, x, y, 6 * s, 8 * s, '#e0803a');
    c.save(); c.beginPath(); c.ellipse(x, y, 6 * s, 8 * s, 0, 0, TAU); c.clip();
    frect(c, x + 2 * s, y - 9 * s, 5 * s, 18 * s, 'rgba(110,30,10,.32)'); frect(c, x - 6 * s, y - 9 * s, 2.4 * s, 18 * s, 'rgba(255,220,170,.4)');
    c.restore();
    frect(c, x - 4 * s, y + 6 * s, 8 * s, 3 * s, '#2d2420');
    c.beginPath(); c.ellipse(x, y, 6 * s, 8 * s, 0, 0, TAU); sk(c, '#5a1a14', 1.1);
  }
  function stoneLanternAt(c, ax, ay, s = 1) {
    fell(c, ax + 8 * s, ay, 18 * s, 5 * s, 'rgba(58,30,12,.28)');
    const st = (x, y, w, h, col) => { frect(c, x, y, w, h, col); frect(c, x, y, w * .3, h, 'rgba(255,248,230,.25)'); frect(c, x + w * .72, y, w * .28, h, 'rgba(60,30,20,.2)'); srect(c, x, y, w, h, OUT, 1.2); };
    st(ax - 15 * s, ay - 8 * s, 30 * s, 8 * s, '#a89880');
    st(ax - 6 * s, ay - 30 * s, 12 * s, 22 * s, '#b4a48a');
    st(ax - 12 * s, ay - 34 * s, 24 * s, 5 * s, '#a89880');
    st(ax - 10 * s, ay - 50 * s, 20 * s, 16 * s, '#b4a48a');
    frect(c, ax - 5 * s, ay - 46 * s, 10 * s, 9 * s, '#ffd27a'); frect(c, ax - 5 * s, ay - 46 * s, 10 * s, 2 * s, 'rgba(150,80,20,.5)');
    fpoly(c, [ax - 17 * s, ay - 50 * s, ax + 17 * s, ay - 50 * s, ax + 8 * s, ay - 58 * s, ax - 8 * s, ay - 58 * s], '#9a8a72');
    poly(c, [ax - 17 * s, ay - 50 * s, ax + 17 * s, ay - 50 * s, ax + 8 * s, ay - 58 * s, ax - 8 * s, ay - 58 * s]); sk(c, OUT, 1.2);
    fell(c, ax, ay - 61 * s, 4 * s, 3.5 * s, '#9a8a72');
  }
  function grassTuft(c, x, y, s, R) {
    const cols = ['#b3a35c', '#978846', '#c7b673', '#8a7a3e'];
    c.lineWidth = 1.4 * s;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * .28 + (R() - .5) * .2, l = (6 + R() * 7) * s;
      c.beginPath(); c.moveTo(x + (k - 3) * s, y); c.quadraticCurveTo(x + Math.cos(a) * l * .4, y + Math.sin(a) * l * .6, x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.strokeStyle = cols[(k + Math.floor(R() * 4)) % 4]; c.stroke();
    }
  }
  function plankWalk(c, x, y, w, rail = true) {
    c.fillStyle = 'rgba(50,25,12,.3)'; c.fillRect(x, y + 10, w, 7);
    frect(c, x, y, w, 9, '#8b6a44');
    c.strokeStyle = '#5e4128'; c.lineWidth = 1; c.beginPath(); for (let i = x + 7; i < x + w; i += 7) { c.moveTo(i, y); c.lineTo(i, y + 9); } c.stroke();
    frect(c, x, y, w, 2, '#b08a5a'); srect(c, x, y, w, 9, OUT, 1.2);
    for (let px = x + 4; px < x + w; px += 40) { frect(c, px, y + 9, 4, 12, '#5e4128'); }
    if (rail) {
      for (let px = x + 2; px <= x + w; px += 20) line(c, px, y + 1, px, y - 14, '#5e4128', 2);
      line(c, x, y - 14, x + w, y - 14, '#6e4c2e', 2.5); line(c, x, y - 7, x + w, y - 7, '#6e4c2e', 1.4);
    }
  }
  function stairFlight(c, x0, y0, x1, y1, w = 20) {
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9));
    line(c, x0, y0 + 6, x1, y1 + 6, '#5e4128', 4);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      frect(c, x - w / 2, y - 2, w, 5, i % 2 ? '#9a774c' : '#8b6a44'); srect(c, x - w / 2, y - 2, w, 5, OUT, .9);
    }
    line(c, x0 + w / 2, y0 - 16, x1 + w / 2, y1 - 16, '#6e4c2e', 1.8);
    for (let i = 0; i <= n; i += 3) { const t = i / n; line(c, x0 + (x1 - x0) * t + w / 2, y0 + (y1 - y0) * t, x0 + (x1 - x0) * t + w / 2, y0 + (y1 - y0) * t - 16, '#5e4128', 1.6); }
  }
  function stoneRoof(c, x, y, w, d, Rf) {
    frect(c, x, y, w, d, Rf.light);
    frect(c, x + 7, y + 7, w - 14, d - 16, Rf.base);
    c.fillStyle = 'rgba(40,20,10,.22)'; c.fillRect(x + 7, y + 7, w - 14, 7); c.fillRect(x + 7, y + 14, 7, d - 23);
    c.strokeStyle = 'rgba(40,20,10,.12)'; c.lineWidth = 1; c.beginPath();
    for (let i = x + 34; i < x + w - 10; i += 30) { c.moveTo(i, y + 8); c.lineTo(i, y + d - 9); }
    for (let j = y + 30; j < y + d - 10; j += 24) { c.moveTo(x + 8, j); c.lineTo(x + w - 8, j); }
    c.stroke();
    frect(c, x, y + d - 9, w, 9, Rf.dark); frect(c, x, y + d - 9, w, 2, Rf.hi);
    srect(c, x + 1, y + 1, w - 2, d - 2, OUT, 2);
  }
  function stoneWall(c, x, y, w, h, W) {
    frect(c, x, y, w, h, W.base);
    blockTex(c, x, y, w, h);
    c.fillStyle = 'rgba(255,250,235,.22)'; c.fillRect(x + 2, y, 6, h);
    c.fillStyle = 'rgba(70,30,30,.15)'; c.fillRect(x + w - 10, y, 10, h);
    c.fillStyle = 'rgba(60,30,20,.26)'; c.fillRect(x, y, w, 6);
    frect(c, x, y + h - 8, w, 8, '#8f7c66'); frect(c, x, y + h - 8, w, 2, '#b4a28a');
    srect(c, x + 1, y + 1, w - 2, h - 2, OUT, 2);
  }
  function stoneBox(c, x, y, w, d, h, W, Rf) {
    c.fillStyle = 'rgba(58,30,12,.26)'; c.fillRect(x + 14, y + d + h - 6, w + 10, 14);
    stoneRoof(c, x - 4, y, w + 8, d, Rf);
    stoneWall(c, x, y + d, w, h, W);
    return { x, y: y + d, w, h };
  }
  function crates(c, x, y, R) {
    const box = (bx, by, s) => {
      fpoly(c, [bx, by - s, bx + s, by - s, bx + s + 6, by - s - 6, bx + 6, by - s - 6], '#b58a58');
      frect(c, bx, by - s, s, s, '#9a7046'); frect(c, bx + s - 4, by - s, 4, s, '#7a5434');
      line(c, bx, by - s, bx + s, by, '#6a4628', 1.2);
      fpoly(c, [bx + s, by - s, bx + s + 6, by - s - 6, bx + s + 6, by - 6, bx + s, by], '#6e4a2c');
      poly(c, [bx, by, bx, by - s, bx + 6, by - s - 6, bx + s + 6, by - s - 6, bx + s + 6, by - 6, bx + s, by]); sk(c, OUT, 1.2);
    };
    fell(c, x + 22, y + 1, 26, 6, 'rgba(58,30,12,.25)');
    box(x, y, 16); box(x + 18, y, 14);
    const px = x + 40;
    fell(c, px, y - 7, 7, 8, '#b0603a'); fell(c, px - 2, y - 9, 3, 4, 'rgba(255,220,180,.4)'); frect(c, px - 3, y - 17, 6, 3, '#8a4a2a');
    c.beginPath(); c.ellipse(px, y - 7, 7, 8, 0, 0, TAU); sk(c, OUT, 1);
    if (R() < .5) box(x + 6, y - 16, 12);
  }

  // ------------------------------------------------------------------ building variants (draw in footprint coords; y < 0 is overhang)
  const VDEF = {
    tsuchi: { w: 420, h: 420, oh: 110, fn: vTsuchi, npv: 1 },
    round: { w: 240, h: 220, oh: 80, fn: vRound, npv: 3, s: 1.2 },
    tiered: { w: 300, h: 290, oh: 110, fn: vTiered, npv: 1, s: 1.15 },
    pillar: { w: 220, h: 220, oh: 104, fn: vPillar, npv: 2, s: 1.22 },
    carved: { w: 360, h: 290, oh: 70, fn: vCarved, npv: 1, s: 1.1 },
    long: { w: 320, h: 230, oh: 56, fn: vLong, npv: 2, s: 1.15 },
    twin: { w: 360, h: 290, oh: 100, fn: vTwin, npv: 1, s: 1.1 },
    stack: { w: 320, h: 280, oh: 96, fn: vStack, npv: 2, s: 1.15 },
    spire: { w: 220, h: 210, oh: 106, fn: vSpire, npv: 2, s: 1.2, solid: true },
    mesa: { w: 380, h: 320, oh: 92, fn: vMesa, npv: 2, s: 1.05, solid: true }
  };
  for (const k in VDEF) { const D = VDEF[k], s = D.s || 1; D.s = s; D.W = Math.round(D.w * s); D.H = Math.round(D.h * s); D.OH = Math.round(D.oh * s); }

  function vRound(c, P) {
    const K = P.rock, W = P.wall, Rf = P.roof, R = P.R;
    rockPillar(c, 120, 166, 118, 40, 22, K, P.seed, { jag: .07, cracks: 1, strata: 30 });
    const g = cylinder(c, 120, 50, 84, 96, W, { band: [[0, 9, Rf.dark], [9, 2, Rf.deep]], paint: (cc, gg) => { stoneCourses(cc, gg, 13); cylWins(cc, gg, 28, 5, 15, 19, R, 1.2, .4, .4); } });
    cone(c, 120, 50, 84, g.ry, 70, Rf, 10);
    line(c, 120, 50 - 70 - 14, 120, 50 - 70, '#4a3a30', 2.5); fell(c, 120, 50 - 84, 3.5, 3.5, '#c9a24a');
    const fy = g.by + g.ry;
    archDoor(c, 104, fy - 46, 32, 45);
    steps(c, 120, fy, 3, 42, 8);
    banner(c, 66, g.by - 30, 16, 40, RED.base, 'iwa');
    lantern(c, 148, fy - 36, 1); P.lamps.push([148, fy - 36]);
    P.roofCol = Rf.base; P.wallCol = W.base;
  }
  function vTiered(c, P) {
    const K = P.rock, W = WALLS[0], W2 = WALLS[1], Rf = ROOFS[1], R = P.R;
    rockPillar(c, 150, 172, 142, 56, 62, K, P.seed, { jag: .07 });
    const t1 = cylinder(c, 150, 72, 104, 90, W, { band: [[0, 8, RED.base], [62, 4, W.dark]], paint: (cc, g) => { stoneCourses(cc, g, 14); cylWins(cc, g, 22, 7, 15, 20, R, 1.25, .35, .45); } });
    terrace(c, t1, tone('#b9a385'), '#a8916f');
    const t2 = cylinder(c, 150, 0, 66, 72, W2, { band: [[0, 7, RED.base]], paint: (cc, g) => { stoneCourses(cc, g, 13); cylWins(cc, g, 22, 5, 13, 18, R, 1.1, 0, .5); } });
    cone(c, 150, 0, 66, t2.ry, 62, Rf, 9);
    line(c, 150, -76, 150, -62, '#4a3a30', 2.5); fell(c, 150, -77, 3.5, 3.5, '#c9a24a');
    const fy = t1.by + t1.ry;
    archDoor(c, 134, fy - 50, 32, 48);
    awning(c, 126, fy - 64, 48, 12, RED.base);
    // carved stairs down the rock face
    for (let i = 0; i < 7; i++) { const w = 40 + i * 4, y = fy + 2 + i * 10; frect(c, 150 - w / 2, y, w, 10, i % 2 ? '#c8b18a' : '#bea67e'); frect(c, 150 - w / 2, y, w, 2, 'rgba(255,248,230,.45)'); srect(c, 150 - w / 2, y, w, 10, OUT, 1); }
    banner(c, 82, t1.by - 46, 16, 42, RED.base, 'iwa'); banner(c, 202, t1.by - 46, 16, 42, RED.base, 'iwa');
    lantern(c, 116, fy - 30); lantern(c, 184, fy - 30); P.lamps.push([116, fy - 30], [184, fy - 30]);
    P.anchors = { w: [48, 74], e: [252, 74] };
    P.roofCol = Rf.base; P.wallCol = W.base;
  }
  function vPillar(c, P) {
    const K = P.rock, W = P.wall, Rf = P.roof, R = P.R;
    const g = rockPillar(c, 110, 26, 88, 34, 148, K, P.seed, { flare: 1.14, jag: .1, cracks: 3 });
    // zig-zag wooden stairs up the face
    stairFlight(c, 40, 210, 156, 140);
    frect(c, 150, 134, 28, 8, '#8b6a44'); srect(c, 150, 134, 28, 8, OUT, 1);
    stairFlight(c, 164, 136, 66, 66);
    // hut on the summit
    const hut = cylinder(c, 112, -30, 50, 46, W, { paint: (cc, gg) => { stoneCourses(cc, gg, 12); cylWins(cc, gg, 14, 4, 11, 14, R, 1.1, .4, .5); } });
    cone(c, 112, -30, 50, hut.ry, 44, Rf, 8);
    fell(c, 112, -76, 3, 3, '#c9a24a');
    archDoor(c, 101, hut.by + hut.ry - 30, 22, 29);
    // rope railing along the front lip
    c.strokeStyle = '#7a5a3a'; c.lineWidth = 1.6; c.beginPath();
    let first = true;
    for (let a = .25; a < Math.PI - .2; a += .26) {
      const x = 110 + 82 * Math.cos(a), y = 26 + 30 * Math.sin(a);
      line(c, x, y + 2, x, y - 12, '#5e4128', 2.2);
      if (first) { c.beginPath(); c.moveTo(x, y - 11); first = false; } else c.lineTo(x, y - 11);
    }
    sk(c, '#7a5a3a', 1.5);
    banner(c, 168, -4, 12, 30, RED.base, 'iwa');
    lantern(c, 140, 8, .9); P.lamps.push([140, 8]);
    P.anchors = { w: [26, 26], e: [194, 26] };
    P.trickle = [150, 60, 214];
    P.roofCol = Rf.base; P.wallCol = K.base;
  }
  function vCarved(c, P) {
    const K = P.rock, R = P.R, Rf = ROOFS[0], W = WALLS[1];
    rockPillar(c, 180, 46, 172, 84, 150, K, P.seed, { p: 5, jag: .035, flare: 1.03, cracks: 2 });
    const fy = 130;
    for (const [x, lit] of [[40, 1], [96, 0], [244, 1], [300, 0]]) carvedWin(c, x, fy + 18, 24, 30, lit);
    plankWalk(c, 24, fy + 58, 312);
    for (const [x, lit] of [[42, 0], [100, 1], [240, 1], [296, 0]]) carvedWin(c, x, fy + 86, 26, 32, lit);
    archDoor(c, 158, fy + 82, 44, 64, '#6b4228', '#7a5636');
    awning(c, 146, fy + 70, 68, 14, Rf.base);
    signH(c, 154, fy + 26, 52, 18, '石屋', '#efe0bd', '#8e2f28');
    // ladder
    line(c, 336, fy + 66, 336, fy + 150, '#5e4128', 2.5); line(c, 348, fy + 66, 348, fy + 150, '#5e4128', 2.5);
    for (let y = fy + 74; y < fy + 150; y += 10) line(c, 336, y, 348, y, '#8b6a44', 2);
    // rooftop: hut, banner pole, dry grass, drying rack
    const hut = cylinder(c, 268, -10, 40, 34, W, { paint: (cc, gg) => { stoneCourses(cc, gg, 11); cylWins(cc, gg, 10, 3, 10, 12, R, 1, 0, .5); } });
    cone(c, 268, -10, 40, hut.ry, 36, Rf, 7);
    line(c, 70, 50, 70, -40, '#4a3020', 3); fell(c, 70, -42, 3, 3, '#c9a24a');
    banner(c, 72, -36, 20, 52, RED.base, 'iwa');
    line(c, 130, 20, 130, -6, '#5e4128', 2); line(c, 190, 30, 190, 4, '#5e4128', 2); line(c, 130, -4, 190, 6, '#6e4c2e', 1.2);
    for (let i = 0; i < 4; i++) frect(c, 138 + i * 12, -2 + i * 2, 8, 16, ['#e8dcc0', '#8e3328', '#5d7083', '#e8dcc0'][i]);
    for (let i = 0; i < 9; i++) grassTuft(c, 30 + R() * 300, 20 + R() * 90, 1.1, R);
    lantern(c, 140, fy + 98); lantern(c, 220, fy + 98); P.lamps.push([140, fy + 98], [220, fy + 98]);
    P.anchors = { w: [12, 46], e: [348, 46] };
    P.trickle = [320, 130, 286];
    P.roofCol = Rf.base; P.wallCol = K.base;
  }
  function signH(c, x, y, w, h, str, bg, fg, frame = '#4a3020') {
    frect(c, x - 2, y - 2, w + 4, h + 4, frame); frect(c, x, y, w, h, bg);
    const n = [...str].length;
    txt(c, str, x + w / 2, y + h / 2 + 1, Math.min(h * .78, (w - 6) / n), fg);
  }
  function vLong(c, P) {
    const W = P.wall, Rf = P.roof, R = P.R;
    fpoly(c, [312, 0, 332, 16, 332, 234, 26, 234, 12, 222, 312, 222], 'rgba(58,30,12,.24)');
    stoneRoof(c, 4, -22, 300, 118, Rf);
    // roof clutter
    frect(c, 52, 0, 22, 26, '#9a8a72'); frect(c, 52, 0, 22, 5, '#6a5a48'); srect(c, 52, 0, 22, 26, OUT, 1.2);
    for (let i = 0; i < 3; i++) { const x = 110 + i * 18; fell(c, x, 40, 8, 9, '#b0603a'); fell(c, x - 2, 37, 3, 4, 'rgba(255,220,180,.35)'); c.beginPath(); c.ellipse(x, 40, 8, 9, 0, 0, TAU); sk(c, OUT, 1); }
    frect(c, 176, 22, 60, 36, '#c8a85a'); c.strokeStyle = 'rgba(120,80,30,.4)'; c.lineWidth = 1; c.beginPath(); for (let i = 180; i < 236; i += 5) { c.moveTo(i, 22); c.lineTo(i, 58); } c.stroke(); srect(c, 176, 22, 60, 36, OUT, 1);
    stoneWall(c, 8, 96, 296, 126, W);
    for (const x of [26, 150, 196]) sWin(c, x, 114, 24, 22, R() < .45);
    archDoor(c, 74, 160, 36, 60);
    awning(c, 62, 146, 60, 16, RED.base);
    // shop counter with shutters
    frect(c, 150, 158, 96, 50, '#3a2a24'); frect(c, 150, 186, 96, 22, '#8b6a44'); frect(c, 150, 186, 96, 3, '#b08a5a'); srect(c, 150, 158, 96, 50, OUT, 1.4);
    for (let i = 0; i < 5; i++) fell(c, 162 + i * 18, 182, 6, 4, ['#d6a84a', '#8e3328', '#e8dcc0', '#7a8a4a', '#b0603a'][i]);
    awning(c, 144, 146, 108, 12, P.pv ? '#5d7083' : '#8e6a3a');
    signH(c, 124, 112, 18, 40, '', '#efe0bd', '#8e2f28');
    txtV(c, '岩宿', 133, 113, 16, '#8e2f28');
    const tw = cylinder(c, 286, 2, 36, 192, WALLS[(P.pv + 2) % 3], { band: [[0, 7, RED.base]], paint: (cc, gg) => { stoneCourses(cc, gg, 13); cylWins(cc, gg, 30, 2, 12, 16, R, .6, 0, .5); cylWins(cc, gg, 90, 2, 12, 16, R, .6, 0, .5); } });
    cone(c, 286, 2, 36, tw.ry, 48, Rf.base === ROOFS[3].base ? ROOFS[1] : Rf, 7);
    archDoor(c, 276, tw.by + tw.ry - 34, 22, 32);
    crates(c, 14, 230, R);
    lantern(c, 128, 172); P.lamps.push([128, 172]);
    P.roofCol = Rf.base; P.wallCol = W.base;
  }
  function vTwin(c, P) {
    const K = P.rock, R = P.R, W = WALLS[0], W2 = WALLS[1];
    rockPillar(c, 180, 190, 176, 54, 46, K, P.seed, { p: 4, jag: .06, cracks: 2, strata: 18 });
    const a = cylinder(c, 104, 4, 70, 172, W, { band: [[0, 9, RED.base], [86, 4, W.dark]], paint: (cc, g) => { stoneCourses(cc, g, 14); cylWins(cc, g, 26, 5, 15, 20, R, 1.15, 0, .45); cylWins(cc, g, 104, 5, 15, 20, R, 1.15, .4, .4); } });
    cone(c, 104, 4, 70, a.ry, 72, ROOFS[0], 9);
    line(c, 104, -84, 104, -68, '#4a3a30', 2.5); fell(c, 104, -85, 3.5, 3.5, '#c9a24a');
    const b = cylinder(c, 268, 64, 60, 112, W2, { band: [[0, 8, ROOFS[1].dark]], paint: (cc, g) => { stoneCourses(cc, g, 13); cylWins(cc, g, 24, 4, 14, 18, R, 1.1, 0, .5); cylWins(cc, g, 70, 4, 14, 18, R, 1.1, .35, .4); } });
    dome(c, 268, 64, 60, b.ry, 44, ROOFS[1]);
    // covered plank bridge linking the towers
    c.strokeStyle = '#6e4c2e'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(170, 70); c.quadraticCurveTo(190, 92, 212, 92); c.stroke();
    for (let i = 0; i < 6; i++) { const t = i / 5, x = 172 + 40 * t, y = 82 + 14 * t + Math.sin(t * Math.PI) * 6; frect(c, x - 3, y, 7, 8, '#8b6a44'); srect(c, x - 3, y, 7, 8, OUT, .8); }
    c.beginPath(); c.moveTo(172, 90); c.quadraticCurveTo(192, 112, 212, 104); sk(c, '#6e4c2e', 1.5);
    archDoor(c, 88, a.by + a.ry - 50, 32, 48);
    archDoor(c, 254, b.by + b.ry - 44, 28, 42);
    banner(c, 150, a.by - 44, 16, 40, RED.base, 'iwa');
    lantern(c, 130, a.by + a.ry - 40); P.lamps.push([130, a.by + a.ry - 40]);
    P.anchors = { w: [36, 50], e: [326, 92] };
    P.roofCol = ROOFS[0].base; P.wallCol = W.base;
  }
  function vStack(c, P) {
    const K = P.rock, W = P.wall, W2 = WALLS[(P.pv + 1) % 3], Rf = P.roof, Rf2 = ROOFS[3], R = P.R;
    rockPillar(c, 222, 40, 100, 44, 112, K, P.seed, { p: 3.4, jag: .1, cracks: 2 });
    const bk = stoneBox(c, 152, -76, 138, 50, 80, W, ROOFS[P.pv ? 2 : 3]);
    sWin(c, bk.x + 16, bk.y + 18, 22, 20, R() < .5); sWin(c, bk.x + 96, bk.y + 18, 22, 20, R() < .5);
    archDoor(c, bk.x + 54, bk.y + 24, 28, 54);
    awning(c, bk.x + 46, bk.y + 12, 44, 12, RED.base);
    // stairs: ground → ledge
    stairFlight(c, 300, 272, 236, 200, 22);
    frect(c, 222, 192, 28, 9, '#8b6a44'); srect(c, 222, 192, 28, 9, OUT, 1);
    stairFlight(c, 244, 194, 300, 90, 22);
    // front house
    const fr = stoneBox(c, 14, 118, 186, 52, 100, W2, Rf2);
    for (const x of [30, 136]) sWin(c, fr.x + x - 14, fr.y + 22, 26, 22, R() < .45);
    archDoor(c, fr.x + 66, fr.y + 36, 34, 62);
    awning(c, fr.x + 56, fr.y + 22, 54, 14, Rf.base === ROOFS[0].base ? '#5d7083' : RED.base);
    // laundry line between the houses
    c.beginPath(); c.moveTo(60, 128); c.quadraticCurveTo(110, 100, 160, -10); sk(c, '#5a4a3e', 1.2);
    for (let i = 0; i < 4; i++) { const t = .2 + i * .18, x = 60 + 100 * t, y = 128 - 138 * t + 18 * Math.sin(t * Math.PI); frect(c, x - 5, y, 10, 13, ['#e8dcc0', '#8e3328', '#d6a84a', '#5d7083'][i]); }
    crates(c, 150, 276, R);
    lantern(c, fr.x + 120, fr.y + 30); P.lamps.push([fr.x + 120, fr.y + 30]);
    P.roofCol = Rf2.base; P.wallCol = W2.base;
  }
  function vSpire(c, P) {
    const K = P.rock, R = P.R;
    const s = rockSpire(c, 110, 200, 180, 262 + P.pv * 10, K, P.seed, { top: .5, lean: P.pv ? .035 : -.035 });
    for (let i = 0; i < 3; i++) grassTuft(c, s.tcx - s.tr * .6 + i * s.tr * .5, s.topY + 2, 1, R);
    if (P.pv) { line(c, s.tcx + 8, s.topY + 4, s.tcx + 8, s.topY - 40, '#4a3020', 2.5); banner(c, s.tcx + 9, s.topY - 38, 14, 26, RED.base, 'iwa'); }
    P.anchors = { w: [40, 40], e: [180, 40] };
    P.trickle = [128, -30, 200];
    P.roofCol = K.dark; P.wallCol = K.base;
  }
  function vMesa(c, P) {
    const K = P.rock, R = P.R;
    rockPillar(c, 190, 46, 184, 88, 172, K, P.seed, { p: 3.2, jag: .12, bands: true, cracks: 5, strata: 17 });
    // a second, smaller rock step sits on the back of the summit
    rockPillar(c, 150 + P.pv * 70, 14, 104, 44, 34, K, P.seed + 5, { p: 2.6, jag: .14, shadow: false, cracks: 1, strata: 14 });
    for (let i = 0; i < 12; i++) { const a = R() * Math.PI * .9 + .1, d = .55 + R() * .35; grassTuft(c, 190 + Math.cos(a) * 170 * d, 46 + Math.sin(a) * 76 * d, 1.1, R); }
    for (let i = 0; i < 3; i++) { const a = R() * Math.PI, d = .5 + R() * .35; pebbleRock(c, 190 + Math.cos(a) * 160 * d, 52 + Math.sin(a) * 66 * d, 8 + R() * 9, K); }
    if (P.pv === 0) {
      // cairn + banner pole on the summit
      for (let i = 0; i < 4; i++) { const w = 26 - i * 5; fell(c, 120, 6 - i * 7, w / 2 + 1, 5, OUT); fell(c, 120, 6 - i * 7, w / 2, 4, i % 2 ? '#b4a48a' : '#a89880'); }
      line(c, 270, 70, 270, -10, '#4a3020', 3); banner(c, 272, -6, 18, 46, RED.base, 'iwa');
    } else {
      // small lookout platform
      for (const [x, y] of [[230, 40], [290, 40], [236, 10], [284, 10]]) line(c, x, y, x, y - 46, '#5e4128', 3);
      frect(c, 222, -42, 76, 10, '#8b6a44'); srect(c, 222, -42, 76, 10, OUT, 1.2);
      fpoly(c, [216, -66, 304, -66, 290, -82, 230, -82], ROOFS[0].base); poly(c, [216, -66, 304, -66, 290, -82, 230, -82]); sk(c, OUT, 1.4);
      line(c, 228, -42, 228, -66, '#5e4128', 2); line(c, 292, -42, 292, -66, '#5e4128', 2);
    }
    P.anchors = { w: [8, 56], e: [372, 56] };
    P.trickle = [260, 140, 306];
    P.roofCol = K.dark; P.wallCol = K.base;
  }
  // Tsuchikage residence: layered round tiers rising out of a rock mesa, 土 on its face.
  function vTsuchi(c, P) {
    const k = 420 / 440;
    c.save(); c.scale(k, k);
    const K = P.rock, K2 = ROCKS[2], W = tone('#d8c6a2'), W2 = tone('#cdb995'), RF = tone('#5a6b7c'), R = P.R;
    rockSpire(c, 48, 304, 104, 330, K2, P.seed + 11, { lean: -.05, top: .44 });
    rockSpire(c, 394, 290, 96, 300, K2, P.seed + 12, { lean: .05, top: .46 });
    rockPillar(c, 220, 262, 208, 80, 96, K, P.seed, { jag: .06, cracks: 4 });
    const t1 = cylinder(c, 220, 150, 150, 104, W, { band: [[0, 12, RED.base], [12, 3, RED.deep], [88, 4, W.dark]], paint: (cc, g) => { stoneCourses(cc, g, 15); cylWins(cc, g, 24, 9, 17, 24, R, 1.3, .44, .5); cylWins(cc, g, 62, 9, 14, 18, R, 1.3, .44, .35); } });
    // rock arms hugging the base of tier 1
    rockSpire(c, 92, 334, 92, 104, K, P.seed + 21, { top: .5, lean: -.12, shadow: false, rubble: false });
    rockSpire(c, 350, 334, 92, 96, K, P.seed + 22, { top: .5, lean: .12, shadow: false, rubble: false });
    terrace(c, t1, tone('#b9a385'), '#a8916f');
    const t2 = cylinder(c, 220, 62, 104, 88, W2, { band: [[0, 10, RED.base], [10, 3, RED.deep]], paint: (cc, g) => { stoneCourses(cc, g, 14); cylWins(cc, g, 28, 7, 16, 22, R, 1.25, 0, .55); } });
    terrace(c, t2, tone('#b9a385'), '#a8916f');
    const t3 = cylinder(c, 220, 0, 64, 64, W, { band: [[0, 8, RED.base]], paint: (cc, g) => { cylWins(cc, g, 22, 5, 13, 18, R, 1.1, 0, .6); } });
    cone(c, 220, 0, 64, t3.ry, 80, RF, 10);
    line(c, 220, -104, 220, -80, '#4a3a30', 3); fell(c, 220, -104, 4.5, 4.5, '#d6a84a');
    // flag poles on tier 2 (cloth flutters in drawAmbient)
    line(c, 132, 74, 132, 22, '#4a3020', 2.5); line(c, 308, 74, 308, 22, '#4a3020', 2.5);
    fell(c, 132, 21, 2.5, 2.5, '#d6a84a'); fell(c, 308, 21, 2.5, 2.5, '#d6a84a');
    // 土 emblem
    fell(c, 220, 262, 37, 37, RED.deep); fell(c, 220, 262, 32, 32, '#f4e6c6');
    c.beginPath(); c.arc(220, 262, 27, 0, TAU); sk(c, RED.base, 2.5);
    txt(c, '土', 220, 265, 40, '#8e2f28', { weight: '900' });
    // carved gate in the rock face + stairs to the plaza
    c.save(); c.beginPath(); c.moveTo(180, 436); c.lineTo(180, 392); c.arc(220, 392, 40, Math.PI, 0); c.lineTo(260, 436); c.closePath(); c.fillStyle = 'rgba(40,18,8,.45)'; c.fill(); c.restore();
    archDoor(c, 190, 372, 60, 62, '#5e3a22', '#8a6a4a');
    line(c, 220, 380, 220, 434, '#3a2416', 2);
    signH(c, 186, 344, 68, 20, '土影', '#efe0bd', '#8e2f28');
    steps(c, 220, 434, 2, 96, 7, '#c9b796');
    banner(c, 120, 342, 24, 72, RED.base, '土影');
    banner(c, 296, 342, 24, 72, RED.base, 'iwa');
    stoneLanternAt(c, 160, 446, .9); stoneLanternAt(c, 280, 446, .9);
    c.restore();
    const S = v => v.map(n => n * k);
    P.lamps.push(S([160, 402]), S([280, 402]));
    P.flags = [S([132, 22]), S([308, 22])];
    P.anchors = { w: S([66, 152]), e: S([374, 152]) };
    P.roofCol = RF.base; P.wallCol = W.base;
  }

  // ------------------------------------------------------------------ village plan
  // T tsuchikage, R/B round house, I tiered tower, P house on pillar, C carved mesa, L longhouse,
  // W twin towers, K stacked houses, S rock spire (solid), M mesa (solid), . open ground
  const MAP = [
    'MS.P.S..PM',
    'S.R.C..W.S',
    '.K..P.I.R.',
    'P.R.LT.R.S',
    'S.W.....P.',
    '..R.L.B.P.',
    'MI..C.K..R',
    '..P.KR.S..',
    'SP..R.L.PM',
    'M.S......M'
  ];
  const LET = { T: ['tsuchi', 0], R: ['round', -1], B: ['round', 1], I: ['tiered', 0], P: ['pillar', -1], C: ['carved', 0], L: ['long', -1], W: ['twin', 0], K: ['stack', -1], S: ['spire', -1], M: ['mesa', -1] };
  const BRIDGE_PAIRS = [[[0, 0], 'e', [1, 0], 'w'], [[0, 6], 'e', [1, 6], 'w'], [[8, 8], 'e', [9, 8], 'w'], [[5, 3], 'e', [6, 2], 'w'],
    [[8, 4], 'e', [9, 3], 'w'], [[0, 8], 'e', [1, 8], 'w'], [[7, 7], 'e', [8, 8], 'w'], [[8, 0], 'e', [9, 0], 'w'], [[1, 8], 'e', [2, 7], 'w'], [[4, 2], 'e', [5, 3], 'w']];
  // walkways: [points], width
  const PATH_DEFS = [
    [[[GATE_X, SIZE + 20], [GATE_X, 2760], [2660, 2600]], 170],
    [[[560, 2600], [SIZE - 560, 2600]], 100],
    [[[1560, 470], [1560, SIZE - 470]], 100],
    [[[3640, 470], [3640, SIZE - 470]], 100],
    [[[520, 1040], [SIZE - 520, 1040]], 90],
    [[[520, 4160], [SIZE - 520, 4160]], 90]
  ];

  const FP = [];          // public footprints
  const CELLS = {};       // 'cx,cy' -> footprint index
  const FPX = [];         // internal footprint info
  (function planLayout() {
    for (let cy = 0; cy < NCELL; cy++) for (let cx = 0; cx < NCELL; cx++) {
      const ch = MAP[cy][cx], L = LET[ch]; if (!L) continue;
      const type = L[0], D = VDEF[type];
      let pv = L[1] >= 0 ? L[1] : Math.floor(hash2(cx, cy, 7) * D.npv);
      if (ch === 'R') pv = hash2(cx, cy, 9) < .5 ? 0 : 2;
      const gx = cx * BLOCK, gy = cy * BLOCK;
      let x, y;
      if (type === 'tsuchi') { x = gx + 50; y = gy + 60; }
      else {
        const sx = BLOCK - D.W, sy = BLOCK - D.H;
        x = gx + sx / 2 + (hash2(cx, cy, 31) - .5) * Math.max(0, sx - 124);
        y = gy + sy / 2 + (hash2(cx, cy, 37) - .5) * Math.max(0, sy - 124);
        if (cx === 4 && cy >= 5) x = Math.min(x, GATE_X - 110 - D.W);
        if (cx === 5 && cy >= 5) x = Math.max(x, GATE_X + 110);
        if (cx === 4 && cy === 3) x = Math.min(x, 2650 - 125 - D.W);
        x = Math.max(gx + 4, x);
      }
      x = Math.round(x); y = Math.round(y);
      CELLS[cx + ',' + cy] = FP.length;
      FPX.push({ type, pv, cx, cy, x, y, w: D.W, h: D.H, solid: !!D.solid });
      FP.push({ x, y, w: D.W, h: D.H, solid: !!D.solid });
    }
  })();

  // point-to-segment distance for keeping props off the walkways
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }

  // ------------------------------------------------------------------ assets
  const A = {};
  const VARIANT_CACHE = {};
  const ITEMS = [];   // painter-sorted static sprites
  const DECALS = [];
  const SHELVES = [];
  const PATHS = [];
  const BRIDGES = [];
  const TRICKLES = [];
  const FLAGS = [];
  const LANTERNS = [];
  let ready = false, lastDZ = null;

  function buildVariant(type, pv) {
    const key = type + ':' + pv;
    if (VARIANT_CACHE[key]) return VARIANT_CACHE[key];
    const D = VDEF[type], cw = D.W + PADX * 2, ch = D.OH + D.H + PADB;
    const cv = mk(cw, ch), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    c.translate(PADX, D.OH); c.scale(D.s, D.s);
    const seed = 1000 + Object.keys(VDEF).indexOf(type) * 97 + pv * 13;
    const rockIdx = { pillar: pv ? 1 : 0, spire: pv ? 2 : 0, mesa: pv ? 0 : 1, stack: pv ? 1 : 0, round: pv === 1 ? 1 : 0 }[type] ?? 0;
    const P = { pv, seed, R: rng(seed * 7 + 3), lamps: [], anchors: {}, flags: [], trickle: null,
      rock: ROCKS[rockIdx], roof: ROOFS[[0, 1, 2][pv % 3]], wall: WALLS[pv % 3], roofCol: '#8b3a2f', wallCol: '#d9c9a9' };
    if (type === 'long') { P.roof = pv ? ROOFS[0] : ROOFS[3]; P.wall = pv ? WALLS[0] : WALLS[1]; }
    if (type === 'pillar') { P.roof = pv ? ROOFS[1] : ROOFS[0]; P.wall = pv ? WALLS[1] : WALLS[0]; }
    if (type === 'stack') { P.roof = pv ? ROOFS[1] : ROOFS[0]; P.wall = pv ? WALLS[1] : WALLS[0]; }
    D.fn(c, P);
    const S = v => v && v.map(n => Math.round(n * D.s));
    const anchors = {}; for (const k in P.anchors) anchors[k] = S(P.anchors[k]);
    return (VARIANT_CACHE[key] = { cv, ox: -PADX, oy: -D.OH, lamps: P.lamps.map(S), anchors, flags: P.flags.map(S), trickle: S(P.trickle), roofCol: P.roofCol, wallCol: P.wallCol });
  }

  function makeGroundTile() {
    const S = 512, cv = mk(S, S), c = cv.getContext('2d'), R = rng(9001);
    frect(c, 0, 0, S, S, GROUND.base);
    for (let i = 0; i < 34; i++) { const x = R() * S, y = R() * S, rx = 30 + R() * 70, col = [GROUND.light, GROUND.dark, '#b5915f'][i % 3]; wrapAt(S, x, y, rx, (px, py) => { c.globalAlpha = .55; fell(c, px, py, rx, rx * .45, col); c.globalAlpha = 1; }); }
    // fine grit
    for (let i = 0; i < 900; i++) { const x = R() * S, y = R() * S; c.fillStyle = R() < .5 ? 'rgba(120,85,50,.35)' : 'rgba(225,195,150,.35)'; c.fillRect(x, y, 2, 1.5); }
    // cracks in the dry earth
    for (let i = 0; i < 14; i++) {
      const pts = []; let x = R() * S, y = R() * S, a = R() * TAU;
      const n = 6 + Math.floor(R() * 8);
      for (let k = 0; k < n; k++) { pts.push([x, y]); a += (R() - .5) * 1.1; const l = 8 + R() * 12; x += Math.cos(a) * l; y += Math.sin(a) * l * .7; }
      pts.push([x, y]);
      const br = R() < .6 ? Math.floor(pts.length / 2) : -1;
      for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
        const draw = (col, lw, dx, dy) => { c.beginPath(); pts.forEach(([px, py], j) => j ? c.lineTo(px + ox + dx, py + oy + dy) : c.moveTo(px + ox + dx, py + oy + dy)); sk(c, col, lw); };
        draw(GROUND.crackHi, 1.2, 1, 1.5); draw(GROUND.crack, 1.7, 0, 0);
        if (br >= 0) { const [bx, by] = pts[br]; line(c, bx + ox, by + oy, bx + ox + 14 * Math.cos(a + 1), by + oy + 10 * Math.sin(a + 1), GROUND.crack, 1.2); }
      }
    }
    // pebbles
    for (let i = 0; i < 170; i++) {
      const x = R() * S, y = R() * S, r = 1.3 + R() * 3;
      wrapAt(S, x, y, 6, (px, py) => { fell(c, px + .8, py + .8, r, r * .7, '#7f6040'); fell(c, px, py, r, r * .7, ['#c4a37a', '#b0906a', '#c9b49a'][i % 3]); fell(c, px - r * .3, py - r * .3, r * .45, r * .3, '#e6d2b0'); });
    }
    // sparse dry grass
    for (let i = 0; i < 22; i++) { const x = R() * S, y = R() * S; wrapAt(S, x, y, 14, (px, py) => grassTuft(c, px, py, .9 + R() * .3, R)); }
    return cv;
  }
  function makePathTile() {
    const S = 256, cv = mk(S, S), c = cv.getContext('2d'), R = rng(5150), G = 32;
    frect(c, 0, 0, S, S, '#a98a62');
    const cols = ['#d4bb93', '#cbb089', '#dbc6a0', '#c2a67d', '#cfb48a'];
    for (let j = 0; j < S / G; j++) for (let i = 0; i < S / G; i++) {
      const off = (j % 2) * G / 2;
      for (const ox of [0, -S]) {
        const x = i * G + off + ox + 2 + R() * 2, y = j * G + 2 + R() * 2, w = G - 4 - R() * 3, h = G - 4 - R() * 3;
        c.beginPath(); c.moveTo(x + 5, y); c.lineTo(x + w - 3, y + R() * 2); c.lineTo(x + w, y + h - 5); c.lineTo(x + w - 5, y + h); c.lineTo(x + 3, y + h - R() * 2); c.lineTo(x, y + 5); c.closePath();
        c.fillStyle = cols[(i * 7 + j * 3) % 5]; c.fill();
        c.save(); c.clip(); frect(c, x + w - 5, y, 6, h, 'rgba(90,60,30,.18)'); frect(c, x, y + h - 4, w, 5, 'rgba(90,60,30,.16)'); frect(c, x, y, w, 3, 'rgba(255,245,220,.35)'); c.restore();
      }
    }
    for (let i = 0; i < 60; i++) { const x = R() * S, y = R() * S; fell(c, x, y, 1.2, 1, 'rgba(110,80,50,.45)'); }
    return cv;
  }
  function makePlaza(r) {
    const S = r * 2 + 24, cv = mk(S, S), c = cv.getContext('2d'), m = S / 2, R = rng(77);
    fell(c, m + 6, m + 8, r + 10, r + 10, 'rgba(70,40,20,.22)');
    fell(c, m, m, r + 10, r + 10, '#7d5d40');
    fell(c, m, m, r + 4, r + 4, '#a88a64');
    fell(c, m, m, r - 6, r - 6, '#a98a62');
    const cols = ['#d8c29c', '#cfb68e', '#e0cba6', '#c8ad84', '#d3bb94'];
    for (let rr = r - 8, ring = 0; rr > 86; rr -= 30, ring++) {
      const inner = rr - 27, n = Math.max(8, Math.round(TAU * rr / 54)), off = R() * TAU;
      for (let i = 0; i < n; i++) {
        const a0 = off + i / n * TAU + 1.5 / rr, a1 = off + (i + 1) / n * TAU - 1.5 / rr;
        c.beginPath(); c.arc(m, m, rr, a0, a1); c.arc(m, m, inner, a1, a0, true); c.closePath();
        c.fillStyle = cols[Math.floor(R() * 5)]; c.fill();
        c.strokeStyle = 'rgba(110,80,50,.5)'; c.lineWidth = 1; c.stroke();
      }
    }
    // rim blocks
    for (let i = 0; i < 64; i++) { const a0 = i / 64 * TAU, a1 = (i + .9) / 64 * TAU; c.beginPath(); c.arc(m, m, r + 9, a0, a1); c.arc(m, m, r - 2, a1, a0, true); c.closePath(); c.fillStyle = i % 2 ? '#9a7d5c' : '#8d7052'; c.fill(); }
    c.beginPath(); c.arc(m, m, r + 9, 0, TAU); sk(c, OUT, 2);
    // central medallion with the Iwa mark
    fell(c, m, m, 84, 84, '#6e4c32'); fell(c, m, m, 77, 77, '#c8ad84'); fell(c, m, m, 66, 66, '#b9975f');
    c.beginPath(); c.arc(m, m, 66, 0, TAU); sk(c, '#6e4c32', 2.5);
    iwaMark(c, m, m + 6, 46, '#7a3328', .15);
    c.fillStyle = 'rgba(255,245,215,.10)'; c.beginPath(); c.arc(m - 30, m - 30, r * .8, 0, TAU); c.fill();
    return cv;
  }
  function makeDecal(seed) {
    const w = 260, h = 140, cv = mk(w, h), c = cv.getContext('2d'), R = rng(seed);
    for (let i = 0; i < 6; i++) { c.globalAlpha = .18; fell(c, 60 + R() * 140, 40 + R() * 60, 40 + R() * 50, 18 + R() * 20, R() < .6 ? '#8a6640' : '#c7a678'); }
    c.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      let x = 50 + R() * 160, y = 40 + R() * 60, a = R() * TAU; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 7; k++) { a += (R() - .5) * 1.2; x += Math.cos(a) * 12; y += Math.sin(a) * 8; c.lineTo(x, y); }
      sk(c, 'rgba(110,75,45,.7)', 1.6);
    }
    for (let i = 0; i < 14; i++) { const x = 30 + R() * 200, y = 20 + R() * 100, r = 1.5 + R() * 3; fell(c, x + .8, y + .8, r, r * .7, '#7f6040'); fell(c, x, y, r, r * .7, '#c4a37a'); }
    return cv;
  }
  // low flat rock shelf: walkable ground-level slab with a short lit lip
  function makeShelf(seed, K) {
    const R = rng(seed), w = 150 + Math.floor(R() * 90), d = 70 + Math.floor(R() * 40), lip = 9 + Math.floor(R() * 6);
    const cv = mk(w + 30, d + lip + 24), c = cv.getContext('2d'); c.lineJoin = 'round';
    const cx = w / 2 + 8, cy = d / 2 + 6, pts = [];
    for (let i = 0; i < 18; i++) { const [u, v] = sePt(i / 18 * TAU, 2.2), j = .86 + (R() - .5) * .3 + (i % 5 === 2 ? -.12 : 0); pts.push([cx + u * w / 2 * j, cy + v * d / 2 * j]); }
    const front = pts.slice(0, 10), face = pathFrom([...front, ...front.slice().reverse().map(([x, y]) => [x, y + lip])]);
    c.fillStyle = 'rgba(58,30,12,.22)'; c.fill(pathFrom(pts.map(([x, y]) => [x + 10, y + lip + 6])));
    celFill(c, face, K.base, K.light, K.dark, { ld: 4, dd: 10 });
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(face);
    const top = pathFrom(pts);
    celFill(c, top, mix(K.top, GROUND.base, .35), mix(K.topL, GROUND.light, .3), K.topD, { ld: 4, dd: 5 });
    c.save(); c.clip(top);
    for (let i = 0; i < 3; i++) { let x = cx + (R() - .5) * w * .6, y = cy + (R() - .5) * d * .5, a = R() * TAU; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { a += (R() - .5) * 1.2; x += Math.cos(a) * 11; y += Math.sin(a) * 6; c.lineTo(x, y); } sk(c, K.line, 1.3); }
    for (let i = 0; i < 3; i++) grassTuft(c, cx + (R() - .5) * w * .7, cy + (R() - .5) * d * .5, .9, R);
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(top);
    return cv;
  }
  // --- small props
  function makeBoulder(r, K, seed) {
    const w = Math.ceil(r * 3 + 16), h = Math.ceil(r * 2.1 + 14);
    return sprite(w, h, Math.round(w * .42), h - 6, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + r * .55, ay, r * 1.3, r * .38, 'rgba(58,30,12,.3)');
      const pts = [];
      for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI, j = 1 + (R() - .5) * .22; pts.push([ax + Math.cos(a) * r * j, ay - r * .12 + Math.sin(a) * r * 1.0 * j]); }
      pts.push([ax + r * .7, ay + r * .14], [ax - r * .7, ay + r * .14]);
      const p = pathFrom(pts);
      celFill(c, p, K.base, K.light, K.dark, { ld: r * .3, dd: r * .38 });
      c.save(); c.clip(p);
      fell(c, ax - r * .2, ay - r * .78, r * .5, r * .22, K.topL);
      line(c, ax - r * .1, ay - r * .5, ax + r * .25, ay - r * .05, K.line, 1.2);
      c.restore();
      c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(p);
    });
  }
  function makeCluster(K, seed) {
    return sprite(110, 70, 50, 62, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + 14, ay, 46, 10, 'rgba(58,30,12,.28)');
      pebbleRock(c, ax - 20, ay - 6, 12 + R() * 4, K);
      pebbleRock(c, ax + 14, ay - 8, 18 + R() * 5, K);
      pebbleRock(c, ax - 2, ay, 10 + R() * 4, K);
      pebbleRock(c, ax + 34, ay - 1, 7, K);
    });
  }
  function makeDryBush(r, seed) {
    const w = Math.ceil(r * 2.6 + 12), h = Math.ceil(r * 1.6 + 10);
    return sprite(w, h, w / 2, h - 4, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + r * .4, ay, r * 1.05, r * .3, 'rgba(58,30,12,.28)');
      const cols = ['#7a6a3a', '#8f7f48', '#a6955a', '#6a5a32'];
      c.lineWidth = 1.4;
      for (let i = 0; i < 30; i++) {
        const a = -Math.PI * (.08 + R() * .84), l = r * (.55 + R() * .5);
        c.beginPath(); c.moveTo(ax + (R() - .5) * 6, ay); c.quadraticCurveTo(ax + Math.cos(a) * l * .5 + (R() - .5) * 8, ay + Math.sin(a) * l * .5, ax + Math.cos(a) * l, ay + Math.sin(a) * l * .8);
        c.strokeStyle = cols[i % 4]; c.stroke();
      }
      for (let i = 0; i < 12; i++) { const a = -Math.PI * (.1 + R() * .8), l = r * (.4 + R() * .5); fell(c, ax + Math.cos(a) * l, ay + Math.sin(a) * l * .8, 2.4, 1.8, R() < .5 ? '#8f8a4a' : '#a3a058'); }
    });
  }
  function makeDeadTree(seed) {
    return sprite(110, 120, 52, 114, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + 20, ay, 30, 7, 'rgba(58,30,12,.28)');
      const br = (x, y, a, l, w, d) => {
        const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
        c.lineWidth = w + 2; c.strokeStyle = OUT; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
        c.lineWidth = w; c.strokeStyle = d === 0 ? '#6e5038' : '#7d5e44'; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
        if (d < 3) { br(x2, y2, a - .4 - R() * .3, l * .7, w * .65, d + 1); br(x2, y2, a + .35 + R() * .3, l * .62, w * .6, d + 1); }
      };
      br(ax, ay, -Math.PI / 2 + (R() - .5) * .3, 42, 7, 0);
      line(c, ax - 2, ay - 4, ax - 2, ay - 36, 'rgba(255,220,180,.25)', 2);
    });
  }
  function makeTuftSprite(seed) { return sprite(40, 26, 20, 22, (c, ax, ay) => { const R = rng(seed); grassTuft(c, ax - 6, ay, 1.2, R); grassTuft(c, ax + 6, ay + 1, 1, R); }); }
  function makeStoneLantern() { return sprite(50, 76, 22, 70, (c, ax, ay) => stoneLanternAt(c, ax, ay, 1)); }
  function makeBannerPole(seed) {
    return sprite(60, 150, 18, 144, (c, ax, ay) => {
      fell(c, ax + 12, ay, 18, 5, 'rgba(58,30,12,.28)');
      frect(c, ax - 9, ay - 8, 18, 8, '#a89880'); srect(c, ax - 9, ay - 8, 18, 8, OUT, 1.1);
      line(c, ax, ay - 6, ax, ay - 132, OUT, 5); line(c, ax, ay - 6, ax, ay - 132, '#5e4128', 3);
      fell(c, ax, ay - 134, 3, 3, '#d6a84a');
      banner(c, ax + 2, ay - 124, 22, 70, seed % 2 ? RED.base : '#5d6f80', 'iwa');
    });
  }
  function makeCairn() {
    return sprite(44, 50, 22, 44, (c, ax, ay) => {
      fell(c, ax + 8, ay, 18, 5, 'rgba(58,30,12,.28)');
      for (let i = 0; i < 5; i++) { const w = 30 - i * 5, y = ay - 4 - i * 7; fell(c, ax + (i % 2 ? 1 : -1), y, w / 2 + 1.2, 5.2, OUT); fell(c, ax + (i % 2 ? 1 : -1), y, w / 2, 4.2, i % 2 ? '#b4a48a' : '#9f8f76'); fell(c, ax - 3, y - 1.5, w / 4, 1.5, 'rgba(255,248,230,.35)'); }
    });
  }
  function makeCrates(seed) { return sprite(76, 60, 14, 52, (c, ax, ay) => crates(c, ax, ay, rng(seed))); }
  function makeGatePillar(seed, flip) {
    return sprite(150, 270, 75, 256, (c, ax, ay) => {
      const s = rockSpire(c, ax, ay, 110, 220, ROCKS[0], seed, { top: .62, lean: flip ? .02 : -.02 });
      // rope lashing
      for (let k = 0; k < 3; k++) { const y = ay - 150 + k * 7; c.beginPath(); c.ellipse(s.tcx - (flip ? -4 : 4), y, 34, 6, 0, 0, Math.PI); sk(c, '#8a6a3a', 2.5); }
      frect(c, s.tcx - 8, s.topY - 36, 16, 34, '#5e4128'); srect(c, s.tcx - 8, s.topY - 36, 16, 34, OUT, 1.2);
    });
  }
  function makeGateBeam() {
    const w = 420, h = 130, cv = mk(w, h), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    // thick log beam
    const by = 28;
    frect(c, 10, by, w - 20, 18, '#7a5636'); frect(c, 10, by, w - 20, 5, '#a07a4e'); frect(c, 10, by + 13, w - 20, 5, '#5a3d24'); srect(c, 10, by, w - 20, 18, OUT, 2);
    fell(c, 10, by + 9, 6, 9, '#c8a070'); fell(c, w - 10, by + 9, 6, 9, '#c8a070');
    for (const x of [44, w - 44]) for (let k = 0; k < 4; k++) line(c, x - 8 + k * 5, by - 2, x - 12 + k * 5, by + 20, '#c2a066', 2);
    // hanging sign 岩
    line(c, w / 2 - 30, by + 18, w / 2 - 26, by + 34, '#6e4c2e', 2); line(c, w / 2 + 30, by + 18, w / 2 + 26, by + 34, '#6e4c2e', 2);
    frect(c, w / 2 - 40, by + 32, 80, 52, '#5e4128'); frect(c, w / 2 - 35, by + 37, 70, 42, '#e9dcbc'); srect(c, w / 2 - 40, by + 32, 80, 52, OUT, 2);
    txt(c, '岩', w / 2 - 12, by + 59, 32, '#8e2f28', { weight: '900' });
    iwaMark(c, w / 2 + 20, by + 59, 11, '#5e4128', .2);
    for (const x of [96, w - 96]) { line(c, x, by + 18, x, by + 34, '#3a2a20', 1.5); lantern(c, x, by + 44, 1.2); }
    for (const x of [140, w - 140]) { c.save(); banner(c, x - 9, by + 18, 18, 48, RED.base, 'iwa'); c.restore(); }
    return cv;
  }
  function makeBridge(A1, B1, sag, planked) {
    const x0 = Math.min(A1[0], B1[0]) - 30, y0 = Math.min(A1[1], B1[1]) - 40;
    const x1 = Math.max(A1[0], B1[0]) + 30, y1 = Math.max(A1[1], B1[1]) + sag + 40;
    const cv = mk(x1 - x0, y1 - y0), c = cv.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
    c.translate(-x0, -y0);
    const ax = A1[0], ay = A1[1], bx = B1[0], by = B1[1];
    const mxp = (ax + bx) / 2, myp = (ay + by) / 2 + sag * 2;
    const q = t => [(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mxp + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * myp + t * t * by];
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(8, Math.round(len / 11));
    const rope = (dy, col, lw, extra) => { c.beginPath(); for (let i = 0; i <= 24; i++) { const [x, y] = q(i / 24); const yy = y + dy - (extra ? Math.sin(i / 24 * Math.PI) * extra : 0); i ? c.lineTo(x, yy) : c.moveTo(x, yy); } sk(c, col, lw); };
    // far hand rope + suspenders
    rope(-20, '#6a4c30', 2, sag * .55);
    for (let i = 0; i <= n; i += 2) { const t = i / n, [x, y] = q(t); line(c, x, y - 1, x, y - 20 + Math.sin(t * Math.PI) * sag * .55 * -1 + 0, '#6a4c30', 1); }
    // deck
    rope(0, OUT, 4); rope(8, OUT, 4);
    for (let i = 0; i <= n; i++) {
      const t = i / n, [x, y] = q(t), [x2] = q(Math.min(1, t + .5 / n));
      const dx = Math.max(3, Math.abs(x2 - x) * 1.1);
      fpoly(c, [x - dx, y - 1, x + dx, y - 1, x + dx, y + 9, x - dx, y + 9], i % 3 ? '#8b6a44' : '#9e7a4e');
      poly(c, [x - dx, y - 1, x + dx, y - 1, x + dx, y + 9, x - dx, y + 9]); sk(c, OUT, .8);
    }
    rope(0, '#a07a4e', 1.4);
    if (planked) for (let i = 0; i <= n; i += 4) { const [x, y] = q(i / n); line(c, x, y + 9, x, y + 24, '#5e4128', 3); }
    // near hand rope + suspenders
    for (let i = 1; i <= n; i += 2) { const t = i / n, [x, y] = q(t); line(c, x, y + 8, x, y - 12 - Math.sin(t * Math.PI) * sag * .55, '#7a5a3a', 1.2); }
    rope(-12, '#7a5a3a', 2.2, sag * .55);
    // anchors
    for (const [px, py] of [[ax, ay], [bx, by]]) { frect(c, px - 3, py - 24, 6, 34, '#5e4128'); srect(c, px - 3, py - 24, 6, 34, OUT, 1); }
    return { img: cv, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function init() {
    if (ready) return;
    A.groundPat = mk(1, 1).getContext('2d').createPattern(makeGroundTile(), 'repeat');
    A.pathPat = mk(1, 1).getContext('2d').createPattern(makePathTile(), 'repeat');
    A.plaza = makePlaza(PLAZA.r);
    A.decals = [makeDecal(11), makeDecal(22), makeDecal(33)];
    A.shelves = [makeShelf(41, ROCKS[0]), makeShelf(42, ROCKS[1]), makeShelf(43, ROCKS[2]), makeShelf(44, ROCKS[0])];
    A.boulders = [makeBoulder(10, ROCKS[0], 1), makeBoulder(15, ROCKS[1], 2), makeBoulder(22, ROCKS[0], 3), makeBoulder(13, ROCKS[2], 4), makeBoulder(28, ROCKS[2], 5)];
    A.clusters = [makeCluster(ROCKS[0], 6), makeCluster(ROCKS[1], 7)];
    A.bushes = [makeDryBush(14, 8), makeDryBush(20, 9), makeDryBush(11, 10)];
    A.deadTree = [makeDeadTree(12), makeDeadTree(13)];
    A.tufts = [makeTuftSprite(14), makeTuftSprite(15)];
    A.lantern = makeStoneLantern();
    A.poles = [makeBannerPole(1), makeBannerPole(2)];
    A.cairn = makeCairn();
    A.crates = makeCrates(16);
    A.gateL = makeGatePillar(31, false); A.gateR = makeGatePillar(32, true);
    A.gateBeam = makeGateBeam();

    const push = (s, x, y, bi = -1, sortY = y) => ITEMS.push({ img: s.cv, x0: Math.round(x - s.ax), y0: Math.round(y - s.ay), x1: Math.round(x - s.ax + s.cv.width), y1: Math.round(y - s.ay + s.cv.height), y: sortY, bi });
    // buildings
    FPX.forEach((f, i) => {
      const v = buildVariant(f.type, f.pv);
      f.v = v;
      FP[i].roof = v.roofCol; FP[i].wall = v.wallCol;
      ITEMS.push({ img: v.cv, x0: f.x + v.ox, y0: f.y + v.oy, x1: f.x + v.ox + v.cv.width, y1: f.y + v.oy + v.cv.height, y: f.y + f.h, bi: i });
      for (const [lx, ly] of v.lamps) LANTERNS.push({ x: Math.round(f.x + lx), y: Math.round(f.y + ly) });
      for (const [fx, fy] of v.flags) FLAGS.push({ x: f.x + fx, y: f.y + fy, bi: i });
      if (v.trickle) TRICKLES.push({ x: f.x + v.trickle[0], y0: f.y + v.trickle[1], y1: f.y + v.trickle[2], ph: hash2(f.cx, f.cy, 3) * 9, bi: i });
    });
    // walkways
    for (const [pts, w] of PATH_DEFS) {
      const R = rng(pts[0][0] * 7 + pts[0][1]), p = new Path2D(), dense = [];
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, ay] = pts[s], [bx, by] = pts[s + 1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / 260));
        const nx = -(by - ay) / L, ny = (bx - ax) / L;
        for (let k = 0; k < n; k++) { const t = k / n, j = (k === 0 && s === 0) ? 0 : (R() - .5) * 16; dense.push([ax + (bx - ax) * t + nx * j, ay + (by - ay) * t + ny * j]); }
      }
      dense.push(pts[pts.length - 1]);
      dense.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const [x, y] of dense) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
      PATHS.push({ path: p, w, pts, bb: [bx0 - w, by0 - w, bx1 + w, by1 + w] });
    }
    const onPath = (x, y, m) => { for (const P of PATHS) for (let i = 0; i < P.pts.length - 1; i++) if (distSeg(x, y, P.pts[i][0], P.pts[i][1], P.pts[i + 1][0], P.pts[i + 1][1]) < P.w / 2 + m) return true; return false; };
    const inFoot = (x, y, m) => { for (const f of FP) if (x > f.x - m && x < f.x + f.w + m && y > f.y - m && y < f.y + f.h + m) return true; return false; };
    const nearPlaza = (x, y, m) => Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + m;
    const nearGate = (x, y) => Math.abs(x - GATE_X) < 260 && y > SIZE - 320;
    // plaza + roadside lanterns, banner poles
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * .1 + i / 8 * TAU, x = PLAZA.x + Math.cos(a) * (PLAZA.r + 34), y = PLAZA.y + Math.sin(a) * (PLAZA.r + 34);
      if (inFoot(x, y, 20) || (Math.abs(x - GATE_X) < 110 && y > PLAZA.y) || y < PLAZA.y - PLAZA.r + 40) continue;
      if (i % 2) { push(A.lantern, x, y); LANTERNS.push({ x: Math.round(x), y: Math.round(y - 46) }); }
      else push(A.poles[i % 4 ? 1 : 0], x, y);
    }
    for (let y = 2900; y < SIZE - 300; y += 520) for (const side of [-1, 1]) {
      const x = GATE_X + side * 104;
      if (inFoot(x, y, 10)) continue;
      push(A.lantern, x, y); LANTERNS.push({ x, y: y - 46 });
    }
    // gate
    push(A.gateL, GATE_X - 170, SIZE - 6); push(A.gateR, GATE_X + 170, SIZE - 6);
    LANTERNS.push({ x: GATE_X - 114, y: SIZE - 6 - 252 + 72 }, { x: GATE_X + 114, y: SIZE - 6 - 252 + 72 });
    // scatter props
    for (let cy = 0; cy < NCELL; cy++) for (let cx = 0; cx < NCELL; cx++) {
      const R = rng(cx * 131 + cy * 977 + 5), gx = cx * BLOCK, gy = cy * BLOCK;
      const open = MAP[cy][cx] === '.';
      const nd = open ? 2 : 1;
      for (let k = 0; k < nd; k++) { const d = A.decals[Math.floor(R() * 3)]; DECALS.push({ img: d, x: Math.round(gx + R() * (BLOCK - 260)), y: Math.round(gy + R() * (BLOCK - 140)), w: d.width, h: d.height }); }
      const ns = open ? 1 + (R() < .4 ? 1 : 0) : (R() < .3 ? 1 : 0);
      for (let k = 0; k < ns; k++) {
        const s = A.shelves[Math.floor(R() * A.shelves.length)];
        for (let tries = 0; tries < 10; tries++) {
          const x = gx + 10 + R() * (BLOCK - 20 - s.width), y = gy + 10 + R() * (BLOCK - 20 - s.height);
          let ok = !nearPlaza(x + s.width / 2, y + s.height / 2, s.width / 2 + 30) && !nearGate(x + s.width / 2, y + s.height / 2);
          for (let qx = 0; ok && qx <= 1; qx += .5) for (let qy = 0; ok && qy <= 1; qy += .5) { const px = x + s.width * qx, py = y + s.height * qy; if (inFoot(px, py, 16) || onPath(px, py, 12)) ok = false; }
          for (const o of SHELVES) if (ok && x < o.x + o.w + 20 && x + s.width + 20 > o.x && y < o.y + o.h + 20 && y + s.height + 20 > o.y) ok = false;
          if (ok) { SHELVES.push({ img: s, x: Math.round(x), y: Math.round(y), w: s.width, h: s.height }); break; }
        }
      }
      const n = open ? 9 : 5;
      for (let k = 0; k < n; k++) {
        let x = 0, y = 0, ok = false;
        for (let tries = 0; tries < 8 && !ok; tries++) {
          x = gx + 24 + R() * (BLOCK - 48); y = gy + 30 + R() * (BLOCK - 50);
          ok = !inFoot(x, y, 14) && !onPath(x, y, 18) && !nearPlaza(x, y, 40) && !nearGate(x, y) && Math.hypot(x - SPAWN.x, y - SPAWN.y) > 200;
        }
        if (!ok) continue;
        const r = R();
        let s;
        if (r < .32) s = A.boulders[Math.floor(R() * A.boulders.length)];
        else if (r < .48) s = A.clusters[Math.floor(R() * 2)];
        else if (r < .7) s = A.bushes[Math.floor(R() * 3)];
        else if (r < .78) s = A.tufts[Math.floor(R() * 2)];
        else if (r < .85) s = A.deadTree[Math.floor(R() * 2)];
        else if (r < .91) s = A.cairn;
        else if (r < .97) s = A.crates;
        else s = A.poles[Math.floor(R() * 2)];
        push(s, x, y);
      }
      // rocky village rim: bigger boulders hug the outer edge
      const edge = [];
      if (cx === 0) edge.push(() => [gx + 10 + R() * 40, gy + R() * BLOCK]);
      if (cx === NCELL - 1) edge.push(() => [gx + BLOCK - 10 - R() * 40, gy + R() * BLOCK]);
      if (cy === 0) edge.push(() => [gx + R() * BLOCK, gy + 16 + R() * 40]);
      if (cy === NCELL - 1) edge.push(() => [gx + R() * BLOCK, gy + BLOCK - 4 - R() * 30]);
      for (const f of edge) for (let k = 0; k < 4; k++) {
        const [x, y] = f();
        if (inFoot(x, y, 6) || onPath(x, y, 10) || nearGate(x, y)) continue;
        push(R() < .5 ? A.boulders[2 + Math.floor(R() * 3)] : A.clusters[Math.floor(R() * 2)], x, y);
      }
    }
    ITEMS.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    // rope bridges strung between rock tops
    for (const [ca, sa, cb, sb] of BRIDGE_PAIRS) {
      const ia = CELLS[ca[0] + ',' + ca[1]], ib = CELLS[cb[0] + ',' + cb[1]];
      if (ia === undefined || ib === undefined) continue;
      const fa = FPX[ia], fb = FPX[ib], pa = fa.v.anchors[sa], pb = fb.v.anchors[sb];
      if (!pa || !pb) continue;
      const A1 = [fa.x + pa[0], fa.y + pa[1]], B1 = [fb.x + pb[0], fb.y + pb[1]];
      const L = Math.hypot(B1[0] - A1[0], B1[1] - A1[1]);
      const br = makeBridge(A1, B1, Math.min(60, L * .1), (ia + ib) % 2 === 0);
      br.a = ia; br.b = ib; BRIDGES.push(br);
    }
    ready = true;
  }

  // ------------------------------------------------------------------ API
  function drawStatic(ctx, b, isDestroyed) {
    if (!ready) init();
    const dz = typeof isDestroyed === 'function' ? isDestroyed : null;
    lastDZ = dz;
    const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    if (x1 < -150 || y1 < -150 || x0 > SIZE + 150 || y0 > SIZE + 150) return;
    ctx.save();
    const ix0 = Math.max(0, x0), iy0 = Math.max(0, y0), ix1 = Math.min(SIZE, x1), iy1 = Math.min(SIZE, y1);
    if (ix1 > ix0 && iy1 > iy0) {
      ctx.fillStyle = A.groundPat; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
      for (const d of DECALS) if (d.x < x1 && d.x + d.w > x0 && d.y < y1 && d.y + d.h > y0) ctx.drawImage(d.img, d.x, d.y);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const P of PATHS) {
        if (P.bb[0] > x1 || P.bb[2] < x0 || P.bb[1] > y1 || P.bb[3] < y0) continue;
        ctx.strokeStyle = 'rgba(110,78,48,.55)'; ctx.lineWidth = P.w + 14; ctx.stroke(P.path);
        ctx.strokeStyle = A.pathPat; ctx.lineWidth = P.w; ctx.stroke(P.path);
      }
      for (const d of SHELVES) if (d.x < x1 && d.x + d.w > x0 && d.y < y1 && d.y + d.h > y0) ctx.drawImage(d.img, d.x, d.y);
      const pr = PLAZA.r + 12;
      if (PLAZA.x + pr > x0 && PLAZA.x - pr < x1 && PLAZA.y + pr > y0 && PLAZA.y - pr < y1) ctx.drawImage(A.plaza, PLAZA.x - A.plaza.width / 2, PLAZA.y - A.plaza.height / 2);
    }
    for (let i = 0; i < ITEMS.length; i++) {
      const it = ITEMS[i];
      if (it.x1 < x0 || it.x0 > x1 || it.y1 < y0 || it.y0 > y1) continue;
      if (it.bi >= 0 && dz && dz(it.bi)) continue;
      ctx.drawImage(it.img, it.x0, it.y0);
    }
    ctx.restore();
  }

  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    const t = time || 0, vx0 = view.x, vy0 = view.y, vx1 = view.x + view.w, vy1 = view.y + view.h;
    if (vx1 < -200 || vy1 < -200 || vx0 > SIZE + 200 || vy0 > SIZE + 200) return;
    const dz = lastDZ;
    ctx.save();
    // falling pebbles from rock faces
    for (const tr of TRICKLES) {
      if (tr.x < vx0 - 20 || tr.x > vx1 + 20 || tr.y1 < vy0 || tr.y0 > vy1) continue;
      if (dz && dz(tr.bi)) continue;
      const cyc = mod(t + tr.ph, 7.5);
      if (cyc > 1.6) continue;
      for (let k = 0; k < 4; k++) {
        const tk = cyc - k * .16; if (tk < 0) continue;
        const y = tr.y0 + 300 * tk * tk, x = tr.x + k * 3 + Math.sin(tk * 9 + k) * 2;
        if (y < tr.y1) fell(ctx, x, y, 2 - k * .25, 1.7 - k * .2, k % 2 ? '#8a5a38' : '#b07a4e');
        else {
          const age = (y - tr.y1) / 200; if (age > 1) continue;
          fell(ctx, x + 4, tr.y1 - 2, 6 + age * 14, 3 + age * 5, `rgba(205,170,120,${.45 * (1 - age)})`);
        }
      }
    }
    // rope bridges overhead
    for (const br of BRIDGES) {
      if (br.x > vx1 || br.x + br.w < vx0 || br.y > vy1 || br.y + br.h < vy0) continue;
      if (dz && (dz(br.a) || dz(br.b))) continue;
      ctx.drawImage(br.img, br.x, br.y);
    }
    // gate beam
    const gb = A.gateBeam, gx = GATE_X - gb.width / 2, gy = SIZE - 6 - 250;
    if (gx < vx1 && gx + gb.width > vx0 && gy < vy1 && gy + gb.height > vy0) ctx.drawImage(gb, gx, gy);
    // Tsuchikage flags
    for (const f of FLAGS) {
      if (f.x < vx0 - 40 || f.x > vx1 + 40 || f.y < vy0 - 40 || f.y > vy1 + 40) continue;
      if (dz && dz(f.bi)) continue;
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      for (let k = 1; k <= 6; k++) ctx.lineTo(f.x + k * 5, f.y + Math.sin(t * 6 - k * .9) * 2.2 * (k / 6));
      for (let k = 6; k >= 0; k--) ctx.lineTo(f.x + k * 5, f.y + 14 + Math.sin(t * 6 - k * .9 + .4) * 2.6 * (k / 6));
      ctx.closePath(); ctx.fillStyle = '#8e3328'; ctx.fill(); ctx.strokeStyle = 'rgba(50,15,8,.7)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // drifting dust motes
    const spanX = view.w + 100, spanY = view.h + 100;
    ctx.fillStyle = 'rgba(226,198,150,.5)'; ctx.beginPath();
    for (let i = 0; i < 34; i++) {
      const sx = hash2(i, 1, 3) * 5000, sy = hash2(i, 2, 3) * 5000, sp = 18 + (i % 5) * 7;
      const x = vx0 - 50 + mod(sx + t * sp - (vx0 - 50), spanX);
      const y = vy0 - 50 + mod(sy + Math.sin(t * .8 + i) * 16 + t * 4 - (vy0 - 50), spanY);
      const r = 1.1 + (i % 3) * .7;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
    // occasional dust gusts
    for (let i = 0; i < 3; i++) {
      const ph = mod(t * .07 + i / 3, 1), a = Math.sin(ph * Math.PI) * .09;
      const x = vx0 - 200 + ph * (view.w + 400), y = vy0 + view.h * (.2 + i * .28) + Math.sin(t * .5 + i) * 30;
      fell(ctx, x, y, 140, 26, `rgba(210,175,125,${a})`);
    }
    ctx.restore();
  }

  function drawMinimap(ctx) {
    ctx.save();
    ctx.fillStyle = '#a8835a'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#b8936a';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.ellipse(hash2(i, 1, 5) * SIZE, hash2(i, 2, 5) * SIZE, 160 + hash2(i, 3, 5) * 200, 80 + hash2(i, 4, 5) * 90, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#d6bd94'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [pts, w] of PATH_DEFS) { ctx.lineWidth = w * 1.3; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    ctx.fillStyle = '#d9c39c'; ctx.beginPath(); ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, TAU); ctx.fill();
    FPX.forEach((f, i) => {
      if (f.type === 'tsuchi') {
        ctx.fillStyle = '#8e3328'; ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w * .55, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f2c050'; ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w * .38, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8e3328'; ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w * .16, 0, TAU); ctx.fill();
        return;
      }
      if (f.solid) { ctx.fillStyle = f.type === 'mesa' ? '#7d4c2e' : '#6a3e26'; ctx.beginPath(); ctx.ellipse(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, f.h / 2, 0, 0, TAU); ctx.fill(); return; }
      ctx.fillStyle = (FP[i].roof) || ['#8b3a2f', '#5d7083', '#6e6259'][f.pv % 3];
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.fillStyle = 'rgba(240,225,195,.55)'; ctx.fillRect(f.x, f.y + f.h * .66, f.w, f.h * .34);
    });
    ctx.restore();
  }

  window.ShinobiVillages = window.ShinobiVillages || {};
  window.ShinobiVillages.iwa = {
    id: 'iwa', name: 'LÀNG ĐÁ', jp: '岩隠れの里', kage: 'TSUCHIKAGE',
    cols: NCELL, rows: NCELL,
    gate: { side: 's', at: GATE_X },
    spawn: { x: SPAWN.x, y: SPAWN.y },
    lanterns: LANTERNS,
    init,
    footprints() { return FP.map(f => ({ x: f.x, y: f.y, w: f.w, h: f.h, solid: f.solid, roof: f.roof || (f.solid ? '#7d4c2e' : '#8b3a2f'), wall: f.wall || (f.solid ? '#a8643c' : '#d9c9a9') })); },
    drawStatic, drawAmbient, drawMinimap
  };
})();
