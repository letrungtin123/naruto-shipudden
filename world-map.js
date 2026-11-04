/* world-map.js — the land between the hidden villages.
   Konoha sits in the Land of Fire forest; roads lead west to Iwagakure (Land of Earth rock),
   east to Kumogakure (Land of Lightning mountains), south-west across the Land of Wind desert
   to Sunagakure and south-east over a long bridge to Kirigakure's island in the Land of Water.
   Five minor villages (7x7 blocks) hang off side roads: Kusa, Oto and Taki along a northern road above the
   Hokage Rock, Ame south of the Iwa road and Yu south of the Kumo road.
   South of the Suna–Kiri road lies the battlefield of the Fourth Great Ninja War (layout.battlefield).
   Exposes window.WorldMap = { layout, init, drawStatic, drawRoadStubs, drawAmbient, drawMinimap, regionAt }. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const BLOCK = 520;
  const OUT = '#3b2a22';

  // ------------------------------------------------------------------ layout (world px)
  const KONOHA = { x: 20 * BLOCK, y: 12 * BLOCK, size: 14 * BLOCK };
  const VSIZE = 10 * BLOCK, MSIZE = 7 * BLOCK;
  const layout = {
    block: BLOCK,
    world: { w: 54 * BLOCK, h: 40 * BLOCK },
    konoha: KONOHA,
    villageSize: VSIZE,
    // The Fourth Great Ninja War battlefield: barren cratered plain south of the Suna–Kiri road.
    battlefield: { x: 10920, y: 17560, w: 5700, h: 3000 },
    villages: {
      iwa: { x: 2 * BLOCK, y: 2 * BLOCK, size: VSIZE },
      kumo: { x: 42 * BLOCK, y: 2 * BLOCK, size: VSIZE },
      suna: { x: 2 * BLOCK, y: 28 * BLOCK, size: VSIZE },
      kiri: { x: 42 * BLOCK, y: 26 * BLOCK, size: VSIZE },
      // Minor villages: their gates sit at local x 1820, where the side roads arrive.
      kusa: { x: 13 * BLOCK, y: 2 * BLOCK, size: MSIZE },
      oto: { x: 23 * BLOCK, y: 2 * BLOCK, size: MSIZE },
      taki: { x: 33 * BLOCK, y: 2 * BLOCK, size: MSIZE },
      ame: { x: 5 * BLOCK, y: 17 * BLOCK, size: MSIZE },
      yu: { x: 40 * BLOCK, y: 17 * BLOCK, size: MSIZE }
    },
    // Konoha's west/east exits follow its row-3 street; the south road leaves the A-Un gate.
    roads: [
      [[KONOHA.x, 7875], [3640, 7875], [3640, 6240]],
      [[KONOHA.x + KONOHA.size, 7875], [24440, 7875], [24440, 6240]],
      [[14115, 13860], [14115, 17160], [6240, 17160]],
      [[14115, 16120], [21840, 16120]],
      // The northern road runs above the Hokage Rock from the Iwa road to the Kumo road.
      [[8580, 7875], [8580, 4600]],
      [[8580, 5460], [18980, 5460]],
      [[13780, 5460], [13780, 4600]],
      [[18980, 4600], [18980, 7875]],
      [[4420, 7875], [4420, 8920]],
      [[22620, 7875], [22620, 8920]],
      [[13770, 17160], [13770, 17700]]
    ],
    signs: [
      { x: KONOHA.x - 230, y: 7760, lines: ['岩 LÀNG ĐÁ ←'] },
      { x: KONOHA.x + KONOHA.size + 230, y: 7760, lines: ['→ LÀNG MÂY 雲'] },
      { x: 14320, y: 16000, lines: ['← LÀNG CÁT 砂', 'LÀNG SƯƠNG MÙ 霧 →'] },
      { x: 3820, y: 7760, lines: ['↑ LÀNG ĐÁ 岩'] },
      { x: 24620, y: 7760, lines: ['↑ LÀNG MÂY 雲'] },
      { x: 8350, y: 7760, lines: ['↑ LÀNG CỎ 草', '↑ LÀNG ÂM THANH 音'] },
      { x: 19210, y: 7760, lines: ['↑ LÀNG THÁC NƯỚC 滝', '↑ LÀNG ÂM THANH 音'] },
      { x: 14010, y: 5345, lines: ['↑ LÀNG ÂM THANH 音'] },
      { x: 4650, y: 8120, lines: ['↓ LÀNG MƯA 雨'] },
      { x: 22850, y: 8120, lines: ['↓ LÀNG SUỐI NƯỚC NÓNG 湯'] },
      { x: 13990, y: 17320, lines: ['↓ CHIẾN TRƯỜNG', '第四次忍界大戦'] }
    ]
  };

  // Biomes are soft-edged blobs painted over the Land of Fire grass.
  const BIOMES = [
    { id: 'rock', name: 'ĐẤT NƯỚC ĐÁ · 土の国', x: 3640, y: 3640, r: 5700, seed: 3 },
    { id: 'mount', name: 'ĐẤT NƯỚC SẤM · 雷の国', x: 24440, y: 3640, r: 5700, seed: 7 },
    { id: 'desert', name: 'ĐẤT NƯỚC GIÓ · 風の国', x: 3640, y: 17160, r: 6300, seed: 11 },
    { id: 'sea', name: 'ĐẤT NƯỚC NƯỚC · 水の国', x: 24440, y: 16120, r: 7000, seed: 13 }
  ];
  const FIRE_NAME = 'RỪNG HỎA QUỐC · 火の国';

  // ------------------------------------------------------------------ helpers
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); c.getContext('2d', { willReadFrequently: true }); return c; };
  function rng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function fell(c, x, y, rx, ry, col) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); c.fillStyle = col; c.fill(); }
  function wrapTile(S, x, y, m, fn) { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) if (x + ox > -m && x + ox < S + m && y + oy > -m && y + oy < S + m) fn(x + ox, y + oy); }
  // A wobbly blob outline so biome borders never look like circles.
  function blobPath(b) {
    const p = new Path2D(), n = 72;
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU;
      const k = 1 + .08 * Math.sin(a * 3 + b.seed) + .05 * Math.sin(a * 7 + b.seed * 2) + .03 * Math.sin(a * 13 + b.seed * 5);
      const x = b.x + Math.cos(a) * b.r * k, y = b.y + Math.sin(a) * b.r * k;
      if (i) p.lineTo(x, y); else p.moveTo(x, y);
    }
    p.closePath();
    return p;
  }
  function inBiome(b, x, y) {
    const a = Math.atan2(y - b.y, x - b.x);
    const k = 1 + .08 * Math.sin(a * 3 + b.seed) + .05 * Math.sin(a * 7 + b.seed * 2) + .03 * Math.sin(a * 13 + b.seed * 5);
    return Math.hypot(x - b.x, y - b.y) < b.r * k;
  }

  // ------------------------------------------------------------------ ground tiles
  function tile(base, paint, S = 256, seed = 1) {
    const cv = mk(S, S), c = cv.getContext('2d'), R = rng(seed);
    c.fillStyle = base; c.fillRect(0, 0, S, S);
    paint(c, R, S);
    return cv;
  }
  function makeTiles() {
    const grass = tile('#78b041', (c, R, S) => {
      for (let i = 0; i < 18; i++) { const x = R() * S, y = R() * S, rx = 20 + R() * 34; wrapTile(S, x, y, rx, (px, py) => fell(c, px, py, rx, rx * .45, R() < .5 ? '#6fa53b' : '#83bb4a')); }
      c.strokeStyle = '#5f9432'; c.lineWidth = 1.4; c.beginPath();
      for (let i = 0; i < 90; i++) { const x = R() * S, y = R() * S; c.moveTo(x, y); c.lineTo(x - 1.5, y - 5); c.moveTo(x + 2, y); c.lineTo(x + 3, y - 6); }
      c.stroke();
      for (let i = 0; i < 10; i++) { const x = R() * S, y = R() * S, col = ['#ffffff', '#ffe066', '#f8a5c2'][i % 3]; wrapTile(S, x, y, 4, (px, py) => fell(c, px, py, 1.8, 1.8, col)); }
    });
    const sand = tile('#e3c48a', (c, R, S) => {
      c.strokeStyle = 'rgba(176,132,72,.45)'; c.lineWidth = 2; c.lineCap = 'round';
      for (let y = 8; y < S; y += 22) { c.beginPath(); for (let x = -10; x <= S + 10; x += 16) c.lineTo(x, y + Math.sin(x / S * TAU * 10 + y * .7) * 4); c.stroke(); }
      c.strokeStyle = 'rgba(255,240,205,.5)'; c.lineWidth = 1.2;
      for (let y = 14; y < S; y += 22) { c.beginPath(); for (let x = -10; x <= S + 10; x += 16) c.lineTo(x, y + Math.sin(x / S * TAU * 10 + y * .7) * 4); c.stroke(); }
      for (let i = 0; i < 14; i++) { const x = R() * S, y = R() * S; wrapTile(S, x, y, 4, (px, py) => fell(c, px, py, 2.4, 1.6, '#b58d57')); }
    }, 256, 2);
    const rock = tile('#a88a68', (c, R, S) => {
      for (let i = 0; i < 16; i++) { const x = R() * S, y = R() * S, rx = 16 + R() * 30; wrapTile(S, x, y, rx, (px, py) => fell(c, px, py, rx, rx * .5, R() < .5 ? '#9a7c5c' : '#b69a76')); }
      c.strokeStyle = 'rgba(80,55,35,.45)'; c.lineWidth = 1.3;
      for (let i = 0; i < 9; i++) { const x = R() * S, y = R() * S; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 12, y + 6); c.lineTo(x + 18, y + 18); c.stroke(); }
      for (let i = 0; i < 20; i++) { const x = R() * S, y = R() * S; wrapTile(S, x, y, 4, (px, py) => fell(c, px, py, 2.6, 1.8, '#7d6248')); }
    }, 256, 3);
    const mount = tile('#8f9a86', (c, R, S) => {
      for (let i = 0; i < 18; i++) { const x = R() * S, y = R() * S, rx = 18 + R() * 30; wrapTile(S, x, y, rx, (px, py) => fell(c, px, py, rx, rx * .5, R() < .5 ? '#7f8b77' : '#a0aa95')); }
      c.strokeStyle = '#6f8f4f'; c.lineWidth = 1.3; c.beginPath();
      for (let i = 0; i < 40; i++) { const x = R() * S, y = R() * S; c.moveTo(x, y); c.lineTo(x - 1.5, y - 5); c.moveTo(x + 2, y); c.lineTo(x + 3, y - 5); }
      c.stroke();
    }, 256, 4);
    const sea = tile('#2f7ea6', (c, R, S) => {
      c.lineCap = 'round';
      for (let i = 0; i < 30; i++) {
        const x = R() * S, y = R() * S, w = 14 + R() * 26, col = R() < .6 ? 'rgba(140,205,235,.5)' : 'rgba(20,80,120,.5)';
        wrapTile(S, x, y, w + 4, (px, py) => { c.beginPath(); c.moveTo(px - w, py); c.quadraticCurveTo(px, py - 5, px + w, py); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); });
      }
    }, 256, 5);
    return { grass, sand, rock, mount, sea };
  }

  // ------------------------------------------------------------------ sprites
  function sprite(w, h, ax, ay, fn) { const cv = mk(w, h), c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; fn(c, ax, ay); return { cv, ax, ay }; }
  function canopy(c, cx, cy, r, R, pal) {
    const blobs = [[cx, cy, r * .6]];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + R() * .6, d = r * (.4 + R() * .16); blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * .82, r * (.36 + R() * .15)]); }
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, br] of blobs) fell(c, x, y, br + 2.4, br + 2.4, pal[0]);
    for (const [x, y, br] of blobs) { fell(c, x, y, br, br, pal[1]); fell(c, x - br * .16, y - br * .2, br * .78, br * .75, pal[2]); if (y < cy && x < cx + r * .3) fell(c, x - br * .3, y - br * .36, br * .4, br * .32, pal[3]); }
  }
  function makeTree(r, seed, pal) {
    const trunk = Math.round(r * .5 + 8), w = Math.ceil(r * 2.9 + 20), h = Math.ceil(r * 2.1 + trunk + 20);
    return sprite(w, h, Math.round(w / 2), h - 8, (c, ax, ay) => {
      fell(c, ax + r * .4, ay - 1, r * .95, r * .3, 'rgba(24,56,20,.3)');
      c.fillStyle = '#6a4428'; c.fillRect(ax - 4, ay - trunk - 10, 8, trunk + 10);
      c.fillStyle = '#93683f'; c.fillRect(ax - 3, ay - trunk - 10, 3, trunk + 10);
      canopy(c, ax, ay - trunk - r * .78, r, rng(seed), pal);
    });
  }
  function makePine(s, seed) {
    return sprite(80 * s, 120 * s, 40 * s, 112 * s, (c, ax, ay) => {
      fell(c, ax + 12 * s, ay, 26 * s, 7 * s, 'rgba(20,30,20,.3)');
      c.fillStyle = '#5c3d26'; c.fillRect(ax - 3 * s, ay - 22 * s, 6 * s, 22 * s);
      const tiers = [[0, 30, 34], [-26, 25, 30], [-48, 19, 26], [-66, 12, 20]];
      for (const [dy, hw, hh] of tiers) {
        const y = ay - 18 * s + dy * s;
        c.beginPath(); c.moveTo(ax - hw * s, y); c.lineTo(ax, y - hh * s); c.lineTo(ax + hw * s, y); c.closePath();
        c.fillStyle = '#1f4a2e'; c.fill(); c.strokeStyle = '#123020'; c.lineWidth = 1.4; c.stroke();
        c.beginPath(); c.moveTo(ax - hw * s * .8, y - 2 * s); c.lineTo(ax, y - hh * s); c.lineTo(ax - hw * s * .1, y - 2 * s); c.closePath();
        c.fillStyle = '#3d7a4a'; c.fill();
      }
      for (const [dx, dy] of [[-8, -40], [6, -62], [-4, -78]]) fell(c, ax + dx * s, ay + dy * s, 5 * s, 2.5 * s, 'rgba(240,248,255,.8)');
    });
  }
  function makeBoulder(r, cols, seed) {
    return sprite(r * 2.8, r * 2.2, r * 1.4, r * 1.7, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + r * .3, ay, r * 1.1, r * .32, 'rgba(30,20,10,.3)');
      c.beginPath();
      for (let i = 0; i <= 9; i++) { const a = Math.PI + i / 9 * Math.PI, k = .8 + R() * .3; c.lineTo(ax + Math.cos(a) * r * k, ay - r * .2 + Math.sin(a) * r * k); }
      c.closePath(); c.fillStyle = cols[0]; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
      fell(c, ax - r * .3, ay - r * .7, r * .45, r * .25, cols[1]);
      c.strokeStyle = cols[2]; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax + r * .1, ay - r * .9); c.lineTo(ax + r * .3, ay - r * .4); c.stroke();
    });
  }
  // A wind-blown dune: lit windward slope, shadowed lee side.
  function makeDune(w, seed) {
    return sprite(w + 20, w * .45, (w + 20) / 2, w * .4, (c, ax, ay) => {
      const R = rng(seed), h = w * .28;
      c.beginPath(); c.moveTo(ax - w / 2, ay); c.quadraticCurveTo(ax - w * .1, ay - h * 1.1, ax + w * .12, ay - h); c.quadraticCurveTo(ax + w * .3, ay - h * .6, ax + w / 2, ay); c.closePath();
      c.fillStyle = '#efd49c'; c.fill();
      c.beginPath(); c.moveTo(ax + w * .12, ay - h); c.quadraticCurveTo(ax + w * .3, ay - h * .6, ax + w / 2, ay); c.lineTo(ax + w * .05, ay); c.quadraticCurveTo(ax + w * .1, ay - h * .5, ax + w * .12, ay - h); c.closePath();
      c.fillStyle = '#c9a062'; c.fill();
      c.strokeStyle = 'rgba(150,110,60,.5)'; c.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(ax - w / 2 + i * w * .1, ay - 2); c.quadraticCurveTo(ax - w * .15 + i * 6, ay - h * (.3 + i * .18), ax + w * .08, ay - h * (.3 + i * .2)); c.stroke(); }
      c.strokeStyle = 'rgba(110,80,40,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax - w / 2, ay); c.quadraticCurveTo(ax - w * .1, ay - h * 1.1, ax + w * .12, ay - h); c.quadraticCurveTo(ax + w * .3, ay - h * .6, ax + w / 2, ay); c.stroke();
      void R;
    });
  }
  function makeMesa(seed) {
    // A red sandstone butte: flat top, striped cliff face.
    return sprite(260, 200, 130, 186, (c, ax, ay) => {
      const R = rng(seed);
      fell(c, ax + 30, ay, 120, 22, 'rgba(60,30,10,.3)');
      const top = [], face = [];
      for (let i = 0; i <= 10; i++) { const x = ax - 100 + i * 20; top.push([x, ay - 150 + (R() - .5) * 10]); }
      c.beginPath(); c.moveTo(ax - 110, ay); top.forEach(([x, y]) => c.lineTo(x, y + 40)); c.lineTo(ax + 110, ay); c.closePath();
      c.fillStyle = '#b5683c'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      c.strokeStyle = 'rgba(120,60,30,.6)'; c.lineWidth = 2;
      for (let y = ay - 90; y < ay; y += 18) { c.beginPath(); c.moveTo(ax - 104, y); c.lineTo(ax + 104, y + 4); c.stroke(); }
      c.beginPath(); top.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); top.slice().reverse().forEach(([x, y]) => c.lineTo(x, y + 40)); c.closePath();
      c.fillStyle = '#d99a62'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      fell(c, ax - 30, ay - 140, 30, 8, 'rgba(255,235,200,.4)');
    });
  }
  function makeSign(lines) {
    const w = Math.max(...lines.map(l => l.length)) * 8.6 + 26, h = lines.length * 22 + 70;
    return sprite(w + 10, h, (w + 10) / 2, h - 4, (c, ax, ay) => {
      fell(c, ax + 6, ay, 18, 5, 'rgba(30,20,10,.3)');
      c.fillStyle = '#5c3d26'; c.fillRect(ax - 4, ay - h + 20, 8, h - 20);
      lines.forEach((t, i) => {
        const y = ay - h + 20 + i * 22;
        c.fillStyle = '#c8a06a'; c.fillRect(ax - w / 2, y, w, 18);
        c.strokeStyle = OUT; c.lineWidth = 1.6; c.strokeRect(ax - w / 2, y, w, 18);
        c.fillStyle = '#2a1a10'; c.font = '700 12px "Be Vietnam Pro", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(t, ax, y + 10);
      });
    });
  }

  // ------------------------------------------------------------------ the war battlefield
  // A dusty plain churned up by the war: cracked earth, meteor craters, scorch marks, broken weapons
  // stuck in the ground and the Allied Shinobi Forces' 忍 banners round its edge. Painted into the static tiles.
  let bfPath = null;
  const BF = { craters: [], scorches: [], cracks: [], items: [] };

  function bfSprites() {
    const katana = sprite(40, 70, 20, 64, (c, ax, ay) => {
      // a broken blade stuck in the dirt at an angle
      c.save(); c.translate(ax, ay); c.rotate(-.35);
      c.fillStyle = 'rgba(40,28,18,.35)'; c.beginPath(); c.ellipse(0, 2, 8, 3, 0, 0, TAU); c.fill();
      c.fillStyle = '#d8dde2'; c.beginPath(); c.moveTo(-2, 0); c.lineTo(-2.4, -34); c.lineTo(1, -40); c.lineTo(2.2, -33); c.lineTo(2, 0); c.closePath(); c.fill();
      c.strokeStyle = '#6a7076'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#c9a24a'; c.fillRect(-6, -2, 12, 3);
      c.fillStyle = '#2a2224'; c.fillRect(-1.8, 1, 3.6, 11);
      c.restore();
    });
    const kunai = sprite(40, 30, 20, 20, (c, ax, ay) => {
      c.translate(ax, ay);
      for (const [x, y, a] of [[-8, 2, -.5], [4, 0, .3], [10, 4, -.1]]) {
        c.save(); c.translate(x, y); c.rotate(a);
        c.fillStyle = '#9aa3aa'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-3, -9); c.lineTo(0, -14); c.lineTo(3, -9); c.closePath(); c.fill();
        c.fillStyle = '#2a2a30'; c.fillRect(-1, 0, 2, 6);
        c.strokeStyle = '#b8b2a4'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 8, 2.2, 0, TAU); c.stroke();
        c.restore();
      }
    });
    const plate = sprite(46, 30, 23, 18, (c, ax, ay) => {
      // a dented flak vest / forehead protector plate half buried
      c.translate(ax, ay);
      c.fillStyle = 'rgba(40,28,18,.3)'; c.beginPath(); c.ellipse(0, 4, 18, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#4d6a3e'; c.beginPath(); c.moveTo(-16, 2); c.quadraticCurveTo(-14, -9, 0, -10); c.quadraticCurveTo(14, -9, 16, 2); c.closePath(); c.fill();
      c.strokeStyle = '#2c3d22'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#9aa4aa'; c.fillRect(-7, -7, 14, 6);
      c.fillStyle = '#2a2a30'; c.font = 'bold 6px serif'; c.textAlign = 'center'; c.fillText('忍', 0, -2.2);
    });
    const shield = sprite(44, 40, 22, 30, (c, ax, ay) => {
      // a shattered chunk of rock wall from an Earth Release barrier
      c.translate(ax, ay);
      c.fillStyle = 'rgba(40,28,18,.35)'; c.beginPath(); c.ellipse(0, 3, 19, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#8a7a66'; c.beginPath(); c.moveTo(-17, 2); c.lineTo(-13, -18); c.lineTo(-2, -24); c.lineTo(9, -17); c.lineTo(17, 2); c.closePath(); c.fill();
      c.fillStyle = '#a99880'; c.beginPath(); c.moveTo(-13, -18); c.lineTo(-2, -24); c.lineTo(9, -17); c.lineTo(-1, -12); c.closePath(); c.fill();
      c.strokeStyle = '#4e4234'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-17, 2); c.lineTo(-13, -18); c.lineTo(-2, -24); c.lineTo(9, -17); c.lineTo(17, 2); c.moveTo(-2, -12); c.lineTo(3, -2); c.stroke();
    });
    const banner = sprite(54, 150, 12, 144, (c, ax, ay) => {
      // the Allied Shinobi Forces banner: a tall white cloth with 忍 on a pole
      c.translate(ax, ay);
      c.fillStyle = 'rgba(40,28,18,.35)'; c.beginPath(); c.ellipse(4, 2, 14, 4, 0, 0, TAU); c.fill();
      c.fillStyle = '#4a3424'; c.fillRect(-2, -140, 4, 142);
      c.fillStyle = '#c8b06a'; c.beginPath(); c.arc(0, -141, 3.5, 0, TAU); c.fill();
      c.fillStyle = '#f2eee4'; c.beginPath(); c.moveTo(2, -134); c.lineTo(36, -134); c.lineTo(36, -52); c.lineTo(28, -46); c.lineTo(20, -54); c.lineTo(2, -54); c.closePath(); c.fill();
      c.strokeStyle = '#9c2a22'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#16141c'; c.font = 'bold 26px serif'; c.textAlign = 'center'; c.fillText('忍', 19, -82);
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(12, -130); c.lineTo(14, -58); c.moveTo(26, -130); c.lineTo(28, -60); c.stroke();
    });
    const bones = sprite(46, 24, 23, 14, (c, ax, ay) => {
      // a fallen flag of the Alliance, trampled
      c.translate(ax, ay);
      c.fillStyle = '#5a4430'; c.save(); c.rotate(.15); c.fillRect(-22, -1, 44, 3); c.restore();
      c.fillStyle = 'rgba(232,226,212,.9)'; c.beginPath(); c.moveTo(-8, -2); c.quadraticCurveTo(4, -8, 16, -3); c.lineTo(14, 7); c.quadraticCurveTo(2, 3, -9, 6); c.closePath(); c.fill();
      c.strokeStyle = '#9c2a22'; c.lineWidth = 1.4; c.stroke();
    });
    return { katana, kunai, plate, shield, banner, flag: bones };
  }

  function initBattlefield() {
    const bf = layout.battlefield, R = rng(4242);
    const cx = bf.x + bf.w / 2, cy = bf.y + bf.h / 2;
    // a ragged, squarish outline so the plain fills its rectangle but blends into the land
    bfPath = new Path2D();
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const k = 1 + .035 * Math.sin(a * 5 + 1) + .025 * Math.sin(a * 11 + 2) + .015 * Math.sin(a * 23);
      const px = cx + Math.sign(ca) * Math.pow(Math.abs(ca), .45) * bf.w / 2 * k, py = cy + Math.sign(sa) * Math.pow(Math.abs(sa), .45) * bf.h / 2 * k;
      if (i) bfPath.lineTo(px, py); else bfPath.moveTo(px, py);
    }
    bfPath.closePath();
    const dirt = tile('#9c8466', (c, r, S) => {
      for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S, rx = 14 + r() * 46; wrapTile(S, x, y, rx, (px, py) => fell(c, px, py, rx, rx * (.25 + r() * .2), ['rgba(130,106,78,.35)', 'rgba(176,152,120,.3)', 'rgba(146,124,98,.3)'][i % 3])); }
      for (let i = 0; i < 4; i++) { const x = r() * S, y = r() * S, rx = 30 + r() * 30; wrapTile(S, x, y, rx, (px, py) => fell(c, px, py, rx, rx * .35, 'rgba(80,74,70,.1)')); }
      c.strokeStyle = 'rgba(70,50,32,.5)'; c.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) { const x = r() * S, y = r() * S; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8 + r() * 8, y + 3 + r() * 6); c.lineTo(x + 14 + r() * 10, y - 4 + r() * 12); c.stroke(); }
      for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S; wrapTile(S, x, y, 4, (px, py) => fell(c, px, py, 1.6 + r() * 1.6, 1.2 + r(), r() < .5 ? '#6e5a44' : '#c2ad8c')); }
    }, 256, 9);
    A.warDirt = mk(4, 4).getContext('2d').createPattern(dirt, 'repeat');
    A.bf = bfSprites();
    const inside = (x, y, m) => x > bf.x + m && x < bf.x + bf.w - m && y > bf.y + m && y < bf.y + bf.h - m;
    // two giant meteor craters from Tengai Shinsei, then many smaller ones
    BF.craters = [{ x: cx - 900, y: cy + 150, r: 430 }, { x: cx + 1150, y: cy - 280, r: 360 }];
    for (let i = 0; i < 34; i++) {
      const x = bf.x + 120 + R() * (bf.w - 240), y = bf.y + 120 + R() * (bf.h - 240), r = 40 + R() * R() * 170;
      if (BF.craters.some(o => Math.hypot(o.x - x, (o.y - y) * 2) < o.r + r)) continue;
      BF.craters.push({ x, y, r });
    }
    BF.scorches = [];
    for (let i = 0; i < 40; i++) BF.scorches.push({ x: bf.x + R() * bf.w, y: bf.y + R() * bf.h, r: 60 + R() * 160 });
    BF.cracks = [];
    for (let i = 0; i < 46; i++) {
      let x = bf.x + 100 + R() * (bf.w - 200), y = bf.y + 100 + R() * (bf.h - 200), a = R() * TAU;
      const pts = [x, y];
      for (let j = 0; j < 7; j++) { a += (R() - .5) * 1.1; const l = 30 + R() * 70; x += Math.cos(a) * l; y += Math.sin(a) * l * .55; pts.push(x, y); }
      BF.cracks.push(pts);
    }
    BF.items = [];
    const kinds = ['katana', 'kunai', 'kunai', 'plate', 'shield', 'flag'];
    for (let i = 0; i < 170; i++) {
      const x = bf.x + 80 + R() * (bf.w - 160), y = bf.y + 80 + R() * (bf.h - 160);
      if (!inside(x, y, 60)) continue;
      BF.items.push([kinds[Math.floor(R() * kinds.length)], x, y]);
    }
    // banners along the north edge and down the sides, where the Alliance holds its line
    for (let x = bf.x + 260; x < bf.x + bf.w - 200; x += 330) BF.items.push(['banner', x + (R() - .5) * 60, bf.y + 150 + R() * 40]);
    for (let y = bf.y + 520; y < bf.y + bf.h - 200; y += 420) { BF.items.push(['banner', bf.x + 170, y]); BF.items.push(['banner', bf.x + bf.w - 150, y + 120]); }
    BF.items.sort((p, q) => p[2] - q[2]);
  }

  function drawBattlefield(ctx, bounds) {
    const bf = layout.battlefield;
    if (!bfPath || bounds.x > bf.x + bf.w + 200 || bounds.x + bounds.w < bf.x - 200 || bounds.y > bf.y + bf.h + 200 || bounds.y + bounds.h < bf.y - 200) return;
    const near = (x, y, m) => x > bounds.x - m && x < bounds.x + bounds.w + m && y > bounds.y - m && y < bounds.y + bounds.h + m;
    // trampled border blending into the land around it
    ctx.strokeStyle = 'rgba(150,124,92,.55)'; ctx.lineWidth = 90; ctx.lineJoin = 'round'; ctx.stroke(bfPath);
    ctx.strokeStyle = 'rgba(140,114,84,.7)'; ctx.lineWidth = 40; ctx.stroke(bfPath);
    ctx.save();
    ctx.clip(bfPath);
    ctx.fillStyle = A.warDirt; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    // scorch marks
    for (const sc of BF.scorches) {
      if (!near(sc.x, sc.y, sc.r)) continue;
      const g = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, sc.r);
      g.addColorStop(0, 'rgba(40,30,26,.42)'); g.addColorStop(.6, 'rgba(50,38,30,.2)'); g.addColorStop(1, 'rgba(50,38,30,0)');
      ctx.fillStyle = g; ctx.save(); ctx.translate(sc.x, sc.y); ctx.scale(1, .55); ctx.translate(-sc.x, -sc.y);
      ctx.beginPath(); ctx.arc(sc.x, sc.y, sc.r, 0, TAU); ctx.fill(); ctx.restore();
    }
    // the cracked earth
    ctx.strokeStyle = 'rgba(52,36,22,.55)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (const pts of BF.cracks) {
      if (!near(pts[0], pts[1], 520)) continue;
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    }
    // craters: a dark bowl, a lit lower rim, a shadowed upper rim and rocks thrown round it
    for (const cr of BF.craters) {
      if (!near(cr.x, cr.y, cr.r + 40)) continue;
      const { x, y, r } = cr;
      ctx.fillStyle = 'rgba(120,98,72,.6)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.18, r * .6, 0, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(x, y - r * .08, r * .1, x, y, r);
      g.addColorStop(0, '#4e3c2c'); g.addColorStop(.7, '#6a543e'); g.addColorStop(1, '#7e6a52');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(40,28,18,.6)'; ctx.lineWidth = Math.max(2, r * .04);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.strokeStyle = 'rgba(214,192,156,.75)'; ctx.lineWidth = Math.max(2, r * .035);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, Math.PI * .1, Math.PI * .9); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,28,18,.45)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU + hash2(x | 0, i, 7), l = r * (1.1 + hash2(i, y | 0, 8) * .5);
        ctx.moveTo(x + Math.cos(a) * r * .95, y + Math.sin(a) * r * .48); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * .5);
      }
      ctx.stroke();
      if (r > 120) for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + .4, rk = (r > 300 ? A.redRocks : A.greyRocks)[i % 2];
        const px = x + Math.cos(a) * r * 1.05, py = y + Math.sin(a) * r * .55;
        if (near(px, py, 80)) ctx.drawImage(rk.cv, Math.round(px - rk.ax * .7), Math.round(py - rk.ay * .7), rk.cv.width * .7, rk.cv.height * .7);
      }
    }
    // debris and banners, back to front
    for (const [kind, x, y] of BF.items) {
      const s = A.bf[kind];
      if (!near(x, y, 160)) continue;
      ctx.drawImage(s.cv, Math.round(x - s.ax), Math.round(y - s.ay));
    }
    ctx.restore();
  }


  // ------------------------------------------------------------------ state
  const A = {};
  let ready = false;
  const paths = {};
  const holes = [];        // village + Konoha rects (no wilderness decor inside)
  const seaBridges = [];   // {x, y0, y1}: vertical road spans over the sea

  function init() {
    if (ready) return;
    const T = makeTiles(), tmp = mk(4, 4).getContext('2d');
    for (const k in T) A[k] = tmp.createPattern(T[k], 'repeat');
    A.trees = [makeTree(22, 11, ['#1e4826', '#2e7a34', '#48a03c', '#79c24a']), makeTree(26, 12, ['#1e4826', '#2e7a34', '#48a03c', '#79c24a']),
      makeTree(30, 13, ['#143620', '#22602c', '#348736', '#56aa44']), makeTree(24, 14, ['#3a2a1a', '#c45a2a', '#e07a36', '#f4a24e'])];
    A.pines = [makePine(1, 21), makePine(1.25, 22), makePine(.85, 23)];
    A.greyRocks = [makeBoulder(22, ['#8a8f94', '#b8bec4', '#5c6166'], 31), makeBoulder(34, ['#7d838a', '#aab1b8', '#50565c'], 32)];
    A.redRocks = [makeBoulder(24, ['#a5683f', '#d39a6a', '#6e4026'], 41), makeBoulder(36, ['#9a5c36', '#c88a5a', '#62381f'], 42)];
    A.sandRocks = [makeBoulder(18, ['#c9a26a', '#ecd2a0', '#8f6c3e'], 51), makeBoulder(28, ['#bf9460', '#e2c48e', '#86602f'], 52)];
    A.seaRocks = [makeBoulder(20, ['#59636b', '#8a959d', '#353d44'], 61)];
    A.mesa = [makeMesa(71), makeMesa(72)];
    A.dunes = [makeDune(240, 81), makeDune(320, 82), makeDune(180, 83)];
    A.signs = layout.signs.map(s => makeSign(s.lines));
    initBattlefield();
    for (const b of BIOMES) paths[b.id] = blobPath(b);
    holes.length = 0;
    holes.push({ x: KONOHA.x - 200, y: KONOHA.y - 620, w: KONOHA.size + 400, h: KONOHA.size + 1000 });
    // Wilderness sprites rise up to ~200 px above their base point, so keep bases clear below and beside each village.
    for (const v of Object.values(layout.villages)) holes.push({ x: v.x - 170, y: v.y - 100, w: v.size + 340, h: v.size + 330 });
    const bf = layout.battlefield;
    holes.push({ x: bf.x - 120, y: bf.y - 60, w: bf.w + 240, h: bf.h + 260 });
    // Vertical roads that cross open sea get a bridge (the Yu road clips the Land of Water's shore).
    seaBridges.length = 0;
    for (const road of layout.roads) for (let i = 1; i < road.length; i++) {
      const [ax, ay] = road[i - 1], [bx, by] = road[i];
      if (ax !== bx) continue;
      let y0 = null, y1 = null;
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y += 20) if (inBiome(BIOMES[3], ax, y)) { if (y0 === null) y0 = y; y1 = y; }
      if (y0 !== null) seaBridges.push({ x: ax, y0: y0 - 60, y1: y1 + 60 });
    }
    ready = true;
  }

  function biomeAt(x, y) {
    for (let i = BIOMES.length - 1; i >= 0; i--) if (inBiome(BIOMES[i], x, y)) return BIOMES[i].id;
    return 'grass';
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + dx * t - px, ay + dy * t - py);
  }
  function nearRoad(x, y, m) {
    for (const road of layout.roads) for (let i = 1; i < road.length; i++) if (segDist(x, y, road[i - 1][0], road[i - 1][1], road[i][0], road[i][1]) < m) return true;
    return false;
  }
  const inHole = (x, y) => holes.some(h => x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h);

  function drawRoad(ctx, road, overSea) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); road.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = overSea ? '#5b3d26' : '#b39265'; ctx.lineWidth = 146; ctx.stroke();
    ctx.strokeStyle = overSea ? '#a87a4a' : '#d9c093'; ctx.lineWidth = 126; ctx.stroke();
    if (!overSea) {
      // Two cart ruts along the road (solid strokes stay cheap however long the road is).
      ctx.strokeStyle = 'rgba(160,128,86,.45)'; ctx.lineWidth = 44; ctx.stroke();
      ctx.strokeStyle = '#d9c093'; ctx.lineWidth = 30; ctx.stroke();
    }
  }

  // The bridge to Kirigakure: planks and red rails where the road crosses open sea.
  function drawBridge(ctx, road, bounds) {
    const [a, b] = road;
    const x0 = Math.max(a[0], bounds.x - 100), x1 = Math.min(b[0], bounds.x + bounds.w + 100), y = a[1];
    if (x1 <= x0 || y < bounds.y - 140 || y > bounds.y + bounds.h + 140) return;
    ctx.fillStyle = 'rgba(10,40,70,.35)'; ctx.fillRect(x0, y + 62, x1 - x0, 14);
    ctx.fillStyle = '#a87a4a'; ctx.fillRect(x0, y - 64, x1 - x0, 128);
    ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let x = Math.floor(x0 / 14) * 14; x < x1; x += 14) { ctx.moveTo(x, y - 64); ctx.lineTo(x, y + 64); }
    ctx.stroke();
    for (const ry of [y - 64, y + 60]) {
      ctx.fillStyle = '#b8402e'; ctx.fillRect(x0, ry - 20, x1 - x0, 6);
      for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) ctx.fillRect(x - 3, ry - 20, 6, 24);
    }
    for (let x = Math.floor(x0 / 260) * 260; x < x1; x += 260) { ctx.fillStyle = 'rgba(10,40,70,.45)'; ctx.fillRect(x - 8, y + 64, 16, 22); }
  }

  // A north-south plank bridge with red rails where a vertical road crosses the sea.
  function drawBridgeV(ctx, b, bounds) {
    const y0 = Math.max(b.y0, bounds.y - 100), y1 = Math.min(b.y1, bounds.y + bounds.h + 100), x = b.x;
    if (y1 <= y0 || x < bounds.x - 140 || x > bounds.x + bounds.w + 140) return;
    ctx.fillStyle = 'rgba(10,40,70,.35)'; ctx.fillRect(x + 62, y0, 14, y1 - y0);
    ctx.fillStyle = '#a87a4a'; ctx.fillRect(x - 64, y0, 128, y1 - y0);
    // stone abutments where the road meets the deck
    for (const ay of [b.y0, b.y1 - 26]) if (ay + 26 > y0 && ay < y1) { ctx.fillStyle = '#8f8a80'; ctx.fillRect(x - 76, ay, 152, 26); ctx.fillStyle = '#b9b3a6'; ctx.fillRect(x - 76, ay, 152, 6); }
    ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let y = Math.floor(y0 / 14) * 14; y < y1; y += 14) { ctx.moveTo(x - 64, y); ctx.lineTo(x + 64, y); }
    ctx.stroke();
    for (const rx of [x - 66, x + 60]) {
      ctx.fillStyle = '#b8402e'; ctx.fillRect(rx, y0, 6, y1 - y0);
      for (let y = Math.ceil((y0 + 30) / 60) * 60; y < y1 - 30; y += 60) { ctx.fillStyle = '#8e2e20'; ctx.fillRect(rx - 2, y - 3, 10, 7); }
    }
    for (let y = Math.floor(y0 / 260) * 260 + 130; y < y1; y += 260) { ctx.fillStyle = 'rgba(10,40,70,.45)'; ctx.fillRect(x - 64, y, 128, 10); }
  }

  // ------------------------------------------------------------------ API
  // Fully inside a village square, the village paints every pixel: skip the wilderness.
  const covered = (x, y, w, h) => {
    if (x >= KONOHA.x && y >= KONOHA.y && x + w <= KONOHA.x + KONOHA.size && y + h <= KONOHA.y + KONOHA.size) return true;
    for (const v of Object.values(layout.villages)) if (x >= v.x && y >= v.y && x + w <= v.x + v.size && y + h <= v.y + v.size) return true;
    return false;
  };
  // Blob borders wobble between 0.84r and 1.16r; between those, the exact outline is needed.
  function biomeCoverage(b, x, y, w, h) {
    const nx = Math.max(x, Math.min(b.x, x + w)), ny = Math.max(y, Math.min(b.y, y + h));
    if (Math.hypot(nx - b.x, ny - b.y) > b.r * 1.17) return 'none';
    const far = Math.max(Math.hypot(x - b.x, y - b.y), Math.hypot(x + w - b.x, y - b.y), Math.hypot(x - b.x, y + h - b.y), Math.hypot(x + w - b.x, y + h - b.y));
    return far < b.r * .83 ? 'all' : 'edge';
  }

  function drawStatic(ctx, bounds) {
    if (!ready) init();
    const { x, y, w, h } = bounds;
    if (covered(x, y, w, h)) return;
    ctx.fillStyle = A.grass; ctx.fillRect(x, y, w, h);
    for (const b of BIOMES) {
      const cover = biomeCoverage(b, x, y, w, h);
      if (cover === 'none') continue;
      ctx.fillStyle = A[b.id === 'desert' ? 'sand' : b.id];
      if (cover === 'all') { ctx.fillRect(x, y, w, h); continue; }
      ctx.fill(paths[b.id]);
      ctx.strokeStyle = b.id === 'sea' ? 'rgba(240,250,255,.7)' : 'rgba(60,40,20,.18)'; ctx.lineWidth = b.id === 'sea' ? 10 : 18; ctx.stroke(paths[b.id]);
    }
    // roads (the Kiri road turns into a bridge out at sea); only segments near the view are stroked
    for (const road of layout.roads) for (let i = 1; i < road.length; i++) {
      const [ax, ay] = road[i - 1], [bx, by] = road[i];
      if (Math.max(ax, bx) + 100 < x || Math.min(ax, bx) - 100 > x + w || Math.max(ay, by) + 100 < y || Math.min(ay, by) - 100 > y + h) continue;
      // clamp the segment to the view so the stroke never spans thousands of off-screen pixels
      const cx0 = Math.max(Math.min(ax, bx), x - 200), cx1 = Math.min(Math.max(ax, bx), x + w + 200);
      const cy0 = Math.max(Math.min(ay, by), y - 200), cy1 = Math.min(Math.max(ay, by), y + h + 200);
      drawRoad(ctx, ax === bx ? [[ax, cy0], [ax, cy1]] : [[cx0, ay], [cx1, ay]], false);
    }
    const kiriRoad = layout.roads[3], sea = BIOMES[3];
    const shore = sea.x - sea.r * 1.02;
    drawBridge(ctx, [[shore, kiriRoad[0][1]], kiriRoad[1]], bounds);
    for (const b of seaBridges) drawBridgeV(ctx, b, bounds);
    drawBattlefield(ctx, bounds);
    // scattered trees, rocks and buttes, placed on a 300px grid
    const G = 300, gx0 = Math.floor((x - 160) / G), gx1 = Math.floor((x + w + 160) / G), gy0 = Math.floor((y - 40) / G), gy1 = Math.floor((y + h + 260) / G);
    const items = [];
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const roll = hash2(gx, gy, 9), px = gx * G + hash2(gx, gy, 2) * G, py = gy * G + hash2(gx, gy, 3) * G;
      if (px < 0 || py < 0 || px > layout.world.w || py > layout.world.h || inHole(px, py) || nearRoad(px, py, 130)) continue;
      const biome = biomeAt(px, py), k = hash2(gx, gy, 5);
      let s = null;
      if (biome === 'grass') s = roll < .62 ? A.trees[Math.floor(k * A.trees.length)] : null;
      else if (biome === 'mount') s = roll < .45 ? A.pines[Math.floor(k * 3)] : roll < .6 ? A.greyRocks[Math.floor(k * 2)] : null;
      else if (biome === 'rock') s = roll < .1 ? A.mesa[Math.floor(k * 2)] : roll < .38 ? A.redRocks[Math.floor(k * 2)] : null;
      else if (biome === 'desert') s = roll < .12 ? A.sandRocks[Math.floor(k * 2)] : roll < .5 ? A.dunes[Math.floor(k * 3)] : null;
      else if (biome === 'sea') s = roll < .05 ? A.seaRocks[0] : null;
      if (s) items.push([s, px, py]);
    }
    items.sort((a, b) => a[2] - b[2]);
    for (const [s, px, py] of items) ctx.drawImage(s.cv, Math.round(px - s.ax), Math.round(py - s.ay));
    layout.signs.forEach((sg, i) => {
      if (sg.x < x - 200 || sg.x > x + w + 200 || sg.y < y - 40 || sg.y > y + h + 200) return;
      const s = A.signs[i]; ctx.drawImage(s.cv, Math.round(sg.x - s.ax), Math.round(sg.y - s.ay));
    });
  }

  // Konoha's border forest is painted over the road ends; repaint the road through the gaps.
  function drawRoadStubs(ctx, bounds) {
    if (!ready) return;
    for (const sx of [KONOHA.x - 200, KONOHA.x + KONOHA.size - 60]) {
      if (sx + 260 < bounds.x || sx > bounds.x + bounds.w) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(sx, 7875 - 90, 260, 180); ctx.clip();
      drawRoad(ctx, [[sx - 40, 7875], [sx + 300, 7875]], false);
      ctx.restore();
    }
  }

  function drawAmbient(ctx, view, time) {
    if (!ready) return;
    // Waves glint across the Land of Water.
    const sea = BIOMES[3];
    if (view.x + view.w > sea.x - sea.r * 1.1 && view.y + view.h > sea.y - sea.r * 1.1) {
      ctx.strokeStyle = 'rgba(235,250,255,.55)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const px = view.x + ((hash2(i, 1, 1) * view.w + time * 18) % view.w), py = view.y + hash2(i, 2, 1) * view.h;
        if (!inBiome(sea, px, py) || inHole(px, py)) continue;
        const wv = 10 + 6 * Math.sin(time * 2 + i);
        ctx.moveTo(px - wv, py); ctx.quadraticCurveTo(px, py - 4, px + wv, py);
      }
      ctx.stroke();
    }
  }

  // Paints the whole world into a minimap canvas: ctx is scaled so 1 unit = 1 world px.
  function drawMinimap(ctx) {
    if (!ready) init();
    ctx.fillStyle = '#76ad3e'; ctx.fillRect(0, 0, layout.world.w, layout.world.h);
    const cols = { rock: '#a88a68', mount: '#8f9a86', desert: '#e3c48a', sea: '#2f7ea6' };
    for (const b of BIOMES) { ctx.fillStyle = cols[b.id]; ctx.fill(paths[b.id]); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const road of layout.roads) { ctx.beginPath(); road.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.strokeStyle = '#e8d3a0'; ctx.lineWidth = 220; ctx.stroke(); }
    ctx.fillStyle = '#8c7354'; ctx.fill(bfPath);
  }

  // Name of the land or village at a world point (for the "entering ..." banner).
  function regionAt(x, y, villageNames) {
    if (x >= KONOHA.x && x < KONOHA.x + KONOHA.size && y >= KONOHA.y - 600 && y < KONOHA.y + KONOHA.size + 300) return 'LÀNG LÁ · 木ノ葉隠れの里';
    for (const [id, v] of Object.entries(layout.villages))
      if (x >= v.x && x < v.x + v.size && y >= v.y && y < v.y + v.size) return villageNames[id] || id;
    const bf = layout.battlefield;
    if (x > bf.x && x < bf.x + bf.w && y > bf.y && y < bf.y + bf.h) return 'CHIẾN TRƯỜNG ĐẠI CHIẾN · 第四次忍界大戦';
    for (let i = BIOMES.length - 1; i >= 0; i--) if (inBiome(BIOMES[i], x, y)) return BIOMES[i].name;
    return FIRE_NAME;
  }

  window.WorldMap = { layout, init, drawStatic, drawRoadStubs, drawAmbient, drawMinimap, regionAt };
})();
