/* The four Hokage: Wood Release (Hashirama), Water Dragon (Tobirama), Fire Release and Enma's
 * Adamantine Staff (Hiruzen)
 * and the Flying Thunder God yellow flash (Minato). Effects are drawn on the ground plane at the
 * target; attacks first travel from (fromX, fromY), then erupt. Uses window.VFXKit (skill-vfx.js). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const c01 = n => clamp(n, 0, 1);
  const COLORS = ['#85d367', '#78d8ff', '#ff9a54', '#ffe179'];
  const GLOW_RGB = ['140,230,100', '110,210,255', '255,150,70', '255,225,110'];

  function ring(ctx, x, y, radius, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
  }

  function leaf(ctx, x, y, angle, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-size, 0);
    ctx.quadraticCurveTo(0, -size * .55, size * 1.4, 0);
    ctx.quadraticCurveTo(0, size * .55, -size, 0);
    ctx.fill(); ctx.restore();
  }

  function kunai(ctx, x, y, angle, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    ctx.fillStyle = '#262a35';
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-2, -4);
    ctx.lineTo(0, 0); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ecedf1'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-8, 0); ctx.stroke();
    ctx.strokeStyle = '#cbb778'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-15, 0); ctx.stroke();
    ring(ctx, -16, 0, 2.8, '#d2c38e', 1.4);
    ctx.restore();
  }

  // Quadratic-bezier tube from t0 to t1 with width tapering w0 → w1; builds a closed path.
  const TL = new Float32Array(80), TR = new Float32Array(80);
  function tube(ctx, x0, y0, cx, cy, x1, y1, t0, t1, w0, w1, wave = 0, phase = 0) {
    const N = 13;
    for (let i = 0; i <= N; i++) {
      const k = i / N, t = t0 + (t1 - t0) * k, u = 1 - t;
      const px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
      let dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const w = w0 + (w1 - w0) * k, sway = Math.sin(k * 9 + phase) * wave;
      TL[i * 2] = px - dy * (w + sway); TL[i * 2 + 1] = py + dx * (w + sway);
      TR[i * 2] = px + dy * (w - sway); TR[i * 2 + 1] = py - dx * (w - sway);
    }
    ctx.beginPath(); ctx.moveTo(TL[0], TL[1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(TL[i * 2], TL[i * 2 + 1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(TR[i * 2], TR[i * 2 + 1]);
    ctx.closePath();
  }
  function bez(x0, y0, cx, cy, x1, y1, t) {
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
  }

  // Dragon head facing `angle` at (x, y): snout, jaw, horns, eye. Palette [outline, body, light, eye].
  function dragonHead(ctx, x, y, angle, s, pal, open = .5) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (Math.cos(angle) < 0) ctx.scale(1, -1);
    ctx.lineJoin = 'round';
    ctx.fillStyle = pal[0];
    ctx.beginPath();
    ctx.moveTo(-s * .6, -s * .55); ctx.quadraticCurveTo(s * .2, -s * .75, s * 1.15, -s * .25);
    ctx.lineTo(s * .55, -s * .02 - open * s * .1); ctx.lineTo(s * 1.05, s * .2 + open * s * .45);
    ctx.quadraticCurveTo(s * .2, s * .55, -s * .6, s * .45); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal[1];
    ctx.beginPath();
    ctx.moveTo(-s * .5, -s * .45); ctx.quadraticCurveTo(s * .2, -s * .63, s * 1.02, -s * .24);
    ctx.lineTo(s * .48, -s * .03 - open * s * .1); ctx.lineTo(s * .94, s * .18 + open * s * .4);
    ctx.quadraticCurveTo(s * .2, s * .45, -s * .5, s * .36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal[2];
    ctx.beginPath(); ctx.moveTo(-s * .3, -s * .4); ctx.quadraticCurveTo(s * .3, -s * .55, s * .9, -s * .25);
    ctx.quadraticCurveTo(s * .3, -s * .35, -s * .3, -s * .25); ctx.closePath(); ctx.fill();
    // horns
    ctx.strokeStyle = pal[2]; ctx.lineWidth = Math.max(1.5, s * .1); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * .2, -s * .5); ctx.quadraticCurveTo(-s * .7, -s * .95, -s * 1.15, -s * .85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * .05, -s * .45); ctx.quadraticCurveTo(-s * .4, -s * 1.05, -s * .9, -s * 1.1); ctx.stroke();
    // eye
    ctx.fillStyle = pal[3];
    ctx.beginPath(); ctx.ellipse(s * .3, -s * .3, s * .14, s * .07, -.2, 0, TAU); ctx.fill();
    // fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(s * .7, -s * .12); ctx.lineTo(s * .76, s * .04); ctx.lineTo(s * .82, -s * .14); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------ Wood Release
  const WOOD = ['#3b2414', '#8a5a32', '#c48d55'];
  function woodBranch(ctx, a, reach, rise, w, g, seed, K) {
    // Erupts from the ground: grows outward along the ground and arcs upward.
    const ex = Math.cos(a) * reach, ey = Math.sin(a) * reach * .5 - rise;
    const cx = Math.cos(a + .35 * (K.hash(seed) - .5)) * reach * .55, cy = Math.sin(a) * reach * .3 - rise * .2;
    ctx.fillStyle = WOOD[0]; tube(ctx, 0, 0, cx, cy, ex, ey, 0, g, w + 2, 1.5); ctx.fill();
    ctx.fillStyle = WOOD[1]; tube(ctx, 0, 0, cx, cy, ex, ey, 0, g, w, .6); ctx.fill();
    ctx.fillStyle = WOOD[2]; tube(ctx, -w * .25, -w * .3, cx - w * .2, cy - w * .3, ex, ey, .05, g * .95, w * .28, .2); ctx.fill();
    // a side shoot with leaves
    if (g > .45) {
      const [bx, by] = bez(0, 0, cx, cy, ex, ey, .55);
      const sa = a + (K.hash(seed + 1) > .5 ? .9 : -.9), sl = reach * .32 * K.ease.outBack((g - .45) / .55);
      const sx = bx + Math.cos(sa) * sl, sy = by + Math.sin(sa) * sl * .5 - sl * .4;
      ctx.fillStyle = WOOD[0]; tube(ctx, bx, by, (bx + sx) / 2, (by + sy) / 2 - 4, sx, sy, 0, 1, w * .45 + 1, 1); ctx.fill();
      ctx.fillStyle = WOOD[1]; tube(ctx, bx, by, (bx + sx) / 2, (by + sy) / 2 - 4, sx, sy, 0, 1, w * .4, .5); ctx.fill();
      leaf(ctx, sx, sy, sa - .4, 4 + w * .4, '#5fae45');
      leaf(ctx, sx, sy, sa + .5, 3 + w * .35, '#8fd768');
    }
    if (g > .8) {
      const [tx, ty] = bez(0, 0, cx, cy, ex, ey, g);
      leaf(ctx, tx, ty, a - .5, 4 + w * .45, '#6cc04e');
      leaf(ctx, tx, ty, a + .6, 3.5 + w * .4, '#a6e57c');
    }
  }

  // Jukai Kōtan: whole trees burst out of the ground, trunks twisting up into dense canopies.
  function canopySprite(K) {
    return K.sprite('hokage:canopy', 96, 96, g => {
      const gr = g.createRadialGradient(36, 32, 2, 48, 48, 48);
      gr.addColorStop(0, '#b8ef7c'); gr.addColorStop(.35, '#6fbf4a'); gr.addColorStop(.7, '#3d8a33');
      gr.addColorStop(.9, 'rgba(28,80,30,.85)'); gr.addColorStop(1, 'rgba(28,80,30,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  function giantTree(ctx, x, y, h, w, g, seed, K) {
    if (g <= 0) return;
    const top = y - h * g, lean = (K.hash(seed) - .5) * w * 2.4;
    ctx.fillStyle = WOOD[0]; tube(ctx, x, y + 2, x - lean * .3, y - h * g * .5, x + lean, top, 0, 1, w * 1.3 + 2, w * .55 + 1, w * .12, seed); ctx.fill();
    ctx.fillStyle = WOOD[1]; tube(ctx, x, y + 2, x - lean * .3, y - h * g * .5, x + lean, top, 0, 1, w * 1.3, w * .55, w * .12, seed); ctx.fill();
    ctx.fillStyle = WOOD[2]; tube(ctx, x - w * .4, y, x - lean * .3 - w * .4, y - h * g * .5, x + lean - w * .2, top, .05, .95, w * .3, w * .12); ctx.fill();
    // roots clawing at the ground
    ctx.strokeStyle = WOOD[0]; ctx.lineWidth = Math.max(2, w * .35); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = -1; i <= 1; i += 2) { ctx.moveTo(x, y - w * .4); ctx.quadraticCurveTo(x + i * w * 1.4, y - w * .2, x + i * w * 2.4 * g, y + w * .5); }
    ctx.stroke();
    if (g < .55) return;
    const c = canopySprite(K), k = K.ease.outBack((g - .55) / .45), r = w * 3.2 * k;
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + seed, d = r * .55;
      K.stamp(ctx, c, x + lean + Math.cos(a) * d, top + Math.sin(a) * d * .55 - r * .15, r * .7, 1);
    }
    K.stamp(ctx, c, x + lean, top - r * .35, r * .8, 1);
  }

  // Jukai Kōtan across the battlefield: trees are pre-painted (a few variants) and stamped growing
  // out of the ground as the wave front passes; positions are true world offsets, so the forest
  // covers exactly the circle the game damages.
  const TREE_W = 170, TREE_H = 270;
  function treeSprite(K, v) {
    return K.sprite('hokage:tree' + v, TREE_W, TREE_H, g => giantTree(g, TREE_W / 2, TREE_H - 12, 180 + v * 6, 11 + v * 1.3, 1, v * 3.7 + 1, K));
  }
  // Cached by spot, not on the effect: the effect list is also streamed to co-op teammates.
  const layouts = new Map();
  function forestLayout(fx) {
    const key = `${Math.round(fx.x)},${Math.round(fx.y)},${fx.radius}`;
    if (layouts.has(key)) return layouts.get(key);
    const R = fx.radius, seed = (fx.x * .011 + fx.y * .017) % 97, trees = [];
    for (let d = 70, ring = 0; d < R; d += 88, ring++) {
      const n = Math.floor(TAU * d / 100);
      for (let i = 0; i < n; i++) {
        const h = k => { const v = Math.sin((ring * 131 + i * 17 + k) * 12.9898 + seed) * 43758.5453; return v - Math.floor(v); };
        const a = (i + h(1) * .7) / n * TAU, dd = d + (h(2) - .5) * 60;
        trees.push({ x: Math.cos(a) * dd, y: Math.sin(a) * dd, d: dd, v: Math.floor(h(3) * 4), s: .62 + h(4) * .55 + (dd < 200 ? .25 : 0), lag: h(5) * .12, flip: h(6) > .5 });
      }
    }
    trees.sort((p, q) => p.y - q.y);
    if (layouts.size > 6) layouts.delete(layouts.keys().next().value);
    layouts.set(key, trees);
    return trees;
  }
  function drawForest(ctx, fx, time, K) {
    const total = fx.maxLife || 4.6, t = total - fx.life, R = fx.radius, speed = R / 1.1;
    const front = Math.min(R, t * speed), sink = K.ease.in((t - (total - .8)) / .8), fade = 1 - sink;
    const m = ctx.getTransform(), cw = ctx.canvas.width, ch = ctx.canvas.height;
    ctx.save(); ctx.translate(fx.x, fx.y);
    // green chakra flooding the ground inside the front, a bright ring riding the edge
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, 0, 0, front * 1.05, '90,190,70', .28 * fade);
    if (front < R) {
      ctx.strokeStyle = 'rgba(190,255,140,.8)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(0, 0, front, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,230,90,.35)'; ctx.lineWidth = 34;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1, front - 20), 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // churned earth
    ctx.fillStyle = `rgba(58,40,24,${.32 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(1, front), 0, TAU); ctx.fill();
    const dust = K.puff('smoke');
    for (const tr of forestLayout(fx)) {
      const born = tr.d / speed + tr.lag;
      if (t < born) continue;
      const sx = m.a * (fx.x + tr.x) + m.c * (fx.y + tr.y) + m.e, sy = m.b * (fx.x + tr.x) + m.d * (fx.y + tr.y) + m.f;
      const w = TREE_W * tr.s, h = TREE_H * tr.s;
      if (sx < -w * m.a || sx > cw + w * m.a || sy < -40 || sy > ch + h * m.d) continue;
      const g = Math.min(1.08, K.ease.outBack((t - born) / .5)) * (1 - sink * .85);
      if (g <= .02) continue;
      const img = treeSprite(K, tr.v), hh = h * g;
      ctx.save(); ctx.translate(tr.x, tr.y + 6); if (tr.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = Math.min(1, fade * 1.6);
      ctx.drawImage(img, 0, TREE_H * (1 - Math.min(1, g)), TREE_W, TREE_H * Math.min(1, g), -w / 2, -hh, w, hh);
      ctx.restore();
      // earth thrown up where each trunk breaks the surface
      const k = (t - born) / .6;
      if (k < 1) K.stamp(ctx, dust, tr.x, tr.y - 10 - k * 30, 26 + k * 36, (1 - k) * .55);
    }
    ctx.restore();
  }

  function drawWood(ctx, fx, life, age, radius, time, K) {
    const sx = Number.isFinite(fx.fromX) ? fx.fromX - fx.x : 0, sy = Number.isFinite(fx.fromY) ? fx.fromY - fx.y : 0;
    const far = Math.hypot(sx, sy) > 30;
    const seed = (fx.x * .013 + fx.y * .029) % 50;
    // Roots tunnel from Hashirama to the target, bursting up as stakes along the way.
    if (far) {
      const travel = K.ease.out(age / .32);
      for (let i = 1; i <= 6; i++) {
        const t = i / 7; if (t > travel) break;
        const pop = K.ease.outBack((travel - t) * 5) * (1 - K.ease.in((age - .5) / .5));
        if (pop <= 0) continue;
        const px = sx * (1 - t), py = sy * (1 - t), h = 14 + K.hash(i + seed) * 12;
        ctx.fillStyle = WOOD[0]; tube(ctx, px, py, px + 2, py - h * .5 * pop, px + 4 - K.hash(i) * 8, py - h * pop, 0, 1, 5, 1); ctx.fill();
        ctx.fillStyle = WOOD[1]; tube(ctx, px, py, px + 2, py - h * .5 * pop, px + 4 - K.hash(i) * 8, py - h * pop, 0, 1, 3.6, .5); ctx.fill();
      }
    }
    const impact = far ? c01((age - .18) / .82) : age;
    if (impact <= 0) return;
    // Cracked earth + green chakra seal.
    ctx.save(); ctx.scale(1, .5);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, 0, 0, radius * .9, '120,220,90', .35 * life);
    ring(ctx, 0, 0, radius * (.2 + K.ease.out(impact * 1.6) * .75), `rgba(160,230,100,${.75 * life})`, 4 * life + 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(50,32,20,${.6 * life})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 + seed, r1 = radius * .15, r2 = radius * (.4 + K.hash(i + seed) * .35) * K.ease.out(impact * 2);
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a + .15) * (r1 + r2) * .55, Math.sin(a + .15) * (r1 + r2) * .55);
      ctx.lineTo(Math.cos(a - .05) * r2, Math.sin(a - .05) * r2);
    }
    ctx.stroke();
    ctx.restore();
    // Wooden stakes and grasping branches erupting, back ones first.
    const n = fx.signature ? 10 : 7;
    const sink = K.ease.in((age - .7) / .3);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
      const a = i * TAU / n + .38 + (fx.angle || 0) + (K.hash(i + seed) - .5) * .5;
      if ((Math.sin(a) < 0) !== (pass === 0)) continue;
      const g = K.ease.outBack(impact * 2.4 - K.hash(i * 3 + seed) * .35) * (1 - sink * .6);
      if (g <= .02) continue;
      const reach = radius * (.45 + K.hash(i * 7 + seed) * .4), rise = radius * (.25 + K.hash(i * 5 + seed) * .35);
      woodBranch(ctx, a, reach, rise, Math.max(4, radius * (.07 + K.hash(i * 11 + seed) * .04)) * (1 - sink * .5), Math.min(1, g), i + seed, K);
    }
    // Signature: a forest erupts around the target, back trees first.
    if (fx.signature) {
      const grow = K.ease.out(c01((impact - .05) / .45)), sinkT = K.ease.in((age - .78) / .22);
      const trees = [];
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9 + seed * .3 + K.hash(i * 13 + seed) * .4, d = radius * (.35 + K.hash(i * 3.3 + seed) * .5);
        trees.push([Math.cos(a) * d, Math.sin(a) * d * .5, i]);
      }
      trees.sort((p, q) => p[1] - q[1]);
      for (const [tx, ty, i] of trees) {
        const g = c01(grow * 1.3 - K.hash(i * 5.7 + seed) * .3) * (1 - sinkT);
        giantTree(ctx, tx, ty, radius * (.55 + K.hash(i * 2.1 + seed) * .35), Math.max(6, radius * .045), g, i + seed, K);
      }
    }
    // Leaves shaken loose.
    for (let i = 0; i < 6; i++) {
      const t = c01(impact * 1.3 - K.hash(i + seed) * .2), a = K.hash(i * 9 + seed) * TAU, d = radius * (.3 + t * .5);
      if (t <= 0) continue;
      leaf(ctx, Math.cos(a) * d, Math.sin(a) * d * .5 - radius * .4 * Math.sin(Math.PI * t), a + t * 6, 4, `rgba(140,215,100,${1 - t})`);
    }
    // Mokuryū: a wooden dragon arching in from Hashirama.
    if (fx.signature && far) {
      const u = K.ease.out(age / .4), body0 = Math.max(0, u - .75);
      const lift = -Math.hypot(sx, sy) * .45 - 40;
      const cx = sx * .5, cy = sy * .5 + lift;
      const w = Math.max(10, radius * .085) * (1 - K.ease.in((age - .7) / .3) * .7);
      ctx.fillStyle = WOOD[0]; tube(ctx, sx, sy, cx, cy, 0, 0, body0, u, w * .8 + 2, w + 2, 2, time * 4); ctx.fill();
      ctx.fillStyle = WOOD[1]; tube(ctx, sx, sy, cx, cy, 0, 0, body0, u, w * .8, w, 2, time * 4); ctx.fill();
      ctx.fillStyle = WOOD[2]; tube(ctx, sx, sy - w * .3, cx, cy - w * .3, 0, -w * .3, body0, u, w * .2, w * .25, 1, time * 4); ctx.fill();
      ctx.strokeStyle = WOOD[0]; ctx.lineWidth = Math.max(1.5, w * .22);
      ctx.beginPath();
      for (let k = 1; k < 12; k++) {
        const t = body0 + (u - body0) * k / 12, [qx, qy] = bez(sx, sy, cx, cy, 0, 0, t), [rx, ry] = bez(sx, sy, cx, cy, 0, 0, t + .01);
        const dl = Math.hypot(rx - qx, ry - qy) || 1, nx = -(ry - qy) / dl, ny = (rx - qx) / dl;
        ctx.moveTo(qx + nx * w * .9, qy + ny * w * .9); ctx.lineTo(qx - nx * w * .9, qy - ny * w * .9);
      }
      ctx.stroke();
      const [hx, hy] = bez(sx, sy, cx, cy, 0, 0, u), [px, py] = bez(sx, sy, cx, cy, 0, 0, Math.max(0, u - .03));
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, w * 5, '150,240,110', .45); ctx.globalCompositeOperation = 'source-over';
      dragonHead(ctx, hx, hy, Math.atan2(hy - py, hx - px), w * 2.9, ['#3b2414', '#93633a', '#d5a066', '#ffde5a'], .3 + .3 * Math.sin(time * 9));
    }
  }

  // ------------------------------------------------------------ Water Release
  function drawWater(ctx, fx, life, age, radius, time, K) {
    const sx = Number.isFinite(fx.fromX) ? fx.fromX - fx.x : 0, sy = Number.isFinite(fx.fromY) ? fx.fromY - fx.y : 0;
    const far = Math.hypot(sx, sy) > 30;
    const seed = (fx.x * .017 + fx.y * .023) % 50;
    const water = K.puff('water');
    // Suiryūdan: a water dragon surges from Tobirama and crashes into the target.
    if (far) {
      const u = K.ease.out(age / .34), body0 = Math.max(0, u - (fx.signature ? .8 : .55));
      const fadeBody = 1 - K.ease.in((age - .3) / .25);
      if (fadeBody > 0) {
        const d = Math.hypot(sx, sy);
        const cx = sx * .5, cy = sy * .5 - d * .35 - 30;
        const w = Math.max(7, radius * (fx.signature ? .12 : .07));
        ctx.save(); ctx.globalAlpha *= fadeBody;
        ctx.fillStyle = 'rgba(20,80,150,.9)'; tube(ctx, sx, sy, cx, cy, 0, 0, body0, u, w * .5 + 2, w + 2, 2.5, -time * 10); ctx.fill();
        ctx.fillStyle = 'rgba(64,170,235,.92)'; tube(ctx, sx, sy, cx, cy, 0, 0, body0, u, w * .5, w, 2.5, -time * 10); ctx.fill();
        ctx.fillStyle = 'rgba(200,245,255,.9)'; tube(ctx, sx, sy - w * .35, cx, cy - w * .35, 0, -w * .35, body0, u, w * .12, w * .22, 1.5, -time * 10); ctx.fill();
        // spray streaming off the body
        for (let i = 0; i < 6; i++) {
          const t = body0 + (u - body0) * ((i + (time * 3 % 1)) / 6);
          const [px, py] = bez(sx, sy, cx, cy, 0, 0, t);
          K.stamp(ctx, water, px + Math.sin(i * 3 + time * 7) * w, py - w * .6, w * .55, .55);
        }
        // dorsal fins along the back
        ctx.fillStyle = 'rgba(170,235,255,.9)';
        for (let k = 1; k < 9; k++) {
          const t = body0 + (u - body0) * k / 9, [qx, qy] = bez(sx, sy, cx, cy, 0, 0, t), [rx, ry] = bez(sx, sy, cx, cy, 0, 0, t + .012);
          const dl = Math.hypot(rx - qx, ry - qy) || 1, tx = (rx - qx) / dl, ty = (ry - qy) / dl, nx = ty, ny = -tx;
          const fh = w * (.7 + Math.sin(k * 1.3 - time * 12) * .2);
          ctx.beginPath(); ctx.moveTo(qx + nx * w * .8 - tx * w * .5, qy + ny * w * .8 - ty * w * .5);
          ctx.lineTo(qx + nx * (w + fh) - tx * w * .9, qy + ny * (w + fh) - ty * w * .9);
          ctx.lineTo(qx + nx * w * .8 + tx * w * .5, qy + ny * w * .8 + ty * w * .5); ctx.fill();
        }
        const [hx, hy] = bez(sx, sy, cx, cy, 0, 0, u), [px, py] = bez(sx, sy, cx, cy, 0, 0, Math.max(0, u - .03));
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, w * 5, '120,210,255', .5); ctx.globalCompositeOperation = 'source-over';
        dragonHead(ctx, hx, hy, Math.atan2(hy - py, hx - px), w * 2.6, ['#123f73', '#3ea6e6', '#c9f4ff', '#fff6b0'], .5 + .3 * Math.sin(time * 12));
        ctx.restore();
      }
    }
    const impact = far ? c01((age - .26) / .74) : age;
    if (impact <= 0) return;
    const e = K.ease.out(impact * 1.5);
    // Ripples racing outward across the ground.
    ctx.save(); ctx.scale(1, .45);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, 0, 0, radius * (.6 + e * .5), '80,180,255', .35 * life);
    for (let i = 0; i < 3; i++) {
      const r = radius * (.15 + e * (.85 - i * .22));
      ring(ctx, 0, 0, r, `rgba(${i ? '150,225,255' : '220,250,255'},${life * (.85 - i * .2)})`, (4 - i) * life + 1);
    }
    ctx.restore();
    // Splash crown: droplets launched up and falling back.
    for (let i = 0; i < (fx.signature ? 16 : 11); i++) {
      const a = i * TAU / (fx.signature ? 16 : 11) + K.hash(i + seed) * .4;
      const t = c01(impact * 1.6 - K.hash(i * 3 + seed) * .2);
      if (t <= 0 || t >= 1) continue;
      const d = radius * (.12 + t * (.45 + K.hash(i * 5 + seed) * .3)), h = Math.sin(Math.PI * t) * radius * (.35 + K.hash(i * 7 + seed) * .3);
      K.stamp(ctx, water, Math.cos(a) * d, Math.sin(a) * d * .5 - h, radius * .032 * (1.2 - t * .6) + 2, 1 - t * t);
    }
    // Signature: Suijinheki — a ring wall of water surges up around the target, then crashes in on it.
    if (fx.signature) {
      const crash = c01(impact / .8), rise = Math.sin(Math.PI * Math.min(1, crash * 1.1)), lean = K.ease.in(crash) * .6;
      const R = radius * .75, H = radius * .7 * rise;
      if (H > 3) {
        const grad = ctx.createLinearGradient(0, -H, 0, R * .5);
        grad.addColorStop(0, 'rgba(225,250,255,.9)'); grad.addColorStop(.3, 'rgba(110,200,250,.85)');
        grad.addColorStop(1, 'rgba(25,100,190,.8)');
        const top = a => H * (.78 + .22 * Math.sin(a * 6 + time * 7) * Math.sin(a * 3 - time * 4));
        const half = (a0, a1, alpha) => {
          const M = 22;
          ctx.globalAlpha *= alpha;
          ctx.fillStyle = grad;
          ctx.beginPath();
          for (let k = 0; k <= M; k++) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R * .5); }
          for (let k = M; k >= 0; k--) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(Math.cos(a) * R * (1 - lean), Math.sin(a) * R * .5 * (1 - lean) - top(a)); }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(240,253,255,.95)'; ctx.lineWidth = 3;
          ctx.beginPath();
          for (let k = 0; k <= M; k++) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(Math.cos(a) * R * (1 - lean), Math.sin(a) * R * .5 * (1 - lean) - top(a)); }
          ctx.stroke();
          for (let k = 0; k <= M; k += 3) {
            const a = a0 + (a1 - a0) * k / M;
            ctx.globalCompositeOperation = 'lighter';
            K.glow(ctx, Math.cos(a) * R * (1 - lean), Math.sin(a) * R * .5 * (1 - lean) - top(a) - 2, radius * .08, '235,250,255', .8);
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.globalAlpha /= alpha;
        };
        half(Math.PI, TAU, 1);
        half(0, Math.PI, .72);
      }
    }
    // Central water column collapsing.
    const col = Math.sin(Math.PI * c01(impact * 1.8));
    if (col > .02) {
      for (let i = 0; i < 5; i++) {
        K.stamp(ctx, water, (K.hash(i + seed) - .5) * radius * .2, -i * radius * .1 * col, radius * (.16 - i * .02) * (.6 + col * .4), col * .9);
      }
    }
    // Foam ring.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + seed, d = radius * (.2 + e * .55);
      K.glow(ctx, Math.cos(a) * d, Math.sin(a) * d * .45, radius * .12, '200,240,255', .5 * life);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------ Fire Release
  function drawFire(ctx, fx, life, age, radius, time, K) {
    const sx = Number.isFinite(fx.fromX) ? fx.fromX - fx.x : 0, sy = Number.isFinite(fx.fromY) ? fx.fromY - fx.y : 0;
    const far = Math.hypot(sx, sy) > 30;
    const seed = (fx.x * .019 + fx.y * .031) % 50;
    const L = window.AnimeSprites ? window.AnimeSprites.LIFT : 24;
    // Karyū Endan: a dragon-breath stream of flame from Hiruzen's mouth.
    if (far && !fx.signature && age < .3) {
      // Gōkakyū: a great fireball rolls from Hiruzen's mouth to the target.
      const u = K.ease.inOut(age / .22), fire = K.puff('fire'), ember = K.puff('ember');
      const bx = sx * (1 - u), by = (sy - L * 1.2) * (1 - u), br = radius * (.18 + u * .14);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, bx, by, br * 2.4, '255,140,50', .7);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 5; i >= 1; i--) K.stamp(ctx, ember, bx + sx * i * .05, by + (sy - L) * i * .05, br * (1 - i * .13), .7 - i * .1);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + time * 6;
        K.stamp(ctx, fire, bx + Math.cos(a) * br * .45, by + Math.sin(a) * br * .4, br * .7, 1);
      }
      K.stamp(ctx, fire, bx, by, br * .85, 1);
    }
    if (far && fx.signature && age < .5) {
      const u = K.ease.out(age / .25), fade = 1 - K.ease.in((age - .24) / .26);
      const fire = K.puff('fire');
      const n = 18;
      for (let i = n - 1; i >= 0; i--) {
        const t = (i + (time * 6 % 1)) / n * u;
        const px = sx + (0 - sx) * t, py = sy - L * 1.2 * (1 - t) + (0 - sy) * t;
        const s = radius * (.09 + t * .13) * 1.3;
        K.stamp(ctx, fire, px + Math.sin(i * 2.3 + time * 9) * s * .3, py + Math.cos(i * 1.7 + time * 8) * s * .3, s, fade * (.6 + t * .4));
      }
      // Karyū Endan: the flame stream takes the shape of a dragon with a burning mane.
      const hx = sx * (1 - u), hy = sy - L * 1.2 * (1 - u) + (0 - sy) * u, hs = radius * .3;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx, hy, hs * 3.2, '255,120,40', .8 * fade);
      ctx.globalCompositeOperation = 'source-over';
      // a mane of flame tongues streaming back from the head
      const dirA = Math.atan2(-sy, -sx), FB = 114 / 128;
      ctx.save(); ctx.globalAlpha *= fade;
      for (let i = 0; i < 9; i++) {
        const an = dirA + Math.PI + (i / 8 - .5) * 2.2, len = hs * (2.5 + Math.sin(time * 15 + i * 1.9) * .2) * (1 - Math.abs(i / 8 - .5) * .6);
        ctx.save(); ctx.translate(hx - Math.cos(dirA) * hs * .2, hy - hs * .25); ctx.rotate(an + Math.PI / 2);
        ctx.drawImage(K.flame(i), -len * .24, -len * FB, len * .48, len);
        ctx.restore();
      }
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= fade;
      dragonHead(ctx, hx, hy, Math.atan2(-sy, -sx), hs, ['#6a0c04', '#f2420f', '#ffc23a', '#fffbe0'], .6 + .3 * Math.sin(time * 12));
      ctx.restore();
    }
    const impact = far ? c01((age - .18) / .82) : age;
    if (impact <= 0 || !K.fx) return;
    K.fx.shockRing(ctx, 0, 0, radius, impact, life, '255,130,50');
    K.fx.fireBlast(ctx, 0, 0, radius * .75, impact, life, time, seed);
  }

  // ------------------------------------------------------------ Flying Thunder God
  function drawFlash(ctx, fx, life, age, radius, time, K) {
    const sx = Number.isFinite(fx.fromX) ? fx.fromX - fx.x : 0, sy = Number.isFinite(fx.fromY) ? fx.fromY - fx.y : 0;
    const far = Math.hypot(sx, sy) > 30;
    const L = window.AnimeSprites ? window.AnimeSprites.LIFT : 24;
    ctx.globalCompositeOperation = 'lighter';
    // The yellow flash: an instant streak of light along the teleport, collapsing behind him.
    if (far && age < .4) {
      const f = 1 - age / .4, tail = K.ease.out(age / .4);
      ctx.lineCap = 'round';
      const x0 = sx * (1 - tail), y0 = (sy - L) * (1 - tail) - L * tail;
      for (const [w, c] of [[22 * f, '255,200,60,.25'], [9 * f, '255,230,120,.7'], [3 * f + .5, '255,255,240,1']]) {
        ctx.strokeStyle = `rgba(${c})`; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(0, -L); ctx.stroke();
      }
      // afterimage speed lines
      const d = Math.hypot(sx, sy) || 1, nx = -sy / d, ny = sx / d;
      ctx.strokeStyle = `rgba(255,240,170,${.6 * f})`; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) if (i) {
        const o = i * 7;
        ctx.moveTo(x0 + nx * o, y0 + ny * o); ctx.lineTo(nx * o * .3, -L + ny * o * .3);
      }
      ctx.stroke();
    }
    // Minato's afterimage left behind where he vanished.
    if (far && age < .35 && window.AnimeSprites) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha *= (1 - age / .35) * .55;
      window.AnimeSprites.draw(ctx, 'minato', sx, sy + 3, { facing: sx < 0 ? 1 : -1, frame: 'run', phase: 0 });
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
    }
    const e = K.ease.out(age * 1.8);
    // the Flying Thunder God formula burnt into the ground
    ctx.save(); ctx.scale(1, .5); ctx.rotate(time * .8 + (fx.angle || 0));
    const sr = radius * (.55 + e * .2);
    ctx.strokeStyle = `rgba(255,220,110,${.8 * life})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, sr, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, sr * .78, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = i * TAU / 24, r1 = sr * .8, r2 = sr * (i % 3 ? .9 : .98);
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      if (i % 6 === 0) { ctx.moveTo(Math.cos(a) * sr * .78, Math.sin(a) * sr * .78); ctx.lineTo(Math.cos(a + .3) * sr * .45, Math.sin(a + .3) * sr * .45); }
    }
    ctx.stroke();
    ctx.restore();
    if (age < .2) K.glow(ctx, 0, -L, radius * (.6 + age * 3), '255,230,120', 1 - age / .2, true);
    K.glow(ctx, 0, 0, radius * (.5 + e * .5), '255,210,80', .35 * life, false, .5);
    ctx.save(); ctx.scale(1, .5);
    ring(ctx, 0, 0, radius * (.13 + e * .86), `rgba(255,225,106,${.95 * life})`, 4 * life + 1);
    ring(ctx, 0, 0, radius * (.05 + e * .58), `rgba(252,250,208,${.88 * life})`, 2.1);
    ctx.restore();
    // radiating speed lines
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + (fx.angle || 0) + K.hash(i) * .3, x = Math.cos(a), y = Math.sin(a) * .55;
      ctx.moveTo(x * radius * (.1 + e * .55), -L * .5 + y * radius * (.1 + e * .55));
      ctx.lineTo(x * radius * (.3 + e * .85), -L * .5 + y * radius * (.3 + e * .85));
    }
    ctx.strokeStyle = `rgba(255,236,150,${life})`; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // Marked kunai planted around the impact.
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + (fx.angle || 0) + .5;
      const r = radius * (.3 + e * .25);
      kunai(ctx, Math.cos(a) * r, Math.sin(a) * r * .5, a + Math.PI * .85, .85);
    }
    // Minato's Rasengan grinding into the target, then bursting.
    if (far && K.fx) {
      const orb = Math.max(6, radius * (fx.signature ? .2 : .13)) * (1 + K.ease.out((age - .4) / .6) * .9);
      const oa = age < .4 ? 1 : life / .6;
      ctx.save(); ctx.translate(0, -L);
      K.fx.rasenganOrb(ctx, orb, time, oa);
      ctx.restore();
      if (age > .4) K.fx.shockRing(ctx, 0, 0, radius * 1.1, (age - .4) / .6, life, '140,210,255');
    }
  }

  // ------------------------------------------------------------ Enma, the Monkey King
  // The Adamantine Staff: a black rod with gold-capped ends, from (x0, y0) to (x1, y1).
  function rod(ctx, x0, y0, x1, y1, w) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1) return;
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    ctx.fillStyle = '#141118'; ctx.fillRect(0, -w / 2, len, w);
    ctx.fillStyle = 'rgba(150,140,175,.5)'; ctx.fillRect(0, -w / 2, len, w * .3);
    const cap = Math.min(len * .22, w * 2.8);
    ctx.fillStyle = '#e7b948';
    ctx.fillRect(0, -w * .65, cap, w * 1.3); ctx.fillRect(len - cap, -w * .65, cap, w * 1.3);
    ctx.fillStyle = '#fff1b8';
    ctx.fillRect(0, -w * .65, cap, w * .32); ctx.fillRect(len - cap, -w * .65, cap, w * .32);
    ctx.fillStyle = '#9c6c1e';
    ctx.fillRect(cap, -w * .5, w * .4, w); ctx.fillRect(len - cap - w * .4, -w * .5, w * .4, w);
    ctx.restore();
  }

  // Enma standing on his feet at the origin, facing +x: white mane, dark face, leopard skins.
  function enmaBody(ctx, time, roar) {
    const br = Math.sin(time * 2.6) * 1.1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(2, 0, 20, 5, 0, 0, TAU); ctx.fill();
    // curling tail
    ctx.strokeStyle = '#241a16'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, -30);
    ctx.bezierCurveTo(-34, -28, -42, -52, -28 + Math.sin(time * 2) * 3, -64); ctx.stroke();
    // long white mane falling down his back
    ctx.fillStyle = '#e9e7e1';
    ctx.beginPath(); ctx.moveTo(2, -88 + br);
    ctx.quadraticCurveTo(-20, -84, -22, -60);
    for (let i = 0; i < 5; i++) ctx.lineTo(-24 + (i % 2) * 6 + Math.sin(time * 3 + i) * 1.5, -54 + i * 6);
    ctx.lineTo(-6, -46); ctx.lineTo(4, -60); ctx.closePath(); ctx.fill();
    // bowed legs and big feet
    ctx.strokeStyle = '#241a16'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-6, -30); ctx.quadraticCurveTo(-15, -15, -9, -2);
    ctx.moveTo(8, -30); ctx.quadraticCurveTo(15, -15, 11, -2); ctx.stroke();
    ctx.fillStyle = '#6b4c3e';
    ctx.beginPath(); ctx.ellipse(-6, -1.5, 7.5, 3, 0, 0, TAU); ctx.ellipse(15, -1.5, 7.5, 3, 0, 0, TAU); ctx.fill();
    // back arm
    ctx.strokeStyle = '#1d1512'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-9, -58 + br); ctx.quadraticCurveTo(-19, -44, -16, -28); ctx.stroke();
    ctx.fillStyle = '#5a3f33'; ctx.beginPath(); ctx.arc(-16, -27, 4.2, 0, TAU); ctx.fill();
    // leopard-skin skirt with a ragged hem
    ctx.fillStyle = '#d7a33e';
    ctx.beginPath(); ctx.moveTo(-14, -40); ctx.lineTo(15, -40); ctx.lineTo(17, -24);
    for (let i = 0; i <= 6; i++) ctx.lineTo(17 - i * 5.5, i % 2 ? -18 : -23);
    ctx.closePath(); ctx.fill();
    // dark armoured robe over a barrel chest
    ctx.fillStyle = '#3d3550';
    ctx.beginPath(); ctx.moveTo(-12, -63 + br); ctx.quadraticCurveTo(2, -68 + br, 15, -62 + br);
    ctx.quadraticCurveTo(19, -50, 15, -38); ctx.lineTo(-13, -38); ctx.quadraticCurveTo(-17, -52, -12, -63 + br);
    ctx.fill();
    // leopard pelt across the shoulder
    ctx.fillStyle = '#e0ad45';
    ctx.beginPath(); ctx.moveTo(-12, -62 + br); ctx.lineTo(-2, -64 + br); ctx.lineTo(16, -42); ctx.lineTo(8, -39); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2a10';
    for (const [x, y] of [[-14, -33], [-3, -30], [8, -34], [13, -27], [-8, -26], [-5, -60], [3, -55], [9, -48], [12, -43]]) {
      ctx.beginPath(); ctx.arc(x, y + (y < -45 ? br : 0), 1.6, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#1f1a2a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-13, -39); ctx.lineTo(15, -39); ctx.stroke();
    // white mane framing the face
    ctx.fillStyle = '#f2f0ea';
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * .35 + i / 14 * Math.PI * 1.55, r = i % 2 ? 13 : 18 + Math.sin(time * 4 + i) * 1;
      const x = 2 + Math.cos(a) * r, y = -73 + br + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    // dark face, tan muzzle, red markings and golden eyes
    ctx.fillStyle = '#3a2b27';
    ctx.beginPath(); ctx.ellipse(6, -72 + br, 10, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a07a62';
    ctx.beginPath(); ctx.ellipse(12, -66 + br, 6.5, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1210';
    ctx.beginPath(); ctx.ellipse(16.5, -68 + br, 1.8, 1.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d0342a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(6, -70 + br); ctx.lineTo(9, -66 + br); ctx.moveTo(3, -71 + br); ctx.lineTo(5, -66 + br); ctx.stroke();
    ctx.fillStyle = '#ffd03a';
    ctx.beginPath(); ctx.ellipse(10, -74 + br, 2.8, 1.9, -.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#120c0a'; ctx.beginPath(); ctx.arc(10.8, -74 + br, 1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f7f5ef'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, -78 + br); ctx.lineTo(13.5, -77 + br); ctx.stroke();
    if (roar) {
      ctx.fillStyle = '#5c0f0f'; ctx.beginPath(); ctx.ellipse(13, -62 + br, 3.6, 2.2 + roar * 1.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(10.5, -64 + br, 1.2, 1.6); ctx.fillRect(14.5, -64 + br, 1.2, 1.6);
    }
    // headband with a steel plate
    ctx.fillStyle = '#2b2d3a'; ctx.fillRect(-4, -83 + br, 19, 4);
    ctx.fillStyle = '#c9cdd8'; ctx.fillRect(8, -84 + br, 8, 5.5);
    ctx.fillStyle = '#5d6270'; ctx.fillRect(10.5, -82.5 + br, 3, 2.5);
    // front arm: hangs low, raised in a fist while he roars
    ctx.strokeStyle = '#241a16'; ctx.lineWidth = 7;
    const hx = roar ? 24 : 19, hy = roar ? -74 : -29;
    ctx.beginPath(); ctx.moveTo(12, -58 + br); ctx.quadraticCurveTo(roar ? 26 : 22, roar ? -60 : -46, hx, hy); ctx.stroke();
    ctx.fillStyle = '#6b4c3e'; ctx.beginPath(); ctx.arc(hx, hy, 4.6, 0, TAU); ctx.fill();
  }

  // The kuchiyose formula drawn on the ground before Enma appears.
  function summonSeal(ctx, x, y, k, time) {
    const r = 38 * (window.VFXKit ? window.VFXKit.ease.out(k) : k);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .42); ctx.rotate(time * .6);
    ctx.strokeStyle = 'rgba(25,18,14,.75)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      ctx.moveTo(Math.cos(a) * r * .25, Math.sin(a) * r * .25);
      ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
      ctx.moveTo(Math.cos(a + .2) * r * 1.2, Math.sin(a + .2) * r * 1.2);
      ctx.lineTo(Math.cos(a - .2) * r * 1.3, Math.sin(a - .2) * r * 1.3);
    }
    ctx.stroke(); ctx.restore();
  }

  // Hiruzen's Enma: summoned beside him, then turned into the staff he carries.
  function drawEnma(ctx, ally, feetY, facing, time, appear, ready) {
    if (!ally || ally.life <= 0 || !Number.isFinite(ally.enma)) return;
    const e = ally.enma, S = window.AnimeSprites, K = window.VFXKit;
    const ex = ally.x - facing * 36, ey = feetY - 1;
    const handX = ally.x + facing * 13, handY = feetY - 44;
    if (e < appear) {
      if (e > .1) summonSeal(ctx, ex, ey, (e - .1) / (appear - .1), time);
      return;
    }
    const morph = ready - .4;
    if (e < morph + .05) {
      const roar = e > appear + .35 && e < morph - .1 ? .5 + .5 * Math.sin(time * 18) : 0;
      ctx.save(); ctx.translate(ex, ey); ctx.scale(facing * 1.05, 1.05);
      enmaBody(ctx, time, roar);
      ctx.restore();
      if (roar) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,240,200,.55)'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -1 + i * .5, r0 = 16 + (time * 60 + i * 7) % 18;
          ctx.moveTo(ex + facing * (14 + Math.cos(a) * r0), ey - 68 + Math.sin(a) * r0);
          ctx.lineTo(ex + facing * (14 + Math.cos(a) * (r0 + 7)), ey - 68 + Math.sin(a) * (r0 + 7));
        }
        ctx.stroke(); ctx.restore();
      }
    }
    if (S && e < appear + .5) S.drawSmoke(ctx, ex, ey - 20, (e - appear) / .5, 44);
    if (e >= morph && e < ready + .2) {
      if (S) S.drawSmoke(ctx, ex, ey - 32, (e - morph) / .55, 36);
      // the staff spins out of the smoke into Hiruzen's hand
      const u = c01((e - morph - .05) / .35), q = K ? K.ease.inOut(u) : u;
      if (u > 0 && u < 1) {
        const cx = ex + (handX - ex) * q, cy = ey - 50 + (handY - ey + 50) * q - Math.sin(u * Math.PI) * 26;
        const a = u * 9, half = 40;
        if (K) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, cx, cy, 34, '255,200,90', .7); ctx.restore(); }
        rod(ctx, cx - Math.cos(a) * half, cy - Math.sin(a) * half, cx + Math.cos(a) * half, cy + Math.sin(a) * half, 4.5);
      }
    }
    // carried staff (hidden while it is shooting out as a Kongōnyoi strike)
    if (e >= ready - .02 && !(ally.staffOut > 0)) {
      rod(ctx, handX - facing * 6, feetY - 94, handX + facing * 8, feetY + 1, 4.5);
      if (e < ready + .3 && K) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, handX, feetY - 46, 46, '255,210,110', c01(1 - (e - ready + .02) / .32), true);
        ctx.restore();
      }
    }
  }

  // Kongōnyoi: the staff shoots from Hiruzen's hands to `radius` and rams through, then shrinks back.
  function drawStaff(ctx, fx, time, K, overlay) {
    const max = fx.maxLife || .95, life = c01(fx.life / max), age = (1 - life) * max;
    const a = fx.angle || 0, reach = fx.radius || 300, L = window.AnimeSprites ? window.AnimeSprites.LIFT : 24;
    const out = K.ease.out(c01(age / .16)), back = K.ease.in(c01((age - .68) / .25));
    const len = reach * out * (1 - back);
    const ca = Math.cos(a), sa = Math.sin(a);
    const hx = ca * 14, hy = -L - 4 + sa * 7;
    const tx = hx + ca * len, ty = hy + sa * len;
    const gx = ca * reach, gy = sa * reach;
    const hit = c01((age - .13) / .55);
    if (!overlay) {
      // the ground under the tip cracks and blows out
      if (hit > 0 && hit < 1 && K.fx) {
        K.fx.shockRing(ctx, gx, gy, 110, hit, 1 - hit, '255,205,120');
        K.fx.debris(ctx, gx, gy, 90, hit, (fx.x * .01) % 30, '#5a4632', 7);
      }
      ctx.save(); ctx.rotate(a);
      ctx.fillStyle = `rgba(0,0,0,${.22 * (1 - back)})`;
      ctx.fillRect(14, -3, len, 6);
      ctx.restore();
      return;
    }
    if (len < 2) return;
    const w = 5 + out * 5 * (1 - back);
    ctx.globalCompositeOperation = 'lighter';
    // golden chakra wake and speed lines streaming along the rod as it extends
    const wake = 1 - c01((age - .1) / .5);
    if (wake > 0) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,170,60,${.24 * wake})`; ctx.lineWidth = w * 2.4;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = `rgba(255,245,200,${.7 * wake})`; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const o = (K.hash(i * 3.1) - .5) * w * 6, s0 = K.hash(i * 7.7) * .6, s1 = s0 + .25 + K.hash(i) * .2;
        ctx.moveTo(hx + (tx - hx) * s0 - sa * o, hy + (ty - hy) * s0 + ca * o);
        ctx.lineTo(hx + (tx - hx) * s1 - sa * o, hy + (ty - hy) * s1 + ca * o);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    rod(ctx, hx - ca * 30, hy - sa * 15, tx, ty, w);
    // Enma's face grins out of the staff near the tip while it is fully stretched
    const face = c01((age - .12) / .1) * (1 - back);
    if (face > .05) {
      const px = hx + (tx - hx) * .78, py = hy + (ty - hy) * .78;
      ctx.save(); ctx.translate(px, py - w * .4); ctx.scale((ca >= 0 ? 1 : -1) * .95 * face, .95 * face);
      ctx.translate(-6, 74);
      ctx.beginPath(); ctx.rect(-22, -96, 46, 40); ctx.clip();
      enmaBody(ctx, time, .6);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    if (hit > 0 && hit < 1) {
      K.glow(ctx, tx, ty, 50 + hit * 70, '255,225,150', (1 - hit) * .9, true);
      ctx.strokeStyle = `rgba(255,250,225,${1 - hit})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + K.hash(i + 5) * .4, r0 = 14 + hit * 50, r1 = r0 + 22 * (1 - hit);
        ctx.moveTo(tx + Math.cos(an) * r0, ty + Math.sin(an) * r0 * .7); ctx.lineTo(tx + Math.cos(an) * r1, ty + Math.sin(an) * r1 * .7);
      }
      ctx.stroke();
    }
    K.glow(ctx, tx, ty, 18, '255,230,150', .8 * (1 - back), true);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Kongō Rōheki: Adamantine Staffs drop in a ring and lock together with golden chakra bands.
  // The back half draws under the characters and the front half over them.
  function drawPrison(ctx, fx, time, K, overlay) {
    const max = fx.maxLife || 1.9, life = c01(fx.life / max), age = (1 - life) * max;
    const r = fx.radius || 150, H = r * .95, N = 16, seed = (fx.x * .013 + fx.y * .021) % 40;
    const vanish = c01((age - (max - .38)) / .38);
    const S = window.AnimeSprites;
    if (!overlay && K.fx) {
      const slam = c01((age - .18) / .7);
      if (slam > 0 && slam < 1) K.fx.shockRing(ctx, 0, 0, r * 1.25, slam, 1 - slam, '255,210,120');
      ctx.fillStyle = `rgba(48,34,22,${.4 * (1 - vanish)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * .5, 0, 0, TAU); ctx.fill();
    }
    // the cage bands: back arcs under everyone, front arcs over
    const band = c01((age - .3) / .2) * (1 - vanish);
    const drawBands = () => {
      if (band <= 0) return;
      ctx.globalCompositeOperation = 'lighter';
      const a0 = overlay ? 0 : Math.PI, a1 = overlay ? Math.PI : TAU;
      for (const [h, wd] of [[H * .9, 5], [H * .45, 3.5]]) {
        ctx.strokeStyle = `rgba(255,190,70,${.35 * band})`; ctx.lineWidth = wd * 3;
        ctx.beginPath(); ctx.ellipse(0, -h, r, r * .5, 0, a0, a1); ctx.stroke();
        ctx.strokeStyle = `rgba(255,240,190,${.9 * band * (.8 + .2 * Math.sin(time * 14))})`; ctx.lineWidth = wd;
        ctx.beginPath(); ctx.ellipse(0, -h, r, r * .5, 0, a0, a1); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    if (!overlay) drawBands();
    const dust = K.puff('dust');
    for (let i = 0; i < N; i++) {
      const an = i * TAU / N + (fx.angle || 0), sin = Math.sin(an);
      if ((sin >= 0) !== overlay) continue;
      const x = Math.cos(an) * r, y = sin * r * .5;
      const land = .04 + K.hash(i * 1.7 + seed) * .14, t = c01((age - land + .16) / .16);
      if (t <= 0) continue;
      const drop = (1 - K.ease.in(t)) * 280;
      if (vanish < .5) {
        ctx.save(); ctx.globalAlpha *= 1 - vanish * 2;
        rod(ctx, x, y - H - drop, x, y - drop, 7);
        ctx.restore();
      }
      if (t >= 1) {
        const k = c01((age - land) / .45);
        if (k < 1) {
          K.stamp(ctx, dust, x, y - 6 - k * 10, 14 + k * 22, (1 - k) * .55);
          if (k < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - 4, 30, '255,230,170', 1 - k / .25, true); ctx.globalCompositeOperation = 'source-over'; }
        }
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,220,140,${.5 * t})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y - H - drop - 60); ctx.lineTo(x, y - H - drop); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      if (S && vanish > 0) S.drawSmoke(ctx, x, y - H * .4, vanish, 20);
    }
    if (overlay) {
      drawBands();
      const flash = c01((age - .17) / .25);
      if (flash > 0 && flash < 1) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 0, -H * .4, r * 1.2, '255,220,140', (1 - flash) * .7, false, .6); ctx.globalCompositeOperation = 'source-over'; }
    }
  }

  function drawStaffFx(ctx, fx, time, K, overlay) {
    if (!fx || fx.life <= 0 || !Number.isFinite(fx.x) || !Number.isFinite(fx.y)) return;
    ctx.save(); ctx.translate(fx.x, fx.y);
    if (fx.kind === 'staff') drawStaff(ctx, fx, time, K, overlay);
    else drawPrison(ctx, fx, time, K, overlay);
    ctx.restore();
  }

  function drawEffect(ctx, fx, time, K) {
    if (!fx || fx.life <= 0 || !Number.isFinite(fx.x) || !Number.isFinite(fx.y)) return;
    if (fx.kind === 'forest') return drawForest(ctx, fx, time, K);
    if (fx.kind === 'staff' || fx.kind === 'prison') return drawStaffFx(ctx, fx, time, K, false);
    const life = clamp(fx.life / (fx.maxLife || .6), 0, 1);
    const age = 1 - life;
    const radius = clamp(fx.radius || 120, 20, 360);
    ctx.save();
    ctx.translate(fx.x, fx.y);
    ctx.globalAlpha *= Math.min(1, life * 2.4);

    if (fx.kind === 'wood') drawWood(ctx, fx, life, age, radius, time, K);
    else if (fx.kind === 'water') drawWater(ctx, fx, life, age, radius, time, K);
    else if (fx.kind === 'fire') drawFire(ctx, fx, life, age, radius, time, K);
    else if (fx.kind === 'flash') drawFlash(ctx, fx, life, age, radius, time, K);

    if (fx.signature) {
      const order = ['wood', 'water', 'fire', 'flash'].indexOf(fx.kind);
      const bright = fx.kind === 'wood' ? '#d5ffae' : fx.kind === 'water' ? '#c7f8ff' :
        fx.kind === 'fire' ? '#ffdf91' : '#fffbd0';
      ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.scale(1, .5);
      ring(ctx, 0, 0, radius * (.36 + K.ease.out(age * 1.5) * .6), bright, 5 * life + 1);
      ctx.restore();
      K.glow(ctx, 0, 0, radius * .9, GLOW_RGB[Math.max(0, order)], .3 * life, false, .5);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // Chakra ring and orbiting element motes around each Hokage's feet; the body is an AnimeSprites character.
  function drawAura(ctx, ally, time) {
    if (!ally || ally.life <= 0 || !Number.isFinite(ally.x) || !Number.isFinite(ally.y)) return;
    const K = window.VFXKit;
    const order = clamp(Math.floor(ally.order || 1), 1, 4);
    const color = COLORS[order - 1], rgb = GLOW_RGB[order - 1];
    const age = Math.max(0, (ally.maxLife || 16) - ally.life);
    const pulse = Math.sin(time * 5 + order) * 1.6;
    ctx.save();
    ctx.translate(ally.x, ally.y + 3);
    if (K) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 0, 0, 34, rgb, .35, false, .42); ctx.globalCompositeOperation = 'source-over'; }
    ctx.scale(1, .42);
    ring(ctx, 0, 0, 24 + pulse, color, 2.4);
    ctx.globalAlpha *= .75;
    for (let i = 0; i < 3; i++) {
      const a = time * (order === 4 ? 3.6 : 1.3) + i * TAU / 3 + order;
      const x = Math.cos(a) * 28, y = Math.sin(a) * 28;
      if (order === 1) leaf(ctx, x, y, a, 5, '#b7ec8e');
      else if (order === 2) {
        ctx.fillStyle = '#d0f8ff'; ctx.beginPath(); ctx.ellipse(x, y, 4, 3, a, 0, TAU); ctx.fill();
      } else if (order === 3) {
        ctx.fillStyle = '#ffc565'; ctx.beginPath(); ctx.moveTo(x, y - 7);
        ctx.lineTo(x - 4, y + 4); ctx.lineTo(x + 4, y + 4); ctx.fill();
      } else kunai(ctx, x, y, a, .7);
    }
    ctx.restore();
    // Arrival flash and attack pulse rise from the summoning seal.
    if (age < .55) {
      const k = age / .55;
      ctx.save(); ctx.globalAlpha *= 1 - k;
      if (K) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, ally.x, ally.y - 20, 40 + k * 40, rgb, .8, true); }
      ring(ctx, ally.x, ally.y - 20, 17 + (K ? K.ease.out(k) : k) * 83, color, 4);
      ctx.restore();
    }
    if (ally.attackPulse > 0) {
      const k = clamp(ally.attackPulse / .35, 0, 1);
      ctx.save(); ctx.globalAlpha *= k;
      if (K) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, ally.x, ally.y - 22, 30, rgb, .6 * k); }
      ring(ctx, ally.x, ally.y - 22, 22 + (1 - k) * 22, color, 4 * k + 1);
      ctx.restore();
    }
  }

  window.HokageVFX = {
    drawAura,
    drawEnma,
    // Parts of Enma's staff jutsu that stand in front of the characters.
    drawOverlay(ctx, state, elapsed) {
      const K = window.VFXKit;
      if (!ctx || !state || !K || !Array.isArray(state.effects)) return;
      const time = Number.isFinite(elapsed) ? elapsed : 0;
      for (const fx of state.effects) if (fx && (fx.kind === 'staff' || fx.kind === 'prison')) drawStaffFx(ctx, fx, time, K, true);
    },
    drawEffects(ctx, state, elapsed) {
      const K = window.VFXKit;
      if (!ctx || !state || !K) return;
      const time = Number.isFinite(elapsed) ? elapsed : 0;
      const effects = Array.isArray(state.effects) ? state.effects : [];
      // Forests first (they cover the battlefield), then the newest small jutsu on top. The game caps
      // live effects; this draw cap protects frames even if callers do not.
      for (const fx of effects) if (fx && fx.kind === 'forest') drawEffect(ctx, fx, time, K);
      for (let i = Math.max(0, effects.length - 24); i < effects.length; i++)
        if (effects[i] && effects[i].kind !== 'forest') drawEffect(ctx, effects[i], time, K);
    }
  };
})();
