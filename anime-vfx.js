/* Anime-style pilot: cel-shaded jutsu and anime "game feel". Active when the art style (L) is 'anime'.
 *
 * Jutsu redrawn: Rasengan (charge, grind, burst), Rasen Shuriken (charge, flight, needle dome),
 * Chidori (dash bolt, burst) and the Tailed Beast Bomb (charge, flight, blast). The anime look:
 *   - flat colour in 3 tones (shadow, base, light) with a dark ink outline, instead of soft gradients,
 *   - tapered brush strokes, crescents and spiky impact stars instead of circles and dots,
 *   - effects end by thinning and shrinking, not by fading out.
 * Game feel (every jutsu and hit, driven by how hard the screen shakes; never in co-op, nor while only
 * spectating a team battle — game.js passes that as the quiet flag):
 *   - hit-stop: the world freezes for 50–90 ms on a heavy blow,
 *   - impact frame: 2 inverted frames on the biggest blows (at most once every 3 s),
 *   - focus lines: anime speed lines closing in on the screen centre after big blows.
 * Hooks: NinjaVFX.draw (wrapped like pixel-art.js) and window.GameFeel, called from game.js's loop. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const style = () => (window.ArtStyle ? window.ArtStyle.get() : 'og');
  const anime = () => style() === 'anime';
  const lift = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 0);
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const out3 = t => 1 - (1 - clamp(t)) ** 3;
  const outBack = t => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------------------------------------------------------------- cel kit
  function ink(ctx, fill, line, w) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (line && w > 0) { ctx.lineWidth = w; ctx.strokeStyle = line; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  // A brush stroke along pts, w0 wide at the start tapering to w1 (as a closed outline to fill).
  function taper(ctx, pts, w0, w1) {
    const n = pts.length;
    if (n < 2) return;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  }
  function arcPts(cx, cy, r, a0, a1, sq = 1, n = 14) {
    const p = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq]); }
    return p;
  }
  function spiralPts(cx, cy, r0, r1, a0, turn, sq = 1, n = 18) {
    const p = [];
    for (let i = 0; i <= n; i++) { const f = i / n, a = a0 + turn * f, r = r0 + (r1 - r0) * f; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq]); }
    return p;
  }
  // Spiky anime impact star: n spikes of uneven length.
  function star(ctx, x, y, rIn, rOut, n, seed, rot = 0, sq = 1) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + i / (n * 2) * TAU, r = i % 2 ? rIn : rOut * (.6 + hash(seed + i) * .4);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * sq;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function jag(x1, y1, x2, y2, n, amp, seed) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L, p = [[x1, y1]];
    for (let i = 1; i < n; i++) { const f = i / n, j = (hash(seed + i * 7.3) - .5) * amp * 2; p.push([x1 + (x2 - x1) * f + nx * j, y1 + (y2 - y1) * f + ny * j]); }
    p.push([x2, y2]);
    return p;
  }
  function rock(ctx, x, y, s, rot, fill, line) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = rot + i / 5 * TAU, r = s * (.7 + hash(i + s) * .5); if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ink(ctx, fill, line, 1.4);
  }
  function groundEllipse(ctx, x, y, r, fill, sq = .42) { ctx.beginPath(); ctx.ellipse(x, y, r, r * sq, 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }

  const RAS = { ink: '#0b2f78', dark: '#1f6fe0', base: '#43b8ff', mid: '#9ff0ff', core: '#ffffff' };
  const BOLT = { ink: '#0a2766', dark: '#2a84ff', base: '#7fe2ff', core: '#ffffff' };
  const BIJ = { ink: '#0b0012', dark: '#12051f', base: '#2c0d4a', rim: '#9a4dff', light: '#e2c2ff' };

  // Cel-shaded chakra sphere: base, a shadow crescent, spiral bands, a white core, a highlight, ink.
  function celOrb(ctx, x, y, R, t, P = RAS, spin = 14) {
    const w = Math.max(1.4, R * .07);
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fillStyle = P.dark; ctx.fill();
    ctx.clip();
    ctx.beginPath(); ctx.arc(x - R * .14, y - R * .16, R * .9, 0, TAU); ctx.fillStyle = P.base; ctx.fill();
    for (let i = 0; i < 3; i++) {
      taper(ctx, spiralPts(x, y, R * .2, R * 1.05, t * spin + i * TAU / 3, 2.4, 1, 16), R * .26, R * .04);
      ctx.fillStyle = P.mid; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, R * .36, 0, TAU); ctx.fillStyle = P.core; ctx.fill();
    for (let i = 0; i < 2; i++) { taper(ctx, spiralPts(x, y, R * .1, R * .7, -t * spin * 1.3 + i * Math.PI, 1.6, 1, 12), R * .16, R * .02); ctx.fillStyle = P.core; ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(x - R * .38, y - R * .42, R * .2, R * .12, -.6, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ink(ctx, null, P.ink, w);
  }
  // Wind crescents whipping round a sphere.
  function windArcs(ctx, x, y, R, t, n = 3, col = '#ffffff', line = RAS.ink, sq = .8) {
    for (let i = 0; i < n; i++) {
      const a0 = t * 9 + i * TAU / n;
      taper(ctx, arcPts(x, y, R * (1.18 + (i % 2) * .12), a0, a0 + 1.5, sq, 12), R * .02, R * .16);
      ink(ctx, col, line, 1.2);
    }
  }

  // ---------------------------------------------------------------- Rasengan
  function rasenganCharge(ctx, state, t) {
    const ch = state.charge, p = state.player, ratio = clamp(ch.ratio || 0), ang = p.angle || 0;
    const hand = state.hand || { x: p.x + Math.cos(ang) * 16, y: p.y - 20 };
    const R = Math.max(8, (ch.radius || 16) * .42) * (.7 + ratio * .55) * (ratio >= .98 ? 1 + Math.sin(t * 30) * .05 : 1);
    const x = hand.x + Math.cos(ang) * R * .9, y = hand.y + Math.sin(ang) * R * .5;
    // Chakra streams being pulled into the palm.
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const a = t * 5 + i * TAU / 5, r0 = R * (2.6 + ratio);
      taper(ctx, spiralPts(x, y, r0, R * 1.05, a, 1.4, .85, 10), 1, R * .2);
      ink(ctx, i % 2 ? RAS.mid : RAS.base, null);
    }
    windArcs(ctx, x, y, R, t, 3);
    celOrb(ctx, x, y, R, t);
    ctx.restore();
  }
  function rasenganGrind(ctx, v, t) {
    const life = clamp(v.life / (v.maxLife || 1)), age = 1 - life;
    if (life <= 0) return;
    const R = Math.max(16, v.radius || 64), x = v.x, y = v.y, k = 1 - out3((age - .55) / .45);
    ctx.save();
    // Ground torn into a spiral: dark scoured earth, then cel chakra arms that thin out as it ends.
    groundEllipse(ctx, x, y, R * .62 * (.6 + age * .4), 'rgba(40,52,90,.35)', .45);
    for (let i = 0; i < 5; i++) {
      const pts = spiralPts(x, y, R * .08, R * (.42 + age * .3), -t * 10 + i * TAU / 5, 2.2, .45, 16);
      taper(ctx, pts, R * .13 * k, 0); ink(ctx, i % 2 ? RAS.base : RAS.mid, RAS.ink, 1.3 * k);
    }
    // The sphere grinding in, shrinking once it has spent itself.
    const oR = R * .3 * (age < .5 ? 1 : 1 - out3((age - .5) / .5));
    if (oR > 2) celOrb(ctx, x, y - lift() * .35, oR, t, RAS, 20);
    ctx.restore();
  }
  function shockCrescents(ctx, x, y, R, age, P, n = 6, sq = .45) {
    const k = 1 - out3((age - .3) / .7), r = R * (.4 + out3(age) * .75);
    for (let i = 0; i < n; i++) {
      const a0 = i * TAU / n + hash(i + R) * .5;
      taper(ctx, arcPts(x, y, r, a0, a0 + TAU / n * .7, sq, 10), 0, R * .09 * k);
      ink(ctx, P.mid || P.base, P.ink, 1.2 * k);
    }
  }
  function debris(ctx, x, y, R, age, seed, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = hash(seed + i) * TAU, sp = (.45 + hash(seed + i * 3) * .6) * R;
      const px = x + Math.cos(a) * sp * out3(age), py = y + Math.sin(a) * sp * out3(age) * .5 - Math.sin(clamp(age * 1.2) * Math.PI) * R * .35;
      rock(ctx, px, py, 3 + hash(seed + i * 5) * 5, age * 8 + i, '#9c7a52', '#2e2014');
    }
  }
  function impactStar(ctx, x, y, R, age, fill, mid, line, seed) {
    if (age > .22) return;
    // Broad wedges (not needles): the inner radius stays a good share of the outer one.
    const k = 1 - age / .22, rOut = R * (.75 + .35 * (1 - k)) * (.4 + .6 * k);
    star(ctx, x, y, rOut * .5, rOut, 9, seed, seed, .7);
    ink(ctx, fill, line, 2.2);
    star(ctx, x, y, rOut * .32, rOut * .62, 7, seed + 5, seed + .3, .7);
    ink(ctx, mid, null);
  }
  function rasenganBurst(ctx, e, t) {
    const life = clamp(e.life / (e.maxLife || 1)), age = 1 - life;
    if (life <= 0) return;
    const R = Math.max(10, e.radius || 40), seed = Math.floor(e.x * .37 + e.y * .11);
    ctx.save();
    impactStar(ctx, e.x, e.y - 10, R, age, RAS.mid, RAS.core, RAS.ink, seed);
    shockCrescents(ctx, e.x, e.y, R, age, RAS);
    debris(ctx, e.x, e.y, R, age, seed);
    ctx.restore();
  }

  // ---------------------------------------------------------------- Rasen Shuriken
  function shurikenShape(ctx, x, y, rr, t, a = 1) {
    // Ring of thin white streaks, four broad crescent blades, the sphere in the middle.
    ctx.save();
    ctx.globalAlpha *= a;
    for (let i = 0; i < 10; i++) {
      const a0 = -t * 26 + i * TAU / 10;
      taper(ctx, arcPts(x, y, rr * (1.5 + (i % 3) * .1), a0, a0 + .45, .55, 6), 0, rr * .06);
      ink(ctx, '#e8fbff', null);
    }
    for (let i = 0; i < 4; i++) {
      const a0 = -t * 22 + i * TAU / 4;
      const outer = arcPts(x, y, rr * 1.35, a0, a0 + 1.1, .55, 10);
      const inner = arcPts(x, y, rr * .5, a0 + 1.1, a0 + .15, .55, 10);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a0) * rr * .35, y + Math.sin(a0) * rr * .35 * .55);
      for (const pt of outer) ctx.lineTo(pt[0], pt[1]);
      for (const pt of inner) ctx.lineTo(pt[0], pt[1]);
      ctx.closePath(); ink(ctx, '#ffffff', '#1f6a9a', 1.6);
      taper(ctx, arcPts(x, y, rr * .95, a0 + .25, a0 + 1, .55, 8), rr * .1, 0); ink(ctx, '#bff2ff', null);
    }
    celOrb(ctx, x, y, rr * .34, t, RAS, 24);
    ctx.restore();
  }
  function shurikenCharge(ctx, state, t) {
    const ch = state.charge, p = state.player, ratio = clamp(ch.ratio || 0);
    const radius = Math.max(9, (ch.radius || 16) * .55), bladeR = radius * 1.6 * (.6 + ratio * .4);
    const x = p.x, y = p.y - 72 - Math.max(radius * .8, bladeR * 1.32 * .82);
    shurikenShape(ctx, x, y, radius * (.8 + ratio * .6), t, .4 + ratio * .6);
  }
  function shurikenFlight(ctx, s, t) {
    const r = Math.max(16, s.r || 24), age = Math.max(0, (s.maxLife || 1.5) - (s.life || 0));
    const a = clamp((s.life || 0) / .18), rr = r * (.55 + .45 * outBack(age / .22)), H = lift() + 6 + rr * .15;
    if (a <= 0) return;
    groundEllipse(ctx, s.x, s.y, rr * 1.2, 'rgba(20,40,70,.28)', .35);
    shurikenShape(ctx, s.x, s.y - H, rr, t, a);
  }
  function shurikenDome(ctx, e, t) {
    const life = clamp(e.life / (e.maxLife || 1)), age = 1 - life;
    if (life <= 0) return;
    const R = Math.max(20, e.radius || 120), x = e.x, y = e.y, seed = Math.floor(x * .37 + y * .11), k = 1 - out3((age - .45) / .55);
    ctx.save();
    impactStar(ctx, x, y - 20, R * .8, age, '#e8fbff', '#ffffff', '#1f6a9a', seed);
    // The dome: a pale cel hemisphere filled with wind needles.
    const dr = R * .8 * out3(age / .35);
    ctx.beginPath(); ctx.ellipse(x, y, dr, dr * .62, 0, Math.PI, TAU); ctx.lineTo(x + dr, y); ctx.ellipse(x, y, dr, dr * .3, 0, 0, Math.PI);
    ink(ctx, `rgba(200,244,255,${.32 * k})`, `rgba(31,106,154,${k})`, 2);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + hash(seed + i) * Math.PI, rl = dr * (.35 + hash(seed + i * 3) * .65);
      const x1 = x + Math.cos(a) * rl * .2, y1 = y + Math.sin(a) * rl * .12, x2 = x + Math.cos(a) * rl, y2 = y + Math.sin(a) * rl * .62;
      taper(ctx, [[x1, y1], [x2, y2]], 3.2 * k, 0); ink(ctx, '#ffffff', null);
    }
    shockCrescents(ctx, x, y, R, age, { mid: '#e8fbff', ink: '#1f6a9a' }, 8);
    debris(ctx, x, y, R, age, seed, 10);
    ctx.restore();
  }

  // ---------------------------------------------------------------- Chidori
  function boltShape(ctx, pts, w, P = BOLT, k = 1) {
    taper(ctx, pts, w * k, w * .3 * k); ink(ctx, P.dark, P.ink, 1.4);
    taper(ctx, pts, w * .55 * k, w * .15 * k); ink(ctx, P.base, null);
    taper(ctx, pts, w * .22 * k, w * .05 * k); ink(ctx, P.core, null);
  }
  function chidoriTrail(ctx, tr, t) {
    const life = clamp(tr.life / (tr.maxLife || 1));
    if (life <= 0) return;
    const lift2 = 24, x1 = tr.x1, y1 = tr.y1 - lift2, x2 = tr.x2, y2 = tr.y2 - lift2, L = Math.hypot(x2 - x1, y2 - y1);
    const tick = Math.floor(t * 20), n = Math.max(4, Math.round(L / 34)), k = .35 + .65 * life;
    ctx.save();
    const main = jag(x2, y2, x1, y1, n, 14, tick * 3);
    boltShape(ctx, main, 16, BOLT, k);
    boltShape(ctx, jag(x2, y2, x1, y1, n + 1, 22, tick * 5 + 1), 7, BOLT, k);
    for (let i = 2; i < main.length - 1; i += 2) {
      const [px, py] = main[i], a = Math.atan2(y1 - y2, x1 - x2) + (hash(tick + i) < .5 ? 1 : -1) * (.6 + hash(tick * 2 + i) * .5), len = 18 + hash(tick * 3 + i) * 22;
      boltShape(ctx, jag(px, py, px + Math.cos(a) * len, py + Math.sin(a) * len, 3, 5, tick + i * 9), 6, BOLT, k);
    }
    ctx.restore();
  }
  function chidoriBurst(ctx, e, t) {
    const life = clamp(e.life / (e.maxLife || 1)), age = 1 - life;
    if (life <= 0) return;
    const R = Math.max(30, e.radius || 60), x = e.x, y = e.y - 18, tick = Math.floor(t * 20), seed = Math.floor(e.x + e.y);
    ctx.save();
    impactStar(ctx, x, y, R * 1.2, age, BOLT.base, BOLT.core, BOLT.ink, seed);
    for (let b = 0; b < 7; b++) {
      const a = b / 7 * TAU + hash(tick + b) * .6, len = R * (.8 + hash(tick * 3 + b) * .7) * (.5 + out3(age * 2) * .5);
      boltShape(ctx, jag(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len * .7, 4, 7, tick * 7 + b), 8, BOLT, life);
    }
    shockCrescents(ctx, e.x, e.y, R, age, { mid: BOLT.base, ink: BOLT.ink }, 5);
    ctx.restore();
  }

  // ---------------------------------------------------------------- Tailed Beast Bomb
  function bijuuBall(ctx, x, y, R, t) {
    const w = Math.max(1.6, R * .06);
    ctx.save();
    // Dark chakra being sucked in: violet and black brush strokes spiralling into the ball.
    for (let i = 0; i < 8; i++) {
      const a = -t * 4 + i * TAU / 8;
      taper(ctx, spiralPts(x, y, R * (1.9 + (i % 3) * .3), R * .95, a, 1.2, .9, 10), 1, R * .2);
      ink(ctx, i % 2 ? BIJ.rim : BIJ.base, null);
    }
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fillStyle = BIJ.base; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.beginPath(); ctx.arc(x + R * .2, y + R * .22, R * .92, 0, TAU); ctx.fillStyle = BIJ.dark; ctx.fill();
    for (let i = 0; i < 3; i++) { taper(ctx, spiralPts(x, y, R * .15, R, t * 6 + i * TAU / 3, 2, 1, 14), R * .2, 0); ink(ctx, '#3e1666', null); }
    // Rim light along the top-left edge.
    taper(ctx, arcPts(x, y, R * .9, Math.PI * .95, Math.PI * 1.6, 1, 12), R * .04, R * .2); ink(ctx, BIJ.rim, null);
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(x - R * .36, y - R * .46, R * .16, R * .09, -.6, 0, TAU); ctx.fillStyle = BIJ.light; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ink(ctx, null, BIJ.ink, w);
    ctx.restore();
  }
  function bijuuCharge(ctx, state, t) {
    const ch = state.charge, p = state.player, ratio = clamp(ch.ratio || 0), a = p.angle || 0;
    const throb = ratio >= .98 ? 1 + Math.sin(t * 22) * .06 : 1 + Math.sin(t * 9) * .03;
    const rr = (6 + ratio * 76) * throb, off = 34 + rr * 1.05, gx = p.x + Math.cos(a) * off, gy = p.y + Math.sin(a) * off;
    const y = gy - lift() - 6 - ratio * 18;
    groundEllipse(ctx, gx, gy, 40 + ratio * 110, `rgba(40,8,60,${.2 + ratio * .25})`);
    ctx.save(); ctx.strokeStyle = '#1a0a22'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const ang = i / 7 * TAU + .3, len = (30 + ratio * 120) * (.6 + hash(i) * .4);
      taper(ctx, jag(gx, gy, gx + Math.cos(ang) * len, gy + Math.sin(ang) * len * .45, 4, 4, i), 3 * ratio + 1, 0); ink(ctx, '#1a0a22', null);
    }
    ctx.restore();
    bijuuBall(ctx, gx, y, Math.max(4, rr), t);
  }
  function bijuuFlight(ctx, b, t) {
    const age = Math.max(0, (b.maxLife || 1.5) - (b.life || 0)), r = (b.r || 27) * 1.15 * (.5 + .5 * outBack(age / .2));
    const ang = Number.isFinite(b.angle) ? b.angle : Math.atan2(b.vy || 0, b.vx || 1), y = b.y - lift() - 6;
    groundEllipse(ctx, b.x, b.y, r * 1.1, 'rgba(30,6,40,.32)', .35);
    // Speed streaks dragged behind.
    for (let i = 0; i < 5; i++) {
      const off = (i - 2) * r * .32, sx = b.x - Math.sin(ang) * off, sy = y + Math.cos(ang) * off * .7;
      taper(ctx, [[sx, sy], [sx - Math.cos(ang) * r * (2 + hash(i) * 1.5), sy - Math.sin(ang) * r * (2 + hash(i) * 1.5)]], r * .22, 0);
      ink(ctx, i % 2 ? BIJ.rim : BIJ.base, null);
    }
    bijuuBall(ctx, b.x, y, r, t);
  }
  function bijuuBlast(ctx, e, t) {
    const life = clamp(e.life / (e.maxLife || 1)), age = 1 - life;
    if (life <= 0) return;
    const R = Math.max(40, e.radius || 200), x = e.x, y = e.y, seed = Math.floor(x * .37 + y * .11), k = 1 - out3((age - .4) / .6);
    ctx.save();
    // A white flash star, then a black dome with a violet rim swelling and splitting into crescents.
    impactStar(ctx, x, y - 30, R * .9, age, '#f3e4ff', '#ffffff', BIJ.ink, seed);
    const dr = R * .75 * out3(age / .3);
    if (k > .02) {
      ctx.beginPath(); ctx.ellipse(x, y, dr, dr * .7, 0, Math.PI, TAU); ctx.ellipse(x, y, dr, dr * .32, 0, 0, Math.PI);
      ink(ctx, `rgba(18,4,30,${.85 * k})`, BIJ.ink, 2.4);
      taper(ctx, arcPts(x, y, dr * .94, Math.PI * 1.08, Math.PI * 1.7, .7, 14), dr * .02, dr * .12 * k); ink(ctx, BIJ.rim, null);
      taper(ctx, arcPts(x, y, dr * .7, Math.PI * 1.15, Math.PI * 1.45, .7, 10), dr * .01, dr * .06 * k); ink(ctx, BIJ.light, null);
    }
    shockCrescents(ctx, x, y, R, age, { mid: BIJ.rim, ink: BIJ.ink }, 9);
    debris(ctx, x, y, R, age, seed, 14);
    ctx.restore();
  }

  // ---------------------------------------------------------------- NinjaVFX hook
  const MINE_EXPLOSION = { vortex: rasenganBurst, shuriken: shurikenDome, lightning: chidoriBurst, beast: bijuuBlast };
  const MINE_CHARGE = { rasengan: rasenganCharge, shuriken: shurikenCharge, bijuu: bijuuCharge };
  function hookVfx() {
    const V = window.NinjaVFX;
    if (!V || V.__anime) return;
    const inner = V.draw;
    V.draw = function (ctx, state) {
      if (!anime() || !ctx || !state) return inner.call(this, ctx, state);
      const t = Number.isFinite(state.elapsed) ? state.elapsed : 0;
      const keep = [], mine = [];
      for (const e of state.explosions || []) (e && MINE_EXPLOSION[e.kind] ? mine : keep).push(e);
      const chargeFn = state.charge && state.player && MINE_CHARGE[state.charge.kind];
      inner.call(this, ctx, Object.assign({}, state, { explosions: keep, vortices: [], trails: [], rasenShurikens: [], beastBombs: [], charge: chargeFn ? null : state.charge }));
      try {
        for (const v of state.vortices || []) if (v) rasenganGrind(ctx, v, t);
        for (const e of mine) MINE_EXPLOSION[e.kind](ctx, e, t);
        for (const tr of state.trails || []) if (tr) chidoriTrail(ctx, tr, t);
        for (const s of state.rasenShurikens || []) if (s) shurikenFlight(ctx, s, t);
        for (const b of state.beastBombs || []) if (b) bijuuFlight(ctx, b, t);
        if (chargeFn) chargeFn(ctx, state, t);
      } catch (err) { console.warn('anime vfx', err); }
    };
    V.__anime = true;
  }
  hookVfx();
  addEventListener('load', hookVfx);

  // ---------------------------------------------------------------- game feel
  const feel = { stop: 0, stopCd: 0, impact: 0, impactCd: 0, lines: 0, linesMax: .3, seed: 0, last: 0 };
  window.GameFeel = {
    // Scaled frame time: during a hit-stop the world crawls at 4% speed.
    dt(dt, coop) {
      if (!anime() || coop || feel.stop <= 0) return dt;
      feel.stop -= dt;
      return dt * .04;
    },
    // jump: how much the screen shake rose this frame (game.js sets shake for every hit and jutsu).
    after(jump, dt, coop) {
      feel.stopCd -= dt; feel.impactCd -= dt;
      if (!anime() || coop || !(jump > 0)) return;
      if (jump >= 7 && feel.stopCd <= 0) { feel.stop = jump >= 14 ? .09 : jump >= 10 ? .07 : .05; feel.stopCd = .6; }
      if (jump >= 9) { feel.lines = Math.max(feel.lines, jump >= 12 ? .34 : .22); feel.linesMax = Math.max(feel.lines, .22); }
      if (jump >= 15 && feel.impactCd <= 0) { feel.impact = 2; feel.impactCd = 3; }
    },
    // Screen-space overlay drawn before the WebGL pass: focus lines, then the impact frame.
    overlay(ctx, W, H) {
      if (!anime()) { feel.lines = 0; feel.impact = 0; return; }
      const now = performance.now(), dt = Math.min(.05, (now - (feel.last || now)) / 1000); feel.last = now;
      if (feel.lines > 0) {
        feel.lines -= dt;
        const k = clamp(feel.lines / feel.linesMax), cx = W / 2, cy = H / 2, D = Math.hypot(W, H) / 2 + 20;
        if ((feel.seed = (feel.seed + 1) % 4) === 0) feel.tick = (feel.tick || 0) + 1;
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${.55 * k})`;
        ctx.beginPath();
        for (let i = 0; i < 56; i++) {
          const a = i / 56 * TAU + hash(feel.tick * 13 + i) * .09, rin = Math.min(W, H) * (.34 + hash(feel.tick * 7 + i) * .14 + (1 - k) * .1);
          const wdt = (.006 + hash(feel.tick + i * 3) * .012);
          ctx.moveTo(cx + Math.cos(a) * rin, cy + Math.sin(a) * rin);
          ctx.lineTo(cx + Math.cos(a - wdt) * D, cy + Math.sin(a - wdt) * D);
          ctx.lineTo(cx + Math.cos(a + wdt) * D, cy + Math.sin(a + wdt) * D);
          ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
      }
      if (feel.impact > 0) {
        feel.impact--;
        ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    },
    get state() { return feel; }
  };
})();
