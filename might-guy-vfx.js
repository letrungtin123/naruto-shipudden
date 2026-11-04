(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const c01 = n => clamp(n, 0, 1);
  const lift = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  // Guy himself, his Eight Gates steam and his afterimages are AnimeSprites drawn by the game.
  // This module paints his taijutsu: every punch, Asa Kujaku (peacock), Sekizō (elephant),
  // Hirudora (tiger) and Night Guy's dragon kick, plus the player's own gate techniques:
  // Konoha Daisenpū (whirlwind), Dynamic Entry (landing) and Ura Renge (lotus).
  // Uses window.VFXKit (skill-vfx.js).

  // ---------------------------------------------------------------- plain punch
  // A fist so fast the air bursts: pressure crescents, a white impact star and speed streaks.
  function drawPunch(ctx, fx, time, K) {
    const life = c01(fx.life / (fx.maxLife || .32)), age = 1 - life, e = K.ease.out(age * 1.6);
    const L = lift(), a = fx.angle || 0, seed = (fx.x * .07 + fx.y * .13) % 31, S = fx.scale || 1;
    if (fx.reach) groundPressure(ctx, fx, age, a, seed, K);
    ctx.save(); ctx.translate(fx.x, fx.y - L * .8); ctx.rotate(a); ctx.scale(S, S);
    ctx.globalCompositeOperation = 'lighter';
    if (age < .3) K.glow(ctx, 6, 0, 34 * (1 - age), '255,220,170', (1 - age / .3), true);
    K.glow(ctx, 14, 0, 40 + e * 26, '255,120,60', .45 * life);
    // pressure crescents rippling forward
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = c01(e * 1.2 - i * .18);
      if (k <= 0) continue;
      ctx.strokeStyle = `rgba(255,${240 - i * 30},${220 - i * 50},${life * (.9 - i * .22)})`;
      ctx.lineWidth = (5 - i * 1.3) * life + 1;
      ctx.beginPath(); ctx.ellipse(8 + k * 46, 0, 8 + k * 10, 14 + k * 34, 0, -1.25, 1.25); ctx.stroke();
    }
    // impact star
    if (age < .45) {
      const s = (1 - age / .45) * (fx.combo === 0 ? 30 : 22);
      ctx.fillStyle = `rgba(255,250,230,${1 - age / .45})`;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? s * .32 : s * (.8 + K.hash(i + seed) * .5), an = i * TAU / 16;
        if (i) ctx.lineTo(18 + Math.cos(an) * r, Math.sin(an) * r); else ctx.moveTo(18 + r, 0);
      }
      ctx.closePath(); ctx.fill();
    }
    // speed streaks along the punch
    ctx.strokeStyle = `rgba(255,214,170,${.7 * life})`; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const off = (K.hash(i * 3.1 + seed) - .5) * 34, x0 = -30 + e * 30 + K.hash(i + seed) * 12;
      ctx.moveTo(x0, off); ctx.lineTo(x0 + 34 + e * 40, off * 1.2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // The wind of a gate punch: crescents of compressed air sweep along the ground out to the
  // punch's reach, flattening dust in a fan and leaving a pale shock line where they stop.
  function groundPressure(ctx, fx, age, a, seed, K) {
    const reach = fx.reach, run = K.ease.out(c01(age / .55)), fade = 1 - K.ease.smooth((age - .35) / .65);
    if (fade <= 0) return;
    const spread = .95 + (fx.combo === 0 ? .2 : 0);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5); ctx.rotate(a);
    // a soft dark wedge: the dust pressed flat under the blast
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, reach);
    g.addColorStop(0, `rgba(70,40,25,${.22 * fade})`); g.addColorStop(1, 'rgba(70,40,25,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, reach * (.35 + run * .65), -spread, spread); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = c01(run * 1.15 - i * .12);
      if (k <= 0) continue;
      const r = 16 + k * reach * (1 - i * .16), w = spread * (1 - i * .12);
      ctx.strokeStyle = `rgba(255,${235 - i * 40},${200 - i * 60},${fade * (.85 - i * .25)})`;
      ctx.lineWidth = (9 - i * 2.5) * fade + 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r, -w, w); ctx.stroke();
    }
    // wind streaks fanning out with the crescent
    ctx.strokeStyle = `rgba(255,225,190,${.6 * fade})`; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const an = (K.hash(i * 2.9 + seed) - .5) * spread * 2, r1 = reach * (.15 + run * .6) * (.7 + K.hash(i) * .3);
      ctx.moveTo(Math.cos(an) * r1, Math.sin(an) * r1);
      ctx.lineTo(Math.cos(an) * (r1 + reach * .22), Math.sin(an) * (r1 + reach * .22));
    }
    ctx.stroke();
    ctx.restore();
    // dust thrown up along the leading edge
    const dust = K.puff('dust');
    for (let i = 0; i < 6; i++) {
      const an = a + (i / 5 - .5) * spread * 1.6, d = 20 + run * reach * .95;
      K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - age * 16, 12 + age * 22, fade * .4);
    }
  }

  // ---------------------------------------------------------------- Asa Kujaku
  // Behind Guy a fan of flame opens like a peacock's tail; ahead, a storm of burning fists.
  function drawPeacock(ctx, fx, time, K) {
    const life = c01(fx.life / (fx.maxLife || 1)), age = 1 - life;
    const L = lift(), a = fx.angle || 0, R = fx.radius || 300, seed = (fx.x * .011 + fx.y * .017) % 40;
    const ca = Math.cos(a), sa = Math.sin(a), FB = 114 / 128, S = fx.scale || 1;
    // scorched fan on the ground where the burning fists land
    if (S > 1) {
      const burn = c01(age / .3) * (1 - K.ease.smooth((age - .55) / .45));
      if (burn > 0) {
        // soft scorch marks with a smouldering glow where each wave of fists lands
        const smoke = K.puff('smoke');
        for (let i = 0; i < 9; i++) {
          const an = a + (K.hash(i * 3.7 + seed) - .5) * 1.3, d = R * (.35 + K.hash(i * 5.3 + seed) * .6);
          const gx = fx.x + Math.cos(an) * d, gy = fx.y + Math.sin(an) * d * .5, r = R * (.09 + K.hash(i * 1.3) * .05);
          K.stamp(ctx, smoke, gx, gy, r, .3 * burn);
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, gx, gy, r * 1.4, '255,110,30', .45 * burn, false, .5);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    ctx.save(); ctx.translate(fx.x, fx.y - L);

    // the peacock tail: tongues of flame fanned out behind Guy, each tipped with a golden eye
    const open = K.ease.outBack(age / .2), fold = 1 - K.ease.smooth((age - .5) / .42);
    if (open > 0 && fold > 0) {
      const back = a + Math.PI;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, Math.cos(back) * 50 * S, Math.sin(back) * 30 * S - 24, 130 * open * S, '255,100,30', .6 * fold);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha *= fold;
      for (let row = 0; row < 2; row++) {
        const n = row ? 9 : 13, spread = (row ? 2.2 : 3.0) * Math.min(1, open);
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1) - .5, an = back + t * spread;
          const len = (row ? 70 : 118) * S * open * (1 - Math.abs(t) * .35) * (1 + Math.sin(time * 15 + i * 2.1 + row) * .08);
          ctx.save();
          ctx.translate(Math.cos(an) * 8, Math.sin(an) * 5 - 12);
          ctx.scale(1, .72); ctx.rotate(an + Math.PI / 2);
          ctx.drawImage(K.flame(i + row * 3), -len * .22, -len * FB, len * .44, len);
          ctx.restore();
          if (!row) {
            const ex = Math.cos(an) * len * .82, ey = Math.sin(an) * len * .82 * .72 - 12;
            ctx.globalCompositeOperation = 'lighter';
            K.glow(ctx, ex, ey, 11 * S, '255,225,110', .95, true);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(40,120,160,.85)';
            ctx.beginPath(); ctx.ellipse(ex, ey, 2.6, 2, an, 0, TAU); ctx.fill();
          }
        }
      }
      ctx.globalAlpha /= fold;
    }

    // the barrage: burning fists streaking out in a cone like comets
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, ca * R * .45, sa * R * .28, R * .6, '255,110,30', .4 * life, false, .65);
    ctx.lineCap = 'round';
    const N = Math.round(22 * S), W = Math.sqrt(S);
    for (let i = 0; i < N; i++) {
      const spread = (K.hash(i * 1.7 + seed) - .5) * (1.25 + (S - 1) * .5), delay = K.hash(i * 4.3 + seed) * .42;
      const t = c01((age - .05 - delay) / .3);
      if (t <= 0 || t >= 1) continue;
      const an = a + spread, d1 = 30 + K.ease.out(t) * R * (.75 + K.hash(i) * .25), d0 = Math.max(20, d1 - 120 * S);
      const x0 = Math.cos(an) * d0, y0 = Math.sin(an) * d0 * .62, x1 = Math.cos(an) * d1, y1 = Math.sin(an) * d1 * .62;
      const f = 1 - t * t;
      ctx.strokeStyle = `rgba(230,60,20,${.5 * f})`; ctx.lineWidth = 15 * W;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,170,60,${.7 * f})`; ctx.lineWidth = 7 * W;
      ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,250,225,${f})`; ctx.lineWidth = 2.5 * W;
      ctx.beginPath(); ctx.moveTo(x0 * .25 + x1 * .75, y0 * .25 + y1 * .75); ctx.lineTo(x1, y1); ctx.stroke();
      K.glow(ctx, x1, y1, 26 * W, '255,170,70', f, true);
    }
    // fists landing: flashes of fire along the far edge of the cone
    const land = c01((age - .22) / .6);
    if (land > 0 && land < 1) {
      const M = Math.round(9 * S);
      for (let i = 0; i < M; i++) {
        const an = a + (i / (M - 1) - .5) * (1.15 + (S - 1) * .5), d = R * (.55 + K.hash(i * 9 + seed) * .4);
        const k = c01(land * 1.6 - K.hash(i * 2.2 + seed) * .5);
        if (k <= 0 || k >= 1) continue;
        K.glow(ctx, Math.cos(an) * d, Math.sin(an) * d * .62, (30 + k * 34) * W, '255,120,40', (1 - k) * .9, true);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // burning embers drifting off the cone
    const fire = K.puff('fire');
    for (let i = 0, n = Math.round(8 * S); i < n; i++) {
      const k = c01((age - .3 - K.hash(i * 3 + seed) * .2) / .6);
      if (k <= 0 || k >= 1) continue;
      const an = a + (K.hash(i * 5.1 + seed) - .5) * 1.1 * S, d = R * (.4 + K.hash(i * 7 + seed) * .5);
      K.stamp(ctx, fire, Math.cos(an) * d, Math.sin(an) * d * .62 - k * 40, (10 * (1 - k) + 3) * W, (1 - k) * .8);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Sekizō
  // Five pillars of compressed air slam down one after another, each blowing a crater open.
  function drawElephant(ctx, fx, time, K) {
    const life = c01(fx.life / (fx.maxLife || 1.05)), age = 1 - life;
    const L = lift(), cols = fx.cols || [], seed = (fx.x * .013 + fx.y * .019) % 40, S = fx.scale || 1;
    const dust = K.puff('dust');
    ctx.save(); ctx.translate(fx.x, fx.y);
    for (let i = 0; i * 2 < cols.length; i++) {
      const cx = cols[i * 2], cy = cols[i * 2 + 1];
      const t = c01((age - i * (fx.step || .085)) / .6);
      if (t <= 0 || t >= 1) continue;
      const dir = Math.atan2(cy, cx), dist = Math.hypot(cx, cy);
      // the air fist: a sonic-boom cone of vapour flying out of Guy's punch
      const fly = c01(t / .2);
      if (fly < 1) {
        const p = K.ease.in(fly) * .85 + fly * .15, px = cx * p, py = cy * p - L * (1 - fly * .7);
        const s = (22 + dist * .06) * Math.sqrt(S) * (fx.fist || 1);
        ctx.save(); ctx.translate(px, py); ctx.rotate(dir); ctx.scale(1, .75);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, 0, 0, s * 2, '210,235,255', .7);
        ctx.fillStyle = 'rgba(225,242,255,.35)';
        ctx.beginPath(); ctx.moveTo(s * .9, 0);
        ctx.quadraticCurveTo(s * .2, -s * 1.1, -s * 2.6, -s * 1.3);
        ctx.quadraticCurveTo(-s * 1.4, 0, -s * 2.6, s * 1.3);
        ctx.quadraticCurveTo(s * .2, s * 1.1, s * .9, 0); ctx.fill();
        ctx.lineCap = 'round';
        for (let r = 0; r < 3; r++) {
          ctx.strokeStyle = `rgba(255,255,255,${.95 - r * .28})`; ctx.lineWidth = 3.5 - r;
          ctx.beginPath(); ctx.ellipse(s * (.5 - r * .7), 0, s * (.45 + r * .25), s * (.9 + r * .35), 0, -1.35, 1.35); ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      // impact: a white flash, a crater punched into the ground and shock rings racing out
      const k = (t - .2) / .8, e = K.ease.out(k * 1.4), fade = 1 - K.ease.smooth((k - .25) / .75);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(58,40,26,${.5 * fade})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, (30 + e * 26) * S, (30 + e * 26) * .45 * S, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(40,28,18,${.6 * fade})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const an = j * TAU / 6 + K.hash(j + i + seed) * .8, r2 = (40 + e * 50) * S;
        ctx.moveTo(cx + Math.cos(an) * 26 * S, cy + Math.sin(an) * 12 * S);
        ctx.lineTo(cx + Math.cos(an + .12) * r2 * .7, cy + Math.sin(an + .12) * r2 * .32);
        ctx.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2 * .45);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      if (k < .2) K.glow(ctx, cx, cy - 18, 95 * S, '255,255,255', 1 - k / .2, true, .75);
      K.glow(ctx, cx, cy - 10, (70 + e * 40) * S, '200,230,255', .45 * fade, false, .6);
      // the pillar of air itself, standing for an instant over the crater
      if (S > 1 && k < .35) {
        const pa = 1 - k / .35, pw = 26 * S * (1 - k * 1.5);
        const pg = ctx.createLinearGradient(cx, cy - 170 * S, cx, cy);
        pg.addColorStop(0, 'rgba(200,235,255,0)'); pg.addColorStop(.6, `rgba(220,240,255,${.35 * pa})`); pg.addColorStop(1, `rgba(255,255,255,${.7 * pa})`);
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.moveTo(cx - pw * .5, cy - 170 * S); ctx.lineTo(cx + pw * .5, cy - 170 * S);
        ctx.lineTo(cx + pw, cy - 6); ctx.lineTo(cx - pw, cy - 6); ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .45);
      for (let r = 0; r < 3; r++) {
        const q = c01(e - r * .14);
        if (q <= 0) continue;
        ctx.strokeStyle = `rgba(${r ? '180,220,255' : '255,255,255'},${fade * (.95 - r * .28)})`;
        ctx.lineWidth = (7 - r * 2) * fade + 1;
        ctx.beginPath(); ctx.arc(0, 0, (18 + q * (115 - r * 22)) * S, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      // a burst of wind lines and a puff of air rising from the crater
      ctx.strokeStyle = `rgba(255,255,255,${.8 * fade})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const an = j * TAU / 10 + K.hash(j * 3 + i + seed) * .5, r1 = (30 + e * 60) * S, r2 = r1 + 26 * fade * S;
        ctx.moveTo(cx + Math.cos(an) * r1, cy - 14 + Math.sin(an) * r1 * .5);
        ctx.lineTo(cx + Math.cos(an) * r2, cy - 14 + Math.sin(an) * r2 * .5);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      for (let j = 0; j < 6; j++) {
        const an = j * TAU / 6 + K.hash(j + i * 3 + seed) * .6, d = (30 + e * (55 + K.hash(j * 5 + i) * 30)) * S;
        K.stamp(ctx, dust, cx + Math.cos(an) * d, cy + Math.sin(an) * d * .45 - k * 14, (18 + k * 22) * S, fade * .45);
      }
      if (K.fx) K.fx.debris(ctx, cx, cy, 95 * S, k, seed + i * 7, '#5a4632', 7);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Hirudora
  // A white tiger of compressed air with a cyan glare; on impact the air dome detonates.
  function tigerHead(ctx, s, open, time) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const jaw = open * .55;
    // ruff of wind-blown fur behind the head
    ctx.fillStyle = 'rgba(160,228,250,.85)';
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const an = Math.PI * .45 + i / 12 * Math.PI * 1.1, w = Math.sin(time * 16 + i * 1.7) * .06;
      const r = i % 2 ? .62 : 1.02 + w;
      const x = -.15 + Math.cos(an) * r * 1.05, y = Math.sin(an) * r * .95;
      if (i) ctx.lineTo(x * s, y * s); else ctx.moveTo(x * s, y * s);
    }
    ctx.closePath(); ctx.fill();
    const head = (fill, k) => {
      ctx.fillStyle = fill;
      // skull + upper jaw
      ctx.beginPath();
      ctx.moveTo(-.55 * s * k, .2 * s);
      ctx.quadraticCurveTo(-.6 * s * k, -.62 * s * k, .02 * s, -.64 * s * k);
      ctx.quadraticCurveTo(.5 * s, -.62 * s * k, .78 * s, -.32 * s);
      ctx.quadraticCurveTo(1.1 * s * k, -.26 * s, 1.14 * s * k, -.06 * s);
      ctx.lineTo(.55 * s, .02 * s);
      ctx.quadraticCurveTo(.2 * s, .1 * s, -.1 * s, .3 * s * k);
      ctx.closePath(); ctx.fill();
      // lower jaw swung open
      ctx.save(); ctx.translate(.18 * s, .14 * s); ctx.rotate(jaw);
      ctx.beginPath();
      ctx.moveTo(-.25 * s, -.02 * s); ctx.lineTo(.82 * s * k, -.04 * s);
      ctx.quadraticCurveTo(.78 * s * k, .2 * s * k, .3 * s, .3 * s * k);
      ctx.quadraticCurveTo(-.1 * s, .32 * s * k, -.3 * s, .18 * s);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    // dark mouth behind the jaws
    ctx.fillStyle = '#123a52';
    ctx.beginPath(); ctx.moveTo(.2 * s, .06 * s); ctx.lineTo(1.0 * s, -.02 * s);
    ctx.lineTo(.18 * s + Math.cos(jaw) * .8 * s, .14 * s + Math.sin(jaw) * .8 * s); ctx.closePath(); ctx.fill();
    head('#8fdcf5', 1.06);
    head('#f6fdff', 1);
    // ear
    ctx.fillStyle = '#f6fdff';
    ctx.beginPath(); ctx.moveTo(-.32 * s, -.5 * s); ctx.lineTo(-.48 * s, -.95 * s); ctx.lineTo(-.02 * s, -.62 * s); ctx.fill();
    ctx.fillStyle = '#7cc9e6';
    ctx.beginPath(); ctx.moveTo(-.3 * s, -.56 * s); ctx.lineTo(-.4 * s, -.82 * s); ctx.lineTo(-.12 * s, -.62 * s); ctx.fill();
    // stripes
    ctx.strokeStyle = '#3b7c98'; ctx.lineWidth = Math.max(1.5, s * .055);
    ctx.beginPath();
    for (const [x0, y0, x1, y1, x2, y2] of [[-.45, -.3, -.28, -.12, -.4, .08], [-.18, -.58, -.05, -.36, -.14, -.16],
      [.12, -.6, .2, -.44, .12, -.3], [.38, -.5, .42, -.38, .34, -.3], [-.4, .2, -.2, .1, -.08, .22]]) {
      ctx.moveTo(x0 * s, y0 * s); ctx.lineTo(x1 * s, y1 * s); ctx.lineTo(x2 * s, y2 * s);
    }
    ctx.stroke();
    // nose and brow
    ctx.fillStyle = '#2a5d78';
    ctx.beginPath(); ctx.ellipse(1.08 * s, -.13 * s, .07 * s, .05 * s, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * .05);
    ctx.beginPath(); ctx.moveTo(.18 * s, -.42 * s); ctx.quadraticCurveTo(.4 * s, -.5 * s, .58 * s, -.36 * s); ctx.stroke();
    // fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(.86 * s, -.04 * s); ctx.lineTo(.9 * s, .16 * s); ctx.lineTo(.96 * s, -.05 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(.55 * s, .0); ctx.lineTo(.58 * s, .14 * s); ctx.lineTo(.63 * s, .0); ctx.fill();
    const lx = .18 * s + Math.cos(jaw) * .72 * s, ly = .14 * s + Math.sin(jaw) * .72 * s;
    ctx.beginPath(); ctx.moveTo(lx - .04 * s, ly); ctx.lineTo(lx + Math.sin(jaw) * .16 * s, ly - Math.cos(jaw) * .16 * s); ctx.lineTo(lx + .04 * s, ly - .02 * s); ctx.fill();
    // glaring eye
    ctx.fillStyle = '#16c8ff';
    ctx.beginPath(); ctx.ellipse(.38 * s, -.3 * s, .13 * s, .055 * s, -.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(.4 * s, -.31 * s, .045 * s, .022 * s, -.3, 0, TAU); ctx.fill();
  }

  function drawTiger(ctx, fx, time, K) {
    if (!fx || fx.life <= 0 || !Number.isFinite(fx.x) || !Number.isFinite(fx.y)) return;
    const life = c01(fx.life / (fx.maxLife || 1.15)), age = 1 - life;
    const L = lift(), seed = (fx.x * .011 + fx.y * .023) % 40;
    const sx = Number.isFinite(fx.fromX) ? fx.fromX : fx.x, sy = Number.isFinite(fx.fromY) ? fx.fromY : fx.y;
    const angle = Number.isFinite(fx.angle) ? fx.angle : Math.atan2(fx.y - sy, fx.x - sx);
    const radius = Math.max(80, fx.radius || 235);
    const travel = K.ease.inOut(age / .4);
    const px = sx + (fx.x - sx) * travel, py = sy + (fx.y - sy) * travel - L;
    const swirl = K.swirl('hirudora', ['rgba(255,255,255,.95)', 'rgba(140,225,255,.85)', 'rgba(200,245,255,.7)'], 7, 1.2, .12);
    ctx.save();
    // ---- the tiger rushing forward
    if (age < .5) {
      const show = 1 - K.ease.smooth((age - .38) / .12), s = radius * .34 * (.7 + travel * .45);
      ctx.globalCompositeOperation = 'lighter';
      // compressed air stream behind it
      ctx.lineCap = 'round';
      for (const [w, c] of [[s * 1.3, '120,200,255,.18'], [s * .7, '200,240,255,.4'], [s * .25, '255,255,255,.8']]) {
        ctx.strokeStyle = `rgba(${c})`; ctx.lineWidth = w * show;
        ctx.beginPath(); ctx.moveTo(sx + (px - sx) * .15, sy - L + (py + L - sy) * .15); ctx.lineTo(px, py); ctx.stroke();
      }
      K.glow(ctx, px, py, s * 2.6, '170,230,255', .7 * show);
      K.spin(ctx, swirl, px - Math.cos(angle) * s * .4, py, s * 1.5, -time * 14, .7 * show, .8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha *= show;
      ctx.translate(px, py); ctx.rotate(angle);
      if (Math.cos(angle) < 0) ctx.scale(1, -1);
      tigerHead(ctx, s, .45 + .2 * Math.sin(time * 18), time);
      ctx.restore();
      // speed lines streaming past
      ctx.globalCompositeOperation = 'lighter';
      const nx = -Math.sin(angle), ny = Math.cos(angle);
      ctx.strokeStyle = `rgba(220,245,255,${.6 * show})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const off = (K.hash(i * 2.3 + seed) - .5) * s * 4, back = s * (1.5 + K.hash(i) * 3);
        ctx.moveTo(px + nx * off - Math.cos(angle) * back, py + ny * off * .6 - Math.sin(angle) * back);
        ctx.lineTo(px + nx * off - Math.cos(angle) * (back + s * 2.5), py + ny * off * .6 - Math.sin(angle) * (back + s * 2.5));
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---- detonation: a white dome of air that blows everything flat
    const boom = c01((age - .36) / .64);
    if (boom > 0) {
      const e = K.ease.out(boom * 1.3), x = fx.x, y = fx.y, a = 1 - K.ease.smooth((boom - .35) / .65);
      const dr = radius * (.25 + e * .85), cy = y - dr * .25;
      ctx.globalCompositeOperation = 'lighter';
      if (boom < .14) K.glow(ctx, x, cy, radius * (.8 + boom * 4), '235,250,255', 1 - boom / .14, true);
      K.glow(ctx, x, cy, dr * 1.25, '140,215,255', .55 * a, false, .8);
      K.glow(ctx, x, cy, dr * .7, '255,255,255', .5 * a, false, .8);
      K.spin(ctx, swirl, x, cy, dr * .95, time * 6, .55 * a, .8);
      ctx.strokeStyle = `rgba(230,250,255,${a})`; ctx.lineWidth = 6 * a + 1;
      ctx.beginPath(); ctx.ellipse(x, cy, dr, dr * .8, 0, 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .45);
      ctx.strokeStyle = `rgba(160,220,255,${a * .9})`; ctx.lineWidth = 4 * a + 1;
      ctx.beginPath(); ctx.arc(0, 0, radius * (.3 + e * 1.05), 0, TAU); ctx.stroke();
      ctx.restore();
      // radial blast lines
      ctx.strokeStyle = `rgba(255,255,255,${a * .8})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const an = i * TAU / 18 + K.hash(i + seed) * .3, r1 = dr * (1 + K.hash(i * 3) * .1), r2 = r1 + radius * (.2 + K.hash(i * 7 + seed) * .35);
        ctx.moveTo(x + Math.cos(an) * r1, cy + Math.sin(an) * r1 * .8); ctx.lineTo(x + Math.cos(an) * r2, cy + Math.sin(an) * r2 * .8);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      const dust = K.puff('dust');
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + K.hash(i * 1.9 + seed) * .4, d = radius * (.35 + e * .8);
        K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .45 - 8, radius * (.09 + e * .09), (1 - boom) * .42);
      }
      if (K.fx) K.fx.debris(ctx, x, y, radius, boom, seed, '#4e3a2a', 12);
    }
    ctx.restore();
  }

  // A crimson steam dragon head, facing +x in local space.
  function dragonHead(ctx, s, open, time) {
    ctx.lineJoin = 'round';
    const jaw = open * s * .5;
    // dark rim
    ctx.fillStyle = '#5c0508';
    ctx.beginPath();
    ctx.moveTo(-s * .7, -s * .6); ctx.quadraticCurveTo(s * .1, -s * .85, s * 1.25, -s * .28);
    ctx.lineTo(s * .55, -s * .02); ctx.lineTo(s * 1.15, s * .14 + jaw);
    ctx.quadraticCurveTo(s * .2, s * .6 + jaw * .4, -s * .7, s * .5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d61c1c';
    ctx.beginPath();
    ctx.moveTo(-s * .6, -s * .5); ctx.quadraticCurveTo(s * .1, -s * .73, s * 1.12, -s * .27);
    ctx.lineTo(s * .5, -s * .03); ctx.lineTo(s * 1.03, s * .12 + jaw * .9);
    ctx.quadraticCurveTo(s * .2, s * .5 + jaw * .35, -s * .6, s * .4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6a4a';
    ctx.beginPath(); ctx.moveTo(-s * .4, -s * .45); ctx.quadraticCurveTo(s * .3, -s * .62, s * 1, -s * .27);
    ctx.quadraticCurveTo(s * .3, -s * .38, -s * .4, -s * .28); ctx.closePath(); ctx.fill();
    // flowing horns and whiskers of steam
    ctx.strokeStyle = '#ff8a5a'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, s * .12);
    const w = Math.sin(time * 9) * s * .08;
    ctx.beginPath(); ctx.moveTo(-s * .2, -s * .55); ctx.quadraticCurveTo(-s * .8, -s * 1.05 + w, -s * 1.5, -s * .9 + w); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * .5); ctx.quadraticCurveTo(-s * .5, -s * 1.2 - w, -s * 1.1, -s * 1.25 - w); ctx.stroke();
    ctx.lineWidth = Math.max(1, s * .05);
    ctx.beginPath(); ctx.moveTo(s * .9, -s * .1); ctx.quadraticCurveTo(s * 1.3, s * .3 + w, s * .9, s * .75 + w); ctx.stroke();
    // white-hot eye and fangs
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath(); ctx.ellipse(s * .32, -s * .33, s * .16, s * .07, -.25, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * .72, -s * .14); ctx.lineTo(s * .78, s * .06); ctx.lineTo(s * .85, -s * .16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * .82, s * .1 + jaw * .9); ctx.lineTo(s * .86, -s * .04 + jaw * .9); ctx.lineTo(s * .93, s * .1 + jaw * .9); ctx.fill();
  }

  // Night Guy (Sekizō → Yagai): Guy blazes forward wrapped in blood-red steam that takes the shape
  // of a dragon, then the kick bends space at the impact point.
  function drawFinisher(ctx, fx, time, K) {
    if (!fx || fx.life <= 0 || !Number.isFinite(fx.x) || !Number.isFinite(fx.y)) return;
    const life = clamp(fx.life / (fx.maxLife || .8), 0, 1);
    const age = 1 - life;
    const radius = Math.max(40, fx.radius || 210);
    const ang = fx.angle || 0, ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    const L = lift();
    const seed = (fx.x * .011 + fx.y * .017) % 40;
    const steam = K.puff('steam'), smoke = K.puff('smoke');
    const x = fx.x, y = fx.y;
    ctx.save();

    // ---- the dragon of red steam (first ~60%)
    const surge = K.ease.out(age / .22);
    const dragonA = 1 - K.ease.smooth((age - .3) / .35);
    if (dragonA > 0) {
      const len = radius * 1.9, w = radius * .14;
      const headT = surge;                 // head runs from the tail end up to the impact point
      const N = 22;
      // body: puffs from tail (k=0) to head (k=N), sinuous
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k <= N; k += 2) {
        const t = k / N, along = -len + len * headT * (.25 + .75 * t) + radius * .12 * t;
        const wave = Math.sin(t * 7 - time * 9 + seed) * w * 1.3 * (1 - t * .5);
        const bx = x + ca * along + nx * wave, by = y - L + sa * along + ny * wave * .6;
        K.glow(ctx, bx, by, w * (1.5 + t * 1.8), '255,40,30', .45 * dragonA);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let k = 0; k <= N; k++) {
        const t = k / N, along = -len + len * headT * (.25 + .75 * t) + radius * .12 * t;
        const wave = Math.sin(t * 7 - time * 9 + seed) * w * 1.3 * (1 - t * .5);
        const bx = x + ca * along + nx * wave, by = y - L + sa * along + ny * wave * .6;
        const sz = w * (.75 + t * 1.35) * (1 + Math.sin(time * 13 + k) * .08);
        K.stamp(ctx, steam, bx, by, sz, dragonA * (.55 + t * .45));
        // steam peeling off the body
        const ph = (time * 2.2 + K.hash(k + seed)) % 1;
        K.stamp(ctx, steam, bx - ca * ph * w * 3 + nx * (K.hash(k * 3) - .5) * w * 2, by - ph * w * 2.2, sz * (.6 - ph * .3), dragonA * (1 - ph) * .6);
      }
      // head at the leading end
      const tH = 1, alongH = -len + len * headT + radius * .12;
      const waveH = Math.sin(7 - time * 9 + seed) * w * .65;
      const hx = x + ca * alongH + nx * waveH, hy = y - L + sa * alongH + ny * waveH * .6;
      ctx.save(); ctx.globalAlpha *= dragonA;
      ctx.translate(hx, hy); ctx.rotate(ang);
      if (ca < 0) ctx.scale(1, -1);
      dragonHead(ctx, w * 2.6 * (.7 + .3 * surge), .4 + .4 * Math.sin(time * 10), time);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx, hy, w * 5, '255,70,40', .5 * dragonA * tH);
      // speed lines streaming past the dragon
      ctx.strokeStyle = `rgba(255,190,150,${.55 * dragonA})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const off = (K.hash(i * 2.7 + seed) - .5) * w * 7, ph = (time * 3 + K.hash(i)) % 1;
        const a0 = -len * (.2 + ph * .8), a1 = a0 + len * .35;
        ctx.moveTo(x + ca * a0 + nx * off, y - L + sa * a0 + ny * off * .6);
        ctx.lineTo(x + ca * a1 + nx * off, y - L + sa * a1 + ny * off * .6);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---- the impact: space warps outward in rings
    const imp = c01((age - .14) / .86);
    if (imp > 0) {
      const e = K.ease.out(imp * 1.3);
      ctx.globalCompositeOperation = 'lighter';
      if (imp < .18) K.glow(ctx, x, y - L, radius * (.4 + imp * 3), '255,200,170', 1 - imp / .18, true);
      K.glow(ctx, x, y, radius * (.6 + e * .5), '255,50,30', .45 * life, false, .5);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
      for (let i = 0; i < 3; i++) {
        const k = c01(e - i * .12);
        if (k <= 0) continue;
        const r = 24 + k * radius * (1 - i * .18);
        ctx.strokeStyle = `rgba(255,${80 + i * 50},${40 + i * 30},${life * (.85 - i * .2)})`; ctx.lineWidth = (8 - i * 2) * life + 1;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(255,240,220,${life * .7})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 12 + e * radius * .8, 0, TAU); ctx.stroke();
      ctx.restore();
      // radial streaks thrown outward along the kick direction (forward-biased)
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = ang + (K.hash(i + seed) - .5) * (i % 3 ? 2.2 : 6.2);
        const r1 = 20 + e * radius * (.5 + K.hash(i * 3) * .2), r2 = r1 + radius * (.25 + K.hash(i * 5) * .3) * life;
        ctx.moveTo(x + Math.cos(a) * r1, y - L * .5 + Math.sin(a) * r1 * .6);
        ctx.lineTo(x + Math.cos(a) * r2, y - L * .5 + Math.sin(a) * r2 * .6);
      }
      ctx.strokeStyle = `rgba(255,170,110,${life * .8})`; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // red steam bursting and dissipating, then dark smoke
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12 + K.hash(i + seed) * .4, d = radius * (.1 + e * (.45 + K.hash(i * 7 + seed) * .3));
        const sx = x + Math.cos(a) * d + ca * e * radius * .15, sy = y + Math.sin(a) * d * .5 - imp * radius * .2 - L * .5;
        K.stamp(ctx, imp > .45 ? smoke : steam, sx, sy, radius * (.1 + e * .12), (1 - imp) * .75);
      }
      if (K.fx) K.fx.debris(ctx, x, y, radius * .8, imp, seed, '#3a2420', 10);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Konoha Daisenpū
  // One leaf, drawn once per colour: a pointed oval with a darker midrib.
  function leafSprite(K, v) {
    return K.sprite('mg-leaf' + v, 24, 12, g => {
      g.fillStyle = ['#7fc95a', '#a8d86b', '#5fae46'][v];
      g.beginPath(); g.moveTo(1, 6); g.quadraticCurveTo(12, -2, 23, 6); g.quadraticCurveTo(12, 14, 1, 6); g.fill();
      g.strokeStyle = 'rgba(40,80,30,.7)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(3, 6); g.lineTo(21, 6); g.stroke();
    });
  }

  // A spinning kick whips up a whirlwind: wind bands spiral round, a column of air twists upward
  // and a storm of leaves orbits out to the edge, then everything bursts outward.
  function drawSenpu(ctx, fx, time, K) {
    const life = c01(fx.life / (fx.maxLife || 1.25)), age = 1 - life;
    const R = fx.radius || 520, x = fx.x, y = fx.y, seed = (x * .013 + y * .017) % 40;
    const grow = K.ease.out(age / .35), fade = 1 - K.ease.smooth((age - .62) / .38);
    const blow = c01((age - .55) / .45), out = K.ease.out(blow);
    const spin = time * 11 + age * 8;
    // dust swept flat on the ground
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
    const g = ctx.createRadialGradient(0, 0, R * .1, 0, 0, R * (grow * .9 + out * .25));
    g.addColorStop(0, `rgba(80,60,35,${.05 * fade})`); g.addColorStop(.7, `rgba(90,70,40,${.22 * fade})`); g.addColorStop(1, 'rgba(90,70,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * (grow * .9 + out * .25), 0, TAU); ctx.fill();
    // wind bands spiralling inward
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const r = R * (.25 + i * .14) * (grow + out * .3), a0 = -spin * (1.4 - i * .12) + i * 1.1;
      ctx.strokeStyle = `rgba(${i % 2 ? '210,245,200' : '255,255,240'},${(.75 - i * .08) * fade})`;
      ctx.lineWidth = (7 - i * .7) * fade + 1;
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + 1.6 + (i % 3) * .5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * .96, a0 + Math.PI, a0 + Math.PI + 1.2); ctx.stroke();
    }
    // the outward burst at the end: a shock ring racing to the rim
    if (blow > 0) {
      const a = 1 - blow;
      ctx.strokeStyle = `rgba(235,255,225,${a})`; ctx.lineWidth = 10 * a + 1;
      ctx.beginPath(); ctx.arc(0, 0, R * (.4 + out * .75), 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(150,220,120,${a * .7})`; ctx.lineWidth = 4 * a + 1;
      ctx.beginPath(); ctx.arc(0, 0, R * (.3 + out * .6), 0, TAU); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, R * .8 * grow, '170,240,150', .22 * fade, false, .5);
    // the twisting column of air over Naruto
    const H = R * .55 * grow;
    for (let i = 0; i < 9; i++) {
      const t = i / 8, cy = y - t * H, rr = (40 + t * R * .32) * (1 + Math.sin(time * 9 + i) * .05);
      const a0 = spin * 1.6 + i * .9;
      ctx.strokeStyle = `rgba(235,255,230,${(.55 - t * .3) * fade})`; ctx.lineWidth = 3 + (1 - t) * 3;
      ctx.beginPath(); ctx.ellipse(x, cy, rr, rr * .3, 0, a0, a0 + 2.4); ctx.stroke();
      ctx.strokeStyle = `rgba(150,225,130,${(.4 - t * .2) * fade})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, cy, rr * .8, rr * .24, 0, a0 + Math.PI, a0 + Math.PI + 1.8); ctx.stroke();
    }
    // the spinning kick: a fiery crescent round Naruto for the first beat
    if (age < .35) {
      const k = 1 - age / .35;
      ctx.strokeStyle = `rgba(255,170,90,${k})`; ctx.lineWidth = 9 * k + 2;
      ctx.beginPath(); ctx.ellipse(x, y - 20, 80, 36, 0, -spin * 2, -spin * 2 + 4.2); ctx.stroke();
      K.glow(ctx, x, y - 20, 110, '255,150,70', .6 * k);
    }
    ctx.globalCompositeOperation = 'source-over';
    // leaves orbiting, flung out at the end
    for (let i = 0; i < 44; i++) {
      const h1 = K.hash(i * 2.3 + seed), h2 = K.hash(i * 5.9 + seed);
      const orbit = R * (.18 + h1 * .8) * (grow + out * .6), an = -spin * (1.6 - h1 * .9) + h2 * TAU;
      const lx = x + Math.cos(an) * orbit, ly = y + Math.sin(an) * orbit * .5 - (20 + h2 * H * .9) * (1 - h1 * .6);
      const s = 1 + h2 * .8, a = fade * (.6 + h1 * .4);
      if (a <= .02) continue;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(lx, ly); ctx.rotate(an * 2 + time * 7 + i);
      ctx.drawImage(leafSprite(K, i % 3), -12 * s, -6 * s, 24 * s, 12 * s);
      ctx.restore();
    }
    // dust thrown up at the rim
    const dust = K.puff('dust');
    for (let i = 0; i < 14; i++) {
      const an = i * TAU / 14 - spin * .5 + K.hash(i + seed), d = R * (.75 + out * .3) * grow;
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 14, 26 + out * 30, .35 * fade);
    }
  }

  // ---------------------------------------------------------------- Dynamic Entry
  // While Naruto is airborne a burning target mark tightens on the landing spot; the kick lands in
  // a white flash, a ring of fire bursts open and the ground splits into a crater.
  function drawEntry(ctx, fx, time, K) {
    const life = c01(fx.life / (fx.maxLife || 1.5)), age = 1 - life, land = fx.land || .3;
    const R = fx.radius || 420, x = fx.x, y = fx.y, seed = (x * .011 + y * .019) % 40;
    ctx.save();
    if (age < land) {
      const k = age / land;
      ctx.translate(x, y); ctx.scale(1, .5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,140,60,${.4 + k * .5})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, R * (1 - k * .75), 0, TAU); ctx.stroke();
      ctx.setLineDash([18, 14]); ctx.lineDashOffset = -time * 80;
      ctx.strokeStyle = `rgba(255,220,150,${.3 + k * .4})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R * (.6 - k * .45), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      K.glow(ctx, 0, 0, R * .4 * (1 - k * .5), '255,120,40', .25 + k * .35);
      ctx.restore();
      return;
    }
    const k = (age - land) / (1 - land), e = K.ease.out(k * 1.5), fade = 1 - K.ease.smooth((k - .3) / .7);
    // crater and fissures
    ctx.fillStyle = `rgba(50,32,20,${.55 * fade})`;
    ctx.beginPath(); ctx.ellipse(x, y, R * .3 * (.6 + e * .4), R * .14 * (.6 + e * .4), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(40,24,14,${.7 * fade})`; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + K.hash(i + seed) * .4, len = R * (.45 + K.hash(i * 3 + seed) * .5) * e;
      ctx.moveTo(x + Math.cos(an) * R * .25, y + Math.sin(an) * R * .11);
      ctx.lineTo(x + Math.cos(an + .1) * len * .6, y + Math.sin(an + .1) * len * .27);
      ctx.lineTo(x + Math.cos(an - .05) * len, y + Math.sin(an - .05) * len * .45);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    // molten glow in the cracks
    ctx.strokeStyle = `rgba(255,120,40,${.6 * fade})`; ctx.lineWidth = 1.5; ctx.stroke();
    if (k < .15) K.glow(ctx, x, y - 30, R * (.6 + k * 3), '255,240,210', 1 - k / .15, true);
    K.glow(ctx, x, y, R * (.5 + e * .6), '255,90,30', .4 * fade, false, .5);
    // shock rings
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
    for (let i = 0; i < 3; i++) {
      const q = c01(e - i * .12);
      if (q <= 0) continue;
      ctx.strokeStyle = `rgba(255,${230 - i * 50},${200 - i * 70},${fade * (.95 - i * .25)})`;
      ctx.lineWidth = (10 - i * 3) * fade + 1;
      ctx.beginPath(); ctx.arc(0, 0, 30 + q * R * (1 - i * .15), 0, TAU); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    // a ring of flame tongues bursting up round the rim
    const ring = R * (.3 + e * .6), FB = 114 / 128;
    for (let i = 0; i < 22; i++) {
      const an = i * TAU / 22 + K.hash(i * 1.7 + seed) * .2, h = (50 + K.hash(i * 4.1 + seed) * 70) * fade * (1 + Math.sin(time * 14 + i) * .1);
      if (h < 4) continue;
      const fxx = x + Math.cos(an) * ring, fyy = y + Math.sin(an) * ring * .5;
      ctx.drawImage(K.flame(i % 6), fxx - h * .22, fyy - h * FB, h * .44, h);
    }
    // dust and debris
    const dust = K.puff('dust');
    for (let i = 0; i < 16; i++) {
      const an = i * TAU / 16 + K.hash(i * 2.9 + seed) * .4, d = R * (.2 + e * .85);
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - k * 30, R * (.07 + e * .07), fade * .5);
    }
    if (K.fx) K.fx.debris(ctx, x, y, R * .8, k, seed, '#5a4632', 14);
    ctx.restore();
  }

  // ---------------------------------------------------------------- Ura Renge
  // A blood-red streak zigzags from foe to foe with a flash at every blow; at the last one a lotus
  // of crimson chakra unfolds on the ground and blasts outward, scattering petals.
  function petal(ctx, len, w, edge) {
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(w, -len * .12, w * .95, -len * .72, 0, -len);
    ctx.bezierCurveTo(-w * .95, -len * .72, -w, -len * .12, 0, 0); ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.stroke(); }
  }
  function drawLotus(ctx, fx, time, K) {
    const life = c01(fx.life / (fx.maxLife || 2)), age = 1 - life, bloomAt = fx.bloom || .3;
    const R = fx.radius || 480, x = fx.x, y = fx.y, L = lift(), pts = fx.pts || [], seed = (x * .013 + y * .023) % 40;
    const n = pts.length / 2 - 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the chain of dashes
    for (let i = 0; i < n; i++) {
      const at = bloomAt * i / Math.max(1, n), k = (age - at) / .5;
      if (k <= 0 || k >= 1) continue;
      const x0 = x + pts[i * 2], y0 = y + pts[i * 2 + 1] - L, x1 = x + pts[i * 2 + 2], y1 = y + pts[i * 2 + 3] - L;
      const draw = Math.min(1, k * 6), f = 1 - k;
      const ex = x0 + (x1 - x0) * draw, ey = y0 + (y1 - y0) * draw;
      for (const [w, c, al] of [[16, '200,20,40', .35], [8, '255,80,80', .7], [3, '255,235,225', 1]]) {
        ctx.strokeStyle = `rgba(${c},${al * f})`; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
      }
      if (draw >= 1) {
        const s = 34 * f + 8;
        K.glow(ctx, x1, y1, s * 2, '255,90,90', f, true);
        ctx.fillStyle = `rgba(255,245,235,${f})`;
        ctx.beginPath();
        for (let j = 0; j < 12; j++) {
          const r = j % 2 ? s * .3 : s * (.8 + K.hash(j + i + seed) * .4), an = j * TAU / 12 + i;
          if (j) ctx.lineTo(x1 + Math.cos(an) * r, y1 + Math.sin(an) * r); else ctx.moveTo(x1 + r * Math.cos(an), y1 + r * Math.sin(an));
        }
        ctx.closePath(); ctx.fill();
      }
    }
    // the lotus
    const b = (age - bloomAt) / (1 - bloomAt);
    if (b > 0) {
      const open = K.ease.outBack(b / .3), e = K.ease.out(b * 1.4), fade = 1 - K.ease.smooth((b - .45) / .55);
      if (b < .12) K.glow(ctx, x, y - 30, R * (.5 + b * 4), '255,220,230', 1 - b / .12, true);
      K.glow(ctx, x, y, R * (.5 + e * .55), '255,40,80', .45 * fade, false, .5);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
      // shock rings
      for (let i = 0; i < 3; i++) {
        const q = c01(e - i * .14);
        if (q <= 0) continue;
        ctx.strokeStyle = `rgba(255,${120 + i * 50},${150 + i * 30},${fade * (.9 - i * .25)})`; ctx.lineWidth = (9 - i * 2.5) * fade + 1;
        ctx.beginPath(); ctx.arc(0, 0, 30 + q * R * (1 - i * .14), 0, TAU); ctx.stroke();
      }
      // two layers of petals unfolding flat on the ground
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 3;
      for (const [layer, count, len, col, edge, rot] of [[0, 10, R * .62, '200,30,70', '120,10,40', 0], [1, 8, R * .44, '255,120,160', '200,40,90', .31], [2, 6, R * .26, '255,225,235', '255,130,170', .1]]) {
        const tilt = layer === 2 ? .7 : 1;
        for (let i = 0; i < count; i++) {
          const an = i * TAU / count + rot + b * .25 * (layer % 2 ? -1 : 1);
          ctx.save(); ctx.rotate(an); ctx.scale(1, tilt);
          const g = ctx.createLinearGradient(0, 0, 0, -len);
          g.addColorStop(0, `rgba(255,240,230,${.9 * fade})`); g.addColorStop(.45, `rgba(${col},${.9 * fade})`); g.addColorStop(1, `rgba(${col},${.75 * fade})`);
          ctx.fillStyle = g;
          petal(ctx, len * Math.min(1.1, open), len * .42, `rgba(${edge},${.8 * fade})`);
          ctx.restore();
        }
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y - 10, R * .25, '255,230,200', .8 * fade, true, .6);
      // a pillar of red chakra rising out of the heart of the flower
      if (b < .5) {
        const pa = 1 - b / .5, pw = R * .14 * pa;
        const pg = ctx.createLinearGradient(x, y - R * .9, x, y);
        pg.addColorStop(0, 'rgba(255,60,90,0)'); pg.addColorStop(.6, `rgba(255,90,120,${.4 * pa})`); pg.addColorStop(1, `rgba(255,240,240,${.8 * pa})`);
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.moveTo(x - pw * .4, y - R * .9); ctx.lineTo(x + pw * .4, y - R * .9); ctx.lineTo(x + pw, y); ctx.lineTo(x - pw, y); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // loose petals scattering upward and out
      for (let i = 0; i < 26; i++) {
        const h1 = K.hash(i * 3.3 + seed), h2 = K.hash(i * 7.1 + seed), an = h1 * TAU;
        const d = R * (.2 + e * (.5 + h2 * .5)), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5 - e * (40 + h2 * 120) + b * b * 90;
        ctx.save(); ctx.globalAlpha *= fade; ctx.translate(px, py); ctx.rotate(time * 4 + i);
        ctx.fillStyle = i % 3 ? '#ff6f96' : '#ffd0dc';
        petal(ctx, 16 + h2 * 10, 7);
        ctx.restore();
      }
      if (K.fx) K.fx.debris(ctx, x, y, R * .7, b, seed, '#4a2a2a', 10);
    }
    ctx.restore();
  }

  window.MightGuyVFX = {
    drawEffects(ctx, state, elapsed) {
      const K = window.VFXKit;
      if (!ctx || !state || !K) return;
      const time = Number.isFinite(elapsed) ? elapsed : performance.now() / 1000;
      const moves = state.moves || [], tigers = state.tigers || [], finishers = state.finishers || [];
      for (let i = Math.max(0, moves.length - 10); i < moves.length; i++) {
        const fx = moves[i];
        if (!fx || fx.life <= 0 || !Number.isFinite(fx.x) || !Number.isFinite(fx.y)) continue;
        if (fx.kind === 'punch') drawPunch(ctx, fx, time, K);
        else if (fx.kind === 'peacock') drawPeacock(ctx, fx, time, K);
        else if (fx.kind === 'elephant') drawElephant(ctx, fx, time, K);
        else if (fx.kind === 'senpu') drawSenpu(ctx, fx, time, K);
        else if (fx.kind === 'entry') drawEntry(ctx, fx, time, K);
        else if (fx.kind === 'lotus') drawLotus(ctx, fx, time, K);
      }
      for (let i = 0, count = Math.min(tigers.length, 3); i < count; i++) drawTiger(ctx, tigers[i], time, K);
      for (let i = 0, count = Math.min(finishers.length, 3); i < count; i++) drawFinisher(ctx, finishers[i], time, K);
    }
  };
})();
