(() => {
  'use strict';

  const SWING_DURATION = .26;
  const SWING_ARC = 1.7;
  const TAU = Math.PI * 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));

  function colors(player) {
    return player.nineTails
      ? { chakra: '#ffac62', rgb: '255,160,80', rim: 'rgba(255,190,120,', body: '60,22,8' }
      : { chakra: '#b4a4ff', rgb: '160,130,255', rim: 'rgba(200,185,255,', body: '22,10,44' };
  }

  // Drawn in the player's rotated local coordinates: +X is the aiming direction.
  function drawWeapon(ctx, player, time) {
    const t = time || 0;
    const swinging = player.swing > 0;
    const progress = swinging ? clamp01(1 - player.swing / SWING_DURATION) : 0;
    const col = colors(player);
    const K = window.VFXKit;
    // Anticipation → snap → follow-through: the staff winds back, whips through, then settles.
    const swingRot = K ? -.85 + K.ease.out(progress * 1.15) * SWING_ARC : -.85 + progress * SWING_ARC;
    // Idle: a slow heavy bob, as if the staff has real mass.
    const idleRot = -.14 + Math.sin(t * 1.6) * .03;

    ctx.save();
    ctx.rotate(swinging ? swingRot : idleRot);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Dark chakra haze clinging to the head (normal blend so it reads on bright ground), then a soft light.
    if (K) {
      K.glow(ctx, 92, 0, 28, col.body, swinging ? .5 : .32);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, 92, 0, 26 + Math.sin(t * 3) * 2, col.rgb, swinging ? .5 : .26);
      ctx.globalCompositeOperation = 'source-over';
    }

    // One continuous truth-seeking black shaft with a blunt rear pommel and a lit upper edge.
    ctx.strokeStyle = 'rgba(190,175,240,.35)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(77, 0); ctx.stroke();
    ctx.strokeStyle = '#05060b'; ctx.lineWidth = 7.5;
    ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(77, 0); ctx.stroke();
    ctx.strokeStyle = '#5b5c72'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-16, -2); ctx.lineTo(73, -2); ctx.stroke();

    ctx.fillStyle = '#0a0b12';
    ctx.beginPath(); ctx.arc(-18, 0, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,175,240,.4)'; ctx.lineWidth = 1; ctx.stroke();
    // Faint chakra bands that pulse along the shaft.
    for (let i = 0; i < 3; i++) {
      const x = [8, 16, 69][i];
      ctx.strokeStyle = col.chakra;
      ctx.globalAlpha = (i === 2 ? .45 : .3) * (.7 + .3 * Math.sin(t * 4 - i * 1.3));
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x, 4); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Madara's half-shakujō ends in an open crescent, not Obito's closed hoop.
    ctx.strokeStyle = 'rgba(190,175,240,.35)'; ctx.lineWidth = 12.5;
    ctx.beginPath(); ctx.arc(91, 0, 20, -.9, .9, true); ctx.stroke();
    ctx.strokeStyle = '#04060b'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(91, 0, 20, -.9, .9, true); ctx.stroke();
    ctx.strokeStyle = '#30303e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(91, 0, 20, -.9, .9, true); ctx.stroke();
    ctx.strokeStyle = col.chakra; ctx.globalAlpha = .7; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(91, 0, 17.8, -.88, .88, true); ctx.stroke();
    ctx.globalAlpha = 1;
    // Glossy highlight on the crescent's back.
    ctx.strokeStyle = 'rgba(235,230,255,.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(91, 0, 22.5, -2.4, -1.6); ctx.stroke();

    // A truth-seeking bead suspended within the mouth of the crescent, gently bobbing.
    const by = Math.sin(t * 2.4) * 1.2;
    ctx.fillStyle = '#030409';
    ctx.beginPath(); ctx.arc(98, by, 4.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = col.chakra; ctx.globalAlpha = .7; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(240,235,255,.75)';
    ctx.beginPath(); ctx.arc(96.6, by - 1.6, 1.1, 0, TAU); ctx.fill();
    // Two tiny orbs orbiting the head at idle.
    if (!swinging) {
      for (let i = 0; i < 2; i++) {
        const a = t * 1.8 + i * Math.PI, ox = 91 + Math.cos(a) * 30, oy = Math.sin(a) * 12;
        ctx.fillStyle = '#05060c';
        ctx.beginPath(); ctx.arc(ox, oy, 2.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = col.chakra; ctx.globalAlpha = .6; ctx.lineWidth = .8; ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  // Filled crescent smear: thin at the tail angle, thick at the head angle.
  function smearPath(ctx, x, y, r, a0, a1, width, sq = 1) {
    const N = 20;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = a0 + (a1 - a0) * t, w = width * Math.pow(t, .7);
      const rr = r + w * .55;
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, a = a0 + (a1 - a0) * t, w = width * Math.pow(t, .7);
      const rr = r - w * .45;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq);
    }
    ctx.closePath();
  }

  // Drawn in world coordinates, following the same arc as the melee hit check.
  function drawSwing(ctx, player, time) {
    if (player.swing <= 0) return;
    const progress = clamp01(1 - player.swing / SWING_DURATION);
    const K = window.VFXKit;
    const eased = K ? K.ease.out(progress * 1.15) : progress;
    const base = Number.isFinite(player.swingAngle) ? player.swingAngle : player.angle || 0;
    const head = base - .85 + eased * SWING_ARC;
    const start = Math.max(base - .9, head - .55 - eased * 1.1);
    const alpha = Math.sin(Math.min(1, progress * 1.2) * Math.PI);
    if (alpha <= .01) return;
    const col = colors(player);
    const x = player.x, y = player.y;
    const span = head - start;

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ga = ctx.globalAlpha;
    // Motion blur of the whole shaft sweeping through: a faint dark fan.
    ctx.globalAlpha = ga * alpha * .14;
    ctx.fillStyle = player.nineTails ? 'rgb(120,60,20)' : 'rgb(70,40,130)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 112, head - span * .6, head); ctx.closePath(); ctx.fill();

    // The black truth-seeking smear — heavy, opaque at the head, tapering to a thread.
    ctx.globalAlpha = ga * alpha * .9;
    ctx.fillStyle = '#0a0716';
    smearPath(ctx, x, y, 103, start, head, 44); ctx.fill();
    // Violet under-rim (normal blend) so the edge reads on grass.
    ctx.fillStyle = col.rim + '.55)';
    smearPath(ctx, x, y, 121, start + span * .15, head, 8); ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = ga * alpha;
    ctx.fillStyle = `rgba(${col.rgb},.4)`;
    smearPath(ctx, x, y, 120, start + span * .25, head, 6); ctx.fill();
    // Thin bright lines in normal blend so they stay lavender-white on grass.
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(240,234,255,.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 123, start + span * .45, head); ctx.stroke();
    // Speed lines trailing inside the smear.
    ctx.strokeStyle = col.rim + '.5)'; ctx.lineWidth = 1.1;
    for (let i = 0; i < 4; i++) {
      const r = 66 + i * 12, a0 = start + span * (.3 + i * .1), a1 = head - span * (.05 + i * .04);
      if (a1 > a0) { ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'lighter';
    const hx = x + Math.cos(head) * 110, hy = y + Math.sin(head) * 110;
    if (K) {
      K.glow(ctx, hx, hy, 40, col.rgb, .75 * alpha);
      K.glow(ctx, hx, hy, 14, col.rgb, .9 * alpha, true);
      // Sparks flung tangentially off the head.
      ctx.strokeStyle = 'rgba(240,230,255,.9)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const h = K.hash(i * 3.3 + base * 7), ph = (progress * 2.2 + h) % 1;
        const a = head - ph * .5 + (h - .5) * .2, r = 104 + ph * 30 * (.5 + h);
        const tx = -Math.sin(a), ty = Math.cos(a), l = 6 + 8 * (1 - ph);
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        ctx.moveTo(px, py); ctx.lineTo(px - tx * l, py - ty * l);
      }
      ctx.stroke();
    }
    // Follow-through shockwave: a thin crescent thrown off the end of the arc.
    ctx.globalCompositeOperation = 'source-over';
    if (progress > .45) {
      const f = (progress - .45) / .4;
      ctx.strokeStyle = col.rim + (Math.max(0, 1 - f) * .75) + ')'; ctx.lineWidth = 3 * (1 - f) + 1;
      ctx.beginPath(); ctx.arc(x, y, 126 + f * 34, head - .7, head - .05); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Truth-seeking orbs trailing the crescent head, with dark flecks scattering.
    for (let i = 3; i >= 0; i--) {
      const a = head - i * .15, r = 6.5 - i * 1.3;
      ctx.globalAlpha = ga * alpha * (.95 - i * .2);
      ctx.fillStyle = '#06060d';
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * 110, y + Math.sin(a) * 110, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = col.chakra; ctx.lineWidth = 1.2; ctx.stroke();
    }
    if (K) {
      ctx.fillStyle = '#0b0814';
      for (let i = 0; i < 6; i++) {
        const h = K.hash(i * 5.7 + base), a = start + span * (.3 + h * .6), r = 112 + (progress * 40) * (.4 + h);
        ctx.globalAlpha = ga * alpha * .8;
        const s = 1.6 + h * 2;
        ctx.fillRect(x + Math.cos(a) * r - s / 2, y + Math.sin(a) * r - s / 2, s, s);
      }
    }
    ctx.restore();
  }

  window.SixPathsStaff = { drawWeapon, drawSwing };
})();
