/* Anime-style jutsu effects. Ground effects sit on the ground plane; projectiles and
 * hand-held jutsu are lifted to chest height (AnimeSprites.LIFT) over a ground shadow.
 *
 * Look: layered cel shapes + additive glows, smooth eased motion, deterministic particles.
 * Cost: every soft glow, flame tongue, smoke puff and swirl texture is a sprite baked once
 * into an offscreen canvas and stamped with drawImage, so no gradients are built per frame
 * (except one scorch gradient per sea of fire). The kit is shared as window.VFXKit. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = value => Math.max(0, Math.min(1, value));
  const frac = v => v - Math.floor(v);
  const remaining = effect => clamp((effect.life || 0) / Math.max(.001, effect.maxLife || 1));
  const lift = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 0);

  // ================================================================ shared kit
  const Kit = (() => {
    const cache = new Map();
    const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
    const smooth = t => t * t * (3 - 2 * t);
    // Smooth value noise in [0,1]: a deterministic random value per seed that morphs at `rate` Hz.
    const wobble = (seed, time, rate) => {
      const f = time * rate, i = Math.floor(f), u = smooth(f - i);
      return hash(seed + i * 17.13) * (1 - u) + hash(seed + (i + 1) * 17.13) * u;
    };
    const ease = {
      out: t => 1 - Math.pow(1 - clamp(t), 3),
      outQuad: t => { t = clamp(t); return 1 - (1 - t) * (1 - t); },
      in: t => { t = clamp(t); return t * t; },
      inOut: t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
      outBack: t => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
      smooth: t => smooth(clamp(t)),
      // 0 → 1 → 0 bell over [0,1]
      bell: t => { t = clamp(t); return Math.sin(Math.PI * t); }
    };

    function sprite(key, w, h, paint) {
      let c = cache.get(key);
      if (!c) {
        c = document.createElement('canvas'); c.width = w; c.height = h;
        paint(c.getContext('2d'), w, h);
        cache.set(key, c);
      }
      return c;
    }

    // Soft radial glow; `hot` adds a white-hot centre. Use with 'lighter'.
    function glowSprite(rgb, hot) {
      return sprite((hot ? 'hot:' : 'glow:') + rgb, 128, 128, g => {
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        if (hot) {
          gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.16, `rgba(${rgb},.95)`);
          gr.addColorStop(.45, `rgba(${rgb},.33)`); gr.addColorStop(.75, `rgba(${rgb},.08)`); gr.addColorStop(1, `rgba(${rgb},0)`);
        } else {
          gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.22, `rgba(${rgb},.62)`);
          gr.addColorStop(.5, `rgba(${rgb},.22)`); gr.addColorStop(.78, `rgba(${rgb},.06)`); gr.addColorStop(1, `rgba(${rgb},0)`);
        }
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      });
    }
    function glow(ctx, x, y, r, rgb, alpha = 1, hot = false, squash = 1) {
      if (!(r > .5) || !(alpha > .004)) return;
      const a = ctx.globalAlpha; ctx.globalAlpha = a * Math.min(1, alpha);
      ctx.drawImage(glowSprite(rgb, hot), x - r, y - r * squash, r * 2, r * 2 * squash);
      ctx.globalAlpha = a;
    }

    // Cel-shaded billow puffs (two-tone with a soft rim) for fireballs, smoke, dust, water.
    const PUFFS = {
      fire: [[0, '#fff7d6'], [.2, '#ffd955'], [.44, '#ff8a1e'], [.68, '#e8401a'], [.86, 'rgba(165,28,10,.85)'], [1, 'rgba(120,16,6,0)']],
      ember: [[0, '#ffb347'], [.4, '#e8401a'], [.75, 'rgba(140,22,10,.8)'], [1, 'rgba(90,10,4,0)']],
      smoke: [[0, 'rgba(112,100,95,.95)'], [.4, 'rgba(78,69,66,.88)'], [.68, 'rgba(54,47,46,.6)'], [.86, 'rgba(44,38,37,.25)'], [1, 'rgba(42,36,35,0)']],
      poof: [[0, '#ffffff'], [.55, '#f6f8fc'], [.8, '#dfe5f0'], [.9, 'rgba(176,186,206,.95)'], [.97, 'rgba(140,150,175,.45)'], [1, 'rgba(140,150,175,0)']],
      dust: [[0, '#efe1c6'], [.5, '#d7c3a2'], [.8, '#b59e7e'], [.93, 'rgba(150,128,100,.65)'], [1, 'rgba(150,128,100,0)']],
      violet: [[0, 'rgba(108,53,146,.95)'], [.4, 'rgba(56,18,80,.88)'], [.68, 'rgba(30,8,44,.6)'], [.86, 'rgba(28,6,40,.25)'], [1, 'rgba(30,6,44,0)']],
      water: [[0, '#f4fdff'], [.38, '#a6e9ff'], [.72, '#43ade8'], [.9, 'rgba(26,108,190,.85)'], [1, 'rgba(26,108,190,0)']],
      steam: [[0, 'rgba(255,215,195,.95)'], [.3, 'rgba(255,100,70,.9)'], [.6, 'rgba(210,30,30,.62)'], [.84, 'rgba(140,10,16,.22)'], [1, 'rgba(120,8,14,0)']]
    };
    function puff(kind) {
      return sprite('puff:' + kind, 96, 96, g => {
        const gr = g.createRadialGradient(38, 36, 0, 48, 48, 48);
        for (const [s, c] of PUFFS[kind] || PUFFS.smoke) gr.addColorStop(s, c);
        g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
      });
    }
    function stamp(ctx, img, x, y, r, alpha = 1, squash = 1) {
      if (!(r > .5) || !(alpha > .004)) return;
      const a = ctx.globalAlpha; ctx.globalAlpha = a * Math.min(1, alpha);
      ctx.drawImage(img, x - r, y - r * squash, r * 2, r * 2 * squash);
      ctx.globalAlpha = a;
    }

    // Tapered flame tongue, base at (cx, base), pointing up.
    function tonguePath(g, cx, base, hw, h, seed, lean) {
      const N = 18, L = [], R = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const prof = Math.pow(1 - t, 1.1) * (1 + 1.7 * t) * (1 + Math.sin(t * 13 + seed) * .12 * t);
        const w = hw * prof;
        const xc = cx + Math.sin(t * 3.4 + seed) * hw * .34 * t + lean * t * t * hw;
        const y = base - t * h;
        L.push(xc - w, y); R.push(xc + w, y);
      }
      g.beginPath(); g.moveTo(L[0], L[1]);
      for (let i = 1; i <= N; i++) g.lineTo(L[i * 2], L[i * 2 + 1]);
      for (let i = N; i >= 0; i--) g.lineTo(R[i * 2], R[i * 2 + 1]);
      g.quadraticCurveTo(cx, base + hw * .42, L[0], L[1]);
      g.closePath();
    }
    // Five cel layers: crimson rim → red → orange → gold → white-hot heart. Base at y = 114/128.
    const FLAME_LAYERS = [[1, '#a3140a'], [.84, '#e33a10'], [.66, '#ff7d1c'], [.46, '#ffc840'], [.25, '#fff4cc']];
    const FLAME_BASE = 114 / 128;
    function flame(v, palette = FLAME_LAYERS, tag = '') {
      return sprite('flame' + tag + ':' + (v % 6), 64, 128, g => {
        const seed = (v % 6) * 1.93 + .4, lean = (hash(v % 6 + 2) - .5) * .9;
        g.fillStyle = palette[1][1];
        tonguePath(g, 15, 112, 6, 40, seed + 4, -.6); g.fill();
        tonguePath(g, 49, 112, 6, 46, seed + 7, .6); g.fill();
        for (const [k, col] of palette) {
          tonguePath(g, 32, 114 - (1 - k) * 6, 24 * (.22 + .78 * k), 108 * (.26 + .74 * k), seed + k * .7, lean * k);
          g.fillStyle = col; g.fill();
        }
      });
    }
    // Draw a sprite whose base is at (x,y) with a horizontal shear, using the cached base matrix m.
    function flameAt(ctx, m, img, x, y, w, h, shear) {
      ctx.setTransform(m.a, m.b, m.a * shear + m.c, m.b * shear + m.d,
        m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
      ctx.drawImage(img, -w * .5, -h * FLAME_BASE, w, h);
    }

    // Spiral texture (outer edge → centre), spun at runtime for any rotating chakra mass.
    function swirl(key, colors, n, turns, inner, size = 128, width = 3.2) {
      return sprite('swirl:' + key, size, size, g => {
        const c = size / 2, R = c - 3;
        g.translate(c, c); g.lineCap = 'round';
        for (let s = 0; s < n; s++) {
          const a0 = s * TAU / n + hash(s + n) * .5;
          const tw = turns * (.85 + hash(s * 3 + 1) * .3);
          g.strokeStyle = colors[s % colors.length];
          const steps = 22;
          for (let i = 0; i < steps; i++) {
            const t0 = i / steps, t1 = (i + 1) / steps;
            const a1 = a0 + t0 * tw * TAU, a2 = a0 + t1 * tw * TAU;
            const r1 = R * (1 - t0 * (1 - inner)), r2 = R * (1 - t1 * (1 - inner));
            g.lineWidth = (width * Math.sin(Math.PI * (t0 * .8 + .12)) + .4) * size / 128;
            g.beginPath(); g.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1); g.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2); g.stroke();
          }
        }
      });
    }
    function spin(ctx, img, x, y, r, angle, alpha = 1, squash = 1) {
      if (!(r > .5) || !(alpha > .004)) return;
      const a = ctx.globalAlpha; ctx.globalAlpha = a * Math.min(1, alpha);
      ctx.save(); ctx.translate(x, y); if (squash !== 1) ctx.scale(1, squash); ctx.rotate(angle);
      ctx.drawImage(img, -r, -r, r * 2, r * 2);
      ctx.restore(); ctx.globalAlpha = a;
    }

    // Shaded sphere sprite (translucent chakra ball).
    function sphere(key, stops, fx = .36, fy = .34) {
      return sprite('sphere:' + key, 128, 128, g => {
        const gr = g.createRadialGradient(128 * fx, 128 * fy, 3, 64, 64, 63);
        for (const [s, c] of stops) gr.addColorStop(s, c);
        g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 63, 0, TAU); g.fill();
      });
    }

    // ---- lightning: smooth-morphing jagged polylines written into a reusable buffer
    function bolt(buf, x1, y1, x2, y2, segs, jitter, seed, time, rate = 17) {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs, env = i === 0 || i === segs ? 0 : Math.pow(Math.sin(Math.PI * t), .55);
        const off = (wobble(seed + i * 7.31, time, rate) * 2 - 1) * jitter * env;
        buf[i * 2] = x1 + dx * t + nx * off; buf[i * 2 + 1] = y1 + dy * t + ny * off;
      }
      return segs + 1;
    }
    function strokePts(ctx, buf, n) {
      ctx.beginPath(); ctx.moveTo(buf[0], buf[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(buf[i * 2], buf[i * 2 + 1]);
      ctx.stroke();
    }
    // pal = ['outer rgb', 'mid rgb', 'core rgb']
    function boltLayers(ctx, buf, n, alpha, w, pal) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(${pal[0]},${alpha * .22})`; ctx.lineWidth = w * 5.5; strokePts(ctx, buf, n);
      ctx.strokeStyle = `rgba(${pal[1]},${alpha * .75})`; ctx.lineWidth = w * 2.2; strokePts(ctx, buf, n);
      ctx.strokeStyle = `rgba(${pal[2]},${alpha})`; ctx.lineWidth = w * .85; strokePts(ctx, buf, n);
    }
    // A branching bolt: main channel + forks that crawl along it.
    // o.snap: the shape jumps to a new random pose `rate` times a second instead of morphing
    // smoothly — the frame-to-frame crackle of anime lightning.
    const MAIN = new Float32Array(64), FORK = new Float32Array(24);
    function forkedBolt(ctx, x1, y1, x2, y2, seed, time, o) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 2) return;
      if (o.snap) time = Math.floor(time * (o.rate || 17)) / (o.rate || 17);
      const segs = Math.max(4, Math.min(28, Math.round(len / (o.step || 16))));
      const n = bolt(MAIN, x1, y1, x2, y2, segs, o.jitter, seed, time, o.rate);
      if (o.base) {
        // Saturated under-stroke in normal blending so additive bolts keep their hue on bright ground.
        const op = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = o.base; ctx.lineWidth = o.width * 3.2; strokePts(ctx, MAIN, n);
        ctx.globalCompositeOperation = op;
      }
      boltLayers(ctx, MAIN, n, o.alpha, o.width, o.pal);
      const forks = o.forks || 0, dir = Math.atan2(y2 - y1, x2 - x1);
      for (let f = 0; f < forks; f++) {
        const at = 1 + Math.floor(wobble(seed + f * 13.7, time, o.rate * .5) * (n - 2));
        const bx = MAIN[at * 2], by = MAIN[at * 2 + 1];
        const side = f % 2 ? 1 : -1;
        const fs = o.snap ? seed + Math.floor(time * (o.rate || 17)) * 3.7 : seed;
        const fa = dir + side * (.45 + hash(fs + f * 5.1) * .8);
        const fl = (o.forkLen || 26) * (.55 + hash(fs + f * 2.3) * .7);
        const fn = bolt(FORK, bx, by, bx + Math.cos(fa) * fl, by + Math.sin(fa) * fl, 4, fl * .22, seed + f * 31, time, o.rate);
        if (o.base && o.forkBase) {
          const op = ctx.globalCompositeOperation;
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = o.base; ctx.lineWidth = o.width * 1.9; strokePts(ctx, FORK, fn);
          ctx.globalCompositeOperation = op;
        }
        boltLayers(ctx, FORK, fn, o.alpha * .8, o.width * .55, o.pal);
      }
    }

    // Chidori held in the palm: a dense knot of lightning streams re-drawn every other frame (the
    // "thousand birds" chatter), arcs skipping over its surface and chirping sparks. A source-over
    // halo in o.body keeps the hue on bright ground; o.dark gives it a dark heart (purple Chidori).
    // o: { pal: [outer, mid, core] rgb, body: rgb, base: css colour, dark?: rgb, power 0..1, alpha, bolts, width }
    function chidoriBall(ctx, x, y, r, time, seed, o) {
      if (!(r > 1)) return;
      const pal = o.pal, k = o.power == null ? 1 : o.power, a = o.alpha == null ? 1 : o.alpha;
      const tick = Math.floor(time * 30), fl = .84 + hash(seed + tick * 1.37) * .32;
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'source-over';
      glow(ctx, x, y, r * 1.45 * fl, o.body, .6 * a);
      if (o.dark) glow(ctx, x, y, r * .62, o.dark, .95 * a);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, y, r * 2.1 * fl, pal[0], .5 * a);
      glow(ctx, x, y, r * (o.dark ? .42 : .6) * fl, o.dark ? pal[1] : pal[2], (o.dark ? .75 : 1) * a, true);
      const n = o.bolts || 9, w = o.width || 1;
      for (let i = 0; i < n; i++) {
        const an = i * TAU / n + (hash(seed + i * 7.1 + tick * .91) - .5) * 1.4;
        const l = r * (.65 + hash(seed + i * 3.3 + tick * 1.7) * (.5 + .7 * k));
        const c = Math.cos(an), s = Math.sin(an) * .82;
        forkedBolt(ctx, x + c * r * .12, y + s * r * .12, x + c * l, y + s * l, seed + i * 13, time,
          { jitter: r * .18 + 1, alpha: a, width: w, pal, base: o.base, forkBase: true, step: Math.max(5, r * .28),
            forks: k > .35 ? 1 : 0, forkLen: r * (.35 + k * .3), rate: 30, snap: true });
      }
      // arcs skipping over the surface
      const arcs = 2 + Math.round(k * 2);
      for (let i = 0; i < arcs; i++) {
        const a0 = hash(seed + 40 + i * 2.3 + tick * .37) * TAU, a1 = a0 + .9 + hash(seed + i + tick * .71) * 1.5, rr = r * .8;
        forkedBolt(ctx, x + Math.cos(a0) * rr, y + Math.sin(a0) * rr * .82, x + Math.cos(a1) * rr, y + Math.sin(a1) * rr * .82,
          seed + 60 + i * 11, time, { jitter: r * .14 + 1, alpha: a * .85, width: w * .8, pal, step: Math.max(5, r * .25), rate: 30, snap: true });
      }
      // chirping zigzag sparks
      ctx.strokeStyle = `rgba(${pal[2]},${.9 * a})`; ctx.lineWidth = Math.max(.8, w * .8);
      ctx.beginPath();
      const sparks = 4 + Math.round(k * 6);
      for (let i = 0; i < sparks; i++) {
        const cyc = time * 4.5 + hash(seed + i), ph = frac(cyc), m = Math.floor(cyc);
        if (ph > .8) continue;
        const an = hash(seed + i * 3.1 + m * 7.7) * TAU, d = r * (.5 + ph * 1.3), L = r * (.18 + k * .1);
        const c = Math.cos(an), s = Math.sin(an), j = (hash(seed + i + m) - .5) * L;
        ctx.moveTo(x + c * d, y + s * d);
        ctx.lineTo(x + c * (d + L * .45) - s * j, y + s * (d + L * .45) + c * j);
        ctx.lineTo(x + c * (d + L), y + s * (d + L));
      }
      ctx.stroke();
      ctx.globalCompositeOperation = op;
    }

    return { hash, wobble, ease, sprite, glow, glowSprite, puff, stamp, flame, flameAt, FLAME_LAYERS,
      swirl, spin, sphere, bolt, boltLayers, forkedBolt, strokePts, chidoriBall };
  })();
  window.VFXKit = Kit;
  const { hash, ease } = Kit;
  const VIEW = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
  const inView = (x, y, r) => x + r > VIEW.x0 && x - r < VIEW.x1 && y + r > VIEW.y0 && y - r < VIEW.y1;

  function groundGlow(ctx, x, y, r, rgb, alpha) {
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, x, y + 2, r, rgb, alpha, false, .38);
    ctx.globalCompositeOperation = op;
  }
  function groundShadow(ctx, x, y, r, color = 'rgba(16,20,10,.25)') {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y + 2, r, r * .36, 0, 0, TAU); ctx.fill();
  }

  // Wobbly closed blob used for cel flame silhouettes.
  function blob(ctx, r, time, wobble, points = 14, seed = 0) {
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = i / points * TAU;
      const k = 1 + Math.sin(a * 3 + time * 11 + seed) * wobble + Math.sin(a * 5 - time * 7 + seed) * wobble * .6;
      const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  // Sprites used by several jutsu.
  const SPR = {
    // Dense chakra ball: pale-cyan heart, saturated blue body, deep-blue limb and a bright rim.
    rasSphere: () => Kit.sphere('ras2', [[0, 'rgba(225,248,255,.95)'], [.16, 'rgba(130,212,255,.88)'], [.42, 'rgba(48,146,246,.78)'], [.74, 'rgba(22,92,222,.82)'], [.9, 'rgba(36,120,236,.9)'], [.96, 'rgba(140,214,255,.95)'], [1, 'rgba(140,214,255,0)']], .4, .38),
    // Translucent outer layer of wind round the ball, combed with fine arcs.
    rasOuter: () => Kit.sprite('rasOuter', 128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
      gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(.62, 'rgba(110,190,255,.1)');
      gr.addColorStop(.86, 'rgba(90,175,255,.26)'); gr.addColorStop(.96, 'rgba(170,228,255,.38)'); gr.addColorStop(1, 'rgba(170,228,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.translate(64, 64); g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const rr = 40 + hash(i * 2.9) * 22, a = hash(i * 4.3) * TAU, l = .35 + hash(i * 6.1) * .9;
        g.strokeStyle = i % 4 ? 'rgba(225,246,255,.55)' : 'rgba(60,150,245,.6)'; g.lineWidth = .7 + hash(i * 8.3) * 1.1;
        g.beginPath(); g.arc(0, 0, rr, a, a + l); g.stroke();
      }
    }),
    rasSwirlA: () => Kit.swirl('rasA', ['rgba(255,255,255,.95)', 'rgba(170,232,255,.85)'], 9, .62, .08),
    rasSwirlB: () => Kit.swirl('rasB', ['rgba(80,170,255,.9)', 'rgba(220,250,255,.7)'], 7, .45, .2, 128, 2.4),
    // Deep-blue spiral lines drawn in normal blending so the Rasengan keeps its blue on bright grass.
    rasSwirlC: () => Kit.swirl('rasC', ['rgba(26,96,214,.85)', 'rgba(52,140,240,.7)'], 6, .7, .12, 128, 2.2),
    // Dark chakra shell under the sphere rim (contrast against light ground).
    rasShell: () => Kit.sprite('rasShell', 128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(16,60,170,0)'); gr.addColorStop(.66, 'rgba(16,60,170,0)');
      gr.addColorStop(.86, 'rgba(18,70,190,.55)'); gr.addColorStop(.95, 'rgba(30,100,220,.35)'); gr.addColorStop(1, 'rgba(30,100,220,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }),
    // Translucent wind bubble: clear-ish middle, dense blue edge (reads on grass and on dark ground).
    windSphere: () => Kit.sprite('windSphere', 256, 256, g => {
      const gr = g.createRadialGradient(100, 92, 4, 128, 128, 127);
      gr.addColorStop(0, 'rgba(240,252,255,.62)'); gr.addColorStop(.35, 'rgba(170,225,255,.34)');
      gr.addColorStop(.72, 'rgba(96,176,250,.36)'); gr.addColorStop(.9, 'rgba(48,128,236,.62)');
      gr.addColorStop(.97, 'rgba(160,220,255,.8)'); gr.addColorStop(1, 'rgba(160,220,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 127, 0, TAU); g.fill();
    }),
    // Dense pale wind of the Rasen Shuriken's detonation sphere (kept below the bloom threshold
    // so only its heart and rim glints glow).
    shurikenDome: () => Kit.sprite('shurikenDome', 256, 256, g => {
      const gr = g.createRadialGradient(108, 100, 6, 128, 128, 127);
      gr.addColorStop(0, 'rgba(204,230,245,.86)'); gr.addColorStop(.45, 'rgba(184,220,243,.8)');
      gr.addColorStop(.8, 'rgba(128,190,240,.66)'); gr.addColorStop(.94, 'rgba(70,146,232,.72)'); gr.addColorStop(1, 'rgba(70,146,232,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 127, 0, TAU); g.fill();
    }),
    gSpiralBlue: () => Kit.swirl('gSpiralBlue', ['rgba(30,100,220,.75)', 'rgba(60,150,240,.6)'], 6, .85, .1, 256, 3),
    rsDisc: () => Kit.sprite('rsDisc', 256, 256, g => {
      // the four blades smeared into a spinning disc
      const gr = g.createRadialGradient(128, 128, 20, 128, 128, 127);
      gr.addColorStop(0, 'rgba(230,248,255,.0)'); gr.addColorStop(.3, 'rgba(210,240,255,.35)');
      gr.addColorStop(.7, 'rgba(150,212,255,.28)'); gr.addColorStop(.9, 'rgba(90,170,245,.22)'); gr.addColorStop(1, 'rgba(90,170,245,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 127, 0, TAU); g.fill();
      g.translate(128, 128); g.lineCap = 'round';
      for (let i = 0; i < 30; i++) {
        const rr = 40 + hash(i * 2.3) * 84, a = hash(i * 4.1) * TAU, l = .5 + hash(i * 6.7) * 1.1;
        g.strokeStyle = i % 3 ? 'rgba(255,255,255,.5)' : 'rgba(60,140,235,.45)'; g.lineWidth = 1 + hash(i) * 1.6;
        g.beginPath(); g.arc(0, 0, rr, a, a + l); g.stroke();
      }
    }),
    groundSpiral: () => Kit.swirl('gSpiral', ['rgba(150,225,255,.95)', 'rgba(255,255,255,.85)', 'rgba(70,160,255,.8)'], 7, .85, .1, 256, 3.4),
    beastSphere: () => Kit.sphere('beast', [[0, '#5a2378'], [.3, '#1c0828'], [.7, '#07020b'], [.88, '#2c0a44'], [.95, 'rgba(214,124,255,.95)'], [1, 'rgba(214,124,255,0)']]),
    beastSwirl: () => Kit.swirl('beast', ['rgba(220,120,255,.9)', 'rgba(255,170,230,.7)', 'rgba(140,60,255,.85)'], 8, .7, .12),
    windRing: () => Kit.sprite('windRing', 256, 256, g => {
      g.translate(128, 128); g.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const rr = 124 * (.32 + hash(i * 1.7) * .68), a = hash(i * 3.1) * TAU, l = .18 + hash(i * 5.3) * .5;
        g.strokeStyle = `rgba(${i % 3 ? '235,250,255' : '140,215,255'},${.35 + hash(i * 7.7) * .5})`;
        g.lineWidth = .8 + hash(i * 9.1) * 1.6;
        g.beginPath(); g.arc(0, 0, rr, a, a + l); g.stroke();
      }
    }),
    // The four great blades of wind: thin swept-back sickles, white on the leading edge and
    // thinning to pale blue behind, inked with a deep-blue leading edge so they read on sand.
    // The blades spin toward +angle (clockwise on screen), so each one's smear trails at -angle.
    blades: () => Kit.sprite('rsBlades2', 256, 256, g => {
      g.translate(128, 128);
      const R = 124;
      g.lineJoin = 'round'; g.lineCap = 'round';
      const blade = () => {
        g.beginPath();
        g.moveTo(R * .18, R * .12);
        g.quadraticCurveTo(R * .62, R * .12, R * .99, -R * .06);       // leading edge, nearly straight
        g.quadraticCurveTo(R * .62, -R * .2, R * .3, -R * .5);         // swept, slightly concave trailing edge
        g.quadraticCurveTo(R * .12, -R * .22, R * .18, R * .12);
        g.closePath();
      };
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * TAU / 4);
        const lg = g.createLinearGradient(0, R * .12, 0, -R * .48);
        lg.addColorStop(0, 'rgba(255,255,255,.97)'); lg.addColorStop(.35, 'rgba(226,246,255,.9)');
        lg.addColorStop(.75, 'rgba(160,214,255,.62)'); lg.addColorStop(1, 'rgba(120,190,255,.35)');
        blade(); g.fillStyle = lg; g.fill();
        g.strokeStyle = 'rgba(110,190,255,.6)'; g.lineWidth = 1.2; g.stroke();
        // inked leading edge
        g.beginPath(); g.moveTo(R * .18, R * .12); g.quadraticCurveTo(R * .62, R * .12, R * .99, -R * .06);
        g.strokeStyle = 'rgba(20,84,200,.9)'; g.lineWidth = 4; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 1.8; g.stroke();
        // wind grain combed along the blade
        g.strokeStyle = 'rgba(70,150,240,.5)'; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const y0 = R * (.04 - k * .11);
          g.beginPath(); g.moveTo(R * (.26 + k * .02), y0); g.quadraticCurveTo(R * (.6 - k * .05), y0 - R * .02, R * (.9 - k * .14), -R * (.06 + k * .02)); g.stroke();
        }
        g.restore();
      }
      // the thin ring band riding around the core
      g.strokeStyle = 'rgba(30,104,214,.65)'; g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, R * .44, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(240,252,255,.95)'; g.lineWidth = 2.4;
      g.beginPath(); g.arc(0, 0, R * .44, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(140,215,255,.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, 0, R * .52, 0, TAU); g.stroke();
    }),
    // Motion smear swept behind each blade: a conic fan, densest just behind the blade, fading
    // over a quarter turn, with streaks of wind combed into it.
    bladeSmear: () => Kit.sprite('rsSmear', 256, 256, g => {
      g.translate(128, 128);
      const R = 124;
      if (g.createConicGradient) {
        const cg = g.createConicGradient(-TAU / 4 + .05, 0, 0);
        for (let i = 0; i < 4; i++) {
          const b = i * .25;
          cg.addColorStop(b, 'rgba(190,230,255,0)');
          cg.addColorStop(b + .16, 'rgba(190,230,255,.14)');
          cg.addColorStop(b + .235, 'rgba(215,242,255,.42)');
          cg.addColorStop(b + .2495, 'rgba(230,248,255,.55)');
        }
        g.fillStyle = cg;
        g.beginPath(); g.arc(0, 0, R, 0, TAU); g.arc(0, 0, R * .3, 0, TAU, true); g.fill();
        g.globalCompositeOperation = 'destination-in';
        const m = g.createRadialGradient(0, 0, R * .28, 0, 0, R);
        m.addColorStop(0, 'rgba(0,0,0,.2)'); m.addColorStop(.35, 'rgba(0,0,0,1)'); m.addColorStop(.85, 'rgba(0,0,0,.9)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = m; g.fillRect(-R, -R, R * 2, R * 2);
        g.globalCompositeOperation = 'source-over';
      }
      g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * TAU / 4);
        for (let k = 0; k < 6; k++) {
          const rr = R * (.4 + k * .1), l = .5 + hash(i * 6 + k) * .9;
          g.strokeStyle = k % 2 ? 'rgba(235,250,255,.45)' : 'rgba(80,160,245,.35)'; g.lineWidth = 1.6 - k * .15;
          g.beginPath(); g.arc(0, 0, rr, -.08 - l, -.08); g.stroke();
        }
        g.restore();
      }
    })
  };

  // ================================================================ Katon: Gōkakyū no Jutsu
  // A roiling sphere of fire with a comet tail of flame tongues, dark smoke peeling off the
  // back (so it reads on bright grass), an ignition flash at launch and embers in its wake.
  function drawFireball(ctx, fireball, time) {
    const maxLife = fireball.maxLife || 1.35;
    const age = Math.max(0, maxLife - (fireball.life || 0));
    const pop = ease.outBack(age / .16);
    const r = Math.max(5, fireball.r || 18) * 1.6 * (.42 + .58 * pop);
    const x = fireball.x, y = fireball.y - lift();
    const ang = Number.isFinite(fireball.angle) ? fireball.angle : Math.atan2(fireball.vy || 0, fireball.vx || 1);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const seed = (maxLife * 13 + ang * 7) % 50;
    const tail = .35 + .65 * ease.out(age / .3);   // the tail stretches as the ball gathers speed
    groundShadow(ctx, fireball.x, fireball.y, r * .95, 'rgba(40,14,4,.24)');
    groundGlow(ctx, fireball.x, fireball.y, r * 2.4, '255,120,40', .6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, x - ca * r * .7, y - sa * r * .7, r * 3.4, '255,92,22', .38);
    ctx.globalCompositeOperation = 'source-over';
    // Dark smoke peeling off far behind, rising as it cools.
    const smoke = Kit.puff('smoke'), firePuff = Kit.puff('fire'), ember = Kit.puff('ember');
    const sflow = time * 3.2;
    for (let i = 6; i >= 0; i--) {
      const u = (i + frac(sflow)) / 7, id = i - Math.floor(sflow);
      const d = r * (1.5 + u * 4.4) * tail;
      const off = (hash(id * 2.13 + seed) - .5) * r * 1.1 * u;
      Kit.stamp(ctx, smoke, x - ca * d - sa * off, y - sa * d + ca * off - u * r * .9,
        r * (.42 + u * .6), (1 - u) * Math.min(1, u * 5) * .5);
    }
    // Flame wake: billows flowing backward from the ball, far ones first.
    const flow = time * 12, N = 12;
    for (let i = N - 1; i >= 0; i--) {
      const u = (i + frac(flow)) / N, id = i - Math.floor(flow);
      const d = r * (.3 + u * 3.4) * tail;
      const off = (hash(id * 1.37) - .5) * r * .9 * u + Math.sin(id * 2.3 + time * 8) * r * .2 * u;
      const px = x - ca * d - sa * off, py = y - sa * d + ca * off - u * r * .35;
      const size = r * (1.02 - u * .6) * (.8 + hash(id * 2.71) * .4);
      Kit.stamp(ctx, u > .5 ? ember : firePuff, px, py, size, Math.pow(1 - u, 1.1));
    }
    // The ball, in its flight frame (+x = forward). Built back to front: flame tongues licking
    // round its whole trailing half, a sooty smoke rim, a dark-red body, rolling billows that turn
    // over the top like a tumbling mass of fire, then an orange → gold → white-hot heart.
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    const FB = 114 / 128;
    for (let k = 0; k < 11; k++) {
      const side = k / 10 * 2 - 1, as = Math.abs(side);
      const w0 = Kit.wobble(seed + k * 3.1, time, 5.5);
      const len = r * (.7 + .9 * w0 + Math.pow(1 - as, 1.5) * 2.2) * tail;
      const wid = r * (.75 + .4 * (1 - as)) * (.85 + .3 * Kit.wobble(seed + k * 7.7, time, 7));
      const base = Math.PI + side * 1.5, dir = Math.PI + side * .62 + (Kit.wobble(seed + k * 5.3, time, 3.5) - .5) * .3;
      ctx.save();
      ctx.translate(Math.cos(base) * r * .5, Math.sin(base) * r * .5); ctx.rotate(dir + Math.PI / 2);
      ctx.drawImage(Kit.flame(k), -wid / 2, -len * FB, wid, len);
      ctx.restore();
    }
    // short tongues licking off the leading face
    for (let k = 0; k < 5; k++) {
      const side = k / 4 * 2 - 1, len = r * (.55 + .45 * Kit.wobble(seed + 40 + k, time, 8)), wid = r * .5;
      ctx.save();
      ctx.translate(Math.cos(side * 1.3) * r * .62, Math.sin(side * 1.3) * r * .62);
      ctx.rotate(side * 2.1 + Math.PI / 2 + (Kit.wobble(seed + 50 + k, time, 6) - .5) * .5);
      ctx.drawImage(Kit.flame(k + 2), -wid / 2, -len * FB, wid, len);
      ctx.restore();
    }
    // sooty smoke boiling off the top and back (normal blending: the ball keeps its silhouette on grass)
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * .55 + i * .38 + Math.sin(time * 3 + i) * .1, d = r * .82;
      Kit.stamp(ctx, smoke, Math.cos(a) * d, Math.sin(a) * d - r * .1, r * (.42 + .1 * Kit.wobble(seed + i, time, 4)), .55);
    }
    ctx.fillStyle = '#7a1405'; blob(ctx, r * 1.0, time, .1, 16, 1 + seed); ctx.fill();
    // rolling billows: the outer ring turns over the top toward the front
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + time * 5.5, d = r * (.72 + .06 * Math.sin(time * 7 + i * 2));
      Kit.stamp(ctx, ember, Math.cos(a) * d, Math.sin(a) * d * .92, r * (.38 + .08 * hash(i + seed)), .95);
    }
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 + time * 7.5 + 1, d = r * .4;
      Kit.stamp(ctx, firePuff, Math.cos(a) * d, Math.sin(a) * d * .9, r * (.5 + .08 * Math.sin(time * 9 + i)), .92);
    }
    ctx.fillStyle = '#ff7a18'; blob(ctx, r * .58, time * 1.3, .12, 12, 3 + seed); ctx.fill();
    ctx.fillStyle = '#ffc23a'; blob(ctx, r * .4, time * 1.7, .12, 10, 5 + seed); ctx.fill();
    // crimson licks curling over the surface sell the roll
    ctx.strokeStyle = 'rgba(150,24,6,.55)'; ctx.lineWidth = Math.max(1.2, r * .06); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = time * 7 + i * 2.1;
      ctx.beginPath(); ctx.arc(0, 0, r * (.55 + i * .13), a, a + .9); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    // white-hot heart, slightly forward of centre; the orange halo bleeds through the bloom
    Kit.glow(ctx, x, y, r * 1.5, '255,120,30', .55);
    Kit.glow(ctx, x + ca * r * .12, y + sa * r * .12, r * .62, '255,200,90', .95, true);
    // Ignition flash at the caster's mouth.
    if (age < .14) Kit.glow(ctx, x - ca * r * .6, y - sa * r * .6, r * (2 + age * 14), '255,230,170', 1 - age / .14, true);
    // Embers peeling off the wake.
    ctx.fillStyle = '#ffd36a';
    for (let i = 0; i < 10; i++) {
      const ph = frac(time * 1.7 + hash(i + seed));
      const d = r * (.8 + ph * 4.4) * tail, lat = (hash(i * 3 + seed) - .5) * r * 2.6 * ph;
      const px = x - ca * d - sa * lat, py = y - sa * d + ca * lat - ph * r * .9;
      const s = 2.6 * (1 - ph) + .6;
      ctx.globalAlpha = 1 - ph; ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    // Heat shimmer arcs ahead of the ball.
    ctx.strokeStyle = 'rgba(255,220,170,.18)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const rr = r * (1.4 + i * .3 + Math.sin(time * 9 + i) * .06);
      ctx.beginPath(); ctx.arc(x, y, rr, ang - .7, ang + .7); ctx.stroke();
    }
    ctx.restore();
  }

  // ================================================================ Chidori (lightning dash)
  const BLUE_PAL = ['40,110,255', '110,205,255', '244,252,255'];
  // F dash: a scorched streak on the ground, a blue afterimage smear with speed lines, the crackling
  // channel (painted in normal blending first so it stays blue on grass, then lit additively),
  // chirping sparks, and a Chidori hand crackling at the arrival point.
  function drawLightning(ctx, trail, time) {
    const alpha = remaining(trail);
    if (alpha <= 0) return;
    const L = lift(), age = 1 - alpha;
    const seed = ((trail.x1 || 0) * .13 + (trail.y1 || 0) * .07) % 97;
    const gx1 = trail.x1, gy1 = trail.y1, gx2 = trail.x2, gy2 = trail.y2;
    const gdx = gx2 - gx1, gdy = gy2 - gy1, glen = Math.hypot(gdx, gdy) || 1;
    const ux = gdx / glen, uy = gdy / glen, nx = -uy, ny = ux;
    // The streak retracts toward the arrival point as it fades (follow-through).
    const s = ease.in(age) * .85;
    const x2 = gx2, y2 = gy2 - L;
    const x1 = gx1 + gdx * s, y1 = gy1 - L + gdy * s;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // scorched ground line, lingering longer than the bolt
    ctx.strokeStyle = `rgba(22,26,44,${.2 * Math.min(1, alpha * 1.6)})`; ctx.lineWidth = 4 + 4 * alpha;
    ctx.beginPath(); ctx.moveTo(gx1 + ux * 10, gy1 + uy * 10); ctx.lineTo(gx2, gy2); ctx.stroke();
    ctx.strokeStyle = `rgba(90,170,255,${.35 * alpha})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx1 + ux * 14, gy1 + uy * 14); ctx.lineTo(gx2, gy2); ctx.stroke();
    groundCrackle(ctx, gx1 + gdx * s, gy1 + gdy * s, gx2, gy2, time, seed, alpha, BLUE_PAL, `rgba(16,58,190,${.6 * alpha})`, Math.min(6, 2 + Math.round(glen / 60)));
    // afterimage smear: a tapered blue band at chest height, thick at the arrival end
    if (len > 4) {
      const w = 13 * (.4 + alpha * .6);
      ctx.fillStyle = `rgba(60,140,255,${.28 * alpha})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 + nx * w, y2 + ny * w); ctx.lineTo(x2 + ux * w * .8, y2 + uy * w * .8); ctx.lineTo(x2 - nx * w, y2 - ny * w);
      ctx.closePath(); ctx.fill();
      // speed lines
      ctx.strokeStyle = `rgba(235,248,255,${.55 * alpha})`; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const off = (hash(i * 3.1 + seed) - .5) * 44, t0 = .1 + hash(i * 5.3 + seed) * .5, t1 = Math.min(1, t0 + .25 + hash(i * 7.7) * .4);
        ctx.moveTo(x1 + dx * t0 + nx * off, y1 + dy * t0 + ny * off); ctx.lineTo(x1 + dx * t1 + nx * off, y1 + dy * t1 + ny * off);
      }
      ctx.stroke();
    }
    // the channel: blue body in normal blending...
    const forks = Math.min(7, 2 + Math.round(len / 45));
    Kit.forkedBolt(ctx, x1, y1, x2, y2, seed, time, { jitter: 14 * alpha + 5, alpha, width: 2.4, pal: BLUE_PAL, base: `rgba(16,58,190,${.7 * alpha})`, forkBase: true, forks, forkLen: 30, rate: 20, snap: true });
    // ...then lit up
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j <= 4; j++) {
      const t = j / 4;
      Kit.glow(ctx, x1 + dx * t, y1 + dy * t, 26 + 22 * alpha, '50,130,255', .3 * alpha);
    }
    Kit.forkedBolt(ctx, x1, y1, x2, y2, seed + 50, time, { jitter: 22 * alpha + 6, alpha: alpha * .6, width: 1.3, pal: BLUE_PAL, forks: 0, rate: 15, snap: true });
    // Chirping sparks spitting off the channel.
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const cyc = time * 5 + hash(i * 3.3 + seed), ph = frac(cyc), n = Math.floor(cyc);
      const t = hash(i + n * 3.7 + seed), a = hash(i * 5.1 + n * 1.3) * TAU, d = 6 + ph * 26;
      const px = x1 + dx * t, py = y1 + dy * t;
      ctx.strokeStyle = `rgba(200,240,255,${(1 - ph) * alpha})`;
      ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * d, py + Math.sin(a) * d);
      ctx.lineTo(px + Math.cos(a) * (d + 7), py + Math.sin(a) * (d + 7)); ctx.stroke();
    }
    // The Chidori still crackling in the hand at the arrival point, guttering out.
    Kit.chidoriBall(ctx, x2 + ux * 8, y2 + uy * 4, 9 + 13 * alpha, time, seed, { pal: BLUE_PAL, body: '30,80,220',
      base: `rgba(12,44,170,${.75 * alpha})`, power: alpha, alpha: Math.min(1, alpha * 1.5), bolts: 6 + Math.round(alpha * 4), width: 1.1 });
    ctx.restore();
  }
  // Ground sparks: little arcs skittering over the ground along the dash path and scorch flecks.
  function groundCrackle(ctx, x1, y1, x2, y2, time, seed, alpha, pal, base, n) {
    const dx = x2 - x1, dy = y2 - y1, tick = Math.floor(time * 24);
    for (let i = 0; i < n; i++) {
      const t = hash(seed + i * 3.7 + tick * .29), a = hash(seed + i * 5.3 + tick * .53) * TAU, l = 8 + hash(seed + i + tick) * 16;
      const px = x1 + dx * t, py = y1 + dy * t;
      Kit.forkedBolt(ctx, px, py, px + Math.cos(a) * l, py + Math.sin(a) * l * .45, seed + i * 7, time,
        { jitter: 4, alpha, width: .9, pal, base, step: 6, rate: 24, snap: true });
    }
  }

  // ================================================================ Rasengan
  // Swirling blue sphere: dark chakra shell → shaded sphere → deep-blue spiral lines (normal blend,
  // so it stays blue on grass) → white spiral streams and tilted wind orbits (additive) → hot core.
  // Chakra streams wrapping the ball in 3D: each is a comet-shaped arc racing round its own tilted
  // great circle. Projected per frame (a few dozen points); the far half is drawn dim behind the
  // body, the near half bright over it, so the ball reads as a spinning sphere, not a flat swirl.
  const RAS_STREAMS = Array.from({ length: 8 }, (_, i) => ({
    tilt: .35 + hash(i * 3.1 + 1) * 2.4, yaw: hash(i * 5.7 + 2) * TAU, speed: (9 + hash(i * 7.3) * 8) * (i % 3 ? 1 : -1),
    len: 1.5 + hash(i * 2.2) * 1.3, ph: hash(i * 9.9) * TAU, rr: .9 + hash(i * 4.4) * .2
  }));
  const STREAM_PTS = new Float32Array(10 * 3);
  function rasStreams(ctx, r, time, front) {
    const K = 9;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of RAS_STREAMS) {
      const yaw = s.yaw + time * .8, ct = Math.cos(s.tilt), st = Math.sin(s.tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const ux = cy, uy = sy, vx = -sy * ct, vy = cy * ct, vz = st;
      const head = s.ph + time * s.speed, dir = s.speed > 0 ? 1 : -1, R = r * s.rr;
      const hz = Math.sin(head) * vz;
      if ((hz > 0) !== front) continue;
      for (let k = 0; k <= K; k++) {
        const th = head - dir * s.len * k / K, c = Math.cos(th), sn = Math.sin(th);
        STREAM_PTS[k * 3] = (c * ux + sn * vx) * R; STREAM_PTS[k * 3 + 1] = (c * uy + sn * vy) * R;
      }
      // three tapering passes: thin full tail, then thicker head
      for (let p = 0; p < 3; p++) {
        const n = p === 0 ? K : p === 1 ? 6 : 3;
        ctx.beginPath(); ctx.moveTo(STREAM_PTS[0], STREAM_PTS[1]);
        for (let k = 1; k <= n; k++) ctx.lineTo(STREAM_PTS[k * 3], STREAM_PTS[k * 3 + 1]);
        if (front) {
          ctx.strokeStyle = p === 2 ? 'rgba(255,255,255,.95)' : p === 1 ? 'rgba(190,238,255,.75)' : 'rgba(120,200,255,.45)';
          ctx.lineWidth = Math.min(4, Math.max(.7, r * (.02 + p * .014)));
        } else {
          ctx.strokeStyle = `rgba(150,215,255,${.16 + p * .08})`;
          ctx.lineWidth = Math.min(3, Math.max(.6, r * (.018 + p * .01)));
        }
        ctx.stroke();
      }
    }
  }

  function drawRasenganOrb(ctx, radius, time, alpha = 1) {
    const r = Math.max(6, radius);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, 0, 0, r * 2.4, '40,130,255', .5);
    ctx.globalCompositeOperation = 'source-over';
    // the outer translucent wind layer, then the far-side streams seen through it
    Kit.spin(ctx, SPR.rasOuter(), 0, 0, r * 1.3, -time * 7, .85);
    rasStreams(ctx, r * 1.12, time, false);
    ctx.drawImage(SPR.rasShell(), -r * 1.14, -r * 1.14, r * 2.28, r * 2.28);
    ctx.drawImage(SPR.rasSphere(), -r, -r, r * 2, r * 2);
    Kit.spin(ctx, SPR.rasSwirlC(), 0, 0, r * .93, time * 12, .7, .94);
    ctx.globalCompositeOperation = 'lighter';
    // Counter-rotating spiral streams pulled into the core.
    Kit.spin(ctx, SPR.rasSwirlB(), 0, 0, r * .96, -time * 9, .55, .94);
    Kit.spin(ctx, SPR.rasSwirlA(), 0, 0, r * .9, time * 16, .8, .94);
    // compact white-hot heart: only the middle third clips and blooms
    Kit.glow(ctx, 0, 0, r * .62, '120,200,255', .9, true);
    Kit.glow(ctx, 0, 0, r * .3, '235,250,255', .9, true);
    // near-side streams racing over the surface
    rasStreams(ctx, r * 1.04, time, true);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(190,236,255,.55)'; ctx.lineWidth = Math.max(.8, r * .04);
    ctx.beginPath(); ctx.arc(0, 0, r * .99, 0, TAU); ctx.stroke();
    // specular crescent, top-left
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(1, r * .07);
    ctx.beginPath(); ctx.arc(0, 0, r * .8, -2.65, -1.8); ctx.stroke();
    ctx.restore();
  }

  // Rasengan impact: the sphere grinds in, gouging a spiral crater, then bursts into a wind dome
  // (drawn by the paired 'vortex' explosion).
  function drawVortex(ctx, vortex, time) {
    const alpha = remaining(vortex);
    if (alpha <= 0) return;
    const radius = Math.max(16, vortex.radius || 64), age = 1 - alpha;
    const x = vortex.x, y = vortex.y, seed = (x * .31 + y * .17) % 89;
    const spread = ease.out(age * 1.5);
    ctx.save();
    // Crater and spiral grooves cut by the grinding sphere (normal blending: reads on any ground).
    const cr = radius * .52 * (.35 + spread * .65), ga = Math.min(1, alpha * 1.6);
    ctx.fillStyle = `rgba(42,36,32,${.32 * ga})`;
    ctx.beginPath(); ctx.ellipse(x, y, cr, cr * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(22,18,16,${.3 * ga})`;
    ctx.beginPath(); ctx.ellipse(x, y, cr * .48, cr * .22, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(28,22,18,${.45 * ga})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a0 = k * TAU / 5 + seed;
      for (let j = 0; j <= 10; j++) {
        const t = j / 10, a = a0 + t * 2.3, rr = cr * (.16 + t * .98);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * .46;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
    }
    ctx.stroke();
    // Wind spiral scouring the ground: a blue body, then light streaks over it.
    Kit.spin(ctx, SPR.gSpiralBlue(), x, y, radius * (.45 + spread * .6), -time * 7, alpha * .55, .45);
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, x, y, radius * (.6 + spread * .6), '70,160,255', .3 * alpha, false, .45);
    ctx.globalCompositeOperation = 'source-over';
    Kit.spin(ctx, SPR.groundSpiral(), x, y, radius * (.45 + spread * .6), -time * 7, alpha * .6, .45);
    // Ground ring of kicked-up dust.
    const dust = Kit.puff('dust');
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + hash(i + radius) * .5, d = radius * (.35 + spread * .6);
      Kit.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .45 - spread * 10, radius * (.1 + spread * .08), alpha * .5 * spread);
    }
    debris(ctx, x, y, radius * .9, age, seed, '#4c443c', 10);
    // Grinding: earth chips flung off tangentially, spiralling out of the drill point.
    if (age < .7) {
      ctx.fillStyle = '#5a4c3e';
      for (let i = 0; i < 14; i++) {
        const ph = frac(time * 2.6 + hash(i * 1.9 + seed)), k = 1 - age / .7;
        const a = hash(i * 4.3 + seed) * TAU - time * 9 - ph * 2.2, d = radius * (.08 + ph * .5);
        const h = Math.sin(Math.PI * ph) * radius * (.08 + hash(i + seed) * .1), s = (2 + hash(i * 3.3) * 3) * (1 - ph * .5);
        ctx.globalAlpha = k * (1 - ph * ph);
        ctx.fillRect(x + Math.cos(a) * d - s / 2, y + Math.sin(a) * d * .46 - h - s / 2, s, s * .7);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // The sphere drills down from chest height into the ground, then swells and bursts.
    const r0 = Math.min(95, radius * .32);
    const grind = age < .4;
    const swell = grind ? 1 + Math.sin(time * 40) * .03 : 1 + ease.out((age - .4) / .6) * .7;
    const sink = lift() * (grind ? 1 - ease.inOut(age / .4) * .55 : .45 + ease.out((age - .4) / .6) * .3);
    ctx.save(); ctx.translate(x, y - sink);
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = -time * 14 + i * TAU / 6, rr = r0 * swell * (1.35 + (i % 3) * .2);
      ctx.strokeStyle = `rgba(40,120,230,${alpha * .4})`; ctx.lineWidth = 3.5 - (i % 3) * .6;
      ctx.beginPath(); ctx.arc(0, 0, rr, a, a + .9); ctx.stroke();
      ctx.strokeStyle = `rgba(225,248,255,${alpha * .7})`; ctx.lineWidth = 1.6 - (i % 3) * .3;
      ctx.beginPath(); ctx.arc(0, 0, rr, a + .05, a + .85); ctx.stroke();
    }
    drawRasenganOrb(ctx, r0 * swell, time, grind ? 1 : alpha / .6);
    // the burst: a ring of light where the ball gives way
    if (!grind && age < .62) {
      const k = (age - .4) / .22;
      ctx.globalCompositeOperation = 'lighter';
      Kit.glow(ctx, 0, 0, r0 * (1.2 + k * 1.6), '150,220,255', (1 - k) * .8, true);
      ctx.strokeStyle = `rgba(230,250,255,${1 - k})`; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(0, 0, r0 * (1.1 + k * 2.2), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ================================================================ Rasen Shuriken
  function drawWindBlades(ctx, radius, time, alpha = 1) {
    const r = Math.max(12, radius) * 1.32;
    ctx.save();
    ctx.globalAlpha *= alpha;
    const rot = time * 17;
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, 0, 0, r * 1.2, '120,200,255', .3);
    ctx.globalCompositeOperation = 'source-over';
    // The blades smear into a spinning disc of wind, ringed by whistling arcs.
    Kit.spin(ctx, SPR.rsDisc(), 0, 0, r * 1.02, -time * 8, .6);
    Kit.spin(ctx, SPR.windRing(), 0, 0, r * 1.07, -time * 6, .6);
    // Motion blur: a fan of smeared wind behind each blade, ghost copies trailing the spin.
    const blades = SPR.blades();
    Kit.spin(ctx, SPR.bladeSmear(), 0, 0, r, rot, .9);
    Kit.spin(ctx, blades, 0, 0, r, rot - .26, .14);
    Kit.spin(ctx, blades, 0, 0, r, rot - .13, .3);
    Kit.spin(ctx, blades, 0, 0, r, rot, 1);
    // the high, ringing whine: a thin white circle traced by the blade tips
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(200,236,255,${.32 + .12 * Math.sin(time * 40)})`; ctx.lineWidth = Math.max(1, r * .012);
    ctx.beginPath(); ctx.arc(0, 0, r * .97, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawRasenShuriken(ctx, projectile, time) {
    const r = Math.max(16, projectile.r || 24);
    const alpha = Math.min(1, Math.max(0, projectile.life || 0) / .18);
    if (alpha <= 0) return;
    const age = Math.max(0, (projectile.maxLife || 1.5) - (projectile.life || 0));
    const grow = ease.outBack(age / .22);
    const rr = r * (.55 + .45 * grow);
    const ang = projectile.angle || 0;
    const gx = projectile.x, gy = projectile.y, H = lift() + 6 + rr * .15;
    // On the ground: shadow, chakra light and wind scouring a ring of grass.
    groundShadow(ctx, gx, gy, rr * 1.05, `rgba(10,30,60,${.22 * alpha})`);
    groundGlow(ctx, gx, gy, rr * 1.7, '90,170,255', .5 * alpha);
    ctx.save();
    ctx.globalAlpha = alpha;
    Kit.spin(ctx, SPR.windRing(), gx, gy, rr * 1.55, -time * 10, .6, .42);
    ctx.translate(gx, gy - H);
    // Wake: curved wind streaks peeling off behind the throw.
    ctx.save(); ctx.rotate(ang); ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1, ph = frac(time * 2.4 + hash(i + 4));
      const off = side * rr * (.3 + hash(i * 3 + 1) * .65), len = rr * (.45 + hash(i + 9) * .6) * (1 + ph * .4);
      const ex = -rr * .4 - len, ey = off * 1.5 + side * (.35 + ph * .6) * rr;
      ctx.strokeStyle = `rgba(36,116,228,${.32 * (1 - ph * .6)})`; ctx.lineWidth = Math.max(2, rr * .07);
      ctx.beginPath(); ctx.moveTo(-rr * .35, off * .7); ctx.quadraticCurveTo(-rr * .5 - len * .4, off * 1.35, ex, ey); ctx.stroke();
      ctx.strokeStyle = `rgba(240,252,255,${.65 * (1 - ph)})`; ctx.lineWidth = Math.max(1, rr * .028);
      ctx.beginPath(); ctx.moveTo(-rr * .35, off * .7); ctx.quadraticCurveTo(-rr * .5 - len * .4, off * 1.35, ex, ey); ctx.stroke();
    }
    ctx.restore();
    // The ringing whine: sonic rings pulsing out.
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const ph = frac(time * 2.6 + i * .5), k = rr * (1.3 + ph * 1.1);
      ctx.strokeStyle = `rgba(50,140,240,${(1 - ph) * .3})`; ctx.lineWidth = 3 * (1 - ph) + 1;
      ctx.beginPath(); ctx.ellipse(0, 0, k, k * .8, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(235,250,255,${(1 - ph) * .45})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, k, k * .8, 0, 0, TAU); ctx.stroke();
    }
    // Micro wind blades flung off the blade tips.
    ctx.strokeStyle = 'rgba(245,252,255,.85)'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ph = frac(time * 3.3 + hash(i * 1.7)), a = hash(i * 7.3 + Math.floor(time * 3.3 + hash(i * 1.7))) * TAU;
      const d = rr * 1.3 * (1 + ph * .9), l = rr * .16 * (1 - ph);
      const px = Math.cos(a) * d, py = Math.sin(a) * d * .8, tx = -Math.sin(a), ty = Math.cos(a) * .8;
      ctx.moveTo(px, py); ctx.lineTo(px + tx * l, py + ty * l);
    }
    ctx.stroke();
    ctx.scale(1, .8);
    drawWindBlades(ctx, rr, time);
    drawRasenganOrb(ctx, rr * .42, time);
    ctx.restore();
  }

  // Held Space / X. The Rasengan forms in the palm: chakra wisps converge into an unstable little
  // ball that steadies and grows. The Rasen Shuriken is raised overhead on a column of chakra and its
  // four blades unfurl as it charges. Wind sweeps round the feet; at full charge it rings and flares.
  function drawRasenCharge(ctx, state, time) {
    const charge = state.charge, player = state.player;
    if (!charge || !player) return;
    if (charge.kind === 'fire') { drawFireCharge(ctx, charge, player, time); return; }
    if (charge.kind === 'bijuu') { drawBijuuCharge(ctx, charge, player, time); return; }
    const ratio = clamp(charge.ratio || 0);
    const shuriken = charge.kind === 'shuriken';
    const radius = Math.max(9, (charge.radius || 16) * (shuriken ? .55 : .42));
    const angle = player.angle || 0;
    const hand = state.hand || { x: player.x + Math.cos(angle) * 16, y: player.y - 20 };
    const unfurl = .35 + .65 * ease.out(ratio / .7);
    const bladeR = radius * 1.6 * (.6 + ratio * .4) * unfurl;
    // Rasengan forms in the palm; the Rasen Shuriken is raised high above the head.
    const x = shuriken ? player.x : hand.x + Math.cos(angle) * radius * .9;
    const y = shuriken ? player.y - 72 - Math.max(radius * .8, bladeR * 1.32 * .82) : hand.y + Math.sin(angle) * radius * .5;
    const full = ratio >= .98;
    // Chakra pooling on the ground and wind sweeping round the caster's feet.
    groundGlow(ctx, player.x, player.y, 40 + ratio * 50, '80,170,255', .35 + ratio * .3);
    ctx.save();
    const gr = 30 + ratio * (shuriken ? 70 : 50);
    Kit.spin(ctx, SPR.gSpiralBlue(), player.x, player.y + 2, gr, -time * (5 + ratio * 6), .1 + ratio * .25, .42);
    Kit.spin(ctx, SPR.groundSpiral(), player.x, player.y + 2, gr * .96, -time * (5 + ratio * 6), .08 + ratio * .22, .42);
    if (ratio > .3) {
      // grit and leaves dragged round in the wind
      ctx.fillStyle = `rgba(92,78,56,${(ratio - .3) * .8})`;
      for (let i = 0; i < 9; i++) {
        const a = -time * (3 + ratio * 3) + i * TAU / 9, d = gr * (.75 + .25 * Math.sin(time * 3 + i * 1.7));
        const px = player.x + Math.cos(a) * d, py = player.y + Math.sin(a) * d * .42 - 3 - (i % 3) * 4, s = 1.6 + (i % 3);
        ctx.fillRect(px - s / 2, py - s / 2, s, s * .7);
      }
    }
    if (shuriken) {
      // the column of chakra from the raised palm up to the core
      const hx = player.x + (Math.cos(angle) >= 0 ? 3 : -3), hy = player.y - 54;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(40,120,230,${.3 + ratio * .2})`; ctx.lineWidth = 5 + ratio * 3;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(210,245,255,${.5 + ratio * .3})`; ctx.lineWidth = 1.6 + ratio;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x, y); ctx.stroke();
      Kit.glow(ctx, hx, hy, 12 + ratio * 8, '120,200,255', .7, true);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalCompositeOperation = 'lighter';
      Kit.glow(ctx, hand.x, hand.y, 12 + ratio * 10, '110,195,255', .6, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    ctx.save(); ctx.translate(x, y);
    // Chakra wisps spiralling inward as it grows.
    ctx.lineCap = 'round';
    const reach = shuriken ? Math.max(radius, bladeR * .9) : radius;
    for (let i = 0; i < 10; i++) {
      const ph = frac(time * (1.4 + ratio) + i / 10);
      const a = -time * 4 + i * TAU / 10 + ph * 1.6, far = reach * (1.2 + (1 - ph) * (1.7 - ratio * .4));
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * far, Math.sin(a) * far);
      ctx.quadraticCurveTo(Math.cos(a + .6) * far * .75, Math.sin(a + .6) * far * .75, Math.cos(a + 1.1) * reach * 1.05, Math.sin(a + 1.1) * reach * 1.05);
      ctx.strokeStyle = `rgba(40,124,236,${ph * .45})`; ctx.lineWidth = 2.6 + ratio * 1.8; ctx.stroke();
      ctx.strokeStyle = `rgba(236,250,255,${ph * .85})`; ctx.lineWidth = 1 + ratio; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    if (full) {
      const p = .5 + .5 * Math.sin(time * 14);
      const ringR = (shuriken ? bladeR * 1.32 * 1.12 : radius * 1.45) * (1 + p * .05);
      Kit.glow(ctx, 0, 0, ringR * 1.1, '150,220,255', .22 + p * .2, true);
      ctx.strokeStyle = `rgba(40,130,240,${.3 + p * .2})`; ctx.lineWidth = 4;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.ellipse(0, 0, ringR, ringR * (shuriken ? .82 : 1), 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(225,250,255,${.45 + p * .35})`; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(0, 0, ringR, ringR * (shuriken ? .82 : 1), 0, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // An unsteady, wobbling ball for the first instant of the charge.
    const wob = ratio < .3 ? 1 + Math.sin(time * 37) * .09 * (1 - ratio / .3) : 1;
    if (shuriken) {
      ctx.scale(1, .82);
      drawWindBlades(ctx, bladeR, time, Math.min(1, .25 + ratio * 1.5));
      drawRasenganOrb(ctx, radius * .7 * wob, time);
    } else drawRasenganOrb(ctx, radius * wob, time);
    ctx.restore();
  }

  // ================================================================ Bijūdama
  // Held G: black and white chakra orbs stream in from all around and compress into the Bijūdama
  // in front of Naruto, sucking dust off a cracking ground; at full charge it crackles and throbs.
  function drawBijuuCharge(ctx, charge, player, time) {
    const ratio = clamp(charge.ratio || 0), a = player.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
    const full = ratio >= .98, throb = full ? 1 + Math.sin(time * 22) * .06 : 1 + Math.sin(time * 9) * .03;
    const rr = (6 + ratio * 76) * throb, off = 34 + rr * 1.05, gx = player.x + ca * off, gy = player.y + sa * off;
    const x = gx, y = gy - lift() - 6 - ratio * 18;
    // the ground under the forming ball: violet pool, cracks spreading out, dust dragged inward
    groundGlow(ctx, gx, gy, 50 + ratio * 150, '150,50,255', .28 + ratio * .32);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(40,14,50,${.25 + ratio * .45})`; ctx.lineWidth = 1.5 + ratio * 2;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const an = i * TAU / 9 + hash(i * 3.3) * .5, len = (30 + ratio * 150) * (.6 + hash(i * 7.1) * .5);
      ctx.moveTo(gx + Math.cos(an) * 12, gy + Math.sin(an) * 6);
      ctx.lineTo(gx + Math.cos(an + .15) * len * .55, gy + Math.sin(an + .15) * len * .55 * .5);
      ctx.lineTo(gx + Math.cos(an) * len, gy + Math.sin(an) * len * .5);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(225,205,240,${.25 + ratio * .3})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const ph = frac(time * (1.2 + ratio) + hash(i * 1.9)), an = hash(i * 5.7) * TAU, far = 60 + ratio * 200;
      const d0 = far * (1 - ph), d1 = Math.max(10, d0 - 18 - ratio * 20);
      ctx.moveTo(gx + Math.cos(an) * d0, gy + Math.sin(an) * d0 * .5);
      ctx.lineTo(gx + Math.cos(an) * d1, gy + Math.sin(an) * d1 * .5);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    // pressure rings collapsing into the ball
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const ph = frac(time * (1.3 + ratio * 1.2) + k / 3), ringR = rr * (1.1 + (1 - ph) * (2.4 + ratio));
      ctx.strokeStyle = `rgba(200,130,255,${ph * (.25 + ratio * .4)})`; ctx.lineWidth = 1 + ph * 3;
      ctx.beginPath(); ctx.ellipse(x, y, ringR, ringR * .82, 0, 0, TAU); ctx.stroke();
    }
    Kit.glow(ctx, x, y, rr * 2.8 + 20, '150,40,255', .45 + ratio * .35);
    // black (positive) and white (negative) chakra orbs spiralling in, each with a violet streak
    for (let i = 0; i < 26; i++) {
      const ph = frac(time * (.8 + ratio * .9) + hash(i * 2.7)), spin = hash(i * 9.1) * TAU + ph * 2.4;
      const far = rr + 34 + (110 + ratio * 120) * (1 - ph);
      const px = x + Math.cos(spin) * far, py = y + Math.sin(spin) * far * .7;
      const qx = x + Math.cos(spin - .25) * (far + 22), qy = y + Math.sin(spin - .25) * (far + 22) * .7;
      const al = Math.min(1, ph * 2.2) * (1 - ph * ph * .4);
      ctx.strokeStyle = `rgba(180,90,255,${al * .5})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
      const sz = 2.5 + hash(i * 4.4) * 3 + ratio * 2.5;
      if (i % 2) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(14,4,20,${al})`; }
      else { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(250,240,255,${al})`; }
      ctx.beginPath(); ctx.arc(px, py, sz, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
    }
    ctx.globalCompositeOperation = 'source-over';
    // the ball itself
    if (rr > 3) {
      ctx.drawImage(SPR.beastSphere(), x - rr, y - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'lighter';
      Kit.spin(ctx, SPR.beastSwirl(), x, y, rr * .95, time * (6 + ratio * 6), .6 + ratio * .3);
      Kit.spin(ctx, SPR.beastSwirl(), x, y, rr * .65, -time * (9 + ratio * 8), .4);
      ctx.strokeStyle = `rgba(240,190,255,${.6 + ratio * .35})`; ctx.lineWidth = 1.5 + ratio * 2;
      ctx.beginPath(); ctx.arc(x, y, rr * 1.02, 0, TAU); ctx.stroke();
    }
    // full power: violet arcs crackle round the ball and it flashes in rhythm
    if (full) {
      const fl = .5 + .5 * Math.sin(time * 22);
      Kit.glow(ctx, x, y, rr * 1.9, '190,90,255', .3 + fl * .3);
      Kit.glow(ctx, x - rr * .3, y - rr * .35, rr * .5, '255,210,255', .25 + fl * .25, true);
      ctx.strokeStyle = 'rgba(230,170,255,.9)'; ctx.lineWidth = 1.6;
      const tick = Math.floor(time * 18);
      ctx.beginPath();
      for (let b = 0; b < 4; b++) {
        let an = hash(tick * 3.1 + b * 7.7) * TAU, d = rr * 1.05;
        ctx.moveTo(x + Math.cos(an) * d, y + Math.sin(an) * d);
        for (let j = 0; j < 4; j++) {
          an += (hash(tick + b * 5 + j * 1.3) - .5) * .9; d += rr * (.18 + hash(tick * 2 + b + j) * .2);
          ctx.lineTo(x + Math.cos(an) * d, y + Math.sin(an) * d);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBeastBomb(ctx, bomb, time) {
    const age = Math.max(0, (bomb.maxLife || 1.5) - (bomb.life || 0));
    const r = (bomb.r || 27) * 1.15 * (.5 + .5 * ease.outBack(age / .2));
    const pulse = 1 + Math.sin(time * 18) * .05;
    const ang = Number.isFinite(bomb.angle) ? bomb.angle : Math.atan2(bomb.vy || 0, bomb.vx || 1);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    groundShadow(ctx, bomb.x, bomb.y, r, 'rgba(40,6,50,.32)');
    groundGlow(ctx, bomb.x, bomb.y, r * 2, '170,60,255', .35);
    const x = bomb.x, y = bomb.y - lift() - 4;
    ctx.save();
    // Dark chakra wake.
    const vio = Kit.puff('violet');
    for (let i = 5; i >= 1; i--) {
      const u = (i + frac(time * 6)) / 6, d = r * (.4 + u * 3);
      Kit.stamp(ctx, vio, x - ca * d, y - sa * d, r * (.85 - u * .5), (1 - u) * .7);
    }
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, x, y, r * 2.6 * pulse, '150,40,255', .55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(SPR.beastSphere(), x - r * pulse, y - r * pulse, r * 2 * pulse, r * 2 * pulse);
    ctx.globalCompositeOperation = 'lighter';
    Kit.spin(ctx, SPR.beastSwirl(), x, y, r * .95 * pulse, time * 7, .75);
    Kit.spin(ctx, SPR.beastSwirl(), x, y, r * .7 * pulse, -time * 11, .45);
    // Compression ring and orbiting motes.
    ctx.strokeStyle = 'rgba(235,170,255,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * pulse * 1.04, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#f0c8ff';
    for (let i = 0; i < 6; i++) {
      const a = time * (4 + i * .4) + i * TAU / 6, rr = r * (1.25 + (i % 3) * .15);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .55, 1.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ================================================================ impacts
  function shockRing(ctx, x, y, radius, progress, alpha, rgb) {
    const r = radius * (.15 + ease.out(progress) * .95);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
    // a multiplied under-stroke tints the ground first, so the additive ring keeps its hue on grass
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = `rgba(${rgb},${alpha * .45})`; ctx.lineWidth = 12 * alpha + 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${rgb},${alpha * .7})`; ctx.lineWidth = 10 * alpha + 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * .55})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * .86, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function debris(ctx, x, y, radius, age, seed, color, n = 8) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const t = clamp(age * 1.25 - hash(i * 2.1 + seed) * .12), a = hash(i * 3.7 + seed) * TAU;
      if (t <= 0 || t >= 1) continue;
      const d = radius * (.15 + .9 * ease.out(t)), h = Math.sin(Math.PI * t) * radius * (.3 + hash(i + seed) * .35);
      const s = 2.5 + hash(i * 5.5 + seed) * 4.5, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .5 - h;
      const rot = t * 9 + i, c = Math.cos(rot) * s, sn = Math.sin(rot) * s;
      ctx.globalAlpha = 1 - t * t;
      ctx.beginPath(); ctx.moveTo(px + c, py + sn); ctx.lineTo(px - sn * .7, py + c * .7); ctx.lineTo(px - c * .8, py - sn * .8); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Katon impact: blinding flash, a boiling fireball ringed with dark smoke over a scorch mark,
  // flame tongues licking up, debris and sparks, then a smoke column rising as the fire dies.
  function fireBlast(ctx, x, y, radius, age, alpha, time, seed) {
    const e = ease.out(age * 1.8);
    const cy = y - radius * (.15 + e * .25);
    // scorched ground
    const sc = .3 + e * .7;
    ctx.fillStyle = `rgba(44,18,8,${.36 * Math.min(1, alpha * 1.6)})`;
    ctx.beginPath(); ctx.ellipse(x, y, radius * .72 * sc, radius * .33 * sc, 0, 0, TAU); ctx.fill();
    // flash
    ctx.globalCompositeOperation = 'lighter';
    if (age < .2) Kit.glow(ctx, x, cy, radius * (.7 + age * 3), '255,220,150', 1 - age / .2, true);
    Kit.glow(ctx, x, y, radius * 1.3, '255,110,30', alpha * .5, false, .45);
    ctx.globalCompositeOperation = 'source-over';
    // ground dust/smoke ring rolling outward
    const smoke = Kit.puff('smoke');
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + hash(i + seed) * .5, d = radius * (.3 + e * .75);
      Kit.stamp(ctx, smoke, x + Math.cos(a) * d, y + Math.sin(a) * d * .45 - 6, radius * (.12 + e * .14), alpha * .5 * e);
    }
    // rising smoke column (second half)
    if (age > .25) {
      const s = (age - .25) / .75;
      for (let i = 0; i < 6; i++) {
        const a = hash(i * 2.9 + seed) * TAU, d = radius * .3 * hash(i * 4.1 + seed);
        Kit.stamp(ctx, smoke, x + Math.cos(a) * d, cy - radius * (.15 + s * .6) - i * radius * .06, radius * (.22 + s * .25), Kit.ease.bell(s) * .75);
      }
    }
    // dark smoke boiling round the fireball's rim gives it the anime's sooty silhouette
    if (age > .04) {
      const k = Math.min(1, (age - .04) / .16) * (1 - ease.smooth((age - .45) / .55));
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9 + hash(i * 1.3 + seed) * .6, d = radius * (.34 + .16 * hash(i * 2.9 + seed)) * e;
        const px = x + Math.cos(a) * d, py = cy + Math.sin(a) * d * .7 - age * radius * .4 - radius * .08;
        Kit.stamp(ctx, smoke, px, py, radius * (.2 + .1 * hash(i * 3.7 + seed)) * (.6 + e * .6), k * .65);
      }
    }
    const fire = Kit.puff('fire'), ember = Kit.puff('ember');
    const fade = 1 - ease.smooth((age - .35) / .65);
    // flame tongues licking up around the blast
    const m = ctx.getTransform(), ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * fade;
    for (let i = 0; i < 8; i++) {
      const a = hash(i * 7.3 + seed) * TAU, d = radius * (.2 + .5 * hash(i * 3.3 + seed)) * e;
      const h = radius * (.7 + hash(i + seed) * .45) * (1 - age * .6) * (1 + Math.sin(time * 13 + i) * .1);
      if (h < 4) continue;
      Kit.flameAt(ctx, m, Kit.flame(i), x + Math.cos(a) * d, y + Math.sin(a) * d * .5, h * .6, h, Math.cos(a) * -.35 + Math.sin(time * 5 + i) * .15);
    }
    ctx.setTransform(m); ctx.globalAlpha = ga;
    // the fireball: overlapping billows boiling outward and upward
    for (let i = 0; i < 11; i++) {
      const a = hash(i * 1.9 + seed) * TAU, d = radius * (.12 + hash(i * 6.1 + seed) * .45) * e;
      const px = x + Math.cos(a) * d, py = cy + Math.sin(a) * d * .65 - age * radius * .35;
      const sz = radius * (.3 + hash(i * 2.2 + seed) * .18) * (.45 + e * .8) * (1 - age * .4);
      Kit.stamp(ctx, age > .4 + hash(i) * .15 ? ember : fire, px, py, sz, fade);
    }
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, x, cy, radius * .9, '255,150,50', alpha * .55);
    if (age < .3) Kit.glow(ctx, x, cy - age * radius * .3, radius * .45, '255,240,200', (1 - age / .3) * .9, true);
    ctx.globalCompositeOperation = 'source-over';
    debris(ctx, x, y, radius, age, seed, '#3a2a22');
    // ember sparks
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffd36a';
    for (let i = 0; i < 12; i++) {
      const a = hash(i * 8.1 + seed) * TAU, d = radius * (.2 + ease.out(age * 1.3) * (.6 + hash(i + seed) * .5));
      const px = x + Math.cos(a) * d, py = cy + Math.sin(a) * d * .6 - age * age * radius * .4;
      ctx.globalAlpha = (1 - age) * .9; ctx.fillRect(px - 1.2, py - 1.2, 2.4, 2.4);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // Countless micro wind blades whirling through a sphere (Rasen Shuriken detonation). Points sit
  // on nested shells and orbit the vertical axis; far ones are dim, near ones get a blue under-edge.
  function microBlades(ctx, x, cy, dr, sq, time, alpha, n) {
    const pass = front => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const z = hash(i * 1.31) * 2 - 1, rad = Math.sqrt(1 - z * z), shell = .3 + .7 * Math.sqrt(hash(i * 2.17));
        const lon = hash(i * 3.7) * TAU + time * (3 + hash(i * 4.3) * 3.5);
        const cl = Math.cos(lon), sl = Math.sin(lon), depth = rad * sl;
        if ((depth <= 0) !== front) continue;
        const sx = x + rad * cl * shell * dr, sy = cy + z * shell * dr * sq * .9 - depth * shell * dr * .22;
        const tx = -sl, ty = -cl * .22, L = dr * (.07 + hash(i * 5.9) * .09) * (.5 + .5 * rad);
        ctx.moveTo(sx - tx * L, sy - ty * L);
        ctx.quadraticCurveTo(sx - ty * L * .5, sy + tx * L * .5, sx + tx * L, sy + ty * L);
      }
    };
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    pass(false);
    ctx.strokeStyle = `rgba(150,215,255,${alpha * .45})`; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    pass(true);
    ctx.strokeStyle = `rgba(30,104,220,${alpha * .55})`; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = `rgba(250,254,255,${alpha})`; ctx.lineWidth = 1.6; ctx.stroke();
  }
  // The anime's countless microscopic needles: dark hair-thin slashes shredding everything inside
  // the dome, re-scattered several times a second so the interior seethes.
  function needleField(ctx, x, cy, dr, sq, time, alpha, n) {
    const tick = Math.floor(time * 20);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const h1 = hash(i * 1.71 + tick * .37), h2 = hash(i * 2.93 + tick * .61), h3 = hash(i * 4.07 + tick * .13);
      const rr = Math.sqrt(h1) * .96, a = h2 * TAU;
      const px = x + Math.cos(a) * rr * dr, py = cy + Math.sin(a) * rr * dr * sq;
      const t = a + 1.4 + (h3 - .5) * .9, L = dr * (.035 + h3 * .06);
      ctx.moveTo(px - Math.cos(t) * L, py - Math.sin(t) * L * sq); ctx.lineTo(px + Math.cos(t) * L, py + Math.sin(t) * L * sq);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(14,34,84,${alpha * .75})`; ctx.lineWidth = 1.3; ctx.stroke();
  }

  // Wind dome: Rasengan burst ('vortex') or Rasen Shuriken detonation ('shuriken', needles = true).
  // A translucent blue bubble of wind (normal blending, so it reads on grass) with spiral streaks;
  // the Shuriken's version is packed with micro blades, holds, then collapses in on itself and
  // leaves slash marks in the ground.
  function windDome(ctx, x, y, radius, age, alpha, time, needles) {
    const e = ease.out(age * 1.6);
    let dr = radius * (.3 + e * .75);
    if (needles && age > .55) dr *= 1 - ease.in((age - .55) / .45) * .6;
    const sq = .82, cy = y - dr * .3, seed = radius * .37;
    // shade and scars under the dome
    ctx.fillStyle = `rgba(16,36,70,${.2 * alpha})`;
    ctx.beginPath(); ctx.ellipse(x, y, dr * .98, dr * .44, 0, 0, TAU); ctx.fill();
    if (needles) {
      const reach = radius * (.3 + e * .75), ga = Math.min(1, alpha * 1.6);
      ctx.strokeStyle = `rgba(26,24,30,${.42 * ga})`; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const a = hash(i * 2.3 + seed) * TAU, d = reach * (.3 + hash(i * 4.9 + seed) * .7), l = reach * (.08 + hash(i * 6.1) * .1), b = a + 1.4;
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .45;
        ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(b) * l, py + Math.sin(b) * l * .45);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    // detonation flash: small and white-hot, so only the heart of the blast clips
    if (age < .16) Kit.glow(ctx, x, cy, Math.min(150, radius * (.45 + age * 2.4)), '170,225,255', 1 - age / .16, true);
    Kit.glow(ctx, x, cy, dr * 1.15, '90,170,255', alpha * .28, false, sq);
    ctx.globalCompositeOperation = 'source-over';
    // the Shuriken's sphere is a pale, dense ball of wind; the Rasengan's a clearer bubble
    if (needles) Kit.stamp(ctx, SPR.shurikenDome(), x, cy, dr, alpha, sq);
    Kit.stamp(ctx, SPR.windSphere(), x, cy, dr, alpha * (needles ? .7 : .85), sq);
    Kit.spin(ctx, SPR.rasSwirlC(), x, cy, dr * .92, time * 5, alpha * (needles ? .3 : .5), sq);
    // white spiral streaks and whistling arcs in normal blending stay white on grass
    Kit.spin(ctx, SPR.rasSwirlA(), x, cy, dr * .95, time * 5, alpha * (needles ? .3 : .45), sq);
    Kit.spin(ctx, SPR.windRing(), x, cy, dr * 1.02, -time * 9, alpha * .8, sq);
    if (needles) needleField(ctx, x, cy, dr, sq, time, alpha * Math.min(1, age * 8), 260);
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, x, cy, dr * .55, '110,190,255', alpha * (needles ? .55 : .45), false, sq);
    Kit.glow(ctx, x, cy, Math.min(70, dr * .28), '200,240,255', alpha * .8, true);
    if (needles) microBlades(ctx, x, cy, dr, sq, time, alpha, 150);
    // collapse: wind streaks sucked back into the centre as the sphere implodes
    if (needles && age > .5) {
      const k = (age - .5) / .5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i * TAU / 16 + hash(i * 3.3 + seed) * .3, ph = frac(time * 3 + hash(i * 1.1 + seed));
        const d0 = dr * (1.25 - ph * .9), d1 = d0 + dr * .22;
        ctx.moveTo(x + Math.cos(a) * d0, cy + Math.sin(a) * d0 * sq); ctx.lineTo(x + Math.cos(a) * d1, cy + Math.sin(a) * d1 * sq);
      }
      ctx.strokeStyle = `rgba(200,238,255,${Kit.ease.bell(k) * .8})`; ctx.lineWidth = 1.6; ctx.stroke();
    }
    // rim: blue edge with a white glint
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(40,120,230,${alpha * .7})`; ctx.lineWidth = 3 * alpha + 1.5;
    ctx.beginPath(); ctx.ellipse(x, cy, dr, dr * sq, 0, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,255,255,${alpha * .65})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(x, cy, dr * .93, dr * .76, 0, -2.6, -.9); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  // Bijūdama detonation: a blinding flash, a dome of violet light swelling over a scorched crater,
  // ground shock rings, a collapsing black core, then dark smoke boiling up into a mushroom.
  function beastBlast(ctx, x, y, radius, age, alpha, time, seed) {
    const e = ease.out(age * 1.6), dr = radius * (.18 + e * .86), domeY = y - dr * .22;
    // scorched crater and ground shock rings (in ground perspective)
    ctx.fillStyle = `rgba(28,8,38,${.42 * alpha})`;
    ctx.beginPath(); ctx.ellipse(x, y, dr * .9, dr * .45, 0, 0, TAU); ctx.fill();
    shockRing(ctx, x, y, radius * 1.2, age * 1.25, alpha, '205,130,255');
    if (age > .12) shockRing(ctx, x, y, radius * 1.45, (age - .12) * 1.1, alpha * .7, '255,220,255');
    // the dome: a solid hemisphere of violet chakra light, white-hot at the top-left, thinning as it spreads
    const domeA = alpha * (age < .35 ? 1 : Math.max(0, 1 - (age - .35) / .45)), dh = dr * .92;
    if (domeA > .02) {
      const gr = ctx.createRadialGradient(x - dr * .28, y - dh * .62, dr * .05, x, y - dh * .3, dr * 1.15);
      gr.addColorStop(0, `rgba(255,240,255,${domeA})`);
      gr.addColorStop(.3, `rgba(220,140,255,${domeA * .9})`);
      gr.addColorStop(.75, `rgba(110,35,185,${domeA * .8})`);
      gr.addColorStop(1, `rgba(45,8,85,${domeA * .7})`);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(x, y, dr, dh, 0, Math.PI, TAU); ctx.ellipse(x, y, dr, dr * .45, 0, 0, Math.PI); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      Kit.spin(ctx, SPR.beastSwirl(), x, y - dh * .45, dr * .7, time * 5, domeA * .3, .8);
      Kit.glow(ctx, x - dr * .25, y - dh * .6, dr * .55, '255,210,255', domeA * .5, true);
      ctx.strokeStyle = `rgba(250,210,255,${domeA})`; ctx.lineWidth = 3 + 3 * domeA;
      ctx.beginPath(); ctx.ellipse(x, y, dr, dh, 0, Math.PI, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // halo and streaks of light flying off the dome
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, x, y - dh * .4, dr * 1.5, '170,70,255', alpha * .45, false, .8);
    ctx.strokeStyle = `rgba(255,215,250,${alpha * .75})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const an = Math.PI + (i + .5) / 18 * Math.PI + (hash(i + seed) - .5) * .15;
      const r1 = 1.02 + hash(i * 2 + seed) * .08, r2 = 1.2 + hash(i * 3 + seed) * .45;
      ctx.moveTo(x + Math.cos(an) * dr * r1, y + Math.sin(an) * dh * r1); ctx.lineTo(x + Math.cos(an) * dr * r2, y + Math.sin(an) * dh * r2);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // the compressed black core collapsing in the first instant
    if (age < .3) {
      const k = age / .3, cr = radius * .22 * (1 - ease.in(k));
      if (cr > 2) {
        ctx.drawImage(SPR.beastSphere(), x - cr, y - dh * .45 - cr, cr * 2, cr * 2);
        ctx.globalCompositeOperation = 'lighter';
        Kit.spin(ctx, SPR.beastSwirl(), x, y - dh * .45, cr * .9, time * 14, .7);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // dark smoke boiling up into a mushroom late in the blast
    if (age > .25) {
      const sm = (age - .25) / .75, vio = Kit.puff('violet'), smoke = Kit.puff('smoke');
      for (let i = 0; i < 14; i++) {
        const a = hash(i * 1.7 + seed) * TAU, d = dr * (.3 + hash(i * 3.9 + seed) * .65);
        Kit.stamp(ctx, i % 3 ? vio : smoke, x + Math.cos(a) * d, y + Math.sin(a) * d * .45 - sm * radius * (.1 + hash(i) * .15),
          radius * (.13 + sm * .12 + hash(i * 2) * .05), Kit.ease.bell(sm) * .45);
      }
      // the stem and cap
      for (let i = 0; i < 7; i++) {
        const h = radius * (.15 + sm * .55) * (i / 6), w = radius * (.08 + sm * .05) * (1 + (i === 6 ? 1.6 : 0));
        Kit.stamp(ctx, i > 4 ? smoke : vio, x + Math.sin(time * 2 + i) * 6, domeY - h, w * (1 + hash(i * 3 + seed) * .4), Kit.ease.bell(sm) * (.35 + i * .05));
      }
    }
    debris(ctx, x, y, radius, age, seed, '#2a1830', 14);
  }

  // Lightning burst: a white flash, bolts lashing out and striking the ground (blue body in
  // normal blending, then lit), a scorch star burned into the ground and sparks flying off.
  function lightningBlast(ctx, x, y, radius, age, alpha, time, seed) {
    const cy = y - 14;
    const reach = radius * (.45 + ease.out(age * 2.2) * .65);
    const ga = Math.min(1, alpha * 1.5), grow = ease.out(age * 4);
    ctx.fillStyle = `rgba(18,20,34,${.28 * ga})`;
    ctx.beginPath(); ctx.ellipse(x, y, radius * .42 * grow, radius * .19 * grow, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(18,20,34,${.42 * ga})`; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = hash(i * 2.9 + seed) * TAU, l = radius * (.55 + hash(i * 4.7 + seed) * .6) * grow, b = a + (hash(i * 6.1) - .5) * .7;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(b) * l * .5, y + Math.sin(b) * l * .25);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * .5);
    }
    ctx.stroke();
    const bolts = (o) => {
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7 + hash(i + seed) * .5 + Kit.wobble(seed + i, time, 3) * .6;
        const ex = x + Math.cos(a) * reach, ey = i % 2 ? cy + Math.sin(a) * reach * .6 : y + Math.sin(a) * reach * .5;
        Kit.forkedBolt(ctx, x, cy, ex, ey, seed + i * 11, time, o);
      }
    };
    bolts({ jitter: 8, alpha, width: 1.5, pal: BLUE_PAL, base: `rgba(16,58,190,${.6 * alpha})`, forkBase: true, step: 12, forks: 1, forkLen: 14, rate: 22, snap: true });
    ctx.globalCompositeOperation = 'lighter';
    if (age < .16) Kit.glow(ctx, x, cy, Math.min(150, radius * 1.15), '170,220,255', 1 - age / .16, true);
    Kit.glow(ctx, x, cy, radius * (.8 + (1 - alpha) * .4), '80,170,255', alpha * .7, true);
    Kit.glow(ctx, x, y, radius * .9, '80,170,255', alpha * .45, false, .42);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const a = hash(i * 3.7 + seed) * TAU, d = radius * (.25 + ease.out(age * 1.6) * (.6 + hash(i * 1.9 + seed) * .6));
      const px = x + Math.cos(a) * d, py = cy + Math.sin(a) * d * .6 + age * age * 30, l = 6 * (1 - age) + 2;
      ctx.strokeStyle = `rgba(210,240,255,${(1 - age) * .9})`;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(a) * l, py - Math.sin(a) * l * .6); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Shadow-clone poof: speed lines and a dust ring burst out, a white cartoon cloud billows up,
  // then its puffs drift apart and shrink away. While fading, the cloud is composited through a
  // scratch buffer so overlapping puffs fade as one shape instead of showing their seams.
  const poofBuf = { c: null, g: null, size: 384 };
  // The cloud is cel-shaded like the anime's: every lobe is a plain circle, all lobes are filled
  // as one silhouette (so the ink outline runs round the whole cloud, not round each puff), then a
  // blue-grey shade, then a lighter lit side offset up-left, then curl strokes.
  const POOF = { x: new Float32Array(14), y: new Float32Array(14), r: new Float32Array(14) };
  function poofLobes(g, n, grow, dx, dy, k) {
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const r = POOF.r[i] * k + grow, x = POOF.x[i] + dx * POOF.r[i], y = POOF.y[i] + dy * POOF.r[i];
      if (r <= .3) continue;
      g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
    }
    g.fill();
  }
  function poofCloud(g, x, cy, R, p, shrink, drift) {
    let n = 0;
    const lobe = (lx, ly, lr) => { POOF.x[n] = lx; POOF.y[n] = ly; POOF.r[n] = lr; n++; };
    for (let i = 0; i < 10; i++) {
      const ang = i * TAU / 10 + hash(i * 1.3) * .4 + p * .7;
      const d = R * (.5 + hash(i + 3) * .3) + drift * (.8 + hash(i * 2.2) * .5);
      lobe(x + Math.cos(ang) * d, cy + Math.sin(ang) * d * .62 - drift * .3, R * (.4 + hash(i + 7) * .2) * shrink);
    }
    lobe(x, cy - R * .1 - drift * .2, R * .62 * shrink);
    lobe(x - R * .22, cy - R * .5 - drift * .5, R * .42 * shrink);
    lobe(x + R * .25, cy - R * .42 - drift * .45, R * .38 * shrink);
    const ow = Math.max(1.4, R * .045);
    g.fillStyle = '#6f7d9c'; poofLobes(g, n, ow, 0, 0, 1);
    g.fillStyle = '#bcc6da'; poofLobes(g, n, 0, 0, 0, 1);
    g.fillStyle = '#dde3ee'; poofLobes(g, n, 0, -.1, -.14, .84);
    g.fillStyle = '#f1f4f9'; poofLobes(g, n, 0, -.22, -.3, .5);
    // curls
    g.strokeStyle = 'rgba(111,125,156,.8)'; g.lineWidth = Math.max(1, R * .03); g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const j = (i * 3 + 1) % n, r = POOF.r[j] * .55, ang = 1.2 + i * 1.7 - p * 3;
      const cx = POOF.x[j] + POOF.r[j] * .15, cyy = POOF.y[j] + POOF.r[j] * .2;
      g.moveTo(cx + Math.cos(ang) * r, cyy + Math.sin(ang) * r); g.arc(cx, cyy, r, ang, ang + 2.1);
    }
    g.stroke();
  }
  function smokePoof(ctx, x, y, radius, p) {
    p = clamp(p);
    const e = ease.out(p * 1.7);
    const R = radius * .55 * (.55 + e * .75), cy = y - 16 - R * .3 - p * R * .3;
    const a = p < .55 ? 1 : 1 - ease.smooth((p - .55) / .45);
    const shrink = 1 - ease.in((p - .45) / .55) * .45;
    const drift = ease.in((p - .4) / .6) * R * .45;
    // burst: radial speed lines and a dust ring on the ground
    if (p < .4) {
      const k = 1 - p / .4, reach = R * (1.1 + e * .9);
      ctx.strokeStyle = `rgba(120,132,160,${k * .5})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(x, y, reach, reach * .42, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${k * .9})`; ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const an = i * TAU / 10 + hash(i * 4.1) * .3, c = Math.cos(an), s = Math.sin(an) * .7;
        const r0 = reach * (.75 + hash(i) * .2), r1 = r0 + R * (.25 + hash(i * 2.7) * .3) * k;
        ctx.moveTo(x + c * r0, cy + s * r0); ctx.lineTo(x + c * r1, cy + s * r1);
      }
      ctx.stroke();
    }
    // little puffs spat out of the cloud as it bursts
    if (p < .5) {
      const k = 1 - p / .5, out = ease.out(p / .5);
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? '#dfe5ef' : '#6f7d9c';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const an = i * TAU / 6 + hash(i * 6.1) * .6, d = R * (.7 + out * (.9 + hash(i) * .5));
          const r = R * (.12 + hash(i * 1.7) * .08) * k + (pass ? 0 : 1.3);
          if (r <= .3) continue;
          const px = x + Math.cos(an) * d, py = cy + Math.sin(an) * d * .62 - out * R * .2;
          ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
        }
        ctx.fill();
      }
    }
    if (a >= .995) poofCloud(ctx, x, cy, R, p, shrink, drift);
    else if (a > .004) {
      const ext = R * 1.4 + drift * 1.4, size = poofBuf.size;
      if (!poofBuf.c) { poofBuf.c = document.createElement('canvas'); poofBuf.c.width = poofBuf.c.height = size; poofBuf.g = poofBuf.c.getContext('2d'); }
      const g = poofBuf.g, k = size / (ext * 2);
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, size, size);
      g.setTransform(k, 0, 0, k, size / 2, size / 2);
      poofCloud(g, 0, 0, R, p, shrink, drift);
      const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
      ctx.drawImage(poofBuf.c, x - ext, cy - ext, ext * 2, ext * 2);
      ctx.globalAlpha = ga;
    }
  }

  function drawExplosion(ctx, explosion, time) {
    const alpha = remaining(explosion);
    if (alpha <= 0) return;
    const kind = explosion.kind || 'smoke';
    const radius = Math.max(8, explosion.radius || 40), age = 1 - alpha;
    const x = explosion.x, y = explosion.y, seed = (x * .37 + y * .11) % 97;
    ctx.save();
    if (kind === 'smoke') { smokePoof(ctx, x, y, radius, age); ctx.restore(); return; }
    const ringColor = kind === 'fire' ? '255,120,40' : kind === 'beast' ? '190,90,255' : kind === 'lightning' ? '110,200,255' : '110,190,255';
    shockRing(ctx, x, y, radius, age, alpha, ringColor);
    if (kind === 'fire') fireBlast(ctx, x, y, radius, age, alpha, time, seed);
    else if (kind === 'shuriken' || kind === 'vortex') windDome(ctx, x, y, radius, age, alpha, time, kind === 'shuriken');
    else if (kind === 'beast') beastBlast(ctx, x, y, radius, age, alpha, time, seed);
    else if (kind === 'lightning') lightningBlast(ctx, x, y, radius, age, alpha, time, seed);
    ctx.restore();
  }

  // ================================================================ Katon: Gōka Mekkyaku (Madara's sea of fire)
  // Charging: Naruto holds the tiger seal while fire swells in front of his hands — embers stream
  // in, small tongues orbit the growing ball, smoke curls off it and the ground smoulders.
  function drawFireCharge(ctx, charge, player, time) {
    const ratio = clamp(charge.ratio || 0), a = player.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
    const r = 5 + ratio * 15;
    const x = player.x + ca * (11 + r * .7), y = player.y - 27 + sa * (3 + r * .3) - ratio * 4;
    const full = ratio >= .98;
    groundGlow(ctx, player.x, player.y, 40 + ratio * 60, '255,120,30', .3 + ratio * .4);
    ctx.save();
    // the ground smoulders: a ring of little flames licking up round the feet
    if (ratio > .2) {
      const m = ctx.getTransform(), k = (ratio - .2) / .8, ga = ctx.globalAlpha;
      ctx.globalAlpha = ga * Math.min(1, k * 2);
      for (let i = 0; i < 7; i++) {
        const an = i * TAU / 7 + .3, d = 24 + ratio * 22, h = (10 + ratio * 24) * (.7 + hash(i * 3.1) * .5) * (1 + Math.sin(time * 12 + i * 2) * .14);
        Kit.flameAt(ctx, m, Kit.flame(i), player.x + Math.cos(an) * d, player.y + 2 + Math.sin(an) * d * .42, h * .6, h, Math.sin(time * 4 + i) * .2);
      }
      ctx.setTransform(m); ctx.globalAlpha = ga;
    }
    // the sealing hands glow behind the ball
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, player.x + ca * 6, player.y - 24, 10 + ratio * 9, '255,150,60', .55 + ratio * .3, true);
    ctx.translate(x, y);
    Kit.glow(ctx, 0, 0, r * 3, '255,120,30', .8);
    // embers streaking inward from all around: a red-orange body (normal blending keeps the hue on
    // grass) with a hot yellow head
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const ph = frac(time * (1.2 + ratio) + i / 14), ang = i * 2.4 + time * .7, far = (1 - ph) * (44 + ratio * 60) + r;
      const nx = Math.cos(ang), ny = Math.sin(ang) * .7, l = 8 + ratio * 6;
      ctx.strokeStyle = `rgba(${i % 3 ? '232,72,16' : '255,128,24'},${.9 * ph})`; ctx.lineWidth = 1.6 + ratio * 1.4;
      ctx.beginPath(); ctx.moveTo(nx * far, ny * far); ctx.lineTo(nx * (far + l), ny * (far + l)); ctx.stroke();
      ctx.fillStyle = `rgba(255,214,110,${ph})`;
      ctx.fillRect(nx * far - 1, ny * far - 1, 2, 2);
    }
    // heat ripple contracting into the ball
    const hp = frac(time * 1.6), hr = r * (1.4 + (1 - hp) * 2.2);
    ctx.strokeStyle = `rgba(214,70,16,${hp * .35})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, hr, hr * .8, 0, 0, TAU); ctx.stroke();
    // smoke curling up off the ball
    if (ratio > .25) {
      const smoke = Kit.puff('smoke');
      for (let i = 0; i < 3; i++) {
        const ph = frac(time * .9 + i / 3);
        Kit.stamp(ctx, smoke, Math.sin(time * 2 + i * 2) * r * .4, -r * .6 - ph * (26 + ratio * 26), r * (.35 + ph * .5), Math.sin(Math.PI * ph) * (ratio - .25) * .55);
      }
    }
    // small tongues orbiting the ball, pointing outward
    for (let k = 0; k < 5; k++) {
      const an = k * TAU / 5 + time * 5, h = r * (1 + ratio * .5) * (1 + Math.sin(time * 15 + k * 2) * .15);
      ctx.save(); ctx.rotate(an); ctx.translate(0, -r * .55);
      ctx.drawImage(Kit.flame(k + 1), -r * .35, -h * .89, r * .7, h);
      ctx.restore();
    }
    ctx.rotate(a);
    // flame tongues spilling forward toward the target
    for (let k = 0; k < 3; k++) {
      ctx.save(); ctx.rotate(Math.PI / 2 + (k - 1) * .45 + Math.sin(time * 12 + k) * .12);
      const h = r * (2 + k % 2 * .5) * (1 + Math.sin(time * 15 + k * 2) * .12);
      ctx.drawImage(Kit.flame(k + 3), -r * .55, -h * .9 + r * .2, r * 1.1, h);
      ctx.restore();
    }
    ctx.fillStyle = '#86160a'; blob(ctx, r * 1.06, time, .12, 14, 1); ctx.fill();
    ctx.fillStyle = '#d42a10'; blob(ctx, r, time * 1.1, .12, 14, 2); ctx.fill();
    ctx.fillStyle = '#ff7a1a'; blob(ctx, r * .72, time * 1.4, .1, 12, 4); ctx.fill();
    ctx.fillStyle = '#ffe07a'; blob(ctx, r * .42, time * 1.8, .08, 10, 6); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    Kit.glow(ctx, 0, 0, r * 1.2, '255,210,120', .8, true);
    if (full) {
      const p = .5 + .5 * Math.sin(time * 14);
      Kit.glow(ctx, 0, 0, r * 2.2, '255,150,60', .25 + p * .25);
      const rr = r * 1.9 * (1 + p * .06);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(200,50,12,${.4 + p * .3})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,190,90,${.5 + p * .3})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- sea-of-fire sprites
  // Merged sheets of flame: several tongues rising off one body, five translucent-edged layers
  // (deep red tips → orange → gold → white-hot base), no ink outline. Base at y = 120/128.
  const SHEET_BASE = 120 / 128;
  const SHEET_PALS = {
    soft: ['rgba(196,34,10,.66)', 'rgba(238,84,18,.88)', '#ff8e24', '#ffb93a', '#ffdc78'],
    hot: ['rgba(222,64,14,.66)', 'rgba(255,122,28,.88)', '#ffa22e', '#ffcf52', '#ffeeac'],
    deep: ['rgba(140,18,8,.66)', 'rgba(200,44,12,.86)', '#ee661c', '#ffa63a', '#ffe0a0']
  };
  function fireSheet(v, pal) {
    v %= 5;
    return Kit.sprite('fireSheet:' + pal + ':' + v, 160, 128, g => {
      const W = 160, base = 120, cols = SHEET_PALS[pal] || SHEET_PALS.soft;
      const n = 2 + (v % 3), peaks = [];
      for (let i = 0; i < n; i++) peaks.push({
        x: W * (.18 + .64 * (i + .5) / n + (hash(v * 7 + i) - .5) * .14),
        h: 56 + hash(v * 3.3 + i * 1.7) * 60, w: 24 + hash(v * 5.1 + i) * 20
      });
      const gr = g.createRadialGradient(W / 2, base, 2, W / 2, base, W * .5);
      gr.addColorStop(0, 'rgba(255,200,90,.85)'); gr.addColorStop(.5, 'rgba(240,90,20,.45)'); gr.addColorStop(1, 'rgba(200,40,10,0)');
      g.save(); g.translate(0, base); g.scale(1, .26); g.translate(0, -base);
      g.fillStyle = gr; g.beginPath(); g.arc(W / 2, base, W * .5, 0, TAU); g.fill(); g.restore();
      for (let layer = 0; layer < 5; layer++) {
        const k = 1 - layer * .19;
        g.beginPath();
        for (let j = 0; j <= 48; j++) {
          const x = W * j / 48, xs = W / 2 + (x - W / 2) / (.4 + .6 * k);
          let h = 30 * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(xs / W))), .6);
          for (const p of peaks) {
            const d = Math.abs(xs - p.x) / p.w;
            if (d < 1) h = Math.max(h, p.h * Math.pow(1 - d, 1.5) + 16 * (1 - d));
          }
          h *= .2 + .8 * k;
          const px = x + Math.sin(h * .06 + v * 2.1) * h * .08;
          if (j) g.lineTo(px, base - h); else g.moveTo(px, base - h);
        }
        g.lineTo(W, base); g.quadraticCurveTo(W / 2, base + 7 * k, 0, base); g.closePath();
        g.fillStyle = cols[layer]; g.fill();
      }
    });
  }
  const seaBlob = (key, stops) => Kit.sprite('seaBlob:' + key, 64, 64, g => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [s, c] of stops) gr.addColorStop(s, c);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  const SEA_SPR = {
    scorch: () => seaBlob('scorch', [[0, 'rgba(24,10,4,.78)'], [.5, 'rgba(38,16,6,.5)'], [.8, 'rgba(44,22,10,.18)'], [1, 'rgba(44,22,10,0)']]),
    ember: () => seaBlob('ember', [[0, 'rgba(255,196,86,.92)'], [.35, 'rgba(242,98,22,.78)'], [.7, 'rgba(168,34,10,.4)'], [1, 'rgba(140,24,8,0)']]),
    hot: () => seaBlob('hot', [[0, 'rgba(255,244,180,.95)'], [.45, 'rgba(255,170,60,.45)'], [1, 'rgba(255,120,30,0)']])
  };
  // Sprite drawn with its base at (x, y), sheared sideways (cached base matrix m).
  function baseAt(ctx, m, img, x, y, w, h, shear, baseFrac) {
    ctx.setTransform(m.a, m.b, m.a * shear + m.c, m.b * shear + m.d, m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
    ctx.drawImage(img, -w * .5, -h * baseFrac, w, h);
  }

  // Flame layout per sea, cached: flames stay where the front ignited them.
  const seaLayouts = new Map();
  function seaLayout(sea) {
    const a0 = sea.angle || 0, spread = sea.spread || .5, maxR = sea.maxRange || 400;
    const key = `${Math.round(sea.x)},${Math.round(sea.y)},${a0.toFixed(3)},${spread.toFixed(3)},${Math.round(maxR)}`;
    let L = seaLayouts.get(key);
    if (L) return L;
    const spacing = Math.max(50, Math.sqrt(maxR * maxR * spread / 135) * 1.32);
    const pts = [];
    let row = 0;
    for (let r = 30; r <= maxR; r += spacing * .78, row++) {
      const n = Math.max(1, Math.round(r * spread * 2 / spacing));
      for (let k = 0; k < n; k++) {
        const s = row * 31.7 + k * 7.3;
        const off = ((k + .5 + (hash(s) - .5) * .8) / n * 2 - 1) * .97;
        const ang = a0 + off * spread;
        const rr = Math.min(maxR, r + (hash(s + 3) - .5) * spacing * .6);
        const pk = hash(s + 11);
        pts.push({ r: rr, dx: Math.cos(ang) * rr, dy: Math.sin(ang) * rr, edge: Math.abs(off),
          v: (k * 3 + row) % 5, seed: hash(s + 9) * 50, size: .5 + Math.pow(hash(s + 5), 1.4) * 1.15,
          wide: .75 + hash(s + 13) * .6, tall: .6 + hash(s + 17) * .8, lk: (hash(s + 19) - .5) * .3,
          al: .86 + hash(s + 23) * .14, pal: pk < .5 ? 'soft' : pk < .75 ? 'hot' : 'deep' });
      }
    }
    pts.sort((p, q) => p.dy - q.dy);
    const nf = Math.max(6, Math.min(28, Math.round(maxR * spread * 2 / 44)));
    const front = [];
    for (let k = 0; k <= nf; k++) {
      const ang = a0 + (k / nf * 2 - 1) * spread;
      front.push({ c: Math.cos(ang), s: Math.sin(ang), v: k % 6, seed: k * 3.3 + 91, size: .85 + hash(k * 5.1) * .4 });
    }
    // the continuous wall is sampled along the arc in angle order
    const M = Math.max(24, Math.min(84, nf * 3)), arc = [];
    for (let j = 0; j < M; j++) {
      const u = j / (M - 1), ang = a0 + (u * 2 - 1) * spread;
      arc.push({ u, c: Math.cos(ang), s: Math.sin(ang) });
    }
    const tongues = front.filter((f, k) => k % 3 === 1).sort((p, q) => p.s - q.s);
    front.sort((p, q) => p.s - q.s);
    L = { pts, front, arc, tongues, spacing, ground: null };
    if (seaLayouts.size > 8) seaLayouts.delete(seaLayouts.keys().next().value);
    seaLayouts.set(key, L);
    return L;
  }

  // Burnt ground under the sea, baked once per layout at low resolution: ragged scorched margins
  // and glowing embers made of overlapping soft blobs, so the area has no straight wedge edges.
  function seaGround(L) {
    if (L.ground) return L.ground;
    const pad = L.spacing * 1.6;
    let x0 = -pad, x1 = pad, y0 = -pad, y1 = pad;
    for (const p of L.pts) {
      x0 = Math.min(x0, p.dx - pad); x1 = Math.max(x1, p.dx + pad);
      y0 = Math.min(y0, p.dy - pad); y1 = Math.max(y1, p.dy + pad);
    }
    const w = x1 - x0, h = y1 - y0, k = Math.min(.4, 640 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(4, Math.ceil(w * k)); c.height = Math.max(4, Math.ceil(h * k));
    const g = c.getContext('2d');
    g.scale(k, k); g.translate(-x0, -y0);
    const sc = SEA_SPR.scorch(), em = SEA_SPR.ember(), hot = SEA_SPR.hot();
    const blob = (img, x, y, r, a) => { g.globalAlpha = a; g.drawImage(img, x - r, y - r * .7, r * 2, r * 1.4); };
    for (const p of L.pts) {
      const near = Math.min(1, .3 + p.r / 220), j = L.spacing * .35;
      const r = L.spacing * (1.05 + hash(p.seed * 3.1) * .9) * near * (1 + p.edge * .35);
      blob(sc, p.dx + (hash(p.seed * 1.3) - .5) * j, p.dy + (hash(p.seed * 1.9) - .5) * j, r, .95);
    }
    for (const p of L.pts) {
      if (p.edge > .9 && hash(p.seed * 4.3) < .6) continue;
      const near = Math.min(1, .25 + p.r / 200);
      const r = L.spacing * (.95 + hash(p.seed * 2.7) * .65) * near * (1 - p.edge * .4);
      blob(em, p.dx, p.dy, r, .92);
      if (hash(p.seed * 5.9) < .35) blob(hot, p.dx + (hash(p.seed) - .5) * r, p.dy, r * .45, .75);
    }
    L.ground = { c, x: x0, y: y0, w, h };
    return L.ground;
  }

  // Gōka Mekkyaku: a towering, continuous wave of fire rolls forward — tongues licking along its
  // crest, billows tumbling over the top, black smoke boiling above and a white-hot seam at its
  // foot — leaving a sea of merged, wind-blown flame sheets burning on scorched ground behind it.
  const WALL_COLS = ['rgba(150,22,8,.85)', 'rgba(224,58,14,.92)', '#ff8a24', '#ffc544', '#fff1c2'];
  function drawFireSea(ctx, sea, time) {
    const age = (sea.maxLife || 1) - (sea.life || 0);
    const t = clamp(age / Math.max(.05, sea.grow || .8)), range = (sea.maxRange || 400) * (1 - (1 - t) * (1 - t));
    if (range < 8) return;
    const fade = clamp((sea.life || 0) / .7), spread = sea.spread || .5, a0 = sea.angle || 0;
    const x0 = sea.x, y0 = sea.y, L = seaLayout(sea);
    const scale = .8 + (sea.charge || 0) * .5, fadeH = .25 + .75 * Math.pow(fade, .8);
    const ca = Math.cos(a0), sa = Math.sin(a0);
    const rolling = 1 - ease.smooth((t - .85) / .15 + (1 - fade));   // the wave's surge, gone once it stops and dies
    ctx.save();
    // 1) burnt ground, revealed up to the advancing front
    const G = seaGround(L);
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade * 1.4);
    ctx.beginPath(); ctx.arc(x0, y0, range + 4, 0, TAU); ctx.clip();
    ctx.drawImage(G.c, x0 + G.x, y0 + G.y, G.w, G.h);
    ctx.restore();
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const rr = range * (.2 + i * .26);
      Kit.glow(ctx, x0 + ca * rr, y0 + sa * rr, rr * spread + 70, '255,100,25', .26 + .06 * Math.sin(time * 7 + i * 2), false, .7);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, fade * 1.8);
    const m = ctx.getTransform();
    const wind = -ca * (.14 + .16 * rolling);   // the blast wind bends every flame toward the advance
    const growFront = .55 + .45 * ease.out(t * 2.5);
    const smoke = Kit.puff('smoke');
    const H = 200 * scale * fadeH * growFront, D = H * .3 * rolling, T = H * .32;
    const M = L.arc.length;
    const crest = (u, k, layer) => {
      const taper = ease.smooth(u / .09) * ease.smooth((1 - u) / .09);
      const body = .62 + .18 * Math.sin(u * 9 + time * 2.6 + layer * .7) + .12 * Math.sin(u * 23 - time * 4.3 + layer * 1.9);
      const spike = Math.pow(Math.max(0, Math.sin(u * M * .55 + time * 3.2 + layer * 1.3)), 3) * .42;
      return H * k * taper * (body + spike);
    };
    const wallA = Math.min(1, fade * 1.8);
    const drawWall = () => {
      if (H < 4) return;
      ctx.setTransform(m);
      // black smoke boiling above the crest (behind the fire)
      const smokeA = (.42 + (1 - fade) * .3) * (1 - .55 * Math.abs(ca));
      for (let j = 1; j < M - 1; j += 3) {
        const a = L.arc[j], gx = x0 + a.c * range, gy = y0 + a.s * range, ph = frac(time * .6 + hash(j * 1.7));
        if (!inView(gx, gy - H, H * 1.6)) continue;
        Kit.stamp(ctx, smoke, gx + ca * D * .6 + Math.sin(time + j) * H * .08, gy + sa * D * .6 - H * (1.05 + ph * .75),
          H * (.28 + ph * .26), Math.sin(Math.PI * ph) * smokeA);
      }
      // the wave itself: two ranks (a back rank thickens it), each one continuous sheet in five
      // layers whose crest leans into the advance and rolls over at the top
      for (let rank = 0; rank < 2; rank++) {
        const rr = Math.max(0, range - (rank ? 0 : T)), ph = rank ? 0 : 2.7, hk = rank ? 1 : .9;
        for (let layer = rank ? 0 : 1; layer < 5; layer++) {
          const k = (1 - layer * .18) * hk;
          ctx.beginPath();
          for (let j = 0; j < M; j++) {
            const a = L.arc[j], gx = x0 + a.c * rr, gy = y0 + a.s * rr;
            if (j) ctx.lineTo(gx, gy); else ctx.moveTo(gx, gy);
          }
          for (let j = M - 1; j >= 0; j--) {
            const a = L.arc[j], hh = crest(a.u, k, layer + ph), f = D * hh / H;
            ctx.lineTo(x0 + a.c * rr + ca * f + Math.sin(time * 5 + j * .9 + ph) * hh * .03, y0 + a.s * rr + sa * f * .35 - hh);
          }
          ctx.closePath();
          // seen edge-on (travelling sideways) the bright inner layers would collapse into a pale sliver
          ctx.globalAlpha = wallA * (layer > 2 ? 1 - .75 * Math.abs(ca) : 1);
          ctx.fillStyle = WALL_COLS[layer]; ctx.fill();
        }
      }
      ctx.globalAlpha = wallA;
      // a few big inked tongues standing in front give the wave its cel accents
      for (const f of L.tongues) {
        const px = x0 + f.c * range, py = y0 + f.s * range;
        const h = H * .78 * f.size * (1.02 + Math.sin(time * 8 + f.seed) * .12 + Math.sin(time * 13.7 + f.seed * 1.3) * .06);
        if (!inView(px, py - h * .6, h * 1.4)) continue;
        Kit.flameAt(ctx, m, Kit.flame(f.v), px, py, h * .6, h, wind + Math.sin(time * 3.1 + f.seed) * .14);
      }
      ctx.setTransform(m);
    };
    const away = sa < 0;
    if (away) drawWall();
    // 2) the burning field, back to front: merged flame sheets of every size, hue and lean,
    //    tallest just behind the wave and dying down behind it
    for (const p of L.pts) {
      if (p.r > range) continue;
      const behind = range - p.r;
      const pop = ease.outBack(behind / 80 + .12);
      const tall = .5 + .7 * Math.exp(-behind / 190);
      const lick = 1 + Math.sin(time * 9.5 + p.seed) * .14 + Math.sin(time * 15.3 + p.seed * 2.1) * .07;
      const h = (58 + L.spacing * .8) * scale * p.size * p.tall * tall * pop * lick * fadeH;
      if (h < 3 || !inView(x0 + p.dx, y0 + p.dy - h * .5, h + L.spacing)) continue;
      const w = (h * .95 + L.spacing * .6 * pop * fadeH) * p.wide;
      ctx.globalAlpha = Math.min(1, fade * 1.8) * p.al;
      baseAt(ctx, m, fireSheet(p.v, p.pal), x0 + p.dx, y0 + p.dy, w, h, wind * (1 + p.lk * 2) + p.lk + Math.sin(time * 3.7 + p.seed) * .12, SHEET_BASE);
    }
    ctx.setTransform(m);
    ctx.globalAlpha = Math.min(1, fade * 1.8);
    if (!away) drawWall();
    ctx.setTransform(m);
    // 3) smoke drifting up off the burning field, thicker as it dies down
    const n = L.pts.length;
    if (n) for (let i = 0; i < 12; i++) {
      const p = L.pts[(i * 37) % n];
      if (p.r > range) continue;
      const ph = frac(time * .32 + hash(i * 1.7));
      const sx = x0 + p.dx + Math.sin(time * .8 + i) * 14 + ca * ph * 30, sy = y0 + p.dy - (50 + ph * 150) * scale;
      Kit.stamp(ctx, smoke, sx, sy, (28 + ph * 60) * scale, Math.sin(Math.PI * ph) * (.16 + (1 - fade) * .34));
    }
    // 4) additive heat: flickering hot spots in the field, glow over the wave, white-hot seam
    //    along its foot, embers rising on the wind
    ctx.globalCompositeOperation = 'lighter';
    if (n) for (let i = 0; i < 10; i++) {
      const p = L.pts[(i * 29 + 3) % n];
      if (p.r > range) continue;
      Kit.glow(ctx, x0 + p.dx, y0 + p.dy - 10, L.spacing * .9, '255,140,40', (.25 + .2 * Math.sin(time * 11 + i * 2.3)) * fade, false, .6);
    }
    for (let j = 0; j < M; j += 6) {
      const a = L.arc[j];
      Kit.glow(ctx, x0 + a.c * range, y0 + a.s * range - H * .35, H * .62, '255,130,40', .36 * fade);
    }
    for (let j = 0; j < M; j += 4) {
      const a = L.arc[j];
      Kit.glow(ctx, x0 + a.c * range, y0 + a.s * range, 60 * scale, '255,220,140', .5 * fade * growFront * (1 - .7 * Math.abs(ca)) * (sa < 0 ? .35 : 1), true, .38);
    }
    ctx.fillStyle = '#ffd46e';
    if (n) for (let i = 0; i < 30; i++) {
      const p = L.pts[(i * 53 + 7) % n];
      if (p.r > range) continue;
      const ph = frac(time * .9 + hash(i * 2.3));
      const ex = x0 + p.dx + Math.sin(time * 2 + i * 1.7) * 18 + ca * ph * 40, ey = y0 + p.dy - ph * 180 * scale;
      const s = 1.6 + hash(i * 4.1) * 1.8;
      ctx.globalAlpha = (1 - ph) * fade; ctx.fillRect(ex - s / 2, ey - s / 2, s, s);
    }
    ctx.restore();
  }

  // Reusable impact painters for the other jutsu modules (Hokage, Might Guy, summons).
  Kit.fx = { fireBlast, windDome, beastBlast, lightningBlast, smokePoof, shockRing, debris, rasenganOrb: drawRasenganOrb, groundGlow };

  // World-space view rectangle from the current camera transform, for culling off-screen effects
  // (in co-op every teammate's jutsu is drawn, wherever it is).
  function updateView(ctx) {
    const m = ctx.getTransform ? ctx.getTransform() : null, c = ctx.canvas;
    if (!m || !c || !m.a || !m.d || m.b || m.c) { VIEW.x0 = VIEW.y0 = -1e9; VIEW.x1 = VIEW.y1 = 1e9; return; }
    const xa = -m.e / m.a, xb = (c.width - m.e) / m.a, ya = -m.f / m.d, yb = (c.height - m.f) / m.d;
    VIEW.x0 = Math.min(xa, xb); VIEW.x1 = Math.max(xa, xb); VIEW.y0 = Math.min(ya, yb); VIEW.y1 = Math.max(ya, yb);
  }
  const BOUNDS = {
    fireSeas: e => (e.maxRange || 400) + 420,
    explosions: e => (e.radius || 40) * 1.5 + 80,
    vortices: e => (e.radius || 64) * 1.3 + 80,
    fireballs: e => (e.r || 18) * 7 + 60,
    beastBombs: e => (e.r || 27) * 5 + 60,
    rasenShurikens: e => (e.r || 24) * 4 + 60
  };

  window.NinjaVFX = {
    draw(ctx, state) {
      if (!ctx || !state) return;
      const time = Number.isFinite(state.elapsed) ? state.elapsed : 0;
      updateView(ctx);
      const each = (name, limit, fn) => {
        const items = state[name];
        if (!Array.isArray(items)) return;
        const bound = BOUNDS[name];
        for (let i = Math.max(0, items.length - limit); i < items.length; i++) {
          const e = items[i];
          if (!e) continue;
          if (bound) { if (!inView(e.x, e.y, bound(e))) continue; }
          else if (Number.isFinite(e.x1) && !inView((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, Math.hypot(e.x2 - e.x1, e.y2 - e.y1) / 2 + 100)) continue;
          fn(ctx, e, time);
        }
      };
      each('fireSeas', 3, drawFireSea);
      each('explosions', 16, drawExplosion);
      each('vortices', 4, drawVortex);
      each('trails', 32, drawLightning);
      each('fireballs', 12, drawFireball);
      each('beastBombs', 4, drawBeastBomb);
      each('rasenShurikens', 5, drawRasenShuriken);
      drawRasenCharge(ctx, state, time);
    }
  };
})();
