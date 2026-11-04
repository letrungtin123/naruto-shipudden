(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const c01 = n => Math.max(0, Math.min(1, n));
  const lift = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  // Naruto's Rinnegan mode (U): the ripple-eye aura on the player, and the Deva Path jutsu
  // the game puts in `state.effects`: Shinra Tensei (push), Banshō Ten'in (pull),
  // Chibaku Tensei (planetary devastation), Gakidō absorbing enemy shots, and the awakening.
  // Ground parts draw under the characters (drawGround), the rest above them (drawOverlay).

  // The Rinnegan itself: lavender eye with concentric ripples, cached once.
  let eyeCanvas = null;
  function eyeSprite() {
    if (eyeCanvas) return eyeCanvas;
    const s = 128, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d'), m = s / 2;
    const grd = g.createRadialGradient(m, m, 4, m, m, m - 2);
    grd.addColorStop(0, '#efe8ff'); grd.addColorStop(.65, '#b9a2ec'); grd.addColorStop(1, '#7d5fc4');
    g.fillStyle = grd; g.beginPath(); g.arc(m, m, m - 2, 0, TAU); g.fill();
    g.strokeStyle = '#33206a';
    for (const [r, w] of [[11, 4.5], [23, 3.4], [35, 3.2], [47, 3], [60, 3.4]]) { g.lineWidth = w; g.beginPath(); g.arc(m, m, r, 0, TAU); g.stroke(); }
    g.fillStyle = '#22104e'; g.beginPath(); g.arc(m, m, 6, 0, TAU); g.fill();
    eyeCanvas = c;
    return c;
  }

  // ---------------------------------------------------------------- player aura
  // Behind: ripples spreading over the ground from Naruto's feet and a violet haze.
  // Above: violet chakra wisps rising off him; a casting pulse flashes a ring at chest height.
  function drawAura(ctx, p, feetY, facing, time, above) {
    const K = window.VFXKit;
    if (!K) return;
    const x = p.x, pulse = c01((p.rinPulse || 0) / .35);
    ctx.save();
    if (!above) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, feetY - 18, 46 + pulse * 20, '140,90,255', .32 + pulse * .3, false, .9);
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(x, feetY); ctx.scale(1, .45);
      for (let i = 0; i < 4; i++) {
        const t = (time * .45 + i / 4) % 1, r = 12 + t * 70;
        ctx.lineWidth = 2.6; ctx.strokeStyle = `rgba(96,52,200,${(1 - t) * .6})`;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = `rgba(225,210,255,${(1 - t) * .55})`;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    // wisps
    for (let i = 0; i < 6; i++) {
      const t = (time * .6 + i / 6) % 1, a = (1 - t) * (1 - t);
      const px = x + Math.sin(i * 5.1 + time * 1.3) * (9 + t * 7), py = feetY - 16 - t * 52, r = 2.5 + t * 6;
      K.glow(ctx, px, py, r * 2.4, '160,110,255', a * .55);
    }
    if (pulse > 0) {
      const r = 18 + (1 - pulse) * 40, cy = feetY - lift() - 4;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(110,60,220,${pulse * .8})`; ctx.lineWidth = 4 * pulse + 1;
      ctx.beginPath(); ctx.ellipse(x, cy, r, r * .45, 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(235,220,255,${pulse * .9})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, cy, r, r * .45, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Shinra Tensei
  function shinraGround(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, e = K.ease.out(c01(age * 1.5));
    const fade = 1 - K.ease.smooth((age - .4) / .6), seed = (fx.x * .013 + fx.y * .007) % 37;
    const x = fx.x, y = fx.y;
    // the ground flattened in a circle, with cracks running out from Naruto
    ctx.fillStyle = `rgba(60,44,70,${.28 * fade})`;
    ctx.beginPath(); ctx.ellipse(x, y, R * e * .55, R * e * .27, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(40,28,40,${.55 * fade})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + K.hash(i + seed) * .4, len = R * e * (.35 + K.hash(i * 3 + seed) * .3);
      ctx.moveTo(x + Math.cos(an) * 14, y + Math.sin(an) * 7);
      ctx.lineTo(x + Math.cos(an + .1) * len * .55, y + Math.sin(an + .1) * len * .55 * .5);
      ctx.lineTo(x + Math.cos(an) * len, y + Math.sin(an) * len * .5);
    }
    ctx.stroke();
    // a wall of dust shoved outward with the front of the force
    const dust = K.puff('dust');
    for (let i = 0; i < 16; i++) {
      const an = i * TAU / 16 + K.hash(i * 2.3 + seed) * .3, d = R * (.15 + e * .92);
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - age * 10, R * (.07 + age * .1), fade * .5);
    }
  }

  function shinraOverlay(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, e = K.ease.out(c01(age * 1.5));
    const fade = 1 - K.ease.smooth((age - .3) / .7), seed = (fx.x * .013 + fx.y * .007) % 37;
    const x = fx.x, y = fx.y, cy = y - lift(), r = R * (.12 + e * .9);
    ctx.save();
    ctx.strokeStyle = `rgba(104,62,210,${.6 * fade})`; ctx.lineWidth = 8 * fade + 2;
    ctx.beginPath(); ctx.ellipse(x, cy, r, r * .78, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6 * fade + 1;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r * .5, 0, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    // the instant of release
    if (age < .16) K.glow(ctx, x, cy, R * (.35 + age * 2.5), '245,235,255', 1 - age / .16, true);
    // the sphere of repulsion: clear inside, a bright lavender skin
    const g = ctx.createRadialGradient(x, cy, r * .55, x, cy, r);
    g.addColorStop(0, 'rgba(200,170,255,0)'); g.addColorStop(.8, `rgba(190,160,255,${.16 * fade})`); g.addColorStop(1, `rgba(240,225,255,${.5 * fade})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, cy, r, r * .78, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(250,240,255,${.85 * fade})`; ctx.lineWidth = 1.5 + 2 * fade;
    ctx.beginPath(); ctx.ellipse(x, cy, r, r * .78, 0, 0, TAU); ctx.stroke();
    // the shock front sliding over the ground
    ctx.strokeStyle = `rgba(225,210,255,${.8 * fade})`; ctx.lineWidth = 2 * fade + 1;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r * .5, 0, 0, TAU); ctx.stroke();
    if (age > .08) {
      const r2 = R * (.1 + K.ease.out(c01((age - .08) * 1.6)) * .8);
      ctx.strokeStyle = `rgba(255,255,255,${.5 * fade})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, r2, r2 * .5, 0, 0, TAU); ctx.stroke();
    }
    // streaks of displaced air flung outward
    ctx.strokeStyle = `rgba(235,225,255,${.7 * fade})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 22; i++) {
      const an = i * TAU / 22 + K.hash(i * 1.7 + seed) * .25, r1 = r * (.75 + K.hash(i * 3 + seed) * .2), r3 = r1 + R * (.12 + K.hash(i * 5 + seed) * .2);
      ctx.moveTo(x + Math.cos(an) * r1, cy + Math.sin(an) * r1 * .78);
      ctx.lineTo(x + Math.cos(an) * r3, cy + Math.sin(an) * r3 * .78);
    }
    ctx.stroke();
    ctx.restore();
    if (K.fx) K.fx.debris(ctx, x, y, R * .9, age, seed, '#4a3c48', 12);
  }

  // ---------------------------------------------------------------- Banshō Ten'in
  function banshoOverlay(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), fade = 1 - K.ease.smooth((age - .35) / .65);
    if (fade <= 0) return;
    const L = lift(), x = fx.x, y = fx.y - L, tx = fx.tx, ty = fx.ty - L * .6;
    const ang = Math.atan2(ty - y, tx - x), len = Math.hypot(tx - x, ty - y), nx = -Math.sin(ang), ny = Math.cos(ang);
    const swirl = K.swirl('bansho', ['rgba(255,255,255,.95)', 'rgba(190,150,255,.85)', 'rgba(120,80,230,.7)'], 5, 1.3, .1);
    const dark = K.swirl('banshoDark', ['rgba(80,40,180,.9)', 'rgba(120,80,225,.8)'], 5, 1.3, .1);
    ctx.save();
    K.spin(ctx, dark, tx, ty, fx.radius * (.8 - age * .35), -time * 9 + .3, .8 * fade, .6);
    ctx.globalCompositeOperation = 'lighter';
    // the vortex over the target, spinning inward
    K.glow(ctx, tx, ty, fx.radius * .9, '150,100,255', .5 * fade, false, .7);
    K.spin(ctx, swirl, tx, ty, fx.radius * (.75 - age * .35), -time * 9, .75 * fade, .6);
    // streams of force flowing from the target into Naruto's palm, wavy and racing inward
    ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const off = (k - 2) * 9;
      ctx.globalCompositeOperation = k === 2 ? 'lighter' : 'source-over';
      ctx.strokeStyle = `rgba(${k === 2 ? '250,245,255' : '110,64,220'},${(k === 2 ? .9 : .7) * fade})`;
      ctx.lineWidth = k === 2 ? 3 : 2.4;
      ctx.setLineDash([22, 14]); ctx.lineDashOffset = time * 260 + k * 7;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, w = Math.sin(t * 9 + time * 16 + k) * (6 + off * .3) * Math.sin(t * Math.PI);
        const px = tx + (x - tx) * t + nx * (off * (1 - t) + w), py = ty + (y - ty) * t + ny * (off * (1 - t) + w) * .6;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'lighter';
    // each enemy torn loose leaves a streak along its flight
    const from = fx.from || [];
    ctx.strokeStyle = `rgba(215,195,255,${.75 * fade})`; ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i + 1 < from.length; i += 2) {
      const sx = fx.x + from[i], sy = fx.y + from[i + 1] - L * .6, k = c01(age * 2.2);
      ctx.moveTo(sx, sy); ctx.lineTo(sx + (x - sx) * k * .85, sy + (y - sy) * k * .85);
    }
    ctx.stroke();
    // the hand that pulls
    K.glow(ctx, x + Math.cos(ang) * 14, y + Math.sin(ang) * 8, 26, '230,210,255', .9 * fade, true);
    ctx.restore();
    void len;
  }

  // ---------------------------------------------------------------- Chibaku Tensei
  // Rocks rise from the ground and pack round a black core into a growing sphere; at the end
  // the sphere crushes shut with a shock wave.
  const ROCKS = 46;
  function rock(ctx, x, y, s, seed, K, dark) {
    ctx.fillStyle = dark ? '#3a2e2a' : '#6e5a48';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const an = i * TAU / 6 + K.hash(seed + i) * .6, r = s * (.7 + K.hash(seed * 2 + i) * .5);
      if (i) ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); else ctx.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
    }
    ctx.closePath(); ctx.fill();
    if (!dark) { ctx.fillStyle = 'rgba(200,180,150,.55)'; ctx.beginPath(); ctx.arc(x - s * .25, y - s * .3, s * .38, 0, TAU); ctx.fill(); }
  }

  function chibakuGround(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, seed = (fx.x * .011 + fx.y * .019) % 41;
    const grow = c01(age / .5), fade = age > .9 ? 1 - (age - .9) / .1 : 1;
    // the ground torn up under the core
    ctx.fillStyle = `rgba(40,26,34,${.4 * grow * fade})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * .55 * grow, R * .27 * grow, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(30,20,26,${.6 * fade})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const an = i * TAU / 10 + K.hash(i + seed) * .5, l = R * (.4 + K.hash(i * 3 + seed) * .45) * grow;
      ctx.moveTo(fx.x + Math.cos(an) * 20, fx.y + Math.sin(an) * 10);
      ctx.lineTo(fx.x + Math.cos(an + .12) * l * .6, fx.y + Math.sin(an + .12) * l * .3);
      ctx.lineTo(fx.x + Math.cos(an) * l, fx.y + Math.sin(an) * l * .5);
    }
    ctx.stroke();
    // a violet ring marking the pull
    ctx.save();
    ctx.strokeStyle = `rgba(104,62,210,${.6 * fade})`; ctx.lineWidth = 3;
    ctx.setLineDash([16, 10]); ctx.lineDashOffset = -time * 60;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R, R * .5, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function chibakuOverlay(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, seed = (fx.x * .011 + fx.y * .019) % 41;
    const x = fx.x, rise = K.ease.out(c01(age / .14)), coreY = fx.y - 40 - rise * 130;
    const crush = c01((age - .85) / .15), fade = age > .9 ? 1 - (age - .9) / .1 : 1;
    const shellR = (14 + K.ease.inOut(c01((age - .08) / .72)) * 66) * (1 - crush * .45);
    ctx.save();
    // dark gravity well round the core
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, coreY, 70 + shellR * 1.6, '120,70,230', .45 * fade);
    ctx.globalCompositeOperation = 'source-over';
    // dust and grit streaming up off the ground into the core
    ctx.strokeStyle = `rgba(110,90,80,${.45 * fade * (1 - crush)})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const ph = (time * .9 + K.hash(i * 2.1 + seed)) % 1, an = K.hash(i * 4.7 + seed) * TAU, d = R * (.3 + K.hash(i * 1.3) * .6);
      const gx = x + Math.cos(an) * d, gy = fx.y + Math.sin(an) * d * .5;
      const ax = gx + (x - gx) * ph, ay = gy + (coreY - gy) * ph, bx = gx + (x - gx) * Math.min(1, ph + .12), by = gy + (coreY - gy) * Math.min(1, ph + .12);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
    ctx.stroke();
    // rocks: in flight from the ground, then orbiting on the shell; back half first
    const pos = [];
    for (let i = 0; i < ROCKS; i++) {
      const t0 = .04 + K.hash(i * 3.3 + seed) * .55, k = c01((age - t0) / .16);
      if (k <= 0) continue;
      const an0 = K.hash(i * 7.1 + seed) * TAU, d0 = R * (.25 + K.hash(i * 1.9 + seed) * .7);
      const gx = x + Math.cos(an0) * d0, gy = fx.y + Math.sin(an0) * d0 * .5;
      const orb = K.hash(i * 5.5 + seed) * TAU + time * (.8 + K.hash(i) * .6), tilt = (K.hash(i * 9.9) - .5) * 1.6;
      const ox = x + Math.cos(orb) * shellR, oy = coreY + Math.sin(orb) * Math.sin(tilt) * shellR * .9 + Math.cos(tilt) * (K.hash(i * 2.6) - .5) * shellR * 1.4;
      const ek = K.ease.inOut(k);
      pos.push({ x: gx + (ox - gx) * ek, y: gy + (oy - gy) * ek - Math.sin(ek * Math.PI) * 30, s: 4 + K.hash(i * 8.8 + seed) * 6, front: Math.sin(orb) > 0, i });
    }
    for (const r of pos) if (!r.front) rock(ctx, r.x, r.y, r.s, r.i + seed, K, true);
    // the sphere itself: packed rock, shaded like a planet
    if (shellR > 16) {
      const sr = shellR * .92 * c01((age - .2) / .3);
      if (sr > 4) {
        const g = ctx.createRadialGradient(x - sr * .35, coreY - sr * .4, sr * .1, x, coreY, sr);
        g.addColorStop(0, '#8a7460'); g.addColorStop(.6, '#4e3e34'); g.addColorStop(1, '#221a1c');
        ctx.fillStyle = g; ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.arc(x, coreY, sr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(20,14,16,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let j = 0; j < 7; j++) {
          const an = K.hash(j * 3 + seed) * TAU, l = sr * (.4 + K.hash(j) * .5);
          ctx.moveTo(x + Math.cos(an) * sr * .2, coreY + Math.sin(an) * sr * .2); ctx.lineTo(x + Math.cos(an) * l, coreY + Math.sin(an) * l);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // the black core, visible until the rock closes over it
    if (shellR < 60 || age < .3) {
      ctx.fillStyle = `rgba(12,6,20,${fade})`;
      ctx.beginPath(); ctx.arc(x, coreY, 9 + rise * 5, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(200,160,255,${.8 * fade})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, coreY, 12 + rise * 5 + Math.sin(time * 20) * 1.5, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const r of pos) if (r.front) rock(ctx, r.x, r.y, r.s, r.i + seed, K, false);
    // the crush: the sphere slams shut and the shock rolls out over the ground
    if (crush > 0) {
      ctx.globalCompositeOperation = 'lighter';
      if (crush < .4) K.glow(ctx, x, coreY, 120 + crush * 200, '230,210,255', 1 - crush / .4, true);
      ctx.strokeStyle = `rgba(220,200,255,${1 - crush})`; ctx.lineWidth = 5 * (1 - crush) + 1;
      const rr = R * (.2 + K.ease.out(crush) * .9);
      ctx.beginPath(); ctx.ellipse(x, fx.y, rr, rr * .5, 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      const dust = K.puff('dust');
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + K.hash(i + seed) * .4;
        K.stamp(ctx, dust, x + Math.cos(an) * rr * .9, fx.y + Math.sin(an) * rr * .45 - 8, R * (.1 + crush * .1), (1 - crush) * .5);
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Gakidō and awakening
  function absorbOverlay(ctx, fx, time, K) {
    const k = 1 - c01(fx.life / fx.maxLife), L = lift();
    const x = fx.x + (fx.tx - fx.x) * K.ease.in(k), y = fx.y - L + (fx.ty - fx.y) * K.ease.in(k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, 22 * (1 - k * .6), '170,120,255', 1 - k, true);
    ctx.strokeStyle = `rgba(220,200,255,${1 - k})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(fx.x, fx.y - L, 6 + k * 26, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function awakenGround(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, a = Math.sin(Math.PI * c01(age * 1.2));
    // the Rinnegan's ripples printed huge on the ground for a moment
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5); ctx.rotate(time * .4);
    ctx.globalAlpha = a * .75;
    const s = R * (.5 + K.ease.out(age) * .5);
    ctx.drawImage(eyeSprite(), -s, -s, s * 2, s * 2);
    ctx.restore();
  }

  function awakenOverlay(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const k = c01(age * 1.4 - i * .12);
      if (k <= 0 || k >= 1) continue;
      ctx.strokeStyle = `rgba(104,62,210,${(1 - k) * .75})`; ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * k, R * k * .5, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    if (age < .2) K.glow(ctx, fx.x, fx.y - lift() - 6, 90 + age * 300, '200,170,255', 1 - age / .2, true);
    for (let i = 0; i < 4; i++) {
      const k = c01(age * 1.4 - i * .12);
      if (k <= 0 || k >= 1) continue;
      ctx.strokeStyle = `rgba(230,215,255,${(1 - k) * .8})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * k, R * k * .5, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  window.RinneganVFX = {
    eyeSprite,
    drawAura,
    drawGround(ctx, state, elapsed) {
      const K = window.VFXKit, list = state && state.effects;
      if (!ctx || !K || !list) return;
      for (const fx of list) {
        if (!fx || !(fx.life > 0) || !Number.isFinite(fx.x)) continue;
        if (fx.kind === 'shinra') shinraGround(ctx, fx, elapsed, K);
        else if (fx.kind === 'chibaku') chibakuGround(ctx, fx, elapsed, K);
        else if (fx.kind === 'awaken') awakenGround(ctx, fx, elapsed, K);
      }
    },
    drawOverlay(ctx, state, elapsed) {
      const K = window.VFXKit, list = state && state.effects;
      if (!ctx || !K || !list) return;
      for (const fx of list) {
        if (!fx || !(fx.life > 0) || !Number.isFinite(fx.x)) continue;
        if (fx.kind === 'shinra') shinraOverlay(ctx, fx, elapsed, K);
        else if (fx.kind === 'bansho') banshoOverlay(ctx, fx, elapsed, K);
        else if (fx.kind === 'chibaku') chibakuOverlay(ctx, fx, elapsed, K);
        else if (fx.kind === 'absorb') absorbOverlay(ctx, fx, elapsed, K);
        else if (fx.kind === 'awaken') awakenOverlay(ctx, fx, elapsed, K);
      }
    }
  };
})();
