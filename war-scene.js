(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const c01 = n => Math.max(0, Math.min(1, n));
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // The Fourth Great Ninja War's mood, on top of the battlefield painted by world-map.js:
  // smoke columns rising off the plain, drifting ash and embers (drawWorld, in world space),
  // and the screen grade, the phase banner and the victory glow (drawScreen, in screen space).
  // `war` is the game's warState: { phase 1 Edo Madara | 2 rebirth | 3 Six Paths | 4 victory, transform, banner, ... }.

  // Smoke columns stand on fixed spots of the battlefield.
  function drawWorld(ctx, view, time, war, battlefield) {
    const K = window.VFXKit;
    if (!K || !battlefield) return;
    const bf = battlefield;
    if (view.x > bf.x + bf.w || view.x + view.w < bf.x || view.y > bf.y + bf.h || view.y + view.h < bf.y) return;
    const smoke = K.puff('smoke'), dark = war.phase >= 2;
    for (let i = 0; i < 14; i++) {
      const sx = bf.x + 200 + hash(i * 3.1) * (bf.w - 400), sy = bf.y + 200 + hash(i * 7.7) * (bf.h - 400);
      if (sx < view.x - 300 || sx > view.x + view.w + 300 || sy < view.y - 100 || sy > view.y + view.h + 600) continue;
      // a smouldering spot at the base and puffs climbing and leaning with the wind
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, sx, sy, 34, '255,110,40', .35 + .15 * Math.sin(time * 3 + i), false, .5);
      ctx.restore();
      for (let k = 0; k < 7; k++) {
        const t = (time * .12 + k / 7 + hash(i)) % 1;
        K.stamp(ctx, smoke, sx + t * 90 + Math.sin(time * .6 + k + i) * 14, sy - 20 - t * 420, 26 + t * 70, (1 - t) * (dark ? .38 : .3));
      }
    }
    // drifting ash, and embers once Madara has become the Ten-Tails' jinchūriki
    ctx.fillStyle = dark ? 'rgba(40,30,50,.55)' : 'rgba(90,80,70,.45)';
    for (let i = 0; i < 70; i++) {
      const px = view.x + ((hash(i * 1.3) * view.w + time * (30 + hash(i) * 30)) % view.w);
      const py = view.y + ((hash(i * 2.9) * view.h + time * (14 + hash(i * 5) * 20)) % view.h);
      ctx.fillRect(px, py, 2.2, 2.2);
    }
    if (dark) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const px = view.x + ((hash(i * 4.1) * view.w + time * 22) % view.w), py = view.y + view.h - ((hash(i * 6.3) * view.h + time * (40 + hash(i) * 50)) % view.h);
        K.glow(ctx, px, py, 5, '255,120,60', .6);
      }
      ctx.restore();
    }
  }

  // The rest of the war: thousands of shinobi and White Zetsu locked in skirmishes across the whole
  // plain. Purely scenery (no AI, no collision): knots of two to five fighters trade blows on a loop,
  // a Zetsu drops in a puff of smoke and another takes its place. Knots fade out near the player,
  // where the real Alliance and the real Zetsu army fight, so the two never overlap.
  const ALLY_IDS = ['shinobi_ally', 'shinobi_ally_suna', 'shinobi_ally_kumo', 'shinobi_ally_kiri', 'shinobi_ally_iwa'];
  const JUTSU_RGB = ['255,120,40', '220,240,255', '150,200,255', '120,200,255', '200,150,90'];
  const crowd = { key: '', knots: [] };
  function crowdLayout(bf) {
    const key = `${bf.x},${bf.y},${bf.w},${bf.h}`;
    if (crowd.key === key) return crowd.knots;
    crowd.key = key;
    const knots = crowd.knots = [];
    for (let i = 0; i < 440; i++) {
      const x = bf.x + 120 + hash(i * 1.71) * (bf.w - 240), y = bf.y + 140 + hash(i * 2.39) * (bf.h - 220);
      const village = Math.floor(hash(i * 3.17) * 5), allies = 1 + (hash(i * 4.3) > .6 ? 1 : 0), zetsu = 1 + Math.floor(hash(i * 5.9) * 2.6);
      const fighters = [];
      // the Alliance on the south side of each knot, the Zetsu pressing in from the north
      for (let k = 0; k < allies; k++) fighters.push({ ally: true, id: ALLY_IDS[(village + k * 2) % 5], dx: (k - (allies - 1) / 2) * 30 + (hash(i * 7 + k) - .5) * 10, dy: 16 + hash(i * 9 + k) * 10 });
      for (let k = 0; k < zetsu; k++) fighters.push({ ally: false, id: 'zetsu_white', dx: (k - (zetsu - 1) / 2) * 28 + (hash(i * 11 + k) - .5) * 12, dy: -14 - hash(i * 13 + k) * 14 });
      fighters.sort((p, q) => p.dy - q.dy);
      // the front Zetsu (closest to the Alliance) is the one that falls each cycle
      knots.push({ x, y, village, fighters, fallIdx: zetsu - 1, period: 5 + hash(i * 6.1) * 5, off: hash(i * 8.3) * 10, seed: i });
    }
    knots.sort((p, q) => p.y - q.y);
    return knots;
  }

  function drawCrowd(ctx, view, time, war, bf, focus) {
    const S = window.AnimeSprites, K = window.VFXKit;
    if (!S || !K || !bf) return;
    if (view.x > bf.x + bf.w || view.x + view.w < bf.x || view.y > bf.y + bf.h || view.y + view.h < bf.y) return;
    const won = war.phase === 4;
    // one soft shadow pool under each knot instead of one path per fighter: far fewer GPU draws
    const pool = K.sprite('war:knotShadow', 64, 24, g => {
      const gr = g.createRadialGradient(32, 12, 0, 32, 12, 32);
      gr.addColorStop(0, 'rgba(20,24,12,.42)'); gr.addColorStop(.6, 'rgba(20,24,12,.22)'); gr.addColorStop(1, 'rgba(20,24,12,0)');
      g.setTransform(1, 0, 0, .375, 0, 7.5); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    for (const n of crowdLayout(bf)) {
      if (n.x < view.x - 90 || n.x > view.x + view.w + 90 || n.y < view.y - 20 || n.y > view.y + view.h + 110) continue;
      // fade out around the player, where the real battle is
      const near = focus ? Math.hypot(n.x - focus.x, (n.y - focus.y) * 1.1) : 9999;
      const alpha = c01((near - 300) / 200);
      if (alpha <= .02) continue;
      const cyc = ((time + n.off) % n.period) / n.period;
      const clash = .5 + .5 * Math.sin(time * 7 + n.seed);
      ctx.globalAlpha = alpha;
      ctx.drawImage(pool, n.x - 58, n.y - 18, 116, 44);
      for (let i = 0; i < n.fighters.length; i++) {
        const f = n.fighters[i];
        // the front Zetsu falls near the end of each cycle and a fresh one steps in
        if (!f.ally && (won || (i === n.fallIdx && cyc > .78))) {
          const k = won ? 1 : (cyc - .78) / .12;
          if (k < 1) S.drawSmoke(ctx, n.x + f.dx, n.y + f.dy - 14, k, 18);
          continue;
        }
        const lunge = f.ally ? -Math.max(0, Math.sin(time * 5 + n.seed + i)) * 6 : Math.max(0, Math.sin(time * 5 + n.seed + i + 2)) * 6;
        const x = n.x + f.dx, y = n.y + f.dy + lunge;
        const swing = Math.sin(time * (f.ally ? 4.2 : 3.6) + n.seed * 1.7 + i * 2.1) > .35;
        const frame = won ? (f.ally ? 'raise' : 'idle') : swing ? 'attack' : 'run';
        S.draw(ctx, f.id, x, y, { facing: f.ally ? (f.dx > 0 ? -1 : 1) : (f.dx > 0 ? -1 : 1), frame, phase: time * 8 + n.seed + i, alpha });
      }
      ctx.globalAlpha = 1;
      if (won) continue;
      // steel on steel between the lines, now and then a jutsu flash
      const j = ((time * .35 + n.off) % 1);
      if (clash <= .9 && j >= .1) continue;
      ctx.globalCompositeOperation = 'lighter';
      if (clash > .9) K.glow(ctx, n.x + Math.sin(n.seed) * 12, n.y - 26, 10 + clash * 10, '255,240,200', (clash - .9) * 8 * alpha, true);
      if (j < .1) K.glow(ctx, n.x, n.y - 30, 40 + j * 300, JUTSU_RGB[n.village], (1 - j / .1) * .55 * alpha, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  // Screen grade per phase; cached per size + phase so it costs one drawImage.
  const grade = { canvas: document.createElement('canvas'), key: '' };
  function gradeCanvas(W, H, phase) {
    const key = `${W}x${H}:${phase}`;
    if (grade.key === key) return grade.canvas;
    grade.key = key;
    const c = grade.canvas, g = c.getContext('2d');
    c.width = Math.ceil(W); c.height = Math.ceil(H);
    g.clearRect(0, 0, W, H);
    if (phase >= 2 && phase < 4) {
      // the sky darkened by the Ten-Tails' chakra: cold violet grade, a crimson-black edge
      g.fillStyle = 'rgba(36,18,64,.2)'; g.fillRect(0, 0, W, H);
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .72);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,6,16,.45)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    } else if (phase === 4) {
      g.fillStyle = 'rgba(255,214,140,.1)'; g.fillRect(0, 0, W, H);
    } else {
      // dust hanging over the battlefield: a warm haze and a heavy brown edge
      g.fillStyle = 'rgba(150,104,60,.09)'; g.fillRect(0, 0, W, H);
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .32, W / 2, H / 2, Math.max(W, H) * .72);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(50,30,14,.36)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    }
    return c;
  }

  const PHASE_TITLE = {
    1: ['ĐẠI CHIẾN NINJA LẦN THỨ TƯ', 'MADARA UCHIHA · UẾ THỔ CHUYỂN SINH'],
    2: ['ĐẠI CHIẾN NINJA LẦN THỨ TƯ', 'MADARA HỒI SINH · JINCHŪRIKI THẬP VĨ'],
    3: ['ĐẠI CHIẾN NINJA LẦN THỨ TƯ', 'LỤC ĐẠO MADARA'],
    4: ['LIÊN QUÂN NHẪN GIẢ CHIẾN THẮNG', 'ĐÃ ĐÁNH BẠI LỤC ĐẠO MADARA']
  };

  function drawScreen(ctx, W, H, time, war) {
    ctx.drawImage(gradeCanvas(W, H, war.phase), 0, 0, W, H);
    // the rebirth: the screen pulses black and white as the Ten-Tails' chakra pours in
    if (war.phase === 2) {
      const k = c01(war.transformK || 0), flick = .5 + .5 * Math.sin(time * 18);
      ctx.fillStyle = `rgba(10,6,18,${.15 + k * .25 + flick * .08})`; ctx.fillRect(0, 0, W, H);
      if (k > .9) { ctx.fillStyle = `rgba(255,255,255,${(k - .9) / .1 * .85})`; ctx.fillRect(0, 0, W, H); }
    }
    // phase banner: a slim scroll at the top centre
    const [title, sub] = PHASE_TITLE[war.phase] || PHASE_TITLE[1];
    const w = Math.min(W - 40, 460), x = (W - w) / 2, y = 10, h = 46;
    ctx.save();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    const tint = war.phase === 4 ? ['#5a3a10', '#b8862e'] : war.phase >= 2 ? ['#1a0e2a', '#3e1f5c'] : ['#2a170c', '#5a3416'];
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.12, tint[0]); g.addColorStop(.5, tint[1]); g.addColorStop(.88, tint[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = .9; ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = war.phase >= 2 && war.phase < 4 ? 'rgba(200,160,255,.6)' : 'rgba(240,200,120,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + w * .1, y + .5); ctx.lineTo(x + w * .9, y + .5); ctx.moveTo(x + w * .1, y + h - .5); ctx.lineTo(x + w * .9, y + h - .5); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 13px system-ui, sans-serif'; ctx.fillStyle = '#fff2dc';
    ctx.fillText(title, W / 2, y + 15);
    ctx.font = '700 11px system-ui, sans-serif'; ctx.fillStyle = war.phase >= 2 && war.phase < 4 ? '#d8c4ff' : '#f2cf7a';
    ctx.fillText(sub, W / 2, y + 32);
    ctx.font = '700 12px serif'; ctx.fillStyle = 'rgba(255,240,220,.55)';
    ctx.fillText('第四次忍界大戦', x + w * .14, y + h / 2); ctx.fillText('忍', x + w * .86, y + h / 2);
    ctx.restore();
    // victory: rays of light
    if (war.phase === 4 && war.banner > 0) {
      const a = c01(war.banner / 2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(W / 2, H * .42);
      for (let i = 0; i < 16; i++) {
        ctx.rotate(TAU / 16);
        ctx.fillStyle = `rgba(255,220,150,${.06 * a})`;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(W, H), -40); ctx.lineTo(Math.max(W, H), 40); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  window.WarScene = { drawWorld, drawCrowd, drawScreen };
})();
