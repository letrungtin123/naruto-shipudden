(() => {
  'use strict';

  const TAU = Math.PI * 2;

  // The player faces +X. All shapes use fixed loops so the cloak costs the
  // same amount to draw regardless of how crowded the battlefield becomes.
  function drawTail(ctx, index, time) {
    const fan = (index - 4) / 4;
    const sway = Math.sin(time * 3.2 + index * .73);
    const angle = Math.PI + fan * 1.18 + sway * .085;
    const length = 67 + (1 - Math.abs(fan)) * 21 + sway * 4;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const nx = -dy, ny = dx;
    const sx = -10, sy = fan * 2.2;
    const bend = Math.sin(time * 2.6 + index * .9) * 6;
    const mx = sx + dx * length * .55 + nx * bend;
    const my = sy + dy * length * .55 + ny * bend;
    const tx = sx + dx * length, ty = sy + dy * length;
    const width = 6.8 + (1 - Math.abs(fan)) * 2.3;

    ctx.beginPath();
    ctx.moveTo(sx + nx * 3, sy + ny * 3);
    ctx.bezierCurveTo(sx + dx * 18 + nx * width, sy + dy * 18 + ny * width,
      mx + nx * width, my + ny * width, tx, ty);
    ctx.bezierCurveTo(mx - nx * width, my - ny * width,
      sx + dx * 18 - nx * width, sy + dy * 18 - ny * width,
      sx - nx * 3, sy - ny * 3);
    ctx.closePath();
    ctx.fillStyle = index % 2 ? 'rgba(189,13,29,.86)' : 'rgba(236,34,35,.84)';
    ctx.strokeStyle = 'rgba(80,2,21,.56)';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // A hot inner seam gives each tail its own silhouette at game zoom.
    ctx.beginPath();
    ctx.moveTo(sx - dx * 1.5, sy - dy * 1.5);
    ctx.quadraticCurveTo(mx + nx * bend * .25, my + ny * bend * .25,
      sx + dx * length * .9, sy + dy * length * .9);
    ctx.strokeStyle = index % 3 === 0 ? 'rgba(255,228,151,.82)' : 'rgba(255,132,67,.76)';
    ctx.lineWidth = index % 3 === 0 ? 2.3 : 1.7;
    ctx.stroke();
  }

  function drawMantle(ctx, time) {
    const pulse = .88 + Math.sin(time * 5.4) * .1;
    ctx.lineJoin = 'round';

    // Irregular flame-tipped cloak rather than a rigid armor shell.
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(-28, -17, -16, -21);
    ctx.lineTo(-22, -29);
    ctx.lineTo(-8, -24);
    ctx.lineTo(-4, -34);
    ctx.lineTo(5, -23);
    ctx.lineTo(17, -27);
    ctx.lineTo(15, -17);
    ctx.quadraticCurveTo(28, -12, 31, 0);
    ctx.quadraticCurveTo(28, 12, 15, 17);
    ctx.lineTo(17, 27);
    ctx.lineTo(5, 23);
    ctx.lineTo(-4, 34);
    ctx.lineTo(-8, 24);
    ctx.lineTo(-22, 29);
    ctx.lineTo(-16, 21);
    ctx.quadraticCurveTo(-28, 17, -30, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(170,8,26,.43)';
    ctx.strokeStyle = 'rgba(255,76,45,' + (.62 * pulse) + ')';
    ctx.lineWidth = 2.7;
    ctx.fill();
    ctx.stroke();

    // Three pairs of black chakra vents mark the red cloak at a glance.
    ctx.strokeStyle = 'rgba(31,4,17,.7)';
    ctx.lineWidth = 3.2;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const x = -18 + i * 12;
        ctx.beginPath();
        ctx.moveTo(x - 3, side * 17);
        ctx.quadraticCurveTo(x + 2, side * 11, x + 9, side * 13);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(255,209,128,' + (.54 * pulse) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-22, -21);
    ctx.quadraticCurveTo(2, -30, 20, -14);
    ctx.moveTo(-22, 21);
    ctx.quadraticCurveTo(2, 30, 20, 14);
    ctx.stroke();
  }

  function drawBehind(ctx, player, time) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle || 0);

    const pulse = .86 + Math.sin(time * 6.6) * .1;
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(-8, 0, 4, -8, 0, 49);
    glow.addColorStop(0, 'rgba(255,216,138,' + (.22 * pulse) + ')');
    glow.addColorStop(.45, 'rgba(253,65,35,' + (.29 * pulse) + ')');
    glow.addColorStop(1, 'rgba(219,10,29,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(-8, 0, 49, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 9; i++) drawTail(ctx, i, time);

    ctx.globalCompositeOperation = 'source-over';
    drawMantle(ctx, time);
    ctx.restore();
  }

  function drawAbove(ctx, player, time) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle || 0);
    ctx.lineJoin = 'round';

    // Translucent body glow leaves the held weapon and blade animation legible.
    ctx.fillStyle = 'rgba(222,24,33,.55)';
    ctx.beginPath();
    ctx.ellipse(-3, 0, 13, 15, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(34,5,16,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(-6, -5, -1, -11);
    ctx.moveTo(-14, 8);
    ctx.quadraticCurveTo(-6, 5, -1, 11);
    ctx.moveTo(-8, -2);
    ctx.lineTo(0, -2);
    ctx.moveTo(-8, 2);
    ctx.lineTo(0, 2);
    ctx.stroke();

    // Tall fox ears, black-edged and crimson, replace the old horned helmet.
    ctx.fillStyle = '#f34338';
    ctx.strokeStyle = '#4c081b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-4, -5);
    ctx.lineTo(-10, -22);
    ctx.quadraticCurveTo(1, -18, 6, -8);
    ctx.closePath();
    ctx.moveTo(-4, 5);
    ctx.lineTo(-10, 22);
    ctx.quadraticCurveTo(1, 18, 6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffae67';
    ctx.beginPath();
    ctx.moveTo(-5, -9); ctx.lineTo(-8, -17); ctx.lineTo(1, -11);
    ctx.moveTo(-5, 9); ctx.lineTo(-8, 17); ctx.lineTo(1, 11);
    ctx.fill();

    ctx.shadowColor = '#ff693e';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#d81b29';
    ctx.strokeStyle = '#500817';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(7, 0, 11.5, 8.5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Baryon-like dark eye markings with pale-gold, slit-shaped eyes.
    ctx.fillStyle = '#290a14';
    ctx.beginPath();
    ctx.moveTo(4, -7);
    ctx.lineTo(15, -6);
    ctx.lineTo(12, -2);
    ctx.lineTo(5, -3);
    ctx.closePath();
    ctx.moveTo(4, 7);
    ctx.lineTo(15, 6);
    ctx.lineTo(12, 2);
    ctx.lineTo(5, 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff1bd';
    ctx.beginPath();
    ctx.ellipse(10.3, -4.3, 3, 1.1, -.15, 0, TAU);
    ctx.ellipse(10.3, 4.3, 3, 1.1, .15, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#ffb45e';
    ctx.beginPath();
    ctx.moveTo(14, -3);
    ctx.lineTo(21, 0);
    ctx.lineTo(14, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#340a13';
    ctx.beginPath();
    ctx.arc(20, 0, 1.6, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = '#3b0717';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(12, -4); ctx.lineTo(20, -9);
    ctx.moveTo(10, -6); ctx.lineTo(16, -12);
    ctx.moveTo(12, 4); ctx.lineTo(20, 9);
    ctx.moveTo(10, 6); ctx.lineTo(16, 12);
    ctx.stroke();

    // Fixed five embers give the cloak motion without spawning particles.
    ctx.fillStyle = 'rgba(255,224,146,.88)';
    for (let i = 0; i < 5; i++) {
      const x = -20 + i * 9;
      const y = (i % 2 ? 1 : -1) * (17 + (i * 3) % 7) + Math.sin(time * 7 + i) * 2;
      ctx.beginPath();
      ctx.arc(x, y, i % 2 ? 1.3 : 1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  window.NineTailsVFX = { drawBehind, drawAbove };
})();
