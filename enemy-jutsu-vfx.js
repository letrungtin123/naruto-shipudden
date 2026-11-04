(() => {
  'use strict';

  // Signature jutsu of the spawnable ninja (the four basic ninja and the village defenders).
  // game.js keeps one list of effects for the whole horde; each effect first shows its danger
  // zone on the ground for `warn` seconds, then plays for `dur` seconds. Hit areas are plain
  // world circles, lines and cones, so the warnings are drawn unsquashed to match them exactly.
  // Uses window.VFXKit (skill-vfx.js).
  const TAU = Math.PI * 2;
  const c01 = n => Math.max(0, Math.min(1, n));
  const lift = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  const TONE = {
    kunai: '200,215,225', needle: '150,220,255', lightning: '255,236,110', earth: '205,160,105', thorn: '140,210,90',
    fire: '255,120,40', water: '110,200,255', wind: '240,225,180', sound: '190,140,255', sand: '225,190,120',
    steam: '255,200,180', waterfall: '150,215,255', rock: '190,150,110'
  };

  // ---------------------------------------------------------------- warnings
  // The danger zone: a dark-rimmed outline in the jutsu's colour that fills up as the hit nears.
  function warnShape(ctx, fx, k, time) {
    const rgb = TONE[fx.style] || '255,90,60', pulse = .7 + Math.sin(time * 20) * .25;
    const outline = full => {
      ctx.beginPath();
      if (fx.shape === 'line') {
        const c = Math.cos(fx.angle), s = Math.sin(fx.angle), len = fx.len * full, w = fx.w;
        ctx.moveTo(fx.x - s * w, fx.y + c * w); ctx.lineTo(fx.x - s * w + c * len, fx.y + c * w + s * len);
        ctx.lineTo(fx.x + s * w + c * len, fx.y - c * w + s * len); ctx.lineTo(fx.x + s * w, fx.y - c * w); ctx.closePath();
      } else if (fx.shape === 'cone') {
        ctx.moveTo(fx.x, fx.y); ctx.arc(fx.x, fx.y, fx.len * full, fx.angle - fx.half, fx.angle + fx.half); ctx.closePath();
      } else {
        const spots = fx.pts || [0, 0];
        for (let i = 0; i < spots.length; i += 2) { ctx.moveTo(fx.x + spots[i] + fx.r * full, fx.y + spots[i + 1]); ctx.arc(fx.x + spots[i], fx.y + spots[i + 1], fx.r * full, 0, TAU); }
      }
    };
    ctx.save();
    outline(k); ctx.fillStyle = `rgba(255,50,30,${.14 + k * .14})`; ctx.fill();
    outline(1);
    ctx.strokeStyle = 'rgba(40,12,8,.55)'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- helpers
  function jagged(ctx, x1, y1, x2, y2, seed, time, jitter, K) {
    const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 26)), nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1;
    const tick = Math.floor(time * 28);
    ctx.beginPath(); ctx.moveTo(x1, y1);
    for (let i = 1; i < n; i++) {
      const t = i / n, j = (K.hash(seed + i * 3.7 + tick * 1.3) - .5) * jitter * 2;
      ctx.lineTo(x1 + (x2 - x1) * t + nx / l * j, y1 + (y2 - y1) * t + ny / l * j);
    }
    ctx.lineTo(x2, y2);
  }
  // A bolt with a dark violet halo underneath so it reads on bright ground, then a hot core.
  function boltLayers(ctx, x1, y1, x2, y2, seed, time, jitter, alpha, K, rgb = '255,236,110') {
    const op = ctx.globalCompositeOperation;
    jagged(ctx, x1, y1, x2, y2, seed, time, jitter, K);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(60,30,110,${.45 * alpha})`; ctx.lineWidth = 14; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${.95 * alpha})`; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.globalCompositeOperation = op;
  }
  function spikeSprite(K, style) {
    return K.sprite('ej-spike-' + style, 40, 90, g => {
      const thorn = style === 'thorn';
      g.fillStyle = thorn ? '#3f7a2c' : '#6d5034';
      g.beginPath(); g.moveTo(4, 88); g.lineTo(thorn ? 24 : 20, 2); g.lineTo(36, 88); g.closePath(); g.fill();
      g.fillStyle = thorn ? '#77b950' : '#a8835a';
      g.beginPath(); g.moveTo(20, 88); g.lineTo(thorn ? 24 : 20, 2); g.lineTo(36, 88); g.closePath(); g.fill();
      g.strokeStyle = thorn ? '#1f3d16' : '#3a2a1a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(4, 88); g.lineTo(thorn ? 24 : 20, 2); g.lineTo(36, 88); g.stroke();
      if (thorn) { g.fillStyle = '#c64a6a'; g.beginPath(); g.arc(14, 50, 4, 0, TAU); g.arc(29, 66, 3.5, 0, TAU); g.fill(); }
    });
  }
  function kunaiSprite(K) {
    return K.sprite('ej-kunai', 14, 46, g => {
      g.fillStyle = '#cfd8dc'; g.beginPath(); g.moveTo(7, 46); g.lineTo(13, 28); g.lineTo(7, 24); g.lineTo(1, 28); g.closePath(); g.fill();
      g.fillStyle = '#8fa3ad'; g.beginPath(); g.moveTo(7, 46); g.lineTo(13, 28); g.lineTo(7, 24); g.closePath(); g.fill();
      g.fillStyle = '#3a3036'; g.fillRect(5, 6, 4, 18);
      g.strokeStyle = '#3a3036'; g.lineWidth = 2; g.beginPath(); g.arc(7, 4, 3.5, 0, TAU); g.stroke();
    });
  }
  function rockSprite(K) {
    return K.sprite('ej-rock', 120, 100, g => {
      const pts = [[10, 60], [22, 24], [52, 8], [90, 14], [112, 44], [104, 80], [64, 96], [24, 88]];
      g.fillStyle = '#6e5a46'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
      g.fillStyle = '#9a8164'; g.beginPath(); g.moveTo(22, 24); g.lineTo(52, 8); g.lineTo(90, 14); g.lineTo(80, 40); g.lineTo(40, 46); g.closePath(); g.fill();
      g.fillStyle = '#4e3f31'; g.beginPath(); g.moveTo(64, 96); g.lineTo(104, 80); g.lineTo(112, 44); g.lineTo(84, 60); g.closePath(); g.fill();
      g.strokeStyle = '#2e241b'; g.lineWidth = 3; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(40, 46); g.lineTo(58, 70); g.moveTo(80, 40); g.lineTo(84, 60); g.stroke();
    });
  }

  // ---------------------------------------------------------------- active jutsu (ground layer)
  function drawGroundFx(ctx, fx, k, time, K) {
    const L = lift(), seed = fx.seed || 0;
    switch (fx.kind) {
      case 'spikes': {
        // stone (or thorn) spikes erupting along a line or across a ring, then sinking back
        const img = spikeSprite(K, fx.style), n = fx.shape === 'line' ? Math.round(fx.len / 34) : 26, list = [];
        for (let i = 0; i < n; i++) {
          let x, y, delay;
          if (fx.shape === 'line') {
            const d = 30 + i * 34, side = (K.hash(seed + i) - .5) * fx.w * 1.4;
            x = fx.x + Math.cos(fx.angle) * d - Math.sin(fx.angle) * side; y = fx.y + Math.sin(fx.angle) * d + Math.cos(fx.angle) * side; delay = i / n * .35;
          } else {
            const an = K.hash(seed + i * 2.1) * TAU, d = fx.r * Math.sqrt(.08 + K.hash(seed + i * 5.3) * .92);
            x = fx.x + Math.cos(an) * d; y = fx.y + Math.sin(an) * d; delay = (1 - d / fx.r) * .25;
          }
          list.push([y, x, delay, i]);
        }
        list.sort((a, b) => a[0] - b[0]);
        const dust = K.puff('dust');
        for (const [y, x, delay, i] of list) {
          const t = c01((k - delay) / .25), sink = c01((k - .7) / .3);
          if (t <= 0) continue;
          const h = (34 + K.hash(seed + i * 7) * 46) * K.ease.outBack(t) * (1 - sink);
          if (h < 2) continue;
          const w = h * .42;
          ctx.drawImage(img, 0, 0, 40, 90 * Math.min(1, h / 80 + .2), x - w / 2, y - h, w, h);
          if (t < 1) K.stamp(ctx, dust, x, y - 4, 10 + t * 12, (1 - t) * .7);
        }
        break;
      }
      case 'zone': {
        // Sand Binding: a sand vortex sucking at the ground; thorns: handled by spikes
        const fade = 1 - c01((k - .85) / .15), grow = K.ease.out(k / .2), R = fx.r * grow;
        ctx.save(); ctx.translate(fx.x, fx.y);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        g.addColorStop(0, `rgba(120,90,50,${.6 * fade})`); g.addColorStop(.7, `rgba(200,165,100,${.45 * fade})`); g.addColorStop(1, 'rgba(220,190,130,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
        ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const r = R * (.25 + i * .11), a0 = time * (3.5 - i * .3) + i * 1.3;
          ctx.strokeStyle = `rgba(${i % 2 ? '240,215,160' : '170,130,80'},${.75 * fade})`; ctx.lineWidth = 4 - i * .3;
          ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + 2.2); ctx.stroke();
        }
        ctx.restore();
        const dust = K.puff('dust');
        for (let i = 0; i < 10; i++) {
          const an = time * 2.5 + i * TAU / 10, d = R * (.4 + .5 * ((time * .7 + K.hash(seed + i)) % 1));
          K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d - 8, 14, .45 * fade);
        }
        break;
      }
      case 'cone': {
        const fade = 1 - c01((k - .55) / .45), run = K.ease.out(c01(k / .5)), R = fx.len * (.15 + run * .85);
        ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.angle);
        if (fx.style === 'fire') {
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, R * .55, 0, R * .7, '255,110,30', .5 * fade);
          ctx.globalCompositeOperation = 'source-over';
          const fire = K.puff('fire');
          for (let i = 0; i < 30; i++) {
            const h1 = K.hash(seed + i * 1.7), h2 = K.hash(seed + i * 4.1), d = R * (.15 + h1 * .85), an = (h2 - .5) * 2 * fx.half * .9;
            K.stamp(ctx, fire, Math.cos(an) * d, Math.sin(an) * d - 10, (14 + d * .12) * (1 + Math.sin(time * 18 + i) * .1), fade * (.95 - h1 * .3));
          }
        } else if (fx.style === 'water') {
          ctx.fillStyle = `rgba(60,150,220,${.45 * fade})`;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -fx.half, fx.half); ctx.closePath(); ctx.fill();
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const rr = R * (1 - i * .12);
            ctx.strokeStyle = `rgba(${i ? '170,225,255' : '255,255,255'},${fade * (.95 - i * .25)})`; ctx.lineWidth = 9 - i * 2.5;
            ctx.beginPath(); ctx.arc(0, 0, rr, -fx.half, fx.half); ctx.stroke();
          }
          const water = K.puff('water');
          for (let i = 0; i < 12; i++) {
            const an = (i / 11 - .5) * 2 * fx.half, wob = Math.sin(time * 12 + i) * 6;
            K.stamp(ctx, water, Math.cos(an) * (R + wob), Math.sin(an) * (R + wob) - 12, 18, .7 * fade);
          }
        } else if (fx.style === 'sound') {
          ctx.fillStyle = `rgba(120,60,200,${.16 * fade})`;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -fx.half, fx.half); ctx.closePath(); ctx.fill();
          ctx.lineCap = 'round';
          for (let i = 0; i < 7; i++) {
            const q = ((k * 2.2 + i / 7) % 1), rr = fx.len * q;
            ctx.strokeStyle = `rgba(70,25,130,${.5 * (1 - q) * fade})`; ctx.lineWidth = 10 * (1 - q) + 3;
            ctx.beginPath(); ctx.arc(0, 0, rr, -fx.half, fx.half); ctx.stroke();
            ctx.strokeStyle = `rgba(215,175,255,${(1 - q) * fade})`; ctx.lineWidth = 5 * (1 - q) + 1.5;
            ctx.beginPath(); ctx.arc(0, 0, rr, -fx.half, fx.half); ctx.stroke();
          }
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, 30, 0, 90, '190,130,255', .5 * fade);
        } else {
          // wind: pale crescents tearing outward with dust in their wake
          ctx.fillStyle = `rgba(150,170,180,${.18 * fade})`;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -fx.half, fx.half); ctx.closePath(); ctx.fill();
          ctx.lineCap = 'round';
          for (let i = 0; i < 6; i++) {
            const q = c01(run * 1.2 - i * .09), rr = 30 + q * fx.len * (1 - i * .07), w = fx.half * (1 - i * .08);
            ctx.strokeStyle = `rgba(80,100,115,${fade * (.55 - i * .06)})`; ctx.lineWidth = 13 - i * 1.5;
            ctx.beginPath(); ctx.arc(0, 0, rr, -w, w); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,250,${fade * (.95 - i * .1)})`; ctx.lineWidth = 6 - i * .7;
            ctx.beginPath(); ctx.arc(0, 0, rr, -w, w); ctx.stroke();
          }
          // sickle-shaped blades of wind spinning out
          for (let i = 0; i < 8; i++) {
            const an = (K.hash(seed + i * 2.2) - .5) * 2 * fx.half * .9, d = 40 + c01(run * 1.3 - K.hash(seed + i) * .3) * fx.len * .95;
            ctx.save(); ctx.translate(Math.cos(an) * d, Math.sin(an) * d); ctx.rotate(an + time * 12 + i);
            ctx.strokeStyle = `rgba(70,95,110,${.6 * fade})`; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(0, 0, 16, 0, 2.6); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${fade})`; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 0, 16, 0, 2.6); ctx.stroke();
            ctx.restore();
          }
          const dust = K.puff('dust');
          for (let i = 0; i < 10; i++) {
            const an = (K.hash(seed + i) - .5) * 2 * fx.half, d = R * (.4 + K.hash(seed + i * 3) * .6);
            K.stamp(ctx, dust, Math.cos(an) * d, Math.sin(an) * d - 6, 16 + run * 14, .45 * fade);
          }
        }
        ctx.restore();
        break;
      }
      case 'boulder': {
        // shadow growing under the falling rock; crater and dust ring after it lands
        const land = .3;
        if (k < land) {
          const q = k / land;
          ctx.fillStyle = `rgba(0,0,0,${.15 + q * .3})`;
          ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * (.3 + q * .5), fx.r * (.15 + q * .25), 0, 0, TAU); ctx.fill();
        } else {
          const q = (k - land) / (1 - land), e = K.ease.out(q * 1.4), fade = 1 - K.ease.smooth((q - .3) / .7);
          ctx.fillStyle = `rgba(50,36,24,${.55 * fade})`;
          ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * .7, fx.r * .35, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(230,210,180,${fade})`; ctx.lineWidth = 7 * fade + 1;
          ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * (.4 + e * .9), fx.r * (.2 + e * .45), 0, 0, TAU); ctx.stroke();
          const dust = K.puff('dust');
          for (let i = 0; i < 12; i++) {
            const an = i * TAU / 12 + K.hash(seed + i), d = fx.r * (.4 + e * .7);
            K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - 10, fx.r * (.12 + e * .12), fade * .55);
          }
          if (K.fx) K.fx.debris(ctx, fx.x, fx.y, fx.r, q, seed, '#5a4632', 10);
        }
        break;
      }
      case 'beam':
        if (fx.style === 'lightning') {
          const fade = 1 - c01((k - .35) / .65);
          ctx.fillStyle = `rgba(40,30,20,${.35 * fade})`;
          ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.angle); ctx.fillRect(0, -fx.w * .35, fx.len, fx.w * .7); ctx.restore();
        }
        break;
    }
  }

  // ---------------------------------------------------------------- active jutsu (above characters)
  function drawAirFx(ctx, fx, k, time, K) {
    const L = lift(), seed = fx.seed || 0;
    switch (fx.kind) {
      case 'rain': {
        // kunai or senbon needles raining onto the zone, each one sparking where it lands
        const kunai = fx.style === 'kunai', img = kunai ? kunaiSprite(K) : null, n = kunai ? 34 : 56;
        ctx.save(); ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          const h1 = K.hash(seed + i * 1.3), h2 = K.hash(seed + i * 2.9), an = h1 * TAU, d = fx.r * Math.sqrt(h2);
          const gx = fx.x + Math.cos(an) * d, gy = fx.y + Math.sin(an) * d;
          const t0 = K.hash(seed + i * 4.7) * .55, q = c01((k - t0) / .22);
          if (q <= 0) continue;
          if (q < 1) {
            const y = gy - (1 - q) * 380;
            if (kunai) ctx.drawImage(img, gx - 5, y - 32, 10, 33);
            else { ctx.strokeStyle = 'rgba(40,70,110,.8)'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(gx, y - 46); ctx.lineTo(gx, y); ctx.stroke();
              ctx.strokeStyle = 'rgba(200,240,255,.95)'; ctx.lineWidth = 1.5; ctx.stroke(); }
          } else {
            const s = c01((k - t0 - .22) / .2);
            if (s >= 1) { if (kunai) { ctx.globalAlpha = 1 - c01((k - .8) / .2); ctx.drawImage(img, gx - 4, gy - 18, 8, 22); ctx.globalAlpha = 1; } continue; }
            ctx.globalCompositeOperation = 'lighter';
            K.glow(ctx, gx, gy - 4, 16 * (1 - s) + 4, kunai ? '255,230,180' : '170,230,255', 1 - s, true);
            ctx.globalCompositeOperation = 'source-over';
            if (kunai) ctx.drawImage(img, gx - 4, gy - 18, 8, 22);
          }
        }
        ctx.restore();
        break;
      }
      case 'beam': {
        const fade = 1 - c01((k - .35) / .65), ex = fx.x + Math.cos(fx.angle) * fx.len, ey = fx.y + Math.sin(fx.angle) * fx.len;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (fx.style === 'lightning') {
          boltLayers(ctx, fx.x, fx.y - L, ex, ey - L, seed, time, 22, fade, K);
          boltLayers(ctx, fx.x, fx.y - L, ex, ey - L, seed + 50, time, 34, fade * .6, K, '160,220,255');
          K.glow(ctx, ex, ey - L, 70, '255,240,140', fade, true);
          K.glow(ctx, fx.x, fx.y - L, 40, '255,240,140', fade * .8, true);
        } else {
          // water dragon: a churning body of water racing down the line, head first
          const run = K.ease.out(c01(k / .45)), hx = fx.x + (ex - fx.x) * run, hy = fx.y + (ey - fx.y) * run;
          ctx.globalCompositeOperation = 'source-over';
          const water = K.puff('water'), nx = -Math.sin(fx.angle), ny = Math.cos(fx.angle);
          for (let i = 0; i <= 18; i++) {
            const t = i / 18, along = run * t, wave = Math.sin(t * 9 - time * 10) * fx.w * .4 * (1 - t * .3);
            const bx = fx.x + (ex - fx.x) * along + nx * wave, by = fx.y + (ey - fx.y) * along + ny * wave * .6 - L;
            K.stamp(ctx, water, bx, by, fx.w * (.55 + t * .5), fade * (.6 + t * .4));
          }
          ctx.save(); ctx.translate(hx, hy - L); ctx.rotate(fx.angle); if (Math.cos(fx.angle) < 0) ctx.scale(1, -1);
          ctx.globalAlpha = fade; const s = fx.w * 1.1;
          ctx.fillStyle = '#3d9ad8'; ctx.beginPath(); ctx.moveTo(-s, -s * .6); ctx.quadraticCurveTo(s * .2, -s * .9, s * 1.3, -s * .2); ctx.lineTo(s * .5, 0); ctx.lineTo(s * 1.2, s * .3); ctx.quadraticCurveTo(0, s * .7, -s, s * .5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#bfeaff'; ctx.beginPath(); ctx.moveTo(-s * .6, -s * .45); ctx.quadraticCurveTo(s * .3, -s * .7, s * 1.1, -s * .22); ctx.quadraticCurveTo(s * .3, -s * .35, -s * .6, -s * .25); ctx.fill();
          ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-s * .2, -s * .6); ctx.quadraticCurveTo(-s * .9, -s * 1.2, -s * 1.6, -s); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s * .35, -s * .35, s * .14, s * .07, -.2, 0, TAU); ctx.fill();
          ctx.restore();
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, hx, hy - L, fx.w * 2, '140,210,255', .5 * fade);
          if (run >= 1) {
            const sp = c01((k - .45) / .4);
            ctx.strokeStyle = `rgba(220,245,255,${1 - sp})`; ctx.lineWidth = 6 * (1 - sp) + 1;
            ctx.beginPath(); ctx.ellipse(ex, ey, 30 + sp * 110, 15 + sp * 55, 0, 0, TAU); ctx.stroke();
          }
        }
        ctx.restore();
        break;
      }
      case 'bolts': {
        // lightning dropping out of the sky onto each marked spot in turn
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const pts = fx.pts;
        for (let i = 0; i < pts.length; i += 2) {
          const t0 = (fx.stagger || 0) * i / 2 / fx.dur, q = (k - t0) / .3;
          if (q <= 0 || q >= 1) continue;
          const x = fx.x + pts[i], y = fx.y + pts[i + 1], f = 1 - q;
          boltLayers(ctx, x + (K.hash(seed + i) - .5) * 60, y - 520, x, y, seed + i * 9, time, 26, f, K);
          K.glow(ctx, x, y - 10, fx.r * 1.4, '255,240,150', f, true);
          ctx.strokeStyle = `rgba(255,245,180,${f})`; ctx.lineWidth = 4 * f + 1;
          ctx.beginPath(); ctx.ellipse(x, y, fx.r * (.4 + q * .8), fx.r * (.2 + q * .4), 0, 0, TAU); ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'boulder': {
        const land = .3;
        if (k < land) {
          const q = K.ease.in(k / land), s = fx.r * 1.3;
          ctx.drawImage(rockSprite(K), fx.x - s / 2, fx.y - (1 - q) * 520 - s * .8, s, s * .83);
        } else {
          const q = (k - land) / (1 - land);
          if (q < .15) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 20, fx.r * 1.6, '255,235,200', 1 - q / .15, true); ctx.restore(); }
          ctx.globalAlpha = 1 - c01((q - .5) / .5);
          const s = fx.r * 1.3 * (1 - q * .15);
          ctx.drawImage(rockSprite(K), fx.x - s / 2, fx.y - s * .55, s, s * .83);
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'geyser': {
        // steam: a scalding column bursting out of the ground; waterfall: water crashing down from above
        const fade = 1 - c01((k - .6) / .4), grow = K.ease.out(c01(k / .25)), H = 260 * grow;
        if (fx.style === 'steam') {
          const steam = K.puff('poof');
          for (let i = 0; i < 12; i++) {
            const t = i / 11, ph = (time * 1.6 + K.hash(seed + i)) % 1;
            K.stamp(ctx, steam, fx.x + Math.sin(time * 4 + i) * 10 * t, fx.y - t * H - ph * 30, fx.r * (.4 + t * .4), fade * (.5 - t * .3));
          }
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, fx.x, fx.y - 20, fx.r * 1.3, '255,170,130', .55 * fade);
          ctx.restore();
        } else {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const w = fx.r * .9, top = fx.y - 520;
          const g = ctx.createLinearGradient(fx.x, top, fx.x, fx.y);
          g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(.4, `rgba(140,210,255,${.55 * fade})`); g.addColorStop(1, `rgba(235,250,255,${.9 * fade})`);
          ctx.fillStyle = g; ctx.fillRect(fx.x - w / 2, top, w, 520 * grow);
          ctx.strokeStyle = `rgba(255,255,255,${.7 * fade})`; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 7; i++) { const x = fx.x - w / 2 + (i + .5) * w / 7, off = ((time * 900 + i * 97) % 200); ctx.moveTo(x, top + off); ctx.lineTo(x, Math.min(fx.y, top + off + 300)); }
          ctx.stroke();
          ctx.restore();
          const water = K.puff('water');
          for (let i = 0; i < 10; i++) {
            const an = i * TAU / 10 + time * 2, d = fx.r * (.6 + ((time * 1.4 + K.hash(seed + i)) % 1) * .6);
            K.stamp(ctx, water, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - 10, 20, .7 * fade);
          }
        }
        break;
      }
      case 'blastRing': {
        const fade = 1 - k;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x, fx.y - 20, fx.r * (.6 + k), `${TONE[fx.style] || '255,120,40'}`, fade);
        ctx.restore();
        break;
      }
    }
  }

  function each(ctx, list, time, ground) {
    const K = window.VFXKit;
    if (!K || !list || !list.length) return;
    for (const fx of list) {
      const age = fx.maxLife - fx.life;
      if (age < fx.warn) { if (ground) warnShape(ctx, fx, age / fx.warn, time); continue; }
      const k = c01((age - fx.warn) / fx.dur);
      if (ground) drawGroundFx(ctx, fx, k, time, K); else drawAirFx(ctx, fx, k, time, K);
    }
  }

  window.EnemyJutsuVFX = {
    drawGround(ctx, list, time) { each(ctx, list, time, true); },
    drawOverlay(ctx, list, time) { each(ctx, list, time, false); }
  };
})();
