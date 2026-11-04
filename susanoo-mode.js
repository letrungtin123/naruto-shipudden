/* Susanoo mode (O) — "nút O bật mode susano như sasuke".
 * A violet flaming Susanoo (ribcage, armoured torso, horned tengu-nosed helm, two big arms) rises round
 * Naruto. Left click walks a 10-step combo of Sasuke's Susanoo arsenal ending in Enton · Susanoo
 * Kagutsuchi, a colossal black-flame arrow that leaves its whole path burning.
 *
 * Contract (game.js): toggle / click / update / drawAura / drawGround / drawOverlay.
 * `st` (susanooState) is plain JSON sent to teammates ~20×/s: { effects: [...], act, fa, lbl }.
 * Every hit is resolved in update() on the caster's machine; drawing works from st + p alone. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (t, a, b) => c01((t - a) / (b - a));
  const easeOut = t => 1 - Math.pow(1 - c01(t), 3);
  const easeIn = t => { t = c01(t); return t * t; };
  const smooth = t => { t = c01(t); return t * t * (3 - 2 * t); };
  const bell = t => Math.sin(Math.PI * c01(t));
  const frac = v => v - Math.floor(v);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const r0 = v => Math.round(v);
  const r2 = v => Math.round(v * 100) / 100;
  const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const K = () => window.VFXKit;
  const SPR = () => window.AnimeSprites;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);

  // ------------------------------------------------------------------ palette
  const PAL = ['120,24,220', '178,62,255', '232,196,255'];
  const PAL_HOT = ['170,40,240', '206,104,255', '246,226,255'];
  const INK = 'rgba(22,0,44,.78)';
  const ink = a => `rgba(22,0,44,${(.78 * c01(a)).toFixed(3)})`;
  const VIOLET_FLAME = [[1, '#3a0f6e'], [.84, '#6a24c0'], [.66, '#9450ff'], [.46, '#c79bff'], [.25, '#f4eaff']];
  const FLAME_BASE = 114 / 128;

  // ------------------------------------------------------------------ the combo
  const COMBO = ['slash', 'arrow', 'fist', 'kaguken', 'volley', 'slash', 'amaterasu', 'chidori', 'magatama', 'ult'];
  const NAMES = {
    form: 'TU TÁ NĂNG HỒ', slash: 'TU TÁ NĂNG HỒ · KIẾM TRẢM', arrow: 'TU TÁ NĂNG HỒ · TIỄN',
    fist: 'TU TÁ NĂNG HỒ · THIẾT QUYỀN', kaguken: 'VIÊM ĐỘN · KAGUTSUCHI KIẾM', volley: 'TU TÁ NĂNG HỒ · LIÊN XẠ TIỄN',
    amaterasu: 'AMATERASU · HẮC VIÊM TƯỜNG', chidori: 'LÔI ĐỘN · THIÊN ĐIỂU TIỄN', magatama: 'VIÊM ĐỘN · KAGUTSUCHI CÂU NGỌC',
    ult: 'VIÊM ĐỘN · TU TÁ NĂNG HỒ KAGUTSUCHI'
  };
  const MAX_FX = 16;
  // Bow release times (s after the click) and arrow flight times.
  const REL = { arrow: .42, volley: .5, chidori: .55, ult: 1.25 };
  const FLY = { arrow: .2, volley: .22, chidori: .2, ult: .26 };
  const LEN = { arrow: 1100, volley: 1000, chidori: 1150, ult: 1200, kaguken: 880, magatama: 760 };
  const VOLLEY_N = 7, VOLLEY_SPREAD = .11;
  const MAGA_N = 3, MAGA_SPREAD = .3, MAGA_REL = .3, MAGA_FLY = .42;
  const KAGU_REL = .24, KAGU_FLY = .42;
  const AMA_REL = .38, AMA_LEN = 780;
  const FIST_SLAM = .45;

  let seq = 1;
  function ensure(st) {
    if (!Array.isArray(st.effects)) st.effects = [];
    if (typeof st.fa !== 'number') st.fa = 9;
    return st;
  }
  function add(st, fx) {
    const L = st.effects;
    if (L.length >= MAX_FX) {
      let i = L.findIndex(f => f.k !== 'ult' && f.k !== 'amaterasu');
      L.splice(i >= 0 ? i : 0, 1);
    }
    fx.age = 0; fx.id = (seq = (seq % 997) + 1);
    L.push(fx);
    return fx;
  }
  function label(st, kind) { st.lbl = { t: NAMES[kind] || '', a: 0 }; }
  function act(st, k, a, d, extra) { st.act = Object.assign({ k, a: r2(a), t: 0, d }, extra || {}); }
  const faceOf = a => (Math.cos(a) >= 0 ? 1 : -1);

  // ------------------------------------------------------------------ cached art
  function boneStroke(g, w, a = 1) {
    g.strokeStyle = `rgba(28,4,62,${.75 * a})`; g.lineWidth = w + 2.6; g.stroke();
    g.strokeStyle = `rgba(140,70,250,${.85 * a})`; g.lineWidth = w; g.stroke();
    g.strokeStyle = `rgba(238,220,255,${.95 * a})`; g.lineWidth = Math.max(1, w * .3); g.stroke();
  }
  // Every body sprite: 360×300 canvas, origin at the feet (180, 290), facing right.
  const BW = 360, BH = 300, BOX = 180, BOY = 290;
  const RIB_Y = i => -158 + i * 19, RIB_W = i => 62 - Math.abs(i - 1.5) * 4.4, RIB_TIP = i => 18 + i * 2.5;
  function ribSprite(front) {
    return K().sprite('su:ribs' + (front ? 'F' : 'B'), BW, BH, g => {
      g.translate(BOX, BOY); g.lineCap = 'round'; g.lineJoin = 'round';
      if (!front) {
        g.beginPath(); g.moveTo(0, -30); g.lineTo(0, -176); boneStroke(g, 5);
        for (let y = -40; y > -176; y -= 17) { g.beginPath(); g.moveTo(-6, y); g.lineTo(6, y); boneStroke(g, 3.6); }
        g.beginPath(); g.moveTo(-62, -160); g.quadraticCurveTo(0, -180, 62, -160); boneStroke(g, 5);
        for (let i = 0; i < 6; i++) {
          const y = RIB_Y(i), w = RIB_W(i);
          for (const s of [-1, 1]) {
            g.beginPath(); g.moveTo(s * 4, y); g.bezierCurveTo(s * w * .5, y - 12, s * w, y - 5, s * w, y + 10);
            boneStroke(g, 4, .85);
          }
        }
        // pelvis crest under the ribs, fading into the flame skirt
        g.beginPath(); g.moveTo(-44, -30); g.quadraticCurveTo(0, -12, 44, -30); boneStroke(g, 4, .7);
      } else {
        for (let i = 3; i < 6; i++) {
          const y = RIB_Y(i), w = RIB_W(i), tip = RIB_TIP(i);
          for (const s of [-1, 1]) {
            g.beginPath(); g.moveTo(s * w, y + 10); g.bezierCurveTo(s * w, y + 22, s * (tip + 12), y + 28, s * tip, y + 26);
            boneStroke(g, 3.6, .9);
          }
        }
      }
    });
  }
  // The armoured half-body: Sasuke's Susanoo torso, pauldrons and demon helm (no legs: a flame skirt).
  function bodySprite() {
    return K().sprite('su:body', BW, BH, g => {
      g.translate(BOX, BOY); g.lineJoin = 'round'; g.lineCap = 'round';
      let SW = 1;
      const shape = (build, fill, w = 1) => {
        build(); g.fillStyle = fill; g.fill();
        g.strokeStyle = 'rgba(22,2,50,.92)'; g.lineWidth = 3.4 * w * SW; g.stroke();
        g.strokeStyle = 'rgba(238,222,255,.95)'; g.lineWidth = 1.2 * w * SW; g.stroke();
      };
      const vgrad = (y0, y1, a, b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
      const line = (pts, w, c) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.strokeStyle = c; g.lineWidth = w; g.stroke(); };
      // torso, chest, abdomen, sash, gorget, pauldrons
      g.save(); g.translate(0, -178); g.scale(.5, .5); g.translate(0, 330); SW = 1.7;
      shape(() => {
        g.beginPath();
        g.moveTo(-24, -332); g.quadraticCurveTo(-80, -330, -108, -298); g.lineTo(-88, -250); g.quadraticCurveTo(-84, -196, -62, -160);
        g.lineTo(62, -160); g.quadraticCurveTo(84, -196, 88, -250); g.lineTo(108, -298); g.quadraticCurveTo(80, -330, 24, -332); g.closePath();
      }, vgrad(-332, -160, 'rgba(146,88,246,.7)', 'rgba(74,24,164,.6)'), 1.1);
      for (const side of [-1, 1]) shape(() => {
        g.beginPath(); g.moveTo(side * 6, -304); g.quadraticCurveTo(side * 66, -304, side * 74, -252); g.quadraticCurveTo(side * 44, -232, side * 6, -238); g.closePath();
      }, 'rgba(176,128,255,.62)', .8);
      for (let i = 0; i < 3; i++) shape(() => {
        const y = -226 + i * 21, w = 56 - i * 5;
        g.beginPath(); g.moveTo(-w, y); g.quadraticCurveTo(0, y - 6, w, y); g.lineTo(w - 4, y + 16); g.quadraticCurveTo(0, y + 10, -w + 4, y + 16); g.closePath();
      }, 'rgba(120,62,226,.6)', .7);
      line([[0, -326], [0, -164]], 3.4, 'rgba(240,226,255,.8)');
      shape(() => { g.beginPath(); g.moveTo(-66, -166); g.quadraticCurveTo(0, -152, 66, -166); g.lineTo(64, -148); g.quadraticCurveTo(0, -134, -64, -148); g.closePath(); }, 'rgba(58,16,128,.85)', .8);
      shape(() => { g.beginPath(); g.ellipse(18, -150, 11, 8, 0, 0, TAU); }, 'rgba(150,96,250,.8)', .7);
      shape(() => { g.beginPath(); g.ellipse(0, -330, 40, 13, 0, 0, TAU); }, 'rgba(96,40,196,.8)', .9);
      for (const side of [-1, 1]) for (let p = 2; p >= 0; p--) {
        shape(() => {
          const cx = side * (108 + p * 7), cy = -300 + p * 18;
          g.beginPath(); g.moveTo(cx - side * 44, cy - 8); g.quadraticCurveTo(cx, cy - 34, cx + side * 46, cy - 2);
          g.quadraticCurveTo(cx + side * 40, cy + 16, cx + side * 8, cy + 18); g.quadraticCurveTo(cx - side * 30, cy + 14, cx - side * 44, cy - 8); g.closePath();
        }, p ? 'rgba(112,52,218,.72)' : vgrad(-334, -280, 'rgba(196,150,255,.82)', 'rgba(120,60,226,.76)'));
      }
      g.restore();
      // helm: swept horns, crescent crest, demon face plate, tengu nose, fanged mouth guard
      g.save(); g.translate(0, -197); g.scale(.56, .56); g.translate(0, 364); SW = 1.6;
      for (const side of [-1, 1]) shape(() => {
        g.beginPath(); g.moveTo(side * 20, -386); g.quadraticCurveTo(side * 60, -404, side * 92, -462); g.quadraticCurveTo(side * 58, -420, side * 30, -366); g.closePath();
      }, 'rgba(120,62,228,.82)', .85);
      shape(() => { g.beginPath(); g.ellipse(0, -364, 34, 38, 0, 0, TAU); }, vgrad(-402, -326, 'rgba(150,96,250,.88)', 'rgba(70,24,160,.88)'));
      shape(() => {
        g.beginPath(); g.moveTo(-8, -396); g.quadraticCurveTo(-30, -440, -12, -488); g.quadraticCurveTo(0, -446, 8, -440);
        g.quadraticCurveTo(14, -458, 30, -470); g.quadraticCurveTo(14, -430, 10, -396); g.closePath();
      }, vgrad(-488, -396, 'rgba(240,226,255,.92)', 'rgba(150,96,250,.88)'), .9);
      shape(() => {
        g.beginPath(); g.moveTo(-28, -374); g.lineTo(28, -374); g.lineTo(26, -350); g.lineTo(16, -330); g.lineTo(0, -322); g.lineTo(-16, -330); g.lineTo(-26, -350); g.closePath();
      }, 'rgba(186,146,255,.8)', .9);
      shape(() => { g.beginPath(); g.moveTo(-30, -378); g.lineTo(0, -368); g.lineTo(30, -378); g.lineTo(28, -370); g.lineTo(0, -360); g.lineTo(-28, -370); g.closePath(); }, 'rgba(60,16,130,.92)', .7);
      g.fillStyle = 'rgba(12,0,34,.95)';
      for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * 6, -364); g.lineTo(side * 24, -370); g.lineTo(side * 22, -360); g.lineTo(side * 8, -357); g.closePath(); g.fill(); }
      shape(() => { g.beginPath(); g.moveTo(4, -360); g.quadraticCurveTo(36, -356, 68, -340); g.lineTo(8, -344); g.closePath(); }, 'rgba(160,110,255,.88)', .8);
      shape(() => { g.beginPath(); g.moveTo(-20, -342); g.lineTo(20, -342); g.lineTo(14, -328); g.lineTo(-14, -328); g.closePath(); }, 'rgba(40,8,90,.92)', .7);
      g.fillStyle = 'rgba(244,234,255,.95)';
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 5 - 2, -342); g.lineTo(i * 5 + 2, -342); g.lineTo(i * 5, -335 + Math.abs(i) * .8); g.closePath(); g.fill(); }
      g.restore();
    });
  }
  // Wings of the Perfect form (ultimate only), facing right, same canvas convention but wider.
  const WW = 760, WH = 420, WOX = 380, WOY = 400;
  function wingSprite() {
    return K().sprite('su:wings', WW, WH, g => {
      g.translate(WOX, WOY); g.lineJoin = 'round'; g.lineCap = 'round';
      const shape = (build, fill, w = 1) => {
        build(); g.fillStyle = fill; g.fill();
        g.strokeStyle = 'rgba(22,2,50,.9)'; g.lineWidth = 3 * w; g.stroke();
        g.strokeStyle = 'rgba(238,222,255,.9)'; g.lineWidth = 1.1 * w; g.stroke();
      };
      for (const side of [-1, 1]) {
        const A0 = [side * 50, -175], A1 = [side * 150, -330], A2 = [side * 300, -300];
        const arm = u => { const v = 1 - u; return [v * v * A0[0] + 2 * v * u * A1[0] + u * u * A2[0], v * v * A0[1] + 2 * v * u * A1[1] + u * u * A2[1]]; };
        for (const layer of [0, 1]) {
          const n = layer ? 8 : 9;
          for (let k = n - 1; k >= 0; k--) {
            const u = (k + (layer ? .5 : 0)) / (n - .2), [rx, ry] = arm(Math.min(1, u));
            const ang = Math.PI / 2 - side * (.12 + u * 1.25), L = (layer ? 80 : 125) + u * (layer ? 40 : 75), W = layer ? 13 : 17;
            const tx = rx + Math.cos(ang) * L, ty = ry + Math.sin(ang) * L, nx = -Math.sin(ang) * W, ny = Math.cos(ang) * W;
            shape(() => {
              g.beginPath(); g.moveTo(rx - nx * .4, ry - ny * .4);
              g.quadraticCurveTo(rx + (tx - rx) * .55 + nx, ry + (ty - ry) * .55 + ny, tx, ty);
              g.quadraticCurveTo(rx + (tx - rx) * .5 - nx * .7, ry + (ty - ry) * .5 - ny * .7, rx + nx * .4, ry + ny * .4); g.closePath();
            }, layer ? 'rgba(160,104,255,.66)' : 'rgba(92,36,184,.66)', .8);
          }
        }
        g.beginPath(); g.moveTo(A0[0], A0[1]); g.quadraticCurveTo(A1[0], A1[1], A2[0], A2[1]);
        g.strokeStyle = 'rgba(22,2,50,.92)'; g.lineWidth = 13; g.stroke();
        g.strokeStyle = 'rgba(132,74,236,.95)'; g.lineWidth = 8; g.stroke();
        g.strokeStyle = 'rgba(240,226,255,.95)'; g.lineWidth = 2; g.stroke();
      }
    });
  }
  // Amaterasu / Kagutsuchi black fire: wavy black tongues with a crimson-violet rim. 6 variants, base y = 114/128.
  function amaFlame(v) {
    v = ((v % 6) + 6) % 6;
    return K().sprite('su-ama:' + v, 64, 128, g => {
      const tongue = (cx, hw, h, lean, seed, grow) => {
        const N = 18, L = [], Rr = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, w = (hw + grow) * Math.pow(1 - t, .85) * (1 + .3 * Math.sin(t * 10 + seed) * t);
          const xc = cx + Math.sin(t * 4 + seed) * hw * .45 * t + lean * t * t * hw * 1.4, y = 114 - t * (h + grow * 1.5);
          L.push([xc - w, y]); Rr.push([xc + w, y]);
        }
        g.beginPath(); g.moveTo(L[0][0], L[0][1]);
        for (const p of L) g.lineTo(p[0], p[1]);
        for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
        g.quadraticCurveTo(cx, 114 + hw * .5, L[0][0], L[0][1]); g.closePath(); g.fill();
      };
      const sd = v * 1.7 + .3, lean = (hash(v + 9) - .5) * 1.2;
      const set = grow => {
        tongue(32, 17, 104, lean, sd, grow);
        tongue(17, 10, 62 + hash(v) * 18, -.6, sd + 2, grow);
        tongue(48, 10, 70 + hash(v + 3) * 18, .7, sd + 4, grow);
        tongue(26, 7, 84, lean - .5, sd + 6, grow);
        tongue(40, 6, 52, lean + .6, sd + 8, grow);
      };
      g.fillStyle = 'rgba(120,24,96,.9)'; set(2.8);
      g.fillStyle = '#1c0414'; set(1.2);
      g.fillStyle = '#000000'; set(0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(80,24,110,.3)';
      g.beginPath(); g.ellipse(32, 108, 7, 14, 0, 0, TAU); g.fill();
    });
  }
  const vflame = v => K().flame(((v % 6) + 6) % 6, VIOLET_FLAME, 'suv');

  // ------------------------------------------------------------------ geometry shared by aura + effects
  const SH_X = 70, SH_Y = 150;  // shoulder sockets (local, × body scale)
  // The great bow: grip, nock, limb tips and arrow tip for a ground aim angle a. All in world/screen coords.
  const RIG = { gx: 0, gy: 0, nx: 0, ny: 0, tx: 0, ty: 0, dx: 1, dy: 0, px: 0, py: 1, t1x: 0, t1y: 0, t2x: 0, t2y: 0, side: 1, s: 1 };
  function rig(x, fy, a, drawK, s) {
    let dx = Math.cos(a), dy = Math.sin(a) * .55; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const px = -dy, py = dx;
    const gx = x + dx * 118 * s, gy = fy - 150 * s + dy * 64 * s;
    RIG.gx = gx; RIG.gy = gy; RIG.dx = dx; RIG.dy = dy; RIG.px = px; RIG.py = py; RIG.s = s; RIG.side = dx >= 0 ? 1 : -1;
    RIG.nx = gx - dx * 128 * s * drawK; RIG.ny = gy - dy * 128 * s * drawK;
    RIG.t1x = gx + px * 150 * s - dx * 58 * s; RIG.t1y = gy + py * 150 * s - dy * 58 * s;
    RIG.t2x = gx - px * 150 * s - dx * 58 * s; RIG.t2y = gy - py * 150 * s - dy * 58 * s;
    RIG.tx = gx + dx * 64 * s; RIG.ty = gy + dy * 64 * s;
    return RIG;
  }
  // The sword arm's hand + blade angle while idle or sweeping (slash / Kagutsuchi sword).
  const POSE = { hx: 0, hy: 0, ba: 0 };
  function swordPose(x, fy, f, s, A, time) {
    const idx = x + f * 116 * s, idy = fy - 84 * s + Math.sin(time * 2.1) * 3, idA = -Math.PI / 2 + f * .34;
    POSE.hx = idx; POSE.hy = idy; POSE.ba = idA;
    if (!A || (A.k !== 'slash' && A.k !== 'kaguken')) return POSE;
    const t = A.t, sd = A.s || 1;
    const th0 = A.a - sd * 1.75, th1 = A.a + sd * 1.35;
    let th, w;
    if (t < .1) { th = th0; w = easeOut(t / .1); }
    else if (t < .24) { th = lerp(th0, th1, easeOut((t - .1) / .14)); w = 1; }
    else { th = th1; w = 1 - smooth((t - .36) / .2); }
    const sx = x + Math.cos(th) * 108 * s, sy = fy - 112 * s + Math.sin(th) * 62 * s, sa = Math.atan2(Math.sin(th) * .6, Math.cos(th));
    POSE.hx = lerp(idx, sx, w); POSE.hy = lerp(idy, sy, w); POSE.ba = idA + angDiff(idA, sa) * w;
    return POSE;
  }
  // The off arm's hand: resting, thrust toward the aim (magatama), or raised (Amaterasu).
  const OFF = { hx: 0, hy: 0 };
  function offPose(x, fy, f, s, A, time) {
    let hx = x - f * 106 * s, hy = fy - 70 * s + Math.sin(time * 2.1 + 1.3) * 3;
    if (A && A.k === 'magatama') {
      let dx = Math.cos(A.a), dy = Math.sin(A.a) * .6; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const k = A.t < MAGA_REL ? easeOut(A.t / MAGA_REL) : 1 - smooth((A.t - MAGA_REL - .2) / .25);
      hx = lerp(hx, x + dx * 130 * s, k); hy = lerp(hy, fy - 120 * s + dy * 70 * s, k);
    } else if (A && A.k === 'amaterasu') {
      const k = A.t < AMA_REL ? easeOut(A.t / .2) : 1 - smooth((A.t - AMA_REL - .15) / .25);
      hx = lerp(hx, x - f * 70 * s, k); hy = lerp(hy, fy - 228 * s, k);
    }
    OFF.hx = hx; OFF.hy = hy;
    return OFF;
  }
  const isBow = k => k === 'arrow' || k === 'volley' || k === 'chidori' || k === 'ult';

  // ------------------------------------------------------------------ casts
  function castSlash(st, p, api) {
    const t = api.aim(400), a = Math.atan2(t.y - p.y, t.x - p.x), s = (p.suCount || 0) % 2 ? -1 : 1;
    add(st, { k: 'slash', x: r0(p.x), y: r0(p.y), a: r2(a), s, h: 0, dur: .8 });
    act(st, 'slash', a, .6, { s });
    p.fireCooldown = .52; p.castPose = .3; p.castFrame = 'attack';
  }
  function castBow(st, p, api, k) {
    const t = api.aim(900), a = Math.atan2(t.y - p.y, t.x - p.x);
    const fx = { k, x: r0(p.x), y: r0(p.y), a: r2(a), h: 0, dur: REL[k] + FLY[k] + (k === 'ult' ? 4.3 : k === 'chidori' ? .95 : .8) };
    if (k === 'chidori') fx.ch = [];
    if (k === 'ult') fx.nt = 0;
    add(st, fx);
    act(st, k, a, REL[k] + .35);
    p.fireCooldown = k === 'ult' ? 2 : k === 'chidori' ? .85 : k === 'volley' ? .8 : .66;
    p.castPose = REL[k] + .1; p.castFrame = 'raise';
  }
  function castFist(st, p, api) {
    const t = api.aim(520), a = Math.atan2(t.y - p.y, t.x - p.x);
    add(st, { k: 'fist', x: r0(p.x), y: r0(p.y), tx: r0(t.x), ty: r0(t.y), f: faceOf(a), h: 0, dur: 1.7 });
    act(st, 'fist', a, .88, { tx: r0(t.x), ty: r0(t.y) });
    p.fireCooldown = .8; p.castPose = .45; p.castFrame = 'attack';
  }
  function castKaguken(st, p, api) {
    const t = api.aim(600), a = Math.atan2(t.y - p.y, t.x - p.x), s = (p.suCount || 0) % 2 ? -1 : 1;
    add(st, { k: 'kaguken', x: r0(p.x), y: r0(p.y), a: r2(a), s, h: 0, nt: 0, dur: 3.6 });
    act(st, 'kaguken', a, .62, { s });
    p.fireCooldown = .72; p.castPose = .35; p.castFrame = 'attack';
  }
  function castMagatama(st, p, api) {
    const t = api.aim(700), a = Math.atan2(t.y - p.y, t.x - p.x);
    add(st, { k: 'magatama', x: r0(p.x), y: r0(p.y), a: r2(a), f: faceOf(a), h: 0, nt: 0, dur: 3.2 });
    act(st, 'magatama', a, .85);
    p.fireCooldown = .72; p.castPose = .4; p.castFrame = 'attack';
  }
  function castAmaterasu(st, p, api) {
    const t = api.aim(520), a = Math.atan2(t.y - p.y, t.x - p.x);
    add(st, { k: 'amaterasu', x: r0(t.x), y: r0(t.y), sx: r0(p.x), sy: r0(p.y), a: r2(a), f: faceOf(a), h: 0, nt: 0, dur: 4.8 });
    act(st, 'amaterasu', a, .85);
    p.fireCooldown = .76; p.castPose = .45; p.castFrame = 'seal';
  }
  const CAST = {
    slash: castSlash, fist: castFist, kaguken: castKaguken, magatama: castMagatama, amaterasu: castAmaterasu,
    arrow: (st, p, api) => castBow(st, p, api, 'arrow'), volley: (st, p, api) => castBow(st, p, api, 'volley'),
    chidori: (st, p, api) => castBow(st, p, api, 'chidori'), ult: (st, p, api) => castBow(st, p, api, 'ult')
  };

  // ------------------------------------------------------------------ hits (caster only)
  function endOf(fx, a, len) { return [fx.x + Math.cos(a) * len, fx.y + Math.sin(a) * len]; }
  function updateFx(st, fx, me, dt, api) {
    const age = fx.age;
    switch (fx.k) {
      case 'form':
        if (age >= .14 && !fx.h) {
          fx.h = 1;
          api.circle(fx.x, fx.y, 330, 1200, 240, .3);
          api.clearShots(fx.x, fx.y, 400);
          api.world(fx.x, fx.y, 150, 900, 'shockwave');
          api.shake(12);
        }
        break;
      case 'slash':
        if (age >= .16 && !fx.h) {
          fx.h = 1;
          const n = api.cone(fx.x, fx.y, fx.a, 470, 1.25, 1800, 140);
          api.clearShots(fx.x + Math.cos(fx.a) * 160, fx.y + Math.sin(fx.a) * 160, 300);
          api.world(fx.x + Math.cos(fx.a) * 260, fx.y + Math.sin(fx.a) * 260, 110, 1000, 'blade', fx.a);
          api.shake(n ? 9 : 6);
        }
        break;
      case 'arrow':
        if (age >= REL.arrow && !fx.h) {
          fx.h = 1;
          const [x2, y2] = endOf(fx, fx.a, LEN.arrow);
          api.line(fx.x, fx.y, x2, y2, 36, 2600, 70, 'shockwave');
          api.world(x2, y2, 130, 1500, 'crater', fx.a);
          api.circle(x2, y2, 150, 900, 90);
          api.shake(11);
        }
        break;
      case 'volley':
        for (let j = 0; j < VOLLEY_N; j++) {
          const i = [3, 2, 4, 1, 5, 0, 6][j];
          if (fx.h & (1 << i) || age < REL.volley + Math.abs(i - 3) * .03) continue;
          fx.h |= 1 << i;
          const a = fx.a + (i - 3) * VOLLEY_SPREAD, [x2, y2] = endOf(fx, a, LEN.volley);
          api.line(fx.x, fx.y, x2, y2, 26, 1300, 40, i === 3 ? 'shockwave' : undefined);
          if (i === 3) { api.world(x2, y2, 110, 1200, 'crater', a); api.shake(12); }
        }
        break;
      case 'chidori':
        if (age >= REL.chidori && !fx.h) {
          fx.h = 1;
          const [x2, y2] = endOf(fx, fx.a, LEN.chidori);
          api.line(fx.x, fx.y, x2, y2, 46, 3200, 90, 'lightning');
          api.circle(x2, y2, 240, 1500, 130, .3);
          api.world(x2, y2, 170, 2000, 'lightning', fx.a);
          // Chirping lightning jumps from the impact to the nearest survivors.
          const list = [];
          for (const z of api.enemies) {
            if (!(z.health > 0)) continue;
            const d = Math.hypot(z.x - x2, z.y - y2);
            if (d > 60 && d < 520) list.push([d, z]);
          }
          list.sort((p, q) => p[0] - q[0]);
          fx.ch = list.slice(0, 5).map(([, z]) => [r0(z.x), r0(z.y)]);
          for (const c of fx.ch) api.circle(c[0], c[1], 70, 1000, 40);
          api.shake(15);
        }
        break;
      case 'fist':
        if (age >= FIST_SLAM && !(fx.h & 1)) {
          fx.h |= 1;
          api.circle(fx.tx, fx.ty, 290, 2800, 170, .3);
          api.world(fx.tx, fx.ty, 210, 2600, 'crater');
          api.shake(17);
        }
        if (age >= FIST_SLAM + .17 && !(fx.h & 2)) {
          fx.h |= 2;
          api.circle(fx.tx, fx.ty, 470, 900, 100, .5);
          api.clearShots(fx.tx, fx.ty, 320);
        }
        break;
      case 'kaguken': {
        if (age >= KAGU_REL && !(fx.h & 1)) {
          fx.h |= 1;
          const [x2, y2] = endOf(fx, fx.a, LEN.kaguken);
          api.line(fx.x, fx.y, x2, y2, 76, 2200, 80, 'fire');
          api.world(x2, y2, 120, 1300, 'fire', fx.a);
          api.shake(11);
          fx.nt = KAGU_REL + .5;
        }
        if (fx.h & 1 && age >= fx.nt && age < fx.dur - .6) {
          fx.nt += .45;
          for (let u = .3; u <= 1.01; u += .233) { const [x, y] = endOf(fx, fx.a, LEN.kaguken * u); api.circle(x, y, 85, 260, 0); }
        }
        break;
      }
      case 'magatama': {
        if (age >= MAGA_REL && !(fx.h & 1)) {
          fx.h |= 1;
          for (let i = 0; i < MAGA_N; i++) {
            const a = fx.a + (i - 1) * MAGA_SPREAD, [x2, y2] = endOf(fx, a, LEN.magatama);
            api.line(fx.x, fx.y, x2, y2, 34, 900, 30);
          }
        }
        if (age >= MAGA_REL + MAGA_FLY && !(fx.h & 2)) {
          fx.h |= 2;
          for (let i = 0; i < MAGA_N; i++) {
            const a = fx.a + (i - 1) * MAGA_SPREAD, [x2, y2] = endOf(fx, a, LEN.magatama);
            api.circle(x2, y2, 175, 1600, 110, .3);
            api.world(x2, y2, 110, 1200, 'fire');
          }
          api.shake(13);
          fx.nt = age + .5;
        }
        if (fx.h & 2 && age >= fx.nt && age < fx.dur - .5) {
          fx.nt += .5;
          for (let i = 0; i < MAGA_N; i++) { const [x2, y2] = endOf(fx, fx.a + (i - 1) * MAGA_SPREAD, LEN.magatama); api.circle(x2, y2, 150, 280, 0); }
        }
        break;
      }
      case 'amaterasu': {
        const px = -Math.sin(fx.a), py = Math.cos(fx.a), h = AMA_LEN / 2;
        const x1 = fx.x - px * h, y1 = fx.y - py * h, x2 = fx.x + px * h, y2 = fx.y + py * h;
        if (age >= AMA_REL && !(fx.h & 1)) {
          fx.h |= 1;
          api.line(x1, y1, x2, y2, 74, 1800, 70, 'fire');
          api.world(fx.x, fx.y, 140, 1200, 'fire', fx.a);
          api.shake(12);
          fx.nt = AMA_REL + .35;
        }
        if (fx.h & 1 && age < fx.dur - .5) {
          for (let u = -1; u <= 1.01; u += .5) api.clearShots(fx.x + px * h * u, fx.y + py * h * u, 90);
          if (age >= fx.nt) { fx.nt += .35; api.line(x1, y1, x2, y2, 64, 330, 0); }
        }
        break;
      }
      case 'ult': {
        const [x2, y2] = endOf(fx, fx.a, LEN.ult);
        if (age >= REL.ult && !(fx.h & 1)) {
          fx.h |= 1;
          api.line(fx.x, fx.y, x2, y2, 96, 8200, 200, 'crater');
          for (const [u, r] of [[.35, 160], [.7, 200]]) { const [x, y] = endOf(fx, fx.a, LEN.ult * u); api.world(x, y, r, 3800, 'crater', fx.a); }
          api.clearShots((fx.x + x2) / 2, (fx.y + y2) / 2, LEN.ult / 2);
          api.shake(30);
        }
        if (age >= REL.ult + FLY.ult && !(fx.h & 2)) {
          fx.h |= 2;
          api.circle(x2, y2, 360, 3200, 190, .3);
          api.world(x2, y2, 270, 4200, 'crater');
          api.shake(26);
          fx.nt = age + .4;
        }
        if (fx.h & 2 && age >= fx.nt && age < fx.dur - .5) { fx.nt += .4; api.line(fx.x, fx.y, x2, y2, 82, 520, 0); api.circle(x2, y2, 260, 400, 0); }
        break;
      }
    }
  }

  function update(st, me, dt, api) {
    if (!st || !me) return;
    ensure(st);
    const L = st.effects;
    for (let i = L.length - 1; i >= 0; i--) {
      const fx = L[i];
      if (!fx || !Number.isFinite(fx.age)) { L.splice(i, 1); continue; }
      fx.age += dt;
      try { updateFx(st, fx, me, dt, api); } catch (err) { console.warn('Susanoo', fx.k, err); fx.age = fx.dur; }
      if (fx.age >= fx.dur) L.splice(i, 1);
    }
    if (st.act) { st.act.t += dt; if (st.act.t >= st.act.d) st.act = null; }
    if (st.lbl) { st.lbl.a += dt; if (st.lbl.a > 1.6) st.lbl = null; }
    if (st.fa < 9) st.fa += dt;
  }

  // ------------------------------------------------------------------ drawing primitives
  const VIEW = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
  function setView(ctx) {
    const m = ctx.getTransform ? ctx.getTransform() : null, c = ctx.canvas;
    if (!m || !c || !m.a || !m.d || m.b || m.c) { VIEW.x0 = VIEW.y0 = -1e9; VIEW.x1 = VIEW.y1 = 1e9; return; }
    const xa = -m.e / m.a, xb = (c.width - m.e) / m.a, ya = -m.f / m.d, yb = (c.height - m.f) / m.d;
    VIEW.x0 = Math.min(xa, xb); VIEW.x1 = Math.max(xa, xb); VIEW.y0 = Math.min(ya, yb); VIEW.y1 = Math.max(ya, yb);
  }
  const vis = (x, y, r) => x + r > VIEW.x0 && x - r < VIEW.x1 && y + r > VIEW.y0 && y - r < VIEW.y1;

  function ring(ctx, x, y, r, w, color, squash = .5) {
    if (!(r > 1)) return;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * squash, 0, 0, TAU); ctx.stroke();
  }
  function inkRing(ctx, x, y, r, a, w = 3) {
    ring(ctx, x, y, r, w + 5, `rgba(24,4,52,${.55 * a})`);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ring(ctx, x, y, r, w, `rgba(200,150,255,${.9 * a})`);
    ctx.globalCompositeOperation = op;
  }
  function sector(ctx, x, y, ra, rb, a0, a1, sq = .55) {
    ctx.beginPath();
    ctx.ellipse(x, y, rb, rb * sq, 0, a0, a1);
    ctx.ellipse(x, y, ra, ra * sq, 0, a1, a0, true);
    ctx.closePath();
  }
  // Ground point at angle a of an ellipse of radius r (squash .55): matches sector().
  function rays(ctx, x, y, n, ra, rb, seed, alpha, w = 1.5) {
    ctx.strokeStyle = `rgba(230,205,255,${alpha})`; ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + hash(seed + i) * .5, l = ra + (rb - ra) * (.5 + hash(seed + i * 3) * .5);
      ctx.moveTo(x + Math.cos(a) * ra, y + Math.sin(a) * ra * .5); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * .5);
    }
    ctx.stroke();
  }
  // Jagged cracks radiating over the ground.
  function cracks(ctx, x, y, n, len, seed, a) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, c] of [[4.5, `rgba(26,14,30,${.55 * a})`], [1.4, `rgba(205,160,255,${.55 * a})`]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        let ang = i / n * TAU + hash(seed + i * 1.7) * .6, px = x, py = y;
        const L = len * (.55 + hash(seed + i * 2.9) * .45);
        ctx.moveTo(px, py);
        for (let j = 1; j <= 4; j++) {
          ang += (hash(seed + i * 9 + j) - .5) * .9;
          px += Math.cos(ang) * L / 4; py += Math.sin(ang) * L / 4 * .55;
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
  }
  function puffs(ctx, x, y, n, rad, age, seed, kind, alpha, size = 34) {
    const k = K(), img = k.puff(kind), p = easeOut(age * 1.6);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + hash(seed + i) * .8, d = rad * (.35 + .65 * p) * (.7 + hash(seed + i * 3) * .3);
      k.stamp(ctx, img, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - p * 22, size * (.7 + p * .6), alpha * (1 - ramp(age, .25, 1.1)));
    }
  }
  // Violet chakra arrow pointing along screen angle ang, head at (x, y).
  function arrowPath(ctx, x, y, ca, sa, len, w) {
    const nx = -sa, ny = ca, bx = x - ca * w * 3.2, by = y - sa * w * 3.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(bx + nx * w * 1.6, by + ny * w * 1.6);
    ctx.lineTo(bx + ca * w * .9 + nx * w * .45, by + sa * w * .9 + ny * w * .45);
    ctx.lineTo(x - ca * len + nx * w * .35, y - sa * len + ny * w * .35);
    ctx.lineTo(x - ca * (len + w * 1.6), y - sa * (len + w * 1.6));
    ctx.lineTo(x - ca * len - nx * w * .35, y - sa * len - ny * w * .35);
    ctx.lineTo(bx + ca * w * .9 - nx * w * .45, by + sa * w * .9 - ny * w * .45);
    ctx.lineTo(bx - nx * w * 1.6, by - ny * w * 1.6);
    ctx.closePath();
  }
  function drawArrow(ctx, x, y, ang, len, w, a, style) {
    const ca = Math.cos(ang), sa = Math.sin(ang), k = K();
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = style === 'black' ? `rgba(120,20,90,${.9 * a})` : ink(a); arrowPath(ctx, x, y, ca, sa, len + 6, w + 3.5); ctx.fill();
    if (style === 'black') {
      ctx.fillStyle = `rgba(0,0,0,${.95 * a})`; arrowPath(ctx, x, y, ca, sa, len, w); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(150,50,220,${.5 * a})`; arrowPath(ctx, x - ca * 2, y - sa * 2, ca, sa, len * .9, w * .3); ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(140,60,250,${.8 * a})`; arrowPath(ctx, x, y, ca, sa, len, w); ctx.fill();
      ctx.fillStyle = `rgba(214,176,255,${.8 * a})`; arrowPath(ctx, x - ca * 2, y - sa * 2, ca, sa, len * .95, w * .55); ctx.fill();
      ctx.fillStyle = `rgba(255,250,255,${.95 * a})`; arrowPath(ctx, x - ca * 4, y - sa * 4, ca, sa, len * .9, w * .2); ctx.fill();
      k.glow(ctx, x - ca * w * 2, y - sa * w * 2, w * 4, '170,90,255', .55 * a);
    }
    ctx.globalCompositeOperation = op;
  }
  // A tapered capsule from a (half-width wa) to b (half-width wb).
  function capsule(ctx, ax, ay, bx, by, wa, wb) {
    const an = Math.atan2(by - ay, bx - ax), nx = -Math.sin(an), ny = Math.cos(an);
    ctx.moveTo(ax + nx * wa, ay + ny * wa); ctx.lineTo(bx + nx * wb, by + ny * wb);
    ctx.arc(bx, by, wb, an + Math.PI / 2, an - Math.PI / 2, true);
    ctx.lineTo(ax - nx * wa, ay - ny * wa);
    ctx.arc(ax, ay, wa, an - Math.PI / 2, an + Math.PI / 2, true);
    ctx.closePath();
  }
  function cel(ctx, fill, a, w = 3.2) {
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = `rgba(22,2,50,${.88 * a})`; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = `rgba(236,222,255,${.85 * a})`; ctx.lineWidth = 1.1; ctx.stroke();
  }
  let NOW = 0;
  // A big armoured chakra arm from shoulder (sx,sy) to hand (hx,hy); bend pushes the elbow sideways.
  // Muscled, tapered segments, a plated vambrace, a flaming edge and a clenched fist.
  function limb(ctx, sx, sy, hx, hy, bend, w, a, fist) {
    if (!(a > .01)) return;
    const dx = hx - sx, dy = hy - sy, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const ex = (sx + hx) / 2 + nx * bend, ey = (sy + hy) / 2 + ny * bend;
    const fx = hx - ex, fy = hy - ey, fl = Math.hypot(fx, fy) || 1, ux = fx / fl, uy = fy / fl, an = Math.atan2(uy, ux);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // violet flames licking off the top edge of the arm
    const tick = Math.floor(NOW * 12), m = ctx.getTransform();
    for (let i = 0; i < 3; i++) {
      const u = .25 + i * .3, px = i < 1 ? lerp(sx, ex, .55) : lerp(ex, hx, (u - .4) / .6), py = i < 1 ? lerp(sy, ey, .55) : lerp(ey, hy, (u - .4) / .6);
      const h = w * (1.1 + .35 * Math.sin(NOW * 9 + i * 2 + sx * .01)) * a;
      ctx.globalAlpha = .55 * a;
      ctx.drawImage(vflame(i + tick + (sx | 0)), px - h * .28, py - w * .25 - h * FLAME_BASE, h * .56, h);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(m);
    // upper arm (bulging deltoid/bicep), forearm
    ctx.beginPath(); capsule(ctx, sx, sy, ex, ey, w * .6, w * .44); cel(ctx, `rgba(104,44,210,${.6 * a})`, a);
    ctx.beginPath(); ctx.ellipse(lerp(sx, ex, .45), lerp(sy, ey, .45), Math.hypot(ex - sx, ey - sy) * .32, w * .3, Math.atan2(ey - sy, ex - sx), 0, TAU);
    ctx.fillStyle = `rgba(170,124,255,${.35 * a})`; ctx.fill();
    ctx.beginPath(); capsule(ctx, ex, ey, hx, hy, w * .46, w * .36); cel(ctx, `rgba(112,52,220,${.62 * a})`, a);
    // plated vambrace with a centre ridge
    const p0x = ex + fx * .22, p0y = ey + fy * .22, p1x = ex + fx * .8, p1y = ey + fy * .8, vn = -uy, vm = ux;
    ctx.beginPath();
    ctx.moveTo(p0x + vn * w * .5, p0y + vm * w * .5); ctx.lineTo(p1x + vn * w * .42, p1y + vm * w * .42);
    ctx.lineTo(p1x + ux * w * .12, p1y + uy * w * .12);
    ctx.lineTo(p1x - vn * w * .42, p1y - vm * w * .42); ctx.lineTo(p0x - vn * w * .5, p0y - vm * w * .5);
    ctx.lineTo(p0x - ux * w * .16, p0y - uy * w * .16); ctx.closePath();
    cel(ctx, `rgba(160,112,255,${.66 * a})`, a, 2.4);
    ctx.strokeStyle = `rgba(244,234,255,${.75 * a})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(p0x, p0y); ctx.lineTo(p1x, p1y); ctx.stroke();
    // elbow guard
    ctx.beginPath(); ctx.arc(ex, ey, w * .4, 0, TAU); cel(ctx, `rgba(150,96,250,${.8 * a})`, a, 2.6);
    ctx.beginPath(); ctx.arc(ex - ux * w * .08, ey - uy * w * .08, w * .17, 0, TAU); ctx.fillStyle = `rgba(232,214,255,${.6 * a})`; ctx.fill();
    if (fist) {
      const r = w * .56;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(an);
      // thumb, then the clenched fist with four knuckle ridges
      ctx.beginPath(); ctx.ellipse(r * .25, -r * .78, r * .5, r * .3, -.4, 0, TAU); cel(ctx, `rgba(126,66,232,${.8 * a})`, a, 2.4);
      ctx.beginPath();
      ctx.moveTo(-r * .55, -r * .8); ctx.quadraticCurveTo(r * .7, -r * 1.05, r * 1.2, -r * .62); ctx.quadraticCurveTo(r * 1.5, 0, r * 1.2, r * .62);
      ctx.quadraticCurveTo(r * .7, r * 1.05, -r * .55, r * .8); ctx.quadraticCurveTo(-r * .8, 0, -r * .55, -r * .8); ctx.closePath();
      cel(ctx, `rgba(136,76,240,${.82 * a})`, a, 3);
      ctx.strokeStyle = `rgba(28,4,62,${.75 * a})`; ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const yy = (-.42 + i * .42) * r; ctx.moveTo(r * .55, yy); ctx.quadraticCurveTo(r * 1.0, yy - r * .1, r * 1.32, yy * .9); }
      ctx.stroke();
      ctx.fillStyle = `rgba(240,228,255,${.7 * a})`;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(r * 1.15, (-.6 + i * .4) * r, r * .1, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  // A Susanoo katana: violet chakra blade, or Kagutsuchi's pitch-black one wreathed in black flame.
  function sword(ctx, hx, hy, ang, len, w, a, black, time) {
    if (!(a > .01)) return;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    const blade = (ww, ll, off = 0) => {
      ctx.beginPath(); ctx.moveTo(8 + off, -ww * .5); ctx.quadraticCurveTo(ll * .6, -ww * .62, ll * .9, -ww * .4); ctx.lineTo(ll, 0);
      ctx.lineTo(ll * .9, ww * .5); ctx.quadraticCurveTo(ll * .6, ww * .55, 8 + off, ww * .5); ctx.closePath();
    };
    ctx.globalAlpha = a;
    ctx.fillStyle = black ? 'rgba(130,24,96,.95)' : 'rgba(22,2,50,.85)'; blade(w + 7, len + 5, -3); ctx.fill();
    if (black) {
      ctx.fillStyle = '#000'; blade(w, len); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(190,60,170,.55)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(12, -w * .32); ctx.quadraticCurveTo(len * .6, -w * .4, len * .92, -w * .22); ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(130,56,250,.75)'; blade(w, len); ctx.fill();
      ctx.fillStyle = 'rgba(206,166,255,.7)'; blade(w * .5, len * .97); ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,255,.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(12, -w * .28); ctx.quadraticCurveTo(len * .6, -w * .36, len * .93, -w * .18); ctx.stroke();
      K().glow(ctx, len * .5, 0, len * .5, '150,70,255', .3, false, .3);
    }
    ctx.globalCompositeOperation = 'source-over';
    // guard and grip
    ctx.fillStyle = '#1a0636'; ctx.strokeStyle = 'rgba(220,196,255,.9)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(6, 0, 5, w * .95, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(60,18,130,.95)'; ctx.fillRect(-26, -w * .3, 28, w * .6);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (black) {
      // black flames streaming off the edge
      const tick = Math.floor(time * 12), ca = Math.cos(ang), sa = Math.sin(ang);
      for (let i = 0; i < 6; i++) {
        const u = .2 + i * .14, x = hx + ca * len * u, y = hy + sa * len * u, h = (26 + hash(i * 3.3) * 18) * a;
        ctx.globalAlpha = .9 * a;
        ctx.drawImage(amaFlame(i + tick), x - h * .3, y + 6 - h * FLAME_BASE, h * .6, h);
      }
      ctx.globalAlpha = 1;
    }
  }
  // Black-flame cluster on the ground (Amaterasu / Kagutsuchi fire): swaying, with a dark crimson heat haze.
  let BASE_M = null;
  function blackFlame(ctx, x, y, h, i, tick) {
    if (h < 5) return;
    h *= 1.3;
    K().glow(ctx, x, y - h * .32, h * .55, '70,6,50', .42, false, .8);
    const img = amaFlame(i + tick), sh = Math.sin(NOW * 3.1 + i * 1.7) * .22;
    if (BASE_M) K().flameAt(ctx, BASE_M, img, x, y, h * .92, h, sh), ctx.setTransform(BASE_M);
    else ctx.drawImage(img, x - h * .46, y - h * FLAME_BASE, h * .92, h);
  }
  function impact(ctx, x, y, t, R, seed, style, time) {
    const k = K(), f = 1 - ramp(t, .25, 1), q = easeOut(t * 2.5);
    if (!(f > .01)) return;
    ctx.save();
    puffs(ctx, x, y, 9, R * 1.05, t, seed, 'dust', .62, R * .3);
    ctx.globalCompositeOperation = 'lighter';
    if (t < .3) k.glow(ctx, x, y - 30, R * 1.3 * easeOut(t / .08), style === 'lightning' ? '220,190,255' : '200,150,255', 1 - t / .3, true);
    k.glow(ctx, x, y, R * 1.5 * q, style === 'black' ? '120,20,110' : '140,60,255', .55 * f, false, .5);
    ctx.globalCompositeOperation = 'source-over';
    if (k.fx && k.fx.shockRing) {
      k.fx.shockRing(ctx, x, y, R * 1.1, c01(t * 1.6), f, style === 'black' ? '150,40,140' : '150,80,255');
      if (t > .1) k.fx.shockRing(ctx, x, y, R * 1.7, c01((t - .1) * 1.4), f * .7, '190,140,255');
    }
    puffs(ctx, x, y - 10, style === 'black' ? 7 : 4, R * .7, t, seed + 5, style === 'black' ? 'smoke' : 'violet', style === 'black' ? .7 : .4, R * .26);
    if (k.fx && k.fx.debris) k.fx.debris(ctx, x, y, R * 1.1, t * 1.2, seed, '#3a2a3e', 12);
    if (style === 'lightning' && t < .6) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + seed, l = R * (.7 + hash(seed + i) * .6) * (1 - t);
        k.forkedBolt(ctx, x, y - 20, x + Math.cos(a) * l, y - 20 + Math.sin(a) * l * .6, seed + i * 13, time,
          { jitter: 22, alpha: 1 - t / .6, width: 2, pal: PAL_HOT, base: ink(1 - t / .6), forkBase: true, step: 18, forks: 3, forkLen: 34, rate: 26, snap: true });
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ ground layer per effect
  const GROUND = {
    form(ctx, fx, time) {
      const k = K(), t = fx.age, p = easeOut(t / .6), f = 1 - ramp(t, .5, fx.dur);
      ctx.fillStyle = `rgba(26,6,52,${.3 * f})`;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 70 + 240 * p, (70 + 240 * p) * .5, 0, 0, TAU); ctx.fill();
      inkRing(ctx, fx.x, fx.y, 40 + 300 * p, f, 4);
      if (t > .12) inkRing(ctx, fx.x, fx.y, 30 + 420 * easeOut((t - .12) / .7), f * .7, 2.5);
      cracks(ctx, fx.x, fx.y, 9, 150 + 120 * p, fx.id, f);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, fx.x, fx.y, 260 * p + 40, '130,50,255', .5 * f, false, .45);
      rays(ctx, fx.x, fx.y, 14, 40, 60 + 260 * p, fx.id, .7 * f, 2);
    },
    slash(ctx, fx, time) {
      const t = fx.age, f = 1 - ramp(t, .3, fx.dur), sw = easeOut((t - .1) / .14);
      if (!(sw > 0)) {
        ctx.fillStyle = 'rgba(120,60,230,.12)'; sector(ctx, fx.x, fx.y, 60, 470, fx.a - 1.25, fx.a + 1.25); ctx.fill();
        return;
      }
      const a0 = fx.a - fx.s * 1.25, a1 = a0 + fx.s * 2.5 * sw, lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      ctx.fillStyle = `rgba(24,4,52,${.32 * f})`; sector(ctx, fx.x, fx.y, 90, 470, lo, hi); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(130,60,250,${.3 * f})`; sector(ctx, fx.x, fx.y, 300, 470, lo, hi); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // three gouges cut into the ground along the sweep
      ctx.lineCap = 'round';
      for (const [r, w] of [[250, 6], [350, 8], [440, 5]]) {
        ctx.strokeStyle = `rgba(30,16,30,${.5 * f})`; ctx.lineWidth = w;
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, r * .55, 0, lo + .12, hi - .12); ctx.stroke();
      }
      puffs(ctx, fx.x + Math.cos(fx.a) * 330, fx.y + Math.sin(fx.a) * 330 * .55, 7, 160, t - .14, fx.id, 'dust', .7, 30);
    },
    fist(ctx, fx, time) {
      const t = fx.age, k = K();
      if (t < FIST_SLAM) {
        const c = t / FIST_SLAM;
        ctx.fillStyle = `rgba(20,6,40,${.15 + .3 * c})`;
        ctx.beginPath(); ctx.ellipse(fx.tx, fx.ty, 60 + 200 * c, (60 + 200 * c) * .5, 0, 0, TAU); ctx.fill();
        inkRing(ctx, fx.tx, fx.ty, 290, .5 + .4 * Math.sin(time * 22), 2.5);
        return;
      }
      const s = t - FIST_SLAM, f = 1 - ramp(t, 1, fx.dur);
      ctx.fillStyle = `rgba(28,16,26,${.55 * f})`;
      ctx.beginPath(); ctx.ellipse(fx.tx, fx.ty, 170, 84, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(10,4,14,${.45 * f})`;
      ctx.beginPath(); ctx.ellipse(fx.tx, fx.ty, 105, 50, 0, 0, TAU); ctx.fill();
      cracks(ctx, fx.tx, fx.ty, 12, 330, fx.id * 3, f);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, fx.tx, fx.ty, 300 * easeOut(s * 3), '140,60,255', .55 * (1 - ramp(s, .1, .8)), false, .5);
      ctx.globalCompositeOperation = 'source-over';
      inkRing(ctx, fx.tx, fx.ty, 80 + 300 * easeOut(s / .35), 1 - ramp(s, .2, .6), 5);
      if (s > .15) inkRing(ctx, fx.tx, fx.ty, 120 + 360 * easeOut((s - .15) / .45), 1 - ramp(s, .4, .9), 3);
    },
    kaguken(ctx, fx, time) {
      const t = fx.age - KAGU_REL, ca = Math.cos(fx.a), sa = Math.sin(fx.a), len = LEN.kaguken;
      if (t < 0) {
        ctx.fillStyle = 'rgba(30,4,30,.18)';
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + ca * len, fx.y + sa * len);
        ctx.strokeStyle = 'rgba(30,4,30,.25)'; ctx.lineWidth = 120; ctx.lineCap = 'round'; ctx.stroke();
        return;
      }
      const u = c01(t / KAGU_FLY), f = 1 - ramp(fx.age, fx.dur - .8, fx.dur);
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(16,2,14,${.42 * f})`; ctx.lineWidth = 110;
      ctx.beginPath(); ctx.moveTo(fx.x + ca * 60, fx.y + sa * 60); ctx.lineTo(fx.x + ca * len * u, fx.y + sa * len * u); ctx.stroke();
      ctx.strokeStyle = `rgba(140,24,90,${.35 * f})`; ctx.lineWidth = 4;
      for (const o of [-46, 46]) {
        ctx.beginPath(); ctx.moveTo(fx.x + ca * 60 - sa * o, fx.y + sa * 60 + ca * o); ctx.lineTo(fx.x + ca * len * u - sa * o, fx.y + sa * len * u + ca * o); ctx.stroke();
      }
    },
    magatama(ctx, fx, time) {
      const t = fx.age - MAGA_REL - MAGA_FLY;
      for (let i = 0; i < MAGA_N; i++) {
        const a = fx.a + (i - 1) * MAGA_SPREAD, x = fx.x + Math.cos(a) * LEN.magatama, y = fx.y + Math.sin(a) * LEN.magatama;
        if (t < 0) { inkRing(ctx, x, y, 175, .35 + .3 * c01(fx.age / (MAGA_REL + MAGA_FLY)), 2); continue; }
        const f = 1 - ramp(fx.age, fx.dur - .6, fx.dur);
        ctx.fillStyle = `rgba(14,2,12,${.45 * f})`;
        ctx.beginPath(); ctx.ellipse(x, y, 150, 72, 0, 0, TAU); ctx.fill();
        cracks(ctx, x, y, 8, 200, fx.id + i * 7, f * .8);
        if (t < .6) inkRing(ctx, x, y, 60 + 200 * easeOut(t / .5), 1 - t / .6, 4);
      }
    },
    amaterasu(ctx, fx, time) {
      const px = -Math.sin(fx.a), py = Math.cos(fx.a), h = AMA_LEN / 2, t = fx.age;
      const g = t < AMA_REL ? 0 : easeOut((t - AMA_REL) / .35), f = 1 - ramp(t, fx.dur - .7, fx.dur);
      ctx.lineCap = 'round';
      if (t < AMA_REL) {
        ctx.setLineDash([16, 12]); ctx.lineDashOffset = -time * 120;
        ctx.strokeStyle = 'rgba(30,4,30,.45)'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(fx.x - px * h, fx.y - py * h); ctx.lineTo(fx.x + px * h, fx.y + py * h); ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      ctx.strokeStyle = `rgba(12,0,10,${.5 * f})`; ctx.lineWidth = 130;
      ctx.beginPath(); ctx.moveTo(fx.x - px * h * g, fx.y - py * h * g); ctx.lineTo(fx.x + px * h * g, fx.y + py * h * g); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(150,20,80,${.3 * f})`; ctx.lineWidth = 8; ctx.stroke();
    },
    ult(ctx, fx, time) {
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a), len = LEN.ult, t = fx.age, x2 = fx.x + ca * len, y2 = fx.y + sa * len;
      ctx.lineCap = 'round';
      if (t < REL.ult) {
        const c = t / REL.ult;
        ctx.strokeStyle = `rgba(20,2,30,${.18 + .22 * c})`; ctx.lineWidth = 192;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([22, 14]); ctx.lineDashOffset = -time * 200;
        ctx.strokeStyle = `rgba(214,170,255,${.5 + .4 * c})`; ctx.lineWidth = 3;
        for (const o of [-96, 96]) { ctx.beginPath(); ctx.moveTo(fx.x - sa * o, fx.y + ca * o); ctx.lineTo(x2 - sa * o, y2 + ca * o); ctx.stroke(); }
        ctx.setLineDash([]);
        inkRing(ctx, x2, y2, 360 * (.5 + .5 * c), .4 + .5 * c, 3);
        return;
      }
      const s = t - REL.ult, u = c01(s / FLY.ult), f = 1 - ramp(t, fx.dur - 1, fx.dur);
      ctx.strokeStyle = `rgba(10,0,10,${.55 * f})`; ctx.lineWidth = 200;
      ctx.beginPath(); ctx.moveTo(fx.x + ca * 40, fx.y + sa * 40); ctx.lineTo(fx.x + ca * len * u, fx.y + sa * len * u); ctx.stroke();
      ctx.strokeStyle = `rgba(60,10,40,${.35 * f})`; ctx.lineWidth = 240; ctx.globalAlpha = .5; ctx.stroke(); ctx.globalAlpha = 1;
      if (u >= 1) {
        ctx.fillStyle = `rgba(10,0,8,${.5 * f})`;
        ctx.beginPath(); ctx.ellipse(x2, y2, 300, 150, 0, 0, TAU); ctx.fill();
        cracks(ctx, x2, y2, 14, 420, fx.id, f);
        cracks(ctx, (fx.x + x2) / 2, (fx.y + y2) / 2, 8, 260, fx.id + 5, f * .7);
      }
    },
    arrow: groundArrow, volley: groundArrow, chidori: groundArrow
  };
  function groundArrow(ctx, fx, time) {
    const rel = REL[fx.k], t = fx.age, n = fx.k === 'volley' ? VOLLEY_N : 1, len = LEN[fx.k];
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = fx.a + (n > 1 ? (i - 3) * VOLLEY_SPREAD : 0), ca = Math.cos(a), sa = Math.sin(a);
      const x2 = fx.x + ca * len, y2 = fx.y + sa * len;
      if (t < rel) {
        const c = t / rel;
        ctx.strokeStyle = `rgba(60,16,130,${.22 * c})`; ctx.lineWidth = fx.k === 'chidori' ? 26 : 14;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(x2, y2); ctx.stroke();
        if (i === (n > 1 ? 3 : 0)) {
          ctx.setLineDash([18, 12]); ctx.lineDashOffset = -time * 160;
          ctx.strokeStyle = `rgba(200,150,255,${.75 * c})`; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.setLineDash([]);
        }
        continue;
      }
      const s = t - rel - (n > 1 ? Math.abs(i - 3) * .03 : 0), u = c01(s / FLY[fx.k]), f = 1 - ramp(t, rel + .4, fx.dur);
      if (s < 0) continue;
      ctx.strokeStyle = `rgba(26,6,44,${.38 * f})`; ctx.lineWidth = fx.k === 'chidori' ? 40 : 24;
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + ca * len * u, fx.y + sa * len * u); ctx.stroke();
      if (u >= 1) {
        ctx.fillStyle = `rgba(28,14,30,${.45 * f})`;
        const R = fx.k === 'chidori' ? 130 : n > 1 && i !== 3 ? 46 : 90;
        ctx.beginPath(); ctx.ellipse(x2, y2, R, R * .5, 0, 0, TAU); ctx.fill();
        if (n === 1 || i === 3) cracks(ctx, x2, y2, 9, R * 2.2, fx.id + i, f);
      }
    }
  }

  // ------------------------------------------------------------------ overlay per effect
  function arrowFlight(ctx, fx, a, s0, sz, style, time, seed) {
    // Arrow tip leaves the bow and dives onto the end of its ground path.
    const k = K(), fy = fx.y + 3, len = LEN[fx.k];
    rig(fx.x, fy, a, 1, sz);
    const ax = RIG.tx, ay = RIG.ty;
    const ex = fx.x + Math.cos(a) * len, ey = fx.y + Math.sin(a) * len - 26;
    const fl = FLY[fx.k], u = c01(s0 / fl), f = 1 - ramp(s0, fl, fl + .45);
    const hx = lerp(ax, ex, u), hy = lerp(ay, ey, u), ang = Math.atan2(ey - ay, ex - ax);
    const W = style === 'black' ? 1.9 : style === 'chidori' ? 1.35 : 1.1;
    ctx.save(); ctx.lineCap = 'round';
    // trail: a tapered streak, thin at the bow and full width at the head, shrinking toward the target after impact
    const ut = c01((s0 - fl * .5) / (fl + .25)), tx0 = lerp(ax, hx, easeIn(ut)), ty0 = lerp(ay, hy, easeIn(ut));
    const dl0 = Math.hypot(hx - tx0, hy - ty0) || 1, qx = -(hy - ty0) / dl0, qy = (hx - tx0) / dl0;
    const tr = (w0, w1, c) => {
      ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(tx0 + qx * w0, ty0 + qy * w0); ctx.lineTo(hx + qx * w1, hy + qy * w1);
      ctx.arc(hx, hy, w1, Math.atan2(qy, qx), Math.atan2(qy, qx) - Math.PI, true);
      ctx.lineTo(tx0 - qx * w0, ty0 - qy * w0); ctx.closePath(); ctx.fill();
    };
    if (style === 'black') {
      tr(10, 66 * f, `rgba(60,0,50,${.45 * f})`);
      tr(6, 40 * f, `rgba(0,0,0,${.9 * f})`);
      ctx.globalCompositeOperation = 'lighter';
      tr(14, 80 * f, `rgba(110,30,190,${.3 * f})`);
      tr(1, 6 * f, `rgba(230,130,220,${.7 * f})`);
      // black flames streaming off the arrow's wake
      ctx.globalCompositeOperation = 'source-over';
      const tick = Math.floor(time * 12);
      for (let i = 0; i < 7; i++) {
        const v = 1 - i / 7 * .8, x = lerp(tx0, hx, v) + qx * (hash(seed + i) - .5) * 40, y = lerp(ty0, hy, v) + qy * (hash(seed + i) - .5) * 40;
        blackFlame(ctx, x, y + 20, (36 + hash(i * 3.3) * 24) * f * (.4 + .6 * v), i, tick);
      }
      ctx.globalCompositeOperation = 'lighter';
    } else {
      tr(2, (17 * W + 2) * f, ink(.75 * f));
      ctx.globalCompositeOperation = 'lighter';
      tr(2, (14 * W + 2) * f, `rgba(120,40,240,${.55 * f})`);
      tr(1, (7 * W + 1) * f, `rgba(214,170,255,${.8 * f})`);
      tr(.5, (2.4 * W + .6) * f, `rgba(255,250,255,${.95 * f})`);
    }
    // speed streaks alongside
    ctx.strokeStyle = `rgba(240,225,255,${.6 * f})`; ctx.lineWidth = 1.6;
    ctx.beginPath();
    const dl = Math.hypot(hx - ax, hy - ay) || 1, nx = -(hy - ay) / dl, ny = (hx - ax) / dl;
    for (let i = 0; i < 6; i++) {
      const p0 = frac(hash(seed + i * 3.7) + time * 2.6), p1 = Math.min(1, p0 + .12), o = (i % 2 ? 1 : -1) * (18 + hash(seed + i) * 26) * W;
      ctx.moveTo(lerp(ax, hx, p0) + nx * o, lerp(ay, hy, p0) + ny * o); ctx.lineTo(lerp(ax, hx, p1) + nx * o, lerp(ay, hy, p1) + ny * o);
    }
    ctx.stroke();
    if (style === 'chidori') {
      for (let i = 0; i < 2; i++) {
        const u0 = i / 2, u1 = (i + 1) / 2;
        k.forkedBolt(ctx, lerp(ax, hx, u0), lerp(ay, hy, u0), lerp(ax, hx, u1), lerp(ay, hy, u1), seed + i * 7, time,
          { jitter: 30, alpha: f, width: 2.2, pal: PAL_HOT, base: ink(f), forkBase: true, forks: 5, forkLen: 46, step: 26, rate: 26, snap: true });
      }
    }
    ctx.restore();
    if (u < 1) {
      ctx.save();
      drawArrow(ctx, hx, hy, ang, 110 * W, 9 * W, 1, style === 'black' ? 'black' : 'violet');
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, hx, hy, 70 * W, style === 'black' ? '150,40,170' : '190,120,255', .8, true);
      if (style === 'chidori') k.chidoriBall(ctx, hx, hy, 30, time, seed, { pal: PAL_HOT, body: '74,16,160', dark: '26,2,52', base: INK, power: 1, bolts: 9, width: 1.2 });
      ctx.restore();
    }
    if (s0 < .12) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, ax, ay, 150 * W, '230,200,255', 1 - s0 / .12, true); ctx.restore(); }
    return u;
  }

  const OVER = {
    form(ctx, fx, time) {
      const k = K(), t = fx.age, f = 1 - ramp(t, .6, fx.dur), fy = fx.y + 3, tick = Math.floor(time * 12);
      ctx.globalCompositeOperation = 'lighter';
      if (t < .4) k.glow(ctx, fx.x, fy - 140, 260 * easeOut(t / .12), '200,150,255', 1 - t / .4, true);
      k.glow(ctx, fx.x, fy - 160, 90, '150,60,255', .7 * f, false, 3);
      ctx.globalCompositeOperation = 'source-over';
      // a ring of violet flame tongues bursting up round him, leaning outward
      const m = ctx.getTransform();
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * TAU + hash(i) * .2, rr = (50 + 150 * easeOut(t / .5)) * (.75 + hash(i * 3) * .4), x = fx.x + Math.cos(a) * rr, y = fy + Math.sin(a) * rr * .5;
        const h = (70 + hash(i * 7) * 90) * bell(t / fx.dur * 1.1) + 8;
        ctx.globalAlpha = .62 * f;
        K().flameAt(ctx, m, vflame(i + tick), x, y, h * .55, h, Math.cos(a) * .35 + Math.sin(time * 5 + i) * .12);
      }
      ctx.setTransform(m);
      ctx.globalAlpha = 1;
      puffs(ctx, fx.x, fy, 12, 260, t, fx.id, 'violet', .5, 46);
      puffs(ctx, fx.x, fy, 10, 330, t, fx.id + 3, 'dust', .6, 38);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#e6d2ff';
      for (let i = 0; i < 24; i++) {
        const ph = c01(t / 1.1 + hash(i) * .2), a = hash(i * 3.1) * TAU, d = 40 + 160 * hash(i * 7.7);
        ctx.globalAlpha = (1 - ph) * .9;
        ctx.fillRect(fx.x + Math.cos(a) * d * (.6 + ph * .5) - 1.5, fy - 20 - ph * 260 * (.5 + hash(i * 5) * .7) - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    },
    fade(ctx, fx, time) {
      const k = K(), t = fx.age / fx.dur, fy = fx.y + 3;
      ctx.save();
      ctx.globalAlpha = .7 * (1 - t);
      ctx.translate(fx.x, fy - t * 30); ctx.scale(fx.f * (1 + t * .12), 1 + t * .12);
      ctx.drawImage(bodySprite(), -BOX, -BOY);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, fx.x, fy - 140, 170, '150,70,255', .5 * (1 - t));
      ctx.fillStyle = '#d8c0ff';
      for (let i = 0; i < 30; i++) {
        const ph = c01(t * 1.2 + hash(i) * .1), x = fx.x + (hash(i * 2.3) - .5) * 200, y = fy - 20 - hash(i * 4.1) * 240 - ph * 120;
        ctx.globalAlpha = (1 - ph) * .9;
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      ctx.restore();
    },
    slash(ctx, fx, time) {
      // The blade's afterimage: a violet crescent at chest height trailing the sweep.
      const t = fx.age, sw = easeOut((t - .1) / .14), f = 1 - ramp(t, .26, .6);
      if (!(sw > 0) || !(f > 0)) return;
      const k = K(), cy = fx.y + 3 - 112, a0 = fx.a - fx.s * 1.75, a1 = a0 + fx.s * 3.1 * sw;
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      ctx.globalAlpha = f;
      ctx.fillStyle = 'rgba(22,2,50,.5)'; sector(ctx, fx.x, cy, 120, 345, lo, hi, .58); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(120,50,240,.45)'; sector(ctx, fx.x, cy, 170, 338, lo, hi, .58); ctx.fill();
      ctx.fillStyle = 'rgba(200,150,255,.45)'; sector(ctx, fx.x, cy, 270, 338, lo, hi, .58); ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,255,.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(fx.x, cy, 336, 336 * .58, 0, lo, hi); ctx.stroke();
      const ea = fx.s > 0 ? hi : lo, ex = fx.x + Math.cos(ea) * 330, ey = cy + Math.sin(ea) * 330 * .58;
      k.glow(ctx, ex, ey, 80, '210,170,255', 1, true);
      // sparks thrown off the edge
      ctx.fillStyle = '#f0e2ff';
      for (let i = 0; i < 16; i++) {
        const ph = c01((t - .1) * 2.5 + hash(fx.id + i) * .3), a = lerp(lo, hi, hash(i * 3.3 + fx.id)), d = 340 + ph * 90 * hash(i);
        ctx.globalAlpha = (1 - ph) * f;
        ctx.fillRect(fx.x + Math.cos(a) * d - 1.5, cy + Math.sin(a) * d * .58 + ph * 60 - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    },
    arrow(ctx, fx, time) {
      const s = fx.age - REL.arrow;
      if (s < 0) return;
      const u = arrowFlight(ctx, fx, fx.a, s, 1, 'violet', time, fx.id);
      if (u >= 1) impact(ctx, fx.x + Math.cos(fx.a) * LEN.arrow, fx.y + Math.sin(fx.a) * LEN.arrow, s - FLY.arrow, 130, fx.id, 'violet', time);
    },
    volley(ctx, fx, time) {
      for (let i = 0; i < VOLLEY_N; i++) {
        const s = fx.age - REL.volley - Math.abs(i - 3) * .03;
        if (s < 0) continue;
        const a = fx.a + (i - 3) * VOLLEY_SPREAD;
        const u = arrowFlight(ctx, fx, a, s, 1, 'violet', time, fx.id + i * 11);
        if (u >= 1) impact(ctx, fx.x + Math.cos(a) * LEN.volley, fx.y + Math.sin(a) * LEN.volley, s - FLY.volley, i === 3 ? 120 : 70, fx.id + i, 'violet', time);
      }
    },
    chidori(ctx, fx, time) {
      const s = fx.age - REL.chidori;
      if (s < 0) return;
      const k = K(), u = arrowFlight(ctx, fx, fx.a, s, 1.1, 'chidori', time, fx.id);
      if (u < 1) return;
      const t = s - FLY.chidori, x2 = fx.x + Math.cos(fx.a) * LEN.chidori, y2 = fx.y + Math.sin(fx.a) * LEN.chidori;
      impact(ctx, x2, y2, t, 220, fx.id, 'lightning', time);
      const f = 1 - ramp(t, .35, .8);
      if (f > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        k.chidoriBall(ctx, x2, y2 - 40, 70 * (1 - t * .5), time, fx.id, { pal: PAL_HOT, body: '74,16,160', dark: '26,2,52', base: INK, power: 1, bolts: 12, width: 1.6, alpha: f });
        for (const c of fx.ch || []) {
          k.forkedBolt(ctx, x2, y2 - 40, c[0], c[1] - LIFT(), fx.id + c[0], time,
            { jitter: 26, alpha: f, width: 2, pal: PAL_HOT, base: ink(f), forkBase: true, forks: 3, forkLen: 30, step: 22, rate: 28, snap: true });
          k.glow(ctx, c[0], c[1] - LIFT(), 40, '200,140,255', f, true);
        }
        ctx.restore();
      }
    },
    fist(ctx, fx, time) {
      const t = fx.age, fy = fx.y + 3, f = fx.f;
      const sx = fx.x + f * SH_X, sy = fy - SH_Y;
      let hx, hy, a = 1;
      if (t < .3) { const c = easeOut(t / .3); hx = lerp(fx.x + f * 110, fx.tx, c); hy = lerp(fy - 130, fx.ty - 300, c); }
      else if (t < FIST_SLAM) { const c = easeIn((t - .3) / (FIST_SLAM - .3)); hx = fx.tx; hy = lerp(fx.ty - 300, fx.ty - 34, c); }
      else { hx = fx.tx; hy = fx.ty - 34 - easeOut((t - .6) / .3) * 60; a = 1 - ramp(t, .62, .88); }
      if (a > 0) {
        ctx.save();
        const d = Math.hypot(hx - sx, hy - sy), w = 40 + Math.min(16, d / 40);
        limb(ctx, sx, sy, hx, hy, -f * Math.min(90, d * .25), w, a, true);
        ctx.globalCompositeOperation = 'lighter';
        if (t < FIST_SLAM) K().glow(ctx, hx, hy, 70, '170,100,255', .6 * a);
        // speed lines on the downstroke
        if (t > .3 && t < FIST_SLAM + .05) {
          ctx.strokeStyle = 'rgba(240,225,255,.8)'; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = -3; i <= 3; i++) { ctx.moveTo(hx + i * 12, hy - 50 - Math.abs(i) * 6); ctx.lineTo(hx + i * 12, hy - 150 - Math.abs(i) * 10); }
          ctx.stroke();
        }
        ctx.restore();
      }
      if (t >= FIST_SLAM) {
        const s = t - FIST_SLAM;
        impact(ctx, fx.tx, fx.ty, s * .9, 260, fx.id, 'violet', time);
        // rocks heaved up round the crater rim
        const k = K();
        ctx.save();
        for (let i = 0; i < 10; i++) {
          const ph = c01(s * 1.4 - hash(i) * .1), ang = i / 10 * TAU + hash(fx.id + i), d = 120 + 80 * hash(i * 2);
          if (ph <= 0 || ph >= 1) continue;
          const x = fx.tx + Math.cos(ang) * d * (1 + ph * .4), y = fx.ty + Math.sin(ang) * d * .5 - bell(ph) * (60 + hash(i * 5) * 60);
          const r = 8 + hash(i * 7) * 9;
          ctx.globalAlpha = 1 - ph * ph;
          ctx.fillStyle = '#4a3a3c'; ctx.strokeStyle = '#1e1418'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * .3, y - r * .9); ctx.lineTo(x + r, y - r * .3); ctx.lineTo(x + r * .5, y + r * .7); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
        if (s < .2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, fx.tx, fx.ty - 30, 320, '230,210,255', 1 - s / .2, true); ctx.restore(); }
      }
    },
    kaguken(ctx, fx, time) {
      const t = fx.age - KAGU_REL;
      if (t < 0) return;
      const k = K(), ca = Math.cos(fx.a), sa = Math.sin(fx.a), len = LEN.kaguken, tick = Math.floor(time * 12);
      const u = c01(t / KAGU_FLY), fEnd = 1 - ramp(fx.age, fx.dur - .9, fx.dur);
      // black flames left burning along the cut
      for (let i = 0; i < 14; i++) {
        const v = (i + .5) / 14;
        if (v > u) break;
        const o = (hash(fx.id + i * 3.1) - .5) * 90, x = fx.x + ca * (70 + (len - 70) * v) - sa * o, y = fx.y + sa * (70 + (len - 70) * v) + ca * o;
        const born = v * KAGU_FLY, h = (40 + hash(i * 5.3) * 46) * easeOut((t - born) / .2) * fEnd * (.88 + .12 * Math.sin(time * 9 + i));
        blackFlame(ctx, x, y, h, i, tick);
      }
      // the travelling crescent of black fire
      if (u < 1) {
        const d = 70 + (len - 70) * u, cx = fx.x + ca * d, cy = fx.y + sa * d - 46;
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(1, .62); ctx.rotate(Math.atan2(sa / .62, ca));
        const R = 190, cres = (rr, th) => {
          ctx.beginPath(); ctx.arc(-R * .55, 0, rr, -1.05, 1.05);
          ctx.quadraticCurveTo(-R * .55 + rr * .5 - th, 0, -R * .55 + Math.cos(-1.05) * rr, Math.sin(-1.05) * rr); ctx.closePath();
        };
        ctx.fillStyle = 'rgba(150,30,110,.9)'; cres(R + 6, 70); ctx.fill();
        ctx.fillStyle = '#000'; cres(R, 56); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(200,90,230,.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(-R * .55, 0, R - 4, -1, 1); ctx.stroke();
        k.glow(ctx, 0, 0, 220, '120,30,150', .55);
        ctx.restore();
        ctx.save();
        for (let i = 0; i < 9; i++) {
          const o = (i - 4) / 4, x = cx - ca * 30 * (1 - Math.abs(o)) - sa * o * 150, y = cy + 40 - sa * 30 + ca * o * 150 * .62;
          blackFlame(ctx, x, y, 50 + (1 - Math.abs(o)) * 40, i + 3, tick);
        }
        ctx.restore();
      } else if (t < KAGU_FLY + .8) {
        impact(ctx, fx.x + ca * len, fx.y + sa * len, t - KAGU_FLY, 140, fx.id, 'black', time);
      }
      if (fEnd > 0) {
        const sm = k.puff('smoke');
        for (let i = 0; i < 5; i++) {
          const ph = frac(time * .4 + i * .2), v = Math.min(u, (i + .5) / 5), x = fx.x + ca * len * v, y = fx.y + sa * len * v;
          k.stamp(ctx, sm, x, y - 50 - ph * 130, 26 + ph * 34, .35 * (1 - ph) * fEnd);
        }
      }
    },
    magatama(ctx, fx, time) {
      const k = K(), t = fx.age, fy = fx.y + 3, tick = Math.floor(time * 12);
      offPose(fx.x, fy, fx.f, 1, { k: 'magatama', a: fx.a, t: Math.min(t, MAGA_REL) }, time);
      const hx = OFF.hx, hy = OFF.hy;
      for (let i = 0; i < MAGA_N; i++) {
        const a = fx.a + (i - 1) * MAGA_SPREAD, ex = fx.x + Math.cos(a) * LEN.magatama, ey = fx.y + Math.sin(a) * LEN.magatama;
        if (t < MAGA_REL + MAGA_FLY) {
          // forming at the hand, then flying in a low arc, spinning
          const u = t < MAGA_REL ? 0 : (t - MAGA_REL) / MAGA_FLY, grow = t < MAGA_REL ? easeOut(t / MAGA_REL) : 1;
          const bx = hx + (i - 1) * 26 * (1 - u), by = hy - 10 + Math.abs(i - 1) * 8 * (1 - u);
          const x = lerp(bx, ex, u), y = lerp(by, ey - 30, u) - bell(u) * 70;
          drawMagatama(ctx, x, y, 22 * grow, time * 14 + i * 2, 1, tick + i);
          if (u > 0) {
            ctx.save(); ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 16;
            const u0 = Math.max(0, u - .25), x0 = lerp(bx, ex, u0), y0 = lerp(by, ey - 30, u0) - bell(u0) * 70;
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
            ctx.restore();
          }
          continue;
        }
        const s = t - MAGA_REL - MAGA_FLY, f = 1 - ramp(t, fx.dur - .7, fx.dur);
        if (s < .9) impact(ctx, ex, ey, s, 160, fx.id + i, 'black', time);
        // a dome of black fire, then a burning patch
        for (let j = 0; j < 9; j++) {
          const aa = j / 9 * TAU + i, d = (40 + 90 * hash(fx.id + j + i * 9)) * easeOut(s / .25);
          const h = (60 + hash(j * 4.4 + i) * 60) * (1 + .6 * (1 - ramp(s, .1, .5))) * f * (.88 + .12 * Math.sin(time * 9 + j));
          blackFlame(ctx, ex + Math.cos(aa) * d, ey + Math.sin(aa) * d * .5, h, j + i, tick);
        }
        if (s < .25) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, ex, ey - 40, 200, '220,120,220', 1 - s / .25, true); ctx.restore(); }
      }
    },
    amaterasu(ctx, fx, time) {
      const k = K(), t = fx.age, px = -Math.sin(fx.a), py = Math.cos(fx.a), h = AMA_LEN / 2, tick = Math.floor(time * 12);
      if (t < AMA_REL) {
        // the Susanoo's eye bleeds: a red glint at the helm, then black sparks igniting along the line
        const c = t / AMA_REL;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, fx.sx + fx.f * 8, fx.sy + 3 - 197, 22 + 10 * Math.sin(t * 40), '255,40,70', .95, true);
        ctx.restore();
        for (let i = 0; i < 7; i++) {
          const v = (i / 6 - .5) * 2 * c;
          k.glow(ctx, fx.x + px * h * v, fx.y + py * h * v - 14, 24 * c + 6, '0,0,0', .8 * c);
        }
        return;
      }
      const g = easeOut((t - AMA_REL) / .35), burst = 1 + .7 * (1 - ramp(t - AMA_REL, .1, .5)), f = 1 - ramp(t, fx.dur - .9, fx.dur);
      ctx.save();
      for (let i = 0; i < 30; i++) {
        const v = (i + .5) / 30 * 2 - 1;
        if (Math.abs(v) > g) continue;
        const o = (hash(fx.id + i * 3.3) - .5) * 60, x = fx.x + px * h * v + Math.cos(fx.a) * o, y = fx.y + py * h * v + Math.sin(fx.a) * o * .6;
        const hh = (78 + hash(i * 5.1 + fx.id) * 62) * (1 - Math.abs(v) * .35) * burst * f * (.88 + .12 * Math.sin(time * 9 + i));
        blackFlame(ctx, x, y, hh, i, tick);
      }
      ctx.restore();
      const sm = k.puff('smoke');
      for (let i = 0; i < 7; i++) {
        const ph = frac(time * .35 + i / 7), v = (hash(fx.id + i) * 2 - 1) * g;
        k.stamp(ctx, sm, fx.x + px * h * v, fx.y + py * h * v - 80 - ph * 170, 34 + ph * 46, .42 * (1 - ph) * f);
      }
      if (t - AMA_REL < .3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, fx.x, fx.y - 40, 300, '170,40,140', .7 * (1 - (t - AMA_REL) / .3), false, .5); ctx.restore(); }
    },
    ult(ctx, fx, time) {
      const k = K(), t = fx.age, tick = Math.floor(time * 12), ca = Math.cos(fx.a), sa = Math.sin(fx.a), len = LEN.ult;
      const x2 = fx.x + ca * len, y2 = fx.y + sa * len;
      if (t < REL.ult) {
        // black-flame storm gathering on the arrow tip
        rig(fx.x, fx.y + 3, fx.a, 1, 1.25);
        const c = t / REL.ult;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, RIG.tx, RIG.ty, 60 + 80 * c, '170,60,220', .7 * c, true);
        ctx.restore();
        for (let i = 0; i < 8; i++) {
          const ph = frac(time * 1.6 + i / 8), a = i / 8 * TAU + time, d = (120 - 100 * ph) * c;
          ctx.globalAlpha = c * (1 - ph * .5);
          drawMagatama(ctx, RIG.tx + Math.cos(a) * d, RIG.ty + Math.sin(a) * d * .6, 6 + 6 * (1 - ph), a * 3, 1, i + tick);
        }
        ctx.globalAlpha = 1;
        return;
      }
      const s = t - REL.ult, u = arrowFlight(ctx, fx, fx.a, s, 1.25, 'black', time, fx.id);
      const f = 1 - ramp(t, fx.dur - 1, fx.dur);
      // the whole path bursts into black flame
      for (let i = 0; i < 26; i++) {
        const v = (i + .5) / 26;
        if (v > u) break;
        const o = (hash(fx.id + i * 2.7) - .5) * 150, x = fx.x + ca * (80 + (len - 80) * v) - sa * o, y = fx.y + sa * (80 + (len - 80) * v) + ca * o;
        const hh = (60 + hash(i * 3.9) * 70) * easeOut((s - v * FLY.ult) / .25) * f * (1 + .5 * (1 - ramp(s, .3, .9))) * (.88 + .12 * Math.sin(time * 9 + i));
        blackFlame(ctx, x, y, hh, i, tick);
      }
      if (u >= 1) {
        const e = s - FLY.ult;
        impact(ctx, x2, y2, e * .7, 330, fx.id, 'black', time);
        for (let j = 0; j < 14; j++) {
          const aa = j / 14 * TAU, d = (60 + 200 * hash(fx.id + j)) * easeOut(e / .3);
          const hh = (90 + hash(j * 4.4) * 80) * (1 + .7 * (1 - ramp(e, .1, .6))) * f * (.88 + .12 * Math.sin(time * 9 + j));
          blackFlame(ctx, x2 + Math.cos(aa) * d, y2 + Math.sin(aa) * d * .5, hh, j + 5, tick);
        }
        if (e < .35) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, x2, y2 - 60, 520 * easeOut(e / .1), '220,140,255', 1 - e / .35, true); ctx.restore(); }
      }
      const sm = k.puff('smoke');
      for (let i = 0; i < 8; i++) {
        const ph = frac(time * .32 + i / 8), v = Math.min(u, hash(fx.id + i * 1.3));
        k.stamp(ctx, sm, fx.x + ca * len * v, fx.y + sa * len * v - 80 - ph * 190, 40 + ph * 50, .45 * (1 - ph) * f);
      }
    }
  };
  // A Kagutsuchi magatama: a black comma of fire with a crimson-violet rim, spinning.
  function drawMagatama(ctx, x, y, r, rot, a, v) {
    if (!(r > 1)) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const path = rr => {
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU);
      ctx.moveTo(rr * .2, -rr * .98);
      ctx.quadraticCurveTo(rr * 2.2, -rr * 1.2, rr * 2.1, rr * .9);
      ctx.quadraticCurveTo(rr * 1.4, -rr * .2, rr * .2, rr * .98);
      ctx.closePath();
    };
    ctx.fillStyle = `rgba(150,30,120,${.9 * a})`; path(r + 3); ctx.fill();
    ctx.fillStyle = `rgba(0,0,0,${a})`; path(r); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    K().glow(ctx, 0, 0, r * 2.4, '130,30,170', .5 * a);
    ctx.restore();
  }

  // ------------------------------------------------------------------ the Susanoo itself
  const stOf = new WeakMap();
  const SKIRT = [];
  for (let i = 0; i < 9; i++) SKIRT.push([(i - 4) * 16, -4 + Math.abs(i - 4) * 2.5, 64 + (4 - Math.abs(i - 4)) * 9 + hash(i * 2.2) * 18]);
  const EDGE = [[-76, -150, 44], [76, -150, 44], [-84, -176, 40], [84, -176, 40], [-40, -186, 30], [40, -186, 30],
    [-22, -226, 36], [22, -226, 36], [0, -266, 30], [-66, -108, 40], [66, -108, 40], [-56, -64, 46], [56, -64, 46]];

  function drawAura(ctx, p, feetY, facing, time, front) {
    NOW = time; BASE_M = ctx.getTransform();
    const k = K();
    if (!k || !p) return;
    const st = stOf.get(p), A = st && st.act ? st.act : null;
    const fa = st && typeof st.fa === 'number' ? st.fa : 9, lvl = easeOut(fa / 1.1);
    const ultK = A && A.k === 'ult' ? bell(A.t / A.d) * 1.2 : 0, ult = Math.min(1, ultK);
    const s = 1 + .1 * ult, x = p.x, fy = feetY, f = facing, tick = Math.floor(time * 12);
    const flick = .85 + .15 * Math.sin(time * 13) * Math.sin(time * 7.3);
    const bow = A && isBow(A.k) ? A : null;
    ctx.save();
    if (!front) {
      // dark underlay + violet bloom so the giant reads on bright sand
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, x, fy - 140 * s, 190 * s * lvl, '110,40,230', .32 * lvl);
      ctx.globalCompositeOperation = 'source-over';
      if (ult > .01) {
        ctx.globalAlpha = .9 * ult * lvl;
        const ws = s * (.6 + .4 * ult);
        ctx.save(); ctx.translate(x, fy); ctx.scale(f * ws, ws); ctx.drawImage(wingSprite(), -WOX, -WOY); ctx.restore();
        ctx.globalAlpha = 1;
      }
      // tall flames licking off the outline
      const m = ctx.getTransform();
      for (let i = 0; i < EDGE.length; i++) {
        const [ex, ey, eh] = EDGE[i], h = eh * s * lvl * (.8 + .25 * Math.sin(time * 9 + i * 1.7)) * (1 + ult * .4);
        if (h < 6) continue;
        ctx.globalAlpha = .62 * flick;
        k.flameAt(ctx, m, vflame(i + tick), x + ex * f * s, fy + ey * s + 10, h * .55, h, Math.sin(time * 3 + i) * .25 - f * .12);
      }
      ctx.setTransform(m);
      ctx.globalAlpha = 1;
      // the off arm (behind the body)
      const showOff = !bow;
      // ribcage, then the armour rising out of the flames during the forming
      ctx.save(); ctx.translate(x, fy); ctx.scale(f * s, s);
      const kr = easeOut(fa / .55), kb = easeOut((fa - .3) / .8);
      if (kr > 0) {
        if (kr < 1) { ctx.save(); ctx.beginPath(); ctx.rect(-BOX, -BOY * kr - 10, BW, BOY * kr + 20); ctx.clip(); }
        ctx.globalAlpha = .95 * Math.min(1, kr * 1.4);
        ctx.drawImage(ribSprite(false), -BOX, -BOY);
        if (kr < 1) ctx.restore();
      }
      if (kb > 0) {
        if (kb < 1) { ctx.save(); ctx.beginPath(); ctx.rect(-BOX, -BOY * kb - 10, BW, BOY * kb + 20); ctx.clip(); }
        ctx.globalAlpha = .93 * Math.min(1, kb * 1.5);
        ctx.drawImage(bodySprite(), -BOX, -BOY);
        if (kb < 1) ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (showOff && kb > .2) {
        offPose(x, fy, f, s, A, time);
        limb(ctx, x - f * SH_X * s, fy - SH_Y * s, OFF.hx, OFF.hy, f * 26 * s, 36 * s, kb, true);
      }
      // the flame skirt below the ribs
      for (let i = 0; i < SKIRT.length; i++) {
        const [sx, sy, sh] = SKIRT[i], h = sh * s * (.5 + .5 * lvl) * (.85 + .2 * Math.sin(time * 8 + i * 2.1)) * (fa < 1 ? 1 + (1 - fa) * 1.2 : 1);
        ctx.globalAlpha = .55 * flick;
        ctx.drawImage(vflame(i + 3 + tick), x + sx * s - h * .28, fy + sy - h * FLAME_BASE, h * .56, h);
      }
      ctx.globalAlpha = 1;
      // glowing eyes (red while Amaterasu ignites)
      const hot = A && A.k === 'amaterasu' && A.t < AMA_REL + .1;
      ctx.globalCompositeOperation = 'lighter';
      const pulse = (.75 + .25 * Math.sin(time * 6)) * kb;
      for (const ex of [-8.4, 8.4]) k.glow(ctx, x + ex * f * s, fy - 197 * s, hot ? 20 : 11, hot ? '255,40,70' : '235,215,255', pulse, true);
      ctx.restore();
      return;
    }
    // ---- front layer: front ribs round Naruto, the sword arm, the bow
    const kb = easeOut((fa - .3) / .8);
    ctx.save(); ctx.translate(x, fy); ctx.scale(f * s, s);
    ctx.globalAlpha = .5 * flick * easeOut(fa / .55);
    ctx.drawImage(ribSprite(true), -BOX, -BOY);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (bow) {
      const rel = REL[bow.k], dk = bow.t < rel ? easeOut(bow.t / (rel * .85)) : 0;
      const ba = Math.min(1, bow.t / .12) * (bow.t < rel ? 1 : 1 - ramp(bow.t, rel + .05, bow.d));
      drawBow(ctx, x, fy, bow, dk, ba * kb, kb, s * (bow.k === 'ult' ? 1.25 : 1), time);
    } else if (kb > .2 && !(A && A.k === 'fist')) {
      const P = swordPose(x, fy, f, s, A, time);
      const black = A && A.k === 'kaguken';
      limb(ctx, x + f * SH_X * s, fy - SH_Y * s, P.hx, P.hy, -f * 22 * s, 38 * s, kb, true);
      sword(ctx, P.hx, P.hy, P.ba, 210 * s, 15 * s, kb, black, time);
      if (A && (A.k === 'slash' || A.k === 'kaguken') && A.t > .1 && A.t < .3) {
        ctx.globalCompositeOperation = 'lighter';
        const ca = Math.cos(P.ba), sa = Math.sin(P.ba);
        k.glow(ctx, P.hx + ca * 190 * s, P.hy + sa * 190 * s, 60, black ? '170,40,140' : '210,170,255', .8, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // embers drifting up off the giant
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#e2ccff';
    for (let i = 0; i < 12; i++) {
      const ph = (time * .55 + i / 12) % 1, px = x + (hash(i * 3.3) - .5) * 190 * s + Math.sin(i * 5.1 + time * 1.4) * 10, py = fy - 20 - ph * 260 * s;
      ctx.globalAlpha = (1 - ph) * .85 * lvl; ctx.fillRect(px - 1.4, py - 1.4, 2.8, 2.8);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawBow(ctx, x, fy, A, dk, a, armA, s, time) {
    if (!(a > .01) && !(armA > .01)) return;
    const k = K(), R = rig(x, fy, A.a, dk, s), side = R.side;
    const shY = fy - SH_Y * s;
    ctx.save();
    limb(ctx, x + side * SH_X * s, shY, R.gx, R.gy, -side * 30 * s, 36 * s, armA, true);
    limb(ctx, x - side * SH_X * s, shY, R.nx, R.ny, side * 20 * s, 34 * s, armA, true);
    const { dx, dy, px, py, gx, gy } = R;
    if (!(a > .01)) { ctx.restore(); return; }
    const bowPath = () => {
      ctx.beginPath(); ctx.moveTo(R.t1x + dx * 22 * s + px * 7 * s, R.t1y + dy * 22 * s + py * 7 * s);
      ctx.quadraticCurveTo(R.t1x, R.t1y, R.t1x + dx * 4 * s, R.t1y + dy * 4 * s);
      ctx.quadraticCurveTo(gx + px * 95 * s + dx * 26 * s, gy + py * 95 * s + dy * 26 * s, gx, gy);
      ctx.quadraticCurveTo(gx - px * 95 * s + dx * 26 * s, gy - py * 95 * s + dy * 26 * s, R.t2x + dx * 4 * s, R.t2y + dy * 4 * s);
      ctx.quadraticCurveTo(R.t2x, R.t2y, R.t2x + dx * 22 * s - px * 7 * s, R.t2y + dy * 22 * s - py * 7 * s);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    bowPath();
    const black = A.k === 'ult';
    ctx.strokeStyle = black ? `rgba(130,24,96,${.9 * a})` : `rgba(24,4,54,${.85 * a})`; ctx.lineWidth = 24 * s + 3; ctx.stroke();
    ctx.strokeStyle = black ? `rgba(10,0,12,${.95 * a})` : `rgba(150,80,250,${.9 * a})`; ctx.lineWidth = 16 * s + 1; ctx.stroke();
    ctx.strokeStyle = black ? `rgba(220,120,220,${.8 * a})` : `rgba(250,238,255,${a})`; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = black ? `rgba(150,40,170,${.3 * a})` : `rgba(150,80,255,${.3 * a})`; ctx.lineWidth = 40 * s; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(235,215,255,${.9 * a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(R.t1x, R.t1y); ctx.lineTo(R.nx, R.ny); ctx.lineTo(R.t2x, R.t2y); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, gx, gy, 150 * s, black ? '150,40,170' : '150,70,255', .32 * a);
    ctx.globalCompositeOperation = 'source-over';
    // the nocked arrow(s)
    if (dk > 0) {
      const ang = Math.atan2(dy, dx), tx = R.tx, ty = R.ty, L = Math.hypot(tx - R.nx, ty - R.ny);
      if (A.k === 'volley') {
        for (let i = 0; i < VOLLEY_N; i++) {
          const da = (i - 3) * .07, c = Math.cos(ang + da), sn = Math.sin(ang + da);
          drawArrow(ctx, R.nx + c * L, R.ny + sn * L, ang + da, L - 8, 6 * s, a, 'violet');
        }
      } else {
        drawArrow(ctx, tx, ty, ang, L - 8, (A.k === 'ult' ? 11 : A.k === 'chidori' ? 8 : 7) * s, a, A.k === 'ult' ? 'black' : 'violet');
      }
      if (A.k === 'chidori') {
        k.chidoriBall(ctx, tx, ty, 16 + 16 * dk, time, 77, { pal: PAL_HOT, body: '74,16,160', dark: '26,2,52', base: INK, power: dk, bolts: 8, width: 1.1, alpha: a });
        k.forkedBolt(ctx, R.nx, R.ny, tx, ty, 91, time, { jitter: 14, alpha: a, width: 1.6, pal: PAL_HOT, base: INK, forkBase: true, forks: 4, forkLen: 26, step: 20, rate: 26, snap: true });
      }
      if (A.k === 'ult') {
        const tick = Math.floor(time * 12);
        for (let i = 0; i < 6; i++) {
          const u = .15 + i * .15, fx = lerp(R.nx, tx, u), fyy = lerp(R.ny, ty, u), h = (34 + hash(i) * 22) * dk;
          ctx.globalAlpha = .95 * a; blackFlame(ctx, fx, fyy + 10, h, i, tick);
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawLabel(ctx, st, p) {
    const L = st.lbl;
    if (!L || !L.t || !(L.a < 1.6) || !p || !p.susanoo) return;
    const y = p.y + 3 - 288;
    const a = Math.min(1, (1.6 - L.a) / .35) * Math.min(1, L.a / .08 + .3);
    ctx.save();
    ctx.globalAlpha = c01(a);
    ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3.4; ctx.strokeStyle = '#14042a'; ctx.lineJoin = 'round';
    ctx.strokeText(L.t, p.x, y - L.a * 4);
    ctx.fillStyle = '#e4ccff'; ctx.fillText(L.t, p.x, y - L.a * 4);
    ctx.restore();
  }

  const REACH = { form: 500, fade: 300, slash: 520, arrow: 1250, volley: 1150, chidori: 1300, fist: 800, kaguken: 1000, magatama: 950, amaterasu: 700, ult: 1400 };
  function fxCenter(fx) {
    if (fx.k === 'amaterasu' || fx.k === 'form' || fx.k === 'fade' || fx.k === 'slash') return [fx.x, fx.y];
    if (fx.k === 'fist') return [(fx.x + fx.tx) / 2, (fx.y + fx.ty) / 2];
    const len = LEN[fx.k] || 0;
    return [fx.x + Math.cos(fx.a) * len / 2, fx.y + Math.sin(fx.a) * len / 2];
  }

  // ------------------------------------------------------------------ public
  window.SusanooMode = {
    toggle(st, p, on, api) {
      if (!st || !p) return;
      ensure(st);
      if (on) {
        st.fa = 0; st.act = null;
        add(st, { k: 'form', x: r0(p.x), y: r0(p.y), h: 0, dur: 1.5 });
        label(st, 'form');
      } else {
        add(st, { k: 'fade', x: r0(p.x), y: r0(p.y), f: faceOf(p.angle || 0), dur: .8 });
        st.act = null; st.lbl = null; st.fa = 9;
      }
    },
    click(st, p, api) {
      if (!st || !p) return;
      ensure(st);
      const n = p.suCount || 0, kind = COMBO[n % COMBO.length];
      CAST[kind](st, p, api);
      p.suCount = n + 1;
      label(st, kind);
    },
    update,
    drawGround(ctx, st, p, time) {
      if (!st || !ctx || !K()) return;
      if (p) stOf.set(p, st);
      const L = st.effects, on = p && p.susanoo && !(p.down > 0);
      if (!on && !(L && L.length)) return;
      setView(ctx);
      if (on) {
        const k = K(), lvl = easeOut((st.fa || 0) / 1.1);
        ctx.save();
        ctx.fillStyle = `rgba(28,6,58,${.28 * lvl})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 120, 52, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, p.x, p.y + 3, 150, '120,50,240', .45 * lvl, false, .42);
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 2; i++) {
          const t = (time * .45 + i / 2) % 1;
          inkRing(ctx, p.x, p.y + 3, 60 + t * 110, (1 - t) * .55 * lvl, 2);
        }
        ctx.restore();
      }
      if (!L) return;
      for (const fx of L) {
        const fn = fx && GROUND[fx.k];
        if (!fn || !Number.isFinite(fx.age)) continue;
        const [cx, cy] = fxCenter(fx);
        if (!vis(cx, cy, REACH[fx.k] || 700)) continue;
        ctx.save();
        try { fn(ctx, fx, time); } catch (err) { console.warn('Susanoo ground', fx.k, err); }
        ctx.restore();
      }
    },
    drawOverlay(ctx, st, p, time) {
      NOW = time; BASE_M = ctx.getTransform();
      if (!st || !ctx || !K()) return;
      const L = st.effects;
      if (L && L.length) {
        setView(ctx);
        for (const fx of L) {
          const fn = fx && OVER[fx.k];
          if (!fn || !Number.isFinite(fx.age)) continue;
          const [cx, cy] = fxCenter(fx);
          if (!vis(cx, cy, REACH[fx.k] || 700)) continue;
          ctx.save();
          try { fn(ctx, fx, time); } catch (err) { console.warn('Susanoo overlay', fx.k, err); }
          ctx.restore();
        }
      }
      drawLabel(ctx, st, p);
    },
    drawAura
  };
})();
