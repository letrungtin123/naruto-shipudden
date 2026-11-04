/* World-space effects for the right-click purple Chidori dash (Sasuke's violet Chidori).
 * The game owns effect creation and lifetime; this module only draws them.
 * Uses the shared sprite kit from skill-vfx.js (window.VFXKit) for glows and bolts.
 *
 * Every bright additive layer sits on a darker source-over violet body, so the lightning keeps
 * its hue on bright grass instead of washing out to white.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const MAX_TRAILS = 12;
  const MAX_BURSTS = 8;
  const clamp01 = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const frac = v => v - Math.floor(v);
  // outer glow, mid channel, white-violet core
  const PAL = ['120,24,220', '178,62,255', '232,196,255'];
  const PAL_HOT = ['170,40,240', '206,104,255', '246,226,255'];
  // near-black violet under-stroke: Sasuke's dark lightning has an inked edge
  const INK = 'rgba(22,0,44,.78)';
  const ink = a => `rgba(22,0,44,${(.78 * Math.max(0, Math.min(1, a))).toFixed(3)})`;
  const MAGENTA = '200,40,225';
  const BODY = '74,16,160';      // source-over violet body tint
  const DEEP = '40,6,90';

  function remaining(effect) {
    if (!effect || !Number.isFinite(effect.life)) return 0;
    return Math.max(0, Math.min(1, effect.life / (effect.maxLife || 1)));
  }

  function validPoint(x, y) {
    return Number.isFinite(x) && Number.isFinite(y);
  }

  // Tapered crescent slash (filled lens), the anime "cut" shape.
  function slash(ctx, x, y, r, a0, a1, thick, color) {
    const mid = (a0 + a1) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.quadraticCurveTo(x + Math.cos(mid) * (r - thick * 2), y + Math.sin(mid) * (r - thick * 2),
      x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    ctx.fill();
  }

  // A "chirp": a tiny three-segment zigzag spark flying out from (x, y).
  function chirp(ctx, x, y, a, d, len, seed) {
    const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    const j = (K_hash(seed) - .5) * len * .9;
    ctx.moveTo(x + c * d, y + s * d);
    ctx.lineTo(x + c * (d + len * .4) + nx * j, y + s * (d + len * .4) + ny * j);
    ctx.lineTo(x + c * (d + len * .7) - nx * j, y + s * (d + len * .7) - ny * j);
    ctx.lineTo(x + c * (d + len), y + s * (d + len));
  }
  const K_hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

  // ------------------------------------------------------------------ dash streak
  function drawTrail(ctx, trail, time, K) {
    const alpha = remaining(trail);
    if (alpha <= 0 || !validPoint(trail.x1, trail.y1) || !validPoint(trail.x2, trail.y2)) return;
    const charge = clamp01(trail.charge || 0);
    const age = 1 - alpha;
    const length = Math.hypot(trail.x2 - trail.x1, trail.y2 - trail.y1);
    if (length < 1) return;
    const seed = trail.x1 * .071 + trail.y1 * .039;
    // The streak retracts into the arrival point as it fades.
    const s = K.ease.in(age) * .8;
    const x1 = trail.x1 + (trail.x2 - trail.x1) * s, y1 = trail.y1 + (trail.y2 - trail.y1) * s;
    const x2 = trail.x2, y2 = trail.y2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, angle = Math.atan2(dy, dx);
    const width = (10 + charge * 22) * (.4 + alpha * .6);

    ctx.save();
    // The dash streaks at body height, matching the upright character sprites.
    ctx.translate(0, -(window.AnimeSprites ? window.AnimeSprites.LIFT : 0) * .75);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Violet body of the corridor (normal blend) — tapers from a thread at the start to full width at the tip.
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = `rgba(${BODY},.32)`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 + nx * width, y2 + ny * width);
    ctx.lineTo(x2 + ux * width * .6, y2 + uy * width * .6);
    ctx.lineTo(x2 - nx * width, y2 - ny * width);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(${DEEP},.35)`;
    ctx.beginPath();
    ctx.moveTo(x1 + dx * .15, y1 + dy * .15);
    ctx.lineTo(x2 + nx * width * .45, y2 + ny * width * .45);
    ctx.lineTo(x2 - nx * width * .45, y2 - ny * width * .45);
    ctx.closePath(); ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    // Luminous corridor: charge widens it. Glows get bigger toward the tip.
    const steps = Math.max(3, Math.min(8, Math.round(len / 80)));
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      K.glow(ctx, x1 + dx * t, y1 + dy * t, (16 + charge * 40) * (.5 + t * .6), '120,40,240', .28 + charge * .15);
    }
    const jitter = Math.min(12 + charge * 24, len * .12) + 4;
    K.forkedBolt(ctx, x1, y1, x2, y2, seed, time, { jitter, alpha: 1, width: 2.1 + charge * 2, pal: PAL_HOT, base: INK, forkBase: true,
      forks: 3 + Math.round(charge * 5), forkLen: 24 + charge * 50, step: 18, rate: 20, snap: true });
    if (charge > .12) for (const side of [-1, 1]) {
      const off = side * (10 + charge * 20);
      K.forkedBolt(ctx, x1 + nx * off * .2, y1 + ny * off * .2, x2 + nx * off * .5, y2 + ny * off * .5, seed + side * 40, time,
        { jitter: jitter * .7, alpha: .6, width: 1.1 + charge, pal: PAL, base: 'rgba(30,2,60,.4)', forks: 1, forkLen: 18, step: 20, rate: 15, snap: true });
    }

    // Speed lines: long thin streaks parallel to the dash, sliding forward and thinning out
    // (normal blend so they stay white-violet on grass).
    ctx.globalCompositeOperation = 'source-over';
    const lines = 5 + Math.round(charge * 6);
    for (let i = 0; i < lines; i++) {
      const h = K.hash(i * 4.7 + seed);
      const off = (h - .5) * 2 * (width + 14 + charge * 24);
      const t0 = K.hash(i * 2.3 + seed) * .55 + age * .35, t1 = Math.min(1, t0 + .25 + K.hash(i * 9.1) * .35);
      const a = alpha * (1 - Math.abs(off) / (width + 40 + charge * 24));
      if (a <= .03) continue;
      ctx.strokeStyle = `rgba(${i % 3 ? '220,180,255' : '250,240,255'},${a * .8})`;
      ctx.lineWidth = i % 3 ? 1.1 : 1.8;
      ctx.beginPath();
      ctx.moveTo(x1 + dx * t0 + nx * off, y1 + dy * t0 + ny * off);
      ctx.lineTo(x1 + dx * t1 + nx * off, y1 + dy * t1 + ny * off);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'lighter';
    // Chirping sparks spitting off the channel.
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    const sparks = 7 + Math.round(charge * 9);
    for (let i = 0; i < sparks; i++) {
      const cyc = time * 5 + K.hash(i * 3.3 + seed), ph = frac(cyc), n = Math.floor(cyc);
      const t = K.hash(i + n * 3.7 + seed), a = K.hash(i * 5.1 + n * 1.3) * TAU, d = 6 + ph * (20 + charge * 26);
      chirp(ctx, x1 + dx * t, y1 + dy * t, a, d, 9 + charge * 6, i + n);
    }
    ctx.strokeStyle = `rgba(240,215,255,${.9 * alpha})`; ctx.stroke();

    // Twin crescent cuts at the dash tip — violet blades with a thin white edge.
    const grow = K.ease.out(age * 2.5);
    const r1 = 16 + charge * 30 + 8 * grow, r2 = 22 + charge * 42 + 10 * grow;
    K.glow(ctx, x2, y2, r2 * 1.3, '150,60,255', .5);
    K.glow(ctx, x2, y2, r1 * .55, '220,170,255', .8, true);
    ctx.globalCompositeOperation = 'source-over';
    slash(ctx, x2, y2, r1 + 1, angle - 1.08, angle + .88, 3.4 + charge * 3.4, 'rgba(70,14,150,.55)');
    slash(ctx, x2, y2, r2 + 1, angle + 2.09, angle + 4.33, 2.8 + charge * 2.8, 'rgba(70,14,150,.45)');
    ctx.globalCompositeOperation = 'lighter';
    slash(ctx, x2, y2, r1, angle - 1.05, angle + .85, 3 + charge * 3, 'rgba(170,80,255,.85)');
    slash(ctx, x2, y2, r1 - 1.5, angle - .9, angle + .7, 1 + charge * .8, 'rgba(250,232,255,.95)');
    slash(ctx, x2, y2, r2, angle + 2.12, angle + 4.3, 2.4 + charge * 2.4, 'rgba(180,100,255,.75)');
    slash(ctx, x2, y2, r2 - 1.5, angle + 2.25, angle + 4.15, .8 + charge * .6, 'rgba(255,240,255,.9)');
    ctx.restore();
  }

  // ------------------------------------------------------------------ impact
  function drawBurst(ctx, burst, time, K) {
    const alpha = remaining(burst);
    if (alpha <= 0 || !validPoint(burst.x, burst.y)) return;
    const charge = clamp01(burst.charge || 0);
    const radius = Math.max(8, Math.min(460, Number.isFinite(burst.radius) ? burst.radius : 35));
    const progress = 1 - alpha;
    const e = K.ease.out(progress * 1.5);
    const ring = radius * (.18 + e * .86);
    const seed = burst.x * .013 + burst.y * .007;
    const lift = window.AnimeSprites ? window.AnimeSprites.LIFT : 24;

    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Scorched ground + violet tint (normal blend): keeps the burst purple on grass.
    const fade = 1 - K.ease.smooth((progress - .55) / .45);
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * fade;
    K.glow(ctx, 0, 0, radius * (.55 + e * .5), BODY, .42, false, .5);
    ctx.fillStyle = `rgba(28,8,44,${.28 * fade})`;
    ctx.beginPath(); ctx.ellipse(0, 0, radius * (.25 + e * .25), radius * (.11 + e * .11), 0, 0, TAU); ctx.fill();
    // Dark shock ring under the bright one.
    ctx.save(); ctx.scale(1, .5);
    ctx.strokeStyle = `rgba(${BODY},${.6 * alpha})`; ctx.lineWidth = (12 + charge * 10) * alpha + 3;
    ctx.beginPath(); ctx.arc(0, 0, ring, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = ga;

    ctx.globalCompositeOperation = 'lighter';
    // Impact flash: white-violet bloom and a column of light.
    if (progress < .2) {
      const f = 1 - progress / .2;
      K.glow(ctx, 0, -lift, Math.min(170, radius * (.3 + progress * 1.6)), '210,90,255', f, true);
      K.glow(ctx, 0, -lift * 2, Math.min(150, radius * .45), MAGENTA, f * .8, false, 2.2);
    }
    ctx.globalAlpha = ga * alpha;
    K.glow(ctx, 0, 0, radius * (.6 + e * .35), '120,40,230', .4, false, .55);
    K.glow(ctx, 0, -lift * .5, Math.min(110, radius * .3) * (1 - progress * .6), '210,90,255', .5, true);

    // Bright shock ring + a spinning inner arc.
    ctx.save(); ctx.scale(1, .5);
    ctx.strokeStyle = 'rgba(235,190,255,.95)'; ctx.lineWidth = 1.5 + 2 * alpha;
    ctx.beginPath(); ctx.arc(0, 0, ring, 0, TAU); ctx.stroke();
    if (charge > .08) {
      ctx.strokeStyle = 'rgba(210,150,255,.55)'; ctx.lineWidth = 2;
      const spin = time * 2.5 + seed;
      ctx.beginPath(); ctx.arc(0, 0, ring * .78, spin, spin + TAU * (.5 + charge * .25)); ctx.stroke();
    }
    ctx.restore();

    // Ring of lightning chasing the shock front: bolts linking points on the ground ellipse.
    const links = 6 + Math.round(charge * 4), lr = ring * .92;
    for (let i = 0; i < links; i++) {
      if (K.hash(i * 3.3 + seed + Math.floor(time * 9)) < .35) continue;
      const a0 = i * TAU / links + time * .6, a1 = a0 + TAU / links * .85;
      K.forkedBolt(ctx, Math.cos(a0) * lr, Math.sin(a0) * lr * .5, Math.cos(a1) * lr, Math.sin(a1) * lr * .5, seed + i * 5, time,
        { jitter: 6 + charge * 6, alpha: alpha * .9, width: 1 + charge * .6, pal: PAL, step: 14, forks: 0, rate: 24, snap: true });
    }

    // Radial ground lightning, flattened onto the ground plane, retracting toward the rim as it fades.
    const rays = 5 + Math.round(charge * 6);
    const reach = radius * (.3 + e * .62), from = radius * K.ease.in(progress) * .5;
    for (let i = 0; i < rays; i++) {
      const a = i * TAU / rays + K.hash(i + seed) * .5 + (K.wobble(seed + i, time, 2) - .5) * .4;
      const c = Math.cos(a), s = Math.sin(a) * .5;
      K.forkedBolt(ctx, c * from, s * from, c * reach, s * reach, seed + i * 9, time,
        { jitter: 8 + charge * 8, alpha: 1, width: 1.3 + charge, pal: PAL, base: INK, step: 16, forks: 1, forkLen: 14 + charge * 18, rate: 22, snap: true });
    }
    // Vertical arcs: the lightning column whips up out of the impact early on.
    if (progress < .45) {
      const v = 1 - progress / .45, h = (lift * 2.5 + radius * .45) * (.6 + e * .4);
      const n = 2 + Math.round(charge * 2);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * .55 + (K.wobble(seed + i * 3, time, 5) - .5) * .5;
        const l = h * (.65 + K.hash(i + seed) * .35);
        K.forkedBolt(ctx, 0, -4, Math.cos(a) * l * .8, Math.sin(a) * l, seed + i * 17, time,
          { jitter: 12 + charge * 8, alpha: v, width: 1.4 + charge * .8, pal: PAL_HOT, base: ink(v), forkBase: true, step: 12, forks: 2, forkLen: 20 + charge * 14, rate: 22, snap: true });
      }
    }

    // Crossed critical-hit slashes, tapered like blade cuts (violet body, white edge).
    if (progress < .7) {
      const k = 1 - progress / .7;
      const crossSize = radius * (.38 + e * .25);
      ctx.save(); ctx.translate(0, -lift * .6); ctx.rotate(seed * 3 + progress * .3);
      for (const [ang, scale] of [[-.52, 1], [.92, .85]]) {
        ctx.save(); ctx.rotate(ang);
        const L = crossSize * scale, T = (7 + charge * 7) * k + 1.5;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(64,12,140,${.5 * k})`;
        ctx.beginPath(); ctx.moveTo(-L * 1.04, 0); ctx.quadraticCurveTo(0, -T * 1.25, L * 1.04, 0); ctx.quadraticCurveTo(0, T * .7, -L * 1.04, 0); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(170,70,255,${.85 * k})`;
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -T, L, 0); ctx.quadraticCurveTo(0, T * .5, -L, 0); ctx.fill();
        ctx.fillStyle = `rgba(255,245,255,${.95 * k})`;
        ctx.beginPath(); ctx.moveTo(-L * .85, 0); ctx.quadraticCurveTo(0, -T * .3, L * .85, 0); ctx.quadraticCurveTo(0, T * .12, -L * .85, 0); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Sparks thrown out on ballistic arcs.
    ctx.fillStyle = '#f2d4ff';
    for (let i = 0; i < 14; i++) {
      const a = K.hash(i * 7.7 + seed) * TAU, sp = .5 + K.hash(i + seed) * .5, d = radius * (.1 + e * .6 * sp);
      const up = (lift + radius * .3 * sp) * progress * 3.2 - progress * progress * radius * 1.4;
      const sz = 2.6 * alpha + .8;
      ctx.fillRect(Math.cos(a) * d - sz / 2, Math.sin(a) * d * .5 - Math.max(0, up) - sz / 2, sz, sz);
    }
    // Rock chips (normal blend so they read on bright and dark ground).
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(40,26,46,${alpha})`;
    for (let i = 0; i < 8; i++) {
      const a = K.hash(i * 2.9 + seed + 4) * TAU, sp = .5 + K.hash(i * 1.7 + seed) * .5, d = radius * (.12 + e * .5 * sp);
      const up = (lift * 1.5 + radius * .25 * sp) * progress * 3 - progress * progress * radius * 1.3;
      if (up < -2) continue;
      const sz = 2 + K.hash(i * 5.5) * 3;
      ctx.fillRect(Math.cos(a) * d - sz / 2, Math.sin(a) * d * .5 - up - sz / 2, sz, sz * .8);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ charge in the hand
  function drawCharge(ctx, state, time, K) {
    const charge = state.charge, player = state.player;
    if (!charge || !player || !validPoint(player.x, player.y)) return;
    const ratio = clamp01(charge.ratio || 0);
    const angle = player.angle || 0;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const radius = 14 + ratio * 19;
    const reach = (player.r || 13) + 10 + radius * .3;
    // The lightning crackles in the palm when the game provides the hand position.
    const handX = state.hand ? state.hand.x + ca * (6 + radius * .25) : player.x + ca * reach;
    const handY = state.hand ? state.hand.y + sa * (3 + radius * .15) : player.y + sa * reach - 20;
    const seed = 7.7;
    const full = ratio >= .98;
    const flick = .85 + K.wobble(seed, time, 22) * .3;

    // Charge meter ring at the feet.
    ctx.save();
    ctx.translate(player.x, player.y);
    const orbit = 30 + ratio * 30;
    K.glow(ctx, 0, 2, orbit * 1.3, BODY, .3 + ratio * .25, false, .45);
    ctx.scale(1, .45);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${DEEP},.3)`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, orbit, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(150,70,255,.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, orbit, -Math.PI / 2, -Math.PI / 2 + TAU * ratio); ctx.stroke();
    ctx.strokeStyle = '#f0d8ff'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, orbit, -Math.PI / 2, -Math.PI / 2 + TAU * ratio); ctx.stroke();
    K.glow(ctx, Math.cos(-Math.PI / 2 + TAU * ratio) * orbit, Math.sin(-Math.PI / 2 + TAU * ratio) * orbit, 9, '220,170,255', .9, true);
    ctx.restore();

    // Ground crackle around the feet once the charge builds.
    if (ratio > .3) {
      ctx.save(); ctx.translate(player.x, player.y);
      ctx.globalCompositeOperation = 'lighter';
      const n = 2 + Math.round(ratio * 3);
      for (let i = 0; i < n; i++) {
        const a = K.wobble(seed + 20 + i * 4, time, 3) * TAU, r0 = 8, r1 = orbit * (.9 + K.wobble(seed + i, time, 8) * .5);
        K.forkedBolt(ctx, Math.cos(a) * r0, Math.sin(a) * r0 * .45, Math.cos(a) * r1, Math.sin(a) * r1 * .45, seed + 90 + i * 7, time,
          { jitter: 5, alpha: (ratio - .3) * 1.4, width: .9, pal: PAL, base: ink((ratio - .3) * 1.4), step: 8, rate: 24, snap: true });
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(handX, handY);
    // The Chidori in the palm: a dark violet heart wrapped in a magenta glow, with ink-edged
    // lightning streams bursting out and re-forking every other frame (the "thousand birds").
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, 0, 0, radius * 2.2 * flick, MAGENTA, .3 + ratio * .2);
    ctx.globalCompositeOperation = 'source-over';
    if (K.chidoriBall) K.chidoriBall(ctx, 0, 0, radius * (.75 + ratio * .15), time, seed, { pal: PAL_HOT, body: BODY, dark: '26,2,52',
      base: INK, power: .3 + ratio * .7, bolts: 7 + Math.round(ratio * 5), width: .8 + ratio * .5 });
    ctx.globalCompositeOperation = 'lighter';

    // Chidori dragged along the ground: a crackling tether from the palm to a sparking contact point.
    if (ratio > .35) {
      const gx = player.x + ca * (reach + radius * .5) - handX, gy = player.y + sa * (reach + radius * .5) * .5 - handY;
      const k = Math.min(1, (ratio - .35) * 2);
      K.forkedBolt(ctx, 0, 0, gx, gy, seed + 70, time, { jitter: 7, alpha: k, width: 1 + ratio * .6, pal: PAL_HOT, base: ink(k), forkBase: true, step: 8, forks: 1, forkLen: 12, rate: 24, snap: true });
      K.glow(ctx, gx, gy, 14 + ratio * 16, MAGENTA, .8 * k, true, .5);
      ctx.strokeStyle = `rgba(240,210,255,${.8 * k})`; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const cyc = time * 6 + K.hash(i * 1.9), ph = frac(cyc), n = Math.floor(cyc);
        const a = -Math.PI / 2 + (K.hash(i * 3.7 + n) - .5) * 2.4;
        chirp(ctx, gx, gy, a, 3 + ph * 18, 6, i + n * 3);
      }
      ctx.stroke();
    }

    // Chirping zigzag sparks thrown off the ball.
    ctx.strokeStyle = 'rgba(246,226,255,.9)'; ctx.lineWidth = .9;
    ctx.beginPath();
    const sparkN = 6 + Math.round(ratio * 6);
    for (let i = 0; i < sparkN; i++) {
      const cyc = time * 4.5 + K.hash(i), ph = frac(cyc), n = Math.floor(cyc);
      if (ph > .8) continue;
      const a = K.hash(i * 3.1 + n * 7.7) * TAU, d = radius * (.4 + ph * 1.1);
      chirp(ctx, 0, 0, a, d, 3.5 + ratio * 2.5, i * 2 + n);
    }
    ctx.stroke();

    // Fully charged: the ball flares in a pulsing crown of long arcs with a star glint.
    if (full) {
      const p = .5 + .5 * Math.sin(time * 16);
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + time * 1.3 + K.wobble(seed + 80 + i, time, 5);
        const l = radius * (1.5 + p * .5);
        K.forkedBolt(ctx, 0, 0, Math.cos(a) * l, Math.sin(a) * l * .85, seed + 100 + i * 7, time,
          { jitter: 7, alpha: .5 + p * .4, width: .9, pal: PAL_HOT, base: INK, forkBase: true, step: 9, forks: 1, forkLen: 12, rate: 24, snap: true });
      }
      ctx.fillStyle = `rgba(255,248,255,${.6 + p * .4})`;
      const g = radius * (.4 + p * .2);
      ctx.beginPath();
      ctx.moveTo(-g, 0); ctx.lineTo(0, -g * .1); ctx.lineTo(g, 0); ctx.lineTo(0, g * .1); ctx.closePath();
      ctx.moveTo(0, -g * .7); ctx.lineTo(g * .08, 0); ctx.lineTo(0, g * .7); ctx.lineTo(-g * .08, 0); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  window.PurpleChidoriVFX = {
    draw(ctx, state, time) {
      const K = window.VFXKit;
      if (!ctx || !state || !K) return;
      const now = Number.isFinite(time) ? time : 0;
      const trails = Array.isArray(state.trails) ? state.trails : [];
      const bursts = Array.isArray(state.bursts) ? state.bursts : [];
      for (let i = Math.max(0, trails.length - MAX_TRAILS); i < trails.length; i++) {
        drawTrail(ctx, trails[i], now, K);
      }
      for (let i = Math.max(0, bursts.length - MAX_BURSTS); i < bursts.length; i++) {
        drawBurst(ctx, bursts[i], now, K);
      }
      drawCharge(ctx, state, now, K);
    }
  };
})();
