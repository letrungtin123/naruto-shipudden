/* Six Paths Sage Mode (I) — "giống Madara Lục Đạo".
 * Naruto awakens Hagoromo's power: he floats, a golden chakra outline flickers round him, nine black
 * truth-seeking balls (Gudōdama) ring his back and swallow enemy shots, and left click walks a
 * 12-step combo of Six Paths jutsu ending in Tengai Shinsei (three meteors).
 *
 * Contract (game.js): toggle / click / update / drawGround / drawOverlay / drawAura (see the brief).
 * `st` (sixPathsState) is plain JSON sent to teammates: effects carry their own age and every hit is
 * resolved in update() on the caster's machine; drawing works from the data alone. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const win = (t, a, b) => c01((t - a) / (b - a));
  const easeOut = t => 1 - Math.pow(1 - c01(t), 3);
  const easeIn = t => { t = c01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * c01(t));
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const r0 = v => Math.round(v);
  const r2 = v => Math.round(v * 100) / 100;
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const sid = () => (Spr() && Spr().has('naruto_rikudo') ? 'naruto_rikudo' : 'naruto');

  // ------------------------------------------------------------------ the combo
  const COMBO = ['orbs', 'staff', 'rods', 'limbo', 'orbs7', 'rasen', 'wave', 'staff', 'rods', 'limbo', 'rasen', 'tengai'];
  const NAMES = {
    orbs: 'CẦU ĐẠO NGỌC · PHI ĐẠN', orbs7: 'CẦU ĐẠO NGỌC · PHI ĐẠN', staff: 'LỤC ĐẠO TÍCH TRƯỢNG',
    rods: 'CẦU ĐẠO NGỌC · HẮC BỔNG VŨ', limbo: 'LUÂN MỘ · BIÊN NGỤC',
    rasen: 'TIÊN PHÁP · LOA TOÀN THỦ LÝ KIẾM', wave: 'CẦU ĐẠO NGỌC · HẮC THUẪN BA',
    tengai: 'LỤC ĐẠO · THIÊN ẢI CHẤN TINH', awaken: 'LỤC ĐẠO TIÊN NHÂN'
  };
  const MAX_FX = 16;
  const ABSORB_R = 110;

  const GOLD_FLAME = [[1, '#a8460a'], [.84, '#e8780e'], [.66, '#ffad22'], [.46, '#ffe066'], [.25, '#fffbe6']];
  const METEOR_DIR = { x: .42, y: -.91 };
  const TENGAI = { wind: .45, fall: 1.2, life: 3.0, r: 250, spread: 175, delays: [0, .28, .56], dmg: 7000 };
  const RASEN = { hold: .26, speed: 1500, R: 300, ticks: 6, tick: .12, burst: .82, life: 1.15 };
  const LIMBO_HITS = [.24, .42, .6, .78];

  function ensure(st) {
    if (!Array.isArray(st.effects)) st.effects = [];
    if (typeof st.hide !== 'number') st.hide = 0;
    return st;
  }
  function add(st, fx) {
    const L = st.effects;
    if (L.length >= MAX_FX) {
      const i = L.findIndex(f => f.k === 'abs');
      L.splice(i >= 0 ? i : 0, 1);
    }
    fx.age = 0;
    L.push(fx);
    return fx;
  }
  function label(st, kind) { st.lbl = { t: NAMES[kind] || '', a: 0 }; }
  function aimAngle(p, t) { return Math.atan2(t.y - p.y, t.x - p.x); }

  // ------------------------------------------------------------------ cached art
  function tsbSprite() {
    return Kit().sphere('sp:tsb', [[0, '#9a90a8'], [.12, '#3a3546'], [.45, '#100e16'], [.85, '#050407'], [1, '#000']]);
  }
  // A truth-seeking ball: a glossy black sphere with a thin golden chakra rim (reads on sand and grass).
  function drawBall(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,196,90,.55)';
    ctx.beginPath(); ctx.arc(x, y, r + 1.4, 0, TAU); ctx.fill();
    ctx.drawImage(tsbSprite(), x - r, y - r, r * 2, r * 2);
  }
  // A black Gudōdama rod (pointed both ends) centred at x,y along angle ang.
  function drawRod(ctx, x, y, ang, len, w) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const h = len / 2;
    ctx.fillStyle = 'rgba(255,190,90,.5)';
    ctx.beginPath(); ctx.moveTo(-h - 2, 0); ctx.lineTo(-h + 6, -w / 2 - 1.5); ctx.lineTo(h - 9, -w / 2 - 1.5); ctx.lineTo(h + 3, 0); ctx.lineTo(h - 9, w / 2 + 1.5); ctx.lineTo(-h + 6, w / 2 + 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#07060b';
    ctx.beginPath(); ctx.moveTo(-h, 0); ctx.lineTo(-h + 6, -w / 2); ctx.lineTo(h - 9, -w / 2); ctx.lineTo(h, 0); ctx.lineTo(h - 9, w / 2); ctx.lineTo(-h + 6, w / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a6680'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-h + 7, -w / 2 + 1.2); ctx.lineTo(h - 10, -w / 2 + 1.2); ctx.stroke();
    ctx.restore();
  }
  // The Six Paths shakujō: a black staff with a ringed head.
  function drawStaff(ctx, x, y, ang, len, alpha) {
    const K = Kit();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,200,110,.45)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-len * .25, 0); ctx.lineTo(len, 0); ctx.stroke();
    ctx.strokeStyle = '#05060b'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#5b5c72'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-len * .22, -1.6); ctx.lineTo(len * .95, -1.6); ctx.stroke();
    ctx.strokeStyle = '#05060b'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(len + 13, 0, 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,150,.75)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#05060b';
    ctx.beginPath(); ctx.arc(len + 30, 0, 9, -1.4, 1.4); ctx.arc(len + 26, 0, 7, 1.2, -1.2, true); ctx.fill();
    for (const s of [-1, 1]) { ctx.strokeStyle = '#0c0c14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(len + 9, s * 13, 4, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, len + 13, 0, 24, '255,180,70', .45 * alpha);
    ctx.restore();
  }
  function tomoe(g, x, y, r, a, color) {
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = color; g.lineWidth = r * .8; g.lineCap = 'round';
    g.beginPath(); g.arc(x - Math.cos(a) * r * 1.4, y - Math.sin(a) * r * 1.4, r * 1.6, a - .2, a + 1.3); g.stroke();
  }
  // Hagoromo's seal printed on the ground: golden rings with nine black magatama.
  function sealSprite() {
    return Kit().sprite('sp:seal', 256, 256, g => {
      g.translate(128, 128);
      const ring = (r, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); };
      ring(121, 8, 'rgba(70,28,0,.55)'); ring(121, 3.2, '#ffd257');
      ring(97, 6, 'rgba(70,28,0,.5)'); ring(97, 2.2, '#ffe28a');
      ring(54, 6, 'rgba(70,28,0,.5)'); ring(54, 2.4, '#ffd257');
      g.strokeStyle = 'rgba(255,214,110,.55)'; g.lineWidth = 1.6;
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * TAU;
        g.beginPath(); g.moveTo(Math.cos(a) * 58, Math.sin(a) * 58); g.lineTo(Math.cos(a) * 93, Math.sin(a) * 93); g.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU - Math.PI / 2, x = Math.cos(a) * 109, y = Math.sin(a) * 109;
        tomoe(g, x, y, 8.4, a + Math.PI / 2, '#ffd257');
        tomoe(g, x, y, 6.4, a + Math.PI / 2, '#120a10');
      }
      g.fillStyle = 'rgba(70,28,0,.45)'; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
      ring(24, 3, '#ffd257');
      g.fillStyle = '#0c080e'; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; tomoe(g, Math.cos(a) * 38, Math.sin(a) * 38, 5, a + Math.PI / 2, '#ffd257'); }
    });
  }
  // Four curved wind blades for the Rasenshuriken held overhead.
  function bladeSprite() {
    return Kit().sprite('sp:blades', 128, 128, g => {
      g.translate(64, 64);
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * TAU / 4);
        g.beginPath(); g.moveTo(8, -7); g.quadraticCurveTo(40, -20, 63, -2); g.quadraticCurveTo(38, -3, 10, 9); g.closePath();
        g.fillStyle = 'rgba(36,116,228,.6)'; g.fill();
        g.beginPath(); g.moveTo(10, -4); g.quadraticCurveTo(40, -14, 60, -2); g.quadraticCurveTo(38, -1, 12, 5); g.closePath();
        g.fillStyle = 'rgba(240,252,255,.95)'; g.fill();
        g.restore();
      }
      g.strokeStyle = 'rgba(200,236,255,.6)'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.stroke();
    });
  }
  function rockSprite() {
    return Kit().sprite('sp:meteor', 192, 192, g => {
      const c = 96, R = 88, path = () => {
        g.beginPath();
        for (let i = 0; i <= 26; i++) {
          const a = i / 26 * TAU, r = R * (.9 + hash(i % 26) * .1);
          if (i) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = '#3e322c'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#5f4e42'; g.beginPath(); g.arc(c + 26, c - 30, R * .95, 0, TAU); g.fill();
      g.fillStyle = '#7a6656'; g.beginPath(); g.arc(c + 46, c - 52, R * .6, 0, TAU); g.fill();
      g.fillStyle = '#2a201c'; g.beginPath(); g.arc(c - 40, c + 44, R * .75, 0, TAU); g.fill();
      for (let i = 0; i < 9; i++) {
        const x = c + (hash(i * 3.1) - .5) * R * 1.5, y = c + (hash(i * 5.7) - .5) * R * 1.5, r = 7 + hash(i * 1.9) * 14;
        g.fillStyle = 'rgba(30,22,18,.75)'; g.beginPath(); g.ellipse(x, y, r, r * .8, .5, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(150,128,108,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + 1, y - 1, r, r * .8, .5, 3.6, 5.6); g.stroke();
      }
      g.strokeStyle = '#ff7a26'; g.lineWidth = 2.4; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        let x = c - 60 + hash(i * 9.1) * 50, y = c + 10 + hash(i * 4.4) * 60;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += 10 + hash(i * 7 + k) * 14; y += (hash(i * 3 + k * 5) - .6) * 22; g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      path(); g.strokeStyle = '#1a1210'; g.lineWidth = 4; g.stroke();
    });
  }
  // Limbo's invisible shadows: Naruto's silhouette, dark with a golden rim.
  function silhouette(facing, rim) {
    const S = Spr(), id = sid();
    return Kit().sprite('sp:sil:' + id + ':' + facing + ':' + (rim ? 1 : 0), 160, 170, g => {
      if (rim) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) S.draw(g, id, 80 + dx, 160 + dy, { facing, frame: 'attack', phase: 0 });
      else S.draw(g, id, 80, 160, { facing, frame: 'attack', phase: 0 });
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = rim ? '#ffcf5a' : '#120a18'; g.fillRect(0, 0, 160, 170);
    });
  }
  function drawSilhouette(ctx, x, feetY, facing, alpha) {
    if (!(alpha > .01) || !Spr()) return;
    ctx.globalAlpha = Math.min(1, alpha * .8);
    ctx.drawImage(silhouette(facing, true), x - 80, feetY - 160);
    ctx.globalAlpha = Math.min(1, alpha * 1.4);
    ctx.drawImage(silhouette(facing, false), x - 80, feetY - 160);
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ view culling (co-op draws everyone's jutsu)
  const VIEW = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
  function setView(ctx) {
    const m = ctx.getTransform ? ctx.getTransform() : null, c = ctx.canvas;
    if (!m || !c || !m.a || !m.d || m.b || m.c) { VIEW.x0 = VIEW.y0 = -1e9; VIEW.x1 = VIEW.y1 = 1e9; return; }
    const xa = -m.e / m.a, xb = (c.width - m.e) / m.a, ya = -m.f / m.d, yb = (c.height - m.f) / m.d;
    VIEW.x0 = Math.min(xa, xb); VIEW.x1 = Math.max(xa, xb); VIEW.y0 = Math.min(ya, yb); VIEW.y1 = Math.max(ya, yb);
  }
  const vis = (x, y, r) => x + r > VIEW.x0 && x - r < VIEW.x1 && y + r > VIEW.y0 && y - r < VIEW.y1;
  const REACH = { orbs: 1000, staff: 700, rods: 400, limbo: 500, rasen: 1100, wave: 650, tengai: 900, awaken: 400, fade: 200, abs: 80 };

  // ------------------------------------------------------------------ casts
  function castOrbs(st, p, api, n) {
    const t = api.aim(900), seed = r0(Math.random() * 97), b = [];
    let dur = 0;
    for (let i = 0; i < n; i++) {
      const ra = i / n * TAU + api.time * .6;
      const ox = r0(Math.cos(ra) * 34), oh = r0(46 + Math.sin(ra) * 30 + (p.spLift || 0));
      const spread = i === 0 ? 0 : 55 + hash(i * 3.1 + seed) * 70, sa = i * 2.4 + seed;
      const tx = r0(t.x + Math.cos(sa) * spread), ty = r0(t.y + Math.sin(sa) * spread * .75);
      const d = Math.hypot(tx - p.x - ox, ty - p.y);
      const delay = r2(i * .055), fl = r2(Math.max(.16, d / 1700 + .06));
      b.push([ox, oh, tx, ty, delay, fl]);
      dur = Math.max(dur, delay + fl + .7);
    }
    add(st, { k: 'orbs', x: r0(p.x), y: r0(p.y), b, hm: 0, dur: r2(dur), seed });
    st.hide = Math.min(9, st.hide + n);
    p.fireCooldown = n > 5 ? .5 : .42; p.castPose = .3; p.castFrame = 'attack';
  }
  function castStaff(st, p, api) {
    const t = api.aim(600);
    add(st, { k: 'staff', x: r0(p.x), y: r0(p.y), a: r2(aimAngle(p, t)), s: (p.spCount || 0) % 2 ? 1 : -1, l: r0(p.spLift || 0), h: 0, dur: 1 });
    st.hide = Math.min(9, st.hide + 1);
    p.fireCooldown = .6; p.castPose = .55; p.castFrame = 'attack';
  }
  function castRods(st, p, api) {
    const t = api.aim(750);
    add(st, { k: 'rods', x: r0(t.x), y: r0(t.y), R: 215, n: 22, ln: 0, e: 0, f: Math.cos(p.angle || 0) >= 0 ? 1 : -1, seed: r0(Math.random() * 97), dur: 1.7 });
    st.hide = Math.min(9, st.hide + 4);
    p.fireCooldown = .62; p.castPose = .35; p.castFrame = 'raise';
  }
  function castLimbo(st, p, api) {
    const t = api.aim(650), R = 330, list = [];
    for (const z of api.enemies) {
      if (!(z.health > 0)) continue;
      const d = Math.hypot(z.x - t.x, z.y - t.y);
      if (d < R + (z.r || 12)) list.push([d, z]);
    }
    list.sort((a, b) => a[0] - b[0]);
    const tg = list.slice(0, 10).map(([, z]) => [z.id, r0(z.x), r0(z.y), 1]);
    if (!tg.length) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + Math.random(); tg.push([0, r0(t.x + Math.cos(a) * 140), r0(t.y + Math.sin(a) * 90), 0]); }
    add(st, { k: 'limbo', x: r0(t.x), y: r0(t.y), R, tg, sk: 0, dur: 1.15 });
    p.fireCooldown = .68; p.castPose = .4; p.castFrame = 'seal';
  }
  function castRasen(st, p, api) {
    const t = api.aim(900), d = Math.hypot(t.x - p.x, t.y - p.y);
    const fl = r2(Math.max(.15, d / RASEN.speed));
    add(st, { k: 'rasen', x: r0(p.x), y: r0(p.y), sx: r0(p.x), sy: r0(p.y), tx: r0(t.x), ty: r0(t.y), l: r0(p.spLift || 0),
      fl, h: 0, tk: 0, nt: 0, dur: r2(RASEN.hold + fl + RASEN.life) });
    st.hide = Math.min(9, st.hide + 4);
    p.fireCooldown = .74; p.castPose = RASEN.hold + .02; p.castFrame = 'raise';
  }
  function castWave(st, p, api) {
    add(st, { k: 'wave', x: r0(p.x), y: r0(p.y), R: 560, l: r0(p.spLift || 0), h: 0, dur: 1 });
    st.hide = 9;
    p.fireCooldown = .56; p.castPose = .35; p.castFrame = 'seal';
  }
  function castTengai(st, p, api) {
    const t = api.aim(760), a0 = aimAngle(p, t) + Math.PI / 2, m = [];
    for (let j = 0; j < 3; j++) {
      const a = a0 + j * TAU / 3;
      m.push([r0(t.x + Math.cos(a) * TENGAI.spread), r0(t.y + Math.sin(a) * TENGAI.spread * .62), TENGAI.delays[j], r0(Math.random() * 90)]);
    }
    add(st, { k: 'tengai', x: r0(t.x), y: r0(t.y), px: r0(p.x), py: r0(p.y), l: r0(p.spLift || 0), m, h: 0,
      dur: r2(TENGAI.wind + TENGAI.delays[2] + TENGAI.fall + TENGAI.life) });
    p.fireCooldown = 1.5; p.castPose = .7; p.castFrame = 'raise';
  }
  const CAST = {
    orbs: (st, p, api) => castOrbs(st, p, api, 5), orbs7: (st, p, api) => castOrbs(st, p, api, 7),
    staff: castStaff, rods: castRods, limbo: castLimbo, rasen: castRasen, wave: castWave, tengai: castTengai
  };

  // ------------------------------------------------------------------ update (caster only)
  function rodPos(fx, i, out) {
    const a = hash(i * 7.13 + fx.seed) * TAU, rr = Math.sqrt(hash(i * 3.71 + fx.seed)) * fx.R;
    out.x = fx.x + Math.cos(a) * rr; out.y = fx.y + Math.sin(a) * rr * .62;
    out.t = .18 + i / fx.n * .55;
    return out;
  }
  const TMP = { x: 0, y: 0, t: 0 };
  function rasenPos(fx, out) {
    const k = c01((fx.age - RASEN.hold) / fx.fl);
    out.x = lerp(fx.sx, fx.tx, k); out.y = lerp(fx.sy, fx.ty, k);
    return k;
  }
  function tengaiMeteor(fx, j, out) {
    const m = fx.m[j];
    out.x = m[0]; out.y = m[1]; out.t = fx.age - TENGAI.wind - m[2];
    return out;
  }

  function updateFx(st, fx, me, dt, api) {
    switch (fx.k) {
      case 'orbs':
        for (let i = 0; i < fx.b.length; i++) {
          const b = fx.b[i];
          if (fx.hm & (1 << i) || fx.age < b[4] + b[5]) continue;
          fx.hm |= 1 << i;
          api.circle(b[2], b[3], 118, 1100, 50);
          if (i === 0) api.world(b[2], b[3], 90, 650, 'crater');
          api.shake(3);
        }
        break;
      case 'staff':
        if (fx.age < .5) { fx.x = r0(me.x); fx.y = r0(me.y); fx.l = r0(me.spLift || 0); }
        if (fx.age >= .2 && !(fx.h & 1)) {
          fx.h |= 1;
          api.cone(fx.x, fx.y, fx.a, 330, 1.95, 1700, 140);
          api.clearShots(fx.x, fx.y, 320);
          api.shake(6);
        }
        if (fx.age >= .5 && !(fx.h & 2)) {
          fx.h |= 2;
          const ex = fx.x + Math.cos(fx.a) * 580, ey = fx.y + Math.sin(fx.a) * 580;
          api.line(fx.x, fx.y, ex, ey, 46, 1500, 120, 'shockwave');
          api.world(ex, ey, 80, 700, 'shockwave');
          api.shake(7);
        }
        break;
      case 'rods':
        while (fx.ln < fx.n && fx.age >= rodPos(fx, fx.ln, TMP).t + .13) {
          api.circle(TMP.x, TMP.y, 50, 650, 0);
          if (fx.ln % 6 === 0) api.shake(3);
          fx.ln++;
        }
        if (fx.age >= .95 && !fx.e) {
          fx.e = 1;
          api.circle(fx.x, fx.y, fx.R + 40, 1000, 90);
          api.world(fx.x, fx.y, fx.R * .6, 900, 'crater');
          api.shake(8);
        }
        break;
      case 'limbo':
        while (fx.sk < LIMBO_HITS.length && fx.age >= LIMBO_HITS[fx.sk]) {
          for (const t of fx.tg) {
            if (t[0]) {
              let z = null;
              for (const e of api.enemies) if (e.id === t[0]) { z = e; break; }
              if (z && z.health > 0) { t[1] = r0(z.x); t[2] = r0(z.y); } else t[3] = 0;
            }
            if (t[3]) api.circle(t[1], t[2], 26, 750, 36);
          }
          fx.sk++;
          api.shake(3);
        }
        break;
      case 'rasen': {
        if (fx.age < RASEN.hold) { fx.x = fx.sx = r0(me.x); fx.y = fx.sy = r0(me.y); fx.l = r0(me.spLift || 0); break; }
        if (!(fx.h & 4)) { fx.h |= 4; me.castPose = .25; me.castFrame = 'attack'; }
        const k = rasenPos(fx, TMP);
        if (k < 1) {
          fx.nt -= dt;
          if (fx.nt <= 0) { fx.nt = .08; api.circle(TMP.x, TMP.y, 60, 350, 30); }
          break;
        }
        const t = fx.age - RASEN.hold - fx.fl;
        if (!(fx.h & 1)) { fx.h |= 1; api.world(fx.tx, fx.ty, 180, 1000, 'vortex'); api.shake(9); }
        while (fx.tk < RASEN.ticks && t >= fx.tk * RASEN.tick) { api.circle(fx.tx, fx.ty, RASEN.R, 400, -16); fx.tk++; }
        if (t >= RASEN.burst && !(fx.h & 2)) { fx.h |= 2; api.circle(fx.tx, fx.ty, RASEN.R + 20, 1500, 140); api.shake(8); }
        break;
      }
      case 'wave':
        if (fx.age < .6) api.clearShots(fx.x, fx.y, fx.R * easeOut(fx.age / .5));
        if (fx.age >= .1 && !fx.h) {
          fx.h = 1;
          api.circle(fx.x, fx.y, fx.R, 1500, 220, .35);
          api.world(fx.x, fx.y, 120, 800, 'shockwave');
          api.shake(8);
        }
        break;
      case 'tengai':
        for (let j = 0; j < fx.m.length; j++) {
          if (fx.h & (1 << j) || tengaiMeteor(fx, j, TMP).t < TENGAI.fall) continue;
          fx.h |= 1 << j;
          api.circle(TMP.x, TMP.y, TENGAI.r, TENGAI.dmg, 160, .35);
          api.world(TMP.x, TMP.y, 230, 2400, 'crater');
          api.shake(16);
        }
        break;
      case 'awaken':
        if (fx.age >= .08 && !fx.h) {
          fx.h = 1;
          api.circle(fx.x, fx.y, 280, 1200, 200);
          api.clearShots(fx.x, fx.y, 320);
          api.world(fx.x, fx.y, 150, 800, 'shockwave');
          api.shake(10);
        }
        break;
    }
  }

  let absorbGap = 0;
  function update(st, me, dt, api) {
    if (!st || !me) return;
    ensure(st);
    const L = st.effects;
    for (let i = L.length - 1; i >= 0; i--) {
      const fx = L[i];
      if (!fx || !Number.isFinite(fx.age)) { L.splice(i, 1); continue; }
      fx.age += dt;
      try { updateFx(st, fx, me, dt, api); } catch (err) { console.warn('SixPaths', fx.k, err); fx.age = fx.dur; }
      if (fx.age >= fx.dur) L.splice(i, 1);
    }
    if (st.lbl) { st.lbl.a = r2(st.lbl.a + dt); if (st.lbl.a > 1.6) st.lbl = null; }
    st.hide = Math.max(0, st.hide - dt * 6.5);
    if (!me.sixPaths || me.down > 0) { me.spLift = 0; return; }
    // Hover with a slow bob, easing up after the awakening.
    const target = 20 + Math.sin(api.time * 1.9) * 3.2;
    me.spLift = lerp(me.spLift || 0, target, Math.min(1, dt * 4));
    // Passive: the balls in the ring swallow enemy shots that come close.
    absorbGap -= dt;
    const n = api.clearShots(me.x, me.y, ABSORB_R);
    if (n && absorbGap <= 0) {
      absorbGap = .12;
      const a = Math.random() * TAU;
      add(st, { k: 'abs', x: r0(me.x + Math.cos(a) * 34), y: r0(me.y), h: r0(46 + Math.sin(a) * 30 + me.spLift), dur: .4 });
    }
  }

  // ------------------------------------------------------------------ meteors (Tengai Shinsei)
  function meteorGround(ctx, x, y, r, t, seed, time) {
    const K = Kit();
    if (t < TENGAI.fall) {
      const k = c01(t / TENGAI.fall), pulse = .55 + Math.sin(time * (10 + k * 18)) * .2;
      ctx.fillStyle = `rgba(18,8,6,${.12 + .5 * easeIn(k)})`;
      ctx.beginPath(); ctx.ellipse(x, y, r * (.3 + .7 * easeIn(k)), r * (.3 + .7 * easeIn(k)) * .55, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff6a26'; ctx.lineWidth = 4; ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .55, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.globalAlpha = pulse * .7;
      ctx.beginPath(); ctx.ellipse(x, y, r * k, r * k * .55, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      if (k > .7) {
        const dust = K.puff('dust'), e = win(k, .7, 1);
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8 + hash(i + seed), d = r * (.6 + e * .5);
          K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .55, r * .12, e * .5);
        }
      }
      return;
    }
    const tt = t - TENGAI.fall, fade = 1 - win(tt, TENGAI.life - 1.1, TENGAI.life);
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#6e5a46';
    ctx.beginPath(); ctx.ellipse(x, y, r * .86, r * .48, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c211b';
    ctx.beginPath(); ctx.ellipse(x, y + 4, r * .7, r * .36, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9c8466';
    ctx.beginPath(); ctx.ellipse(x, y - r * .34, r * .55, r * .1, 0, Math.PI, TAU); ctx.fill();
    const hot = 1 - win(tt, .3, 2.6);
    ctx.strokeStyle = `rgba(255,${110 + 80 * hot | 0},40,${hot})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = hash(i * 4.7 + seed) * TAU;
      let px = x + Math.cos(a) * r * .15, py = y + Math.sin(a) * r * .08;
      ctx.moveTo(px, py);
      for (let s = 1; s <= 3; s++) { const aa = a + (hash(i * 9 + s) - .5) * .8, d = r * (.15 + s * .26); px = x + Math.cos(aa) * d; py = y + 4 + Math.sin(aa) * d * .5; ctx.lineTo(px, py); }
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * .8, '255,110,30', .6 * hot * fade, false, .55);
    ctx.globalCompositeOperation = 'source-over';
    const R = r * .5;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - R * 1.2, y - R * 2.2, R * 2.4, R * 2.2 + 6); ctx.clip();
    ctx.drawImage(rockSprite(), x - R, y - R * 1.25, R * 2, R * 2);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x - R * .3, y - R * .2, R * .7, '255,120,40', .5 * hot * fade);
    ctx.globalCompositeOperation = 'source-over';
    const fire = (1 - win(tt, 1.2, 2.8)) * win(tt, .4, .8);
    if (fire > .02) {
      for (let i = 0; i < 8; i++) {
        if (hash(i * 5.3 + seed) < .3) continue;
        const a = hash(i * 1.7 + seed) * TAU, d = r * (.45 + hash(i * 3.1 + seed) * .4);
        const h = r * (.12 + hash(i * 2 + seed) * .2) * fire * (.85 + .15 * Math.sin(time * 11 + i));
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .5;
        ctx.drawImage(K.flame((i + Math.floor(time * 10)) % 6), px - h * .22, py - h * (114 / 128), h * .44, h);
      }
    }
    if (tt < 1.2) K.fx.debris(ctx, x, y, r * 1.3, tt / 1.2, seed, '#3a2a22', 14);
    ctx.globalAlpha = 1;
  }

  function meteorSky(ctx, x, y, r, t, seed, time) {
    const K = Kit();
    if (t < 0) return;
    if (t < TENGAI.fall) {
      const k = t / TENGAI.fall, e = Math.pow(k, 1.25), far = 820 * (1 - e);
      const R = r * (.48 + .2 * k), mx = x + METEOR_DIR.x * far, my = y - R * .5 + METEOR_DIR.y * far;
      const trail = Math.atan2(METEOR_DIR.y, METEOR_DIR.x);
      const smoke = K.puff('smoke');
      for (let i = 5; i >= 1; i--) {
        const d = R * (.6 + i * .6);
        K.stamp(ctx, smoke, mx + Math.cos(trail) * d + Math.sin(time * 3 + i) * 6, my + Math.sin(trail) * d, R * (.45 + i * .1), .6 - i * .07);
      }
      const m = ctx.getTransform();
      ctx.translate(mx, my); ctx.rotate(trail + Math.PI / 2);
      ctx.fillStyle = 'rgba(255,120,40,.35)';
      ctx.beginPath(); ctx.moveTo(-R * .95, 0); ctx.lineTo(-R * .35, -R * 4.2); ctx.lineTo(R * .35, -R * 4.2); ctx.lineTo(R * .95, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,210,120,.35)';
      ctx.beginPath(); ctx.moveTo(-R * .55, 0); ctx.lineTo(0, -R * 3.2); ctx.lineTo(R * .55, 0); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 7; i++) {
        const ox = (i - 3) * R * .27, h = R * (1.25 + hash(i) * .5 - Math.abs(i - 3) * .12) * (.9 + .1 * Math.sin(time * 14 + i));
        ctx.drawImage(K.flame((i + Math.floor(time * 12)) % 6), ox - h * .25, -h * (114 / 128) + R * (.75 - Math.abs(i - 3) * .12), h * .5, h);
      }
      ctx.setTransform(m);
      ctx.drawImage(rockSprite(), mx - R, my - R, R * 2, R * 2);
      ctx.save();
      ctx.beginPath(); ctx.arc(mx, my, R * .92, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(230,70,20,.75)';
      ctx.beginPath(); ctx.arc(mx - METEOR_DIR.x * R * 1.05, my - METEOR_DIR.y * R * 1.05, R * .95, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,90,.85)';
      ctx.beginPath(); ctx.arc(mx - METEOR_DIR.x * R * 1.45, my - METEOR_DIR.y * R * 1.45, R * .95, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, mx - METEOR_DIR.x * R * .7, my - METEOR_DIR.y * R * .7, R * 1.1, '255,120,30', .8, true);
      K.glow(ctx, mx, my, R * 1.9, '255,90,20', .3);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const tt = t - TENGAI.fall;
    ctx.globalCompositeOperation = 'lighter';
    if (tt < .4) K.glow(ctx, x, y - r * .3, r * (1.6 + tt * 3), '255,200,140', 1 - tt / .4, true);
    ctx.globalCompositeOperation = 'source-over';
    if (tt < 1.4) K.fx.fireBlast(ctx, x, y, r * .95, tt / 1.4, 1, time, seed);
    if (tt < .9) {
      K.fx.shockRing(ctx, x, y, r * 1.7, tt / .9, 1 - tt / .9, '255,170,90');
      if (tt > .1) K.fx.shockRing(ctx, x, y, r * 2.2, (tt - .1) / .8, (1 - tt / .9) * .7, '255,230,200');
    }
    const dust = K.puff('dust'), smoke = K.puff('smoke');
    if (tt < 2.4) {
      const e = easeOut(tt / 1.4), a0 = 1 - win(tt, 1, 2.4);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12 + hash(i + seed) * .4, d = r * (.45 + e * (.6 + hash(i * 2.3 + seed) * .35));
        K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - 8 - hash(i * 4.4) * r * .15, r * (.09 + e * (.07 + hash(i * 6.1) * .08)), a0 * .7, .75);
      }
    }
    if (tt > .6 && tt < 3) {
      const s = win(tt, .6, 3);
      for (let i = 0; i < 4; i++) {
        const ox = (hash(i * 3.7 + seed) - .5) * r * .5;
        K.stamp(ctx, smoke, x + ox + s * 20, y - r * .4 - s * r * 1.1 - i * r * .18, r * (.22 + s * .2), bell(s) * .5);
      }
    }
  }

  // ------------------------------------------------------------------ per-effect drawing
  function burstGround(ctx, x, y, k, seed) {
    const a = (1 - win(k, .5, 1)) * .55, r = 70 * (.5 + easeOut(k * 3) * .5);
    ctx.fillStyle = `rgba(14,8,16,${a})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(10,6,12,${a * 1.4})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const an = hash(i * 2.7 + seed) * TAU, d = r * (1.1 + hash(i + seed) * .5);
      ctx.moveTo(x + Math.cos(an) * r * .3, y + Math.sin(an) * r * .15);
      ctx.lineTo(x + Math.cos(an + .2) * d, y + Math.sin(an + .2) * d * .5);
    }
    ctx.stroke();
  }
  function burstOverlay(ctx, x, y, k, seed, time) {
    const K = Kit(), cy = y - 18;
    const sr = 62 * (k < .22 ? easeOut(k / .22) : 1 - easeIn((k - .22) / .78) * .85);
    ctx.globalAlpha = 1 - win(k, .55, 1);
    if (sr > 1) drawBall(ctx, x, cy, sr);
    ctx.globalAlpha = 1;
    K.fx.shockRing(ctx, x, y, 160, k, 1 - k, '255,190,80');
    ctx.globalCompositeOperation = 'lighter';
    if (k < .25) K.glow(ctx, x, cy, 90 * (1 + k * 2), '255,220,150', (1 - k / .25) * .8, true);
    K.glow(ctx, x, cy, sr * 1.7 + 10, '255,160,50', (1 - k) * .45);
    ctx.globalCompositeOperation = 'source-over';
    K.fx.debris(ctx, x, y, 120, k, seed, '#1a1418', 7);
  }

  function orbsGround(ctx, fx) {
    for (let i = 0; i < fx.b.length; i++) {
      const b = fx.b[i], t = fx.age - b[4];
      if (t < 0) continue;
      if (t < b[5]) {
        const k = t / b[5], x = lerp(fx.x + b[0], b[2], k), y = lerp(fx.y, b[3], k);
        ctx.fillStyle = 'rgba(10,6,12,.25)';
        ctx.beginPath(); ctx.ellipse(x, y, 9, 4, 0, 0, TAU); ctx.fill();
      } else if (t < b[5] + .6) burstGround(ctx, b[2], b[3], (t - b[5]) / .6, fx.seed + i);
    }
  }
  function orbsOverlay(ctx, fx, time) {
    const K = Kit();
    for (let i = 0; i < fx.b.length; i++) {
      const b = fx.b[i], t = fx.age - b[4];
      if (t < 0) continue;
      if (t < b[5]) {
        const k = t / b[5];
        const pt = kk => {
          const x = lerp(fx.x + b[0], b[2], kk), y = lerp(fx.y, b[3], kk), h = lerp(b[1], 16, kk) + Math.sin(Math.PI * kk) * 60;
          return [x, y - h];
        };
        const [x, y] = pt(k), [qx, qy] = pt(Math.max(0, k - .22));
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(12,8,16,.55)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,190,90,.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(x, y); ctx.stroke();
        K.glow(ctx, x, y, 22, '255,170,60', .5);
        ctx.globalCompositeOperation = 'source-over';
        drawBall(ctx, x, y, 8 + k * 4);
      } else if (t < b[5] + .6) burstOverlay(ctx, b[2], b[3], (t - b[5]) / .6, fx.seed + i, time);
    }
  }

  function staffOverlay(ctx, fx, time) {
    const K = Kit(), f = Math.cos(fx.a) >= 0 ? 1 : -1;
    const cy = fx.y + 3 - fx.l - 26, hx = fx.x + f * 14;
    ctx.save();
    if (fx.age < .2) {
      // the ball in his palm stretches into the staff
      const k = fx.age / .2;
      if (k < .4) drawBall(ctx, hx, cy - 8, 6 + k * 4);
      else drawStaff(ctx, hx, cy + 20, -Math.PI / 2 - f * .25, 20 + 50 * win(k, .4, 1), 1);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx, cy - 6, 30, '255,190,80', .5 * k, true);
    }
    // the sweep: a 220° arc of black-and-gold shock round him
    const sw = fx.age - .2;
    if (sw >= 0 && sw < .5) {
      const p = easeOut(sw / .22), fade = 1 - win(sw, .25, .5);
      const th0 = fx.a - fx.s * 1.95, th = th0 + fx.s * 3.9 * p;
      const lo = fx.s > 0 ? Math.max(th0, th - 2.6) : th, hi = fx.s > 0 ? th : Math.min(th0, th + 2.6);
      const ecy = cy + 6;
      if (hi - lo > .02) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(16,10,22,.55)';
        ctx.beginPath(); ctx.ellipse(fx.x, ecy, 330, 165, 0, lo, hi); ctx.ellipse(fx.x, ecy, 60, 30, 0, hi, lo, true); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,170,60,.28)';
        ctx.beginPath(); ctx.ellipse(fx.x, ecy, 330, 165, 0, lo, hi); ctx.ellipse(fx.x, ecy, 200, 100, 0, hi, lo, true); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,236,190,.95)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(fx.x, ecy, 326, 163, 0, lo, hi); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,200,110,.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(fx.x, ecy, 270, 135, 0, lo, hi); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      if (sw < .3) {
        const ex = Math.cos(th) * 170, ey = Math.sin(th) * 85;
        drawStaff(ctx, fx.x, ecy, Math.atan2(ey, ex), Math.hypot(ex, ey), 1);
      }
    }
    // the thrust: the staff shoots out ~580 px along the aim with a shock line
    const th = fx.age - .44;
    if (th >= 0) {
      const k = easeOut(th / .12), fade = 1 - win(th, .25, .56), L = 40 + 540 * k;
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
      const ex = hx + ca * L, ey = cy + sa * L;
      ctx.globalAlpha = fade; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(14,8,18,.5)'; ctx.lineWidth = 34 * (1 - th * .8);
      ctx.beginPath(); ctx.moveTo(hx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,170,60,.55)'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(hx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,248,220,.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      K.glow(ctx, ex, ey, 70, '255,200,110', .7 * fade, true);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (th < .4) drawStaff(ctx, hx - ca * 30, cy - sa * 30, fx.a, Math.max(40, L - 10), 1 - win(th, .25, .4));
      if (th > .05) K.fx.shockRing(ctx, fx.x + Math.cos(fx.a) * 580, fx.y + Math.sin(fx.a) * 580, 190, (th - .05) / .5, (1 - win(th, .05, .55)), '255,190,90');
    }
    ctx.restore();
  }

  function rodsGround(ctx, fx, time) {
    const K = Kit(), x = fx.x, y = fx.y, R = fx.R;
    ctx.save();
    const tel = (1 - win(fx.age, .9, 1.05)) * win(fx.age, 0, .12);
    if (tel > .01) {
      ctx.globalAlpha = tel;
      ctx.fillStyle = 'rgba(16,8,20,.2)';
      ctx.beginPath(); ctx.ellipse(x, y, R, R * .62, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(30,14,20,.7)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * .62, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,196,90,.9)'; ctx.lineWidth = 2; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -time * 60;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * .62, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < fx.n; i++) {
      rodPos(fx, i, TMP);
      const t = fx.age - TMP.t;
      if (t > -.2 && t < .13) {
        // target mark where the rod will land
        const k = win(t, -.2, .13);
        ctx.strokeStyle = `rgba(255,190,80,${.5 + k * .4})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(TMP.x, TMP.y, 16 - k * 8, (16 - k * 8) * .5, 0, 0, TAU); ctx.stroke();
      } else if (t >= .13) {
        const fade = 1 - win(fx.age, 1.3, 1.7);
        ctx.fillStyle = `rgba(12,6,10,${.45 * fade})`;
        ctx.beginPath(); ctx.ellipse(TMP.x, TMP.y, 12, 5, 0, 0, TAU); ctx.fill();
      }
    }
    if (fx.age > .95) {
      const k = (fx.age - .95) / .55;
      if (k < 1) {
        K.fx.shockRing(ctx, x, y, R * 1.5, k, 1 - k, '255,180,80');
        ctx.fillStyle = `rgba(12,6,14,${.35 * (1 - k)})`;
        ctx.beginPath(); ctx.ellipse(x, y, R * (.6 + k * .5), R * (.6 + k * .5) * .55, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  function rodsOverlay(ctx, fx, time) {
    const K = Kit(), f = fx.f;
    const fade = 1 - win(fx.age, 1.3, 1.7), erupt = win(fx.age, .95, 1.05);
    ctx.save();
    // fall direction (screen): from up and behind the caster's side, steep
    const ux = f * .32, uy = .95, ul = Math.hypot(ux, uy), dx = ux / ul, dy = uy / ul, ang = Math.atan2(dy, dx);
    for (let i = 0; i < fx.n; i++) {
      rodPos(fx, i, TMP);
      const t = fx.age - TMP.t;
      if (t < 0) continue;
      if (t < .13) {
        const k = t / .13, d = 320 * (1 - k);
        const cx = TMP.x - dx * (d + 25), cy = TMP.y - dy * (d + 25);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,190,90,.4)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx - dx * 80, cy - dy * 80); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        drawRod(ctx, cx, cy, ang, 54, 6);
      } else if (fade > .02) {
        ctx.globalAlpha = fade;
        const sink = erupt * 10;
        drawRod(ctx, TMP.x - dx * (16 - sink), TMP.y - dy * (16 - sink), ang, 54, 6);
        ctx.globalAlpha = 1;
        if (t < .35) {
          const k = (t - .13) / .22;
          ctx.strokeStyle = `rgba(255,214,140,${1 - k})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(TMP.x, TMP.y, 10 + k * 26, (10 + k * 26) * .5, 0, 0, TAU); ctx.stroke();
          K.stamp(ctx, K.puff('dust'), TMP.x, TMP.y - 4, 10 + k * 10, (1 - k) * .6, .6);
        }
      }
    }
    if (fx.age > .95 && fx.age < 1.4) {
      // the rods detonate together: a black dome swells over the field and pops
      const k = (fx.age - .95) / .45;
      ctx.globalAlpha = 1 - win(k, .55, 1);
      drawBall(ctx, fx.x, fx.y - 30, fx.R * .55 * easeOut(k * 2) * (1 - k * .6));
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - 30, fx.R * (.7 + k), '255,180,70', (1 - k) * .55);
      if (k < .2) K.glow(ctx, fx.x, fx.y - 30, fx.R * .8, '255,235,190', (1 - k / .2) * .8, true);
      ctx.globalCompositeOperation = 'source-over';
      K.fx.debris(ctx, fx.x, fx.y, fx.R * 1.1, k, fx.seed, '#1a1418', 12);
    }
    ctx.restore();
  }

  function limboGround(ctx, fx, time) {
    const x = fx.x, y = fx.y, R = fx.R, a = win(fx.age, 0, .15) * (1 - win(fx.age, .9, 1.15));
    ctx.save();
    ctx.fillStyle = `rgba(20,8,28,${.2 * a})`;
    ctx.beginPath(); ctx.ellipse(x, y, R, R * .55, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(60,24,90,${.55 * a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, R, R * .55, 0, 0, TAU); ctx.stroke();
    for (let j = 0; j < 3; j++) {
      const r = ((time * .9 + j / 3) % 1) * R;
      ctx.strokeStyle = `rgba(200,170,255,${.35 * a * (1 - r / R)})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .55, 0, 0, TAU); ctx.stroke();
    }
    for (const t of fx.tg) {
      ctx.fillStyle = `rgba(20,8,30,${.3 * a})`;
      ctx.beginPath(); ctx.ellipse(t[1], t[2] + 3, 26, 9, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function limboOverlay(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    ctx.save();
    if (fx.age < LIMBO_HITS[0]) {
      // the invisible shadows flicker in beside each target
      const a = win(fx.age, 0, LIMBO_HITS[0]);
      for (let j = 0; j < fx.tg.length; j++) {
        const t = fx.tg[j], side = j % 2 ? 1 : -1;
        drawSilhouette(ctx, t[1] + side * 34, t[2] + 3, -side, (.08 + .1 * Math.sin(time * 19 + j * 2)) * a);
      }
    }
    for (let s = 0; s < LIMBO_HITS.length; s++) {
      const ts = fx.age - LIMBO_HITS[s];
      if (ts < -.05 || ts > .28) continue;
      const k = c01(ts / .28);
      for (let j = 0; j < fx.tg.length; j++) {
        const t = fx.tg[j];
        if (!t[3] && t[0]) continue;
        const side = (j + s) % 2 ? 1 : -1, x = t[1], fy = t[2] + 3;
        drawSilhouette(ctx, x + side * (30 - easeOut(c01((ts + .05) / .1)) * 12), fy, -side, bell(c01((ts + .05) / .33)) * .9);
        if (ts < 0) continue;
        K.fx.shockRing(ctx, x, fy, 90, k * 1.3, 1 - k, '210,180,255');
        ctx.lineCap = 'round';
        const cy = fy - L - 6, r = 12 + 22 * easeOut(k * 3);
        ctx.strokeStyle = `rgba(10,4,18,${1 - k})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x - r, cy - r * .6); ctx.lineTo(x + r, cy + r * .6); ctx.moveTo(x + r * side, cy - r * .6 * side); ctx.lineTo(x - r * side, cy + r * .6 * side); ctx.stroke();
        ctx.strokeStyle = `rgba(255,224,160,${1 - k})`; ctx.lineWidth = 1.8; ctx.stroke();
        if (k < .3) {
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, x, cy, 36, '220,180,255', (1 - k / .3) * .8, true);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    ctx.restore();
  }

  const RS_PROJ = { x: 0, y: 0, r: 34, life: 1, maxLife: 1, angle: 0 };
  const RS_STATE = { elapsed: 0, rasenShurikens: [RS_PROJ] };
  function orbit(ctx, x, y, rx, ry, n, r, time, speed) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + time * speed;
      drawBall(ctx, x + Math.cos(a) * rx, y + Math.sin(a) * ry, r);
    }
  }
  function rasenOverlay(ctx, fx, time) {
    const K = Kit();
    ctx.save();
    if (fx.age < RASEN.hold) {
      // raised overhead: the blades unfurl round a Rasengan while four black balls lock into orbit
      const k = easeOut(fx.age / RASEN.hold), x = fx.x, y = fx.y + 3 - fx.l - 98, rr = 16 + 24 * k;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y, rr * 3, '255,190,70', .5);
      K.glow(ctx, x, y, rr * 2.2, '90,170,255', .4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .8);
      K.spin(ctx, bladeSprite(), 0, 0, rr * 1.9 * k, time * 17, .95);
      K.fx.rasenganOrb(ctx, rr * .5, time);
      ctx.restore();
      orbit(ctx, x, y, rr * 1.9, rr * 1.1, 4, 5, time, 4);
      ctx.restore();
      return;
    }
    const k = rasenPos(fx, TMP);
    if (k < 1 && window.NinjaVFX) {
      const t = fx.age - RASEN.hold;
      RS_PROJ.x = TMP.x; RS_PROJ.y = TMP.y; RS_PROJ.maxLife = 1.4 + t; RS_PROJ.angle = Math.atan2(fx.ty - fx.sy, fx.tx - fx.sx);
      RS_STATE.elapsed = time;
      window.NinjaVFX.draw(ctx, RS_STATE);
      const cy = TMP.y - LIFT() - 10;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, TMP.x, cy, 80, '255,180,60', .2);
      ctx.globalCompositeOperation = 'source-over';
      orbit(ctx, TMP.x, cy, 54, 30, 4, 6, time, 5);
    }
    const t = fx.age - RASEN.hold - fx.fl;
    if (t >= 0 && t < RASEN.life) {
      const R = RASEN.R, age = t / RASEN.life, alpha = 1 - win(t, RASEN.life - .3, RASEN.life);
      K.fx.windDome(ctx, fx.tx, fx.ty, R, age, alpha, time, true);
      // Six Paths: a golden shell and nine black balls racing round the dome's rim
      const dr = R * (.3 + easeOut(age * 1.6) * .75) * (age > .55 ? 1 - easeIn((age - .55) / .45) * .6 : 1), cy = fx.ty - dr * .3;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(60,24,0,.5)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(fx.tx, cy, dr * 1.04, dr * .86, 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,200,90,.85)'; ctx.lineWidth = 2.5; ctx.stroke();
      K.glow(ctx, fx.tx, cy, dr * 1.2, '255,170,50', .2 * alpha, false, .82);
      ctx.globalCompositeOperation = 'source-over';
      orbit(ctx, fx.tx, cy, dr * 1.04, dr * .86, 9, 7, time, 2.4);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function rasenGround(ctx, fx) {
    const t = fx.age - RASEN.hold - fx.fl;
    if (t < 0 || t > RASEN.life) return;
    const a = (1 - win(t, RASEN.life - .4, RASEN.life)) * .4, R = RASEN.R * (.5 + easeOut(t * 3) * .5);
    ctx.fillStyle = `rgba(30,16,4,${a})`;
    ctx.beginPath(); ctx.ellipse(fx.tx, fx.ty, R, R * .45, 0, 0, TAU); ctx.fill();
  }

  function waveGround(ctx, fx, time) {
    const K = Kit(), k = c01(fx.age / .5), rr = fx.R * easeOut(k), fade = 1 - win(fx.age, .45, 1);
    if (rr < 4 || fade <= 0) return;
    const band = 34 * (1 - k * .55) + 6;
    ctx.save();
    ctx.translate(fx.x, fx.y); ctx.scale(1, .5);
    ctx.fillStyle = `rgba(16,10,20,${.16 * fade})`;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(8,6,12,${.85 * fade})`; ctx.lineWidth = band;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    // black tendrils flung off the front of the wave
    ctx.fillStyle = `rgba(8,6,12,${.85 * fade})`;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * TAU + hash(i + fx.x) * .2, l = band * (.7 + hash(i * 3.3) * 1.1), w = .05;
      ctx.moveTo(Math.cos(a - w) * (rr + band * .4), Math.sin(a - w) * (rr + band * .4));
      ctx.lineTo(Math.cos(a) * (rr + band * .4 + l), Math.sin(a) * (rr + band * .4 + l));
      ctx.lineTo(Math.cos(a + w) * (rr + band * .4), Math.sin(a + w) * (rr + band * .4));
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,190,80,${.8 * fade})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, rr + band * .5, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,190,${.6 * fade})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(1, rr - band * .5), 0, TAU); ctx.stroke();
    ctx.restore();
    const dust = K.puff('dust');
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + hash(i * 2.1) * .3;
      K.stamp(ctx, dust, fx.x + Math.cos(a) * rr * 1.04, fx.y + Math.sin(a) * rr * .52 - 6, 14 + k * 16, fade * .45 * k);
    }
  }
  function waveOverlay(ctx, fx, time) {
    if (fx.age > .22) return;
    const K = Kit(), k = fx.age / .22, cy = fx.y + 3 - fx.l - 30;
    ctx.save();
    ctx.globalAlpha = 1 - win(k, .6, 1);
    drawBall(ctx, fx.x, cy, 8 + 38 * easeOut(k));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, cy, 60 + 120 * k, '255,200,100', (1 - k) * .7, true);
    ctx.restore();
  }

  function tengaiGround(ctx, fx, time) {
    const K = Kit(), sealA = win(fx.age, 0, .2) * (1 - win(fx.age, TENGAI.wind + TENGAI.delays[2] + TENGAI.fall, TENGAI.wind + TENGAI.delays[2] + TENGAI.fall + .5));
    ctx.save();
    if (sealA > .01) {
      const s = 300 * (.6 + .4 * easeOut(fx.age / .4));
      ctx.save();
      ctx.translate(fx.x, fx.y); ctx.scale(1, .55); ctx.rotate(time * .35);
      ctx.globalAlpha = sealA * .9;
      ctx.drawImage(sealSprite(), -s, -s, s * 2, s * 2);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y, 320, '255,170,60', .25 * sealA, false, .55);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let j = 0; j < fx.m.length; j++) {
      tengaiMeteor(fx, j, TMP);
      if (TMP.t < -.25) continue;
      meteorGround(ctx, TMP.x, TMP.y, TENGAI.r, Math.max(0, TMP.t), fx.m[j][3], time);
    }
    ctx.restore();
  }
  function tengaiOverlay(ctx, fx, time) {
    const K = Kit();
    ctx.save();
    if (fx.age < TENGAI.wind + .3) {
      // Naruto's raised hand calls the sky: a golden pillar and a burst high above him
      const k = fx.age / (TENGAI.wind + .3), a = bell(k), x = fx.px, y = fx.py + 3 - fx.l - 70;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) K.glow(ctx, x, y - i * 45, 40 - i * 3, '255,200,90', a * .45, i === 0);
      K.glow(ctx, x, y - 260, 120 * (.5 + k), '255,170,60', a * .5);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let j = 0; j < fx.m.length; j++) {
      tengaiMeteor(fx, j, TMP);
      meteorSky(ctx, TMP.x, TMP.y, TENGAI.r, TMP.t, fx.m[j][3], time);
    }
    ctx.restore();
  }

  function ringPos(x, feetY, i, time, out) {
    const a = i / 9 * TAU + time * .6;
    out.x = x + Math.cos(a) * 36;
    out.y = feetY - 48 + Math.sin(a) * 31 + Math.sin(time * 2.3 + i) * 1.5;
    return out;
  }
  function awakenGround(ctx, fx, time) {
    const K = Kit(), k = c01(fx.age / fx.dur);
    ctx.save();
    const s = 60 + 220 * easeOut(k * 1.6), a = bell(c01(k * 1.2));
    ctx.translate(fx.x, fx.y); ctx.scale(1, .5); ctx.rotate(-time * .5);
    ctx.globalAlpha = a * .9;
    ctx.drawImage(sealSprite(), -s, -s, s * 2, s * 2);
    ctx.restore();
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const kk = c01(k * 1.5 - i * .15);
      if (kk > 0 && kk < 1) K.fx.shockRing(ctx, fx.x, fx.y, 340, kk, 1 - kk, '255,190,80');
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, 200, '255,170,50', .5 * (1 - k), false, .5);
    ctx.globalCompositeOperation = 'source-over';
    const dust = K.puff('dust');
    for (let i = 0; i < 10; i++) {
      const an = i / 10 * TAU, d = 60 + 220 * easeOut(k * 1.4);
      K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - 6, 16 + k * 14, (1 - k) * .5);
    }
    ctx.restore();
  }
  function awakenOverlay(ctx, fx, time, p, hide) {
    const K = Kit(), k = c01(fx.age / fx.dur), feetY = (p ? p.y : fx.y) + 3 - (p ? p.spLift || 0 : 0), x = p ? p.x : fx.x;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (k < .18) K.glow(ctx, x, feetY - 40, 120 + k * 600, '255,235,180', (1 - k / .18), true);
    const col = bell(c01(k * 1.6));
    for (let i = 0; i < 6; i++) K.glow(ctx, x, feetY - 30 - i * 55, 52 - i * 4, '255,196,80', col * .5, i < 2);
    // golden sparks blasting upward
    ctx.fillStyle = '#ffe38a';
    for (let i = 0; i < 18; i++) {
      const ph = c01(k * 1.4 - hash(i) * .3), a = hash(i * 3.3) * TAU;
      if (ph <= 0 || ph >= 1) continue;
      const d = 20 + ph * 160, px = x + Math.cos(a) * d, py = feetY - 30 + Math.sin(a) * d * .5 - ph * 120;
      ctx.globalAlpha = 1 - ph; ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // the nine balls spiral in from the burst and lock into the ring
    const pos = { x: 0, y: 0 }, hid = Math.ceil(hide - .05);
    for (let i = 0; i < hid && i < 9; i++) {
      ringPos(x, feetY, i, time, pos);
      const e = easeOut(c01(k * 1.25 - i * .03)), sp = (1 - e) * 2.4, d = (1 - e) * 170;
      const a = i / 9 * TAU + sp;
      drawBall(ctx, lerp(pos.x, x + Math.cos(a) * d, 1 - e) , lerp(pos.y, feetY - 40 + Math.sin(a) * d * .55, 1 - e), 6.2 * (.5 + .5 * e));
    }
    ctx.restore();
  }
  function fadeOverlay(ctx, fx, time) {
    const K = Kit(), k = c01(fx.age / fx.dur), cy = fx.y - 40;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, cy, 60 + k * 60, '255,200,100', (1 - k) * .6);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU, d = 36 + k * 90;
      ctx.globalAlpha = 1 - k;
      drawBall(ctx, fx.x + Math.cos(a) * d, cy + Math.sin(a) * d * .7, 6 * (1 - k * .8));
    }
    ctx.restore();
  }
  function absOverlay(ctx, fx) {
    const K = Kit(), k = c01(fx.age / fx.dur), y = fx.y - fx.h;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, y, 26 * (1 - k * .5), '255,200,100', 1 - k, true);
    ctx.strokeStyle = `rgba(255,230,170,${1 - k})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(fx.x, y, 6 + k * 22, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    drawBall(ctx, fx.x, y, 7 + bell(k) * 4);
    ctx.restore();
  }

  function drawLabel(ctx, st, p) {
    const L = st.lbl;
    if (!L || !L.t || !(L.a < 1.6) || !p) return;
    const S = Spr(), h = S && S.height ? S.height(sid()) : 66;
    const y = p.y + 3 - (p.sixPaths ? p.spLift || 0 : 0) - Math.max(h + 34, 122);
    const a = Math.min(1, (1.6 - L.a) / .35) * Math.min(1, L.a / .08 + .3);
    ctx.save();
    ctx.globalAlpha = c01(a);
    ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3.2; ctx.strokeStyle = '#1a0c02'; ctx.lineJoin = 'round';
    ctx.strokeText(L.t, p.x, y - L.a * 4);
    ctx.fillStyle = '#ffd65a'; ctx.fillText(L.t, p.x, y - L.a * 4);
    ctx.restore();
  }

  // ------------------------------------------------------------------ aura
  let rimC = null, rimG = null;
  const RIM_W = 160, RIM_H = 170, RIM_AX = 80, RIM_AY = 156;
  function drawRim(ctx, p, feetY, facing, time) {
    const S = Spr();
    if (!S) return;
    if (!rimC) { rimC = document.createElement('canvas'); rimC.width = RIM_W; rimC.height = RIM_H; rimG = rimC.getContext('2d'); }
    const g = rimG, id = sid();
    const frame = p.castPose > 0 ? (p.castFrame || 'seal') : p.speed > 0 ? 'run' : 'idle';
    const opts = { facing, frame, phase: (p.stride || 0) / 15 };
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, RIM_W, RIM_H);
    const d = 2.6;
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; S.draw(g, id, RIM_AX + Math.cos(a) * d, RIM_AY + Math.sin(a) * d - (Math.sin(a) < 0 ? 1.2 : 0), opts); }
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffc23a'; g.fillRect(0, 0, RIM_W, RIM_H);
    g.globalCompositeOperation = 'source-over';
    const fl = .8 + .2 * Math.sin(time * 23) * Math.sin(time * 7.3);
    // soft upward bloom (chakra streaming off him), then the crisp golden outline
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .35 * fl;
    ctx.drawImage(rimC, p.x - RIM_AX * 1.1, feetY - RIM_AY * 1.06 - 3, RIM_W * 1.1, RIM_H * 1.06);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .95 * fl;
    ctx.drawImage(rimC, p.x - RIM_AX, feetY - RIM_AY);
    ctx.globalAlpha = 1;
  }

  const stOf = new WeakMap();
  const POS = { x: 0, y: 0 };
  function drawAura(ctx, p, feetY, facing, time, front) {
    const K = Kit();
    if (!K || !p) return;
    const st = stOf.get(p), hide = st && typeof st.hide === 'number' ? st.hide : 0;
    const x = p.x;
    ctx.save();
    if (!front) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, feetY - 32, 64, '255,170,40', .42);
      ctx.globalCompositeOperation = 'source-over';
      // golden chakra flames licking up behind the shoulders and head
      const m = ctx.getTransform();
      for (let i = 0; i < 5; i++) {
        const ox = [-12, 12, -6, 7, 0][i] * facing, oy = [-40, -40, -58, -56, -66][i];
        const h = (16 + hash(i * 3.1) * 10) * (.8 + .25 * Math.sin(time * 9 + i * 1.7));
        K.flameAt(ctx, m, K.flame((i + Math.floor(time * 12)) % 6, GOLD_FLAME, 'spg'), x + ox, feetY + oy + 6, h * .55, h, Math.sin(time * 3 + i) * .2 - facing * .15);
      }
      ctx.setTransform(m);
      // the halo of nine truth-seeking balls behind his back
      ctx.strokeStyle = 'rgba(255,200,100,.22)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(x, feetY - 48, 36, 31, 0, 0, TAU); ctx.stroke();
      const hid = Math.ceil(hide - .05);
      for (let i = 0; i < 9; i++) {
        if (i < hid) continue;
        ringPos(x, feetY, i, time, POS);
        drawBall(ctx, POS.x, POS.y, 6.2);
      }
      drawRim(ctx, p, feetY, facing, time);
      ctx.restore();
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, feetY - 30, 30, '255,214,120', .16);
    ctx.fillStyle = '#ffe38a';
    for (let i = 0; i < 7; i++) {
      const ph = (time * .8 + i / 7) % 1, px = x + Math.sin(i * 5.1 + time * 1.4) * (10 + ph * 8), py = feetY - 10 - ph * 64;
      ctx.globalAlpha = (1 - ph) * .9; ctx.fillRect(px - 1.2, py - 1.2, 2.4, 2.4);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ public
  const GROUND = { orbs: orbsGround, rods: rodsGround, limbo: limboGround, rasen: rasenGround, wave: waveGround, tengai: tengaiGround, awaken: awakenGround };
  const OVER = { orbs: orbsOverlay, staff: staffOverlay, rods: rodsOverlay, limbo: limboOverlay, rasen: rasenOverlay, wave: waveOverlay, tengai: tengaiOverlay, fade: fadeOverlay, abs: absOverlay };

  function fxCenter(fx) {
    if (fx.k === 'rasen') return [(fx.sx + fx.tx) / 2, (fx.sy + fx.ty) / 2];
    return [fx.x, fx.y];
  }

  window.SixPathsMode = {
    toggle(st, p, on, api) {
      if (!st || !p) return;
      ensure(st);
      if (on) {
        add(st, { k: 'awaken', x: r0(p.x), y: r0(p.y), h: 0, dur: 1.3 });
        st.hide = 9;
        label(st, 'awaken');
      } else {
        add(st, { k: 'fade', x: r0(p.x), y: r0(p.y - (p.spLift || 0)), dur: .6 });
        st.lbl = null;
      }
    },
    click(st, p, api) {
      if (!st || !p) return;
      ensure(st);
      const n = p.spCount || 0, kind = COMBO[n % COMBO.length];
      p.spCount = n + 1;
      CAST[kind](st, p, api);
      label(st, kind);
    },
    update,
    drawGround(ctx, st, p, time) {
      if (!st || !ctx || !Kit()) return;
      if (p) stOf.set(p, st);
      const L = st.effects, on = p && p.sixPaths;
      if (!on && !(L && L.length)) return;
      setView(ctx);
      if (on && !(p.down > 0)) {
        // chakra light pooled under the hovering Naruto
        const K = Kit();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, p.x, p.y + 3, 54, '255,180,60', .5, false, .4);
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(p.x, p.y + 3); ctx.scale(1, .42);
        for (let i = 0; i < 2; i++) {
          const t = (time * .5 + i / 2) % 1, r = 14 + t * 46;
          ctx.strokeStyle = `rgba(150,70,0,${(1 - t) * .4})`; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(255,220,130,${(1 - t) * .6})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
      if (!L) return;
      for (const fx of L) {
        const fn = fx && GROUND[fx.k];
        if (!fn || !Number.isFinite(fx.age)) continue;
        const [cx, cy] = fxCenter(fx);
        if (!vis(cx, cy, REACH[fx.k] || 600)) continue;
        ctx.save();
        try { fn(ctx, fx, time); } catch (err) { console.warn('SixPaths ground', fx.k, err); }
        ctx.restore();
      }
    },
    drawOverlay(ctx, st, p, time) {
      if (!st || !ctx || !Kit()) return;
      const L = st.effects;
      if (L && L.length) {
        setView(ctx);
        for (const fx of L) {
          if (!fx || !Number.isFinite(fx.age)) continue;
          const [cx, cy] = fxCenter(fx);
          if (!vis(cx, cy, REACH[fx.k] || 600)) continue;
          ctx.save();
          try {
            if (fx.k === 'awaken') awakenOverlay(ctx, fx, time, p && p.sixPaths ? p : null, st.hide || 0);
            else if (OVER[fx.k]) OVER[fx.k](ctx, fx, time);
          } catch (err) { console.warn('SixPaths overlay', fx.k, err); }
          ctx.restore();
        }
      }
      drawLabel(ctx, st, p);
    },
    drawAura
  };
})();
