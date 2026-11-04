(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const c01 = n => Math.max(0, Math.min(1, n));
  const lift = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  // Baryon mode's left-click taijutsu (T): the Kurama chakra fist, the lash of nine chakra tails
  // and Kurama's giant chakra arm slamming down. The game fills `state.effects`; ground scorch
  // draws under the characters (drawGround), everything else over them (drawOverlay).

  // Kurama's chakra: a crimson rim, an orange body and a hot amber heart, outlined dark for grass.
  function chakraFill(ctx, x0, y0, x1, y1, a) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(176,18,22,${.9 * a})`);
    g.addColorStop(.5, `rgba(250,88,30,${.92 * a})`);
    g.addColorStop(1, `rgba(255,176,70,${.95 * a})`);
    return g;
  }

  // An upright tongue of flame standing on (x, y), h tall.
  const FB = 114 / 128;
  function flame(ctx, K, x, y, h, alpha, i) {
    if (alpha <= .01 || h < 2) return;
    const old = ctx.globalAlpha;
    ctx.globalAlpha = old * alpha;
    ctx.drawImage(K.flame(i), x - h * .22, y - h * FB, h * .44, h);
    ctx.globalAlpha = old;
  }

  // A tail along a quadratic curve, w0 wide at the root and w1 at the tip.
  function tailShape(ctx, x0, y0, cx, cy, x1, y1, w0, w1) {
    const N = 12, left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, it = 1 - t;
      const px = it * it * x0 + 2 * it * t * cx + t * t * x1, py = it * it * y0 + 2 * it * t * cy + t * t * y1;
      const dx = 2 * it * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * it * (cy - y0) + 2 * t * (y1 - cy), l = Math.hypot(dx, dy) || 1;
      const w = (w0 + (w1 - w0) * t) * (t < .2 ? .65 + t / .2 * .35 : 1);
      left.push(px - dy / l * w, py + dx / l * w); right.push(px + dy / l * w, py - dx / l * w);
    }
    ctx.beginPath(); ctx.moveTo(left[0], left[1]);
    for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
    ctx.lineTo(x1 + (x1 - cx) * .04, y1 + (y1 - cy) * .04);
    for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
    ctx.closePath();
  }

  // A clenched fist facing +x, `s` wide, with the forearm trailing back.
  function fistPath(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * .55, -s * .42);
    ctx.quadraticCurveTo(-s * .1, -s * .62, s * .32, -s * .5);
    // knuckles
    for (let i = 0; i < 4; i++) {
      const y0 = -s * .5 + i * s * .25, y1 = y0 + s * .25;
      ctx.quadraticCurveTo(s * .62, (y0 + y1) / 2 - s * .02, s * .34, y1);
    }
    ctx.quadraticCurveTo(s * .05, s * .62, -s * .35, s * .5);
    // thumb wrapped under the fingers
    ctx.quadraticCurveTo(-s * .1, s * .3, s * .12, s * .32);
    ctx.quadraticCurveTo(-s * .05, s * .62, -s * .55, s * .42);
    // forearm
    ctx.lineTo(-s * 1.7, s * .22); ctx.quadraticCurveTo(-s * 2.2, 0, -s * 1.7, -s * .22);
    ctx.closePath();
  }

  // Kurama's open claw seen from above, thick fingers spread toward +y, `s` across the palm.
  const FINGERS = [[-1.5, .62, .2], [-.5, .74, .07], [.5, .72, -.07], [1.5, .6, -.2]];
  function finger(ctx, x, y, len, ang, w) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.moveTo(-w, 0); ctx.lineTo(-w * .85, len * .8); ctx.quadraticCurveTo(0, len * 1.02, w * .85, len * .8); ctx.lineTo(w, 0);
    ctx.restore();
  }
  function handPath(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(0, 0, s * .62, s * .52, 0, 0, TAU);
    for (const [k, len, ang] of FINGERS) finger(ctx, k * s * .3, s * .28, len * s, ang, s * .17);
    finger(ctx, -s * .55, -s * .02, s * .5, .95, s * .16);
  }
  function claws(ctx, s) {
    ctx.beginPath();
    const claw = (x, y, len, ang, w) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.moveTo(-w * .55, len * .86); ctx.quadraticCurveTo(-w * .2, len * 1.25, 0, len * 1.32); ctx.quadraticCurveTo(w * .1, len * 1.15, w * .55, len * .86);
      ctx.restore();
    };
    for (const [k, len, ang] of FINGERS) claw(k * s * .3, s * .28, len * s, ang, s * .17);
    claw(-s * .55, -s * .02, s * .5, .95, s * .16);
    ctx.fillStyle = '#2a0808'; ctx.fill();
  }

  // ---------------------------------------------------------------- chakra fist
  function fistGround(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, fade = 1 - K.ease.smooth((age - .3) / .7);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5); ctx.rotate(fx.angle);
    const g = ctx.createRadialGradient(R * .55, 0, 4, R * .55, 0, R * .55);
    g.addColorStop(0, `rgba(80,20,10,${.35 * fade})`); g.addColorStop(1, 'rgba(80,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(R * .55, 0, R * .55, R * .32, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function fistOverlay(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, a = fx.angle, L = lift();
    const seed = (fx.x * .013 + fx.y * .029) % 31, thrust = K.ease.out(c01(age / .35));
    const fade = 1 - K.ease.smooth((age - .3) / .7);
    const ca = Math.cos(a), sa = Math.sin(a);
    // flame streaks blasting ahead of the fist
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const sp = (K.hash(i * 2.3 + seed) - .5) * .9, t = c01((age - K.hash(i * 4.1 + seed) * .2) / .45);
      if (t <= 0 || t >= 1) continue;
      const an = a + sp, d1 = 30 + K.ease.out(t) * R * (.8 + K.hash(i) * .3), d0 = Math.max(16, d1 - 90);
      const f = 1 - t * t;
      const x0 = fx.x + Math.cos(an) * d0, y0 = fx.y - L + Math.sin(an) * d0 * .6, x1 = fx.x + Math.cos(an) * d1, y1 = fx.y - L + Math.sin(an) * d1 * .6;
      ctx.strokeStyle = `rgba(220,50,20,${.5 * f})`; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,210,120,${.8 * f})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.restore();
    // the fist of chakra itself, thrown out from Naruto's arm
    if (fade > 0) {
      const d = 30 + thrust * R * .6, s = 32 + thrust * 42;
      const px = fx.x + ca * d, py = fx.y - L + sa * d * .6;
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(sa * .6, ca));
      ctx.globalAlpha = fade;
      ctx.lineJoin = 'round';
      fistPath(ctx, s);
      ctx.fillStyle = chakraFill(ctx, -s * 2, 0, s * .6, 0, 1); ctx.fill();
      ctx.strokeStyle = '#5a0a0a'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,230,160,.9)'; ctx.lineWidth = 1.2; ctx.stroke();
      K.glow(ctx, s * .2, 0, s * 1.3, '255,120,40', .35);
      ctx.restore();
    }
    // the hit: a flare and a ring of fire where the fist lands
    const hit = c01((age - .25) / .5);
    if (hit > 0 && hit < 1) {
      const hx = fx.x + ca * R * .72, hy = fx.y + sa * R * .72;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (hit < .35) K.glow(ctx, hx, hy - L * .6, 70 + hit * 90, '255,200,120', 1 - hit / .35, true);
      ctx.strokeStyle = `rgba(255,140,60,${1 - hit})`; ctx.lineWidth = 4 * (1 - hit) + 1;
      ctx.beginPath(); ctx.ellipse(hx, hy, 20 + hit * 90, (20 + hit * 90) * .5, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 7; i++) {
        const an = i * TAU / 7 + K.hash(i + seed), r = 18 + hit * 66;
        flame(ctx, K, hx + Math.cos(an) * r, hy + Math.sin(an) * r * .5, (34 + K.hash(i * 3) * 20) * (1 - hit * .7), 1 - hit, i);
      }
    }
  }

  // ---------------------------------------------------------------- nine-tails lash
  function tailsOverlay(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, a = fx.angle, L = lift();
    const lash = K.ease.outBack(c01(age / .4)), fade = 1 - K.ease.smooth((age - .45) / .55);
    if (fade <= 0) return;
    const bx = fx.x - Math.cos(a) * 10, by = fx.y - L * .7 - Math.sin(a) * 6;
    ctx.save(); ctx.lineCap = 'round';
    // nine tapered chakra tails whip out from behind Naruto and fan across the front
    const layers = [[1, 'rgba(140,12,16,', .85, 'source-over'], [.68, 'rgba(250,90,32,', .9, 'source-over'], [.28, 'rgba(255,214,130,', .8, 'lighter']];
    for (const [wk, col, al, op] of layers) {
      ctx.globalCompositeOperation = op;
      ctx.fillStyle = col + al * fade + ')';
      for (let i = 0; i < 9; i++) {
        const k = (i - 4) / 4, an = a + k * 1.25 * lash, len = R * (.75 + (1 - Math.abs(k)) * .3) * Math.min(1, lash * 1.15);
        const wave = Math.sin(time * 14 + i * 1.3) * 22;
        const tx = fx.x + Math.cos(an) * len, ty = fx.y - L * .4 + Math.sin(an) * len * .6;
        const cx = bx + Math.cos(an - k * .7) * len * .5 - Math.sin(an) * wave, cy = by + Math.sin(an - k * .7) * len * .5 * .6 + Math.cos(an) * wave * .6 - 34;
        tailShape(ctx, bx, by, cx, cy, tx, ty, 17 * wk, 3.5 * wk);
        ctx.fill();
      }
    }
    // the crescent the sweep cuts through the air, and flames along it
    const cr = R * (.85 + age * .15);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(150,20,16,${.55 * fade})`; ctx.lineWidth = 10 * fade + 2;
    ctx.save(); ctx.translate(fx.x, fx.y - L * .3); ctx.scale(1, .6);
    ctx.beginPath(); ctx.arc(0, 0, cr, a - 1.3 * lash, a + 1.3 * lash); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,200,110,${.9 * fade})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, cr, a - 1.3 * lash, a + 1.3 * lash); ctx.stroke();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    const seed = (fx.x * .017 + fx.y * .011) % 29;
    for (let i = 0; i < 9; i++) {
      const an = a + (i / 8 - .5) * 2.4 * lash, r = cr * (.9 + K.hash(i + seed) * .15);
      flame(ctx, K, fx.x + Math.cos(an) * r, fx.y - L * .3 + Math.sin(an) * r * .6 + 10, 30 * fade + 6, .9 * fade, i);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Kurama's chakra arm
  const ARM_HIT = .35;
  function armGround(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, seed = (fx.x * .011 + fx.y * .023) % 37;
    if (age < ARM_HIT) {
      // the shadow of the hand growing as it falls
      const k = age / ARM_HIT;
      ctx.fillStyle = `rgba(40,10,10,${.15 + k * .3})`;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * (.3 + k * .4), R * (.15 + k * .2), 0, 0, TAU); ctx.fill();
      return;
    }
    const k = (age - ARM_HIT) / (1 - ARM_HIT), fade = 1 - K.ease.smooth((k - .4) / .6);
    // scorched print of the palm and cracks
    ctx.fillStyle = `rgba(50,16,10,${.5 * fade})`;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * .62, R * .31, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(35,10,8,${.6 * fade})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + K.hash(i + seed) * .4, l = R * (.55 + K.hash(i * 3 + seed) * .45);
      ctx.moveTo(fx.x + Math.cos(an) * R * .3, fx.y + Math.sin(an) * R * .15);
      ctx.lineTo(fx.x + Math.cos(an + .1) * l * .75, fx.y + Math.sin(an + .1) * l * .37);
      ctx.lineTo(fx.x + Math.cos(an) * l, fx.y + Math.sin(an) * l * .5);
    }
    ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, R * .8, '255,90,30', .5 * fade, false, .5);
    ctx.restore();
  }

  function armOverlay(ctx, fx, time, K) {
    const age = 1 - c01(fx.life / fx.maxLife), R = fx.radius, seed = (fx.x * .011 + fx.y * .023) % 37;
    const x = fx.x, y = fx.y, s = R * .48;
    const fall = K.ease.in(c01(age / ARM_HIT)), press = age >= ARM_HIT ? c01((age - ARM_HIT) / .3) : 0;
    const handA = age < ARM_HIT ? Math.min(1, age / .08) : 1 - K.ease.smooth(press);
    // the arm reaching down from the sky and the claw coming down on the spot
    if (handA > 0) {
      const hy = y - 300 * (1 - fall) - s * .2, sq = age >= ARM_HIT ? 1 - press * .25 : 1;
      ctx.save(); ctx.globalAlpha = handA; ctx.lineJoin = 'round';
      // arm: a tapered band of chakra rising off the top of the view
      const ax = x + (fx.fromX - x) * .25, ay = hy - 520;
      ctx.beginPath();
      ctx.moveTo(x - s * .5, hy - s * .3); ctx.quadraticCurveTo(ax - s * .7, (hy + ay) / 2, ax - s * .9, ay);
      ctx.lineTo(ax + s * .9, ay); ctx.quadraticCurveTo(ax + s * .7, (hy + ay) / 2, x + s * .5, hy - s * .3);
      ctx.closePath();
      ctx.fillStyle = chakraFill(ctx, x, ay, x, hy, .85); ctx.fill();
      ctx.strokeStyle = 'rgba(80,10,10,.85)'; ctx.lineWidth = 3; ctx.stroke();
      // claw
      ctx.translate(x, hy); ctx.scale(1, sq);
      // outline stroked first and filled over, so only the silhouette's edge shows
      claws(ctx, s);
      handPath(ctx, s);
      ctx.strokeStyle = '#4a0808'; ctx.lineWidth = 7; ctx.stroke();
      ctx.fillStyle = chakraFill(ctx, 0, -s * .6, 0, s * 1.1, 1); ctx.fill();
      // knuckle creases and a hot core in the palm
      ctx.strokeStyle = 'rgba(120,16,14,.7)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [k] of FINGERS) { ctx.moveTo(k * s * .3 - s * .08, s * .36); ctx.lineTo(k * s * .3 + s * .08, s * .36); }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, 0, -s * .05, s * .9, '255,150,60', .3);
      ctx.restore();
      // flames licking off the arm as it falls
      for (let i = 0; i < 7; i++) {
        const t = (time * 2 + K.hash(i + seed)) % 1;
        flame(ctx, K, x + (K.hash(i * 3 + seed) - .5) * s * 1.3, hy - s * .3 - t * 170, 40 * (1 - t) + 10, handA * (1 - t) * .85, i);
      }
    }
    // the slam: flash, shock rings rolling out, a wall of fire, then smoke
    if (age >= ARM_HIT) {
      const k = (age - ARM_HIT) / (1 - ARM_HIT), e = K.ease.out(c01(k * 1.4)), fade = 1 - K.ease.smooth((k - .3) / .7);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (k < .15) K.glow(ctx, x, y - 30, R * (1 + k * 4), '255,230,170', 1 - k / .15, true, .7);
      for (let r = 0; r < 3; r++) {
        const q = c01(e - r * .15);
        if (q <= 0) continue;
        ctx.strokeStyle = `rgba(255,${190 - r * 50},${110 - r * 40},${fade * (.9 - r * .25)})`; ctx.lineWidth = (7 - r * 2) * fade + 1;
        ctx.beginPath(); ctx.ellipse(x, y, R * (.25 + q * 1.05), R * (.25 + q * 1.05) * .5, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      const smoke = K.puff('smoke');
      for (let i = 0; i < 16; i++) {
        const an = i * TAU / 16 + K.hash(i * 1.7 + seed) * .3, d = R * (.3 + e * .75);
        const fx2 = x + Math.cos(an) * d, fy2 = y + Math.sin(an) * d * .5;
        if (k < .6) flame(ctx, K, fx2, fy2, R * (.32 - k * .3) * (.8 + K.hash(i * 5) * .5), fade, i);
        if (k > .3) K.stamp(ctx, smoke, fx2, fy2 - 20 - k * 50, R * (.09 + k * .08), fade * .55);
      }
      if (K.fx) K.fx.debris(ctx, x, y, R, k, seed, '#3a2018', 14);
    }
  }

  window.BaryonVFX = {
    drawGround(ctx, state, elapsed) {
      const K = window.VFXKit, list = state && state.effects;
      if (!ctx || !K || !list) return;
      for (const fx of list) {
        if (!fx || !(fx.life > 0) || !Number.isFinite(fx.x)) continue;
        if (fx.kind === 'fist') fistGround(ctx, fx, elapsed, K);
        else if (fx.kind === 'arm') armGround(ctx, fx, elapsed, K);
      }
    },
    drawOverlay(ctx, state, elapsed) {
      const K = window.VFXKit, list = state && state.effects;
      if (!ctx || !K || !list) return;
      for (const fx of list) {
        if (!fx || !(fx.life > 0) || !Number.isFinite(fx.x)) continue;
        if (fx.kind === 'fist') fistOverlay(ctx, fx, elapsed, K);
        else if (fx.kind === 'tails') tailsOverlay(ctx, fx, elapsed, K);
        else if (fx.kind === 'arm') armOverlay(ctx, fx, elapsed, K);
      }
    }
  };
})();
