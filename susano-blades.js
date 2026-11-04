(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const SWING_DURATION = .26;
  const SWING_ARC = 1.7;
  const clamp01 = v => Math.max(0, Math.min(1, v));

  // Flickering chakra-flame outline around a blade lying on +X from x0 to x1.
  // Edge points are offset by a travelling wave so the purple Susanoo chakra licks along the blade.
  function flamePath(ctx, x0, x1, half, time, seed, amp) {
    const N = 12;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = x0 + (x1 + 8 - x0) * t;
      const w = half * (1 - Math.pow(t, 2.2)) + 1;
      const f = Math.sin(t * 14 - time * 15 + seed) * .5 + Math.sin(t * 23 - time * 22 + seed * 2) * .3;
      const y = -(w + amp * (.6 + f) * (1 - t * .5));
      if (i) ctx.lineTo(x - f * 2, y); else ctx.moveTo(x, y);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, x = x0 + (x1 + 8 - x0) * t;
      const w = half * (1 - Math.pow(t, 2.2)) + 1;
      const f = Math.sin(t * 13 - time * 14 + seed + 2) * .5 + Math.sin(t * 21 - time * 19 + seed) * .3;
      ctx.lineTo(x - f * 2, w + amp * (.6 + f) * (1 - t * .5));
    }
    ctx.closePath();
  }

  function drawBlade(ctx, side, time, swingRotation, armored, power) {
    ctx.save();
    ctx.translate(5, side * 9);
    ctx.rotate(side * .17 + swingRotation);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const seed = side * 1.7;

    // Black-violet hilt and paired crossguard wings make each sword legible
    // even when the player is small on screen.
    ctx.strokeStyle = '#1a1230';
    ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(13, 0); ctx.stroke();
    ctx.strokeStyle = '#b276ed';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-8, -1.8); ctx.lineTo(8, -1.8); ctx.stroke();
    ctx.fillStyle = armored ? '#ffad5a' : '#a56cff';
    ctx.beginPath(); ctx.arc(-12, 0, 2.3, 0, TAU); ctx.fill();

    ctx.fillStyle = '#291347';
    ctx.strokeStyle = '#c88aff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, -7); ctx.lineTo(17, -3);
    ctx.lineTo(17, 3); ctx.lineTo(8, 7);
    ctx.lineTo(10, 1); ctx.lineTo(10, -1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Chakra flame sheath: a translucent violet body (normal blend, reads on grass), then an additive lick.
    const amp = 3.2 + power * 3;
    ctx.fillStyle = 'rgba(96,28,196,.38)';
    flamePath(ctx, 13, 62, 6.5, time, seed, amp); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(150,70,255,${.28 + power * .15})`;
    flamePath(ctx, 14, 62, 5, time * 1.1, seed + 3, amp * .7); ctx.fill();
    const flick = .8 + Math.sin(time * 11 + side * 2) * .12 + Math.sin(time * 23 + side) * .06;
    ctx.strokeStyle = `rgba(190,110,255,${.3 * flick})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(61, 0); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // The tapered chakra blade with a dark spine for contrast against orange Kurama chakra.
    ctx.fillStyle = 'rgba(103,32,192,.8)';
    ctx.strokeStyle = '#d99bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, -4.2);
    ctx.lineTo(48, -2.8);
    ctx.lineTo(63, 0);
    ctx.lineTo(48, 2.8);
    ctx.lineTo(14, 4.2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.strokeStyle = '#321052';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(55, 0); ctx.stroke();
    ctx.strokeStyle = armored ? '#ffc0ff' : '#f2deff';
    ctx.globalAlpha = .75 + Math.sin(time * 8 + side) * .15;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, -2.5); ctx.lineTo(48, -1.3); ctx.lineTo(60, 0); ctx.stroke();
    ctx.globalAlpha = 1;
    // A glint that runs up the edge every second or so.
    const g = ((time * .9 + (side > 0 ? .5 : 0)) % 1) * 1.6;
    if (g < 1) {
      const gx = 18 + g * 42;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,245,255,.9)';
      ctx.beginPath(); ctx.moveTo(gx - 5, -1.6); ctx.lineTo(gx, -3.4); ctx.lineTo(gx + 5, -1.6); ctx.lineTo(gx, -.6); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // Called in the player's hand space (chest height), rotated so +X is the aim.
  function draw(ctx, player, time) {
    const swinging = player.swing > 0;
    const progress = swinging ? clamp01(1 - player.swing / SWING_DURATION) : 0;
    const K = window.VFXKit;
    const eased = K ? K.ease.out(progress * 1.15) : progress;
    const swingRotation = swinging ? -.85 + eased * SWING_ARC : 0;
    const power = swinging ? Math.sin(Math.min(1, progress * 1.3) * Math.PI) : 0;
    drawBlade(ctx, -1, time || 0, swingRotation, !!player.nineTails, power);
    drawBlade(ctx, 1, time || 0, swingRotation, !!player.nineTails, power);
  }

  // Crescent smear: thin tail → thick head. `wave` ripples the outer edge like chakra flame.
  function smearPath(ctx, x, y, r, a0, a1, width, wave = 0, time = 0) {
    const N = 22;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = a0 + (a1 - a0) * t;
      const rr = r + width * Math.pow(t, .7) * .55 + (wave ? Math.sin(t * 17 - time * 30) * wave * t : 0);
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, a = a0 + (a1 - a0) * t, rr = r - width * Math.pow(t, .7) * .45;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  // Called in world coordinates; twin arcs follow the melee attack direction.
  function drawSwing(ctx, player, time) {
    if (player.swing <= 0) return;
    const progress = clamp01(1 - player.swing / SWING_DURATION);
    const alpha = Math.sin(Math.min(1, progress * 1.2) * Math.PI);
    if (alpha <= .01) return;
    const K = window.VFXKit;
    const t = time || 0;
    const eased = K ? K.ease.out(progress * 1.15) : progress;
    const angle = player.swingAngle === undefined ? player.angle || 0 : player.swingAngle;
    const head = angle - .85 + eased * SWING_ARC;
    const start = Math.max(angle - .95, head - .6 - eased * 1.0);
    const span = head - start;
    const x = player.x, y = player.y;
    const ga = ctx.globalAlpha;
    const ARCS = [[96, 18, 0], [116, 26, .06]];   // radius, width, angular lag of the second blade

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Faint fan connecting the blades in the hands to the projected chakra slash.
    ctx.globalAlpha = ga * alpha * .18;
    ctx.fillStyle = 'rgb(70,20,150)';
    ctx.beginPath(); ctx.arc(x, y, 90, head - span * .55, head); ctx.arc(x, y, 30, head, head - span * .55, true); ctx.closePath(); ctx.fill();

    // Saturated violet body first (normal blend) so the cut reads on any ground colour.
    for (const [radius, width, lag] of ARCS) {
      ctx.globalAlpha = ga * alpha * (radius > 100 ? .75 : .6);
      ctx.fillStyle = 'rgba(70,18,150,.8)';
      smearPath(ctx, x, y, radius, start - lag, head - lag, width, 3, t); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const [radius, width, lag] of ARCS) {
      ctx.globalAlpha = ga * alpha * (radius > 100 ? .8 : .6);
      ctx.fillStyle = 'rgba(140,60,240,.4)';
      smearPath(ctx, x, y, radius, start - lag, head - lag, width, 4, t + 1); ctx.fill();
      ctx.fillStyle = 'rgba(205,130,255,.6)';
      smearPath(ctx, x, y, radius + width * .2, start - lag + span * .3, head - lag, width * .38); ctx.fill();
    }
    // Bright cutting edges in normal blend (stay white-violet on grass instead of turning green).
    ctx.globalCompositeOperation = 'source-over';
    for (const [radius, width, lag] of ARCS) {
      ctx.globalAlpha = ga * alpha;
      ctx.strokeStyle = 'rgba(248,236,255,.95)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(x, y, radius + width * .45, start - lag + span * .45, head - lag); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = ga * alpha;
    if (K) {
      for (const [radius, , lag] of ARCS) {
        const hx = x + Math.cos(head - lag) * radius, hy = y + Math.sin(head - lag) * radius;
        K.glow(ctx, hx, hy, radius > 100 ? 34 : 24, '170,80,255', .7);
        K.glow(ctx, hx, hy, radius > 100 ? 14 : 10, '230,180,255', .95, true);
      }
      // Chakra embers peeling off the arcs and drifting outward.
      ctx.fillStyle = '#f0d0ff';
      for (let i = 0; i < 12; i++) {
        const h = K.hash(i * 3.7 + angle), a = start + span * h, ph = progress * (1 - h * .4);
        const r = 92 + K.hash(i * 1.9) * 34 + ph * 26;
        ctx.globalAlpha = ga * alpha * (1 - h * .4) * .9;
        const s = 1.4 + K.hash(i * 5.1) * 1.8;
        ctx.fillRect(x + Math.cos(a) * r - s / 2, y + Math.sin(a) * r - s / 2 - ph * 10, s, s);
      }
      // Sparks shearing off the leading edge.
      ctx.globalAlpha = ga * alpha;
      ctx.strokeStyle = 'rgba(245,225,255,.9)'; ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const h = K.hash(i * 7.3 + angle * 3), ph = (progress * 2.5 + h) % 1;
        const a = head - ph * .35, r = 108 + (h - .5) * 30 + ph * 26;
        const tx = -Math.sin(a), ty = Math.cos(a), l = 5 + 9 * (1 - ph);
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        ctx.moveTo(px, py); ctx.lineTo(px - tx * l + Math.cos(a) * 3, py - ty * l + Math.sin(a) * 3);
      }
      ctx.stroke();
    }
    // Lingering cut lines: two thin bright slashes left hanging in the air as the swing ends.
    ctx.globalCompositeOperation = 'source-over';
    if (progress > .4) {
      const f = Math.min(1, (progress - .4) / .42);
      ctx.strokeStyle = `rgba(245,225,255,${(1 - f) * .85})`; ctx.lineWidth = 2.2 * (1 - f) + .6;
      for (const [radius, width, lag] of ARCS) {
        ctx.beginPath(); ctx.arc(x, y, radius + width * .5 + f * 10, head - lag - .9, head - lag - .1); ctx.stroke();
      }
    }
    ctx.restore();
  }

  window.SusanoBlades = { draw, drawSwing };
})();
