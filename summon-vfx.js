(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const SCALE = 1.32;            // the titan towers over the ninja sprites
  const ARRIVE = 1.05;           // seconds of summoning smoke

  // Ten-Tails (Jūbi) palette: ash-grey hide with a violet cast, bone horns and claws.
  const C = {
    line: '#130e17', skin: '#6d6577', light: '#958ca5', dark: '#463e51', deep: '#2e2836',
    far: '#4f4859', bone: '#e6dfd2', boneDark: '#a99f90', vein: 'rgba(30,20,40,.45)'
  };

  // ------------------------------------------------------------------ tails
  // One tapered, wave-animated tail (root thick, needle tip). Points are integrated along a
  // curling spine so the ten of them read as living tails rather than a fan of spikes.
  const LEFT = new Float32Array(26), RIGHT = new Float32Array(26);
  function tail(ctx, i, time, rage) {
    const near = i % 2 === 1;
    const spread = i / 9;                                  // 0 = trailing back, 1 = arching over the hump
    const a0 = Math.PI * (1.0 + spread * .62) + Math.sin(time * .9 + i * 2.1) * .05;
    const len = 120 + Math.sin(spread * Math.PI) * 62 + (i % 3) * 10;
    const curl = spread < .3 ? (.5 + (i % 3) * .15) : -(.25 + spread * .45 + (i % 3) * .12);
    const sx = -30 + spread * 10, sy = -52 - spread * 18;
    const N = 12, W = near ? 12.5 : 10.5;
    let x = sx, y = sy;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = a0 + curl * t * t + Math.sin(time * (1.5 + rage) + i * 1.3 - t * 6.2) * (.5 + rage * .15) * t;
      if (k) { x += Math.cos(a) * len / N; y += Math.sin(a) * len / N; }
      const w = W * Math.pow(1 - t, .75) + 1;
      const nx = -Math.sin(a), ny = Math.cos(a);
      LEFT[k * 2] = x + nx * w; LEFT[k * 2 + 1] = y + ny * w;
      RIGHT[k * 2] = x - nx * w; RIGHT[k * 2 + 1] = y - ny * w;
    }
    ctx.beginPath(); ctx.moveTo(LEFT[0], LEFT[1]);
    for (let k = 1; k <= N; k++) ctx.lineTo(LEFT[k * 2], LEFT[k * 2 + 1]);
    for (let k = N; k >= 0; k--) ctx.lineTo(RIGHT[k * 2], RIGHT[k * 2 + 1]);
    ctx.closePath();
    ctx.fillStyle = near ? C.skin : C.far; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2.2; ctx.stroke();
    // Lit ridge along the upper edge + darker underside band.
    ctx.strokeStyle = near ? 'rgba(200,192,215,.55)' : 'rgba(170,160,185,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(LEFT[2], LEFT[3]);
    for (let k = 2; k <= N - 2; k++) ctx.lineTo(LEFT[k * 2] * .7 + RIGHT[k * 2] * .3, LEFT[k * 2 + 1] * .7 + RIGHT[k * 2 + 1] * .3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(25,18,32,.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(RIGHT[2], RIGHT[3]);
    for (let k = 2; k <= N - 3; k++) ctx.lineTo(RIGHT[k * 2] * .8 + LEFT[k * 2] * .2, RIGHT[k * 2 + 1] * .8 + LEFT[k * 2 + 1] * .2);
    ctx.stroke();
    // Bony spines on the outer edge.
    ctx.fillStyle = C.deep;
    for (let k = 2; k <= 8; k += 3) {
      const px = LEFT[k * 2], py = LEFT[k * 2 + 1], qx = LEFT[k * 2 + 2], qy = LEFT[k * 2 + 3];
      const dx = qx - px, dy = qy - py, d = Math.hypot(dx, dy) || 1, s = 7 - k * .45;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dx * .5 - dy / d * s + dx / d * s * .6, py + dy * .5 + dx / d * s + dy / d * s * .6); ctx.lineTo(qx, qy); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ eye
  // Rinne Sharingan: blood-red iris with concentric ripple rings and nine tomoe (three per ring).
  function rinneSharingan(ctx, x, y, r, time, flare) {
    ctx.fillStyle = C.deep; ctx.beginPath(); ctx.ellipse(x, y, r * 1.38, r * 1.08, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f0e2df'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.22, r * .95, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#c8101f'; ctx.beginPath(); ctx.arc(x + r * .08, y, r * .9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ef3a3a'; ctx.beginPath(); ctx.arc(x + r * .02, y - r * .12, r * .6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8101f'; ctx.beginPath(); ctx.arc(x + r * .08, y, r * .5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3c0309'; ctx.lineWidth = Math.max(1, r * .07);
    const rings = [.24, .48, .72];
    for (const k of rings) { ctx.beginPath(); ctx.arc(x + r * .08, y, r * .9 * k, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x + r * .08, y, r * .9, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#1e0205';
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 3; i++) {
      const a = time * (.5 - ring * .12) * (ring % 2 ? -1 : 1) + i * TAU / 3 + ring * .7, d = r * .9 * rings[ring];
      const tx = x + r * .08 + Math.cos(a) * d, ty = y + Math.sin(a) * d, tr = r * (.07 + ring * .012);
      ctx.beginPath(); ctx.arc(tx, ty, tr, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx + Math.cos(a + 1.6) * tr, ty + Math.sin(a + 1.6) * tr);
      ctx.quadraticCurveTo(tx + Math.cos(a + .6) * tr * 2.4, ty + Math.sin(a + .6) * tr * 2.4, tx + Math.cos(a - .9) * tr * 2.6, ty + Math.sin(a - .9) * tr * 2.6);
      ctx.lineTo(tx + Math.cos(a - 1.6) * tr, ty + Math.sin(a - 1.6) * tr); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x + r * .08, y, r * .12, 0, TAU); ctx.fill();
    // Heavy upper lid shadow makes the stare menacing.
    ctx.fillStyle = 'rgba(30,10,30,.55)';
    ctx.beginPath(); ctx.ellipse(x, y - r * 1.05, r * 1.5, r * .55, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(255,236,236,${.8 + flare * .2})`;
    ctx.beginPath(); ctx.arc(x - r * .38, y - r * .25, r * .14, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.22, r * .95, 0, 0, TAU); ctx.stroke();
    // Angry brow ridge.
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.moveTo(x - r * 1.6, y - r * 1.2); ctx.quadraticCurveTo(x, y - r * .62, x + r * 1.55, y - r * 1.05);
    ctx.lineTo(x + r * 1.4, y - r * 1.5); ctx.quadraticCurveTo(x, y - r * 1.35, x - r * 1.5, y - r * 1.65); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.6; ctx.stroke();
  }

  // ------------------------------------------------------------------ limbs
  function limb(ctx, x0, y0, x1, y1, x2, y2, w, fill) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = C.line; ctx.lineWidth = w + 4.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x1, y1, x2, y2); ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x1, y1, x2, y2); ctx.stroke();
  }
  function claws(ctx, x, y, dir, size) {
    ctx.fillStyle = C.bone; ctx.strokeStyle = C.line; ctx.lineWidth = 1.4;
    for (let c = -1; c <= 1; c++) {
      const bx = x + c * size * .55;
      ctx.beginPath(); ctx.moveTo(bx - size * .3, y); ctx.quadraticCurveTo(bx + dir * size * .2, y + size * .5, bx + dir * size * .55, y + size * .85);
      ctx.lineTo(bx + size * .3, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // Fixed layout of the summoning-smoke billows (angle, start distance, travel, size), sorted back-to-front.
  const SMOKE = [];
  for (let i = 0; i < 22; i++) {
    const h = n => { const v = Math.sin((i * 7.3 + n) * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const inner = i < 8;
    SMOKE.push({ a: i * 2.39996 + h(1) * .4, inner, d0: inner ? 8 + h(2) * 22 : 26 + h(2) * 30,
      d1: inner ? 24 + h(3) * 24 : 50 + h(3) * 45, r: inner ? 40 + h(4) * 16 : 30 + h(4) * 22, up: h(5) * 40 });
  }
  const SMOKE_ORDER = SMOKE.map((_, i) => i).sort((p, q) => Math.sin(SMOKE[p].a) * SMOKE[p].d1 - Math.sin(SMOKE[q].a) * SMOKE[q].d1);

  // Cel-shaded summoning-smoke billow: white crown, lavender-grey shadow side, inked rim.
  // Drawn in passes over all billows (ink rim, then lavender-shaded white body) so the puffs merge
  // into one cloud silhouette instead of reading as separate balls.
  function cloudSprite(K, pass) {
    return K.sprite('jubiCloud' + pass, 64, 64, g => {
      if (pass === 0) { g.fillStyle = '#6f6590'; g.beginPath(); g.arc(32, 32, 31.5, 0, TAU); g.fill(); return; }
      g.fillStyle = '#bdb4d4'; g.beginPath(); g.arc(32, 32, 29.5, 0, TAU); g.fill();
      const gr = g.createRadialGradient(26, 24, 2, 28, 27, 25);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(.7, '#f7f5fb'); gr.addColorStop(1, '#e6e1ef');
      g.fillStyle = gr; g.beginPath(); g.arc(28.4, 27.3, 24.8, 0, TAU); g.fill();
    });
  }

  // Tracks each summon's attack pulses so a ranged shot (short pulse) can be told from a stomp.
  const pulses = new WeakMap();

  function drawOne(ctx, summon, elapsed) {
    if (!summon || !Number.isFinite(summon.x) || !Number.isFinite(summon.y) || summon.life <= 0) return;
    const K = window.VFXKit;
    const time = Number.isFinite(elapsed) ? elapsed : 0;
    const age = Math.max(0, (summon.maxLife || 15) - summon.life);
    const alpha = Math.min(1, summon.life / .55, age / .45);
    const facing = Math.cos(summon.angle || 0) >= 0 ? 1 : -1;
    const breathe = Math.sin(time * 2.2 + summon.x * .02) * 1.8;
    const k = SCALE;
    const baseAlpha = ctx.globalAlpha;
    const pulse = summon.attackPulse > 0 ? summon.attackPulse : 0;
    let track = pulses.get(summon);
    if (!track) { track = { last: 0, peak: 0 }; pulses.set(summon, track); }
    if (pulse > track.last + .01) track.peak = pulse;
    track.last = pulse;
    const target = summon.target && summon.target.health > 0 && Number.isFinite(summon.target.x) ? summon.target : null;
    const gap = target ? Math.hypot(target.x - summon.x, target.y - summon.y) : 0;
    // The game starts a stomp at pulse .24 / flash .2 and a shot at .18 / .16; both tick down together.
    const ranged = pulse > 0 && (summon.hitFlash > 0 ? pulse - summon.hitFlash < .03 : track.peak < .21);
    // Anticipation before the next attack (the game fires when attackTimer reaches 0).
    const timer = Number.isFinite(summon.attackTimer) ? summon.attackTimer : 1;
    const windMelee = target && pulse <= 0 && gap < 205 ? clamp01(1 - timer / .3) : 0;
    const windShot = target && pulse <= 0 && gap >= 205 && gap < 600 ? clamp01(1 - timer / .42) : 0;
    const slam = pulse > 0 && !ranged ? clamp01(pulse / .24) : 0;          // 1 at impact → 0
    const recoil = pulse > 0 && ranged ? clamp01(pulse / Math.max(.05, track.peak)) : 0;
    const rage = Math.max(windMelee, windShot, slam, recoil);
    const fx = summon.x, fy = summon.y + 3;

    // ---- Summoning seal on the ground: ink rings with radiating script, lit violet from below.
    ctx.save(); ctx.translate(fx, fy); ctx.scale(1, .42);
    const sealIn = K ? K.ease.out(age / .5) : 1;
    ctx.globalAlpha = baseAlpha * Math.min(1, summon.life / .55) * .85;
    if (K) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, 0, 0, 170 * sealIn, '140,50,220', .3 + (age < 1.2 ? (1 - age / 1.2) * .6 : 0) + rage * .15);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.rotate(time * .05);
    ctx.strokeStyle = 'rgba(26,10,34,.75)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 112 * sealIn, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 94 * sealIn, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = i * TAU / 20, r0 = 98 * sealIn, r1 = (122 + (i % 2) * 18) * sealIn;
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      // little script ticks across each spoke
      const m = (r0 + r1) / 2, c = Math.cos(a + .06), s = Math.sin(a + .06);
      ctx.moveTo(c * m - s * 4, s * m + c * 4); ctx.lineTo(c * m + s * 4, s * m - c * 4);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210,150,255,.5)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 104 * sealIn, time * .3, time * .3 + 4.4); ctx.stroke();
    ctx.fillStyle = 'rgba(12,6,16,.5)'; ctx.beginPath(); ctx.ellipse(0, 0, 84, 72, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // ---- Dark chakra smouldering off the titan.
    if (K) {
      ctx.save(); ctx.globalAlpha = baseAlpha * alpha;
      const vio = K.puff('violet');
      for (let i = 0; i < 7; i++) {
        const ph = (time * (.4 + rage * .3) + i / 7) % 1;
        const px = fx + (K.hash(i * 3.1) - .5) * 120 * k + Math.sin(ph * 5 + i) * 8, py = fy - 40 * k - ph * 130;
        K.stamp(ctx, vio, px, py, 22 + ph * 30, Math.sin(Math.PI * ph) * (.35 + rage * .2));
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx, fy - 80 * k, 150, '120,40,200', .22 + Math.sin(time * 3) * .04 + rage * .15);
      ctx.restore();
    }

    // ---- The titan.
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(facing * k, k);
    ctx.globalAlpha = baseAlpha * alpha;
    ctx.lineJoin = 'round';
    // Soft contact shadow.
    ctx.fillStyle = 'rgba(10,6,14,.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 62, 15, 0, 0, TAU); ctx.fill();

    // Rear up during the melee wind-up, crash down on the slam.
    const rear = windMelee * 8 - slam * slam * 6;
    const lean = recoil * -4 + windShot * 3;
    ctx.save(); ctx.translate(lean, 0);
    for (let i = 0; i < 10; i += 2) tail(ctx, i, time, rage);
    for (let i = 1; i < 10; i += 2) tail(ctx, i, time, rage);
    ctx.restore();

    const by = breathe - rear;                         // vertical offset of the upper body
    const lift = windMelee, hit = slam;
    // Far arm (behind the torso): bowed gorilla arm, darker.
    const fhx = 58 + hit * 22 - lift * 8, fhy = -8 - lift * 112 + hit * 6;
    const fex = 62 + lift * 6 + hit * 10, fey = -64 + by - lift * 52;
    limb(ctx, 18 + lean, -112 + by, 44 + lift * 4, -100 + by - lift * 30, fex, fey, 17, C.far);
    limb(ctx, fex, fey, fex + 4, (fey + fhy) / 2, fhx, fhy, 12, C.far);
    claws(ctx, fhx, fhy - 2, 1, 7);

    // Legs: thick bent haunches with clawed feet.
    for (const [lx, fill] of [[-34, C.far], [6, C.skin]]) {
      ctx.fillStyle = fill; ctx.strokeStyle = C.line; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(lx - 16, -56); ctx.quadraticCurveTo(lx - 26, -30, lx - 10, -18);
      ctx.lineTo(lx - 13, -2); ctx.lineTo(lx + 17, -2); ctx.lineTo(lx + 11, -20);
      ctx.quadraticCurveTo(lx + 22, -40, lx + 16, -60); ctx.closePath(); ctx.fill(); ctx.stroke();
      claws(ctx, lx + 3, -4, 1, 6);
    }

    // Massive hunched torso: a bulbous hump rolling forward into the shoulders.
    ctx.save(); ctx.translate(lean * .6, 0);
    ctx.beginPath();
    ctx.moveTo(-50, -44);
    ctx.bezierCurveTo(-74, -78 + by, -60, -138 + by, -16, -146 + by);
    ctx.bezierCurveTo(14, -152 + by, 40, -136 + by, 44, -110 + by);
    ctx.bezierCurveTo(48, -84 + by, 36, -48, 18, -36);
    ctx.quadraticCurveTo(-16, -26, -50, -44);
    ctx.closePath();
    ctx.fillStyle = C.skin; ctx.fill();
    ctx.save(); ctx.clip();
    // Cel shading: shadow under the hump's curve and along the belly, lit crest on top.
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.moveTo(-80, -150); ctx.bezierCurveTo(-56, -110 + by, -40, -60, 10, -40); ctx.lineTo(10, 0); ctx.lineTo(-80, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.light;
    ctx.beginPath(); ctx.moveTo(-58, -110 + by); ctx.bezierCurveTo(-48, -142 + by, 20, -156 + by, 40, -118 + by);
    ctx.bezierCurveTo(14, -138 + by, -26, -136 + by, -58, -110 + by); ctx.fill();
    // Wrinkled, bark-like ridges across the hide.
    ctx.strokeStyle = C.vein; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x0, y0, x1, y1, cx, cy] of [[-52, -96, -14, -122, -36, -118], [-44, -76, 4, -100, -24, -98], [-30, -58, 20, -78, -6, -76],
      [-8, -128, 30, -122, 10, -134], [8, -106, 38, -96, 24, -108], [-20, -46, 12, -56, -4, -54]]) {
      ctx.moveTo(x0, y0 + by); ctx.quadraticCurveTo(cx, cy + by, x1, y1 + by);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2.8; ctx.stroke();
    // Dorsal ridge spikes along the crest of the hump.
    ctx.fillStyle = C.deep; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      const t = i / 6, a = Math.PI * (1.05 + t * .55);
      const x = -12 + Math.cos(a) * 54, y = -96 + by + Math.sin(a) * 50, s = 9 + Math.sin(t * Math.PI) * 6;
      const ox = Math.cos(a), oy = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(x - oy * 5, y + ox * 5); ctx.lineTo(x + ox * s - oy * 4, y + oy * s + ox * 4); ctx.lineTo(x + oy * 5, y - ox * 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    // Near arm: long bowed gorilla arm, knuckles on the ground at rest.
    const nhx = 46 + hit * 26 - lift * 4, nhy = -4 - lift * 118 + hit * 2;
    const nex = 50 + lift * 10 + hit * 12, ney = -60 + by - lift * 56;
    limb(ctx, 8 + lean, -110 + by, 34 + lift * 6, -96 + by - lift * 30, nex, ney, 19, C.skin);
    limb(ctx, nex, ney, nex + 4, (ney + nhy) / 2, nhx, nhy, 14, C.skin);
    ctx.strokeStyle = 'rgba(205,196,222,.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10 + lean, -116 + by); ctx.quadraticCurveTo(36 + lift * 6, -104 + by - lift * 30, nex + 2, ney - 6); ctx.stroke();
    // Fist / knuckles.
    ctx.fillStyle = C.skin; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(nhx, nhy - 6, 10, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    claws(ctx, nhx + 2, nhy - 2, 1, 7);

    // Head: low, thrust forward from the hump — horn crown, single eye, cavernous maw.
    const hx = 44 + lean * 1.4, hy = -124 + by + recoil * -3, HS = 1.18;
    ctx.save(); ctx.translate(hx, hy); ctx.scale(HS, HS); ctx.translate(-hx, -hy);
    const gape = Math.max(windShot * .8, recoil, slam * .7, windMelee * .5);
    ctx.fillStyle = C.skin; ctx.strokeStyle = C.line; ctx.lineWidth = 2.6;
    ctx.beginPath();
    // Rounded skull tapering into a heavy, under-slung jaw.
    ctx.moveTo(hx - 24, hy + 8);
    ctx.bezierCurveTo(hx - 30, hy - 14, hx - 18, hy - 28, hx + 2, hy - 27);
    ctx.bezierCurveTo(hx + 22, hy - 26, hx + 32, hy - 12, hx + 31, hy + 2);
    ctx.quadraticCurveTo(hx + 34, hy + 14, hx + 24, hy + 20 + gape * 7);
    ctx.quadraticCurveTo(hx + 2, hy + 30 + gape * 11, hx - 16, hy + 20);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.ellipse(hx + 2, hy + 26 + gape * 6, 34, 14, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx - 30, hy + 2, 12, 30, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(205,196,222,.45)';
    ctx.beginPath(); ctx.ellipse(hx, hy - 20, 22, 7, -.1, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.stroke();
    // Horn crown, swept back.
    for (const [ox, oy, len, ang, w] of [[-20, -16, 26, -2.55, 5], [-12, -23, 34, -2.25, 6], [-2, -26, 40, -1.95, 6.5], [9, -26, 36, -1.65, 6], [19, -22, 28, -1.35, 5], [26, -14, 20, -1.05, 4]]) {
      const x0 = hx + ox, y0 = hy + oy, tx = x0 + Math.cos(ang) * len, ty = y0 + Math.sin(ang) * len;
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      ctx.beginPath(); ctx.moveTo(x0 - nx * w, y0 - ny * w);
      ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * .6 - nx * w * .2, y0 + Math.sin(ang) * len * .6 - ny * w * .2, tx - 6, ty + 2);
      ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * .5 + nx * w * .6, y0 + Math.sin(ang) * len * .5 + ny * w * .6, x0 + nx * w, y0 + ny * w);
      ctx.closePath();
      ctx.fillStyle = C.bone; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = C.boneDark; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x0 + nx * w * .4, y0 + ny * w * .4); ctx.lineTo((x0 + tx) / 2 + nx * w * .2, (y0 + ty) / 2 + ny * w * .2); ctx.stroke();
    }
    // The one great eye.
    const flare = Math.max(rage, summon.hitFlash > 0 ? Math.min(1, summon.hitFlash * 5) : 0);
    rinneSharingan(ctx, hx + 2, hy - 7, 11.5, time, flare);
    // Maw: a wide jagged grin that splits the lower face.
    const my0 = hy + 9;
    ctx.fillStyle = '#1c070d';
    ctx.beginPath(); ctx.moveTo(hx - 20, my0);
    ctx.quadraticCurveTo(hx + 4, my0 + 4, hx + 28, my0 - 2);
    ctx.quadraticCurveTo(hx + 6, my0 + 12 + gape * 16, hx - 20, my0);
    ctx.fill();
    if (gape > .05) { ctx.fillStyle = 'rgba(120,20,40,.8)'; ctx.beginPath(); ctx.ellipse(hx + 5, my0 + 4 + gape * 6, 10, 2 + gape * 4, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C.bone;
    for (let i = 0; i < 8; i++) {
      const t = i / 7, x = hx - 17 + t * 42, yTop = my0 + Math.sin(t * Math.PI) * 2 - t * 2;
      ctx.beginPath(); ctx.moveTo(x - 2.4, yTop); ctx.lineTo(x, yTop + 4.5 + (i % 2) * 1.5); ctx.lineTo(x + 2.4, yTop); ctx.fill();
      const yBot = my0 + Math.sin(t * Math.PI) * (8 + gape * 16) - t * 2;
      if (i > 0 && i < 7) { ctx.beginPath(); ctx.moveTo(x - 2.2, yBot); ctx.lineTo(x + .5, yBot - 4 - (i % 2)); ctx.lineTo(x + 2.4, yBot); ctx.fill(); }
    }
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(hx - 20, my0); ctx.quadraticCurveTo(hx + 4, my0 + 4, hx + 28, my0 - 2); ctx.stroke();

    ctx.restore();
    // Eye glow + attack flare: the Rinne Sharingan blazes red, the hide is rim-lit violet.
    if (K) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx + 2 * HS, hy - 7 * HS, 26 + flare * 22, '255,40,60', .35 + flare * .45 + Math.sin(time * 4) * .06);
      if (flare > .05) K.glow(ctx, 0, -80 + by, 90, '170,70,255', flare * .3);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    const mx = fx + facing * k * (hx + 8 * HS), my = fy + k * (hy + (my0 + 4 - hy) * HS);

    // ---- Tailed-Beast Bomb: dark and white chakra spiral into the maw, then it fires.
    if (K && (windShot > 0 || recoil > 0)) {
      ctx.save(); ctx.globalAlpha = baseAlpha * alpha;
      const g = windShot > 0 ? windShot : recoil;
      const r = windShot > 0 ? 5 + 17 * K.ease.outBack(windShot) : 22 * recoil;
      // Converging chakra motes: dark violet and white, spiralling inward.
      if (windShot > 0) {
        ctx.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          const ph = (time * 1.8 + K.hash(i * 2.7)) % 1, a = i * TAU / 14 + ph * 2.2;
          const d = r + (1 - ph) * (70 + K.hash(i) * 40), px = mx + Math.cos(a) * d, py = my + Math.sin(a) * d * .8;
          const tx = mx + Math.cos(a - .35) * (d + 16), ty = my + Math.sin(a - .35) * (d + 16) * .8;
          ctx.strokeStyle = i % 2 ? `rgba(40,8,70,${.8 * ph})` : `rgba(255,235,255,${.9 * ph})`;
          ctx.lineWidth = i % 2 ? 3 : 2;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, mx, my, r * 3.4 + 10, '160,50,255', .55 + g * .3);
      if (recoil > 0) {
        // Muzzle blast: flash cone and a shock ring blown toward the target.
        K.glow(ctx, mx, my, 70 * recoil + 20, '230,180,255', recoil, true);
        // Blast streaks shooting out of the maw toward the target.
        const a = summon.angle || 0, go = 1 - recoil;
        ctx.strokeStyle = `rgba(235,205,255,${recoil * .9})`; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const da = (K.hash(i * 3.9) - .5) * .9, l0 = 18 + go * 50 + K.hash(i) * 20, l1 = l0 + 26 + K.hash(i * 2.2) * 40;
          ctx.moveTo(mx + Math.cos(a + da) * l0, my + Math.sin(a + da) * l0);
          ctx.lineTo(mx + Math.cos(a + da) * l1, my + Math.sin(a + da) * l1);
        }
        ctx.lineWidth = 2.2; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (r > 1) {
        const orb = K.sphere('beast', [[0, '#5a2378'], [.3, '#1c0828'], [.7, '#07020b'], [.88, '#2c0a44'], [.95, 'rgba(214,124,255,.95)'], [1, 'rgba(214,124,255,0)']]);
        ctx.drawImage(orb, mx - r, my - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, K.swirl('beast', ['rgba(220,120,255,.9)', 'rgba(255,170,230,.7)', 'rgba(140,60,255,.85)'], 8, .7, .12), mx, my, r * .95, time * 8, .8);
      }
      ctx.restore();
    }

    // ---- Ground slam: shock ring, flying dust and rock, fissures.
    if (slam > 0) {
      const spread = 1 - slam;
      const e = K ? K.ease.out(spread * 1.2) : spread;
      ctx.save(); ctx.translate(fx + facing * 26, fy);
      ctx.globalAlpha = baseAlpha * alpha;
      // fissures (dark, normal blend) on the flattened ground plane
      ctx.save(); ctx.scale(1, .5);
      ctx.strokeStyle = `rgba(26,14,30,${.85 * Math.min(1, slam * 2.5)})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9 + .3, r2 = 50 + e * 120;
        ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
        ctx.lineTo(Math.cos(a + .14) * r2 * .5, Math.sin(a + .14) * r2 * .5);
        ctx.lineTo(Math.cos(a - .06) * r2 * .8, Math.sin(a - .06) * r2 * .8);
        ctx.lineTo(Math.cos(a + .05) * r2, Math.sin(a + .05) * r2);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(${'72,20,150'},${.55 * slam})`; ctx.lineWidth = 12 * slam + 3;
      ctx.beginPath(); ctx.arc(0, 0, 60 + e * 130, 0, TAU); ctx.stroke();
      ctx.restore();
      if (K) {
        // dust billows rolling outward: dark underside then lit top
        const dust = K.puff('dust'), smoke = K.puff('smoke');
        for (let i = 0; i < 14; i++) {
          const a = i * TAU / 14 + K.hash(i) * .4, d = 50 + e * (120 + K.hash(i * 3) * 40);
          const px = Math.cos(a) * d, py = Math.sin(a) * d * .45 - e * 14, r = 14 + e * 20;
          K.stamp(ctx, smoke, px + 3, py + 5, r * 1.15, slam * .3, .6);
          K.stamp(ctx, dust, px, py, r, Math.min(1, slam * 1.6) * .55, .6);
        }
        // rock chunks thrown up
        ctx.fillStyle = '#3a3036';
        for (let i = 0; i < 10; i++) {
          const a = K.hash(i * 5.3) * TAU, d = 30 + e * (80 + K.hash(i) * 70);
          const up = spread * 120 * (.5 + K.hash(i * 2.2) * .5) - spread * spread * 150;
          if (up < -4) continue;
          const s = 3 + K.hash(i * 7.1) * 4;
          ctx.fillRect(Math.cos(a) * d - s / 2, Math.sin(a) * d * .45 - up - s / 2, s, s * .8);
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, 0, 0, 100 + e * 100, '190,90,255', slam * .5, false, .5);
        if (slam > .8) K.glow(ctx, 0, -6, 90, '220,170,255', (slam - .8) * 3, true, .5);
      }
      ctx.scale(1, .5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(230,170,255,${.9 * slam})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 60 + e * 130, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(200,120,255,${.6 * slam})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 36 + e * 90, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // ---- Summoning smoke on arrival: a billowing white cloud with violet-black shadows bursting off the seal.
    if (age < ARRIVE && K) {
      const p = age / ARRIVE;
      const out = K.ease.out(p * 1.7);
      const fade = 1 - K.ease.smooth((p - .35) / .65);
      ctx.save();
      ctx.globalAlpha = baseAlpha;
      if (p < .22) {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx, fy - 70, 200, '200,140,255', 1 - p / .22, true);
        K.glow(ctx, fx, fy - 150, 110, '170,90,255', (1 - p / .22) * .8, false, 2.4);
        ctx.globalCompositeOperation = 'source-over';
      }
      // Low skirt of smoke rolling over the ground off the seal.
      const skirt = K.puff('smoke');
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10 + .3, d = 60 + out * 110;
        K.stamp(ctx, skirt, fx + Math.cos(a) * d, fy + Math.sin(a) * d * .42, 30 + out * 22, fade * .35, .45);
      }
      // Billows swell outward, then shrink and thin out as they dissipate — inner ones first,
      // so the beast is revealed from the middle.
      const shrinkAll = K.ease.inOut((p - .4) / .6);
      const shade = K.puff('violet');
      for (let pass = -1; pass < 2; pass++) {
        const img = pass < 0 ? shade : cloudSprite(K, pass);
        for (const i of SMOKE_ORDER) {
          const P = SMOKE[i];
          const d = P.d0 + out * P.d1;
          const px = fx + Math.cos(P.a) * d * 1.2, py = fy - 66 + Math.sin(P.a) * d * .7 - p * 34 - P.up;
          const clear = P.inner ? K.ease.inOut((p - .2) / .4) : shrinkAll;
          const r = P.r * (.55 + out * .6) * (1 - clear * .72);
          const al = 1 - K.ease.smooth((clear - .45) / .55);
          if (r < 3 || al <= .02) continue;
          if (pass < 0) K.stamp(ctx, img, px + r * .25, py + r * .35, r * 1.2, al * .7);       // violet-black underside
          else if (pass === 0) K.stamp(ctx, img, px, py, r + 2.5, al);                          // ink rim
          else K.stamp(ctx, img, px, py, r * 1.07, al);                                         // shaded white body
        }
      }
      ctx.restore();
    } else if (age < ARRIVE && window.AnimeSprites) window.AnimeSprites.drawSmoke(ctx, fx, fy - 60, age / ARRIVE, 90);

    ctx.save();
    ctx.globalAlpha = baseAlpha * alpha;
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = '#160d1a';
    const ly = fy - 196 * k + 30;
    ctx.strokeText('THẬP VĨ', fx, ly);
    ctx.fillStyle = '#f4c2d8';
    ctx.fillText('THẬP VĨ', fx, ly);
    ctx.restore();
  }

  window.SummonVFX = { drawOne };
})();
