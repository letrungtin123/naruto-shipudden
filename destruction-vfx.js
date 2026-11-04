(() => {
  'use strict';
  const TAU = Math.PI * 2;

  // Scars and ruins are static once made, so each is painted once into a small offscreen
  // canvas and stamped every frame (dozens of scars cost a few drawImage calls). Only the
  // collapse animation (dust, falling roof, debris) is drawn live.
  function lru(max) {
    const map = new Map();
    return {
      get(key) { const v = map.get(key); if (v) { map.delete(key); map.set(key, v); } return v; },
      set(key, v) { map.set(key, v); if (map.size > max) map.delete(map.keys().next().value); }
    };
  }
  const scarCache = lru(140);
  const ruinCache = lru(70);
  const h1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  function onScreen(x, y, r, view) {
    return !view || (x + r > view.x && y + r > view.y &&
      x - r < view.x + view.w && y - r < view.y + view.h);
  }

  function paintScar(ctx, r, kind, v) {
    const hot = kind === 'fire' || kind === 'beast';
    const violet = kind === 'shockwave' || kind === 'lightning' || kind === 'beast';
    const water = kind === 'vortex';
    // soot/scorch halo
    const halo = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.15);
    halo.addColorStop(0, hot ? 'rgba(40,18,16,.6)' : violet ? 'rgba(45,28,60,.5)' : water ? 'rgba(30,48,60,.45)' : 'rgba(36,30,28,.5)');
    halo.addColorStop(.7, hot ? 'rgba(50,24,20,.35)' : 'rgba(40,34,32,.25)');
    halo.addColorStop(1, 'rgba(40,34,32,0)');
    ctx.save(); ctx.scale(1, .68);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, TAU); ctx.fill();
    ctx.restore();
    // crater bowl: dark floor + lit rim (light from the top-left) for depth
    ctx.fillStyle = hot ? 'rgba(48,24,22,.62)' : violet ? 'rgba(40,26,52,.55)' : 'rgba(42,36,33,.55)';
    ctx.beginPath(); ctx.ellipse(0, 0, r * .8, r * .5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,150,.28)'; ctx.lineWidth = Math.max(1.5, r * .05);
    ctx.beginPath(); ctx.ellipse(0, 0, r * .84, r * .54, 0, Math.PI * .95, Math.PI * 1.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,16,15,.55)';
    ctx.beginPath(); ctx.ellipse(0, 0, r * .84, r * .54, 0, -.1, Math.PI * .9); ctx.stroke();
    if (kind === 'blade') {
      ctx.strokeStyle = 'rgba(164, 92, 220, .73)'; ctx.lineWidth = Math.max(2, r * .06); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * .92, -r * .2); ctx.lineTo(r * .95, r * .19); ctx.stroke();
      ctx.strokeStyle = 'rgba(32, 24, 40, .85)'; ctx.lineWidth = Math.max(1, r * .025);
      ctx.beginPath(); ctx.moveTo(-r * .7, r * .04); ctx.lineTo(r * .76, r * .32); ctx.stroke();
    } else if (water) {
      ctx.strokeStyle = 'rgba(70,110,130,.5)'; ctx.lineWidth = Math.max(1.4, r * .03); ctx.lineCap = 'round';
      for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) {
          const t = i / 14, a = s * TAU / 3 + t * 4 + v, rr = r * (.15 + t * .8);
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .62;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      // jagged radial cracks
      ctx.strokeStyle = violet ? 'rgba(119, 71, 157, .6)' : 'rgba(30, 25, 23, .66)';
      ctx.lineWidth = Math.max(1.3, r * .024); ctx.lineJoin = 'round';
      const n = 7 + Math.round(h1(v) * 3);
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n + h1(v + i) * .5;
        const ca = Math.cos(a), sa = Math.sin(a), L = 1.0 + h1(v * 3 + i) * .35;
        ctx.beginPath();
        ctx.moveTo(ca * r * .36, sa * r * .23);
        ctx.lineTo(ca * r * .62 - sa * r * .08, sa * r * .4 + ca * r * .08);
        ctx.lineTo(ca * r * .85 + sa * r * .05, sa * r * .55 - ca * r * .05);
        ctx.lineTo(ca * r * L, sa * r * L * .66);
        ctx.stroke();
      }
    }
    if (hot) {
      // embers still glowing in the scorched floor
      for (let i = 0; i < 9; i++) {
        const a = h1(v + i * 2.3) * TAU, d = r * .6 * Math.sqrt(h1(v + i * 5.1));
        ctx.fillStyle = i % 3 ? 'rgba(255,120,40,.45)' : 'rgba(255,200,90,.55)';
        ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * .6, 1 + h1(i + v) * 1.6, 0, TAU); ctx.fill();
      }
    }
    if (kind === 'lightning' || kind === 'shockwave') {
      ctx.strokeStyle = 'rgba(194, 135, 239, .52)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * .43, .2, Math.PI * 1.7); ctx.stroke();
    }
  }

  function scarSprite(kind, radius, v) {
    const r = Math.max(10, Math.round(radius / 6) * 6);
    const key = kind + '|' + r + '|' + v;
    let c = scarCache.get(key);
    if (!c) {
      const S = Math.ceil(r * 2.9);
      c = document.createElement('canvas'); c.width = S; c.height = S;
      const g = c.getContext('2d'); g.translate(S / 2, S / 2);
      paintScar(g, r, kind, v);
      c.r = r;
      scarCache.set(key, c);
    }
    return c;
  }

  function drawScar(ctx, scar) {
    const r = Math.max(10, scar.radius || 20);
    const v = Math.floor(h1(Math.round(scar.x) * .13 + Math.round(scar.y) * .71) * 3);
    const img = scarSprite(scar.kind || 'crater', r, v);
    const k = r / img.r, S = img.width * k;
    ctx.save();
    ctx.translate(scar.x, scar.y);
    if (scar.angle) ctx.rotate(scar.angle);
    ctx.drawImage(img, -S / 2, -S / 2, S, S);
    ctx.restore();
  }

  // A shade of a '#rrggbb' colour: k < 1 darkens, k > 1 lightens.
  function tone(hex, k) {
    const n = parseInt((hex || '#8a7a66').slice(1, 7), 16);
    const c = v => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }

  // A blown-apart wall, cliff or rock spire: a ragged patch of broken earth heaped with boulders
  // in the stone's own colours.
  function paintRockRuin(ctx, b) {
    const w = b.w, h = b.h, cx = w / 2, cy = h / 2, seed = b.x * .013 + b.y * .007;
    const stone = b.wall || '#8a7a66', top = b.roof || stone;
    const blob = (rx, ry, jag, s) => {
      ctx.beginPath();
      for (let i = 0; i <= 22; i++) {
        const a = i / 22 * TAU, k = 1 - jag * h1(s + i * 1.7);
        const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    blob(w * .51, h * .51, .14, seed); ctx.fillStyle = 'rgba(28,22,18,.45)'; ctx.fill();
    blob(w * .46, h * .46, .2, seed + 3); ctx.fillStyle = tone(stone, .62); ctx.fill();
    blob(w * .34, h * .34, .25, seed + 7); ctx.fillStyle = tone(stone, .45); ctx.fill();
    // cracks radiating through the broken ground
    ctx.strokeStyle = 'rgba(30,22,18,.55)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = h1(seed + i * 3.1) * TAU, len = .3 + h1(seed + i) * .2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a + .2) * w * len * .5, cy + Math.sin(a + .2) * h * len * .5);
      ctx.lineTo(cx + Math.cos(a) * w * len, cy + Math.sin(a) * h * len);
    }
    ctx.stroke();
    // boulders, big ones toward the middle, each with a lit top face and a dark outline
    const n = Math.round(Math.min(46, 14 + w * h / 6000));
    for (let i = 0; i < n; i++) {
      const a = h1(seed + i * 2.3) * TAU, d = Math.sqrt(h1(seed + i * 5.1)) * .44;
      const x = cx + Math.cos(a) * w * d, y = cy + Math.sin(a) * h * d;
      const r = (1 - d) * (6 + h1(seed + i * 7.7) * 16) + 3;
      ctx.save(); ctx.translate(x, y); ctx.rotate(h1(seed + i) * TAU);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const aa = k / 6 * TAU, rr = r * (.7 + h1(seed + i * 11 + k) * .45);
        if (k) ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr * .8); else ctx.moveTo(rr, 0);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(20,14,12,.35)'; ctx.save(); ctx.translate(2, 3); ctx.fill(); ctx.restore();
      ctx.fillStyle = tone(i % 3 ? stone : top, .8 + h1(seed + i * 13) * .35); ctx.fill();
      ctx.strokeStyle = 'rgba(32,24,20,.7)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,225,.22)';
      ctx.beginPath(); ctx.ellipse(-r * .2, -r * .25, r * .45, r * .25, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function paintRuin(ctx, b) {
    if (b.solid) { paintRockRuin(ctx, b); return; }
    const w = b.w, h = b.h;
    ctx.fillStyle = 'rgba(24, 20, 22, .58)';
    ctx.fillRect(-6, -6, w + 12, h + 12);
    ctx.fillStyle = '#625347'; ctx.fillRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = 'rgba(37, 32, 29, .52)';
    ctx.fillRect(24, 24, w - 48, h - 48);
    ctx.strokeStyle = '#c2a681'; ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(4, h * .78); ctx.lineTo(4, 4); ctx.lineTo(w * .65, 4);
    ctx.moveTo(w - 4, h * .25); ctx.lineTo(w - 4, h - 4); ctx.lineTo(w * .23, h - 4);
    ctx.stroke();
    ctx.strokeStyle = '#48372b'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(w * .12, h * .13); ctx.lineTo(w * .72, h * .73);
    ctx.moveTo(w * .82, h * .18); ctx.lineTo(w * .26, h * .84); ctx.stroke();
    ctx.strokeStyle = '#ab845d'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(w * .12, h * .13); ctx.lineTo(w * .72, h * .73);
    ctx.moveTo(w * .82, h * .18); ctx.lineTo(w * .26, h * .84); ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const px = (i * 71 + b.type * 29) % Math.max(1, w - 22) + 11;
      const py = (i * 113 + b.type * 41) % Math.max(1, h - 22) + 11;
      const size = 7 + i % 5 * 4;
      ctx.save(); ctx.translate(px, py); ctx.rotate(i * 2.31);
      ctx.fillStyle = 'rgba(20,16,14,.35)';
      ctx.fillRect(-size * .5 + 2, -size * .36 + 2, size, size * .72);
      ctx.fillStyle = i % 3 ? b.roof : b.wall;
      ctx.fillRect(-size * .5, -size * .36, size, size * .72);
      ctx.strokeStyle = 'rgba(37, 28, 24, .58)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-size * .5, -size * .36, size, size * .72);
      ctx.restore();
    }
  }

  function ruinSprite(b) {
    const key = b;
    let c = ruinCache.get(key);
    if (!c || c.w !== b.w || c.h !== b.h) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(b.w + 12)); c.height = Math.max(1, Math.ceil(b.h + 12));
      const g = c.getContext('2d'); g.translate(6, 6);
      paintRuin(g, b);
      c.w = b.w; c.h = b.h;
      ruinCache.set(key, c);
    }
    return c;
  }

  function drawRuin(ctx, b, time) {
    const K = window.VFXKit;
    const collapsing = b.collapseLife > 0;
    const k = collapsing ? Math.min(1, b.collapseLife / (b.collapseMaxLife || 1)) : 0;   // 1 → 0
    const p = 1 - k;
    // Rubble settles in as the building comes down.
    ctx.save();
    if (collapsing) ctx.globalAlpha *= Math.min(1, .35 + p * 1.3);
    ctx.drawImage(ruinSprite(b), b.x - 6, b.y - 6);
    ctx.restore();
    if (!collapsing) return;
    const cx = b.x + b.w * .5, cy = b.y + b.h * .5, span = Math.max(b.w, b.h);
    ctx.save();
    // The roof drops and tilts into the rubble.
    const drop = K ? K.ease.in(p * 1.4) : p;
    if (drop < 1) {
      ctx.save();
      ctx.translate(cx, cy + drop * b.h * .25);
      ctx.rotate((h1(b.x) - .5) * .5 * drop);
      ctx.scale(1 - drop * .45, 1 - drop * .6);
      ctx.globalAlpha *= 1 - drop;
      ctx.fillStyle = b.roof || '#a0553a';
      ctx.fillRect(-b.w * .5, -b.h * .5, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(-b.w * .5, 0, b.w, b.h * .5);
      ctx.strokeStyle = 'rgba(30,20,16,.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(-b.w * .5, -b.h * .5, b.w, b.h);
      ctx.restore();
    }
    if (K) {
      // Dust clouds billowing out of the footprint.
      const dust = K.puff('dust'), e = K.ease.out(p * 1.4);
      const fade = 1 - K.ease.smooth((p - .45) / .55);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12 + h1(i + b.x * .01) * .5;
        const dx = Math.cos(a) * (b.w * .45 + e * span * .25), dy = Math.sin(a) * (b.h * .45 + e * span * .2);
        K.stamp(ctx, dust, cx + dx, cy + dy - e * 22, span * (.12 + e * .14), fade * .85);
      }
      for (let i = 0; i < 4; i++) {
        K.stamp(ctx, dust, cx + (h1(i * 7 + b.y) - .5) * b.w * .5, cy - e * 40 - i * 12, span * (.18 + e * .1), fade * .7);
      }
      if (K.fx) K.fx.debris(ctx, cx, cy, span * .9, p, b.x * .01, '#5b4a3c', 12);
    } else {
      ctx.globalAlpha *= k * .43;
      ctx.fillStyle = '#d1ba9a';
      for (let i = 0; i < 6; i++) {
        const phase = i * TAU / 6 + time * .4;
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(phase) * b.w * .38, cy + Math.sin(phase) * b.h * .38, 30 + p * 38, 19 + p * 20, phase, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  window.DestructionVFX = {
    draw(ctx, state, elapsed) {
      if (!ctx || !state) return;
      const view = state.view || null;
      for (const scar of state.scars || []) {
        if (onScreen(scar.x, scar.y, (scar.radius || 20) * 1.4, view)) drawScar(ctx, scar);
      }
      for (const ruin of state.ruins || []) {
        if (onScreen(ruin.x + ruin.w * .5, ruin.y + ruin.h * .5,
          Math.max(ruin.w, ruin.h) * .75, view)) drawRuin(ctx, ruin, elapsed || 0);
      }
    }
  };
})();
